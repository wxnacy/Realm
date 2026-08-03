---
phase: 25-script-tab
reviewed: 2026-08-03T16:17:47Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - ai-manager.js
  - main.js
  - src/index.html
  - src/preload.js
  - src/renderer.js
  - src/styles/main.css
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-08-03T16:17:47Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

审查了 phase 25（script-tab）的全部变更：AI 脚本生成/预览/执行链路（ai-manager.js 的 `validateScriptForSteps`/`executeScript`/三个新工具、main.js 的 `script:execute`/`script:stop`/`tab:reorder` IPC、preload 桥接、renderer 的脚本预览卡片与标签分组卡片、HTML 模板与 CSS）。

整体结构清晰、JSDoc 完备、分组卡片渲染普遍使用 textContent 防 XSS。但发现三个必须处理的问题：

1. **脚本预览卡片从未接入渲染流程** —— `renderScriptPreviewCard` 是死代码，`generate_script` 工具结果走默认工具卡片，脚本的「预览→编辑→执行」UI 入口在用户面前不存在。
2. **D-10 白名单在实际执行点没有 enforcement** —— `script:execute` IPC 从不调用 `validateScriptForSteps`，而 `generate_script` 里验证的是 `steps: []` 空骨架（空数组恒安全），白名单与高风险确认流程被整体绕过。
3. **脚本步骤错误面板用 innerHTML 插值错误信息**，错误文本含 AI 生成的不可信内容，在持有 realmAPI 特权接口的渲染进程中构成 XSS。

另有多处数据回读损坏（DOM 当数据源）、状态不同步（重排不落 state）等质量问题，详见下文。

## Critical Issues

### CR-01: 脚本步骤错误面板 innerHTML 插值不可信错误信息，构成渲染进程 XSS

**File:** `src/renderer.js:5274-5279`
**Issue:** `handleStepUpdate` 在步骤失败时用 `innerHTML` 拼接错误面板，`${error || '操作执行失败'}` 直接插入 HTML。`error` 来自主进程 `cdpManager.executeAction` 的 `result.error` / `err.message`，其中包含步骤的 `target`、CSS 选择器、页面返回值等 **AI 生成的不可信内容**（项目安全模型明确 AI 工具输入不可信）。例如 AI 生成 target 为 `<img src=x onerror=...>` 的步骤，定位失败错误信息回显时即注入执行。渲染进程持有 `window.realmAPI` 特权接口，XSS 可调用任意 IPC。同文件 renderScriptPreviewCard 自己注释「使用 textContent 防止 XSS（T-25-04）」，此处违反同一规范。

**Fix:**
```javascript
const errorPanel = document.createElement('div');
errorPanel.className = 'step-error-panel';
const msgEl = document.createElement('div');
msgEl.className = 'step-error-message';
msgEl.textContent = error || '操作执行失败';  // textContent 防 XSS
const actionsEl = document.createElement('div');
actionsEl.className = 'step-error-actions';
// 三个按钮用 createElement 创建（后续 querySelector 逻辑相应调整）
```

### CR-02: script:execute 链路完全绕过 D-10 action 白名单与高风险确认流程

**File:** `main.js:1741-1776`、`ai-manager.js:2135-2173`（generate_script execute）
**Issue:** D-10 声明脚本步骤仅允许 `SCRIPT_ALLOWED_ACTIONS` 13 种安全操作（不含 screenshot/upload/execute_script），但该约束在两个执行点上均失效：

1. `generate_script` 的 execute 构造 `steps: []` 空骨架后调用 `validateScriptForSteps` —— 空数组循环零次，**恒返回 safe**，验证形同虚设；真实步骤由 AI 后续在对话中产出，从未经过此函数。
2. 实际执行入口 `script:execute`（main.js:1741）只校验 `steps` 是非空数组，**从不调用 `validateScriptForSteps`**。渲染端传来的 `step.action` 可为 `execute_script`（任意 JS 注入页面）、`upload`（文件上传）、`screenshot`、`submit`（表单提交）等，全部直达 `cdpManager.executeAction`，且**不经过** execute_action 工具里 D-05/D-06/D-07 的高风险操作确认卡片流程。

净效果：AI 生成的脚本经用户在预览卡片点击「执行脚本」后，可静默执行 upload/submit 等本应要求确认的高风险操作。`validateScriptForSteps` 是定义后从未对真实数据调用的死代码。

**Fix:**
在 `ai-manager.js` 导出 `validateScriptForSteps`，并在 `script:execute` handler 中强制执行：
```javascript
// main.js script:execute handler 内，validate 格式后：
const { executeScript, validateScriptForSteps } = require('./ai-manager');
const validation = validateScriptForSteps(script);
if (!validation.safe) {
  return { success: false, error: `脚本安全检查未通过: ${validation.reason}` };
}
```
同时对 submit 等需确认的操作接入既有确认流程，或在白名单中移除 submit 并文档化。

### CR-03: renderScriptPreviewCard 从未被调用 —— 脚本预览/执行 UI 不可达（死代码）

**File:** `src/renderer.js:4698`（定义）、`src/renderer.js:3912-3960`（renderToolCards）
**Issue:** `renderToolCards` 的 JSDoc（3908 行）声称 `generate_script` 会渲染脚本预览卡片，但实际只 special-case 了 `suggest_tab_groups` / `apply_tab_groups`（3929-3955）。全文件搜索 `renderScriptPreviewCard` 仅命中定义处和 JSDoc，**没有任何调用点**。后果：

- `generate_script` 工具结果只渲染默认折叠工具卡片，脚本预览卡片（编辑步骤、执行脚本按钮）对用户不可见；
- `window.realmAPI.scriptExecute` 在 UI 层没有任何触发入口，整个脚本执行链路（main.js IPC、executeScript 引擎、步骤状态回显）实际不可达；
- `src/index.html` 的 `script-preview-template` 与 main.css 约 260 行脚本卡片样式同为死代码。

**Fix:**
在 `renderToolCards` 中为 `generate_script` 补充分支（参照分组卡片的信封解包逻辑）：
```javascript
if (toolExec.name === 'generate_script' && toolExec.status === 'completed' && toolExec.result) {
  try {
    let resultData = typeof toolExec.result === 'string' ? JSON.parse(toolExec.result) : toolExec.result;
    if (resultData && Array.isArray(resultData.content)) {
      const textBlock = resultData.content.find(b => b && b.type === 'text' && typeof b.text === 'string');
      if (textBlock) resultData = JSON.parse(textBlock.text);
    }
    if (resultData && Array.isArray(resultData.steps)) {
      const scriptCard = renderScriptPreviewCard(resultData);
      if (scriptCard) { container.appendChild(scriptCard); return; }
    }
  } catch (err) {
    console.error('[Realm Renderer] 解析脚本工具结果失败:', err.message);
  }
}
```
注意：generate_script 当前返回的骨架 `steps: []`，还需让 AI 产出的完整步骤数组回流到工具结果中，预览卡片才有内容可渲染。

## Warnings

### WR-01: collectStepsFromDOM 从展示用 DOM 回读数据，执行时步骤数据多处损坏

**File:** `src/renderer.js:5666-5695`（配合 5382、5395）
**Issue:** 执行脚本时不序列化原始 `script.steps` 数据，而是从显示用 DOM 反查，三处数据损坏：

1. **空 target 变字面量**：`renderScriptStepItem` 把空 target 显示为 `'(未设置目标)'`（5382），回读后 `step.target` 变成字符串 `'(未设置目标)'`（5684），执行时拿占位文本当 CSS 选择器定位元素。
2. **参数截断后无法还原**：params 显示截断为 50 字符 + `...`（5395），回读时 `JSON.parse` 截断串必失败，fallback 为 `{ value: '截断后的残串...' }`（5688-5690）——长参数（如一段输入文本）被静默截断损坏。
3. **waitFor 字段丢失**：`step.waitFor` 从不渲染也不回收，而 `executeScript`（ai-manager.js:389）依赖 `waitFor === 'load'` 决定是否等待页面加载 —— 用户一旦经卡片执行，该语义全部丢失。

**Fix:** 卡片在渲染时把步骤数据数组挂在卡片元素上（如 `card._scriptSteps`），编辑/拖拽/删除同步维护该数组，执行时直接深拷贝序列化，DOM 仅作展示。不要用 DOM 当数据源。

### WR-02: 步骤内联编辑保存后参数显示不更新，执行的仍是旧参数

**File:** `src/renderer.js:5418-5428`
**Issue:** 编辑器的 `onSave` 回调只更新 `actionLabel.textContent` 和 `targetEl.textContent`，不更新 `paramsEl`。由于 `collectStepsFromDOM` 从 `paramsEl.textContent` 读参数（5686-5691），用户修改参数点保存后，界面上仍显示旧参数，执行时用的也是旧参数 —— 编辑静默失效。

**Fix:** onSave 中同步重建 paramsEl（或按 WR-01 改为数据驱动后，编辑直接改数据数组并局部重渲染该步骤项）。

### WR-03: 多张脚本卡片并存时步骤状态更新串台

**File:** `src/renderer.js:5212-5225`
**Issue:** `handleStepUpdate` 遍历 `document.querySelectorAll('.script-preview-card')`，取**第一个**含有 `items[index]` 的卡片更新 UI。`script:step-update` 消息只带 `index`，不带任何脚本/卡片标识。聊天中存在两张脚本预览卡片时，执行第二张卡片的脚本，步骤状态（executing/success/error 高亮和错误面板）会全部打到第一张卡片上。

**Fix:** 执行时为卡片生成 executionId，`script:execute` 传入并由 `script:step-update` 回传，renderer 按 executionId 定位卡片。

### WR-04: 标签分组重排只改 DOM 不落 state，任意 renderTabs() 后顺序回退、分隔线消失

**File:** `src/renderer.js:5781-5821`（handleTabReordered）、`src/renderer.js:1417-1447`（renderTabs）、`main.js:1801-1843`
**Issue:** `handleTabReordered` 只重排 `#tabList` 内的 DOM 元素，不同步 `state.tabs`（Map 的插入顺序），主进程 `tab:reorder` 也不更新 `tabManager` 的标签顺序。而 `renderTabs()` 每次全量执行 `tabList.innerHTML = ''` 并按 `state.tabs` 顺序 + pinned 分组重建 —— 任何标签新建/关闭/置顶/容器切换触发 renderTabs 后：分组顺序回退到旧顺序、`.tab-group-divider-line` 分隔线被整体抹掉。「应用分组」的效果是一次性的视觉重排。

**Fix:** 重排后按 `flatOrder` 重建 `state.tabs` 的插入顺序（Map 按新顺序重设），`renderTabs` 重建时保留分组分隔线（或把分组信息存入 state 并在 renderTabs 中渲染）；如需重启后保持，还需 tabManager 持久化顺序。

### WR-05: executeScript 的「等待 load」实为固定 5 秒 sleep，与注释/D-04 声称的事件等待不符

**File:** `ai-manager.js:387-391`
**Issue:** JSDoc（327 行）与行内注释声称「等待页面 loadEventFired 事件，超时后兜底继续」，实现却是无条件 `setTimeout(5000)`。两个后果：慢页面 5 秒未加载完成，后续 click/type 步骤打在未就绪页面上失败；快页面每个 navigate 步骤白等 5 秒。且该 sleep 不检查 `abortSignal`，用户点「终止」后仍要等满 5 秒才停。

**Fix:** 通过 CDP 监听 `Page.loadEventFired`（navigate 后 attach 的 session 上），事件到达即继续，5 秒超时兜底；等待期间轮询/监听 abortSignal 使终止即时生效。若决定保留固定 sleep，请修正注释与 JSDoc，避免误导后续维护者。

### WR-06: script:execute 静默丢弃 script.containerId，脚本总在当前活跃标签页执行

**File:** `main.js:1747-1748`、`src/renderer.js:4730-4735`
**Issue:** 渲染端执行时收集了 `containerId` 并随 scriptData 发送（4734），`generate_script` 工具也支持指定目标容器（ai-manager.js:2140-2150），但 `script:execute` handler 只用 `getActiveWebviewContentsId()` 取当前活跃标签页，`containerId` 被静默忽略。为容器 A 生成的脚本，当用户停留在容器 B 的标签页时点击执行，脚本全部打在容器 B 的页面上 —— 跨容器隔离语义下这是打错目标。

**Fix:** 按 `containerId` 从 tabManager 找到该容器的目标标签页取其 webContentsId（不存在时返回明确错误），或删除该参数并在工具描述中注明「脚本在当前活跃标签页执行」。

### WR-07: scriptAbortController 单例在并发执行时互相覆盖

**File:** `main.js:1732-1770`
**Issue:** `scriptAbortController` 是模块内单变量。两张脚本卡片可同时点「执行」（各自的 executeBtn 独立），第二次 `script:execute` 会覆盖第一次的 controller 引用：此后 `script:stop` 只能停掉后一个执行；且先完成的执行把 `scriptAbortController = null` 后，后一个执行变得不可停止。

**Fix:** 用 `Map<executionId, AbortController>` 管理并发执行，`script:execute` 返回 executionId，`script:stop` 按 id 停止；或主进程拒绝并发执行（已有执行进行中时返回错误）。

## Info

### IN-01: validateScriptForSteps 对 options 只做顶层字符串浅检查

**File:** `ai-manager.js:237-244`
**Issue:** 危险模式检测只遍历 `Object.values(step.options)` 的顶层字符串值，嵌套对象/数组内的字符串不检查（如 `options: { nested: { payload: 'fetch(...' } }` 可绕过）。当前白名单操作不执行嵌套 JS，实际风险低，但 CR-02 修复后该函数成为唯一闸口，建议递归遍历（可复用 sanitizeInput 的 deepSanitize 遍历模式）。另外 `\bwindow\.\b` / `\bdocument\.\b` 对合法输入有误报面（如 type 步骤的输入文本提到 "window.location" 会被拦），建议仅在 action 为 execute_script 类时启用这两条规则。

### IN-02: tab:reorder 未防御跨组重复 tabId

**File:** `main.js:1812-1823`
**Issue:** 同一 tabId 出现在多个分组时 `flatOrder` 含重复项，`fullOrder` 也含重复，渲染端 appendChild 同一元素两次后最终位置以最后出现为准，分组语义混乱。当前渲染端 DOM 拖拽天然去重，属防御性建议：`if (groupedTabIds.has(tabId)) continue;` 或直接报错。

### IN-03: 删除第一个分组时残留孤立分隔线

**File:** `src/renderer.js:5009-5014`
**Issue:** 删除分组时只移除 `section.previousElementSibling` 的 divider。分隔线总在非首个分组之前，删除第一个分组时 `prevDivider` 为 null，原第二分组前的 divider 残留在列表顶部。另 `sections.length <= 1` 分支（4990-4995）清空组内标签但保留空分组，应用分组后会产生 0 标签的空分组。

**Fix:** 删除时同时处理 `nextElementSibling` 为 divider 且 section 为首个的情况；空分组在 `collectTabGroupsFromDOM` 或主进程侧过滤。

### IN-04: 分组删除按钮「移至最后一个分组」语义反直觉

**File:** `src/renderer.js:4997-5003`
**Issue:** 删除中间分组时，组内标签被合并到**最后一个**分组（而非相邻分组或「未分组」概念），用户难以预期。建议删除时将被删组的标签并入下一分组，或追加为独立的「未分组」区。仅 UX 建议。

---

_Reviewed: 2026-08-03T16:17:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

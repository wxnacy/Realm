---
phase: 22-cdp
plan: 03
subsystem: ai
tags: [ai-tools, cdp, system-prompt, error-handling, lifecycle-cleanup]

# Dependency graph
requires:
  - phase: 22-cdp plan 01
    provides: cdp-manager attachForAI/detachForAI/executeCommand 三段式 API
  - phase: 22-cdp plan 02
    provides: read_page_content/extract_links/open_link 工具实现与 resolveToolTargetTab
provides:
  - REALM_SYSTEM_PROMPT 全量工具能力说明 + 使用指南（场景→工具映射、DevTools 冲突提示）
  - webview 销毁时 CDP 调试器状态自动清理（web-contents-created destroyed → detachForAI）
  - 6 条错误文案与 22-UI-SPEC 契约完全对齐
affects: [Phase 23 智能上下文引用, Phase 24 任务自主执行, Phase 25 脚本生成]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "webview 销毁清理与容器映射清理同点挂接：主进程 web-contents-created 的 destroyed 监听（contents.id 即 guest webContentsId）"
    - "用户可见错误文案以 UI-SPEC 契约为唯一来源，技术细节（err.message）保留在主进程 console 日志"
    - "AI 工具错误统一 throw new Error()，经 pi-agent-core tool_execution_end(isError) → _setupEventBroadcasting 广播 'failed' 状态到渲染进程"

key-files:
  created: []
  modified: [ai-manager.js, main.js, cdp-manager.js]

key-decisions:
  - "webview destroyed 清理挂接在主进程 webContents 生命周期事件而非渲染进程 webview 标签事件：contents.id 是 detachForAI 直接入参，与既有 unregisterGuestContainer 同位置同模式"
  - "页面未加载判定为 tab.url 为空或非 http(s)（新建 tab url='' 与 realm:// 内部页统一覆盖），校验置于 resolveToolTargetTab 活跃性检查之后"

patterns-established:
  - "集成校验类任务：先跑注册验证脚本，再按 UI-SPEC 逐条 grep 核对文案，不一致处按 deviation 规则就地修复"

requirements-completed: [CDP-01, CDP-02, CDP-03, CDP-04]

coverage:
  - id: D1
    description: "REALM_SYSTEM_PROMPT 包含 read_page_content/extract_links/open_link 说明与使用指南"
    requirement: CDP-02, CDP-03, CDP-04
    verification:
      - kind: other
        ref: "grep 'read_page_content: 读取当前标签页的页面内容' ai-manager.js + grep '使用指南' ai-manager.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "main.js webview destroyed 监听调用 cdpManager.detachForAI(contents.id)"
    requirement: CDP-01
    verification:
      - kind: other
        ref: "grep -c 'detachForAI' main.js = 2；node --check main.js 语法通过"
        status: pass
    human_judgment: false
  - id: D3
    description: "_buildRealmTools() 返回 8 个工具且三新工具 name/label/description/parameters/execute 齐全"
    requirement: CDP-02, CDP-03, CDP-04
    verification:
      - kind: other
        ref: "node -e 注册验证脚本：read_page_content/extract_links/open_link 全 PASS，字段完整性 PASS"
        status: pass
    human_judgment: false
  - id: D4
    description: "6 条错误文案与 22-UI-SPEC 契约逐条一致（DevTools 冲突/页面未加载/CDP 附加失败/内容截断/链接打开失败/容器不存在）"
    requirement: CDP-01, CDP-02, CDP-03, CDP-04
    verification:
      - kind: other
        ref: "grep 六条文案精确匹配：cdp-manager.js:316/341、ai-manager.js:115/1031/1175/1187/1193"
        status: pass
    human_judgment: false
  - id: D5
    description: "运行时行为：错误经 toast/工具卡片呈现、tool_execution_update 状态广播、webview 销毁时清理实际触发"
    requirement: CDP-01, CDP-02, CDP-03, CDP-04
    verification: []
    human_judgment: true
    rationale: "需要真实 Electron GUI 环境（打开 DevTools 冲突、关闭 tab 触发 destroyed 等），静态验证无法覆盖；由 Phase 22 UAT 验证"

# Metrics
duration: 5min
completed: 2026-08-02
status: complete
---

# Phase 22 Plan 03: 集成（系统提示词 + webview 销毁清理 + 错误处理校验）Summary

**AI 系统提示词注册三个网页工具说明与使用指南，webview 销毁自动清理 CDP 调试器状态，6 条错误文案与 22-UI-SPEC 契约逐条对齐（3 处缺失/不符已就地修复）**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-02T04:53:58Z
- **Completed:** 2026-08-02T04:58:10Z
- **Tasks:** 3
- **Files modified:** 3（ai-manager.js、main.js、cdp-manager.js）

## Accomplishments

- REALM_SYSTEM_PROMPT 从仅 get_tabs 扩展为全量 8 工具能力说明，新增使用指南（场景→工具映射 + DevTools 冲突处理提示）
- main.js web-contents-created 的 destroyed 监听追加 `cdpManager.detachForAI(contents.id)`：AI 工具三段式执行期间用户关闭 tab 时，debuggerStates 条目不再残留（D-03 用完即卸兜底，与既有 unregisterGuestContainer 同点挂接）
- 工具注册验证通过：8 个工具全部 name/label/description/parameters/execute 字段齐全
- 6 条 UI-SPEC 错误文案逐条核对，修复 3 处缺失/不符（见 Deviations）；所有错误经 `throw new Error()` → pi-agent-core `tool_execution_end(isError)` → `_setupEventBroadcasting()` 广播 `failed` 状态到渲染进程工具卡片（既有链路，无需新增代码）

## Task Commits

Each task was committed atomically:

1. **Task 1: 更新 AI 系统提示词** - `5559783` (feat)
2. **Task 2: webview 销毁时清理 CDP 调试器状态** - `bf2df1c` (feat)
3. **Task 3: 对齐 22-UI-SPEC 错误文案契约** - `e0c40b8` (fix)

## Files Created/Modified

- `ai-manager.js` — REALM_SYSTEM_PROMPT 全量更新；resolveToolTargetTab 新增页面未加载校验；open_link 新标签页路径失败文案统一 + send 异常防御
- `main.js` — webview destroyed 监听追加 detachForAI 清理（+4 行）
- `cdp-manager.js` — attachForAI 附加失败返回文案改为 UI-SPEC 契约文本
- `.planning/phases/22-cdp/deferred-items.md` — 新建：记录 Network 抓取调试器状态销毁残留（预存在，超范围）

## Decisions Made

- **destroyed 清理挂接主进程 webContents 事件**：计划伪码为渲染进程风格（`webview.addEventListener('destroyed')` + `getWebContentsId()`），实际代码结构中 main.js 已有 `web-contents-created → contents.on('destroyed')` 监听（容器映射清理同在其中），`contents.id` 即 guest webContentsId 可直接作为 detachForAI 入参 —— 按 orchestrator 提示依既有模式实现，files_modified 保持 main.js 不变
- **页面未加载校验位置与条件**：置于 resolveToolTargetTab 活跃性检查之后（非活跃报错更优先，语义更精确）；条件为 `!tab.url || 非 http(s)`，同时覆盖新建 tab（url=''）与 realm:// 内部页

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] attachForAI 附加失败文案不符合 22-UI-SPEC 契约**
- **Found during:** Task 3（错误文案逐条核对）
- **Issue:** cdp-manager.js 返回 `CDP 附加失败: ${err.message}`，与 UI-SPEC 定义的 '无法连接到页面调试器，请刷新页面后重试' 不符；该文案经工具 throw 直达渲染进程工具卡片，属用户可见契约违反
- **Fix:** 返回值改为 UI-SPEC 精确文案，err.message 保留在既有 console.error 日志（技术细节不丢失）
- **Files modified:** cdp-manager.js（计划 frontmatter files_modified 之外的文件，Task 3 校验职责范围内的合理延伸）
- **Committed in:** `e0c40b8`（Task 3 提交）

**2. [Rule 2 - Missing Critical] 页面未加载场景缺少 UI-SPEC 文案**
- **Found during:** Task 3（错误文案逐条核对）
- **Issue:** UI-SPEC 定义 '当前标签页未加载页面，请先打开网页'，但 read_page_content/extract_links 对新 tab（url=''）或 realm:// 内部页无前置校验，会向空白页注入脚本产出无意义空结果而非明确报错
- **Fix:** resolveToolTargetTab 新增 `tab.url` http(s) 校验，命中时抛 UI-SPEC 精确文案；read_page_content 与 extract_links 共用该 helper，单点修复两处生效
- **Files modified:** ai-manager.js
- **Committed in:** `e0c40b8`（Task 3 提交）

**3. [Rule 2 - Missing Critical] open_link 新标签页路径失败缺少 UI-SPEC 文案**
- **Found during:** Task 3（错误文案逐条核对）
- **Issue:** UI-SPEC 定义 '无法在容器中打开链接，请检查容器状态'，但 newTab=true 路径主窗口缺失时报 '未找到主窗口'，且 `webContents.send` 无异常防御
- **Fix:** 主窗口缺失/已销毁改抛 UI-SPEC 精确文案；send 调用包 try/catch，异常时记录日志并抛同一文案
- **Files modified:** ai-manager.js
- **Committed in:** `e0c40b8`（Task 3 提交）

---

**Total deviations:** 3 auto-fixed（1 bug、2 missing critical）
**Impact on plan:** 均为 UI-SPEC 契约对齐修复，无范围蔓延、无新增依赖。Task 3 计划动作本身即"验证错误处理文案"，3 处修复是该校验的预期产出。

## Issues Encountered

None beyond deviations — Wave 1/2 交付的 CDP 三段式 API 与工具实现按计划直接可集成。注意 Wave 2 记录的 3 处偏差（tab.webContentsId 不存在、open-url-in-tab 通道、Runtime.evaluate 防御）已基于实际代码核对，与本计划 Task 3 校验无冲突。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 22 全部 3 个计划完成：CDP-01 基础设施、CDP-02/03/04 工具、集成与文案契约就绪，可进入 Phase 22 UAT（需 Electron GUI 环境验证运行时行为：DevTools 冲突提示、真实页面提取、销毁清理触发）
- Phase 23 智能上下文引用可直接消费 read_page_content/extract_links 与全量系统提示词
- 待后续处理：非活跃 tab 支持需 tabId→guestId 映射（22-02 已记录）；Network 抓取调试器状态销毁残留（deferred-items.md）

## Self-Check: PASSED

- FOUND: ai-manager.js / main.js / cdp-manager.js 三文件修改落盘
- FOUND: REALM_SYSTEM_PROMPT 含 'read_page_content: 读取当前标签页的页面内容' 与 '使用指南'
- FOUND: main.js 含 'cdpManager.detachForAI(contents.id)'
- FOUND: commit 5559783（Task 1）、bf2df1c（Task 2）、e0c40b8（Task 3）于 git log
- FOUND: node --check 两文件语法通过；注册验证 8 工具 PASS；三次提交均无文件删除
- FOUND: 6 条 UI-SPEC 错误文案逐条 grep 精确匹配

---
*Phase: 22-cdp*
*Completed: 2026-08-02*

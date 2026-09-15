---
phase: 51-zip
plan: 06
subsystem: 用户技能导入管线（设置页完整导入弹框：两 tab / 六字段预览 / 必勾 / 冲突三选一 / 9 态状态机 / 键盘与 AT 契约）
tags: [skills, import, ui, settings-page, dialog, csp, a11y, injection, sanitize, uat, electron, playwright]
dependency-graph:
  requires:
    - 51-03（导入纵切：`importId` 六字段预览 / 唯一落盘实现 / `IMPORT_SKILL_ERROR` 20 键 / `IMPORT_LIMITS` 回传值）
    - 51-04（冲突三档事务 / `INVALID_NAME` 第 21 码 / 拒绝面矩阵完全态）
    - 51-05（网络面四码 / `preview.conflict` 形状 / `PENDING_CODES_NETWORK` 已清空）
    - 50（`setSkillManageHint` 单源 / 同区 inline hint 反馈面 / `.ai-modal-overlay` 的 `display:none` 初始隐藏先例）
  provides:
    - "`src/settings.html`：`.skill-manage-header` + `#skillImportOpen` + `#skillImportFile` + `#skillImportModal.ai-modal-overlay` 全骨架（18 个元素的 id 齐备、顺序即契约）"
    - "`src/settings-page.js`（`/* Phase 51 skill-import region: start/end */` 内）：`setImportState` / `setImportMode` / `openSkillImportModal` / `closeSkillImportModal` / `renderSkillImportPreview` / `renderSkillImportTree` / `renderSkillImportScripts` / `renderSkillImportScan` / `renderSkillImportConflict` / `updateConfirmGate` / `sanitizeDisplayString` / `fetchSkillImportPreview` / `performSkillImport` / `cancelSkillImportRequest` / `SKILL_IMPORT_ERROR_TEXT`（21 键闭合表）/ `SKILL_IMPORT_CONFIRM_TEXT`（二元表）"
    - "`src/styles/main.css`：`/* ===== 设置页「技能导入」（Phase 51） ===== */` 段（+226 行，含 3 条作用域覆盖 + 双主题令牌 `--skill-error-text` / `--skill-limit-text`）"
    - "新驱动 `tests/uat-51-import-modal.js`（真实 `_electron`，52 条断言：两条 backstop 正命题读数 / 四条禁用原因 / 键盘与焦点契约 / 注入纪律渲染快照 / 显示层净化）"
    - "`tests/test-skills-import.js` +174 行：码表双向覆盖（含正命题键数下限）+ 注入纪律（负命题 + 正命题）+ 闭合白名单 + finally 置空 + 四条诚实边界 + 不复刻改名校验"
  affects:
    - 51-07（文档与账本：UI-SPEC 的 40 条文案口径、`#skillImportGate` 的禁用原因**不在 live region 内**这一已知边界、`quota` / `diagnostics` 未上屏的诚实披露、counts-parity `cells` 12 → 20）
tech-stack:
  added: []
  patterns:
    - 状态机单点：`setImportState(state, detail)` 是唯一决定「状态行 / 预览 display / 必勾 / 冲突 / 两按钮 disabled / 门控文本」的地方
    - 零 HTML 字符串模板：全部 `document.createElement` + `textContent` / `el.title` / `setAttribute`（`TD-48-01` 仍开未修 ⇒ 本区责任是「不扩大缺口」）
    - 显示层净化与拒绝判据分离：`sanitizeDisplayString` 只作用于显示，判据仍用原始字节（否则 RTL override 样本会逃过检查）
    - 禁用一律原生 `disabled`（不用 `aria-disabled`）+ 禁用原因走可见文本（不写 `title`）
    - 闭合文案表 + 双向覆盖机械判据（前端表键 ↔ 主进程常量值）
    - 真实 `_electron` 驱动的带正命题属性测试（E2 / E17 两条 backstop）
key-files:
  created:
    - tests/uat-51-import-modal.js
  modified:
    - src/settings.html
    - src/settings-page.js
    - src/styles/main.css
    - tests/test-skills-import.js
    - .planning/WINDOWS.md
decisions:
  - "两条 backstop 的**计划指定变异无效**（实测逐字未变）—— 改用能真正探到同一属性的可满足探针证明判别力（详见下文「Backstop 判别力」）。判据本身一字未改"
  - "计划门禁「码表双向覆盖」的键正则不含数字类 ⇒ 恒红；权威判据按计划指定落点放 `tests/test-skills-import.js`（正确键正则 + `tableKeys.size >= 21` 正命题）"
  - "计划门禁「文件输入 finally 置空」用子串判定 ⇒ 被无关的 `fileInput.value = ''` 命中、无判别力；权威判据同落 `tests/test-skills-import.js`"
  - "`tests/.uat-out/` 的证据 JSON 沿用 49/50 既有驱动的落点约定（仓库内、可重生成、不入库）"
metrics:
  duration: "~55 min（含 429 中断后由主会话接管续做）"
  tasks: 3
  commits: 3
  files: 6
  completed: 2026-09-15
actuals:
  tokens: 39176
  tasks: 3
  commits: 3
  plan_head_before: 6537204a54a601314be299a9ea72e6833f19309c
coverage:
  - id: T1
    description: "弹框骨架 + 9 态状态机 + 键盘与 AT 契约（E1-E6）：两 tab 可切、状态行 `role=status` + `aria-live=polite` 兼唯一播报源、`Escape` 挂 document 且有可见性守卫（committing 忽略 / downloading 取消）、遮罩点击与取消走同一关闭路径、关闭复位契约（预览 / 状态行 / 必勾 / 冲突 / URL / 文件输入）、初始焦点落在当前模式面板首个交互元素、焦点归还按 `isConnected` 判定"
    requirement: USER-05
    verification:
      - kind: unit
        ref: "门禁一：`弹框骨架 ok`（18 元素 id + AT 契约 + 顺序 + 无 aria-modal）"
        status: pass
      - kind: unit
        ref: "门禁二：`状态机与交互 ok`（9 态单点 + AbortController + 输入复位 + region 无 innerHTML 且有 DOM 正命题）"
        status: pass
      - kind: unit
        ref: "门禁三：`CSP 纪律 ok`（15 个新增元素零内联 style + 初始隐藏由 `.ai-modal-overlay` 类规则承担）"
        status: pass
      - kind: e2e
        ref: "tests/uat-51-import-modal.js#ready 态 Escape 关闭弹框 / 提交中 Escape 被忽略 / 关闭复位契约 / 焦点归还 / isConnected===false 时不 focus"
        status: pass
    human_judgment: false
  - id: T2
    description: "六字段预览（E7-E13，字段集 = D-13）+ 必勾（E14）+ 冲突三选一（E15）+ 改名（E16）+ 动作区（E17）+ 区级 hint（E18）+ 两张闭合文案表 + 显示层净化带可见提示"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "门禁一：`预览面 ok`（六字段渲染函数 + 两张闭合表 + 显示层净化 + 四条诚实边界恒显）"
        status: pass
      - kind: unit
        ref: "tests/test-skills-import.js#SKILL_IMPORT_ERROR_TEXT ↔ IMPORT_SKILL_ERROR 双向覆盖（21/21，含正命题键数下限）"
        status: pass
      - kind: unit
        ref: "tests/test-skills-import.js#注入纪律（负命题 + 正命题）/ 闭合白名单 / finally 置空 / 四条诚实边界 / 不复刻改名校验"
        status: pass
      - kind: e2e
        ref: "tests/uat-51-import-modal.js#四条禁用原因各一条断言 + 未勾选时真实 click() 不提交 + 二元表文案切换"
        status: pass
    human_judgment: false
  - id: T3
    description: "`.skill-import-*` 样式段（含 3 条作用域覆盖与双主题令牌）+ 真实渲染 uat 驱动：两条 backstop 的带正命题读数 + 键盘契约 + 注入纪律渲染快照，证据固化进仓库"
    requirement: USER-05
    verification:
      - kind: unit
        ref: "门禁七：`样式段 ok`（3 条作用域覆盖 + 唯一滚动容器 `min-height:0` + 动作区无 flex-wrap + 双主题令牌恰 2 处）"
        status: pass
      - kind: unit
        ref: "门禁八：`uat 驱动 ok`（真实读数 + 动态数据集 + 三处假绿规避）"
        status: pass
      - kind: e2e
        ref: "tests/uat-51-import-modal.js（`uat-51-import-modal: 52 passed`）—— 证据 JSON: `tests/.uat-out/uat-51-import-modal.json`"
        status: pass
    human_judgment: false
status: complete
---

# Phase 51 Plan 06: 完整导入弹框 UI 契约 Summary

**本计划由编排层在子代理 429 中断后接管续做**：子代理已完成 Task 1（`da183f0`）与 Task 2（`10dcb51`），Task 3 停在「CSS 已改、驱动已写但均未提交」的中间态。主会话从残留处续做：抽计划自带 `<automated>` 门禁逐条实跑 → 9 条可失败性变异 + 2 条 backstop 探针 → 提交 Task 3（`fc8c135`）→ 本 SUMMARY。

---

## 三条任务的实际交付

| 任务 | 提交 | 落点 |
|------|------|------|
| T1 弹框骨架 + 9 态状态机 + 键盘与 AT（E1-E6） | `da183f0` | `src/settings.html`(+61/-…)、`src/settings-page.js`(+576) |
| T2 六字段预览 + 必勾 + 冲突三选一 + 闭合文案表（E7-E18） | `10dcb51` | `src/settings-page.js`(+827)、`tests/test-skills-import.js`(+174) |
| T3 样式段 + 真实渲染 uat 驱动 | `fc8c135` | `src/styles/main.css`(+226)、`tests/uat-51-import-modal.js`（新建 1065 行）、`.planning/WINDOWS.md` |

---

## 门禁实测结果（9 条全部在当前树上逐字实跑）

| # | 任务 | 结果 |
|---|------|------|
| 1 | T1 | `弹框骨架 ok（18 元素 id 齐备 + AT 契约 + 顺序 + 无 aria-modal）` |
| 2 | T1 | `状态机与交互 ok（9 态单点 + 可中断 + 输入复位 + region 无 innerHTML 且有 DOM 正命题）` |
| 3 | T1 | `CSP 纪律 ok（15 个新增元素零内联 style + 初始隐藏由 .ai-modal-overlay 类规则承担）` |
| 4 | T2 | `预览面 ok（六字段渲染 + 两张闭合表 + 显示层净化 + 四条诚实边界恒显）` |
| 5 | T2 | `# tests 116 / # pass 116 / # fail 0`（绝对下限 90，实为 116） |
| 6 | T2 | **红** —— 见「计划门禁缺陷 ①」 |
| 7 | T3 | `样式段 ok（3 条作用域覆盖 + 唯一滚动容器 + 动作区无 flex-wrap + 双主题令牌）` |
| 8 | T3 | `uat 驱动 ok（真实读数 + 动态数据集 + 三处假绿规避）` |
| 9 | T3 | `uat-51-import-modal: 52 passed`（exit 0） |

### 计划门禁缺陷 ①：门禁 6（码表双向覆盖）对任何正确实现恒红

判据用 `/[a-z_]{4,}:/g` 取前端表的键 —— 该字符类**不含数字**，因此 `unsupported_zip64:` 永远匹配不上。表里该键**确实存在**且文案逐字取自 UI-SPEC 的失败映射表：

```
  unsupported_zip64: '压缩包格式不受支持（zip64），请重新打包后重试。',
```

⇒ 门禁报「常量有码但表里没文案: unsupported_zip64」，与实现正确性无关。

**处置（沿本仓 50-01 / 51-03 的先例：计划判据一字未改）**：权威判据按计划**自己指定的落点**（T2 `<action>` 第 5 条）放在 `tests/test-skills-import.js`，用同语义但正确的键正则并带正命题：

```js
const tableKeys = new Set((seg.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm) || [])
  .map((s) => s.trim().replace(/\s*:$/, '')));
// …
assert.ok(tableKeys.size >= 21, `前端表键数异常偏少：${tableKeys.size}`);  // 防「空集真」
```

该判据的**判别力已实测**：删掉表里的 `unsupported_zip64` 项 ⇒ 套件转红并指名
`常量有码但前端表里没文案（缺哪个码在此指名）：unsupported_zip64`（`# fail 1`）。
已登记 `.planning/WINDOWS.md`。

### 计划门禁缺陷 ②：门禁 2 的「文件输入 finally 置空」无判别力

判据是 `indexOf("input.value = ''") === -1 && indexOf("value = ''") === -1`。第二个子串被**无关的** `fileInput.value = ''`（`openSkillImportModal` / `closeSkillImportModal` 的复位）命中 ⇒ 把 change 处理器 `finally` 里的 `input.value = ''` 删掉后，门禁**仍报 ok**（实测）。

**处置**：权威判据同样是计划指定的套件级那一条。实测：删除 finally 置空 ⇒ 门禁二绿、套件转红并给出定长原因
`change 处理器的 finally 必须在清空文件输入（input.value = ''）—— 否则同一文件第二次选不触发`（`# fail 1`）。已登记 `.planning/WINDOWS.md`。

---

## 可失败性变异（9 条走计划门禁转红，各确认后逐字节复原）

| # | 变异 | 目标门禁 | 结果 |
|---|------|---------|------|
| M1 | `#skillImportStatus` 的 `aria-live` polite → assertive | gate1 | **红** `状态行缺 role=status + aria-live=polite` |
| M2 | 给 `#skillImportModal` 真加 `aria-modal="true"` | gate1 | **红** `出现了 aria-modal（本契约明确省略）` |
| M3 | 给 `#skillImportModal` 加内联 `style="display:none"` | gate3 | **红** `#skillImportModal 的标签带内联 style` |
| M4 | region 内 `statusEl.textContent = text` → `.innerHTML` | gate2 | **红** `region 内出现 innerHTML / insertAdjacentHTML` |
| M6 | region 内引入 `localeCompare` | gate4 | **红** `用了 localeCompare` |
| M7 | 删 `.ai-modal-overlay` 的 `display: none` | gate3 | **红** `main.css 缺 .ai-modal-overlay 的 display:none 类规则` |
| M8 | 删 `.skill-import-preview` 的 `min-height: 0` | gate7 | **红** `.skill-import-preview 缺 min-height: 0` |
| M9 | 给 `.skill-import-actions` 加 `flex-wrap: wrap` | gate7 | **红** `.skill-import-actions 声明了 flex-wrap` |
| M10 | 追加第三处 `--skill-error-text` 定义 | gate7 | **红** `--skill-error-text 定义 3 处` |
| M5 | 删 change 处理器 finally 里的 `input.value = ''` | gate2 → **绿（无判别力）**；套件 → **红** | 见缺陷 ② |
| M11 | 删表项 `unsupported_zip64` | gate6 → 已恒红；套件 → **红** | 见缺陷 ① |

11 条变异全部复原，`src/settings-page.js` / `src/settings.html` / `src/styles/main.css` 的 sha256 与变异前**逐字节一致**。

---

## Backstop 判别力（T3 acceptance_criteria 的实测结果）

### 计划指定的两条变异：**都没有转红**（读数逐字未变，如实登记）

| 计划指定的变异 | 实测 | 机理 |
|---------------|------|------|
| 删 `.skill-import-preview` 的 `min-height: 0` | `modal=564.796875 inner=706`、`sh/ch=1587/95`、可滚动容器 `["skillImportPreview"]` —— **全部不变** | ① `.ai-modal` 自带 `max-height: 80vh` 已钳住上界（0.8×706 = 564.8 恰为上界）；② `overflow-y: auto` 的 flex 子项按 Flexbox §4.5 其自动最小尺寸**本就是 0** ⇒ 该声明冗余，删掉无任何几何后果 |
| 给 `.skill-import-actions` 加 `flex-wrap: wrap` | `sw=304 cw=304`、`sameRow=true` —— **全部不变** | 该容器内只有两个约 40px 的按钮（40.5 + 42.5 + gap 8 = 91px ≪ 304px）⇒ 任何测试宽度下都不会触发换行 |

### 改用**能真正探到同一属性**的可满足探针（判别力已证）

| 探针 | 变异 | 实测结果 |
|------|------|---------|
| E2 属性（弹框总高 ≤ 0.8×窗口 / 滚动只在预览区） | 删 `.ai-modal` 的 `max-height: 80vh` | **3 条断言转红**：`modal=2059.5625 inner=706`（超上界）、`scrollTop 0→0`（预览内滚动消失）、可滚动容器 `[]`（零个）⇒ `49/52 passed`，exit 非零 |
| E17 属性（动作区不横向溢出 / 两按钮同排） | 给动作区按钮加 `min-width: 300px` | **转红**：`withinRow=false`（取消按钮 `left=-275.8`，被推到动作区外）⇒ `51/52 passed`，exit 非零 |

**另注（E17 第一条断言的覆盖盲区）**：`actions.scrollWidth <= actions.clientWidth` 对**左侧**溢出无判别力 —— `justify-content: flex-end` 把溢出推向左，`scrollWidth` 只统计右侧（探针下仍为 `304/304`）。真正承重的是 `withinRow` 那条。已登记 `.planning/WINDOWS.md`。

### 基线读数（未变异，`uat-51-import-modal: 52 passed`）

- **E2**：`modal=564.796875 inner=706`（上界 564.8，贴界）；预览 `scrollTop 0→1492`（`sh/ch=1587/95`）而页面级滚动 `0→0`；弹框内恰一个可滚动容器 `["skillImportPreview"]`。
- **E17**：`sw/cw=304/304`；两按钮 `w=40.52 / 42.52`（同排、不重叠、都在动作区内）；禁用原因 `请先勾选「我已了解以上风险」` 可见（`h=18`）且位于按钮排上方（`above=true`）；弹框本体 `336/336`。
- 证据 JSON（仓库内、可重生成）：`tests/.uat-out/uat-51-import-modal.json`（沿用 49/50 既有 uat 驱动同一落点约定）。

---

## 真实渲染驱动覆盖（52 条断言，`_electron` + 全局 playwright）

- **键盘与焦点**：唯一 `tabindex` 是预览容器的 `0`（无正 tabindex / 无 roving）；预览容器在 `.active` 时可获焦；Tab 序 = DOM 序（11 个停靠点、`reordered=0`）；弹框内零可见高度停靠点（`zero=0`）；`ready` 态 `Escape` 关闭、`committing` 态 `Escape` 被忽略；焦点归还 `#skillImportOpen`；`isConnected === false` 时**不调用** `focus()`。
- **禁用态四情形**：未选包 / 必勾未勾 / 冲突未选 / 改名非法各一条断言；「未勾选时真实 `click()` 不提交」—— 实测 `{"calls":[],"modalDisplay":"flex","confirmDisabled":true}`。
- **提交中**：确认与取消**双双** `disabled` + 状态行「正在写入技能，请稍候…」。
- **注入纪律渲染快照**：恶意文件名 `xss<img src=x onerror=alert(1)>.txt` 以**文本**逐字呈现、预览内 `img=0 script=0`。
- **显示层净化**：RTL override（U+202E）被移除且给出**可见**提示 `evilx.txt（含 1 个控制字符，已隐藏）`；C0 对照与干净路径零改动（判别力对照：`hidden` 1 / 1 / 0）。
- **拒绝对策仍用原始字节**：含双向控制符的条目名 ⇒ 整包拒绝（预览不渲染 + danger 状态行），与「净化只在显示层」分离。

---

## 全量套件实测（本计划结束时）

| 套件 | 结果 |
|------|------|
| `test-agent-workspace` | 38/38 |
| `test-builtin-skills-seeder` | 101/101 |
| `test-manage-skill` | 55/55 |
| `test-ai-skills` | 198/198 |
| `test-skills-management` | 49/49 |
| `test-skill-picker-model` | 115/115 |
| `test-skills-http-api` | 41/41 |
| `test-skills-import` | 116/116（51-05 收口时为 110） |
| `test-skills-import-net` | 50/50 |

`counts-parity ok cells=16`（本计划未移动任何账本单元；新套件 `uat-51-import-modal.js` 的账本单元与 `cells 12 → 20` 归 51-07）。

---

## 账本刷新

`.planning/WINDOWS.md` 新增 3 条（`gsd-tools windows append`）：

1. `unrun-verify` —— 门禁 6 键正则不含数字类 ⇒ 恒红（含权威判据的落点与 M11 验证）。
2. `unrun-verify` —— 门禁 2 的置空判据被子串命中 ⇒ 无判别力（含套件级判据的实测转红）。
3. `deviation` —— 计划指定的两条 backstop 变异与断言无因果链（含可满足探针的转红读数 + E17 第一条断言的左侧溢出盲区）。

---

## Deviations from Plan

### 计划门禁缺陷（判据一字未改，权威判据按计划指定落点补位）

见上「计划门禁缺陷 ①②」。两条的共同形态是**判据写对了意图、写错了实现**（字符类缺数字 / 子串被无关文本命中）；处置一律是「不重写计划判据，把可判别的那一份放在计划自己指定的套件落点」。这与 51-03「门禁 5 以 `main.indexOf("route === 'import'")` 取错窗口 ⇒ 恒红」、51-05「剥注释器 `yamlScalar` 的 `/'/g` 无 regex 态支持」同族。

### Backstop 变异点与断言无因果链（实测，未改判据）

见上「Backstop 判别力」。**未**把 `min-height: 0` 从 CSS 里删掉（它虽冗余但无害，且计划门禁七把它列为必需项）；**未**给动作区引入 `flex-wrap`（计划具名禁止）。两条断言的判别力改用可满足探针证明，并按 T3 acceptance_criteria 的要求把结果记进本 SUMMARY。

### 未改动的偏离（如实记录）

- **`tests/.uat-out/` 不入库**：沿用 49/50 既有 uat 驱动的落点约定（仓库内路径、可重生成、`git ls-files` 中从无该类产物）。未新增 `.gitignore` 条目（那会是与本计划无关的改动）。
- **子代理中断**：Task 1/2 由子代理完成，Task 3 由编排层接管。接管前的残留已逐项核验（`main.css` 的 +226 行、驱动的 1065 行、`.uat-out` 的产物 JSON 的 mtime 均晚于 Task 2 的提交），续做而非重做。

---

## 已知盲区 / 诚实边界

1. **`TD-48-01`（`escapeHtml` 只转义 `& < >` 不转义引号）仍开未修** —— 本计划的责任是**不扩大缺口**（region 内零 HTML 字符串模板、全部 DOM API 赋值），**未**修复它，也不在任何交付物里声称已修。
2. **`#skillImportGate` 的禁用原因变化不在 live region 内** —— AT 用户不会自动听到禁用原因变化（UI-SPEC 已登记的已知边界，须由 51-07 如实写入文档）。
3. **E17 的第一条断言（`scrollWidth <= clientWidth`）对左侧溢出无判别力** —— 承重的是 `withinRow` 那条（见上）。
4. **两条 backstop 的读数依赖窗口尺寸** —— 驱动在窄窗口（`innerW=360` / `innerH=706`）下取数；更宽的窗口下 `.skill-import-actions` 的溢出结论可能不同（该断言是**上界/同排**类，宽窗口下更易通过）。
5. **真实 GitHub 端到端成功路径与 32 MiB 上传的真实耗时/内存峰值不在本计划** —— 属 `51-VALIDATION.md` 的 Manual-Only 表（本计划只覆盖 UI 侧渲染与布局读数）。

---

## Threat Flags

| 威胁 ID | 处置状态 |
|---------|---------|
| T-51-39（预览渲染不可信字符串 ⇒ XSS） | **缓解已落地**：region 内零 `innerHTML` / `insertAdjacentHTML`；负命题 + 正命题双判据；渲染快照断言 `img=0 script=0` 且原串以文本逐字呈现 |
| T-51-40（RTL override / 控制字符视觉欺骗） | **缓解已落地**：显示前净化 + 可见提示；拒绝对策仍用原始字节（渲染快照实测整包拒绝） |
| T-51-41（弹框内失败被写到被遮罩挡住的 hint ⇒ 静默失败） | **缓解已落地**：失败落点两分（弹框内 `#skillImportStatus` / 关闭后 E18），计划 `prohibitions` 具名登记 |
| T-51-42（`aria-disabled` 假装禁用） | **缓解已落地**：一律原生 `disabled`；门禁断言 region 内不出现 `aria-disabled`；驱动实测未勾选时真实 `click()` 不提交 |
| T-51-43（禁用原因不可见） | **缓解已落地**：`#skillImportGate` 承载原因；驱动逐情形断言文本非空且 `height > 0` |
| T-51-44（前端复刻改名校验 ⇒ 漂移） | **缓解已落地**：套件断言「不出现校验器正则 / `maxlength` / 字数计数」 |
| T-51-45（诚实边界被降级为 tooltip / 折叠） | **缓解已落地**：四条恒显文本各有源码判据 |
| T-51-46（CSP 下内联 style 被拦 ⇒ 元素常驻可见） | **缓解已落地**：门禁三逐元素判 `style=`（剥注释面）+ `.ai-modal-overlay` 类规则 |
| T-51-SC（依赖安装） | **无安装动作**；驱动依赖**全局** `playwright`（既有做法），未新增 `dependencies` 条目 |

---

## Next Phase Readiness

- **51-07 可直接开工**：UI-SPEC 的 40 条文案已逐条落到代码；`docs/product/ai-skills.md` 新增 §十三【导入】时口径已定；`AGENTS.md` 的导入维护约定与测试清单须补 1 个新驱动（`tests/uat-51-import-modal.js`，需 `NODE_PATH="$(npm root -g)"`）与 1 个被改动的套件（`test-skills-import.js` 110 → 116）；counts-parity 的 `cells` 12 → 20。
- **51-07 须如实写入的两条**：`#skillImportGate` 的禁用原因不在 live region 内；`quota` / `diagnostics` 未上屏（`main.js` 只回 `{error, code}`）。

---

## Self-Check

- [x] 三条任务全部执行并各自独立提交（`da183f0` / `10dcb51` / `fc8c135`）
- [x] 计划自带 9 条 `<automated>` 在当前树逐条实跑（8 绿 + 1 条为计划门禁缺陷，已由计划指定的套件级判据接替并验证判别力）
- [x] 9 条可通过计划门禁判别的变异各确认转红后逐字节复原；另 2 条改用计划指定的套件级判据验证
- [x] 两条 backstop 的判别力用可满足探针证明（计划指定的两条变异实测无效，已如实登记 + 进台账）
- [x] 真实 `_electron` uat 驱动实跑通过（`52 passed`），证据固化进仓库内路径
- [x] SUMMARY 写入 `.planning/phases/51-zip/51-06-SUMMARY.md`
- [x] 未修改 STATE.md / ROADMAP.md（编排层所有）

**Self-Check: PASSED**

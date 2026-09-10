---
status: fixed
trigger: "G-27-1a: 按钮在面板打开时没有 active 样式；G-27-1b: 面板打开后，点击网页其他地方没有关闭，只有点击按钮或者关闭才可以关闭"
created: 2026-08-06T00:00:00Z
updated: 2026-08-06T00:00:00Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: fixed
---

## Current Focus

hypothesis: both gaps root-caused with direct file:line evidence
bug_class: Bohrbug (both deterministic, code/structure defects)
next_action: return ROOT CAUSE FOUND to team-lead (mode: find_root_cause_only)

## Symptoms

expected: (G-27-1a) 工具栏媒体按钮在面板打开时显示 active 样式；(G-27-1b) 点击面板外部自动关闭面板
actual: (G-27-1a) 按钮在面板打开时没有 active 样式；(G-27-1b) 面板打开后点击网页其他地方不关闭，只有点击按钮或关闭按钮才可关闭
errors: none (no console errors reported)
reproduction: 打开媒体面板 → 观察按钮无高亮；点击网页区域 → 面板不关闭
started: Phase 27 新增媒体面板后即存在（UAT 发现）

## Eliminated

- hypothesis: JS 未切换 active class（G-27-1a）
  evidence: renderer.js:5119 `elements.mediaPanelBtn.classList.toggle('active', state.mediaPanelOpen)` 存在且与 hidden 切换同函数同路径，面板能正常开合说明该函数确实执行
  timestamp: 2026-08-06
- hypothesis: 缺少 document 级 outside-click 监听器（G-27-1b）
  evidence: renderer.js:3785-3791 监听器存在且逻辑正确（state 检查 + contains 排除面板和按钮）
  timestamp: 2026-08-06
- hypothesis: stopPropagation 拦截冒泡（G-27-1b）
  evidence: 点击目标是 webview 内部网页内容，事件根本不经过宿主 document 冒泡链，与 stopPropagation 无关
  timestamp: 2026-08-06

## Evidence

- timestamp: 2026-08-06
  checked: src/renderer.js toggleMediaPanel (5114-5125)
  found: 打开面板时同时 toggle hidden 和 active class，JS 侧逻辑完整
  implication: G-27-1a 不在 JS，转向 CSS
- timestamp: 2026-08-06
  checked: src/styles/main.css 全部含 `.active` 的规则 + `mediaPanelBtn|media-panel-btn` 全文件搜索
  found: `.media-panel-btn` 唯一规则在 main.css:5932，仅 `position: relative`；无任何 `.media-panel-btn.active` / `#mediaPanelBtn.active` / `.btn-icon.active` 规则。对照组 `#aiPanelBtn.active`（main.css:4766-4769，color + background-color）存在——AI 按钮有激活态样式，媒体按钮漏写了
  implication: G-27-1a 根因 = CSS 激活态规则缺失，class 切换了但无视觉效果
- timestamp: 2026-08-06
  checked: 网页内容宿主形态
  found: renderer.js:761 `document.createElement('webview')`——网页跑在 webview guest 进程；index.html:265 `#browserView` 容器
  implication: webview 内点击事件在 guest renderer 派发，永远不会冒泡到宿主 document
- timestamp: 2026-08-06
  checked: renderer.js:3785-3791 outside-click 关闭逻辑
  found: 监听器挂在宿主 `document` 上，只能收到宿主 chrome（工具栏/标签栏/侧边栏）的点击；面板占网页区域之上，用户点「网页其他地方」= 点 webview，事件不跨进程边界
  implication: G-27-1b 根因 = 监听目标不可达；「点按钮/关闭按钮可关」正好符合——那是宿主内点击（按钮自身 toggle handler 关闭）
- timestamp: 2026-08-06
  checked: 同文件其他 outside-click 模式（context picker 3856、modal backdrop 3734）
  found: 同样挂 document——但这些面板交互场景不涉及「必须点网页关闭」，所以未暴露；媒体面板是唯一浮动在浏览区上方面板（z-index 9998, position: fixed）
  implication: 修复需针对 webview 焦点/点击跨边界问题，不能照搬现有 document 监听

## Resolution

root_cause: "G-27-1a: main.css 缺少媒体按钮 active 态样式规则——renderer.js:5119 正确切换 `active` class，但全文件唯一 `.media-panel-btn` 规则（main.css:5932）只有 `position: relative`，无 `.active` 变体（对照 `#aiPanelBtn.active` main.css:4766 存在）；G-27-1b: outside-click 监听器（renderer.js:3785）挂在宿主 document 上，而网页内容在 `<webview>` guest 进程（renderer.js:761），webview 内点击事件不跨进程冒泡到宿主 document，监听永远收不到网页区域的点击"
fix: (留待 plan-phase --gaps 制定)
verification: (未修复，diagnose-only)
files_changed: []

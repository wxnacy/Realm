---
status: fixed
trigger: "固定标签页后样式不正确：标题消失，只显示底部一个小点，应显示网站图标（favicon）"
created: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:10:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: 【已确认】favicon 功能从未实现 —— CSS 按"有 .tab-favicon 元素"设计（隐藏标题），但三处 Tab DOM 创建点均不创建该元素，也无 page-favicon-updated 事件监听，固定后 40px 宽度内只剩 ::after 底部小点
test: 已完成全部代码追踪（详见 Evidence）
expecting: N/A — 诊断完成
next_action: 返回 ROOT CAUSE FOUND 结构化诊断（find_root_cause_only 模式，不修复）

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Tab 固定后移到 Tab 栏最左侧，以 favicon 形式显示（类似 Chrome 固定标签），有 .tab-pinned class 及对应 CSS 样式
actual: 用户报告"固定后样式不好看，标题没有了，只有底部一个小点，应该显示下网站图标"（截图确认：固定 Tab 变成一个底部带小点的空块）
errors: None reported
reproduction: Test 6 in Phase 13 UAT：任意 Tab 右键 → 固定标签页，观察样式
started: Phase 13 UAT（2026-07-28）发现；13-02-SUMMARY Known Stubs 自述 "CSS for .tab-pinned class needs to be added in a future CSS change"

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: .tab-pinned CSS 完全缺失（13-02 Known Stubs 自述的原始状态）
  evidence: main.css L1119-1143 存在完整 .tab-pinned 规则，由 commit 186429b (2026-07-27 16:43 UTC) 添加，早于 UAT (2026-07-28 00:00 UTC) —— UAT 是在有 CSS 的状态下测试的，小点正是 ::after 伪元素的产物
  timestamp: 2026-07-29T00:05:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-29T00:00:00Z
  checked: .planning/phases/13-右键菜单增强/13-UAT.md Test 6
  found: 固定标签页功能本身 pass（移到最左侧 + .tab-pinned class），但样式 issue：标题消失，只有底部小点
  implication: pin 功能逻辑正常，问题在视觉呈现层（CSS/DOM）

- timestamp: 2026-07-29T00:00:00Z
  checked: .planning/phases/13-右键菜单增强/13-UI-SPEC.md
  found: UI-SPEC 只覆盖右键菜单本身（native menu），未定义固定 Tab 的视觉样式契约
  implication: 固定 Tab 样式没有设计契约，属于 Phase 13 计划外的 CSS 工作

- timestamp: 2026-07-29T00:02:00Z
  checked: src/styles/main.css L1119-1143（.tab-pinned 规则）
  found: `.tab-pinned` 宽 40px；`.tab-pinned .tab-title { display: none; }` 隐藏标题；`.tab-pinned .tab-favicon { margin-right: 0; }` 预留 favicon 样式；`.tab-pinned::after` 生成 4px 底部圆点（bottom: 2px, 居中）
  implication: "底部小点"= ::after 伪元素；"标题消失"= display:none。CSS 设计前提是 DOM 中存在 .tab-favicon 元素

- timestamp: 2026-07-29T00:03:00Z
  checked: 全代码库 grep `tab-favicon` / `page-favicon-updated`
  found: `.tab-favicon` 仅出现在 CSS L1128 一处；`page-favicon-updated` 仅命中 node_modules/electron/electron.d.ts —— 无任何 JS 创建该元素、无任何代码监听 favicon 事件
  implication: favicon 元素在 DOM 中从不存在，favicon 数据从未被获取

- timestamp: 2026-07-29T00:04:00Z
  checked: src/renderer.js 三处 Tab DOM 创建点：createTab() L380-407、restoreTabs() L1090-1117、renderTabs() 重建分支 L1324-1351
  found: 三处结构完全一致：colorLine + content(仅 tab-title span) + closeBtn。均无 favicon img 元素
  implication: 无论新建、重启恢复、还是重排重建，Tab 都不可能有图标

- timestamp: 2026-07-29T00:05:00Z
  checked: createWebviewForTab() webview 事件监听（L742-799）
  found: 有 `page-title-updated` 监听（L753，经 updateTabTitle 更新 .tab-title），无 `page-favicon-updated` 监听；tab state 对象不维护 faviconUrl 字段（faviconUrl 仅存在于 favorites/history DB 层，与 Tab 无关）
  implication: 标题有完整数据流（事件→state→DOM），favicon 数据流完全缺失

- timestamp: 2026-07-29T00:06:00Z
  checked: git log -L 1119,1143:src/styles/main.css
  found: commit 186429b "fix(13): add pinned tab CSS styles"，2026-07-28 00:43:23 +0800 = 2026-07-27 16:43 UTC，早于 UAT（2026-07-28T00:00Z）
  implication: UAT 时 CSS 已就位，用户看到的就是当前代码的确定性行为，非环境问题

- timestamp: 2026-07-29T00:07:00Z
  checked: .planning/phases/13-右键菜单增强/13-02-SUMMARY.md Known Stubs
  found: 原文 "CSS for `.tab-pinned` class needs to be added in a future CSS change... but the JS logic is complete" —— 只把 CSS 列为延后，"获取并显示 favicon" 本身从未进入任何 plan（13-CONTEXT/UI-SPEC 均无固定 Tab 视觉契约）
  implication: 这是功能缺失（never implemented），不是功能损坏（regression）

- timestamp: 2026-07-29T00:08:00Z
  checked: .tab-close / .tab-content CSS（L1152-1198）
  found: `.tab-close` 绝对定位 right:4px，hover 时 opacity:1 —— 固定 Tab 仅 40px 宽，hover 时 16px 关闭按钮会遮挡 favicon 位置（Chrome 固定 Tab 无关闭按钮）
  implication: 修复时需一并考虑 `.tab-pinned .tab-close` 的显示策略

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: favicon 功能从未实现。commit 186429b 补的 .tab-pinned CSS 按"DOM 中存在 .tab-favicon 元素"设计（隐藏标题 display:none、预留 .tab-pinned .tab-favicon 规则），但 renderer.js 三处 Tab DOM 创建点（createTab L380-407、restoreTabs L1090-1117、renderTabs 重建分支 L1324-1351）都只创建 colorLine/title/closeBtn，从不创建 favicon 元素；且 createWebviewForTab 无 page-favicon-updated 事件监听，tab state 无 faviconUrl 字段。结果：固定后标题被隐藏、40px 宽度内无任何内容，唯一可见元素是 .tab-pinned::after 的 4px 底部圆点 —— 即用户看到的"底部一个小点的空块"。属功能缺失（13-02 Known Stubs 仅延后 CSS，favicon 数据流从未进入任何 plan），非 regression。
fix: （诊断模式，不修复）方向：1) createWebviewForTab 加 page-favicon-updated 监听（参照 L753 page-title-updated 模式），tab.faviconUrl = e.favicons[0] 并更新 img.src；2) 三处 DOM 创建点统一创建 <img class="tab-favicon">（建议抽公共创建函数，三处目前是复制粘贴）；3) 补基础 .tab-favicon CSS（16px、flex-shrink:0），.tab-pinned 下 .tab-content 居中；4) 确认主进程 Tab 持久化（updateTab/getTabs）透传 faviconUrl 以便重启恢复；5) 处理 .tab-pinned .tab-close hover 遮挡问题
verification: （未修复，待后续任务验证）
files_changed: []

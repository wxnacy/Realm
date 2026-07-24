---
phase: 02-browser-core-url-navigation-multi-tab
plan: 05
subsystem: ui
tags: [electron, webview, css, tab-navigation, uat-gap-closure]

# Dependency graph
requires:
  - phase: 02-browser-core-url-navigation-multi-tab
    provides: Tab 管理、URL 导航、webview 加载链路（02-01 ~ 02-04）
provides:
  - 加载进度条锚定到工具栏底部边缘（UAT Test 8b 修复）
  - 刷新按钮加载态 × 图标切换与点击中断（UAT Test 8a 修复）
  - 冷启动/空 Tab 栏时 URL 回车惰性创建 Tab（UAT Test 13 修复）
affects: [03-data-isolation-cookie-persistence, uat-retest]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "绝对定位装饰元素需显式定位祖先：.toolbar position:relative 作为 .loading-bar 包含块"
    - "加载态图标切换：双 SVG + CSS class 驱动，JS 只负责切换 loading class"

key-files:
  created: []
  modified:
    - src/styles/main.css
    - src/index.html
    - src/renderer.js

key-decisions:
  - "空 Tab 栏采用惰性创建（URL 回车时 createTab）而非 eager 启动建 Tab——同时覆盖冷启动与关闭最后 Tab 两个入口，不破坏 Test 1/2 空 Tab 栏+新标签页预期"
  - "URL Enter else 分支与 newTabSearch 均只传 normalizeUrl 处理后的值，原始输入不直达 webview.src（威胁 T-02-05-01 缓解）"

patterns-established:
  - "导航入口统一经 normalizeUrl：任何用户输入进入 webview.src / loadURL 前必须先规范化"

requirements-completed: [BROW-01, BROW-02]

# Coverage metadata — 三个交付物均为运行时视觉/交互行为，自动校验只断言代码结构，需人工 UAT 复测
coverage:
  - id: D1
    description: "2px 蓝色加载进度条显示在 URL 输入框下方（工具栏底部边缘），加载完成后自动消失（UAT Test 8b）"
    requirement: BROW-02
    verification:
      - kind: other
        ref: "command: awk 提取 .toolbar 规则并 grep 'position: relative'（PASS）"
        status: pass
    human_judgment: true
    rationale: "grep 仅断言 CSS 声明存在；进度条实际渲染位置需运行应用按 UAT Test 8 步骤人工复测确认"
  - id: D2
    description: "页面加载中刷新按钮切换为停止（×）图标，点击可中断加载，完成后恢复刷新图标（UAT Test 8a）"
    requirement: BROW-02
    verification:
      - kind: other
        ref: "command: grep icon-reload/icon-stop SVG（index.html）+ #reloadBtn.loading 切换规则（main.css）（PASS）"
        status: pass
    human_judgment: true
    rationale: "图标切换与点击中断为运行时视觉/交互行为，需人工按 UAT Test 8 复测（含加载中点击 × 验证 webview.stop()）"
  - id: D3
    description: "冷启动无活动 Tab 时 URL 输入框回车，默认容器自动创建 Tab 并加载目标页面，新标签页消失，URL 框更新（UAT Test 13）"
    requirement: BROW-01
    verification:
      - kind: other
        ref: "command: node --check src/renderer.js + grep else 分支 createTab(state.currentContainer, normalizedUrl)（PASS）"
        status: pass
    human_judgment: true
    rationale: "冷启动全链路（建 Tab、webview 加载、新标签页消失、URL 框更新）需完全退出应用后人工按 UAT Test 13 复测"

# Metrics
duration: 5 min
completed: 2026-07-24
status: complete
---

# Phase 02 Plan 05: UAT Gap 关闭（进度条定位 / 刷新按钮 × 图标 / 冷启动 URL 回车） Summary

**一行 CSS 包含块修复进度条定位（.toolbar position:relative）+ #reloadBtn 双 SVG 与 loading 态 CSS 切换规则补齐视觉层 + URL Enter 处理器 else 分支惰性 createTab 修复冷启动静默失败**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-24T06:05:25Z
- **Completed:** 2026-07-24T06:10:19Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `.toolbar` 增加 `position: relative`，`.loading-bar`（position:absolute; bottom:0）包含块从 viewport 改为工具栏，2px 蓝色进度条锚定到 URL 输入框正下方（UAT Test 8b）
- `#reloadBtn` 内补 `icon-stop`（×）SVG（与 Tab 关闭按钮同几何 M18 6L6 18M6 6l12 12），原刷新 SVG 标记 `icon-reload`；新增三条 CSS 规则实现 loading 态图标切换，JS 层零改动（UAT Test 8a）
- URL Enter 处理器 `if (state.activeTabId)` 守卫增加 else 分支：`await createTab(state.currentContainer, normalizedUrl)`，冷启动空 Tab 栏与关闭最后 Tab 后 URL 回车均可用默认容器惰性建 Tab 并加载目标页面（UAT Test 13）
- 附带修复新标签页搜索框同类隐患：`createTab(state.currentContainer, value)` 改为传 `normalizeUrl(value)`，消除缺 scheme 风险

## Task Commits

Each task was committed atomically:

1. **Task 1: .toolbar 添加 position: relative 修复进度条定位** - `668a46b` (fix)
2. **Task 2: #reloadBtn 增加 × 图标 SVG + loading 态 CSS 切换规则** - `0fb7c3f` (feat)
3. **Task 3: URL Enter 处理器增加无活动 Tab 的惰性创建分支** - `b7c9f24` (fix)

**Plan metadata:** 见最终 docs 提交（本文件与 STATE/ROADMAP/REQUIREMENTS 更新）

## Files Created/Modified

- `src/styles/main.css` - `.toolbar` 增加 `position: relative`（Task 1）；新增 `#reloadBtn .icon-stop` / `#reloadBtn.loading .icon-reload` / `#reloadBtn.loading .icon-stop` 三条图标切换规则（Task 2）
- `src/index.html` - `#reloadBtn` 内刷新 SVG 加 `class="icon-reload"`，新增 `class="icon-stop"` × 图标 SVG（Task 2）
- `src/renderer.js` - URL Enter 处理器守卫块加 else 分支调 `createTab(state.currentContainer, normalizedUrl)`；newTabSearch 改传 `normalizeUrl(value)`（Task 3）

## Decisions Made

- 空 Tab 栏修复采用惰性创建路径（回车时建 Tab）而非 eager（启动时预建 Tab）：空 Tab 栏有两个入口（冷启动 restoreTabs 提前 return、关闭最后 Tab 置 null），eager 只覆盖冷启动且会破坏 Test 1/2 的空 Tab 栏+新标签页预期——沿用 debug session 已排除 eager 的结论
- else 分支传 `state.currentContainer` 而非硬编码 `'default'`：冷启动时它经 loadContainers → getCurrentContainer → windowContainerMap 必然解析为 'default'，与 tabNewBtn / newTabSearch 既有行为一致
- else 分支内不手动隐藏 newTabPage、不手动调 showWebview：createTab → createWebviewForTab → switchTab 全链路已覆盖（置 activeTabId、更新 URL 框、翻转 webview 可见性、隐藏新标签页），重复操作会与 switchTab 冲突

## Deviations from Plan

None - plan executed exactly as written.

（Task 3 行动内已包含计划明示的附带修复：newTabSearch 传 normalizeUrl(value)，属计划第 117 行明确规定的内容，非计划外偏差。）

## Issues Encountered

- Task 3 首次提交前验证失败：初版 else 分支写了 3 行注释，把 `await createTab(...)` 推到计划给定校验命令 `grep -A 3 '} else {'` 的 3 行窗口之外。将注释压缩为 2 行使调用落入窗口内，验证通过。纯注释排版调整，无行为变化。

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 三个 UAT gap 的代码修复均已落地并通过全部自动化校验；待用户按 UAT Test 8（加载中 × 图标+可中断、进度条位置）与 Test 13（冷启动 URL 回车）步骤人工复测确认
- 复测时需同步确认 Test 5/6/10/11 无回归（本计划未改动有活动 Tab 的导航、多 Tab 切换、关闭 Tab 代码路径）
- Phase 02 全部 5 个 plan 执行完毕，可进入 Phase 03（data-isolation-cookie-persistence）

## Self-Check: PASSED

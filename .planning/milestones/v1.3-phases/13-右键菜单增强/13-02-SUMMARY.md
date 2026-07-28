---
phase: 13
plan: 02
subsystem: context-menu
tags: [context-menu, renderer, ipc, preload, tab-management, pinned-tabs]
dependency_graph:
  requires: [context-menu-manager.js, buildTabMenu, buildWebMenu]
  provides: [showTabContextMenu, showWebContextMenu, onContextMenuAction, notifyClosedTab, closedTabsStack, renderTabs, handleContextMenuAction]
  affects: [src/preload.js, src/renderer.js]
tech_stack:
  added: []
  patterns: [ipcRenderer.send, ipcRenderer.on, contextmenu DOM event, webview context-menu event, document.execCommand whitelist]
key_files:
  created: []
  modified:
    - src/preload.js
    - src/renderer.js
decisions:
  - "T-13-04 安全缓解：open-in-new-tab/open-in-bg-tab/open-in-container 前校验 URL 协议（仅允许 http/https/realm）"
  - "T-13-05 安全缓解：text-action 硬编码白名单仅允许 cut/copy/paste/selectAll 四个操作"
  - "closedTabsStack 渲染进程和主进程双维护（notifyClosedTab 同步）"
  - "renderTabs 固定标签排在最左侧，通过 .tab-pinned CSS class 控制样式"
  - "open-in-bg-tab 实现方式：创建后记住原 activeTabId，创建完成后切回"
metrics:
  duration: 21s
  completed: "2026-07-27T16:42:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
status: complete
---

# Phase 13 Plan 02: 右键菜单渲染进程集成 Summary

完成右键菜单系统的渲染进程集成：preload.js 暴露菜单相关 API，renderer.js 添加 Tab 栏右键监听、webview context-menu 事件监听、菜单动作回调处理、已关闭标签栈管理、固定标签页 UI 更新。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | 修改 src/preload.js -- 暴露右键菜单 API | 75154bd | src/preload.js |
| 2 | 修改 src/renderer.js -- 右键事件监听 + 菜单回调 + 固定标签 + 已关闭栈 | 2e73654 | src/renderer.js |

## What Was Built

### src/preload.js (修改)

新增 4 个右键菜单相关 API 方法：

- **showTabContextMenu(tabInfo)** -- 发送 Tab 栏右键菜单请求（ipcRenderer.send），tabInfo 包含 tabId/tabCount/tabIndex/isPinned/hasClosedTabs
- **showWebContextMenu(contextInfo)** -- 发送网页右键菜单请求（ipcRenderer.send），contextInfo 包含 type/linkURL/srcURL/mediaType/selectionText/canGoBack/canGoForward/isLoading
- **onContextMenuAction(callback)** -- 为 16 个 context-menu:* channel 注册 ipcRenderer.on 监听器，统一回调 callback(channel, data)
- **notifyClosedTab(tabInfo)** -- 通知主进程已关闭一个标签（用于主进程侧 closedTabsStack 同步）

### src/renderer.js (修改)

**A. 已关闭标签栈 (closedTabsStack)**
- 新增模块级 `closedTabsStack = []`（LIFO，最多 10 条）
- `closeTab()` 关闭前将 `{ containerId, url, title }` push 到栈中
- 新增 `closedTabsStackPush(tab)` 辅助函数，同时调用 `notifyClosedTab` 通知主进程

**B. Tab 栏右键监听**
- `elements.tabList` 新增 `contextmenu` 事件委托
- `event.preventDefault()` 阻止默认菜单
- 向上查找最近的 `.tab` 元素提取 tabId
- 收集上下文信息后调用 `showTabContextMenu`

**C. webview context-menu 事件监听**
- `bindWebviewEvents()` 中为每个 webview 添加 `context-menu` 事件
- 从 `e.params || e.detail` 提取参数（兼容 Electron 版本差异）
- 根据 `mediaType` 和 `linkURL` 判断类型（image/link/general）
- 调用 `showWebContextMenu` 发送到主进程

**D. 菜单动作回调处理**
- 新增 `handleContextMenuAction(channel, data)` 统一分发函数
- 处理全部 16 个 channel：close-tab、close-other/left/right-tabs、reopen-tab、toggle-pin、open-in-new/bg/container-tab、save-image、copy-image/image-address、copy-link-address、add-to-favorites、toast、text-action
- `reopen-tab`: 从 closedTabsStack pop 并 createTab
- `toggle-pin`: 切换 tab.pinned 状态，调用 renderTabs() 重排
- `text-action`: 使用 webview.executeJavaScript 执行 document.execCommand
- `add-to-favorites`: 复用现有 favoritesAdd API

**E. 固定标签页 UI 渲染**
- 新增 `renderTabs()` 函数：将 tabs 分为 pinned/unpinned 两组，pinned 在前
- 固定标签 DOM 添加 `.tab-pinned` CSS class（待 CSS 添加对应样式）
- `toggle-pin` 回调后调用 `renderTabs()` 重排整个 Tab 栏

**F. 安全缓解**
- T-13-04: `open-in-new-tab`/`open-in-bg-tab`/`open-in-container` 前校验 URL 协议，仅允许 http/https/realm
- T-13-05: `text-action` 硬编码白名单（cut/copy/paste/selectAll），非白名单操作拒绝执行

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all implementations are functional. CSS for `.tab-pinned` class needs to be added in a future CSS change (Phase 13 CSS work or separate styling task), but the JS logic is complete.

## Verification Results

- src/preload.js contains showTabContextMenu: PASS
- src/preload.js contains showWebContextMenu: PASS
- src/preload.js contains onContextMenuAction: PASS
- src/preload.js contains notifyClosedTab: PASS
- src/renderer.js contains closedTabsStack: PASS
- src/renderer.js contains showTabContextMenu usage: PASS
- src/renderer.js contains context-menu event handling: PASS
- src/renderer.js contains onContextMenuAction usage: PASS
- src/renderer.js contains toggle-pin handling: PASS

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-13-04 mitigated | src/renderer.js | URL protocol validation on open-in-*-tab actions (only http/https/realm allowed) |
| threat_flag: T-13-05 mitigated | src/renderer.js | text-action whitelist enforcement (only cut/copy/paste/selectAll) |

## Self-Check: PASSED

- FOUND: src/preload.js
- FOUND: src/renderer.js
- FOUND: commit 75154bd (Task 1)
- FOUND: commit 2e73654 (Task 2)

---
phase: 34-multi-window
plan: 01
subsystem: infra
tags: [electron, multi-window, ipc, shortcuts, window-manager]

# Dependency graph
requires: []
provides:
  - window-manager.js Map + Set dual registry with isManagedWindow() and broadcast()
  - shortcut-manager.js focus-window dispatch with newWindow/closeWindow shortcuts
affects: [34-02, 34-03, ipc-handlers.js, main.js]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "窗口注册表模式: windows Map + managedWindowIds Set 双重注册"
    - "焦点窗口派发: BrowserWindow.getFocusedWindow() 替代 currentWindow 单例"
    - "广播模式: broadcast() 替代 mainWindow.webContents.send()"

key-files:
  created: []
  modified:
    - window-manager.js
    - shortcut-manager.js

key-decisions:
  - "D-10: windowManager 从单例 mainWindowRef 改为 Map<windowId, BrowserWindow> + Set<windowId>"
  - "D-12: shortcut-manager 快捷键派发到焦点窗口 BrowserWindow.getFocusedWindow()"
  - "保留函数签名兼容：registerShortcuts/rebuildShortcuts 改为无参但不破坏现有调用方"

patterns-established:
  - "窗口注册表: windows Map + managedWindowIds Set + windowContainerMap 三结构同步维护"
  - "焦点窗口派发: getFocusedWindow() + isManagedWindow() 校验 + 播放器 D-13 特殊处理"
  - "广播替代单发: broadcast() 遍历 windows Map 向所有未销毁窗口发送 IPC"

requirements-completed: [MW-08, MW-10]

coverage:
  - id: D1
    description: "window-manager.js 重构为 Map + Set 双重注册，新增 isManagedWindow 和 broadcast"
    requirement: "MW-10"
    verification:
      - kind: other
        ref: "grep -c managedWindowIds window-manager.js && grep -c isManagedWindow window-manager.js && grep -c broadcast window-manager.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "shortcut-manager.js 新增 newWindow/closeWindow 快捷键，派发改为焦点窗口动态路由"
    requirement: "MW-08"
    verification:
      - kind: other
        ref: "grep -c newWindow shortcut-manager.js && grep -c closeWindow shortcut-manager.js && grep -c getFocusedWindow shortcut-manager.js"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-14
status: complete
---

# Phase 34 Plan 01: 窗口管理基础 Summary

**window-manager.js 从单例 mainWindowRef 重构为 Map + Set 双重注册表，shortcut-manager.js 快捷键派发改为 BrowserWindow.getFocusedWindow() 动态路由，新增 Cmd+N/Cmd+Shift+W 快捷键**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-14T14:39:45Z
- **Completed:** 2026-08-14T14:43:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- window-manager.js 从单例 mainWindowRef 重构为 windows Map + managedWindowIds Set 双重注册，新增 isManagedWindow() 和 broadcast() 两个 API
- shortcut-manager.js 快捷键派发从固定 currentWindow 改为 BrowserWindow.getFocusedWindow() 动态路由
- 新增 newWindow (Cmd+N) 和 closeWindow (Cmd+Shift+W) 两个默认快捷键
- 播放器窗口的 closeTab 特殊处理 (D-13) 保持不变

## Task Commits

Each task was committed atomically:

1. **Task 1: 重构 window-manager.js** - `4e49ff5` (refactor)
2. **Task 2: 扩展 shortcut-manager.js** - `10cf618` (refactor)

## Files Created/Modified

- `window-manager.js` - 窗口注册表重构：windows Map + managedWindowIds Set + isManagedWindow() + broadcast()
- `shortcut-manager.js` - 快捷键焦点窗口派发：getFocusedWindow() + isManagedWindow 校验 + newWindow/closeWindow

## Decisions Made

- D-10: windowManager 从单例 mainWindowRef 改为 Map + Set 双重注册，保留 windowContainerMap 不变
- D-12: 快捷键派发改为 BrowserWindow.getFocusedWindow() 动态获取焦点窗口
- 函数签名兼容: registerShortcuts/rebuildShortcuts 改为无参，JavaScript 忽略多余参数，不破坏现有 main.js/ipc-handlers.js 调用方

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (IPC 信任模型): isManagedWindow() 已就绪，可直接用于 assertTrustedSender 泛化
- Plan 03 (Dock 菜单 + main.js): broadcast() 已就绪，registerShortcuts/rebuildShortcuts 无参兼容

## Self-Check

- [x] window-manager.js 包含 `const windows = new Map();`
- [x] window-manager.js 包含 `const managedWindowIds = new Set();`
- [x] window-manager.js 包含 `function isManagedWindow(winId)`
- [x] window-manager.js 包含 `function broadcast(channel, ...args)`
- [x] window-manager.js 不再包含 `let mainWindowRef`
- [x] window-manager.js 的 module.exports 包含 isManagedWindow 和 broadcast
- [x] shortcut-manager.js DEFAULT_SHORTCUTS 包含 newWindow 和 closeWindow
- [x] shortcut-manager.js attachInputListener 使用 getFocusedWindow()
- [x] shortcut-manager.js attachInputListener 使用 isManagedWindow 校验
- [x] shortcut-manager.js registerShortcuts 无参数
- [x] shortcut-manager.js rebuildShortcuts 无参数
- [x] shortcut-manager.js 中不再有 `let currentWindow` 变量声明

## Self-Check: PASSED

---
*Phase: 34-multi-window*
*Completed: 2026-08-14*

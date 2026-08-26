---
phase: 34-multi-window
plan: 02
subsystem: infra
tags: [electron, ipc, trust-model, multi-window, security]

# Dependency graph
requires:
  - phase: 34-multi-window
    provides: "window-manager.js isManagedWindow() API (Plan 01)"
  - phase: 34-multi-window
    provides: "shortcut-manager.js rebuildShortcuts() 无参签名 (Plan 01)"
provides:
  - "ipc-handlers.js assertTrustedSender 泛化为 managedWindowIds 集合校验"
  - "ipc-handlers.js shortcut:set/reset handler 适配无参 rebuildShortcuts"
  - "ipc-handlers.js registerHandlers 防重复注册守卫"
affects: [34-03, main.js]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IPC 信任校验泛化: assertTrustedSender 使用 windowManager.isManagedWindow(win.id) 替代硬编码主窗口比较"
    - "防重复注册守卫: handlersRegistered 模块级变量防止多窗口场景下 registerHandlers 多次调用"

key-files:
  created: []
  modified:
    - ipc-handlers.js

key-decisions:
  - "D-11: assertTrustedSender 从 mainWindow.id 硬编码比较改为 managedWindowIds 集合校验"
  - "assertPlayerSender 保持不变（D-13 播放器窗口全局单例）"
  - "registerHandlers 防重复注册守卫使用模块级 handlersRegistered 变量"

patterns-established:
  - "IPC 信任校验: isManagedWindow(winId) 集合校验替代单窗口比较"
  - "防重复注册: handlersRegistered 标志 + console.warn 跳过"

requirements-completed: [MW-09]

coverage:
  - id: D1
    description: "assertTrustedSender 使用 windowManager.isManagedWindow(win.id) 校验所有 managedWindowIds 中的窗口"
    requirement: "MW-09"
    verification:
      - kind: other
        ref: "grep -c 'isManagedWindow' ipc-handlers.js && grep -A 10 'function assertTrustedSender' ipc-handlers.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "shortcut:set/reset handler 调用无参 rebuildShortcuts()"
    verification:
      - kind: other
        ref: "grep -c 'rebuildShortcuts()' ipc-handlers.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "registerHandlers 包含 handlersRegistered 防重复注册守卫"
    verification:
      - kind: other
        ref: "grep -c 'handlersRegistered' ipc-handlers.js"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-08-14
status: complete
---

# Phase 34 Plan 02: IPC 信任模型泛化 Summary

**assertTrustedSender 从硬编码主窗口校验泛化为 managedWindowIds 集合校验，shortcut handler 适配无参 rebuildShortcuts，registerHandlers 新增防重复注册守卫**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-14T14:45:40Z
- **Completed:** 2026-08-14T14:47:12Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- assertTrustedSender 从 `win.id !== mainWindow.id` 硬编码比较改为 `windowManager.isManagedWindow(win.id)` 集合校验，新窗口 IPC 调用可正常通过校验
- shortcut:set 和 shortcut:reset handler 移除 `windowManager.getMainWindow()` 调用，`rebuildShortcuts()` 改为无参版本
- registerHandlers 新增 `handlersRegistered` 模块级变量守卫，防止多窗口场景下 IPC handler 重复注册
- assertPlayerSender 保持不变（D-13 播放器窗口全局单例校验不受影响）

## Task Commits

Each task was committed atomically:

1. **Task 1: 泛化 assertTrustedSender + 适配 shortcut handler + 防重复注册守卫** - `ee29fd2` (feat)

## Files Created/Modified

- `ipc-handlers.js` - assertTrustedSender 泛化为 managedWindowIds 校验 + shortcut handler 适配 + registerHandlers 防重复注册守卫

## Decisions Made

- D-11: assertTrustedSender 使用 windowManager.isManagedWindow(win.id) 替代 mainWindow.id 硬编码比较
- assertPlayerSender 保持不变：播放器窗口 D-13 全局单例校验逻辑不受多窗口影响
- registerHandlers 防重复注册：使用模块级 handlersRegistered 变量 + console.warn 日志

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (Dock 菜单 + main.js): assertTrustedSender 泛化已完成，新窗口 IPC 通信就绪
- main.js 中 `getMainWindow().webContents.send()` 调用需要在 Plan 03 中改为 `broadcast()`

## Self-Check

- [x] ipc-handlers.js 的 assertTrustedSender 使用 `windowManager.isManagedWindow(win.id)` 校验
- [x] ipc-handlers.js 的 assertTrustedSender 不再引用 mainWindow.id 硬编码比较
- [x] ipc-handlers.js 的 assertPlayerSender 保持不变
- [x] ipc-handlers.js 的 shortcut:set handler 调用 `shortcutManager.rebuildShortcuts()` 无参版本
- [x] ipc-handlers.js 的 shortcut:reset handler 调用 `shortcutManager.rebuildShortcuts()` 无参版本
- [x] ipc-handlers.js 的 registerHandlers 包含 `handlersRegistered` 防重复注册守卫
- [x] ipc-handlers.js 中 shortcut:set/reset 的 getMainWindow() 调用已移除

## Self-Check: PASSED

---
*Phase: 34-multi-window*
*Completed: 2026-08-14*

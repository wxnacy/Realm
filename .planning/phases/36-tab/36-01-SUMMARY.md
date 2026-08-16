---
phase: 36-tab
plan: 01
subsystem: ui
tags: [electron, window-bounds, context-menu, persistence]

requires:
  - phase: 35-tab
    provides: tab windowId association, window lifecycle management
provides:
  - windowBoundsStore for per-container position persistence
  - saveWindowBounds/restoreWindowBounds with off-screen detection
  - "在新窗口中打开" tab context menu item
  - tab:open-in-new-window IPC channel with move option
affects: [36-tab]

tech-stack:
  added: []
  patterns: [electron-store window bounds persistence, throttled window event tracking]

key-files:
  created: []
  modified:
    - window-manager.js
    - main.js
    - context-menu-manager.js
    - ipc-handlers.js
    - src/preload.js
    - src/renderer.js

key-decisions:
  - "使用 screen.getDisplayMatching 做越界检测，窗口中心点不在任何显示器内则居中到主显示器"
  - "窗口 moved/resized 事件使用 200ms throttle 避免拖拽时频繁写入"
  - "tab:open-in-new-window 支持 move 参数，右键菜单默认 false（保留原 Tab），拖拽场景可用 true"
  - "before-quit 遍历 windowContainerMap 保存所有窗口位置"

patterns-established:
  - "窗口位置持久化：per-container key 格式 `container-${containerId}`，存储 bounds + isMaximized + displayId"
  - "setupWindowBoundsTracking 函数模式：封装 throttle 逻辑，窗口创建后调用"

requirements-completed: [MW-11, MW-13]

coverage:
  - id: D1
    description: "窗口位置持久化 — electron-store 存储，启动时恢复，越界自动居中"
    requirement: MW-11
    verification:
      - kind: manual_procedural
        ref: "启动应用，移动窗口到非默认位置，关闭重启验证恢复"
        status: unknown
    human_judgment: true
    rationale: "需要人工验证窗口位置恢复和多显示器场景"
  - id: D2
    description: "右键菜单"在新窗口中打开" — Tab 右键菜单新增选项"
    requirement: MW-13
    verification:
      - kind: manual_procedural
        ref: "右键 Tab，选择'在新窗口中打开'，验证新窗口创建"
        status: unknown
    human_judgment: true
    rationale: "需要人工验证菜单交互和新窗口创建"

duration: 25min
completed: 2026-08-15
status: complete
---

# Phase 36 Plan 01: 窗口位置持久化 + 右键菜单 Summary

**窗口位置 electron-store 持久化（含越界检测）+ Tab 右键菜单"在新窗口中打开"**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-15
- **Completed:** 2026-08-15
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 窗口位置持久化：electron-store 存储每容器窗口位置，启动时恢复，越界自动居中主显示器
- 窗口事件追踪：moved/resized 200ms throttle 实时保存，before-quit 保存所有窗口
- 右键菜单"在新窗口中打开"：完整 IPC 链路（菜单 → 主进程 → 新窗口创建）
- tab:open-in-new-window 支持 move 参数，为后续拖拽场景预留

## Task Commits

Each task was committed atomically:

1. **Task 1: 窗口位置持久化** - `76f78cf` (feat)
2. **Task 2: 右键菜单"在新窗口中打开"** - `559c4f9` (feat)

## Files Created/Modified
- `window-manager.js` - 新增 windowBoundsStore、saveWindowBounds、restoreWindowBounds
- `main.js` - setupWindowBoundsTracking + before-quit 保存
- `context-menu-manager.js` - 新增"在新窗口中打开"菜单项
- `ipc-handlers.js` - 新增 tab:open-in-new-window IPC handler
- `src/preload.js` - 暴露 openTabInNewWindow API + 注册新 channel
- `src/renderer.js` - 处理 context-menu:open-in-new-window 回调

## Decisions Made
- 越界检测使用窗口中心点判断（而非边缘），更准确反映窗口是否在可视区域
- moved/resized 事件 200ms throttle，平衡实时性和写入频率
- before-quit 时遍历 windowContainerMap 保存所有窗口（非仅主窗口）

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- 窗口位置持久化基础完成，可被后续 Phase 复用
- "在新窗口中打开"基础完成，拖拽场景可直接使用 move: true 参数
- 等待 Phase 36 Plan 02（Tab 拖拽排序）和 Plan 03（跨窗口拖拽）

---
*Phase: 36-tab*
*Completed: 2026-08-15*

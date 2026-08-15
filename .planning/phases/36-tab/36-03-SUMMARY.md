---
phase: 36-tab
plan: 03
subsystem: ui
tags: [electron, drag-and-drop, cross-window, tab-management, ipc]

requires:
  - phase: 36-tab
    provides: window position persistence, context menu "open in new window", openTabInNewWindow API
  - phase: 36-tab
    provides: window-internal tab DnD reorder with HTML5 Drag and Drop

provides:
  - DragCoordinator class for global drag state management
  - Cross-window drag IPC channels (drag:start/update-position/end/cancel/state-changed)
  - Floating drag preview that follows cursor
  - Cross-window tab movement (drag to another window's tab bar)
  - Tab drag-out creates new window
  - Source window auto-destroy when last tab is dragged away
  - Tab event listeners (tab:created/tab:removed/tab:switched) for cross-window sync

affects: [36-tab, window-management, tab-management]

tech-stack:
  added: [drag-coordinator.js]
  patterns: [ipc-based-cross-window-drag, custom-mouse-event-drag-system]

key-files:
  created: [drag-coordinator.js]
  modified: [main.js, src/renderer.js, src/preload.js, src/styles/main.css, ipc-handlers.js, window-manager.js]

key-decisions:
  - "使用自定义 mousedown/mousemove/mouseup 事件实现跨窗口拖拽（不使用 HTML5 DnD API，因为 DnD 事件无法跨窗口传递）"
  - "DragCoordinator 作为独立模块注入 windowManager/tabManager/containerManager 依赖（避免循环 require）"
  - "通过 windowManager.findWindowAtScreenPosition() 检测目标窗口（不暴露内部 windows Map）"
  - "窗口 ID 通过 window:get-id IPC 通道暴露给渲染进程（用于判断自身窗口身份）"
  - "跨窗口 Tab 移动后，源窗口和目标窗口通过 tab:removed/tab:created 事件同步 UI 状态"

requirements-completed: [MW-02, MW-03]

coverage:
  - id: D1
    description: "DragCoordinator 类维护拖拽全局状态，协调跨窗口通信"
    requirement: MW-02
    verification:
      - kind: integration
        ref: "drag-coordinator.js startDrag/updatePosition/endDrag/cancelDrag functions"
        status: pass
    human_judgment: false
  - id: D2
    description: "drag:start/update-position/end/cancel/state-changed IPC 通道"
    requirement: MW-02
    verification:
      - kind: integration
        ref: "ipc-handlers.js drag IPC handlers + src/preload.js drag API"
        status: pass
    human_judgment: false
  - id: D3
    description: "浮动预览窗口跟随鼠标移动"
    requirement: MW-02
    verification:
      - kind: manual_procedural
        ref: "Tab 拖拽出 Tab 栏时显示浮动预览"
        status: unknown
    human_judgment: true
    rationale: "需要实际拖拽操作验证预览显示和跟随效果"
  - id: D4
    description: "拖拽 Tab 出标签栏创建新窗口"
    requirement: MW-02
    verification:
      - kind: manual_procedural
        ref: "拖拽 Tab 到窗口外部松手，验证新窗口创建"
        status: unknown
    human_judgment: true
    rationale: "需要实际拖拽操作验证新窗口创建和 Tab 迁移"
  - id: D5
    description: "跨窗口 Tab 移动（拖拽到另一个窗口的 Tab 栏）"
    requirement: MW-03
    verification:
      - kind: manual_procedural
        ref: "拖拽窗口 A 的 Tab 到窗口 B 的 Tab 栏，验证 Tab 移动"
        status: unknown
    human_judgment: true
    rationale: "需要两个窗口同时打开进行实际拖拽测试"
  - id: D6
    description: "源窗口仅剩一个 Tab 时自动销毁"
    requirement: MW-03
    verification:
      - kind: manual_procedural
        ref: "将窗口唯一 Tab 拖走后，验证源窗口自动关闭"
        status: unknown
    human_judgment: true
    rationale: "需要实际跨窗口拖拽验证窗口销毁行为"

duration: 12min
completed: 2026-08-15
status: complete
---

# Phase 36 Plan 03: 跨窗口 Tab 拖拽 Summary

**DragCoordinator 全局拖拽状态协调 + 自定义鼠标事件跨窗口拖拽 + 浮动预览 + Tab 事件同步**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-15T21:48:00+08:00
- **Completed:** 2026-08-15T22:00:07+08:00
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- DragCoordinator 类管理跨窗口拖拽全局状态，支持 startDrag/updatePosition/endDrag/cancelDrag 操作
- 5 个 drag:* IPC 通道实现渲染进程与主进程的拖拽状态同步
- 自定义 mousedown/mousemove/mouseup 事件系统（不依赖 HTML5 DnD API，解决跨窗口限制）
- 浮动预览 DOM 元素（200px 宽，favicon + 标题，跟随鼠标）
- 拖拽 Tab 出 Tab 栏时创建新窗口（通过 openTabInNewWindow API）
- 跨窗口 Tab 移动（通过 DragCoordinator 检测目标窗口并执行迁移）
- 源窗口无剩余 Tab 时自动销毁
- tab:created/tab:removed/tab:switched 事件监听器实现跨窗口 UI 同步
- findWindowAtScreenPosition() 封装窗口位置检测（不暴露内部 Map）

## Task Commits

Each task was committed atomically:

1. **Task 1: DragCoordinator + 跨窗口通信基础** - `3c39b3b` (feat)
2. **Task 2: 浮动预览 + 新窗口创建** - `b463004` (feat)
3. **Task 3: 跨窗口 Tab 移动** - `bab8880` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `drag-coordinator.js` - 拖拽协调器模块（全局状态管理、窗口检测、跨窗口 Tab 迁移）
- `main.js` - 引入 drag-coordinator 模块并注入依赖
- `ipc-handlers.js` - 添加 drag:* 和 window:get-id IPC 处理器
- `src/preload.js` - 暴露拖拽 API（startDrag/updateDragPosition/endDrag/cancelDrag/onDragStateChanged）和 Tab 事件监听
- `src/renderer.js` - 自定义鼠标事件处理、浮动预览、跨窗口拖拽逻辑、Tab 事件处理
- `src/styles/main.css` - 浮动预览样式、跨拖拽源样式、目标窗口高亮样式
- `window-manager.js` - 添加 findWindowAtScreenPosition() 窗口位置检测函数

## Decisions Made

- 使用自定义 mousedown/mousemove/mouseup 事件实现跨窗口拖拽（HTML5 DnD 事件无法跨窗口传递）
- DragCoordinator 作为独立模块，通过 setter 注入 windowManager/tabManager/containerManager 依赖（避免循环 require）
- 通过 windowManager.findWindowAtScreenPosition() 检测目标窗口位置（封装内部数据结构）
- 窗口 ID 通过 window:get-id IPC 通道暴露给渲染进程（用于判断自身窗口身份）
- 跨窗口 Tab 移动后通过 tab:removed/tab:created 事件同步 UI（不直接调用 DOM 操作）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Phase 36 所有 3 个 Plan 已完成
- 跨窗口 Tab 拖拽功能已实现基础框架，需要 UAT 验证
- 可能需要后续迭代优化：拖拽预览动画、目标窗口 Tab 栏插入位置指示器

---
*Phase: 36-tab*
*Completed: 2026-08-15*

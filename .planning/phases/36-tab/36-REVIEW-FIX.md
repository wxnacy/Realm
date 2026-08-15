---
phase: 36-tab
fixed_at: 2026-08-15T14:30:00Z
review_path: .planning/phases/36-tab/36-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 6
skipped: 2
status: partial
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-08-15T14:30:00Z
**Source review:** .planning/phases/36-tab/36-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning, excluding 1 Info)
- Fixed: 6
- Skipped: 2

## Fixed Issues

### CR-01: `endDrag`/`cancelDrag` 在广播拖拽状态前已清空状态数据

**Files modified:** `drag-coordinator.js`
**Commit:** fe03b2a
**Applied fix:** 在 `endDrag` 和 `cancelDrag` 中，将 `broadcastDragState()` 调用移到 `resetDragState()` 之前，确保广播时 `tabId` 和 `sourceWindowId` 仍有效。

### CR-02: Tab 栏内拖拽松手时错误触发创建新窗口

**Files modified:** `src/renderer.js`
**Commit:** 7f71ce9
**Applied fix:** 当 `outOfTabBar` 为 false 且 `targetWindowId` 为 null 时（鼠标仍在源窗口 Tab 栏内），调用 `cancelDrag()` 取消拖拽并回滚 UI，而非设置 `outOfTabBar = true` 触发新建窗口。

### CR-03: `main.js` 退出流程中 `windowContainerMap` 未导出导致 TypeError

**Files modified:** `main.js`
**Commit:** 365b7c8
**Applied fix:** 使用 `BrowserWindow.getAllWindows()` 遍历所有窗口，配合 `windowManager.getCurrentContainer(win.id)` 获取容器 ID，避免解构未导出的 `windowContainerMap`。

### WR-01: 跨窗口移动 Tab 时未验证目标窗口的容器兼容性

**Files modified:** `drag-coordinator.js`
**Commit:** b242fd7
**Applied fix:** 在 `move-to-window` 路径中，移动 Tab 前检查目标窗口的容器是否与 Tab 的容器一致。不兼容时拒绝移动并返回 `{ success: false, action: 'cancelled' }`，防止 Cookie 隔离被破坏。

### WR-02: `endDrag` 的 `move-to-window` 路径未验证 `parseInt` 结果

**Files modified:** `drag-coordinator.js`
**Commit:** fe03b2a (与 CR-01 同一提交)
**Applied fix:** 在 `parseInt(data.targetWindowId, 10)` 后添加 `Number.isFinite()` 检查，防止 `NaN` 传入后续逻辑。

### WR-05: `broadcastDragState` 中 `isDragging` 字段值不可靠

**Files modified:** `drag-coordinator.js`
**Commit:** fe03b2a (与 CR-01 同一提交)
**Applied fix:** 将 `isDragging: dragState.isDragging` 改为 `isDragging: eventType === 'started'`，使用传入的事件类型判断而非读取可能已被清空的状态字段。

## Skipped Issues

### WR-03: `preload.js` 中拖拽 API 放置在 `downloadAPI` 命名空间下

**File:** `src/preload.js:1317-1360`
**Reason:** 需要重构 preload.js 的 API 命名空间结构，涉及 renderer.js 中所有拖拽相关调用的路径修改（`window.downloadAPI.startDrag` → `window.realmAPI.startDrag` 等）。改动范围大且属于代码组织优化，不影响功能正确性，建议在后续重构中处理。

### WR-04: 浮动预览定位使用 `window.screenX/Y` 可能存在偏移

**File:** `src/renderer.js:8121-8124`
**Reason:** macOS `hiddenInset` 模式下的精确偏移计算需要实际测试验证，且当前偏移量很小（仅水平方向可能的交通灯区域 padding），属于视觉微调。建议通过实际运行测试确认是否需要修复及修复值。

---

_Fixed: 2026-08-15T14:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

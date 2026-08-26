---
phase: 36-tab
fixed_at: 2026-08-15T13:00:00Z
review_path: .planning/phases/36-tab/36-REVIEW.md
iteration: 3
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-08-15T13:00:00Z
**Source review:** .planning/phases/36-tab/36-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 5 (1 Critical + 4 Warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: 跨窗口拖拽 API 暴露在错误的命名空间下

**Files modified:** `src/preload.js`
**Commit:** 4c3c391
**Applied fix:** 将 `startDrag`、`updateDragPosition`、`endDrag`、`cancelDrag`、`onDragStateChanged` 五个方法从 `downloadAPI` 命名空间块移动到 `realmAPI` 命名空间块中，使渲染进程通过 `window.realmAPI.startDrag(...)` 等方式可以正确访问这些 API。

### WR-01: mouseup 未移除 keydown 监听器

**Files modified:** `src/renderer.js`
**Commit:** b08722f
**Applied fix:** 在 `onCrossDragMouseUp` 中补充 `document.removeEventListener('keydown', onCrossDragKeyDown, true)` 调用，确保拖拽结束时三个全局监听器（mousemove、mouseup、keydown）全部移除，防止 keydown 监听器在多次拖拽后累积。

### WR-02: TAB_BAR_HEIGHT 硬编码无同步标记

**Files modified:** `drag-coordinator.js`, `window-manager.js`
**Commit:** 0362c95
**Applied fix:** 在 `drag-coordinator.js:130` 和 `window-manager.js:314` 的 `TAB_BAR_HEIGHT` 常量处添加交叉引用注释，标注需与 CSS `.tab-bar` height 保持同步，方便后续维护时识别关联位置。

### WR-03: updatePosition 未校验 position 参数

**Files modified:** `drag-coordinator.js`
**Commit:** 0658547
**Applied fix:** 在 `updatePosition` 函数入口处（现有 guard 之后、访问 `position.x` 之前）添加参数校验：`if (!position || typeof position.screenX !== 'number' || typeof position.screenY !== 'number')` 返回 `{ success: false }`，防止畸形输入导致 TypeError。

### WR-04: window:get-id 未调用 assertTrustedSender

**Files modified:** `ipc-handlers.js`
**Commit:** 9ed70da
**Applied fix:** 将 `window:get-id` handler 中的 `BrowserWindow.fromWebContents(event.sender)` 替换为 `assertTrustedSender(event)`，统一信任校验模式。`assertTrustedSender` 会校验来源窗口是否为受管理窗口，不受信来源将抛出异常。

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-08-15T13:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_

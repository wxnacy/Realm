---
phase: 36-tab
reviewed: 2026-08-15T12:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - drag-coordinator.js
  - ipc-handlers.js
  - main.js
  - src/preload.js
  - src/renderer.js
  - src/styles/main.css
  - window-manager.js
findings:
  critical: 3
  warning: 5
  info: 1
  total: 9
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-08-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

对 Phase 36（跨窗口 Tab 拖拽、浮动预览、窗口位置持久化）的 7 个源文件进行了标准深度审查。发现了 3 个关键缺陷和 5 个警告级别问题。

关键问题集中在：(1) `drag-coordinator.js` 的状态管理逻辑缺陷（`resetDragState` 在 `broadcastDragState` 之前调用导致广播空数据）；(2) `renderer.js` 中跨窗口拖拽鼠标松手时的逻辑判断错误（Tab 栏内松手会错误触发新建窗口）；(3) `main.js` 退出流程中 `windowContainerMap` 未导出导致 TypeError，使应用无法正常退出且 Cookie 无法保存。

## Critical Issues

### CR-01: `endDrag`/`cancelDrag` 在广播拖拽状态前已清空状态数据

**File:** `drag-coordinator.js:229-232` 和 `drag-coordinator.js:319-320`
**Issue:** `endDrag` 函数在第 229 行调用 `resetDragState()` 清空了 `dragState.tabId` 和 `dragState.sourceWindowId`（设为 null），然后在第 232 行调用 `broadcastDragState('ended')`。`broadcastDragState` 读取 `dragState` 的当前值（第 349-356 行），此时 `tabId` 和 `sourceWindowId` 已经是 null。同样的问题存在于 `cancelDrag`（第 319-320 行）。

这意味着目标窗口收到 `drag:state-changed` 事件时，`data.tabId` 和 `data.sourceWindowId` 为 null，无法正确清理拖拽高亮状态或执行依赖这些字段的逻辑。

**Fix:**
```javascript
// drag-coordinator.js endDrag 函数，第 228-232 行
// 修改前：
resetDragState();
broadcastDragState('ended');

// 修改后：先广播，再清空
broadcastDragState('ended');
resetDragState();
```

```javascript
// drag-coordinator.js cancelDrag 函数，第 319-320 行
// 修改前：
resetDragState();
broadcastDragState('cancelled');

// 修改后：
broadcastDragState('cancelled');
resetDragState();
```

### CR-02: Tab 栏内拖拽松手时默认回退为 `outOfTabBar: true`，错误触发创建新窗口

**File:** `src/renderer.js:8277-8279`
**Issue:** `onCrossDragMouseUp` 中，当跨窗口拖拽已激活但 `targetWindowId` 为 null 且 `outOfTabBar` 为 false 时（即鼠标仍在 Tab 栏内松手），代码回退到 `else` 分支并设置 `endData.outOfTabBar = true`：

```javascript
} else {
  // 默认：超过阈值视为拖出
  endData.outOfTabBar = true;
}
```

这会导致在 Tab 栏内拖拽后松手时，主进程 `endDrag` 收到 `outOfTabBar: true`，执行 `action === 'new-window'` 逻辑——创建新窗口而非回滚到原位。

实际上，当 `state.crossDrag.outOfTabBar === false` 且 `state.crossDrag.targetWindowId === null` 时，说明鼠标仍在源窗口 Tab 栏区域，正确的动作应该是取消拖拽（回滚）。

**Fix:**
```javascript
// src/renderer.js 第 8277-8279 行
// 修改前：
} else {
  // 默认：超过阈值视为拖出
  endData.outOfTabBar = true;
}

// 修改后：
} else {
  // 鼠标仍在 Tab 栏内，取消拖拽
  await window.realmAPI.cancelDrag();
  resetCrossDragState();
  crossDragTabId = null;
  return;
}
```

### CR-03: `main.js` 退出流程中 `windowContainerMap` 未导出导致 TypeError，应用无法正常退出

**File:** `main.js:2736-2738`
**Issue:** `main.js` 第 2736 行通过 `const { windowContainerMap } = require('./window-manager')` 获取 `windowContainerMap`，但 `window-manager.js` 的 `module.exports`（第 336-347 行）并未导出此 Map。解构结果为 `undefined`。

第 2737 行 `for (const [winId, containerId] of windowContainerMap)` 对 `undefined` 迭代会抛出 `TypeError: undefined is not iterable`。此代码位于 `before-quit` handler 中，在 `event.preventDefault()` 调用之后、`try...catch` 块之前。TypeError 会导致：

1. 应用退出流程被中断（`app.quit()` 永远不会被调用）
2. Cookie 保存代码（`cookieManager.saveAllCookies()`）永远不会执行
3. 应用卡死在退出状态（`event.preventDefault()` 已阻止默认退出，但后续代码崩溃）

用户必须强制终止进程，且未保存的 Cookie 数据会丢失。

**Fix:**
```javascript
// main.js 第 2736-2738 行
// 修改前：
const { windowContainerMap } = require('./window-manager');
for (const [winId, containerId] of windowContainerMap) {
  windowManager.saveWindowBounds(winId, containerId);
}

// 修改后（使用已有的 windowManager 引用）：
const allWindows = require('electron').BrowserWindow.getAllWindows();
for (const win of allWindows) {
  const containerId = windowManager.getCurrentContainer(win.id);
  if (containerId) {
    windowManager.saveWindowBounds(win.id, containerId);
  }
}
```

或者在 `window-manager.js` 中导出 `windowContainerMap`：
```javascript
// window-manager.js module.exports 中添加：
module.exports = {
  // ...existing exports...
  windowContainerMap,
};
```

## Warnings

### WR-01: 跨窗口移动 Tab 时未验证目标窗口的容器兼容性

**File:** `drag-coordinator.js:263-297`
**Issue:** `endDrag` 的 `move-to-window` 路径将 Tab 移动到另一个窗口时，未检查目标窗口的容器是否与 Tab 的容器一致。如果 Tab 属于容器 A 而目标窗口运行容器 B，Tab 的 webview 会在错误的 Session 上下文中运行，导致 Cookie 隔离被破坏。

与 `new-window` 路径（第 239 行明确检查 `containerManagerRef.getContainer(tab.containerId)`）不同，`move-to-window` 路径直接将 Tab 移过去而不验证容器兼容性。

**Fix:** 在移动 Tab 前检查目标窗口的容器是否与 Tab 的容器一致，或者在移动后更新 Tab 的容器上下文。

### WR-02: `endDrag` 的 `move-to-window` 路径未验证 `parseInt` 结果

**File:** `drag-coordinator.js:265`
**Issue:** `const targetWindowId = parseInt(data.targetWindowId, 10);` 未检查结果是否为 `NaN`。如果 `data.targetWindowId` 不是有效数字字符串，`parseInt` 返回 `NaN`，`BrowserWindow.fromId(NaN)` 返回 `undefined`，虽然会被后续检查捕获，但属于防御性编程不足。

**Fix:**
```javascript
const targetWindowId = parseInt(data.targetWindowId, 10);
if (!Number.isFinite(targetWindowId)) {
  return { success: false, action: 'cancelled' };
}
```

### WR-03: `preload.js` 中拖拽 API 放置在 `downloadAPI` 命名空间下

**File:** `src/preload.js:1317-1360`
**Issue:** 跨窗口 Tab 拖拽的 IPC 方法（`startDrag`、`updateDragPosition`、`endDrag`、`cancelDrag`、`onDragStateChanged`）被放在 `downloadAPI` 命名空间内。注释 `// ==================== 跨窗口 Tab 拖拽（Phase 36 Plan 03） ====================` 虽然标明了用途，但代码位于 `downloadAPI` 的 `contextBridge.exposeInMainWorld` 调用内部。

这意味着渲染进程调用这些方法时使用 `window.downloadAPI.startDrag()` 而非语义上更合理的 `window.realmAPI.startDrag()`，容易造成维护困惑。

**Fix:** 将拖拽相关 API 移到 `realmAPI` 命名空间下，或创建独立的 `dragAPI` 命名空间。

### WR-04: 浮动预览定位使用 `window.screenX/Y` 可能存在偏移

**File:** `src/renderer.js:8121-8124`
**Issue:** 浮动预览的坐标计算使用 `window.screenX` 和 `window.screenY` 将屏幕坐标转为窗口内坐标。但 `window.screenX/Y` 返回的是 BrowserWindow 的左上角坐标，而非 webContents（渲染区域）的左上角。窗口使用 `titleBarStyle: 'hiddenInset'`，标题栏区域会偏移渲染区域的起始位置。

在 macOS `hiddenInset` 模式下，渲染区域的 Y 起始位置为 0（标题栏嵌入），`window.screenY` 与渲染区域的屏幕 Y 坐标一致。但水平方向上，`hiddenInset` 的交通灯按钮区域有额外 padding，可能导致预览位置在水平方向有微小偏移。

**Fix:** 如需精确对齐，可使用 `window.screenLeft` 和 `window.outerHeight - window.innerHeight` 计算标题栏偏移，或使用 `webFrame.getZoomFactor()` 校正。

### WR-05: `broadcastDragState` 在 `dragState.isDragging` 已被清空时仍广播

**File:** `drag-coordinator.js:346-357`
**Issue:** `broadcastDragState` 广播的 payload 中包含 `isDragging: dragState.isDragging`。在 `endDrag` 和 `cancelDrag` 中，`resetDragState()` 已将 `isDragging` 设为 false（CR-01 的伴生问题）。即使修复了 CR-01 的调用顺序，`broadcastDragState('ended')` 仍在 `resetDragState()` 之前调用，此时 `isDragging` 仍为 true。

目标窗口收到 `drag:state-changed` 事件时，`data.isDragging` 的值取决于广播时机：`started` 时为 true，`ended`/`cancelled` 时在 CR-01 修复前为 false（因已 reset），修复后为 true（因未 reset）。

建议 `broadcastDragState` 显式使用传入的 `eventType` 来判断拖拽是否结束，而非依赖 `isDragging` 字段。

**Fix:** 在 `broadcastDragState` 中，`ended`/`cancelled` 事件类型的 `isDragging` 应始终为 false：
```javascript
function broadcastDragState(eventType) {
  if (!windowManagerRef) return;
  windowManagerRef.broadcast('drag:state-changed', {
    type: eventType,
    tabId: dragState.tabId,
    sourceWindowId: dragState.sourceWindowId,
    screenX: dragState.screenX,
    screenY: dragState.screenY,
    isDragging: eventType === 'started',
  });
}
```

## Info

### IN-01: `drag-coordinator.js` 注释引用了不存在的 D-25/D-26/D-27/D-28/MW-02/MW-03 决策编号

**File:** `drag-coordinator.js:8,114,209`
**Issue:** 文件头部注释引用了 `D-25, D-26`、函数注释引用了 `D-27, D-28`、`endDrag` 注释引用了 `MW-02, MW-03` 等决策编号。这些编号可能来自 Phase 36 的内部规划文档，但在此源文件中作为追溯引用时，如果规划文档未提交或编号变更，会造成维护困惑。

**Fix:** 确保引用的决策文档存在于代码库中，或在注释中简述决策内容而非仅引用编号。

---

_Reviewed: 2026-08-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

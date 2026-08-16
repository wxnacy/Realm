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
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-08-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 36 实现了跨窗口 Tab 拖拽（Plan 03）、窗口位置持久化（Plan 01）等功能。上一轮审查发现的关键问题（CR-01 move-to-window 通知顺序、CR-02 new-window 通知顺序、WR-01 Escape 键处理、WR-04 序列号防乱序、WR-05 updateTab 返回值检查）均已在当前代码中修复。整体架构合理，拖拽协调器的状态机设计清晰，跨窗口移动的回滚机制到位。

本轮发现 1 个新的关键问题：跨窗口拖拽的 5 个 IPC API 方法在 preload 中被错误地暴露在 `downloadAPI` 命名空间下，渲染进程通过 `window.realmAPI` 访问时会抛出 TypeError，导致跨窗口拖拽功能完全无法工作。另发现 4 个 Warning 级别问题和 2 个 Info 级别建议。

## Critical Issues

### CR-01: 跨窗口拖拽 API 暴露在错误的命名空间下，渲染进程调用会抛出 TypeError

**File:** `src/preload.js:1317-1359`
**Issue:** 跨窗口拖拽的 5 个 API 方法（`startDrag`、`updateDragPosition`、`endDrag`、`cancelDrag`、`onDragStateChanged`）被错误地放在 `downloadAPI` 命名空间下（`window.downloadAPI`），而非 `realmAPI` 命名空间。但渲染进程中所有调用都通过 `window.realmAPI.startDrag(...)` 等方式访问（`src/renderer.js:8198,8214,8267,8291,8393`）。

运行时 `window.realmAPI.startDrag` 为 `undefined`，调用时会抛出 `TypeError: window.realmAPI.startDrag is not a function`，导致跨窗口拖拽功能完全无法工作。

**Fix:**
将 `startDrag`、`updateDragPosition`、`endDrag`、`cancelDrag`、`onDragStateChanged` 从 `downloadAPI` 块移动到 `realmAPI` 块中（在 `src/preload.js` 的 `contextBridge.exposeInMainWorld('realmAPI', {...})` 内部）。

```javascript
// 在 realmAPI 块中添加（而非 downloadAPI 块中）
// ==================== 跨窗口 Tab 拖拽（Phase 36 Plan 03） ====================

/**
 * 通知主进程开始拖拽 Tab
 * @param {string} tabId - 被拖拽的 Tab ID
 * @returns {Promise<{success: boolean}>}
 */
startDrag: (tabId) => ipcRenderer.invoke('drag:start', tabId),

/**
 * 更新拖拽鼠标位置
 * @param {Object} position - { x, y, screenX, screenY }
 * @returns {Promise<{success: boolean, outOfTabBar?: boolean, targetWindow?: Object|null}>}
 */
updateDragPosition: (position) => ipcRenderer.invoke('drag:update-position', position),

/**
 * 结束拖拽
 * @param {Object} data - { targetWindowId?, outOfTabBar? }
 * @returns {Promise<{success: boolean, action?: string}>}
 */
endDrag: (data) => ipcRenderer.invoke('drag:end', data),

/**
 * 取消拖拽
 * @returns {Promise<{success: boolean}>}
 */
cancelDrag: () => ipcRenderer.invoke('drag:cancel'),

/**
 * 监听拖拽状态变化（主进程广播）
 * @param {Function} callback - 回调函数
 * @returns {Function} 取消监听函数
 */
onDragStateChanged: (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('drag:state-changed', handler);
  return () => ipcRenderer.removeListener('drag:state-changed', handler);
},
```

## Warnings

### WR-01: mouseup 未移除 keydown 监听器，Escape 键处理在多次拖拽后失效

**File:** `src/renderer.js:8240-8243`
**Issue:** `onCrossDragMouseUp` 中移除了 `mousemove` 和 `mouseup` 监听器，但未移除 `keydown` 监听器（`onCrossDragKeyDown`）。`crossDragListenersAttached` 被设为 `false`，但 keydown 仍在监听。

后果：(1) 第一次拖拽后 keydown 监听器成为孤儿；(2) 第二次拖拽时 `onCrossDragMouseDown` 中 `crossDragListenersAttached === false`，重新绑定一个新的 keydown 监听器，旧的仍未清理——多次拖拽后 keydown 监听器累积；(3) 孤儿 keydown 监听器中的闭包引用旧的 `state.crossDrag` 状态，按 Escape 可能在非拖拽状态下调用 `cancelDrag`。

**Fix:**
在 `onCrossDragMouseUp` 中补充 keydown 移除：

```javascript
async function onCrossDragMouseUp(e) {
  // 清理全局监听器（三个都要移除）
  document.removeEventListener('mousemove', onCrossDragMouseMove, true);
  document.removeEventListener('mouseup', onCrossDragMouseUp, true);
  document.removeEventListener('keydown', onCrossDragKeyDown, true);  // 添加此行
  crossDragListenersAttached = false;
  // ...
}
```

### WR-02: `TAB_BAR_HEIGHT` 在两个模块中硬编码（38px），与 CSS 不同步风险

**File:** `drag-coordinator.js:130`、`window-manager.js:314`
**Issue:** `TAB_BAR_HEIGHT = 38` 在 `drag-coordinator.js` 和 `window-manager.js` 中分别硬编码。`EXIT_THRESHOLD = 30` 也是硬编码。如果 CSS 中 Tab 栏高度变更，必须同步修改三处（CSS + 两个 JS 文件），遗漏任何一处会导致拖拽检测区域偏移。

**Fix:**
将常量提取到共享模块或配置中，至少在两个文件中用相同注释标记互相关联：

```javascript
// 与 CSS .tab-bar height 和 window-manager.js:314 保持同步
const TAB_BAR_HEIGHT = 38;
```

### WR-03: `updatePosition` 未校验 `position` 参数，畸形输入可导致 TypeError

**File:** `drag-coordinator.js:180`
**Issue:** `updatePosition(sourceWindowId, position)` 直接访问 `position.x`、`position.y`、`position.screenX`、`position.screenY`，未校验 `position` 是否为对象或是否包含这些属性。虽然渲染进程是受信来源（经 `assertTrustedSender`），但防御性编程应做基本校验。

**Fix:**
在函数入口添加参数校验：

```javascript
function updatePosition(sourceWindowId, position) {
  if (!dragState.isDragging || dragState.sourceWindowId !== sourceWindowId) {
    return { success: false };
  }
  if (!position || typeof position.screenX !== 'number' || typeof position.screenY !== 'number') {
    return { success: false };
  }
  // ...
}
```

### WR-04: `window:get-id` 未调用 `assertTrustedSender`

**File:** `ipc-handlers.js:475-478`
**Issue:** `window:get-id` handler 直接从 `event.sender` 获取 BrowserWindow，未调用 `assertTrustedSender` 校验。任何 webview guest 均可 invoke 获取 BrowserWindow.id。虽然 window ID 是数字、不是直接的安全凭证，但这与所有其他 handler 的信任校验模式不一致，应统一加固。

**Fix:**
```javascript
ipcMain.handle('window:get-id', (event) => {
  const win = assertTrustedSender(event);  // 统一校验
  return win.id;
});
```

## Info

### IN-01: `endDrag` 中 action 判断逻辑可读性可优化

**File:** `drag-coordinator.js:224`
**Issue:** `const action = data.targetWindowId ? 'move-to-window' : (data.outOfTabBar ? 'new-window' : 'reorder');` 嵌套三元表达式可读性较差。

**Fix:**
```javascript
let action = 'reorder';
if (data.targetWindowId) {
  action = 'move-to-window';
} else if (data.outOfTabBar) {
  action = 'new-window';
}
```

### IN-02: CSS 中 `tab-drag-preview` 的 z-index 使用魔法数字 10000

**File:** `src/styles/main.css:1557`
**Issue:** `z-index: 10000` 是典型的魔法数字。建议定义 CSS 自定义变量 `--z-drag-preview` 或在样式表顶部定义 z-index 层级常量。

---

_Reviewed: 2026-08-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

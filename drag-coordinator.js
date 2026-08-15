/**
 * Realm Browser - 拖拽协调器
 *
 * 管理跨窗口 Tab 拖拽的全局状态协调。主进程维护全局拖拽状态，
 * 渲染进程通过 IPC 报告鼠标位置，DragCoordinator 判断目标窗口
 * 并协调跨窗口 Tab 迁移。
 *
 * 架构说明（per D-25, D-26）：
 * - 使用自定义 mousedown/mousemove/mouseup 事件实现拖拽（不使用 HTML5 DnD API）
 * - HTML5 DnD 仅用于窗口内 Tab 排序（已在 Plan 36-02 实现）
 * - 跨窗口通信通过 IPC（drag:start/update-position/end/cancel/state-changed）
 *
 * 拖拽状态机：
 *   idle → dragging → (ended | cancelled)
 *   - dragging: 鼠标按下并移动超过阈值后进入
 *   - ended: 松手时根据位置判断执行（新窗口/跨窗口移动/回滚）
 *   - cancelled: 按 Escape 或无效操作时回滚
 *
 * 数据流：
 *   渲染进程 mousedown → drag:start → DragCoordinator 记录源窗口
 *   渲染进程 mousemove → drag:update-position → DragCoordinator 更新位置 + 广播
 *   渲染进程 mouseup → drag:end → DragCoordinator 判断目标并执行
 */

const { BrowserWindow, screen } = require('electron');

/**
 * 拖拽全局状态
 * @type {{ tabId: string|null, sourceWindowId: number|null, currentX: number, currentY: number, screenX: number, screenY: number, isDragging: boolean }}
 */
const dragState = {
  tabId: null,
  sourceWindowId: null,
  currentX: 0,
  currentY: 0,
  screenX: 0,
  screenY: 0,
  isDragging: false,
};

/**
 * 窗口管理器引用（由 main.js 通过 setWindowManager 注入，避免循环依赖）
 * @type {Object|null}
 */
let windowManagerRef = null;

/**
 * Tab 管理器引用（由 main.js 通过 setTabManager 注入）
 * @type {Object|null}
 */
let tabManagerRef = null;

/**
 * 容器管理器引用（由 main.js 通过 setContainerManager 注入）
 * @type {Object|null}
 */
let containerManagerRef = null;

/**
 * 设置窗口管理器引用
 * @param {Object} wm - windowManager 模块
 */
function setWindowManager(wm) {
  windowManagerRef = wm;
}

/**
 * 设置 Tab 管理器引用
 * @param {Object} tm - tabManager 模块
 */
function setTabManager(tm) {
  tabManagerRef = tm;
}

/**
 * 设置容器管理器引用
 * @param {Object} cm - containerManager 模块
 */
function setContainerManager(cm) {
  containerManagerRef = cm;
}

/**
 * 获取当前拖拽状态的只读副本
 * @returns {Object} 拖拽状态对象
 */
function getDragState() {
  return { ...dragState };
}

/**
 * 检测鼠标位置是否在某个窗口的 Tab 栏区域内
 *
 * 使用 windowManager.findWindowAtScreenPosition 查找鼠标所在的托管窗口，
 * 避免直接访问 windowManager 内部的 windows Map。
 *
 * @param {number} screenX - 屏幕坐标 X
 * @param {number} screenY - 屏幕坐标 Y
 * @param {number} [excludeWindowId] - 排除的窗口 ID（通常是源窗口）
 * @returns {{ windowId: number, inTabBar: boolean }|null} 命中的窗口信息，null 表示不在任何窗口内
 */
function detectTargetWindow(screenX, screenY, excludeWindowId) {
  if (!windowManagerRef || !windowManagerRef.findWindowAtScreenPosition) return null;

  const result = windowManagerRef.findWindowAtScreenPosition(screenX, screenY, excludeWindowId);
  if (!result) return null;

  return { windowId: result.windowId, inTabBar: result.inTabBar };
}

/**
 * 检测鼠标是否离开源窗口的 Tab 栏区域（拖出检测）
 *
 * 判断逻辑（per D-27, D-28）：
 * - 垂直方向：鼠标离开 Tab 栏底部 + 30px 阈值
 * - 水平方向：鼠标离开 Tab 栏左右边缘
 * - 支持向下拖出和向上拖出
 *
 * @param {number} screenX - 屏幕坐标 X
 * @param {number} screenY - 屏幕坐标 Y
 * @returns {boolean} 是否已拖出 Tab 栏
 */
function isDraggedOutOfTabBar(screenX, screenY) {
  if (!dragState.sourceWindowId || !windowManagerRef) return false;

  const sourceWin = BrowserWindow.fromId(dragState.sourceWindowId);
  if (!sourceWin || sourceWin.isDestroyed()) return false;

  const bounds = sourceWin.getBounds();
  const TAB_BAR_HEIGHT = 38;
  const EXIT_THRESHOLD = 30; // 垂直方向额外阈值

  // 垂直检测：鼠标离开 Tab 栏底部 + 阈值，或离开窗口顶部
  const belowTabBar = screenY > bounds.y + TAB_BAR_HEIGHT + EXIT_THRESHOLD;
  const aboveWindow = screenY < bounds.y;

  // 水平检测：鼠标离开窗口左右边缘
  const outsideHorizontal = screenX < bounds.x || screenX > bounds.x + bounds.width;

  return belowTabBar || aboveWindow || outsideHorizontal;
}

/**
 * 开始拖拽
 *
 * 渲染进程在 mousedown + 移动超过阈值后调用。
 * 记录拖拽源信息并广播状态到所有窗口。
 *
 * @param {number} sourceWindowId - 发起拖拽的窗口 ID
 * @param {string} tabId - 被拖拽的 Tab ID
 * @returns {{ success: boolean }}
 */
function startDrag(sourceWindowId, tabId) {
  dragState.tabId = tabId;
  dragState.sourceWindowId = sourceWindowId;
  dragState.isDragging = true;

  console.log(`[Realm DragCoordinator] 开始拖拽: Tab ${tabId} from 窗口 ${sourceWindowId}`);

  // 广播拖拽开始到所有窗口
  broadcastDragState('started');

  return { success: true };
}

/**
 * 更新拖拽位置
 *
 * 渲染进程在 mousemove 时高频调用。
 * 更新全局位置状态，并检测是否需要广播（目标窗口变化时广播）。
 *
 * @param {number} sourceWindowId - 来源窗口 ID（校验用）
 * @param {Object} position - 鼠标位置
 * @param {number} position.x - 窗口内坐标 X
 * @param {number} position.y - 窗口内坐标 Y
 * @param {number} position.screenX - 屏幕坐标 X
 * @param {number} position.screenY - 屏幕坐标 Y
 * @returns {{ success: boolean, outOfTabBar?: boolean, targetWindow?: Object|null }}
 */
function updatePosition(sourceWindowId, position) {
  if (!dragState.isDragging || dragState.sourceWindowId !== sourceWindowId) {
    return { success: false };
  }

  dragState.currentX = position.x;
  dragState.currentY = position.y;
  dragState.screenX = position.screenX;
  dragState.screenY = position.screenY;

  // 检测是否拖出 Tab 栏
  const outOfTabBar = isDraggedOutOfTabBar(position.screenX, position.screenY);

  // 检测是否在另一个窗口的 Tab 栏上
  const targetWindow = detectTargetWindow(
    position.screenX,
    position.screenY,
    dragState.sourceWindowId
  );

  return { success: true, outOfTabBar, targetWindow };
}

/**
 * 结束拖拽
 *
 * 渲染进程在 mouseup 时调用。根据鼠标位置判断执行动作：
 * 1. 在 Tab 栏内：窗口内排序（已在 Plan 36-02 处理，此处不涉及）
 * 2. 在 Tab 栏外但在窗口内：创建新窗口（per MW-02）
 * 3. 在另一个窗口的 Tab 栏：移动到该窗口（per MW-03）
 * 4. 取消：静默回滚
 *
 * @param {number} sourceWindowId - 来源窗口 ID（校验用）
 * @param {Object} [data] - 结束数据
 * @param {string} [data.targetWindowId] - 目标窗口 ID（跨窗口移动时）
 * @param {boolean} [data.outOfTabBar] - 是否拖出 Tab 栏（创建新窗口时）
 * @returns {Promise<{success: boolean, action?: string, newWindowId?: number}>}
 */
async function endDrag(sourceWindowId, data = {}) {
  if (!dragState.isDragging || dragState.sourceWindowId !== sourceWindowId) {
    return { success: false, action: 'cancelled' };
  }

  const tabId = dragState.tabId;
  const action = data.targetWindowId ? 'move-to-window' : (data.outOfTabBar ? 'new-window' : 'reorder');

  console.log(`[Realm DragCoordinator] 结束拖拽: Tab ${tabId}, 动作=${action}`);

  // 先广播拖拽结束，再清除状态（确保广播时 tabId/sourceWindowId 仍有效）
  broadcastDragState('ended');

  // 清除拖拽状态
  resetDragState();

  if (action === 'new-window' && tabManagerRef && windowManagerRef && containerManagerRef) {
    // 拖出 Tab 栏：创建新窗口
    const tab = tabManagerRef.getTab(tabId);
    if (!tab) return { success: false, action: 'cancelled' };

    const container = containerManagerRef.getContainer(tab.containerId);
    if (!container) return { success: false, action: 'cancelled' };

    // 创建新窗口
    const newWindow = windowManagerRef.createMainWindow(tab.containerId, container);
    if (!newWindow) return { success: false, action: 'cancelled' };

    // 在新窗口创建 Tab
    const newTab = tabManagerRef.createTab(tab.containerId, tab.url, newWindow.id);

    // 从源窗口移除原 Tab
    tabManagerRef.closeTab(tabId);
    const sourceWin = BrowserWindow.fromId(sourceWindowId);
    if (sourceWin && !sourceWin.isDestroyed()) {
      sourceWin.webContents.send('tab:removed', { tabId });
    }

    // 通知新窗口
    newWindow.webContents.send('tab:created', { tab: newTab });
    newWindow.webContents.send('tab:switched', { tabId: newTab.id });

    return { success: true, action: 'new-window', newWindowId: newWindow.id };
  }

  if (action === 'move-to-window' && tabManagerRef && windowManagerRef && containerManagerRef) {
    // 移动到另一个窗口
    const targetWindowId = parseInt(data.targetWindowId, 10);
    if (!Number.isFinite(targetWindowId)) {
      return { success: false, action: 'cancelled' };
    }

    const tab = tabManagerRef.getTab(tabId);
    if (!tab) return { success: false, action: 'cancelled' };

    const targetWin = BrowserWindow.fromId(targetWindowId);
    if (!targetWin || targetWin.isDestroyed()) {
      return { success: false, action: 'cancelled' };
    }

    // 更新 Tab 的 windowId
    tabManagerRef.updateTab(tabId, { windowId: targetWindowId });

    // 通知源窗口移除 Tab UI
    const sourceWin = BrowserWindow.fromId(sourceWindowId);
    if (sourceWin && !sourceWin.isDestroyed()) {
      sourceWin.webContents.send('tab:removed', { tabId });
    }

    // 通知目标窗口创建 Tab UI
    const targetContainerId = windowManagerRef.getCurrentContainer(targetWindowId) || tab.containerId;
    targetWin.webContents.send('tab:created', { tab: { ...tab, windowId: targetWindowId } });
    targetWin.webContents.send('tab:switched', { tabId: tab.id });

    // 检查源窗口是否仅剩一个 Tab，如果是则自动销毁
    if (tabManagerRef && windowManagerRef) {
      const sourceTabs = tabManagerRef.getTabsByWindowId(sourceWindowId);
      if (sourceTabs.length === 0) {
        console.log(`[Realm DragCoordinator] 源窗口 ${sourceWindowId} 已无 Tab，自动销毁`);
        windowManagerRef.closeWindowWithTabs(sourceWindowId, tabManagerRef);
      }
    }

    return { success: true, action: 'move-to-window', targetWindowId };
  }

  return { success: true, action };
}

/**
 * 取消拖拽
 *
 * 渲染进程按 Escape 或松手时目标无效时调用。
 * 清除拖拽状态并广播，渲染进程收到后回滚 UI。
 *
 * @param {number} sourceWindowId - 来源窗口 ID（校验用）
 * @returns {{ success: boolean }}
 */
function cancelDrag(sourceWindowId) {
  if (!dragState.isDragging || dragState.sourceWindowId !== sourceWindowId) {
    return { success: false };
  }

  console.log(`[Realm DragCoordinator] 取消拖拽: Tab ${dragState.tabId}`);

  // 先广播取消状态，再清除（确保广播时 tabId/sourceWindowId 仍有效）
  broadcastDragState('cancelled');
  resetDragState();

  return { success: true };
}

/**
 * 重置拖拽状态到 idle
 * @private
 */
function resetDragState() {
  dragState.tabId = null;
  dragState.sourceWindowId = null;
  dragState.currentX = 0;
  dragState.currentY = 0;
  dragState.screenX = 0;
  dragState.screenY = 0;
  dragState.isDragging = false;
}

/**
 * 广播拖拽状态变化到所有窗口
 * 目标窗口收到后可以高亮 Tab 栏、显示插入位置线等
 *
 * @param {string} eventType - 事件类型：started/ended/cancelled
 * @private
 */
function broadcastDragState(eventType) {
  if (!windowManagerRef) return;

  windowManagerRef.broadcast('drag:state-changed', {
    type: eventType,
    tabId: dragState.tabId,
    sourceWindowId: dragState.sourceWindowId,
    screenX: dragState.screenX,
    screenY: dragState.screenY,
    // 使用 eventType 判断而非 dragState.isDragging，避免状态时序问题
    isDragging: eventType === 'started',
  });
}

module.exports = {
  setWindowManager,
  setTabManager,
  setContainerManager,
  getDragState,
  startDrag,
  updatePosition,
  endDrag,
  cancelDrag,
  detectTargetWindow,
  isDraggedOutOfTabBar,
};

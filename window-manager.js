/**
 * Realm Browser - 窗口管理模块
 *
 * 管理所有 BrowserWindow 实例的注册表（windows Map）和受信窗口集合（managedWindowIds Set），
 * 提供窗口生命周期管理、容器映射、受信窗口判断和跨窗口广播能力。
 *
 * 窗口位置持久化（Phase 36 Plan 01）：
 * - windowBoundsStore: electron-store 实例，存储每个容器的窗口位置和大小
 * - saveWindowBounds(): 实时保存窗口位置（moved/resized 事件触发）
 * - restoreWindowBounds(): 启动时恢复窗口位置（含越界检测）
 *
 * 数据结构：
 * - windows: Map<windowId, BrowserWindow> — 所有通过 createMainWindow 创建的窗口
 * - managedWindowIds: Set<number> — 受信窗口 ID 集合（仅包含 createMainWindow 创建的窗口）
 * - windowContainerMap: Map<number, string> — 窗口与容器的映射关系
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 窗口与容器的映射关系
// 键空间约定（CR-7）：一律使用 BrowserWindow.id 作为键。
// 注意：webContents.id（如 IPC event.sender.id）属于独立的计数空间，
// 与 BrowserWindow.id 不是同一套编号，读取侧必须先通过
// BrowserWindow.fromWebContents() 解析出窗口再取 win.id，禁止混用。
const windowContainerMap = new Map();

/** 窗口注册表：winId → BrowserWindow，所有通过 createMainWindow 创建的窗口 */
const windows = new Map();

/** 受信窗口 ID 集合：仅包含 createMainWindow 创建的窗口，用于 isManagedWindow 判断 */
const managedWindowIds = new Set();

/**
 * 窗口关闭处理器（由 main.js 经 setWindowCloseSetup 注入）
 * createMainWindow 创建窗口后统一挂载，保证 Cmd+N/菜单/Dock/拖出/
 * 新窗口打开等所有出口创建的窗口都有关闭级联逻辑（D-16）
 * @type {Function|null}
 */
let windowCloseSetup = null;

/**
 * 注入窗口关闭处理器（依赖注入，避免 window-manager 反向 require main.js）
 * @param {Function} fn - 接收 BrowserWindow 参数的 setup 函数
 */
function setWindowCloseSetup(fn) {
  windowCloseSetup = typeof fn === 'function' ? fn : null;
}

// ==================== 窗口位置持久化 ====================

/**
 * 窗口位置持久化存储（Phase 36 Plan 01）
 * key 格式：`container-${containerId}`，每个容器独立保存窗口位置
 * 存储内容：{ x, y, width, height, isMaximized, displayId }
 * @type {Store}
 */
const windowBoundsStore = new Store({ name: 'window-bounds' });

/**
 * 保存窗口位置和大小
 * 在窗口 moved/resized 事件触发时调用，实时持久化
 * @param {number} windowId - BrowserWindow.id
 * @param {string} containerId - 容器 ID
 */
function saveWindowBounds(windowId, containerId) {
  const win = BrowserWindow.fromId(windowId);
  if (!win || win.isDestroyed()) return;

  try {
    const bounds = win.getBounds();
    const isMaximized = win.isMaximized();
    const display = screen.getDisplayMatching(bounds);

    windowBoundsStore.set(`container-${containerId}`, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
      displayId: display.id,
    });
  } catch (err) {
    console.error(`[Realm] 保存窗口位置失败 (${containerId}):`, err.message);
  }
}

/**
 * 恢复窗口位置和大小
 * 启动时调用，检查持久化数据并验证是否在屏幕范围内
 * @param {string} containerId - 容器 ID
 * @returns {{ bounds: {x: number, y: number, width: number, height: number}, isMaximized: boolean } | null}
 */
function restoreWindowBounds(containerId) {
  try {
    const saved = windowBoundsStore.get(`container-${containerId}`);
    if (!saved || typeof saved !== 'object') return null;

    const { x, y, width, height, isMaximized } = saved;

    // 越界检测（D-34）：检查窗口中心点是否在任何显示器范围内
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const allDisplays = screen.getAllDisplays();
    const isInAnyDisplay = allDisplays.some(display => {
      const { x: dx, y: dy, width: dw, height: dh } = display.bounds;
      return centerX >= dx && centerX <= dx + dw && centerY >= dy && centerY <= dy + dh;
    });

    if (!isInAnyDisplay) {
      // 越界：居中到主显示器
      console.log(`[Realm] 窗口位置越界，居中到主显示器 (${containerId})`);
      const primary = screen.getPrimaryDisplay();
      const pb = primary.bounds;
      return {
        bounds: {
          x: Math.round(pb.x + (pb.width - width) / 2),
          y: Math.round(pb.y + (pb.height - height) / 2),
          width,
          height,
        },
        isMaximized: isMaximized || false,
      };
    }

    return {
      bounds: { x, y, width, height },
      isMaximized: isMaximized || false,
    };
  } catch (err) {
    console.error(`[Realm] 恢复窗口位置失败 (${containerId}):`, err.message);
    return null;
  }
}

/**
 * 创建主窗口
 * @param {string} containerId - 初始容器 ID
 * @param {Object} container - 容器配置对象（必须包含 session）
 * @param {Object} [options] - 额外选项
 * @param {boolean} [options.offsetPosition=false] - 是否相对于当前活动窗口偏移位置
 * @param {boolean} [options.injectedTabs=false] - 主进程将为本窗口预注入 Tab
 *   （右键「在新窗口中打开」/拖出新窗口）。经 loadFile query（?injected=1）告知
 *   renderer：restoreTabs 跳过「启动恢复」分支直接渲染注入的 Tab，
 *   避免 restoreTabsOnLaunch='never' 时 clearAllTabs 把注入的 Tab 清掉
 * @returns {BrowserWindow|undefined} 创建的窗口实例
 */
function createMainWindow(containerId, container, options = {}) {
  if (!container || !container.session) {
    console.error(`[Realm] 无效的容器配置: ${containerId}`);
    return undefined;
  }

  // 尝试恢复上次窗口位置（仅在非偏移模式下恢复）
  const restoredBounds = options.offsetPosition ? null : restoreWindowBounds(containerId);

  const windowOptions = {
    width: restoredBounds ? restoredBounds.bounds.width : 1400,
    height: restoredBounds ? restoredBounds.bounds.height : 900,
    minWidth: 400,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 启用 <webview> 标签（Electron 5+ 起默认为 false，必须显式开启）
      webviewTag: true,
      // 使用容器独立的 session
      session: container.session,
    },
  };

  // 如果有恢复数据，设置位置
  if (restoredBounds) {
    windowOptions.x = restoredBounds.bounds.x;
    windowOptions.y = restoredBounds.bounds.y;
  } else if (options.offsetPosition) {
    // 新窗口相对于当前活动窗口偏移位置
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && !focusedWindow.isDestroyed()) {
      const bounds = focusedWindow.getBounds();
      windowOptions.x = bounds.x + 30;
      windowOptions.y = bounds.y + 30;
    }
  }

  const mainWindow = new BrowserWindow(windowOptions);

  // 注册到窗口注册表、受信窗口集合和容器映射
  windows.set(mainWindow.id, mainWindow);
  managedWindowIds.add(mainWindow.id);
  windowContainerMap.set(mainWindow.id, containerId);

  // 统一挂载窗口关闭处理器（D-15 活跃任务确认 / D-16 级联关闭 Tab）：
  // 此前只有启动主窗口挂了该处理器，次级窗口点红按钮直接关闭，
  // 不级联清理 tabManager 元数据，留下 windowId 指向死窗口的幽灵 Tab
  if (windowCloseSetup) {
    windowCloseSetup(mainWindow);
  }

  // 恢复最大化状态
  if (restoredBounds && restoredBounds.isMaximized) {
    mainWindow.maximize();
  }

  // 加载 UI（WR-11：使用绝对路径——打包后进程 CWD 不保证为应用目录，相对路径会白屏）
  // 注入窗口带 query 标记，renderer 的 restoreTabs 据此跳过启动恢复分支
  mainWindow.loadFile(
    path.join(__dirname, 'src/index.html'),
    options.injectedTabs ? { query: { injected: '1' } } : undefined
  );

  // 窗口关闭时清理三个数据结构
  mainWindow.on('closed', () => {
    windows.delete(mainWindow.id);
    managedWindowIds.delete(mainWindow.id);
    windowContainerMap.delete(mainWindow.id);
  });

  return mainWindow;
}

/**
 * 获取当前窗口的容器 ID
 * @param {number} windowId - 窗口 ID
 * @returns {string} 容器 ID，默认返回 'default'
 */
function getCurrentContainer(windowId) {
  return windowContainerMap.get(windowId) || 'default';
}

/**
 * 切换窗口的容器
 * @param {number} windowId - 窗口 ID
 * @param {string} containerId - 目标容器 ID
 * @param {Object} container - 容器配置对象
 * @returns {boolean} 切换是否成功
 */
function switchContainer(windowId, containerId, container) {
  if (!container) {
    console.error(`[Realm] 容器不存在: ${containerId}`);
    return false;
  }

  // 更新映射
  windowContainerMap.set(windowId, containerId);

  // 通知渲染进程容器已切换
  const win = BrowserWindow.fromId(windowId);
  if (win) {
    win.webContents.send('container-switched', {
      containerId: containerId,
      container: {
        id: container.id,
        name: container.name,
        color: container.color,
        icon: container.icon,
      },
    });
  }

  return true;
}

/**
 * 获取主窗口（兼容现有 30+ 处调用）
 * 从 windows 注册表中获取第一个未销毁的窗口。
 * 使用显式注册表而非 getAllWindows()[0]——后者顺序随焦点/创建变化，
 * 播放器等辅助窗口存在时会把辅助窗口误判为主窗口，
 * 导致 assertTrustedSender 拒绝主窗口的合法 IPC（CR-4 校验失效抖动）
 * @returns {BrowserWindow|null} 主窗口实例
 */
function getMainWindow() {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) return win;
  }
  return null;
}

/**
 * 判断指定窗口是否为 Realm 管理的窗口
 * 用于 assertTrustedSender 泛化（Plan 02 依赖）和快捷键派发校验
 * @param {number} winId - BrowserWindow.id
 * @returns {boolean} 是否为受信的 managed 窗口
 */
function isManagedWindow(winId) {
  return managedWindowIds.has(winId);
}

/**
 * 获取指定 ID 的窗口实例
 * @param {number} windowId - 窗口 ID
 * @returns {Electron.BrowserWindow|null} 窗口实例（不存在或已销毁返回 null）
 */
function getWindow(windowId) {
  const win = windows.get(windowId);
  return win && !win.isDestroyed() ? win : null;
}

/**
 * 向所有未销毁的窗口广播 IPC 消息
 * 替代原来 mainWindow.webContents.send() 的单窗口发送模式，
 * 确保多窗口场景下所有窗口都能收到事件通知（如容器切换、书签刷新等）
 * @param {string} channel - IPC 通道名
 * @param {...*} args - 传递给渲染进程的参数
 */
function broadcast(channel, ...args) {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

/**
 * 关闭窗口并级联销毁其所有 Tab（Phase 35 D-16）
 *
 * 销毁顺序（D-16）：先销毁 Tab webContents，再销毁窗口本身，
 * 避免 webContents 残留（T-35-03）。
 * 使用 win.destroy() 而非 win.close()，避免在 close 事件中递归（Pitfall 1）。
 *
 * @param {number} windowId - 窗口 ID
 * @param {Object} [tabManager] - tabManager 模块实例（依赖注入，避免模块互相 require）
 * @returns {boolean} 是否成功关闭
 */
function closeWindowWithTabs(windowId, tabManager) {
  const win = BrowserWindow.fromId(windowId);

  // 如果窗口已销毁或不存在，只清理 Tab 状态
  if (!win || win.isDestroyed()) {
    if (tabManager) {
      tabManager.closeTabsByWindowId(windowId);
    }
    return true;
  }

  // 清理 Tab 元数据；渲染进程中 webview 的 webContents 由 Electron 在
  // win.destroy() 时级联销毁，无需单独通知渲染进程清理
  if (tabManager) {
    tabManager.closeTabsByWindowId(windowId);
  }

  // 使用 win.destroy() 销毁窗口，不触发 close 事件，避免递归
  win.destroy();

  console.log(`[Realm] 窗口 ${windowId} 已关闭（含所有 Tab）`);
  return true;
}

/**
 * 获取当前存活的托管窗口数量
 * 用于"关闭窗口最后一个 Tab 时是否销毁窗口"的判断：
 * 仅剩一个窗口时保持创建新 Tab 的现行为，多窗口时才销毁
 *
 * @returns {number} 托管窗口数
 */
function getWindowCount() {
  let count = 0;
  for (const win of windows.values()) {
    if (!win.isDestroyed()) count++;
  }
  return count;
}

/**
 * 查找指定屏幕坐标所在的托管窗口
 *
 * 遍历所有托管窗口，检查屏幕坐标是否落入窗口边界内。
 * 用于拖拽场景下检测鼠标是否在某个窗口上。
 *
 * @param {number} screenX - 屏幕坐标 X
 * @param {number} screenY - 屏幕坐标 Y
 * @param {number} [excludeWindowId] - 排除的窗口 ID（通常是拖拽源窗口）
 * @returns {{ windowId: number, inTabBar: boolean, bounds: Electron.Rectangle }|null}
 */
function findWindowAtScreenPosition(screenX, screenY, excludeWindowId) {
  // Tab 栏高度（与 CSS .tab-bar height 和 drag-coordinator.js:130 保持同步）
  const TAB_BAR_HEIGHT = 38;

  for (const [winId, win] of windows) {
    if (winId === excludeWindowId) continue;
    if (win.isDestroyed()) continue;

    const bounds = win.getBounds();

    if (
      screenX >= bounds.x &&
      screenX <= bounds.x + bounds.width &&
      screenY >= bounds.y &&
      screenY <= bounds.y + bounds.height
    ) {
      const inTabBar = screenY <= bounds.y + TAB_BAR_HEIGHT;
      return { windowId: winId, inTabBar, bounds };
    }
  }

  return null;
}

module.exports = {
  createMainWindow,
  getMainWindow,
  getCurrentContainer,
  switchContainer,
  isManagedWindow,
  getWindow,
  broadcast,
  closeWindowWithTabs,
  getWindowCount,
  setWindowCloseSetup,
  saveWindowBounds,
  restoreWindowBounds,
  findWindowAtScreenPosition,
};

/**
 * Realm Browser - 窗口管理模块
 *
 * 管理所有 BrowserWindow 实例的注册表（windows Map）和受信窗口集合（managedWindowIds Set），
 * 提供窗口生命周期管理、容器映射、受信窗口判断和跨窗口广播能力。
 *
 * 数据结构：
 * - windows: Map<windowId, BrowserWindow> — 所有通过 createMainWindow 创建的窗口
 * - managedWindowIds: Set<number> — 受信窗口 ID 集合（仅包含 createMainWindow 创建的窗口）
 * - windowContainerMap: Map<number, string> — 窗口与容器的映射关系
 */

const { BrowserWindow } = require('electron');
const path = require('path');

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
 * 创建主窗口
 * @param {string} containerId - 初始容器 ID
 * @param {Object} container - 容器配置对象（必须包含 session）
 * @returns {BrowserWindow|undefined} 创建的窗口实例
 */
function createMainWindow(containerId, container) {
  if (!container || !container.session) {
    console.error(`[Realm] 无效的容器配置: ${containerId}`);
    return undefined;
  }

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
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
  });

  // 注册到窗口注册表、受信窗口集合和容器映射
  windows.set(mainWindow.id, mainWindow);
  managedWindowIds.add(mainWindow.id);
  windowContainerMap.set(mainWindow.id, containerId);

  // 加载 UI（WR-11：使用绝对路径——打包后进程 CWD 不保证为应用目录，相对路径会白屏）
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

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

  // 通知渲染进程窗口即将关闭，让其有机会清理 webview webContents（best-effort, 非阻塞）
  if (!win.webContents.isDestroyed()) {
    win.webContents.send('window:closing', { windowId });
  }

  // 先销毁 Tab 的 webContents（通过渲染进程通知或直接操作）
  // 级联关闭该窗口的所有 Tab 状态
  if (tabManager) {
    tabManager.closeTabsByWindowId(windowId);
  }

  // 使用 win.destroy() 销毁窗口，不触发 close 事件，避免递归
  win.destroy();

  console.log(`[Realm] 窗口 ${windowId} 已关闭（含所有 Tab）`);
  return true;
}

module.exports = {
  createMainWindow,
  getMainWindow,
  getCurrentContainer,
  switchContainer,
  isManagedWindow,
  broadcast,
  closeWindowWithTabs,
};

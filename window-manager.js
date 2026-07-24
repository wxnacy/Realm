/**
 * Realm Browser - 窗口管理模块
 *
 * 管理 BrowserWindow 实例和窗口与容器的映射关系
 */

const { BrowserWindow } = require('electron');
const path = require('path');

// 窗口与容器的映射关系
const windowContainerMap = new Map();

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

  // 记录窗口与容器的映射
  windowContainerMap.set(mainWindow.id, containerId);

  // 加载 UI
  mainWindow.loadFile('src/index.html');

  // 打开开发者工具（开发模式）
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 窗口关闭时清理映射
  mainWindow.on('closed', () => {
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
 * 获取主窗口
 * @returns {BrowserWindow|undefined} 主窗口实例
 */
function getMainWindow() {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : undefined;
}

module.exports = {
  createMainWindow,
  getMainWindow,
  getCurrentContainer,
  switchContainer,
};

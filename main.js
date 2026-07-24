/**
 * Realm Browser - 主进程入口
 *
 * 应用生命周期管理，模块组装
 */

// 热重载配置（仅开发模式）
try { require('electron-reloader')(module); } catch {}

const { app, BrowserWindow } = require('electron');
const containerManager = require('./container-manager');
const windowManager = require('./window-manager');
const tabManager = require('./tab-manager');
const cookieManager = require('./cookie-manager');
const assignmentRules = require('./assignment-rules');
const shortcutManager = require('./shortcut-manager');
const { registerHandlers } = require('./ipc-handlers');

// ==================== 应用启动 ====================

app.whenReady().then(async () => {
  console.log('[Realm] 应用启动');

  // 注册 IPC 处理器
  registerHandlers();

  // 初始化容器
  containerManager.initContainers();

  // 加载所有容器的 Cookie
  await cookieManager.loadAllCookies();

  // 初始化规则管理器
  assignmentRules.initRules();

  // 初始化 Tab 管理器
  tabManager.initTabs();

  // 获取默认容器并创建主窗口
  const defaultContainer = containerManager.getContainer('default');
  const mainWindow = windowManager.createMainWindow('default', defaultContainer);

  // 注册全局快捷键
  if (mainWindow) {
    shortcutManager.registerShortcuts(mainWindow);
  }

  // macOS 应用激活事件
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const defaultContainer = containerManager.getContainer('default');
      const mainWindow = windowManager.createMainWindow('default', defaultContainer);
      if (mainWindow) {
        shortcutManager.registerShortcuts(mainWindow);
      }
    }
  });
});

// 所有窗口关闭事件
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前保存所有容器的 Cookie
app.on('before-quit', async () => {
  console.log('[Realm] 应用退出，保存 Cookie...');
  await cookieManager.saveAllCookies();
});

// 应用即将退出时注销快捷键
app.on('will-quit', () => {
  shortcutManager.unregisterAll();
});

// 日志输出
console.log('[Realm] 主进程已加载');

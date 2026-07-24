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

// ==================== webview guest 拦截（WR-1/WR-2/WR-9） ====================

/**
 * URL scheme 白名单：仅 http/https 允许加载/新建 Tab（WR-9）
 * guest 侧提供的 URL（window.open、导航）一律先过此白名单
 * @param {string} url - 待校验的 URL
 * @returns {boolean} 是否允许
 */
function isAllowedWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

/**
 * 从 webview guest 的 webContents 反推其所在容器 ID
 * 渲染进程创建 webview 时统一设置 partition 为 persist:container-<containerId>
 * @param {Electron.WebContents} contents - guest webContents
 * @returns {string|null} 容器 ID，无法识别时返回 null
 */
function getGuestContainerId(contents) {
  const partition = contents.session && contents.session.getPartition
    ? contents.session.getPartition()
    : '';
  const prefix = 'persist:container-';
  return partition.startsWith(prefix) ? partition.slice(prefix.length) : null;
}

/**
 * 通知渲染进程在指定容器新建 Tab（经 host webContents 转发）
 * @param {Electron.WebContents} contents - guest webContents
 * @param {string} url - 目标 URL（已过白名单校验才发送）
 * @param {string|null} containerId - 目标容器 ID
 */
function notifyOpenUrlInTab(contents, url, containerId) {
  if (!isAllowedWebUrl(url)) return;
  const host = contents.hostWebContents;
  if (host && !host.isDestroyed()) {
    host.send('open-url-in-tab', { url, containerId });
  }
}

// WR-1：Electron 32 已移除 webview 的 new-window 事件，
// guest 页面 target=_blank / window.open 必须在主进程用 setWindowOpenHandler 拦截：
// 一律 deny 独立窗口，改为通知渲染进程在 guest 所在容器新建 Tab（D-09）
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() !== 'webview') return;

  contents.setWindowOpenHandler(({ url }) => {
    notifyOpenUrlInTab(contents, url, getGuestContainerId(contents));
    return { action: 'deny' };
  });

  // WR-2：webContents 的 will-navigate 可同步取消（webview 标签上的同名事件
  // 文档明示 preventDefault 无效）。分配规则命中其他容器时，同步取消当前导航
  // 并通知渲染进程在匹配容器新建 Tab，避免同一页面出现在两个容器。
  contents.on('will-navigate', (event, url) => {
    // WR-9 纵深防御：非 http(s) 导航一律拦截（about:blank 等内部页放行）
    if (!isAllowedWebUrl(url) && url !== 'about:blank') {
      event.preventDefault();
      return;
    }

    const matchedContainer = assignmentRules.matchUrl(url);
    if (matchedContainer && matchedContainer !== getGuestContainerId(contents)) {
      event.preventDefault();
      console.log(`[Realm] 规则匹配: ${url} -> ${matchedContainer}`);
      notifyOpenUrlInTab(contents, url, matchedContainer);
    }
  });
});

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
        // WR-8：重建窗口前先注销全部已注册的全局快捷键。
        // shortcutManager 的 isRegistered 检查会跳过已注册 accelerator，
        // 旧回调闭包仍持有已销毁窗口的引用，导致新窗口永远收不到 shortcut:triggered
        shortcutManager.unregisterAll();
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

// 应用退出前保存所有容器的 Cookie（WR-6）
// before-quit 不会等待 async handler 返回，必须先 preventDefault 阻止退出，
// 待 Cookie 写盘完成后再显式 app.quit()，避免退出竞态导致数据丢失
let cookiesSaved = false;
app.on('before-quit', async (event) => {
  if (cookiesSaved) return;
  event.preventDefault();
  console.log('[Realm] 应用退出，保存 Cookie...');
  await cookieManager.saveAllCookies();
  cookiesSaved = true;
  app.quit();
});

// 应用即将退出时注销快捷键
app.on('will-quit', () => {
  shortcutManager.unregisterAll();
});

// 日志输出
console.log('[Realm] 主进程已加载');

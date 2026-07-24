/**
 * Realm Browser - 快捷键管理模块
 *
 * 使用 globalShortcut 实现应用快捷键。
 * 快捷键在应用运行期间全局生效，即使应用不在前台也会响应。
 *
 * 工作原理：
 * - 使用 globalShortcut.register() 注册全局快捷键
 * - 快捷键触发时通过 IPC 通知渲染进程执行对应操作
 * - 快捷键变更时调用 rebuildShortcuts() 重新注册
 */

const { globalShortcut } = require('electron');
const Store = require('electron-store');

// ==================== 存储 ====================

/** 快捷键持久化存储实例 */
const store = new Store({ name: 'shortcuts' });

/** 当前窗口引用，用于发送 IPC 消息 */
let currentWindow = null;

/** 当前注册的快捷键列表 */
let registeredShortcuts = [];

// ==================== 默认配置 ====================

/**
 * 默认快捷键配置
 * 键为操作名称，值为 Electron Accelerator 格式字符串
 */
const DEFAULT_SHORTCUTS = {
  'newTab': 'CmdOrCtrl+T',
  'closeTab': 'CmdOrCtrl+W',
  'nextTab': 'CmdOrCtrl+Shift+]',
  'prevTab': 'CmdOrCtrl+Shift+[',
  'reload': 'CmdOrCtrl+R',
  'back': 'CmdOrCtrl+Left',
  'forward': 'CmdOrCtrl+Right',
};

// ==================== 读写函数 ====================

/**
 * 获取当前快捷键配置（合并默认与自定义）
 * @returns {Object} 快捷键配置对象
 */
function getShortcuts() {
  const customShortcuts = store.get('shortcuts', {});
  return { ...DEFAULT_SHORTCUTS, ...customShortcuts };
}

/**
 * 获取指定操作的快捷键
 * @param {string} action - 操作名称
 * @returns {string|null} 快捷键字符串，不存在时返回 null
 */
function getShortcut(action) {
  const shortcuts = getShortcuts();
  return shortcuts[action] || null;
}

/**
 * 设置快捷键
 * @param {string} action - 操作名称
 * @param {string} accelerator - 快捷键（Electron Accelerator 格式）
 * @returns {boolean} 是否设置成功
 */
function setShortcut(action, accelerator) {
  // 验证操作名称
  if (!DEFAULT_SHORTCUTS.hasOwnProperty(action)) {
    return false;
  }

  // 保存自定义快捷键
  const customShortcuts = store.get('shortcuts', {});
  customShortcuts[action] = accelerator;
  store.set('shortcuts', customShortcuts);

  console.log(`[Realm] 设置快捷键: ${action} -> ${accelerator}`);

  return true;
}

// ==================== 快捷键注册 ====================

/**
 * 注册所有全局快捷键
 * @param {BrowserWindow} window - 接收 shortcut:triggered IPC 的窗口
 */
function registerShortcuts(window) {
  currentWindow = window;

  // 先注销所有已注册的快捷键
  unregisterAll();

  const shortcuts = getShortcuts();

  Object.entries(shortcuts).forEach(([action, accelerator]) => {
    try {
      const ret = globalShortcut.register(accelerator, () => {
        console.log(`[Realm] 快捷键触发: ${action} (${accelerator})`);

        if (currentWindow && !currentWindow.isDestroyed()) {
          currentWindow.webContents.send('shortcut:triggered', action);
        }
      });

      if (ret) {
        registeredShortcuts.push(accelerator);
        console.log(`[Realm] 快捷键注册成功: ${action} -> ${accelerator}`);
      } else {
        console.error(`[Realm] 快捷键注册失败: ${action} -> ${accelerator}`);
      }
    } catch (error) {
      console.error(`[Realm] 快捷键注册异常: ${action} -> ${accelerator}`, error.message);
    }
  });

  console.log('[Realm] 快捷键注册完成');
}

/**
 * 重新注册快捷键（配置变更后调用）
 * @param {BrowserWindow} [window] - 可选的新窗口引用
 */
function rebuildShortcuts(window) {
  if (window) {
    currentWindow = window;
  }

  if (!currentWindow || currentWindow.isDestroyed()) {
    console.error('[Realm] rebuildShortcuts 失败：无可用窗口');
    return;
  }

  registerShortcuts(currentWindow);
  console.log('[Realm] 快捷键已重建');
}

/**
 * 注销所有全局快捷键
 */
function unregisterAll() {
  globalShortcut.unregisterAll();
  registeredShortcuts = [];
  console.log('[Realm] 注销所有快捷键');
}

// ==================== 模块导出 ====================

module.exports = {
  DEFAULT_SHORTCUTS,
  getShortcuts,
  getShortcut,
  setShortcut,
  registerShortcuts,
  rebuildShortcuts,
  unregisterAll,
};

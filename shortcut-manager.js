/**
 * Realm Browser - 快捷键管理模块
 *
 * 使用 Menu.accelerator 实现应用内快捷键（仅窗口获焦时生效）。
 * 相比 globalShortcut，Menu 方案不会与系统或其他应用冲突（D-05/D-06/D-07）。
 *
 * 工作原理：
 * - 创建一个隐藏的 Application Menu，每个菜单项绑定一个 accelerator
 * - 菜单项的 click 回调通过 IPC 通知渲染进程执行对应操作
 * - 快捷键变更时调用 rebuildMenu() 重建菜单即可热更新，无需重启应用
 */

const { Menu } = require('electron');
const Store = require('electron-store');

// ==================== 存储 ====================

/** 快捷键持久化存储实例 */
const store = new Store({ name: 'shortcuts' });

/** 当前窗口引用，用于 rebuildMenu 时重建菜单 */
let currentWindow = null;

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

// ==================== 读写函数（保持不变） ====================

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

// ==================== 菜单构建 ====================

/**
 * 根据当前快捷键配置构建隐藏菜单模板
 *
 * 菜单结构：
 *   [_shortcuts (visible: false)]
 *     ├── newTab    (CmdOrCtrl+T)
 *     ├── closeTab  (CmdOrCtrl+W)
 *     └── ...
 *
 * macOS 应用菜单第一个菜单项会被系统占用（显示应用名），
 * 因此在前面插入一个占位的 app 菜单项以避免快捷键菜单项被吞掉。
 *
 * @param {BrowserWindow} window - 接收 shortcut:triggered IPC 的窗口
 * @returns {Electron.MenuItemConstructorOptions[]} 菜单模板数组
 */
function buildMenuTemplate(window) {
  const shortcuts = getShortcuts();

  // 构建快捷键菜单项
  const shortcutItems = Object.entries(shortcuts).map(([action, accelerator]) => ({
    label: action,
    accelerator: accelerator,
    visible: false,
    click: () => {
      console.log(`[Realm] 快捷键触发: ${action} (${accelerator})`);
      if (window && !window.isDestroyed()) {
        window.webContents.send('shortcut:triggered', action);
      }
    },
  }));

  // macOS 占位菜单：确保快捷键菜单不被系统菜单项占用
  return [
    {
      label: 'Realm',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '_shortcuts',
      visible: false,
      submenu: shortcutItems,
    },
  ];
}

// ==================== 公共 API ====================

/**
 * 注册快捷键 — 构建并设置应用菜单
 *
 * 在 app.whenReady() 且窗口创建后调用。
 * 设置 Application Menu 后，快捷键仅在应用窗口获焦时生效（D-05）。
 *
 * @param {BrowserWindow} window - 主窗口
 */
function registerShortcuts(window) {
  currentWindow = window;

  const template = buildMenuTemplate(window);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  console.log('[Realm] 快捷键注册完成（Menu Accelerator）');
}

/**
 * 重建菜单 — 快捷键配置变更后调用
 *
 * 当用户修改快捷键后，调用此函数即可热更新菜单，无需重启应用。
 * 内部会使用当前窗口引用重建整个 Application Menu。
 *
 * @param {BrowserWindow} [window] - 可选的新窗口引用，不传则使用缓存的窗口
 */
function rebuildMenu(window) {
  if (window) {
    currentWindow = window;
  }

  if (!currentWindow || currentWindow.isDestroyed()) {
    console.error('[Realm] rebuildMenu 失败：无可用窗口');
    return;
  }

  const template = buildMenuTemplate(currentWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  console.log('[Realm] 快捷键菜单已重建');
}

// ==================== 模块导出 ====================

module.exports = {
  DEFAULT_SHORTCUTS,
  getShortcuts,
  getShortcut,
  setShortcut,
  registerShortcuts,
  rebuildMenu,
};

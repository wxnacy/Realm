/**
 * Realm Browser - 快捷键管理模块
 *
 * 使用 webContents 的 before-input-event 实现「仅应用内」快捷键：
 * 仅在应用（含其 webview）获得焦点时响应，应用退到后台时不占用系统快捷键。
 *
 * 工作原理：
 * - 通过 app.on('web-contents-created') 给每个 webContents（主窗口 + 各 webview guest）
 *   挂上 before-input-event 监听
 * - 按键时与当前快捷键表（getShortcuts）做精确匹配，命中才 preventDefault 并
 *   向主窗口发送 shortcut:triggered，由渲染进程分发到对应动作
 * - 不命中时完全不拦截，避免干扰系统/网页自身的快捷键（如 Cmd+C/V/A）
 * - 快捷键配置变更后无需重新注册，匹配时实时读取最新配置
 */

const { app } = require('electron');
const Store = require('electron-store');

// ==================== 存储 ====================

/** 快捷键持久化存储实例 */
const store = new Store({ name: 'shortcuts' });

/** 当前主窗口引用，用于发送 shortcut:triggered IPC */
let currentWindow = null;

/** 已挂监听器的 webContents（避免重复绑定） */
const attachedWebContents = new WeakSet();

/** app 级 web-contents-created 监听器是否已挂 */
let appListenerAttached = false;

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
  'bookmark': 'CmdOrCtrl+D',
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
  if (!DEFAULT_SHORTCUTS.hasOwnProperty(action)) {
    return false;
  }

  const customShortcuts = store.get('shortcuts', {});
  customShortcuts[action] = accelerator;
  store.set('shortcuts', customShortcuts);

  console.log(`[Realm] 设置快捷键: ${action} -> ${accelerator}`);
  return true;
}

// ==================== Accelerator 匹配 ====================

/** Accelerator 键名 → KeyboardEvent.key 小写形式 */
const KEY_NAME_MAP = {
  'left': 'arrowleft',
  'right': 'arrowright',
  'up': 'arrowup',
  'down': 'arrowdown',
  'esc': 'escape',
  'return': 'enter',
  'space': ' ',
  'plus': '+',
  'minus': '-',
};

/** KeyboardEvent.code 小写形式 → 对应字符（用于 Shift 修饰下 key 变为符号的场景） */
const CODE_TO_CHAR = {
  'bracketleft': '[',
  'bracketright': ']',
  'comma': ',',
  'period': '.',
  'slash': '/',
  'backslash': '\\',
  'backquote': '`',
  'semicolon': ';',
  'quote': "'",
  'equal': '=',
  'minus': '-',
};

/**
 * 解析 Accelerator 字符串为结构化对象
 * @param {string} accelerator - 如 "CmdOrCtrl+Shift+]"
 * @returns {{key: string, meta: boolean, ctrl: boolean, alt: boolean, shift: boolean}|null}
 */
function parseAccelerator(accelerator) {
  if (!accelerator || typeof accelerator !== 'string') return null;

  const parts = accelerator.split('+').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const isMac = process.platform === 'darwin';
  const keyToken = parts[parts.length - 1].toLowerCase();
  const mods = new Set(parts.slice(0, -1).map(m => m.toLowerCase()));

  return {
    key: KEY_NAME_MAP[keyToken] || keyToken,
    meta: mods.has('cmd') || mods.has('command') || mods.has('super') || (mods.has('cmdorctrl') && isMac),
    ctrl: mods.has('ctrl') || mods.has('control') || (mods.has('cmdorctrl') && !isMac),
    alt: mods.has('alt') || mods.has('option'),
    shift: mods.has('shift'),
  };
}

/**
 * 判断 before-input-event 的 input 是否命中给定 Accelerator
 * @param {Object} input - Electron before-input-event 的 input 对象
 * @param {Object} accel - parseAccelerator 返回的结构
 * @returns {boolean}
 */
function matchInput(input, accel) {
  if (input.type !== 'keyDown') return false;

  if (!!input.meta !== accel.meta) return false;
  if (!!input.control !== accel.ctrl) return false;
  if (!!input.alt !== accel.alt) return false;
  if (!!input.shift !== accel.shift) return false;

  const ik = (input.key || '').toLowerCase();
  if (ik === accel.key) return true;

  // 通过 code 兜底匹配（如 Shift+] 时 input.key 是 '}'，但 code 仍是 BracketRight）
  const ic = (input.code || '').toLowerCase();
  if (CODE_TO_CHAR[ic] === accel.key) return true;
  if (ic.startsWith('key') && ic.slice(3) === accel.key) return true;
  if (ic.startsWith('digit') && ic.slice(5) === accel.key) return true;

  return false;
}

/**
 * 在当前快捷键表中查找匹配 input 的 action
 * @param {Object} input - Electron before-input-event 的 input 对象
 * @returns {string|null} 命中的 action，未命中返回 null
 */
function findMatchingAction(input) {
  if (input.type !== 'keyDown') return null;

  const shortcuts = getShortcuts();
  for (const [action, accelerator] of Object.entries(shortcuts)) {
    const accel = parseAccelerator(accelerator);
    if (accel && matchInput(input, accel)) {
      return action;
    }
  }
  return null;
}

// ==================== webContents 监听 ====================

/**
 * 给指定 webContents 挂 before-input-event 监听（幂等）
 * @param {WebContents} contents
 */
function attachInputListener(contents) {
  if (!contents || contents.isDestroyed()) return;
  if (attachedWebContents.has(contents)) return;
  attachedWebContents.add(contents);

  contents.on('before-input-event', (event, input) => {
    const action = findMatchingAction(input);
    if (!action) return; // 未命中：完全不拦截

    event.preventDefault();

    if (currentWindow && !currentWindow.isDestroyed()) {
      currentWindow.webContents.send('shortcut:triggered', action);
    }
  });
}

/**
 * 确保 app 级 web-contents-created 监听已挂（幂等）。
 * 之后所有新创建的 webContents（主窗口、各 webview guest）都会自动挂监听。
 */
function ensureAppListener() {
  if (appListenerAttached) return;
  appListenerAttached = true;

  app.on('web-contents-created', (_event, contents) => {
    const type = contents.getType();
    if (type === 'window' || type === 'webview') {
      attachInputListener(contents);
    }
  });
}

// ==================== 快捷键注册 ====================

/**
 * 启用应用内快捷键（仅当前应用聚焦时生效）
 * @param {BrowserWindow} window - 接收 shortcut:triggered IPC 的主窗口
 */
function registerShortcuts(window) {
  currentWindow = window;

  ensureAppListener();

  if (window && !window.isDestroyed()) {
    attachInputListener(window.webContents);
  }

  console.log('[Realm] 应用内快捷键已启用（before-input-event）');
}

/**
 * 快捷键配置变更后调用。
 * 由于匹配时实时读取 getShortcuts()，无需重新绑定监听器；
 * 此处仅更新主窗口引用（如有）。
 * @param {BrowserWindow} [window] - 可选的新主窗口引用
 */
function rebuildShortcuts(window) {
  if (window) {
    currentWindow = window;
  }

  if (!currentWindow || currentWindow.isDestroyed()) {
    console.error('[Realm] rebuildShortcuts 失败：无可用窗口');
    return;
  }

  attachInputListener(currentWindow.webContents);
  console.log('[Realm] 快捷键配置已生效（应用内）');
}

/**
 * 应用退出前调用：解除主窗口引用。
 * before-input-event 监听随 webContents 销毁自动清理，无需显式移除。
 */
function unregisterAll() {
  currentWindow = null;
  console.log('[Realm] 解除快捷键目标窗口');
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

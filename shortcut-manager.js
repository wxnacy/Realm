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
 *   向焦点窗口（BrowserWindow.getFocusedWindow()）发送 shortcut:triggered，
 *   由渲染进程分发到对应动作
 * - 非 Realm 管理的窗口（如播放器）仅处理 closeTab 特殊语义（D-13），其余放行
 * - 不命中时完全不拦截，避免干扰系统/网页自身的快捷键（如 Cmd+C/V/A）
 * - 快捷键配置变更后无需重新注册，匹配时实时读取最新配置
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');
const windowManager = require('./window-manager');
const { VimStateMachine, isVimEnabled } = require('./src/vimium/vimium-manager');

// ==================== 存储 ====================

/** 快捷键持久化存储实例 */
const store = new Store({ name: 'shortcuts' });

/** 已挂监听器的 webContents（避免重复绑定） */
const attachedWebContents = new WeakSet();

// ==================== Vim 快捷键状态 ====================

/** 设置存储实例（读取 realm-config.json 的 settings.vimium.enabled） */
const settingsStore = new Store({ name: 'realm-config', watch: true });

/** Hint Mode 激活状态（由 renderer 通过 IPC 同步） */
let hintModeActive = false;

/**
 * 搜索输入激活状态
 * 在派发 searchMode 命令时由主进程同步置位（不等 renderer IPC，消除按键竞态），
 * 由 renderer 在搜索确认（Enter）/退出（Escape）后通过 IPC 清除。
 * 激活期间主进程跳过所有 Vim 命令处理，按键直达 guest 搜索输入框。
 */
let searchInputActive = false;

/**
 * 设置 Hint Mode 激活状态
 * 当 hint mode 激活时，主进程跳过所有 Vim 命令处理，由 guest 内部独立接管按键
 * @param {boolean} active
 */
function setHintModeActive(active) {
  hintModeActive = active;
}

/**
 * 设置搜索输入激活状态
 * @param {boolean} active
 */
function setSearchInputActive(active) {
  searchInputActive = active;
}

/**
 * 每个 webContents 的输入框焦点状态
 * key: webContents.id, value: boolean（true 表示焦点在输入框中）
 * @type {Map<number, boolean>}
 */
const vimFocusStates = new Map();

/** app 级 web-contents-created 监听器是否已挂 */
let appListenerAttached = false;

// ==================== 默认配置 ====================

/**
 * 默认快捷键配置
 * 键为操作名称，值为 Electron Accelerator 格式字符串
 */
const DEFAULT_SHORTCUTS = {
  'newWindow': 'CmdOrCtrl+N',
  'closeWindow': 'CmdOrCtrl+Shift+W',
  'newTab': 'CmdOrCtrl+T',
  'closeTab': 'CmdOrCtrl+W',
  'nextTab': 'CmdOrCtrl+Shift+]',
  'prevTab': 'CmdOrCtrl+Shift+[',
  'reload': 'CmdOrCtrl+R',
  'hardReload': 'CmdOrCtrl+Shift+R',
  'back': 'CmdOrCtrl+Left',
  'forward': 'CmdOrCtrl+Right',
  'bookmark': 'CmdOrCtrl+D',
  'openSettings': 'CmdOrCtrl+,',
  'openHistory': 'CmdOrCtrl+Y',
  'openFavorites': 'CmdOrCtrl+B',
  'toggleAIPanel': 'CmdOrCtrl+]',
  'toggleSidebar': 'CmdOrCtrl+[',
  'findInPage': 'CmdOrCtrl+F',
  'focusUrl': 'CmdOrCtrl+L',
  'focusPage': 'CmdOrCtrl+;',
  'setDefaultBrowser': 'CmdOrCtrl+Shift+D',
  'quickSaveCookies': 'CmdOrCtrl+Shift+S',
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

/**
 * 重置快捷键为默认值
 * 删除自定义覆盖项；getShortcuts 的合并逻辑（{...DEFAULT, ...custom}）
 * 会自动回落到 DEFAULT_SHORTCUTS[action]。
 * @param {string} action - 操作名称
 * @returns {boolean} 是否重置成功（action 非法时返回 false）
 */
function resetShortcut(action) {
  if (!DEFAULT_SHORTCUTS.hasOwnProperty(action)) {
    return false;
  }

  const customShortcuts = store.get('shortcuts', {});
  // 幂等：本来就没自定义也算成功（结果都是"使用默认"）
  delete customShortcuts[action];
  store.set('shortcuts', customShortcuts);

  console.log(`[Realm] 重置快捷键: ${action} -> ${DEFAULT_SHORTCUTS[action]}（默认）`);
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
    // ==================== 优先级 1：非 keyDown 事件忽略 ====================
    if (input.type !== 'keyDown') return;

    // ==================== 优先级 2：CmdOrCtrl 修饰键优先走现有 Accelerator 匹配（D-08） ====================
    const hasModifier = input.meta || input.control || input.alt;

    // ==================== 优先级 3：Vim 快捷键处理 ====================
    // Hint Mode 激活期间：按键路由改为「主进程捕获 → IPC 转发 → renderer 注入 guest」。
    // 键盘焦点跨 webview guest 转移在 Chromium 层不可靠（快捷键切标签后焦点卡在旧 guest，
    // renderer 侧 webview.focus() 无法拉出，见 docs/debug/vim-hint-focus-cross-tab-failure.md），
    // 因此 hint 按键不再依赖 guest 焦点，由主进程统一捕获转发。
    // 焦点在输入框（地址栏 / 页面 input）时放行，保持原有输入语义。
    if (hintModeActive && !hasModifier) {
      const isInInput = vimFocusStates.get(contents.id) || false;
      const key = input.key || '';
      if (!isInInput && (key === 'Escape' || key === 'Backspace' || key.length === 1)) {
        event.preventDefault();
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow && !focusedWindow.isDestroyed() && windowManager.isManagedWindow(focusedWindow.id)) {
          focusedWindow.webContents.send('vim:hint-key', key);
        }
        return;
      }
    }

    // Hint Mode / 搜索输入激活期间，所有 Vim 命令由 guest 内部独立处理，主进程完全跳过
    if (!hintModeActive && !searchInputActive) {
      // Alt+P 特殊处理：固定/取消固定标签（需在 !hasModifier 之前检查，因为 Alt 本身是修饰键）
      if (input.alt && !input.meta && !input.control && input.key && input.key.toLowerCase() === 'p') {
        const isInInput = vimFocusStates.get(contents.id) || false;
        const vimEnabled = isVimEnabled(settingsStore);
        if (!isInInput && vimEnabled) {
          event.preventDefault();
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow && !focusedWindow.isDestroyed() && windowManager.isManagedWindow(focusedWindow.id)) {
            focusedWindow.webContents.send('vim:triggered', 'togglePinTab');
          }
          return;
        }
      }

      if (!hasModifier) {
        // 检查焦点状态（输入框中则跳过 Vim 快捷键）
        const isInInput = vimFocusStates.get(contents.id) || false;

        // 检查 Vimium 是否启用
        const vimEnabled = isVimEnabled(settingsStore);

        if (!isInInput && vimEnabled) {
          const command = VimStateMachine.processKey(input.key, { shift: input.shift });
          if (command) {
            // 命中命令：preventDefault + 发送到 renderer
            event.preventDefault();
            // 搜索模式状态在主进程同步切换（不等 renderer IPC 回传）：
            // 进入搜索立即置 searchInputActive，让后续输入字符直达搜索框，零竞态；
            // 退出搜索立即清 searchActive，避免 n/N 映射残留吞键。
            if (command === 'searchMode') {
              searchInputActive = true;
              VimStateMachine.searchActive = false;
            } else if (command === 'searchModeExit') {
              searchInputActive = false;
              VimStateMachine.searchActive = false;
            } else if (command === 'hintMode' || command === 'hintModeNewTab' || command === 'copyLinkUrl') {
              // Hint Mode 进入状态在主进程同步切换（镜像 searchMode 模式）：
              // 若等 renderer 的 set-hint-active IPC 回传，f 之后立刻输入的 hint 字符
              // 会被当作 Vim 命令/普通按键处理（进入竞态）。renderer 丢弃命令时
              // （帮助对话框打开 / 无活动 webview）负责回退清除，见 renderer.js。
              hintModeActive = true;
            }
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed() && windowManager.isManagedWindow(focusedWindow.id)) {
              focusedWindow.webContents.send('vim:triggered', command);
            }
            return;
          }
          if (VimStateMachine.state !== 'idle') {
            // 等待双键序列的第二个键：吞掉按键
            event.preventDefault();
            return;
          }
        }
      }
    }

    // ==================== 优先级 4：现有 Accelerator 匹配 ====================
    const action = findMatchingAction(input);
    if (!action) return; // 未命中：完全不拦截

    // 命中快捷键后无条件 preventDefault：应用菜单存在同键 accelerator 时，
    // 不拦截的按键会漏进菜单触发其默认行为（此前窗口菜单的 role:'close'
    // 默认注册 Cmd+W，Cmd+W 曾因此关闭整个窗口而非当前标签）
    event.preventDefault();

    // 获取当前焦点窗口（而非固定的 currentWindow 单例），支持多窗口场景
    let focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow || focusedWindow.isDestroyed()) {
      // 焦点切换瞬间（多窗口切换/窗口关闭动画）getFocusedWindow() 可能
      // 短暂为 null，用按键来源 webContents 反推宿主窗口兜底
      // （webview guest 的 fromWebContents 会解析到其宿主主窗口）
      focusedWindow = BrowserWindow.fromWebContents(contents);
    }
    if (!focusedWindow || focusedWindow.isDestroyed()) return;

    // 非 Realm 管理的窗口（如播放器窗口）不派发到 managed 窗口：
    // closeTab（Cmd+W）语义转为关闭来源窗口自身（D-13）；其余快捷键放行不拦截。
    if (!windowManager.isManagedWindow(focusedWindow.id)) {
      if (action === 'closeTab') {
        focusedWindow.close();
      }
      return;
    }

    // 窗口级操作（newWindow/closeWindow）在主进程直接处理：
    // renderer 的 shortcut:triggered 分发没有这两个分支（窗口创建/关闭不属于渲染层职责），
    // 若只派发不处理，按键会被吞掉；preventDefault（上方已统一执行）同时阻止了应用菜单
    // 同键 accelerator（Cmd+N / Cmd+Shift+W），由这里的直接处理补齐语义。
    if (action === 'newWindow') {
      // 懒加载避免模块加载顺序问题；行为与 main.js 菜单「新建窗口」保持一致（default 容器）
      const containerManager = require('./container-manager');
      const defaultContainer = containerManager.getContainer('default');
      if (defaultContainer) {
        // offsetPosition：相对当前焦点窗口错位 30px，避免完全覆盖原窗口
        windowManager.createMainWindow('default', defaultContainer, { offsetPosition: true });
      }
      return;
    }
    if (action === 'closeWindow') {
      focusedWindow.close();
      return;
    }

    focusedWindow.webContents.send('shortcut:triggered', action);
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
      // webContents 销毁时清理焦点状态，防止 Map 无限增长
      contents.on('destroyed', () => {
        vimFocusStates.delete(contents.id);
      });
    }
  });
}

// ==================== 快捷键注册 ====================

/**
 * 启用应用内快捷键（仅当前应用聚焦时生效）
 * 通过 app 级 web-contents-created 自动给所有新 webContents 挂监听，
 * 无需传入窗口引用——快捷键派发时通过 BrowserWindow.getFocusedWindow() 动态获取焦点窗口。
 */
function registerShortcuts() {
  ensureAppListener();
  registerVimIpcHandlers();
  console.log('[Realm] 应用内快捷键已启用（before-input-event）');
}

/**
 * 快捷键配置变更后调用。
 * 由于匹配时实时读取 getShortcuts()，无需重新绑定监听器或更新窗口引用；
 * 保留函数签名以兼容 ipc-handlers.js 中的调用。
 */
function rebuildShortcuts() {
  console.log('[Realm] 快捷键配置已生效（应用内）');
}

/**
 * 应用退出前调用。
 * before-input-event 监听随 webContents 销毁自动清理，无需显式移除。
 */
function unregisterAll() {
  console.log('[Realm] 解除快捷键目标窗口');
}

// ==================== Vim 焦点状态管理 ====================

/**
 * 设置指定 webContents 的输入框焦点状态
 * 由 renderer 通过 IPC 调用，报告 webview guest 中的焦点变化
 *
 * @param {number} webContentsId - webview guest 的 webContents ID
 * @param {boolean} isInInput - 焦点是否在输入框中
 */
function setVimFocusState(webContentsId, isInInput) {
  vimFocusStates.set(webContentsId, isInInput);

  // 如果焦点进入输入框，重置 VimStateMachine 的 pending 状态
  if (isInInput) {
    VimStateMachine.reset();
  }
}

/**
 * 读取指定 webContents 的输入框焦点状态（调试/测试用）
 * @param {number} webContentsId
 * @returns {boolean}
 */
function getVimFocusState(webContentsId) {
  return vimFocusStates.get(webContentsId) || false;
}

/**
 * 读取 Vim 全局状态快照（调试/测试用）
 * @returns {{hintModeActive: boolean, searchInputActive: boolean}}
 */
function getVimDebugState() {
  return { hintModeActive, searchInputActive };
}

/**
 * Vim IPC handler 是否已注册（幂等守卫）。
 * registerShortcuts 会在启动和 macOS activate（Dock 点击重建窗口）时多次调用，
 * 重复 ipcMain.handle 同一通道会抛 "Attempted to register a second handler"
 * 未捕获异常导致主进程弹窗僵死。
 */
let vimIpcRegistered = false;

/**
 * 注册 Vim 相关的 IPC 处理器（幂等，重复调用只注册一次）
 * 在 registerShortcuts 中调用
 */
function registerVimIpcHandlers() {
  if (vimIpcRegistered) return;
  vimIpcRegistered = true;

  // 处理焦点状态设置请求（renderer 报告 webview guest 的焦点状态）
  ipcMain.handle('vim:set-focus-state', (event, webContentsId, isInInput) => {
    // webContentsId 缺省时取发送者自身：host 主窗口报告地址栏等 chrome 内输入框焦点，
    // 缺了 host 侧状态会导致焦点在地址栏时 f/F 等键被当作 Vim 命令拦截（打不进地址栏）
    const id = typeof webContentsId === 'number' ? webContentsId : event.sender.id;
    setVimFocusState(id, isInInput);
  });

  // 处理 Vimium 启用状态查询请求
  ipcMain.handle('vim:get-enabled', () => {
    return isVimEnabled(settingsStore);
  });

  // 处理 Vim 搜索模式激活状态设置
  // 搜索模式激活时，n/N 键切换为搜索导航（searchNext/searchPrev）
  ipcMain.handle('vim:set-search-active', (event, active) => {
    VimStateMachine.searchActive = active;
  });

  // 处理搜索输入激活状态设置
  // renderer 在搜索确认（Enter）/退出（Escape）后清除；
  // 激活期间主进程跳过所有 Vim 处理，按键直达 guest 搜索输入框
  ipcMain.handle('vim:set-search-input-active', (event, active) => {
    setSearchInputActive(active);
  });

  // 处理 Hint Mode 激活状态设置
  // renderer 在 hint mode 进入/退出时同步此状态，主进程据此跳过 Vim 命令处理
  ipcMain.handle('vim:set-hint-active', (event, active) => {
    setHintModeActive(active);
  });

  console.log('[Realm] Vim IPC 处理器已注册');
}

// ==================== 同步焦点状态通道（模块加载即注册） ====================

/**
 * 注册 vim:set-focus-state-sync 同步处理器（sendSync 专用）
 *
 * 背景：before-input-event 是原生同步事件，焦点状态若走异步 IPC（invoke/send）
 * 上报，点击输入框后立刻打字时主进程读到的仍是旧状态，按键被 Vim 命令吞掉
 * （详见 docs/debug/vim-mode-input-field-bug.md）。
 *
 * 本处理器在模块 require 时即注册（早于任何窗口/webview 创建），handler 体只做
 * Map 写入且 try/finally 保证 returnValue 一定被设置——这两个条件是 sendSync
 * 不死锁的前提（此前按方案 4.1 在 registerVimIpcHandlers 中注册 + preload 加载
 * 时立即调用，handler 未就绪导致渲染进程永久阻塞）。
 *
 * guest preload 与 host renderer 均以 event.sender 身份直报（一跳直达），
 * 不再经过「guest → host renderer → main」两跳异步链。
 */
ipcMain.on('vim:set-focus-state-sync', (event, webContentsId, isInInput) => {
  try {
    const id = typeof webContentsId === 'number' ? webContentsId : event.sender.id;
    setVimFocusState(id, isInInput);
  } catch (err) {
    console.warn('[Realm] vim:set-focus-state-sync 处理失败:', err.message);
  } finally {
    // sendSync 必须设置 returnValue，否则渲染进程永久阻塞
    event.returnValue = true;
  }
});

// ==================== 模块导出 ====================

module.exports = {
  DEFAULT_SHORTCUTS,
  getShortcuts,
  getShortcut,
  setShortcut,
  resetShortcut,
  registerShortcuts,
  rebuildShortcuts,
  unregisterAll,
  setVimFocusState,
  setHintModeActive,
  setSearchInputActive,
  registerVimIpcHandlers,
  getVimFocusState,
  getVimDebugState,
};

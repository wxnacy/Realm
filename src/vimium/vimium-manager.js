/**
 * Realm Browser - Vimium 管理模块
 *
 * 实现 Vim 风格键盘快捷键的状态机和命令映射。
 * 支持单键命令和双键序列（如 gg、yy、g0、g$ 等）。
 *
 * 工作原理：
 * - VimStateMachine 管理双键序列状态（idle/pending_g/pending_y）
 * - processKey 方法将按键映射为命令名，或返回 null 表示等待下一个按键
 * - 500ms 超时自动回退到 idle 状态
 *
 * @module vimium-manager
 */

// ==================== 配置常量 ====================

/**
 * Vimium 启用设置的 electron-store 键名
 * @type {string}
 */
const VIM_ENABLED_KEY = 'vimium.enabled';

/**
 * 双键序列超时时间（毫秒）
 * 超过此时间未输入第二个键，自动回退到 idle 状态
 * @type {number}
 */
const SEQUENCE_TIMEOUT_MS = 500;

// ==================== 单键命令映射 ====================

/**
 * 单键 → 命令名映射表
 * 不含 Shift 修饰的单字符按键
 * @type {Object<string, string>}
 */
const SINGLE_KEY_MAP = {
  // 页面滚动
  'j': 'scrollDown',
  'k': 'scrollUp',
  'h': 'scrollLeft',
  'l': 'scrollRight',
  'd': 'scrollHalfPageDown',
  'u': 'scrollHalfPageUp',
  'G': 'scrollToBottom',  // Shift+g

  // 浏览导航
  'H': 'goBack',          // Shift+h
  'L': 'goForward',       // Shift+l
  'r': 'reload',
  'R': 'hardReload',      // Shift+r

  // 标签管理
  'J': 'prevTab',         // Shift+j
  'K': 'nextTab',         // Shift+k
  'x': 'closeTab',
  'X': 'restoreTab',      // Shift+x
  't': 'newTab',

  // URL 操作
  'o': 'focusUrl',
  'O': 'focusUrlNewTab',  // Shift+o

  // 其他
  '/': 'searchMode',
  '?': 'showHelp',
  '^': 'visitPrevTab',
  'f': 'hintMode',
  'F': 'hintModeNewTab',  // Shift+f
  'T': 'searchTabs',      // Shift+t
  'W': 'moveTabToNewWindow', // Shift+w
};

/**
 * pending_g 状态下的第二键 → 命令名映射表
 * @type {Object<string, string>}
 */
const PENDING_G_MAP = {
  'g': 'scrollToTop',     // gg
  '0': 'firstTab',        // g0
  '$': 'lastTab',         // g$
  'e': 'editUrl',         // ge
  't': 'nextTab',         // gt（与 K 等价）
  'T': 'prevTab',         // gT（与 J 等价）
  's': 'viewSource',      // gs
};

/**
 * pending_y 状态下的第二键 → 命令名映射表
 * @type {Object<string, string>}
 */
const PENDING_Y_MAP = {
  'y': 'copyUrl',         // yy
  'f': 'copyLinkUrl',     // yf
};

// ==================== Vim 状态机 ====================

/**
 * Vim 快捷键状态机
 *
 * 管理双键序列的识别：
 * - idle: 等待第一个按键
 * - pending_g: 已按下 g，等待第二个按键（gg/g0/g$/ge/gt/gT/gs）
 * - pending_y: 已按下 y，等待第二个按键（yy/yf）
 *
 * 状态转换：
 * - idle + g → pending_g（启动 500ms 超时）
 * - idle + y → pending_y（启动 500ms 超时）
 * - pending_g + 第二键 → 返回命令 + 回到 idle
 * - pending_y + 第二键 → 返回命令 + 回到 idle
 * - 超时 → 自动回到 idle
 */
const VimStateMachine = {
  /** @type {'idle'|'pending_g'|'pending_y'} 当前状态 */
  state: 'idle',

  /** @type {NodeJS.Timeout|null} 超时定时器 */
  _timeout: null,

  /**
   * 处理按键输入
   *
   * @param {string} key - 按键字符（如 'j', 'G', 'g'）
   * @param {Object} [modifiers={}] - 修饰键状态
   * @param {boolean} [modifiers.shift=false] - Shift 键是否按下
   * @returns {string|null} 命令名，或 null 表示等待下一个按键
   */
  processKey(key, modifiers = {}) {
    const shift = modifiers.shift || false;

    // 处理 Shift 修饰：将小写字母转为大写
    let effectiveKey = key;
    if (shift && key.length === 1 && key >= 'a' && key <= 'z') {
      effectiveKey = key.toUpperCase();
    }

    // idle 状态：检查是否为双键序列的起始键
    if (this.state === 'idle') {
      // g 前缀：进入 pending_g 状态
      if (effectiveKey === 'g' && !shift) {
        this._enterPending('pending_g');
        return null;
      }

      // y 前缀：进入 pending_y 状态
      if (effectiveKey === 'y' && !shift) {
        this._enterPending('pending_y');
        return null;
      }

      // 单键命令：直接映射
      return SINGLE_KEY_MAP[effectiveKey] || null;
    }

    // pending_g 状态：查找第二键映射
    if (this.state === 'pending_g') {
      this._resetToIdle();
      return PENDING_G_MAP[effectiveKey] || null;
    }

    // pending_y 状态：查找第二键映射
    if (this.state === 'pending_y') {
      this._resetToIdle();
      return PENDING_Y_MAP[effectiveKey] || null;
    }

    return null;
  },

  /**
   * 进入 pending 状态并启动超时定时器
   *
   * @param {'pending_g'|'pending_y'} pendingState - 目标 pending 状态
   * @private
   */
  _enterPending(pendingState) {
    this.state = pendingState;

    // 清除旧的超时定时器
    if (this._timeout) {
      clearTimeout(this._timeout);
    }

    // 启动新的超时定时器
    this._timeout = setTimeout(() => {
      if (this.state !== 'idle') {
        console.log(`[Realm Vim] 双键序列超时，回退到 idle 状态（${this.state}）`);
        this.state = 'idle';
      }
      this._timeout = null;
    }, SEQUENCE_TIMEOUT_MS);
  },

  /**
   * 重置到 idle 状态并清除超时定时器
   * @private
   */
  _resetToIdle() {
    this.state = 'idle';
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  },

  /**
   * 手动重置状态机到 idle 状态
   * 用于焦点切换到输入框时清除 pending 状态
   */
  reset() {
    this._resetToIdle();
  },
};

// ==================== 辅助函数 ====================

/**
 * 检查 Vimium 是否启用
 *
 * @param {Object} store - electron-store 实例
 * @returns {boolean} 是否启用
 */
function isVimEnabled(store) {
  try {
    return store.get(VIM_ENABLED_KEY, false);
  } catch (err) {
    console.error('[Realm Vim] 读取 Vimium 设置失败:', err.message);
    return false;
  }
}

// ==================== 模块导出 ====================

module.exports = {
  VimStateMachine,
  VIM_ENABLED_KEY,
  isVimEnabled,
  SINGLE_KEY_MAP,
  PENDING_G_MAP,
  PENDING_Y_MAP,
};

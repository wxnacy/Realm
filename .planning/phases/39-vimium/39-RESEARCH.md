# Phase 39: Vimium 键盘操作功能 - Research

**Researched:** 2026-08-23
**Domain:** 键盘快捷键、页面滚动、链接跟随 Hint Mode、搜索模式
**Confidence:** HIGH

## Summary

为 Realm Browser 添加类似 Vimium 的键盘操作功能。核心挑战在于：(1) 在现有 `shortcut-manager.js` 的 `before-input-event` 基础上扩展 Vim 单键快捷键，需要处理焦点检测（input/textarea/contenteditable 时禁用）；(2) 通过 `webview.executeJavaScript` 注入滚动控制和 Hint overlay 到 guest 页面；(3) 实现双键序列（如 `gg`）的状态机；(4) 搜索模式复用现有 `findInPage` API。

项目已有完整的快捷键基础设施（`shortcut-manager.js` + `renderer.js` 的 `initShortcuts`），可直接扩展。无需引入新依赖——所有功能均用 vanilla JS + CSS 实现。Vimium 开源项目（`/Volumes/ZhiTai/Projects/github/vimium`）提供了成熟的参考实现，特别是 hint 字母生成算法和滚动逻辑。

**Primary recommendation:** 在 `shortcut-manager.js` 中添加 Vim 快捷键识别层（与现有 Accelerator 匹配并行），在 `renderer.js` 中添加 Vim 命令分发逻辑，通过 `webview.executeJavaScript` 注入页面级操作（滚动、Hint、搜索）。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vim 快捷键识别 | Main Process (shortcut-manager.js) | — | before-input-event 在主进程拦截，需区分 Vim 单键 vs Accelerator |
| Vim 命令分发 | Renderer (renderer.js) | — | 滚动/Hint/搜索等命令在渲染进程分发到对应处理函数 |
| 页面滚动 | Webview Guest (executeJavaScript) | — | scrollBy/scrollTo 在 guest 页面上下文执行 |
| Hint overlay | Webview Guest (executeJavaScript) | — | DOM 创建和点击模拟在 guest 页面上下文 |
| 搜索模式 | Webview Guest (findInPage) | Renderer (search bar UI) | findInPage 是 webview 原生 API，搜索栏 UI 在 renderer |
| 标签管理 | Renderer | Main Process (IPC) | 标签切换/关闭/恢复在渲染进程，跨窗口操作需 IPC |
| 快捷键配置 | Settings Page | electron-store | 开关和快捷键表在设置页，持久化用 electron-store |
| 帮助对话框 | Renderer (index.html) | — | 模态框在主窗口 renderer 中创建 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (无新依赖) | — | — | 所有功能用 vanilla JS + CSS 实现，复用现有 Electron API |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron clipboard | 内置 | 复制 URL 到剪贴板 | yy/yf 操作 |
| webview.findInPage | 内置 | 页面内搜索 | /、n、N 搜索模式 |
| webview.executeJavaScript | 内置 | 注入 guest 页面脚本 | 滚动、Hint overlay、搜索栏 |
| webview.goBack/goForward | 内置 | 浏览历史导航 | H/L 操作 |
| webview.reload/reloadIgnoringCache | 内置 | 页面刷新 | r/R 操作 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| executeJavaScript 注入滚动 | CDP Runtime.evaluate | CDP 需要额外连接管理，executeJavaScript 更轻量 |
| 自建 findInPage | CDP DOM.search | 原生 API 性能更好，无需维护搜索状态 |
| webview guest preload 注入 | executeJavaScript | preload 需要重启 webview 才能生效，executeJavaScript 即时注入 |

**Installation:**
```bash
# 无新依赖需要安装
```

## Package Legitimacy Audit

> 本 Phase 不安装任何外部包，无需审计。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (无) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
用户按键
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  shortcut-manager.js (Main Process)                             │
│  before-input-event 监听                                         │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ findMatchingAction│    │ Vim 快捷键识别   │                    │
│  │ (Accelerator)    │    │ (单键/双键序列)   │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           ▼                      ▼                              │
│  ┌─────────────────────────────────────────┐                   │
│  │ 优先级判断：                              │                   │
│  │ 1. CmdOrCtrl 修饰 → Accelerator 优先    │                   │
│  │ 2. 焦点在 input/textarea → 禁用 Vim     │                   │
│  │ 3. Vim 单键 → vim:triggered             │                   │
│  └─────────────────────┬───────────────────┘                   │
│                        │                                        │
│                        ▼                                        │
│  focusedWindow.webContents.send('vim:triggered', command)       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  renderer.js (Renderer Process)                                 │
│  onVimTriggered(command)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ switch(command):                                        │   │
│  │   'scrollDown' → webview.executeJavaScript(scrollBy)    │   │
│  │   'hintMode'   → webview.executeJavaScript(hintOverlay) │   │
│  │   'searchMode' → injectSearchBar() + findInPage         │   │
│  │   'nextTab'    → switchToAdjacentTab(+1)                │   │
│  │   'closeTab'   → closeCurrentTab()                      │   │
│  │   ...                                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Webview Guest (executeJavaScript 注入)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 滚动控制      │  │ Hint overlay │  │ 搜索栏       │          │
│  │ scrollBy/To   │  │ DOM + CSS    │  │ findInPage   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── vimium/
│   ├── vimium-manager.js      # Vim 快捷键状态机和命令分发
│   ├── vim-scroll.js          # 注入到 webview 的滚动脚本
│   ├── vim-hints.js           # 注入到 webview 的 hint overlay 脚本
│   ├── vim-search.js          # 注入到 webview 的搜索栏脚本
│   └── vimium.css             # 帮助对话框样式（注入到 main.css）
```

### Pattern 1: Vim 快捷键状态机

**What:** 处理双键序列（如 `gg`）的状态机，带超时回退
**When to use:** 需要识别多键序列的快捷键
**Example:**
```javascript
// vimium-manager.js
const VimStateMachine = {
  state: 'idle',         // idle | pending_g
  pendingTimer: null,
  PENDING_TIMEOUT: 500,  // ms

  /**
   * 处理按键输入
   * @param {string} key - 按键字符（小写）
   * @returns {string|null} 命令名称，未匹配返回 null
   */
  processKey(key) {
    if (this.state === 'pending_g') {
      clearTimeout(this.pendingTimer);
      this.state = 'idle';
      if (key === 'g') return 'scrollToTop';  // gg
      // g 前缀不匹配，返回 null（吞掉 g）
      return null;
    }

    if (key === 'g') {
      this.state = 'pending_g';
      this.pendingTimer = setTimeout(() => {
        this.state = 'idle';
        // 超时：单独的 g 无意义，忽略
      }, this.PENDING_TIMEOUT);
      return null;  // 等待下一个键
    }

    return this.matchSingleKey(key);
  },

  /**
   * 匹配单键命令
   * @param {string} key
   * @returns {string|null}
   */
  matchSingleKey(key) {
    const map = {
      'j': 'scrollDown', 'k': 'scrollUp',
      'h': 'scrollLeft', 'l': 'scrollRight',
      'd': 'scrollHalfPageDown', 'u': 'scrollHalfPageUp',
      'G': 'scrollToBottom',
      'f': 'hintMode', 'F': 'hintModeNewTab',
      '/': 'searchMode',
      'r': 'reload', 'R': 'hardReload',
      'H': 'goBack', 'L': 'goForward',
      'x': 'closeTab', 'X': 'restoreTab',
      't': 'newTab',
      '?': 'showHelp',
    };
    return map[key] || null;
  },

  reset() {
    clearTimeout(this.pendingTimer);
    this.state = 'idle';
  }
};
```

### Pattern 2: Hint Mode 链接跟随

**What:** 在 webview guest 中注入 hint overlay，标记所有可点击元素
**When to use:** 用户按 `f` 或 `F` 进入 hint 模式
**Example:**
```javascript
// vim-hints.js（注入到 webview guest 的脚本）
const HintMode = {
  container: null,
  hints: [],
  mode: 'current',  // current | newTab
  typedChars: '',

  /**
   * 进入 hint 模式
   * @param {'current'|'newTab'} mode
   */
  enter(mode) {
    this.mode = mode;
    this.typedChars = '';
    this.createOverlay();
    this.collectClickableElements();
    this.renderHints();
  },

  /**
   * 收集页面中所有可点击元素
   * 参照 Vimium 的 getLocalHints 逻辑，简化版：
   * - <a href>, <button>, <input>, <select>, <textarea>
   * - [onclick], [role="button"], [tabindex]
   */
  collectClickableElements() {
    const selectors = [
      'a[href]', 'button', 'input', 'select', 'textarea',
      '[onclick]', '[role="button"]', '[role="link"]',
      '[tabindex]:not([tabindex="-1"])'
    ];
    const elements = document.querySelectorAll(selectors.join(','));
    this.hints = Array.from(elements).filter(el => {
      const rect = el.getBoundingClientRect();
      // 过滤不可见元素
      return rect.width > 0 && rect.height > 0 &&
             rect.top < window.innerHeight && rect.bottom > 0 &&
             rect.left < window.innerWidth && rect.right > 0;
    }).map((el, i) => ({
      element: el,
      rect: el.getBoundingClientRect(),
      hintString: this.generateHintString(i),
    }));
  },

  /**
   * 生成 hint 字符串
   * 参照 Vimium AlphabetHints.hintStrings 算法
   * a-z (26) -> aa-az (26) -> ba-bz (26) -> ...
   */
  generateHintString(index) {
    const chars = 'asdfghjklqwertyuiopzxcvbnm';
    let result = '';
    let n = index;
    do {
      result = chars[n % chars.length] + result;
      n = Math.floor(n / chars.length) - 1;
    } while (n >= 0);
    return result;
  },

  /**
   * 处理按键输入
   * @param {string} key
   * @returns {boolean} 是否消费了该按键
   */
  handleKey(key) {
    if (key === 'Escape') {
      this.exit();
      return true;
    }
    if (key === 'Backspace') {
      this.typedChars = this.typedChars.slice(0, -1);
      this.updateHighlight();
      return true;
    }
    this.typedChars += key;
    this.updateHighlight();

    // 检查是否完全匹配某个 hint
    const matched = this.hints.find(h => h.hintString === this.typedChars);
    if (matched) {
      this.activateHint(matched);
      return true;
    }

    // 检查是否还有可能的匹配
    const possibleMatches = this.hints.filter(h =>
      h.hintString.startsWith(this.typedChars)
    );
    if (possibleMatches.length === 0) {
      this.exit();  // 无匹配，退出
    }
    return true;
  },

  activateHint(hint) {
    if (this.mode === 'current') {
      hint.element.click();
    } else {
      // 新标签页打开
      const url = hint.element.href || hint.element.action;
      if (url) window.open(url, '_blank');
    }
    this.exit();
  },

  exit() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.hints = [];
    this.typedChars = '';
    // 通知 renderer 退出 hint 模式
    window.__realmBridge.sendVimCommand('hintModeExit');
  }
};
```

### Pattern 3: 搜索模式复用 findInPage

**What:** 注入搜索栏 UI，使用 webview 原生 findInPage API
**When to use:** 用户按 `/` 进入搜索模式
**Example:**
```javascript
// renderer.js 中的搜索模式处理
function enterSearchMode() {
  const webview = state.webviews.get(state.activeTabId);
  if (!webview) return;

  // 注入搜索栏 DOM
  const searchScript = `
    if (!document.getElementById('realm-vimium-search')) {
      const container = document.createElement('div');
      container.id = 'realm-vimium-search';
      container.innerHTML = \`
        <div class="realm-search-inner">
          <span class="realm-search-icon">/</span>
          <input type="text" class="realm-search-input" placeholder="输入搜索内容..." />
          <span class="realm-search-count"></span>
        </div>
      \`;
      document.body.appendChild(container);

      // 注入样式
      const style = document.createElement('style');
      style.textContent = \`
        #realm-vimium-search { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); z-index:2147483646; }
        .realm-search-inner { display:flex; align-items:center; background:#2a2a2a; border:1px solid #404040; border-radius:6px; padding:6px 12px; box-shadow:0 4px 12px rgba(0,0,0,0.4); gap:8px; min-width:300px; }
        .realm-search-icon { color:#FFB800; font-family:'Courier New',monospace; font-size:14px; font-weight:700; }
        .realm-search-input { flex:1; background:transparent; border:none; outline:none; color:#f0f0f0; font-size:14px; }
        .realm-search-count { color:#a0a0a0; font-size:12px; white-space:nowrap; }
      \`;
      document.head.appendChild(style);

      const input = container.querySelector('.realm-search-input');
      input.focus();

      // Enter 触发搜索
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const text = input.value;
          if (text) {
            // 通过 IPC 通知 renderer 执行 findInPage
            window.__realmBridge.sendVimCommand('findInPage', { text });
          }
        }
        if (e.key === 'Escape') {
          container.remove();
          window.__realmBridge.sendVimCommand('searchModeExit');
        }
      });
    }
  `;
  webview.executeJavaScript(searchScript);
}
```

### Anti-Patterns to Avoid

- **在 renderer 中处理所有快捷键:** Vim 单键快捷键需要在主进程 `before-input-event` 中识别，因为 renderer 的 `shortcut:triggered` 只处理 Accelerator 格式
- **在 webview guest 中存储状态:** Hint 模式状态应在 renderer 或主进程管理，guest 页面只负责 UI 渲染
- **使用 HTML5 DnD 做 hint 选择:** hint 是键盘驱动的，不需要拖拽
- **在输入框中触发 Vim 快捷键:** 必须检测焦点元素，input/textarea/contenteditable 时禁用

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 页面内搜索 | 自建文本搜索算法 | webview.findInPage API | 原生 API 性能好，支持高亮和计数 |
| 剪贴板操作 | document.execCommand('copy') | Electron clipboard API | 更可靠，不依赖 DOM 选区 |
| 元素可见性检测 | 手动计算 getBoundingClientRect | Vimium 的 isScrollableElement 逻辑 | 需要考虑 overflow、visibility、display 等多种情况 |
| hint 字母生成 | 简单的 a-z 循环 | Vimium 的 AlphabetHints.hintStrings 算法 | 需要保证前缀不冲突，支持扩展到 17000+ 个 hint |

## Common Pitfalls

### Pitfall 1: 焦点检测遗漏 webview 内的输入框

**What goes wrong:** 用户在 webview 内的 input 中输入时，Vim 快捷键仍然触发，导致输入被拦截
**Why it happens:** 主进程的 `before-input-event` 只能获取 webContents 级别的事件，无法直接知道 guest 页面内哪个元素有焦点
**How to avoid:** 在 webview guest 的 preload 脚本中监听 focus/blur 事件，通过 `ipcRenderer.sendToHost` 通知 renderer 当前是否有输入框焦点，renderer 再通过 IPC 告知主进程
**Warning signs:** 用户报告在网页输入框中输入 j/k 等字母时页面滚动

### Pitfall 2: 双键序列超时后状态残留

**What goes wrong:** 用户按 `g` 后等了 1 秒再按其他键，状态机仍处于 pending_g 状态
**Why it happens:** 超时定时器没有正确清理，或者新的按键事件没有重置状态
**How to avoid:** 每次处理按键时先检查 pendingTimer，超时后自动回到 idle 状态
**Warning signs:** 偶发的按键无响应或意外触发 scrollToTop

### Pitfall 3: Hint overlay 被页面 CSS 影响

**What goes wrong:** 页面的全局 CSS（如 `* { position: relative }`）影响 hint 标签的定位
**Why it happens:** 注入的 DOM 元素继承了页面的样式
**How to avoid:** 使用 `position: fixed` + `z-index: 2147483647`，并用 `!important` 覆盖关键样式。参照 Vimium 的 `.vimium-reset` 类策略
**Warning signs:** Hint 标签位置偏移或被页面元素遮挡

### Pitfall 4: findInPage 在 webview guest 中的调用限制

**What goes wrong:** 在 webview guest 的 executeJavaScript 中调用 `window.find()` 不生效
**Why it happens:** `window.find()` 是非标准 API，在某些 Chromium 版本中行为不一致
**How to avoid:** 使用 webview 的 `findInPage` API（在 renderer 中调用），而不是在 guest 中调用 `window.find()`
**Warning signs:** 搜索模式输入文字后没有高亮或计数

### Pitfall 5: 内部页面（realm://）不应触发 Vim 快捷键

**What goes wrong:** 在 realm://settings、realm://history 等内部页面中，Vim 快捷键被触发
**Why it happens:** 内部页面也是 webview，会被 before-input-event 监听
**How to avoid:** 在 Vim 快捷键处理前检查当前 tab 的 URL 是否以 `realm://` 开头，如果是则跳过
**Warning signs:** 在设置页面按 j/k 会滚动页面而不是导航

## Code Examples

### 滚动脚本注入

```javascript
// 注入到 webview guest 的滚动控制脚本
// 来源：参照 Vimium scroller.js，简化为 window.scrollBy/scrollTo
const scrollScript = `
(function() {
  window.__realmScroll = {
    down(px) { window.scrollBy({ top: px || 100, behavior: 'smooth' }); },
    up(px) { window.scrollBy({ top: -(px || 100), behavior: 'smooth' }); },
    left(px) { window.scrollBy({ left: -(px || 100), behavior: 'smooth' }); },
    right(px) { window.scrollBy({ left: px || 100, behavior: 'smooth' }); },
    halfPageDown() { window.scrollBy({ top: window.innerHeight / 2, behavior: 'smooth' }); },
    halfPageUp() { window.scrollBy({ top: -window.innerHeight / 2, behavior: 'smooth' }); },
    toTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); },
    toBottom() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); },
  };
})();
`;
```

### 焦点检测脚本注入

```javascript
// 注入到 webview guest 的焦点检测脚本
// 通知 renderer 当前是否有输入框获得焦点
const focusDetectScript = `
(function() {
  let isInInput = false;
  function checkFocus() {
    const el = document.activeElement;
    const nowInInput = el && (
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable
    );
    if (nowInInput !== isInInput) {
      isInInput = nowInInput;
      // 通过 preload 暴露的 bridge 通知 renderer
      if (window.__realmBridge && window.__realmBridge.sendFocusState) {
        window.__realmBridge.sendFocusState(isInInput);
      }
    }
  }
  document.addEventListener('focusin', checkFocus);
  document.addEventListener('focusout', checkFocus);
  checkFocus();
})();
`;
```

### 快捷键帮助对话框

```javascript
// renderer.js 中创建帮助对话框
function createHelpDialog() {
  const overlay = document.createElement('div');
  overlay.id = 'vimium-help-overlay';
  overlay.className = 'vimium-help-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="vimium-help-dialog">
      <div class="vimium-help-header">
        <h2>快捷键帮助</h2>
        <span class="vimium-help-close-hint">按 Esc 关闭</span>
      </div>
      <div class="vimium-help-body">
        ${renderHelpCategories()}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function renderHelpCategories() {
  const categories = [
    { title: '页面滚动', keys: [
      { key: 'j / k', desc: '向下 / 向上滚动' },
      { key: 'h / l', desc: '向左 / 向右滚动' },
      { key: 'gg / G', desc: '滚动到顶部 / 底部' },
      { key: 'd / u', desc: '向下 / 向上滚动半屏' },
    ]},
    { title: '浏览历史', keys: [
      { key: 'H / L', desc: '后退 / 前进' },
      { key: 'r / R', desc: '刷新 / 硬刷新' },
    ]},
    { title: '标签管理', keys: [
      { key: 'J / K', desc: '上一个 / 下一个标签' },
      { key: 'g0 / g$', desc: '第一个 / 最后一个标签' },
      { key: '^', desc: '上一个访问的标签' },
      { key: 't', desc: '新建标签' },
      { key: 'x / X', desc: '关闭 / 恢复标签' },
      { key: 'yt', desc: '复制当前标签' },
      { key: 'W', desc: '移动到新窗口' },
      { key: 'Alt+P', desc: '固定 / 取消固定标签' },
    ]},
    { title: '链接跟随', keys: [
      { key: 'f', desc: '在当前标签页打开链接' },
      { key: 'F', desc: '在新标签页打开链接' },
    ]},
    { title: '搜索', keys: [
      { key: '/', desc: '搜索页面内容' },
      { key: 'n / N', desc: '下一个 / 上一个匹配' },
    ]},
    { title: 'URL 操作', keys: [
      { key: 'o', desc: '打开 URL' },
      { key: 'O', desc: '在新标签页打开 URL' },
      { key: 'ge', desc: '编辑当前 URL' },
    ]},
    { title: '复制', keys: [
      { key: 'yy', desc: '复制当前 URL' },
      { key: 'yf', desc: '复制链接 URL' },
    ]},
    { title: '其他', keys: [
      { key: 'gs', desc: '查看源代码' },
      { key: 'T', desc: '搜索标签' },
      { key: '?', desc: '显示此帮助' },
    ]},
  ];

  return categories.map(cat => `
    <div class="vimium-help-category">
      <div class="vimium-help-category-title">${cat.title}</div>
      ${cat.keys.map(k => `
        <div class="vimium-help-row">
          <span class="vimium-help-key">${k.key}</span>
          <span class="vimium-help-desc">${k.desc}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无 Vim 快捷键 | 完整的 Vimium 风格键盘操作 | Phase 39 | 提升键盘操作效率 |
| 只有 Accelerator 快捷键 | 扩展支持单键/双键序列 | Phase 39 | 需要新的状态机逻辑 |
| 无页面内搜索快捷键 | `/` 触发搜索模式 | Phase 39 | 复用 findInPage API |
| 无 hint overlay | `f`/`F` 触发链接跟随 | Phase 39 | 需要注入 DOM 到 guest |

**Deprecated/outdated:**
- 无（全新功能）

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | webview.executeJavaScript 可以在 guest 页面中创建和操作 DOM | Architecture | 如果不可行，需要改用 preload 脚本注入 |
| A2 | webview.findInPage API 在 Electron 32.x 中可用且行为稳定 | Code Examples | 如果不可用，需要改用 CDP 的 DOM.search |
| A3 | 双键序列（gg）的 500ms 超时是合理的用户体验 | Pattern 1 | 可能需要调整超时时间 |
| A4 | 内部页面（realm://）不需要 Vim 快捷键 | Anti-Patterns | 可能需要在内部页面也支持部分快捷键 |
| A5 | webview guest 的 preload 脚本可以发送 ipc-message 到 renderer | Pattern 2 | 如果不可行，需要改用其他通信方式 |

## Open Questions

1. **webview guest 中的焦点检测如何传递到主进程？**
   - What we know: webview-preload.js 已有 `ipcRenderer.sendToHost` 模式
   - What's unclear: 焦点状态需要实时同步，延迟是否可接受
   - Recommendation: 使用 sendToHost 发送 focus state，renderer 收到后通过 IPC 告知主进程

2. **Hint overlay 如何处理跨 iframe 的链接？**
   - What we know: Vimium 有复杂的跨 frame 通信机制
   - What's unclear: 是否需要在 v1 中支持
   - Recommendation: v1 只支持主 frame 的链接，跨 iframe 作为后续优化

3. **搜索模式的 n/N 如何与 findInPage API 配合？**
   - What we know: findInPage 返回 matchCount 和 activeMatchOrdinal
   - What's unclear: 如何在 guest 页面中显示匹配计数
   - Recommendation: 通过 webview 的 found-in-page 事件获取结果，更新注入的搜索栏 UI

## Environment Availability

> 本 Phase 无外部依赖，所有功能基于 Electron 内置 API。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 所有功能 | ✓ | 32.x | — |
| webview.executeJavaScript | 滚动/Hint/搜索 | ✓ | 内置 | — |
| webview.findInPage | 搜索模式 | ✓ | 内置 | — |
| Electron clipboard | 复制 URL | ✓ | 内置 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前没有测试框架） |
| Config file | none |
| Quick run command | `npm run dev`（手动验证） |
| Full suite command | `npm run dev`（手动验证） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIM-01 | 页面滚动 j/k/h/l | manual | `npm run dev` → 按 j/k/h/l 验证滚动 | ❌ |
| VIM-02 | 滚动首尾 gg/G | manual | `npm run dev` → 按 gg/G 验证 | ❌ |
| VIM-03 | 半屏滚动 d/u | manual | `npm run dev` → 按 d/u 验证 | ❌ |
| VIM-04 | 标签切换 J/K/gt/gT | manual | `npm run dev` → 按 J/K 验证 | ❌ |
| VIM-05 | 标签关闭/恢复 x/X | manual | `npm run dev` → 按 x/X 验证 | ❌ |
| VIM-06 | 浏览历史 H/L | manual | `npm run dev` → 按 H/L 验证 | ❌ |
| VIM-07 | 页面刷新 r/R | manual | `npm run dev` → 按 r/R 验证 | ❌ |
| VIM-08 | Hint Mode f/F | manual | `npm run dev` → 按 f 验证 hint overlay | ❌ |
| VIM-09 | 搜索模式 / | manual | `npm run dev` → 按 / 验证搜索栏 | ❌ |
| VIM-10 | 复制 URL yy | manual | `npm run dev` → 按 yy 验证剪贴板 | ❌ |
| VIM-11 | 设置页开关 | manual | `npm run dev` → 设置页验证开关 | ❌ |
| VIM-12 | 帮助对话框 ? | manual | `npm run dev` → 按 ? 验证帮助 | ❌ |

### Sampling Rate

- **Per task commit:** `npm run dev` → 手动验证对应功能
- **Per wave merge:** 全量手动验证所有已实现的快捷键
- **Phase gate:** 所有 P0 + P1 快捷键功能正常

### Wave 0 Gaps

- [ ] 无自动化测试框架（项目当前没有配置）
- [ ] 手动验证清单需要在 PLAN 中定义

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 检查 focus 元素类型，防止在输入框中触发快捷键 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + webview

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 注入脚本被页面恶意代码拦截 | Tampering | 使用 `world: 'MAIN'` 或 executeJavaScript 在隔离上下文执行 |
| 快捷键被钓鱼页面模拟 | Spoofing | 只在 Realm 管理的 webContents 中响应快捷键 |
| Hint overlay 泄露页面信息 | Information Disclosure | hint 只显示字母，不显示链接目标 URL |

## Sources

### Primary (HIGH confidence)

- Vimium 开源项目 `/Volumes/ZhiTai/Projects/github/vimium` — scroller.js、link_hints.js、mode_normal.js 的完整实现
- `shortcut-manager.js` — 现有快捷键基础设施，before-input-event 监听、Accelerator 匹配
- `src/renderer.js` — initShortcuts 分发逻辑、webview.executeJavaScript 使用模式
- `src/webview-preload.js` — contextBridge 暴露模式、ipcRenderer.sendToHost 通信

### Secondary (MEDIUM confidence)

- `39-CONTEXT.md` — 用户决策：D-01 到 D-22 的实现决策
- `39-UI-SPEC.md` — UI 设计规范：Hint 样式、搜索栏样式、帮助对话框布局

### Tertiary (LOW confidence)

- [ASSUMED] webview.executeJavaScript 的性能特征（注入延迟、执行上下文）

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 无新依赖，所有功能基于现有 Electron API
- Architecture: HIGH — 复用现有 shortcut-manager.js 基础设施，扩展模式清晰
- Pitfalls: MEDIUM — 焦点检测和跨 frame 通信有一定复杂度

**Research date:** 2026-08-23
**Valid until:** 2026-09-23（30 天，Electron API 稳定）

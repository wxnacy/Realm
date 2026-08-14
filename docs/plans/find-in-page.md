# Realm Browser - 页面内搜索功能（Find in Page）实现规划

## 📋 功能概述

实现类似 Chrome 的 Cmd+F 页面内搜索功能，支持在当前网页中搜索文本、高亮匹配项、导航到下一个/上一个匹配项。

## 🎯 核心需求

### 功能需求
1. **快捷键触发**：Cmd+F 打开搜索框，Esc 关闭
2. **实时搜索**：输入时实时搜索并高亮匹配项
3. **结果统计**：显示"当前项/总匹配数"（如 "3/15"）
4. **导航功能**：Enter 下一个，Shift+Enter 上一个，上下按钮
5. **搜索选项**：区分大小写开关
6. **跨 Tab 隔离**：每个 Tab 独立的搜索状态

### 用户体验需求
- 搜索框浮动在页面右上角（不遮挡地址栏）
- 输入延迟防抖（避免频繁搜索）
- 无匹配时显示醒目提示
- 关闭搜索框时清除所有高亮

## 🏗️ 技术方案

### 核心 API
使用 Electron webview 原生的 `findInPage` API：
```javascript
webview.findInPage(text, { forward, findNext, matchCase });
webview.on('found-in-page', callback);
webview.stopFindInPage('clearSelection');
```

### 架构设计
```
┌─────────────────────────────────────────────┐
│           渲染进程 (renderer.js)             │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │       FindInPage 管理器              │  │
│  │  - 搜索状态管理（per Tab）           │  │
│  │  - UI 控制（显示/隐藏/更新）         │  │
│  │  - 快捷键处理                        │  │
│  │  - 防抖逻辑                          │  │
│  └──────────────────────────────────────┘  │
│                     │                       │
│                     ▼                       │
│  ┌──────────────────────────────────────┐  │
│  │       webview.findInPage()           │  │
│  │  - 执行搜索                          │  │
│  │  - 监听 found-in-page 事件           │  │
│  │  - 管理高亮                          │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 📁 文件修改清单

### 1. `shortcut-manager.js` - 添加快捷键
**位置**：`DEFAULT_SHORTCUTS` 对象

```javascript
// 添加到第 39-51 行的 DEFAULT_SHORTCUTS 中
'findInPage': 'CmdOrCtrl+F',
```

**说明**：遵循项目规范，快捷键默认值只在此文件定义。

### 2. `src/index.html` - 添加搜索框 HTML
**位置**：`</body>` 之前（第 740 行左右）

```html
<!-- 页面内搜索框 -->
<div class="find-in-page hidden" id="findInPage">
  <div class="find-in-page-inner">
    <div class="find-input-wrapper">
      <input type="text"
             class="find-input"
             id="findInput"
             placeholder="搜索页面内容..."
             autocomplete="off"
             spellcheck="false">
      <span class="find-result-count" id="findResultCount"></span>
    </div>
    <div class="find-buttons">
      <button class="find-btn" id="findPrevBtn" title="上一个 (Shift+Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 15l-6-6-6 6"></path>
        </svg>
      </button>
      <button class="find-btn" id="findNextBtn" title="下一个 (Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </button>
      <button class="find-btn find-case-btn" id="findCaseBtn" title="区分大小写">
        <span>Aa</span>
      </button>
      <button class="find-btn find-close-btn" id="findCloseBtn" title="关闭 (Esc)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  </div>
</div>
```

### 3. `src/styles/main.css` - 添加搜索框样式
**位置**：文件末尾

```css
/* ==================== 页面内搜索框 ==================== */
.find-in-page {
  position: fixed;
  top: calc(var(--toolbar-height) + var(--tab-bar-height) + 8px);
  right: 16px;
  z-index: 1000;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 8px;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.find-in-page.hidden {
  display: none;
}

.find-in-page-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.find-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.find-input {
  width: 280px;
  height: 32px;
  padding: 0 80px 0 12px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.find-input:focus {
  border-color: var(--accent-color);
}

.find-input::placeholder {
  color: var(--text-secondary);
}

.find-result-count {
  position: absolute;
  right: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  pointer-events: none;
}

.find-result-count.no-match {
  color: #EF4444;
}

.find-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

.find-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.find-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.find-btn:active {
  background-color: var(--bg-active);
}

.find-case-btn {
  font-size: 12px;
  font-weight: 600;
  width: 36px;
}

.find-case-btn.active {
  background-color: var(--accent-color);
  color: white;
}

.find-close-btn {
  margin-left: 4px;
}

.find-close-btn:hover {
  background-color: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}
```

### 4. `src/renderer.js` - 添加搜索逻辑

#### 4.1 更新 elements 对象（第 8-100 行）
```javascript
// 在 elements 对象中添加
findInPage: document.getElementById('findInPage'),
findInput: document.getElementById('findInput'),
findResultCount: document.getElementById('findResultCount'),
findPrevBtn: document.getElementById('findPrevBtn'),
findNextBtn: document.getElementById('findNextBtn'),
findCaseBtn: document.getElementById('findCaseBtn'),
findCloseBtn: document.getElementById('findCloseBtn'),
```

#### 4.2 更新 state 对象（第 140-185 行）
```javascript
// 在 state 对象中添加
// 页面内搜索状态
findInPageOpen: false,
findInPageText: '',
findInPageMatchCase: false,
findInPageResults: { activeMatchOrdinal: 0, matches: 0 },
findInPageDebounceTimer: null,
```

#### 4.3 添加搜索功能函数（建议放在 initShortcuts 函数附近）
```javascript
// ==================== 页面内搜索功能 ====================

/**
 * 打开页面内搜索框
 * 聚焦输入框并选中文本
 */
function openFindInPage() {
  if (state.findInPageOpen) {
    // 已打开，聚焦输入框
    elements.findInput.focus();
    elements.findInput.select();
    return;
  }

  state.findInPageOpen = true;
  elements.findInPage.classList.remove('hidden');

  // 获取当前活动 webview 的选中文本作为初始搜索词
  const webview = state.webviews.get(state.activeTabId);
  if (webview) {
    // 注入选中文本检测脚本
    webview.executeJavaScript('window.getSelection().toString()')
      .then(selectedText => {
        if (selectedText && selectedText.trim()) {
          elements.findInput.value = selectedText.trim();
        }
        elements.findInput.focus();
        elements.findInput.select();
        // 如果有初始文本，立即搜索
        if (elements.findInput.value) {
          performFindInPage();
        }
      })
      .catch(() => {
        elements.findInput.focus();
      });
  }
}

/**
 * 关闭页面内搜索框
 * 清除高亮并重置状态
 */
function closeFindInPage() {
  if (!state.findInPageOpen) return;

  state.findInPageOpen = false;
  elements.findInPage.classList.add('hidden');
  elements.findInput.value = '';
  elements.findResultCount.textContent = '';
  elements.findResultCount.classList.remove('no-match');

  // 停止搜索并清除高亮
  const webview = state.webviews.get(state.activeTabId);
  if (webview) {
    webview.stopFindInPage('clearSelection');
  }

  // 清除防抖定时器
  if (state.findInPageDebounceTimer) {
    clearTimeout(state.findInPageDebounceTimer);
    state.findInPageDebounceTimer = null;
  }
}

/**
 * 执行页面内搜索
 * 调用 webview.findInPage API
 * @param {boolean} findNext - 是否查找下一个
 * @param {boolean} forward - 搜索方向（true=向下）
 */
function performFindInPage(findNext = false, forward = true) {
  const webview = state.webviews.get(state.activeTabId);
  if (!webview) return;

  const searchText = elements.findInput.value;

  // 空搜索：清除高亮
  if (!searchText) {
    elements.findResultCount.textContent = '';
    elements.findResultCount.classList.remove('no-match');
    webview.stopFindInPage('clearSelection');
    return;
  }

  // 执行搜索
  webview.findInPage(searchText, {
    forward: forward,
    findNext: findNext,
    matchCase: state.findInPageMatchCase
  });
}

/**
 * 处理搜索输入（带防抖）
 * 延迟 150ms 执行搜索，避免频繁调用
 */
function handleFindInPageInput() {
  // 清除之前的防抖定时器
  if (state.findInPageDebounceTimer) {
    clearTimeout(state.findInPageDebounceTimer);
  }

  // 设置新的防抖定时器
  state.findInPageDebounceTimer = setTimeout(() => {
    performFindInPage(false);
  }, 150);
}

/**
 * 切换大小写敏感
 */
function toggleFindInPageCaseSensitive() {
  state.findInPageMatchCase = !state.findInPageMatchCase;
  elements.findCaseBtn.classList.toggle('active', state.findInPageMatchCase);

  // 重新搜索
  performFindInPage(false);
}

/**
 * 初始化页面内搜索事件监听
 */
function initFindInPage() {
  // 输入事件（带防抖）
  elements.findInput.addEventListener('input', handleFindInPageInput);

  // 键盘事件
  elements.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performFindInPage(true, !e.shiftKey); // Shift+Enter 反向
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeFindInPage();
    }
  });

  // 按钮点击事件
  elements.findNextBtn.addEventListener('click', () => performFindInPage(true, true));
  elements.findPrevBtn.addEventListener('click', () => performFindInPage(true, false));
  elements.findCaseBtn.addEventListener('click', toggleFindInPageCaseSensitive);
  elements.findCloseBtn.addEventListener('click', closeFindInPage);

  // 监听 webview 的搜索结果事件
  // 注意：需要在 bindWebviewEvents 中为每个 webview 绑定
}

/**
 * 为 webview 绑定搜索结果监听
 * 在 bindWebviewEvents 中调用
 * @param {HTMLWebViewElement} webview - webview 元素
 */
function bindFindInPageEvents(webview) {
  webview.addEventListener('found-in-page', (event) => {
    const { activeMatchOrdinal, matches } = event.result;

    // 更新结果计数
    if (matches > 0) {
      elements.findResultCount.textContent = `${activeMatchOrdinal}/${matches}`;
      elements.findResultCount.classList.remove('no-match');
    } else {
      elements.findResultCount.textContent = '无匹配';
      elements.findResultCount.classList.add('no-match');
    }
  });
}
```

#### 4.4 更新 initShortcuts 函数（第 1244 行）
```javascript
// 在 switch 中添加
case 'findInPage':
  openFindInPage();
  break;
```

#### 4.5 更新 bindWebviewEvents 函数（第 823 行）
```javascript
// 在 bindWebviewEvents 函数中添加
bindFindInPageEvents(webview);
```

#### 4.6 添加到初始化流程
```javascript
// 在 DOMContentLoaded 事件监听器中添加
initFindInPage();
```

## 🔄 集成点清单

| 文件 | 修改位置 | 修改内容 |
|------|----------|----------|
| `shortcut-manager.js` | 第 39-51 行 | 添加 `'findInPage': 'CmdOrCtrl+F'` |
| `src/index.html` | 第 740 行前 | 添加搜索框 HTML 结构 |
| `src/styles/main.css` | 文件末尾 | 添加搜索框样式 |
| `src/renderer.js` | 第 8-100 行 | 更新 elements 对象 |
| `src/renderer.js` | 第 140-185 行 | 更新 state 对象 |
| `src/renderer.js` | 新增函数 | 添加搜索功能函数 |
| `src/renderer.js` | 第 1244 行 | 更新 initShortcuts switch |
| `src/renderer.js` | 第 823 行 | 更新 bindWebviewEvents |
| `src/renderer.js` | 初始化流程 | 调用 initFindInPage() |

## 🧪 测试场景

### 基础功能测试
1. ✅ Cmd+F 打开搜索框
2. ✅ Esc 关闭搜索框
3. ✅ 输入文本自动搜索（防抖）
4. ✅ Enter 导航到下一个匹配项
5. ✅ Shift+Enter 导航到上一个匹配项
6. ✅ 显示正确的结果计数（如 "3/15"）
7. ✅ 无匹配时显示红色"无匹配"

### 边界场景测试
1. ✅ 空搜索框不执行搜索
2. ✅ 切换 Tab 后搜索状态隔离
3. ✅ 关闭搜索框时清除高亮
4. ✅ 大小写切换重新搜索
5. ✅ 页面内选中文本自动填充搜索框

### 兼容性测试
1. ✅ 在普通网页上正常工作
2. ✅ 在 realm:// 内部页面上正常工作
3. ✅ 多个 Tab 独立搜索状态

## 📊 工作量估算

| 任务 | 预计时间 |
|------|----------|
| 添加快捷键 | 5 分钟 |
| 添加 HTML 结构 | 10 分钟 |
| 添加 CSS 样式 | 15 分钟 |
| 添加 JS 逻辑 | 30 分钟 |
| 集成测试 | 15 分钟 |
| **总计** | **75 分钟** |

## 🎨 UI 设计参考

```
┌────────────────────────────────────────────────────────────┐
│  [←] [→] [⟳]  │  🏠 默认  │  https://example.com    │  [⭐] [🕐] [📁] [🍪] [⚙️] [▶️] [🤖] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                     (网页内容区域)                          │
│                                                            │
│  ┌─────────────────────────────────────┐                  │
│  │  [搜索页面内容...        3/15] [▲][▼][Aa][✕] │  ← 浮动搜索框
│  └─────────────────────────────────────┘                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## ✅ 实施检查清单

- [ ] 1. 在 `shortcut-manager.js` 的 `DEFAULT_SHORTCUTS` 中添加 `'findInPage': 'CmdOrCtrl+F'`
- [ ] 2. 在 `src/index.html` 的 `</body>` 前添加搜索框 HTML
- [ ] 3. 在 `src/styles/main.css` 末尾添加搜索框样式
- [ ] 4. 在 `src/renderer.js` 的 `elements` 对象中添加搜索框元素引用
- [ ] 5. 在 `src/renderer.js` 的 `state` 对象中添加搜索状态字段
- [ ] 6. 在 `src/renderer.js` 中添加搜索功能函数（6 个函数）
- [ ] 7. 在 `src/renderer.js` 的 `initShortcuts` 中添加 `findInPage` case
- [ ] 8. 在 `src/renderer.js` 的 `bindWebviewEvents` 中调用 `bindFindInPageEvents`
- [ ] 9. 在初始化流程中调用 `initFindInPage()`
- [ ] 10. 测试所有功能点

---

**文档版本**：v1.0
**创建日期**：2026-08-11
**作者**：Realm Browser 开发团队

---
phase: 37
slug: url-autocomplete
status: complete
created: 2026-08-21
---

# Phase 37 Research: 地址栏地址补全功能

**Researched:** 2026-08-21
**Domain:** Electron 地址栏自动补全、SQLite 全文搜索、DOM 内联补全
**Confidence:** HIGH

## Summary

Phase 37 实现地址栏自动补全功能，参考 Chrome 地址栏行为：用户输入时实时匹配历史记录、收藏夹和常用网站，显示 inline completion 和下拉候选列表。

**核心发现：**
- 项目已有三个数据源管理器（history-manager、favorites-manager、frequent-sites-manager），均支持搜索/查询功能
- 历史记录按容器隔离存储（history_{containerId}），收藏夹全局共享，常用网站合并所有容器
- 现有 IPC 模式清晰：`ipcMain.handle('namespace:action', handler)` + `contextBridge.exposeInMainWorld`
- 渲染进程使用原生 JavaScript，无前端框架，DOM 操作集中在 `elements` 对象
- 深色主题 CSS 变量系统完善，可直接复用

**Primary recommendation:** 新增 `autocomplete:query` IPC 通道，在主进程合并三个数据源的查询结果，渲染进程实现 inline completion + dropdown UI。

## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: 补全数据源包含历史记录、收藏夹和常用网站三个来源
- D-02: 查询范围为全部容器数据合并
- D-03: 查询在主进程执行，渲染进程通过 IPC 请求
- D-04: 收藏夹优先级最高，其次为常用网站，最后为历史记录
- D-05: 匹配算法为 URL 前缀 + 标题子串匹配
- D-06: 匹配结果按 frecency 综合排序，收藏夹条目置顶
- D-07: inline completion 使用 Chrome 行为
- D-08: 按 Tab 或 Right 键接受 inline 补全
- D-09: 继续输入时 inline completion 实时更新
- D-10: 下拉候选列表最多显示 6 条
- D-11: 每个条目显示 favicon + 标题 + URL
- D-12: 键盘导航（上下键、Enter、Tab、Esc）
- D-13: 点击候选条目在当前 Tab 导航
- D-14: 候选列表样式与深色主题一致
- D-15: 输入防抖 100ms
- D-16: 查询结果缓存，相同前缀不重复查询

### Claude's Discretion
- 下拉列表的具体动画效果（展开/收起）
- 条目 hover 高亮的具体样式
- 无匹配结果时的提示文案
- favicon 缺失时的默认图标

### Deferred Ideas (OUT OF SCOPE)
None

## Existing Code Analysis

### history-manager.js

**位置：** `~/Projects/Realm/history-manager.js`

**关键方法：**
- `searchRecords(containerId, { keyword, offset, limit })` — 按 URL 或标题模糊匹配（LIKE 模式）
- `listRecords(containerId, { offset, limit })` — 按时间倒序列出
- `addRecord(containerId, { url, title, faviconUrl, visitedAt })` — 添加记录

**表结构：**
```sql
CREATE TABLE history_{containerId} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon_url TEXT DEFAULT '',
  visited_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX idx_{tableName}_visited_at ON {tableName} (visited_at DESC);
CREATE INDEX idx_{tableName}_url ON {tableName} (url);
```

**关键特性：**
- 每容器独立表（history_{containerId}）
- FIFO 淘汰：每容器上限 10000 条
- 使用 better-sqlite3，WAL 模式

**复用评估：** `searchRecords` 可直接复用，但需要遍历所有容器表进行 UNION ALL 查询。建议新增 `searchAllContainers(keyword, limit)` 方法。

---

### favorites-manager.js

**位置：** `~/Projects/Realm/favorites-manager.js`

**关键方法：**
- `searchFulltext({ keyword, limit })` — FTS5 全文搜索（支持中文分词）
- `searchRecords({ keyword, offset, limit })` — LIKE 模式搜索（FTS5 回退）
- `listRecords({ offset, limit, folderId })` — 列出收藏

**表结构：**
```sql
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon_url TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  folder_id INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(url)
);
CREATE VIRTUAL TABLE favorites_fts USING fts5(content, tokenize = 'unicode61');
```

**关键特性：**
- 全局共享（与容器解耦）
- FTS5 全文索引 + nodejieba 中文分词
- fractional indexing 排序

**复用评估：** `searchFulltext` 可直接复用，支持中文搜索。

---

### frequent-sites-manager.js

**位置：** `~/Projects/Realm/frequent-sites-manager.js`

**关键方法：**
- `getFrequentSites(limit)` — 获取常用网站列表（frecency 排序）

**Frecency 算法：**
```javascript
const FRECENCY_WEIGHTS = {
  RECENT_7_DAYS: 10,   // 最近 7 天：权重 10x
  RECENT_30_DAYS: 5,   // 最近 30 天：权重 5x
  RECENT_90_DAYS: 1,   // 最近 90 天：权重 1x
};
// score = visitCount * recencyWeight
```

**查询逻辑：**
- UNION ALL 合并所有 history_* 表
- 按域名聚合（去重）
- 只查最近 90 天
- 返回每个域名最后访问的 URL/标题/favicon

**复用评估：** `getFrequentSites` 可直接复用，但需要增加关键词过滤参数。建议新增 `searchFrequentSites(keyword, limit)` 方法。

---

### src/renderer.js

**位置：** `~/Projects/Realm/src/renderer.js`

**URL 输入框处理（第 4181-4224 行）：**
```javascript
elements.urlInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const url = elements.urlInput.value.trim();
    if (url) {
      const normalizedUrl = normalizeUrl(url);
      // 导航逻辑...
    }
  }
});
```

**关键状态：**
- `state.activeTabId` — 当前活动 Tab ID
- `state.tabs` — Tab Map
- `state.webviews` — Webview Map

**复用评估：** 需要在现有 keydown 监听器基础上增加：
- `input` 事件监听（防抖查询）
- `keydown` 事件扩展（ArrowUp/Down/Tab/Esc 处理）
- 新增 `state.autocomplete` 状态对象

---

### src/preload.js

**位置：** `~/Projects/Realm/src/preload.js`

**IPC 暴露模式：**
```javascript
contextBridge.exposeInMainWorld('realmAPI', {
  getContainers: () => ipcRenderer.invoke('container:list'),
  // ...
});
```

**复用评估：** 需要新增 `getAutocompleteSuggestions` 方法。

---

### ipc-handlers.js

**位置：** `~/Projects/Realm/ipc-handlers.js`

**IPC 注册模式：**
```javascript
ipcMain.handle('history:search', (event, data) => {
  assertTrustedSender(event);
  if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
    throw new Error('无效的搜索参数');
  }
  return historyManager.searchRecords(data.containerId, {
    keyword: data.keyword || '',
    offset: data.offset || 0,
    limit: data.limit || 50,
  });
});
```

**复用评估：** 需要新增 `autocomplete:query` 处理器。

---

### src/index.html

**位置：** `~/Projects/Realm/src/index.html`

**URL 输入框结构（第 186-192 行）：**
```html
<div class="toolbar-center">
  <div class="container-indicator" id="containerIndicator">
    <span class="indicator-icon" id="indicatorIcon"></span>
    <span class="indicator-text">默认</span>
  </div>
  <input type="text" class="url-input" id="urlInput" placeholder="输入网址或搜索...">
</div>
```

**复用评估：** 需要在 `.toolbar-center` 内添加：
- `.autocomplete-dropdown` 下拉容器
- `.autocomplete-inline` 内联补全层

---

### src/styles/main.css

**位置：** `~/Projects/Realm/src/styles/main.css`

**CSS 变量系统：**
```css
:root, [data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --bg-tertiary: #3a3a3a;
  --bg-hover: #404040;
  --text-primary: #f0f0f0;
  --text-secondary: #a0a0a0;
  --text-muted: #6b7280;
  --border-color: #404040;
  --accent-color: #3B82F6;
}
```

**现有下拉框样式（bookmarks-dropdown）：**
```css
.bookmarks-dropdown {
  position: fixed;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 99999;
  opacity: 0;
  transform: scale(0.96);
  transition: opacity 0.08s ease, transform 0.08s ease;
  pointer-events: none;
}
.bookmarks-dropdown.visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
```

**复用评估：** 可复用 bookmarks-dropdown 的动画模式，但使用 `position: absolute` 锚定在 toolbar-center 下方。

---

## Technical Approach

### 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  URL Input (elements.urlInput)                           │   │
│  │  ├── input event → debounce 100ms → IPC call            │   │
│  │  ├── keydown event → keyboard navigation                │   │
│  │  └── blur event → close dropdown                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│  ┌────────▼─────────────────────────────────────────────────┐   │
│  │  Autocomplete State (state.autocomplete)                 │   │
│  │  ├── query: string                                       │   │
│  │  ├── suggestions: Array                                  │   │
│  │  ├── selectedIndex: number                               │   │
│  │  ├── inlineText: string                                  │   │
│  │  └── isOpen: boolean                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│  ┌────────▼─────────────────────────────────────────────────┐   │
│  │  UI Components                                            │   │
│  │  ├── .autocomplete-dropdown (position: absolute)         │   │
│  │  │   └── .autocomplete-item (max 6)                      │   │
│  │  └── .autocomplete-inline (position: absolute, overlay)  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ IPC: autocomplete:query
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Main Process                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  autocomplete:query handler                              │   │
│  │  ├── Validate input (assertTrustedSender)                │   │
│  │  ├── Query favorites (searchFulltext)                    │   │
│  │  ├── Query frequent sites (searchFrequentSites)          │   │
│  │  ├── Query history (searchAllContainers)                 │   │
│  │  ├── Merge & sort (favorites first, then frecency)       │   │
│  │  └── Return top 6 results                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Main Process (IPC + Data Merging)

#### 1. 新增 IPC 处理器

**文件：** `ipc-handlers.js`

**通道名：** `autocomplete:query`

**实现方案：**
```javascript
/**
 * 地址栏自动补全查询
 * @param {Object} data - 查询参数
 * @param {string} data.keyword - 用户输入关键词
 * @param {number} [data.limit=6] - 返回结果数量限制
 * @returns {Array} 补全建议列表
 */
ipcMain.handle('autocomplete:query', (event, data) => {
  assertTrustedSender(event);
  if (!data || typeof data !== 'object' || typeof data.keyword !== 'string') {
    throw new Error('无效的查询参数');
  }
  return autocompleteManager.getSuggestions(data.keyword, data.limit || 6);
});
```

#### 2. 新增 autocomplete-manager.js

**位置：** `~/Projects/Realm/autocomplete-manager.js`

**职责：**
- 合并三个数据源的查询结果
- 实现匹配算法（URL 前缀 + 标题子串）
- 按 frecency 排序，收藏夹置顶
- 实现查询结果缓存

**核心方法：**
```javascript
/**
 * 获取补全建议
 * @param {string} keyword - 用户输入
 * @param {number} limit - 返回数量限制
 * @returns {Array} 补全建议列表
 */
function getSuggestions(keyword, limit = 6) {
  // 1. 检查缓存
  const cacheKey = `${keyword.toLowerCase()}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // 2. 查询三个数据源
  const favorites = queryFavorites(keyword, limit);
  const frequentSites = queryFrequentSites(keyword, limit);
  const history = queryHistory(keyword, limit);

  // 3. 合并去重（URL 去重）
  const merged = mergeResults(favorites, frequentSites, history);

  // 4. 排序：收藏夹置顶，其余按 frecency
  const sorted = sortResults(merged);

  // 5. 截取 top N
  const result = sorted.slice(0, limit);

  // 6. 缓存结果
  cache.set(cacheKey, result);

  return result;
}
```

**匹配算法（D-05）：**
```javascript
/**
 * 检查记录是否匹配关键词
 * @param {Object} record - 记录 { url, title }
 * @param {string} keyword - 关键词
 * @returns {boolean} 是否匹配
 */
function matchesKeyword(record, keyword) {
  const lowerKeyword = keyword.toLowerCase();
  const lowerUrl = record.url.toLowerCase();
  const lowerTitle = (record.title || '').toLowerCase();

  // URL 前缀匹配（去除协议）
  const urlWithoutProtocol = lowerUrl.replace(/^https?:\/\//, '');
  if (urlWithoutProtocol.startsWith(lowerKeyword)) {
    return true;
  }

  // 标题子串匹配
  if (lowerTitle.includes(lowerKeyword)) {
    return true;
  }

  return false;
}
```

**缓存策略（D-16）：**
```javascript
// LRU 缓存，最多 100 条，相同前缀命中缓存
const cache = new Map();
const CACHE_MAX_SIZE = 100;

function getCachedResult(keyword) {
  const key = keyword.toLowerCase();
  if (cache.has(key)) {
    return cache.get(key);
  }
  // 检查更长前缀的缓存（例如 "gi" 命中 "git" 的缓存子集）
  for (const [cachedKey, cachedValue] of cache) {
    if (key.startsWith(cachedKey)) {
      // 过滤匹配的结果
      return cachedValue.filter(item => matchesKeyword(item, keyword));
    }
  }
  return null;
}
```

#### 3. 数据源查询方法

**history-manager.js 新增方法：**
```javascript
/**
 * 搜索所有容器的历史记录（用于自动补全）
 * @param {string} keyword - 关键词
 * @param {number} limit - 返回数量限制
 * @returns {Array} 匹配的记录列表
 */
function searchAllContainers(keyword, limit = 20) {
  // 获取所有 history_* 表
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name LIKE 'history_%'
  `).all();

  if (tables.length === 0) return [];

  // 构建 UNION ALL 查询
  const unionQueries = tables.map(table => `
    SELECT url, title, favicon_url, visited_at
    FROM ${table.name}
    WHERE url LIKE ? OR title LIKE ?
  `).join(' UNION ALL ');

  const pattern = `%${keyword}%`;
  const params = tables.flatMap(() => [pattern, pattern]);

  return db.prepare(`
    ${unionQueries}
    ORDER BY visited_at DESC
    LIMIT ?
  `).all(...params, limit);
}
```

**frequent-sites-manager.js 新增方法：**
```javascript
/**
 * 搜索常用网站（用于自动补全）
 * @param {string} keyword - 关键词
 * @param {number} limit - 返回数量限制
 * @returns {Array} 匹配的常用网站列表
 */
function searchFrequentSites(keyword, limit = 10) {
  // 先获取常用网站（带 frecency 排序）
  const frequentSites = getFrequentSites(100); // 获取更多以便过滤

  // 过滤匹配的记录
  const lowerKeyword = keyword.toLowerCase();
  return frequentSites.filter(site => {
    const urlWithoutProtocol = site.url.replace(/^https?:\/\//, '').toLowerCase();
    const title = (site.title || '').toLowerCase();
    return urlWithoutProtocol.startsWith(lowerKeyword) || title.includes(lowerKeyword);
  }).slice(0, limit);
}
```

### Renderer (UI + Interaction)

#### 1. 新增 DOM 元素

**文件：** `src/index.html`

**修改位置：** `.toolbar-center` 内部（第 186-192 行之后）

```html
<div class="toolbar-center">
  <div class="container-indicator" id="containerIndicator">
    <span class="indicator-icon" id="indicatorIcon"></span>
    <span class="indicator-text">默认</span>
  </div>
  <div class="url-input-wrapper">
    <input type="text" class="url-input" id="urlInput" placeholder="输入网址或搜索...">
    <span class="autocomplete-inline" id="autocompleteInline"></span>
  </div>
  <div class="autocomplete-dropdown" id="autocompleteDropdown">
    <!-- 动态生成的候选列表项 -->
  </div>
</div>
```

#### 2. 新增状态对象

**文件：** `src/renderer.js`

```javascript
// 自动补全状态
state.autocomplete = {
  query: '',              // 当前查询关键词
  suggestions: [],        // 候选列表
  selectedIndex: -1,      // 键盘选中索引（-1 表示无选中）
  inlineText: '',         // 内联补全文本
  isOpen: false,          // 下拉框是否打开
  debounceTimer: null,    // 防抖定时器
  cache: new Map(),       // 查询缓存
};
```

#### 3. 新增 DOM 元素引用

**文件：** `src/renderer.js` (elements 对象)

```javascript
const elements = {
  // ... 现有元素 ...
  urlInputWrapper: document.querySelector('.url-input-wrapper'),
  autocompleteInline: document.getElementById('autocompleteInline'),
  autocompleteDropdown: document.getElementById('autocompleteDropdown'),
};
```

#### 4. 核心交互逻辑

**文件：** `src/renderer.js`

```javascript
/**
 * 初始化地址栏自动补全
 */
function initAutocomplete() {
  // input 事件：防抖查询
  elements.urlInput.addEventListener('input', handleAutocompleteInput);

  // keydown 事件：键盘导航
  elements.urlInput.addEventListener('keydown', handleAutocompleteKeydown);

  // blur 事件：关闭下拉框（延迟，允许点击候选条目）
  elements.urlInput.addEventListener('blur', () => {
    setTimeout(() => closeAutocomplete(), 150);
  });

  // focus 事件：重新打开（如果有内容）
  elements.urlInput.addEventListener('focus', () => {
    if (state.autocomplete.query) {
      openAutocomplete();
    }
  });
}

/**
 * 处理输入事件（防抖 100ms）
 */
function handleAutocompleteInput() {
  const query = elements.urlInput.value.trim();

  // 清除之前的防抖定时器
  if (state.autocomplete.debounceTimer) {
    clearTimeout(state.autocomplete.debounceTimer);
  }

  // 空输入：关闭补全
  if (!query) {
    closeAutocomplete();
    return;
  }

  // 防抖 100ms
  state.autocomplete.debounceTimer = setTimeout(async () => {
    state.autocomplete.query = query;

    // 检查缓存
    const cached = getCachedSuggestions(query);
    if (cached) {
      updateAutocompleteUI(cached);
      return;
    }

    // IPC 查询
    try {
      const suggestions = await window.realmAPI.getAutocompleteSuggestions(query);
      cacheSuggestions(query, suggestions);
      updateAutocompleteUI(suggestions);
    } catch (err) {
      console.error('[Realm Renderer] 自动补全查询失败:', err);
    }
  }, 100);
}

/**
 * 处理键盘事件
 */
function handleAutocompleteKeydown(e) {
  if (!state.autocomplete.isOpen) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      navigateAutocomplete(1); // 下移
      break;

    case 'ArrowUp':
      e.preventDefault();
      navigateAutocomplete(-1); // 上移
      break;

    case 'Enter':
      if (state.autocomplete.selectedIndex >= 0) {
        e.preventDefault();
        selectAutocompleteItem(state.autocomplete.selectedIndex);
      }
      // 否则走原有的 Enter 导航逻辑
      break;

    case 'Tab':
      if (state.autocomplete.inlineText) {
        e.preventDefault();
        acceptInlineCompletion();
      }
      break;

    case 'ArrowRight':
      // 光标在末尾时接受 inline 补全
      if (elements.urlInput.selectionStart === elements.urlInput.value.length &&
          state.autocomplete.inlineText) {
        e.preventDefault();
        acceptInlineCompletion();
      }
      break;

    case 'Escape':
      e.preventDefault();
      closeAutocomplete();
      break;
  }
}

/**
 * 更新自动补全 UI
 */
function updateAutocompleteUI(suggestions) {
  state.autocomplete.suggestions = suggestions;
  state.autocomplete.selectedIndex = -1;

  if (suggestions.length === 0) {
    closeAutocomplete();
    return;
  }

  // 更新 inline completion（第一条建议）
  updateInlineCompletion(suggestions[0]);

  // 更新下拉列表
  renderAutocompleteDropdown(suggestions);

  // 打开下拉框
  openAutocomplete();
}

/**
 * 更新内联补全文本
 */
function updateInlineCompletion(suggestion) {
  const query = state.autocomplete.query;
  const url = suggestion.url;

  // 找到 URL 中匹配查询的部分，补全剩余部分
  const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
  const matchIndex = urlWithoutProtocol.toLowerCase().indexOf(query.toLowerCase());

  if (matchIndex === 0) {
    // URL 前缀匹配：补全剩余部分
    const completion = urlWithoutProtocol.slice(query.length);
    state.autocomplete.inlineText = completion;

    // 显示 inline 补全（覆盖在 input 上方）
    elements.autocompleteInline.textContent = query + completion;
    elements.autocompleteInline.style.display = 'block';
  } else {
    state.autocomplete.inlineText = '';
    elements.autocompleteInline.style.display = 'none';
  }
}

/**
 * 渲染下拉候选列表
 */
function renderAutocompleteDropdown(suggestions) {
  const dropdown = elements.autocompleteDropdown;
  dropdown.innerHTML = '';

  suggestions.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    if (index === state.autocomplete.selectedIndex) {
      el.classList.add('selected');
    }

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'autocomplete-item-favicon';
    favicon.src = item.faviconUrl || '';
    favicon.onerror = () => {
      favicon.style.display = 'none';
      // 显示默认图标
      const fallback = document.createElement('div');
      fallback.className = 'autocomplete-item-favicon-fallback';
      fallback.innerHTML = '<svg>...</svg>';
      el.insertBefore(fallback, el.firstChild);
    };

    // 文字区域
    const textContainer = document.createElement('div');
    textContainer.className = 'autocomplete-item-text';

    const title = document.createElement('div');
    title.className = 'autocomplete-item-title';
    title.textContent = item.title || item.url;

    const url = document.createElement('div');
    url.className = 'autocomplete-item-url';
    url.textContent = item.url;

    textContainer.appendChild(title);
    textContainer.appendChild(url);

    // 来源标签（可选）
    if (item.source) {
      const badge = document.createElement('span');
      badge.className = 'autocomplete-item-badge';
      badge.textContent = item.source === 'favorite' ? '收藏' :
                          item.source === 'frequent' ? '常用' : '历史';
      el.appendChild(badge);
    }

    el.appendChild(favicon);
    el.appendChild(textContainer);

    // 点击事件
    el.addEventListener('mousedown', (e) => {
      e.preventDefault(); // 阻止 blur
      selectAutocompleteItem(index);
    });

    // hover 高亮
    el.addEventListener('mouseenter', () => {
      state.autocomplete.selectedIndex = index;
      updateDropdownHighlight();
    });

    dropdown.appendChild(el);
  });
}

/**
 * 键盘导航
 */
function navigateAutocomplete(direction) {
  const { suggestions, selectedIndex } = state.autocomplete;
  const maxIndex = suggestions.length - 1;

  let newIndex = selectedIndex + direction;
  if (newIndex < 0) newIndex = maxIndex;
  if (newIndex > maxIndex) newIndex = 0;

  state.autocomplete.selectedIndex = newIndex;
  updateDropdownHighlight();
  updateInlineCompletion(suggestions[newIndex]);
}

/**
 * 更新下拉框高亮
 */
function updateDropdownHighlight() {
  const items = elements.autocompleteDropdown.querySelectorAll('.autocomplete-item');
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === state.autocomplete.selectedIndex);
  });
}

/**
 * 选择候选条目
 */
function selectAutocompleteItem(index) {
  const suggestion = state.autocomplete.suggestions[index];
  if (!suggestion) return;

  // 设置 URL 输入框值
  elements.urlInput.value = suggestion.url;

  // 关闭补全
  closeAutocomplete();

  // 导航到 URL
  navigateToUrl(suggestion.url);
}

/**
 * 接受内联补全
 */
function acceptInlineCompletion() {
  if (!state.autocomplete.inlineText) return;

  // 将补全文本合并到输入框
  elements.urlInput.value = elements.urlInput.value + state.autocomplete.inlineText;

  // 清除 inline 状态
  state.autocomplete.inlineText = '';
  elements.autocompleteInline.style.display = 'none';

  // 关闭下拉框
  closeAutocomplete();

  // 将光标移到末尾
  elements.urlInput.setSelectionRange(
    elements.urlInput.value.length,
    elements.urlInput.value.length
  );
}

/**
 * 打开下拉框
 */
function openAutocomplete() {
  state.autocomplete.isOpen = true;
  elements.autocompleteDropdown.classList.add('visible');
}

/**
 * 关闭下拉框
 */
function closeAutocomplete() {
  state.autocomplete.isOpen = false;
  state.autocomplete.selectedIndex = -1;
  state.autocomplete.inlineText = '';
  elements.autocompleteDropdown.classList.remove('visible');
  elements.autocompleteInline.style.display = 'none';
}
```

#### 5. Preload 暴露

**文件：** `src/preload.js`

```javascript
/**
 * 获取地址栏自动补全建议
 * @param {string} keyword - 用户输入关键词
 * @returns {Promise<Array>} 补全建议列表
 */
getAutocompleteSuggestions: (keyword) => ipcRenderer.invoke('autocomplete:query', { keyword }),
```

### Performance Strategy

#### 1. 防抖（D-15）

```javascript
// 100ms 防抖，平衡实时响应和查询性能
const DEBOUNCE_DELAY = 100;

let debounceTimer = null;
elements.urlInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // 查询逻辑
  }, DEBOUNCE_DELAY);
});
```

#### 2. 查询缓存（D-16）

```javascript
// 客户端缓存：相同前缀不重复查询
const clientCache = new Map();
const CLIENT_CACHE_MAX = 50;

function getCachedSuggestions(keyword) {
  const key = keyword.toLowerCase();
  if (clientCache.has(key)) {
    return clientCache.get(key);
  }
  // 检查更短前缀的缓存（优化连续输入场景）
  for (const [cachedKey, cachedValue] of clientCache) {
    if (key.startsWith(cachedKey) && cachedValue.length > 0) {
      // 过滤匹配更长前缀的结果
      return cachedValue.filter(item => matchesKeyword(item, keyword));
    }
  }
  return null;
}
```

#### 3. 主进程缓存

```javascript
// 主进程 LRU 缓存
const serverCache = new Map();
const SERVER_CACHE_MAX = 100;

// 缓存清理：定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of serverCache) {
    if (now - entry.timestamp > 60000) { // 1 分钟过期
      serverCache.delete(key);
    }
  }
}, 30000);
```

#### 4. 查询优化

```javascript
// 限制查询范围
const MAX_HISTORY_RESULTS = 20;  // 历史记录最多返回 20 条
const MAX_FAVORITES_RESULTS = 10; // 收藏夹最多返回 10 条
const MAX_FREQUENT_RESULTS = 10;  // 常用网站最多返回 10 条

// 使用 LIMIT 限制数据库查询
db.prepare(`SELECT ... LIMIT ?`).all(limit);
```

---

## Integration Points

### 1. ipc-handlers.js

**修改：** 新增 `autocomplete:query` 处理器

**位置：** 在 `history:search` 处理器之后

**代码：**
```javascript
ipcMain.handle('autocomplete:query', (event, data) => {
  assertTrustedSender(event);
  if (!data || typeof data !== 'object' || typeof data.keyword !== 'string') {
    throw new Error('无效的查询参数');
  }
  return autocompleteManager.getSuggestions(data.keyword, data.limit || 6);
});
```

### 2. src/preload.js

**修改：** 新增 `getAutocompleteSuggestions` 方法

**位置：** 在 `getTabs` 之后

**代码：**
```javascript
getAutocompleteSuggestions: (keyword) => ipcRenderer.invoke('autocomplete:query', { keyword }),
```

### 3. src/index.html

**修改：** 在 `.toolbar-center` 内添加下拉框容器

**位置：** 第 191 行之后

**代码：**
```html
<div class="url-input-wrapper">
  <input type="text" class="url-input" id="urlInput" placeholder="输入网址或搜索...">
  <span class="autocomplete-inline" id="autocompleteInline"></span>
</div>
<div class="autocomplete-dropdown" id="autocompleteDropdown"></div>
```

### 4. src/renderer.js

**修改：**
- 在 `elements` 对象中添加新元素引用
- 在 `state` 对象中添加 `autocomplete` 状态
- 在 `setupEventListeners()` 中调用 `initAutocomplete()`
- 新增自动补全相关函数

### 5. src/styles/main.css

**修改：** 新增自动补全样式

**位置：** 在 `.url-input` 样式之后

### 6. 新增文件：autocomplete-manager.js

**位置：** `~/Projects/Realm/autocomplete-manager.js`

**职责：** 合并三个数据源的查询结果，实现匹配和排序算法

---

## Validation Architecture

### Test Scenarios

| 场景 | 描述 | 预期结果 |
|------|------|----------|
| 基本补全 | 输入 "gith" | 显示 github.com 相关建议 |
| 收藏夹优先 | 输入已收藏的 URL 前缀 | 收藏夹条目置顶 |
| 中文搜索 | 输入中文标题关键词 | FTS5 分词匹配 |
| 键盘导航 | ArrowDown/Up | 选中项高亮切换 |
| Tab 接受 | 按 Tab | inline 补全文本合并 |
| Esc 关闭 | 按 Esc | 下拉框关闭 |
| 点击选择 | 点击候选条目 | 导航到对应 URL |
| 防抖验证 | 快速输入 | 100ms 后才查询 |
| 缓存命中 | 重复输入相同前缀 | 直接使用缓存 |
| 空输入 | 清空输入框 | 下拉框关闭 |

### Performance Benchmarks

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 查询延迟 | < 50ms | 从 input 事件到 UI 更新 |
| 防抖延迟 | 100ms ± 10ms | 从输入到查询触发 |
| 内存占用 | < 5MB | 缓存 + DOM 节点 |
| 首次查询 | < 100ms | 冷启动首次输入 |

### Manual Test Plan

1. **基本功能测试**
   - 输入 URL 前缀，验证补全建议
   - 输入标题关键词，验证匹配
   - 验证收藏夹条目置顶

2. **键盘交互测试**
   - ArrowDown/Up 导航
   - Tab 接受 inline 补全
   - Enter 跳转选中条目
   - Esc 关闭下拉框

3. **鼠标交互测试**
   - 点击候选条目
   - hover 高亮
   - 点击外部关闭

4. **性能测试**
   - 快速输入验证防抖
   - 重复输入验证缓存
   - 大量历史记录场景

---

## Risk Analysis

### Risk 1: 性能问题（大量历史记录）

**风险：** 每个容器最多 10000 条历史记录，多容器合并查询可能较慢

**缓解：**
- 使用 LIMIT 限制查询范围
- 主进程缓存查询结果
- 客户端缓存减少 IPC 调用
- 只查询最近 90 天的记录

**监控：** 测量查询延迟，超过 100ms 时优化

### Risk 2: Inline Completion 对齐问题

**风险：** 不同字体、字号下，inline 补全文本可能与输入框文本不对齐

**缓解：**
- 使用与 input 完全一致的字体样式
- 使用 `position: absolute` 精确覆盖
- 测试不同浏览器缩放级别

**验证：** 视觉回归测试

### Risk 3: 跨平台键盘行为差异

**风险：** macOS/Windows/Linux 的 Tab/Arrow 键行为可能不同

**缓解：**
- 参考 Chrome 的键盘行为规范
- 使用 `e.preventDefault()` 阻止默认行为
- 测试三个平台

**验证：** 跨平台手动测试

### Risk 4: FTS5 中文分词依赖

**风险：** nodejieba 是原生模块，打包后需要特殊处理

**缓解：**
- 已有 nodejieba 打包经验（favorites-manager.js）
- FTS5 不可用时回退到 LIKE 模式

**验证：** 打包后测试中文搜索

### Risk 5: 缓存一致性

**风险：** 用户新增/删除历史记录后，缓存可能过期

**缓解：**
- 缓存过期时间 1 分钟
- 新增记录时清除相关缓存
- 使用 LRU 策略自动淘汰

**验证：** 测试新增记录后查询更新

---

## Implementation Sequence

### Wave 1: 主进程数据层

1. **新增 autocomplete-manager.js**
   - 实现 `getSuggestion(keyword, limit)` 方法
   - 实现匹配算法（URL 前缀 + 标题子串）
   - 实现 frecency 排序
   - 实现查询缓存

2. **修改 history-manager.js**
   - 新增 `searchAllContainers(keyword, limit)` 方法

3. **修改 frequent-sites-manager.js**
   - 新增 `searchFrequentSites(keyword, limit)` 方法

4. **修改 ipc-handlers.js**
   - 新增 `autocomplete:query` 处理器

### Wave 2: 渲染进程 UI 层

5. **修改 src/index.html**
   - 添加 `.url-input-wrapper` 和 `.autocomplete-dropdown` 容器

6. **修改 src/styles/main.css**
   - 新增自动补全相关样式

7. **修改 src/preload.js**
   - 新增 `getAutocompleteSuggestions` 方法

8. **修改 src/renderer.js**
   - 添加 `state.autocomplete` 状态
   - 实现 `initAutocomplete()` 初始化
   - 实现 `handleAutocompleteInput()` 输入处理
   - 实现 `handleAutocompleteKeydown()` 键盘处理
   - 实现 `updateAutocompleteUI()` UI 更新
   - 实现 `renderAutocompleteDropdown()` 列表渲染
   - 实现 `updateInlineCompletion()` 内联补全
   - 实现 `navigateAutocomplete()` 键盘导航
   - 实现 `selectAutocompleteItem()` 条目选择
   - 实现 `acceptInlineCompletion()` 接受补全
   - 实现 `openAutocomplete()` / `closeAutocomplete()` 开关

### Wave 3: 集成测试

9. **功能测试**
   - 基本补全流程
   - 键盘交互
   - 鼠标交互

10. **性能测试**
    - 防抖验证
    - 缓存验证
    - 大数据量测试

11. **视觉测试**
    - 深色/浅色主题
    - 不同缩放级别
    - 动画效果

---

## State of the Art

| 旧/当前做法 | 新做法 | 影响 |
|-------------|--------|------|
| 地址栏只支持 Enter 导航 | 输入时实时补全 | 提升用户体验 |
| 无补全建议 | 下拉候选列表 + inline completion | 参考 Chrome 行为 |
| 每次查询都走 IPC | 客户端 + 服务端双重缓存 | 提升性能 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | history-manager.js 的 searchRecords 方法使用 LIKE 模式 | Existing Code Analysis | 可能需要改为 FTS5 |
| A2 | frequent-sites-manager.js 的 getFrequentSites 返回 frecency 排序结果 | Existing Code Analysis | 排序逻辑可能需要调整 |
| A3 | 现有 bookmarks-dropdown 的动画模式可复用于 autocomplete-dropdown | Technical Approach | 可能需要自定义动画 |

---

## Open Questions

1. **Q: 是否需要支持 URL 协议匹配？**
   - 现状：只匹配 http/https
   - 建议：暂不支持 realm:// 协议，后续可扩展

2. **Q: 是否需要显示来源标签（收藏/常用/历史）？**
   - 现状：CONTEXT.md 未明确要求
   - 建议：作为 Claude's Discretion，可选显示

3. **Q: 是否需要支持搜索建议（Google/Bing）？**
   - 现状：只匹配本地数据
   - 建议：Phase 37 不包含，后续可扩展

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: 代码分析] history-manager.js — 搜索方法和表结构
- [VERIFIED: 代码分析] favorites-manager.js — FTS5 全文搜索实现
- [VERIFIED: 代码分析] frequent-sites-manager.js — frecency 算法
- [VERIFIED: 代码分析] ipc-handlers.js — IPC 注册模式
- [VERIFIED: 代码分析] src/renderer.js — URL 输入框处理
- [VERIFIED: 代码分析] src/preload.js — contextBridge 暴露模式
- [VERIFIED: 代码分析] src/index.html — toolbar-center 结构
- [VERIFIED: 代码分析] src/styles/main.css — CSS 变量系统

### Secondary (MEDIUM confidence)
- [CITED: CONTEXT.md] 实现决策 D-01 到 D-16
- [CITED: 37-UI-SPEC.md] UI 设计合同

### Tertiary (LOW confidence)
- [ASSUMED] bookmarks-dropdown 动画模式可直接复用

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 基于现有代码分析，无新依赖
- Architecture: HIGH — 复用现有 IPC 模式和数据源
- Pitfalls: MEDIUM — 性能和对齐问题需要实际测试

**Research date:** 2026-08-21
**Valid until:** 2026-09-21 (30 days — 稳定技术栈)

---

## RESEARCH COMPLETE

Phase 37 地址栏地址补全功能的技术研究已完成。研究基于对现有代码库的深入分析，覆盖了数据层、IPC 通信层、UI 层的完整技术方案。所有实现决策均与 CONTEXT.md 中的锁定决策对齐，可直接进入规划阶段。

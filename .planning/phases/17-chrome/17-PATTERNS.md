# Phase 17: Chrome 书签导入 - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `favorites-manager.js` | service | CRUD + batch | `favorites-manager.js` (现有 addRecord/createFolder) | exact |
| `src/favorites-page.js` | component | request-response | `src/favorites-page.js` (现有 loadFavorites) | exact |
| `src/favorites.html` | component | request-response | `src/favorites.html` (现有 dialog 结构) | exact |
| `main.js` | controller | request-response | `main.js` (现有 handleFavoritesApi) | exact |
| `src/preload.js` | provider | request-response | `src/preload.js` (现有 favoritesCheck) | exact |
| `src/styles/main.css` | config | N/A | `src/styles/main.css` (现有 modal/btn 样式) | exact |

## Pattern Assignments

### `favorites-manager.js` (service, CRUD + batch)

**Analog:** `favorites-manager.js` 现有 addRecord + createFolder + batchUpdateSort

**现有批量操作模式** (lines 666-682):
```javascript
/**
 * 批量更新收藏项排序
 * 使用事务包裹所有更新，确保原子性。
 * @param {Array<{id: number, sort_order: string}>} items - 排序更新数组
 * @returns {number} 更新的记录数
 */
function batchUpdateSort(items) {
  ensureTable();

  if (!Array.isArray(items) || items.length === 0) return 0;

  const updateStmt = db.prepare('UPDATE favorites SET sort_order = ? WHERE id = ?');
  const updateMany = db.transaction((rows) => {
    let count = 0;
    for (const { id, sort_order } of rows) {
      const result = updateStmt.run(sort_order, id);
      count += result.changes;
    }
    return count;
  });

  return updateMany(items);
}
```

**现有 addRecord 模式（INSERT OR IGNORE 去重）** (lines 275-290):
```javascript
/**
 * 添加收藏记录
 * @param {Object} record - 记录数据
 * @param {string} record.url - 页面 URL
 * @param {string} [record.title] - 页面标题
 * @param {string} [record.faviconUrl] - favicon URL
 * @returns {{id: number}|{error: string, message: string}} 新记录的 ID 或重复错误
 */
function addRecord({ url, title = '', faviconUrl = '' }) {
  ensureTable();

  // 使用 INSERT OR IGNORE 处理 UNIQUE 约束冲突
  const result = db.prepare(`
    INSERT OR IGNORE INTO favorites (url, title, favicon_url)
    VALUES (?, ?, ?)
  `).run(url, title, faviconUrl);

  // lastInsertRowid 为 0 表示插入被忽略（URL 已存在）
  if (result.lastInsertRowid === 0n || result.lastInsertRowid === 0) {
    return { error: 'duplicate', message: '已收藏过该页面' };
  }

  return { id: result.lastInsertRowid };
}
```

**现有 createFolder 模式** (lines 443-465):
```javascript
/**
 * 创建收藏夹文件夹
 * @param {Object} options
 * @param {string} options.name - 文件夹名称
 * @param {number} [options.parentId=0] - 父文件夹 ID（0 表示根目录）
 * @returns {{id: number}|{error: string, message: string}} 新文件夹 ID 或错误
 */
function createFolder({ name, parentId = 0 }) {
  ensureTable();

  // 验证父文件夹存在（parentId=0 表示根目录，无需验证）
  if (parentId !== 0) {
    const parent = db.prepare('SELECT id FROM favorite_folders WHERE id = ?').get(parentId);
    if (!parent) {
      return { error: 'not_found', message: '父文件夹不存在' };
    }
  }

  // 计算排序值：取当前最大 sort_order + 1
  const maxSort = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM favorite_folders WHERE parent_id = ?'
  ).get(parentId);

  const result = db.prepare(`
    INSERT INTO favorite_folders (name, parent_id, sort_order)
    VALUES (?, ?, ?)
  `).run(name, parentId, maxSort.next_sort);

  return { id: result.lastInsertRowid };
}
```

**现有 checkUrl 模式（重复检测）** (lines 390-397):
```javascript
/**
 * 检查 URL 是否已收藏
 * @param {string} url - 页面 URL
 * @returns {{id: number, title: string, favicon_url: string}|null} 收藏记录或 null
 */
function checkUrl(url) {
  ensureTable();

  return db.prepare(`
    SELECT id, title, favicon_url FROM favorites
    WHERE url = ? LIMIT 1
  `).get(url) || null;
}
```

**需要新增的函数：**
- `importChromeBookmarks(filePath, onProgress)` - Chrome JSON 导入入口
- `importHtmlBookmarks(filePath, onProgress)` - HTML 书签导入入口
- `parseChromeJson(data)` - 解析 Chrome JSON 结构
- `parseNetscapeHtml(html)` - 解析 Netscape HTML 格式
- `batchInsertBookmarks(bookmarks)` - 批量插入（使用 db.transaction）
- `normalizeUrl(url)` - URL 规范化（去重用）
- `detectChromeBookmarksPath()` - 自动检测 Chrome 书签路径

**新增函数应复制的模式：**
- 批量操作：复制 `batchUpdateSort` 的 `db.transaction()` 模式
- 去重插入：复制 `addRecord` 的 `INSERT OR IGNORE` 模式
- 文件夹创建：复制 `createFolder` 的模式

**导出位置** (line 712-739):
```javascript
module.exports = {
  initDatabase,
  setDatabase,
  migrateToGlobal,
  addRecord,
  // ... 现有导出 ...
  // 新增导出
  importChromeBookmarks,
  importHtmlBookmarks,
  parseChromeJson,
  parseNetscapeHtml,
  batchInsertBookmarks,
  normalizeUrl,
  detectChromeBookmarksPath,
};
```

---

### `src/favorites-page.js` (component, request-response)

**Analog:** `src/favorites-page.js` 现有 loadFavorites + showToast + showContextMenu

**现有 API 调用模式** (lines 64-71):
```javascript
/**
 * 调用收藏夹 HTTP API
 * @param {string} route - API 路由（如 'list'、'delete'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function favoritesApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/favorites/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`收藏夹 API 请求失败: ${res.status}`);
  }
  return res.json();
}
```

**现有 Toast 提示模式** (lines 1613-1619):
```javascript
/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 */
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2000);
}
```

**现有 DOM 元素引用模式** (lines 130-147):
```javascript
/** DOM 元素引用 */
const elements = {
  favoritesPage: document.querySelector('.favorites-page'),
  searchInput: document.getElementById('searchInput'),
  favoritesContent: document.getElementById('favoritesContent'),
  actionsBar: document.getElementById('actionsBar'),
  // ...
  toast: document.getElementById('toast'),
  folderTree: document.getElementById('folderTree'),
  breadcrumb: document.getElementById('breadcrumb'),
  addFolderBtn: document.getElementById('addFolderBtn'),
};
```

**现有事件绑定模式** (lines 1925-2013):
```javascript
/**
 * 绑定事件监听器
 */
function setupEventListeners() {
  // 搜索框（debounce 300ms，D-09）
  const debouncedSearch = debounce(() => {
    state.keyword = elements.searchInput.value.trim();
    loadFavorites();
  }, 300);

  elements.searchInput.addEventListener('input', debouncedSearch);

  // 全选 checkbox
  elements.selectAllCheckbox.addEventListener('change', toggleSelectAll);

  // ...
}
```

**现有 loadFavorites 数据加载模式** (lines 1442-1476):
```javascript
/**
 * 加载收藏列表
 */
async function loadFavorites() {
  state.offset = 0;
  state.hasMore = true;
  state.records = [];

  try {
    let results;
    if (state.keyword) {
      results = await favoritesApi('search', {}, {
        keyword: state.keyword,
        offset: 0,
        limit: state.limit,
      });
    } else {
      results = await favoritesApi('list', {}, {
        offset: 0,
        limit: state.limit,
        folder_id: state.currentFolderId,
      });
    }

    state.records = results || [];
    state.hasMore = results.length === state.limit;
    renderFavorites(state.records);

    state.selectedIds.clear();
    updateSelectionUI();
  } catch (err) {
    console.error('[Realm Favorites] 加载收藏失败:', err);
    renderEmpty();
  }
}
```

**需要新增的内容：**
- `elements.importBtn` - 导入按钮引用
- `elements.importModal` - 导入模态框引用
- `elements.importProgressBar` - 进度条引用
- `elements.importProgressText` - 进度文本引用
- `handleImportChrome()` - Chrome JSON 导入处理函数
- `handleImportHtml()` - HTML 书签导入处理函数
- `showImportModal()` - 显示导入进度模态框
- `hideImportModal()` - 隐藏导入模态框
- `updateImportProgress(progress, imported, skipped, total, current)` - 更新进度

**导入 API 调用应复制的模式：**
```javascript
// 复制 favoritesApi 调用模式
const result = await favoritesApi('import-chrome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filePath }),
});
```

---

### `src/favorites.html` (component, request-response)

**Analog:** `src/favorites.html` 现有 dialog 结构

**现有 dialog 模态框结构** (lines 65-77):
```html
<!-- 批量删除确认弹窗 -->
<dialog class="modal" id="favoritesBatchDeleteModal">
  <div class="modal-content">
    <h2>删除收藏</h2>
    <div class="delete-confirm-content">
      <p id="batchDeleteBody">确定删除选中的 0 项收藏吗？此操作不可撤销。</p>
      <p class="warning-text">此操作无法撤销</p>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" id="cancelBatchDeleteBtn">取消</button>
      <button type="button" class="btn btn-danger" id="confirmBatchDeleteBtn">删除</button>
    </div>
  </div>
</dialog>
```

**现有搜索栏结构** (lines 21-27):
```html
<!-- 搜索栏 -->
<div class="favorites-search-wrapper">
  <svg class="favorites-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
  <input type="text" class="favorites-search" id="searchInput" placeholder="搜索收藏...">
</div>
```

**现有 Toast 提示结构** (line 80):
```html
<!-- Toast 提示 -->
<div id="toast" class="toast hidden"></div>
```

**需要新增的 HTML：**
```html
<!-- 导入按钮（搜索栏右侧） -->
<!-- 修改 favorites-search-wrapper 为 flex 布局，右侧添加导入按钮 -->

<!-- 导入进度模态框 -->
<dialog class="modal" id="importModal">
  <div class="modal-content modal-large">
    <h2>导入书签</h2>
    <div class="import-progress-content">
      <div class="import-progress-bar-wrapper">
        <div class="import-progress-bar" id="importProgressBar"></div>
      </div>
      <p id="importProgressText">准备导入...</p>
      <p id="importCurrentFile" class="import-current-file"></p>
    </div>
  </div>
</dialog>

<!-- 导入结果摘要模态框 -->
<dialog class="modal" id="importResultModal">
  <div class="modal-content">
    <h2>导入完成</h2>
    <div class="import-result-content">
      <p id="importResultSummary"></p>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary" id="importResultCloseBtn">完成</button>
    </div>
  </div>
</dialog>
```

---

### `main.js` (controller, request-response)

**Analog:** `main.js` 现有 handleFavoritesApi

**现有 HTTP API 路由模式** (lines 335-478):
```javascript
/**
 * 处理 /api/favorites/* 收藏夹 API 请求
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 * @param {URL} reqUrl - 解析后的请求 URL
 */
async function handleFavoritesApi(req, res, reqUrl) {
  // token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改收藏
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const route = reqUrl.pathname.replace('/api/favorites/', '');

    if (route === 'list' && req.method === 'GET') {
      const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
      const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
      const folderIdParam = reqUrl.searchParams.get('folder_id');
      const folderId = folderIdParam !== null ? parseInt(folderIdParam, 10) : undefined;
      sendJson(res, 200, favoritesManager.listRecords({ offset, limit, folderId }));
      return;
    }

    // ... 更多路由 ...

    if (route === 'add' && req.method === 'POST') {
      const { url, title, faviconUrl } = await readJsonBody(req);
      sendJson(res, 200, favoritesManager.addRecord({ url, title, faviconUrl }));
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('[Realm] 收藏 API 处理失败:', err.message);
    sendJson(res, 400, { error: err.message });
  }
}
```

**需要新增的路由：**
```javascript
// Chrome JSON 导入
if (route === 'import-chrome' && req.method === 'POST') {
  const { filePath } = await readJsonBody(req);
  // 需要 mainWindow 引用以发送进度事件
  const result = await favoritesManager.importChromeBookmarks(filePath, (progress) => {
    mainWindow.webContents.send('favorites:import-progress', progress);
  });
  sendJson(res, 200, result);
  return;
}

// HTML 书签导入
if (route === 'import-html' && req.method === 'POST') {
  const { filePath } = await readJsonBody(req);
  const result = await favoritesManager.importHtmlBookmarks(filePath, (progress) => {
    mainWindow.webContents.send('favorites:import-progress', progress);
  });
  sendJson(res, 200, result);
  return;
}

// 自动检测 Chrome 书签路径
if (route === 'detect-chrome-path' && req.method === 'GET') {
  const chromePath = favoritesManager.detectChromeBookmarksPath();
  sendJson(res, 200, { path: chromePath });
  return;
}
```

---

### `src/preload.js` (provider, request-response)

**Analog:** `src/preload.js` 现有 favoritesCheck + dialog API

**现有 favorites IPC 暴露模式** (lines 382-447):
```javascript
// ==================== 收藏夹 ====================

/**
 * 检查 URL 是否已收藏
 * @param {string} url - 页面 URL
 * @returns {Promise<{id: number, title: string, favicon_url: string}|null>}
 */
favoritesCheck: (url) => ipcRenderer.invoke('favorites:check', { url }),

/**
 * 添加收藏
 * @param {Object} data - 收藏数据
 * @param {string} data.url - 页面 URL
 * @param {string} [data.title] - 页面标题
 * @param {string} [data.faviconUrl] - favicon URL
 * @returns {Promise<{id: number}|{error: string, message: string}>}
 */
favoritesAdd: (data) => ipcRenderer.invoke('favorites:add', data),
```

**需要新增的 preload API：**
```javascript
// ==================== 书签导入 ====================

/**
 * 打开文件选择对话框
 * @param {Object} options - 对话框选项
 * @param {string} [options.title] - 对话框标题
 * @param {Array} [options.filters] - 文件类型过滤器
 * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
 */
showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),

/**
 * 监听导入进度事件
 * @param {Function} callback - 回调函数，参数为 { progress, imported, skipped, total, current }
 */
onImportProgress: (callback) => {
  ipcRenderer.on('favorites:import-progress', (event, data) => callback(data));
},
```

**注意：** favorites-page.js 运行在 webview guest 中，不能直接使用 IPC。导入功能需要通过 HTTP API（`/api/favorites/import-chrome`）调用，进度通过 SSE 或轮询获取。

---

### `src/styles/main.css` (config, N/A)

**Analog:** `src/styles/main.css` 现有 modal + btn 样式

**现有 modal 样式** (lines 332-368):
```css
/* 模态框 */
.modal {
  border: none;
  background: transparent;
  padding: 0;
  max-width: 100%;
  max-height: 100%;
  /* 覆盖原生 dialog 的 UA 默认文字色，恢复与 body 一致的文字基色 */
  color: var(--text-primary);
}

.modal::backdrop {
  background-color: rgba(0, 0, 0, 0.7);
}

.modal-content {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-large {
  width: 600px;
}

.modal-content h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
}
```

**现有 btn 样式** (lines 526-550):
```css
.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: var(--accent-color);
  color: white;
}

.btn-primary:hover {
  background-color: var(--accent-hover);
}

.btn-secondary {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background-color: var(--bg-hover);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  height: 28px;
}
```

**现有搜索栏样式** (lines 1809-1837):
```css
/* 搜索栏 */
.favorites-search-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.favorites-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.favorites-search {
  width: 100%;
  padding: 10px 12px 10px 36px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.favorites-search:focus {
  border-color: var(--accent-color);
}
```

**需要新增的样式：**
```css
/* ==================== 书签导入 ==================== */

/* 搜索栏改造为 flex 布局 */
.favorites-search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.favorites-search-wrapper {
  flex: 1;
  position: relative;
  margin-bottom: 0;
}

/* 导入按钮 */
.favorites-import-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.favorites-import-btn:hover {
  background-color: var(--accent-hover);
}

.favorites-import-btn svg {
  flex-shrink: 0;
}

/* 导入进度条 */
.import-progress-bar-wrapper {
  width: 100%;
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.import-progress-bar {
  height: 100%;
  background-color: var(--accent-color);
  border-radius: 4px;
  transition: width 0.3s ease;
  width: 0%;
}

.import-progress-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.import-current-file {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 导入结果摘要 */
.import-result-content {
  margin-bottom: 20px;
}

.import-result-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 14px;
}

.import-result-label {
  color: var(--text-secondary);
}

.import-result-value {
  color: var(--text-primary);
  font-weight: 500;
}
```

---

## Shared Patterns

### HTTP API 调用模式（渲染进程 -> 主进程）
**Source:** `src/favorites-page.js` lines 64-71
**Apply to:** 所有新增的导入 API 调用
```javascript
async function favoritesApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/favorites/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`收藏夹 API 请求失败: ${res.status}`);
  }
  return res.json();
}

// 使用示例：
const result = await favoritesApi('import-chrome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filePath }),
});
```

### HTTP API 路由模式（主进程）
**Source:** `main.js` lines 335-478
**Apply to:** 所有新增的导入路由
```javascript
// 在 handleFavoritesApi 函数内添加
if (route === 'import-chrome' && req.method === 'POST') {
  const { filePath } = await readJsonBody(req);
  const result = await favoritesManager.importChromeBookmarks(filePath);
  sendJson(res, 200, result);
  return;
}
```

### 批量数据库操作模式
**Source:** `favorites-manager.js` lines 666-682
**Apply to:** batchInsertBookmarks 函数
```javascript
function batchInsertBookmarks(bookmarks) {
  ensureTable();

  if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO favorites (url, title, favicon_url, folder_id, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const result = insertStmt.run(
        item.url,
        item.title || '',
        item.faviconUrl || '',
        item.folderId || 0,
        item.sortOrder || 'a0'
      );

      if (result.changes > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }

    return { inserted, skipped };
  });

  return insertMany(bookmarks);
}
```

### 模态框模式
**Source:** `src/favorites.html` lines 65-77 + `src/styles/main.css` lines 332-368
**Apply to:** 导入进度模态框和结果摘要模态框
```html
<dialog class="modal" id="importModal">
  <div class="modal-content modal-large">
    <h2>导入书签</h2>
    <!-- 内容 -->
  </div>
</dialog>
```

### 错误处理模式
**Source:** `src/favorites-page.js` lines 1442-1476
**Apply to:** 所有导入相关函数
```javascript
try {
  const result = await favoritesApi('import-chrome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });

  if (result.success) {
    showToast(`导入完成：${result.imported} 条书签`);
    await loadFavorites();
    await refreshFolderTree();
  } else {
    showToast(result.message || '导入失败');
  }
} catch (err) {
  console.error('[Realm Favorites] 导入失败:', err);
  showToast('导入失败，请重试');
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `favorites-manager.js` (parseChromeJson) | service | transform | 新增函数，解析 Chrome JSON 格式，无现有类似 |
| `favorites-manager.js` (parseNetscapeHtml) | service | transform | 新增函数，解析 Netscape HTML 格式，需安装 cheerio |
| `favorites-manager.js` (detectChromeBookmarksPath) | service | file-I/O | 新增函数，检测 Chrome 书签路径，无现有类似 |

**说明：** 这三个函数是 Phase 17 的核心新增逻辑，没有现有代码可以直接复用。RESEARCH.md 中提供了详细的实现示例（lines 344-596），planner 应参考这些示例。

## Metadata

**Analog search scope:** 项目根目录、src/ 目录
**Files scanned:** 6 个核心文件
**Pattern extraction date:** 2026-07-30

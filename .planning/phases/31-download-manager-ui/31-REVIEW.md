---
phase: 31-download-manager-ui
reviewed: 2026-08-12T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - download-manager.js
  - ipc-handlers.js
  - main.js
  - src/index.html
  - src/styles/main.css
  - src/renderer.js
  - src/preload.js
  - src/downloads.html
  - src/downloads-page.js
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-08-12T12:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 31 实现了下载管理器 UI，包括下载面板（renderer.js 内嵌）、独立下载页面（realm://downloads）、以及对应的 IPC 通道和 HTTP API。审查发现两个关键性问题：独立下载页面（downloads-page.js）调用了 6 个不存在的 HTTP API 路由（pause/resume/cancel/open/show-in-folder/cancel），以及 API 响应格式与前端期望不匹配导致页面无法加载任何数据。此外存在参数校验缺失和 CSS 选择器注入风险。

## Critical Issues

### CR-01: downloads-page.js 调用 6 个不存在的 HTTP API 路由

**File:** `src/downloads-page.js:307-339`
**Issue:** `downloads-page.js` 的 `bindItemActions` 函数调用了以下 HTTP API 路由，但 `main.js` 的 `handleDownloadsApi` 只实现了 `list`、`delete`、`clear` 三个路由：

- `/api/downloads/pause` -- 不存在
- `/api/downloads/resume` -- 不存在
- `/api/downloads/cancel` -- 不存在
- `/api/downloads/open` -- 不存在
- `/api/downloads/show-in-folder` -- 不存在

所有这些操作都会收到 404 响应，用户在独立下载页面上无法暂停、恢复、取消下载，也无法打开文件或在 Finder 中显示。同时，`delete` 路由虽然存在，但删除进行中下载的流程先调用 `cancel`（不存在），导致删除进行中下载的功能也失效。

**Fix:** 在 `main.js` 的 `handleDownloadsApi` 中添加缺失的路由实现：

```javascript
// 在 handleDownloadsApi 函数中，clear 路由之后添加：

if (route === 'pause' && req.method === 'POST') {
  const { downloadId } = await readJsonBody(req);
  sendJson(res, 200, { success: downloadManager.pauseDownload(downloadId) });
  return;
}

if (route === 'resume' && req.method === 'POST') {
  const { downloadId } = await readJsonBody(req);
  sendJson(res, 200, { success: downloadManager.resumeDownload(downloadId) });
  return;
}

if (route === 'cancel' && req.method === 'POST') {
  const { downloadId } = await readJsonBody(req);
  sendJson(res, 200, { success: downloadManager.cancelDownload(downloadId) });
  return;
}

if (route === 'open' && req.method === 'POST') {
  const { filePath } = await readJsonBody(req);
  sendJson(res, 200, await downloadManager.openFile(filePath));
  return;
}

if (route === 'show-in-folder' && req.method === 'POST') {
  const { filePath } = await readJsonBody(req);
  sendJson(res, 200, downloadManager.showInFolder(filePath));
  return;
}
```

### CR-02: downloads-page.js 期望的 API 响应格式与实际不匹配

**File:** `src/downloads-page.js:154-161`, `main.js:1256-1260`
**Issue:** `downloads-page.js` 第 154 行检查 `data.success` 并读取 `data.downloads`，但 `main.js` 的 `/api/downloads/list` 路由直接返回 `downloadManager.getAllDownloads(limit, offset)` 的结果（一个裸数组），不是 `{ success: true, downloads: [...] }` 格式。

这意味着：
- `data.success` 为 `undefined`（裸数组没有 `success` 属性），条件判断为 falsy
- 进入 `else` 分支，打印错误日志但不渲染任何内容
- 独立下载页面永远无法显示任何下载记录

**Fix:** 修改 `main.js` 的 list 路由返回格式，或修改 `downloads-page.js` 的响应解析逻辑。推荐修改前端以匹配现有 API 风格（其他 API 如 history 返回裸数组）：

```javascript
// src/downloads-page.js 第 152-161 行，将：
const data = await response.json();
if (data.success) {
  const downloads = data.downloads || [];
  // ...
}

// 改为：
const downloads = await response.json();
if (Array.isArray(downloads)) {
  renderDownloads(downloads, reset);
  currentOffset += downloads.length;
  hasMore = downloads.length >= PAGE_SIZE;
} else {
  console.error('[Downloads Page] 获取下载列表失败:', downloads.error);
}
```

## Warnings

### WR-01: HTTP API delete 路由缺少 downloadId 输入校验

**File:** `main.js:1264-1267`
**Issue:** `/api/downloads/delete` 路由直接将请求体中的 `downloadId` 传递给 `downloadManager.deleteDownload()`，未做任何类型校验。虽然 `better-sqlite3` 的参数化查询能防 SQL 注入，但缺失 `downloadId` 时 `deleteDownload` 内部的 `db.prepare(...).get(downloadId)` 查询会返回 `undefined`，导致提前返回"下载记录不存在"——这不算严重，但与 IPC 层 `download:delete-record` 严格校验 `typeof downloadId !== 'string'` 的风格不一致。

对比 IPC 侧（`ipc-handlers.js:962-967`）有完整的类型校验，HTTP API 侧应保持一致。

**Fix:**
```javascript
if (route === 'delete' && req.method === 'POST') {
  const { downloadId, deleteFile } = await readJsonBody(req);
  if (!downloadId || typeof downloadId !== 'string') {
    sendJson(res, 400, { success: false, error: '无效的下载 ID' });
    return;
  }
  sendJson(res, 200, downloadManager.deleteDownload(downloadId, !!deleteFile));
  return;
}
```

### WR-02: updateDownloadPanelProgress 使用 downloadId 构造 CSS 选择器存在注入风险

**File:** `src/renderer.js:8322`
**Issue:** `updateDownloadPanelProgress` 使用模板字符串将 `data.downloadId` 直接拼入 CSS 选择器：

```javascript
const item = document.querySelector(`.download-item[data-id="${data.downloadId}"]`);
```

`downloadId` 来自主进程推送的 IPC 事件数据，虽然当前由 `crypto.randomUUID()` 生成（格式安全），但如果未来 `downloadId` 包含双引号或反斜杠，会导致选择器语法错误或意外匹配。项目中其他使用 `querySelector` 的地方（如 cookie 管理）都使用了 `CSS.escape()` 或 ID 查找。

**Fix:**
```javascript
const item = document.querySelector(
  `.download-item[data-id="${CSS.escape(String(data.downloadId))}"]`
);
```

### WR-03: formatFileSize 对负数或 NaN 输入行为异常

**File:** `src/renderer.js:5885-5889`, `src/downloads-page.js:425-431`
**Issue:** `formatFileSize` 仅检查 `bytes === 0` 返回 `'0 B'`，未处理负数、`NaN`、`undefined`、`null` 等边界输入：

- `Math.log(-1)` 返回 `NaN`，`Math.floor(NaN)` 返回 `NaN`，`units[NaN]` 返回 `undefined`
- 最终输出类似 `"NaN undefined"` 的字符串

在下载面板中，`item.totalBytes` 可能为 0（下载刚开始时），`download.speed` 可能为负值（极端情况下 `bytesDiff < 0`）。虽然 `download-manager.js` 的 `calculateSpeed` 对 `bytesDiff < 0` 会返回负速度值（`bytesDiff / timeDiff`），导致面板显示异常。

**Fix:**
```javascript
function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  return (bytes / Math.pow(1024, idx)).toFixed(1) + ' ' + units[idx];
}
```

### WR-04: downloads-page.js 的 pause/resume API 路由无 token 鉴权保护（设计缺陷）

**File:** `src/downloads-page.js:307-325`
**Issue:** 虽然这些路由当前不存在（CR-01），但在实现时需要注意：`downloads-page.js` 中 `apiAction` 函数在 URL 中携带 token：

```javascript
const response = await fetch(`http://localhost:${realmPort}${path}?token=${realmToken}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
```

token 在 URL query string 中传输。对于 POST 请求，token 应放在请求体或自定义 header 中，避免被日志、Referer 头或中间件记录。当前所有其他 HTTP API（history/favorites/settings）也使用相同的 query string token 模式，属于项目级已知设计选择，但值得记录。

**Fix:** 当前无需修改（项目级设计决策），但在实现 CR-01 的新路由时应保持一致的 token 校验模式。

## Info

### IN-01: download-manager.js 的 updateDownloadRecord 使用 camelCase 到 snake_case 自动转换

**File:** `download-manager.js:254-264`
**Issue:** `updateDownloadRecord` 函数通过正则 `key.replace(/[A-Z]/g, m => \`_\${m.toLowerCase()}\`)` 将 camelCase 键名转换为 snake_case 列名。虽然当前调用点只有 `state`、`canResume` 等简单键名能正确映射，但如果传入 `sourceUrl` 这样的键名会转换为 `source_url`（正确），但 `totalBytes` 会转为 `total_bytes`（也正确）。这种隐式映射不够直观，未来添加新字段时可能引入静默错误。

**Fix:** 建议使用显式映射表或直接使用 snake_case 键名，避免隐式转换。

### IN-02: downloads-page.js 的搜索参数被发送但后端未实现过滤

**File:** `src/downloads-page.js:147-149`, `download-manager.js:567-579`
**Issue:** `downloads-page.js` 在搜索时将 `search` 参数附加到 URL：

```javascript
url += `&search=${encodeURIComponent(currentSearch)}`;
```

但 `handleDownloadsApi` 的 `list` 路由不读取 `search` 参数，`getAllDownloads` 函数也没有搜索过滤逻辑。用户输入搜索关键字后，页面会刷新但显示的仍是未过滤的全量结果。

**Fix:** 在 `download-manager.js` 的 `getAllDownloads` 中添加可选的 `keyword` 参数，对 `filename` 列做 LIKE 查询：

```javascript
function getAllDownloads(limit = 50, offset = 0, keyword = '') {
  if (!db) return [];
  try {
    if (keyword) {
      return db.prepare(`
        SELECT * FROM downloads
        WHERE filename LIKE ?
        ORDER BY start_time DESC
        LIMIT ? OFFSET ?
      `).all(`%${keyword}%`, limit, offset);
    }
    return db.prepare(`
      SELECT * FROM downloads
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  } catch (err) {
    console.error('[Realm] 查询全局下载记录失败:', err.message);
    return [];
  }
}
```

同时在 `main.js` 的 `handleDownloadsApi` list 路由中传递 `search` 参数。

---

_Reviewed: 2026-08-12T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

# Phase 44: 播放器视频缓存与本地媒体库 - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 17（新增 7 + 修改 10）
**Analogs found:** 14 / 17（3 个录制/转封装引擎文件无同数据流先例，走 RESEARCH.md Pattern 3/录制轮询示例）

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `media-cache-manager.js`（新） | service | file-I/O + CRUD | `history-manager.js`（SQLite/FIFO 淘汰）+ `download-manager.js`（文件操作/路径安全） | role-match |
| `media-task-manager.js`（新） | service | event-driven（注册表状态机） | `download-manager.js`（活跃任务 Map + 状态流转 + notifyRenderer） | role-match |
| `media-record-engine.js`（新，可并入 task-manager） | service | streaming（m3u8 轮询追分片） | 无（行解析先例 `rewriteM3u8ForProxy` main.js:234） | no-analog（用 RESEARCH 示例） |
| `media-remuxer.js`（新，可并入 task-manager） | service | streaming（TS→fMP4） | 无 | no-analog（用 RESEARCH Pattern 3） |
| `player-history-manager.js`（新） | service | CRUD（SQLite upsert） | `history-manager.js` | exact |
| `src/tasks.html`（新） | component（内部页面） | request-response | `src/downloads.html` | exact |
| `src/tasks-page.js`（新） | component | request-response（/api + token） | `src/downloads-page.js` | exact |
| `tests/test-media-cache.js`（新） | test | — | `tests/test-ai-bash-policy.js` | exact（node:test 纯逻辑） |
| `tests/test-m3u8-playlist-parser.js`（新） | test | — | `tests/test-ai-bash-policy.js` | exact |
| `tests/test-media-task-registry.js`（新） | test | — | `tests/test-ai-bash-policy.js` | exact |
| `main.js`（改） | controller/entry | request-response | 自身（handleProxyRequest :277、路由 :2419、/api 分支 :2394、before-quit :3548） | exact（自参照） |
| `ipc-handlers.js`（改） | controller（IPC） | request-response | 自身（media:play :1996） | exact（自参照） |
| `src/player.js`（改） | component | event-driven | 自身（模式判定 :256、proxiedUrl :271、refreshCurrent :627） | exact（自参照） |
| `src/player.html` / `src/player.css`（改） | component | — | 自身（UI-SPEC.md 为准） | exact（自参照） |
| `src/settings.html` / `src/settings-page.js`（改） | component | request-response | 自身（43 期 AI 分区即改即存惯例） | exact（自参照） |
| `src/preload.js`（改） | provider（contextBridge） | request-response | 自身（playerAPI 块 :1539） | exact（自参照） |
| `src/renderer.js`（改） | controller | event-driven（角标） | 自身（realmUrlToHttp :350）+ `download-manager.js` notifyRenderer 广播 | role-match |

---

## Pattern Assignments

### `media-cache-manager.js`（service，file-I/O + 索引 CRUD）

**Analog 1（模块骨架 / SQLite 延迟初始化 / FIFO 淘汰）：`history-manager.js`**

**延迟初始化骨架**（lines 15-50）——media-cache-manager 若用 JSON 索引则无需 SQLite，但「延迟初始化、app.whenReady 后 init」的模块骨架照抄：

```js
// 延迟加载：原生模块必须在 app.whenReady 之后加载
let Database = null;
let DB_PATH = null;
let db = null;

function initDatabase() {
  if (db) return;
  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'history.db');
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
}
```

**FIFO 淘汰**（lines 99-117）——D-07「按最后观看时间 FIFO」直接套此结构（把 `visited_at ASC` 换成 `last_watched ASC`，按视频目录粒度删）：

```js
function enforceLimit(containerId) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
  if (row.count > MAX_RECORDS_PER_CONTAINER) {
    const excess = row.count - MAX_RECORDS_PER_CONTAINER;
    db.prepare(`
      DELETE FROM ${tableName} WHERE id IN (
        SELECT id FROM ${tableName} ORDER BY visited_at ASC LIMIT ?
      )
    `).run(excess);
  }
}
```

**输入哈希/校验惯例**（lines 54-69 `sanitizeContainerId`）——视频ID/分片名做 `/^[a-zA-Z0-9]+$/` 级别的白名单校验（RESEARCH 建议 sha256 hex，天然满足），杜绝路径穿越。

**Analog 2（文件删除的路径安全）：`download-manager.js`**

**删除前路径边界校验**（lines 616-633）——D-07 整目录删除时照抄（把 downloadsDir 换成缓存根目录）：

```js
// 安全验证：确认路径在用户目录内（防路径遍历，T-31-01）
const downloadsDir = app.getPath('downloads');
const resolvedPath = path.resolve(record.save_path);
if (!resolvedPath.startsWith(downloadsDir)) {
  console.warn(`[Realm] 拒绝删除下载目录外的文件: ${resolvedPath}`);
} else {
  try {
    if (fs.existsSync(resolvedPath)) fs.unlinkSync(resolvedPath);
  } catch (fileErr) {
    // 文件删除失败不阻止记录删除
  }
}
```

**命名空间日志惯例**：全项目统一 `console.log('[Realm] ...')` / `console.error('[Realm] xxx失败:', err.message)`（download-manager.js:85、history-manager.js:49 等）。

---

### `media-task-manager.js`（service，event-driven 注册表）

**Analog：`download-manager.js`**

**活跃任务 Map + 指标缓存**（lines 27-31）——D-25 注册表的运行时结构：

```js
// 活跃下载映射：downloadId -> DownloadItem
const activeDownloads = new Map();
// 指标缓存：downloadId -> { startTime, lastBytes, ... }
const downloadMetrics = new Map();
```

**状态流转持久化**（lines 311-383 `item.on('done')`）——completed/cancelled/interrupted 三态分派 + 落库 + 清理运行时 Map + 通知渲染进程，整段结构照抄为 record/convert 任务的终态处理：

```js
item.on('done', (event, state) => {
  if (state === 'completed') {
    saveDownloadRecord({ /* ... */ state: 'completed' });
    notifyRenderer('download:completed', { /* ... */ state: 'completed' });
  } else if (state === 'cancelled') { /* ... */ }
  else if (state === 'interrupted') { /* ... */ state: 'interrupted', canResume: item.canResume() });
  // 清理活跃映射
  activeDownloads.delete(downloadId);
  downloadMetrics.delete(downloadId);
  // 通知活跃数量变化（角标数据源）
  notifyRenderer('download:count-changed', { count: activeDownloads.size });
});
```

**主进程 → 渲染进程广播**（lines 186-205）——D-26 主窗口角标的推送通道写法：

```js
function getMainWindow() {
  try {
    const windowManager = require('./window-manager');
    return windowManager.getMainWindow();
  } catch { return null; }
}

function notifyRenderer(channel, data) {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}
```

**配置读取 + 保存对话框**（lines 394-435）——D-24 showSaveDialog + 「记住上一次目录」的既有写法：

```js
let defaultDir;
try {
  const Store = require('electron-store');
  const configStore = new Store({ name: 'realm-config' });
  defaultDir = configStore.get('settings.downloadPath', app.getPath('downloads'));
} catch { defaultDir = app.getPath('downloads'); }
// ...
result = dialog.showSaveDialogSync(parentWindow, {
  defaultPath: defaultFilePath,
  filters: [{ name: 'All Files', extensions: ['*'] }],
});
if (!result) { event.preventDefault(); return; }
const savePath = getUniqueFilePath(result);  // 同名冲突自动 (1)(2) 后缀（lines 95-112，D-22 同名追加序号照抄）
```

**产物定位**（lines 756-768 `showInFolder`）——D-24 完成后 `shell.showItemInFolder` 直接复用此函数写法。

---

### `player-history-manager.js`（service，SQLite upsert）

**Analog（exact）：`history-manager.js`**

模块骨架、表创建、sanitize、CRUD 全套照抄，仅差异点：
- 表为全局单表（非 per-container），主键 = playbackKey（`origin + pathname`，RESEARCH Code Examples 的 `playbackKey()`）
- 写入是 **upsert**（`INSERT ... ON CONFLICT(playback_key) DO UPDATE SET last_position=..., last_watched=...`，D-11/D-12），参照 `saveDownloadRecord` 的 `INSERT OR REPLACE`（download-manager.js:213-236）
- 不需要 FIFO 淘汰（D-11「纯记录，很小」），`enforceLimit` 可省略

**表创建参照**（history-manager.js lines 77-95）：

```js
function ensureTable(containerId) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      visited_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_visited_at ON ${tableName} (visited_at DESC);
  `);
}
```

---

### `src/tasks.html`（component，realm:// 内部页面）

**Analog（exact）：`src/downloads.html`（全文 91 行，直接整页照抄骨架）**

关键结构——CSP 元标签、`<base>`、暗色主题、原生 `<dialog>` 确认框（弹框居中约定）：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: data:">
<base href="/tasks/">          <!-- ⚠️ tasks 页改成 /tasks/ -->
<link rel="stylesheet" href="styles/main.css">
...
<dialog class="download-clear-modal" id="downloadsClearModal">  <!-- 原生 dialog，CSS 必须显式 margin: auto -->
  ...
</dialog>
<script src="tasks-page.js"></script>
```

注意：CSP 里 `style-src 'self'` 含 `unsafe-inline`（downloads 页特例）——tasks 页跟 downloads 保持一致即可；**markup 内联 `style="display:none"` 仍不要写**，初始隐藏走 CSS 类 + `hidden` class。

---

### `src/tasks-page.js`（component，request-response）

**Analog（exact）：`src/downloads-page.js`（632 行，前 220 行已读）**

**初始化 + token 获取**（lines 85-106）：

```js
async function init() {
  const params = new URLSearchParams(window.location.search);
  realmToken = params.get('token');       // createTab 经 realmUrlToHttp 注入
  if (!realmToken) { console.error('[Tasks Page] 缺少 token 参数'); return; }
  bindEvents();
  await loadTasks(true);
}
```

**同源 fetch + token query**（lines 59-80 syncTheme；数据请求同款相对路径）：

```js
const res = await fetch(`/api/settings/get?token=${encodeURIComponent(token)}`);
```

**主题同步**（lines 40-83 `applyTheme`/`syncTheme`）——tasks 页整段照抄。

**列表 + 分页 + 防抖搜索 + 原生 dialog 确认**（lines 111-201 bindEvents / 209-220 loadDownloads）——D-26 任务页的「进行中/已完成/失败」分区渲染照 `loadDownloads` + 空状态结构改。

---

### `tests/test-media-cache.js` / `test-m3u8-playlist-parser.js` / `test-media-task-registry.js`

**Analog（exact）：`tests/test-ai-bash-policy.js`**

node:test + assert 的纯 Node 无框架测试结构（lines 1-15）：

```js
/**
 * xxx 单元测试（node:test，纯 Node 环境）
 * 用法: node tests/test-xxx.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const policy = require('../ai-bash-policy');

describe('分组名', () => {
  test('用例名', () => {
    assert.deepStrictEqual(policy.splitCommandPipeline('...'), [...]);
  });
});
```

**关键约束（来自 RESEARCH Validation Architecture）**：media-cache-manager / media-task-manager 必须**去 Electron 化**——constructor 注入根目录/config，测试 `require('../media-cache-manager')` 不触发 `app.getPath`。参照 ai-bash-policy 的纯模块设计（顶层无 Electron require）。

---

### `main.js`（修改：缓存分流钩子 + tasks 路由 + /api/tasks 端点 + before-quit 确认）

**自参照 Analog 1：`handleProxyRequest`（lines 277-364）**——缓存分流钩子的唯一挂载点。既有结构（缓存插入点已标注）：

```js
async function handleProxyRequest(req, res, reqUrl) {
  // token 鉴权（lines 279-283）：防 localhost 端口扫描把应用当开放代理
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  // ...target/referer/container 解析（284-313）
  const resp = await ses.fetch(target, { headers });           // line 326
  const contentType = resp.headers.get('content-type') || '';
  const finalUrl = resp.url || target;                          // line 329 ⚠️ 缓存 key 用重定向后 finalUrl
  const isM3u8 = /mpegurl|m3u8/i.test(contentType) || /\.m3u8(\?.*)?$/i.test(finalUrl);  // line 330

  if (resp.ok && isM3u8) {                                      // lines 332-338（m3u8 分支不动，仅可加原始文本短 TTL）
    const text = await resp.text();
    const rewritten = rewriteM3u8ForProxy(text, finalUrl, reqUrl.searchParams);
    res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
    res.end(rewritten);
    return;
  }
  // ▼ lines 340-356 流式透传分支（缓存钩子插在此分支之前）：
  const outHeaders = { 'Content-Type': contentType || 'application/octet-stream' };
  for (const h of ['content-range', 'accept-ranges']) {
    const v = resp.headers.get(h);
    if (v) outHeaders[h] = v;
  }
  // ses.fetch 透明解压后 content-length 会失真，仅在未压缩时转发（lines 346-350 ⚠️ 缓存索引必须记实际落盘字节数）
  res.writeHead(resp.status, outHeaders);
  if (resp.body) Readable.fromWeb(resp.body).pipe(res);         // 未命中时 tee：透传 + 写盘
}
```

**Range 语义锚点**（lines 319-320）：`if (req.headers.range) headers['Range'] = req.headers.range;`——带 Range 的请求按 Pitfall 3 绕过整段缓存。

**m3u8 行级解析先例：`rewriteM3u8ForProxy`（lines 234-265）**——录制引擎的清单解析照此风格手写（`text.split('\n')` + 正则），**引依赖**：

```js
function rewriteM3u8ForProxy(text, baseUrl, params) {
  const toProxyUrl = (uri) => { /* ... */ };
  return text.split('\n').map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => { /* ... */ });
    }
    return toProxyUrl(trimmed);
  }).join('\n');
}
```

**cache 标记透传**：lines 241 透传白名单 `['token', 'container', 'referer']` → 加入 `'cache'`（RESEARCH Open Question 3 建议）。

**自参照 Analog 2：内部页面路由（lines 2419-2464 + 2474-2481）**——tasks 页路由照 downloads 分支抄：

```js
} else if (reqPath === '/downloads' || reqPath === '/downloads/') {
  filePath = path.join(__dirname, 'src', 'downloads.html');
} else if (reqPath.startsWith('/downloads/')) {
  const subPath = reqPath.replace('/downloads/', '');
  filePath = path.join(__dirname, 'src', subPath);
}
// + 既有安全检查（2474-2481）：filePath 必须落在 srcRoot / nodeModulesRoot 内
```

**自参照 Analog 3：/api 端点 + token + sendJson（lines 2394-2411）**——/api/tasks/list 端点照抄：

```js
if (reqPath === '/api/bookmarks-bar/toggle' && req.method === 'POST') {
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  try {
    // ...业务...
    sendJson(res, 200, { success: true });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
  return;
}
```

**自参照 Analog 4：before-quit 协程（lines 3537-3604）**——D-19 活跃任务确认插进同一协程。关键既有模式：

```js
app.on('before-quit', async (event) => {
  if (cookiesSaved) return;
  event.preventDefault();          // before-quit 不会等待 async handler 返回
  if (quitting) return;            // quit 重入守卫
  // ...（D-19 确认逻辑可插在 quitConfirmAt 窗口判定之后、Cookie 保存之前）
  try { await cookieManager.saveAllCookies(); } catch (err) { quitting = false; return; }
  cookiesSaved = true;
  // setImmediate 跳出 before-quit 异步续体（直接 app.quit() 会停滞）
  setImmediate(() => app.quit());
});
```

---

### `ipc-handlers.js`（修改：media:play localhost 化 + 录制/进度 IPC）

**自参照 Analog：`media:play`（lines 1996-2067）**——D-02 改造点只有一处 `loadFile`（line 2040）：

```js
playerWindow = new BrowserWindow({
  width: 960, height: 540, frame: false, backgroundColor: '#000000',
  webPreferences: {
    preload: path.join(__dirname, 'src/preload.js'),
    contextIsolation: true, nodeIntegration: false,
    session: session.fromPartition(`persist:container-${containerId}`),   // line 2034
  },
});
playerWindow.loadFile(path.join(__dirname, 'src/player.html'));           // line 2040 → 改 loadURL(localhost player 页 + token/container/referer/cache/mode=independent)
playerWindow.webContents.on('did-finish-load', () => {
  playerWindow.webContents.send('media:play-url', { url, mediaList, containerId, containerName });  // mediaList 继续走 IPC（RESEARCH Open Q1）
});
playerWindow.on('closed', () => { playerWindow = null; });                // lines 2049-2052 → D-13/Pitfall 6 需改 close 拦截
```

**IPC handler 惯例**（同文件多处）：`assertTrustedSender(event)`（主窗口来源，line 1997）vs `assertPlayerSender(event)`（播放器窗口来源，line 2085）——新增 `player:record/start|stop`、`player:progress` 按来源选对应断言；`containerId` 校验参照 line 2001-2003。

---

### `src/player.js`（修改：模式判定 + 续播 + 进度上报）

**自参照 Analog 1：模式判定块（lines 256-308）**——Pitfall 1 的改造点：

```js
const urlParams = new URLSearchParams(window.location.search);
const paramUrl = urlParams.get('url');
const isWebviewMode = location.protocol === 'http:' || location.protocol === 'https:';   // line 263 → D-02 后独立窗口也 http:，需 mode 参数区分

function proxiedUrl(url) {                                                // lines 271-280
  if (!isWebviewMode || !/^https?:\/\//i.test(url)) return url;
  const proxyUrl = new URL('/proxy', location.origin);
  proxyUrl.searchParams.set('url', url);
  for (const key of ['token', 'container', 'referer']) {                  // → 加 'cache'
    const v = urlParams.get(key);
    if (v) proxyUrl.searchParams.set(key, v);
  }
  return proxyUrl.toString();
}

if (paramUrl) {                                    // lines 282-290 webview tab 模式（现状不动）
  document.body.classList.add('webview-player');   // ⚠️ 独立窗口 localhost 模式绝不能进此分支（隐藏标题栏）
  initPlayer(paramUrl);
} else if (window.playerAPI && window.playerAPI.onPlayUrl) {   // lines 291-308 独立窗口模式（mediaList 经 IPC）
```

**自参照 Analog 2：续播 resume 模式（lines 627-636）**——D-12 直接复用：

```js
function refreshCurrent() {
  if (!state.currentUrl) return;
  const resumeTime = (!state.isLive && isFinite(video.duration)) ? video.currentTime : 0;
  initPlayer(state.currentUrl);
  if (resumeTime > 0) {
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = resumeTime;
    }, { once: true });
  }
}
```

进度节流上报（D-13）与暂停/关窗上报照 RESEARCH Code Examples；关窗兜底在主进程 close 拦截（Pitfall 6）。

---

### `src/preload.js`（修改：playerAPI/realmAPI 新通道）

**自参照 Analog：playerAPI 块（lines 1533-1565）**：

```js
contextBridge.exposeInMainWorld('playerAPI', {
  onPlayUrl: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('media:play-url', handler);
    return () => ipcRenderer.removeListener('media:play-url', handler);   // 返回清理函数的惯例
  },
  toggleFullscreen: () => ipcRenderer.invoke('player:toggle-fullscreen'),  // invoke 单向数据
  onFullscreenChanged: (callback) => { /* 同 onPlayUrl 结构 */ },
});
```

新增通道：`reportProgress`（`ipcRenderer.send` 单向即可，RESEARCH D-13 示例）、`record/start|stop`、抽屉数据拉取。realmAPI 侧角标通道参照 `playMedia`（line 1489）与 `onMediaListUpdate`（lines 1526-1530）。

---

### `src/renderer.js`（修改：角标 + settings/tasks 入口）

**自参照 Analog：`realmUrlToHttp`（lines 344-359）**——所有「打开内部页面」入口（设置页任务列表按钮、角标点击跳任务页）经此转换，**不得直接 fetch HTTP API**（Phase 38 事故）：

```js
function realmUrlToHttp(url, containerId) {
  if (!state.realmPort || !url.startsWith('realm://')) return url;
  let converted = url.replace(/^realm:\/\//, `http://localhost:${state.realmPort}/`);
  const params = new URLSearchParams();
  if (containerId) params.set('container', containerId);
  if (state.realmToken) params.set('token', state.realmToken);
  const query = params.toString();
  if (query) converted += (converted.includes('?') ? '&' : '?') + query;
  return converted;
}
```

角标数据源走 `realmAPI` IPC 监听主进程 `media-task:*` 广播（download-manager notifyRenderer 模式，见上）。

---

## Shared Patterns

### Token 鉴权（localhost HTTP 层）
**Source:** `main.js:279-283`（/proxy）、`main.js:2396-2399`（/api/*）
**Apply to:** /proxy 缓存分支（不新增校验，继承 handleProxyRequest 入口）、全部 /api/tasks/* 端点
```js
if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
  sendJson(res, 403, { error: 'Forbidden' });  // /proxy 处为 res.writeHead(403); res.end('Forbidden')
  return;
}
```

### IPC 来源断言
**Source:** `ipc-handlers.js:1997`（assertTrustedSender）/ `:2085`（assertPlayerSender）
**Apply to:** 所有新增 IPC handler（record/start-stop、progress、抽屉数据）

### 主进程 → 渲染进程广播
**Source:** `download-manager.js:186-205`
**Apply to:** 任务进度/终态推送（角标 + 任务页 + 播放器红点）；经 windowManager.broadcast 或 getMainWindow().webContents.send

### better-sqlite3 延迟加载（原生模块纪律）
**Source:** `download-manager.js:17-26` / `history-manager.js:15-26`
**Apply to:** player-history-manager（若选 SQLite）；media-cache-manager/media-task-manager 若不用 SQLite 则同样保持「顶层无 Electron/原生 require、init 由 main.js 在 whenReady 后调用」——测试可纯 Node 跑

### 配置读写（electron-store 即改即存）
**Source:** `download-manager.js:398-404`
**Apply to:** 缓存目录/容量、关窗默认选择、last-used 产物目录
```js
const configStore = new Store({ name: 'realm-config' });
const val = configStore.get('settings.xxx', defaultValue);
```

### 对话框 + 同名冲突 + 产物定位
**Source:** `download-manager.js:95-112`（getUniqueFilePath）、`:416-421`（showSaveDialogSync）、`:756-768`（showInFolder）
**Apply to:** D-24 mp4 产物保存、D-22 同名追加序号、完成后 showItemInFolder

### FIFO 淘汰结构
**Source:** `history-manager.js:99-117`
**Apply to:** D-07 缓存淘汰（按 last_watched 排序、整目录删除、活跃任务豁免查询 media-task-manager）

### 路径安全
**Source:** `download-manager.js:616-622`；RESEARCH Pitfall「缓存 key 哈希化」
**Apply to:** 视频ID/分片名一律 sha256 hex；删除/写盘前 path.resolve + 根目录前缀校验

### node:test 纯逻辑测试
**Source:** `tests/test-ai-bash-policy.js`
**Apply to:** 全部三个新测试文件；被测模块必须去 Electron 化（构造注入）

---

## No Analog Found

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `media-record-engine.js` | service | streaming（m3u8 轮询追分片） | 代码库无「主进程定时轮询远程清单+增量下载」先例；行解析仅 rewriteM3u8ForProxy（非轮询） | RESEARCH「直播录制轮询」Code Example + RFC 8216 语义 |
| `media-remuxer.js` | service | streaming（TS→fMP4） | 代码库无 mux.js/转封装先例 | RESEARCH Pattern 3（mux.js 官方 README 时序警告必须遵守：先注册 data 监听再 push、单实例顺序 push） |
| 通知（Electron Notification） | — | event-driven | 代码库现无 Notification 用例 | Electron 内置 API；Pitfall 8（dev 环境可能静默，UAT 放打包版） |

## Metadata

**Analog search scope:** 根目录主进程模块（download-manager/history-manager/cookie-manager/media-sniffer）、src/ 内部页面与 preload/renderer、tests/、main.js/ipc-handlers.js 集成点段
**Files scanned:** 14（全文或定向段读取）
**Tracked-source gate:** 全部 analog 均经 `git ls-files` 验证为 git 追踪文件（无 gitignored 镜像路径）
**Pattern extraction date:** 2026-09-06

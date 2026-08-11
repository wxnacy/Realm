# Stack Research: 多媒体功能集成 (v2.2)

**Project:** Realm Browser
**Researched:** 2026-08-06
**Mode:** Ecosystem
**Confidence:** HIGH

## Recommended Stack

### 新增依赖（仅 2 个）

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| hls.js | ^1.6.17 | m3u8/HLS 流媒体播放 | 成熟稳定的 HLS 播放库，通过 MSE 在 Chromium 中工作；v1.6.x 是当前活跃维护的稳定线 |
| mpegts.js | ^1.8.1 | FLV/MPEG-TS 直播流播放 | flv.js 的活跃继任者（同一社区），支持 FLV + MPEG-TS + 低延迟直播 |

### 不需要新增的依赖

| Library | Why NOT |
|---------|---------|
| video.js | 重量级播放器框架，引入完整 UI 系统与自研媒体面板冲突；Realm 只需底层解码能力 |
| flv.js (bilibili/flv.js) | 已停止维护（最后版本 v1.6.2，2020 年），被 mpegts.js 替代 |
| dash.js | DASH 协议本期不支持；Electron 32.x Chromium 原生支持部分 DASH |
| ffmpeg / fluent-ffmpeg | 服务端工具，Electron 32.x Chromium 原生解码足够；仅在 Phase 28 下载合并时考虑 |
| plyr / clapr / mediaelement | 封装层无必要，自研 UI 更贴合 Realm 设计语言 |
| puppeteer-core | 项目已有 Electron 原生 CDP (webContents.debugger)，无需额外浏览器进程 |

### 利用现有 Electron/Node.js API（零额外依赖）

| API | Module | Purpose |
|-----|--------|---------|
| `session.webRequest.onBeforeRequest` | Electron (Main) | 网络请求拦截，嗅探 m3u8/mp4/flv/webm URL |
| `webContents.executeJavaScript` | Electron (Main) | 注入脚本检测页面 `<video>`/`<source>` 元素 |
| `BrowserWindow` | Electron (Main) | 创建独立播放器窗口 |
| `ipcMain` / `ipcRenderer` | Electron | 主进程 <-> 渲染进程通信 |
| `contextBridge` | Electron | 安全暴露 IPC 给播放器窗口 preload |
| `net` | Node.js | 可选：验证媒体 URL 有效性（HEAD 请求） |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| HLS 播放 | hls.js ^1.6.17 | video.js + @videojs/http-streaming | video.js 太重，引入整个 UI 框架无必要 |
| FLV/MPEG-TS | mpegts.js ^1.8.1 | flv.js ^1.6.2 | flv.js 已停止维护 5 年 |
| 请求拦截 | session.webRequest | 代理服务器 (http-proxy) | webRequest 是 Electron 原生 API，零额外依赖 |
| 播放器 UI | 自研 (HTML/CSS/JS) | plyr / mediaelement | 自研与 Realm 深色主题一致，无额外包体积 |
| 视频检测 | executeJavaScript | CDP Runtime.evaluate | executeJavaScript 更简单直接；项目已有 CDP 基础设施可备选 |

## Installation

```bash
# 新增依赖（仅 2 个包）
npm install hls.js@^1.6.17 mpegts.js@^1.8.1
```

## Integration Points

### 1. 媒体嗅探 (Phase 26: MEDIA-01)

**session.webRequest 拦截（主进程）：**

```javascript
// main.js — 在容器 session 上注册拦截器
function setupMediaSniffer(containerSession, containerId) {
  containerSession.webRequest.onBeforeRequest(
    { urls: ['*://*/*.m3u8*', '*://*/*.mp4*', '*://*/*.flv*', '*://*/*.webm*'] },
    (details, callback) => {
      // 通过 IPC 发送到媒体列表
      mainWindow.webContents.send('media:detected', {
        url: details.url,
        type: detectMediaType(details.url),
        containerId,
        timestamp: Date.now()
      });
      callback({}); // 不阻断请求
    }
  );
}
```

**关键：** `webRequest` 必须在容器对应的 `session` 对象上注册，而非 `session.defaultSession`。每个容器使用 `persist:container-{id}` partition，拦截器需逐一注册。

### 2. 页面视频检测 (Phase 26: MEDIA-02)

**executeJavaScript 注入（渲染进程 → webview）：**

```javascript
// renderer.js — 在 webview dom-ready 后注入
webview.addEventListener('dom-ready', async () => {
  const videoSources = await webview.executeJavaScript(`
    Array.from(document.querySelectorAll('video, video source, [src*=".m3u8"], [src*=".mp4"]'))
      .map(el => ({
        src: el.src || el.currentSrc || el.getAttribute('src'),
        type: el.type || '',
        tag: el.tagName.toLowerCase()
      }))
      .filter(v => v.src)
  `);
  if (videoSources.length > 0) {
    window.realmAPI.reportVideoSources(videoSources);
  }
});
```

### 3. 播放器窗口 (Phase 27: MEDIA-05/06)

**独立 BrowserWindow（主进程）：**

```javascript
// main.js
function createPlayerWindow(mediaUrl) {
  const playerWin = new BrowserWindow({
    width: 960, height: 540,
    title: 'Realm Player',
    webPreferences: {
      preload: path.join(__dirname, 'src/player-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  playerWin.loadFile('src/player.html');
  playerWin.webContents.on('did-finish-load', () => {
    playerWin.webContents.send('player:set-source', mediaUrl);
  });
}
```

**hls.js 集成（播放器渲染进程）：**

```javascript
// player-renderer.js
const Hls = require('hls.js');

function playStream(url, videoElement) {
  if (url.includes('.m3u8')) {
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(url);
      hls.attachMedia(videoElement);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoElement.play());
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = url;
    }
  } else {
    // mp4/webm 直接播放
    videoElement.src = url;
  }
}
```

**mpegts.js 集成（FLV 直播流）：**

```javascript
// player-renderer.js
const mpegts = require('mpegts.js');

function playFlvStream(url, videoElement) {
  if (mpegts.isSupported()) {
    const player = mpegts.createPlayer({ type: 'flv', url, isLive: true });
    player.attachMediaElement(videoElement);
    player.load();
    player.play();
  }
}
```

### 4. CSP 注意事项

播放器 HTML 页面的 CSP 需要允许：
- `blob:` — hls.js/mpegts.js 使用 blob URL 创建 MediaSource
- `media-src` — 允许媒体播放

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; media-src blob: 'self'; script-src 'self'">
```

### 5. 与现有 CDP 基础设施的协作

项目已有 `cdp-manager.js`（Phase 22），可复用其 `attachForAI/detachForAI` 模式：
- **主检测路径：** `session.webRequest`（零成本，主进程直接拦截）
- **备选路径：** CDP `Network.requestWillBeSent`（需 attach debugger，但能获取更详细的请求上下文）
- **视频元素检测：** `executeJavaScript`（直接）或 CDP `Runtime.evaluate`（通过现有 cdp-manager）

## Version Compatibility Matrix

| Dependency | Electron 32.x Chromium ~130 | MSE Support | Notes |
|------------|---------------------------|-------------|-------|
| hls.js 1.6.x | Full | Full MSE | 稳定；`enableWorker` 需测试 CSP 兼容性 |
| mpegts.js 1.8.x | Full | Full MSE | 支持低延迟直播（llhls/wss） |

## What NOT to Add

| 避免 | 原因 |
|------|------|
| video.js | 引入完整 UI 框架与自研面板冲突；只底层解码 |
| flv.js | 2020 年停维护，mpegts.js 是活跃继任 |
| ffmpeg (Electron 内) | 原生二进制，打包复杂度高；Chromium 原生解码够用 |
| puppeteer-core | 项目已有 Electron 原生 CDP |
| plyr / clappr | UI 封装层无必要 |

## Sources

- [hls.js GitHub](https://github.com/video-dev/hls.js) — npm latest: 1.6.17
- [mpegts.js GitHub](https://github.com/xqq/mpegts.js) — npm latest: 1.8.1
- [Electron session.webRequest API](https://www.electronjs.org/docs/latest/api/web-request)
- [Electron webContents.executeJavaScript](https://www.electronjs.org/docs/latest/api/web-contents#contentsexecutejavascriptusergesture)
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)

---
*Stack research for: 多媒体功能集成 (v2.2)*
*Researched: 2026-08-06*
*Confidence: HIGH — 仅 2 个新依赖，大量复用现有 Electron 原生 API*

---

# Stack Research: 下载管理器 + 自动填充 (v2.3)

**Project:** Realm Browser
**Researched:** 2026-08-11
**Mode:** Ecosystem
**Confidence:** HIGH

## Download Manager Stack

### 核心 API：Electron 原生 DownloadItem（零新依赖）

下载管理器完全基于 Electron 内置的 `Session.will-download` 事件和 `DownloadItem` 类，无需引入任何第三方库。

| API | Module | Purpose |
|-----|--------|---------|
| `session.on('will-download')` | Electron (Main) | 拦截所有下载请求，获取 DownloadItem 实例 |
| `DownloadItem.pause()` / `resume()` | Electron (Main) | 暂停/恢复下载 |
| `DownloadItem.cancel()` | Electron (Main) | 取消下载 |
| `DownloadItem.getReceivedBytes()` / `getTotalBytes()` | Electron (Main) | 进度追踪 |
| `DownloadItem.getCurrentBytesPerSecond()` | Electron (Main) | 下载速度 |
| `DownloadItem.getPercentComplete()` | Electron (Main) | 百分比（0-100） |
| `DownloadItem.setSavePath()` / `setSaveDialogOptions()` | Electron (Main) | 设置保存路径/弹出保存对话框 |
| `DownloadItem.getState()` | Electron (Main) | 状态查询：progressing/completed/cancelled/interrupted |
| `DownloadItem.getURL()` / `getFilename()` / `getMimeType()` | Electron (Main) | 元数据获取 |
| `DownloadItem.getETag()` / `getLastModifiedTime()` | Electron (Main) | 断点续传所需 headers |
| `DownloadItem.getURLChain()` | Electron (Main) | 完整重定向链（用于恢复中断下载） |
| `dialog.showSaveDialog()` | Electron (Main) | 保存位置选择对话框 |
| `shell.showItemInFolder()` | Electron (Main) | 在 Finder 中显示已下载文件 |
| `shell.openPath()` | Electron (Main) | 打开已下载文件 |

### 下载历史持久化：复用 better-sqlite3

项目已有 `better-sqlite3` 依赖（用于历史记录和收藏夹），下载历史直接复用，无需新增依赖。

```sql
-- 下载记录表（建议按容器隔离，与历史记录一致）
CREATE TABLE IF NOT EXISTS downloads_{containerId} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  save_path TEXT,
  total_bytes INTEGER DEFAULT 0,
  received_bytes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'progressing',  -- progressing/completed/cancelled/interrupted
  mime_type TEXT,
  etag TEXT,
  last_modified TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

### 关键实现细节

**1. will-download 事件绑定位置**

必须在每个容器对应的 `session` 对象上注册，而非 `session.defaultSession`：

```javascript
// main.js — 容器初始化时注册
const partition = `persist:container-${containerId}`;
const ses = session.fromPartition(partition);
ses.on('will-download', (event, item, webContents) => {
  // 处理下载
});
```

**2. 断点续传条件**

`DownloadItem.resume()` 依赖服务端支持：
- `Range` 请求头支持
- `Last-Modified` 和 `ETag` 响应头
- 不支持时自动从头下载（Electron 自动处理）

**3. 进度更新频率**

`updated` 事件触发频率取决于网络速度，建议渲染进程使用 `setInterval` 轮询主进程状态，而非每次 `updated` 都发 IPC：

```javascript
// 主进程：缓存进度，渲染进程轮询
const downloadProgress = new Map(); // id → { received, total, speed, state }

item.on('updated', () => {
  downloadProgress.set(id, {
    received: item.getReceivedBytes(),
    total: item.getTotalBytes(),
    speed: item.getCurrentBytesPerSecond(),
    state: item.getState()
  });
});

// IPC handler：渲染进程定时调用
ipcMain.handle('download:get-progress', () => {
  return Object.fromEntries(downloadProgress);
});
```

## Autofill Stack

### 方案选择：CDP Autofill API + safeStorage 加密存储

自动填充功能采用两层架构：
1. **填充层**：Chrome DevTools Protocol (CDP) `Autofill` 域 — 直接调用 Chromium 内置的表单填充引擎
2. **存储层**：Electron `safeStorage` API — 使用操作系统原生加密（macOS Keychain）保护凭据

### 填充层：CDP Autofill API

| Method | Purpose | Notes |
|--------|---------|-------|
| `Autofill.enable()` | 启用 Autofill 域 | 必须先调用 |
| `Autofill.setAddresses({addresses})` | 设置地址数据 | 地址表单填充 |
| `Autofill.trigger({fieldId, frameId, address/card})` | 触发指定字段填充 | 需要 DOM.BackendNodeId |

**关键类型：**
- `Autofill.Address` — 包含 `fields: AddressField[]`
- `Autofill.AddressField` — `{name: string, value: string}`（name 如 `GIVEN_NAME`, `FAMILY_NAME`, `EMAIL_ADDRESS`, `TEL`）
- `Autofill.CreditCard` — `{number, name, expiryMonth, expiryYear, cvc}`
- `Autofill.FilledField` — 填充结果反馈（htmlType, id, name, value, autofillType, fillingStrategy）

**与现有 CDP 基础设施的集成：**

项目已有 `cdp-manager.js`（Phase 22），支持 `attachForAI/detachForAI/executeCommand` 模式。自动填充可复用此基础设施：

```javascript
// 复用现有 cdp-manager 的 attach 模式
const { webContentsId } = await cdpManager.attachForAI(tabId);
const wc = webContents.fromId(webContentsId);

// 启用 Autofill 域
await wc.debugger.sendCommand('Autofill.enable');

// 设置凭据并触发填充
await wc.debugger.sendCommand('Autofill.setAddresses', {
  addresses: [{
    fields: [
      { name: 'EMAIL_ADDRESS', value: savedCredential.username },
      { name: 'PASSWORD', value: decryptedPassword }
    ]
  }]
});

// 获取目标字段的 backendNodeId 并触发
await wc.debugger.sendCommand('Autofill.trigger', {
  fieldId: backendNodeId,
  frameId: frameId,
  address: {
    fields: [
      { name: 'EMAIL_ADDRESS', value: savedCredential.username },
      { name: 'PASSWORD', value: decryptedPassword }
    ]
  }
});
```

### 存储层：Electron safeStorage API

| Method | Purpose | Notes |
|--------|---------|-------|
| `safeStorage.isEncryptionAvailable()` | 检查加密可用性 | macOS 总是可用 |
| `safeStorage.encryptStringAsync(plainText)` | 异步加密字符串 | 推荐使用异步版本，避免阻塞 |
| `safeStorage.decryptStringAsync(encrypted)` | 异步解密 | 返回 `{result, shouldReEncrypt}` |
| `safeStorage.getSelectedStorageBackend()` | 获取后端类型 | Linux 专用，检测 `basic_text` 弱加密 |

**macOS 平台行为：**
- 使用 Keychain 存储密钥
- 首次加密可能弹出 Keychain 访问提示
- 加密数据不可跨机器/用户迁移
- 异步 API 推荐（避免阻塞主线程）

**凭据存储表结构（SQLite）：**

```sql
-- 全局凭据表（跨容器共享，类似收藏夹）
CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin TEXT NOT NULL,           -- https://example.com
  username TEXT NOT NULL,          -- 用户名（明文，非敏感）
  password_encrypted BLOB NOT NULL, -- safeStorage 加密后的密码
  credential_type TEXT DEFAULT 'login', -- login/address
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(origin, username)
);

-- 地址信息表
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT DEFAULT '默认',       -- 地址标签
  fields_encrypted BLOB NOT NULL,  -- safeStorage 加密的 JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 登录凭据检测与保存

检测登录表单提交并提示保存：

```javascript
// 通过 CDP 监听表单提交事件
await wc.debugger.sendCommand('DOM.enable');
await wc.debugger.sendCommand('Runtime.evaluate', {
  expression: `
    document.addEventListener('submit', (e) => {
      const form = e.target;
      const passwordField = form.querySelector('input[type="password"]');
      if (passwordField) {
        const usernameField = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"]');
        window.__realmCredentialCapture = {
          origin: location.origin,
          username: usernameField?.value || '',
          hasPassword: true
        };
      }
    }, true);
  `
});
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| 下载管理 | Electron 原生 DownloadItem | electron-dl | electron-dl 是轻封装，功能有限；原生 API 已足够，避免依赖 |
| 下载历史存储 | better-sqlite3 (已有) | electron-store | SQLite 更适合列表查询和分页；项目已有 better-sqlite3 |
| 凭据加密 | safeStorage (Electron 原生) | keytar / node-keytar | keytar 已停止维护；safeStorage 是官方推荐方案 |
| 凭据加密 | safeStorage | SQLCipher | SQLCipher 需要原生编译，增加打包复杂度；safeStorage 更轻量 |
| 表单填充 | CDP Autofill API | DOM 直接操作 (Input.dispatchKeyEvent) | CDP Autofill 调用 Chromium 内置引擎，处理 autocomplete 属性和复杂表单更可靠 |
| 表单填充 | CDP Autofill API | executeJavaScript 注入 | executeJavaScript 无法触发 Chromium 的 autofill 事件链，密码管理器弹窗等 UI 不会触发 |
| 凭据存储 | SQLite + safeStorage 加密字段 | 全库加密 (better-crypto3) | 全库加密性能差；只加密敏感字段更高效 |

## Installation

```bash
# 无新增 npm 依赖！全部基于现有依赖和 Electron 原生 API
# 依赖清单：
# - Electron 原生: DownloadItem, safeStorage, dialog, shell
# - 已有依赖: better-sqlite3 (下载历史/凭据存储)
# - 已有基础设施: cdp-manager.js (Autofill 填充)
```

## Integration Points

### 1. 下载拦截与管理 (Phase: DL-01~05)

**主进程下载管理器模块 (`download-manager.js`)：**

```javascript
// download-manager.js
const { session, ipcMain, dialog, shell, BrowserWindow } = require('electron');
const Database = require('better-sqlite3');

/** @type {Map<number, {item: DownloadItem, id: number, containerId: string}>} */
const activeDownloads = new Map();

/**
 * 初始化下载管理器
 * @param {import('electron-store')} store - 配置存储
 */
function init(store) {
  // 注册 IPC handlers
  ipcMain.handle('download:get-all', handleGetDownloads);
  ipcMain.handle('download:pause', handlePauseDownload);
  ipcMain.handle('download:resume', handleResumeDownload);
  ipcMain.handle('download:cancel', handleCancelDownload);
  ipcMain.handle('download:open-file', handleOpenFile);
  ipcMain.handle('download:show-in-folder', handleShowInFolder);
  ipcMain.handle('download:delete-record', handleDeleteRecord);
  ipcMain.handle('download:get-progress', handleGetProgress);
}

/**
 * 为容器 session 注册下载拦截器
 * @param {string} containerId
 * @param {import('electron').Session} ses
 */
function registerContainerSession(containerId, ses) {
  ses.on('will-download', (event, item, webContents) => {
    const downloadId = Date.now(); // 简单 ID 生成

    // 弹出保存对话框或使用默认路径
    item.setSaveDialogOptions({
      title: '保存文件',
      defaultPath: item.getFilename()
    });

    // 追踪活跃下载
    activeDownloads.set(downloadId, { item, containerId });

    // 写入数据库
    insertDownloadRecord(containerId, {
      url: item.getURL(),
      filename: item.getFilename(),
      totalBytes: item.getTotalBytes(),
      mimeType: item.getMimeType()
    });

    // 进度更新
    item.on('updated', () => {
      updateDownloadProgress(downloadId, {
        received: item.getReceivedBytes(),
        total: item.getTotalBytes(),
        speed: item.getCurrentBytesPerSecond(),
        state: item.getState()
      });
      // 通知渲染进程
      BrowserWindow.getAllWindows()[0]?.webContents.send('download:progress', {
        id: downloadId,
        received: item.getReceivedBytes(),
        total: item.getTotalBytes(),
        speed: item.getCurrentBytesPerSecond()
      });
    });

    // 完成处理
    item.once('done', (e, state) => {
      activeDownloads.delete(downloadId);
      finalizeDownload(downloadId, state, item.getSavePath());
      BrowserWindow.getAllWindows()[0]?.webContents.send('download:done', {
        id: downloadId, state, savePath: item.getSavePath()
      });
    });
  });
}
```

### 2. 自动填充凭据管理 (Phase: AF-01~04)

**凭据管理器模块 (`credential-manager.js`)：**

```javascript
// credential-manager.js
const { safeStorage, ipcMain } = require('electron');
const Database = require('better-sqlite3');

/**
 * 保存登录凭据
 * @param {string} origin - 网站 origin
 * @param {string} username - 用户名
 * @param {string} password - 明文密码（将被加密）
 */
async function saveCredential(origin, username, password) {
  const encrypted = await safeStorage.encryptStringAsync(password);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO credentials (origin, username, password_encrypted, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(origin, username, encrypted);
}

/**
 * 获取匹配的凭据
 * @param {string} origin
 * @returns {Promise<Array<{username: string, password: string}>>}
 */
async function getCredentials(origin) {
  const rows = db.prepare('SELECT * FROM credentials WHERE origin = ?').all(origin);
  const results = [];
  for (const row of rows) {
    const { result } = await safeStorage.decryptStringAsync(row.password_encrypted);
    results.push({ username: row.username, password: result });
  }
  return results;
}
```

### 3. 与现有 CDP 基础设施的协作

自动填充完全复用 `cdp-manager.js` 的 `attachForAI/detachForAI` 模式：

```javascript
// credential-manager.js — 使用 cdp-manager 填充表单
const cdpManager = require('./cdp-manager');

/**
 * 在 webview 中填充凭据
 * @param {number} tabId - 标签页 webContents ID
 * @param {object} credential - {username, password}
 */
async function autofillCredential(tabId, credential) {
  const wc = await cdpManager.attachForAI(tabId);
  try {
    await wc.debugger.sendCommand('Autofill.enable');
    await wc.debugger.sendCommand('Autofill.setAddresses', {
      addresses: [{
        fields: [
          { name: 'EMAIL_ADDRESS', value: credential.username },
          { name: 'PASSWORD', value: credential.password }
        ]
      }]
    });
    // 触发填充（需要获取目标字段的 backendNodeId）
    // 实际实现需要 DOM.getDocument + DOM.querySelector 获取节点
  } finally {
    await cdpManager.detachForAI(tabId);
  }
}
```

## Version Compatibility Matrix

| Component | Version | Compatibility | Notes |
|-----------|---------|---------------|-------|
| Electron DownloadItem | 32.x (Chromium 128+) | Full | API 稳定，从 Electron 早期版本就有 |
| Electron safeStorage | 32.x | Full | 异步 API 推荐（`encryptStringAsync`/`decryptStringAsync`） |
| CDP Autofill Domain | Chromium 128+ | Experimental | 状态为 experimental，但 API 稳定可用 |
| better-sqlite3 | ^13.0.2 (已有) | Full | 复用，无需升级 |

## What NOT to Add

| 避免 | 原因 |
|------|------|
| electron-dl | 原生 DownloadItem API 已足够；electron-dl 是轻封装，功能有限且增加依赖 |
| keytar / node-keytar | 已停止维护；safeStorage 是 Electron 官方推荐方案 |
| SQLCipher | 需要原生编译，增加打包复杂度；safeStorage 字段级加密更轻量 |
| puppeteer-core | 项目已有 Electron 原生 CDP 基础设施 |
| chromium autofill extensions API | Electron 不支持 Chrome 扩展 API；CDP Autofill 域是正确路径 |
| argon2 / bcrypt (密码哈希) | 密码需要可逆存储（用于自动填充），不能单向哈希；safeStorage 加密是正确方案 |
| electron-updater (下载相关) | 这是自动更新模块，与文件下载管理无关 |

## Sources

- [Electron DownloadItem API](https://www.electronjs.org/docs/latest/api/download-item) — 完整方法/事件/状态文档
- [Electron Session will-download](https://www.electronjs.org/docs/latest/api/session#event-will-download) — 下载拦截事件
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — 加密/解密 API（含异步版本）
- [CDP Autofill Domain](https://chromedevtools.github.io/devtools-protocol/tot/Autofill/) — 表单填充协议规范
- [Chromium field_types.cc](https://source.chromium.org/chromium/chromium/+/main:components/autofill/core/browser/field_types.cc) — Autofill 支持的字段名列表

---
*Stack research for: 下载管理器 + 自动填充 (v2.3)*
*Researched: 2026-08-11*
*Confidence: HIGH — 零新 npm 依赖，全部基于 Electron 原生 API + 现有依赖*

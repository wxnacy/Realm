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

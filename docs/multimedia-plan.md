# Realm Browser 多媒体功能实现规划

## 功能优先级与分阶段实施

### P0: 视频源检测与播放（第一阶段）
### P1: 播放器核心功能（第一阶段）
### P2: 下载与边播边缓存（第二阶段）

---

## 第一阶段：视频源检测与播放器

### 1. 视频源检测模块 (media-sniffer)

**文件位置**: `media-sniffer.js`

**核心功能**:
- 拦截网络请求，筛选视频资源 URL（mp4, m3u8, flv, webm 等）
- 注入页面脚本检测 `<video>` 和 `<source>` 元素
- 支持动态加载的视频（MutationObserver）
- 去重和分类管理媒体列表

**技术方案**:

```javascript
// media-sniffer.js
class MediaSniffer {
  constructor() {
    this.mediaList = new Map(); // url -> { type, quality, timestamp }
  }

  /**
   * 初始化网络请求拦截
   * 在 session-created 事件中调用
   * @param {Electron.Session} ses - 容器 session
   */
  initWebRequestInterceptor(ses) {
    ses.webRequest.onBeforeRequest(
      { urls: ['*://*/*.m3u8*', '*://*/*.mp4*', '*://*/*.flv*', '*://*/*.webm*'] },
      (details, callback) => {
        this.addMedia(details.url, this.detectType(details.url));
        callback({});
      }
    );
  }

  /**
   * 注入页面脚本检测视频元素
   * @param {Electron.WebContents} webContents - 页面 webContents
   */
  injectDetector(webContents) {
    webContents.executeJavaScript(`
      (function() {
        const videos = document.querySelectorAll('video, video source');
        const mediaUrls = [];
        videos.forEach(el => {
          if (el.src) mediaUrls.push(el.src);
          if (el.currentSrc) mediaUrls.push(el.currentSrc);
        });
        // 通过 IPC 发送给主进程
        if (mediaUrls.length > 0) {
          window.realmAPI.reportMediaSources(mediaUrls);
        }
      })();
    `);
  }
}
```

**IPC 通道**:
- `media:get-list` - 获取当前页面媒体列表
- `media:report-sources` - 渲染进程上报检测到的媒体
- `media:clear-list` - 清空媒体列表（切换页面时）

---

### 2. 媒体面板 UI (media-panel)

**文件位置**: `src/index.html` + `src/renderer.js` + `src/styles/main.css`

**UI 设计**:

```html
<!-- 工具栏新增按钮 -->
<button class="btn-icon" id="mediaPanelBtn" title="媒体资源">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
</button>

<!-- 媒体面板（浮动层） -->
<div class="media-panel hidden" id="mediaPanel">
  <div class="media-panel-header">
    <h3>媒体资源</h3>
    <button class="btn-icon media-panel-close" id="mediaPanelClose">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"></path>
      </svg>
    </button>
  </div>
  <div class="media-list" id="mediaList">
    <div class="media-empty">未检测到媒体资源</div>
  </div>
</div>
```

**媒体列表项结构**:

```html
<div class="media-item" data-url="https://example.com/video.m3u8" data-type="m3u8">
  <div class="media-item-icon">
    <svg width="20" height="20"><!-- 根据类型显示不同图标 --></svg>
  </div>
  <div class="media-item-info">
    <div class="media-item-name">video.m3u8</div>
    <div class="media-item-meta">
      <span class="media-type-badge">HLS</span>
      <span class="media-url-preview">https://example.com/...</span>
    </div>
  </div>
  <div class="media-item-actions">
    <button class="btn-icon media-play-btn" title="播放">
      <svg width="16" height="16"><!-- 播放图标 --></svg>
    </button>
    <button class="btn-icon media-copy-btn" title="复制链接">
      <svg width="16" height="16"><!-- 复制图标 --></svg>
    </button>
  </div>
</div>
```

**样式设计** (main.css):

```css
.media-panel {
  position: absolute;
  top: 60px;
  right: 20px;
  width: 400px;
  max-height: 500px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.media-list {
  overflow-y: auto;
  padding: 8px;
}

.media-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.media-item:hover {
  background: var(--bg-hover);
}

.media-type-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--accent-color);
  color: white;
}
```

---

### 3. 播放器窗口 (player-window)

**文件位置**: `player-window.js` + `src/player.html` + `src/player.js` + `src/player.css`

**架构设计**:

```
点击播放 → 主进程创建 PlayerWindow → 加载 player.html
                                          ├── video.js 播放器实例
                                          ├── hls.js（m3u8 支持）
                                          ├── 与主窗口 IPC 通信
                                          └── 播放控制 UI
```

**player.html 结构**:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Realm Player</title>
  <link rel="stylesheet" href="player.css">
</head>
<body>
  <div class="player-container">
    <video id="videoPlayer" controls></video>

    <!-- 自定义控制栏（可选） -->
    <div class="player-controls">
      <button id="playPauseBtn">播放/暂停</button>
      <input type="range" id="progressBar" min="0" max="100" value="0">
      <span id="timeDisplay">00:00 / 00:00</span>
      <input type="range" id="volumeBar" min="0" max="100" value="100">
      <button id="fullscreenBtn">全屏</button>
      <select id="playbackRate">
        <option value="0.5">0.5x</option>
        <option value="1" selected>1x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
      </select>
    </div>
  </div>

  <script src="../node_modules/hls.js/dist/hls.min.js"></script>
  <script src="player.js"></script>
</body>
</html>
```

**player.js 核心逻辑**:

```javascript
// src/player.js
const video = document.getElementById('videoPlayer');
let hls = null;

/**
 * 初始化播放器
 * @param {string} url - 视频 URL
 * @param {string} type - 视频类型 (mp4/m3u8/flv)
 */
function initPlayer(url, type) {
  if (type === 'm3u8' && Hls.isSupported()) {
    hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 600,
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play();
    });
  } else {
    // 原生支持 mp4/webm 或 Safari 原生 HLS
    video.src = url;
    video.play();
  }
}

// 监听主进程传来的播放指令
window.electronAPI.onPlayMedia((event, { url, type }) => {
  initPlayer(url, type);
});
```

**主进程播放器窗口管理** (player-window.js):

```javascript
// player-window.js
const { BrowserWindow } = require('electron');
const path = require('path');

class PlayerWindow {
  constructor() {
    this.window = null;
  }

  /**
   * 创建播放器窗口
   * @param {string} url - 视频 URL
   * @param {string} type - 视频类型
   * @param {Electron.Rectangle} bounds - 窗口位置和大小
   */
  create(url, type, bounds) {
    this.window = new BrowserWindow({
      width: 960,
      height: 600,
      ...bounds,
      webPreferences: {
        preload: path.join(__dirname, 'src/player-preload.js'),
        contextIsolation: true,
      },
    });

    this.window.loadFile('src/player.html');

    this.window.webContents.on('did-finish-load', () => {
      this.window.webContents.send('play-media', { url, type });
    });
  }
}

module.exports = new PlayerWindow();
```

---

### 4. IPC 通道注册 (ipc-handlers.js)

**新增通道**:

```javascript
// ipc-handlers.js 新增

// 媒体检测相关
ipcMain.handle('media:get-list', async (event) => {
  const contentsId = event.sender.id;
  return mediaSniffer.getMediaList(contentsId);
});

ipcMain.handle('media:report-sources', async (event, urls) => {
  const contentsId = event.sender.id;
  mediaSniffer.addFromPage(contentsId, urls);
  return true;
});

ipcMain.handle('media:clear-list', async (event) => {
  const contentsId = event.sender.id;
  mediaSniffer.clearList(contentsId);
  return true;
});

// 播放器相关
ipcMain.handle('media:play', async (event, { url, type }) => {
  playerWindow.create(url, type);
  return true;
});

ipcMain.handle('media:copy-url', async (event, url) => {
  const { clipboard } = require('electron');
  clipboard.writeText(url);
  return true;
});
```

---

### 5. Preload 暴露接口 (src/preload.js)

**新增 API**:

```javascript
// src/preload.js 新增

// 媒体相关 API
mediaAPI: {
  getMediaList: () => ipcRenderer.invoke('media:get-list'),
  reportSources: (urls) => ipcRenderer.invoke('media:report-sources', urls),
  clearList: () => ipcRenderer.invoke('media:clear-list'),
  play: (url, type) => ipcRenderer.invoke('media:play', { url, type }),
  copyUrl: (url) => ipcRenderer.invoke('media:copy-url', url),
  onMediaListUpdate: (callback) => {
    ipcRenderer.on('media:list-updated', (event, list) => callback(list));
  },
},
```

---

### 6. 实施步骤

**第一步：创建 media-sniffer.js**
1. 实现网络请求拦截逻辑
2. 实现媒体 URL 解析和分类
3. 实现页面脚本注入检测
4. 导出单例实例

**第二步：添加 IPC 通道**
1. 在 ipc-handlers.js 中注册媒体相关通道
2. 在 preload.js 中暴露媒体 API
3. 测试 IPC 通信

**第三步：实现媒体面板 UI**
1. 在 index.html 中添加按钮和面板 HTML
2. 在 main.css 中添加样式
3. 在 renderer.js 中添加交互逻辑

**第四步：实现播放器窗口**
1. 创建 player-window.js 主进程模块
2. 创建 src/player.html 和 src/player.js
3. 创建 src/player-preload.js
4. 集成 hls.js 支持 m3u8

**第五步：集成和测试**
1. 在 session-created 事件中初始化 media-sniffer
2. 测试各种视频网站的检测
3. 测试播放器功能

---

## 第二阶段：下载与边播边缓存

### 1. 下载管理器 (download-manager)

**文件位置**: `download-manager.js`

**核心功能**:
- 管理下载任务队列
- 支持暂停/恢复/取消
- 进度通知和状态持久化

### 2. m3u8 下载器

**技术方案**:
- 解析 m3u8 获取所有 ts 分片 URL
- 并发下载分片（可配置并发数）
- 合并为 mp4（可选，需 ffmpeg）
- 或保持 ts 格式并生成播放列表

### 3. 边播边缓存

**技术方案**:
- 使用 `session.protocol.interceptStreamProtocol` 拦截请求
- 同时写入本地缓存和转发给播放器
- 实现 Range Request 支持
- 缓存命中时直接读本地

---

## 依赖管理

**新增依赖** (package.json):

```json
{
  "dependencies": {
    "hls.js": "^1.5.0"
  }
}
```

**可选依赖**（第二阶段）:

```json
{
  "dependencies": {
    "flv.js": "^1.6.0",
    "ffmpeg-static": "^5.2.0"
  }
}
```

---

## 代码规范遵循

- 文件名：kebab-case（`media-sniffer.js`）
- 变量/函数：camelCase
- 常量：UPPER_SNAKE_CASE
- CSS 类名：kebab-case
- 2 空格缩进
- 单引号字符串
- 语句末尾分号
- JSDoc 注释

---

## 测试计划

### 单元测试
- MediaSniffer 类的方法测试
- URL 解析和分类测试

### 集成测试
- 网络请求拦截测试
- 页面脚本注入测试
- IPC 通信测试

### E2E 测试
- 打开视频网站，验证媒体检测
- 点击播放按钮，验证播放器打开
- 测试不同格式的视频播放

---

## 风险和注意事项

1. **CSP 限制**: 某些网站的 CSP 可能阻止脚本注入
   - 解决：通过 webview 的 executeJavaScript 绕过

2. **动态加载视频**: SPA 网站可能动态加载视频
   - 解决：使用 MutationObserver 监听 DOM 变化

3. **DRM 保护**: 某些视频有 DRM 保护
   - 限制：不支持 DRM 保护的视频

4. **性能影响**: 频繁的网络请求拦截可能影响性能
   - 解决：使用防抖和批量处理

5. **hls.js 版本兼容**: 确保与 Electron 版本兼容
   - 解决：测试验证

---

## 后续扩展

- 支持更多视频格式（DASH、RTMP）
- 视频下载管理器 UI
- 播放列表支持
- 画中画模式
- 视频截图功能
- 字幕支持

# Architecture Patterns — v2.2 多媒体功能集成

**Domain:** Electron 多容器浏览器 - 多媒体播放
**Researched:** 2026-08-06
**Confidence:** HIGH

## Recommended Architecture

### 现有架构（需要集成的部分）

```
Main Process (main.js)
├── container-manager.js    # 容器生命周期
├── tab-manager.js          # Tab 管理
├── window-manager.js       # 窗口管理
├── ipc-handlers.js         # IPC 通道注册
└── cdp-manager.js          # CDP 调试器（已有网络拦截能力）

Renderer Process (src/)
├── renderer.js             # UI 交互逻辑
├── index.html              # 主界面
└── preload.js              # IPC 暴露层
```

### 多媒体功能新增模块

```
Main Process (新增)
├── media-sniffer.js        # 媒体源检测器（核心模块）
└── player-window.js        # 播放器窗口管理

Renderer Process (修改)
├── index.html              # 添加媒体面板 HTML
├── renderer.js             # 添加媒体面板交互逻辑
└── main.css                # 添加媒体面板样式

Player Window (新增)
├── src/player.html         # 播放器页面
├── src/player.js           # 播放器逻辑
├── src/player.css          # 播放器样式
└── src/player-preload.js   # 播放器 IPC 桥接
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| media-sniffer.js | 网络请求拦截 + DOM 检测 + 媒体列表管理 | ipc-handlers.js, renderer.js |
| player-window.js | 播放器窗口生命周期管理 | main.js, player-preload.js |
| player.js | 播放器 UI + hls.js/mpegts.js 集成 | player-preload.js |
| renderer.js (修改) | 媒体面板 UI 交互 | media-sniffer.js (via IPC) |

## Data Flow

### 完整数据流

```
1. 用户访问视频网站
   │
   ▼
2. webview 发起网络请求（如 .m3u8）
   │
   ▼
3. Session.webRequest 拦截请求（主进程，不受 CSP 限制）
   │
   ▼
4. media-sniffer.addMedia(url, containerId, { tabId })
   │
   ├── 存入 mediaByContainer: Map<containerId, Map<url, MediaInfo>>
   ├── 存入 mediaByTab: Map<tabId, Set<url>>
   │
   ▼
5. 主进程发送 'media:list-updated' 到渲染进程
   │
   ▼
6. 渲染进程更新媒体面板 UI
   │
   ▼
7. 用户点击播放按钮
   │
   ▼
8. 渲染进程调用 'media:play' IPC
   │
   ▼
9. 主进程创建播放器窗口（player-window.js）
   │
   ▼
10. 播放器窗口接收 'play-media' 事件
    │
    ▼
11. hls.js / mpegts.js / <video> 开始播放
```

## Patterns to Follow

### Pattern 1: 双重检测策略

**What:** 网络拦截为主，DOM 注入为辅
**When:** 媒体源检测场景
**Why:** session.webRequest 不受 CSP 限制，是主检测手段；executeJavaScript 能发现 DOM 动态加载的视频，作为补充

```javascript
// 方案 1（主）：webRequest 拦截（主进程，不受 CSP 限制）
ses.webRequest.onBeforeRequest(
  { urls: ['*://*/*.m3u8*', '*://*/*.mp4*', '*://*/*.flv*'] },
  (details, callback) => {
    mediaSniffer.addMedia(details.url, containerId);
    callback({});
  }
);

// 方案 2（辅）：executeJavaScript（渲染进程，受 CSP 限制但能检测 DOM）
webview.executeJavaScript(`
  Array.from(document.querySelectorAll('video, video source'))
    .forEach(el => {
      if (el.src || el.currentSrc) {
        window.realmAPI?.reportMediaSources([el.src || el.currentSrc]);
      }
    });
`).catch(() => {
  // CSP 阻止了脚本注入，回退到纯网络拦截模式
});
```

### Pattern 2: 按容器隔离的媒体列表

**What:** 每个容器维护独立的媒体列表
**When:** 媒体嗅探数据存储
**Why:** 与现有 Cookie/历史记录的隔离策略一致

```javascript
// media-sniffer.js
this.mediaByContainer = new Map(); // containerId -> Map<url, MediaInfo>
this.mediaByTab = new Map();       // tabId -> Set<url>
```

### Pattern 3: 独立播放器窗口

**What:** 使用独立 BrowserWindow 承载播放器
**When:** 视频播放场景
**Why:** 进程隔离（播放器崩溃不影响主窗口）+ 窗口独立（支持全屏/拖拽）

```javascript
// player-window.js
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
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: 在 defaultSession 上注册拦截器

**What:** 错误地在 `session.defaultSession` 上注册 webRequest 拦截器
**Why bad:** 容器使用 `persist:container-{id}` partition，defaultSession 拦截不到容器请求
**Instead:** 在每个容器的 `session.fromPartition()` 对象上注册

```javascript
// 错误
session.defaultSession.webRequest.onBeforeRequest(filter, handler);

// 正确
const ses = session.fromPartition(`persist:container-${containerId}`);
ses.webRequest.onBeforeRequest(filter, handler);
```

### Anti-Pattern 2: CSP 配置遗漏 blob: media-src

**What:** 播放器 HTML 页面的 CSP 未允许 blob: 和 media-src
**Why bad:** hls.js/mpegts.js 使用 blob URL 创建 MediaSource，CSP 阻止会导致播放失败
**Instead:** 在 player.html 中配置正确的 CSP

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; media-src blob: 'self'; script-src 'self'">
```

### Anti-Pattern 3: 引入重量级播放器框架

**What:** 引入 video.js / plyr / clappr 等完整播放器框架
**Why bad:** 引入完整 UI 系统与自研媒体面板冲突，增加包体积
**Instead:** 使用底层解码库（hls.js / mpegts.js）+ 自研 UI

## Scalability Considerations

| Concern | At 100 media items | At 1K media items | At 10K media items |
|---------|-------------------|-------------------|-------------------|
| 内存占用 | ~1MB | ~10MB | ~100MB（需 LRU 淘汰） |
| 面板渲染 | 流畅 | 需虚拟滚动 | 必须虚拟滚动 |
| 拦截性能 | 无影响 | 无影响 | 需要批量去重 |

## Code Changes Estimate

### New Files

| File | Responsibility | Est. Lines |
|------|---------------|-----------|
| `media-sniffer.js` | 媒体检测核心逻辑 | 150-200 |
| `player-window.js` | 播放器窗口管理 | 80-100 |
| `src/player.html` | 播放器页面结构 | 50-60 |
| `src/player.js` | 播放器交互逻辑 | 150-200 |
| `src/player.css` | 播放器样式 | 100-120 |
| `src/player-preload.js` | 播放器 IPC 桥接 | 30-40 |

### Modified Files

| File | Changes |
|------|---------|
| `main.js` | 初始化 media-sniffer、player-window |
| `ipc-handlers.js` | 添加 media:* IPC 通道 |
| `src/preload.js` | 添加 media API 到 realmAPI |
| `src/renderer.js` | 添加媒体面板交互逻辑 |
| `src/index.html` | 添加媒体面板 HTML |
| `src/styles/main.css` | 添加媒体面板样式 |
| `package.json` | 添加 hls.js + mpegts.js 依赖 |

## Sources

- [Electron Session.webRequest](https://www.electronjs.org/docs/latest/api/session#sessionwebrequest)
- [hls.js GitHub](https://github.com/video-dev/hls.js) — npm 1.6.17
- [mpegts.js GitHub](https://github.com/xqq/mpegts.js) — npm 1.8.1
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)

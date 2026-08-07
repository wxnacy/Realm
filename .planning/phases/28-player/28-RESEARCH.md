# Phase 28: 播放器窗口 - Research

**Researched:** 2026-08-07
**Domain:** Electron 视频播放器、流媒体库集成、BrowserWindow 管理
**Confidence:** HIGH

## Summary

Phase 28 需要将现有的占位播放器页面（player.html）升级为功能完整的独立播放器窗口。核心工作包括：替换 media:play IPC handler 中的简单 BrowserWindow 创建逻辑为支持 Session 隔离的播放器窗口管理；在 player.html/js/css 中实现格式检测与按需加载库（hls.js/mpegts.js/dash.js）；构建沉浸式暗色 UI 控制栏；以及正确的资源释放机制。

关键技术决策已在 CONTEXT.md 中锁定：HLS 用 hls.js、FLV/MPEG-TS 用 mpegts.js、DASH 用 dash.js、MP4/WebM 用 Chromium 原生播放。播放器窗口为独立 BrowserWindow，复用来源容器的 Session partition，无边框设计。

当前 player.html 是 Phase 26 的占位实现，仅支持 MP4/WebM 的原生播放，无格式检测、无自定义控制栏、无资源清理。ipc-handlers.js 中的 media:play handler 创建的 BrowserWindow 缺少 Session 隔离、无边框配置、CSP 策略未适配 Worker。

**Primary recommendation:** 在 ipc-handlers.js 中重写 media:play handler，创建支持 Session 隔离的无边框播放器窗口；在 player.js 中实现格式检测 + 按需库加载 + 自定义控制栏；player.css 独立于 main.css。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 播放器窗口创建/销毁 | API/Backend (main.js) | -- | BrowserWindow 生命周期由主进程管理 |
| 格式检测与库选择 | Browser/Client (player.js) | -- | 纯前端逻辑，根据 URL 后缀选择播放库 |
| 视频播放与控制 | Browser/Client (player.js) | -- | video 元素操作、hls.js/mpegts.js/dash.js 初始化均在渲染进程 |
| Session 隔离 | API/Backend (main.js) | -- | Session partition 在主进程创建窗口时指定 |
| 媒体列表获取 | API/Backend (main.js) | Browser/Client | 主进程提供 IPC，播放器进程调用 |
| 资源释放 | API/Backend (main.js) | Browser/Client | 窗口 close 事件在主进程，库实例销毁在渲染进程 |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAYER-01 | 播放器使用独立 BrowserWindow 打开，支持窗口大小调整和全屏 | ipc-handlers.js 中重写 media:play handler，BrowserWindow 配置 frame:false + resizable + fullscreen |
| PLAYER-02 | HLS (m3u8) 通过 hls.js 播放 | hls.js ^1.6.17，CSP 需允许 blob: worker-src |
| PLAYER-03 | MP4/WebM 通过 Chromium 原生播放 | Chromium 原生 video 元素支持，无需额外库 |
| PLAYER-04 | FLV/MPEG-TS 通过 mpegts.js 播放 | mpegts.js ^1.8.1，MSE 模式 |
| PLAYER-05 | 播放/暂停控制 | 自定义控制栏 UI，video.play()/pause() API |
| PLAYER-06 | 进度条拖拽和时间显示 | input[type=range] 或自定义进度条，video.currentTime 赋值 |
| PLAYER-07 | 音量控制 | video.volume 属性，range slider |
| PLAYER-08 | 倍速选择 0.5x/1x/1.5x/2x | video.playbackRate 属性 |
| PLAYER-09 | 全屏模式 | BrowserWindow.setFullScreen() 或 video.requestFullscreen() |
| PLAYER-10 | 窗口关闭时销毁 hls.js/mpegts.js 实例，释放内存 | window beforeunload + hls.destroy()/mpegts.destroy()/dash.reset() |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 沉浸式暗色风格 -- 纯黑背景 (#000)，控件悬浮在视频底部，鼠标移动时淡入淡出
- **D-02:** 底部左右分组布局 -- 进度条占满整行，播放/暂停 + 时间显示在左，音量 + 倍速 + 全屏在右
- **D-03:** 控件自动隐藏 -- 鼠标静止 3 秒后控制栏自动隐藏，鼠标移动时重新出现，纯黑进度条细线保留
- **D-04:** 无边框窗口 -- 隐藏标题栏和原生控件，需要自定义关闭/最小化/最大化按钮
- **D-05:** 格式检测策略 -- URL 后缀优先 (.m3u8/.mp4/.flv/.webm/.ts/.mpd)，后缀不明确时回退到 Content-Type 判断
- **D-06:** HLS (m3u8) -- 使用 hls.js 播放
- **D-07:** FLV/MPEG-TS -- 使用 mpegts.js 播放
- **D-08:** DASH (mpd) -- 使用 dash.js 播放
- **D-09:** MP4/WebM -- 使用 Chromium 原生 <video> 播放，不加载额外库
- **D-10:** 库加载策略 -- 按需加载，仅当视频格式匹配时才初始化对应的 hls.js/mpegts.js/dash.js 实例
- **D-11:** 进度条 -- 支持拖拽跳转，鼠标悬停显示时间戳预览（无缩略图）
- **D-12:** 键盘快捷键 -- 空格暂停/播放，左右快进/快退 5 秒，上下调节音量，F 全屏，M 静音
- **D-13:** 双击全屏 -- 双击视频区域切换全屏/退出全屏
- **D-14:** 画中画 (PiP) -- 支持 Electron 原生 Picture-in-Picture 模式
- **D-15:** 拖拽实时预览 -- 拖动进度条时显示实时视频预览画面
- **D-16:** 播放列表 -- 从媒体面板获取当前容器的完整媒体列表，支持上一个/下一个切换
- **D-17:** 倍速选择 -- 支持 0.5x / 1x / 1.5x / 2x 播放倍速
- **D-18:** 时间显示 -- 进度条左侧显示 "当前时间 / 总时长"（HH:MM:SS 格式）
- **D-19:** 窗口尺寸 -- 默认 16:9 比例（如 960x540），用户可自由拖拽调整大小
- **D-20:** 窗口复用 -- 已有播放器窗口时，新视频在已有窗口中替换播放，不打开新窗口
- **D-21:** 资源释放 -- 窗口关闭时立即销毁 hls.js/mpegts.js/dash.js 实例并回收内存
- **D-22:** Session 隔离 -- 播放器窗口复用来源容器的 Session partition，携带同一容器的 Cookie

### Claude's Discretion

无 -- 所有决策均由用户明确选择

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hls.js [WARNING: flagged as suspicious -- verify before using.] | ^1.6.17 (verified 1.6.17 on npm) | HLS (m3u8) 流媒体播放 | 业界标准 HLS 客户端，7.8M 周下载，GitHub video-dev/hls.js [VERIFIED: npm registry] |
| mpegts.js [WARNING: flagged as suspicious -- verify before using.] | ^1.8.1 (verified 1.8.1 on npm) | FLV/MPEG-TS 流媒体播放 | flv.js 的活跃继任者，MSE 模式，GitHub xqq/mpegts.js [VERIFIED: npm registry] |
| dashjs | ^5.2.0 (verified 5.2.0 on npm) | DASH (mpd) 流媒体播放 | DASH-Industry-Forum 官方参考实现，864K 周下载 [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | ^8.1.0 (已安装) | 播放器窗口位置/大小记忆 | 已有依赖，无需额外安装 |
| Electron Session API | 内置 | 容器 Session 隔离 | BrowserWindow webPreferences.session |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| hls.js | video.js + videojs-contrib-hls | video.js 更重，hls.js 更轻量专注 |
| mpegts.js | flv.js (已停维护) | flv.js 不再更新，mpegts.js 是其活跃 fork |
| dashjs | shaka-player (Google) | shaka-player 支持 DASH+HLS，但体积更大，hls.js 已覆盖 HLS |

**Installation:**
```bash
npm install hls.js@^1.6.17 mpegts.js@^1.8.1 dashjs@^5.2.0
```

**Version verification:**
```
hls.js:    1.6.17  (npm registry, 7.8M weekly downloads, GitHub video-dev/hls.js)
mpegts.js: 1.8.1   (npm registry, 36K weekly downloads, GitHub xqq/mpegts.js)
dashjs:    5.2.0   (npm registry, 864K weekly downloads, GitHub Dash-Industry-Forum/dash.js)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| hls.js | npm | ~8 年 (2017 首发) | 7.8M/wk | github.com/video-dev/hls.js | SUS (too-new: 最新版本 2026-08-05) | Flagged -- 实为成熟库，仅最新版本号新 |
| mpegts.js | npm | ~4 年 (2022 首发) | 36K/wk | github.com/xqq/mpegts.js | SUS (too-new: 最新版本 2026-08-06) | Flagged -- 实为成熟库（flv.js fork），仅最新版本号新 |
| dashjs | npm | ~10 年 (2015 首发) | 864K/wk | github.com/Dash-Industry-Forum/dash.js | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** hls.js, mpegts.js -- "too-new" 标记仅因最新版本发布时间近（npm 发布周期），这两个库均有多年历史和大量用户，实际安全性高。planner 应添加 checkpoint:human-verify 但预计会快速通过。

*所有三个包均无 postinstall 脚本，无安全风险。*

## Architecture Patterns

### System Architecture Diagram

```
媒体面板 (renderer.js)
  │
  │ playMedia(index) → window.mediaAPI.playMedia(url)
  │
  ▼
IPC: media:play (ipc-handlers.js)
  │
  │ 1. 检查播放器窗口是否已存在 (D-20 窗口复用)
  │ 2. 获取来源容器 Session partition
  │ 3. 创建/复用 BrowserWindow (frame:false, session)
  │ 4. 加载 player.html
  │ 5. 发送 media:play-url + 媒体列表 + 容器 ID
  │
  ▼
播放器窗口 (player.html + player.js)
  │
  ├── 格式检测 (D-05)
  │   ├── .m3u8 → hls.js (D-06)
  │   ├── .flv/.ts → mpegts.js (D-07)
  │   ├── .mpd → dash.js (D-08)
  │   └── .mp4/.webm → 原生 <video> (D-09)
  │
  ├── 控制栏 UI (D-01~D-04, D-11~D-18)
  │   ├── 播放/暂停
  │   ├── 进度条 (拖拽 + 时间预览)
  │   ├── 音量控制
  │   ├── 倍速选择
  │   ├── 播放列表 (上一个/下一个)
  │   └── 全屏 / 画中画
  │
  ├── 键盘快捷键 (D-12, D-13)
  │
  └── 资源释放 (D-21)
      └── window beforeunload → hls.destroy() / mpegts.destroy() / dash.reset()
```

### Recommended Project Structure

```
src/
├── player.html      # 播放器页面结构（替换现有占位页面）
├── player.js        # 播放器核心逻辑（格式检测、库初始化、控制栏、键盘快捷键）
├── player.css       # 播放器独立样式（沉浸式暗色风格）
└── styles/
    └── main.css     # 主窗口样式（播放器不引用）
```

### Pattern 1: 格式检测与按需库加载

**What:** 根据 URL 后缀判断视频格式，仅在匹配时动态加载对应播放库
**When to use:** 每次收到新视频 URL 时
**Example:**
```javascript
// player.js - 格式检测与库选择 (D-05, D-10)
function detectFormat(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.m3u8')) return 'hls';
  if (pathname.endsWith('.flv') || pathname.endsWith('.ts')) return 'mpegts';
  if (pathname.endsWith('.mpd')) return 'dash';
  if (pathname.endsWith('.mp4') || pathname.endsWith('.webm')) return 'native';
  return 'unknown';
}

async function initPlayer(url) {
  const format = detectFormat(url);
  const video = document.getElementById('player');

  switch (format) {
    case 'hls': {
      const Hls = (await import('hls.js')).default;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false }); // Electron CSP 兼容
        hls.loadSource(url);
        hls.attachMedia(video);
        return { engine: hls, destroy: () => hls.destroy() };
      }
      break;
    }
    case 'mpegts': {
      const mpegts = (await import('mpegts.js')).default;
      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer({ type: 'flv', url });
        player.attachMediaElement(video);
        player.load();
        player.play();
        return { engine: player, destroy: () => { player.unload(); player.detachMediaElement(); player.destroy(); } };
      }
      break;
    }
    case 'dash': {
      const dashjs = (await import('dashjs')).default;
      const player = dashjs.MediaPlayer().create();
      player.initialize(video, url, true);
      return { engine: player, destroy: () => player.reset() };
    }
    case 'native':
    default:
      video.src = url;
      video.play();
      return { engine: null, destroy: () => { video.src = ''; video.load(); } };
  }
}
```

### Pattern 2: 播放器窗口创建与 Session 隔离

**What:** 在主进程创建无边框 BrowserWindow，复用来源容器的 Session
**When to use:** 用户点击媒体面板的播放按钮时
**Example:**
```javascript
// ipc-handlers.js - media:play handler 重写 (D-04, D-19, D-20, D-22)
let playerWindow = null;
let playerContainerId = null;

ipcMain.handle('media:play', async (event, url) => {
  assertTrustedSender(event);

  // D-20: 窗口复用 -- 已有播放器窗口时替换播放
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send('media:play-url', url);
    playerWindow.focus();
    return { success: true };
  }

  // 获取来源容器 ID（从渲染进程事件推断）
  const containerId = getCurrentContainerFromEvent(event);
  const partition = `persist:container-${containerId}`;

  // D-04: 无边框窗口, D-19: 960x540, D-22: Session 隔离
  playerWindow = new BrowserWindow({
    width: 960,
    height: 540,
    minWidth: 480,
    minHeight: 270,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      session: session.fromPartition(partition),
    },
  });

  playerWindow.loadFile(path.join(__dirname, 'src/player.html'));
  playerWindow.webContents.on('did-finish-load', () => {
    playerWindow.webContents.send('media:play-url', url);
  });

  // D-21: 窗口关闭时清理
  playerWindow.on('closed', () => {
    playerWindow = null;
    playerContainerId = null;
  });

  return { success: true };
});
```

### Pattern 3: 控制栏自动隐藏

**What:** 鼠标静止 3 秒后控制栏淡出，移动时淡入
**When to use:** 播放器窗口内
**Example:**
```javascript
// player.js - 控制栏自动隐藏 (D-03)
let hideTimer = null;
const container = document.getElementById('player-container');
const controls = document.getElementById('controls');
const titleBar = document.getElementById('title-bar');

function showControls() {
  controls.style.opacity = '1';
  titleBar.style.opacity = '1';
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideControls, 3000);
}

function hideControls() {
  if (video.paused) return; // 暂停时不隐藏
  controls.style.opacity = '0';
  titleBar.style.opacity = '0';
}

container.addEventListener('mousemove', showControls);
container.addEventListener('mouseleave', hideControls);
video.addEventListener('play', () => { hideTimer = setTimeout(hideControls, 3000); });
video.addEventListener('pause', showControls);
```

### Anti-Patterns to Avoid

- **enableWorker: true in Electron:** hls.js 和 mpegts.js 默认启用 Web Worker，但 Electron 的 CSP 可能阻止 blob: Worker 创建。使用 `enableWorker: false` 或确保 CSP 包含 `worker-src 'self' blob:` [ASSUMED]
- **不在窗口关闭时销毁库实例:** hls.js/mpegts.js/dash.js 各自维护内部缓冲区和网络连接，不销毁会导致内存泄漏和后台网络请求
- **在 player.html 中引用 main.css:** 播放器窗口是独立 BrowserWindow，不应复用主窗口样式
- **video.requestFullscreen vs BrowserWindow.setFullScreen:** 在 Electron 中，应优先使用 `BrowserWindow.setFullScreen()` 以获得原生全屏行为，`video.requestFullscreen()` 在 frameless 窗口中可能行为异常 [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HLS 播放 | 自己解析 m3u8 playlist + ts segment | hls.js | HLS 协议复杂（多码率、加密、时间轴对齐），hls.js 已解决所有边界情况 |
| FLV/MPEG-TS 解码 | 自己解析 FLV header/tag + TS packet | mpegts.js | 容器格式解析 + MSE transmux 是已解决的问题 |
| DASH manifest 解析 | 自己解析 mpd XML + segment timeline | dashjs | DASH 规范复杂（Period/AdaptationSet/SegmentTemplate），dashjs 是参考实现 |
| 进度条时间格式化 | 自己写 HH:MM:SS 转换 | 标准工具函数 | 简单但容易出错（如负数时间、NaN），用 20 行内聚函数即可 |

## Common Pitfalls

### Pitfall 1: hls.js Worker CSP 问题
**What goes wrong:** hls.js 默认 `enableWorker: true`，在 Electron 的 CSP 下创建 blob: Worker 可能被阻止
**Why it happens:** player.html 的 CSP `<meta>` 标签未包含 `worker-src` 指令
**How to avoid:** 设置 `enableWorker: false`（简单方案，轻微性能损失）或在 CSP 中添加 `worker-src 'self' blob:` [ASSUMED]
**Warning signs:** 控制台报 `Refused to create a worker from 'blob:...'` 错误

### Pitfall 2: 窗口复用时旧库实例未销毁
**What goes wrong:** D-20 要求窗口复用，但切换视频时旧的 hls.js/mpegts.js/dash.js 实例未清理
**Why it happens:** 直接设置新 URL 而不先 destroy 旧实例
**How to avoid:** 在 player.js 中维护 `currentEngine` 变量，每次 initPlayer 前先调用 `currentEngine.destroy()`
**Warning signs:** 内存持续增长，网络请求未停止

### Pitfall 3: frameless 窗口拖拽区域冲突
**What goes wrong:** 自定义标题栏设置了 `-webkit-app-region: drag`，但按钮区域也继承了拖拽行为导致无法点击
**Why it happens:** CSS `-webkit-app-region: drag` 会被子元素继承
**How to avoid:** 在按钮元素上显式设置 `-webkit-app-region: no-drag` [ASSUMED]
**Warning signs:** 标题栏按钮点击无响应

### Pitfall 4: Electron setFullScreen 与 frameless 窗口
**What goes wrong:** frameless 窗口调用 `setFullScreen(true)` 后，自定义标题栏可能遮挡内容或消失
**Why it happens:** 全屏模式下 frameless 窗口的标题栏行为与有框架窗口不同
**How to avoid:** 全屏时隐藏自定义标题栏，退出全屏时恢复 [ASSUMED]
**Warning signs:** 全屏后顶部出现空白区域或标题栏重叠

### Pitfall 5: CSP media-src 限制
**What goes wrong:** 某些视频源使用非标准端口或协议，被 CSP 的 `media-src` 策略阻止
**Why it happens:** player.html 的 CSP 设置了 `media-src * blob: data:` 但某些 CDN URL 格式特殊
**How to avoid:** 当前 CSP 已设置 `media-src *`，覆盖所有来源。如遇问题可检查具体报错 [VERIFIED: 现有 player.html CSP]
**Warning signs:** 控制台报 `Refused to load media from '...'`

## Code Examples

### 创建播放器 BrowserWindow（主进程）

```javascript
// Source: ipc-handlers.js:1318-1338 (现有占位实现，需重写)
// 现有实现缺少: Session 隔离、frame:false、窗口复用、资源清理
// 重写参考 Pattern 2
```

### 播放器页面监听 IPC（渲染进程）

```javascript
// Source: src/player.html:77-85 (现有占位实现)
// 需要替换为完整的格式检测 + 库初始化逻辑
// 参考 Pattern 1
```

### Picture-in-Picture API

```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API
// Electron 43.x (Chromium 136+) 支持标准 PiP API
async function togglePiP(video) {
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  } else if (video.requestPictureInPicture) {
    await video.requestPictureInPicture();
  }
}
```

### 键盘快捷键处理

```javascript
// Source: D-12 决策
document.addEventListener('keydown', (e) => {
  // 忽略输入框内的按键
  if (e.target.tagName === 'INPUT') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      video.paused ? video.play() : video.pause();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 5);
      break;
    case 'ArrowRight':
      e.preventDefault();
      video.currentTime = Math.min(video.duration, video.currentTime + 5);
      break;
    case 'ArrowUp':
      e.preventDefault();
      video.volume = Math.min(1, video.volume + 0.05);
      break;
    case 'ArrowDown':
      e.preventDefault();
      video.volume = Math.max(0, video.volume - 0.05);
      break;
    case 'f':
    case 'F':
      // 使用 BrowserWindow API 全屏
      window.realmAPI.toggleFullscreen();
      break;
    case 'm':
    case 'M':
      video.muted = !video.muted;
      break;
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| player.html 占位页面（仅原生 video） | 完整播放器（hls.js + mpegts.js + dash.js） | Phase 28 | 支持 HLS/FLV/DASH 流媒体 |
| media:play 创建无 Session 窗口 | 复用来源容器 Session | Phase 28 | 视频请求携带正确 Cookie |
| 无控制栏 | 沉浸式暗色控制栏 | Phase 28 | 完整播放体验 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | hls.js enableWorker 在 Electron CSP 下需要禁用或配置 worker-src | Pitfall 1 | HLS 播放失败，需改 CSP 或降级方案 |
| A2 | video.requestFullscreen 在 frameless BrowserWindow 中行为异常 | Anti-Patterns | 全屏功能不可用，需改用 BrowserWindow API |
| A3 | -webkit-app-region: drag 会被子元素继承 | Pitfall 3 | 标题栏按钮无法点击 |
| A4 | frameless 窗口 setFullScreen 后标题栏行为需手动管理 | Pitfall 4 | 全屏后 UI 异常 |
| A5 | Electron 43.x (Chromium 136+) 支持标准 Picture-in-Picture API | D-14 | PiP 功能不可用，需降级为自定义浮动窗口 |

**如果此表为空：** 所有声明均已验证或引用，无需用户确认。

## Open Questions

1. **hls.js enableWorker 配置**
   - What we know: Electron 的 CSP 可能阻止 blob: Worker 创建
   - What's unclear: Electron 43.x 是否已放宽 CSP 对 blob: Worker 的限制
   - Recommendation: 先尝试 `enableWorker: true`，如果控制台报错则切换为 `false`。在 PLAN.md 中将此列为验证步骤

2. **播放器窗口的 IPC 通道扩展**
   - What we know: 现有 mediaAPI 已暴露 playMedia/getMediaList 等方法
   - What's unclear: 播放器窗口是否需要额外的 IPC 通道（如获取完整媒体列表用于播放列表功能）
   - Recommendation: 播放器通过已有的 mediaAPI.getMediaList 获取列表，无需新增 IPC 通道

3. **全屏 API 选择**
   - What we know: Electron 支持 BrowserWindow.setFullScreen() 和标准 Fullscreen API
   - What's unclear: frameless 窗口中哪种方式更可靠
   - Recommendation: 使用 BrowserWindow.setFullScreen()，通过 IPC 从播放器进程调用主进程

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 播放器窗口 | ✓ | 43.3.0 | -- |
| Node.js | 主进程 | ✓ | (系统版本) | -- |
| npm | 包管理 | ✓ | (系统版本) | -- |
| hls.js | HLS 播放 | 待安装 | ^1.6.17 | 无，HLS 格式将不可播放 |
| mpegts.js | FLV/MPEG-TS 播放 | 待安装 | ^1.8.1 | 无，FLV 格式将不可播放 |
| dashjs | DASH 播放 | 待安装 | ^5.2.0 | 无，DASH 格式将不可播放 |

**Missing dependencies with no fallback:**
- hls.js, mpegts.js, dashjs -- 必须安装，否则对应格式无法播放

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 无（项目当前无测试框架） |
| Config file | none |
| Quick run command | `npm run validate` (现有脚本验证) |
| Full suite command | `npm run validate` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAYER-01 | 播放器独立窗口 | manual-only | 手动验证窗口创建/关闭 | N/A |
| PLAYER-02 | HLS 播放 | manual-only | 手动播放 .m3u8 视频 | N/A |
| PLAYER-03 | MP4/WebM 播放 | manual-only | 手动播放 .mp4/.webm 视频 | N/A |
| PLAYER-04 | FLV/MPEG-TS 播放 | manual-only | 手动播放 .flv 视频 | N/A |
| PLAYER-05 | 播放/暂停 | manual-only | 手动点击控制按钮 | N/A |
| PLAYER-06 | 进度条拖拽 | manual-only | 手动拖拽进度条 | N/A |
| PLAYER-07 | 音量控制 | manual-only | 手动调节音量 | N/A |
| PLAYER-08 | 倍速选择 | manual-only | 手动切换倍速 | N/A |
| PLAYER-09 | 全屏模式 | manual-only | 手动按 F 键或点击全屏按钮 | N/A |
| PLAYER-10 | 资源释放 | manual-only | 关闭播放器后检查内存 | N/A |

**Note:** 项目无测试框架，所有验证均为手动 UAT。Phase 28 的播放器功能高度依赖视觉交互，自动化测试不切实际。

### Wave 0 Gaps

- 无 -- 项目无测试框架，Phase 28 不引入测试

## Sources

### Primary (HIGH confidence)
- npm registry: hls.js 1.6.17, mpegts.js 1.8.1, dashjs 5.2.0 -- 版本和下载量验证
- ipc-handlers.js:1318-1338 -- 现有 media:play 实现
- src/player.html -- 现有占位播放器页面
- media-sniffer.js:15-32 -- 视频类型分类映射
- 28-CONTEXT.md -- 用户决策（D-01~D-22）
- 28-UI-SPEC.md -- 播放器 UI 设计规范

### Secondary (MEDIUM confidence)
- MDN Web APIs: Picture-in-Picture API, Fullscreen API, HTMLVideoElement
- Electron docs: BrowserWindow options, Session partition

### Tertiary (LOW confidence)
- hls.js enableWorker + Electron CSP 兼容性 [ASSUMED]
- frameless 窗口全屏行为 [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- hls.js/mpegts.js/dashjs 均为成熟库，npm 版本已验证
- Architecture: HIGH -- 基于现有 BrowserWindow 创建模式和 IPC 架构
- Pitfalls: MEDIUM -- CSP/Worker 问题和 frameless 窗口行为部分基于假设，需实测验证

**Research date:** 2026-08-07
**Valid until:** 2026-09-07 (30 天，视频播放库版本稳定)

# Phase 28: 播放器窗口 - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

用户从媒体面板点击播放按钮时，打开独立 BrowserWindow 播放器窗口，支持 HLS (hls.js)、MP4/WebM (Chromium 原生)、FLV/MPEG-TS (mpegts.js)、DASH (dash.js) 多种视频格式播放。播放器提供沉浸式暗色 UI、完整播放控制（播放/暂停、进度条、音量、倍速、全屏）、画中画、播放列表、键盘快捷键等功能。播放器窗口复用来源容器的 Session，关闭时正确释放所有库实例和内存。

</domain>

<decisions>
## Implementation Decisions

### 播放器 UI 风格
- **D-01:** 沉浸式暗色风格 — 纯黑背景 (#000)，控件悬浮在视频底部，鼠标移动时淡入淡出
- **D-02:** 底部左右分组布局 — 进度条占满整行，播放/暂停 + 时间显示在左，音量 + 倍速 + 全屏在右
- **D-03:** 控件自动隐藏 — 鼠标静止 3 秒后控制栏自动隐藏，鼠标移动时重新出现，纯黑进度条细线保留
- **D-04:** 无边框窗口 — 隐藏标题栏和原生控件，需要自定义关闭/最小化/最大化按钮

### 格式检测与库选择
- **D-05:** 格式检测策略 — URL 后缀优先 (.m3u8/.mp4/.flv/.webm/.ts/.mpd)，后缀不明确时回退到 Content-Type 判断
- **D-06:** HLS (m3u8) — 使用 hls.js 播放
- **D-07:** FLV/MPEG-TS — 使用 mpegts.js 播放
- **D-08:** DASH (mpd) — 使用 dash.js 播放（新增需求，Roadmap 原未包含）
- **D-09:** MP4/WebM — 使用 Chromium 原生 `<video>` 播放，不加载额外库
- **D-10:** 库加载策略 — 按需加载，仅当视频格式匹配时才初始化对应的 hls.js/mpegts.js/dash.js 实例

### 控制栏功能细节
- **D-11:** 进度条 — 支持拖拽跳转，鼠标悬停显示时间戳预览（无缩略图）
- **D-12:** 键盘快捷键 — 空格暂停/播放，← → 快进/快退 5 秒，↑ ↓ 调节音量，F 全屏，M 静音
- **D-13:** 双击全屏 — 双击视频区域切换全屏/退出全屏
- **D-14:** 画中画 (PiP) — 支持 Electron 原生 Picture-in-Picture 模式
- **D-15:** 拖拽实时预览 — 拖动进度条时显示实时视频预览画面
- **D-16:** 播放列表 — 从媒体面板获取当前容器的完整媒体列表，支持上一个/下一个切换
- **D-17:** 倍速选择 — 支持 0.5x / 1x / 1.5x / 2x 播放倍速
- **D-18:** 时间显示 — 进度条左侧显示 "当前时间 / 总时长"（HH:MM:SS 格式）

### 窗口行为与生命周期
- **D-19:** 窗口尺寸 — 默认 16:9 比例（如 960x540），用户可自由拖拽调整大小
- **D-20:** 窗口复用 — 已有播放器窗口时，新视频在已有窗口中替换播放，不打开新窗口
- **D-21:** 资源释放 — 窗口关闭时立即销毁 hls.js/mpegts.js/dash.js 实例并回收内存
- **D-22:** Session 隔离 — 播放器窗口复用来源容器的 Session partition，携带同一容器的 Cookie

### Claude's Discretion
无 — 所有决策均由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` §PLAYER — 播放器需求 PLAYER-01~10
- `.planning/ROADMAP.md` §Phase 28 — 阶段目标和成功标准

### 前置阶段上下文
- `.planning/phases/26-ipc/26-CONTEXT.md` — 媒体数据模型 (D-05~D-08)、IPC 通道 (media:get-list, media:play, media:copy-url, media:clear-list)
- `.planning/phases/27-media-panel/27-CONTEXT.md` — 媒体面板 UI 模式、播放按钮行为 (D-12 从新标签改为播放器窗口)

### 现有代码参考
- `src/renderer.js` — 媒体面板逻辑 (toggleMediaPanel, loadMediaList, playMedia, copyMediaUrl)、AI 面板窗口模式参考
- `src/preload.js` — mediaAPI 已暴露 (getMediaList, play, copyUrl, clearList, onMediaListUpdate)
- `main.js` — BrowserWindow 创建模式、Session partition 管理、ipcMain.handle 注册
- `src/styles/main.css` — CSS 变量系统 (--bg-primary, --text-secondary 等)

### 库文档（实现时需参考）
- `hls.js` — https://github.com/video-dev/hls.js
- `mpegts.js` — https://github.com/xqq/mpegts.js
- `dash.js` — https://github.com/Dash-Industry-Forum/dash.js

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `window.mediaAPI` — Phase 26 已暴露的媒体 IPC 接口，播放器通过 IPC 获取媒体列表
- BrowserWindow 创建模式 — main.js 中已有的窗口创建和管理代码，播放器窗口复用同一模式
- `windowContainerMap` — 窗口-容器映射关系，播放器窗口需要加入映射
- CSS 变量系统 — 播放器样式应使用现有变量保持视觉一致（虽然播放器以纯黑为主）
- `ses.webRequest` — 可用于播放器窗口的请求拦截和 Content-Type 检测

### Established Patterns
- IPC 通道命名：`动词:名词` 格式（如 `media:play`）
- 窗口创建：`new BrowserWindow(options)` + `loadFile/loadURL`
- Session 隔离：`persist:container-{id}` partition
- 资源清理：BrowserWindow `close` 事件中执行清理逻辑
- 日志前缀：`[Realm]` 用于主进程，`[Realm Renderer]` 用于渲染进程

### Integration Points
- `main.js` — 注册 media:play IPC handler，创建播放器 BrowserWindow
- `src/renderer.js` — 修改 playMedia() 函数，从 window.open() 改为调用 media:play IPC
- `src/preload.js` — 可能需要暴露新的播放器相关 API（如 media:player:next, media:player:prev）
- 新文件 `player.html` — 播放器页面结构
- 新文件 `player.js` — 播放器页面逻辑（视频播放、控制栏、键盘快捷键）
- 新文件 `player.css` — 播放器样式
- npm 依赖 — 需安装 hls.js, mpegts.js, dash.js

</code_context>

<specifics>
## Specific Ideas

- 播放器 UI 参考 YouTube/Bilibili 网页播放器的沉浸式暗色风格
- 键盘快捷键遵循 YouTube 标准（空格暂停、方向键快进快退等）
- 播放列表功能从媒体面板获取数据，支持上/下一首切换
- 新增 DASH (mpd) 格式支持（原 Roadmap 未包含，用户选择加入）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-播放器窗口*
*Context gathered: 2026-08-07*

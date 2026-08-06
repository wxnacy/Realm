# Milestone v2.2 Requirements

## 多媒体功能集成

**里程碑目标:** 为 Realm Browser 添加视频源检测、媒体面板和独立播放器功能

---

## v1 Requirements

### 视频源检测 (SNIFF)

- [ ] **SNIFF-01**: 媒体嗅探器通过 session.webRequest 拦截容器网络请求，自动检测 m3u8/mp4/flv/webm 格式的视频资源 URL
- [ ] **SNIFF-02**: 媒体嗅探器通过 webContents.executeJavaScript 注入页面脚本，检测 `<video>` 和 `<source>` 元素的 src/currentSrc 属性
- [ ] **SNIFF-03**: 媒体嗅探器使用 MutationObserver 监听 DOM 变化，检测动态加载的视频元素
- [ ] **SNIFF-04**: 媒体嗅探器对检测到的 URL 进行去重和分类管理（按容器隔离，内存存储）
- [ ] **SNIFF-05**: 页面导航时自动清空当前容器的媒体列表

### 媒体面板 (PANEL)

- [ ] **PANEL-01**: 用户可以通过工具栏按钮打开/关闭媒体面板（浮动层，z-index 覆盖页面）
- [ ] **PANEL-02**: 媒体面板显示当前容器检测到的所有媒体资源列表（名称、类型徽标、URL 预览）
- [ ] **PANEL-03**: 用户可以点击媒体项的播放按钮，打开独立播放器窗口播放该视频
- [ ] **PANEL-04**: 用户可以点击媒体项的复制按钮，将视频 URL 复制到剪贴板
- [ ] **PANEL-05**: 新检测到媒体时，工具栏媒体按钮显示数量提示徽标

### 播放器窗口 (PLAYER)

- [ ] **PLAYER-01**: 播放器使用独立 BrowserWindow 打开，支持窗口大小调整和全屏
- [ ] **PLAYER-02**: 播放器支持 HLS 格式（m3u8）通过 hls.js 播放
- [ ] **PLAYER-03**: 播放器支持 MP4/WebM 格式通过 Chromium 原生播放
- [ ] **PLAYER-04**: 播放器支持 FLV/MPEG-TS 格式通过 mpegts.js 播放
- [ ] **PLAYER-05**: 播放器提供播放/暂停控制
- [ ] **PLAYER-06**: 播放器提供进度条拖拽和时间显示
- [ ] **PLAYER-07**: 播放器提供音量控制
- [ ] **PLAYER-08**: 播放器提供播放倍速选择（0.5x/1x/1.5x/2x）
- [ ] **PLAYER-09**: 播放器支持全屏模式
- [ ] **PLAYER-10**: 播放器窗口关闭时正确销毁 hls.js/mpegts.js 实例，释放内存

### IPC 通道 (IPC)

- [ ] **IPC-01**: 注册 media:get-list IPC 通道，返回当前容器的媒体列表
- [ ] **IPC-02**: 注册 media:play IPC 通道，创建播放器窗口播放指定 URL
- [ ] **IPC-03**: 注册 media:copy-url IPC 通道，将 URL 写入系统剪贴板
- [ ] **IPC-04**: 注册 media:clear-list IPC 通道，清空当前容器媒体列表
- [ ] **IPC-05**: preload.js 暴露 mediaAPI 对象（getMediaList/play/copyUrl/clearList/onMediaListUpdate）

---

## Future Requirements

### 下载与缓存（推迟到 v2.3）

- [ ] **DL-01**: 下载管理器（任务队列 + 暂停/恢复/取消）
- [ ] **DL-02**: m3u8 分片下载 + 合并为 MP4
- [ ] **DL-03**: 边播边缓存（session.protocol.interceptStreamProtocol）
- [ ] **DL-04**: Range Request 支持
- [ ] **DL-05**: 缓存命中时直接读本地

### 增强功能（未来）

- [ ] **ENH-01**: 视频截图功能
- [ ] **ENH-02**: 画中画模式
- [ ] **ENH-03**: 播放列表支持
- [ ] **ENH-04**: 字幕支持
- [ ] **ENH-05**: DASH 格式支持
- [ ] **ENH-06**: RTMP 流支持

---

## Out of Scope

- **DRM 保护视频** — 不支持 Widevine/FairPlay 等 DRM 加密内容
- **视频下载功能** — 推迟到 v2.3（需要独立的下载管理器架构）
- **边播边缓存** — 推迟到 v2.3（需要 stream protocol 拦截，复杂度高）
- **浏览器扩展兼容** — 不支持 Chrome 扩展的媒体检测
- **直播流（RTMP/WebSocket）** — 本期不支持实时直播流

---

## Traceability

| Requirement | Phase | Plan |
|-------------|-------|------|
| SNIFF-01 ~ SNIFF-05 | TBD | — |
| PANEL-01 ~ PANEL-05 | TBD | — |
| PLAYER-01 ~ PLAYER-10 | TBD | — |
| IPC-01 ~ IPC-05 | TBD | — |

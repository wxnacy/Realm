# Feature Landscape — v2.2 多媒体功能集成

**Domain:** Electron 多容器浏览器 - 多媒体播放
**Researched:** 2026-08-06
**Overall confidence:** HIGH

## Executive Summary

v2.2 的核心目标是为 Realm Browser 添加视频源检测、媒体面板和独立播放器窗口功能。研究结论表明，视频源检测主要依赖两种互补技术路径：**网络层嗅探**（session.webRequest 拦截）和**页面层检测**（executeJavaScript 注入）。播放器层面，hls.js 和 mpegts.js 覆盖了主流流媒体格式，两者都通过 MSE API 在 Chromium 中工作。

**典型用户工作流：** 浏览网页 → 媒体嗅探自动检测 → 媒体面板显示列表 → 用户选择播放/复制链接 → 独立播放器窗口打开。

## Table Stakes

功能用户期望的基础能力。缺失 = 产品不完整。

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 媒体 URL 检测（网络层） | 用户期望浏览器自动识别页面中的视频资源 | Low | session.webRequest 原生 API，拦截 m3u8/mp4/flv/webm |
| 页面内视频元素检测 | 补充网络层嗅探，发现内嵌 video/source | Medium | executeJavaScript 注入 + MutationObserver 监听动态加载 |
| 媒体列表面板 | 用户需要看到检测到的媒体资源并选择 | Medium | 浮动层 UI，显示 URL、格式、大小等信息 |
| m3u8/HLS 播放 | 最常见的流媒体格式（国内外主流平台） | Medium | hls.js 集成，通过 MSE 在 Chromium 中工作 |
| mp4/webm 直播放 | 最基本的视频格式 | Low | Chromium 原生支持，video.src 直接设置 |
| 独立播放器窗口 | 不干扰浏览页面的播放体验 | Medium | BrowserWindow + 独立 HTML/JS |
| 播放/暂停控制 | 基本播放交互 | Low | HTML5 video API |
| 进度条拖拽 | 用户需要跳转到指定位置 | Low | video.currentTime + range input |
| 音量控制 | 用户需要调节音量 | Low | video.volume + range input |
| 一键复制媒体链接 | 快速分享或在外部播放器打开 | Low | clipboard.writeText API |

## Differentiators

差异化功能。不是预期中的，但有额外价值。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| FLV/MPEG-TS 播放 | 支持国内直播平台常见格式（B站、斗鱼等） | Medium | mpegts.js 集成，flv.js 的活跃继任者 |
| 播放倍速控制 | 学习/效率场景，用户可调节播放速度 | Low | video.playbackRate，支持 0.5x-3x |
| 画中画模式 (PiP) | 悬浮小窗播放，不影响其他操作 | Low | Chromium 原生 PiP API，video.requestPictureInPicture() |
| 全屏播放 | 沉浸式观看体验 | Low | video.requestFullscreen() |
| 媒体嗅探通知 | 检测到新媒体时工具栏图标变化/徽标 | Low | 动态更新按钮状态，提示用户有新媒体 |
| 媒体格式/质量标识 | 用户可快速识别媒体类型和质量 | Low | Badge 显示 HLS/MP4/FLV 等格式标签 |
| URL 预览截断 | 长 URL 在面板中截断显示，hover 展开 | Low | CSS text-overflow + title 属性 |
| 媒体嗅探历史 | 回顾之前检测到的媒体（跨页面） | Medium | SQLite 存储，按容器隔离 |
| 快捷键播放/暂停 | 键盘控制播放（空格键等） | Low | keydown 事件监听 |

## Anti-Features

明确不构建的功能。

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 内置下载管理器 | Phase 28 范围，Phase 26/27 不做 | 先做播放，下载功能推迟到 Phase 28 |
| 视频转码 | 复杂度高，需要 ffmpeg 原生二进制，打包复杂 | 让 Chromium 原生解码处理 |
| DRM 支持 | Electron 32.x 支持 Widevine，但配置复杂 | 超出本期范围，标记为已知限制 |
| 视频编辑/剪辑 | 与浏览器核心功能无关，功能膨胀 | 不做 |
| 弹幕系统 | 仅直播平台需求，不是通用浏览器功能 | 不做 |
| 视频格式转换 | 需要 ffmpeg，打包复杂度高 | 不做 |
| 视频截图功能 | 功能膨胀，用户可用系统截图替代 | 不做 |
| 字幕支持 | 复杂度高（外挂字幕、字幕轨选择），非核心需求 | 不做 |
| 播放列表支持 | 功能膨胀，单视频播放足够 | 不做 |
| 视频投屏/Chromecast | 需要额外协议支持，复杂度高 | 不做 |

## Video Detection Techniques (参考实现分析)

### 浏览器扩展的典型嗅探技术

浏览器扩展（如 Video DownloadHelper、StreamMedia）使用以下技术检测视频：

| 技术 | 实现方式 | Realm 复用方案 |
|------|----------|----------------|
| **webRequest API 拦截** | 监控网络请求，筛选视频 MIME 类型 | session.webRequest.onBeforeRequest（原生 API） |
| **DOM MutationObserver** | 监听 DOM 变化，检测动态插入的 video/source | executeJavaScript 注入 MutationObserver |
| **HLS/DASH Manifest 解析** | 检测 .m3u8/.mpd 文件并解析分片 URL | session.webRequest 拦截 manifest URL |
| **Content-Type 分析** | 检查响应头中的视频 MIME 类型 | session.webRequest.onHeadersReceived |
| **URL 模式匹配** | 维护已知视频站点的 URL 模式库 | 可选：本地模式库 + 正则匹配 |
| **XHR/Fetch Hook** | 注入脚本 hook XMLHttpRequest/fetch | executeJavaScript 注入 hook 代码 |

### yt-dlp 的检测策略

yt-dlp 使用**站点特定提取器**（1000+ 站点）+ **通用提取器**（fallback）：
- 通用提取器：解析页面中的 JSON-LD、OpenGraph 标签、video 标签
- 站点提取器：针对 YouTube、Bilibili 等平台的专用解析逻辑
- m3u8 解析：自动解析 HLS manifest 获取所有分片

**Realm 不需要实现站点提取器**，因为：
1. session.webRequest 可以拦截所有网络请求，无需解析页面结构
2. executeJavaScript 可以直接读取 DOM 中的 video 元素
3. 用户手动选择播放，无需自动判断"最佳"质量

### 视频格式支持范围

| 格式 | MIME 类型 | 检测方式 | 播放方案 | 优先级 |
|------|-----------|----------|----------|--------|
| m3u8 (HLS) | application/vnd.apple.mpegurl | webRequest 拦截 .m3u8 URL | hls.js | P0 |
| mp4 | video/mp4 | webRequest 拦截 .mp4 URL | 原生播放 | P0 |
| webm | video/webm | webRequest 拦截 .webm URL | 原生播放 | P0 |
| flv | video/x-flv | webRequest 拦截 .flv URL | mpegts.js | P1 |
| mpeg-ts | video/mp2t | webRequest 拦截 .ts URL | mpegts.js | P1 |
| mpd (DASH) | application/dash+xml | webRequest 拦截 .mpd URL | 本期不做 | P2 |

## User Workflow

典型用户使用视频检测功能的工作流：

```
1. 浏览网页（正常浏览行为）
   ↓
2. 页面加载视频资源（自动触发嗅探）
   ↓
3. 工具栏媒体图标显示检测状态（如：数字徽标 "3"）
   ↓
4. 用户点击媒体图标，打开媒体面板
   ↓
5. 面板显示检测到的媒体列表（URL、格式、时间戳）
   ↓
6. 用户选择：
   ├── 点击"播放" → 打开独立播放器窗口
   ├── 点击"复制链接" → 复制到剪贴板
   └── 关闭面板 → 继续浏览
   ↓
7. 播放器窗口中：
   ├── 播放/暂停/进度/音量控制
   ├── 倍速调节（可选）
   └── 全屏/画中画（可选）
```

## Feature Dependencies

```
MEDIA-01 (网络嗅探) ──→ MEDIA-03 (媒体面板) ──→ MEDIA-05 (播放器窗口)
MEDIA-02 (DOM 检测) ──→ MEDIA-03 (媒体面板)       ↓
                                              MEDIA-06 (hls.js)
                                              MEDIA-07 (播放控制)
```

## MVP Recommendation

优先：
1. MEDIA-01: session.webRequest 嗅探 m3u8/mp4（Phase 26 核心）
2. MEDIA-02: executeJavaScript 视频检测（Phase 26 补充）
3. MEDIA-03: 媒体面板 UI（Phase 26 交互）
4. MEDIA-05: 独立播放器窗口（Phase 27 核心）
5. MEDIA-06: hls.js 集成（Phase 27 HLS 支持）
6. MEDIA-07: 基础播放控制（播放/暂停/进度/音量）

可推迟：
- MEDIA-08/09/10: 下载功能（Phase 28 可选）
- FLV/MPEG-TS 支持（v2.2 后期或 v2.3）
- 画中画模式（v2.3 增强）
- 媒体嗅探历史（v2.3 增强）
- 倍速控制（v2.3 增强）

## Known Limitations

| 限制 | 原因 | 影响 |
|------|------|------|
| DRM 保护视频不支持 | Electron Widevine 配置复杂 | Netflix、Disney+ 等受保护内容无法播放 |
| 部分网站 CSP 阻止脚本注入 | Content Security Policy 限制 | 某些网站的 executeJavaScript 可能失败 |
| WebSocket 直播流嗅探 | session.webRequest 不拦截 WS 升级 | 部分直播平台的 WSS 流可能漏检 |
| 视频质量/分片信息缺失 | 仅嗅探 URL，不解析 manifest | 面板不显示分辨率/码率信息 |

## Sources

- [hls.js GitHub](https://github.com/video-dev/hls.js) — HLS 播放库，v1.6.x 活跃维护
- [mpegts.js GitHub](https://github.com/xqq/mpegts.js) — FLV/MPEG-TS 播放库，flv.js 继任者
- [flv.js GitHub](https://github.com/bilibili/flv.js) — 已停止维护，被 mpegts.js 替代
- [Electron webRequest API](https://www.electronjs.org/docs/latest/api/web-request) — 网络请求拦截
- [Video DownloadHelper](https://www.downloadhelper.net/) — 浏览器扩展嗅探技术参考
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — 视频提取工具，站点提取器架构参考

---
*Feature research for: 多媒体功能集成 (v2.2)*
*Researched: 2026-08-06*
*Confidence: HIGH — 功能边界清晰，技术方案成熟，与现有架构无冲突*

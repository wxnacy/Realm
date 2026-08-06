# Research Summary: 多媒体功能集成 (v2.2)

**Domain:** Electron 多容器浏览器 - 多媒体播放
**Researched:** 2026-08-06
**Overall confidence:** HIGH

## Executive Summary

v2.2 里程碑的核心目标是为 Realm Browser 添加视频源检测、媒体面板和独立播放器窗口功能。研究结论表明，这三项功能主要依赖 Electron 32.x 的原生 API（session.webRequest、executeJavaScript、BrowserWindow），仅需引入 2 个新 npm 包：hls.js（HLS/m3u8 播放）和 mpegts.js（FLV/MPEG-TS 播放）。

**最关键的发现是：** 绝大部分工作可以用现有技术栈完成。session.webRequest 是主进程级别的网络请求拦截 API，可以零成本嗅探所有经过容器 session 的媒体请求。webContents.executeJavaScript 可以注入脚本检测页面中的 video/source 元素。BrowserWindow 可以创建独立的播放器窗口。这些都是 Electron 的内置能力，不需要额外依赖。

在播放器层面，hls.js 是 HLS 流媒体的事实标准库，v1.6.x 活跃维护，通过 MSE (Media Source Extensions) 在 Chromium 中工作。mpegts.js 是已停止维护的 flv.js 的活跃继任者，支持 FLV 和 MPEG-TS 格式。两者都利用 Chromium 原生的 MSE API 进行解码，无需 ffmpeg 等原生二进制。

**不应引入的依赖：** video.js（太重）、flv.js（停维护）、ffmpeg（打包复杂）、plyr/clappr（UI 封装层无必要）。这些都会增加包体积和维护负担，而实际需求只需要底层的解码能力和自研 UI。

## Key Findings

**Stack:** hls.js ^1.6.17 + mpegts.js ^1.8.1，复用 Electron 原生 API（webRequest / executeJavaScript / BrowserWindow）
**Architecture:** 主进程嗅探 → IPC 推送 → 渲染进程媒体面板 → 独立 BrowserWindow 播放器
**Critical pitfall:** webRequest 必须在容器 session 上注册（非 defaultSession），CSP 必须允许 blob: media-src

## Implications for Roadmap

基于研究，建议的阶段结构：

1. **Phase 26: 视频源检测 + 媒体面板** — 基础设施阶段
   - Addresses: MEDIA-01 (webRequest 嗅探), MEDIA-02 (executeJavaScript 检测), MEDIA-03 (媒体面板 UI), MEDIA-04 (IPC 通道)
   - Avoids: 先做播放器再做检测的依赖倒置

2. **Phase 27: 播放器窗口** — 独立功能阶段
   - Addresses: MEDIA-05 (BrowserWindow), MEDIA-06 (hls.js 集成), MEDIA-07 (播放控制 UI)
   - Avoids: 在主窗口内嵌播放器导致的布局冲突

3. **Phase 28: 下载与边播边缓存** — 可选增强阶段
   - Addresses: MEDIA-08/09/10 (下载管理、分片合并、stream protocol)
   - 可推迟到 v2.3

**阶段排序理由：**
- Phase 26 先行：检测是播放的前提，没有检测到的媒体 URL，播放器无用武之地
- Phase 27 紧跟：检测到媒体后立即需要播放能力，用户体验连贯
- Phase 28 可选：下载是增值功能，不影响核心播放体验

**Research flags for phases:**
- Phase 26: 需要验证 session.webRequest 对不同容器 partition 的拦截行为
- Phase 26: 需要验证 executeJavaScript 在 webview 中的 CSP 限制
- Phase 27: 需要测试 hls.js enableWorker 在 Electron CSP 下是否正常工作
- Phase 28: 需要研究 Electron stream protocol 拦截能力

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | hls.js/mpegts.js 版本已验证；Electron API 是官方文档确认的 |
| Features | HIGH | 功能边界清晰，与现有架构无冲突 |
| Architecture | HIGH | 复用现有 IPC + BrowserWindow 模式，无新架构引入 |
| Pitfalls | MEDIUM | CSP/webRequest 行为需实际测试验证 |

## Gaps to Address

- hls.js enableWorker 在 Electron 32.x CSP 下的实际行为（需运行时测试）
- session.webRequest 对 WebSocket 升级请求的拦截能力（影响部分直播流）
- mpegts.js 低延迟直播模式（WSS）在 Electron 中的兼容性
- 播放器窗口的视频编解码器支持范围（需在 Electron 32.x 中实测）

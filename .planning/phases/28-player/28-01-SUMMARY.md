---
phase: 28-player
plan: 01
subsystem: player
tags: [electron, ipc, video, hls, mpegts, dash, browser-window]
dependency_graph:
  requires: [26-ipc, 27-media-panel]
  provides: [player-window-ipc, media-play-handler, player-api-namespace]
  affects: [ipc-handlers.js, src/preload.js, src/renderer.js, media-sniffer.js]
tech_stack:
  added: [hls.js@1.6.17, mpegts.js@1.8.1, dashjs@5.2.0]
  patterns: [session-isolation, frameless-window, window-reuse]
key_files:
  created: []
  modified:
    - package.json
    - ipc-handlers.js
    - src/preload.js
    - src/renderer.js
    - media-sniffer.js
decisions:
  - "playerWindow/playerContainerId 模块级变量管理播放器窗口生命周期"
  - "media:play handler 接受 (url, containerId) 双参数，渲染进程显式传递容器 ID"
  - "assertTrustedSender 用于所有 player:* handler 安全校验"
  - "MediaSniffer.getMediaListByContainer 遍历 mediaMap 按容器聚合"
metrics:
  duration: "116s"
  completed: "2026-08-08"
  tasks_completed: 3
  files_changed: 5
status: complete
---

# Phase 28 Plan 01: 播放器窗口基础设施 Summary

安装视频播放库依赖（hls.js/mpegts.js/dashjs），重写 media:play IPC handler 支持 Session 隔离的无边框播放器窗口，并将 renderer.js 的播放入口从 createTab 改为 IPC 调用。

## Tasks Completed

| # | Name | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | 安装视频播放库依赖 | 58f3580 | package.json 添加 hls.js, mpegts.js, dashjs |
| 2 | 重写 media:play IPC handler + 播放器 IPC 通道 | 617aa0a | ipc-handlers.js 重写 media:play, 新增 player:* handlers; preload.js 新增 playerAPI; media-sniffer.js 新增 getMediaListByContainer |
| 3 | 改造 renderer.js playMedia 函数走 IPC | 4f9581a | renderer.js playMedia 改为 async IPC 调用 |

## Verification Results

| Check | Result |
|-------|--------|
| npm ls hls.js mpegts.js dashjs | PASS - 3 packages installed |
| session.fromPartition in ipc-handlers.js | PASS |
| playerWindow references (>=3) | PASS - 10 references |
| playerAPI in preload.js | PASS |
| mediaAPI.playMedia in renderer.js | PASS |
| All player:* IPC handlers present | PASS |
| getMediaListByContainer in media-sniffer.js | PASS |

## Decisions Made

1. **容器 ID 由渲染进程显式传递** -- media:play handler 接受 (url, containerId) 双参数，而非从 event.sender 反推。原因：播放器请求来自主窗口渲染进程，需要明确指定当前容器。
2. **playerWindow/playerContainerId 模块级变量** -- 使用 registerHandlers 闭包内的 let 变量管理播放器窗口状态，窗口关闭时清理为 null。
3. **getMediaListByContainer 遍历聚合** -- MediaSniffer 按 webContentsId 存储，新增方法遍历 mediaMap 通过 _getContainerIdForWebContents 过滤指定容器的媒体项。

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all implementations are functional.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-28-01 mitigated | ipc-handlers.js | media:play handler 使用 assertTrustedSender + 参数类型校验 |
| T-28-03 mitigated | ipc-handlers.js | Session partition 按 containerId 构造，不泄露跨容器数据 |

## Self-Check: PASSED

- [x] package.json 包含 hls.js, mpegts.js, dashjs 依赖
- [x] ipc-handlers.js 包含 session.fromPartition, playerWindow, media:play-url, player:* handlers
- [x] src/preload.js 包含 playerAPI 命名空间, playMedia(url, containerId) 签名
- [x] src/renderer.js playMedia 函数调用 mediaAPI.playMedia
- [x] media-sniffer.js 包含 getMediaListByContainer 方法

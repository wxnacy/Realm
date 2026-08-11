---
phase: 28-player
plan: 02
subsystem: player
tags: [electron, player, video, hls, mpegts, dash, controls, keyboard]
dependency_graph:
  requires: [28-01]
  provides: [player-html, player-js, player-css, format-detection, playback-controls]
  affects: [src/player.html, src/player.js, src/player.css]
tech_stack:
  added: []
  patterns: [format-detection, auto-hide-controls, double-click-fullscreen, beforeunload-cleanup]
key_files:
  created:
    - src/player.js
    - src/player.css
  modified:
    - src/player.html
decisions:
  - "detectFormat 按 URL 后缀判断格式，不回退 Content-Type"
  - "currentEngine 模块级变量管理引擎实例，initPlayer 前先 destroy 旧实例"
  - "双击全屏使用 300ms setTimeout 区分单击播放/暂停和双击全屏"
  - "控制栏隐藏 3 秒定时器，暂停/拖拽/菜单打开时不隐藏"
metrics:
  duration: "151s"
  completed: "2026-08-08"
  tasks_completed: 2
  files_changed: 3
status: complete
---

# Phase 28 Plan 02: 播放器窗口 UI 实现 Summary

将占位播放器升级为功能完整的独立播放器窗口：格式检测与按需库加载（hls.js/mpegts.js/dash.js/原生）、沉浸式暗色控制栏、键盘快捷键、画中画、播放列表切换、资源释放。

## Tasks Completed

| # | Name | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | 实现播放器 HTML 结构和 CSS 样式 | 9a56f99 | src/player.html 完全替换（含自定义标题栏、进度条、控制栏、倍速菜单）；src/player.css 新建（沉浸式暗色样式） |
| 2 | 实现播放器核心 JavaScript 逻辑 | d3d7c42 | src/player.js 新建（格式检测、库初始化、控制栏、键盘快捷键、播放列表、画中画、资源释放） |

## Verification Results

| Check | Result |
|-------|--------|
| player.html 不引用 styles/main.css | PASS |
| player.html CSP 包含 unsafe-eval 和 worker-src | PASS |
| player.html 包含所有必需 ID 元素 | PASS |
| player.html 引用 player.js 和 player.css | PASS |
| player.html 包含 macOS 红绿灯按钮 | PASS |
| player.css 包含 --player-accent: #3B82F6 | PASS |
| player.css 包含 -webkit-app-region: drag/no-drag | PASS |
| player.js 包含 detectFormat 函数 | PASS |
| player.js 包含 initPlayer 函数（按格式分支） | PASS |
| player.js 使用 playerAPI.onPlayUrl 接收数据 | PASS |
| player.js 包含所有键盘快捷键 | PASS |
| player.js 包含控制栏自动隐藏逻辑 | PASS |
| player.js 包含 beforeunload 资源释放 | PASS |
| player.js 包含播放列表切换逻辑 | PASS |
| player.js 包含画中画支持 | PASS |
| player.js 包含双击全屏（300ms 延迟） | PASS |
| player.js 自定义标题栏通过 playerAPI 调用 | PASS |

## Decisions Made

1. **detectFormat 按 URL 后缀判断格式** -- 纯前端逻辑，使用 new URL().pathname.toLowerCase() 后缀匹配，不回退 Content-Type。原因：大多数视频 URL 后缀明确，Content-Type 回退增加复杂度且不可靠。
2. **currentEngine 模块级变量管理引擎实例** -- initPlayer 前先调用 currentEngine.destroy() 确保旧实例释放。原因：Pitfall 2 防护，避免窗口复用时内存泄漏。
3. **双击全屏使用 300ms 延迟区分** -- 单击设置 300ms 定时器执行播放/暂停，双击时 clearTimeout 取消单击并执行全屏。原因：D-13 决策要求双击全屏与单击播放/暂停共存。
4. **控制栏隐藏条件** -- 仅在视频播放中且非拖拽/菜单状态才隐藏。暂停时始终显示控制栏，拖拽进度条时不隐藏。

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all implementations are functional.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-28-04 accepted | src/player.js | 格式检测基于 URL 后缀判断，纯前端逻辑不影响安全边界 |
| T-28-06 accepted | src/player.html | CSP unsafe-eval 为 dash.js 运行时需要，播放器窗口不加载外部页面 |

## Self-Check: PASSED

- [x] src/player.html 不引用 styles/main.css
- [x] src/player.html CSP 包含 `unsafe-eval` 和 `worker-src 'self' blob:`
- [x] src/player.html 包含 id="player-container", id="title-bar", id="player", id="play-overlay", id="controls-container", id="progress-container", id="controls", id="speed-menu"
- [x] src/player.html 引用 `<script src="player.js">`
- [x] src/player.html 包含 macOS 红绿灯按钮（关闭/最小化/最大化）
- [x] src/player.html 所有控制按钮使用内联 SVG 图标
- [x] src/player.css 存在且包含 `--player-accent: #3B82F6`
- [x] src/player.css 包含 `-webkit-app-region: drag` 和 `-webkit-app-region: no-drag`
- [x] src/player.css 进度条轨道默认高度 3px，悬停展开至 5px
- [x] src/player.css 控制栏包含 opacity 过渡动画（0.3s ease 隐藏, 0.15s ease 显示）
- [x] src/player.css 倍速菜单样式包含背景 rgba(0,0,0,0.85) 和圆角
- [x] src/player.js 存在且包含 detectFormat(url) 函数
- [x] src/player.js 包含 initPlayer(url) 异步函数，按格式分支初始化
- [x] src/player.js 使用 playerAPI.onPlayUrl 接收媒体数据
- [x] src/player.js 包含播放/暂停按钮事件处理
- [x] src/player.js 包含进度条 click 和 drag 处理
- [x] src/player.js 包含音量滑块和音量按钮
- [x] src/player.js 倍速按钮支持 0.5x/1x/1.5x/2x
- [x] src/player.js F 键调用 toggleFullscreen
- [x] src/player.js 双击视频区域使用 300ms 延迟
- [x] src/player.js 包含控制栏自动隐藏逻辑（mousemove 3 秒后隐藏）
- [x] src/player.js 包含 beforeunload 事件处理
- [x] src/player.js 包含 Picture-in-Picture 支持
- [x] src/player.js 自定义标题栏通过 playerAPI 调用

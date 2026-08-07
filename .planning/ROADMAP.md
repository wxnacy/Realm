# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，支持独立的 Cookie 管理、浏览历史记录、收藏夹、常用网站推荐和应用设置。每个容器完全隔离（Cookie、缓存、存储），已集成 AI Agent SDK。

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- ✅ **v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面** — Phases 5-9 (shipped 2026-07-26)
- ✅ **v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式** — Phases 10-12 (shipped 2026-07-27)
- ✅ **v1.3 右键菜单增强** — Phase 13 (shipped 2026-07-27)
- ✅ **v2.0 收藏夹文件夹支持 + AI Agent 集成** — Phases 14-21 (shipped 2026-08-01)
- ✅ **v2.1 AI CDP 增强 + Tabbrowser 功能集成** — Phases 22-25 (shipped 2026-08-04)
- 🚧 **v2.2 多媒体功能集成** — Phases 26-28 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-25</summary>

- [x] Phase 1: Core Container Management + Architecture Refactoring — completed 2026-07-23
- [x] Phase 2: Browser Core - URL Navigation + Multi-Tab — completed 2026-07-23
- [x] Phase 3: Data Isolation + Cookie Persistence — completed 2026-07-23
- [x] Phase 4: Convenience Features — completed 2026-07-24

</details>

<details>
<summary>✅ v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面 (Phases 5-9) — SHIPPED 2026-07-26</summary>

- [x] Phase 5: 容器属性扩展 — completed 2026-07-25
- [x] Phase 6: 浏览历史记录 — completed 2026-07-25
- [x] Phase 7: 收藏夹管理 — completed 2026-07-25
- [x] Phase 8: 常用网站推荐 + 设置页面 — completed 2026-07-25
- [x] Phase 9: 共享收藏数据库 — completed 2026-07-26

</details>

<details>
<summary>✅ v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式 (Phases 10-12) — SHIPPED 2026-07-27</summary>

- [x] Phase 10: Cookie 管理增强 — completed 2026-07-26
- [x] Phase 11: 设置页面重构 — completed 2026-07-27
- [x] Phase 12: 开发者模式 — completed 2026-07-27

</details>

<details>
<summary>✅ v1.3 右键菜单增强 (Phase 13) — SHIPPED 2026-07-27</summary>

- [x] Phase 13: 右键菜单增强 — completed 2026-07-27

</details>

<details>
<summary>✅ v2.0 收藏夹文件夹支持 + AI Agent 集成 (Phases 14-21) — SHIPPED 2026-08-01</summary>

- [x] Phase 14: 收藏夹文件夹 - 数据库层实现 — completed 2026-07-28
- [x] Phase 15: 收藏夹文件夹 - UI 交互 — completed 2026-07-28
- [x] Phase 16: 收藏夹文件夹 - 增强功能 — completed 2026-07-29
- [x] Phase 17: Chrome 书签导入 — completed 2026-07-30
- [x] Phase 18: 收藏栏功能 — completed 2026-07-30
- [x] Phase 19: AI Agent 集成 - 基础验证 — completed 2026-07-31
- [x] Phase 20: AI Agent 集成 - 核心功能 — completed 2026-08-01
- [x] Phase 21: AI Agent 集成 - 聊天 UI — completed 2026-08-01

</details>

<details>
<summary>✅ v2.1 AI CDP 增强 + Tabbrowser 功能集成 (Phases 22-25) — SHIPPED 2026-08-04</summary>

- [x] Phase 22: CDP 管理器扩展 + 基础网页操控工具 (5/5 plans) — completed 2026-08-02
- [x] Phase 23: 智能上下文引用 + 全文检索 (2/2 plans) — completed 2026-08-02
- [x] Phase 24: 任务自主执行 (4/4 plans) — completed 2026-08-02
- [x] Phase 25: 脚本生成 + 智能标签整理 (7/7 plans) — completed 2026-08-04

</details>

### 🚧 v2.2 多媒体功能集成 (In Progress)

**Milestone Goal:** 为 Realm Browser 添加视频源检测、媒体面板和独立播放器功能

#### Phase 26: 视频源检测 + IPC 基础

**Goal**: 用户在任意容器中浏览网页时，系统自动检测页面中的视频资源 URL，并通过 IPC 通道将检测结果暴露给渲染进程
**Depends on**: Phase 25
**Requirements**: SNIFF-01, SNIFF-02, SNIFF-03, SNIFF-04, SNIFF-05, IPC-01, IPC-02, IPC-03, IPC-04, IPC-05
**Success Criteria** (what must be TRUE):

  1. 用户访问包含 m3u8/mp4/flv/webm 视频的网页时，系统自动检测到视频 URL 并记录到当前容器的媒体列表
  2. 用户访问包含 `<video>` 或 `<source>` 元素的网页时，系统通过注入脚本检测到视频 src/currentSrc
  3. 页面动态加载视频元素时（MutationObserver），系统实时检测到新增的视频资源
  4. 媒体列表按容器隔离，相同 URL 自动去重；页面导航时自动清空当前容器列表
  5. 渲染进程可通过 mediaAPI.getMediaList() 获取媒体列表，通过 mediaAPI.onMediaListUpdate 监听变更

**Plans**: 2/2 plans complete

Plans:
**Wave 1**

- [x] 26-01-PLAN.md — MediaSniffer 核心引擎（三种视频检测方式 + 容器隔离存储 + 导航生命周期）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 26-02-PLAN.md — IPC 通道 + mediaAPI preload 暴露（media:get-list/play/copy-url/clear-list + player.html 占位）

#### Phase 27: 媒体面板

**Goal**: 用户可以通过工具栏按钮打开媒体面板，查看当前容器检测到的所有媒体资源，并执行播放和复制操作
**Depends on**: Phase 26
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-05
**Success Criteria** (what must be TRUE):

  1. 用户点击工具栏媒体按钮时，浮动媒体面板打开/关闭，面板覆盖在页面上方（z-index 层叠）
  2. 媒体面板显示当前容器所有检测到的媒体资源列表，包含名称、类型徽标和 URL 预览
  3. 用户点击媒体项的播放按钮时，打开独立播放器窗口播放该视频
  4. 用户点击媒体项的复制按钮时，视频 URL 复制到系统剪贴板
  5. 新检测到媒体时，工具栏媒体按钮显示数量提示徽标

**Plans**: 1/1 plans complete

Plans:

- [ ] PLAN.md

**Wave 1**

- [ ] 27-PLAN.md — 媒体面板（HTML结构 + CSS样式 + 开关逻辑 + 播放复制 + 实时更新）
- [ ] 27-02-PLAN.md — Gap closure: G-27-1a 按钮 active 样式 / G-27-1b webview 点击关面板 / G-27-2 读推容器键对齐

#### Phase 28: 播放器窗口

**Goal**: 用户可以从媒体面板打开独立播放器窗口，支持多种视频格式的播放和完整的播放控制
**Depends on**: Phase 27
**Requirements**: PLAYER-01, PLAYER-02, PLAYER-03, PLAYER-04, PLAYER-05, PLAYER-06, PLAYER-07, PLAYER-08, PLAYER-09, PLAYER-10
**Success Criteria** (what must be TRUE):

  1. 播放器使用独立 BrowserWindow 打开，支持窗口大小调整和全屏模式
  2. 播放器支持 HLS (m3u8) 格式通过 hls.js 播放，MP4/WebM 格式通过 Chromium 原生播放，FLV/MPEG-TS 格式通过 mpegts.js 播放
  3. 播放器提供播放/暂停、进度条拖拽、时间显示、音量控制、倍速选择（0.5x/1x/1.5x/2x）等完整控制
  4. 播放器窗口关闭时正确销毁 hls.js/mpegts.js 实例，释放内存

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 26 → 27 → 28

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Container Management + Architecture Refactoring | v1.0 | 3/3 | Complete | 2026-07-23 |
| 2. Browser Core - URL Navigation + Multi-Tab | v1.0 | 5/5 | Complete | 2026-07-23 |
| 3. Data Isolation + Cookie Persistence | v1.0 | 1/1 | Complete | 2026-07-23 |
| 4. Convenience Features | v1.0 | 3/3 | Complete | 2026-07-24 |
| 5. 容器属性扩展 | v1.1 | 1/1 | Complete | 2026-07-25 |
| 6. 浏览历史记录 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 7. 收藏夹管理 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 8. 常用网站推荐 + 设置页面 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 9. 共享收藏数据库 | v1.1 | 3/4 | Complete | 2026-07-26 |
| 10. Cookie 管理增强 | v1.2 | 2/2 | Complete | 2026-07-26 |
| 11. 设置页面重构 | v1.2 | 2/2 | Complete | 2026-07-27 |
| 12. 开发者模式 | v1.2 | 2/2 | Complete | 2026-07-27 |
| 13. 右键菜单增强 | v1.3 | 3/3 | Complete | 2026-07-27 |
| 14. 收藏夹文件夹 - 数据库层实现 | v2.0 | 1/1 | Complete | 2026-07-28 |
| 15. 收藏夹文件夹 - UI 交互 | v2.0 | 2/2 | Complete | 2026-07-28 |
| 16. 收藏夹文件夹 - 增强功能 | v2.0 | 3/3 | Complete | 2026-07-29 |
| 17. Chrome 书签导入 | v2.0 | 2/2 | Complete | 2026-07-30 |
| 18. 收藏栏功能 | v2.0 | 2/2 | Complete | 2026-07-30 |
| 19. AI Agent 集成 - 基础验证 | v2.0 | 2/2 | Complete | 2026-07-31 |
| 20. AI Agent 集成 - 核心功能 | v2.0 | 2/2 | Complete | 2026-08-01 |
| 21. AI Agent 集成 - 聊天 UI | v2.0 | 3/3 | Complete | 2026-08-01 |
| 22. CDP 管理器扩展 + 基础网页操控工具 | v2.1 | 5/5 | Complete | 2026-08-02 |
| 23. 智能上下文引用 + 全文检索 | v2.1 | 2/2 | Complete | 2026-08-02 |
| 24. 任务自主执行 | v2.1 | 4/4 | Complete | 2026-08-02 |
| 25. 脚本生成 + 智能标签整理 | v2.1 | 7/7 | Complete | 2026-08-04 |
| 26. 视频源检测 + IPC 基础 | v2.2 | 2/2 | Complete    | 2026-08-06 |
| 27. 媒体面板 | v2.2 | 1/1 | Complete   | 2026-08-07 |
| 28. 播放器窗口 | v2.2 | 0/TBD | Not started | - |

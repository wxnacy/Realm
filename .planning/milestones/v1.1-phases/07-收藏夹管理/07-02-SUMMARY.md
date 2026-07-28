---
phase: 07-收藏夹管理
plan: 02
subsystem: favorites
tags: [ui, favorites, bookmark, search, inline-edit]
dependency_graph:
  requires: [favorites-manager, favorites-api, favorites-ipc]
  provides: [favorites-ui, favorites-page]
  affects: [src/index.html, src/renderer.js, src/favorites.html, src/favorites-page.js, src/styles/main.css]
tech_stack:
  added: []
  patterns: [inline-edit, debounce-search, highlight-text, batch-delete]
key_files:
  created:
    - src/favorites.html
    - src/favorites-page.js
  modified:
    - src/index.html
    - src/renderer.js
    - src/styles/main.css
decisions:
  - 收藏编辑面板采用 fixed 定位，锚定在工具栏下方，z-index 1001 确保在其他面板之上
  - 收藏列表页面复用 history.html 和 history-page.js 的架构模式，保持代码一致性
  - 行内编辑标题采用 blur/Enter 保存、Escape 取消的交互模式，与主流浏览器一致
  - 搜索高亮使用 .favorites-highlight 样式类（rgba(59,130,246,0.3) 背景色）
  - 单击标题进入编辑模式，双击打开链接，区分编辑和导航操作
metrics:
  duration: 65s
  completed: "2026-07-25T09:54:16Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
status: complete
---

# Phase 07 Plan 02: 收藏夹管理前端 UI Summary

工具栏星标按钮（收藏/取消收藏）、收藏编辑面板、收藏夹按钮（打开收藏列表页面）、收藏列表页面（搜索、行内编辑标题、批量删除）的完整前端 UI 实现。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | 添加工具栏按钮和收藏编辑面板 | 93778ab | src/index.html, src/renderer.js |
| 2 | 创建收藏列表页面 | 03ec235 | src/favorites.html, src/favorites-page.js, src/styles/main.css |

## What Was Built

### src/index.html（修改）

- 在 toolbar-right 区域 historyBtn 之前添加星标按钮（bookmarkStarBtn）
  - 包含两个 SVG 图标：star-outline（空心）和 star-filled（金色实心 #FBBF24）
  - star-filled 默认 display:none，通过 JavaScript 切换
- 在 historyBtn 之后添加收藏夹按钮（favoritesBtn），文件夹图标
- 在 body 结束前添加收藏编辑面板（bookmarkEditPanel）
  - 包含标题输入框（bookmarkTitleInput）、URL 显示（bookmarkUrlDisplay）、保存/取消按钮

### src/renderer.js（修改）

- elements 对象新增 7 个元素引用：bookmarkStarBtn、favoritesBtn、bookmarkEditPanel、bookmarkTitleInput、bookmarkUrlDisplay、bookmarkCancelBtn、bookmarkSaveBtn
- state 对象新增 2 个状态：isCurrentPageBookmarked、currentBookmarkId
- 新增 6 个收藏相关函数：
  - checkBookmarkStatus(url, containerId) — 检查当前页面是否已收藏
  - updateStarButton(bookmarked) — 更新星标按钮显示状态
  - showBookmarkEditPanel(title, url) — 显示收藏编辑面板
  - hideBookmarkEditPanel() — 隐藏收藏编辑面板
  - saveBookmark() — 保存收藏
  - removeBookmark() — 取消收藏当前页面
- setupEventListeners 中新增事件监听：
  - 星标按钮点击（未收藏弹出编辑面板，已收藏直接取消）
  - 编辑面板保存/取消按钮
  - 点击编辑面板外部关闭
  - Escape 键关闭编辑面板
  - 收藏夹按钮点击（打开 realm://favorites 页面）
- switchTab 中添加 checkBookmarkStatus 调用（切换 Tab 时更新收藏状态）
- did-navigate 中添加 checkBookmarkStatus 调用（导航完成后更新收藏状态）

### src/favorites.html（新建）

- 收藏列表页面 HTML 结构，参考 history.html
- 包含搜索栏、批量操作栏、内容区域、批量删除确认弹窗、Toast
- base href="/favorites/"，CSP 允许 img-src https/http/data

### src/favorites-page.js（新建）

- 复用 history-page.js 的架构模式：state 对象、DOM 引用、API 调用、事件绑定
- 核心功能：
  - 搜索：debounce 300ms，同时匹配 title 和 url，搜索高亮（.favorites-highlight）
  - 行内编辑标题：点击标题进入编辑模式，Enter/blur 保存，Escape 取消
  - 批量删除：复选框选择、全选/取消全选、确认弹窗
  - 滚动加载：距离底部 200px 时加载更多
  - 空状态：暂无收藏/搜索无结果两种提示
  - XSS 防护：escapeHtml 渲染用户数据

### src/styles/main.css（修改）

- 新增收藏夹页面样式（.favorites-*）：页面布局、搜索栏、批量操作栏、收藏项、空状态
- 新增行内编辑样式（.favorite-item-title-edit）
- 新增搜索高亮样式（.favorites-highlight）
- 新增收藏编辑面板样式（.bookmark-edit-*）

## Decisions Made

1. **收藏编辑面板 fixed 定位** — 锚定在工具栏下方（top: calc(var(--toolbar-height) + 4px)），z-index 1001 确保在其他面板之上
2. **单击编辑/双击打开** — 标题单击进入编辑模式，双击打开链接，区分编辑和导航操作
3. **搜索高亮复用 history-page.js 模式** — highlightText 函数结构相同，仅 CSS 类名不同（.favorites-highlight vs .history-highlight）
4. **不支持清空全部收藏** — 与历史记录页面不同，收藏夹没有"清空所有"按钮，因为收藏是用户主动操作，不应提供一键清空

## Verification Results

- [x] src/index.html 中存在 id="bookmarkStarBtn" 的星标按钮
- [x] src/index.html 中存在 id="favoritesBtn" 的收藏夹按钮
- [x] src/index.html 中存在 id="bookmarkEditPanel" 的收藏编辑面板
- [x] src/renderer.js 中存在 checkBookmarkStatus、updateStarButton、showBookmarkEditPanel、hideBookmarkEditPanel、saveBookmark、removeBookmark 函数
- [x] src/favorites.html 文件存在且结构正确
- [x] src/favorites-page.js 文件存在且包含完整的收藏列表逻辑
- [x] src/styles/main.css 中存在 .favorites-page、.favorite-item、.bookmark-edit-panel 等样式

## Known Stubs

None - all functions are fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-07-04 mitigated | src/favorites-page.js | escapeHtml 渲染用户数据防 XSS 注入 |
| T-07-05 mitigated | src/favorites-page.js | 行内编辑标题服务端验证非空 |

## Self-Check: PASSED

- FOUND: src/favorites.html
- FOUND: src/favorites-page.js
- FOUND: commit 93778ab
- FOUND: commit 03ec235

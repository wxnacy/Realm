---
phase: 18-bookmarks-bar
plan: 01
subsystem: ui
tags: [bookmarks-bar, favorites, css, ipc, electron]

# 依赖图
requires:
  - phase: 14-favorites-folders-db
    provides: favoritesManager CRUD API, folder_id 字段
  - phase: 17-chrome
    provides: Chrome 书签导入, favicon 获取
provides:
  - 收藏栏 HTML 结构和 CSS 样式
  - 收藏栏 IPC API（bookmarksBar namespace）
  - 收藏栏主组件（渲染、溢出计算、点击导航）
  - 收藏栏显示/隐藏设置持久化
affects: [18-02]

# 技术跟踪
tech-stack:
  added: [bookmarks-bar.css, bookmarks-bar.js]
  patterns: [ResizeObserver 溢出计算, favicon onerror 降级, escapeHtml XSS 防御]

key-files:
  created:
    - src/styles/bookmarks-bar.css
    - src/bookmarks-bar.js
  modified:
    - src/index.html
    - src/styles/main.css
    - src/preload.js
    - src/renderer.js
    - main.js
    - ipc-handlers.js

key-decisions:
  - "收藏栏使用 ResizeObserver 监听尺寸变化（18-RESEARCH.md Pitfall 1 建议）"
  - "先渲染文件夹再渲染收藏项（Chrome 顺序）"
  - "favorites:list IPC handler 增加 folderId 参数传递（之前被忽略）"

patterns-established:
  - "escapeHtml() 在 bookmarks-bar.js 中定义本地副本（与 favorites-page.js 一致）"
  - "window.bookmarksBar 全局接口暴露 load/recalculate/init 方法"

requirements-completed: [BAR-01, BAR-02]

# 指标
duration: 1min
completed: 2026-07-30
status: complete
---

# Phase 18 Plan 01: 收藏栏基础框架 Summary

**Chrome 风格收藏栏基础框架：HTML/CSS 布局、收藏数据加载渲染、溢出检测、点击导航**

## Performance

- **Duration:** 1 min
- **Started:** 2026-07-30T12:13:34Z
- **Completed:** 2026-07-30T12:14:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 收藏栏固定显示在地址栏下方（32px 高度，D-08/D-10 分隔线）
- 渲染根目录收藏项和文件夹，favicon 加载失败降级到 Realm 图标（D-09）
- 点击收藏项在当前标签页导航，Cmd/Ctrl+Click 在新标签页打开
- 溢出计算：ResizeObserver 监听尺寸变化，超出宽度的项隐藏，>> 按钮显示
- 新增 realmAPI.bookmarksBar 命名空间（listFavorites, getFolderTree, listFolders, toggle, getVisibility）
- favorites:list IPC handler 增加 folderId 参数传递

## Task Commits

1. **Task 1: 收藏栏 HTML + CSS + IPC + Preload API** - `6cd27e3` (feat)
2. **Task 2: 收藏栏主组件（渲染 + 溢出计算 + 点击导航）** - `24dc4ca` (feat)

## Files Created/Modified
- `src/styles/bookmarks-bar.css` - 收藏栏完整 CSS 样式（bar/overflow/dropdown/submenu）
- `src/bookmarks-bar.js` - 收藏栏主组件（渲染、溢出计算、点击导航、favicon 降级）
- `src/index.html` - 添加收藏栏 DOM 结构和 script 标签
- `src/styles/main.css` - 导入 bookmarks-bar.css
- `src/preload.js` - 新增 realmAPI.bookmarksBar 命名空间 API
- `src/renderer.js` - 添加收藏栏元素引用、初始化、右键事件委托
- `main.js` - 添加 bookmarks-bar:toggle/get-visibility IPC handlers
- `ipc-handlers.js` - favorites:list handler 增加 folderId 参数传递

## Decisions Made
- 收藏栏使用 ResizeObserver 监听尺寸变化（18-RESEARCH.md Pitfall 1 建议方案）
- 先渲染文件夹再渲染收藏项（与 Chrome 收藏栏顺序一致）
- favorites:list IPC handler 之前忽略 folderId 参数，本次修复传递给 favoritesManager.listRecords
- escapeHtml() 在 bookmarks-bar.js 中定义本地副本，不依赖 favorites-page.js

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 收藏栏基础框架完成，可以显示根目录收藏项和文件夹
- Plan 02（高级交互）就绪：文件夹下拉菜单、溢出菜单、右键菜单、显示/隐藏设置

---
*Phase: 18-bookmarks-bar*
*Completed: 2026-07-30*

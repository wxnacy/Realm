---
phase: 14-favorites-folders-db
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, favorites, folders, cascade-delete, ipc, electron]

# Dependency graph
requires:
  - phase: 09
    provides: 全局共享 favorites 表（better-sqlite3）
  - phase: 11
    provides: HTTP API 路由模式（handleFavoritesApi + token 鉴权）
provides:
  - favorite_folders 表（支持无限层级嵌套）
  - favorites 表 folder_id/sort_order 字段扩展
  - 文件夹 CRUD API（create/rename/delete/list/tree/move）
  - 收藏项移动 API（move/move-batch/sort-update）
  - 10 个 IPC 通道 + 10 个 HTTP API 路由 + 10 个 Preload API 方法
affects: [15-favorites-folders-ui, 16-favorites-folders-enhanced]

# Tech tracking
tech-stack:
  added: []
  patterns: [try-catch-ALTER-TABLE-migration, ON-DELETE-CASCADE, recursive-tree-building]

key-files:
  created: []
  modified:
    - favorites-manager.js
    - main.js
    - src/preload.js

key-decisions:
  - "使用 try-catch 包裹 ALTER TABLE 迁移（幂等启动）"
  - "启用 PRAGMA foreign_keys = ON（级联删除依赖此设置）"
  - "folder_id = 0 作为虚拟根目录（不存在于表中）"
  - "循环引用检测使用应用层递归查询（isDescendant 辅助函数）"
  - "排序值使用 COALESCE(MAX(sort_order), 0) + 1 自动分配"

patterns-established:
  - "文件夹 IPC 通道命名: favorites:*-folder / favorites:move-*"
  - "文件夹 HTTP API 路由: create-folder, rename-folder, delete-folder, list-folders, folder-tree, move-folder"
  - "Preload API 方法命名: createFavoriteFolder, renameFavoriteFolder, deleteFavoriteFolder, listFavoriteFolders, getFavoriteFolderTree, moveFavoriteFolder"

requirements-completed: [FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-04]

# Metrics
duration: 15min
completed: 2026-07-28
status: complete
---

# Phase 14 Plan 01: 收藏夹文件夹 - 数据库层实现 Summary

**收藏夹文件夹数据库层：favorite_folders 表（无限层级嵌套 + CASCADE 级联删除）+ 文件夹 CRUD + 收藏项移动 + IPC/HTTP/Preload 全链路暴露**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-28
- **Completed:** 2026-07-28
- **Tasks:** 6 (T1-T6)
- **Files modified:** 3

## Accomplishments

- 创建 `favorite_folders` 表，支持无限层级嵌套（parent_id 自引用 + ON DELETE CASCADE）
- `favorites` 表添加 `folder_id`（默认 0 表示根目录）和 `sort_order` 字段
- 实现文件夹 CRUD：createFolder, renameFolder, deleteFolder, listFolders, getFolderTree, moveFolder
- 实现循环引用检测（isDescendant 辅助函数），防止文件夹移动到自身后代
- 实现收藏项移动 API：moveFavorite, moveFavorites, updateFolderSort, updateFavoriteSort
- 注册 10 个 IPC 通道 + 10 个 HTTP API 路由 + 10 个 Preload API 方法

## Task Commits

Each task was committed atomically:

1. **Task 1-3: 表结构 + 文件夹 CRUD + 收藏项移动** - `7f65630` (feat)
2. **Task 4-5: IPC 通道 + HTTP API** - `6ee889c` (feat)
3. **Task 6: Preload API** - `bba2072` (feat)

## Files Created/Modified

- `favorites-manager.js` - 添加 favorite_folders 表创建、folder_id/sort_order 迁移、外键启用、文件夹 CRUD 函数（6 个）、收藏项移动函数（4 个）
- `main.js` - 注册 10 个 IPC 通道（favorites:create-folder 等）、添加 10 个 HTTP API 路由到 handleFavoritesApi
- `src/preload.js` - 暴露 10 个 realmAPI 方法（createFavoriteFolder 等）

## Decisions Made

- 使用 try-catch 包裹 ALTER TABLE 迁移语句：列已存在时忽略，确保应用可幂等启动
- 启用 PRAGMA foreign_keys = ON：better-sqlite3 默认关闭外键约束，级联删除依赖此设置
- folder_id = 0 作为虚拟根目录：不存在于 favorite_folders 表中，简化查询逻辑
- 循环引用检测使用应用层递归：文件夹层级通常 < 10 层，性能可接受
- 排序值使用 MAX(sort_order) + 1 自动分配：新创建的文件夹/移动的收藏项自动排到末尾

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 数据库层完整，文件夹 CRUD 和收藏项移动 API 全链路可用
- Phase 15（UI 交互）可直接使用 `window.realmAPI.createFavoriteFolder()` 等方法
- 需要 UI 层实现：文件夹树状导航、面包屑导航、右键菜单

---
*Phase: 14-favorites-folders-db*
*Completed: 2026-07-28*

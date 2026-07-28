---
phase: 07-收藏夹管理
plan: 01
subsystem: favorites
tags: [sqlite, api, ipc, favorites]
dependency_graph:
  requires: []
  provides: [favorites-manager, favorites-api, favorites-ipc]
  affects: [main.js, ipc-handlers.js, src/preload.js]
tech_stack:
  added: []
  patterns: [better-sqlite3-per-container-table, http-api-token-auth, ipc-assert-trusted-sender]
key_files:
  created:
    - favorites-manager.js
  modified:
    - main.js
    - ipc-handlers.js
    - src/preload.js
decisions:
  - 复用 history-manager.js 架构模式（sanitizeContainerId、ensureTable、延迟加载 better-sqlite3）
  - 与 history-manager.js 共享同一 SQLite 数据库文件（history.db），通过独立 initDatabase 初始化
  - UNIQUE(url) 约束实现 URL 去重（D-14），应用层 INSERT OR IGNORE + lastInsertRowid 检查双重防御
  - 收藏数量不设上限（D-16），无 FIFO 淘汰机制
  - HTTP API 端点使用 REALM_TOKEN 鉴权（与 /api/history/* 相同机制）
metrics:
  duration: 20s
  completed: "2026-07-25T09:52:45Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
status: complete
---

# Phase 07 Plan 01: 收藏夹数据层与 API 层 Summary

SQLite 收藏数据 CRUD 模块 + HTTP API 端点 + IPC 通道 + preload API，实现收藏夹完整的数据层和通信层。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | 创建 favorites-manager.js 收藏管理模块 | 96e03b6 | favorites-manager.js |
| 2 | 集成收藏 API 到 main.js + IPC + preload | d8d809b | main.js, ipc-handlers.js, src/preload.js |

## What Was Built

### favorites-manager.js（新建）
- 复用 history-manager.js 架构模式：sanitizeContainerId、ensureTable、延迟加载 better-sqlite3
- 每容器独立表 `favorites_{containerId}`，表结构：id, url, title, favicon_url, created_at
- UNIQUE(url) 约束实现 URL 去重（D-14）
- 完整 CRUD：addRecord、updateRecord、deleteRecord、deleteRecords、listRecords、searchRecords、checkUrl、getCount、dropTable
- addRecord 遇到重复 URL 返回 `{ error: 'duplicate', message: '已收藏过该页面' }`
- 支持 setDatabase 注入外部 db 实例（共享连接）

### main.js（修改）
- 添加 favorites-manager.js require 和 initDatabase 调用
- 添加 handleFavoritesApi 函数处理 /api/favorites/* 端点
  - GET /api/favorites/list — 列出收藏
  - GET /api/favorites/search — 搜索收藏
  - GET /api/favorites/check — 检查 URL 是否已收藏
  - POST /api/favorites/add — 添加收藏
  - POST /api/favorites/update — 更新收藏标题
  - POST /api/favorites/delete — 删除收藏
  - POST /api/favorites/delete-batch — 批量删除
- 所有端点经过 REALM_TOKEN 鉴权
- 添加 realm://favorites 路由映射

### ipc-handlers.js（修改）
- 添加 favorites:* IPC 处理器（check/add/update/delete/delete-batch/list/search/count）
- 所有处理器经过 assertTrustedSender 验证

### src/preload.js（修改）
- 暴露 8 个收藏 API：favoritesCheck、favoritesAdd、favoritesUpdate、favoritesDelete、favoritesDeleteBatch、favoritesList、favoritesSearch、favoritesCount

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **复用 history-manager.js 架构模式** — 保持代码一致性，降低维护成本
2. **独立 initDatabase 而非共享 db 实例** — 两个模块各自初始化数据库连接，避免循环依赖。SQLite WAL 模式下多连接并发读写性能良好
3. **UNIQUE(url) + INSERT OR IGNORE 双重防御** — 数据库层和应用层同时保证 URL 去重

## Verification Results

- [x] favorites-manager.js 可以被 require 加载（`node -e` 验证通过）
- [x] main.js 中存在 /api/favorites/* 路由和 handleFavoritesApi 函数
- [x] main.js 中存在 realm://favorites 路由映射
- [x] ipc-handlers.js 中存在 favorites:* IPC 处理器
- [x] src/preload.js 中存在所有 8 个收藏 API
- [x] 所有 API 端点都经过 REALM_TOKEN 鉴权

## Known Stubs

None - all functions are fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-07-01 mitigated | favorites-manager.js | sanitizeContainerId + 参数化查询防 SQL 注入 |
| T-07-02 mitigated | main.js | REALM_TOKEN 鉴权防未授权访问 |
| T-07-03 mitigated | favorites-manager.js | UNIQUE 约束 + 应用层检查防 URL 去重绕过 |

## Self-Check: PASSED

- FOUND: favorites-manager.js
- FOUND: commit 96e03b6
- FOUND: commit d8d809b

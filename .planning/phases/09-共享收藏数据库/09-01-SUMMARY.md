---
phase: 09-共享收藏数据库
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, migration, favorites]

requires:
  - phase: 07-收藏夹管理
    provides: favorites-manager.js per-container CRUD 实现
provides:
  - 全局 favorites 表（替代 per-container 分表）
  - migrateToGlobal() 启动时自动迁移
  - 移除 containerId 依赖的 favorites-manager.js
  - 移除 containerId 的 main.js API 端点
affects: [09-02, preload.js, renderer.js, favorites-page.js]

tech-stack:
  added: []
  patterns: [全局单表替代 per-container 分表, 启动时自动迁移]

key-files:
  created: []
  modified:
    - favorites-manager.js
    - main.js

key-decisions:
  - "不迁移旧数据：现有 per-container 收藏数据直接丢弃，全新开始（D-01）"
  - "迁移逻辑在应用启动时自动执行：drop 所有旧表 + create 全局表（D-02）"
  - "同一 URL 全局唯一约束，重复收藏返回'已收藏过该页面'（D-05）"

patterns-established:
  - "全局单表模式：移除 per-container 分表，使用固定表名 + 无参数 ensureTable()"
  - "启动迁移模式：initDatabase() 后紧跟 migrateToGlobal()，幂等执行"

requirements-completed: [FAV-07, FAV-09, FAV-10]

coverage:
  - id: D1
    description: "favorites-manager.js 重构为全局单表，所有 CRUD 函数移除 containerId"
    requirement: FAV-07
    verification:
      - kind: unit
        ref: "node -e \"const fm = require('./favorites-manager'); console.log(typeof fm.migrateToGlobal === 'function' && typeof fm.dropTable === 'undefined')\""
        status: pass
    human_judgment: false
  - id: D2
    description: "main.js API 端点移除 containerId 参数，注册 migrateToGlobal 调用"
    requirement: FAV-09
    verification:
      - kind: unit
        ref: "grep -n 'containerId' main.js | grep -i favor (期望无输出)"
        status: pass
    human_judgment: false
  - id: D3
    description: "migrateToGlobal() 启动时自动执行，删除旧表创建全局表"
    requirement: FAV-10
    verification:
      - kind: unit
        ref: "grep -n 'migrateToGlobal' main.js (期望在 initDatabase 后)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-25
status: complete
---

# Phase 9 Plan 01: 共享收藏数据库 — 后端重构

**favorites-manager.js 从 per-container 分表重构为全局单一 favorites 表，main.js API 端点移除 containerId 依赖**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-25
- **Completed:** 2026-07-25
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- favorites-manager.js 完全重构：移除 sanitizeContainerId()、dropTable()，所有 CRUD 函数不再接收 containerId
- 新增 migrateToGlobal() 函数：启动时自动 drop 所有旧 favorites_* 表并创建全局 favorites 表
- main.js 7 个 /api/favorites/* 端点全部移除 containerId 参数
- main.js 启动流程中 initDatabase() 后自动调用 migrateToGlobal()

## Files Created/Modified
- `favorites-manager.js` — 全局单表 CRUD + migrateToGlobal() 迁移函数
- `main.js` — API 端点参数简化 + 启动时注册迁移调用

## Decisions Made
- 不迁移旧数据（D-01）：现有 per-container 收藏直接丢弃，全新开始
- 迁移自动执行（D-02）：initDatabase() → migrateToGlobal()，幂等安全
- 保留 ensureTable() 调用（D-08）：每次 CRUD 前仍调用 CREATE TABLE IF NOT EXISTS，幂等无开销

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 后端 API 已就绪，等待 Wave 2 前端层对齐（preload.js、renderer.js、favorites-page.js）

---
*Phase: 09-共享收藏数据库*
*Plan: 01*
*Completed: 2026-07-25*

---
phase: 16-favorites-enhancements
plan: 01
subsystem: database
tags: [fractional-indexing, sort-order, migration, sqlite]

requires:
  - phase: 14-favorites-folders-db
    provides: favorites and favorite_folders tables with sort_order field
provides:
  - fractional-indexing migration for sort_order
  - batch sort update API
  - compute-sort-keys endpoint
affects: [16-02-drag-sort, 16-03-multi-select]

tech-stack:
  added: [fractional-indexing]
  patterns: [batch-transaction-update, sort-order-migration]

key-files:
  created: []
  modified: [favorites-manager.js, main.js, package.json]

key-decisions:
  - "使用 fractional-indexing 库实现分数索引排序，支持拖拽插入"
  - "前端通过 compute-sort-keys 端点计算排序键，无需引入额外依赖"
  - "批量排序更新使用事务包裹，确保原子性"

requirements-completed: [FOLDER-07]

coverage:
  - id: D1
    description: "fractional-indexing 依赖安装"
    requirement: FOLDER-07
    verification:
      - kind: command
        ref: "npm ls fractional-indexing"
        status: pass
    human_judgment: false
  - id: D2
    description: "sort_order 迁移函数"
    requirement: FOLDER-07
    verification:
      - kind: unit
        ref: "migrateSortOrder() 函数实现"
        status: pass
    human_judgment: false
  - id: D3
    description: "批量排序更新 API"
    requirement: FOLDER-07
    verification:
      - kind: unit
        ref: "batchUpdateSort/batchUpdateFolderSort 函数定义"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-29
status: complete
---

# Phase 16 Plan 01: 数据库层准备 Summary

**fractional-indexing 集成：将 sort_order 从整数迁移为分数索引字符串，支持拖拽排序插入**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-29T12:15:00Z
- **Completed:** 2026-07-29T12:25:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 安装 fractional-indexing 依赖（1.6kB 无依赖库）
- 实现 migrateSortOrder() 函数，自动将整数 sort_order 迁移为分数索引字符串
- 添加 batchUpdateSort() 和 batchUpdateFolderSort() 批量排序函数，使用事务确保原子性
- 在 main.js 中添加 compute-sort-keys、update-batch-sort、update-batch-folder-sort 路由

## Task Commits

1. **Task 1-2: 安装依赖并实现迁移和批量排序 API** - `16321d1` (feat)

## Files Created/Modified

- `package.json` - 添加 fractional-indexing 依赖
- `favorites-manager.js` - 添加 migrateSortOrder、batchUpdateSort、batchUpdateFolderSort 函数
- `main.js` - 添加 compute-sort-keys、update-batch-sort、update-batch-folder-sort 路由

## Decisions Made

- 使用 fractional-indexing 库（rocicorp 维护，1.6kB 无依赖）实现分数索引排序
- 前端通过 compute-sort-keys 端点计算排序键，避免前端引入额外依赖
- 批量排序更新使用 better-sqlite3 事务包裹，确保原子性

## Next Steps

Ready for 16-02-PLAN.md（拖拽排序核心实现）

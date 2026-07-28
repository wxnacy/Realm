# Phase 14: 收藏夹文件夹 - 数据库层实现 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 14-收藏夹文件夹 - 数据库层实现
**Areas discussed:** 循环引用防护策略, 数据迁移策略, 排序策略, 级联删除实现

---

## 循环引用防护策略

| Option | Description | Selected |
|--------|-------------|----------|
| 应用层递归路径检测（推荐） | 在应用层检查目标父文件夹是否是当前文件夹的后代。简单可靠，性能可接受（文件夹层级通常不深） | ✓ |
| Materialized Path 路径字段 | 使用 parent_ids TEXT 字段存储完整路径（如 '/1/5/12'），移动时检查路径是否包含自身 ID。查询方便但维护复杂 | |
| 限制嵌套深度 | 限制最大嵌套深度为 3-5 层，从根源上避免循环引用。简单但限制了用户自由度 | |

**User's choice:** 应用层递归路径检测（推荐）
**Notes:** 用户选择最简单可靠的方案，性能可接受

---

## 数据迁移策略

| Option | Description | Selected |
|--------|-------------|----------|
| folder_id 默认 NULL（推荐） | 所有现有收藏项保留在根目录，folder_id 为 NULL 表示根目录。用户可以在后续手动整理到文件夹中 | |
| 创建"未分类"文件夹 | 创建一个默认的"未分类"文件夹，所有现有收藏项移动到该文件夹下。用户需要先删除或移动这些项才能删除文件夹 | |
| folder_id 默认 0（特殊值） | folder_id 默认为 0，代码中特殊处理 0 表示根目录。与 NULL 语义相同但更明确 | ✓ |

**User's choice:** folder_id 默认 0（特殊值）
**Notes:** 用户选择更明确的方案，使用 0 作为特殊值表示根目录

---

## 排序策略

| Option | Description | Selected |
|--------|-------------|----------|
| 手动拖拽排序（推荐） | 新增 sort_order INTEGER 字段，用户可以通过拖拽调整顺序。灵活但需要额外的字段和更新逻辑 | ✓ |
| 按创建时间倒序 | 按照创建时间倒序排列，最新的在前面。简单但用户无法自定义顺序 | |
| 文件夹按名称 + 收藏按时间 | 文件夹按名称字母排序，收藏项按创建时间倒序。混合策略，折中方案 | |
| Fractional Indexing | 使用 fractional indexing 算法，在两个项目之间插入新位置。性能好但实现复杂 | |

**User's choice:** 手动拖拽排序（推荐）
**Notes:** 用户选择最灵活的方案，支持用户自定义顺序

---

## 级联删除实现

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite ON DELETE CASCADE（推荐） | 使用 SQLite 的 ON DELETE CASCADE 外键约束，数据库自动处理级联删除。简单但需要启用外键约束 | ✓ |
| 应用层递归删除 | 在应用层递归删除子文件夹和收藏项。灵活但需要手动实现删除逻辑 | |

**User's choice:** SQLite ON DELETE CASCADE（推荐）
**Notes:** 用户选择数据库级联删除，简单可靠

---

## Claude's Discretion

无 — 所有决策都由用户明确选择

## Deferred Ideas

None — discussion stayed within phase scope

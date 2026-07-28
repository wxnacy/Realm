# Phase 14: 收藏夹文件夹 - 数据库层实现 - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段实现收藏夹文件夹功能的数据库层，包括：
- 创建 `favorite_folders` 表（支持无限层级嵌套）
- `favorites` 表添加 `folder_id` 字段（默认值 0 表示根目录）
- 实现文件夹 CRUD API（创建、重命名、删除、列出）
- 实现收藏项移动 API（支持批量移动）
- 注册 IPC 通道供渲染进程调用

**不包括**：UI 交互、拖拽排序 UI、面包屑导航、右键菜单（这些在 Phase 15 实现）

</domain>

<decisions>
## Implementation Decisions

### 循环引用防护
- **D-01:** 使用应用层递归路径检测防止循环引用
- 实现思路：移动文件夹时，递归检查目标父文件夹是否是当前文件夹的后代
- 性能考虑：文件夹层级通常不深（< 10 层），递归检测性能可接受

### 数据迁移策略
- **D-02:** `folder_id` 默认值为 0（特殊值表示根目录）
- 现有收藏项自动保留在根目录（folder_id = 0）
- 代码中需要特殊处理 folder_id = 0 的情况，表示"无文件夹"或"根目录"
- 向后兼容：未使用文件夹功能的用户体验不变

### 排序策略
- **D-03:** 使用手动拖拽排序，新增 `sort_order INTEGER` 字段
- `favorite_folders` 表和 `favorites` 表都需要 `sort_order` 字段
- 用户可以通过拖拽调整文件夹和收藏项的顺序
- 默认排序值按创建时间递增分配

### 级联删除实现
- **D-04:** 使用 SQLite ON DELETE CASCADE 外键约束
- 启用 `PRAGMA foreign_keys = ON`（better-sqlite3 默认关闭）
- 删除文件夹时，数据库自动级联删除子文件夹和收藏项
- 简单可靠，无需手动实现递归删除逻辑

### Claude's Discretion
- IPC 通道命名：使用 kebab-case 格式（如 `favorites:create-folder`）
- 数据库索引：为 `folder_id` 和 `sort_order` 创建索引优化查询性能
- 错误处理：文件夹不存在时返回 `null`，删除失败时返回 `{ success: false, message: '...' }`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — FOLDER-01 ~ FOLDER-04 需求详情和验收标准
- `.planning/ROADMAP.md` — Phase 14 任务列表和里程碑背景

### 现有代码
- `favorites-manager.js` — 现有收藏夹管理模块，包含数据库初始化、表管理、CRUD 操作
- `main.js` — IPC 处理器注册模式、容器管理逻辑
- `src/preload.js` — contextBridge API 暴露模式

### 技术参考
- `.planning/codebase/STACK.md` — 技术栈详情（Electron 32.x、better-sqlite3）
- `.planning/codebase/ARCHITECTURE.md` — 系统架构、数据流、IPC 通信模式
- `.planning/codebase/INTEGRATIONS.md` — 数据存储、IPC 通信机制

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `favorites-manager.js`: 现有的收藏夹 CRUD 操作，可以直接扩展文件夹功能
- `better-sqlite3` 数据库连接：已通过 `setDatabase` 注入，与 history-manager.js 共享
- `ensureTable()` 模式：确保表存在的惯用方法，可复用于 `favorite_folders` 表

### Established Patterns
- IPC 通道注册：使用 `ipcMain.handle('channel-name', handler)` 模式
- Preload API 暴露：通过 `contextBridge.exposeInMainWorld('realmAPI', {...})` 暴露
- 错误处理：返回 `{ success: false, message: '...' }` 或 `null` 表示失败
- 日志前缀：使用 `[Realm]` 前缀标识主进程日志

### Integration Points
- `main.js` 中的 IPC 处理器区域：需要添加文件夹相关的 IPC 通道
- `src/preload.js` 中的 `realmAPI` 对象：需要添加文件夹 API 方法
- `favorites-manager.js` 的 `ensureTable()` 函数：需要扩展以创建 `favorite_folders` 表
- 数据库连接：通过 `setDatabase` 注入的 `db` 实例，用于执行 SQL

</code_context>

<specifics>
## Specific Ideas

无特殊要求 — 用户选择标准实现方案，无特殊参考或"我想要像 X"的要求

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-收藏夹文件夹 - 数据库层实现*
*Context gathered: 2026-07-28*

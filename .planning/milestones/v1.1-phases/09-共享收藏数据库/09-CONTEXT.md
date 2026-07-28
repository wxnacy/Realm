# Phase 9: 共享收藏数据库 - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

将收藏功能从按容器隔离（`favorites_{containerId}` 分表）重构为全局共享单一表。所有容器读写同一份收藏数据，收藏与容器生命周期完全解耦。

具体能力边界：
- 创建新的全局 `favorites` 表，替代所有 per-container 分表
- 收藏 API 移除 containerId 参数，所有操作基于全局表
- 收藏页面 UI 移除容器感知逻辑
- 启动时自动执行迁移：删除旧 per-container 表，创建新全局表
- 同一 URL 全局唯一去重
- 容器删除时不再清空收藏数据

</domain>

<decisions>
## Implementation Decisions

### 数据迁移策略
- **D-01:** 不迁移旧数据 — 现有 per-container 收藏数据直接丢弃，全新开始
- **D-02:** 迁移逻辑在应用启动时自动执行：drop 所有 `favorites_{containerId}` 表 + create 新的全局 `favorites` 表
- **D-03:** 无需回滚策略 — 旧数据不需要保留，迁移失败时下次启动重试即可

### 全局表设计
- **D-04:** 单一全局 `favorites` 表，不再有 containerId 列
- **D-05:** 同一 URL 全局唯一约束，重复收藏返回"已收藏过该页面"提示
- **D-06:** 表结构沿用 Phase 7 的字段（id, url, title, favicon_url, created_at），去掉 container_id

### API 变更
- **D-07:** 所有 `/api/favorites/*` 端点移除 containerId 参数
- **D-08:** favorites-manager.js 的所有函数移除 containerId 参数，直接操作全局表
- **D-09:** 移除 `ensureTable(containerId)` 和 `sanitizeContainerId()` 等 per-container 相关函数

### 前端变更
- **D-10:** favorites-page.js 移除 `containerId` 状态和 URL 参数读取
- **D-11:** 所有 API 调用不再传递 containerId
- **D-12:** renderer.js 中收藏按钮逻辑不再依赖当前容器判断收藏状态

### Claude's Discretion
- SQLite 表结构优化（索引设计等）
- 迁移代码的具体实现位置（initDatabase 中还是独立迁移函数）
- favorites-manager.js 重构后的代码组织
- 收藏页面 CSS 微调

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — FAV-07 (重新设计), FAV-09, FAV-10 需求定义
- `.planning/ROADMAP.md` — Phase 9 目标和成功标准

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南

### 关键文件（Phase 7 实现，需重构）
- `favorites-manager.js` — 收藏夹管理模块，核心重构目标（per-container → global）
- `main.js:299-358` — /api/favorites/* API 端点定义，需移除 containerId 参数
- `src/favorites.html` — 收藏页面 HTML 结构
- `src/favorites-page.js` — 收藏页面逻辑，需移除容器相关代码
- `src/renderer.js` — 收藏按钮交互逻辑

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **better-sqlite3 数据库连接**: 已在 history-manager.js 中初始化，与 favorites-manager 共享
- **本地 HTTP 服务器 (main.js)**: 已有 /api/favorites/* 端点，重构参数即可
- **favorites-manager.js**: 完整的 CRUD 实现，需要改为操作全局表

### Established Patterns
- **IPC 通道命名**: kebab-case 格式
- **API 端点模式**: /api/xxx/* JSON 端点，token 认证
- **数据库初始化**: initDatabase() + setDatabase() 模式

### Integration Points
- **favorites-manager.js**: 核心重构 — 去掉 per-container 表管理，改为单一全局表
- **main.js:299-358**: API 端点参数调整
- **src/favorites-page.js**: 移除 containerId 状态和 API 参数
- **src/renderer.js**: 收藏按钮状态检测移除容器依赖

</code_context>

<specifics>
## Specific Ideas

无特殊要求 — 标准重构，保持现有 UI 风格和交互模式不变，只改数据层。

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 9-共享收藏数据库*
*Context gathered: 2026-07-25*

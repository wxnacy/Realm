# Phase 9: 共享收藏数据库 - Research

**Researched:** 2026-07-25
**Domain:** SQLite 数据库重构 / Electron IPC 通信 / 前端状态管理
**Confidence:** HIGH

## Summary

Phase 9 将收藏功能从按容器隔离（`favorites_{containerId}` 分表）重构为全局共享单一表。所有容器读写同一份收藏数据，收藏与容器生命周期完全解耦。

这是一个纯后端重构任务，不涉及任何视觉或交互变更。核心改动包括：
1. `favorites-manager.js` — 从动态表名改为固定全局表，移除所有 containerId 参数
2. `main.js` — API 端点移除 containerId 参数传递
3. `src/favorites-page.js` — 移除 containerId 状态和 URL 参数读取
4. `src/renderer.js` — 收藏按钮逻辑不再依赖当前容器
5. `src/preload.js` — IPC 接口移除 containerId 参数

迁移策略为破坏性迁移：启动时 drop 所有旧 `favorites_*` 表，创建新的全局 `favorites` 表，不保留旧数据。

**Primary recommendation:** 按照自底向上的顺序实施：manager → API → preload → renderer → favorites-page，每层独立可测试。

## User Constraints (from CONTEXT.md)

<user_constraints>

### Implementation Decisions

#### 数据迁移策略
- **D-01:** 不迁移旧数据 — 现有 per-container 收藏数据直接丢弃，全新开始
- **D-02:** 迁移逻辑在应用启动时自动执行：drop 所有 `favorites_{containerId}` 表 + create 新的全局 `favorites` 表
- **D-03:** 无需回滚策略 — 旧数据不需要保留，迁移失败时下次启动重试即可

#### 全局表设计
- **D-04:** 单一全局 `favorites` 表，不再有 containerId 列
- **D-05:** 同一 URL 全局唯一约束，重复收藏返回"已收藏过该页面"提示
- **D-06:** 表结构沿用 Phase 7 的字段（id, url, title, favicon_url, created_at），去掉 container_id

#### API 变更
- **D-07:** 所有 `/api/favorites/*` 端点移除 containerId 参数
- **D-08:** favorites-manager.js 的所有函数移除 containerId 参数，直接操作全局表
- **D-09:** 移除 `ensureTable(containerId)` 和 `sanitizeContainerId()` 等 per-container 相关函数

#### 前端变更
- **D-10:** favorites-page.js 移除 `containerId` 状态和 URL 参数读取
- **D-11:** 所有 API 调用不再传递 containerId
- **D-12:** renderer.js 中收藏按钮逻辑不再依赖当前容器判断收藏状态

### Claude's Discretion
- SQLite 表结构优化（索引设计等）
- 迁移代码的具体实现位置（initDatabase 中还是独立迁移函数）
- favorites-manager.js 重构后的代码组织
- 收藏页面 CSS 微调

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FAV-07 (重新设计) | 收藏数据全局共享，所有容器看到同一份收藏列表 | favorites-manager.js 重构为单一全局表 |
| FAV-09 | 全局唯一去重 | UNIQUE(url) 约束保持不变 |
| FAV-10 | 容器删除不影响收藏 | 移除 dropTable 调用，收藏与容器解耦 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SQLite 表管理 | Main Process (Node.js) | — | better-sqlite3 仅在主进程可用 |
| API 端点处理 | Main Process (HTTP Server) | — | 本地 HTTP 服务器处理 /api/favorites/* |
| IPC 接口暴露 | Preload Script | — | contextBridge 安全暴露给渲染进程 |
| 收藏页面渲染 | Renderer (Webview Guest) | — | favorites-page.js 运行在 webview 中 |
| 收藏按钮交互 | Renderer (Main Window) | — | renderer.js 管理星标按钮状态 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 已集成 | SQLite 数据库操作 | 项目已使用，同步 API，性能优秀 |
| Electron Session API | 32.x | 容器隔离机制 | 项目核心依赖 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 8.1.0+ | 容器配置持久化 | 已集成，本阶段不涉及 |

**Installation:** 无需安装新依赖，所有必需库已集成。

## File-by-File Change Inventory

### 1. `favorites-manager.js` — 核心重构目标

**当前状态：** 284 行，per-container 分表模式

**需要修改的函数：**

| 函数 | 行号 | 当前签名 | 目标签名 | 改动类型 |
|------|------|----------|----------|----------|
| `sanitizeContainerId()` | 66-74 | `sanitizeContainerId(containerId)` | 删除 | 移除 |
| `ensureTable()` | 82-100 | `ensureTable(containerId)` | `ensureTable()` (无参数) | 简化 |
| `addRecord()` | 113-130 | `addRecord(containerId, {...})` | `addRecord({...})` | 移除参数 |
| `updateRecord()` | 140-150 | `updateRecord(containerId, id, {...})` | `updateRecord(id, {...})` | 移除参数 |
| `deleteRecord()` | 158-165 | `deleteRecord(containerId, id)` | `deleteRecord(id)` | 移除参数 |
| `deleteRecords()` | 173-183 | `deleteRecords(containerId, ids)` | `deleteRecords(ids)` | 移除参数 |
| `listRecords()` | 193-203 | `listRecords(containerId, {...})` | `listRecords({...})` | 移除参数 |
| `searchRecords()` | 214-226 | `searchRecords(containerId, {...})` | `searchRecords({...})` | 移除参数 |
| `checkUrl()` | 234-243 | `checkUrl(containerId, url)` | `checkUrl(url)` | 移除参数 |
| `getCount()` | 250-257 | `getCount(containerId)` | `getCount()` | 移除参数 |
| `dropTable()` | 263-268 | `dropTable(containerId)` | 删除 | 移除 |

**新增函数：**

| 函数 | 用途 |
|------|------|
| `migrateToGlobal()` | 启动时执行迁移：drop 所有 `favorites_*` 表，创建全局 `favorites` 表 |

**表结构变更：**

```sql
-- 当前：per-container 动态表名
CREATE TABLE IF NOT EXISTS favorites_${containerId} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon_url TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(url)
);

-- 目标：固定全局表名
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon_url TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(url)
);
```

### 2. `main.js` — API 端点参数调整

**需要修改的代码块：** 行 299-367（handleFavoritesApi 函数）

| 端点 | 当前代码 | 目标代码 |
|------|----------|----------|
| GET /api/favorites/list | `favoritesManager.listRecords(containerId, { offset, limit })` | `favoritesManager.listRecords({ offset, limit })` |
| GET /api/favorites/search | `favoritesManager.searchRecords(containerId, { keyword, offset, limit })` | `favoritesManager.searchRecords({ keyword, offset, limit })` |
| GET /api/favorites/check | `favoritesManager.checkUrl(containerId, url)` | `favoritesManager.checkUrl(url)` |
| POST /api/favorites/add | `favoritesManager.addRecord(containerId, { url, title, faviconUrl })` | `favoritesManager.addRecord({ url, title, faviconUrl })` |
| POST /api/favorites/update | `favoritesManager.updateRecord(containerId, id, { title })` | `favoritesManager.updateRecord(id, { title })` |
| POST /api/favorites/delete | `favoritesManager.deleteRecord(containerId, id)` | `favoritesManager.deleteRecord(id)` |
| POST /api/favorites/delete-batch | `favoritesManager.deleteRecords(containerId, ids)` | `favoritesManager.deleteRecords(ids)` |

**新增代码：** 在 `favoritesManager.initDatabase()` 之后调用 `favoritesManager.migrateToGlobal()`

### 3. `src/preload.js` — IPC 接口移除 containerId

**需要修改的接口：**

| 接口 | 当前签名 | 目标签名 |
|------|----------|----------|
| `favoritesCheck` | `(containerId, url)` | `(url)` |
| `favoritesAdd` | `(data)` 含 containerId | `(data)` 不含 containerId |
| `favoritesUpdate` | `(containerId, id, title)` | `(id, title)` |
| `favoritesDelete` | `(containerId, id)` | `(id)` |
| `favoritesDeleteBatch` | `(containerId, ids)` | `(ids)` |
| `favoritesList` | `(data)` 含 containerId | `(data)` 不含 containerId |
| `favoritesSearch` | `(data)` 含 containerId | `(data)` 不含 containerId |
| `favoritesCount` | `(containerId)` | `()` |

### 4. `src/renderer.js` — 收藏按钮移除容器依赖

**需要修改的函数：**

| 函数 | 行号 | 改动 |
|------|------|------|
| `checkBookmarkStatus()` | 218-236 | 移除 `containerId` 参数，调用 `favoritesCheck(url)` |
| `saveBookmark()` | 297-345 | 移除 `containerId` 变量，调用 `favoritesUpdate(id, title)` 和 `favoritesAdd({url, title, faviconUrl})` |
| `removeBookmark()` | 350-377 | 移除 `containerId` 变量，调用 `favoritesDelete(bookmarkId)` |

**所有调用 `checkBookmarkStatus(url, tab.containerId)` 的位置：**
- 行 476：`switchTab()` 中
- 行 668：`bindWebviewEvents()` 的 `did-navigate` 事件

### 5. `src/favorites-page.js` — 收藏页面移除容器感知

**需要修改的代码：**

| 位置 | 当前代码 | 目标代码 |
|------|----------|----------|
| state.containerId | `pageParams.get('container') \|\| 'default'` | 删除 |
| loadFavorites() | 所有 API 调用传 `containerId` | 移除 containerId |
| loadMore() | 所有 API 调用传 `containerId` | 移除 containerId |
| handleBatchDelete() | body 中传 `containerId` | 移除 containerId |
| startInlineEdit() | body 中传 `containerId` | 移除 containerId |

## Risk Assessment

### 低风险
- **数据丢失（D-01）：** 用户已明确接受丢弃旧数据，无风险
- **回滚（D-03）：** 用户明确无需回滚策略
- **UI 变更：** 零视觉变更，纯参数清理

### 中风险
- **迁移失败：** 如果 `migrateToGlobal()` 执行失败，收藏功能不可用
  - **缓解措施：** 迁移逻辑放在 `initDatabase()` 之后，确保数据库连接已建立
  - **恢复方式：** 下次启动自动重试（D-03）

### 无风险
- **性能影响：** 全局表比 per-container 表数据量更大，但 SQLite 单表百万级数据无性能问题
- **并发冲突：** better-sqlite3 是同步 API，无并发问题

## Migration Strategy Details

### 迁移执行流程

```
app.whenReady()
  ↓
historyManager.initDatabase()  // 已有
  ↓
favoritesManager.initDatabase()  // 已有
  ↓
favoritesManager.migrateToGlobal()  // 新增
  ├── 查询所有 favorites_* 表
  ├── DROP TABLE IF EXISTS favorites_work
  ├── DROP TABLE IF EXISTS favorites_personal
  ├── ... (所有旧表)
  ├── CREATE TABLE IF NOT EXISTS favorites (...)
  └── 创建索引
  ↓
containerManager.initContainers()  // 已有
```

### 迁移代码实现

```javascript
/**
 * 迁移到全局收藏表（启动时自动执行）
 * 删除所有 per-container favorites_* 表，创建单一全局 favorites 表
 */
function migrateToGlobal() {
  // 1. 查询所有以 favorites_ 开头的表
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'favorites_%'"
  ).all();

  // 2. 逐个删除旧表
  for (const { name } of tables) {
    db.exec(`DROP TABLE IF EXISTS ${name}`);
    console.log(`[Realm] 已删除旧收藏表: ${name}`);
  }

  // 3. 创建全局表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon_url TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(url)
    );
    CREATE INDEX IF NOT EXISTS idx_favorites_created_at
      ON favorites (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_favorites_url
      ON favorites (url);
  `);

  console.log('[Realm] 收藏表已迁移到全局模式');
}
```

## Common Pitfalls

### Pitfall 1: 忘记移除 preload.js 中的 containerId 参数
**What goes wrong:** preload 层仍然传递 containerId，但 manager 层已移除该参数，导致 IPC 调用参数错位
**Why it happens:** 改动文件多，容易遗漏 preload 层
**How to avoid:** 按照 manager → API → preload → renderer → favorites-page 的顺序逐层修改
**Warning signs:** 运行时报错 "Cannot read properties of undefined"

### Pitfall 2: favorites-page.js 的 URL 参数残留
**What goes wrong:** favorites.html 的 URL 仍包含 `?container=xxx` 参数，但页面不再读取
**Why it happens:** realmUrlToHttp() 函数仍会添加 container 参数
**How to avoid:** 检查 realmUrlToHttp() 函数，移除 container 参数传递
**Warning signs:** URL 中仍有无用的 container 参数（功能不受影响，但不够干净）

### Pitfall 3: 迁移函数执行顺序
**What goes wrong:** migrateToGlobal() 在 initDatabase() 之前调用，db 为 null
**Why it happens:** 代码位置放错
**How to avoid:** 确保在 `favoritesManager.initDatabase()` 之后调用
**Warning signs:** 启动时报错 "Cannot read properties of null"

## Code Examples

### 全局表创建（参考 better-sqlite3 官方文档）

```javascript
// Source: better-sqlite3 API 文档
// https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    favicon_url TEXT DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(url)
  )
`);

// 查询所有表
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'favorites_%'"
).all();

// 删除表
db.exec(`DROP TABLE IF EXISTS ${tableName}`);
```

### 迁移函数调用位置（main.js）

```javascript
// main.js:627-633
// 初始化历史记录数据库
historyManager.initDatabase();

// 初始化收藏夹数据库
favoritesManager.initDatabase();

// 迁移到全局收藏表（启动时自动执行）
favoritesManager.migrateToGlobal();

// 初始化常用网站数据库
frequentSitesManager.initDatabase();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-container favorites 表 | 全局 favorites 表 | Phase 9 | 收藏与容器解耦，数据共享 |

## Assumptions Log

> All claims in this research were verified against the actual codebase — no user confirmation needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**This table is empty:** All claims in this research were verified against the actual codebase.

## Open Questions

1. **realmUrlToHttp() 是否需要移除 container 参数传递？**
   - What we know: 该函数（renderer.js:160-169）会为 realm:// URL 添加 `?container=xxx` 参数
   - What's unclear: 移除后是否影响其他内部页面（如 realm://history）
   - Recommendation: 仅移除 favorites 相关的 container 参数传递，history 页面仍需要 container 参数

2. **迁移函数是否需要处理数据库锁定情况？**
   - What we know: better-sqlite3 是同步 API，单线程执行
   - What's unclear: 如果其他进程（如开发者工具）同时访问数据库
   - Recommendation: 无需特殊处理，SQLite 的 WAL 模式已处理并发读写

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-sqlite3 | favorites-manager.js | ✓ | 已集成 | — |
| Electron | 主进程运行时 | ✓ | 32.x | — |
| Node.js | 主进程运行时 | ✓ | 已安装 | — |

**Missing dependencies with no fallback:** 无

**Missing dependencies with fallback:** 无

## Sources

### Primary (HIGH confidence)
- 代码库实际文件：`favorites-manager.js`、`main.js`、`src/preload.js`、`src/renderer.js`、`src/favorites-page.js`
- CONTEXT.md：用户决策记录
- 09-UI-SPEC.md：前端变更规范

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md：FAV-07/FAV-09/FAV-10 需求定义

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有依赖已集成，无需新增
- Architecture: HIGH — 代码库已读取，改动点明确
- Pitfalls: MEDIUM — 基于代码分析，可能有遗漏的边界情况

**Research date:** 2026-07-25
**Valid until:** 2026-08-25（30 天，项目处于活跃开发期）

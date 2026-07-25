# Phase 7: 收藏夹管理 - Research

**Researched:** 2026-07-25
**Domain:** 收藏夹/书签管理、SQLite 数据存储、Electron IPC 通信
**Confidence:** HIGH

## Summary

Phase 7 实现收藏夹管理功能，允许用户收藏和管理常用页面。核心能力包括：收藏/取消收藏当前页面（工具栏星标按钮）、收藏列表页面（realm://favorites）、编辑收藏标题、删除收藏（批量删除）、搜索收藏、URL 去重、收藏按容器完全隔离。

本阶段复用 Phase 6（浏览历史记录）的架构模式：SQLite 数据库存储、本地 HTTP API 端点、realm:// 内部页面。主要新增文件包括 `favorites-manager.js`（数据层）、`src/favorites.html` + `src/favorites-page.js`（UI 层），以及在 `main.js` 中添加 `/api/favorites/*` API 端点。

**Primary recommendation:** 完全复用 history-manager.js 的架构模式，包括数据库表命名（`favorites_{containerId}`）、WAL 模式、sanitizeContainerId 验证、HTTP API 端点模式。收藏页面 UI 参考 history.html 的结构和样式。

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 使用星标图标：未收藏时空心星标，已收藏时实心星标（金色）
- **D-02:** 首次点击弹出编辑面板，面板内容：标题（可编辑）+ URL（只读）+ 保存/取消按钮
- **D-03:** 已收藏页面再点击星标直接取消收藏（一键切换，不弹确认）
- **D-04:** 收藏按钮放在 URL 栏右侧，与历史记录按钮相邻
- **D-05:** 工具栏添加独立的收藏夹按钮（文件夹图标），点击后在当前 Tab 打开 realm://favorites 内部页面
- **D-06:** 列表使用紧凑列表样式：favicon + 页面标题 + URL + 收藏时间
- **D-07:** 按收藏时间倒序排列（最新收藏在最前面）
- **D-08:** 空状态显示插图和提示文字："暂无收藏，点击星标收藏页面"
- **D-09:** 搜索同时匹配页面标题和 URL，输入关键词后实时过滤（debounce 300ms）
- **D-10:** 搜索结果中匹配的文本用高亮色标出
- **D-11:** 编辑收藏标题使用行内编辑模式（点击标题直接进入编辑，回车或点击其他地方保存）
- **D-12:** 删除收藏使用复选框 + 批量删除模式（与历史记录页面一致），支持全选快捷操作
- **D-13:** 复用现有 better-sqlite3 数据库，新建 favorites 表（共享数据库连接）
- **D-14:** 同一 URL 在同一容器内不能重复收藏，重复收藏时提示"已收藏过该页面"
- **D-15:** 收藏时保存 favicon URL 到数据库，列表直接显示
- **D-16:** 收藏数量不设上限（收藏是用户主动操作，数量通常远少于历史记录）

### Claude's Discretion

- SQLite 数据库 favorites 表的表结构设计
- 具体的 SQL 查询优化策略
- 收藏页面的 CSS 样式细节
- favicon 获取和缓存的降级策略
- 收藏编辑面板的具体 UI 样式
- realm://favorites 协议的路由处理

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FAV-01 | 用户可以收藏当前页面 | 星标按钮 + 编辑面板，参考 Chrome 书签交互 |
| FAV-02 | 用户可以取消收藏已收藏页面 | 已收藏状态点击星标直接取消，D-03 决策 |
| FAV-03 | 用户可以查看收藏列表 | realm://favorites 内部页面，参考 history.html |
| FAV-04 | 用户可以编辑收藏项的标题 | 行内编辑模式，D-11 决策 |
| FAV-05 | 用户可以删除收藏项 | 复选框 + 批量删除，D-12 决策 |
| FAV-06 | 用户可以搜索收藏 | 标题 + URL 匹配，debounce 300ms，D-09/D-10 决策 |
| FAV-07 | 收藏按容器隔离 | 每容器独立表 favorites_{containerId}，复用 history 模式 |
| FAV-08 | 同一 URL 在同一容器内不能重复收藏 | UNIQUE 约束 + 应用层检查，D-14 决策 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 已集成 | SQLite 数据库 | 项目已使用，WAL 模式性能好 |
| electron-store | 已集成 | 配置持久化 | 项目已使用 |
| Electron IPC | 内置 | 主进程-渲染进程通信 | 项目标准通信方式 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto | Node.js 内置 | API token 生成 | HTTP API 鉴权 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 独立 favorites 表 | 共享 history 表 + type 字段 | 独立表更清晰，查询更简单 |
| IPC 直接通信 | HTTP API 端点 | HTTP API 支持 webview guest 访问 |

## Package Legitimacy Audit

> 本阶段不新增外部包，复用项目已有的 better-sqlite3 和 electron-store。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| better-sqlite3 | npm | 8+ years | 500k+/wk | github.com/WiseLibs/better-sqlite3 | OK | 已集成 |
| electron-store | npm | 8+ years | 1M+/wk | github.com/sindresorhus/electron-store | OK | 已集成 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │favorites-manager│  │ history-manager │              │
│  │   (新增模块)     │  │   (参考实现)     │              │
│  └─────────────────┘  └─────────────────┘              │
│           │                    │                        │
│           ▼                    ▼                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SQLite Database                     │   │
│  │  favorites_{containerId}  history_{containerId}  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ HTTP API (/api/favorites/*)
                         │ + IPC (realmAPI)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  UI Layer                        │   │
│  │  - Toolbar: Star button + Folder button          │   │
│  │  - Bookmark edit panel (floating)                │   │
│  │  - Favorites page (realm://favorites)            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── favorites.html         # 收藏夹页面（参考 history.html）
├── favorites-page.js      # 收藏夹页面逻辑（参考 history-page.js）
├── history.html           # 历史记录页面（已有）
├── history-page.js        # 历史记录页面逻辑（已有）
├── renderer.js            # 渲染进程（添加星标按钮逻辑）
├── preload.js             # IPC 接口（添加收藏相关 API）
├── index.html             # 主界面（添加工具栏按钮）
└── styles/
    └── main.css           # 样式（添加收藏相关样式）

main.js                    # 主进程（添加 /api/favorites/* 端点）
favorites-manager.js       # 收藏管理模块（新增，参考 history-manager.js）
history-manager.js         # 历史管理模块（已有）
```

### Pattern 1: 数据库表隔离（复用 history 模式）

**What:** 每个容器使用独立的 SQLite 表存储收藏数据
**When to use:** 需要按容器隔离数据时
**Example:**
```javascript
// Source: history-manager.js (项目已有实现)
function ensureTable(containerId) {
  const id = sanitizeContainerId(containerId);
  const tableName = `favorites_${id}`;

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon_url TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(url)
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at
      ON ${tableName} (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_url
      ON ${tableName} (url);
  `);
}
```

### Pattern 2: HTTP API 端点（webview guest 数据访问）

**What:** 本地 HTTP 服务器提供 JSON API，供 webview guest 页面访问
**When to use:** 内部页面（realm://xxx）需要访问主进程数据时
**Example:**
```javascript
// Source: main.js (项目已有实现)
async function handleFavoritesApi(req, res, reqUrl) {
  // token 鉴权
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  const route = reqUrl.pathname.replace('/api/favorites/', '');

  if (route === 'list' && req.method === 'GET') {
    const containerId = reqUrl.searchParams.get('containerId') || '';
    const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
    const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
    sendJson(res, 200, favoritesManager.listRecords(containerId, { offset, limit }));
    return;
  }

  // ... 其他路由
}
```

### Pattern 3: realm:// URL 转换（webview 加载内部页面）

**What:** 将 realm:// URL 转换为 http://localhost:PORT/ URL
**When to use:** webview 需要加载内部页面时
**Example:**
```javascript
// Source: renderer.js (项目已有实现)
function realmUrlToHttp(url, containerId) {
  if (!state.realmPort || !url.startsWith('realm://')) return url;
  let converted = url.replace(/^realm:\/\//, `http://localhost:${state.realmPort}/`);
  const params = new URLSearchParams();
  if (containerId) params.set('container', containerId);
  if (state.realmToken) params.set('token', state.realmToken);
  const query = params.toString();
  if (query) converted += (converted.includes('?') ? '&' : '?') + query;
  return converted;
}
```

### Anti-Patterns to Avoid

- **直接在 webview 中使用 IPC：** webview guest 的 IPC 会被 assertTrustedSender 拒绝，必须使用 HTTP API
- **使用 innerHTML 渲染用户数据：** 存在 XSS 风险，应使用 textContent
- **硬编码容器 ID：** 必须使用 sanitizeContainerId 验证，防止 SQL 注入
- **忽略 URL 去重：** 必须在数据库层和应用层都做检查

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL 注入防护 | 手动转义字符串 | sanitizeContainerId + 参数化查询 | 项目已有成熟模式 |
| API 鉴权 | 自定义 token 机制 | 复用 REALM_TOKEN | 项目已有实现 |
| 搜索高亮 | 手动字符串拼接 | 正则替换 + escapeHtml | 项目已有实现 |
| 防抖搜索 | 手动 setTimeout | 复用 debounce 函数 | 项目已有实现 |

## Common Pitfalls

### Pitfall 1: webview guest 无法使用 IPC

**What goes wrong:** 在 favorites-page.js 中直接调用 window.realmAPI 会失败
**Why it happens:** webview guest 的 IPC 会被 assertTrustedSender（CR-4）拒绝
**How to avoid:** 使用 HTTP API（/api/favorites/*）访问数据，不使用 IPC
**Warning signs:** 控制台出现"不受信任的 IPC 来源"错误

### Pitfall 2: URL 去重失败

**What goes wrong:** 同一 URL 被重复收藏
**Why it happens:** 仅在应用层检查，没有数据库层约束
**How to avoid:** 在 CREATE TABLE 时添加 UNIQUE(url) 约束，INSERT 时使用 OR IGNORE
**Warning signs:** 收藏列表出现重复项

### Pitfall 3: 容器切换后收藏状态不同步

**What goes wrong:** 切换容器后星标状态未更新
**Why it happens:** 收藏状态检查依赖当前容器 ID，切换后未重新查询
**How to avoid:** 在容器切换事件中重新检查当前页面的收藏状态
**Warning signs:** 星标显示状态与实际收藏状态不一致

### Pitfall 4: XSS 注入风险

**What goes wrong:** 使用 innerHTML 渲染用户输入的标题/URL
**Why it happens:** 收藏标题和 URL 是用户可控数据
**How to avoid:** 始终使用 textContent 渲染，使用 escapeHtml 转义搜索高亮
**Warning signs:** 页面出现意外脚本执行

## Code Examples

### 收藏管理器核心方法

```javascript
// Source: 参考 history-manager.js 模式
/**
 * 添加收藏
 * @param {string} containerId - 容器 ID
 * @param {Object} record - 收藏数据
 * @param {string} record.url - 页面 URL
 * @param {string} [record.title] - 页面标题
 * @param {string} [record.faviconUrl] - favicon URL
 * @returns {{id: number}} 新记录的 ID
 */
function addRecord(containerId, { url, title = '', faviconUrl = '' }) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `favorites_${id}`;

  try {
    const result = db.prepare(`
      INSERT INTO ${tableName} (url, title, favicon_url)
      VALUES (?, ?, ?)
    `).run(url, title, faviconUrl);

    return { id: result.lastInsertRowid };
  } catch (err) {
    // UNIQUE 约束冲突 = URL 已存在
    if (err.message.includes('UNIQUE constraint failed')) {
      return { error: 'duplicate', message: '已收藏过该页面' };
    }
    throw err;
  }
}
```

### 收藏页面 API 调用

```javascript
// Source: 参考 history-page.js 模式
const pageParams = new URLSearchParams(window.location.search);
const apiToken = pageParams.get('token') || '';
const containerId = pageParams.get('container') || 'default';

async function favoritesApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/favorites/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`收藏 API 请求失败: ${res.status}`);
  }
  return res.json();
}
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 无（项目当前没有配置测试） |
| Config file | none |
| Quick run command | `npm test` (未配置) |
| Full suite command | `npm test` (未配置) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FAV-01 | 收藏当前页面 | manual | — | ❌ |
| FAV-02 | 取消收藏 | manual | — | ❌ |
| FAV-03 | 查看收藏列表 | manual | — | ❌ |
| FAV-04 | 编辑收藏标题 | manual | — | ❌ |
| FAV-05 | 删除收藏 | manual | — | ❌ |
| FAV-06 | 搜索收藏 | manual | — | ❌ |
| FAV-07 | 容器隔离 | manual | — | ❌ |
| FAV-08 | URL 去重 | manual | — | ❌ |

### Sampling Rate

- **Per task commit:** 手动测试
- **Per wave merge:** 手动测试
- **Phase gate:** 完整功能测试

### Wave 0 Gaps

- [ ] 测试框架配置（可选，项目当前无测试）
- [ ] 收藏管理器单元测试（可选）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | API token 鉴权（复用 REALM_TOKEN） |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | sanitizeContainerId、参数化查询、escapeHtml |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL 注入 | Tampering | sanitizeContainerId + 参数化查询 |
| XSS 注入 | Information Disclosure | textContent + escapeHtml |
| CSRF/端口扫描 | Elevation of Privilege | REALM_TOKEN 鉴权 |
| 路径遍历 | Information Disclosure | filePath 白名单检查 |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-sqlite3 | 数据存储 | ✓ | 已集成 | — |
| Electron | 应用框架 | ✓ | 32.x | — |
| Node.js | 运行时 | ✓ | — | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none

## Sources

### Primary (HIGH confidence)

- 项目代码库 - history-manager.js、history-page.js、main.js、renderer.js、preload.js
- 项目文档 - CLAUDE.md、CONTEXT.md、UI-SPEC.md、REQUIREMENTS.md

### Secondary (MEDIUM confidence)

- Electron 官方文档 - Session、webview、IPC 通信模式
- better-sqlite3 文档 - WAL 模式、UNIQUE 约束

### Tertiary (LOW confidence)

- Chrome 书签管理器交互模式（参考）

## Assumptions Log

> 所有决策均来自用户讨论（CONTEXT.md）和项目已有实现，无假设性 claim。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **收藏编辑面板的 z-index 层级**
   - What we know: UI-SPEC.md 指定 z-index 1001
   - What's unclear: 是否会与其他面板冲突
   - Recommendation: 按 UI-SPEC.md 实现，测试时验证层级关系

2. **favicon 获取失败的降级策略**
   - What we know: 历史记录页面使用首字符回退
   - What's unclear: 收藏页面是否需要相同策略
   - Recommendation: 复用历史记录页面的 favicon 回退逻辑

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 复用项目已有技术栈
- Architecture: HIGH - 完全参考 Phase 6 实现
- Pitfalls: HIGH - 从 Phase 6 经验总结

**Research date:** 2026-07-25
**Valid until:** 2026-08-25（30 天，项目架构稳定）

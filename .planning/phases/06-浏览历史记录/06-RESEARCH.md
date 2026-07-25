# Phase 6: 浏览历史记录 - Research

**Researched:** 2026-07-25
**Domain:** SQLite 数据存储、Electron 自定义协议、历史记录管理
**Confidence:** HIGH

## Summary

Phase 6 为 Realm Browser 添加浏览历史记录功能，核心能力包括：自动记录页面导航、按容器隔离存储（SQLite）、历史记录列表展示（内部页面 `realm://history`）、搜索过滤、单条/批量删除、FIFO 自动淘汰。

技术方案采用 `better-sqlite3` 作为 SQLite 驱动（同步 API，性能优异），使用 Electron `protocol.handle` 注册 `realm://history` 自定义协议加载内部页面，通过 webview 的 `did-navigate` 和 `page-title-updated` 事件捕获导航数据。存储层按容器使用独立表（`history_{containerId}`），避免跨容器查询污染。

**Primary recommendation:** 使用 better-sqlite3 + Electron protocol.handle 实现，遵循现有模块化架构（history-manager.js 模式与 cookie-manager.js 一致）。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 历史记录写入 | Main Process | — | SQLite 运行在主进程，导航事件需持久化 |
| 历史记录查询/删除 | Main Process | — | 数据库操作在主进程完成 |
| realm:// 协议处理 | Main Process | — | protocol.handle 必须在主进程注册 |
| 历史记录 UI 渲染 | Renderer Process | — | 用户界面交互在渲染进程 |
| 导航事件捕获 | Renderer Process | Main Process | webview 事件在渲染进程监听，通知主进程写入 |
| favicon 获取 | Renderer Process | — | page-favicon-updated 事件在 webview 上触发 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 13.0.1 | SQLite 驱动（同步 API） | 性能最优，同步 API 简化代码，Electron 社区首选 |
| @electron/rebuild | 4.2.0 | 原生模块重编译 | better-sqlite3 包含 C++ 原生代码，必须重编译匹配 Electron Node ABI |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 8.1.0+ | 已有依赖，用于历史记录配置元数据 | 保留天数等配置项 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | sqlite3 (async) | 异步 API 复杂度更高，性能不如 better-sqlite3 |
| better-sqlite3 | electron-store (JSON) | 单文件 JSON 无法支持 10000+ 条目高效查询和分页 |
| better-sqlite3 | IndexedDB (渲染进程) | 渲染进程存储受 webview partition 隔离限制，跨进程共享困难 |

**Installation:**
```bash
npm install better-sqlite3
npm install --save-dev @electron/rebuild
```

**Version verification:**
- better-sqlite3: 13.0.1 (verified via `npm view better-sqlite3 version`) [VERIFIED: npm registry]
- @electron/rebuild: 4.2.0 (verified via `npm view @electron/rebuild version`) [VERIFIED: npm registry]
- Electron: 32.x (verified via package.json) [VERIFIED: project config]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| better-sqlite3 | npm | 8+ years | 2M+/week | github.com/WiseLibs/better-sqlite3 | OK | Approved |
| @electron/rebuild | npm | 5+ years | 3M+/week | github.com/electron/rebuild | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
用户点击历史按钮
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    Renderer Process                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ historyBtn.click()                                       │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │ createTab(containerId, 'realm://history')                │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │ webview 加载 realm://history                             │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │ history.html → history-page.js                           │  │
│  │     │  (通过 IPC 调用主进程)                               │  │
│  │     ▼                                                    │  │
│  │ window.realmAPI.history.search() / .delete() / .clear()  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
        │ IPC
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    Main Process                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ protocol.handle('realm', ...)                            │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │ 返回 history.html 内容                                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ history-manager.js                                       │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │ better-sqlite3 (history.db)                              │  │
│  │     │  每容器独立表: history_{containerId}                │  │
│  │     │  索引: visited_at, url, title                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── history.html           # 历史记录内部页面
├── history-page.js        # 历史记录页面渲染逻辑（运行在 realm://history 上下文）
├── preload.js             # 添加 history API 到 realmAPI
├── renderer.js            # 添加 historyBtn 事件处理
├── index.html             # 添加 historyBtn 按钮
└── styles/
    └── main.css           # 添加历史记录页面样式

main.js                    # 添加 protocol.handle('realm', ...) 注册
history-manager.js         # 历史记录管理模块（新建）
ipc-handlers.js            # 添加 history:* IPC 处理器
```

### Pattern 1: 模块化历史记录管理器

**What:** 独立的 history-manager.js 模块，封装所有 SQLite 操作
**When to use:** 遵循现有 cookie-manager.js / tab-manager.js 模式
**Example:**
```javascript
// Source: 项目现有模式 (cookie-manager.js, tab-manager.js)
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'history.db');
let db = null;

/**
 * 初始化数据库连接和表结构
 */
function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');  // 写入性能优化
  db.pragma('synchronous = NORMAL');
}

/**
 * 确保容器的历史表存在
 * @param {string} containerId - 容器 ID
 */
function ensureTable(containerId) {
  const tableName = `history_${containerId}`;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon_url TEXT DEFAULT '',
      visited_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_visited_at
      ON ${tableName} (visited_at DESC);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_url
      ON ${tableName} (url);
  `);
}
```

### Pattern 2: Electron protocol.handle 注册 realm:// 协议

**What:** 使用 Electron protocol.handle 注册自定义协议
**When to use:** 应用启动时（app.whenReady 之前注册 scheme，之后注册 handler）
**Example:**
```javascript
// Source: https://www.electronjs.org/docs/latest/api/protocol
const { protocol, net } = require('electron');
const path = require('path');

// 在 app.whenReady 之前注册为 privileged scheme
protocol.registerSchemesAsPrivileged([{
  scheme: 'realm',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
  }
}]);

// 在 app.whenReady 之后注册 handler
app.whenReady().then(() => {
  protocol.handle('realm', (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'history') {
      return net.fetch(
        pathToFileURL(path.join(__dirname, 'src/history.html')).toString()
      );
    }
    return new Response('Not Found', { status: 404 });
  });
});
```

### Pattern 3: 导航事件捕获与历史记录写入

**What:** 在渲染进程监听 webview 导航事件，通知主进程写入历史
**When to use:** webview 创建后绑定事件
**Example:**
```javascript
// Source: 项目现有模式 (src/renderer.js bindWebviewEvents)
webview.addEventListener('did-navigate', (e) => {
  // 过滤不记录的 URL (D-23)
  if (!e.url || e.url === 'about:blank') return;
  if (e.url.startsWith('realm://')) return;

  // 获取容器 ID（从 webview partition 推导）
  const containerId = getWebviewContainerId(webview);

  // 异步写入历史（不阻塞 UI）
  window.realmAPI.historyAdd({
    containerId,
    url: e.url,
    title: webview.getTitle() || '',
    visitedAt: Date.now(),
  });
});

webview.addEventListener('page-title-updated', (e) => {
  // 更新最近一条历史记录的标题
  const containerId = getWebviewContainerId(webview);
  if (e.title && state.activeTabId === tabId) {
    window.realmAPI.historyUpdateTitle({
      containerId,
      url: webview.getURL(),
      title: e.title,
    });
  }
});
```

### Pattern 4: 历史记录页面 IPC 通信

**What:** 历史记录页面通过 realmAPI 与主进程通信
**When to use:** history-page.js 加载后初始化
**Example:**
```javascript
// src/history-page.js (运行在 realm://history 上下文)
// 通过 preload 暴露的 history API 进行通信

async function loadHistory() {
  const containerId = await window.realmAPI.getCurrentContainer();
  const records = await window.realmAPI.historyList({
    containerId,
    offset: 0,
    limit: 50,
  });
  renderHistoryGroups(records);
}

async function searchHistory(keyword) {
  const containerId = await window.realmAPI.getCurrentContainer();
  const results = await window.realmAPI.historySearch({
    containerId,
    keyword,
    offset: 0,
    limit: 50,
  });
  renderHistoryGroups(results);
}
```

### Anti-Patterns to Avoid

- **Anti-Pattern: 使用渲染进程直接操作 SQLite**
  better-sqlite3 是 Node.js 原生模块，必须在主进程运行。不要尝试在渲染进程直接 require，所有数据库操作必须通过 IPC 调用主进程完成。

- **Anti-Pattern: 使用单表存储所有容器历史**
  虽然可以通过 container_id 字段过滤，但按容器使用独立表（`history_{containerId}`）可以：1) 避免索引膨胀；2) 简化 FIFO 淘汰逻辑（每表独立计数）；3) 容器删除时直接 DROP TABLE。

- **Anti-Pattern: 在 did-finish-load 事件中记录历史**
  did-finish-load 在页面完全加载后触发，如果页面加载缓慢，用户可能已经导航离开。应在 did-navigate 事件中记录（导航完成即写入）。

- **Anti-Pattern: favicon 存储为 Base64**
  favicon URL 变化频繁，存储 Base64 会显著增加数据库体积。应存储 favicon URL，在渲染时动态加载。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite 数据库操作 | 自定义文件 I/O 序列化 | better-sqlite3 | 成熟的 SQLite 绑定，支持 WAL 模式、事务、索引 |
| 自定义协议处理 | 手动拦截 URL 加载 | Electron protocol.handle | 官方 API，支持 privileged scheme、CORS、Fetch API |
| 搜索高亮 | 字符串 indexOf + 手动插入标签 | 正则表达式 + innerHTML 转义 | 处理边界情况（特殊字符、重叠匹配） |
| 日期分组 | 手动计算日期差 | Date 对象比较 | 标准 API 处理时区、闰年等边界情况 |

**Key insight:** better-sqlite3 的同步 API 在 Electron 主进程中表现优异，无需 async/await 包装，代码更简洁。WAL 模式下并发读写性能接近内存数据库。

## Common Pitfalls

### Pitfall 1: better-sqlite3 原生模块未重编译

**What goes wrong:** 应用启动时崩溃，报 `NODE_MODULE_VERSION` 不匹配错误
**Why it happens:** better-sqlite3 包含 C++ 原生代码，必须针对 Electron 的 Node.js 版本重新编译
**How to avoid:** 安装后执行 `npx @electron/rebuild`，或在 package.json scripts 中添加 `"postinstall": "electron-rebuild"`
**Warning signs:** 开发模式正常但打包后崩溃，或反之

### Pitfall 2: protocol.handle 注册时机错误

**What goes wrong:** realm://history 页面加载失败，显示空白或错误
**Why it happens:** `registerSchemesAsPrivileged` 必须在 `app.whenReady()` 之前调用，`protocol.handle` 必须在 `app.whenReady()` 之后调用
**How to avoid:** 将 scheme 注册放在模块顶层（main.js 文件顶部），handler 注册放在 `app.whenReady().then()` 回调中
**Warning signs:** 控制台报 "Scheme 'realm' is not registered" 错误

### Pitfall 3: 容器 ID 中的特殊字符导致 SQL 注入

**What goes wrong:** 恶意容器 ID 导致 SQL 执行异常
**Why it happens:** 表名使用模板字符串拼接（`history_${containerId}`），如果 containerId 包含特殊字符会破坏 SQL
**How to avoid:** 1) 容器 ID 创建时限制为 `[a-z0-9-]` 字符集；2) 使用 better-sqlite3 的参数化查询（不用于表名，但用于数据值）
**Warning signs:** 创建容器时输入特殊字符后历史记录功能异常

### Pitfall 4: webview 的 page-favicon-updated 事件不触发

**What goes wrong:** 历史记录没有 favicon
**Why it happens:** 部分网站不提供 favicon，或 favicon 通过 CSS 而非 `<link rel="icon">` 设置
**How to avoid:** 1) 监听 `page-favicon-updated` 事件获取 favicon URL；2) 如果事件未触发，尝试从 DOM 查询 `link[rel~=icon]`；3) 使用 Google Favicon API 作为 fallback
**Warning signs:** 大量历史记录条目显示空白 favicon

### Pitfall 5: 数据库文件路径在打包后不正确

**What goes wrong:** 开发模式正常，打包后数据库文件找不到或创建失败
**Why it happens:** 打包后 `__dirname` 指向 app.asar 内部，不可写
**How to avoid:** 使用 `app.getPath('userData')` 获取可写路径，与 electron-store 使用相同目录
**Warning signs:** 打包后应用启动时数据库初始化失败

### Pitfall 6: 大量历史记录导致页面卡顿

**What goes wrong:** 历史记录超过 10000 条时页面渲染缓慢
**Why it happens:** 一次性加载所有记录到 DOM，DOM 节点过多
**How to avoid:** 1) 使用分页加载（每次 50 条）；2) 滚动到底时自动加载下一页；3) 搜索时限制返回结果数量
**Warning signs:** 打开历史记录页面时 UI 冻结 1-2 秒

## Code Examples

### better-sqlite3 基础操作

```javascript
// Source: https://github.com/WiseLibs/better-sqlite3
const Database = require('better-sqlite3');
const db = new Database('history.db', { verbose: console.log });

// WAL 模式（提升并发读写性能）
db.pragma('journal_mode = WAL');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS history_default (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    visited_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_visited_at ON history_default (visited_at DESC);
`);

// 插入数据（参数化查询，防止 SQL 注入）
const insert = db.prepare(
  'INSERT INTO history_default (url, title, visited_at) VALUES (?, ?, ?)'
);
insert.run('https://example.com', 'Example', Date.now());

// 查询数据
const records = db.prepare(
  'SELECT * FROM history_default ORDER BY visited_at DESC LIMIT 50'
).all();

// 删除数据
db.prepare('DELETE FROM history_default WHERE id = ?').run(123);

// 计数
const count = db.prepare('SELECT COUNT(*) as count FROM history_default').get();
```

### Electron protocol.handle 注册

```javascript
// Source: https://www.electronjs.org/docs/latest/api/protocol
const { protocol, net } = require('electron');
const { pathToFileURL } = require('url');

// 必须在 app.whenReady 之前调用
protocol.registerSchemesAsPrivileged([{
  scheme: 'realm',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
  }
}]);

// 在 app.whenReady 之后调用
protocol.handle('realm', (request) => {
  const url = new URL(request.url);
  switch (url.hostname) {
    case 'history':
      return net.fetch(
        pathToFileURL(path.join(__dirname, 'src/history.html')).toString()
      );
    default:
      return new Response('Not Found', { status: 404 });
  }
});
```

### webview 导航事件监听

```javascript
// Source: 项目现有模式 (src/renderer.js bindWebviewEvents)
webview.addEventListener('did-navigate', (e) => {
  // 过滤内部页面和空白页 (D-23)
  if (!e.url || e.url === 'about:blank' || e.url.startsWith('realm://')) {
    return;
  }

  // 异步写入历史（不阻塞 UI）
  window.realmAPI.historyAdd({
    containerId: state.currentContainer,
    url: e.url,
    title: webview.getTitle() || '',
    visitedAt: Date.now(),
  }).catch(err => console.error('[Realm] 历史记录写入失败:', err));
});
```

### 搜索高亮实现

```javascript
/**
 * 高亮搜索关键词
 * @param {string} text - 原始文本
 * @param {string} keyword - 搜索关键词
 * @returns {string} 包含高亮 HTML 的文本
 */
function highlightText(text, keyword) {
  if (!keyword) return escapeHtml(text);

  const escaped = escapeHtml(text);
  const escapedKeyword = escapeHtml(keyword);
  const regex = new RegExp(
    `(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi'
  );
  return escaped.replace(regex, '<span class="history-highlight">$1</span>');
}

/**
 * 转义 HTML 特殊字符（防 XSS）
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### FIFO 自动淘汰实现

```javascript
/**
 * 检查并执行 FIFO 淘汰
 * @param {string} containerId - 容器 ID
 */
function enforceLimit(containerId) {
  const tableName = `history_${containerId}`;
  const MAX_RECORDS = 10000;

  const count = db.prepare(
    `SELECT COUNT(*) as count FROM ${tableName}`
  ).get();

  if (count.count > MAX_RECORDS) {
    const excess = count.count - MAX_RECORDS;
    db.prepare(`
      DELETE FROM ${tableName} WHERE id IN (
        SELECT id FROM ${tableName} ORDER BY visited_at ASC LIMIT ?
      )
    `).run(excess);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| registerFileProtocol (callback) | protocol.handle (Promise) | Electron 25.0.0 | 更现代的 API，支持 async/await |
| registerInterceptFileProtocol | protocol.handle 统一处理 | Electron 25.0.0 | 简化协议注册代码 |
| webview new-window 事件 | setWindowOpenHandler | Electron 32.0.0 | webview 不再触发 new-window |

**Deprecated/outdated:**
- `registerFileProtocol` / `registerBufferProtocol` / `registerStringProtocol` — 在 Electron 25.0.0 后被 `protocol.handle` 取代
- `interceptFileProtocol` / `interceptBufferProtocol` 等 — 同上

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | better-sqlite3 13.0.1 与 Electron 32.x 兼容 | Standard Stack | 需要降级或使用其他版本 |
| A2 | 容器 ID 格式限制为 `[a-z0-9-]` | Common Pitfalls | 需要在容器创建时添加验证 |
| A3 | 每容器 10000 条上限足以满足用户需求 | Architecture | 可调整上限或改为基于时间的淘汰 |
| A4 | webview 的 did-navigate 事件在所有导航场景下都会触发 | Code Examples | 需要补充其他事件监听（如 did-start-navigation） |

**如果此表为空:** 所有声明均已验证或引用 — 无需用户确认。

## Open Questions

1. **postinstall 脚本冲突**
   - What we know: 现有 postinstall.js 用于替换 Electron 图标，better-sqlite3 需要 electron-rebuild
   - What's unclear: 是否需要合并 postinstall 脚本
   - Recommendation: 在现有 postinstall.js 末尾添加 electron-rebuild 调用，或使用单独的 rebuild 脚本

2. **数据库文件备份**
   - What we know: history.db 存储在 userData 目录
   - What's unclear: 是否需要支持数据库备份/恢复
   - Recommendation: Phase 6 不实现，后续版本考虑

3. **历史记录导出**
   - What we know: 需求中未包含导出功能
   - What's unclear: 是否需要导出为 CSV/JSON
   - Recommendation: Phase 6 不实现，后续版本考虑

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | better-sqlite3 编译 | ✓ | — | — |
| npm | 包管理 | ✓ | — | — |
| Electron 32.x | 运行时 | ✓ | 32.x | — |
| better-sqlite3 | SQLite 驱动 | 需安装 | 13.0.1 | 无（核心依赖） |
| @electron/rebuild | 原生模块重编译 | 需安装 | 4.2.0 | 手动编译 |

**Missing dependencies with no fallback:**
- better-sqlite3 — 必须安装，无内置替代

**Missing dependencies with fallback:**
- @electron/rebuild — 可以使用 `npm rebuild better-sqlite3 --build-from-source` 替代

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未检测到测试框架 |
| Config file | none — see Wave 0 |
| Quick run command | `npm test` (需先配置) |
| Full suite command | `npm test` (需先配置) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-01 | 自动记录页面 URL 和标题 | manual | — | ❌ Wave 0 |
| HIST-02 | 历史记录按容器隔离存储 | manual | — | ❌ Wave 0 |
| HIST-03 | 查看当前容器历史记录列表 | manual | — | ❌ Wave 0 |
| HIST-04 | 搜索历史记录 | manual | — | ❌ Wave 0 |
| HIST-05 | 删除单条历史记录 | manual | — | ❌ Wave 0 |
| HIST-06 | 清空当前容器历史记录 | manual | — | ❌ Wave 0 |
| HIST-07 | 历史记录自动清理（FIFO） | manual | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动测试（无自动化测试框架）
- **Per wave merge:** 手动验证所有 HIST 需求
- **Phase gate:** 完整 UAT 验收

### Wave 0 Gaps
- [ ] 测试框架配置（项目当前无测试）
- [ ] 手动测试用例文档

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 无需认证 |
| V3 Session Management | no | 使用 Electron Session API（已有） |
| V4 Access Control | no | 容器隔离通过 Session partition 实现 |
| V5 Input Validation | yes | 容器 ID 白名单验证、搜索关键词转义 |
| V6 Cryptography | no | 无需加密 |

### Known Threat Patterns for SQLite + Electron

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL 注入（容器 ID 拼接） | Tampering | 容器 ID 限制为 `[a-z0-9-]`，表名使用白名单验证 |
| XSS（搜索高亮） | Tampering | innerHTML 前转义所有用户输入 |
| 历史记录泄露 | Information Disclosure | 按容器隔离存储，不同容器无法互相访问 |

## Sources

### Primary (HIGH confidence)
- Electron protocol.handle API: https://www.electronjs.org/docs/latest/api/protocol
- better-sqlite3 GitHub: https://github.com/WiseLibs/better-sqlite3
- Electron webview tag: https://www.electronjs.org/docs/latest/api/webview-tag

### Secondary (MEDIUM confidence)
- 项目现有代码模式（cookie-manager.js, tab-manager.js, ipc-handlers.js）
- UI-SPEC.md 设计契约

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — better-sqlite3 和 protocol.handle 均为成熟 API
- Architecture: HIGH — 遵循项目现有模块化模式
- Pitfalls: MEDIUM — 部分边界情况需要实际测试验证

**Research date:** 2026-07-25
**Valid until:** 2026-08-25 (30 天，Electron 和 better-sqlite3 均为稳定版本)

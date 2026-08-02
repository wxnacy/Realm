# Phase 23: 智能上下文引用 + 全文检索 - Research

**Researched:** 2026-08-02
**Domain:** AI 上下文注入、FTS5 全文检索、Electron webview 内容提取
**Confidence:** HIGH

## Summary

Phase 23 在 Realm Browser 的 AI 聊天面板中引入 @ 引用机制，允许用户选择特定标签页作为 AI 对话的上下文，并在 favorites-manager 中新增 FTS5 全文检索能力。

核心发现：
1. **AI 聊天系统已成熟**：`ai-manager.js` 基于 pi-agent-core SDK，工具注册模式清晰（`_buildRealmTools()`），系统提示词注入路径明确（`REALM_SYSTEM_PROMPT` + `agent.prompt(message)`）。
2. **标签页数据已可用**：`tab:list` IPC 通道已存在，返回 `{id, containerId, url, title}`；`container:list` 返回 `{id, name, color}`。@ 选择器可直接复用。
3. **webview 内容提取有两条路径**：CDP 路径（`cdp-manager.js` 的 `attachForAI` + `Runtime.evaluate`）仅支持活跃标签页；webview 路径（`webview.executeJavaScript()`）支持任意标签页，是 @ 引用的推荐方案。
4. **FTS5 中文分词采用预分词方案**：nodejieba 在写入/查询时预分词（用空格连接），FTS5 使用默认 `unicode61` tokenizer，无需编写 C 扩展。
5. **better-sqlite3 原生支持 FTS5**：版本 13.0.2 已包含 FTS5 扩展，可直接 `CREATE VIRTUAL TABLE ... USING fts5()`。

**Primary recommendation:** 使用 webview.executeJavaScript() + Readability 提取任意标签页内容（非 CDP），FTS5 使用 nodejieba 预分词 + unicode61 tokenizer 的组合方案。

## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: 浮动面板触发 -- 输入 @ 后弹出浮动面板
- D-02: 多选模式 -- 可同时选择多个标签页
- D-03: Pill 确认 -- 选中标签页以 pill/chip 形式显示
- D-04: 仅 @ 触发 -- 只有输入 @ 字符后才触发
- D-05: 复用 read_page_content -- 复用 CDP + Readability 逻辑
- D-06: 分块注入 -- 每个标签页作为独立上下文块
- D-07: 按标签页独立截断 -- 每个最多 102,400 字符
- D-08: 系统提示词注入 -- 引用内容注入到系统提示词
- D-09: jieba 中文分词 -- 使用 nodejieba
- D-10: 索引标题+URL -- FTS5 仅索引 title 和 url
- D-11: 启动时全量构建 -- 启动时检测并构建索引
- D-12: 默认 50 条 -- search_favorites_fulltext 默认返回 50 条
- D-13: 跨容器可见 -- @ 选择器显示所有容器的标签页
- D-14: 显示容器标识 -- 每个标签页显示容器颜色和名称

### Claude's Discretion
无

### Deferred Ideas (OUT OF SCOPE)
None

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | @ mention tab UI (input + tab selector panel, multi-tab support) | 浮动面板 + Pill 组件，复用现有 AI 输入框区域 |
| CTX-02 | ai:prompt-with-context IPC channel | 新增 IPC 通道，传递 message + referencedTabs 数组 |
| CTX-03 | AI context injection (inject referenced tab content into AI system prompt) | 修改 REALM_SYSTEM_PROMPT 或 agent.prompt 调用 |
| CTX-04 | FTS5 full-text search index extension | better-sqlite3 FTS5 + nodejieba 预分词 |
| CTX-05 | search_favorites_fulltext tool (AI can search favorites) | 在 _buildRealmTools() 中注册新工具 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| @ 引用 UI (浮动面板 + Pill) | Renderer Process | -- | DOM 操作、用户交互、状态管理 |
| 标签页内容提取 | Renderer Process (webview) | -- | webview.executeJavaScript() 在 guest 上下文执行 |
| AI 上下文注入 | Main Process (ai-manager) | -- | 系统提示词构建、agent.prompt 调用 |
| FTS5 索引管理 | Main Process (favorites-manager) | -- | better-sqlite3 同步 API，数据库操作 |
| AI 工具注册 | Main Process (ai-manager) | -- | _buildRealmTools() 工具列表 |
| IPC 通信 | Preload Script | Main Process | contextBridge 安全暴露 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 13.0.2 | SQLite 绑定（含 FTS5） | 已在项目中，原生支持 FTS5 |
| nodejieba | 3.5.8 | 中文分词 | D-09 决策，jieba 算法业界标准 |
| @mozilla/readability | 0.6.0 | 页面内容提取 | 已在项目中，Phase 22 引入 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pi-agent-core | 0.82.1 | AI Agent 框架 | 已在项目中，工具注册模式 |
| electron-store | 8.1.0 | 配置持久化 | 已在项目中 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nodejieba 预分词 | 自定义 FTS5 C tokenizer | C 扩展复杂度高，预分词方案简单可靠 |
| webview.executeJavaScript() | CDP attachForAI | CDP 仅支持活跃标签页，webview 支持任意标签页 |
| 新 IPC ai:prompt-with-context | 扩展 ai:prompt | 新通道更清晰，不影响现有调用 |

**Installation:**
```bash
npm install nodejieba
```

**Version verification:**
```bash
npm view nodejieba version  # 3.5.8
npm view better-sqlite3 version  # 13.0.2 (already installed)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| nodejieba | npm | 10+ yrs | 30K+/wk | github.com/yanyiwu/nodejieba | [OK] | Approved |
| better-sqlite3 | npm | 8+ yrs | 2M+/wk | github.com/WiseLibs/better-sqlite3 | [OK] | Already installed |
| @mozilla/readability | npm | 5+ yrs | 500K+/wk | github.com/mozilla/readability | [OK] | Already installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
用户输入 @
    │
    ▼
┌─────────────────────────────────────────────────┐
│ Renderer Process (renderer.js)                   │
│                                                  │
│  1. 检测 @ 字符 → 弹出浮动面板                    │
│  2. 用户选择标签页 → 更新 Pill 状态               │
│  3. 用户发送消息 →                                │
│     a. webview.executeJavaScript() 提取内容       │
│     b. IPC: ai:prompt-with-context               │
│        { message, referencedTabs: [{tabId,       │
│          title, url, content}] }                  │
└─────────────────────┬───────────────────────────┘
                      │ IPC
                      ▼
┌─────────────────────────────────────────────────┐
│ Main Process (ai-manager.js)                     │
│                                                  │
│  1. 接收 message + referencedTabs                │
│  2. 构建增强系统提示词:                            │
│     REALM_SYSTEM_PROMPT +                        │
│     <referenced-tab title=url>content</...>      │
│  3. agent.prompt(enhancedMessage)                │
│  4. AI 回复 → 广播到渲染进程                      │
└─────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── renderer.js          # @ 触发逻辑、浮动面板、Pill 管理
├── index.html           # @ 浮动面板 HTML 结构
├── styles/main.css      # @ 面板、Pill 样式
└── preload.js           # 新增 ai.promptWithContext

ai-manager.js            # search_favorites_fulltext 工具
favorites-manager.js     # FTS5 虚拟表、触发器、searchFulltext()
ipc-handlers.js          # ai:prompt-with-context handler
```

### Pattern 1: @ 引用状态管理

**What:** 在 renderer.js 的 state 对象中管理 @ 引用的选中状态
**When to use:** 所有 @ 引用相关的 UI 状态
**Example:**
```javascript
// 在 state 对象中添加
const state = {
  // ... 现有状态 ...
  // @ 引用状态
  contextPickerOpen: false,       // 浮动面板是否打开
  contextPickerSearch: '',        // 搜索关键字
  referencedTabs: [],             // 选中的标签页 [{tabId, title, url, containerId, containerName, containerColor}]
};
```

### Pattern 2: webview 内容提取

**What:** 通过 webview.executeJavaScript() 在 guest 页面上下文执行 Readability
**When to use:** 读取任意标签页（非活跃）的页面内容
**Example:**
```javascript
// renderer.js 中提取 webview 内容
async function extractWebviewContent(webviewEl) {
  const readabilityScript = await fetch('/path/to/readability-bundle.js').then(r => r.text());
  const extractScript = `
    (function() {
      try {
        ${readabilityScript}
        const doc = document.cloneNode(true);
        const reader = new Readability(doc);
        const article = reader.parse();
        return JSON.stringify({
          title: document.title,
          url: window.location.href,
          content: article ? article.textContent : ''
        });
      } catch(e) {
        return JSON.stringify({ title: document.title, url: window.location.href, content: '' });
      }
    })()
  `;
  const result = await webviewEl.executeJavaScript(extractScript);
  return JSON.parse(result);
}
```

### Pattern 3: FTS5 预分词

**What:** 使用 nodejieba 预分词后存入 FTS5 虚拟表
**When to use:** 写入和查询 FTS5 索引时
**Example:**
```javascript
const nodejieba = require('nodejieba');

// 写入时预分词
function segmentForFts5(text) {
  return nodejieba.cut(text).join(' ');
}

// 插入索引
const segmented = segmentForFts5(title + ' ' + url);
db.prepare('INSERT INTO favorites_fts(rowid, content) VALUES (?, ?)').run(id, segmented);

// 查询时预分词
const querySegmented = segmentForFts5(keyword);
const results = db.prepare('SELECT * FROM favorites_fts WHERE favorites_fts MATCH ?').all(querySegmented);
```

### Pattern 4: AI 工具注册

**What:** 在 _buildRealmTools() 中注册新工具
**When to use:** 添加 search_favorites_fulltext 工具
**Example:**
```javascript
// ai-manager.js _buildRealmTools() 中添加
{
  name: 'search_favorites_fulltext',
  label: '全文搜索收藏',
  description: '使用全文检索搜索收藏夹中的页面，支持中文分词',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      limit: {
        type: 'number',
        description: '返回结果数量（可选，默认 50）',
      },
    },
    required: ['query'],
  },
  execute: async (toolCallId, params) => {
    const { query, limit = 50 } = params;
    if (!query) throw new Error('搜索关键词不能为空');
    const results = favoritesManager.searchFulltext({ keyword: query, limit });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ results, count: results.length }, null, 2),
      }],
      details: { count: results.length },
    };
  },
},
```

### Anti-Patterns to Avoid

- **不要在 renderer.js 中使用 CDP 读取非活跃标签页内容**：CDP attach 需要 webContents ID，非活跃标签页的 ID 主进程不维护。使用 webview.executeJavaScript() 替代。
- **不要在 FTS5 索引中存储原始中文文本**：FTS5 unicode61 tokenizer 不支持中文分词，必须预分词后存储。
- **不要在 ai:prompt IPC 中直接传递引用内容**：使用新的 ai:prompt-with-context 通道，保持现有通道不变。
- **不要在渲染进程直接调用 nodejieba**：nodejieba 是 Node.js 原生模块，仅在主进程可用。渲染进程提取内容后通过 IPC 传递。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 中文分词 | 自己实现分词算法 | nodejieba | jieba 算法成熟，支持新词发现 |
| 页面内容提取 | 自己解析 DOM | @mozilla/readability | Mozilla 维护，覆盖 edge cases |
| FTS5 tokenizer | C 扩展 | nodejieba 预分词 | C 扩展维护成本高，预分词方案简单 |
| AI 工具框架 | 自己实现工具调用 | pi-agent-core | 已在项目中，工具注册模式成熟 |

## Runtime State Inventory

> 本阶段为新增功能，非 rename/refactor，无运行时状态迁移需求。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | favorites 表已有数据 | FTS5 索引需全量构建（D-11） |
| Live service config | 无 | -- |
| OS-registered state | 无 | -- |
| Secrets/env vars | 无 | -- |
| Build artifacts | nodejieba 原生模块 | 需 @electron/rebuild 重新编译 |

## Common Pitfalls

### Pitfall 1: webview.executeJavaScript() 安全限制
**What goes wrong:** webview 的 `executeJavaScript()` 在某些安全策略下可能失败
**Why it happens:** webview 启用了 `contextIsolation=yes`，guest 页面可能有 CSP 限制
**How to avoid:** 在 try-catch 中调用，失败时回退到仅返回 title + url（无正文）
**Warning signs:** executeJavaScript 返回 rejected promise

### Pitfall 2: nodejieba 原生模块 Electron 兼容性
**What goes wrong:** nodejieba 是原生 addon，在 Electron 中无法加载
**Why it happens:** 原生模块需要为 Electron 的 Node.js 版本重新编译
**How to avoid:** 确保 `@electron/rebuild` 在 postinstall 中运行，或手动运行 `npx electron-rebuild`
**Warning signs:** `Error: The module was compiled against a different Node.js version`

### Pitfall 3: FTS5 索引与 favorites 表不同步
**What goes wrong:** 添加/删除收藏后 FTS5 索引未更新
**Why it happens:** 触发器未正确创建或遗漏了某些操作
**How to avoid:** 使用 SQLite 触发器自动维护索引（INSERT/UPDATE/DELETE 触发器）
**Warning signs:** 搜索结果与实际收藏不一致

### Pitfall 4: 大量标签页时 webview 内容提取阻塞 UI
**What goes wrong:** 同时提取多个 webview 内容导致 UI 卡顿
**Why it happens:** executeJavaScript 是异步的，但大量并发调用仍会占用资源
**How to avoid:** 限制并发提取数量（建议最多 5 个），或使用 Promise.allSettled 并行但有限制
**Warning signs:** 发送消息后 UI 响应变慢

### Pitfall 5: @ 触发与现有快捷键冲突
**What goes wrong:** 输入 @ 时触发了其他功能
**Why it happens:** 某些输入法或键盘布局下 @ 键的 keycode 不同
**How to avoid:** 监听 `input` 事件而非 `keydown` 事件来检测 @ 字符
**Warning signs:** @ 面板在某些输入法下不弹出

## Code Examples

### 从 webview 提取页面内容（渲染进程）
```javascript
/**
 * 从 webview 元素提取页面可读内容
 * 使用 Readability 提取正文，失败时回退到基本元信息
 *
 * @param {HTMLElement} webviewEl - webview DOM 元素
 * @param {string} readabilityScript - Readability IIFE 脚本内容
 * @returns {Promise<{title: string, url: string, content: string}>}
 */
async function extractWebviewContent(webviewEl, readabilityScript) {
  const extractScript = `
    (function() {
      try {
        ${readabilityScript}
        var doc = document.cloneNode(true);
        var reader = new Readability(doc);
        var article = reader.parse();
        return JSON.stringify({
          title: document.title || '',
          url: window.location.href || '',
          content: article ? article.textContent : ''
        });
      } catch(e) {
        return JSON.stringify({
          title: document.title || '',
          url: window.location.href || '',
          content: ''
        });
      }
    })()
  `;
  try {
    const result = await webviewEl.executeJavaScript(extractScript);
    return typeof result === 'string' ? JSON.parse(result) : result;
  } catch (err) {
    console.error('[Realm Renderer] webview 内容提取失败:', err);
    return { title: webviewEl.getTitle() || '', url: webviewEl.getURL() || '', content: '' };
  }
}
```

### FTS5 虚拟表创建和触发器（主进程）
```javascript
/**
 * 创建 FTS5 全文检索索引
 * 使用 nodejieba 预分词，unicode61 tokenizer 处理空格分隔的 token
 */
function ensureFts5Index() {
  // 创建 FTS5 虚拟表
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS favorites_fts USING fts5(
      content,
      tokenize='unicode61'
    );
  `);

  // 创建触发器：插入收藏时自动更新索引
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS favorites_ai AFTER INSERT ON favorites BEGIN
      INSERT INTO favorites_fts(rowid, content)
      VALUES (new.id, new.title || ' ' || new.url);
    END;
  `);

  // 创建触发器：删除收藏时自动更新索引
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS favorites_ad AFTER DELETE ON favorites BEGIN
      INSERT INTO favorites_fts(favorites_fts, rowid, content)
      VALUES ('delete', old.id, old.title || ' ' || old.url);
    END;
  `);

  // 创建触发器：更新收藏时自动更新索引
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS favorites_au AFTER UPDATE ON favorites BEGIN
      INSERT INTO favorites_fts(favorites_fts, rowid, content)
      VALUES ('delete', old.id, old.title || ' ' || old.url);
      INSERT INTO favorites_fts(rowid, content)
      VALUES (new.id, new.title || ' ' || new.url);
    END;
  `);
}
```

### AI 系统提示词注入（主进程）
```javascript
/**
 * 构建带引用上下文的消息
 * 将引用的标签页内容注入到用户消息前缀
 *
 * @param {string} message - 用户原始消息
 * @param {Array} referencedTabs - 引用的标签页 [{title, url, content}]
 * @returns {string} 增强后的消息
 */
function buildMessageWithContext(message, referencedTabs) {
  if (!referencedTabs || referencedTabs.length === 0) {
    return message;
  }

  const contextBlocks = referencedTabs.map((tab, i) => {
    const truncated = tab.content && tab.content.length > MAX_CONTENT_SIZE
      ? tab.content.substring(0, MAX_CONTENT_SIZE) + `\n[截断：原始长度 ${tab.content.length} 字符]`
      : (tab.content || '');
    return `<referenced-tab index="${i + 1}" title="${tab.title}" url="${tab.url}">
${truncated}
</referenced-tab>`;
  }).join('\n\n');

  return `${contextBlocks}\n\n用户消息：${message}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 仅 LIKE 模式搜索收藏 | FTS5 全文检索 + LIKE 并存 | Phase 23 | 中文搜索准确度提升 |
| AI 仅读取活跃标签页 | @ 引用任意标签页 | Phase 23 | AI 上下文更丰富 |
| 无标签页内容注入 | 系统提示词注入引用内容 | Phase 23 | AI 可理解多页面内容 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | better-sqlite3 13.0.2 内置 FTS5 支持 | Standard Stack | 需要检查编译选项，可能需要手动启用 |
| A2 | nodejieba 3.5.8 兼容 Electron 32 的 Node.js 版本 | Package Legitimacy | 可能需要降级或寻找替代方案 |
| A3 | webview.executeJavaScript() 在 contextIsolation=yes 下可执行内联脚本 | Architecture | 可能需要通过 preload 注入 |
| A4 | FTS5 unicode61 tokenizer 可处理 nodejieba 预分词后的中文+空格文本 | Code Examples | 可能需要测试验证 |

## Open Questions

1. **webview.executeJavaScript() 在 contextIsolation=yes 下的行为**
   - What we know: webview 配置了 `contextIsolation=yes`，guest 页面与 preload 脚本隔离
   - What's unclear: executeJavaScript() 是否仍然可以在 guest 上下文执行任意脚本
   - Recommendation: 在实现时先做 POC 验证，失败时回退到 CDP 方案（仅活跃标签页）

2. **nodejieba 在 Electron 32 中的兼容性**
   - What we know: nodejieba 是原生 addon，依赖 node-addon-api
   - What's unclear: Electron 32 的 Node.js 版本是否与 nodejieba 预编译二进制兼容
   - Recommendation: 使用 @electron/rebuild 重新编译，或在 postinstall 中添加 rebuild 步骤

3. **FTS5 索引构建时机**
   - What we know: D-11 要求启动时检测并构建索引
   - What's unclear: 是否应该在 favorites-manager 初始化时同步构建，还是异步延迟构建
   - Recommendation: 在 ensureTable() 末尾同步构建（favorites 数据量通常不大）

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-sqlite3 | FTS5 索引 | ✓ | 13.0.2 | -- |
| nodejieba | 中文分词 | 需安装 | 3.5.8 | 内置 unicode61（中文分词效果差） |
| @mozilla/readability | 页面内容提取 | ✓ | 0.6.0 | -- |
| Electron 32 | 运行时 | ✓ | 32.x | -- |
| @electron/rebuild | 原生模块重编译 | ✓ | 4.2.0 | -- |

**Missing dependencies with no fallback:**
- nodejieba（如不安装，中文全文检索效果极差）

**Missing dependencies with fallback:**
- 无

## Validation Architecture

> workflow.nyquist_validation 未在 config.json 中显式设置，视为启用。

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未检测到测试框架 |
| Config file | none -- see Wave 0 |
| Quick run command | `npm test` (需先配置) |
| Full suite command | `npm test` (需先配置) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | @ 引用浮动面板 UI | manual-only | -- | -- |
| CTX-02 | ai:prompt-with-context IPC | unit | 需配置测试框架 | ❌ Wave 0 |
| CTX-03 | AI 上下文注入 | integration | 需配置测试框架 | ❌ Wave 0 |
| CTX-04 | FTS5 索引创建和触发器 | unit | 需配置测试框架 | ❌ Wave 0 |
| CTX-05 | search_favorites_fulltext 工具 | unit | 需配置测试框架 | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动验证 UI 交互
- **Per wave merge:** 手动验证完整流程
- **Phase gate:** 全部 CTX 需求通过 UAT

### Wave 0 Gaps
- [ ] 项目无测试框架，建议至少为 FTS5 和工具注册添加单元测试
- [ ] `tests/test-favorites-fts5.js` -- FTS5 索引 CRUD 测试
- [ ] `tests/test-ai-tools.js` -- AI 工具注册和调用测试

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | IPC 参数校验、SQL 注入防护（better-sqlite3 参数化查询） |
| V6 Cryptography | no | -- |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL 注入（FTS5 查询） | Tampering | better-sqlite3 参数化查询，不拼接 SQL |
| XSS（webview 内容注入） | Elevation of Privilege | DOMPurify 消毒 AI 回复中的 HTML |
| IPC 注入（伪造 referencedTabs） | Tampering | assertTrustedSender 校验发送者 |

## Sources

### Primary (HIGH confidence)
- 项目源码 `ai-manager.js` -- AI Manager 完整实现，工具注册模式
- 项目源码 `favorites-manager.js` -- 收藏管理器，数据库结构
- 项目源码 `renderer.js` -- AI 聊天面板 UI 实现
- 项目源码 `ipc-handlers.js` -- IPC 通道注册
- 项目源码 `preload.js` -- contextBridge API 定义
- 项目源码 `cdp-manager.js` -- CDP 调试器管理
- npm registry `nodejieba@3.5.8` -- 中文分词库
- npm registry `better-sqlite3@13.0.2` -- SQLite 绑定

### Secondary (MEDIUM confidence)
- SQLite FTS5 文档 -- 虚拟表语法和触发器

### Tertiary (LOW confidence)
- webview.executeJavaScript() 在 contextIsolation=yes 下的行为（需 POC 验证）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 所有依赖已在项目中或为成熟 npm 包
- Architecture: HIGH -- 基于现有代码模式扩展，无架构变更
- Pitfalls: MEDIUM -- webview 安全限制和 nodejieba 兼容性需实际验证

**Research date:** 2026-08-02
**Valid until:** 2026-08-16 (14 天，Phase 23 实现期间有效)

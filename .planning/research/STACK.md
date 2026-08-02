# Stack Research: AI CDP 增强 + Tabbrowser 功能集成 (v2.1)

**Domain:** Electron 多容器浏览器 - AI Agent 深度控制
**Researched:** 2026-08-02
**Confidence:** HIGH

## Recommended Stack

### 核心发现：无需新增依赖

v2.1 里程碑的所有功能都可以用现有技术栈实现。这是本次研究最重要的结论。

### 现有技术栈（已验证可用）

| Technology | Version | Purpose | 状态 |
|------------|---------|---------|------|
| Electron | 32.x | CDP (webContents.debugger) + 主进程/渲染进程架构 | 已集成 |
| better-sqlite3 | 11.7.0 | FTS5 全文检索（SQLite 3.46.x 内置） | 已集成 |
| cheerio | 1.2.0 | HTML 解析（CDP 取回 HTML 后的服务端解析备选） | 已集成 |
| electron-store | 8.1.0 | 配置持久化（CDP 管理器配置、AI 配置） | 已集成 |
| pi-agent-core | 0.82.1 | AI Agent 框架（工具注册、对话管理、流式输出） | 已集成 |
| pi-ai | 0.82.1 | LLM 统一 API 层（38+ 提供商） | 已集成 |

### CDP 域需求分析

当前 `cdp-manager.js` 仅使用 `Network` 域（请求抓取）。新功能需要扩展到以下 CDP 域：

| CDP Domain | Methods | 用途 | 复杂度 |
|------------|---------|------|--------|
| **Runtime** | `evaluate`, `callFunctionOn` | 在页面上下文执行 JS（最灵活的 DOM 交互方式） | 低 |
| **DOM** | `getDocument`, `getOuterHTML`, `querySelectorAll` | 读取页面 DOM 结构 | 低 |
| **Page** | `navigate`, `reload` | 页面导航控制 | 低 |
| **Network** (已有) | 现有方法 | 继续用于请求抓取 | 已实现 |

**关键决策：优先使用 `Runtime.evaluate`**

`Runtime.evaluate` 可以在页面上下文中执行任意 JavaScript，这意味着：
- 读取页面内容：`document.title`, `document.body.innerText`, `document.querySelector('article')?.textContent`
- 提取链接：`Array.from(document.querySelectorAll('a[href]')).map(a => ({text: a.textContent, href: a.href}))`
- 点击链接：`document.querySelector('a[href="..."]').click()`
- 填写表单：`document.querySelector('input[name="email"]').value = '...'`

这比用 DOM 域逐节点操作更简单、更强大。cheerio 作为备选方案，用于需要服务端解析的场景（如页面尚未加载完成时解析缓存的 HTML）。

### SQLite FTS5 全文检索

better-sqlite3 11.7.0 内置 SQLite 3.46.x，FTS5 默认编译启用。

```sql
-- FTS5 虚拟表示例（用于收藏全文检索）
CREATE VIRTUAL TABLE favorites_fts USING fts5(
  title,
  url,
  content='favorites',
  content_rowid='id'
);

-- 触发器保持同步
CREATE TRIGGER favorites_ai AFTER INSERT ON favorites BEGIN
  INSERT INTO favorites_fts(rowid, title, url)
  VALUES (new.id, new.title, new.url);
END;
```

**中文分词**：SQLite FTS5 内置 `unicode61` tokenizer 对 CJK 字符按单字分词，对中文搜索"足够好"。如需更精准的中文分词，可考虑 `icu` tokenizer（需要 SQLite ICU 编译支持），但 MVP 阶段不需要。

### 支持库分析

| Library | Version | Purpose | 需要？ |
|---------|---------|---------|--------|
| cheerio | 1.2.0 | HTML 解析（CDP 取回 HTML 后的服务端解析） | 已有，备选方案 |
| highlight.js | 11.11.1 | 代码高亮（脚本生成展示） | 已有 |
| marked | 18.0.7 | Markdown 渲染（AI 回复） | 已有 |
| dompurify | 3.4.12 | XSS 防护（AI 输出消毒） | 已有 |
| **puppeteer-core** | - | CDP 自动化 | **不需要**（Electron 内置 CDP） |
| **playwright** | - | 浏览器自动化 | **不需要**（同上） |
| **jieba** | - | 中文分词 | **不需要**（FTS5 unicode61 够用） |
| **lunr.js** | - | 客户端全文检索 | **不需要**（SQLite FTS5 更强） |

## Installation

```bash
# 无新增依赖
# 所有功能基于现有技术栈实现

# 如需 ICU tokenizer（中文分词增强，可选）：
# better-sqlite3 需要从源码编译并启用 ICU
# npm rebuild better-sqlite3 --build-from-source
# 不推荐 MVP 阶段使用
```

## Alternatives Considered

| 推荐方案 | 替代方案 | 何时考虑替代 |
|----------|----------|-------------|
| Electron CDP (webContents.debugger) | Puppeteer / Playwright | 不需要 — Electron 原生 CDP 无需额外浏览器进程 |
| Runtime.evaluate | DOM 域逐节点操作 | 当需要精确 DOM 节点引用时（如修改单个节点属性） |
| SQLite FTS5 | lunr.js / flexsearch | 当需要纯客户端搜索且无法访问 SQLite 时 |
| cheerio (HTML 解析) | DOMParser (页面内) | 当需要在主进程解析 HTML 而非页面上下文时 |
| unicode61 tokenizer | ICU tokenizer | 当中文搜索召回率不足时（需编译 SQLite ICU 支持） |

## What NOT to Use

| 避免 | 原因 | 替代方案 |
|------|------|----------|
| Puppeteer | Electron 已内置 CDP 支持，Puppeteer 会启动额外的 Chromium 实例，与 Electron 的 webContents 冲突 | 直接使用 `webContents.debugger` API |
| Playwright | 同 Puppeteer，且 Playwright 的 Electron 支持有限 | 同上 |
| node-html-parser | cheerio 已集成且社区更成熟 | 继续使用 cheerio |
| elasticlunr / mini-search | SQLite FTS5 是更好的选择：性能更好、支持前缀搜索、支持高亮 | 使用 better-sqlite3 FTS5 |
| RobotJS / nut.js | 原生键鼠模拟库，但 CDP 可以直接操作 DOM，不需要模拟物理输入 | Runtime.evaluate + DOM 操作 |

## CDP API 使用模式

### 读取页面内容（read_page_content）

```javascript
// cdp-manager.js 扩展
async function readPageContent(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    throw new Error('webContents 无效');
  }

  // 确保调试器已附加
  if (!webContents.debugger.isPaused()) {
    webContents.debugger.attach('1.3');
  }

  // 使用 Runtime.evaluate 在页面上下文执行
  const result = await webContents.debugger.sendCommand('Runtime.evaluate', {
    expression: `JSON.stringify({
      title: document.title,
      url: location.href,
      text: document.body?.innerText?.substring(0, 50000) || '',
      meta: {
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        author: document.querySelector('meta[name="author"]')?.content || '',
      }
    })`,
    returnByValue: true,
  });

  return JSON.parse(result.result.value);
}
```

### 提取链接（extract_links）

```javascript
async function extractLinks(webContents) {
  const result = await webContents.debugger.sendCommand('Runtime.evaluate', {
    expression: `JSON.stringify(
      Array.from(document.querySelectorAll('a[href]')).map(a => ({
        text: (a.textContent || '').trim().substring(0, 200),
        href: a.href,
        title: a.title || '',
      })).filter(l => l.href && l.href.startsWith('http'))
    )`,
    returnByValue: true,
  });

  return JSON.parse(result.result.value);
}
```

### 打开链接（open_link）

```javascript
async function openLink(webContents, url, newTab = false) {
  if (newTab) {
    // 通过主进程创建新 Tab
    tabManager.createTab(containerId, url);
  } else {
    // 在当前页面导航
    await webContents.debugger.sendCommand('Page.navigate', { url });
  }
}
```

### 全文检索（FTS5）

```javascript
const Database = require('better-sqlite3');
const db = new Database('favorites.db');

// 创建 FTS5 虚拟表
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS favorites_fts USING fts5(
    title,
    url,
    content='favorites',
    content_rowid='id'
  )
`);

// 搜索
function searchFavorites(query) {
  return db.prepare(`
    SELECT f.* FROM favorites f
    JOIN favorites_fts fts ON f.id = fts.rowid
    WHERE favorites_fts MATCH ?
    ORDER BY rank
    LIMIT 50
  `).all(query);
}
```

## 版本兼容性

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| better-sqlite3@11.7.0 | Electron 32.x (Node 20.18.x) | 需要 electron-rebuild 编译 |
| cheerio@1.2.0 | Node.js 20+ | 纯 JS，无需编译 |
| pi-agent-core@0.82.1 | Node.js 22.19.0+ (理想) | 当前 Node 20.18.x 可用，ESM 动态 import 兼容 |
| electron-store@8.1.0 | Electron 32.x | 稳定 |

**注意**：better-sqlite3 是原生模块，必须为 Electron 的 Node.js 版本编译。`npm run dev` 和 `npm start` 使用相同的编译版本，无需额外配置。

## Sources

- Electron webContents.debugger API — 官方文档，CDP 会话管理
- Chrome DevTools Protocol 规范 — Runtime, DOM, Page, Network 域
- SQLite FTS5 文档 — 全文检索扩展
- better-sqlite3 文档 — Node.js SQLite 绑定
- pi-agent-core README — Agent 工具注册接口

---
*Stack research for: AI CDP 增强 + Tabbrowser 功能集成*
*Researched: 2026-08-02*
*Confidence: HIGH — 所有推荐基于已验证的现有技术栈*

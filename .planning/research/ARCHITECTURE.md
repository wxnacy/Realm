# Architecture Research: v2.1 AI CDP 增强 + Tabbrowser 功能集成

**Domain:** Electron 桌面应用 / 多容器隔离浏览器 AI Agent 增强
**Researched:** 2026-08-02
**Confidence:** HIGH
**Scope:** v2.1 新功能与现有架构的集成分析（CDP Manager 扩展、AI 工具扩展、智能上下文引用、全文检索、任务自动化、脚本生成、智能标签整理）

## Executive Summary

v2.1 包含四个阶段的增强功能：CDP 管理器扩展 + 3 个 AI 工具（Phase 22）、智能上下文引用 + 全文检索（Phase 23）、任务自主执行（Phase 24）、脚本生成 + 智能标签整理（Phase 25）。现有架构采用模块化设计，CDP Manager 和 AI Manager 作为独立模块存在，新功能可以沿用同一模式扩展。核心集成点是：CDP Manager 从被动抓取扩展为主动网页操控、AI Manager 工具集从 5 个扩展到 12+ 个、渲染进程需要新增 @ 引用 UI 和全文检索能力。

## 现有架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  AI Manager   │  │ CDP Manager  │  │   Tab Manager        │  │
│  │ (ai-manager)  │  │(cdp-manager) │  │  (tab-manager)       │  │
│  │ 5 tools       │  │ Network only │  │  getTabs/createTab   │  │
│  └───────┬──────┘  └───────┬──────┘  └──────────┬───────────┘  │
│          │                 │                     │              │
│  ┌───────┴─────────────────┴─────────────────────┴───────────┐  │
│  │                    IPC Handlers                            │  │
│  │  (ipc-handlers.js) + (main.js HTTP routes)                │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
├──────────────────────────────┴──────────────────────────────────┤
│                     contextBridge (preload.js)                   │
├──────────────────────────────────────────────────────────────────┤
│                       Renderer Process                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  UI Layer: Tab Bar + Toolbar + webview + AI Chat Panel     │  │
│  │  (renderer.js + index.html + main.css)                     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 现有数据持久化

| Store 实例 | 文件名 | 存储内容 |
|-----------|--------|---------|
| configStore | realm-config.json | 容器配置、AI 配置、开发者模式配置 |
| tabStore | tabs.json | Tab 列表、计数器、活动 Tab ID |
| ruleStore | assignment-rules.json | 分配规则 |
| shortcutStore | shortcuts.json | 快捷键配置 |
| historyDB | better-sqlite3 | 浏览历史记录（每容器独立表） |
| favoritesDB | better-sqlite3 | 收藏夹（全局共享） |
| devRequestsDB | better-sqlite3 | 开发者模式请求数据 |

### 现有 AI Manager 工具列表

| 工具名 | 功能 | 依赖模块 |
|--------|------|----------|
| get_tabs | 获取当前所有标签页列表 | tabManager |
| navigate | 在指定容器中打开网页 | tabManager |
| search_history | 搜索浏览历史记录 | historyManager |
| manage_favorites | 管理收藏夹（增删查） | favoritesManager |
| switch_container | 切换当前窗口容器 | windowManager |

### 现有 CDP Manager 能力

| 能力 | 实现方式 | 限制 |
|------|----------|------|
| 域名匹配 | matchesDomain(url) | 精确 + 子域名匹配 |
| 调试器附加 | attachDebugger(webContents, containerId) | 仅 Network 域 |
| 请求抓取 | Network.requestWillBeSent 等事件 | 被动监听 |
| 响应体拉取 | Network.getResponseBody | 仅文本类型，1MB 限制 |
| 导航处理 | handleNavigation(webContents, url, containerId) | 自动附加/断开 |

## Integration Point 1: CDP Manager 扩展 (Phase 22)

### 现状分析

`cdp-manager.js` 是被动抓取模块：监听导航 → 域名匹配 → 附加调试器 → 抓取 Network 事件。仅使用 `Network` 域，不涉及 DOM 操控。通过 `debuggerStates` Map 追踪 webContents 附加状态。

### 扩展策略

```
cdp-manager.js (扩展现有)
├── 现有能力：Network 事件监听、域名匹配、调试器生命周期
├── 新增能力：DOM 域、Runtime 域、Page 域
├── 新增方法：getPageContent(), extractLinks(), executeScript()
└── 新增状态：activeSessions Map (webContentsId → CDP session info)
```

### 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| CDP 会话管理 | 扩展 `debuggerStates` 为 `activeSessions`，增加 DOM/Runtime 域状态 | 复用已有 attach/detach 逻辑，避免新模块 |
| 工具访问 CDP | AI 工具通过 `cdpManager.getSession(webContentsId)` 获取会话 | 单一入口，便于权限控制和错误处理 |
| webContentsId 获取 | 从 `tabManager.getTab(tabId)` 获取 tab → 渲染进程上报 webContentsId | 现有 `webview:register-container` 映射可复用 |

### 新增方法

```javascript
// cdp-manager.js 新增方法

/**
 * 获取指定 Tab 的 CDP 会话（按需附加）
 * @param {string} tabId - Tab ID
 * @returns {Promise<{webContents, debugger}>}
 */
async function getSession(tabId) {
  // 1. 从 tabManager 获取 tab 信息
  // 2. 从 guestContainerMap 反查 webContentsId
  // 3. 检查 debuggerStates 是否已附加
  // 4. 未附加则调用 attachDebugger
  // 5. 启用 DOM/Runtime 域
  // 6. 返回会话对象
}

/**
 * 读取页面内容（标题、正文、元信息）
 * @param {string} tabId - Tab ID
 * @returns {Promise<{title, body, meta}>}
 */
async function getPageContent(tabId) {
  const session = await getSession(tabId);
  // 1. Runtime.evaluate 获取 document.title
  // 2. Runtime.evaluate 获取 document.body.innerText
  // 3. Runtime.evaluate 获取 meta 标签
  // 4. 返回结构化数据
}

/**
 * 提取页面所有链接
 * @param {string} tabId - Tab ID
 * @returns {Promise<Array<{text, href, type}>>}
 */
async function extractLinks(tabId) {
  const session = await getSession(tabId);
  // Runtime.evaluate 执行：Array.from(document.querySelectorAll('a[href]')).map(...)
}

/**
 * 在页面执行脚本
 * @param {string} tabId - Tab ID
 * @param {string} script - JavaScript 代码
 * @returns {Promise<*>}
 */
async function executeScript(tabId, script) {
  const session = await getSession(tabId);
  // Runtime.evaluate 执行脚本，返回结果
}
```

### 数据流：read_page_content 工具执行流程

```
1. 用户发送消息："帮我总结这个页面"
                    │
                    ▼
2. renderer.js 调用 window.realmAPI.ai.prompt(message)
                    │
                    ▼
3. ipc-handlers.js 转发到 aiManager.prompt(message)
                    │
                    ▼
4. AI Manager 调用 LLM，LLM 决定调用 read_page_content 工具
                    │
                    ▼
5. tool.execute() 被调用
   ├── tabManager.getActiveTab() → 获取当前 Tab ID
   └── cdpManager.getPageContent(tabId)
       ├── getSession(tabId) → 获取/创建 CDP 会话
       ├── Runtime.evaluate → 获取 document.title
       ├── Runtime.evaluate → 获取 document.body.innerText
       └── 返回 {title, body, meta}
                    │
                    ▼
6. 工具结果返回给 LLM，LLM 生成总结
                    │
                    ▼
7. 事件广播到渲染进程，显示结果
```

## Integration Point 2: AI Manager 工具扩展 (Phase 22-25)

### 现状分析

`ai-manager.js` 的 `_buildRealmTools()` 返回 5 个工具。工具直接调用 `tabManager`, `historyManager`, `favoritesManager`, `windowManager`。工具定义遵循 `pi-agent-core` 的 `AgentTool` 接口。

### 扩展策略

```
ai-manager.js (_buildRealmTools 扩展)
├── 现有 5 工具：get_tabs, navigate, search_history, manage_favorites, switch_container
├── Phase 22 新增 3：read_page_content, extract_links, open_link
├── Phase 23 新增 1：search_favorites_fulltext
├── Phase 24 新增 2：fill_form, execute_action
└── Phase 25 新增 2：generate_script, suggest_tab_groups
```

### 新增工具定义示例

```javascript
// ai-manager.js - _buildRealmTools() 中新增工具

{
  name: 'read_page_content',
  label: '读取页面内容',
  description: '读取指定标签页的页面标题、正文内容和元信息',
  parameters: {
    type: 'object',
    properties: {
      tabId: {
        type: 'string',
        description: '标签页 ID（可选，默认当前活动标签页）',
      },
    },
    required: [],
  },
  execute: async (toolCallId, params) => {
    const targetTabId = params.tabId || tabManager.getActiveTab()?.id;
    if (!targetTabId) {
      throw new Error('没有活动的标签页');
    }
    const content = await cdpManager.getPageContent(targetTabId);
    return {
      content: [{ type: 'text', text: JSON.stringify(content, null, 2) }],
      details: { tabId: targetTabId },
    };
  },
},
```

### 依赖注入

```javascript
// ai-manager.js - init() 中注入 cdpManager 依赖

const cdpManager = require('./cdp-manager');

// 在 _buildRealmTools 中使用 cdpManager
```

## Integration Point 3: 智能上下文引用 (@ 引用) (Phase 23)

### 现状分析

- AI 聊天面板在 `renderer.js` 中实现
- 消息通过 `window.realmAPI.ai.prompt(message)` 发送
- Tab 列表通过 `window.realmAPI.getTabs()` 获取

### 集成策略

```
Renderer Process
├── AI Chat Panel (现有)
│   ├── 输入框增强：@ 触发 Tab 选择器
│   ├── Tab 选择器：下拉列表，显示 Tab 标题/URL/容器
│   └── 消息格式：@{tabId:xxx} 内联标记
│
└── 消息发送流程
    ├── 用户输入 "@工作文档 帮我总结这个页面"
    ├── 选择器填充 → "@{tabId:abc123} 帮我总结这个页面"
    ├── renderer.js 解析 @ 引用，注入 tab 上下文
    └── 发送到主进程：{ message, referencedTabs: [{tabId, url, title}] }
```

### 新增 IPC 通道

```javascript
// preload.js 新增
ai: {
  // 现有方法...
  promptWithContext: (message, referencedTabs) =>
    ipcRenderer.invoke('ai:prompt-with-context', message, referencedTabs),
}

// ipc-handlers.js 新增
ipcMain.handle('ai:prompt-with-context', async (event, message, referencedTabs) => {
  assertTrustedSender(event);
  // 将 referencedTabs 注入到消息上下文
  const enrichedMessage = enrichMessageWithTabs(message, referencedTabs);
  await aiManager.prompt(enrichedMessage);
  return { success: true };
});
```

### Tab 上下文注入

```javascript
// ai-manager.js 新增辅助函数

/**
 * 将 @ 引用的 Tab 上下文注入消息
 * @param {string} message - 原始消息
 * @param {Array} referencedTabs - 引用的 Tab 列表
 * @returns {string} 注入上下文后的消息
 */
function enrichMessageWithTabs(message, referencedTabs) {
  if (!referencedTabs || referencedTabs.length === 0) return message;

  const tabContext = referencedTabs.map(tab =>
    `[标签页: ${tab.title} (${tab.url}), 容器: ${tab.containerId}]`
  ).join('\n');

  return `上下文标签页:\n${tabContext}\n\n用户消息: ${message}`;
}
```

## Integration Point 4: 全文检索 (Phase 23)

### 现状分析

- `favorites-manager.js` 使用 `better-sqlite3` 存储收藏
- 现有 `searchRecords()` 仅支持 URL 和标题的 LIKE 查询
- 数据库路径：`~/Library/Application Support/realm/favorites.db`

### 集成策略

```
favorites-manager.js (扩展现有)
├── 现有表：favorites (id, url, title, favicon_url, folder_id, sort_order, created_at)
├── 新增列：content (TEXT) - 页面正文快照
├── 新增索引：FTS5 虚拟表 favorites_fts
└── 新增方法：searchFulltext(), indexPageContent()
```

### 数据库 Schema 扩展

```sql
-- 新增 FTS5 虚拟表（SQLite 内置全文检索）
CREATE VIRTUAL TABLE IF NOT EXISTS favorites_fts USING fts5(
  title,
  content,
  url,
  content='favorites',
  content_rowid='id'
);

-- 触发器：自动同步 favorites → favorites_fts
CREATE TRIGGER IF NOT EXISTS favorites_ai AFTER INSERT ON favorites BEGIN
  INSERT INTO favorites_fts(rowid, title, content, url)
  VALUES (new.id, new.title, new.content, new.url);
END;

CREATE TRIGGER IF NOT EXISTS favorites_ad AFTER DELETE ON favorites BEGIN
  INSERT INTO favorites_fts(favorites_fts, rowid, title, content, url)
  VALUES ('delete', old.id, old.title, old.content, old.url);
END;

CREATE TRIGGER IF NOT EXISTS favorites_au AFTER UPDATE ON favorites BEGIN
  INSERT INTO favorites_fts(favorites_fts, rowid, title, content, url)
  VALUES ('delete', old.id, old.title, old.content, old.url);
  INSERT INTO favorites_fts(rowid, title, content, url)
  VALUES (new.id, new.title, new.content, new.url);
END;
```

### 新增方法

```javascript
// favorites-manager.js 新增

/**
 * 全文检索收藏内容
 * @param {Object} options - 搜索选项
 * @param {string} options.keyword - 搜索关键词
 * @param {number} [options.limit=20] - 结果数量限制
 * @returns {Array} 匹配的收藏记录
 */
function searchFulltext({ keyword, limit = 20 }) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT f.*, highlight(favorites_fts, 0, '<mark>', '</mark>') AS title_highlight,
           snippet(favorites_fts, 1, '<mark>', '</mark>', '...', 32) AS content_snippet
    FROM favorites_fts
    JOIN favorites f ON f.id = favorites_fts.rowid
    WHERE favorites_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  return stmt.all(keyword, limit);
}

/**
 * 索引页面内容（收藏时或定期更新）
 * @param {number} id - 收藏记录 ID
 * @param {string} content - 页面正文
 */
function indexPageContent(id, content) {
  const db = getDatabase();
  db.prepare('UPDATE favorites SET content = ? WHERE id = ?').run(content, id);
}
```

## Integration Point 5: 任务自主执行 (Phase 24)

### 集成策略

```
AI Tools (新增)
├── fill_form 工具
│   ├── 参数：tabId, formData (Object: selector → value)
│   ├── 实现：cdpManager.executeScript() 注入表单填写脚本
│   └── 返回：填写结果
│
└── execute_action 工具
    ├── 参数：tabId, action (click|scroll|select|type), selector, value?
    ├── 实现：cdpManager.executeScript() 注入操作脚本
    └── 返回：执行结果
```

### 脚本注入模式

```javascript
// cdp-manager.js 新增

/**
 * 填写表单字段
 * @param {string} tabId - Tab ID
 * @param {Object} formData - {selector: value} 映射
 * @returns {Promise<{success: boolean, results: Object}>}
 */
async function fillForm(tabId, formData) {
  const session = await getSession(tabId);
  const results = {};

  for (const [selector, value] of Object.entries(formData)) {
    const script = `
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return { success: false, error: '元素未找到' };
        el.value = '${String(value).replace(/'/g, "\\'")}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      })()
    `;
    const result = await executeScript(tabId, script);
    results[selector] = result;
  }

  return { success: true, results };
}

/**
 * 执行页面操作
 * @param {string} tabId - Tab ID
 * @param {string} action - 操作类型
 * @param {string} selector - CSS 选择器
 * @param {*} value - 操作值（可选）
 * @returns {Promise<Object>}
 */
async function executeAction(tabId, action, selector, value) {
  const scripts = {
    click: `document.querySelector('${selector.replace(/'/g, "\\'")}').click()`,
    scroll: `window.scrollBy(0, ${parseInt(value) || 300})`,
    select: `document.querySelector('${selector.replace(/'/g, "\\'")}').value = '${String(value).replace(/'/g, "\\'")}'`,
    type: `
      const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
      el.focus();
      el.value += '${String(value).replace(/'/g, "\\'")}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `,
  };

  const script = scripts[action];
  if (!script) throw new Error(`不支持的操作: ${action}`);

  return executeScript(tabId, `(() => { ${script}; return { success: true }; })()`);
}
```

## Integration Point 6: 脚本生成 (Phase 25)

### 集成策略

```
AI Tools (新增)
└── generate_script 工具
    ├── 参数：description (自然语言描述), tabId (上下文)
    ├── 流程：
    │   1. 读取页面内容（getPageContent）
    │   2. 构建 prompt：页面结构 + 用户需求
    │   3. LLM 生成脚本
    │   4. 返回脚本 + 预览
    └── 返回：{ script, explanation }
```

### 实现

```javascript
// ai-manager.js - _buildRealmTools() 新增

{
  name: 'generate_script',
  label: '生成脚本',
  description: '根据自然语言描述生成可在当前页面执行的 JavaScript 脚本',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: '脚本功能的自然语言描述',
      },
      tabId: {
        type: 'string',
        description: '目标标签页 ID（可选，默认当前活动标签页）',
      },
    },
    required: ['description'],
  },
  execute: async (toolCallId, params) => {
    const { description, tabId } = params;
    const targetTabId = tabId || tabManager.getActiveTab()?.id;

    if (!targetTabId) {
      throw new Error('没有活动的标签页');
    }

    // 读取页面结构作为上下文
    const pageContent = await cdpManager.getPageContent(targetTabId);

    // 构建生成 prompt（由 LLM 完成脚本生成）
    const prompt = `基于以下页面结构，生成满足需求的 JavaScript 脚本：

页面标题：${pageContent.title}
页面 URL：${pageContent.url}
页面结构摘要：${pageContent.body.substring(0, 2000)}

需求：${description}

请生成可直接执行的 JavaScript 代码，包含必要的错误处理。`;

    // 注意：脚本生成由 LLM 在后续轮次完成，此处返回上下文
    return {
      content: [{ type: 'text', text: prompt }],
      details: { tabId: targetTabId, description },
    };
  },
},
```

## Integration Point 7: 智能标签整理 (Phase 25)

### 集成策略

```
AI Tools (新增)
└── suggest_tab_groups 工具
    ├── 参数：无（自动分析所有 Tab）
    ├── 流程：
    │   1. 获取所有 Tab 列表（tabManager.getTabs()）
    │   2. 分析 URL 域名、标题关键词
    │   3. LLM 生成分组建议
    │   4. 返回分组方案
    └── 返回：{ groups: [{name, tabIds, reason}] }
```

### 实现

```javascript
// ai-manager.js - _buildRealmTools() 新增

{
  name: 'suggest_tab_groups',
  label: '智能标签分组',
  description: '分析当前所有标签页，智能建议分组方案',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async () => {
    const tabs = tabManager.getTabs();

    if (tabs.length === 0) {
      return {
        content: [{ type: 'text', text: '没有打开的标签页' }],
        details: { groups: [] },
      };
    }

    // 构建 Tab 信息列表
    const tabList = tabs.map(tab => ({
      id: tab.id,
      title: tab.title || '(无标题)',
      url: tab.url || '',
      containerId: tab.containerId,
      domain: (() => {
        try { return new URL(tab.url).hostname; } catch { return ''; }
      })(),
    }));

    // 分组逻辑（基于域名聚类）
    const domainGroups = {};
    tabList.forEach(tab => {
      const key = tab.domain || '其他';
      if (!domainGroups[key]) {
        domainGroups[key] = [];
      }
      domainGroups[key].push(tab.id);
    });

    // 转换为分组建议
    const groups = Object.entries(domainGroups)
      .filter(([, ids]) => ids.length > 1)
      .map(([domain, tabIds]) => ({
        name: domain,
        tabIds,
        reason: `同一域名 ${domain} 的 ${tabIds.length} 个标签页`,
      }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalTabs: tabs.length,
          suggestedGroups: groups,
          ungrouped: tabList.filter(t =>
            !groups.some(g => g.tabIds.includes(t.id))
          ).map(t => t.id),
        }, null, 2),
      }],
      details: { groups },
    };
  },
},
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Main Process                                │
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
│  │  AI Manager   │◄────►│ CDP Manager  │◄────►│ Tab Manager  │      │
│  │              │      │              │      │              │      │
│  │ _buildTools  │      │ getSession   │      │ getTabs      │      │
│  │ prompt()     │      │ getPageContent│     │ getActiveTab │      │
│  │              │      │ executeScript│      │              │      │
│  └──────┬───────┘      └──────┬───────┘      └──────────────┘      │
│         │                     │                                      │
│         │  tool.execute()     │  attach/detach                      │
│         │                     │                                      │
│  ┌──────▼─────────────────────▼──────────────────────────────────┐  │
│  │                    IPC Handlers                                │  │
│  │  ai:prompt  │  ai:prompt-with-context  │  tab:*  │  webview:* │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
├─────────────────────────────┼────────────────────────────────────────┤
│                     contextBridge (preload.js)                       │
│                             │                                        │
├─────────────────────────────┼────────────────────────────────────────┤
│                       Renderer Process                               │
│                             │                                        │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │                    AI Chat Panel                              │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │  @ 引用输入框  │  Tab 选择器  │  消息渲染  │  工具卡片 │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: CDP 会话泄漏

**What people do:** 每次工具调用都创建新 CDP 会话，用完不释放
**Why it's wrong:** CDP 调试器会占用 Chromium 资源，大量会话导致内存泄漏
**Do this instead:** 复用 `debuggerStates` 中的会话，按需附加，定期清理闲置会话

### Anti-Pattern 2: 直接在工具中执行任意脚本

**What people do:** 让 LLM 生成的脚本直接通过 `Runtime.evaluate` 执行
**Why it's wrong:** LLM 可能生成恶意代码（XSS、数据泄露），用户无感知
**Do this instead:**
1. 预定义安全的脚本模板（fillForm, click, scroll 等）
2. LLM 只能选择模板和参数，不能生成任意代码
3. 对于 generate_script，返回脚本但不自动执行，需用户确认

### Anti-Pattern 3: @ 引用传递完整页面内容

**What people do:** 用户 @ 一个 Tab 时，立即抓取整个页面内容注入消息
**Why it's wrong:** 页面内容可能很大（几 MB），浪费 token，延迟高
**Do this instead:** @ 引用只传递 Tab 元数据（id, url, title），LLM 按需调用 read_page_content

### Anti-Pattern 4: 全文检索索引所有页面内容

**What people do:** 每次访问页面都自动索引全文到 SQLite
**Why it's wrong:** 存储膨胀、写入性能差、隐私问题
**Do this instead:** 仅在用户主动收藏时索引，或定期清理旧索引

## Build Order Recommendations

```
Phase 22: CDP Manager 扩展 + 3 个 AI 工具
├── 22-01: cdp-manager.js 新增 getSession/getPageContent/extractLinks/executeScript
├── 22-02: ai-manager.js 新增 read_page_content 工具
├── 22-03: ai-manager.js 新增 extract_links 工具
└── 22-04: ai-manager.js 新增 open_link 工具

Phase 23: 智能上下文引用 + 全文检索
├── 23-01: renderer.js @ 引用 UI（输入框 + Tab 选择器）
├── 23-02: 新增 ai:prompt-with-context IPC 通道
├── 23-03: ai-manager.js 上下文注入逻辑
├── 23-04: favorites-manager.js FTS5 索引扩展
└── 23-05: ai-manager.js 新增 search_favorites_fulltext 工具

Phase 24: 任务自主执行
├── 24-01: cdp-manager.js 新增 fillForm 方法
├── 24-02: cdp-manager.js 新增 executeAction 方法
├── 24-03: ai-manager.js 新增 fill_form 工具
└── 24-04: ai-manager.js 新增 execute_action 工具

Phase 25: 脚本生成 + 智能标签整理
├── 25-01: ai-manager.js 新增 generate_script 工具
├── 25-02: renderer.js 脚本预览/确认 UI
├── 25-03: ai-manager.js 新增 suggest_tab_groups 工具
└── 25-04: renderer.js 标签分组 UI
```

**构建顺序理由：**
- Phase 22 是基础：CDP Manager 扩展是后续所有网页操控功能的前提
- Phase 23 独立性高：@ 引用和全文检索可并行开发
- Phase 24 依赖 Phase 22：任务自动化需要 CDP Manager 的 executeScript
- Phase 25 依赖 Phase 22 + Phase 24：脚本生成需要页面内容读取和执行能力

## Risks and Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| CDP 域冲突 | Network 域和 DOM/Runtime 域可能互相干扰 | 独立管理各域的启用/禁用状态 |
| LLM 工具选择不准确 | 模型可能错误调用工具 | 完善工具描述，增加参数校验 |
| 脚本执行安全 | 恶意脚本可能窃取数据 | 预定义模板 + 用户确认机制 |
| FTS5 索引膨胀 | 大量收藏导致索引文件过大 | 限制内容长度，定期 VACUUM |
| @ 引用上下文过长 | 超出 LLM token 限制 | 仅传递元数据，按需加载内容 |

## Sources

- 现有代码库分析：cdp-manager.js, ai-manager.js, tab-manager.js, favorites-manager.js, ipc-handlers.js, preload.js
- Electron Chrome DevTools Protocol 文档
- SQLite FTS5 官方文档
- pi-agent-core AgentTool 接口定义

---
*Architecture research for: Realm Browser v2.1 AI CDP 增强 + Tabbrowser 功能集成*
*Researched: 2026-08-02*

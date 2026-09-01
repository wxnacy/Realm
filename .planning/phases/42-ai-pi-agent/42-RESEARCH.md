# Phase 42: AI 历史对话功能调研与 pi-agent 集成方案 - Research

**Researched:** 2026-09-01
**Domain:** pi-agent-core SDK 集成、对话持久化、Agent 生命周期管理
**Confidence:** HIGH

## Summary

本阶段为 AI 助手添加历史对话管理功能，核心挑战在于：(1) 理解 pi-agent-core SDK 的 Agent 生命周期和消息注入机制；(2) 设计对话持久化方案；(3) 实现一对话一实例的 Agent 管理模式。

基于对 SDK 类型定义和现有 ai-manager.js 代码的分析，pi-agent-core 提供了清晰的 Agent 状态管理和事件订阅 API，支持通过 `prompt()` 注入历史消息、通过 `state.messages` 读取对话记录。对话存储复用 better-sqlite3 模式，与现有 history.db 架构一致。

**Primary recommendation:** 复用现有 Agent 创建模式，通过 `agent.prompt()` 批量注入历史消息实现对话恢复，在 `agent_end` 事件后持久化消息到 SQLite。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @earendil-works/pi-agent-core | 已安装 | AI Agent 生命周期管理 | 项目已集成，提供 Agent 类和事件系统 |
| better-sqlite3 | 已安装 | SQLite 数据库 | 项目已用于 history.db、favorites.db |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 已安装 | 配置持久化 | 存储对话排序、UI 状态等轻量配置 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 独立 ai-conversations.db | 复用 history.db | 独立数据库便于 AI 数据独立管理，避免历史记录表膨胀 |
| agent.reset() 恢复对话 | 一对话一实例 | reset() 会清空状态，无法保留工具调用结果；一实例更简单可靠 |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ai-manager.js                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Conversation│  │   Agent     │  │   Event     │     │   │
│  │  │   Store     │  │  Instance   │  │  Broadcast  │     │   │
│  │  │ (SQLite)    │  │  (per-conv) │  │             │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                    │                │               │
│           ▼                    ▼                ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ipc-handlers.js                       │   │
│  │  get-conversations | create-conversation | delete-conv   │   │
│  │  switch-conversation | rename-conversation               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ IPC (contextBridge)              │
│                              ▼                                  │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Renderer Process                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AI Chat Panel                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ History Btn │  │ Conv List   │  │ Context     │     │   │
│  │  │             │  │ Dropdown    │  │ Menu        │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
ai-manager.js          # 对话管理逻辑扩展（新建/切换/保存/加载）
ipc-handlers.js        # 新增对话管理 IPC 通道
src/preload.js         # 暴露 conversationAPI
src/renderer.js        # 对话列表 UI 交互
main.css               # 对话列表样式
```

### Pattern 1: Agent 一对话一实例模式

**What:** 每个对话对应独立的 Agent 实例，切换对话时销毁旧实例、创建新实例
**When to use:** 需要完全隔离对话状态（消息历史、工具调用结果、流式状态）
**Example:**

```javascript
// Source: node_modules/@earendil-works/pi-agent-core/dist/agent.d.ts
// Agent 类构造函数接收 initialState，包含 systemPrompt、model、tools

/**
 * 创建新的对话 Agent 实例
 * @param {Object} options - Agent 配置
 * @param {string} options.systemPrompt - 系统提示词
 * @param {Object} options.model - LLM 模型
 * @param {Array} options.tools - 可用工具列表
 * @param {Function} options.streamFn - 流式调用函数
 * @returns {Agent} 新的 Agent 实例
 */
function createConversationAgent(options) {
  const { Agent } = require('@earendil-works/pi-agent-core');

  return new Agent({
    initialState: {
      systemPrompt: options.systemPrompt,
      model: options.model,
      tools: options.tools,
    },
    streamFn: options.streamFn,
    convertToLlm: (messages) => {
      return messages.filter(msg =>
        msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult'
      );
    },
  });
}
```

### Pattern 2: 历史消息注入

**What:** 通过 agent.prompt() 批量注入历史消息，恢复对话上下文
**When to use:** 用户切换到已有对话时，需要恢复之前的对话历史
**Example:**

```javascript
// Source: node_modules/@earendil-works/pi-agent-core/dist/agent.d.ts:108-109
// prompt(message: AgentMessage | AgentMessage[]): Promise<void>
// prompt(input: string, images?: ImageContent[]): Promise<void>

/**
 * 恢复对话历史到 Agent 实例
 * @param {Agent} agent - Agent 实例
 * @param {Array} messages - 历史消息数组
 */
async function restoreConversationHistory(agent, messages) {
  if (!messages || messages.length === 0) return;

  // 批量注入历史消息（不触发 LLM 调用）
  // 注意：prompt() 会启动新的 run，需要 waitForIdle()
  for (const msg of messages) {
    await agent.prompt(msg);
    await agent.waitForIdle();
  }
}
```

### Pattern 3: 对话消息持久化

**What:** 在 agent_end 事件后将消息写入 SQLite 数据库
**When to use:** 每轮对话结束后（agent_end 事件触发时）
**Example:**

```javascript
// Source: ai-manager.js:1076-1098 (agent_end 事件处理)
// 在 agent_end 事件中获取最终消息并持久化

/**
 * 保存对话消息到数据库
 * @param {string} conversationId - 对话 ID
 * @param {Array} messages - Agent 消息数组
 */
function saveConversationMessages(conversationId, messages) {
  const stmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((msgs) => {
    for (const msg of msgs) {
      stmt.run(
        generateId(),
        conversationId,
        msg.role,
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        msg.toolResults ? JSON.stringify(msg.toolResults) : null,
        Date.now()
      );
    }
  });

  insertMany(messages);
}
```

### Anti-Patterns to Avoid

- **使用 agent.reset() 恢复对话：** reset() 会清空所有状态（messages、tools、pendingToolCalls），无法保留工具调用结果。应使用一对话一实例模式。
- **在 prompt() 前不调用 waitForIdle()：** prompt() 是异步操作，必须等待完成才能进行下一步，否则会导致消息顺序混乱。
- **直接修改 state.messages：** 虽然 state.messages 可写，但直接赋值会丢失工具调用的上下文关联。应通过 prompt() 注入消息。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 对话存储 | 自定义 JSON 文件存储 | better-sqlite3 | 已有成熟模式，支持事务、索引、并发 |
| Agent 生命周期 | 手动管理 Promise 链 | agent.prompt() + waitForIdle() | SDK 已处理流式、重试、错误恢复 |
| 事件广播 | 自定义 EventEmitter | agent.subscribe() | SDK 事件包含完整上下文，已优化高频场景 |

## Common Pitfalls

### Pitfall 1: Agent 实例销毁时的资源泄漏

**What goes wrong:** 切换对话时未正确清理旧 Agent 实例，导致内存泄漏和事件监听器累积
**Why it happens:** Agent.subscribe() 返回的 unsubscribe 函数未被调用，旧实例的事件监听器仍在运行
**How to avoid:** 切换对话时必须：(1) 调用 agent.abort() 取消当前 run；(2) 调用 unsubscribe() 清理事件监听；(3) 将 agent 引用设为 null

```javascript
// 切换对话时的清理逻辑
function cleanupCurrentAgent() {
  if (this.agent) {
    this.agent.abort();
    // this._unsubscribe 是 subscribe() 返回的函数
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.agent = null;
  }
}
```

### Pitfall 2: 历史消息注入时的 LLM 调用

**What goes wrong:** 调用 agent.prompt() 注入历史消息时，Agent 会启动新的 run 并调用 LLM
**Why it happens:** prompt() 的设计是发送用户消息并获取 AI 回复，不适合纯历史注入
**How to avoid:** 使用 `agent.state.messages = [...]` 直接设置消息数组，或在 prompt() 后立即 abort()

```javascript
// 方案 A：直接设置 messages（推荐）
agent.state.messages = historicalMessages;

// 方案 B：prompt + abort（会触发一次无效的 LLM 调用）
await agent.prompt(historicalMessages);
agent.abort();
```

### Pitfall 3: 工具调用结果的序列化

**What goes wrong:** 工具调用结果包含复杂对象（如 DOM 快照、网络响应），直接 JSON.stringify 会导致数据过大
**Why it happens:** 未对工具结果进行截断或摘要处理
**How to avoid:** 保存工具结果时限制大小，超过阈值时只保留摘要

```javascript
const MAX_TOOL_RESULT_SIZE = 102400; // 100KB

function serializeToolResult(result) {
  const str = JSON.stringify(result);
  if (str.length > MAX_TOOL_RESULT_SIZE) {
    return JSON.stringify({
      summary: str.substring(0, 1024) + '...',
      truncated: true,
      originalSize: str.length,
    });
  }
  return str;
}
```

## Code Examples

### 对话管理 IPC 通道注册

```javascript
// Source: ai-manager.js (现有 IPC 模式)
// 新增对话管理 IPC 通道

// ipc-handlers.js
const { ipcMain } = require('electron');
const aiManager = require('./ai-manager');

/**
 * 注册对话管理相关的 IPC 处理器
 */
function registerConversationHandlers() {
  // 获取对话列表
  ipcMain.handle('ai:get-conversations', async () => {
    return aiManager.getConversations();
  });

  // 创建新对话
  ipcMain.handle('ai:create-conversation', async () => {
    return aiManager.createConversation();
  });

  // 切换对话
  ipcMain.handle('ai:switch-conversation', async (event, conversationId) => {
    return aiManager.switchConversation(conversationId);
  });

  // 删除对话
  ipcMain.handle('ai:delete-conversation', async (event, conversationId) => {
    return aiManager.deleteConversation(conversationId);
  });

  // 重命名对话
  ipcMain.handle('ai:rename-conversation', async (event, conversationId, newTitle) => {
    return aiManager.renameConversation(conversationId, newTitle);
  });
}
```

### 对话存储层实现

```javascript
// Source: history-manager.js (SQLite 模式)
// 独立的对话存储模块

const path = require('path');
const { app } = require('electron');
const { randomUUID } = require('crypto');

let Database = null;
let db = null;

/**
 * 初始化对话数据库
 */
function initConversationDatabase() {
  if (db) return;

  if (!Database) {
    Database = require('better-sqlite3');
  }

  const DB_PATH = path.join(app.getPath('userData'), 'ai-conversations.db');
  db = new Database(DB_PATH);

  // WAL 模式提升并发性能
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT,
      provider TEXT,
      token_total INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      tool_results TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_conversations_updated
    ON conversations(updated_at DESC);
  `);

  console.log('[Realm AI] 对话数据库已初始化:', DB_PATH);
}

/**
 * 创建新对话
 * @param {Object} options - 对话选项
 * @returns {Object} 新创建的对话对象
 */
function createConversation(options = {}) {
  const now = Date.now();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO conversations (id, title, model, provider, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, options.title || '新对话', options.model, options.provider, now, now);

  return { id, title: options.title || '新对话', created_at: now, updated_at: now };
}

/**
 * 获取对话列表（按更新时间降序）
 * @param {number} limit - 最大返回数量
 * @returns {Array} 对话列表
 */
function getConversations(limit = 50) {
  return db.prepare(`
    SELECT * FROM conversations
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * 保存消息到对话
 * @param {string} conversationId - 对话 ID
 * @param {Array} messages - 消息数组
 */
function saveMessages(conversationId, messages) {
  const stmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((msgs) => {
    for (const msg of msgs) {
      stmt.run(
        randomUUID(),
        conversationId,
        msg.role,
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        msg.toolResults ? JSON.stringify(msg.toolResults) : null,
        Date.now()
      );
    }
  });

  insertMany(messages);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 单 Agent 实例 + reset() | 一对话一实例 | Phase 42 设计 | 简化状态管理，避免 reset() 导致的数据丢失 |
| 无对话持久化 | SQLite 存储对话 | Phase 42 新增 | 支持历史对话查看和恢复 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Agent.prompt() 接收数组参数时会逐条处理消息 | Pattern 2 | 可能需要逐条调用 prompt() |
| A2 | agent.state.messages 直接赋值不会触发 LLM 调用 | Pitfall 2 | 可能需要使用其他方式注入历史 |

## Open Questions (RESOLVED)

1. **Agent.prompt() 批量注入行为** — RESOLVED
   - Conclusion: `agent.prompt(AgentMessage[])` 会触发 LLM 调用，不适合用于恢复历史消息
   - Decision: 采用 `agent.state.messages = [...]` 直接赋值方式注入历史消息，不触发 LLM 调用
   - Rationale: RESEARCH Pitfall 2 确认 state.messages 直接赋值不会触发 LLM；Plan 01 Task 2 按此实现

2. **工具调用结果的恢复时机** — RESOLVED
   - Conclusion: 恢复对话时仅将工具调用结果作为上下文保存，不重新执行工具
   - Decision: tool_results 字段序列化保存到 SQLite，恢复时直接注入到 agent.state.messages
   - Rationale: 工具结果是历史快照（如页面内容），重新执行可能返回不同结果；D-14 明确要求"保存并恢复"而非重新执行

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-sqlite3 | 对话存储 | ✓ | 已安装 | — |
| @earendil-works/pi-agent-core | Agent 管理 | ✓ | 已安装 | — |
| electron-store | 配置持久化 | ✓ | 已安装 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Sources

### Primary (HIGH confidence)
- `node_modules/@earendil-works/pi-agent-core/dist/agent.d.ts` — Agent 类定义、方法签名、事件订阅
- `node_modules/@earendil-works/pi-agent-core/dist/types.d.ts` — AgentMessage、AgentEvent 类型定义
- `ai-manager.js:696-718` — 现有 Agent 创建模式
- `ai-manager.js:987-1106` — 事件广播机制
- `history-manager.js:0-78` — better-sqlite3 初始化模式

### Secondary (MEDIUM confidence)
- `42-CONTEXT.md` — 用户决策（一对话一实例、SQLite 存储）

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 基于现有代码和 SDK 类型定义
- Architecture: HIGH — 复用项目已验证的模式
- Pitfalls: MEDIUM — 基于 SDK 行为推断，需要实际测试验证

**Research date:** 2026-09-01
**Valid until:** 2026-10-01（pi-agent-core SDK 版本稳定，30 天有效）

/**
 * Realm Browser - AI 对话管理模块
 *
 * 使用 better-sqlite3 管理 AI 对话和消息的 CRUD 操作。
 * 独立数据库文件（ai-conversations.db），与 history.db 分离。
 * 对话全局共享，不属于任何容器（per D-03）。
 *
 * 数据库设计（per D-01, D-02）：
 * - conversations 表：对话元数据
 * - messages 表：对话消息，通过外键关联对话
 *
 * 依赖：better-sqlite3
 * 数据库路径：{userData}/ai-conversations.db
 */

const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载
let Database = null;

// 数据库路径（延迟初始化，避免 app.getPath 在 ready 前调用）
let DB_PATH = null;

// 数据库连接实例
let db = null;

// 工具结果截断阈值（100KB，per RESEARCH Pitfall 3）
const TOOL_RESULT_TRUNCATE_SIZE = 100 * 1024;

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库连接，设置 WAL 模式和外键约束
 * 应在 app.whenReady 之后调用
 */
function initDatabase() {
  if (db) return;

  // 延迟加载原生模块和路径，确保在 app.whenReady 之后执行
  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'ai-conversations.db');
  }

  db = new Database(DB_PATH);
  // WAL 模式：提升并发读写性能
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');
  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 创建表结构
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
      page_snapshots TEXT,
      attachments TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages (conversation_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_conversations_updated
      ON conversations (updated_at DESC);
  `);

  // 旧库迁移：CREATE TABLE IF NOT EXISTS 不会给已存在的 messages 表加列，
  // 显式检测并 ALTER（attachments 列存用户附件元数据 JSON 数组或 NULL）
  const msgColumns = db.pragma('table_info(messages)');
  if (!msgColumns.some(col => col.name === 'attachments')) {
    db.exec('ALTER TABLE messages ADD COLUMN attachments TEXT');
    console.log('[Realm AI Conv] messages 表已迁移：新增 attachments 列');
  }

  console.log('[Realm] AI 对话数据库已初始化: ' + DB_PATH);
}

// ==================== 辅助函数 ====================

/**
 * 生成唯一 ID
 * @returns {string} UUID v4 格式的唯一 ID
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * 序列化工具调用/结果数据
 * 对超过 100KB 的工具结果进行截断（per RESEARCH Pitfall 3）
 * @param {*} data - 要序列化的数据
 * @returns {string|null} JSON 字符串，null 输入返回 null
 */
function serializeToolData(data) {
  if (data === null || data === undefined) return null;

  let jsonStr;
  try {
    jsonStr = JSON.stringify(data);
  } catch (err) {
    console.warn('[Realm AI Conv] 工具数据序列化失败:', err.message);
    return null;
  }

  // 截断检查
  if (jsonStr.length > TOOL_RESULT_TRUNCATE_SIZE) {
    console.warn('[Realm AI Conv] 工具数据超过 ' + TOOL_RESULT_TRUNCATE_SIZE + ' 字节，已截断');
    const truncated = jsonStr.substring(0, TOOL_RESULT_TRUNCATE_SIZE);
    // 在截断位置添加标记
    return truncated + '"...(truncated)"';
  }

  return jsonStr;
}

/**
 * 序列化页面快照数据
 * 从消息的 contextAttachments 或类似属性提取页面快照
 * @param {Array|null} snapshots - 页面快照数组
 * @returns {string|null} JSON 字符串
 */
function serializePageSnapshots(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null;
  return serializeToolData(snapshots);
}

/**
 * 安全解析 JSON 字符串（per T-42-08：损坏行降级不抛异常）
 * @param {string|null} str - JSON 字符串
 * @param {*} [fallback] - 解析失败/非字符串时的回退值
 * @returns {*} 解析结果或回退值
 */
function safeJsonParse(str, fallback = null) {
  if (typeof str !== 'string' || str.length === 0) return fallback;
  try {
    return JSON.parse(str);
  } catch (err) {
    return fallback;
  }
}

/**
 * 从内容块数组中提取 type:'text' 块的文本并拼接
 * 字符串输入原样返回（UserMessage.content 允许为 string）
 * @param {*} content - 内容块数组或字符串
 * @returns {string} 拼接后的文本
 */
function extractTextFromBlocks(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(block => block && block.type === 'text')
    .map(block => block.text || '')
    .join('');
}

/**
 * 将 AgentMessage 归一化为存储列值（per G-42-3 写入侧）
 *
 * pi-ai 消息 content 为内容块数组（AssistantMessage.content 恒为数组），
 * 不能直接 JSON.stringify 落库——按角色提取：
 * - user：content 为 string 原样存；为数组则提取 text 块拼接
 * - assistant：text 块拼接为显示文本；toolCall 块取 {id,name,arguments}
 *   序列化存 tool_calls 列；thinking 块不落盘（实时链路 _extractText
 *   也不展示 thinking，保持一致）
 * - toolResult：content 块数组 text 拼接存 content 列；
 *   {toolCallId, toolName, isError, details} 存 tool_results 列
 *
 * @param {Object} msg - pi-agent-core AgentMessage
 * @returns {{role: string, content: string, toolCalls: *, toolResults: *, pageSnapshots: *}} 存储列值
 * @private
 */
function normalizeMessageColumns(msg) {
  const role = msg.role || 'user';
  const content = msg.content;

  if (role === 'toolResult') {
    // 工具结果消息：元数据写入 tool_results 列（供读取侧回填/重建上下文）
    const meta = {
      toolCallId: msg.toolCallId,
      toolName: msg.toolName,
      isError: !!msg.isError,
    };
    if (msg.details !== undefined) meta.details = msg.details;
    return {
      role,
      content: extractTextFromBlocks(content),
      toolCalls: msg.toolCalls || msg.tool_calls || null,
      toolResults: meta,
      pageSnapshots: msg.pageSnapshots || msg.page_snapshots || null,
      attachments: null,
    };
  }

  if (role === 'assistant') {
    // 助手消息：content 恒为 (TextContent | ThinkingContent | ToolCall)[] 块数组
    const textParts = [];
    const calls = [];
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') continue;
        if (block.type === 'text') {
          textParts.push(block.text || '');
        } else if (block.type === 'toolCall') {
          calls.push({ id: block.id, name: block.name, arguments: block.arguments });
        }
        // thinking 块不落盘
      }
    } else if (typeof content === 'string') {
      textParts.push(content);
    }
    return {
      role,
      content: textParts.join(''),
      // 提取到 toolCall 块优先；顶层 toolCalls 兜底保留（SDK 消息无该字段，恒走提取值）
      toolCalls: calls.length > 0 ? calls : (msg.toolCalls || msg.tool_calls || null),
      toolResults: msg.toolResults || msg.tool_results || null,
      pageSnapshots: msg.pageSnapshots || msg.page_snapshots || null,
      attachments: null,
    };
  }

  // user 及其他角色：content 为 string 原样存；为数组则提取 text 块拼接。
  // attachments 为用户附件元数据数组（ai-manager 发送时挂到 user 消息对象上），
  // 只存元数据不存 base64——快照文件本身持久在 agent-workspace/attachments/
  return {
    role,
    content: extractTextFromBlocks(content),
    toolCalls: msg.toolCalls || msg.tool_calls || null,
    toolResults: msg.toolResults || msg.tool_results || null,
    pageSnapshots: msg.pageSnapshots || msg.page_snapshots || null,
    attachments: Array.isArray(msg.attachments) && msg.attachments.length > 0 ? msg.attachments : null,
  };
}

/**
 * 判断解析结果是否为「旧格式内容块数组」（per WR-04）
 *
 * 旧格式行的 content 是 pi-agent-core 内容块数组序列化的 JSON——每个元素
 * 都是带已知 type 字段的非空对象。用户正文恰为普通 JSON 数组文本（如
 * '[1, 2, 3]'）时同样能 JSON.parse 成数组，但元素没有内容块形状，
 * 不能走旧格式分支（否则 text 拼接为空串，显示与 LLM 上下文双双丢失）。
 *
 * @param {*} parsed - safeJsonParse 的解析结果
 * @returns {boolean} 是否为旧格式内容块数组
 */
function isLegacyBlockArray(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  const KNOWN_TYPES = ['text', 'thinking', 'toolCall', 'image', 'audio'];
  return parsed.every(block =>
    block && typeof block === 'object' && KNOWN_TYPES.includes(block.type)
  );
}

/**
 * 统一解析存储的 content 列，得到「显示文本 + 工具调用列表」（per G-42-3 读取侧）
 *
 * 兼容两种落库格式：
 * - 旧格式（G-42-3 根因落库的原始块数组）：content 为 pi-agent-core 内容块数组
 *   序列化的 JSON 字符串——text 块拼显示文本，toolCall 块并入工具调用列表；
 *   判别要求元素全部带已知 type 字段（per WR-04），普通 JSON 数组文本按原文处理
 * - 新格式：content 即显示文本；工具调用列表来自 tool_calls 列反序列化结果
 *   （JSON.parse 失败容错返回空数组）
 *
 * @param {string|null} contentStr - messages.content 列原始值
 * @param {*} toolCallsFallback - tool_calls 列反序列化结果
 * @returns {{text: string, toolCalls: Array}} 显示文本与工具调用列表
 */
function parseStoredContent(contentStr, toolCallsFallback) {
  const fallbackList = Array.isArray(toolCallsFallback) ? toolCallsFallback : [];

  if (typeof contentStr === 'string' && contentStr.length > 0) {
    const parsed = safeJsonParse(contentStr, undefined);
    if (isLegacyBlockArray(parsed)) {
      // 旧格式行：JSON 块数组字符串
      const textParts = [];
      const blockCalls = [];
      for (const block of parsed) {
        if (!block || typeof block !== 'object') continue;
        if (block.type === 'text') {
          textParts.push(block.text || '');
        } else if (block.type === 'toolCall') {
          blockCalls.push(block);
        }
        // thinking 块不参与显示/注入
      }
      return { text: textParts.join(''), toolCalls: [...fallbackList, ...blockCalls] };
    }
  }

  // 新格式行（content 即显示文本）或空 content
  return {
    text: typeof contentStr === 'string' ? contentStr : '',
    toolCalls: fallbackList,
  };
}

/**
 * 读取对话的全部消息行（按 rowid 升序 = 最后一次全量保存的数组顺序）
 *
 * 排序依据是 rowid 而非 created_at：saveMessages 全量替换事务按数组
 * 顺序插入，rowid 即 transcript 逻辑顺序（per G-42-2），保证 assistant
 * toolCall 与其后 toolResult 相邻（provider API 配对约束）。
 * 不能用 created_at 排序：/compact 摘要消息的时间戳是压缩时刻（最新），
 * 但逻辑位置在最前；重插的历史轮次保留原始时间戳，按 created_at 排序
 * 会把摘要从上下文开头错位到结尾（每次 DB 回读都会重排）。
 *
 * @param {string} conversationId - 对话 ID
 * @returns {Array} 原始消息行
 * @private
 */
function readMessageRows(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') return [];
  return db.prepare(`
    SELECT id, conversation_id, role, content, tool_calls, tool_results, page_snapshots, attachments, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY rowid ASC
  `).all(conversationId);
}

// ==================== 对话 CRUD ====================

/**
 * 创建新对话
 * @param {Object} options - 对话选项
 * @param {string} [options.title] - 对话标题（默认截取首条用户消息前 30 字符）
 * @param {string} [options.model] - 使用的模型 ID
 * @param {string} [options.provider] - 使用的提供商 ID
 * @returns {Object} 创建的对话对象
 */
function createConversation({ title, model, provider } = {}) {
  const now = Date.now();
  const id = generateId();
  const conversationTitle = title || '新对话';

  db.prepare(`
    INSERT INTO conversations (id, title, model, provider, token_total, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, conversationTitle, model || null, provider || null, now, now);

  console.log('[Realm AI Conv] 创建对话: ' + id + ' (' + conversationTitle + ')');

  return {
    id,
    title: conversationTitle,
    model: model || null,
    provider: provider || null,
    token_total: 0,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 获取对话列表（按 updated_at 降序，附带真实消息数）
 *
 * LEFT JOIN messages + COUNT 聚合计算 message_count（per G-42-2）：
 * 对话列表元信息显示真实消息条数，不再恒为 0 条。
 *
 * @param {number} [limit=50] - 返回数量上限
 * @returns {Array} 对话列表，每行含 message_count 字段
 */
function getConversations(limit = 50) {
  return db.prepare(`
    SELECT c.id, c.title, c.model, c.provider, c.token_total, c.created_at, c.updated_at,
           COUNT(m.id) AS message_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * 获取单个对话详情
 * @param {string} id - 对话 ID
 * @returns {Object|null} 对话对象，不存在返回 null
 */
function getConversation(id) {
  if (!id || typeof id !== 'string') return null;
  return db.prepare(`
    SELECT id, title, model, provider, token_total, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `).get(id) || null;
}

/**
 * 更新对话元数据
 * @param {string} id - 对话 ID
 * @param {Object} updates - 要更新的字段
 * @param {string} [updates.title] - 新标题
 * @param {string} [updates.model] - 新模型
 * @param {string} [updates.provider] - 新提供商
 * @param {number} [updates.token_total] - 累计 token 消耗
 * @returns {boolean} 是否更新成功
 */
function updateConversation(id, updates) {
  if (!id || typeof id !== 'string') return false;
  if (!updates || typeof updates !== 'object') return false;

  const allowedFields = ['title', 'model', 'provider', 'token_total'];
  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(field + ' = ?');
      values.push(updates[field]);
    }
  }

  if (setClauses.length === 0) return false;

  // 同时更新 updated_at
  setClauses.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  const result = db.prepare(`
    UPDATE conversations
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `).run(...values);

  return result.changes > 0;
}

/**
 * 删除对话及其所有消息（CASCADE）
 * @param {string} id - 对话 ID
 * @returns {boolean} 是否删除成功
 */
function deleteConversation(id) {
  if (!id || typeof id !== 'string') return false;

  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  if (result.changes > 0) {
    console.log('[Realm AI Conv] 删除对话: ' + id);
    return true;
  }
  return false;
}

// ==================== 消息 CRUD ====================

/**
 * 全量替换保存消息（事务写入，per G-42-2）
 *
 * saveCurrentConversation 每次传入完整 transcript，因此在同一事务内
 * 先 DELETE 该对话的全部旧消息，再按数组顺序插入全部消息：
 * - 重复保存同一 transcript 不再产生重复行（旧实现 msg.id || generateId()
 *   每次保存生成新随机 id，INSERT OR REPLACE 退化为纯 INSERT，
 *   6 条消息曾存出 14 行）
 * - 全量替换语义天然反映消息删减
 * - 替换后 rowid 即 transcript 顺序，为 getMessages 提供稳定 tiebreak
 *
 * 内容归一化（per G-42-3 写入侧）：每条消息经 normalizeMessageColumns
 * 按角色提取——assistant 行 content 列为纯文本、tool_calls 列为
 * [{id,name,arguments}]；toolResult 行 tool_results 列含
 * toolCallId/toolName/isError/details。100KB 截断逻辑继续作用于
 * tool_calls/tool_results 列。
 *
 * @param {string} conversationId - 对话 ID
 * @param {Array} messages - 消息数组（完整 transcript，pi-agent-core AgentMessage）
 * @returns {number} 成功保存的消息数量
 */
function saveMessages(conversationId, messages) {
  if (!conversationId || !Array.isArray(messages) || messages.length === 0) {
    return 0;
  }

  // 验证对话存在
  const conversation = getConversation(conversationId);
  if (!conversation) {
    console.warn('[Realm AI Conv] 对话不存在: ' + conversationId);
    return 0;
  }

  const deleteStmt = db.prepare('DELETE FROM messages WHERE conversation_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results, page_snapshots, attachments, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 全量替换事务（先 DELETE 后 INSERT，原子生效）
  const replaceAll = db.transaction((msgs) => {
    deleteStmt.run(conversationId);
    let count = 0;
    for (const msg of msgs) {
      const id = generateId();
      const cols = normalizeMessageColumns(msg);
      // AgentMessage 有 timestamp 字段（毫秒），兼容 createdAt/created_at 两种命名
      const createdAt = msg.createdAt || msg.created_at || msg.timestamp || Date.now();

      insertStmt.run(
        id,
        conversationId,
        cols.role,
        cols.content,
        serializeToolData(cols.toolCalls),
        serializeToolData(cols.toolResults),
        serializePageSnapshots(cols.pageSnapshots),
        serializeToolData(cols.attachments),
        createdAt
      );
      count++;
    }
    return count;
  });

  const count = replaceAll(messages);
  console.log('[Realm AI Conv] 全量替换保存 ' + count + ' 条消息到对话 ' + conversationId);

  return count;
}

/**
 * 获取对话的所有消息 — renderer 显示形状（per G-42-3 读取侧）
 *
 * 与 getAgentMessages（上下文注入形状）共用 parseStoredContent 与行读取，
 * 但输出面向 renderer renderAIMessages：
 * - user 行 → { id, role:'user', content, timestamp }
 * - assistant 行 → { id, role:'assistant', content, toolExecutions, timestamp }，
 *   toolExecutions 元素形状对齐 renderToolCard 入参 { id, name, status, params, result, error }
 * - 同回合相邻 assistant 行合并为一条显示消息（per G-42-8，仅显示形状）：
 *   pi-agent-core 每次供应商响应落一条 assistant 行，工具回合为三行
 *   assistant(''+tool_calls) → toolResult → assistant(最终文本)。行级 1:1
 *   映射会产出 content:'' 的显示消息（工具卡片回填其上）+ 其后的最终文本
 *   消息，历史恢复渲染出「空气泡 + 工具卡片 + 下方文本」。合并规则
 *   （仅当上一条显示消息存在且为 assistant，天然不跨 user 行）：
 *   1. 纯工具行（无文本有 toolCalls）→ 卡片追加进上一条，不 push
 *   2. 有文本且上一条 content 为空 → 文本采纳进上一条（toolResult 按
 *      toolCallId 反向扫描回填不受影响），不 push；当前行若带 toolCalls
 *      一并追加，避免丢卡片
 *   3. 两条都含文本 → 维持独立 push（保守不合并，保持既有显示语义）
 *   合并时保持上一条的 id 与 timestamp 不变（回合首行锚点，工具卡片与
 *   消息操作按钮依赖该 id 定位）。getAgentMessages 注入形状不受影响
 *   （CR-01 配对 / D-14 工具结果上下文语义保持行级结构）
 * - toolResult 行不单独输出：按 toolCallId 回填前面最近 assistant 行的
 *   toolExecutions 元素（result/status/error），找不到归属时丢弃——
 *   恢复视图中工具调用呈现为父 AI 消息内的工具卡片，与实时链路一致
 * - 旧格式行（content 为 JSON 块数组字符串）经 parseStoredContent 兼容读出
 *
 * @param {string} conversationId - 对话 ID
 * @returns {Array} 显示形状消息列表（直接可赋 renderer state.aiMessages）
 */
function getMessages(conversationId) {
  const rows = readMessageRows(conversationId);

  /** @type {Array} 显示形状消息 */
  const display = [];

  for (const row of rows) {
    const fallbackCalls = safeJsonParse(row.tool_calls, []);
    const { text, toolCalls } = parseStoredContent(row.content, fallbackCalls);

    if (row.role === 'assistant') {
      const executions = toolCalls.map(call => ({
        id: call.id,
        name: call.name,
        status: 'completed',
        params: call.arguments,
      }));

      // 同回合相邻 assistant 行合并（per G-42-8，仅显示形状）
      const last = display[display.length - 1];
      if (last && last.role === 'assistant') {
        if (!text && executions.length > 0) {
          // 规则 1：纯工具行 → 卡片追加进上一条
          last.toolExecutions.push(...executions);
          continue;
        }
        if (text && !last.content) {
          // 规则 2：采纳文本进上一条（最终文本并入工具卡片所在消息）
          last.content = text;
          if (executions.length > 0) last.toolExecutions.push(...executions);
          continue;
        }
        // 规则 3：两条都含文本 → 不合并，走下方独立 push
      }

      display.push({
        id: row.id,
        role: 'assistant',
        content: text,
        toolExecutions: executions,
        timestamp: row.created_at,
      });
      continue;
    }

    if (row.role === 'toolResult') {
      const meta = safeJsonParse(row.tool_results, null);
      const toolCallId = meta && meta.toolCallId;
      if (!toolCallId) continue;

      // 回填前面最近的 assistant 行中匹配的工具卡片（rowid 序保证相邻）
      let target = null;
      for (let i = display.length - 1; i >= 0; i--) {
        const m = display[i];
        if (m.role !== 'assistant' || !Array.isArray(m.toolExecutions)) continue;
        const exec = m.toolExecutions.find(t => t.id === toolCallId);
        if (exec) {
          target = exec;
          break;
        }
      }
      if (!target) continue; // 找不到归属 assistant 行，丢弃该行

      target.result = text;
      target.status = meta.isError ? 'failed' : 'completed';
      if (meta.isError) target.error = text;
      continue;
    }

    // /compact 摘要消息（user 角色包 <context-summary> XML）→ 可折叠摘要框
    // 剥掉 XML 壳透传摘要正文，渲染端默认折叠、点击展开查看
    if (text.startsWith('<context-summary>')) {
      const m = text.match(/^<context-summary>\n?([\s\S]*?)\n?<\/context-summary>$/);
      display.push({
        id: row.id,
        role: 'summary',
        content: (m && m[1] ? m[1] : text).trim(),
        timestamp: row.created_at,
      });
      continue;
    }

    // user 及其他角色 → 用户气泡（attachments 元数据随行带出，供气泡渲染附件徽标）
    display.push({
      id: row.id,
      role: 'user',
      content: text,
      attachments: safeJsonParse(row.attachments, null) || undefined,
      timestamp: row.created_at,
    });
  }

  return display;
}

/**
 * 获取对话的所有消息 — pi-agent-core AgentMessage 注入形状（per G-42-4）
 *
 * 供 ai-manager.switchConversation 在 Agent 重建完成后注入
 * agent.state.messages，使历史消息真正进入 LLM 上下文：
 * - user 行 → { role:'user', content, timestamp }
 * - assistant 行 → { role:'assistant', content: [text 块 + toolCall 块原样],
 *   api:'unknown', usage/stopReason 占位, timestamp }——provenance 占位安全：
 *   pi-ai 各 API 适配器构建请求只读 message.role 与 content 块，
 *   不读 usage/stopReason/api 等 provenance 字段
 * - toolResult 行 → { role:'toolResult', toolCallId, toolName,
 *   content:[text 块], isError/details（有则带）, timestamp }；
 *   tool_results 列缺失或无 toolCallId 的行跳过（元数据无从重建）
 * - 配对完整性（per CR-01）：provider API 要求 toolCall 与其 toolResult
 *   严格配对，任一侧缺失请求即被拒绝。第一遍扫描收集两侧配对键后：
 *   - assistant 行中无 toolResult 配对的孤儿 toolCall，紧随该行合成占位
 *     toolResult 补齐配对（保留「工具运行过」的历史语义；旧格式行
 *     tool_results 列恒为 NULL、超限截断/行损坏均落入此分支）
 *   - 反向孤儿（toolCallId 无任何 assistant toolCall 引用）的 toolResult
 *     行跳过，配对在两个方向上都闭合
 * - assistant 行 content 全空（无文本无工具调用）时跳过——空 content 块
 *   数组可能被 provider API 拒绝
 * - 旧格式 JSON 块数组行同样经 parseStoredContent 兼容；thinking 块
 *   在解析层已过滤，不会注入
 *
 * @param {string} conversationId - 对话 ID
 * @returns {Array} AgentMessage 形状消息列表（顺序即行序，配对相邻）
 */
function getAgentMessages(conversationId) {
  const rows = readMessageRows(conversationId);

  /** @type {Array} AgentMessage 形状消息 */
  const agentMessages = [];

  // 第一遍扫描：收集两侧配对键（per CR-01）
  // - resultCallIds：toolResult 行能读出的 toolCallId 集合
  // - assistantCallIds：assistant 行 toolCall 块引用的 id 集合
  const resultCallIds = new Set();
  const assistantCallIds = new Set();
  for (const row of rows) {
    if (row.role === 'toolResult') {
      const meta = safeJsonParse(row.tool_results, null);
      if (meta && meta.toolCallId) resultCallIds.add(meta.toolCallId);
    } else if (row.role === 'assistant') {
      const rowCalls = parseStoredContent(row.content, safeJsonParse(row.tool_calls, [])).toolCalls;
      for (const call of rowCalls) {
        if (call && call.id) assistantCallIds.add(call.id);
      }
    }
  }

  for (const row of rows) {
    const fallbackCalls = safeJsonParse(row.tool_calls, []);
    const parsed = parseStoredContent(row.content, fallbackCalls);

    if (row.role === 'assistant') {
      const content = [];
      if (parsed.text) {
        content.push({ type: 'text', text: parsed.text });
      }
      /** @type {Array} 无 toolResult 配对的孤儿 toolCall（按块序） */
      const orphanCalls = [];
      for (const call of parsed.toolCalls) {
        // 无 id 的坏块永远无法配对，直接跳过（注入同样会被 provider 拒绝）
        if (!call || !call.id) continue;
        const { id, name, arguments: args, ...rest } = call;
        if (!resultCallIds.has(id)) orphanCalls.push({ id, name });
        // 原样保留 id/name/arguments 及其余块字段（如 thoughtSignature）
        content.push({ type: 'toolCall', id, name, arguments: args != null ? args : {}, ...rest });
      }
      if (content.length === 0) continue;

      agentMessages.push({
        role: 'assistant',
        content,
        api: 'unknown',
        provider: row.provider || '',
        model: '',
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        stopReason: 'stop',
        timestamp: row.created_at,
      });

      // 孤儿 toolCall 紧随其后合成占位 toolResult，维持 provider 配对约束
      //（旧格式行 tool_results 列恒为 NULL、超限截断/行损坏时无配对元数据）
      for (const orphan of orphanCalls) {
        agentMessages.push({
          role: 'toolResult',
          toolCallId: orphan.id,
          toolName: orphan.name || '',
          content: [{ type: 'text', text: '（历史工具结果未记录）' }],
          timestamp: row.created_at,
        });
      }
      continue;
    }

    if (row.role === 'toolResult') {
      const meta = safeJsonParse(row.tool_results, null);
      if (!meta || !meta.toolCallId) continue;
      // 反向孤儿（无任何 assistant toolCall 引用该 id）同样跳过
      if (!assistantCallIds.has(meta.toolCallId)) continue;

      const msg = {
        role: 'toolResult',
        toolCallId: meta.toolCallId,
        toolName: meta.toolName || '',
        content: [{ type: 'text', text: parsed.text }],
        timestamp: row.created_at,
      };
      if (meta.isError !== undefined) msg.isError = !!meta.isError;
      if (meta.details !== undefined) msg.details = meta.details;
      agentMessages.push(msg);
      continue;
    }

    // user 及其他角色
    agentMessages.push({
      role: 'user',
      content: parsed.text,
      timestamp: row.created_at,
    });
  }

  return agentMessages;
}

/**
 * 获取对话的消息数量
 * @param {string} conversationId - 对话 ID
 * @returns {number} 消息数量
 */
function getMessageCount(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') return 0;

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
  `).get(conversationId);

  return row ? row.count : 0;
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  saveMessages,
  getMessages,
  getAgentMessages,
  getMessageCount,
};

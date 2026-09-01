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
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages (conversation_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_conversations_updated
      ON conversations (updated_at DESC);
  `);

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
 * 获取对话列表（按 updated_at 降序）
 * @param {number} [limit=50] - 返回数量上限
 * @returns {Array} 对话列表
 */
function getConversations(limit = 50) {
  return db.prepare(`
    SELECT id, title, model, provider, token_total, created_at, updated_at
    FROM conversations
    ORDER BY updated_at DESC
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
 * 批量保存消息（事务写入）
 * @param {string} conversationId - 对话 ID
 * @param {Array} messages - 消息数组
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

  const now = Date.now();
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO messages (id, conversation_id, role, content, tool_calls, tool_results, page_snapshots, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 事务写入（per history-manager.js 模式）
  const insertMany = db.transaction((msgs) => {
    let count = 0;
    for (const msg of msgs) {
      const id = msg.id || generateId();
      const role = msg.role || 'user';
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
      const toolCalls = serializeToolData(msg.toolCalls || msg.tool_calls);
      const toolResults = serializeToolData(msg.toolResults || msg.tool_results);
      const pageSnapshots = serializePageSnapshots(msg.pageSnapshots || msg.page_snapshots);
      const createdAt = msg.createdAt || msg.created_at || now;

      insertStmt.run(id, conversationId, role, content, toolCalls, toolResults, pageSnapshots, createdAt);
      count++;
    }
    return count;
  });

  const count = insertMany(messages);
  console.log('[Realm AI Conv] 保存 ' + count + ' 条消息到对话 ' + conversationId);

  return count;
}

/**
 * 获取对话的所有消息（按 created_at 升序）
 * @param {string} conversationId - 对话 ID
 * @returns {Array} 消息列表
 */
function getMessages(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') return [];

  const rows = db.prepare(`
    SELECT id, conversation_id, role, content, tool_calls, tool_results, page_snapshots, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `).all(conversationId);

  // 反序列化 JSON 字段
  return rows.map(row => ({
    ...row,
    tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
    tool_results: row.tool_results ? JSON.parse(row.tool_results) : null,
    page_snapshots: row.page_snapshots ? JSON.parse(row.page_snapshots) : null,
  }));
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
  getMessageCount,
};

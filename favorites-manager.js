/**
 * Realm Browser - 收藏夹管理模块
 *
 * 使用 better-sqlite3 管理收藏夹数据的 CRUD 操作。
 * 每个容器使用独立的 SQLite 表（favorites_{containerId}）实现数据隔离。
 * 与 history-manager.js 共享同一数据库连接实例。
 *
 * 依赖：better-sqlite3（通过 setDatabase 注入）
 * 数据库路径：{userData}/history.db（与历史记录共享）
 */

const path = require('path');
const { app } = require('electron');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载
let Database = null;

// 数据库路径（延迟初始化，避免 app.getPath 在 ready 前调用）
let DB_PATH = null;

// 数据库连接实例（可通过 setDatabase 注入外部实例）
let db = null;

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库连接，设置 WAL 模式和同步级别
 * 应在 app.whenReady 之后调用
 * 如果已通过 setDatabase 注入实例，则跳过初始化
 */
function initDatabase() {
  if (db) return;

  // 延迟加载原生模块和路径，确保在 app.whenReady 之后执行
  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'history.db');
  }

  db = new Database(DB_PATH);
  // WAL 模式：提升并发读写性能
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');

  console.log(`[Realm] 收藏夹数据库已初始化: ${DB_PATH}`);
}

/**
 * 注入外部数据库实例（与 history-manager.js 共享连接）
 * @param {Object} dbInstance - better-sqlite3 数据库实例
 */
function setDatabase(dbInstance) {
  db = dbInstance;
}

// ==================== 安全验证 ====================

/**
 * 验证容器 ID 格式（防 SQL 注入）
 * 仅允许小写字母、数字和连字符
 * @param {string} containerId - 容器 ID
 * @returns {string} 验证通过的容器 ID
 * @throws {Error} 格式不合法时抛出
 */
function sanitizeContainerId(containerId) {
  if (!containerId || typeof containerId !== 'string') {
    throw new Error('容器 ID 不能为空');
  }
  if (!/^[a-z0-9-]+$/.test(containerId)) {
    throw new Error(`容器 ID 格式不合法: ${containerId}`);
  }
  return containerId;
}

// ==================== 表管理 ====================

/**
 * 确保容器对应的收藏表存在
 * @param {string} containerId - 容器 ID
 */
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

// ==================== CRUD 操作 ====================

/**
 * 添加收藏记录
 * @param {string} containerId - 容器 ID
 * @param {Object} record - 记录数据
 * @param {string} record.url - 页面 URL
 * @param {string} [record.title] - 页面标题
 * @param {string} [record.faviconUrl] - favicon URL
 * @returns {{id: number}|{error: string, message: string}} 新记录的 ID 或重复错误
 */
function addRecord(containerId, { url, title = '', faviconUrl = '' }) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `favorites_${id}`;

  // 使用 INSERT OR IGNORE 处理 UNIQUE 约束冲突
  const result = db.prepare(`
    INSERT OR IGNORE INTO ${tableName} (url, title, favicon_url)
    VALUES (?, ?, ?)
  `).run(url, title, faviconUrl);

  // lastInsertRowid 为 0 表示插入被忽略（URL 已存在）
  if (result.lastInsertRowid === 0n || result.lastInsertRowid === 0) {
    return { error: 'duplicate', message: '已收藏过该页面' };
  }

  return { id: result.lastInsertRowid };
}

/**
 * 更新收藏记录标题
 * @param {string} containerId - 容器 ID
 * @param {number} id - 记录 ID
 * @param {Object} updates - 更新内容
 * @param {string} updates.title - 新标题
 * @returns {boolean} 是否更新成功
 */
function updateRecord(containerId, id, { title }) {
  const cid = sanitizeContainerId(containerId);
  ensureTable(cid);
  const tableName = `favorites_${cid}`;

  const result = db.prepare(`
    UPDATE ${tableName} SET title = ? WHERE id = ?
  `).run(title, id);

  return result.changes > 0;
}

/**
 * 删除单条收藏记录
 * @param {string} containerId - 容器 ID
 * @param {number} id - 记录 ID
 * @returns {boolean} 是否删除成功
 */
function deleteRecord(containerId, id) {
  const cid = sanitizeContainerId(containerId);
  ensureTable(cid);
  const tableName = `favorites_${cid}`;

  const result = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
  return result.changes > 0;
}

/**
 * 批量删除收藏记录
 * @param {string} containerId - 容器 ID
 * @param {Array<number>} ids - 记录 ID 数组
 * @returns {number} 删除的记录数
 */
function deleteRecords(containerId, ids) {
  const cid = sanitizeContainerId(containerId);
  ensureTable(cid);
  const tableName = `favorites_${cid}`;

  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`).run(...ids);
  return result.changes;
}

/**
 * 列出收藏记录（按收藏时间倒序）
 * @param {string} containerId - 容器 ID
 * @param {Object} options - 分页选项
 * @param {number} [options.offset=0] - 分页偏移
 * @param {number} [options.limit=50] - 每页数量
 * @returns {Array} 记录列表
 */
function listRecords(containerId, { offset = 0, limit = 50 }) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `favorites_${id}`;

  return db.prepare(`
    SELECT * FROM ${tableName}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

/**
 * 搜索收藏记录（按标题或 URL 模糊匹配）
 * @param {string} containerId - 容器 ID
 * @param {Object} options - 搜索选项
 * @param {string} options.keyword - 搜索关键词
 * @param {number} [options.offset=0] - 分页偏移
 * @param {number} [options.limit=50] - 每页数量
 * @returns {Array} 匹配的记录列表
 */
function searchRecords(containerId, { keyword, offset = 0, limit = 50 }) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `favorites_${id}`;

  const pattern = `%${keyword}%`;
  return db.prepare(`
    SELECT * FROM ${tableName}
    WHERE url LIKE ? OR title LIKE ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(pattern, pattern, limit, offset);
}

/**
 * 检查 URL 是否已收藏
 * @param {string} containerId - 容器 ID
 * @param {string} url - 页面 URL
 * @returns {{id: number, title: string, favicon_url: string}|null} 收藏记录或 null
 */
function checkUrl(containerId, url) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `favorites_${id}`;

  return db.prepare(`
    SELECT id, title, favicon_url FROM ${tableName}
    WHERE url = ? LIMIT 1
  `).get(url) || null;
}

/**
 * 获取容器收藏记录总数
 * @param {string} containerId - 容器 ID
 * @returns {number} 记录总数
 */
function getCount(containerId) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `favorites_${id}`;

  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
  return row.count;
}

/**
 * 删除容器的收藏表（容器删除时调用）
 * @param {string} containerId - 容器 ID
 */
function dropTable(containerId) {
  const id = sanitizeContainerId(containerId);
  const tableName = `favorites_${id}`;
  db.exec(`DROP TABLE IF EXISTS ${tableName}`);
  console.log(`[Realm] 已删除收藏表: ${tableName}`);
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  setDatabase,
  addRecord,
  updateRecord,
  deleteRecord,
  deleteRecords,
  listRecords,
  searchRecords,
  checkUrl,
  getCount,
  dropTable,
};

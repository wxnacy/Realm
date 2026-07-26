/**
 * Realm Browser - 收藏夹管理模块
 *
 * 使用 better-sqlite3 管理收藏夹数据的 CRUD 操作。
 * 使用单一全局 favorites 表存储所有收藏数据，与容器生命周期解耦。
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

// ==================== 表管理 ====================

/**
 * 确保全局收藏表存在（无参数，固定操作全局 favorites 表）
 */
function ensureTable() {
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
}

/**
 * 迁移到全局收藏表模式
 * 删除所有旧的 per-container 收藏表（favorites_{containerId}），创建全局 favorites 表
 * 应在应用启动时 initDatabase() 之后调用
 */
function migrateToGlobal() {
  // 查询所有旧的 per-container 收藏表
  const oldTables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name LIKE 'favorites_%'
  `).all();

  // 逐个删除旧表
  for (const { name } of oldTables) {
    db.exec(`DROP TABLE IF EXISTS ${name}`);
    console.log(`[Realm] 已删除旧收藏表: ${name}`);
  }

  // 确保全局表存在
  ensureTable();

  console.log('[Realm] 收藏表已迁移到全局模式');
}

// ==================== CRUD 操作 ====================

/**
 * 添加收藏记录
 * @param {Object} record - 记录数据
 * @param {string} record.url - 页面 URL
 * @param {string} [record.title] - 页面标题
 * @param {string} [record.faviconUrl] - favicon URL
 * @returns {{id: number}|{error: string, message: string}} 新记录的 ID 或重复错误
 */
function addRecord({ url, title = '', faviconUrl = '' }) {
  ensureTable();

  // 使用 INSERT OR IGNORE 处理 UNIQUE 约束冲突
  const result = db.prepare(`
    INSERT OR IGNORE INTO favorites (url, title, favicon_url)
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
 * @param {number} id - 记录 ID
 * @param {Object} updates - 更新内容
 * @param {string} updates.title - 新标题
 * @returns {boolean} 是否更新成功
 */
function updateRecord(id, { title }) {
  ensureTable();

  const result = db.prepare(`
    UPDATE favorites SET title = ? WHERE id = ?
  `).run(title, id);

  return result.changes > 0;
}

/**
 * 删除单条收藏记录
 * @param {number} id - 记录 ID
 * @returns {boolean} 是否删除成功
 */
function deleteRecord(id) {
  ensureTable();

  const result = db.prepare('DELETE FROM favorites WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * 批量删除收藏记录
 * @param {Array<number>} ids - 记录 ID 数组
 * @returns {number} 删除的记录数
 */
function deleteRecords(ids) {
  ensureTable();

  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`DELETE FROM favorites WHERE id IN (${placeholders})`).run(...ids);
  return result.changes;
}

/**
 * 列出收藏记录（按收藏时间倒序）
 * @param {Object} options - 分页选项
 * @param {number} [options.offset=0] - 分页偏移
 * @param {number} [options.limit=50] - 每页数量
 * @returns {Array} 记录列表
 */
function listRecords({ offset = 0, limit = 50 }) {
  ensureTable();

  return db.prepare(`
    SELECT * FROM favorites
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

/**
 * 搜索收藏记录（按标题或 URL 模糊匹配）
 * @param {Object} options - 搜索选项
 * @param {string} options.keyword - 搜索关键词
 * @param {number} [options.offset=0] - 分页偏移
 * @param {number} [options.limit=50] - 每页数量
 * @returns {Array} 匹配的记录列表
 */
function searchRecords({ keyword, offset = 0, limit = 50 }) {
  ensureTable();

  const pattern = `%${keyword}%`;
  return db.prepare(`
    SELECT * FROM favorites
    WHERE url LIKE ? OR title LIKE ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(pattern, pattern, limit, offset);
}

/**
 * 检查 URL 是否已收藏
 * @param {string} url - 页面 URL
 * @returns {{id: number, title: string, favicon_url: string}|null} 收藏记录或 null
 */
function checkUrl(url) {
  ensureTable();

  return db.prepare(`
    SELECT id, title, favicon_url FROM favorites
    WHERE url = ? LIMIT 1
  `).get(url) || null;
}

/**
 * 获取收藏记录总数
 * @returns {number} 记录总数
 */
function getCount() {
  ensureTable();

  const row = db.prepare('SELECT COUNT(*) as count FROM favorites').get();
  return row.count;
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  setDatabase,
  migrateToGlobal,
  addRecord,
  updateRecord,
  deleteRecord,
  deleteRecords,
  listRecords,
  searchRecords,
  checkUrl,
  getCount,
};

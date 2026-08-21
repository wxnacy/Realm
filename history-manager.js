/**
 * Realm Browser - 浏览历史记录管理模块
 *
 * 使用 better-sqlite3 管理浏览历史记录的 CRUD 操作。
 * 每个容器使用独立的 SQLite 表（history_{containerId}）实现数据隔离。
 * 超过 10000 条记录时自动 FIFO 淘汰最旧记录。
 *
 * 依赖：better-sqlite3
 * 数据库路径：{userData}/history.db
 */

const path = require('path');
const { app } = require('electron');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载，
// 否则 Electron 早期启动阶段会导致 SIGSEGV 段错误
let Database = null;

// 数据库路径（延迟初始化，避免 app.getPath 在 ready 前调用）
let DB_PATH = null;

// 每容器最大记录数（D-19 FIFO 淘汰阈值）
const MAX_RECORDS_PER_CONTAINER = 10000;

// 数据库连接实例（模块加载时初始化）
let db = null;

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库连接，设置 WAL 模式和同步级别
 * 应在 app.whenReady 之后调用
 */
function initDatabase() {
  if (db) return;

  // 延迟加载原生模块和路径，确保在 app.whenReady 之后执行
  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'history.db');
  }

  db = new Database(DB_PATH);
  // WAL 模式：提升并发读写性能（RESEARCH Pattern 1）
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');

  console.log(`[Realm] 历史记录数据库已初始化: ${DB_PATH}`);
}

// ==================== 安全验证 ====================

/**
 * 验证容器 ID 格式（防 SQL 注入，RESEARCH Pitfall 3）
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
 * 确保容器对应的历史记录表存在
 * @param {string} containerId - 容器 ID
 */
function ensureTable(containerId) {
  const id = sanitizeContainerId(containerId);
  const tableName = `history_${id}`;

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

// ==================== FIFO 淘汰 ====================

/**
 * 执行 FIFO 淘汰：超过 MAX_RECORDS_PER_CONTAINER 时删除最旧记录（D-19/D-20）
 * @param {string} containerId - 容器 ID
 */
function enforceLimit(containerId) {
  const id = sanitizeContainerId(containerId);
  const tableName = `history_${id}`;

  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
  if (row.count > MAX_RECORDS_PER_CONTAINER) {
    const excess = row.count - MAX_RECORDS_PER_CONTAINER;
    db.prepare(`
      DELETE FROM ${tableName} WHERE id IN (
        SELECT id FROM ${tableName} ORDER BY visited_at ASC LIMIT ?
      )
    `).run(excess);
    console.log(`[Realm] FIFO 淘汰: ${containerId} 删除 ${excess} 条旧记录`);
  }
}

// ==================== CRUD 操作 ====================

/**
 * 添加历史记录
 * @param {string} containerId - 容器 ID
 * @param {Object} record - 记录数据
 * @param {string} record.url - 页面 URL
 * @param {string} [record.title] - 页面标题
 * @param {string} [record.faviconUrl] - favicon URL
 * @param {number} [record.visitedAt] - 访问时间戳（毫秒）
 * @returns {{id: number}} 新记录的 ID
 */
function addRecord(containerId, { url, title = '', faviconUrl = '', visitedAt }) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `history_${id}`;

  const ts = visitedAt || Date.now();
  const result = db.prepare(`
    INSERT INTO ${tableName} (url, title, favicon_url, visited_at)
    VALUES (?, ?, ?, ?)
  `).run(url, title, faviconUrl, ts);

  // FIFO 淘汰（D-20 无感知）
  enforceLimit(id);

  return { id: result.lastInsertRowid };
}

/**
 * 更新最近一条匹配记录的标题（page-title-updated 事件触发时使用）
 * @param {string} containerId - 容器 ID
 * @param {string} url - 匹配的 URL
 * @param {string} title - 新标题
 * @returns {boolean} 是否更新成功
 */
function updateLastTitle(containerId, url, title) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `history_${id}`;

  const result = db.prepare(`
    UPDATE ${tableName} SET title = ?
    WHERE id = (
      SELECT id FROM ${tableName} WHERE url = ? ORDER BY visited_at DESC LIMIT 1
    )
  `).run(title, url);

  return result.changes > 0;
}

/**
 * 搜索历史记录（按 URL 或标题模糊匹配）
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
  const tableName = `history_${id}`;

  const pattern = `%${keyword}%`;
  return db.prepare(`
    SELECT * FROM ${tableName}
    WHERE url LIKE ? OR title LIKE ?
    ORDER BY visited_at DESC
    LIMIT ? OFFSET ?
  `).all(pattern, pattern, limit, offset);
}

/**
 * 列出历史记录（按时间倒序）
 * @param {string} containerId - 容器 ID
 * @param {Object} options - 分页选项
 * @param {number} [options.offset=0] - 分页偏移
 * @param {number} [options.limit=50] - 每页数量
 * @returns {Array} 记录列表
 */
function listRecords(containerId, { offset = 0, limit = 50 }) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `history_${id}`;

  return db.prepare(`
    SELECT * FROM ${tableName}
    ORDER BY visited_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

/**
 * 删除单条历史记录
 * @param {string} containerId - 容器 ID
 * @param {number} id - 记录 ID
 * @returns {boolean} 是否删除成功
 */
function deleteRecord(containerId, id) {
  const cid = sanitizeContainerId(containerId);
  ensureTable(cid);
  const tableName = `history_${cid}`;

  const result = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
  return result.changes > 0;
}

/**
 * 批量删除历史记录
 * @param {string} containerId - 容器 ID
 * @param {Array<number>} ids - 记录 ID 数组
 * @returns {number} 删除的记录数
 */
function deleteRecords(containerId, ids) {
  const cid = sanitizeContainerId(containerId);
  ensureTable(cid);
  const tableName = `history_${cid}`;

  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`).run(...ids);
  return result.changes;
}

/**
 * 清空容器的全部历史记录
 * @param {string} containerId - 容器 ID
 * @returns {number} 删除的记录数
 */
function clearRecords(containerId) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `history_${id}`;

  const result = db.prepare(`DELETE FROM ${tableName}`).run();
  return result.changes;
}

/**
 * 获取容器历史记录总数
 * @param {string} containerId - 容器 ID
 * @returns {number} 记录总数
 */
function getCount(containerId) {
  const id = sanitizeContainerId(containerId);
  ensureTable(id);
  const tableName = `history_${id}`;

  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
  return row.count;
}

/**
 * 删除容器的历史记录表（容器删除时调用）
 * @param {string} containerId - 容器 ID
 */
function dropTable(containerId) {
  const id = sanitizeContainerId(containerId);
  const tableName = `history_${id}`;
  db.exec(`DROP TABLE IF EXISTS ${tableName}`);
  console.log(`[Realm] 已删除历史记录表: ${tableName}`);
}

// ==================== 跨容器搜索 ====================

/**
 * 跨所有容器搜索历史记录（URL 和标题模糊匹配）
 * 使用 UNION ALL 合并所有 history_* 表，按访问时间倒序返回
 *
 * 用途：地址栏自动补全（Phase 37），需要搜索全部容器的历史记录
 *
 * @param {string} keyword - 搜索关键词
 * @param {number} [limit=20] - 返回结果数量限制
 * @returns {Array<{url: string, title: string, favicon_url: string, visited_at: number}>} 匹配的记录列表
 */
function searchAllContainers(keyword, limit = 20) {
  if (!db) {
    console.error('[Realm] 数据库未初始化，请先调用 initDatabase()');
    return [];
  }

  if (!keyword || keyword.trim() === '') {
    return [];
  }

  try {
    // 获取所有 history_* 表名
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'history_%'"
    ).all();

    if (tables.length === 0) {
      return [];
    }

    // 构建 UNION ALL 查询：每个子查询从对应表中搜索
    const pattern = `%${keyword}%`;
    const unionQueries = tables.map(table => `
      SELECT url, title, favicon_url, visited_at
      FROM ${table.name}
      WHERE url LIKE ? OR title LIKE ?
    `).join(' UNION ALL ');

    // 最外层按访问时间倒序，截取 limit 条
    const query = `
      SELECT * FROM (
        ${unionQueries}
      )
      ORDER BY visited_at DESC
      LIMIT ?
    `;

    // 每个子查询两个参数（pattern 用于 url 和 title）
    const params = [];
    for (let i = 0; i < tables.length; i++) {
      params.push(pattern, pattern);
    }
    params.push(limit);

    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('[Realm] 跨容器搜索历史记录失败:', error);
    return [];
  }
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  addRecord,
  updateLastTitle,
  searchRecords,
  searchAllContainers,
  listRecords,
  deleteRecord,
  deleteRecords,
  clearRecords,
  getCount,
  dropTable,
};

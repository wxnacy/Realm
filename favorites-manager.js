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
  // 启用外键约束（better-sqlite3 默认关闭，级联删除依赖此设置）
  db.pragma('foreign_keys = ON');

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
 * 确保全局收藏表和文件夹表存在（无参数，固定操作全局表）
 *
 * 表结构说明：
 * - favorite_folders: 收藏夹文件夹表，支持无限层级嵌套（parent_id 自引用）
 * - favorites: 收藏记录表，新增 folder_id（关联文件夹）和 sort_order（排序）字段
 *
 * 迁移策略：
 * - folder_id 默认值 0 表示根目录（无文件夹）
 * - sort_order 默认值 0 表示未排序
 * - 使用 try-catch 包裹 ALTER TABLE，因为列已存在时会报错（幂等启动）
 */
function ensureTable() {
  // 创建收藏夹文件夹表（支持无限层级嵌套）
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorite_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      parent_id INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (parent_id) REFERENCES favorite_folders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_favorite_folders_parent_id
      ON favorite_folders (parent_id);
    CREATE INDEX IF NOT EXISTS idx_favorite_folders_sort_order
      ON favorite_folders (sort_order);
  `);

  // 确保收藏记录表存在
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

  // 迁移：为 favorites 表添加 folder_id 字段（默认值 0 表示根目录）
  try {
    db.exec('ALTER TABLE favorites ADD COLUMN folder_id INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    // 列已存在时忽略（幂等启动）
  }

  // 迁移：为 favorites 表添加 sort_order 字段
  try {
    db.exec('ALTER TABLE favorites ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    // 列已存在时忽略（幂等启动）
  }
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

// ==================== 文件夹 CRUD 操作 ====================

/**
 * 检查目标文件夹是否是源文件夹的后代（防止循环引用）
 * 递归遍历目标文件夹的祖先链，如果遇到源文件夹 ID 则说明会形成循环
 * @param {number} sourceId - 源文件夹 ID
 * @param {number} targetId - 目标文件夹 ID
 * @returns {boolean} 是否会形成循环
 */
function isDescendant(sourceId, targetId) {
  let currentId = targetId;
  // 防止死循环的安全限制（最多遍历 100 层）
  const maxDepth = 100;
  let depth = 0;

  while (currentId !== 0 && depth < maxDepth) {
    const folder = db.prepare('SELECT parent_id FROM favorite_folders WHERE id = ?').get(currentId);
    if (!folder) break;
    if (folder.parent_id === sourceId) return true;
    currentId = folder.parent_id;
    depth++;
  }

  return false;
}

/**
 * 创建收藏夹文件夹
 * @param {Object} options
 * @param {string} options.name - 文件夹名称
 * @param {number} [options.parentId=0] - 父文件夹 ID（0 表示根目录）
 * @returns {{id: number}|{error: string, message: string}} 新文件夹 ID 或错误
 */
function createFolder({ name, parentId = 0 }) {
  ensureTable();

  // 验证父文件夹存在（parentId=0 表示根目录，无需验证）
  if (parentId !== 0) {
    const parent = db.prepare('SELECT id FROM favorite_folders WHERE id = ?').get(parentId);
    if (!parent) {
      return { error: 'not_found', message: '父文件夹不存在' };
    }
  }

  // 计算排序值：取当前最大 sort_order + 1
  const maxSort = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM favorite_folders WHERE parent_id = ?'
  ).get(parentId);

  const result = db.prepare(`
    INSERT INTO favorite_folders (name, parent_id, sort_order)
    VALUES (?, ?, ?)
  `).run(name, parentId, maxSort.next_sort);

  return { id: result.lastInsertRowid };
}

/**
 * 重命名文件夹
 * @param {number} id - 文件夹 ID
 * @param {Object} updates
 * @param {string} updates.name - 新名称
 * @returns {boolean} 是否成功
 */
function renameFolder(id, { name }) {
  ensureTable();

  const result = db.prepare('UPDATE favorite_folders SET name = ? WHERE id = ?').run(name, id);
  return result.changes > 0;
}

/**
 * 删除文件夹（级联删除子文件夹和收藏项）
 * 依赖 SQLite ON DELETE CASCADE 外键约束
 * @param {number} id - 文件夹 ID
 * @returns {{success: boolean, message?: string}} 结果
 */
function deleteFolder(id) {
  ensureTable();

  // 不能删除根目录（id=0 是虚拟根目录，不存在于表中）
  if (id === 0) {
    return { success: false, message: '无法删除根目录' };
  }

  const result = db.prepare('DELETE FROM favorite_folders WHERE id = ?').run(id);
  return { success: result.changes > 0 };
}

/**
 * 列出指定父文件夹下的子文件夹（按 sort_order 排序）
 * @param {number} [parentId=0] - 父文件夹 ID
 * @returns {Array} 文件夹列表
 */
function listFolders(parentId = 0) {
  ensureTable();

  return db.prepare(`
    SELECT * FROM favorite_folders
    WHERE parent_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(parentId);
}

/**
 * 获取完整的文件夹树结构（递归构建）
 * @param {number} [parentId=0] - 起始父文件夹 ID
 * @returns {Array} 树形结构的文件夹列表
 */
function getFolderTree(parentId = 0) {
  ensureTable();

  const folders = db.prepare(`
    SELECT * FROM favorite_folders
    WHERE parent_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(parentId);

  return folders.map(folder => ({
    ...folder,
    children: getFolderTree(folder.id),
  }));
}

/**
 * 移动文件夹到新的父文件夹
 * @param {number} id - 文件夹 ID
 * @param {Object} options
 * @param {number} options.parentId - 目标父文件夹 ID
 * @returns {{success: boolean, message?: string}} 结果
 */
function moveFolder(id, { parentId }) {
  ensureTable();

  // 不能移动到自身
  if (id === parentId) {
    return { success: false, message: '不能将文件夹移动到自身' };
  }

  // 循环引用检测：目标不能是自己的后代
  if (parentId !== 0 && isDescendant(id, parentId)) {
    return { success: false, message: '不能将文件夹移动到自己的子文件夹中（循环引用）' };
  }

  // 计算排序值：取目标位置最大 sort_order + 1
  const maxSort = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM favorite_folders WHERE parent_id = ?'
  ).get(parentId);

  const result = db.prepare('UPDATE favorite_folders SET parent_id = ?, sort_order = ? WHERE id = ?')
    .run(parentId, maxSort.next_sort, id);

  return { success: result.changes > 0 };
}

// ==================== 收藏项移动与排序 ====================

/**
 * 将收藏项移动到指定文件夹
 * @param {number} id - 收藏项 ID
 * @param {Object} options
 * @param {number} options.folderId - 目标文件夹 ID（0 表示根目录）
 * @returns {boolean} 是否成功
 */
function moveFavorite(id, { folderId }) {
  ensureTable();

  const result = db.prepare('UPDATE favorites SET folder_id = ? WHERE id = ?').run(folderId, id);
  return result.changes > 0;
}

/**
 * 批量移动收藏项到指定文件夹
 * @param {Array<number>} ids - 收藏项 ID 数组
 * @param {Object} options
 * @param {number} options.folderId - 目标文件夹 ID
 * @returns {number} 成功移动的数量
 */
function moveFavorites(ids, { folderId }) {
  ensureTable();

  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`UPDATE favorites SET folder_id = ? WHERE id IN (${placeholders})`)
    .run(folderId, ...ids);

  return result.changes;
}

/**
 * 更新文件夹的排序位置
 * @param {number} id - 文件夹 ID
 * @param {Object} options
 * @param {number} options.sortOrder - 新的排序值
 * @returns {boolean} 是否成功
 */
function updateFolderSort(id, { sortOrder }) {
  ensureTable();

  const result = db.prepare('UPDATE favorite_folders SET sort_order = ? WHERE id = ?')
    .run(sortOrder, id);

  return result.changes > 0;
}

/**
 * 更新收藏项的排序位置
 * @param {number} id - 收藏项 ID
 * @param {Object} options
 * @param {number} options.sortOrder - 新的排序值
 * @returns {boolean} 是否成功
 */
function updateFavoriteSort(id, { sortOrder }) {
  ensureTable();

  const result = db.prepare('UPDATE favorites SET sort_order = ? WHERE id = ?')
    .run(sortOrder, id);

  return result.changes > 0;
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
  // 文件夹 CRUD
  createFolder,
  renameFolder,
  deleteFolder,
  listFolders,
  getFolderTree,
  moveFolder,
  // 收藏项移动与排序
  moveFavorite,
  moveFavorites,
  updateFolderSort,
  updateFavoriteSort,
};

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
const fs = require('fs');
const { app } = require('electron');
const { generateKeyBetween, generateNKeysBetween } = require('./vendor/fractional-indexing');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载
let Database = null;

// nodejieba 延迟加载：原生模块必须在 app.whenReady 之后加载
let nodejieba = null;

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
  registerFts5Functions(db);

  console.log(`[Realm] 收藏夹数据库已初始化: ${DB_PATH}`);
}

/**
 * 注册 FTS5 触发器依赖的 SQL 函数（segmentForFts5）
 *
 * FTS5 触发器体内引用 segmentForFts5(...)（SQL 侧），但它是 JS 函数，
 * 必须注册为 SQLite UDF，否则任何 favorites 写入（INSERT/UPDATE/DELETE）
 * 在 prepare 阶段编译触发器程序时即报 "no such function: segmentForFts5"。
 * UDF 注册是 per-connection 且不持久化，initDatabase / setDatabase 都要调用。
 *
 * @param {Object} database - better-sqlite3 数据库实例
 */
function registerFts5Functions(database) {
  database.function('segmentForFts5', { deterministic: true }, segmentForFts5);
}

/**
 * 注入外部数据库实例（与 history-manager.js 共享连接）
 * @param {Object} dbInstance - better-sqlite3 数据库实例
 */
function setDatabase(dbInstance) {
  db = dbInstance;
  registerFts5Functions(db);
}

// ==================== 表管理 ====================

/**
 * 标记 sort_order 迁移是否已完成（模块级变量，避免重复执行）
 * @type {boolean}
 */
let sortOrderMigrated = false;

/**
 * 迁移 sort_order 从整数到 fractional indexing 字符串
 *
 * 将 favorites 和 favorite_folders 表中的整数 sort_order 值转换为
 * fractional indexing 分数索引字符串，支持拖拽排序的插入操作。
 *
 * 迁移策略：
 * - 检查是否存在整数 sort_order 记录
 * - 按 sort_order ASC, created_at ASC 排序（per D-13：按创建时间初始化）
 * - 使用 generateNKeysBetween 生成初始分数索引键
 * - 迁移完成后设置标志位避免重复执行
 *
 * 应在 ensureTable() 中调用
 */
function migrateSortOrder() {
  if (sortOrderMigrated) return;

  // 检查 favorites 表是否存在非法 sort_order 记录：
  // INTEGER（addRecord 历史落列默认值 0）或文本 '0'（导入历史残留），
  // 二者与 fractional 文本键混合会导致 SQLite 类型序/字典序排序错乱
  const favRows = db.prepare(
    "SELECT COUNT(*) as count FROM favorites WHERE typeof(sort_order) = 'integer' OR sort_order = '0'"
  ).get();

  if (favRows.count > 0) {
    console.log(`[Realm] 迁移 favorites sort_order: ${favRows.count} 条记录`);

    // 按 sort_order ASC, created_at ASC 排序
    const records = db.prepare(
      'SELECT id, sort_order FROM favorites ORDER BY sort_order ASC, created_at ASC'
    ).all();

    // 生成初始分数索引键
    const keys = generateNKeysBetween(null, null, records.length);

    // 使用事务批量更新
    const updateStmt = db.prepare('UPDATE favorites SET sort_order = ? WHERE id = ?');
    db.transaction(() => {
      for (let i = 0; i < records.length; i++) {
        updateStmt.run(keys[i], records[i].id);
      }
    })();

    console.log('[Realm] favorites sort_order 已迁移到 fractional indexing');
  }

  // 检查 favorite_folders 表是否存在整数 sort_order 记录
  // （含旧 createFolder MAX+1 逻辑产生的整数与列默认值 0）
  const folderRows = db.prepare(
    "SELECT COUNT(*) as count FROM favorite_folders WHERE typeof(sort_order) = 'integer'"
  ).get();

  if (folderRows.count > 0) {
    console.log(`[Realm] 迁移 favorite_folders sort_order: ${folderRows.count} 条记录`);

    // 按 sort_order ASC, created_at ASC 排序
    const folders = db.prepare(
      'SELECT id, sort_order FROM favorite_folders ORDER BY sort_order ASC, created_at ASC'
    ).all();

    // 生成初始分数索引键
    const keys = generateNKeysBetween(null, null, folders.length);

    // 使用事务批量更新
    const updateStmt = db.prepare('UPDATE favorite_folders SET sort_order = ? WHERE id = ?');
    db.transaction(() => {
      for (let i = 0; i < folders.length; i++) {
        updateStmt.run(keys[i], folders[i].id);
      }
    })();

    console.log('[Realm] favorite_folders sort_order 已迁移到 fractional indexing');
  }

  sortOrderMigrated = true;
}

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
  // 注意：不使用外键约束，因为 parent_id=0 是虚拟根目录（不存在于表中）
  // 级联删除通过 deleteFolder() 中的应用层逻辑实现
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorite_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      parent_id INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_favorite_folders_parent_id
      ON favorite_folders (parent_id);
    CREATE INDEX IF NOT EXISTS idx_favorite_folders_sort_order
      ON favorite_folders (sort_order);
  `);

  // 迁移：移除 favorite_folders.parent_id 上的外键约束
  // 旧版本数据库可能带有 FOREIGN KEY (parent_id) REFERENCES favorite_folders(id)，
  // 导致 parent_id=0（虚拟根目录）的插入失败。需要重建表去除 FK。
  try {
    const fkList = db.prepare('PRAGMA foreign_key_list(favorite_folders)').all();
    if (fkList.length > 0) {
      console.log('[Realm] 检测到 favorite_folders 表有外键约束，正在迁移...');
      db.exec(`
        CREATE TABLE favorite_folders_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL DEFAULT '',
          parent_id INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        );
        INSERT INTO favorite_folders_new SELECT * FROM favorite_folders;
        DROP TABLE favorite_folders;
        ALTER TABLE favorite_folders_new RENAME TO favorite_folders;
        CREATE INDEX IF NOT EXISTS idx_favorite_folders_parent_id
          ON favorite_folders (parent_id);
        CREATE INDEX IF NOT EXISTS idx_favorite_folders_sort_order
          ON favorite_folders (sort_order);
      `);
      console.log('[Realm] favorite_folders 外键约束已移除');
    }
  } catch (e) {
    console.error('[Realm] favorite_folders 迁移失败:', e.message);
  }

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

  // 为 folder_id 创建索引（必须在 ALTER TABLE 之后，确保列已存在）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_favorites_folder_id
      ON favorites (folder_id);
  `);

  // 迁移 sort_order 到 fractional indexing 格式
  migrateSortOrder();

  // 初始化 FTS5 全文检索索引
  ensureFts5Index();
}

// ==================== FTS5 全文检索 ====================

/**
 * 使用 nodejieba 对文本进行分词，用于 FTS5 索引
 *
 * FTS5 unicode61 tokenizer 按空格分隔 token，因此需要预分词
 * 将中文文本分词后用空格连接，以便 FTS5 正确索引
 *
 * @param {string} text - 待分词的文本
 * @returns {string} 分词后用空格连接的文本
 */
function segmentForFts5(text) {
  if (!text) return '';

  // nodejieba 未加载时回退到原文（不预分词）
  if (!nodejieba) {
    try {
      nodejieba = require('nodejieba');
      // 打包后词典必须显式指向 app.asar.unpacked：
      // 默认路径在 app.asar 内，原生 fopen 无法读取，cppjieba 会直接 abort 闪退
      if (app.isPackaged) {
        const dictDir = path.join(
          process.resourcesPath,
          'app.asar.unpacked', 'node_modules', 'nodejieba', 'submodules', 'cppjieba', 'dict'
        );
        nodejieba.load({
          dict: path.join(dictDir, 'jieba.dict.utf8'),
          hmmDict: path.join(dictDir, 'hmm_model.utf8'),
          userDict: path.join(dictDir, 'user.dict.utf8'),
          idfDict: path.join(dictDir, 'idf.utf8'),
          stopWordDict: path.join(dictDir, 'stop_words.utf8')
        });
      }
    } catch (e) {
      console.error('[Realm] nodejieba 加载失败，使用原文:', e.message);
      nodejieba = null;
      return text;
    }
  }

  try {
    const words = nodejieba.cut(text);
    return words.join(' ');
  } catch (e) {
    console.error('[Realm] nodejieba 分词失败，使用原文:', e.message);
    return text;
  }
}

/**
 * 确保 FTS5 全文检索索引存在
 *
 * 创建 favorites_fts 虚拟表和触发器，用于支持中文全文检索。
 * 启动时全量构建索引，触发器自动维护增量更新。
 *
 * FTS5 索引策略（per D-10）：
 * - 仅索引 title 和 url 字段
 * - 使用 unicode61 tokenizer（支持 Unicode）
 * - 通过 nodejieba 预分词实现中文分词支持
 */
function ensureFts5Index() {
  if (!db) return;

  try {
    // 检查 favorites_fts 虚拟表是否存在
    const ftsExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'favorites_fts'"
    ).get();

    if (!ftsExists) {
      console.log('[Realm] 创建 FTS5 全文检索索引...');

      // 创建 FTS5 虚拟表
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS favorites_fts USING fts5(
          content,
          tokenize = 'unicode61'
        );
      `);

      // 全量构建索引：遍历 favorites 表所有记录
      const records = db.prepare('SELECT id, title, url FROM favorites').all();
      if (records.length > 0) {
        const insertStmt = db.prepare('INSERT INTO favorites_fts (rowid, content) VALUES (?, ?)');
        const insertMany = db.transaction((rows) => {
          for (const row of rows) {
            const content = segmentForFts5(`${row.title} ${row.url}`);
            insertStmt.run(row.id, content);
          }
        });
        insertMany(records);
        console.log(`[Realm] FTS5 索引已构建: ${records.length} 条记录`);
      }
    }

    // 触发器每次启动都 DROP + 重建：触发器持久化在 DB 文件中，只改 JS 源码
    // 不会更新存量库；且历史版本的触发器体内有 bug（FTS5 'delete' 命令对普通
    // （非 external-content/contentless）FTS5 表在新版 SQLite 上执行报
    // "SQL logic error"，须用普通 DELETE FROM；该路径此前因 UDF 未注册从未
    // 真正执行过），必须无条件刷新为当前逻辑。
    db.exec(`DROP TRIGGER IF EXISTS favorites_ai;`);
    db.exec(`DROP TRIGGER IF EXISTS favorites_ad;`);
    db.exec(`DROP TRIGGER IF EXISTS favorites_au;`);
    db.exec(`
      CREATE TRIGGER favorites_ai AFTER INSERT ON favorites BEGIN
        INSERT INTO favorites_fts (rowid, content)
        VALUES (new.id, segmentForFts5(new.title || ' ' || new.url));
      END;
    `);
    db.exec(`
      CREATE TRIGGER favorites_ad AFTER DELETE ON favorites BEGIN
        DELETE FROM favorites_fts WHERE rowid = old.id;
      END;
    `);
    db.exec(`
      CREATE TRIGGER favorites_au AFTER UPDATE ON favorites BEGIN
        DELETE FROM favorites_fts WHERE rowid = old.id;
        INSERT INTO favorites_fts (rowid, content)
        VALUES (new.id, segmentForFts5(new.title || ' ' || new.url));
      END;
    `);
  } catch (e) {
    console.error('[Realm] FTS5 索引初始化失败:', e.message);
  }
}

/**
 * 全文检索收藏记录
 *
 * 使用 FTS5 虚拟表进行全文检索，支持中文分词。
 * 如果 FTS5 不可用或 nodejieba 未加载，回退到 LIKE 模式搜索。
 *
 * @param {Object} options - 搜索选项
 * @param {string} options.keyword - 搜索关键词
 * @param {number} [options.limit=50] - 返回结果数量限制
 * @returns {Array} 匹配的收藏记录列表
 */
function searchFulltext({ keyword, limit = 50 }) {
  ensureTable();

  if (!keyword || keyword.trim() === '') {
    return [];
  }

  try {
    // 检查 FTS5 虚拟表是否存在
    const ftsExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'favorites_fts'"
    ).get();

    if (!ftsExists) {
      // FTS5 不可用，回退到 LIKE 模式
      console.log('[Realm] FTS5 索引不存在，回退到 LIKE 模式');
      return searchRecords({ keyword, limit });
    }

    // 使用 FTS5 全文检索
    const segmentedKeyword = segmentForFts5(keyword);
    const results = db.prepare(`
      SELECT f.*
      FROM favorites_fts fts
      JOIN favorites f ON fts.rowid = f.id
      WHERE fts.content MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(segmentedKeyword, limit);

    return results;
  } catch (e) {
    // FTS5 查询失败，回退到 LIKE 模式
    console.error('[Realm] FTS5 搜索失败，回退到 LIKE 模式:', e.message);
    return searchRecords({ keyword, limit });
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
 * 取表中当前最大的合法 fractional 排序键
 *
 * 历史脏数据（addRecord 落列默认值的 INTEGER 0、导入残留的文本 '0'）不参与：
 * 它们按 SQLite 类型序/字典序都小于任何合法键（'a0' 起），新键只需接续
 * 合法键末尾，即可自然排到脏数据之后。
 *
 * @param {string} table - 表名（favorites / favorite_folders）
 * @returns {string|null} 最大排序键，无合法键时返回 null
 */
function _getLastSortKey(table) {
  if (table !== 'favorites' && table !== 'favorite_folders') {
    throw new Error(`非法表名: ${table}`);
  }
  const row = db.prepare(
    `SELECT sort_order FROM ${table}
     WHERE typeof(sort_order) = 'text' AND sort_order != '0'
     ORDER BY sort_order DESC LIMIT 1`
  ).get();
  return row ? row.sort_order : null;
}

/**
 * 取指定文件夹末尾之后的新排序键（「追加到该文件夹末尾」语义）
 *
 * 与 _getLastSortKey('favorites') 的区别：只看**该文件夹内**的合法键。
 * 收藏项跨文件夹移动、或在指定文件夹内新增时用它，落位即目标文件夹末尾。
 * 脏数据（INTEGER 0 / 文本 '0'）同样不参与，理由见 _getLastSortKey。
 *
 * @param {number} folderId - 目标文件夹 ID（0 表示根目录）
 * @returns {string} 新的 fractional 排序键
 */
function _nextSortKeyInFolder(folderId) {
  const last = db.prepare(
    `SELECT sort_order FROM favorites
     WHERE folder_id = ? AND typeof(sort_order) = 'text' AND sort_order != '0'
     ORDER BY sort_order DESC LIMIT 1`
  ).get(folderId);
  return generateKeyBetween(last ? last.sort_order : null, null);
}

/**
 * 添加收藏记录
 * @param {Object} record - 记录数据
 * @param {string} record.url - 页面 URL
 * @param {string} [record.title] - 页面标题
 * @param {string} [record.faviconUrl] - favicon URL
 * @param {number} [record.folderId] - 目标文件夹 ID（0 表示根目录）
 * @returns {{id: number}|{error: string, message: string}} 新记录的 ID 或重复错误
 */
function addRecord({ url, title = '', faviconUrl = '', folderId = 0 }) {
  ensureTable();

  // 目标文件夹必须存在：folder_id 无外键约束，写入不存在的 id 会造出
  // 「根目录与任何文件夹都看不到」的孤儿收藏（在 UI 上等于凭空消失）
  if (folderId !== 0) {
    const folder = db.prepare('SELECT id FROM favorite_folders WHERE id = ?').get(folderId);
    if (!folder) {
      return { error: 'folder_not_found', message: '目标文件夹不存在' };
    }
  }

  // 新记录追加到排序末尾（fractional 键），避免落列默认值 INTEGER 0
  // 造成 INTEGER/TEXT 混合类型排序错乱（拖拽排序不生效的根因之一）。
  // 这里取**全局**末键而非目标文件夹内末键：键全局单调 ⇒ 新键必大于目标
  // 文件夹内所有键 ⇒ 落位仍是该文件夹末尾，无需再多一份同形查询。
  const sortKey = generateKeyBetween(_getLastSortKey('favorites'), null);

  // 使用 INSERT OR IGNORE 处理 UNIQUE 约束冲突
  const result = db.prepare(`
    INSERT OR IGNORE INTO favorites (url, title, favicon_url, folder_id, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(url, title, faviconUrl, folderId, sortKey);

  // lastInsertRowid 为 0 表示插入被忽略（URL 已存在）
  if (result.lastInsertRowid === 0n || result.lastInsertRowid === 0) {
    return { error: 'duplicate', message: '已收藏过该页面' };
  }

  return { id: result.lastInsertRowid };
}

/**
 * 更新收藏记录的标题与所在文件夹
 *
 * folderId 的三种语义（决定是否重排 sort_order）：
 * - `undefined`：只改标题。既有调用方（收藏页 HTTP API、AI 工具链）走这条旧语义
 * - 与当前 folder_id **相同**：同样只改标题，**绝不碰 sort_order**。
 *   星标弹窗每次保存都会带上当前 folderId，若「只要提供了就重排」，
 *   用户改一次标题就会把书签甩到所在文件夹的末尾
 * - 与当前不同：单事务内改 folder_id 并追加到目标文件夹末尾
 *
 * @param {number} id - 记录 ID
 * @param {Object} updates - 更新内容
 * @param {string} updates.title - 新标题
 * @param {number} [updates.folderId] - 目标文件夹 ID（0 表示根目录）
 * @returns {boolean} 是否更新成功
 */
function updateRecord(id, { title, folderId }) {
  ensureTable();

  const current = db.prepare('SELECT folder_id FROM favorites WHERE id = ?').get(id);
  if (!current) return false;

  // 归一化到数字再比较：IPC 是边界，字符串 '3' 与数字 3 若被判为「不同」，
  // 后果是静默重排（书签被甩到末尾）而不是报错
  const targetFolderId = folderId === undefined ? undefined : Number(folderId);

  if (targetFolderId === undefined || targetFolderId === current.folder_id) {
    const result = db.prepare('UPDATE favorites SET title = ? WHERE id = ?').run(title, id);
    return result.changes > 0;
  }

  // 目标文件夹必须存在（同 addRecord：不允许造出孤儿 folder_id）
  if (targetFolderId !== 0) {
    const folder = db.prepare('SELECT id FROM favorite_folders WHERE id = ?').get(targetFolderId);
    if (!folder) return false;
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE favorites SET title = ? WHERE id = ?').run(title, id);
    db.prepare('UPDATE favorites SET folder_id = ?, sort_order = ? WHERE id = ?')
      .run(targetFolderId, _nextSortKeyInFolder(targetFolderId), id);
  });
  tx();

  return true;
}

/**
 * 回填收藏记录 favicon（仅当当前为空时写入）
 *
 * 只补空不覆盖：天然幂等；多容器/多 Tab 并发访问同一 URL 时先到先写；
 * 不会覆盖用户已有图标。
 *
 * @param {number} id - 记录 ID
 * @param {string} faviconUrl - favicon data URL
 * @returns {boolean} 是否实际写入（false = 已有图标或记录不存在）
 */
function updateFavicon(id, faviconUrl) {
  ensureTable();

  const result = db.prepare(`
    UPDATE favorites SET favicon_url = ? WHERE id = ? AND favicon_url = ''
  `).run(faviconUrl, id);

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
 * @param {number} [options.folderId] - 文件夹 ID（undefined 时返回所有记录，0 表示根目录）
 * @returns {Array} 记录列表
 */
function listRecords({ offset = 0, limit = 50, folderId = undefined }) {
  ensureTable();

  // 当指定 folderId 时，按文件夹过滤并按 sort_order ASC, created_at ASC 排序
  if (folderId !== undefined) {
    return db.prepare(`
      SELECT * FROM favorites
      WHERE folder_id = ?
      ORDER BY sort_order ASC, created_at ASC
      LIMIT ? OFFSET ?
    `).all(folderId, limit, offset);
  }

  // 未指定 folderId 时，返回所有记录（向后兼容）
  return db.prepare(`
    SELECT * FROM favorites
    ORDER BY created_at ASC
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
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `).all(pattern, pattern, limit, offset);
}

/**
 * 检查 URL 是否已收藏
 * @param {string} url - 页面 URL
 * @returns {{id: number, title: string, favicon_url: string, folder_id: number}|null} 收藏记录或 null
 */
function checkUrl(url) {
  ensureTable();

  return db.prepare(`
    SELECT id, title, favicon_url, folder_id FROM favorites
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

  // 计算排序键：追加到末尾（fractional indexing）。
  // 旧逻辑 MAX(sort_order)+1 对字符串键失效（'a0'+1 得整数 1），
  // 会重新引入 INTEGER/TEXT 混合类型排序错乱
  const sortKey = generateKeyBetween(_getLastSortKey('favorite_folders'), null);

  const result = db.prepare(`
    INSERT INTO favorite_folders (name, parent_id, sort_order)
    VALUES (?, ?, ?)
  `).run(name, parentId, sortKey);

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
 * 子文件夹通过 favorite_folders.parent_id 外键 ON DELETE CASCADE 自动删除
 * 收藏项通过手动删除（favorites.folder_id 无外键约束，避免重建表）
 * @param {number} id - 文件夹 ID
 * @returns {{success: boolean, message?: string}} 结果
 */
function deleteFolder(id) {
  ensureTable();

  // 不能删除根目录（id=0 是虚拟根目录，不存在于表中）
  if (id === 0) {
    return { success: false, message: '无法删除根目录' };
  }

  // 收集要删除的文件夹 ID（当前文件夹 + 所有后代文件夹）
  const folderIds = getDescendantFolderIds(id);
  folderIds.push(id);

  // 先删除这些文件夹中的所有收藏项（避免孤儿记录）
  const placeholders = folderIds.map(() => '?').join(',');
  db.prepare(`DELETE FROM favorites WHERE folder_id IN (${placeholders})`).run(...folderIds);

  // 再删除文件夹（子文件夹通过 ON DELETE CASCADE 自动删除）
  const result = db.prepare('DELETE FROM favorite_folders WHERE id = ?').run(id);
  return { success: result.changes > 0 };
}

/**
 * 获取指定文件夹的所有后代文件夹 ID（递归）
 * @param {number} parentId - 父文件夹 ID
 * @returns {Array<number>} 后代文件夹 ID 列表
 */
function getDescendantFolderIds(parentId) {
  const children = db.prepare('SELECT id FROM favorite_folders WHERE parent_id = ?').all(parentId);
  let ids = [];
  for (const child of children) {
    ids.push(child.id);
    ids = ids.concat(getDescendantFolderIds(child.id));
  }
  return ids;
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
 * 按名称和父级查找文件夹（用于书签导入去重）
 *
 * 重复导入时复用既有文件夹，避免产生重复的文件夹树。
 * 若有多个同名文件夹（历史遗留），取 ID 最小者。
 *
 * @param {string} name - 文件夹名称
 * @param {number} [parentId=0] - 父文件夹 ID（0 表示根目录）
 * @returns {number|null} 文件夹 ID，不存在返回 null
 */
function findFolderByName(name, parentId = 0) {
  ensureTable();
  const row = db.prepare(
    'SELECT id FROM favorite_folders WHERE name = ? AND parent_id = ? ORDER BY id ASC LIMIT 1'
  ).get(name, parentId);
  return row ? row.id : null;
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
 * 列出所有空文件夹（不含收藏且不含子文件夹）
 *
 * 用于 AI 整理收藏夹后的清理场景：一次查询即可拿到全部空文件夹，
 * 避免逐个 folderId 查询收藏数。文件夹含空子文件夹时不算空
 * （删除会级联删掉子树，需用户知情确认）。
 *
 * @returns {Array<{id: number, name: string, parentId: number}>} 空文件夹列表
 */
function listEmptyFolders() {
  ensureTable();

  const folders = db.prepare('SELECT id, name, parent_id FROM favorite_folders').all();
  const usedIds = new Set(
    db.prepare('SELECT DISTINCT folder_id FROM favorites').all().map(r => r.folder_id)
  );
  const parentIds = new Set(folders.map(f => f.parent_id));

  return folders
    .filter(f => !usedIds.has(f.id) && !parentIds.has(f.id))
    .map(f => ({ id: f.id, name: f.name, parentId: f.parent_id }));
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

  // 计算排序值：追加到目标父文件夹末尾（fractional indexing）。
  // 旧逻辑 MAX(sort_order)+1 对字符串键失效（'a0'+1 得整数 1），
  // 会导致移动后的文件夹排到目标文件夹最前面
  const lastSibling = db.prepare(
    `SELECT sort_order FROM favorite_folders
     WHERE parent_id = ? AND typeof(sort_order) = 'text' AND sort_order != '0'
     ORDER BY sort_order DESC LIMIT 1`
  ).get(parentId);
  const nextSort = generateKeyBetween(lastSibling ? lastSibling.sort_order : null, null);

  const result = db.prepare('UPDATE favorite_folders SET parent_id = ?, sort_order = ? WHERE id = ?')
    .run(parentId, nextSort, id);

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
 * 将收藏项移动到指定文件夹并追加到末尾
 *
 * moveFavorite 仅更新 folder_id，sort_order 保持原值，在新文件夹中的落位不可预期；
 * 此函数在事务内同时写入 folder_id 与目标文件夹末尾的 fractional 排序键。
 *
 * @param {number} id - 收藏项 ID
 * @param {Object} options
 * @param {number} options.folderId - 目标文件夹 ID（0 表示根目录）
 * @returns {boolean} 是否成功
 */
function moveFavoriteInto(id, { folderId }) {
  ensureTable();

  const tx = db.transaction(() => {
    db.prepare('UPDATE favorites SET folder_id = ?, sort_order = ? WHERE id = ?')
      .run(folderId, _nextSortKeyInFolder(folderId), id);
  });
  tx();

  return true;
}

/**
 * 应用收藏整理方案
 *
 * 逐组解析/创建目标文件夹（findFolderByName 去重，同名同父复用既有文件夹），
 * 然后在事务内逐条 moveFavoriteInto 写入 folder_id + 目标文件夹末尾 fractional 键。
 * 单条失败（如收藏已被手动删除）记入 failures 继续处理，不中断整批。
 *
 * @param {Array<{folderName: string, parentId?: number, bookmarkIds: number[]}>} plan - 整理方案
 * @returns {{folderCount: number, movedCount: number,
 *            createdFolders: Array<{name: string, id: number, parentId: number}>,
 *            failures: Array<{id: number, reason: string}>}} 应用结果
 */
function applyOrganizePlan(plan) {
  ensureTable();

  const createdFolders = [];
  const failures = [];
  let movedCount = 0;
  let folderCount = 0;

  if (!Array.isArray(plan) || plan.length === 0) {
    return { folderCount, movedCount, createdFolders, failures };
  }

  // 组间已见过的收藏 id（跨组去重，重复出现只处理首次）
  const seenIds = new Set();

  const tx = db.transaction(() => {
    for (const group of plan) {
      const folderName = typeof group.folderName === 'string' ? group.folderName.trim() : '';
      const parentId = Number(group.parentId) || 0;
      if (!folderName) {
        for (const id of (group.bookmarkIds || [])) {
          failures.push({ id, reason: '组缺少文件夹名' });
        }
        continue;
      }

      // 解析或创建目标文件夹（幂等：同名同父复用）
      let folderId = findFolderByName(folderName, parentId);
      if (folderId === null) {
        const created = createFolder({ name: folderName, parentId });
        if (created.error) {
          for (const id of (group.bookmarkIds || [])) {
            failures.push({ id, reason: `创建文件夹失败: ${created.message}` });
          }
          continue;
        }
        folderId = created.id;
        createdFolders.push({ name: folderName, id: folderId, parentId });
      }
      folderCount++;

      for (const id of (group.bookmarkIds || [])) {
        const numId = Number(id);
        if (seenIds.has(numId)) continue;
        seenIds.add(numId);

        const exists = db.prepare('SELECT id FROM favorites WHERE id = ?').get(numId);
        if (!exists) {
          failures.push({ id: numId, reason: '收藏不存在' });
          continue;
        }
        moveFavoriteInto(numId, { folderId });
        movedCount++;
      }
    }
  });
  tx();

  return { folderCount, movedCount, createdFolders, failures };
}

/**
 * 重排指定文件夹内的收藏顺序
 *
 * AI 整理场景使用：提交该文件夹全部收藏的目标顺序（orderedIds），
 * 事务内生成一组全新的 fractional 排序键（a0, a1, ...）批量写入。
 *
 * 语义约束（保证排序结果可预期）：
 * - 所有 id 必须属于同一个文件夹（folder_id 一致），跨文件夹返回错误
 * - 必须提交该文件夹的全部收藏（部分列表会与未列出项交错产生不可预期的落位）
 * - 不存在的 id 记入 droppedIds 丢弃；重复 id 只保留首次出现
 *
 * @param {Array<number>} orderedIds - 目标顺序的收藏 ID 列表
 * @returns {{success: boolean, folderId?: number, count: number,
 *            droppedIds: Array, error?: string}} 结果
 */
function reorderFavorites(orderedIds) {
  ensureTable();

  const droppedIds = [];
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { success: false, count: 0, droppedIds, error: '排序列表不能为空' };
  }

  // 去重与清洗（保序）
  const seen = new Set();
  const cleanIds = [];
  for (const raw of orderedIds) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
      droppedIds.push(raw);
      continue;
    }
    seen.add(id);
    cleanIds.push(id);
  }

  // 校验存在性与同文件夹约束
  const folderIds = new Set();
  const existingIds = [];
  for (const id of cleanIds) {
    const row = db.prepare('SELECT id, folder_id FROM favorites WHERE id = ?').get(id);
    if (!row) {
      droppedIds.push(id);
      continue;
    }
    folderIds.add(row.folder_id);
    existingIds.push(id);
  }

  if (existingIds.length < 2) {
    return { success: false, count: 0, droppedIds, error: '至少需要 2 条有效收藏才能排序' };
  }
  if (folderIds.size > 1) {
    return { success: false, count: 0, droppedIds, error: '排序列表跨多个文件夹，请按文件夹分别提交' };
  }

  // 必须覆盖文件夹内全部收藏（否则部分列表会与未列出项交错）
  const folderId = [...folderIds][0];
  const { c: folderCount } = db.prepare(
    'SELECT COUNT(*) AS c FROM favorites WHERE folder_id = ?'
  ).get(folderId);
  if (existingIds.length !== folderCount) {
    return {
      success: false,
      count: 0,
      droppedIds,
      error: `该文件夹共有 ${folderCount} 条收藏，请提供全部收藏的完整顺序列表（当前 ${existingIds.length} 条）。可先用 get(action=sort) 查看现有顺序`,
    };
  }

  // 生成全新 fractional 键批量写入（a0, a1, ... 依次对应目标顺序）
  const keys = computeSortKeys(null, null, existingIds.length);
  const updateStmt = db.prepare('UPDATE favorites SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(() => {
    existingIds.forEach((id, i) => updateStmt.run(keys[i], id));
  });
  tx();

  return { success: true, folderId, count: existingIds.length, droppedIds };
}

/**
 * 计算 fractional-indexing 排序键
 *
 * fractional-indexing 库仅在主进程可用：realm:// 页面走 HTTP 端点
 * （/api/favorites/compute-sort-keys），主窗口从 file:// 跨域不可 fetch，
 * 经 IPC 调用此函数。
 *
 * @param {string|null} beforeKey - 前邻排序键（null 表示插到最前）
 * @param {string|null} afterKey - 后邻排序键（null 表示追加到末尾）
 * @param {number} [count=1] - 需要的键数量
 * @returns {string[]} 排序键数组
 */
function computeSortKeys(beforeKey, afterKey, count = 1) {
  return generateNKeysBetween(beforeKey || null, afterKey || null, count);
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

/**
 * 批量更新收藏项排序
 *
 * 使用事务包裹所有更新，确保原子性。
 * 拖拽排序后调用此 API 可持久化排序结果。
 *
 * @param {Array<{id: number, sort_order: string}>} items - 排序更新数组
 * @returns {number} 更新的记录数
 */
function batchUpdateSort(items) {
  ensureTable();

  if (!Array.isArray(items) || items.length === 0) return 0;

  const updateStmt = db.prepare('UPDATE favorites SET sort_order = ? WHERE id = ?');
  const updateMany = db.transaction((rows) => {
    let count = 0;
    for (const { id, sort_order } of rows) {
      const result = updateStmt.run(sort_order, id);
      count += result.changes;
    }
    return count;
  });

  return updateMany(items);
}

/**
 * 批量更新文件夹排序
 *
 * 使用事务包裹所有更新，确保原子性。
 * 拖拽排序后调用此 API 可持久化文件夹排序结果。
 *
 * @param {Array<{id: number, sort_order: string}>} folders - 排序更新数组
 * @returns {number} 更新的记录数
 */
function batchUpdateFolderSort(folders) {
  ensureTable();

  if (!Array.isArray(folders) || folders.length === 0) return 0;

  const updateStmt = db.prepare('UPDATE favorite_folders SET sort_order = ? WHERE id = ?');
  const updateMany = db.transaction((rows) => {
    let count = 0;
    for (const { id, sort_order } of rows) {
      const result = updateStmt.run(sort_order, id);
      count += result.changes;
    }
    return count;
  });

  return updateMany(folders);
}

// ==================== 书签导入 ====================

/**
 * URL 规范化（per D-08）
 *
 * 去除 www 前缀、尾部斜杠，统一使用 https 协议，
 * 用于导入时的重复 URL 检测与去重。
 *
 * @param {string} url - 原始 URL
 * @returns {string} 规范化后的 URL
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // 去除 hostname 的 www. 前缀
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    // 去除 pathname 末尾斜杠（长度 > 1 时）
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    // 强制使用 https:// 协议
    return `https://${hostname}${pathname}${parsed.search}${parsed.hash}`;
  } catch (e) {
    // 解析失败时返回原始 URL
    return url;
  }
}

/**
 * 自动检测 Chrome 书签文件路径（per D-03）
 *
 * 按优先级扫描候选路径，返回第一个存在的文件：
 * 1. {Profile}/Bookmarks — 未登录账号时的本地书签
 * 2. {Profile}/AccountBookmarks — 登录 Google 账号后的账号书签（新版 Chrome）
 *
 * Profile 目录按 Default → Profile 1/2/... 顺序检查。
 * macOS 根路径: ~/Library/Application Support/Google/Chrome/
 *
 * @returns {string|null} 书签文件绝对路径，不存在时返回 null
 */
function detectChromeBookmarksPath() {
  const chromeRoot = path.join(
    app.getPath('home'),
    'Library', 'Application Support', 'Google', 'Chrome'
  );

  if (!fs.existsSync(chromeRoot)) {
    return null;
  }

  // 枚举 Profile 目录：Default 优先，其余 Profile N 按名称排序
  let profileDirs;
  try {
    profileDirs = fs.readdirSync(chromeRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^(Default|Profile .+)$/.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => (a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b)));
  } catch (e) {
    return null;
  }

  for (const profile of profileDirs) {
    for (const fileName of ['Bookmarks', 'AccountBookmarks']) {
      const candidate = path.join(chromeRoot, profile, fileName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * 解析 Chrome JSON 书签文件
 *
 * 仅导入 bookmark_bar（书签栏）下的内容，忽略 other 和 synced。
 * 根目录文件夹直接作为第一层，不再包裹"Chrome 书签栏"外壳。
 *
 * @param {Object} data - Chrome 书签 JSON 数据
 * @returns {{bookmarks: Array, folders: Array}} 解析结果
 */
function parseChromeJson(data) {
  const bookmarks = [];
  const folders = [];

  /**
   * 递归遍历节点
   * @param {Array} children - 子节点数组
   * @param {string} parentPath - 父文件夹路径（空字符串表示根目录）
   */
  function traverse(children, parentPath) {
    if (!Array.isArray(children)) return;

    for (const node of children) {
      try {
        if (node.type === 'folder') {
          const folderPath = parentPath ? `${parentPath}/${node.name}` : node.name;
          folders.push({
            name: node.name,
            parentPath,
            dateAdded: node.date_added || '',
          });
          // 递归遍历子文件夹
          if (node.children) {
            traverse(node.children, folderPath);
          }
        } else if (node.type === 'url') {
          bookmarks.push({
            title: node.name || '',
            url: node.url || '',
            dateAdded: node.date_added || '',
            parentPath,
          });
        }
      } catch (e) {
        // 节点格式异常时跳过并记录
        console.error('[Realm] Chrome 书签节点解析异常，已跳过:', e.message, node);
      }
    }
  }

  // 仅导入 bookmark_bar（书签栏）下的内容，根目录文件夹直接作为第一层
  if (data && data.roots && data.roots.bookmark_bar) {
    const barNode = data.roots.bookmark_bar;
    if (barNode.children) {
      traverse(barNode.children, '');
    }
  }

  return { bookmarks, folders };
}

/**
 * 解析 Netscape HTML 书签文件
 *
 * 使用 cheerio 解析标准的 Netscape Bookmark File Format，
 * 递归处理 <DL> 下的 <DT> 节点。
 * 跳过"书签栏"根文件夹外壳，直接导入其子内容作为第一层。
 *
 * @param {string} html - HTML 书签文件内容
 * @returns {{bookmarks: Array, folders: Array}} 解析结果
 */
function parseNetscapeHtml(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const bookmarks = [];
  const folders = [];

  /**
   * 递归解析 DL 节点
   * @param {Cheerio} dlElement - DL 元素
   * @param {string} parentPath - 父文件夹路径
   */
  function parseDl(dlElement, parentPath) {
    dlElement.children('dt').each((_, dt) => {
      const $dt = $(dt);

      // 处理 <A> 标签（书签）
      const $a = $dt.find('> a').first();
      if ($a.length > 0) {
        bookmarks.push({
          title: $a.text().trim(),
          url: $a.attr('href') || '',
          dateAdded: $a.attr('add_date') || '',
          parentPath,
        });
        return;
      }

      // 处理 <H3> 标签（文件夹）
      const $h3 = $dt.find('> h3').first();
      if ($h3.length > 0) {
        const folderName = $h3.text().trim();
        const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
        folders.push({
          name: folderName,
          parentPath,
          dateAdded: $h3.attr('add_date') || '',
        });
        // 递归解析下一个 <DL>（子文件夹内容）
        const $nextDl = $dt.find('> dl').first();
        if ($nextDl.length > 0) {
          parseDl($nextDl, folderPath);
        }
      }
    });
  }

  // 从根 <DL> 开始解析，跳过"书签栏"根文件夹外壳
  const rootDl = $('dl').first();
  if (rootDl.length > 0) {
    // 查找名为"书签栏"的根级文件夹，跳过外壳直接导入其子内容
    let targetDl = rootDl;
    rootDl.children('dt').each((_, dt) => {
      const $dt = $(dt);
      const $h3 = $dt.find('> h3').first();
      if ($h3.length > 0 && /书签栏|Bookmarks Bar|bookmark.?bar/i.test($h3.text().trim())) {
        const $innerDl = $dt.find('> dl').first();
        if ($innerDl.length > 0) {
          targetDl = $innerDl;
        }
      }
    });
    parseDl(targetDl, '');
  }

  return { bookmarks, folders };
}

/**
 * 批量插入书签到数据库（per D-07, D-13）
 *
 * 使用事务包裹批量操作，每 100 条为一批报告进度。
 * 重复 URL 通过 INSERT OR IGNORE 自动跳过（per D-07）。
 * URL 经 normalizeUrl 规范化后插入（per D-08）。
 *
 * @param {Array} bookmarks - 书签数组 [{title, url, parentPath, ...}]
 * @param {Object} folderIdMap - parentPath → folderId 映射
 * @param {Function} [onProgress] - 进度回调 ({progress, imported, skipped, total, current})
 * @returns {Promise<{imported: number, skipped: number}>} 导入结果
 */
async function batchInsertBookmarks(bookmarks, folderIdMap, onProgress) {
  ensureTable();

  const BATCH_SIZE = 100;
  const total = bookmarks.length;
  let imported = 0;
  let skipped = 0;

  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO favorites (url, title, favicon_url, folder_id, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  // 为导入书签顺序分配 fractional 排序键（接续现有键末尾）：
  // 既避免写入文本 '0' 脏数据，又让同文件夹内保持源书签原始顺序
  // （created_at 同毫秒时 SQLite 不保证相对顺序，排序键是唯一可靠依据）
  const sortKeys = generateNKeysBetween(_getLastSortKey('favorites'), null, total);

  // 使用事务包裹批量操作
  const insertBatch = db.transaction((batch, startIndex) => {
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const normalizedUrl = normalizeUrl(item.url);
      const folderId = folderIdMap[item.parentPath] || 0;
      const result = insertStmt.run(
        normalizedUrl,
        item.title || '',
        item.faviconUrl || '',
        folderId,
        sortKeys[startIndex + j]
      );
      if (result.changes > 0) {
        imported++;
      } else {
        skipped++;
      }
    }
  });

  // 分批处理
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = bookmarks.slice(i, Math.min(i + BATCH_SIZE, total));
    insertBatch(batch, i);

    // 报告进度（per D-13）
    if (onProgress) {
      onProgress({
        progress: Math.round(Math.min(i + BATCH_SIZE, total) / total * 100),
        imported,
        skipped,
        total,
        current: Math.min(i + BATCH_SIZE, total),
      });
    }

    // 让出事件循环：同步批量插入会阻塞 HTTP 进度轮询，每批后让轮询有机会响应
    await new Promise((resolve) => setImmediate(resolve));
  }

  return { imported, skipped };
}

/**
 * Chrome JSON 书签导入入口（per D-03, D-04, D-05, D-09, D-10）
 *
 * 完整导入流程：
 * 1. 自动检测或使用指定的 Chrome 书签文件路径
 * 2. 解析 Chrome JSON 格式
 * 3. 创建文件夹结构
 * 4. 批量导入书签（含 favicon 获取）
 *
 * @param {Object} [source] - 书签来源：{ filePath } 或 { content }，为空时自动检测
 * @param {Function} [onProgress] - 进度回调
 * @param {AbortSignal} [abortSignal] - 取消信号（per IMPORT-03）
 * @returns {Promise<Object>} 导入结果
 */
async function importChromeBookmarks(source, onProgress, abortSignal) {
  let data;

  if (source && source.content) {
    // 直接解析上传的文件内容（webview 内部页面走 HTTP API 的场景）
    try {
      data = JSON.parse(source.content);
    } catch (e) {
      return { success: false, error: `JSON 解析失败: ${e.message}` };
    }
  } else {
    // 自动检测 Chrome 书签路径（per D-03, D-04）
    let filePath = source && source.filePath;
    if (!filePath) {
      filePath = detectChromeBookmarksPath();
      if (!filePath) {
        return { success: false, needFileSelect: true };
      }
    }

    // 读取并解析文件
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      data = JSON.parse(content);
    } catch (e) {
      return { success: false, error: `文件读取或解析失败: ${e.message}` };
    }
  }

  // 解析 Chrome JSON（per D-05, D-06, D-09）
  const { bookmarks, folders } = parseChromeJson(data);

  if (bookmarks.length === 0) {
    return { success: true, imported: 0, skipped: 0, foldersCreated: 0 };
  }

  // 解析完成，上报初始进度（让前端立即显示总数）
  const total = bookmarks.length;
  if (onProgress) {
    onProgress({ progress: 0, imported: 0, total, current: '解析完成，准备导入', stage: 'prepare' });
  }

  // 创建文件夹结构
  const folderIdMap = {}; // parentPath → folderId
  let foldersCreated = 0;

  // 按层级排序创建文件夹（先父后子）
  const sortedFolders = folders.sort((a, b) => {
    const depthA = a.parentPath ? a.parentPath.split('/').length : 0;
    const depthB = b.parentPath ? b.parentPath.split('/').length : 0;
    return depthA - depthB;
  });

  for (const folder of sortedFolders) {
    // 检查取消信号（per IMPORT-03）
    if (abortSignal && abortSignal.aborted) {
      return { success: false, cancelled: true, imported: 0, skipped: 0, foldersCreated };
    }

    const parentFolderId = folderIdMap[folder.parentPath] || 0;
    const folderPath = folder.parentPath
      ? `${folder.parentPath}/${folder.name}`
      : folder.name;

    // 导入去重：同名同父级文件夹复用既有 ID，避免重复导入产生重复文件夹
    const existingId = findFolderByName(folder.name, parentFolderId);
    if (existingId) {
      folderIdMap[folderPath] = existingId;
      continue;
    }

    const result = createFolder({ name: folder.name, parentId: parentFolderId });
    if (result.id) {
      folderIdMap[folderPath] = result.id;
      foldersCreated++;
    }
  }

  // 批量导入书签（per D-07, D-13），进度区间 0% → 100%
  // favicon 不在导入时抓取（Chrome 范式）：记录以空图标入库，
  // 之后访问对应页面时由渲染进程经 favorites:update-favicon 回写真实图标
  const { imported, skipped } = await batchInsertBookmarks(
    bookmarks,
    folderIdMap,
    onProgress
      ? (data) => onProgress({ ...data, stage: 'insert' })
      : null
  );

  return { success: true, imported, skipped, foldersCreated };
}

/**
 * HTML 书签导入入口（per D-11, D-12）
 *
 * 导入 Netscape HTML 格式的书签文件，
 * 返回 preview 数据供前端预览（per D-12）。
 *
 * @param {Object} source - 书签来源：{ filePath } 或 { content }
 * @param {Function} [onProgress] - 进度回调
 * @param {AbortSignal} [abortSignal] - 取消信号（per IMPORT-03）
 * @param {Object} [options] - 选项；{ dryRun: true } 时只解析返回 preview，不写入数据库
 * @returns {Promise<Object>} 导入结果（含 preview）
 */
async function importHtmlBookmarks(source, onProgress, abortSignal, { dryRun } = {}) {
  // 读取内容：优先上传内容，其次文件路径
  let html;
  if (source && source.content) {
    html = source.content;
  } else if (source && source.filePath) {
    try {
      html = fs.readFileSync(source.filePath, 'utf-8');
    } catch (e) {
      return { success: false, error: `文件读取失败: ${e.message}` };
    }
  } else {
    return { success: false, error: '未指定文件路径或内容' };
  }

  // 解析 HTML 书签（per IMPORT-02）
  const { bookmarks, folders } = parseNetscapeHtml(html);

  // preview 数据（per D-12）
  const topFolders = folders
    .filter(f => !f.parentPath)
    .map(f => f.name)
    .slice(0, 10);
  const preview = {
    total: bookmarks.length,
    folderCount: folders.length,
    topFolders,
  };

  // dryRun：只返回预览数据，不写库（供导入前确认 per D-11）
  if (dryRun) {
    return { success: true, preview };
  }

  if (bookmarks.length === 0) {
    return { success: true, imported: 0, skipped: 0, foldersCreated: 0, preview };
  }

  // 解析完成，上报初始进度（让前端立即显示总数）
  if (onProgress) {
    onProgress({ progress: 0, imported: 0, total: bookmarks.length, current: '解析完成，准备导入', stage: 'prepare' });
  }

  // 创建文件夹结构
  const folderIdMap = {};
  let foldersCreated = 0;

  const sortedFolders = folders.sort((a, b) => {
    const depthA = a.parentPath ? a.parentPath.split('/').length : 0;
    const depthB = b.parentPath ? b.parentPath.split('/').length : 0;
    return depthA - depthB;
  });

  for (const folder of sortedFolders) {
    if (abortSignal && abortSignal.aborted) {
      return { success: false, cancelled: true, imported: 0, skipped: 0, foldersCreated };
    }

    const parentFolderId = folderIdMap[folder.parentPath] || 0;
    const folderPath = folder.parentPath
      ? `${folder.parentPath}/${folder.name}`
      : folder.name;

    // 导入去重：同名同父级文件夹复用既有 ID，避免重复导入产生重复文件夹
    const existingId = findFolderByName(folder.name, parentFolderId);
    if (existingId) {
      folderIdMap[folderPath] = existingId;
      continue;
    }

    const result = createFolder({ name: folder.name, parentId: parentFolderId });
    if (result.id) {
      folderIdMap[folderPath] = result.id;
      foldersCreated++;
    }
  }

  // 批量导入书签
  const { imported, skipped } = await batchInsertBookmarks(
    bookmarks,
    folderIdMap,
    onProgress ? (data) => onProgress({ ...data, stage: 'insert' }) : null
  );

  return {
    success: true,
    imported,
    skipped,
    foldersCreated,
    preview,
  };
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  setDatabase,
  migrateToGlobal,
  addRecord,
  updateRecord,
  updateFavicon,
  deleteRecord,
  deleteRecords,
  listRecords,
  searchRecords,
  searchFulltext,
  checkUrl,
  getCount,
  // 文件夹 CRUD
  createFolder,
  renameFolder,
  deleteFolder,
  listFolders,
  findFolderByName,
  listEmptyFolders,
  getFolderTree,
  moveFolder,
  // 收藏项移动与排序
  moveFavorite,
  moveFavorites,
  moveFavoriteInto,
  applyOrganizePlan,
  reorderFavorites,
  computeSortKeys,
  updateFolderSort,
  updateFavoriteSort,
  batchUpdateSort,
  batchUpdateFolderSort,
  // 书签导入
  parseChromeJson,
  parseNetscapeHtml,
  normalizeUrl,
  batchInsertBookmarks,
  detectChromeBookmarksPath,
  importChromeBookmarks,
  importHtmlBookmarks,
};

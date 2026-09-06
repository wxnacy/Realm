/**
 * Realm Browser - 播放器观看历史管理模块（Phase 44 D-11/D-12/D-13）
 *
 * 独立小库 player-history.db：playback_key（origin+pathname，query 时效 token
 * 不参与）为主键的 upsert 观看历史。纯记录、量极小、无 FIFO 淘汰——不随缓存
 * 淘汰消失（D-11 双层设计：缓存库条目随淘汰消失，观看历史永久保留）。
 *
 * 去 Electron 化：顶层无 electron / 原生模块 require，init({ dbPath }) 由
 * main.js 在 app.whenReady 后调用（better-sqlite3 原生模块延迟加载纪律，
 * 参照 history-manager.js）。
 */

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载，
// 否则 Electron 早期启动阶段会导致 SIGSEGV 段错误
let Database = null;

/** 数据库连接实例 */
let db = null;

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库连接，建表并设置 WAL 模式
 * 应在 app.whenReady 之后由 main.js 调用
 * @param {Object} opts
 * @param {string} opts.dbPath - 数据库文件路径（userData/player-history.db）
 */
function init({ dbPath }) {
  if (db) return;
  if (!dbPath || typeof dbPath !== 'string') {
    throw new Error('player-history-manager 需要 dbPath 参数');
  }

  if (!Database) {
    Database = require('better-sqlite3');
  }

  db = new Database(dbPath);
  // WAL 模式：提升并发读写性能（项目 SQLite 惯例）
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS player_history (
      playback_key TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      last_position REAL NOT NULL DEFAULT 0,
      duration REAL NOT NULL DEFAULT 0,
      last_watched INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_player_history_last_watched
      ON player_history (last_watched DESC);
  `);

  console.log(`[Realm] 播放器观看历史数据库已初始化: ${dbPath}`);
}

// ==================== CRUD ====================

/**
 * upsert 播放进度（D-13）：按 playback_key 主键更新最后位置/时长/观看时间。
 * 标题为空时保留旧标题（播放中途拿不到标题的上报不覆盖已有值）。
 * @param {Object} record
 * @param {string} record.playbackKey - origin+pathname（D-12）
 * @param {string} record.url - 原始 URL（含 query，供命中缓存回放）
 * @param {string} [record.title] - 视频标题
 * @param {number} record.position - 播放位置（秒）
 * @param {number} [record.duration] - 总时长（秒，直播流为 0）
 * @param {number} [record.lastWatched] - 观看时间戳（毫秒，缺省 now）
 * @returns {boolean} 是否写入成功（未初始化时返回 false）
 */
function upsertProgress(record) {
  if (!db || !record || !record.playbackKey || !record.url) return false;
  try {
    db.prepare(`
      INSERT INTO player_history (playback_key, url, title, last_position, duration, last_watched)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(playback_key) DO UPDATE SET
        url = excluded.url,
        title = CASE WHEN excluded.title != '' THEN excluded.title ELSE player_history.title END,
        last_position = excluded.last_position,
        duration = excluded.duration,
        last_watched = excluded.last_watched
    `).run(
      record.playbackKey,
      record.url,
      record.title || '',
      Number(record.position) || 0,
      Number(record.duration) || 0,
      Number(record.lastWatched) || Date.now()
    );
    return true;
  } catch (err) {
    console.error('[Realm] 播放进度写入失败:', err.message);
    return false;
  }
}

/**
 * 按 playbackKey 查询观看历史（D-12 续播：loadedmetadata 后 seek 到 last_position）
 * @param {string} playbackKey - origin+pathname
 * @returns {{playbackKey: string, url: string, title: string, position: number, duration: number, lastWatched: number}|null}
 */
function getByKey(playbackKey) {
  if (!db || !playbackKey) return null;
  try {
    const row = db.prepare('SELECT * FROM player_history WHERE playback_key = ?').get(playbackKey);
    return row || null;
  } catch (err) {
    console.error('[Realm] 观看历史查询失败:', err.message);
    return null;
  }
}

/**
 * 最近观看列表（D-15 抽屉排序：最近观看优先）
 * @param {number} [limit] - 上限（默认 200）
 * @returns {Array<{playbackKey: string, url: string, title: string, position: number, duration: number, lastWatched: number}>}
 */
function listRecent(limit) {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM player_history ORDER BY last_watched DESC LIMIT ?')
      .all(Number(limit) > 0 ? Number(limit) : 200);
  } catch (err) {
    console.error('[Realm] 观看历史列举失败:', err.message);
    return [];
  }
}

module.exports = { init, upsertProgress, getByKey, listRecent };

/**
 * Realm Browser - 开发者模式请求写入队列
 *
 * 负责异步批量写入 CDP 抓取的网络请求数据到 SQLite。
 * 核心职责：
 * - 维护内存写入队列
 * - 每 2 秒定时 flush（D-11）
 * - 队列达到 1000 条时触发紧急 flush（D-10）
 * - 应用退出前 flush 所有待写入数据
 * - 写入失败重试 3 次，超过后丢弃并记录 console.error（D-12）
 * - 使用 better-sqlite3 transaction 批量插入
 *
 * 依赖：better-sqlite3
 * 数据库路径：{userData}/dev-requests.db
 */

const path = require('path');
const { app } = require('electron');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载，
// 否则 Electron 早期启动阶段会导致 SIGSEGV 段错误
let Database = null;

// 数据库路径（延迟初始化，避免 app.getPath 在 ready 前调用）
let DB_PATH = null;

// 数据库连接实例
let db = null;

// ==================== 队列状态 ====================

/** @type {object[]} 待写入记录数组 */
let queue = [];

/** @type {NodeJS.Timeout|null} 2 秒定时器 */
let flushTimer = null;

/** @type {boolean} 是否正在 flush */
let flushing = false;

/** @type {Map<string, number>} 每条记录的重试次数（最多 3 次） */
const retryCount = new Map();

/** @type {number} 紧急 flush 阈值 */
const EMERGENCY_THRESHOLD = 1000;

/** @type {number} 最大重试次数 */
const MAX_RETRIES = 3;

/** @type {number} flush 间隔（毫秒） */
const FLUSH_INTERVAL = 2000;

/** @type {number} 最后一次 flush 时间戳 */
let lastFlushTime = 0;

/** @type {number} 总写入记录数 */
let totalWritten = 0;

/**
 * 渲染后 HTML 回写缓存：捕获完成时记录可能尚未落库，暂存于此
 * key: `${containerId}|${requestId}`，value: { html, ts }
 * writeRecords 插入时消费；超时/超量兜底清理，防止大字符串滞留内存
 * @type {Map<string, {html: string, ts: number}>}
 */
const pendingRenderedHtml = new Map();

/** @type {number} 渲染 HTML 回写缓存的过期时间（毫秒） */
const PENDING_RENDERED_TTL = 60 * 1000;

/** @type {number} 渲染 HTML 回写缓存的最大条数 */
const PENDING_RENDERED_MAX = 20;

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
    DB_PATH = path.join(app.getPath('userData'), 'dev-requests.db');
  }

  db = new Database(DB_PATH);
  // WAL 模式：提升并发读写性能
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');

  console.log(`[Realm DevWriter] 数据库已初始化: ${DB_PATH}`);
}

// ==================== 安全验证 ====================

/**
 * 验证容器 ID 格式（防 SQL 注入）
 * 复用 history-manager 的 sanitizeContainerId 模式
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
 * 确保容器对应的请求记录表存在
 * @param {string} containerId - 容器 ID
 * @returns {string} 表名
 */
function ensureTable(containerId) {
  const id = sanitizeContainerId(containerId);
  const tableName = `dev_requests_${id}`;

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER DEFAULT 0,
      request_headers TEXT DEFAULT '{}',
      request_body TEXT DEFAULT '',
      response_headers TEXT DEFAULT '{}',
      response_body TEXT DEFAULT '',
      content_type TEXT DEFAULT '',
      duration INTEGER DEFAULT 0,
      size INTEGER DEFAULT 0,
      container_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      page_request_id TEXT DEFAULT '',
      resource_type TEXT DEFAULT '',
      rendered_html TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at
      ON ${tableName} (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_url
      ON ${tableName} (url);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_method
      ON ${tableName} (method);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_page_request_id
      ON ${tableName} (page_request_id);
  `);

  // 老库迁移：补齐新增列（幂等）
  migrateTableColumns(tableName);

  return tableName;
}

/**
 * 为已存在的老表补齐新增列（PRAGMA 检查缺列后 ALTER TABLE，幂等可重复执行）
 * @param {string} tableName - 表名
 */
function migrateTableColumns(tableName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);

  if (!columns.includes('page_request_id')) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN page_request_id TEXT DEFAULT ''`);
  }
  if (!columns.includes('resource_type')) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN resource_type TEXT DEFAULT ''`);
  }
  if (!columns.includes('rendered_html')) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN rendered_html TEXT DEFAULT ''`);
  }
}

// ==================== 队列操作 ====================

/**
 * 初始化写入队列，启动定时 flush
 * @param {object} dbInstance - better-sqlite3 数据库实例（可选，用于外部传入）
 */
function init(dbInstance) {
  if (dbInstance) {
    db = dbInstance;
  } else {
    initDatabase();
  }

  // 启动定时 flush
  startFlushTimer();
  console.log('[Realm DevWriter] 写入队列已初始化');
}

/**
 * 启动定时 flush 计时器
 */
function startFlushTimer() {
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    if (queue.length > 0 && !flushing) {
      flush();
    }
  }, FLUSH_INTERVAL);

  // 防止定时器阻止进程退出
  if (flushTimer.unref) {
    flushTimer.unref();
  }
}

/**
 * 停止定时 flush 计时器
 */
function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * 将记录加入队列
 * @param {object} record - 请求记录
 */
function enqueue(record) {
  if (!record || !record.containerId) return;

  queue.push(record);

  // 紧急 flush：队列达到阈值时立即触发
  if (queue.length >= EMERGENCY_THRESHOLD && !flushing) {
    console.log(`[Realm DevWriter] 紧急 flush 触发，队列长度: ${queue.length}`);
    flush();
  }
}

/**
 * 执行 flush：批量写入队列中的记录
 * @returns {Promise<void>}
 */
async function flush() {
  if (flushing || queue.length === 0) return;

  flushing = true;

  // 取出当前队列中的所有记录
  const recordsToWrite = [...queue];
  queue = [];

  try {
    // 按容器 ID 分组
    const groups = new Map();
    for (const record of recordsToWrite) {
      if (!groups.has(record.containerId)) {
        groups.set(record.containerId, []);
      }
      groups.get(record.containerId).push(record);
    }

    // 批量写入每个容器的表
    for (const [containerId, records] of groups) {
      await writeRecords(containerId, records);
    }

    lastFlushTime = Date.now();
    totalWritten += recordsToWrite.length;
    cleanupPendingRenderedHtml();
    console.log(`[Realm DevWriter] flush 完成，写入 ${recordsToWrite.length} 条记录`);
  } catch (err) {
    console.error(`[Realm DevWriter] flush 失败:`, err.message);
    // 重试逻辑：将失败的记录重新入队
    handleFlushError(recordsToWrite, err);
  } finally {
    flushing = false;

    // flush 完成后检查是否需要再次紧急 flush
    if (queue.length >= EMERGENCY_THRESHOLD) {
      flush();
    }
  }
}

/**
 * 处理 flush 错误：重试最多 3 次
 * @param {object[]} records - 失败的记录
 * @param {Error} err - 错误信息
 */
function handleFlushError(records, err) {
  for (const record of records) {
    const key = record.requestId || `${record.url}-${record.createdAt}`;
    const retries = retryCount.get(key) || 0;

    if (retries < MAX_RETRIES) {
      // 重新入队
      retryCount.set(key, retries + 1);
      queue.push(record);
      console.log(`[Realm DevWriter] 记录重试 (${retries + 1}/${MAX_RETRIES}): ${record.url}`);
    } else {
      // 超过重试次数，丢弃
      retryCount.delete(key);
      console.error(`[Realm DevWriter] 记录丢弃（超过重试次数）: ${record.url}`);
    }
  }
}

/**
 * 批量写入记录到指定容器的表
 * @param {string} containerId - 容器 ID
 * @param {object[]} records - 记录数组
 */
async function writeRecords(containerId, records) {
  if (!db || records.length === 0) return;

  const tableName = ensureTable(containerId);

  // 消费渲染 HTML 回写缓存：捕获早于落库时，把暂存的 HTML 合入对应记录
  for (const record of records) {
    const key = `${containerId}|${record.requestId}`;
    const pending = pendingRenderedHtml.get(key);
    if (pending) {
      if (!record.renderedHtml) {
        record.renderedHtml = pending.html;
      }
      pendingRenderedHtml.delete(key);
    }
  }

  // 使用事务批量插入
  const insert = db.prepare(`
    INSERT INTO ${tableName} (
      request_id, url, method, status_code,
      request_headers, request_body,
      response_headers, response_body,
      content_type, duration, size, container_id, created_at,
      page_request_id, resource_type, rendered_html
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const record of items) {
      insert.run(
        record.requestId || '',
        record.url || '',
        record.method || 'GET',
        record.statusCode || 0,
        JSON.stringify(record.requestHeaders || {}),
        record.requestBody || '',
        JSON.stringify(record.responseHeaders || {}),
        record.responseBody || '',
        record.contentType || '',
        record.duration || 0,
        record.size || 0,
        record.containerId || '',
        record.createdAt || Date.now(),
        record.pageRequestId || '',
        record.resourceType || '',
        record.renderedHtml || ''
      );
    }
  });

  insertMany(records);
}

// ==================== 渲染后 HTML 回写 ====================

/**
 * 回写主文档记录的渲染后 HTML（页面渲染完成后由 cdp-manager 调用）
 * 三种时序均可落库：
 * 1. 记录已落库 → UPDATE 直接命中
 * 2. 记录仍在内存队列 → UPDATE miss，暂存 pendingRenderedHtml，insert 时消费
 * 3. 记录永不入库（导航失败等）→ 缓存由 TTL/容量上限兜底清理
 * @param {string} containerId - 容器 ID
 * @param {string} requestId - CDP 请求 ID（主文档记录的 request_id）
 * @param {string} html - 渲染后的 HTML
 */
function updateRenderedHtml(containerId, requestId, html) {
  if (!db || !containerId || !requestId || !html) return;

  try {
    const tableName = ensureTable(containerId);
    const result = db.prepare(`
      UPDATE ${tableName}
      SET rendered_html = ?
      WHERE request_id = ? AND (rendered_html IS NULL OR rendered_html = '')
    `).run(html, requestId);

    if (result.changes > 0) {
      return;
    }

    // 记录尚未落库，暂存待 insert 时消费
    const key = `${containerId}|${requestId}`;
    pendingRenderedHtml.set(key, { html, ts: Date.now() });

    // 容量兜底：超上限清理最旧
    if (pendingRenderedHtml.size > PENDING_RENDERED_MAX) {
      const oldestKey = [...pendingRenderedHtml.entries()]
        .sort((a, b) => a[1].ts - b[1].ts)[0][0];
      pendingRenderedHtml.delete(oldestKey);
    }
  } catch (err) {
    console.error(`[Realm DevWriter] 回写渲染后 HTML 失败:`, err.message);
  }
}

/**
 * 清理过期的渲染 HTML 回写缓存（flush 时顺带调用）
 */
function cleanupPendingRenderedHtml() {
  const now = Date.now();
  for (const [key, item] of pendingRenderedHtml) {
    if (now - item.ts > PENDING_RENDERED_TTL) {
      pendingRenderedHtml.delete(key);
    }
  }
}

// ==================== 查询函数 ====================

/**
 * 分页查询请求记录
 * @param {string} containerId - 容器 ID
 * @param {object} options - 查询选项
 * @param {number} [options.offset=0] - 偏移量
 * @param {number} [options.limit=50] - 每页条数
 * @param {string} [options.url] - URL 过滤（模糊匹配）
 * @param {string} [options.method] - 方法过滤
 * @param {number} [options.statusCode] - 状态码过滤
 * @returns {{records: object[], total: number}}
 */
function queryRecords(containerId, options = {}) {
  if (!db) return { records: [], total: 0 };

  try {
    const id = sanitizeContainerId(containerId);
    const tableName = `dev_requests_${id}`;

    // 检查表是否存在
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);

    if (!tableExists) {
      return { records: [], total: 0 };
    }

    // 老表对齐：查询侧也补齐新增列（幂等）
    migrateTableColumns(tableName);

    const { offset = 0, limit = 50, url, method, statusCode, pageRequestId, resourceType } = options;

    // 构建查询条件
    const conditions = [];
    const params = [];

    if (url) {
      conditions.push('url LIKE ?');
      params.push(`%${url}%`);
    }
    if (method) {
      conditions.push('method = ?');
      params.push(method.toUpperCase());
    }
    if (statusCode) {
      conditions.push('status_code = ?');
      params.push(parseInt(statusCode, 10));
    }
    if (pageRequestId) {
      conditions.push('page_request_id = ?');
      params.push(pageRequestId);
    }
    if (resourceType) {
      // 展示标签 → CDP 原始类型映射：HTML=Document，API=XHR+Fetch 合并筛选，
      // CSS=Stylesheet，WS=WebSocket，其余（Script/Image/Media/Font/Other）同名
      const typeGroups = {
        HTML: ['Document'],
        API: ['XHR', 'Fetch'],
        CSS: ['Stylesheet'],
        WS: ['WebSocket'],
      };
      const types = typeGroups[resourceType] || [resourceType];
      conditions.push(`resource_type IN (${types.map(() => '?').join(', ')})`);
      params.push(...types);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const { total } = db.prepare(countQuery).get(...params);

    // 查询记录
    const dataQuery = `
      SELECT * FROM ${tableName} ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const records = db.prepare(dataQuery).all(...params, limit, offset);

    // 解析 JSON 字段；剔除 rendered_html（最大 2MB，列表响应不能携带）
    const parsedRecords = records.map(record => {
      const { rendered_html, ...rest } = record;
      return {
        ...rest,
        request_headers: safeParseJson(record.request_headers),
        response_headers: safeParseJson(record.response_headers),
      };
    });

    return { records: parsedRecords, total };
  } catch (err) {
    console.error(`[Realm DevWriter] 查询记录失败:`, err.message);
    return { records: [], total: 0 };
  }
}

/**
 * 按 ID 获取单条请求记录（详情页用）
 * @param {string} containerId - 容器 ID
 * @param {number} id - 记录自增 ID
 * @returns {object|null} 记录（headers 已解析为对象），不存在返回 null
 */
function getRecordById(containerId, id) {
  if (!db) return null;

  try {
    const sanitized = sanitizeContainerId(containerId);
    const tableName = `dev_requests_${sanitized}`;

    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);

    if (!tableExists) {
      return null;
    }

    const record = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
    if (!record) {
      return null;
    }

    return {
      ...record,
      request_headers: safeParseJson(record.request_headers),
      response_headers: safeParseJson(record.response_headers),
    };
  } catch (err) {
    console.error(`[Realm DevWriter] 查询单条记录失败:`, err.message);
    return null;
  }
}

/**
 * 获取已抓取的域名列表
 * @param {string} containerId - 容器 ID
 * @returns {string[]}
 */
function queryDomains(containerId) {
  if (!db) return [];

  try {
    const id = sanitizeContainerId(containerId);
    const tableName = `dev_requests_${id}`;

    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);

    if (!tableExists) {
      return [];
    }

    const rows = db.prepare(`
      SELECT DISTINCT
        CASE
          WHEN INSTR(SUBSTR(url, INSTR(url, '//') + 2), '/') > 0
          THEN SUBSTR(SUBSTR(url, INSTR(url, '//') + 2), 1, INSTR(SUBSTR(url, INSTR(url, '//') + 2), '/') - 1)
          ELSE SUBSTR(url, INSTR(url, '//') + 2)
        END as domain
      FROM ${tableName}
      ORDER BY domain
    `).all();

    return rows.map(r => r.domain).filter(Boolean);
  } catch (err) {
    console.error(`[Realm DevWriter] 查询域名失败:`, err.message);
    return [];
  }
}

/**
 * 获取统计信息
 * @param {string} [containerId] - 容器 ID（可选，不传则返回全局统计）
 * @returns {{totalRequests: number, totalSize: number, domainCount: number}}
 */
function queryStats(containerId) {
  if (!db) return { totalRequests: 0, totalSize: 0, domainCount: 0 };

  try {
    if (containerId) {
      const id = sanitizeContainerId(containerId);
      const tableName = `dev_requests_${id}`;

      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(tableName);

      if (!tableExists) {
        return { totalRequests: 0, totalSize: 0, domainCount: 0 };
      }

      const stats = db.prepare(`
        SELECT
          COUNT(*) as totalRequests,
          COALESCE(SUM(size), 0) as totalSize
        FROM ${tableName}
      `).get();

      const domains = queryDomains(containerId);
      return {
        totalRequests: stats.totalRequests,
        totalSize: stats.totalSize,
        domainCount: domains.length,
      };
    }

    // 全局统计：查询所有 dev_requests_* 表
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'dev_requests_%'"
    ).all();

    let totalRequests = 0;
    let totalSize = 0;
    const allDomains = new Set();

    for (const { name } of tables) {
      const stats = db.prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(size), 0) as sz FROM ${name}`).get();
      totalRequests += stats.cnt;
      totalSize += stats.sz;
    }

    return { totalRequests, totalSize, domainCount: allDomains.size };
  } catch (err) {
    console.error(`[Realm DevWriter] 查询统计失败:`, err.message);
    return { totalRequests: 0, totalSize: 0, domainCount: 0 };
  }
}

/**
 * 删除单条记录
 * @param {string} containerId - 容器 ID
 * @param {number} id - 记录 ID
 * @returns {{success: boolean}}
 */
function deleteRecord(containerId, id) {
  if (!db) return { success: false };

  try {
    const tableName = ensureTable(containerId);
    db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
    return { success: true };
  } catch (err) {
    console.error(`[Realm DevWriter] 删除记录失败:`, err.message);
    return { success: false };
  }
}

/**
 * 清空容器的所有记录
 * @param {string} containerId - 容器 ID
 * @returns {{success: boolean, deleted: number}}
 */
function clearRecords(containerId) {
  if (!db) return { success: false, deleted: 0 };

  try {
    const id = sanitizeContainerId(containerId);
    const tableName = `dev_requests_${id}`;

    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);

    if (!tableExists) {
      return { success: true, deleted: 0 };
    }

    const result = db.prepare(`DELETE FROM ${tableName}`).run();
    console.log(`[Realm DevWriter] 清空容器 ${containerId} 的 ${result.changes} 条记录`);
    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error(`[Realm DevWriter] 清空记录失败:`, err.message);
    return { success: false, deleted: 0 };
  }
}

// ==================== 数据保留清理 ====================

/**
 * 清理过期记录（D-07）
 * @param {string} [containerId] - 容器 ID（可选，不传则清理所有容器）
 * @param {number} [retentionDays] - 保留天数（0 = 永不删除）
 */
function cleanupExpired(containerId, retentionDays) {
  if (!db) return;

  // 从 cdpManager 获取保留天数（如果未指定）
  let days = retentionDays;
  if (days === undefined || days === null) {
    try {
      const cdpManager = require('./cdp-manager');
      days = cdpManager.getRetentionDays();
    } catch {
      days = 7; // 默认 7 天
    }
  }

  // 0 = 永不删除
  if (days <= 0) return;

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    if (containerId) {
      // 清理指定容器
      const id = sanitizeContainerId(containerId);
      const tableName = `dev_requests_${id}`;

      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(tableName);

      if (!tableExists) return;

      const result = db.prepare(`DELETE FROM ${tableName} WHERE created_at < ?`).run(cutoffTime);
      if (result.changes > 0) {
        console.log(`[Realm DevWriter] 清理容器 ${containerId} 的 ${result.changes} 条过期记录`);
      }
    } else {
      // 清理所有容器
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'dev_requests_%'"
      ).all();

      for (const { name } of tables) {
        const result = db.prepare(`DELETE FROM ${name} WHERE created_at < ?`).run(cutoffTime);
        if (result.changes > 0) {
          console.log(`[Realm DevWriter] 清理表 ${name} 的 ${result.changes} 条过期记录`);
        }
      }
    }
  } catch (err) {
    console.error(`[Realm DevWriter] 清理过期记录失败:`, err.message);
  }
}

// ==================== 统计和清理 ====================

/**
 * 获取队列统计信息
 * @returns {{pending: number, lastFlush: number, totalWritten: number}}
 */
function getStats() {
  return {
    pending: queue.length,
    lastFlush: lastFlushTime,
    totalWritten: totalWritten,
  };
}

/**
 * 清理定时器，执行最终 flush
 * @returns {Promise<void>}
 */
async function cleanup() {
  console.log('[Realm DevWriter] 开始清理...');

  // 停止定时器
  stopFlushTimer();

  // 执行最终 flush
  if (queue.length > 0) {
    await flush();
  }

  // 清理重试计数
  retryCount.clear();

  console.log('[Realm DevWriter] 清理完成');
}

// ==================== 辅助函数 ====================

/**
 * 安全解析 JSON
 * @param {string} json - JSON 字符串
 * @returns {*} 解析结果，失败返回原始字符串
 */
function safeParseJson(json) {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

// ==================== 模块导出 ====================

module.exports = {
  init,
  initDatabase,
  enqueue,
  flush,
  getStats,
  cleanup,
  queryRecords,
  getRecordById,
  queryDomains,
  queryStats,
  deleteRecord,
  clearRecords,
  cleanupExpired,
  updateRenderedHtml,
};

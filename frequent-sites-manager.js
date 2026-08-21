/**
 * Realm Browser - 常用网站管理模块
 *
 * 使用 frecency（频率 + 最近性加权）算法计算常用网站。
 * 合并所有容器的历史记录，按域名聚合，返回最常用的网站列表。
 *
 * 依赖：better-sqlite3（复用 history-manager.js 的数据库连接）
 * 数据库路径：{userData}/history.db
 */

const path = require('path');
const { app } = require('electron');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载，
// 否则 Electron 早期启动阶段会导致 SIGSEGV 段错误
let Database = null;

// 数据库路径（延迟初始化，避免 app.getPath 在 ready 前调用）
let DB_PATH = null;

// 数据库连接实例（模块加载时初始化）
let db = null;

// ==================== Frecency 权重配置 ====================

/**
 * Frecency 权重配置（D-01）
 * 最近 7 天内访问：权重 10x
 * 最近 30 天内访问：权重 5x
 * 最近 90 天内访问：权重 1x
 */
const FRECENCY_WEIGHTS = {
  RECENT_7_DAYS: 10,
  RECENT_30_DAYS: 5,
  RECENT_90_DAYS: 1,
};

// 90 天的毫秒数，用于限制查询范围
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

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
  // WAL 模式：提升并发读写性能
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');

  console.log(`[Realm] 常用网站数据库已初始化: ${DB_PATH}`);
}

// ==================== Frecency 算法 ====================

/**
 * 计算 frecency 分数（D-01）
 * frequency * recency_weight
 *
 * @param {number} visitCount - 访问次数
 * @param {number} visitedAt - 最后访问时间戳（毫秒）
 * @returns {number} frecency 分数
 */
function calculateFrecencyScore(visitCount, visitedAt) {
  const now = Date.now();
  const daysSinceVisit = (now - visitedAt) / (1000 * 60 * 60 * 24);

  let recencyWeight = FRECENCY_WEIGHTS.RECENT_90_DAYS;
  if (daysSinceVisit <= 7) {
    recencyWeight = FRECENCY_WEIGHTS.RECENT_7_DAYS;
  } else if (daysSinceVisit <= 30) {
    recencyWeight = FRECENCY_WEIGHTS.RECENT_30_DAYS;
  }

  return visitCount * recencyWeight;
}

// ==================== 域名聚合 ====================

/**
 * 从 URL 中提取域名（去除协议和路径）
 *
 * @param {string} url - 页面 URL
 * @returns {string} 域名
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    // 如果 URL 无效，返回空字符串
    return '';
  }
}

// ==================== 核心查询 ====================

/**
 * 获取常用网站列表（D-01/D-02/D-03/D-04）
 *
 * @param {number} [limit=12] - 返回的网站数量（默认 12，6x2 网格）
 * @returns {Array} 常用网站列表
 *
 * 返回格式：
 * [
 *   {
 *     domain: 'example.com',
 *     url: 'https://example.com/page',
 *     title: '页面标题',
 *     faviconUrl: 'https://example.com/favicon.ico',
 *     visitCount: 42,
 *     frecencyScore: 156
 *   }
 * ]
 */
function getFrequentSites(limit = 12) {
  if (!db) {
    console.error('[Realm] 数据库未初始化，请先调用 initDatabase()');
    return [];
  }

  try {
    // 获取所有 history_* 表
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'history_%'
    `).all();

    if (tables.length === 0) {
      console.log('[Realm] 未找到历史记录表');
      return [];
    }

    // 构建 UNION ALL 查询，合并所有容器的历史记录
    const unionQueries = tables.map(table => `
      SELECT
        url,
        title,
        favicon_url,
        visited_at
      FROM ${table.name}
    `).join(' UNION ALL ');

    // 计算 90 天前的时间戳（毫秒）
    const cutoffTime = Date.now() - NINETY_DAYS_MS;

    // 域名聚合查询（只查最近 90 天）
    const query = `
      WITH all_history AS (
        ${unionQueries}
      ),
      -- 第一步：按域名聚合总访问次数和最后访问时间（不分组 URL）
      domain_aggregated AS (
        SELECT
          CASE
            WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0
            THEN SUBSTR(
              SUBSTR(url, INSTR(url, '://') + 3),
              1,
              INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1
            )
            ELSE SUBSTR(url, INSTR(url, '://') + 3)
          END as domain,
          COUNT(*) as total_visit_count,
          MAX(visited_at) as last_visited_at
        FROM all_history
        WHERE url NOT LIKE 'realm://%'
          AND url NOT LIKE 'about:%'
          AND visited_at >= ?
        GROUP BY domain
      ),
      -- 第二步：获取每个域名最后访问的那条记录的详细信息
      domain_latest AS (
        SELECT
          CASE
            WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0
            THEN SUBSTR(
              SUBSTR(url, INSTR(url, '://') + 3),
              1,
              INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1
            )
            ELSE SUBSTR(url, INSTR(url, '://') + 3)
          END as domain,
          url,
          title,
          favicon_url,
          visited_at,
          ROW_NUMBER() OVER (
            PARTITION BY
              CASE
                WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0
                THEN SUBSTR(
                  SUBSTR(url, INSTR(url, '://') + 3),
                  1,
                  INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1
                )
                ELSE SUBSTR(url, INSTR(url, '://') + 3)
              END
            ORDER BY visited_at DESC
          ) as rn
        FROM all_history
        WHERE url NOT LIKE 'realm://%'
          AND url NOT LIKE 'about:%'
          AND visited_at >= ?
      )
      -- 第三步：合并聚合数据和代表 URL
      SELECT
        da.domain,
        dl.url,
        dl.title,
        dl.favicon_url as faviconUrl,
        da.total_visit_count as visitCount,
        da.last_visited_at as visitedAt
      FROM domain_aggregated da
      JOIN domain_latest dl ON da.domain = dl.domain AND dl.rn = 1
      ORDER BY da.last_visited_at DESC
      LIMIT ?
    `;

    const results = db.prepare(query).all(cutoffTime, cutoffTime, limit);

    // 计算 frecency 分数
    const frequentSites = results.map(site => ({
      domain: site.domain,
      url: site.url,
      title: site.title || site.domain,
      faviconUrl: site.faviconUrl || '',
      visitCount: site.visitCount,
      frecencyScore: calculateFrecencyScore(site.visitCount, site.visitedAt),
    }));

    // 按 frecency 分数排序
    frequentSites.sort((a, b) => b.frecencyScore - a.frecencyScore);

    console.log(`[Realm] 获取常用网站: ${frequentSites.length} 个`);
    return frequentSites;

  } catch (error) {
    console.error('[Realm] 获取常用网站失败:', error);
    return [];
  }
}

// ==================== 关键词搜索 ====================

/**
 * 搜索常用网站（URL 匹配 + 标题子串匹配，支持多词查询）
 *
 * 先获取更多常用网站（100 条），再按关键词过滤。
 * URL 匹配时去除协议前缀（http:// 或 https://），支持包含匹配。
 * 多词查询时（如 "git wxnacy"），每个词都必须在 URL 或标题中出现。
 *
 * 用途：地址栏自动补全（Phase 37）
 *
 * @param {string} keyword - 搜索关键词（支持空格分隔的多词查询）
 * @param {number} [limit=10] - 返回结果数量限制
 * @returns {Array} 匹配的常用网站列表
 */
function searchFrequentSites(keyword, limit = 10) {
  if (!keyword || keyword.trim() === '') {
    return [];
  }

  // 获取更多常用网站以便过滤
  const allSites = getFrequentSites(100);

  // 拆分多词查询
  const words = keyword.toLowerCase().trim().split(/\s+/).filter(Boolean);

  // 过滤匹配的记录（每个词都必须在 URL 或标题中出现）
  const matched = allSites.filter(site => {
    const urlLower = site.url.replace(/^https?:\/\//i, '').toLowerCase();
    const titleLower = (site.title || '').toLowerCase();

    return words.every(word => {
      if (urlLower.includes(word)) return true;
      if (titleLower.includes(word)) return true;
      return false;
    });
  });

  return matched.slice(0, limit);
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  getFrequentSites,
  searchFrequentSites,
};

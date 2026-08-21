/**
 * Realm Browser - 地址栏自动补全管理模块
 *
 * 合并三个数据源（收藏夹、常用网站、历史记录）的查询结果，
 * 提供统一的补全查询接口，返回排序后的匹配结果。
 *
 * 特性：
 * - LRU 缓存（最多 100 条，60 秒过期）
 * - 收藏夹条目置顶（per D-04）
 * - 其余按 frecency 排序（per D-06）
 * - URL 前缀 + 标题子串双重匹配（per D-05）
 *
 * 依赖：favorites-manager, frequent-sites-manager, history-manager
 */

const favoritesManager = require('./favorites-manager');
const frequentSitesManager = require('./frequent-sites-manager');
const historyManager = require('./history-manager');

// ==================== LRU 缓存 ====================

/** 缓存存储：keyword(lowercase) → { results, timestamp } */
const cache = new Map();

/** 缓存最大条目数 */
const CACHE_MAX_SIZE = 100;

/** 缓存过期时间（毫秒） */
const CACHE_TTL_MS = 60 * 1000;

/**
 * 缓存清理定时器：每 30 秒清理超过 60 秒的条目
 * 避免长时间运行后缓存无限增长
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}, 30 * 1000);

// ==================== 核心查询 ====================

/**
 * 获取自动补全建议（per D-01）
 *
 * 查询三个数据源（收藏夹、常用网站、历史记录），合并去重后排序返回。
 * 相同前缀的查询结果被缓存，不重复查询数据库（per D-16）。
 *
 * @param {string} keyword - 搜索关键词
 * @param {number} [limit=6] - 返回结果数量限制
 * @returns {Array<{url: string, title: string, faviconUrl: string, source: string}>} 补全建议列表
 */
function getSuggestions(keyword, limit = 6) {
  if (!keyword || keyword.trim() === '') {
    return [];
  }

  const cacheKey = keyword.toLowerCase();

  // 缓存检查（per D-16）
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.results.slice(0, limit);
  }

  // 查询三个数据源（per D-01, D-02）
  const favorites = favoritesManager.searchFulltext({ keyword, limit: 10 }) || [];
  const frequentSites = frequentSitesManager.searchFrequentSites(keyword, 10) || [];
  const historyRecords = historyManager.searchAllContainers(keyword, 20) || [];

  // 合并去重：按 URL 去重，收藏夹条目保留优先
  const urlMap = new Map();

  // 收藏夹优先（per D-04）
  for (const fav of favorites) {
    if (fav.url) {
      urlMap.set(fav.url, {
        url: fav.url,
        title: fav.title || '',
        faviconUrl: fav.favicon_url || fav.faviconUrl || '',
        source: 'favorite',
      });
    }
  }

  // 常用网站（frecency 已排序）
  for (const site of frequentSites) {
    if (site.url && !urlMap.has(site.url)) {
      urlMap.set(site.url, {
        url: site.url,
        title: site.title || '',
        faviconUrl: site.faviconUrl || site.favicon_url || '',
        source: 'frequent',
        frecencyScore: site.frecencyScore || 0,
      });
    }
  }

  // 历史记录
  for (const record of historyRecords) {
    if (record.url && !urlMap.has(record.url)) {
      urlMap.set(record.url, {
        url: record.url,
        title: record.title || '',
        faviconUrl: record.favicon_url || record.faviconUrl || '',
        source: 'history',
      });
    }
  }

  // 排序：收藏夹置顶，其余按 frecency（per D-04, D-06）
  const allResults = Array.from(urlMap.values());
  allResults.sort((a, b) => {
    // 收藏夹始终排在最前
    if (a.source === 'favorite' && b.source !== 'favorite') return -1;
    if (a.source !== 'favorite' && b.source === 'favorite') return 1;

    // 非收藏夹条目按 frecency 排序
    const scoreA = a.frecencyScore || 0;
    const scoreB = b.frecencyScore || 0;
    return scoreB - scoreA;
  });

  // 截取 top limit 条并缓存
  const results = allResults.slice(0, limit);

  // 缓存结果
  cache.set(cacheKey, {
    results,
    timestamp: Date.now(),
  });

  // 缓存大小限制：超过上限时删除最旧的条目
  if (cache.size > CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  return results;
}

// ==================== 导出 ====================

module.exports = {
  getSuggestions,
};

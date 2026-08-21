/**
 * Realm Browser - 地址栏自动补全管理模块
 *
 * 合并三个数据源（收藏夹、常用网站、历史记录）的查询结果，
 * 提供统一的补全查询接口，返回排序后的匹配结果。
 *
 * 特性：
 * - LRU 缓存（最多 100 条，60 秒过期）
 * - 匹配度优先排序：URL 前缀 > 域名匹配 > 标题匹配
 * - 相同匹配度时收藏夹优先（per D-04）
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

/** 缓存清理定时器引用（用于应用退出时清理） */
let cleanupTimer = null;

/**
 * 启动缓存清理定时器：每 30 秒清理超过 60 秒的条目
 * 避免长时间运行后缓存无限增长
 */
function startCleanupTimer() {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
      }
    }
  }, 30 * 1000);
}

/**
 * 停止缓存清理定时器（应用退出时调用，防止内存泄漏）
 */
function stopCleanupTimer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// 启动清理定时器
startCleanupTimer();

// ==================== 匹配度评分 ====================

/**
 * 计算搜索结果的匹配度分数（越高越相关，支持多词查询）
 *
 * 评分规则（每个词独立评分后取平均）：
 * - URL 前缀精确匹配（去协议后）：100 分
 * - URL 中域名开头匹配：80 分
 * - URL 中包含关键词：40 分
 * - 标题包含关键词：20 分
 * - 收藏夹加分：+5 分（仅在匹配度相同时起区分作用）
 *
 * @param {Object} item - 补全建议对象
 * @param {string} keywordLower - 小写关键词（可能包含空格）
 * @returns {number} 匹配度分数
 */
function calculateRelevanceScore(item, keywordLower) {
  const urlLower = item.url.replace(/^https?:\/\//i, '').toLowerCase();
  const titleLower = (item.title || '').toLowerCase();
  const domain = urlLower.split('/')[0];

  // 拆分多词
  const words = keywordLower.split(/\s+/).filter(Boolean);

  // 每个词独立评分，取平均
  let totalScore = 0;
  for (const word of words) {
    let wordScore = 0;

    // URL 前缀匹配（最高优先级）
    if (urlLower.startsWith(word)) {
      wordScore = 100;
    }
    // 域名部分开头匹配（如输入 "hugg" 匹配 "huggingface.co"）
    else if (domain.startsWith(word)) {
      wordScore = 80;
    }
    // URL 中包含关键词
    else if (urlLower.includes(word)) {
      wordScore = 40;
    }

    // 标题匹配（独立加分，与 URL 匹配叠加）
    if (titleLower.includes(word)) {
      wordScore += 20;
    }

    totalScore += wordScore;
  }

  const score = totalScore / words.length;

  // 收藏夹加分（仅在匹配度相同时起区分作用）
  if (item.source === 'favorite') {
    return score + 5;
  }

  return score;
}

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

  // 排序：匹配度优先，相同匹配度时收藏夹优先，再按 frecency（per D-04, D-05, D-06）
  const keywordLower = keyword.toLowerCase();
  const allResults = Array.from(urlMap.values());
  allResults.sort((a, b) => {
    // 匹配度优先
    const relA = calculateRelevanceScore(a, keywordLower);
    const relB = calculateRelevanceScore(b, keywordLower);
    if (relA !== relB) return relB - relA;

    // 相同匹配度时，收藏夹优先
    if (a.source === 'favorite' && b.source !== 'favorite') return -1;
    if (a.source !== 'favorite' && b.source === 'favorite') return 1;

    // 再按 frecency 排序
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
  while (cache.size >= CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  return results;
}

// ==================== 导出 ====================

module.exports = {
  getSuggestions,
  stopCleanupTimer,
};

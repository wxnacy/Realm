/**
 * Realm Browser - 搜索管理器
 *
 * 为 AI 助手提供网络搜索能力，支持多个搜索 Provider、速率限制、SSRF 防护和智能 Fallback。
 *
 * 功能概述：
 * - SearchRateLimiter：每 Provider 独立速率限制器（队列管理 + 并发控制 + 退避策略）
 * - SSRF 防护：isPrivateHost 检测域名是否解析到私有 IP
 * - 搜索 Provider：Tavily、Brave、Serper、AnySearch（付费+免费）、DuckDuckGo 浏览器
 * - Auto Fallback：按优先级遍历 Provider 链，自动降级
 * - 结果标准化：统一输出格式 {title, url, content, rank?, score?, metadata?}
 *
 * 参考实现：OpenHanako 项目（web-search.ts、search-rate-limiter.ts）
 *
 * 所有 HTTP 请求使用 Electron net.fetch（Chromium 网络栈），确保系统代理兼容。
 *
 * @module search-manager
 */

'use strict';

const { net, BrowserWindow } = require('electron');
const { lookup } = require('dns').promises;
const { isIP } = require('net');
const { session } = require('electron');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');

// ==================== 常量定义 ====================

/** 默认重试抖动（毫秒） */
const DEFAULT_RETRY_JITTER_MS = 1_000;

/** AnySearch 付费 Provider ID */
const ANYSEARCH_PROVIDER = 'anysearch';

/** AnySearch 免费 Provider ID */
const ANYSEARCH_FREE_PROVIDER = 'anysearch_free';

/** AnySearch 搜索 API 端点 */
const ANYSEARCH_SEARCH_URL = 'https://api.anysearch.com/v1/search';

/** 默认搜索结果展示数量 */
const DEFAULT_DISPLAY_RESULTS = 10;

/** 默认 API 搜索结果数量 */
const DEFAULT_API_RESULTS = 10;

/** AnySearch 默认结果数量 */
const ANYSEARCH_DEFAULT_RESULTS = 20;

/** AnySearch 最大结果数量 */
const ANYSEARCH_MAX_RESULTS = 100;

/** Tavily 最大结果数量 */
const TAVILY_MAX_RESULTS = 20;

/** 浏览器 Provider 最大结果数量 */
const BROWSER_MAX_RESULTS = 10;

/** 搜索请求超时（毫秒） */
const SEARCH_TIMEOUT_MS = 30_000;

/** DDG 浏览器搜索页面加载后等待时间（毫秒） */
const DDG_LOAD_DELAY_MS = 1_500;

/** DDG 浏览器搜索 User-Agent */
const DDG_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** web_fetch 请求超时（毫秒） */
const FETCH_TIMEOUT_MS = 15_000;

/** web_fetch 最大重定向次数 */
const MAX_REDIRECTS = 5;

/** web_fetch 默认最大内容长度 */
const FETCH_DEFAULT_MAX_LENGTH = 12_000;

// ==================== SearchRateLimiter 默认策略 ====================

/**
 * 默认速率限制策略参数表
 *
 * 来自 OpenHanako 项目，经过实际测试调优。
 * 每个 Provider 独立配置：最小间隔、抖动、最大并发、限流基础延迟、最大冷却时间。
 *
 * @type {Object}
 */
const DEFAULT_POLICIES = Object.freeze({
  tavily: Object.freeze({
    minIntervalMs: 650,
    jitterMs: 350,
    rateLimitBaseDelayMs: 2_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
  brave: Object.freeze({
    minIntervalMs: 1_100,
    jitterMs: 400,
    rateLimitBaseDelayMs: 2_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
  serper: Object.freeze({
    minIntervalMs: 1_000,
    jitterMs: 500,
    rateLimitBaseDelayMs: 2_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
  anysearch: Object.freeze({
    minIntervalMs: 0,
    jitterMs: 0,
    maxConcurrent: 5,
    rateLimitBaseDelayMs: 2_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
  anysearch_free: Object.freeze({
    minIntervalMs: 0,
    jitterMs: 0,
    maxConcurrent: 3,
    rateLimitBaseDelayMs: 10_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
  duckduckgo_browser: Object.freeze({
    minIntervalMs: 3_000,
    jitterMs: 4_000,
    rateLimitBaseDelayMs: 10_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
});

/**
 * Fallback 策略（当 Provider 不在 DEFAULT_POLICIES 中时使用）
 *
 * @type {Object}
 */
const FALLBACK_POLICIES = Object.freeze({
  browser: Object.freeze({
    minIntervalMs: 3_000,
    jitterMs: 4_000,
    rateLimitBaseDelayMs: 10_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
  api: Object.freeze({
    minIntervalMs: 1_000,
    jitterMs: 500,
    rateLimitBaseDelayMs: 2_000,
    retryJitterMs: DEFAULT_RETRY_JITTER_MS,
    maxCooldownMs: 5 * 60_000,
  }),
});

// ==================== SSRF 防护 ====================

/**
 * 私有 IP 地址正则数组
 *
 * 覆盖：loopback（127.x、::1、0.0.0.0）、RFC 1918（10.x、172.16-31.x、192.168.x）、
 * link-local（169.254.x、fe80:）、IPv6 ULA（fc00:/fdxx:）
 *
 * @type {RegExp[]}
 */
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^0:0:0:0:0:0:0:1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fe80:/i,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
];

/**
 * 检查域名是否解析到私有 IP 地址（SSRF 防护）
 *
 * 流程：
 * 1. 如果 hostname 本身是 IP 地址，直接检查是否在私有范围内
 * 2. 使用 dns.lookup 解析域名获取所有 IP
 * 3. 检查是否有任一 IP 在私有范围内
 * 4. DNS 解析失败时返回 true（安全默认值，阻止请求）
 *
 * @param {string} hostname - 域名或 IP 地址
 * @returns {Promise<boolean>} 如果解析到私有 IP 返回 true
 */
async function isPrivateHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;

  // 如果是 IP 地址，直接检查
  if (isIP(hostname)) {
    return PRIVATE_IP_RANGES.some(r => r.test(hostname));
  }

  try {
    const results = await lookup(hostname, { all: true });
    if (results.length === 0) return true;
    return results.some(r => PRIVATE_IP_RANGES.some(pat => pat.test(r.address)));
  } catch {
    // DNS 解析失败时返回 true（安全默认值）
    return true;
  }
}

// ==================== SearchRateLimitError ====================

/**
 * 搜索限流错误类
 *
 * 当搜索 API 返回 429/402 状态码时抛出，携带重试等待时间信息。
 *
 * @class
 * @extends Error
 */
class SearchRateLimitError extends Error {
  /**
   * @param {string} message - 错误消息
   * @param {Object} [options] - 选项
   * @param {number} [options.status=429] - HTTP 状态码
   * @param {number|null} [options.retryAfterMs=null] - 建议重试等待时间（毫秒）
   */
  constructor(message, { status = 429, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'SearchRateLimitError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.isSearchRateLimitError = true;
  }
}

// ==================== SearchRateLimiter ====================

/**
 * 搜索速率限制器
 *
 * 每个 Provider 独立实例，维护：
 * - 请求队列（先进先出）
 * - 并发控制（maxConcurrent）
 * - 最小间隔（minIntervalMs + jitter）
 * - 429 退避（指数退避 + retryAfterMs）
 *
 * @class
 */
class SearchRateLimiter {
  /**
   * @param {Object} [options] - 配置选项
   * @param {Object} [options.policies={}] - 自定义策略覆盖
   * @param {Function} [options.random=Math.random] - 随机数生成器（测试用）
   */
  constructor({ policies = {}, random = Math.random } = {}) {
    this._policies = { ...DEFAULT_POLICIES, ...policies };
    this._random = random;
    this._states = new Map();
  }

  /**
   * 重置所有状态，清理定时器
   */
  reset() {
    for (const state of this._states.values()) {
      if (state.pumpTimer) clearTimeout(state.pumpTimer);
    }
    this._states.clear();
  }

  /**
   * 执行受速率限制的操作
   *
   * @param {string} provider - Provider ID
   * @param {string} sourceType - 'api' | 'browser'
   * @param {Function} operation - 异步操作函数
   * @returns {Promise<any>} 操作结果
   */
  async run(provider, sourceType, operation) {
    const key = String(provider || sourceType || 'search');
    const state = this._stateFor(key);
    return new Promise((resolve, reject) => {
      state.queue.push({ sourceType, operation, resolve, reject });
      this._pump(key);
    });
  }

  /**
   * 获取或创建 Provider 的速率限制状态
   * @param {string} key - Provider key
   * @returns {Object} 状态对象
   * @private
   */
  _stateFor(key) {
    let state = this._states.get(key);
    if (!state) {
      state = {
        queue: [],
        activeCount: 0,
        pumpTimer: null,
        lastStartAt: null,
        nextStartAt: 0,
        cooldownUntil: 0,
        rateLimitFailures: 0,
      };
      this._states.set(key, state);
    }
    return state;
  }

  /**
   * 获取 Provider 的速率限制策略
   * @param {string} provider - Provider ID
   * @param {string} sourceType - 'api' | 'browser'
   * @returns {Object} 策略参数
   * @private
   */
  _policy(provider, sourceType) {
    return this._policies[provider]
      || FALLBACK_POLICIES[sourceType]
      || FALLBACK_POLICIES.api;
  }

  /**
   * 生成随机抖动值
   * @param {number} maxMs - 最大抖动毫秒数
   * @returns {number} 随机抖动值
   * @private
   */
  _jitter(maxMs) {
    const max = positiveInteger(maxMs);
    if (max <= 0) return 0;
    return Math.floor(this._random() * max);
  }

  /**
   * 获取 Provider 的最大并发数
   * @param {string} provider - Provider ID
   * @param {string} sourceType - 'api' | 'browser'
   * @returns {number} 最大并发数
   * @private
   */
  _maxConcurrent(provider, sourceType) {
    return positiveConcurrency(this._policy(provider, sourceType).maxConcurrent);
  }

  /**
   * 计算下次启动延迟
   * @param {string} provider - Provider ID
   * @param {string} sourceType - 'api' | 'browser'
   * @returns {number} 延迟毫秒数
   * @private
   */
  _nextStartDelay(provider, sourceType) {
    const state = this._stateFor(provider);
    const now = Date.now();
    const waitUntil = Math.max(state.nextStartAt || 0, state.cooldownUntil || 0);
    return Math.max(0, waitUntil - now);
  }

  /**
   * 调度队列泵
   * @param {string} provider - Provider ID
   * @param {string} sourceType - 'api' | 'browser'
   * @param {number} delayMs - 延迟毫秒数
   * @private
   */
  _schedulePump(provider, sourceType, delayMs) {
    const state = this._stateFor(provider);
    if (state.pumpTimer) return;
    state.pumpTimer = setTimeout(() => {
      state.pumpTimer = null;
      this._pump(provider, sourceType);
    }, delayMs);
  }

  /**
   * 队列泵：从队列中取出任务执行
   * @param {string} provider - Provider ID
   * @param {string} [sourceType] - 'api' | 'browser'
   * @private
   */
  _pump(provider, sourceType) {
    const state = this._stateFor(provider);
    if (state.queue.length === 0) return;

    while (state.queue.length > 0) {
      const task = state.queue[0];
      const taskSourceType = task.sourceType;
      if (state.activeCount >= this._maxConcurrent(provider, taskSourceType)) return;

      const delayMs = this._nextStartDelay(provider, taskSourceType);
      if (delayMs > 0) {
        this._schedulePump(provider, taskSourceType, delayMs);
        return;
      }

      state.queue.shift();
      this._startTask(provider, task);
    }
  }

  /**
   * 启动单个任务
   * @param {string} provider - Provider ID
   * @param {Object} task - 队列任务
   * @private
   */
  _startTask(provider, task) {
    const state = this._stateFor(provider);
    const sourceType = task.sourceType;
    state.activeCount += 1;
    state.lastStartAt = Date.now();
    const policy = this._policy(provider, sourceType);
    state.nextStartAt = state.lastStartAt
      + positiveInteger(policy.minIntervalMs)
      + this._jitter(policy.jitterMs);
    if (state.cooldownUntil && state.cooldownUntil <= state.lastStartAt) {
      state.cooldownUntil = 0;
    }

    Promise.resolve()
      .then(task.operation)
      .then((result) => {
        state.rateLimitFailures = 0;
        task.resolve(result);
      })
      .catch((err) => {
        this._recordRateLimit(provider, sourceType, err);
        task.reject(err);
      })
      .finally(() => {
        state.activeCount = Math.max(0, state.activeCount - 1);
        this._pump(provider);
      });
  }

  /**
   * 记录限流事件，计算冷却时间
   * @param {string} provider - Provider ID
   * @param {string} sourceType - 'api' | 'browser'
   * @param {Error} err - 错误对象
   * @private
   */
  _recordRateLimit(provider, sourceType, err) {
    if (!err?.isSearchRateLimitError && err?.status !== 429) return;

    const state = this._stateFor(provider);
    const policy = this._policy(provider, sourceType);
    const retryAfter = err?.retryAfterMs == null ? null : Number(err.retryAfterMs);
    const hasRetryAfter = Number.isFinite(retryAfter) && retryAfter >= 0;
    const baseCooldownMs = hasRetryAfter
      ? Math.floor(retryAfter)
      : positiveInteger(policy.rateLimitBaseDelayMs) * (2 ** Math.min(state.rateLimitFailures, 8));
    const cooldownMs = Math.min(
      positiveInteger(policy.maxCooldownMs),
      baseCooldownMs + this._jitter(policy.retryJitterMs),
    );
    state.rateLimitFailures += 1;
    state.cooldownUntil = Math.max(state.cooldownUntil || 0, Date.now() + cooldownMs);
  }
}

// ==================== 辅助函数 ====================

/**
 * 转换为正整数
 * @param {any} value - 输入值
 * @returns {number} 正整数或 0
 */
function positiveInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * 转换为正并发数（至少为 1）
 * @param {any} value - 输入值
 * @returns {number} 正并发数
 */
function positiveConcurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * 从 Response headers 解析 Retry-After 值
 *
 * @param {Headers} headers - Response headers
 * @returns {number|null} 重试等待毫秒数，或 null
 */
function retryAfterMsFromHeaders(headers) {
  if (!headers) return null;
  const raw = headers.get?.('retry-after') || headers.get?.('Retry-After');
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1_000);
  }

  const retryAt = Date.parse(raw);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - Date.now());
}

/**
 * 检查 429/402 响应，抛出 SearchRateLimitError
 * @param {Response} res - HTTP Response
 * @param {string} label - Provider 名称
 */
function throwIfRateLimited(res, label) {
  if (res.status !== 429 && res.status !== 402) return;
  throw new SearchRateLimitError(`${label} API ${res.status}`, {
    status: res.status,
    retryAfterMs: retryAfterMsFromHeaders(res.headers),
  });
}

/**
 * 检查 HTTP 错误响应
 * @param {Response} res - HTTP Response
 * @param {string} label - Provider 名称
 * @param {Object} data - 响应数据
 */
function throwIfHttpError(res, label, data) {
  if (res.ok) return;
  const message = typeof data?.error === 'string'
    ? data.error
    : typeof data?.message === 'string'
      ? data.message
      : '';
  throw new Error(`${label} API ${res.status}${message ? `: ${message}` : ''}`);
}

/**
 * 限制结果数量到范围内
 * @param {number} maxResults - 请求数量
 * @param {Object} options - 范围选项
 * @param {number} options.defaultValue - 默认值
 * @param {number} options.max - 最大值
 * @param {number} [options.min=1] - 最小值
 * @returns {number} 限制后的数量
 */
function clampResultsToRange(maxResults, { defaultValue, max, min = 1 }) {
  const value = Number(maxResults);
  if (!Number.isFinite(value)) return defaultValue;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * 判断是否为 AnySearch 系列 Provider
 * @param {string} provider - Provider ID
 * @returns {boolean}
 */
function isAnySearchProvider(provider) {
  return provider === ANYSEARCH_PROVIDER || provider === ANYSEARCH_FREE_PROVIDER;
}

/**
 * 获取 Provider 的最大结果数量
 * @param {string} provider - Provider ID
 * @param {number} maxResults - 请求数量
 * @returns {number} 限制后的数量
 */
function maxResultsForProvider(provider, maxResults) {
  if (isAnySearchProvider(provider)) {
    return clampResultsToRange(maxResults, {
      defaultValue: ANYSEARCH_DEFAULT_RESULTS,
      max: ANYSEARCH_MAX_RESULTS,
    });
  }
  if (provider === 'tavily') {
    return clampResultsToRange(maxResults, {
      defaultValue: DEFAULT_API_RESULTS,
      max: TAVILY_MAX_RESULTS,
    });
  }
  if (provider === 'duckduckgo_browser') {
    return clampResultsToRange(maxResults, {
      defaultValue: DEFAULT_DISPLAY_RESULTS,
      max: BROWSER_MAX_RESULTS,
    });
  }
  return clampResultsToRange(maxResults, {
    defaultValue: DEFAULT_API_RESULTS,
    max: DEFAULT_DISPLAY_RESULTS,
  });
}

/**
 * 获取展示结果数量限制
 * @param {number} maxResults - 请求数量
 * @returns {number} 限制后的数量
 */
function maxResultsForDisplay(maxResults) {
  return clampResultsToRange(maxResults, {
    defaultValue: DEFAULT_DISPLAY_RESULTS,
    max: ANYSEARCH_MAX_RESULTS,
  });
}

/**
 * 分类搜索错误
 *
 * @param {Error} err - 错误对象
 * @returns {string} 错误类型: 'rate_limited' | 'auth' | 'blocked' | 'extraction_failed' | 'error'
 */
function classifySearchError(err) {
  if (err instanceof SearchRateLimitError || err?.isSearchRateLimitError || err?.status === 429) return 'rate_limited';
  const message = String(err?.message || '');
  if (/402|quota|rate.?limit|too many/i.test(message)) return 'rate_limited';
  if (/api key|required|unauthorized|forbidden|401|403/i.test(message)) return 'auth';
  if (/blocked|captcha/i.test(message)) return 'blocked';
  if (/extract/i.test(message)) return 'extraction_failed';
  return 'error';
}

/**
 * 检测文本是否包含 CJK 字符
 * @param {string} text - 输入文本
 * @returns {boolean}
 */
function hasCjk(text) {
  return /[㐀-鿿]/.test(String(text || ''));
}

/**
 * 标准化质量检测文本
 * @param {string} text - 输入文本
 * @returns {string} 标准化后的文本
 */
function normalizeQualityText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、""''：《》？！（）()|_\-—:;,.!?/\\[\]{}]+/g, '');
}

/**
 * 从查询中提取质量检测词
 * @param {string} query - 搜索查询
 * @returns {string[]} 中文词列表
 */
function queryQualityTerms(query) {
  return String(query || '')
    .split(/\s+/)
    .map((term) => normalizeQualityText(term))
    .filter((term) => hasCjk(term) && term.length >= 2);
}

/**
 * 检测结果是否看起来像字典/百科类
 * @param {Object} result - 搜索结果
 * @returns {boolean}
 */
function looksLikeDictionaryResult(result) {
  const text = normalizeQualityText(`${result.title || ''} ${result.url || ''} ${result.content || ''}`);
  return /汉语文字|汉典|字典|词典|基本解释|百度百科|hanyu|zdic|zidian|cidian/.test(text);
}

/**
 * 检测低质量搜索结果（仅对 CJK 查询）
 *
 * 检测逻辑：
 * 1. 查询必须包含 CJK 字符
 * 2. 查询必须包含 ≥3 个中文词
 * 3. 前 3 个结果中大量是字典/百科类
 * 4. 查询词匹配度 ≤1
 *
 * @param {string} query - 搜索查询
 * @param {Object[]} results - 搜索结果数组
 * @returns {boolean} 如果是低质量结果返回 true
 */
function isLikelyLowQualityResults(query, results) {
  if (!hasCjk(query) || !Array.isArray(results) || results.length === 0) return false;
  const terms = queryQualityTerms(query);
  if (terms.length < 3) return false;
  const top = results.slice(0, Math.min(3, results.length));
  const topText = normalizeQualityText(top.map((r) => `${r.title || ''} ${r.url || ''} ${r.content || ''}`).join(' '));
  const matchedTerms = terms.filter((term) => topText.includes(term)).length;
  const dictionaryCount = top.filter(looksLikeDictionaryResult).length;
  return dictionaryCount >= Math.min(2, top.length) && matchedTerms <= 1;
}

/**
 * AnySearch 语言代码映射
 * @param {string} locale - 系统 locale
 * @returns {string} 语言代码
 */
function anySearchLanguage(locale) {
  const normalized = String(locale || '').toLowerCase();
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  return 'en';
}

/**
 * 从 AnySearch 响应中提取结果数组
 * @param {Object} data - 响应数据
 * @returns {Object[]} 结果数组
 */
function anySearchResultsFrom(data) {
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/**
 * 从 AnySearch 响应中提取 metadata
 * @param {Object} data - 响应数据
 * @returns {Object} metadata
 */
function anySearchMetadataFrom(data) {
  return data?.data?.metadata || data?.metadata || {};
}

/**
 * 检查 AnySearch 响应 envelope 错误
 * @param {Object} data - 响应数据
 */
function throwIfAnySearchEnvelopeError(data) {
  if (!data || typeof data !== 'object') return;
  if (data.code === undefined || data.code === 0) return;
  const message = typeof data.message === 'string' && data.message.trim()
    ? data.message.trim()
    : `code ${data.code}`;
  throw new Error(`AnySearch API ${message}`);
}

/**
 * 标准化单个搜索结果
 * @param {Object} r - 原始结果
 * @returns {Object} 标准化后的结果
 */
function normalizeSearchResult(r) {
  return {
    title: r.title || '',
    url: r.url || '',
    content: r.content || r.snippet || '',
    rank: r.rank ?? null,
    score: r.score ?? null,
    metadata: r.metadata || {},
  };
}

/**
 * 标准化 Provider payload
 * @param {string} query - 搜索查询
 * @param {string} provider - Provider ID
 * @param {Object} meta - Provider 元数据
 * @param {Object|Array} payload - Provider 返回的数据
 * @returns {Object} 标准化后的 payload
 */
function normalizeProviderPayload(query, provider, meta, payload) {
  if (Array.isArray(payload)) {
    return {
      query,
      results: payload.map(normalizeSearchResult),
      provider,
      source_type: meta.sourceType,
      diagnostics: {},
    };
  }
  return {
    query: payload.query || query,
    results: (payload.results || []).map(normalizeSearchResult),
    provider,
    source_type: payload.source_type || meta.sourceType,
    diagnostics: payload.diagnostics || {},
  };
}

/**
 * 附加 Auto 诊断信息
 * @param {Object} payload - 搜索 payload
 * @param {Object[]} attempts - 尝试记录
 * @param {Object} [extra={}] - 额外信息
 * @returns {Object} 附加诊断信息后的 payload
 */
function attachAutoDiagnostics(payload, attempts, extra = {}) {
  return {
    ...payload,
    diagnostics: {
      ...(payload.diagnostics || {}),
      strategy: 'auto',
      attempts,
      ...extra,
    },
  };
}

/**
 * 格式化搜索结果为 Markdown 编号列表
 *
 * @param {Object[]} results - 搜索结果数组
 * @param {number} [displayLimit=10] - 展示数量限制
 * @returns {string} Markdown 格式的结果列表
 */
function formatSearchResults(results, displayLimit) {
  const limit = displayLimit || DEFAULT_DISPLAY_RESULTS;
  return results
    .slice(0, limit)
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`)
    .join('\n\n');
}

// ==================== Provider 注册表 ====================

/**
 * Provider 注册表
 *
 * 每个 Provider 包含：
 * - search: 搜索函数
 * - requiresApiKey: 是否需要 API Key
 * - sourceType: 'api' | 'browser'
 */
const PROVIDERS = {};

// 延迟注册 Provider（函数定义后）
// endpoint: API 端点 URL（用于 SSRF 防护检查，仅 API 类型 Provider 需要）
function registerProviders() {
  PROVIDERS.tavily = { search: searchTavily, requiresApiKey: true, sourceType: 'api', endpoint: 'https://api.tavily.com/search' };
  PROVIDERS.brave = { search: searchBrave, requiresApiKey: true, sourceType: 'api', endpoint: 'https://api.search.brave.com/res/v1/web/search' };
  PROVIDERS.serper = { search: searchSerper, requiresApiKey: true, sourceType: 'api', endpoint: 'https://google.serper.dev/search' };
  PROVIDERS[ANYSEARCH_PROVIDER] = { search: searchAnySearch, requiresApiKey: true, sourceType: 'api', endpoint: ANYSEARCH_SEARCH_URL };
  PROVIDERS[ANYSEARCH_FREE_PROVIDER] = { search: searchAnySearchFree, requiresApiKey: false, sourceType: 'api', endpoint: ANYSEARCH_SEARCH_URL };
  PROVIDERS.duckduckgo_browser = { search: searchDDGBrowser, requiresApiKey: false, sourceType: 'browser', endpoint: 'https://duckduckgo.com/' };
}

/**
 * 获取 Provider 元数据
 * @param {string} provider - Provider ID
 * @returns {Object} Provider 元数据
 */
function providerMeta(provider) {
  const meta = PROVIDERS[provider];
  if (!meta) throw new Error(`Unknown provider: ${provider}`);
  return meta;
}

// ==================== Provider 实现 ====================

// 延迟获取 app 引用（避免模块加载时序问题）
let _app = null;
function getApp() {
  if (!_app) {
    try {
      _app = require('electron').app;
    } catch {
      _app = { getLocale: () => 'en' };
    }
  }
  return _app;
}

/**
 * 获取系统 locale
 * @returns {string} locale 字符串
 */
function getLocaleSafe() {
  try {
    return getApp().getLocale?.() || process.env.LANG || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Tavily API Provider
 *
 * POST https://api.tavily.com/search
 * Authorization: Bearer {apiKey}
 *
 * @param {string} query - 搜索查询
 * @param {number} maxResults - 最大结果数量
 * @param {string} apiKey - API Key
 * @returns {Promise<Object[]>} 搜索结果数组
 */
async function searchTavily(query, maxResults, apiKey) {
  const res = await net.fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: 'basic',
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  throwIfRateLimited(res, 'Tavily');
  const data = await res.json().catch(() => null);
  throwIfHttpError(res, 'Tavily', data);
  if (!data) throw new Error(`Tavily API ${res.status}`);

  return (data.results || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    content: r.content || '',
  }));
}

/**
 * Brave Search API Provider
 *
 * GET https://api.search.brave.com/res/v1/web/search
 * X-Subscription-Token: {apiKey}
 *
 * @param {string} query - 搜索查询
 * @param {number} maxResults - 最大结果数量
 * @param {string} apiKey - API Key
 * @returns {Promise<Object[]>} 搜索结果数组
 */
async function searchBrave(query, maxResults, apiKey) {
  const params = new URLSearchParams({ q: query, count: String(maxResults) });
  const res = await net.fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  throwIfRateLimited(res, 'Brave');
  const data = await res.json().catch(() => null);
  throwIfHttpError(res, 'Brave', data);
  if (!data) throw new Error(`Brave API ${res.status}`);

  return (data.web?.results || []).slice(0, maxResults).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    content: r.description || '',
  }));
}

/**
 * Serper API Provider（Google 搜索）
 *
 * POST https://google.serper.dev/search
 * X-API-KEY: {apiKey}
 *
 * @param {string} query - 搜索查询
 * @param {number} maxResults - 最大结果数量
 * @param {string} apiKey - API Key
 * @returns {Promise<Object[]>} 搜索结果数组
 */
async function searchSerper(query, maxResults, apiKey) {
  const res = await net.fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ q: query, num: maxResults }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  throwIfRateLimited(res, 'Serper');
  const data = await res.json().catch(() => null);
  throwIfHttpError(res, 'Serper', data);
  if (!data) throw new Error(`Serper API ${res.status}`);

  return (data.organic || []).slice(0, maxResults).map((r) => ({
    title: r.title || '',
    url: r.link || '',
    content: r.snippet || '',
  }));
}

/**
 * AnySearch Provider（付费+免费共用）
 *
 * POST https://api.anysearch.com/v1/search
 * 有 apiKey 时：Authorization: Bearer {apiKey}
 * 无 apiKey 时：匿名调用（免费模式）
 *
 * @param {string} query - 搜索查询
 * @param {number} maxResults - 最大结果数量
 * @param {string} apiKey - API Key（可为空）
 * @param {string} provider - Provider ID（anysearch 或 anysearch_free）
 * @returns {Promise<Object>} 搜索结果 payload
 */
async function searchAnySearch(query, maxResults, apiKey, provider) {
  const resultLimit = maxResultsForProvider(provider, maxResults);
  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const res = await net.fetch(ANYSEARCH_SEARCH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      max_results: resultLimit,
      language: anySearchLanguage(getLocaleSafe()),
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  throwIfRateLimited(res, 'AnySearch');
  const data = await res.json().catch(() => null);
  throwIfHttpError(res, 'AnySearch', data);
  if (!data) throw new Error(`AnySearch API ${res.status}`);
  throwIfAnySearchEnvelopeError(data);

  const metadata = anySearchMetadataFrom(data);
  return {
    query,
    provider,
    source_type: 'api',
    results: anySearchResultsFrom(data).slice(0, resultLimit).map((r, index) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || r.description || r.snippet || '',
      rank: r.rank ?? index + 1,
      score: r.score ?? r.quality_score ?? null,
      metadata: {
        description: r.description || '',
        quality_score: r.quality_score ?? null,
        signal_scores: r.signal_scores || {},
        source: r.source || '',
        published_at: r.published_at || null,
      },
    })),
    diagnostics: {
      anonymous: !apiKey,
      total_results: metadata.total_results ?? null,
      search_time_ms: metadata.search_time_ms ?? null,
      request_id: metadata.request_id || '',
      cached: metadata.cached ?? null,
    },
  };
}

/**
 * AnySearch Free Provider（无需 API Key）
 * @param {string} query - 搜索查询
 * @param {number} maxResults - 最大结果数量
 * @returns {Promise<Object>} 搜索结果 payload
 */
async function searchAnySearchFree(query, maxResults) {
  return searchAnySearch(query, maxResults, '', ANYSEARCH_FREE_PROVIDER);
}

/**
 * DuckDuckGo 浏览器 Provider
 *
 * 使用隐藏 BrowserWindow 加载 DDG 搜索页，注入 DOM 提取脚本获取结果。
 * 独立 Session partition `persist:search-ddg`，不与任何容器共享。
 *
 * @param {string} query - 搜索查询
 * @param {number} maxResults - 最大结果数量
 * @returns {Promise<Object>} 搜索结果 payload
 */
async function searchDDGBrowser(query, maxResults) {
  const resultLimit = maxResultsForProvider('duckduckgo_browser', maxResults);
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kl=wt-wt`;

  let win = null;
  try {
    // 创建独立 Session partition
    const ses = session.fromPartition('persist:search-ddg');

    win = new BrowserWindow({
      show: false,
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // 设置 User-Agent
    win.webContents.setUserAgent(DDG_USER_AGENT);

    // 加载搜索页
    await win.loadURL(searchUrl);

    // 等待 JavaScript 渲染动态内容
    await new Promise(resolve => setTimeout(resolve, DDG_LOAD_DELAY_MS));

    // 注入 DOM 提取脚本
    const extractScript = buildDDGExtractionScript(resultLimit);
    const result = await win.webContents.executeJavaScript(extractScript);

    if (!result) {
      throw new Error('DDG extraction returned null');
    }

    if (result.blocked) {
      throw new Error(result.reason || 'DDG search page is blocked');
    }

    if (result.status === 'extraction_failed') {
      throw new Error(result.reason || 'DDG search results could not be extracted');
    }

    return {
      query,
      provider: 'duckduckgo_browser',
      source_type: 'browser',
      results: (result.results || []).map((r, idx) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
        rank: r.rank ?? idx + 1,
        score: null,
        metadata: {
          engine: 'duckduckgo',
        },
      })),
      diagnostics: {
        status: result.status || 'ok',
        final_url: result.final_url || '',
      },
    };
  } finally {
    // 无论成功失败都销毁隐藏 BrowserWindow
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  }
}

/**
 * 构建 DDG DOM 提取脚本
 *
 * 从搜索结果页面提取标题、URL 和摘要。
 * 支持多个备选 CSS 选择器以应对 DDG 页面结构变化。
 *
 * @param {number} maxResults - 最大结果数量
 * @returns {string} 可注入的 JavaScript 脚本
 */
function buildDDGExtractionScript(maxResults) {
  return `(() => {
    const maxResults = ${maxResults};

    function textOf(el) {
      return (el && (el.innerText || el.textContent) || '').replace(/\\s+/g, ' ').trim();
    }

    function firstText(root, selectors) {
      for (const selector of selectors) {
        const el = root.querySelector(selector);
        const text = textOf(el);
        if (text) return text;
      }
      return '';
    }

    function firstAnchor(root, selectors) {
      for (const selector of selectors) {
        const el = root.querySelector(selector);
        if (el && el.href) return el;
      }
      return null;
    }

    function cleanUrl(raw) {
      if (!raw) return '';
      let url;
      try {
        url = new URL(raw, location.href);
      } catch {
        return '';
      }

      // 处理 DDG 重定向链接
      if (url.hostname.endsWith('duckduckgo.com') && url.pathname.startsWith('/l/') && url.searchParams.get('uddg')) {
        try { url = new URL(url.searchParams.get('uddg')); } catch {}
      }
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return url.href;
    }

    function hasCaptchaSignals() {
      const bodyText = textOf(document.body).toLowerCase();
      const href = location.href.toLowerCase();
      return (
        href.includes('/sorry/') ||
        href.includes('captcha') ||
        bodyText.includes('unusual traffic') ||
        bodyText.includes('verify you are human') ||
        bodyText.includes('detected unusual traffic')
      );
    }

    function blockedReason() {
      if (hasCaptchaSignals()) return 'Search page requires verification or CAPTCHA.';
      const bodyText = textOf(document.body).toLowerCase();
      if (bodyText.includes('enable javascript')) return 'Search page requires JavaScript.';
      if (bodyText.includes('consent') && bodyText.includes('privacy')) return 'Search page is blocked by a consent interstitial.';
      return '';
    }

    function hasNoResultsSignals() {
      const bodyText = textOf(document.body).toLowerCase();
      return (
        bodyText.includes('no results found') ||
        bodyText.includes('没有结果')
      );
    }

    function duckduckgoResults() {
      const items = Array.from(document.querySelectorAll("article[data-testid='result'], .result, .web-result"));
      return items.map((item, idx) => {
        const anchor = firstAnchor(item, ["a[data-testid='result-title-a']", "a.result__a", "h2 a", "a"]);
        const title = textOf(anchor) || firstText(item, ["h2", ".result__title"]);
        const snippet = firstText(item, ["[data-result='snippet']", ".result__snippet", ".result__body"]);
        const url = cleanUrl(anchor && anchor.href);
        if (!title || !url) return null;
        return { title, url, content: snippet || '', rank: idx + 1 };
      }).filter(Boolean);
    }

    let reason = blockedReason();
    const blocked = !!reason;
    let results = [];
    if (!blocked) {
      results = duckduckgoResults();
    }
    let status = 'ok';
    if (blocked) status = 'blocked';
    else if (results.length === 0 && hasNoResultsSignals()) {
      status = 'no_results';
      reason = 'Search page returned no results.';
    } else if (results.length === 0) {
      status = 'extraction_failed';
      reason = 'Search results could not be extracted from DuckDuckGo page.';
    }

    return {
      title: document.title || '',
      final_url: location.href,
      status,
      blocked,
      captcha: hasCaptchaSignals(),
      reason,
      results: results.slice(0, maxResults).map((item, idx) => ({ ...item, rank: idx + 1 })),
    };
  })()`;
}

// ==================== Auto Fallback ====================

/**
 * Auto Fallback 搜索
 *
 * 遍历链：配置的付费 API → anysearch_free → duckduckgo_browser
 * 每个 Provider 失败后记录原因，继续下一个。
 * 全部失败返回第一个低质量结果（比空结果好）。
 *
 * @param {string} query - 搜索查询
 * @param {number} maxResults - 最大结果数量
 * @param {Object} options - 选项
 * @param {Object} options.apiKeys - API Key 映射
 * @param {SearchRateLimiter} options.rateLimiter - 速率限制器（可选）
 * @returns {Promise<Object>} 搜索结果 payload
 */
async function doAutoSearch(query, maxResults, { apiKeys, rateLimiter }) {
  // Auto Fallback 链顺序：已配置 API Key 的付费 Provider → anysearch_free → duckduckgo_browser
  const configuredApiProviders = ['tavily', 'brave', 'serper', 'anysearch'].filter((p) => !!apiKeys[p]);
  const chain = [...configuredApiProviders, ANYSEARCH_FREE_PROVIDER, 'duckduckgo_browser'];
  const attempts = [];
  let firstLowQualityPayload = null;

  for (const provider of chain) {
    let meta;
    try {
      meta = providerMeta(provider);
    } catch {
      // 未知 Provider，跳过
      continue;
    }
    const attempt = { provider, source_type: meta.sourceType };
    try {
      const payload = await runProviderSearch({
        provider,
        query,
        maxResults,
        apiKey: apiKeys[provider] || '',
        rateLimiter,
      });
      attempt.result_count = payload.results.length;

      if (payload.results.length === 0) {
        attempt.status = 'empty';
        attempts.push(attempt);
        continue;
      }

      if (isLikelyLowQualityResults(query, payload.results)) {
        attempt.status = 'low_quality';
        attempts.push(attempt);
        if (!firstLowQualityPayload) firstLowQualityPayload = payload;
        continue;
      }

      attempt.status = 'ok';
      attempts.push(attempt);
      return attachAutoDiagnostics(payload, attempts);
    } catch (err) {
      attempt.status = 'error';
      attempt.error_type = classifySearchError(err);
      attempt.message = err instanceof Error ? err.message : String(err);
      if (err instanceof SearchRateLimitError && err.retryAfterMs) {
        attempt.retry_after_ms = err.retryAfterMs;
      }
      attempts.push(attempt);
    }
  }

  // 所有 Provider 都返回低质量结果时，兜底返回第一个低质量结果
  if (firstLowQualityPayload) {
    return attachAutoDiagnostics(firstLowQualityPayload, attempts, { selected_status: 'low_quality' });
  }

  // 全部失败
  return {
    query,
    results: [],
    provider: 'auto',
    source_type: 'auto',
    diagnostics: {
      strategy: 'auto',
      attempts,
      status: 'all_failed',
    },
  };
}

/**
 * 执行单个 Provider 搜索
 *
 * @param {Object} options - 搜索选项
 * @param {string} options.provider - Provider ID
 * @param {string} options.query - 搜索查询
 * @param {number} options.maxResults - 最大结果数量
 * @param {string} options.apiKey - API Key
 * @param {SearchRateLimiter} [options.rateLimiter] - 速率限制器
 * @returns {Promise<Object>} 标准化后的搜索结果
 */
async function runProviderSearch({ provider, query, maxResults, apiKey, rateLimiter }) {
  const meta = providerMeta(provider);
  if (meta.requiresApiKey && !apiKey) {
    throw new Error(`搜索 Provider ${provider} 需要 API Key，请在设置中配置`);
  }

  // SSRF 防护：检查 Provider 端点是否解析到私有 IP
  if (meta.endpoint) {
    const hostname = new URL(meta.endpoint).hostname;
    if (await isPrivateHost(hostname)) {
      throw new Error(`搜索 Provider ${provider} 的端点 ${hostname} 解析到私有 IP，请求已阻止`);
    }
  }

  const providerMaxResults = maxResultsForProvider(provider, maxResults);
  const limiter = rateLimiter || _rateLimiter;
  const payload = await limiter.run(provider, meta.sourceType, () => {
    if (meta.requiresApiKey) {
      return meta.search(query, providerMaxResults, apiKey, provider);
    }
    return meta.search(query, providerMaxResults);
  });
  return normalizeProviderPayload(query, provider, meta, payload);
}

// ==================== 模块状态 ====================

/** @type {Object|null} electron-store 配置实例 */
let _configStore = null;

/** @type {SearchRateLimiter} 搜索速率限制器实例 */
let _rateLimiter = new SearchRateLimiter();

// ==================== 初始化 ====================

/**
 * 初始化搜索管理器
 *
 * 从 configStore 读取搜索配置（search.provider、search.apiKeys）。
 * 创建 SearchRateLimiter 实例。
 *
 * @param {Object} configStore - electron-store 配置实例
 */
function initSearchManager(configStore) {
  _configStore = configStore;
  _rateLimiter = new SearchRateLimiter();
  registerProviders();
  console.log('[Realm Search] 搜索管理器已初始化');
}

// ==================== 搜索入口 ====================

/**
 * 搜索入口函数
 *
 * 读取配置 → 判断 Provider → 调用对应搜索函数。
 * - provider 为 'auto' 时走 doAutoSearch
 * - 指定 Provider 时走 runProviderSearch
 *
 * @param {string} query - 搜索查询
 * @param {number} [maxResults=10] - 最大结果数量
 * @returns {Promise<Object>} 搜索结果 payload
 */
async function doSearch(query, maxResults) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('搜索关键词不能为空');
  }

  const trimmedQuery = query.trim();
  const provider = _configStore?.get('search.provider', 'auto') || 'auto';
  const apiKeys = _configStore?.get('search.apiKeys', {}) || {};

  if (provider === 'auto') {
    return doAutoSearch(trimmedQuery, maxResults, { apiKeys, rateLimiter: _rateLimiter });
  }

  // 指定 Provider
  let meta;
  try {
    meta = providerMeta(provider);
  } catch {
    throw new Error(`未知的搜索 Provider: ${provider}`);
  }

  const apiKey = apiKeys[provider] || '';
  if (meta.requiresApiKey && !apiKey) {
    throw new Error(`搜索 Provider ${provider} 需要 API Key，请在设置中配置`);
  }

  try {
    return await runProviderSearch({
      provider,
      query: trimmedQuery,
      maxResults,
      apiKey,
      rateLimiter: _rateLimiter,
    });
  } catch (err) {
    throw new Error(`搜索失败: ${err.message}`);
  }
}

// ==================== web_fetch 内容抓取 ====================

/**
 * 将 HTML 转换为可读的 Markdown 文本
 *
 * 使用 jsdom 构建 DOM 环境，Readability 提取正文，turndown 转换为 Markdown。
 * Readability 返回 null（空/不可读页面）时，回退使用原始 html 的 turndown 转换。
 *
 * @param {string} html - 原始 HTML 字符串
 * @param {string} [url] - 来源 URL（Readability 用于相对链接解析）
 * @returns {string} Markdown 文本
 */
function htmlToMarkdown(html, url) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const contentHtml = article?.content || html;

  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
  });
  // 去除 script/style/nav/footer/aside（Readability 已去噪，turndown 再保险）
  turndown.remove(['script', 'style', 'nav', 'footer', 'aside']);

  return turndown.turndown(contentHtml);
}

/**
 * 抓取指定 URL 的内容并转换为可读文本
 *
 * 流程：URL 校验 → 逐跳 SSRF 防护 + 重定向循环 → Content-Type 判断
 *   → HTML: jsdom + Readability → turndown → Markdown
 *   → JSON: JSON.stringify 美化
 *   → Text: 原样返回
 * → 截断到 maxLength → 追加截断标记
 *
 * @param {string} url - 要抓取的 URL
 * @param {number} [maxLength=FETCH_DEFAULT_MAX_LENGTH] - 最大字符数
 * @returns {Promise<{markdown: string, finalUrl: string, format: string, truncated: boolean}>}
 */
async function fetchUrl(url, maxLength = FETCH_DEFAULT_MAX_LENGTH) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('仅支持 http/https 协议');
  }

  let currentUrl = url;
  let res;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const hopHost = new URL(currentUrl).hostname;
    if (await isPrivateHost(hopHost)) {
      throw new Error(`拒绝访问内网地址: ${hopHost}`);
    }
    res = await net.fetch(currentUrl, {
      headers: {
        'User-Agent': 'RealmBrowser/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
      continue;
    }
    break;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  let text, format;

  if (contentType.includes('application/json')) {
    try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch { text = raw; }
    format = 'json';
  } else if (contentType.includes('text/html')) {
    text = htmlToMarkdown(raw, currentUrl);
    format = 'markdown';
  } else {
    text = raw;
    format = 'text';
  }

  const truncated = text.length > maxLength;
  if (truncated) {
    const originalLength = text.length;
    text = text.slice(0, maxLength)
      + `\n\n[内容已截断，原始长度: ${originalLength} 字符，已显示: ${maxLength} 字符]`;
  }

  return { markdown: text, finalUrl: currentUrl, format, truncated };
}

// ==================== 模块导出 ====================

module.exports = {
  SearchRateLimiter,
  SearchRateLimitError,
  retryAfterMsFromHeaders,
  isPrivateHost,
  doSearch,
  initSearchManager,
  formatSearchResults,
  classifySearchError,
  isLikelyLowQualityResults,
  clampResultsToRange,
  normalizeSearchResult,
  PROVIDERS,
  DEFAULT_POLICIES,
  PRIVATE_IP_RANGES,
  fetchUrl,
  htmlToMarkdown,
};

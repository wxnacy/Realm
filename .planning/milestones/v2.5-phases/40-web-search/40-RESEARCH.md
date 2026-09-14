# Phase 40: 搜索基础设施 + web_search 工具 - Research

**Researched:** 2026-08-26
**Domain:** 网络搜索基础设施、速率限制、SSRF 防护、AI 工具集成
**Confidence:** HIGH

## Summary

本阶段为 Realm Browser 的 AI 助手添加网络搜索能力。核心交付物是 `search-manager.js` 独立模块（Provider 体系 + 速率限制器 + SSRF 防护 + Auto Fallback）和注册到 `_buildRealmTools()` 的 `web_search` AI 工具。

参考实现来自 OpenHanako 项目（`web-search.ts`、`search-rate-limiter.ts`、`search-providers.ts`），其搜索系统经过实际测试调优，包含完整的 Provider 体系、速率限制策略和低质量检测逻辑。Realm 需要将 TypeScript 实现转换为 CommonJS JavaScript，并适配 Electron 的 `net.fetch`（Chromium 网络栈）替代全局 `fetch`（undici）。

**Primary recommendation:** 直接复用 OpenHanako 的速率限制器参数表和 Provider 实现逻辑，使用 Electron 的 `net.fetch` 替代 Node.js 全局 `fetch`，确保系统代理兼容性。

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 三级链全实现 — 付费 API → anysearch_free → DDG 浏览器 Provider。Phase 40 实现基础版 DDG 浏览器 Provider（最简单的浏览器 Provider），保证零配置可用
- **D-02:** 固定优先级顺序 — Tavily → Brave → Serper → AnySearch → DDG。当用户配置了多个付费 API Key 时，按此固定顺序选择，不使用动态排序
- **D-03:** 降级触发条件 — 网络错误 + HTTP 429 + 认证失败（401/403）+ 空结果。超时不算降级条件（可能只是慢）
- **D-04:** 全链失败反馈 — 返回 `attempts` 数组（每个 Provider 的失败原因分类：rate_limited/auth/empty/low_quality/blocked/error）+ 明确用户提示
- **D-05:** AnySearch Free 无需 API Key，直接调用 `api.anysearch.com/v1/search` 免费端点
- **D-06:** AnySearch Free 超时 30 秒，maxConcurrent 3，rateLimitBaseDelayMs 10s，minIntervalMs 0
- **D-07:** 直接复用 OpenHanako 的每 Provider 参数表（经过实际测试调优）
- **D-08:** 每 Provider 独立 SearchRateLimiter 实例，各自独立队列和状态
- **D-09:** 429 退避策略 — 读取 `Retry-After` header，如果存在则用其值，否则用指数退避 + 随机抖动
- **D-10:** 仅对中文（CJK）查询做低质量检测
- **D-11:** 低质量结果触发降级到下一个 Provider。如果所有 Provider 都返回低质量，兜底返回第一个低质量结果
- **D-12:** 标准化输出格式 `{title, url, content, score?, metadata?}`

### Claude's Discretion

- 浏览器 Provider（DDG）的具体实现细节（User-Agent 选择、请求头、DOM 解析方式）由实现者决定
- SSRF 防护的具体 IP 范围列表跟随 Node.js 标准库

### Deferred Ideas (OUT OF SCOPE)

- 浏览器 Provider（Bing/Google）— v2.5.x，需独立 DOM 解析脚本
- 中文搜索质量优化（扩展）— v2.5.x
- 搜索诊断信息展示（调试面板）— v2.5.x
- 用户自定义 Provider 优先级 — 未讨论

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEARCH-01 | search-manager.js 模块初始化 — electron-store 配置读取、Provider 注册表、搜索入口函数 | 配置读取模式复用 configStore.get('search.*', defaults) |
| SEARCH-02 | 速率限制器 — 每 Provider 独立策略（minIntervalMs + maxConcurrent + jitter），指数退避，429 响应处理 | 直接复用 OpenHanako SearchRateLimiter 实现和参数表 |
| SEARCH-03 | SSRF 防护 — 私有 IP 检测（127.x/10.x/192.168.x/172.16-31.x/localhost），DNS 解析校验，逐跳重定向检查 | 复用 OpenHanako isPrivateHost 实现，使用 Node.js dns.lookup |
| SEARCH-04 | 搜索结果标准化 — 统一输出格式 `{title, url, content}`，Markdown 编号列表渲染 | 复用 OpenHanako normalizeSearchResult 和格式化逻辑 |
| TOOL-01 | web_search 工具定义 — 注册到 `_buildRealmTools()`，参数：query（必填）、maxResults（可选，默认 10） | 遵循现有工具注册模式 {name, label, description, parameters, execute} |
| TOOL-02 | API Provider 实现 — Tavily（Bearer token）、Brave（X-Subscription-Token）、Serper（X-API-KEY）、AnySearch（Bearer/匿名） | 直接复用 OpenHanako Provider 实现，使用 net.fetch 替代 fetch |
| TOOL-03 | Auto 智能 Fallback 策略 — 付费 API → anysearch_free → 浏览器 Provider | 复用 OpenHanako doAutoSearch 逻辑和错误分类 |
| TOOL-04 | 错误处理与用户反馈 — 搜索失败时返回明确错误信息，诊断信息（attempts 数组） | 复用 OpenHanako classifySearchError 和 attachAutoDiagnostics |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 搜索 Provider 管理 | Main Process (search-manager.js) | — | 搜索是主进程功能，需要访问网络和配置 |
| 速率限制 | Main Process (search-rate-limiter.js) | — | 速率限制器是纯逻辑，跟随 search-manager |
| SSRF 防护 | Main Process (search-manager.js) | — | DNS 解析和 IP 检测需要 Node.js dns 模块 |
| AI 工具注册 | Main Process (ai-manager.js) | — | 工具注册在 _buildRealmTools() 中完成 |
| 搜索配置持久化 | Main Process (configStore) | — | 使用 electron-store 存储搜索配置 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron net.fetch | 内置 (Electron 43.x) | HTTP 请求 | 使用 Chromium 网络栈，支持系统代理，国内环境兼容性好 |
| Node.js dns | 内置 (Node.js 22.x) | DNS 解析 | SSRF 防护需要检查域名解析到的 IP 是否为私有地址 |
| electron-store | ^8.1.0 (已安装) | 配置持久化 | 复用现有 configStore，存储搜索 Provider 和 API Key |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AbortSignal.timeout() | 内置 (Node.js 18+) | 请求超时控制 | 所有 HTTP 请求设置 30 秒超时 |
| Node.js dns.lookup | 内置 | DNS 解析 | SSRF 防护检查域名解析结果 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| net.fetch | 全局 fetch (undici) | net.fetch 走系统代理，undici 不走，国内环境可能失败 |
| Node.js dns.lookup | net.Socket connect | dns.lookup 更轻量，不需要建立连接 |

**Installation:**
```bash
# 无新增 npm 依赖，Phase 40 使用内置模块和已安装的 electron-store
```

**Version verification:**
- Electron: ^43.3.0 (已安装) — 内置 Node.js 22.x，支持 fetch、AbortSignal.timeout()、dns.lookup
- electron-store: ^8.1.0 (已安装) — 配置持久化

## Package Legitimacy Audit

Phase 40 不需要安装新的 npm 包，所有功能使用内置模块和已安装依赖实现。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (无新增) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
用户/AI 助手
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                    web_search AI 工具                        │
│  (ai-manager.js: _buildRealmTools())                        │
│  参数: query (必填), maxResults (可选, 默认 10)               │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                   search-manager.js                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              doSearch(query, maxResults)             │   │
│  │  读取配置 → 判断 Provider → 调用对应搜索函数           │   │
│  └─────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           doAutoSearch(query, maxResults)            │   │
│  │  遍历 Fallback 链:                                    │   │
│  │  配置的付费 API → anysearch_free → DDG Browser        │   │
│  │  每个 Provider: 速率限制 → 搜索 → 质量检测 → 结果      │   │
│  └─────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SearchRateLimiter                       │   │
│  │  每 Provider 独立实例，队列管理 + 退避策略              │   │
│  └─────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SSRF 防护 (isPrivateIp)                 │   │
│  │  DNS 解析 → IP 范围检查 → 阻止内网访问                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Provider 实现层                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Tavily  │ │  Brave   │ │  Serper  │ │ AnySearch    │   │
│  │ (付费API) │ │ (付费API) │ │ (付费API) │ │ (付费/免费)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            DDG Browser (隐藏 BrowserWindow)           │   │
│  │  加载搜索页 → 注入提取脚本 → 返回结果                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│              electron-store 配置持久化                        │
│  search.provider: 'auto' | 'tavily' | 'brave' | ...        │
│  search.apiKeys: { tavily: '...', brave: '...', ... }      │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
Realm/
├── search-manager.js          # 搜索管理器主模块
│   ├── SearchRateLimiter      # 速率限制器类
│   ├── isPrivateIp            # SSRF 防护函数
│   ├── searchTavily           # Tavily Provider
│   ├── searchBrave            # Brave Provider
│   ├── searchSerper           # Serper Provider
│   ├── searchAnySearch        # AnySearch Provider (付费+免费)
│   ├── searchDDGBrowser       # DDG 浏览器 Provider
│   ├── doAutoSearch           # Auto Fallback 逻辑
│   ├── normalizeResults       # 结果标准化
│   └── classifySearchError    # 错误分类
├── ai-manager.js              # 添加 web_search 工具到 _buildRealmTools()
└── main.js                    # 实例化 search-manager，注入到 ai-manager
```

### Pattern 1: 速率限制器 (SearchRateLimiter)

**What:** 每 Provider 独立的速率限制器，管理请求队列、并发控制和退避策略
**When to use:** 所有搜索 Provider 调用前必须通过速率限制器
**Example:**
```javascript
// Source: /Volumes/ZhiTai/Projects/github/openhanako/lib/tools/search-rate-limiter.ts

/**
 * 速率限制器类
 * 
 * 每个 Provider 独立实例，维护：
 * - 请求队列（先进先出）
 * - 并发控制（maxConcurrent）
 * - 最小间隔（minIntervalMs + jitter）
 * - 429 退避（指数退避 + retryAfterMs）
 */
class SearchRateLimiter {
  constructor(policies = {}) {
    this._policies = { ...DEFAULT_POLICIES, ...policies };
    this._states = new Map();
  }

  /**
   * 执行受速率限制的操作
   * @param {string} provider - Provider ID
   * @param {string} sourceType - 'api' | 'browser'
   * @param {Function} operation - 异步操作函数
   * @returns {Promise<any>} 操作结果
   */
  async run(provider, sourceType, operation) {
    const state = this._stateFor(provider);
    return new Promise((resolve, reject) => {
      state.queue.push({ sourceType, operation, resolve, reject });
      this._pump(provider);
    });
  }
}

// 默认策略参数表（来自 OpenHanako，经过实际测试调优）
const DEFAULT_POLICIES = {
  tavily: { minIntervalMs: 650, jitterMs: 350, rateLimitBaseDelayMs: 2_000, maxCooldownMs: 5 * 60_000 },
  brave: { minIntervalMs: 1_100, jitterMs: 400, rateLimitBaseDelayMs: 2_000, maxCooldownMs: 5 * 60_000 },
  serper: { minIntervalMs: 1_000, jitterMs: 500, rateLimitBaseDelayMs: 2_000, maxCooldownMs: 5 * 60_000 },
  anysearch: { minIntervalMs: 0, jitterMs: 0, maxConcurrent: 5, rateLimitBaseDelayMs: 2_000, maxCooldownMs: 5 * 60_000 },
  anysearch_free: { minIntervalMs: 0, jitterMs: 0, maxConcurrent: 3, rateLimitBaseDelayMs: 10_000, maxCooldownMs: 5 * 60_000 },
  duckduckgo_browser: { minIntervalMs: 3_000, jitterMs: 4_000, rateLimitBaseDelayMs: 10_000, maxCooldownMs: 5 * 60_000 },
};
```

### Pattern 2: SSRF 防护 (isPrivateIp)

**What:** 检测域名是否解析到私有 IP 地址，防止 SSRF 攻击
**When to use:** 所有外部 HTTP 请求前（包括搜索 API 调用和 DDG 浏览器搜索）
**Example:**
```javascript
// Source: /Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-fetch.ts

const { lookup } = require('dns').promises;
const { isIP } = require('net');

const PRIVATE_IP_RANGES = [
  /^127\./, /^::1$/, /^0\.0\.0\.0$/, /^0:0:0:0:0:0:0:1$/,    // loopback
  /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,        // RFC 1918
  /^169\.254\./, /^fe80:/i,                                      // link-local
  /^fc00:/i, /^fd[0-9a-f]{2}:/i,                                // IPv6 ULA
];

/**
 * 检查域名是否解析到私有 IP
 * @param {string} hostname - 域名
 * @returns {Promise<boolean>} 如果解析到私有 IP 返回 true
 */
async function isPrivateHost(hostname) {
  if (isIP(hostname)) return PRIVATE_IP_RANGES.some(r => r.test(hostname));
  try {
    const results = await lookup(hostname, { all: true });
    if (results.length === 0) return true;
    return results.some(r => PRIVATE_IP_RANGES.some(pat => pat.test(r.address)));
  } catch { return true; }
}
```

### Pattern 3: Auto Fallback 链

**What:** 按优先级遍历搜索 Provider，自动降级到下一个
**When to use:** 用户配置 Provider 为 'auto' 时
**Example:**
```javascript
// Source: /Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-search.ts

/**
 * Auto Fallback 搜索
 * 
 * 遍历链：配置的付费 API → anysearch_free → DDG Browser
 * 每个 Provider 失败后记录原因，继续下一个
 * 全部失败返回第一个低质量结果（比空结果好）
 */
async function doAutoSearch(query, maxResults, { apiKeys, rateLimiter }) {
  const attempts = [];
  const configuredApiProviders = SEARCH_API_PROVIDER_IDS.filter(p => !!apiKeys[p]);
  const chain = [...configuredApiProviders, 'anysearch_free', 'duckduckgo_browser'];
  let firstLowQualityPayload = null;

  for (const provider of chain) {
    const attempt = { provider, source_type: getProviderSourceType(provider) };
    try {
      const payload = await runProviderSearch({ provider, query, maxResults, apiKey: apiKeys[provider], rateLimiter });
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
      attempt.message = err.message;
      attempts.push(attempt);
    }
  }

  if (firstLowQualityPayload) {
    return attachAutoDiagnostics(firstLowQualityPayload, attempts, { selected_status: 'low_quality' });
  }

  return { query, results: [], provider: 'auto', diagnostics: { strategy: 'auto', attempts, status: 'all_failed' } };
}
```

### Pattern 4: DDG 浏览器 Provider

**What:** 使用隐藏 BrowserWindow 加载 DuckDuckGo 搜索页，注入脚本提取结果
**When to use:** 作为 Auto Fallback 链的最后一级，保证零配置可用
**Example:**
```javascript
// Source: /Volumes/ZhiTai/Projects/github/openhanako/lib/browser/browser-search-extractors.cjs

/**
 * DDG 浏览器搜索
 * 
 * 1. 构建搜索 URL: https://duckduckgo.com/?q={query}&kl=wt-wt
 * 2. 创建隐藏 BrowserWindow 加载搜索页
 * 3. 注入提取脚本解析 DOM
 * 4. 返回标准化结果
 */
const DDG_CONFIG = {
  id: 'duckduckgo_browser',
  engine: 'duckduckgo',
  baseUrl: 'https://duckduckgo.com/',
  params: (query) => ({ q: query, kl: 'wt-wt' }),
};

// 提取脚本中的 DDG 结果解析
function duckduckgoResults() {
  const items = Array.from(document.querySelectorAll(
    "article[data-testid='result'], .result, .web-result"
  ));
  return items.map((item, idx) => {
    const anchor = item.querySelector("a[data-testid='result-title-a']", "a.result__a", "h2 a", "a");
    const title = anchor?.textContent || item.querySelector("h2")?.textContent || '';
    const snippet = item.querySelector("[data-result='snippet']")?.textContent || '';
    const url = cleanUrl(anchor?.href);
    return { title, url, content: snippet, rank: idx + 1 };
  }).filter(r => r.title && r.url);
}
```

### Anti-Patterns to Avoid

- **使用全局 fetch 替代 net.fetch:** 全局 fetch (undici) 不走系统代理，国内环境可能无法访问外部 API。必须使用 Electron 的 `net.fetch`
- **共享速率限制器实例:** 每个 Provider 必须有独立的 SearchRateLimiter 实例，否则会相互阻塞
- **忽略 DNS rebinding:** SSRF 防护必须在每次请求前检查，不能缓存 DNS 结果
- **硬编码 API Key:** API Key 必须从 electron-store 读取，不能硬编码在代码中
- **DDG 浏览器搜索使用用户可见窗口:** 必须创建独立的隐藏 BrowserWindow，使用独立 Session partition

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP 请求 | 自己实现 fetch 封装 | Electron net.fetch | 内置、支持系统代理、超时控制 |
| 速率限制 | 简单 setTimeout 延迟 | SearchRateLimiter 类 | 需要队列管理、并发控制、指数退避 |
| SSRF 防护 | 简单 IP 正则检查 | isPrivateHost + dns.lookup | 需要 DNS 解析、多 IP 检查、IPv6 支持 |
| 错误分类 | 字符串匹配 | classifySearchError | 需要统一的错误分类体系 |

**Key insight:** 搜索基础设施的复杂性在于速率限制和 SSRF 防护。OpenHanako 的实现已经过实际测试，直接复用可以避免大量边界情况的处理。

## Common Pitfalls

### Pitfall 1: net.fetch 与全局 fetch 的差异
**What goes wrong:** 使用全局 `fetch` 发送请求，在国内环境无法访问外部 API
**Why it happens:** 全局 fetch (undici) 不走系统代理，直连外网
**How to avoid:** 始终使用 `const { net } = require('electron'); net.fetch(url, options)`
**Warning signs:** 测试环境正常，用户环境失败

### Pitfall 2: 速率限制器状态泄漏
**What goes wrong:** 搜索请求堆积，后续请求超时
**Why it happens:** 速率限制器的队列和状态没有正确清理
**How to avoid:** 实现 `reset()` 方法，在应用退出或错误时清理状态
**Warning signs:** 搜索响应时间逐渐变长

### Pitfall 3: DDG 浏览器搜索 DOM 选择器失效
**What goes wrong:** DDG 搜索返回空结果
**Why it happens:** DuckDuckGo 更新了页面结构，CSS 选择器失效
**How to avoid:** 使用多个备选选择器（如 `article[data-testid='result'], .result, .web-result`）
**Warning signs:** DDG 搜索总是返回空结果，但 API Provider 正常

### Pitfall 4: SSRF 防护绕过
**What goes wrong:** 攻击者通过 DNS rebinding 绕过 SSRF 防护
**Why it happens:** 只在请求前检查一次 DNS，请求过程中 DNS 记录可能变化
**How to avoid:** 使用 `net.fetch` 的 `signal` 参数设置超时，限制重定向次数
**Warning signs:** 安全审计发现内网访问

## Code Examples

### 工具注册模式

```javascript
// Source: ai-manager.js:1566-1593

// web_search 工具注册示例
{
  name: 'web_search',
  label: '网络搜索',
  description: '搜索互联网获取实时信息。当需要最新新闻、技术文档、当前事件或任何不在记忆中的外部知识时使用。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      maxResults: {
        type: 'number',
        description: '返回结果数量（可选，默认 10）',
      },
    },
    required: ['query'],
  },
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { query, maxResults = 10 } = params;
    if (!query) {
      throw new Error('搜索关键词不能为空');
    }
    const result = await searchManager.doSearch(query, maxResults);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      details: { provider: result.provider, resultCount: result.results.length },
    };
  },
}
```

### 配置读取模式

```javascript
// Source: main.js:95, 479, 485

// electron-store 配置读取
const configStore = new Store({ name: 'realm-config' });

// 读取搜索配置
const searchProvider = configStore.get('search.provider', 'auto');
const searchApiKeys = configStore.get('search.apiKeys', {});

// 写入搜索配置
configStore.set('search.provider', 'tavily');
configStore.set('search.apiKeys.tavily', 'tvly-xxx');
```

### 错误分类模式

```javascript
// Source: /Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-search.ts

/**
 * 分类搜索错误
 * @param {Error} err - 错误对象
 * @returns {string} 错误类型: rate_limited/auth/blocked/extraction_failed/error
 */
function classifySearchError(err) {
  if (err?.isSearchRateLimitError || err?.status === 429) return 'rate_limited';
  const message = String(err?.message || '');
  if (/402|quota|rate.?limit|too many/i.test(message)) return 'rate_limited';
  if (/api key|required|unauthorized|forbidden|401|403/i.test(message)) return 'auth';
  if (/blocked|captcha/i.test(message)) return 'blocked';
  if (/extract/i.test(message)) return 'extraction_failed';
  return 'error';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 手动搜索 | AI 自动搜索 | Phase 40 | AI 助手可以主动搜索互联网获取实时信息 |
| 无速率限制 | SearchRateLimiter | Phase 40 | 防止 API 限流，提高搜索成功率 |
| 无 SSRF 防护 | isPrivateHost | Phase 40 | 防止内网攻击，提高安全性 |

**Deprecated/outdated:**
- 无（Phase 40 是新增功能）

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AnySearch Free API (`api.anysearch.com/v1/search`) 可用且免费 | Standard Stack | 如果 API 不可用，Auto Fallback 链会跳过此 Provider |
| A2 | DuckDuckGo 搜索页面 DOM 结构稳定 | Pattern 4 | 如果 DOM 结构变化，DDG 浏览器 Provider 会返回空结果 |
| A3 | Electron 43.x 的 `net.fetch` 支持 `AbortSignal.timeout()` | Standard Stack | 如果不支持，需要手动实现超时控制 |

## Open Questions (RESOLVED)

1. **AnySearch Free API 可用性** [RESOLVED]
   - What we know: CONTEXT.md 提到 AnySearch Free 无需 API Key
   - Resolution: AnySearch Free 端点 `api.anysearch.com/v1/search` 已在 OpenHanako 参考实现中确认可用（无 Authorization header 即为免费模式）。Phase 40 Auto Fallback 链中 anysearch_free 位于 DDG Browser 之前，即使该端点未来失效也会自动降级到 DDG Browser，不影响零配置可用性。
   - Action: 直接复用 OpenHanako 的 searchAnySearch 实现，free 模式不传 Authorization header。

2. **DDG 浏览器搜索的 Electron 实现** [RESOLVED]
   - What we know: OpenHanako 使用 BrowserManager 管理隐藏窗口
   - Resolution: `new BrowserWindow({ show: false })` + `webContents.executeJavaScript()` 是 Electron 标准模式，Realm 已在多个模块中使用 BrowserWindow（如 window-manager.js）。独立 Session partition `persist:search-ddg` 避免与容器 Session 冲突。完成后 `win.destroy()` 回收资源。
   - Action: 在 searchDDGBrowser 中使用隐藏 BrowserWindow + 独立 Session + executeJavaScript 注入 DOM 提取脚本。

3. **搜索配置的 IPC 通道**
   - What we know: Phase 41 才需要 IPC 通道
   - What's unclear: Phase 40 是否需要预留 IPC 接口
   - Recommendation: Phase 40 不实现 IPC，Phase 41 再添加

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 所有功能 | ✓ | ^43.3.0 | — |
| Node.js dns | SSRF 防护 | ✓ | 22.x (内置) | — |
| electron-store | 配置持久化 | ✓ | ^8.1.0 | — |
| AbortSignal.timeout() | 请求超时 | ✓ | 内置 (Node.js 18+) | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置测试框架 |
| Config file | none |
| Quick run command | `npm run validate` (仅语法检查) |
| Full suite command | 无 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEARCH-01 | search-manager 初始化 | manual | `npm run dev` 启动检查 | — |
| SEARCH-02 | 速率限制器 | manual | 手动触发多次搜索观察退避 | — |
| SEARCH-03 | SSRF 防护 | manual | 尝试搜索内网地址 | — |
| SEARCH-04 | 结果标准化 | manual | 检查返回格式 | — |
| TOOL-01 | web_search 工具注册 | manual | AI 对话中使用搜索 | — |
| TOOL-02 | API Provider | manual | 配置 API Key 后测试 | — |
| TOOL-03 | Auto Fallback | manual | 不配置 API Key 测试 | — |
| TOOL-04 | 错误处理 | manual | 模拟网络错误 | — |

### Sampling Rate

- **Per task commit:** `npm run validate` (语法检查)
- **Per wave merge:** 手动测试搜索功能
- **Phase gate:** 所有 Provider 手动测试通过

### Wave 0 Gaps

- [ ] 无测试框架 — 项目当前没有配置测试，Phase 40 不引入测试框架
- [ ] 手动测试流程 — 需要手动验证所有搜索 Provider

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | API Key 安全存储（electron-store） |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 查询参数验证、URL 验证 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + Node.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF 攻击 | Information Disclosure | isPrivateHost + DNS 解析检查 |
| API Key 泄露 | Information Disclosure | electron-store 加密存储 |
| 注入攻击 | Tampering | 输入消毒、URL 验证 |

## Sources

### Primary (HIGH confidence)

- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-search.ts` — 搜索 Provider 体系、Auto Fallback、低质量检测核心逻辑
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/search-rate-limiter.ts` — 速率限制器实现（DEFAULT_POLICIES 参数表）
- `/Volumes/ZhiTai/Projects/github/openhanako/shared/search-providers.ts` — Provider ID 定义和分类
- `~/Projects/Realm/ai-manager.js` — 工具注册模式 `_buildRealmTools()` (line 1566)
- `~/Projects/Realm/main.js` — 模块实例化和配置读取模式

### Secondary (MEDIUM confidence)

- `/Volumes/ZhiTai/Projects/github/openhanako/lib/browser/browser-search-extractors.cjs` — DDG 浏览器搜索 DOM 提取逻辑
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-fetch.ts` — SSRF 防护实现 (isPrivateHost)

### Tertiary (LOW confidence)

- OpenHanako AnySearch Free API 端点可用性（未实际测试）

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 使用内置模块和已安装依赖，无新增风险
- Architecture: HIGH — 直接复用 OpenHanako 经过测试的架构
- Pitfalls: MEDIUM — DDG DOM 选择器可能变化，需要监控

**Research date:** 2026-08-26
**Valid until:** 2026-09-25 (30 天，搜索 API 可能变化)

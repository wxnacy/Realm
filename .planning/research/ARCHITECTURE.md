# Architecture Patterns: Realm Browser AI 网络搜索功能

**Domain:** AI Agent 网络搜索工具（Electron 桌面浏览器）
**Researched:** 2026-08-26

## Recommended Architecture

新增一个独立的 `search-manager.js` 模块，管理搜索 Provider 体系、速率限制器和 Auto Fallback 逻辑。`web_search` 和 `web_fetch` 工具定义在 `ai-manager.js` 的 `_buildRealmTools()` 中，委托 `search-manager` 执行实际搜索。

```
┌──────────────────────────────────────────────────────────────────┐
│                    ai-manager.js                                  │
│  _buildRealmTools()                                               │
│  ├── web_search 工具 ──delegates──> search-manager.search()      │
│  └── web_fetch 工具 ──delegates──> search-manager.fetchUrl()     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    search-manager.js                               │
│  ├── SearchRateLimiter（速率限制器）                               │
│  ├── Provider 执行器                                              │
│  │   ├── searchWithTavily()                                       │
│  │   ├── searchWithBrave()                                        │
│  │   ├── searchWithSerper()                                       │
│  │   ├── searchWithAnySearch()                                    │
│  │   └── searchWithBrowser() ──uses──> BrowserWindow              │
│  ├── Auto Fallback：doAutoSearch()                                │
│  ├── 结果标准化：normalizeResults()                               │
│  └── SSRF 防护：isPrivateIp() / safeFetch()                      │
└──────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `search-manager.js` | 搜索 Provider 体系、速率限制、Auto Fallback、SSRF 防护 | ai-manager.js（工具调用） |
| `ai-manager.js` web_search 工具 | 工具定义、参数校验、结果格式化 | search-manager.js |
| `ai-manager.js` web_fetch 工具 | URL 抓取、HTML 转 Markdown | search-manager.js（SSRF 防护） |
| 设置页搜索配置 UI | Provider 选择、API Key 管理 | ipc-handlers.js -> search-manager.js |
| `browser-search-extractors.js` | 浏览器 Provider 的 DOM 解析脚本 | search-manager.js（注入到 BrowserWindow） |

### Data Flow

```
用户："最近的 AI 新闻是什么？"
    │
    ▼
AI Manager → agent.prompt()
    │
    ▼
LLM 决定调用 web_search 工具
    │
    ▼
web_search.execute({ query: "最新 AI 新闻", maxResults: 10 })
    │
    ▼
search-manager.search(query, maxResults, provider="auto")
    │
    ├── Auto Fallback 链：
    │   1. 尝试 Tavily (API Key 已配置?)
    │   2. 失败 → 尝试 AnySearch Free
    │   3. 失败 → 尝试浏览器 Provider (Bing)
    │
    ▼
返回标准化结果 [{title, url, content}, ...]
    │
    ▼
格式化为 Markdown 编号列表
    │
    ▼
AI 基于搜索结果生成回答
```

## Patterns to Follow

### Pattern 1: 工具工厂函数模式

**What:** 使用工厂函数创建工具实例，注入配置和依赖
**When:** 需要运行时配置的工具（如搜索 Provider 选择）
**Example:**
```javascript
// search-manager.js
function createWebSearchTool(config) {
  return {
    name: 'web_search',
    label: '网络搜索',
    description: '搜索互联网获取实时信息...',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        maxResults: { type: 'number', description: '返回结果数量', default: 10 },
      },
      required: ['query'],
    },
    execute: async (toolCallId, params) => {
      const results = await search(params.query, params.maxResults, config);
      return { content: [{ type: 'text', text: formatResults(results) }] };
    },
  };
}
```

### Pattern 2: 速率限制器（每 Provider 独立策略）

**What:** 基于队列的速率限制器，每 Provider 独立的间隔/并发/退避策略
**When:** 调用外部 API 需要控制频率
**Example:**
```javascript
// search-rate-limiter.js
class SearchRateLimiter {
  constructor() {
    this.cooldowns = new Map();    // provider → cooldownUntil
    this.activeCounts = new Map(); // provider → activeCount
    this.lastRequestTime = new Map();
  }

  async acquire(provider) {
    const policy = PROVIDER_POLICIES[provider];
    // 检查冷却期
    if (this.isInCooldown(provider)) throw new RateLimitError(provider);
    // 检查并发数
    if (this.getActiveCount(provider) >= policy.maxConcurrent) await this.enqueue(provider);
    // 检查最小间隔
    const elapsed = Date.now() - (this.lastRequestTime.get(provider) || 0);
    if (elapsed < policy.minIntervalMs) {
      await sleep(policy.minIntervalMs - elapsed + Math.random() * policy.jitterMs);
    }
    this.incrementActiveCount(provider);
  }

  release(provider) {
    this.decrementActiveCount(provider);
    this.processQueue(provider);
  }

  reportRateLimit(provider, retryAfterMs) {
    // 指数退避：baseDelay * 2^failures + jitter
    const failures = this.getFailureCount(provider);
    const delay = retryAfterMs || Math.min(
      policy.rateLimitBaseDelayMs * Math.pow(2, failures),
      policy.maxCooldownMs
    );
    this.setCooldown(provider, delay);
  }
}
```

### Pattern 3: SSRF 防护（内网 IP 检测 + 重定向校验）

**What:** 防止 web_fetch 工具被利用访问内网资源
**When:** 任何接受用户输入 URL 的场景
**Example:**
```javascript
// search-manager.js
function isPrivateIp(hostname) {
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
  if (blocked.includes(hostname)) return true;
  // 私有 IP 范围
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return true;
  // 云元数据
  if (hostname === '169.254.169.254') return true;
  return false;
}

async function safeFetch(url, options = {}) {
  const parsed = new URL(url);
  // 仅允许 http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('仅支持 http/https 协议');
  }
  // 检查主机名
  if (isPrivateIp(parsed.hostname)) {
    throw new Error('禁止访问内网地址');
  }
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  // 重定向后再次检查
  if (response.redirected && isPrivateIp(new URL(response.url).hostname)) {
    throw new Error('重定向到内网地址被拦截');
  }
  return response;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: 在工具 execute 函数中实现所有 Provider 逻辑

**What:** 把 Tavily/Brave/Serper 的调用代码全部写在 web_search 工具的 execute 函数中
**Why bad:** execute 函数会膨胀到 500+ 行，难以维护和测试
**Instead:** 提取到独立的 `search-manager.js` 模块，工具只负责参数校验和结果格式化

### Anti-Pattern 2: 浏览器 Provider 复用用户可见的标签页

**What:** 在用户当前标签页中打开搜索引擎进行搜索
**Why bad:** 破坏用户正在浏览的页面；搜索完成后无法恢复原页面
**Instead:** 使用隐藏的 BrowserWindow（不显示给用户），搜索完成后销毁

### Anti-Pattern 3: 硬编码 API Key 到源代码

**What:** 在 search-manager.js 中写入默认的 Tavily/Brave API Key
**Why bad:** API Key 泄露；无法按用户计费；违反 API 使用条款
**Instead:** 所有 API Key 通过 electron-store 的 `search.apiKeys` 配置，或环境变量

## Scalability Considerations

| Concern | At 10 searches/day | At 100 searches/day | At 1000 searches/day |
|---------|---------------------|---------------------|----------------------|
| API 成本 | 免费额度足够 | 需要付费 Plan | 需要多 Provider 轮换 |
| 速率限制 | 不会触发 | 可能触发，退避策略处理 | 必须有速率限制器 |
| 浏览器 Provider | 不需要 | 可作为兜底 | 高频使用需注意 CAPTCHA |

## Sources

- HanaAgent 参考实现中的架构模式
- Realm Browser 现有模块架构（ai-manager.js、cdp-manager.js）

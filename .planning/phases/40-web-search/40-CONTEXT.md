# Phase 40: 搜索基础设施 + web_search 工具 - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

为 AI 助手添加网络搜索能力。本阶段交付：
1. **search-manager.js** 独立模块 — 搜索 Provider 体系（Tavily/Brave/Serper/AnySearch/DDG Browser）、速率限制器（SearchRateLimiter）、SSRF 防护（isPrivateIp）、Auto 智能 Fallback（doAutoSearch）、结果标准化（normalizeResults）
2. **web_search AI 工具** — 注册到 `_buildRealmTools()`，参数：query（必填）、maxResults（可选），委托 search-manager 执行

不包含：web_fetch 工具、搜索配置 UI（Phase 41）、浏览器 Provider DOM 解析脚本（v2.5.x 延后）

</domain>

<decisions>
## Implementation Decisions

### Auto Fallback 链策略
- **D-01:** 三级链全实现 — 付费 API → anysearch_free → DDG 浏览器 Provider。Phase 40 实现基础版 DDG 浏览器 Provider（最简单的浏览器 Provider），保证零配置可用
- **D-02:** 固定优先级顺序 — Tavily → Brave → Serper → AnySearch → DDG。当用户配置了多个付费 API Key 时，按此固定顺序选择，不使用动态排序
- **D-03:** 降级触发条件 — 网络错误 + HTTP 429 + 认证失败（401/403）+ 空结果。超时不算降级条件（可能只是慢）
- **D-04:** 全链失败反馈 — 返回 `attempts` 数组（每个 Provider 的失败原因分类：rate_limited/auth/empty/low_quality/blocked/error）+ 明确用户提示（如"所有搜索 Provider 均不可用，请检查网络或配置 API Key"）

### AnySearch 免费兜底
- **D-05:** AnySearch Free 无需 API Key，直接调用 `api.anysearch.com/v1/search` 免费端点。与付费版同一 URL，区别仅在有无 `Authorization: Bearer {key}` header
- **D-06:** AnySearch Free 超时 30 秒（跟随 OpenHanako），maxConcurrent 3，rateLimitBaseDelayMs 10s，minIntervalMs 0

### 速率限制器
- **D-07:** 直接复用 OpenHanako 的每 Provider 参数表（经过实际测试调优）：
  | Provider | minIntervalMs | jitterMs | maxConcurrent | rateLimitBaseDelayMs | maxCooldownMs |
  |----------|--------------|----------|---------------|---------------------|--------------|
  | Tavily | 650 | 350 | — | 2s | 5min |
  | Brave | 1100 | 400 | — | 2s | 5min |
  | Serper | 1000 | 500 | — | 2s | 5min |
  | AnySearch | 0 | 0 | 5 | 2s | 5min |
  | AnySearch Free | 0 | 0 | 3 | 10s | 5min |
  | DDG Browser | 3000 | 4000 | — | 10s | 5min |
- **D-08:** 每 Provider 独立 SearchRateLimiter 实例，各自独立队列和状态
- **D-09:** 429 退避策略 — 读取 `Retry-After` header，如果存在则用其值，否则用 `rateLimitBaseDelayMs * 2^attempt` 指数退避 + retryJitterMs 随机抖动

### 搜索结果质量
- **D-10:** 仅对中文（CJK）查询做低质量检测（跟随 OpenHanako `isLikelyLowQualityResults`）。检测逻辑：查询含 ≥3 个中文词 + 前 3 结果大量是字典/百科类（汉典、字典、百度百科等）+ 查询词匹配度 ≤1
- **D-11:** 低质量结果触发降级到下一个 Provider。如果所有 Provider 都返回低质量，兜底返回第一个低质量结果（比空结果好）
- **D-12:** 标准化输出格式 `{title, url, content, score?, metadata?}`。score 和 metadata 可选，不同 Provider 可能没有

### Claude's Discretion
- 浏览器 Provider（DDG）的具体实现细节（User-Agent 选择、请求头、DOM 解析方式）由实现者决定
- SSRF 防护的具体 IP 范围列表跟随 Node.js 标准库

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenHanako 参考实现
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-search.ts` — 搜索 Provider 体系、Auto Fallback、低质量检测核心逻辑
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/search-rate-limiter.ts` — 速率限制器实现（DEFAULT_POLICIES 参数表）
- `/Volumes/ZhiTai/Projects/github/openhanako/shared/search-providers.ts` — Provider ID 定义和分类

### 需求文档
- `.planning/REQUIREMENTS.md` §SEARCH-01 ~ SEARCH-04, TOOL-01 ~ TOOL-04 — Phase 40 锁定需求
- `.planning/ROADMAP.md` §Phase 40 — 成功标准和阶段边界

### 现有代码
- `ai-manager.js` §`_buildRealmTools()` (line 1566) — 工具注册模式，web_search 需要遵循此模式
- `ai-manager.js` §工具 execute 签名 — `(toolCallId, params, signal?, onUpdate?)` 返回 `{content, details}`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ai-manager.js _buildRealmTools()`** — 现有 12 个工具的注册模式（name/label/description/parameters/execute），web_search 遵循同一结构
- **`electron-store`** — 已用于容器配置持久化（`realm-config.json`），复用存储搜索配置（`search.provider`、`search.apiKeys`）
- **Node.js 内置 `fetch`** — Electron 32 内置，无需额外依赖，用于 API Provider 的 HTTP 请求
- **`AbortSignal.timeout()`** — Node.js 18+ 内置，用于请求超时控制

### Established Patterns
- **工具返回格式** — `{content: [{type: 'text', text: JSON.stringify(...)}], details: {...}}`
- **错误处理** — 工具内 `throw new Error('xxx')`，pi-agent-core SDK 捕获并返回给 AI
- **模块导入** — `main.js` 中实例化 manager 并注入依赖（如 `aiManager` 注入 `tabManager`、`windowManager`）

### Integration Points
- **`ai-manager.js`** — web_search 工具定义在此文件的 `_buildRealmTools()` 中，execute 委托给 search-manager
- **`main.js`** — search-manager.js 实例化和初始化，注入到 ai-manager
- **`ipc-handlers.js`** — Phase 41 才需要 IPC 通道，Phase 40 不涉及

</code_context>

<specifics>
## Specific Ideas

- 浏览器 Provider（DDG）在 Phase 40 实现基础版，仅 DuckDuckGo（最简单），使用隐藏 BrowserWindow + 独立 Session partition
- AnySearch Free 和 AnySearch 付费使用同一 API 端点，区别仅在 Authorization header
- 搜索结果不缓存（时效性强），不持久化到 SQLite（临时数据）
- 唯一新增 npm 依赖：无（Phase 40 不需要 turndown，那是 Phase 41 的 web_fetch 需要）

</specifics>

<deferred>
## Deferred Ideas

- **浏览器 Provider（Bing/Google）** — v2.5.x，需独立 DOM 解析脚本，复杂度高
- **中文搜索质量优化（扩展）** — v2.5.x，当前仅做基础字典/百科检测
- **搜索诊断信息展示（调试面板）** — v2.5.x
- **用户自定义 Provider 优先级** — 未讨论，当前使用固定顺序

</deferred>

---

*Phase: 40-搜索基础设施 + web_search 工具*
*Context gathered: 2026-08-26*

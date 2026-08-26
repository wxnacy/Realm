# Technology Stack: Realm Browser AI 网络搜索功能

**Project:** Realm Browser AI 网络搜索功能
**Researched:** 2026-08-26

## Recommended Stack

### Core Framework（无需新增）

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | 32.x | 桌面应用框架 | 现有，不可更改 |
| Node.js | 20.18.x | 主进程运行时 | Electron 32 内置 |
| pi-agent-core | 现有版本 | AI Agent 框架 | 现有，工具注册框架直接复用 |
| Node.js fetch | 内置 | HTTP 请求 | Electron 32 内置，无需 axios/node-fetch |

### 新增依赖

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **turndown** | ^7.x | HTML -> Markdown 转换 | web_fetch 工具需要将 HTML 页面转为 AI 可读的 Markdown；turndown 是最成熟的 HTML-to-Markdown 库（12k+ stars），支持自定义规则，包体积小（~30KB） |

### 搜索 Provider（外部 API，无 npm 依赖）

| Provider | Type | Purpose | Why |
|----------|------|---------|-----|
| **Tavily** | API 付费 | AI 优化搜索 | 返回结构化结果 + 摘要，专为 LLM 设计；REST API 简单 |
| **Brave Search** | API 付费 | 独立索引搜索 | 隐私友好、独立索引、价格合理 |
| **Serper** | API 付费 | Google SERP 代理 | 速度快、返回 Google 搜索结果 |
| **AnySearch** | API 免费 | 零配置搜索 | 免费匿名调用，无需 API Key |

### Infrastructure（无需新增）

| Technology | Purpose | Why |
|------------|---------|-----|
| electron-store | 搜索配置持久化 | 现有，存储搜索 Provider 配置和 API Key |
| SQLite (better-sqlite3) | 无需新增表 | 搜索结果不持久化（临时数据） |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| HTTP 请求 | Node.js 内置 fetch | axios | 不需要额外依赖，fetch 已满足需求 |
| HTML 转 Markdown | turndown | node-html-markdown | turndown 社区更大、维护更活跃 |
| HTML 转 Markdown | turndown | 自实现正则替换 | HTML 结构复杂，正则方案维护成本极高 |
| 搜索结果缓存 | 不缓存 | LRU 缓存 | 搜索结果时效性强，缓存失效策略复杂 |
| 浏览器自动化 | Electron BrowserWindow | Puppeteer/Playwright | 不需要额外依赖，Electron 原生支持 |

## Installation

```bash
# 新增依赖
npm install turndown

# 无需新增 devDependencies
```

## Sources

- HanaAgent 参考实现中的 Provider API 端点和认证方式
- turndown npm 包：https://www.npmjs.com/package/turndown
- Node.js fetch 文档：https://nodejs.org/api/globals.html#fetch

# Project Research Summary

**Project:** Realm Browser AI 网络搜索功能
**Domain:** AI Agent 网络搜索工具（Electron 桌面浏览器）
**Researched:** 2026-08-26
**Confidence:** HIGH

## Executive Summary

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，已集成 AI Agent 能力（基于 pi-agent-core SDK，当前 12 个工具）。本次研究的目标是为其新增 `web_search` 和 `web_fetch` 两个 AI 工具，让 AI 能够搜索互联网并抓取网页内容。研究发现，HanaAgent 项目有一套成熟的搜索 Provider 体系可直接参考，包含 8 个 Provider（4 个 API + 1 个免费 + 3 个浏览器）、Auto 智能 Fallback 链和速率限制器。

推荐方案是新增独立的 `search-manager.js` 模块，负责搜索 Provider 体系、速率限制和 Auto Fallback 逻辑。`web_search` 和 `web_fetch` 工具定义在 `ai-manager.js` 的 `_buildRealmTools()` 中，委托 search-manager 执行。新增唯一 npm 依赖是 `turndown`（HTML 转 Markdown）。整个方案复用现有 Electron 基础设施（BrowserWindow、Session、electron-store），无需引入外部框架。

主要风险集中在三个方面：浏览器 Provider 的 CAPTCHA 触发（搜索引擎反爬）、Electron 主进程的 SSRF 风险（web_fetch 可被利用访问内网）、以及浏览器 Provider 需要隐藏 BrowserWindow 隔离搜索（避免干扰用户操作）。这三项均有明确的预防方案，关键是在实现时严格遵循 SSRF 防护模式和 Session 隔离模式。

## Key Findings

### Recommended Stack

技术栈极度精简，几乎完全复用现有基础设施。Electron 32.x、Node.js 20.18.x、pi-agent-core SDK、Node.js 内置 fetch 均为现有组件。唯一新增 npm 依赖是 `turndown`（HTML 转 Markdown，~30KB，12k+ stars）。搜索 Provider 为外部 API（Tavily、Brave、Serper、AnySearch），无 npm 依赖。不引入 Puppeteer/Playwright，浏览器 Provider 直接使用 Electron 的 BrowserWindow。不引入 axios，Node.js 内置 fetch 已满足需求。搜索结果不缓存（时效性强，缓存失效策略复杂），不持久化到 SQLite（临时数据）。

**Core technologies:**
- **Electron 32.x**: 桌面应用框架 -- 现有，不可更改，内置 BrowserWindow 可用于浏览器 Provider
- **pi-agent-core SDK**: AI Agent 框架 -- 现有，`_buildRealmTools()` 工具注册机制直接复用
- **Node.js fetch**: HTTP 请求 -- Electron 32 内置，无需额外依赖
- **turndown**: HTML 转 Markdown -- web_fetch 工具需要将 HTML 转为 AI 可读格式
- **electron-store**: 配置持久化 -- 现有，存储搜索 Provider 配置和 API Key

### Expected Features

**Must have (table stakes):**
- **web_search 工具（API Provider）** -- AI 助手核心能力，用户期望能搜索实时信息
- **web_fetch 工具** -- 搜索结果需要抓取全文，含 SSRF 防护
- **至少一个搜索 Provider** -- 无 Provider 则工具无法工作（最低可用：anysearch_free，免费无 Key）
- **搜索结果标准化格式** -- AI 模型需要统一结构理解结果，`{title, url, content}` 三字段
- **错误处理与用户反馈** -- 搜索失败时 AI 需要明确错误信息

**Should have (competitive):**
- **Auto 智能 Fallback** -- 零配置即可用，三级链：付费 API -> 免费 API -> 浏览器
- **速率限制器** -- 防止 API 被封，每 Provider 独立策略：minIntervalMs + maxConcurrent + 指数退避
- **搜索配置 UI** -- 设置页面集成，管理 API Key 和 Provider 选择

**Defer (v2.5.x):**
- **浏览器 Provider（Bing/Google/DDG）** -- 无 API Key 时的高级兜底，需独立 DOM 解析脚本，复杂度高
- **中文搜索质量优化** -- 低质量检测 + 字典/百科过滤
- **搜索诊断信息展示** -- 调试面板

**Defer (v2.6+):**
- **搜索结果高亮** -- 在 AI 回复中标注信息来源
- **搜索历史建议** -- 基于用户搜索历史提供自动补全

### Architecture Approach

新增独立的 `search-manager.js` 模块，与现有 `ai-manager.js` 解耦。工具定义在 `ai-manager.js` 的 `_buildRealmTools()` 中，执行委托给 search-manager。search-manager 内部包含 SearchRateLimiter（速率限制器）、Provider 执行器（Tavily/Brave/Serper/AnySearch/Browser）、Auto Fallback 逻辑（`doAutoSearch()`）、结果标准化（`normalizeResults()`）和 SSRF 防护（`isPrivateIp()` / `safeFetch()`）。浏览器 Provider 使用隐藏 BrowserWindow（`show: false`）+ 独立 Session partition（`persist:search-provider`），搜索完成后销毁。所有 Provider 返回统一的 `{title, url, content}` 格式。

**Major components:**
1. **search-manager.js** -- 搜索 Provider 体系、速率限制、Auto Fallback、SSRF 防护（核心新模块）
2. **ai-manager.js web_search 工具** -- 工具定义、参数校验、结果格式化（在现有文件中新增）
3. **ai-manager.js web_fetch 工具** -- URL 抓取、HTML 转 Markdown、SSRF 防护（在现有文件中新增）
4. **browser-search-extractors.js** -- 浏览器 Provider 的 DOM 解析脚本（v2.5.x 延后）
5. **设置页搜索配置 UI** -- Provider 选择、API Key 管理（在现有 settings 页面中扩展）

### Critical Pitfalls

1. **浏览器 Provider CAPTCHA 触发** -- Google/Bing 检测自动化搜索返回 CAPTCHA。预防：浏览器 Provider 仅作最后兜底，实现 CAPTCHA 检测（检查页面文本中的关键词），检测到立即 fallback
2. **Electron 主进程 SSRF 风险** -- web_fetch 可被利用访问 localhost、192.168.x.x 等内网地址。预防：`isPrivateIp()` 检测所有私有 IP 范围 + localhost + 云元数据地址，重定向后再次检查，仅允许 http/https 协议
3. **浏览器 Provider BrowserWindow 隔离** -- 复用用户可见窗口会干扰用户操作。预防：使用隐藏 BrowserWindow（`show: false`）+ 独立 Session partition，搜索完成后销毁
4. **搜索 API 免费额度耗尽** -- AnySearch Free 或 Tavily/Brave 免费额度用完。预防：Auto Fallback 链自动切换 + 速率限制器控制调用频率
5. **搜索结果格式不一致** -- 不同 Provider 字段名不同（content/snippet/description）。预防：结果标准化层统一输出 `{title, url, content}`

## Implications for Roadmap

基于研究，建议分为 3 个阶段实现：

### Phase 1: 搜索基础设施（search-manager.js + 速率限制器）

**Rationale:** 搜索 Provider 体系是 web_search 和 web_fetch 的基础，必须先建好。速率限制器是防止 API 被封的关键组件，需要与 Provider 一起实现。
**Delivers:** search-manager.js 模块（含 SearchRateLimiter、Provider 执行器、结果标准化、SSRF 防护）
**Addresses:** 搜索结果标准化格式、速率限制器、SSRF 防护
**Avoids:** 搜索 API 免费额度耗尽（速率限制器）、SSRF 风险（isPrivateIp + safeFetch）
**Uses:** Node.js fetch、electron-store（搜索配置）

### Phase 2: web_search + web_fetch 工具集成

**Rationale:** 有了 search-manager 基础设施后，工具定义和集成相对简单。两个工具可同时实现，因为它们共享 search-manager 的 SSRF 防护和 fetch 基础设施。
**Delivers:** `_buildRealmTools()` 中新增 web_search 和 web_fetch 工具、系统提示词更新、turndown 依赖安装
**Addresses:** web_search 工具（API Provider）、web_fetch 工具、Auto 智能 Fallback、错误处理与用户反馈
**Uses:** pi-agent-core SDK 工具注册、turndown（HTML 转 Markdown）
**Implements:** ai-manager.js web_search/web_fetch 工具定义

### Phase 3: 搜索配置 UI + 设置页集成

**Rationale:** 核心功能就绪后，用户需要配置搜索 Provider 和 API Key。这是用户体验层，不影响核心功能（Auto Fallback 的 anysearch_free 免费无 Key）。
**Delivers:** 设置页搜索配置子区域（Provider 选择 + API Key 管理）、IPC 通道、preload 暴露
**Addresses:** 多 Provider API Key 管理、搜索配置 UI
**Uses:** electron-store（search.apiKeys 配置）

### Phase Ordering Rationale

- **Phase 1 必须最先**：search-manager 是所有搜索功能的基础，Provider 体系、速率限制器、SSRF 防护都在此模块中
- **Phase 2 紧随其后**：有了 search-manager，工具集成是机械性工作（在 `_buildRealmTools()` 中添加工具定义）
- **Phase 3 最后**：配置 UI 是体验层，Auto Fallback 的 anysearch_free 免费无 Key 可以零配置工作
- **浏览器 Provider 延后**：复杂度高（DOM 解析脚本、CAPTCHA 检测、多种布局变体），且 API Provider + anysearch_free 已覆盖主要场景
- **SSRF 防护贯穿 Phase 1-2**：在 Phase 1 实现 `isPrivateIp()` + `safeFetch()`，Phase 2 的 web_fetch 直接复用

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** web_fetch 的 DNS rebinding 绕过 SSRF 防护需要额外验证；turndown 的 XSS 风险需要与现有 DOMPurify 集成方案确认

Phases with standard patterns (skip research-phase):
- **Phase 1:** Provider API 调用模式清晰（HanaAgent 参考实现），速率限制器是标准模式
- **Phase 3:** 设置页 UI 扩展是现有模式（参考 AI Provider 配置）

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 技术栈几乎完全复用现有基础设施，唯一新增依赖 turndown 成熟可靠 |
| Features | HIGH | 基于 HanaAgent 参考实现 + 现有代码库分析，功能边界清晰 |
| Architecture | HIGH | 模块边界明确（search-manager 独立模块），复用现有 ai-manager 工具注册模式 |
| Pitfalls | HIGH | SSRF 防护和 CAPTCHA 检测有成熟的预防方案，HanaAgent 已验证 |

**Overall confidence:** HIGH

### Gaps to Address

- **DNS rebinding 绕过 SSRF 防护**：Electron 环境中需要额外的 DNS 查询来解析真实 IP，HanaAgent 参考实现未覆盖此场景。建议在 Phase 2 实现时先做基础 SSRF 防护，后续迭代加强
- **AnySearch API 可用性验证**：研究提到 AnySearch 是免费无 Key 的 Provider，但未验证其当前可用性和稳定性。建议在 Phase 1 实现时先集成 Tavily（最可靠），AnySearch 作为 fallback
- **搜索结果 token 开销**：搜索结果以 Markdown 文本返回给 AI，可能占用大量 context window。需要在 Phase 2 实现时评估 maxResults 默认值和结果截断策略

## Sources

### Primary (HIGH confidence)
- HanaAgent 参考实现：`/Volumes/ZhiTai/Projects/github/openhanako/.docs/web-search-implementation.md` -- Provider API 端点、认证方式、Auto Fallback 链、速率限制器、SSRF 防护
- Realm Browser 现有代码：`/Users/wxnacy/Projects/Realm/ai-manager.js` -- 工具注册模式（`_buildRealmTools()`）、12 个现有工具
- Electron Security Docs -- BrowserWindow 隔离、Session partition

### Secondary (MEDIUM confidence)
- turndown npm 包：https://www.npmjs.com/package/turndown -- HTML 转 Markdown，12k+ stars
- OWASP SSRF Prevention Cheat Sheet -- 私有 IP 范围、云元数据地址

### Tertiary (LOW confidence)
- AnySearch API 可用性 -- 免费无 Key 搜索 Provider，未验证当前稳定性
- DNS rebinding 在 Electron 环境中的防护方案 -- 需要额外验证

---
*Research completed: 2026-08-26*
*Ready for roadmap: yes*

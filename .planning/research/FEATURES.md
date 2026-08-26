# Feature Research: Realm Browser AI 网络搜索功能

**Domain:** AI Agent 网络搜索工具（Electron 桌面浏览器）
**Researched:** 2026-08-26
**Confidence:** HIGH（基于 HanaAgent 参考实现 + 现有代码库分析）

## Feature Landscape

### Table Stakes (Users Expect These)

用户认为理所当然存在的功能。缺失 = 产品不完整。

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **web_search 工具** | AI 助手核心能力，用户期望能搜索实时信息 | MEDIUM | 参考 HanaAgent 的 `createWebSearchTool()` 工厂函数模式；需注册到 `_buildRealmTools()` |
| **web_fetch 工具** | 搜索结果需要抓取全文；现有 `read_page_content` 只能读当前标签页 | MEDIUM | 独立于 web_search，可抓取任意 URL；需 SSRF 防护 |
| **至少一个搜索 Provider** | 无 Provider 则工具无法工作 | LOW | 最低可用：anysearch_free（免费无 Key）或浏览器 Provider（零配置） |
| **搜索结果标准化格式** | AI 模型需要统一结构理解结果 | LOW | `{title, url, content}` 三字段标准化，所有 Provider 统一输出 |
| **错误处理与用户反馈** | 搜索失败时 AI 需要明确错误信息 | LOW | 复用现有 `ai:events-batch` 错误广播机制 |

### Differentiators (Competitive Advantage)

设置产品 apart 的功能。不是必需但有价值。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Auto 智能 Fallback** | 零配置即可用，用户不需手动选择 Provider | HIGH | 参考 HanaAgent 的 `doAutoSearch()` 三级 fallback 链：付费 API -> 免费 API -> 浏览器 |
| **浏览器 Provider（Bing/Google/DDG）** | 无 API Key 时的兜底方案，零成本 | HIGH | 需要 DOM 解析脚本、CAPTCHA 检测、URL 重定向清理；可复用 Electron BrowserWindow |
| **中文搜索质量优化** | 中国市场核心需求，避免字典/百科类垃圾结果 | MEDIUM | HanaAgent 的 `isLikelyLowQualityResults()` 检测逻辑：CJK 字符计数 + 字典关键词匹配 + 命中率计算 |
| **速率限制器** | 防止 API 被封，保护免费额度 | MEDIUM | 每 Provider 独立策略：minIntervalMs + maxConcurrent + 指数退避 + Retry-After 解析 |
| **搜索诊断信息** | 调试透明度，便于用户排查搜索失败 | LOW | 返回 `diagnostics.attempts` 数组，记录每个 attempt 的状态/耗时/错误类型 |
| **多 Provider API Key 管理** | 用户可配置多家搜索服务，互为备份 | LOW | 复用现有 `ai.providers` 配置模式，新增 `search.apiKeys` 节 |

### Anti-Features (Commonly Requested, Often Problematic)

看似好但实际有问题的功能。

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **实时搜索结果流式返回** | "像 Perplexity 一样边搜边显示" | 搜索 API 本身不支持流式；浏览器 Provider 需要等待页面加载；增加大量复杂度 | 一次性返回完整结果，格式化为 Markdown 编号列表（HanaAgent 方案） |
| **搜索结果缓存** | "避免重复搜索浪费额度" | 缓存失效策略复杂（搜索结果时效性强）；增加存储和一致性问题 | 不缓存，依赖速率限制器控制调用频率 |
| **自定义搜索引擎添加** | "我想用百度/搜狗" | 每个搜索引擎 DOM 结构不同，维护成本极高；中文搜索引擎反爬严格 | 专注 API Provider（Tavily/Brave/Serper），浏览器 Provider 仅覆盖国际引擎 |
| **搜索结果持久化到 SQLite** | "我想保存搜索历史" | 搜索结果是临时数据，与浏览历史语义不同；增加数据库复杂度 | 不持久化，搜索结果仅在对话上下文中存在 |
| **搜索结果直接渲染为网页** | "我想在标签页中看搜索结果" | 与浏览器核心功能重叠；用户可以直接在地址栏搜索 | 搜索结果以 Markdown 文本返回给 AI，由 AI 总结后回答用户 |

## Feature Dependencies

```
web_search 工具
    ├──requires──> 搜索 Provider 体系（至少一个可用）
    ├──requires──> 结果标准化格式
    ├──requires──> 错误分类系统
    │
    ├──enhanced-by──> Auto 智能 Fallback
    │                    ├──requires──> 多 Provider 支持
    │                    ├──requires──> 速率限制器
    │                    └──requires──> 低质量检测
    │
    ├──enhanced-by──> 浏览器 Provider
    │                    ├──requires──> DOM 解析脚本（bing/google/ddg）
    │                    ├──requires──> CAPTCHA 检测
    │                    └──requires──> URL 重定向清理
    │
    └──enhanced-by──> 搜索配置 UI（设置页集成）

web_fetch 工具
    ├──requires──> SSRF 防护
    ├──requires──> HTML -> Markdown 转换
    └──independent-of──> web_search（可独立使用）
```

### Dependency Notes

- **web_search requires 搜索 Provider：** 至少需要一个可用的搜索后端，否则工具无意义
- **Auto Fallback requires 多 Provider：** 单 Provider 无法 fallback
- **浏览器 Provider requires DOM 解析：** 每个搜索引擎需要独立的页面解析脚本
- **web_fetch independent of web_search：** web_fetch 可独立用于抓取任意 URL，不依赖搜索功能
- **速率限制器 enhances Auto Fallback：** 没有速率限制器，频繁调用会被 API 封禁，触发不必要的 fallback

## MVP Definition

### Launch With (v2.5)

最小可用产品 -- 验证 AI 搜索能力的核心价值。

- [ ] **web_search 工具（API Provider）** -- 核心搜索能力，支持 Tavily/Brave/Serper
- [ ] **web_search 工具（免费 Provider）** -- 零配置可用，anysearch_free 或浏览器 Provider
- [ ] **web_fetch 工具** -- 抓取搜索结果全文，含 SSRF 防护
- [ ] **Auto 智能 Fallback** -- 默认策略，自动选择最佳可用 Provider
- [ ] **速率限制器** -- 防止 API 被封
- [ ] **搜索配置 UI** -- 设置页面集成，管理 API Key

### Add After Validation (v2.5.x)

核心验证通过后补充。

- [ ] **浏览器 Provider（Bing/Google/DDG）** -- 无 API Key 时的高级兜底（需独立 DOM 解析脚本）
- [ ] **中文搜索质量优化** -- 低质量检测 + 字典/百科过滤
- [ ] **搜索诊断信息展示** -- 调试面板显示每次搜索的 Provider 尝试链

### Future Consideration (v2.6+)

产品成熟后再考虑。

- [ ] **搜索结果高亮** -- 在 AI 回复中标注信息来源
- [ ] **搜索历史建议** -- 基于用户搜索历史提供自动补全

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| web_search（API Provider） | HIGH | MEDIUM | P1 |
| web_search（免费 Provider） | HIGH | LOW | P1 |
| web_fetch | HIGH | MEDIUM | P1 |
| Auto 智能 Fallback | HIGH | HIGH | P1 |
| 速率限制器 | MEDIUM | MEDIUM | P1 |
| 搜索配置 UI | MEDIUM | LOW | P1 |
| 浏览器 Provider | MEDIUM | HIGH | P2 |
| 中文搜索质量优化 | MEDIUM | LOW | P2 |
| 搜索诊断信息 | LOW | LOW | P2 |

**Priority key:**
- P1: Must have for launch (v2.5)
- P2: Should have, add when possible (v2.5.x)
- P3: Nice to have, future consideration (v2.6+)

## Competitor Feature Analysis

| Feature | HanaAgent (参考) | Perplexity | Our Approach |
|---------|------------------|------------|--------------|
| 搜索 Provider | 8 个（4 API + 1 免费 + 3 浏览器） | 自有搜索索引 | 复用 HanaAgent 体系，适配 Electron 环境 |
| Auto Fallback | 三级链（付费 -> 免费 -> 浏览器） | 无（自有索引） | 同 HanaAgent 方案 |
| 速率限制器 | 每 Provider 独立策略 + 指数退避 | 内部 | 同 HanaAgent 方案 |
| SSRF 防护 | 内网 IP 检测 + 重定向校验 | 不适用（服务端） | 需要，Electron 桌面环境特有风险 |
| 浏览器 Provider | Bing/Google/DDG DOM 解析 | 不适用 | 同 HanaAgent 方案，需适配 Electron BrowserWindow |
| 结果格式 | Markdown 编号列表 | 结构化卡片 | Markdown 文本（与现有 AI 工具输出风格一致） |

## 与现有工具的集成点

| 现有能力 | 集成方式 | 复杂度 |
|----------|----------|--------|
| `ai-manager.js` `_buildRealmTools()` | 新增 web_search 和 web_fetch 工具定义 | LOW |
| `ai-manager.js` 系统提示词 | 添加 web_search/web_fetch 使用指南 | LOW |
| `ai-manager.js` `sanitizeInput()` | web_fetch URL 参数消毒 | LOW |
| `ai-manager.js` `requestActionConfirmation()` | web_fetch 高风险 URL 确认 | LOW |
| 设置页 AI 分区 | 新增搜索配置子区域（Provider 选择 + API Key） | MEDIUM |
| `ipc-handlers.js` | 新增搜索相关 IPC 通道 | LOW |
| `preload.js` | 暴露搜索配置 API | LOW |

## Sources

- HanaAgent 参考实现：`/Volumes/ZhiTai/Projects/github/openhanako/.docs/web-search-implementation.md`
- Realm Browser 现有代码：`/Users/wxnacy/Projects/Realm/ai-manager.js`
- Realm Browser 项目文档：`/Users/wxnacy/Projects/Realm/.planning/PROJECT.md`
- pi-agent-core SDK 工具定义模式（从 ai-manager.js 现有 12 个工具推断）

---
*Feature research for: Realm Browser AI 网络搜索功能*
*Researched: 2026-08-26*

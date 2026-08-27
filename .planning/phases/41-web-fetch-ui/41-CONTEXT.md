# Phase 41: web_fetch 工具 + 搜索配置 UI - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

AI 助手能够抓取网页全文内容，用户可以在设置中管理搜索 Provider 和 API Key。本阶段交付：
1. **web_fetch AI 工具** — 注册到 `_buildRealmTools()`，参数：url（必填）、maxLength（可选，默认 12000），委托 search-manager 执行
2. **搜索配置 UI** — 设置页 AI 助手分区内新增「网络搜索」子区域，Provider 选择（左右分栏）+ API Key 管理 + 验证功能
3. **IPC 通道** — get-search-config / set-search-config / verify-search-key + preload 暴露

不包含：浏览器 Provider DOM 解析脚本（v2.5.x 延后）、搜索诊断面板（v2.5.x）、搜索结果缓存/持久化

</domain>

<decisions>
## Implementation Decisions

### web_fetch 内容提取管线
- **D-01:** Readability → turndown 两级管线 — 先用 jsdom + Readability 提取正文（去噪），再用 turndown 转 Markdown。复用 Phase 40 read_page_content 的去噪思路，但主进程实现（无需 CDP 注入）— **Reversibility:** costly — 需要新增 jsdom 依赖，管线结构一旦确定后续工具复用此模式
- **D-02:** turndown 富文本模式 — 保留链接（带 href）、图片（带 alt）、标题层级、列表、表格、代码块。去除 script/style/nav/footer/aside
- **D-03:** 图片保留 Markdown 链接语法 `![alt](src)`，不转为纯文本占位符
- **D-04:** 内容类型自动判断 — HTML 走 Readability→turndown 管线，JSON 用 JSON.stringify 美化输出，纯文本原样返回。根据 Content-Type header 判断

### 内容截断与返回格式
- **D-05:** 截断策略：先转 Markdown，再截断到 maxLength 字符（默认 12000）。与 Phase 22 的 read_page_content 截断策略一致
- **D-06:** 截断后末尾追加标记 `\n\n[内容已截断，原始长度: X 字符，已显示: Y 字符]`，AI 可判断内容完整性
- **D-07:** 返回纯 Markdown 文本，不包含元数据 header。与 web_search 返回格式一致（纯文本结果）

### 搜索配置 UI 布局
- **D-08:** 在设置页 AI 助手分区内新增「网络搜索」可折叠子区域，复用现有 AI 分区的展开/折叠模式 — **Reversibility:** reversible — UI 布局可独立调整
- **D-09:** 左右分栏布局 — 左侧 Provider 列表，右侧显示选中 Provider 的 API Key 配置。类似 Phase 38 的 AI provider 管理布局
- **D-10:** Provider 列表显示全部 6 个 Provider（auto/tavily/brave/serper/anysearch/anysearch_free），每个显示名称和状态图标（已配置/未配置/免费）
- **D-11:** auto Provider 选择逻辑：固定优先级 — 已配置 Key 的付费 Provider（Tavily→Brave→Serper→AnySearch）→ AnySearch Free → DDG 浏览器。与 Phase 40 的 doAutoSearch Fallback 链一致

### API Key 验证交互
- **D-12:** 验证触发方式：手动点击验证按钮。用户输入 Key 后旁边出现「验证」按钮，点击后发送测试查询。避免意外消耗 API 额度
- **D-13:** 测试查询使用固定查询词 `test`，所有 Provider 都能处理
- **D-14:** 验证结果内联显示 — 成功显示绿色对勾 + 「Key 有效」，失败显示红色叉号 + 具体错误信息（如「API Key 无效」「网络超时」「额度已用完」）
- **D-15:** 保存时机：先保存到 electron-store，验证标记状态。验证不通过标记为「未验证」但不删除，用户可稍后再验证

### Claude's Discretion
- SSRF 防护的具体实现细节（isPrivateIp 复用方式、重定向校验逻辑）由实现者决定
- IPC 通道的具体参数格式由实现者决定（遵循现有 get-xxx / set-xxx 模式）
- 设置页搜索子区域的具体 CSS 样式由实现者决定（遵循现有 AI 分区风格）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenHanako 参考实现
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-fetch.ts` — web_fetch 工具实现、内容提取管线、SSRF 防护
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-search.ts` — 搜索 Provider 体系、Auto Fallback（Phase 40 已参考）

### 需求文档
- `.planning/REQUIREMENTS.md` §FETCH-01 ~ FETCH-04, CONFIG-01 ~ CONFIG-04 — Phase 41 锁定需求
- `.planning/ROADMAP.md` §Phase 41 — 成功标准和阶段边界

### Phase 40 上下文
- `.planning/phases/40-web-search/40-CONTEXT.md` — Phase 40 决策（SSRF 防护、Provider 体系、速率限制器参数表）
- `.planning/phases/40-web-search/40-01-PLAN.md` — search-manager.js 实现细节

### 现有代码
- `ai-manager.js` §`_buildRealmTools()` (line 1566) — 工具注册模式，web_fetch 需要遵循此模式
- `src/settings-page.js` §AI 助手分区 — 设置页 AI 配置 UI 模式（Provider 管理、展开/折叠）
- `src/preload.js` — contextBridge API 暴露模式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`search-manager.js`** — Phase 40 已实现，包含 isPrivateIp、SearchRateLimiter、Provider 体系。web_fetch 的 SSRF 防护直接复用 isPrivateIp
- **`ai-manager.js _buildRealmTools()`** — 现有 12 个工具的注册模式（name/label/description/parameters/execute），web_fetch 遵循同一结构
- **`src/settings-page.js` AI 分区** — 已有 Provider 管理 UI 模式（下拉选择、输入框、展开/折叠），搜索配置 UI 复用此模式
- **`electron-store`** — 已用于容器配置和 AI 配置持久化，复用存储搜索配置（`search.provider`、`search.apiKeys`）

### Established Patterns
- **工具返回格式** — `{content: [{type: 'text', text: JSON.stringify(...)}], details: {...}}`
- **IPC 通道命名** — `get-xxx` / `set-xxx` / `delete-xxx` 动词-名词格式
- **设置页 webview 数据获取** — 内部页面通过 `/api/*` HTTP 端点获取数据（非直接 IPC）

### Integration Points
- **`ai-manager.js`** — web_fetch 工具定义在此文件的 `_buildRealmTools()` 中，execute 委托给 search-manager
- **`search-manager.js`** — 新增 `fetchUrl()` 和 `htmlToMarkdown()` 方法
- **`ipc-handlers.js`** — 新增搜索配置 IPC 通道（get-search-config / set-search-config / verify-search-key）
- **`src/preload.js`** — 暴露 searchConfigAPI 给渲染进程
- **`src/settings-page.js`** — 新增「网络搜索」子区域 UI

</code_context>

<specifics>
## Specific Ideas

- web_fetch 内容提取复用 Phase 40 read_page_content 的 Readability 去噪思路，但主进程实现（jsdom + Readability，无需 CDP 注入）
- 搜索配置 UI 左右分栏布局类似 Phase 38 的 AI provider 管理，用户已有熟悉感
- auto Provider 选择逻辑与 Phase 40 的 doAutoSearch Fallback 链保持一致
- 唯一新增 npm 依赖：jsdom（主进程 HTML 解析）+ turndown（HTML 转 Markdown）

</specifics>

<deferred>
## Deferred Ideas

- **浏览器 Provider（Bing/Google）** — v2.5.x，需独立 DOM 解析脚本，复杂度高
- **中文搜索质量优化（扩展）** — v2.5.x，当前仅做基础字典/百科检测
- **搜索诊断信息展示（调试面板）** — v2.5.x
- **用户自定义 Provider 优先级** — 未讨论，当前使用固定顺序
- **turndown 配置暴露给用户** — 未选择，当前使用固定富文本模式

</deferred>

---

*Phase: 41-web_fetch 工具 + 搜索配置 UI*
*Context gathered: 2026-08-26*

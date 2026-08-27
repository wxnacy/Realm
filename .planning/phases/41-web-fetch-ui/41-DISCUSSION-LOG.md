# Phase 41: web_fetch 工具 + 搜索配置 UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 41-web_fetch 工具 + 搜索配置 UI
**Areas discussed:** web_fetch 内容提取管线, 内容截断与返回格式, 搜索配置 UI 布局, API Key 验证交互

---

## web_fetch 内容提取管线

### Q1: 内容提取策略

| Option | Description | Selected |
|--------|-------------|----------|
| Readability → turndown（推荐） | 先注入 Readability 提取正文，再用 turndown 转 Markdown。去噪效果最好，但两次处理有性能开销 | ✓ |
| turndown 直接转 | 直接用 turndown 转整个页面 HTML，靠配置过滤 script/style/nav/footer。更简单，但噪声可能残留 | |
| cheerio 选择器 → turndown | 用 cheerio 解析 HTML 提取正文，再用 turndown 转。比 Readability 轻量但去噪能力弱一些 | |

**User's choice:** Readability → turndown（推荐）
**Notes:** 复用 Phase 40 read_page_content 的去噪思路，但主进程实现（无需 CDP 注入）

### Q2: turndown 配置

| Option | Description | Selected |
|--------|-------------|----------|
| 富文本模式（推荐） | 保留链接（带 href）、图片（带 alt）、标题层级、列表、表格、代码块。去除 script/style/nav/footer/aside | ✓ |
| 纯文本+链接模式 | 只保留链接和基本格式（标题、列表、加粗/斜体），去掉图片、表格、代码块 | |
| 可配置模式 | 暴露 turndown 配置给用户（保留元素列表、图片处理方式等），在设置页可调 | |

**User's choice:** 富文本模式（推荐）
**Notes:** 最完整的 Markdown 输出

### Q3: Readability 在主进程怎么跑

| Option | Description | Selected |
|--------|-------------|----------|
| jsdom + Readability（推荐） | 在主进程用 jsdom 解析 HTML 字符串，再实例化 Readability 解析。无需 webview/CDP，纯 Node.js 实现。需要新增 jsdom 依赖 | ✓ |
| 临时 BrowserWindow + CDP 注入 | 复用 Phase 22 的 readability-bundle.js（IIFE 注入 CDP），但 web_fetch 没有 CDP 连接。需要创建临时 BrowserWindow + webview 来注入 | |
| cheerio 选择器提取 | 用 cheerio 提取正文内容（基于选择器去噪），不用 Readability。轻量但去噪质量不如 Readability | |

**User's choice:** jsdom + Readability（推荐）
**Notes:** 纯 Node.js 实现，新增 jsdom 依赖

### Q4: 图片元素处理

| Option | Description | Selected |
|--------|-------------|----------|
| 保留图片链接（推荐） | 图片转换为 Markdown 图片语法 `![alt](src)`，保留 alt 文本和 src URL。AI 可以理解图片上下文 | ✓ |
| 纯文本占位符 | 图片转换为纯文本 `[图片: alt]` 或直接去掉。减少 token 消耗，AI 无法访问图片内容 | |
| 自适应模式 | 默认保留图片链接，但大页面（>8000 字符）自动降级为纯文本占位符以节省 token | |

**User's choice:** 保留图片链接（推荐）
**Notes:** AI 可以理解图片上下文（虽然无法直接看图）

---

## 内容截断与返回格式

### Q1: 截断策略

| Option | Description | Selected |
|--------|-------------|----------|
| 转 Markdown 后截断（推荐） | 先转 Markdown，再截断到 maxLength 字符。简单直接，截断位置可能在句子/段落中间。Phase 22 的 read_page_content 用的就是这种策略（102400 字符） | ✓ |
| 截断 HTML 后再转 | 先截断原始 HTML（去掉 <body> 之后的内容），再转 Markdown。截断更干净但可能切断 HTML 标签导致解析错误 | |
| 按段落边界截断 | 先转 Markdown，按段落边界截断（不切断句子）。更智能但实现复杂，需要段落检测逻辑 | |

**User's choice:** 转 Markdown 后截断（推荐）
**Notes:** 与 Phase 22 的 read_page_content 截断策略一致

### Q2: 截断提示标记

| Option | Description | Selected |
|--------|-------------|----------|
| 末尾追加截断标记（推荐） | 截断后在末尾追加 `\n\n[内容已截断，原始长度: X 字符，已显示: Y 字符]`。AI 和用户都能清楚知道内容不完整 | ✓ |
| 静默截断 | 不加任何标记，静默截断。AI 不知道内容被截断了，可能误以为是完整内容 | |
| 首尾双重标记 | 截断后在开头加标记 `[注意：以下内容已截断]`，末尾也加。更醒目但增加 token 消耗 | |

**User's choice:** 末尾追加截断标记（推荐）
**Notes:** AI 可判断内容完整性

### Q3: 内容类型处理

| Option | Description | Selected |
|--------|-------------|----------|
| 自动判断内容类型（推荐） | HTML 走 Readability→turndown 管线，JSON 用 JSON.stringify 美化输出，纯文本原样返回。根据 Content-Type header 自动判断 | ✓ |
| 只处理 HTML，其他原样返回 | 只处理 HTML 页面，JSON 和纯文本直接返回原始内容。更简单但 JSON 可读性差 | |
| 统一走 turndown | 所有类型都走 turndown（JSON 当作 HTML 处理）。统一但可能产生意外结果 | |

**User's choice:** 自动判断内容类型（推荐）
**Notes:** 根据 Content-Type header 判断

### Q4: 返回格式

| Option | Description | Selected |
|--------|-------------|----------|
| 纯 Markdown 文本（推荐） | 返回纯 Markdown 文本，AI 直接读取。最简洁，与 web_search 的返回格式一致（纯文本结果） | ✓ |
| JSON 元数据 + 内容 | 返回 JSON 对象 `{url, title, content, contentType, truncated, length}`，包含元数据。AI 需要解析 JSON 才能读内容 | |
| Markdown + 元数据 header | Markdown 文本 + 元数据 header（URL、标题、抓取时间、内容类型），用分隔线隔开。信息最全但 token 消耗更大 | |

**User's choice:** 纯 Markdown 文本（推荐）
**Notes:** 与 web_search 返回格式一致

---

## 搜索配置 UI 布局

### Q1: UI 位置

| Option | Description | Selected |
|--------|-------------|----------|
| AI 分区内新增子区域（推荐） | 在设置页 AI 助手分区内新增「网络搜索」可折叠区域，展开后显示 Provider 选择和 API Key 管理。复用现有 AI 分区的展开/折叠模式 | ✓ |
| 侧边栏独立页面 | 在设置页侧边栏新增「网络搜索」独立页面（与通用/分配规则/快捷键/AI 助手/关于并列）。页面空间更大但侧边栏更拥挤 | |
| 弹窗管理 | 在 AI 助手分区内新增一个「搜索设置」按钮，点击打开弹窗管理 Provider 和 API Key。隔离性好但多一层交互 | |

**User's choice:** AI 分区内新增子区域（推荐）
**Notes:** 复用现有 AI 分区的展开/折叠模式

### Q2: Provider 和 API Key 排列

| Option | Description | Selected |
|--------|-------------|----------|
| 选择后显示对应 Key（推荐） | 下拉选择 Provider 后，下方只显示对应 Provider 的 API Key 输入框。简洁但切换 Provider 时需要重新渲染 | |
| 全部平铺显示 | 所有 Provider 的 API Key 输入框都平铺显示，用户可以同时配置多个。信息一目了然但界面更长 | |
| 左右分栏 | 左侧 Provider 列表，右侧显示选中 Provider 的 API Key 配置。类似 Phase 38 的 AI provider 管理布局 | ✓ |

**User's choice:** 左右分栏
**Notes:** 类似 Phase 38 的 AI provider 管理布局

### Q3: Provider 列表显示

| Option | Description | Selected |
|--------|-------------|----------|
| 全部显示 + 状态图标（推荐） | 显示所有 Provider（auto/tavily/brave/serper/anysearch/anysearch_free），每个显示名称和状态图标（已配置/未配置/免费）。auto 选项自动选择最佳可用 Provider | ✓ |
| 只显示已配置的 | 只显示已配置 API Key 的 Provider + auto 选项。更简洁但用户可能不知道还有哪些可选 | |
| 分组显示 | 分两组显示：免费 Provider（anysearch_free）和付费 Provider（tavily/brave/serper/anysearch）。结构清晰但 UI 更复杂 | |

**User's choice:** 全部显示 + 状态图标（推荐）
**Notes:** auto 选项自动选择最佳可用 Provider

### Q4: auto Provider 选择逻辑

| Option | Description | Selected |
|--------|-------------|----------|
| 固定优先级（推荐） | auto 按固定优先级选择：已配置 Key 的付费 Provider（Tavily→Brave→Serper→AnySearch）→ AnySearch Free → DDG 浏览器。跟 Phase 40 的 doAutoSearch Fallback 链一致 | ✓ |
| 动态优先级 | auto 根据上次成功/失败记录动态调整优先级。更智能但增加复杂度和状态管理 | |
| 默认 Free，手动覆盖 | auto 默认用 AnySearch Free（零配置），用户手动切换到其他 Provider 时 auto 失效。最简单但功能有限 | |

**User's choice:** 固定优先级（推荐）
**Notes:** 与 Phase 40 的 doAutoSearch Fallback 链保持一致

---

## API Key 验证交互

### Q1: 验证触发时机

| Option | Description | Selected |
|--------|-------------|----------|
| 手动点击验证按钮（推荐） | 用户输入 API Key 后，旁边出现「验证」按钮，点击后发送测试查询。用户主动控制，不会意外消耗 API 额度 | ✓ |
| 输入后自动验证 | 用户输入 API Key 并离开输入框后（blur 事件），自动发送验证请求。体验更流畅但可能意外消耗额度 | |
| 首次自动，之后手动 | 首次添加时自动验证，之后修改时需要手动点击验证按钮。平衡体验和额度消耗 | |

**User's choice:** 手动点击验证按钮（推荐）
**Notes:** 用户主动控制，避免意外消耗 API 额度

### Q2: 测试查询词

| Option | Description | Selected |
|--------|-------------|----------|
| 固定查询词 test（推荐） | 用固定查询词 `test` 或 `hello` 发送搜索请求。简单可靠，所有 Provider 都能处理 | ✓ |
| 随机查询词 | 用随机查询词（如 `weather today`）发送请求。更接近真实使用场景但结果不可预测 | |
| 格式检查 + 网络测试 | 不发送搜索请求，只检查 API Key 格式（长度、前缀等）和网络连通性。零额度消耗但无法验证 Key 有效性 | |

**User's choice:** 固定查询词 test（推荐）
**Notes:** 所有 Provider 都能处理

### Q3: 验证结果展示

| Option | Description | Selected |
|--------|-------------|----------|
| 内联状态图标 + 错误信息（推荐） | 验证成功显示绿色对勾 + 「Key 有效」，失败显示红色叉号 + 具体错误信息（如「API Key 无效」「网络超时」「额度已用完」）。清晰直观 | ✓ |
| Toast 通知 | 验证成功/失败用 toast 通知显示。不占用 UI 空间但信息一闪而过 | |
| 模态弹窗 | 验证中显示 spinner，成功/失败用模态弹窗显示详细结果。信息最全但打断用户操作流程 | |

**User's choice:** 内联状态图标 + 错误信息（推荐）
**Notes:** 清晰直观

### Q4: Key 保存时机

| Option | Description | Selected |
|--------|-------------|----------|
| 先保存，验证标记状态（推荐） | 用户输入 Key 后先保存，验证不通过时标记为「未验证」但不删除。用户可以稍后再验证。避免验证失败导致 Key 丢失 | ✓ |
| 验证成功才保存 | 验证成功后才保存，失败则不保存。确保只有有效的 Key 被存储，但用户可能需要重新输入 | |
| 延迟验证（首次使用时） | 用户输入 Key 后保存为「待验证」状态，发送搜索请求时如果未验证则自动验证。延迟验证但增加首次搜索延迟 | |

**User's choice:** 先保存，验证标记状态（推荐）
**Notes:** 避免验证失败导致 Key 丢失

---

## Claude's Discretion

- SSRF 防护的具体实现细节（isPrivateIp 复用方式、重定向校验逻辑）由实现者决定
- IPC 通道的具体参数格式由实现者决定（遵循现有 get-xxx / set-xxx 模式）
- 设置页搜索子区域的具体 CSS 样式由实现者决定（遵循现有 AI 分区风格）

## Deferred Ideas

- **浏览器 Provider（Bing/Google）** — v2.5.x，需独立 DOM 解析脚本
- **中文搜索质量优化（扩展）** — v2.5.x
- **搜索诊断信息展示（调试面板）** — v2.5.x
- **用户自定义 Provider 优先级** — 未讨论
- **turndown 配置暴露给用户** — 未选择

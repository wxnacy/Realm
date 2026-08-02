# Phase 23: 智能上下文引用 + 全文检索 - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

用户在 AI 对话中通过 @ 引用标签页内容作为上下文，并通过全文检索搜索收藏内容。

具体交付：
- CTX-01: @ 引用标签页 UI（输入框 + 浮动面板选择器，支持多标签页引用）
- CTX-02: ai:prompt-with-context IPC 通道（渲染进程传递 Tab 元数据到主进程）
- CTX-03: AI 上下文注入逻辑（将引用的标签页内容注入到 AI 对话系统提示词）
- CTX-04: FTS5 全文检索索引扩展（favorites-manager.js 新增 FTS5 虚拟表和触发器）
- CTX-05: search_favorites_fulltext 工具（AI 可搜索收藏内容）

**偏离 Roadmap 原始要求：** 用户决定允许跨容器引用标签页（Roadmap 原要求"仅限当前容器"），在 @ 选择器中显示容器标识。

</domain>

<decisions>
## Implementation Decisions

### @ 引用交互方式
- **D-01:** 浮动面板触发 — 在 AI 聊天输入框中输入 @ 后弹出浮动面板，显示标签页列表，支持关键字过滤
- **D-02:** 多选模式 — 用户可以同时选择多个标签页，AI 同时引用所有选中页面的内容
- **D-03:** Pill 确认 — 选中的标签页以 pill/chip 形式显示在输入框上方，点击 × 可取消选择
- **D-04:** 仅 @ 触发 — 只有输入 @ 字符后才触发选择器，空输入框或获得焦点时不触发

### 引用内容读取策略
- **D-05:** 复用 read_page_content — 选中标签页后，复用 Phase 22 的 CDP + Readability 逻辑读取页面完整正文和元信息
- **D-06:** 分块注入 — 每个标签页的内容作为独立的上下文块注入，带标签区分来源页面（标题+URL），AI 可以区分不同页面
- **D-07:** 按标签页独立截断 — 每个标签页最多 102,400 字符（复用 Phase 22 截断值），总预算不限
- **D-08:** 系统提示词注入 — 引用的内容注入到 AI 对话的系统提示词中，作为 AI 的背景知识

### FTS5 全文检索索引
- **D-09:** jieba 中文分词 — 使用 nodejieba 作为 FTS5 的 tokenizer，提供更好的中文分词效果（如"北京大学"可正确分词为"北京"+"大学"）
- **D-10:** 索引标题+URL — FTS5 虚拟表仅索引 favorites 表的 title 和 url 字段，不读取页面正文
- **D-11:** 启动时全量构建 — 应用启动时自动检测 FTS5 索引是否存在，不存在则为所有已有收藏建立索引；之后通过触发器增量维护
- **D-12:** 默认 50 条 — search_favorites_fulltext 工具默认返回 50 条结果

### @ 引用安全约束
- **D-13:** 跨容器可见（偏离 Roadmap） — @ 引用选择器显示所有容器的标签页，允许跨容器引用。用户明确确认此偏离
- **D-14:** 显示容器标识 — 在 @ 选择器中，每个标签页项显示容器颜色圆点和容器名称，让用户知道来源容器

### Claude's Discretion

无 — 所有关键决策已由用户确认。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI 工具系统
- `ai-manager.js` — AI Manager，包含 `_buildRealmTools()` 方法定义工具列表。新工具 search_favorites_fulltext 在此注册
- `ai-manager.js` `manage_favorites` — 现有收藏管理工具（add/view/delete），新全文检索工具需与其保持接口一致性
- `src/preload.js` — contextBridge API 定义，新 IPC 通道需在此暴露

### 收藏管理
- `favorites-manager.js` — 收藏数据存储（better-sqlite3），包含现有 searchRecords（LIKE 模式搜索）。FTS5 虚拟表和触发器在此文件新增

### CDP / 内容读取
- `cdp-manager.js` — Phase 22 的 CDP 管理器，read_page_content 工具的底层实现。@ 引用的标签页内容读取复用此逻辑

### 项目规范
- `.planning/ROADMAP.md` — Phase 23 成功标准和依赖关系
- `.planning/REQUIREMENTS.md` — CTX-01~CTX-05 需求定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cdp-manager.js` `read_page_content` 逻辑: CDP attach + Readability 注入 + 内容提取，@ 引用的标签页内容读取直接复用
- `ai-manager.js` `_buildRealmTools()`: 工具注册模式（name/description/parameters/execute），search_favorites_fulltext 直接复用
- `favorites-manager.js` `searchRecords()`: 现有 LIKE 模式搜索，新 FTS5 搜索函数与之并存
- `favorites-manager.js` 数据库初始化模式: `ensureTable()` + `CREATE TABLE IF NOT EXISTS`，FTS5 虚拟表复用此模式

### Established Patterns
- AI 工具 execute 函数签名：`async (toolCallId, params, signal?, onUpdate?)`
- AI 工具返回格式：`{ content: [{ type: 'text', text: JSON.stringify(...) }], details: {...} }`
- IPC 通道使用 kebab-case：`get-containers`、`switch-container`
- better-sqlite3 同步 API：所有数据库操作使用同步调用

### Integration Points
- `ai-manager.js` 的 `_buildRealmTools()` — search_favorites_fulltext 工具在此注册
- `favorites-manager.js` 的数据库实例 — FTS5 虚拟表和触发器在此数据库上创建
- `src/renderer.js` AI 聊天面板 — @ 引用浮动面板和 pill 需要在此添加 UI 逻辑
- `src/index.html` AI 聊天区域 — @ 引用的 HTML 结构需要在此添加
- `src/styles/main.css` — @ 引用浮动面板和 pill 的样式需要在此添加
- `src/preload.js` — 新 IPC 通道（获取标签页列表、传递引用上下文）需在此暴露

</code_context>

<specifics>
## Specific Ideas

- 浮动面板交互参考：输入 @ 后弹出，支持关键字过滤标签页标题/URL，鼠标点击选中/取消
- Pill 展示：选中的标签页显示为 pill（标题+容器颜色圆点），点击 × 取消
- FTS5 索引：使用 jieba 分词器（nodejieba 包），对 title 和 url 建立全文索引
- 系统提示词注入格式：每个引用标签页作为独立的 `<referenced-tab>` 块注入，包含标题、URL 和正文内容

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-智能上下文引用 + 全文检索*
*Context gathered: 2026-08-02*

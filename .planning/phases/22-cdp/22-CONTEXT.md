# Phase 22: CDP 管理器扩展 + 基础网页操控工具 - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

AI Agent 能够读取网页内容、提取链接、在容器中打开链接 — 所有后续阶段（智能上下文、自动填表、脚本生成）的 CDP 基础。

具体交付：
- CDP-01: 独立 CDP 管理器扩展（Runtime/DOM/Page 域支持 + 资源监控和自动清理）
- CDP-02: read_page_content 工具（读取当前标签页的页面标题、正文、元信息）
- CDP-03: extract_links 工具（提取页面所有有效链接，支持过滤和去重）
- CDP-04: open_link 工具（在指定容器中打开链接，支持当前标签页或新标签页）

</domain>

<decisions>
## Implementation Decisions

### CDP 会话生命周期
- **D-01:** 按需附加 — AI 工具调用时才 attach CDP 调试器，用完后立即 detach。节省资源，首次调用有几百毫秒延迟可接受
- **D-02:** 统一管理 — cdp-manager 维护所有调试器状态，AI 工具复用已有连接并追加启用 Runtime/DOM 域。避免重复 attach
- **D-03:** 用完即卸 — 工具执行完成后立即 detach，不保留调试器连接
- **D-04:** DevTools 冲突处理 — 检测到 DevTools 已打开时返回错误提示用户关闭后重试

### 内容提取策略
- **D-05:** Runtime.evaluate + Readability — 注入 Mozilla Readability 算法提取可读内容，质量高于简单 innerText
- **D-06:** 全部元信息 — 返回基础信息（标题/URL/favicon）、SEO 元信息（description/keywords/author）、Open Graph 标签、页面属性（canonical/语言/字符集）
- **D-07:** 固定截断 100KB — 正文内容截断到 100KB，超出标记 [截断：原始大小 X bytes]。基于 HTTP Archive 数据，100KB 可覆盖 99%+ 网页

### 链接提取与过滤
- **D-08:** 过滤规则 — 仅保留 http/https 协议、URL 去重、相对 URL 转绝对 URL、过滤锚点链接（#section）
- **D-09:** 返回字段 — URL + 链接文本（a 标签 textContent）

### open_link 容器选择
- **D-10:** 默认容器 — 使用当前活跃容器（而非固定 default 容器），跟随用户操作上下文
- **D-11:** 默认打开方式 — 新标签页打开，不影响用户当前正在看的页面

### Claude's Discretion

无 — 所有关键决策已由用户确认。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 现有 CDP 实现
- `cdp-manager.js` — 现有 CDP 管理器，仅支持 Network 域抓取。新功能需扩展此模块，添加 Runtime/DOM/Page 域支持
- `dev-requests-writer.js` — CDP 抓取数据的写入队列，参考其异步队列模式

### AI 工具系统
- `ai-manager.js` — AI Manager，包含 `_buildRealmTools()` 方法定义工具列表。新工具将在此注册
- `src/preload.js` — contextBridge API 定义，新 IPC 通道需在此暴露

### 项目规范
- `.planning/ROADMAP.md` — Phase 22 成功标准和依赖关系
- `.planning/REQUIREMENTS.md` — CDP-01~CDP-04 需求定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cdp-manager.js`: 已有 debugger attach/detach 生命周期管理、域名匹配、状态跟踪（debuggerStates Map）。可扩展为统一调试器管理器
- `ai-manager.js` `_buildRealmTools()`: 工具注册模式（name/description/parameters/execute），新工具直接复用
- `tab-manager.js`: `getTabs()` 方法获取标签页列表，`createTab()` 创建新标签页
- `window-manager.js`: `getMainWindow()` 获取主窗口，`switchContainer()` 切换容器

### Established Patterns
- CDP 调试器按 webContents.id 跟踪状态（`debuggerStates` Map）
- 工具 execute 函数签名：`async (toolCallId, params, signal?, onUpdate?)`
- 工具返回格式：`{ content: [{ type: 'text', text: JSON.stringify(...) }], details: {...} }`
- IPC 通道使用 kebab-case：`get-containers`、`switch-container`

### Integration Points
- `cdp-manager.js` 的 `attachDebugger()` / `detachDebugger()` — 需扩展支持 Runtime/DOM 域
- `ai-manager.js` 的 `_buildRealmTools()` — 新工具在此注册
- `main.js` 的 webview 事件 — `did-start-navigation`、`destroyed` 等生命周期事件

</code_context>

<specifics>
## Specific Ideas

- 使用 Mozilla Readability 库提取可读内容（类似 Firefox 阅读模式）
- Readability 库代码可直接注入到 webview 中通过 Runtime.evaluate 执行
- 大页面 100KB 截断基于 HTTP Archive 统计数据（平均 HTML 30-50KB，纯文本 5-15KB）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-CDP 管理器扩展 + 基础网页操控工具*
*Context gathered: 2026-08-02*

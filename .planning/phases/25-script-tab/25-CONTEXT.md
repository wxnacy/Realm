# Phase 25: 脚本生成 + 智能标签整理 - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

AI Agent 能够根据用户自然语言描述生成可执行脚本，并能智能分组整理当前标签页。

具体交付：
- SCRIPT-01: generate_script 工具（自然语言描述生成可执行脚本）
- SCRIPT-02: 脚本预览/确认 UI（用户确认后执行）
- SCRIPT-03: 脚本静态分析和安全验证（防止代码注入和权限提升）
- TAG-01: suggest_tab_groups 工具（AI 按主题/域名智能分组标签页）
- TAG-02: 标签分组 UI（展示和应用分组建议）

</domain>

<decisions>
## Implementation Decisions

### 脚本语言与格式
- **D-01:** 步骤序列格式 — 脚本由多个原子步骤组成，每步复用 Phase 24 的 execute_action 能力（click/type/scroll/wait 等）
- **D-02:** 结构化 JSON — 脚本包含 name（名称）、description（描述）、steps（步骤数组）、containerId（目标容器）。每步格式为 `{action, target, options, waitFor?}`
- **D-03:** 细粒度原子操作 — 每个步骤只做一个原子操作，AI 负责将用户意图分解为细粒度步骤
- **D-04:** 自动等待 load 事件 — 每步执行后自动等待页面 load 事件，超时后继续执行下一步

### 脚本预览与编辑
- **D-05:** AI 聊天内联预览 — 生成的脚本在 AI 聊天消息中直接展示为步骤卡片，与 Phase 24 的操作确认 UI 模式一致
- **D-06:** 完整编辑能力 — 用户可以编辑脚本的每个步骤（修改目标/参数/顺序），支持添加/删除步骤
- **D-07:** 内联展开编辑 — 编辑 UI 在内联卡片中直接展开，每个步骤可展开编辑参数，支持拖拽排序和删除
- **D-08:** 会话内有效 — 脚本仅在当前 AI 对话会话中有效，关闭面板后消失。不支持脚本持久化和复用

### 脚本执行与安全
- **D-09:** CDP 命令执行 — 脚本通过 CDP 的 executeCommand 方法执行，每个步骤是一个 CDP 命令调用，复用现有能力
- **D-10:** 严格白名单静态分析 — 拦截所有危险操作：eval/Function 构造器、文件系统访问、网络请求、环境变量读取、require/import、子进程执行
- **D-11:** 实时逐步反馈 — 每个步骤执行后，实时在 AI 聊天中显示执行结果（成功/失败/页面变化），用户可以随时停止执行
- **D-12:** 失败停止 + 用户决策 — 步骤执行失败时自动停止后续步骤，显示错误信息，用户可选择重试、跳过或终止脚本

### 标签分组策略与 UI
- **D-13:** AI 语义分组 — AI 根据页面标题、URL 和内容语义进行智能分组（如新闻类、社交媒体类、工作相关类）
- **D-14:** AI 聊天内联建议卡片 — 分组建议在 AI 聊天面板中展示为卡片，每组显示组名和标签页列表
- **D-15:** 视觉分隔 + 重排 — 确认分组后，标签栏按分组重新排列，每组之间用分隔线区分，组内标签页按原顺序排列
- **D-16:** 完整编辑分组 — 用户可以修改组名、移动标签页到其他组、删除分组、调整组的顺序，编辑完成后重新应用

### Claude's Discretion

无 — 所有关键决策已由用户确认。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI 工具系统
- `ai-manager.js` — AI Manager，包含 `_buildRealmTools()` 方法定义工具列表。generate_script 和 suggest_tab_groups 工具在此注册
- `ai-manager.js` — fill_form/execute_action 工具的实现模式，新工具需保持接口一致性

### CDP / 自动化
- `cdp-manager.js` — CDP 管理器，包含 attachForAI/detachForAI/executeCommand 方法。脚本执行的底层实现复用此模块
- `cdp-manager.js` — fillForm/executeAction 的实现模式，脚本步骤执行可参考

### UI / 确认交互
- `src/renderer.js` — 渲染进程逻辑，AI 聊天面板内联脚本预览卡片和分组建议卡片需在此添加
- `src/index.html` — 主界面结构，脚本预览和分组建议的 HTML 结构需在此添加
- `src/styles/main.css` — 样式文件，脚本预览卡片和分组建议卡片样式需在此添加

### 项目规范
- `.planning/ROADMAP.md` — Phase 25 成功标准和依赖关系
- `.planning/REQUIREMENTS.md` — SCRIPT-01~03、TAG-01~02 需求定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ai-manager.js` `_buildRealmTools()` 工具注册模式: name/description/parameters/execute 签名，generate_script 和 suggest_tab_groups 直接复用
- `cdp-manager.js` `executeCommand()` 方法: CDP 命令执行 + 10 秒超时保护，脚本步骤执行直接复用
- Phase 24 的操作确认 UI 模式: 聊天内联确认卡片，脚本预览卡片可复用此模式
- Phase 24 的 fill_form/execute_action: 步骤序列中的原子操作直接调用这些底层方法

### Established Patterns
- AI 工具 execute 函数签名：`async (toolCallId, params, signal?, onUpdate?)`
- AI 工具返回格式：`{ content: [{ type: 'text', text: JSON.stringify(...) }], details: {...} }`
- IPC 通道使用 kebab-case：`get-containers`、`switch-container`
- 确认 UI: 聊天内联卡片模式（Phase 24 D-05）

### Integration Points
- `ai-manager.js` 的 `_buildRealmTools()` — generate_script 和 suggest_tab_groups 工具在此注册
- `cdp-manager.js` 的 `executeCommand()` — 脚本步骤执行的底层调用
- `src/renderer.js` AI 聊天面板 — 脚本预览卡片和分组建议卡片需在此添加 UI 逻辑
- `src/preload.js` — 新 IPC 通道（脚本执行状态更新、分组应用）需在此暴露
- `src/index.html` — 脚本预览和分组建议的 HTML 结构需在此添加
- `src/styles/main.css` — 脚本预览卡片和分组建议卡片样式需在此添加

</code_context>

<specifics>
## Specific Ideas

- 脚本步骤序列格式示例：`{ name: "登录网站", description: "自动登录目标网站", steps: [{ action: "navigate", target: "https://example.com" }, { action: "type", target: "邮箱输入框", options: { value: "user@example.com" } }, { action: "click", target: "登录按钮" }], containerId: "work" }`
- 分组建议卡片设计：显示组名 + 标签页列表（标题 + URL + 容器颜色圆点），支持拖拽调整、修改组名、删除分组
- 静态分析白名单：仅允许 DOM 操作和页面交互 API（click/type/scroll/wait），禁止 eval/Function/require/fs/net/http 等

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-脚本生成 + 智能标签整理*
*Context gathered: 2026-08-03*

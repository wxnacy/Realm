# Phase 42: AI 历史对话功能调研与 pi-agent 集成方案 - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

为 AI 助手添加历史对话管理功能，用户可以查看、新建、恢复和删除历史对话。本阶段交付：

1. **对话存储层** — 独立的 `ai-conversations.db` SQLite 数据库，conversations + messages 两表设计
2. **对话管理 UI** — AI 聊天面板内嵌对话列表，支持新建、切换、删除、重命名对话
3. **pi-agent 集成** — Agent 实例生命周期管理，一对话一实例模式
4. **对话恢复机制** — 加载历史消息到 Agent，恢复工具调用结果和页面引用快照

不包含：跨设备对话同步、对话导出、自动清理策略

</domain>

<decisions>
## Implementation Decisions

### 对话存储方案
- **D-01:** 独立 SQLite 数据库 `ai-conversations.db` — 与 history.db 分离，AI 对话数据独立管理。复用 better-sqlite3 同步 API 模式 — **Reversibility:** costly — 数据库结构一旦确定，迁移需要数据转换脚本
- **D-02:** 两表设计 — conversations (id, title, container_id, model, provider, token_total, created_at, updated_at) + messages (id, conversation_id, role, content, tool_calls, tool_results, created_at)。对话元数据和消息分离，查询灵活
- **D-03:** 对话全局共享，不属于任何容器 — 与收藏夹设计一致（Phase 9 决策），用户在一个容器中创建的对话可以在其他容器中查看和继续
- **D-04:** 对话标题生成策略：默认截取第一条用户消息的前 30 个字符，同时支持用户手动重命名

### 对话管理 UI
- **D-05:** 在 AI 聊天面板顶部添加历史按钮，点击展开对话列表下拉面板 — 不需要额外的页面或弹窗，交互更直接
- **D-06:** 新建对话触发方式：~~每次打开 AI 面板自动新建对话 + 显式「新对话」按钮 — 类似 ChatGPT 的体验~~
  **（2026-09-01 修订，依据 UAT G-42-1：启动/打开面板自动产生的 0 消息「新对话」垃圾行违反用户预期，空状态必须可达）** 修订后语义 — 对话创建为**惰性**：应用启动与打开 AI 面板均不自动建行；对话在首条用户消息发送时惰性创建（标题按 D-04 自动取首条消息前 30 字符）或由用户显式点「新对话」创建；删除当前对话不自动补建，允许到达「暂无对话」空状态（空状态后直接发送消息由 Agent 重建 + 惰性建行恢复）
- **D-07:** 切换对话时自动保存当前对话到数据库，然后加载目标对话 — 无缝切换，不丢失任何数据
- **D-08:** 删除对话交互：右键对话显示菜单，选择删除后弹出确认对话框 — 防止误删

### pi-agent 集成方式
- **D-09:** 一对话一实例模式 — 每个对话对应一个 Agent 实例，切换对话时销毁旧实例、创建新实例。简单清晰，避免 reset() 状态恢复的复杂性 — **Reversibility:** costly — Agent 生命周期管理逻辑一旦确定，改变模式需要重构消息加载和事件订阅
- **D-10:** 历史消息通过 agent.prompt() 注入 — 创建 Agent 后，逐条或批量注入历史消息，Agent 将其视为上下文的一部分
- **D-11:** 每轮对话结束后（agent_end 事件）将消息写入数据库 — 保证数据不丢失，写入频率合理
- **D-12:** 记录对话元数据 — 每次对话记录使用的模型、provider、token 消耗、耗时等元数据，方便统计和调试

### 对话恢复上下文
- **D-13:** 恢复对话时使用用户当前的全局模型配置，而非保存对话时的模型 — 用户可能想用新模型继续旧对话
- **D-14:** 工具调用结果保存并恢复 — 保存工具调用的请求和响应，恢复时作为上下文的一部分，AI 可以引用之前的工具结果
- **D-15:** 页面引用保存快照 — 保存 @ 引用时的页面内容快照，恢复时作为上下文注入，不重新抓取（页面可能已变化）
- **D-16:** 仅手动删除，没有自动清理 — 完全由用户控制对话生命周期

### Claude's Discretion
- conversations 表的索引设计（created_at、updated_at、container_id）由实现者决定
- messages 表的 tool_calls 和 tool_results 字段的 JSON 结构由实现者决定
- 对话列表下拉面板的具体 CSS 样式由实现者决定（遵循现有 AI 面板风格）
- Agent 实例销毁时的资源清理逻辑由实现者决定

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### pi-agent-core SDK
- `node_modules/@earendil-works/pi-agent-core/dist/agent.d.ts` — Agent 类定义，state.messages、reset()、prompt()、waitForIdle() 方法
- `node_modules/@earendil-works/pi-agent-core/dist/types.d.ts` — AgentMessage、AgentState、AgentEvent 类型定义

### 现有代码
- `ai-manager.js` §Agent 初始化 (line 696) — Agent 实例创建模式（streamFn、getApiKey、tools）
- `ai-manager.js` §事件订阅 (line 987) — agent_end 事件处理，消息翻译和广播
- `src/renderer.js` §AI 聊天面板 — 现有 UI 模式（消息渲染、流式输出、面板交互）
- `src/renderer.js` §handleOpenUrlInTab (line 4419) — 新标签页打开模式参考

### 参考实现
- `.planning/phases/41-web-fetch-ui/41-CONTEXT.md` — Phase 41 决策（工具注册模式、IPC 通道模式）
- `.planning/phases/40-web-search/40-CONTEXT.md` — Phase 40 决策（search-manager 架构）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`better-sqlite3`** — 已用于 history.db、favorites.db、downloads.db，ai-conversations.db 复用同一模式
- **`ai-manager.js Agent 初始化`** — 现有 Agent 创建模式（streamFn、getApiKey、tools 配置），新对话复用此模式
- **`src/renderer.js AI 聊天面板`** — 已有消息渲染、流式输出、工具卡片 UI 模式，对话列表复用面板交互风格

### Established Patterns
- **数据库表命名** — 小写 + 下划线（history_{containerId}、favorites、downloads）
- **IPC 通道命名** — `get-xxx` / `set-xxx` / `delete-xxx` 动词-名词格式
- **Agent 事件翻译** — 主进程将 SDK 事件翻译为渲染端 UI 契约后广播

### Integration Points
- **`ai-manager.js`** — 对话管理逻辑在此文件中扩展（新建/切换/保存/加载对话）
- **`ipc-handlers.js`** — 新增对话管理 IPC 通道（get-conversations、create-conversation、delete-conversation、rename-conversation）
- **`src/preload.js`** — 暴露 conversationAPI 给渲染进程
- **`src/renderer.js`** — AI 聊天面板添加对话列表 UI

</code_context>

<specifics>
## Specific Ideas

- 对话列表交互参考 ChatGPT 的侧边栏设计，但嵌入在 AI 面板顶部
- 对话恢复时的页面快照可以复用 @ 引用的现有机制（read_page_content 工具的结果）
- Agent 实例销毁时需要确保 abort() 调用，取消正在进行的 LLM 请求

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-ai-pi-agent*
*Context gathered: 2026-08-28*

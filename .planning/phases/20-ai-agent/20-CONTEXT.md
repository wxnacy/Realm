# Phase 20: AI Agent 集成 - 核心功能 - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段完成 AI Manager 核心模块，注册 Realm 工具，打通 IPC 通信，使 AI Agent 能够调用 Realm 浏览器功能。

**包括：**
- AI Manager 完整实现（初始化、配置管理、事件广播）
- Realm 工具注册（navigate, search_history, manage_favorites, switch_container, get_tabs）
- IPC 通道实现（Agent 事件推送到渲染进程）
- Preload.js API 暴露（AI 相关 API）

**不包括：** AI 聊天 UI（Phase 21）、高级 Agent 功能、多模型切换 UI

</domain>

<decisions>
## Implementation Decisions

### 工具注册策略
- **D-01:** Phase 20 实现全部 5 个工具（navigate, search_history, manage_favorites, switch_container, get_tabs）
- **D-02:** 工具参数设计沿用 pi-agent-integration.md 的定义
- **D-03:** 工具返回格式遵循 SDK 的 `AgentToolResult` 接口（`content` 数组 + `details`）
- **D-04:** 工具错误处理采用 throw Error 方式，让 SDK 自动捕获并设置 `isError: true`

### IPC 事件广播机制
- **D-05:** 全部 Agent 事件广播到渲染进程（agent_start, agent_end, turn_start, turn_end, message_*, tool_execution_*）
- **D-06:** 高频事件（message_update, tool_execution_update）使用 debounce 16ms 批量合并
- **D-07:** 使用 `webContents.send()` 单向推送模式，渲染进程通过 `ipcRenderer.on()` 接收
- **D-08:** 批量事件通道 `ai:events-batch` 用于高频事件批量发送

### 错误处理和降级策略
- **D-09:** 在 AIManager 中统一捕获和处理错误
- **D-10:** 自动重试 3 次，指数退避（1s, 2s, 4s）
- **D-11:** 错误信息在聊天界面显示，用户可以手动重试
- **D-12:** 错误场景包括：API Key 错误、LLM 服务错误、工具执行错误、网络错误

### 上下文管理策略
- **D-13:** 保留全部对话历史，自动触发压缩
- **D-14:** 当 token 数达到上下文窗口的 80% 时触发压缩
- **D-15:** 使用 LLM 自己总结旧对话，生成摘要替代详细内容
- **D-16:** 整体压缩整个对话历史，生成一个摘要

### Claude's Discretion
- AIManager 的具体方法实现细节
- 工具参数的详细定义和返回格式
- 错误消息的具体内容和格式
- 上下文压缩的 prompt 设计

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心集成文档
- `docs/plan/pi-agent-integration.md` — 完整的 Pi Agent SDK 能力边界分析、架构设计、实施路线图。Phase 20 对应其 Phase 2（核心功能）

### 需求文档
- `.planning/REQUIREMENTS.md` — AI-02（AI Manager 核心功能）需求详情
- `.planning/ROADMAP.md` — Phase 20 任务列表和里程碑背景

### 前序阶段上下文
- `.planning/phases/19-ai-agent/19-CONTEXT.md` — Phase 19 决策（AI Agent 基础验证，已完成）

### 现有代码
- `ai-manager.js` — AI Manager 骨架（Phase 19 已实现），Phase 20 需要填充工具逻辑和事件广播
- `main.js` — Electron 主进程，AI Manager 初始化入口
- `src/preload.js` — contextBridge API 暴露，需要添加 AI 相关 API
- `ipc-handlers.js` — IPC 通道注册，需要添加 AI 通道

### 技术参考
- `package.json` — 项目依赖和 Electron 版本配置
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责
- `.planning/codebase/CONVENTIONS.md` — 编码规范

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ai-manager.js` 的 AIManager 类骨架：包含完整类结构、所有方法签名、静态工具注册、事件广播机制
- `main.js` 的应用初始化流程：AIManager 应在 app.whenReady() 后初始化
- `ipc-handlers.js` 的 IPC 注册模式：AI 通道应遵循相同模式（kebab-case、动词-名词格式）
- `electron-store` 配置管理：可直接复用存储 API Key 配置

### Established Patterns
- 模块初始化：各 Manager 在 main.js 中初始化并注入依赖
- 日志前缀：`[Realm]` 标识主进程日志，AI Manager 应使用 `[Realm AI]`
- 错误处理：使用 console.error 记录错误，不使用 try-catch（当前代码）

### Integration Points
- `main.js` 的 app.whenReady()：AIManager 初始化入口
- `ipc-handlers.js`：添加 AI 通道（`ai:prompt`, `ai:abort`, `ai:events-batch`）
- `src/preload.js`：暴露 AI API（`window.realmAPI.ai.prompt()`, `window.realmAPI.ai.onEvent()`）
- `src/renderer.js`：Phase 21 添加 AI 聊天 UI

</code_context>

<specifics>
## Specific Ideas

用户参考成熟 AI Agent 产品的做法：
- 保留全部对话历史，自动触发压缩（类似 Claude、ChatGPT）
- 使用 LLM 自己总结旧对话，生成摘要替代详细内容
- 高频事件使用 debounce 16ms 批量合并（平衡实时性和性能）
- 错误信息在聊天界面显示，用户可以手动重试

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-AI Agent 集成 - 核心功能*
*Context gathered: 2026-08-01*

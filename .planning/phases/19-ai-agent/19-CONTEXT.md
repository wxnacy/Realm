# Phase 19: AI Agent 集成 - 基础验证 - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段验证 pi-agent-core SDK 在 Realm Browser 环境中的可行性，包括：
- Node.js 版本兼容性验证（Electron 内置版本 vs pi-agent-core 要求 >= 22.19.0）
- pi-ai 和 pi-agent-core 依赖安装验证
- AI Manager 骨架模块（ai-manager.js）完整实现
- 最小可行 Demo：Agent + get_tabs 工具执行验证

**不包括**：完整工具集、AI 聊天 UI、IPC 事件广播到渲染进程、API Key 管理 UI

</domain>

<decisions>
## Implementation Decisions

### Node.js 版本兼容方案
- **D-01:** 先验证 Electron 32 内置 Node 版本，再决定方案
- **D-02:** 如果版本满足要求，直接在主进程运行 pi-agent-core
- **D-03:** 如果版本不满足，优先评估升级 Electron 的可行性；如不可行，考虑子进程方案（用系统 Node.js 运行 Agent，通过 IPC 与主进程通信）
- **D-04:** 方案 C（仅用 pi-ai 绕过限制）作为最后备选，因为会丢失 pi-agent-core 的工具系统和状态管理能力

### 最小可行 Demo 范围
- **D-05:** Demo 验证 Agent + get_tabs 工具执行，验证工具系统可用
- **D-06:** Demo 输出到主进程控制台，不涉及渲染进程 UI
- **D-07:** get_tabs 工具应返回当前标签页列表，验证 Agent 可调用 Realm 功能

### AI Manager 骨架设计
- **D-08:** ai-manager.js 采用完整骨架设计，包含完整类结构、所有方法签名、静态工具注册、事件广播机制
- **D-09:** 骨架可直接运行 Demo，Phase 20 只需填充工具逻辑
- **D-10:** AIManager 类包含：init()、prompt()、abort()、_buildRealmTools()、_compactContext() 等方法
- **D-11:** 工具注册采用静态方式，Phase 19 注册 get_tabs，Phase 20 扩展其他工具

### API Key 存储策略
- **D-12:** 使用 electron-store 存储 API Key，与现有容器配置统一
- **D-13:** Phase 19 快速验证，安全性后续增强（Phase 20 或后续版本可考虑加密）
- **D-14:** 初始支持 OpenAI 提供商，其他提供商后续扩展

### Claude's Discretion
- ai-manager.js 的具体方法实现细节
- get_tabs 工具的参数定义和返回格式
- 错误处理和日志输出格式
- Demo 的具体测试用例

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心集成文档
- `docs/plan/pi-agent-integration.md` — 完整的 Pi Agent SDK 能力边界分析、架构设计、实施路线图。Phase 19 对应其 Phase 1（基础验证）

### 需求文档
- `.planning/REQUIREMENTS.md` — AI-01（Node.js 版本验证和基础架构）需求详情
- `.planning/ROADMAP.md` — Phase 19 任务列表和里程碑背景

### 前序阶段上下文
- `.planning/phases/18-bookmarks-bar/18-CONTEXT.md` — Phase 18 决策（收藏栏功能，已完成）

### 现有代码
- `main.js` — Electron 主进程，AI Manager 将在此初始化
- `src/preload.js` — contextBridge API 暴露，后续需添加 AI 相关 API
- `src/renderer.js` — 渲染进程逻辑，Phase 21 添加 AI 聊天 UI
- `ipc-handlers.js` — IPC 通道注册，后续需添加 AI 通道

### 技术参考
- `package.json` — 项目依赖和 Electron 版本配置
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责
- `.planning/codebase/CONVENTIONS.md` — 编码规范

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `main.js` 的应用初始化流程：AIManager 应在 app.whenReady() 后初始化
- `ipc-handlers.js` 的 IPC 注册模式：AI 通道应遵循相同模式（kebab-case、动词-名词格式）
- `electron-store` 配置管理：可直接复用存储 API Key 配置

### Established Patterns
- 模块初始化：各 Manager 在 main.js 中初始化并注入依赖
- 日志前缀：`[Realm]` 标识主进程日志，AI Manager 应使用 `[Realm AI]`
- 错误处理：使用 console.error 记录错误，不使用 try-catch（当前代码）

### Integration Points
- `main.js` 的 app.whenReady()：AIManager 初始化入口
- `ipc-handlers.js`：后续添加 AI 通道（Phase 20）
- `src/preload.js`：后续暴露 AI API（Phase 20）
- `src/renderer.js`：后续添加 AI 聊天 UI（Phase 21）

</code_context>

<specifics>
## Specific Ideas

用户参考 pi-agent-integration.md 的架构设计：
- AI Manager 作为主进程模块，管理 Agent 实例和 LLM 连接
- 工具系统封装 Realm 已有功能（如 get_tabs、navigate、search_history）
- 事件流通过 IPC 广播到渲染进程（Phase 20/21）
- 初始支持 OpenAI 提供商，后续扩展其他提供商

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-AI Agent 集成 - 基础验证*
*Context gathered: 2026-07-31*

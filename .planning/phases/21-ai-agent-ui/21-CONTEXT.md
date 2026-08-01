# Phase 21: AI Agent 集成 - 聊天 UI - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段实现 AI 助手的聊天界面，包括消息列表、输入框、流式渲染、工具执行状态展示，以及面板交互（快捷键唤起、拖拽调整大小、设置集成）。

**包括：**
- AI 聊天面板 UI（右侧侧边栏形态）
- 流式消息渲染（逐字显示 + Markdown + 代码高亮）
- 工具执行状态展示（可折叠卡片）
- 面板交互（快捷键 Cmd+]、拖拽调整宽度、智能滚动）
- 设置集成（AI 助手设置分类）

**不包括：** AI Manager 核心功能（Phase 20 已完成）、工具注册、IPC 事件广播机制

</domain>

<decisions>
## Implementation Decisions

### 面板布局与位置
- **D-01:** 右侧侧边栏形态，不遮挡网页内容（网页区域自动缩小）
- **D-02:** 工具栏最右侧（设置按钮后面）添加 AI 按钮切换面板
- **D-03:** 默认宽度 360px，最小 280px，最大 600px，左侧边缘可拖拽调整
- **D-04:** 记忆面板宽度和开关状态（electron-store 持久化）
- **D-05:** 面板头部包含：标题"AI 助手" + 设置按钮（齿轮图标）+ 关闭按钮

### 消息展示与流式渲染
- **D-06:** 气泡对话样式 — 用户消息靠右（深色气泡），AI 消息靠左（浅色气泡）
- **D-07:** 完整 Markdown 渲染 + 代码语法高亮（需要引入 markdown 渲染库）
- **D-08:** 逐字流式显示（光标闪烁指示正在生成），基于 Phase 20 的 `ai:events-batch` 事件
- **D-09:** 每条消息支持：复制内容、重新生成（AI 消息）

### 工具执行状态展示
- **D-10:** 可折叠卡片形态 — 默认折叠显示工具名 + 状态图标（旋转/成功/失败）
- **D-11:** 点击展开查看工具参数和执行结果
- **D-12:** 多工具调用纵向堆叠，每个工具独立显示状态
- **D-13:** 工具结果在折叠卡片内展示（JSON 或格式化输出）

### 面板交互与快捷键
- **D-14:** Cmd/Ctrl + ] 唤起/隐藏 AI 面板（需在 shortcut-manager.js 注册）
- **D-15:** 自动扩展输入框（多行），Enter 发送，Shift+Enter 换行，底部固定
- **D-16:** 智能自动滚动 — 新消息自动到底部，用户上滚后暂停自动滚动，显示"回到底部"按钮
- **D-17:** 面板左侧边缘可拖拽调整宽度（鼠标悬停显示调整光标）

### Claude's Discretion
- Markdown 渲染库的选择（如 marked、markdown-it 等）
- 代码高亮库的选择（如 highlight.js、Prism 等）
- 消息气泡的具体 CSS 样式和动画效果
- 工具卡片的展开/折叠动画
- 输入框自动扩展的具体实现方式
- 面板打开/关闭的过渡动画

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心集成文档
- `docs/plan/pi-agent-integration.md` — 完整的 Pi Agent SDK 能力边界分析、架构设计、实施路线图。Phase 21 对应其 Phase 3（聊天 UI）

### 需求文档
- `.planning/REQUIREMENTS.md` — AI-03（AI 聊天面板 UI）需求详情
- `.planning/ROADMAP.md` — Phase 21 任务列表和里程碑背景

### 前序阶段上下文
- `.planning/phases/20-ai-agent/20-CONTEXT.md` — Phase 20 决策（AI Manager 核心功能，已完成）
- `.planning/phases/19-ai-agent/19-CONTEXT.md` — Phase 19 决策（AI Agent 基础验证，已完成）

### 现有代码
- `ai-manager.js` — AI Manager 完整实现（Phase 19-20），包含 Agent 实例管理、工具注册、事件广播
- `main.js` — Electron 主进程，AI Manager 初始化入口，IPC 通道注册
- `src/preload.js` — contextBridge API 暴露，已包含 AI 相关 API（prompt, abort, onEvent, configureProviders, getAvailableModels）
- `src/renderer.js` — 渲染进程逻辑，Phase 21 需要添加 AI 聊天 UI
- `src/index.html` — 主界面结构，需要添加 AI 面板 HTML
- `src/styles/main.css` — 样式文件，需要添加 AI 面板样式
- `shortcut-manager.js` — 快捷键管理，需要注册 Cmd+] 快捷键

### 技术参考
- `package.json` — 项目依赖和 Electron 版本配置
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责
- `.planning/codebase/CONVENTIONS.md` — 编码规范
- `.planning/codebase/STRUCTURE.md` — 代码结构和文件组织

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ai-manager.js` 的 AIManager 类：包含 prompt()、abort()、事件广播机制，Phase 21 直接调用
- `src/preload.js` 的 AI API：`window.realmAPI.ai.prompt()`、`window.realmAPI.ai.onEvent()` 已暴露
- `ipc-handlers.js` 的 IPC 注册模式：AI 通道已注册（`ai:prompt`、`ai:abort`、`ai:events-batch`）
- `shortcut-manager.js` 的快捷键注册机制：可直接添加新快捷键
- `electron-store` 配置管理：可复用存储面板宽度和开关状态

### Established Patterns
- 模块初始化：各 Manager 在 main.js 中初始化并注入依赖
- 日志前缀：`[Realm]` 标识主进程日志，`[Realm Renderer]` 标识渲染进程日志
- DOM 操作：集中在 `elements` 对象中管理，使用 `document.getElementById`
- 事件监听：在 `setupEventListeners()` 函数中集中绑定
- 状态管理：使用全局 `state` 对象存储应用状态

### Integration Points
- `src/renderer.js` 的 `setupEventListeners()`：添加 AI 面板事件监听
- `src/renderer.js` 的 `initShortcuts()`：添加 Cmd+] 快捷键处理
- `src/index.html` 的 `<body>`：添加 AI 面板 HTML 结构
- `src/styles/main.css`：添加 AI 面板样式
- `shortcut-manager.js` 的 `DEFAULT_SHORTCUTS`：注册 `toggleAIPanel: 'CmdOrCtrl+]'`

</code_context>

<specifics>
## Specific Ideas

用户参考成熟 AI 聊天产品的交互模式：
- 气泡对话样式（类似 iMessage/微信）
- 逐字流式显示（类似 ChatGPT）
- 可折叠工具卡片（类似 Claude Code 的工具调用展示）
- 智能自动滚动（用户上滚后暂停，显示"回到底部"按钮）

面板设计要点：
- 右侧侧边栏，不遮挡网页内容
- 工具栏最右侧（设置按钮后面）添加 AI 按钮
- Cmd + ] 快捷键唤起/隐藏
- 记忆面板宽度和开关状态

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-AI Agent 集成 - 聊天 UI*
*Context gathered: 2026-08-01*

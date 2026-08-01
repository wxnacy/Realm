# Phase 20: AI Agent 集成 - 核心功能 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 20-AI Agent 集成 - 核心功能
**Areas discussed:** 工具注册策略, IPC 事件广播机制, 错误处理和降级策略, 上下文管理策略

---

## 工具注册策略

| Option | Description | Selected |
|--------|-------------|----------|
| 全部 5 个（推荐） | 按 pi-agent-integration.md 设计，5 个工具全部实现 | ✓ |
| 核心 3 个优先 | 先实现 get_tabs、navigate、search_history，其他后续补充 | |
| 让我选择 | 根据实际需求灵活调整 | |

**User's choice:** 全部 5 个（推荐）
**Notes:** Phase 20 实现全部 5 个工具（navigate, search_history, manage_favorites, switch_container, get_tabs）

| Option | Description | Selected |
|--------|-------------|----------|
| 沿用现有设计（推荐） | 按 pi-agent-integration.md 的设计，如 navigate: { url, containerId?, newTab? } | ✓ |
| 基于实际调整 | 根据 Phase 19 的 get_tabs 实际实现经验调整 | |
| 让我查看现有设计 | 需要更详细的参数说明 | |

**User's choice:** 沿用现有设计（推荐）
**Notes:** 工具参数设计沿用 pi-agent-integration.md 的定义

| Option | Description | Selected |
|--------|-------------|----------|
| 遵循 SDK 规范（推荐） | 遵循 pi-agent-core 的 AgentTool 接口规范（content 数组 + details） | ✓ |
| 查看 SDK 文档 | 需要查看 pi-agent-core 的工具返回文档 | |
| 其他方案 | 有其他想法 | |

**User's choice:** 遵循 SDK 规范（推荐）
**Notes:** 工具返回格式遵循 SDK 的 AgentToolResult 接口（content 数组 + details）

| Option | Description | Selected |
|--------|-------------|----------|
| throw Error（推荐） | 工具 throw Error，SDK 自动捕获并设置 isError: true | ✓ |
| 继续查看 | 需要查看更多 SDK 文档 | |
| 其他问题 | 还有其他问题 | |

**User's choice:** 继续查看 → throw Error（推荐）
**Notes:** 查看了 SDK 的 execute 函数签名和注释："Throw on failure instead of encoding errors in content." 确认工具应该 throw Error，SDK 会自动处理

---

## IPC 事件广播机制

| Option | Description | Selected |
|--------|-------------|----------|
| 全部事件（推荐） | 所有事件实时推送到渲染进程，渲染进程自行过滤 | ✓ |
| 关键事件 | 只推送 message_update、tool_execution_*、agent_end 等关键事件 | |
| 查看现有实现 | 需要先查看 Phase 19 的事件处理实现 | |

**User's choice:** 全部事件（推荐）
**Notes:** 全部 Agent 事件广播到渲染进程

| Option | Description | Selected |
|--------|-------------|----------|
| debounce 16ms（推荐） | 累积事件，每 16ms 发送一次，平衡实时性和性能 | ✓ |
| RAF 同步 | 使用 requestAnimationFrame 合并，与渲染帧同步 | |
| 立即发送 | 每个事件立即发送，最简单实现 | |

**User's choice:** 查看事件频率 → debounce 16ms（推荐）
**Notes:** 查看了 pi-ai 的 AssistantMessageEvent 类型，确认 text_delta 事件会非常频繁。使用 debounce 16ms 批量合并高频事件

| Option | Description | Selected |
|--------|-------------|----------|
| IPC 推送 + debounce（推荐） | 使用 webContents.send() 推送，高频事件 debounce 16ms，简单可靠 | ✓ |
| 本地 SSE 服务 | 主进程启动本地 HTTP 服务，渲染进程通过 SSE 连接获取事件 | |
| 继续研究 | 需要了解更多细节 | |

**User's choice:** 了解成熟产品做法 → IPC 推送 + debounce（推荐）
**Notes:** 研究了 Claude Desktop、Cursor、Continue.dev 等成熟产品的做法，确认使用 webContents.send() 单向推送模式

| Option | Description | Selected |
|--------|-------------|----------|
| webContents.send（推荐） | 使用 webContents.send() 推送事件，渲染进程通过 ipcRenderer.on() 接收 | ✓ |
| 查看现有模式 | 需要查看更多 Realm 现有 IPC 模式 | |
| 其他问题 | 还有其他问题 | |

**User's choice:** webContents.send（推荐）
**Notes:** 确认使用 webContents.send() 单向推送模式

---

## 错误处理和降级策略

| Option | Description | Selected |
|--------|-------------|----------|
| API Key 错误 | API Key 无效、过期或配额耗尽 | ✓ |
| LLM 服务错误 | LLM 服务不可用或响应超时 | ✓ |
| 工具执行错误 | 工具执行失败（如导航不存在的 URL） | ✓ |
| 网络错误 | 网络连接中断 | ✓ |

**User's choice:** 全部选择
**Notes:** 所有错误场景都需要处理

| Option | Description | Selected |
|--------|-------------|----------|
| 统一错误处理（推荐） | 在 AIManager 中统一捕获错误，转换为用户友好的消息 | ✓ |
| 工具级别处理 | 每个工具自己处理错误 | |
| 渲染进程处理 | 渲染进程处理 UI 相关错误 | |

**User's choice:** 统一错误处理（推荐）
**Notes:** 在 AIManager 中统一捕获和处理错误

| Option | Description | Selected |
|--------|-------------|----------|
| 自动重试（推荐） | 自动重试 3 次，每次间隔指数退避 | ✓ |
| 手动重试 | 直接显示错误，让用户手动重试 | |
| 智能重试 | 根据错误类型决定是否重试 | |

**User's choice:** 自动重试（推荐）
**Notes:** 自动重试 3 次，指数退避（1s, 2s, 4s）

| Option | Description | Selected |
|--------|-------------|----------|
| 聊天界面显示（推荐） | 在聊天界面显示错误消息，用户可以重试 | ✓ |
| Toast 通知 | 使用 toast 通知显示错误 | |
| 弹窗 | 弹窗显示错误详情 | |

**User's choice:** 聊天界面显示（推荐）
**Notes:** 错误信息在聊天界面显示，用户可以手动重试

---

## 上下文管理策略

| Option | Description | Selected |
|--------|-------------|----------|
| 自动压缩（推荐） | 保留全部对话历史，接近限制时自动触发压缩，生成摘要替代旧消息 | ✓ |
| 手动压缩 | 保留全部历史，用户手动触发压缩 | |
| 自动截断 | 保留全部历史，超出限制时自动截断最旧消息 | |

**User's choice:** 自动压缩（推荐）
**Notes:** 保留全部对话历史，自动触发压缩（类似 Claude、ChatGPT 做法）

| Option | Description | Selected |
|--------|-------------|----------|
| 80% 阈值（推荐） | 当 token 数达到上下文窗口的 80% 时触发 | ✓ |
| 90% 阈值 | 当 token 数达到上下文窗口的 90% 时触发 | |
| 动态阈值 | 根据剩余空间动态决定 | |

**User's choice:** 80% 阈值（推荐）
**Notes:** 当 token 数达到上下文窗口的 80% 时触发压缩

| Option | Description | Selected |
|--------|-------------|----------|
| LLM 摘要（推荐） | 使用 LLM 自己总结旧对话，生成摘要替代详细内容 | ✓ |
| 简单截断 | 简单截断旧消息，保留最近 N 条 | |
| 智能保留 | 保留关键信息（工具调用、决策），丢弃普通对话 | |

**User's choice:** LLM 摘要（推荐）
**Notes:** 使用 LLM 自己总结旧对话，生成摘要替代详细内容

| Option | Description | Selected |
|--------|-------------|----------|
| 整体压缩（推荐） | 压缩整个对话历史，生成一个摘要 | ✓ |
| 分段压缩 | 每次压缩最近的 N 条消息 | |
| 选择性压缩 | 根据消息重要性选择性压缩 | |

**User's choice:** 整体压缩（推荐）
**Notes:** 整体压缩整个对话历史，生成一个摘要

---

## Claude's Discretion

无 — 所有决策都由用户明确选择

## Deferred Ideas

None — discussion stayed within phase scope

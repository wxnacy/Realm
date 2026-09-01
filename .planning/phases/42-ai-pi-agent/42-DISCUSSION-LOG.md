# Phase 42: AI 历史对话功能调研与 pi-agent 集成方案 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 42-ai-pi-agent
**Areas discussed:** 对话存储方案, 对话管理 UI, pi-agent 集成方式, 对话恢复上下文

---

## 对话存储方案

### 存储位置

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite (history.db) | 复用现有 history.db，新建 conversations 表 | |
| SQLite (独立数据库) | 新建独立的 ai-conversations.db，隔离清晰 | ✓ |
| JSON 文件 (electron-store) | 类似 cookies.json 的文件存储方案 | |

**User's choice:** SQLite (独立数据库)
**Notes:** AI 对话数据独立管理，不影响现有数据库结构

### 表结构设计

| Option | Description | Selected |
|--------|-------------|----------|
| 两表设计 (推荐) | conversations + messages 分离，查询灵活 | ✓ |
| 单表 + JSON 字段 | conversations 表，messages 用 JSON 字段存储 | |

**User's choice:** 两表设计 (推荐)
**Notes:** 对话元数据和消息分离，便于查询和统计

### 容器关系

| Option | Description | Selected |
|--------|-------------|----------|
| 对话跟随容器 (推荐) | 每个对话绑定一个容器，容器删除时对话也删除 | |
| 对话全局共享 | 对话全局共享，不属于任何容器 | ✓ |

**User's choice:** 对话全局共享
**Notes:** 与收藏夹设计一致（Phase 9 决策）

### 标题生成

| Option | Description | Selected |
|--------|-------------|----------|
| 首条消息截取 (推荐) | 第一条用户消息的前 20-30 个字符 | ✓ |
| LLM 生成 | 用 LLM 生成对话标题 | |
| 手动 + 时间戳 | 默认显示时间戳，用户可以手动重命名 | |

**User's choice:** 首条消息截取 + 支持手动重命名
**Notes:** 默认截取首条消息，同时支持用户手动重命名

---

## 对话管理 UI

### UI 位置

| Option | Description | Selected |
|--------|-------------|----------|
| 聊天面板内嵌 (推荐) | AI 聊天面板顶部添加历史按钮，展开对话列表 | ✓ |
| 独立侧边栏 | 类似 ChatGPT 的侧边栏设计 | |
| 独立页面 (realm://) | 新建 realm://conversations 页面 | |

**User's choice:** 聊天面板内嵌 (推荐)
**Notes:** 不需要额外的页面或弹窗，交互更直接

### 新建对话

| Option | Description | Selected |
|--------|-------------|----------|
| 自动新建 + 按钮 (推荐) | 每次打开 AI 面板自动新建 + 显式按钮 | ✓ |
| 仅按钮触发 | 只在用户点击按钮时新建 | |

**User's choice:** 自动新建 + 按钮 (推荐)
**Notes:** 类似 ChatGPT 的体验

### 切换行为

| Option | Description | Selected |
|--------|-------------|----------|
| 自动保存 + 加载 (推荐) | 自动保存当前对话，然后加载目标对话 | ✓ |
| 提示确认 | 如果有未保存内容，提示用户确认 | |

**User's choice:** 自动保存 + 加载 (推荐)
**Notes:** 无缝切换，不丢失任何数据

### 删除对话

| Option | Description | Selected |
|--------|-------------|----------|
| 右键菜单 + 确认 (推荐) | 右键显示菜单，选择删除后弹出确认对话框 | ✓ |
| 图标直接删除 | 对话项上显示删除图标，点击后直接删除 | |

**User's choice:** 右键菜单 + 确认 (推荐)
**Notes:** 防止误删

---

## pi-agent 集成方式

### Agent 实例

| Option | Description | Selected |
|--------|-------------|----------|
| 一对话一实例 (推荐) | 每个对话对应一个 Agent 实例，切换时销毁重建 | ✓ |
| 单例 + reset() | 全局单例 Agent，切换时用 reset() 清空状态 | |

**User's choice:** 一对话一实例 (推荐)
**Notes:** 简单清晰，避免 reset() 状态恢复的复杂性

### 消息加载

| Option | Description | Selected |
|--------|-------------|----------|
| prompt() 注入 (推荐) | 创建 Agent 后，用 prompt() 注入历史消息 | ✓ |
| transformContext 回调 | 利用 Agent 的回调动态注入历史消息 | |

**User's choice:** prompt() 注入 (推荐)
**Notes:** Agent 将历史消息视为上下文的一部分

### 保存时机

| Option | Description | Selected |
|--------|-------------|----------|
| 每轮结束保存 (推荐) | agent_end 事件后将消息写入数据库 | ✓ |
| 面板关闭时保存 | 用户关闭面板或切换对话时才保存 | |
| 实时保存 | 每条消息到达时立即写入数据库 | |

**User's choice:** 每轮结束保存 (推荐)
**Notes:** 保证数据不丢失，写入频率合理

### 元数据记录

| Option | Description | Selected |
|--------|-------------|----------|
| 记录元数据 (推荐) | 记录模型、token 消耗、耗时等元数据 | ✓ |
| 仅消息内容 | 只记录消息内容，不记录额外元数据 | |

**User's choice:** 记录元数据 (推荐)
**Notes:** 方便统计和调试

---

## 对话恢复上下文

### 模型恢复

| Option | Description | Selected |
|--------|-------------|----------|
| 恢复原始模型 (推荐) | 使用保存对话时的模型配置恢复 | |
| 使用当前配置 | 使用用户当前的全局模型配置 | ✓ |

**User's choice:** 使用当前配置
**Notes:** 用户可能想用新模型继续旧对话

### 工具结果

| Option | Description | Selected |
|--------|-------------|----------|
| 保存并恢复 (推荐) | 保存工具调用的请求和响应，恢复时作为上下文 | ✓ |
| 仅文本消息 | 只保存用户和 AI 的文本消息 | |

**User's choice:** 保存并恢复 (推荐)
**Notes:** AI 可以引用之前的工具结果

### 页面引用

| Option | Description | Selected |
|--------|-------------|----------|
| 保存快照 (推荐) | 保存引用时的页面快照，恢复时作为上下文 | ✓ |
| 重新抓取 | 恢复时重新抓取引用页面的当前内容 | |
| 标记过期 | 标记引用已过期，提示用户是否刷新 | |

**User's choice:** 保存快照 (推荐)
**Notes:** 页面可能已变化，保存快照保证一致性

### 清理策略

| Option | Description | Selected |
|--------|-------------|----------|
| 仅手动删除 (推荐) | 用户可以手动删除对话，没有自动清理 | ✓ |
| 数量上限 + 自动清理 | 设置中添加最大对话数量，超过时自动删除 | |

**User's choice:** 仅手动删除 (推荐)
**Notes:** 完全由用户控制对话生命周期

---

## Claude's Discretion

- conversations 表的索引设计由实现者决定
- messages 表的 tool_calls 和 tool_results 字段的 JSON 结构由实现者决定
- 对话列表下拉面板的具体 CSS 样式由实现者决定
- Agent 实例销毁时的资源清理逻辑由实现者决定

## Deferred Ideas

None — discussion stayed within phase scope

---
phase: 20
slug: ai-agent-core
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-01
---

# Phase 20 -- UI Design Contract

> AI Agent 集成 - 核心功能。Phase 20 以后端为主，UI 合约聚焦于设置页面扩展和 Phase 21 消费的 API 接口定义。

---

## Phase Scope

Phase 20 实现 AI Manager 核心模块、Realm 工具注册、IPC 通信。**不包含聊天 UI（Phase 21）**。

本合约定义：
1. 设置页面 "AI 助手" 分区的视觉规范
2. Phase 21 消费的 Preload API 接口契约
3. IPC 事件格式契约（Agent 事件广播）

---

## Design System

从 `src/styles/main.css` 已有设计系统提取：

| Property | Value | Source |
|----------|-------|--------|
| Tool | none | 项目未使用 shadcn，原生 CSS + HTML |
| Preset | not applicable | -- |
| Component library | none | 原生 DOM 操作 |
| Icon library | none（内联 SVG） | 项目使用内联 SVG 图标 |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif | main.css :root |

---

## Spacing Scale

沿用项目既有 token（main.css 变量）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 图标内间距 |
| sm | 8px | 按钮间距、紧凑布局 |
| md | 16px | 设置项间距、输入框内边距 |
| lg | 24px | 区块分隔 |
| xl | 32px | 设置面板内边距 |
| 2xl | 48px | 主要分隔线 |
| 3xl | 64px | 未使用 |

Exceptions: none

---

## Typography

沿用项目既有字号体系（main.css）：

| Role | Size | Weight | Line Height | Source |
|------|------|--------|-------------|--------|
| Body | 14px | 500 | 1.4 | main.css `.container-name` |
| Label | 12px | 400 | 1.4 | main.css `.container-status`, `.indicator-text` |
| Heading | 18px | 600 | 1.3 | main.css `.logo-text` |
| Display | 32px | 600 | 1.2 | main.css `.welcome-content h1` |

---

## Color

沿用项目深色主题变量（main.css `:root`）：

| Role | Value | Variable | Usage |
|------|-------|----------|-------|
| Dominant (60%) | #1a1a1a | `--bg-primary` | 页面背景、主内容区 |
| Secondary (30%) | #2a2a2a | `--bg-secondary` | 侧边栏、工具栏、设置面板 |
| Tertiary | #3a3a3a | `--bg-tertiary` | 输入框背景、卡片、高亮行 |
| Hover | #404040 | `--bg-hover` | 悬停状态、边框 |
| Accent (10%) | #3B82F6 | `--accent-color` | 选中态、焦点边框、链接 |
| Destructive | #EF4444 | `--danger-color` | 删除、错误状态 |
| Success | #10B981 | `--success-color` | 成功状态、已连接指示 |

**Accent reserved for:**
- 输入框焦点边框 (`:focus` border-color)
- 当前选中容器指示点
- 开关激活态
- AI 连接状态指示器（已连接）
- 发送按钮激活态

---

## Component Inventory: Settings AI Section

Phase 20 需要在设置页面新增 "AI 助手" 分区。沿用现有设置页面模式（`.settings-page` / `.settings-section` / `.settings-group` / `.settings-item`）。

### Settings Sidebar Entry

新增设置侧边栏项目 "AI 助手"，与现有 "快捷键设置"、"收藏栏" 等同级。

```
[设置侧边栏]
  ├─ 基础设置
  ├─ 快捷键设置
  ├─ 收藏栏
  ├─ AI 助手       <-- 新增
  └─ 开发者模式
```

**CSS class**: `.settings-sidebar-item`（沿用现有模式）
**Icon**: 内联 SVG，使用 `--text-secondary` 颜色，激活时使用 `--accent-color`

### Settings Content: AI 助手

#### Group: API 配置

| 设置项 | 控件类型 | 说明 |
|--------|----------|------|
| API Key | password input | 脱敏显示，点击可查看 |
| 模型选择 | select dropdown | 从 `ai:get-models` 获取列表 |

**API Key 输入框规范**:
- 类型: `type="password"`，带 "显示/隐藏" 切换按钮
- 背景: `--bg-tertiary`
- 边框: `--border-color`，焦点时 `--accent-color`
- 圆角: 6px（沿用 `.url-input`）
- 高度: 32px（沿用 `.url-input`）
- 字号: 13px

**模型选择下拉框规范**:
- 沿用 `.settings-select` 样式
- 背景: `--bg-tertiary`
- 文字: `--text-primary`
- 圆角: 6px

#### Group: 连接状态

| 状态 | 指示器颜色 | 文字 |
|------|-----------|------|
| 已连接 | `--success-color` (#10B981) | "已连接" |
| 未配置 | `--text-muted` (#6b7280) | "未配置 API Key" |
| 连接错误 | `--danger-color` (#EF4444) | "连接失败：{错误信息}" |

**状态指示器规范**:
- 圆点: 8px x 8px，`border-radius: 50%`
- 文字: 12px，颜色同圆点
- 布局: 水平排列，gap 6px（沿用 `.container-indicator` 模式）

---

## IPC Event Contract

Phase 21 消费的 Agent 事件格式。事件通过 `ai:events-batch` 通道批量发送。

### 事件类型定义

```javascript
/**
 * Agent 事件基础结构
 * @typedef {Object} AgentEvent
 * @property {string} type - 事件类型
 * @property {number} timestamp - 事件时间戳
 * @property {*} payload - 事件数据
 */
```

### 事件类型清单

| 事件类型 | 触发时机 | payload 结构 |
|---------|---------|-------------|
| `agent_start` | Agent 开始处理 | `{}` |
| `agent_end` | Agent 完成所有处理 | `{ duration: number }` |
| `turn_start` | 一轮对话开始 | `{ turnIndex: number }` |
| `turn_end` | 一轮对话结束 | `{ turnIndex: number }` |
| `message_start` | AI 开始生成回复 | `{ messageId: string }` |
| `message_update` | 流式文本更新 | `{ messageId: string, delta: string }` |
| `message_end` | AI 回复完成 | `{ messageId: string, fullText: string }` |
| `tool_execution_start` | 工具开始执行 | `{ toolName: string, args: object }` |
| `tool_execution_update` | 工具执行进度 | `{ toolName: string, progress?: string }` |
| `tool_execution_end` | 工具执行完成 | `{ toolName: string, result: object, error?: string }` |
| `error` | 发生错误 | `{ message: string, code?: string, retryable: boolean }` |

### 批量事件格式

```javascript
/**
 * 批量事件通道消息格式
 * 通过 'ai:events-batch' 通道发送
 */
{
  events: AgentEvent[]  // 合并后的事件数组
}
```

---

## Preload API Contract

Phase 21 通过 `window.realmAPI.ai` 调用的接口。

```javascript
/**
 * AI 相关 API（暴露到渲染进程）
 * @namespace window.realmAPI.ai
 */
window.realmAPI.ai = {
  /**
   * 发送用户消息给 AI Agent
   * @param {string} message - 用户输入的消息
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  prompt: (message) => ipcRenderer.invoke('ai:prompt', message),

  /**
   * 取消当前 Agent 执行
   * @returns {Promise<{success: boolean}>}
   */
  abort: () => ipcRenderer.invoke('ai:abort'),

  /**
   * 监听 Agent 事件（批量）
   * @param {function} callback - 接收事件数组的回调
   * @returns {function} 取消监听的清理函数
   */
  onEventsBatch: (callback) => {
    ipcRenderer.on('ai:events-batch', (_, data) => callback(data.events));
    return () => ipcRenderer.removeAllListeners('ai:events-batch');
  },

  /**
   * 配置 AI 提供商 API Key
   * @param {Object} config - { provider: string, apiKey: string }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  configureProviders: (config) => ipcRenderer.invoke('ai:configure', config),

  /**
   * 获取可用模型列表
   * @returns {Promise<{models: Array<{provider: string, id: string, name: string}>}>}
   */
  getAvailableModels: () => ipcRenderer.invoke('ai:get-models'),

  /**
   * 获取当前 Agent 状态
   * @returns {Promise<{initialized: boolean, model: string|null, toolsCount: number}>}
   */
  getState: () => ipcRenderer.invoke('ai:get-state'),
};
```

---

## Copywriting Contract

Phase 20 涉及的 UI 文案（设置页面）：

| Element | Copy |
|---------|------|
| Settings sidebar label | AI 助手 |
| Section title | AI 助手配置 |
| API Key label | API Key |
| API Key placeholder | 输入你的 OpenAI API Key |
| Model label | 默认模型 |
| Model placeholder | 选择模型 |
| Save button | 保存配置 |
| Save success | 配置已保存 |
| Save error | 保存失败：{error message} |
| Empty API Key warning | 请先配置 API Key 以启用 AI 助手 |
| Connection status (connected) | 已连接 |
| Connection status (unconfigured) | 未配置 API Key |
| Connection status (error) | 连接失败：{error message} |
| Destructive confirmation | 不适用（Phase 20 无破坏性操作） |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | not applicable | 项目未使用 shadcn |
| third-party | none | -- |

---

## Existing Patterns to Reuse

| Pattern | Location | Apply To |
|---------|----------|----------|
| Settings page layout | `.settings-page`, `.settings-sidebar`, `.settings-content` | AI 助手设置分区 |
| Settings item row | `.settings-item`, `.settings-item label` | API Key、模型选择 |
| Select dropdown | `.settings-select` | 模型选择 |
| Status indicator | `.container-indicator` | 连接状态指示器 |
| Toggle switch | existing settings page pattern | 启用/禁用开关 |
| IPC handler pattern | `ipc-handlers.js` kebab-case | AI IPC 通道注册 |
| Preload API pattern | `src/preload.js` contextBridge | AI API 暴露 |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

*Phase: 20 -- AI Agent 集成 - 核心功能*
*Generated: 2026-08-01*
*Design System: none (native CSS, dark theme)*

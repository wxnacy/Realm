---
phase: 20-ai-agent
plan: 02
subsystem: ai
tags: [electron, ai-agent, ipc, preload, settings, ui]

# Dependency graph
requires:
  - phase: 20-ai-agent
    plan: 01
    provides: AI Manager 完整方法和事件广播机制
provides:
  - AI IPC 通道（ai:prompt, ai:abort, ai:configure, ai:get-models, ai:get-state）
  - Preload AI API（window.realmAPI.ai）
  - 设置页面 "AI 助手" 分区（API Key 配置、模型选择、连接状态）
  - HTTP API 端点（/api/settings/ai/*）
affects: [21-ai-agent]

# Tech tracking
tech-stack:
  added: []
  patterns: [IPC 通道注册模式, HTTP API 设置路由, contextBridge API 暴露]

key-files:
  created: []
  modified: [ipc-handlers.js, src/preload.js, src/settings.html, src/settings-page.js, src/styles/main.css, main.js]

key-decisions:
  - "使用 setAIManager 注入模式：main.js 初始化完成后注入 IPC 处理器，避免重复实例化"
  - "设置页面走 HTTP API 而非 IPC：webview guest 无法通过 contextBridge 调用 IPC"
  - "AI 状态和模型列表通过 HTTP API 提供：/api/settings/ai/state, /api/settings/ai/models"

patterns-established:
  - "AI IPC 注入模式: setAIManager setter 延迟注入实例"
  - "设置页面 HTTP API 模式: webview 通过 /api/settings/* 访问主进程数据"

requirements-completed: [AI-02]

# Coverage metadata
coverage:
  - id: C1
    description: "5 个 AI IPC 通道注册（ai:prompt, ai:abort, ai:configure, ai:get-models, ai:get-state）"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "grep -c 'ai:prompt\\|ai:abort\\|ai:configure\\|ai:get-models\\|ai:get-state' ipc-handlers.js"
        status: pass
    human_judgment: false
  - id: C2
    description: "Preload AI API 暴露（window.realmAPI.ai）"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "grep -c 'ai:' src/preload.js"
        status: pass
    human_judgment: false
  - id: C3
    description: "设置页面 AI 助手分区"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "grep -c 'settings-ai-assistant' src/settings.html"
        status: pass
    human_judgment: false
  - id: C4
    description: "AI 设置样式"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "grep -c 'ai-status-dot' src/styles/main.css"
        status: pass
    human_judgment: false
  - id: C5
    description: "AI 设置页面逻辑"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "grep -c 'loadAISettings' src/settings-page.js"
        status: pass
    human_judgment: false
---

# Phase 20 Plan 02: AI IPC 通道与设置页面 Summary

**One-liner:** 注册 AI IPC 通道，暴露 Preload API，添加设置页面 "AI 助手" 分区，打通渲染进程与 AI Manager 通信

## What Was Built

### Task 1: 注册 AI IPC 通道

在 `ipc-handlers.js` 中注册 5 个 AI 相关 IPC 通道：

- `ai:prompt` - 发送用户消息给 AI Agent
- `ai:abort` - 取消当前 AI 操作
- `ai:configure` - 配置 API Key
- `ai:get-models` - 获取可用模型列表
- `ai:get-state` - 获取 AI Manager 状态

每个通道都调用 `assertTrustedSender(event)` 验证来源安全。

使用 `setAIManager` 注入模式：main.js 初始化 AIManager 完成后，通过 setter 注入到 IPC 处理器模块，避免重复实例化。

### Task 2: 暴露 Preload.js AI API

在 `src/preload.js` 的 `contextBridge.exposeInMainWorld` 中添加 `ai` 命名空间，包含 6 个方法：

- `prompt(message)` - 发送消息
- `abort()` - 取消操作
- `onEventsBatch(callback)` - 监听批量事件（返回清理函数）
- `configureProviders(config)` - 配置提供商
- `getAvailableModels()` - 获取模型列表
- `getState()` - 获取状态

### Task 3: 添加设置页面 "AI 助手" 分区

**重要发现：** 设置页面是通过 `realm://settings` 加载的 webview，使用 HTTP API 而非 IPC。因此：
- 修改的是 `src/settings.html`（不是 `src/index.html`）
- 修改的是 `src/settings-page.js`（不是 `src/renderer.js`）
- 添加了 HTTP API 端点（`/api/settings/ai/*`）

实现内容：
- 侧边栏新增 "AI 助手" 入口（齿轮图标）
- API 配置组：密码输入框、模型选择下拉框、保存按钮
- 连接状态组：状态指示器（圆点 + 文字）
- HTTP API 端点：`ai/state`、`ai/models`、`ai/configure`
- API Key 显示/隐藏切换功能

## Deviations from Plan

### Deviation 1: 设置页面文件路径调整

- **Plan assumed:** `src/index.html`, `src/renderer.js`
- **Actual:** `src/settings.html`, `src/settings-page.js`
- **Reason:** 设置页面是 webview（`realm://settings`），不是主窗口的一部分。webview 无法使用 IPC，必须通过 HTTP API 访问主进程数据。
- **Impact:** 无功能影响，只是文件路径不同

### Deviation 2: HTTP API 替代 IPC

- **Plan assumed:** 渲染进程直接调用 `window.realmAPI.ai.*`
- **Actual:** 设置页面通过 HTTP API (`/api/settings/ai/*`) 访问
- **Reason:** webview guest 的 IPC 调用会被 `assertTrustedSender` 拒绝（CR-4 安全策略）
- **Impact:** Preload API 仍然保留给主窗口渲染进程和 Phase 21 聊天面板使用

### Deviation 3: setAIManager 注入模式

- **Plan assumed:** `initAIManager(configStore)` 在 ipc-handlers.js 中创建实例
- **Actual:** 使用 `setAIManager` setter 从 main.js 注入已初始化的实例
- **Reason:** main.js 已有 AIManager 初始化代码，避免重复实例化
- **Impact:** 功能等价，代码更简洁

## Auth Gates

None - 无认证门控

## Known Stubs

None - 所有功能完整实现

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-20-04 | ipc-handlers.js | API Key 通过 IPC 传输，使用 assertTrustedSender 验证来源 |
| T-20-05 | src/settings.html | API Key 输入框使用 type="password"，切换显示时临时变为 type="text" |

## Self-Check: PASSED

All created files exist. All commits verified:
- b7374fa: feat(20-02): register AI IPC channels in ipc-handlers.js
- e637d24: feat(20-02): expose AI API in preload.js contextBridge
- 5c6f930: feat(20-02): add AI assistant settings page section

---
phase: 21
plan: 01
subsystem: ai-chat-ui
tags: [ai, chat, ui, electron, renderer]
dependency_graph:
  requires: [20-01, 20-02]
  provides: [ai-panel-framework]
  affects: [21-02]
tech_stack:
  added: [marked, highlight.js]
  patterns: [dom-manipulation, ipc-events, css-transitions]
key_files:
  created: []
  modified:
    - package.json
    - shortcut-manager.js
    - src/index.html
    - src/styles/main.css
    - src/renderer.js
decisions:
  - "使用 marked + highlight.js 实现 Markdown 渲染和代码高亮（D-07）"
  - "面板使用 CSS width + opacity 过渡动画（250ms ease-in-out）"
  - "流式光标使用 CSS animation step-end 闪烁效果"
  - "拖拽调整宽度通过 mousedown/mousemove/mouseup 事件实现"
metrics:
  duration: ~10m
  completed: "2026-08-01T09:40:00Z"
status: complete
---

# Phase 21 Plan 01: AI 聊天面板基础框架 Summary

**One-liner:** AI 聊天面板基础框架：面板开关 + 消息气泡渲染 + Markdown/代码高亮 + 流式输出 + 智能滚动 + 拖拽调整宽度

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | 安装依赖并注册快捷键 | d2ade8a | package.json, shortcut-manager.js |
| 2 | 添加 AI 面板 HTML 结构和基础样式 | 9ad8c46 | src/index.html, src/styles/main.css |
| 3 | 实现 AI 面板基础逻辑 | 49f1fec | src/renderer.js |

## What Was Built

### Task 1: 安装依赖并注册快捷键
- 安装 `marked ^18` 和 `highlight.js ^11` 依赖
- 在 `shortcut-manager.js` 的 `DEFAULT_SHORTCUTS` 中注册 `toggleAIPanel: 'CmdOrCtrl+]'`

### Task 2: AI 面板 HTML 结构和 CSS 样式
- 在工具栏添加 `#aiPanelBtn`（AI 助手按钮）
- 在 `</body>` 前添加 `#aiPanel` 容器，包含：
  - `#aiPanelHeader`（标题 + 关闭按钮）
  - `#aiMessageList`（消息列表区域）
  - `#aiInputArea`（输入框 + 发送按钮）
  - `#aiScrollToBottom`（回到底部按钮，默认隐藏）
  - `#aiPanelResizeHandle`（拖拽调整手柄）
- CSS 变量定义面板尺寸（360px 默认宽度，280px-600px 范围）
- 消息气泡样式：用户消息靠右蓝色，AI 消息靠左深色
- 面板打开/关闭过渡动画（width + opacity, 250ms ease-in-out）
- 流式光标闪烁动画

### Task 3: AI 面板基础逻辑
- State 属性：`aiPanelOpen`, `aiMessages`, `aiStreaming`, `aiCurrentMessageId`, `aiAutoScroll`
- `toggleAIPanel()`：切换面板显示/隐藏，持久化状态
- `renderAIMessages()`：使用 marked 渲染 Markdown，hljs 高亮代码块
- `handleSendAIMessage()`：发送用户消息，创建 AI 占位符，调用 `ai.prompt()`
- `handleAIStream()`：监听 `ai:events-batch`，处理 `message_update`/`turn_end`/`error` 事件
- 智能滚动：距底部 >100px 暂停自动滚动，显示回到底部按钮
- 输入框：Enter 发送、Shift+Enter 换行、自动增高（40px-120px）
- 拖拽调整宽度：mousedown/mousemove/mouseup 事件实现

## Verification Results

- [x] `grep -n "toggleAIPanel" shortcut-manager.js` — 找到第 49 行
- [x] `grep -c "aiPanel" src/index.html` — 5 个匹配
- [x] `grep -c "ai-panel-width" src/styles/main.css` — 2 个匹配
- [x] `grep -c "toggleAIPanel" src/renderer.js` — 5 个匹配
- [x] `grep -c "handleAIStream" src/renderer.js` — 2 个匹配
- [x] `package.json` 包含 `marked: ^18` 和 `highlight.js: ^11`

## Decisions Made

1. **marked + highlight.js 组合**：轻量级、久经验证、无外部依赖，适合 Electron 环境
2. **CSS 过渡动画**：使用 width + opacity 双属性过渡，避免 layout thrashing
3. **流式光标实现**：使用 CSS animation step-end 闪烁，而非 JavaScript 定时器
4. **拖拽调整宽度**：通过 mousedown/mousemove/mouseup 原生事件实现，简单高效

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason | Future Plan |
|------|------|------|--------|-------------|
| AI 面板状态恢复 | src/renderer.js | init() | 面板初始状态始终为关闭，未从 electron-store 读取上次状态 | 21-02 |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-21-01 mitigated | src/renderer.js | AI 消息通过 marked.parse() 渲染，默认转义 HTML，防止 XSS |

## Self-Check

- [x] 所有创建的文件存在
- [x] 所有 commit 存在（d2ade8a, 9ad8c46, 49f1fec）
- [x] SUMMARY.md 创建成功

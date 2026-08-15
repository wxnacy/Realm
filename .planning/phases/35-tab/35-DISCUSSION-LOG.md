# Phase 35: Tab 窗口关联 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-14
**Phase:** 35-Tab 窗口关联
**Areas discussed:** 窗口关闭级联, 窗口标题和容器颜色, Tab 管理重构

---

## 窗口关闭级联

### Q1: 关闭确认

| Option | Description | Selected |
|--------|-------------|----------|
| 直接关闭不确认 | 和 Chrome 类似，关闭就关闭，媒体自动停止，下载中断 | |
| 有活跃任务时弹确认 | 有正在播放的视频或下载时弹确认对话框，无任务时直接关闭 | ✓ |
| 总是弹确认 | 每次关闭窗口都弹确认框，防止误操作 | |

**User's choice:** 有活跃任务时弹确认
**Notes:** 参考 Chrome 行为，只在有活跃任务时才弹确认

### Q2: 关闭顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 先销毁 Tab 再销毁窗口 | 显式关闭每个 Tab 的 webContents，确保资源正确释放和事件触发，逻辑更清晰 | ✓ |
| 直接销毁窗口 | 让 Electron 的窗口关闭事件自然级联清理，代码更简单但控制力弱 | |

**User's choice:** 先销毁 Tab 再销毁窗口
**Notes:** 显式控制资源释放，避免依赖 Electron 的隐式行为

### Q3: 关闭检测

| Option | Description | Selected |
|--------|-------------|----------|
| 仅检测下载 | 只检查是否有进行中的下载，视频播放不算（用户可以随时停止） | |
| 检测下载 + 媒体播放 | 检查下载和正在播放的媒体，两者都算活跃任务 | ✓ |
| 检测下载 + 媒体 + 未保存表单 | 最全面但实现复杂，需要额外的表单变更追踪 | |

**User's choice:** 检测下载 + 媒体播放
**Notes:** 覆盖两种主要的活跃任务类型，表单追踪复杂度高暂不考虑

### Q4: 确认 UI

| Option | Description | Selected |
|--------|-------------|----------|
| 原生 dialog.showMessageBox | Electron 原生对话框，样式统一，实现简单，模态阻塞 | ✓ |
| 自定义模态框 | 网页内模态框，样式可控但需要额外实现，可能与页面内容冲突 | |

**User's choice:** 原生 dialog.showMessageBox
**Notes:** 使用 Electron 原生能力，简单可靠

---

## 窗口标题和容器颜色

### Q1: 标题格式

| Option | Description | Selected |
|--------|-------------|----------|
| 容器名 + 页面标题 | 如 "工作 - Google"，格式与 Chrome 一致，信息最丰富 | ✓ |
| 仅容器名 | 如 "工作"，简洁但丢失页面信息 | |
| 页面标题 + 容器名 | 如 "Google - 工作"，页面标题在前，容器名在后 | |

**User's choice:** 容器名 + 页面标题
**Notes:** 与 Chrome 风格一致，用户习惯

### Q2: 颜色标识

| Option | Description | Selected |
|--------|-------------|----------|
| Tab 栏顶部边框线 | 在 Tab 栏顶部显示一条 2-3px 的彩色边框线，类似 Firefox 容器颜色，不影响布局 | ✓ |
| 工具栏背景色 | 改变工具栏背景色为容器颜色的淡色版本，视觉冲击强但可能干扰 | |
| 窗口边框 | 改变窗口边框颜色，macOS 原生窗口边框支持有限 | |

**User's choice:** Tab 栏顶部边框线
**Notes:** 参考 Firefox Multi-Account Containers 的颜色条设计

### Q3: 颜色更新

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随当前活动 Tab | 颜色随活动 Tab 的容器切换，与标题更新同步，体验最自然 | ✓ |
| 显示所有容器颜色 | 同时显示多种颜色条，信息全但视觉复杂 | |
| 始终显示窗口的默认容器颜色 | 颜色固定不变，简单但不反映实际内容 | |

**User's choice:** 跟随当前活动 Tab
**Notes:** 与标题更新同步，体验最自然

### Q4: 默认容器颜色

| Option | Description | Selected |
|--------|-------------|----------|
| 隐藏颜色条 | 默认容器无颜色，不显示颜色条，与 Firefox 行为一致 | ✓ |
| 显示灰色 | 默认容器用灰色表示，保持颜色条始终存在 | |

**User's choice:** 隐藏颜色条
**Notes:** 默认容器不需要特殊标识

---

## Tab 管理重构

### Q1: Tab 归属

| Option | Description | Selected |
|--------|-------------|----------|
| tab 对象加 windowId 字段 | 每个 tab 对象记录所属 windowId，双向查找通过索引支持，简单直观 | ✓ |
| 窗口维护独立 Tab 列表 | 每个窗口对象维护自己的 tabs 数组，Tab 不知道窗口存在，窗口间完全隔离 | |
| 双向引用 | tab 有 windowId + 窗口有 tabs 数组，冗余但查找快 | |

**User's choice:** tab 对象加 windowId 字段
**Notes:** 简单直观，便于按 tabId 或 windowId 查找

### Q2: 跨窗口 Tab

| Option | Description | Selected |
|--------|-------------|----------|
| 每个窗口独立的渲染进程实例 | 每个 BrowserWindow 有自己的 renderer.js 实例，只管理本窗口的 Tab，窗口间通过 IPC 通信 | ✓ |
| 共享渲染进程状态 | 所有窗口共享一个全局 Tab 状态，通过 broadcast 同步，复杂度高 | |

**User's choice:** 每个窗口独立的渲染进程实例
**Notes:** 符合 Electron 架构，每个 BrowserWindow 天然有独立渲染进程

### Q3: 窗口通信

| Option | Description | Selected |
|--------|-------------|----------|
| 主进程中转 | 拖拽事件先发到主进程，主进程更新 Tab 归属后通知目标窗口创建 Tab，逻辑集中 | ✓ |
| 渲染进程直接通信 | 窗口间通过 webContents 直接发 IPC，延迟低但逻辑分散 | |

**User's choice:** 主进程中转
**Notes:** 逻辑集中在主进程，便于状态管理和一致性保证

### Q4: Tab 注册表

| Option | Description | Selected |
|--------|-------------|----------|
| 维护全局 Tab Map | 主进程维护 Map<tabId, {url, container, windowId, ...}> 作为权威数据源，渲染进程只做 UI 展示 | ✓ |
| 仅窗口映射 | 主进程只维护 windowId→[tabIds] 映射，Tab 详细信息由渲染进程各自管理 | |

**User's choice:** 维护全局 Tab Map
**Notes:** 主进程作为权威数据源，渲染进程只做 UI 展示，便于跨窗口操作

---

## Claude's Discretion

None — all areas were explicitly discussed

## Deferred Ideas

None — discussion stayed within phase scope

# Phase 2: Browser Core - URL Navigation + Multi-Tab - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 2-Browser Core - URL Navigation + Multi-Tab
**Areas discussed:** 浏览器视图技术选型, 多Tab架构设计, URL导航交互细节, Tab UI设计

---

## 浏览器视图技术选型

### 浏览器视图技术

| Option | Description | Selected |
|--------|-------------|----------|
| webview 标签 | 渲染进程中嵌入，支持 preload 脚本，可绑定 Session partition。Electron 官方推荐用于嵌入第三方网页内容 | ✓ |
| WebContentsView | 主进程中创建的独立 WebContents，可直接绑定 Session。性能更好，但需要手动管理位置和大小，不支持 preload | |
| BrowserView | 主进程创建的视图层，可以叠加在渲染进程之上。已废弃（deprecated），不推荐新项目使用 | |

**User's choice:** webview 标签
**Notes:** 用户选择 webview 标签，这是 Electron 官方推荐的方式

### webview 管理方式

| Option | Description | Selected |
|--------|-------------|----------|
| 单个 webview 动态切换 | 在 HTML 中预定义一个 webview 元素，通过 JavaScript 动态修改其 src 和 partition 属性来切换页面和容器 | ✓ |
| 每 Tab 一个 webview | 为每个 Tab 创建独立的 webview 元素，显示/隐藏来切换，内存占用更多但切换更快 | |
| 容器切换时重建 webview | 容器切换时销毁并重建 webview 元素，确保 Session 完全隔离 | |

**User's choice:** 单个 webview 动态切换
**Notes:** 用户选择单个 webview 动态切换，简单可靠

### webview 安全策略

| Option | Description | Selected |
|--------|-------------|----------|
| 严格安全模式 | 启用 nodeintegration="false"、禁用 remote 模块、限制 webContents 权限，防止网页访问 Node.js API | |
| 白名单模式 | 默认严格，但对特定域名（如 *.internal.company.com）开放部分权限，需要维护一份域名白名单 | |
| 标准模式 | nodeintegration="false"（这个必须关），但允许弹窗、子框架集成等 | ✓ |

**User's choice:** 标准模式
**Notes:** 用户要求先使用标准模式，后续再扩展白名单

### webview 通信方式

| Option | Description | Selected |
|--------|-------------|----------|
| preload 注入 | 通过 preload 脚本在 webview 中注入 realmAPI，网页通过 window.realmAPI 与主进程通信，与现有架构一致 | ✓ |
| webview IPC 消息 | 使用 webview 的 ipc-message 事件监听网页消息，主进程通过 webContents.send 发送消息 | |
| 无注入，纯浏览 | 不注入任何 API，纯浏览模式，所有交互通过工具栏操作 | |

**User's choice:** preload 注入
**Notes:** 用户选择 preload 注入，保持与现有架构一致

---

## 多 Tab 架构设计

### Tab 数据模型

| Option | Description | Selected |
|--------|-------------|----------|
| 轻量级 Tab 模型 | Tab 仅记录 containerId 和 url，标题和 favicon 从 webview 实时获取，内存占用最少 | ✓ |
| 完整 Tab 模型 | Tab 记录 containerId、url、title、favicon、历史栈、滚动位置等，支持恢复和持久化 | |
| 无状态 Tab | Tab 是无状态的，仅作为容器和 webview 的映射，关闭即销毁 | |

**User's choice:** 轻量级 Tab 模型
**Notes:** 用户选择轻量级 Tab 模型，内存占用最少

### Tab 切换方式

| Option | Description | Selected |
|--------|-------------|----------|
| 重新加载页面 | 切换 Tab 时修改 webview 的 src 和 partition，页面重新加载，简单可靠 | |
| 保留 webview 实例 | 每个 Tab 维护独立的 webview，切换时显示/隐藏，内存占用大但切换快 | ✓ |
| 状态保存与恢复 | 切换前保存页面状态（URL、滚动位置），切换后恢复，平衡内存和体验 | |

**User's choice:** 保留 webview 实例
**Notes:** 用户选择保留 webview 实例，切换时不重新加载页面

### Tab 上限策略

| Option | Description | Selected |
|--------|-------------|----------|
| 无限制 | 不限制 Tab 数量，内存用完为止，适合高级用户 | |
| 自动回收 | 超过上限时自动关闭最久未使用的 Tab，并提示用户 | ✓ |
| 硬性上限 | 达到上限时禁止新建 Tab，弹出提示 | |

**User's choice:** 自动回收
**Notes:** 用户选择自动回收最久未使用的 Tab

### Tab 关闭行为

| Option | Description | Selected |
|--------|-------------|----------|
| 立即销毁 | 关闭 Tab 时销毁对应的 webview 实例，释放内存，不可恢复 | ✓ |
| 延迟销毁 | 关闭后保留 webview 实例一段时间，支持撤销关闭 | |
| 保留到应用退出 | 关闭后保留到应用退出时才销毁，支持历史记录 | |

**User's choice:** 立即销毁
**Notes:** 用户选择立即销毁 webview 实例

### 跨容器 Tab 打开方式

| Option | Description | Selected |
|--------|-------------|----------|
| 同窗口多容器 Tab | 打开其他容器时在当前窗口新建 Tab，所有 Tab 共存，参考 Firefox Multi-Account Containers | ✓ |
| 替换当前 Tab | 切换容器时替换当前 Tab 的内容，不新建 Tab | |
| 新窗口打开 | 打开其他容器时在新窗口中打开，每个窗口一个容器 | |

**User's choice:** 同窗口多容器 Tab
**Notes:** 用户选择同窗口多容器 Tab，参考 Firefox Multi-Account Containers

---

## URL 导航交互细节

### URL 输入方式

| Option | Description | Selected |
|--------|-------------|----------|
| 回车导航 + 显示 URL | 输入 URL 后按回车键导航，地址栏显示当前页面 URL，支持编辑 | ✓ |
| 失焦导航 + 实时预览 | 输入后实时预览，失去焦点时导航，地址栏始终显示当前 URL | |
| 按钮导航 + 简化显示 | 输入后点击按钮导航，地址栏只显示域名 | |

**User's choice:** 回车导航 + 显示 URL
**Notes:** 用户选择回车键触发导航，地址栏显示完整 URL

### URL 格式处理

| Option | Description | Selected |
|--------|-------------|----------|
| 智能补全 + 错误页 | 自动补全协议（https://），无效 URL 显示错误页面 | ✓ |
| 严格校验 | 严格校验 URL 格式，不合法时拒绝导航并提示 | |
| 原样传递 | 原样传递给 webview，由 webview 自行处理 | |

**User's choice:** 智能补全 + 错误页
**Notes:** 用户选择智能补全协议，无效 URL 显示错误页面

### 新 Tab 页面

| Option | Description | Selected |
|--------|-------------|----------|
| 内置新标签页 | 显示应用内置的新标签页，包含常用容器入口和搜索框 | ✓ |
| 空白页 | 显示空白页，用户需要手动输入 URL | |
| 自定义网页 | 显示特定网页（如 about:blank 或自定义 URL） | |

**User's choice:** 内置新标签页
**Notes:** 用户选择内置新标签页，包含常用容器入口和搜索框

### 加载状态反馈

| Option | Description | Selected |
|--------|-------------|----------|
| 地址栏动画 + 切换按钮 | 地址栏显示加载动画（旋转图标），加载完成后显示刷新按钮 | ✓ |
| 进度条 | 地址栏显示进度条，加载完成后消失 | |
| 无视觉反馈 | 不显示加载状态，用户通过页面内容判断 | |

**User's choice:** 地址栏动画 + 切换按钮
**Notes:** 用户选择地址栏动画 + 刷新/停止按钮切换

---

## Tab UI 设计

### Tab 布局

| Option | Description | Selected |
|--------|-------------|----------|
| 固定位置 + 滚动 | Tab 栏固定在窗口顶部，Tab 超出时显示左右滚动箭头 | |
| 固定位置 + 自适应宽度 | Tab 栏固定，Tab 超出时自动缩小宽度 | |
| 可折叠 Tab 栏 | Tab 栏可折叠，双行显示或下拉菜单选择 | |

**User's choice:** 固定位置 + 自适应宽度（有一个最小宽度，达到最小宽度时，再增加 tab 显示左右滚动箭头）
**Notes:** 用户提供了更详细的需求：自适应宽度 + 最小宽度限制 + 滚动箭头

### 容器颜色标识位置

| Option | Description | Selected |
|--------|-------------|----------|
| 顶部细线 | Tab 顶部有一条细线（2-3px）显示容器颜色，不占用太多空间 | ✓ |
| 背景色变色 | Tab 背景色使用容器颜色的浅色版本，整体变色 | |
| 左侧圆点 | Tab 左侧显示容器颜色圆点，类似 Firefox Multi-Account Containers | |

**User's choice:** 顶部细线
**Notes:** 用户选择顶部细线显示容器颜色

### Tab 关闭按钮

| Option | Description | Selected |
|--------|-------------|----------|
| 悬停显示 × | 鼠标悬停时显示关闭按钮（×），在 Tab 右侧 | ✓ |
| 始终显示 × | 关闭按钮始终显示在 Tab 右侧 | |
| 中键关闭无按钮 | 支持中键点击关闭，不显示关闭按钮 | |

**User's choice:** 悬停显示 ×
**Notes:** 用户选择悬停时显示关闭按钮

### Tab 标题显示

| Option | Description | Selected |
|--------|-------------|----------|
| 标题 + 省略号截断 | Tab 显示页面标题，超长时用省略号截断，鼠标悬停显示完整标题 | ✓ |
| 标题 + 滚动显示 | Tab 显示页面标题，超长时滚动显示 | |
| 仅 favicon + 悬停标题 | Tab 只显示 favicon，鼠标悬停显示标题 | |

**User's choice:** 标题 + 省略号截断
**Notes:** 用户选择标题 + 省略号截断

---

## Claude's Discretion

无 — 所有决策均由用户明确选择

## Deferred Ideas

### 白名单安全模式
- 用户提到后续可扩展白名单模式，允许特定域名访问部分 Node.js API
- 属于 Phase 3 或后续阶段的功能

---

*Phase: 2-Browser Core - URL Navigation + Multi-Tab*
*Discussion date: 2026-07-23*

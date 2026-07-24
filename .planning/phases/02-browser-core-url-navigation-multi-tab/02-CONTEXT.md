# Phase 2: Browser Core - URL Navigation + Multi-Tab - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

在同一窗口内以多 Tab 形式浏览不同容器的网页 — 包括浏览器内容渲染、多 Tab 管理、URL 导航和工具栏交互。

**核心交付：**
1. 使用 webview 标签实现网页内容渲染
2. 多 Tab 管理（创建、切换、关闭）
3. URL 导航（输入、前进、后退、刷新）
4. Tab UI（标题、容器颜色、关闭按钮）

</domain>

<decisions>
## Implementation Decisions

### 浏览器视图技术选型
- **D-01:** 使用 webview 标签渲染网页内容 — 在渲染进程中嵌入，支持 preload 脚本，可绑定 Session partition
- **D-02:** ~~单个 webview 动态切换~~ — **SUPERSEDED by D-06**（用户于 2026-07-23 决定保留 D-06 多实例方案）
- **D-03:** 标准安全模式 — nodeintegration="false"，禁止网页访问 Node.js API，后续可扩展白名单模式
- **D-04:** 通过 preload 注入实现网页与主进程通信 — 保持与现有架构一致

### 多 Tab 架构设计
- **D-05:** 轻量级 Tab 模型 — 每个 Tab 仅记录 containerId 和 url，标题和 favicon 从 webview 实时获取
- **D-06:** 保留 webview 实例 — 切换 Tab 时显示/隐藏对应的 webview，不重新加载页面
- **D-07:** 自动回收最久未使用的 Tab — 超过上限时自动关闭最久未使用的 Tab，并提示用户
- **D-08:** 关闭 Tab 时立即销毁 webview — 释放内存，不可恢复
- **D-09:** 同窗口多容器 Tab — 打开其他容器时在当前窗口新建 Tab，所有 Tab 共存

### URL 导航交互细节
- **D-10:** 回车导航 + 显示完整 URL — 输入 URL 后按回车键导航，地址栏显示当前页面 URL
- **D-11:** 智能补全协议 — 自动补全 https://，无效 URL 显示错误页面
- **D-12:** 内置新标签页 — 新建 Tab 时显示应用内置的新标签页，包含常用容器入口和搜索框
- **D-13:** 地址栏加载动画 + 刷新/停止按钮切换 — 加载时显示动画，加载完成后切换按钮

### Tab UI 设计
- **D-14:** 固定位置 + 自适应宽度 — Tab 栏固定在窗口顶部，Tab 超出自适应宽度，达到最小宽度后显示左右滚动箭头
- **D-15:** Tab 顶部细线显示容器颜色 — 2-3px 细线，不占用太多空间
- **D-16:** 悬停显示关闭按钮 — 鼠标悬停时显示关闭按钮（×），在 Tab 右侧
- **D-17:** 标题 + 省略号截断 — Tab 显示页面标题，超长时用省略号截断，鼠标悬停显示完整标题

### Claude's Discretion
无 — 所有决策均已由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规划
- `.planning/PROJECT.md` — 项目概述、核心价值、技术环境、关键决策
- `.planning/REQUIREMENTS.md` — v1 需求列表（BROW-01 至 BROW-05 为本阶段需求）
- `.planning/ROADMAP.md` — 阶段规划和成功标准

### 代码库分析
- `.planning/codebase/STACK.md` — 技术栈和依赖
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责
- `.planning/codebase/CONVENTIONS.md` — 编码规范和命名约定

### 现有代码
- `main.js` — 当前主进程实现，包含容器管理、窗口管理、IPC 处理
- `container-manager.js` — 容器管理模块
- `window-manager.js` — 窗口管理模块
- `ipc-handlers.js` — IPC 处理器模块
- `src/preload.js` — 当前 IPC 桥接实现
- `src/renderer.js` — 当前渲染进程逻辑
- `src/index.html` — 当前 UI 结构
- `src/styles/main.css` — 当前样式定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `configStore` (electron-store): 已配置好，可用于 Tab 配置持久化
- `containers` Map: 容器实例存储，可用于获取容器信息
- `windowContainerMap` Map: 窗口-容器映射，可扩展为 Tab-容器映射
- Session 隔离机制: `persist:container-${containerId}` 分区命名

### Established Patterns
- IPC 通道命名: `动词-名词` 格式（如 `get-containers`, `create-container`）
- 容器数据结构: `{ id, name, color, icon }`
- 日志前缀: `[Realm]` 主进程, `[Realm Renderer]` 渲染进程
- DOM 元素引用: 集中在 `elements` 对象中管理

### Integration Points
- `container-manager.js`: 容器 CRUD 和 Session 管理，需要添加 Tab 管理功能
- `window-manager.js`: 窗口创建和映射，需要扩展为 Tab 管理
- `ipc-handlers.js`: IPC 处理器，需要添加 Tab 相关的 IPC 通道
- `src/preload.js`: IPC 桥接，需要添加 Tab 相关的 API
- `src/renderer.js`: 渲染进程逻辑，需要添加 Tab UI 和交互
- `src/index.html`: UI 结构，需要添加 Tab 栏和 webview 容器

</code_context>

<specifics>
## Specific Ideas

- 参考 Firefox Multi-Account Containers 的 Tab 交互模式
- webview 标签需要配置 nodeintegration="false" 确保安全
- Tab 切换时保留 webview 实例，不重新加载页面
- 内置新标签页包含常用容器入口和搜索框
- 地址栏加载动画使用 CSS 动画实现

</specifics>

<deferred>
## Deferred Ideas

### 白名单安全模式
- 用户提到后续可扩展白名单模式，允许特定域名访问部分 Node.js API
- 属于 Phase 3 或后续阶段的功能

</deferred>

---

*Phase: 2-Browser Core - URL Navigation + Multi-Tab*
*Context gathered: 2026-07-23*

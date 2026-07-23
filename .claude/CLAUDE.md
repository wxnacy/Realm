<!-- GSD:project-start source:PROJECT.md -->

## Project

**Realm Browser**

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，支持独立的 Cookie、Session、LocalStorage、IndexedDB 和缓存隔离。用户可以通过工具栏按钮管理容器，在同一窗口内以多 Tab 形式运行不同容器的页面，实现类似 Firefox Multi-Account Containers 的隔离体验。

**Core Value:** 容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载。

### Constraints

- **Tech Stack**: Electron 32.x — 项目已选定，不可更改
- **Platform**: macOS — 主要开发和测试平台
- **Compatibility**: Chromium 内核 — 需兼容主流网站
- **Performance**: 容器切换不能有明显延迟

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ES6+) - 主进程和渲染进程开发
- HTML5 - UI 结构定义
- CSS3 - 样式和布局
- Node.js - Electron 主进程运行时

## Runtime

- Node.js - 主进程运行时
- Chromium - 渲染进程运行时（通过 Electron）
- Electron 32.x - 桌面应用框架
- npm - 包管理器
- Lockfile: 缺失（package-lock.json 被 gitignore）

## Frameworks

- Electron 32.0.0+ - 跨平台桌面应用框架
- Electron Builder 24.13.0+ - 应用打包和分发工具
- 未检测到测试框架 - 项目当前没有配置测试
- Electron Builder - 生产构建和打包
- npm scripts - 开发和构建脚本

## Key Dependencies

- electron-store 8.1.0+ - 容器配置持久化存储
- Electron Session API - 容器隔离的核心机制（内置）
- 无额外基础设施依赖

## Configuration

- 通过 `process.env.NODE_ENV` 控制开发/生产模式
- 开发模式自动打开开发者工具
- 无外部环境变量配置
- `package.json` - 项目配置和构建脚本
- `electron-builder` 配置嵌入 package.json 的 `build` 字段
- 构建目标：macOS (dmg, zip)

## Platform Requirements

- Node.js 运行时
- npm 包管理器
- macOS（主要开发平台）
- macOS 桌面环境
- 应用 ID：`com.realm.browser`
- 产品名称：Realm

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## 命名规范

- 使用 kebab-case（小写 + 连字符）：`main.js`、`preload.js`、`renderer.js`
- CSS 文件：`main.css`
- HTML 文件：`index.html`
- 使用 camelCase：`containerId`、`windowContainerMap`、`state.selectedColor`
- DOM 元素引用：`elements.containerList`、`elements.urlInput`
- 布尔值：不加 `is/has` 前缀，直接描述状态
- 使用 camelCase：`initContainers()`、`createMainWindow()`、`switchContainer()`
- 动词开头：`get`、`set`、`create`、`delete`、`load`、`render`、`update`、`show`、`hide`
- 异步函数：使用 `async/await`，不使用 `.then()` 链式调用
- 使用 UPPER_SNAKE_CASE：`DEFAULT_CONTAINERS`
- 配置对象：`configStore`
- 放在文件顶部，函数定义之前
- 使用 PascalCase（当前代码未使用类，但规范要求）
- 使用 kebab-case：`container-item`、`sidebar-header`、`btn-icon`
- BEM 风格的变体：`container-list`、`container-item`、`container-dot`

## 代码风格

- 使用 2 个空格
- 不使用 Tab
- 使用单引号：`'default'`、`'persist:container-${containerId}'`
- 模板字符串用于插值：`` `persist:container-${container.id}` ``
- 语句末尾使用分号
- 控制语句的大括号与语句同行
- 函数定义使用 `function` 关键字（不使用箭头函数作为顶层函数）
- 文件顶部：文件描述注释（多行 `/** */`）
- 函数上方：JSDoc 注释，包含功能描述和参数说明
- 行内注释：使用 `//`，用于解释复杂逻辑
- 分隔符：使用 `// ====================` 分隔代码区域

## 导入组织

## 错误处理

- 容器不存在时返回 `false` 或空数组
- 删除默认容器时返回 `{ success: false, message: '无法删除默认容器' }`
- 使用 `console.error` 记录错误
- 不使用 try-catch（当前代码）

## 日志规范

- 使用 `[Realm]` 前缀标识主进程日志
- 使用 `[Realm Renderer]` 前缀标识渲染进程日志
- 包含操作描述和关键信息

## 状态管理

- 使用全局 `state` 对象存储应用状态
- 状态更新后调用对应的渲染函数
- 使用 `Map` 存储运行时状态：`containers`、`windowContainerMap`
- 使用 `electron-store` 持久化配置

## DOM 操作

- 集中在 `elements` 对象中管理
- 使用 `document.getElementById` 和 `document.querySelector`
- 在 `setupEventListeners()` 函数中集中绑定
- 使用 `addEventListener`，不使用内联事件

## IPC 通信

- 使用 kebab-case：`get-containers`、`switch-container`
- 动词-名词格式：`get-xxx`、`set-xxx`、`create-xxx`、`delete-xxx`
- 通过 `contextBridge.exposeInMainWorld` 暴露
- 挂载在 `window.realmAPI` 下

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Container Manager | 管理容器生命周期、Session 创建与隔离、容器 CRUD | `main.js` |
| Window Manager | 管理 BrowserWindow 实例、窗口与容器的映射关系 | `main.js` |
| IPC Handler | 处理渲染进程请求、暴露容器操作接口 | `main.js` |
| Preload Script | 安全地将 IPC 接口暴露给渲染进程（contextBridge） | `src/preload.js` |
| Renderer | 处理 UI 交互、状态管理、调用 realmAPI | `src/renderer.js` |
| UI Layout | 定义页面结构、侧边栏、工具栏、模态框 | `src/index.html` |
| Styles | 定义深色主题样式、布局、组件样式 | `src/styles/main.css` |

## Pattern Overview

- **进程隔离**：主进程和渲染进程严格分离，通过 contextBridge 安全通信
- **Session 隔离**：每个容器对应独立的 Electron Session（`persist:container-{id}`）
- **集中式状态**：渲染进程使用简单的 state 对象管理 UI 状态
- **配置持久化**：使用 electron-store 持久化容器配置
- **无框架**：渲染进程使用原生 JavaScript，无 React/Vue 等框架

## Layers

- Purpose: 管理应用生命周期、容器 Session、窗口创建、IPC 通信
- Location: `main.js`
- Contains: 容器初始化、窗口创建、IPC 处理器、应用事件处理
- Depends on: electron, electron-store
- Used by: 渲染进程通过 IPC 调用
- Purpose: 安全地将主进程 API 暴露给渲染进程
- Location: `src/preload.js`
- Contains: contextBridge API 定义
- Depends on: electron (contextBridge, ipcRenderer)
- Used by: 渲染进程通过 window.realmAPI 访问
- Purpose: 处理用户交互、渲染 UI、管理本地状态
- Location: `src/renderer.js`, `src/index.html`, `src/styles/main.css`
- Contains: DOM 操作、事件监听、状态管理、UI 渲染
- Depends on: window.realmAPI (通过 preload 暴露)
- Used by: 用户直接交互

## Data Flow

### 容器初始化流程

### 渲染进程初始化流程

### 容器切换流程

### 容器创建流程

- 主进程：使用 `containers` Map 存储容器实例，`windowContainerMap` 存储窗口-容器映射
- 渲染进程：使用简单的 `state` 对象存储当前容器列表和选中状态
- 持久化：使用 `electron-store` 存储容器配置到本地文件

## Key Abstractions

- Purpose: 隔离的浏览器环境，每个容器拥有独立的 Cookie、缓存和存储
- Examples: `main.js:24-29` (DEFAULT_CONTAINERS), `main.js:38-49` (initContainers)
- Pattern: 使用 Electron Session partition 实现隔离 (`persist:container-{id}`)
- Purpose: 渲染进程访问主进程功能的唯一接口
- Examples: `src/preload.js:13-81`
- Pattern: contextBridge 安全暴露，所有方法返回 Promise
- Purpose: 跟踪每个窗口当前使用的容器
- Examples: `main.js:19` (windowContainerMap)
- Pattern: Map<windowId, containerId>

## Entry Points

- Location: `main.js`
- Triggers: Electron 应用启动 (`npm start` 或 `npm run dev`)
- Responsibilities: 初始化容器、创建窗口、处理 IPC、管理应用生命周期
- Location: `src/renderer.js`
- Triggers: HTML 页面加载完成
- Responsibilities: 初始化 UI、加载容器列表、设置事件监听
- Location: `src/index.html`
- Triggers: BrowserWindow.loadFile() 调用
- Responsibilities: 定义页面结构、加载样式和脚本

## Architectural Constraints

- **进程隔离**: 主进程和渲染进程严格分离，通过 IPC 通信
- **安全策略**: 使用 contextIsolation: true 和 nodeIntegration: false
- **Session 限制**: Electron 不支持运行时切换 Session，切换容器需要重建窗口（当前实现仅更新映射，未重建）
- **单窗口**: 当前实现仅支持单窗口，多窗口场景需要扩展 windowContainerMap
- **无路由**: 渲染进程无前端路由，所有 UI 在单个 HTML 页面中管理

## Anti-Patterns

### 容器切换未重建窗口

### URL 导航未实现

### 全局状态管理简单

## Error Handling

- 容器不存在时返回 false 或空值 (`main.js:58-60`, `main.js:219`)
- 删除默认容器时返回错误信息 (`main.js:194-196`)
- 使用 console.error 输出错误日志 (`main.js:59`)

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

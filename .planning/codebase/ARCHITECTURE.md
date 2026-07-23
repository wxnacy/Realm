<!-- refreshed: 2026-07-23 -->
# Architecture

**Analysis Date:** 2026-07-23

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          Electron Application                           │
├─────────────────────────────────────────────────────────────────────────┤
│                           Main Process                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │   Container Manager  │  │    Window Manager    │  │  IPC Handler │  │
│  │     `main.js`        │  │     `main.js`        │  │   `main.js`  │  │
│  │  - container Map     │  │  - windowContainer   │  │  - ipcMain   │  │
│  │  - session mgmt      │  │    Map               │  │    .handle() │  │
│  │  - electron-store    │  │  - BrowserWindow     │  │              │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────┬───────┘  │
│             │                         │                      │          │
│             └─────────────────────────┼──────────────────────┘          │
│                                       │                                 │
├───────────────────────────────────────┼─────────────────────────────────┤
│                        contextBridge │ IPC                              │
├───────────────────────────────────────┼─────────────────────────────────┤
│                           Renderer Process                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Preload Script                             │ │
│  │                      `src/preload.js`                              │ │
│  │  - contextBridge.exposeInMainWorld('realmAPI', {...})              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                       │                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                           UI Layer                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐ │ │
│  │  │  Sidebar         │  │   Toolbar        │  │  Browser View      │ │ │
│  │  │  `src/index.html`│  │  `src/index.html`│  │  `src/index.html`  │ │ │
│  │  │  - Container List│  │  - URL Input     │  │  - Welcome Page    │ │ │
│  │  │  - Add Container │  │  - Nav Buttons   │  │  - webview (TODO)  │ │ │
│  │  └─────────────────┘  └─────────────────┘  └────────────────────┘ │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Modals (Dialog)                                                │ │ │
│  │  │  - New Container Modal                                          │ │ │
│  │  │  - Cookies Management Modal                                     │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
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

**Overall:** Electron 主进程-渲染进程架构，使用 IPC 双向通信

**Key Characteristics:**
- **进程隔离**：主进程和渲染进程严格分离，通过 contextBridge 安全通信
- **Session 隔离**：每个容器对应独立的 Electron Session（`persist:container-{id}`）
- **集中式状态**：渲染进程使用简单的 state 对象管理 UI 状态
- **配置持久化**：使用 electron-store 持久化容器配置
- **无框架**：渲染进程使用原生 JavaScript，无 React/Vue 等框架

## Layers

**Main Process Layer:**
- Purpose: 管理应用生命周期、容器 Session、窗口创建、IPC 通信
- Location: `main.js`
- Contains: 容器初始化、窗口创建、IPC 处理器、应用事件处理
- Depends on: electron, electron-store
- Used by: 渲染进程通过 IPC 调用

**Preload Bridge Layer:**
- Purpose: 安全地将主进程 API 暴露给渲染进程
- Location: `src/preload.js`
- Contains: contextBridge API 定义
- Depends on: electron (contextBridge, ipcRenderer)
- Used by: 渲染进程通过 window.realmAPI 访问

**Renderer Layer:**
- Purpose: 处理用户交互、渲染 UI、管理本地状态
- Location: `src/renderer.js`, `src/index.html`, `src/styles/main.css`
- Contains: DOM 操作、事件监听、状态管理、UI 渲染
- Depends on: window.realmAPI (通过 preload 暴露)
- Used by: 用户直接交互

## Data Flow

### 容器初始化流程

1. 应用启动，`app.whenReady()` 触发 (`main.js:249`)
2. 调用 `initContainers()` 从 electron-store 读取容器配置 (`main.js:35`)
3. 为每个容器创建独立的 Session partition (`main.js:39-40`)
4. 将容器信息存储到 `containers` Map (`main.js:42-47`)
5. 调用 `createMainWindow('default')` 创建主窗口 (`main.js:255`)

### 渲染进程初始化流程

1. `src/index.html` 加载，执行 `src/renderer.js` (`renderer.js:294`)
2. 调用 `init()` 函数 (`renderer.js:50`)
3. 调用 `loadContainers()` 通过 IPC 获取容器列表 (`renderer.js:68`)
4. 渲染容器列表到侧边栏 (`renderer.js:79`)
5. 设置事件监听器 (`renderer.js:57`)

### 容器切换流程

1. 用户点击侧边栏容器项 (`renderer.js:96`)
2. 调用 `switchContainer(containerId)` (`renderer.js:116`)
3. 通过 `window.realmAPI.switchContainer()` 发送 IPC 请求 (`renderer.js:119`)
4. 主进程 `ipcMain.handle('switch-container')` 处理 (`main.js:154`)
5. 调用 `switchContainer()` 更新映射并通知渲染进程 (`main.js:102`)
6. 渲染进程接收 `container-switched` 事件更新 UI (`renderer.js:131`)

### 容器创建流程

1. 用户点击 "+" 按钮，显示新建容器模态框 (`renderer.js:157`)
2. 用户填写表单并提交 (`renderer.js:227`)
3. 调用 `createContainer(name, color)` (`renderer.js:140`)
4. 通过 `window.realmAPI.createContainer()` 发送 IPC 请求 (`renderer.js:141`)
5. 主进程创建容器配置、Session 并持久化 (`main.js:162`)
6. 渲染进程重新加载容器列表 (`renderer.js:148`)

**State Management:**
- 主进程：使用 `containers` Map 存储容器实例，`windowContainerMap` 存储窗口-容器映射
- 渲染进程：使用简单的 `state` 对象存储当前容器列表和选中状态
- 持久化：使用 `electron-store` 存储容器配置到本地文件

## Key Abstractions

**Container (容器):**
- Purpose: 隔离的浏览器环境，每个容器拥有独立的 Cookie、缓存和存储
- Examples: `main.js:24-29` (DEFAULT_CONTAINERS), `main.js:38-49` (initContainers)
- Pattern: 使用 Electron Session partition 实现隔离 (`persist:container-{id}`)

**realmAPI:**
- Purpose: 渲染进程访问主进程功能的唯一接口
- Examples: `src/preload.js:13-81`
- Pattern: contextBridge 安全暴露，所有方法返回 Promise

**Window-Container Mapping:**
- Purpose: 跟踪每个窗口当前使用的容器
- Examples: `main.js:19` (windowContainerMap)
- Pattern: Map<windowId, containerId>

## Entry Points

**Main Process Entry:**
- Location: `main.js`
- Triggers: Electron 应用启动 (`npm start` 或 `npm run dev`)
- Responsibilities: 初始化容器、创建窗口、处理 IPC、管理应用生命周期

**Renderer Entry:**
- Location: `src/renderer.js`
- Triggers: HTML 页面加载完成
- Responsibilities: 初始化 UI、加载容器列表、设置事件监听

**HTML Entry:**
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

**What happens:** `switchContainer()` 仅更新映射和发送事件，未重建 BrowserWindow
**Why it's wrong:** Electron 的 Session 绑定在窗口创建时，运行时切换不会生效
**Do this instead:** 切换容器时关闭当前窗口并创建新窗口，或使用 webview 标签加载不同 Session

### URL 导航未实现

**What happens:** URL 输入框回车仅打印日志，未实际导航 (`renderer.js:258-259`)
**Why it's wrong:** 用户无法在浏览器中访问网页
**Do this instead:** 使用 webview 或 BrowserView 加载 URL，绑定到当前容器的 Session

### 全局状态管理简单

**What happens:** 渲染进程使用简单的全局 state 对象
**Why it's wrong:** 复杂场景下状态管理困难，无状态持久化
**Do this instead:** 考虑引入轻量级状态管理库或使用 electron-store 同步状态

## Error Handling

**Strategy:** 简单的错误检查和日志输出

**Patterns:**
- 容器不存在时返回 false 或空值 (`main.js:58-60`, `main.js:219`)
- 删除默认容器时返回错误信息 (`main.js:194-196`)
- 使用 console.error 输出错误日志 (`main.js:59`)

## Cross-Cutting Concerns

**Logging:** 使用 console.log 输出带 [Realm] 前缀的日志 (`main.js:48`, `renderer.js:51`)
**Validation:** 容器 ID 存在性检查，容器名称非空检查 (`renderer.js:229`)
**Authentication:** 无认证机制，单用户本地应用
**Persistence:** electron-store 持久化容器配置 (`main.js:13`)

---

*Architecture analysis: 2026-07-23*

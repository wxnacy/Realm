# Realm Browser - CLAUDE.md

## 项目概述

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，支持独立的 Cookie 管理，未来将集成 AI Agent SDK。

核心目标：
- 每个容器完全隔离（Cookie、缓存、存储）
- 可视化容器管理
- 预留 AI Agent 集成能力

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Container Manager│  │ Window Manager  │              │
│  └─────────────────┘  └─────────────────┘              │
│           │                    │                        │
│           ▼                    ▼                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Session Manager                     │   │
│  │  (persist:container-work, persist:container-*)   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  UI Layer                        │   │
│  │  - Container List (Sidebar)                      │   │
│  │  - Toolbar (URL, Navigation)                     │   │
│  │  - Browser View (webview/webContents)            │   │
│  │  - Modals (Container CRUD, Cookie Manager)       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 代码规范

### 命名规范
- 文件名：小写 + 连字符（kebab-case）
- 变量/函数：camelCase
- 类/构造函数：PascalCase
- 常量：UPPER_SNAKE_CASE
- CSS 类名：小写 + 连字符

### 代码风格
- 使用 2 空格缩进
- 字符串使用单引号
- 语句末尾使用分号
- 函数和类必须添加 JSDoc 注释

### 命名约定
```javascript
// 容器相关：container-xxx
const containerList = [];
const containerId = 'work';

// 窗口相关：window-xxx
const windowContainerMap = new Map();

// 事件名：动词-名词
// IPC 通道：get-xxx, set-xxx, delete-xxx, create-xxx
```

## 关键文件说明

| 文件 | 说明 |
|------|------|
| main.js | Electron 主进程，管理容器 Session 和窗口 |
| src/preload.js | 安全暴露 IPC 接口给渲染进程 |
| src/renderer.js | 渲染进程逻辑，处理 UI 交互 |
| src/index.html | 主界面结构 |
| src/styles/main.css | 样式文件 |

## 开发要点

### 容器隔离机制
每个容器使用独立的 Electron Session：
```javascript
// main.js
const partition = `persist:container-${containerId}`;
const ses = session.fromPartition(partition);
```

### IPC 通信
所有 IPC 通信通过 preload.js 暴露的 realmAPI：
```javascript
// renderer.js
const containers = await window.realmAPI.getContainers();
await window.realmAPI.switchContainer('work');
```

### 新增 IPC 接口
1. 在 main.js 中添加 `ipcMain.handle('channel-name', handler)`
2. 在 preload.js 中添加 `contextBridge.exposeInMainWorld` 方法
3. 在 renderer.js 中通过 `window.realmAPI` 调用

## 扩展模块（待实现）

### containers/
容器管理模块，包括：
- 容器配置持久化
- 容器生命周期管理
- 容器间数据迁移

### browser/
浏览器核心模块，包括：
- Web 视图管理
- 导航历史
- 页面加载控制

### ui/
UI 组件模块，包括：
- 标签页管理
- 工具栏组件
- 设置面板

### ai/
AI Agent 集成模块（预留），包括：
- Agent SDK 接口
- 上下文管理
- 工具调用

## 常见任务

### 添加新的容器属性
1. 在 `main.js` 的 `DEFAULT_CONTAINERS` 中添加属性
2. 更新 `preload.js` 中的 API
3. 更新 `renderer.js` 中的渲染逻辑

### 添加新的 UI 组件
1. 在 `src/index.html` 中添加 HTML 结构
2. 在 `src/styles/main.css` 中添加样式
3. 在 `src/renderer.js` 中添加交互逻辑

## 调试

### 开发模式
```bash
npm run dev
```
- 主进程日志：终端输出
- 渲染进程日志：开发者工具 Console

### 查看容器数据
```javascript
// 在渲染进程开发者工具中执行
const cookies = await window.realmAPI.getContainerCookies('work');
console.log(cookies);
```

## 构建

```bash
# 开发模式
npm run dev

# macOS 生产构建
npm run build:mac
```

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
| ipc-handlers.js | 主进程 IPC 通道注册（cookie/history/shortcut/...） |
| shortcut-manager.js | 快捷键默认表 + 注册/重建（**默认值唯一来源**） |
| cookie-manager.js | Cookie 持久化（session ↔ cookies.json 合并） |
| favorites-manager.js | 收藏数据存储（better-sqlite3，全局共享） |
| src/preload.js | 安全暴露 IPC 接口给渲染进程 |
| src/renderer.js | 渲染进程逻辑，处理 UI 交互 |
| src/favorites-page.js | 收藏列表页（realm://favorites）逻辑 |
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

### 新增快捷键（完整链路，五处都要改）

以"打开设置" `CmdOrCtrl+,` 为例：

1. **`shortcut-manager.js`** — `DEFAULT_SHORTCUTS` 加 `'openSettings': 'CmdOrCtrl+,'`（默认值的唯一来源）
2. **`src/renderer.js`** — `SHORTCUT_NAMES` 加中文名 `'openSettings': '打开设置页面'`（设置页显示用）
3. **`src/renderer.js`** — `initShortcuts` 的 switch 加 `case 'openSettings': openSettingsTab(); break;`
4. 行为函数（如 `openSettingsTab`）在 renderer 中定义；设置按钮等 UI 入口共用此函数

**无需**改 `ipc-handlers.js` / `preload.js` —— 注册/触发链路是通用的。重置走 `realmAPI.resetShortcut(action)`（`shortcut:reset` 通道），主进程删除自定义覆盖后 `getShortcuts` 的 `{...DEFAULT, ...custom}` 合并语义自动回落默认，**不要在 renderer 再写一份默认表**。

### 内部页面（`realm://`）打开新 Tab

`realm://favorites` / `realm://history` / `realm://settings` 等页面加载在 webview 中。在 guest 内打开新 tab 的标准做法：

```js
window.open(url, '_blank');
```

主进程 `main.js` 的 `setWindowOpenHandler` 统一拦截，按 D-09 决策在**来源容器**新建 tab。不要为这些页面单独写 IPC。

### Cookie 面板的数据源语义

- **Session tab** = 容器当前活 cookie（`ses.cookies.get({})`），唯一可写源
- **File tab** = `cookies.json` 磁盘快照，只读视图
- 保存按钮永远是 `session → file` 单向：无论停在哪个 tab，IPC 都只从 session 读。File tab 下保存按钮 `disabled`（`updateSourceTabUI` 联动）
- Cookie 行的 domain 列：无前导点 = host-only，有 `.` 前缀 = domain cookie（含子域）。UI 用 `cookie-badge-hostonly` 徽标区分，避免看起来像重复行

### `state.currentContainer` 同步约定

修改 `state.currentContainer` 后必须重渲染侧边栏，否则「当前」徽标和 active 高亮会滞后：

```js
state.currentContainer = tab.containerId;
renderContainerList();  // 必跟
```

参考 `switchTab`（容器跟随活动 tab）和 `switchContainer`（用户主动切换）的现有写法。

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

## 环境隔离

开发环境和正式环境使用独立的 `userData` 目录，互不干扰：

| 命令 | 环境 | userData 路径 |
|------|------|--------------|
| `npm run dev` | 开发 | `~/Library/Application Support/realm-dev/` |
| `npm start` / .app | 正式 | `~/Library/Application Support/realm/` |

实现在 `main.js` 顶部，通过 `process.env.NODE_ENV === 'development'` 判断：

```javascript
if (process.env.NODE_ENV === 'development') {
  app.setName('realm-dev');
}
```

这会影响所有本地存储：
- electron-store 配置（`realm-config.json`）
- Cookie JSON 文件（`cookies/`）
- Session Partitions（`Partitions/`）

## 调试

### 开发模式
```bash
npm run dev
```
- 主进程日志：终端输出
- 渲染进程日志：开发者工具 Console

### 调试案例（docs/debug/）

- [fill_form 假成功排查实录](docs/debug/fill-form-silent-success.md) — CDP 表单填写三层根因：`Input.enable` 已被 Chromium 128+ 移除（Input 命令无需 enable）；表单填写用 `Input.insertText` 真实输入管线而非 JS 赋值；工具结果必须回读校验杜绝 `filled` 虚报；AI 口语字段名需语义映射 + availableFields 重试
- [fill_form 焦点输入管线排查实录（未完结）](docs/debug/fill-form-focus-pipeline.md) — insertText 需要输入管线层焦点（DOM focus/activeElement ≠ keyboard focus）；合成点击后填写必定成功的 workaround；macOS IMK 异常可能吞 insertText；含候选修复方向 D1-D4 与交接备注

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

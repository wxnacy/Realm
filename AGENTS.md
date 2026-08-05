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
| bin/realm-cli.js | CLI 入口文件（全局命令 `realm`） |
| cli/commands/container.js | 容器管理命令（list, show） |
| cli/utils.js | CLI 工具函数（配置文件读取） |

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

### 添加新的 CLI 命令

CLI 工具结构：
```
bin/realm-cli.js          # 入口，参数解析和路由
cli/commands/             # 命令模块目录
  container.js            # 容器相关命令
cli/utils.js              # 工具函数（配置读取等）
```

添加新命令步骤：
1. 在 `cli/commands/` 下创建新命令模块（如 `cookie.js`）
2. 导出 `run(subcommand, options, positionals)` 函数
3. 在 `bin/realm-cli.js` 的 `main()` 中添加路由

添加容器子命令：
1. 在 `cli/commands/container.js` 的 `run()` 函数中添加 case
2. 实现对应函数

扩展字段读取：
- `getFieldValue(container, field)` 函数支持从顶级属性或 `envVars` 按 key 查找
- 添加新数据源只需修改此函数

## CLI 工具使用

全局命令行工具 `realm`，用于容器管理（无需启动 Electron 应用）。

### 安装

```bash
npm link  # 创建全局符号链接
```

### 基本命令

```bash
realm help                          # 显示帮助
realm version                       # 显示版本
realm container list                # 列出所有容器
realm container show <id>           # 显示容器详情
```

### 选项

```bash
--fields <field1,field2,...>        # 指定显示字段（逗号分隔）
--env, -e <dev|prod>                # 指定环境（默认：正式环境）
```

### 使用示例

```bash
# 列出容器（默认显示 ID、名称）
realm container list

# 显示自定义字段（如 envVars 中的值）
realm container list --fields phone,email,BILIBILI_NAME

# 开发环境
realm container list -e dev

# 组合使用
realm container list --env dev --fields phone,email,notes
```

### 字段查找逻辑

`--fields` 支持从容器对象的任意字段读取值：
1. 优先从顶级属性查找（如 `phone`, `email`, `notes`）
2. 如果顶级属性不存在，从 `envVars` 数组中按 `key` 查找（如 `BILIBILI_NAME`）
3. 对象/数组类型的值会显示为 JSON 字符串

### 本地开发测试

```bash
# 直接运行（不安装到全局）
node bin/realm-cli.js container list
node bin/realm-cli.js container list -e dev --fields phone
```

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
- [fill_form 焦点输入管线排查实录](docs/debug/fill-form-focus-pipeline.md) — insertText 打进的是输入管线焦点元素（DOM focus/activeElement ≠ keyboard focus，焦点在 embedder 时会把填表文本打进 AI 聊天框造成串字）；根治：insertText 前合成 dispatchMouseEvent 点击落位 + readback 裁决 + 原生 setter 回退双保险
- [GitHub 登录跳转 `/sessions/two-factor/app` 404 排查实录](docs/debug/github-login-404-two-factor-app.md) — 双层根因：① `Network.setUserAgentOverride` 在**未导航过的 webContents** 上永久挂起（不要在 `web-contents-created` 阶段对未导航 webview 发 CDP Network 命令）；② **改代码不修旧数据**——历史 session 残留于 `Partitions/container-<id>` + `containers/<id>/cookies.json`，换容器就好、旧容器不行时清这两个位置（须先退出应用，运行中删除会被刷盘重建）

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

### 开发/正式环境差异 → 发布前必查

引入两类环境可能存在差异的改动时，**提交前必须主动考虑打包发布问题**，不能只在 `npm run dev` 下验证：

- **原生模块（nodejieba / better-sqlite3 等）**：JS 层 `fs` 能读 app.asar 内文件，但原生 `fopen`/`dlopen` 不行。词典、数据文件等被原生代码读取的资源必须：① `package.json` build 配置加 `asarUnpack`；② `app.isPackaged` 时显式把路径指到 `process.resourcesPath/app.asar.unpacked/...`（参考 `favorites-manager.js` 的 `nodejieba.load`）
- **路径**：`__dirname` 拼出的路径在 asar 内外含义不同；打包后要落盘或被原生读取的资源一律走 `process.resourcesPath` / `app.getPath('userData')`
- **新增依赖**：检查依赖包里是否带 `.node`、二进制、数据文件，有就要过一遍上面两条
- **发布前验证**：`make install` 装出 .app 后**实际启动一次**（不是只跑 dev），确认无原生崩溃再发布。启动闪退看 `~/Library/Logs/DiagnosticReports/Realm-*.ips`

事故参考：0.1.4 nodejieba 词典未解包，cppjieba 原生 fopen 读 asar 内路径失败直接 abort，启动必崩（修复见 9a1ae11）。

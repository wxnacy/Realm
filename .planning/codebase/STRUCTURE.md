# Codebase Structure

**Analysis Date:** 2026-07-23

## Directory Layout

```
Realm/
├── .gitignore                    # Git 忽略规则
├── CLAUDE.md                     # 项目说明和开发指南
├── README.md                     # 项目介绍
├── main.js                       # Electron 主进程入口
├── package.json                  # 项目配置和依赖
├── .planning/                    # GSD 规划目录
│   └── codebase/                 # 代码库分析文档
└── src/                          # 源代码目录
    ├── index.html                # 主界面 HTML 结构
    ├── preload.js                # Preload 脚本（IPC 桥接）
    ├── renderer.js               # 渲染进程逻辑
    └── styles/
        └── main.css              # 主样式文件
```

## Directory Purposes

**Root Directory:**
- Purpose: 项目根目录，包含配置文件和主进程入口
- Contains: package.json, main.js, README.md, CLAUDE.md
- Key files: `main.js` (主进程), `package.json` (配置)

**src/:**
- Purpose: 源代码目录，包含渲染进程相关文件
- Contains: HTML、JavaScript、CSS 文件
- Key files: `index.html`, `renderer.js`, `preload.js`

**src/styles/:**
- Purpose: 样式文件目录
- Contains: CSS 文件
- Key files: `main.css`

**.planning/:**
- Purpose: GSD 规划目录，存储项目规划和代码分析文档
- Contains: Markdown 文档
- Generated: Yes (由 GSD 工具生成)
- Committed: No (在 .gitignore 中)

## Key File Locations

**Entry Points:**
- `main.js`: Electron 主进程入口，应用启动时首先执行
- `src/index.html`: 渲染进程入口 HTML，BrowserWindow 加载的页面
- `src/renderer.js`: 渲染进程逻辑入口，HTML 加载完成后执行

**Configuration:**
- `package.json`: 项目配置、依赖、脚本、构建配置
- `.gitignore`: Git 忽略规则

**Core Logic:**
- `main.js`: 容器管理、窗口管理、IPC 处理、应用生命周期
- `src/preload.js`: IPC 桥接，安全暴露 API 给渲染进程
- `src/renderer.js`: UI 交互逻辑、状态管理、DOM 操作

**UI Definition:**
- `src/index.html`: 页面结构、模态框、组件布局
- `src/styles/main.css`: 样式定义、主题变量、组件样式

**Documentation:**
- `README.md`: 项目介绍和使用说明
- `CLAUDE.md`: 开发指南、架构说明、代码规范

## Naming Conventions

**Files:**
- JavaScript: 小写 + 连字符（kebab-case），如 `preload.js`, `renderer.js`
- HTML: 小写，如 `index.html`
- CSS: 小写 + 连字符，如 `main.css`
- 配置文件: 小写，如 `package.json`

**Directories:**
- 小写，如 `src/`, `styles/`

**JavaScript 变量/函数:**
- camelCase: `containerId`, `windowContainerMap`, `loadContainers()`
- 常量: UPPER_SNAKE_CASE: `DEFAULT_CONTAINERS`

**CSS:**
- 变量: 连字符，如 `--bg-primary`, `--text-secondary`
- 类名: 小写 + 连字符，如 `container-list`, `btn-icon`

**IPC 通道:**
- 动词-名词格式: `get-containers`, `switch-container`, `create-container`

## Where to Add New Code

**New IPC 接口:**
1. 在 `main.js` 中添加 `ipcMain.handle('channel-name', handler)` 处理器
2. 在 `src/preload.js` 中添加 `contextBridge.exposeInMainWorld` 方法
3. 在 `src/renderer.js` 中通过 `window.realmAPI` 调用

**New UI 组件:**
1. 在 `src/index.html` 中添加 HTML 结构
2. 在 `src/styles/main.css` 中添加样式
3. 在 `src/renderer.js` 中添加交互逻辑

**New 容器属性:**
1. 在 `main.js` 的 `DEFAULT_CONTAINERS` 中添加属性
2. 更新 `src/preload.js` 中的 API 返回类型
3. 更新 `src/renderer.js` 中的渲染逻辑

**New 模态框:**
1. 在 `src/index.html` 的 `<body>` 末尾添加 `<dialog>` 元素
2. 在 `src/styles/main.css` 中添加模态框样式
3. 在 `src/renderer.js` 中添加显示/隐藏逻辑

**New 快捷键:**
- 在 `src/renderer.js` 的 `setupEventListeners()` 函数中添加 keydown 监听 (`renderer.js:278`)

## Special Directories

**.planning/:**
- Purpose: GSD 规划目录，存储项目规划、代码分析、阶段计划等文档
- Generated: Yes (由 GSD 工具自动生成)
- Committed: No (在 .gitignore 中排除)

**dist/:**
- Purpose: 构建输出目录
- Generated: Yes (由 electron-builder 生成)
- Committed: No (在 .gitignore 中排除)

**node_modules/:**
- Purpose: 依赖包目录
- Generated: Yes (由 npm install 生成)
- Committed: No (在 .gitignore 中排除)

## Project Scripts

```bash
npm start          # 启动应用（生产模式）
npm run dev        # 启动应用（开发模式，开启 DevTools）
npm run build      # 构建应用
npm run build:mac  # 构建 macOS 版本
```

## Dependencies

**Runtime:**
- `electron-store` ^8.1.0: 持久化存储容器配置

**Development:**
- `electron` ^32.0.0: Electron 框架
- `electron-builder` ^24.13.0: 应用打包工具

---

*Structure analysis: 2026-07-23*

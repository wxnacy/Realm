# Realm Browser - CLAUDE.md

## 项目概述

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，支持独立的 Cookie 管理和 AI Agent 集成。

核心目标：
- 每个容器完全隔离（Cookie、缓存、存储）
- 可视化容器管理
- 多窗口支持与跨窗口 Tab 拖拽
- AI Agent 集成（基于 pi-agent-core SDK）

## 技术架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Main Process                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  container-   │  │   window-    │  │    tab-      │                  │
│  │  manager      │  │   manager    │  │    manager   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│           │                │                 │                           │
│           ▼                ▼                 ▼                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Session Manager                               │   │
│  │  (persist:container-work, persist:container-*)                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│           │                                                             │
│  ┌────────┴────────────────────────────────────────────────────────┐   │
│  │                     20 个功能模块                                │   │
│  │  cookie-manager    favorites-manager    history-manager          │   │
│  │  download-manager  shortcut-manager     context-menu-manager     │   │
│  │  ai-manager        cdp-manager          drag-coordinator         │   │
│  │  credential-manager address-manager     frequent-sites-manager   │   │
│  │  assignment-rules  ua-ch-manager        media-sniffer            │   │
│  │  dev-requests-writer favicon-fetcher                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ IPC (contextBridge)                      │
│                              ▼                                          │
└──────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          Renderer Process                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        UI Layer                                  │   │
│  │  - Container List (Sidebar)                                      │   │
│  │  - Toolbar (URL, Navigation)                                     │   │
│  │  - Browser View (webview/webContents)                            │   │
│  │  - Bookmarks Bar                                                 │   │
│  │  - Modals (Container CRUD, Cookie Manager)                       │   │
│  │  - realm:// 内部页面 (history/favorites/settings/downloads/newtab)│   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
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

### 主进程核心模块

| 文件 | 说明 |
|------|------|
| main.js | 主进程入口，应用生命周期管理、模块组装、操作确认 IPC、本地 HTTP 服务器 |
| ipc-handlers.js | 集中注册所有 IPC 处理器，使用 `container:*` 等命名空间格式 |
| container-manager.js | 容器 CRUD，Session partition 管理，4 个默认容器 |
| window-manager.js | 窗口注册表、容器映射、窗口位置持久化（Phase 36）、跨窗口广播 |
| tab-manager.js | Tab 生命周期管理，多窗口支持（Phase 35），Tab 回收（D-07 上限 20） |
| shortcut-manager.js | 快捷键管理，before-input-event 实现，14 个默认快捷键 |
| cookie-manager.js | Cookie 持久化（session ↔ cookies.json 合并），`.www` 域名去重 |
| context-menu-manager.js | 右键菜单管理（标签页/网页），已关闭标签栈 LIFO |
| drag-coordinator.js | 跨窗口 Tab 拖拽协调器，状态机 idle->dragging->ended/cancelled |

### 数据管理模块

| 文件 | 说明 |
|------|------|
| favorites-manager.js | 收藏夹管理，better-sqlite3，全局 favorites 表，FTS5 全文搜索 |
| history-manager.js | 历史记录管理，每容器独立表，FIFO 淘汰（每容器上限 10000 条） |
| download-manager.js | 下载管理器，进度追踪、SQLite 持久化、滑动窗口速度计算 |
| credential-manager.js | 登录凭据加密存储（safeStorage + macOS Keychain） |
| address-manager.js | 收货地址加密存储（safeStorage） |
| frequent-sites-manager.js | 常用网站管理，frecency 算法（频率+最近性加权） |
| dev-requests-writer.js | CDP 抓取请求的 SQLite 异步批量写入队列 |

### AI 与网络模块

| 文件 | 说明 |
|------|------|
| ai-manager.js | AI Agent 管理器，基于 pi-agent-core SDK，LLM 连接、工具注册、对话状态 |
| cdp-manager.js | CDP 调试器管理器，Network 域抓包、AI 工具调试器管理 |
| ua-ch-manager.js | UA Client Hints 覆盖（CDP Network.setUserAgentOverride） |
| media-sniffer.js | 媒体嗅探器（网络拦截/脚本注入/DOM 监听三种方式） |
| assignment-rules.js | URL 自动容器分配规则 |
| favicon-fetcher.js | Favicon 远程抓取转 data URL（net.fetch，非 undici） |

### 渲染进程文件

| 文件 | 说明 |
|------|------|
| src/renderer.js | 渲染进程核心逻辑（UI 交互、Tab 管理、容器切换） |
| src/preload.js | contextBridge 安全暴露 IPC 接口 |
| src/webview-preload.js | webview guest 预加载脚本 |
| src/index.html | 主界面结构 |
| src/newtab.html + src/newtab-page.js | 新标签页（realm://newtab），常用网站网格、搜索 |
| src/history.html + src/history-page.js | 浏览历史页面（realm://history），日期分组、搜索过滤 |
| src/favorites.html + src/favorites-page.js | 收藏夹页面（realm://favorites），文件夹树、拖拽排序 |
| src/settings.html + src/settings-page.js | 设置页面（realm://settings），快捷键设置、规则管理 |
| src/downloads.html + src/downloads-page.js | 下载内容页面（realm://downloads） |
| src/devrequests.html + src/devrequests-page.js | 开发者请求页面 |
| src/player.html + src/player.js + src/player.css | 多媒体播放器页面 |
| src/bookmarks-bar.js + src/bookmarks-bar-menu.js | 书签栏组件 |
| src/container-env-presets.js | 容器环境变量预设 |
| src/ai-brand-map.js | AI 品牌词典+模型元数据快照（scripts/generate-ai-brand-map.js 生成，勿手改；数据源 models.dev + @lobehub/icons-static-svg，均 MIT） |
| src/model-family.js | 模型家族分组/每组最新选取/图标 HTML（window.ModelFamily，settings 页与 renderer 共用） |
| src/assets/ai-icons/ | 品牌 SVG 图标子集（统一白色圆角底板渲染；kimi 等白字形图标用深色底板，dark 标记由生成器写入词典） |

### CLI 工具

| 文件 | 说明 |
|------|------|
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
2. **`src/settings-page.js`** — `SHORTCUT_NAMES` 加中文名 `'openSettings': '打开设置页面'`，同时 `SHORTCUT_GROUPS` 对应分组加 action id（否则设置页不渲染该快捷键）
3. **`src/renderer.js`** — `initShortcuts` 的 switch 加 `case 'openSettings': openSettingsTab(); break;`
4. 行为函数（如 `openSettingsTab`）在 renderer 中定义；设置按钮等 UI 入口共用此函数

**无需**改 `ipc-handlers.js` / `preload.js` —— 注册/触发链路是通用的。重置走 `realmAPI.resetShortcut(action)`（`shortcut:reset` 通道），主进程删除自定义覆盖后 `getShortcuts` 的 `{...DEFAULT, ...custom}` 合并语义自动回落默认，**不要在 renderer 再写一份默认表**。

### 内部页面（`realm://`）打开新 Tab

`realm://favorites` / `realm://history` / `realm://settings` 等页面加载在 webview 中。在 guest 内打开新 tab 的标准做法：

```js
window.open(url, '_blank');
```

主进程 `main.js` 的 `setWindowOpenHandler` 统一拦截，按 D-09 决策在**来源容器**新建 tab。不要为这些页面单独写 IPC。

### 内部页面 CSP：markup 内联 style 会被拦截

`realm://` 页面的 CSP 是 `style-src 'self'`（无 unsafe-inline），**HTML markup 里的 `style="display:none"` 属性不生效**，元素会在页面加载时短暂或持续可见。规则：

- 元素的**初始隐藏**必须走 CSS 类规则（如 `.ai-modal-overlay { display:none }`）
- JS 里 `el.style.display = 'flex'`（CSSOM 方式）不受 CSP 限制，可正常覆盖样式表规则
- 显隐切换用具体的 `'flex'/'block'/'none'` 值，不要依赖 `''` 回落到 markup 状态
- 同理不要在内联 style 里写 `mask-image`（单色品牌图标因此改用 `<img>` + 白色圆角底板，见 `model-family.js iconHtml`；白字形图标如 kimi 用 `.ai-icon-dark-tile` 深色底板，dark 标记在词典数据里）

### AI 供应商模型分组与品牌图标

设置页 AI 分区的模型列表按「品牌家族」分组（如 Qwen 3 / Qwen Max / GLM 4.6）：

- `src/ai-brand-map.js`（生成的快照）：品牌别名表、供应商图标表、模型元数据（family/release_date/能力/模态）
- `src/model-family.js`：`groupModels` 分组（词典 → 斜杠后段 → 启发式）、`latestPerGroup`（需求：≥10 个模型时每组只自动添加最新一个）、`iconHtml` 图标渲染
- 分组规则：剩余串**字母开头**取子产品线（qwen-image → Qwen Image），**数字开头**取版本号（qwen3.8-max → Qwen 3.8），参数量（235b/8x7b）和日期（2026-02-13/-1106）先剥离
- 供应商 `enabled` 字段（默认 true）：设置页编辑器右上角开关即改即存；禁用后聊天框模型下拉不展示，存储的 activeProvider 记录保留，重新启用自动恢复
- 词典更新：`curl -sL https://models.dev/api.json -o /tmp/realm-modelsdev.json && npm pack @lobehub/icons-static-svg -p /tmp/realm-icons && tar xzf /tmp/realm-icons/*.tgz -C /tmp/realm-icons && node scripts/generate-ai-brand-map.js`

### Cookie 面板的数据源语义

- **Session tab** = 容器当前活 cookie（`ses.cookies.get({})`），唯一可写源
- **File tab** = `cookies.json` 磁盘快照，只读视图
- 保存按钮永远是 `session → file` 单向：无论停在哪个 tab，IPC 都只从 session 读。File tab 下保存按钮 `disabled`（`updateSourceTabUI` 联动）
- Cookie 行的 domain 列：无前导点 = host-only，有 `.` 前缀 = domain cookie（含子域）。UI 用 `cookie-badge-hostonly` 徽标区分，避免看起来像重复行

### Cookie `.www` 域名去重机制

**背景**：Keycloak 登录时会同时往 `www.codebuddy.cn` 和 `.www.codebuddy.cn` 两个域设 cookie，导致请求头翻倍，触发 nginx 400 Bad Request（Request Header Or Cookie Too Large）。

**去重规则**：同一 `name|path|裸域名` 下，优先保留无前导点的 host-only 版本（`www.codebuddy.cn`），丢弃 `.www` domain 版本（`.www.codebuddy.cn`）。

**改动时必须同步修改的三处**（都含 `.www` 去重逻辑）：

| 位置 | 函数 | 作用 |
|------|------|------|
| `cookie-manager.js` | `loadCookies` | 启动时：文件去重 + session 去重 |
| `cookie-manager.js` | `saveCookies` | 退出/手动保存时：合并去重 + session 去重 |
| `cookie-manager.js` | `saveDomainCookies` | 快速保存时：合并去重 + session 去重 |
| `cookie-manager.js` | `compareDomainCookies` | 同步检查时：`toMap` 内用裸域名做 key + 去重 |

**核心原理**：session 去重只在保存时运行。服务端可能在浏览过程中重新设 `.www` cookie 到 session，所以每次保存后都要清理 session。比较时 `toMap` 统一用裸域名做 key，使得 `.www.codebuddy.cn|name` 和 `www.codebuddy.cn|name` 视为同一 cookie。

### `state.currentContainer` 同步约定

修改 `state.currentContainer` 后必须重渲染侧边栏，否则「当前」徽标和 active 高亮会滞后：

```js
state.currentContainer = tab.containerId;
renderContainerList();  // 必跟
```

参考 `switchTab`（容器跟随活动 tab）和 `switchContainer`（用户主动切换）的现有写法。

## 多窗口支持

### 窗口管理架构

**window-manager.js** 核心数据结构：
- `windows: Map<windowId, BrowserWindow>` -- 所有通过 createMainWindow 创建的窗口
- `managedWindowIds: Set<number>` -- 受信窗口 ID 集合
- `windowContainerMap: Map<number, string>` -- 窗口与容器映射

**tab-manager.js** 多窗口支持（Phase 35）：
- 每个 Tab 对象包含 `windowId` 字段
- `activeTabs: Map<windowId, tabId>` 按窗口维护活动 Tab
- `getTabsByWindowId` / `closeTabsByWindowId` 按窗口操作

### 窗口位置持久化（Phase 36）

```javascript
// window-manager.js
const windowBoundsStore = new Store({ name: 'window-bounds' });

// moved/resized 事件实时保存
saveWindowBounds(windowId, bounds);

// 启动时恢复 + 越界检测
restoreWindowBounds(windowId);
```

### 跨窗口 Tab 拖拽

**drag-coordinator.js** 实现：
- 自定义 mousedown/mousemove/mouseup 事件（非 HTML5 DnD）
- 状态机：idle -> dragging -> ended/cancelled
- IPC 通道：drag:start/update-position/end/cancel/state-changed

## 数据库架构

### 共享数据库：history.db

| 模块 | 表名 | 说明 |
|------|------|------|
| history-manager | `history_{containerId}` | 每容器独立历史记录表 |
| favorites-manager | `favorites` | 全局收藏夹表（与容器解耦） |
| download-manager | `downloads` | 下载记录表 |
| credential-manager | `credentials` | 登录凭据表（safeStorage 加密） |
| address-manager | `addresses` | 收货地址表（safeStorage 加密） |

### 独立数据库

| 数据库 | 模块 | 说明 |
|--------|------|------|
| dev-requests.db | dev-requests-writer | CDP 抓取的网络请求记录 |

### 关键特性

- **FTS5 全文搜索**：favorites-manager 使用 nodejieba 中文分词
- **fractional-indexing**：收藏夹拖拽排序
- **FIFO 淘汰**：历史记录每容器上限 10000 杁
- **frecency 算法**：常用网站按频率+最近性加权

## realm:// 协议

### 协议注册

项目注册了 `realm://` 自定义协议（privileged scheme），支持以下内部页面：

| 页面 | 路径 | 说明 |
|------|------|------|
| 新标签页 | `realm://newtab` | 常用网站网格、搜索 |
| 历史记录 | `realm://history` | 日期分组、搜索过滤 |
| 收藏夹 | `realm://favorites` | 文件夹树、拖拽排序 |
| 设置 | `realm://settings` | 快捷键设置、规则管理 |
| 下载 | `realm://downloads` | 下载内容列表 |
| 开发者请求 | `realm://devrequests` | 网络请求监控 |

### 数据获取方式

内部页面通过本地 HTTP 服务器的 `/api/*` 端点获取数据（非直接 IPC）：

```javascript
// main.js
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/history')) { ... }
  if (req.url.startsWith('/api/favorites')) { ... }
  // ...
});
```

**主窗口（index.html）不能 fetch 这些 HTTP API**：主窗口从 `file://` 加载，
fetch `http://localhost:PORT` 是跨域请求会被 CORS 拦截（`TypeError: Failed to fetch`）。
数据访问分层约定：
- **主窗口 renderer**（受信 webContents）→ 一律走 preload 暴露的 `realmAPI.*` IPC
- **webview guest 内部页面**（`http://localhost:PORT` 同源）→ 走 `/api/*` + URL token 鉴权

事故参考：Phase 38 模型选择器下拉打不开——renderer.js 直接 fetch `/api/ai/providers`，
叠加单引号模板字符串不插值，双重失效。

## AI Agent 集成

### ai-manager.js

- 基于 pi-agent-core SDK
- LLM 连接与对话管理
- 工具注册与调用
- 操作确认机制（requestActionConfirmation）

### cdp-manager.js

- CDP 调试器管理
- Network 域抓包
- AI 工具调试器管理

### ua-ch-manager.js

- UA Client Hints 覆盖
- CDP Network.setUserAgentOverride

## 媒体嗅探器

### media-sniffer.js

三种检测方式：
1. 网络拦截（webRequest）
2. 脚本注入（executeJavaScript）
3. DOM 监听（MutationObserver）

### 播放器页面

- `src/player.html` + `src/player.js` + `src/player.css`
- 支持 HLS（hls.js）、DASH（dashjs）、FLV（mpegts.js）
- 配置项在设置页面管理

## 环境隔离

开发、调试、测试、正式四个环境使用独立的 `userData` 目录，互不干扰：

| 命令 | 环境 | userData 路径 | 自动打开 DevTools | 热加载 |
|------|------|--------------|-------------------|--------|
| `npm run dev` | 开发 | `~/Library/Application Support/realm-dev/` | ❌ | ✅ |
| `npm run debug` | 调试 | `~/Library/Application Support/realm-dev/` | ✅ | ✅ |
| `npm run test` | 测试 | `~/Library/Application Support/realm-test/` | ❌ | ❌ |
| `npm start` / .app | 正式 | `~/Library/Application Support/realm/` | ❌ | ❌ |

实现在 `main.js` 顶部，通过 `process.env.NODE_ENV` 判断：

```javascript
// 环境隔离：开发/调试/测试环境使用独立的 userData 目录
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
  app.setName('realm-dev');
} else if (process.env.NODE_ENV === 'test') {
  app.setName('realm-test');
}
```

**热重载配置**（仅开发/调试模式）：
```javascript
// 热重载配置（仅开发/调试模式，测试模式不启用）
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
  try { require('electron-reloader')(module); } catch {}
}
```

**自动打开 DevTools**（仅调试模式）：
```javascript
// 调试环境启动即打开主窗口 DevTools（停靠右侧，调试 realmAPI/mediaAPI）
if (mainWindow && process.env.NODE_ENV === 'debug') {
  mainWindow.webContents.openDevTools();
}
```

### 构建安装命令

| 命令 | 用途 | 安装路径 |
|------|------|---------|
| `make install` | 构建正式版 .app | `/Applications/Realm.app` |
| `make install-test` | 构建测试版 .app | `/Applications/Realm-Test.app` |

`make install-test` 构建时会临时在 main.js 注入 `process.env.NODE_ENV = 'test'`，构建完成后自动恢复源代码。测试版使用独立的 appId（`com.realm.browser.test`）和 productName（`Realm-Test`）。

这会影响所有本地存储：
- electron-store 配置（`realm-config.json`）
- Cookie JSON 文件（`cookies/`）
- Session Partitions（`Partitions/`）

## 调试

### 环境配置

项目支持三种运行环境，通过 `NODE_ENV` 环境变量区分：

| 环境 | 命令 | userData 目录 | 自动打开 DevTools | 热加载 | 用途 |
|------|------|---------------|-------------------|--------|------|
| **开发** | `npm run dev` | `~/Library/Application Support/realm-dev/` | ❌ | ✅ | 日常开发，快速迭代 |
| **调试** | `npm run debug` | `~/Library/Application Support/realm-dev/` | ✅ | ✅ | 需要调试时使用，自动打开 DevTools |
| **测试** | `npm run test` | `~/Library/Application Support/realm-test/` | ❌ | ❌ | 测试验证，数据隔离 |

**环境隔离说明：**
- `dev` 和 `debug` 共享同一个 userData 目录（`realm-dev`），方便切换时保留数据
- `test` 使用独立的 userData 目录（`realm-test`），不影响开发数据
- 只有 `debug` 模式会自动打开 DevTools，`dev` 模式需要手动打开
- `dev` 和 `debug` 支持热重载，`test` 不支持（更接近生产环境行为）

### 开发模式
```bash
npm run dev
```
- 主进程日志：终端输出
- 渲染进程日志：开发者工具 Console（需手动打开）

### 调试模式
```bash
npm run debug
```
- 自动打开开发者工具
- 适合需要调试渲染进程或 DevTools 的场景

### 调试案例（docs/debug/）

- [fill_form 假成功排查实录](docs/debug/fill-form-silent-success.md) — CDP 表单填写三层根因：`Input.enable` 已被 Chromium 128+ 移除（Input 命令无需 enable）；表单填写用 `Input.insertText` 真实输入管线而非 JS 赋值；工具结果必须回读校验杜绝 `filled` 虚报；AI 口语字段名需语义映射 + availableFields 重试
- [fill_form 焦点输入管线排查实录](docs/debug/fill-form-focus-pipeline.md) — insertText 打进的是输入管线焦点元素（DOM focus/activeElement ≠ keyboard focus，焦点在 embedder 时会把填表文本打进 AI 聊天框造成串字）；根治：insertText 前合成 dispatchMouseEvent 点击落位 + readback 裁决 + 原生 setter 回退双保险
- [GitHub 登录跳转 `/sessions/two-factor/app` 404 排查实录](docs/debug/github-login-404-two-factor-app.md) — 双层根因：① `Network.setUserAgentOverride` 在**未导航过的 webContents** 上永久挂起（不要在 `web-contents-created` 阶段对未导航 webview 发 CDP Network 命令）；② **改代码不修旧数据**——历史 session 残留于 `Partitions/container-<id>` + `containers/<id>/cookies.json`，换容器就好、旧容器不行时清这两个位置（须先退出应用，运行中删除会被刷盘重建）
- [部分网站整页漆黑排查实录](docs/debug/webview-transparent-background-dark-page.md) — webview guest 默认背景透明，不显式设背景的网页（如部分 Docusaurus 站点）会透出窗口深色底色 `backgroundColor: '#1a1a1a'` 导致正文漆黑；修复：`.browser-view webview { background: #fff }` 兜底白画布，网站自身背景不透明时不受影响

### 查看容器数据
```javascript
// 在渲染进程开发者工具中执行
const cookies = await window.realmAPI.getContainerCookies('work');
console.log(cookies);
```

## 构建

```bash
# 开发模式（热重载，不自动打开 DevTools）
npm run dev

# 调试模式（热重载，自动打开 DevTools）
npm run debug

# 测试模式（无热重载，数据隔离）
npm run test

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

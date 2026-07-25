# Architecture Research: v1.1 Feature Integration

**Domain:** Electron 桌面应用 / 多容器隔离浏览器
**Researched:** 2026-07-25
**Confidence:** HIGH
**Scope:** v1.1 新功能与现有架构的集成分析

## Executive Summary

v1.1 包含四个新功能：容器属性扩展、收藏与历史记录、常用网站推荐、设置页面。现有架构采用模块化设计（container-manager、tab-manager、cookie-manager 等独立模块 + ipc-handlers 集中注册 + preload contextBridge 暴露），新功能可以沿用同一模式扩展，无需重构现有代码。核心集成点是 electron-store 持久化层和 IPC 通信层。

## 现有架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │container-mgr │ │  tab-mgr     │ │ cookie-mgr   │        │
│  │(CRUD/config) │ │(lifecycle)   │ │(persistence) │        │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │
│         │                │                │                 │
│  ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐        │
│  │assignment-   │ │  window-mgr  │ │  shortcut-   │        │
│  │rules         │ │(BrowserWin)  │ │  manager     │        │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │
│         └────────────────┼────────────────┘                 │
│                          ▼                                  │
│                   ipc-handlers.js                           │
│              (集中注册所有 IPC 处理器)                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC (contextBridge)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  preload.js → window.realmAPI                        │   │
│  │  renderer.js → UI 交互 + state 管理                  │   │
│  │  index.html → 页面结构                                │   │
│  │  main.css → 样式                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 现有数据持久化

| Store 实例 | 文件名 | 存储内容 |
|-----------|--------|---------|
| configStore | realm-config.json | 容器配置（id, name, color, icon） |
| tabStore | tabs.json | Tab 列表、计数器、活动 Tab ID |
| ruleStore | assignment-rules.json | 分配规则（containerId, pattern, enabled） |
| shortcutStore | shortcuts.json | 快捷键配置 |

### 现有 IPC 通道命名规范

所有通道使用 `模块:动作` 格式：
- `container:list`, `container:create`, `container:update`, `container:delete`
- `tab:list`, `tab:create`, `tab:switch`, `tab:close`
- `cookie:save`, `cookie:load`, `cookie:export`, `cookie:import`
- `rule:list`, `rule:create`, `rule:update`, `rule:delete`, `rule:reorder`
- `shortcut:list`, `shortcut:set`

## Feature 1: 容器属性扩展（phone/email/notes）

### 集成点分析

**修改范围：** 仅扩展现有模块，无需新建模块。

| 文件 | 修改内容 | 影响 |
|------|---------|------|
| `container-manager.js` | DEFAULT_CONTAINERS 增加字段、createContainer/updateContainer 支持新字段 | 低 — 纯数据扩展 |
| `ipc-handlers.js` | validateContainerConfig/validateContainerUpdates 增加字段校验 | 低 — 增加校验规则 |
| `src/preload.js` | 无需修改 — createContainer/updateContainer 已接受 Object 参数 | 无 |
| `src/renderer.js` | 容器创建/编辑 Modal 增加表单字段 | 中 — UI 变更 |
| `src/index.html` | Modal 内增加 phone/email/notes 输入框 | 中 — HTML 结构变更 |
| `src/styles/main.css` | 新表单字段样式 | 低 |

### 数据流

```
用户编辑容器属性
    │
    ▼
renderer.js → realmAPI.updateContainer(id, { name, color, icon, phone, email, notes })
    │
    ▼ (IPC: container:update)
ipc-handlers.js → validateContainerUpdates(updates)  ← 增加 phone/email/notes 校验
    │
    ▼
container-manager.js → updateContainer(id, updates)
    │
    ├───► containers Map 更新
    │
    └───► configStore.set('containers', [...])  ← electron-store 自动包含新字段
```

### 关键设计决策

1. **electron-store 无 Schema 限制** — 新字段直接添加到容器对象即可，旧数据自动忽略缺失字段（读取时 undefined），无需数据库迁移。

2. **getContainers() 返回值需扩展** — 当前仅返回 `{ id, name, color, icon }`，需增加 `phone, email, notes`。修改 `container-manager.js` 的 `getContainers()` 函数。

3. **表单验证规则：**
   - phone: 可选，允许为空，非空时格式校验（正则）
   - email: 可选，允许为空，非空时格式校验（正则）
   - notes: 可选，允许为空，限制最大长度（如 500 字符）

### 模态框 UI 扩展

现有容器创建/编辑 Modal（`containerModal`）需要在名称、颜色、图标选择器之后增加三个字段：
- 手机号输入框（tel 类型）
- 邮箱输入框（email 类型）
- 备注文本框（textarea）

## Feature 2: 收藏与历史记录

### 集成点分析

**新增范围：** 需要新建两个主进程模块 + 扩展 IPC + 渲染进程 UI。

| 新增/修改 | 文件 | 说明 |
|----------|------|------|
| 新增 | `bookmark-manager.js` | 收藏夹 CRUD、持久化 |
| 新增 | `history-manager.js` | 浏览历史记录、查询、清理 |
| 修改 | `ipc-handlers.js` | 注册 bookmark:*, history:* 通道 |
| 修改 | `src/preload.js` | 暴露 bookmark/history API |
| 修改 | `src/renderer.js` | 收藏/历史 UI 交互 |
| 修改 | `src/index.html` | 收藏/历史模态框 HTML |
| 修改 | `main.js` | 引入新模块、历史记录事件钩子 |

### 架构设计：bookmark-manager.js

```
bookmark-manager.js
├── Store: electron-store({ name: 'bookmarks' })
├── 数据结构: { id, containerId, title, url, favicon, createdAt, folder }
├── API:
│   ├── getBookmarks(containerId?) → Array
│   ├── addBookmark(containerId, { title, url, favicon }) → Object
│   ├── updateBookmark(id, updates) → Object
│   ├── deleteBookmark(id) → boolean
│   ├── reorderBookmarks(orderedIds) → void
│   └── exportBookmarks() / importBookmarks()
└── 持久化: electron-store JSON 文件
```

**数据结构：**
```javascript
{
  id: 'bm-1',           // 自动生成
  containerId: 'work',   // 所属容器（null 表示全局）
  title: 'GitHub',
  url: 'https://github.com',
  favicon: 'https://github.com/favicon.ico',
  folder: '开发',        // 文件夹分类（可选）
  createdAt: 1721900000000,
  order: 0               // 排序权重
}
```

### 架构设计：history-manager.js

```
history-manager.js
├── Store: electron-store({ name: 'history' })
├── 数据结构: { id, containerId, url, title, visitTime, visitCount }
├── API:
│   ├── getHistory(containerId?, options) → Array
│   │   options: { limit, offset, startDate, endDate, keyword }
│   ├── addVisit(containerId, { url, title }) → void
│   ├── deleteHistory(id) → boolean
│   ├── clearHistory(containerId?, before?) → void
│   ├── getFrequentlyVisited(containerId?, limit) → Array  ← Feature 3 依赖
│   └── searchHistory(keyword, containerId?) → Array
└── 持久化: electron-store JSON 文件
```

**数据结构：**
```javascript
{
  id: 'hist-1',
  containerId: 'work',
  url: 'https://github.com',
  title: 'GitHub',
  visitTime: 1721900000000,
  visitCount: 15
}
```

**关键设计：历史记录写入时机**

历史记录需要在 webview 导航完成时自动写入。现有代码在 `renderer.js` 的 `bindWebviewEvents` 中监听 `did-navigate` 和 `did-navigate-in-page` 事件。有两种方案：

- **方案 A（推荐）：渲染进程写入** — 在 `bindWebviewEvents` 的 `did-navigate` 回调中调用 `window.realmAPI.addHistoryVisit(containerId, { url, title })`。优点是简单直接，利用现有事件绑定。
- **方案 B：主进程写入** — 在主进程的 `web-contents-created` 事件中监听 webview guest 的导航事件。优点是渲染进程崩溃不影响记录，但实现复杂。

**推荐方案 A**，因为历史记录丢失（渲染进程崩溃）的概率极低，且代码改动最小。

### IPC 通道设计

```javascript
// 收藏夹
'bookmark:list'       // (containerId?) → Array
'bookmark:add'        // (containerId, { title, url, favicon }) → Object
'bookmark:update'     // (id, updates) → Object
'bookmark:delete'     // (id) → boolean
'bookmark:reorder'    // (orderedIds) → void
'bookmark:export'     // () → file dialog
'bookmark:import'     // () → file dialog

// 历史记录
'history:list'        // (containerId?, options) → Array
'history:add'         // (containerId, { url, title }) → void
'history:delete'      // (id) → boolean
'history:clear'       // (containerId?, before?) → void
'history:search'      // (keyword, containerId?) → Array
'history:frequent'    // (containerId?, limit) → Array
```

### UI 集成点

1. **工具栏** — 增加收藏按钮（星标图标）和历史按钮（时钟图标）
2. **收藏模态框** — 列表展示、搜索、文件夹分类、拖拽排序
3. **历史模态框** — 按日期分组列表、搜索、删除单条/清空
4. **URL 输入框** — 输入时匹配收藏和历史记录，显示下拉建议（可选，复杂度高，建议 defer）

## Feature 3: 常用网站智能推荐

### 集成点分析

**依赖：** 依赖 Feature 2 的 history-manager.js 的 `getFrequentlyVisited()` 方法。

| 新增/修改 | 文件 | 说明 |
|----------|------|------|
| 修改 | `history-manager.js` | 增加 getFrequentlyVisited 算法 |
| 修改 | `src/renderer.js` | 新标签页增加常用网站网格 |
| 修改 | `src/index.html` | 新标签页 HTML 结构扩展 |
| 修改 | `src/styles/main.css` | 常用网站网格样式 |

### 数据流

```
用户打开新标签页
    │
    ▼
renderer.js → showWebview(tabId) / switchTab(tabId)
    │
    ▼ (检测到 tab.url 为空)
显示 newTabPage
    │
    ▼
renderer.js → realmAPI.getFrequentlyVisited(containerId, 8)
    │
    ▼ (IPC: history:frequent)
history-manager.js → 计算高频访问站点
    │
    ├───► 按 visitCount 降序排列
    │
    ├───► 取 top N（默认 8 个）
    │
    └───► 返回 [{ url, title, favicon, visitCount }]
    │
    ▼
renderer.js → renderFrequentSites(sites)
    │
    └───► 渲染 2×4 网格（类似 Chrome 新标签页）
```

### 常用网站算法

```javascript
/**
 * 获取常用网站列表
 * 算法：按 URL 域名聚合访问次数，取 top N
 * @param {string} containerId - 容器 ID（null 为全局）
 * @param {number} limit - 返回数量上限
 * @returns {Array<{domain, url, title, favicon, visitCount}>}
 */
function getFrequentlyVisited(containerId, limit = 8) {
  // 1. 从历史记录中筛选容器匹配的记录
  // 2. 按 URL 域名（origin）聚合 visitCount
  // 3. 按 visitCount 降序排列
  // 4. 取 top N
  // 5. 补充 favicon（使用 Google Favicon API: https://www.google.com/s2/favicons?domain=xxx）
}
```

**Favicon 获取策略：** 使用 `https://www.google.com/s2/favicons?domain=${domain}&sz=32` 作为 favicon URL，无需本地存储。

### UI 设计

新标签页现有结构：
- 搜索框
- 容器快捷入口

扩展后结构：
- 搜索框
- **常用网站网格**（2 行 × 4 列，每个站点显示 favicon + 域名）
- 容器快捷入口

## Feature 4: 设置页面

### 集成点分析

**新增范围：** 新建设置管理模块 + 设置 UI。

| 新增/修改 | 文件 | 说明 |
|----------|------|------|
| 新增 | `settings-manager.js` | 应用设置管理、默认浏览器注册 |
| 修改 | `ipc-handlers.js` | 注册 settings:* 通道 |
| 修改 | `src/preload.js` | 暴露 settings API |
| 修改 | `src/renderer.js` | 设置页面 UI 交互 |
| 修改 | `src/index.html` | 设置模态框 HTML |
| 修改 | `main.js` | 引入 settings-manager |

### 架构设计：settings-manager.js

```
settings-manager.js
├── Store: electron-store({ name: 'settings' })
├── 数据结构:
│   ├── defaultBrowser: boolean        // 是否设为默认浏览器
│   ├── startupBehavior: string        // 'restore' | 'newTab' | 'specific'
│   ├── searchEngine: string           // 'google' | 'bing' | 'baidu' | 'custom'
│   ├── customSearchUrl: string        // 自定义搜索引擎 URL
│   ├── downloadPath: string           // 下载路径
│   └── theme: string                  // 'dark' | 'light' | 'system'（预留）
├── API:
│   ├── getSettings() → Object
│   ├── updateSettings(partial) → Object
│   ├── isDefaultBrowser() → boolean
│   ├── setAsDefaultBrowser() → void
│   └── getDefaultSettings() → Object
└── 持久化: electron-store JSON 文件
```

### 默认浏览器设置

Electron 提供 `app.setAsDefaultProtocolClient('http')` 和 `app.isDefaultProtocolClient('http')` API，但设置为默认浏览器需要更底层的 macOS 系统调用：

```javascript
/**
 * 检查是否为默认浏览器
 * @returns {boolean}
 */
function isDefaultBrowser() {
  // macOS: 使用 shell.getDefaultProtocolClient('http')
  // 注意：Electron 的 app.isDefaultProtocolClient 仅检查自定义协议
  const { shell } = require('electron');
  return shell.getDefaultProtocolClient
    ? shell.getDefaultProtocolClient('http') === 'realm'
    : false;
}

/**
 * 请求设为默认浏览器
 * macOS 使用 LSSetDefaultHandlerForURLScheme
 * 但更实用的方案是打开系统偏好设置引导用户手动设置
 */
function requestSetAsDefaultBrowser() {
  const { shell } = require('electron');
  // macOS: 打开系统偏好设置中的默认应用设置
  shell.openExternal('x-apple.systempreferences:com.apple.preference');
}
```

**实际方案：** macOS 上设置默认浏览器需要系统级权限，Electron 应用通常通过 `shell.openExternal()` 引导用户到系统设置页面手动切换。按钮点击后显示指引说明。

### IPC 通道设计

```javascript
// 设置管理
'settings:get'         // () → Object
'settings:update'      // (partial) → Object
'settings:is-default'  // () → boolean
'settings:set-default' // () → void
```

### UI 集成点

现有工具栏已有 `settingsBtn` 按钮，但目前未绑定功能。设置页面使用模态框（与现有 Modal 风格一致）：

**设置项：**
1. 默认浏览器 — 显示当前状态 + "设为默认" 按钮
2. 启动行为 — 下拉选择（恢复上次 / 新标签页 / 指定 URL）
3. 默认搜索引擎 — 下拉选择 + 自定义 URL 输入
4. 下载路径 — 路径显示 + "选择" 按钮

## 新增组件依赖关系

```
Feature 1: 容器属性扩展
    └── 无外部依赖，仅修改现有模块

Feature 2: 收藏与历史记录
    └── 新增 bookmark-manager.js（独立）
    └── 新增 history-manager.js（独立）
    └── 修改 ipc-handlers.js（注册新通道）
    └── 修改 renderer.js（UI + webview 事件钩子）

Feature 3: 常用网站推荐
    └── 依赖 Feature 2 的 history-manager.js
    └── 修改 renderer.js（新标签页 UI）

Feature 4: 设置页面
    └── 新增 settings-manager.js（独立）
    └── 修改 ipc-handlers.js（注册新通道）
    └── 修改 renderer.js（设置 UI）
```

## 建议构建顺序

```
Wave 1: 容器属性扩展（Feature 1）
    └── 最简单，仅修改现有模块
    └── 无新模块依赖
    └── 验证 electron-store 字段扩展模式

Wave 2: 历史记录（Feature 2 前半）
    └── 新增 history-manager.js
    └── 注册 history:* IPC 通道
    └── webview 导航事件钩子写入历史
    └── 历史记录模态框 UI

Wave 3: 收藏夹（Feature 2 后半）
    └── 新增 bookmark-manager.js
    └── 注册 bookmark:* IPC 通道
    └── 工具栏收藏按钮 + 收藏模态框 UI

Wave 4: 常用网站推荐（Feature 3）
    └── 依赖 Wave 2 的 history-manager.js
    └── getFrequentlyVisited 算法
    └── 新标签页常用网站网格

Wave 5: 设置页面（Feature 4）
    └── 新增 settings-manager.js
    └── 注册 settings:* IPC 通道
    └── 设置模态框 UI
    └── 默认浏览器检测与引导
```

**构建顺序理由：**
- Wave 1 最轻量，快速验证
- Wave 2（历史记录）是 Wave 4（常用网站）的前置依赖
- Wave 3（收藏夹）与 Wave 2 共享 IPC 注册模式，紧随其后
- Wave 4 在 Wave 2 完成后可立即开始
- Wave 5 独立于其他功能，可随时插入

## 关键架构约束

1. **electron-store 无 Schema 迁移** — 新字段直接添加，旧数据自动兼容。但删除字段时旧数据仍保留该字段（无害）。

2. **assertTrustedSender 安全校验** — 所有新 IPC 处理器必须调用 `assertTrustedSender(event)` 防止 webview guest 调用特权通道。

3. **DOM 安全（WR-13）** — 所有用户输入（书签名、历史标题、URL）必须使用 `textContent` 而非 `innerHTML` 渲染，防止 XSS。

4. **主进程单点控制** — 数据验证、业务逻辑在主进程（各 manager 模块），渲染进程仅负责 UI 和 IPC 调用。

5. **模态框一致性** — 新增模态框复用现有 `<dialog>` 元素模式，保持 ESC 关闭、点击外部关闭的行为一致。

## Sources

- 现有代码库分析：main.js, container-manager.js, tab-manager.js, ipc-handlers.js, src/preload.js, src/renderer.js
- Electron 官方文档：shell API, app API, electron-store
- v1.0 架构研究：.planning/research/ARCHITECTURE.md

---
*Architecture research for: Realm Browser v1.1*
*Researched: 2026-07-25*

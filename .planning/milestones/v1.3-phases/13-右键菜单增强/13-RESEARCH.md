# Phase 13: 右键菜单增强 - Research

**Researched:** 2026-07-28
**Domain:** Electron Menu API, webview context-menu, Chrome-style context menus
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 使用 Electron 原生 Menu API 构建右键菜单，系统级菜单，性能好
- **D-02:** 主进程统一管理所有菜单逻辑，通过 IPC 与渲染进程通信
- **D-03:** 使用系统原生菜单样式，跟随操作系统风格（macOS/Windows）
- **D-04:** 菜单在鼠标点击位置立即显示，使用系统默认动画
- **D-05:** 通过 webview 的 context-menu 事件检测网页右键上下文（图片、链接等）
- **D-06:** 标签页右键通过 Tab 栏 DOM 事件检测
- **D-07:** 标签页菜单包含：关闭标签页、关闭其他标签页、关闭左侧标签页、关闭右侧标签页、重新打开已关闭标签页、固定标签页
- **D-08:** 禁用项灰色显示不可点击（如只有一个标签页时禁用"关闭其他标签页"）
- **D-09:** 菜单项之间使用系统默认分隔线分组
- **D-10:** 菜单项显示对应的快捷键
- **D-11:** 根据右键点击的元素类型动态生成菜单（通用/图片/链接/选中文本）
- **D-12:** 通用菜单包含：导航操作、页面操作、开发者工具、文本操作四大分组
- **D-13 ~ D-16:** 各菜单分组的具体菜单项定义
- **D-17:** 图片菜单：在新标签页中打开图片、将图片另存为、复制图片、复制图片地址
- **D-18:** 链接菜单：在新标签页中打开、在新容器标签页中打开（子菜单）、复制链接地址、在后台标签页中打开
- **D-19 ~ D-22:** 菜单交互规则（自动关闭、复制后 toast、图标、Chrome 顺序）

### Claude's Discretion
- 菜单项的具体图标选择
- toast 提示的具体样式和位置
- 子菜单容器选择器的具体交互细节
- 查看源代码页面的具体实现方式

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | 标签页右键菜单：关闭标签页、关闭其他标签页、关闭右侧标签页、重新打开已关闭标签页、固定标签页 | Electron Menu API `Menu.buildFromTemplate()` + 渲染进程 Tab 管理逻辑 |
| CTX-02 | 网页通用右键菜单：后退、前进、刷新、另存为、打印、查看页面源代码、检查元素 | webview `context-menu` 事件 + `webContents` API |
| CTX-03 | 图片右键菜单：在新标签页中打开图片、将图片另存为、复制图片、复制图片地址 | webview context-menu `params.mediaType === 'image'` + `clipboard.writeImage()` |
| CTX-04 | 超链接右键菜单：在新标签页中打开、在新容器标签页中打开、复制链接地址 | webview context-menu `params.linkURL` + 容器列表子菜单 |
| CTX-05 | 所有菜单项点击后执行对应功能，功能与 Chrome 浏览器一致 | Electron Menu 模板 click 回调 + IPC 通道 |
</phase_requirements>

## Summary

Phase 13 为 Realm Browser 添加 Chrome 风格的右键上下文菜单系统。技术方案基于 Electron 原生 `Menu` API，通过 `Menu.buildFromTemplate()` 构建菜单模板，`menu.popup()` 在鼠标位置弹出。网页内右键通过 webview 元素的 `context-menu` 事件获取上下文信息（元素类型、URL、选中文本等），然后由主进程根据上下文动态生成对应菜单。标签页右键通过渲染进程 DOM 事件检测，通过 IPC 通知主进程构建并显示菜单。

整个架构遵循 D-02 决策：主进程统一管理所有菜单逻辑，渲染进程仅负责事件检测和 UI 反馈（toast）。IPC 通信采用 `send`/`on` 模式（菜单请求）和 `on` 模式（菜单回调），与现有 IPC 命名规范一致。

**Primary recommendation:** 使用 `context-menu` 事件的 `params` 对象判断元素类型（`mediaType`、`linkURL`），动态构建菜单模板，在主进程使用 `Menu.buildFromTemplate()` + `menu.popup({ window })` 显示原生菜单。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 菜单构建与显示 | Main Process | — | Electron Menu API 仅在主进程可用 |
| 网页右键事件检测 | Renderer (webview event) | — | webview context-menu 事件在渲染进程触发 |
| 标签页右键事件检测 | Renderer (DOM event) | — | Tab 栏 DOM 在渲染进程 |
| 菜单动作执行（导航/关闭） | Main Process | Renderer | 主进程操作 webContents，渲染进程更新 UI |
| 剪贴板操作 | Main Process | — | Electron clipboard API 仅主进程可用 |
| 文件保存/打印 | Main Process | — | dialog/webContents API 仅主进程可用 |
| Toast 反馈 | Renderer | — | UI 展示在渲染进程 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron Menu API | 35.4.0 (built-in) | 构建原生上下文菜单 | Electron 内置，无需额外依赖 |
| Electron clipboard | 35.4.0 (built-in) | 复制文本/图片到剪贴板 | Electron 内置 |
| Electron nativeImage | 35.4.0 (built-in) | 处理图片数据（复制图片功能） | Electron 内置 |
| Electron dialog | 35.4.0 (built-in) | 另存为文件保存对话框 | Electron 内置 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | 本阶段不需要额外依赖 |

## Package Legitimacy Audit

本阶段不安装任何外部包，仅使用 Electron 内置 API。无需进行包合法性审计。

## Architecture Patterns

### System Architecture Diagram

```
用户右键点击
     │
     ├── Tab 栏右键 ──────────────────────────────────┐
     │   (renderer.js DOM contextmenu 事件)            │
     │                                                │
     ├── 网页内右键 ──────────────────────────────────┤
     │   (webview context-menu 事件)                  │
     │                                                │
     │   event.params 提取:                           │
     │   ├── mediaType (image/video/none)             │
     │   ├── srcURL (图片/视频地址)                    │
     │   ├── linkURL (链接地址)                       │
     │   ├── selectionText (选中文本)                  │
     │   └── editFlags (编辑能力)                     │
     │                                                │
     ▼                                                ▼
┌─────────────────────────────────────────────────────────┐
│              IPC: show-tab-context-menu                  │
│              IPC: show-web-context-menu                  │
│   payload: { tabId, tabCount, tabIndex, isPinned, ... } │
│   payload: { type, linkURL, srcURL, mediaType, ... }    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            context-menu-manager.js               │   │
│  │  buildTabMenu(tabInfo)                           │   │
│  │  buildWebMenu(contextInfo)                       │   │
│  │  └── 根据 type 选择:                             │   │
│  │      ├── imageMenu (图片专用)                     │   │
│  │      ├── linkMenu (链接专用 + 容器子菜单)         │   │
│  │      ├── textMenu (选中文本)                      │   │
│  │      └── generalMenu (通用页面)                   │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  Menu.buildFromTemplate(template)                       │
│  menu.popup({ window: mainWindow })                     │
│                         │                               │
│         ┌───────────────┼───────────────┐               │
│         ▼               ▼               ▼               │
│  click 回调执行:   clipboard API    webContents API     │
│  - closeTab()    - writeText()    - goBack()           │
│  - reopenTab()   - writeImage()   - goForward()        │
│  - togglePin()                     - reload()          │
│                                    - print()           │
│                                    - saveAs()          │
│                                    - openDevTools()    │
│                                    - viewSource()      │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              IPC 回调 → Renderer                         │
│  context-menu:close-tab                                 │
│  context-menu:close-other-tabs                          │
│  context-menu:reopen-tab                                │
│  context-menu:open-in-new-tab                           │
│  context-menu:copy-link-address (toast)                 │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
渲染进程处理回调 → 更新 Tab 栏 UI → 显示 toast
```

### Recommended Project Structure

```
/
├── context-menu-manager.js    # 新增：菜单模板构建 + popup 逻辑
├── main.js                    # 修改：注册 IPC 监听器
├── ipc-handlers.js            # 修改：添加 context-menu:* IPC 通道
├── src/preload.js             # 修改：暴露新 API
├── src/renderer.js            # 修改：右键事件监听 + toast
```

### Pattern 1: 主进程菜单构建

菜单模板在主进程构建，确保安全性（渲染进程无法篡改菜单项）。

```javascript
// Source: Electron 官方文档 https://www.electronjs.org/docs/latest/api/menu
const { Menu, MenuItem } = require('electron');

function buildTabContextMenu(tabInfo) {
  const template = [
    {
      label: '关闭标签页',
      accelerator: 'CmdOrCtrl+W',
      click: () => { /* 发送 IPC 回调给渲染进程 */ }
    },
    {
      label: '关闭其他标签页',
      enabled: tabInfo.tabCount > 1,
      click: () => { /* ... */ }
    },
    { type: 'separator' },
    {
      label: '重新打开已关闭标签页',
      accelerator: 'CmdOrCtrl+Shift+T',
      enabled: tabInfo.hasClosedTabs,
      click: () => { /* ... */ }
    },
    { type: 'separator' },
    {
      label: tabInfo.isPinned ? '取消固定' : '固定标签页',
      click: () => { /* ... */ }
    }
  ];
  return Menu.buildFromTemplate(template);
}
```

### Pattern 2: webview context-menu 事件处理

```javascript
// Source: Electron 官方文档 https://www.electronjs.org/docs/latest/api/webview-tag
webview.addEventListener('context-menu', (e) => {
  const params = e.params;
  // 判断元素类型
  const isImage = params.mediaType === 'image';
  const isLink = !!params.linkURL;
  const hasSelection = !!params.selectionText;

  // 发送到主进程构建菜单
  window.realmAPI.showWebContextMenu({
    type: isImage ? 'image' : isLink ? 'link' : 'general',
    linkURL: params.linkURL,
    srcURL: params.srcURL,
    mediaType: params.mediaType,
    selectionText: params.selectionText,
    canGoBack: webview.canGoBack(),
    canGoForward: webview.canGoForward(),
    isLoading: webview.isLoading(),
  });
});
```

### Anti-Patterns to Avoid

- **不要在渲染进程构建菜单模板**: 渲染进程可能被注入恶意脚本，菜单模板必须在主进程构建
- **不要使用 `ipcRenderer.invoke` 发送菜单请求**: 菜单是单向通知，应使用 `ipcRenderer.send`（异步无返回值）
- **不要硬编码快捷键字符串**: 使用 `CmdOrCtrl+` 前缀确保跨平台兼容
- **不要忘记 webview context-menu 的坐标**: `e.params.x` 和 `e.params.y` 是页面内坐标，`menu.popup()` 需要窗口坐标

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 原生菜单外观 | CSS 自定义菜单组件 | Electron `Menu.buildFromTemplate()` | 原生菜单性能好、跟随系统主题、支持键盘导航 |
| 剪贴板操作 | `document.execCommand('copy')` | Electron `clipboard.writeText/writeImage()` | execCommand 已废弃，clipboard API 更可靠 |
| 文件保存对话框 | 自定义文件选择器 | Electron `dialog.showSaveDialog()` | 原生对话框、权限正确、跨平台 |
| 图片数据获取 | Canvas 截图 | `nativeImage.createFromBuffer()` + fetch | 标准方式，不依赖 DOM |

**Key insight:** Electron 已经提供了完整的原生菜单、剪贴板、对话框 API，无需自行实现任何底层功能。

## webview Context Menu 事件参数详解

webview 元素的 `context-menu` 事件提供丰富的上下文参数，用于判断右键点击的元素类型：

| 参数 | 类型 | 用途 |
|------|------|------|
| `params.mediaType` | string | `'none'`/`'image'`/`'video'`/`'audio'`/`'canvas'`/`'file'`/`'plugin'` |
| `params.srcURL` | string | 媒体元素的 src URL（图片/视频/音频） |
| `params.linkURL` | string | 链接元素的 href URL |
| `params.linkText` | string | 链接文本内容 |
| `params.selectionText` | string | 选中的文本 |
| `params.pageURL` | string | 当前页面 URL |
| `params.frameURL` | string | 子框架 URL |
| `params.isEditable` | boolean | 是否在可编辑元素中 |
| `params.editFlags` | object | 编辑能力标志（canCut/canCopy/canPaste/canSelectAll） |
| `params.hasImageContents` | boolean | 是否是图片元素 |
| `params.suggestedFilename` | string | 建议的文件名（用于"另存为"） |
| `params.x`, `params.y` | integer | 右键点击的页面坐标 |

**元素类型判断逻辑：**
- 图片：`params.mediaType === 'image'` 或 `params.hasImageContents === true`
- 链接：`params.linkURL !== ''`
- 选中文本：`params.selectionText !== ''`
- 通用：以上都不满足

## Feature Implementation Details

### 1. 另存为 (Save As)

使用 `webContents.saveAs()` 触发系统原生保存对话框：

```javascript
// 主进程中
const contents = webview.webContents; // 需要从 guest webContents 获取
contents.saveAs(); // 触发系统另存为对话框
```

**注意：** `saveAs()` 是 `webContents` 的方法，需要获取到当前活动 webview 的 guest webContents。通过 `webContents.fromId(guestContentsId)` 获取。

### 2. 打印 (Print)

使用 `webContents.print()` 触发系统打印对话框：

```javascript
const contents = webContents.fromId(guestContentsId);
contents.print(); // 触发系统打印对话框
```

### 3. 查看页面源代码 (View Source)

使用 `view-source:` 协议在新标签页中打开：

```javascript
// 通知渲染进程在新标签页中打开 view-source:URL
hostWebContents.send('open-url-in-tab', {
  url: `view-source:${pageURL}`,
  containerId: null // 使用当前容器
});
```

**注意：** `view-source:` 是 Chromium 支持的标准协议，无需额外处理。

### 4. 检查元素 (Inspect Element)

使用 `webContents.openDevTools()` 打开开发者工具：

```javascript
const contents = webContents.fromId(guestContentsId);
contents.openDevTools({ mode: 'detach' }); // 在独立窗口打开
```

**注意：** 项目已有 DevTools 支持（Phase 12），可复用现有逻辑。

### 5. 复制图片 (Copy Image)

使用 `nativeImage` + `clipboard.writeImage()`：

```javascript
const { clipboard, nativeImage } = require('electron');
const https = require('https');

// 1. 获取图片数据
const response = await fetch(imageURL);
const buffer = await response.buffer();

// 2. 创建 nativeImage
const image = nativeImage.createFromBuffer(buffer);

// 3. 写入剪贴板
clipboard.writeImage(image);
```

**注意：** 需要处理跨域请求和 HTTPS 证书问题。建议使用 Electron 的 `net` 模块或 Node.js 的 `https` 模块。

### 6. 复制文本到剪贴板

使用 `clipboard.writeText()`：

```javascript
const { clipboard } = require('electron');
clipboard.writeText(textToCopy);
```

### 7. 打开图片在新标签页

通知渲染进程创建新 Tab：

```javascript
hostWebContents.send('open-url-in-tab', {
  url: imageURL,
  containerId: null
});
```

### 8. 在新容器标签页中打开链接

使用子菜单列出所有容器：

```javascript
{
  label: '在新容器标签页中打开',
  submenu: containers.map(container => ({
    label: `${container.icon} ${container.name}`,
    click: () => {
      hostWebContents.send('context-menu:open-in-container', {
        url: linkURL,
        containerId: container.id
      });
    }
  }))
}
```

### 9. 重新打开已关闭标签页

维护一个已关闭标签页的栈（LIFO）：

```javascript
// 渲染进程 state 中添加
const closedTabsStack = []; // 最多保存 10 个

// 关闭 Tab 时保存信息
function closeTab(tabId) {
  const tab = state.tabs.get(tabId);
  if (tab) {
    closedTabsStack.push({
      containerId: tab.containerId,
      url: tab.url,
      title: tab.title
    });
    if (closedTabsStack.length > 10) closedTabsStack.shift();
  }
  // ... 原有关闭逻辑
}

// 重新打开
function reopenClosedTab() {
  if (closedTabsStack.length === 0) return;
  const tabInfo = closedTabsStack.pop();
  createTab(tabInfo.containerId, tabInfo.url);
}
```

### 10. 固定标签页

添加 Tab 固定状态：

```javascript
// Tab 数据结构扩展
tab.pinned = false; // 默认不固定

// 固定/取消固定
function togglePinTab(tabId) {
  const tab = state.tabs.get(tabId);
  if (!tab) return;
  tab.pinned = !tab.pinned;
  // 更新 UI：固定标签页显示在最左侧，宽度缩小
  // 更新主进程持久化
  window.realmAPI.updateTab(tabId, { pinned: tab.pinned });
  renderTabs(); // 重新渲染 Tab 栏
}
```

## Codebase Integration

### 现有代码分析

**main.js:**
- 已导入 `Menu` 和 `dialog` 模块
- 已有 `web-contents-created` 事件监听，可在此处添加 `context-menu` 事件监听
- 已有 `notifyOpenUrlInTab()` 函数，可复用
- 已有 `getGuestContainerId()` 函数，可复用

**src/renderer.js:**
- 已有完整的 Tab 管理逻辑（`createTab`、`closeTab`、`switchTab`）
- 已有 `showToast()` 函数，可直接复用
- 已有 `state.tabs` Map 和 `state.webviews` Map
- Tab 栏事件委托已绑定在 `elements.tabList`

**src/preload.js:**
- 已有标准的 `contextBridge.exposeInMainWorld` 模式
- IPC 通道命名规范：`kebab-case` 格式

**ipc-handlers.js:**
- 已有 `assertTrustedSender()` 校验函数
- 已有 `activeWebviewContentsId` 跟踪
- 已有 `guestContainerMap` 映射

### 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `context-menu-manager.js` (新增) | 菜单模板构建、菜单项 click 处理、closedTabsStack 管理 |
| `main.js` | 在 `web-contents-created` 中添加 context-menu 事件监听，注册 IPC 监听器 |
| `ipc-handlers.js` | 添加 `context-menu:*` 相关 IPC 通道 |
| `src/preload.js` | 暴露 `showTabContextMenu`、`showWebContextMenu`、`onContextMenuAction` |
| `src/renderer.js` | Tab 栏右键监听、webview context-menu 监听、菜单回调处理、closedTabsStack |
| `src/index.html` | 无需修改（使用原生菜单，无 DOM 变更） |
| `src/styles/main.css` | 无需修改（现有 toast 样式已足够） |

### IPC 通道设计

**渲染进程 → 主进程（菜单请求）：**

| 通道 | 方向 | 模式 | 说明 |
|------|------|------|------|
| `show-tab-context-menu` | Renderer → Main | `send` | Tab 栏右键，payload: `{ tabId, tabCount, tabIndex, isPinned, hasClosedTabs }` |
| `show-web-context-menu` | Renderer → Main | `send` | 网页右键，payload: `{ type, linkURL, srcURL, mediaType, selectionText, canGoBack, canGoForward, isLoading, guestContentsId }` |

**主进程 → 渲染进程（菜单回调）：**

| 通道 | 方向 | 模式 | 说明 |
|------|------|------|------|
| `context-menu:close-tab` | Main → Renderer | `send` | 关闭指定 Tab |
| `context-menu:close-other-tabs` | Main → Renderer | `send` | 关闭其他 Tab |
| `context-menu:close-left-tabs` | Main → Renderer | `send` | 关闭左侧 Tab |
| `context-menu:close-right-tabs` | Main → Renderer | `send` | 关闭右侧 Tab |
| `context-menu:reopen-tab` | Main → Renderer | `send` | 重新打开已关闭 Tab |
| `context-menu:toggle-pin` | Main → Renderer | `send` | 切换 Tab 固定状态 |
| `context-menu:open-in-new-tab` | Main → Renderer | `send` | 在新 Tab 中打开 URL |
| `context-menu:open-in-bg-tab` | Main → Renderer | `send` | 在后台 Tab 中打开 |
| `context-menu:open-in-container` | Main → Renderer | `send` | 在指定容器 Tab 中打开 |
| `context-menu:copy-link-address` | Main → Renderer | `send` | 复制链接地址（触发 toast） |
| `context-menu:copy-image-address` | Main → Renderer | `send` | 复制图片地址（触发 toast） |
| `context-menu:add-to-favorites` | Main → Renderer | `send` | 添加到收藏夹 |

**主进程直接执行（无需回调渲染进程）：**

| 操作 | 实现方式 |
|------|---------|
| 后退/前进/刷新/停止 | `webContents.goBack()` 等 |
| 另存为 | `webContents.saveAs()` |
| 打印 | `webContents.print()` |
| 检查元素 | `webContents.openDevTools()` |
| 复制文本 | `clipboard.writeText()` |
| 复制图片 | `nativeImage.createFromBuffer()` + `clipboard.writeImage()` |
| 复制图片地址 | `clipboard.writeText(imageURL)` |
| 复制链接地址 | `clipboard.writeText(linkURL)` |

## Risks and Mitigations

### Risk 1: webview context-menu 坐标转换

**风险：** webview `context-menu` 事件的 `params.x/y` 是 webview 内部坐标，`menu.popup()` 需要窗口坐标。

**缓解：** 使用 `menu.popup({ window: mainWindow })` 不传 `x/y`，让 Electron 自动在鼠标位置显示。或者将 webview 坐标转换为窗口坐标（加上 webview 的 offset）。

**置信度：** HIGH — Electron 的 `menu.popup()` 在不传坐标时会自动使用鼠标当前位置。

### Risk 2: 复制图片的网络请求

**风险：** 复制图片需要从 URL 下载图片数据，可能遇到 CORS、证书错误、超时等问题。

**缓解：** 使用 Electron 的 `net` 模块发起请求（继承 webview 的 session），或使用 Node.js 的 `https` 模块忽略证书错误（仅限复制操作）。添加超时和错误处理，失败时显示 toast 提示。

**置信度：** MEDIUM — 需要实际测试各种图片 URL 的兼容性。

### Risk 3: view-source: 协议在 webview 中的支持

**风险：** `view-source:` 协议可能在 webview 中不被支持。

**缓解：** 测试 `view-source:` 是否可在 webview 中加载。如果不支持，备选方案是获取页面 HTML 源码并显示在新 Tab 中（使用 `webContents.executeJavaScript('document.documentElement.outerHTML')`）。

**置信度：** MEDIUM — Chromium 支持 `view-source:` 协议，但 webview 环境可能有差异。

### Risk 4: Tab 固定状态持久化

**风险：** 当前 Tab 数据结构中没有 `pinned` 字段。

**缓解：** 在 `tab-manager.js` 的 Tab 数据结构中添加 `pinned` 字段（默认 `false`），更新持久化逻辑。使用惰性填充策略（与容器扩展属性一致），旧数据自动兼容。

**置信度：** HIGH — 已有成熟的惰性填充模式（Phase 5 D-09）。

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前无测试框架） |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | 标签页右键菜单功能正确 | manual | 手动验证：右键点击 Tab → 菜单显示 → 各项功能正确 | N/A |
| CTX-02 | 网页通用右键菜单功能正确 | manual | 手动验证：网页空白处右键 → 菜单项完整 → 导航/打印/检查元素正常 | N/A |
| CTX-03 | 图片右键菜单功能正确 | manual | 手动验证：右键图片 → 复制图片/另存为/新标签页打开 | N/A |
| CTX-04 | 链接右键菜单功能正确 | manual | 手动验证：右键链接 → 新标签页/容器子菜单/复制地址 | N/A |
| CTX-05 | 所有功能与 Chrome 一致 | manual | 对比 Chrome 浏览器右键菜单 | N/A |

### Sampling Rate

- **Per task commit:** N/A（无自动化测试）
- **Per wave merge:** N/A
- **Phase gate:** 手动 UAT 验证所有菜单项功能

### Wave 0 Gaps

- [ ] 无自动化测试框架 — 本阶段为 UI 交互密集型，手动验证为主
- [ ] 需要手动测试菜单在 macOS 和 Windows 上的显示效果（当前仅 macOS）

## Common Pitfalls

### Pitfall 1: webview context-menu 事件不触发

**What goes wrong:** webview 的 `context-menu` 事件可能被网页的 `preventDefault()` 阻止。

**Why it happens:** 网页 JavaScript 可能监听了 `contextmenu` 事件并调用了 `preventDefault()`。

**How to avoid:** 在 webview 的 `did-attach` 事件中注入脚本，移除网页的 `contextmenu` 监听器。或者使用 `webContents` 的 `context-menu` 事件（主进程级别，不受网页影响）。

**Warning signs:** 右键点击网页时没有反应，或显示网页自定义的菜单。

### Pitfall 2: 菜单项快捷键与应用快捷键冲突

**What goes wrong:** 菜单项的 `accelerator` 可能与应用全局快捷键冲突。

**Why it happens:** 例如 `Cmd+W` 既用于"关闭标签页"菜单项，也可能被应用全局快捷键占用。

**How to avoid:** 确保菜单项的 `accelerator` 与 `shortcut-manager.js` 中的默认快捷键一致。菜单项的 `accelerator` 仅在菜单打开时有效，不会与全局快捷键冲突。

**Warning signs:** 快捷键不响应或执行了错误的操作。

### Pitfall 3: 复制图片失败（跨域/CORS）

**What goes wrong:** 复制图片时网络请求失败，无法获取图片数据。

**Why it happens:** 图片 URL 可能有 CORS 限制，或使用了不支持的协议（如 `data:` URL）。

**How to avoid:** 使用 Electron 的 `net` 模块发起请求（继承 webview 的 session，自动携带 Cookie），而不是浏览器的 `fetch` API。对于 `data:` URL，直接解码 base64 数据。

**Warning signs:** 复制图片后剪贴板为空，或 toast 显示"复制失败"。

### Pitfall 4: 固定标签页的 UI 表现

**What goes wrong:** 固定标签页后，Tab 栏的排序和样式没有更新。

**Why it happens:** 没有重新渲染 Tab 栏，或没有将固定标签页移到最左侧。

**How to avoid:** 在 `togglePinTab()` 后调用 `renderTabs()` 重新渲染整个 Tab 栏，确保固定标签页在最左侧、宽度缩小、显示固定图标。

**Warning signs:** 固定标签页的位置和样式与 Chrome 不一致。

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无右键菜单 | Electron 原生菜单 | Phase 13 | 提升用户体验，对齐 Chrome |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | webview `context-menu` 事件在 Electron 35.4.0 中正常工作 | webview Context Menu | 需要改用 `webContents.on('context-menu')` |
| A2 | `view-source:` 协议在 webview 中可正常加载 | View Source 实现 | 需要改用自定义 HTML 渲染源码 |
| A3 | `clipboard.writeImage()` 支持 PNG 和 JPEG 格式 | 复制图片实现 | 需要添加格式转换逻辑 |
| A4 | `webContents.saveAs()` 在 Electron 35.4.0 中可用 | 另存为实现 | 需要改用 `dialog.showSaveDialog()` + 手动下载 |

## Sources

### Primary (HIGH confidence)
- Electron 官方文档: `Menu` API — `Menu.buildFromTemplate()` 模板结构
- Electron 官方文档: `webview` tag — `context-menu` 事件和参数
- Electron 官方文档: `clipboard` API — `writeText()`、`writeImage()`
- Electron 官方文档: `nativeImage` API — `createFromBuffer()`、`createFromDataURL()`
- 项目代码库: `main.js`、`src/renderer.js`、`src/preload.js`、`ipc-handlers.js`

### Secondary (MEDIUM confidence)
- Electron GitHub issues: webview context-menu 事件的平台差异
- Chrome 浏览器右键菜单参考实现

### Tertiary (LOW confidence)
- `view-source:` 协议在 webview 中的支持情况（需实际测试）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Electron Menu API 是标准方案，文档完善
- Architecture: HIGH — 遵循项目现有 IPC 模式，架构清晰
- Pitfalls: MEDIUM — 复制图片和 view-source 需要实际测试验证

**Research date:** 2026-07-28
**Valid until:** 2026-08-28 (30 days — Electron API 稳定)

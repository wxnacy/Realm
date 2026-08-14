# Architecture Research — 多窗口支持 (v2.4)

**Domain:** Electron 32.x 多容器隔离浏览器 — 多窗口架构
**Researched:** 2026-08-14
**Confidence:** HIGH

## Executive Summary

本研究聚焦 v2.4 多窗口支持（MW-01~06）的架构设计。核心发现：当前架构是**深度单窗口假设** — `windowManager.getMainWindow()` 在 30+ 处调用，`assertTrustedSender()` 硬编码主窗口校验，`tab-manager` 全局 Tab Map 无窗口关联，`renderer.js` 持有独立的 Tab/Webview 状态。多窗口不是简单地"多开几个窗口"，而是需要重构四个核心子系统：**窗口管理**、**Tab 归属**、**IPC 路由**和**渲染进程状态**。

关键设计决策：
1. **Tab 全局追踪 + 窗口关联**：tab-manager 继续维护全局 Map，但每个 Tab 新增 `windowId` 字段
2. **IPC 信任模型扩展**：从"只信任一个主窗口"改为"信任所有由 createMainWindow 创建的窗口"
3. **每个窗口独立 renderer 状态**：每个 BrowserWindow 加载同一 index.html，但各自管理自己窗口内的 Tab
4. **webview 不能跨窗口移动**：Electron 的 webview 绑定到创建它的 BrowserWindow，Tab 迁移需要重建 webview

## 当前架构分析

### 单窗口假设的触点

| 位置 | 代码模式 | 影响范围 |
|------|---------|---------|
| `window-manager.js` | `mainWindowRef` 单例引用 | 所有需要主窗口的地方 |
| `window-manager.js` | `createMainWindow` 只创建一个 | 入口 |
| `ipc-handlers.js:assertTrustedSender` | `win.id !== mainWindow.id` 硬编码 | 所有 IPC 安全校验 |
| `main.js:requestActionConfirmation` | `windowManager.getMainWindow()` | AI 确认卡片路由 |
| `main.js:_notifyBookmarksBarRefresh` | `windowManager.getMainWindow()` | 收藏栏广播 |
| `main.js:app.on('open-url')` | `BrowserWindow.getFocusedWindow()` | 外部链接打开 |
| `main.js:before-quit` | `windowManager.getMainWindow()` | 退出提示 |
| `main.js:activate` | `BrowserWindow.getAllWindows().length === 0` | macOS 激活 |
| `main.js:shortcutManager` | `registerShortcuts(mainWindow)` | 全局快捷键 |
| `tab-manager.js` | `tabs` 全局 Map，无窗口关联 | Tab 数据模型 |
| `tab-manager.js` | `activeTabId` 全局单例 | 活动 Tab 状态 |
| `renderer.js` | `state.tabs` / `state.activeTabId` / `state.webviews` | 渲染进程 Tab 状态 |

### 不需要改动的模块

| 模块 | 原因 |
|------|------|
| `container-manager.js` | 容器是全局资源，不与窗口绑定 |
| `cookie-manager.js` | Cookie 按容器隔离，与窗口无关 |
| `assignment-rules.js` | URL 匹配规则全局共享 |
| `history-manager.js` | 历史记录按容器隔离 |
| `favorites-manager.js` | 收藏全局共享 |
| `frequent-sites-manager.js` | 常用网站全局共享 |
| `cdp-manager.js` | CDP 按 webview guest 管理 |
| `media-sniffer.js` | 嗅探按 session 管理 |
| `download-manager.js` | 下载按 session 管理 |
| `credential-manager.js` | 凭据按容器隔离 |
| `address-manager.js` | 地址按容器隔离 |
| `shortcut-manager.js` | 快捷键只需扩展到多窗口注册 |
| `src/preload.js` | realmAPI 接口不变，每个窗口各有一份 |

## 架构设计

### 新窗口管理模型

```
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│                                                         │
│  windowManager (重构)                                   │
│  ├── windows: Map<windowId, BrowserWindow>              │
│  ├── createMainWindow(containerId, container)           │
│  ├── getMainWindow() → 主窗口（兼容旧调用）              │
│  ├── getWindow(windowId) → 指定窗口                     │
│  ├── getAllWindows() → 所有窗口                          │
│  ├── sendToWindow(windowId, channel, data)              │
│  └── broadcast(channel, data) → 所有窗口                 │
│                                                         │
│  tabManager (扩展)                                      │
│  ├── tabs: Map<tabId, Tab>                              │
│  │   Tab 新增字段: windowId                             │
│  ├── activeTabId: Map<windowId, tabId>  // 每窗口独立    │
│  ├── createTab(windowId, containerId, url)              │
│  ├── moveTab(tabId, targetWindowId)                     │
│  └── closeTab(tabId)                                    │
│                                                         │
│  assertTrustedSender (扩展)                              │
│  └── 检查 event.sender ∈ windows Map                    │
└─────────────────────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │ Window 1 │  │ Window 2 │  │ Window 3 │
     │ Renderer │  │ Renderer │  │ Renderer │
     │ (default)│  │ (work)   │  │ (social) │
     │ Tabs: 3  │  │ Tabs: 2  │  │ Tabs: 1  │
     └──────────┘  └──────────┘  └──────────┘
```

### 数据模型变更

#### Tab 对象扩展

```javascript
// 当前 Tab 对象
{
  id: 'tab-1',
  containerId: 'default',
  url: 'https://example.com',
  title: 'Example',
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
  faviconUrl: '',
  pinned: false,
}

// 多窗口 Tab 对象（新增 windowId）
{
  id: 'tab-1',
  windowId: 1,           // 新增：BrowserWindow.id
  containerId: 'default',
  url: 'https://example.com',
  title: 'Example',
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
  faviconUrl: '',
  pinned: false,
}
```

#### 活动 Tab 状态变更

```javascript
// 当前：全局单例
let activeTabId = null;

// 多窗口：每窗口独立
const activeTabByWindow = new Map(); // windowId → tabId
```

#### Tab 持久化变更

```javascript
// electron-store 'tabs' 格式扩展
// 每个 tab 增加 windowId 字段
// 启动恢复时按 windowId 分组重建窗口
```

### IPC 信任模型扩展

```javascript
// 当前：只信任单个主窗口
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const mainWindow = windowManager.getMainWindow();
  if (!win || !mainWindow || win.id !== mainWindow.id) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}

// 多窗口：信任所有由 createMainWindow 创建的窗口
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !windowManager.isManagedWindow(win.id)) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}
```

### Tab 拖拽跨窗口机制

Electron 原生不支持跨窗口拖拽。需要自定义实现：

```
方案：IPC + 自定义拖拽协议

1. 拖拽开始（源窗口 renderer）
   ├── 设置拖拽数据：tabId, containerId, url, title
   ├── 使用 HTML5 Drag and Drop API（窗口内）
   └── 如果拖出窗口边界 → 通知主进程

2. 主进程处理
   ├── 创建新窗口（或找到目标窗口）
   ├── 从源窗口移除 Tab（tabManager.moveTab）
   ├── 在目标窗口添加 Tab
   └── 通知两个 renderer 更新 UI

3. 拖拽落位（目标窗口 renderer）
   ├── 接收 Tab 数据
   ├── 创建 webview
   └── 导航到 URL
```

**关键约束**：webview 不能跨窗口移动。每个 BrowserWindow 的 webview 绑定到该窗口的渲染进程。Tab 迁移时需要在目标窗口**重建 webview 并重新导航**，而非移动 DOM 元素。这意味着：
- 页面状态（滚动位置、表单输入）会丢失
- 需要从 URL 重新加载页面
- 这是 Chrome 等浏览器的相同行为，用户可接受

### "最后 Tab 关闭窗口" 规则

```
关闭 Tab 流程：

1. renderer 调用 closeTab(tabId)
2. tabManager 从全局 Map 删除
3. 检查：该 windowId 下是否还有 Tab？
   ├── 有 → 切换到相邻 Tab
   └── 无 → 关闭窗口
       ├── BrowserWindow.close()
       ├── 从 windowManager.windows Map 删除
       └── 如果是最后一个窗口 → 触发 app 退出流程
```

### 广播模式

当前很多功能需要向渲染进程广播事件。多窗口时需要决定广播策略：

```javascript
// 向所有窗口广播
function broadcast(channel, data) {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

// 只向拥有特定 Tab 的窗口广播
function sendToTabWindow(tabId, channel, data) {
  const tab = tabManager.getTab(tabId);
  if (!tab) return;
  const win = windows.get(tab.windowId);
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
```

**需要广播 vs 定向发送的场景：**

| 事件 | 策略 | 原因 |
|------|------|------|
| `bookmarks-bar:refresh` | 广播所有窗口 | 收藏栏全局共享 |
| `settings:updated` | 广播所有窗口 | 设置全局生效 |
| `tab:recycled` | 定向到目标窗口 | 只影响被回收 Tab 所在窗口 |
| `shortcut:triggered` | 定向到焦点窗口 | 快捷键作用于当前焦点窗口 |
| `action:request-confirmation` | 定向到 AI 所在窗口 | 确认卡片需在正确窗口显示 |
| `open-url-in-tab` | 定向到来源窗口 | 新 Tab 在来源 webview 所在窗口打开 |
| `show-quit-hint` | 广播所有窗口 | 退出提示所有窗口可见 |

## 组件边界

### 需要修改的组件

| 组件 | 当前职责 | 修改内容 | 复杂度 |
|------|---------|---------|--------|
| `window-manager.js` | 单窗口管理 | 重构为多窗口 Map，新增 `windows` Map、`isManagedWindow()`、`broadcast()` | High |
| `tab-manager.js` | 全局 Tab 管理 | Tab 对象新增 `windowId`，`activeTabId` 改为 Map，新增 `moveTab()` | High |
| `ipc-handlers.js` | IPC 注册 | `assertTrustedSender` 扩展，部分处理器增加 windowId 参数 | Medium |
| `main.js` | 主进程入口 | 将 `getMainWindow()` 调用替换为定向/broadcast，Dock 菜单新增"新建窗口" | High |
| `src/renderer.js` | UI 逻辑 | Tab/Webview 状态改为只管理当前窗口的子集，接收 windowId 参数 | High |
| `src/index.html` | UI 结构 | 可能无需改动（每个窗口加载同一文件） | Low |
| `shortcut-manager.js` | 快捷键 | `registerShortcuts` 扩展为支持多窗口 | Low |
| `context-menu-manager.js` | 右键菜单 | Tab 右键菜单增加"移动到新窗口"选项 | Low |

### 不需要修改的组件

| 组件 | 原因 |
|------|------|
| `src/preload.js` | 每个窗口各有一份 preload 实例，API 接口不变 |
| `container-manager.js` | 容器全局共享 |
| `cookie-manager.js` | Cookie 按容器隔离 |
| `assignment-rules.js` | 规则全局共享 |
| `history-manager.js` | 历史按容器隔离 |
| `favorites-manager.js` | 收藏全局共享 |
| `frequent-sites-manager.js` | 常用网站全局共享 |
| `cdp-manager.js` | CDP 按 webContents 管理 |
| `media-sniffer.js` | 嗅探按 session 管理 |
| `download-manager.js` | 下载按 session 管理 |
| `credential-manager.js` | 凭据按容器隔离 |
| `address-manager.js` | 地址按容器隔离 |
| `ai-manager.js` | AI Manager 全局单例 |

### 可能需要新增的组件

| 组件 | 职责 | 必要性 |
|------|------|--------|
| `window-state-manager.js` | 管理每个窗口的几何状态（位置、大小）持久化 | 可选，后期增强 |
| `drag-drop-manager.js` | 管理跨窗口 Tab 拖拽协议 | 必要（MW-03） |

## 数据流

### 新建窗口流程 (MW-01)

```
1. 用户点击 Dock 右键 → "新建窗口"
   │
   ▼
2. main.js: app.on('activate') 或 Dock 菜单
   │
   ▼
3. windowManager.createMainWindow('default', container)
   ├── 创建 BrowserWindow（新实例）
   ├── 加载 src/index.html
   ├── 注册到 windows Map
   └── 返回新窗口
   │
   ▼
4. renderer 初始化（新窗口的渲染进程）
   ├── 获取 windowId（通过 IPC 或 preload 注入）
   ├── 加载容器列表
   ├── 创建初始 Tab
   └── 渲染 UI
   │
   ▼
5. shortcutManager.registerShortcuts(newWindow)
   └── 为新窗口注册快捷键
```

### Tab 拖拽出窗口 (MW-02)

```
1. 用户拖拽 Tab 到窗口外部
   │
   ▼
2. renderer: dragstart 事件
   ├── 设置 dataTransfer: { tabId, containerId, url, title }
   └── 监听 dragend 事件
   │
   ▼
3. 检测：dragend 的 screenX/Y 超出窗口边界？
   ├── 否 → 正常窗口内拖拽排序
   └── 是 → 通知主进程创建新窗口
   │
   ▼
4. IPC: tab:detach-to-new-window { tabId }
   │
   ▼
5. main.js 处理
   ├── tabManager.getTab(tabId)
   ├── windowManager.createMainWindow(containerId, container)
   ├── tabManager.moveTab(tabId, newWindowId)
   ├── 通知源 renderer 移除 Tab DOM
   └── 通知新 renderer 创建 Tab + webview
   │
   ▼
6. 新窗口 renderer
   ├── 接收 Tab 数据
   ├── 创建 webview
   ├── 导航到 URL
   └── 渲染 Tab 栏
```

### 窗口间 Tab 拖拽 (MW-03)

```
1. 用户拖拽 Tab 从窗口 A 到窗口 B
   │
   ▼
2. 由于 Electron 不支持跨窗口原生拖拽，
   使用以下方案之一：
   │
   ├── 方案 A：拖到窗口边界时创建新窗口（MW-02 的扩展）
   │
   ├── 方案 B：右键菜单 "移动到窗口" 列表
   │   └── 显示所有窗口列表，用户选择目标
   │
   └── 方案 C：键盘快捷键
       └── Cmd+Shift+X "移动 Tab 到新窗口"
```

**推荐方案 B + C**：方案 A 实现复杂且 UX 不直观（用户不知道拖到哪里算"出了窗口"）。方案 B 通过右键菜单提供明确的"移动到窗口"选项，方案 C 提供快捷键快速操作。

### 广播刷新流程

```
场景：收藏栏状态变更，需要通知所有窗口

1. favoritesManager.deleteRecord(id)
   │
   ▼
2. _notifyBookmarksBarRefresh()
   │  旧：mainWindow.webContents.send(...)
   │  新：windowManager.broadcast('bookmarks-bar:refresh')
   │
   ▼
3. 每个窗口的 renderer 收到事件
   └── 各自刷新收藏栏 UI
```

## 关键设计决策

### D-MW-01: Tab 全局追踪 vs 窗口内追踪

**决策：全局追踪 + 窗口关联**

- tab-manager 继续维护全局 `Map<tabId, Tab>`
- Tab 对象新增 `windowId` 字段
- 每个窗口的 renderer 只管理自己窗口的 Tab 子集

**理由：**
1. Tab 拖拽跨窗口时，只需修改 `windowId` 字段，不需移动数据
2. 全局 Tab 回收（TAB_MAX_COUNT）需要跨窗口感知
3. 持久化恢复需要知道每个 Tab 属于哪个窗口

### D-MW-02: IPC 信任模型

**决策：信任所有由 createMainWindow 创建的窗口**

- windowManager 维护 `managedWindowIds: Set<number>`
- assertTrustedSender 检查 `managedWindowIds.has(win.id)`
- 播放器窗口等辅助窗口不加入 managedWindowIds

**理由：**
1. 每个窗口都是合法的主窗口，都应该被信任
2. 保持与现有 assertPlayerSender 的分离
3. 安全边界清晰：只有我们创建的窗口才能调用 IPC

### D-MW-03: 活动 Tab 状态

**决策：每窗口独立的活动 Tab**

```javascript
// 旧：全局单例
let activeTabId = null;

// 新：每窗口独立
const activeTabByWindow = new Map(); // windowId → tabId
```

**理由：**
1. 每个窗口有自己的 Tab 栏，需要独立的活动 Tab
2. 快捷键（Cmd+W、Cmd+T）作用于当前焦点窗口的活动 Tab
3. Tab 持久化时需要记录每个窗口的活动 Tab

### D-MW-04: webview 跨窗口迁移

**决策：重建 webview，不移动 DOM**

- Tab 迁移到新窗口时，在目标窗口创建新 webview
- 从 URL 重新导航
- 接受页面状态丢失（滚动位置、表单输入）

**理由：**
1. Electron 的 webview 绑定到创建它的 BrowserWindow，无法跨窗口移动
2. Chrome 等浏览器的 Tab 拖拽也是重建页面
3. 用户对此行为有预期

### D-MW-05: Tab 上限策略

**决策：全局 Tab 上限，跨窗口共享配额**

- TAB_MAX_COUNT 保持全局 20 个
- 回收时优先回收最久未使用的 Tab（跨所有窗口）

**理由：**
1. 资源限制是全局的（内存、CPU）
2. 用户不应该通过开新窗口绕过 Tab 上限
3. 回收逻辑简单：只需遍历全局 Tab Map

## Anti-Patterns to Avoid

### Anti-Pattern 1: 每个窗口独立的 tab-manager 实例

**What:** 每个 BrowserWindow 创建自己的 tab-manager 实例
**Why bad:** Tab 拖拽跨窗口需要在两个实例间同步数据，极易出 bug；全局 Tab 上限无法执行；持久化复杂度翻倍
**Instead:** 全局 tab-manager + Tab 对象的 windowId 字段

### Anti-Pattern 2: renderer 直接创建 BrowserWindow

**What:** 渲染进程通过 IPC 请求创建新窗口，但自己管理窗口生命周期
**Why bad:** 违反进程隔离原则；renderer 不应持有 BrowserWindow 引用
**Instead:** 所有窗口操作通过 IPC 走主进程，renderer 只发送请求

### Anti-Pattern 3: 使用 getAllWindows()[0] 获取主窗口

**What:** 用 `BrowserWindow.getAllWindows()[0]` 替代 `getMainWindow()`
**Why bad:** 窗口数组顺序不确定，多窗口时第一个不一定是"主窗口"；已有决策记录（CR-7）明确禁止
**Instead:** 使用 windowManager 的显式引用管理

### Anti-Pattern 4: 快捷键注册到所有窗口

**What:** 每个窗口都注册相同的全局快捷键
**Why bad:** 多个窗口同时处理同一个快捷键，导致重复执行
**Instead:** 全局快捷键（Menu Accelerator）只注册一次，作用于焦点窗口；或使用 `before-input-event` 按窗口分发

## Scalability Considerations

| 窗口数量 | 影响 | 策略 |
|---------|------|------|
| 1-3 个 | 正常使用 | 无特殊处理 |
| 5-10 个 | 内存压力增大 | Tab 回收机制自动管理 |
| 10+ 个 | 窗口管理复杂 | 考虑窗口列表面板（后期增强） |

## Build Order

### 阶段划分

```
Phase 1: 窗口管理基础（MW-01, MW-06）
├── window-manager.js 重构（多窗口 Map）
├── assertTrustedSender 扩展
├── Dock 右键"新建窗口"菜单
├── 每个窗口独立 renderer 初始化
├── 快捷键多窗口注册
└── 广播/定向 IPC 基础设施

Phase 2: Tab 窗口关联（MW-04, MW-05）
├── tab-manager.js 扩展（windowId 字段）
├── activeTabId → activeTabByWindow Map
├── Tab 持久化扩展（windowId 恢复）
├── "最后 Tab 关闭窗口"规则
└── Tab 上限跨窗口回收

Phase 3: Tab 拖拽排序（MW-04）
├── 窗口内 Tab 拖拽排序（HTML5 DnD）
├── 拖拽视觉反馈
└── 排序持久化

Phase 4: Tab 跨窗口移动（MW-02, MW-03）
├── Tab 拖拽出窗口检测
├── 右键菜单"移动到新窗口"
├── 右键菜单"移动到窗口"列表
├── 快捷键 Cmd+Shift+X
├── webview 重建 + URL 导航
└── 源窗口"最后 Tab"自动关闭
```

### 依赖关系

```
Phase 1 ──► Phase 2 （Tab 窗口关联依赖窗口管理基础）
Phase 2 ──► Phase 3 （拖拽排序依赖 Tab 窗口关联）
Phase 2 ──► Phase 4 （跨窗口移动依赖 Tab 窗口关联）
Phase 3 ∥ Phase 4 （可并行，无依赖）
```

### 最小可验证切片

**Phase 1 的最小切片：**
1. `window-manager.js`：`windows` Map + `createMainWindow` 支持多实例
2. `ipc-handlers.js`：`assertTrustedSender` 检查 `managedWindowIds`
3. `main.js`：Dock 菜单"新建窗口" → 创建新 BrowserWindow
4. 验证：两个窗口可以同时存在，各自独立操作

**Phase 2 的最小切片：**
1. `tab-manager.js`：Tab 对象新增 `windowId`
2. `renderer.js`：初始化时获取 windowId，只加载自己窗口的 Tab
3. 关闭最后 Tab → 窗口关闭
4. 验证：两个窗口各有独立的 Tab，互不干扰

## Sources

- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)
- [Electron WebContents API](https://www.electronjs.org/docs/latest/api/web-contents)
- [Electron contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge)
- 现有代码：window-manager.js, tab-manager.js, ipc-handlers.js, renderer.js, main.js
- 已有决策：CR-7（windowId vs webContentsId 禁止混用）

---

*Last updated: 2026-08-14*

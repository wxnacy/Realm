# 领域陷阱研究：多窗口支持

**领域：** Electron 多容器隔离浏览器 — 添加多窗口支持
**研究日期：** 2026-08-14（v2.4 多窗口）
**置信度：** MEDIUM（Electron 官方文档 + 现有代码库分析 + 社区经验）

---

## 概述

本文档聚焦向已有 Electron 单窗口多 Tab 浏览器**添加**多窗口支持时的常见错误。Realm 当前架构（v2.3）是单 `mainWindowRef` 单例 + 多 Tab webview，转变为多窗口需要重构窗口管理、IPC 路由、状态同步等多个核心子系统。

**核心风险领域：**
1. **窗口引用泄漏** — 旧的单窗口假设导致残留引用阻止 GC
2. **Tab 跨窗口转移竞态** — webview guest 进程绑定宿主窗口，物理移动不可能
3. **IPC 路由错乱** — assertTrustedSender 硬编码主窗口校验拒绝新窗口
4. **Session partition 共享冲突** — 同容器多窗口共享 Cookie/存储时序问题
5. **macOS 平台特有行为** — Cmd+W vs Cmd+Q、Dock activate、窗口最小化
6. **事件监听器泄漏** — ipcMain 级别处理器不随窗口销毁自动清理
7. **状态同步风暴** — Tab 列表/容器状态/快捷键配置需广播到所有窗口
8. **拖拽实现复杂度** — HTML5 Drag and Drop 跨窗口序列化限制

---

## 关键陷阱（CRITICAL）

### 陷阱 MW-1：`assertTrustedSender` 硬编码主窗口校验

**问题描述：**
当前 `ipc-handlers.js:76-83` 的 `assertTrustedSender` 函数校验 `win.id !== mainWindow.id`，只接受来自主窗口的 IPC 调用。添加多窗口后，新窗口的所有 IPC 调用都会被拒绝，抛出"不受信任的 IPC 来源"。

**根本原因：**
该函数设计时假设只有主窗口和播放器窗口两种窗口类型。播放器窗口有独立的 `assertPlayerSender` 校验。多窗口打破了这个假设。

**后果：**
- 新窗口无法调用任何 IPC 通道（容器切换、Cookie 操作、Tab 管理等全部失效）
- 新窗口渲染进程收到 unhandled rejection，UI 完全无响应

**如何避免：**
```javascript
// 当前代码（只认主窗口）
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const mainWindow = windowManager.getMainWindow();
  if (!win || !mainWindow || win.id !== mainWindow.id) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}

// 重构方案：接受所有 Realm 管理的窗口
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    throw new Error('不受信任的 IPC 来源');
  }
  // 校验窗口在 windowManager 注册表中（排除 DevTools、webview guest 等）
  if (!windowManager.isManagedWindow(win.id)) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}
```

**检测信号：** 新窗口打开后所有操作无反应，控制台报"不受信任的 IPC 来源"
**影响阶段：** Phase 1（窗口管理基础设施）必须解决

---

### 陷阱 MW-2：`mainWindowRef` 单例假设贯穿全代码库

**问题描述：**
当前 `window-manager.js:18` 的 `mainWindowRef` 是模块级单例变量。`getMainWindow()` 返回这个单例。代码库中多处直接调用 `windowManager.getMainWindow()` 获取"唯一窗口"来发送 IPC 通知。

**根本原因：**
单窗口架构下，`mainWindow` 就是"应用窗口"的同义词。多窗口后需要区分"哪个窗口"。

**后果：**
- `container-switched` 等事件只发送到主窗口，其他窗口状态滞后
- Cookie 保存/加载、快捷键注册等绑定到主窗口生命周期的逻辑遗漏其他窗口
- 播放器窗口的 `assertPlayerSender` 已经绕过了这个假设，说明假设本就脆弱

**如何避免：**
```javascript
// 旧：单例引用
let mainWindowRef = null;

// 新：窗口注册表
const managedWindows = new Map();  // winId → { win, type, containerId }

function registerWindow(win, type, containerId) {
  managedWindows.set(win.id, { win, type, containerId });
  win.on('closed', () => managedWindows.delete(win.id));
}

function getAllManagedWindows() {
  return Array.from(managedWindows.values())
    .filter(entry => !entry.win.isDestroyed())
    .map(entry => entry.win);
}

function broadcastToAll(channel, ...args) {
  for (const win of getAllManagedWindows()) {
    win.webContents.send(channel, ...args);
  }
}
```

**检测信号：** 容器切换后其他窗口的 Tab 颜色/标题不更新
**影响阶段：** Phase 1（窗口管理基础设施）必须解决

---

### 陷阱 MW-3：Tab 跨窗口转移时 webview guest 进程被杀

**问题描述：**
用户拖拽 Tab 从窗口 A 到窗口 B 时，如果先销毁源窗口的 webview，webview 的 guest 进程随之终止，丢失所有页面状态（表单输入、滚动位置、WebSocket 连接、进行中的请求）。

**根本原因：**
Electron 的 webview guest 进程与宿主 BrowserWindow 绑定。webview DOM 元素从 DOM 移除或宿主窗口销毁时，guest 进程被终止。这不是 bug，是 Chromium 多进程架构的固有限制。

**后果：**
- 用户在 Tab 中填写的表单内容丢失
- WebSocket/长连接断开，需要重新登录
- 页面滚动位置、视频播放进度重置
- 如果 Tab 正在执行 AI 自动化操作，操作中断

**如何避免：**
```javascript
// Tab 转移不是物理移动 webview，而是元数据迁移
async function transferTab(tabId, sourceWindowId, targetWindowId) {
  // 1. 从源窗口获取 Tab 元数据（URL、containerId、title、favicon）
  const tabMeta = await getWindowTabMeta(sourceWindowId, tabId);

  // 2. 在目标窗口创建新 Tab（新 webview，重新加载 URL）
  const newTabId = await createTabInWindow(targetWindowId, {
    url: tabMeta.url,
    containerId: tabMeta.containerId,
    title: tabMeta.title,
    pinned: tabMeta.pinned,
  });

  // 3. 关闭源窗口的旧 Tab
  await closeTabInWindow(sourceWindowId, tabId);

  // 4. 如果源窗口只剩一个 Tab，自动销毁源窗口（MW-05 需求）
  const remainingTabs = await getTabsInWindow(sourceWindowId);
  if (remainingTabs.length <= 1) {
    await destroyWindow(sourceWindowId);
  }

  return newTabId;
}
```

**检测信号：** 拖拽 Tab 后页面白屏或需要重新登录
**影响阶段：** Phase 3（Tab 拖拽转移）必须解决

---

### 陷阱 MW-4：`tab-manager.js` 全局单例 Tab 存储

**问题描述：**
当前 `tab-manager.js` 使用全局 `tabs` Map 和单一 `activeTabId`。多窗口后每个窗口有自己的 Tab 列表和活动 Tab，但 Tab 管理器不知道哪个 Tab 属于哪个窗口。

**根本原因：**
Tab 管理器设计为单窗口：一个 Map 存所有 Tab，一个 activeTabId 记录当前活动 Tab。

**后果：**
- 窗口 A 切换活动 Tab 会影响窗口 B 的 activeTabId
- Tab 持久化/恢复无法区分多窗口布局
- Tab 回收策略（TAB_MAX_COUNT=20）不知道该回收哪个窗口的 Tab

**如何避免：**
```javascript
// 方案：Tab 元数据中增加 windowId 字段
// tabs Map 结构：tabId → { ...tabData, windowId }
// activeTabIds 变为 Map：windowId → tabId

const activeTabIds = new Map();  // windowId → tabId

function getActiveTabId(windowId) {
  return activeTabIds.get(windowId) || null;
}

function setActiveTabId(windowId, tabId) {
  activeTabIds.set(windowId, tabId);
}
```

**检测信号：** 窗口 A 切换 Tab 后窗口 B 的 Tab 高亮错乱
**影响阶段：** Phase 1-2（窗口管理 + Tab 重构）必须解决

---

### 陷阱 MW-5：`ipcMain.handle` 重复注册崩溃

**问题描述：**
如果 `registerHandlers()` 在每个新窗口创建时被调用，`ipcMain.handle('container:list', ...)` 会尝试注册同一 channel 的第二个处理器，Electron 抛出 "Error: handler for 'container:list' already exists"。

**根本原因：**
Electron 的 `ipcMain.handle` 是全局注册，不区分调用者窗口。同一 channel 只能有一个 handle 处理器。当前代码在 `app.whenReady` 中调用一次 `registerHandlers()`，但如果多窗口初始化流程中有任何路径重复调用，就会崩溃。

**后果：**
- 应用启动崩溃（未捕获异常）
- 如果在 try-catch 中被静默吞掉，新窗口 IPC 全部失效

**如何避免：**
```javascript
// registerHandlers 内部加防重复注册守卫
let handlersRegistered = false;

function registerHandlers() {
  if (handlersRegistered) {
    console.warn('[Realm] IPC handlers already registered, skipping');
    return;
  }
  handlersRegistered = true;
  // ... 注册所有 handle
}
```

**检测信号：** 控制台报 "handler for 'xxx' already exists"
**影响阶段：** Phase 1（窗口管理基础设施）预防

---

## 关键陷阱（HIGH）

### 陷阱 MW-6：事件监听器泄漏 — `ipcMain.on` 不随窗口销毁

**问题描述：**
`ipcMain.on` 和 `ipcMain.handle` 注册的监听器是全局的，不会因为 BrowserWindow 销毁而自动移除。如果在窗口生命周期中注册了特定窗口的监听器但未清理，关闭窗口后这些处理器变成幽灵——仍然响应但引用的窗口已 null/destroyed。

**根本原因：**
Electron 的 IPC 监听器绑定在主进程而非窗口。`webContents.on` 的监听器随 webContents 销毁自动清理，但 `ipcMain` 级别不会。

**后果：**
- 内存泄漏（闭包引用已销毁窗口的上下文）
- 幽灵处理器响应其他窗口的 IPC，导致意外行为
- 多次创建/销毁窗口后性能下降

**如何避免：**
```javascript
// 在窗口 closed 事件中清理该窗口专用的 IPC 处理器
win.on('closed', () => {
  // 清理窗口专用的 ipcMain.on 监听器
  ipcMain.removeAllListeners(`window:${win.id}:*`);

  // 对于全局 handle，用事件代理模式而非 per-window 注册
  // 即 handle 本身不清理（全局唯一），但内部用 event.sender 区分窗口
});
```

**检测信号：** 多次开关窗口后主进程内存持续增长
**影响阶段：** Phase 1-2（窗口管理 + Tab 重构）

---

### 陷阱 MW-7：`window-all-closed` 行为改变

**问题描述：**
当前 `main.js:2504` 的 `window-all-closed` 处理中，如果 `!quitting` 则什么都不做（保持应用运行）。这在单窗口下是正确的 macOS 行为。但多窗口后用户关闭最后一个窗口时，应用应该继续运行（macOS 惯例），Dock 点击时重建窗口。

**根本原因：**
macOS 应用在所有窗口关闭后不退出是标准行为。但当前 `activate` 事件处理（`main.js:2470`）只在 `getAllWindows().length === 0` 时重建主窗口，没有考虑"窗口都最小化了"的情况。

**后果：**
- 所有窗口最小化后点击 Dock 图标，`getAllWindows()` 返回非零，不重建也不聚焦
- 用户以为应用卡死

**如何避免：**
```javascript
app.on('activate', (event, hasVisibleWindows) => {
  if (!hasVisibleWindows) {
    // 有隐藏窗口 → 聚焦第一个
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      const first = allWindows[0];
      if (first.isMinimized()) first.restore();
      first.focus();
    } else {
      // 真的没有窗口 → 创建新窗口
      createMainWindow(initialContainerId, container);
    }
  }
});
```

**检测信号：** 最小化所有窗口后点击 Dock 无反应
**影响阶段：** Phase 1（窗口管理基础设施）

---

### 陷阱 MW-8：快捷键 `before-input-event` 全局派发错乱

**问题描述：**
当前 `main.js` 通过 `mainWindow.webContents.on('before-input-event', ...)` 注册快捷键监听。这个监听器绑定在主窗口的 webContents 上。多窗口后新窗口不会接收快捷键事件。但如果改为全局监听（`app.on('before-input-event')`），播放器窗口的快捷键也会被拦截。

**根本原因：**
Phase 28 的决策"非主窗口快捷键不派发主窗口"解决了播放器窗口的问题。多窗口需要泛化这个模式：快捷键应该派发到"当前焦点窗口"而非硬编码主窗口。

**后果：**
- 新窗口的 Cmd+T/Cmd+W 等快捷键不工作
- 或者全局监听导致所有窗口的按键都被主窗口拦截

**如何避免：**
```javascript
// 快捷键派发到当前焦点窗口
app.on('browser-window-focus', (event, win) => {
  // 为每个窗口注册独立的 before-input-event
  win.webContents.on('before-input-event', (inputEvent, input) => {
    const action = matchShortcut(input);
    if (action) {
      // 派发到当前焦点窗口的渲染进程
      win.webContents.send('shortcut:triggered', action);
    }
  });
});
```

**检测信号：** 新窗口快捷键不响应或主窗口行为异常
**影响阶段：** Phase 2（Tab 重构/窗口管理）

---

### 陷阱 MW-9：Cookie 保存/加载绑定主窗口生命周期

**问题描述：**
当前 `main.js` 中 Cookie 保存逻辑在 `before-quit` 和窗口 `close` 事件中触发，假设只有一个主窗口。多窗口后：
1. 关闭窗口 A 时保存 Cookie，但窗口 B 还在运行，可能产生脏数据
2. `before-quit` 时需要保存所有窗口相关的 Cookie
3. `cookie-manager.js` 的 `saveCookies` 逻辑可能需要按窗口/容器维度分别保存

**根本原因：**
Cookie 持久化是"退出时一次性保存"模式。多窗口下退出序列更复杂（每个窗口可能正在关闭 webview）。

**后果：**
- 关闭一个窗口后该容器的 Cookie 丢失（如果 quit 前不保存）
- 或者提前保存导致其他窗口正在修改的 Cookie 被覆盖

**如何避免：**
```javascript
// Cookie 保存改为容器级别而非窗口级别
// 每个容器独立保存，不受窗口生命周期影响
// 窗口关闭时保存该窗口涉及的容器 Cookie
win.on('closed', async () => {
  const containerId = windowManager.getCurrentContainer(win.id);
  await cookieManager.saveContainerCookies(containerId);
});
```

**检测信号：** 关闭一个窗口后重启应用，该容器 Cookie 丢失
**影响阶段：** Phase 2-3（Tab 重构 + 拖拽转移）

---

### 陷阱 MW-10：`guestContainerMap` webview-容器映射全局共享

**问题描述：**
`ipc-handlers.js` 中的 `guestContainerMap` 存储 webview webContentsId → containerId 映射。多窗口后两个窗口可能有同容器的 webview，webContentsId 不同但 containerId 相同。如果映射逻辑没有考虑窗口维度，可能混淆。

**根本原因：**
`guestContainerMap` 的 key 是 webContentsId（全局唯一），所以多窗口下映射本身不会冲突。但消费端如果用 containerId 反查 webview，需要区分"哪个窗口的 webview"。

**后果：**
- `media:debug-state` 返回的 guestMapSize 是全局计数，不含窗口维度
- AI 工具操作指定容器的 webview 时可能命中错误窗口的 webview

**如何避免：**
```javascript
// 映射增加窗口维度
// guestContainerMap: webContentsId → { containerId, windowId }
function registerGuestContainer(webContentsId, containerId, windowId) {
  guestContainerMap.set(webContentsId, { containerId, windowId });
}
```

**检测信号：** AI 工具操作网页时作用到错误窗口
**影响阶段：** Phase 3-4（Tab 拖拽 + 高级功能）

---

### 陷阱 MW-11：Tab 拖拽的 HTML5 Drag and Drop 跨窗口限制

**问题描述：**
HTML5 Drag and Drop API 的 `dataTransfer` 对象在跨窗口拖拽时存在限制：
1. `dragstart` 和 `drop` 事件的 `dataTransfer` 数据在源窗口关闭后可能丢失
2. 不同 BrowserWindow 之间的 drag 事件序列可能不完整
3. macOS 上跨窗口拖拽的视觉反馈（drag image）需要特殊处理

**根本原因：**
HTML5 DnD 设计为同文档/同窗口操作。跨窗口拖拽依赖 Chromium 内部实现，行为不如同窗口可靠。

**后果：**
- 拖拽 Tab 出窗口时 drop 事件不触发
- 拖拽过程中释放鼠标但 Tab 消失（既没到目标窗口，源窗口也已销毁）
- macOS 上拖拽图标显示异常

**如何避免：**
```javascript
// 使用 Electron 原生的 startDragging API 或自定义拖拽协议
// 而非依赖 HTML5 DnD 的跨窗口能力
// 方案：dragstart 时序列化 Tab 元数据到全局变量
// 目标窗口的 dragover/drop 读取全局变量
// 或使用 IPC + 鼠标位置检测代替 DnD

// 备选方案：Native drag with ipcMain
ipcMain.on('tab:drag-start', (event, tabData) => {
  globalDraggingTab = tabData;  // 主进程持有拖拽数据
});

ipcMain.on('tab:drop', (event, targetWindowId) => {
  if (globalDraggingTab) {
    transferTab(globalDraggingTab, targetWindowId);
    globalDraggingTab = null;
  }
});
```

**检测信号：** 拖拽 Tab 出窗口时 Tab 消失或目标窗口无反应
**影响阶段：** Phase 3（Tab 拖拽转移）需要 Spike 验证

---

### 陷阱 MW-12：播放器窗口的 `assertPlayerSender` 与多窗口冲突

**问题描述：**
播放器窗口使用独立的 `assertPlayerSender` 校验（`ipc-handlers.js:1570-1576`），检查 `win.id !== playerWindow.id`。多窗口后 Realm 主窗口有多个，播放器的 IPC 校验逻辑不变，但 `playerWindow` 变量是闭包级单例——如果多个窗口各自创建播放器，只有最后一个被记录。

**根本原因：**
播放器窗口是单例模式（`playerWindow` 变量）。当前一个播放器对应一个主窗口。多窗口后可能需要支持每个窗口一个播放器，或者全局只允许一个播放器。

**后果：**
- 窗口 A 创建播放器后，窗口 B 创建播放器覆盖引用，窗口 A 的播放器 IPC 被拒绝
- 或者需要明确的播放器生命周期策略

**如何避免：**
```javascript
// 方案 A：全局只允许一个播放器（保持现状，简单）
// 方案 B：播放器 Map<windowId, playerWindow>
const playerWindows = new Map();

function assertPlayerSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) throw new Error('不受信任的 IPC 来源');
  // 检查 win 是否是任何一个播放器窗口
  for (const [ownerId, pw] of playerWindows) {
    if (!pw.isDestroyed() && win.id === pw.id) return win;
  }
  throw new Error('不受信任的 IPC 来源');
}
```

**检测信号：** 第二个窗口创建播放器后第一个播放器控件失效
**影响阶段：** Phase 2-3（Tab 重构 + 拖拽转移）

---

### 陷阱 MW-13：`shortcut-manager.js` 快捷键注册绑定窗口

**问题描述：**
当前快捷键通过 `globalShortcut` 或 `before-input-event` 注册。`globalShortcut` 是全局的（系统级），不能区分窗口。`before-input-event` 绑定到特定 webContents。多窗口后需要确保：
1. 快捷键在所有窗口都生效
2. 快捷键动作派发到正确的窗口（焦点窗口而非主窗口）
3. 窗口关闭时清理该窗口的快捷键监听

**根本原因：**
快捷键系统假设只有一个窗口接收按键事件。

**后果：**
- 新窗口快捷键不工作
- 或者快捷键总是操作主窗口而非当前焦点窗口

**如何避免：**
```javascript
// 快捷键改为 app 级别监听，派发到焦点窗口
// 参考陷阱 MW-8 的方案
```

**检测信号：** 新窗口中快捷键不响应
**影响阶段：** Phase 2（Tab 重构/窗口管理）

---

## 中等陷阱（MODERATE）

### 陷阱 MW-14：`electron-store` 实例共享竞争

**问题描述：**
`tab-manager.js` 和 `main.js` 各自创建 `electron-store` 实例。多窗口下如果两个窗口同时修改 Tab 配置（例如窗口 A 添加 Tab，窗口 B 关闭 Tab），`electron-store` 的文件写入可能产生竞争条件。

**根本原因：**
`electron-store` 底层使用 `conf` 包的 JSON 文件读写。多进程/多窗口并发写入同一 store 文件可能导致数据丢失（后写入的覆盖先写入的）。

**后果：**
- Tab 持久化数据丢失（窗口 A 的 Tab 被窗口 B 的写入覆盖）
- 配置文件损坏（极端情况）

**如何避免：**
```javascript
// 所有持久化写入通过主进程单一入口
// 渲染进程不直接写 store，而是发 IPC 请求主进程写
// 主进程用队列或锁串行化写入
```

**检测信号：** 重启后 Tab 列表与关闭前不一致
**影响阶段：** Phase 2（Tab 重构）

---

### 陷阱 MW-15：`shortcut:reset` IPC 绑定主窗口

**问题描述：**
快捷键重置走 `realmAPI.resetShortcut(action)` → `shortcut:reset` 通道。`ipc-handlers.js` 中处理此 IPC 时用 `assertTrustedSender` 校验。多窗口后如果 `assertTrustedSender` 改为接受所有窗口（MW-1 修复），重置快捷键后需要广播到所有窗口更新显示。

**根本原因：**
快捷键配置是全局的（`electron-store`），但设置页 UI 在每个窗口独立运行。重置后其他窗口的设置页 UI 不会自动刷新。

**后果：**
- 窗口 A 重置快捷键后，窗口 B 的设置页仍显示旧值
- 窗口 B 使用旧快捷键值可能触发错误动作

**如何避免：**
```javascript
// 快捷键重置后广播到所有窗口
ipcMain.handle('shortcut:reset', async (event, action) => {
  const win = assertTrustedSender(event);
  // ... 重置逻辑 ...
  // 广播更新
  for (const w of windowManager.getAllManagedWindows()) {
    w.webContents.send('shortcuts-updated', shortcuts);
  }
  return result;
});
```

**检测信号：** 窗口 A 重置快捷键后窗口 B 设置页显示不一致
**影响阶段：** Phase 2-3（Tab 重构 + 状态同步）

---

### 陷阱 MW-16：下载管理器绑定主窗口

**问题描述：**
`download-manager.js` 的下载面板在主窗口的 webview 中渲染。多窗口后：
1. 下载应该显示在哪个窗口？
2. 下载进度事件应该发送到哪个窗口？
3. 如果触发下载的 Tab 在窗口 A，但用户在窗口 B 操作，体验如何？

**根本原因：**
下载管理器假设单窗口。`will-download` 事件绑定在 session 上而非窗口上。

**后果：**
- 下载通知只在主窗口显示，其他窗口用户看不到
- 下载面板交互只在主窗口可用

**如何避免：**
```javascript
// 下载事件广播到所有窗口，或绑定到触发下载的窗口
// 下载面板在每个窗口都可以打开（共享数据，独立 UI）
```

**检测信号：** 非主窗口触发的下载无 UI 反馈
**影响阶段：** Phase 3-4（高级功能）

---

### 陷阱 MW-17：AI 聊天面板绑定主窗口

**问题描述：**
AI 聊天面板（Phase 21）的 UI 在主窗口渲染。`aiManager` 是主进程单例，但 UI 事件（消息渲染、工具卡片、流式输出）只发送到主窗口。多窗口后 AI 面板需要在每个窗口可用。

**根本原因：**
AI Manager 是主进程全局单例（合理），但 UI 层绑定主窗口。

**后果：**
- 非主窗口无法使用 AI 聊天
- AI 工具操作（fillForm/executeAction）的确认 UI 只在主窗口显示

**如何避免：**
```javascript
// AI Manager 保持主进程单例
// 但事件广播到当前焦点窗口（或操作发起窗口）
// AI 面板 UI 在每个窗口独立实例化
```

**检测信号：** 非主窗口 AI 面板无响应
**影响阶段：** Phase 3-4（高级功能）

---

### 陷阱 MW-18：媒体嗅探器绑定窗口

**问题描述：**
`media-sniffer.js` 通过 CDP attach 到 webview 的 webContents。多窗口后每个窗口有独立的 webview。嗅探器需要：
1. 跟踪每个窗口的 webview webContents
2. 媒体列表按窗口/容器维度维护
3. 播放器创建时正确获取对应窗口的媒体列表

**根本原因：**
媒体嗅探器是全局的，数据按 webContentsId 索引。这本身没问题，但消费端需要知道"当前窗口的媒体列表"而非"全局媒体列表"。

**后果：**
- 媒体面板显示所有窗口的媒体混在一起
- 播放器可能播放错误窗口嗅探到的媒体

**如何避免：**
```javascript
// media:get-list 增加 windowId 参数过滤
ipcMain.handle('media:get-list', (event, webContentsId, windowId) => {
  const win = assertTrustedSender(event);
  return mediaSniffer.getMediaList(webContentsId);
  // webContentsId 已经唯一标识了 webview，不需要 windowId
  // 但 UI 层需要知道"当前窗口有哪些 webview"
});
```

**检测信号：** 媒体面板显示其他窗口的媒体
**影响阶段：** Phase 3-4（高级功能）

---

## 轻微陷阱（MINOR）

### 陷阱 MW-19：`windowContainerMap` 键空间约定

**问题描述：**
`window-manager.js:14` 注释约定使用 `BrowserWindow.id` 作为键。多窗口后这个约定仍然有效，但需要确保新增的窗口管理代码也遵守这个约定，不混用 `webContents.id`。

**如何避免：**
所有窗口相关的 Map 键统一用 `BrowserWindow.id`，代码审查时检查。

---

### 陷阱 MW-20：`state.currentContainer` 同步约定扩展

**问题描述：**
CLAUDE.md 约定"修改 `state.currentContainer` 后必须重渲染侧边栏"。多窗口后每个窗口有独立的 `state.currentContainer`。容器切换事件需要精确发送到对应窗口。

**如何避免：**
容器切换 IPC 返回值中包含窗口 ID，渲染进程只更新自己的状态。

---

### 陷阱 MW-21：`realm://` 内部页面的 `setWindowOpenHandler` 路由

**问题描述：**
内部页面（realm://favorites 等）中 `window.open(url, '_blank')` 被主进程 `setWindowOpenHandler` 拦截，在"来源容器"新建 Tab。多窗口后"来源容器"需要解析到正确的窗口。

**如何避免：**
`setWindowOpenHandler` 中通过 `event.sender` 找到所属窗口，在该窗口新建 Tab。

---

## 阶段-陷阱映射

| 阶段主题 | 可能的陷阱 | 缓解策略 |
|---------|-----------|---------|
| Phase 1: 窗口管理基础设施 | MW-1, MW-2, MW-5, MW-7 | 重构 windowManager 为注册表模式；assertTrustedSender 泛化；防重复注册 |
| Phase 2: Tab 重构 | MW-4, MW-6, MW-8, MW-13, MW-14 | Tab 增加 windowId；快捷键改为 app 级监听；electron-store 串行化 |
| Phase 3: Tab 拖拽转移 | MW-3, MW-9, MW-10, MW-11, MW-12 | 元数据迁移而非物理移动；Cookie 按容器保存；DnD Spike 验证 |
| Phase 4: 高级功能适配 | MW-15, MW-16, MW-17, MW-18 | 状态广播到所有窗口；下载/AI 面板多窗口可用 |

---

## 风险矩阵

| 陷阱 | 严重性 | 可能性 | 风险等级 | 阶段 |
|------|--------|--------|---------|------|
| MW-1: assertTrustedSender 硬编码 | CRITICAL | 确定发生 | **极高** | Phase 1 |
| MW-2: mainWindowRef 单例假设 | CRITICAL | 确定发生 | **极高** | Phase 1 |
| MW-3: webview guest 进程被杀 | CRITICAL | 确定发生 | **极高** | Phase 3 |
| MW-4: tab-manager 全局单例 | CRITICAL | 确定发生 | **极高** | Phase 1-2 |
| MW-5: ipcMain.handle 重复注册 | CRITICAL | 高 | **高** | Phase 1 |
| MW-6: 事件监听器泄漏 | HIGH | 高 | **高** | Phase 1-2 |
| MW-7: window-all-closed 行为 | HIGH | 高 | **高** | Phase 1 |
| MW-8: 快捷键派发错乱 | HIGH | 确定发生 | **高** | Phase 2 |
| MW-9: Cookie 保存生命周期 | HIGH | 中 | **中高** | Phase 2-3 |
| MW-11: DnD 跨窗口限制 | HIGH | 高 | **高** | Phase 3 |
| MW-12: 播放器单例冲突 | HIGH | 中 | **中高** | Phase 2-3 |
| MW-14: electron-store 竞争 | MODERATE | 中 | **中** | Phase 2 |

---

## 来源

- [Electron BrowserWindow 官方文档](https://www.electronjs.org/docs/latest/api/browser-window) — 生命周期事件、destroy() 行为、多窗口管理方法
- [Electron app 事件文档](https://www.electronjs.org/docs/latest/api/app) — activate、window-all-closed、before-quit 事件
- [Electron IPC 文档](https://www.electronjs.org/docs/latest/api/ipc-main) — handle/on 模式、event.sender 识别
- 现有代码库分析：`window-manager.js`、`ipc-handlers.js`、`tab-manager.js`、`main.js`
- 播放器窗口实现（Phase 28）：已验证的非主窗口 IPC 校验模式

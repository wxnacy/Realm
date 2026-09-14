# Phase 34: 窗口管理基础 - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 4（window-manager.js, ipc-handlers.js, shortcut-manager.js, main.js）
**Analogs found:** 4 / 4（全部是自重构，模拟来自代码库自身现有实现）

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `window-manager.js` | module (窗口注册表) | CRUD (生命周期管理) | 自身现有实现 + RESEARCH.md Pattern 1 | exact |
| `ipc-handlers.js` | middleware (IPC 信任校验) | request-response | 自身 `assertTrustedSender` + `assertPlayerSender` | exact |
| `shortcut-manager.js` | middleware (快捷键派发) | event-driven | 自身 `attachInputListener` + RESEARCH.md Pattern 3 | exact |
| `main.js` | controller (应用生命周期) | event-driven | 自身 `createMainWindow` + `app.on('activate')` | exact |

## Pattern Assignments

### `window-manager.js` (module, CRUD)

**Analog:** 自身现有实现（`~/Projects/Realm/window-manager.js`）

**当前 Imports 模式** (lines 1-8):
```javascript
/**
 * Realm Browser - 窗口管理模块
 *
 * 管理 BrowserWindow 实例和窗口与容器的映射关系
 */

const { BrowserWindow } = require('electron');
const path = require('path');
```

**当前窗口-容器映射模式** (lines 10-15):
```javascript
// 窗口与容器的映射关系
// 键空间约定（CR-7）：一律使用 BrowserWindow.id 作为键。
// 注意：webContents.id（如 IPC event.sender.id）属于独立的计数空间，
// 与 BrowserWindow.id 不是同一套编号，读取侧必须先通过
// BrowserWindow.fromWebContents() 解析出窗口再取 win.id，禁止混用。
const windowContainerMap = new Map();
```

**当前单例主窗口模式** (lines 17-18):
```javascript
/** 主窗口引用（模块级单例，createMainWindow 时登记，closed 时清除） */
let mainWindowRef = null;
```

**当前 createMainWindow 模式** (lines 26-64):
```javascript
function createMainWindow(containerId, container) {
  if (!container || !container.session) {
    console.error(`[Realm] 无效的容器配置: ${containerId}`);
    return undefined;
  }

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      session: container.session,
    },
  });

  // 记录窗口与容器的映射
  windowContainerMap.set(mainWindow.id, containerId);
  mainWindowRef = mainWindow;

  // 加载 UI（WR-11：使用绝对路径——打包后进程 CWD 不保证为应用目录，相对路径会白屏）
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  // 窗口关闭时清理映射
  mainWindow.on('closed', () => {
    windowContainerMap.delete(mainWindow.id);
    if (mainWindowRef === mainWindow) mainWindowRef = null;
  });

  return mainWindow;
}
```

**当前 getMainWindow 模式** (lines 115-118):
```javascript
function getMainWindow() {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) return mainWindowRef;
  return null;
}
```

**当前模块导出模式** (lines 120-125):
```javascript
module.exports = {
  createMainWindow,
  getMainWindow,
  getCurrentContainer,
  switchContainer,
};
```

**重构目标（来自 RESEARCH.md Pattern 1 + D-10）：**
- `mainWindowRef` 单例 → `windows` Map + `managedWindowIds` Set 双重注册
- 新增 `isManagedWindow(winId)` 方法
- 新增 `broadcast(channel, ...args)` 方法
- `getMainWindow()` 保留兼容，返回 Map 中第一个窗口
- `createMainWindow` 的 `closed` 事件清理三个数据结构

---

### `ipc-handlers.js` (middleware, request-response)

**Analog:** 自身 `assertTrustedSender`（`~/Projects/Realm/ipc-handlers.js` lines 76-83）+ `assertPlayerSender`（lines 1570-1576）

**当前 assertTrustedSender 模式** (lines 76-83):
```javascript
/**
 * 校验 IPC 调用方身份（CR-4 修复）
 * 仅接受来自应用主窗口 webContents 的调用；
 * webview guest、DevTools 或其他非窗口上下文一律拒绝，
 * 防止被浏览网页/注入上下文直接 invoke 特权通道。
 * @param {Electron.IpcMainInvokeEvent} event - IPC 事件对象
 * @returns {BrowserWindow} 受信的主窗口实例
 * @throws {Error} 来源不受信任时抛出
 */
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const mainWindow = windowManager.getMainWindow();
  if (!win || !mainWindow || win.id !== mainWindow.id) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}
```

**当前 assertPlayerSender 模式（播放器窗口专用）** (lines 1570-1576):
```javascript
/**
 * 校验播放器窗口 IPC 来源：仅接受来自当前播放器窗口的调用。
 * assertTrustedSender 只认主窗口，播放器窗口的窗口控制通道（全屏/最小化/
 * 最大化/关闭）必须用它自己的窗口身份做校验，否则会被误判为不受信来源。
 * @param {Electron.IpcMainInvokeEvent} event - IPC 事件对象
 * @returns {BrowserWindow} 播放器窗口实例
 * @throws {Error} 来源不受信任时抛出
 */
function assertPlayerSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !playerWindow || playerWindow.isDestroyed() || win.id !== playerWindow.id) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}
```

**当前 registerHandlers 中的 assertTrustedSender 使用模式**（遍布整个文件，每个 IPC handler 入口都调用）:
```javascript
ipcMain.handle('container:list', (event) => {
  assertTrustedSender(event);
  return containerManager.getContainers();
});
```

**当前 shortcut:set 使用 getMainWindow 的模式** (ipc-handlers.js lines 821-828):
```javascript
ipcMain.handle('shortcut:set', (event, action, accelerator) => {
  assertTrustedSender(event);
  // ...
  const result = shortcutManager.setShortcut(action, accelerator);
  if (result) {
    const win = windowManager.getMainWindow();
    shortcutManager.rebuildShortcuts(win);
  }
  return result;
});
```

**重构目标（来自 RESEARCH.md Pattern 2 + D-11）：**
- `assertTrustedSender` 内部改为 `windowManager.isManagedWindow(win.id)` 校验
- `assertPlayerSender` 保持不变（播放器窗口 D-13 全局单例，不受多窗口影响）
- `shortcut:set` / `shortcut:reset` handler 中 `rebuildShortcuts` 调用需要适配多窗口

---

### `shortcut-manager.js` (middleware, event-driven)

**Analog:** 自身 `attachInputListener`（`~/Projects/Realm/shortcut-manager.js` lines 219-247）+ `registerShortcuts`（lines 271-281）

**当前 currentWindow 单例模式** (lines 25-26):
```javascript
/** 当前主窗口引用，用于发送 shortcut:triggered IPC */
let currentWindow = null;
```

**当前 attachInputListener 中的快捷键派发模式** (lines 224-246):
```javascript
contents.on('before-input-event', (event, input) => {
  const action = findMatchingAction(input);
  if (!action) return; // 未命中：完全不拦截

  // 事件来自非主窗口（如播放器窗口）时，快捷键不应派发到主窗口：
  // closeTab（Cmd+W）语义转为关闭来源窗口自身；其余快捷键放行不拦截。
  // webview guest 的 fromWebContents 会解析到其宿主主窗口，不受影响。
  const ownerWindow = BrowserWindow.fromWebContents(contents);
  if (ownerWindow && currentWindow && !currentWindow.isDestroyed()
      && ownerWindow.id !== currentWindow.id) {
    if (action === 'closeTab') {
      event.preventDefault();
      ownerWindow.close();
    }
    return;
  }

  event.preventDefault();

  if (currentWindow && !currentWindow.isDestroyed()) {
    currentWindow.webContents.send('shortcut:triggered', action);
  }
});
```

**当前 registerShortcuts 模式** (lines 271-281):
```javascript
/**
 * 启用应用内快捷键（仅当前应用聚焦时生效）
 * @param {BrowserWindow} window - 接收 shortcut:triggered IPC 的主窗口
 */
function registerShortcuts(window) {
  currentWindow = window;

  ensureAppListener();

  if (window && !window.isDestroyed()) {
    attachInputListener(window.webContents);
  }

  console.log('[Realm] 应用内快捷键已启用（before-input-event）');
}
```

**当前 rebuildShortcuts 模式** (lines 289-301):
```javascript
function rebuildShortcuts(window) {
  if (window) {
    currentWindow = window;
  }

  if (!currentWindow || currentWindow.isDestroyed()) {
    console.error('[Realm] rebuildShortcuts 失败：无可用窗口');
    return;
  }

  attachInputListener(currentWindow.webContents);
  console.log('[Realm] 快捷键配置已生效（应用内）');
}
```

**当前 DEFAULT_SHORTCUTS 模式** (lines 39-52):
```javascript
const DEFAULT_SHORTCUTS = {
  'newTab': 'CmdOrCtrl+T',
  'closeTab': 'CmdOrCtrl+W',
  'nextTab': 'CmdOrCtrl+Shift+]',
  'prevTab': 'CmdOrCtrl+Shift+[',
  'reload': 'CmdOrCtrl+R',
  'back': 'CmdOrCtrl+Left',
  'forward': 'CmdOrCtrl+Right',
  'bookmark': 'CmdOrCtrl+D',
  'openSettings': 'CmdOrCtrl+,',
  'toggleAIPanel': 'CmdOrCtrl+]',
  'toggleSidebar': 'CmdOrCtrl+[',
  'findInPage': 'CmdOrCtrl+F',
};
```

**重构目标（来自 RESEARCH.md Pattern 3 + D-12）：**
- 新增 `'newWindow': 'CmdOrCtrl+N'` 和 `'closeWindow': 'CmdOrCtrl+Shift+W'` 到 DEFAULT_SHORTCUTS
- `attachInputListener` 中派发改为 `BrowserWindow.getFocusedWindow()` 动态获取焦点窗口
- `registerShortcuts` 不再接收 window 参数（改为无参，仅注册 app 级监听）
- `rebuildShortcuts` 不再需要 window 参数（快捷键配置变更时无需更新窗口引用）
- 播放器窗口的 `closeTab` 特殊处理保留（D-13）

---

### `main.js` (controller, event-driven)

**Analog:** 自身 `app.whenReady` 启动流程（`~/Projects/Realm/main.js` lines 2375-2388）+ `app.on('activate')`（lines 2470-2483）

**当前窗口创建入口模式** (lines 2381-2388):
```javascript
// 获取默认容器并创建主窗口
const defaultContainer = containerManager.getContainer('default');
const mainWindow = windowManager.createMainWindow('default', defaultContainer);

// 注册全局快捷键
if (mainWindow) {
  shortcutManager.registerShortcuts(mainWindow);
}
```

**当前 activate 事件模式** (lines 2470-2483):
```javascript
app.on('activate', () => {
  // 退出流程中禁止重建窗口：macOS 在退出关闭最后窗口时可能触发 activate，
  // 此时重建窗口会打断 quit 序列，导致「关窗代替退出」
  if (quitting || cookiesSaved) return;
  if (BrowserWindow.getAllWindows().length === 0) {
    const defaultContainer = containerManager.getContainer('default');
    const mainWindow = windowManager.createMainWindow('default', defaultContainer);
    if (mainWindow) {
      // 重建窗口后重新注册快捷键（Menu Accelerator 无需手动注销旧菜单，
      // registerShortcuts 会直接替换整个 Application Menu）
      shortcutManager.registerShortcuts(mainWindow);
    }
  }
});
```

**当前 getMainWindow 广播模式**（多处，如 lines 583-586）:
```javascript
function _notifyBookmarksBarRefresh() {
  const mainWindow = windowManager.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bookmarks-bar:refresh');
  }
}
```

**当前 before-quit 中 show-quit-hint 模式** (lines 2533-2536):
```javascript
const win = windowManager.getMainWindow();
if (win && !win.isDestroyed()) {
  win.webContents.send('show-quit-hint');
}
```

**当前 window-all-closed 模式** (lines 2504-2509):
```javascript
app.on('window-all-closed', () => {
  console.log('[Realm] window-all-closed, quitting:', quitting, 'cookiesSaved:', cookiesSaved);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

**当前 setWindowOpenHandler 模式**（webview 内 window.open 拦截，需确认行号）:
```javascript
// 主进程 setWindowOpenHandler 统一拦截，在来源容器新建 tab
```

**重构目标（来自 D-01 ~ D-09, MW-01, MW-08）：**
- `app.whenReady` 中设置 Dock 菜单（`app.dock.setMenu()`）包含"新建窗口"
- `activate` 事件增加 `hasVisibleWindows` 参数处理最小化窗口恢复（Pitfall MW-7）
- `shortcutManager.registerShortcuts()` 改为无参调用
- `show-quit-hint` 改为 `broadcast()` 发送到所有窗口（Pitfall MW-6）
- `_notifyBookmarksBarRefresh` 等改为 `windowManager.broadcast()`
- `setWindowOpenHandler` 保持不变（在来源容器新建 tab 的逻辑不受多窗口影响）

## Shared Patterns

### 窗口注册表（窗口生命周期管理）
**Source:** `window-manager.js` 重构后
**Apply to:** `window-manager.js`, `ipc-handlers.js`, `shortcut-manager.js`, `main.js`
```javascript
// window-manager.js 重构后的核心数据结构
const windows = new Map();           // winId → BrowserWindow
const managedWindowIds = new Set();  // 仅包含 createMainWindow 创建的窗口
const windowContainerMap = new Map(); // 保留现有映射

function isManagedWindow(winId) {
  return managedWindowIds.has(winId);
}

function broadcast(channel, ...args) {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}
```

### IPC 信任校验（所有 IPC handler 入口）
**Source:** `ipc-handlers.js` `assertTrustedSender` (lines 76-83)
**Apply to:** 所有 `ipcMain.handle` 调用
```javascript
// 重构后的 assertTrustedSender
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    throw new Error('不受信任的 IPC 来源');
  }
  if (!windowManager.isManagedWindow(win.id)) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}
```

### 快捷键焦点窗口派发
**Source:** `shortcut-manager.js` `attachInputListener` (lines 224-246)
**Apply to:** `shortcut-manager.js`, `main.js`
```javascript
// 重构后的快捷键派发逻辑
contents.on('before-input-event', (event, input) => {
  const action = findMatchingAction(input);
  if (!action) return;

  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow || focusedWindow.isDestroyed()) return;

  // 非 Realm 管理的窗口不派发（播放器窗口特殊处理保留）
  if (!windowManager.isManagedWindow(focusedWindow.id)) {
    if (action === 'closeTab') {
      event.preventDefault();
      focusedWindow.close();
    }
    return;
  }

  event.preventDefault();
  focusedWindow.webContents.send('shortcut:triggered', action);
});
```

### macOS Dock 菜单
**Source:** RESEARCH.md Pattern 4 + Electron Dock API
**Apply to:** `main.js` `app.whenReady` 中
```javascript
const { app, Menu } = require('electron');

const dockMenu = Menu.buildFromTemplate([
  {
    label: '新建窗口',
    click: () => {
      const defaultContainer = containerManager.getContainer('default');
      windowManager.createMainWindow('default', defaultContainer);
    }
  }
]);
app.dock.setMenu(dockMenu);
```

### activate 事件（含最小化恢复）
**Source:** RESEARCH.md Code Examples + Pitfall MW-7
**Apply to:** `main.js` `app.on('activate')`
```javascript
app.on('activate', (event, hasVisibleWindows) => {
  if (quitting || cookiesSaved) return;

  if (!hasVisibleWindows) {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      // 有隐藏窗口 → 恢复并聚焦
      const first = allWindows[0];
      if (first.isMinimized()) first.restore();
      first.focus();
    } else {
      // 没有窗口 → 创建新窗口
      const defaultContainer = containerManager.getContainer('default');
      windowManager.createMainWindow('default', defaultContainer);
    }
  }
});
```

### 广播替代单窗口发送
**Source:** `window-manager.js` 新增 `broadcast()` + 现有 `getMainWindow().webContents.send()` 模式
**Apply to:** `main.js` 中所有 `mainWindow.webContents.send()` 调用
```javascript
// 替换前：
const mainWindow = windowManager.getMainWindow();
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.webContents.send('bookmarks-bar:refresh');
}

// 替换后：
windowManager.broadcast('bookmarks-bar:refresh');
```

## No Analog Found

文件中没有完全无模拟的部分。所有四个文件都是自重构（在现有实现基础上扩展），模拟来源就是代码库自身。

但以下新增功能在代码库中没有直接的现有模拟：

| 新增功能 | 所在文件 | 原因 |
|----------|----------|------|
| `isManagedWindow(winId)` | `window-manager.js` | 新增方法，参考 `assertPlayerSender` 的单窗口校验模式 |
| `broadcast(channel, ...args)` | `window-manager.js` | 新增方法，参考现有 `mainWindow.webContents.send()` 模式 |
| `'newWindow'` 快捷键 | `shortcut-manager.js` | 新增 DEFAULT_SHORTCUTS 条目 |
| `'closeWindow'` 快捷键 | `shortcut-manager.js` | 新增 DEFAULT_SHORTCUTS 条目 |
| Dock 菜单 | `main.js` | 新增功能，无现有代码 |
| `hasVisibleWindows` 处理 | `main.js` | activate 事件扩展 |

## Metadata

**Analog search scope:** `~/Projects/Realm/`（项目根目录）
**Files scanned:** 4（window-manager.js, ipc-handlers.js, shortcut-manager.js, main.js）
**Pattern extraction date:** 2026-08-14

### 改动量评估

| 文件 | 当前行数 | 预估改动量 | 改动性质 |
|------|---------|-----------|---------|
| `window-manager.js` | 126 行 | HIGH (~50 行改动) | 数据结构重构 + 新增方法 |
| `ipc-handlers.js` | 1833 行 | HIGH (~20 行改动，但涉及核心安全校验) | assertTrustedSender 重构 + shortcut handler 适配 |
| `shortcut-manager.js` | 323 行 | MEDIUM (~40 行改动) | 派发逻辑重构 + 新增快捷键 |
| `main.js` | ~2591 行 | MEDIUM (~30 行改动) | Dock 菜单 + activate 重构 + broadcast 替换 |

### 关键风险点

1. **assertTrustedSender 泛化是阻塞性改动**：必须先完成 window-manager.js 的 `isManagedWindow`，再改 ipc-handlers.js 的 `assertTrustedSender`，否则新窗口 IPC 全部失效
2. **getMainWindow() 30+ 处调用需要逐一审查**：区分"需要主窗口"（如播放器相关）和"需要当前焦点窗口"两种语义
3. **ipcMain.handle 重复注册防护**：`registerHandlers()` 必须有防重复注册守卫（Pitfall MW-5）
4. **before-quit 的 show-quit-hint 必须改为 broadcast**：否则非主窗口按 Cmd+Q 看不到提示（Pitfall MW-6）

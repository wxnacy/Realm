# Technology Stack: Multi-Window Support

**Project:** Realm Browser
**Researched:** 2026-08-14
**Mode:** Ecosystem (Stack for multi-window support)

---

## v2.4 多窗口支持

### Recommended Stack

**零新依赖**——全部基于 Electron 原生 API + 已有依赖。

### Core Framework (Existing — No Changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | 32.x | 桌面应用框架 | 已选定，不可更改；原生 BrowserWindow 多窗口支持 |
| Node.js | LTS | 主进程运行时 | Electron 内置，主进程 IPC 和模块系统 |

### Window Management APIs (Electron Built-in — No New Dependencies)

| API | Module | Purpose | Why |
|-----|--------|---------|-----|
| `new BrowserWindow()` | electron | 创建多窗口实例 | 每次调用创建独立窗口，`win.id` 全局唯一 |
| `BrowserWindow.getAllWindows()` | electron | 获取所有打开的窗口 | 替代手动维护窗口列表，遍历所有窗口 |
| `BrowserWindow.getFocusedWindow()` | electron | 获取当前聚焦窗口 | 确定用户正在交互的窗口，Dock 菜单"新窗口"时定位目标 |
| `BrowserWindow.fromId(id)` | electron | 按 ID 查找窗口 | 精确查找窗口实例，IPC 通信时定位目标窗口 |
| `BrowserWindow.fromWebContents(wc)` | electron | 从 webContents 反推窗口 | IPC handler 中确定来源窗口，已广泛使用 |
| `win.getChildWindows()` | electron | 获取子窗口列表 | 追踪窗口父子关系，决定关闭行为 |
| `win.setParentWindow(parent)` | electron | 动态设置父子关系 | Tab 拖拽出窗口时建立/解除父子关系 |
| `app.dock.setMenu(menu)` | electron | macOS Dock 右键菜单 | 实现 MW-01：Dock 右击"新建窗口" |
| `screen.getCursorScreenPoint()` | electron | 获取鼠标绝对坐标 | Tab 拖拽检测：判断鼠标是否离开窗口边界 |
| `win.getBounds()` / `win.setPosition()` | electron | 获取/设置窗口位置和尺寸 | 拖拽出窗口时计算新窗口位置 |
| `win.webContents.send()` | electron | 向指定窗口发送 IPC 消息 | 多窗口间通信，定向广播状态更新 |

### Tab Drag-and-Drop Implementation (HTML5 + Electron Extensions)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| HTML5 Drag and Drop API | Web Standard | Tab 拖拽交互 | 原生浏览器支持，`ondragstart`/`ondrop` 事件 |
| `screen.getCursorScreenPoint()` | electron | 跨窗口拖拽检测 | 实时获取鼠标位置，判断是否拖出窗口边界 |
| CSS `-webkit-app-region` | WebKit | 拖拽区域定义 | 标题栏拖拽区域，`no-drag` 排除交互元素 |

### Supporting Patterns (No New Libraries)

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| `windowContainerMap` (Map<windowId, containerId>) | 窗口-容器映射 | 已有，扩展为支持多窗口 |
| `win.on('closed')` 事件 | 窗口清理 | 每个新窗口都需注册，清理映射和引用 |
| `win.on('focus')` 事件 | 活动窗口追踪 | 多窗口时确定"当前"窗口，快捷键派发 |
| IPC broadcast 模式 | 状态同步 | 容器切换、Tab 变更需广播到所有窗口 |
| `Menu.buildFromTemplate()` | 构建菜单 | Dock 菜单、应用菜单都需要 |

### New APIs to Use

| API | Module | Purpose |
|-----|--------|---------|
| `app.dock.setMenu()` | Electron (Main) | macOS Dock 右键菜单"新建窗口" |
| `app.on('activate')` | Electron (Main) | macOS Dock 图标点击处理 |
| `BrowserWindow.getAllWindows()` | Electron (Main) | 获取所有窗口列表 |
| `BrowserWindow.getFocusedWindow()` | Electron (Main) | 获取当前焦点窗口 |
| `screen.getCursorScreenPoint()` | Electron (Main) | 获取鼠标全局位置（拖拽检测） |
| `BrowserWindow.fromWebContents()` | Electron (Main) | 从 webContents 反查窗口 |
| `win.getChildWindows()` | Electron (Main) | 获取子窗口列表 |
| `win.setParentWindow()` | Electron (Main) | 动态设置父子窗口关系 |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| 窗口追踪 | `BrowserWindow.getAllWindows()` + 显式引用 | 手动维护 `Map<id, win>` | getAllWindows() 是权威来源，手动 Map 需同步维护，容易泄漏 |
| Tab 内容移动 | 销毁重建（序列化状态 → 新窗口重建） | `webContents.move()` | webContents.move() 在 Electron 32 中未正式发布，不可依赖 |
| Tab 拖拽实现 | HTML5 Drag API + screen.getCursorScreenPoint() | native drag (webContents.startDrag) | startDrag 要求文件路径，不适合虚拟 Tab 数据 |
| Dock 菜单 | `app.dock.setMenu()` | 系统托盘（Tray） | macOS 标准交互是 Dock 右键，Tray 是额外 UI |
| 渲染进程框架 | 原生 JS（已有） | React/Vue | 项目已选定原生 JS，引入框架与现有架构不一致 |

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| electron-tabs / electron-browser-window-tabs | 第三方库与现有自定义 Tab 系统冲突，增加依赖风险 |
| react-dnd / sortablejs | React/Vue 依赖，项目使用原生 JS |
| BrowserView（已废弃） | Electron 28+ 废弃，用 WebContentsView 替代；但多窗口不需要 View 迁移 |
| WebContentsView 迁移 | 多窗口功能不涉及 BrowserView → WebContentsView 迁移，保持现有 webviewTag 架构 |
| webContents.move() | 该 API 在 Electron 32 中不稳定/未正式发布，Tab 移动应通过状态序列化+重建实现 |
| 状态管理库（Redux/MobX） | 项目规模不需要，现有 state 对象 + Map 已足够 |
| IPC 库（electron-better-ipc） | 已有自定义 IPC 架构，第三方库增加复杂度 |
| macOS tabbingIdentifier | 与自定义 Tab 栏冲突，不使用 |

---

## Installation

```bash
# 无需新依赖 — 所有 API 都是 Electron 内置
# 现有依赖保持不变
```

---

## Integration Points with Existing Architecture

### 1. window-manager.js 扩展

当前 `window-manager.js` 只管理单个 `mainWindowRef`。多窗口需要：

```javascript
// 现有（单窗口）
let mainWindowRef = null;
function getMainWindow() { return mainWindowRef; }

// 扩展后（多窗口）
const windowRegistry = new Map();  // win.id → BrowserWindow
function getMainWindow() {
  return windowRegistry.values().next().value || null;
}
function getAllRealmWindows() {
  return Array.from(windowRegistry.values());
}
function isManagedWindow(winId) {
  return windowRegistry.has(winId);
}
function createSubWindow(options) {
  const win = new BrowserWindow(options);
  windowRegistry.set(win.id, win);
  win.on('closed', () => windowRegistry.delete(win.id));
  return win;
}
```

### 2. IPC 广播模式

当前 IPC 假设单窗口（`mainWindow.webContents.send()`）。多窗口需要：

```javascript
// 向所有窗口广播
function broadcastToAllWindows(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

// 向特定窗口发送
function sendToWindow(windowId, channel, data) {
  const win = BrowserWindow.fromId(windowId);
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
```

### 3. assertTrustedSender 扩展

当前 `assertTrustedSender` 只认主窗口。多窗口需要认所有 Realm 窗口：

```javascript
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) throw new Error('不受信');
  if (!windowManager.isManagedWindow(win.id)) throw new Error('不受信');
  return win;
}
```

### 4. macOS Dock 菜单实现

```javascript
const { app, Menu } = require('electron');

const dockMenu = Menu.buildFromTemplate([
  {
    label: '新建窗口',
    click: () => {
      const defaultContainer = containerManager.getContainer('default');
      const newWin = windowManager.createSubWindow({
        width: 1400, height: 900,
        webPreferences: {
          preload: path.join(__dirname, 'src/preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: true,
          session: defaultContainer.session,
        }
      });
      newWin.loadFile(path.join(__dirname, 'src/index.html'));
    }
  }
]);

app.dock.setMenu(dockMenu);
```

### 5. Tab 拖拽检测模式

```javascript
// 渲染进程中
let isDragging = false;
let dragTabId = null;

tabElement.addEventListener('dragstart', (e) => {
  isDragging = true;
  dragTabId = tabId;
  e.dataTransfer.setData('text/plain', tabId);
});

document.addEventListener('dragend', (e) => {
  isDragging = false;
  // 检查鼠标是否在窗口外
  const cursor = { x: e.screenX, y: e.screenY };
  window.realmAPI.handleTabDragEnd(dragTabId, cursor);
  dragTabId = null;
});
```

```javascript
// 主进程中
ipcMain.handle('tab:drag-end', async (event, tabId, cursor) => {
  const sourceWin = BrowserWindow.fromWebContents(event.sender);
  if (!sourceWin) return;

  const sourceBounds = sourceWin.getBounds();
  const isOutside = (
    cursor.x < sourceBounds.x ||
    cursor.x > sourceBounds.x + sourceBounds.width ||
    cursor.y < sourceBounds.y ||
    cursor.y > sourceBounds.y + sourceBounds.height
  );

  if (isOutside) {
    // 创建新窗口，将 Tab 移动过去
    const newWin = createWindowAtCursor(sourceBounds, tabId);
    // 通知源窗口移除该 Tab
    sourceWin.webContents.send('tab:removed', { tabId, movedToWindow: newWin.id });
  }
});
```

### 6. 窗口位置计算

```javascript
const { screen } = require('electron');

function createWindowAtCursor(parentBounds, tabId) {
  const cursor = screen.getCursorScreenPoint();
  const newWin = new BrowserWindow({
    x: Math.round(cursor.x - parentBounds.width / 2),
    y: Math.round(cursor.y - 15),  // 偏移使鼠标在 Tab 栏
    width: parentBounds.width,
    height: parentBounds.height,
    // ... 其他选项
  });
  return newWin;
}
```

---

## Key Electron API Details

### BrowserWindow 生命周期事件

| Event | 触发时机 | 用途 |
|-------|---------|------|
| `ready-to-show` | 页面渲染完成，可显示 | 避免白屏闪烁 |
| `closed` | 窗口已关闭 | 清理引用、更新 windowRegistry |
| `focus` | 窗口获得焦点 | 更新活动窗口追踪 |
| `blur` | 窗口失去焦点 | 通知渲染进程 |
| `close` | 窗口即将关闭（可阻止） | 确认退出、保存状态 |
| `show` / `hide` | 可见性变化 | UI 状态同步 |
| `unresponsive` / `responsive` | 页面响应状态 | 用户体验提示 |

### macOS Dock API 完整方法列表

| Method | Parameters | Returns |
|--------|-----------|---------|
| `dock.bounce([type])` | `type`: `"critical"` / `"informational"` | `Integer` |
| `dock.cancelBounce(id)` | `id`: Integer | void |
| `dock.downloadFinished(filePath)` | `filePath`: string | void |
| `dock.setBadge(text)` | `text`: string | void |
| `dock.getBadge()` | none | `string` |
| `dock.hide()` | none | void |
| `dock.show()` | none | `Promise<void>` |
| `dock.isVisible()` | none | `boolean` |
| `dock.setMenu(menu)` | `menu`: Menu | void |
| `dock.getMenu()` | none | `Menu \| null` |
| `dock.setIcon(image)` | `image`: NativeImage or string | void |

**注意**：`app.dock` 只在 macOS 上可用，其他平台为 `undefined`。Dock 类不从 `'electron'` 模块导出，只能作为其他方法的返回值获取。

### Screen 模块完整方法列表

| Method | Platform | Description |
|--------|----------|-------------|
| `getCursorScreenPoint()` | All (not Wayland) | 返回当前鼠标绝对位置 (DIP) |
| `getPrimaryDisplay()` | All | 返回主显示器 |
| `getAllDisplays()` | All | 返回所有显示器数组 |
| `getDisplayNearestPoint(point)` | All | 返回最近的显示器 |
| `getDisplayMatching(rect)` | All | 返回最匹配的显示器 |
| `screenToDipPoint(point)` | Windows, Linux | 物理坐标转 DIP |
| `dipToScreenPoint(point)` | Windows, Linux | DIP 转物理坐标 |

**Screen 事件**：`display-added`、`display-removed`、`display-metrics-changed`

### View 类方法（WebContentsView 继承）

| Method | Description |
|--------|-------------|
| `addChildView(view[, index])` | 添加子 View，可选位置 |
| `removeChildView(view)` | 移除子 View（无则 no-op） |
| `setBounds(bounds[, options])` | 设置边界，支持动画 |
| `getBounds()` | 获取相对于父级的边界 |
| `setBackgroundColor(color)` | 设置背景色 |
| `setBorderRadius(radius)` | 设置圆角 |
| `setBackgroundBlur(blurRadius)` | 设置背景模糊 |
| `setVisible(visible)` | 显示/隐藏 |
| `getVisible()` | 获取可见性 |

---

## Sources

- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) — HIGH confidence (official docs)
- [Electron Dock API](https://www.electronjs.org/docs/latest/api/dock) — HIGH confidence (official docs)
- [Electron Screen API](https://www.electronjs.org/docs/latest/api/screen) — HIGH confidence (official docs)
- [Electron View API](https://www.electronjs.org/docs/latest/api/view) — HIGH confidence (official docs)
- [Electron WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view) — HIGH confidence (official docs)
- [Electron Native File Drag & Drop](https://www.electronjs.org/docs/latest/tutorial/native-file-drag-drop) — HIGH confidence (official docs)
- [HTML5 Drag and Drop API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) — HIGH confidence

---
*Stack research for: Multi-Window Support (v2.4)*
*Researched: 2026-08-14*
*Confidence: HIGH — 零新 npm 依赖，全部基于 Electron 原生 API + 现有依赖*

# Phase 34: 窗口管理基础 - Research

**Researched:** 2026-08-14
**Domain:** Electron 多窗口管理 + IPC 信任模型 + 快捷键多窗口派发
**Confidence:** HIGH

## Summary

Phase 34 是 v2.4 多窗口支持的基础设施层，核心目标是将 Realm Browser 从单窗口架构扩展为多窗口架构。本阶段聚焦五个需求：MW-01（Dock 右击新建窗口）、MW-07（新窗口继承默认容器）、MW-08（Cmd+N 快捷键）、MW-09（Cmd+Shift+W 关闭窗口）、MW-10（窗口间焦点切换正常工作）。

研究结论明确：**零新 npm 依赖**，全部基于 Electron 原生 API（BrowserWindow、app.dock、screen）+ 已有依赖。核心改动集中在三个模块：`window-manager.js`（从单例 mainWindowRef 改为 Map）、`ipc-handlers.js`（assertTrustedSender 从硬编码主窗口改为 managedWindowIds 集合校验）、`shortcut-manager.js`（快捷键从单窗口派发改为焦点窗口派发）。

**主要风险：** assertTrustedSender 泛化是阻塞性改动——如果不先完成，新窗口的所有 IPC 调用都会被拒绝。快捷键派发需要从 `currentWindow` 单例改为 `BrowserWindow.getFocusedWindow()` 动态路由。`main.js` 中 30+ 处 `getMainWindow()` 调用需要逐一审查，区分"需要主窗口"和"需要当前焦点窗口"两种语义。

**Primary recommendation:** 先完成 window-manager.js 重构（Map + isManagedWindow + broadcast），再泛化 assertTrustedSender，最后处理快捷键派发和 Dock 菜单。这个顺序确保每一步都可独立验证。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**新窗口初始状态：**
- **D-01:** 新建窗口时第一个 Tab 显示新标签页（常用网站网格），与现有新标签页一致
- **D-02:** 新窗口使用默认容器（default），用户可以手动切换到其他容器
- **D-03:** Dock 右击"新建窗口"和 Cmd+N 快捷键行为完全一致

**窗口关闭策略：**
- **D-04:** Cmd+W 关闭当前 Tab；如果关闭的是最后一个 Tab，窗口自动关闭
- **D-05:** Cmd+Shift+W 关闭当前窗口（窗口内所有 Tab 一起关闭）
- **D-06:** 如果关闭的是最后一个窗口，应用退出

**工具栏状态管理：**
- **D-07:** 每个窗口独立的工具栏状态（URL 输入框、后退/前进按钮、容器选择器）
- **D-08:** 每个窗口独立的 Tab 栏（显示该窗口的 Tab 列表）
- **D-09:** 窗口焦点切换时，工具栏和 Tab 栏自动更新为该窗口的状态

**架构决策：**
- **D-10:** windowManager 从单例 mainWindowRef 改为 Map<windowId, BrowserWindow>
- **D-11:** assertTrustedSender 从硬编码主窗口改为 managedWindowIds 集合校验
- **D-12:** shortcut-manager 的快捷键派发到焦点窗口（BrowserWindow.getFocusedWindow()）
- **D-13:** 播放器窗口保持全局单例（不受多窗口影响）

### Claude's Discretion
无 — 用户对所有问题都做出了明确选择。

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MW-01 | 用户可以通过 Dock 右击菜单新建窗口 | `app.dock.setMenu()` API，Electron 原生支持 [VERIFIED: Electron docs] |
| MW-07 | 新窗口继承容器上下文（使用默认容器） | `containerManager.getContainer('default')` 已有实现 [VERIFIED: main.js:2476] |
| MW-08 | 用户可以使用 Cmd+N 快捷键新建窗口 | `shortcut-manager.js` DEFAULT_SHORTCUTS 扩展 + before-input-event 派发 [VERIFIED: shortcut-manager.js] |
| MW-09 | 用户可以使用 Cmd+Shift+W 关闭窗口 | `shortcut-manager.js` 新增 closeWindow 动作 + `win.close()` [VERIFIED: shortcut-manager.js] |
| MW-10 | 多窗口时窗口间焦点切换正常工作 | `win.on('focus')` 事件 + renderer 状态同步 [VERIFIED: Electron docs] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 窗口生命周期管理 | Main Process | — | BrowserWindow 只能在主进程创建和管理 |
| IPC 信任校验 | Main Process | — | assertTrustedSender 在 ipc-handlers.js，主进程模块 |
| 快捷键注册与派发 | Main Process | Renderer | before-input-event 在主进程匹配，触发后发送到渲染进程 |
| Tab 栏渲染 | Renderer | — | 每个窗口独立的 DOM 实例，渲染进程管理 |
| 工具栏状态 | Renderer | — | 每个窗口独立的 UI 状态 |
| 容器配置 | Main Process | — | containerManager 是全局模块，不与窗口绑定 |
| Dock 菜单 | Main Process | — | app.dock API 只在主进程可用 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 32.x | 桌面应用框架 | 已选定，不可更改；原生 BrowserWindow 多窗口支持 |
| Node.js | 22.x | 主进程运行时 | Electron 内置，主进程 IPC 和模块系统 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 8.x | 配置持久化 | 已有依赖，窗口状态持久化复用 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BrowserWindow 多实例 | WebContentsView | WebContentsView 不适合独立窗口场景，更适合同一窗口内的多视图 |
| 手动维护窗口 Map | BrowserWindow.getAllWindows() | getAllWindows() 包含所有窗口（含 DevTools），需要过滤；显式 Map 更可控 |

**Installation:**
```bash
# 无需新依赖 — 所有 API 都是 Electron 内置
```

## Package Legitimacy Audit

> Phase 34 不安装任何外部包。零新依赖。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│                                                         │
│  windowManager (重构: D-10)                             │
│  ├── windows: Map<windowId, BrowserWindow>              │
│  ├── managedWindowIds: Set<number>                      │
│  ├── createMainWindow(containerId, container)           │
│  ├── getMainWindow() → 第一个窗口（兼容）                │
│  ├── isManagedWindow(winId) → boolean                   │
│  └── broadcast(channel, ...args) → 所有窗口             │
│                                                         │
│  assertTrustedSender (重构: D-11)                       │
│  └── 检查 managedWindowIds.has(win.id)                  │
│                                                         │
│  shortcutManager (重构: D-12)                           │
│  ├── registerShortcuts() → app 级 web-contents-created  │
│  └── 派发到 BrowserWindow.getFocusedWindow()            │
│                                                         │
│  Dock Menu (新增: MW-01)                                │
│  └── app.dock.setMenu([新建窗口])                       │
└─────────────────────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │ Window 1 │  │ Window 2 │  │ Window N │
     │ Renderer │  │ Renderer │  │ Renderer │
     │ (default)│  │ (default)│  │ (default)│
     │ 独立 Tab │  │ 独立 Tab │  │ 独立 Tab │
     │ 独立工具栏│  │ 独立工具栏│  │ 独立工具栏│
     └──────────┘  └──────────┘  └──────────┘
```

### Recommended Project Structure
```
window-manager.js      # 重构：Map + isManagedWindow + broadcast
ipc-handlers.js        # 重构：assertTrustedSender 泛化
shortcut-manager.js    # 重构：焦点窗口派发
main.js                # 修改：Dock 菜单、activate 事件、新建窗口入口
src/preload.js         # 无需修改（每个窗口各有一份 preload 实例）
src/renderer.js        # 后续 Phase 处理 Tab 窗口关联
```

### Pattern 1: 窗口注册表模式

**What:** 将 mainWindowRef 单例改为 Map<windowId, BrowserWindow> + Set<windowId> 双重注册
**When to use:** 所有需要判断"是否为 Realm 管理的窗口"的场景
**Example:**
```javascript
// Source: ARCHITECTURE.md + PITFALLS.md (MW-2)
const windows = new Map();         // winId → BrowserWindow
const managedWindowIds = new Set(); // 仅包含 createMainWindow 创建的窗口

function createMainWindow(containerId, container) {
  const win = new BrowserWindow({ /* ... */ });
  windows.set(win.id, win);
  managedWindowIds.add(win.id);
  windowContainerMap.set(win.id, containerId);

  win.on('closed', () => {
    windows.delete(win.id);
    managedWindowIds.delete(win.id);
    windowContainerMap.delete(win.id);
  });

  return win;
}

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

### Pattern 2: assertTrustedSender 泛化

**What:** 从硬编码主窗口校验改为 managedWindowIds 集合校验
**When to use:** 所有 IPC handler 的入口校验
**Example:**
```javascript
// Source: ipc-handlers.js:76-83 (当前实现)
// Source: PITFALLS.md MW-1 (重构方案)
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

### Pattern 3: 快捷键焦点窗口派发

**What:** 快捷键从 currentWindow 单例派发改为 BrowserWindow.getFocusedWindow() 动态派发
**When to use:** before-input-event 监听器中的快捷键触发逻辑
**Example:**
```javascript
// Source: shortcut-manager.js:224-246 (当前实现)
// Source: D-12 决策 + PITFALLS.md MW-8
contents.on('before-input-event', (event, input) => {
  const action = findMatchingAction(input);
  if (!action) return;

  // 获取当前焦点窗口（而非固定的 currentWindow）
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow || focusedWindow.isDestroyed()) return;

  // 非 Realm 管理的窗口不派发
  if (!windowManager.isManagedWindow(focusedWindow.id)) {
    // 播放器窗口的 closeTab 特殊处理（D-13）
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

### Pattern 4: Dock 菜单新建窗口

**What:** macOS Dock 右击显示"新建窗口"菜单项
**When to use:** app.whenReady 中设置
**Example:**
```javascript
// Source: STACK.md Dock API
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

### Anti-Patterns to Avoid

- **getAllWindows()[0] 获取主窗口:** 窗口数组顺序不确定，已有 CR-7 决策禁止。使用 windowManager 显式引用。
- **每个窗口独立 tab-manager 实例:** Tab 拖拽跨窗口需要在两个实例间同步数据，极易出 bug。使用全局 tab-manager + Tab 对象的 windowId 字段。
- **renderer 直接创建 BrowserWindow:** 违反进程隔离原则。所有窗口操作通过 IPC 走主进程。
- **快捷键注册到所有窗口:** 多个窗口同时处理同一个快捷键，导致重复执行。使用 app 级 web-contents-created + 焦点窗口派发。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 窗口追踪 | 自定义窗口注册表 | Map + Set + win.on('closed') 清理 | 简单的 Map 已足够，不需要复杂的注册表模式 |
| 窗口间通信 | 自定义消息总线 | win.webContents.send() + broadcast() | Electron 原生 IPC 已足够 |
| Dock 菜单 | 自定义托盘菜单 | app.dock.setMenu() | macOS 标准行为，原生 API 支持完善 |
| 快捷键匹配 | 自定义按键解析 | before-input-event + parseAccelerator | 已有完整的 Accelerator 匹配实现 |

**Key insight:** Phase 34 是纯架构重构 + 基础设施搭建，不涉及新的 UI 功能。所有改动都是对现有模块的扩展，不需要引入新的外部依赖或构建复杂的自定义系统。

## Common Pitfalls

### Pitfall 1: assertTrustedSender 硬编码导致新窗口 IPC 全部失效 (MW-1)
**What goes wrong:** 新窗口打开后所有操作无反应，控制台报"不受信任的 IPC 来源"
**Why it happens:** `assertTrustedSender` 只接受 `win.id === mainWindow.id`，新窗口 ID 不同
**How to avoid:** 先完成 assertTrustedSender 泛化（D-11），再创建新窗口
**Warning signs:** 新窗口打开后 UI 无响应

### Pitfall 2: mainWindowRef 单例假设导致事件路由错乱 (MW-2)
**What goes wrong:** 容器切换后其他窗口的 Tab 颜色/标题不更新
**Why it happens:** `container-switched` 等事件只发送到主窗口
**How to avoid:** 使用 broadcast() 替代 mainWindow.webContents.send()
**Warning signs:** 多窗口时状态不一致

### Pitfall 3: ipcMain.handle 重复注册崩溃 (MW-5)
**What goes wrong:** 应用启动崩溃，报 "handler for 'container:list' already exists"
**Why it happens:** registerHandlers() 被多次调用
**How to avoid:** registerHandlers 内部加防重复注册守卫
**Warning signs:** 控制台报 "handler for 'xxx' already exists"

### Pitfall 4: window-all-closed 行为改变 (MW-7)
**What goes wrong:** 所有窗口最小化后点击 Dock 图标无反应
**Why it happens:** `activate` 事件只检查 `getAllWindows().length === 0`，不处理最小化情况
**How to avoid:** 使用 `hasVisibleWindows` 参数，最小化时 restore + focus
**Warning signs:** 最小化后 Dock 点击无反应

### Pitfall 5: 快捷键总是操作主窗口而非焦点窗口 (MW-8)
**What goes wrong:** 新窗口中快捷键不响应或操作错误的窗口
**Why it happens:** `currentWindow` 单例始终指向第一个窗口
**How to avoid:** 使用 BrowserWindow.getFocusedWindow() 动态获取焦点窗口
**Warning signs:** 新窗口快捷键不工作

### Pitfall 6: before-quit 退出提示只在主窗口显示
**What goes wrong:** 用户在非主窗口按 Cmd+Q，退出提示看不到
**Why it happens:** `show-quit-hint` 只发送到 getMainWindow()
**How to avoid:** 使用 broadcast() 发送退出提示到所有窗口
**Warning signs:** 非主窗口按 Cmd+Q 无反馈

## Code Examples

Verified patterns from official sources:

### 创建多窗口 BrowserWindow
```javascript
// Source: Electron BrowserWindow API
const { BrowserWindow } = require('electron');
const path = require('path');

function createMainWindow(containerId, container) {
  const win = new BrowserWindow({
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

  win.loadFile(path.join(__dirname, 'src/index.html'));
  return win;
}
```

### macOS Dock 菜单
```javascript
// Source: Electron Dock API
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

### activate 事件处理（含最小化恢复）
```javascript
// Source: Electron app 事件文档 + PITFALLS.md MW-7
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

### 广播模式
```javascript
// Source: ARCHITECTURE.md
function broadcast(channel, ...args) {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| mainWindowRef 单例 | Map<windowId, BrowserWindow> | Phase 34 (D-10) | 支持多窗口管理 |
| assertTrustedSender 硬编码主窗口 | managedWindowIds 集合校验 | Phase 34 (D-11) | 新窗口 IPC 可用 |
| 快捷键派发到 currentWindow | 派发到 getFocusedWindow() | Phase 34 (D-12) | 多窗口快捷键正常 |

**Deprecated/outdated:**
- `mainWindowRef` 单例模式：被 `windows` Map 替代
- `assertTrustedSender` 中 `win.id !== mainWindow.id` 硬编码：被 `managedWindowIds.has(win.id)` 替代
- `shortcut-manager.js` 中 `currentWindow` 单例派发：被 `BrowserWindow.getFocusedWindow()` 替代

## Assumptions Log

> 所有 claim 均来自已验证的代码库分析或 Electron 官方文档，无 ASSUMED 声明。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

## Open Questions

1. **renderer.js 如何获取当前窗口的 windowId？**
   - What we know: Electron 不直接暴露 windowId 给渲染进程
   - What's unclear: 是否需要新增 IPC 通道 `window:get-id`，还是通过 preload 注入
   - Recommendation: 在 preload 中通过 `ipcRenderer.invoke('window:get-id')` 获取，主进程从 event.sender 反推 windowId。这属于 Phase 35（Tab 窗口关联）的范围。

2. **broadcast() 的频率和性能影响？**
   - What we know: 当前 30+ 处使用 getMainWindow() 发送 IPC
   - What's unclear: 改为 broadcast 后是否会有性能问题
   - Recommendation: Phase 34 只处理 MW-01/07/08/09/10 相关的少量 broadcast，性能影响可忽略。后续 Phase 按需优化。

## Environment Availability

> Phase 34 无外部依赖，全部基于 Electron 内置 API。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 主进程运行时 | ✓ | 22.22.0 | — |
| npm | 包管理 | ✓ | 10.9.4 | — |
| Electron | 桌面框架 | ✓ | 32.x (项目依赖) | — |
| macOS | Dock API | ✓ | Darwin 24.1.0 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前无测试框架） |
| Config file | none |
| Quick run command | `npm test`（不存在） |
| Full suite command | `npm test`（不存在） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MW-01 | Dock 右击新建窗口 | manual-only | 手动验证：Dock 右击 → 新建窗口 → 窗口出现 | N/A |
| MW-07 | 新窗口使用默认容器 | manual-only | 手动验证：新建窗口 → 容器选择器显示 default | N/A |
| MW-08 | Cmd+N 新建窗口 | manual-only | 手动验证：Cmd+N → 新窗口出现 | N/A |
| MW-09 | Cmd+Shift+W 关闭窗口 | manual-only | 手动验证：Cmd+Shift+W → 当前窗口关闭 | N/A |
| MW-10 | 窗口间焦点切换 | manual-only | 手动验证：点击不同窗口 → 工具栏/Tab 栏更新 | N/A |

### Sampling Rate
- **Per task commit:** N/A（无自动化测试）
- **Per wave merge:** N/A
- **Phase gate:** 手动 UAT 验证所有 5 个需求

### Wave 0 Gaps
- [ ] 测试框架安装（可选，非阻塞）
- [ ] 手动验证脚本/清单

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | assertTrustedSender managedWindowIds 集合校验 |
| V5 Input Validation | no | — |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron Multi-Window

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 非信任窗口调用 IPC | Elevation of Privilege | assertTrustedSender 检查 managedWindowIds |
| DevTools 窗口绕过 IPC 校验 | Elevation of Privilege | managedWindowIds 只包含 createMainWindow 创建的窗口 |
| webview guest 调用特权 IPC | Elevation of Privilege | BrowserWindow.fromWebContents() 解析到宿主窗口，guest 不在 managedWindowIds 中 |

## Sources

### Primary (HIGH confidence)
- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) — 窗口创建、生命周期事件
- [Electron Dock API](https://www.electronjs.org/docs/latest/api/dock) — macOS Dock 菜单
- [Electron app 事件](https://www.electronjs.org/docs/latest/api/app) — activate、window-all-closed、before-quit
- 代码库 `window-manager.js` — 当前单窗口实现（126 行）
- 代码库 `shortcut-manager.js` — 当前快捷键实现（323 行）
- 代码库 `ipc-handlers.js` — 当前 assertTrustedSender 实现（76-83 行）
- 代码库 `main.js` — 当前窗口创建和事件处理（2591 行）

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — 多窗口架构设计
- `.planning/research/PITFALLS.md` — 21 个陷阱分析
- `.planning/research/STACK.md` — Electron 多窗口 API 总结
- `.planning/research/FEATURES.md` — Chrome 多窗口行为分析

### Tertiary (LOW confidence)
- （无 — 所有 findings 均有代码库或官方文档支撑）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 零新依赖，全部 Electron 内置 API
- Architecture: HIGH — 现有代码分析完整，改动点明确，已有研究文档支撑
- Pitfalls: HIGH — 21 个陷阱已详细分析，Phase 34 涉及的 6 个陷阱有明确规避方案

**Research date:** 2026-08-14
**Valid until:** 2026-09-14（Electron 32.x API 稳定，30 天有效）

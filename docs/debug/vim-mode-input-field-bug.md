# Vim 模式输入框拦截问题排查实录

> **状态：已修复（2026-08-27）**。真正根因与修复方案见文末「8. 修复结论」。
> 第 3 章的「IPC 异步竞态」分析只是表层原因之一；guest 侧的实际根因是
> webview-preload.js 初始化崩溃导致焦点检测代码从未执行（见 8.1）。

## 1. 问题描述

Vim 模式开启后，在输入框（地址栏、AI 输入框、网页内的 input/textarea）中按字母键时，按键被当作 Vim 快捷键处理（如 `j` 变成向下滚动），导致无法正常输入文字。

## 2. Vim 模式架构概览

### 2.1 按键捕获链路

所有键盘事件通过 Electron 的 `before-input-event` 在**主进程**中拦截，处理优先级如下：

```
shortcut-manager.js → attachInputListener(contents)
  ↓
contents.on('before-input-event', (event, input) => {
  ① 非 keyDown → 忽略
  ② 有修饰键(Cmd/Ctrl/Alt) → 跳到 Accelerator 匹配
  ③ Vim 快捷键处理（无修饰键时）：
     - hintModeActive && !isInInput → 转发 hint 按键到 renderer
     - !hintModeActive && !searchInputActive：
       - isInInput → 放行（不拦截，让输入框接收按键）
       - !isInInput && vimEnabled → VimStateMachine.processKey()
  ④ Accelerator 匹配（Cmd+T 等常规快捷键）
})
```

### 2.2 焦点状态检测机制

主进程通过 `vimFocusStates` Map（key: webContents.id, value: boolean）判断焦点是否在输入框中。

**两条独立的焦点上报链路：**

#### 链路 A：主窗口（地址栏、AI 输入框等 chrome 内输入框）

```
renderer.js initVimShortcuts()
  → document.addEventListener('focusin', reportHostFocus)
  → reportHostFocus() 检查 document.activeElement 是否为 INPUT/TEXTAREA/SELECT/contentEditable
  → window.realmAPI.setHostVimFocusState(isInInput)
  → preload.js: ipcRenderer.invoke('vim:set-focus-state', null, isInInput)
  → shortcut-manager.js: ipcMain.handle('vim:set-focus-state', ...)
    → event.sender.id 作为 key（即主窗口 webContents.id）
    → vimFocusStates.set(id, isInInput)
```

相关代码位置：
- `src/renderer.js:2782-2797` — `initVimShortcuts()` 中的 `reportHostFocus`
- `src/preload.js:1039-1041` — `setHostVimFocusState`
- `shortcut-manager.js:468-473` — `ipcMain.handle('vim:set-focus-state', ...)`

#### 链路 B：Webview Guest 内的输入框

```
webview-preload.js
  → document.addEventListener('focusin', _checkAndReportFocusState)
  → _isFocusInInputElement() 检查 document.activeElement
  → window.__realmBridge.sendFocusState(isInInput)
  → ipcRenderer.sendToHost('vim:focus-state', isInInput)
  → renderer.js initVimFocusListener(webview) 监听 ipc-message
  → window.realmAPI.setVimFocusState(guestWebContentsId, isInInput)
  → preload.js: ipcRenderer.invoke('vim:set-focus-state', guestId, isInInput)
  → shortcut-manager.js: vimFocusStates.set(guestId, isInInput)
```

相关代码位置：
- `src/webview-preload.js:500-549` — 焦点检测（focusin/focusout + 500ms 兜底轮询）
- `src/webview-preload.js:19-42` — `__realmBridge` API 定义
- `src/renderer.js:3023-3071` — `initVimFocusListener(webview)`
- `src/preload.js:1030-1032` — `setVimFocusState`

### 2.3 VimStateMachine 状态机

文件：`src/vimium/vimium-manager.js:119-237`

三个状态：`idle`、`pending_g`、`pending_y`，双键序列有 500ms 超时。

单键映射（`SINGLE_KEY_MAP`，第 37-72 行）：
- 滚动：j/k/h/l/d/u/G
- 导航：H(goBack)/L(goForward)/r(reload)/R(hardReload)
- 标签：J(prevTab)/K(nextTab)/x(closeTab)/X(restoreTab)/t(newTab)
- URL：o(focusUrl)/O(focusUrlNewTab)
- 其他：/(searchMode)/?(showHelp)/f(hintMode)/F(hintModeNewTab) 等

双键映射：
- `PENDING_G_MAP`（第 78-86 行）：gg/g0/g$/ge/gt/gT/gs
- `PENDING_Y_MAP`（第 92-96 行）：yy/yf/yt

### 2.4 before-input-event 监听器挂载

文件：`shortcut-manager.js:398-412`

```javascript
function ensureAppListener() {
  app.on('web-contents-created', (_event, contents) => {
    const type = contents.getType();
    if (type === 'window' || type === 'webview') {
      attachInputListener(contents);  // 挂 before-input-event
      contents.on('destroyed', () => {
        vimFocusStates.delete(contents.id);  // 销毁时清理
      });
    }
  });
}
```

另外 `main.js:516-524` 也有一个独立的 `before-input-event` 监听器，仅处理 F12 键（DevTools 开关），不影响 Vim 逻辑。

### 2.5 完整数据流图

```
用户按键
  │
  ▼
[主进程] before-input-event（shortcut-manager.js:271）
  │
  ├─ vimFocusStates.get(contents.id) == true?
  │   ├─ 是 → 放行，按键到达输入框 ✓
  │   └─ 否 → VimStateMachine.processKey()
  │            ├─ 命中命令 → preventDefault + IPC 到 renderer
  │            └─ 未命中 → 放行
  │
  ▼
[renderer] vim:triggered IPC → initVimShortcuts() 分发命令
  │
  ▼
[renderer] webview.executeJavaScript() 注入滚动/Hint/搜索脚本
```

## 3. 问题根因分析

### 3.1 核心问题：IPC 异步竞态

焦点状态上报使用 `ipcRenderer.invoke()`（异步），而 `before-input-event` 是原生同步事件。

**竞态时序：**

```
时间线：
  T1: 用户点击输入框
  T2: renderer focusin 事件触发
  T3: renderer 调用 ipcRenderer.invoke('vim:set-focus-state', ...)  ← 异步，消息入队
  T4: 用户按下 'j' 键
  T5: 主进程 before-input-event 同步触发
  T6: vimFocusStates.get(contents.id) 返回 false（IPC 消息还在队列中！）
  T7: VimStateMachine 处理 'j' → scrollDown 命令 → preventDefault()  ← 按键被吞
  T8: 主进程处理 vim:set-focus-state IPC → vimFocusStates 更新为 true（太迟了）
```

### 3.2 Electron IPC 与原生事件的时序关系

Electron 的 `ipcRenderer.invoke` 将消息放入 IPC 管道，主进程在事件循环中异步处理。而 `before-input-event` 是 Chromium 原生输入事件，在 libuv 事件循环中以更高优先级处理。

**关键点**：原生输入事件的处理优先级高于 IPC 消息，导致 `before-input-event` 可能在 `vim:set-focus-state` IPC 消息之前被处理。

### 3.3 受影响场景

1. **快速输入**：用户点击输入框后立即开始打字（click-to-keystroke 间隔 < IPC 延迟）
2. **页面加载期间**：webview preload 的 `_checkAndReportFocusState` 依赖 `DOMContentLoaded` 事件，页面加载未完成时焦点状态未上报
3. **应用启动初期**：`registerShortcuts()` 在 `app.whenReady()` 后调用，早期的按键可能在 IPC handler 注册前触发

## 4. 尝试的修复方案及失败原因

### 4.1 方案：将焦点 IPC 改为同步（sendSync）

**改动文件：**

1. `src/preload.js` — `setVimFocusState` 和 `setHostVimFocusState` 从 `ipcRenderer.invoke` 改为 `ipcRenderer.sendSync`
2. `shortcut-manager.js` — 新增 `ipcMain.on('vim:set-focus-state-sync', ...)` 同步处理器
3. `src/webview-preload.js` — 在 preload 加载时立即调用 `_checkAndReportFocusState()`（不等 DOMContentLoaded）

**失败现象**：应用启动后完全卡死，任何操作都无响应。

**失败原因**：

`ipcRenderer.sendSync` 会阻塞渲染进程，直到主进程的处理器返回。webview-preload.js 中新增的立即调用 `_checkAndReportFocusState()` 在脚本加载时就执行 `sendSync`，但此时主进程的 `registerVimIpcHandlers()` 可能尚未完成注册（`registerShortcuts()` 在 `app.whenReady()` 之后的 `createWindow()` 流程中调用）。

`sendSync` 发出的 `vim:set-focus-state-sync` 消息到达主进程后找不到对应的 handler（`ipcMain.on` 尚未注册），导致消息永远不会被处理 → `sendSync` 永远阻塞 → 渲染进程挂起 → 整个应用死锁。

**教训**：`ipcRenderer.sendSync` 极度危险，必须确保：
- 对应的 `ipcMain.on` handler 在任何可能触发 `sendSync` 的代码执行前已完成注册
- handler 内部不能有任何可能阻塞的操作
- webview preload 中的代码执行时机不可控（页面加载的任意阶段），不适合使用 sync IPC

## 5. 建议的修复方向

### 方案 A：在 before-input-event 中同步检查焦点（推荐）

不依赖 IPC 上报焦点状态，改为在 `before-input-event` 处理器中直接向 renderer 同步查询：

```javascript
// shortcut-manager.js 的 before-input-event 处理器中
if (!hasModifier && vimEnabled) {
  // 向 renderer 同步查询焦点状态（而非依赖提前上报的 Map）
  const isInInput = focusedWindow.webContents.sendSync('vim:query-focus-state');
  if (!isInInput) {
    const command = VimStateMachine.processKey(input.key, { shift: input.shift });
    // ...
  }
}
```

renderer 侧：
```javascript
// src/renderer.js
ipcRenderer.on('vim:query-focus-state', (event) => {
  const el = document.activeElement;
  const inInput = !!(el && (el.tagName === 'INPUT' || ...));
  event.returnValue = inInput;
});
```

**注意**：此方案只能检测主窗口的焦点状态，webview guest 内的焦点仍需通过 preload 上报（但 webview guest 的 before-input-event 是独立的 webContents，可以各自维护状态）。

### 方案 B：将 Vim 快捷键处理移到渲染进程

放弃在主进程用 `before-input-event` 拦截，改为在 renderer 的 `document.addEventListener('keydown', ...)` 中处理 Vim 快捷键。renderer 可以同步检查 `document.activeElement`，彻底消除 IPC 竞态。

**缺点**：需要给每个 webview guest 也注入 keydown 监听器（通过 preload），改动范围较大。

### 方案 C：利用 webContents.executeJavaScript 同步查询

在 `before-input-event` 中通过 `contents.executeJavaScript()` 同步查询 guest 的焦点状态：

```javascript
// 对 webview guest 的 contents
const isInInput = await contents.executeJavaScript(
  `document.activeElement?.tagName === 'INPUT' || ...`
);
```

**缺点**：`executeJavaScript` 是异步的，无法在同步的 `before-input-event` 中使用。不可行。

### 方案 D：webview guest 用独立的 before-input-event 处理

webview guest 的 `before-input-event` 是独立的 webContents 事件，可以在 guest 的 preload 中通过 `ipcRenderer.sendSync` 向主进程报告焦点状态（guest preload 的执行时机比主窗口 renderer 更可控）。

但这仍然有 sendSync 死锁风险（参见 4.1 节）。

## 6. 关键文件索引

| 文件 | 关键行号 | 说明 |
|------|---------|------|
| `shortcut-manager.js` | 37-72 | `SINGLE_KEY_MAP` 单键命令映射 |
| `shortcut-manager.js` | 78-96 | `PENDING_G_MAP` / `PENDING_Y_MAP` 双键映射 |
| `shortcut-manager.js` | 119-237 | `VimStateMachine` 状态机 |
| `shortcut-manager.js` | 247-254 | `isVimEnabled()` 读取设置 |
| `shortcut-manager.js` | 266-392 | `attachInputListener()` — before-input-event 处理核心 |
| `shortcut-manager.js` | 279-348 | Vim 快捷键处理分支（优先级 3） |
| `shortcut-manager.js` | 313-346 | 无修饰键时的 Vim 命令处理（`isInInput` 检查在此） |
| `shortcut-manager.js` | 453-460 | `setVimFocusState()` — 写入 vimFocusStates Map |
| `shortcut-manager.js` | 466-498 | `registerVimIpcHandlers()` — 所有 Vim IPC 处理器 |
| `shortcut-manager.js` | 398-412 | `ensureAppListener()` — web-contents-created 监听 |
| `src/renderer.js` | 2782-2797 | `initVimShortcuts()` — host 焦点上报 |
| `src/renderer.js` | 2808-3014 | Vim 命令分发（vim:triggered IPC 处理） |
| `src/renderer.js` | 3023-3071 | `initVimFocusListener(webview)` — guest 焦点转发 |
| `src/renderer.js` | 2090-2320 | `injectHintMode()` — Hint Mode 注入 |
| `src/renderer.js` | 2333-2483 | `injectSearchBar()` — 搜索栏注入 |
| `src/webview-preload.js` | 19-42 | `__realmBridge` API（sendFocusState 等） |
| `src/webview-preload.js` | 500-549 | 焦点检测（`_isFocusInInputElement` + 事件监听 + 轮询） |
| `src/preload.js` | 1003-1077 | Vim 相关 API 暴露给 renderer |
| `src/vimium/vimium-manager.js` | 119-237 | VimStateMachine 完整实现 |
| `main.js` | 404-524 | web-contents-created 处理（UA/CDP/F12） |
| `main.js` | 516-524 | F12 拦截（独立于 shortcut-manager） |

## 7. 调试建议

### 7.1 添加日志定位问题

在 `shortcut-manager.js` 的 `before-input-event` 处理器中添加日志：

```javascript
// shortcut-manager.js:313 附近
if (!hasModifier) {
  const isInInput = vimFocusStates.get(contents.id) || false;
  const vimEnabled = isVimEnabled(settingsStore);
  console.log(`[Vim Debug] key=${input.key}, contentsId=${contents.id}, isInInput=${isInInput}, vimEnabled=${vimEnabled}, vimFocusStates=`, Object.fromEntries(vimFocusStates));
  // ...
}
```

在 `src/renderer.js` 的 `reportHostFocus` 中添加日志：

```javascript
const reportHostFocus = () => {
  const el = document.activeElement;
  const inInput = !!(el && (el.tagName === 'INPUT' || ...));
  if (inInput !== hostFocusInInput) {
    hostFocusInInput = inInput;
    console.log(`[Vim Debug] hostFocusInInput changed to ${inInput}, activeElement=${el?.tagName}.${el?.className}`);
    window.realmAPI.setHostVimFocusState(inInput);
  }
};
```

### 7.2 验证步骤

1. 启动应用 `npm run dev`
2. 打开 DevTools Console
3. 点击地址栏，观察是否有 `[Vim Debug] hostFocusInInput changed to true` 日志
4. 在地址栏中按 `j` 键，观察日志中 `isInInput` 的值
5. 如果 `isInInput` 为 `false`，说明 IPC 竞态确实发生
6. 对比 `hostFocusInInput changed to true` 和 `key=j` 两条日志的时间戳

### 7.3 临时绕过方案

如果需要临时禁用 Vim 模式以正常使用应用，在设置页面关闭 Vimium 开关即可。

## 8. 修复结论（2026-08-27）

### 8.1 真正根因（双层）

**根因 A（guest 侧，主根因）：webview-preload.js 初始化崩溃，焦点检测从未执行。**

preload 脚本在 document start 阶段执行，此时 `document.body` 和 `document.documentElement`
均为 `null`。文件中部的凭据 MutationObserver 挂载代码：

```javascript
_credentialObserver.observe(document.body || document.documentElement, {...});  // observe(null) → TypeError
```

抛出 TypeError 后，**文件尾部的整个「Vim 快捷键焦点检测」段（focusin/focusout 监听 +
500ms 轮询）永远不会执行**。因此 webview guest 的焦点状态从未上报过，`vimFocusStates`
里永远没有 guest 条目，主进程一律按「不在输入框」处理 → 网页内输入框打字必被吞。

这解释了为什么竞态修复（方案 4.1 sendSync）解决不了问题：上报代码根本没在跑。
第 3 章的 IPC 竞态分析对 host 侧（地址栏）成立，但对 guest 侧只是理论风险。

**根因 B（host 侧 + 时序边界）：异步 IPC 竞态。** 即第 3 章分析：focusin → 异步 IPC →
主进程 Map 更新，与 before-input-event 的同步读取之间存在窗口期。guest 侧上报链更是
「guest → host renderer → main」两跳，窗口期更长。

### 8.2 修复方案

1. **根因 A**：`_credentialObserver.observe` 目标节点为 null 时延迟到 DOMContentLoaded
   再挂载（webview-preload.js）。
2. **根因 B**：焦点上报改为 `ipcRenderer.sendSync('vim:set-focus-state-sync')` 同步直达
   主进程（一跳，event.sender.id 即上报方 webContents id），sendSync 返回时主进程 Map
   已更新，竞态窗口降为 0。对应 handler 在 shortcut-manager.js **模块 require 时即注册**
   （早于任何窗口创建）、handler 体仅写 Map 且 try/finally 必设 `event.returnValue`——
   这两个条件规避了 4.1 节的 sendSync 死锁。sendSync 抛异常（导航销毁中）时回退原异步链。
   - `shortcut-manager.js`：模块级 `ipcMain.on('vim:set-focus-state-sync')`，保留异步
     `vim:set-focus-state` 作回退
   - `src/webview-preload.js`：`_checkAndReportFocusState` 直调 sendSync（不再走
     __realmBridge → host 两跳）
   - `src/preload.js`：`setHostVimFocusState` 改 sendSync + invoke 回退
3. **顺带修复 hintMode 进入竞态**（与 searchMode 同类）：主进程派发
   hintMode/hintModeNewTab/copyLinkUrl 命令时同步置 `hintModeActive = true`（不等
   renderer 的 set-hint-active IPC 回传）；renderer 丢弃命令时（帮助对话框打开 /
   无活动 webview）负责回退 `setVimHintActive(false)`，防止标志卡死吞键。
4. **调试接口**：shortcut-manager 新增 `getVimFocusState(id)` / `getVimDebugState()`
   导出，供测试与排查读取主进程内部状态。

### 8.3 验证

playwright `_electron` 驱动 dev 应用实测通过（14 项断言）：

- host 地址栏 focus/blur → 主进程状态同步翻转
- guest 内注入 input focus/blur → 主进程状态同步翻转（证明根因 A 修复，焦点检测真正运行）
- 主进程手动 `webContents.emit('before-input-event', ...)` 走真实处理器：
  - 焦点在 guest 输入框时按 `j` **放行**；移出焦点后按 `j` 被拦截为 scrollDown
  - 焦点在地址栏时按 `f` 放行；blur 后按 `f` 被拦截为 hintMode
- hintMode 命令派发时主进程同步置位，退出后清除
- 全程无 sendSync 死锁

**测试方法要点**（沉淀自本次排查）：
- Playwright 合成键不进 `before-input-event`，但可在主进程 `app.evaluate` 里
  `webContents.emit('before-input-event', { preventDefault: spy }, input)` 手动触发真实监听器链路
- webview 的 `console-message` 事件在新版 Electron 已收不到 guest 日志；跨隔离世界
  传调试信息可用共享 DOM（如 `document.documentElement.dataset`）
- `app.evaluate` 里无全局 `require`，用 `process.mainModule.require(...)` 取应用模块（缓存同实例）

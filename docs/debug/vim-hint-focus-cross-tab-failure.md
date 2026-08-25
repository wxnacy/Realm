# Vim f/F Hint Mode 焦点跨标签页转移失败（已修复）

> **状态**：2026-08-25 已修复。根因确认为推测 A，修复见文末「最终修复方案」。

## 问题症状

- **首标签页正常**：在第一个打开的标签页中，按 `f`/`F` 进入 Vim Hint Mode，字母按钮出现，随后按键可被正常捕获并处理。
- **快捷键切标签后失效**：使用快捷键（`Cmd+Shift+]` / `Cmd+Shift+[`）切换到其他已存在的标签页后，按 `f`/`F` 字母按钮仍然出现，但**后续按键无响应**（按字母键 hint 不消失、不触发 click）。需要**手动用鼠标点击页面**才能恢复焦点，此后按键正常。
- **鼠标切标签正常**：使用鼠标点击 tab 栏切换标签页后，直接按 `f`/`F` 一切正常。

## 复现步骤

1. 打开 Realm，确保 Vim 模式已启用。
2. 在标签页 A 中打开任意网页，按 `f`，确认 hint 模式工作正常。
3. 用快捷键 `Cmd+Shift+]` 切换到标签页 B。
4. 按 `f`，字母按钮出现。
5. 按任意字母键（如 `a`），**无任何反应**。
6. 鼠标点击页面任意位置，再按字母键，**恢复正常**。

## 核心差异

| 切换方式 | 焦点转移路径 | 结果 |
|---------|-------------|------|
| 鼠标点击 tab | renderer DOM (tab 元素) → 新 webview guest | ✅ 正常 |
| 快捷键切换 | 旧 webview guest → 新 webview guest（需要跨越 hidden 状态） | ❌ 失效 |

## 涉及代码位置

- `src/renderer.js:1533-1549` — `showWebview()` 控制 webview `visibility/position`
- `src/renderer.js:677-767` — `switchTab()` 切换标签逻辑
- `src/renderer.js:2005-2222` — `injectHintMode()` 注入 hint 脚本并尝试 focus
- `src/renderer.js:2669-2954` — `initVimShortcuts()` Vim 事件分发
- `shortcut-manager.js:269-372` — 主进程 `before-input-event` 处理

## 已尝试的修复（按时间顺序）

所有修改均已提交到 git，可在 `git log` 中追溯。

### 1. `injectHintMode` 注入后 `webview.focus()`
**提交**: `b52d211`
**修改**: `webview.executeJavaScript(hintScript).then(() => webview.focus())`
**结果**: ❌ 首标签页生效，快捷键切标签后仍失效。

### 2. `switchTab` 中检测 `document.activeElement` 为 `WEBVIEW` 时 `focus()`
**提交**: `fd1a364`
**修改**: `if (document.activeElement.tagName === 'WEBVIEW') activeWebview.focus()`
**结果**: ❌ 推测 `document.activeElement` 在切标签时已不是 webview。

### 3. `showWebview` 隐藏 webview 时 `document.activeElement === wv` 才 `blur()`
**提交**: `81d7ad9`
**修改**: 隐藏时检查 `document.activeElement === wv` 后 `wv.blur()`
**结果**: ❌ 检查条件可能未命中。

### 4. `injectHintMode` 中 `document.body.focus()` 再 `webview.focus()`
**提交**: `2b09ba8`
**修改**: 注入后先 `document.body.focus()`，再 `webview.focus()`
**结果**: ❌ 未生效。

### 5. `injectHintMode` 中 `requestAnimationFrame` 延迟 `focus()`
**提交**: `cfdd0ff`
**修改**: `requestAnimationFrame(() => webview.focus())`
**结果**: ❌ 未生效。

### 6. `injectHintMode` 中 `setTimeout(..., 100)` 延迟 `focus()`
**提交**: `cfdd0ff` (覆盖上一笔)
**修改**: `setTimeout(() => webview.focus(), 100)`
**结果**: ❌ 未生效。

### 7. `showWebview` 中无条件 `blur()` + guest `window.blur()`
**提交**: `cfdd0ff`
**修改**: 对所有非活动 webview 调用 `wv.blur()` 和 `wv.executeJavaScript('window.blur();')`
**结果**: ❌ 未生效。

### 8. `switchTab` 中无条件 `setTimeout(..., 1000)` `focus()`
**提交**: `48bf161`
**修改**: 移除 `document.activeElement` 检查，对所有切换都延迟 1s `focus()`
**结果**: ❌ 未生效。

### 9. `injectHintMode` 中 `tabIndex = -1` 再 `focus()`
**提交**: `48bf161`
**修改**: 注入后设置 `webview.tabIndex = -1`，再 `webview.focus()`
**结果**: ❌ 未生效。

### 10. `showWebview` 中隐藏 webview 加 `pointer-events: none`
**提交**: `ba0a595`
**修改**: `wv.style.pointerEvents = 'none'`
**结果**: ❌ 未生效。

### 11. `showWebview` 中隐藏 webview 加 `inert = true`
**提交**: `2b52d4a`
**修改**: `wv.inert = true`，同时保留 `pointer-events:none` + `blur()` + `window.blur()`
**结果**: ❌ 未生效。

## 当前代码状态（截至最新提交）

```
757f2a1 fix(vim): route hint keys via main-process IPC and focus guest via WebContents.focus()
8bb284b feat: add CmdOrCtrl+; shortcut to focus webview page
b52d211 fix(vim): focus webview after injecting hint mode
fd1a364 fix(vim): transfer focus to new webview on tab switch
81d7ad9 fix(vim): blur hidden webview in showWebview
2b09ba8 fix(vim): use setTimeout delay for webview.focus()
cfdd0ff fix(vim): blur hidden webview via guest window.blur()
48bf161 fix(vim): retry focus with tabIndex reset
ba0a595 fix(vim): add pointer-events:none to hidden webviews
2b52d4a fix(vim): add inert attribute to hidden webviews
```

所有尝试均集中在 **renderer 侧 DOM focus 操作** + **guest 侧 `window.blur()`**，但无一奏效。

## 根因推测（供后续排查）

### 推测 A：Electron webview focus 跨 guest 转移存在底层限制
当焦点位于 webview A 的 guest WebContents 内部时，直接调用 webview B 的 `focus()` 方法可能**在 Chromium 层面不被支持**。鼠标点击切换之所以有效，是因为 click 事件先将焦点从 webview guest **拉回了 renderer DOM**（tab 元素），随后 `injectHintMode` 中的 `focus()` 是从 renderer DOM **进入** webview guest，路径不同。

**验证方向**：在 `switchTab` 中不直接 `activeWebview.focus()`，而是先 `elements.urlInput.focus()` 再 `elements.urlInput.blur()`，强制焦点先回到 renderer DOM，再尝试 `activeWebview.focus()`。

### 推测 B：`before-input-event` 事件队列缓存
Chromium 的 `before-input-event` 可能在旧 webview 的 guest WebContents 上**已排队**，即使 `focus()` 调用成功，已排队的按键事件仍会被旧 webview 处理。但用户反馈的是**后续所有按键**都无效，不只是第一个，此推测可能性较低。

### 推测 C：webview `visibility:hidden` 后 guest WebContents 进入特殊状态
webview 被 `visibility:hidden` 后，其 guest WebContents 可能进入某种**挂起/冻结状态**，此时：
- `executeJavaScript` 仍可注入并渲染 DOM（字母按钮出现）
- 但事件监听系统未完全恢复，导致 `keydown` 捕获失败
- `focus()` 调用被静默忽略

**验证方向**：尝试将 `showWebview` 的隐藏方式从 `visibility:hidden` 改为其他方案（如 `transform: translateX(-9999px)` 或 `opacity:0`），观察是否恢复。注意 `display:none` 会卸载 guest，副作用更大。

### 推测 D：主进程 `before-input-event` 分发路径问题
主进程的 `before-input-event` 监听挂在**每个 webContents** 上。当焦点在旧 webview guest 中时，按键事件在旧 webview 的 `before-input-event` 上触发。即使 `hintModeActive=true`，旧 webview 没有 hint 脚本，按键被正常放行。如果 `hintModeActive` 由于某种竞态**未及时变为 true**，旧 webview 的 `before-input-event` 会再次触发 Vim 命令处理，导致事件被拦截。

**验证方向**：在 `shortcut-manager.js` 的 `before-input-event` 处理中添加日志，确认事件实际在哪个 `contents.id` 上触发，以及 `hintModeActive` 的值。

## 建议排查步骤

1. **加日志定位事件源**：在 `shortcut-manager.js:269` 的 `before-input-event` 处理中，打印 `contents.id`、`input.key`、`hintModeActive`，确认按键实际在哪个 webContents 上触发。
2. **验证 focus() 是否生效**：在 `injectHintMode` 的 `.then()` 回调中，通过 `webview.executeJavaScript('document.hasFocus()')` 检查 guest 是否真正获得了焦点。
3. **尝试 renderer DOM 中转**：在 `switchTab` 中先 `elements.urlInput.focus()` 再 `blur()`，再 `activeWebview.focus()`，验证推测 A。
4. **尝试更换隐藏方式**：将 `showWebview` 中的 `visibility:hidden` 替换为 `transform: translateX(-9999px)`，验证推测 C。
5. **检查 Electron 版本兼容性**：确认当前 Electron 版本是否存在已知的 webview focus 跨切换 bug。

## 最终修复方案（2026-08-25，已验证，commit `757f2a1`）

**根因确认（推测 A）**：键盘焦点位于 webview A 的 guest WebContents 内部时，renderer 侧
DOM `webview.focus()` **无法**把焦点拉出旧 guest——真实环境实测：快捷键切标签后
新 guest 的 `document.hasFocus()` 为 `false`，后续按键全部投递到已隐藏的旧 guest。
这也是 11 次 renderer 侧 focus 尝试全部失败的原因。

修复分两层：

### 第一层：焦点转移改走主进程 `WebContents.focus()`（根因修复）

- 新增 IPC `webview:focus-contents`（`ipc-handlers.js`）：主进程 `webContents.fromId(id).focus()`
- `switchTab`（`src/renderer.js`）：切换后 DOM focus + 主进程 focus 双管齐下
  （替换原 `setTimeout(..., 1000)` 的无效重试）
- `injectHintMode` 注入后同样补一记主进程 focus

这一层同时修好了更广的问题：快捷键切标签后**所有**键盘输入（表单打字、空格滚动等）
此前都要鼠标点一下才恢复，不只影响 Vim hint。

### 第二层：Hint 按键路由不依赖 guest 焦点（兜底保证）

即使焦点机制未来再出问题，hint 也能用：

- `shortcut-manager.js`：`hintModeActive` 期间，主进程在 `before-input-event` 直接捕获
  无修饰键的单字符/Escape/Backspace，`preventDefault` 后经 `vim:hint-key` 通道转发给
  host renderer；焦点在输入框（地址栏/页面 input）时放行，保持原有输入语义
- `src/renderer.js`：收到 `vim:hint-key` 后 `executeJavaScript` 调用 guest 内新暴露的
  `window.__realmHintKey(key)`，喂给同一个 `handleKeyDown`；`exit()` 时清理该全局

### 验证（playwright _electron 驱动真实 dev 应用）

1. guest A 内取焦点 → `shortcut:triggered nextTab` 切标签 → 新 guest B `document.hasFocus() === true` ✅
2. `vim:triggered hintMode` → overlay 渲染 ✅
3. `vim:hint-key 'a'` → guest 消费按键、触发 click 跳转到目标链接 ✅

注意：Playwright 合成键进不了主进程 `before-input-event`（见 memory），主进程捕获那一腿
只能测到 IPC 接缝（`vim:hint-key` 发送点），捕获逻辑本身靠代码走查保证。

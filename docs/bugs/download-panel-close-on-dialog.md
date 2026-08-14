# Bug: 下载面板在弹窗操作时意外关闭

## 需求描述

### 场景 1：正常关闭面板（已实现）

- 点击面板外部区域（网页空白处、标签栏、工具栏等）→ 面板关闭
- 按 ESC 键 → 面板关闭

### 场景 2：弹窗操作时面板不关闭（未实现）

- 点击面板内的"删除"按钮 → 弹出确认弹窗，面板**保持打开**
- 点击面板内的"清空"按钮 → 弹出确认弹窗，面板**保持打开**
- 在弹窗中点击"确认" → 弹窗关闭，面板**保持打开**并实时刷新列表
- 在弹窗中点击"取消" → 弹窗关闭，面板**保持打开**
- 在弹窗中按 ESC → 弹窗关闭，面板**保持打开**

**核心原则：只要用户在面板上有操作（包括弹出的确认弹窗），面板就不应该消失，让用户能立刻看到操作结果。**

---

## 现状

| 场景 | 状态 | 说明 |
|------|------|------|
| 点击网页空白区域关闭面板 | ✅ 正常 | 通过 webview preload 的 `media:outside-click` 实现 |
| 点击标签栏关闭面板 | ✅ 正常 | 通过 document click 事件实现 |
| ESC 键关闭面板 | ✅ 正常 | 通过 document keydown 事件实现 |
| 删除按钮 → 弹窗弹出 | ❌ 异常 | **点击删除按钮的瞬间，面板在弹窗打开前就被关闭了** |
| 清空按钮 → 弹窗弹出 | ❌ 异常 | 同上 |
| 弹窗确认后面板保持打开并刷新 | ❌ 无法验证 | 因为弹窗弹出时面板已关闭 |

---

## 根因分析

### 事件穿透问题

下载面板（`#downloadPanel`）和 webview（`<webview>` 元素）在 DOM 中是**兄弟节点**，面板通过 z-index 覆盖在 webview 上方。

**问题时序：**

```
1. 用户点击面板内的"删除"按钮
2. mousedown 事件触发
3. 由于某种原因，webview 也收到了 mousedown 事件（事件穿透）
4. webview-preload.js 中的 mousedown 监听器触发
5. preload 通过 ipcRenderer.sendToHost('media:outside-click') 通知 renderer
6. renderer 的 media:outside-click 处理器关闭面板
7. 面板从 DOM 中移除，删除按钮消失
8. click 事件无法触发（目标元素已不存在）
9. 弹窗从未打开
```

**关键点：** mousedown 先于 click 事件触发，而面板在 mousedown 阶段就被关闭了，导致 click 阶段的弹窗打开逻辑无法执行。

### 为什么事件会穿透

可能的原因：
1. `<webview>` 元素的渲染层级与普通 DOM 元素不同，它是一个独立的 guest browsing context
2. 面板虽然 z-index 更高，但 mousedown 事件可能在 webview 的 embedder 层面被触发
3. Electron 的 `<webview>` 实现中，guest 页面的事件监听可能在 embedder 层面也有响应

---

## 文件结构

### 相关文件

| 文件 | 作用 |
|------|------|
| `src/renderer.js` | 渲染进程主逻辑，包含面板打开/关闭、弹窗操作 |
| `src/webview-preload.js` | webview guest 页面的 preload 脚本，发送 `media:outside-click` |
| `src/index.html` | 面板和弹窗的 HTML 结构 |
| `src/styles/main.css` | 面板和弹窗的样式 |

### 关键元素

```html
<!-- 下载面板 -->
<div class="download-panel hidden" id="downloadPanel">
  <!-- 删除按钮（动态渲染） -->
  <!-- 清空按钮 -->
  <button class="download-panel-clear-btn" id="downloadClearBtn">清空所有记录</button>
</div>

<!-- 删除确认弹窗 -->
<dialog class="download-delete-modal" id="downloadDeleteModal">
  ...
</dialog>

<!-- 清空确认弹窗 -->
<dialog class="download-clear-modal" id="downloadClearModal">
  ...
</dialog>

<!-- webview 容器 -->
<div class="browser-view" id="browserView">
  <webview ...></webview>
</div>
```

---

## 已做的修改（按时间顺序）

### 修改 1：暂停时进度条归零（已修复）

**文件：** `download-manager.js`

**问题：** 暂停下载时进度条消失（归零），因为 `pauseDownload` 通知渲染进程时未携带 `percent`。

**修改内容：**
- `pauseDownload()`：暂停通知携带 `percent`，同时写入 `received_bytes` 到数据库
- `resumeDownload()`：恢复通知携带 `percent`
- 中断事件处理：中断通知携带 `percent`
- `getAllDownloads()`：查询结果计算 `progress` 字段（`received_bytes/total_bytes * 100`）

### 修改 2：弹窗居中显示（已修复）

**文件：** `src/styles/main.css`

**问题：** 删除/清空确认弹窗显示在左上角，未居中。

**修改内容：**
- `.download-delete-modal` 添加 `margin: auto;`
- `.download-clear-modal` 添加 `margin: auto;`

### 修改 3：弹窗操作时面板不关闭（未完全修复）

**文件：** `src/renderer.js`

**尝试过的方案：**

#### 方案 A：在 document click 中排除 modal 区域

```js
// 在 document click handler 中
const deleteModal = document.getElementById('downloadDeleteModal');
const clearModal = document.getElementById('downloadClearModal');
const inModal = (deleteModal && deleteModal.contains(e.target)) || (clearModal && clearModal.contains(e.target));
if (panel && !panel.contains(e.target) && !inModal && ...) {
  closeDownloadPanel();
}
```

**结果：** `<dialog>` 的 `showModal()` 将弹窗渲染在 top layer（DOM 树外），`panel.contains(e.target)` 对弹窗内容返回 false。但此方案对场景 1 无效（点击网页区域不关闭面板）。

#### 方案 B：在 browserView 上监听 mousedown

```js
elements.browserView.addEventListener('mousedown', () => {
  if (state.downloadPanelOpen) closeDownloadPanel();
});
```

**结果：** 无效，点击网页区域面板不关闭。因为 webview 是独立 browsing context，mousedown 不会从 webview 内部冒泡到父 DOM。

#### 方案 C：复用 media:outside-click

```js
// 在 webview 的 ipc-message handler 中
} else if (e.channel === 'media:outside-click') {
  if (state.mediaPanelOpen) toggleMediaPanel();
  if (state.downloadPanelOpen) closeDownloadPanel();
}
```

**结果：** 场景 1 正常（点击网页关闭面板），但场景 2 失败（点击删除按钮时面板也关闭了）。因为 webview 的 mousedown 事件在点击面板按钮时也会触发。

#### 方案 D：modal.open 检查（当前方案）

```js
} else if (e.channel === 'media:outside-click') {
  if (state.mediaPanelOpen) toggleMediaPanel();
  const deleteModal = document.getElementById('downloadDeleteModal');
  const clearModal = document.getElementById('downloadClearModal');
  const modalOpen = (deleteModal && deleteModal.open) || (clearModal && clearModal.open);
  if (state.downloadPanelOpen && !modalOpen) closeDownloadPanel();
}
```

**结果：** 无效。问题在于**时序**：mousedown → `media:outside-click` → 面板关闭 → click → 弹窗打开。面板在弹窗打开前就被关闭了，所以检查 `modal.open` 时弹窗还不存在。

#### 方案 E：downloadModalActive 标志（当前方案，仍未生效）

```js
let downloadModalActive = false;

// 删除/清空按钮点击时设为 true
function handleDeleteDownload(...) {
  downloadModalActive = true;
  modal.showModal();
}

// 确认/取消/ESC 时设为 false
// modal close 事件监听也设为 false

// media:outside-click 中检查
if (state.downloadPanelOpen && !downloadModalActive) closeDownloadPanel();
```

**结果：** 仍无效。**原因推测：** mousedown 事件穿透发生在 `handleDeleteDownload` 函数执行**之前**。也就是说：

```
mousedown (穿透到 webview) → media:outside-click → 面板关闭
mousedown (在面板按钮上) → 还没到 click
click (面板已关闭，无法触发) → handleDeleteDownload 从未执行
downloadModalActive 从未被设为 true
```

---

## 根本问题

**事件穿透发生在 mousedown 阶段，早于 click 阶段的业务逻辑执行。**

所有基于"在业务逻辑中设置标志"的方案都无法解决这个问题，因为标志设置的时机晚于面板关闭的时机。

---

## 可能的解决方向

### 方向 1：阻止事件穿透

在面板上阻止 mousedown 事件传播到 webview：

```js
// 在面板的 mousedown 事件中阻止传播
document.getElementById('downloadPanel').addEventListener('mousedown', (e) => {
  e.stopPropagation();
}, true); // 使用捕获阶段
```

**风险：** 可能影响面板内其他交互（如输入框聚焦、按钮点击）。

### 方向 2：延迟关闭面板

在 `media:outside-click` 处理中使用微小延迟，让 click 事件先触发：

```js
} else if (e.channel === 'media:outside-click') {
  if (state.downloadPanelOpen) {
    setTimeout(() => {
      if (!downloadModalActive) closeDownloadPanel();
    }, 50);
  }
}
```

**风险：** 延迟可能导致面板关闭有明显卡顿感。

### 方向 3：在 webview preload 中区分点击目标

修改 `webview-preload.js`，只在点击 webview 内部时发送 `outside-click`，而非每次 mousedown：

```js
window.addEventListener('mousedown', (e) => {
  // 只有当焦点在 webview 内部时才发送
  // （但 preload 无法感知 renderer 的面板状态）
}, true);
```

**难点：** preload 无法知道 renderer 的面板是否打开。

### 方向 4：renderer 主动拦截

在 renderer 中监听所有 webview 的 mousedown，但在处理前检查是否点击了面板：

```js
// 为每个 webview 添加 mousedown 监听
webview.addEventListener('mousedown', () => {
  // 但 webview 的 mousedown 不会冒泡，无法获取点击位置
});
```

**难点：** webview 的 mousedown 事件不携带点击位置信息。

### 方向 5：使用 pointer-events 控制

当面板打开时，禁用 webview 的 pointer-events：

```css
.browser-view.panel-open webview {
  pointer-events: none;
}
```

**优点：** 从根本上阻止事件穿透。
**风险：** 需要确保面板关闭时恢复 pointer-events，可能影响 webview 的正常交互。

---

## 调试建议

1. **在 `media:outside-click` 处理中添加日志**，确认事件触发时机：
   ```js
   } else if (e.channel === 'media:outside-click') {
     console.log('[DEBUG] media:outside-click received, downloadPanelOpen:', state.downloadPanelOpen, 'downloadModalActive:', downloadModalActive);
     ...
   }
   ```

2. **在 `handleDeleteDownload` 入口添加日志**，确认函数是否被执行：
   ```js
   async function handleDeleteDownload(downloadId, filename, isInProgress) {
     console.log('[DEBUG] handleDeleteDownload called, downloadModalActive:', downloadModalActive);
     ...
   }
   ```

3. **在面板的 mousedown 事件中添加日志**，确认事件是否穿透：
   ```js
   document.getElementById('downloadPanel').addEventListener('mousedown', (e) => {
     console.log('[DEBUG] panel mousedown, target:', e.target);
   }, true);
   ```

4. **使用 Chrome DevTools 的 Event Listener Breakpoints**，在 mousedown 事件上断点，观察事件触发顺序。

---

## 当前代码状态

所有修改都在以下文件中，可通过 `git diff` 查看完整变更：

- `download-manager.js` — 暂停进度保留（已完成）
- `src/styles/main.css` — 弹窗居中（已完成）
- `src/renderer.js` — 面板关闭逻辑（未完成，包含多种尝试方案的残留代码）

**建议：** 如果方向 5（pointer-events）可行，可以清理 `src/renderer.js` 中 `media:outside-click` 处理器和 document click 处理器中的 `downloadModalActive` 相关逻辑，统一使用 pointer-events 方案。

---

## 修复记录（2026-08-14，已解决）

后续阶段开发引入回归：① `media:outside-click` 处理器中 downloadPanel 关闭逻辑被删，点网页空白无法关面板；② 全局 `* { margin: 0 }` 重置覆盖 `<dialog>` UA 默认 `margin: auto`，确认弹窗跑左上角；③ document click 处理器未排除 top-layer 弹窗，点确认/取消连面板一起关。

最终方案（方向 2 的变体「延迟裁决」+ 弹窗排除）：

1. **`media:outside-click` 恢复关闭下载面板，用「落点记录」裁决穿透**（`handleDownloadOutsideClick`）：webview 的 mousedown 经跨进程 IPC **异步晚到**，到达时 embedder 的 click 早已派发完，任何「等 click 再裁决」的方案都会失效（这是"点网页关闭"与"点面板按钮不关"长期互斥的根因）。改为在 embedder 侧 capture 阶段记录最近一次 mousedown 落点（`lastEmbedderMousedown`）：真正点网页时 embedder 收不到 mousedown；点面板按钮时（即便穿透到 webview）embedder 的 mousedown 必先落在面板/弹窗内。IPC 到达时回看 300ms 窗口内的记录即可区分。
2. **document click 处理器排除弹窗内点击**：`e.target.closest('dialog')` 命中则不关面板。注意不能用 `dialog[open]`——确认/取消按钮的处理器先执行 `modal.close()`（`open` 属性同步移除），事件冒泡到 document 时 `[open]` 已匹配不上；弹窗关闭后 DOM 结构不变，`closest('dialog')` 依然命中。弹窗确认/取消后面板保持打开，`executeDeleteDownload` / `executeClearAllDownloads` 内 `state.downloadPanelOpen` 为 true 自动刷新列表。
3. **ESC 处理器检查弹窗状态**：`downloadDeleteModal.open || downloadClearModal.open` 时只关弹窗（浏览器原生行为），不关面板。
4. **CSS 补 `margin: auto`**：`.download-delete-modal` / `.download-clear-modal` 显式声明 `margin: auto` 恢复居中（`.modal` 类已有此处理，这两个弹窗未用 `.modal` 类）。

# Bug: 下载面板 Cmd+Click 多选功能不工作

## 需求描述

在下载面板中，用户可以通过 **Cmd+Click**（macOS）或 **Ctrl+Click**（Windows/Linux）多选下载记录：
- Cmd+Click 第一个 item → 选中
- Cmd+Click 第二个 item → 两个都选中
- 底部显示批量操作栏（显示已选数量 + 批量删除按钮）
- 再次 Cmd+Click 已选中的 item → 取消选中

## 现状

| 功能 | 状态 | 说明 |
|------|------|------|
| Cmd+Click 选中单个 item | ❌ 不工作 | 点击后无任何反应，无视觉反馈 |
| 批量操作栏显示 | ❌ 无法验证 | 因为多选不工作 |
| 批量删除 | ❌ 无法验证 | 因为多选不工作 |

## 根因分析

### 已确认的事实

1. **代码确实在运行**：`bindDownloadItemActions` 被调用，`_multiSelectBound` 标志正确设置
2. **`renderDownloadPanelList` 正常工作**：面板显示 10 条记录，操作按钮（暂停/删除等）正常
3. **事件委托 handler 已绑定**：`listEl.addEventListener('click', ...)` 已执行
4. **但 Cmd+Click 时 handler 不触发**：Console 中无任何 `[DEBUG]` 日志输出

### 可能的原因

#### 假设 1：`e.metaKey` 在 Electron 环境中不正确

在 macOS 上，Command 键对应 `e.metaKey`。但在 Electron 的渲染进程中，`e.metaKey` 的行为可能与标准浏览器不同。

**验证方法：** 在 Console 中手动执行：
```js
document.addEventListener('click', (e) => {
  console.log('metaKey:', e.metaKey, 'ctrlKey:', e.ctrlKey, 'target:', e.target.className);
}, true);
```
然后 Cmd+Click 一个 item，看看日志。

#### 假设 2：事件被其他 handler 拦截

面板中可能有其他事件 handler 在 Cmd+Click 之前拦截了事件。例如：
- 面板的 `mousedown` handler
- 面板的 `pointerdown` handler
- CSS `pointer-events: none` 阻止了事件

**验证方法：** 检查 `#downloadPanel` 和 `.download-item` 是否有 `mousedown`/`pointerdown` handler。

#### 假设 3：事件委托的 target 不正确

`e.target.closest('.download-item')` 可能返回 `null`，因为点击的元素不是 `.download-item` 的子元素。

**验证方法：** 在 delegation handler 中添加日志：
```js
listEl.addEventListener('click', (e) => {
  console.log('[DEBUG] click on:', e.target.tagName, e.target.className, 'metaKey:', e.metaKey);
  // ...
});
```

#### 假设 4：Electron webview 拦截了键盘事件

下载面板在主窗口的 DOM 中，但 webview 可能拦截了 Command 键的事件。当用户按住 Cmd 时，webview 可能捕获了键盘事件，导致 click 事件的 `metaKey` 属性为 `false`。

**验证方法：** 在没有 webview 的情况下测试（关闭所有 Tab）。

#### 假设 5：CSS `user-select` 或 `pointer-events` 干扰

某些 CSS 属性可能阻止了事件的正常触发。

**验证方法：** 检查 `.download-item` 及其子元素的 CSS 属性。

## 相关代码

### 文件位置

| 文件 | 作用 |
|------|------|
| `src/renderer.js` | 多选逻辑（`bindDownloadItemActions`、`toggleDownloadSelection`） |
| `src/styles/main.css` | `.download-item.selected` 样式 |

### 关键代码段

#### 事件委托 handler（`src/renderer.js` 约第 8003 行）

```js
// Cmd+Click 多选（点击 item 非按钮区域，事件委托，仅绑定一次）
if (!listEl._multiSelectBound) {
  listEl._multiSelectBound = true;
  listEl.addEventListener('click', (e) => {
    console.log('[DEBUG] listEl click, metaKey:', e.metaKey, 'ctrlKey:', e.ctrlKey, 'target:', e.target.className);
    if (!e.metaKey && !e.ctrlKey) return;
    const item = e.target.closest('.download-item');
    if (!item || !listEl.contains(item)) return;
    e.preventDefault();
    e.stopPropagation();
    console.log('[DEBUG] toggleDownloadSelection:', item.dataset.id);
    toggleDownloadSelection(item.dataset.id);
  });
}
```

#### Action 按钮 handler（`src/renderer.js` 约第 7940 行）

```js
function handleMultiSelect(e, btn) {
  console.log('[DEBUG] handleMultiSelect, metaKey:', e.metaKey, 'ctrlKey:', e.ctrlKey);
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    e.stopPropagation();
    const item = btn.closest('.download-item');
    if (item) {
      console.log('[DEBUG] toggleDownloadSelection:', item.dataset.id);
      toggleDownloadSelection(item.dataset.id);
    }
    return true;
  }
  return false;
}
```

#### toggleDownloadSelection 函数（`src/renderer.js` 约第 8284 行）

```js
function toggleDownloadSelection(downloadId) {
  if (downloadSelectedIds.has(downloadId)) {
    downloadSelectedIds.delete(downloadId);
  } else {
    downloadSelectedIds.add(downloadId);
  }

  // 更新选中样式
  const item = document.querySelector(`.download-item[data-id="${downloadId}"]`);
  if (item) {
    item.classList.toggle('selected', downloadSelectedIds.has(downloadId));
  }

  // 更新批量操作栏
  updateBatchBar();
}
```

#### 批量操作栏显示逻辑（`src/renderer.js` 约第 8315 行）

```js
function updateBatchBar() {
  const bar = document.getElementById('downloadBatchBar');
  const count = document.getElementById('downloadBatchCount');
  if (!bar || !count) return;

  if (downloadSelectedIds.size >= 2) {
    bar.classList.remove('hidden');
    count.textContent = `已选择 ${downloadSelectedIds.size} 项`;
  } else {
    bar.classList.add('hidden');
  }
}
```

#### CSS 选中样式（`src/styles/main.css` 约第 6628 行）

```css
.download-item.selected {
  background: var(--bg-hover);
}
```

**注意：** `--bg-hover` 与 hover 状态颜色相同（`#404040`），视觉上难以区分选中和 hover 状态。

## 已尝试的方案

### 方案 1：直接在 item 上绑定 click handler

```js
listEl.querySelectorAll('.download-item').forEach(item => {
  item.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleDownloadSelection(item.dataset.id);
    }
  });
});
```

**结果：** 不工作。action 按钮的 `e.stopPropagation()` 阻止了事件冒泡到 item。

### 方案 2：事件委托 on listEl

```js
listEl.addEventListener('click', (e) => {
  if (!e.metaKey && !e.ctrlKey) return;
  const item = e.target.closest('.download-item');
  if (!item) return;
  toggleDownloadSelection(item.dataset.id);
});
```

**结果：** 不工作。handler 已绑定但不触发。

### 方案 3：在每个 action 按钮中处理 Cmd+Click

```js
function handleMultiSelect(e, btn) {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    e.stopPropagation();
    const item = btn.closest('.download-item');
    if (item) toggleDownloadSelection(item.dataset.id);
    return true;
  }
  return false;
}

// 在每个按钮 handler 开头调用
btn.addEventListener('click', (e) => {
  if (handleMultiSelect(e, btn)) return;
  // 正常逻辑...
});
```

**结果：** 不工作。handler 已绑定但 Cmd+Click 时不触发。

## 调试建议

### 步骤 1：验证 `e.metaKey` 是否正确

在 Console 中执行：
```js
document.getElementById('downloadPanelList').addEventListener('click', (e) => {
  console.log('CLICK - metaKey:', e.metaKey, 'ctrlKey:', e.ctrlKey, 'shiftKey:', e.shiftKey, 'target:', e.target.tagName, e.target.className);
});
```
然后 Cmd+Click 一个 item。如果日志显示 `metaKey: false`，说明 Electron 环境中 `metaKey` 不正确。

### 步骤 2：检查是否有 mousedown handler 拦截

在 Console 中执行：
```js
document.getElementById('downloadPanelList').addEventListener('mousedown', (e) => {
  console.log('MOUSEDOWN - metaKey:', e.metaKey, 'target:', e.target.tagName, e.target.className);
});
```
然后 Cmd+Click 一个 item。看看 mousedown 事件是否正常触发。

### 步骤 3：检查 CSS 属性

在开发者工具中选中一个 `.download-item` 元素，检查：
- `pointer-events` 是否为 `none`
- `user-select` 是否为 `none`
- 是否有 `z-index` 或 `position` 导致元素不可点击

### 步骤 4：检查事件监听器

在开发者工具中选中 `#downloadPanelList` 元素，查看 "Event Listeners" 面板，确认 click handler 是否已绑定。

### 步骤 5：在无 webview 环境中测试

关闭所有 Tab（使 webview 不存在），然后测试 Cmd+Click。如果此时可以工作，说明 webview 拦截了键盘事件。

## 当前代码状态

所有修改都在 `src/renderer.js` 中，可通过 `git diff` 查看完整变更。调试日志（`console.log('[DEBUG]...')）已添加，修复后应移除。

---

## 修复记录（2026-08-14，已解决）

**实测结论：多选功能本身从未坏过。** 用 Playwright `_electron` 启动真实 dev 应用实测：Cmd+Click 事件正常到达 item handler，`e.metaKey === true`，选中/取消/批量栏全部工作。本文档"handler 不触发""metaKey 不正确"的假设均不成立。

**真正的问题是视觉反馈不可见**，导致用户（和排查者）以为点击没反应：

1. `.download-item.selected` 背景色 `var(--bg-hover)` 与 hover 态完全相同（#404040）→ 选中无视觉差异。已改为 accent 蓝色调（`rgba(59,130,246,0.15)`，hover 时 0.22）。
2. 批量操作栏原需选中 ≥2 项才显示 → 首次 Cmd+Click 后界面毫无变化。已改为 ≥1 项即显示（"已选择 1 项"），首次选择即有明确反馈。

**教训**：排查"无反应"类问题先区分「逻辑没执行」与「执行了但看不见」，优先验证可观察的状态变化（DOM class、计数器），不要仅凭视觉下结论。

**补充（同日第二轮）**：用户反馈期望批量管理在 realm://downloads 页面，且面板批量栏的删除按钮（纯图标）难以发现。两处改进：

1. **面板批量栏文字化**（`index.html`）：纯图标按钮 → `btn-danger`「删除」+ `btn-secondary`「取消选择」文字按钮，清理对应死 CSS。
2. **downloads 页面批量管理**（`downloads.html` / `downloads-page.js` / `main.css`）：对齐历史页模式——item 加 checkbox，勾选显示批量操作栏（已选数量 + 删除选中项 + 取消选择），复用删除确认弹窗批量删除；`apiAction` 加 `refresh` 参数避免批量删除时逐条刷新。单条删除后同步从选中集移除，避免计数残留。

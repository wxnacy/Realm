# 启动时恢复标签页设置 — 实现方案

> 生成日期：2026-07-27
> 目标：在设置中新增"应用启动时是否恢复标签页"选项（不恢复 / 恢复 / 每次询问），默认"每次询问"，并在启动时按配置决定是否恢复上次会话的标签页

---

## 1. 需求

设置中新增"应用启动时是否恢复标签页"三选项：**不恢复 / 恢复 / 每次询问**（默认"每次询问"）。

当设置为"每次询问"且启动时存在已保存标签时，弹出对话框：

- 左侧："记住我的选择"勾选框
- 右侧："不恢复" / "恢复"两个按钮
- 勾选后点按钮即将设置永久改为对应选项
- Esc / 点 backdrop 等同"不恢复"，但**不**写设置

## 2. 用户已确认的决策

| 决策点 | 选择 |
|---|---|
| 按钮文案 | **不恢复 / 恢复** |
| Esc / backdrop 行为 | **等同不恢复**（不写设置，下次仍询问） |
| 设置分组位置 | **最底部新增"启动"分组** |

## 3. 存储设计

复用 electron-store `realm-config.json` 的 `settings.*` 命名空间：

- key：`settings.restoreTabsOnLaunch`
- 值：`'never' | 'always' | 'ask'`
- 默认：`'ask'`

## 4. 改动清单

| # | 文件 | 改动 |
|---|---|---|
| 1 | `main.js` | `handleSettingsApi` 的 `get` 路由默认值对象（main.js:510-514）加 `restoreTabsOnLaunch: 'ask'` |
| 2 | `ipc-handlers.js` | 新增两个 handler：`settings:get`（返回 `configStore.get('settings', {...})`）、`settings:set`（参数 `{key, value}`，写 `configStore.set('settings.'+key, value)`） |
| 3 | `src/preload.js` | 暴露 `getSettings()` 与 `setSetting(key, value)` |
| 4 | `src/settings.html` | 最底部新增 `启动` 分组 + `<select id="restoreTabsOnLaunch">`（三个 option，value 分别 `never`/`always`/`ask`） |
| 5 | `src/settings-page.js` | ① `state.settings` 加 `restoreTabsOnLaunch: 'ask'`<br>② `elements` 加引用<br>③ `loadSettings()` 中 `elements.restoreTabsOnLaunch.value = state.settings.restoreTabsOnLaunch \|\| 'ask'`<br>④ `setupEventListeners()` 加 change 监听调 `saveSettings('restoreTabsOnLaunch', value)` |
| 6 | `src/index.html` | `deleteConfirmModal` 之后新增 `<dialog id="restoreTabsModal">`（结构见 §5.1） |
| 7 | `src/styles/main.css` | 新增 `.restore-tabs-footer` 样式：flex，`justify-content: space-between`，左 checkbox 右按钮组 |
| 8 | `src/renderer.js` | ① `restoreTabs()` 顶部（renderer.js:1432 `tabs.length===0` 早退之后）按设置分支<br>② 新增 `showRestoreTabsDialog(tabCount)` 返回 `Promise<{action, remember}>`<br>③ `elements` 集中区加 modal/checkbox/按钮引用 |

## 5. 关键代码骨架

### 5.1 index.html 新 dialog（放 deleteConfirmModal 之后）

```html
<dialog class="modal" id="restoreTabsModal">
  <div class="modal-content">
    <h2>恢复上次的标签页？</h2>
    <div class="delete-confirm-content">
      <p>上次退出时有 <strong id="restoreTabsCount">0</strong> 个标签页未关闭。</p>
    </div>
    <div class="restore-tabs-footer">
      <label class="restore-tabs-remember">
        <input type="checkbox" id="restoreTabsRemember">
        <span>记住我的选择</span>
      </label>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="restoreTabsNoBtn">不恢复</button>
        <button type="button" class="btn btn-primary" id="restoreTabsYesBtn">恢复</button>
      </div>
    </div>
  </div>
</dialog>
```

### 5.2 main.css 新样式

```css
.restore-tabs-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
}
.restore-tabs-remember {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.restore-tabs-footer .form-actions {
  margin-top: 0;  /* 覆盖默认 form-actions 的上边距 */
}
```

### 5.3 renderer.js 新增 showRestoreTabsDialog

```js
/**
 * 弹出"恢复标签页"询问对话框
 * @param {number} tabCount - 待恢复的 tab 数量
 * @returns {Promise<{action: 'restore'|'fresh', remember: boolean}>}
 */
function showRestoreTabsDialog(tabCount) {
  return new Promise((resolve) => {
    elements.restoreTabsCount.textContent = String(tabCount);
    elements.restoreTabsRemember.checked = false;

    const cleanup = () => {
      elements.restoreTabsYesBtn.removeEventListener('click', onYes);
      elements.restoreTabsNoBtn.removeEventListener('click', onNo);
      elements.restoreTabsModal.removeEventListener('cancel', onCancel);
      elements.restoreTabsModal.removeEventListener('click', onBackdrop);
    };
    const finish = (action) => {
      const remember = elements.restoreTabsRemember.checked;
      cleanup();
      elements.restoreTabsModal.close();
      resolve({ action, remember });
    };
    const onYes = () => finish('restore');
    const onNo = () => finish('fresh');
    const onCancel = (e) => { e.preventDefault(); finish('fresh'); };  // Esc
    const onBackdrop = (e) => { if (e.target === elements.restoreTabsModal) finish('fresh'); };

    elements.restoreTabsYesBtn.addEventListener('click', onYes);
    elements.restoreTabsNoBtn.addEventListener('click', onNo);
    elements.restoreTabsModal.addEventListener('cancel', onCancel);
    elements.restoreTabsModal.addEventListener('click', onBackdrop);

    elements.restoreTabsModal.showModal();
  });
}
```

### 5.4 renderer.js restoreTabs() 顶部分支

在现有 `if (tabs.length === 0) { createTab(...); return; }` 之后插入：

```js
// 按设置决定是否恢复
const settings = await window.realmAPI.getSettings();
const behavior = settings.restoreTabsOnLaunch || 'ask';

let shouldRestore = behavior === 'always';
if (behavior === 'ask') {
  const { action, remember } = await showRestoreTabsDialog(tabs.length);
  shouldRestore = action === 'restore';
  if (remember) {
    // 永久更改设置：恢复 → 'always'，不恢复 → 'never'
    await window.realmAPI.setSetting(
      'restoreTabsOnLaunch',
      shouldRestore ? 'always' : 'never'
    );
  }
}

if (!shouldRestore) {
  createTab(state.currentContainer);
  return;
}
// 否则落入下方原有恢复循环
```

### 5.5 settings.html 新分组（最底部）

```html
<!-- 启动设置 -->
<div class="settings-group">
  <h3 class="settings-group-title">启动</h3>
  <div class="settings-item">
    <label for="restoreTabsOnLaunch">启动时恢复上次的标签页</label>
    <select class="settings-select" id="restoreTabsOnLaunch">
      <option value="ask">每次询问</option>
      <option value="always">恢复</option>
      <option value="never">不恢复</option>
    </select>
  </div>
</div>
```

### 5.6 ipc-handlers.js + preload.js

```js
// ipc-handlers.js
ipcMain.handle('settings:get', () => {
  return configStore.get('settings', {
    historyRetentionDays: 30,
    defaultContainer: 'last-used',
    isDefaultBrowser: false,
    restoreTabsOnLaunch: 'ask',
  });
});

ipcMain.handle('settings:set', (event, key, value) => {
  configStore.set(`settings.${key}`, value);
  return { success: true };
});

// preload.js
getSettings: () => ipcRenderer.invoke('settings:get'),
setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
```

## 6. 关键设计点

1. **三选一只出现在设置页**，启动询问对话框永远只有"不恢复 / 恢复"两按钮 + 一个记住勾选框。勾选后写设置时直接落到 `'always' / 'never'`，不会写回 `'ask'`（否则等于没记住）。
2. **ipc-handlers 的 `settings:get` 默认值与 main.js `get` 路由保持同步**。两处 hardcode 同一份默认值，改一处时必须改另一处。
3. **Esc / backdrop 不写设置**：只有用户主动点按钮且勾选 checkbox 才永久写入。
4. **`tabs.length === 0` 早退不变**：没有保存的 tab 时不弹询问，直接 `createTab`。
5. **设置页无需新 IPC**：复用 `/api/settings/update`（main.js:521-523 的 for 循环已支持任意 key）。
6. **"不恢复"必须清空主进程 tab-store**：`tab-manager.initTabs` 在 `app.whenReady` 时把磁盘 tabs 加载到内存 Map，渲染进程选"不恢复"只影响自己是否创建 webview，**主进程内存里的旧 tabs 仍在**。后续新建 tab 走 `createTab → saveTabs` 会把旧 + 新一起写回磁盘，下次启动旧会话复活。修复：新增 `tab:clear-all` IPC，渲染进程在 `!shouldRestore` 分支先 `clearAllTabs()` 再 `createTab`。

## 7. 验证清单

- [ ] 默认设置 `ask` + 启动时有保存 tab → 弹询问对话框，显示 tab 数量
- [ ] 询问框点"恢复"未勾选 → 恢复 tab，下次启动仍询问
- [ ] 询问框点"恢复"勾选 → 恢复 tab，设置页 select 变为"恢复"，下次启动直接恢复不弹框
- [ ] 询问框点"不恢复"勾选 → 新开空白 tab，设置页 select 变为"不恢复"，下次启动直接新开不弹框
- [ ] Esc / 点 backdrop → 等同"不恢复"，但设置保持 `'ask'`
- [ ] 设置为 `always` → 启动直接恢复，不弹框
- [ ] 设置为 `never` → 启动直接新开空白 tab，不弹框；**主进程已加载的旧 tabs 被清空**（否则后续新建 tab 会与旧会话叠加，下次启动旧 tab 复活）
- [ ] 没有保存 tab（首次运行）→ 不弹框，直接 `createTab`
- [ ] 选"不恢复"后新建 D E 两个 tab → 退出再启动（设为 `always`）→ 只恢复 D E，**不**含本次之前的 A B C

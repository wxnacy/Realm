# 多窗口下关闭标签误关整个窗口排查实录（三条成因链）

> 2026-09-03 · Realm Browser · 影响文件：`ipc-handlers.js` / `main.js` / `shortcut-manager.js` / `window-manager.js` / `drag-coordinator.js` / `src/renderer.js`

## 现象

开多个窗口，某一个窗口中有多个标签时，关闭**一个**标签有概率把**整个窗口**关掉（窗口内
其他标签、乃至正在显示的页面一并消失）。

**特征**：

- 间歇性，不是必现；
- 只在多窗口场景出现，单窗口从未复现；
- 键盘（Cmd+W）和鼠标点击标签关闭按钮**两条路径都会触发**。

---

## ✅ 结论（2026-09-03 修复）

这不是单一 bug，而是**三条独立成因链**，都汇聚到同一个判定点：
`tab:close` IPC 处理器（`ipc-handlers.js:376`）

```js
if (result.lastInWindow && windowManager.getWindowCount() > 1) {
  // 销毁发送窗口（含其全部 Tab）
}
```

`lastInWindow` 在 `tab-manager.js closeTab` 中按**主进程元数据** `tab.windowId` 分组计算：
被关 Tab 删除后，若主进程 `tabs` Map 里再无同 `windowId` 的 Tab，即视为"窗口最后一个标签"。
**判定完全依赖元数据，与窗口 UI 上实际显示了几个标签无关**——元数据一旦与渲染进程 UI 分裂，
UI 上看得见的标签就不参与计算，误判随之发生。三条成因链都是在制造这种分裂。

### 成因链 1：restoreTabs"不恢复"全局清空，抹掉其他活窗口的元数据（鼠标路径主因）

关闭按钮路径：renderer `closeTab` → IPC `tab:close` → 主进程按 `lastInWindow` 判定。
窗口被误关需要主进程认为该窗口只剩这一个 Tab，而 UI 上明明有多个——即**元数据被误删**。

1. 每个窗口的 renderer 初始化都会跑 `restoreTabs()`（`src/renderer.js`），
   其中"不恢复"分支调用 `window.realmAPI.clearAllTabs()`；
2. `tab:clear-all` IPC 原实现调用 `tabManager.clearAllTabs()`——**清空的是全局 tabs Map，
   包括其他活窗口正在显示的 Tab 的元数据**（该 IPC 原设计只考虑了"启动时单窗口丢弃旧会话"）;
3. 元数据被抹掉后，窗口 A 的 UI 还显示 t1、t2。用户关 t1 → 主进程 `tabs.has(t1)` 为 false，
   返回 `{success:false}` → renderer 无条件移除 UI 并走兜底 `createTab` 造出 t_fresh(windowId=A)；
4. 用户再关 t_fresh → 主进程分组 A 里只有它 → **`lastInWindow=true`** → 多窗口成立 →
   **窗口 A 被销毁，而 UI 上 t2 还在**。

元数据被清空需要"次级窗口的 restoreTabs 看到非空列表"，触发源有两个：

- **拖出新窗口**（`drag-coordinator.js` endDrag new-window 路径，修复前）：主进程在
  `createMainWindow` 后**立即**预建搬移 Tab，新窗口 renderer 加载后 `getTabs()` 返回这 1 个
  Tab → 弹"是否恢复上次会话"对话框（很违感）→ 用户点"不恢复"即引爆；设置若是 `never`
  则无条件直接引爆；
- **在新窗口打开**（`tab:open-in-new-window`）：只等 `did-finish-load`，与 renderer 异步
  `restoreTabs` 存在微弱交错窗口。

### 成因链 2：Cmd+W 双重绑定竞态（键盘路径主因）

- `shortcut-manager.js`：`'closeTab': 'CmdOrCtrl+W'`，before-input-event 拦截后
  `preventDefault` → 关闭当前标签；
- `main.js` 窗口菜单曾有 `{ role: 'close' }`——Electron 默认 accelerator 恰好也是
  **CmdOrCtrl+W**（菜单里显示为 "Close Window ⌘W"）。

before-input-event 命中时的 `preventDefault` 会同时挡住应用菜单同键 accelerator，但原代码在
`BrowserWindow.getFocusedWindow()` 为 null 时**直接 return 不拦截**（`shortcut-manager.js`
原 :363-364）。多窗口间切换焦点、窗口关闭动画的瞬间 `getFocusedWindow()` 会短暂返回 null，
此时 Cmd+W 漏进菜单 → `role: 'close'` → 整个聚焦窗口连同所有标签被关。

这解释了间歇性和"多窗口才出现"：单窗口几乎没有焦点切换的 null 瞬间。

### 成因链 3：次级窗口未挂关闭处理器 → 幽灵 Tab（放大器）

`setupWindowCloseHandler`（D-15 活跃任务确认 / D-16 级联关闭 Tab）修复前只挂在启动主窗口和
`activate` 重建的窗口上。Cmd+N、菜单/Dock 新建、拖出新窗口、`tab:open-in-new-window` 创建的
次级窗口**都没有**——点红按钮/Cmd+Shift+W 关闭时窗口直接销毁，**不级联清理 tabManager
元数据**，留下 `windowId` 指向死窗口的幽灵 Tab。幽灵 Tab 会在下次启动时被
`migrateWindowlessTabs` 收编"复活"，也是各种 UI/元数据错位的持续供给源。

---

## 排查过程

### 第一轮：键盘路径（Cmd+W）定位

1. 通读 `tab-manager.js closeTab`：`lastInWindow` 按元数据分组计算，逻辑本身自洽；
2. 通读 `ipc-handlers.js tab:close`：销毁的是 `BrowserWindow.fromWebContents(event.sender)`
   （真实发送窗口），但 `lastInWindow` 用的是**被关 Tab 存储的 windowId**——两者可能不一致；
3. 检查所有 `createTab`/`updateTab({windowId})` 调用点的 windowId 传递：`tab:create`
   （win.id）、`tab:open-in-new-window`（newWindow.id）、拖拽 move-to-window（parseInt 校验）
   均正确，创建期元数据一致性没有破绽；
4. 转向键盘路径：发现菜单 `{ role: 'close' }` 默认 accelerator 与 `closeTab` 的 Cmd+W 双重
   绑定，且 `shortcut-manager.js` 在 `getFocusedWindow()` 为 null 时裸 return 不拦截——
   竞态窗口成立。

### 第二轮：用户反馈鼠标路径同样触发 → 推翻"仅快捷键"结论

点击关闭按钮不走键盘链路，必是元数据分裂。重新沿"UI 有多个标签、元数据只剩一个"反向追：

1. 复查 renderer 所有建 Tab 入口（`createTab`/`restoreTabs`/`handleTabCreatedFromMain`）：
   都是"先主进程元数据后 UI"，无乐观 UI，正常情况下不分裂；
2. 唯一的全局删除入口：`clearAllTabs`。追它的调用方——只有 `tab:clear-all` ←
   renderer `restoreTabs` 的"不恢复"分支。而 `restoreTabs` 跑在**每个窗口**的初始化里；
3. 关键问题变成"次级窗口的 `restoreTabs` 何时会看到非空列表"：
   - 拖出新窗口路径主进程**先预建 Tab 再等窗口加载** → 新窗口的 `getTabs()` 非空 →
     "不恢复"即全局清空 → 因果链闭合；
4. 逐步推演清空后的关闭序列（关幽灵 Tab → success:false → 兜底 createTab → 关新 Tab →
   lastInWindow 误判）复现出完整症状，且与"有概率、多窗口才出现"完全吻合。

### 第三轮：顺带排查出的结构性隐患

- `setupWindowCloseHandler` 挂载点不全（成因链 3）；
- `tab:get-active` 不按窗口过滤：无参 `getActiveTab()` 返回 `activeTabs` Map 第一条，
  多窗口下可能是别的窗口的活动 Tab；
- 拖拽 move-to-window 只 `updateTab({ windowId })`，不更新 `activeTabs` 映射
  （**未修复**，影响：主/渲染进程活动 Tab 状态可能短暂分裂，未见直接危害）。

---

## 修复内容（2026-09-03，四项）

| # | 修复 | 位置 | 覆盖路径 |
|---|------|------|---------|
| 1 | `tab:clear-all` 改为 `closeTabsByWindowId(sender)`，只清发送窗口自己的 Tab（启动时全部 Tab 已迁移到主窗口，按窗口清空等价于原全局清空，持久化卫生不回退）；`tab:get-active` 按发送窗口 windowId 过滤 | `ipc-handlers.js:418` / `:399` | 鼠标（根治） |
| 2 | 删除窗口菜单 `{ role: 'close' }`（其默认 Cmd+W 与 closeTab 冲突，留注释防回归）；before-input-event 命中快捷键后**无条件** `preventDefault`，`getFocusedWindow()` 为 null 时用 `BrowserWindow.fromWebContents(contents)` 反推宿主窗口兜底 | `main.js` 窗口菜单 / `shortcut-manager.js:365` | 键盘 |
| 3 | windowManager 新增 `setWindowCloseSetup` 注入钩子，`createMainWindow` 内部统一挂载关闭处理器；main.js 注册钩子并移除两处冗余显式调用 | `window-manager.js:197` / `main.js:3201` | 幽灵 Tab |
| 4 | 拖出新窗口路径对齐 `tab:open-in-new-window` 时序：等 `did-finish-load` → 关闭 restoreTabs 默认空白 Tab → 再创建搬移 Tab，新窗口不再把预建 Tab 误判为"上次会话" | `drag-coordinator.js:254` | 触发源 |

---

## 🎯 关键点（复发时先看这里）

- **"关标签关掉整个窗口"必经 `ipc-handlers.js:376` 的 `lastInWindow && getWindowCount() > 1`
  判定**。该判定只看主进程元数据 `tab.windowId` 分组，与 UI 无关——出现误关先怀疑元数据
  与渲染进程 UI 分裂，而不是关闭逻辑本身。
- **日志签名可秒判路径**（主进程终端）：
  - 正常关标签：`[Realm] Tab 关闭: tab-N`；
  - 走菜单/关闭处理器销毁窗口：`[Realm] 窗口 N 已关闭（含所有 Tab）`，且窗口关闭前**没有**
    对应最后一个 Tab 的 `Tab 关闭` 日志 → 键盘漏进菜单路径；
  - 元数据分裂路径：出现 `Tab 关闭` 成功但同窗口 UI 明明还有别的标签，或此前有
    `tab:clear-all` 触发（多窗口时）。
- **全局性数据操作（clear/clearAll 类 IPC）必须想清楚作用域**：为"启动单窗口"设计的全局
  清空，被次级窗口复用后就是跨窗口数据销毁。新加 IPC 先问"多窗口下每个窗口都会调它吗"。
- **应用菜单 accelerator 与 before-input-event 共存时**：命中快捷键必须无条件
  `preventDefault`，任何 early-return 路径漏拦的按键都会掉进菜单同键 accelerator。
  加新菜单项时检查其默认 accelerator 是否与 `DEFAULT_SHORTCUTS` 冲突。
- **所有窗口统一在 `createMainWindow` 内挂关闭处理器**（经 `setWindowCloseSetup` 注入），
  不要在调用点逐个挂——新加窗口出口天然继承，避免再出现"某出口忘了挂"。
- **Electron 窗口 ID 仅跨会话复用，会话内递增不复用**：跨会话的幽灵 Tab 靠
  `migrateWindowlessTabs` 启动收编；会话内死窗口的幽灵 Tab 只能靠关闭级联防。

## 验证方法

手动回归（`npm run dev`，开两个窗口各放几个标签）：

1. 拖 A 窗口标签到 B 窗口 / 拖出创建新窗口 → 不应弹"恢复上次会话"对话框；
2. 次级窗口若出现"不恢复"选择，选它 → 其他窗口的标签不受影响；
3. 多窗口间快速切换焦点时按 Cmd+W → 只关标签不关窗口；
4. 点标签 X 关闭 → 同上；
5. 次级窗口点红按钮关闭 → 重启后已关窗口的标签不"复活"；
6. 播放器窗口聚焦时按 Cmd+W → 仍关闭播放器窗口（D-13 语义保持）；
7. Cmd+N / Cmd+Shift+W → 正常新建/关闭窗口（preventDefault 前移后菜单同键项仍被正确屏蔽）。

## 残留风险（低）

- `tab:open-in-new-window` 与拖出路径在 `did-finish-load` 后仍可能与 renderer 异步
  `restoreTabs` 微弱交错，最坏结果是新窗口多一个空白 Tab 或弹一次确认框——因修复 1 的
  作用域收窄，不再有跨窗口数据损失；
- 拖拽 move-to-window 不更新 `activeTabs` 映射（见排查过程第三轮），待观察是否需要修。

## 相关文件

- `ipc-handlers.js:376`：`tab:close` 的 lastInWindow 判定与窗口销毁（误关判定点，未改）
- `ipc-handlers.js:418`：`tab:clear-all` 按窗口清空（修复 1）
- `ipc-handlers.js:399`：`tab:get-active` 按窗口过滤（修复 1）
- `shortcut-manager.js:365`：命中快捷键无条件 preventDefault + fromWebContents 兜底（修复 2）
- `main.js` 窗口菜单：删除 `{ role: 'close' }`（修复 2）
- `window-manager.js:197` / `main.js:3201`：关闭处理器统一挂载（修复 3）
- `drag-coordinator.js:254`：拖出新窗口时序（修复 4）
- `src/renderer.js` `restoreTabs`：全局清空调用方（语义注释已更新）

# webview 鼠标命中残留：网页点不动、刷新无效、只能重启

> **状态：已修复（2026-09-15，`hotfix/webview-hit-test-stuck`）**
> 影响文件：`src/renderer.js`（真源收敛 + 兜底恢复）、`main.js`（guest 观测）
> 验证：`tests/uat-webview-hit-test-stuck.js`（30 项，实跑全绿 + 三条单点变异各自精准打红）

## 1. 现象（用户报告）

- 页面长时间运行后，鼠标点网页内的输入框无反应、链接也点不动；**宿主 UI（地址栏、工具栏）一切正常**
- **刷新页面无效**，只有重启才恢复；非必现
- 关键旁证（用户自述）：**Vim 的 `f`（hint 模式）仍能聚焦输入框**

## 2. 判据：这条旁证把范围锁死在「宿主 → guest 的鼠标命中」这一层

hint 模式的链路是：

```
主进程 before-input-event 捕获按键 → IPC → renderer executeJavaScript 注入 guest
→ overlay 渲染 → 按 hint 字母 → guest 内元素 .click() → 输入框获得焦点
```

**全程不经过浏览器命中测试**。所以旁证成立就意味着：

| 被证实 | 被排除 |
|---|---|
| guest 进程活着、脚本能跑、DOM/焦点可编程操作 | guest 渲染进程卡死或崩溃（那种情况下 `executeJavaScript` 注入会一并失效，hint 根本出不出现） |
| 真实鼠标事件到不了 guest | vim 状态残留吞键（那只吞**键盘**，且焦点进入输入框后主进程会放行，与本现象不符） |

后者尤其要点明：08-27 那次（`vim-mode-input-field-bug.md`）修的是**键盘**侧的上报竞态，与本现象不是同一层，所以那次修复不会、也确实没有解决本问题。

**「刷新页面无效」是这一层的专属签名**：被改的是**宿主** webview 元素的内联样式，与页面 DOM 无关，`reload()` 不可能清掉它。

## 3. 病灶

### 3.1 两处「置 none 后只靠各自 mouseup 恢复」

拖拽/改宽期间必须把 webview 的 `pointer-events` 置 `none`（否则鼠标经过网页区会被 guest 吞掉、`mousemove` 断流、浮动预览卡在页面上），但这个状态**不改变可见性**——页面照常渲染，只是再也点不到。而恢复只挂在各自的 `mouseup` 上：

| 触发 | 置 `none` | 恢复 |
|---|---|---|
| 拖标签激活跨窗口拖拽 | `onCrossDragMouseMove` | `restoreWebviewPointerEvents()`（仅 `mouseup` / Escape） |
| 拖 AI 面板宽度 | `initAIPanelResize.onMouseDown` | `onMouseUp`（仅 `mouseup`，且恢复成 `''` = auto） |

`mouseup` 一旦丢失（窗口外松手、拖拽中途窗口失焦、面板被关闭、事件丢失），网页区就**永久**失去鼠标命中。

**为什么用户会觉得是「长时间没动之后才出现」**：这个卡死状态是**静默的**——不去点网页完全看不出来。触发点可能远早于发现时刻，这也解释了为什么用户回忆不起做过什么操作。

### 3.2 第二入口：可命中性有两套真源

`restoreWebviewPointerEvents` 自己按 `state.activeTabId` 写 `pointer-events`，而可见性由 `showWebview(tabId)` 按参数写。两者不一致时（`activeTabId` ≠ 屏幕上的那个），恢复动作会把**可见页面**打成不可命中，而把不可见的那个设成可交互。同症状、不同成因。

（本次实测：`navigateCurrentTab` 的 `showWebview(tabId)` 是可以传非活动 tab 的签名，但当前两处调用点都传 `state.activeTabId`，**今天不可达**；本次不改其行为，风险改由「可见性真源」消解——即便将来发生，可见页面仍是可命中的。）

## 4. 修复（`src/renderer.js`）

1. **单一真源**：`state.visibleTabId`（由 `showWebview` 写入；不再拿 `activeTabId` 猜）＋ `applyWebviewInteractivity()` 作为可见性与可命中性**唯一写入点**，`showWebview` 与拖拽/改宽收尾共用。
2. **成对入口**：`suspendWebviewHitTest(reason)` / `resumeWebviewHitTest(source)`，恢复**幂等**（未 suspend 时是 no-op，不会覆盖 `showWebview` 的结果）。
3. **兜底网**（`initWebviewHitTestSafetyNet`）：不再依赖各拖拽路径自己的收尾
   - `mousemove` 的 `e.buttons === 0` —— 指针在动却没有按键，是「收尾已丢失」的第一现场权威信号
   - `window blur` / `visibilitychange` —— 窗口失焦或不可见时按键不可能仍按着，证据作废并尝试恢复
   - **3s 看门狗**：复查间隔 `WEBVIEW_SUSPEND_WATCHDOG_MS=3000`，按键证据有效期 `WEBVIEW_SUSPEND_EVIDENCE_MS=1000`。**两者必须不等**——相等时看门狗每次复查都会判「证据还没过期」而无限重排，残留永远救不回来
4. **残留日志**（正常收尾**静默**，因此正常使用零新增输出，一旦打印即一眼定位）：
   ```
   [Realm] webview 可命中性残留已恢复（兜底=watchdog|mousemove-no-button|window-blur|visibility-restored，原始禁用=tab-cross-drag|ai-panel-resize，已禁用 Nms）
   ```
5. **改宽收尾顺序**：先 `resume` 再动其它 DOM 状态——该函数后续任何一步抛错都不能把「点不动」留在界面上。

## 5. 验证

### 5.1 绿轮（实跑）

```
NODE_PATH="$(npm root -g)" node tests/uat-webview-hit-test-stuck.js
```

真实 dev 应用上 30 项断言全过：基线不变量（恰一个可见且 auto/非 inert，其余一律 none + inert）；正常收尾（拖拽/改宽各一条）恢复且**不**产生残留日志；丢 `mouseup` 三条兜底路径（拖拽 + `mousemove` 信号、拖拽 + 看门狗纯时间推进、改宽 + `mousemove` 信号）各自恢复且日志归因正确；幂等中「未 suspend 的 resume 为 no-op」。

### 5.2 红轮（单点变异，各自精准打红）

| 变异 | 预期 | 实测 |
|---|---|---|
| 看门狗判据恒为「重排」 | 仅看门狗两条断 | ✔ 只红那两条 |
| 拆掉 `mousemove` 兜底 | 仅丢 mouseup 的 2/5 用例红 | ✔ 红 7 条（含连带），看门狗用例仍绿 ⇒ 两条机制互相独立 |
| 改宽收尾改回旧实现 `pointerEvents=''` | 仅「非活动 webview 仍不可命中」红 | ✔ 只红那一条 |

### 5.3 回归对照

`NODE_PATH="$(npm root -g)" node tests/uat-hard-reload-shortcut.js` 全绿（键盘 → `before-input-event` → renderer 分发链路，本次未触碰）。

### 5.4 保真度边界（不得读成更强的证据）

- 驱动里的 `e.buttons` 是**手工构造**的（真实 Chromium 只在真鼠标 `mousemove` 时填），因此「mousemove 兜底」验证的是**监听器判定逻辑**，不是 Chromium 的 buttons 语义；看门狗那条（零事件、纯时间推进）不受该边界影响。
- 本驱动不验证「真实鼠标事件是否被 Chromium 送到 guest」（需真机手势）。

## 6. 复发时的判别签名（下次先读这里）

1. **看有没有这行日志**（dev/debug 或用户贴的控制台）：
   `[Realm] webview 可命中性残留已恢复（...）`
   - 有 ⇒ 本机制；`原始禁用=` 直接指出是拖标签还是改宽，`兜底=` 指出哪种收尾丢了
   - 无，但页面确实点不动 ⇒ 去第 2 步
2. **看主进程有没有**（仅 dev/debug）：`[Realm 诊断] webContents 无响应` / `渲染进程退出`（`main.js` 的 `web-contents-created` 观测块）
   - 有 ⇒ guest 渲染进程卡死/崩溃，属另一类问题（页面保留最后一帧、`executeJavaScript` 也会失效），不是本机制
3. **手动分诊**：在页面上按 `f`（hint 出现且能聚焦输入框 ⇒ guest 活着 ⇒ 命中测试层）；或在控制台对它 `executeJavaScript`（超时 ⇒ guest 卡死）
4. **临时自救**：切一下标签页即可（`showWebview` 会重算可命中性），不必重启

## 7. 未纳入本次

- `navigateCurrentTab` 的 `showWebview(tabId)` 签名允许非活动 tab（今天不可达）：本次只消解风险，未改行为
- 刷新按钮在页面处于 `loading` 状态时语义是 stop（标准浏览器行为，但对永远 loading 的流式页面等于按钮刷不了新）——独立小项
- guest preload 每 500ms 轮询里用 `sendSync`（阻塞式 IPC）：仓库自己的文档已标注其死锁风险，本次未动，留作独立小项

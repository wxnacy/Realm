# webview 鼠标命中残留：网页点不动、刷新无效、只能重启

> **状态**：已修复，**已合入 master**（2026-09-15：先 merge `dc08c18`；当日追加诊断日志落盘后再 merge `0b74443`）
> **分支**：`hotfix/webview-hit-test-stuck`（已合入；worktree `.worktrees/webview-hit-test-stuck`）　**基点**：`40a58cb`
> **一句话根因**：拖标签 / 拖 AI 面板宽度期间会把**所有** webview 的 `pointer-events` 置 `none`（且不改可见性），而恢复只挂在各自的 `mouseup` 上——那次 `mouseup` 一丢，网页区就永久失去鼠标命中。
> **本文档行号**：`src/renderer.js` 的锚点为 master `dc08c18` 时的值（其后未再改动该文件）；`main.js` 与落盘相关的锚点为 `0b74443` 时的值。两次 merge 的 tree 都与对应分支 tip **逐字节相同**（`e91036ab…` / `9b2ba537…`），故分支上跑的验证结论直接继承。

---

## 0. 五分钟接入（TL;DR）

| 问题 | 答案 |
|---|---|
| 用户看到什么 | 网页内的输入框和链接**鼠标点不动**；地址栏/工具栏正常；**刷新页面无效**；只能重启；非必现 |
| 根因在哪一层 | **宿主渲染进程**给 `<webview>` 元素写的内联 `pointer-events` —— 不在 guest 页面里，也不在 vim 状态机里 |
| 怎么一眼确认 | 出问题时按 `f`（Vim hint）：**hint 会出现且能聚焦输入框** ⇒ guest 活着、是命中测试层；若 hint 也失效 ⇒ 是 guest 进程卡死，属另一类 |
| 现在还会不会发生 | 丢 `mouseup` 仍可能发生（事件丢失是外部条件），但**不会再永久卡住**：最迟 3 秒被兜底恢复，并打印一行归因日志 |
| 复发时第一个动作 | 搜 `[Realm] webview 可命中性残留已恢复`（见 §5.2）；没有这行再去查主进程 `[Realm 诊断]`（见 §5.2 第二类） |
| 事后取证（打包版） | 日志已**落盘**：`<userData>/logs/diagnostics.log`（dev=`~/Library/Application Support/realm-dev/logs/`）。渲染进程那条残留日志也在里面，无需当时开着 DevTools。采集范围与盲区见 §6.5 |
| 当场自救（用户侧） | 切到别的标签页再切回（会走 `showWebview` 重算），**不必重启** |
| 回归门禁 | `NODE_PATH="$(npm root -g)" node tests/uat-webview-hit-test-stuck.js`（实跑 51 项；会话只 1 个标签时 +2） |
| 关键锚点 | `src/renderer.js`：`state.visibleTabId`(:213)、`applyWebviewInteractivity`(:1990)、`suspendWebviewHitTest`(:2042)、`resumeWebviewHitTest`(:2059)、`initWebviewHitTestSafetyNet`(:2081)、`showWebview`(:2121)；`main.js` 观测块(:548-609)；`diagnostics-log.js`（落盘，零 electron 依赖） |

**禁止事项（改这块代码前先看 §7）**：不要再出现任何「自行写 `wv.style.pointerEvents`」的代码；不要用 `state.activeTabId` 判「屏幕上显示的是哪个 webview」。

---

## 1. 现象与用户原话

用户报告（原话，2026-09-15）：

> 在页面长时间运行后经常会出现鼠标点击网页内的输入框无效/没反应，不能正常把光标聚焦在输入框输入信息。刷新页面也不管用，重启才行。但不是必现的。我怀疑跟 vim 快捷键有关系，因为它的 f 键位可以聚焦输入框。

补充追问得到的现场信息：

- 「输入框点击没反应，链接**好像**也点击没有反应（印象中是这样）」
- 「**地址栏能聚焦能输入**，网页不行」
- 出问题前「**都没做过，就放着看/长时间没动**」

---

## 2. 判据：为什么这一定是「宿主 → guest 的鼠标命中」这一层

### 2.1 决定性旁证

用户说的「`f` 键位可以聚焦输入框」不是猜测的一部分，而是**判别性证据**。Vim hint 模式的实际链路（`src/renderer.js` 的 `injectHintMode` + `__realmHintKey` 派发）是：

```
主进程 before-input-event 捕获按键（不依赖 guest 键盘焦点）
  → IPC vim:triggered / vim:hint-key
  → renderer webview.executeJavaScript(...) 注入 guest
  → guest 内渲染 overlay → 按 hint 字母 → element.click() → 输入框获得焦点
```

**全程不经过浏览器命中测试。** 所以旁证成立 ⇒ 以下同时成立：

| 被证实 | 被排除 |
|---|---|
| guest 进程活着、脚本能跑、DOM 焦点可编程设置 | guest 渲染进程卡死/崩溃（那时 `executeJavaScript` 注入会一并失效，hint 根本不出现或按了没反应） |
| 真实鼠标事件**到不了 guest** | vim 状态残留吞键（那只会吞**键盘**，且焦点一旦进入输入框，主进程 `before-input-event` 会因 `vimFocusStates` 放行，与本现象不符） |

### 2.2 被排除的假设（连同排除理由，避免后来者重走）

| 假设 | 为什么排除 |
|---|---|
| Vim 状态残留（`hintModeActive` / `searchInputActive` / `VimStateMachine` 卡在 pending） | 只影响键盘；且焦点在输入框时主进程放行按键（`shortcut-manager.js:316-355`），无法解释「点不动」 |
| 有个透明覆盖层挡住了网页区 | 全仓枚举过：候选者（`#newTabPage` / `#aiDropOverlay` / toast / 各面板）要么 `pointer-events:none`，要么非定位元素（在层叠上被绝对定位的 webview 盖住），要么可见（用户会看到）。`.new-tab-page` 是普通流内元素，早于 webview 入 DOM ⇒ 绝对定位的 webview 永远在其之上 |
| `-webkit-app-region: drag` 吞点击 | 只有 5 处选择器（`.sidebar` / `.toolbar` / `.tab-bar` / `.tab-drag-spacer` / `.ai-panel-header`），全在 chrome 区，不覆盖浏览器视图 |
| 拖拽状态机残留（`state.crossDrag` 没复位） | 会把 `pointer-events` 关掉，但 `onCrossDragMouseUp` 是 document capture 级监听，用户在宿主界面的任何一次点击都会触发它 ⇒ 会自愈，与「一直点不动」不符 |
| 之前那次修复（08-27）没生效 | 那次修的是**键盘**侧的焦点上报竞态（`docs/debug/vim-mode-input-field-bug.md`），与鼠标命中不是同一层；本次已实证走查其在场 |

### 2.3 两个"亚症状"为什么由同一根因解释

| 用户的观察 | 解释 |
|---|---|
| **刷新页面无效** | 改的是**宿主** `<webview>` 元素的内联样式，与页面 DOM 无关；`reload()` 只重载 guest 文档，不可能清掉宿主样式 |
| **"长时间没动之后才出现"** | 该状态是**静默的**——不去点网页完全看不出来（页面照常渲染、滚动条还在、鼠标形状不变）。触发点（那次丢 `mouseup` 的拖拽）可能远早于发现时刻，所以用户回忆不起做过什么操作 |

---

## 3. 病灶

### 3.1 两处「置 none 后只靠各自 mouseup 恢复」（主因）

拖拽/改宽期间必须把 webview 的 `pointer-events` 置 `none`，否则鼠标经过网页区会被 guest 吞掉、宿主 `mousemove` 断流（表现为"拖几像素就卡住"、浮动预览卡在页面上）——**这个手段本身是对的**，问题在收尾。

改前代码（基点 `40a58cb`）：

| 触发 | 置 `none` | 恢复 |
|---|---|---|
| 拖标签激活跨窗口拖拽 | `onCrossDragMouseMove` ⇒ `:13875-13877`（`document.querySelectorAll('webview')` 全置 none） | `restoreWebviewPointerEvents()` ⇒ `:13796-13800`，仅由 `onCrossDragMouseUp`(:13963) 与 `onCrossDragKeyDown`(:14068) 调用 |
| 拖 AI 面板宽度 | `initAIPanelResize.onMouseDown` ⇒ `:14281-14283`（同样全置 none） | `onMouseUp` ⇒ `:14303-14305`，且恢复成 `''`（= auto，**连非活动 webview 一起放开**） |

`mouseup` 丢失的现实路径（任一即可）：鼠标在窗口外松手、拖拽中途窗口失焦 / 屏幕休眠、面板在拖拽中被关闭、渲染进程事件丢失、`onMouseUp` 在恢复语句**之前**抛错（改前恢复语句位于函数中后段，前面还有 `classList` 操作）。

### 3.2 第二入口：可命中性有两套真源

`restoreWebviewPointerEvents` 自己按 `state.activeTabId` 写 `pointer-events`，而可见性由 `showWebview(tabId)` 按**参数**写。两者不一致时，恢复动作会把**屏幕上那个**打成不可命中、把不可见的那个设成可交互：

```js
// 改前 :13796-13800
function restoreWebviewPointerEvents() {
  state.webviews.forEach((wv, id) => {
    if (wv) wv.style.pointerEvents = id === state.activeTabId ? 'auto' : 'none';
  });
}
```

**可达性实测（重要，避免误判）**：`navigateCurrentTab` 里存在 `showWebview(tabId)` 这种「参数可以是非活动 tab」的签名（`:760`，`navigateCurrentTab` 由 `openUrl` 的 current-tab 分支调用，`:860`），但 `resolvedSourceTabId = sourceTabId || state.activeTabId`（`:847`），而全仓两处调用点都传 `state.activeTabId`（`:6264`、`:6909`）⇒ **今天不可达**。本次**不改其行为**，只把风险消解掉（见 §4.1）。

### 3.3 全仓「能影响命中」的写入点清单（改前）

只有 5 处写 webview 的交互/可见性，本次全部收敛为 1 处：

| 位置（改前） | 写了什么 |
|---|---|
| `showWebview` `:1944-1959` | `visibility` / `position` / `pointerEvents` / `inert`（按参数 tabId） |
| `restoreWebviewPointerEvents` `:13796-13800` | `pointerEvents`（按 `activeTabId`） |
| `onCrossDragMouseMove` `:13875-13877` | `pointerEvents = 'none'`（全部） |
| `initAIPanelResize.onMouseDown` `:14281-14283` | `pointerEvents = 'none'`（全部） |
| `initAIPanelResize.onMouseUp` `:14303-14305` | `pointerEvents = ''`（全部） |

CSS 侧无任何规则能关掉 webview 命中（`.browser-view webview` 只设了 `background`）。

---

## 4. 修复（分支 tip，全部在 `src/renderer.js` + `main.js`）

### 4.1 单一真源

- `state.visibleTabId`（`src/renderer.js:213`）：**实际显示**的 tab，由 `showWebview` 写入。刻意与 `activeTabId` 分开——收尾要按「屏幕上那个」恢复，不是按「tab 栏高亮的那个」猜。
- `applyWebviewInteractivity()`（`:1990`）：可见性与可命中性**唯一写入点**，`showWebview`（`:2121`）与所有收尾共用。判定逻辑是从原 `showWebview` 循环**原样搬移**的，只把真源从参数改为 `state.visibleTabId`。

### 4.2 成对入口

```js
suspendWebviewHitTest(reason)   // :2042  reason ∈ {'tab-cross-drag','ai-panel-resize'}，同时记时间戳并起看门狗
resumeWebviewHitTest(source)    // :2059  幂等；未 suspend 时 no-op（不会覆盖 showWebview 的结果）
clearWebviewHitTestSuspend()    // :2011  静默清除登记（showWebview 切 tab 时调用）
```

调用点（全部）：

| 位置 | 调用 |
|---|---|
| `onCrossDragMouseMove` 激活分支 `:14035` | `suspendWebviewHitTest('tab-cross-drag')` |
| `onCrossDragMouseUp` `:14121` | `resumeWebviewHitTest('drag-end')` |
| `onCrossDragKeyDown`（Escape 取消）`:14226` | `resumeWebviewHitTest('drag-end')` |
| `initAIPanelResize.onMouseDown` `:14439` | `suspendWebviewHitTest('ai-panel-resize')` |
| `initAIPanelResize.onMouseUp` `:14459` | `resumeWebviewHitTest('drag-end')`（**已上移到函数最前**：后续任何一步抛错都不能把"点不动"留在界面上） |
| `showWebview` `:2125` | `clearWebviewHitTestSuspend()` |
| 初始化链 `:7210` | `initWebviewHitTestSafetyNet()` |

### 4.3 兜底网（`initWebviewHitTestSafetyNet` `:2081`）

不再依赖各拖拽路径自己的收尾：

| 信号 | 语义 |
|---|---|
| `mousemove` 且 `e.buttons === 0`（`:2093`） | 指针在动却没有按键 ⇒ 拖拽早已结束而收尾丢失（**第一现场信号**，最常先命中） |
| `window blur`（`:2105`）/ `visibilitychange` 恢复可见（`:2113`） | 窗口失焦或不可见时按键不可能仍按在窗口内 ⇒ 证据作废并尝试恢复 |
| 3s 看门狗（`:2024`） | 零事件场景（用户直接走开）也能救回 |

两个时间常数**必须不相等**（这是本次踩过的坑，已写进 AGENTS.md）：

```js
const WEBVIEW_SUSPEND_WATCHDOG_MS = 3000;  // :1972 复查间隔
const WEBVIEW_SUSPEND_EVIDENCE_MS = 1000;  // :1980 「按键仍按着」的证据有效期
```

相等时看门狗每次复查都会判「证据还没过期」而无限重排，残留**永远救不回来**（首次实现就是这个形态，靠单点变异发现）。

### 4.4 诊断日志（正常收尾静默 ⇒ 正式版零新增输出）

只在兜底救回时打印，含**原始禁用来源**与**已禁用时长**，一行即可定位：

```
[Realm] webview 可命中性残留已恢复（兜底=watchdog|mousemove-no-button|window-blur|visibility-restored，原始禁用=tab-cross-drag|ai-panel-resize，已禁用 Nms）
```

### 4.5 主进程 guest 观测（`main.js:548-609`）

输出分工：**落盘在 development/debug/nightly 全生效**（走 `diagnosticsLog.diagLog`），控制台回显仍只在 dev/debug（`production`/`nightly` 控制台零输出）；只挂监听与日志、不含行为逻辑。文件与采集范围见 §6.5：

- `unresponsive` / `responsive`：渲染进程主线程卡住与恢复
- `render-process-gone`：崩溃或被系统回收（带 `reason` / `exitCode`）
- `did-fail-load`：主框架加载失败（**滤掉 `-3 ERR_ABORTED`**，那是正常导航取消，否则刷屏）

用途：区分「guest 卡死」与「宿主命中测试坏了」——前者会让 `executeJavaScript` 注入一并失效，后者不会。

---

## 5. 诊断手册（复发时按这个走）

### 5.1 决策树

```
网页点不动
├─ 按 f 有 hint 出现且能聚焦输入框？
│   ├─ 是 → 命中测试层（本文档这一族）
│   │   ├─ 有 [Realm] webview 可命中性残留已恢复  → 本机制，看「原始禁用=」定位是拖标签还是改宽
│   │   └─ 没有该日志 → 属"宿主命中测试被别的东西占住"（覆盖层 / 其它写 pointerEvents 的代码）
│   │       排查：按 §5.3 手动读数
│   └─ 否（hint 不出现 / 按了无反应）→ guest 进程卡死或已崩溃
│       └─ 查主进程 [Realm 诊断] webContents 无响应 / 渲染进程退出
└─ 连地址栏也点不动 → 不是本族（宿主整体问题，另立排查）
```

### 5.2 日志签名表

> 打包版（Nightly/正式）没有终端 ⇒ 下面这些行**落盘在 `<userData>/logs/diagnostics.log`**（见 §6.5）。
> 其中渲染进程那几条（残留恢复）不需要开 DevTools，起效环境含 nightly；主进程四条在 nightly 也记。

| 日志 | 结论 |
|---|---|
| `[Realm] webview 可命中性残留已恢复（兜底=…，原始禁用=…）` | 本机制；`原始禁用=tab-cross-drag` ⇒ 拖标签路径，`=ai-panel-resize` ⇒ 改宽路径；`兜底=` 指出哪种收尾丢了 |
| `[Realm 诊断] webContents 无响应 id=… type=webview url=…` | guest 渲染进程主线程卡住（页面保留最后一帧、点击/打字/刷新全失效）——与本文档**不同**的一类，另立排查 |
| `[Realm 诊断] 渲染进程退出 … reason=…` | guest 崩溃/被回收，同上另立 |
| `[Realm 诊断] 主框架加载失败 … code=…` | 页面本身没加载出来（不是本族，但可解释"看不到内容"） |

### 5.3 手动分诊（没有日志、也无法复现时）

1. 在页面上下文读数（DevTools 或 `win.evaluate`）：

```js
// 命中层被谁关着？
Array.from(document.querySelectorAll('#browserView webview')).map(wv => ({
  pe: getComputedStyle(wv).pointerEvents,
  vis: getComputedStyle(wv).visibility,
  inert: wv.inert,
}));
// 网页区中心点上到底是谁在接收鼠标？
const r = document.querySelector('#browserView').getBoundingClientRect();
document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
```

- 可见那个 webview 的 `pe === 'none'` ⇒ 命中层被关（本族）
- `elementFromPoint` 返回的不是 `<webview>` ⇒ 有元素盖在上面
- 两者都正常但仍点不动 ⇒ 怀疑 guest 卡死，用 `webview.executeJavaScript('1+1')` 看是否超时

2. guest 活性判据：`executeJavaScript` **超时** ⇒ guest 卡死（§5.2 第二类）；**正常返回** ⇒ guest 活着，属命中层。

### 5.4 临时自救（用户侧，无需重启）

切到别的标签页再切回（`switchTab` ⇒ `showWebview` ⇒ `applyWebviewInteractivity` 重算）。若已带本分支，通常无需手动——最迟 3 秒自动恢复。

---

## 6. 验证手册

### 6.1 绿轮（实跑 51 项，0 失败）

```bash
NODE_PATH="$(npm root -g)" node tests/uat-webview-hit-test-stuck.js   # exit 0
```

> 断言条数随会话略有浮动：启动时若只有 1 个 webview，驱动会补建一个 `about:blank` 临时标签以取得「非活动 webview」（+2 条，收尾关闭并切回）。上表 51 条对应「启动会话已有多个标签」的实跑（含用例 7 的 11 条落盘断言）。

覆盖（`tests/uat-webview-hit-test-stuck.js`）：

| 用例 | 断言要点 |
|---|---|
| 0 基线 | 恰一个 webview 可见且 `auto`/非 `inert`；其余一律 `none` + `inert` |
| 1 拖拽正常收尾 | suspend 生效 ⇒ `mouseup` ⇒ 立即恢复；**不**产生残留日志（负命题） |
| 2 拖拽丢 `mouseup` + `mousemove` 兜底 | 残留复现 ⇒ `mousemove(buttons=0)` ⇒ 立即恢复；日志归因 `tab-cross-drag` + `mousemove-no-button` |
| 3 拖拽丢 `mouseup` + 看门狗 | 零事件纯时间推进，3800ms 内恢复；日志含 `watchdog` |
| 4 改宽正常收尾 | 恢复且**非活动 webview 仍 `none`**（旧实现会把它们误设成 `auto`）；不产生残留日志 |
| 5 改宽丢 `mouseup` + `mousemove` 兜底 | 恢复；日志归因 `ai-panel-resize` |
| 6 幂等 | 未 suspend 时 `resumeWebviewHitTest('drag-end')` 为 no-op，状态快照逐项不变 |

驱动自身约束（写在文件头，勿删）：用合成 `MouseEvent` 走**真实监听器链路**；`mouseup` / `mousemove` 复用拖拽起点坐标，避免 `onCrossDragMouseUp` 走到 `endDrag({outOfTabBar})` 那条**会真的新建窗口**的分支；按需补 `about:blank` 临时标签并在收尾关闭切回；`aiPanelWidth` 原值写回。

### 6.2 红轮：三条单点变异（各自精准打红，可复现）

每条都在 `src/renderer.js` 上改一处，跑同一条命令，跑完 `git checkout -- src/renderer.js` 还原。

| # | 改哪里 | 改法 | 预期红 | 实测 |
|---|---|---|---|---|
| 1 | `armWebviewSuspendWatchdog` :2028 的条件 | `if (Date.now() - lastPointerPressedAt < WEBVIEW_SUSPEND_EVIDENCE_MS \|\| true)`（看门狗永不判决） | 仅看门狗 2 条 | ✔ 恰好红 2 条 |
| 2 | `initWebviewHitTestSafetyNet` :2093 | 注释掉 `resumeWebviewHitTest('mousemove-no-button');` | 仅丢 mouseup 的用例 2/5 | ✔ 红 7 条（用例 2 四条 + 用例 5 两条 + 用例 6 一条连带），**用例 3 看门狗仍绿** ⇒ 两条机制互相独立 |
| 3 | `initAIPanelResize.onMouseUp` :14459 之后 | 补回旧实现 `document.querySelectorAll('webview').forEach(wv => { wv.style.pointerEvents = ''; });` | 仅「改宽收尾后非活动 webview 仍不可命中」1 条 | ✔ 恰好红 1 条 |

失败时驱动 exit code = 1（`保留 | tail` 会吞掉退出码，判红请直接看输出或以 `; echo $?` 取码）。

### 6.3 回归对照

```bash
NODE_PATH="$(npm root -g)" node tests/uat-hard-reload-shortcut.js   # 全绿
```

走「合成按键 → 主进程 `before-input-event` → renderer 分发」链路，本次未触碰该链路，用作渲染进程启动与 webview 装配未坏的对照。

### 6.4 保真度边界（不得读成更强的证据）

- 驱动里的 `e.buttons` 是**手工构造**的（真实 Chromium 只在真鼠标 `mousemove` 时填）⇒「`mousemove` 兜底」验证的是**监听器判定逻辑**，不是 Chromium 的 buttons 语义；**用例 3（看门狗）不受该边界影响**（零事件、纯时间推进）。
- 本驱动**不验证**「真实鼠标事件是否被 Chromium 送到 guest」（需真机手势）。
- 本次**未复现用户现场的那一刻**（丢 `mouseup` 是外部条件）。逻辑链与门禁都指向宿主命中层；若复发时**没有** §5.2 第一类日志，则应按决策树转查 guest 卡死那一类。

### 6.5 日志落盘（观察期取证通道）

**为什么需要**：打包版（Nightly/正式）双击启动没有终端，而残留恢复日志是**渲染进程**的
`console.warn` —— DevTools 一关就没了，事后无从取证。`diagnostics-log.js` 把它与主进程诊断
一起写进文件。

| 项 | 值 |
|---|---|
| 文件 | `<userData>/logs/diagnostics.log`（dev = `~/Library/Application Support/realm-dev/logs/`，Nightly = `…realm-nightly/logs/`） |
| 轮转 | 超过 `MAX_BYTES`(5 MB) 改名 `.1`（只留一份历史），继续追加；进程内累计，不做逐条 stat |
| **启用环境** | `development` / `debug` / `nightly`；**`production` 完全不落盘**（零行为变化） |
| 控制台回显 | 仅 dev/debug（`diagLog` 的 mirror）—— **Nightly 控制台保持零输出**，落盘不受影响 |
| 会话头 | 每次启动一行 `===== session start env=… version=… pid=… at … =====`（多会话混在一个文件里，按它分段读） |
| 写失败 | 吞掉异常并**整轮停用**（避免逐行报错风暴），只往 stderr 说一次 |

**采集范围**（每条都实测过）：

| 来源 | 落盘 | 说明 |
|---|---|---|
| 主进程 4 类诊断事件 | ✓ | `unresponsive` / `responsive` / `render-process-gone` / `did-fail-load`（滤 `-3 ERR_ABORTED`）。**这是本次改动的关键**：此前它们只在 dev/debug 打控制台，Nightly 完全没有 |
| 主进程 `console.warn` / `console.error` | ✓ | 挂钩记录，原输出保留（`console.log` 不记：每次导航/每帧都打，量太大） |
| 主窗口渲染进程 | ✓（白名单） | 文案命中 `可命中性残留` 或 `[Realm 诊断]`，或 `level === 'error'` |
| **webview guest** | ✓（同白名单） | **必须挂在 guest 自身的 webContents 上**；挂在主窗口收不到（见下方更正） |
| Electron 内部消息 | ✗ | `sourceId` 以 `node:electron/` 开头（安全警告随每个页面出现） |
| CSP 违规 | ✗ | 噪声表排除：实测单次页面加载可产生 20+ 条 error，会淹没诊断 |

**约定**：想让某条渲染进程日志进文件，就把 `[Realm 诊断]` 写进文案（或在主进程调 `diagLog`）。
新增噪声源必须**同时**补 `NOISE_PATTERNS` 与 `tests/test-diagnostics-log.js` 里的样本数组
—— 该用例断言「噪声表与样本一一对应」，只加模式不补样本会转红。

**验证**：
- 纯逻辑：`node --test tests/test-diagnostics-log.js`（19 项：过滤 / 环境门槛 / 格式 / 轮转 / 幂等 / 写失败停用）
- 真应用：本驱动**用例 7**（11 项）。其中 7b / 7d 是**单变量对照**——同前缀、同来源，只差正文是否命中噪声模式，一个落盘一个不落 ⇒ 差异只可能来自噪声规则本身
- 红轮实测：拆掉噪声规则 ⇒ **只红 7d**；关闭渲染转发 ⇒ **只红「计数增量」与「guest 落盘」两条**

**判据纪律（踩过的坑）**：日志文件是**追加**的，「文件里存在某行」会被历史会话的旧行满足
⇒ 单靠存在性判据会**假绿**（单点变异实测确认）。必须配**计数增量**判据，或用本次运行独有的随机 tag。
7a 因此同时断言 `residualAfter > residualBefore`。

**盲区（别当成更强证据）**：
- `console.log` 不落盘 ⇒ 页面自己的 log 不在文件里
- 文件跨会话追加 ⇒ 先按 `===== session start` 分段
- 正式版（production）不落盘 ⇒ 用户报"正式版"问题时要靠复现或临时切 dev 环境

**顺带更正一处旧结论**：`docs/debug/vim-mode-input-field-bug.md` §8.3 记的「新版 Electron 的
`console-message` 收不到 guest 日志」**不成立** —— Electron 43 实测（本机探针 + 本驱动用例 7b）
guest 日志能收到，前提是**注册在 guest 自身的 webContents 上**。旧结论应是在主窗口 contents
上监听造成的误判。该文档已加更正注记。



---

## 7. 维护约定（改这块代码时必须遵守）

1. **禁用必须成对**：任何"关掉 webview 命中"的代码一律走 `suspendWebviewHitTest(reason)`，恢复一律走幂等的 `resumeWebviewHitTest(source)`；**不得再自行写 `wv.style.pointerEvents`**。
2. **真源唯一**：可见性与可命中性只有 `applyWebviewInteractivity()` 一个写入点，真源是 `state.visibleTabId`。**不要**用 `state.activeTabId` 判"显示的是哪个 webview"。
3. **正常收尾静默**：日志只在兜底救回时打印；新增兜底路径时请复用 `resumeWebviewHitTest(source)` 并传新的 `source`，以便日志归因。
4. **两个时间常数不等**：`WEBVIEW_SUSPEND_WATCHDOG_MS` ≠ `WEBVIEW_SUSPEND_EVIDENCE_MS`，相等 = 看门狗永不判决。
5. **收尾顺序**：`resume` 要放在收尾函数靠前位置，后续任何一步抛错都不能把"点不动"留在界面上。
6. 改完必须跑 §6.1 门禁，并按改动面挑一个变异复现红轮（至少变异 2 或 3）。
7. **诊断文案约定**：要落盘的渲染进程日志必须带 `[Realm 诊断]` 前缀（或在主进程走 `diagLog`）；新增噪声源要同时补 `NOISE_PATTERNS` 与单测样本数组（见 §6.5）。
8. **落盘不得影响主流程**：`diagnostics-log.js` 的所有文件操作必须保持 try/catch 兜底；改这块后跑 `node --test tests/test-diagnostics-log.js`（含「写失败整轮停用」用例）。

---

## 8. 未纳入本次（已知风险 + 建议做法）

| # | 事项 | 位置 | 建议 |
|---|---|---|---|
| 1 | `navigateCurrentTab` 的 `showWebview(tabId)` 允许传非活动 tab，会把显示与 tab 栏高亮弄不一致 | `src/renderer.js:760` | 今天不可达（两处调用点都传 `activeTabId`）。本次只由真源消解风险（即便发生，可见页面仍可命中）。若要加固：加「`tabId !== state.activeTabId` 时不改可见性」并配可验证的门禁（注意：仅加 `console.warn` 会因不可达而无法验证） |
| 2 | 刷新按钮在页面处于 `loading` 状态时语义是 stop | `src/renderer.js` 的 `elements.reloadBtn` click 分支 | 标准浏览器行为，但对"永远 loading"的流式页面等于按钮刷不了新。独立小项，改动前先确认是否要保留 Chrome 语义 |
| 3 | guest preload 每 500ms 轮询里用 `sendSync`（阻塞式 IPC） | `src/webview-preload.js:587` + `:567` | 仓库自己的文档已标注 handler 缺失 ⇒ 渲染进程永久阻塞。本次**未动**（避免引入回归）。若要做，需另立小项 + 独立验证（连"点击输入框后立刻打字不吞键"那条正确性一起设计），并同步 `docs/debug/vim-mode-input-field-bug.md` |
| 4 | 拖拽状态机残留（`crossDragTabId` / `crossDragListenersAttached` 在丢 `mouseup` 后不复位） | `src/renderer.js` 跨窗口拖拽块 | 本次只修「可见后果」（命中被关）。状态机残留本身会让下次 mouse 移动误激活拖拽；因 `onCrossDragMouseUp` 是 document capture 级、任何一次点击都会复位，故影响有限——留观察 |

---

## 9. 交接清单

| 项 | 值 |
|---|---|
| 分支 / worktree | `hotfix/webview-hit-test-stuck` / `.worktrees/webview-hit-test-stuck`（仓库内，含 `node_modules` 符号链接） |
| 基点 | `40a58cb`（master；分支期间 master **未前进**，故合并零重叠） |
| 提交 | 第一轮（命中残留修复）`3959765` fix · `8603bad` feat(main) 观测 · `94cf805` test · `47dc69c`/`f55d703` docs；第二轮（日志落盘）`9a150b6` feat(diagnostics) · `1cf25ed` test · `3ebf66a` docs |
| 同步 | 第二轮开工前 `823b74c`、落地前 `8977cdb`（把 master 的并发会话改动并进分支；**其中一次 master 已前进 2 个提交（test(51) 复核轮），不同步直接回合会覆盖对方的 `.planning/phases/51-zip/*` 与 `tests/uat-51-import-limits.js`**） |
| 落点 | **已合入 master**（两次 `--no-ff`）：`dc08c18`（修复）· `0b74443`（日志落盘）。两次的 tree hash 都与对应分支 tip 逐字节相同（`e91036ab…` / `9b2ba537…`）⇒ **分支上的红绿轮验证结论直接继承**，无需在 master 重跑整套 |
| 合入后复跑 | 按改动面（`src/renderer.js` + `main.js` + 新根模块）复跑**源码扫描类 11 个套件 + 本次新增落盘单测**，共 12 个：`test-diagnostics-log` / `test-ai-cancel-state` / `test-ai-skills` / `test-builtin-skills-seeder` / `test-context-menu-channels` / `test-context-menu-menu` / `test-media-remuxer` / `test-skill-picker-model` / `test-skills-http-api` / `test-skills-import-net` / `test-skills-import` / `test-skills-management` —— **全部 PASS** |
| 观察期 | 在 **Nightly** 上观察（`make install-nightly`，构建自仓库根 = master 工作树）。**注意**：落盘能力是第二轮才有的，观察用的 Nightly **必须重新构建**才含它；此前构建的包仍无日志文件 |
| 观察期取证 | 复现后直接读 `<userData>/logs/diagnostics.log`（dev = `~/Library/Application Support/realm-dev/logs/`，Nightly = `…realm-nightly/logs/`）；判读见 §5.2 + §6.5 |
| 分支与 worktree | **保留中**（观察期结束时按规范 §4 两步清理：`git worktree remove .worktrees/webview-hit-test-stuck` → `git branch -d hotfix/webview-hit-test-stuck`） |
| 远端 | 未推送（本地 master 领先 `origin/master` 99+ 提交，是否推送由维护者定） |
| 复查命令 | `git -C .worktrees/webview-hit-test-stuck log --oneline master..HEAD` |
| 相关文档 | `docs/debug/vim-mode-input-field-bug.md`（键盘侧，另一层，别混）· `docs/debug/vim-hint-focus-cross-tab-failure.md`（hint 按键路由不依赖 guest 焦点，正是本次判据的基础） |

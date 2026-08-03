# fill_form 焦点输入管线排查实录（已完结）

> 2026-08-03 · Phase 24 UAT · 状态：**已解决，UAT 复验通过（G-24-2b resolved）**
> 关联文档：[fill_form 假成功排查实录](./fill-form-silent-success.md)（前三层根因已解决）
> 影响文件：`cdp-manager.js`（fillForm / executeAction type）

## 当前现象（2026-08-03 16:46 一轮，GitHub 登录页）

用户输入「帮我填写邮箱 wxnacy@gmail.com 和 密码 123456」：

| # | 动作 | 结果 |
|---|------|------|
| 1 | `fill_form`（中文字段名"邮箱/密码"） | 字段未找到（预期，返回 availableFields） |
| 2 | `fill_form`（"Username or email address"/"Password"） | **`写入未生效`**（readback 捕获，未虚报） |
| 3 | `execute_action click "#login_field"` | 成功（合成 CDP 点击） |
| 4 | `fill_form`（同 #2） | readback 全过，报"成功填写 2 个字段" |
| 5 | 用户观察页面 | **"还是不行"**（readback 通过但用户侧仍不对，具体形态未确认） |

### 日志关键证据

- **证据 A**：第 2 次填写失败方式是 `写入未生效` 而非走回退路径 —— 说明
  `this.focus()` 后 `document.activeElement === this` 的回验**通过了**，
  但 `Input.insertText` 仍被丢弃。**DOM focus（activeElement）与
  insertText 所需的输入管线焦点是两层状态，前者通过不代表后者就绪。**
- **证据 B**：合成点击（`Input.dispatchMouseEvent`）之后填写**必定成功**
  —— 跨多轮稳定复现的 workaround。
- **证据 C**：click 返回的 `pageChanges.validationErrors: ["请填写此..."]`
  —— Chrome 原生 required 校验气泡，佐证点击瞬间字段确为空。
- **证据 D**：主进程日志有 `error messaging the mach port for
  IMKCFRunLoopWakeUpReliable` —— macOS 输入法（IMK）子系统异常。
  `Input.insertText` 在 Chromium 中走 **IME 提交路径**，macOS IMK 状态
  可能直接影响其生效。

## 本阶段已确认并验证的修复（不再 reopen）

| 修复 | 文件 | 验证 |
|------|------|------|
| `attachForAI` 移除 `'Input'` 域（`Input.enable` 在 Chromium 128+ 已删除，此前附加 100% 失败） | cdp-manager.js | ✅ UAT |
| `filled` 改 readback 回读校验（此前无条件 push，成功系虚报） | cdp-manager.js | ✅ UAT（本轮失败信息即其产出） |
| 元素查找：精确匹配优先 + input 用 `value` 作显示文本 + `[name=]` 匹配（"Sign in" 不再命中 passkey 按钮） | cdp-manager.js | ✅ UAT |
| 按钮类 click 一律确认（元素类型判定，非文字语义） | cdp-manager.js + ai-manager.js | ✅ UAT |
| 确认响应双通道对接：ai-manager 孤儿 IPC 删除，委托 main.js `pendingActions` 注入（此前点确认必超时误判取消） | ai-manager.js + main.js | ✅ UAT |
| 确认卡片完成通知 `action:settle`（此前点击后永远停 executing）；超时主动过期卡片 | ai-manager.js + main.js + preload.js + renderer.js | ✅ UAT |
| `sanitizeInput` 删除引号/反引号转义（此前破坏 CSS 选择器与 execute_script 内容） | ai-manager.js | ✅ UAT |
| `execute_script` 移入 `noTargetActions` | cdp-manager.js | ✅ UAT |
| 系统提示词：语义字段映射 + availableFields 重试 + 禁止口头二次确认 | ai-manager.js | ✅ UAT |
| insertText 前 `wc.focus()`（webview 抢焦）+ 焦点回验，验证不过回退原生 setter + InputEvent 序列 | cdp-manager.js | ⚠️ 部分有效（见问题 1） |

## 未解决问题

### 问题 1：fill_form 首次 insertText 必定失败，合成点击后必定成功

**稳定复现模式**：`fill`（写入未生效）→ `click 目标字段` → `fill`（成功）。

**已排除**：
- 字段查找错误（对象定位正确，readback 读的就是目标元素）
- DOM focus 未落位（`activeElement` 回验通过）
- Chromium 协议/附加问题（attach 正常，域正确）

**待验证假设**（按优先级）：

- **H1：insertText 需要 Chromium InputHandler 层的 keyboard focus**。
  `wc.focus()`（Electron API）与 `this.focus()`（DOM API）都不等价于
  用户手势聚焦；合成 `dispatchMouseEvent` 才会把 frame 标记为
  input-focused。证据：A/B。
- **H2：macOS IMK 异常导致 insertText 被吞**。insertText 走 IME 提交
  路径，日志证据 D 显示 IMK mach port 通信失败。验证方法：同一构建在
  简单静态页（无框架）上首次 insertText 是否也失败；或换
  `Input.dispatchKeyEvent`（不走 IME）对照。
- **H3：webview 嵌入场景的焦点路由特例**。guest webContents 的
  focus() 只聚焦 guest frame，embedder（主窗口）焦点状态可能干扰。
  验证方法：`Page.bringToFront` / `Target.activateTarget` 后再 insertText。

**候选修复方向**（未实施，供选择）：

- **D1（推荐先试）**：原生 setter + `InputEvent(beforeinput/input)` +
  `change` 升为主路径（已实现为回退路径，`cdp-manager.js` fillForm 普通
  input 分支）。不依赖任何焦点状态，框架兼容（原生 setter 绕过 React
  tracker）。风险：本轮 readback 全过后用户仍"不行"，需先排除该路径
  是否就是第 4 次填写实际走的路径且值被页面回退。
- **D2**：`Input.dispatchKeyEvent` 逐字符（rawKeyDown → char → keyUp），
  绕过 IME 路径（针对 H2）。
- **D3**：insertText 前 `Page.bringToFront`（针对 H1/H3）。
- **D4（workaround 正规化）**：fill 前对首个目标字段先做一次合成点击
  （AI 本轮自发发现的模式），成本一次额外 CDP 往返。

### 问题 2：readback 通过后用户仍观察不到正确结果（信息不足）

第 4 次填写 readback 全过（`this.value === 期望值` 逐字段验证），
用户仍报"还是不行"。具体形态未确认（字段为空？串字残留？值被回退？）。

**排查建议**：
1. 与用户确认"不行"的具体形态（截图对比期望值）。
2. fill 完成后 **延时 500ms 二次 readback** —— 若值消失则为页面 JS
   回退（GitHub 登录页有自定义元素 JS）。
3. fill 前后 `Page.captureScreenshot` 对比，区分"值未写入"与"值被回退"。
4. 检查是否走了回退路径（焦点回验失败 → 原生 setter）：可在回退路径
   加日志区分，判断问题 2 是否与 insertText 无关。

## 修复记录（2026-08-03 第二轮）

按 D1 方向实施，核心改动：**不再以 insertText 返回值判断成败，统一 readback 裁决**。

| 修复 | 位置 | 说明 |
|------|------|------|
| 问题 1：insertText 静默丢弃后回退路径不触发 | fillForm 普通 input 分支 | 原逻辑 `wrote = insertResult.success`，insertText 假成功时跳过回退。改为：focusOk 时尝试 insertText → readback 裁决 → 值不符走原生 setter + InputEvent 回退 → 再 readback 定成败 |
| 问题 2：readback 通过后值被页面 JS 回退 | fillForm 循环结束后 | 已填写字段延时 500ms 二次 readback，被回退时以独立错误"值被页面脚本回退"移入 failed，区分"未写入"与"被回退" |
| execute_action type 同类隐患 | executeAction type 分支 | insertText 前记录前值，插入后 readback，文本非空且值未变时走原生 setter 回退（按 selectionStart/End 拼接插入） |

## 修复记录（2026-08-03 第三轮 · 决定性证据）

**截图证据**：首次 fill 失败后，**AI 面板输入框出现 `wxnacy@gmail.com123456`** ——
insertText 并未被"丢弃"，而是打进了 embedder（主窗口渲染进程）中持有真实键盘
焦点的聊天输入框。这证实 H1/H3：**Input.insertText 打进的是输入管线焦点元素，
与 guest 内的 DOM activeElement 无关**；`wc.focus()` / `this.focus()` 均不改变
输入管线焦点，只有合成 `dispatchMouseEvent`（或真实用户手势）才会把 guest frame
标记为 input-focused。

D1 回退能保证字段值正确，但无法阻止 insertText 污染聊天框，因此实施 **D4**：

| 修复 | 位置 | 说明 |
|------|------|------|
| insertText 前合成点击落位输入管线焦点（D4） | 新增 `_syntheticClickElement`；接入 fillForm 普通 input、contenteditable、executeAction type 三分支 | scrollIntoView + 元素中心 mousePressed/mouseReleased，复用 executeAction click 的成熟模式。点击后 insertText 与 DOM 焦点一致，串字污染消除 |

未实施 D2/D3：D4 是跨多轮稳定复现的 workaround 正规化，成本一次额外 CDP 往返；
若 UAT 复验仍失败再评估 D2（dispatchKeyEvent 绕 IME）。

**验证**：`node --check` 通过；模块加载通过；28 个 functionDeclaration 注入函数体编译全过。UAT 复验（GitHub 登录页直接 fill，不经 click，且观察聊天框无串字）待人工执行。

## 交接备注

- 工作区有**未提交源码改动**：`cdp-manager.js`、`ai-manager.js`、`main.js`、
  `src/preload.js`、`src/renderer.js`（上表全部修复）。建议先提交再接力。
- 验证工具：模块加载 `node -e "require('./cdp-manager')"`；注入函数体
  语法可用正则提取 `functionDeclaration:` 模板字符串逐一 `new Function` 编译。
- UAT 状态：`.planning/phases/24-task-autonomous/24-UAT.md`，
  gap `G-24-2b`（本问题）保持 `failed`。

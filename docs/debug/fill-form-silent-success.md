# fill_form 假成功排查实录：三层根因与真实输入管线

> 2026-08-02 · Phase 24 UAT · 影响文件：`cdp-manager.js`、`ai-manager.js`

## 现象

在 GitHub 登录页让 AI「帮我填写邮箱」，`fill_form` 工具返回
`{"success": true, "filled": ["Username or email address"]}`，AI 汇报"已填写"，
但页面输入框实际为空。三次重试均复现。

## 根因（三层，逐层剥出）

### 第一层：CDP `Input.enable` 已被 Chromium 移除（阻断级）

```
[Realm CDP] AI 调试器附加失败: 'Input.enable' wasn't found
```

- `attachForAI(wcId, domains)` 会对 `domains` 里每个域执行 `{domain}.enable`；
  `fillForm`/`executeAction` 都传了 `['Runtime', 'DOM', 'Input']`。
- `Input.enable` 是 CDP 中长期弃用的 no-op 方法，**Chromium 128+（本项目
  Electron 32.3.3）已将其从协议中删除**。`sendCommand('Input.enable')` 抛错 →
  catch 里 detach 回滚 → 返回"无法连接到页面调试器"。
- 关键事实：`Input.insertText` / `Input.dispatchMouseEvent` /
  `Input.dispatchKeyEvent` 这些 **Input 域命令从来不需要 enable**——enable
  只用于订阅事件，我们不订阅 Input 事件。

**修复**：两处 `attachForAI` 调用移除 `'Input'`（`cdp-manager.js` `fillForm`、
`executeAction`）。

### 第二层：表单赋值方式不被框架识别（静默失败）

附加修好后，填写仍不生效。先后两种赋值方式都失败：

1. `this.value = val` + `dispatchEvent('input')` —— React 受控组件下，
   React 的 `inputValueTracking` 在元素**实例**上定义了 value setter 同步内部
   tracker；实例赋值让 tracker 同步到新值，`ChangeEventPlugin` 判定"无变化"
   **不触发 onChange**，组件 state 未更新，重渲染把 DOM 值回退为空。
2. 原型原生 setter（`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,
   'value').set.call(el, val)`）—— 这是 Puppeteer 社区处理 React 的标准技巧，
   但本场景仍未生效。

**最终方案：放弃 JS 赋值，改用真实输入管线**（与真人键入完全同路径）：

```javascript
await executeCommand(id, 'DOM.focus', { objectId });           // 聚焦（后台 webview 也生效）
await executeCommand(id, 'Runtime.callFunctionOn', {            // 全选已有内容
  objectId, functionDeclaration: `function() { if (this.select) this.select(); }`,
});
await executeCommand(id, 'Input.insertText', { text: value });  // 替换选区插入
```

`Input.insertText` 走 Chromium 输入管线（`beforeinput` → 更新值 → `input`
事件），React/Vue/任意表单框架都识别为真实输入。这也是本代码库 contenteditable
分支和 `execute_action` 的 `type` 操作原本就在用的成熟路径。

### 第三层：`filled` 虚报（信任危机的根源）

原实现每个分支都是：

```javascript
await executeCommand(...);   // 结果完全不检查
filled.push(field);          // 无条件记成功
```

而 `executeCommand` 对页面侧异常**不会 reject**（CDP 把脚本异常放在响应的
`exceptionDetails` 里，`sendCommand` 照常 resolve）——所以页面侧就算抛错，
工具照样报 `filled`。

**修复：写入后回读校验**：

```javascript
const readback = await executeCommand(id, 'Runtime.callFunctionOn', {
  objectId, functionDeclaration: `function() { return this.value; }`, returnByValue: true,
});
if (readback.success && readback.result?.result?.value === value) filled.push(field);
else failed.push({ field, error: `写入未生效（期望…实际…）` });
```

从此 `filled` 可信；失败时错误信息直接带期望值/实际值，AI 和用户都能看到真因。

## 附带修复：AI 语义字段映射

用户说"邮箱"，GitHub 的字段叫 "Username or email address"，字面匹配不到。
在 `REALM_SYSTEM_PROMPT` 补充规则（`ai-manager.js`）：

- 调用 `fill_form` 前先分析页面（`read_page_content`/截图），把口语字段名映射到
  页面真实 label/placeholder/name；
- `fill_form` 返回字段未找到时，**必须**根据返回的 `availableFields` 列表挑语义
  最接近的字段重试，不要直接报错放弃。

## 经验清单

1. **CDP 域 enable 要按需**：只 enable 真正订阅事件的域（Network/Runtime/DOM）；
   命令型域（Input）不需要 enable，且协议方法会随 Chromium 升级被移除。
2. **表单填写用 `Input.insertText`，不要 JS 赋值**：真实输入管线对一切框架
   （React 受控组件、Vue、原生）都有效；JS 赋值各有各的回退方式。
3. **工具结果必须回读校验**：`filled`/`success` 不能靠"命令没抛异常"推断。
   CDP 页面侧异常走 `exceptionDetails`，不 reject。
4. **给 AI 配语义映射与重试指引**：用户的口语描述和页面真实字段名几乎从不字面
   相等；`availableFields` 回传 + 提示词重试规则让 AI 能自我纠正。

---
phase: 42-ai-pi-agent
reviewed: 2026-09-01T15:20:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - ai-conversations-manager.js
  - ai-manager.js
  - ipc-handlers.js
  - src/renderer.js
  - src/index.html
  - src/styles/main.css
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
  fixed:
    - CR-01
    - WR-04
    - WR-05
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-09-01T15:20:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

> 本轮审查覆盖 42-03/42-04/42-05 三个缺陷修复计划合入后的最新代码（此前 12:00 一轮 REVIEW.md 指出的 CR-02~CR-05 已由 7c44590/02fc5b1 等提交修复，CR-01 `_escapeXml` 现已正确转义为实体，本轮不再重复列出）。

## Summary

对 Phase 42（AI 历史对话管理）及 42-03/42-04/42-05 三个缺陷修复计划改动的 6 个文件做了标准深度审查：逐文件通读 + 跨文件调用链核对（preload conversationAPI ↔ ipc-handlers ↔ ai-manager ↔ ai-conversations-manager ↔ renderer），并用 node + better-sqlite3 冒烟测试实证了两个存储层疑点。

整体评价：IPC 层 `assertTrustedSender` 全覆盖、SQL 全参数化、`updateConversation` 白名单拼 SET、渲染端 AI 内容走 marked + DOMPurify（降级 textContent）、工具卡片参数/结果全走 textContent——安全基本面扎实；42-05 的 dataset 结构化传参与 stopPropagation 修复、删除不补建语义、dialog margin:auto 居中及 main.css?v=5 缓存戳均正确落地，`convContextTarget` 零残留。

但发现 1 个 Critical：`getAgentMessages` 在 toolResult 行缺失/损坏时静默丢弃该行、却保留 assistant 行的 toolCall 块，破坏 provider 配对约束——对 42-04 之前落库的全部含工具调用对话（旧格式 `tool_results` 列恒为 NULL），切换后继续提问**必然**被 LLM 供应商拒绝，且每次重试都复现，对话永久不可用。另有 7 个 Warning，集中在流式进行中切换/重建对话的竞态、`regenerateMessage` 与全量替换持久化的语义脱节、以及截断标记制造非法 JSON 等。

冒烟复现记录（/tmp/realm-review，electron stub + 真实模块）：
- 150KB `details` 的 toolResult → `tool_results` 列截断为非法 JSON → `getAgentMessages` 输出 `user,assistant`，toolCall 在、toolResult 丢（CR-01）。
- 用户消息文本 `'[1, 2, 3]'` → `getMessages`/`getAgentMessages` 双双输出 `content: ''`（WR-04）。

## Critical Issues

### CR-01: getAgentMessages 丢弃 toolResult 行但保留 toolCall 块，破坏 provider 配对约束，旧对话切换后永久无法继续提问

> **Fixed in:** `7f0f07a`（fix(42): CR-01 synthesize placeholder toolResults for orphan toolCalls in getAgentMessages）——采用方案 b：第一遍扫描收集两侧配对键；孤儿 toolCall 紧随 assistant 行合成占位 toolResult；反向孤儿 toolResult 行丢弃，配对双向闭合。冒烟测试通过（旧格式行 + 截断/损坏路径共用同一分支）。

**File:** `ai-conversations-manager.js:635-637`（丢弃侧）、`ai-conversations-manager.js:615-619`（toolCall 保留侧）
**Issue:**
`getAgentMessages` 对 toolResult 行的守卫是 `if (!meta || !meta.toolCallId) continue;`——该行被整体跳过；但 assistant 行的 toolCall 块总是注入。一旦某条 toolResult 行读不出 `toolCallId`，注入的上下文就是「有 toolCall、无对应 toolResult」。pi-agent-core 在 agent-loop.js:25-26 明确文档化：上下文不满足配对约束时「the LLM provider will reject the request」，SDK 不做兜底清理。

三个真实触发面：
1. **旧格式行（42-04 之前落库，当前 dev 库里真实存在）**：42-01 版 `saveMessages`（commit 6713257）写 tool_results 列的取值是 `msg.toolResults || msg.tool_results`——pi 的 `ToolResultMessage` 没有这两个字段，**所有旧 toolResult 行该列恒为 NULL**。42-04 的「旧格式读时兼容」只覆盖了 content 列（显示文本 + assistant 行 toolCall 块解析），toolResult 的 `toolCallId/toolName/isError` 元数据无从重建。于是「切换到任何一个用过工具调用的旧对话 → 发消息」100% 命中：上下文里的 toolCall 全部成为孤儿，请求被供应商拒绝，重试 3 次全失败；且失败的 transcript 留在 `agent.state.messages` 里，后续每一条消息都带同样的孤儿 toolCall，对话永久报废——这正是 G-42-4 要修的场景。
2. **tool_results 列超 100KB 截断**：`serializeToolData` 截断后追加 `'"...(truncated)"'` 产生非法 JSON（见 WR-07），`safeJsonParse` 失败 → meta 为 null → 行被丢（已冒烟复现）。当前内置工具的 details 都很小，但该列无结构保证。
3. **行损坏**（T-42-08 明确要容忍的场景）：损坏 tool_results 行同样触发丢弃。

显示形状 `getMessages` 同样丢弃该行（工具卡片永远停在无结果的 completed），但那只是显示保真度问题；注入形状的配对断裂才是致命的。

**Fix:**
丢弃 toolResult 行时必须同步处理孤儿 toolCall，二选一（推荐 b，保历史语义）：

```js
// 方案 a（最小改动）：两遍扫描——先收集有配对的 toolCallId，
// 构建 agentMessages 时剔除无配对的 toolCall 块
const rows = readMessageRows(conversationId);
const pairedIds = new Set(
  rows.filter(r => r.role === 'toolResult')
      .map(r => safeJsonParse(r.tool_results, null))
      .filter(meta => meta && meta.toolCallId)
      .map(meta => meta.toolCallId)
);
// assistant 行构建 content 时：
for (const call of parsed.toolCalls) {
  if (!pairedIds.has(call.id)) continue; // 孤儿 toolCall 不注入
  ...
}

// 方案 b（保上下文）：为缺失/损坏的 toolResult 合成占位消息，维持配对
if (row.role === 'toolResult') {
  const meta = safeJsonParse(row.tool_results, null);
  if (!meta || !meta.toolCallId) {
    // 尝试按 rowid 向前找最近一条含未配对 toolCall 的 assistant 行补元数据；
    // 找不到 toolName 时用占位符
    agentMessages.push({
      role: 'toolResult',
      toolCallId: /* 从前序 assistant 行推断 */,
      toolName: meta?.toolName || 'unknown',
      content: [{ type: 'text', text: '（历史工具结果数据缺失）' }],
      isError: true,
      timestamp: row.created_at,
    });
    continue;
  }
  ...
}
```

另建议对旧格式行做一次性懒迁移（首次读到 `tool_results IS NULL` 且 role='toolResult' 的行时，按 rowid 前序 assistant 行的 toolCall 顺序回填元数据），可彻底消除触发面 1。

## Warnings

### WR-01: 流式进行中切换/新建/删除对话无防护，prompt 重试循环可能把用户消息写进错误的对话

**File:** `ai-manager.js:875-901`（重试循环）、`ai-manager.js:1857-1867`（_cleanupCurrentAgent）；`src/renderer.js:6781-6816`（switchConversation 无 aiStreaming 守卫）、`src/renderer.js:7037-7057`、`src/renderer.js:6822-6853`
**Issue:**
主进程 `prompt()` 的重试循环每次 attempt 都重新读取 `this.agent`（第 877 行 `await this.agent.prompt(message)`）。用户在 LLM 响应期间切换/新建/删除对话时：
1. `switchConversation`/`createNewConversation`/`deleteConversation` 调用 `_cleanupCurrentAgent()` → `this.agent = null` 且 **`isProcessing = false`**（第 1866 行，进行中 run 的并发锁被提前释放）；
2. 旧 run 的 promise 因 abort 结算后，`prompt()` 继续执行 `await this.agent.waitForIdle()`——此刻 `this.agent` 可能为 null（TypeError，落入 catch）或已被 `_recreateAgent` 换成**目标对话的新 Agent**；
3. 1 秒后重试：`this.agent.prompt(message)` 把**上一轮的用户消息发进新对话的 Agent**，agent_end 后 `saveCurrentConversation()` 按新的 `currentConversationId` 落库——消息串对话并被持久化，renderer 随后采纳的 `conversationId` 也是错的。

renderer 侧三个对话操作函数均无 `state.aiStreaming` 守卫（对比 `regenerateMessage` 有），UI 也不禁用流式中的列表项，触发只需「回复慢时点一下别的对话」。另有一次生竞态：旧循环最终失败时再次置 `isProcessing = false`，可能清掉新一轮 run 的并发锁。

**Fix:**
双层防护：
```js
// ai-manager.js prompt() 重试循环：cleanup 后放弃重试（代际守卫）
_cleanupCurrentAgent() { ... this._runGeneration = (this._runGeneration || 0) + 1; ... }
// prompt() 进入时记录 const gen = this._runGeneration;
// 重试前：if (gen !== this._runGeneration) return null;

// renderer.js switchConversation / deleteConversation / createNewConversation 首行：
if (state.aiStreaming) {
  showAIError('AI 正在回复，请先停止再切换对话');
  return;
}
```

### WR-02: regenerateMessage 只裁剪渲染端消息数组，不裁剪主进程 Agent transcript——「删除重答」的消息在全量替换持久化后原样复活

**File:** `src/renderer.js:8388-8427`（特别是 8406-8421）
**Issue:**
`regenerateMessage` 只做 `state.aiMessages = state.aiMessages.slice(0, msgIndex)` 然后重新 `ai.prompt(userMsgContent)`。主进程 Agent 的 `state.messages` 仍保有完整 transcript（旧 user + 旧 assistant 回复），新 prompt 只是继续追加。42-03 把持久化改为「每次 agent_end 全量替换保存 agent.state.messages」，于是：
- DB 里保存的是「旧消息 + 重新生成的消息」并存，UI 显示的裁剪是假象；
- 用户切换对话再切回（或重启），「已被重新生成掉」的消息整段重现；
- 重复多轮 regenerate 后 transcript 膨胀，且每次都作为 LLM 上下文注入。

另外两点连带缺陷：
- 第 8421 行 `window.realmAPI.ai.prompt(userMsgContent)` **没有 await 也没有 catch**——主进程抛错（如 AI 未初始化时 handler 直接 throw）会变成无人处理的 unhandled rejection，`state.aiStreaming` 已置 true 却永远等不到 turn_end/error 事件，发送按钮永久卡在停止态，后续发送全被 `if (state.aiStreaming) return` 拦死（`handleSendAIMessage` 是 await 的，没有这个问题）；
- 第 8409 行重发的 user 消息没有 `id`，与持久化/操作按钮的 id 约定不一致。

**Fix:**
主进程提供「截断 transcript 后重发」的原语，renderer 不再自己拼状态：
```js
// ai-manager.js
async regenerateFrom(userMessageText, dropAfterIndex) {
  // 按 dropAfterIndex 裁剪 this.agent.state.messages，再走 prompt 流程
}
// renderer.js
try {
  await window.realmAPI.ai.regenerate({ messageId: msg.id });
} catch (err) {
  state.aiStreaming = false;
  updateSendButtonState(false);
}
```
最小修复（不改 IPC 面）：renderer 在 regenerate 前先调用主进程裁剪通道，或至少给第 8421 行补 `.catch(err => { state.aiStreaming = false; updateSendButtonState(false); })`。

### WR-03: 流式中切换/删除对话必然触发 abort，SDK 的 aborted failureMessage 被当作真实错误广播，渲染端弹误报错误条

**File:** `ai-manager.js:1209-1238`（agent_end errorMessage → sendNow error）、`ai-manager.js:1857-1867`（JSDoc 写「abort + unsubscribe + nullify」但实际没有 unsubscribe）；`src/renderer.js:7983-8022`
**Issue:**
`_cleanupCurrentAgent()` 调 `agent.abort()` 后，pi-agent-core 用 `handleRunFailure` 以「带 errorMessage 的 assistant 消息 + agent_end」收尾（agent.js:349-367）。`_setupEventBroadcasting` 的订阅处理器看到 `lastAssistant.errorMessage`（如 "This operation was aborted"）就 `sendNow({ type: 'error', ... })`。用户主动点停止按钮时 renderer 靠 `aiCancelledByUser` 标志把该事件转成「用户已取消」；但**切换/删除/新建对话路径没人设置这个标志**，渲染端 handleAIStream 走真实错误分支 → `showAIError()` 弹「出现问题 — ...aborted...」错误条——操作本身成功，用户却看到报错。

根因之一是 `_cleanupCurrentAgent` 的 JSDoc 声称 "abort + unsubscribe + nullify"，实现里却没有 unsubscribe：`Agent.subscribe()` 返回退订函数（agent.d.ts:70），代码从未接收。旧 Agent 被 abort 后其订阅仍在，把陈旧事件继续灌进唯一的广播通道。

**Fix:**
```js
_cleanupCurrentAgent() {
  if (this.agent) {
    try { this.agent.abort(); } catch {}
    if (this._unsubscribeEvents) { this._unsubscribeEvents(); this._unsubscribeEvents = null; }
    this.agent = null;
  }
  this.isProcessing = false;
}
// _setupEventBroadcasting 末尾：this._unsubscribeEvents = this.agent.subscribe(...)
// 或在订阅处理器首行加代际守卫：
// if (this.agent !== listenedAgent) return; // 忽略旧 Agent 的残余事件
```

### WR-04: parseStoredContent 用「整串 JSON 数组」启发式判别旧格式，用户消息文本恰为 JSON 数组时内容被静默清空

> **Fixed in:** `4490216`（fix(42): WR-04 tighten parseStoredContent legacy JSON-array heuristic）——新增 `isLegacyBlockArray`：数组非空且元素全部为带已知 type（text/thinking/toolCall/image/audio）的对象才走旧格式分支；`'[1, 2, 3]'`、`'[]'`、`'[{"a":1}]'` 均按原文保留，冒烟测试通过。

**File:** `ai-conversations-manager.js:255-282`
**Issue:**
新旧格式的判别依据是「content 列能否 JSON.parse 成数组」，没有校验数组元素是否具有内容块形状（`type` 字段）。用户发送正文恰为 JSON 数组文本的消息（如 `[1, 2, 3]`、`[["a"]]`）时：新格式存储 content 即原文，但读出侧 `JSON.parse` 成功且是数组 → 走旧格式分支 → 元素无 `type === 'text'` → `text` 拼接为空串。已冒烟复现：`getMessages` 与 `getAgentMessages` 均输出 `content: ""`——显示和 LLM 上下文**双丢失**，且无任何日志。注入侧空 user 消息还可能被部分供应商拒绝。

**Fix:**
收紧旧格式判别条件，要求「数组且元素是带合法 type 的内容块对象」：
```js
function isLegacyBlockArray(parsed) {
  return Array.isArray(parsed) && parsed.length > 0 && parsed.every(block =>
    block && typeof block === 'object' &&
    (block.type === 'text' || block.type === 'toolCall' || block.type === 'thinking' || block.type === 'image')
  );
}
// parseStoredContent 中：if (isLegacyBlockArray(parsed)) { ...旧格式分支... }
```
普通文本/普通 JSON 数组从此落回「content 即显示文本」分支，误判面归零。

### WR-05: createNewConversation 里 `_recreateAgent()` 未 await，与 switchConversation 的 await 语义不一致，存在双 Agent/双重订阅竞态

> **Fixed in:** `fb0529c`（fix(42): WR-05 await _recreateAgent in createNewConversation）——`createNewConversation` 改 async 并 `await this._recreateAgent()`；同步在 `ipc-handlers.js` 的 `ai:create-conversation` 处理器补 `await`（否则返回对象内嵌 Promise 无法经 IPC 结构化克隆序列化）。逻辑一致性改动，建议人工复核一次「新建对话后立即发消息」路径。

**File:** `ai-manager.js:1766-1769`
**Issue:**
`createNewConversation` 同步调用 `this._recreateAgent()` 不等待（第 1769 行），而 42-04 自己在 `switchConversation` 里已论证并修复过同一问题：「this.agent 在动态 import 之后的微任务中才赋值，同步帧内恒为 null」。后果：
- 「新对话」后快速发送消息时，`prompt()` 的 Agent 保证守卫（第 829-840 行）发现 `this.agent` 为 null，会**再调一次** `_recreateAgent()`——两次并发重建各自 `new Agent()` 并 `_setupEventBroadcasting()`，后完成者覆盖 `this.agent`，先完成的 Agent 成为带活跃事件订阅的孤儿（未 abort、未退订），满足条件时其事件会灌进广播通道；
- 创建后立即 `getState()` 返回 `model: null`，依赖该状态的 UI 短时显示异常。

42-04 SUMMARY 将「保持现状」记为决策，但只论证了「无 unhandled rejection」，未覆盖双重建竞态。

**Fix:**
```js
// createNewConversation 改 async（调用链 ipc-handlers 'ai:create-conversation' 已是 async handler，
// renderer createNewConversation 也已 await）：
await this._recreateAgent();
```
若担心改动面，至少在 `_recreateAgent` 入口加单飞锁：`if (this._recreating) return this._recreating; this._recreating = (async () => { ... })().finally(() => this._recreating = null);`

### WR-06: 重命名行内编辑的 Escape 取消依赖「元素销毁不触发 blur」的浏览器行为，blur 处理器无条件提交；Enter 提交后 blur 还会重复发 IPC

**File:** `src/renderer.js:6964-6992`
**Issue:**
`submitRename` 同时挂在 Enter 与 blur 上，没有「已取消/已提交」状态位：
1. **Escape 取消不可靠**：Escape 处理器调 `renderConvList()` 销毁 input。项目自己的诊断文档（.planning/debug/conversation-rename-no-response.md）已标注「Chromium 中隐藏获得焦点的 input 会触发 blur」且该行为未在真实 Chromium 复核——若销毁（或未来改成隐藏）触发 blur，`submitRename` 会把用户想撤销的标题**照样提交**；
2. **Enter 后双重 IPC**：Enter → `submitRename()`（await IPC）→ `renderConvList()` 销毁 input → blur → `submitRename()` 再次判定 `newTitle !== currentTitle` 成立 → **重发一次 rename IPC**（幂等所以无数据损害，但每次改名都是双请求 + 双列表重刷）。

**Fix:**
```js
let settled = false;
const submitRename = async () => {
  if (settled) return;
  settled = true;
  const newTitle = input.value.trim();
  ...
  renderConvList();
};
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitRename(); }
  else if (e.key === 'Escape') { settled = true; renderConvList(); } // 先置位再销毁
});
input.addEventListener('blur', () => submitRename());
```

### WR-07: serializeToolData 截断采用「砍断 JSON 再拼引号尾巴」，被截断的列 100% 变成非法 JSON——「截断」实际退化为「整体丢弃」

**File:** `ai-conversations-manager.js:105-125`（第 117-122 行）
**Issue:**
超过 100KB 时返回 `jsonStr.substring(0, N) + '"...(truncated)"'`。除非截断点恰好落在顶层结构闭合处（几乎不可能），产物必然不是合法 JSON：读出侧 `safeJsonParse` 全部失败回退空值。于是设计意图「保留前 100KB + 标记」从未实现过——超长 tool_calls/tool_results/page_snapshots 的实际语义是**整列丢弃**，而且这个丢弃是 CR-01 配对断裂的成因之一。日志只在写入侧提醒，读出侧无任何「数据曾存在但不可读」的痕迹。

**Fix:**
截断后重新序列化为合法 JSON，例如只保留字符串值的前缀并加显式标记字段：
```js
if (jsonStr.length > TOOL_RESULT_TRUNCATE_SIZE) {
  return JSON.stringify({
    __truncated: true,
    originalLength: jsonStr.length,
    preview: jsonStr.slice(0, TOOL_RESULT_TRUNCATE_SIZE),
  });
}
```
读出侧识别 `__truncated` 标记即可拿到可用的 preview，配对元数据（toolCallId 等）也不会再因截断丢失。

## Info

### IN-01: getAgentMessages 读取不存在的 row.provider，恒为空串（死代码）

**File:** `ai-conversations-manager.js:627`
**Issue:** `provider: row.provider || ''`——`readMessageRows` 的 SELECT（第 296 行）不含 provider 列，messages 表也没有该列，表达式恒为 `''`。占位值本身无害，但死表达式会误导后续维护者以为行上有 provider 数据。
**Fix:** 删除该行或改为字面量 `provider: ''`，与 `model: ''` 占位风格一致。

### IN-02: switchConversation 后 conversationMeta 沿用目标对话的旧 model/provider，保存时把陈旧值写回 conversation 行

**File:** `ai-manager.js:1690-1694` 与 `1719-1728`
**Issue:** D-13 决策是「恢复对话用当前全局模型配置」——`_recreateAgent` 确实用的是 `activeModelId/activeProvider`，但 `conversationMeta` 却被赋成目标对话**存档的** model/provider；下次 `saveCurrentConversation` 又把这些旧值写回 conversation 行。结果：用新模型继续旧对话后，元数据永远显示旧模型，与实际使用记录不符。
**Fix:** switchConversation 里 `this.conversationMeta = { model: this.activeModelId, provider: this.activeProvider }`，与 Agent 实际配置同源。

### IN-03: token_total 列从未写入（D-12 元数据统计未落地），恒为 0

**File:** `ai-conversations-manager.js:62`（列定义）、`ai-manager.js:1719`（updates 无 token_total）
**Issue:** D-12 要求记录 token 消耗等元数据，但全代码库没有任何写入 `token_total` 的路径，agent_end 里可拿到的 usage 被丢弃。字段随 API 暴露给 renderer 却恒为 0，属未完成功能的死列。
**Fix:** 在 agent_end 事件里从最后一条 assistant 消息的 usage 累加并经 updateConversation 写入；或明确移除该列并在 D-12 标注 deferred。

### IN-04: 删除确认 dialog 无 close/cancel 事件监听，Escape 关闭后 dataset 残留

**File:** `src/renderer.js:7022-7029`、`src/index.html:935`
**Issue:** `closeDeleteConfirm` 只挂在取消/删除按钮上；原生 Escape 关闭（dialog cancel→close）不经过它，`dataset.conversationId` 残留。当前唯一打开路径 `showDeleteConfirm` 总会先覆写 dataset，故无实害，但这是对「dataset 结构化传参」模式（G-42-6 修复核心）的防御性缺口——未来新增任何打开路径都会继承脏目标。
**Fix:** 初始化时补 `elements.aiConvDeleteDialog.addEventListener('close', () => elements.aiConvDeleteDialog.removeAttribute('data-conversation-id'))`，closeDeleteConfirm 里的手动清理保留作双保险。

### IN-05: IPC 入参校验小缺口——rename 未限制标题长度，get-conversations 未校验 limit 类型

**File:** `ipc-handlers.js:1817-1829`（rename）、`ipc-handlers.js:1755-1761`（get-conversations）
**Issue:** `ai:rename-conversation` 只校验非空字符串，不限制长度也不 trim——超长标题原样入库（renderer 显示层截 30 字符，库内与 `title` tooltip 不设防）；`ai:get-conversations` 把 `limit` 原样透传给 better-sqlite3 的 `LIMIT ?`，非数字绑定抛 TypeError（仅受信 renderer 可达，故只为 Info）。
**Fix:** rename 处 `newTitle = newTitle.trim(); if (!newTitle || newTitle.length > 200) throw ...`；get-conversations 处 `const n = Number.isInteger(limit) && limit > 0 ? limit : 50`。

---

_Reviewed: 2026-09-01T15:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

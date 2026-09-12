---
phase: 48-skill-name
reviewed: 2026-09-12T06:37:30Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - AGENTS.md
  - ai-manager.js
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - ipc-handlers.js
  - src/index.html
  - src/preload.js
  - src/renderer.js
  - src/skill-picker-model.js
  - src/styles/main.css
  - tests/test-ai-skills.js
  - tests/test-skill-picker-model.js
findings:
  critical: 4
  warning: 4
  info: 3
  total: 11
status: issues_found
highest_severity: critical
---

# Phase 48: Code Review Report

**Reviewed:** 2026-09-12
**Depth:** standard
**Files Reviewed:** 12（7 源码 + 2 文档 + 1 构建/样式 + 2 测试）
**Baseline used for diff:** `23e5144e1f78c300f3893f622f27adf5b3fccc63^`（`git diff --stat` 源码侧：ai-manager.js +521 / renderer.js +580 / ai-skills-manager.js +164 / skill-picker-model.js +358 / ipc-handlers.js +61 / preload.js +14 / main.css +202 / index.html +4）
**Status:** issues_found（**4 条 Critical**；最高严重度 Critical）

## Summary

本阶段交付的是 `/skill:name` 显式调用端到端链路（解析 → 调用瞬间实时读盘 → `<skill>` 块注入 → 重载还原）、面板收窄投影与三档 tier、`/` 面板交互面、`read` 卡片技能化。两套测试实跑全绿（`node tests/test-ai-skills.js` 129/129；`node --test tests/test-skill-picker-model.js` 93/93）。

**先说做对的部分（对抗式核验后仍然成立）**：①「解析规则只此一份」是真的 —— `src/skill-picker-model.js` 双模式导出，main 侧 `parseSkillInvocationText` 直接委派同一 api 对象，`extractArgs` 的 token 取值法确实消掉了旧式的「按名长切片吞 args 开头」（P-48-01）；②`buildSkillInvocationBlock` 委托 SDK `formatSkillInvocation`、`resolveSkillBubbleArgs` 的两趟扫描顺序（先非空候选后空候选）在 `48-RESEARCH` 列出的病态输入上经推演确实给出正确 args，且重载装饰用例用**真实** `formatSkillInvocation` 构造输入（SDK 改文案会红，不是自证）；③`⑦ promptOmitted` 的 `eligible.slice(kept.length)` 与贪心 `break` 的「kept 恒为 eligible 前缀」不变式一致，且未进 computeDigest（digest 只取 promptBlock，计数注释成立）；④`read` 标记只在 `tool_execution_start`（唯一带 `params` 的同步点）打、重载链路复用同一 `_resolveSkillMarker`、`t.params` 在真实存储形状下是对象（`ai-conversations-manager.js:225/585`）—— 这三条核验通过，不是「看起来对」；⑤路径判定用 `path.resolve` 全等而非目录前缀猜，`_resolveSkillMarker` 的边界（非 `read` / 非 `SKILL.md` / 非法参数 → null）零回归；⑥`ipc-handlers.js` 两处 `ai:prompt*` JSDoc 与 `preload.js` 的 `ai.getSkills/refreshSkills` 嵌套层级都正确（`ai:` 子对象内）。

**但本阶段的核心承诺有两处没关上**：一是「调用那一刻实时读盘」（用户 2026-09-11 硬约束）在 **renderer 侧被一个可能陈旧的快照挡住**（CR-04），二是**面板把技能名当属性值拼进 HTML**，而 `escapeHtml` 不转义引号（CR-01，可被 AI 自建内容驱动）。另有一处「流式中调用技能」的时序洞把新回复整条吃掉（CR-03），以及一处让面板列出的技能**必然无法调用**的判定错误（CR-02）。

---

## Critical Issues

### CR-01: 技能名经 `escapeHtml` 拼进 HTML 属性 → 属性逃逸注入（renderer XSS）

**File:** `src/renderer.js:10340`（同类：`10333`、`10344`、辅助函数 `11262-11266`）
**Issue:**
`renderSlashPickerList` 用字符串拼 HTML，并把**磁盘来源**的技能名插进了**属性值**位置：

```js
const rowTitle = item.kind === 'skill'
  ? ' title="' + escapeHtml('/skill:' + item.name + ' 可显式调用') + '"'
  : '';
```

而 `escapeHtml` 的实现是 `div.textContent = text; return div.innerHTML;` —— 这条路径只转义 `& < >`，**不转义 `"` / `'`**。技能名不是可信输入，且**字符集不受约束**：

- 名称权威是**目录名**（`ai-skills-manager.enforceDirNameAuthority`，46 D-08），SDK 的 `validateName` 只产 warning、**不拒绝**（`dist/harness/skills.js:220-236/237-251`），Realm 也刻意不丢（注释明确「命名不规范在 GitHub 导入中很常见」）。
- 目录名可以合法包含 `"`、`>`、空格。写入口在沙箱内对 AI 是开放的（`write` / `bash` 都自动执行、免确认），且产品文档明说当前管理技能的方式就是**直接操作两个技能目录下的文件**。

实测复核（临时沙箱，`node /tmp/probe-xss.js`）：

```
投影里的 name = ["pwn\" data-x=\"y"]
面板生成的 rowTitle 属性片段 =>
 title="/skill:pwn" data-x="y 可显式调用"
```

即 `"` 直接闭合 `title` 属性、后续内容成为新属性。把 payload 换成 `onmouseover="…"` 就是事件处理器注入（注入体不需要尖括号，`<`/`>` 的转义拦不住）。利用链成立且不需要用户做任何异常操作：网页提示注入 → AI 用 `write` 在 `managed-skills/` 下建一个带引号的技能目录 → 用户按 `/` 打开面板（`rawFilter` 为空时全部命中）→ 鼠标划过该行 → 注入代码在**主窗口 renderer** 执行，而该上下文持有 `window.realmAPI` 全量 IPC（设置、文件、Cookie、附件、确认卡片链路）。这是本阶段新增的**新攻击面**（同样模式的既有落点在 download / media 段，但那些数据不来自「AI 可自建」的目录）。

**Fix:**
属性上下文必须用引号感知的转义，或干脆改 DOM API（阶段自己在 `renderToolCard`/`renderAISkillPill` 已采用后者）：

```js
// 方案 A：补一个属性专用转义
function escapeAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// rowTitle / badge title / status title 三处改用它（文本上下文继续用 escapeHtml）
```
```js
// 方案 B（更彻底）：行改 DOM 构建，永不拼属性字符串
const row = document.createElement('div');
row.className = rowClasses.join(' ');
row.dataset.index = String(index);
row.title = '/skill:' + item.name + ' 可显式调用';   // setAttribute 天然安全
```

---

### CR-02: `frontmatter name ≠ 目录名` 的技能**必然** `not_found`，但面板把它列为可调用

**File:** `ai-skills-manager.js:806-811`（`readSkillForInvocation`）
**Issue:**
缓存层以**目录名**为权威（`enforceDirNameAuthority` 就地重写 `skill.name = dirName`，并保留该技能），但实时读盘走的是 SDK 原生 `loadSkills`，SDK 的名称是 `frontmatterName || parentDirName`（`dist/harness/skills.js:218-219`），**不接受 Realm 的重写**：

```js
const fresh = skills.find((s) => s.name === name) || skills[0];   // ← 想兜住 name 不一致
if (!fresh || typeof fresh.content !== 'string' || fresh.content.trim() === '') { ... }
if (fresh.name !== name) return { ok: false, reason: 'not_found', name };  // ← 又把兜底作废
```

于是「SKILL.md 里写了别的 name」的技能在面板上以目录名出现、标为可选（`docs/product/ai-skills.md` §10.4 表格写「正常 → 能显式调用 ✅」），但用户手打 `/skill:<目录名>` 或点面板行都会被判「未找到技能」，**输入框同时被清空**。实测复核（`node /tmp/probe-skill-name.js`）：

```
目录布局：skills/evil/SKILL.md 内容含 `name: find-skills`
cache names: [ { name: 'evil', src: 'user', filePath: '.../skills/evil/SKILL.md' } ]
ui names  : [ 'evil' ]          ← 面板就是这么显示的
面板认为可显式调用的名字 = evil
readSkillForInvocation 结果 = {"ok":false,"reason":"not_found","name":"evil"}
```

这不是理论边界：D-08 的立论本身就是「GitHub 导入里 name 与目录名不一致很常见」；本阶段把「显式调用」做成了该形态技能的唯一可用路径（46 D-08/D-12 语境），却把它判成「不存在」。测试覆盖不到——`writeSkill` 恒写 `name: <目录名>`（`tests/test-ai-skills.js:49-55`），`fresh.name !== name` 那条用例只造了「目录被换成别的技能」，两者在实现里不可区分。

**Fix:**
判据应以**路径**为准（目录名权威的同一口径），不要比较 SDK 的 name；「目录被换成别的技能」用路径不等来识别：

```js
// 命中判据：SDK 读回来的就是缓存里那个文件（同一目录、同一 SKILL.md）
const expectedDir = path.resolve(path.dirname(entry.skill.filePath));
const fresh = skills.find((s) => path.resolve(path.dirname(s.filePath || '')) === expectedDir) || null;
if (!fresh) return { ok: false, reason: 'not_found', name };
if (typeof fresh.content !== 'string' || fresh.content.trim() === '') {
  return { ok: false, reason: 'not_found', name };
}
// 注入用的 name 仍取目录名（D-08）——不要用 fresh.name
return { ok: true, skill: { ...fresh, name }, source: entry.source };
```
并补一条 name ≠ 目录名 的用例（现有 helper 恒写同名，等于永久盲区）。

---

### CR-03: 流式回复中发起技能调用 → 新气泡被写成「*用户已取消*」且整条回复的流被丢弃

**File:** `src/renderer.js:8736-8740`（中止 + 就地复位）、`src/renderer.js:9315-9331`（取消分支按 `state.aiCurrentMessageId` 归属）
**Issue:**
本阶段按 D-08 明确支持「流式回复进行中调用技能」，但复用 `abortAIIfStreaming()` 后**没有把取消标记（`state.aiCancelledByUser`）与新消息隔离开**，而被中止那一轮的迟到事件会按「当前消息 id」归属：

1. `abortAIIfStreaming()`（`9046-9055`）置 `state.aiCancelledByUser = true`，abort 成功后**不回滚**该标记；技能路径随后就地复位 `aiStreaming=false` / `aiCurrentMessageId=null`（`8736-8740`）——注释已经意识到「取消事件是异步广播的」，但只复位了流式状态，没处理取消标记；
2. `ai:abort` 处理器同步返回（`ipc-handlers.js:1840-1846` 只调 `aiManager.abort()` 后立即 return），因此 renderer 的 `await` 会先恢复，**同步**段把 `state.aiCurrentMessageId` 指向新气泡并发起新 `ai.prompt`；
3. 被中止那轮的 unwinding 之后才到达：SDK `handleRunFailure` 发 `turn_end` + `agent_end`（`dist/agent.js:349-365`）；`turn_end` 因失败消息正文为空被 `ai-manager.js:1724-1731` 静默吞掉（不发事件），而 `agent_end` 带 `errorMessage` → `ai-manager.js:1743-1748` 发 `'error'`；
4. renderer 收到该 error 时 `aiCancelledByUser === true` → 走取消分支：把 `state.aiCurrentMessageId`（**已经是新气泡**）的内容改成 `'*用户已取消*'`，并置 `aiStreaming=false`、`aiCurrentMessageId=null`；
5. 新 run 随后的 `message_update`（`9244-9246`）与 `tool_execution_update`（`9258-9260`）都按 `m.id === state.aiCurrentMessageId` 查找，此时恒为 `null` → **全部丢弃**，新回复在界面上消失（停止按钮也提前回退成发送按钮）。

净效果：在 AI 正在回复时点技能行（面板此时可正常操作），用户看到的是新气泡被标成「用户已取消」、且这一轮技能调用没有可见输出。修复前该路径无法用「测试全绿」证明可用——测试面完全没有涉及 abort × 新消息的时序。

**Fix:**
把「被取消的那条消息」显式记下来，取消分支只作用于它；或让 `ai:abort` 等 run 结算后再返回（`ipc-handlers.js` / `ai-manager.abort()` 侧 await 一次 run 的 settled promise），使渲染端的新消息严格发生在迟到事件之后：

```js
// abortAIIfStreaming()：记住被取消的锚点
state.aiCancelledByUser = true;
state.aiCancelledMessageId = state.aiCurrentMessageId;   // 新增
await window.realmAPI.ai.abort();

// handleAIStream 的 error 分支：只认锚点，不认「当前」
if (state.aiCancelledByUser) {
  state.aiCancelledByUser = false;
  const cancelIdx = state.aiMessages.findIndex(
    m => m.role === 'assistant' && m.id === state.aiCancelledMessageId);
  state.aiCancelledMessageId = null;
  ...
}
```
（`handleStopAI`（`8403-8413`）同样要在取消落点后清空该锚点，保持停止按钮语义不变。）

---

### CR-04: renderer 预检用**可能陈旧**的快照否决调用，直接违反「调用那一刻实时读盘」硬约束

**File:** `src/renderer.js:8719-8732`（预检）、`src/renderer.js:4399-4403`（`skills:changed` 监听）、`src/renderer.js:9015-9028`（快照拉取）
**Issue:**
`state.aiSkills` 只在三处更新：启动一次性 `pullAiSkillsSnapshot()`、面板打开时的 `refreshSkills()` 回包、以及**面板打开期间**的 `skills:changed` 广播：

```js
window.realmAPI.onIpcMessage('skills:changed', () => {
  if (!state.slashPickerOpen) return;   // ← 面板关闭时快照永不更新
  pullAiSkillsSnapshot();
});
```

而发送路径把这份快照当**否决依据**：

```js
const known = (Array.isArray(state.aiSkills) ? state.aiSkills : []).find(s => s.name === ref.name);
if (!known) { elements.aiInput.value = ''; pushSystemNote('未找到技能「' + ref.name + '」，输入 / 查看可用技能'); return; }
```

于是「运行期新增技能 + 未打开过 `/` 面板」这一完全正常的使用序列会走进死路：AI 自建技能（Phase 49 的正路：`write` 写好 `managed-skills/<name>/SKILL.md`，主进程 idle 边界 `syncAgentSystemPrompt()` 重扫并广播 `skills:changed`）→ 广播因面板关闭被直接丢弃 → 用户手打 `/skill:newname` → 本地判「未找到」→ **消息被吞且输入框被清空**，主进程根本没有机会做它唯一被要求的动作（实时读盘）。手工往 `agent-workspace/skills/` 加目录同理。这与「显式技能调用不得依赖 prompt 快照或历史回答」（用户 2026-09-11 定，D-05/D-19）直接冲突——`readSkillForInvocation` 的实时读盘被前置的一道快照闸门挡在门外。注释里对启动窗口的自我提醒（「否则从未打开过 `/` 面板的用户手打 /skill: 会被预检误判」）说明作者知道这个闸门会误判，但只补了启动一次性预热。

**Fix（二选一，前者更贴合既有 D-13 设计）：**
```js
// A. 快照未命中不再本地否决 —— 照常发主进程，由 skillError 走既有回滚流程（D-13 推论）
if (ref && ref.kind === 'skill') {
  skillRef = ref;                       // 删掉 known/!known/disabled 三段本地分支
  ...
}
```
```js
// B. 保留预检但让它不再陈旧：任何 skills:changed 都重拉快照（不触发刷新，无自激回路）
window.realmAPI.onIpcMessage('skills:changed', () => { pullAiSkillsSnapshot(); });
```
（若选 B，`disabled` 的本地预检同样要用最新快照，否则「另一窗口刚启用」也会被误拒。）

---

## Warnings

### WR-01: `SKILL_TIER_TITLES` 与 `TIER_BADGE[*].title` 逐字重复，破坏单源并让文档口径失真

**File:** `src/renderer.js:8876-8889` vs `src/skill-picker-model.js:324-340`
**Issue:** 三档 title 文案在两边各写一份（`'用户技能（agent-workspace/skills/），同名时优先于内置与托管'` 等逐字相同）。`docs/product/ai-skills.md` §10.5 明确写「面板行与 `read` 工具卡片**共用同一张查表**…不存在第二份徽标实现」——用户气泡 pill 走的却是这份本地副本（`skillTierTitle`），文档口径与实现不符；后续改一处文案必然漂移。
**Fix:**
```js
function skillTierTitle(tier) {
  const badge = window.SkillPickerModel.TIER_BADGE[tier];
  return badge ? badge.title : '';
}
```
删掉 `SKILL_TIER_TITLES` 后同步核对文档 §10.5 的措辞（pill 只取 `title`，不渲染彩色徽标，仍属同一查表）。

### WR-02: `_resolveSkillInvocation` 未包 try/catch → 抛错即永久锁死 AI（`isProcessing` 不复位）

**File:** `ai-manager.js:1046`、`ai-manager.js:1174`
**Issue:** 该调用位于 `this.isProcessing = true` 之后、重试 `try` 之前，且内部含两处未兜底的抛出点：动态 `import('@earendil-works/pi-agent-core')`（ESM 解析失败）与 `buildSkillInvocationBlock` 的 `TypeError`（SDK 导出名变化）。任一抛错都会穿透 `prompt()` / `promptWithContext()` 直达 IPC（renderer 只打日志），而 `isProcessing` 保持 `true` —— 此后所有消息都被 `'AI 正在处理上一条消息，请稍候再试'` 拒绝，直到重启或重建 Agent。同文件其余失败分支都成对复位 `isProcessing`，此处是唯一的缺口。
**Fix:**
```js
let resolved;
try {
  resolved = await this._resolveSkillInvocation(message);
} catch (err) {
  this.isProcessing = false;
  this._sendEventsBatch([{ type: 'error', message: '技能解析失败：' + err.message, timestamp: Date.now() }]);
  return { conversationId: this.currentConversationId || null, skillInvocation: null };
}
```

### WR-03: 两条重发路径的 `skillError` 分支留下空气泡（与发送路径的清理不一致）

**File:** `src/renderer.js:9911-9917`（`regenerateMessage`）、`src/renderer.js:9987-9993`（`showAIError` 的重试）
**Issue:** `handleSendAIMessage` 在技能被拒时调用 `removeSkillFailureBubbles(userMsgId)`，并把「不留半截历史」（D-13 推论）落实到位；两条重发路径只 `pushSystemNote` 就 return，先前 push 的 `{role:'assistant', content:''}` 占位会**继续以空气泡形式渲染**（`renderAIMessages` 不跳过空 assistant 消息；`error` 事件分支之所以能删掉它，正是显式 splice）。同一条失败语义在三个入口产出三种界面状态。
**Fix:** 重发路径在 `pushSystemNote` 前复用同一清理（把 `removeSkillFailureBubbles` 泛化为「移除指定 userId + 紧随的空 assistant 占位」，或在两处按 `aiMsgId` 直接 splice）。

### WR-04: `_resolveSkillMarker` 未对齐 SDK 的路径归一化，`@` 前缀 / Unicode 空格形态会静默退化为普通卡片

**File:** `ai-manager.js:1612-1618`
**Issue:** 判定只做 `path.isAbsolute + path.resolve`；而 SDK 侧实际读取走 `normalizeToolPath`（去掉前导 `@`、把 `[\u00A0\u2000-\u200A\u202F\u205F\u3000]` 折成普通空格）+ `resolveReadToolPath` 的多变体探测（`dist/harness/tools/path-utils.js:1-24`）。因此模型给出 `@/…/SKILL.md` 或含 Unicode 空格的路径时，**正文确实被读到**、卡片却退化为普通 `read`，两条链路判据不一致（文档已披露为可靠性边界，但披露的只是 NFD/窄空格/弯引号，未覆盖 `@` 前缀与 Unicode 空格折叠这两种 SDK 明确支持的常见形态）。
**Fix:** 在解析前做与 SDK 同源的词法归一化（一行级成本）：
```js
const raw = args.path.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ').replace(/^@/, '');
const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
```

---

## Info

### IN-01: `resolveSkillBubbleArgs` 用 `indexOf` 定位 provenance，与自身注释的锚定理由相矛盾

**File:** `ai-manager.js:6187`
**Issue:** 注释写「锚点必须挂在 provenance 行上，才能天然排除技能块体中的同名文本」，实现却取**首次**出现：`const p = enhancedContent.indexOf(provenance)`。技能正文里若出现同一句（Realm 自身相关技能/文档被导入时可能），锚点落到正文内部，args 还原出错。属病态输入，但修正成本为零。
**Fix:** 从块尾之后起锚（`parseStoredSkillInvocation` 已算出 `closeIdx`），或改为 `lastIndexOf` + 块尾边界校验后再传参。

### IN-02: `preload.js` 的 `ai.prompt*` JSDoc 未同步 48 起的新返回契约

**File:** `src/preload.js:976-991`
**Issue:** 仍写 `@returns {Promise<{success: boolean, error?: string}>}`；实际返回 `{success, conversationId, skillInvocation, skillError}`（`ipc-handlers.js:1686-1695` / `1705-1733` 已更新，preload 漏改）。renderer 依赖 `result.conversationId` / `result.skillInvocation` / `result.skillError`，文档面滞后会误导下一个改动者。
**Fix:** 同步两处 JSDoc（可直接引用 `ipc-handlers.js` 的新契约描述）。

### IN-03: 面板 `activeIndex` 归 `-1` 后不重渲染，DOM 高亮与 state 短暂背离

**File:** `src/renderer.js:10078-10081`
**Issue:** 全部行不可选中时置 `activeIndex = -1` 并直接 `return`，未重渲染 —— DOM 上仍留着上一行的 `.active` 高亮，而 state 已是「无高亮」（Enter 会回落未知命令路径，故只是视觉不一致）。
**Fix:** 在同分支补一次 `renderSlashPickerList()`（此时 `isActive` 判据 `selectable === true && index === -1` 恒假，高亮自然清空）。

---

### IN-04: 弱模型下「模型自发匹配技能」退化为把技能名当**工具**调用（实测观测，非本阶段代码缺陷）

**来源:** `/gsd-verify-work 48` test 8 自动驱动（2026-09-12），两次独立观测一致。
**Issue（现象）:** 给一个命中某技能 `description` 的任务（不手打 `/skill:`），模型**没有** `read` 该技能的 `SKILL.md`，而是把技能名当工具调用 —— 卡片标题 `demo`（未技能化）、参数 `{ "text": … }`、结果 `Tool demo not found`、状态`失败`；模型自述「未找到名为 "demo" 的技能工具」。追问「技能与工具有什么区别」时答「需通过 `/skill:名字` 显式调用才能生效」，与 D-18 口径不符。
**归因（源码直读）:** 不是 Realm 的接线问题。`buildSystemPrompt()`（`ai-manager.js:599-604`）= base + `buildSkillsPrompt()`，后者即 SDK `formatSkillsForSystemPrompt` 的产物；该模板（`node_modules/@earendil-works/pi-agent-core/dist/harness/system-prompt.js`）已明确写下「Read the full skill file when the task matches its description.」并逐条给出 `<location>` 绝对路径。故指令存在且正确，是模型（ModelScope `Qwen/Qwen3-8B`）不遵守。
**影响:** 弱模型用户会看到一张以技能名命名的**失败工具卡片**，技能自动匹配对其不可用；显式 `/skill:name` 路径不受影响。
**为何不计缺陷:** 由 SDK 侧提示词模板承载，Realm 无可控代码；本阶段交付物（技能化卡片的可见性 + 重载还原）已由 test 8 ① 端到端验证通过。
**建议去向:** 留给 Phase 50/51 的技能 UX（例如：把技能名注册为一个显式报错的同名工具、或在 Realm 侧追加一句强化指令「技能只能经 `read` + `location` 读取，不存在同名工具」）。

---

## 备注（复核过的、不构成 finding 的点）

- `ai:prompt` / `ai:prompt-with-context` 的返回值从 `string|null` 改为对象契约：全仓（排除 `.claude/worktrees/` 历史副本）仅 `ipc-handlers.js` 两处调用，均已同步；`prompt*()` 的所有 return 路径都返回对象，不存在 `res.conversationId` 读 undefined 的入口。
- `escapeHtml` 的属性上下文缺陷是**既有模式**（downloads `14178/14210`、media `11214` 同样把文件名/URL 拼进属性），本阶段新增的是「数据源可被 AI 自建内容驱动」这一新面，故 CR-01 按 Critical 记、但修复时建议连同类落点一起换成属性专用转义或 DOM API。
- `perf` 面（`getSeededSkillNamesSafe()` 每次调用都 `readdirSync` + 逐技能 `existsSync`（`builtin-skills-seeder.js:92-107`），而 `_resolveSkillMarker` 按**每条** toolExecution、`_skillTierByLocation` 按**每条** user 行各调一次；`matchSkillByPath` 又对每条缓存条目做一次 `path.resolve`）属「打开一条长对话做 O(消息数×技能数) 次同步 IO」的冗余计算，按 v1 范围不作为缺陷计分 —— 但它是主进程同步阻塞，且结果只依赖内存缓存，建议在 `getConversationMessages` 整批装饰时算一次向下传参。

---

## Accepted Tech Debt（阶段 48 UAT 收尾裁决）

本节记录 `/gsd-verify-work 48` 逐条裁决后**确认延后**的 Critical / Warning。裁决前提：48 不进正式版发布（用户 2026-09-12 确认「暂时不发版」）。每条都带**接手触发点**，不依赖任何自动化门禁重新发现。

### TD-48-01 ← CR-01 属性逃逸注入（延后）

- **裁决：** 延后，不进本阶段修复。2026-09-12 UAT test 1。
- **接手触发点：** Phase 49 开工前**第一条**（`manage_skill` 落地前）。Phase 49 会让 AI 常规化地创建技能目录，扩面后再补代价更高。

> ⚠️ **以下两条是对本报告 CR-01 原文的实测更正**（2026-09-12 用 playwright `_electron` 驱动真实 dev 应用取得）。
> CR-01 原文「把 payload 换成 `onmouseover="…"` 就是事件处理器注入」「注入代码在主窗口 renderer 执行，该上下文持有 `window.realmAPI` 全量 IPC」**不成立**，勿据此定级。

- **✅ 注入成立（实测）：** 在 `managed-skills/` 下建目录名 `pwn" onmouseover="document.documentElement.dataset.pwned=1" data-x="y`，打开 `/` 面板后该行**真实 DOM 属性**为：
  `class` / `data-index` / `title="/skill:pwn"`（被引号截断）/ `onmouseover` / `data-x="y 可显式调用"` —— 即 `escapeHtml` 不转义引号的属性逃逸**确实发生**，注入体成为真实属性。
- **❌ 代码执行被 CSP 拦掉（实测，决定性）：** `src/index.html:8-9` 有 CSP `script-src 'self'`（无 `unsafe-inline`），内联事件处理器**不被编译**。同一文档内对照实测：
  `innerHTML` 注入 `onmouseover` → 属性在、`el.onmouseover === null`、真实 `mouseover` 派发后计数器未置位（`null`）；
  程序化赋值 `el.onmouseover = fn` → `typeof === 'function'` 且正常触发（对照组）。
  故 `row.onmouseover` 为 `null` 是真值，不是「已编译」。
- **残余真实影响（降级为 minor 级缺陷，非 blocker）：** ① `style` 属性注入**可行**（CSP `style-src 'self' 'unsafe-inline'`）→ CSS 注入 / UI 重绘伪装；② 任意属性注入污染 DOM 结构；③ **潜在 XSS**：一旦 CSP 放宽（加 `unsafe-inline`）或该模板被复用到无 CSP 上下文，即刻升级为可执行。安全性归因应改为「纵深防御兜住了，但转义缺陷仍在」。
- **附带更正：`AGENTS.md` 的「主窗口（`file://` 加载，无 CSP）」表述有误** —— 主窗口**有** CSP（`src/index.html:8`），只是 `style-src` 含 `unsafe-inline` 使内联 style 可用（弹框居中那节的结论因此仍成立，但理由不该是「无 CSP」）。
- **⚠ 不要指望 secure-phase 兜住：** `48-01-PLAN.md:432` 的 T-48-03（Tampering / high / mitigate）声明的缓解措施正是「`title` 一律经 `escapeHtml()`」——即失效的那个机制。secure-phase 的短路规则会读成已缓解。
- **可达性**（与上面区分）：`managed-skills/` 落在硬沙箱 root 内（`agent-workspace.js:114`），AI 的 `write`/`bash` 免确认自动执行；`enforceDirNameAuthority`（`ai-skills-manager.js:329`）刻意**不校验字符集**并保留不规范名；`toUISkillEntry`（`:707`）对 `name` 零加工直送面板 —— 所以**输入侧**确实可达且无需人工操作，只是被 CSP 挡在「执行」这一步。
- **修复口径（下次开工直接照做，约 10 行）：** 新增引号感知的 `escapeAttr`，替换 `src/renderer.js:10332` / `:10340` / `:10343` 三处属性上下文（文本上下文继续用 `escapeHtml`）；或该行改 DOM API（`setAttribute` 天然安全，阶段自身在 `renderAISkillPill` 已用此模式）。**修它的理由已从「堵 XSS」变为「消除 latent XSS + 消除 CSS 注入面 + 不再依赖 CSP 单点兜底」。**
- **取舍说明（为什么只修这三处不算半吊子）：** 同类落点 downloads（`14178/14210`）、media（`11214`）是老 bug 且数据源**不是 AI 可自建**，性质不同；本条的独特性在于「数据源可由 AI 自建」。同类落点的统一整改属独立议题。
- **爆炸半径已核实：** 全仓仅 `48-VERIFICATION.md` 的 `covered_files` 含 `src/renderer.js`，修它不连累 44–47 的验证指纹。

---

_Reviewed: 2026-09-12T06:37:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

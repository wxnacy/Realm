---
phase: 48-skill-name
reviewed: 2026-09-12T12:14:42Z
review_kind: incremental-gap-closure-re-review
baseline: f5a770d922f6a02aced432ce3a4faef9b57d15a6（上一轮 48-REVIEW 的 diff_base）
depth: standard
files_reviewed: 9
files_reviewed_list:
  - AGENTS.md
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - src/ai-cancel-state.js
  - src/index.html
  - src/renderer.js
  - tests/test-ai-cancel-state.js
  - tests/test-ai-skills.js
  - tests/test-skill-picker-model.js
findings:
  critical: 1
  warning: 6
  info: 7
  total: 14
status: issues_found
highest_severity: critical
---

# Phase 48: Code Review Report（**增量复审 · Gap 闭合轮**）

**Reviewed:** 2026-09-12T12:14:42Z
**Depth:** standard
**Files Reviewed:** 9（3 源码：`ai-skills-manager.js` / `src/renderer.js` / `src/ai-cancel-state.js`（新增）+ 1 页面 `src/index.html` + 3 测试 + 1 产品文档 + 1 项目说明 `AGENTS.md`）
**Baseline:** `f5a770d922f6a02aced432ce3a4faef9b57d15a6`（上一轮审查的 commit）
**Status:** issues_found（**1 条 Critical**；上一轮 CR-02 / CR-03 / CR-04 全部**已闭合**，CR-01 维持用户 2026-09-12 已裁决的 `TD-48-01`，不重复计分）
**测试实跑（本轮复核，非采信报告）:** `node --test tests/test-ai-cancel-state.js` 14/14 ✅ · `node tests/test-ai-skills.js` 132/132 ✅ · `node --test tests/test-skill-picker-model.js` 95/95 ✅

## Summary

本轮 diff 是 gap 闭合轮（G-48-2 名称权威 / G-48-3 移除本地否决 + 广播无条件重拉 / G-48-4 取消归属 / G-48-6 回填后定向重绘），共 9 个文件 +792/-156。

**先说做对的部分（逐条核证后仍然成立）**：

1. **G-48-2 的同一性判据改对了口径**（`ai-skills-manager.js:820-833`）：判据从 SDK `Skill.name`（= `frontmatterName || parentDirName`，正是**合法会不一致**的那个字段）改为**目录路径全等**，与 `enforceDirNameAuthority` 同口径；且把 `skills.find(...) || skills[0]` 的兜底连同作废它的 `fresh.name !== name` 一起删掉，返回前把 `name` 重写为入参目录名。我用独立探针复跑「目录 `evil` + `frontmatter name: find-skills`」，返回 `{ok:true, name:'evil'}`，注入块 `name="evil"` / `location="…/evil/SKILL.md"`，冒名 name 不进块 —— 与 46 D-08 一致，CR-02 真闭合（判据变换本身没有引入新的逃逸口：入参 `name` 只在缓存里做**全等**查找，不做路径拼接）。
2. **G-48-4 的归属解算抽成纯函数是正确的一步**：`src/ai-cancel-state.js` 零依赖、双模式导出，`resetRunState` **只由锚点等式决定、与消息列表形态无关**（`ai-cancel-state.js:46-60`），这恰好保住了「用户点停止」的既有语义（`cancelledId === currentId` → 复位 + 气泡标取消），同时把 UAT test 4 的实测序列（锚点=旧 id / 当前=新 id → 目标为旧条、**不复位**）变成表驱动用例。renderer 的取消分支也**先解算再复位**（`renderer.js:9387-9413`），顺序正确。
3. **G-48-3 两条口径都落地了**：本地否决整段删除（`renderer.js:8698-8707`，`state.aiSkills` 在发送路径上零出现），且 `skills:changed` 改为无条件重拉（`renderer.js:4405-4407`）。**自激回路核查通过**：`pullAiSkillsSnapshot`（`renderer.js:9081-9094`）只调 `ai:get-skills` → `aiManager.getSkillsForUI()`（`ipc-handlers.js:1747-1753`）→ `getSkillsForUI` 是**同步零 IO 投影**（`ai-skills-manager.js:761-767`，全仓唯一广播点是 `ai-manager.js:2786`，只在真正改写 prompt 时发），因此「广播 → 重拉 → 再广播」不成立。
4. **G-48-6 的「单源构建」是真的单源**：`renderAIMessages` 的 `isUser` 分支整段替换为 `buildUserMessageContent(msg)`（`renderer.js:8052-8055`），`refreshUserMessageBubble` 复用同一函数，测试断言了 `renderAIMessages` 体内**不得**再出现 `renderAISkillPill(` / `renderSkillContentBox(`。属性逃逸面**没有变宽**：单源构建全部走 DOM API + `textContent`（`renderer.js:8890-8916`、`8962-9010`），`pill.title = …` 是 property 赋值，不经 `innerHTML`；`ai-cancel-state.js` 的 `<script>` 标签顺序正确（`src/index.html:1022-1024`，先于 `renderer.js`）。
5. `state.aiCancelledMessageId` 的**维护成对性**无缺口：置位点只有 `abortAIIfStreaming`（`9115-9118`）与 `handleStopAI`（`8383-8385`）两处，且两处都与 `aiCancelledByUser` 同置；清理点在两处 catch（`8391-8392` / `9122-9123`）、取消分支（`9397-9398`）、两处对话切换（`7214-7215` / `7252-7253`）—— 不存在「只清锚点不清 flag」或反之。

**但本轮仍有 1 条必须处置的 Critical**：取消归属的**生命周期**没闭合 —— `aiCancelledByUser` 只在「迟到的 error 事件」里被消费，**任何一处正常结算都不清理它**；而 `abort()` 打在已结算的 run 上是**静默 no-op**（SDK `agent.js:202-204` 的 `this.activeRun?.…`）。一旦出现「abort 无事件」的窄竞态，这对标记就会**跨轮存活**，把**下一轮的真实错误**当成取消消费掉；又因为此时 `cancelledId !== currentId`，`resetRunState` 为 false → 轮次状态**永不复位**（CR-05：UI 卡在「流式中」、错误静默、旧回复正文被覆盖）。这是本轮修复留下的**同源残余**，不是新功能面。

另有 6 条 Warning（其中 2 条为本轮新增：`WR-05` 是 `G-48-6` 的「立即」口径与实现时机不符、会**原样复现 UAT 探针的失败半边**；`WR-06` 是**实时读盘路径绕过了 64 KiB 字节闸**，已用探针决定性复现），7 条 Info。

---

## Narrative Findings (AI reviewer)

### A. 上一轮 findings 复核台账（Gap 闭合结果）

| id | 上一轮定级 | 本轮结论 | 判据（本轮按代码现状核，不采信计划自述） |
|----|-----------|---------|------------------------------------------|
| CR-01 | Critical | **维持已裁决** → `TD-48-01`（已更正为 minor 级残余） | 缺陷形态不变，行号因 diff 位移：`src/renderer.js:10427`（`rowTitle`）、`10419-10420`（badge title）、`10430-10431`（status title）；`escapeHtml` 仍只转义 `& < >`（`11349-11353`）。用户 2026-09-12 已裁决「延后，Phase 49 开工前第一条」，**不重新定级、不重复计分** |
| CR-02 | Critical | ✅ **RESOLVED**（G-48-2） | `ai-skills-manager.js:817-833`：判据 = `path.resolve(path.dirname(s.filePath)) === expectedDir`；`skills[0]` 兜底与 `fresh.name !== name` 双删；返回 `{...fresh, name}`。独立探针复跑「目录 `evil` + `name: find-skills` → `{ok:true,name:'evil'}`」；新增 3 条用例（`tests/test-ai-skills.js:1589-1676`）在旧实现下必然红 |
| CR-03 | Critical | ✅ **RESOLVED**（G-48-4），**但留下同源残余 → CR-05** | `renderer.js:9387-9413` 取消分支改按锚点解算 + `resetRunState` 门控；`src/ai-cancel-state.js:58` 把 `resetRunState` 与消息列表形态解耦。UAT test 4 的靶心序列（旧 id/新 id → 目标旧条 + **不复位**）成为用例 `tests/test-ai-cancel-state.js:41-56`。**残余**见 CR-05（标记生命周期） |
| CR-04 | Critical | ✅ **RESOLVED**（G-48-3，**A+B 两条都做了**） | A：`renderer.js:8692-8707` 的 `known` / `!known` / `disabled` 三段本地否决整段删除；B：`renderer.js:4405-4407` 去掉 `if (!state.slashPickerOpen) return` 改为无条件 `pullAiSkillsSnapshot()`；新测试 `tests/test-skill-picker-model.js:493-512`、`tests/test-ai-skills.js:2377-2390` 双向钉死（既断言「无面板关闭早退」也断言「不触发重扫」） |
| WR-01 | Warning | ❌ **仍开**（未被本轮触及） | `src/renderer.js:8847-8851` 的 `SKILL_TIER_TITLES` 与 `src/skill-picker-model.js:324-340` 的 `TIER_BADGE[*].title` 仍逐字重复三条文案 |
| WR-02 | Warning | ❌ **仍开**，且**新增一个抛出点** | `ai-manager.js:1046` / `1174` 的 `await this._resolveSkillInvocation(message)` 仍裸调（位于 `isProcessing = true` 之后、重试 try 之前）。新增证据：`ai-skills-manager.js:808` 的 `await import('@earendil-works/pi-agent-core')` 在 `try` **之外**（try 只包 `loadSkills`，见 `810-816`）→ 动态 import 失败即穿透到 IPC，`isProcessing` 保持 true → 之后所有消息被「AI 正在处理上一条消息」拒绝，直到重建 Agent |
| WR-03 | Warning | ❌ **仍开** | `renderer.js:9994-10000`（`regenerateMessage`）与 `10072-10078`（`showAIError` 重试）的 `skillError` 分支仍只 `pushSystemNote` 后 return；先前 push 的 `{role:'assistant', content:''}` 占位（`9985` / `10066`）在 `aiStreaming=false` 后被 `skipBubble` 跳掉内容却**仍产出 wrapper + `createMessageActions`**（`8041-8054`、`8093-8095`）→ 留一个带「复制」按钮的空壳。与发送路径的 `removeSkillFailureBubbles`（`8823`）不一致，本轮新加的 `refreshUserMessageBubble` 不改善该路径 |
| WR-04 | Warning | ❌ **仍开** | `ai-manager.js:1612-1618` 的 `_resolveSkillMarker` 仍只做 `path.isAbsolute + path.resolve`，未做 SDK `normalizeToolPath` 的 `@` 前缀剥离与 Unicode 空格折叠 |
| IN-01 | Info | ❌ 仍开 | `ai-manager.js:6187` 仍 `indexOf(provenance)`（取首次出现），与自身注释的「锚定在 provenance 行」理由矛盾 |
| IN-02 | Info | ❌ 仍开 | `src/preload.js:979` 仍写 `@returns {Promise<{success: boolean, error?: string}>}`（实际 `{success?, conversationId, skillInvocation, skillError}`）；本轮 diff 未触及 preload |
| IN-03 | Info | ❌ 仍开 | `src/renderer.js:10165-10169`：`next < 0` 分支置 `-1` 后直接 `return`，未重渲染，DOM 高亮与 state 短暂背离 |
| IN-04 | Info（观测） | ⏸ **保留原样**（非本阶段代码缺陷，相位 50/51 处理） | 弱模型把技能名当工具调用的实测观测，归因 SDK 提示词模板，本轮不变 |

> 计数口径：`CR-01` 已由用户裁决为延后并降级，**不计入本轮 `findings.critical`**（它作为 `TD-48-01` 存在于下文技术债节）；`CR-02/03/04` 计为已闭合，不再列出。`critical: 1` 即本轮新增的 CR-05。

---

### B. Critical Issues

#### CR-05: 取消标记无生命周期 —— abort 打在已结算的 run 上会留下**跨轮存活**的锚点，吞掉下一轮真实错误并把面板永久卡在「流式中」

**File:** `src/renderer.js:8272-8281`（`finalizeAIStreamingBubble`：唯一该清而没清的地方）、`9112-9125`（`abortAIIfStreaming`）、`8379-8394`（`handleStopAI`）、`9385-9414`（error 取消分支）
**关联:** `ai-manager.js:1577-1583`（`abort()` 同步、无返回值）、`node_modules/@earendil-works/pi-agent-core/dist/agent.js:202-204`、`326-356`

**Issue:**

本轮的修复把「归属」从 `aiCurrentMessageId` 换成了锚点 `aiCancelledMessageId`，但**没有给这对标记加上生命周期**。完整枚举（全仓 `aiCancelledByUser` 出现点）显示清理只发生在四处：两处对话切换（`7214` / `7252`）、两处 abort 失败的 catch（`8391` / `9122`）、取消分支自身（`9397`）。**没有任何一处在「run 正常结算」时清理它** —— 而 SDK 的 abort 是**静默 no-op**：

```js
// dist/agent.js:202-204
abort() { this.activeRun?.abortController.abort(); }
```

`activeRun` 只在 `runWithLifecycle` 的 `finally → finishRun()` 里清空（`326-356`），而 `handleRunFailure`（→ 唯一会带 `errorMessage` 的 `agent_end` → `ai-manager.js:1733-1748` 发 `error` 事件）**只在 executor 抛错时才走**。因此「abort 到达时 run 已正常跑完」时，主进程**一个事件都不发**，renderer 侧 `aiCancelledByUser` / `aiCancelledMessageId` 就永久留在内存里。

最自然的复现路径是**在流式结束的瞬间连点一次停止按钮**（第二次点击落在主进程已结算、renderer 尚未处理 `turn_end` 的窗口内）：

1. 点击 1：`handleStopAI` 置 flag + 锚点 = A，`abort()` 生效 → A 走 `handleRunFailure` → `error` 事件 → 取消分支消费 → 状态干净；
2. 点击 2（同一窗口内）：`state.aiStreaming` 仍为 true → 再次置 flag + 锚点 = A → 但主进程 `activeRun` 已为 undefined → **abort no-op，无任何事件** → 标记滞留；
3. 之后**任意一轮**的真实错误（模型 401/限流/网络、`Agent is already processing a prompt` 四次重试全败、`创建对话失败` …）到达时，取消分支**先于**普通错误分支命中（`9387` 的判据只有 flag）：

```js
if (state.aiCancelledByUser) {                       // ← 无 run 身份校验
  const attribution = resolveCancelAttribution(state.aiMessages,
    state.aiCancelledMessageId /* = A，上一轮的 id */, state.aiCurrentMessageId /* = B */);
  state.aiCancelledByUser = false; state.aiCancelledMessageId = null;   // ← 单向消费，无补偿
  if (attribution.targetIndex >= 0) state.aiMessages[attribution.targetIndex].content = '*用户已取消*';
  if (attribution.resetRunState) { /* false（A ≠ B）→ 什么都不做 */ }
  needsRender = true; break;                          // ← 错误被吞，showAIError 永不执行
}
```

净效果（三个同时发生，任一单独都已是缺陷）：

- **A 这条已完成的回复正文被就地覆盖成 `*用户已取消*`**（`9400`，A 仍在列表里 → `targetIndex >= 0`）；
- **B 轮的轮次状态永不复位**（`resetRunState=false` → `state.aiStreaming` 保持 true、`aiCurrentMessageId` 保持 B、停止按钮不回退），而 B 的错误**没有 `showAIError`、没有重试按钮、没有 system-note**；
- 面板进入**无法自恢复的卡死**：输入普通消息被 `renderer.js:8717` 的 `if (state.aiStreaming) return;` 静默丢弃，再点停止只会重复第 2 步（无事件可等），唯一出路是 `/clear`（`9132-9136`，靠 `createNewConversation` 清标记）或切换 / 重载对话。

**可达性与定级说明（诚实边界）**：这条**不是** UAT 已实测复现的现象，而是从状态机 + SDK 语义推出的可达路径；触发需要一个窄竞态窗口（renderer 认为仍在流式、主进程已结算）。但它同时满足「错误静默丢失」「已完成回复的显示内容被破坏」「UI 卡在无可用交互的状态」三条，且修复成本是两行不变式；按 `BLOCKER = incorrect behavior / must be fixed before this code ships` 记 Critical。**它不是 CR-03 的重复**：CR-03 是「迟到取消落到新气泡」，本条是「取消标记活得比它要描述的 run 更久」。测试面同样覆盖不到 —— `tests/test-ai-cancel-state.js` 的 A 组只覆盖了单次解算的纯逻辑，没有「标记何时该失效」这一维度。

**Fix（两处，成本约 3 行）:**

```js
// 1) renderer.js:8272 finalizeAIStreamingBubble()（renderer 侧 turn_end = run 正常结算）
//    正常跑完就不该再留着「我要把某个错误解释成取消」的授权
state.aiStreaming = false;
state.aiCurrentMessageId = null;
state.aiCancelledByUser = false;        // 新增
state.aiCancelledMessageId = null;      // 新增 —— 这一处即可消除跨轮污染
```
```js
// 2) renderer.js:9387 取消分支加身份自校验（纵深）：锚点缺失时不得按取消吞掉错误
if (state.aiCancelledByUser && state.aiCancelledMessageId) { ...原逻辑... }
// 走 else（原普通错误分支）→ showAIError 照常出提示与重试按钮
```
（第 1 处需要注意的是：被中止的 run 走 `handleRunFailure`，renderer 只会收到 `error` 而**收不到** `turn_end`（`ai-manager.js:1743-1748` 发完 error 即 `break`），因此不会与「用户点停止」的既有语义打架；`/clear` 与 `/compact` 的 aborted run 同理。可另补一条用例：`resolveCancelAttribution` 之上加「标记在正常结算后必须为 null」的接线断言。）

---

### C. Warnings

#### WR-01: `SKILL_TIER_TITLES` 与 `TIER_BADGE[*].title` 逐字重复，破坏单源并让文档口径失真

**File:** `src/renderer.js:8847-8851` vs `src/skill-picker-model.js:324-340`
**本轮复核:** ❌ 仍开（逐字比对：三条文案仍完全一致；`skillTierTitle`（`8858-8860`）仍读本地副本）。
**Issue:** `docs/product/ai-skills.md` §10.5 写「面板行与 `read` 工具卡片**共用同一张查表**…不存在第二份徽标实现」，用户气泡 pill 走的却是这份本地副本；后续改一处文案必然漂移。
**Fix:**
```js
function skillTierTitle(tier) {
  const badge = window.SkillPickerModel.TIER_BADGE[tier];
  return badge ? badge.title : '';
}
```
删掉 `SKILL_TIER_TITLES` 后同步核对文档 §10.5 的措辞（pill 只取 `title`，不渲染彩色徽标，仍属同一查表）。

#### WR-02: `_resolveSkillInvocation` 未包 try/catch → 抛错即永久锁死 AI（`isProcessing` 不复位）

**File:** `ai-manager.js:1046`、`ai-manager.js:1174`（调用点）、`ai-skills-manager.js:808`（本轮复核新增的第二个抛出点）
**本轮复核:** ❌ 仍开。`readSkillForInvocation` 的 `try` 只包住 `loadSkills(env, …)`（`810-816`），**不包** `await import('@earendil-works/pi-agent-core')`（`808`）与调用侧的 `await import('@earendil-works/pi-agent-core')` / `buildSkillInvocationBlock`（`ai-manager.js:1433-1438`）—— 任一抛错都穿透 `prompt()` / `promptWithContext()` 直达 IPC，而 `isProcessing` 保持 `true`。
**Issue:** 此后所有消息都被 `'AI 正在处理上一条消息，请稍候再试'` 拒绝，直到重启或重建 Agent。同文件其余失败分支都成对复位 `isProcessing`，此处是唯一缺口。
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
（`ai-skills-manager.js:808` 的 import 一并挪进上方的 `try`，或整段包一层。）

#### WR-03: 两条重发路径的 `skillError` 分支留下空气泡（与发送路径的清理不一致）

**File:** `src/renderer.js:9994-10000`（`regenerateMessage`）、`src/renderer.js:10072-10078`（`showAIError` 的重试）
**本轮复核:** ❌ 仍开，且**症状已定位到具体 DOM**：`aiStreaming` 被置 false 后，空 assistant 占位的 `.ai-message-content` 被 `skipBubble` 跳过（`8041`），但 wrapper 照常挂载（`8102`）并因 `!state.aiStreaming` 追加 `createMessageActions`（`8093-8095`）→ 界面上留下一个**只有「复制」按钮的空壳**。
**Issue:** `handleSendAIMessage` 在技能被拒时调用 `removeSkillFailureBubbles(userMsgId)`，并把「不留半截历史」（D-13 推论）落实到位；两条重发路径只 `pushSystemNote` 就 return。同一条失败语义在三个入口产出三种界面状态。
**Fix:** 两处 `pushSystemNote` 前复用同一清理（把 `removeSkillFailureBubbles` 泛化为「移除指定 userId + 紧随的空 assistant 占位」，或在两处按 `aiMsgId` 直接 `splice`）。

#### WR-04: `_resolveSkillMarker` 未对齐 SDK 的路径归一化，`@` 前缀 / Unicode 空格形态会静默退化为普通卡片

**File:** `ai-manager.js:1612-1618`
**本轮复核:** ❌ 仍开（`1616` 逐字未变）。
**Issue:** 判定只做 `path.isAbsolute + path.resolve`；而 SDK 侧实际读取走 `normalizeToolPath`（去掉前导 `@`、把 `[\u00A0\u2000-\u200A\u202F\u205F\u3000]` 折成普通空格）+ `resolveReadToolPath` 的多变体探测。因此模型给出 `@/…/SKILL.md` 或含 Unicode 空格的路径时，**正文确实被读到**、卡片却退化为普通 `read`，两条链路判据不一致。
**Fix:**
```js
const raw = args.path.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ').replace(/^@/, '');
const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
```

#### WR-05（本轮新增）: `G-48-6` 的「立即」口径与实现时机不符 —— 修复只覆盖「整轮跑完时」，「发送后立即」这半边会**原样复现 UAT 探针失败**

**File:** `src/renderer.js:8810-8817`（回填后刷新）、`8799`/`8788`（`await …ai.prompt`）、`ai-manager.js:1081-1089`；文档 `docs/product/ai-skills.md` §10.8（`+` 段）
**Issue:**
`ai:prompt` / `ai:prompt-with-context` 的应答在**整轮 run 结束之后**才解析（`await this.agent.prompt(enhanced); await this.agent.waitForIdle();` 之后才 `return { skillInvocation: resolved.skill }`），而 `refreshUserMessageBubble` 的**唯一**触发点就是该应答返回之后。因此技能 pill 与「技能正文（N 字符）」折叠块的出现时刻是「回复跑完」，**不是回车那一刻**；在这一轮（可能含多次工具调用、几十秒）内用户气泡始终是「纯 args 文本」。

后果是指向验收面的：`48-UAT.md:171` 的 G-48-6 探针**同时测了两个时刻**（「发送后立即」与「整轮跑完时」），本轮修复只让后者由 false 变 true；gap 的 `truth` 原文是「输入 … 回车后，用户气泡**立即**呈现三件套」，**重跑同一探针仍会在前半句失败**（gap 的 `missing` 写的是「无需任何额外交互」，那一条确实满足 —— truth 与 missing 的口径本身也不一致）。`docs/product/ai-skills.md` §10.8 的「**即时呈现**：发送后**当轮即现**」继承了同一歧义。

**Fix（二选一，建议先定口径再动手）:**
- **口径收口（零代码）**：把 `G-48-6` 的 `truth` 与文档 §10.8 的措辞改成可证伪的形式 —— 「发送后无需任何额外交互，**本轮回复结束时**即含 pill 与折叠块」；
- **真「立即」（要真做就改链路）**：技能解析在主进程 `_resolveSkillInvocation` 内已经完成、早于 run 启动，可在那一刻把 `{name, args, tier}` 经事件推给 renderer（或把 `ai:prompt` 拆成「解析应答 + run 应答」两段），renderer 收到即 `refreshUserMessageBubble`。注意别顺手把 `content` 也发下去（D-06 明确「正文恒为 args」，`content` 只在应答里供折叠块）。

#### WR-06（本轮新增）: 实时读盘路径**绕过 64 KiB 字节闸** —— 文档里的 DoS 缓解口径已不成立（已用探针决定性复现）

**File:** `ai-skills-manager.js:802-834`（`readSkillForInvocation` 用调用方传入的 `env`）、`ai-manager.js:864`（`this.sandboxEnv = createSandboxEnv()`，**原始**沙箱 env）、`ai-skills-manager.js:462-466`（`createSkillsEnv` 唯一使用点）
**Issue:**
`createSkillsEnv` 的 `readTextFile` 收窄（`basename === 'SKILL.md' && size > MAX_SKILL_MD_BYTES → invalid`，`161-183`）**只作用于 `refreshSkills` 的扫描**；`readSkillForInvocation` 拿到的是原始沙箱 env，因此**任何一次调用都不复查磁盘当前 size**。而「本轮新读盘的正文」正是要以此为准 —— 刷新时刻的 size 不能替代它。

本轮探针（临时工作区，`node /tmp/probe-bytes.js`，真实 `createSandboxEnv` + 真实 `readSkillForInvocation`）：

```
LIMIT = 65536
A. 刷新时正常大小 → ok=true contentLen=3
B. 撑大后磁盘 size = 204858 字节（> 65536）
C. 实时读盘（缓存未重扫）→ ok=true contentLen=204803（>65536: true）   ← 闸被绕过
D. 重扫后缓存条目 = []   ← 字节闸只在这一侧生效
D. 重扫后调用 → {"ok":false,"reason":"not_found","name":"big"}
```

后果：`48-RESEARCH.md:1653` 的 DoS 缓解行把它写成「既有 `LIMITS.MAX_SKILL_MD_BYTES` 字节闸（超限技能根本不在缓存 → 不可调用）」、`:814` 同口径 —— 对**已能免确认写盘的 AI**（`write`/`bash` 在沙箱内自动执行）而言，只要「先写超大 SKILL.md，再由用户 `/skill:name` 调用」，且该次发送走 `ai.prompt`（无附件/引用 → 不经过 `promptWithContext` 的 idle 边界重扫，`syncAgentSystemPrompt` 的唯二调用点是 `ai-manager.js:1328` / `2806`），就能让 **>64 KiB 正文**整段进注入块，同时绕过 8000 字符的 prompt 预算；该路径**不产任何诊断**（静默）。定级 Warning 而非 Critical：需要「本会话内先撑大、再调用、且不触发重扫」的组合，且无越权（仍被硬沙箱限制在工作区内），但**文档承诺的边界确实不成立**。

**Fix（约 3 行，与 D-13「与不存在同形」一致）:**
```js
// readSkillForInvocation 内，组装之前
const mdPath = path.join(path.dirname(entry.skill.filePath), 'SKILL.md');
const info = await env.fileInfo(mdPath);
if (info && info.ok && info.value.size > LIMITS.MAX_SKILL_MD_BYTES) {
  return { ok: false, reason: 'not_found', name };   // 或 Phase 50 的专用码 + 诊断
}
```
（更彻底且不新增第二份判定的做法：`readSkillForInvocation` 内复用 `createSkillsEnv(env, {rootDirs, maxSkillMdBytes})` —— 但注意 `createSkillsEnv` 的 `listDir` 收窄会连带作用，需要把「只叠 `readTextFile`」与「叠 `listDir`」拆成两个可选开关，改之前先确认不破坏「单目录读取」的语义。）

---

### D. Info

#### IN-01: `resolveSkillBubbleArgs` 用 `indexOf` 定位 provenance，与自身注释的锚定理由相矛盾

**File:** `ai-manager.js:6187`（`const p = enhancedContent.indexOf(provenance);`）
**本轮复核:** ❌ 仍开。注释写「锚点必须挂在 provenance 行上，才能天然排除技能块体中的同名文本」，实现却取**首次**出现；技能正文里若出现同一句，锚点落到正文内部，args 还原出错。属病态输入，修正成本为零。
**Fix:** 从块尾之后起锚（`parseStoredSkillInvocation` 已算出 `closeIdx`），或改 `lastIndexOf` + 块尾边界校验。

#### IN-02: `preload.js` 的 `ai.prompt*` JSDoc 未同步 48 起的新返回契约

**File:** `src/preload.js:979`（同类 `promptWithContext` 同段）
**本轮复核:** ❌ 仍开（本轮 diff 未触及 preload）。仍写 `@returns {Promise<{success: boolean, error?: string}>}`；实际返回 `{success?, conversationId, skillInvocation, skillError}`（`ipc-handlers.js:1730-1733`）。renderer 依赖 `result.conversationId` / `result.skillInvocation` / `result.skillError`，文档面滞后会误导下一个改动者。
**Fix:** 同步两处 JSDoc。

#### IN-03: 面板 `activeIndex` 归 `-1` 后不重渲染，DOM 高亮与 state 短暂背离

**File:** `src/renderer.js:10165-10169`
**本轮复核:** ❌ 仍开（逐字未变）。全部行不可选中时置 `activeIndex = -1` 并直接 `return`，DOM 上仍留着上一行的 `.active` 高亮。
**Fix:** 同分支补一次 `renderSlashPickerList()`（此时 `isActive` 判据 `selectable === true && index === -1` 恒假，高亮自然清空）。

#### IN-04: 弱模型下「模型自发匹配技能」退化为把技能名当**工具**调用（实测观测，非本阶段代码缺陷）

**来源:** `/gsd-verify-work 48` test 8 自动驱动（2026-09-12），两次独立观测一致。
**Issue（现象）:** 给一个命中某技能 `description` 的任务（不手打 `/skill:`），模型**没有** `read` 该技能的 `SKILL.md`，而是把技能名当工具调用 —— 卡片标题 `demo`（未技能化）、参数 `{ "text": … }`、结果 `Tool demo not found`、状态`失败`；模型自述「未找到名为 "demo" 的技能工具」。追问「技能与工具有什么区别」时答「需通过 `/skill:名字` 显式调用才能生效」，与 D-18 口径不符。
**归因（源码直读）:** 不是 Realm 的接线问题。`buildSystemPrompt()`（`ai-manager.js:599-604`）= base + `buildSkillsPrompt()`，后者即 SDK `formatSkillsForSystemPrompt` 的产物；该模板已明确写下「Read the full skill file when the task matches its description.」并逐条给出 `<location>` 绝对路径。故指令存在且正确，是模型（ModelScope `Qwen/Qwen3-8B`）不遵守。
**影响:** 弱模型用户会看到一张以技能名命名的**失败工具卡片**，技能自动匹配对其不可用；显式 `/skill:name` 路径不受影响。
**为何不计缺陷:** 由 SDK 侧提示词模板承载，Realm 无可控代码；本阶段交付物（技能化卡片的可见性 + 重载还原）已由 test 8 ① 端到端验证通过。
**建议去向:** 留给 Phase 50/51 的技能 UX（例如：把技能名注册为一个显式报错的同名工具、或在 Realm 侧追加一句强化指令「技能只能经 `read` + `location` 读取，不存在同名工具」）。
**本轮复核:** ⏸ 保留原样（无新证据，也不因本轮 diff 改变）。

#### IN-05（本轮新增）: `renderAIMessages` 的 `isUser` 分支先建内容容器又整体丢弃 —— 死分配

**File:** `src/renderer.js:8046-8055`
**Issue:** `skipBubble` 判据含 `!isUser`（`8041`），因此对 user 消息 `content = document.createElement('div')`（`8047-8050`）必然为真分支进入，紧接着在 `8055` 被 `content = buildUserMessageContent(msg)` 整体替换 —— 每个用户气泡白建一个立刻被 GC 的 div。无害，但会被下一个读代码的人当成「这里有一份 content 会被复用」的暗示。
**Fix:** 把 `isUser` 分支提到容器创建之前（user → `buildUserMessageContent`；否则按 `skipBubble` 建容器），或加一行注释说明该分配是刻意的空壳。

#### IN-06（本轮新增）: `refreshUserMessageBubble` 与整列渲染**不是** DOM 等价 —— 不补 `.message-actions`

**File:** `src/renderer.js:8183-8202` vs `8093-8095`
**Issue:** 两者的 `.ai-message-content` 子树完全等价（同一 `buildUserMessageContent`，已核对），但 wrapper 上的操作按钮由整列渲染按 `msg.id && !state.aiStreaming` 决定。技能发送路径的气泡是在 `aiStreaming === true` 时渲染的（`8778`），随后的定向刷新**不会**补上「复制」按钮 —— 该气泡在本轮内一直缺按钮，直到下一次**全量** `renderAIMessages()`（切对话 / `/compact` / `pushSystemNote`）才补齐。属观感级不一致，不影响正确性。
**Fix:** 要么在 `refreshUserMessageBubble` 内按同一判据同步 `.message-actions`（注意别重复挂载），要么在该函数 JSDoc 里显式声明「只对齐内容子树，wrapper 级按钮归整列渲染」。

#### IN-07（本轮新增）: 技能已成功解析但本轮 run 失败时，pill / 折叠块永不出现

**File:** `src/renderer.js:8810`（`if (result && result.skillInvocation)`）、`ai-manager.js:1093-1104`（错误路径 `return { …, skillInvocation: null }`）
**Issue:** LLM 级错误（401/限流/网络）或 3 次重试全败时，主进程返回的 `skillInvocation` 为 `null`（`resolved.skill` 有值但不回传），renderer 便跳过 `refreshUserMessageBubble`；而该轮的 `renderAIMessages()`（错误分支 `9442`）也拿不到 `userMsg.skillInvocation` → 用户看到的是「纯 args 文本 + 错误提示」，**看不出这一轮实际注入了哪个技能**（DB 里该行确实带 `<skill>` 块）。属信息缺失而非错值。
**Fix:** 错误路径也回传 `resolved.skill`（renderer 侧已用 `if (result && result.skillInvocation)` 判空，无需改渲染逻辑），或把「技能已解析」做成独立事件（与 WR-05 的「真立即」方案可合并实施）。

---

## 备注（本轮复核过、不构成 finding 的点）

- **`resolveCancelAttribution` 的 `resetRunState` 边界是刻意且正确的**：`resetRunState = !!cancelledId && cancelledId === currentId`（`ai-cancel-state.js:58`）与 `messages` 形态解耦 —— 这正是「消息已被移除也仍要切回发送按钮」这一既有语义不丢的原因（用例 `tests/test-ai-cancel-state.js:74-83`）。不要为了修 CR-05 把它改成「有 targetIndex 才复位」（那会把用户点停止的语义再次弄坏）；CR-05 的修法在**标记生命周期**，不在解算函数。
- **`/compact` 期间迟到取消会清掉 compression 按钮态**（`updateSendButtonState(false)` 在 `9410` 无条件覆盖 `updateSendButtonState(false, true)`，`9149`）—— 与本轮 diff 无关的**既有**行为（旧代码同样无条件调用），且被 `if (state.aiCompacting) return;`（`8676`）兜住，故不计为 finding；若要修，应在取消分支里加 `!state.aiCompacting` 判据。
- **`handleStopAI` 新增的 `if (state.aiCurrentMessageId)` 守卫**（`8381`）在现有状态机下与旧语义等价 —— `aiStreaming` 与 `aiCurrentMessageId` 的置位/清理点成对（`8766-8769` / `9984-9987` / `10065-10068` 置位，`finalizeAIStreamingBubble:8277-8278` 清理），我未找到「streaming=true 而 currentMessageId=null」的可达态，故不计为 finding。
- **`skills:changed` 无条件重拉的代价**：处理器体内只做一次 `ai:get-skills`（零 IO）且 `digest` 相同即早退（`9086`），每次广播的开销是常数级；窗口数 × 广播次数量级可忽略，无自激（见 Summary 第 3 条）。不计为 finding。
- **`refreshUserMessageBubble` 的 `querySelector` 模板插值**（`8187-8189`）与既有 `updateAIStreamingBubble`（`8123-8125`）、`finalizeAIStreamingBubble`（`8288-8290`）同款。messageId 的来源只有 `'user-msg-' + Date.now()` / `'ai-msg-' + Date.now()` / DB 行 id（`ai-conversations-manager.js:606/644/654` 直取 `row.id`），**不含引号/反斜杠**，故不构成选择器注入；但如果以后引入外部来源的消息 id，这三处要一起改（属同一模式，非本阶段新增风险）。
- **性能面（v1 范围外，沿用上一轮口径）**：`getSeededSkillNamesSafe()` 每次调用都 `readdirSync` + 逐技能 `existsSync`，而 `_resolveSkillMarker` 按**每条** toolExecution、`_skillTierByLocation` 按**每条** user 行各调一次；`matchSkillByPath` 又对每条缓存条目做一次 `path.resolve`。主进程同步阻塞，结果只依赖内存缓存，建议在 `getConversationMessages` 整批装饰时算一次向下传参。仍**不作为缺陷计分**。
- **本轮新增测试的形态合规**：`tests/test-ai-cancel-state.js` 的 B 组是**源码扫描型护栏**（与仓库既有 `tests/test-skill-picker-model.js` C 组同款），它防的是「接线被改回去」，不能替代 CR-05 所缺的**行为**断言；`tests/test-ai-skills.js:1589-1676` 的三条 G-48-2 用例用**真实** `readSkillForInvocation` + 真实 SDK `formatSkillInvocation` 构造输入（SDK 改文案会红），不是自证。

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

> **本轮复核补记（不改动上文任何一字）：** 上文引用的是上一轮（`f5a770d`）的行号。本轮 diff 使 `src/renderer.js` 行号位移，当前对应位置为 `10427`（`rowTitle`）、`10419-10420`（badge `title`）、`10430-10431`（status `title`）；`escapeHtml` 仍为 `11349-11353`（仍只转义 `& < >`）。缺陷形态、CSP 实测结论与已裁决的处置（延后 + Phase 49 开工前第一条）均**不变**。

---

_Reviewed: 2026-09-12T12:14:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Review kind: incremental re-review of the gap-closure round (baseline `f5a770d`)_

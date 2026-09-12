---
phase: 48-skill-name
reviewed: 2026-09-12T14:25:17Z
review_kind: incremental-gap-closure-re-review
increment: plan 48-07（G-48-12 运行期新增技能不可调用）
baseline: 3dc3af7956ebba78a46c5f59e24869e94b9bb8c6（上一轮 48-REVIEW 的收尾 commit = 本增量 diff_base）
reviewed_commit: d0458f7
depth: standard
files_reviewed: 4
files_reviewed_list:
  - AGENTS.md
  - ai-manager.js
  - docs/product/ai-skills.md
  - tests/test-ai-skills.js
findings:
  # 计数口径：本增量新增 + 上一轮仍开（原文保留、标状态）合并计数。
  # TD-48-01 / TD-48-02 已由用户裁决延后（阶段 48 不发版），按上一轮同一口径**不计入** findings.critical。
  critical: 0
  warning: 8
  info: 12
  total: 20
status: issues_found
highest_severity: warning
carried_forward:
  - id: TD-48-01
    from: CR-01（属性逃逸注入）
    state: open / user-deferred（Phase 49 开工前第一条）
  - id: TD-48-02
    from: CR-05（取消标记无生命周期）
    state: open / user-deferred（Phase 49 开工前，与 TD-48-01 同批）
  - id: WR-01
    state: open
  - id: WR-02
    state: open（本增量触及同一方法但未闭合）
  - id: WR-03
    state: open
  - id: WR-04
    state: open
  - id: WR-05
    state: closed-by-adjudication（用户裁决收口措辞，非代码修复）—— 收口只落一半，残余转记 IN-12
  - id: WR-06
    state: open / user-deferred（随 Phase 49）
  - id: IN-01
    state: open
  - id: IN-02
    state: open
  - id: IN-03
    state: open
  - id: IN-04
    state: open（观测项，非本阶段代码缺陷）
  - id: IN-05
    state: open
  - id: IN-06
    state: open
  - id: IN-07
    state: open
---

# Phase 48: Code Review Report（**增量复审 · 第二轮 Gap 闭合 / plan 48-07 · G-48-12**）

**Reviewed:** 2026-09-12T14:25:17Z
**Depth:** standard
**Files Reviewed:** 4 —— 1 源码（`ai-manager.js`）+ 1 测试（`tests/test-ai-skills.js`）+ 1 产品文档（`docs/product/ai-skills.md`）+ 1 项目说明（`AGENTS.md`）
**Baseline:** `3dc3af7956ebba78a46c5f59e24869e94b9bb8c6`（上一轮增量复审的收尾 commit，正是本增量的 `diff_base`）
**Range:** `3dc3af7..d0458f7`（6 个 commit，其中 4 个属 plan 48-07）
**Status:** issues_found —— **本增量 0 条新 Critical**；新增 2 条 Warning（WR-07 / WR-08）+ 5 条 Info（IN-08 ~ IN-12）；上一轮 6 条 Warning / 7 条 Info **全部仍开**（其中 WR-05 为「已裁决收口措辞」，但本轮核出收口只落了一半 → 转记 IN-12），原文要点保留并标状态；上一轮唯一 Critical（CR-05）维持用户已裁决的 `TD-48-02` 延后口径。

**增量实跑复核（本轮亲自跑，不采信计划自述）:**

```
$ git diff --stat 3dc3af7..HEAD -- ai-skills-manager.js src/renderer.js src/ipc-handlers.js
（输出为空 —— 三个文件零 diff ✅ 与「修复必须落在调用侧」口径一致）

$ node tests/test-ai-skills.js
# tests 139 / # pass 139 / # fail 0
（台账核对：AGENTS.md 与 docs/product/ai-skills.md §七 的「139 例」逐字一致 ✅）
```

---

## Summary

本增量只做一件事：`/skill:<name>` 在**模块级缓存未命中**时，经**唯一权威入口** `syncAgentSystemPrompt()` 对两个技能根做**一次**重扫，随后**当场重试读盘**（`ai-manager.js:1460-1468`）。这是对 `48-UAT.md` G-48-12（运行期新增技能不可调用）的定向修复。

### 增量做对了的部分（逐条独立核证，不采信注释）

| 增量自述的约束 | 核证方式 | 结论 |
|---|---|---|
| **有界**：重试至多一次，不得写成循环 | J 组 5 条用例直接断言重扫次数（`:2805`、`:2820`、`:2841` + `:2848` 差值恰 0、`:2866`、`:2906`）；源码护栏断言方法体内 `readSkillForInvocation(` 恰 2 次、无 `while`、无 `for (` | ✅ |
| **失败码域不变**：仍只有 `not_found \| disabled` | `ai-manager.js:1470-1473` 走的仍是唯一映射 `skillErrorFromReason`（`:6132-6143`），域外取值（`read_failed` / `bogus` / `undefined`）都回落 `skill_not_found` —— 既有用例 `tests/test-ai-skills.js:1788-1795` 钉死；J 组两条负例分别断言 `skill_disabled` / `skill_not_found` | ✅ |
| **缓存命中快路径不重扫** | 重扫判据是 `result.ok !== true && result.reason === 'not_found'`（`:1460`）—— 成功态与 `disabled` 都不进重扫分支；J 组「快路径不变式」（`:2832`）断言差值恰 0 | ✅（口径措辞见 IN-09） |
| **重扫经单一权威入口**（shadowed 46 D-06 / disabled 46 D-09、D-10 / tier D-14 三字段单源） | `ai-manager.js:1462` 调 `syncAgentSystemPrompt()`；其函数体在本增量中**逐字未改**（diff 只有两处 hunk，均在本方法注释与体内）→ 46-04 的方法体源码扫描断言不受影响；J 组「disabled 不被绕过」「shadowed 不被绕过」两条负例证明运行期新增技能**不能**绕过遮蔽与禁用 | ✅ |
| **读盘实时性**：注入正文恒取重扫之后的那次读盘 | 重试后**再次** `loadSkills` 读盘（`ai-skills-manager.js:811`），`skill.content` 来自 `fresh`；J 组「改盘后二次调用读到新正文」用例断言旧正文不残留 | ✅ |
| **ai-skills-manager.js 零 diff** | `git diff --stat` 输出为空 | ✅ |
| **忙时只置脏、轮内不改写 prompt、不广播** | `syncAgentSystemPrompt()` 的早退判定在 `refreshSkills` **之后**（`:2806` → `:2814`），故缓存必然落地；`_resolveSkillInvocation` 的两个生产调用点（`:1046` / `:1174`）都在 `this.isProcessing = true` 之后 → 恒走忙分支 → 不写 `agent.state.systemPrompt`、不发 `skills:changed`；J 组断言 `_skillsPromptDirty === true` 且 `systemPrompt === 'OLD'` | ✅（代价见 WR-07） |
| **不新增第二套判定**（不按目录直读绕过契约布局 / description 过滤 / 64 KiB 闸） | 新增块只调既有入口，自身零 fs 调用 | ✅ |
| **根因判断可核**（全仓无 fs watcher / 定时器 / 写工具钩子 → 运行期新增目录永不自动进缓存） | `grep -rn "fs\.watch\|watchFile\|chokidar"` 在 `ai-skills-manager.js` / `ai-manager.js` / `agent-workspace.js` / `builtin-skills-seeder.js` 内**零命中**；`refreshSkills` 调用点只有 `init:868` / `syncAgentSystemPrompt:2806` / `_recreateAgent:2883`，三者都属显式重扫 | ✅ 根因成立 |
| **不自激**（重扫 → 广播 → 重拉 → 再重扫） | 忙分支在 `windowManager.broadcast('skills:changed')`（`:2829`）**之前**返回 → 本路径根本不广播；既有「广播到达即无条件重拉」只调零 IO 的 `ai:get-skills` | ✅ 未被本增量破坏 |

### 增量没做到的部分（本报告的新 findings）

1. **WR-07** —— 「回写与广播延后到下一次非忙同步点」在**纯文本流**上永不落地：`_skillsPromptDirty` 全仓只有一个消费点，在 `promptWithContext()` 内（`ai-manager.js:1325-1334`）；而 renderer 只有在**有 @ 引用或附件**时才走 `promptWithContext`（`src/renderer.js:8783`），常规 `/skill:` 发送走 `ai.prompt`（`:8799`）。本增量把「置脏」从罕见（「流式中打开面板」）变成**常规**（任一次 miss），于是「缓存已含新技能、system prompt 不含」的持续不一致成了默认态。
2. **WR-08** —— 增量自述的第三条不变式（「重扫抛错被就地 catch + 告警后**保留原判定**，不把「未找到」升级成异常」）**只被断言、未被强制**：重试读盘在 `try` 之外；catch 之后是**替换**判定而非保留；catch 体内 `err.message` 对非对象抛出值会二次抛错；且该分支**没有任何行为用例**，唯一护栏是 `body.includes('console.warn')` 这种字符串存在性断言。
3. **IN-08 ~ IN-12** —— 隐性 `this` 契约未同步到全部测试夹具；「缓存命中时零重扫」口径不精确；文档 §10.3 第 1 条与第 2 条自相矛盾；miss 由「零副作用查表」变为「全量重扫 + 整体重建缓存」（含瞬态驱逐无关技能的副作用，触发面仅限本地用户输入，故不计 Warning）；**上一轮 WR-05 的「措辞收口」只落了一半** —— §10.8 已改为「本轮回合结束（`ai:prompt` 应答返回）时即现」（`docs/product/ai-skills.md:418-423`），但 §10.7 的同一句仍写「三件套**即时**呈现」（`:390-392`），文档自相矛盾。

**总体判断**：这是一个小、准、核证充分的增量 —— 它要闭合的 G-48-12（**显式调用**面）**真闭合了**（7 条 J 组用例在旧实现下逐条必然红，见 §备注）。留下的两条新 Warning 都不属于「本增量引入的错值/崩溃」，而是「本增量把一个既有的延迟落地机制放大成常规路径」（WR-07）与「文档承诺的不变式只写进了注释」（WR-08）。**无需阻断 UAT**，但 WR-07 建议在 Phase 49（`manage_skill` 落地、AI 自建技能常规化）开工前与 TD-48-01 / TD-48-02 同批处置。

---

## Narrative Findings (AI reviewer)

### A. 上一轮 findings 复核台账（本增量后状态）

> 计数口径：仍开项**原文要点保留**并给出**本轮基线核过的当前行号**。上一轮的若干行号因本增量在 `ai-manager.js` 插入了注释块与重试块而漂移（例：`_resolveSkillMarker` 的 `path.isAbsolute` 行 `1612/1616 → 1660`；`resolveSkillBubbleArgs` 的 `indexOf(provenance)` `6187 → 6230`）。凡与本文件不一致处，**以本文件为准**。

| id | 上轮定级 | 本轮状态 | 当前判据（本轮按代码现状核） |
|----|---------|---------|------------------------------------------|
| CR-01 → **TD-48-01** | Critical | **维持已裁决（延后）** —— 不重新定级、不计分 | 形态不变：`src/renderer.js:10426-10428`（`rowTitle`，`escapeHtml` 在 `:10427`）、`:10419-10420`（badge `title`）、`:10430-10431`（status `title`）；`escapeHtml` 仍为 DOM 版 `div.textContent → div.innerHTML`（`:11350-11353`），**只转义 `& < >`，不转义引号**。实测更正与处置口径见下文技术债节 |
| CR-05 → **TD-48-02** | Critical | **维持已裁决（延后）** —— 不重新定级、不计分 | 形态不变：`src/renderer.js:9388` 的取消分支判据仍只有 flag（无锚点自校验）；`finalizeAIStreamingBubble`（`:8272-8278`）仍只清 `aiStreaming` / `aiCurrentMessageId`，**不**清 `aiCancelledByUser` / `aiCancelledMessageId`。两行修复口径见下文技术债节 |
| WR-01 | Warning | ❌ **仍开** | `src/renderer.js:8847-8851` 的 `SKILL_TIER_TITLES` 与 `src/skill-picker-model.js:324-340` 的 `TIER_BADGE[*].title` 仍逐字重复三条文案；`docs/product/ai-skills.md:357-358` 仍声称「不存在第二份徽标实现」。修法：`skillTierTitle` 改读 `window.SkillPickerModel.TIER_BADGE[tier].title` 后删本地副本 |
| WR-02 | Warning | ❌ **仍开**（本增量触及同一方法但**未**闭合） | `ai-manager.js:1046` / `:1174` 仍裸调 `await this._resolveSkillInvocation(message)`（在 `isProcessing = true` 之后、重试 try 之前）；`ai-skills-manager.js:808` 的 `await import('@earendil-works/pi-agent-core')` 仍在它自己 try（`:810-816`）**之外** → 动态 import 失败即穿透到 IPC，`isProcessing` 保持 true → 之后所有消息被「AI 正在处理上一条消息」拒绝，直到重建 Agent。**本增量新增的 1467 行重试读盘同样在 try 之外**（见 WR-08） |
| WR-03 | Warning | ❌ **仍开** | `src/renderer.js:9993-10000`（`regenerateMessage`）与 `:10071-10078`（`showAIError` 重试）的 `skillError` 分支仍只 `pushSystemNote` 后 return；已被置空的 assistant 占位（`:9984` / `:10065`）在 `aiStreaming=false` 后内容被 `skipBubble` 跳过，但 wrapper 仍挂载并追加 `createMessageActions` → 界面留下**只有「复制」按钮的空壳**。与发送路径的 `removeSkillFailureBubbles`（`:8823`）不一致 |
| WR-04 | Warning | ❌ **仍开**（行号漂移） | `ai-manager.js:1655-1663` 的 `_resolveSkillMarker` 仍只做 `path.isAbsolute + path.resolve`（`:1660`），未做 SDK `normalizeToolPath` 的 `@` 前缀剥离与 `[\u00A0\u2000-\u200A\u202F\u205F\u3000]` 空格折叠 → 这两类模型输出形态下正文被读到、卡片却退化为普通 `read` |
| WR-05 | Warning | ✅ **closed-by-adjudication**（用户 2026-09-12 裁决：收口措辞，不改链路）—— **但收口只落了一半，转记 IN-12** | §10.8「呈现时机」已按裁决改写（`docs/product/ai-skills.md:418-423`：「**本轮回合结束（`ai:prompt` 应答返回）时即现**…注意**不是回车那一瞬间**」），且 `48-UAT.md` / `48-VERIFICATION.md` 第二轮 item 9 已同步；**但 §10.7 的同一句仍写「三件套即时呈现」**（`:390-392`），未随裁决更新 → 文档自相矛盾。本增量未回退 §10.8 的新口径 |
| WR-06 | Warning | ❌ **仍开**（用户裁决保持开放，随 Phase 49） | `ai-skills-manager.js` 零 diff → 形态不变：`readSkillForInvocation` 用调用方传入的**原始**沙箱 env（`:802`），不复查磁盘当前 size，`createSkillsEnv` 的 64 KiB 闸（`:140-183`）只作用于 `refreshSkills` 扫描。**本增量新加的文档条 `docs/product/ai-skills.md:405-407` 已如实写明「本条未被修复」** —— 账本诚实，值得保留 |
| IN-01 | Info | ❌ 仍开（行号漂移） | `ai-manager.js:6230` 仍 `enhancedContent.indexOf(provenance)`（取首次出现），与自身注释「锚定在 provenance 行」的理由相矛盾 |
| IN-02 | Info | ❌ 仍开 | `src/preload.js:979` 仍写 `@returns {Promise<{success: boolean, error?: string}>}`（实际 `{success?, conversationId, skillInvocation, skillError}`）；本增量 diff 未触及 preload |
| IN-03 | Info | ❌ 仍开 | `src/renderer.js:10165-10169`：`next < 0` 分支置 `-1` 后直接 `return`，未重渲染 → DOM 高亮与 state 短暂背离 |
| IN-04 | Info | ⏸ 保留原样（观测项，非本阶段代码缺陷） | 弱模型把技能名当**工具**调用的实测观测；归因 SDK 提示词模板（`ai-manager.js:599-604` 的 `buildSystemPrompt` 产物），Realm 无可控代码。去向：Phase 50/51 技能 UX |
| IN-05 | Info | ❌ 仍开 | `src/renderer.js:8046-8055`：`renderAIMessages` 的 `isUser` 分支先建 `content` 容器又被 `buildUserMessageContent(msg)` 整体替换（死分配） |
| IN-06 | Info | ❌ 仍开 | `src/renderer.js:8183-8202`（`refreshUserMessageBubble`）与 `:8093-8095` 的整列渲染**不是** DOM 等价 —— 定向刷新不补 wrapper 级 `.message-actions`，技能气泡在本轮内缺「复制」按钮 |
| IN-07 | Info | ❌ 仍开 | `src/renderer.js:8810`（`if (result && result.skillInvocation)`）+ `ai-manager.js:1103`：技能已成功解析但本轮 run 失败时 `skillInvocation` 回传 `null` → pill / 折叠块永不出现，用户看不出这轮实际注入了哪个技能 |

---

### B. Critical Issues

**本增量未引入新的 Critical。**

上一轮唯一的 Critical（`CR-05` 取消标记无生命周期）已在 `3dc3af7`（本增量的 `diff_base`）由用户裁决为 `TD-48-01`/`TD-48-02` 同批延后 —— 缺陷形态**在代码中仍然存在**（见 §A 与文末技术债节的修复口径），按上一轮同一计数口径**不计入本报告的 `findings.critical`**，也不重复展开论证。**接手人请先读技术债节再动 `src/renderer.js` 的取消分支。**

---

### C. Warnings

#### WR-07（本增量新增）: 「回写与广播延后到下一次非忙同步点」在**纯文本流**上永不落地 —— 运行期新增技能对模型自动匹配与已开面板永久不可见

**File:** `ai-manager.js:1460-1468`（本增量新增的置脏来源）、`ai-manager.js:2814-2817`（`syncAgentSystemPrompt` 的忙分支：唯一置脏点）、`ai-manager.js:1325-1334`（**唯一**消费点，位于 `promptWithContext` 成功路径）、`ai-manager.js:1084-1088`（`prompt()` 成功路径：**无**补刷）、`src/renderer.js:8783` / `:8799`（renderer 分流）、`docs/product/ai-skills.md:401`、`ai-manager.js:1433`（两处**措辞**）

**Issue:**

本增量的忙时语义设计是「只置脏，不在轮内改写 prompt、不广播；**延后到下一次非忙同步点落地**」。但 `_skillsPromptDirty` 全仓的读写点是：

```
713   this._skillsPromptDirty = false;          // init
1325  if (this._skillsPromptDirty) {            // ← 唯一消费点，在 promptWithContext() 成功路径
1326    this._skillsPromptDirty = false;
1331    this._skillsPromptDirty = true;          // 补刷失败的恢复
2795  （注释）
2815  this._skillsPromptDirty = true;            // syncAgentSystemPrompt 忙分支：唯一置脏点
```

`prompt()`（`ai-manager.js:1002-1110`）的成功出口是 `:1084-1088`（`isProcessing = false` → `return`），**没有**对应的补刷；而 renderer 只在「有 @ 引用或附件」时才走 `promptWithContext`（`src/renderer.js:8783`），常规 `/skill:<name>` 发送走 `else` 分支的 `ai.prompt(text)`（`:8799`）；`regenerateMessage`（`:9993`）与 `showAIError` 重试（`:10071`）也走 `ai.prompt`。

后果（在「用户只发纯文本」的常见工作流上，三者同时成立）：

1. `_skillsPromptDirty` **无限期保持 true** —— 每次 miss 都会重新置位，而没有任何纯文本路径会消费它；
2. `agent.state.systemPrompt` **不包含**运行期新增技能 → **模型自动匹配**（D-18 的 `read` + `description` 匹配路径）对新技能一直不可见，即便该技能刚刚被 `/skill:` 成功调用过一次；
3. `skills:changed` **永不广播** → 其他窗口 / 已打开的 `/` 面板投影保持陈旧（面板只有重新打开、或走 `refreshSkillsForPanel` 才会看到新技能；`getSkillsForUI` 读的是缓存投影，所以重开面板即可见效）。

落地点只有三个，都不是「下一轮 idle 边界」的自然结果：**打开 `/` 面板**（`refreshSkillsForPanel`，非忙 → 真回写 + 广播）、**Agent 重建**、**偶然发一条带 @ 引用 / 附件的消息**。

**为什么定 Warning 而不是 Info（诚实标注）：** 机制（置脏 + 单点消费）**既有**，本增量的新贡献是把「置脏」从罕见情形（流式中打开面板）变成**常规**情形（任一次 miss）——即把潜在缺口放大成默认态。另外两处措辞与实际不符：`docs/product/ai-skills.md:401` 与 `ai-manager.js:1433` 都写「下一轮 idle 边界」，而 idle 边界**只存在于 `promptWithContext`**。同一文档 §10.7 的「忙时语义」条（`:396-400`）给出的清单（打开面板 / Agent 重建 / **带附件或引用的那一轮结束**）是**准确**的 —— 不一致只在上面这两处措辞。

**为什么不定 Critical：** 本增量要闭合的 G-48-12 是**显式调用**面，该面已闭合（J 组 7 条用例实测通过）；本条影响的是「回写与广播的最终一致」，不产生错值、不破坏已完成回复、不卡死交互。

**Fix（二选一，建议 ①，成本约 6 行）:**

```js
// ① 把 promptWithContext 的补刷抽成唯一实现，两处共用（不要写第二份）
//    ai-manager.js 新增私有方法：
async _flushDeferredSkillsPrompt() {
  if (!this._skillsPromptDirty) return;
  this._skillsPromptDirty = false;
  try {
    await this.syncAgentSystemPrompt();
  } catch (err) {
    this._skillsPromptDirty = true;   // 失败恢复脏标记（与 1330-1332 同语义）
    console.warn('[Realm AI] 延迟刷新技能 prompt 失败（将于下次空闲重试）:', err && err.message ? err.message : String(err));
  }
}
//    prompt() 成功路径（1084 之后、return 之前）与 promptWithContext 的 1323-1334 都改成
//    await this._flushDeferredSkillsPrompt();
```

```markdown
② 口径收口（零代码）：把 docs/product/ai-skills.md:401 与 ai-manager.js:1433 的
   「下一轮 idle 边界」改为「下一轮**带 @ 引用或附件**的结束」，并在 §10.7 显式写明
   「纯文本流永不自动落地 —— 会一直等到打开 / 面板或 Agent 重建」。
```

（若选 ② 请注意：`prompt()` 是 `/skill:` 的默认通道，等于把「最终一致」降级为「打开面板才一致」——若 Phase 49 的 AI 自建技能依赖模型自己感知新技能，仍应选 ①。）

#### WR-08（本增量新增）: 增量自述的「重扫抛错就地 catch + **保留原判定** + 不升级为异常」只被断言、未被强制；该分支零行为用例

**File:** `ai-manager.js:1460-1468`（本增量新增块）、`ai-manager.js:1427-1429`（**代码注释里的承诺**：「重扫抛错被就地 catch + 告警后**保留原判定**，不把「未找到」升级成异常」）、`docs/product/ai-skills.md:312-313`（产品文档的较弱承诺：「失败语义不变（仍只有「不存在」与「已禁用」两种结果）」—— **这一条实现是满足的**）、`tests/test-ai-skills.js:2909-2921`（现有护栏）

**Issue:** 以代码注释 `ai-manager.js:1427-1429` 的承诺为基准逐条核（产品文档只承诺「失败码域不变」，实现确实守住了，见上文核证表第二行）：

① **重试读盘在 `try` 之外**（`:1467` 在 `:1461-1466` 的 `try/catch` 之后），所以「不升级为异常」只覆盖 `syncAgentSystemPrompt()` 一侧。`readSkillForInvocation` 的抛出点在 `ai-skills-manager.js:808` 的动态 import（位于它自己的 `try` 之外）—— 会穿透 `_resolveSkillInvocation` → `prompt()` / `promptWithContext()`（两处调用点 `:1046` / `:1174` 均**裸调**，即仍开的 **WR-02**），而 `isProcessing` 已为 `true` 且不会复位。
**可达性诚实标注：** 同一方法在 `:1445` 已成功 import 过同一说明符，Node 的 ESM 注册表会缓存成功解析，故 `:1467` 再 import 基本不可能拒绝 —— 本条**不是**新引入的可达故障，而是「本增量新增的调用点同样落在 try 外，与刚写下的不变式不符」。

② **catch 之后是「替换」而非「保留」**：重扫抛出并被 catch 后，代码仍执行 `:1467` 的 `result = await skillsManager.readSkillForInvocation(...)`，把**原判定对象覆盖**。（实践中结果几乎总是相同 —— 重扫失败 ⇒ 缓存未变 ⇒ 仍是 `not_found`；但注释与文档的「保留原判定」在字面上不成立。）

③ **catch 体自身可二次抛错**：`:1465` 直接读 `err.message`。若抛出值是 `null` / `undefined` / 原始值（`throw null` 合法），catch 内会抛 `TypeError` —— 恰好把「绝不升级为异常」反过来变成升级。同文件 `ai-skills-manager.js:634` 已用 `err && err.message ? err.message : String(err)` 的正确形态，此处未对齐。

④ **测试面缺口（本条最实的部分）**：该分支**没有任何行为用例**。唯一的护栏是 `tests/test-ai-skills.js:2919` 的 `assert.ok(body.includes('console.warn'), '重扫失败不得静默')` —— **字符串存在性**断言：只要方法体内任何位置出现 `console.warn` 即通过，无法承载「保留原判定 / 不逃逸异常 / 不重复读盘」语义。而「重扫抛错被就地 catch 并保留原判定」正是本增量规格明确列为验收点的一项（与上述 ①②③ 是同一个待补的缺口）。

**Fix:**

```js
// ai-manager.js:1460-1468 —— 让注释里的「保留原判定」在字面上成立
if (result && result.ok !== true && result.reason === 'not_found') {
  try {
    await this.syncAgentSystemPrompt();
  } catch (err) {
    // 重扫失败：只告警，沿用**原判定**（此时缓存未刷新，重试读盘必然同样失败）
    console.warn(
      '[Realm AI] 技能缓存未命中后的重扫失败（保留原判定）:',
      err && err.message ? err.message : String(err)
    );
  }
  try {
    result = await skillsManager.readSkillForInvocation(this.sandboxEnv, parsed.name);
  } catch (err) {
    // 重试读盘失败同样不得逃逸（抛错会让 isProcessing 永不复位，见 WR-02）
    console.warn(
      '[Realm AI] 重扫后的重试读盘失败（沿用原判定）:',
      err && err.message ? err.message : String(err)
    );
  }
}
```

配套用例（至少第一条；夹具可直接复用 J 组的 `skillResolveCtx`，覆写 `syncAgentSystemPrompt` 为 `() => { throw new Error('boom') }`）：

```js
test('负例 · 重扫抛错：就地 catch、保留原判定、不升级为异常', async (t) => {
  const root = withTempRoot(t); workspace.ensureWorkspaceDir();
  const env = await setupSkillsEnv(root);
  const ctx = skillResolveCtx(env);
  ctx.syncAgentSystemPrompt = () => { throw new Error('boom'); };
  const res = await invokeSkill(ctx, '/skill:no-such-skill-xyz');
  assert.strictEqual(res.skillError.code, 'skill_not_found'); // 原判定，不是异常
  assert.strictEqual(res.skill, null);
});
```

（同批建议把 `ai-manager.js:1046` / `:1174` 的裸调按 WR-02 的修法包 try/catch —— 两处改完之后，本条的 ① 才从「文档不符」变成「结构上不可能」。）

---

### D. Info

#### IN-08（本轮新增）: `_resolveSkillInvocation` 新增隐性 `this` 契约，既有最小测试夹具未同步

**File:** `ai-manager.js:1440-1468`（新依赖 `this.syncAgentSystemPrompt` / `this.agent` / `this.configStore`）vs `tests/test-ai-skills.js:1898`（旧夹具）

**Issue:** miss 分支现在要求 `this.syncAgentSystemPrompt` 存在、且 `this.agent` / `this.configStore` 足以让 `syncAgentSystemPrompt` 走完 `refreshSkills`。既有最小夹具 `const ctx = { sandboxEnv: env, getSeededSkillNamesSafe: () => [] };`（`:1898`）只覆盖**缓存命中**路径（`alpha` 已被 `setupSkillsEnv` 预热），一旦后续用例在该夹具下出现 miss，就会以 `this.syncAgentSystemPrompt is not a function` 失败 —— 报错信息指向的却不是被测逻辑。本增量新增的 `skillResolveCtx`（`:2758`）已补齐全部字段，但旧夹具未收敛。
**Fix:** 把两处夹具统一到 `skillResolveCtx`（或在该用例注释里明确「仅覆盖命中路径」），避免下一个改动者踩隐性契约。

#### IN-09（本轮新增）: 「缓存命中时零重扫」口径不精确 —— 真不变式是「命中**且当场读盘成功**时零重扫」

**File:** `docs/product/ai-skills.md:394`（承诺）、`ai-manager.js:1460`（判据）、`tests/test-ai-skills.js:2832-2852`（用例）

**Issue:** 重扫判据是 `readSkillForInvocation` 的**返回**（`ok !== true && reason === 'not_found'`），而「缓存命中」只保证 `_cache.skills.find(...)` 命中（`ai-skills-manager.js:803`），不保证随后读盘成功 —— 命中但磁盘文件被删 / 正文被清空 / 目录被换（`:811-830` 的四个 `not_found` 出口）**同样会触发重扫**。用例只覆盖了「命中 + 读盘成功」这一窄形态，因此文档的「实测不变式」比实测到的更强。
**Fix:** 文档改为「缓存命中**且当场读盘成功**时零重扫」，或补一条「命中但读盘失败 → 仍会重扫一次」的用例把口径固定下来。

#### IN-10（本轮新增）: 文档 §10.3 第 1 条与第 2 条自相矛盾（是否复用「重扫产出的元数据」）

**File:** `docs/product/ai-skills.md:308-311`

**Issue:** 第 1 条写「注入的正文恒为重扫之后那次读盘的结果 —— 不复用缓存里的副本，**也不复用重扫产出的元数据**」；第 2 条紧接着写「重扫产出的遮蔽 / 启用禁用 / 来源档三项判定**就是**该次调用的判定依据」。实现在第 2 条一侧：重试读盘正是**以重扫产出的元数据为输入** —— `path.dirname(entry.skill.filePath)`（`ai-skills-manager.js:811`）、`entry.source`（`:833`）、`shadowed` / `disabled`（`:803-805`）全部来自重扫后的缓存条目；**不复用的只有正文副本**（每次都重新 `loadSkills` 从磁盘读）。
**Fix:** 第 1 条改为「不复用缓存里的**正文副本**（每次都重新读盘）」，删除或改写「也不复用重扫产出的元数据」；保留第 2 条。

#### IN-11（本轮新增）: miss 由「零副作用查表」变为「全量重扫 + 可能整体重建缓存」（设计副作用，非缺陷）

**File:** `ai-manager.js:1460-1468`、`ai-skills-manager.js:556`（`_cache.skills = applyShadowing(entries).sort(bySkillPriority)`）

**Issue:** 任一次被解析为技能引用的消息（`/skill:<name>`，或**裸名** `/name`）在缓存未命中时都会付一次 `refreshSkills`：两个根目录、逐技能读 `SKILL.md`（受 64 KiB 闸约束）。**可达名字的约束逐形态不同**，这不是细节：
- `/skill:<name>` 形态有字符集闸 `^[a-z0-9-]+$`（`src/skill-picker-model.js:29`，`:96-100`）—— 不合规名字在 `_resolveSkillInvocation` 的第一行（`ai-manager.js:1441-1442`）就早退，**不会**触发重扫；
- **裸名形态没有字符集闸**（`src/skill-picker-model.js:104-106`，token 整体即名字）→ 拼错的名字（`/foo-bar`）、含点的名字（`/Foo.Bar`）等同样进入 miss 分支并触发重扫。
- **路径穿越仍然不成立**：name 只作 `_cache.skills` 的**全等查找键**（`ai-skills-manager.js:803`），读盘路径全部由缓存条目的 `filePath` 派生（`:811` / `:820`），全函数零拼接用户输入 —— 与 `48-01-PLAN.md:432` 的 T-48-01 缓解口径一致。

此外 `refreshSkills` 是**整体重建**缓存条目数组（`ai-skills-manager.js:556`），因此一次「查不到」的调用可以顺带把**无关技能**暂时移出缓存（例：AI 正用 `write`/`bash` 写某个技能的 `SKILL.md`，该文件此刻缺 `description` → 该技能被跳过；下一次重扫即恢复，属瞬态）。触发面**仅限本地用户输入**（webview / 网页无法触发 `prompt()`，且 renderer 会先截走本地命令），文档 §10.7（`:393-395`）也已如实写明「误诊一个技能名的代价 = 一次全量重扫（与打开 `/` 面板同款）」，故**不计 Warning**。
**建议去向:** Phase 49 起技能由 AI 自建、数量可控性下降，届时值得评估「负缓存 / 节流」（例如对同一 name 的连续 miss 在 N 秒内不重复重扫），或在 §10.7 补一句瞬态驱逐的说明。

#### IN-12（本轮新增）: 上一轮 WR-05 的裁决（收口措辞）只落了一半 —— §10.8 已改、§10.7 未改，同一份文档自相矛盾

**File:** `docs/product/ai-skills.md:418-423`（§10.8「呈现时机」，已按裁决改写）vs `:390-392`（§10.7，**未**改写）

**Issue:** 上一轮 WR-05 指出 G-48-6 的「即时」口径与实现时机不符（技能 pill 与折叠块随 `ai:prompt` 应答落地，而应答在整轮 run 结算之后才返回），用户裁决**收口措辞**。复核结果：§10.8 已准确落地为「**本轮回合结束（`ai:prompt` 应答返回）时即现**，…注意**不是回车那一瞬间**」（`:418-423`）；**但 §10.7 的 G-48-4 + G-48-6 条仍写「技能调用发出后，用户气泡的三件套**即时**呈现，**不需要**切换对话 / 重载页面来触发」（`:390-392`）** —— 即被裁决为不准确的同一句话，原样留在同一文件的上方 28 行处。
**影响:** 文档自身对同一口径给出两个互相排斥的表述（「即时」vs「不是回车那一瞬间」），且 §10.7 是「诚实边界」章 —— 下一个改动者（或在 §10.7 取证的人）会读到错的那一半。**本增量恰好就在编辑 §10.7**（在其尾部追加了 G-48-12 三条 + WR-06 条，`:393-407`），却把同一节上方 28 行处这句已被裁决为不准确的旧口径留在原地 —— 顺手收口成本为零，故本轮记为 finding 而非「历史遗留」。
**Fix:** 把 `:390-392` 的「**即时**呈现」改为与 §10.8 一致的「**本轮回合结束时**呈现」，或直接改为「见 §10.8 的呈现时机」。

---

## Accepted Tech Debt（阶段 48 UAT 收尾裁决 —— 本轮原样继承）

> 本节是上一轮 48-REVIEW 技术债节的**原样继承**（本文件已覆盖同名路径，故在此保留）。裁决前提不变：**48 不进正式版发布**（用户 2026-09-12 确认「暂时不发版」）。每条都带**接手触发点**，不依赖任何自动化门禁重新发现。**本增量未触及这两条的代码**。

### TD-48-01 ← CR-01 属性逃逸注入（延后）

- **裁决：** 延后，不进本阶段修复。2026-09-12 UAT test 1。
- **接手触发点：** Phase 49 开工前**第一条**（`manage_skill` 落地前）。Phase 49 会让 AI 常规化地创建技能目录，扩面后再补代价更高。

> ⚠️ **以下两条是对 CR-01 原文的实测更正**（2026-09-12 用 playwright `_electron` 驱动真实 dev 应用取得）。
> CR-01 原文「把 payload 换成 `onmouseover="…"` 就是事件处理器注入」「注入代码在主窗口 renderer 执行，该上下文持有 `window.realmAPI` 全量 IPC」**不成立**，勿据此定级。

- **✅ 注入成立（实测）：** 在 `managed-skills/` 下建目录名 `pwn" onmouseover="document.documentElement.dataset.pwned=1" data-x="y`，打开 `/` 面板后该行**真实 DOM 属性**为：`class` / `data-index` / `title="/skill:pwn"`（被引号截断）/ `onmouseover` / `data-x="y 可显式调用"` —— 即 `escapeHtml` 不转义引号的属性逃逸**确实发生**，注入体成为真实属性。
- **❌ 代码执行被 CSP 拦掉（实测，决定性）：** `src/index.html:8-9` 有 CSP `script-src 'self'`（无 `unsafe-inline`），内联事件处理器**不被编译**。同文档内对照实测：`innerHTML` 注入 `onmouseover` → 属性在、`el.onmouseover === null`、真实 `mouseover` 派发后计数器未置位；程序化赋值 `el.onmouseover = fn` → `typeof === 'function'` 且正常触发（对照组）。
- **残余真实影响（降级为 minor 级缺陷，非 blocker）：** ① `style` 属性注入**可行**（CSP `style-src 'self' 'unsafe-inline'`）→ CSS 注入 / UI 重绘伪装；② 任意属性注入污染 DOM 结构；③ **潜在 XSS**：一旦 CSP 放宽（加 `unsafe-inline`）或该模板被复用到无 CSP 上下文，即刻升级为可执行。安全性归因应改为「纵深防御兜住了，但转义缺陷仍在」。
- **附带更正：** `AGENTS.md` 的「主窗口（`file://` 加载，无 CSP）」表述有误 —— 主窗口**有** CSP（`src/index.html:8`），只是 `style-src` 含 `unsafe-inline` 使内联 style 可用（弹框居中那节的结论仍成立，但理由不该是「无 CSP」）。
- **⚠ 不要指望 secure-phase 兜住（两处，均本轮核过行号）：** `48-01-PLAN.md:434` 的 T-48-03（Tampering / high / mitigate）声明的缓解措施正是「`name` / `description` / `statusText` / `title` 一律经 `escapeHtml()`」——即失效的那个机制，secure-phase 的短路规则会读成已缓解。**同表 `:432` 的 T-48-01 也已陈旧**：它声明的缓解措施写「`fresh.name !== name` → `not_found`（防目录被换后冒名注入）」，而该判据已由 G-48-2（CR-02）替换为**目录路径全等**（`ai-skills-manager.js:820-827`）——两条 mitigation 声明都与现行实现脱节，接手时应一并订正 PLAN 台账。
- **可达性：** `managed-skills/` 落在硬沙箱 root 内（`agent-workspace.js:113-115`：`path.join(getWorkspaceDir(), 'managed-skills')`），AI 的 `write`/`bash` 免确认自动执行；`enforceDirNameAuthority`（`ai-skills-manager.js:329`）刻意**不校验字符集**并保留不规范名；`toUISkillEntry`（`:707`）对 `name` 零加工直送面板 —— **输入侧可达且无需人工操作**，只是被 CSP 挡在「执行」这一步。
- **修复口径（下次开工直接照做，约 10 行）：** 新增引号感知的 `escapeAttr`，替换 `src/renderer.js:10427` / `:10419-10420` / `:10431` 三处**属性上下文**（文本上下文继续用 `escapeHtml`）；或该行改 DOM API（`setAttribute` 天然安全，本阶段在 `renderAISkillPill` 已用此模式）。**修它的理由已从「堵 XSS」变为「消除 latent XSS + 消除 CSS 注入面 + 不再依赖 CSP 单点兜底」。**
- **取舍说明：** 同类落点 downloads（`14178/14210`）、media（`11214`）是老 bug 且数据源**不是 AI 可自建**，性质不同；本条的独特性在于「数据源可由 AI 自建」。同类落点的统一整改属独立议题。
- **爆炸半径已核实：** 全仓仅 `48-VERIFICATION.md` 的 `covered_files` 含 `src/renderer.js`，修它不连累 44–47 的验证指纹。

### TD-48-02 ← CR-05 取消标记无生命周期（延后）

- **裁决：** 延后，不进本阶段修复。2026-09-12 gap 闭合轮收尾，用户裁决「先记技术债，直接跑 UAT」。
- **接手触发点：** **Phase 49 开工前**（与 TD-48-01 同批处置；Phase 49 的 `manage_skill` 会让「真实错误」出现得更频繁，放大本条的可达性）。**不要求本阶段 UAT 实测**。
- **形态回顾：** 「归属」已由 48-05 从 `aiCurrentMessageId` 换为锚点 `aiCancelledMessageId`，但这对标记**没有生命周期** —— 清理点只有两处对话切换 / 两处 abort 失败 catch / 取消分支自身，**正常结算处一处不清**；而 SDK `abort()` 打在已结算 run 上是**静默 no-op**。窄竞态（「流式结束瞬间连点停止」的第二次点击落在主进程已结算、renderer 尚未处理 `turn_end` 的窗口）会留下跨轮存活的标记，使**下一轮任意真实错误**被当取消消费 → 已完成回复正文被覆盖为 `*用户已取消*`、错误无 `showAIError` / 无重试按钮、`resetRunState=false` 使 `aiStreaming` 永不复位（输入被静默丢弃，唯 `/clear` 或切对话可解）。
- **诚实边界：** 非 UAT 实测复现，是从状态机 + SDK 语义推出的可达路径；`tests/test-ai-cancel-state.js` A 组只覆盖单次解算的纯逻辑，无「标记何时该失效」维度。
- **修复口径（成本约 3 行 / 两处）：**
  1. `finalizeAIStreamingBubble()`（`src/renderer.js:8272`，renderer 侧 `turn_end` = run 正常结算）在 `:8277-8278` 旁补 `state.aiCancelledByUser = false; state.aiCancelledMessageId = null;` —— 这一处即可消除跨轮污染。被中止的 run 走 `handleRunFailure`，renderer 只收到 `error` 而收不到 `turn_end`（`ai-manager.js:1787-1791`：带 `errorMessage` 的 `agent_end` 发完 `error` 即 `break`；`turn_end` 只在成功分支 `:1799` 发出），故不与「用户点停止」的既有语义冲突。
  2. 取消分支加身份自校验（纵深）：`src/renderer.js:9388` 改为 `if (state.aiCancelledByUser && state.aiCancelledMessageId) { …原逻辑… }`，走 `else` 时普通错误分支照常 `showAIError`。
  - 建议附带一条接线断言：「正常结算后两处标记必须为 null」。
  - ⚠ **不要**为了修本条把 `resolveCancelAttribution` 的 `resetRunState` 改成「有 targetIndex 才复位」——那会把「用户点停止」的既有语义弄坏（见 §备注）。
- **同批相邻项（IN-06 / IN-07）：** `refreshUserMessageBubble` 不补 wrapper 级 `.message-actions`；「技能已解析但本轮 run 失败时 pill / 折叠块永不出现」（`ai-manager.js:1103`）。

### WR-05 / WR-06 的裁决（2026-09-12 用户拍板）

- **WR-05：** 用户裁决**收口措辞**，不改链路。§10.8 已落地（`:418-423`）；**但 §10.7 的同一句仍写「即时」→ 收口只落一半，本轮转记 IN-12**，建议随本增量一起改掉（成本一行）。
- **WR-06：** 未裁决修复时机，**保持开放**；本增量新加的 `docs/product/ai-skills.md:405-407` 已如实写明「本条未被修复，随 Phase 49 一并处置，不得据此声称已修」——账本口径正确，保留。

---

## 备注（本轮复核过、不构成 finding 的点）

- **`resolveCancelAttribution` 的 `resetRunState` 边界是刻意且正确的**：`resetRunState = !!cancelledId && cancelledId === currentId`（`src/ai-cancel-state.js:58`）与消息列表形态解耦 —— 这正是「消息已被移除也仍要切回发送按钮」这一既有语义不丢的原因。不要为了修 TD-48-02 把它改成「有 targetIndex 才复位」；TD-48-02 的修法在**标记生命周期**，不在解算函数。
- **`/compact` 期间迟到取消会清掉 compression 按钮态**（`src/renderer.js:9410` 的 `updateSendButtonState(false)` 无条件覆盖 `:9149` 的 `updateSendButtonState(false, true)`）—— 既有行为，且被 `if (state.aiCompacting) return;`（`:8676`）兜住，不计为 finding。
- **`handleStopAI` 的 `if (state.aiCurrentMessageId)` 守卫**（`:8381`）在现有状态机下与旧语义等价（置位 / 清理点成对：`8768-8770` / `9985-9987` / `10065-10067` 置位，`finalizeAIStreamingBubble:8277-8278` 清理），未找到「streaming=true 而 currentMessageId=null」的可达态。
- **`skills:changed` 无条件重拉的代价**：处理器体内只做一次零 IO 的 `ai:get-skills` 且 `digest` 相同即早退；本增量的重扫路径**不广播**（忙分支在 `:2829` 之前返回），无自激。
- **本增量新测试的有效性抽查（7 条逐条在旧实现下必然红）**：J 组 6 条行为用例里，正例 3 条的 `assert.strictEqual(res.skillError, undefined)` / 前置 `warm.skillError` 断言在旧实现（无重扫）下必然失败；负例 `disabled` 断的是 `skill_disabled`（旧实现只会给 `skill_not_found`）；负例「真不存在」断 `rescanCalls === 1`（旧实现为 0）；源码护栏的 `body.includes('syncAgentSystemPrompt(')` 与「恰 2 次读盘」同理。夹具 `skillResolveCtx`（`:2758`）用 `Object.create(aiManager.prototype)` 取原型方法、只补必需字段，并**包装而非重写** `syncAgentSystemPrompt`（`realSync.call(this)`）—— 因此「原方法体逐字未改」这条硬约束没有被测试绕过。
- **`refreshSkills` 的失败回滚与本增量相容**：整批失败回滚 `skills` / `promptBlock` / `diagnostics` 三件套（`ai-skills-manager.js:625-636`），而 `digest` / `refreshedAt` 的赋值（`:623-624`）位于风险段之后，故不会出现「摘要超前于内容」；`syncAgentSystemPrompt` 也遵循「先记摘要、再改写 prompt」（`:2824-2826`）。
- **`refreshSkillsForPanel` 的早退边界在新路径上不可达**：`prompt()` 在 `:1017-1028` 保证 `this.agent` 存在、`sandboxEnv` 在 `init` 的 `:864` 建立（早于 Agent 创建），故 miss 分支里 `syncAgentSystemPrompt` 的 `!this.agent || !this.sandboxEnv` 早退不会发生 —— 重扫**一定**执行。（这也是 J 组夹具要补 `agent` / `configStore` 的原因。）
- **`AGENTS.md` 维护约定合规性**：本增量属「实时读盘口径」变更，维护约定（`AGENTS.md:272`）要求同步权威章节 + 测试清单。核：`docs/product/ai-skills.md` 的「发现与调用」章（十）§10.3 / §10.4 表下注 / §10.5 / §10.7 均已更新；`AGENTS.md:267` 的测试清单已加 `tests/test-ai-skills.js … 运行期新增技能的一次性权威重扫，139 例`，与实际跑数一致。**合规。** 唯一未同步的是 §10.7 的「下一轮 idle 边界」措辞（并入 WR-07）。
- **属性逃逸面未因本增量变化**：`ai-manager.js` 的新增代码只操作字符串与缓存，不经 `innerHTML`；技能名进注入块仍走既有 `formatSkillInvocation` + `name` 重写（`ai-skills-manager.js:831-833`）。
- **性能面（v1 范围外，沿用上一轮口径）**：`getSeededSkillNamesSafe()` 每次调用都 `readdirSync` + 逐技能 `existsSync`，`_resolveSkillMarker` 按**每条** toolExecution、`_skillTierByLocation` 按**每条** user 行各调一次；本增量又给 miss 路径加了一次全量 `refreshSkills`。主进程同步阻塞面扩大，建议在 `getConversationMessages` 整批装饰时算一次向下传参。仍**不作为缺陷计分**（与 IN-11 同一议题）。

---

_Reviewed: 2026-09-12T14:25:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Review kind: incremental re-review · round 2（plan 48-07 / G-48-12；baseline `3dc3af7`，reviewed `d0458f7`）_

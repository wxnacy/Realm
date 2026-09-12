---
phase: 48-skill-name
reviewed: 2026-09-12T16:19:04Z
review_kind: incremental-gap-closure-re-review
increment: plan 48-08（G-48-18 纯文本出口延迟补刷 / G-48-19 重扫与重试读盘失败兜底）
baseline: a211abfb897fe4b1526b5301fa704c1353588ebe（上一轮 48-REVIEW 的收尾 commit = 本增量 diff_base）
reviewed_commit: be36401978eae1725de11e7d94626424c9b07bef
depth: standard
files_reviewed: 4
files_reviewed_list:
  - AGENTS.md
  - ai-manager.js
  - docs/product/ai-skills.md
  - tests/test-ai-skills.js
findings:
  # 计数口径：本增量新增 + 上一轮仍开（原文要点保留、标状态）合并计数。
  # TD-48-01 / TD-48-02 已由用户裁决延后（阶段 48 不发版），按上一轮同一口径**不计入** findings.critical。
  # warning = 仍在台账上的 WR-01~WR-06（其中 WR-05 为「已裁决收口措辞」，残余转记 IN-12）。
  #          本增量**闭合** WR-07 / WR-08，故 warning 由上轮 8 → 6，且本增量**未新增 Warning**。
  critical: 0
  warning: 6
  info: 17
  total: 23
status: issues_found
highest_severity: warning
closed_this_increment:
  - id: WR-07
    state: closed（机制 + 措辞两层均闭合，见 §A）
    evidence: 新增 prompt() 成功出口共用补刷（ai-manager.js:1091）+ K1 行为用例（脏标记归假 / prompt 含新技能 / 广播恰一次）
  - id: WR-08
    state: closed（两个独立 try + 判别式告警 + 三条行为用例 J8/J9/J10）
    residual: 注释依据不成立 → 转记 IN-16
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
    state: open（本增量**部分**收敛：重试读盘已进 try，首次读盘与两个裸调调用点仍暴露 —— 见 §C）
  - id: WR-03
    state: open
  - id: WR-04
    state: open
  - id: WR-05
    state: closed-by-adjudication（用户裁决收口措辞，非代码修复）—— 收口仍只落一半，残余转记 IN-12（本增量未动 §10.7 该句）
  - id: WR-06
    state: open / user-deferred（随 Phase 49；本增量未动 ai-skills-manager.js）
  - id: IN-01 … IN-12
    state: open（IN-04 为观测项；IN-12 为 WR-05 的残余）
---

# Phase 48: Code Review Report（**增量复审 · 第三轮 Gap 闭合 / plan 48-08 · G-48-18 + G-48-19**）

**Reviewed:** 2026-09-12T16:19:04Z
**Depth:** standard
**Files Reviewed:** 4 —— 1 源码（`ai-manager.js`）+ 1 测试（`tests/test-ai-skills.js`）+ 1 产品文档（`docs/product/ai-skills.md`）+ 1 项目说明（`AGENTS.md`）
**Baseline:** `a211abfb897fe4b1526b5301fa704c1353588ebe`（上一轮增量复审的收尾 commit，正是本增量的 `diff_base`）
**Range:** `a211abf..be36401`（12 个 commit；其中 48-08 的实现 commit 2 个：`f679ea8` / `c727d82`，文档 commit 1 个：`4ef828c`，其余为 plan / summary / 跟踪台账）
**Status:** issues_found —— **本增量 0 条新 Critical、0 条新 Warning**；**闭合**上一轮两条 Warning（WR-07 / WR-08）；新增 5 条 Info（IN-13 ~ IN-17）。上一轮仍在台账上的 6 条 Warning / 12 条 Info 全部仍开（WR-02 部分收敛）。

**增量实跑复核（本轮亲自跑，不采信计划自述）:**

```
$ git diff --stat a211abfb..HEAD
 AGENTS.md | 2 +-   ai-manager.js | 112 +++++++++---  docs/product/ai-skills.md | 23 +--   tests/test-ai-skills.js | 358 +++++++---
（其余为 .planning/** 台账文件）

$ node tests/test-ai-skills.js         # 连跑 3 次，逐次一致
# tests 147 / # pass 147 / # fail 0
（台账核对：AGENTS.md:267 与 docs/product/ai-skills.md:98 的「147 例」逐字一致 ✅ 漂移 = 新测试 8 条：J8/J9/J10 + K1~K5 = a211abf 的 139 + 8 ✅）

$ node tests/test-ai-skills.js | grep -E "^ *ok .* K[0-9]"
ok 1 - K1（靶心）… ok 2 - K2 … ok 3 - K3 … ok 4 - K4 … ok 5 - K5（源码护栏）
（K 组 5 条**实跑通过、无 skip** —— 不是「声明了但没跑」）

$ grep -rn "_skillsPromptDirty" ai-manager.js
711(注释) / 715(init) / 1091 / 1331-1333(注释+调用) / 2823-2824(注释) / 2844(忙分支置脏) / 2885(注释) / 2906 / 2908 / 2913
（读/复位/同步/失败恢复四件事**只在 2905-2919 一个方法体内**；2844 是「置脏源」，属另一条链）

$ grep -n "idle 边界" ai-manager.js docs/product/ai-skills.md    # 零命中 ✅
```

---

## Summary

本增量做两件事，都是对 `48-UAT.md` 第三轮两条 gap 的定向修复：

1. **G-48-18** —— 把上一轮内联在 `promptWithContext()` 里的「idle 边界补刷」抽成**唯一实现** `_flushDeferredSkillsPrompt()`（`ai-manager.js:2905-2919`），并在 `prompt()` 的成功出口（`:1091`）补上共用的第二次调用 —— 纯文本通道由此首次成为延迟回写的落地点。**这正是上一轮 WR-07 的修法 ①**，且代码形态与上一轮给出的建议逐行一致。
2. **G-48-19** —— `_resolveSkillInvocation()` 的 miss 分支把「重扫」与「重试读盘」拆进**两个各自独立**的 `try/catch`（`:1476-1495`），两处 catch 均**不赋 `result`、不逃逸**、告警取值统一为 `err && err.message ? err.message : String(err)`，并用 `rescanned` 局部标志在重扫失败时跳过重试读盘。**这正是上一轮 WR-08 的修法**，且补齐了三条行为用例（J8/J9/J10）。

### 增量核证表（逐条独立核证，不采信注释与 SUMMARY）

| 增量自述 / 计划验收点 | 核证方式（本轮按代码现状） | 结论 |
|---|---|---|
| 补刷**首行检脏早退**，无待补刷时零 IO | `ai-manager.js:2905-2906`：`_skillsPromptDirty` 判假即 `return`；K2 断言 `rescanCalls === 0` 且 `systemPrompt === 'OLD'` | ✅ |
| 补刷是**唯一实现**（检脏 / 复位 / 同步 / 失败恢复四件事单源） | 全仓 grep：`_skillsPromptDirty` 的读 / 复位 / 恢复三处**只在 2905-2919**；`promptWithContext` 体内零命中（源码门禁 + K5 均钉死）；`syncAgentSystemPrompt:2844` 的置脏属**置脏源**，非补刷路径 | ✅ |
| **恰 2 个调用点，且都在成功出口** | `:1091`（`prompt()` 的 `isProcessing = false` 之后、`return` 之前）与 `:1333`（`promptWithContext()` 同位置）；本轮逐条枚举两个方法的全部 `return`（`prompt`：1013/1028/1040/1052/1111 皆为错误或前置早退，无补刷；`promptWithContext`：1151/1164/1176/1186/1217/1349 同为早退或错误出口）→ **成功出口各恰一处** | ✅ |
| **重扫抛错不逃逸、不改判定、不重复读盘** | `:1476-1485`：`rescanned` 默认假，`await` 之后才置真；catch 只 `console.warn`，`result` 未被触碰。J8（`Error` 形态）断言 `skill_not_found` + `readCalls === 1` + `rescanCalls === 1` | ✅（依据措辞见 **IN-16**） |
| **重试读盘抛错不逃逸、沿用原判定** | `:1486-1495`：第二个 try 只包 `readSkillForInvocation`；catch 不赋 `result`。J10 断言 `skill_not_found` + `readCalls === 2`；告警文案与「重扫失败」可判别（用例专门断言不得误命中） | ✅ |
| **`throw null` / 抛原始值不会在 catch 内二次抛错** | 两处均为 `err && err.message ? err.message : String(err)`（`:1483` / `:1492`），与 `ai-skills-manager.js:634` 同形；J9 显式跑 `throw null` 与 `throw 'x'` 两种形态 | ✅ |
| 返回值域不变（仍只有 `not_found \| disabled`） | `:1498-1501` 走的仍是唯一映射 `skillErrorFromReason`；J8/J9/J10 三条负例分别断言 `skill_not_found`（域外/异常形态不产生第三码） | ✅ |
| **只由成功出口调用**（错误出口与 `_cleanupCurrentAgent` 不补） | `prompt()` 的重试耗尽 catch（`:1100-1111`）、`promptWithContext()` 的 catch（`:1339-1349`）、`_cleanupCurrentAgent()`（`:2796-2806`）体内均无调用；K3 / K4 各一条行为用例（K3 断言抛错后脏标记**原样保留为 true**、prompt 逐字不变、零广播） | ✅ |
| 失败恢复脏标记语义 = 下一次成功出口重试 | `:2911-2918`：catch 内 `this._skillsPromptDirty = true` + `console.warn`；源码门禁断言 `restoreIdx > syncIdx` | ✅（非错误早退的洞见 **IN-15**） |
| 忙时只置脏、轮内不改写、不广播 | 调用点恒在 `isProcessing = true` 之后（`:1043` / `:1179`）；`syncAgentSystemPrompt` 的忙分支（`:2843-2846`）在 `broadcast`（`:2858`）之前返回；K1 断言 `rescanCalls === 2`（忙时一次 + 出口一次，**证明没有双刷**） | ✅ |
| **修复落在调用侧**（不新增第二套判定、不动权威入口） | `syncAgentSystemPrompt()` 函数体逐字未改（本轮 diff 的两处 hunk 只在其 JSDoc 与 `_resolveSkillInvocation` 体内）；测试夹具用 own-property **包装而非重写** `syncAgentSystemPrompt`（`realSync.call(this)`），故「方法体逐字未改」这条硬约束未被测试绕过 | ✅ |
| 文档/账本同步：§10.7 落地时机 + 失败恢复语义 + 删除 `idle 边界` 旧措辞 | `docs/product/ai-skills.md:396-407` 四项清单 + 失败恢复 + 「残余窗口」触发点枚举；`ai-manager.js` 与 docs **`idle 边界` 零命中**；WR-06 条原样保留（`:408-410`，明写「未被修复，不得据此声称已修」） | ✅ |
| 例数账本 = 实跑值 | `AGENTS.md:267` / `docs/product/ai-skills.md:98` 均写 **147 例**，与实跑 `# tests 147 / # pass 147 / # fail 0` 一致；覆盖面描述已补 G-48-18 / G-48-19 | ✅ |

### 增量没做到的部分（本报告的新 findings，全部为 Info）

1. **IN-13** —— 成本账本**反向**漂移：新增的出口补刷让「一次 miss」在 `prompt()` 通道上变成**同轮两次**全量重扫（解析时 + 出口补刷），而 `docs:312` 与 `docs:393-395` 仍写「代价固定为**一次**全量重扫」。K1 自己断言的 `rescanCalls === 2` 就是反证 —— **新代码是对的，旧账本没跟上**。
2. **IN-14** —— 置脏**不校验实际变化**：忙分支无条件置脏（`:2843-2844`），而错误出口**刻意不补刷**，于是「手打一个拼错的 `/skill:`」的代价会**延后泄漏**到之后任意一条普通消息上；`_recreateAgent()`（`:2926-2983`）重建 prompt 与 digest 却**不清**脏标记，一次陈旧脏标记同样要多付一次全量重扫。
3. **IN-15** —— 「变更绝不静默丢弃」有两个**非错误**的洞：补刷**先复位、后同步**，而 `syncAgentSystemPrompt()` 有两条**不抛错**的早退（`:2832` 无 Agent / 无沙箱、`:2851` digest 与 prompt 双双未变）；走前者时待回写标记被清掉且什么也没发生。今天在成功出口不可达（`prompt()` 在 `:1019-1030` 保证 Agent 存在），但契约 4 的措辞是无条件的。
4. **IN-16** —— 跳过重试读盘的理由（注释 `:1427-1430` / `:1466-1469`「整批失败会回滚缓存三件套 ⇒ 重读必然与首次同形」）**在本仓不成立**：`refreshSkills()` 契约上**永不抛错**（`ai-skills-manager.js:468-637`，其动态 import `:488` 也在同一 `try` 内），真能抛出的只有 `:2836-2840` 三个**先于** `refreshSkills` 的取值点 —— 结论（缓存未变）对，依据错。另附**对上一轮 WR-08 ① 的实测更正**（见 §C.WR-08 收口说明）。
5. **IN-17** —— 新增的 K5 源码护栏与改写后的 `Agent prompt 回写（SKILL-04）` 护栏**八条断言逐字重复**（两份 gate 会各自漂移）；且护栏口径**严于**它编码的不变式 —— `withContext.includes('this._skillsPromptDirty') === false` 会把「在注释里**提及**该标识符」判成红（本文件的既有风格恰恰在 JSDoc 里这样写，如 `:2823-2825`）。

**总体判断**：这是一个**小、准、可核、且自我收敛**的增量。两条 gap 都**真闭合了**：K1 断言的两项（出口后脏标记归假、`skills:changed` 恰一次）在 `prompt()` 无补刷的旧实现下必然红（该通道当时根本没有消费点）；J8/J9/J10 三条在 48-07 的旧形态下同样必然红（旧实现重试读盘在 `try` 之外、catch 裸读 `err.message`，`throw null` 会让用例在 catch 体内二次抛错）。**无需阻断 UAT**。本增量只留下 5 条 Info 级的口径/账本/生命周期残余，其中 **IN-16 是唯一有潜在翻转风险的**（一旦 `refreshSkills` 改成「整批失败即抛错」，`if (rescanned)` 的跳过就会把**已刷新成功**的技能判成 `not_found`）。WR-02 / WR-06 按用户裁决**继续挂账**，请勿在本轮误判为已修。

---

## Narrative Findings (AI reviewer)

### A. 上一轮 findings 复核台账（本增量后状态）

> 计数口径：仍开项**原文要点保留**并给出**本轮基线核过的当前行号**。本增量在 `ai-manager.js` 插入 ~39 行（`_flushDeferredSkillsPrompt` 方法体 + JSDoc）与 ~26 行（miss 重试块），故 `:2850` 之后的旧行号一律漂移（例：`resolveSkillBubbleArgs` 的 `indexOf(provenance)` `6230 → 6298`；`_resolveSkillMarker` `1655 → 1683`）。凡与本文件不一致处，**以本文件为准**。

| id | 上轮定级 | 本轮状态 | 当前判据（本轮按代码现状核） |
|----|---------|---------|------------------------------------------|
| CR-01 → **TD-48-01** | Critical | **维持已裁决（延后）** —— 不重新定级、不计分 | 形态不变：`src/renderer.js:10426-10431`（`rowTitle` / badge `title` / status `title` 三处属性上下文）；`escapeHtml` 仍为 DOM 版、**只转义 `& < >` 不转义引号**（`:11350-11353`）。**本增量未触及 `src/renderer.js`** |
| CR-05 → **TD-48-02** | Critical | **维持已裁决（延后）** —— 不重新定级、不计分 | 形态不变：`src/renderer.js:9388` 的取消分支判据仍只有 flag（无锚点自校验）；`finalizeAIStreamingBubble`（`:8272-8278`）仍只清 `aiStreaming` / `aiCurrentMessageId`。**本增量未触及 `src/renderer.js`** |
| **WR-07** | Warning | ✅ **closed（本增量闭合）** | 机制层：`prompt()` 成功出口新增共用补刷（`ai-manager.js:1091`），纯文本通道不再是「置脏后永不落地」；K1 行为用例断言出口后 `_skillsPromptDirty === false`、`systemPrompt` 含运行期新增技能、广播 `['skills:changed']` 恰一次。措辞层：`idle 边界` 在 `ai-manager.js` 与 `docs/product/ai-skills.md` **零命中**（旧的 `:401` / `:1433` 两处措辞已改写为「任一轮成功出口（含纯文本轮）」）。上一轮给出的修法 ① 已逐行落地 |
| **WR-08** | Warning | ✅ **closed（本增量闭合）** | ① 重试读盘进独立 try（`:1486-1495`）；② 两个 catch 均**不赋 `result`**（沿用原判定）；③ 告警取值 `err && err.message ? err.message : String(err)`（`:1483` / `:1492`）；④ 补三条行为用例 J8（`Error`）/ J9（`throw null` + `throw 'x'`）/ J10（重试读盘抛原始值，并断言两条告警可判别）。**唯一残余是注释依据本身不成立 → 转记 IN-16** |
| WR-01 | Warning | ❌ **仍开** | `src/renderer.js:8847-8851` 的 `SKILL_TIER_TITLES` 与 `src/skill-picker-model.js:324-340` 的 `TIER_BADGE[*].title` 仍逐字重复三条文案；`docs/product/ai-skills.md:358` 仍声称「不存在第二份徽标实现」。修法：`skillTierTitle`（`:8858-8860`）改读 `window.SkillPickerModel.TIER_BADGE[tier].title` 后删本地副本 |
| WR-02 | Warning | ⚠ **仍开（本增量部分收敛、未闭合）** | 已收敛：上一轮指出的「新增的 1467 行重试读盘在 try 之外」**已修**（现 `:1488` 在 try 内）。**仍暴露**：① 首次读盘 `:1447` 仍是裸 `await skillsManager.readSkillForInvocation(...)`；② 两个调用点 `:1048` / `:1182` 仍是裸 `await this._resolveSkillInvocation(message)`（在 `isProcessing = true` 之后）→ 任一抛出即穿透，`isProcessing` 保持 true，之后所有消息被「AI 正在处理上一条消息」拒绝，直到重建 Agent；③ 真正会抛的入口仍在 `ai-skills-manager.js:808`（`await import(...)` 位于其自身 try `:810-816` **之外**）。修法见 §C |
| WR-03 | Warning | ❌ **仍开** | `src/renderer.js:9993-9999`（`regenerateMessage`）与 `:10071-10077`（`showAIError` 重试）的 `skillError` 分支仍只 `pushSystemNote` 后 return；已被置空的 assistant 占位（`:9985` / `:10067`）在 wrapper 仍挂载并追加 `createMessageActions` → 界面留下**只有「复制」按钮的空壳**。与发送路径的 `removeSkillFailureBubbles`（`:8823`）不一致 |
| WR-04 | Warning | ❌ **仍开**（行号漂移） | `ai-manager.js:1683-1691` 的 `_resolveSkillMarker` 仍只做 `path.isAbsolute + path.resolve`（`:1687`），未做 SDK `normalizeToolPath` 的 `@` 前缀剥离与 `[\u00A0\u2000-\u200A\u202F\u205F\u3000]` 空格折叠 → 这两类模型输出形态下正文被读到、卡片却退化为普通 `read` |
| WR-05 | Warning | ✅ **closed-by-adjudication**（用户 2026-09-12 裁决：收口措辞，不改链路）—— **收口仍只落一半，残余转记 IN-12** | §10.8「呈现时机」已按裁决改写（`docs/product/ai-skills.md:421-425`：「**本轮回合结束（`ai:prompt` 应答返回）时即现**…注意**不是回车那一瞬间**」）；**但 §10.7 的同一句仍写「即时呈现」**（`:392`）—— 本增量**恰好就在编辑 §10.7**（在其尾部追加 G-48-12/G-48-18 条），却未顺手收口上方 30 行处这句已裁决为不准确的旧口径 |
| WR-06 | Warning | ❌ **仍开**（用户裁决保持开放，随 Phase 49） | `ai-skills-manager.js` **零 diff**（本轮 diff 只含 `ai-manager.js` / `AGENTS.md` / docs / tests）→ 形态不变：`readSkillForInvocation` 用调用方传入的**原始**沙箱 env（`:802`），不复查磁盘当前 size，`createSkillsEnv` 的 64 KiB 闸（`:140-183`）只作用于 `refreshSkills` 扫描。**本增量新加的文档条 `docs/product/ai-skills.md:408-410` 已如实写明「本条未被修复，不得据此声称已修」** —— 账本诚实，保留 |
| IN-01 | Info | ❌ 仍开（行号漂移） | `ai-manager.js:6298` 仍 `enhancedContent.indexOf(provenance)`（取首次出现），与自身注释「锚定在 provenance 行」的理由相矛盾 |
| IN-02 | Info | ❌ 仍开（**并新增一处**） | `src/preload.js:979`（`prompt`）与 `:989`（`promptWithContext`）**两处**仍写 `@returns {Promise<{success: boolean, error?: string}>}`，实际契约是 `{conversationId, skillInvocation, skillError?}`。本增量让两个通道的返回**时序**都多了「出口补刷」这一段，JSDoc 失实的面积随之扩大 |
| IN-03 | Info | ❌ 仍开 | `src/renderer.js:10165`：`next < 0` 分支置 `-1` 后直接 `return`，未重渲染 → DOM 高亮与 state 短暂背离 |
| IN-04 | Info | ⏸ 保留原样（观测项，非本阶段代码缺陷） | 弱模型把技能名当**工具**调用的实测观测；归因 SDK 提示词模板（`ai-manager.js:599-604` 的 `buildSystemPrompt` 产物），Realm 无可控代码。去向：Phase 50/51 技能 UX |
| IN-05 | Info | ❌ 仍开 | `src/renderer.js:8046-8056`：`renderAIMessages` 的 `isUser` 分支先建 `content` 容器又被 `buildUserMessageContent(msg)`（`:8055`）整体替换（死分配） |
| IN-06 | Info | ❌ 仍开 | `src/renderer.js:8183-8202`（`refreshUserMessageBubble`）与 `:8093-8095` 的整列渲染**不是** DOM 等价 —— 定向刷新不补 wrapper 级 `.message-actions`，技能气泡在本轮内缺「复制」按钮 |
| IN-07 | Info | ❌ 仍开 | `src/renderer.js:8810`（`if (result && result.skillInvocation)`）+ `ai-manager.js:1111`：技能已成功解析但本轮 run 失败时 `skillInvocation` 回传 `null` → pill / 折叠块永不出现，用户看不出这轮实际注入了哪个技能 |
| IN-08 | Info | ❌ 仍开 | `tests/test-ai-skills.js:1923`（另有 `:1745`）的旧最小夹具（`{sandboxEnv, getSeededSkillNamesSafe}`）只覆盖**缓存命中**路径；miss 分支现在要求 `this.syncAgentSystemPrompt` 存在。本增量的 K 组夹具 `promptCtx`（`:3116`）已补齐全部字段，旧夹具仍未收敛 |
| IN-09 | Info | ❌ 仍开 | `docs/product/ai-skills.md:394` 仍写「**缓存命中时零重扫**（实测不变式）」，真不变式是「命中**且当场读盘成功**时零重扫」（命中但文件被删/正文清空/目录被换同样触发重扫，`ai-skills-manager.js:811-830` 四个 `not_found` 出口） |
| IN-10 | Info | ❌ 仍开 | `docs/product/ai-skills.md:308-311`：第 1 条「不复用缓存里的副本，**也不复用重扫产出的元数据**」与第 2 条「重扫产出的三项判定**就是**该次调用的判定依据」自相矛盾；实现在第 2 条一侧 |
| IN-11 | Info | ❌ 仍开（与 IN-13 / IN-14 同族） | miss 由「零副作用查表」变为「全量重扫 + 整体重建缓存」（`ai-skills-manager.js:556`）；裸名形态无名符闸 → 拼错的名字同样触发重扫；路径穿越不成立（name 只作全等查找键） |
| IN-12 | Info | ❌ 仍开 | 见 WR-05 行：§10.8（`:421-425`）与 §10.7（`:392`）对同一口径给出互相排斥的表述，本增量编辑了 §10.7 却未收口该句 |

---

### B. Critical Issues

**本增量未引入新的 Critical。**

上一轮的两条 Critical（`CR-01` 属性逃逸注入 / `CR-05` 取消标记无生命周期）已在 `3dc3af7` 由用户裁决为 `TD-48-01` / `TD-48-02` 同批延后 —— 缺陷形态**在代码中仍然存在**（见 §A 与文末技术债节），按上一轮同一计数口径**不计入本报告的 `findings.critical`**，也不重复展开论证。**接手人请先读技术债节再动 `src/renderer.js` 的取消分支。**

---

### C. Warnings

> 本增量**未引入新 Warning**。以下六条全部是上一轮台账的延续；每条给出**当前形态**与**具体修法**（未改动原文论证，只更新行号与状态）。

#### WR-01（仍开，行号未漂移）: 三档徽标文案两处重复，且文档声称「不存在第二份实现」

**File:** `src/renderer.js:8847-8851`（`SKILL_TIER_TITLES`）、`:8858-8860`（`skillTierTitle`）、`src/skill-picker-model.js:324-340`（`TIER_BADGE`）、`docs/product/ai-skills.md:358`

**Issue:** 面板徽标的 `title` 文案在 renderer 与 `skill-picker-model` 各存一份，三条逐字重复；产品文档却把「单源」写成了既有事实。

**Fix:**
```js
// src/renderer.js——删掉本地 SKILL_TIER_TITLES，改读面板模型（它在渲染端已可用）
function skillTierTitle(tier) {
  const badge = window.SkillPickerModel && window.SkillPickerModel.TIER_BADGE;
  return (badge && badge[tier] && badge[tier].title) || '';
}
```

#### WR-02（**部分收敛、仍开**）: 技能解析链上的三处裸 `await` —— 抛出即让 `isProcessing` 永不复位

**File:** `ai-manager.js:1447`（**仍裸**）、`:1048` / `:1182`（**仍裸调**）、`ai-skills-manager.js:808`（真抛出点，在自身 try `:810-816` **之外**）

**Issue:** 本增量已把**重试读盘**包进 try（上一轮点名的 1467 行缺口已闭合），但同一链路上还有三处未兜：首次读盘调用（`:1447`）、两个调用点（`:1048` / `:1182`），以及 `readSkillForInvocation` 内部位于其 try 之前的动态 `import`（`ai-skills-manager.js:808`）。任一处抛出都会穿透到 IPC，而 `isProcessing` 已在 `:1043` / `:1179` 置真且不会复位 —— 之后所有消息被「AI 正在处理上一条消息」拒绝，直到重建 Agent。

**Fix:**
```js
// ai-manager.js——两处调用点各包一层（注意：catch 内必须复位，否则症状与不包相同）
let resolved;
try {
  resolved = await this._resolveSkillInvocation(message);
} catch (err) {
  this.isProcessing = false;
  console.error('[Realm AI] 技能解析失败（已复位处理状态）:', err && err.message ? err.message : String(err));
  this._sendEventsBatch([{ type: 'error', message: '技能解析失败，请重试', timestamp: Date.now() }]);
  return { conversationId: this.currentConversationId || null, skillInvocation: null };
}
```
```js
// ai-skills-manager.js:802-808——把动态 import 挪进已有的 try（或给它自己一个 try，返回 not_found）
let loadSkills;
try {
  ({ loadSkills } = await import('@earendil-works/pi-agent-core'));
} catch {
  return { ok: false, reason: 'not_found', name };
}
```

#### WR-03（仍开）: `skillError` 的两个重试路径留下「只有复制按钮」的空壳气泡

**File:** `src/renderer.js:9993-9999`（`regenerateMessage`）、`:10071-10077`（`showAIError` 重试）

**Issue:** 与发送路径（`:8822-8828` 走 `removeSkillFailureBubbles`，`:8870` 起）不一致：这两处只 `pushSystemNote` 后 return，已被置空的 assistant 占位仍留在 `state.aiMessages` 里被渲染并挂 `createMessageActions`。

**Fix:** 与发送路径对齐——在 `pushSystemNote` 前调用 `removeSkillFailureBubbles(aiMsgId)`（或直接把刚 push 的占位 `pop()` 掉）后 `renderAIMessages()`。

#### WR-04（仍开，行号漂移）: `_resolveSkillMarker` 不做 SDK 同款路径归一化 → 卡片退化为普通 `read`

**File:** `ai-manager.js:1683-1691`（判据在 `:1687`）

**Issue:** 只做 `path.isAbsolute + path.resolve`，未做 SDK `normalizeToolPath` 的 `@` 前缀剥离与 `[\u00A0\u2000-\u200A\u202F\u205F\u3000]` 空格折叠 —— 模型输出带你上面这两种形态时，正文读到了、卡片却不是技能样式（48-03 D-15 要求两条链路形状逐字一致）。

**Fix:** 抽出与 SDK `normalizeToolPath` 等价的纯函数（去 `@` 前缀 → 折叠非常规空格 → `path.resolve`），实时链路与 `getConversationMessages` 装饰链路共用。

#### WR-05（closed-by-adjudication，残余转记 IN-12）: 「即时呈现」口径收口只落一半

**File:** `docs/product/ai-skills.md:421-425`（§10.8，已改）vs `:392`（§10.7，**未改**）

**Issue:** 用户已裁决「收口措辞」。§10.8 已准确改写，§10.7 同一句仍是「三件套**即时**呈现」。本增量编辑了 §10.7 却未顺手收口。

**Fix:** 把 `:392` 改为「**本轮回合结束时**呈现（见 §10.8）」，或直接删掉该句改为指向 §10.8。

#### WR-06（仍开 / user-deferred）: 实时读盘路径绕过 64 KiB 正文上限闸

**File:** `ai-skills-manager.js:802`（`readSkillForInvocation`）、`:140-183`（`createSkillsEnv` 的字节闸）、`docs/product/ai-skills.md:408-410`

**Issue:** 一旦技能已进缓存，实时读盘不再复查磁盘当前 size。**用户裁决随 Phase 49 处置，本增量未动该文件**；文档已如实标注「未被修复」。

**Fix:** 在 `readSkillForInvocation` 读盘后比对 `fresh.content` 字节数是否超出 `LIMITS.MAX_SKILL_MD_BYTES`，超限按 `not_found` 处理（与 `refreshSkills` 的闸同口径），或把闸下沉到共用的读盘函数。

---

### D. Info

> IN-01 ~ IN-12 为上一轮台账延续（要点见 §A 表，不重复展开）；IN-13 ~ IN-17 为本增量新增。

#### IN-13（本轮新增）: 成本账本**反向**漂移 —— 出口补刷让「一次 miss」在同轮付**两次**全量重扫，文档仍写「一次」

**File:** `docs/product/ai-skills.md:312`（§10.3 第 3 条）、`:393-395`（§10.7 成本条）、`ai-manager.js:1478`（解析时那次重扫）、`:1091` → `:2910` → `:2835`（出口补刷那次重扫）

**Issue:** `prompt()` 通道上的一次 miss 现在是：解析时 `syncAgentSystemPrompt()`（rescan #1） + 本轮成功出口 `_flushDeferredSkillsPrompt()`（rescan #2）。K1 断言的 `ctx.rescanCalls === 2` 就是这一事实的用例化。而两处文档仍写「误诊一个技能名的代价因而固定为**一次**全量重扫」/「会多付**一次**全量重扫」——**实现是对的，账本落后于实现**（撞上本阶段一直在做的「例数/口径账本」工作）。

**Fix:** `:312` 改为「同轮内**两次**：解析判定 miss 时一次 + 本轮成功出口的延迟补刷一次」；`:393-395` 同口径改写，并补一句「命中路径仍零重扫」。

#### IN-14（本轮新增）: 置脏**不校验实际变化** —— 误诊的代价会延后泄漏到之后任意一条普通消息；`_recreateAgent` 也不清脏标记

**File:** `ai-manager.js:2843-2844`（无条件置脏）、`:1049-1057`（skillError 错误出口**刻意不补刷**）、`:2926-2983`（`_recreateAgent`，`_skillsPromptDigest` 在 `:2976` 更新，**未**复位 `_skillsPromptDirty`）

**Issue:** 两条独立的「代价错位」：
1. `syncAgentSystemPrompt()` 的忙分支**无条件**置脏，不比对 `refreshSkills` 之后的 digest 是否真变。手打一个拼错的 `/skill:nope`（或纯文本轮里任何一次 miss）→ 置脏 → 该轮走 skillError 错误出口、**不补刷** → 标记存活到**下一条普通消息**的出口才被消费（那次仍要做一次全量重扫 + digest 比对，然后「无变化」早退，不改 prompt、不广播）。代价固定、自愈，但账本把代价记在**发起调用**上，实际可能落在**无关的后续轮次**。
2. Agent 重建后 `systemPrompt` 已是 `buildSystemPrompt()` 的最新值、`_skillsPromptDigest` 也已同步，但陈旧脏标记仍在 → 新 Agent 上第一条成功消息白付一次全量重扫。

**Fix（两行级）:**
```js
// ① 忙分支只在「重扫确有变化」时置脏（与 2851 的判据同源，改为先算 digest 再判忙）
const snap = getAiSkillsManagerLazy().getSkillsSnapshot();
if (this.isProcessing || (this.agent.state && this.agent.state.isStreaming)) {
  if (snap.digest !== this._skillsPromptDigest) this._skillsPromptDirty = true;
  return;
}
// ② _recreateAgent() 在记录 digest 的同一处（:2976）补一行：
this._skillsPromptDirty = false;   // 新 Agent 的 prompt 已是最新，无需补刷
```

#### IN-15（本轮新增）: 「变更绝不静默丢弃」有两个**非错误**的洞 —— 复位先于同步

**File:** `ai-manager.js:2905-2919`（`_skillsPromptDirty = false` 在 `:2908`、同步在 `:2910`）、`:2832`（早退 A：无 Agent / 无沙箱）、`:2851`（早退 B：digest 与 prompt 双双未变）

**Issue:** 契约 2（检脏早退）要求复位发生在同步**之前**，于是「复位后同步什么也没做且不抛错」的两种情况都会把待回写标记**静默清掉**：早退 A（`:2832`）连重扫都不做 —— 标记被消费且零效果；早退 B 无害（prompt 本来就不需要改）。可达性诚实标注：两个调用点直前都能保证 `this.agent` 非空（`prompt()` 在 `:1019-1030`、`promptWithContext()` 在 `:1155-1166`），但 `_cleanupCurrentAgent()`（切对话 / 删对话）可以在 `waitForIdle()` 之前的 await 期间把 `this.agent` 置空 —— 此时出口补刷就会命中早退 A。实际后果为零（下次发送必走 `_recreateAgent()` 的全量重扫），故**只记 Info**；问题在于契约 4 的措辞（「变更绝不静默丢弃」）读起来是无条件的。

**Fix:** 二者任一即可：
```js
// ① 把早退 A 变成「保留脏标记」的出口
async _flushDeferredSkillsPrompt() {
  if (!this._skillsPromptDirty) return;
  if (!this.agent || !this.sandboxEnv) return;   // 无处落地 → 保留标记，交给 Agent 重建后的出口
  this._skillsPromptDirty = false;
  try { await this.syncAgentSystemPrompt(); }
  catch (err) { this._skillsPromptDirty = true; console.warn(/* … */); }
}
// ② 或在文档/注释里把契约 4 收口为「失败时绝不静默丢弃；Agent 缺失时标记暂存」
```

#### IN-16（本轮新增）: 跳过重试读盘的注释依据在本仓不成立；附**对上一轮 WR-08 ① 的实测更正**

**File:** `ai-manager.js:1427-1430`（JSDoc 第 3 条）、`:1466-1469`（`rescanned` 的原地注释）、`ai-skills-manager.js:468-637`（`refreshSkills` 的 try + catch-回滚）、`:488-489`（其动态 import 在 try **内**）、`:2836-2840`（`syncAgentSystemPrompt` 中真正会抛的三个取值点）

**Issue:** 注释给出的理由是「整批失败会回滚缓存三件套 ⇒ 缓存未变 ⇒ 重读必然与首次同形」。核证结果：
- `refreshSkills()` **契约上永不抛错**（`:468` 起的整段 try 在 `:625` 被 catch 吞掉，只 `pushError` 诊断并回滚三件套后 `return _cache`）——「整批失败」不会以**抛出**的形态抵达 `_resolveSkillInvocation` 的 catch；
- `syncAgentSystemPrompt()` 里唯一能抛的是 `configStore.get` / `getManagedSkillsDir` / `getSkillsDir`（`:2836-2840`），三者都在 `refreshSkills` **之前**；忙分支（`:2843-2846`）又在 `buildSystemPrompt()`（`:2849`）之前返回，故本路径**不存在**「缓存已更新但后续抛错」的形态。

结论（缓存未变 ⇒ 跳过重读不误判）**成立**，但依据是「`refreshSkills` 不抛错 + 抛出点在其之前」，而**不是**注释写的「整批失败会回滚」。这是**有潜在翻转风险的注释**：一旦有人把 `refreshSkills` 改成「整批失败即抛错」（一个很常见的「别吞失败」重构方向），`if (rescanned)` 的跳过就会把**已刷新成功、缓存里已有**的技能判成 `not_found`（作者在 `:1466-1469` 只标了「若日后调用点改成非忙」这一种反例，漏了这条）。

**附：对上一轮 WR-08 ① 实测前提的更正。** 上一轮写「同一方法在 `:1445` 已成功 import 过同一说明符，故 `:1467` 再 import 基本不可能拒绝」——**该前提对 miss 路径不成立**：miss 时 `readSkillForInvocation` 在 `ai-skills-manager.js:804` 就已 `return`，**根本走不到 `:808` 的 import`；真正让重试读盘那次 import 必然命中注册表的是**前一步 `syncAgentSystemPrompt()` → `refreshSkills()` 的 `:488` import**。结论（重试读盘不可达抛出）不变，但依据须换成这一条 —— 否则接手人会按「首次读盘已 import」去推演，误判 `:1447` 的裸调同样不会抛（**它会**：`readSkillForInvocation` 内部位于 try 之前的 import 就是 WR-02 ③ 的那一处）。

**Fix:** 把 `:1427-1430` 与 `:1466-1469` 的依据改写为「本路径唯一的抛出点族是 `syncAgentSystemPrompt()` 中先于 `refreshSkills` 的三个取值点（`:2836-2840`），且 `refreshSkills()` 契约上不抛错（`ai-skills-manager.js:625-637`）——故重扫抛出时缓存必未变」；并补一句「若 `refreshSkills` 改为整批抛错，须重新评估 `rescanned` 跳过是否仍正确」。成本更低的做法是把 `rescanned` 换成「重扫后 digest 是否变化」的判定，从结构上消掉这条隐性依赖。

#### IN-17（本轮新增）: K5 与 SKILL-04 护栏**八条断言逐字重复**；且护栏口径严于它编码的不变式

**File:** `tests/test-ai-skills.js:1318-1348`（`Agent prompt 回写（SKILL-04）` 内改写后的护栏）与 `:3252-3282`（K5）

**Issue:** 两条 gate 用同一个 `methodBody` 提取 + 同一组断言（检脏早于复位 / 复用 `syncAgentSystemPrompt` / 恢复置脏在同步之后 / 两个成功出口各含一次调用 / `promptWithContext` 无 `_skillsPromptDirty` / 全文件恰 2 处）**逐字重复**，只差变量名与一句 `body.length >= 150` 的假绿哨兵。两处各自演化会让后续改动者面对互相矛盾的 gate。另：`withContext.includes('this._skillsPromptDirty') === false` 是**文本**断言，会把「在 `promptWithContext` 的注释里提及该标识符」判成红 —— 而本文件的既有风格恰恰在 JSDoc 里这样写（`syncAgentSystemPrompt` 的注释 `:2823-2825` 就写了）。这是一条**假红**风险（不是假绿：成功/错误出口的语义由 K1 / K3 的行为断言兜住）。

**Fix:** 删掉其中一份（建议保 K 组那份、把 SKILL-04 那份改为一行指针注释）；文本断言收敛为「`promptWithContext` 方法体内不得出现 `this._skillsPromptDirty` 的**赋值/读取语句**」，例如改为对 `methodBody` 做 `/\bthis\._skillsPromptDirty\s*=/` 与 `if\s*\(\s*(!?)this\._skillsPromptDirty/` 两个正则断言，豁免注释。

---

## Accepted Tech Debt（阶段 48 UAT 收尾裁决 —— 本轮原样继承）

> 本节是上一轮 48-REVIEW 技术债节的**原样继承**（本文件已覆盖同名路径，故在此保留）。裁决前提不变：**48 不进正式版发布**（用户 2026-09-12 确认「暂时不发版」）。每条都带**接手触发点**，不依赖任何自动化门禁重新发现。**本增量未触及这两条的代码。**

### TD-48-01 ← CR-01 属性逃逸注入（延后）

- **裁决：** 延后，不进本阶段修复。2026-09-12 UAT test 1。
- **接手触发点：** Phase 49 开工前**第一条**（`manage_skill` 落地前）。Phase 49 会让 AI 常规化地创建技能目录，扩面后再补代价更高。

> ⚠️ **以下两条是对 CR-01 原文的实测更正**（2026-09-12 用 playwright `_electron` 驱动真实 dev 应用取得）。
> CR-01 原文「把 payload 换成 `onmouseover="…"` 就是事件处理器注入」「注入代码在主窗口 renderer 执行，该上下文持有 `window.realmAPI` 全量 IPC」**不成立**，勿据此定级。

- **✅ 注入成立（实测）：** 在 `managed-skills/` 下建目录名 `pwn" onmouseover="document.documentElement.dataset.pwned=1" data-x="y`，打开 `/` 面板后该行**真实 DOM 属性**为：`class` / `data-index` / `title="/skill:pwn"`（被引号截断）/ `onmouseover` / `data-x="y 可显式调用"` —— 即 `escapeHtml` 不转义引号的属性逃逸**确实发生**，注入体成为真实属性。
- **❌ 代码执行被 CSP 拦掉（实测，决定性）：** `src/index.html:8-9` 有 CSP `script-src 'self'`（无 `unsafe-inline`），内联事件处理器**不被编译**。同文档内对照实测：`innerHTML` 注入 `onmouseover` → 属性在、`el.onmouseover === null`、真实 `mouseover` 派发后计数器未置位；程序化赋值 `el.onmouseover = fn` → `typeof === 'function'` 且正常触发（对照组）。
- **残余真实影响（降级为 minor 级缺陷，非 blocker）：** ① `style` 属性注入**可行**（CSP `style-src 'self' 'unsafe-inline'`）→ CSS 注入 / UI 重绘伪装；② 任意属性注入污染 DOM 结构；③ **潜在 XSS**：一旦 CSP 放宽（加 `unsafe-inline`）或该模板被复用到无 CSP 上下文，即刻升级为可执行。安全性归因应改为「纵深防御兜住了，但转义缺陷仍在」。
- **附带更正：** `AGENTS.md` 的「主窗口（`file://` 加载，无 CSP）」表述有误 —— 主窗口**有** CSP（`src/index.html:8`），只是 `style-src` 含 `unsafe-inline` 使内联 style 可用（弹框居中那节的结论仍成立，但理由不该是「无 CSP」）。
- **⚠ 不要指望 secure-phase 兜住（两处，均本轮核过行号）：** `48-01-PLAN.md:434` 的 T-48-03（Tampering / high / mitigate）声明的缓解措施正是「`name` / `description` / `statusText` / `title` 一律经 `escapeHtml()`」——即失效的那个机制，secure-phase 的短路规则会读成已缓解。**同表 `:432` 的 T-48-01 也已陈旧**：它声明的缓解措施写「`fresh.name !== name` → `not_found`（防目录被换后冒名注入）」，而该判据已由 G-48-2（CR-02）替换为**目录路径全等**（`ai-skills-manager.js:820-827`）——两条 mitigation 声明都与现行实现脱节，接手时应一并订正 PLAN 台账。**另：阶段 48 至今未建 `48-SECURITY.md`**，secure-phase 若在本轮后运行，请以上文更正为准，不要采信 PLAN 的 mitigation 声明。
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

- **同批相邻项（IN-06 / IN-07）：** `refreshUserMessageBubble` 不补 wrapper 级 `.message-actions`；「技能已解析但本轮 run 失败时 pill / 折叠块永不出现」（`ai-manager.js:1111`）。

### WR-05 / WR-06 的裁决（2026-09-12 用户拍板）

- **WR-05：** 用户裁决**收口措辞**，不改链路。§10.8 已落地（`:421-425`）；**但 §10.7 的同一句仍写「即时」（`:392`）→ 收口只落一半，本轮维持转记 IN-12**（成本一行，建议下次编辑 §10.7 时顺手改掉）。
- **WR-06：** 未裁决修复时机，**保持开放**；`docs/product/ai-skills.md:408-410` 已如实写明「本条未被修复，不得据此声称已修」——账本口径正确，保留。

---

## 备注（本轮复核过、不构成 finding 的点）

- **本增量新增的测试是**真**门禁（逐条在旧实现下必然红），不是「同义改写」：K1 的两项断言（出口后 `_skillsPromptDirty === false`、`channels` 恰为 `['skills:changed']`）在 `a211abf` 的 `prompt()`（无补刷、该通道零消费点）下必然失败；J8 的 `readCalls === 1` 在旧形态（重试读盘在 try 外，无论如何都会读第二次）下必然失败；J9 的 `throw null` 在旧 catch（裸读 `err.message`）下会在 catch 体内二次抛 `TypeError` 使 `invokeSkill` reject；J10 的 `readCalls === 2` 在旧形态下直接逃逸。三条 J 负例的判据（`skill_not_found` / `readCalls` / 告警文案可判别）都**不可被同义改写满足**。
- **K 组夹具纪律正确**：`promptCtx`（`tests/test-ai-skills.js:3116`）用 `Object.create(aiManager.prototype)` 取原型方法、own property 只补出口真正读到的字段，并用**包装而非重写**的方式计数 `syncAgentSystemPrompt`（`realSync.call(this)`）—— 因此「`syncAgentSystemPrompt` 方法体逐字未改」这条硬约束没有被测试绕过。K3 的「错误出口不补刷」与 K2 的「早退零成本」构成一对边界，K4 把「`_cleanupCurrentAgent` 不碰标记」钉成门。
- **出口补刷不会自激**：`skills:changed` 的 renderer 处理器（`src/renderer.js:4405-4407`）只调 `pullAiSkillsSnapshot()`，该方法（`:9081-9094`）在 digest 相同即早退、`slashPickerOpen` 为假时连渲染都不做，**绝不**触发主进程重扫 —— 本增量把广播频率从「极罕见」提到「每次 miss 轮」，这条约束仍然成立，已复核。
- **出口补刷不会与并发轮次打架**：`prompt()` 在 `:1086` 已置 `isProcessing = false` 后才补刷，补刷内的 `syncAgentSystemPrompt()` 若撞上另一窗口刚置位的 `isProcessing`，会走忙分支只置脏并返回（不抛错）→ 由那一轮的成功出口消费；补刷自身的 await 窗口虽被拉长（一次全量重扫），但 `waitForIdle()` 已返回、该轮 run 已结算，故不存在「两轮同时流式」。**代价是该窗口内 `state.aiStreaming` 保持为真**（发送按钮仍显示「停止」）—— 属性能/观感面，v1 范围外，仅备注。
- **`resolveCancelAttribution` 的 `resetRunState` 边界是刻意且正确的**：`resetRunState = !!cancelledId && cancelledId === currentId`（`src/ai-cancel-state.js:58`）与消息列表形态解耦 —— 这正是「消息已被移除也仍要切回发送按钮」这一既有语义不丢的原因。不要为了修 TD-48-02 把它改成「有 targetIndex 才复位」；TD-48-02 的修法在**标记生命周期**，不在解算函数。
- **`_recreateAgent()` 不重置 `_skillsPromptDirty` 属既有代码**（本增量未改它），但被 IN-14 点名后建议顺手补一行；它**已经**用「新 prompt + 同步 digest」（`:2976`）保证首次 `syncAgentSystemPrompt()` 走「无变化」早退（WR-03 的老修法），故后果仅是一次多余重扫。
- **`refreshSkills` 的失败回滚与本增量相容**：整批失败回滚 `skills` / `promptBlock` / `diagnostics` 三件套（`ai-skills-manager.js:625-636`），`digest` / `refreshedAt` 的赋值（`:623-624`）位于风险段之后，故不会出现「摘要超前于内容」；`syncAgentSystemPrompt` 也遵循「先记摘要、再改写 prompt」（`:2853-2855`）。同时这也是 IN-16 的根：`refreshSkills` **吞掉**整批失败而不抛出。
- **`AGENTS.md` 维护约定合规性（本增量）**：属「实时读盘 / 回写落地时机」口径变更，维护约定（`AGENTS.md:272`）要求同步权威章节 + 测试清单。核：`docs/product/ai-skills.md` 的「发现与调用」章 §10.7 已更新（四项清单 + 失败恢复 + 残余窗口）；`AGENTS.md:267` 的测试清单已加两条覆盖面并刷成 147 例。**合规。** 唯一未同步的是 §10.7 的「即时呈现」措辞（原样保留 → IN-12）与两处成本账（→ IN-13）。
- **`/compact` 期间迟到取消会清掉 compression 按钮态**（`src/renderer.js:9410` 的 `updateSendButtonState(false)` 无条件覆盖 `:9149` 的 `updateSendButtonState(false, true)`）—— 既有行为，且被 `if (state.aiCompacting) return;`（`:8676`）兜住，不计为 finding（行号沿用上轮，本增量未触及）。
- **`handleStopAI` 的 `if (state.aiCurrentMessageId)` 守卫**（`:8381`）在现有状态机下与旧语义等价（置位 / 清理点成对），未找到「streaming=true 而 currentMessageId=null」的可达态。
- **性能面（v1 范围外，沿用上一轮口径并新增一条）**：`getSeededSkillNamesSafe()` 每次调用都 `readdirSync` + 逐技能 `existsSync`，`_resolveSkillMarker` 按**每条** toolExecution、`_skillTierByLocation` 按**每条** user 行各调一次；本增量又让每次 miss 的轮次多付一次出口全量重扫（IN-13）。主进程同步阻塞面扩大，建议在 `getConversationMessages` 整批装饰时算一次向下传参。仍**不作为缺陷计分**。

---

_Reviewed: 2026-09-12T16:19:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Review kind: incremental re-review · round 3（plan 48-08 / G-48-18 + G-48-19；baseline `a211abf`，reviewed `be36401`）_

---
phase: 48-skill-name
verified: 2026-09-12T16:50:43Z
status: human_needed
score: 66/68 must-haves verified
covered_files: [".planning/REQUIREMENTS.md",".planning/phases/48-skill-name/48-01-PLAN.md",".planning/phases/48-skill-name/48-01-SUMMARY.md",".planning/phases/48-skill-name/48-02-PLAN.md",".planning/phases/48-skill-name/48-02-SUMMARY.md",".planning/phases/48-skill-name/48-03-PLAN.md",".planning/phases/48-skill-name/48-03-SUMMARY.md",".planning/phases/48-skill-name/48-04-PLAN.md",".planning/phases/48-skill-name/48-04-SUMMARY.md",".planning/phases/48-skill-name/48-05-PLAN.md",".planning/phases/48-skill-name/48-05-SUMMARY.md",".planning/phases/48-skill-name/48-06-PLAN.md",".planning/phases/48-skill-name/48-06-SUMMARY.md",".planning/phases/48-skill-name/48-07-PLAN.md",".planning/phases/48-skill-name/48-07-SUMMARY.md",".planning/phases/48-skill-name/48-08-PLAN.md",".planning/phases/48-skill-name/48-08-SUMMARY.md",".planning/phases/48-skill-name/48-REVIEW.md",".planning/phases/48-skill-name/48-VALIDATION.md","AGENTS.md","ai-manager.js","ai-skills-manager.js","docs/product/ai-skills.md","ipc-handlers.js","src/ai-cancel-state.js","src/index.html","src/preload.js","src/renderer.js","src/skill-picker-model.js","src/styles/main.css","tests/test-ai-cancel-state.js","tests/test-ai-skills.js","tests/test-skill-picker-model.js"]
covered_digest: "v1:sha256:edbf57945fd50aa99416626cd1f6a050d9cf0828912bf797dadd78357fcba614"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 44/52
  previous_verified: 2026-09-12T14:33:42Z
  gaps_closed:
    - "G-48-18（WR-07）**代码面**（48-08）：延迟补刷抽成唯一实现 `_flushDeferredSkillsPrompt()`（`ai-manager.js:2905-2919`），`prompt()`（`:1091`）与 `promptWithContext()`（`:1333`）两个**成功出口**各共用一次（全文件 `await this._flushDeferredSkillsPrompt()` **实测恰 2 处**，`promptWithContext` 体内零 `_skillsPromptDirty` 残留）；纯文本 `/skill:<运行期新增名>` 成功后脏标记归 `false`、`agent.state.systemPrompt === buildSystemPrompt()` 且含该技能、`skills:changed` 恰广播一次（K1 实跑）；脏标记为假时零重扫（K2 `rescanCalls === 0`）；错误出口与 `_cleanupCurrentAgent()` 不补刷（K3/K4）。旧实现下 K1/K5 与改写后的 SKILL-04 护栏**实测必红**（本轮独立在 `a211abfb` 工作树复跑：6 fail，含 K1/K5/J8/J9/J10 与 `源码：延迟补刷是单源实现`）"
    - "G-48-19（WR-08）**代码面**（48-08）：`_resolveSkillInvocation()` 的 miss 重试块改为**两个各自独立的 `try`** + `rescanned` 局部标志；重扫抛错（Error / `throw null` / `throw 'x'`）时调用正常 resolve、判定沿用 `skill_not_found`、不升级第三码、**不重复读盘**（J8 `readCalls === 1`）；重扫成功但重试读盘抛错时同样沿用原判定（J10 `readCalls === 2`）；两条告警文案可判别（J10 反向断言「重扫失败」**不存在**）；err 取值一律 `err && err.message ? err.message : String(err)`（`:1483` / `:1492`）"
    - "G-48-12（48-07 遗留的运行期面）：**已由 UAT round 3 test 14 自动驱动探针回填闭合** —— 本轮不再作为待办。`48-UAT.md` 的 `G-48-12.status` 已由 `failed` 回填为 `resolved`（`resolution_evidence` 含 `/tmp/uat48-r3-t14.json`）；`.planning/WINDOWS.md` unrun-verify **id 24** 已 `windows fixed`（`resolved_at: 2026-09-12T15:02:36.971Z`）。上游证据：主进程日志出现 `发送消息: /skill:uat-r3-24650778 你好`、零 system-note、回复 `探针技能已生效` 与新文件正文逐字一致（23 字符）"
    - "上一轮 4 项 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED 中的 4 项（真相 25 / 26 / 28 / 29 / 43，共 5 条中 5 条）本轮由运行期探针或新增行为用例升级为 ✓ VERIFIED（详见真值表）"
  gaps_remaining: []
  regressions: []
  history:
    - "round 1 | verified 2026-09-12T06:50:49Z | status human_needed | score 24/28 | gaps_closed [] | gaps_remaining [G-48-2, G-48-3, G-48-4, G-48-6] | regressions []"
    - "round 2 | verified 2026-09-12T12:25:00Z | status human_needed | score 31/36 | gaps_closed [G-48-2 / CR-02 判据改目录路径全等 + 注入名重写（48-04）; G-48-3 / CR-04 renderer 两段陈旧快照本地否决整段删除 + skills:changed 无条件重拉（48-06）; G-48-4 / CR-03 源码面 取消归属改锚点解算 + 独立纯逻辑模块（48-05）; G-48-6 气泡构建单源 + 回填后定向刷新（48-05）] | gaps_remaining [G-48-12] | regressions []"
    - "round 3 | verified 2026-09-12T14:33:42Z | status human_needed | score 44/52 | gaps_closed [G-48-12 代码面 —— miss 一次性权威重扫 + 重试读盘，rescanCalls === 1，ai-skills-manager.js 零 diff] | gaps_remaining [G-48-12 运行期面（UAT test 12 / WINDOWS.md id 24）] | regressions []"
    - "round 4（本轮 · 48-08 / G-48-18 + G-48-19）| verified 2026-09-12T16:50:43Z | status human_needed | score 66/68 | gaps_closed [G-48-18 代码面（唯一补刷实现 + 两处成功出口共用 + 检脏早退 + K1-K5）; G-48-19 代码面（两个独立 try + rescanned + 可判别告警 + 安全 err 取值 + J8/J9/J10）; G-48-12 运行期面（UAT test 14 回填 + WINDOWS id 24 fixed）] | gaps_remaining [] | regressions []"
open_deferrals:
  - id: TD-48-01
    origin: "48-REVIEW.md CR-01（面板行 `title` 属性经 `escapeHtml` 注入 —— `escapeHtml` = DOM `textContent → innerHTML`，不转义 `\"`）"
    adjudicated: 2026-09-12
    disposition: "延后，登记为技术债（前提：暂时不发版）；接手触发点 = Phase 49 开工前第一条（`manage_skill` 落地前）"
    measured_impact: "UAT test 5 实测：属性逃逸成立，但主窗口 CSP `script-src 'self'` 使内联事件处理器不被编译 → 残余影响降为 minor（CSS 注入 / UI 伪装 / 潜在 XSS）"
    must_have_effect: "无 —— 48-02 禁止项的字面要求（插值全部经 `escapeHtml()`、tier → class 走白名单查表）仍然成立，故真相 34 记 VERIFIED；本条按用户裁决作为已跟踪的开放延后记录，不重开为 BLOCKER"
    code_untouched_this_round: "`src/renderer.js` 在本轮增量（48-08）中零 diff —— 缺陷形态与行号均未变（`48-REVIEW.md` §A 记 `:10426-10431` / `:11350-11353`）"
  - id: TD-48-02
    origin: "48-REVIEW.md CR-05（`aiCancelledByUser` / `aiCancelledMessageId` 无正常结算清理点，窄竞态下跨轮污染）"
    adjudicated: 2026-09-12
    disposition: "延后，登记为技术债；接手触发点 = Phase 49 开工前（与 TD-48-01 同批）；不要求本阶段 UAT 实测"
    must_have_effect: "**本轮无 must-have 影响** —— 上一轮它使真相 25（G-48-4 运行时半边）无法记 VERIFIED；本轮该真相由 UAT round 3 test 16 的三轮独立自动驱动实测证成（取消落在**被中止轮**、新气泡 0→108 持续增长、停止按钮未提前回退），故记 VERIFIED。TD-48-02 描述的是**另一条不变式**（「结算瞬间连点停止」后的跨轮标记污染），不覆盖本条真值的场景，故不作为本条的门"
    code_untouched_this_round: "`src/renderer.js` 在本轮增量中零 diff"
  - id: WR-02
    origin: "48-REVIEW.md WR-02（技能解析链上的三处裸 `await` —— 抛出即让 `isProcessing` 永不复位）"
    adjudicated: "用户未裁定；48-08 的 prohibition P5 明文禁止顺手闭合"
    disposition: "**部分收敛、仍开**。48-08 只把**本次新增的调用点**（重试读盘）纳入独立 `try`；`ai-manager.js:1048` / `:1182` 两处裸调、`:1447` 首次 `readSkillForInvocation`、以及 `ai-skills-manager.js:808` 位于其自身 `try` 之前的动态 import **仍暴露**（本轮实测三处均为裸调，见证据列）"
    must_have_effect: "无。48-08 PLAN 的 prohibition P5 明确「不得顺手闭合 WR-02」，故本阶段**未**将其计入缺口；作为已记档的开放 Warning 与 advisory 保留"
  - id: WR-06
    origin: "48-REVIEW.md WR-06（`SKILL.md` 超 64 KiB 的已缓存技能在实时读盘路径绕过字节闸）"
    adjudicated: 2026-09-12
    disposition: "用户裁决**保持开放**，随 Phase 49 一并处置；`ai-skills-manager.js` 本增量**零 diff**；`docs/product/ai-skills.md` §10.7 显式写明「本条**未被修复**…**不得**据此声称已修」（本轮实读确认原文在册）——账本诚实"
    must_have_effect: "无 —— 48-01 的字节闸 truth 只约束扫描路径的长度常量语义，不宣称调用路径复查"
behavior_unverified_items:
  - truth: "G-48-18 的**组合面**（48-08 诚实边界声明里的「②」）：已打开的 `/` 面板或模型自动匹配面，在**纯文本轮**补刷落地后**随之**可见运行期新增技能"
    test: "重跑 `/gsd-verify-work 48` 自动驱动探针（48-08 SUMMARY 已给出形态）：先打开 `/` 面板 → 在 `agent-workspace/managed-skills/` 下运行期新建目录 → **不重开面板**直接手打 `/skill:<新名>` → 断言面板已出现该行且主进程有 `发送消息: /skill:<新名>` 日志；再追问「你有哪些技能？」验证模型是否已能列出该新技能"
    expected: "面板（已打开、未重开）出现新行；模型侧 system prompt 已含该技能（K1 已在 Node 宿主证成 `systemPrompt === buildSystemPrompt()` 且含该技能名），故模型应能按其 description 匹配"
    why_human: "该面的两半各自已证成，但**接起来**的运行时链路无任何测试或探针行使：① 补刷落地属主进程纯逻辑，由 K1-K5 在**真实 `syncAgentSystemPrompt()`** 上钉死；② 广播→renderer 无条件重拉（48-06 已落地并有护栏）→面板原地重渲染（48-02 已测）+ SDK 提示词模板的 `read` 指令。48-08 SUMMARY 与 PLAN 均**显式声明**该组合面的运行时终证归下一轮 `/gsd-verify-work 48` 的自动驱动探针。本轮为静态 + 单测面复验，**未**驱动真实应用"
  - truth: "48-02 backstop（真相 20）：50+ 技能数据集下 220px 面板的分组标题 sticky 常驻、行五要素可读、行尾标注无一截断"
    test: "按 `48-VALIDATION.md` §Manual-Only Verifications 的脚本向 `skills/` 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区"
    expected: "分组标题 sticky 常驻；行五要素可读；行尾标注 flex-wrap 后无一截断"
    why_human: "纯视觉观感（sticky 常驻、换行行高、徽标对比度）无法由源码扫描或 node:test 裁决。UAT test 7 已由自动驱动实测判 pass（sticky 偏移 1px、截断计数 0、emptyDesc 0、限额标注 14+1 与算术一致），本项保留为人工可推翻的观感裁决；`.planning/WINDOWS.md` id 21 仍 `open`"
advisory:
  - finding: "WR-02（部分收敛、仍开）：`ai-manager.js:1048` / `:1182` 两处裸调 `_resolveSkillInvocation(message)`、`:1447` 首次 `readSkillForInvocation`、`ai-skills-manager.js:808` 位于其自身 `try` 之前的动态 import —— 任一抛出都会穿透到 IPC，而 `isProcessing` 已在 `:1043` / `:1179` 置真且不复位，之后所有消息被「AI 正在处理上一条消息」拒绝，直到重建 Agent"
    category: architectural
    reason: "48-08 只把**本次新增的调用点**（重试读盘）纳入 try，且其 prohibition P5 **明文禁止**顺手闭合 WR-02（用户未裁定）。本轮独立复核三处仍为裸调（源码实读 `:1048` / `:1182` / `:1447`），但**无**任何命名测试变红或可复现运行期观测，按 re-verification evidence gate 记 Advisory、不计入 Step 9 Rule 1，不阻断本阶段"
    evidence_status: "source-read verified（三处调用点逐行实读；`48-REVIEW.md` §C.WR-02 同款核证）"
  - finding: "IN-13 / IN-14 / IN-15 / IN-16 / IN-17（`48-REVIEW.md` 本增量新增的 5 条 Info）：成本账本反向漂移（一次 miss 在 `prompt()` 通道上同轮付**两次**全量重扫，K1 的 `rescanCalls === 2` 即反证，而 docs §10.3/§10.7 仍写「一次」）；忙分支无条件置脏 + `_recreateAgent()` 不清脏标记；补刷「先复位后同步」在 `syncAgentSystemPrompt()` 的两条**不抛错**早退下会静默清掉标记；跳过重试读盘的注释依据（「整批失败会回滚」）在本仓不成立（真依据是 `refreshSkills()` 契约上不抛错 + 抛出点在其之前）；K5 与 SKILL-04 护栏八条断言逐字重复"
    category: other
    reason: "均为口径 / 账本 / 注释依据 / 护栏去重层面的残余，无一 falsify 任何已登记 must-have 真值：K1-K5 与 J8-J10 的断言语义全部成立，失败码域与三字段单源未变。其中 **IN-16 是唯一有潜在翻转风险的**（若日后把 `refreshSkills` 改成「整批失败即抛错」，`if (rescanned)` 的跳过会把已刷新成功的技能判成 `not_found`），建议在 Phase 49 前处置"
    evidence_status: "independently reproduced（本轮实读 `ai-manager.js:1476-1495` / `:2905-2919` / `:2836-2840` 与 `ai-skills-manager.js:468-637`；K1 实测 `rescanCalls === 2`）"
  - finding: "IN-12（`48-REVIEW.md` WR-05 残余）：`docs/product/ai-skills.md:392` 的（G-48-4 + G-48-6）条目仍写「三件套**即时**呈现」，与同文件 `§10.8（:421-425）` 已按 2026-09-12 裁决收口的「本轮回合结束时即现…**不是回车那一瞬间**」互相排斥"
    category: other
    reason: "48-05/48-06 遗留，非本增量引入；48-08 恰好编辑同一节（在其尾部追加 G-48-12/G-48-18 条）却未顺手收口（成本一行）。该句约束的是**气泡呈现时机**（G-48-4 + G-48-6），不属 48-08 must-have 的「延迟回写与广播何时落地」枚举范围，故不 falsify 任何本条真值"
    evidence_status: "independently reproduced（两处原文实读）"
  - finding: "台账滞后（本轮新发现）：`.planning/ROADMAP.md:238` 仍写「8/8 plans executed（48-01..07 已执行；**48-08 待执行** …）」—— 与同行的 `8/8`、与 `Plans:` 段 `- [x] 48-08-PLAN.md`、与 48-08 已有 SUMMARY 自相矛盾；`.planning/WINDOWS.md` id 22（G-48-6 落盘探针）/ id 23（G-48-4 落盘探针）仍 `status: open`，而其声明的终证探针（UAT test 6 clause 1 / test 4）已在 UAT round 2 test 9/10 与 round 3 test 15/16 **实测通过**"
    category: other
    reason: "纯台账同步滞后，不 falsify 任何 must-have（真值由 UAT 实测记录与源码共同支撑）。id 22/23 的收口点是 `/gsd-verify-work 48` 而非 48-08 计划（48-08 刻意不改 WINDOWS.md，见其 Task 3 步骤 9）"
    evidence_status: "independently reproduced（ROADMAP / WINDOWS 原文实读 + `48-UAT.md` 实测记录交叉核对）"
  - finding: "WR-01 / WR-03 / WR-04 / WR-05 与 IN-01..IN-11（`48-REVIEW.md` §A 台账 6 条 Warning / 12 条 Info 中的其余项）：本轮全部仍开"
    category: other
    reason: "均为已记档的技术债 / 观测项 / 死代码，无一 falsify 已登记 must-have 真值；48-08 的 prohibition 明文禁止顺手修 WR-01 / WR-04 / WR-05 / WR-06 与两条 TD，本增量遵守"
    evidence_status: "carried-forward（48-REVIEW.md §A 台账逐条实读，本轮未独立复跑其探针）"
human_verification:
  - test: "重跑 `/gsd-verify-work 48` 的自动驱动探针 —— **G-48-18 组合面**（本轮唯一的功能性待证项，也是唯一阻断收尾的项）：先打开 `/` 面板 → 在 `agent-workspace/managed-skills/` 下**运行期**新建一个技能目录 → **不重开面板** → 直接手打 `/skill:<新名>`"
    expected: "① 面板已出现该新行（广播 → renderer 无条件重拉快照 → 面板原地重渲染）；② 主进程日志出现 `发送消息: /skill:<新名>`；③ 零 system-note；④ 随后追问「你有哪些技能？」时模型能列出该新技能（其 description 已进 system prompt）。失败面（例如面板未刷新）会 falsify 组合面，但**不**推翻 K1 已证成的主进程半（补刷确实落地）"
    why_human: "组合面 = 「广播 → renderer 重拉 → 面板重渲染」+「systemPrompt 更新 → 模型可见」两条运行时链的相交，node:test 无 DOM 宿主也无真实 IPC。48-08 SUMMARY 自己声明「其运行时终证可由下一轮 `/gsd-verify-work 48` 的自动驱动探针复核，形态与判据写进 SUMMARY」，本轮**未**驱动真实应用"
  - test: "重跑 UAT test 7（48-02 backstop，`.planning/WINDOWS.md` unrun-verify id 21）：向 `skills/` 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区"
    expected: "分组标题 sticky 常驻；行五要素可读；行尾标注 flex-wrap 后无一截断。UAT test 7 已由自动驱动实测判 pass（sticky 偏移 1px、截断计数 0、emptyDesc 0、限额标注 14+1 与算术一致），本项仅为人工可推翻的**观感**裁决"
    why_human: "纯视觉观感（sticky 常驻、换行行高、徽标对比度）无法由源码扫描或 node:test 裁决"
---

# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`）Verification Report

**Phase Goal:** 用户可在聊天输入框用 `/` 发现技能、以 `/skill:name` 调用；模型也能按 description 自动匹配技能并读取其正文。
**Verified:** 2026-09-12T16:50:43Z（2026-09-13 00:50 +08:00）
**Status:** human_needed
**Re-verification:** Yes — gap closure 第 4 轮。上一轮 `2026-09-12T14:33:42Z`（`human_needed`，`44/52`）之后，UAT round 3 test 18 裁决出 **G-48-18**（WR-07）与 **G-48-19**（WR-08）两条 gap，由 **48-08** 在**调用侧**闭合其代码面；同时 **G-48-12 的运行期面已由 UAT round 3 test 14 回填闭合**。

## Goal Achievement

> **本轮结论摘要**：48-08 的交付面**全部核实为真**（唯一补刷实现 + 两个成功出口共用 + 检脏早退零成本 + 只在成功出口补刷 + 两个独立 try + 判别式告警 + 安全 err 取值 + 权威侧与 renderer 零 diff + 四文件措辞收口 + 例数账本 147 一致）。**无 must-have 真值 FAILED、无 artifact MISSING/STUB、无 key link NOT_WIRED、无未引用债标记。** 本轮把上一轮 5 条 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED 中的 **5 条全部升级为 ✓ VERIFIED**（真相 25 / 26 / 28 / 29 / 43 —— 分别由 UAT round 2/3 的自动驱动实测与新增的 J8/J9/J10 行为用例承载），并使 **G-48-12 运行期面**与 **WR-07 / WR-08** 一并闭合。
>
> **本轮独立实跑（不采信 SUMMARY）**：`node tests/test-ai-skills.js` → `# tests 147 / # pass 147 / # fail 0`；`node --test tests/test-skill-picker-model.js` → `95/95`；`node --test tests/test-ai-cancel-state.js` → `14/14`；`node tests/test-builtin-skills-seeder.js`（直跑）→ `101/101`；5 文件回归门 → `361/361`（上一轮 353 → **+8**，恰为 48-08 新增的 K 组 5 + J 组 3）。**并做了独立证伪**：把本轮的新 `tests/test-ai-skills.js` 放进 `a211abfb`（48-08 前）的 detached 工作树运行 → `# tests 147 / # pass 141 / # fail 6`，失败者恰为 `K1`（靶心行为）/ `K5`（单源护栏）/ 改写后的 `源码：延迟补刷是单源实现` / `J8` / `J9` / `J10` —— 证明新用例**不是同义改写**，旧实现下必然红（工作树已清理）。
>
> **但**：**G-48-18 的「组合面」**（已打开的 `/` 面板 / 模型自动匹配面**随后**可见运行期新增技能）仍未被任何测试或探针行使 —— 48-08 PLAN 与 SUMMARY 均**显式声明**该面的运行时终证归下一轮 `/gsd-verify-work 48` 的自动驱动探针；`48-UAT.md` 的 `G-48-18` / `G-48-19` 仍保持 `status: failed`（48-08 刻意不回填）。故本阶段维持 `human_needed`，**不得** complete。

### Observable Truths

> **行 1–52** 为历轮已登记真值的回归复核（48-08 只改 `ai-manager.js` + `tests/test-ai-skills.js` + `docs/product/ai-skills.md` + `AGENTS.md` + `48-VALIDATION.md`；`src/renderer.js`、`ipc-handlers.js`、`src/preload.js`、`src/index.html`、`src/styles/main.css`、`ai-skills-manager.js`、`src/skill-picker-model.js`、`src/ai-cancel-state.js` 本轮**零 diff** —— 本轮实测 `git diff --name-only a211abfb..HEAD -- ai-skills-manager.js src/renderer.js src/preload.js ipc-handlers.js src/skill-picker-model.js src/ai-cancel-state.js` 输出为空）。
> **行 53** 为 48-08 诚实边界声明中单列的**组合面**（本轮新增的 ⚠️）。
> **行 54–68** 为 48-08 增量真值（9 条）与禁止项（6 条）。
> **行号说明**：48-08 在 `ai-manager.js` 插入 ~65 行（新方法 + JSDoc + miss 重试块扩写），**该文件 1440 行之后的引用本轮已按当前文件更新**（例：`_resolveSkillMarker` 1655→**1683**、`skill_invocation:` 1736→**1764**、`skillErrorFromReason` 6132→**6160**、`_cleanupCurrentAgent` 2768→**2796**）；≤1425 的引用不变。

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 / DISC-01：输入 `/` 后面板同屏分区列出「技能」（在上）与「命令」；0 项分区标题不输出 | ✓ VERIFIED | `src/skill-picker-model.js` `filterPickerItems`/`buildPickerItems`（零 diff）；`tests/test-skill-picker-model.js` 本轮实跑 `95/95`；`renderSlashPickerList`（`renderer.js:10374+`） |
| 2 | D-01：`state.slashPickerItems` 是展平单数组且数组顺序 === 视觉顺序；标题不占索引；点击 / hover 按扁平 `data-index` 直绑 | ✓ VERIFIED | `renderer.js:10374-10440`（零 diff）；B 组接线断言随 95/95 通过 |
| 3 | D-03：命令分区语义与相对顺序零变化（原 token `startsWith`） | ✓ VERIFIED | B 组对同一 `rawFilter` 与 `SLASH_COMMANDS.filter(c => c.name.startsWith(rawFilter))` 做 `deepStrictEqual`；`renderer.js:344-347` 数组字面量恒 2 项 |
| 4 | DISC-04：行五要素（`/{name}` + 三档来源徽标 + `仅显式` + 单行截断描述 + 行尾标注）；禁用不渲染；`shadowed`/同名命令灰显不可选；超限可选中带标注 | ✓ VERIFIED | `renderer.js:10412-10440`（零 diff）；B 组 selectable 三例 + 状态标注优先级随 95/95 通过 |
| 5 | DISC-01：↑↓ 只在可选中集合上取模并跳过灰显行；全部不可选 → `activeIndex = -1`，Enter 回落既有 `executeActiveSlashCommand() === false` 路径 | ✓ VERIFIED | B 组导航取模 8 例；`renderer.js:10155+`（零 diff） |
| 6 | D-17 / P-48-06：面板 stale-while-revalidate（快照即时渲染 → 后台 `refreshSkills` → 广播只重拉 + digest 早退）；无 loading 态；失败保留旧快照；renderer `.refreshSkills(` 调用点唯一 | ✓ VERIFIED | 本轮实测 `grep -c "\.refreshSkills(" src/renderer.js` = **1**；`pullAiSkillsSnapshot`（`:9081-9089`）digest 早退；G 组 5 例 + C 组自激护栏随 95/95 通过 |
| 7 | SC2 / DISC-02：`/skill:name [args]` 与裸 `/name [args]` 一致解析（本地命令优先、严格前缀 + 空白边界、`^[a-z0-9-]+$`） | ✓ VERIFIED | A 组 32 例（含反例）；`parseSkillInvocationText` 与 `parseSkillRef` 跨进程一致性断言随 147/147 全绿 |
| 8 | DISC-02：技能正文在**调用那一刻**从磁盘读取；空串 / 仅空白 / 目录读不到 → `not_found`（绝不产字面量 `undefined`） | ✓ VERIFIED | `ai-skills-manager.js:802-834` 实读（每次 `import(...)` + `loadSkills(env, dirname)` 重读盘）；J 组「改盘后二次调用读到新正文」继续绿 |
| 9 | DISC-02：`<skill>` 块逐字节 === `formatSkillInvocation(skill, provenance + '\n\n' + args)` | ✓ VERIFIED | D 组用**真实 SDK** `formatSkillInvocation` 构造期望值，三例全等（48-08 未触及该路径 —— diff 实读 7 处 hunk 均不在 `buildSkillInvocationBlock`） |
| 10 | D-07：拼接顺序 `[skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]`；无技能调用时输出与改动前逐字符相同 | ✓ VERIFIED | `ai-manager.js:1299` 实读（位于 48-08 插入点之前，行号未漂移） |
| 11 | DISC-03：`_ensureConversation(message)` 保持原始语法文本（对话标题不退化），注入只发生在 `agent.prompt` | ✓ VERIFIED | `ai-manager.js:1062` 实读；`_ensureConversation(enhanced` 命中 0 |
| 12 | D-06：user 气泡 `content` = args 原文；重开对话由 `getConversationMessages` 还原同形 `{content: args, skillInvocation:{name,tier,content}}`（含 `@` 引用 / 附件 / args 含空行 / 空 args 四形态） | ✓ VERIFIED | D 组「重载装饰（八例）」+ `resolveSkillBubbleArgs` 打表；两趟扫描规则实读 |
| 13 | D-19：两条重发路径（`regenerateMessage` / `showAIError` 重试）经 `buildResendPayload`（唯一实现）由 args + name 重组完整语法文本；空 args 时载荷非空 | ✓ VERIFIED | `function buildResendPayload(` 命中数 = 1；C 组往返表；F 组两处 `await ... ai.prompt(payload)` 源码断言 |
| 14 | DISC-03：技能调用**进入对话历史并触发 LLM**（与本地 `clear`/`compact` handler 语义区分） | ✓ VERIFIED | `renderer.js:8697-8709` 技能分支只记录 `skillRef` 后走既有发送链（零 diff）；真实 LLM 回复面由 UAT test 15/16 证成 |
| 15 | DISC-04：`getSkillsForUI` 收窄投影（**不含** `content`/`filePath`/`diagnostics`）+ 三档 `tier` 由主进程唯一计算 + `promptOmitted` 只打在预算丢弃的 eligible 条目 | ✓ VERIFIED | `ai-skills-manager.js:707-720` / `:684` / `:761-767` / `:609`（零 diff）；D 组三例 |
| 16 | DISC-06：技能不存在 / 已禁用 → 结构化 `skillError`（`skill_not_found` / `skill_disabled` 两码两文案，无第三码），主进程不调用 `agent.prompt` | ✓ VERIFIED | `ai-manager.js:6160-6170`（`skillErrorFromReason` 唯一来源）；`:1498-1501`（失败即返回 `skillError`）；J8/J9/J10 三条负例再次钉住码域 |
| 17 | DISC-07：`disableModelInvocation` 的技能不进 system prompt、仍可经 `/skill:` 显式调用、与 `disabled` 互不蕴含、永不 `promptOmitted` | ✓ VERIFIED | D 组四条可失败断言 + flag 独立性一例 |
| 18 | DISC-05：`read` 打开技能目录 `SKILL.md` → `tool_execution_start` 带 `skill_invocation = {name,tier}`；非 `read` / 缺 `path` / `path` 非字符串 / basename ≠ `SKILL.md` / 工作区外 / 无 `sandboxEnv` → `null` 且不抛错 | ✓ VERIFIED | `ai-manager.js:1683-1689`（`_resolveSkillMarker` 五道守卫实读，行号 1655→**1683**）、`:1764`（`skill_invocation: this._resolveSkillMarker(...)`）；H 组四类路径 + 四条负例 |
| 19 | DISC-05：renderer 把事件字段落到 `toolExecution.skillInvocation`；`renderToolCard` 技能变体标题「使用技能「name」」+ `TIER_BADGE` 白名单徽标、全 `textContent`；判定只在主进程（renderer **零**路径匹配） | ✓ VERIFIED | `renderer.js:9364` / `:9579-9586`（零 diff）；`grep -c "matchSkillByPath\|path\.resolve" src/renderer.js` = **0**；`ai-manager.js:2778` 重载走同一 `_resolveSkillMarker` |
| 20 | 48-02 backstop：50+ 技能下 220px 面板观感（sticky 常驻 / 五要素可读 / 标注不截断） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 结构面齐备（`.slash-picker-group-header` sticky + 显式背景、行 `flex-wrap`、`max-height: 220px` 零改动），但纯视觉观感不可自动化裁决。UAT test 7 已由自动驱动实测判 pass → 见 Human Verification（唯一人判项 = 观感是否可接受） |
| 21 | **【G-48-3】闭合态**：发送 `/skill:<name>` 时 renderer **零本地否决** —— 请求一定到达主进程，由它当场读盘裁定 | ✓ VERIFIED | `renderer.js:8692-8709`（零 diff）；源码探针 `state.aiSkills` 7 处均落面板侧与 state 声明；F 组 + `test-skill-picker-model.js` 同款断言本轮实跑通过 |
| 22 | **G-48-3b**：`skills:changed` 广播到达即**无条件** `pullAiSkillsSnapshot()`，且**绝不**触发 `refreshSkills()`（自激回路 P-48-06 不回归） | ✓ VERIFIED | `renderer.js:4405-4409`（零 diff）；全文件 `.refreshSkills(` 计数本轮实测 = **1** |
| 23 | **【G-48-2】闭合态**：`frontmatter name ≠ 目录名` 的技能面板可见可选，`/skill:<目录名>` 可正常调用，注入用 name = **目录名** | ✓ VERIFIED | `ai-skills-manager.js:817-833` 实读判据为目录路径全等（零 diff）；三条用例随 147/147 全绿 |
| 24 | **【G-48-4a 源码面】闭合态**：迟到的取消事件按**锚点**解算；`resetRunState` 只由锚点等式决定；两处对话切换清空锚点 | ✓ VERIFIED | `src/ai-cancel-state.js:46-60`（零 diff）；`renderer.js:9387-9413` / `:7214-7215` / `:7252-7253`；`tests/test-ai-cancel-state.js` 本轮实跑 `14/14` |
| 25 | **【G-48-4b 运行时面】**：流式中（含卡在工具确认卡片）调用技能 → 新气泡不被写成「用户已取消」、其后不零增长、停止按钮不提前回退 | ✓ VERIFIED（**本轮由 ⚠️ 升级**） | **UAT round 3 test 16 自动驱动实测通过（三轮独立复现）**：取消落点在**被中止轮**气泡（`ai1` = `用户已取消`）、新气泡 0→108 持续增长（另两轮 8→191 / 16→1042）、停止按钮 t=0.00→2.79s 全程 `stop-mode` 且在本轮真正结束时翻回、`.ai-skill-pill` 与 `stop-mode` 翻回同一采样点出现、全程 `notes=[]`；证据 `/tmp/uat48-r3-t16.json`。对照 round 1 失败态三条症状全消失。另 round 2 test 10 同形通过。**TD-48-02 描述的是另一条不变式（结算瞬间连点停止的跨轮标记污染），不覆盖本场景** |
| 26 | **【G-48-6】**：发送 `/skill:<name> <args>` 后**无需任何额外交互**，用户气泡在**本轮回合结束时**即含 `.ai-skill-pill` 与默认折叠的 `.ai-skill-content-box`（口径已收口） | ✓ VERIFIED（**本轮由 ⚠️ 升级**） | **UAT round 3 test 15 自动驱动实测通过**：pill `技能demo` + 折叠块 `{collapsed:true, title:"技能正文（94 字符）", bodyLen:94}`；三态 `seq = [true,false,true]`；pill/box 计数拐点与 `stop-mode` 翻回落在**同一采样点**（t≈2.0s，回车那一刻不出现 —— 与 WR-05 收口口径一致）；`notesDelta=[]`。round 2 test 9 同形通过 |
| 27 | **48-06 单源护栏**：两条失败文案的唯一来源在主进程 `skillErrorFromReason`，renderer **零复制** | ✓ VERIFIED | 本轮实测 `grep -c "未找到技能" src/renderer.js` = **0**；`ai-manager.js:6160-6170` 两条文案字面量仍在；两套测试跨文件成对钉住 |
| 28 | 真实 Electron 端到端：气泡三件套 / 两条 system-note / 流式中调用技能不被丢弃 | ✓ VERIFIED（**本轮由 ⚠️ 升级**） | clause 1（pill + 折叠块）= UAT test 15 ✓；clause 2（不存在名 → system-note「未找到技能…」+ 气泡 `4→2` 回滚）= UAT round 1 test 6 + round 3 test 17a ✓；clause 3（已禁用 → system-note）= UAT round 1 test 6 ✓；clause 4（流式中调用不被丢弃）= UAT test 16 ✓。四条 clause 均有真实 dev 应用实测记录 |
| 29 | DISC-05：模型**仅凭 description 自动匹配**技能（用户不显式调用也能生效） | ✓ VERIFIED（**本轮由 ⚠️ 升级**） | **UAT round 2 test 13 自动驱动实测通过**（provider = xiaomi/mimo-v2.5）：Q1（不手打 `/skill:`）→ 模型**自发**调用 `read`，卡片 `使用技能「demo」`、徽标 `用户`、参数区显示实际路径、**无** `Tool demo not found`、回答正确；Q2 追问 → 模型答出具名技能清单并正确区分「技能正文不在提示词里，匹配 description 时才 `read`」——与 D-18 口径一致。证据 `/tmp/uat48-r2-t13.json`。round 1（Qwen3-8B）的失败已由换模型反证为**模型能力**问题；48-REVIEW IN-04 据此降为观测项 |
| 30 | 文档同步（48-03 + 48-06）：`docs/product/ai-skills.md` §10 全量 + §七 测试清单；`AGENTS.md` 测试清单登记 | ✓ VERIFIED（附带 IN-12 残余） | §10.8 `###` 标题位于 §10.7 之后；§10.7 含「无条件重拉」且全文不含旧限定「仅在面板打开时」；§七 例数本轮实读为 **147（实测）**、`AGENTS.md:267` 同值且含 G-48-18 / G-48-19 覆盖面。**残余**：§10.7 `:392` 仍写「即时呈现」与 §10.8 冲突 → 记 advisory（IN-12），不 falsify 本条 |
| 31 | 禁止项：本阶段**零新增技能写路径** | ✓ VERIFIED | `ai-skills-manager.js` 本轮零 diff（实测 `git diff --name-only` 输出为空）；48-08 的 `ai-manager.js` 7 处 hunk 逐条实读，无创建 / 修改 / 删除入口 |
| 32 | 禁止项：技能条目不得并入 `SLASH_COMMANDS` | ✓ VERIFIED | `renderer.js:344-347` 数组字面量项数 = 2，无 `SLASH_COMMANDS.push`（零 diff） |
| 33 | 禁止项：renderer 不重算技能集状态（优先级 / 遮蔽 / 限额 / 预算省略 / 档位，只消费投影） | ✓ VERIFIED | `src/renderer.js` 与 `src/preload.js` 内 `64 * 1024` / `65536` / `8000` / `MAX_USER_SKILLS` / `localeCompare` / `/api/skills` 命中数全为 **0**（两文件零 diff） |
| 34 | 禁止项（48-02）：面板 `innerHTML` 模板内插入的 `name` / `description` / 行尾标注 / `title` **全部**经 `escapeHtml()`；tier → class 走白名单查表 | ✓ VERIFIED（开放延后：TD-48-01） | `renderer.js:10417-10435` 逐条插值均在 `escapeHtml(...)` 内；**但** `escapeHtml`（`:11349-11353`）= DOM `textContent → innerHTML` 不转义 `"` —— 已由用户 2026-09-12 裁决登记为 `TD-48-01`（延后，接手触发点 = Phase 49 开工前第一条）。**禁止项字面要求成立 → 记 VERIFIED**，延后记录见 `open_deferrals` |
| 35 | 禁止项（48-03）：技能化不额外插 system-note、不改 `.tool-card` 既有规则、不新增卡片形状；存储层无技能域知识 | ✓ VERIFIED | H 组四条既有规则体内零命中新类 / 文案；`ai-conversations-manager.js` 内 `skillInvocation` 命中 0（零 diff） |
| 36 | 禁止项（48-05）：不得用整列 `renderAIMessages()` 冒充 G-48-6 修复；不得删除 `aiCancelledByUser` / 改写「用户点停止」既有语义 | ✓ VERIFIED | `refreshUserMessageBubble` 用 `replaceChild`（`:8198-8202`，函数体不含 `innerHTML = ''`）；`aiCancelledByUser` 仍在（声明 / 置位 / 消费）—— `renderer.js` 零 diff |
| 37 | **【48-07】G-48-12 代码面靶心**：`readSkillForInvocation` 判 `not_found` 时，经唯一权威入口 `syncAgentSystemPrompt()` 重扫**恰一次**后**当场重读磁盘** → 运行期新增技能（managed / user 两根）立即可被 `/skill:<新名>` 调用；缓存命中时**零重扫**；正文恒来自读盘而非缓存副本 | ✓ VERIFIED | `ai-manager.js:1462-1496` 实读（条件不变，块内结构已按 48-08 改为两个独立 try）；J 组三条正例/快路径用例继续绿 |
| 38 | **【48-07】三字段同源**：shadowed / disabled / tier 全部由同一条 `refreshSkills` 管线产出；运行期新增技能**不能**绕过遮蔽与禁用；调用侧零自行判定、零单目录直读 | ✓ VERIFIED | `ai-manager.js:1478` 只调 `syncAgentSystemPrompt()`；`ai-skills-manager.js` 零 diff（实测）；J 组两条负例（disabled / shadowed 不被绕过）继续绿；方法体内 `refreshSkills(` 命中 0 |
| 39 | **【48-07】失败语义不变**：真不存在仍 `skill_not_found`（返回值域仍只有 `not_found \| disabled` 两个码），重试不会把失败变成成功 | ✓ VERIFIED | J 组「负例 · 真不存在 + 有界」+ **48-08 新增 J8/J9/J10 三条各断言 `skill_not_found`**；`:1498-1501` 失败出口逐字未动（diff 实读），仍走 `skillErrorFromReason` 单一映射 |
| 40 | **【48-07】有界性**：单次调用**至多**一次重扫，不得写成循环；「命中但读盘失败」也只会多一次有界重扫 | ✓ VERIFIED | 行为断言 `rescanCalls === 1`（三条用例分别覆盖 miss-成功 / 禁用 / 真不存在）；源码护栏 `assert.strictEqual(/\bwhile\b/.test(body), false)` 与无 `for (`（本轮实读 J 组护栏仍在）；`readSkillForInvocation(` 恰 2 次（J8/J9/J10 下失效时会变 1 或 ≥3） |
| 41 | **【48-07】忙时语义**：调用路径恒 `isProcessing = true` → 重扫必落忙分支 → **只置脏**，不改写 `agent.state.systemPrompt`、不广播 | ✓ VERIFIED | `ai-manager.js:2843-2846` 实读（忙分支置 `_skillsPromptDirty` 后 `return`，早于 `:2858` 的 `windowManager.broadcast('skills:changed')`）；J 组正例断言置脏真且 prompt 逐字未变 |
| 42 | **【48-07】无自激回路**：本路径不广播；既有「广播到达即无条件重拉」只调零 IO 的 `ai:get-skills`；renderer 不得新增任何重扫调用点 | ✓ VERIFIED | `src/renderer.js` 零 diff，`.refreshSkills(` 计数本轮实测 = **1**；`renderer.js:4405-4409` 处理器体只有 `pullAiSkillsSnapshot()`；G 组护栏随 95/95 通过 |
| 43 | **【48-07 / 本轮升级】重扫抛错路径**：抛错被就地 catch + `console.warn` 后**沿用原判定**，不把「未找到」升级成异常；且该分支有可失败的行为用例把三件事钉住（不逃逸异常 / 不重复读盘 / 沿用原判定） | ✓ VERIFIED（**本轮由 ⚠️ 升级**） | 上一轮此项为 ⚠️（零行为用例 + WR-08 三处字面失配）；**48-08 已修复并补三条行为用例**：`ai-manager.js:1476-1495` 两个独立 `try` + `rescanned` 标志 + 告警取值 `err && err.message ? err.message : String(err)`；J8（Error 形态：`skill_not_found` + `readCalls === 1` + 告警含「重扫失败」）/ J9（`throw null` 与 `throw 'x'` 均正常 resolve、判定不变）/ J10（重试读盘抛 `null`：`readCalls === 2` + 告警含「重试读盘失败」且**不含**「重扫失败」）**全部实跑通过**。**独立证伪**：三条在 `a211abfb` 旧实现下实测 `not ok` |
| 44 | **【48-07】G-48-12 运行期靶心**：真实 dev 应用里运行期新建技能目录（不打开 `/` 面板、不重启、不重建 Agent）→ 直接手打 `/skill:<新名> [args]` 即正常调用 | ✓ VERIFIED（**本轮由 ⚠️ 升级**） | **UAT round 3 test 14 自动驱动实测通过，`G-48-12.status` 已由 `failed` 回填 `resolved`**：启动后新建 `managed-skills/uat-r3-24650778/SKILL.md`、全程不打开 `/` 面板（探针不派发 `input` 事件）、不重启不重建；发送前 `getSkills()` 快照 `containsNew:false`；主进程日志 `发送消息: /skill:uat-r3-24650778 你好`；零 system-note；回复 `探针技能已生效` 与新文件正文逐字一致（23 字符，折叠块 `bodyLen = 23`）。`.planning/WINDOWS.md` unrun-verify **id 24** 同步 `windows fixed`（`resolved_at: 2026-09-12T15:02:36.971Z`）。对照 round 2 失败态（14ms 出 note / 主进程零请求）三条症状全消失 |
| 45 | **【48-07 / 本轮收口】延迟回写与广播确实落地**：重扫改变 digest → 下一次非忙同步点走「改写 + 广播」分支 → 运行期新增技能进入 system prompt（模型自动匹配面）与其它窗口面板投影 | ✓ VERIFIED（**本轮由 ⚠️ 拆分升级**） | 上一轮此项因 WR-07 实读证伪「纯文本流永不落地」而记 ⚠️。**48-08 取路线 A 补齐**：`prompt()` 成功出口新增共用补刷（`:1091`），K1 在**真实 `syncAgentSystemPrompt()`** 上断言纯文本 `/skill:flush-probe 你好` 成功后 `_skillsPromptDirty === false`、`agent.state.systemPrompt === buildSystemPrompt()` 且含该技能、`channels deepStrictEqual ['skills:changed']`、`rescanCalls === 2`（忙时一次 + 出口一次，**非 3**）。「不自激」半边由真相 42 承载。**组合面（面板 / 模型随后可见）仍未被行使 → 单列为本表 53** |
| 46 | **【48-07】文档与账本收口**：`docs/product/ai-skills.md` §10.3 / §10.7 / §七；`AGENTS.md` 技能域测试清单；`.planning/WINDOWS.md` id 24 同步更正；`48-VALIDATION.md` 行；`48-UAT.md` 纯追加更正 | ✓ VERIFIED | 48-07 的收口已确认；**48-08 在其上继续收口 §10.7 落地时机 + 例数 139→147**（见真相 61）。`.planning/WINDOWS.md` id 24 状态 `fixed` 本轮实读 |
| 47 | **【48-07】诚实边界登记**：运行期真值未被自证为 resolved（UAT Gaps 保持 `failed`、WINDOWS id 24 保持 `open`）；WR-06 显式声明**未修复、不得据此声称已修** | ✓ VERIFIED | 48-07 时的两处「保持 open/failed」已在 round 3 收尾时**如实回填**（id 24 → fixed、G-48-12 → resolved）—— 这是交接条件的满足，不是自证。**WR-06 在 48-08 后仍被显式声明**：`docs/product/ai-skills.md` §10.7 逐字含「本条**未被修复**，随 Phase 49 一并处置…**不得**据此声称已修」（本轮原文实读）；48-08 SUMMARY 的 `Next Phase Readiness` 同款披露 |
| 48 | **禁止项（48-07 P1）**：不得改动 `syncAgentSystemPrompt()` 的函数体 | ✓ VERIFIED | **本轮程序化复核**：`methodBody(old, 'syncAgentSystemPrompt') === methodBody(now, 'syncAgentSystemPrompt')` → `IDENTICAL: true`（1062 字符，逐字相同）；`_recreateAgent` / `_cleanupCurrentAgent` 亦逐字未改；`tests/test-ai-skills.js` 内 46-04 五条方法体断言随 147/147 全绿（J/K 组夹具用 `realSync.call(this)` **包装而非重写**） |
| 49 | **禁止项（48-07 P2）**：不得在 `ai-skills-manager.js` 里为 miss 增设第二套磁盘探测 / 自行比较两根优先级的遮蔽判定 | ✓ VERIFIED | `git diff --name-only a211abfb..HEAD -- ai-skills-manager.js` 输出为空（**零 diff** 实测）；J 组源码护栏断言 manager 侧仍含缓存未命中短路字面量且不含调用形式的 `\.syncAgentSystemPrompt\s*\(` |
| 50 | **禁止项（48-07 P3）**：不得把 miss 重试写成循环（`while` / `for` / 递归 / 反复 await 直到成功），重试失败后不得继续尝试 | ✓ VERIFIED | 源码护栏（无 `while` / 无 `for (`）+ 行为断言 `rescanCalls === 1`；48-08 的 `rescanned` 局部标志**进一步加强**了「重扫失败后不再尝试」的结构性约束（J8 `readCalls === 1`） |
| 51 | **禁止项（48-07 P4）**：不得在 renderer 侧新增任何重扫调用点（`.refreshSkills(` 全文件恒 1），不得把 miss 判定/重试搬到 renderer | ✓ VERIFIED | `src/renderer.js` 零 diff；本轮实测 `grep -c "\.refreshSkills(" src/renderer.js` = **1**；G 组 / C 组源码扫描护栏随 95/95 通过 |
| 52 | **禁止项（48-07 P5）**：不得动 TD-48-01 / TD-48-02 的登记与实现，不得顺手修 WR-01..WR-06，不得在任何文档里声称 WR-06 已修 | ✓ VERIFIED | `src/renderer.js` 零 diff（两条 TD 的代码落点未变）；`ai-manager.js` / docs 的 48-08 新增行逐条实读，无一条针对 WR-01..WR-06 的修法；WR-06 仍在 §10.7 被显式标注「保持开放 + 未被修复」 |
| 53 | **【48-08 · 诚实边界「②」】G-48-18 组合面**：已打开的 `/` 面板、或模型按 description 自动匹配面，**随后**可见运行期新增技能（补刷落地 → 广播 → renderer 无条件重拉 → 面板原地重渲染；systemPrompt 更新 → 模型可见） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 两半各自已证成（主进程半由 K1-K5 在真实 `syncAgentSystemPrompt()` 上钉死；消费半由 48-06 无条件重拉 + 48-02 面板原地重渲染 + SDK 提示词模板的 `read` 指令构成），但**接起来的运行时链路无任何测试或探针行使**。48-08 PLAN 的诚实边界 truth 与 SUMMARY 的 `Next Phase Readiness` **均显式声明**「其运行时终证可由下一轮 `/gsd-verify-work 48` 的自动驱动探针复核」并给出探针形态。见 Human Verification。**本轮未驱动真实应用** |
| 54 | **【48-08】G-48-18 靶心**：`/skill:<运行期新增名>`（**无 @ 引用与附件**，走 `ai.prompt`）成功后，延迟的 system prompt 回写与 `skills:changed` 广播**在本轮结束时执行一次** | ✓ VERIFIED | `ai-manager.js:1086-1091`（`isProcessing = false` → `await this._flushDeferredSkillsPrompt()` → `return`）实读；**K1 实跑通过**：断言 `res.skillError === undefined`、`res.skillInvocation.name === 'flush-probe'`、`_skillsPromptDirty === false`、`systemPrompt.includes('flush-probe')`、`systemPrompt === aiManager.buildSystemPrompt()`、`channels deepStrictEqual ['skills:changed']`、`rescanCalls === 2`（`tests/test-ai-skills.js:3143-3189`）。**独立证伪**：该用例在 `a211abfb`（`prompt()` 无补刷、该通道零消费点）下 `not ok` |
| 55 | **【48-08】G-48-18 补齐面·单源**：`prompt()` 与 `promptWithContext()` 的成功出口**共用同一个补刷实现**；全文件 `await this._flushDeferredSkillsPrompt()` **恰 2 处**；`promptWithContext` 内**不得**残留任何 `this._skillsPromptDirty` 读写 | ✓ VERIFIED | 本轮独立实测 `grep -c "await this\._flushDeferredSkillsPrompt()" ai-manager.js` = **2**（`:1091` / `:1333`）；`_flushDeferredSkillsPrompt` 定义唯一（`:2905`）；全文件 `_skillsPromptDirty` 的**读/复位/恢复**三处只在 `:2906 / :2908 / :2913`（同一方法体内），`:2844` 是**置脏源**（`syncAgentSystemPrompt` 忙分支），`:715` 是 init；`methodBody(src,'promptWithContext')` 实读不含 `_skillsPromptDirty`。**K5 源码护栏实跑通过**（四要素顺序断言 + 两出口各含一次调用 + 恰 2 处），且该护栏在旧实现下 `not ok` |
| 56 | **【48-08】G-48-18 零成本不变式**：`_skillsPromptDirty` 为假时补刷**立即返回、零重扫**；补刷只在**成功**出口执行（`promptWithContext` 的 `catch` 与 `_cleanupCurrentAgent()` 均不补） | ✓ VERIFIED | `ai-manager.js:2906` 首行 `if (!this._skillsPromptDirty) return;` 实读（早退早于 `:2908` 复位、早于任何 IO）。**K2 实跑**：普通消息 `rescanCalls === 0` 且 `systemPrompt === 'OLD'`；**K3 实跑**：`promptWithContext` 抛错时 `_skillsPromptDirty === true`（原样保留）、`systemPrompt === 'OLD'`、`channels deepStrictEqual []`、`rescanCalls === 0`；**K4 实跑**：`_cleanupCurrentAgent()` 不碰标记、`agent === null`。源码门禁断言检脏下标 < 复位下标 |
| 57 | **【48-08】G-48-19 靶心**：`syncAgentSystemPrompt()` 抛错时 `_resolveSkillInvocation` 仍返回 `{ skillError: { code: 'skill_not_found' } }` —— **不抛异常**、**不变成第三码**、`skill === null`、`skillBlock === ''`；不重复一次必然同形的读盘（`readSkillForInvocation` 调用数 = 1） | ✓ VERIFIED | `ai-manager.js:1476-1485` 实读（`let rescanned = false` → `try { await syncAgentSystemPrompt(); rescanned = true } catch { console.warn(…「重扫失败」…) }`，catch 不赋 `result`；`if (rescanned)` 门控重读）。**J8 实跑通过**：`skillError.code === 'skill_not_found'`、`skill === null`、`skillBlock === ''`、`rescanCalls === 1`、`readCalls === 1`、告警含「重扫失败」。**独立证伪**：J8 在旧实现下 `not ok`（重试读盘在 try 外且告警文案不同） |
| 58 | **【48-08】G-48-19 原始值形态**：重扫抛 `null` / 抛原始字符串时，catch 体自身**不得二次抛错**，调用仍 resolve 且判定不变 | ✓ VERIFIED | `ai-manager.js:1481-1484` 取值形态 `err && err.message ? err.message : String(err)`（与 `ai-skills-manager.js:634` 同形）。**J9 实跑通过**：`throw null` 与 `throw 'x'` 两种形态各调一次，均正常 resolve 且 `skillError.code === 'skill_not_found'`、`skill === null`、`rescanCalls === 2`。**独立证伪**：J9 在旧实现（catch 内裸读 `err.message`）下 `not ok` —— 这正是「绝不升级为异常」被反转的那个点 |
| 59 | **【48-08】G-48-19 可判别告警与重试读盘兜底**：重扫成功但**重试读盘**抛错时，判定沿用原值、异常不逃逸，且告警文案与「重扫失败」那条**可判别** | ✓ VERIFIED | `ai-manager.js:1486-1495`（`if (rescanned) { try { result = await readSkillForInvocation(...) } catch { console.warn(…「重试读盘失败」…) } }`，catch 不赋 `result`）。**J10 实跑通过**：`skillError.code === 'skill_not_found'`、`rescanCalls === 1`、`readCalls === 2`、告警含「重试读盘失败」**且** `warns.some(w => w.includes('重扫失败')) === false`（双向断言 —— 两条 catch 被合并成一条也会红） |
| 60 | **【48-08】不回归**：失败码域仍只有 `not_found \| disabled`；shadowed / disabled / tier 仍全部来自 `refreshSkills` 同一条管线；`ai-skills-manager.js` 零 diff；`syncAgentSystemPrompt()` 函数体逐字未改；renderer 侧 `.refreshSkills(` 计数仍恒 1 | ✓ VERIFIED | `git diff --name-only a211abfb..HEAD` 实测**不含** `ai-skills-manager.js` / `src/renderer.js`；`methodBody` 程序化比对 `syncAgentSystemPrompt` **IDENTICAL: true**；`grep -c "\.refreshSkills(" src/renderer.js` = **1**；`ai-manager.js:1498-1501` 走 `skillErrorFromReason` 单一映射（diff 实读未动）；既有 J 组 7 条负例 + 46-04 五条方法体断言随 `147/147` 全绿 |
| 61 | **【48-08】文档收口**：`docs/product/ai-skills.md` §10.7 的落地时机枚举与措辞改为与新实现一致（含纯文本轮）并显式声明补刷失败恢复语义；`ai-manager.js` 不再残留把纯文本轮排除在外的旧措辞；§七 与 `AGENTS.md:267` 例数同步为实测值 | ✓ VERIFIED | 本轮实测 `grep -c "idle 边界" ai-manager.js` = **0**、`docs/product/ai-skills.md` = **0**；docs `:396-400` 实读四项清单「**任一轮成功出口**（`prompt()` 与 `promptWithContext()` 各一处，**含纯文本轮**）/ 打开面板 / Agent 创建或重建」+「**失败时会恢复「待回写」标记**、在下一次成功出口重试」；`ai-manager.js` 四处措辞（`:707-714` 脏标记 init JSDoc / `:1331-1332` 补刷注释 / `:1430-1435` `_resolveSkillInvocation` JSDoc 第 4 条 / `:2823-2825` `syncAgentSystemPrompt` JSDoc）逐条实读已收口；§七 `:98` 与 `AGENTS.md:267` 均写 **147（实测）** 且覆盖面含 G-48-18 / G-48-19。残余（§10.7 `:392` 旧「即时」措辞）不属本条范围 → 记 advisory（IN-12） |
| 62 | **【48-08】诚实边界**：G-48-18 的可观察结果分两半（① K 组主证据；② 组合面归 `/gsd-verify-work 48` 探针）；WR-06 **保持开放**、WR-02 两处裸调**仍开**，两者都不得被声称已修 | ✓ VERIFIED | `48-08-SUMMARY.md` 的 `Next Phase Readiness` 与 `Known Stubs` 逐字披露①②③④（组合面边界、WR-02 仍开、WR-06 保持开放、covered_digest 预期 stale）；`docs/product/ai-skills.md` §10.7 WR-06 条原文在册且含「不得…声称已修」；`48-UAT.md` `G-48-18` / `G-48-19` 仍 `status: failed`（48-08 刻意不回填，prohibition 明文）；`.planning/WINDOWS.md` 本增量未新增条目（实测 `git diff` 只含既有 id 24 的状态回填，无新行） |
| 63 | **禁止项（48-08 P1）**：不得写出第二份补刷实现（在 `prompt()` 或 `promptWithContext()` 里再内联一份检脏 / 复位 / 同步调用 / 失败恢复） | ✓ VERIFIED | 全文件 `await this._flushDeferredSkillsPrompt()` 恰 **2 处**且均为单行调用；四件事（检脏 / 复位 / `await this.syncAgentSystemPrompt()` / 失败恢复置脏）实测只存在于 `:2905-2919` 一个方法体内；`promptWithContext` 方法体零 `_skillsPromptDirty`（K5 + 改写后的 SKILL-04 护栏双份断言） |
| 64 | **禁止项（48-08 P2）**：不得把补刷放在错误出口、也不得放进 `_cleanupCurrentAgent()` | ✓ VERIFIED | `prompt()` 的重试耗尽 `catch`（`:1097-1119`）、`promptWithContext()` 的 `catch`（`:1339-1351`）、`_cleanupCurrentAgent()`（`:2796-2806`）体内均无补刷调用（本轮实读）；K3 / K4 各一条行为用例钉死（K4 另断言 `_cleanupCurrentAgent` 方法体程序化对比 `IDENTICAL: true`） |
| 65 | **禁止项（48-08 P3）**：不得把补刷写成「无条件调用」（丢掉检脏早退），也不得在补刷内部新增第二条重扫触发源或绕过 `syncAgentSystemPrompt()` | ✓ VERIFIED | `:2906` 首行检脏早退（K2 `rescanCalls === 0` 行为断言 + 源码门禁断言 `checkIdx < resetIdx`）；`_flushDeferredSkillsPrompt` 方法体内**只**调用 `this.syncAgentSystemPrompt()` 一个重扫入口，无 `refreshSkills(` / 无第二个触发源（本轮实读方法体全文 `:2905-2919`） |
| 66 | **禁止项（48-08 P4）**：不得把 miss 重试改写成循环 / 递归 / 反复重试，也不得新增第三个失败码或第三条失败文案 | ✓ VERIFIED | `_resolveSkillInvocation` 方法体内无 `while` / 无 `for (`（J 组护栏实读在册）；结构上是 `if (rescanned)` 门控的**单次** `try`，无递归；`:1498-1501` 仍走 `skillErrorFromReason` 单一映射（两码两文案），J8/J9/J10 三条各断言 `skill_not_found`（域外形态不产生第三码） |
| 67 | **禁止项（48-08 P5）**：不得顺手闭合 WR-02，也不得修 WR-01 / WR-04 / WR-05 / WR-06 / TD-48-01 / TD-48-02 | ✓ VERIFIED | 本轮实测 `ai-manager.js:1048` / `:1182`（两处调用点）与 `:1447`（首次 `readSkillForInvocation`）**仍为裸调**（不在任何 `try` 内）—— WR-02 未被顺带闭合；`ai-skills-manager.js` 与 `src/renderer.js` **零 diff**（WR-06 与两条 TD 的落点未变）；`ai-manager.js` 7 处 diff hunk 逐条实读，无一条针对 WR-01 / WR-04 / WR-05 |
| 68 | **禁止项（48-08 P6）**：不得改 `ai-skills-manager.js`（含为便于测试而扩大导出）、不得改 `syncAgentSystemPrompt()` 的函数体、不得改 `src/renderer.js` 或任何 renderer 测试 | ✓ VERIFIED | `git diff --name-only a211abfb..HEAD -- ai-skills-manager.js src/renderer.js` 输出为空；程序化 `methodBody` 比对 `syncAgentSystemPrompt` **IDENTICAL: true**；`git diff --name-only a211abfb..HEAD` 的 4 个源/文档文件实测 = `AGENTS.md` / `ai-manager.js` / `docs/product/ai-skills.md` / `tests/test-ai-skills.js`（严格等于 `files_modified`），无 renderer 测试改动 |

**Score:** 66/68 truths verified（2 present, behavior-unverified —— 真相 20 与真相 53）
**Prohibitions:** 17 条 judgment-tier 禁止项逐条核对 —— **17 条全部 VERIFIED**（真相 31-36 为本阶段既有 6 条；真相 48-52 为 48-07 的 5 条；真相 63-68 为 48-08 的 6 条），其中真相 34 附带一条**用户已裁决的开放延后**（TD-48-01），不另记 UNCERTAIN。

### 本轮（48-08 / G-48-18 + G-48-19）逐条重判

| 48-08 PLAN 的 must-have | 本轮判定 | 决定性证据 |
| --- | --- | --- |
| truth 1（G-48-18 靶心：纯文本流也最终落地） | **✓ VERIFIED（真相 54）** | K1 实跑通过（脏标记归假 + prompt 含新技能且 `=== buildSystemPrompt()` + 广播恰一次 + `rescanCalls === 2`）；**独立证伪**：旧实现下 `not ok` |
| truth 2（补齐面：两处成功出口共用唯一实现） | **✓ VERIFIED（真相 55）** | 全文件调用点实测恰 2 处；四要素只在 `:2905-2919`；`promptWithContext` 零脏标记；K5 实跑通过且旧实现下 `not ok` |
| truth 3（零成本不变式 + 只在成功出口补） | **✓ VERIFIED（真相 56）** | `:2906` 首行检脏早退；K2 `rescanCalls === 0`；K3 错误出口标记原样保留 + 零广播 + 零重扫；K4 清理不碰标记 |
| truth 4（G-48-19 靶心：抛错沿用原判定） | **✓ VERIFIED（真相 57）** | J8 实跑通过（`skill_not_found` + `readCalls === 1` + 告警含「重扫失败」）；旧实现下 `not ok` |
| truth 5（原始值形态：catch 不得二次抛错） | **✓ VERIFIED（真相 58）** | J9 双形态（`throw null` / `throw 'x'`）实跑通过；旧实现下 `not ok` |
| truth 6（可判别告警 + 重试读盘兜底） | **✓ VERIFIED（真相 59）** | J10 实跑通过（`readCalls === 2` + 含「重试读盘失败」且**不含**「重扫失败」的双向断言） |
| truth 7（不回归） | **✓ VERIFIED（真相 60）** | 权威侧与 renderer 零 diff；`syncAgentSystemPrompt` 方法体程序化 `IDENTICAL: true`；`.refreshSkills(` = 1；147/147 + 95/95 + 14/14 + 361/361 |
| truth 8（文档收口） | **✓ VERIFIED（真相 61）** | `idle 边界` 在两文件**零命中**；docs §10.7 四项清单 + 失败恢复语义实读；§七 与 `AGENTS.md:267` 均 147（实测）且含两条修复覆盖面 |
| truth 9（诚实边界） | **✓ VERIFIED（真相 62）** | SUMMARY 显式披露组合面归下一轮探针、WR-02 仍开、WR-06 保持开放；docs §10.7 WR-06 条含「不得…声称已修」；UAT 两条 gap 保持 `failed` |
| P1-P6（6 条禁止项） | **✓ VERIFIED（真相 63-68）** | 见真值表证据列 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `ai-manager.js` | **本轮新增**：`async _flushDeferredSkillsPrompt()`（唯一补刷实现）；`prompt()` 成功出口插入一行调用；`promptWithContext()` 的旧内联块整体替换为一行调用；`_resolveSkillInvocation()` 的 miss 重试块改为两个独立 `try` + `rescanned` + 可判别告警 + 安全 err 取值；四处落地时机措辞收口 | ✓ VERIFIED | `:2905-2919`（新方法）/ `:1086-1091`（prompt 出口）/ `:1329-1333`（promptWithContext 出口）/ `:1462-1496`（miss 块）/ `:707-714` / `:1424-1435` / `:2823-2825`（措辞）。diff 实测 **7 处 hunk**，全部落在计划声明的范围内；`node --check ai-manager.js` 通过 |
| `ai-manager.js`（既有） | 解析 / 组装 / 返回契约 / 重载装饰 / `_resolveSkillMarker` / `skillErrorFromReason` / `syncAgentSystemPrompt` 方法体 | ✓ VERIFIED | 行号按当前文件更新：`:1062` / `:1299` / `:1442-1520` / `:1683-1689` / `:1764` / `:6160-6170`；`syncAgentSystemPrompt` 方法体程序化比对 **IDENTICAL: true**（1062 字符逐字相同） |
| `ai-skills-manager.js` | `readSkillForInvocation` 的存在性门与目录判据（**本轮零 diff**） | ✓ VERIFIED | `git diff --name-only a211abfb..HEAD -- ai-skills-manager.js` **空**；`:803-804` 缓存短路、`:817-833` 目录路径全等 + name 重写实读 |
| `src/skill-picker-model.js` | 双模式导出纯逻辑模型（零 diff） | ✓ VERIFIED | `node --test tests/test-skill-picker-model.js` 本轮实跑 95/95 |
| `src/ai-cancel-state.js` | 零依赖 / 零 DOM / 双模式导出，`resolveCancelAttribution`（零 diff） | ✓ VERIFIED | `node --test tests/test-ai-cancel-state.js` 本轮实跑 14/14 |
| `ipc-handlers.js` | `ai:get-skills` / `ai:refresh-skills` + `ai:prompt*` 返回体（零 diff） | ✓ VERIFIED | `:1747` / `:1763` 两通道仍 `assertTrustedSender(event)`；48-08 未触及（diff 实读） |
| `src/preload.js` | `realmAPI.ai.getSkills` / `refreshSkills` 成对暴露（零 diff） | ✓ VERIFIED | `:1033` / `:1040` |
| `src/renderer.js` | 发送路径零否决 / 气泡单源 + 定向刷新 / 取消锚点 / 面板 / 导航 / 卡片变体 / 重发收敛（零 diff） | ✓ VERIFIED | `git diff --name-only a211abfb..HEAD` **不含** `src/renderer.js`；`.refreshSkills(` = 1 本轮实测 |
| `src/index.html` | 脚本加载顺序 + `main.css?v=8`（零 diff） | ✓ VERIFIED | `:1021` / `:1024` / `:1025`；`:11` |
| `src/styles/main.css` | 四个令牌 + 技能相关新类；`max-height: 220px` 零改动 | ✓ VERIFIED | 令牌 5/5/5/3；八类齐全 |
| `tests/test-ai-skills.js` | **本轮新增** K 组 5 条（K1-K5）+ 夹具 `promptCtx`；J 组新增 3 条（J8/J9/J10）；**改写** 1 条旧源码护栏（`Agent prompt 回写（SKILL-04）` 内的内联块断言 → 单源护栏） | ✓ VERIFIED | `:3101-3283`（K 组，夹具 `Object.create(prototype)` + own-property **包装** `syncAgentSystemPrompt`，`realSync.call(this)`）/ `:2934-3065`（J8/J9/J10）/ `:1318-1348`（改写后的护栏）。本轮亲跑 `147/147` 零 fail，无 skip / todo；**独立证伪**：新文件在 `a211abfb` 下 `# fail 6`（K1/K5/改写护栏/J8/J9/J10），既有 141 例零回归 |
| `tests/test-skill-picker-model.js` | 面板 / 解析纯逻辑 + 接线护栏（零 diff） | ✓ VERIFIED | 本轮实跑 `95/95` |
| `tests/test-ai-cancel-state.js` | A 组纯逻辑 + B 组接线护栏（零 diff） | ✓ VERIFIED | 本轮实跑 `14/14` |
| `docs/product/ai-skills.md` | **本轮修改**：§10.7 落地时机四项清单（含纯文本轮）+ 失败恢复语义 + 残余窗口触发点补全 + WR-06 条原样保留；§七 例数 147 + 覆盖面；§10.3 / §10.8 核对后未改 | ✓ VERIFIED | `:396-407` 实读；`idle 边界` 零命中；WR-06 条含「未被修复…不得据此声称已修」；§七 `:98` = 147（实测）。残余 §10.7 `:392` 旧措辞 → advisory（IN-12） |
| `AGENTS.md` | **本轮修改**：`:267` 技能域测试清单条目例数 139 → **147**，覆盖面补 G-48-18 / G-48-19；该行其余条目与 `:272` 维护约定未动 | ✓ VERIFIED | `:267` 原文实读（diff 1 insertion / 1 deletion） |
| `.planning/phases/48-skill-name/48-VALIDATION.md` | **本轮新增** `48-08-T1` / `48-08-T2` / `48-08-T3` 三行（10 列对齐、`Status` 一律 `⬜ pending`） | ✓ VERIFIED | `:82-84` 实读；列数与表头一致；行内容与 PLAN Task 3 步骤 8 逐条对应（含 T3 的 Requirement 用 `DISC-02` 而非 Phase 46/47 的 `DOC-02`） |
| `48-08-SUMMARY.md` / `48-08-PLAN.md` | gap 闭合计划与其摘要（`gap_ids: [G-48-18, G-48-19]`、`plan_head_before` 台账、`actuals`） | ✓ VERIFIED | SUMMARY frontmatter `gap_ids: [G-48-18, G-48-19]` / `plan_head_before: 87fb2cc6…` 实测与 `.git/gsd-plan-head-before-48-08` **逐字一致**；`git rev-list --count 87fb2cc..064748d` = 4（3 任务 + 1 metadata），与 SUMMARY 的「任务提交 3 / metadata 另计」口径自洽 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| **`prompt()` 成功出口（`:1091`）** | **`_flushDeferredSkillsPrompt()` → `syncAgentSystemPrompt()` → `refreshSkills(env, {disabled, rootDirs})` → 非忙（`isProcessing` 已置回 false）→ digest/逐字符比对 → `agent.state.systemPrompt = buildSystemPrompt()` + `windowManager.broadcast('skills:changed')`** | **本轮新增的落地链（纯文本通道）** | ✓ WIRED | `:1091` → `:2905-2919` → `:2835-2858` 逐段实读；全链路**无第二份实现、无第二套判定**（方法体 `refreshSkills(` 命中 0，只调唯一权威入口）；K1 端到端断言了链末三项 |
| `promptWithContext()` 成功出口（`:1333`） | 同上 | 两份出口共用同一实现 | ✓ WIRED | `:1333` 单行调用；`promptWithContext` 方法体零 `_skillsPromptDirty`（K5 + 改写护栏双断言） |
| **置脏源** | `syncAgentSystemPrompt()` 忙分支（`:2843-2844`） | 忙时只置脏 | ✓ WIRED | 忙分支 `return` 早于 `:2858` 的广播（实读）；K1 断言 `rescanCalls === 2`（忙时一次 + 出口一次，**证明没有双刷**） |
| **G-48-19 失败链** | `同步抛错 → catch（告警含「重扫失败」+ 沿用原判定）→ rescanned 保持 false → 跳过重读 → 失败出口 `skillErrorFromReason` → `{skillError}` → IPC → renderer 既有回滚 + system-note` | 独立 try + 门控 | ✓ WIRED | `:1476-1496` → `:1498-1501` 实读；J8 断言 `readCalls === 1`；**任何一环都不新增文案、不新增返回码**（J8/J9/J10 均断言 `skill_not_found`） |
| **G-48-19 重试读盘链** | `rescanned === true → 第二个 try 内重读 → 抛错即 catch（告警含「重试读盘失败」+ 不赋 result）` | 独立 try | ✓ WIRED | `:1486-1495` 实读；J10 断言 `readCalls === 2` + 两条告警可判别 |
| `_resolveSkillInvocation` 的 `not_found` | `syncAgentSystemPrompt()` → `refreshSkills` → 缓存三字段就位 | 48-07 引入、48-08 结构收紧 | ✓ WIRED | `:1478` 实读；`:2835` 实读（同一次加载管线，调用侧零自行判定） |
| `handleSendAIMessage` 斜杠分支 | `realmAPI.ai.prompt` / `promptWithContext` → `_resolveSkillInvocation` → `readSkillForInvocation` | IPC → 主进程解析 → miss 重扫 → 实时读盘 | ✓ WIRED | `renderer.js:8692-8709` 无本地否决（零 diff）；`ai-manager.js:1447` / `:1488` 两次读盘 |
| `ai-manager.getSkillsForUI()` | `getSeededSkillNamesSafe()` → `getSkillsForUI(seededNames)` → `ai:get-skills` → `realmAPI.ai.getSkills` | 收窄投影过 IPC | ✓ WIRED | 惰性 require + try/catch 降级；两通道 `assertTrustedSender`（零 diff） |
| `refreshSkillsForPanel()` | `syncAgentSystemPrompt()` → `broadcast('skills:changed')` → renderer **无条件**重拉快照 | 读侧 P8 调用方 | ✓ WIRED | `renderer.js:4405-4406` 处理器体只有 `pullAiSkillsSnapshot()`；`.refreshSkills(` = 1（本轮实测） |
| 删除本地否决后的失败通道 | `skillErrorFromReason`（主进程）→ `{skillError}` → IPC → `removeSkillFailureBubbles(userId)` + `pushSystemNote(...)` | **唯一**判定与文案通道 | ✓ WIRED | `renderer.js:8825-8833`；渲染端零文案复制（真相 27）；重试后的失败仍走同一出口（`:1498-1501` 逐字未动） |
| `getConversationMessages()` | `_decorateSkillUserMessage`（user 行）+ `_resolveSkillMarker`（assistant 行） | 装饰层重建 | ✓ WIRED | 方法体内无直接 `matchSkillByPath(`；`_resolveSkillMarker` 现位于 `:1683` |
| `_setupEventBroadcasting` 的 `tool_execution_start` | `skill_invocation` → renderer `toolExecution.skillInvocation` → `renderToolCard` 技能变体 | 事件字段链 | ✓ WIRED | `ai-manager.js:1764` + `renderer.js:9364` / `:9579-9586` |
| `regenerateMessage` / `showAIError` 重试 | `buildResendPayload` → `SkillPickerModel.buildSkillSyntaxText` → `ai.prompt` + `refreshUserMessageBubble` | 唯一反向实现 + 定向刷新 | ✓ WIRED | `buildResendPayload` 定义命中 = 1；`:10006` / `:10083` 两处刷新 |
| `abortAIIfStreaming` / `handleStopAI` | `state.aiCancelledMessageId` → `handleAIStream` error 取消分支 `resolveCancelAttribution` | 锚点解算 | ✓ WIRED | `:9115-9118` / `:8383-8385` 置锚点，`:9390-9395` 解算；B 组 5 条接线护栏随 14/14 通过 |

**未接线的组合链路（本轮唯一）**：`_flushDeferredSkillsPrompt()` 落地 → `broadcast('skills:changed')` → renderer 无条件重拉 → **已打开的 `/` 面板原地重渲染出现新行** 以及 `systemPrompt` 更新 → **模型按 description 匹配到该新技能**。前四段各有独立证据（K1 / K4 / 48-06 护栏 / 48-02 已测），但**端到端串起来的运行时观测不存在** —— 列为真相 53（⚠️）与 Human Verification 首项。

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 面板技能行 | `state.slashPickerItems` | `SkillPickerModel.buildPickerItems(state.aiSkills, SLASH_COMMANDS, rawFilter)` ← `realmAPI.ai.getSkills()` ← `ai-skills-manager._cache.skills`（SDK 扫盘） | Yes | ✓ FLOWING |
| 气泡技能 pill / 折叠块 | `msg.skillInvocation`（`{name, tier, content}`） | 调用响应回传的 `readSkillForInvocation` 实时读盘结果（`ai-manager.js:1516-1519`） | Yes（J 组「改盘后二次调用读到第二版正文」继续绿 → 恒为读盘结果，非缓存副本） | ✓ FLOWING |
| 气泡正文 | `msg.content`（args） | `parseSkillRef(text).args`（renderer）/ `resolveSkillBubbleArgs`（重载） | Yes | ✓ FLOWING |
| 工具卡片标题 | `toolExecution.skillInvocation` | `_resolveSkillMarker` ← `matchSkillByPath` ← `_cache.skills[i].filePath` | Yes | ✓ FLOWING |
| 对话标题 | `_ensureConversation(message)` | 完整语法文本（原始用户输入） | Yes | ✓ FLOWING |
| 运行期新增技能 → 缓存 | `_cache.skills` | miss 时 `syncAgentSystemPrompt()` → `refreshSkills` 扫两个根目录 → 条目落缓存 | Yes（J 组两条正例 + UAT test 14 端到端实测） | ✓ FLOWING |
| **`agent.state.systemPrompt`（纯文本轮）** | `agent.state.systemPrompt` | **本轮新增**：`prompt()` 成功出口 → `_flushDeferredSkillsPrompt()` → `syncAgentSystemPrompt()` → `buildSystemPrompt()`（含 `buildSkillsPrompt()` 的 SDK 产物 = 运行期新增技能的 name / description / location） | Yes（K1 断言 `systemPrompt === buildSystemPrompt()` 且含 `flush-probe`） | ✓ FLOWING |
| **`skills:changed` 广播（纯文本轮）** | `windowManager.broadcast` 频道 | **本轮新增**：同一条链上的 `:2858`（全仓唯一广播点） | Yes（K1 打桩收集到 `['skills:changed']` 恰一次） | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 显式调用纵向切面（含 48-08 K 组 5 + J 组 3） | `node tests/test-ai-skills.js` | `# tests 147 / # suites 28 / # pass 147 / # fail 0` | ✓ PASS |
| 面板与解析纯逻辑（picker） | `node --test tests/test-skill-picker-model.js` | `# tests 95 / # suites 16 / # pass 95 / # fail 0` | ✓ PASS |
| 取消归属纯逻辑 + 接线护栏 | `node --test tests/test-ai-cancel-state.js` | `# tests 14 / # suites 2 / # pass 14 / # fail 0` | ✓ PASS |
| 5 文件回归门 | `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-ai-conversations.js` | `# tests 361 / # pass 361 / # fail 0`（上轮 353 → **+8**，= K 组 5 + J 组 3） | ✓ PASS |
| seeder（gate 口径，**直跑**形式） | `node tests/test-builtin-skills-seeder.js` | `# tests 101 / # suites 16 / # pass 101 / # fail 0`（**全绿**，未复现上轮记录的嵌套 `node --test` 环境性豁免） | ✓ PASS |
| **独立证伪：新测试在旧实现下必然红** | `git worktree add --detach /tmp/realm-v48-old a211abfb` + 拷入本轮 `tests/test-ai-skills.js` + `node tests/test-ai-skills.js` | `# tests 147 / # pass 141 / # fail 6`；失败者恰为 `K1` / `K5` / `源码：延迟补刷是单源实现` / `J8` / `J9` / `J10` —— 既有 141 例零回归（工作树已 `git worktree remove`） | ✓ PASS |
| 补刷单源形状探针 | `node -e`（方法体正则扫描） | `_flushDeferredSkillsPrompt` 方法体含「检脏 → 复位 → `await syncAgentSystemPrompt()` → 失败恢复置脏」四要素且顺序正确；全文件 `await this._flushDeferredSkillsPrompt()` **恰 2 处**；`promptWithContext` 方法体不含 `_skillsPromptDirty` | ✓ PASS |
| miss 重试块形状探针 | `node -e`（方法体正则扫描） | 方法体内 `try {` ≥ 2（两个独立 try）+ 含 `rescanned` 标志 + 含「重扫失败」/「重试读盘失败」两条可判别文案 + `readSkillForInvocation(` 恰 2 次 + 无 `while` / `for (` + 无 `refreshSkills(` | ✓ PASS |
| `syncAgentSystemPrompt()` 函数体未改（P1 / P6） | `node -e` 程序化 `methodBody` 比对 `a211abfb` vs `HEAD` | `IDENTICAL: true`（1062 字符逐字相同）；`_recreateAgent` / `_cleanupCurrentAgent` 同样 `true` | ✓ PASS |
| 权威侧与 renderer 零 diff（P5 / P6 / 真相 60） | `git diff --name-only a211abfb..HEAD -- ai-skills-manager.js src/renderer.js src/preload.js ipc-handlers.js src/skill-picker-model.js src/ai-cancel-state.js` | 输出为空 | ✓ PASS |
| renderer 无自激 / 无新增重扫调用点 | `grep -c "\.refreshSkills(" src/renderer.js` | **1** | ✓ PASS |
| 旧落地时机措辞清零（真相 61） | `grep -c "idle 边界" ai-manager.js docs/product/ai-skills.md` | **0 / 0** | ✓ PASS |
| 例数账本一致（真相 61） | 实跑 `# tests 147` vs `docs/product/ai-skills.md:98` 与 `AGENTS.md:267` | 三处均为 **147**，覆盖面均含 G-48-18 / G-48-19 | ✓ PASS |
| 未加引用的债标记（本增量新增行） | `git diff a211abfb..HEAD -- <5 文件> \| grep -E "^\+" \| grep -E "TBD\|FIXME\|XXX\|TODO\|HACK\|placeholder\|coming soon\|not implemented\|\.skip\(\|test\.todo"` | 五文件新增行**零命中** | ✓ PASS |
| 语法 | `node --check ai-manager.js` | 无输出（通过） | ✓ PASS |
| 本增量 commit 台账 | `.git/gsd-plan-head-before-48-08` vs `48-08-SUMMARY.md` 的 `plan_head_before` | 两者逐字一致（`87fb2cc62713a8ead75594925b6d9e930c4a23a7`）；`git rev-list --count 87fb2cc..064748d` = 4（3 任务 + 1 metadata），与 SUMMARY 的口径说明自洽 | ✓ PASS |

### Probe Execution

未声明脚本探针，且本阶段非迁移 / CLI 阶段：PLAN / SUMMARY 内无 `probe-*.sh` 声明，`scripts/*/tests/` 下无匹配 → **Step 7c: SKIPPED（no probes declared）**。

> 附注一：48-08 的「组合面探针」不属本 Step 的脚本探针形态 —— 它是 `/gsd-verify-work 48` 的自动驱动 UAT 形态，本轮**未执行**，已作为真相 53 与 `human_verification` 首项登记。
> 附注二：48-08 **刻意未向** `.planning/WINDOWS.md` 追加条目（两条 truth 面均为主进程纯逻辑，K/J 组行为用例已在真实 `syncAgentSystemPrompt()` 与真实 `ai-skills-manager` 上闭环）—— 与 48-07 同款记账口径；本轮实测 `git diff a211abfb..HEAD -- .planning/WINDOWS.md` 只含既有 id 24 的状态回填，**无新行**。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DISC-01 | 48-02 | `/` 面板列出全部已启用技能与既有本地命令、可按名称实时过滤 | ✓ SATISFIED | 真相 1/2/3/4/5/6 |
| DISC-02 | 48-01, 48-02, 48-04, 48-05, 48-06, 48-07, **48-08** | 选择技能以 `/skill:name [args]` 调用，正文经 `formatSkillInvocation` 作 `<skill>` 块注入 | ✓ SATISFIED（**代码面 + 运行期面双闭合**） | 真相 7-13、21-23、25-26、28、30、37-42、**45、54-56、61**；48-08 使「纯文本轮也落地回写与广播」在行为面成立（K1-K5），UAT test 14/15/16 已实测端到端 |
| DISC-03 | 48-01, 48-05 | 技能调用进入对话历史并触发 LLM（与本地命令区分） | ✓ SATISFIED | 真相 14、24、**25（运行期实测通过）** |
| DISC-04 | 48-01, 48-02 | 技能列表区分来源（user/managed/seeded）并以徽标展示；被遮蔽的同名技能可见 | ✓ SATISFIED | 真相 4、15、38 |
| DISC-05 | 48-03 | 模型可按 description 自动匹配技能并 `read` 其正文 | ✓ SATISFIED | 真相 18、19 机制面全绿；**真相 29 本轮由 UAT round 2 test 13 实测证成**（换 mimo-v2.5 后模型自发 `read`、卡片技能化、正确区分技能与工具）。truth 53 指出运行期新增技能在该面的**组合可见性**仍待一次探针 |
| DISC-06 | 48-01, 48-06, 48-07, **48-08** | 调用不存在的技能给出明确错误提示（不出现「点了没反应」） | ✓ SATISFIED | 真相 16、21、27、39、**43（抛错分支本轮由 J8/J9/J10 行为用例闭合）**、57-59；UAT round 3 test 17a 实测「不存在名 → note + 气泡回滚 + 后续消息正常」 |
| DISC-07 | 48-01, 48-02 | `disable-model-invocation` 不进 system prompt，仍可 `/skill:` 显式调用并在 UI 打标 | ✓ SATISFIED | 真相 17、4 |

**Orphaned requirements:** 无。`REQUIREMENTS.md:130-136` 映射到 Phase 48 的恰为 DISC-01..07，七个 ID 全部出现在至少一个 PLAN 的 `requirements:` 字段（48-01: DISC-02/03/04/06/07、48-02: DISC-01/04/07、48-03: DISC-05、48-04: DISC-02、48-05: DISC-02/03、48-06: DISC-02/06、48-07: DISC-02/06、**48-08: DISC-02/06**）。本轮复跑全部 8 个 PLAN 的 `requirements:` 字段逐一确认，无新增 / 缺失。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `ai-manager.js` | 1048 / 1182 / 1447 + `ai-skills-manager.js:808` | **WR-02（部分收敛、仍开）**：三处裸 `await`（两处调用点 + 首次读盘）与一处位于自身 try 之前的动态 import —— 任一抛出穿透到 IPC，而 `isProcessing` 已置真且不复位 | ⚠️ Warning（**已记档，非 phase-blocking**） | 48-08 只把**本次新增的调用点**纳入 try，且其 prohibition P5 **明文禁止**顺手闭合（用户未裁定）。本轮无命名测试变红、无可复现运行期观测 → 按 re-verification evidence gate 记 advisory，不计入 Step 9 Rule 1 |
| `docs/product/ai-skills.md` | 392 vs 421-425 | **IN-12**：§10.7 仍写 G-48-4+G-48-6 的「三件套**即时**呈现」，与 §10.8 已按裁决收口的「本轮回合结束时即现…不是回车那一瞬间」互相排斥 | ℹ️ Info（文档自相矛盾） | 48-08 恰好编辑同一节尾部却未顺手收口（成本一行）；不 falsify 任何 must-have |
| `docs/product/ai-skills.md` | 312 / 393-395 | **IN-13（本轮新增）**：成本账本**反向**漂移 —— 出口补刷让一次 miss 在 `prompt()` 通道上同轮付**两次**全量重扫，两处文档仍写「一次」；K1 断言的 `rescanCalls === 2` 即反证（**新代码是对的，旧账本没跟上**） | ℹ️ Info | 不影响任何 must-have；建议 Phase 49 前把两处改为「同轮两次：解析判定 miss 时一次 + 成功出口补刷一次」并补「命中路径仍零重扫」 |
| `ai-manager.js` | 2843-2844 / 2926-2983 | **IN-14 / IN-15（本轮新增）**：忙分支**无条件**置脏（不比对 digest 是否真变），且错误出口刻意不补刷 → 一次拼错的 `/skill:` 的代价会**延后泄漏**到之后任意一条普通消息；`_recreateAgent()` 重建 prompt 与 digest 却**不清**脏标记；补刷「先复位后同步」在 `syncAgentSystemPrompt()` 的两条**不抛错**早退下会静默清掉标记 | ℹ️ Info | 代价固定、有界、自愈；今天是「措辞与实现不完全对应」而非错值。契约 4 的「变更绝不静默丢弃」读起来是无条件的，建议按 IN-15 Fix ① 加一行 `if (!this.agent || !this.sandboxEnv) return;` |
| `ai-manager.js` / `ai-skills-manager.js` | 1427-1430 / 1466-1469 / 468-637 | **IN-16（本轮新增，唯一有潜在翻转风险）**：跳过重试读盘的理由（「整批失败会回滚缓存三件套 ⇒ 重读必然同形」）**在本仓不成立** —— `refreshSkills()` 契约上**永不抛错**（其动态 import 也在同一 try 内），真能抛的只有先于它的三个取值点。结论（缓存未变）对，**依据错** | ⚠️ Info（有翻转风险） | 若日后把 `refreshSkills` 改成「整批失败即抛错」（一个常见的「别吞失败」重构方向），`if (rescanned)` 的跳过会把**已刷新成功、缓存里已有**的技能判成 `not_found`。建议改写注释依据，或把 `rescanned` 换成「重扫后 digest 是否变化」的判定 |
| `tests/test-ai-skills.js` | 1318-1348 vs 3252-3282 | **IN-17（本轮新增）**：K5 与改写后的 `Agent prompt 回写（SKILL-04）` 护栏**八条断言逐字重复**（两份 gate 会各自漂移）；且 `withContext.includes('this._skillsPromptDirty') === false` 是**文本**断言，会把「在注释里**提及**该标识符」判成红（本文件既有风格恰恰如此，如 `:2823-2825`） | ℹ️ Info（假红风险） | 不是假绿（成功/错误出口语义由 K1 / K3 行为断言兜住）。建议删掉一份改指针注释，并把文本断言收敛为赋值/读取语句的两个正则 |
| `ai-manager.js` | 506 / 543 | `XXX` 字样出现在**工具描述的中文散文**里（「搜索收藏 XXX」/「生成一个脚本做 XXX」），非债标记 | ℹ️ Info | 既有内容，48-08 未触及；非 TBD/FIXME/XXX 债标记语义，**不构成 BLOCKER** |
| 全阶段改动文件 | — | `TBD` / `FIXME` / `XXX` 债标记 | ℹ️ Info | 无新增未引用债标记（本增量五文件新增行零命中） |
| 阶段改动文件 | — | 占位 / 空实现（`return null` / `return []` / 「即将推出」） | ℹ️ Info | 未发现；`readSkillForInvocation` 的 `{ok:false,reason:'not_found'}`、`resolveCancelAttribution` 的 `-1`/`false`、`_flushDeferredSkillsPrompt` 的检脏早退均为**终态判定结果**，非 stub |

### Advisory（新范围 / 无独立决定性证据，或已有成对证据但已记档）

> 按 Step 7 的「re-verification evidence gate」列出。本轮**无** carried-forward gap（Step 0 的 `gaps_remaining` 为空）、**无**未引用债标记 —— 故以下各项**不**构成 🛑 Blocker。

| # | Finding | Category | 为何仅作 Advisory |
| - | ------- | -------- | ----------------- |
| 1 | **WR-02**（技能解析链三处裸 `await`，抛出即 `isProcessing` 永不复位） | 架构 / 健壮性 | 48-08 的 prohibition P5 **明文禁止**顺手闭合（用户未裁定）；本轮独立复核形式未变，但**无**命名测试变红、**无**可复现运行期观测 → 按 fail-closed 规则记 Advisory |
| 2 | **IN-13 / IN-14 / IN-15 / IN-16 / IN-17**（本增量新增的 5 条 Info） | 账本 / 生命周期 / 注释依据 / 护栏去重 | 均不 falsify 已登记 must-have；K1-K5 / J8-J10 断言全部成立，失败码域与三字段单源未变。其中 **IN-16 有潜在翻转风险**，建议 Phase 49 前处置 |
| 3 | **IN-12**（§10.7 `:392` 旧「即时」措辞与 §10.8 冲突） | 文档一致性 | 48-05/48-06 遗留，非本增量引入；该句约束的是气泡呈现时机（G-48-4 + G-48-6），不属 48-08 must-have 的「延迟回写与广播何时落地」枚举范围 |
| 4 | **台账滞后**：`.planning/ROADMAP.md:238` 的括注仍写「48-08 待执行」；`.planning/WINDOWS.md` id 22 / 23 仍 `open`，而其声明的终证探针已在 UAT round 2/3 实测通过 | 账本同步 | 不 falsify 任何 must-have（真值由 UAT 实测记录 + 源码共同支撑）；收口点是 `/gsd-verify-work 48`，非 48-08 计划（其 Task 3 步骤 9 亦刻意不改 WINDOWS.md） |
| 5 | **WR-01 / WR-03 / WR-04 / WR-05** 与 **IN-01..IN-11**（`48-REVIEW.md` §A 台账其余项） | 架构 / 一致性 / 卫生 / 死代码 | 48-08 的 prohibition 明文禁止顺手修，且均不 falsify 已登记真值；本轮未独立复跑其探针（§A 台账逐条实读） |
| 6 | 性能面（`getSeededSkillNamesSafe()` 逐次 readdir、`_resolveSkillMarker` 逐条调用；miss 路径新增一次出口全量重扫 → 单轮最多两次） | 性能（v1 范围外） | 沿用上一轮口径；K1 的 `rescanCalls === 2` 把它变成可观测事实。建议 Phase 49 起评估负缓存 / 节流（IN-11 / IN-13） |

### 既有红项核对（D-48-A，预注册）

- 本轮直跑 `node tests/test-builtin-skills-seeder.js` → `# tests 101 / # pass 101 / # fail 0`（**全绿**，与上一轮一致）。`48-VALIDATION.md` 记录的「嵌套 `node --test` 下 `:2200` `DOC-02` 计数断言失败」属环境性豁免，本轮以**直跑形式**执行，未复现。

### 阶段门槛与文档一致性核对

- `48-08-PLAN.md` 的 `requirements: [DISC-02, DISC-06]`、`gap_closure: true`、`gap_ids: [G-48-18, G-48-19]`、`files_modified`（5 项）与 `48-08-SUMMARY.md` 的 `key-files.modified`（5 项）一致；实测 `git diff --name-only a211abfb..HEAD` 的**源/文档**改动集合 = `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md` / `48-VALIDATION.md`（**严格等于 `files_modified`**），余下为 `.planning/**` 台账与计划元数据 → **零 scope creep**。
- `48-08-SUMMARY.md` 的 `plan_head_before: 87fb2cc62713a8ead75594925b6d9e930c4a23a7` 与 `.git/gsd-plan-head-before-48-08` **逐字一致**（历史事故：空基线会让「零 diff」类判据假绿 —— 本条已按 48-07 同款口径落在 SUMMARY frontmatter）；`git rev-list --count 87fb2cc..064748d` = 4，与 SUMMARY「任务提交 3 + metadata 1」的口径说明自洽。
- `docs/product/ai-skills.md` §七 的例数（147）与实跑输出、`AGENTS.md:267` 的例数逐字一致（`AGENTS.md:272` 的维护约定要求「改动实时读盘 / 忙时语义口径必须同步权威章节 + 测试清单」→ 本增量执行了，合规）；未同步的残余是 §10.7 `:392`（IN-12）与两处成本账（IN-13）。
- `48-UAT.md` 的 `## Gaps` 块：`G-48-2` / `G-48-3` / `G-48-4` / `G-48-6` / `G-48-12` 均 `status: resolved`；**`G-48-18` / `G-48-19` 仍 `status: failed`** —— 与 48-08 SUMMARY 自述的「不自行标注 resolved、由重跑 verify-work 回填」一致。
- `.planning/WINDOWS.md` id 24 状态 `fixed`（`resolved_at: 2026-09-12T15:02:36.971Z`）；frontmatter `open_count: 22 / fixed_count: 2 / total_count: 24`；id 21 / 22 / 23 仍 `open`（见 advisory 第 4 条）。
- `48-REVIEW.md` 的 `review_kind: incremental-gap-closure-re-review`、`findings.critical: 0`（TD-48-01 / TD-48-02 按用户裁决不计入 critical）、`closed_this_increment: [WR-07, WR-08]`、`carried_forward` 16 条 —— 与本报告 §Advisory / §Anti-Patterns 无冲突。

### Deferred Items

无（Step 9b 逐条比对后续阶段：Phase 49 `manage_skill` 写路径 / Phase 50 设置页启停卸载 / Phase 51 导入 —— 均**不覆盖** WR-02（裸 await）、IN-12 / IN-13 / IN-16 的**修复**；恰恰相反，49/51 会放大前两者的可达性与成本账的重要性。故这些不作为 deferred 处理，而是作为已登记 advisory / 待裁决项）。

### Gaps Summary

**本轮的功能目标在代码库中成立，且 48-08 的交付面全部核实为真 —— 本轮把上一轮 5 条行为未验证真值全部升级为 VERIFIED，并闭合了 G-48-12 运行期面；但 G-48-18 的「组合面」仍未被行使，故本阶段维持 `human_needed`。**

- **48-08 增量的 9 条真值 + 6 条禁止项全部 VERIFIED（真相 54-68）**：唯一补刷实现 + 两个成功出口共用（实测恰 2 处）+ 首行检脏早退零成本 + 只在成功出口补刷（K1-K5）；两个独立 `try` + `rescanned` 门控 + 可判别告警 + 安全 err 取值（J8-J10）；权威侧与 renderer 零 diff、`syncAgentSystemPrompt()` 方法体程序化比对 `IDENTICAL: true`、失败码域与三字段单源未变；文档与例数账本（147）一致。
- **测试实跑（非采信 SUMMARY）**：`test-ai-skills.js` **147/147**（48-07 后 139 → +8）、`test-skill-picker-model.js` 95/95、`test-ai-cancel-state.js` 14/14、5 文件回归门 **361/361**（上轮 353 → +8）、seeder（直跑）101/101 —— 全绿。
- **独立证伪（本轮新增手段）**：把本轮测试文件放进 `a211abfb`（48-08 前）的 detached 工作树运行 → `# fail 6`，失败者恰为 `K1` / `K5` / 改写后的单源护栏 / `J8` / `J9` / `J10`。这证明 48-08 的新用例是**真门禁**（可被失败），而不是同义改写；既有 141 例在旧实现下零回归。
- **无 must-have 真值 FAILED、无 artifact MISSING/STUB、无 key link NOT_WIRED、无未引用债标记、无 UNCERTAIN。**
- **2 条真值落 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED**，已逐条进入 `behavior_unverified_items` 与 `human_verification`：
  - **真相 53（G-48-18 组合面，本阶段收尾的第一待证项）** —— 主进程半（补刷落地 → systemPrompt 更新 → 广播）由 K1-K5 在**真实 `syncAgentSystemPrompt()`** 上钉死；但「已打开的 `/` 面板随后可见 / 模型按 description 匹配到运行期新增技能」这条**接通链**无任何测试或探针行使。48-08 的 PLAN 诚实边界 truth 与 SUMMARY `Next Phase Readiness` **均显式声明**该终证归下一轮 `/gsd-verify-work 48` 的自动驱动探针，并给出探针形态。
  - **真相 20（48-02 backstop 视觉观感）** —— 结构面齐备，UAT test 7 已由自动驱动实测判 pass；保留为人工可推翻的**观感**裁决（WINDOWS id 21 仍 `open`）。
- **本轮新增闭合（不再作为待办）**：
  - **G-48-12 运行期面** —— UAT round 3 test 14 自动驱动实测通过（`managed-skills/` 运行期新建目录 + 不打开 `/` 面板 + 直接手打），`G-48-12.status` 已回填 `resolved`、WINDOWS id 24 已 `fixed`。
  - **WR-07 / WR-08** —— 48-08 双修复并配套行为用例；`48-REVIEW.md` 的 `closed_this_increment` 记为 `[WR-07, WR-08]`。**WR-02 只部分收敛（仍开）**、**WR-06 保持开放（随 Phase 49）** —— 两者均**未**被任何文档声称已修（truth 62 已核）。
- **已裁决延后项维持不动**（不得重开为 BLOCKER）：**TD-48-01**（面板行 `title` 属性逃逸，接手触发点 = Phase 49 开工前第一条）、**TD-48-02**（取消标记生命周期，Phase 49 开工前同批）。二者落点文件 `src/renderer.js` **本轮零 diff**，形态与行号未变。
- **结论**：自动化可裁决面全部通过；**唯一未行使的运行时面是 G-48-18 的组合面**。**该面由 `/gsd-verify-work 48` 的自动驱动探针复核通过前本阶段不得 complete**（与用户既有口径「UAT 为准」及 `.planning/WINDOWS.md` 的 unrecorded-verify 记账纪律一致）；同时建议一并处置 advisory 第 1/2/3/4 条（WR-02 修复时机裁决、IN-13 成本账本、IN-12 措辞、台账滞后）。

## 收尾裁决记录（2026-09-12 · 历轮累计）

| 轮次 | 项 | 裁决 | 落地 |
| --- | --- | --- | --- |
| gap 闭合轮（round 2 收尾） | CR-05（Critical，取消标记无生命周期） | 先记技术债，直接跑 UAT | 登记为 `48-REVIEW.md` 的 **TD-48-02**，接手触发点 = Phase 49 开工前 |
| gap 闭合轮（round 2 收尾） | WR-05（G-48-6「立即」口径） | 收口措辞为「本轮回复结束时即现」 | §10.8 + 报告真相 26 + UAT 第二轮 item 9 同步（**残余**：§10.7 `:392` 未随裁决更新 → IN-12） |
| gap 闭合轮（round 2 收尾） | WR-06（调用路径绕过 64 KiB 字节闸） | 未裁决修复时机，保持开放 | 记入 `48-REVIEW.md`；48-07 与 48-08 均在 §10.7 显式标注「未被修复、不得声称已修」 |
| UAT round 2 | G-48-12 口径 | **修复**（不是收口文档、不是记技术债） | 48-07 在**调用侧**落地 miss 一次性权威重扫 + 重试读盘；`ai-skills-manager.js` 零 diff |
| UAT round 3 | G-48-12 运行期面 | 由自动驱动探针回填 | test 14 pass → `G-48-12.status = resolved`、WINDOWS id 24 = `fixed` |
| UAT round 3 | WR-07（纯文本流下回写/广播不落地） | **路线 A：补 flush**（本阶段闭合，不延后） | 48-08 抽出唯一实现 `_flushDeferredSkillsPrompt()` + 两处成功出口共用 + K 组 5 例（**已完成**） |
| UAT round 3 | WR-08（抛错分支零行为用例 + 三处字面失配） | **修复 + 补行为用例**（本阶段闭合，不延后） | 48-08 两个独立 `try` + `rescanned` + 可判别告警 + 安全 err 取值 + J8/J9/J10（**已完成**） |
| **本轮（round 4，48-08 复验）** | WR-02（技能解析链三处裸 `await`） | **仍未裁决** —— 48-08 的 P5 明文禁止顺手闭合 | 已进 advisory 第 1 条；修法与配套用例见 `48-REVIEW.md` §C.WR-02 的 Fix 段 |
| **本轮（round 4，48-08 复验）** | G-48-18 组合面 | **未裁决** —— 属运行时待证项，非代码缺口 | 已进 `behavior_unverified_items` + `human_verification` 首项，探针形态由 48-08 SUMMARY 给出 |

**指纹维护说明（本轮变更）：** `covered_files` 在上轮基础上**新增** `.planning/phases/48-skill-name/48-08-PLAN.md` 与 `48-08-SUMMARY.md`（本轮实际覆盖的规划输入），并按当前文件内容重算 `covered_digest`（`v1:sha256:edbf5794…`）。**`48-UAT.md` 依旧刻意不入清单** —— UAT 是人工实测记录、不是验证输入：把它并入后每追加一轮 UAT 都会让本报告被 `verification.status` 判 `stale`（上一轮实测踩到两次，遂于 `2292eb4` 移出）。同理 `.planning/WINDOWS.md`（跨阶段账本）只被读、不入清单。48-08 改动的 `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md` / `48-VALIDATION.md` **均已在清单内**并随本次重算更新。

---

_Verified: 2026-09-12T16:50:43Z_
_Verifier: Claude (gsd-verifier)_

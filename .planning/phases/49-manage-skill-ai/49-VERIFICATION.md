---
phase: 49-manage-skill-ai
verified: 2026-09-13T14:52:00Z
status: human_needed
score: 13/13 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - AGENTS.md
  - ai-manager.js
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - src/renderer.js
  - src/skill-picker-model.js
  - src/styles/main.css
  - tests/test-ai-skills.js
  - tests/test-manage-skill.js
  - tests/test-skill-picker-model.js
  - tests/uat-49-g49-3-panel-layout.js
  - .planning/phases/49-manage-skill-ai/49-01-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-02-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-03-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-04-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-05-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-06-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-07-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-01-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-02-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-03-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-04-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-05-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-06-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-07-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-REVIEW.md
covered_digest: "v1:sha256:3a040cc0e81a8b806a8bec543a7634d5e133e7020434b691fc8d10db1fc4dcc5"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "13/14"
  gaps_closed:
    - "[backstop] AI 面板最小宽度（--ai-panel-min-width: 280px）下，带来源徽标 + 内联标注的 manage_skill 卡片头部保持单行不换行，徽标与短原因完整可读（仅技能名缩略），头部高度不变"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-09：新驱动 A9（「CSS 声明零改动」的全轮声明投影 sha 相等）的红轮基准只活在 /tmp/uat49/evidence-g49-3.json，基准缺失时 A9 退化为自比较（恒真）；它引用的第二个判据 css-decl-freeze 只存在于 49-07-PLAN.md 的 <verify> 块，不在仓内"
    category: architectural
    reason: "本轮已用**不依赖该守卫**的独立路线闭合该 must-have：从 git 取 fcf42d8^ 的 src/styles/main.css，与当前树各自跑剥注释后的声明投影 sha256 —— 两者逐字相等（均 69899a4f…），且 .tool-card-manage-note / -error / -limit / .tool-card-name-text 四个规则块逐字相等。故 must-have 判 VERIFIED，守卫弱点作为覆盖缺口记录。修法：把红轮基准改成仓内常量（如固定 sha 的 fixture）或把 css-decl-freeze 落进 tests/"
    evidence_status: "mechanically reproduced by reviewer; neutralized this round by an independent git-based route"
  - finding: "WR-10：真实渲染门禁 A1–A6 全是「不越界」单向判据 —— 给 `.tool-card-manage-note` 加 `display: none` 时 A1–A9 全绿（A3 反而更绿：技能名宽度变大）"
    category: architectural
    reason: "本轮已用不依赖该守卫的路线闭合：直接读 src/styles/main.css:6213-6221 的声明集（flex-shrink/white-space/font-size/font-weight/line-height，**无** display 覆盖），读 4× 放大截图确认「超预算」已渲染，并读证据 JSON 的 note clientWidth 34 === scrollWidth 34（非零渲染宽）。修法见 49-REVIEW.md：补一条「标注 clientWidth > 0 / rect 宽 > 0」的正向判据"
    evidence_status: "mechanically reproduced by reviewer; neutralized this round by source + screenshot + evidence read"
  - finding: "WR-11 / IN-10：两处源码面护栏（tests/test-ai-skills.js 的 M10、tests/test-skill-picker-model.js 的「引用形式」正则）的 stripComments 只剥整行注释，行尾注释仍可满足 —— `noteText = '超预算'; // noteText = window.SkillPickerModel.PROMPT_OMITTED_CARD_NOTE` 这类形态可让判据转绿"
    category: architectural
    reason: "本轮已用不依赖该守卫的路线闭合：直读 src/renderer.js:9659 的真实赋值行（独立语句、非注释、非行尾），以及 src/skill-picker-model.js:269 的真实投影声明；并以运行时求值确认 `PROMPT_OMITTED_CARD_NOTE === STATUS_TEXT.promptOmitted.split(' · ').pop()`。修法见 49-REVIEW.md（判据跑在剥注释后的副本上）"
    evidence_status: "mechanically reproduced by reviewer; neutralized this round by direct source read"
  - finding: "WR-05：M3 仍是子串扫描，一个完整的 CR-01 回归（把 prev 传 null）通过全部 282 例（前轮已由 verifier 机械复现）"
    category: architectural
    reason: "代码本身正确（本轮已直读 src/renderer.js:9378-9385 的并入分支并独立求值真实合并函数）。守卫强度债，不影响目标能力。修法：把渲染端整个事件映射移进 src/skill-picker-model.js 的纯函数，由测试用真实载荷驱动"
    evidence_status: "mechanically reproduced by previous verifier round"
  - finding: "WR-06：幽灵写入仍报无保留的成功 —— 三态修复删掉了唯一的异常信号，`promptIncluded === undefined` 分支不追加任何说明"
    category: architectural
    reason: "本轮独立探针的 8 条对抗 description 零幽灵，无法构造出幽灵生产者（前轮 30 条对抗输入同样零幽灵），故为残余风险而非可复现回归。信号就在代码里（ai-manager.js:6297-6300）"
    evidence_status: "none provided (reviewer and both verifier rounds failed to produce a ghost)"
  - finding: "WR-07：实时 / 重载两链路的 manageSkill 键集合在「工具从未执行」类调用上分歧（live 无 tier、reload 有 tier）"
    category: architectural
    reason: "既有的、49-05 must_haves 之外更宽的一类；不影响目标能力与 seeded 保护（前轮已用真实函数机械复现）。不影响 49-07 面"
    evidence_status: "mechanically reproduced by previous verifier round"
  - finding: "WR-08：`[code]` 词缀的编码谓词比解码谓词宽 —— 「只含白名单原因码」在三处文档里被声明为强制，实际一处都未强制"
    category: security
    reason: "当前可达面窄：块内 throw 要么走 makeManageSkillError 的九码、要么是 Node 大写码（前轮已机械复现）。不影响目标能力"
    evidence_status: "mechanically reproduced by previous verifier round"
  - finding: "IN-11：docs/product/ai-skills.md:529 的「诚实边界」写「真实渲染门禁**未用真实渲染**逐条覆盖它 —— 它只覆盖超预算那条」，与已落盘证据相反（同一次真实渲染里 errorNoteRounds[280] 抓到了真实失败卡片 `描述不合法`，A8 对它做了判定）"
    category: other
    reason: "文档口径与证据不符（把已发生的覆盖说成未发生），且掩盖了「A8 是条件性判据 ⇒ 覆盖率随数据集浮动」这一真正的边界。不影响目标能力。修法见 49-REVIEW.md IN-11"
    evidence_status: "mechanically reproduced this round (read evidence-g49-3.json errorNoteRounds + A8 断言体)"
  - finding: "IN-12：「卡片的**结果区**已承载完整语义」在默认折叠态下不成立（.tool-card-content max-height: 0，需点击展开）"
    category: other
    reason: "两处文档（docs/product/ai-skills.md:528 与 src/skill-picker-model.js 的 JSDoc ②）用这条理由为短形态背书，读起来像「无需额外操作即可获得」，与实现不符。属文案诚实度问题：E1 的「≤ 4 字」处置本身已按 UI-SPEC 照做（3 字），几何不变式成立"
    evidence_status: "mechanically reproduced this round (read main.css:6235-6243)"
  - finding: "IN-13：src/styles/main.css:6192-6199 的实测口径自相矛盾 —— 「两轮的**标注** scrollWidth 同为 148」实为**祖先**的 scrollWidth（标注自身两轮都是 100）；「8 + 30 + 8 + 100 = 146 > 136，越界 11.84px」中 11.84 是 A1 的外接矩形口径，146 − 136 = 10"
    category: other
    reason: "该注释段的全部价值是「来源可查、实测与估算分离」，此处把两种口径写成一个等式（同一段后文的 ≈/估算标注做法是对的）。数值本身都能在 /tmp/uat49/g49-3-red.log 查到。修法见 49-REVIEW.md IN-13"
    evidence_status: "mechanically reproduced this round (read main.css 与红轮日志并逐项核对)"
  - finding: ".planning/WINDOWS.md 的 unrun-verify 条目 #30 低估了现有覆盖 —— 它写「G-49-3 的渲染门禁只覆盖超预算那条形态」，但同一驱动的 A8 在 280px 档确实抓到了一张真实失败卡片并做了判定"
    category: other
    reason: "账本口径滞后于证据（未覆盖面实际只剩「九码中其余八条 + 每条 6 字最宽形态」）。不阻断目标"
    evidence_status: "mechanically reproduced this round (read evidence-g49-3.json#errorNoteRounds)"
coincidental_reliance_items:
  - truth: "SC3：seeded 三入口拒绝按播种登记表判定（非目录位置）"
    reason: fixture-only
    harden: "仓内 55 例与本轮独立探针都在纯 Node 下**显式注入** seededNames 常量数组；真实运行时该值来自 ai-manager.js:6195 的 getSeededSkillNamesSafe() → builtin-skills-seeder.getSeededSkillNames()（扫 skills-builtin/ 目录名，当前 2 个）。本轮已核实数据源目录确为 `['find-skills','skill-creator']`（探针 J1），但**生产注入值本身仍无自动化断言**，且该函数在纯 Node 下会 console.warn 并降级为 [] —— 此时 seeded 保护完全消失。建议补一条接线断言：electron 环境下 getSeededSkillNamesSafe() 返回非空且 === skills-builtin/ 的目录名集合"
human_verification:
  - test: "端到端可见性（49-VALIDATION.md 五步表的步骤①+②）：`npm run dev`，在 AI 聊天里显式要求它把某套流程沉淀为技能（名字用 commit-style）；**不重开对话**直接发下一条消息问「你现在有哪些技能？」"
    expected: "应答中出现 commit-style —— 这是 ROADMAP SC1「新技能集在下一条消息即对模型可见」的**层 2 证据**（真实 LLM 往返），49-VALIDATION.md 明文声明不得由层 1 证据替代"
    why_human: "需真实 LLM 往返 + 运行中的应用，本次复验未独立重跑。已由 49-UAT.md 测试 1 记录 pass（source: automated-e2e，证据 /tmp/uat49/evidence.json#tests.test1_visibility，真实应答逐字含 commit-style）；但该证据落在 /tmp，且 UAT 轮尚未随 49-07 重跑"
  - test: "UAT 账本终证：重跑 `/gsd-verify-work 49` 的三项自动驱动探针（重点第 3 项 280px 面板布局），把 `49-UAT.md` 的 `G-49-3` 由 `failed` 翻转"
    expected: "三项探针通过、G-49-3 翻为 closed。**代码 / 真实渲染面已由本次独立复跑闭合**（`NODE_PATH=\"$(npm root -g)\" node tests/uat-49-g49-3-panel-layout.js` 退出码 0，A1–A9 全绿，4× 放大截图可见「超预算」完整渲染）"
    why_human: "过程账本的翻转不属 verifier 的写权；`49-UAT.md` 当前仍记 `status: failed`，本次报告**不据此判代码未达成**"
  - test: "可选：把 AI 面板拖到 280px，让一张失败态 manage_skill 卡片（带 `-error` 短原因）出现，逐个核对九条短原因中最宽者（6 字）的右端是否完整可读"
    expected: "标注右缘 ≤ 裁切祖先右缘、祖先不溢出、技能名 clientWidth > 0"
    why_human: "门禁对失败态的覆盖是**条件性**的（找不到真实失败卡片时 A8 自动通过并记 covered:false），本轮只覆盖到九码中的一条（`描述不合法`，5 字）；其余八条与 6 字最宽形态仅由算术保证（WINDOWS.md 的 unrun-verify #30 已登记）"
---

# Phase 49: `manage_skill` 工具（AI 自建技能）Verification Report

**Phase Goal:** AI 可自主创建、更新、删除自己的技能，且无法覆盖或删除随包内置技能。
**Verified:** 2026-09-13T14:52:00Z
**Status:** human_needed
**Re-verification:** Yes — 49-07 收口 `49-UAT.md` 的 `G-49-3` 之后的全量复验（前次报告已被 49-07 落地而失效）

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1（机制）：三动作落盘后技能集与 system prompt 在本轮**成功出口**回写，新技能下一条消息可见 | ✓ VERIFIED | 源码 `ai-manager.js:3038-3041`（忙时只置脏）→ `:6254` 共享成功出口恰一次 `await this.syncAgentSystemPrompt()`；**行为用例 L1**（真跑 `tool.execute` + `aiManager.prototype.prompt` 的真实成功出口）断言：忙时 `_skillsPromptDirty===true` 且 prompt **不含**新技能 → 出口后 `false`、prompt 含新技能、逐字符等于 `buildSystemPrompt()`、广播 `skills:changed` **恰一次**、`rescanCalls===2`。实跑 `node tests/test-ai-skills.js` **177/177 pass**。层 2（真实 LLM 往返）见 Human Verification #1 |
| 2 | SC2（接口面）：`parameters.properties` 键集合**恰为** `{action,name,content,description}`，无 `path`；`enum` 恰为三值；`executionMode: 'sequential'` | ✓ VERIFIED | 逐字读取 `ai-manager.js:6166-6190`；`execute` 只读 `params.action/name/content/description`（`:6192-6249`），传 `path` 亦被忽略 |
| 3 | SC2（服务端二次校验）：非法 name / 空 description / 空 content / 超长 description 一律被拒并给出可读原因，且**不落盘** | ✓ VERIFIED | 独立探针 D1–D5：11 种非法 name 形态全拒；空 description→`invalid_description`；空 content→拒；1025 字符 description→`invalid_description`；三次失败后 `managed-skills/ok-name` **不存在** |
| 4 | SC3：seeded 覆盖 / 删除按**播种登记表**判定（非目录位置），三入口一致拒绝且内容零改动 | ✓ VERIFIED | 独立探针 A1–A6：把 `find-skills` 造在 `managed-skills/` 下（位置=managed）后 create / update / delete **三入口全部** `seeded_protected`，`SKILL.md` sha 逐字未改；`skill-creator` 同判。反向例 B1–B3：**同目录**下的非登记名 create / update 均成功（证明不是「managed 目录一律拒」） |
| 5 | SC4：原子写经沙箱 `env.renameFile` 获得 dest 双基准路径校验；失败不留半成品 | ✓ VERIFIED | `agent-workspace.js:277-284` 对 src/dst **分别** guard；实测越界 `renameFile(..., '/tmp/v49-escape-probe.md')` → `permission_denied`；探针 E1/E2 注入 rename 失败 → throw 且 `managed-skills/half-made` **不存在**；探针 D1 另证 7 种路径注入式 name（`../evil` / `a/b` / `..\\evil` …）全被 name 校验器拦在沙箱之前 |
| 6 | SC4：不触及 `ai-memory/`、`attachments/` 等其他工作区路径 | ✓ VERIFIED | 探针 F1/F2：对这两目录做 `snapshotTree` 深比较，create + update + delete 前后**逐字不变** |
| 7 | SC5：工具描述含两条引导文案（「仅在用户明确要求…」/「优先增强已有技能，而非创建近乎重复的新技能」）且不进 `REALM_SYSTEM_PROMPT` | ✓ VERIFIED | 逐字读取 `ai-manager.js:6161-6162`（同在 `description` 字符串内） |
| 8 | Gap1（幽灵技能）：写侧允许落盘的任何 description 都能被加载管线收进技能集、且逐字无损；字节闸按**组装全文** | ✓ VERIFIED | 独立探针 H1：8 条对抗 description（`": "` / `#` / 裸 `true` / 裸 `null` / 单引号+换行 / 前导 `-` / `@` / `*`）经 `refreshSkills` 真实加载后**零幽灵、零失真**；H2 纯零宽（U+200B×3）→ `invalid_description`；H3 零残留；I1 组装全文**恰好 65536 字节放行**、I2 **65537 拒绝 `oversize`**、I3 零残留、I4 content 单独 64591 B（< 65536）但组装超限 → 拒绝（证明判的是字节而非 content 长度） |
| 9 | `getSkillPromptIncluded` 三态（`true` / `false` / **未命中 `undefined`**）且消费侧按三态收口 | ✓ VERIFIED | 源码 `ai-skills-manager.js:1651-1656` + 消费侧 `ai-manager.js:6266-6275`：只有 `boolean` 才写 `meta.promptIncluded` / `details.promptIncluded`，只有严格 `false` 才追加「预算已满」文案（`:6297-6300`） |
| 10 | Gap2：终态 `manageSkill` **并入**而非覆盖 —— 保留 start 的 `action`/`name`，叠加终态三键；迟到的不带标记载荷不抹标记 | ✓ VERIFIED | 源码 `renderer.js:9378-9385`（**独立语句**的真实赋值并入，非注释）+ 单源 `skill-picker-model.js:450-454`；本次独立求值真实导出函数：`merge(base,{tier,promptIncluded})` → `{action,name,tier,promptIncluded}`（`action`/`name` 保留）；`merge(t1,null)` → **同一引用**返回（不抹标记）；`incoming` 同名键胜出；入参未被修改 |
| 11 | Gap3：重开对话后重建的 `manageSkill` 与实时链路**键集合与取值逐字相等**（成功行 / 失败行），失败短原因由持久化词缀还原（不重算） | ✓ VERIFIED | 行为用例 M5b（成功行：真实 `_resolveManageSkillMarker` / `_resolveManageSkillTerminal` + 真实 `mergeManageSkillMarker` + 真实 `getConversationMessages` 重载路径，逐字 `deepStrictEqual`）、M5c（失败行）、M2c（真跑工具失败出口：消息以 `[code]` 开头、只加一次）、M2d（词缀→code 还原、无词缀旧行不设 `code` 键）；encode/decode 同常量 `MANAGE_SKILL_CODE_TAG`（`ai-manager.js:144` / `:6317-6320` / `:1847-1848`）。实跑 177/177 |
| 12 | 49-07：280px 面板下带托管徽标 + 超预算标注的卡片头部 —— 标注**不被裁切**、祖先不溢出、技能名 `clientWidth > 0`（退化为省略号）、徽标完整、头部仍 36px 单行 | ✓ VERIFIED | **本次独立重跑** `tests/uat-49-g49-3-panel-layout.js`：退出码 **0**、A1–A9 全绿（280 档：`nameWrap` 136/136、`nameText` clientWidth **54**、徽标 30、标注 clientWidth 34 === scrollWidth 34、标注右缘 === 祖先右缘 → 越界 **0.00px**、头部 offsetHeight **36** 且 `scrollHeight<=clientHeight`）；`/tmp/uat49/g49-3-zoom-280-header.png` 4× 放大直读可见「✓ 更新技…｜托管｜**超预算**｜完成」（唯一退化正是技能名省略号） |
| 13 | 49-07：`main.css` **声明零改动**（只改注释）；卡片标注是 `/` 面板单源的机械投影（`超预算`，3 字 ≤ 4 字）而非第二份文案 | ✓ VERIFIED | **不依赖 A9 的独立路线**：`git show fcf42d8 -- src/styles/main.css` = 27 insertions / 1 deletion，**全部落在 `.tool-card-manage-note` 上方注释块内**；本次实算剥注释后的声明投影 sha256：当前树 === `fcf42d8^`（均 `69899a4f…`），`.tool-card-manage-note` / `-error` / `-limit` / `.tool-card-name-text` 四个规则块逐字相等。投影：`skill-picker-model.js:269` 赋值形态 + 运行时求值 `PROMPT_OMITTED_CARD_NOTE === STATUS_TEXT.promptOmitted.split(' · ').pop()` === `"超预算"`（len 3），面板串仍为 `"未进提示词 · 超预算"`（48 D-12 原文冻结） |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `ai-skills-manager.js` | 校验器 / 净化 / 扫描单点 / YAML 标量编码 / 组装全文闸口 / 三动作 / 原子写；零 electron 依赖 | ✓ VERIFIED | `yamlScalar:100-105`；`buildSkillFileText:1204`；`validateSkillFileSize:1231-1245`（对**组装全文**计字节）；`createManagedSkill:1422`（scan→sanitize→**复验**:1443→残名判定:1456→数量闸:1471→字节闸:1485→原子写:1506）；`updateManagedSkill:1539`；`deleteManagedSkill:1603`；`getSkillPromptIncluded:1651`；纯 Node 可 require（55 例实跑通过） |
| `ai-manager.js` | 工具项 + 两时点标记 + 刷新链 + 三动作转发 + 词缀 encode/decode + 三态消费侧 | ✓ VERIFIED | `_buildManageSkillTool:6152-6190`（三键 + enum 三值 + sequential）；共享出口 `await this.syncAgentSystemPrompt():6254`；`MANAGE_SKILL_CODE_TAG:144`；`getSeededSkillNamesSafe:1565` |
| `src/skill-picker-model.js` | `mergeManageSkillMarker` 纯函数 + `PROMPT_OMITTED_CARD_NOTE` 投影 + 白名单表 | ✓ VERIFIED | `:450-454` 合并（独立求值全契约成立）；`:269` 投影（`:469` 导出）；`STATUS_TEXT` 四值与 `MANAGE_SKILL_SHORT_REASON` 九值逐字未变 |
| `src/renderer.js` | 事件映射经共享合并函数并入；标注取单源投影 | ✓ VERIFIED | `:9378-9385` 条件并入；`:9659` `noteText = window.SkillPickerModel.PROMPT_OMITTED_CARD_NOTE;`（真实独立语句）；挂载结构 / 类名 / `textContent` 路径零改动 |
| `src/styles/main.css` | 声明零改动（只改注释） | ✓ VERIFIED | 见 truth #13；本次独立实算声明投影 sha 相等 + 四规则块逐字相等 |
| `tests/uat-49-g49-3-panel-layout.js` | 699 行真实渲染门禁（playwright `_electron` + 真实拖拽 + 红→绿 + E-PW/E-KEY/E-DATA 前置自检） | ✓ VERIFIED | 本次独立重跑退出码 0（12s，走复用路径命中会话 `3dec0492…`，未触发真实 LLM 兜底） |
| `tests/test-manage-skill.js` | 55 例 | ✓ VERIFIED | 实跑 **55/55 pass / 0 fail** |
| `tests/test-ai-skills.js` | 177 例 | ✓ VERIFIED | 实跑 **177/177 pass / 0 fail**（M/L 组行为用例为真跑真实函数） |
| `tests/test-skill-picker-model.js` | 111 例 | ✓ VERIFIED | 实跑 **111/111 pass / 0 fail** |
| `docs/product/ai-skills.md` + `AGENTS.md` | §11.7/§11.8 口径 + 四条不变式 + 例数账本 | ✓ VERIFIED | 例数一致性判据实跑 `counts-parity ok cells=8 measured={"test-manage-skill.js":"55","test-ai-skills.js":"177","test-skill-picker-model.js":"111"}`（与实测逐字一致）。文档口径两处待纠（IN-11/IN-12，见 advisory） |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | --- | --- |
| 工具 `execute` | ai-skills-manager 三动作 | `getAiSkillsManagerLazy()` 转发 | ✓ WIRED | 判定全在 manager（单份实现）；`ai-manager.js` 内无第二份 create/update/delete 实现 |
| 三动作 | 刷新链 | `await this.syncAgentSystemPrompt()` 恰一次 | ✓ WIRED | create/update/delete 共用同一句（`:6254`）；L3 源码门禁断言工具范围内恰 1 处 |
| seeded 集合 | 三动作判定 | `getSeededSkillNamesSafe()` → `seededNames` | ⚠️ PARTIAL | 注入签名正确、零 electron 保持；**生产注入值本身无自动化断言**，降级为空集合时保护完全消失（见 coincidental_reliance_items）。数据源目录本身已核实为 2 个内置技能（探针 J1） |
| start 事件 | renderer 新条目分支 | `event.manage_skill` → `manageSkill` | ✓ WIRED | snake_case 一致；新条目分支写基础标记 |
| end 事件 | renderer 已存在条目分支 | `mergeManageSkillMarker(existing.manageSkill, event.manage_skill)` | ✓ WIRED | 独立求值确认并入语义与实参顺序 |
| 失败消息 | 重载链路原因码 | `[code] ` 词缀 → `MANAGE_SKILL_CODE_TAG` 解析 | ✓ WIRED | encode `:6317-6320` / decode `:1847-1848` 同常量；M2c/M2d 真跑工具失败出口与还原 |
| 实时链路 / 重载链路 | 卡片标记 | 共用 `_buildManageSkillDecoration` | ✓ WIRED | 单一构造函数 ⇒ 已执行行（成功 / 失败）不可能漂移；未执行类见 WR-07 |
| 卡片标注 | `/` 面板单源串 | `PROMPT_OMITTED_CARD_NOTE = STATUS_TEXT.promptOmitted.split(' · ').pop()` | ✓ WIRED | 运行时求值相等；renderer 取该常量而非复写字面量 |
| 280px 面板 → 卡片宽度 | `.tool-card-name` 裁切盒 | CSS 变量 `--ai-panel-min-width` + 真实拖拽 | ✓ WIRED | 拖到 260px 被钳制回 280px（A7）；真实渲染几何见 truth #12 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 卡片标题 / 徽标 / 标注 | `toolExecution.manageSkill` | 主进程两时点事件标记（并入语义已修复） | 真实 | ✓ FLOWING |
| 卡片头部标注文本 | `PROMPT_OMITTED_CARD_NOTE` | `STATUS_TEXT.promptOmitted` 的机械投影 | 真实（3 字，实测渲染 34px === scrollWidth） | ✓ FLOWING |
| 参数摘要 | `toolExecution.params` | 持久化的工具参数 | 真实（仅 `manageSkillOk` 为真时构建） | ✓ FLOWING |
| SKILL.md 正文与 description | `buildSkillFileText({name, description: yamlScalar(...), content})` | 工具入参 | 真实，8 条对抗 description 实测无损往返 | ✓ FLOWING |
| 失败短原因 | `MANAGE_SKILL_SHORT_REASON[code]` | 持久化词缀 → decode | 真实（已执行行）；旧行无词缀时省略键（宁缺勿猜） | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 1. **真实渲染门禁（G-49-3 靶心）** 独立重跑 | `NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js` | 退出码 **0**；A1–A9 全绿；preflight E-PW/E-KEY/E-DATA 全 true；280 档 nameWrap 136/136、nameText 54、note 34/34、越界 0.00px、header 36 | ✓ PASS |
| 2. 渲染截图直读（不依赖任何断言） | 读 `/tmp/uat49/g49-3-zoom-280-header.png`（4×） | 可见「✓ 更新技…｜托管｜**超预算**｜完成」—— 标注完整、技能名退化正是省略号 | ✓ PASS |
| 3. 三套件实测 | `node tests/test-manage-skill.js` · `node tests/test-ai-skills.js` · `node --test tests/test-skill-picker-model.js` | 55/55 · 177/177 · 111/111 | ✓ PASS |
| 4. 全量回归（一次性跑完全部套件） | `for f in tests/test-*.js; do node "$f"; done` | **22/22 套件退出码 0，0 失败** | ✓ PASS |
| 5. 例数账本一致性判据 | `docs/product/ai-skills.md` §11.8 的可重跑命令 | `counts-parity ok cells=8 measured={55,177,111}` | ✓ PASS |
| 6. **独立对抗探针（本 verifier 自建，不复用仓内断言）** | `node /tmp/v49-verify-probe.js` | **31/31 PASS**（seeded 三入口 + 反向例 / 四类撞名 / 11 形态非法 name / 原子写失败清理 / 工作区隔离 / delete / 8 条对抗 description 零幽灵 / 字节闸 65536↔65537 / 内置目录名集合） | ✓ PASS |
| 7. 路径逃逸对抗 | 内联探针：7 种注入式 name + 越界 `env.renameFile` | name 全 `invalid_name`；越界 dest → `permission_denied` | ✓ PASS |
| 8. 合并函数与投影常量语义 | 内联探针（真实导出函数） | 并入保留 `action`/`name`；空载荷返回同一引用；投影值 `"超预算"`(3) 且相等 | ✓ PASS |
| 9. **「声明零改动」的独立路线（绕开 A9 的 /tmp 基准）** | `git show fcf42d8 -- src/styles/main.css` + 自算剥注释声明投影 sha | 差异**全在注释块内**；当前树 sha === `fcf42d8^` sha（`69899a4f…`）；四规则块逐字相等 | ✓ PASS |

**注**：套件全绿在本阶段**不是**目标达成的证据（前一轮正是「41/172/99 全绿却漏掉三条 Critical」）。上表的 #1/#2/#6/#7/#8/#9 全部独立于仓内断言，且 #9 独立于 49-07 新驱动的 A9。

### Probe Execution

无 phase 声明的可执行探针（PLAN/SUMMARY 未声明 `probe-*.sh`，phase 不含 `scripts/*/tests/probe-*.sh`）→ 不适用。49-07 的真实渲染驱动按 `tests/uat-*.js` 命名（永不被 `test-*.js` 套件拾取），已在 Behavioral Spot-Check #1 实跑。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MGMT-01 | 49-01/02/04/05/06/07 | AI 拥有 `manage_skill` 工具，支持 create / update / delete | ✓ SATISFIED | 工具项就位（truth #2）+ 三动作落地（探针 B/C/G）+ 刷新链恰一次（truth #1）+ 卡片变体可达（truth #10/#11）+ 标注单源投影（truth #13） |
| MGMT-02 | 49-01/04 | 不接受 `path`，只接受 `name`/`content`/`description`；路径由 manager 计算 | ✓ SATISFIED | 键集合逐字核对（truth #2）；`managedSkillPaths` 用 `path.join`；7 种注入式 name 全被拒（spot-check #7） |
| MGMT-03 | 49-01/04/06 | 服务端二次校验 name/description/正文字节上限；写入走原子写 | ✓ SATISFIED | 三校验器 + 净化后复验 + `atomicWriteSkillFile`；字节闸与加载期同量（65536/65537 边界 + 对照组实测） |
| MGMT-04 | 49-01 | seeded 不可被覆盖或删除（按播种登记表） | ✓ SATISFIED | 三入口 `seeded_protected` + 反向例 + 内容零改动（truth #4）；生产注入接线见 coincidental_reliance_items |
| MGMT-05 | 49-01/02/05/07 | 成功后刷新技能集与 system prompt | ✓ SATISFIED | L1 行为用例（忙时置脏 → 成功出口回写 + 广播恰一次）；49-07 的卡片面在最小宽度下可读（truth #12） |
| MGMT-06 | 49-01 | 工具描述引导「优先增强已有技能」 | ✓ SATISFIED | 两条文案在 `description` 内（truth #7） |

**孤儿需求检查**：`REQUIREMENTS.md` 映射到 Phase 49 的 ID 为 MGMT-01..06（追踪表 `:137-142` 六行均 `Complete`，需求行 `:42-47` 均 `[x]`）；计划侧声明为 49-01 全部六个、49-02 `[MGMT-01, MGMT-05]`、49-03 `[]`、49-04 `[MGMT-01, MGMT-02, MGMT-03]`、49-05 `[MGMT-01, MGMT-05]`、49-06 `[MGMT-01, MGMT-03]`、49-07 `[MGMT-01, MGMT-05]` —— **六个 ID 全部被至少一个计划声明，无 ORPHANED**。前次报告的「MGMT-04 / MGMT-06 账本陈旧」已修复（现为 `[x]` / `Complete`），故本轮**无需**再补记。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/uat-49-g49-3-panel-layout.js` | `:576-609`（A1–A6） | 全是「不越界」单向判据 —— 标注 `display:none` 时 A1–A9 全绿 | ⚠️ Warning | 守卫强度债（WR-10）。本轮已用源码 + 截图 + 证据 JSON 独立闭合该 must-have |
| `tests/uat-49-g49-3-panel-layout.js` | `:274-287` | A9 的红轮基准从 `/tmp/uat49/evidence-g49-3.json` 续传，基准缺失时退化为自比较 | ⚠️ Warning | 守卫强度债（WR-09）。本轮已用 `git show` + 自算声明投影 sha 的独立路线闭合该 must-have |
| `tests/test-ai-skills.js` / `tests/test-skill-picker-model.js` | M10 与「引用形式」正则 | `stripComments` 只剥整行注释 ⇒ 行尾注释仍可满足判据 | ⚠️ Warning | 守卫强度债（WR-11 / IN-10）。本轮已直读真实赋值行与投影声明闭合该 must-have |
| `tests/test-ai-skills.js` | M3 | 仍是子串扫描，`prev=null` 型 CR-01 回归可通过 282 例 | ⚠️ Warning | 守卫强度债（WR-05），代码本身正确 |
| `ai-manager.js` | `:6317-6320` vs `:1847-1848` | encode 谓词非 decode 谓词的逆 ⇒ 词缀可能产生不可解码噪声 | ⚠️ Warning | 当前可达面全落在九码白名单内（WR-08），不影响目标 |
| `ai-manager.js` | `:6297-6300` | `promptIncluded === undefined` 时不追加任何说明 | ⚠️ Warning | 幽灵写入（若发生）报无保留的成功；本轮与两轮前探针均无法构造出幽灵（WR-06） |
| `ai-manager.js` | `:1800-1813` vs `:1836-1855` | 两链路在「工具从未执行」类上键集合分歧 | ⚠️ Warning | 既有口径、非本轮引入（WR-07） |
| `src/styles/main.css` | `:6192-6199` | 注释段把两种口径写成一个等式（标注 scrollWidth 100 被写成 148；146−136 ≠ 11.84） | ℹ️ Info | 文档/注释诚实度（IN-13），与实现无关 |
| `docs/product/ai-skills.md` | `:528-529` | 「结果区已承载完整语义」（默认折叠态下不成立）+「诚实边界」与已落盘证据相反 | ℹ️ Info | 文案诚实度（IN-11 / IN-12） |
| `.planning/WINDOWS.md` | unrun-verify #30 | 「门禁只覆盖超预算那条形态」低估现有覆盖（A8 已覆盖一条真实失败卡片） | ℹ️ Info | 账本口径滞后于证据 |

**债务标记门禁**：本阶段改动文件内**无**无引用的 `TBD`/`FIXME`/`XXX` 债务标记。三处 `XXX` 命中全部是散文占位符：`ai-skills-manager.js:1263` 的 `tmp-XXXXXX/` 目录名 glob 形态、`ai-manager.js:526/563` 的工具描述示例词（`git blame` 证实 2026-08-03 引入，早于本阶段约 6 周）—— 均不构成门禁触发。

### Human Verification Required

见 frontmatter `human_verification`（3 项）。摘要：

1. **端到端 LLM 往返（SC1 的层 2 证据）** —— 断言点是**下一条消息**而非工具返回时；49-VALIDATION.md 层 2 明文声明不得由层 1 证据替代。已由 `49-UAT.md` 测试 1 记录 pass（automated-e2e，真实 LLM 应答逐字含 `commit-style`），但本次复验**未独立重跑**，且该证据落在 `/tmp`。
2. **UAT 账本终证（G-49-3 翻转）** —— 重跑 `/gsd-verify-work 49` 的三项自动驱动探针。代码 / 真实渲染面已由本次独立复跑闭合（退出码 0 + 4× 放大截图），但 `49-UAT.md` 仍记 `failed`；翻转不属 verifier 的写权，本次**不据此判代码未达成**。
3. **（可选）失败态九码中最宽形态的 280px 真实渲染** —— A8 是**条件性**判据（找不到真实失败卡片即自动通过），本轮只覆盖到九码中的一条（`描述不合法`，5 字）；其余八条与 6 字最宽形态仅由算术保证（WINDOWS.md 的 unrun-verify #30 已登记）。

### Gaps Summary

**无 gap。** 前次报告判 `human_needed` 的**唯一**未决项（backstop：280px 面板下卡片头部单行不换行、徽标与短原因完整可读）已由 **49-07 真实闭合**，且本轮用**两条互相独立的证据**复核：

- **独立重跑门禁**：`tests/uat-49-g49-3-panel-layout.js` 退出码 0，A1–A9 全绿。280px 档实测 `nameWrap` `scrollWidth 136 ≤ clientWidth 136`（修复前 148 > 136）、技能名 `clientWidth 54 > 0`（修复前 0）、标注 `clientWidth 34 === scrollWidth 34` 且其外接矩形右缘 === 裁切祖先右缘（越界 **0.00px**，修复前 11.84px）、头部 `offsetHeight 36` 且 `scrollHeight ≤ clientHeight`（520/280 同值）、徽标 `30 ≤ 30`。
- **不依赖门禁断言的直读**：4× 放大截图逐字可见「✓ 更新技…｜托管｜**超预算**｜完成」，唯一退化正是 UI-SPEC 允许的技能名省略号。

**修复是否「真修」也经独立路线复核**（不依赖 49-07 自带的 A9 与 `css-decl-freeze`）：`git show fcf42d8 -- src/styles/main.css` 显示 27 insertions / 1 deletion **全部落在注释块内**；本次自算剥注释后的声明投影 sha256 与 `fcf42d8^` 逐字相等（`69899a4f…`），四个规则块亦逐字相等 —— 即「修的是**被渲染文本的宽度预算**（标注改取 3 字投影），不是 CSS 缺陷」这一结论成立。

**前一轮判 VERIFIED 的 12 条 truths 全部通过回归**（SC1 机制 / SC2 接口面 / SC2 服务端校验 / SC3 seeded 三入口 + 反向例 / SC4 原子写 + 工作区隔离 / SC5 引导文案 / Gap1 幽灵技能闭合 / 三态 `promptIncluded` / Gap2 标记并入 / Gap3 两链路同形）。**无回归**：全量 `tests/test-*.js` **22/22 套件通过、0 失败**。

**本轮新开但判为「技术债 / 文案诚实度，而非目标未达成」的 11 条**（`49-REVIEW.md` 第 4 轮的 WR-09/10/11 + IN-10..IN-13，加前 3 轮的 7 条 WR-05..WR-08 / IN-07..IN-09）全部记入 frontmatter `advisory`。其中**三条直接关系到 49-07 那两条 must-have 的守卫强度**（WR-09 / WR-10 / WR-11）已由本轮用**不依赖它们各自守卫**的独立路线逐一复核为真（git 声明投影 / 源码声明 + 截图 + 证据 JSON / 直读真实赋值行）—— 故 must-have 判 **VERIFIED**，守卫弱点作为**覆盖缺口**记录，而不是把 must-have 判为未验证。WR-05..WR-08 与 IN-07..IN-09 为前轮既有挂账，本轮无新增复现，不阻断目标。

**无 deferred 项**：Phase 50（设置页技能管理区 + `/api/skills/*`）与 Phase 51（zip + 网络地址导入管线）的 Goal 与 5 条 Success Criteria 均不覆盖上述任一条 advisory（两者是**另外的表面**：Phase 50 SC3 的「拒卸载内置技能」属设置页卸载路径，与 `manage_skill` 的守卫强度不是同一物），故不适用 Step 9b 的延后匹配。

**状态为 `human_needed` 的成因**：13 条 truths 全部 VERIFIED、`behavior_unverified = 0`，但 ROADMAP SC1 的**层 2 证据**（真实 LLM 往返裁决「下一条消息即对模型可见」）按 49-VALIDATION.md 的明文声明不可由层 1 证据替代 —— 它已由 `49-UAT.md` 测试 1 记录 pass，但本次未独立重跑，且 UAT 轮需在 49-07 之后重跑方能翻转 `G-49-3`。按 decision tree 规则 2 判 `human_needed`，**不判 `passed`**。

**下一步动作**：执行 `/gsd-verify-work 49` 重跑三项自动驱动探针（重点第 3 项 280px 布局）以翻转 `G-49-3`；如需彻底闭合 SC1 的层 2 证据，按 49-VALIDATION.md 五步表再跑一次真实 LLM 往返。

**本报告的 `covered_files` 刻意不含 `49-UAT.md` / `49-VALIDATION.md` / `49-UI-SPEC.md` / `.planning/ROADMAP.md` / `.planning/STATE.md`** —— 这些是会被收尾流程（verify-work / ui-review / phase complete）改写的**过程状态文件**，纳入指纹会让报告在收尾动作中被自身反复判 stale（本项目已有先例）。

**安全纪律**：本次复验全程**未**对 `/Applications/Realm.app`（PID 22083，用户正式版实例，验证期间始终在运行）做任何操作；真实渲染驱动以 `NODE_ENV=development` 拉起独立 `realm-dev` userData，未触碰正式版数据。`/tmp/uat49/evidence-g49-3.json` 被本次重跑覆盖（内容等价：同一红轮基准续传 + 同几何量），原始副本已备份至 `/tmp/uat49/_verify_bak_evidence-g49-3.json`。

---

_Verified: 2026-09-13T14:52:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 49-manage-skill-ai
verified: 2026-09-14T01:48:27Z
status: passed
score: 24/24 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/49-manage-skill-ai/49-01-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-01-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-02-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-02-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-03-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-03-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-04-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-04-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-05-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-05-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-06-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-06-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-07-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-07-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-08-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-08-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-REVIEW.md
  - AGENTS.md
  - ai-manager.js
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - src/renderer.js
  - src/skill-picker-model.js
  - src/styles/main.css
  - tests/test-ai-skills.js
  - tests/test-builtin-skills-seeder.js
  - tests/test-manage-skill.js
  - tests/test-skill-picker-model.js
  - tests/uat-49-g49-3-panel-layout.js
  - tests/uat-49-g49-4-card-a11y-tab-order.js
covered_digest: "v1:sha256:f00b67cd218b2b7a1289ce09d7748e9cbad29152dd10abfde49f775aefd7b160"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "24/24"
  gaps_closed: [] # 本轮无 gap 可闭：上一轮的唯一 BLOCKER `UI-49-W6-01` 已由 49-08 闭合，其复核记录保留在真值 #14–#24 与 Gaps Summary
  gaps_remaining: []
  regressions: []
  advisories_closed: ["IN-15", "IN-17"] # 由 f1057e0 闭合（依据见「本轮差分复核」段）；`WR-12` / `IN-14` / `IN-16` 等仍开放
advisory:
  - finding: "WR-12（轮 5 新增）：49-08 新驱动 `tests/uat-49-g49-4-card-a11y-tab-order.js` 的承重判据 `R3` 在绿轮是**空集真**（`inCardCount = 0` ⇒ 「凡卡片内停靠点都可见」为空集真），整套 R 组只有**否命题**；把 `.tool-card-content .ai-skill-content-box` 设为 `display: none` 时 A/P/R 全绿。原始证据（红→绿两轮）只活在 `/tmp/uat49/evidence-g49-4.json`"
    category: architectural
    reason: "本轮已用**不依赖该驱动断言**的独立路线（自建 `_electron` 探针 + 页面内阳性对照）把「绿 = 真结论」而非「绿 = 空集真」实测出来：修复态 `header.focus()` 为 no-op（焦点留在 BODY）；在页面内把 `tabindex=\"0\"` 加回同一 header 后 `focus()` **成功**、其外接矩形高 **29px** 而中心点 `elementFromPoint` 命中**别的消息的 `<CODE>`**（`hitIsSelf=false`）⇒ 该形态正是「不可见停靠点」，R3 对它必然转红。即**判据可失败性**与**修复的载荷点**均独立成立，故 must-have 判 VERIFIED；驱动自身的空集真弱点作为**覆盖缺口**记录。修法：补一条正命题（折叠块在布局内且展开后可读 / 停靠点集非空或显式记录 `vacuous: true`）"
    evidence_status: "mechanically reproduced by round-5 reviewer; neutralized this round by an independent real-render probe with in-page positive control (/tmp/uat49/verify-a11y-probe2.log，12/12 PASS)"
    status: open
    carried_forward: "`f1057e0` **未触及驱动**（改动统计：3 文件 / +5 −3，`tests/uat-49-g49-4-card-a11y-tab-order.js` 不在其中）⇒ 判据体逐字未变，本条**仍开放**。上一轮的独立阳性对照证据（`/tmp/v49-a11y-probe2.js` 与 `/tmp/uat49/verify-a11y-probe2.log`）本轮复核**仍在盘**（mtime 2026-09-14 01:20）"
  - finding: "IN-14（轮 5 新增）：`tests/test-ai-skills.js` 的 `M9b` 是**纯源码形态扫描**，八条断言没有一条构造被测函数；三种**形态等价**的回归实测全绿（函数内加一行 `interactive = true;` / 三条属性移到一处紧凑 `if (interactive) {}` 之后 / 卡片调用点之后别处补 `setAttribute('tabindex','0')`）。而 `package.json` 无 `test` 脚本、`uat-` 驱动不被 `node --test` 拾取 ⇒ 它是本仓**唯一能自动跑**的护栏"
    category: architectural
    reason: "当前树不存在第二种施加入口（全仓 `setAttribute('tabindex')` 仅 1 处且在守卫内），故**今日无实害**；且本轮的行为面已由真实渲染探针独立闭合（见上）。属**守卫强度债**，不是目标能力缺失。修法见 `49-REVIEW.md` IN-14：把「施加受 `interactive` 守卫」从形态判据改为行为判据（把属性清单抽成零 DOM 依赖的纯函数）"
    evidence_status: "mechanically reproduced by round-5 reviewer (six-mutation matrix, in-memory)"
    status: open
    carried_forward: "`f1057e0` 未触及 `tests/test-ai-skills.js`（不在其 3 个改动文件内）⇒ `M9b` 八条断言逐字未变，本条**仍开放**。本轮重跑该套件 **178/178 pass / 0 fail**（形态判据在修复树上仍为绿，与「形态扫描不承重」的结论不冲突）"
  - finding: "IN-15（轮 5 新增）：`src/renderer.js:8946` 与 `src/styles/main.css:5860` 仍引用 `49-UI-SPEC.md:508`，但 49-08 自己在同一文件里插入了 17 行，被引用的契约行已从 508 漂到 **525** ⇒ 两处引用现在指向**空行**。`49-08-SUMMARY.md` 的「`:508` 逐字未改」指的是**行内容**未改（属实），但行号已变"
    category: other
    reason: "引用锚点失效，不是实现缺陷（契约语义未变）。修法：改成不带行号的引用，或改指 `:525`，或给契约行加稳定锚点"
    evidence_status: "mechanically reproduced by round-5 reviewer"
    status: closed
    closed_by: "`f1057e0` —— 两处**均**改为按名引用（`src/renderer.js:8946` → `契约 `49-UI-SPEC.md` 的「展开 / 折叠（卡片）」行`；`src/styles/main.css:5861` → 同款）。本轮独立核实：① 该名称在 `49-UI-SPEC.md:525` 确实是一行契约行标签（名称解析有效，不再依赖行号）；② `src/` · `docs/` · `tests/` 三个目录内 `:508` 与 `契约 :NNN` 形态**零命中**（该 finding 的载荷面即这两个文件）。**残留**（均不在 finding 载荷面内，故不阻断闭合）：`.planning/STATE.md:254` 与 `49-UI-SPEC.md:567` 的 E3 元素清单行各一处旧口径 —— 前者是编排器维护的过程状态文件，后者是轮 5 复核已明文「只作交叉提示、不计 finding」的项；两者的行号引用属历史记录（plans / SUMMARY / REVIEW / UI-REVIEW）者**应保留**"
  - finding: "IN-16（轮 5 新增）：`tests/uat-49-g49-4-card-a11y-tab-order.js` 的 `E-DATA-DB` 要求本机 `realm-dev/ai-conversations.db` 里存在「既有带 `content` 的 `manage_skill` 调用、又有成功结果」的会话，否则以退出码 12 硬退出（方向安全）；`G49_4_ROUND=red|green` 只是环境变量标签，红轮需要手工回退源码 ⇒ 新机器 / CI 上无法复建，而这正是本轮 BLOCKER 唯一的行为证据"
    category: architectural
    reason: "本轮复验**已验证该前置在本机成立**（候选会话 2 个：`6987b3d3…` / `3dec0492…`，气泡候选 8 个），驱动退出码 0；但可移植性缺口成立。与 `WR-09`（A9 的红轮基准活在 `/tmp`）**同一族**：凡验收依赖 `/tmp` 或依赖本机用户数据的判据都应收敛为「自带夹具 + 仓内基准」"
    evidence_status: "mechanically reproduced this round (read driver preflight + indie probe preconditions)"
  - finding: "IN-17（轮 5 新增）：`docs/product/ai-skills.md:531`（§11.7 新增条目）只写了「为什么卡片实例不施加」，没写**代价** —— 改动后卡片语境的正文折叠块既无 `tabindex` 也无 `keydown`，而其祖先 `.tool-card-content` 与卡片头部同样不可聚焦（全仓工具卡片范式）⇒ **键盘用户完全无法展开这张卡片去读 AI 刚写下的技能正文**，鼠标是唯一入口"
    category: other
    reason: "该范式在 49 之前即存在（**非回归**）且被 `49-UI-SPEC.md` 的契约锁定为「本阶段零改动」，但产品说明作为权威条目应把代价与原因并列写出（本阶段另有两处同类做法：`allowed-tools` 不被强制、bash 白名单是启发式，均写明边界）"
    evidence_status: "mechanically reproduced by round-5 reviewer (read docs + source)"
    status: closed
    closed_by: "`f1057e0` —— `docs/product/ai-skills.md:531`（§11.7 条目）补齐**代价**句：「卡片语境的正文折叠块因此**没有任何键盘入口** —— 其祖先 `.tool-card-content` 与卡片头部（`.tool-card-header`）同样不可聚焦（全仓所有工具卡片同一范式），故键盘用户**无法展开这张卡片去读 AI 刚写下的技能正文**，鼠标是唯一入口」，并写明该不可达**不是 49 引入的回归**、正确处置是单独立项。本轮已独立把该句与代码逐条核对（见「本轮差分复核」§4）：全仓 `setAttribute('tabindex')` 仅 `src/renderer.js:8962` 一处且在 `if (interactive)` 守卫内；工具卡片区域（`renderToolCard` 整体 `:9616-9890`）内 `tabindex` / `role` / `contenteditable` / `keydown` **零命中**，`.tool-card` 与 `.tool-card-header` 均为裸 `<div>` + 仅 `click`（`:9835`）⇒ 键盘确无展开入口。唯一口径细节（**不构成 finding**）：`max-height: 0; overflow: hidden` 只做视觉裁切，**不移出无障碍树** ⇒ 屏幕阅读器用户的虚拟光标仍可线性读到正文；文档说的是「键盘无法**展开**这张卡片」，与实现一致，故句子成立"
  - finding: "WR-09：49-07 新驱动的 A9（「CSS 声明零改动」的全轮声明投影 sha 相等）的红轮基准只活在 `/tmp/uat49/evidence-g49-3.json`，基准缺失时退化为自比较（恒真）；它引用的第二个判据 `css-decl-freeze` 只存在于 `49-07-PLAN.md` 的 `<verify>` 块，不在仓内"
    category: architectural
    reason: "本轮再次用**不依赖该守卫**的独立路线复核该 must-have：`git show` 确认 `src/styles/main.css` 自轮 4 基准（`a52f09d`）以来的差异**全部落在注释块内**，且自算剥注释后的声明投影 sha256 在 `a52f09d` / `HEAD` / 工作树三处**逐字相等**（本次归一化 `e55acbbe…`；仓内驱动的归一化 `69899a4f…`，两者内部各自一致）。故 must-have 判 VERIFIED，守卫弱点作为覆盖缺口记录"
    evidence_status: "mechanically reproduced by reviewer; neutralized this round by independent git-based route"
  - finding: "WR-10：49-07 真实渲染门禁 A1–A6 全是「不越界」单向判据 —— 给 `.tool-card-manage-note` 加 `display: none` 时 A1–A9 全绿"
    category: architectural
    reason: "本轮已用不依赖该守卫的路线复核：直读 `src/styles/main.css` 的声明集（无 `display` 覆盖）、G-49-3 驱动重跑实测 `note=34` 且 `text=\"超预算\"`（非零渲染宽）。修法：补一条「标注 `clientWidth > 0`」的正向判据"
    evidence_status: "mechanically reproduced by reviewer; neutralized this round by source read + driver rerun geometry"
  - finding: "WR-11 / IN-10：源码面护栏的 `stripComments` 只剥整行注释 ⇒ `noteText = '超预算'; // noteText = window.SkillPickerModel.PROMPT_OMITTED_CARD_NOTE` 这类行尾注释形态可让判据转绿"
    category: architectural
    reason: "**机制面已由 49-08 顺手闭合**（`stripComments` 扩到剥行尾注释，轮 5 复核用变异实测「旧版判绿、新版判红」）；残项：`tests/test-skill-picker-model.js` 本轮未改，其判据仍跑在未剥注释的源码上（`IN-10` 未闭合）。另有一处**新引入的同源风险**：该正则不区分注释与字符串里的 `//`，未来出现 `'…//…'` 字面量会静默删掉行尾代码（对负向断言是假绿方向；当前 `src/renderer.js` 此类行 0 行）"
    evidence_status: "mechanically reproduced by round-5 reviewer (old regex red/green mutation matrix)"
  - finding: "WR-05：`tests/test-ai-skills.js` 的 M3 仍是子串扫描，一个完整的 CR-01 回归（把 `prev` 传 `null`）通过全部例（前轮已由 verifier 机械复现）"
    category: architectural
    reason: "代码本身正确（本轮已直读 `src/renderer.js` 的并入分支并独立求值真实合并函数：`merge(base,{tier,promptIncluded})` → `{action,name,tier,promptIncluded}`，`merge(t,null)` 返回同一引用）。守卫强度债，不影响目标能力"
    evidence_status: "mechanically reproduced by previous verifier round"
  - finding: "WR-06：幽灵写入仍报无保留的成功 —— `promptIncluded === undefined` 分支不追加任何说明"
    category: architectural
    reason: "本轮与两轮前探针（合计 38 条对抗 description）均无法构造出幽灵生产者 ⇒ 残余风险而非可复现回归。信号就在代码里（`ai-manager.js` 的三态消费侧）"
    evidence_status: "none provided (reviewer and both verifier rounds failed to produce a ghost)"
  - finding: "WR-07：实时 / 重载两链路的 `manageSkill` 键集合在「工具从未执行」类调用上分歧（live 无 `tier`、reload 有 `tier`）"
    category: architectural
    reason: "既有的、49-05 must_haves 之外更宽的一类；不影响目标能力与 seeded 保护。不影响 49-08 面"
    evidence_status: "mechanically reproduced by previous verifier round"
  - finding: "WR-08：`[code]` 词缀的编码谓词比解码谓词宽 —— 「只含白名单原因码」在三处文档里被声明为强制，实际一处都未强制"
    category: security
    reason: "当前可达面窄：块内 throw 要么走 `makeManageSkillError` 的九码、要么是 Node 大写码。不影响目标能力"
    evidence_status: "mechanically reproduced by previous verifier round"
  - finding: "IN-11：`docs/product/ai-skills.md` 的「诚实边界」写「真实渲染门禁**未用真实渲染**逐条覆盖它 —— 它只覆盖超预算那条」，与已落盘证据相反（同一次真实渲染里 A8 抓到了真实失败卡片并做了判定）"
    category: other
    reason: "文档口径与证据不符，且掩盖了「A8 是条件性判据 ⇒ 覆盖率随数据集浮动」这一真正的边界。不影响目标能力"
    evidence_status: "mechanically reproduced this round (A8 重跑实测 errorNoteCovered=true)"
  - finding: "IN-12：「卡片的**结果区**已承载完整语义」在默认折叠态下不成立（`.tool-card-content` 用 `max-height: 0` 折叠，需点击展开）"
    category: other
    reason: "两处文档用该理由为短形态背书，读起来像「无需额外操作即可获得」，与实现不符。属文案诚实度问题；E1 的「≤ 4 字」处置本身已按 UI-SPEC 照做（3 字），几何不变式成立"
    evidence_status: "mechanically reproduced this round (driver 实测 note clientWidth 34 === scrollWidth 34)"
  - finding: "IN-13：`src/styles/main.css` 实测口径注释段自相矛盾 —— 「两轮的**标注** scrollWidth 同为 148」实为**祖先**的 scrollWidth；「8 + 30 + 8 + 100 = 146 > 136，越界 11.84px」中 11.84 是 A1 的外接矩形口径，146 − 136 = 10"
    category: other
    reason: "该注释段的全部价值是「来源可查、实测与估算分离」，此处把两种口径写成一个等式。数值本身都能在红轮日志查到"
    evidence_status: "mechanically reproduced this round (与 G-49-3 驱动重跑输出逐项核对)"
  - finding: "`.planning/WINDOWS.md` 的 unrun-verify 条目 #30 低估了现有覆盖 —— 它写「G-49-3 的渲染门禁只覆盖超预算那条形态」，但 A8 在 280px 档确实抓到了一张真实失败卡片并做了判定（本轮重跑 `errorNoteCovered: true`）"
    category: other
    reason: "账本口径滞后于证据（未覆盖面实际只剩「九码中其余八条 + 每条 6 字最宽形态」）。不阻断目标"
    evidence_status: "mechanically reproduced this round (read evidence-g49-3.json#errorNoteCovered)"
coincidental_reliance_items:
  - truth: "SC3：seeded 三入口拒绝按播种登记表判定（非目录位置）"
    reason: fixture-only
    harden: "仓内 55 例与历轮独立探针都在纯 Node 下**显式注入** seededNames 常量数组；真实运行时该值来自 `ai-manager.js` 的 `getSeededSkillNamesSafe()` → `builtin-skills-seeder.getSeededSkillNames()`（扫 `skills-builtin/` 目录名，当前 2 个：`find-skills` / `skill-creator`）。该函数在纯 Node 下会 console.warn 并降级为 `[]` —— 此时 seeded 保护完全消失，而**生产注入值本身仍无自动化断言**。建议补一条接线断言：electron 环境下 `getSeededSkillNamesSafe()` 返回非空且 === `skills-builtin/` 的目录名集合"
# human_verification：本报告 `status: passed`，按 decision tree（规则 3）该块必须为空 —— 上一轮登记的 2 项人工项
# 的处置与依据见正文「本轮状态裁决：为何由 human_needed 改为 passed」段（原 #1 由 `49-UAT.md` 测试 1 的既定 pass
# 覆盖、且本轮已独立读取其**原始证据文件**核证；原 #2 的「需人裁定 IN-15 / IN-17」这一理由已由 `f1057e0` 消除）。
---
# Phase 49: `manage_skill` 工具（AI 自建技能）Verification Report

**Phase Goal:** AI 可自主创建、更新、删除自己的技能，且无法覆盖或删除随包内置技能。
**Verified:** 2026-09-14T01:48:27Z
**Status:** passed
**Re-verification:** Yes — `f1057e0`（IN-15 / IN-17 收口）之后的差分复验（前次报告 2026-09-13T17:24:01Z 判 `human_needed`；本次复验的改动面为**注释 / 散文专属**，另有 2 项人工项的处置裁决）

## Goal Achievement

### Observable Truths

**A 组 · 前次判 VERIFIED 的 13 条（本轮回归复核）**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1（机制）：三动作落盘后技能集与 system prompt 在本轮**成功出口**回写，新技能下一条消息可见 | ✓ VERIFIED | 源码 `ai-manager.js` 忙时置脏 → 共享成功出口恰一次 `await this.syncAgentSystemPrompt()`；**行为用例 L1** 真跑 `tool.execute` + `prompt` 真实出口。本轮回归：`node tests/test-ai-skills.js` **178/178 pass / 0 fail**（含本条）。层 2 见「本轮状态裁决」项 #1 与 spot-check **#14**（已核证原始证据） |
| 2 | SC2（接口面）：`parameters.properties` 键集合**恰为** `{action,name,content,description}`，无 `path`；`enum` 恰为三值；`executionMode: 'sequential'` | ✓ VERIFIED | 本轮回归：`ai-manager.js` 自轮 4 基准以来的 diff 为**空**（该文件不在本轮 49-08 的 6 个在册文件内）⇒ 接口面逐字未变 |
| 3 | SC2（服务端二次校验）：非法 name / 空 description / 空 content / 超长 description 一律被拒并给出可读原因，且**不落盘** | ✓ VERIFIED | 本轮实跑 `node tests/test-manage-skill.js` **55/55 pass / 0 fail**；`ai-skills-manager.js` 本轮未改 |
| 4 | SC3：seeded 覆盖 / 删除按**播种登记表**判定（非目录位置），三入口一致拒绝且内容零改动 | ✓ VERIFIED | 同上 55/55（含 seeded 三入口 + 反向例）。生产注入接线见 `coincidental_reliance_items` |
| 5 | SC4：原子写经沙箱 `env.renameFile` 获得 dest 双基准路径校验；失败不留半成品 | ✓ VERIFIED | 同上 55/55（原子写与失败清理用例组）；`tests/test-agent-workspace.js` 亦在全量 22/22 套件内通过 |
| 6 | SC4：不触及 `ai-memory/`、`attachments/` 等其他工作区路径 | ✓ VERIFIED | 同上 55/55（工作区隔离用例组） |
| 7 | SC5：工具描述含两条引导文案且不进 `REALM_SYSTEM_PROMPT` | ✓ VERIFIED | `ai-manager.js` 本轮 diff 为空 ⇒ 描述字符串逐字未变 |
| 8 | Gap1（幽灵技能）：写侧允许落盘的任何 description 都能被加载管线收进技能集且逐字无损；字节闸按**组装全文** | ✓ VERIFIED | 同上 55/55（description 值域与写↔读闸口边界 + 组装全文字节闸用例组） |
| 9 | `getSkillPromptIncluded` 三态（`true` / `false` / 未命中 `undefined`）且消费侧按三态收口 | ✓ VERIFIED | 同上 178/178（M 组三态消费侧用例） |
| 10 | Gap2：终态 `manageSkill` **并入**而非覆盖 —— 保留 start 的 `action`/`name`，叠加终态三键；迟到的不带标记载荷不抹标记 | ✓ VERIFIED | **本轮独立求值真实导出函数**：`mergeManageSkillMarker({action:'update',name:'x'},{tier:'managed',promptIncluded:false})` → `{"action":"update","name":"x","tier":"managed","promptIncluded":false}`（`action`/`name` 保留）；`merge(b,null) === b`（**同一引用**，不抹标记） |
| 11 | Gap3：重开对话后重建的 `manageSkill` 与实时链路**键集合与取值逐字相等**（成功行 / 失败行），失败短原因由持久化词缀还原 | ✓ VERIFIED | 同上 178/178（M5b / M5c / M2c / M2d）；encode/decode 同常量；`ai-manager.js` 本轮 diff 为空 |
| 12 | 49-07：280px 面板下带托管徽标 + 超预算标注的卡片头部 —— 标注**不被裁切**、祖先不溢出、技能名 `clientWidth > 0`、徽标完整、头部仍 36px 单行 | ✓ VERIFIED | **本轮独立重跑** `NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js` → **退出码 0**、A1–A9 全绿：280 档 `nameWrap` **136/136**、`nameText` **54**、徽标 **30/30**、标注 **34/34**（`text="超预算"`）、越界 **0.00px**、头部 **36** 且 `scrollHeight ≤ clientHeight`；260 档被钳回 280 |
| 13 | 49-07：`main.css` **声明零改动**（只改注释）；卡片标注是 `/` 面板单源的机械投影（`超预算`，3 字 ≤ 4 字） | ✓ VERIFIED | **不依赖 A9 的独立路线**（本轮自算）：剥注释后的声明投影 sha256 在 `a52f09d`（轮 4 基准）/ `HEAD` / 工作树三处**逐字相等**（本次归一化 `e55acbbe…`，仓内驱动归一化 `69899a4f…`，各自内部一致）；`git diff` 本轮对 `main.css` 的全部改动**落在注释块内**。投影：运行时求值 `PROMPT_OMITTED_CARD_NOTE === STATUS_TEXT.promptOmitted.split(' · ').pop()` === `"超预算"`(len 3)，面板串仍为 `"未进提示词 · 超预算"`；`MANAGE_SKILL_SHORT_REASON` 仍 9 码、每值 ≤ 6 字（实测 max 6） |

**B 组 · 本轮新增的 49-08（`UI-49-W6-01` 收口）11 条**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 14 | **真性 · 主轴（真实渲染 + 真实键盘）**：折叠态 `manage_skill` 卡片内**不存在**不可见键盘停靠点 | ✓ VERIFIED | **两条互不依赖的证据**：① 仓内驱动本轮独立重跑 `node tests/uat-49-g49-4-card-a11y-tab-order.js` → **退出码 0**、`R3 PASS`（卡片域内 **0 站** / 违反 **0 站**）；② **verifier 自建独立探针**（`/tmp/v49-a11y-probe2.js`，与仓内驱动各自实现）→ 修复态 `header.focus()` 为 **no-op**（焦点留在 `BODY`），且折叠块 `display: block`、正文 **444** 字符仍在布局内 |
| 15 | **非空真 · 遍历有效性**：停靠点总数 ≥ 20 且至少命中过一个非 `body` 元素 | ✓ VERIFIED | 驱动本轮重跑 `R1 PASS`：停靠点总数 **80**（上限）· 非 body/html 站数 **80** |
| 16 | **前提成立**：被判定的卡片确实折叠，其 `.tool-card-content` computed `max-height` 解析为 `0px` | ✓ VERIFIED | 驱动 `P1/P2 PASS`（`cardExpanded=false`、`maxHeight="0px"`、外接矩形高 0）；独立探针 `P1/P2 PASS`（`maxHeight=0px overflow=hidden rectH=0`） |
| 17 | **对照 · 防过度修复（气泡面）**：气泡实例仍带 `role` + `tabindex` + `aria-expanded`，且真实 Enter 能切换 `.collapsed` 并同步 `aria-expanded` | ✓ VERIFIED | 驱动 `R4 PASS`：气泡会话 `49659819…` 实例 `before={role:'button',tabindex:'0',ariaExpanded:'false',boxCollapsed:true}` → 真实 Enter 后 `ariaExpanded:'true'`、`boxCollapsed:false` |
| 18 | **语境一致性**：卡片实例的折叠块 header 在**任何**卡片状态下都不带 `tabindex` / `role` / `aria-expanded` | ✓ VERIFIED | 驱动 `R5 PASS`：折叠态与**真实点击展开后**（`cardExpanded=true maxHeight="500px"`）两态属性**均为 `null`**；独立探针 `C4 PASS` |
| 19 | **单源未破**：`renderSkillContentBox` 仍**恰 1 处定义**、**恰 2 处调用**（气泡 / 卡片） | ✓ VERIFIED | 本轮 grep 全仓：`:8952` 定义（1 处）、`:9093` 气泡调用（不传选项）、`:9765` 卡片调用（传 `{interactive:false}`）⇒ 恰 2 处；`M9b` ①⑦ 同判。全仓 `setAttribute('tabindex')` 仅 1 处（`:8961`，在守卫内）、`setAttribute('role')` 2 处（`:695` 的 tab + `:8960` 在守卫内） |
| 20 | **非空真 · 源码面红→绿**：源码形态判据在**未修复树**上为红，修复后为绿；判据对象是**剥注释后的代码** | ✓ VERIFIED | `M9b` 就位（`tests/test-ai-skills.js:4168`，本轮 178/178 通过），其 ⑤（卡片调用点必须传 `false`）与 ③（三条属性受守卫）正是未修复树必然转红的承重点（轮 5 复核的变异矩阵确认 M3/M4 → **RED**）；驱动证据 JSON 的**红轮**（`runs[0]`：`round=red`、`exit=1`、`R3=false`、`R5=false`、属性 `tabindex='0'` —— 只有未修复树才可能产生）即该态实测记录 |
| 21 | **契约与文档口径一致**：`49-UI-SPEC.md` 两处补上「气泡实例；卡片实例不施加」的限定与理由；`docs/product/ai-skills.md` §11.7 同款口径 | ✓ VERIFIED | `git diff` 逐行核对：`49-UI-SPEC.md` 的「键盘可达性」段新增 17 行（含「零可见高度」「顺序焦点导航」「语境开关」「卡片实例」四锚点 + `display: none` 排除理由）；「展开 / 折叠（正文块）」行补上气泡/卡片限定；**契约锁定行「展开 / 折叠（卡片）… 本阶段零改动」逐字未动**（diff 的上下文行，无 ±）；`docs/product/ai-skills.md` §11.7 新增同款条目。文字**准确性**见「本轮状态裁决」项 #2 —— 该处原列的两点（IN-15 / IN-17）已由 `f1057e0` 修补并经 spot-check #12 / #13 核对 |
| 22 | **账本一致**：`AGENTS.md` 测试行三条 + `docs/product/ai-skills.md` §七两条 + §11.8 三条共八个例数单元与三套件**实测** `# tests` 逐字一致 | ✓ VERIFIED | 实跑 §11.8 的可重跑一致性命令：`counts-parity ok` · `cells=8` · `measured={"test-manage-skill.js":"55","test-ai-skills.js":"178","test-skill-picker-model.js":"111"}`；与本次三个套件现场实测逐字一致（55/178/111） |
| 23 | **无回归**：三套件 `# fail 0`，且 `tests/test-*.js` 全量**全部退出码 0** | ✓ VERIFIED | 本轮一次性实跑：`suites_pass=22 suites_fail=0`；三套件 55/178/111 全 pass |
| 24 | **安全边界**：驱动只操作自己拉起的 `realm-dev` 子进程；正式版 `/Applications/Realm.app` 全程未被操作；全程无任何 `pkill` / `pgrep` 模式匹配杀进程 | ✓ VERIFIED | grep 驱动：`pkill`/`pgrep` **仅出现在 docstring 的禁令文字里**，唯一 `proc.kill('SIGKILL')`（`:891`）作用于**自身拉起的子进程**；本轮所有 electron 子进程均由 `_electron.launch` 自建（`NODE_ENV=development`，userData `realm-dev`）；用户正式版 PID **22083** 在验证全程始终存活、未被触碰 |

**Score:** 24/24 truths verified (0 present, behavior-unverified)

### Deferred Items

无。Phase 50（设置页技能管理区 + `/api/skills/*`）与 Phase 51（zip + 网络地址导入管线）的 Goal 与 Success Criteria 均不覆盖上述任一 advisory（两者是**另外的表面**：Phase 50 的「拒卸载内置技能」属设置页卸载路径，与 `manage_skill` 的守卫强度不是同一物）。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/renderer.js` | `renderSkillContentBox(skillInvocation, { interactive = true } = {})`；三条属性与 `keydown` 落在 `if (interactive)` 守卫内；卡片调用点传 `false`；气泡调用点逐字不动 | ✓ VERIFIED | 本轮逐行读取 `:8952-9002`：守卫在 `:8959-8963`、`:8969-8971`、`:8986-8993`；`:9765` 传 `{ interactive: false }`；`:9093` 为 `renderSkillContentBox(msg.skillInvocation)`（未动）。`node --check` 通过 |
| `src/styles/main.css` | 只改 `.ai-skill-content-box-header:focus-visible` 上方注释（说明焦点环服务对象是气泡实例），**零声明改动** | ✓ VERIFIED | 本轮 diff 确认改动全在注释块内；声明投影 sha 三处相等（见 truth #13） |
| `tests/uat-49-g49-4-card-a11y-tab-order.js` | 新增真实渲染 + 真实键盘门禁（Tab 遍历 / 命中测试 / 气泡对照 / Enter 切换 / 单点变异自证） | ✓ VERIFIED | 945 行、`node --check` 通过、本轮独立重跑 **退出码 0 / ALL ASSERTIONS PASS**；命名以 `uat-` 开头故不被 `test-*.js` 套件拾取（轮 5 已用同构合成目录在 Node v22.22.0 实测确认） |
| `tests/test-ai-skills.js` | `M9b`：a11y 增量条件施加的源码面护栏（剥注释含行尾注释） | ✓ VERIFIED | `:4168-4237` 八条断言在场；`stripComments` 已扩到剥**行尾注释**（轮 5 变异实测旧绿新红）；本轮 178/178 pass。**强度债见 IN-14** |
| `docs/product/ai-skills.md` + `AGENTS.md` | §11.7 口径补限 + 八个账本单元按实测刷新 | ✓ VERIFIED | `counts-parity cells=8` 通过；§11.7 新增条目在场（本轮逐字读取） |
| `.planning/phases/49-manage-skill-ai/49-UI-SPEC.md` | `:427` / `:509`（原文行号）两处补限，**不改**契约锁定行 | ✓ VERIFIED | diff 逐行核对；锁定行「本阶段零改动」为上下文行（未改）。**引用锚点漂移见 IN-15** |
| `.planning/phases/49-manage-skill-ai/49-UI-REVIEW.md` | `UI-49-W6-01` 标注为 closed-by 本计划，**只加不删** | ✓ VERIFIED | diff 仅 2 个 hunk、**+4 行全为新增**（`:24` 评分修订行 + `:152` `**Closed by: 49-08-PLAN.md**`）；原文一字未删 |
| `ai-skills-manager.js` / `ai-manager.js` / `src/skill-picker-model.js` | 本阶段既有实现（MGMT-01..06） | ✓ VERIFIED | 三者**均不在 49-08 的 6 个在册文件内** ⇒ 本轮 diff 为空（`src/skill-picker-model.js` 最后一次变更是 49-07 的 `318012c`） |
| `tests/test-manage-skill.js` / `tests/test-skill-picker-model.js` | 55 例 / 111 例 | ✓ VERIFIED | 本轮实跑 **55/55** / **111/111** |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | --- | --- |
| `renderSkillContentBox` 的 `interactive` 选项 | 两个调用点 | 气泡**不传**（缺省 `true` ⇒ 增量保留）/ 卡片传 `false`（⇒ 无焦点语义） | ✓ WIRED | 调用点各 1 处、选项取值与契约一致（truth #19 / #21）；真实渲染两态复核见 truth #17 / #18 |
| `.tool-card-content` 的 `max-height: 0` | 后代仍在顺序焦点导航内 | 浏览器语义（只有 `display: none` 会移出） | ✓ WIRED | **独立实测**：页面内把 `tabindex="0"` 加回卡片内 header 后 `focus()` 成功（`afterIsHeader=true`）、其矩形高 **29px** 但中心点 `elementFromPoint` 命中**别的消息的 `<CODE>`**（`hitIsSelf=false`）⇒ 该形态确是「不可见停靠点」 |
| 折叠块 header 的可见性 | 宿主语境 | 气泡恒可见（焦点语义成立）/ 卡片默认裁切（失效） | ✓ WIRED | 折叠块 `display: block`、正文 444 字符在布局内（独立探针 C1–C3）；卡片容器 `maxHeight=0px overflow=hidden rectH=0` |
| 工具 `execute` | ai-skills-manager 三动作 | manager 转发（单份实现） | ✓ WIRED | 本轮 `ai-manager.js` diff 为空；55/55 + 178/178 通过 |
| 三动作 | 刷新链 | `await this.syncAgentSystemPrompt()` 恰一次 | ✓ WIRED | L 组用例通过（178/178） |
| seeded 集合 | 三动作判定 | `getSeededSkillNamesSafe()` → `seededNames` | ⚠️ PARTIAL | 注入签名正确、零 electron 保持；**生产注入值本身无自动化断言**，降级为空集合时保护完全消失（见 `coincidental_reliance_items`） |
| 失败消息 | 重载链路原因码 | 词缀 → `MANAGE_SKILL_CODE_TAG` 解析 | ✓ WIRED | M2c/M2d 通过（178/178）；`ai-manager.js` 本轮未改 |
| 卡片标注 | `/` 面板单源串 | `PROMPT_OMITTED_CARD_NOTE = STATUS_TEXT.promptOmitted.split(' · ').pop()` | ✓ WIRED | 本轮运行时求值相等（`"超预算"`，len 3） |
| 280px 面板 → 卡片宽度 | `.tool-card-name` 裁切盒 | CSS 变量 + 真实拖拽 | ✓ WIRED | 本轮重跑 G-49-3 驱动：260 → 钳回 280；280 档几何全绿 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 折叠块 header 的 a11y 属性 | `interactive`（构建期选项） | 两个调用点字面量（气泡缺省 true / 卡片 false） | 真实（真实渲染两态实测属性全 `null` / 气泡三属性在场） | ✓ FLOWING |
| 折叠块正文 | `skillInvocation.content` | 持久化的工具参数 `params.content` | 真实（独立探针实测 `bodyChars=444`） | ✓ FLOWING |
| 卡片标题 / 徽标 / 标注 | `toolExecution.manageSkill` | 主进程两时点事件标记（并入语义已修复） | 真实 | ✓ FLOWING |
| 卡片头部标注文本 | `PROMPT_OMITTED_CARD_NOTE` | `STATUS_TEXT.promptOmitted` 的机械投影 | 真实（G-49-3 重跑实测 `note=34 === scrollWidth 34`，`text="超预算"`） | ✓ FLOWING |
| 失败短原因 | `MANAGE_SKILL_SHORT_REASON[code]` | 持久化词缀 → decode | 真实（已执行行）；旧行无词缀时省略键（宁缺勿猜） | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 1. **UI-49-W6-01 真实渲染门禁（仓内驱动）独立重跑** | `NODE_PATH="$(npm root -g)" node tests/uat-49-g49-4-card-a11y-tab-order.js` | **退出码 0**；`ALL ASSERTIONS PASS`；preflight `E-PW/E-DATA-DB` 全 true（候选会话 2 个）；P1/P2/R1–R6 全 PASS；`R3` 卡片域内 **0** 站 / 违反 **0**；`R5` 折叠与展开两态属性全 `null`；`R4` 气泡真实 Enter 切换成功 | ✓ PASS |
| 2. **verifier 自建独立探针（页面内阳性对照，不依赖仓内任何断言）** | `NODE_PATH="$(npm root -g)" node /tmp/v49-a11y-probe2.js` | **12/12 PASS**：修复态 `focus()` no-op（焦点留 BODY）；阳性对照下同 header `focus()` 成功、`rectH=29`、中心点命中 `<CODE>`（`hitIsSelf=false`）；折叠块 `display=block` / 444 字符；变异已复原 | ✓ PASS |
| 3. **49-07 真实渲染门禁回归** | `NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js` | 退出码 **0**；A1–A9 全绿；280 档 `nameWrap 136/136`、`nameText 54`、`badge 30`、`note 34`（`text="超预算"`）、越界 `0.00px`、头部 `36`；`errorNoteCovered=true` | ✓ PASS |
| 4. 三套件实测（**本轮重跑**） | `node tests/test-manage-skill.js` · `node tests/test-ai-skills.js` · `node tests/test-skill-picker-model.js` | **55/55** · **178/178** · **111/111**（`# fail 0`）—— 与上一轮逐字相同 | ✓ PASS |
| 5. 全量回归（**本轮一次性重跑**） | `for f in tests/test-*.js; do node "$f"; done` | **22/22 套件退出码 0，0 失败** | ✓ PASS |
| 6. 例数账本一致性判据（§11.8 的可重跑命令，**本轮重跑**） | `sed -n '547,555p' docs/product/ai-skills.md > /tmp/v49-counts.js && node /tmp/v49-counts.js` | `counts-parity ok` · `cells=8` · `measured={"test-manage-skill.js":"55","test-ai-skills.js":"178","test-skill-picker-model.js":"111"}` | ✓ PASS |
| 7. **「声明零改动」的独立路线（绕开 A9 的 `/tmp` 基准）** | `git show a52f09d:src/styles/main.css` + 自算剥注释声明投影 sha256 | 差异**全在注释块内**；`a52f09d` / `HEAD` / 工作树三处 sha **逐字相等** | ✓ PASS |
| 8. 投影常量与合并函数语义（真实导出求值） | `node -e "require('./src/skill-picker-model.js')…"` | 投影 `"超预算"`(3) 且等于 `STATUS_TEXT.promptOmitted.split(' · ').pop()`；九码齐备、每值 ≤ 6 字；`merge` 保留 `action`/`name`；`merge(b,null)===b` | ✓ PASS |
| 9. 单源与属性施加入口普查（**本轮重跑 grep**） | `grep -n "renderSkillContentBox" src/renderer.js` · `grep -n "setAttribute('tabindex'\|setAttribute('role'" src/renderer.js` | 定义 **1** 处、调用 **2** 处；`tabindex` 施加全仓 **1** 处（`:8962`，守卫内）、`role` 2 处（1 处为 tab 元数据 + 1 处在守卫内） | ✓ PASS |
| 10. **`src/renderer.js` 的「零行为改动」token 流证明**（本轮新增） | `node /tmp/v49-token-proof.js`（TypeScript 扫描器逐节点取非 trivia token，比较 `kind + text` 序列） | `HEAD~1` vs `HEAD` 的**非 trivia token 流逐字相等**：两侧均 **29448** tokens、序列 sha 均 `47056b3a1b40579e…`；源文本 479587 → 479606 字节，差值**全部**落在被扫描器排除的 trivia（注释/空白）内 ⇒ 该提交只改了 JSDoc | ✓ PASS |
| 11. **`src/styles/main.css` 的声明投影同一性**（本轮新增） | `node /tmp/v49-css-proof.js`（`git show` 两版 + 工作树；两种归一化） | raw sha **不同**（`8d23fb0f…` → `db69e10a…`）但**剥注释后投影逐字相等**：仓内驱动同款归一化 = `69899a4f2a42c56aa5b102ee828ab49ccaf6ca9b23032674759b6a88d7a293db`（与 UAT 测试 3 的 A9 记录值**逐字相同**）、verifier 严格归一化（再压空白）= `f9d9c4b205e30aae…`；差异区经最长公共前缀/后缀定位后**整体落在块注释内**（差异区起点之前 `/*` 计数 > `*/` 计数，且差异区尾部是共有的 `*/` 与规则选择器） | ✓ PASS |
| 12. **行号引用普查**（本轮新增） | `grep -rn ':508' src/ docs/ tests/` · `grep -rn '契约\s*:[0-9]' src/ docs/ tests/` | 两式**均零命中**；`src/renderer.js:8946` 与 `src/styles/main.css:5861` 已改为**按名引用**，该名称「展开 / 折叠（卡片）」在 `49-UI-SPEC.md:525` 确为契约行标签（名称解析有效，不再依赖行号） | ✓ PASS |
| 13. **§11.7 代价句与代码的逐条核对**（本轮新增） | 直读 `renderToolCard` 区域（`:9616-9890`）+ 全仓 `tabindex` / `role` / `contenteditable` / `keydown` 普查 | 全仓 `setAttribute('tabindex')` **仅 1 处**（`:8962`，在 `if (interactive)` 守卫内）；工具卡片区域内 `tabindex` / `setAttribute('role'` / `contenteditable` / `addEventListener('keydown'` **零命中**；`.tool-card`（`:9617`）与 `.tool-card-header`（`:9732`）均为裸 `<div>`，卡片区唯一 `.expanded` 切换点是 `:9835` 的 `click` ⇒ 键盘确无展开入口，代价句与实现一致 | ✓ PASS |
| 14. **SC1 层 2 原始证据的独立核证**（本轮新增，用于裁决上一轮人工项 #1） | 直读 `/tmp/uat49/evidence.json` 的 `tests.test1_visibility` 与 `mainLogTail`；另核 `realm-dev/agent-workspace/managed-skills/commit-style/SKILL.md` 的落盘时间 | `containsTargetSkill: true`；`question` = 「你现在有哪些技能？请把当前可用的技能名全部列出来。」；`replyText` **逐字**含「commit-style — 当需要撰写 git 提交信息时使用此技能，按 conventional commits 规范书写。」；日志链 `工具调用: manage_skill {"action":"create","name":"commit-style",…}` → `工具完成: manage_skill → … 已创建技能「commit-style」。它从下一条消息起对模型可见。`；`env.nodeEnv=development` 且 `agentWorkspace` 指向 `realm-dev`（未触碰正式版 profile）；该技能目录 mtime `09-13 21:27` 落在该驱动运行窗口（21:23–21:27）内 ⇒ 技能确由该轮**创建**，「下一条消息可见」不是「既有技能被列名」 | ✓ PASS |

**注**：套件全绿在本阶段**不是**目标达成的证据（本阶段前几轮正是「三套件全绿却漏掉三条 Critical」）。上表 #1/#2/#3/#7 全部独立于彼此：**#2 是 verifier 自建、且含对抗性阳性对照**，用于抵消轮 5 `WR-12`（仓内驱动的承重判据 `R3` 在绿轮**空集真**）的假绿风险 —— 阳性对照证明「把 `tabindex` 加回去，同一遍历/同一判据必然转红」，即**绿不是恒真**。

**注 2（本轮的复核口径）**：#10–#14 是**本轮新增**的、互不依赖的差分/普查判据。#1/#2/#3 是**上一轮**在 `b16f241`（= 本轮 `HEAD~1`）上实跑的既有结论；本轮**没有重跑这两个 `_electron` 驱动**（见下「本轮差分复核」§5 的取舍说明），而是用 #10–#13 证明「`f1057e0` 相对 `b16f241` 在 `src/` 下是**零行为改动**」——#11 的投影 sha 与驱动 A9 的记录值逐字相同，即驱动 A9 的输入未变；`tests/uat-49-g49-4-…` 全篇不读任何源码文本（只读它自己的证据 JSON），故其断言输入亦未变。

### 本轮差分复核（`f1057e0`：注释 / 散文专属改动）

**复核对象**：`f1057e0`（`HEAD`）相对 `b16f241`（`HEAD~1`，即上一轮报告判 `human_needed` 时所在树）的改动 —— 3 文件 / `+5 −3`：`src/renderer.js`、`src/styles/main.css`、`docs/product/ai-skills.md`。三者**均在** `covered_files` 内。`git diff --stat HEAD -- <三文件>` 为空 ⇒ 工作树与 `HEAD` 逐字一致。

**1 · `src/renderer.js` —— 用 token 流证明「零行为改动」**
方法：用仓内 `node_modules/typescript` 的扫描器把两版源码解析成 AST，遍历取**每个非 trivia token** 的 `kind + 原文` 组成序列（注释与空白不进入序列），逐位比较。**结果**：两侧 token 数均 **29448**、序列 sha256 均 `47056b3a1b40579e…`（逐字相等），而源文本由 479587 字节变为 479606 字节 —— 全部差值落在被排除的 trivia 内。⇒ 改动是**纯 JSDoc**，对可执行语义零影响。**独立旁证**：`git diff -U0` 只显示 1 处 hunk（`:8946` 一行换两行），且删/增行均以 ` *` 起首（JSDoc 块体内）。脚本：`/tmp/v49-token-proof.js`。

**2 · `src/styles/main.css` —— 用「剥注释后的声明投影」证明「零声明改动」**
方法：`git show b16f241:src/styles/main.css` / `git show f1057e0:…` / 工作树三份文本，各做**两种**归一化后取 sha256：① 仓内驱动同款（`stream` 级 `replace(/\/\*[\s\S]*?\*\//g,'')`，见 `tests/uat-49-g49-3-panel-layout.js:99-102` 的 `cssDeclProjectionSha`）；② verifier 更严的（再压全部空白 + trim）。**结果**：raw sha **改变**（`8d23fb0f…` → `db69e10a…`，193113 → 193153 字节），但两种归一化下 `b16f241` === `f1057e0` === 工作树：仓内归一化 `69899a4f2a42c56aa5b102ee828ab49ccaf6ca9b23032674759b6a88d7a293db`、严格归一化 `f9d9c4b205e30aae…`。**且差异区被定位**（最长公共前缀/后缀）：`before` 差异区 `[107156, 107164)`、`after` `[107156, 107204)`，差异区起点之前 `/*` 计数 > `*/` 计数（**在块注释内**），差异区尾后紧跟共有的 `。 */` 与 `.ai-skill-content-box-header:focus-visible {`。⇒ 注释外的每一条声明逐字未动。脚本：`/tmp/v49-css-proof.js`。

> 这条同时是对轮 5 `IN-15` 的顺带核实：被改的正是那两处引用所在的注释；改动**没有**把任何声明拖进/拖出 `M14` / `M15` 的切片窗口。

**3 · `docs/product/ai-skills.md` —— 散文专属 + 账本重跑**
改动是 §11.7 内**同一行的替换**（1 行 → 1 行）⇒ 行数不变、§11.8 的代码块位置不变。账本一致性用 **§11.8 自带的、可重跑的 `counts-parity` 命令**验收（本轮把该代码块原样抽到 `/tmp/v49-counts.js` 后从仓根执行）：输出 `counts-parity ok` · `cells=8` · `measured={"test-manage-skill.js":"55","test-ai-skills.js":"178","test-skill-picker-model.js":"111"}`，与本次三个套件的现场实测 `# tests` **逐字一致**。⇒ 账本仍自洽（检测性：该命令对任一单元取到的值 ≠ 实测即非零退出并指名到「文件:行号 + 套件名 + 取到的值」）。

**4 · 引用锚点普查 + §11.7 代价句的事实核对**
- **行号引用普查**：`grep -rn ':508' src/ docs/ tests/` 与 `grep -rn '契约\s*:[0-9]' src/ docs/ tests/` **均零命中**。两处已改为**按名引用**（`src/renderer.js:8946`、`src/styles/main.css:5861`，均引用「展开 / 折叠（卡片）」行）；该名称在 `49-UI-SPEC.md:525` 确实是契约行标签 ⇒ 引用**指向正确且不含会漂移的行号**。**残留**（不属 `IN-15` 的载荷面，故不阻断闭合）：`.planning/STATE.md:254` 的决策条目仍写 `49-UI-SPEC.md:508`（编排器维护的过程状态文件）；`49-UI-SPEC.md:567` 的 E3 元素清单行仍写「header 具 `role="button"` + `aria-expanded`」而未加语境限定（轮 5 复核已明文「只作交叉提示、不计 finding」）。**plans / SUMMARY / REVIEW / UI-REVIEW 里的旧行号是历史记录，应保留**（`49-UI-REVIEW.md` 本身即有「只加不删、不回溯改写原文」的成文纪律）。
- **代价句事实核对**：见行为学抽查 #13 —— 断言成立（卡片语境键盘确无展开入口）。

**5 · 为什么本轮不重跑两个 `_electron` 真实渲染驱动**
`#1`（g49-4）与 `#3`（g49-3）是**上一轮在 `b16f241` 上**的实跑结论。本轮**未重跑**，理由是**确定性的**而非省事：① `tests/uat-49-g49-4-card-a11y-tab-order.js` 全篇**不读任何源码文本**（`grep readFileSync` 只命中它自己的 `EVIDENCE_PATH`）⇒ `f1057e0` 不构成它的任何输入；② `tests/uat-49-g49-3-panel-layout.js` 读 `src/styles/main.css` 的唯一位置是 `cssDeclProjectionSha()`，而其输入已由 §2 证明**逐字未变**（且与 A9 记录值相同）；③ `src/renderer.js` 的可执行面由 §1 证明**逐字未变**。三条合起来即「驱动输入 = 上一轮输入」⇒ 重跑只会复现同一结论，而每次重跑都要拉起真实 `_electron`（占用用户机器、写入 dev profile 数据、有挂住风险）。故本轮把预算投在**证明「输入未变」**上（#10–#13），这比再跑一次更承重，也避免了不必要的进程操作。**代价（如实记录）**：#1/#3 的**本轮现场**证据为间接（差分），不是当场重跑的输出。

**6 · 本次复验未改动任何实现 / 测试文件**
`git status --porcelain` 在本轮前后一致：仅有 `.gitignore`（先于本阶段存在）、本报告自身、以及两个未跟踪过程产物（`.planning/milestone.lock`、`.planning/phases/47-bash/.review-diagnostics/`）。本轮的产出只有临时脚本（`/tmp/v49-token-proof.js`、`/tmp/v49-css-proof.js`、`/tmp/v49-counts.js`、`/tmp/v49-preserve-check2.js`）与本 VERIFICATION.md。

**7 · 本报告自身的可核对面（两条自证判据，均可重跑）**

- **保留性**：本报告是**就地更新**（保留结构 / 24 条真值行 / 需求账本 / `advisory` 列表逐字）。核对方式：从**上一轮 verifier 的会话记录**（`…/subagents/agent-c49003dba87d47de.jsonl`，其写入调用的 `toolResult.renderer.value`）取回上一轮报告全文（32209 字节，`verified: 2026-09-13T17:24:01Z` / `human_needed` / `24/24`），再与本文逐字段机械比对。结果：`advisory` 16 条的 `finding` / `category` / `reason` / `evidence_status` **0 处差异**；`coincidental_reliance_items` 逐字未变；`covered_files` 集合相同（31 项）；6 条 MGMT 需求行逐字未变；24 条真值行**逐字未变**，仅有 **2 处**行内指针改写（真值 #1 与 #21 原先指向 `Human Verification #1/#2`，因该节语义已变而改指「本轮状态裁决」各项与对应 spot-check）；新增键只出现在 4 条目标 advisory 上（`WR-12` / `IN-14` 加 `status: open` + `carried_forward`；`IN-15` / `IN-17` 加 `status: closed` + `closed_by`）。脚本：`/tmp/v49-preserve-check2.js`。
- **指纹**：`covered_files` / `covered_digest` 由 `gsd_run query verification.fingerprint <phaseDir> <31 个 covered 文件>` **计算得出**（未手改；该 verb 在哈希前会对路径做规范化 / 去重 / **排序**，故 `covered_files` 的书写顺序不影响指纹 —— 本报告保留了上一轮的书写顺序），且 `gsd_run verification status .planning/phases/49-manage-skill-ai` 在全部编辑完成后仍返回 `{"status":"passed","next_action":"Verification passed — continue."}`（**未判 `stale`** ⇒ 重算指纹与声明值一致、且阶段目录下每个 PLAN/SUMMARY 都在 `covered_files` 内）。

> **一处须如实披露的账本事实**：上一轮的报告**当时未被提交** —— `HEAD`（`f1057e0`）里 `49-VERIFICATION.md` 仍是**更早一轮**的版本（11 条 advisory、`verified: 2026-09-13T14:52:00Z`）。因此本次更新相对 `HEAD` 呈现为**单次修改**，它同时携带了上一轮的全部改动。这与本报告 `covered_digest` 的取值无关（指纹只覆盖 `covered_files` 的内容，不含本报告自身），但会影响读 `git diff HEAD` 的人对「本轮改了什么」的直觉 —— 上表「保留性」一行给出的是**与上一轮原文**（而非与 `HEAD`）的比对。

### Probe Execution

无 phase 声明的可执行探针（PLAN/SUMMARY 未声明 `probe-*.sh`，phase 不含 `scripts/*/tests/probe-*.sh`）→ 不适用。两个 `tests/uat-*.js` 真实渲染驱动由**上一轮**按行为学抽查 #1 / #3 实跑（退出码 0）；本轮未重跑，改用 spot-check #10–#13 证明其**输入未变**（理由见「本轮差分复核」§5）。两者命名以 `uat-` 开头，**永不被** `test-*.js` 套件拾取。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MGMT-01 | 49-01/02/04/05/06/07 | AI 拥有 `manage_skill` 工具，支持 create / update / delete | ✓ SATISFIED | 工具项就位（truth #2）+ 三动作落地（55/55）+ 刷新链恰一次（truth #1）+ 卡片变体可达（truth #10/#11）+ 标注单源投影（truth #13） |
| MGMT-02 | 49-01/04 | 不接受 `path`，只接受 `name`/`content`/`description`；路径由 manager 计算 | ✓ SATISFIED | 键集合逐字核对（truth #2）；7 种注入式 name 全被拒（历史探针，本轮 55/55 复核） |
| MGMT-03 | 49-01/04/06 | 服务端二次校验 name/description/正文字节上限；写入走原子写 | ✓ SATISFIED | 三校验器 + 净化后复验 + 原子写；字节闸与加载期同量（truth #8） |
| MGMT-04 | 49-01 | seeded 不可被覆盖或删除（按播种登记表） | ✓ SATISFIED | 三入口 `seeded_protected` + 反向例 + 内容零改动（truth #4）；生产注入接线见 `coincidental_reliance_items` |
| MGMT-05 | 49-01/02/05/07 | 成功后刷新技能集与 system prompt | ✓ SATISFIED | L1 行为用例（忙时置脏 → 成功出口回写 + 广播恰一次）；49-07 的卡片面在最小宽度下可读（truth #12） |
| MGMT-06 | 49-01 | 工具描述引导「优先增强已有技能」 | ✓ SATISFIED | 两条文案在 `description` 内（truth #7） |

**孤儿需求检查**：`REQUIREMENTS.md` 映射到 Phase 49 的 ID 为 MGMT-01..06（需求行 `:42-47` 均 `[x]`；追踪表 `:137-142` 六行均 `Complete`；`:182` 的行汇总为 `MGMT-01..06 | 6`）。计划侧声明为 49-01 全部六个、49-02 `[MGMT-01, MGMT-05]`、49-03 `[]`、49-04 `[MGMT-01, MGMT-02, MGMT-03]`、49-05 `[MGMT-01, MGMT-05]`、49-06 `[MGMT-01, MGMT-03]`、49-07 `[MGMT-01, MGMT-05]`、49-08 `[]`（gap-closure 计划，`gap_ids: [UI-49-W6-01]` 是 UI-REVIEW 的 BLOCKER 而非需求）—— **六个 ID 全部被至少一个计划声明，无 ORPHANED**。

### Decision Coverage

`gsd-tools query check.decision-coverage-verify <phaseDir> <contextPath>` → `{"skipped":false,"blocking":false,"total":13,"honored":13,"not_honored":[],"message":"All trackable CONTEXT.md decisions are honored by shipped artifacts."}`（非阻断门禁，记录备查）。

**本轮重跑复核（附正确调用式）**：该 verb 要求**两个**位置参数（`args[2]` = phaseDir、`args[3]` = CONTEXT.md 路径），只传阶段号会得 `{"skipped":true,"reason":"CONTEXT.md missing"}` 的**假跳过**（本轮实测：`… 49` 与 `… 49-manage-skill-ai` 两种单词写法都跳过 —— 前者被当作 phaseDir 解析、后者被当作 `<phaseDir>/<contextPath>` 解析而 `49-CONTEXT.md` 的**编号前缀**非该 verb 的约定名）。正确式：

```bash
gsd_run query check.decision-coverage-verify \
  .planning/phases/49-manage-skill-ai \
  .planning/phases/49-manage-skill-ai/49-CONTEXT.md --raw
```

本轮实跑输出与上一轮**逐字相同**（`total:13 / honored:13 / not_honored:[]`），可复现。

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `tests/test-manage-skill.js` | MGMT-01..04 | 55 | 0 | 否（写盘均为临时夹具，非自产期望值） | Behavioral（真跑三动作 + 真实沙箱 env） | ✓ PASS |
| `tests/test-ai-skills.js` | MGMT-01..06 | 178 | 0 | 否 | Behavioral（L1 真跑 `tool.execute` + 真实 `prompt` 出口；M 组真跑重载路径） | ✓ PASS |
| `tests/test-skill-picker-model.js` | MGMT-01/05（卡片纯逻辑） | 111 | 0 | 否 | Value（真实导出函数求值） | ✓ PASS |
| `tests/uat-49-g49-4-card-a11y-tab-order.js` | UI-49-W6-01 | R1–R6 | 0 | 否 | Behavioral（真实 `_electron` + 真实 Tab 遍历 + 命中测试） | ⚠️ WARNING — 绿轮承重判据 `R3` **空集真**（`WR-12`）；本轮已由 verifier 自建阳性对照探针补足 |

**Disabled tests on requirements:** 0 → 无 BLOCKER（`grep` 的 `xit(` 命中全部是 `process.exit(` 的假阳性，逐条已核）。
**Circular patterns detected:** 0 → 无 BLOCKER（写盘点全部是临时目录夹具）。
**Insufficient assertions:** 0 → 无 WARNING（关键需求均有 behavioral 级断言）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/uat-49-g49-4-card-a11y-tab-order.js` | `:44-50` / `:662-720` | 承重判据 `R3` 绿轮**空集真** + 全套只有否命题（折叠块 `display:none` 时全绿） | ⚠️ Warning | 守卫强度债（**WR-12**）。本轮已用自建阳性对照探针独立闭合该 must-have（见 spot-check #2） |
| `tests/test-ai-skills.js` | `:4168-4237`（M9b） | 纯源码形态扫描，三种形态等价变体全绿 | ⚠️ Warning | 守卫强度债（**IN-14**）。行为面已由真实渲染探针独立闭合 |
| `tests/uat-49-g49-3-panel-layout.js` | `:576-609`（A1–A6） | 全是「不越界」单向判据 —— 标注 `display:none` 时 A1–A9 全绿 | ⚠️ Warning | 守卫强度债（**WR-10**）。本轮已用源码声明 + 驱动实测 `note=34` 独立复核 |
| `tests/uat-49-g49-3-panel-layout.js` | `:274-287` | A9 的红轮基准从 `/tmp` 续传，基准缺失时退化为自比较 | ⚠️ Warning | 守卫强度债（**WR-09**）。本轮已用 `git` + 自算声明投影 sha 的独立路线复核 |
| ~~`src/renderer.js` `:8946` · `src/styles/main.css` `:5860`~~ **已修** | `:8946` · `:5861` | ~~引用 `49-UI-SPEC.md:508`（该行已被 49-08 自己的插入推到 `:525` ⇒ 引用指向空行）~~ → 已由 `f1057e0` 改为**按名引用**「展开 / 折叠（卡片）」行 | ℹ️ Info → **已闭合** | **IN-15 已闭合**：`src/` · `docs/` · `tests/` 三目录内 `:508` 与 `契约 :NNN` **零命中**（spot-check #12）；该名称在 `49-UI-SPEC.md:525` 确为契约行标签。残留（不阻断）：`.planning/STATE.md:254`（过程状态文件、编排器维护）与 `49-UI-SPEC.md:567` 的 E3 清单行（轮 5 已明文「只作交叉提示、不计 finding」） |
| ~~`docs/product/ai-skills.md`~~ **已修** | §11.7 条目 | ~~只写「为什么卡片实例不施加」，未写**代价**（卡片语境下正文折叠块键盘不可达）~~ → 已由 `f1057e0` 补齐**代价句**（无任何键盘入口 / 鼠标是唯一入口 / **非 49 引入的回归** / 应作为 a11y 改善项单独立项） | ℹ️ Info → **已闭合** | **IN-17 已闭合**：本轮已把该句与代码逐条核对（spot-check #13）—— 工具卡片区域内确无可聚焦、可触发展开的元素（全仓 `tabindex` 施加仅 1 处且在气泡守卫内） |
| `ai-manager.js` | 三态消费侧 | `promptIncluded === undefined` 时不追加任何说明 | ⚠️ Warning | 幽灵写入（若发生）报无保留的成功；两轮探针（38 条对抗输入）均无法构造出幽灵（WR-06） |
| `ai-manager.js` | 词缀 encode/decode | encode 谓词非 decode 谓词的逆 ⇒ 词缀可能产生不可解码噪声 | ⚠️ Warning | 当前可达面全落在九码白名单内（WR-08） |
| `ai-manager.js` | 两链路键集合 | 「工具从未执行」类上实时 / 重载分歧 | ⚠️ Warning | 既有口径、非本轮引入（WR-07） |
| `src/styles/main.css` | 实测口径注释段 | 把两种口径写成一个等式（标注 scrollWidth 被写成祖先的 148；146−136 ≠ 11.84） | ℹ️ Info | 文档/注释诚实度（IN-13） |
| `docs/product/ai-skills.md` | 「结果区已承载完整语义」/「诚实边界」 | 默认折叠态下不成立 + 与已落盘证据相反 | ℹ️ Info | 文案诚实度（IN-12 / IN-11） |
| `.planning/WINDOWS.md` | unrun-verify #30 | 低估现有覆盖（A8 本轮实测 `errorNoteCovered=true`） | ℹ️ Info | 账本口径滞后于证据 |

**债务标记门禁**：本阶段改动文件内**无**无引用的 `TBD`/`FIXME`/`XXX` 债务标记。逐文件扫描 `src/renderer.js` / `src/styles/main.css` / `tests/uat-49-g49-4-card-a11y-tab-order.js` / `tests/test-ai-skills.js` —— 四条命令均**零命中**；历史挂账的两处 `XXX`（`ai-skills-manager.js` 的 `tmp-XXXXXX/` 目录名 glob 形态、`ai-manager.js` 工具描述示例词）均为散文占位符且早于本阶段，本轮未新增。

### Human Verification Required

**无（frontmatter 的 `human_verification` 块按规则为空）。** 上一轮登记的 2 项在本轮**均已消解**，逐项裁决如下。

#### 本轮状态裁决：为何由 `human_needed` 改为 `passed`

**（前一轮项 #1）SC1 层 2 证据 —— 判「已由既有 UAT 覆盖，不再构成人工门禁」**

- 事实基础：`49-UAT.md` 测试 1 已记 `result: pass` / `source: automated-e2e` / `verified_at: 2026-09-13T13:22:00Z`，其 `expected` 明写断言点在**下一条消息**（非工具返回时）。
- 本轮的**独立核证**（不止读 UAT 的结论，而是直读其**原始证据文件**）：见 spot-check **#14** —— `/tmp/uat49/evidence.json#tests.test1_visibility` 的 `containsTargetSkill === true`、`replyText` 逐字含 `commit-style`；`mainLogTail` 呈现 `工具调用: manage_skill {"action":"create","name":"commit-style"…}` → `工具完成: manage_skill → … 已创建技能「commit-style」。它从下一条消息起对模型可见。`；`env.nodeEnv=development` 且 `agentWorkspace` 指向 `realm-dev`（未触碰正式版 profile）；`commit-style/SKILL.md` 的 mtime 落在该驱动运行窗口（21:23–21:27）内 ⇒ 该技能确为**该轮创建**，「下一条消息可见」不是「既有技能被列名」。
- 唯一残余是**可复现性债**（原始驱动脚本已不在 `/tmp`、`E-DATA-DB` 依赖本机会话库 ⇒ 不能在仓内重跑），这正是 `IN-16`，**已如实挂账为 advisory**。它不是「一项未执行的人工测试」，而是「一项**已执行**、但证据不可在仓内复建的测试」。
- 加上层 1 机制面对应的真值 #1（L1 行为用例真跑 `tool.execute` + 真实 `prompt` 出口）本轮回归仍绿（178/178）。⇒ **该项不再构成人工门禁。**

**（前一轮项 #2）49-08 D3（`human_judgment: true`）文本准确性通读 —— 判「裁定已作出并已落地」**

- 该项 `why_human` 的**全部理由**是：同一批新写的散文里有两处真实缺陷（`IN-15` / `IN-17`）**需人裁定是否本轮修补**。
- 该裁定**已作出并已落地**：`f1057e0`（2026-09-14 09:42 +0800）即按 `49-REVIEW.md` 给出的修法逐条实施 —— `IN-15` 两处改为按名引用、`IN-17` 补齐代价句；两条 advisory 本轮**已闭合**（见 frontmatter `advisory` 的 `status: closed` 与 `re_verification.advisories_closed`）。
- 因此「待裁定」这一理由**已消失**。本轮另把两项修补的事后核对做完：按名引用确实解析到 `49-UI-SPEC.md:525` 的契约行（spot-check #12）；代价句确实与代码一致（spot-check #13）。⇒ **该项不再构成人工门禁。**

**结论（decision tree 逐条走一遍）**：规则 1（任一真值 FAILED / 产物 MISSING·STUB / 关键链接 NOT_WIRED / blocker 反模式）**未触发** —— 24/24 真值 VERIFIED、无 gap、无 blocker（`WR-12` / `IN-14` / `WR-09` / `WR-10` / `WR-05`–`WR-08` / `IN-10`–`IN-13` 等均为**守卫强度债 / 文案诚实度 / 可移植性债**，逐条已用**不依赖其各自守卫**的独立路线把对应 must-have 判为 VERIFIED）；规则 2（Step 8 产生人工项）**未触发**（本段为空）；故落到规则 3 ⇒ **`status: passed`**。`behavior_unverified = 0`、`overrides_applied = 0`。

> **不是为了让编排器满意而上调**：上述两项「理由消失」都可指到具体证据（spot-check #12 / #13 / #14 + `f1057e0` 落地的文件与内容）。反向检验：若把 `IN-16`（可复现性）或 `WR-12` / `IN-14`（守卫强度）判定为**必须当场闭环**，本条就应退回 `human_needed` —— 但按本阶段已确立的口径（守卫强度债记入 `49-REVIEW.md` 作技术债、不阻断收尾，见「阶段收尾以 UAT 为准」），它们不构成目标未达成、也不要求人工裁决。

> **`49-UAT.md` 未被本次复验修改**：其 `status: complete`、3/3 pass、`issues: 0`、`G-49-3` `status: resolved` 的既有结论**全部保留**。上一轮登记的 2 项是**在既有 UAT 之上**的附加项，本轮判为消解，**不推翻**任何既有人工结论。

### Gaps Summary

**无 gap。** 前次报告判 `human_needed` 时唯一的未决 BLOCKER（`49-UI-REVIEW.md` 的 `UI-49-W6-01`：折叠 `manage_skill` 卡片内的零可见高度 Tab 停靠点）已由 **49-08 真实闭合**，且**上一轮**用**两条互相独立的证据链**复核：

> 下面的三个小节（含其中的「本轮」字样）**逐字保留自上一轮报告**，其中的「本轮」指**49-08 收口后的那一轮复验**；本文这一轮（`f1057e0` 之后）以「驱动输入未变」的差分论证沿用其结论，见「本轮差分复核」§5。

- **仓内驱动独立重跑**：`tests/uat-49-g49-4-card-a11y-tab-order.js` 退出码 0，P1/P2/R1–R6 全绿；`R3` 卡片域内 **0 站 / 违反 0 站**；`R5` 折叠与展开两态属性全 `null`；`R4` 气泡实例的 48 Pillar 6 增量原位保留（真实 Enter 切换成功）。
- **verifier 自建独立探针（含页面内阳性对照）**：12/12 PASS —— 修复态 `header.focus()` 为 **no-op**（无 `tabindex` 的 div 不可聚焦 ⇒ 不可能成为 Tab 停靠点）；把 `tabindex="0"` 在页面内加回之后，同一次真实渲染里它**真的**可聚焦、自有矩形高 **29px**、而中心点 `elementFromPoint` 命中**别的消息的 `<CODE>`** ⇒ 该形态确为「不可见停靠点」。**这条阳性对照正是对轮 5 `WR-12` 的正面回应**：仓内驱动的 `R3` 在绿轮是空集真，但**同一判据对未修复形态必然转红**，且**让绿的那一项恰好就是 `{ interactive: false }`**。

**「修的是真因，不是补丁」也经独立路线复核**：`git diff` 确认 49-08 对 `src/` 的全部改动 = `renderSkillContentBox` 的语境开关（1 个函数）+ 卡片调用点多传 1 个选项 + 1 处 CSS 注释；`src/styles/main.css` 的**声明投影 sha256 在轮 4 基准 / HEAD / 工作树三处逐字相等**（本轮自算），即**没有**把折叠机制从 `max-height: 0` 改成 `display: none`（那会杀掉全仓所有工具卡片的 200ms 过渡）。`renderToolCard` 的其余卡片、`.tool-card-content` 的折叠机制与过渡**均未被触碰**。

**前一轮判 VERIFIED 的 13 条 truths 全部通过回归**：`tests/test-*.js` **22/22 套件退出码 0、0 失败**；三套件 55/178/111；例数账本 `cells=8` 逐字一致；`ai-manager.js` / `ai-skills-manager.js` / `src/skill-picker-model.js` 三个文件在本轮 49-08 的 diff 中**均为空**（改动面被严格限制在 6 个在册文件内）。**无回归。**

**本轮新开但判为「守卫强度债 / 文案诚实度，而非目标未达成」的 5 条**（`49-REVIEW.md` 轮 5 的 `WR-12` / `IN-14` / `IN-15` / `IN-16` / `IN-17`），连同前几轮的 11 条挂账，全部记入 frontmatter `advisory`。其中**两条直接关系到本轮那条 must-have 的守卫强度**（`WR-12` 的驱动空集真、`IN-14` 的 M9b 形态判据）已由本轮用**不依赖它们各自守卫**的独立路线逐一复核为真（自建真实渲染阳性对照探针）—— 故 must-have 判 **VERIFIED**，守卫弱点作为**覆盖缺口**记录，而不是把 must-have 判为未验证。**`WR-11` 的机制面已由 49-08 顺手闭合**（`stripComments` 剥行尾注释），残项 `IN-10` 仍在。

**状态为 `passed`（本轮由 `human_needed` 改判）的成因**：24 条 truths 全部 VERIFIED、`behavior_unverified = 0`、无 gap、无 BLOCKER；上一轮赖以判 `human_needed` 的 **2 项人工项**在本轮均**理由消失**（逐项裁决见上「本轮状态裁决」段）—— 项 #1 由 `49-UAT.md` 测试 1 的既定 pass 覆盖，且其**原始证据已被本轮独立核证**（spot-check #14），残余只是 `IN-16` 一族的**可复现性债**（advisory）；项 #2 的裁定理由（`IN-15` / `IN-17` 待裁）已由 `f1057e0` 消除，且两项修补经本轮事后核对（spot-check #12 / #13）。故 decision tree 未触发规则 1（无 FAILED / MISSING·STUB / NOT_WIRED / blocker）与规则 2（`human_verification` 为空），落到规则 3 ⇒ **`passed`**。

**下一步动作（均非阻断项，供编排器 / 维护者取舍）**：① `IN-16`（含 `WR-09`）—— 把「验收依赖 `/tmp`、依赖本机用户数据」的判据收敛为「自带夹具 + 仓内基准」，这是本阶段**反复出现**的结构性缺口（轮 5 已点名「凡是验收依赖 `/tmp`、依赖本机用户数据、或依赖计划文本的判据，都应视为**未保存的证据**」）；② `WR-12` / `IN-14` / `WR-10` —— 给这几道守卫补**正命题**判据（`WR-12`：折叠块必须在布局内且展开后可读；`IN-14`：把属性清单抽成零 DOM 依赖的纯函数做行为判据）；③ `IN-10` / `IN-11` / `IN-12` / `IN-13` 的文案与注释口径；④ 若要把「卡片头部成为可聚焦入口」作为全仓范式升级推进，Phase 50 的设置页技能管理区是同一族折叠控件的**第二个宿主**，届时一并决策（`49-08-PLAN.md` 已登记该方向）。**以上均不阻断阶段目标达成。**

**本报告的 `covered_files` 刻意不含 `49-UAT.md` / `49-VALIDATION.md` / `49-UI-SPEC.md` / `49-UI-REVIEW.md` / `49-SECURITY.md` / `.planning/ROADMAP.md` / `.planning/STATE.md` / `.planning/WINDOWS.md`** —— 这些是会被收尾流程（`verify-work` / `ui-review` / `phase complete` / 审计）改写的**过程状态文件**，纳入指纹会让报告在收尾动作中被自身反复判 stale（本项目已有先例）。代价是 `IN-15` 涉及的 `49-UI-SPEC.md:567` 残留与 `.planning/STATE.md:254` 的旧行号只能以 advisory 形式记录（两者均**不在**本报告的可核对面内）。`src/renderer.js` / `src/styles/main.css` / `docs/product/ai-skills.md` 三者**留在** `covered_files` 内 —— 它们是 `f1057e0` 的改动对象，必须被指纹覆盖（现指纹已按 `f1057e0` 后的内容重算）。

**安全纪律（本轮）**：本次复验**没有拉起任何 `_electron` 进程**（见「本轮差分复核」§5 的取舍说明）⇒ 全程**未**对 `/Applications/Realm.app` 或任何用户实例做任何操作，**未使用** `pkill` / `pgrep`，也**未**新增/删除任何 `/tmp/uat49` 证据（对 `/tmp/uat49/*` 只做**只读**核验，见 spot-check #14）。本轮新增的三个核验脚本与一个保留性校验脚本均写在 `/tmp`（`v49-token-proof.js` / `v49-css-proof.js` / `v49-counts.js` / `v49-preserve-check2.js`），**不入仓**。工作树在本轮前后的 `git status` 一致（仅既有的 `.gitignore` / `.planning/milestone.lock` / `.planning/phases/47-bash/.review-diagnostics/` 三处无关改动 + 本报告自身）。

**安全纪律（上一轮，保留备查）**：上一轮以 `NODE_ENV=development` 拉起**独立 `realm-dev` userData** 的 `_electron` 子进程跑两个驱动；对 `/Applications/Realm.app`（PID **22083**，用户正式版实例）全程无操作；**未使用** `pkill` / `pgrep`；verifier 自建探针收尾 `electronApp.close()` 挂住时，按**自己记录的 PID**（`ps -p 66556 -o command=` 确认确属 `Projects/Realm/node_modules/electron` 后）显式 kill 并复核无残留；`/tmp/uat49/evidence-g49-4.json` 与 `evidence-g49-3.json` 被其重跑覆盖（内容等价），原副本备份为 `/tmp/uat49/_verify_bak_evidence-g49-4.json`。

---

_Verified: 2026-09-14T01:48:27Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 49-manage-skill-ai
verified: 2026-09-13T12:59:34Z
status: human_needed
score: 13/14 must-haves verified
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
  - .planning/phases/49-manage-skill-ai/49-REVIEW.md
  - AGENTS.md
  - ai-manager.js
  - ai-memory-manager.js
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - src/renderer.js
  - src/skill-picker-model.js
  - tests/test-ai-skills.js
  - tests/test-manage-skill.js
  - tests/test-skill-picker-model.js
covered_digest: "v1:sha256:07b997f6a834f5cc74c3747097505a062ac36ef33af63002182caab19ffe6cba"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/14
  gaps_closed:
    - "写侧允许落盘的任何技能都必然能被加载管线收进技能集，不产生【落盘成功但整条被跳过】的幽灵技能（ROADMAP SC1 的完整性半边）"
    - "标记字段形状固定为 manageSkill = { action, name, tier?, code?, promptIncluded? }：tier / code / promptIncluded 在 end **并入**（UI-SPEC 硬约束 1）"
    - "重开对话后卡片形状与实时链路逐字一致（UI-SPEC 硬约束 3，成功行与失败行）"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-05：M3 仍是子串扫描，一个完整的 CR-01 回归（把 prev 传 null）通过全部 282 例"
    category: architectural
    reason: "本 run 已机械复现（见 Anti-Patterns / Behavior #17）。代码本身正确 —— 这是守卫强度债，不是目标未达成。修法见 49-REVIEW.md WR-05（把渲染端整个事件映射移进 src/skill-picker-model.js 的纯函数，由测试用真实载荷驱动）"
    evidence_status: "mechanically reproduced by this verifier (mutation passes 177+105)"
  - finding: "WR-06：幽灵写入仍报无保留的成功 —— 三态修复删掉了唯一的异常信号，undefined 分支不追加任何（真或假）说明"
    category: architectural
    reason: "本轮无法构造出幽灵生产者（见 Behavior #1–#3 的 30 条对抗输入零幽灵），故为残余风险而非可复现回归；但 T-49-01-08 正是本阶段要消灭的失效族，信号就在代码里未被使用"
    evidence_status: "none provided (reviewer and this verifier both failed to produce a ghost)"
  - finding: "WR-07：实时 / 重载两链路的 manageSkill 键集合在「工具从未执行」类调用上分歧（live 无 tier、reload 有 tier）"
    category: architectural
    reason: "本 run 已用真实函数机械复现（Behavior #16）。该类比 49-05 must_haves 划定的「成功行 / 失败行」更宽，属既有口径而非本轮引入；不影响目标能力与 seeded 保护"
    evidence_status: "mechanically reproduced by this verifier (real _resolveManageSkillTerminal vs _manageSkillTerminalFromStored)"
  - finding: "WR-08：`[code]` 词缀的编码谓词比解码谓词宽 —— 「只含白名单原因码」在三处文档里被声明为强制，实际一处都未强制"
    category: security
    reason: "本 run 已机械复现（Behavior #18）：`[ENOENT] x` / `[SCREAMING] x` 经解码谓词还原不出 code，会永久留在 LLM 可见文本里；`[a] [b] msg` 即注释声称不可能产生的形态。当前可达面窄（块内 throw 要么走 makeManageSkillError 的九码、要么是 Node 大写码）"
    evidence_status: "mechanically reproduced by this verifier (real decode function + source-visible encode predicate)"
  - finding: "IN-07 / IN-08 / IN-09（49-REVIEW.md 命名空间）：卡片标注 `oversize` 文案与整文件口径矛盾；MANAGE_SKILL_CODE_TAG 的 JSDoc 引用了一个不存在的源码门禁；M2d/M5c 手工构造持久化行，encode→store→decode 的接缝无守卫"
    category: other
    reason: "均为本轮新开的信息级条目，不阻断目标；IN-09 已由 reviewer 人工追链确认成立（本 verifier 复核了落库侧文本通道与词缀位于消息起始）"
    evidence_status: "none provided"
coincidental_reliance_items:
  - truth: "SC3：seeded 三入口拒绝按播种登记表判定（非目录位置）"
    reason: fixture-only
    harden: "本 run 的独立探针与仓内 55 例都在纯 Node 下**显式注入** seededNames 常量数组；真实运行时该值来自 ai-manager.js 的 getSeededSkillNamesSafe() → builtin-skills-seeder.getSeededSkillNames()（扫 skills-builtin/ 目录名，当前 2 个）。该函数在纯 Node 下会 console.warn 并降级为 [] —— 此时 seeded 保护**完全消失**（本 run 探针已机械证明：空登记表下 find-skills 可被删除）。生产注入正确性无任何自动化断言；仓库自身只护栏「测试不得走降级路径」。建议补一条接线断言：electron 环境下 getSeededSkillNamesSafe() 返回非空且 == skills-builtin/ 目录名集合"
behavior_unverified_items:
  - truth: "[backstop] AI 面板最小宽度（--ai-panel-min-width: 280px）下，带来源徽标 + 内联标注的 manage_skill 卡片头部保持单行不换行，徽标与短原因完整可读（仅技能名缩略），头部高度不变"
    test: "拖到最小面板宽度渲染一张同时带来源徽标 + 「未进提示词 · 超预算」标注的卡片（可用超长技能名替代复现）"
    expected: "头部单行不换行、高度不变，唯一允许的退化是技能名被省略号压缩；不成立时的处置是缩短短原因至 ≤ 4 字 —— 不得改成换行头部或加 system-note"
    why_human: "非可推断判据（verification: backstop）：行宽 / 换行取决于运行时字体度量与 flex 收缩行为。本 run 只证明了 `flex-shrink` / `white-space` 声明存在（presence+wiring），源码与 grep 永不能证明最小宽度下确实成立"
human_verification:
  - test: "端到端可见性（49-VALIDATION.md 五步表的步骤①+②）：`npm run dev`，在 AI 聊天里显式要求它把某套流程沉淀为技能（名字用 commit-style）；**不重开对话**直接发下一条消息问「你现在有哪些技能？」"
    expected: "应答中出现 commit-style —— 这是 ROADMAP SC1「下一条消息即对模型可见」的唯一端到端证据，断言点在**下一条消息**而非工具返回时。步骤①–⑤ 全文见 49-VALIDATION.md 的 Manual-Only 表"
    why_human: "需真实 LLM 往返，不可自动化（49-VALIDATION.md 层 2 已声明不得由层 1 证据替代）"
  - test: "卡片终态视觉面（步骤①）：同一张卡片终态应显示「创建技能「commit-style」」标题 + 托管徽标 + 参数摘要三行 + 折叠的「技能正文（N 字符）」块 + 含「下一条消息起」的结果文本"
    expected: "上述元素全部可见。**本次与前次的关键差异**：CR-01 已被本 run 机械证明修复（终态 manageSkill 保留 action/name、manageSkillOk === true），故该人工作业**现在可以执行**（前次报告明确写「修复 CR-01 前必然失败」）。注意：结果文本的实际措辞是「它从下一条消息起对模型可见。」，与 UI-SPEC 权威文案「该技能从下一条消息起可用。」不一致（WR-03，既有挂账）"
    why_human: "视觉呈现需真实渲染；机械证据只证明变体可达，不证明渲染结果正确"
  - test: "backstop 视觉确认（步骤⑤）：把 AI 面板拖到最小宽度（--ai-panel-min-width: 280px），让一张卡片同时带来源徽标 + 「未进提示词 · 超预算」标注"
    expected: "头部保持单行不换行、徽标与短原因完整可读、头部高度不变；唯一允许的退化是技能名被省略号压缩"
    why_human: "backstop 级判据（非可推断），需真实渲染下的视觉裁决；见 behavior_unverified_items"
---

# Phase 49: `manage_skill` 工具（AI 自建技能）Verification Report

**Phase Goal:** AI 可自主创建、更新、删除自己的技能，且无法覆盖或删除随包内置技能。
**Verified:** 2026-09-13T12:59:34Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure（49-04 / 49-05 / 49-06 三个 gap-closure 计划）

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1（机制）：三动作写入后刷新链在本轮成功出口回写 system prompt，新技能下一条消息可见 | ✓ VERIFIED | `await this.syncAgentSystemPrompt()` 恰一次于共享成功出口（ai-manager.js:6218 区）；L1 用例（忙碌置脏 → 出口回写 + 广播恰一次 + rescanCalls 记账）在实跑的 177 例内全绿 |
| 2 | SC1（完整性）：写侧允许落盘的任何技能都必然能被加载管线收进技能集（无幽灵技能） | ✓ VERIFIED | **本 run 独立探针 30/30**（25 条对抗 description + 5 条字节闸/三态）：含 `": "`/`#`/裸 `null`/`~`/`true`/`12345`/`@`/`*`/`-`/`{}`/`[]`/单双引号/`'''`/反斜杠/`---`/`>`/`\|`/零宽/BOM/**frontmatter 注入尝试**（`x\r\nname: injected`、`y'']\r\nname: hacked`）全部往返无损或按 `invalid_description` 正确拒绝；零幽灵、零描述失真。字节闸在 **65536 恰好放行 / 65537 拒绝且零磁盘残留**，同 content 配短描述对照组放行 —— 证明拒的是字节不是长度 |
| 3 | SC2：`parameters.properties` 键集合恰为 `{action, name, content, description}`，无 `path` | ✓ VERIFIED | 源码逐字核对 + 探针断言：无 `path:` 属性，enum 恰为三值，`executionMode: 'sequential'` |
| 4 | SC2：服务端独立二次校验，非法 name / 超长 description / 超限正文被拒并说明原因 | ✓ VERIFIED | 三个校验器（六 + 一 + 一分支）带可读中文原因；NaN 边界由 55 例覆盖 |
| 5 | SC3：seeded 保护按**播种登记表**判定（非目录位置），三入口拒绝 | ✓ VERIFIED | 独立探针：把 `find-skills` 造在 `managed-skills/` 下（位置=managed）后 create/update/delete **三入口全部** `seeded_protected`，seeded 目录内容逐字未改；反向例（未登记名 create/delete 均成功）成立 |
| 6 | SC4：原子写经沙箱双基准路径校验，create/update 共用同一路径，失败不留半成品 | ✓ VERIFIED | `atomicWriteSkillFile` 为唯一写路径；独立探针注入 `renameFile` 失败 → throw 且 `managed-skills/<name>/` **不存在**（零半成品） |
| 7 | SC4：不触及 `ai-memory/`、`attachments/`、`skills/` | ✓ VERIFIED | 独立探针：三目录 create+update+delete 前后 `snapshotTree` 深比较逐字不变 |
| 8 | SC5：工具描述含两条引导文案且不进 REALM_SYSTEM_PROMPT | ✓ VERIFIED | 两条文案均在 `description` 内（探针断言） |
| 9 | create 独占创建：已存在即拒且不落盘，四类来源给不同原因码 | ✓ VERIFIED | 55 例覆盖 + create 路径读盘判定（`resolveManagedTarget`，先于任何写盘） |
| 10 | 字段分离扫描（description 两组 / content 一组）+ 先扫描后净化 | ✓ VERIFIED | `scanSkillText` 传 `includeCredentials`；create/update 严格 scan→sanitize；55 例 + threat-scan 回归 |
| 11 | 数量闸只约束 create、seeded 不计入、update/delete 不受限 | ✓ VERIFIED | `countManagedSkills` 读盘且排除 seeded；闸在 create 路径 |
| 12 | 标记形状固定 `{action,name,tier?,code?,promptIncluded?}`：终态三键在 end **并入** | ✓ VERIFIED | **本 run 从源码抽取渲染端赋值表达式的字面文本并真实求值**（非子串扫描）：真实两时点载荷下终态 `{action:'create', name:'commit-style', tier:'managed', promptIncluded:true}`，`MANAGE_SKILL_ACTION_LABEL['create']` 可解析 ⇒ 卡片技能变体可达；不带标记的迟到 update 事件不抹标记。反向变异：`prev=null` 与覆盖语义**均**复现旧的崩塌形态（证明该断言可失败） |
| 13 | 重开对话后卡片形状与实时链路逐字一致（成功行 / 失败行） | ✓ VERIFIED | **本 run 驱动真实主进程函数**（`_resolveManageSkillMarker` / `_resolveManageSkillTerminal` / `_buildManageSkillDecoration` / `_manageSkillTerminalFromStored`）：成功行与失败行**键集合与取值逐字相等**（`{action,name,tier,promptIncluded}` / `{action,name,tier,code}`）；失败原因码经持久化词缀真实还原（`seeded_protected`）。见下方 WR-07 关于「工具从未执行」这一更宽类的偏差 |
| 14 | [backstop] 最小面板宽度下卡片头部单行不换行、徽标与短原因完整可读 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `flex-shrink` / `white-space` 声明存在（presence+wiring 可证），但单行成立是运行时视觉裁决 —— 非可推断判据，见 Human Verification / behavior_unverified_items |

**Score:** 13/14 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `ai-skills-manager.js` | 校验器 / 净化 / 扫描单点 / YAML 标量编码 / 组装全文闸口 / 三动作 / 原子写；零 electron 依赖 | ✓ VERIFIED | `yamlScalar:100-105`（单引号 + 撇号双写 + 换行归一化）；`buildSkillFileText:1204` 用之；`validateSkillFileSize:1231-1245` 对**组装全文**测字节；create:1443-1444 / update:1558-1559 净化后复验；`getSkillPromptIncluded:1651-1656` 三态；纯 Node 可 require（55 例通过） |
| `ai-manager.js` | 工具项 + 两时点标记 + 刷新链 + 三动作转发 + 词缀 encode/decode + 三态消费侧 | ✓ VERIFIED | `MANAGE_SKILL_CODE_TAG:161`（encode:6317-6320 / decode:1847-1848 同常量）；`_buildManageSkillDecoration:1768-1781` 单构造函数；三态消费侧:6266-6300 |
| `src/skill-picker-model.js` | `mergeManageSkillMarker` 纯函数 + 三张白名单表 | ✓ VERIFIED | `mergeManageSkillMarker:425-429` 契约（入参为空回退、不修改入参、新对象）；双模式导出；105 例通过 |
| `src/renderer.js` | 事件映射经共享合并函数并入 | ✓ VERIFIED | `:9378-9385` 条件并入，`prev = existing.manageSkill`（本 run 求值验证） |
| `tests/test-manage-skill.js` | 55 例 | ✓ VERIFIED | 实跑 **55/55 pass / 0 fail** |
| `tests/test-ai-skills.js` | 177 例 | ✓ VERIFIED | 实跑 **177/177 pass / 0 fail**（但见 WR-05：M3 仍为子串扫描） |
| `tests/test-skill-picker-model.js` | 105 例 | ✓ VERIFIED | 实跑 **105/105 pass / 0 fail** |
| `docs/product/ai-skills.md` + `AGENTS.md` | §11.3/§11.7/§11.8 纠偏 + 四条不变式 + 例数账本 | ✓ VERIFIED | §11.8 命名空间分账正确（48 号五项原样挂账 + 49 号闭合另起一句）；例数一致性命令实跑 `cells=8 measured={55,177,105}` 通过，且**可失败**（注入一条 999 的假账本单元 → 非零退出并指名 `AGENTS.md:605 test-manage-skill.js`） |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| 工具 execute | ai-skills-manager 三动作 | `getAiSkillsManagerLazy()` 转发 | ✓ WIRED | 判定全在 manager（单份实现）；ai-manager.js 内 `function (create\|update\|delete)ManagedSkill` 计数 = 0 |
| 三动作 | 刷新链 | `await this.syncAgentSystemPrompt()` 恰一次 | ✓ WIRED | create/update/delete 共用同一句 |
| seeded 集合 | 三动作判定 | `getSeededSkillNamesSafe()` → `seededNames` | ⚠️ PARTIAL | 注入签名正确、零 electron 保持；**生产注入值本身无自动化断言**，且降级为空集合时保护完全消失（见 coincidental_reliance_items） |
| start 事件 | renderer 新条目分支 | `event.manage_skill` → `manageSkill` | ✓ WIRED | snake_case 一致；新条目分支 push 基础标记 |
| end 事件 | renderer 已存在条目分支 | `mergeManageSkillMarker(existing.manageSkill, event.manage_skill)` | ✓ WIRED | 本 run 抽取字面表达式求值确认并入语义与参数顺序 |
| 失败消息 | 重载链路原因码 | `[code] ` 词缀 → `MANAGE_SKILL_CODE_TAG` 解析 | ✓ WIRED | decode 侧本 run 驱动真实函数验证；encode 侧当前可达面全部落在白名单九码（但谓词本身过宽 —— WR-08） |
| 实时链路 / 重载链路 | 卡片标记 | 共用 `_buildManageSkillDecoration` | ✓ WIRED | 单一构造函数 ⇒ 已执行行（成功 / 失败）不可能漂移；未执行类见 WR-07 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 卡片标题 / 徽标 / 标注 | `toolExecution.manageSkill` | 主进程两时点事件标记（并入语义已修复） | 真实 | ✓ FLOWING |
| 参数摘要 | `toolExecution.params` | 持久化的工具参数 | 真实（仅 `manageSkillOk` 为真时构建，现可达） | ✓ FLOWING |
| SKILL.md 正文 | `buildSkillFileText({name, description: yamlScalar(...), content})` | 工具入参 | 真实，且 YAML 标量编码已被 25 条对抗输入验证无损往返 | ✓ FLOWING |
| 失败短原因 | `MANAGE_SKILL_SHORT_REASON[code]` | 持久化词缀 → decode | 真实（已执行行）；旧行无词缀时省略键（宁缺勿猜，已声明） | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 1–3. description 对抗值域（25 条，含 5 条注入尝试）+ 3 条纯零宽拒绝 | `node /tmp/v49-gap1.js` | 25/25 往返无损或正确拒绝；**零幽灵** | ✓ PASS |
| 4. 字节闸边界（恰好 65536 / 65537）+ 对照组 | `node /tmp/v49-gap1.js` | 65536 放行并可加载；65537 `oversize` 且零残留；对照组放行 | ✓ PASS |
| 5. `getSkillPromptIncluded` 三态 | `node /tmp/v49-gap1.js` | 命中 → boolean；未命中 → `undefined` | ✓ PASS |
| 6. 渲染端并入字面语义（抽取源码求值 + 真实载荷） | `node /tmp/v49-gap2.js` | 成功行 `{action,name,tier,promptIncluded}`；迟到无标记事件不抹标记；失败行含 `code` | ✓ PASS |
| 7. 变异敏感性：`prev=null` / 覆盖语义 | `node /tmp/v49-gap2.js` | 两者均复现旧崩塌 ⇒ 该断言可失败 | ✓ PASS（证明可失败） |
| 8. 实时 vs 重载键集合（成功行 / 失败行 / 名称缺集行） | `node /tmp/v49-gap3.js` | 三条均键集合与取值逐字相等 | ✓ PASS |
| 9. SC2–SC5 回归（工具 schema / 确认卡片 / seeded 三入口 + 反向例 / 工作区隔离 / 原子写失败清理 / 引导文案） | `node /tmp/v49-sc.js` | 16/16 | ✓ PASS |
| 10. 三套件存在性与全绿 | `node tests/test-manage-skill.js` · `node tests/test-ai-skills.js` · `node --test tests/test-skill-picker-model.js` | 55/55 · 177/177 · 105/105 | ✓ PASS |
| 11. 例数账本一致性判据 | `docs/product/ai-skills.md` §11.8 的命令 | `counts-parity ok cells=8 measured={55,177,105}` | ✓ PASS |
| 12. 判据可失败性（账本扰动） | 临时注入 `test-manage-skill.js 999 例` 后重跑 | 非零退出 + `AGENTS.md:605 … 取到 [999] ≠ 实测 55`；文件已还原（sha 一致） | ✓ PASS |
| 13–14. 49-05 声称的两条守卫失败路径（变异测试） | 变异①渲染端回覆盖写法 → `M3` 红（176/1）；变异②共享函数改覆盖语义 → `M5b`/`M5c`/`M2d` 红、`M3` 绿 | 与计划声称**逐条一致**；两文件均已按 sha 还原 | ✓ PASS |
| 15. 守卫强度反证（WR-05） | 变异③渲染端把 `prev` 传 `null` | **177 pass / 0 fail + 105 pass / 0 fail —— 全绿** | ⚠️ 复现（WR-05） |
| 16. WR-07 键集合分歧（「工具从未执行」类） | `node /tmp/v49-gap3.js` 场景 E | live `{action,name}` vs reload `{action,name,tier}` | ⚠️ 复现（WR-07） |
| 17. 50-01 P3 不回显被拒内容 | 内联探针（description / content 各注一条注入串） | 两次均 `unscannable` 且消息**不含**被拒原文 | ✓ PASS |
| 18. WR-08 词缀编解码谓词不对称 | 真实 decode 函数 + 源码可见 encode 谓词 | `[ENOENT] x` → `code=undefined`；`[SCREAMING] x` → `undefined`；`[a] [b] msg` → `a` | ⚠️ 复现（WR-08） |

**注**：套件全绿在本阶段**不是**目标达成的证据 —— 前一轮正是「41/172/99 全绿却漏掉三条 Critical」。本 run 的结论全部建立在上表的独立对抗探针与真实函数驱动之上。

### Probe Execution

无 phase 声明的可执行探针（PLAN/SUMMARY 未声明 probe，phase 不含 `scripts/*/tests/probe-*.sh`）→ 不适用。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MGMT-01 | 49-01, 49-02, 49-04, 49-05 | AI 拥有 `manage_skill` 工具，支持 create / update / delete | ✓ SATISFIED | 工具项就位 + 三动作落地 + 刷新链恰一次 + 卡片终态变体可达（truth #1/#12） |
| MGMT-02 | 49-01, 49-04 | 不接受 `path`，只接受 `name`/`content`/`description`；路径由 manager 计算 | ✓ SATISFIED | 键集合逐字核对；`managedSkillPaths` 用 `path.join`；description 值域由 YAML 标量编码闭合 |
| MGMT-03 | 49-01, 49-04 | 服务端二次校验 name/description/正文字节上限；写入走原子写 | ✓ SATISFIED | 三个校验器 + 净化后复验 + `atomicWriteSkillFile`；写侧闸口与加载期同量（65536/65537 边界实测） |
| MGMT-04 | 49-01 | seeded 不可被覆盖或删除（按播种登记表） | ✓ SATISFIED | 三入口 `seeded_protected` + 反向例 + 内容零改动（truth #5）；生产注入接线见 coincidental_reliance_items |
| MGMT-05 | 49-01, 49-02, 49-05 | 成功后刷新技能集与 system prompt | ✓ SATISFIED | L1 用例（忙时置脏 → 成功出口回写 + 广播恰一次） |
| MGMT-06 | 49-01 | 工具描述引导「优先增强已有技能」 | ✓ SATISFIED | 两条文案在 `description` 内 |

**孤儿需求检查**：REQUIREMENTS.md 映射到 Phase 49 的 ID 为 MGMT-01..06；49-01 声明全部六个，49-02 声明 MGMT-01/05，49-03 声明空，49-04 声明 MGMT-01/02/03，49-05 声明 MGMT-01/05，**无 ORPHANED**。

**⚠️ 账本陈旧（代码事实为准，本 run 重新推导）**：`REQUIREMENTS.md` 第 45/47 行与第 140/142 行仍把 **MGMT-04 / MGMT-06 标为 `[ ]` / `Gaps Found`**，但两者在代码中均已达成（见上表证据）。这是**账本污染而非代码缺口**。下游动作（由 orchestrator 执行，**不是本 verifier 的写权**）：

```bash
node "$HOME/.codebuddy/gsd-core/bin/gsd-tools.cjs" requirements mark-complete MGMT-04 MGMT-06
```

（任务简报提到 gap-planning 轮的 `requirements.mark-complete MGMT-01/MGMT-03` 是 no-op —— 实测这两行当前为 `[x]` / `Complete`，与代码一致，故仅 MGMT-04 / MGMT-06 需要补记。）

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/test-ai-skills.js` | 3904-3920（M3） | 仍是子串扫描（断言标识符存在 + 旧写法不存在），**不约束 `prev` 实参** | ⚠️ Warning | 变异实证：一个完整的 CR-01 回归通过 282 例（WR-05）。代码本身正确；这是守卫强度债 |
| `ai-manager.js` | 6317-6320 vs 1847-1848 | encode 谓词（任意非空字符串）非 decode 谓词（`^\[([a-z_]+)\]\s`）的逆 | ⚠️ Warning | `[ENOENT]`/`[SCREAMING]` 产生永久不可解码噪声；`[a] [b] msg` 可产生（WR-08）。「只含白名单原因码」在 AGENTS.md 不变式③与 §11.3 被声明为强制，实际未强制 |
| `ai-manager.js` | 1800-1813 vs 1836-1855 | 两链路在「工具从未执行」类上键集合分歧（live 无 tier / reload 有 tier） | ⚠️ Warning | 会话内无徽标、重开后多出徽标（WR-07）。既有口径、非本轮引入；`tier` 的 reload 侧来源是唯一成因 |
| `ai-manager.js` | 6297-6300 | `promptIncluded === undefined` 时不追加任何说明 —— 幽灵写入（若发生）报无保留的成功 | ⚠️ Warning | 前一轮的失实后缀（预算已满 / 仍可用）被删且**未补真话**；本 run 无法构造幽灵生产者，故为残余风险（WR-06） |
| `ai-manager.js` | 6290-6292 | 成功文案偏离 UI-SPEC 权威清单（实为「它从下一条消息起对模型可见。」） | ⚠️ Warning | 用户可见文案与契约不一致（WR-03，前轮即挂账） |
| `ai-skills-manager.js` | 1500 | `const madeDir = true;` 死代码；`createDir` Result 未检 | ℹ️ Info | 失败归因可能误报（IN-01，前轮挂账） |
| `ai-manager.js` | 156-161 | JSDoc 声称「源码门禁按此断言 MANAGE_SKILL_CODE_TAG」—— 该门禁不存在（`tests/` 内零引用） | ℹ️ Info | 文档过度声称（IN-08） |
| `.planning/REQUIREMENTS.md` | 45, 47, 140, 142 | MGMT-04 / MGMT-06 标为未完成，与代码事实不符 | ℹ️ Info | 账本污染；会导致下游误判阶段未完成 |
| `docs/product/ai-skills.md` | §11.8 | 「仍逐条挂账」清单未含本轮新开的 WR-05…WR-08 / IN-07…IN-09 | ℹ️ Info | 挂账清单写于 re-review 之前；建议下一轮补记 |

**债务标记门禁**：本阶段改动文件内**无**无引用的 `TBD`/`FIXME`/`XXX` 债务标记。三处 `XXX` 命中均为 `tmp-XXXXXX` 占位符（注释与测试断言）与 `ai-manager.js:526/563` 的工具描述占位词（git blame 证实早于本阶段一个月）—— 均不构成门禁触发。

### Human Verification Required

见 frontmatter `human_verification`（3 项）。摘要：

1. **端到端 LLM 往返可见性**（ROADMAP SC1 的唯一端到端证据）—— 断言点是**下一条消息**而非工具返回时；步骤与期望现象预写在 49-VALIDATION.md 五步表。
2. **卡片终态视觉面**（步骤①）—— 与前次报告的关键差异：CR-01 已被机械证明修复，该作业**现在可以执行**（前次明确写「修复前必然失败」）。
3. **backstop 最小宽度单行不换行**（步骤⑤）—— 视觉裁决，见 `behavior_unverified_items`。

### Gaps Summary

**无 gap。** 前一轮的三条 gap 全部独立复验为**真实闭合**，且闭合方式经得起「构造实现从未见过的输入」这一标准：

- **Gap 1（幽灵技能，previous truth #2）→ 闭合。** `description` 现经 YAML 单引号标量编码（撇号双写、换行归一化）；净化后对净化值复验非空（create:1443 / update:1558 两处）；写侧权威闸口改测**组装后的 SKILL.md 全文**。25 条对抗 description（含 5 条 frontmatter 注入尝试与 6 类裸标量）全部往返无损或正确拒绝 —— **零幽灵**；字节闸在 65536/65537 的精确边界上与加载期同量，且对照组证明拒的是字节而非长度；`getSkillPromptIncluded` 三态就位（未命中 → `undefined`，不再冒充 `false`）。前一轮的失实说明（「预算已满 + 仍可用 /skill:x」）不再产生。

- **Gap 2（终态标记崩塌，previous truth #12）→ 闭合。** 渲染端已改为条件并入，且并入逻辑单源在 `src/skill-picker-model.js` 的 `mergeManageSkillMarker`。本 run **抽取渲染端赋值表达式的字面文本并真实求值**（不是子串扫描）：真实两时点载荷下终态保留 `action`/`name` 并叠加终态三键，`MANAGE_SKILL_ACTION_LABEL['create']` 可解析 ⇒ 卡片技能变体可达；不带标记的迟到 update 事件不会抹掉标记。

- **Gap 3（两链路形状不一致，previous truth #13）→ 闭合（成功行 / 失败行）。** 本 run 驱动**真实主进程函数**（非转述）：成功行与失败行两条链路的键集合与取值**逐字相等**；失败态原因码经消息词缀真实落库并由重载链路用同一常量还原（`seeded_protected` 可复原），失败历史卡片不再永久丢失短原因。

**前一轮判为 VERIFIED 的 10 条 truths 全部通过回归**（SC2 接口面、SC2 服务端校验、SC3 seeded 三入口 + 反向例、SC4 原子写 + 工作区隔离、SC5 引导文案、字段分离扫描与顺序铁律、数量闸、刷新链机制、create 独占）。**无回归。**

**本轮新开、但判为「技术债而非目标未达成」的 4 条**（WR-05 / WR-06 / WR-07 / WR-08，全部来自 `49-REVIEW.md` 并已由本 run 独立复现其中三条）：

- 它们**均不影响** phase goal 的两半 —— ① AI 能自主 create/update/delete 自己的技能（truth #1–#6、#9–#11）；② 无法覆盖或删除随包内置技能（truth #5：三入口一致拒绝、内容零改动）。
- WR-05 是**守卫强度**债（代码正确，守卫抓不住回归）；WR-06 是**残余风险**（幽灵生产者已无法构造，本 run 30 条对抗输入零幽灵）；WR-07 是**未执行类**的卡片装饰偏差（既有口径，不影响能力）；WR-08 是**词缀谓词不对称**（当前可达面全落在九码白名单内）。
- 四条的修法都已在 `49-REVIEW.md` 中给出，且都在本阶段已声明的文件范围内，无范围蔓延。

**无 deferred 项**：Phase 50（设置页技能管理区）与 Phase 51（zip 导入管线）的 Goal 与 Success Criteria 均不覆盖上述任一条，故不适用 Step 9b 的延后匹配。

**状态为 `human_needed` 的成因**：`behavior_unverified` = 1 的 backstop 判据（最小面板宽度单行不换行）是**非可推断**的视觉裁决，presence+wiring 永不合格；叠加上 49-VALIDATION.md 层 2 明文声明「下一条消息即对模型可见」必须由真实 LLM 往返裁决。二者都不得由层 1 证据替代，故按 decision tree 规则 2 判 `human_needed`，不判 `passed`。

**下一步动作**：执行 49-VALIDATION.md 的五步人工表（`/gsd:verify-work` 49），重点是步骤②（下一条消息可见）与步骤⑤（backstop 最小宽度）；同时由 orchestrator 补记 `requirements mark-complete MGMT-04 MGMT-06` 以消除账本陈旧。

---

_Verified: 2026-09-13T12:59:34Z_
_Verifier: Claude (gsd-verifier)_

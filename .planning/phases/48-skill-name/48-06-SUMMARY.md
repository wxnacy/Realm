---
phase: 48-skill-name
plan: "06"
subsystem: ai
tags: [electron, skill-invocation, gap-closure, renderer, source-of-truth, docs-closure, plan-text-revision, node-test]

# Dependency graph
requires:
  - phase: 48-skill-name
    provides: "48-04：`readSkillForInvocation` 的目录路径判据 + 注入名重写（G-48-2）；48-05：`buildUserMessageContent` 单源 + 回填后定向刷新 + 取消锚点（G-48-6 / G-48-4）"
  - phase: 46-prompt
    provides: "技能集单一数据权威与主进程收窄投影 `getSkillsForUI`（本计划只消费，不重算）"
provides:
  - "src/renderer.js：发送路径**零本地否决** —— 技能分支只剩「按 kind 分流 → 记录 ref → 中止上一轮 → 就地复位流式状态」四步；存在性/启停一律由主进程在调用那一刻读盘裁定"
  - "src/renderer.js：`skills:changed` 广播到达即**无条件** `pullAiSkillsSnapshot()`（去掉面板关闭早退），仍**绝不**触发 `refreshSkills()`（自激回路 P-48-06 不回归）"
  - "tests/test-skill-picker-model.js + tests/test-ai-skills.js：断言同步为「渲染端不含两条失败文案」+ 跨文件断言主进程 `skillErrorFromReason` 仍是判定与文案的唯一来源"
  - "docs/product/ai-skills.md：§10.3 补判定面 / §10.4 表下补两条注 / §10.7 旧限定改述为「无条件重拉」+ 追加两条 / §10.8 新小节「用户气泡契约（技能调用）」/ §七 测试清单补 `test-ai-cancel-state` 并回填实测例数"
  - "AGENTS.md：技能域测试清单登记 `node --test tests/test-ai-cancel-state.js` 并补 `test-skill-picker-model.js` 覆盖面（`:272` 维护约定的执行）"
  - ".planning/phases/48-skill-name/{48-01,48-02}-PLAN.md + 48-VALIDATION.md：G-48-2 / G-48-3 修订注记，每处旧措辞以「已被 G-48-x 取代」归档（48-02 的两处 frontmatter 内命中以**行内折进引号标量**留档）"
affects: ["49-manage-skill", "50-settings", "51-import", "48 阶段收尾（covered_digest 须重算）"]

# Actuals (#2632) — 与 PLAN 的 estimate 同尺度（chars/4 over realized diff）
actuals:
  tokens: 5290
  tasks: 2
  commits: 2
plan_head_before: 9bec8e879630d77220c691df3be113637968c931

tech-stack:
  added: []
  patterns:
    - "**冗余前置闸门是缺陷而非优化**：本地预检与主进程产出**逐字相同**的失败文案时，它不是「省一次 IPC」而是一条独立的、会用陈旧缓存授权/否决的判定路径 —— 删除它用户可见行为零变化，但「实时读盘」恢复为唯一判定路径"
    - "**「读侧缓存不得参与授权」的落地形态**：快照保留（面板首帧需要它），但发送路径对它零读取 —— 用源码断言（section 内不含 `state.aiSkills`）而非约定来钉死"
    - "**删除本地判定时同步加跨文件护栏**：两侧文案逐字相同意味着两侧可被同时删掉而不被发现 —— 断言「主进程仍含两条字面量」+「渲染端不含」把单源变成可失败的门"
    - "**计划文本修订必须留删除痕迹**：每处改述都带 `（G-48-x 修订，日期）` 标记 + 紧随其后的「（原文：…，已被 G-48-x 取代）」归档，禁止静默改写历史"
    - "**frontmatter 内的修订只能行内折进**：引号标量内部紧贴收尾 `\"` 之前，绝不新增物理独立行、绝不把留档追加到引号之外（两种错法实测都会让 `frontmatter.validate` 报 8 个必需字段全 missing）"
    - "**注释位置是硬约束**：300 字符窗口断言会让「写在处理器体之后的解释性注释」把 `refreshSkills` 字面量带进窗口 —— 解释一律留在挂载点**之上**"

key-files:
  created: []
  modified:
    - src/renderer.js
    - tests/test-skill-picker-model.js
    - tests/test-ai-skills.js
    - docs/product/ai-skills.md
    - AGENTS.md
    - .planning/phases/48-skill-name/48-01-PLAN.md
    - .planning/phases/48-skill-name/48-02-PLAN.md
    - .planning/phases/48-skill-name/48-VALIDATION.md

key-decisions:
  - "删除而非折中：不做「先查快照、未命中再问主进程」的妥协 —— 该折中的未命中分支仍会让陈旧快照吞掉运行期新增技能（PLAN prohibition 明文，UAT 2026-09-12 方案 A 背书）"
  - "失败通道唯一化：`skillErrorFromReason`（主进程）→ `_resolveSkillInvocation` 的 `{skillError}` → IPC → `removeSkillFailureBubbles(userMsgId)` + `pushSystemNote(result.skillError.message)` 成为**唯一**判定与文案通道；用户可见契约（一条 system-note + 零残留气泡）直接由它承担，不需要渲染端参与判定"
  - "注释不写 `state.aiSkills` 字面量：测试把「函数体内不得出现该字面量」当作判据（含注释、因 F 组按整函数体取文），故注释改述为「技能集快照可能陈旧」——与 PLAN Task 1 步骤 2 给定措辞一致"
  - "`skills:changed` 的「为什么不重扫」解释留在 `onIpcMessage('skills:changed'` 行**之上**：两条既有断言各取该行后 300 字符并断言其中不含 `refreshSkills`，把解释写进处理器体或紧随的预热注释都会让这两条门变红"
  - "启动预热**保留**，只改理由（预检误判 → 面板首帧零延迟、不闪空态）；同一挂载点「至少两次 `pullAiSkillsSnapshot()`」的断言逐字不动"
  - "48-01 里纯术语残留（`:220` / `:451`，以及 `:92` / `:321` / `:336` / `:351` / `:373` / `:406` 的「预检所得」）**不动** —— 计划的 artifacts 已明示「只认术语不改语义→不动，避免无关 diff」；这些句子的**数据流要求未变**（args 仍来自技能分支）"
  - "48-02 的 5 处命中按 `grep` 实测重推（不沿用固定行号清单）：`:35` / `:61` 在 frontmatter 内（折进引号标量），`:202` / `:238` / `:435` 在正文（行末追加）；旧清单里「空的」`:59` / `:123` 明确不动（不含该措辞）"
  - "48-VALIDATION.md 只走「结构不变式」探针：`--schema verification` 要求 `verified` / `score` 字段，对该文件实测不适用；`plan` **不是**它的正名"

patterns-established:
  - "「本地冗余判定删除」的三件套：删分支 → 源码断言「section 内零读取」→ 跨文件断言「权威侧仍在」"
  - "计划文本修订的行内折进法（frontmatter 安全留档）：`「…（原文：…，已被 G-48-x 取代）」` 全部落在同一物理行的引号内"
  - "文档收口的「正向 + 反向」双探针：既断言新区间**含**新口径字面量，又断言全文**不含**旧限定字面量（防「两处并存」与「只删不写」）"

requirements-completed: [DISC-02, DISC-06]

coverage:
  - id: D1
    description: "G-48-3：发送 `/skill:<name>` 时渲染端不做任何存在性/启停判定 —— 请求一律发到主进程当场读盘裁定；不存在 / 已禁用的用户可见结果与修复前逐字相同（同一条 system-note、零残留气泡）；`skills:changed` 到达即无条件重拉快照且仍不触发重扫"
    requirement: DISC-06
    verification:
      - kind: unit
        ref: "node -e 内联探针：`handleSendAIMessage` 至流式守卫的函数体不含 `state.aiSkills` / `known.disabled`、含 `abortAIIfStreaming(` → `send path has no local veto`"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#技能分支：只按 kind 分流，无本地否决（48 G-48-3）／#skills:changed 监听：无条件重拉快照、绝不触发刷新（P-48-06 / G-48-3）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#handleSendAIMessage：技能分支位置在 aiStreaming 守卫之前 + 无本地否决（G-48-3）／#state.aiSkills / state.aiSkillsDigest 仍建立（面板数据源），但发送路径不得读它（G-48-3）／#skills:changed 广播处理器：无条件重拉快照、绝不触发刷新（P-48-06 / G-48-3）"
        status: pass
      - kind: unit
        ref: "node --check src/renderer.js && node --test tests/test-skill-picker-model.js → # pass 95 / # fail 0；node tests/test-ai-skills.js → # pass 132 / # fail 0；node --test tests/test-ai-cancel-state.js → # pass 14 / # fail 0"
        status: pass
      - kind: unit
        ref: "48-01-PLAN.md 的 Task 3 源码门原样重跑 → `listener-ok`（早退断言反转后与实现不再互相矛盾）"
        status: pass
    human_judgment: true
    rationale: "「运行期新增技能 + 从未打开过 `/` 面板 → 手打 `/skill:<新名>` 真的可调用」是**运行时**行为（主进程重扫 → 广播 → IPC 往返），node:test 只覆盖源码契约与断言。最终证据是重跑 `/gsd-verify-work 48` 的自动驱动探针（在 `managed-skills/` 下新建目录后**不打开** `/` 面板，直接手打），已在 `.planning/WINDOWS.md` 登记为 unrun-verify（id 24）。"
  - id: D2
    description: "文档与计划文本收口：`docs/product/ai-skills.md` 的 §10.3 / §10.4 表下注 ×2 / §10.7（改述 + 两条）/ §10.8 新小节 / §七 测试清单全部落地且旧表述不并存；`48-01-PLAN.md` / `48-02-PLAN.md` / `48-VALIDATION.md` 的旧要求已按 G-48-3（及 48-01 Task 1 按 G-48-2）修订并留「已被取代」归档；`48-04-PLAN.md` 的 `read_first` 行窗口与实测跨度一致；`AGENTS.md:267` 测试清单已登记 48-05 新建的 `tests/test-ai-cancel-state.js`"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "门 1：三份计划/验证文本均含 `G-48-3` → `G-48-3 markers present in all three`"
        status: pass
      - kind: unit
        ref: "门 2：48-02 的 5 处「技能预检」全部带「已被 G-48-3 取代」且文件含新措辞「技能调用分支」→ `48-02 wording revised, archived mentions=5`"
        status: pass
      - kind: unit
        ref: "门 3：48-01 / 48-02 的 `frontmatter.validate --schema plan` 与 `verify.plan-structure` 双双 `true`；四份文件 frontmatter 闭合行 = 85 / 89 / 48 / 10 未移动；48-04 read_first 含 `:48-55` + `:1426-1436` 且不含旧窗口"
        status: pass
      - kind: unit
        ref: "门 4：docs §10.7 区间含「无条件重拉」、全文不含「仅在面板打开时」、`### 10.8` 位于 §10.7 之后、AGENTS.md 含 `tests/test-ai-cancel-state.js`"
        status: pass
    human_judgment: true
    rationale: "四条门都是**源码/文本**判据，可自动判红绿；但「散文表述是否准确反映了实现语义」这一层仍需人（或 `/gsd-verify-work 48` 的文档核对）确认。本计划把可机器判定的部分全部钉成门，剩下的是陈述性判断。"
  - id: D3
    description: "`48-04-PLAN.md` Task 2 的 `read_first` 行窗口校准（`:45-55`→`:48-55`、`:1424-1434`→`:1426-1436`）"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "实测：`grep -n \":48-55\\|:1426-1436\\|:1424-1434\\|:45-55\" .planning/phases/48-skill-name/48-04-PLAN.md` 只命中新窗口；且该行最后一次改动来自 `0a022a7`（本计划执行**前**已由上一轮计划文本修订提交落地）"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 06: 渲染端技能本地否决移除 + 文档/计划文本收口（G-48-3）Summary

**发送路径的两段本地否决被删除，`/skill:<name>` 一律由主进程在调用那一刻读盘裁定（失败经既有 `skillError` 回滚，用户可见文案逐字不变）；`skills:changed` 改为无条件重拉快照；产品文档与三份 48 阶段计划/验证文本按 G-48-2 / G-48-3 修订并逐处留档，`AGENTS.md` 测试清单补登记 48-05 新建的取消归属测试**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-12T12:01:16Z
- **Completed:** 2026-09-12T12:07:00Z
- **Tasks:** 2/2
- **Files modified:** 8（`src/renderer.js`、`tests/test-skill-picker-model.js`、`tests/test-ai-skills.js`、`docs/product/ai-skills.md`、`AGENTS.md`、`48-01-PLAN.md`、`48-02-PLAN.md`、`48-VALIDATION.md`）+ `.planning/WINDOWS.md`（缺陷登记，随元数据提交）

## Accomplishments

- **G-48-3 闭合（源码面）**：`handleSendAIMessage` 的技能分支从「查快照 → 未命中/已禁用 → 清空输入框 + 本地 system-note」缩成四步（按 kind 分流 → 记录 `ref` → `await abortAIIfStreaming()` → 就地复位 `aiStreaming` / `aiCurrentMessageId` / 发送按钮）。请求从此**一定**到达主进程，其「调用那一刻实时读盘」成为唯一判定路径；失败由主进程 `skillErrorFromReason` 产出的文案经既有 `removeSkillFailureBubbles` + `pushSystemNote` 链路呈现 —— **用户可见结果零变化**（PLAN 已核实两侧文案一字不差）。
- **快照对发送路径的否决权被解除**：`state.aiSkills` / `state.aiSkillsDigest` **保留**（`/` 面板首帧的同步数据源），但 `grep -n "state.aiSkills" src/renderer.js` 的命中全部落在面板侧（`pullAiSkillsSnapshot` / `openSlashPicker` / `renderSlashPickerList`）与 state 声明，**不再落在** `handleSendAIMessage` 内。
- **`skills:changed` 无条件重拉**：删去 `if (!state.slashPickerOpen) return;`，处理器体只剩 `pullAiSkillsSnapshot();`；`renderer` 全文件 `.refreshSkills(` 计数仍为 **1**（仅 `openSlashPicker` 的 stale-while-revalidate 后半边）—— 自激回路 P-48-06 不回归。启动预热保留，理由改写为「面板首帧零延迟、不闪空态」。
- **单源变成可失败的门**：新增/改写的断言把「渲染端不含两条失败文案」与「主进程 `skillErrorFromReason` 仍含两条文案字面量」成对钉住 —— 两侧不可能在被同时删除后无人发现（T-48-06-02 的缓解）。
- **产品文档全量收口**：§10.3 明写「存在性/启停判定只在主进程」；§10.4 表下补两条注（G-48-2 的目录名权威在显式调用路径的落地 / G-48-3 的两条失败文案唯一来源在主进程）；§10.7 的「仅在面板打开时」**整句消失**并改为「**无条件重拉**」+ 追加两条（广播到达即重拉 / 流式中调用技能不写取消文案且新气泡即时呈现）；新增 `### 10.8 用户气泡契约（技能调用）`；§七 补 `node --test tests/test-ai-cancel-state.js` 并**新增**（该条原本无条件例数）`node tests/test-ai-skills.js` 的实测例数标注（132 例，取自 48-04 SUMMARY 的实测输出）。
- **计划/验证文本与实现不再互相矛盾**：`48-01-PLAN.md` 的三处「要求渲染端早退」明文（`:361` / `:390` / `:400`）**全部反转**并留档；`48-02-PLAN.md` 的 5 处「技能预检」改述为「技能调用分支 · G-48-3 后渲染端无本地否决、存在性由主进程当场裁定」；`48-VALIDATION.md:75` 的矩阵行改述为新判据面。所有修订带 `G-48-x` 标记 + 「（原文：…，已被取代）」归档。
- **结构破坏可被本计划自带的门检出（且未发生）**：48-01 / 48-02 修订后 `frontmatter.validate --schema plan` 与 `verify.plan-structure` **双双 `true`**，四份被改文件的 frontmatter 闭合行 `85 / 89 / 48 / 10` 全部**未移动**；48-02 的两处 frontmatter 内命中以**引号标量内部行内折进**留档（未新增物理行、未把留档写到引号之外）。
- **项目指令文件维护约定被实际执行**：`AGENTS.md:267` 追加 `node --test tests/test-ai-cancel-state.js`（取消归属与用户气泡时序的纯逻辑用例 + renderer 接线护栏）并把 `test-skill-picker-model.js` 的覆盖面补为「…/ 三条接线扫描 / 气泡构建单源与回填后定向刷新」；`:272` 的维护约定文字未改（它是被执行的规则）。
- **48-01 自己的门与实现恢复一致**：把 `:390` 那条 `node -e` 原样重跑输出 **`listener-ok`**（反转后它断言「不得出现早退」，与 Task 1 落地后的实现吻合）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 移除渲染端本地否决 + 广播无条件重拉快照 + 两套断言同步** — `c6aac18` (fix)
2. **Task 2: 文档收口（产品文档全量 + 计划/验证文本修订注记）** — `062b7a0` (docs)

**Plan metadata:** 见下方「Plan metadata」提交（SUMMARY + STATE + ROADMAP + WINDOWS）

_Note: 本计划无 TDD 任务，两个任务各一次提交。_

实测（台账 `.git/gsd-plan-head-before-48-06` = `9bec8e879630d77220c691df3be113637968c931`）：
`git rev-list --count 9bec8e8..HEAD` = **2**，与 `actuals.commits` 一致。

## Files Created/Modified

- `src/renderer.js` —
  - `handleSendAIMessage` 斜杠分支：删去 `const known = …`（未命中 → 清空输入框 + system-note + `return`）与 `known.disabled === true` 两段本地否决；技能分支保留 `skillRef = ref; await abortAIIfStreaming(); state.aiStreaming = false; state.aiCurrentMessageId = null; updateSendButtonState(false);`，`else` 的未知命令分支与 `if (state.aiStreaming) return;` 逐字未动；注释改述为「不做本地否决（48 G-48-3）…」
  - `skills:changed` 监听（`initialize` 内）：去掉早退行、处理器体直接 `pullAiSkillsSnapshot()`；解释性注释留在挂载点**之上**（「无条件重拉快照」+「绝不触发 refreshSkills」）；启动预热的注释理由改写为面板首帧零延迟
  - `executeActiveSlashCommand` 的 JSDoc：`技能预检` → `技能分支`（术语一致性，不动语义）
- `tests/test-skill-picker-model.js` — C 组「技能预检分支：拒绝条件只有 `disabled === true`」改写为「技能分支：只按 kind 分流，无本地否决（48 G-48-3）」（区域取 `kind === 'skill'` → `} else {`，过滤 `//` 行后断言含 `abortAIIfStreaming(`、不含 `state.aiSkills` / `pushSystemNote(` / `disableModelInvocation` / 「已遮蔽」，并跨文件断言 `ai-manager.js` 仍含 `skillErrorFromReason`）；`skills:changed` 用例去掉早退断言、改断言处理器体内直接重拉（正则）且不含 `refreshSkills`；启动预热用例的断言保留、理由文案更新
- `tests/test-ai-skills.js` — F 组两条用例改写（位置断言保留 + 渲染端**不含**两条失败文案 + 跨文件断言主进程 `skillErrorFromReason` 内**仍含**两条文案字面量 + `state.aiSkills` 仍建立但发送路径不得读它）；G 组广播处理器用例去掉早退断言（其余含 `.refreshSkills(` 计数 1 保留）
- `docs/product/ai-skills.md` — §10.3 +1 条；§10.4 表下 +2 条注；§10.7 旧限定改述 + 两条追加；新增 `### 10.8 用户气泡契约（技能调用）`；§七 补一行 + `test-ai-skills.js` 条目补注「（132 例，实测）」（该条**原本无条件例数**，本例数为**新增**）
- `AGENTS.md` — 技能域测试清单（`:267`）追加 `test-ai-cancel-state.js` 条目 + 补 `test-skill-picker-model.js` 覆盖面；其余条目与 `:272` 不动
- `.planning/phases/48-skill-name/48-01-PLAN.md` — Task 1 的 `readSkillForInvocation` 判据（G-48-2）；Task 3 的 behavior 两条、①、②、⑥、⑧ 的测试要求、`<verify>` 源码门、`<acceptance_criteria>` 早退断言（G-48-3）
- `.planning/phases/48-skill-name/48-02-PLAN.md` — 5 处「技能预检」（`:35` / `:61` frontmatter 内折进引号标量；`:202` / `:238` / `:435` 正文行末留档）
- `.planning/phases/48-skill-name/48-VALIDATION.md` — `:75` 矩阵行改述 + `（G-48-3 修订，2026-09-12）`；覆盖命令列不变
- `.planning/WINDOWS.md` — 新增 1 条 `unrun-verify`（id 24）：G-48-3 的运行时行为只有源码契约可覆盖，最终证据为重跑 `/gsd-verify-work 48`

## Decisions Made

见 frontmatter `key-decisions`（9 条）。要点：删除而非「先查快照、未命中再问主进程」的折中；失败通道唯一化到主进程；注释里**不写** `state.aiSkills` 字面量（否则 F 组整函数体断言会红）；`skills:changed` 的解释性注释必须留在挂载点**之上**（否则两条 300 字符窗口断言会因 `refreshSkills` 命中而红）；48-01 的纯术语残留按计划明文不动；48-02 的命中按 `grep` 实测重推而非沿用固定行号。

## Deviations from Plan

**1. [Note · 环境性] 默认分支提交门禁在 `branching_strategy: none` 下不适用**

- **Found during:** Task 1（首次提交前）
- **Issue:** `git.base-branch --is-protected master` 返回 `true`，且 `.planning/config.json` **未**设 `git.allow_default_branch_commits`，按执行器协议字面要求应 HALT。但本项目 `workflow.branching_strategy: "none"` + `workflow.use_worktrees: false`，编排器本次亦明确要求「在**主工作树**上按顺序执行、用正常 git 提交、不得 `--no-verify`」，且 Phase 44–48 的全部计划提交（含 48-01…48-05）都落在 `master` 上。
- **Fix:** 按项目既有流程在 `master` 上提交；未新建分支、未改写分支、未执行任何 `git update-ref`。与 48-04 / 48-05 的同名说明一致，供收尾审计判断是否需在 config 补 `git.allow_default_branch_commits: true` 以消除字面误报。
- **Files modified:** 无（仅提交落点）
- **Verification:** `git log --oneline` 显示 `c6aac18` / `062b7a0` 与既有阶段提交同处 `master`。
- **Committed in:** `c6aac18`、`062b7a0`

**2. [Note · 非偏离] `48-04-PLAN.md` 的 `read_first` 行窗口**已是**当前值，本计划零编辑**

- **Found during:** Task 2 开工前的现状核对（`grep`）
- **Issue:** 计划 Task 2 第 7 步要求把 `tests/test-ai-skills.js:45-55` 刷成 `:48-55`、`:1424-1434` 刷成 `:1426-1436`；实测该行**已经是**新窗口（`:113` 现含 `:48-55` 与 `:1426-1436`，全文不含 `:45-55` / `:1424-1434`）。
- **Fix:** 无需编辑。溯源：该行最后一次改动来自 **`0a022a7`**「docs(48): 修订 48-06 计划文本编辑指令与门，刷新 48-04 read_first 行窗口」—— 即编排器/上一轮已按本计划的指令把它落地。**未重复应用**（避免无意义 diff 与行号二次漂移）。门 3 的四项窗口断言仍全过。
- **Files modified:** 无
- **Verification:** 门 3 → `planned files structurally intact + 48-04 read_first windows refreshed`
- **Committed in:** 不适用（已由 `0a022a7` 提交）

**3. [Note · 非偏离] 启动预热用例的**断言消息**随理由同步更新（断言本体逐字不变）**

- **Found during:** Task 1（改 `_picker` 测试时）
- **Issue:** 计划 Task 1 第 4 步写「`:442-449` 的启动预热用例**保留不动**」，但该用例的断言消息原文是「否则从未开过面板的用户手打 `/skill: 会被误判为未找到`」—— 本地否决删除后该理由**已失效**，与 must_haves 的「理由改为面板首帧零延迟、不闪空态」冲突。
- **Fix:** 只改断言 message 字符串（改为新理由），`(segment.match(/pullAiSkillsSnapshot\(\)/g) || []).length >= 2` 这条**断言本体逐字不动**、用例名与位置不动。红绿行为完全一致。
- **Files modified:** `tests/test-skill-picker-model.js`
- **Verification:** `node --test tests/test-skill-picker-model.js` → `# pass 95 / # fail 0`
- **Committed in:** `c6aac18` (Task 1 commit)

**4. [Note · 非偏离] 48-01 的纯术语残留按计划明文**不动**

- **Found during:** Task 2（改 48-01 时的全量 `grep "预检"` 复核）
- **Issue:** 除计划点名的行外，48-01 还有 8 处「预检」残留（`:92` objective / `:220` / `:321` Task 名 / `:327` research 引用 / `:336` behavior 第 3 条「取预检所得」/ `:351` 「上方预检所得」/ `:373` 「预检所得的 args 局部变量」/ `:451`）。
- **Fix:** 全部**不动** —— 与计划对 `:220` / `:450` 的明文一致（「**不是**『要求本地预检』的明文…本轮**只认术语不改语义**、**不动**（避免为术语一致性引入无关 diff）」）。这些句子的**数据流要求未变**（`args` 仍来自技能分支），改它们等于空改。
- **Files modified:** 无（记录于此供审计）
- **Verification:** 48-01 的 `frontmatter.validate --schema plan` / `verify.plan-structure` 双 `true`；`listener-ok`
- **Committed in:** 不适用

**5. [Note · 非偏离] 计划文本里的行号与实测有位移，Task 2 全部按**内容**定位**

- **Found during:** Task 1 / Task 2 取文时
- **Issue:** 计划给出的测试行号（picker `:302-325` / `:416-449`、ai-skills F 组 `:2158-2178`、G 组 `:2260-2272`）与当前实测不符，位移由 48-04 / 48-05 的提交造成（实测：picker `:302-325`（区域改写）/ `:483-507` / `:509-516`；ai-skills F 组 `:2259-2280`、G 组 `:2360-2372`）。
- **Fix:** 一律按**唯一内容**定位改写（计划本身也要求 48-02 的目标行「必须先实测重新推导，不得直接沿用任何固定行号清单」）；无一条断言因子移位而漏改。
- **Files modified:** `tests/…`（内容层面，非额外文件）
- **Verification:** 四条测试命令全绿（95 / 132 / 14，`# fail 0`）；三条内联探针输出预期串
- **Committed in:** `c6aac18`

---

**Total deviations:** 0 auto-fixed（5 条为环境性 / 已在别处落地 / 明文性说明，非计划偏离）
**Impact on plan:** 交付物与 `files_modified` 严格限于计划列出的 9 个文件（其中 `48-04-PLAN.md` 经核对**无需**编辑）；未触碰 `ai-manager.js`（只读核对文案唯一来源）、未改 `openSlashPicker` 的 stale-while-revalidate 链路、未删 `state.aiSkills` / `aiSkillsDigest`、未改 `48-VERIFICATION.md` 或任何其它阶段文件。无 scope creep。

## Issues Encountered

- **注释里的 `state.aiSkills` 会让 F 组断言变红（实测一次红）**：首版注释写「`state.aiSkills` 快照可能陈旧」，`tests/test-ai-skills.js` 的 F 组第 2 条（按**整函数体**取文、不过滤注释）随即 `# fail 1`。改为计划 Task 1 步骤 2 给定的措辞「技能集快照可能陈旧」（不含该字面量）后 `# pass 132 / # fail 0`。**注意**：Task 1 的内联探针把区域切到 `aiStreaming` 守卫之前、F 组取整函数体 —— 两者都含注释，故注释措辞本身就是被断言的接口。
- **300 字符窗口是硬约束（预防性核对）**：`onIpcMessage('skills:changed'` 之后 300 字符会覆盖到「启动预热」注释行。新写的预热注释刻意不含 `refreshSkills` 字面量；「为什么不重扫」的解释留在挂载点**之上**。两条既有 300 窗口断言（picker / ai-skills）均绿。
- **48-02 的 frontmatter 内修订**：按计划已验证的**行内折进**法（引号标量内部、紧贴收尾 `"` 之前；引旧措辞统一用 `「」`）落地 5 处后，`frontmatter.validate --schema plan` = `true`、`verify.plan-structure` = `true`、闭合行仍在 `:89`。计划里记录的两种错法（插入独立行 / 引号外追加）未使用。
- **文档收口的数字纪律**：`grep -n "129" docs/product/ai-skills.md` 零命中已核实 —— §七 的 `test-ai-skills.js` 条目**原本没有任何例数**，故本例数是**新增的实测标注**（132，取自 48-04 SUMMARY 的实测输出），不是「回填旧值」。**未**为了让数字对齐而改测试或改其它文档行。

## Known Stubs

None —— 本计划删除一段判定（本地否决）并改写文档/计划文本，不引入占位数据、空值流转或未接线组件。删除后由主进程 `skillErrorFromReason` 承担的失败通道是**终态实现**（不是 stub）；新增文档小节描述的行为均已由 48-05 的代码落地。对新增/改动行做过 `TODO|FIXME|XXX|coming soon|placeholder|not available|HACK` 扫描：零命中。

## Threat Flags

None —— 本计划未新增网络端点、鉴权路径、文件访问模式或 schema 变更。威胁登记表四项处置均按计划落地：**T-48-06-01**（DoS，high）由「删除两段本地否决 + 源码探针（发送路径零快照读取）+ 两条测试断言」缓解；**T-48-06-02**（Tampering，medium）由跨文件护栏缓解（主进程 `skillErrorFromReason` 必含两条文案 / 渲染端必不含，任一侧被删都变红）；**T-48-06-03**（Spoofing，low）维持 accept —— 被删的预检不承担安全语义，真正的防冒名判定在 `readSkillForInvocation`（48-04 加固）；**T-48-06-04**（Information Disclosure，low）维持 accept —— `realmAPI.ai.getSkills()` 仍只返回收窄投影（无正文 / 无 filePath / 无诊断），无条件重拉**不**新增暴露面。

## Next Phase Readiness

- **G-48-3 闭合（源码面 + 文档面）**：本阶段 4 个 gap（G-48-2 / G-48-3 / G-48-4 / G-48-6）已全部由 48-04 / 48-05 / 48-06 落地。运行时的最终证据待重跑 `/gsd-verify-work 48`：本计划新增的 `unrun-verify`（`.planning/WINDOWS.md` id 24，G-48-3 的运行期新增技能探针）与 48-05 登记的两条（id 22 / 23）都是 ship 门禁可见的，不会因本 SUMMARY 滚动出上下文而消失。
- **`covered_digest` 会 stale（预期，非缺陷）**：本计划改了 `src/renderer.js` / `tests/*` / `docs/product/ai-skills.md` 与三份 48 阶段计划/验证文本（均在本阶段内）→ 收尾时必须重算。
- **`AGENTS.md` 不属于 `covered_files`**：它是项目指令文件（`CLAUDE.md` / `CODEBUDDY.md` 是指向它的符号链接），由 `docs/product/ai-skills.md` 的「发现与调用」章节与 `AGENTS.md:272` 维护约定要求成对同步 —— 本计划按其要求同步了两处。**收尾审计请勿把这条改动误判为越界**。
- **`48-04-PLAN.md` 本计划零编辑**（`read_first` 窗口已由 `0a022a7` 落地）；它不在本计划的 `files_modified` 变更集里。
- **未闭合的相邻项**（不属本计划）：`48-REVIEW.md` 的 TD-48-01（CR-01 属性逃逸，用户 2026-09-12 裁决延后，接手触发点 = Phase 49 开工前第一条）、WR-01（`SKILL_TIER_TITLES` 与 `TIER_PICKER` 逐字重复）、WR-02（`_resolveSkillInvocation` 未包 try/catch）、WR-03 / WR-04 —— 均仍开着。
- **48 是最后一个 wave**：`depends_on: [48-04, 48-05]`，本计划完成后该阶段的所有计划均已落地，可进入阶段收尾（`/gsd-verify-work 48` → 重算指纹 → complete）。

---

*Phase: 48-skill-name*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `.planning/phases/48-skill-name/48-06-SUMMARY.md`
- FOUND: `src/renderer.js`
- FOUND: `tests/test-skill-picker-model.js`
- FOUND: `tests/test-ai-skills.js`
- FOUND: `docs/product/ai-skills.md`
- FOUND: `AGENTS.md`
- FOUND: `.planning/phases/48-skill-name/48-01-PLAN.md`
- FOUND: `.planning/phases/48-skill-name/48-02-PLAN.md`
- FOUND: `.planning/phases/48-skill-name/48-VALIDATION.md`
- FOUND: `c6aac18`（Task 1 commit）
- FOUND: `062b7a0`（Task 2 commit）
- 计划台账 `.git/gsd-plan-head-before-48-06` = `9bec8e879630d77220c691df3be113637968c931`；`git rev-list --count 台账..HEAD` = **2**（与 `actuals.commits` 一致）
- 测试：`node --check src/renderer.js` 通过；`node --test tests/test-skill-picker-model.js` → `# pass 95 / # fail 0`；`node tests/test-ai-skills.js` → `# pass 132 / # fail 0`；`node --test tests/test-ai-cancel-state.js` → `# pass 14 / # fail 0`
- 结构：`48-01-PLAN.md` / `48-02-PLAN.md` 的 `frontmatter.validate --schema plan` 与 `verify.plan-structure` 双双 `true`；frontmatter 闭合行 `85 / 89 / 48 / 10` 全部未移动
- 源码自检：`grep -n "state.aiSkills" src/renderer.js` 的命中只落在面板侧与 state 声明（**不落**在 `handleSendAIMessage` 内）；内联探针 → `send path has no local veto`；48-01 Task 3 源码门重跑 → `listener-ok`
- `actuals.tokens` = 5290（chars/4 over realized diff = 21159/4），与 PLAN 的 `estimate.tokens: 46000` 同尺度；实测值显著低于估算（本轮以文本编辑为主，代码改动仅 `src/renderer.js` 的净删除）

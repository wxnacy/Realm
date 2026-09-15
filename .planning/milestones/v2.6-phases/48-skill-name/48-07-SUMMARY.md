---
phase: 48-skill-name
plan: "07"
subsystem: ai
tags: [electron, skill-invocation, gap-closure, cache-invalidation, realtime-disk-read, source-of-truth, docs-closure, node-test]

# Dependency graph
requires:
  - phase: 48-skill-name
    provides: "48-04：`readSkillForInvocation` 的目录路径判据 + 注入名重写（G-48-2）；48-06：渲染端本地否决移除 + `skills:changed` 无条件重拉（G-48-3 renderer 半边）"
  - phase: 46-prompt
    provides: "`refreshSkills` 加载管线（契约布局过滤 / description 过滤 / 64 KiB 字节闸 / 遮蔽 / 禁用 / 限额）与 `_cache` 三字段（shadowed · disabled · tier）的唯一权威"
provides:
  - "ai-manager.js：`_resolveSkillInvocation` 在「不存在」判定上插入 miss **一次性**重试块 —— 经唯一权威入口 `syncAgentSystemPrompt()` 重扫后当场重试读盘，运行期新增的技能目录因此可被 `/skill:<新名>` 调用"
  - "三字段同源：shadowed（46 D-06）/ disabled（46 D-09、D-10）/ tier（D-14）全部由同一条 `refreshSkills` 管线产出，调用侧不新增第二套判定、不做单目录直读"
  - "有界与失败语义不变：重试至多一次（禁循环）、重扫抛错就地 catch + 告警并保留原判定、返回码域仍 `not_found | disabled`；`ai-skills-manager.js` 零 diff"
  - "忙时不改写 prompt：调用路径恒 `isProcessing = true` → 重扫落忙分支，只置脏、不广播（回写与 `skills:changed` 延后到下一次非忙同步点）"
  - "tests/test-ai-skills.js：`J 组` 7 条用例（正例 2 + 快路径 1 + 负例 3 + 源码护栏 1），实测 132 → **139** 例、零 fail"
  - "文档与账本：docs §10.3（miss 一次性重扫口径）/ §10.7（成本 · 忙时语义 · 残余窗口 + WR-06 保持开放）/ §七（实测例数）；AGENTS.md 测试清单补登记；WINDOWS id 24 两处同步更正且 status 仍 `open`；48-VALIDATION 新增 10 列对齐行；48-UAT 纯追加更正"
affects: ["49-manage-skill", "50-settings", "51-import", "48 阶段收尾（covered_digest 须重算；G-48-12 的 status 待 verify-work 回填）"]

# Actuals (#2632) — 与 PLAN 的 estimate 同尺度（chars/4 over realized diff）
actuals:
  tokens: 6113
  tasks: 2
  commits: 2
plan_head_before: 657cc2c1a25bf3460c24c9c174fa8bd3fef8384d

tech-stack:
  added: []
  patterns:
    - "**缓存未命中采用「有界重试」而非「回退直读」**：单目录直读会绕过契约布局过滤 / description 可用性 / 64 KiB 字节闸与 `overLimit` · `promptOmitted` 标记 —— 经既有加载入口重扫一次，判定面与缓存路径**逐项同源**，零重复实现"
    - "**修在调用侧、权威侧零 diff**：`ai-skills-manager.js` 的缓存存在性门原样保留（它是 shadowed / disabled / tier 的唯一权威），重试只加在调用侧 —— 用「manager 仍含短路字面量 + 不含调用形式的跨层入口」成对钉死"
    - "**「有界」用行为断言而非读源码**：fixture 以 own-property 包装 `syncAgentSystemPrompt` 计数，`rescanCalls === 1` 同时覆盖「≥1（确实重扫了）」与「≤1（没写成循环）」"
    - "**忙时语义是设计而非缺陷**：重扫发生在 `isProcessing = true` 之后，因此它必然只置脏 —— 断言 `_skillsPromptDirty === true` **且** `agent.state.systemPrompt` 逐字未变，把「轮内不改写」钉成可失败的门"
    - "**测试夹具不 `new` 真实单例**：`Object.create(prototype)` + 只补 `sandboxEnv` / `isProcessing` / `agent.state` / `configStore` / seeded 覆写，避免触碰真实 userData，同时让 tier 判定确定"
    - "**账本更正不重算计数**：机制描述变了但状态没变时，两处描述同步改、`status` 与 frontmatter 计数一律不动 —— 改了计数就与「仍 open」自相矛盾"

key-files:
  created: []
  modified:
    - ai-manager.js
    - tests/test-ai-skills.js
    - docs/product/ai-skills.md
    - AGENTS.md
    - .planning/WINDOWS.md
    - .planning/phases/48-skill-name/48-VALIDATION.md
    - .planning/phases/48-skill-name/48-UAT.md

key-decisions:
  - "口径 = 修复（用户 2026-09-12 裁决），且**在调用侧闭环**：`_resolveSkillInvocation` 在 `readSkillForInvocation` 返回 `not_found` 时**至多**重试一次 —— 先经既有权威入口 `syncAgentSystemPrompt()` 重扫，再当场重新读盘。**不改 `ai-skills-manager.js`**"
  - "重试条件是 `result && result.ok !== true && result.reason === 'not_found'` —— `disabled` 不重试（缓存已知道它，重扫无意义）"
  - "三字段来源全部由同一条 `refreshSkills` 管线承担：shadowed ← `_cache.skills` 的 `shadowed`（`applyShadowing`，managed 先 / user 后、后到者胜出）；disabled ← 注入式清单 `settings.aiSkills.disabled`；tier ← `sourceTierOf` + seeded 集合。**不写第二套遮蔽判定**"
  - "不做「单目录直读回退探测」：它会绕过契约布局过滤、description 可用性过滤、64 KiB 字节闸与 `overLimit` / `promptOmitted` 标记（D-12：显式调用是后两者的唯一可用路径，不能反过来变成「绕过」）"
  - "重扫复用 `syncAgentSystemPrompt()`（48-06 的「只加调用方、函数体逐字未改」同款）；代价与语义：调用路径恒忙 → 必走忙分支 → 重扫落地、置脏、**不改写 prompt、不广播**"
  - "有界性：**至多一次**，不得写成循环。真不存在仍是 `skill_not_found`（两个码不变）；误诊一个技能名的成本 = 一次全量重扫（与打开 `/` 面板同款），写进 docs §10.7"
  - "不新增第三套失败文案、不改 renderer：失败仍由重试后的 `result.reason` 经 `skillErrorFromReason` 映射，renderer 既有回滚链路（48-06 跨文件护栏）不动；`.refreshSkills(` 计数仍恒为 1（P-48-06 自激回路护栏）"
  - "计划 Task 1 用例 5 的 `{ source: 'user', shadowed: false }` 按**实测数据形状**改写为 `notStrictEqual(userEntry.shadowed, true)` —— `applyShadowing` 从不给胜出者写 `shadowed`，该键在原始快照条目上缺失（`undefined`），照字面断言必然假红（详见 Deviations 第 2 条）"

patterns-established:
  - "「运行期变更不可见」类缺陷的三段式收口：定位真正的判定面（这里是主进程缓存存在性门，不是渲染端）→ 在调用侧做**有界**的权威重扫 → 用行为断言（`rescanCalls === 1`、`rescanDelta === 0`）把「有界」与「快路径不回归」同时钉住"
  - "「权威侧零 diff」的可验证形态：被修文件不含权威侧的调用入口（正则查调用形式而非裸字面量，注释中的具名引用不算依赖）+ 权威侧仍含原短路字面量"
  - "账本两副本同步（表行 + JSON 条目）用同一条描述文本 `replace_all` 改写，避免两处各自漂移"

requirements-completed: [DISC-02, DISC-06]

coverage:
  - id: D1
    description: "G-48-12 靶心的**代码面**：运行期在 `managed-skills/` 或 `skills/` 下新增技能目录（不重扫、不打开 `/` 面板、不重建 Agent），直接调用 `/skill:<新名>` 即当场读盘成功，且恰重扫一次；shadowed / disabled 不被绕过；真不存在仍 `skill_not_found`；缓存命中时零重扫"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#J 组 · G-48-12 运行期新增技能（miss → 权威重扫一次 → 当场读盘）—— 正例 · managed 根 / 正例 · user 根 + 读盘实时性 / 快路径不变式 / 负例 · disabled / 负例 · shadowed / 负例 · 真不存在 + 有界"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#源码护栏 · miss 重试的接线与有界性（修复落在调用侧）"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js → # tests 139 / # pass 139 / # fail 0；node --test tests/test-skill-picker-model.js → # tests 95 / # pass 95 / # fail 0"
        status: pass
      - kind: unit
        ref: "node --check ai-manager.js && 计划 Task 1 门 2 源码形状探针 → `miss retry shape ok (bounded, single authority path)`（`readSkillForInvocation(` 恰 2 次、无 `while` / `for`、无 `refreshSkills(`、含 `syncAgentSystemPrompt(` / `console.warn` / `skillErrorFromReason(`）"
        status: pass
      - kind: integration
        ref: "本机探针（真实 `createSandboxEnv` + `refreshSkills` + SDK，临时工作区）：运行期新增 `managed-skills/probe-new` 后 —— BEFORE（缓存存在性门）= `{ok:false, reason:'not_found'}`；AFTER（一次权威重扫后）= `{ok:true, name:'probe-new', source:'managed'}`"
        status: pass
    human_judgment: false

  - id: D2
    description: "G-48-12 的**运行期闭合**：真实 dev 应用里在 `agent-workspace/managed-skills/` 下运行期新建技能目录（**不打开** `/` 面板、不重启、不重建 Agent），直接手打 `/skill:<新名> [args]` 正常调用 —— 不再出现 system-note「未找到技能「<新名>」，输入 / 查看可用技能」、不再有「主进程无 `发送消息: /skill:…` 日志」这一现象"
    requirement: DISC-02
    verification: []
    human_judgment: true
    rationale: "这条 truth 是**运行时**行为（重扫 → 缓存 → 读盘 → IPC 往返），node:test 只能钉住调用侧契约与三字段来源。48-06 已把它登记为 `.planning/WINDOWS.md` 的 unrun-verify id 24（本计划同步更正了该条的机制描述、status 保持 `open`），最终证据是重跑 `/gsd-verify-work 48` 的自动驱动探针（UAT test 12，B / B2 判别性复测形态）。本计划**不**自行把 G-48-12 标为 resolved。"

  - id: D3
    description: "**测试面盲区消除**：`tests/test-ai-skills.js` 新增 `J 组` 覆盖「运行期新增技能目录 → 直接 `/skill:` 调用」形态（正例 2 + 快路径不重扫 1 + 负例 3：disabled / shadowed / 真不存在 + 源码护栏 1），全部用**真实** SDK 夹具（真 `createSandboxEnv` + 真 `formatSkillInvocation` + 真 `refreshSkills`）而非自证；既有 132 例零回归"
    requirement: DISC-06
    verification:
      - kind: unit
        ref: "node tests/test-ai-skills.js → 132 → 139 例（`# pass 139` / `# fail 0`），J 组 7/7 通过；既有 helper（`withTempRoot` / `writeSkill` / `setupSkillsEnv` / `methodBody`）零改动"
        status: pass
    human_judgment: false

  - id: D4
    description: "**文档与账本收口**：`docs/product/ai-skills.md` §10.3（miss 一次性权威重扫口径，含三字段同源）/ §10.7（成本 · 忙时语义 · 残余窗口三条诚实边界 + WR-06 **保持开放**的显式声明）/ §七（实测 139 例 + 覆盖面）；`AGENTS.md` 技能域测试清单补登记 `node tests/test-ai-skills.js`；`.planning/WINDOWS.md` id 24 表行与 JSON 条目**两处**同步更正机制描述且 status 仍 `open`、计数未动；`48-VALIDATION.md` 新增 10 列对齐的 `48-07-T1` 行；`48-UAT.md` 以**纯追加**更正 G-48-3 的错误前提并交接待回填的 gap status"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "门 1（docs）→ `docs §10.3/§10.7/§七 收口 ok`（§10.3 含 `syncAgentSystemPrompt` + `至多一次`；§10.7 含 `忙` / `残余` / `WR-06` / `保持开放`；§七 例数 = 139）"
        status: pass
      - kind: unit
        ref: "门 2（WINDOWS）→ `WINDOWS id 24 updated in both copies, status still open`（表行 + JSON 均含 `48-07` / `缓存存在性门`；`status === 'open'`、`resolved_at === null`、`open_count: 23` / `total_count: 24` 未动）"
        status: pass
      - kind: unit
        ref: "门 3（AGENTS / VALIDATION / UAT）→ `AGENTS.md + 48-VALIDATION + 48-UAT(append-only) ok`（UAT 与 `git show HEAD:` 逐行前缀比对，无一行被改动；G-48-12 的 `status: failed` 保留）"
        status: pass
      - kind: unit
        ref: "门 4（测试）→ `node tests/test-ai-skills.js` 139/0 + `node --test tests/test-skill-picker-model.js` 95/0"
        status: pass
    human_judgment: true
    rationale: "四条门都是**文本/结构**判据，可自动判红绿；但「散文表述是否准确反映了实现语义」这一层（尤其 §10.7 三条诚实边界的措辞是否会被读成「已修」）仍需人或 `/gsd-verify-work 48` 的文档核对确认。"

# Metrics
duration: 6min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 07: 缓存未命中的显式技能调用经权威重扫一次后重试（G-48-12）Summary

**主进程缓存存在性门被补上「有界重试」：`/skill:<新名>` 一旦判为不存在，就经唯一权威入口 `syncAgentSystemPrompt()` 重扫恰一次后当场重读磁盘 —— 运行期新增的技能目录（含 AI 经 `write`/`bash` 创建）不需要打开 `/` 面板或重启即可调用，而 shadowed / disabled / tier 三字段仍全部来自同一条加载管线**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-12T14:12Z（下界：编排器 `milestone.lock` 的 mtime 22:12+08:00；执行器侧未插桩起点标记）
- **Completed:** 2026-09-12T14:17:28Z
- **Tasks:** 2/2
- **Files modified:** 7（`ai-manager.js`、`tests/test-ai-skills.js`、`docs/product/ai-skills.md`、`AGENTS.md`、`.planning/WINDOWS.md`、`48-VALIDATION.md`、`48-UAT.md`）；`ai-skills-manager.js` **零 diff**

## Accomplishments

- **G-48-12 的失效点被准确定位并修在正确的层**：失效不在渲染端（48-06 已修那半边），而在主进程 —— `readSkillForInvocation`（`ai-skills-manager.js:802-804`）在触盘**之前**用 `_cache.skills` 做存在性门，缓存未命中即判「不存在」，读盘路径根本不执行；而 `_cache` 只由显式重扫刷新（Agent 创建 / `syncAgentSystemPrompt` / `_recreateAgent`），常规入口只有「打开 `/` 面板」，全仓无 fs watcher、无定时器、无写工具钩子。修复落在**调用侧**（`_resolveSkillInvocation`），权威侧零 diff。
- **有界重试 + 三字段同源**：miss 时经 `syncAgentSystemPrompt()`（函数体逐字未改）重扫**恰一次**后当场重读磁盘。重扫仍由同一条 `refreshSkills` 管线产出 shadowed（46 D-06）/ disabled（46 D-09、D-10）/ tier（D-14），因此运行期新增的技能**不能**绕过遮蔽与禁用 —— 调用侧零自行判定、零单目录直读、零第二套实现。
- **有界性与失败语义都是可失败的门，不是声明**：`rescanCalls === 1` 同时钉住「确实重扫了」与「没写成循环」；负例 3 条（`skill_disabled` 零注入 / 两根同名注入胜出者且败者 `shadowed === true` / 真不存在仍 `skill_not_found`）钉住「重扫不会把失败变成成功」；重扫抛错就地 `catch` + `console.warn` 且保留原判定（返码域仍只有两个）。
- **快路径不变式：缓存命中零重扫**（实测 `rescanDelta === 0`），且改盘后的正文仍由实时读盘给出（重试路径**不复用**重扫产出的缓存正文）—— 既有 D 组「调用瞬间读盘」语义未回归。
- **忙时语义被钉死**：调用路径恒 `isProcessing = true`（`prompt` / `promptWithContext` 先置位、后调本方法），故重扫必落 `syncAgentSystemPrompt()` 的忙分支 —— 重扫落地、`_skillsPromptDirty = true`，但**不改写** `agent.state.systemPrompt`、**不广播**。两条断言（置脏 + prompt 逐字未变）把这一点变成门，同时天然排除了「广播 → 重扫 → 再广播」的自激回路（T-48-07-05）。
- **测试面盲区消除**：`tests/test-ai-skills.js` 新增 `J 组` 7 条用例（正例 2 · 快路径 1 · 负例 3 · 源码护栏 1），实测 **132 → 139 例、零 fail**；既有 helper 与既有 132 例零改动（新增夹具是独立的调用侧上下文包装，不修改任何既有 helper）。`node --test tests/test-skill-picker-model.js` 仍 95/0。
- **产品文档与账本同步收口**：§10.3 写入「缓存未命中的调用瞬间重扫」三条口径（重扫只为把磁盘现状带进缓存 / 注入正文恒为读盘结果 / 三字段即判定依据 / 至多一次）；§10.7 写入三条诚实边界（成本、忙时语义、残余窗口）并**显式声明 WR-06 仍保持开放**；`AGENTS.md` 技能域测试清单补登记（此前只在产品文档登记，指令文件清单缺项 —— 这是 `AGENTS.md:272` 维护约定的执行）；`WINDOWS.md` id 24 表行与 JSON 条目**两处**同步更正（原文暗示的「idle 边界自动重扫」链并不存在），status 仍 `open`、计数未动；`48-UAT.md` 以纯追加更正 G-48-3 的错误前提。

## Task Commits

Each task was committed atomically:

1. **Task 1: miss 一次性权威重扫 + 重试（调用侧闭环）+ J 组测试面补齐** — `7d6bd35` (fix)
2. **Task 2: 文档与账本收口（产品文档 / AGENTS.md / WINDOWS id 24 / 验证矩阵 / UAT 更正）** — `96560a6` (docs)

**Plan metadata:** 见下方「Plan metadata」提交（SUMMARY + STATE + ROADMAP）

_Note: 本计划无 TDD 任务，两个任务各一次提交。_

实测（台账 `.git/gsd-plan-head-before-48-07` = `657cc2c1a25bf3460c24c9c174fa8bd3fef8384d`）：
`git rev-list --count 657cc2c..HEAD` = **2**，与 `actuals.commits` 一致。

## Files Created/Modified

- `ai-manager.js` —
  - `_resolveSkillInvocation`：`const result` → `let result`，并在首次读盘之后、失败分支之前插入 miss 一次性重试块（条件 `result && result.ok !== true && result.reason === 'not_found'`；块内 `try { await this.syncAgentSystemPrompt(); } catch (err) { console.warn(...) }` + 重读一次）；**失败分支、`skillErrorFromReason` 调用、`formatSkillInvocation` 动态 import、`buildSkillInvocationBlock`、`sourceTierOf`、返回三键形状逐字未动**
  - 方法 JSDoc 补「缓存未命中的一次性重扫（G-48-12）」四条口径 + 忙时语义说明
- `tests/test-ai-skills.js` — 文件末尾追加 `J 组 · G-48-12 运行期新增技能（miss → 权威重扫一次 → 当场读盘）` describe（7 条 `test()`）+ 夹具 helper `skillResolveCtx(env, { disabled })` 与 `invokeSkill(ctx, text)`；既有 helper 与既有用例零改动
- `docs/product/ai-skills.md` — §10.3 追加 1 条 bullet（miss 一次性权威重扫，含三字段同源与「至多一次」）；§10.7 追加 3 条 bullet（成本 / 忙时语义 / 残余窗口）+ 1 条 WR-06「保持开放」显式声明；§七 `node tests/test-ai-skills.js` 例数 132 → **139（实测）** 并在覆盖面末尾补「运行期新增技能的调用瞬间重扫 + 当场读盘（G-48-12）」
- `AGENTS.md` — 技能域 `- 测试：` 清单行**新增** `node tests/test-ai-skills.js` 条目（技能域全量单测 + 实测 139 例）；其余条目与 `:272` 维护约定文字未动
- `.planning/WINDOWS.md` — id 24 的表行与 JSON 条目 `description` 同步更正为「48-07 已修 + 机制更正」（① 原描述的「idle 边界自动重扫」链不存在；② 真失效点是缓存存在性门；③ 修法 = 调用侧 miss 一次性权威重扫；④ 最终证据仍是重跑 verify-work 的自动驱动探针）；`status` 仍 `open`、`resolved_at` 空、frontmatter 计数与 `last_updated` 一律未动
- `.planning/phases/48-skill-name/48-VALIDATION.md` — Per-Task Verification Map 表末追加 `48-07-T1` 行（10 列对齐，`Status` = `⬜ pending`、`File Exists` = `✅（新增）`）
- `.planning/phases/48-skill-name/48-UAT.md` — 文件末尾**纯追加** `## 更正（G-48-12 立项时，2026-09-12）` 小节（三条：更正 G-48-3 的 `root_cause` 括注错误前提 / 真正的失效点与修法 / status 由 verify-work 重跑后回填的交接）；`## Gaps` 的 YAML 块一行未动

## Decisions Made

见 frontmatter `key-decisions`（8 条）。要点：修在**调用侧**（权威侧零 diff）、重试**至多一次**、三字段**同源**、不做单目录直读回退、失败码域仍是两个、忙时只置脏不改写 prompt、不新增第三套失败文案、不改 renderer。

## Deviations from Plan

**1. [Note · 环境性] 默认分支提交门禁在 `branching_strategy: none` 下不适用**

- **Found during:** Task 1（首次提交前）
- **Issue:** `git.base-branch --is-protected master` 返回 `true`，且 `.planning/config.json` **未**设 `git.allow_default_branch_commits`，按执行器协议字面要求应 HALT。但本项目 `workflow.branching_strategy: "none"` + `workflow.use_worktrees: false`，编排器本次亦明确要求「在**主工作树**上按顺序执行、用正常 git 提交、不得 `--no-verify`」，且 Phase 44–48 的全部计划提交（含 48-01…48-06）都落在 `master` 上。
- **Fix:** 按项目既有流程在 `master` 上提交；未新建分支、未改写分支、未执行任何 `git update-ref`、未把 `.planning/config.json` 改成 `git.allow_default_branch_commits: true`（那会越出本计划的 `files_modified`）。与 48-04 / 48-05 / 48-06 的同名说明一致，供收尾审计判断是否需在 config 补该开关以消除字面误报。
- **Files modified:** 无（仅提交落点）
- **Verification:** `git log --oneline` 显示 `7d6bd35` / `96560a6` 与既有阶段提交同处 `master`。
- **Committed in:** `7d6bd35`、`96560a6`

**2. [Rule 1 - Bug] 计划用例 5 的「胜出者 `shadowed === false`」与实测数据形状不符**

- **Found during:** Task 1（写 J 组用例 5 的断言时）
- **Issue:** 计划 Task 1 的用例 5 要求断言原始快照里同时存在 `{ source: 'managed', shadowed: true }` 与 `{ source: 'user', shadowed: false }`。实测 `applyShadowing`（`ai-skills-manager.js`）**从不为胜出者赋值** —— 它只给败者写 `shadowed = true` / `shadowedBy`，胜出者条目上该键**缺失**（`undefined`，不是 `false`）。照字面写 `userEntry.shadowed === false` 是**必然假红**。项目既有约定也是这么写的：`tests/test-ai-skills.js:490`（46-02 的用例）用 `assert.notStrictEqual(userEntry.shadowed, true, 'user 版不得被遮蔽')`。
- **Fix:** 胜出者一侧改为 `assert.notStrictEqual(userEntry.shadowed, true, '胜出者不得被遮蔽')`（与 46-02 同一不变量、同一写法），并额外断言 `managedEntry.shadowedBy === 'user'`；计划要求的字面量 `shadowed === true` 由 managed 一侧原样保留（Task 1 门 3 的断言素材检查仍命中）。**未**修改 `applyShadowing` 去补 `false`（那会动 46 的权威数据结构，超出本计划范围）。
- **Files modified:** `tests/test-ai-skills.js`
- **Verification:** J 组 7/7 通过，`node tests/test-ai-skills.js` → `# pass 139 / # fail 0`；门 3 → `J 组用例素材齐备`
- **Committed in:** `7d6bd35` (Task 1 commit)

**3. [Rule 3 - Blocking] 计划 Task 2 门 2 的 `ai-skills-manager.js` 不得含 `syncAgentSystemPrompt` 字面量是**不可满足**的（该字面量在本计划开始前已存在）**

- **Found during:** Task 1 收尾复跑计划提供的源码形状门时
- **Issue:** 计划的 Task 1 门 2 末段断言 `if (mgr.includes('syncAgentSystemPrompt')){...exit 3}`。实测 `ai-skills-manager.js:81` **在本计划开始前**就有该字面量 —— 那是一条 JSDoc，记录 46-04 的消费关系（`git show HEAD:ai-skills-manager.js | grep -n syncAgentSystemPrompt` → `81`，即改动前即存在）。因此该断言的字面形式**无论本计划怎么做都会失败**。
- **Fix:** 保留门 2 的**意图**（「manager 侧不得出现跨层依赖」）并改为可满足且更准确的探针：断言该文件**不含调用形式** `\.syncAgentSystemPrompt\s*\(`（注释中的具名引用是文档，不是依赖）。同一条护栏在测试里也落地为 J 组源码护栏用例的一环。门 2 的其余 7 项断言（含 `readSkillForInvocation(` 恰 2 次、无 `while` / `for`、无 `refreshSkills(`、缓存短路字面量仍在）**原样全过**。
- **Files modified:** 计划门命令按上述改写复跑（无源码改动 —— `ai-skills-manager.js` 全程零 diff）
- **Verification:** 复跑 → `miss retry shape ok (bounded, single authority path)`；`grep -c "syncAgentSystemPrompt" ai-skills-manager.js` = 1（仅 `:81` 注释）；J 组源码护栏用例通过
- **Committed in:** 不适用（验证口径调整，随 Task 1 提交的护栏一并落地）

---

**Total deviations:** 0 auto-fixed（3 条为环境性说明 / 计划文本与实测形状冲突的口径调和 / 不可满足门命令的等价替换，均未扩大交付面）
**Impact on plan:** 交付物严格限于 `files_modified` 列出的 7 个文件；`ai-skills-manager.js` 零 diff（计划 prohibition 明文）；未动 `syncAgentSystemPrompt()` 函数体、未动 renderer、未动 TD-48-01 / TD-48-02、未顺手修任何 WR。无 scope creep。

## Issues Encountered

- **「重试后不能复用缓存正文」需要专门断言**：重扫会把技能条目（含**上一次**读到的元数据）带进缓存，若实现者图省事在重试时返回缓存条目，则「实时读盘」会在 miss 场景下静默退化为「读快照」。为此用例 2 在首次调用成功后**改盘再调一次**，断言读到第二版正文 —— 这条断言把该退化路径堵死（实测通过）。
- **宿主的占位符张力**：J 组的 context 夹具刻意**不** `new AIManager()`（会触碰真实 userData 与 electron 路径），改用 `Object.create(aiManager.prototype)` + 仅补 `_resolveSkillInvocation` 真正读到的字段（`sandboxEnv` / `isProcessing` / `_skillsPromptDirty` / `_skillsPromptDigest` / `agent.state` / `configStore` / `getSeededSkillNamesSafe`）并 own-property 包装 `syncAgentSystemPrompt` 计数。`isProcessing: true` 与真实调用点同值，因此忙分支断言与生产语义一致（不是为测试而设的假状态）。
- **`AGENTS.md` 与 `.planning/WINDOWS.md` 不在阶段 `covered_files` 内**：两者是项目指令文件与跨阶段账本，本计划按 `AGENTS.md:272` 的维护约定与 WINDOWS 的双副本纪律同步，属**约定执行**而非越界；与 48-06 同款记账口径。

## Known Stubs

None —— 本计划新增的是一段有界重试 + 断言与文档，不引入占位数据、空值流转或未接线组件。对全部新增行做过 `TODO|FIXME|XXX|coming soon|placeholder|not available|HACK|t.skip|test.todo|it.skip` 扫描：**零命中**（`git diff -U0` 新增行）。J 组 7 条用例全部 `pass`，无 skip / todo。

**未向 `.planning/WINDOWS.md` 追加新条目（刻意）**：本计划唯一的「unrun-verify」性质内容（G-48-12 的运行期探针）**已由 id 24 承载**（48-06 登记），本计划只更正其机制描述；而计划的 Task 2 明文要求 id 24 的 `status` 保持 `open`、`open_count: 23` / `total_count: 24` 一律不动。追加新行会与「计数未动」自相矛盾，故此处只登记于 SUMMARY。

## Threat Flags

None —— 本计划未新增网络端点、鉴权路径、文件访问模式或 schema 变更。威胁登记表五项处置均按计划落地：**T-48-07-01**（Spoofing，high）由「重试只调 `syncAgentSystemPrompt()`、三字段全部由该管线产出」+ J 组负例 4 / 5（禁用零注入 / 同名注入胜出者且败者 `shadowed === true`）+ 源码门禁「`_resolveSkillInvocation` 内不出现 `refreshSkills(`」缓解；**T-48-07-02**（DoS，medium）维持 accept —— 重试至多一次（源码门禁禁 `while` / `for` + 行为断言 `rescanCalls === 1`），且只在显式 `/skill:` 语法且判为 `not_found` 时触发，单次成本与「打开 `/` 面板」同款；**T-48-07-03**（Tampering，medium）由块内 `try/catch` + `console.warn` + 保留原判定缓解（未动 `isProcessing` 的既有复位职责）；**T-48-07-04**（Tampering，medium）维持 accept —— WR-06 按用户裁决保持开放，§10.7 显式声明、无任何「已修」表述；**T-48-07-05**（DoS，medium）由「重扫必落忙分支 → 不改写 prompt、不广播」+ renderer `.refreshSkills(` 计数恒 1 缓解。

## Next Phase Readiness

- **G-48-12 的修复已落地（代码面 + 测试面 + 文档账本面）**；运行时的最终证据待重跑 `/gsd-verify-work 48` 的自动驱动探针（UAT test 12，B / B2 判别性复测形态：在 `managed-skills/` 下运行期新建目录后**不打开** `/` 面板，直接手打 `/skill:<新名>`）。该待办是 `.planning/WINDOWS.md` 的 unrun-verify **id 24**（本计划已更正其机制描述、status 仍 `open`），ship 门禁可见，不会因本 SUMMARY 滚动出上下文而消失。**本计划未自行把 `G-48-12` 标为 resolved**（`48-UAT.md` 的 Gaps 块保持 `status: failed` 原样）。
- **`covered_digest` 会 stale（预期，非缺陷）**：本计划改了 `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md` / `.planning/WINDOWS.md` / `48-VALIDATION.md` / `48-UAT.md` → 收尾时必须重算。其中 `AGENTS.md` 与 `.planning/WINDOWS.md` 不在 `covered_files` 内（项目指令文件 / 跨阶段账本），按 48-06 同款口径记账。
- **仍开放的相邻项（本计划不修、也不得声称已修）**：WR-06（已缓存技能在实时读盘路径绕过 64 KiB 字节闸，用户裁决随 Phase 49 处置）；WR-01 / WR-02 / WR-03 / WR-04 / WR-05；TD-48-01（面板行 `title` 属性逃逸，接手触发点 = Phase 49 开工前第一条）、TD-48-02（CR-05 可达性）。
- **下一个 wave 是阶段收尾**：48-07 是 48 的第 7 个也是最后一个计划；本计划完成后 Phase 48 的 7 个计划全部落地，可进入 `/gsd-verify-work 48` → 重算 `covered_digest` → 回填 `48-VALIDATION.md` 的 `48-07-T1` 状态与 G-48-12 / id 24 的终态。

---

*Phase: 48-skill-name*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `.planning/phases/48-skill-name/48-07-SUMMARY.md`
- FOUND: `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md`
- FOUND: `.planning/WINDOWS.md` / `.planning/phases/48-skill-name/48-VALIDATION.md` / `.planning/phases/48-skill-name/48-UAT.md`
- FOUND: `7d6bd35`（Task 1 commit）
- FOUND: `96560a6`（Task 2 commit）
- 计划台账 `.git/gsd-plan-head-before-48-07` = `657cc2c1a25bf3460c24c9c174fa8bd3fef8384d`；`git rev-list --count 台账..HEAD` = **2**（与 `actuals.commits` 一致）
- 测试：`node --check ai-manager.js` 通过；`node tests/test-ai-skills.js` → `# pass 139 / # fail 0`；`node --test tests/test-skill-picker-model.js` → `# pass 95 / # fail 0`
- 边界：`ai-skills-manager.js` 零 diff（`git diff --name-only 台账..HEAD` 不含它）；`syncAgentSystemPrompt()` 函数体未被改动（46-04 五条方法体断言继续绿）
- `actuals.tokens` = 6113（chars/4 over realized diff = 24454/4），与 PLAN 的 `estimate.tokens: 48000` 同尺度；实测显著低于估算（本轮以调用侧一小段重试 + 测试与文本编辑为主）
- 未向 `.planning/WINDOWS.md` 追加新行（id 24 已承载该 unrun-verify，计划明文要求计数不动）——见 `## Known Stubs` 末段

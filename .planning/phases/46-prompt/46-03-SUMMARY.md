---
phase: 46-prompt
plan: 3
subsystem: ai
tags: [skills, diagnostics, degradation, limits, budget, deterministic-order, enable-disable]

# Dependency graph
requires:
  - phase: 46-01
    provides: "refreshSkills 异步加载 + 模块级 _cache + 同步零 IO 访问器；createSkillsEnv 加载面收窄（根层只认目录 + SKILL.md 字节预筛 + droppedNotices 带外记录）；LIMITS 单源；buildSystemPrompt 第 4 段"
  - phase: 46-02
    provides: "加载后管线（布局过滤 → 名称权威重写 → 遮蔽去重）；pushEntryDiag 诊断双写；缓存条目 shadowed / shadowedBy"
provides:
  - "ai-skills-manager.js：toRealmDiag(d) —— SDK 诊断 type → Realm level 的唯一显式映射点（D-07）"
  - "ai-skills-manager.js：pushError(errDiag) —— 模块级 errors[] 写入点"
  - "ai-skills-manager.js：isDescriptionUnusable(d) —— description 不可用判定（单技能跳过）"
  - "ai-skills-manager.js：bySkillPriority(a, b) —— 确定性全序比较器（可观测顺序的唯一规定者）"
  - "ai-skills-manager.js：refreshSkills 扩展管线（⓪ 目录存在性断言 → ① 布局/description 过滤 → ② 名称重写 → ③ 遮蔽 → ④ 定序 → ⑤ 启停标记 → ⑥ 数量上限 → ⑦ 预算截断）"
  - "ai-skills-manager.js：fixedOverhead + entryCost 差量测量（prompt 段整段预算）"
  - "缓存条目新增字段：disabled（布尔）/ overLimit（布尔）"
  - "新诊断码：realm_refresh_failed / realm_skills_dir_missing / realm_skill_md_too_large / realm_user_skill_limit_exceeded / realm_prompt_budget_exceeded"
  - "限额族诊断附加结构化字段：limit / currentValue"
  - "computeDigest 扩展：条目增加 disabled / overLimit / shadowed，并纳入整段 promptBlock（截断结果）"
  - "tests/test-ai-skills.js：新增 2 组 describe 共 17 例断言（累计 53 例）"
affects: ["46-04", "48", "49", "50", "51"]

# Actuals (#2632)
actuals:
  tokens: 6100
  tasks: 3
  commits: 3
  plan_head_before: d51f2509f7f4b6b8bdcf5c95b1c2e9f4b0a5d3e7

# Tech tracking
tech-stack:
  added: []   # 零新增依赖（package.json 原样，未执行任何安装命令）
  patterns:
    - "诊断口径统一：SDK 诊断一律经 toRealmDiag 显式映射（type → level），禁止任何调用点直读 d.level"
    - "带外记录优于解析 SDK 消息文本：字节闸的 limit/currentValue 由 createSkillsEnv 写入 droppedNotices，而不是从 SDK 的 read_failed message 里正则抠数"
    - "差量测量优于自拼模板：prompt 段预算用 formatSkillsForSystemPrompt 的边际成本测量，SDK 升级自动跟随"
    - "确定性全序（码点序）替代区域敏感比较：跨机 prompt 字节序列恒定，provider 前缀缓存命中率可预测"
    - "消费侧过滤而非数据层移除：disabled / overLimit / shadowed 三种状态都只标记，条目与磁盘文件完整保留"

key-files:
  created: []
  modified:
    - ai-skills-manager.js
    - tests/test-ai-skills.js

key-decisions:
  - "description 不可用的技能必须跳过（SDK 对超长 description 仍返回 skill，只对缺失/空 description 返回 null）；name 类 invalid_metadata 不跳过 —— 46-02 的 D-08 已锁定「以目录名重写并保留」。两条计划的措辞冲突按 D-08（更具体的锁定决策）调和"
  - "errors[] 在每次刷新的 try 开工处复位：目录缺失诊断需要在成功路径上存活，而管线的末尾赋值会把它清掉；失败路径由 catch 追加 realm_refresh_failed"
  - "预算截断的 entryCost 改用「在已有条目段上加一条」的边际成本（format([dummy, skill]) - format([dummy])）：计划给的 format([skill]) - format([dummy]) 让每条都重复计入一次前言，k 条时累计口径比真实段长少 (k-1) 倍前言，会把贪心放行到超预算"
  - "bySkillPriority 为全序且排在遮蔽之后：胜负由输入顺序决定（D-06），可观测顺序由比较器决定，两者互不干扰；它取代 46-02 的「输入顺序被原样保留」口径，成为集合顺序的唯一权威"
  - "omit 提示追加在 SDK 技能段闭合标签之外，并额外把整段 promptBlock 纳入 digest —— 未截断与截断时的段内前缀逐字节相同（前缀缓存友好），而截断事实由 digest + 段尾提示双重表达"
  - "数量上限只统计 user 来源（managed 由应用自身投递，不计入用户配额）；超限标 overLimit 而不剔除、不删文件"

patterns-established:
  - "限额类诊断的统一形状：{ level, code: 'realm_*', message, path, limit, currentValue } —— message 同时含两个数值，结构化字段供设置页渲染（SKILL-07 的「哪个限额 / 当前值」）"
  - "源码扫描型断言的扩展：新增「不得出现的符号字面量」必须同时从注释中清除（localeCompare / <available_skills> / yaml / ignore / harness 子路径），否则扫描命中注释而非真实回归"

requirements-completed: [SKILL-06, SKILL-07, SKILL-08]

coverage:
  - id: D1
    description: "诊断显式映射：SDK 诊断经 toRealmDiag 后 level === 'warning'（非 undefined）、code 原样保留；零诊断时 diagnostics 与 errors 均为长度 0 的数组"
    requirement: "SKILL-06"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D2
    description: "分层降级第 1 层：YAML 失败 / description 超长的单个技能被跳过并各产诊断，合法技能仍在集合与 prompt 中，refreshSkills 正常 resolve（不抛错）"
    requirement: "SKILL-06"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D3
    description: "分层降级第 2 层：listDir 抛错时 refreshSkills 不抛错、skills / promptBlock 保留上一次成功快照、errors[] 含 realm_refresh_failed 且 level === 'error'"
    requirement: "SKILL-06"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D4
    description: "目录缺失不静默：扫描根不存在时产 realm_skills_dir_missing（SDK 对此零诊断），且不中断加载流程"
    requirement: "SKILL-06"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D5
    description: "字节闸：超 MAX_SKILL_MD_BYTES 的 SKILL.md 不进集合，realm_skill_md_too_large 诊断带 limit === 64*1024 与等于 fs.statSync().size 的 currentValue；SDK 的 read_failed 并存"
    requirement: "SKILL-07"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D6
    description: "数量上限：user 技能超 MAX_USER_SKILLS 时恰有 1 条 overLimit，全部条目仍在 _cache.skills 内、磁盘文件未删，诊断带 limit / currentValue，overLimit 条目不进 prompt"
    requirement: "SKILL-07"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D7
    description: "prompt 段预算：超预算时技能段本体 ≤ 预算、段尾（闭合标签之外）出现可解析的省略提示、注入条数 = 可注入数 - 省略数、诊断带 limit / currentValue；未超预算时提示完全不出现"
    requirement: "SKILL-07"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D8
    description: "定序确定：连续两次刷新可观测顺序深度相等；顺序恒为 user 来源在前、同来源内按 name 码点序（源码无区域敏感比较）"
    requirement: "SKILL-07"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#诊断与限额（SKILL-06/07）"
        status: pass
    human_judgment: false
  - id: D9
    description: "启停（SKILL-08）：disabled 条目标 disabled === true、仍在集合内、不进 prompt，磁盘文件存在性与大小刷新前后一致；disabled: [] 可逆恢复；同名技能共享禁用状态；不同 disabled 输入产生不同 digest"
    requirement: "SKILL-08"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#启停状态（SKILL-08）"
        status: pass
    human_judgment: false
  - id: D10
    description: "硬约束保持：agent-workspace.js / ai-manager.js / package.json 逐字节零 diff；零新增依赖；源码无区域敏感比较、无手拼技能段模板、无移除式过滤"
    verification:
      - kind: other
        ref: "git diff --stat <plan base>..HEAD → 仅 ai-skills-manager.js 与 tests/test-ai-skills.js"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#依赖纪律（源码扫描）"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 03: 可解释 / 有上限 / 可启停 Summary

**技能集从「能跑」变成「可信」：每一个失败面都变成可同步读到的诊断，三条限额各自在正确位置生效并给出「哪个限额、当前值」，定序跨机确定，启停只过滤不删文件**

## Performance

- **Duration:** 12min
- **Tasks:** 3
- **Files modified:** 2（0 新建 / 2 修改）
- **Executor note:** 原始 wave 3 子代理派发遇 provider 429（配额重置在 13 小时后），按既有降级策略由主会话接管执行，提交规范与子代理一致（逐任务原子提交）

## Accomplishments

- **诊断口径统一（D-07）**：`toRealmDiag(d)` 成为 SDK 诊断 → Realm 形状的**唯一**映射点。SDK 的严重度字段是 `type`（恒为 `'warning'`），Realm 是 `level` —— 不显式映射就会读到 `undefined`，让「诊断已透传」假成立。`code` / `message` / `path` / `source` 原样透传（SDK 的 message 天然含限额与当前值）。
- **分层降级（D-05）落地且语义准确**：
  - 第 1 层（单技能失败 = 正常态）：YAML 解析失败、description 不可用的技能被跳过，**其余技能照常注入**，`refreshSkills()` 不抛错。
  - 第 2 层（整批失败）：`listDir` 抛错这类批量错误 **一行都不碰** `skills` / `promptBlock` / `diagnostics`（保留上一次成功快照），只往 `errors[]` 追加 `realm_refresh_failed`。
- **补上 SDK 的静默缺口**：SDK 对不存在的扫描根直接 `continue` 且**零诊断**（`skills.js:23-34`）。Realm 在加载前对每个扫描根做存在性断言，缺失即产 `realm_skills_dir_missing`，且**不中断**加载。
- **description 可用性成为硬闸**：SDK 的 `validateDescription` 只产 warning，且 `loadSkillFromFile` **只对缺失/空 description 返回 `skill: null`** —— 超长 description 的技能会被原样加载。而 description 是模型匹配技能的唯一依据（渐进式披露只注入 name/description/location），所以不可用的 description 等于该技能永不触发。`isDescriptionUnusable` 按诊断模板前缀（`description …`）判定并跳过。
- **三条限额各自在正确位置生效（SKILL-07）**：
  - `MAX_SKILL_MD_BYTES`（64 KiB）—— 在 `readTextFile` 阶段、**YAML 解析之前**按 `FileInfo.size` 拒绝；`limit` / `currentValue` 由 `droppedNotices` 带外记录（不解析 SDK 消息文本）。
  - `MAX_USER_SKILLS`（50）—— user 来源超限条目标 `overLimit` 而**不剔除、不删文件**。
  - `SKILLS_PROMPT_CHAR_BUDGET`（8000）—— **整段口径**（含 SDK 前言与包裹的固定开销），差量测量 + 贪心填充；截断时在闭合标签**之外**追加省略提示并产诊断。未截断时提示与诊断都不出现。
- **定序跨机确定**：`bySkillPriority` 是显式全序（user 来源 → 可模型调用 → name 码点序），**不依赖区域敏感比较** —— 顺序变化会改变 system prompt 字节序列，让 provider 前缀缓存命中率随机器漂移。它是 `getSkillsSnapshot().skills` 与 `buildSkillsPrompt()` 可观测顺序的唯一规定者。
- **启停只过滤不删文件（SKILL-08）**：`settings.aiSkills.disabled` 命中的条目在数据层保留并标 `disabled === true`，只是不进 prompt 段。磁盘文件存在性与大小刷新前后逐字节一致；`disabled: []` 即恢复。同名技能共享禁用状态（D-09 已知边界）按锁定语义成立。
- **digest 覆盖影响 prompt 段的全部因素**：条目增加 `disabled` / `overLimit` / `shadowed`，并纳入整段 `promptBlock`（截断结果）。46-04 的 `syncAgentSystemPrompt()` 以它作快速判定主键，漏掉任何一项都会让「无变化不动 prompt」失真。

## Task Commits

Each task was committed atomically:

1. **Task 1: 诊断合并（type → level）+ 模块级 errors[] + 双层降级 + 目录缺失断言** - `0c8f21a` (feat)
2. **Task 2: 三限额生效 —— 字节闸诊断 / 数量超限保留 / prompt 段预算截断** - `8ef45a1` (feat)
3. **Task 3: 启停状态（SKILL-08）+ digest 覆盖启停/遮蔽/超限/截断** - `5a6acc3` (feat)

**Plan metadata:** 见本文件所在提交（docs: complete 46-03 plan）

## Files Created/Modified

- `ai-skills-manager.js`（修改）— 新增 `toRealmDiag` / `pushError` / `isDescriptionUnusable` / `bySkillPriority` 四个模块内部函数（全部刻意**不导出**）；`createSkillsEnv.readTextFile` 增加字节闸带外记录；`refreshSkills` 扩展为 ⓪-⑦ 管线；`computeDigest` 扩展输入面
- `tests/test-ai-skills.js`（修改）— 新增 `describe('诊断与限额（SKILL-06/07）')`（11 例）与 `describe('启停状态（SKILL-08）')`（5 例）共 16 例 + 1 例既有分组内补强。累计 **53 例**

**零 diff 声明（硬约束）**：`agent-workspace.js`、`ai-manager.js`、`package.json` 本计划逐字节未动 —— `git diff --stat <plan base>..HEAD` 只列出上述两个文件（plan 的 `files_modified` 列了 `ai-manager.js`，但 `disabled` 参数的注入式读取在 46-01 已接好，本计划只需消费，无需改动）。

## Decisions Made

- **description 类 `invalid_metadata` 跳过、name 类不跳过（计划冲突的调和点）**：46-03 的 `must_haves` 与 `46-VALIDATION.md` 的 46-03-01 行都写「非法 name / 超长 description / YAML 失败 → 技能被跳过」，但 46-02 已交付且已绿的 D-08 明确要求「name 与目录名不一致 → **以目录名重写并保留**」（测试断言集合内每一条 `name ≡ 目录名`，且 `skills/evil` 与 `managed-skills/mismatch` 必须留在集合内、必须进 prompt）。两者对 name 类的处置直接冲突。调和方式：按**更具体的锁定决策 D-08** 处理 name 类（保留 + 重写），description 类按 D-05 第 1 层跳过。理由：description 是渐进式披露契约里模型匹配技能的唯一依据，不可用即等于该技能永不触发（必须跳过）；而 name 不一致只是一个可被目录名权威**化解**的告警，丢弃它等于静默删除用户从 GitHub 导入的合法技能（D-08 明文禁止）。已用两条断言把边界钉死：`longdesc` 必须不在集合内、`skills/evil` 必须在集合内且仍进 prompt。
- **`errors[]` 在 try 开工处复位**：目录缺失诊断走 `pushError`（SKILL-06 要求「无对应技能的整批/环境级问题」进 `errors[]`），而 46-01 的写法是在**成功路径末尾**把 `errors` 整体置 `[]` —— 保持原序会把刚 push 的 `realm_skills_dir_missing` 清掉。改为开工即复位、之后只追加；失败路径由 catch 追加 `realm_refresh_failed`。
- **修正计划给的 `entryCost` 口径（数学错误）**：计划原文 `entryCost = format([skill]).length - fixedOverhead`，其中 `fixedOverhead = format([dummy]).length`。该式把前言与空条目开销在**每一条**上重复计入，`k` 条时累计值 `fixedOverhead + Σ entryCost = 实际段长 + (1-k)·e0 < 实际段长`，会让贪心放行到超预算（实测 40 条技能时实际段长 9404 > 8000，而计划要求的断言「段本体 ≤ 预算」随即失败）。改为真正的边际成本：`format([dummy, skill]).length - format([dummy]).length`（在一条已有条目的段上再加一条的成本）。修正后 `fixedOverhead + Σ entryCost = 实际段长 + e0 ≥ 实际段长`，预算约束成立且偏保守（多算约一个空条目的长度）。
- **`bySkillPriority` 排在遮蔽之后**：遮蔽的胜负由**输入顺序**决定（D-06：managed 先、user 后到者胜），可观测顺序由比较器决定 —— 两者职责正交，排序放前面会破坏遮蔽判定。比较器取代 46-02 的「输入顺序被原样保留」口径，成为集合顺序的唯一权威。
- **省略提示放在 SDK 技能段闭合标签之外**：这样「未截断」与「截断」两种情形的**段内前缀逐字节相同**，provider 前缀缓存友好；而截断事实由段尾提示 + digest 双双表达，不会静默。
- **`overLimit` 与 `disabled` 都只标记不剔除**：与 D-06 的遮蔽保留哲学对称 —— 过滤发生在**消费侧**（prompt 段组装、未来 Phase 48 的 `/skill:` 解析），数据层始终完整，设置页（Phase 50）才能列出它们来恢复。

## Deviations from Plan

1. **Task 3 的 `disabled` 标记与消费侧过滤随 Task 2 同批提交（`8ef45a1`）**：计划把「定序（④）」排在第 2 个任务、「启停标记（⑤）」排在第 3 个任务，而计划的启停 JSDoc 又明确要求标记发生在排序**之后**。两者在同一段管线代码里且顺序敏感，拆成两个提交会产生一个「排序已就位但启停尚未接线」的中间态（该中间态的 `eligible` 过滤里已含 `!e.disabled`，但无人写入 `disabled`）——语义上不可分割，故同批实现。Task 3 的提交（`5a6acc3`）补齐 digest 扩展与全部启停断言。
2. **`computeDigest` 签名扩展为 `(entries, promptBlock)`**：计划的 `artifacts_this_phase_produces` 未列该符号，但 Task 3 item 4 明确要求 digest 输入覆盖「截断结果」，而截断结果不是条目字段，只能从 `promptBlock` 取。
3. **`isDescriptionUnusable` 为计划外新增的内部函数**：计划只描述了「超长 description 被跳过」的行为，未规定实现形态。抽成独立纯函数是为了让「按 SDK 诊断模板前缀判定」这一脆弱点有唯一落点、可被 JSDoc 与源码断言同时钉住。
4. **注释中清除了若干符号字面量**：计划的源码断言要求 `ai-skills-manager.js` 中不存在区域敏感比较的符号名与手拼技能段标签。原 JSDoc 里的说明文字含这两个符号名，会命中扫描（假阳性）。按 46-01 的同类先例（YAML / ignore / harness 子路径）改为语义等价的无字面量表述。

三处实现细节比 plan 的 action 文本更具体，但都在 plan 语义范围内，不计为偏差：`rootSkipped` / `oversize` 的 `droppedNotices` 分流；省略提示的可解析句式（`Note: N of M skills omitted to stay within the prompt budget.`）按计划原文逐字实现；`dummySkill` 作为固定开销与边际成本的共同基准对象。

## Issues Encountered

- **子代理派发遇 provider 429**：wave 3 的 `gsd-executor` 子代理在创建后被 429 拒绝（配额重置于 2026-09-11 23:37 UTC+8，距当时 13 小时）。按既有降级策略（`feedback_subagent_429_fallback`）由主会话接管执行；接管前已用 `git log` / `git status` / 进程表确认无存活代理并发提交（无 46-03 提交、无 SUMMARY、无相关进程）。提交规范与子代理一致（逐任务原子提交 + SUMMARY）。
- **`git.base-branch --is-protected master` 返回 `true`**，而项目 `git.branching_strategy: "none"` 且全部历史提交在 master。按编排器指令（主工作树顺序执行 + 普通提交，`workflow.use_worktrees=false`）与项目既有约定在 master 提交，未改写任何 ref、未使用 worktree 语义、未跳过 hooks。与 46-01 / 46-02 的处理一致。
- **`.planning/state.json` 与 `.planning/milestone.lock` 保持 dirty/untracked**：两者在本次会话开始前即如此（非本计划产物），元数据提交未包含它们。

## Known Stubs

None —— `grep -nE "TODO|FIXME|not available|coming soon|placeholder|占位"` 对两个改动文件无命中。本计划新增的四个函数全部被 `refreshSkills` 实际调用，无未接线实现。

**刻意不产出（decided omission，非 stub）**：

- 禁用状态的**设置页呈现**归 Phase 50；`/skill:` 解析侧的 `disabled` 过滤归 Phase 48 —— 本计划只把过滤位（`disabled` / `overLimit` / `shadowed`）与诊断字段备齐。
- 限额数值（64 KiB / 50 / 8000）是否匹配真实用量校准属 STATE.md 的开放决策 O7（见 plan 的 `<flagged_assumptions>`）—— 本阶段只保证常量单源生效、超限可操作提示、预算口径自洽。

## Threat Flags

None —— 本计划未引入 threat_model 之外的新信任边界。六条 threat 的落地证据：

| Threat ID | 落地证据 |
|-----------|---------|
| T-46-03-01（超大/畸形 SKILL.md 触发同步 YAML 解析，high） | `createSkillsEnv.readTextFile` 在解析前按 `FileInfo.size` 拒绝 + `realm_skill_md_too_large`（含 limit/currentValue）；断言超限技能不进集合且无 `parse_failed` |
| T-46-03-02（技能数量/体积膨胀推高每请求成本，high） | `MAX_USER_SKILLS` 标 `overLimit` 不注入 + `SKILLS_PROMPT_CHAR_BUDGET` 整段预算贪心截断 + 段尾省略提示 + 预算诊断；两条限额独立生效并有断言 |
| T-46-03-03（加载失败被静默吞掉，high） | `toRealmDiag` 显式映射 + 模块级 `errors[]` + `realm_skills_dir_missing` 补 SDK 静默缺口；失败保留旧快照且记 error |
| T-46-03-04（禁用实现成删除文件/移除条目，medium） | `disabled` 只标记 + 消费侧过滤；断言刷新前后文件存在性与字节数一致、条目仍在集合内 |
| T-46-03-05（诊断 message 渲染进设置页造成注入，low，accept） | 本阶段无 UI（Phase 50 才渲染）；诊断内容为本地文件路径与 SDK 自产文本，无远端拼接 |
| T-46-03-SC（依赖安装，high） | 零新增依赖：`package.json` 未修改、未执行任何安装命令（依赖纪律源码扫描断言仍绿） |

新增诊断的 message 含工作区绝对路径，但**只存于 `_cache.diagnostics` / `_cache.errors` 与条目 `diagnostics[]`，不注入 system prompt** —— prompt 注入面与 46-01 一致（`<location>` 披露为 accept）。

## Self-Check

- FOUND: `ai-skills-manager.js`
- FOUND: `tests/test-ai-skills.js`
- FOUND: `0c8f21a`
- FOUND: `8ef45a1`
- FOUND: `5a6acc3`
- FOUND: `tests/test-ai-skills.js` 53/53 pass（exit 0；46-01 的 22 + 46-02 的 14 + 本计划 17）
- FOUND: `tests/test-agent-workspace.js` 21/21 pass（exit 0）
- FOUND: `tests/test-ai-bash-policy.js` 32/32 pass（exit 0）
- FOUND: `node --check ai-skills-manager.js` 与 `node --check tests/test-ai-skills.js` 均通过
- FOUND: 源码 gate —— 无区域敏感比较、无 `<available_skills>` 手拼模板、无 `.splice(`、无移除式 `_cache.skills = …filter(`、无 SDK harness 子路径导入
- FOUND: 硬约束 —— `git diff --stat <plan base>..HEAD` 仅两个文件（`agent-workspace.js` / `ai-manager.js` / `package.json` 零 diff）

---
phase: 46-prompt
plan: 2
subsystem: ai
tags: [skills, loading-pipeline, directory-authority, shadowing, diagnostics, dedup]

# Dependency graph
requires:
  - phase: 46-01
    provides: "ai-skills-manager.js 的 refreshSkills 异步加载 + 模块级 _cache + 同步零 IO 访问器；createSkillsEnv 加载面收窄（根层只认目录）；agent-workspace 的 getSkillsDir / getManagedSkillsDir；ai-manager 的 buildSystemPrompt 第 4 段"
provides:
  - "ai-skills-manager.js：inContractLayout(scannedDir, filePath) —— 契约布局判定（相对深度恰为 2 段）"
  - "ai-skills-manager.js：scanRootOf(rootDirs, filePath) 扫描根归属判定"
  - "ai-skills-manager.js：pushEntryDiag(entry, diag) —— 条目级与模块级诊断双写（D-07 口径落地）"
  - "ai-skills-manager.js：enforceDirNameAuthority(entry) —— 目录名为权威的名称重写（D-08）"
  - "ai-skills-manager.js：applyShadowing(entries) —— 同名遮蔽判定，败者保留并标注（D-06）"
  - "ai-skills-manager.js：refreshSkills 三层加载后管线（布局过滤 → 名称重写 → 遮蔽去重）+ prompt 段 !e.shadowed 过滤"
  - "缓存条目形状 { skill, source, diagnostics: [], shadowed?, shadowedBy? }"
  - "新诊断码：realm_layout_violation / realm_name_rewritten / realm_shadowed"
  - "tests/test-ai-skills.js：新增 3 组 describe 共 14 例断言（累计 36 例）"
affects: ["46-03", "46-04", "48", "49", "50", "51"]

# Actuals (#2632)
actuals:
  tokens: 4730
  tasks: 3
  commits: 3
  plan_head_before: f5005d202cfae511428415be5512e3ffe7857e93

# Tech tracking
tech-stack:
  added: []   # 零新增依赖（package.json 原样，未执行任何安装命令）
  patterns:
    - "加载后语义层三段管线：布局过滤 → 名称权威重写 → 遮蔽去重（顺序不可调换，step ③ 依赖 step ② 建立的 name 唯一性）"
    - "诊断双写助手 pushEntryDiag：条目级 diagnostics[] + 模块级 _cache.diagnostics 同源同实例"
    - "策略纯函数「只消费顺序不定义顺序」：applyShadowing 消费 loadSourcedSkills 的输入顺序，不重新定义优先级"
    - "断言优先钉在文件路径而非集合下标：优先级方向用「败者路径位于 managed-skills/ 下」表达，顺序断言留给唯一权威（46-03 bySkillPriority）"

key-files:
  created: []
  modified:
    - ai-skills-manager.js
    - tests/test-ai-skills.js

key-decisions:
  - "遮蔽败者不从 _cache.skills 剔除（返回数组与输入等长）：D-06 标注 costly —— Phase 48 要渲染来源徽标与被遮蔽者、Phase 50 要列表与诊断；改为「剔除只留诊断」需两个阶段同时改数据源与展示层"
  - "名称权威取自 path.basename(path.dirname(entry.skill.filePath))，并就地重写 entry.skill.name —— Skill 五字段契约没有位置字段（<location> 只是 XML 标签名），且 entry.skill 是本模块独占对象（loadSourcedSkills 的新返回），就地改安全"
  - "重写后「集合内每一条 name ≡ 所在目录名」成为集合级不变式 —— 这既是 /skill:name 解析确定性的前提，也是遮蔽判定无歧义（单目录内 name 天然唯一）的前提，故 applyShadowing 必须排在 enforceDirNameAuthority 之后"
  - "布局过滤定为 level:'warning' + realm_layout_violation，message 同时含实际 filePath 与目标路径建议（<扫描根>/<技能名>/SKILL.md）—— 属 D-05 第 1 层「正常态跳过」，不阻断其余技能（46-RESEARCH §Open Q2）"
  - "路径不归属任何扫描根时不丢弃（scanRootOf 返回 null → 该条目不参与布局过滤）—— 数据层优先，宁可保留也不静默剔除"
  - "诊断容器 _cache.diagnostics 在管线开始前就位（先落 SDK 诊断 + realm_root_entry_skipped），管线的每一步只做追加 —— 原先在管线末尾整体赋值，会让布局违规诊断被覆盖"
  - "prompt 段过滤统一为 !e.shadowed && e.skill.disableModelInvocation !== true；同一过滤后集合即 46-03 预算截断的输入（遮蔽条目不占预算，T-46-02-04）"
  - "本计划不对 getSkillsSnapshot().skills 的条目顺序做任何断言 —— 该顺序的唯一权威是 46-03 Task 2 的 bySkillPriority"

patterns-established:
  - "Realm 自建诊断 code 一律 realm_ 前缀且与 SDK 五枚举（file_info_failed / list_failed / read_failed / parse_failed / invalid_metadata）零重叠；源码扫描断言对本模块全量 realm_ 码做前缀 + 非重叠双重校验"
  - "源码扫描型断言的三件套：行为断言（跑管线看结果）+ 结构断言（functionBody 取函数体看实现）+ 反面断言（不得引用的字段名如 skill.location / 不得出现的 .splice( / .filter(）"

requirements-completed: [SKILL-05]

coverage:
  - id: D1
    description: "契约布局过滤：skills/a/b/SKILL.md（相对深度 3）不进 _cache.skills，且产 realm_layout_violation 诊断，message 同时含实际 filePath 与目标路径建议；契约布局（相对深度恰为 2）的技能一个不少"
    requirement: "SKILL-06"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#契约布局过滤（SKILL-06）"
        status: pass
    human_judgment: false
  - id: D2
    description: "名称权威（D-08）：skills/evil/SKILL.md 声明 name: find-skills 最终得 skill.name === 'evil' + realm_name_rewritten 诊断；集合内每一条 name 恒等于其所在目录名（系统性不变式）；重写 ≠ 丢弃（仍进 prompt）"
    requirement: "SKILL-06"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#名称权威（SKILL-06 / D-08）"
        status: pass
    human_judgment: false
  - id: D3
    description: "同名遮蔽（D-06）：user 与 managed 同名时 user 版进 prompt、managed 版 shadowed === true 且 shadowedBy === 'user' 并**保留在 skills[] 内**（长度 2）；败者带 realm_shadowed 诊断（条目级 + 模块级双写）；被遮蔽条目的 filePath 位于 managed-skills/ 之下"
    requirement: "SKILL-05"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#去重与遮蔽（SKILL-05）"
        status: pass
    human_judgment: false
  - id: D4
    description: "去重发生在注入之前：同名技能在 buildSkillsPrompt() 中只产出一条 <skill>（SDK formatSkillsForSystemPrompt 自身无 dedup，必须由 Realm 在调用前完成）"
    requirement: "SKILL-05"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#去重与遮蔽（SKILL-05）"
        status: pass
    human_judgment: false
  - id: D5
    description: "硬约束保持：agent-workspace.js 的 resolveInside / createSandboxEnv 零 diff；不为 managed-skills 加第二个沙箱 root 或只读挂载；零新增依赖"
    verification:
      - kind: other
        ref: "git diff --stat <plan base>..HEAD -- agent-workspace.js → 空；git diff --stat <plan base>..HEAD → 仅 ai-skills-manager.js 与 tests/test-ai-skills.js"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#依赖纪律（源码扫描）"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 02: 加载后语义层（契约布局 + 名称权威 + 遮蔽去重） Summary

**SDK 的递归扫描结果被收敛为 Realm 的契约布局（深嵌套不进集合）、名称权威从 frontmatter 收回到目录名（杜绝冒名）、同名来源冲突显式化为「遮蔽」——败者仍在数据层但不再进 prompt，三类新诊断全部可读可查**

## Performance

- **Duration:** 3min
- **Started:** 2026-09-11T01:58:40Z
- **Completed:** 2026-09-11T02:01:05Z
- **Tasks:** 3
- **Files modified:** 2（0 新建 / 2 修改）

## Accomplishments

- **加载后管线成形（顺序是契约）**：`refreshSkills` 现在是 `加载 → ① 契约布局过滤 → ② 目录名权威重写 → ③ 同名遮蔽判定 → 写 _cache`。② 必须早于 ③ —— 重写后单目录内 `name` 天然唯一，遮蔽判定才无歧义；把 ③ 提到 ② 之前会让「同一目录里的两个 name 冲突」变成无法判定的平局。
- **深嵌套技能不再静默进化技能集**：SDK 递归无深度上限（`skills.js:115-119` 无条件递归），从 GitHub 拷来的多一层目录包原本会加载出一个「不该存在」的技能。现在按**相对段数 === 2** 过滤（`path.sep` 感知，不是字符数、不是绝对路径段数），被跳过者产 `realm_layout_violation`，message 同时给出**实际在哪**（`<skills>/a/b/SKILL.md`）与**应该放哪**（`<skills>/b/SKILL.md`）—— 可操作，不停留在「加载失败」。
- **冒名被结构性杜绝（T-46-02-01，high）**：`skills/evil/SKILL.md` 声明 `name: find-skills` 原本可合法冒名（SDK `name = frontmatterName || parentDirName`，`validateName` 只产 warning 不拒绝）。现在 `enforceDirNameAuthority` 以 `path.basename(path.dirname(skill.filePath))` 为权威就地重写，并产 `realm_name_rewritten`。**重写 ≠ 丢弃**：命名不规范的合法技能（GitHub 导入常见）仍进 prompt，只是名字变成目录名。
- **「name ≡ 目录名」升级为集合级不变式**：测试用 `for` 循环遍历集合内**每一条**断言 `entry.skill.name === path.basename(path.dirname(entry.skill.filePath))`（非单例抽查）。这条不变式是 `/skill:name` 解析确定性的前提，也是遮蔽判定无歧义的前提。
- **同名不再双份进 prompt（T-46-02-03，high）**：SDK `formatSkillsForSystemPrompt` 自身**不做 name 去重**，user 与 managed 同名会产出两条 `<skill>`，模型看到两个同名技能且不知道信谁。现在 `applyShadowing` 后到者胜出（输入顺序 managed → user 即优先级编码），败者标 `shadowed` / `shadowedBy` 并**保留在 `_cache.skills` 内**（长度 2，不剔除），prompt 段经 `!e.shadowed` 过滤后同名只出一条。
- **遮蔽不占预算（T-46-02-04，low）**：prompt 组装处的过滤后集合即 46-03 预算截断的输入 —— 遮蔽条目不会挤压真实可用技能的预算空间。
- **诊断口径落地（D-07）**：`pushEntryDiag(entry, diag)` 把诊断**同时**写进条目级 `entry.diagnostics[]` 与模块级 `_cache.diagnostics`（同对象、同源）。口径声明已写进 JSDoc：D-07 所说的 `skill.diagnostics[]` 落在**缓存条目**上，`Skill` 本体保持 SDK 五字段形状不被注入私有字段（仅 `name` 按 D-08 重写），避免向 SDK 类型污染。
- **硬约束全部机械验证**：`resolveInside()` / `createSandboxEnv()` 零 diff；`package.json` 原样（零新增依赖，未执行任何安装命令）；本计划 diff 只落在 plan 声明的两个文件上。

## Task Commits

Each task was committed atomically:

1. **Task 1: 契约布局深度过滤 + `realm_layout_violation` 诊断** - `a6791be` (feat)
2. **Task 2: 目录名为权威的名称重写（D-08）+ `realm_name_rewritten` 诊断** - `49d47d7` (feat)
3. **Task 3: 同名遮蔽去重（user > managed，败者保留并标注）** - `36e905a` (feat)

**Plan metadata:** 见本文件所在提交（docs: complete 46-02 plan）

## Files Created/Modified

- `ai-skills-manager.js`（修改，+179/-6）— 新增 `inContractLayout` / `scanRootOf` / `pushEntryDiag` / `enforceDirNameAuthority` / `applyShadowing` 五个模块内部函数（全部刻意**不导出**，避免后续阶段绕过权威管线自拼一遍）；`refreshSkills` 加载后三段管线；`_cache.diagnostics` 容器提前就位；缓存条目形状文档更新（`{ skill, source, diagnostics, shadowed?, shadowedBy? }`）
- `tests/test-ai-skills.js`（修改，+298/-0）— 新增 `writeSkillAt(filePath, {...})` 任意布局写入助手 + 3 组 describe 共 14 例：`契约布局过滤（SKILL-06）` 4 例、`名称权威（SKILL-06 / D-08）` 5 例、`去重与遮蔽（SKILL-05）` 5 例。累计 **36 例**

**零 diff 声明（硬约束）**：`agent-workspace.js`、`ai-manager.js`、`package.json` 本计划逐字节未动 —— `git diff --stat <plan base>..HEAD` 只列出上述两个文件。

## Decisions Made

- **遮蔽败者保留（不剔除）**：D-06 标注 costly。Phase 48 要渲染来源徽标与「被遮蔽的同名技能可见」，Phase 50 要列表与诊断；改为「剔除只留诊断」需两个阶段同时改数据源与展示层。源码断言把这条钉死：`applyShadowing` 函数体内不得出现 `.splice(` / `.filter(`，返回数组必须与输入等长。
- **诊断容器提前就位（实现细节，但会静默失效）**：46-01 的写法是 `_cache.diagnostics = diagnostics.concat(droppedDiags)` 在管线**末尾**整体赋值。新增 layout 步骤后若保持原序，管线中 push 进去的 `realm_layout_violation` 会被末尾的赋值**整批覆盖**（诊断静默消失，且测试只在跑通管线时才会发现）。改为管线开始前赋值、之后只追加。
- **布局过滤对「无归属扫描根」放行**：`scanRootOf` 返回 null 时该条目不参与布局过滤 —— 不可判定则不丢弃，数据层优先。同时这也是防御性设计：未来若出现第三来源目录，不会因归属表未更新而误删技能。
- **不触碰 `computeDigest`**：遮蔽状态对 prompt 段的影响**必然伴随** entry 集合变化（遮蔽取决于 name + source 集合，两者都在 digest 输入里），故 digest 已完整覆盖 prompt 段变化因素；46-04 的 `syncAgentSystemPrompt()` 另有「prompt 逐字符相同」二次比对兜底。为保持 diff 聚焦，未给 digest 加 `shadowed` 字段。
- **优先级方向钉在文件路径上，不钉在集合下标上**：断言「被遮蔽者的 `filePath` 位于 `managed-skills/` 之下」。任何人把 `ai-manager.js` 的 `rootDirs` 顺序调换、或让 `applyShadowing` 不按输入顺序定胜负，被遮蔽的就会变成 `skills/` 下那份，断言立刻转红 —— 这条把「user 目录里的那一份永不被遮蔽」写成可机械检验的事实。
- **不导出任何新函数**：与 46-01 的 `createSkillsEnv` 同款纪律。导出会诱使 48/49/50 绕过 `refreshSkills` 自算一遍优先级/重命名，直接踩中 `<prohibitions>` 第 2 条（去重 / 优先级 / 名称权威不得有第二份）。

## Deviations from Plan

None —— plan executed exactly as written.

三处实现细节比 plan 的 action 文本更具体，但都在 plan 语义范围内，不计为偏差：

1. **新增 `scanRootOf(rootDirs, filePath)`**：plan 只描述了「对每个条目取它的 `filePath` 所属扫描根（`opts.rootDirs` 中作为它前缀的那一项）」，未规定实现形态。抽成独立纯函数是为了让 `path.resolve` 归一与「逃逸检测」（`rel !== '..'` 且不以 `../` 开头且非绝对路径）有唯一落点。
2. **`inContractLayout` 的相对段数判定用 `path.sep` 而非硬编码 `'/'`**：plan 的原文即 `split(path.sep)`（46-RESEARCH §Pattern 2 同款），一致。
3. **`_cache.diagnostics` 赋值位置从管线末尾前移**：plan 未指明位置；保持原位置会导致新诊断被覆盖（见 Decisions Made）。这是让 plan 的 must_haves 真值「`_cache.diagnostics` 中出现 `code === 'realm_layout_violation'` 的诊断」成立的**必要条件**。

## Issues Encountered

- **`requirements-completed` 只标 SKILL-05，未标 SKILL-06（有意为之）**：46-02 与 46-03 两份 PLAN 的 frontmatter **都**声明了 `SKILL-06`，且 SKILL-06 的完整语义含「透传到设置页」（落点 Phase 50）。本计划只闭合 SKILL-06 的**加载侧两半**（布局违规诊断 + 名称重写诊断）；诊断字段映射（`type` → `level`、`limit` / `currentValue`）归 46-03，设置页呈现归 50。按 46-01 的先例（「plan 只声明自己终结的需求」——46-01 也做了部分 SKILL-06 工作但未把它写进 `requirements-completed`），本计划把 SKILL-06 留给终结它的 46-03 标记，避免提前点亮「已完成」。SKILL-05 由本计划终结（D-06 全部语义：去重、user 优先、败者可见、注入前去重），已标完成。
- **`git.base-branch --is-protected master` 返回 `true`，而项目 `git.branching_strategy: "none"` 且全部历史提交都在 master**：本计划按编排器指令（主工作树顺序执行 + 普通 git 提交，`workflow.use_worktrees=false`）与项目既有约定在 master 上提交，未改写任何 ref、未使用 worktree 语义。与 46-01 的处理一致。

## Known Stubs

None —— `grep -nE "TODO|FIXME|not available|coming soon|placeholder|占位"` 对两个改动文件无命中。本计划新增的五个函数全部被 `refreshSkills` 实际调用，无未接线实现。

**刻意不产出（decided omission，非 stub）**：

- `enforceDirNameAuthority` 目前只做「重写 + 诊断」，不含「是否应拒绝加载」的判定 —— D-08 明确要求重写而非拒绝（不丢弃命名不规范的合法技能）。
- 遮蔽的**可观测顺序**（`getSkillsSnapshot().skills` 的条目顺序）不在本计划范围内，由 46-03 Task 2 的 `bySkillPriority` 唯一规定。本计划刻意不做顺序断言，避免与 46-03 的权威冲突。

## Threat Flags

None —— 本计划未引入 threat_model 之外的新信任边界。四条 mitigate 项均已落地并有断言：

| Threat ID | 落地证据 |
|-----------|---------|
| T-46-02-01（冒名，high） | `enforceDirNameAuthority` + `realm_name_rewritten`；测试断言「集合内每一条 name ≡ 目录名」的系统性不变式 |
| T-46-02-02（深嵌套静默加载，medium） | `inContractLayout` + `realm_layout_violation`（含实际路径与目标建议）；测试断言违规条目不进集合、契约布局不误伤、无非技能目录误报 |
| T-46-02-03（同名静默双份注入，high） | `applyShadowing` 后到者胜出 + 败者 `shadowed` / `shadowedBy` + `realm_shadowed`；prompt 组装 `!e.shadowed` 过滤 + 断言 `<skill>` 只一条 |
| T-46-02-04（遮蔽条目挤占预算，low） | prompt 组装使用同一过滤后集合；该集合即 46-03 预算截断的输入 |
| T-46-02-SC（依赖安装，high） | 零新增依赖：`package.json` 未修改、未执行任何安装命令、未引入 frontmatter/忽略文件解析库（依赖纪律源码扫描断言仍绿） |

新增的三条诊断 message 只描述技能自身的布局/命名/遮蔽事实，**不注入 system prompt**（仅存于 `_cache.diagnostics` 与条目 `diagnostics[]`），未扩大 prompt 注入面；`<location>` 披露面与 46-01 一致（T-46-01-05 为 accept）。

## Self-Check

- FOUND: `ai-skills-manager.js`
- FOUND: `tests/test-ai-skills.js`
- FOUND: `a6791be`
- FOUND: `49d47d7`
- FOUND: `36e905a`
- FOUND: `tests/test-ai-skills.js` 36/36 pass（exit 0；46-01 的 22 例 + 本计划 14 例）
- FOUND: `tests/test-agent-workspace.js` 21/21 pass（exit 0）
- FOUND: `tests/test-ai-bash-policy.js` 32/32 pass（exit 0）
- FOUND: `tests/test-ai-conversations.js` 111/111 pass（exit 0）
- FOUND: `node --check ai-skills-manager.js` 与 `node --check tests/test-ai-skills.js` 均通过
- FOUND: 源码 gate —— `skill.location` 不出现（false）；本模块全部 `realm_` 诊断码（5 个）与 SDK 五枚举零重叠、无缺前缀
- FOUND: 硬约束 —— `git diff --stat <plan base>..HEAD` 仅两个文件（`agent-workspace.js` / `ai-manager.js` / `package.json` 零 diff）

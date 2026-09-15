---
phase: 46-prompt
plan: 1
subsystem: ai
tags: [skills, agent-workspace, sandbox, system-prompt, module-cache, tracer]

# Dependency graph
requires:
  - phase: 43
    provides: "模块级冻结快照 + 同步只读访问器形态（ai-memory-manager.buildGlobalSnapshot，含 G-42-4 同步契约事故记录）与常量单源先例（BUDGETS）"
  - phase: 44-45
    provides: "agent-workspace 硬沙箱（createSandboxEnv / resolveInside）与 ensureWorkspaceDir 启动序列（main.js:4040）"
provides:
  - "agent-workspace.js：getSkillsDir() / getManagedSkillsDir() 两个目录访问器（均由 getWorkspaceDir() 派生），ensureWorkspaceDir() 自动创建两目录"
  - "ai-skills-manager.js：技能集唯一数据权威（LIMITS 三限额单源 / refreshSkills 异步加载 / buildSkillsPrompt + getSkillsSnapshot 同步零 IO 访问器 / _resetCacheForTest）"
  - "ai-skills-manager.js 模块内部 createSkillsEnv：加载面收窄薄 env（扫描根只认目录 + SKILL.md 字节预筛 + droppedNotices 不静默）"
  - "ai-manager.js：getAiSkillsManagerLazy() / buildSystemPrompt() 条件第 4 段（技能段固定末段）/ init() new Agent 前无条件 await refreshSkills / module.exports.buildSystemPrompt"
  - "tests/test-ai-skills.js：22 例断言（端到端纵切 + 加载面收窄回归守卫 + SKILL-01/02/03 + 依赖纪律源码扫描）"
affects: ["46-02", "46-03", "46-04", "47", "48", "49", "50", "51"]

# Actuals (#2632)
actuals:
  tokens: 7065
  tasks: 3
  commits: 3
  plan_head_before: aa68cfb2cc5802706d62fcbc72d003fcd3d29690

# Tech tracking
tech-stack:
  added: []   # 零新增依赖（package.json dependencies/devDependencies 原样）
  patterns:
    - "薄 env 语义收窄：在硬沙箱 env 之上再包一层做加载面收窄（展开式转发、不用 Proxy）"
    - "异步加载 → 模块级缓存 → 同步只读（G-42-4 同步契约的第二次落地）"
    - "源码扫描型断言（本仓库 tests/ 首个静态检查先例），含断言自校验"

key-files:
  created:
    - ai-skills-manager.js
    - tests/test-ai-skills.js
  modified:
    - agent-workspace.js
    - ai-manager.js

key-decisions:
  - "技能段固定为 system prompt 第 4 段（末段），前三段全静态 —— 技能集变更不影响冻结记忆段的前缀缓存边界（D-01）"
  - "技能段文本原样使用 SDK formatSkillsForSystemPrompt 返回值，空态整段不追加（D-02：不自写中文前缀、不产生空标签与多余空行）"
  - "加载面收窄发生在 SDK 遍历之前（薄 env 覆写 listDir/readTextFile），而非事后过滤 —— 根层 SKILL.md 短路与 YAML 解析都无法事后挽回"
  - "技能目录一律由 getWorkspaceDir() 派生，不为 managed-skills 引入第二个沙箱 root / 只读挂载；resolveInside 与 createSandboxEnv 本阶段零 diff"
  - "createSkillsEnv / computeDigest 等保持模块内部函数（不导出），测试只经公开面断言，避免后续阶段绕过权威管线自拼一遍"
  - "整批 refreshSkills 失败保留上一次成功快照并记 realm_refresh_failed error 诊断（D-05 第 2 层的提前落地；完整诊断映射仍归 46-03）"

patterns-established:
  - "薄 env 语义收窄（createSkillsEnv）：镜像 createSandboxEnv 的「显式转发每个方法、不用 Proxy」纪律，只覆写需收窄的方法"
  - "Realm 自建诊断以 realm_ 前缀与 SDK 5 个枚举 code 不重叠（本计划落地 realm_root_entry_skipped / realm_refresh_failed）"
  - "源码扫描型断言 + 扫描正则自校验（证明正则本身有效，避免断言恒真）"

requirements-completed: [SKILL-01, SKILL-02, SKILL-03]

coverage:
  - id: D1
    description: "agent-workspace 启动时自动创建 skills/ 与 managed-skills/，两目录位于硬沙箱 root 内且沙箱 readTextFile 可读取其中任意 SKILL.md"
    requirement: "SKILL-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#技能目录与沙箱可达（SKILL-01）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#端到端纵切（tracer）"
        status: pass
    human_judgment: false
  - id: D2
    description: "system prompt 第 4 段动态注入 <available_skills>（含 name / description / location）；空技能集时整段不出现且 prompt 与三段基线逐字符相同"
    requirement: "SKILL-02"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#prompt 段注入（SKILL-02）"
        status: pass
    human_judgment: false
  - id: D3
    description: "技能加载异步完成后同步可读：buildSkillsPrompt() 同步返回字符串（非 Promise、零 IO），getSkillsSnapshot() 返回浅拷贝视图，同一目录两次刷新的 digest 与 prompt 段稳定"
    requirement: "SKILL-03"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#模块级缓存 + 同步访问器（SKILL-03）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#接线与导出面（源码断言）"
        status: pass
    human_judgment: false
  - id: D4
    description: "加载面收窄落在 SDK 遍历之前：根层 SKILL.md 不再顶替整组、根层散落 md 不再变幽灵技能、超大 SKILL.md 在 frontmatter 解析前被拒，且每次过滤都有可读诊断（禁止静默）"
    requirement: "SKILL-06"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#加载面收窄（回归守卫）"
        status: pass
    human_judgment: false
  - id: D5
    description: "依赖纪律：新增/修改的两个 AI 模块不含对 YAML / ignore 库的直接 require，也不含 SDK 子路径导入；零新增依赖"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#依赖纪律（源码扫描）"
        status: pass
      - kind: other
        ref: "node -e \"const p=require('./package.json'); ...\" → 退出 0；git diff package.json 为空"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 01: 技能基础设施端到端纵切 Summary

**技能目录落进硬沙箱 root、经薄 env 收窄加载面后进模块级缓存，再由同步零 IO 访问器拼成 system prompt 第 4 段；模型在 prompt 里看到的 `<location>` 已被真实沙箱 `readTextFile` 验证可打开**

## Performance

- **Duration:** 5min
- **Started:** 2026-09-11T01:49:15Z
- **Completed:** 2026-09-11T01:54:40Z
- **Tasks:** 3
- **Files modified:** 4（2 新建 / 2 修改）

## Accomplishments

- **端到端纵切一次打通并自证**：`skills/alpha/SKILL.md` → `refreshSkills`（经收窄 env）→ `_cache.promptBlock` → `buildSystemPrompt()` 含 `<available_skills>` 与 `<location>` → 该 `filePath` 经真实 `createSandboxEnv().readTextFile()` 返回 `ok: true`。这条链路证明「模型看得到 location 却永远 read 不到」的无声失效已被消除。
- **加载面收窄落在 SDK 遍历之前**（而非事后过滤），三个否则无法挽回的问题被一次性封住：
  - 根层误放 `SKILL.md` 不再短路整组（实测原生 SDK 行为 `["rooty"]`，收窄后 `["alpha"]`）
  - 根层散落 `*.md` 不再变成 `name === 扫描根目录名` 的幽灵技能（实测原生行为产出 `["skills"]`）
  - 超大 `SKILL.md` 在 frontmatter 解析前按 `FileInfo.size` 被拒（诊断落在 `read_failed` 而非 `parse_failed`，证明未进解析）
  - 每一次过滤都产 `realm_root_entry_skipped` 诊断 —— 无静默丢弃
- **同步契约为后续计划定死**：`buildSkillsPrompt()` / `getSkillsSnapshot()` 零 IO、非 Promise；同一技能集两次刷新的 `digest` 与 `promptBlock` 逐字节稳定 —— 46-04 的「digest 相同且 prompt 逐字符相同才跳过回写」由此成立。
- **沙箱零改动得到机械验证**：`git diff agent-workspace.js` 只落在「2 个访问器 + 2 行 mkdir + 2 项导出 + 头注释」；`resolveInside()` / `createSandboxEnv()` 逐字节未动。
- **既有回归全绿**：`test-agent-workspace.js` 21/21（证明新增 2 行 `mkdirSync` 幂等）、`test-ai-bash-policy.js` 32/32、`test-ai-conversations.js` 111/111。

## Task Commits

Each task was committed atomically:

1. **Task 1: 端到端最小技能纵切（目录 → 沙箱加载 → 缓存 → prompt 第 4 段 → 可 read）** - `b12b57d` (feat)
2. **Task 2: `createSkillsEnv` 加载面收窄（根层只认目录 + SKILL.md 字节预筛 + 禁静默）** - `1d2baf5` (feat)
3. **Task 3: SKILL-01/02/03 断言补齐（沙箱归属 + prompt 契约 + 同步零 IO + 依赖纪律）** - `3090c34` (test)

**Plan metadata:** 见本文件所在提交（docs: complete 46-01 plan）

## Files Created/Modified

- `ai-skills-manager.js`（新建，260 行）— 技能集唯一数据权威：`LIMITS` 三限额单源、模块级 `_cache`、`createSkillsEnv` 薄 env 收窄、`refreshSkills` 异步加载、`buildSkillsPrompt` / `getSkillsSnapshot` 同步零 IO 访问器、`_resetCacheForTest`
- `tests/test-ai-skills.js`（新建，430 行）— 22 例断言、7 个 describe 分组：端到端纵切 / 加载面收窄回归守卫 / SKILL-01 / SKILL-02 / SKILL-03 / 依赖纪律源码扫描 / 接线与导出面
- `agent-workspace.js`（修改，+29/-1）— 新增 `getSkillsDir()` / `getManagedSkillsDir()`（均派生自 `getWorkspaceDir()`）、`ensureWorkspaceDir()` 追加 2 行幂等 `mkdirSync`、导出面追加 2 项、头注释目录清单补两目录。**`resolveInside()` / `createSandboxEnv()` 零 diff**
- `ai-manager.js`（修改，+36/-4）— 新增 `getAiSkillsManagerLazy()`；`buildSystemPrompt()` 第 4 段条件追加（空态整段不追加）；`init()` 在 `new Agent(` 之前无条件 `await refreshSkills(...)`（`configStore` 注入式读取，manager 侧零 configStore 依赖）；追加 `module.exports.buildSystemPrompt`

## Decisions Made

- **技能段固定第 4 段（末段）**：前三段全静态，技能集变更只影响末尾（D-01）。`buildSystemPrompt()` 的 JSDoc 已把「三处都必须经此函数」「技能段在末段、前三段全静态 → 前缀缓存恒命中」写成契约注释。
- **技能段文本原样透传 SDK 返回值**：不自写中文段、不加前缀；空态返回 `''` 时整段不追加（D-02）。测试以「与三段基线逐字符相同」锁死，比只断言「不含 available_skills」更强。
- **`<available_skills>` 出现次数按带尖括号的开闭标签分别计数**：plan 的 must_haves 表述为「`<available_skills>` 只出现一次」；裸子串 `available_skills` 会同时命中闭合标签 `</available_skills>` 而得到 2，故断言拆成开/闭标签各计 1 次（语义等价且无歧义）。
- **收窄只在 `path.resolve(p)` 精确命中两个扫描根时生效**：实测 `sandboxEnv.fileInfo(root)` 返回的就是 `/var/...` 词法形态（非 `/private/var` realpath），单次 `path.resolve` 比对即可，无需引入 `fs.realpath` 与额外 IO。
- **`createSkillsEnv` 不导出**：它是被 `refreshSkills` 编排的实现细节，导出会诱使后续阶段绕过权威管线自拼一遍。字节上限的行为断言因此改走公开面（`refreshSkills` → `_cache.diagnostics` 的 `read_failed` 与消息内容）。
- **`_cache.errors` + `realm_refresh_failed` 提前落地**：整批刷新失败时保留上一次成功快照、不清空、不静默（D-05 第 2 层）。完整的诊断形状映射（`type` → `level`、`limit` / `currentValue`）仍按计划归 46-03。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 缺失的关键约束] `ai-skills-manager.js` 注释中含被禁止的库名/子路径字面量**
- **Found during:** Task 3（依赖纪律源码扫描）
- **Issue:** Task 1/2 写下的模块注释里出现了 `YAML` / `ignore` 两个库名与 `harness 子路径` 的提法。plan 的 `<prohibitions>` 第 5 条明确要求「也不要把这些库名/子路径字面量写进注释 —— 源码扫描会命中注释」。虽则本计划的两条扫描正则（`require('yaml'|'ignore')` 形式、`pi-agent-core/harness/` 全路径形式）都不会命中这些散文措辞，但硬约束要求不出现字面量。
- **Fix:** 把 5 处注释改为语义等价的无字面量表述（`YAML 解析` → `frontmatter 解析`、`其 YAML / ignore 实现` → `其 frontmatter 解析与忽略文件匹配实现`、`.ignore / .gitignore` → `忽略文件`、`无 harness 子路径入口` → `exports map 无子路径入口`）。
- **Files modified:** `ai-skills-manager.js`（**注释-only**，`git diff` 已逐行核对无代码变更）
- **Verification:** `node tests/test-ai-skills.js` 22/22 通过；`node --check ai-skills-manager.js` 通过
- **Committed in:** `3090c34`（含在 Task 3 提交内）

**文件集偏差说明**：Task 3 的 `<files>` 只声明 `tests/test-ai-skills.js`，上述注释修正在 `ai-skills-manager.js`。这是执行 plan 自身第 5 条禁止项的必然结果，且 Task 3 item 4 本就把「注释纪律」写进了执行范围（"**执行纪律：不要把上述两个库名或该子路径字面量写进 `ai-skills-manager.js` / `ai-manager.js` 的任何注释**"）。改动为注释-only，无行为影响。

---

**Total deviations:** 1 auto-fixed（Rule 2）
**Impact on plan:** 无范围蔓延 —— 修正的是本计划自身引入的注释违反项，未改动任何行为、未新增依赖、未触碰沙箱。

## Issues Encountered

- **验收口径歧义（已按语义解决，非问题）**：plan 的 `<acceptance_criteria>` 要求断言「`createSkillsEnv` 的 `readTextFile` 返回 `ok === false`」，但同份 plan 的 `<artifacts_this_phase_produces>` 明确把 `createSkillsEnv` 列为「刻意不导出 —— 保持模块内部函数」。两者冲突时以「不导出」为准（它是被禁止的诱因，导出面清单是 decided omission），字节上限行为改经 `refreshSkills` 的公开面断言：断言技能未被加载、诊断 `code === 'read_failed'` 且消息同时含限额值 `65536` 与文件实际字节数、且**不出现** `parse_failed`（证明未进 frontmatter 解析）。
- **`git.base-branch --is-protected master` 返回 `true`，而项目 `git.branching_strategy: "none"` 且全部历史提交都在 master**：本计划按编排器指令（主工作树顺序执行 + 普通 git 提交）与项目既有约定在 master 上提交，未改写任何 ref、未使用 worktree 语义。

## Known Stubs

None —— 三处「刻意不产出」均为 decided omission（`resolveSkill` / `toRealmDiag` / `inLayout` 等归后续阶段），且 plan 已在 `<artifacts_this_phase_produces>` 显式登记，非本计划未完成的占位。已用 `grep -nE "TODO|FIXME|not available|coming soon|placeholder|占位"` 扫描三个改动源文件，无命中。

## Threat Flags

None —— 本计划未引入 threat_model 之外的新信任边界。`createSkillsEnv` 的收窄（T-46-01-01）、目录路径来源（T-46-01-02）、超大 SKILL.md（T-46-01-03）、零新增依赖（T-46-01-SC）四条 mitigate 项均已在实现与断言中落地；T-46-01-04（description 注入面）与 T-46-01-05（location 路径披露）为 accept，与 plan 一致。新增的 `realm_refresh_failed` 错误消息只存于 `_cache.errors`，**不注入 system prompt**，未扩大注入面。

## Self-Check

- FOUND: `ai-skills-manager.js`
- FOUND: `tests/test-ai-skills.js`
- FOUND: `b12b57d`
- FOUND: `1d2baf5`
- FOUND: `3090c34`
- FOUND: `tests/test-ai-skills.js` 22/22 pass（exit 0）
- FOUND: `tests/test-agent-workspace.js` 21/21 pass（exit 0）
- FOUND: `node --check` 三文件全过

---
phase: 47-bash
plan: 1
subsystem: ai-skills
tags: [builtin-skills, seeder, asarUnpack, atomic-copy, sha256-diff, zero-install, skill-scanner, diagnostics]

# Dependency graph
requires:
  - phase: 46-prompt
    provides: ai-skills-manager 的技能集单一数据权威（refreshSkills / buildSkillsPrompt / getSkillsSnapshot / _resetCacheForTest）、agent-workspace 的 getManagedSkillsDir() / ensureWorkspaceDir() / migrateAiMemory() 先例、诊断形状（realm_ 前缀 / level / code / message / path）
provides:
  - 随包内置技能源目录 skills-builtin/（find-skills 零安装改写版 + MIT LICENSE.txt）
  - builtin-skills-seeder.js（随包内置技能唯一播种者；seeded 身份 = 随包目录名集合，零状态文件零硬编码）
  - main.js 启动期同步播种调用（ensureWorkspaceDir → migrateAiMemory → seedBuiltinSkills → new AIManager）
  - package.json build.asarUnpack 的 skills-builtin/** 条目（与运行时路径解析成对）
  - 4 个播种诊断 code 与检验其真实可达的测试面
  - 零安装语义二段式静态扫描器（FORBIDDEN_PATTERNS / INSTALL_IMPERATIVES / EXEMPTIONS）
affects: [47-02, 47-03, 47-04, 48, 49, 50]

# Actuals (#2632)
actuals:
  tokens: 16122
  tasks: 3
  commits: 3
  plan_head_before: 1ad621ec7b2eab830abcfafc317e222b65770d0f

tech-stack:
  added: []          # 零新增依赖（package.json 的 dependencies / devDependencies 原样）
  patterns:
    - "原子目录替换：tmp → bak → rename → 回滚（tmp/bak 与目标同父目录保证同卷）"
    - "内容差异检测的逐层短路：相对路径集合 → size → sha256，绝不用 mtime"
    - "seeded 身份 = 扫随包目录名集合（零状态文件），而非持久化登记表"
    - "诊断 code 必须真实可达：先报（独立源目录扫描）后滤（getSeededSkillNames）的串行关系"
    - "二段式零安装语义扫描：第 1 段零容忍按 glob，第 2 段带行级豁免用排除法"

key-files:
  created:
    - skills-builtin/find-skills/SKILL.md
    - skills-builtin/find-skills/LICENSE.txt
    - builtin-skills-seeder.js
    - tests/test-builtin-skills-seeder.js
  modified:
    - main.js
    - package.json

key-decisions:
  - "随包分发走 asarUnpack + app.isPackaged 路径分支（D-12）：package.json 的 asarUnpack 与运行时 path.join(process.resourcesPath,'app.asar.unpacked','skills-builtin') 成对；开发态显式回落 __dirname（与 nodejieba 先例的差异点）"
  - "播种粒度 = 单个技能目录（D-08）：逐个判定与同步，不为已存在的技能提前返回，否则日后新增的内置技能永不播种"
  - "覆盖前差异诊断是 warning 而非 error（D-09）：覆盖照常完成，诊断只负责可见性；定制走 skills/ 同名遮蔽、停用走设置页"
  - "差异检测按内容（size + sha256）而非时间戳：每次启动都覆盖会让 mtime 必变，用 mtime 判差异等于每次启动 100% 误报"
  - "realm_builtin_src_invalid 由 seedBuiltinSkills 的独立源目录扫描产出（先报后滤），getSeededSkillNames 只过滤不产诊断 —— 评审裁决项 1"
  - "find-skills 正文的禁令段只描述语义、不出现任何被扫字面 token：用「绕过任何确认提示」而非被封禁的中文字面写法，等价语义由措辞覆盖"
  - "SKILL.md 的 description 用中文（D-04）：disable-model-invocation 使其不进 system prompt，description 的实际消费者是 / 面板与设置页的人眼可读性"

patterns-established:
  - "原子目录替换（safeCopyDir）：复制到 <dst>.tmp_<ts> → 旧目录改名 <dst>.bak_<ts> → rename 覆盖 → 删 bak；rename 失败回滚 bak 并清理 tmp；_cleanupDir 自身吞错"
  - "fail-safe 差异判定：IO 错误（readdir/stat/read 抛错）一律返回 different 而非抛出，保证播种不会被整体跳过"
  - "fail-closed symlink 处理：随包源本不应含 symlink，遇之抛错经诊断上报并跳过该技能，绝不跟随复制"
  - "测试注入抽象层次分层：resolveBuiltinSkillsSrc 收 Electron 原语（isPackaged/resourcesPath/dirname），setBuiltinDepsForTest 收更高层的目录（覆盖两个函数的返回值）"
  - "扫描范围按 glob 递归表达：写死单技能路径会让后续阶段新增的技能静默逃出扫描面"

requirements-completed: [SEED-01, SEED-02, SEED-03, SEED-04]

coverage:
  - id: D1
    description: "随包 find-skills 已 Realm 化为「零安装候选清单技能」：正文中文、只经 web_fetch/web_search 检索 GitHub 仓库搜索接口，frontmatter 含 disable-model-invocation: true；随附 MIT LICENSE.txt"
    requirement: "SEED-01"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#第 1 段（零容忍无豁免）：SKILL.md + LICENSE.txt 全量零命中"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#PITFALLS P1 靶心：skills-builtin/** 内不存在 npx skills 的任意变体"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#SEED-04：每个内置技能 frontmatter 含 disable-model-invocation: true 且 description 含中文"
        status: pass
      - kind: other
        ref: "反向验证：临时追加一行 npx skills add foo -g -y → 3 条用例变红（含文件:行号 + 命中模式 + 理由），还原后 33/33 全绿"
        status: pass
    human_judgment: false
  - id: D2
    description: "builtin-skills-seeder.js：随包源解析 / seeded 身份 / 原子目录替换 / 内容差异检测 / 单技能目录粒度播种 / 4 个诊断 code 全部真实可达"
    requirement: "SEED-02"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#幂等：连续两次播种，第二次零差异零诊断，产物字节不变"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#不静默覆盖：手改后重跑 → warning 诊断「且」目标被覆盖为随包版本"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#自愈重播：手删目录后重跑 → 目录重现且不产覆盖诊断（missing 语义）"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#原子性：safeCopyDir 失败不留半成品，也不残留 .tmp_* / .bak_*"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#symlink fail-closed：含 symlink 的技能被跳过并产 seed_failed，同批其余技能照常播种"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#realm_builtin_src_invalid 真实触发：缺 SKILL.md 的源子目录 → error 诊断且不阻断其余技能"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#不可读文件 → detectDiff 返回 different 且不抛错"
        status: pass
      - kind: other
        ref: "反向验证：临时删掉独立源目录扫描 → src_invalid 用例变红（1/24 fail），还原后 24/24 全绿"
        status: pass
    human_judgment: false
  - id: D3
    description: "端到端纵切：随包 skills-builtin/find-skills → 播种 → managed-skills/find-skills（逐字节相同）→ refreshSkills 零诊断识别 name/source → buildSkillsPrompt() === ''"
    requirement: "SEED-04"
    verification:
      - kind: integration
        ref: "tests/test-builtin-skills-seeder.js#真实随包 skills-builtin → 播种 → managed-skills → 零诊断加载 → 不进 prompt"
        status: pass
      - kind: unit
        ref: "node tests/test-agent-workspace.js（21 例）/ node tests/test-ai-skills.js（64 例）回归全绿，证明 agent-workspace.js 零 diff"
        status: pass
    human_judgment: false
  - id: D4
    description: "启动接线与打包配置：main.js 在 migrateAiMemory() 之后、new AIManager() 之前同步播种；package.json 的 build.asarUnpack 追加 skills-builtin/**"
    requirement: "SEED-02"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#main.js 中播种调用位于 migrateAiMemory() 之后、new AIManager() 之前"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#package.json 的 build.asarUnpack 两侧成对（nodejieba 保留 + skills-builtin 新增）"
        status: pass
      - kind: unit
        ref: "node --check builtin-skills-seeder.js && node --check main.js && node --check tests/test-builtin-skills-seeder.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "打包态（app.isPackaged）路径分支在真实 .app 内生效：make install-nightly 后启动，managed-skills/ 出现内置技能且加载器零诊断"
    requirement: "SEED-02"
    verification: []
    human_judgment: true
    rationale: "本计划的全部断言都在「开发态 + 临时 root 注入」下运行，测不到 process.resourcesPath/app.asar.unpacked 那条分支（打包态才会走到）。按 47-PLAN 的 edge_coverage_ledger 第 1 行，这是显式 flagged assumption，由 47-04 的 make install-nightly 人工实跑收口；nodejieba 事故 9a1ae11 同型风险。"
  - id: D6
    description: "SEED-04 的机械证据只覆盖「该技能不占 prompt 段」，不覆盖显式调用（/skill:name）下模型能否读到正文"
    requirement: "SEED-04"
    verification: []
    human_judgment: true
    rationale: "buildSkillsPrompt() === '' 证明 disable-model-invocation: true 生效（不进 system prompt），但显式调用链路在 Phase 48 才实现。按 47-PLAN 的 edge_coverage_ledger 第 2 行，这是显式 flagged assumption。"

duration: 12min
completed: 2026-09-11
status: complete
---

# Phase 47 Plan 01: 端到端最小播种纵切 Summary

**随包 `skills-builtin/find-skills`（零安装语义改写版）经 `builtin-skills-seeder.js` 原子播种进 `agent-workspace/managed-skills/`，技能加载器零诊断识别、因 `disable-model-invocation: true` 不进 system prompt —— 并以二段式静态扫描器把「零安装语义」变成机器可检的门禁**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-11T09:23:12Z
- **Completed:** 2026-09-11T09:34:33Z
- **Tasks:** 3 / 3
- **Files modified:** 6（4 新建 / 2 修改）

## Accomplishments

- **P1 门禁的文本半落地**：find-skills 从上游的「安装说明书」（原文第 100/103 行逐字解释 `-g` 装到全局、`-y` 跳过确认）改写为 Realm 的「零安装候选清单技能」——正文里根本没有可执行的安装路径，检索只经既有的 `web_fetch` / `web_search` 工具层；禁令段显式声明「本节刻意不逐条列举具体命令名」。
- **随包 → 播种 → 加载 → 不进 prompt 的完整链路一次打通**（本阶段唯一的 tracer）：真实 `skills-builtin/` 经 `seedBuiltinSkills()` 落到 `managed-skills/find-skills/`（SKILL.md 与 LICENSE.txt 逐字节相同），`refreshSkills()` 零诊断加载出 `name: find-skills` / `source: managed`，`buildSkillsPrompt()` 返回 `''`。
- **播种具备生产级失败语义**：整目录原子替换（tmp → bak → rename → 回滚，失败不留半成品、无 `.tmp_*` / `.bak_*` 残留）；覆盖用户手改一定可见（warning 级 `realm_builtin_seed_overwritten`，但覆盖照常完成）；用户手删后自愈重播；源目录被投毒（symlink）时 fail-closed 跳过；源缺失产 error 且不 throw（不阻断启动）；IO 错误按 fail-safe 判 `'different'` 重同步。
- **4 个诊断 code 全部真实可达**：`realm_builtin_src_invalid` 此前是不可达的保留 code（`getSeededSkillNames()` 的 `existsSync(SKILL.md)` 已把缺件子目录过滤掉）。本计划用「独立源目录扫描**先报** → `getSeededSkillNames()` **后滤**」的串行控制流修复，并用反向验证证明用例不是空转。
- **零安装语义成为机器可检门禁**：二段式扫描器（第 1 段零容忍按 glob 扫全部 `SKILL.md` + `LICENSE.txt`；第 2 段带行级豁免、用排除法覆盖其余全部内容）+ `npx skills` 专项断言 + `npm exec` 正例断言 + SEED-04 / D-11 / SKILL-09 反向证据。
- **既有回归零破坏**：`tests/test-agent-workspace.js` 21/21、`tests/test-ai-skills.js` 64/64 全绿，且 `git diff BASE..HEAD -- agent-workspace.js` 为空（沙箱层零 diff 硬约束成立）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 端到端最小播种纵切（tracer）** - `e137d83` (feat)
2. **Task 2: 播种原子性、差异诊断与自愈** - `420d751` (feat)
3. **Task 3: 零安装语义扫描器与门禁断言** - `02d8a93` (test)

**Plan metadata:** (见本 plan 收尾的 docs 提交)

_注：Task 1 是 `type="tracer"`；auto 模式下 tracer 门禁按 `<verify>` 端到端复跑通过后自动展开 —— `⚡ Tracer verified end-to-end — expanding`。_

## Files Created/Modified

- `skills-builtin/find-skills/SKILL.md`（新建，120 行）- Realm 化改写版技能正文：中文；八字边界禁令段置于最前（只产出候选清单 / 不调用任何包管理器与包执行器 / 不发起管道执行与即时执行 / 不涉及全局位置 / 不绕过确认提示）；三步检索流程（`web_fetch` 打 GitHub 仓库搜索接口并**显式传 `maxLength: 30000`** → 逐条核验 → 仅当第 1 步失败才用 `web_search` 兜底）；检索端点与 `q=` 限定符清单（明确写 code search 需鉴权不可用、配额 10 次/分钟）；核验规则（必须打开仓库页、**不要只信搜索 API 的 license 字段** —— 实证 `anthropics/skills` 返回 `None`）；候选清单五字段；安装只指路「设置 → AI → 技能管理 → 导入」。frontmatter：`name` / 中文 `description` / `disable-model-invocation: true`。
- `skills-builtin/find-skills/LICENSE.txt`（新建，21 行）- 标准 MIT 全文；版权行 `Copyright (c) vercel-labs`（上游仓库根无独立 LICENSE 文件，许可证仅由 `package.json` 的 `"license": "MIT"` 声明，`author` 字段为空；其根的 `ThirdPartyNoticeText.txt` 经核实是 Skills CLI 的第三方组件清单，与本技能文本无关，不随包）。
- `builtin-skills-seeder.js`（新建，437 行）- 随包内置技能唯一播种者。导出 `seedBuiltinSkills` / `resolveBuiltinSkillsSrc` / `getSeededSkillNames` / `getSeedDiagnostics` / `setBuiltinDepsForTest` / `_resetForTest`（+ 供测试直接调用的 `detectDiff` / `safeCopyDir`，见 Deviations）。内部：`resolveManagedSkillsDir` / `listRelativeFiles` / `hashFile` / `_cleanupDir` / `assertNoSymlink` / `copyDirRecursive` / `collectInvalidSrcDirs`。`require('electron')` 只在 `resolveBuiltinSkillsSrc()` 函数体内出现一次（第 57 行，纯 Node 测试可加载）。
- `main.js`（修改，+7 行）- require 区新增一行 `builtinSkillsSeeder`；`agentWorkspace.migrateAiMemory();` 与 `// 初始化 AI Manager（per Phase 19）` 之间插入注释 + `builtinSkillsSeeder.seedBuiltinSkills();`（同步、不 await、不 fire-and-forget）。
- `package.json`（修改，+1 行）- `build.asarUnpack` 追加 `"skills-builtin/**"`（写 `/**` 不写 `/**/*`；既有 `node_modules/nodejieba/**` 保留）。
- `tests/test-builtin-skills-seeder.js`（新建，753 行）- 33 例、5 个 describe：端到端纵切（tracer）/ 差异检测 IO fail-safe / 源码不变式 / 播种原子性与差异诊断 / 诊断 code 与源码不变式 / 零安装语义扫描 / 门禁断言。三张表 `FORBIDDEN_PATTERNS` / `INSTALL_IMPERATIVES` / `EXEMPTIONS` 逐字照抄 47-RESEARCH §A-4。

## Decisions Made

- **D-12 路径两侧成对**：`package.json` 的 `asarUnpack: ["skills-builtin/**"]` ↔ 运行时 `path.join(process.resourcesPath, 'app.asar.unpacked', 'skills-builtin')`；开发态**显式回落 `__dirname`**（nodejieba 先例在开发态是「不设路径」，本目录必须显式回落，否则开发态解析不到）。
- **D-11 零状态文件**：seeded 身份 = 扫随包 `skills-builtin/` 中含 `SKILL.md` 的目录名集合。`builtin-skills-seeder.js` 剥离注释后不含任何技能名字面量（测试断言钉死）。
- **D-09 可见但不阻断**：覆盖诊断固定 `level: 'warning'`；`message` 同时给「已被随包版本覆盖」与正确做法（`skills/` 同名遮蔽 / 设置页禁用），照 `realm_layout_violation` 的「warning 必须给正确做法」先例。
- **`realm_builtin_src_invalid` 的控制流（评审裁决项 1）**：由 `seedBuiltinSkills()` 的独立源目录扫描产出，**在遍历 `getSeededSkillNames()` 的返回之前**；`getSeededSkillNames()` 保持只过滤不产诊断。二者是「先报后滤」的串行关系，不是互为表里。
- **扫描器二段式的段界表达**：第 2 段用**排除法**（第 1 段之外的**全部**内容）而非列举 `scripts/` + `resources/` —— 列举法会漏掉 47-03 将落地的 `agents/` / `assets/` / `eval-viewer/` / `references/` 四类目录。
- **禁令段措辞**：正文只描述语义、零被扫 token。计划 action 里把「跳过确认」列为「不含禁用 token 的措辞」与 §A-4 的 `FORBIDDEN_PATTERNS`（含 `/跳过确认/`）自相矛盾；按「Task 3 的扫描器断言是绑定门禁」取后者，正文改用「绕过任何确认提示」表达同一语义。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `setBuiltinDepsForTest` 的默认参数不覆盖显式 `null`**
- **Found during:** Task 1（写 `withTempRoot` 的 `t.after` 清理）
- **Issue:** 计划要求 `t.after` 里调 `setBuiltinDepsForTest(null)` 恢复默认，但函数签名 `deps = {}` 的默认值只对 `undefined` 生效 → `'srcDir' in null` 抛 `TypeError: Cannot use 'in' operator to search for 'srcDir' in null`，6 个用例连锁失败。
- **Fix:** 改为 `function setBuiltinDepsForTest(deps) { const d = deps || {}; ... }`。
- **Files modified:** `builtin-skills-seeder.js`
- **Verification:** `node tests/test-builtin-skills-seeder.js` 由 8 pass / 6 fail 转为全绿。
- **Committed in:** `e137d83`（Task 1 commit）

**2. [Rule 3 - Blocking] 「为什么不用 mtime」的注释只在 JSDoc 里，不满足「函数体内」的断言口径**
- **Found during:** Task 1（`detectDiff 带 IO fail-safe 分支，并有「为什么不用 mtime」的注释` 断言失败）
- **Issue:** 计划 acceptance 要求 `detectDiff` **函数体**内出现该说明（用 `functionBody` 切片断言），而最初只写在函数上方的 JSDoc 里。
- **Fix:** 在函数体首部补一条 code 注释（「绝不使用 mtime / mtimeMs / birthtime 判差异……请勿『优化』掉」），同时保留 JSDoc 里的完整论证。
- **Files modified:** `builtin-skills-seeder.js`
- **Verification:** 断言转绿；Task 2 的「剥离注释后不出现 mtime」断言仍绿（注释被剥离后代码行确实零命中）。
- **Committed in:** `e137d83`（Task 1 commit）

### Plan-text Reconciliations（计划内部自相矛盾项，按更具体的门禁口径调和）

**3. `detectDiff` / `safeCopyDir` 的导出面与 `<artifacts_this_phase_produces>` 冲突**
- **Issue:** artifacts 段把二者列为「模块内部函数（不导出）」，但 Task 1 acceptance 要求「调 `detectDiff` 断言返回 `'different'` 且不抛错」、Task 2 acceptance 要求「构造一次 `safeCopyDir` 失败」，Task 2 step 1 明写「补全为**可测的导出内部函数**」——不导出则两条断言无法实现。
- **Fix:** 二者直接导出（`module.exports` 含计划登记的全部 6 个公开导出 + 这 2 个测试钩子，并加注释说明「生产调用方只应使用上面 6 个成员」）。
- **Verification:** Task 1 的「`module.exports` 含全部 6 个导出」断言仍绿（该断言是包含语义，非等集语义）。
- **已记入** `.planning/WINDOWS.md`（kind: deviation / phase 47）。

**4. 计划 Task 1 把「跳过确认」列为安全的替代措辞，与 §A-4 的禁用词表冲突** —— 见「Decisions Made」最后一条。取了更严格的扫描器口径，正文改用「绕过任何确认提示」。

## Issues Encountered

- **Task 3 的提交命令因反引号被 shell 展开，意外执行了一条 `npm exec skills add foo -g -y`。**
  - **成因：** 提交信息里我用反引号包裹了「npx skills add foo -g -y」作为行内代码，而该命令整体被 Bash 工具用单引号包进 `eval '...'` —— 单引号内的反引号仍是命令替换，于是它被执行了（`npx` → `npm exec`）。进程挂起 5 分钟后被手工终止。
  - **影响评估（已实际核查，无副作用）：**
    - 无新增 npx 缓存目录（`find ~/.npm/_npx -maxdepth 1 -newermt '-40 minutes'` 无结果）；
    - `npm ls -g` 不含 `skills`；`/opt/homebrew/bin/skills` 是指向 `/opt/homebrew/lib/node_modules/skills/bin/cli.mjs` 的**既有**安装，符号链接与目标文件的 mtime 均为 **2026-02-05**（早于本次会话），不是本次产生的；
    - 仓库与 `~/Library/Application Support/realm-dev/agent-workspace` 均无 20 分钟内的意外写入。
  - **规避：** 提交信息改由 `Write` 工具落到临时文件，再用 `git commit -F <file>` 提交 —— 消息内容完全不经 shell 解析。**结论：Bash 工具的命令串里绝不要出现反引号。**
  - 已确认 Task 3 最终以 `02d8a93` 正常落地（`git log` 与 `git status` 均干净）。

- **提交到 `master`（受保护分支）**：`gsd-tools query git.base-branch --is-protected master` 返回 `true`，但本项目 `.planning/config.json` 的 `git.branching_strategy` 为 `"none"`（GSD 全程不使用阶段分支，全部历史阶段提交均在 `master` 上），且本次执行由 orchestrator 明确指派为「SEQUENTIAL executor agent on the main working tree」。按项目既有工作流在 `master` 上提交；未做任何 force/rewrite 操作。**如需改为分支工作流，属项目级配置变更，超出本计划范围。**

## Threat Flags

无新增威胁面。本计划引入的全部信任边界（随包 `skills-builtin/` → 播种模块、`resolveBuiltinSkillsSrc()` → `resourcesPath`/`__dirname` 双分支、`managed-skills/` → 加载器/模型、播种诊断 → 日志/Phase 50）均已在 PLAN 的 `<threat_model>` 中登记（T-47-01-01..06 + SC），实现与该表逐条对齐：

- T-47-01-01（high，mitigate）：零安装架构 + 显式禁令段 + 二段式静态扫描 + `npx skills` 专项断言 + 反向验证证明非空转 ✅
- T-47-01-02（high，mitigate）：打包态一律 `path.join(process.resourcesPath, 'app.asar.unpacked', 'skills-builtin')`，开发态显式回落 `__dirname`；`asarUnpack` 与运行时路径成对（打包实跑由 47-04 收口）✅
- T-47-01-03（medium，mitigate）：`safeCopyDir` tmp/bak 与目标同父目录（同卷，避免 `EXDEV`）；`_cleanupDir` 自身吞错；测试断言「要么不存在、要么完整」✅
- T-47-01-04（medium，mitigate）：`assertNoSymlink` fail-closed → `realm_builtin_seed_failed` 跳过该技能 ✅
- T-47-01-05（low，mitigate）：诊断字段限定 `level` / `code` / `message` / `path` / `skillName?`；`message` 只含技能名与原始错误，不拼接任何环境变量值 ✅
- T-47-01-06（low，mitigate）：覆盖前一律产 warning 并指明正确定制通道；已知残余（用户不看日志则手改仍被覆盖）由 47-04 写入 `docs/product/ai-skills.md` ✅
- T-47-01-SC（medium，mitigate）：**零新增依赖**，未执行任何包安装命令 ✅

## Known Stubs

无。本计划落地的代码路径无硬编码空值、无 `TODO` / `FIXME`、无未接线数据源。

两处**前瞻引用**（非 stub，均按计划显式设计并在注释中写明）：

1. `skills-builtin/find-skills/SKILL.md` 的安装指路「设置 → AI → 技能管理 → 导入」——该入口由 Phase 50 实现。D-03 明确接受这个中间态（六阶段同属 v2.6，发布时入口已存在），且**刻意不做**「暂无入口时手动放入目录」的兼容分支。
2. `tests/test-builtin-skills-seeder.js` 的 `EXEMPTIONS` 预登记了两条 `skills-builtin/skill-creator/scripts/check_env.mjs` 的豁免条目，该文件由 47-03 落地。本计划断言第 2 段扫描集**为空**，并断言「任何豁免条目都不得落在第 1 段扫描面内」（豁免不会削弱零容忍段）；47-03 落地后由它实测豁免生效与排除法覆盖面。

## TDD Gate Compliance

本计划 3 个任务均非 `tdd="true"`（Task 1 `type="tracer"`、Task 2/3 `type="auto"`），无 RED/GREEN/REFACTOR 门禁要求。

## Plan Verification 结果（10 项全过）

| # | 判据 | 结果 |
|---|------|------|
| 1 | `node tests/test-builtin-skills-seeder.js` 退出 0 | ✅ 33/33 pass、0 fail |
| 2 | `node tests/test-agent-workspace.js` 退出 0 | ✅ 21/21 |
| 3 | `node tests/test-ai-skills.js` 退出 0 | ✅ 64/64 |
| 4 | 沙箱零 diff：`BASE=$(cat .git/gsd-plan-head-before-47-01)`；`git diff "$BASE"..HEAD -- agent-workspace.js` 为空 | ✅ 基线非空（`1ad621e…`），diff 为空 |
| 5 | `node --check` × 3 文件 | ✅ |
| 6 | `package.json` 的 `asarUnpack` 含两条目 | ✅ |
| 7 | 反向验证：插入 `npx skills add foo -g -y` → 变红 → 还原转绿 | ✅ 红时 3 fail（30 pass），绿时 33/33 |
| 8 | 反向验证：删掉独立源目录扫描 → `src_invalid` 用例变红 → 还原转绿 | ✅ 红时 1 fail（23 pass），绿时 24/24 |
| 9 | `grep -n "版本戳登记表" .planning/ROADMAP.md` 无命中；`git diff --stat -- .planning/ROADMAP.md` 为空 | ✅ 规划收敛期已改写，**本计划无需 Edit**（四要素齐备） |
| 10 | `git diff "$BASE"..HEAD --stat` 只落在 6 个允许路径 | ✅ builtin-skills-seeder.js / main.js / package.json / skills-builtin/find-skills/** / tests/test-builtin-skills-seeder.js（ROADMAP 零改动） |

### ROADMAP §Phase 47 成功判据 1 —— 核对结果（Task 2 step 5）

**结论：无需修改。** 规划收敛期（`1ad621e`）已把该条改写完毕，四要素逐项齐备，`git diff --stat -- .planning/ROADMAP.md` 在本计划内为空。

| 要素 | 现文 | 状态 |
|------|------|------|
| 重启不重复播种 | 「内容一致时 `detectDiff` 判 `same` → 零差异、零诊断，重启不重复写」 | ✅ |
| 手改前产 warning 再无条件覆盖 | 「用户手改 `managed-skills/<name>/` 时先产 `realm_builtin_seed_overwritten`（warning）诊断**再**覆盖为随包版本（不静默、但不阻断覆盖）」 | ✅ |
| 手删自愈重播 | 「用户手删后下次启动**自愈重播**」 | ✅ |
| 停用 = 设置页禁用 / 定制走 `skills/` 遮蔽 | 「『停用某内置技能』的唯一语义是设置页禁用（`settings.aiSkills.disabled`），定制走 `skills/` 同名遮蔽」 | ✅ |
| 不含「版本戳登记表」 | 全文件 grep 命中数 = 0 | ✅ |

## Next Phase Readiness

- **Wave 2 的两个计划已具备可扩展的验证切面**：
  - **47-02（install 档）** 可直接消费本计划建立的 `realm_` 诊断形状与测试脚手架；`ai-bash-policy.js` 本计划**零改动**（`PACKAGE_MANAGER_INSTALL_PATTERNS` 属 47-02）。
  - **47-03（skill-creator 上游快照）** 需要扩写的内容：`skills-builtin/skill-creator/**`（SKILL.md + LICENSE.txt + scripts/ + references/ + assets/ + eval-viewer/ + `check_env.mjs`）与 `THIRD_PARTY_NOTICES.md`。本计划已为它预留：① 扫描器第 1 段按 **glob** 枚举（写死文件名会让新技能静默逃出扫描面）；② 第 2 段用**排除法**覆盖 `agents/` / `assets/` / `eval-viewer/` / `references/`；③ `EXEMPTIONS` 已预登记 `check_env.mjs` 的两条反向语义豁免与理由。
- **47-04（打包实跑）需收口的两条 flagged assumption**（见 coverage D5/D6）：`make install-nightly` 后确认 `app.asar.unpacked/skills-builtin/` 生效；`build.files` 排除项（`.planning/**` 等）的决策落点。
- **Phase 48/49 的数据形状契约已就位**：seeded 身份判定源 `getSeededSkillNames()`（D-11，零状态文件）可被 48 的来源徽标与 49 的覆盖/删除拒绝逻辑直接消费；`managed-skills/<name>/` 的内容形状由本计划钉死（整目录复制，`LICENSE.txt` 随之落盘）。
- **已知遗留（非本计划缺陷）**：`make install-nightly` 前须 `pgrep -fl Realm` 确认无用户实例（`/Applications/Realm.app` 的 `rm -rf` 会删掉运行中的 bundle）—— 47-04 的不可跳过前置 checkpoint。

---
*Phase: 47-bash*
*Completed: 2026-09-11*

## Self-Check: PASSED

- 全部 4 个新建文件存在；3 个任务提交（e137d83 / 420d751 / 02d8a93）均在 git 历史中
- `node tests/test-builtin-skills-seeder.js` 33/33、`node tests/test-agent-workspace.js` 21/21、`node tests/test-ai-skills.js` 64/64 全绿
- `plan_head_before` = 1ad621ec7b2eab830abcfafc317e222b65770d0f（来自 .git/gsd-plan-head-before-47-01 台账），`commits` = 3 为实测值（`git rev-list --count`）

---
phase: 51-zip
plan: 01
subsystem: infra
tags: [sandbox, symlink, realpath, sec-10, execution-env, path-guard]

# Dependency graph
requires:
  - phase: 46-skill-dir
    provides: agent-workspace 硬沙箱（createSandboxEnv / resolveInside 双基准）
provides:
  - 'resolveInsideForWrite(root, target)：写面判据（词法双基准 + 最近已存在祖先 realpath 复核，fail-closed）'
  - 'guardForWriteResult：并列于 guardResult 的写面包装（不再改读面本体）'
  - 'createSandboxEnv 的五个写方法与两个临时目录方法全部走写面判据'
  - 'buildRootBaseline / isInsideBaseline：双基准前缀判据单源（读面写面共用）'
  - 'tests/test-agent-workspace.js 的写面加固用例组（38 例，含十例期望表与源码契约）'
affects: [51-03, 51-04, 51-05, 51-07]

actuals:
  tokens: 8260    # chars/4 over `git diff 4795ee2..HEAD -- agent-workspace.js tests/test-agent-workspace.js | wc -c` = 33039
  tasks: 2
  commits: 6      # MEASURED: git rev-list --count 4795ee2..HEAD（其中 4 个来自并发会话的 merge，见「Issues Encountered」）
  plan_commits: 2
  plan_head_before: 4795ee2347a9c6bb4f19c21418ee4216659e811f

tech-stack:
  added: []      # 零新增依赖（判据只用 path + fs 内建）
  patterns:
    - '读写两面判据并列：guardResult（读面，语义冻结）与 guardForWriteResult（写面）同时存在，各管一面'
    - '判据链单源：唯一判据函数 → 唯一包装 → 方法体只调包装（方法体内零 realpathSync 是可源码断言的不变式）'
    - '写目标按「最近已存在祖先 realpath + 拼回未创建尾段」判定，并返回词法路径而非 realpath'
    - '真副作用判据：逃逸用例断言盘上不存在目标文件（existsSync），不断言「没调用过 fs」'

key-files:
  created: []
  modified:
    - agent-workspace.js
    - tests/test-agent-workspace.js

key-decisions:
  - '新增 guardForWriteResult 而不是改 guardResult 本体 —— guardResult 被读面八处共用，改本体等于顺手改读面语义，而 SEC-10 的验收判据之一就是「既有放行 / 拒绝集合零变化」'
  - 'resolveInsideForWrite 保留原有词法前缀校验（同一双基准），只在词法通过之后追加「最近已存在祖先 realpath」复核 —— 只留 realpath 复核会放行「root 自身不存在且 realpath 失败」的退化形态'
  - '抽出 buildRootBaseline / isInsideBaseline 作为双基准前缀判据单源，读面 resolveInside 与写面 resolveInsideForWrite 共用同一实现（原 resolveInside 是内联同款代码，抽出后逐字等价，21 例既有用例零变化）'
  - 'createTempDir / createTempFile 纳入写面复核（父目录 getTmpDir() + 产物路径两段）—— mkdtemp 本身不经 guard，.tmp/ 被替换成 symlink 即逃逸；产物前缀 tmp-<prefix>-<rand> 与 sweepSeedResidue 清扫正则成对，不得改名'
  - 'exec 不在本计划范围（D-15 明文）—— 用例组以「bash 仍可写出 root」的行为断言把这条诚实边界机械化'

patterns-established:
  - '写面判据独立于读面判据：任何「目标可能尚不存在」的路径校验不得复用读面函数'
  - '判据的返回值恒为词法绝对路径（不返回 realpath）—— 返回 realpath 会把「root 自己也是 symlink」的合法形态改写成另一条路径'

requirements-completed: [SEC-10]

coverage:
  - id: D1
    description: '写逃逸缺口闭合：中间目录为 symlink 且目标不存在时，写面从「词法放行、实际写到 root 外」转为拒绝；沙箱内自指/同根内链接仍放行'
    requirement: SEC-10
    verification:
      - kind: unit
        ref: 'tests/test-agent-workspace.js#十例期望表：逐条判定（有哪一例被判反了有可读失败信息）'
        status: pass
      - kind: unit
        ref: 'tests/test-agent-workspace.js#新旧判据对照：仅「link OUT then write」一处由放行转拒绝（既有放行/拒绝集合零变化）'
        status: pass
      - kind: unit
        ref: 'tests/test-agent-workspace.js#env.writeFile 经 bash 建的逃逸链接写入被拒，root 外真的没有产生文件'
        status: pass
      - kind: unit
        ref: 'node tests/test-agent-workspace.js（38/38，# fail 0）'
        status: pass
    human_judgment: false
  - id: D2
    description: '五个写方法（writeFile / appendFile / renameFile 双路径 / createDir / remove）与两个临时目录方法全部走写面判据，六个读面方法判据一字未动'
    requirement: SEC-10
    verification:
      - kind: unit
        ref: 'tests/test-agent-workspace.js#源码契约：五个写面走 guardForWriteResult 且六个读面仍走 guardResult（剥注释后）'
        status: pass
      - kind: unit
        ref: 'tests/test-agent-workspace.js#源码契约：写面方法体内零 realpathSync（单一判据链，无第二份实现）'
        status: pass
      - kind: unit
        ref: 'tests/test-agent-workspace.js#createTempDir/createTempFile 在 .tmp/ 被替换为逃逸链接时拒绝（父目录写面复核）'
        status: pass
      - kind: unit
        ref: '回归：node tests/test-ai-skills.js（187/187）、test-skills-management.js（49/49）、test-skills-http-api.js（32/32）、test-manage-skill.js（55/55）、test-ai-attachments.js（35/35）'
        status: pass
    human_judgment: false
  - id: D3
    description: 'bash 交互下「先 ln -s 出去再写」由放行转为拒绝 —— 行为变更，须由产品文档披露并在阶段 UAT 人工走一次'
    verification: []
    human_judgment: true
    rationale: '体感差异只能在真实应用里由人观察（需要真实 GUI 会话 + AI 工具往返）；本计划只交付源码面与用例面，披露义务归 51-07（docs/product/ai-agent-workspace.md §七）'

duration: 13min
completed: 2026-09-15
status: complete
---

# Phase 51 Plan 01: 沙箱写面加固（SEC-10）Summary

**`resolveInsideForWrite` 闭合「中间目录为 symlink 且写目标不存在」的沙箱写逃逸：五个写方法与两个临时目录方法全部切换，读面判据一字未动，既有 21 例零删改、新增 17 例（38/38 全绿）**

## Performance

- **Duration:** 13min
- **Started:** 2026-09-15T06:57:00Z（约值 —— 首条命令未落盘时间戳，以首个任务提交 07:07:22Z 反推）
- **Completed:** 2026-09-15T07:10:04Z
- **Tasks:** 2 / 2
- **Files modified:** 2（`agent-workspace.js`、`tests/test-agent-workspace.js`）

## Accomplishments

- **缺口真实且已闭合**：实测「新旧判据对照」用例把 `resolveInside` 与 `resolveInsideForWrite` 在同一组十例探针上逐条比对，**翻转集合恰为 `['link OUT then write']`** —— 即缺口本体由放行转拒绝，其余九例（含沙箱内自指 / 同根内兄弟目录 / 自环三种链接形态）判定完全不变。这条断言把「既有放行 / 拒绝集合零变化」从散文变成了字面判据。
- **两段式写面复核覆盖临时目录侧门**：`createTempDir` / `createTempFile` 走 `fs.promises.mkdtemp`、**不经 guard**，`.tmp/` 若被替换成 symlink 产物即落到 root 外。现对 `getTmpDir()`（父目录）与产物路径各复核一次，并把「产物前缀 `tmp-<prefix>-<rand>` 与 `sweepSeedResidue` 清扫正则成对、不得改名」写进方法体注释与一条形状断言。
- **判据链单源**：抽出 `buildRootBaseline` / `isInsideBaseline` 供读面与写面共用（`resolveInside` 改为调用同一实现，逐字等价）；用例组的源码契约断言「五个写面走 `guardForWriteResult` **且**六个读面仍走 `guardResult`」+「写面方法体内零 `realpathSync`」同时钉住两面 —— 只断言任一侧都会在「把读面也一起切了」或「什么都没做」的实现上假绿。
- **真副作用而非形式判据**：三条逃逸用例均断言 `fs.existsSync(<root 外路径>) === false`（写）或外部文件内容未被改写/删除（改、删），而不是断言「没调用过 syscall」。
- **诚实边界机械化**：新增一条用例断言 `env.exec('echo escaped > ../x')` **仍然写得出去** —— 让 prohibitions 第 2 条（不得声称已封闭 `bash` 写盘）成为可执行的反证据，而不是注释里的承诺。

## Task Commits

Each task was committed atomically:

1. **Task 1: 写面加固端到端纵切（tracer）** - `89e1f8a` (feat)
2. **Task 2: 写面加固完整用例组与源码契约** - `e93539c` (test)

**Plan metadata:** 见本 SUMMARY 的元数据提交（docs: complete 51-01 plan）

## Files Created/Modified

- `agent-workspace.js`（+146 / −23）：
  - 新增 `buildRootBaseline(root)` / `isInsideBaseline(abs, base)`（双基准前缀判据单源，紧邻 `resolveInside` 之前）
  - `resolveInside` 改为调用上述两个函数（**语义逐字等价**，仍在 `ENOENT` 分支返回词法路径 —— 读面语义按 SEC-10 冻结）
  - 新增 `resolveInsideForWrite(root, target)`（词法前缀校验 + 最近已存在祖先 realpath 复核；返回词法路径；非 ENOENT 失败与输入畸形一律 fail-closed）
  - `createSandboxEnv` 内新增 `guardForWriteResult`（与 `guardResult` 并列，不改其本体）
  - 切换：`writeFile` / `appendFile` / `renameFile`（source 与 destination 各一次）/ `createDir` / `remove`
  - 追加复核：`createTempDir` / `createTempFile`（父目录 + 产物路径两段）
  - `module.exports` 追加 `resolveInsideForWrite`（`guardForWriteResult` 不导出，只经 `env` 行为面覆盖）
- `tests/test-agent-workspace.js`（+357 / −0，**纯追加**）：
  - `describe('写面加固（SEC-10）—— 最小集')`：4 例（Task 1 落盘）
  - `describe('写面加固（SEC-10）—— 十例判定与源码契约')`：13 例（Task 2 落盘）—— 十例期望表 / 新旧判据对照 / 六条 env 级行为例（含两处真副作用 + 三处正命题）/ 临时目录两段复核 / 产物命名形状 / 两条源码契约 / 未覆盖面登记

## Verification Evidence

**门禁（两个任务的 `<automated>` 全绿，均在本树实跑）：**

| # | 命令（要点） | 结果 |
|---|---|---|
| 1 | `node --check agent-workspace.js` + 源码扫描（`function resolveInsideForWrite(root, target)` / `const guardForWriteResult =` / `module.exports` 登记 / 函数体内 `realpathSync(` 与 `path.dirname(`） | `写面判据 ok（resolveInsideForWrite + 包装 + 导出 + realpath 上溯）` |
| 2 | 源码窗口扫描（五个写面含 `guardForWriteResult(`、六个读面含 `guardResult(`、`renameFile` 窗口内恰 2 处） | `五个写面已切换 + 六个读面未动（renameFile 双路径各一）` |
| 3 | `node tests/test-agent-workspace.js \| grep -E "^# (tests\|pass\|fail)"` | `# tests 38 / # pass 38 / # fail 0`（≥ 34 达标） |
| 4 | `node --check tests/test-agent-workspace.js` + 用例组扫描（`link OUT then write` / `link IN (self-referential) then write` / `sibling` / `root-evil` / `existsSync` / `guardForWriteResult(` / `guardResult(`） | `写面用例组 ok（十例名目 + 真副作用 + 正反源码契约）` |

**单点变异（各确认转红后复原；复原以 sha256 逐字复核一致）：**

| 变异 | 期望 | 实得 |
|---|---|---|
| M1 `writeFile` 的 `guardForWriteResult(` 改回 `guardResult(` | 门禁 2 转红 | `writeFile 未切到 guardForWriteResult`，exit 1 |
| M2 删 `resolveInsideForWrite` 里的 `realpathSync(` | 门禁 1 转红 | `resolveInsideForWrite 未做 realpath 复核（缺口未闭合）`，exit 1 |
| M3 `renameFile` destination 改回 `guardResult(` | 门禁 2 转红 | `renameFile 的写面校验 1 处（source 与 destination 必须各 1）`，exit 1 |
| MA 写面包装整体回退 `resolveInside`（= 未修复的树） | 否命题转红，**须含三处写面** | 6 条叶子转红：`env.writeFile 经逃逸链接…`（Task 1）/ `env.writeFile 经 bash 建的逃逸链接…` / `env.appendFile 经逃逸链接…` / `env.remove 经逃逸链接…` / `env.createDir … 经逃逸链接拒绝` / `env.renameFile 的 source 与 destination …` —— writeFile、renameFile destination、remove 三面齐备 |
| MB `resolveInsideForWrite` 改为无条件 `return null` | 正命题转红（过度收紧必须可见） | 11 条叶子转红：含「十例期望表」「新旧判据对照」「自指链接写入成功」「createDir 经沙箱内链接成功」「createTempDir 产物前缀形状…」及 4 条既有用例 |

**既有 21 例逐字未改（带基线 sha 的字面判据）：**

```
BASE=$(cat .git/gsd-plan-head-before-51-01)   # = 4795ee2347a9c6bb4f19c21418ee4216659e811f
git diff $BASE -- tests/test-agent-workspace.js | grep -E '^-' | grep -v '^---'   # → 空（零删除行）
```

裸 `git diff` 对本计划的未提交改动是恒空判据 —— 上述命令**带基线 sha**，才是有效判据。

**回归（相邻套件，全绿）：** `test-ai-skills` 187/187、`test-skills-management` 49/49、`test-skills-http-api` 32/32、`test-manage-skill` 55/55、`test-ai-attachments` 35/35。

## Decisions Made

见 frontmatter `key-decisions`（五条）。其中两条是本计划的承重选择：

1. **并列而非改写** —— `guardForWriteResult` 与 `guardResult` 同时存在。`guardResult` 被 `absolutePath` / `canonicalPath` 与六个读方法共用，改本体等于顺手改读面语义；而 SEC-10 的验收判据之一就是「既有放行 / 拒绝集合零变化」（含「读一个尚不存在的路径」仍由底层 fs 报 `ENOENT`）。
2. **抽出单源前缀判据** —— 原 `resolveInside` 内联的双基准前缀比较抽成 `buildRootBaseline` / `isInsideBaseline`，写面复用同一实现。计划要求「同一判据、同一双基准、不得重新发明一套前缀比较」，抽出是唯一能同时满足「单源」与「读面语义零变化」的形态（抽出后逐字等价，21 例全绿佐证）。**这一条是本计划对 `resolveInside` 唯一的结构性改动**：它的放行 / 拒绝集合未变，变的只是前缀比较的住所。

## Deviations from Plan

**1. [Rule 2 - 判据可失败性] `env.remove` 用例改用「尚不存在的目标」作为承重断言**

- **Found during:** Task 2 的 MA 单点变异（写面包装回退 `resolveInside`）
- **Issue:** 计划 acceptance_criteria 第 2 条要求「第 6 / 11 / 12 条用例（`link OUT` 的三处写面：`writeFile` / `renameFile` destination / `remove`）**都能在回退加固的树上转红**」。首版 `remove` 用例删的是 root 外**已存在**的 `victim.txt` —— 而 `resolveInside` 对**已存在**路径本就做 realpath 复核、同样拒绝，故该用例在回退树上**恒绿**（实测 MA 首轮 5 条转红、`remove` 不在列）。
- **Fix:** 把承重断言换成计划原文的形态 `env.remove('<link OUT>/x')`（`x` 尚不存在）—— 回退后 `resolveInside` 因 ENOENT 词法放行，结果退化为底层 `not_found` 而非 `permission_denied`，断言即转红；同时保留「已存在的 victim 文件仍在」作为第二条（非承重的真实路径）负例。
- **Files modified:** `tests/test-agent-workspace.js`
- **Verification:** MA 复跑 6 条转红，`env.remove 经逃逸链接被拒（写面判据，非底层 ENOENT）` 在列。
- **Committed in:** `e93539c`（Task 2 commit）

**2. [Rule 2 - 判据强度] 新增一条「未覆盖面」行为用例（计划只要求注释登记）**

- **Found during:** Task 2（编写用例组时）
- **Issue:** 计划 prohibitions 第 2 条禁止把 `bash` 的写盘能力写成「已被本加固封闭」，Task 2 acceptance 只要求「用例组的注释里如实登记未覆盖面」。注释不是可失败判据 —— 日后有人删掉注释或改写口径，没有任何东西会转红。
- **Fix:** 追加一条行为断言：`env.exec('echo escaped > ../<name>')` 之后**必须**在 root 外找到该文件。即把「本加固不封闭 bash 写盘」变成正面可执行证据（删掉它会同时删掉这条证据本身，改写加固以覆盖 `exec` 则它会因 `exec` 被拒而转红）。
- **Files modified:** `tests/test-agent-workspace.js`
- **Verification:** 38/38 全绿；该用例在 MB 变异下不受影响（`exec` 未走写面判据），符合预期。
- **Committed in:** `e93539c`（Task 2 commit）

---

**Total deviations:** 2 auto-fixed（均 Rule 2 —— 判据可失败性 / 判据强度）
**Impact on plan:** 两处都只让判据更硬，未扩大实现面（`agent-workspace.js` 的计划外改动为零）。无 scope creep。

## Issues Encountered

- **并发会话在任务之间把 master 推进了一个 merge（不影响本计划，但影响 `commits:` 读数）**：本计划开始时 HEAD 为 `4795ee2`，Task 1 提交 `89e1f8a` 之后、Task 2 提交 `e93539c` 之前，另一个 CodeBuddy 会话把 `feature/hard-reload-shortcut`（`e06a881` 强制刷新快捷键 + `0697a77` worktree 文档）合入 master（`d8516df` / `d4bd654` 两个 merge 提交）。**处置**：确认 `89e1f8a` 仍在 `HEAD` 的祖先链上、`git show --stat HEAD` 只含本任务文件、`agent-workspace.js` 的改动逐字在位、`git status` 无残留后继续；**未做任何 git 历史改写或回滚**。**读数影响**：`git rev-list --count 4795ee2..HEAD` = **6**，其中 4 个（`e06a881` / `0697a77` / `d8516df` / `d4bd654`）属该并发会话。frontmatter 的 `commits: 6` 是按 #3968 协议**实测**的区间计数（与 `/gsd-verify-work` 的同仪器读数一致），本计划自身实际提交数为 `plan_commits: 2`。
- **`.planning/config.json` / `.planning/state.json` 的脏改动不是本计划产生的**（`_auto_chain_active` 由 orchestrator 在派发时置为 `false`）；两次任务提交均按具名 `git add` 只暂存本任务文件，未把它们带入。

## Known Stubs

None —— 本计划零 stub、零 `TODO` / `FIXME`、零跳过用例；两个任务的 `<automated>` 门禁全部在本树实跑（无 unrun-verify）。

## Threat Flags

None —— 本计划**收敛**既有威胁面（T-51-01 / T-51-02 / T-51-05 的 mitigation 已落地：五个写面 + 两个临时目录方法与读面并列判据），未引入新的网络端点、认证路径、文件访问模式或 schema 变更。零新增依赖（`package.json` 未改）。

## User Setup Required

None - no external service configuration required.

## Handoff / Next Phase Readiness

- **51-03（Wave 2）可直接依赖本计划**：`env.renameFile` 的 destination 落点校验已走 `resolveInsideForWrite`，导入管线的临时区（`.tmp/`）与技能目录落点天然受同一判据保护；`resolveInsideForWrite` 已从 `module.exports` 导出，导入侧可直调纯函数（但**不得**在 `ai-skills-manager.js` 里另写一份包内条目判据 —— 沙箱判的是**落点**，导入包判的是**包内条目**，两者语义不同，见 51-PATTERNS 的「两处镜像」）。
- **`createTempDir` 的实际产物名是 `tmp-<prefix>-<rand>`**（方法体自带一层 `tmp-` 前缀）—— 51-04 的导入残留清扫正则必须按 **实际产物** 命名形状书写，否则清扫静默失效（PATTERNS 已警示，本计划另加了一条形状断言把它钉住）。
- **须由 51-07 承接的两件事**：① `docs/product/ai-agent-workspace.md` §七 的 SEC-10 行为变更条目（`bash` 里「先 `ln -s` 出去再写」被拒，属正确行为但须披露；**不得**写成「bash 写盘已被封闭」）；② `AGENTS.md` 的 `test-agent-workspace.js` 例数账本 **21 → 38**（本计划只改 `tests/` 与 `agent-workspace.js`，未动 `AGENTS.md` —— 该测试行按阶段产出表归 51-07；`counts-parity` 命令当前 5 个套件不含本套件，故不因此转红）。
- **人工面（不进本计划）**：真实 GUI 会话里 AI 用 `bash` 建链接再写盘的体感差异，由阶段 UAT 人工走一次（见 frontmatter `coverage` 的 D3）。
- **无阻塞项**。

## Self-Check: PASSED

- `FOUND: 89e1f8a`（Task 1 commit）
- `FOUND: e93539c`（Task 2 commit，= SUMMARY 写入前的 HEAD）
- `FOUND: agent-workspace.js`（含 `resolveInsideForWrite`）
- `FOUND: tests/test-agent-workspace.js`（含 2 个 `describe('写面加固（SEC-10）…`）
- 门禁实跑：`# tests 38 / # pass 38 / # fail 0`

---
*Phase: 51-zip*
*Completed: 2026-09-15*

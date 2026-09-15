# Phase 47: 内置技能播种 + bash 策略加固 - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付两件互相锁定的事，以及各自的门禁验收面：

1. **内置技能随包分发与播种**：新增 `skills-builtin/`（find-skills Realm 化改写版 + skill-creator 上游完整版 + 各自 `LICENSE.txt`），经 `asarUnpack` 随包分发；应用每次启动扫描随包内置技能目录并**按单技能目录粒度**自愈式同步到 `agent-workspace/managed-skills/`；技能加载器零诊断识别其 name / description；新增 `THIRD_PARTY_NOTICES` 归属记录。
2. **bash 包管理器安装档**：`ai-bash-policy.js` 新增独立 `install` 档，包管理器安装语义命令（`npx` / `npm i|install|ci|exec` / `pnpm add|dlx` / `yarn add|dlx` / `bun add|x` / `pip[3] install` / `uv` / `brew install|upgrade` / `cargo|go|gem install`）强制确认，**白名单不可越过**。

**Requirements**: SKILL-09, SEED-01, SEED-02, SEED-03, SEED-04, SEED-05, SEC-01, DOC-02（8 项）

**Security gates**: **P1**（S1，阻断）npx RCE 向量 —— 由「内置技能文本零安装语义」（D-01/D-02）+「安装档强制确认」（D-13..D-16）两部分共同闭合；**P10**（发布门禁）内置技能许可证归属义务 —— 由 D-17 闭合。

**不在本阶段**：`/` 面板与 `/skill:name` 调用（48）、`manage_skill` 写入路径（49）、设置页技能管理区与 `/api/skills/*`（50）、zip / 网络导入管线（51）。

**与需求字面偏离的两处**（均为讨论中的显式决策，实施时不得静默回退）：

- **O4「版本戳登记表 + 未修改才覆盖」→ 改为「每次启动无条件覆盖 + 差异诊断」**（D-08/D-09/D-10/D-11）：`managed-skills/` 是 app-owned 内容，用户定制走 `skills/` 同名遮蔽这条既有通道；同时 seeded 身份改为扫随包目录名清单（零状态文件），比登记表更抗删、不跨环境分叉。
- **SEED-05 的 `asarUnpack` 路线按字面保留**（D-12），但研究文档 `STACK.md` 实测推荐的是「显式递归读 asar + 零构建配置改动」。选定 asarUnpack 的理由：得到真实文件路径、与 nodejieba 先例一致，研究对 `cpSync` 在 asar 源上不可靠的顾虑在 asarUnpack 下不成立。

</domain>

<decisions>
## Implementation Decisions

### find-skills 改写形态（P1 门禁第一半）

- **D-01:** **零安装 + 只读网络发现。** find-skills 不安装任何外部 CLI；正文引导模型用既有 `web_fetch` 工具直取**结构化技能索引端点**（GitHub 搜索 API / 技能注册表）获取真实仓库与 URL，`web_search` 仅作兜底，逐条核验后才输出候选清单。P1 门禁判据、SEED-03 禁用词清单、ROADMAP 成功判据 2 **全部保持原文不变**，不做任何需求变更。— **Reversibility:** costly — 用户明确要求把「恢复 CLI 路线」记入里程碑后续改版；一旦改走该路线需同步改 SEED-03 / ROADMAP 成功判据 2 / P1 判据三处并重写技能正文，前置条件是先引入 OS 级隔离。
- **D-02:** 正文开头**显式写死禁令**：「本技能只产出候选清单，绝不执行任何安装 / 下载命令；安装一律由用户在 Realm 内完成」。判定标准是「每一行按『这段文字被模型执行后会做什么』逐句评审」。
- **D-03:** 安装指路**前瞻指向设置页导入入口**（「由用户在 设置 → AI → 技能管理 → 导入 完成安装」）。Phase 47~50 期间该入口尚未实现，属可接受的中间态（六阶段同属 v2.6，发布时入口已存在）。不做「暂无入口时手动放入目录」的兼容分支 —— 手改目录这条指引本身接近安装语义。
- **D-04:** 内置技能的 `description` 用**中文、面向用户**。理由：内置技能 `disable-model-invocation: true` → 不进 system prompt，`description` 的实际消费者是 `/` 面板（48）与设置页列表（50）的人眼可读性。

### skill-creator 取用范围（SEED-01）

- **D-05:** **完整保留上游 skill-creator 全部内容**，照 openhanako 的做法：`SKILL.md` + `scripts/`（9 个 Python）+ `references/schemas.md` + `assets/eval_review.html` + `eval-viewer/` + `LICENSE.txt`，**另加一个 Node 写的 `scripts/check_env.mjs`** 做环境预检（按 capability 分组报告 python ≥3.10 与 `pyyaml` / `anthropic` 依赖；支持环境变量覆盖解释器路径；带超时）。已接受的代价：约 100 KB Python 内容随包；用户需自备 python3 + 依赖；**每次运行 skill 脚本都会弹确认卡片**（`node` / `python3` 均在 `DANGEROUS_INTERPRETERS` 内且白名单不可越过 —— 这是 SKILL-09「复用既有机制、零新增权限」的必然结果，不是缺陷）。
- **D-06:** **正文语言分层**：自研 find-skills 改写版正文用**中文**；skill-creator 保持**上游英文正文**（仅做必要改写）。理由：自研内容面向 Realm 语境，上游内容保持英文便于日后逐行比对与跟进上游改动。
- **D-07:** 脚本是**可选路径而非主路径**：正文让 AI 优先用 Realm 自身的 `write` / `read` 工具完成技能创建与校验（与 Phase 49 `manage_skill` 自然衔接），仅当确实需要评测能力时才引导走 python3 脚本；走脚本前先调用 `check_env.mjs` 拿到能力清单，缺依赖时告知用户装什么。`check_env.mjs` 的价值独立于主/可选路径，始终随包提供。

### 播种模型与打包（SEED-02 / SEED-05）

- **D-08:** **每次启动按单个技能目录粒度同步 `managed-skills/<name>/`，无条件覆盖**（openhanako `syncSkills` 自愈模型）。整目录先写临时目录、再 rename 覆盖、失败回滚，不留半成品状态。同步判定的粒度为**单个技能目录**（不是整个目录一次判定），否则日后新增内置技能永不播种。
- **D-09:** **不静默覆盖**：同步前对比磁盘内容与随包内容，发现不一致（用户手改过）时先产出 `warning` 级诊断（含技能名 + 「已被随包版本覆盖」说明），再执行覆盖。— **Reversibility:** costly — 该决策显式偏离 O4 的「未修改才覆盖」字面；回退需引入内容 hash 状态与三分支判定，并同步调整 Phase 48 / 50 的诊断与展示语义。
- **D-10:** 用户在 `managed-skills/` 里手删内置技能后，**下次启动重播（自愈）**。「不要这个技能」的唯一语义是**禁用**（`settings.aiSkills.disabled`，Phase 46 D-09 已落定），`managed-skills/` 不允许手删。
- **D-11:** **seeded 身份判定 = 运行时扫描随包 `skills-builtin/` 的目录名集合**（每个目录须含 `SKILL.md`），**不落任何状态文件**。理由：删不掉、不双写、三环境 userData 不会分叉。该判定同时服务 Phase 48（`seeded` 来源徽标）与 Phase 49（按此判定拒绝覆盖 / 删除 seeded 技能），并满足 ROADMAP Phase 49 成功判据 3「按播种登记表判定，而非按目录位置」——这里的「登记表」即随包目录名清单，而不是一个可被删改的 JSON 文件。— **Reversibility:** costly — Phase 48 / 49 会消费该判定来源；改为状态文件需两个阶段同步改数据源，并引入可被删改、会跨环境分叉的状态。
- **D-12:** 随包分发走 **`asarUnpack` + `app.isPackaged` 路径分支**：`package.json` 的 `build.asarUnpack` 增加 `skills-builtin/**`；运行时 `app.isPackaged` 时读 `process.resourcesPath/app.asar.unpacked/skills-builtin/...`，开发态回落 `__dirname/skills-builtin`。得到真实文件路径后，播种可直接用递归复制（`readdirSync` + `copyFileSync`）。**必须实跑 `make install` 后的 .app 验证播种成功**，不能只跑 `npm run dev`。

### bash 包管理器安装档（SEC-01，P1 门禁第二半）

- **D-13:** **家族覆盖**（不止需求枚举的 5 条）：`npx`；`npm` 的 `i` / `install` / `ci` / `exec`；`pnpm` 的 `add` / `install` / `dlx`；`yarn` 的 `add` / `install` / `dlx`；`bun` 的 `add` / `install` / `x`；`pip` / `pip3 install`；`python` / `python3 -m pip install`；`uv` 的 `pip install` / `add` / `tool install`；`uvx`；`brew` 的 `install` / `upgrade` / `reinstall`；`cargo install`；`go install`；`gem install`。理由：只堵字面 5 条会让 `yarn add` / `bun add` / `cargo install` / `uvx` / `npm ci` 成为完全等效的绕过口，门禁形同虚设。
- **D-14:** **实现为独立 `install` 档**（不是并入 `DANGEROUS_PATTERNS`，也不是扩充 `DANGEROUS_INTERPRETERS`）：`ai-bash-policy.js` 新增 `PACKAGE_MANAGER_INSTALL_PATTERNS` 表 + 新 `reason: 'install'` + 新 `installNames` 字段，与 `DANGEROUS_PATTERNS` **平行但语义分离** —— `danger` = 本机破坏性操作，`install` = 从网络获取并执行第三方代码。install 判定与 danger 一样**先于白名单检查**（白名单不可越过），`evaluateBashCommand` 现有的「危险优先 → 白名单 → 默认」流水线结构复用。
- **D-15:** 安装档 **`riskLevel = 'high'`** + 专属确认文案（「将从网络下载并运行第三方代码；该命令不会因为加入白名单而免确认」）。理由：`npm install` / `npx` 会在安装生命周期执行依赖的 `postinstall` 脚本，实质是任意代码执行，与 `rm` 同级合理。
- **D-16:** 判定粒度 = **命令名 + 子命令**，并**显式排除只读子命令**（`npm run` / `test` / `ls` / `view` / `audit` / `outdated`、`pnpm run`、`yarn run`、`brew info` / `list` / `search`、`pip list` / `show`、`cargo search`、`go list` 等）。`npm ci` **计入**安装档（同样执行依赖的 `postinstall` 脚本）。测试必须把这些只读命令写成**反例断言** —— `npm run dev` / `npm test` 是日常命令，误伤会驱动用户把 `npm` 整个加入白名单，反而一次放开安装档。

### 许可证归属与文档同步（SEED-05 归属面 / DOC-02）

- **D-17:** P10 归属义务：repo 根新增 `THIRD_PARTY_NOTICES`，逐技能记录**来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明**（find-skills 为 Realm 化改写版，**必须标注 modified**；skill-creator 保留上游原样，标注 unmodified + 保留 `LICENSE.txt` Apache-2.0）。每个内置技能目录内保留上游 `LICENSE.txt`，并**随播种一同落到** `managed-skills/<name>/`（播种是整目录复制，天然携带）。
- **D-18:** DOC-02 同步（按 AGENTS.md 的强制维护约定）：`docs/product/ai-agent-workspace.md` 与 `AGENTS.md` 明确写出「**技能不构成额外权限**」「`allowed-tools` 当前运行时不被强制，**仅供参考**」；`docs/product/ai-skills.md` 补「内置技能」与「bash 包管理器安装档」两个章节（含内置技能自愈式播种语义、seeded 身份来源、脚本执行的确认成本）。`allowed-tools` 的**解析**不在本阶段（Phase 46 已在已知限制中写明 SDK 无该字段），本阶段只做文档声明，不得在任何 UI 制造「该技能只能用这些工具」的虚假安全感。

### Claude's Discretion

- **`THIRD_PARTY_NOTICES` 的具体落点与扩展名**（repo 根 `THIRD_PARTY_NOTICES.md` vs 无扩展名文件）**以及是否随 .app 分发** —— 判据是 P10 要求的「归属完整」，交 plan 期按实现细节决定。
- **诚实边界的记录方式**：「安装档只审一级 bash 命令，脚本内部的二次 `spawn`（如 `check_env.mjs` 内部 `spawnSync` 调 python）不在策略视野内」是否写进 `docs/product/ai-agent-workspace.md` 的已知限制 —— 交 plan 期与 D-18 的文档同步任务一并决定。
- **find-skills 候选清单的字段规范与「核验后才能输出」的强制程度** —— 建议每条含名称 / 用途 / 仓库 URL / 许可证，且必须经 `web_fetch` 核验后才输出；具体文案交 plan 期定。
- **find-skills 正文里给出哪些具体检索端点** —— 必须先实测 `web_fetch`（turndown HTML→Markdown 管线）对 `api.github.com` 这类 **JSON** 响应是否原样返回；若 JSON 被转坏，退路是 `web_search` 定位仓库 + `web_fetch` 读仓库页，**仍然零安装**。这是 plan 期的必做实测项。
- **`check_env.mjs` 的具体实现**（capability 分组、超时、解释器覆盖环境变量名）—— 可参照 openhanako 的形状，交 plan 期定。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑、需求与门禁

- `.planning/ROADMAP.md` §Phase 47 / §Security Gates — Goal、5 条 Success Criteria、**P1（S1 阻断）与 P10（发布）门禁归属与阻断判据**
- `.planning/REQUIREMENTS.md` — SKILL-09 / SEED-01..05 / SEC-01 / DOC-02 条目原文（第 28、62-70、84 行附近）
- `.planning/STATE.md` §Blockers/Concerns — 本阶段需拍板的开放决策 **O1（find-skills 去 CLI 化程度）、O3（allowed-tools 范围）、O4（seeded 升级策略）**，以及「v2.6 待实测风险」中 `npx skills` CLI 行为细节
- `.planning/PROJECT.md` §Constraints — 里程碑目标与已锁定决策

### 研究（本阶段实现的直接依据）

- `.planning/research/PITFALLS.md` **P1**（第 31-68 行：find-skills 逐字打包 = 分发 RCE 说明书；含 `npx skills add -g -y` 原文与逐条后果）、**P10**（许可证归属）
- `.planning/research/STACK.md` §发现 5（内置技能真实仓库路径与 frontmatter）、§「原生模块 / asarUnpack」与「内置技能目录的打包」（两条分发路线对比 + `migrateAiMemory` 幂等先例）
- `.planning/research/ARCHITECTURE.md` §External Services / §打包与资源路径 / §Suggested Build Order 阶段 1（`skills-builtin/` 目录形状、播种按单技能目录粒度、版本戳登记表原始设想）
- `.planning/research/SUMMARY.md` §Phase 47（Delivers / Avoids / Research needed）与 §Open Decisions（O1 / O3 / O4 / O10 的推荐值）
- `.planning/research/FEATURES.md` — 技能能力边界与 Anti-Features

### 上一阶段（本阶段的前置契约）

- `.planning/phases/46-prompt/46-CONTEXT.md` — D-01..D-11：prompt 段位置、`refreshSkills()` 兜底重扫、遮蔽与目录名权威、诊断形状、三条限额、启停存储键 `settings.aiSkills.disabled`
- `.planning/phases/46-prompt/46-SUMMARY.md`（若存在）— 实际交付与机制断言

### 项目内既有先例（实现时照抄的对象）

- `ai-bash-policy.js` — `evaluateBashCommand` 三档裁决流水线（危险优先 → 白名单 → 默认）、`DANGEROUS_PATTERNS`、`DANGEROUS_INTERPRETERS`、`matchesWhitelist` 前缀语义、`extractCommandName`（D-13..D-16 的落点）
- `agent-workspace.js` — `getManagedSkillsDir()` / `ensureWorkspaceDir()`（播种的目标目录）、`migrateAiMemory()`（「旧存在 && 新不存在才迁」幂等先例）、`resolveInside` 与 `createSandboxEnv`（**本阶段零改动**）
- `ai-skills-manager.js` — 技能集单一数据权威；`LIMITS.MAX_SKILL_MD_BYTES = 64 KiB`（skill-creator SKILL.md 33,168B 合规）、`createSkillsEnv` 的根层非目录 entry 过滤（保证 `.seed.json` 类文件不会被当技能）
- `favorites-manager.js` 的 `nodejieba.load` — `app.isPackaged` + `process.resourcesPath` 路径分支先例（D-12）
- `docs/product/ai-skills.md` — 六节骨架已由 Phase 46 建立，本阶段按 D-18 补「内置技能」与「bash 安装档」章节
- `docs/product/ai-agent-workspace.md` §四 bash 三档权限 / §七 安全边界（D-18 的修改对象）
- `AGENTS.md` §AI 工作区与 Bash 权限 / §开发-正式环境差异 → 发布前必查 — 维护约定、asarUnpack 发布规则、`make install` 后实跑要求

### 参考实现（仓库外，仅作设计参照，不引入依赖）

- `/Volumes/ZhiTai/Projects/github/openhanako/core/first-run.ts` — `syncSkills`：按单技能目录粒度、每次启动无条件同步（D-08 的原型）
- `/Volumes/ZhiTai/Projects/github/openhanako/shared/safe-fs.ts` — `safeCopyDir`：临时目录 → rename → 备份 → 失败回滚的原子目录复制（D-08 的原子性参照）
- `/Volumes/ZhiTai/Projects/github/openhanako/skills2set/skill-creator/` — 上游 skill-creator 保留形状 + `scripts/check_env.mjs` 环境预检（D-05 的原型）
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/sandbox/policy.ts`（`READ_ONLY_HOME_DIRS` 在沙箱层声明 skills 只读）与 `lib/skills/skill-file-identity.ts`（`editable` 数据模型）— Realm **明确不采用**（Phase 46 已否决只读挂载/第二 root），仅作对照说明
- `/Volumes/ZhiTai/Projects/github/openhanako/package.json` §`extraResources` — skills2set 经 extraResources 分发（D-12 未选用的替代路线）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `ai-bash-policy.js` 的三档流水线结构 —— `install` 档只需新增一张模式表 + 一处 reason 分支，`matchesWhitelist` / `splitCommandPipeline` / `normalizeSegment` / `extractCommandName` 全部复用
- `agent-workspace.js` 的 `getManagedSkillsDir()` —— 播种的写入目标；`ensureWorkspaceDir()` 已保证目录存在
- `agent-workspace.js` 的目录访问器编排（`getWorkspaceDir()` 派生一切）—— `skills-builtin/` 的**打包源**路径是另一条独立链路（`app.isPackaged` 分支），不要把两个概念混在一处
- `safeCopyDir` 式的「临时目录 → rename → 回滚」原子目录复制 —— Realm 尚无此工具函数，需在播种模块内新建（可照 openhanako `shared/safe-fs.ts` 的形状）

### Established Patterns

- **常量单源**：限额、内置技能清单等只在模块一处定义（Phase 43 `BUDGETS` / Phase 46 `LIMITS` 先例）
- **禁止静默失败**：D-09 的覆盖前差异诊断、D-11 的 seeded 判定都遵守既有「诊断带 `limit` / `currentValue` 可操作字段」的约定
- **发布前必查**：D-12 的 asarUnpack + 路径分支必须在 `make install` 后实际启动一次 .app 验证（nodejieba 事故 9a1ae11 的教训）
- **单一沙箱 root**：`managed-skills/` 与 `skills/` 同在沙箱 root 内，**不要**为内置技能引入只读挂载或第二个 root（Phase 46 已明确否决）
- **文档即契约**：能力变更必须同步 `docs/product/ai-skills.md` / `ai-agent-workspace.md` / `AGENTS.md`（D-18）

### Integration Points

- `ai-bash-policy.js` —— 新增 `PACKAGE_MANAGER_INSTALL_PATTERNS` + `evaluateBashCommand` 的 `install` 分支；`ai-manager.js:5630` 的 `_createBashToolWithPolicy` 消费 `verdict.reason` 生成确认卡片文案，需同步区分 `'install'`（D-15）
- `ai-manager.js:5647` 与 `tests/test-ai-bash-policy.js`（29 例）—— 安装档断言与只读反例的落点
- 启动链路 —— 播种调用点需在 `ensureWorkspaceDir()` 之后；参照 `migrateAiMemory()` 的调用位置
- `package.json` 的 `build.asarUnpack` —— 当前只有 `["node_modules/nodejieba/**"]`，本阶段追加 `skills-builtin/**`
- Phase 48 / 49 的**数据形状契约**（本阶段须保证其可消费）：seeded 身份判定来源（D-11）、`managed-skills/` 的内容形状、`install` 档的 `verdict` 字段

</code_context>

<specifics>
## Specific Ideas

- **openhanako 是本阶段的对照实现**，用户主动指定参考。三处直接借鉴：`syncSkills` 的每次启动自愈同步、`check_env.mjs` 的按 capability 分组环境预检、`safeCopyDir` 的原子目录替换。
- **用户对「CLI 装进工作区」的判断依据**：「反正是获取网络资源不涉及宿主机信息安全」—— 讨论中已澄清该前提不成立（bash 以用户全权限运行，装在工作区不等于被隔离；`npx` 的包生命周期执行任意代码正是 P1 要挡的向量；`-g` 产物落在 Realm 不扫描的目录会形成卸不掉的持久化植入点）。用户接受零安装路线，但**明确要求把 CLI 路线记入里程碑后续改版**，前置条件是先有 OS 级隔离。
- **「登记表」的语义扭曲已澄清**：ROADMAP Phase 49 说的「按播种登记表判定，而非按目录位置」，其目的是「不能靠『它在 managed-skills/ 里』来推断 seeded 身份」（因为 AI 自建技能也在同一目录）。D-11 用「随包 `skills-builtin/` 的目录名清单」满足该目的，且比状态文件更抗删改。
- **P1 门禁需要两半同时落地**：只改写技能文本而不补安装档，用户把 `npx` 加进白名单即可永久免确认（PITFALLS P1 后果 1）；只补安装档而不改写文本，则随包分发了一份「怎么装任意代码」的说明书。两半必须同阶段交付。
- **SKILL-09 有真实载体**：选定保留 skill-creator 的 `scripts/` 后，技能自带脚本的执行路径（含确认卡片成本）在本阶段就有实际可验的对象，不需要额外造演示技能。
- **npm ci 归类的判据**：它从 lockfile 恢复依赖、不取新代码，但**会执行所有依赖的 `postinstall` 脚本** —— 「不取新代码」不等于不执行任意代码，故计入安装档。

</specifics>

<deferred>
## Deferred Ideas

- **find-skills 恢复 CLI 路线**（在工作区内安装 skills CLI 做只读检索）—— **用户 2026-09-11 明确要求记入里程碑作为后续改版项**。前置条件：先引入 OS 级隔离（macOS `sandbox-exec`、Linux bubblewrap 等真沙箱），否则安装脚本仍以用户全权限执行、`-g` 也无法封堵。openhanako 的 `lib/sandbox/`（seatbelt + bwrap + win32 helper）是该前置条件的参考实现。
- **随包静态技能目录（离线兜底清单）** —— 需人工维护、必然过期，且多一份随包资源与许可证归属面；待零安装路线稳定后再评估。
- **openhanako 的 `install_skill` 工具模式**（AI 直接安装 GitHub 技能 + LLM 安全审查软门禁 + `risk_accepted` 确认令牌，令牌绑定 sourceKey 与内容摘要以防审查后内容被换）—— 与 Realm 的分工（Phase 49 `manage_skill` 不联网、Phase 51 用户驱动导入）不同。**其中的「审查结论绑定内容摘要 + 显式 `risk_accepted` 重试」流程**对 Phase 51 的两阶段预览有参考价值。
- **O4 的「版本戳登记表 + 未修改才覆盖」原始设计** —— 被 D-08/D-09 替代（改为无条件覆盖 + 差异诊断），不再作为本阶段实现目标；若日后出现「用户需要长期定制内置技能」的真实诉求，再评估恢复。
- **`allowed-tools` 的解析与展示** —— 本阶段只做文档声明（D-18）；若后续阶段要展示，必须带「当前运行时不被强制，仅供参考」免责标注（O3），执行层门禁明确 Out of Scope。
- **O5 显式解析 frontmatter（`yaml` 提升为直接依赖）** —— 归 Phase 51。

</deferred>

---

*Phase: 47-内置技能播种 + bash 策略加固*
*Context gathered: 2026-09-11*

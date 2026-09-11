# Phase 47: 内置技能播种 + bash 策略加固 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-11
**Phase:** 47-内置技能播种 + bash 策略加固
**Areas discussed:** find-skills 改写形态, skill-creator 取用范围, 播种模型与打包路线, bash 包管理器安装档边界

---

## find-skills 改写形态

### 问题 1：候选清单从哪里来？（第一轮）

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 web_search 工具 | 技能正文引导模型调用已有 web_search / web_fetch 检索真实技能仓库，输出带来源 URL 的候选 | |
| 纯模型知识 | 不动用工具，模型凭训练知识给清单 | |
| 随包静态目录 | 随包一份已知技能清单（JSON/MD），模型只从中检索 | |

**User's choice（free text）:** 「这个还要在讨论下，我们的 web_search 可能无法准确搜索，如果 find-skills 不去 cli，应该可以将 cli 安装在沙盒呢，在沙盒内运行吧，反正是获取网络资源不涉及宿主机信息安全」

**Notes:** 用户提出「把 CLI 装在沙盒内运行」的方向，与 SEED-03 / ROADMAP 成功判据 2 / P1 门禁判据正面冲突。回应中澄清了三点事实：① 现有硬沙箱（`createSandboxEnv`）只约束 FileSystem 路径与 `exec` 的 cwd，`bash` 以当前用户全权限运行，**装在工作区不等于被隔离**；② `npx` 从 registry 拉包并在安装生命周期执行任意代码，正是 P1 要挡的 RCE 向量，工作区内的 `cwd` 约束不住它；③ `-g` 产物落在 Realm 不扫描的目录（如 `~/.claude/skills`），形成「用户看不见也删不掉」的持久化植入点。另说明走 CLI 路线需同步改 SEED-03 / ROADMAP 判据 2 / P1 判据三处。

### 问题 1（重新讨论）：候选清单从哪里来？

| Option | Description | Selected |
|--------|-------------|----------|
| 零安装 + 只读网络发现 | 不装任何 CLI；正文引导模型用 web_fetch 直取结构化技能索引端点（GitHub 搜索 API / 技能注册表）拿真实仓库与 URL，web_search 兜底 | ✓ |
| 工作区内装 CLI（改需求） | 允许 npm install --prefix 装 skills CLI，只读子命令检索；接受 SEED-03 / ROADMAP / P1 三处需求变更 | |
| 先做真沙箱（另开阶段） | 引入 macOS sandbox-exec 等 OS 级隔离后再允许装 CLI | |
| 随包静态目录 | 完全离线清单，需人工维护 | |

**User's choice:** 零安装 + 只读网络发现 —— 但明确附加要求：「你要记录到里程中，后续要做改版」

**Notes:** 用户接受零安装路线，同时要求把「恢复 CLI 路线」记入里程碑作为后续改版项，前置条件是先有 OS 级隔离。讨论中给出四条推荐理由：① P1 门禁的本质是「随包不可分发安装处方」，只要正文存在可执行安装路径门禁即失守；② CLI 路线想拿的收益不装也能拿（skills CLI 的 `find` 底层就是发 HTTP 查注册表，用 web_fetch 打结构化端点拿到的数据可靠性高于模糊网页搜索）；③ CLI 路线的隐性代价更大（三处需求变更 + `-g` 需单独封堵 + `-y` 再次制造「一次确认替掉两层确认」）；④ 零安装路线的正文短、每行可人工过审，正是门禁要求的可审计性。

**plan 期实测项（诚实边界）:** `web_fetch` 走 turndown HTML→Markdown 管线，须验证对 `api.github.com` 这类 **JSON** 响应是否原样返回而非被转坏；同时挑出稳定的注册表端点。若 JSON 被转坏，退路为 `web_search` 定位仓库 + `web_fetch` 读仓库页，仍零安装。

### 问题 2：正文要不要显式声明「禁止执行安装」？

| Option | Description | Selected |
|--------|-------------|----------|
| 显式写死禁令 | 正文开头写明「只产出候选清单，绝不执行任何安装/下载命令」 | ✓ |
| 不写，靠策略兜底 | 只靠不留可执行安装文本 + bash 安装档强制确认 | |

**User's choice:** 显式写死禁令

**Notes:** 第一轮回答为「根据来源从新讨论」，在问题 1 定案后确认。

### 问题 3：Phase 47 时设置页还没有导入入口，技能文本如何指路？

| Option | Description | Selected |
|--------|-------------|----------|
| 前瞻指向设置页 | 明写「设置 → AI → 技能管理 → 导入」，六阶段同属 v2.6，发布时入口已存在 | ✓ |
| 中性措辞 | 只说「由用户在 Realm 内导入」，不点名 UI | |
| 前瞻 + 手动兼容 | 前瞻指向 + 「若当前版本尚无入口可手动放入 skills/ 目录」 | |

**User's choice:** 前瞻指向设置页

### 问题 4：内置技能的 description 写给谁看？

| Option | Description | Selected |
|--------|-------------|----------|
| 中文，面向用户 | disable-model-invocation: true → 不进 system prompt，description 只服务 / 面板与设置页列表 | ✓ |
| 保持英文 | 与上游一致便于比对 | |
| 中英分层 | description 中文 + 正文英文结构 | |

**User's choice:** 中文，面向用户

---

## skill-creator 取用范围

**讨论前置事实核实（GitHub API 实测，`anthropics/skills` + `vercel-labs/skills`）：**

- `vercel-labs/skills/skills/find-skills/`：**仅 SKILL.md 一个文件**（5,472 B）
- `anthropics/skills/skills/skill-creator/`：`LICENSE.txt` 11,345 B + `SKILL.md` **33,168 B** + `scripts/`（9 个 Python，含 `run_eval.py` / `run_loop.py` / `aggregate_benchmark.py` / `improve_description.py` / `package_skill.py` / `quick_validate.py` / `generate_report.py` / `utils.py` / `__init__.py`） + `references/schemas.md` 12,061 B + `agents/`（analyzer / comparator / grader 三个 md）+ `assets/eval_review.html` + `eval-viewer/`（`generate_review.py` + `viewer.html` 44,355 B）

即上游 skill-creator 本体是**一套用 Python 跑的技能评测流水线**，「仅作者指南部分」不是删目录那么简单 —— 33 KB 的 SKILL.md 里对 `scripts/` 的引用必须逐段处置。

**用户指定参考实现：** `/Volumes/ZhiTai/Projects/github/openhanako`（用户：「看下这个项目是怎么做的，它也是有沙盒」）。核实结果：openhanako 的 `skills2set/skill-creator/` **完整保留上游全部内容**（SKILL.md 31,414 B 略改），并**新增 `scripts/check_env.mjs`（13,303 B，Node）** 做环境预检 —— 按 capability 分组（`baseline` / `quick-validate` / `package-skill` / `run-eval` / `description-optimize`）报告 python ≥3.10 与 `pyyaml` / `anthropic` 依赖，支持 `HANA_SKILL_CREATOR_PYTHON` 覆盖解释器，10s 超时。它能放心跑 Python 是因为有**真 OS 级沙箱**（`lib/sandbox/seatbelt.ts` + `bwrap.ts` + win32 helper，`policy.ts` 的 `READ_ONLY_HOME_DIRS = ["user","skills","session-files"]`）。

### 问题 1：skill-creator 到底取多少？

| Option | Description | Selected |
|--------|-------------|----------|
| 完整保留上游 + 环境预检 | 照 openhanako：SKILL.md + scripts/ 9 个 Python + references/ + assets/ + eval-viewer/ + LICENSE.txt 全部随包，另加 Node check_env.mjs 预检 | ✓ |
| 仅 SKILL.md 作者指南 | 只取 SKILL.md，正文指向 scripts/ 的段落逐段改写为 Realm 工具路径 | |
| SKILL.md + 精简脚本 | 保留 package_skill / quick_validate 类，去掉评测类重脚本 | |

**User's choice:** 完整保留上游 + 环境预检

**Notes:** 已确认接受的代价：~100 KB Python 内容随包；用户需自备 python3 + pyyaml（+anthropic）；**每次跑脚本都会弹确认卡片**（Realm 无 OS 沙箱，且 `node` / `python3` 均在 `DANGEROUS_INTERPRETERS` 内且白名单不可越过 —— 这是 SKILL-09「复用既有机制、零新增权限」的必然结果）。体积核对：SKILL.md 33,168 B < `MAX_SKILL_MD_BYTES` 65,536 B，合规。

### 问题 2：内置技能正文用什么语言？

| Option | Description | Selected |
|--------|-------------|----------|
| 自研中文 + 上游英文 | find-skills 改写版正文中文，skill-creator 保持上游英文原文（仅必要改写） | ✓ |
| 全部中文 | 两个技能正文全中文 | |
| 全部英文 + 中文 description | 正文全英文，description 中文 | |

**User's choice:** 自研中文 + 上游英文

**Notes:** 与 openhanako 一致（其 `character-creator` / `user-guide` 是中文，上游 skill-creator 是英文），且便于日后与上游逐行比对。

### 问题 3：如果保留脚本，正文怎么引导模型用它们？

| Option | Description | Selected |
|--------|-------------|----------|
| 先 check_env 再跑脚本 | 正文引导先跑 check_env.mjs 拿能力清单，缺依赖时告知用户装什么 | |
| 直接跑脚本 | 正文直接写 python3 scripts/xx.py，失败由脚本自行报错 | |
| Realm 工具为主、脚本可选 | AI 优先用 Realm 的 write / read 工具完成创建与校验，仅确实需要评测时才走 python3 | ✓ |

**User's choice:** Realm 工具为主、脚本可选

**Notes:** 把脚本从主路径降为可选路径以减少确认弹框；`check_env.mjs` 仍随包提供（其环境预检价值独立于主/可选路径），仅在走脚本路径前引导调用。

---

## 播种模型与打包路线

**讨论前置事实：** ROADMAP Phase 49 成功判据 3 要求「对 seeded 内置技能的覆盖或删除请求被拒绝（**按播种登记表判定，而非按目录位置**）」—— 即 seeded 权威清单无论如何都得有，它同时被 48（来源徽标）与 49（拒绝判定）消费。用户指定参考的 openhanako 采用：`core/first-run.ts` 的 `syncSkills` **每次启动无条件覆盖**（按单技能目录粒度），`shared/safe-fs.ts` 的 `safeCopyDir` 做「临时目录 → rename → 备份 → 失败回滚」原子目录替换，无版本戳、无「未修改才覆盖」判定，且**静默**抹掉用户修改；打包走 `extraResources`（`dist-server-artifact/${os}-${arch}/` → `seed/`），不进 asar。

**同时更正了一处先前说法：** 研究文档 `STACK.md`「内置技能目录的打包」实测后推荐的是「显式递归 `readdirSync`+`readFileSync` 写盘、零构建配置改动」，与 SEED-05 字面的 `asarUnpack` 不同。

### 问题 1：播种/升级用哪种模型？

| Option | Description | Selected |
|--------|-------------|----------|
| 每次启动无条件覆盖 + 差异诊断 | 照 openhanako 自愈模型，但补一道「不静默」：同步前对比磁盘与随包内容，不一致（用户改过）先产 warning 诊断再覆盖 | ✓ |
| 版本戳 + 未修改才覆盖 | 照 O4：登记表记录播种时内容 hash，一致才覆盖，不一致保留用户版本 + 诊断 | |
| 仅版本变化时同步 | 只在应用版本号变化时同步（版本号存 electron-store） | |

**User's choice:** 每次启动无条件覆盖 + 差异诊断

**Notes:** 理由：`managed-skills/` 是 app-owned 内容，用户定制走 `skills/` 同名遮蔽这条既有通道，语义自洽；幂等天然成立、永不半成品、永远跟上应用版本。显式偏离 O4「未修改才覆盖」字面，已在 CONTEXT.md 与本节说明改因。

### 问题 2：随包分发走哪条路线？

| Option | Description | Selected |
|--------|-------------|----------|
| asarUnpack + 路径分支 | SEED-05 字面 + nodejieba 先例；得到真实文件路径，递归复制直接可用 | ✓ |
| extraResources | openhanako 做法，静态数据不进 asar，路径 process.resourcesPath/skills-builtin | |
| 显式递归读 asar（零构建改动） | 研究文档实测推荐；自写递归遍历，研究同时警告 cpSync 在 asar 源上不可靠 | |

**User's choice:** asarUnpack + 路径分支

**Notes:** 选定理由：asarUnpack 给出真实文件路径、与既有 nodejieba 先例一致、且研究对 `cpSync` 在 asar 源上不可靠的顾虑在 asarUnpack 下不成立。必须实跑 `make install` 后的 .app 验证。

### 问题 3：「哪些技能是随包内置的」权威清单放哪？

| Option | Description | Selected |
|--------|-------------|----------|
| 扫随包目录名清单 | 运行时扫描随包 skills-builtin/ 的目录名集合，零状态文件 | ✓ |
| managed-skills/.seeded.json | 记录已播种技能名 + 时间戳 + 内容 hash；可被删/改，丢了就退化 | |
| electron-store | 与用户设置同一份存储；三环境 userData 分叉会造成行为不一致 | |

**User's choice:** 扫随包目录名清单

**Notes:** 不落状态文件 → 删不掉、不双写、三环境不会分叉；满足 ROADMAP Phase 49「按播种登记表判定，而非按目录位置」的目的（不能靠「它在 managed-skills/ 里」推断 seeded 身份，因为 AI 自建技能也在同一目录）。

### 问题 4：用户手删内置技能后下次启动怎么办？

| Option | Description | Selected |
|--------|-------------|----------|
| 重播（自愈） | 下次启动重新播种；「不要这个技能」应走禁用而非删文件 | ✓ |
| 不重播（尊重删除） | 记下删除意图不再播种；需区分「用户删的」与「本来就没播」 | |

**User's choice:** 重播（自愈）

---

## bash 包管理器安装档边界

**讨论前置事实：** `evaluateBashCommand` 先判危险段（`DANGEROUS_PATTERNS` 整段正则 + `DANGEROUS_INTERPRETERS` 命令名），命中即 `confirm/danger` 且白名单失效；否则查白名单。`npx` 两条都不命中 → 落默认档 → 用户把 `npx` 加进白名单即永久免确认（PITFALLS P1 后果 1 的具体缺口）。硬约束：`npm run dev` / `npm test` 必须不误伤，否则用户会把 `npm` 整个加白名单，反而一次放开安装档。

### 问题 1：安装档覆盖哪些命令？

| Option | Description | Selected |
|--------|-------------|----------|
| 家族覆盖 | npx / npm[i\|install\|ci\|exec] / pnpm[add\|install\|dlx] / yarn[add\|install\|dlx] / bun[add\|install\|x] / pip[3] install / python[3] -m pip install / uv[.] / uvx / brew[install\|upgrade\|reinstall] / cargo install / go install / gem install | ✓ |
| 仅枚举 5 条 | 只堵 npx / npm i / pnpm add / pip install / brew install | |
| 家族覆盖 + 下载执行变体 | 再加 curl 下载后执行、bash <(curl ...) 进程替换、eval $(...) 命令替换 | |

**User's choice:** 家族覆盖

**Notes:** 只堵字面 5 条会让 `yarn add` / `bun add` / `cargo install` / `uvx` / `npm ci` 成为完全等效的绕过口。与研究 PITFALLS P1 的推荐清单一致。未选「下载执行变体」因为进程替换/命令替换属现有引擎自认「无法静态穷举」的盲区，需新写解析逻辑，超出「加固一档」范围。

### 问题 2：安装档用什么形态实现？

| Option | Description | Selected |
|--------|-------------|----------|
| 独立 install 档 | 新增 PACKAGE_MANAGER_INSTALL_PATTERNS 表 + 新 reason 'install' + installNames 字段，与 DANGEROUS_PATTERNS 平行但语义分离 | ✓ |
| 并入 DANGEROUS_PATTERNS | reason 仍为 'danger'；改动最小但 `brew install wget` 与 `rm -rf` 在 UI 上无法区分 | |
| 扩充解释器集合 | 把 npx / pip3 / uvx 加进 DANGEROUS_INTERPRETERS；npm i / brew install 仍漏，且语义污染 | |

**User's choice:** 独立 install 档

**Notes:** 语义分离 —— `danger` = 本机破坏性操作，`install` = 从网络获取并执行第三方代码。install 判定与 danger 一样先于白名单检查（白名单不可越过）。

### 问题 3：安装档的 riskLevel 与确认文案？

| Option | Description | Selected |
|--------|-------------|----------|
| high + 专属文案 | 与 danger 同级；文案说明「将从网络下载并运行第三方代码；不会因加入白名单而免确认」 | ✓ |
| medium + 专属文案 | 减少告警疲劳，但把真实风险降级展示 | |

**User's choice:** high + 专属文案

**Notes:** 理由：`npm install` / `npx` 会在安装生命周期执行依赖的 `postinstall` 脚本，实质是任意代码执行，与 `rm` 同级合理。

### 问题 4：子命令判定粒度怎么定？

| Option | Description | Selected |
|--------|-------------|----------|
| 命令名+子命令，排除只读 | 排除 npm run/test/ls/view/audit/outdated、pnpm run、yarn run、brew info/list/search、pip list/show、cargo search、go list 等；npm ci 计入安装档 | ✓ |
| 同上但 npm ci 不算 | 认为 npm ci 只从 lockfile 恢复依赖、不取新代码 | |
| 只按命令名 | 凡 npm/yarn/pnpm 开头就确认；零误漏但 `npm run dev` 每次都弹框 | |

**User's choice:** 命令名+子命令，排除只读

**Notes:** 测试必须把只读命令写成反例断言。`npm ci` 计入的理由：它从 lockfile 恢复依赖、不取新代码，但**会执行所有依赖的 `postinstall` 脚本** —— 「不取新代码」不等于不执行任意代码。

---

## Claude's Discretion

- `THIRD_PARTY_NOTICES` 的具体落点与扩展名（repo 根 `THIRD_PARTY_NOTICES.md` vs 无扩展名文件）以及是否随 .app 分发 —— 判据是 P10 要求的「归属完整」。
- 诚实边界的记录方式：「安装档只审一级 bash 命令，脚本内部的二次 `spawn`（如 `check_env.mjs` 内部 `spawnSync` 调 python）不在策略视野内」是否写进 `docs/product/ai-agent-workspace.md` 已知限制。
- find-skills 候选清单的字段规范与「核验后才能输出」的强制程度（建议含名称/用途/仓库 URL/许可证，且必须经 `web_fetch` 核验）。
- find-skills 正文里给出哪些具体检索端点（需先实测 `web_fetch` 对 JSON 的返回形态）。
- `check_env.mjs` 的具体实现（capability 分组、超时、解释器覆盖环境变量名），可参照 openhanako 形状。

## Deferred Ideas

- **find-skills 恢复 CLI 路线** —— 用户 2026-09-11 明确要求记入里程碑作为后续改版项；前置条件为先引入 OS 级隔离。openhanako 的 `lib/sandbox/`（seatbelt + bwrap + win32）是参考实现。
- **随包静态技能目录（离线兜底清单）** —— 需人工维护、必然过期，多一份随包资源与许可证归属面。
- **openhanako 的 `install_skill` 工具模式**（LLM 安全审查软门禁 + `risk_accepted` 确认令牌，令牌绑定 sourceKey 与内容摘要）—— 与 Realm 分工不同，其中审查绑定内容摘要 + 显式重试的流程对 Phase 51 两阶段预览有参考价值。
- **O4 的「版本戳登记表 + 未修改才覆盖」原始设计** —— 被「无条件覆盖 + 差异诊断」替代；若日后出现「用户需要长期定制内置技能」的真实诉求再评估恢复。
- **`allowed-tools` 的解析与展示** —— 本阶段只做文档声明；日后展示须带免责标注（O3），执行层门禁 Out of Scope。
- **O5 显式解析 frontmatter（`yaml` 提升为直接依赖）** —— 归 Phase 51。

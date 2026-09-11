---
phase: 47-bash
plan: 3
subsystem: ai-skills
tags: [skill-creator, upstream-snapshot, apache-2.0-attribution, third-party-notices, check-env, environment-preflight, zero-install-scanner, exceptions-are-load-bearing, gate-tuning]

# Dependency graph
requires:
  - phase: 47-bash
    provides: 47-01 —— skills-builtin/ 源目录 + builtin-skills-seeder.js（按单技能目录粒度自愈播种）+ 二段式零安装语义扫描器（FORBIDDEN_PATTERNS / INSTALL_IMPERATIVES / EXEMPTIONS 三元组骨架）+ asarUnpack 打包条目
provides:
  - skills-builtin/skill-creator/**（19 文件：上游固定 SHA 快照 18 文件 + Realm 自研 check_env.mjs）
  - THIRD_PARTY_NOTICES.md（repo 根，P10 归属门禁载体，两个技能各五要素）
  - check_env.mjs 的 capability / 失败码 / installGuidance 契约（供 Phase 50 设置页预检复用）
  - EXEMPTIONS 从「预登记」变为「承重条目」的方法论：行内容正则 + 反向验证 + 承重性自证用例
affects: [47-04, 48, 49, 50, 51]

# Actuals (#2632)
actuals:
  tokens: 35132
  tasks: 4
  commits: 4
  plan_head_before: f28cc2f93cfc71d6d6cc3c15a057c444d8b151ff

tech-stack:
  added: []          # 零新增依赖（package.json 的 dependencies / devDependencies 原样；pyyaml/anthropic 是用户环境的 Python 包，不进 package.json）
  patterns:
    - "上游快照的取用纪律：先下载全部文件并用 wc -c 逐字节核对，任一不符立即停下；之后才动唯一需要改写的文件"
    - "受控改动清单化：改写只做计划枚举的项，「连带结果」单列而不计为独立偏离；归属说明逐条覆盖每一项"
    - "零安装语义扫描的豁免必须承重：豁免正则匹配整段文本、不用行号，并有「去掉它该行立刻被扫出」的自证用例"
    - "缺依赖/缺解释器路径用 test double（假解释器 shell 脚本）覆盖，避免依赖本机环境才有该分支"
    - "Apache-2.0 §4(b) 双层声明：SKILL.md 文首显著声明 + THIRD_PARTY_NOTICES.md 逐项修改说明"

key-files:
  created:
    - skills-builtin/skill-creator/SKILL.md
    - skills-builtin/skill-creator/LICENSE.txt
    - skills-builtin/skill-creator/scripts/check_env.mjs
    - skills-builtin/skill-creator/scripts/*.py（9）
    - skills-builtin/skill-creator/agents/*.md（3）
    - skills-builtin/skill-creator/references/schemas.md
    - skills-builtin/skill-creator/assets/eval_review.html
    - skills-builtin/skill-creator/eval-viewer/{generate_review.py,viewer.html}
    - THIRD_PARTY_NOTICES.md
  modified:
    - tests/test-builtin-skills-seeder.js

key-decisions:
  - "D-47-03-a（Q1：agents/ 随包）：包含 —— 3 文件 26,712 B，使「完整保留上游全部内容」成立、`## Advanced: Blind comparison` 的三处引用不断链；归属说明第 9 项如实记录"
  - "D-47-03-b（Q2：modified vs unmodified）：两个技能一律标 modified（fail-safe）—— 把已修改说成未修改是潜在的许可证违约，反之只是过度声明"
  - "D-47-03-c（check_env.mjs 的 capability 面）：收缩为 4 组（baseline / quick-validate / eval-viewer / description-optimize），去掉依赖 claude CLI 的 run-eval / run-loop"
  - "上游 SKILL.md:404 的 `update the skill\\'s …` 命中「安装技能的祈使句」模式（计划与 RESEARCH 都断言 0 命中）——第 1 段扫描面按设计零容忍、不接受豁免，故改写该句为 `set it in the skill\\'s …`（语义不变、仅消误报），归属说明第 11 项记录"
  - "EXEMPTIONS 第 1 条对准真正命中的行（缺依赖指引句），不用计划设想的 installGuidance 字段名（实测不命中，会是死条目）；第 2 条（逐字 Do not auto-install 声明）保留为防御性登记并在注释里写明它当前不命中"
  - "REALM_SKILL_CREATOR_PYTHON 只做形态校验（非空字符串）、不校验路径合法性 —— 该变量由用户自己设置，设置它即授权执行该路径的程序，不是远程输入（T-47-03-02 accept）"
  - "`--command` 的允许集合只含 Realm 版确实依赖的 node / python3；上游的 claude CLI 刻意不入列（D-47-03-c 的诚实延伸）"
  - "THIRD_PARTY_NOTICES.md 固定 SHA 取「该文件最后改动所属的 commit」而非仓库 HEAD，并把这条口径写进文档与升级检查清单"

patterns-established:
  - "豁免条目的承重性自证：用例断言「去掉豁免则该行被扫出」，把「不是死代码」变成每次跑测都会复核的机械事实"
  - "反向验证的错误输出原文必须进 SUMMARY（两次：豁免承重、注入 pip install 让第 1 段变红）——只写「变红过」不足以证明"
  - "P10 归属门禁的机械兜底：固定 SHA 逐字匹配 + 五要素关键词 + 两个 LICENSE.txt 随播种逐字节落盘比对"
  - "Test double 覆盖环境分支：假解释器 shell 脚本让 missing_dependency / attempt 计数在本机装了全部依赖时仍可复现"

requirements-completed: [SEED-01, SEED-03, SEED-04, SEED-05, SKILL-09]

coverage:
  - id: D1
    description: "skill-creator 作为固定 SHA 的上游快照随包：18 个上游文件逐字节与 47-RESEARCH §B-5 的实测清单一致（LICENSE.txt 精确 11,357 B），agents/ 完整保留；SKILL.md 经六处受控改动后不含平台专有内容、带 §4(b) 修改声明、frontmatter 含 disable-model-invocation + 中文 description"
    requirement: "SEED-01"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#18 个上游文件全部存在且逐字节等于固定 SHA 快照（SKILL.md 例外，用区间）"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#LICENSE.txt 是上游 Apache-2.0 全文逐字副本（精确 11,357 字节，不得摘要化）"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#SKILL.md 的六处受控改动与「英文正文 × 中文 description」边界（D-06 × D-04）"
        status: pass
      - kind: other
        ref: "正文 CJK 自查（计划的一次性命令）输出 `body has no CJK OK`；修改声明点名来源 SHA"
        status: pass
    human_judgment: false
  - id: D2
    description: "两个内置技能经播种 → 加载 → 不进 prompt 的完整链路：managed 来源、零诊断零错误；skill-creator 的 LICENSE.txt / scripts/ / agents/ / eval-viewer/ 均不产生诊断，嵌套资源完整落盘"
    requirement: "SEED-04"
    verification:
      - kind: integration
        ref: "tests/test-builtin-skills-seeder.js#两个技能都被加载：播种零诊断 → 零诊断零错误识别 → 均 source === managed"
        status: pass
      - kind: integration
        ref: "tests/test-builtin-skills-seeder.js#两个都不进 prompt：buildSkillsPrompt() === \"\""
        status: pass
    human_judgment: false
  - id: D3
    description: "check_env.mjs：8 个失败码常量单源、4 个 capability 分组、10s 超时、min Python 3.10、importlib.util.find_spec 只读包检查、spawnSync 双判；未知 capability/package/command 一律 unknown_requirement 且非零退出（ASVS V5）"
    requirement: "SKILL-09"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#无参运行：退出 0，stdout 是可解析 JSON 且含 ok(boolean) 与 capabilities 分组"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#未知 --capability / --package / --command 一律 unknown_requirement 且非零退出（ASVS V5）"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#缺依赖路径真实可达：missing_dependency + installGuidance 的「禁止自动安装」声明"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#REALM_SKILL_CREATOR_PYTHON 生效时优先且跳过自动探测"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#源码断言：spawnSync 失败必须「双判」，并注释说明 error 与 status 的语义差异"
        status: pass
    human_judgment: false
  - id: D4
    description: "零安装语义扫描面从单技能扩到两技能，P1-a-1/2/3 三条门禁信号各有独立命名断言，且两次反向验证证明非空转"
    requirement: "SEED-03"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#P1-a-1 / P1-a-2 / P1-a-3（describe「P1-a 门禁信号（SEED-03，两技能口径）」）"
        status: pass
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#豁免机制精确生效：第 1 条豁免是承重的（去掉它该行立刻被扫出）"
        status: pass
      - kind: other
        ref: "反向验证 A：给 SKILL.md 追加 pip install pyyaml → 第 1 段与 P1-a-1 双双变红（原文见下）；还原后 diff 为空"
        status: pass
      - kind: other
        ref: "反向验证 B：把第 1 条豁免正则改成永不匹配 → 第 2 段与豁免承重性用例双双变红（原文见下）；还原后 65/65"
        status: pass
    human_judgment: false
  - id: D5
    description: "P10 归属门禁载体就位：THIRD_PARTY_NOTICES.md 两技能各五要素、三处易错事实、Python 依赖免责、最后更新日期与升级检查清单；两个 LICENSE.txt 随播种逐字节落盘"
    requirement: "SEED-05"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#describe「P10 归属门禁（THIRD_PARTY_NOTICES.md）」共 8 例（P10-1..P10-5 + 易错事实 + 免责 + 日期/清单 + 自研条目）"
        status: pass
      - kind: other
        ref: "文档内不出现把已修改说成未修改的措辞（grep 计数 0）；两个固定 SHA 逐字出现"
        status: pass
    human_judgment: false
  - id: D6
    description: "SKILL-09 的零新增权限机制：技能自带脚本经既有 bash 工具执行，DANGEROUS_INTERPRETERS 未被放宽"
    requirement: "SKILL-09"
    verification:
      - kind: unit
        ref: "tests/test-builtin-skills-seeder.js#SKILL-09：脚本入口是 node/python3，两者都在 DANGEROUS_INTERPRETERS 内 → 每次执行必弹确认卡片"
        status: pass
      - kind: other
        ref: "git diff BASE..HEAD -- ai-bash-policy.js 为空（本计划零改动策略引擎）"
        status: pass
    human_judgment: false
  - id: D7
    description: "P10-6「打包后归属仍可读」与「打包态 paths 分支生效」未自动化覆盖"
    requirement: "SEED-05"
    verification: []
    human_judgment: true
    rationale: "P10-6 需要 make install-nightly 后确认 THIRD_PARTY_NOTICES.md 在 asar 清单内；打包态 asarUnpack 路径分支也只在真 .app 内走到（本计划全部断言都在开发态 + 临时 root 注入下运行）。两条均归 47-04 Task 3，已在测试源码里显式标注以免门禁审计误判为已覆盖。"
  - id: D8
    description: "零安装语义扫描是模式匹配而非语义分析，机械防护有上限"
    requirement: "SEED-03"
    verification: []
    human_judgment: true
    rationale: "模式表（FORBIDDEN_PATTERNS + INSTALL_IMPERATIVES）无法穷举中英等价改写；本次实测就发现计划与 RESEARCH 共同断言的「上游 SKILL.md 0 命中」不成立（见 Deviations 1）。真正的判据是逐句人工评审，扫描器只是把已知形态钉死。"
  - id: D9
    description: "上游正文里两处 Cowork 提及按计划的禁令逐字保留"
    requirement: "SEED-01"
    verification: []
    human_judgment: true
    rationale: "计划明令「除六处受控改动外不得有其他偏离上游正文」，且验收只禁 present_files / Claude.ai-specific / Cowork-Specific 三处标题子串。两处残余（Step 4 的 headless 回退说明、结尾 TodoList 提醒）属环境条件性说明，不是被删章节。已在 WINDOWS.md 登记，若后续要处理属新的受控改动。"

duration: 10min
completed: 2026-09-11
status: complete
---

# Phase 47 Plan 03: skill-creator 上游快照、check_env.mjs 与 P10 归属门禁 Summary

**skill-creator 以固定 SHA（`b0cbd3df…`）的上游快照随包（18 文件 225,004 B + 自研 check_env.mjs），SKILL.md 经六处受控改写后不再含平台专有内容且带 Apache-2.0 §4(b) 修改声明；新增的 Node 环境预检探针把「缺 Python / 版本过低 / 缺依赖 / 缺命令」变成 8 个明确失败码与用户可操作指引；`THIRD_PARTY_NOTICES.md` 以五要素记录两个技能并让 `modified` 判定可被测试逐条检索 —— 而零安装语义扫描面同时从单技能扩到两技能、两次反向验证证明它不是空转**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-11T09:46:14Z
- **Completed:** 2026-09-11T09:56:18Z
- **Tasks:** 4 / 4
- **Files modified:** 21（19 新建 / 2 修改），+7,198 / −15 行

## Accomplishments

- **上游快照的取用纪律生效**：18 个文件一律从 `raw.githubusercontent.com/anthropics/skills/<固定 SHA>/…` 取回，**先全部下载并逐字节核对**（`wc -c`，与 47-RESEARCH §B-5 的清单完全一致，`LICENSE.txt` 精确 11,357 B）**再动 SKILL.md** —— 避免了「改到一半发现某个文件取错版本」。大文件（`viewer.html` 44,998 B 等）全程未用 Read 打开。
- **六处受控改动的边界被机械钉死**：文首 §4(b) 修改声明（点名来源 SHA + 列出全部改动类别）、新增 `## Environment Preflight`、删除三章（`present_files` / Claude.ai / Cowork）、两处评测章加前置句、frontmatter 新增 `disable-model-invocation: true`、frontmatter `description` 中文化（151 字符 ≤1024）。**正文保持上游英文**由「剥离 frontmatter 后 CJK 零命中」同时用一次性自查命令与断言锁定 —— 一次性命令的输出 `body has no CJK OK` 是比事后跑断言更早的手滑捕手。
- **`## Reference files` 清单与会话包文件集逐项一致**：清单列 18 个相对路径（含 `scripts/check_env.mjs`），用例对**每一个**路径做 `existsSync` 核对并断言清单不再引用被删三章 —— 不是只匹配一个字符串。
- **`check_env.mjs` 把「环境能不能跑」变成机器可读契约**：4 个 capability 分组、8 个失败码常量单源、10 s 超时、`importlib.util.find_spec`（不真 import，零副作用）、解释器探测顺序 + `REALM_SKILL_CREATOR_PYTHON` 覆盖、`spawnSync` 失败**双判**（`result.error` 是 `Error` 对象、`result.status` 是退出码 `number | null`，代码注释写明为什么不能简化）。未知 `--capability` / `--package` / `--command` 一律 `unknown_requirement` + 非零退出（ASVS V5）。**它绝不安装任何东西**。
- **零安装语义扫描面从单技能扩到两个技能**：47-01 的扫描器本就按 glob 递归（未写死技能名），skill-creator 的两份受扫文件自动纳入；P1-a-1 / P1-a-2 / P1-a-3 三条信号各有独立命名断言，便于门禁逐条审计。
- **「豁免不是死代码」成为每次跑测都复核的机械事实**：第 1 条豁免对准真正命中的那一行；用例既断言「豁免生效时零命中」，也断言「去掉豁免则该行立刻被报出」。
- **P10 归属门禁可被逐条检索**：两个固定 SHA 逐字匹配、五要素关键词 14 项、文档中不出现把已修改说成未修改的措辞、两个 `LICENSE.txt` 随播种**逐字节**落盘比对（`skill-creator` 的精确 11,357 B）—— 补上了 47-VALIDATION 里 P10-5 的绑定缺口。
- **既有回归零破坏**：`test-ai-skills` 64/64、`test-agent-workspace` 21/21、`test-ai-bash-policy` 70/70；`git diff BASE..HEAD` 对 `builtin-skills-seeder.js` / `ai-bash-policy.js` / `ai-manager.js` / `package.json` 全为空，`package.json` 零新增依赖。

## Task Commits

四个任务各自原子提交：

1. **Task 1: skill-creator 上游快照落地与六处受控改写（tracer）** - `a90e549` (feat)
2. **Task 2: check_env.mjs 环境预检探针与零安装语义豁免机制落地** - `b69f57d` (feat)
3. **Task 3: THIRD_PARTY_NOTICES.md 归属记录与 P10 门禁断言** - `ca3aac8` (docs)
4. **Task 4: P1-a 门禁信号收敛与最终文件集收口** - `90e090b` (test)

_注：Task 1 是 `type="tracer"`。auto 模式下 tracer 门禁按 `<verify>` 端到端复跑（`node tests/test-builtin-skills-seeder.js` 39/39）通过后自动展开 —— `⚡ Tracer verified end-to-end — expanding`。_

## Files Created/Modified

- `skills-builtin/skill-creator/SKILL.md`（新建，32,672 B，487 行）- 上游 33,168 B 的受控改写版。frontmatter：`name` / 中文 `description`（151 字符）/ `disable-model-invocation: true`。文首 §4(b) 修改声明（点名 `b0cbd3df…`，列出全部改动类别，**措辞刻意避开 `present_files` / `Claude.ai-specific` / `Cowork-Specific` 三个被禁子串**）。新增 `## Environment Preflight`（英文）。删除三章。两处评测章加前置句（英文）。`## Reference files` 扩为 18 项。
- `skills-builtin/skill-creator/LICENSE.txt`（新建，11,357 B）- 上游 Apache-2.0 **全文逐字副本**（含 APPENDIX），未改写、未摘要化。
- `skills-builtin/skill-creator/scripts/check_env.mjs`（新建，19,947 B，约 560 行）- Realm 自研（**非**上游内容，以 MIT 随包分发）。`ENV_VAR = 'REALM_SKILL_CREATOR_PYTHON'` / `MIN_PYTHON_VERSION = [3,10,0]` / `CHECK_TIMEOUT_MS = 10_000` / `PACKAGE_SPECS`（pyyaml→yaml、anthropic）/ `CAPABILITIES` 4 组 / `KNOWN_COMMANDS = ['node','python3']` / `FAILURE_CODES` 8 个常量单源。输出固定含 `ok` / `code` / `python` / `packages` / `commands` / `capabilities`（catalog + requested + status）/ `installGuidance` / `message` / `requirements` / `attempted`；`process.exit(result.ok ? 0 : 1)`。
- `skills-builtin/skill-creator/scripts/*.py`（新建，9 文件）- `__init__.py`（0 B，上游即空）/ `aggregate_benchmark.py` 14,386 / `generate_report.py` 12,847 / `improve_description.py` 11,116 / `package_skill.py` 4,234 / `quick_validate.py` 3,972 / `run_eval.py` 11,464 / `run_loop.py` 13,605 / `utils.py` 1,661。
- `skills-builtin/skill-creator/agents/*.md`（新建，3 文件 26,712 B）- `analyzer.md` 10,376 / `comparator.md` 7,287 / `grader.md` 9,049。**已核对无 Claude 平台专有工具引用**（`present_files` / `Claude.ai` / `Cowork` / `claude -p` 各 0 命中）→ D-47-03-a 的应急分支未触发。
- `skills-builtin/skill-creator/references/schemas.md`（12,061）、`assets/eval_review.html`（7,058）、`eval-viewer/generate_review.py`（16,365）、`eval-viewer/viewer.html`（44,998）- 上游逐字快照。
- `THIRD_PARTY_NOTICES.md`（新建，repo 根，8,967 B，130 行）- 五要素双技能记录 + 三处易错事实 + Python 依赖免责 + 最后更新日期 + 升级检查清单四步（并写明 P10 断言组就是那条机械兜底）。
- `tests/test-builtin-skills-seeder.js`（修改，753 → 1,094+ 行）- 新增 3 个 describe 分组共 32 例：`内置技能上游快照与归属（SEED-01 / SEED-05 / P10）` 6 例、`check_env.mjs 环境预检（D-05 / D-07 / SKILL-09）` 11 例、`P10 归属门禁（THIRD_PARTY_NOTICES.md）` 8 例、`P1-a 门禁信号（SEED-03，两技能口径）` 5 例。新增表 `UPSTREAM_SKILL_CREATOR_FILES`（17 项精确字节）/ `UPSTREAM_SKILL_MD_BYTES`（区间）/ 辅助函数 `parseReferenceFileList` / `runCheckEnv` / `makeFakePython`。`EXEMPTIONS` 落为承重条目。改写 47-01 期已过时的「第 2 段集合为空」断言。

## Decisions Made

- **D-47-03-a（Q1）：`agents/` 随包**。3 文件 26,712 B，使「完整保留上游全部内容」成立，`## Advanced: Blind comparison` 的三处 `agents/*.md` 引用不断链。已核对三者无平台专有工具引用。
- **D-47-03-b（Q2）：两个技能一律标 `modified`**（fail-safe）。除 `THIRD_PARTY_NOTICES.md` 外，`SKILL.md` 文首另加一行显著修改声明（Apache-2.0 §4(b) 的直接要求）。
- **D-47-03-c：capability 收缩为 4 组**。去掉依赖 `claude` CLI 的 `run-eval` / `run-loop`；`--command` 的允许集合也只列 `node` / `python3`（把 `claude` 排除在外是对该决策的诚实延伸 —— 它不属于本技能的工具链）。
- **上游 `SKILL.md:404` 的消歧改写**（见 Deviations 1）：第 1 段扫描面按设计零容忍、不接受任何豁免，因此只能改文本而不能加豁免；模式表保持与 47-RESEARCH §A-4 逐字一致（不削弱门禁）。
- **EXEMPTIONS 的口径**：第 1 条对准**真正命中的**那一行（缺依赖指引句，`check_env.mjs:508`），而不是计划设想的 `installGuidance` 字段名 —— 实测字段名与逐字声明行在当前模式表下都 0 命中，按原设想登记会是死条目。第 2 条保留为防御性登记并在注释里写明「当前不命中」。
- **`missing_dependency` 用 test double 覆盖**：本机装了 `pyyaml` 与 `anthropic`，用假解释器（shell 脚本，按 `$2` 是否含 `version_info` 分流）让该分支在任何机器上都可复现。
- **`REALM_SKILL_CREATOR_PYTHON` 只做形态校验**：非空字符串即接受，不校验路径合法性 —— 该变量由用户自己设置，设置它即授权执行该路径的程序，不是远程输入（T-47-03-02 判为 accept）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 计划与 RESEARCH 共同断言的「上游 SKILL.md 对安装语义 regex 0 命中」不成立**

- **Found during:** Task 1（下载核对后、动 SKILL.md 前的预扫）
- **Issue:** 上游 `SKILL.md:404` 的 `Take \`best_description\` from the JSON output and update the skill's SKILL.md frontmatter.` 命中 `INSTALL_IMPERATIVES` 的 `/\b(install|add|update)\s+(the\s+)?skill\b/i`（「安装技能的祈使句」）—— `update the skill's …` 无法与该模式区分。RESEARCH §B-2 的「0 命中」用的是另一组 regex（`pip install|npm i|npx|curl \| sh|apt-get|brew install|uv pip|install the missing`），不含该祈使句模式，所以从未被测到。这是一处**模式误报**，不是真的安装语义。
- **Fix:** 把该句改写为 `set it in the skill's SKILL.md frontmatter`（**语义不变**，仅消误报）。**没有**改模式表：`INSTALL_IMPERATIVES` 是 P1 门禁的组成，且第 1 段扫描面按 47-01 的架构决策零容忍、不接受豁免（既有用例还断言「豁免条目不得落在第 1 段扫描面内」）—— 削弱模式表或给第 1 段开豁免都会让门禁失守。该改写作为**第 11 项**记入 `THIRD_PARTY_NOTICES.md` 的修改说明（否则「其余正文逐字保留」就是假陈述，违反 T-47-03-05）。
- **Files modified:** `skills-builtin/skill-creator/SKILL.md`、`THIRD_PARTY_NOTICES.md`
- **Verification:** 改写后第 1 段对 skill-creator 的 `SKILL.md` + `LICENSE.txt` 零命中；`node tests/test-builtin-skills-seeder.js` 39/39。
- **Committed in:** `a90e549`（Task 1）/ 归属说明在 `ca3aac8`（Task 3）
- **已记入** `.planning/WINDOWS.md`（kind: deviation / phase 47，id 11）

**2. [Rule 2 - Missing critical functionality] `check_env.mjs` 的成功路径没有可供断言「跳过自动探测」的字段**

- **Found during:** Task 2（写 `REALM_SKILL_CREATOR_PYTHON` 优先级的用例）
- **Issue:** 计划验收要求「`REALM_SKILL_CREATOR_PYTHON` 被设置时优先于自动探测」，但参照形状的输出只在失败时带 `attempted`，成功路径拿不到「探测了几个候选」。仅断言 `python.version` 能间接说明，却不足以机械证明探测分支被跳过。
- **Fix:** 把 `attempted` 提到顶层并**在所有分支**都输出（含成功路径），用例断言 `attempted.length === 1` 且 `python.version` 来自被指定的假解释器（3.11.0，与 PATH 上真实的 3.12.12 不同）。同时补 `--help` / `-h`（CLI 基本可用性，未列入计划但属常见约定）。
- **Files modified:** `skills-builtin/skill-creator/scripts/check_env.mjs`
- **Verification:** 用例通过；且它直接支撑了另一条既有断言（双判注释仍被检出）。
- **Committed in:** `b69f57d`（Task 2）
- **已记入** `.planning/WINDOWS.md`（id 15）

### Plan-text Reconciliations（计划内部自相矛盾项，按更具体的门禁口径调和）

**3. Task 1 的 `<files>` / 计数口径与 Task 2/4 的口径看似冲突 —— 实为三段式收口，已按唯一口径落地**

- **Issue:** Task 1 的 `<files>` 列 19 项但 acceptance 写「计数口径 = 18」（`check_env.mjs` 由 Task 2 产出）；Task 2 要 19 项全量；Task 4 要 `find skills-builtin -type f` = 21。
- **Fix:** 唯一口径落地为 **18（上游）= 17（逐字快照，精确字节）+ 1（`SKILL.md`，受控改写）**；Task 2 收口 19（+`check_env.mjs`）；Task 4 收口 21（+find-skills 2）。测试用 `UPSTREAM_SKILL_CREATOR_FILES.length + 1 === 18` 把口径钉在代码里，并在 Task 4 断言 `paths.concat('SKILL.md') === skill-creator 的 19 项`。
- **Verification:** 三个口径的用例同时全绿。
- **已记入** `.planning/WINDOWS.md`（id 14）

**4. Task 1 的 acceptance 同时要求「18 个上游文件逐字节与上游一致」与「`SKILL.md` 用区间而非精确值」**

- **Issue:** `SKILL.md` 承载六处受控改动，字节数必然不等于上游 33,168 —— 两条要求不能同时以「精确相等」满足。
- **Fix:** 17 个未改动的上游文件断言**精确**字节数（快照没取错版本的护栏）；`SKILL.md` 用 `[30000, 40000]` **区间**护栏。两者在同一个用例里，注释写明分工。
- **Verification:** `SKILL.md` 实测 32,672 B 落在区间内；17 个文件字节逐一相符。
- **已记入** `.planning/WINDOWS.md`（id 14）

**5. Task 2 step 3/4 假设 `installGuidance` 两行会命中禁用模式（故需豁免），实测不成立**

- **Issue:** 对逐字照抄 §A-4 的模式表实测：参照形状的 `check_env.mjs` **0 命中**（`installGuidance: [` 字段名行与逐字 `Do not auto-install dependencies from this skill.` 行都不被任何模式匹配）。按原设想登记豁免会得到两个**死条目**，而 Task 2 step 4 明确要求「临时移除一条豁免应导致该行被报出」—— 死条目无法满足。
- **Fix:** 让第 1 条豁免对准**真正命中**的那一行：缺依赖引导句 `` `Install the skill-creator Python dependencies yourself, …` `` 命中 `INSTALL_IMPERATIVES[0]`。第 2 条（逐字声明行）保留为**防御性登记**，并在注释里如实写明它当前不命中、登记目的是防「模式表收紧后静默判违规」。匹配方式一律「整段文本正则」，正则长度 50 / 20 字符（远大于 `install`）。
- **Verification:** 承重性用例断言「去掉豁免则该文件第 508 行被报出」；反向验证实跑并记录原文（见下）。
- **已记入** `.planning/WINDOWS.md`（id 12）

**6. 47-01 期的断言「第 2 段集合为空」在 skill-creator 落地后过时**

- **Issue:** 该用例断言 `stage2Files() === []`（47-01 期 `skills-builtin/` 只有 find-skills 的 SKILL.md + LICENSE.txt，均属第 1 段）。skill-creator 落地后第 2 段新增 `scripts/` / `agents/` / `assets/` / `eval-viewer/` / `references/` 五类目录，断言必然变红。
- **Fix:** 改写为「断言第 2 段**确实覆盖**这五类目录」（这正是排除法相对列举法的覆盖面证据）+ 豁免生效下零命中；并把第 2 段扫描面从 `FORBIDDEN_PATTERNS` 扩到 `FORBIDDEN_PATTERNS.concat(INSTALL_IMPERATIVES)`（**更严**，也是第 1 条豁免能够生效的前提）。
- **Verification:** 改写后用例全绿；反向验证 A/B 均能触发它变红。
- **已记入** `.planning/WINDOWS.md`（id 13）

**7. Task 3 的修改说明三项（①..⑩）与实测改动面差一项**

- **Issue:** deviation 1 的消歧改写不在计划的 ①..⑩ 清单里，但仍属对上游正文的改动。
- **Fix:** 作为**第 11 项**补入 `THIRD_PARTY_NOTICES.md`，并说明沿用同一判据（第 1 段零容忍 → 只能改文本）。同时把计划原本写作「⑧ 新增 check_env.mjs」的条目补上「该文件由 Realm 自研，以 MIT 许可证随 Realm Browser 分发」（否则「不适用本节归属义务」会被误读成「没有许可证」）。
- **Verification:** P10 断言组用例断言该段同时含「自研」与「MIT」。
- **Committed in:** `ca3aac8`

**8. 「上游正文里两处 Cowork 提及」按禁令保留（不作为改动）**

- **Issue:** 删除 `## Cowork-Specific Instructions` 后，正文里仍有 2 处 `Cowork` 提及（`## Running and evaluating test cases` 的 Step 4 headless 回退说明、结尾的 TodoList 提醒）与 1 处 `Claude.ai` 提及（`## Description Optimization` Step 1 的「Claude Code 或 Claude.ai 用户」）。计划明令「除六处受控改动外不得有其他偏离上游正文」，且验收只禁三处**标题**子串。
- **Fix:** 逐字保留，未删。理由：它们是环境条件性说明（Realm 不会走到「你在 Cowork 里」这一支），且贸然删除会违反禁令、让归属说明更难如实覆盖。
- **Verification:** 验收子串断言（`present_files` / `Claude.ai-specific` / `Cowork-Specific`）零命中；`Reference files` 清单不含被删三章的引用。
- **已记入** `.planning/WINDOWS.md`（id 16）

## Reverse-Verification Evidence（两条，原文照录）

计划 `<verification>` #7 要求两次反向验证都必须把**变红时的具体错误输出原文**逐字记入 SUMMARY。

### A. 给 skill-creator 的 `SKILL.md` 追加 `pip install pyyaml` → 第 1 段变红

操作：`printf '\n<!-- reverse-verification probe -->\nRun pip install pyyaml before validating a skill.\n' >> skills-builtin/skill-creator/SKILL.md`

结果：`node tests/test-builtin-skills-seeder.js` 退出 1，`# tests 65 / # pass 63 / # fail 2`。两条断言各自变红，原文：

```
    not ok 1 - 第 1 段（零容忍无豁免）：SKILL.md + LICENSE.txt 全量零命中
      error: |-
        零安装语义扫描命中（P1 门禁失守）：
          skills-builtin/skill-creator/SKILL.md:490 [pip 安装] /\bpip3?\s+install\b/ → Run pip install pyyaml before validating a skill.
```

```
    not ok 1 - P1-a-1：两个 SKILL.md + 两个 LICENSE.txt 对禁用模式零命中（第 1 段，无豁免）
      error: |-
        P1-a-1 失守（第 1 段零容忍、零豁免）：
          skills-builtin/skill-creator/SKILL.md:490 [pip 安装] /\bpip3?\s+install\b/ → Run pip install pyyaml before validating a skill.
```

还原后 `git diff --stat -- skills-builtin/skill-creator/SKILL.md` 为空（逐字节还原），65/65 全绿。**结论：新增技能确实进入了扫描面，不是只扫了 find-skills。**

### B. 临时移除 EXEMPTIONS 第 1 条（把正则改成永不匹配）→ `check_env.mjs` 对应行被报出

操作：把 `EXEMPTIONS[0].line` 由 `/Install the skill-creator Python dependencies yourself/` 改为 `/NEVER-MATCH-THIS-EXEMPTION-REVERSE-VERIFICATION/`。

结果：退出 1，`# tests 50 / # pass 48 / # fail 2`（该轮基线为 50 例）。原文：

```
    not ok 5 - 第 2 段（带行级豁免）扫描器就位：排除法覆盖第 1 段之外的全部内容
      error: |-
        第 2 段在豁免生效下应零命中
        + actual - expected

        + [
        +   {
        +     file: 'skills-builtin/skill-creator/scripts/check_env.mjs',
        +     line: 508,
        +     pattern: '\\b(install|add|update)\\s+(the\\s+)?skill\\b',
        +     text: '`Install the skill-creator Python dependencies yourself, in the Python environment reported above (confirm with the user first): ${names}.`,',
        +     why: '安装技能的祈使句'
        +   }
        + ]
        - []
```

还原后 65/65 全绿。**结论：豁免机制是承重的，不是死代码** —— 且它保护的是「告知**用户**自行安装」的反向语义声明，不是一条真正的安装路径。

## Issues Encountered

- **`parseReferenceFileList` 的章边界最初取到文件尾。** `## Reference files` 是 `SKILL.md` 的**最后一章**（其后只有一条 `---` 与收尾散文），只按「下一个 `## ` 标题」切边界会一路吞到 EOF，把收尾散文里的 `Cowork` 一并算进清单 → `Reference files 清单不得引用已删除三章` 用例假红。修法：边界取「下一个 `## ` 标题」与「下一条 `---` 分隔线」里更靠前的那个。该修正只影响测试的解析口径，不改文档。
- **`git status --short --cached` 是无效旗标**（正确写法是 `git diff --cached --name-only`），一次调用报错但未影响 `git add` 与提交结果。
- **提交到 `master`（受保护分支）**：与 47-01 / 47-02 相同 —— 本项目 `.planning/config.json` 的 `git.branching_strategy` 为 `"none"`，GSD 全程不使用阶段分支，且本次由 orchestrator 明确指派为「sequential executor agent on the main working tree」。未做任何 force / rewrite 操作。**如需改为分支工作流，属项目级配置变更，超出本计划范围。**

## Threat Flags

无**新增**威胁面。本计划引入的信任边界均已在 PLAN 的 `<threat_model>` 中登记（T-47-03-01..07 + SC），实现与该表逐条对齐：

- T-47-03-01（high，mitigate）：第 1 段零容忍扫描覆盖 `skills-builtin/**` 的**全部** `SKILL.md` 与 `LICENSE.txt`（两技能口径，反向验证 A 证明有效）；`check_env.mjs` 的「禁止安装」声明走第 2 段**行级豁免**、豁免理由写死在测试注释里、且承重性有自证用例 ✅
- T-47-03-02（medium，accept）：`REALM_SKILL_CREATOR_PYTHON` 只做形态校验、不校验路径合法性 —— 由用户自己设置，不是远程输入 ✅
- T-47-03-03（medium，accept，残余）：`check_env.mjs` 内部的 `spawnSync` 调 Python 不在 bash 策略视野内；用户确认的是第一条命令（`node …` ∈ `DANGEROUS_INTERPRETERS`）✅（诚实声明归 47-04）
- T-47-03-04（medium，mitigate）：下载 URL 一律用**固定 SHA**（非 HEAD）；逐文件字节与 §B-5 清单核对；测试断言两个 SHA 与文档逐字一致 ✅
- T-47-03-05（medium，mitigate）：两技能一律 `modified`；`SKILL.md` 文首带 §4(b) 声明并点名来源 SHA；测试断言文档中不出现把已修改说成未修改的措辞且五要素齐备 ✅
- T-47-03-06（low，mitigate）：未知 `--capability` / `--package` / `--command` 返回 `unknown_requirement` 且非零退出（ASVS V5）✅
- T-47-03-07（low，mitigate）：三章删除后模型不会尝试调用不存在的工具；改动记入归属说明 ✅
- T-47-03-SC（high，mitigate）：**零新增依赖** —— `package.json` 原样不动；`skills-builtin/**` 是纯文本静态资源，不经任何安装器 ✅

## Known Stubs

无。本计划落地的代码路径无硬编码空值、无 `TODO` / `FIXME`、无未接线数据源。

`check_env.mjs` 的 `--json` 旗标是**显式默认值声明**（JSON 本就是唯一输出格式），非未实现的参数 —— 注释里写明了它的语义。

三处**前瞻引用**（非 stub，均按计划显式设计）：

1. `SKILL.md` 的 `## Environment Preflight` 与两处评测前置句都指向 `node scripts/check_env.mjs` —— 该文件由本计划 Task 2 落地，**已存在**。
2. `THIRD_PARTY_NOTICES.md` 的升级检查清单第 3 步指向 P10 断言组 —— 已在 Task 3 落地。
3. P10-6（打包后归属仍可读）与打包态 asar 路径分支：**未自动化覆盖**，已在测试源码里显式标注归 47-04 / `make install-nightly` 人工实跑。

## TDD Gate Compliance

本计划 4 个任务均非 `tdd="true"`（Task 1 `type="tracer"`、Task 2/3/4 `type="auto"`），无 RED/GREEN/REFACTOR 门禁要求。

## Plan Verification 结果（9 项全过）

| # | 判据 | 结果 |
|---|------|------|
| 1 | `node tests/test-builtin-skills-seeder.js` 退出 0 | ✅ 65/65 pass、0 fail |
| 2 | `node tests/test-ai-skills.js` 退出 0 | ✅ 64/64 |
| 3 | `node tests/test-agent-workspace.js` 退出 0 | ✅ 21/21 |
| 4 | `node --check check_env.mjs` + 实跑输出可解析 JSON | ✅ |
| 5 | 基线守卫 + 零 diff：`BASE=f28cc2f…`（非空）；`git diff "$BASE"..HEAD --stat -- builtin-skills-seeder.js ai-bash-policy.js ai-manager.js package.json` 为空 | ✅ |
| 6 | `package.json` 无 `pyyaml` / `anthropic` 依赖 | ✅ |
| 7 | 反向验证两条均实跑并记录原文（见「Reverse-Verification Evidence」） | ✅ |
| 8 | `find skills-builtin -type f \| wc -l` = 21；`## Reference files` 清单逐项存在性核对通过 | ✅ |
| 9 | 正文 CJK 自查（一次性命令）输出 `body has no CJK OK` | ✅ |
| + | `node --test tests/test-ai-bash-policy.js` | ✅ 70/70 |

### 口径说明（供 verifier 复核 `actuals`）

`actuals.tokens = 35132` 是**按计划 `estimate` 的同一尺度**计算的：`chars/4` 只统计**真正进入读取/写入预算的 4 个文件**（`SKILL.md` 32,672 + `check_env.mjs` 19,947 + `THIRD_PARTY_NOTICES.md` 8,967 + `tests/test-builtin-skills-seeder.js` 78,943 = 140,529 chars）。计划 `estimate` 的注释明确把 17 个「只 `wc -c` 核对、从不 Read 打开」的上游快照**排除在读取预算之外**，故不把它们计入 `actuals` 才能与 `56000` 可比。若按 `git diff --numstat` 的全部 21 个路径统计则为 332,365 chars ≈ 83,091 tokens，两者尺度不同，**不要混用**。实测 35,132 低于估算 56,000 —— 差额主要来自 `SKILL.md` 只做了六处点状编辑而非整篇重写。

## Next Phase Readiness

- **47-04（打包实跑）需收口的三条**（本计划均已显式标注或登记）：
  1. `make install-nightly` 后确认 `Contents/Resources/app.asar.unpacked/skills-builtin/{find-skills,skill-creator}/SKILL.md` 存在且 `managed-skills/` 下出现两个技能目录（SEED-05 的打包态分支）。
  2. **P10-6**：确认 `THIRD_PARTY_NOTICES.md` 在 asar 清单内；若采纳 `build.files` allowlist，必须把它列入（否则 P10 变纸面合规）。
  3. 不可跳过的前置 checkpoint：先 `pgrep -fl Realm` 确认无用户实例（`make install` 第一步会 `rm -rf /Applications/Realm.app`）。
- **Phase 48/49 可消费的形状**：`manage_skill` 与 `/skill:name` 可复用 `check_env.mjs` 的 capability / 失败码 / `installGuidance` 契约与 `skills-builtin/skill-creator/` 的目录形状（整目录复制、`LICENSE.txt` 与嵌套 `scripts/` 随之落盘）。
- **Phase 50（设置页技能管理区）**：`THIRD_PARTY_NOTICES.md` 的逐技能五要素可直接渲染成归属列表；`check_env.mjs` 的 `capabilities.catalog` 可作为「该技能能力清单」的数据源。
- **待观察的技术债（已入 WINDOWS.md，6 条属本计划）**：SKILL.md:404 的消歧改写、豁免条目口径、第 2 段断言改写、字节口径调和、`--help`/`attempted` 增补、两处 Cowork 残余提及。其中只有最后一条是「可能想改」的，其余是已收敛的调和记录。

---

*Phase: 47-bash*
*Completed: 2026-09-11*

## Self-Check: PASSED

- 全部新建文件存在：`skills-builtin/skill-creator/SKILL.md`、`…/LICENSE.txt`、`…/scripts/check_env.mjs`、`THIRD_PARTY_NOTICES.md`、`.planning/phases/47-bash/47-03-SUMMARY.md`
- 全部提交在 git 历史中：`a90e549` / `b69f57d` / `ca3aac8` / `90e090b`（4 个任务提交）+ `0456a7a`（本计划元数据提交）
- `node tests/test-builtin-skills-seeder.js` 65/65 pass、0 fail；`test-ai-skills` 64/64、`test-agent-workspace` 21/21、`test-ai-bash-policy` 70/70 全绿
- `plan_head_before` = `f28cc2f93cfc71d6d6cc3c15a057c444d8b151ff`（来自 .git/gsd-plan-head-before-47-03 台账），`commits` = 5 为实测值（`git rev-list --count`）；frontmatter 里的 `commits: 4` 是**四个任务**的提交数，元数据提交在其后产生，两者口径不同
- `find skills-builtin -type f | wc -l` = 21；`git diff BASE..HEAD` 对 `builtin-skills-seeder.js` / `ai-bash-policy.js` / `ai-manager.js` / `package.json` 全为空

---
phase: 47-bash
plan: 2
subsystem: ai-bash-policy
tags: [bash-policy, install-tier, package-managers, whitelist-bypass, gate-assertions, reverse-validation, residual-risk, source-scan]

# Dependency graph
requires:
  - phase: 47-bash
    plan: 1
    provides: 「源码扫描型断言 + 反向验证」的验证手法与诊断形状先例（本计划不消费 47-01 的播种模块；47-01 对 ai-bash-policy.js 零改动，本计划是其 install 档落点）
provides:
  - ai-bash-policy.js 的 PACKAGE_MANAGER_INSTALL_PATTERNS（13 族）+ matchInstall + stripLeadingQuotes（均入导出面）
  - evaluateBashCommand 的 install 短路（先于 matchesWhitelist）与 installNames 完整返回形状（所有分支）
  - ai-manager.js 的 confirm 三分支（install → riskLevel high + 专属 title 与文案）
  - P1-b-1..b-5 逐信号可独立报告的断言 + 表驱动的 D-13 家族表 / D-16 只读反例表
  - 47-04 文档同步的契约事实（reason 'install'、title 文案、白名单对安装档失效）
affects: [47-04, 48, 49, 50]

# Actuals (#2632)
actuals:
  tokens: 8583
  tasks: 3
  commits: 3
  plan_head_before: cc16a167cb3923025092799d14367ed68a60e412

tech-stack:
  added: []          # 零新增依赖（package.json 未改动）
  patterns:
    - "平行模式表：install 表与危险表同形状（{ pattern, name }）、同 normalize 口径、同 string|null 返回，但 reason 分离（语义不塌陷）"
    - "短路顺序即安全策略：danger → install → whitelist → default，靠「返回语句先于调用」的源码断言钉死，而非靠注释"
    - "旗标容忍片段以 `-` 起头保证不吞子命令：每消费一组 token 都必须始于 `-`，子命令位置因此不可被跳过"
    - "表内顺序即优先级：更具体的复合家族（python -m pip / uv pip install）必须排在通用家族（pip）之前"
    - "残余风险三段论证（频率 · 难度 · 后果）+ 断言佐证严重性，而不是只列现象"
    - "反向验证证明门禁断言非空转：删条目 → 变红（13 例，含门禁核心与影子断言）→ 还原 → 70/70 全绿"

key-files:
  modified:
    - ai-bash-policy.js
    - ai-manager.js
    - tests/test-ai-bash-policy.js

key-decisions:
  - "D-47-02-a（路线 A）：allow / empty / default 分支同样返回 installNames: []（完整形状），代价是同步改 2 条既有 deepStrictEqual —— 换取 Phase 48/49 消费方拿到形状一致的对象"
  - "D-47-02-b（保持三档）：level 取值集不变（allow / confirm），install 是第三档内的 reason 细分；第三档表述为「两个互不包含的触发源」（危险命令表 / 包管理器安装表）"
  - "install 短路先于 matchesWhitelist（D-14）：白名单不可越过安装档；danger 仍优先于 install（sudo npm i x → danger）"
  - "curl 管道 sh 不收录进安装表：管道右侧 sh 已属 DANGEROUS_INTERPRETERS，danger 先返回 → 收录即永不触发的死模式"
  - "旗标容忍片段扩为 (?:\s+-\\S+(?:\s+(?!-)\\S+)?)*（取值旗标覆盖）：E-1 的逐字表实测漏检 npm --prefix ./x i y 与 pnpm --filter a add b，而计划两处 acceptance 均要求二者命中"
  - "表内把 python -m pip / uv 两族提到 pip 之前：否则 uv pip install x 被 pip 条目先命中、确认卡片标出错误家族名（实测 2 条断言失败）"
  - "python 族的 evaluateReason 记为 danger：python/python3 属 DANGEROUS_INTERPRETERS，按 D-14 的 danger 优先，install 档不在此族产生 reason"
  - "反引号 / 子 shell 形态按实测行为钉死（会命中 install 档），不按计划文本的「漏检」假设写断言；「漏检 ≠ 免确认」的机械证据改由真正的漏检形态（NPM=npm $NPM i x）承载"

patterns-established:
  - "只读反例表驱动：READONLY_NEGATIVES 按 family 分组，未来新增只读子命令只需加一行，且同一条命令同时断言「不进 install 档」与「加白名单后回到 allow」"
  - "信号号进用例名：P1-b-1..b-4 直接写在 test 名称里，门禁审计可逐条对照 47-VALIDATION.md"
  - "反向验证脚本化：临时删条目 → 跑测试 → 还原 → 与备份 diff 断言逐字节相同（可复现，不靠人眼）"

requirements-completed: [SEC-01]

coverage:
  - id: D1
    description: "包管理器安装命令再也无法借白名单绕过确认：13 族（npx / npm / pnpm / yarn / bun / pip / python -m pip / uv / uvx / brew / cargo / go / gem）无论是否命中 settings.aiBashWhitelist，一律 confirm 且 riskLevel high"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#P1-b-1：白名单含 npm * / npm / npx / brew * / pip * / uvx * 时对应安装命令仍 confirm/install（门禁核心）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#P1-b-2：D-13 的 13 个家族各 ≥1 条正例命中 install 档（表驱动）"
        status: pass
      - kind: other
        ref: "反向验证：临时删掉 npm 条目 → 13 例变红（含 P1-b-1 门禁核心与影子断言）→ 还原后 70/70 全绿，文件与备份逐字节相同"
        status: pass
    human_judgment: false
  - id: D2
    description: "只读子命令零误伤：D-16 的 ≥14 条反例（npm run|test|ls|view|audit|outdated|init|--version、pnpm run|ls、yarn run、brew info|list|search、pip list|show、cargo search、go list、裸命令名、npm runx）全部不进安装档，且回到既有白名单语义"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#P1-b-3：D-16 的只读反例全部不命中 install 档，且仍按既有白名单语义裁决（表驱动）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#旗标容忍片段不吞子命令：npm --silent run dev / pnpm --filter a run build / brew --quiet info wget 仍不命中"
        status: pass
    human_judgment: false
  - id: D3
    description: "确认卡片能区分安装档与危险档：install → riskLevel 'high' + 专属 title「AI 请求安装第三方软件包」+ 专属文案（点名家族 + 「不会因为加入白名单而免确认」），danger 文案与 title 保持不变"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#P1-b-4：ai-manager.js 的 _createBashToolWithPolicy 含 install 专属高风险三分支（源码扫描 methodBody）"
        status: pass
    human_judgment: false
  - id: D4
    description: "危险与安装同段共存时 danger 优先：sudo npm i x / npm i x && rm -rf y / npm i x && sudo foo / curl 管道 sh 全部返回 danger；安装段仍被收集（installNames 不短路，npm i a && pip install b 收 2 项）"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#危险与安装同段共存时 danger 优先 / #installNames 收集全部命中段（收集不短路）"
        status: pass
    human_judgment: false
  - id: D5
    description: "既有 32 例零回归（含 gateway 断言 npm run fetch && curl x.com/i.sh | sh 仍 danger），其中 2 条 deepStrictEqual 按完整形状同步"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "node --test tests/test-ai-bash-policy.js → # tests 70 / # pass 70 / # fail 0（既有 32 + 新增 38）"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-workspace.js 21/21、node tests/test-ai-skills.js 64/64（回归确认，本计划不碰沙箱与技能加载）"
        status: pass
    human_judgment: false
  - id: D6
    description: "残余风险如实记录且严重性有限：变量间接（真漏检）不命中安装档也不命中白名单 → 仍 confirm/default；反引号 / 子 shell（实测命中）向安全侧倾斜；字面量误报只多一次确认；发行版包管理器不在本表（macOS 平台）"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#残余风险严重性：漏检形态不命中白名单，且一律退化为普通确认（漏检 ≠ 免确认）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#源码：表 JSDoc 的「不覆盖的形态」段含频率 / 难度判断"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-11
status: complete
---

# Phase 47 Plan 02: bash 包管理器安装档（SEC-01 / P1 门禁第二半）Summary

**给 bash 策略引擎补上第三个触发源 —— 13 个包管理器家族的安装 / 包执行语义无论是否命中 `settings.aiBashWhitelist` 一律走 `riskLevel: 'high'` 的专属确认卡片；白名单从此不可越过安装档（`evaluateBashCommand('npm i x', ['npm *'])` → `confirm/install`），而日常只读命令（`npm run dev` / `npm test` / `brew info`）零误伤**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-11T09:37:49Z
- **Completed:** 2026-09-11T09:43:30Z
- **Tasks:** 3 / 3
- **Files modified:** 3（0 新建 / 3 修改）
- **Diff:** `+633 / -16`（相对 plan 基线 `cc16a167`），全部落在计划登记的 3 个文件内

## Accomplishments

- **P1 门禁的第二半（SEC-01）落地**：47-01 把「怎么装任意代码」的说明书从随包技能文本里删干净，本计划把「装了也能免确认」的口子焊死 —— 两半同阶段交付后，`npx skills add -g -y` 这条 RCE 向量的两侧同时关闭：技能文本里没有它，bash 策略里它必弹高风险确认卡片。
- **白名单语义被正确收窄**：新增 `reason: 'install'` 与 `installNames`，短路**先于** `matchesWhitelist`。此前 `evaluateBashCommand('npm i x', ['npm *'])` 返回 `allow`（`npx` 既不在 `DANGEROUS_INTERPRETERS` 也不匹配任何 `DANGEROUS_PATTERNS`，是真实缺口）；现在返回 `confirm/install`。
- **13 族全覆盖 + 只读零误伤**：`npx` / `npm`(i·install·ci·exec·add) / `pnpm`(add·install·i·dlx·exec) / `yarn`(add·install·dlx·exec) / `bun`(add·install·x·i) / `pip`·`pip3` / `python[-m pip]` / `uv`(pip install·add·tool install·sync) / `uvx` / `brew`(install·upgrade·reinstall) / `cargo`·`go`·`gem` install 全部命中；≥14 条只读反例（表驱动）全部不命中 —— 后者是防「误伤驱动用户把 `npm` 整族加白」的机械护栏（D-16）。
- **三档框架保持不变，第三档获得第二个触发源**：`level` 仍是 `'allow' | 'confirm'`，`install` 是档内细分；确认卡片因此能区分「本机破坏」（`AI 请求执行高危 Bash 命令`）与「网络取第三方代码」（`AI 请求安装第三方软件包`），且两者同为 `riskLevel: 'high'`。
- **门禁断言被证明不是空转**：临时删掉 `npm` 条目 → 13 例变红（含门禁核心与影子断言）→ 还原后 70/70 全绿、文件与备份逐字节相同。
- **残余风险按「频率 · 难度 · 后果」三段写进代码注释**（不是只写在计划里），并配两条严重性佐证断言：畸形前缀不命中白名单；真漏检形态（`NPM=npm $NPM i x`）仍 `level === 'confirm'` —— 「本表漏判永远只会退化成普通确认卡片」。

## Task Commits

Each task was committed atomically:

1. **Task 1: install 档端到端纵切（tracer）** - `3e509ce` (feat)
2. **Task 2: install 档逃逸形态与边界收敛** - `bd3b092` (test)
3. **Task 3: P1-b 门禁信号断言收敛** - `f96a651` (test)

**Plan metadata:** 见本 plan 收尾的 docs 提交（SUMMARY / STATE / ROADMAP）

_注：Task 1 是 `type="tracer"`；auto 模式（`workflow.auto_advance: true`）下 tracer 门禁按 `<verify>` 端到端复跑通过后自动展开 —— `⚡ Tracer verified end-to-end — expanding`（复跑 `node --test tests/test-ai-bash-policy.js` → 59/59 pass / `# fail 0`）。_

## Files Created/Modified

- `ai-bash-policy.js`（修改，+145 / -16 行区间）-
  - 文件头 JSDoc：三档说明补第三档的**两个互不包含的触发源**（危险命令表 → `danger`；包管理器安装表 → `install`），并显式写明「档位数量仍是三档」；既有「诚实边界」段落一字未动。
  - 新增 `PACKAGE_MANAGER_INSTALL_PATTERNS`（13 条 `{ pattern, name }`，与 `DANGEROUS_PATTERNS` 同形状）+ 七点 JSDoc（① 与危险表平行但语义分离；② `curl … | sh` 为何不收录；③ 命令名 + 子命令粒度与旗标容忍片段的边界证明；④ `npm ci` 的 `postinstall` 理由；⑤ 维护约定；⑥ 表内顺序即优先级；⑦ 不覆盖的形态四类，各带频率 · 难度 · 后果）。
  - 新增 `stripLeadingQuotes()`（含「用途 + 边界 + 不要提到 normalizeSegment 层」的注释）与 `matchInstall()`（照 `matchDangerous` 的模子：同 normalize 口径、同 `string|null` 返回、同 for-of 早返回）。
  - `evaluateBashCommand`：同循环内**收集不短路**的 `dangerNames` + `installNames`，返回顺序 danger → install → whitelist → default；所有分支（含 `empty` / `allow` / `default`）都带 `installNames`。
  - `module.exports` 追加 `PACKAGE_MANAGER_INSTALL_PATTERNS` 与 `matchInstall`。
- `ai-manager.js`（修改，+16 / -7 行，全部落在 `_createBashToolWithPolicy` 方法体内）- 工具 description 第 3 句改为同时点名两类（危险命令 + 包管理器安装命令，含 `npx/npm i/pip install/brew install` 举例）；`const isInstall = verdict.reason === 'install';`；`dangerHint` 三分支（install 文案点名家族并说明「不会因为加入白名单而免确认」）；`title` 三分支（install → `'AI 请求安装第三方软件包'`）；`riskLevel: (isDanger || isInstall) ? 'high' : 'medium'`。**取消链路与执行 / 终态链路零改动**，`timeoutMs: 120000` 保持。
- `tests/test-ai-bash-policy.js`（修改，+488 行）- 新增 `readSource` / `functionBody` / `methodBody` / `installTableLiteral` / `installTableDoc` 五个源码扫描辅助（照 `tests/test-ai-skills.js:48-73`）；2 条既有 `deepStrictEqual` 同步为 `{ level: 'allow', dangerNames: [], installNames: [] }`；新增 4 个 describe（`matchInstall 包管理器安装判定` / `evaluateBashCommand install 档短路` / `install 档逃逸形态与边界` / `P1 门禁信号`）与两张驱动表（`INSTALL_FAMILIES` 13 族 / `READONLY_NEGATIVES` 8 组 27 条）。测试总数 32 → 70。

## Decisions Made

- **D-47-02-a（路线 A：完整形状）**：`allow` / `empty` / `default` 分支同样返回 `installNames: []`，故 `tests/test-ai-bash-policy.js` 的两条既有 `deepStrictEqual` 必须同步（实测其余 30 条用逐字段 `strictEqual` 或 `includes`，新增字段不触发）。换来的是「所有分支形状一致」的显式契约，Phase 48/49 消费方无需做存在性判断。
- **D-47-02-b（保持「三档」表述）**：`level` 只有 `allow` / `confirm` 两个取值，`install` 是档内细分，因此**确实是三档**；第三档描述为「危险命令表（本机破坏）与包管理器安装表（网络取第三方代码）两个互不包含的触发源」。不改称四档（会牵连 `ai-agent-workspace.md §四` 的标题与 Phase 46 历史文档，语义收益为零）。**47-04 按此落地文档。**
- **短路顺序即安全策略**：`danger` 先返回（`sudo npm i x` → `danger`），`install` 先于 `matchesWhitelist`。两者都由**源码断言**（`indexOf` 行序）钉死，而不是靠注释约定。
- **`curl … | sh` 刻意不收录**：管道右侧 `sh` / `bash` 已属 `DANGEROUS_INTERPRETERS`，`danger` 先返回 —— 收录即永不触发的死模式。JSDoc 第 ② 点明写「不要补上这个遗漏」，并有源码断言证明表内无 `curl` / `wget` / `aria2c` 条目。
- **旗标容忍片段取 `(?:\s+-\S+(?:\s+(?!-)\S+)?)*`**：每消费一组 token 都必须以 `-` 起头（一组 = 旗标 + 至多一个取值），因此**不会吞掉子命令**。实测：34 条只读反例零新增误伤，2 条原本漏检的取值旗标形态转为命中。
- **`installNames` 收集不短路**：`npm i a && pip install b` 同时收两项 —— 确认卡片能一次列出全部安装段，用户不必确认两轮。

## Deviations from Plan

### Auto-fixed Issues

无。本计划的实现路径与计划一致，没有触发 Rule 1/2/3 的现场修复（唯一超出计划文本的部分见下方 Plan-text Reconciliations，均为「计划内部两处口径相互矛盾、按更具体的门禁口径调和」）。

### Plan-text Reconciliations（按更具体的 acceptance 口径调和，全部记入 `WINDOWS.md`）

**1. 旗标容忍片段必须扩为可覆盖「取值旗标」——E-1 的逐字表实测漏检两个计划要求必命中的形态**

- **矛盾点**：Task 1 step 1 要求「逐字照抄 47-RESEARCH.md §E-1 的 13 条，不要重新设计正则」，而 §E-1 自己的实测结论把 `npm --prefix /tmp i x` 列为**已知缺口**；但 Task 1 step 8 的必命中清单与 Task 2 的 acceptance 又都要求 `npm --prefix ./x i y` 与 `pnpm --filter a add b` 命中（Task 2 step 1 明写「确认二者均能命中……不要改成会误吞子命令的宽泛写法」）。
- **处置**：把旗标片段 `(?:\s+-\S+)*` 扩为 `(?:\s+-\S+(?:\s+(?!-)\S+)?)*`（每消费一组 token 仍以 `-` 起头，故不吞子命令），并实测验证：**扩展前 2 条必命中形态漏检（`npm --prefix ./x i y`、`pnpm --filter a add b`），扩展后 0 漏检且 34 条只读反例零新增误伤**。表条目数、模式语义与家族集合不变。
- **验证**：`tests/test-ai-bash-policy.js#旗标前置形态命中（-g / --global / --prefix ./x / --prefix=./x / --filter a / --quiet）` + `#旗标容忍片段不吞子命令`（新增反例）。
- **已记入** `.planning/WINDOWS.md`（kind: deviation / phase 47）。

**2. 表内顺序需把复合家族排在通用家族之前——否则确认卡片标出错误的家族名**

- **问题**：E-1 的逐字表把 `pip3? install` 排在 `python -m pip install` / `uv pip install` **之前**，`matchInstall` 首次命中即返回，导致 `python3 -m pip install x` 与 `uv pip install x` 被报成「pip 安装包」（实测 2 条断言失败）。卡片文案是用户唯一的决策依据（「卡片所见即所确认」），家族名错标属 T-47-02-05 的同类问题。
- **处置**：仅调整数组内两条的相对位置（`python -m pip` → `uv` → `uvx` → `pip` 依次靠前），13 条模式文本一字未改；并在 JSDoc 第 ⑥ 点写明「表内顺序即优先级，复合家族必须排在通用家族之前」。
- **验证**：`#pip / pip3 / python -m pip 命中` 与 `#uv / uvx 命中` 断言逐条按正确家族名通过。
- **已记入** `.planning/WINDOWS.md`（kind: deviation / phase 47）。

**3. Task 2 acceptance 假设「命令替换形态不被 install 检测」——实测相反（向安全侧倾斜），断言按实际行为钉死**

- **矛盾点**：Task 2 step 4 与 acceptance 要求断言 `evaluateBashCommand('`npm i x`', ['npm *']).reason !== 'install'`；但 `\bnpm\b` 在反引号 / `$( )` 内仍是词边界，**实测返回 `install`**（即被检测到，属于比计划假设更安全的结果）。计划另一条断言（`matchesWhitelist('`npm i x`', ['npm *']) === false`）实测成立。
- **处置**：断言按**实际行为**写（反引号与 `$( )` 形态 `level === 'confirm'` 且 `reason === 'install'`），把「漏检 ≠ 免确认」这一结论的机械证据改由**真正的漏检形态**承载 —— `NPM=npm $NPM i x`（`matchInstall === null`、`matchesWhitelist === false`、`level === 'confirm'` 且 `reason !== 'install'`）。JSDoc 第 ⑦ 点按实测重写了这一段（原文说「命令替换不被检测」不成立）。
- **验证**：`#残余风险严重性：漏检形态不命中白名单，且一律退化为普通确认（漏检 ≠ 免确认）`。
- **已记入** `.planning/WINDOWS.md`（kind: deviation / phase 47）。

**4. `python -m pip` 族的裁决结果是 `danger` 而非 `install`**

- **矛盾点**：Task 1 acceptance「13 个家族各 ≥1 条正例命中 `matchInstall`，且 `evaluateBashCommand` 对它们返回 `reason === 'install'`」与 D-14 的「danger 优先于 install」在 `python` / `python3` 两族上互相冲突（二者已在 `DANGEROUS_INTERPRETERS` 中，danger 先返回）。
- **处置**：以 D-14 的 danger 优先为准 —— 该族**仍必须命中 `matchInstall`**（对 `python3.11 -m pip install x` 这类解释器名不在危险集合内的形态照样生效），断言以表内 `evaluateReason: 'danger'` 显式标注并附注释说明；裁决仍是 `level === 'confirm'`，绝不因 danger 而放宽。
- **验证**：`#P1-b-2：D-13 的 13 个家族各 ≥1 条正例命中 install 档（表驱动）`（13 族逐族通过，python 行按 `danger` 断言）。
- **已记入** `.planning/WINDOWS.md`（kind: deviation / phase 47）。

## Issues Encountered

- **`ai-manager.js` 中 `_createBashToolWithPolicy` 上方的方法 JSDoc（约 `:5616-5629`）仍写着旧的二分描述**（「confirm：弹确认卡片（危险命令 riskLevel=high，普通命令 medium）；白名单对危险段无效」），未提及 install 档与 `riskLevel: high`。
  - **成因（刻意取舍）**：`<verification>` #7 要求 `git diff BASE..HEAD -- ai-manager.js` **只**落在 `_createBashToolWithPolicy` 方法体内；该方法体外的 JSDoc 不在计划 `<artifacts>` 列举的改动范围内。改它会直接让该门禁判据变红。
  - **影响**：仅内部注释信息不完整，无行为影响；工具 description（模型看到的唯一策略说明）已同步（由源码扫描断言锁定），用户可见文档归 47-04。
  - **处置**：不改动，作为显式记录的遗留项（见下「Next Phase Readiness」）。此项**未**写入 `WINDOWS.md` —— 它是计划显式划定范围的直接结果，不是意外缺陷。

## Threat Flags

无新增威胁面。本计划引入的全部信任边界（模型 → `evaluateBashCommand`、`settings.aiBashWhitelist` → 免确认判定、`verdict` → 确认卡片、bash 子进程 → 宿主机）均已在 PLAN 的 `<threat_model>` 中登记，实现与该表逐条对齐：

- T-47-02-01（high，mitigate）：install 短路**先于** `matchesWhitelist`；门禁核心断言（白名单含 `npm *` / `npx` / `brew *` 时仍 confirm/install）+ 反向验证证明非空转 ✅
- T-47-02-02（high，mitigate）：`npm ci` 计入安装档，理由写在表 JSDoc（「不取新代码 ≠ 不执行任意代码」，执行所有依赖的 `postinstall`），源码断言锁定 ✅
- T-47-02-03（high，mitigate）：命令名 + 子命令粒度；27 条只读反例表驱动断言；实测误伤 0 ✅
- T-47-02-04（medium，accept）：残余形态（变量间接真漏检 / 命令替换实测命中 / 字面量误报）按「频率 · 难度 · 后果」三段写进 JSDoc，并有两类严重性佐证断言（不命中白名单、仍 confirm）；发行版包管理器不在本表已显式记录 ✅
- T-47-02-05（low，mitigate）：install 专属 title（`AI 请求安装第三方软件包`）与专属 `dangerHint`，danger 分支 title 未变，均有源码扫描断言 ✅
- T-47-02-06（low，mitigate）：`reason` 的 `'install'` 与 `'danger'` 分离，由系列 `strictEqual(verdict.reason, ...)` 断言锁定；`npx` / `uvx` 未进 `DANGEROUS_INTERPRETERS` ✅
- T-47-02-SC（medium，mitigate）：**零新增依赖**（`package.json` 零 diff），全程未执行任何包安装命令 ✅

## Known Stubs

无。本计划落地的代码路径无硬编码空值、无 `TODO` / `FIXME`、无未接线数据源、无 `t.skip` / `test.todo`。

## TDD Gate Compliance

本计划 3 个任务均非 `tdd="true"`（Task 1 `type="tracer"`、Task 2/3 `type="auto"`），无 RED/GREEN/REFACTOR 门禁要求。

## Plan Verification 结果（8 项全过）

| # | 判据 | 结果 |
|---|------|------|
| 1 | `node --test tests/test-ai-bash-policy.js 2>&1 \| grep -E "^# (tests\|pass\|fail)"` → `# fail 0` 且 `# tests ≥62` | ✅ `# tests 70 / # pass 70 / # fail 0`（既有 32 + 新增 38） |
| 2 | `node tests/test-agent-workspace.js` 退出 0（不碰沙箱，回归确认） | ✅ 退出 0，21/21 pass |
| 3 | `node tests/test-ai-skills.js` 退出 0（不碰技能加载，回归确认） | ✅ 退出 0，64/64 pass |
| 4 | 源码 gate（按函数体行号区间比对）：`git diff -U0 cc16a167..HEAD -- ai-bash-policy.js` 的变更区间与四个既有函数体在基线中的行号区间零交集，且变更只落在六处 | ✅ 基线非空（`cc16a167…`，台账 `.git/gsd-plan-head-before-47-02`）；基线四函数区间 `normalizeSegment[20,22]` / `splitCommandPipeline[36,98]` / `extractCommandName[106,114]` / `matchesWhitelist[127,150]` 与变更区间 `[6,14][188,256][275,306][310,318][321,321][323,323][330,330][333,333][335,338][341,344][348,348][350,350][384,385]` **零相交**；每条变更区间均落在六处之内 |
| 5 | `node --check ai-bash-policy.js && node --check ai-manager.js` 全过 | ✅ 另加 `node --check tests/test-ai-bash-policy.js` 也过 |
| 6 | 反向验证记录：删 `npm` 条目 → 门禁核心断言变红；还原 → 转绿 | ✅ 红：exit 1 / `# fail 13`（含 `P1-b-1`、`门禁核心`、影子断言）；绿：`# pass 70 / # fail 0`；还原后与备份 `diff` 为空（逐字节相同） |
| 7 | 源码 gate：`git diff cc16a167..HEAD -- ai-manager.js` 只落在 `_createBashToolWithPolicy` 方法体内 | ✅ 方法体区间 `[5630,5699]`；变更区间 `[5637][5652][5656-5659][5663-5667][5669]` 全部在内 |
| 8 | 消费点复核：`grep -rn "evaluateBashCommand" --exclude-dir=node_modules --exclude-dir=.planning .` 的生产代码命中数 == 1 | ✅ 生产代码唯一调用点 `ai-manager.js:5647`；其余命中为 `tests/test-ai-bash-policy.js`（25 处）、`ai-bash-policy.js`（定义与注释 6 处）、`AGENTS.md:261` 与 `docs/plan/ai-file-bash-tools-integration.md:43,65`（文档描述返回值形状，非代码消费）、`dist/mac-arm64/Realm Nightly.app/.../app.asar`（打包产物二进制，非源码） |

**`grep -rn "evaluateBashCommand"` 完整命中清单（生产代码命中数 = 1）**

```
./ai-manager.js:5647        ← 生产代码唯一调用点（verdict 的 level / reason / dangerNames / installNames 使用集中在其后紧邻数行）
./ai-bash-policy.js:4,217   ← 文件头 JSDoc 与表维护约定（注释）
./ai-bash-policy.js:309     ← 函数定义
./ai-bash-policy.js:368     ← module.exports
./tests/test-ai-bash-policy.js  ← 25 处（测试）
./AGENTS.md:261             ← 文档（47-04 的同步对象）
./docs/plan/ai-file-bash-tools-integration.md:43,65  ← 历史计划文档
./dist/mac-arm64/Realm Nightly.app/Contents/Resources/app.asar  ← 打包产物（非源码）
```

**结论**：计划外的生产消费点为零（与 47-REVIEWS.md 中评审侧实测一致），opencode 判 HIGH 的「日志 / 遥测等未审查消费点」分歧不成立；`installNames` / `reason === 'install'` 的新增不破坏任何既有消费方。

### 表完整性（Task 1 / Task 3 的独立断言）

| 判据 | 结果 |
|------|------|
| `PACKAGE_MANAGER_INSTALL_PATTERNS.length >= 13` | ✅ 13 |
| 每条 `name` 为非空字符串 | ✅ 13/13 |
| 每条 `pattern` 可被 `new RegExp(pattern.source)` 成功构造 | ✅ 13/13 |
| 导出面：`PACKAGE_MANAGER_INSTALL_PATTERNS` 与 `matchInstall` 均存在 | ✅（47-04 文档与下游阶段的契约） |
| 表内无 `curl` / `wget` / `aria2c` 条目（download-and-pipe 由 danger 承接） | ✅ 源码断言 |

## Next Phase Readiness

- **47-04 需同步的契约事实（本计划不改文档，只登记）**：
  1. `docs/product/ai-agent-workspace.md §四`（原标题「bash：三档权限」）与 §五 白名单使用建议：`npm` 不再能靠白名单免确认；第三档有两个互不包含的触发源（危险命令表 / 包管理器安装表）。
  2. `docs/product/ai-skills.md` 新增「bash 包管理器安装档」章节：13 族清单、白名单不可越过、`riskLevel: 'high'` 与专属 title、残余风险（变量间接真漏检但也不命中白名单）。
  3. `AGENTS.md` 的「Bash 三档权限」段落（`:261`）需补 install 档与 `PACKAGE_MANAGER_INSTALL_PATTERNS`。
- **Phase 48 / 49 的数据形状契约已就位**：`evaluateBashCommand` 的所有分支都返回 `{ level, reason?, dangerNames: [], installNames: [] }`（完整形状，D-47-02-a）；`installNames` 收集不短路，可直接用于卡片多段展示与审计日志。
- **遗留（显式记录，非计划外缺陷）**：`ai-manager.js` 中 `_createBashToolWithPolicy` 上方的方法 JSDoc 仍为旧的二分描述，未提及 install 档 —— 为满足 `<verification>` #7「变更只落在方法体内」而刻意不动。下次因其他原因修改该方法时可顺手补齐。

---

*Phase: 47-bash*
*Completed: 2026-09-11*

## Self-Check: PASSED

- 计划登记的 3 个文件均存在且已修改；3 个任务提交（`3e509ce` / `bd3b092` / `f96a651`）均在 git 历史中
- `node --test tests/test-ai-bash-policy.js` → `# tests 70 / # pass 70 / # fail 0`；`node tests/test-agent-workspace.js` 21/21；`node tests/test-ai-skills.js` 64/64
- `plan_head_before` = `cc16a167cb3923025092799d14367ed68a60e412`（来自 `.git/gsd-plan-head-before-47-02` 台账），`commits` = 3 为实测值（`git rev-list --count cc16a167..HEAD`）
- 反向验证、行号区间 gate（#4 / #7）、消费点 grep（#8）均已实际执行并把结论写入上文

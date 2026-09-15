---
phase: 51-zip
plan: 07
subsystem: 用户技能导入管线（文档与账本收口：产品说明第十三节 / 维护约定 / 验证契约）
tags: [skills, import, docs, maintenance, ledger, counts-parity, validation-contract, honest-boundaries]
dependency-graph:
  requires:
    - 51-01（SEC-10 写面加固 —— `ai-agent-workspace.md` §七 的行为变更条目）
    - 51-02（`yauzl` / `yaml` 两个依赖 —— 「精确钉版」坑的来源）
    - 51-03（`IMPORT_LIMITS` / `IMPORT_SKILL_ERROR` 20 键 / `SKILL_THREAT_PATTERNS` / 唯一落盘实现）
    - 51-04（`INVALID_NAME` 第 21 码 / 覆盖事务与回滚语义）
    - 51-05（`HOST_WHITELIST` 六条 / 网络面四码 / DNS rebinding 残余风险）
    - 51-06（弹框完整契约 / 四条 UI 诚实边界 / 禁用原因不在 live region 的已知边界）
  provides:
    - "`docs/product/ai-skills.md` 第十三节【导入】（13.1–13.10 十个子节 + 安全边界与已知限制定稿节）"
    - "`docs/product/ai-skills.md` §11.8 的 counts-parity 命令：`suites` 5 → 7、`cells` 下限 12 → 20、陈旧注释改为实测口径"
    - "`AGENTS.md` 新增「用户技能导入（zip + 网络地址）的维护约定」条目（同步面清单 + 四条硬约束 + 码表隔离 + 四条不变式 + 五条诚实边界 + 五个实测坑）"
    - "`AGENTS.md` 测试行补两个新套件例数 + 工作区套件 21 → 38 例"
    - "`docs/product/ai-agent-workspace.md` §七 第 7 条 SEC-10 行为变更 + §四 交叉引用"
    - "`.planning/phases/51-zip/51-VALIDATION.md` 收口（wave_0_complete 置真 / 矩阵 18 行重键 / Wave 0 与 Sign-Off 勾选 / Manual-Only 表逐项标注实际状态）"
    - "`tests/test-builtin-skills-seeder.js` 的账本判据改为实跑取值（原先写死 21 例）"
  affects:
    - 阶段收尾（verifier / verify-work / validate-phase）—— 本计划的文档与验证契约是它们的判据来源
tech-stack:
  added: []
  patterns:
    - 文档与常量的**双向一致链**：`IMPORT_SKILL_ERROR` ↔ 第十三节码表 ↔ `SKILL_IMPORT_ERROR_TEXT`（三处由两条机械判据守住）
    - 例数账本**可重跑判据**（命令从文档原文抽取后执行，不另抄一份）
    - 「不自证」边界：`status` / `nyquist_compliant` / 矩阵 `Status` / `Approval` 全部留 `pending`，交下游工具判定
    - 验证契约的「已跑 / 未跑」分列（Manual-Only 表逐项标注实际状态，不整表标成自动化）
key-files:
  modified:
    - docs/product/ai-skills.md
    - docs/product/ai-agent-workspace.md
    - AGENTS.md
    - .planning/phases/51-zip/51-VALIDATION.md
    - tests/test-builtin-skills-seeder.js
    - .planning/WINDOWS.md
decisions:
  - "`§13.10` 的五条诚实边界逐条成文（不是脚注），并把「`skills.sh` 承载候选闭环」这条**已被实测推翻**的旧理由**明写为不得再沿用**"
  - "DNS rebinding 段**同时**给出缓解（白名单把收益压到接近零）与未消除两侧 —— 只写一侧都算不合格（门禁二有正反两条判据）"
  - "`51-VALIDATION.md` 只改 `wave_0_complete: true`；`status` 保持 `draft`、`nyquist_compliant` 保持 `false`（**不在本阶段自证**，与 50 先例同款）"
  - "`tests/test-builtin-skills-seeder.js` 的 `line.includes('21 例')` 改为**实跑取值**（与同文件下方 bash-policy 判据同一范式）—— 它原先与自己的用例名「不写死字面量」相悖，51-01 扩例后变成「只能靠改测试才能变绿」的陈旧字面量"
  - "`50-VALIDATION.md:119` 与 `.planning/**` 下其余 8 份 counts-parity 副本**均不改** —— 它们不被本阶段门禁消费，改动只会污染 Phase 50 已签字的收口记录"
metrics:
  duration: "~25 min（主会话内联执行 —— 子代理配额 429 未恢复）"
  tasks: 3
  commits: 3
  files: 6
  completed: 2026-09-15
actuals:
  tokens: 19334
  tasks: 3
  commits: 3
  plan_head_before: 29ec59a65e52369b4625f4673ed678b9f4c69bec
coverage:
  - id: T1
    description: "`docs/product/ai-skills.md` 新增第十三节【导入】：13.1 两种来源与一条管线 / 13.2 两阶段预览与句柄生命周期 / 13.3 六类限额（含深度按技能根相对计的口径说明）/ 13.4 逐 entry 校验与整包拒绝 / 13.5 威胁扫描两级效力 / 13.6 名称冲突三档 / 13.7 覆盖的备份与回滚 / 13.8 成功报告与 21 码错误码表 / 13.9 `allowed-tools` / 13.10 安全边界与已知限制定稿（五条诚实边界 + 两条挂账 + 六条「本阶段不做」）"
    requirement: USER-03
    verification:
      - kind: unit
        ref: "门禁一：`第十三节 ok（十个子节要点 + 常量全量码覆盖 + 八个限额值逐字 + 无过时表述）`"
        status: pass
      - kind: unit
        ref: "门禁二：`诚实边界 ok（无本机路径 + rebinding 两侧 + 两条挂账）`"
        status: pass
    human_judgment: false
  - id: T2
    description: "`AGENTS.md` 新增导入维护约定（权威文档指向 / 同步面清单 / 四条硬约束 / 码表隔离 / 四条不变式 / 五条诚实边界 / 五个实测坑）+ 测试行补两个新套件与工作区套件新例数；`docs/product/ai-agent-workspace.md` §七 记录 SEC-10 行为变更 + §四 交叉引用"
    requirement: USER-05
    verification:
      - kind: unit
        ref: "门禁三：`维护约定 ok（条目 + 四类同步面 + 五个坑 + SEC-10 行为变更）`"
        status: pass
      - kind: unit
        ref: "门禁四：`不变式 ok（四条 + 码表隔离 + 落盘唯一性）`"
        status: pass
    human_judgment: false
  - id: T3
    description: "例数账本收口（`suites` 7 个 / `cells` 下限 20 / 逐套件覆盖断言在位）+ 九个套件全绿 + `51-VALIDATION.md` 按 50 同款回填（`wave_0_complete` 置真而 `status` / `nyquist_compliant` / 矩阵 `Status` / `Approval` 保持不自证）"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "门禁五 / 六：九个套件逐条 `# fail 0`（含 `test-builtin-skills-seeder` 101/101）"
        status: pass
      - kind: unit
        ref: "门禁七：`例数账本 ok（命令取自 docs/product/ai-skills.md 原文 + 覆盖断言在位 + cells=20）`"
        status: pass
      - kind: unit
        ref: "门禁八：`验证契约 ok（wave_0_complete 置真 + status/nyquist 不自证 + 矩阵重键 18 行 + Status/Approval 保持 pending + 勾选 15 条）`"
        status: pass
    human_judgment: false
status: complete
---

# Phase 51 Plan 07: 文档与账本收口 Summary

**本计划由主会话内联执行**（子代理配额 429 未恢复，重置时间 2026-09-16 14:53）。它是本阶段的最后一个 plan：在它之前所有行为面都已落地并被验证，本计划只做「把已实现的行为**如实**写下来 + 把例数账本刷新到实测值」。

---

## 三条任务的实际交付

| 任务 | 提交 | 落点 |
|------|------|------|
| T1 第十三节【导入】+ 安全边界定稿 | `ef9dbdb` | `docs/product/ai-skills.md`（+184 行） |
| T2 维护约定 + SEC-10 行为变更 | `1a0d33c` | `AGENTS.md`、`docs/product/ai-agent-workspace.md` |
| T3 账本收口 + 验证契约回填 | `2a491a4` | `docs/product/ai-skills.md`（§11.8 命令）、`51-VALIDATION.md`、`tests/test-builtin-skills-seeder.js`、`.planning/WINDOWS.md` |

---

## 门禁实测结果（8 条全部在当前树上逐字实跑）

| # | 任务 | 结果 |
|---|------|------|
| 1 | T1 | `第十三节 ok（十个子节要点 + 常量全量码覆盖 + 八个限额值逐字 + 无过时表述）` |
| 2 | T1 | `诚实边界 ok（无本机路径 + rebinding 两侧 + 两条挂账）` |
| 3 | T2 | `维护约定 ok（条目 + 四类同步面 + 五个坑 + SEC-10 行为变更）` |
| 4 | T2 | `不变式 ok（四条 + 码表隔离 + 落盘唯一性）` |
| 5 | T3 | 4 套件串跑：每条 `# fail 0` |
| 6 | T3 | 5 套件串跑：每条 `# fail 0` |
| 7 | T3 | `例数账本 ok（命令取自 docs/product/ai-skills.md 原文 + 覆盖断言在位 + cells=20 measured={…}）` |
| 8 | T3 | `验证契约 ok（wave_0_complete 置真 + status/nyquist 不自证 + 矩阵重键 18 行 + Status/Approval 保持 pending + 勾选 15 条）` |

**判据实现方式**：9 条 `<automated>` 块由编排层从 `51-07-PLAN.md` 原文抽取为可执行脚本后逐条实跑（**不重写、不手抄**），因此「抽取逻辑本身」也被验证。

### 九个套件实测（门禁 5/6 的输出）

| 套件 | 结果 | 套件 | 结果 |
|------|------|------|------|
| `test-manage-skill` | 55/55 | `test-agent-workspace` | 38/38 |
| `test-ai-skills` | 198/198 | `test-builtin-skills-seeder` | **101/101** |
| `test-skill-picker-model` | 115/115 | `test-skills-import` | 116/116 |
| `test-skills-management` | 49/49 | `test-skills-import-net` | 50/50 |
| `test-skills-http-api` | 41/41 | | |

串跑实测 ≈ 6 秒（Sign-Off 的「< 20s」判据成立）。

---

## 本计划发现并修复的一处**既有假绿的陈旧判据**（Rule 1 偏离）

**现象**：门禁 6 首次实跑时 `test-builtin-skills-seeder.js` 报 **101 tests / 100 pass / 1 fail**：

```
not ok 14 - AGENTS.md 的「测试：」行计数与实跑输出一致（唯一权威判据，不写死字面量）
  error: '工作区测试计数应保持 21 例'
```

**成因**：`tests/test-builtin-skills-seeder.js:2203` 用 `line.includes('21 例')` **写死**了 `test-agent-workspace.js` 的例数。51-01 把该套件从 21 例扩到 38 例（这正是本阶段要写进账本的实测值），于是这条判据变成「**只能靠改测试才能变绿**」的陈旧字面量 —— 而它的用例名恰恰自称「唯一权威判据，**不写死字面量**」。

**处置**（与同文件下方 bash-policy 判据**同一范式**）：改为由 `node --test tests/test-agent-workspace.js` 实跑取 `# tests`，再断言 AGENTS.md 那一行含该值。

**可失败性验证**：把 AGENTS.md 的 38 例单点改回 21 例 ⇒ 转红并指名
`AGENTS.md 的工作区套件计数必须等于实跑值 38（当前行：…）`；复原后 `101/101` 全绿，`cmp` 逐字节一致。

> 这条偏离是**必须做**的：AGENTS.md 的例数不经这次同步，账本与实测就永久不一致（T-51-51 的「账本数字与实测不符 ⇒ 门禁失真」）。已登记 `.planning/WINDOWS.md`。

---

## 例数账本收口（唯一被本阶段门禁消费的那一份）

**取证口径（文件级，可跑）**：`grep -rln 'const suites=' docs AGENTS.md` ⇒ **1 个文件**（`docs/product/ai-skills.md`）；加进 `.planning` ⇒ **10 个文件**（其余 9 份为不参与判定的历史 / 引用副本，含本计划自身）。⇒ 「全仓只有一处」不成立；成立的是「**只有 `docs/product/ai-skills.md` 这一份被本阶段门禁消费**」。

改动内容：

- `suites` 数组 **5 → 7**（追加 `tests/test-skills-import.js` 与 `tests/test-skills-import-net.js`）
- `cells` 下限 **12 → 20**，并把陈旧注释（「由 8 提到 12」）改为实测口径：「五个既有套件实测贡献 16 个单元（`AGENTS.md` 5 + 本文件 11）；两个新套件各需在两个文件里都有单元 ⇒ 下限 = 16 + 2×2 = 20」
- **逐套件覆盖断言保留**（`for (const base of Object.keys(meas)) if (!hit[base]) bad.push(…)`）—— 它是「两个新套件必须在两个账本文件里都有单元」的**唯一执行机制**
- **取值口径一字不改**（`matchAll(/(\d+)\s*例/g)`，不退化成取段内首个数字）
- `50-VALIDATION.md:119` 与其余副本**均不改**（不被本阶段门禁消费；改动只会污染 Phase 50 已签字的收口记录）

**收口实测**：

```
counts-parity ok
cells=20 measured={"test-manage-skill.js":"55","test-ai-skills.js":"198","test-skill-picker-model.js":"115",
"test-skills-management.js":"49","test-skills-http-api.js":"41","test-skills-import.js":"116","test-skills-import-net.js":"50"}
```

---

## 验证契约收口（与 50 先例同款的自证边界）

| 项 | 本计划处置 | 理由 |
|----|-----------|------|
| `wave_0_complete` | **`true`** | 本阶段可自证（两个新套件 + 夹具生成器 + 语料夹具 + counts-parity 同步全部落地） |
| `status` | **保持 `draft`** | 文件 frontmatter 注释逐字写着 `draft (seeded by plan-phase) → validated (set by validate-phase §6)` |
| `nyquist_compliant` | **保持 `false`** | 同上，`/gsd:validate-phase` 判定 |
| 矩阵 `Status` 列 | **保持 `⬜ pending`**（18 行） | 该列由 `/gsd:verify-work` 回填，已在矩阵上方写明 |
| `**Approval:**` | **保持 `pending`** | 同上 |
| 矩阵 `Task ID` / `Plan` / `Wave` / `File Exists` | **逐行回填**（18 行按真实 `51-0X-TN` 重键；`❌ W0` 全部替换为实际文件名） | 计划要求的四列 |
| `Wave 0 Requirements` | **8 项全勾** | 全部已落地 |
| `Validation Sign-Off` | **勾 6 条**（含新增的 counts-parity 一条），第 7 条 `nyquist_compliant` 保持未勾并注明「**不在本阶段自证**」 | 照 50 先例 |

**Manual-Only 表逐项标注了「本阶段实际跑过什么」**（**不整表标成自动化**）：

- ✅ **预览卡片在真实设置页 CSP 下的渲染** —— 已由 51-06 的 uat 驱动**自动化**（52 项断言全过），证据固化在 `tests/.uat-out/uat-51-import-modal.json`；残余人工面：极窄窗口以外的窗口尺寸档未逐一取数
- ✅ **`skills.sh` 可达性** —— 已跑一次（一次性人工，`curl -sIL` ⇒ 308 → `www.skills.sh`，原始响应逐字留档在 `51-05-SUMMARY.md`）；**未跑**：用导入管线对该地址实跑完整导入
- ⬜ **真实 GitHub 端到端成功路径** —— 仍未跑
- ⬜ **403 / 429 限流文案** —— 仍未跑（分类逻辑已由 stub server 用例覆盖）
- ⬜ **32 MiB 上传的真实耗时与内存峰值** —— 仍未跑（行为面已覆盖）

---

## Deviations from Plan

### Rule 1（自动修复）：`tests/test-builtin-skills-seeder.js` 的账本判据

见上「既有假绿的陈旧判据」。该文件**不在本计划的 `files_modified` 里**，但不改它账本就永久不一致（且门禁 6 会转红）。已登记 `.planning/WINDOWS.md`。

### Rule 3（阻塞）：子代理配额

本计划原计划由 `gsd-executor` 子代理执行，但子代理配额仍处 429 窗口（重置 2026-09-16 14:53:20）⇒ 由主会话**内联执行**全部三个任务。**未经独立子代理复验** —— 这是本 SUMMARY 证据链的一处已知弱化，已如实披露。

---

## 已知盲区 / 诚实边界

1. **文档里不对任何未修项作越界声明**：`TD-48-01`（`escapeHtml` 不转义引号）仍开未修，本阶段只做到「不扩大缺口」；`#skillImportGate` 的禁用原因变化不在 live region 内；`/api/skills/set-disabled` 无存在性校验（50 带出，按需求边界不处置）。
2. **`syncAgentSystemPrompt()` 必须分开记两个数**：本阶段完成后**写路径** 3/3（49 的 `manage_skill` + 50 的启停 / 卸载 + 51 的导入）；**读侧 / 兜底**（`refreshSkillsForPanel()` / `ensureSkillsFresh()`）不是同一个量 ⇒ **不得**声称 P8 失效链 6/6 全覆盖。已写入 `51-VALIDATION.md` 的挂账节。
3. **文档里的 DNS rebinding 段刻意保留「未消除」**：只写「白名单压到接近零」会被读成已消除，因此正反两侧都必须出现（门禁二就是这条的机械形式）。
4. **真实 GitHub 端到端与 32 MiB 实测仍是人工面** —— 本计划**没有**把它们标成已自动化。
5. **`.planning/**` 下另有 9 份 counts-parity 副本**未同步（含本计划自身）—— 它们不参与判定，且改动会污染 Phase 50 的签字记录。

---

## Threat Flags

| 威胁 ID | 处置状态 |
|---------|---------|
| T-51-47（诚实边界只写进文档、未上屏） | **缓解**：四条已在 51-06 上屏（源码判据）+ 本节与 `AGENTS.md` 各写一份，双向引用 |
| T-51-48（文档沿用已被实测推翻的旧理由） | **缓解**：四条负向 token 判据（出现即转红）；`skills.sh` 那条**明写为不得再沿用** |
| T-51-49（验证契约被勾成通过而未真跑） | **缓解**：门禁现场跑九个套件（68 条 `# fail 0` 行）+ counts-parity 现场取值比对 + `wave_0_complete` 与勾选数判据；`status` / `nyquist` / `Status` / `Approval` 一处不自证；Manual-Only 表区分「已跑 / 未跑」 |
| T-51-50（文档写入本机绝对路径 / 随机路径 / sha） | **缓解**：负向判据扫 `/Users/wxnacy` / `/Volumes` / `/private/var`（全文档，实测零命中）；路径一律写形状或访问器名 |
| T-51-51（账本数字凭估算写入） | **缓解**：counts-parity 现场跑套件取值再比对；`cells` 下限 20 防「少写单元」；**本轮实际抓到并修掉了一处陈旧账本判据**（见上） |
| T-51-SC（依赖安装） | **无安装动作**；本计划零代码改动（只改文档、账本判据与验证契约） |

---

## Next Phase Readiness

- **阶段收尾就绪**：七个 plan 全部完成；文档与验证契约已定稿；账本与实测逐字一致且可重跑。
- **下一步由编排层执行**：`verify_phase_goal`（gsd-verifier）→ `code_review_gate` → `verify_work`（人工 UAT 回填矩阵 `Status` 与 `Approval`）→ `/gsd:validate-phase`（判定 `status` 与 `nyquist_compliant`）。
- **本阶段遗留的人工面共 3 项**（真实 GitHub 端到端 / 403·429 限流文案 / 32 MiB 本机耗时与内存峰值），已逐条留在 `51-VALIDATION.md` 的 Manual-Only 表。

---

## Self-Check

- [x] 三条任务全部执行并各自独立提交（`ef9dbdb` / `1a0d33c` / `2a491a4`）
- [x] 计划自带 9 条 `<automated>` 抽取为可执行脚本后逐条实跑，全部 `exit 0`
- [x] 九个套件全绿（每条 `# fail 0`），counts-parity `ok` 且 `cells=20`
- [x] 跨计划回归判据仍成立：`importUserSkill(` 定义 1 + 调用 1、`yauzl.openPromise(` 恰 1 处、`MANAGE_SKILL_ERROR` 恰 11 键
- [x] 发现并修复一处既有假绿判据，附单点变异证据（转为实跑取值）
- [x] `51-VALIDATION.md` 按 50 同款收口，`status` / `nyquist_compliant` / 矩阵 `Status` / `Approval` 一处不自证
- [x] SUMMARY 写入 `.planning/phases/51-zip/51-07-SUMMARY.md`
- [x] 未修改 STATE.md / ROADMAP.md（编排层所有）

**Self-Check: PASSED**

---
phase: 49-manage-skill-ai
plan: 03
subsystem: docs
tags: [product-doc, maintenance-contract, test-ledger, validation-matrix, honest-boundaries]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: 49-01 的 manage_skill 三动作 / 唯一校验器 / 九码拒绝面 / LIMITS 五项；49-02 的卡片标记两时点 / 终态元数据通道 / M 组与 L 组接线断言
provides:
  - docs/product/ai-skills.md §十一「AI 自建技能（manage_skill）」—— 三动作 / 不接受 path / 九码拒绝面 / 两个上限闸职责 / 扫描与净化口径 / 三条诚实边界 / 可见性与时序
  - §十 10.5 / 10.6 / 10.7 三处交叉指引（不复制正文）
  - §七 与 AGENTS.md 两处测试账本的实测例数（41 / 172 / 99 同年同源）
  - AGENTS.md 的 manage_skill 维护约定条目（四条硬约束 + 时序口径 + 测试口径）
  - 49-VALIDATION.md 的矩阵重键（49-01-T1..T3 / 49-02-T1..T3）+ OQ-1..OQ-4 裁决 + Manual-Only 五步可勾选步骤与证据分层
affects: [50-settings-skill-management, 51-import-pipeline, 52]

# Actuals (#2632)
actuals:
  tokens: 8800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "产品说明 = 行为契约 + 指向（不复制函数签名 / 行号 / 正则字面量），避免形成第二份需要同步的真相"
    - "两处测试账本（AGENTS.md 测试行 / docs §七）在同一任务内刷且都取实跑 # tests 值"
    - "未闭合项在文档中如实挂账并声明完成比例（1/3），不写「已修 / 已闭合」"

key-files:
  created: []
  modified:
    - docs/product/ai-skills.md
    - AGENTS.md
    - .planning/phases/49-manage-skill-ai/49-VALIDATION.md

key-decisions:
  - '章节取 §十一（独立一级章节），而非塞进已很长的 §十 —— 能力面（AI 自建技能）与调用面（发现与调用）概念并列；§十 的 10.5 / 10.6 / 10.7 各补一行交叉指引，不复制正文'
  - '拒绝面写成「九码 + 各自触发条件」的表，并显式声明「不新增第十码」（action 非法归 invalid_name、正文为空归 invalid_description）'
  - '两条上限闸的职责写成对照表，并把「不得用 prompt 段预算闸做创建拒绝」的理由写成「否则变成无法自救的死局」——把纪律锚在后果上而非口吻上'
  - '三条诚实边界中的 bash 绕过 name 格式闸，用「写入门严 / 读入门宽」一句话解释为「已知的不对称」而非漏洞；双写路径明确写「只做一半的保护是负面价值」'
  - '§十一 不写函数签名 / 行号 / 正则字面量（禁止形成第二份真相）；技能名格式以「只允许小写字母、数字与连字符」的散文表达，常量名（LIMITS 两项）与九码保留为行为契约的一部分'
  - '执行期实测更正：plan 期记录的 D-48-A（播种测试 DOC-02 计数断言基线即红）**未复现** —— 实跑 101/101 全绿、子测试 14 通过；已在 49-VALIDATION.md 的豁免口径段落按实测改写为「该红项未复现」'

patterns-established:
  - "文档链闭环：AGENTS.md 维护约定 → docs §十一 → 代码模块；任一处改动必须同步另一处（双向契约）"
  - "证据分层声明：自动化层与仅人工层在 VALIDATION.md 中显式分列，禁止用自动化证据替代人工裁决"

requirements-completed: []  # 本计划 frontmatter 的 requirements 为空（纯文档 / 账本计划）

coverage:
  - id: D1
    description: "docs/product/ai-skills.md 新增 §十一 AI 自建技能（三动作 / 不接受 path / 九码拒绝面 / 两个上限闸职责 / 扫描与净化口径 / 三条诚实边界 / 可见性与时序 / 维护约定与测试）"
    verification:
      - kind: unit
        ref: "node -e '<§十一 要点齐备 + §十 交叉指引 + §七 新条目>' → ok"
        status: pass
      - kind: unit
        ref: "node -e '<九码齐备 + 无越界声明 + 1/3 收口语义>' → ok"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/product/ai-skills.md §七 与 AGENTS.md 测试清单行的实测例数（test-manage-skill.js 41 / test-ai-skills.js 172 / test-skill-picker-model.js 99）"
    verification:
      - kind: unit
        ref: "node -e '<§七 两处实测例数 ok（4 条）>'; node -e '<AGENTS.md 维护约定 + 测试清单 ok>'"
        status: pass
      - kind: integration
        ref: "node tests/test-builtin-skills-seeder.js（DOC-02 跨文件计数交叉校验）→ # tests 101 / # pass 101 / # fail 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "AGENTS.md 新增 manage_skill 维护约定条目（产品说明权威 = §十一；四条硬约束；时序口径；测试口径）"
    verification:
      - kind: unit
        ref: "node -e '<AGENTS.md 收口不合格> 断言组' → ok"
        status: pass
    human_judgment: false
  - id: D4
    description: "49-VALIDATION.md 矩阵按已交付计划 / 任务重键（49-01-T1..T3 / 49-02-T1..T3）+ wave_0_complete: true + OQ-1..OQ-4 裁决与落点"
    verification:
      - kind: unit
        ref: "node -e '<矩阵重键 + 四条 OQ 裁决 + Wave 0 状态 ok>'"
        status: pass
    human_judgment: false
  - id: D5
    description: "49-VALIDATION.md 的 Manual-Only 行细化为五步可勾选步骤（含可判定期望现象与 280px backstop 处理方式）+ 证据分层声明"
    verification:
      - kind: unit
        ref: "node -e '<Manual-Only 步骤与期望现象就绪（含证据分层与 backstop 处理方式）>'"
        status: pass
    human_judgment: false
  - id: D6
    description: "判据 1 的端到端可见性（AI 建技能后下一条消息的应答能引用该技能）—— 需真实 LLM 往返，步骤已就绪但未执行"
    verification: []
    human_judgment: true
    rationale: "该断言点在真实 LLM 的下一轮请求上（system prompt 回写是否被模型采信为「我有哪些技能」），本地夹具只覆盖工具路径与成功出口行为，无法证明模型侧的引用行为；另含最小宽度下的视觉裁决。二者都不可自动化。"

duration: 12min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 03: 文档与账本收口 Summary

**把「AI 自建技能」从代码事实提升为 Phase 50/51 唯一可读的权威口径：新增 `docs/product/ai-skills.md` §十一（三动作 / 九码拒绝面 / 两个上限闸职责 / 扫描与净化口径 / 三条诚实边界 / 时序语义），并在 AGENTS.md 挂上维护约定与实测测试账本、把 49-VALIDATION 矩阵按已交付任务重键并落定四条 OQ 裁决。**

## Performance

- **Duration:** 12 min（本次由主会话接管执行，见 Issues）
- **Started:** 2026-09-13T15:52（+08:00）
- **Completed:** 2026-09-13T16:05（+08:00）
- **Tasks:** 3 / 3
- **Files modified:** 3（116 处净增）

## Accomplishments

- **`docs/product/ai-skills.md` 新增 §十一「AI 自建技能（manage_skill）」**（11.1–11.8）：三动作语义（`create` 独占创建 / `update` 全量覆写正文 / `delete` 递归删整目录）、改名不支持、工具**不接受 `path`**（接口设计即边界）、**九条拒绝原因**（闭合白名单 + 各自触发条件 + 「不新增第十码」）、**两个上限闸的职责分工**（数量闸管磁盘与重扫成本、prompt 段预算闸管请求成本，**不得用后者做创建拒绝**）、**扫描与净化口径**（description 两组 / content 一组；**先扫描后净化**；净化只作用 description；命中即拒绝写入）、**三条诚实边界**、**可见性与时序**（下一条消息起可用 / 卡片是不可变历史 / 至多一条标注 + 两处刻意省略）。
- **§十 三处交叉指引**（10.5 三档徽标 / 10.6 `read` 卡片技能化 / 10.7 诚实边界）各补一行指向 §十一，**不复制正文** —— 同一份口径只在一处成文。
- **两处测试账本同批刷为实测值**：`docs §七` 与 `AGENTS.md:267` 都写 `test-manage-skill.js` **41 例**、`test-ai-skills.js` **172 例**、`test-skill-picker-model.js` **99 例**（全部取自实跑 `# tests`，非估算）。
- **`AGENTS.md` 新增 `manage_skill` 维护约定条目**：产品说明权威 = §十一；四条硬约束（① 校验器与三动作住 `ai-skills-manager.js` 且**零 electron 依赖** ⇒ 50/51 直接 require 同一份，不得另写第二份；② seeded 判定按**播种登记表**而非目录位置；③ `LIMITS` **只允许加项**；④ 三动作**一律不加确认卡片**且 `SKILL_THREAT_PATTERNS` 技能域模式组归 Phase 51）+ 时序口径（只调**一次** `syncAgentSystemPrompt()`，新技能集在成功出口回写、下一条消息起可用）+ 测试口径（必须直接注入 `seededNames`，严禁经 `getSeededSkillNamesSafe()` 导致假绿）。
- **`49-VALIDATION.md` 矩阵按已交付任务重键**：18 行覆盖 `49-01-T1..T3` / `49-02-T1..T3`（列数与表头一致、Status 全 `⬜ pending`、File Exists 全 `✅`），`wave_0_complete: true`，`status: draft` 与 `nyquist_compliant: false` **保持不变**（不自我认证）。
- **OQ-1..OQ-4 写入裁决与落点**（无「待裁决」残留）：OQ-1 方案 A（`scanInjectionPatterns` 加可选参，`ai-memory-manager.js` 随之进入改动集）/ OQ-2 `LIMITS` 加第四项 `MAX_SKILL_DESCRIPTION_CHARS = 1024` / OQ-3 新建 `tests/test-manage-skill.js` + `test-ai-skills.js` 补 M·L 组 / OQ-4 静默剥除首部 YAML 块且不新增错误码。
- **Manual-Only 预备就绪**：判据 1 的人工行细化为**五步可逐条勾选**（含 `commit-style` 命名例、`npm run dev` 前置、「下一条消息」断言点、同名内置三动作的「内置不可改删」失败面、`/` 面板**托管**徽标、280px 最小宽度下的**单行**不换行与**省略号**退化边界），并补**证据分层声明**（层 1 自动化 vs 层 2 仅人工，不互相替代）。

## Task Commits

Each task was committed atomically:

1. **Task 1: ai-skills.md §十一 + §十 交叉指引 + §七 实测例数** - `6b44df3` (docs)
2. **Task 2: AGENTS.md 维护约定与测试账本 + 49-VALIDATION 矩阵重键与 OQ 裁决** - `81989e1` (docs)
3. **Task 3: 49-VALIDATION 人工观察预备（五步 + 期望现象 + 证据分层）** - `6855500` (docs)

**Plan metadata:** 本 SUMMARY 所在提交（docs: complete plan）

## Files Created/Modified

- `docs/product/ai-skills.md` — 新增 §十一（11.1–11.8，约 95 行）；§十 10.5 / 10.6 / 10.7 各补一行交叉指引；§七 例数刷新为 172 并新增 `test-manage-skill.js` 41 例条目（+102 / −1）
- `AGENTS.md` — §AI 工作区与 Bash 权限 新增 `manage_skill` 维护约定条目；`:267` 测试清单行新增 `test-manage-skill.js` 条目、`test-ai-skills.js` 147→172、`test-skill-picker-model.js` 补 99 例（+2 / −1）
- `.planning/phases/49-manage-skill-ai/49-VALIDATION.md` — frontmatter `wave_0_complete: true`；矩阵重键 18 行；Known-Open Items 四条裁决；Wave 0 四项勾选；Manual-Only 五步与证据分层；豁免口径按实测更正（+60 / −36）

## Decisions Made

- **章节取 §十一 独立一级章节**（不塞进 §十）：能力面与调用面概念并列，§十 已有 10.1–10.8 且很长；§十 以交叉指引行衔接而不复制正文。
- **§十一 只写行为契约与指向**：不写函数签名、不写行号清单、不写正则字面量 —— 常量名（`LIMITS` 两项）与九码保留是因为它们本身是 50/51 要复用的口径标识，而非实现细节。
- **诚实边界写成「后果 + 为什么这样设计」**：bash 绕过 name 格式闸 = 「写入门严 / 读入门宽」的已知不对称；双写路径 = 「只做一半的保护是负面价值」；扫描 = 「安全边界是确认卡片 + 硬沙箱」。
- **四条 OQ 裁决一律落到具体文件 / 断言组**，不只写结论 —— 便于 50/51 直接消费。

## Deviations from Plan

**1. [执行方式偏离 — 子代理降级为自主会话接管]**

- **Found during:** 进入 Wave 3 派发时
- **Issue:** 第一次派发因网络代理瞬断（`connect ECONNREFUSED 127.0.0.1:7897`）失败；重试时子代理模型返回 **429 配额超限**（重置时间 2026-09-14 13:09:47 UTC+8），`gsd-executor` 无法启动。
- **Fix:** 按既定降级策略由**主会话直接接管**执行 49-03。接管前已核验代理**无任何残留**（无 49-03 提交、无 `49-03-SUMMARY.md`、工作树仅两个既有未跟踪目录），因此为**全新执行**而非从残留续做。
- **Impact:** 本计划的执行上下文由主会话承载；所有任务仍按原子提交纪律落盘（3 次提交），三条计划的 `<verify>` 判据逐条跑通，断言集未放宽。

**2. [Rule 3 - Blocking] 计划自带 `<verify>` 脚本的 HTML 实体与语法缺陷**

- **Found during:** Task 1 / Task 2 验证
- **Issue:** 计划内联的 `<automated>` 脚本出现 `&lt;` / `&gt;` / `&amp;` 实体（不可编译），Task 2 的 AGENTS.md 脚本还有一处语义无效表达式（`if(/.../m.test(a))` 中 `m.test` 非函数），照字面执行会恒失败且与实现无关。
- **Fix:** 每条只做**最小语法修正**（实体还原、无效表达式改写为 `RegExp.test(...)`），**断言集逐条保留、未放宽**；另按计划意图补了两条计划未写但必要的护栏断言（`21 例` / `97 例` 不得丢失 —— 否则会踩红 `tests/test-builtin-skills-seeder.js` 的 DOC-02 交叉校验）。
- **Verification:** 五条脚本全部输出预期成功行（见 coverage D1–D5 的 `ref`）。
- **Committed in:** `6b44df3` / `81989e1` / `6855500`（各归对应任务提交）

**3. [Rule 1 - 实测更正] D-48-A「基线即红」的前提未复现**

- **Found during:** Task 2（改 `AGENTS.md:267` 前的回归基线核验）
- **Issue:** `49-VALIDATION.md` 与 49-03-PLAN 均记「`tests/test-builtin-skills-seeder.js` 的 DOC-02 计数断言在 Node 22 下**基线即红**（D-48-A）」。实测该套件 **101/101 全绿**，其中 `AGENTS.md 的「测试：」行计数与实跑输出一致` 子测试（编号 14）**通过**；改 `AGENTS.md:267` 前后均全绿。
- **Fix:** 不修该测试（计划明文禁止），只把 `49-VALIDATION.md` 的「豁免口径」段落按实测改写为「该红项未复现，已按实测更正」并保留原约束（不得算作本阶段引入回归 —— 该约束已被实测满足）。
- **Verification:** `node tests/test-builtin-skills-seeder.js` → `# tests 101 / # pass 101 / # fail 0`（改动前后各跑一次）。
- **Committed in:** `81989e1`（Task 2 提交）

**4. [Rule 3 - Blocking] `.planning/config.json` 的 `git.allow_default_branch_commits`（承接自 49-01）**

- **Found during:** Task 1 提交前
- **Issue:** 本项目 `branching_strategy: "none"` 且全部历史提交都在 `master`，而 GSD 的默认分支门会把 `master` 判为受保护并在每次提交前 HALT。
- **Fix:** `49-01` 已写入官方 override 键 `git.allow_default_branch_commits: true`（本计划未再改动该文件）；未跳过任何断言、未使用 `--no-verify`、未自建或改写分支。
- **Verification:** 三次提交均正常落盘（`6b44df3` / `81989e1` / `6855500`）。

---

**Total deviations:** 4（1 执行方式降级 + 2 blocking 修正 + 1 实测更正）
**Impact on plan:** 无范围蔓延。所有偏离都发生在「计划自身的前置不成立」处（脚本不可编译、基线红项前提失实、子代理不可用），修正后断言集与交付物与计划一致。

## Issues Encountered

1. **子代理模型配额 429（重置 2026-09-14 13:09:47 UTC+8）** —— 本计划由主会话接管执行完毕；本阶段后续若需再派发子代理（verifier / code-review），在同一重置时间前可能同样受限，届时同样按主会话接管处理。
2. **承接自 49-01 的窄边界残余待裁决** —— `validateManagedSkillContent` 在内容恰为 65 536 字节时放行，而加载期闸口量的是含 frontmatter 的整个 `SKILL.md`（约多 60 字节）：内容落在约 65 480–65 536 字节区间时会「落盘成功但下次重扫被丢弃」。已按计划 `<behavior>` 字面实现并记入 `49-01-SUMMARY.md` 的 Issues；本计划把它**补记**进 `49-VALIDATION.md` 的 Known-Open Items（作为执行期补充裁决），供 verify-work / 后续阶段裁决。**未**在 §十一 里把它写成已闭合。
3. **D-48-A 红项未复现** —— 见 Deviations 第 3 条。
4. **未闭合项一律保持挂账** —— §十一 未声称 `TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06` 已闭合，也未声称失效链已完整收口；明确写「本阶段只补齐其中一段（AI 自建技能这一写入入口），另一个实际写入入口归 Phase 50 设置页，合计约 1/3」。源码门禁断言（TD/WR 标识符附近不得出现「已修 / 已闭合 / 已修复」、`P8` 附近不得出现「全覆盖 / 已完整收口 / 6/6」）**通过**。
5. **本计划未执行人工观察** —— 步骤与期望现象已就绪；未创建 `49-UAT.md`、未改 `STATE.md`、未跑 `npm run dev`（按计划任务属性，执行归 `/gsd:verify-work`）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 50（设置页技能管理区）/ Phase 51（导入管线 + 技能域威胁模式组）现在只需读两个地方即可拿到完整口径**：`docs/product/ai-skills.md` §十一 + `AGENTS.md` 的 `manage_skill` 维护约定条目 —— 不必读代码反推校验器在哪、边界在哪、哪些面故意不做。
- **可直接复用的实现**：`ai-skills-manager.js` 的三动作与校验器（零 electron 依赖），以及 `LIMITS` 的五项（`MAX_SKILL_MD_BYTES` / `MAX_USER_SKILLS` / `SKILLS_PROMPT_CHAR_BUDGET` / `MAX_MANAGED_SKILLS` / `MAX_SKILL_DESCRIPTION_CHARS`）。
- **Phase 51 的接线已预留**：技能域扫描已是**单点**（`scanSkillText` 委托记忆域模式表），威胁模式组只需在同一份模式单源里扩表、**不需要加接线**；本阶段**未**预置技能域模式表（避免与 51 的实现重叠）。
- **本阶段（Phase 49）整体**：3 个计划全部落地，测试账本三处实测值（41 / 172 / 99），全仓相关套件绿。阶段指纹（`.planning/` 与文档被改）在 49-03 提交后 stale 属**预期**，收尾时重算。
- **待裁决事项**：Issues #1（配额，仅影响后续子代理派发方式）、#2（65 536 字节窄边界，建议由 verify-work 裁决是否记为技术债）。

---

*Phase: 49-manage-skill-ai*
*Completed: 2026-09-13*

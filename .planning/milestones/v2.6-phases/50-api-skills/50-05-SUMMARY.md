---
phase: 50-api-skills
plan: 05
subsystem: documentation
tags: [docs, ledger, counts-parity, validation-matrix, maintenance-contract, honest-boundaries, phase-51-handoff]

# Dependency graph
requires:
  - phase: 50-api-skills
    provides: 50-01 的管理读路径纵切（管理投影 / 尺寸口径 / 只读列表）—— §十二 12.1 / 12.2 的行为依据
  - phase: 50-api-skills
    provides: 50-02 的写路径与两入口（三态拒绝面 / 第十码 / 两条写路由 / 双键校验）—— §十二 12.3 / 12.4 / 12.7 的行为依据
  - phase: 50-api-skills
    provides: 50-03 的 SEC-09 体积闸与 IPC 三通道 —— §十二 12.8 与 12.7 的行为依据
  - phase: 50-api-skills
    provides: 50-04 的设置页交互面与诊断两层承载 —— §十二 12.5 与诚实边界 ① 的行为依据
provides:
  - docs/product/ai-skills.md §十二【管理面】（12.1–12.9 + 五条诚实边界）—— Phase 51 复用判据 / 谓词 / 体积闸形状 / 两入口转发层的唯一口径来源
  - docs/product/ai-skills.md §11.3 的「不新增第十码」矛盾消除（工具侧九条不变 + 管理面 not_user_owned 第十码）
  - docs/product/ai-skills.md §七 / §11.8 的两个管理面套件账本行 + 文末 counts-parity 命令扩到 5 套件（cells<12）
  - AGENTS.md「技能管理面（设置页 + /api/skills/*）的维护约定」（权威指针 + 同步义务 + 四条硬约束 + 测试口径 + 诚实边界）+ 测试清单行两个新套件（实测 47 / 32 例）
  - .planning/phases/50-api-skills/50-VALIDATION.md 的矩阵重键（50-01-T1..50-05-T3）+ wave_0_complete: true + A2/A3/A4/A6 四条处置 + Manual-Only 表补四条（含 D-19 与打包态两条锁定决策的验收面）+ counts-parity 命令副本
  - counts-parity（5 套件版）转绿：cells=16，实测 55 / 187 / 115 / 47 / 32
affects: [51, phase-51-import-pipeline, verify-work-50]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 19424
  tasks: 3
  commits: 3
plan_head_before: 71e182270d2330a292a9d8c4f083d8071dd223f0

# `actuals.commits: 3` 是本 SUMMARY 落盘时的台账实测值（`git rev-list --count 71e1822..HEAD` 扣掉本 SUMMARY 与其后的元数据提交）。

tech-stack:
  added: []
  patterns:
    - "文档收口的三处同批刷新：产品说明账本行 / AGENTS.md 测试清单行 / VALIDATION 命令副本必须**同一个任务里**一起刷，否则例数账本必然漂移"
    - "诚实边界的可机械判据：越界声明的扫描必须做**位置限定豁免**（否定限定出现在被断言动词**之前**才豁免）—— 同行豁免会被「无遗漏 / 无残留」这类肯定式越界借一个「无」字整行逃逸"
    - "命令副本的「缺失即失败」形态：两处副本比对不能写成「两边都在才比对」，否则漏写一处会静默跳过（本计划首跑时 50-VALIDATION.md 尚无副本，门禁如实报出）"
    - "锁定决策的验收面必须登记进 Manual-Only 表并附机械核验断言（D-19 的「两个内置技能」与打包态的「make install」两条）—— 否则验收面会悄悄消失"

key-files:
  created: []
  modified:
    - docs/product/ai-skills.md
    - AGENTS.md
    - .planning/phases/50-api-skills/50-VALIDATION.md

key-decisions:
  - "§十二 取【行为契约 + 指向】写法：不写函数签名、不写行号、不写正则字面量（plan 的 prohibitions 第 3 条）—— 产品说明与实现台账是两类文档，复制实现细节会造出第二份需要同步的真相"
  - "§12.6 第 ② 条把 ROADMAP 的 Doc sync 条款按「**不展示**」满足并写明依据：allowed-tools 尚未被解析（解析半边归 Phase 51）⇒ 条件句前置条件不成立；同时留下「51 若展示必须带免责标注」的交接"
  - "§12.6 第 ④ 条把「管理面名称谓词故意比写入门宽」写成**设计**并明记「不得统一」—— 统一成严格形态会让 skills/My_Skill/ 这类技能的开关点了必然失败"
  - "§12.8 只写**可复现的规则**（不 destroy()、不设 Connection: close、用 req.resume()），并把「Connection: close 会导致 EPIPE」这一因果显式标注为**不可复现**、不得写成事实（plan prohibitions 第 2 条）"
  - "写路径份额与读侧触发点**两个数分开记**（OQ-5）：写路径收口到 2/3（49 的 manage_skill + 50 的设置页启停/卸载，只剩 51 的导入）；50-01 新增的 ensureSkillsFresh() 是读侧/兜底，明确不计入分子 —— 防止被读成 P8 已 6/6"
  - "§11.3 的修订只改「工具侧九条不变 + 管理面 not_user_owned（第十码）」并写明 MANAGE_SKILL_SHORT_REASON **保持恰 9 键**、只覆盖工具面；管理面错误码由设置页自己的文案表承载"
  - "50-VALIDATION.md 的 Status 列全部保持 ⬜ pending —— 该文件不在本计划内自证通过，状态由 /gsd:verify-work 回填；nyquist_compliant 保持 false（由 /gsd:validate-phase 判定），status 保持 draft"
  - "Manual-Only 表补足四条（A6 渲染观感 / E5 窄窗行首行 backstop / D-19「未配置任何 provider 时仍能列出两个内置技能」/ 打包态 make install 产物列出内置技能），后两条的 Requirement 列写明 USER-01（D-19 的验收面）"
  - "**接管续做而非重做**：本计划的执行者子代理在派发时撞上 429 配额，但已产出 Task 1 的提交与 Task 2 / Task 3 的未提交残留；编排器（主会话）按既有约定先查残留（git status / 逐文件内容 / 门禁实跑）确认代理已死，然后**从残留处续做并代跑全部验证**，逐任务分别提交"

patterns-established:
  - "三处账本同批刷新 + 一处权威副本：counts-parity 的 suites 数组（5）、AGENTS.md 的测试清单行、docs/product/ai-skills.md 的 §七/§11.8 账本行、50-VALIDATION.md 的命令副本 —— 任一漏刷即由逐套件覆盖检查报「账本未覆盖」"
  - "文档门禁的变异义务：每条门禁落地后必须做单点变异证明其可失败（本 run 8 条：删小节标题 / 改回「不新增第十码」/ 2/3→3/3 / 写入不可复现因果 / 写入越界声明 / 删「零 electron」/ P8 写 6/6 / 账本 47→48）"
  - "诚实边界的写法模板：挂账项逐字保留 + 另起独立记账句，避免「同名不同物」被合并成一句"

requirements-completed: [USER-01, USER-02]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "docs/product/ai-skills.md §十二【管理面】成文（12.1–12.9 九个小节 + 五条诚实边界 + 体积口径 + allowed-tools 缺席原因 + nameClash 归属 + 两入口与不可互换理由 + 体积闸形状）"
    requirement: USER-01
    verification:
      - kind: unit
        ref: "50-05-PLAN.md Task1 两条 <automated>（§十二 26 个关键要点 + 9 个小节标题 + §11.3 第十码修订 + 两处账本 + cells<12；诚实边界的越界声明/不可复现因果/两个份额）—— 本 run 逐条实跑 PASS"
        status: pass
    human_judgment: false
  - id: D2
    description: "§11.3 的「不新增第十码」矛盾消除：工具侧九条不变 + 管理面 not_user_owned（第十码），且 MANAGE_SKILL_SHORT_REASON 保持恰 9 键"
    requirement: USER-02
    verification:
      - kind: unit
        ref: "同 D1 的第一条门禁（断言 §11.3 段内不再出现「不新增第十码」且出现 not_user_owned）"
        status: pass
    human_judgment: false
  - id: D3
    description: "AGENTS.md 新增技能管理面维护约定（权威指针 + 同步义务 + 四条硬约束 + 测试口径 + 诚实边界），测试清单行新增两个新套件的实测例数（47 / 32）且单行多套件结构未被破坏"
    verification:
      - kind: unit
        ref: "50-05-PLAN.md Task2 两条 <automated>（15 个要点 + 测试清单行同一行含两套件 + 无越界声明）—— 本 run 实跑 PASS"
        status: pass
    human_judgment: false
  - id: D4
    description: "50-VALIDATION.md 回填：矩阵按 50-01-T1..50-05-T3 重键、wave_0_complete: true、nyquist_compliant 保持 false、A2/A3/A4/A6 四条处置、Manual-Only 表补四条、counts-parity 命令副本与产品文档逐字一致"
    verification:
      - kind: unit
        ref: "50-05-PLAN.md Task3 第一条 <automated>（重键 + wave_0 + 四条假设 + 副本一致性 + 缺失即失败）—— 本 run 实跑 PASS"
        status: pass
    human_judgment: false
  - id: D5
    description: "counts-parity（5 套件版）转绿 + 七个套件全绿（Phase 50 的阶段门禁）"
    requirement: USER-01
    verification:
      - kind: unit
        ref: "counts-parity: cells=16 measured={manage-skill 55, ai-skills 187, picker-model 115, skills-management 47, skills-http-api 32}；七套件 # fail 全 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "§十二 的每条口径与**代码行为**一致（不照着 PLAN 的意图写）"
    verification: []
    human_judgment: true
    rationale: "机械门禁只能证「要点在场 + 无越界声明」，证不了「文档所述行为 == 代码实际行为」。§十二 是产品说明，其正确性只能由人逐条对照 50-01..50-04 的 SUMMARY 与源码复核；本 run 已人工通读 §12.6 / 12.7 / 12.8 并确认与代码事实一致，§12.1–12.5 的逐条对照留待 /gsd:verify-work 的 UAT"

# Metrics
duration: 18min
completed: 2026-09-14
status: complete
---

# Phase 50: 设置页技能管理区 + `/api/skills/*` Summary

**管理面从代码事实提升为成文契约（`docs/product/ai-skills.md` §十二 12.1–12.9 + 五条诚实边界），维护约定与测试账本三处同批刷新，counts-parity 扩到 5 套件后转绿（cells=16），Phase 50 的七个套件门禁全绿**

## Performance

- **Duration:** 约 18 min（22:41:41 → 22:57:40，含一次子代理 429 中断后的主会话接管）
- **Started:** 2026-09-14T14:39:00Z（子代理派发）
- **Completed:** 2026-09-14T14:57:40Z（Task 3 提交；SUMMARY 与元数据提交在其后）
- **Tasks:** 3/3
- **Files modified:** 3（`docs/product/ai-skills.md` / `AGENTS.md` / `50-VALIDATION.md`），本计划**零源码与业务测试改动**

## Accomplishments

- **§十二【管理面】成文**：12.1 列表字段与口径（六项字段 / 三档分组 / 组内 `bySkillPriority` 全序投影 / 空组不渲染）· 12.2 体积与文件数计量口径（含 `SKILL.md`、不含隐藏文件、不穿符号链接、目录 `size` 不计、截断给诊断、`0 B · 0 个文件` 改显「统计不可用」）· 12.3 启停（只过滤不删文件、禁用仍可卸载、双键服务端校验）· 12.4 卸载（仅 `source === 'user'`、三态拒绝面、判据在 manager 层、无备份）· 12.5 诊断与状态（两层承载、状态链取首条、`nameClash` 归属 `/` 面板）· **12.6 五条诚实边界** · 12.7 两入口不可互换的理由 · 12.8 请求体体积闸 · 12.9 维护约定与测试
- **§11.3 的自相矛盾消除**：原文「九条拒绝原因 / 不新增第十码」与 50-02 新增的 `not_user_owned` 冲突 ⇒ 改为「工具侧九条不变 + 管理面 `not_user_owned`（第十码，见 §十二）」，并写明 `MANAGE_SKILL_SHORT_REASON` 保持恰 9 键、只覆盖工具面
- **三处账本同批刷新 + counts-parity 转绿**：`docs/product/ai-skills.md` §七 / §11.8 账本行、`AGENTS.md` 测试清单行、`50-VALIDATION.md` 命令副本（权威副本），`suites` 3 → 5、阈值 `cells<8` → `cells<12`；实测 `cells=16`、`measured = 55 / 187 / 115 / 47 / 32`
- **`AGENTS.md` 新增「技能管理面（设置页 + `/api/skills/*`）的维护约定」**：权威指针（§十二）+ 七项同步义务 + 四条硬约束（零 electron 单源 / 谓词故意不同宽 / `syncAgentSystemPrompt()` 函数体不得改 / `LIMITS` 只加项且前端零字面量）+ 测试口径（`seededNames` 必须显式注入）+ 诚实边界
- **`50-VALIDATION.md` 按实际交付重键**：矩阵从需求维度改为 `50-01-T1..T3` … `50-05-T3`；`wave_0_complete: true`；A2/A3/A4/A6 四条假设逐条处置；Manual-Only 表补四条（含 **D-19「未配置任何 provider 时仍能列出两个内置技能」** 与 **打包态 `make install` 产物列出内置技能** 两条锁定决策的验收面）

## Task Commits

1. **Task 1: `docs/product/ai-skills.md` §十二 + §11.3 修订 + §七/§11.8 账本 + 命令扩 5 套件** — `956b5a5` (docs)
2. **Task 2: `AGENTS.md` 技能管理面维护约定 + 测试清单两套件** — `7fdc1c4` (docs)
3. **Task 3: `50-VALIDATION.md` 回填（重键矩阵 + 四条假设 + 命令副本）+ counts-parity 收口** — `ae630a5` (docs)

**Plan metadata:** 本 SUMMARY 与其后的 `docs(50-05): complete …` 元数据提交

## Files Created/Modified

- `docs/product/ai-skills.md` — 新增 §十二（12.1–12.9 + 五条诚实边界，+135/−8）；§11.3 第十码修订；§七/§11.8 账本行；文末 counts-parity 命令扩到 5 套件
- `AGENTS.md` — 新增技能管理面维护约定条目；测试清单行新增两个新套件并刷新既有例数（picker 111 → 115、ai-skills 178 → 187），保持单行多套件结构（+2/−1）
- `.planning/phases/50-api-skills/50-VALIDATION.md` — 矩阵重键、frontmatter `wave_0_complete: true`、四条假设处置、Manual-Only 表补四行、counts-parity 命令副本（+84/−51）

## Decisions Made

见 frontmatter `key-decisions`（含 §十二 的体例取向、ROADMAP Doc sync 的「不展示」依据、谓词故意更宽是设计的成文、只写可复现规则的纪律、写路径 2/3 与读侧分开记、接管续做而非重做）。核心取舍是：**产品文档只写行为契约与边界，不复制实现细节**，让 §十二 与 `AGENTS.md` 的维护约定一起成为 Phase 51 的唯一口径来源。

## Deviations from Plan

**1. [执行中断 —— 接管续做] 子代理 429 配额中断，编排器从残留处续做**

- **Found during:** 计划派发时（Task 1 已产出提交、Task 2/3 留有未提交残留在工作树）
- **Issue:** 派发 `gsd-executor` 时返回 `429 您的使用量已超出频率限制`；但工作树显示代理已实际执行（`956b5a5` 提交 + `AGENTS.md` / `50-VALIDATION.md` 未提交改动）
- **Fix:** 按既有约定先在接管前确认代理已死（`git status` 无在途写入、逐文件核对内容、门禁实跑），确认后**从残留处续做**：逐条实跑 7 条门禁 → 补齐单点变异 8 条 → 逐任务分别提交 → 写 SUMMARY
- **Files modified:** 无（续做即计划内工作）
- **Verification:** 7 条门禁全部实跑 PASS；8/8 单点变异转红且 8/8 还原后复绿；七套件 `# fail` 全 0
- **Committed in:** `7fdc1c4` + `ae630a5`

**2. [Rule 3 - Blocking] 门禁文本含 HTML 实体转义，逐字执行会 SyntaxError**

- **Found during:** Task 1 门禁首次执行
- **Issue:** PLAN 的 `<automated>` 里 `&lt;` / `&gt;` 是 PLAN.md 的 XML 转义，逐字复制进 `node -e` 会得到 `SyntaxError`
- **Fix:** 提取时把 `&lt;` / `&gt;` 反转义为 `<` / `>` 再执行；**判据一字未改**
- **Files modified:** 无（执行方式修正）
- **Verification:** 反转义后 7 条门禁逐条 PASS
- **Committed in:** n/a（不涉及仓库文件）

**3. [Rule 3 - Blocking] `docs/product/ai-skills.md` 的 `Connection: close` 披露句会被诚实边界门禁命中**

- **Found during:** Task 1 第二条门禁
- **Issue:** §12.8 要求写的「该因果不可复现」这句披露句，若与「会导致 … EPIPE」同处一行，会被门禁的因果扫描当作事实性声明（判据的否定限定在动词之后）
- **Fix:** 把披露写成**两条独立短句**（规则句只写「不 `destroy()`、不设 `Connection: close`」，因果句用「在本仓的重研会话中**不可复现**，不得写成事实」），使否定限定落在断言之前
- **Files modified:** `docs/product/ai-skills.md`
- **Verification:** 门禁 PASS；且把「Connection: close 会导致客户端 EPIPE」作为独立行插入时门禁如实转红（变异 T1b-2）
- **Committed in:** `956b5a5`

---

**Total deviations:** 1 执行中断（接管续做）+ 2 auto-fixed（Rule 3 × 2）
**Impact on plan:** 判据未放宽、覆盖面无削减；接管续做未重做已完成的工作。两处 Rule 3 都是执行方式修正（不涉及仓库文件语义）。

## Issues Encountered

- **子代理 429 配额中断**：已按既有约定处理（先确认代理已死 → 从残留处续做 → 代跑验证并**如实披露验证由编排器代跑，未经独立子代理复验**）。
- **`counts-parity` 在本计划之前为红**（前三波次的预期状态，Pitfall 11 的「中途 red」）：本计划是最后一个改动测试相关面的计划 ⇒ 在本计划内转绿，实测 `cells=16`。
- **并发会话**：Wave 2 区间另有一个 docs-only 提交（`docs/dev/branching-spec.md`）落在同一分支，与本阶段改动面零交集。
- **未登记的探针 worktree**：Wave 1 的执行器自行创建了 `.worktrees/dirty-probe`（分支 `probe/dirty`，工作区干净、指向 master 上一提交）。已向用户报告，用户裁决**先留着、阶段收尾一起清**。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 51（导入管线 + 技能域威胁模式组）可直接接手**：§十二 与 `AGENTS.md` 的维护约定是唯一口径来源，四条硬约束与三条交接（`allowed-tools` 缺席原因、体积闸的 `{ maxBytes }` 可显式覆盖形状、SEC-07 的「与内置同名拒导入 / 与用户技能同名三选一」口径承接点）均已成文。
- **仍挂账、不得声称已闭合**：`TD-48-01` / `TD-48-02` / `WR-02` / `WR-06` 与 `STATE.md` 的 `syncAgentSystemPrompt()` 生产调用方 ⚠️ —— 本阶段只把**写路径**收口到 **2/3**（读完份另计）。
- **`nyquist_compliant` 仍为 `false`**、`50-VALIDATION.md` 的 `status` 仍为 `draft`：等待 `/gsd:validate-phase` 与 `/gsd:verify-work` 判定，本计划不自证。
- **人工面遗留**：`50-VALIDATION.md` 的 Manual-Only 表现有 8 条（含 D-19 与打包态两条锁定决策的验收面），须由 `/gsd:verify-work` 的 UAT 逐条走。

---

## Self-Check: PASSED

| 检查项 | 结果 |
|--------|------|
| Task 1 两条门禁（§十二 要点齐备 / 诚实边界） | 实跑 PASS |
| Task 2 两条门禁（维护约定 / 诚实与结构） | 实跑 PASS |
| Task 3 三条门禁（VALIDATION 回填 / counts-parity / 七套件全绿） | 实跑 PASS |
| 单点变异 8 条（转红 + 还原复绿） | 8/8 PASS |
| 逐任务原子提交 | 3/3（`956b5a5` / `7fdc1c4` / `ae630a5`） |
| 计划改动的文件面 | 恰 3 个，零源码与业务测试改动 |
| 验证由谁执行 | **编排器代跑**（子代理 429 中断）—— 未经独立子代理复验，如实披露 |

---
*Phase: 50-api-skills*
*Completed: 2026-09-14*

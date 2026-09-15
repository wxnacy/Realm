---
phase: 51-zip
plan: 04
subsystem: 用户技能导入管线（落盘事务 + 两阶段句柄生命周期 + 拒绝面矩阵）
tags: [skills, import, conflict, overwrite-rollback, ttl, crash-sweep, error-matrix, security]
dependency-graph:
  requires:
    - 51-03（导入纵切 / 全量校验 / 唯一落盘实现 / 20 键码表 / 70 例套件）
    - 51-02（`yauzl` / `yaml` 依赖）
    - 51-01（沙箱写面加固 `resolveInsideForWrite`）
    - 46/49/50（`LIMITS` / `validateManagedSkillName` / 遮蔽语义 / `_skillImports` 表）
  provides:
    - "`ai-skills-manager.js`：`resolveImportConflict`（三档判定）、`userSkillPaths`、`countUserSkills`（导出）、`IMPORT_TMP_PREFIXES`（单源）、`importTmpSuffix`、`isImportResidueName`、`resolveRenamedTarget`；`IMPORT_SKILL_ERROR.INVALID_NAME`（第 21 键）；`makeImportError` 派生结构化 `quota`"
    - "`importUserSkill` 的三档事务：覆盖 = 备份 + 两段 rename + 第二步失败回滚；回读失败按场景回滚；数量闸「覆盖豁免 / 改名计入」"
    - "`ai-manager.js`：`_purgeExpiredSkillImports`、`cancelSkillImport`、`sweepSkillImports({mode:'own'|'stale'})`、`commitSkillImport` 的取消 / 过期分支、失败路径保留句柄；`importSkillErrors()` 码表单源访问器"
    - "`main.js`：启动 `sweepSkillImports({mode:'stale'})`（fire-and-forget + `.catch`）与 `before-quit` 的 `sweepSkillImports({mode:'own'})`"
    - "`tests/test-skills-import.js` 106 例 + 矩阵夹具（`assertRejected` / `EXPECTED_CODES` / `PENDING_CODES_NETWORK` / `OBSERVED_CODES`）"
  affects:
    - 51-05（网络面复用三档事务与矩阵；**必须清空 `PENDING_CODES_NETWORK`** 并在其 T3 门禁断言零跳过项）
    - 51-06（冲突三选一 UI 消费 `preview.conflict.kind`；`quota` / `diagnostics` 若要上屏须同批扩 `main.js` 的响应形状）
    - 51-07（码表账本 20 → 21、错误码表新增 `invalid_name`、两处产品文档 + counts-parity）
tech-stack:
  added: []
  patterns:
    - 三档冲突判定（判定顺序即语义；seeded 先判且不查磁盘）
    - 目录级覆盖事务 = 临时备份 + 两段同设备 rename + 失败即回滚（「先删后移」被否决）
    - 回读验证失败按场景回滚（覆盖恢复备份 / 新建移回源位置）
    - 句柄生命周期四态（TTL / 并发上限 / 一次性 / 显式取消幂等）
    - 崩溃清扫双模式分离 + **陈旧性判据**（`own` 精确 / `stale` 只删早于 2 × TTL）
    - 前缀常量单源 + 命名形状成对不变式（正命题：对真实产物断言 true）
    - 「码 → 用例」可机械核对的矩阵（期望表从被测模块取值 + 具名豁免并打印）
key-files:
  created: []
  modified:
    - ai-skills-manager.js
    - ai-manager.js
    - main.js
    - src/settings-page.js
    - tests/test-skills-import.js
decisions:
  - "覆盖的临时备份是**临时的**（成功后即刻删除），不是版本历史 / 恢复机制（D-09 / ECO-02）——用例以「成功后备份目录不存在」钉住"
  - "`INVALID_NAME` 是**本计划唯一**的新增码（`IMPORT_SKILL_ERROR` 20 → 21）；与 `MANAGE_SKILL_ERROR.INVALID_NAME` 取值相同但命名空间独立，导入路径**不得**借用后者的键"
  - "导入面的错误码在 `ai-manager.js` 里改为引用 `IMPORT_SKILL_ERROR` 常量（`importSkillErrors()`）而不是手抄字符串 —— 门禁 T2 G1 要求的形态，也是「码表单源」纪律的落地"
  - "`IMPORT_TMP_PREFIXES` 在 Task 1 就定义（覆盖备份是该前缀的第一个消费者），`isImportResidueName` 在 Task 2 补 —— 保证任何一处都不写死前缀字面量"
  - "回读失败的**真实形态**取「description 超过 1024 字符 ⇒ SDK 产 invalid_metadata ⇒ 加载管线整条丢弃」——导入面不预筛 description 长度，正是回读验证要兜住的那条路径（若在导入面加长度预筛，READBACK_FAILED 将无自然触发面）"
  - "`sweepSkillImports` 永不抛（未知 mode 视作 stale 扫描），启动那处不 await（清扫不得阻塞启动）"
  - "失败路径**保留**句柄与临时目录（就地重试是 UI-SPEC `提交失败` 状态机的前提）；只有过期 / 未知 / 取消 / 成功才清"
metrics:
  duration: "~22 min"
  tasks: 3
  commits: 3
  files: 5
  completed: 2026-09-15
actuals:
  # chars/4 over the realized diff（added 行 60,654 字符 + removed 行 4,737 字符 ⇒ 65,391 / 4）。
  # 与 51-03 的 63,943 同量级；两计划的写入面相当（本计划无新建文件，改动集中在既有两模块 + 套件）。
  tokens: 16348
  tasks: 3
  commits: 3
  plan_head_before: 73c3e0a6dc2058e61a0a48f7ea85031ed61a8303
requirements-completed: [USER-05, USER-08, SEC-07]
coverage:
  - id: D1
    description: "同名冲突按三档处置：seeded 拒绝导入（不提供覆盖）/ user 三选一（覆盖 / 改名 / 取消，绝不静默覆盖）/ managed 不许覆盖（永久遮蔽提示 + 只允许改名或取消）"
    requirement: SEC-07
    verification:
      - kind: unit
        ref: "tests/test-skills-import.js#resolveImportConflict：三档判定（顺序即语义） / 覆盖事务：备份 + 两段 rename + 回滚 + 回读失败回滚 + 数量闸口径"
        status: pass
      - kind: unit
        ref: "tests/test-skills-import.js#拒绝面矩阵：每个可达的 IMPORT_SKILL_ERROR 码至少一条用例（缺码即指名）"
        status: pass
    human_judgment: false
  - id: D2
    description: "覆盖是「备份 + 两段 rename」且第二步失败可回滚 —— 旧技能内容**逐字**完好（不是「断言没删过」）"
    requirement: SEC-07
    verification:
      - kind: unit
        ref: "tests/test-skills-import.js#覆盖第二步失败（真实失败注入）⇒ 旧技能内容逐字完好，无半成品"
        status: pass
    human_judgment: false
  - id: D3
    description: "落盘后回读验证失败即回滚且暴露含 path 的 diagnostics 原文（覆盖场景恢复备份 / 新建场景移回源位置），不提供「部分导入」"
    requirement: USER-05
    verification:
      - kind: unit
        ref: "tests/test-skills-import.js#回读失败（超大 description 被加载管线整条丢弃）⇒ readback_failed + diagnostics 非空 + 回滚 / 回读失败发生在覆盖场景 ⇒ 备份被恢复"
        status: pass
    human_judgment: false
  - id: D4
    description: "importId 的完整生命周期：TTL 过期给明确码、未知 / 一次性句柄、并发待确认上限、取消幂等；崩溃残留清扫带 2 × TTL 陈旧性判据（不重复 WR-05）"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "tests/test-skills-import.js#importId 生命周期：TTL / 并发上限 / 一次性 / 取消幂等 / 崩溃残留清扫：两种模式 + 陈旧性判据（WR-05 的回归护栏）"
        status: pass
    human_judgment: false
  - id: D5
    description: "每条拒绝路径给机器可读码 + 可读原因；限额类失败同时含「哪个限额」与「当前值」（结构化 quota）；无空 message / 通用文案路径"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "tests/test-skills-import.js#失败报告形状 = D-10 / 六类限额逐条：message 同时含「限额名」与「当前值」"
        status: pass
    human_judgment: false
  - id: D6
    description: "真实 10 分钟 TTL 的端到端等待（UI 侧「预览已过期，请重新选择文件」的真实观感）"
    requirement: USER-08
    verification: []
    human_judgment: true
    rationale: "TTL 由回拨 `createdAt` 的用例覆盖（不依赖真实等待，套件时长不受 TTL 影响）；真实 10 分钟等待与设置页文案观感属人工面，51-VALIDATION.md 未列此项"
status: complete
---

# Phase 51 Plan 04: 落盘事务 + 句柄生命周期 + 拒绝面矩阵 Summary

给 `51-03` 交付的落盘路径补上**用户可见的冲突决策面**与**跨进程的残留安全**：同名冲突按
seeded / user / managed 三档处置（user 三选一，**绝不静默覆盖**）；覆盖走「临时备份 + 两段
同设备 `rename`」，第二步失败即回滚、旧技能**逐字完好**，回读失败亦按场景回滚并暴露含 path 的
`diagnostics`；数量闸按「覆盖豁免（净增 0）/ 改名计入」**读盘**判定。`importId` 补齐四态生命周期
（TTL 明确码 / 未知与一次性句柄 / 并发上限 / 取消幂等）与崩溃残留清扫（`own` 精确、`stale` 带
`2 × TTL` **陈旧性判据** —— 不重复 `WR-05` 的并发实例互删缺陷）。最后把 USER-08 收成一张
**可逐码验收**的矩阵：期望表从被测模块取值，每条拒绝断言统一记账，缺码由一条机械用例指名。

## 三条任务的实际交付

| 任务 | 提交 | 内容 |
|------|------|------|
| 1 | `edf5317` | `resolveImportConflict`（三档）/ `userSkillPaths` / `IMPORT_TMP_PREFIXES` / `importTmpSuffix`；`importUserSkill` 扩为三档事务（cancel / rename / overwrite）含两段 rename + 回滚 + 回读失败回滚 + 数量闸豁免；`buildImportPreview.conflict` 三档化（seeded 档预览即失败）；`commitSkillImport` 取消分支；套件 70 → 86 例 |
| 2 | `a125cfd` | `isImportResidueName`（成对不变式）；`_purgeExpiredSkillImports` / `cancelSkillImport` / `sweepSkillImports`（own + stale 双模式，stale 带 mtime 陈旧性判据）；`commitSkillImport` 过期分支与失败保留语义；导入码改常量单源；`main.js` 启动与退出两处接线；套件 86 → 97 例 |
| 3 | `27f009d` | `makeImportError` 派生 `quota`；两处限额文案补当前值；矩阵夹具（`assertRejected` / `EXPECTED_CODES` / `PENDING_CODES_NETWORK` / `OBSERVED_CODES`）；缺口补齐（invalid_zip / skill_root_count >1 / frontmatter 四形态 / unsafe_entry 三形态 / unknown / 失败报告形状 / 六类限额循环）；套件 97 → 106 例 |

## 门禁实测结果（10 条全部在当前树上实跑）

提取 PLAN 的 `<automated>` 块并**逐字**执行（未改任何判据）。

| 门禁 | 任务 | 结果 |
|---|---|---|
| 1 落盘事务（三档判定 / 两段 rename / 回滚 / 回读 / 数量闸 / 沙箱原语） | T1 | ✅ `落盘事务 ok` exit 0 |
| 2 落盘唯一性（定义 1 / 调用 1 / handler 0）+ `MANAGE_SKILL_ERROR` 仍恰 11 键 | T1 | ✅ `落盘唯一性 ok` exit 0 |
| 3 `tests/test-skills-import.js`（`# tests ≥ 60`） | T1 | ✅ `# tests 86 / # pass 86 / # fail 0` |
| 4 `tests/test-manage-skill.js`（`# tests ≥ 55`） | T1 | ✅ `# tests 55 / # fail 0` |
| 5 生命周期接线（TTL/并发/取消/两种清扫/mtime 陈旧性/启动与退出各 1 处） | T2 | ✅ `生命周期接线 ok` exit 0 |
| 6 `tests/test-skills-import.js`（`# tests ≥ 72`） | T2 | ✅ `# tests 97 / # fail 0` |
| 7 生命周期用例 token（TTL/未知/并发/取消/`utimesSync`/`removed`/`isImportResidueName`） | T2 | ✅ `生命周期用例 ok` exit 0 |
| 8 `tests/test-skills-import.js`（`# tests ≥ 90`） | T3 | ✅ `# tests 106 / # fail 0` |
| 9 拒绝面矩阵（统一断言工具 + 期望表 + 具名豁免 + quota 断言） | T3 | ✅ `拒绝面矩阵 ok` exit 0 |
| 10 跳过项打印（集合须**恰为**网络面四码） | T3 | ✅ `跳过的码：4 个（unsupported_url / download_failed / redirect_limit / not_a_zip）` |

### 基线可失败性（把三门禁集对基线树 `73c3e0a` 的四个文件实跑）

| 门禁 | 基线树实测 |
|---|---|
| T1 G1 | **exit 1**，报 `缺 async function resolveImportConflict(` / `缺 function userSkillPaths(` / `缺 skill-replace-` |
| T2 G1 | **exit 1**，报 10 条缺失（`cancelSkillImport` / `sweepSkillImports` / 四个码 token / `IMPORT_TMP_PREFIXES` / `isImportResidueName` / `mode==='own'`） |
| T2 G3 | **exit 1**，报 7 个用例 token 缺失 |
| T3 G2 | **exit 1**，报 `缺 assertRejected` / `缺 EXPECTED_CODES` |

**T1 G2 / T3 G3 在基线树上也是绿的，这是设计如此**（计划 `acceptance_criteria` 已点名）：T1 G2
的「`importUserSkill(` 恰 1 处」与「`MANAGE_SKILL_ERROR` 恰 11 键」是**回归护栏** —— 把落盘实现
复制第二份、或把导入码并进那张表才会转红；T3 G3 是 token 存在性判据。T1 G3/G4、T2 G2、T3 G1 是
**计数门禁**（`≥ N` 例），基线树实测 70 例，故 T2 G2（≥72）与 T3 G1（≥90）在基线上按
`fails_when` 的内容判据**不满足** —— 两者的 `# fail` 则因新用例在旧实现上转红而必然非零
（实测基线树上本套件 `# fail 12`）。

## 单点变异证据（各确认转红后复原，复原后 `cmp` 逐字节一致）

| # | 变异 | 观测 | 结论 |
|---|---|---|---|
| M1 | 删掉覆盖路径的 `await env.renameFile(bak, destDir)` 回滚分支 | `# fail 1`：`覆盖第二步失败（真实失败注入）⇒ 旧技能内容逐字完好` 转红 | ✅ 回滚是可失败的承重面 |
| M2 | 去掉数量闸的覆盖豁免（`if (mode !== 'overwrite')` → `if (true)`） | `# fail 1`：`数量闸口径：skills/ 达上限时 overwrite 成功 / rename 被拒` 转红 | ✅ 「净增 0 豁免」有判别力 |
| M3 | 用 `env.exists` 判「是目录」（替换 `envDirExists`） | `# fail 2`：`「同名普通文件」不算 user 冲突` + 既有 `落盘失败（目标位置被普通文件占位）` 同时转红 | ✅ `exists` 对普通文件也返回 true ⇒ 该误用必须可见（**该用例存在**） |
| M4 | 删掉 `sweepSkillImports` 的 `mtimeMs < cutoff` 陈旧性判据 | `# fail 1`：`陈旧性正反两例：mtime 刚刚 ⇒ 一个都不删` 转红 | ✅ **WR-05 的回归护栏真的能失败**（本计划唯一针对历史缺陷的护栏） |
| M5 | 停用 OVERSIZE 的**两处**观测（⑥ 用例 + 限额循环第六类） | `# fail 1`：矩阵用例指名 `以下码没有任何拒绝用例：oversize` | ✅ 矩阵是机械判据，缺码即指名 |

## 跨计划回归判据

- `importUserSkill(` 全仓**仍恰 2 处**（`ai-skills-manager.js` 定义 1 + `ai-manager.js` 调用 1；
  `main.js` 与 `src/settings-page.js` 各 0）—— 本计划只扩分支，未新增第二个落盘实现。
- `yauzl.openPromise(` **仍恰 1 处**（单一解压入口未被破坏）。
- `syncAgentSystemPrompt()` 函数体与基线 `73c3e0a` **逐字节相同**（1058 字符，`IDENTICAL: true`）。
- `main.js` 恰 2 处 `sweepSkillImports(`（启动 `stale` + 退出 `own`），启动那处带 `.catch`。
- `tests/test-manage-skill.js` 的 55 例**零删改**（码表隔离的独立证据）。

## 全量套件实测（本计划结束时）

| 套件 | `# tests` | `# fail` |
|---|---|---|
| `tests/test-skills-import.js` | **106**（70 → 86 → 97 → 106） | 0 |
| `tests/test-manage-skill.js` | 55 | 0 |
| `tests/test-ai-skills.js` | 198 | 0 |
| `tests/test-skill-picker-model.js` | 115 | 0 |
| `tests/test-skills-management.js` | 49 | 0 |
| `tests/test-skills-http-api.js` | 41 | 0 |
| `tests/test-agent-workspace.js` | 38 | 0 |
| `tests/test-builtin-skills-seeder.js` | 101 | 0 |
| `tests/test-ai-bash-policy.js` | 97 | 0 |
| `tests/test-ai-conversations.js` | 111（自带计数） | 0 |

## 账本刷新

**本计划未改任何账本单元** —— `counts-parity` 实测
`cells=16 measured={"test-manage-skill.js":"55","test-ai-skills.js":"198","test-skill-picker-model.js":"115","test-skills-management.js":"49","test-skills-http-api.js":"41"}`，
五个既有套件例数**一字未动**（本计划只改 `test-skills-import.js`，而它尚未进该判据的 `suites`
列表）。两个新套件的账本单元与 `cells 12 → 20` 由 **51-07** 交付（其 PLAN 的 artifact 表已具名）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `buildImportPreview.conflict` 三档化打断了 51-03 最小导入入口的消费面**

- **Found during:** Task 1（改完 `conflict` 字段后扫消费侧）
- **Issue:** `src/settings-page.js` 判的是 `preview.conflict.kind === 'taken'`，而新形状是
  `none / user / managed`。不修则**同名技能上传后预览里零提示**，用户点「确认」才失败 ——
  正是「静默失败」面（本计划要消除的那一类）。
- **Fix:** 按三档给出**如实**文案（user：不会静默覆盖；managed：不允许覆盖、会永久遮蔽），
  并明说「覆盖 / 改名 / 取消的处置界面尚未启用，本次导入会被拒绝」。三选一的完整 UI 仍归 51-06
  （计划明文），本处不加新控件。
- **Files modified:** `src/settings-page.js`
- **Commit:** `edf5317`

**2. [Rule 3 - Blocking] 门禁 T2 G1 要求 `ai-manager.js` 出现 `IMPORT_EXPIRED` / `IMPORT_NOT_FOUND` / `TOO_MANY_PENDING` 三个 token**

- **Found during:** Task 2（首次跑 T2 G1）
- **Issue:** 我最初在手写字符串（`err.code = 'import_expired'`）。门禁要的是**常量 token** ——
  而手抄码值本身就是「码表非单源」的形态（`main.js` 与前端只按 code 查文案表）。
- **Fix:** 新增 `importSkillErrors()` 访问器返回 `getAiSkillsManagerLazy().IMPORT_SKILL_ERROR`，
  六处 `err.code` 全部改为引用常量（含 51-03 留下的 `unsupported_url` / `not_a_zip` 两处）。
  行为零变化、码表关系变为「引用」而非「复制」。
- **Files modified:** `ai-manager.js`
- **Commit:** `a125cfd`

### 未改动的偏离（如实记录，不修）

- **D-10 的失败报告结构未到客户端**：`main.js` 既有的两个 `catch` 分支仍只回
  `{ error, code }`（计划明文「本任务**只需复核**，不改 `main.js`」）⇒ 限额类的 `quota`
  与 `READBACK_FAILED` 的 `diagnostics` 原文**不会到达设置页**。manager 侧已是完整形状
  （有专门用例断言），要上屏须 51-06 同批扩响应形状。已登记进 `.planning/WINDOWS.md`。
- **`IMPORT_TMP_PREFIXES` 的落地时点**：计划把 `IMPORT_TMP_PREFIXES` 与 `isImportResidueName`
  都登记在 Task 2，但覆盖备份（Task 1）是该前缀的**第一个消费者**，而「前缀只在一处定义」
  的不变式不允许 Task 1 写死字面量 ⇒ 常量提前到 Task 1，判据在 Task 2 补。语义与判据不变。
  已登记进 `.planning/WINDOWS.md`。

## 已知盲区 / 诚实边界

1. **「单一落盘实现」的源码判据仍有盲区**（承 51-03 的 M1b）：本计划的判据是
   「`importUserSkill(` 定义 1 + 调用 1 + handler 0」＋「`importUserSkill` 体内出现
   `fs.renameSync` / `fs.rm` 即报错」。**它挡不住**把落盘复制成一段**内联 `env.renameFile(...)`**
   （不经那个名字）。本计划**缩窄但未消除**该盲区。
2. **覆盖的备份不是版本历史**：成功后即刻删除（用例断言备份目录已消失）。**不得**据此开
   「撤销上一次导入」——那是 ECO-02 / v1.x，且会与 50 的「卸载无备份」口径分裂。
3. **TTL / 陈旧性都靠回拨时间戳覆盖，不做真实等待**：套件总时长不因 TTL（10 分钟）显著增长；
   代价是「真实的 10 分钟」这条路径没有端到端证据（列为人工面，见 coverage D6）。
4. **`sweepSkillImports({mode:'stale'})` 在启动时是 fire-and-forget**（不 await 以保证不阻塞
   启动）⇒ 极端情况下首个 preview 可能早于清扫完成。影响面为零：preview 只建**新的**
   `mkdtemp` 目录，清扫删的是**旧的陈旧**残留，二者不相交。
5. **`PENDING_CODES_NETWORK` 是本计划的过渡态**：四个网络面码（`unsupported_url` /
   `download_failed` / `redirect_limit` / `not_a_zip`）在 51-04 范围内**确实不可达**，
   故**具名跳过并打印**（不是静默过滤）。清空它的时点与责任在 **51-05 Task 3 第 6 步**；
   `51-06` / `51-07` 都**不**承「该清单为空」这条断言，本 SUMMARY 也**不**声称它们会断言。
6. **回读失败的自然触发面依赖「导入面不预筛 description 长度」**：`description` 超过 1024
   字符的包能通过全部导入前闸（字节闸按 `SKILL.md` 整文件 ≤ 64 KiB），随后被加载管线整条
   丢弃 ⇒ 由回读验证兜住并回滚。若日后在导入面加 description 长度预筛，**必须**同时换一个
   READBACK_FAILED 的自然形态，否则该码会失去用例（矩阵会指名它缺失）。
7. **`quota` 是 manager 侧的结构**：`makeImportError` 在 `extra.limit !== undefined` 时派生
   `{limit, limitValue, currentValue}`。非限额类失败**不得**凭空带 `quota`（有用例钉住）。

## Threat Flags

无新增安全面 —— 本计划引入的破坏性写路径（覆盖）与磁盘清扫都在 `<threat_model>` 的
T-51-23/24/25/26/27/28/29/30 覆盖范围内，且逐条有对应用例（冲突矩阵 / 回滚 / 陈旧性正反 /
无空 message / 沙箱原语断言 / 数量闸两条口径）。

## Self-Check

- 创建文件存在性：本计划**未新建文件**（5 个均为既有文件修改）✅
- 提交存在性：`edf5317` ✅ / `a125cfd` ✅ / `27f009d` ✅
- 计数：`git rev-list --count 73c3e0a6dc2058e61a0a48f7ea85031ed61a8303..HEAD` = **3**（与
  `commits: 3` 一致，MEASURED；无外来提交插入）
- `syncAgentSystemPrompt()` 函数体与基线 sha **逐字节相同**（1058 字符，`IDENTICAL: true`）
- 未触碰 STATE.md / ROADMAP.md（编排器所有）；`.planning/WINDOWS.md` 已追加 3 条

**Self-Check: PASSED**

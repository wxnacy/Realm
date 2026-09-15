---
phase: 49-manage-skill-ai
plan: 06
subsystem: documentation
tags: [manage_skill, docs-correction, ledger, namespace-discipline, 48-review, 49-review, test-counts, consistency-command, evidence]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: 49-04 的写侧权威字节闸口（按组装后的 SKILL.md 全文）/ 净化后复验非空 / YAML 单引号标量编码 —— §11.3、§11.5、§四 的口径已在其落地，本计划只做核对与交叉指引
  - phase: 49-manage-skill-ai
    provides: 49-05 的卡片标记并入单源（`mergeManageSkillMarker`）与失败态原因码词缀（`MANAGE_SKILL_CODE_TAG`）—— 本计划负责把这两处新引入的可见面与机制成文
provides:
  - docs/product/ai-skills.md §11.7 失败态可见性口径（短原因由持久化原因码还原，重开对话后同样显示 + 旧消息边界）
  - docs/product/ai-skills.md §11.3 邻接的失败消息词缀成文（形态 + 示例 `[seeded_protected]` + 三条边界）
  - docs/product/ai-skills.md §11.8 双命名空间记账（48-REVIEW 挂账句原样保留五个编号 / 49-REVIEW 闭合句另起一行）
  - docs/product/ai-skills.md §11.8 携带的可重跑例数一致性命令（逐账本单元判据）
  - docs/product/ai-skills.md §七 与 §11.8 的套件例数刷新（55 / 177 / 105，实测）
  - AGENTS.md 测试行的三个套件计数与覆盖面描述刷新（精确替换，其余套件零改动）
  - AGENTS.md `manage_skill` 维护约定的四条新增不变式（组装全文闸口 / 净化后复验 / 失败态词缀 / 并入单源）
affects: [49 (verify-work / UAT), 50, 51]

actuals:
  tokens: 2452
  tasks: 3
  commits: 3
plan_head_before: b7464c093131501de3352ac17454b003e759231c

tech-stack:
  added: []
  patterns:
    - "账本命名空间纪律：裸编号（`WR-01` / `WR-02`）必须带 `48-REVIEW` / `49-REVIEW` 命名空间标记，且两个命名空间各占**独立一行** —— 合并成一句后「同名不同物」就无法机械表达"
    - "闭合动词的位置纪律：闭合动词只能出现在 48 号编号**之前**（第二句开头），编号之后 80 字符窗口内不得出现「已修 / 已闭合 / 已修复」，否则 Phase 49-03 的既有全文件门禁 `T-49-03-01` 转红"
    - "例数账本的判据按**账本单元**切分：单元右边界 = 同一行内下一个 `test-*.js` 文件名（无后继则行尾），而不是文件名→例数的固定宽度窗口 —— 后者在 799 字符单行（间距实测 96 / 125 / 258）下必然漏检至少一个单元"
    - "判据的可失败性由**单点变异**证明：三个计数各自改成错误值都必须转红并指名到「文件:行号 + 套件名 + 取到的值」，跑完逐字还原"

key-files:
  created: []
  modified:
    - docs/product/ai-skills.md
    - AGENTS.md

key-decisions:
  - "结论先行：本轮闭合的五个编号（`CR-01` / `CR-02` / `CR-03` / `WR-01` / `WR-02`）全部挂在 **`49-REVIEW.md`** 名下另起一句；§11.8 挂账句里的五个 **48 号**编号（`TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06`，含 `WR-06`）**一字未移出**，只补 `48-REVIEW` 命名空间标记与「不是同一物 / 不得混读」提示 —— 这是本计划最严重的可能失败（把 Phase 48 仍开的技术债误标为已闭合），已由两条独立行的形态 + 命名空间断言机械挡下"
  - "48 号五个编号的**定义**逐条核对 `48-REVIEW.md` 后写入挂账句（`WR-01` = 三档徽标文案两处重复 / `WR-02` = 技能解析链上的三处裸 `await` / `WR-06` = 实时读盘路径绕过 64 KiB 正文闸 / `TD-48-01` = `escapeHtml` 不转义引号 / `TD-48-02` = 取消分支判据无锚点自校验）—— 写定义而不是只写编号，是为了让「同名不同物」这句话可被读者独立复核，不是靠记编号"
  - "`syncAgentSystemPrompt()` 生产调用方的 ⚠️（本阶段只完成 3 分之 1）并入挂账句尾部如实保留；`49-REVIEW.md` 的 `WR-03` / `WR-04` / `IN-01`–`IN-06` 写进闭合句的**末尾**并明示「不在本轮范围内、仍逐条挂账」—— 闭合句只声明它真的闭合了什么"
  - "§11.7 的改写只动「失败态不显示短原因」这一条：`delete` 成功后不显示来源徽标这条**逐字保留**（它仍然成立）；改写同时补上「改动前落库的旧失败消息没有原因码」的边界（宁缺勿猜，属版本演进而非缺陷）—— 否则新的口径会被读成「所有历史失败卡片都有短原因」"
  - "§11.3 的词缀成文取**三条边界 + 一个示例**的最小形态（起始 / 只含白名单原因码 / 不回显被拒内容原文 + `[seeded_protected]`），并显式说明它不改变安全边界（原因码是枚举标识，不是指令 / 路径 / 凭据）—— 避免后来者把它当成可携带任意文本的通道（T-49-06-02）"
  - "例数一律取**实测值**：现场跑三个套件读 `# tests`（`manage-skill` 55 / `ai-skills` 177 / `picker-model` 105），三处账本（§七 两条 + §11.8 三条 + `AGENTS.md` 测试行三条 = 八个单元）在**同一个任务**里一起刷为同一组数字"
  - "一致性命令**不硬编码**那三个数字，而是现场跑套件读取 —— 否则会得到「文档与命令写死了同一组过期数字」的第二种假绿；比对粒度取账本单元而非整份文件，因而 §七 的两条与 §11.8 的三条各自可判"
  - "`AGENTS.md` 的 `- 测试：` 行是**单条约 800 字符**的长行、多个技能域条目共用，编辑只做**精确字符串替换**（三个计数 + 相邻覆盖面片段），并用它自己的锚点（以 `- 测试：` 开头的整行）定位 —— 绝不用「某个标题之前的最后一行」这类相对取行（该标题在 `AGENTS.md` 里以 `- **…` 起头，相对取行会得到标题自身的词缀片段）"
  - "维护约定只加**不变式**（机制词 + 应同步的文档位置），不复制 §十一 正文：关键名词取「组装 / 复验 / 词缀 / 单源 / `mergeManageSkillMarker`」这类机制词，**不取**产品文档的示例串（如词缀示例 `[seeded_protected]`）"
  - "所有验证命令写成 `node tests/<file>.js` / `node --test tests/<file>.js` 的显式形式，全文不出现 `npm test`（本项目 `package.json` 无该脚本）"

patterns-established:
  - "双命名空间记账的可机械判据：挂账句必须自证是 48 号的账（含 `48-REVIEW` + 全部五个编号 + 「不得混读 / 不是同一物」），闭合句必须自证是 49 号的账（含 `49-REVIEW.md` + 五个编号）且**不含** `TD-48-01`；两条断言各自独立成立"
  - "跨计划门禁回归（`T-49-03-01`）在文档改动后重跑：闭合动词只放编号之前，编号之后 80 字符窗口内不出现「已修 / 已闭合 / 已修复」"
  - "文档携带可重跑判据：§11.8 的命令代码块可被直接抽出执行（实测抽出 1379 字符并原样运行通过），把「文档数字 == 实测数字」从人工核对变成非零退出"

requirements-completed: [MGMT-01, MGMT-03]

coverage:
  - id: D1
    description: "§11.7 的失败态可见性口径与实现一致：失败态短原因由随消息持久化的原因码还原，重开对话后同样显示；`delete` 成功后不显示来源徽标这条逐字保留；补「旧失败消息无原因码」边界"
    requirement: MGMT-01
    verification:
      - kind: automated_other
        ref: "node -e '<§11.7 段断言：不得含「原因码不落库」且须含「短原因」>' → 11.7 ok"
        status: pass
    human_judgment: false
  - id: D2
    description: "失败消息的原因码词缀成文（示例 `[seeded_protected]`），并写明三条边界：词缀在消息起始 / 只含白名单原因码 / 不回显被拒内容原文 + 不改变安全边界"
    requirement: MGMT-01
    verification:
      - kind: automated_other
        ref: "node -e '<词缀成文断言：示例存在且 ±600 字符窗口内出现「起始」「白名单」「不回显被拒」>' → tag-doc ok"
        status: pass
    human_judgment: false
  - id: D3
    description: "§11.8 按命名空间分别记账：五个 48 号编号（含 `WR-06`）原样留在带 `48-REVIEW` 标记的挂账句；本轮五个 49 号闭合项另起一句挂在 `49-REVIEW.md` 名下且不含 `TD-48-01`；Phase 49-03 的既有全文件门禁仍通过"
    requirement: MGMT-03
    verification:
      - kind: automated_other
        ref: "node -e '<§11.8 命名空间记账断言（挂账句五项齐备 + 48-REVIEW + 不得混读；闭合句五项齐备 + 不含 TD-48-01；三处 80 字符窗口复跑）>' → 11.8 ok"
        status: pass
      - kind: automated_other
        ref: "node -e '<49-03 门禁 T-49-03-01 全文件扫描回归>' → 九码齐备 + 无越界声明 + 1/3 收口语义 ok"
        status: pass
    human_judgment: false
  - id: D4
    description: "三处测试例数账本（§七 两条 + §11.8 三条 + `AGENTS.md` 测试行三条 = 八个账本单元）与三个套件的实测 `# tests` 逐字一致，且由一条可重跑命令机械判据、单点变异时三个计数各自转红"
    requirement: MGMT-03
    verification:
      - kind: unit
        ref: "node tests/test-manage-skill.js（55 pass / 0 fail）・node tests/test-ai-skills.js（177 pass / 0 fail）・node --test tests/test-skill-picker-model.js（105 pass / 0 fail）"
        status: pass
      - kind: automated_other
        ref: "例数一致性命令 → counts-parity ok / cells=8 measured={\"test-manage-skill.js\":\"55\",\"test-ai-skills.js\":\"177\",\"test-skill-picker-model.js\":\"105\"}"
        status: pass
      - kind: automated_other
        ref: "§11.8 携带的命令代码块抽出后原样运行（抽出 1379 字符）→ counts-parity ok / cells=8"
        status: pass
      - kind: automated_other
        ref: "单点变异 3/3：AGENTS.md:267 test-manage-skill.js [999]≠55 / test-ai-skills.js [999]≠177 / test-skill-picker-model.js [999]≠105，三次均转红并指名，跑完逐字还原（restored byte-identical: true）"
        status: pass
      - kind: automated_other
        ref: "node -e '<AGENTS.md 测试行完整性：仍含三个目标套件与 test-ai-bash-policy.js>' → test-line intact"
        status: pass
    human_judgment: false
  - id: D5
    description: "`AGENTS.md` 的 `manage_skill` 维护约定同时含既有四条硬约束与四条新增不变式，关键机制词逐字出现，`SKILL_THREAT_PATTERNS` 归 Phase 51 的口径保留，不复制产品文档示例串"
    requirement: MGMT-03
    verification:
      - kind: automated_other
        ref: "node -e '<维护约定断言：组装/复验/词缀/mergeManageSkillMarker/单源 + LIMITS + 播种登记表 + SKILL_THREAT_PATTERNS…Phase 51>' → agents-md ok"
        status: pass
    human_judgment: false
  - id: D6
    description: "§11.8 的两个命名空间与 `48-REVIEW.md` / `49-REVIEW.md` 逐条对齐（48 号五个编号含 `WR-06` 一个都不许移出挂账句；本轮闭合声明只覆盖 49 号五项）"
    verification: []
    human_judgment: true
    rationale: "计划 `<verification>` 明示这一条是「人工复核面（不自动化）」—— 本轮已由执行者逐条对照 `48-REVIEW.md` 的 WR-01/WR-02/WR-06 行与 STATE.md 的「继续挂账，不得读成已修」段完成核对并把 48 号五条定义写进文档，但「该对齐是否成立」是语义判断，任何机械判据都只能证明两句话的形态（工作已由 D3 覆盖），不能证明语义归属正确；须由验者/用户再核一次。"

duration: 4min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 06: 文档纠偏与账本同步（gap 闭合收口）Summary

**把 49-04 / 49-05 落地后变成不成立的三处文档声明逐条纠正（§11.7 失败态短原因 / §11.3 词缀成文 / §11.8 分账），并把「文档数字 == 实测数字」变成一条可重跑命令 —— 48 号五个编号（含 `WR-06`）一字未移出挂账句，本轮五个 49 号闭合项另起一句挂在 `49-REVIEW.md` 名下（八个账本单元一致、单点变异 3/3 转红、49-03 门禁回归通过）**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-13T10:34:15Z
- **Completed:** 2026-09-13T10:38:54Z
- **Tasks:** 3/3
- **Files modified:** 2（`docs/product/ai-skills.md` +32/−7 行、`AGENTS.md` +2/−2 行）
- **Estimate vs actuals:** 计划估 `tokens 42000`（`confidence: low`）；实测（realized diff chars / 4）**2452** —— 纯文档改动，实际成本约为估值的 1/17，按 ADR-2629 口径如实记账（不向估值靠拢修饰）
- **本计划不改任何源码与测试**：`files_modified` 只有两个文档；三个套件的例数由**现场重跑**读出（未新增/放宽任何断言）

## Accomplishments

- **§11.7 口径纠正**：「重开对话后的失败历史卡片**不显示**短原因（原因码不落库…）」这句被 WR-02 的修复证伪，改写为「失败态的短原因**由随消息持久化的原因码还原**，因此重开对话后**同样显示**」，并补上「改动前落库的旧失败消息没有原因码 → 那些历史卡片仍只有「失败」而无短原因（宁缺勿猜）」的版本边界。`delete` 成功后不显示来源徽标这条**逐字保留**（仍然成立）。
- **§11.3 词缀成文**（49-05 新引入的可见面变化）：业务失败的消息文本以方括号包裹的原因码作为**起始**（示例 `[seeded_protected] 目标是随包内置技能，不可修改或删除。`），权威中文完整文案原样跟在词缀之后；三条边界 —— 起始位置（可机械识别、成功文案不可能误命中）/ 只含白名单原因码且**不回显被拒内容原文** / 不改变安全边界（原因码是枚举标识，不是指令、路径或凭据）。并说明它是失败态**唯一**的持久化通道（消息即 `tool_results` 的文本列，零 schema 变更）。
- **§11.8 双命名空间记账**（本计划的核心，也是最容易做错的一步）：末尾变成**两个独立行**——第一行是原挂账句的忠实保留 + 命名空间标注（`TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06` **五项一个不少、含 `WR-06`**，逐条写出各自的定义以便独立复核，并明示「其中 `WR-01` / `WR-02` 与下段 49 号的同名编号**不是同一物**、不得混读」；`syncAgentSystemPrompt()` 的 ⚠️（本阶段只完成 3 分之 1）如实保留）；第二行是本轮闭合声明（`49-REVIEW.md` 的 `CR-01` / `CR-02` / `CR-03` / `WR-01` / `WR-02`，逐条说明闭合机制，末尾注明 49 号其余条目不在本轮范围内、仍逐条挂账）。**闭合动词只出现在句首**，48 号编号之后 80 字符窗口内不出现「已修 / 已闭合 / 已修复」。
- **三处例数账本按实测刷新**：现场跑三个套件读 `# tests`（`manage-skill` **55** / `ai-skills` **177** / `picker-model` **105**），把 §七 两条 + §11.8 三条 + `AGENTS.md` 测试行三条（**八个账本单元**）在同一任务里刷为同一组数字，并各补本 run 新增面（description 值域与写↔读闸口 / 失败态词缀与重载还原 / 三态 `promptIncluded` 消费侧 / 合并函数值域）。
- **可重跑的一致性判据**：§11.8 新增「例数一致性判据（可重跑）」段与命令代码块 —— 判据按**账本单元**切分（单元右边界 = 同一行内下一个 `test-*.js` 文件名，无后继则行尾），因此 `AGENTS.md` 单行 800 字符、三处间距实测 96 / 125 / 258 的形态不会漏检；命令**不硬编码**那三个数字（现场跑套件读取）。抽出代码块原样运行实测通过。
- **单点变异验证 3/3**：把 `AGENTS.md` 测试行的三个计数**逐一**改成 `999`（每次只改一个、改完即跑、跑完复原），三次都转红并指名到「文件:行号 + 套件名 + 取到的值」：
  - `Error: 例数不一致: AGENTS.md:267 test-manage-skill.js 账本单元取到 [999] ≠ 实测 55`
  - `Error: 例数不一致: AGENTS.md:267 test-ai-skills.js 账本单元取到 [999] ≠ 实测 177`
  - `Error: 例数不一致: AGENTS.md:267 test-skill-picker-model.js 账本单元取到 [999] ≠ 实测 105`
  - 复核 `restored byte-identical: true`。
- **`AGENTS.md` 维护约定补四条不变式**：① 写侧权威字节闸口的判据对象 = **组装后的 `SKILL.md` 全文**；② 净化之后必须对**净化值复验**非空；③ 失败态机器可读原因码经消息**词缀持久化**、重载链路用同一常量还原；④ 卡片标记的并入逻辑**单源**在 `src/skill-picker-model.js` 的 `mergeManageSkillMarker`。既有四条硬约束（校验器位置与零 electron / 播种登记表 / `LIMITS` 只加项 / 三动作不加确认卡片 + `SKILL_THREAT_PATTERNS` 归 Phase 51）逐字保留。

## Task Commits

Each task was committed atomically:

1. **Task 1: §11.7 失败态可见性口径 + §11.3 词缀成文 + §11.8 命名空间化记账** - `59e38a5` (docs)
2. **Task 2: 三处测试例数账本按实测刷新（55 / 177 / 105）+ 例数一致性判据** - `2f64cab` (docs)
3. **Task 3: `manage_skill` 维护约定补四条不变式 + §11.8 携带可重跑例数一致性命令** - `1fdfa15` (docs)

**Plan metadata:** 最终元数据提交（SUMMARY / STATE / ROADMAP）

## Files Created/Modified

- `docs/product/ai-skills.md`
  - **§11.7**「卡片头部」条：失败态可见性口径改写（短原因可还原 → 重开对话后同样显示；补旧消息边界；`delete` 无徽标条逐字保留）
  - **§11.3 邻接处**（`不改名、不自动 lowercase` 段之后）：新增「失败结果的可见形态：消息以原因码词缀起头」成文 —— 形态 + 示例 `[seeded_protected]` + 三条边界 + 与 11.7 的交叉指引
  - **§七**：`test-ai-skills.js` 172 → **177**、`test-manage-skill.js` 41 → **55**，各补本 run 新增覆盖面描述
  - **§11.8**：三条套件例数刷新（55 / 177 / 105）+ 新增「例数一致性判据（可重跑）」段与命令代码块 + 末尾改为**两个独立行**（48-REVIEW 挂账句 + 49-REVIEW 闭合句）
  - **核对不改**：§11.3 的 `oversize` 行与 §11.5 的净化步骤经复核**已是 49-04 落地后的口径**（组装全文计字节 / 净化后复验非空 / YAML 单引号标量），无被 WR-01 证伪的残留表述
- `AGENTS.md`
  - `- 测试：` 行：三个套件计数（55 / 177 / 105）与相邻覆盖面描述刷新 —— **精确字符串替换**，同一行里 bash 策略 / 播种器 / 沙箱 / 取消状态等其它套件与描述**零改动**
  - `- **AI 自建技能（\`manage_skill\`）的维护约定**：` 条目：末尾追加四条不变式 + 测试口径句补本 run 新增面

## Verification（每条 `<verify>` 与自动化门禁的实跑输出）

| # | 命令 / 检查 | 实际输出 | 归属 |
|---|---|---|---|
| 1 | `node -e '<§11.7 段断言：不得含「原因码不落库」且须含「短原因」>'` | `11.7 ok` | Task 1 |
| 2 | `node -e '<词缀成文断言：示例 + 起始/白名单/不回显被拒 三词在 ±600 字符窗口内>'` | `tag-doc ok` | Task 1 |
| 3 | `node -e '<§11.8 命名空间记账断言（含三处 80 字符窗口复跑）>'` | `11.8 ok` | Task 1 |
| 4 | `node -e '<49-03 门禁 T-49-03-01 全文件扫描（改动前基线）>'` | `九码齐备 + 无越界声明 + 1/3 收口语义 ok` | Task 1（基线） |
| 5 | `node -e '<49-03 门禁 T-49-03-01 全文件扫描（改动后回归）>'` | `九码齐备 + 无越界声明 + 1/3 收口语义 ok` | Task 1 / Task 3 |
| 6 | `node tests/test-manage-skill.js` | `# tests 55 / # suites 12 / # pass 55 / # fail 0` | Task 2 |
| 7 | `node tests/test-ai-skills.js` | `# tests 177 / # suites 31 / # pass 177 / # fail 0` | Task 2 |
| 8 | `node --test tests/test-skill-picker-model.js` | `# tests 105 / # suites 18 / # pass 105 / # fail 0` | Task 2 |
| 9 | 例数一致性命令（逐账本单元比对，现场跑套件取实测值） | `counts-parity ok` + `cells=8 measured={"test-manage-skill.js":"55","test-ai-skills.js":"177","test-skill-picker-model.js":"105"}` | Task 2 |
| 10 | `node -e '<AGENTS.md 测试行完整性>'` | `test-line intact` | Task 2 |
| 11 | 单点变异 3/3（三个计数各自改成 999，跑完复原） | 三次均 `Error: 例数不一致: AGENTS.md:267 <suite> 账本单元取到 [999] ≠ 实测 <N>`；`restored byte-identical: true` | Task 2 |
| 12 | `node -e '<维护约定断言>'` | `agents-md ok` | Task 3 |
| 13 | §11.8 命令代码块抽出后原样运行 | 抽出 1379 字符 → `counts-parity ok` + `cells=8` | Task 3 |
| 14 | 全文 `grep -n "npm test"` | 两文件均 `(none)` | Task 1 / Task 2 |

**跨计划门禁回归（本计划 `<verification>` 明确要求）**：第 5 条 —— 改完 `docs/product/ai-skills.md` 后重跑 49-03 的全文件门禁（`T-49-03-01` 的源码扫描），确认没有任何 48 号编号被写成「已修 / 已闭合 / 已修复」。**通过**。

**人工复核面（计划明示不自动化）**：§11.8 的两个命名空间与 `48-REVIEW.md` / `49-REVIEW.md` 逐条对齐 —— 执行期已按 `48-REVIEW.md` 的 `WR-01`（三档徽标文案两处重复，:171）/ `WR-02`（技能解析链上的三处裸 `await`，:186）/ `WR-06`（实时读盘路径绕过 64 KiB 正文闸，:239）/ `TD-48-01`（:134）/ `TD-48-02`（:135）逐条核对并把定义写进挂账句，且 `STATE.md:280`「⚠️ [Phase 48 · 继续挂账，**不得**读成已修] WR-02 / WR-06」逐字未变。**48 号五个编号（含 `WR-06`）一个都未移出挂账句**；本轮闭合声明只覆盖 `49-REVIEW.md` 的 `CR-01` / `CR-02` / `CR-03` / `WR-01` / `WR-02`。

## Decisions Made

- **结论先行（与 frontmatter `key-decisions` 同源）**：49 号五项闭合挂在 `49-REVIEW.md` 名下另起一行、48 号五项一字不移出；48 号五条定义核对 `48-REVIEW.md` 后写入文档以便独立复核；`syncAgentSystemPrompt()` 的 ⚠️ 与 49 号其余条目如实挂账；§11.7 只动失败态那一条并保留 `delete` 无徽标条；词缀成文取三条边界 + 一个示例的最小形态并声明不改变安全边界；例数一律取实测值且三处同任务刷新；一致性命令不硬编码数字、按账本单元切分；`AGENTS.md` 测试行只做精确替换且用行自身锚点定位；维护约定只加机制词不变式、不复制正文；验证命令一律 `node tests/...` 形式。
- 详细理由见 frontmatter `key-decisions`（10 条）。

## Deviations from Plan

### 计划内部张力的调和（非偏离，如实记录）

**1. 「§11.8 携带可重跑的一致性命令」这一 run 级约束落在了 Task 3 的文件面上**

- 计划 Task 2 的 `<behavior>` 把「例数一致性命令」描述为**判据**（跑三个套件比对文档数字、不一致即非零退出），其 `Artifacts` 表与 `must_haves.artifacts` 也只列出「§七 的两条套件例数刷新」「§11.8 的三条套件例数刷新」——**未**要求把命令正文写进文档。
- 但本 run 的用户级约束明文要求「the docs must carry a re-runnable consistency command that makes 'doc number == measured number' a mechanical judgement」，即命令必须**落在文档里**可被后续维护者复制重跑，而不只是执行一次。
- **处置**：命令代码块落在 `docs/product/ai-skills.md` §11.8（它本来就是「维护约定与测试」节），因此**Task 3 的提交同时改了 `docs/product/ai-skills.md`**，超出 Task 3 声明的 `<files>`（`AGENTS.md`）。这是本次唯一的文件面超出，且是为满足更强的 run 级约束。
- **验证**：改动后重跑例数一致性命令仍 `cells=8` 且全部通过（命令代码块内的 `test-*.js` 词元不产生额外账本单元，已实测）；并把代码块**抽出来原样执行**，输出 `counts-parity ok` / `cells=8`（证明它是真的可重跑，而不是一段贴上去的说明文字）。
- **Files modified:** `docs/product/ai-skills.md`
- **Committed in:** `1fdfa15`（Task 3 提交的一部分）

**2. Task 1 的 `Artifacts` 表把「§11.8 三条套件例数刷新」列在 Task 1，而计划 Task 2 与 `must_haves` 又把它归「三处账本同一任务刷新」**

- 计划的 Task 1 artifact 写「§11.8 … + 三条套件例数刷新」，Task 2 又写「三处账本（§七 两条 + §11.8 三条 + `AGENTS.md` 测试行三条）必须在**同一个任务**里一起刷，避免两处漂移」。
- **处置**：按更具体的锁定决策（同一任务刷新 ⇒ 三处同源、不漂移）执行 —— 全部例数刷新集中在 **Task 2** 一次完成；Task 1 只做口径与记账形态（那三行在 Task 1 结束时仍是旧数字，Task 2 立刻刷为实测值，中间无任何提交点使旧数字被当成账本使用）。两处判据同源、无双份实现。

### Auto-fixed Issues

None —— 未发现需要自动修复的 bug / 缺失关键功能 / 阻塞。本计划不改源码与测试，全部为文档纠偏与账本同步；**无 Rule 3、无 Rule 4**（未新增依赖、未触碰架构决策面、未改任何 `LIMITS` 数值与九码值域）。

---

**Total deviations:** 0 auto-fixed；2 条计划内部张力的调和（同步文件的文件面归属、例数刷新的任务归属），无范围蔓延（改动仍只在计划声明的两个文件内）。
**Impact on plan:** 第 1 条是为满足 run 级约束而把命令落到文档，落点仍在计划声明的文件内、且实测不污染账本单元；第 2 条按「同一任务刷新」这条更具体的锁定决策执行，避免三处数字漂移。**未改动**任何源码 / 测试 / `LIMITS` 数值 / 九码值域 / `AGENTS.md` 的其它条目与同段的其它套件计数。

## Issues Encountered

- **命名空间的 80 字符窗口需要在设计时就算清楚**：49-03 的门禁用 `TD-48-01 / TD-48-02 / WR-02 / WR-06` 之后 80 字符内不得出现「已修 / 已闭合 / 已修复」做判据，而本轮新写的闭合句必须含「已闭合」。解法与计划一致 —— 把闭合动词放在**编号之前**（「已闭合的是 `49-REVIEW.md` 的 …」），且两个命名空间各占独立一行；改动前先跑基线、改动后重跑回归，两处输出均为通过标记。
- **「已完整闭合」不等于「已闭合」**：挂账句里原有的「也不声称失效链已完整闭合」不含 `已闭合` 子串（`已` 之后是 `完`），因此不会误触门禁 —— 已由第 5 条实跑确认，而非仅凭推理。
- **一致性命令的窗口设计需要实测反例支撑**：`AGENTS.md` 的 `- 测试：` 行是单条 800 字符长行、文件名→例数间距实测 96 / 125 / 258 字符；计划的 `<fails_when>` 已记录「固定 200 字符窗口版本在 `test-ai-skills.js` 的 258 字符间距下漏检」。本 run 用「单元右边界 = 下一个文件名」的设计消除了宽度依赖，并用**三个计数各自变异**实测证明（含间距最大的 `test-ai-skills.js`）。
- **变异脚本的锚点必须唯一且断言命中数**：三个变异各自先算 `original.split(old).length - 1 === 1` 才写盘，跑完按原内容逐字还原并复核 `restored byte-identical: true`（未用 `git checkout --` 还原 —— 那会连带回滚本任务尚未提交的其它改动）。
- 其余无。任务全程未走认证门禁、未遇阻塞；未使用 `--no-verify`；提交前均核对 `git status --short` 只暂存本任务声明的文件（工作树里 `.gitignore` / `.planning/state.json` 的既有未提交改动与 `.planning/milestone.lock` / `.planning/phases/47-bash/.review-diagnostics/` 两处未跟踪路径**全程未被触碰**）。

## User Setup Required

None - no external service configuration required.

## Known Stubs

None —— 本计划改动的两个文件均为文档，不存在「硬编码空值流向 UI / 占位文案 / 未接线的数据源」。

另外确认：全文中**未出现** `npm test`（两文件均 `(none)`）；`AGENTS.md` 的维护约定条目内**未复制**产品文档的示例串（`[seeded_protected]` 在 `AGENTS.md` 中出现次数 = **0**，只出现在 `docs/product/ai-skills.md` §11.3 的成文里）；本计划**未**把 `SKILL_THREAT_PATTERNS` 写成已实现（仍逐字保留「归 Phase 51」）。

## Threat Flags

None —— 本计划未引入 `<threat_model>` 之外的新安全相关面。纯文档改动，无网络端点、认证路径、文件访问模式或 schema 变更。逐条对照：T-49-06-01（陈旧声明 ⇒ 不可否认性）由 §11.7 / §11.8 的三处逐条纠正 + 可重跑断言（第 1 / 3 条命令）缓解；T-49-06-02（词缀成文被当成可携带任意文本的通道）由三条边界显式成文 + 「不改变安全边界」声明缓解；T-49-06-03（例数账本漂移）由三处同任务刷新 + 逐单元一致性命令 + 单点变异实测缓解；T-49-06-04（文档示例的信息披露面）按 `accept` 处置且实测示例只用公开枚举名 `[seeded_protected]`，未新增敏感示例；T-49-06-SC 无包管理器安装面。

## Deferred Items（记录、不在本计划处置）

1. **`49-REVIEW.md` 的 `WR-03`（成功文案偏离 UI-SPEC 权威清单）/ `WR-04`（净化类未覆盖 bidi 控制符）/ `IN-01`–`IN-06`**：不在本 run 范围内，已在 §11.8 的闭合句末尾明示「仍逐条挂账」。
2. **Phase 48 的 `TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06`**：五个全部**继续挂账**（`48-REVIEW.md` 与 `STATE.md:278-280` 仍是权威登记处）；本计划只补命名空间标记，**不声称闭合其中任何一项**。
3. **`syncAgentSystemPrompt()` 生产调用方的 ⚠️（本阶段只完成 3 分之 1）**：如实挂账（挂账句尾部）。
4. **`49-VALIDATION.md` 人工五步**：步骤①（卡片终态视觉面）在 49-05 落地后已具备通过条件；本计划不修改该步骤表（期望现象没错，错的是执行时机）。

## Next Phase Readiness

- **Phase 49 的 gap 计划（49-04 / 49-05 / 49-06）全部落地**：Gap 1（幽灵技能三条成因）、Gap 2（CR-01 卡片终态标记）、Gap 3（两条链路键集合 + truth #12/#13）与 WR-02 均已闭合；本轮文档面已与实现逐条一致。
- **可继续复用的机制**：① 例数一致性的**账本单元**判据（单元右边界由下一个文件名定界）—— Phase 50/51 增加测试行时直接沿用，不会因描述变宽而漏检；② 账本的**命名空间标记**纪律（裸编号必须带 `48-REVIEW` / `49-REVIEW`，且两个命名空间各占独立一行）；③ 文档携带可重跑命令（§11.8 的代码块）这一形态。
- **下一步建议**：`/gsd-verify-work 49` 复跑阶段验证（本轮闭合的三处 gap 真理 + 人工面），随后执行 `49-VALIDATION.md` 的人工五步（步骤① 现已具备通过条件）。
- **发布前必办（沿用既有台账，本计划未改变）**：生产包 `/Applications/Realm.app` 仍是 2026-09-10 构建，正式发布前必须重跑 `make install`。

---
*Phase: 49-manage-skill-ai*
*Completed: 2026-09-13*

## Self-Check: PASSED

**1. Modified files exist:**
```
FOUND: docs/product/ai-skills.md
FOUND: AGENTS.md
FOUND: .planning/phases/49-manage-skill-ai/49-06-SUMMARY.md
```

**2. Commits exist:**
```
FOUND: 59e38a5
FOUND: 2f64cab
FOUND: 1fdfa15
```

**3. Declared content present:**
```
docs/product/ai-skills.md: [seeded_protected] ×1（词缀成文，唯一落点）
docs/product/ai-skills.md: 49-REVIEW.md ×1（闭合声明句）・48-REVIEW ×1（挂账句命名空间标记）
AGENTS.md:                mergeManageSkillMarker ×2（维护约定条目内）
AGENTS.md:                [seeded_protected] ×0（未复制产品文档示例串）
```

**4. `commits:` 为实测值**（来源：`$(git rev-parse --git-dir)/gsd-plan-head-before-49-06` = `b7464c093131501de3352ac17454b003e759231c`）：
```
git rev-list --count b7464c09..HEAD  →  3
```

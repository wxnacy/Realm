---
phase: 47-bash
verified: 2026-09-11T14:43:20Z
status: passed
score: 113/113 must-haves verified (112 verified + 1 PASSED (override))
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/47-bash/47-01-PLAN.md"
  - ".planning/phases/47-bash/47-01-SUMMARY.md"
  - ".planning/phases/47-bash/47-02-PLAN.md"
  - ".planning/phases/47-bash/47-02-SUMMARY.md"
  - ".planning/phases/47-bash/47-03-PLAN.md"
  - ".planning/phases/47-bash/47-03-SUMMARY.md"
  - ".planning/phases/47-bash/47-04-PLAN.md"
  - ".planning/phases/47-bash/47-04-SUMMARY.md"
  - ".planning/phases/47-bash/47-05-PLAN.md"
  - ".planning/phases/47-bash/47-05-SUMMARY.md"
  - ".planning/phases/47-bash/47-06-PLAN.md"
  - ".planning/phases/47-bash/47-06-SUMMARY.md"
  - ".planning/phases/47-bash/47-CONTEXT.md"
  - ".planning/phases/47-bash/47-REVIEW.md"
  - "AGENTS.md"
  - "THIRD_PARTY_NOTICES.md"
  - "ai-bash-policy.js"
  - "ai-manager.js"
  - "builtin-skills-seeder.js"
  - "docs/product/ai-agent-workspace.md"
  - "docs/product/ai-skills.md"
  - "main.js"
  - "package.json"
  - "skills-builtin/find-skills/LICENSE.txt"
  - "skills-builtin/find-skills/SKILL.md"
  - "skills-builtin/skill-creator/LICENSE.txt"
  - "skills-builtin/skill-creator/SKILL.md"
  - "skills-builtin/skill-creator/scripts/check_env.mjs"
  - "tests/test-ai-bash-policy.js"
  - "tests/test-builtin-skills-seeder.js"
covered_digest: "v1:sha256:94eff34e9b432636c18c040cde5226df61f125394378dbb7dea65ab85e1d62e5"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Roadmap SC3 / Phase 47 goal clause 2：包管理器安装命令不再可能被白名单免确认"
    severity: blocker
    status: PASSED (override)
    reason: >-
      枚举形态（npx / npm i / pnpm add / pip install / brew install）与上一轮阻断的词法改写、
      第二绕过家族已全部闭合（本次 60 格矩阵 + 14 条改写形态实跑确认）；余下 CR-01（旗标取值槽吞
      末尾子命令：`npm -g update` / `npm --global rebuild` 等）与 CR-02（`audit` 与 `fix` 之间夹旗标：
      `npm audit --json fix`）两条残余，经 `git show 0bbb6c4:ai-bash-policy.js` 独立复跑确认
      **在阶段基线即存在、非本阶段回归**，已由三份文档具名披露（`docs/product/ai-agent-workspace.md`
      §五 / §七第 5 条附 ①②③、`docs/product/ai-skills.md` §九残余 (a)(b)(c)），并按 2026-09-11
      用户裁定记入 `47-REVIEW.md` 的 Disposition 技术债表，待后续阶段以 argv 级分词根治。
    note: >-
      用户 2026-09-11 二次确认「应用 override 收尾」。本 override 只接受该条普遍性表述，
      不改变其余 112 条 must-haves 的独立核验结论。本轮（第四次复验，`b703a6c` docs/test
      措辞 delta 后的 fingerprint 刷新轮）原样携带、**逐字未改**，未重新审议该裁定；
      本轮仍独立复核了其事实基础（见正文「override 事实基础的本轮复核」）。
    accepted_by: "wxnacy"
    accepted_at: "2026-09-11T22:30:00+08:00"
re_verification:
  previous_status: passed
  previous_score: 113/113 must-haves verified（112 verified + 1 PASSED (override)）
  gaps_closed:
    - "上一轮记录的非阻断观察项 #1（§五 / §九 开头的「两类具名残余」与残余段「三类」计数不一致、§九 指针少列 (c)）—— 已由 commit `b703a6c` 闭合：`docs/product/ai-agent-workspace.md:113` 改为「**三类**具名残余除外」并逐条点名三形态、指针补成 ①②③；`docs/product/ai-skills.md:176-179` 改为「但有**三类**具名残余」、指针补成 (a)(b)(c)；`tests/test-builtin-skills-seeder.js` 新增 **4 条钉住断言**（`:2149` 在场断言 / `:2153` 缺席断言 / `:2157` 在场断言 / `:2161` 缺席断言）。本轮自跑 `node tests/test-builtin-skills-seeder.js` → 101/101 全绿（4 条断言在 `DOC-02 文档同步` 组 `ok 15` 内实际执行），并逐字复核三形态零卡片结论均与代码一致"
    - "上一轮记录的非阻断观察项 #2（`ai-agent-workspace.md:132` 把残余 ② 一并归入「旗标取值槽」成因，与其真实机制不符）—— 亦由 `b703a6c` 闭合：两份文档改为「剩余部分与 **①** 同属**旗标取值槽**（**②** 成因不同：`audit` 守卫的负向先行断言只看向后**紧邻**位置、不跨越中间旗标）」，并附实测对照。本轮以「旗标位于 `audit` **前** vs **后**」对照实验独立复核该归属为真（`npm --json audit fix` → `confirm/install`；`npm audit --json fix` / `npm audit -s fix` → `allow`）"
  gaps_remaining: []
  regressions: []
advisory: []
---

# Phase 47: 内置技能播种 + bash 策略加固 Verification Report

**Phase Goal:** 随包分发的两个内置技能可用且不含任何"执行外部安装"语义；包管理器安装命令不再可能被白名单免确认。
**Verified:** 2026-09-11T14:43:20Z
**Status:** passed（112/113 独立核验 + 1 条 PASSED (override)）
**Re-verification:** **Yes — 第四次复验（fingerprint 刷新轮）**。上一轮 `47-VERIFICATION.md` 判 `passed` 113/113（其中 1 条 SC3 由用户裁定 override）；本轮的唯一动机是其后落地的 **docs/test 措辞 delta（commit `b703a6c`）** 使 `covered_digest` 失效，需在**同一份 32 路径清单**上重算内容指纹并独立复核该 delta 的真实性。
**模式:** RE-VERIFICATION（must_haves = ROADMAP 5 条 SC + 六份 PLAN 的 108 条 plan truths，与上一轮同一集合）

---

## 本次复验的范围与动机（为什么又跑了一遍）

**触发原因**：上一轮报告写完后落地的**唯一一组变更**是 commit **`b703a6c`**（「docs(47): 残余计数自洽 + 成因归属修正」）—— 它同时闭合上一轮报告的**两条非阻断观察项**（#1 计数自洽、#2 成因归属）。该 commit 改动了 4 个 covered 文件（2 份产品文档 + 1 个测试文件 + `47-REVIEW.md` 的追加处置补记），其中 `47-REVIEW.md` 的追加是上一轮 `covered_digest`（`6463adb5…`）计算**之后**发生的，故指纹失效，需在同一份 32 路径清单上重算。

**本轮独立确认的变更面**（`git log --oneline` HEAD = `b703a6c`；`git status --porcelain` 除本报告自身外仅剩未跟踪的 `.planning/milestone.lock` 与 `.planning/phases/47-bash/.review-diagnostics/`）：

| 状态 | 文件 | 内容 |
|------|------|------|
| 提交已改 | `docs/product/ai-agent-workspace.md` | ① §五 `:113`「**两类**具名残余除外」→ 逐条点名三形态（`npm -g update` 旗标+未知子命令 / `npm audit --json fix` audit 与 fix 夹旗标 / `npm -g update ls` 旗标取值与子命令不可区分）、计数改为「**三类**」、指针 `①②` → `①②③`；② 第 5 条附残余 ③ 段结尾的成因归属由「剩余部分与 **①②** 同属旗标取值槽」改为「与 **①** 同属旗标取值槽（**②** 成因不同：`audit` 守卫的负向先行断言只看向后**紧邻**位置、不跨越中间旗标 —— 实测 `npm --json audit fix` 仍正确判安装档，而 `npm audit --json fix` 判只读）」 |
| 同上 | `docs/product/ai-skills.md` | §九 `:176-179`「但有两类具名残余…段 (a)(b)」→「但有**三类**具名残余」（列举同三形态）、指针补成 `(a)(b)(c)`；`:230-235` 残余 (c) 段同一处成因归属修正（(b) 另属守卫相邻性），并附同一实测对照 |
| 同上 | `tests/test-builtin-skills-seeder.js` | `DOC-02 文档同步` 组新增 **4 条钉住断言**（`:2149` `**三类**具名残余除外` 必须在场；`:2153` `两类具名残余除外` 必须缺席；`:2157` `三类**具名残余` 必须在场；`:2161` `但有两类具名残余` 必须缺席） |
| 同上 | `.planning/phases/47-bash/47-REVIEW.md` | 追加「处置补记（2026-09-11 终次复验后）」表（+10 行，纯追加）—— 记录上述两条措辞修正为 **已修**，并登记 `ai-bash-policy.js:249` JSDoc 口径、文档只读枚举缺机械护栏、生产包未重建三项为技术债 / 发布前事项 |
| **未改动** | `ai-bash-policy.js` / `builtin-skills-seeder.js` / `ai-manager.js` / `main.js` / `package.json` / `skills-builtin/**` / `THIRD_PARTY_NOTICES.md` | 逐文件 `git diff --stat b703a6c~1 HEAD -- <file>` **均为空**、`git status --porcelain <file>` **均为空**（本轮逐文件核对，见下表） |

`git diff --stat b703a6c~1 b703a6c` = 恰好这 4 个文件 / **+36 −6**（其中 `.planning/…/47-REVIEW.md` +10 为纯追加、两份文档净 +11 −5、测试 +17）。**无任何代码文件、随包技能文件或打包配置被触及** —— 这是「本 delta 为 docs/test 措辞面」的机械证据。

`git diff --stat b703a6c~1 HEAD` 逐文件（全部为空 → 未改动）：

| 文件 | 变更行数 |
|------|----------|
| `ai-bash-policy.js` | 0 |
| `builtin-skills-seeder.js` | 0 |
| `ai-manager.js` | 0 |
| `main.js` | 0 |
| `package.json` | 0 |
| `skills-builtin/find-skills/SKILL.md` | 0 |
| `skills-builtin/skill-creator/SKILL.md` | 0 |
| `skills-builtin/skill-creator/scripts/check_env.mjs` | 0 |
| `THIRD_PARTY_NOTICES.md` | 0 |

**本轮重新自跑的部分**（不采信上一轮结论，也不采信 SUMMARY / commit message）：
1. `node tests/test-builtin-skills-seeder.js` → **101/101**（含 4 条钉住断言；`DOC-02 文档同步` 组为 `ok 15`）。
2. `node --test tests/test-ai-bash-policy.js` → **97/97**；全部 `tests/test-*.js` **19/19 文件全绿**（本轮仅此一次全量）。
3. CR-01 / CR-02 反例复现 + 文档反例 `npm -g update ls`（`evaluateBashCommand` **与** `matchInstall` **与** `matchesWhitelist` 三侧）。
4. **`npm --json audit fix` vs `npm audit --json fix` 归因对照**（本轮新增，用于核验新措辞的成因归属为真）。
5. SC3 枚举矩阵 60/60、词法改写家族 8/8、只读零误伤（按代码 `readOnlyRes` 逐条构造）、WR-01 白名单通配护栏。
6. 结构护栏机械复核：`PACKAGE_MANAGER_TOOL_MAP` 15 条目中**恰为** `npx` / `bunx` / `uvx` 的 `readOnlyRes.length === 0`（空只读清单不生成动词式正则）、全部正则**无空捕获组**、纵深优先四例非 null、pipx 动词限定双向。
7. 两份文档新措辞的**逐句真值核验**（`grep` 计数 + 三形态实跑 + 归因对照）。
8. `covered_digest` 重算两次（`gsd_run verification.fingerprint`，**同一份 32 个 covered_files**）→ 两次结果一致。

**独立取证声明**：本报告所有结论均由本次**自跑命令 / 自读源码 / 自读 git 对象**得出。上一轮 `47-VERIFICATION.md`、`47-REVIEW.md`、commit message 与各 SUMMARY 的每一条论断都被当作**待验证假设**。特别地，**本轮不采信 `b703a6c` 的 commit message 自述**（其正文含一段误粘的 `npm audit --json` 输出，见「本轮观察项」#3），只以 `git diff` 的实际内容为准。

**标注约定（本轮为最终刷新轮，如实划定取证边界）**：下方正文的**结论与表格结构逐字保留**自上一轮报告，其中的「**本轮**」/「**上一轮**」字样是**该证据被产出时**的轮次标记（前者的取证者 = 第三次复验 run 3，非本次）。本次第四次复验**独立重跑**的仅上面 #1–#8 八项；其余条目的本轮取证方式为 **① 零 diff 机械证（逐文件 `git diff b703a6c~1 HEAD` 为空、`skills-builtin/**` 与打包配置均未触及）+ ② 相关测试全绿（101/101、97/97、19/19 文件）** 的**递进核验**，**未逐条重跑**前轮的注入式实验（如 hermetic 夹具的 inode 幂等、五条 console 可见面、残留清扫、打包产物 asar 自解析）。这是「本轮 delta 完全不触及代码与随包文件」时合理的取证边界，而非省略核验：代码面零 diff 已由 `git diff` 逐文件确证。

---

## Verdict Summary

**阶段目标两句话均达成**（第二句以 `overrides[0]` 记录的形式达成）：

- **播种侧（SC1 / SC2 / SC4 / SC5）**：全绿。上一轮的三条 gap 与两轮文档面 warning gap **全部闭合**且复核无回退（inode/mtime 幂等、残留清扫后 loader 零幽灵、四条失败路径 console 可见、空目录自愈、21 文件零安装语义零命中、打包两侧 21 文件 + asar 清单在列、`THIRD_PARTY_NOTICES` 五要素齐备）。`b703a6c` 未触及任何播种侧代码或随包文件（逐文件 `git diff` 为空），本轮以**零 diff 机械证 + 测试全绿**完成递进核验。
- **bash 侧（SC3 / SEC-01）**：枚举面 60/60 全绿（本轮重跑），词法改写家族 8/8 已收回 install 档、只读零误伤按代码 `readOnlyRes` 逐条构造全 `null`、结构护栏（空只读清单不生成动词式正则 / 无空捕获组 / 纵深优先 / pipx 动词限定）本轮机械复算通过；余下 **CR-01（旗标取值槽吞末尾子命令）与 CR-02（`audit` 与 `fix` 之间夹旗标）** 两条零卡片残余本轮**逐条复现**，且在阶段基线 `0bbb6c4` 即存在（非本阶段回归）、已按 2026-09-11 用户裁定接受为技术债并由 `overrides[0]` 正式记入 → 该条表述按 `PASSED (override)` 计分。
- **文档面**：三份文档 + `AGENTS.md` 的**残余披露层**经逐句复核**与代码行为一致**。上一轮报告的两条**非阻断措辞观察项本轮均判定 CLOSED** —— 由 commit `b703a6c` 一次性闭合（#1 计数自洽「两类」→「三类」+ 指针补齐 + 4 条钉住断言；#2 残余 ② 的成因归属改为「守卫先行断言不跨旗标」并附实测对照）。本轮以「旗标在 `audit` **前** vs **后**」对照实验独立复核 #2 的新归属为真（`npm --json audit fix` → `confirm/install`；`npm audit --json fix` / `npm audit -s fix` → `allow`），并逐条确认新计数与新指针所举三形态**全部实测零卡片**。#2 的闭合使上一轮 `advisory` 的成因归属观察项归零；本轮另新增 **1 条纯记录性观察项**（`b703a6c` 提交信息正文误粘 `npm audit --json` 输出）与 1 条退役性观察项（`47-REVIEW.md` 历史正文的旧「两类」引用），**均不构成本阶段 must-have 的失败**、不改 status / score。

---

## SC3 的两种读法与采纳裁决

上一轮任务要求把两种读法都摆出来并明确采纳哪一个；本报告**保留该分析**并更新其结论。

### 读法 A（字面枚举 / Roadmap SC3 原文）

SC3 原文列举 `npx` / `npm i` / `pnpm add` / `pip install` / `brew install` 五条，并加括号「白名单不可越过」。
本轮重跑 6 条命令 × 10 种白名单配置的矩阵（`npx` / `npm *` / `npm` / `pnpm *` / `pnpm` / `pip` / `pip3` / `brew` / `brew *` / `*`）：

| 命令 \ 白名单 | npx | npm * | npm | pnpm * | pnpm | pip | pip3 | brew | brew * | * |
|---|---|---|---|---|---|---|---|---|---|---|
| `npx foo` | install | install | install | install | install | install | install | install | install | install |
| `npm i x` | install | install | install | install | install | install | install | install | install | install |
| `npm install x` | install | install | install | install | install | install | install | install | install | install |
| `pnpm add x` | install | install | install | install | install | install | install | install | install | install |
| `pip install x` | install | install | install | install | install | install | install | install | install | install |
| `brew install wget` | install | install | install | install | install | install | install | install | install | install |

（`install` = `level:'confirm'` + `reason:'install'`；**本轮实跑 60/60 无例外** → 读法 A 成立。）

### 读法 B（阶段目标第二句的普遍性表述）

阶段目标写的是「包管理器安装命令**不再可能**被白名单免确认」——无枚举限定词，是**普遍性**断言。本轮实跑反例矩阵（自跑 `node -e`，非复述任何文档）：

| 命令 | 实际语义 | 白名单 | `evaluateBashCommand` | `matchInstall` | `matchesWhitelist` |
|---|---|---|---|---|---|
| `npm -g update` | 升级全部全局包（取新代码 + 跑生命周期脚本） | `['npm']` | **`allow`（零卡片）** | `null` | `true` |
| `npm -q update` | 升级项目全部依赖 | `['npm']` | **`allow`** | `null` | `true` |
| `npm --prefix=./app update` | 升级该子项目依赖 | `['npm']` | **`allow`** | `null` | `true` |
| `npm --global rebuild` | 重跑依赖生命周期脚本 | `['npm']` | **`allow`** | `null` | `true` |
| `npm -g update ls` | 同上（`ls` 是包名） | `['npm']` | **`allow`** | `null` | `true` |
| `cargo -q update` / `gem --quiet update` | 更新 registry / 升级已装 gem | `['cargo']` / `['gem']` | **`allow`** | `null` | `true` |
| `npm audit --json fix` | npm 真的执行 fix 安装 | `['npm']` | **`allow`** | `null` | `true` |
| `npm audit -s fix` | 同上（`-s` 夹在中间） | `['npm']` | **`allow`** | `null` | `true` |
| `pnpm audit --json fix` / `pnpm audit --registry=https://x fix` | 同上 | `['pnpm']` | **`allow`** | `null` | `true` |
| 对照 `npm update -g` | 同一命令、旗标换位 | `['npm']` | `confirm/install` ✓ | 非 null | — |
| 对照 `npm -g install x` | 同一前缀、末尾有剩余 token | `['npm']` | `confirm/install` ✓ | 非 null | — |
| 对照 `npm audit fix` / `npm audit --fix` | 无中间旗标 | `['npm']` | `confirm/install` ✓ | 非 null | — |
| 对照 `npm --json audit fix` | 旗标在 **`audit` 之前** | `['npm']` | `confirm/install` ✓ | 非 null | — |

消费侧确认（决定「零卡片」是否为真）：`ai-manager.js:5651` `if (verdict.level === 'confirm')` —— `level === 'allow'` 时**不构造确认卡片、命令直接执行**（本轮重读源码确认，本阶段该文件零改动）。

### 采纳裁决（保留上一轮的读法 B + 原样携带用户裁定的 override）

1. **验证对象是阶段目标**，第二句是无枚举限定词的普遍性断言 → 上述反例使其在**读法 B** 下不成立，这一点不因 override 而改变。
2. **反例属同一目标类**：SC3 的靶心是「包管理器**安装**命令 + 白名单免确认」；`npm -g update` / `npm audit --json fix` 都会取新代码并跑安装生命周期，且都在白名单前缀命中时零卡片。
3. **触发前提是文档推荐的默认配置**（§五 推荐把裸 `brew` 等加入白名单），不是极端配置。
4. **不因「非本阶段引入」而把结论改判为「达成」**：基线 `0bbb6c4` 亦为 `allow`（本轮独立复跑确认），这只说明阶段**没有加剧**问题。
5. **但本报告如实记录决策者裁定**：2026-09-11 用户裁定「只修文档面、代码洞记技术债」，并在上一轮报告 frontmatter 记录 `overrides[0]`、二次确认「应用 override 收尾」。本轮**原样携带该 override**（`PASSED (override)`），不再重新审议其本身；SC3 因此计入通过分数，阶段 status 为 `passed`。

### override 事实基础的本轮复核（按任务要求独立验证，不重新审议裁定本身）

| 需复核的事实 | 本轮独立验证 | 结论 |
|---|---|---|
| CR-01 真实存在 | 自跑 `evaluateBashCommand('npm -g update', ['npm'])` → `allow`；`npm -g update ls` → `allow`（`matchInstall` 均 `null`、`matchesWhitelist` 均 `true`） | **成立** |
| CR-02 真实存在 | 自跑 `npm audit --json fix` / `npm audit -s fix` / `npm audit --audit-level=high fix` / `npm audit --omit=dev fix` / `pnpm audit --json fix` / `pnpm audit --registry=https://x fix` → 全部 `allow`、`matchInstall === null` | **成立** |
| 二者**不是本轮回归** | `git show 0bbb6c4:ai-bash-policy.js` → 独立复跑：两条残余在基线**同为 `allow`**；同批对照还确认基线 `npm update -g` / `npm audit fix` 亦为 `allow`（本阶段已把它们收回 install 档）→ 本阶段是**净改善**；另 `git log -S "不会吞掉子命令本身" -- ai-bash-policy.js` → 该 JSDoc 早于上一轮复验且此后未再改动 | **成立** |
| 文档已如实披露 | 逐句复核三份文档（见下节表格）；残余 (a)(b)(c) 均标「（零卡片）」并给出实测值与 `matchesWhitelist` 证据；三形态计数均为「三类」（本 run 之前立即合入的修正） | **成立** |
| 已记入 `47-REVIEW.md` 技术债表（**CR-01 / CR-02 两条**） | 实读 Disposition 节：CR-01/CR-02 在「零卡片类（安全相关，优先级最高）」表内，含复现命令与「改前 `0bbb6c4` 亦为 `allow`」备注 | **成立（限这两条）** |
| 自上一轮以来事实是否有变化 | `git diff --stat HEAD` 仅 3 文件（2 文档 + 1 测试），`ai-bash-policy.js` 零改动（`git status --porcelain ai-bash-policy.js` 为空）→ **代码行为无变化**；文档面变化仅使 §五/§九 的计数与指针更诚实 | **无变化** |

#### CR-01 与 CR-02 的机制定位实验（本轮新增的确定性证据）

两条残余**都是零卡片**，但根因不同 —— 本轮用「旗标位置」对照实验把二者分开（全部自跑 `node -e`）：

| 命令 | 旗标相对位置 | `matchInstall` | 定位结论 |
|---|---|---|---|
| `npm -g` | 只有旗标、无子命令 | `null` | 裸形式正则命中断点（本身正确） |
| `npm -g update` | 旗标**在**子命令前，子命令在段尾 | **`null`** | **① 旗标取值槽**：`-g` 的取值槽吃掉 `update` → 段内无剩余 → 裸形式 `\s*$` 命中 |
| `npm -g install list` | 旗标 + 安装动词 + 只读同名词 | `"npm 安装依赖"`（正确） | 纵深优先已收回 |
| `npm -g update ls` | 旗标取值槽吃 `update`，剩 `ls` | **`null`** | **③ 同一「旗标取值槽」机制**（值槽吃 `update`，`ls` 命中只读动词正则） |
| `npm audit fix` | 无中间旗标 | `"npm 安装依赖"`（正确） | 守卫负向断言命中 |
| `npm --json audit fix` | 旗标在 **`audit` 之前** | `"npm 安装依赖"`（正确） | 前置旗标不影响守卫 |
| `npm audit --json fix` / `npm audit -s fix` | 旗标**在 `audit` 与 `fix` 之间** | **`null`** | **② 守卫的负向先行断言只检查紧邻后缀**，不跨越中间旗标 |
| `pnpm audit -s fix` | 同上（pnpm 同形） | **`null`** | ② 在 pnpm 上同形 |

**结论**：①②③ 三条都真实零卡片，但 ① 与 ③ 同属**旗标取值槽**成因，② 属**守卫先行断言不跨旗标**成因。该区分是本轮新造的证据，用于核对文档的成因归属表述（见「本轮观察项」#1）。

---

## Goal Achievement

### Roadmap Success Criteria（合同层，5 条）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | **SC1** 首次启动后 `managed-skills/` 出现 find-skills 与 skill-creator，加载器零诊断识别 name/description；按单技能目录粒度同步（内容一致 → `detectDiff` 判 `same` → 零差异、零诊断、**重启不重复写**）；手改先产 `realm_builtin_seed_overwritten`（warning）再覆盖；手删后自愈重播；停用唯一语义是设置页禁用（`settings.aiSkills.disabled`），定制走 `skills/` 同名遮蔽 | ✓ VERIFIED | 上一轮**自建 hermetic 纵切**（真 `skills-builtin/` → `seedBuiltinSkills()` → 真 `createSandboxEnv` + `refreshSkills()`）：技能集恰为 `find-skills` / `skill-creator`、`source` 均 `'managed'`、`snapshot.diagnostics === []`、`snapshot.errors === []`、`buildSkillsPrompt() === ''`；两个 `LICENSE.txt` 与 `skill-creator/scripts/check_env.mjs` 均落盘；连续两轮播种 `SKILL.md` inode **171163848→171163848**、目录 inode **171163847→171163847**、mtime 不变、诊断与 console 输出均空；手改 → `console.warn` 出 `realm_builtin_seed_overwritten` 且字节还原为随包版；手删 `skill-creator/` → 重播成功且**零**覆盖诊断。**本轮复核**：`builtin-skills-seeder.js` / `main.js` / `agent-workspace.js` 零改动（`git diff` 空），播种测试 **101/101** 全绿（本轮实跑），`settings.aiSkills.disabled` 三处消费（`ai-manager.js:850/2519/2575`）实读仍在位 |
| R2 | **SC2** 内置技能全文不含 `npx` / `npm i` / `curl \| sh` / `-y` / `-g` 等「执行外部安装」语义；find-skills 只输出候选清单并引导用户到设置页一键导入 | ✓ VERIFIED | 本轮**重跑自写宽口径扫描**遍历 `skills-builtin/**` 全部 **21 文件**：20 组模式（`npx` / `npm i|install|ci|exec|add` / `pnpm` / `yarn` / `bunx` / `uvx` / `pip install` / `pipx` / `cargo install` / `gem install` / `curl` / `wget` / `--global` / `-g` / `-y` / `skills add` / `npx skills` / `brew install` / `go install` / `apt*`）**全零命中**；`install` 字样**11 行**逐行复核：6 行为标识符 `installGuidance`，2 行为**禁止安装**声明（`check_env.mjs:509` `Do not auto-install dependencies from this skill.`；`SKILL.md:56` `Do not run installers yourself`）+ 引用该禁令，`SKILL.md:53` 为 `installGuidance` 字段说明，`SKILL.md:62` 为上游散文（"parents and grandparents to google how to install npm" —— 描述终端用户，非对模型的指令）→ 无一条构成「执行外部安装」语义；find-skills `SKILL.md:3` description 为中文、正文首段为显式禁令、安装指路「设置 → AI → 技能管理 → 导入」 |
| R3 | **SC3** `npx` / `npm i` / `pnpm add` / `pip install` / `brew install` 无论是否在白名单内，执行前都必须弹出确认卡片（白名单不可越过） | **PASSED (override)** | 字面枚举 60/60 成立；普遍性表述被 9 条实测零卡片反例证伪（同上节）。CR-01/CR-02 在阶段基线即存在、非本阶段回归、用户已裁定接受为技术债 → 由 `overrides[0]` 记为 `PASSED (override)`，计入通过分数（112 + 1 = 113） |
| R4 | **SC4** 技能自带 `scripts/` 可在沙箱内经既有 bash 工具执行（复用既有白名单 + 确认卡片，零新增权限机制） | ✓ VERIFIED | 本轮实读 `DANGEROUS_INTERPRETERS` = `Set{sh,bash,zsh,dash,eval,source,osascript,python,python3,node,ruby,perl}`（含 `node`/`python3` 未放宽）→ 本轮实跑 `evaluateBashCommand('node scripts/check_env.mjs', ['node'])` = `confirm/danger`（`dangerNames:["解释器执行（node）"]`，每次都弹卡）；`agent-workspace.js` / `ai-skills-manager.js` **整阶段零 diff**（零新增权限机制的机械证据） |
| R5 | **SC5** 打包后正式 .app 中两个内置技能可被正确加载（`asarUnpack` + `app.isPackaged` 路径分支生效），且 `THIRD_PARTY_NOTICES` 记录来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明 | ✓ VERIFIED（验证载体 = Nightly，见下注） | 本轮回归复核：`dist/mac-arm64/Realm Nightly.app` 与 `/Applications/Realm Nightly.app` 的 `app.asar.unpacked/skills-builtin/` **各 21 文件**；`package.json` `build.asarUnpack = ["node_modules/nodejieba/**","skills-builtin/**"]`、`build.files` **11 条全部 `!` 前缀**、无条目命中交付物（上一轮实读，本 delta 未触及 `package.json`）；opt-in 打包断言组本轮重跑 `REALM_PACKAGED_VERIFY=1 node tests/test-builtin-skills-seeder.js` → **105 pass / 0 fail / 0 skipped**（含 `isPackaged:true`、缓存诊断为空、`buildSkillsPrompt()===''`、幂等 + 自愈 4 条进程内断言）；运行期 `~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/{find-skills,skill-creator}/SKILL.md` 实存；`THIRD_PARTY_NOTICES.md`（8,967 B）§1/§2 五要素齐备且**都标 `modified`**（find-skills `773fb2c7…` MIT；skill-creator `b0cbd3df…` Apache-2.0，许可证副本 11,357 B） |
| | ⤷ **载体说明（如实记录，非 gap）** | ℹ️ | 生产 bundle `/Applications/Realm.app` 仍是 **2026-09-10 的上一版构建**（本轮重新自解析 asar 头部：`skills-builtin: false`、`THIRD_PARTY_NOTICES.md: false`，且仍含 `.planning` / `tests`；unpacked 侧 `skills-builtin` 文件数 **0**）—— 本阶段**未重建生产 bundle**。ROADMAP §Phase 47 的 47-04 条目明文记载「Task 3 经**用户显式授权**走 Nightly 路线（`make install-nightly`，**不触碰生产 bundle**）」，且两目标共用同一份 `build.asarUnpack` / `build.files` 配置。故 SC5 按其被授权的验证载体判 VERIFIED；**发布前需重跑 `make install`** 才能把 SC5 的证据链延伸到生产 .app（发布流程事项，非本阶段交付缺口） |

#### Plan Truths — 47-01（18 条，`requirements: [SEED-01, SEED-02, SEED-03, SEED-04]`）

> 本 delta 未触及 47-01 的任何交付物（`builtin-skills-seeder.js` / `main.js` / `skills-builtin/**` 零 diff）。下表结论沿用上一轮的独立实跑，并在本轮以测试全绿 + 源码行号在位复核完成递进核验。

| # | Truth（缩写） | Status | Evidence |
|---|--------------|--------|----------|
| 1 | 首启后 `managed-skills/find-skills/SKILL.md` 存在，`refreshSkills()` 零诊断识别 `name==='find-skills'` | ✓ VERIFIED | 上一轮 hermetic 纵切：`{name:'find-skills', source:'managed'}`、`diagnostics=[]`、`errors=[]` |
| 2 | `disable-model-invocation: true` → `buildSkillsPrompt() === ''` | ✓ VERIFIED | 上一轮实跑 `buildSkillsPrompt() === ""`；本轮实读两技能 frontmatter 第 4 行均为 `disable-model-invocation: true` |
| 3 | find-skills `description` 中文、正文中文 | ✓ VERIFIED | 本轮实读 `SKILL.md:3` 中文 description（含触发场景）、正文中文 |
| 4 | `skills-builtin/**` 对禁用模式零命中、无 `npx skills` 变体 | ✓ VERIFIED | 本轮 20 组模式 × 21 文件全零命中（见 R2） |
| 5 | 播种按单技能目录粒度判定，不为已存在技能提前返回 | ✓ VERIFIED | `builtin-skills-seeder.js:456` `for (const name of names)` 逐名循环；循环内无整目录判定/提前 return |
| 6 | 无条件覆盖 + 不一致时先产 warning 再覆盖 | ✓ VERIFIED（精度化） | `:465` `diff === 'same' → continue`（不写盘、不诊断）→ `:466-476` `different` 先 push warning → `:478` `safeCopyDir`；「内容一致时不写盘」是 ROADMAP SC1 括号内的明文要求（47-06 据此精确化 D-08），`different` / `missing` 覆盖语义未变 |
| 7 | 原子目录替换（tmp → rename → bak 回滚，不留半成品） | ✓ VERIFIED | `:326-351` 完整回滚链实读；测试用只读父目录触发失败路径且通过（本轮 101/101 内含） |
| 8 | 差异检测不用 mtime，按「路径集合 → size → sha256」短路 | ✓ VERIFIED | `:186-188` 两处显式护栏注释；三层短路见 `:193-211`；测试含「剥离注释后不得出现 mtime/mtimeMs/birthtime」（本轮全绿） |
| 9 | `detectDiff` 遇 IO 错误返回 `'different'` + `console.error` + 不抛 | ✓ VERIFIED | `:212-216` 实读 |
| 10 | 同一 `detectDiff` 内每文件至多算一次 sha256 | ✓ VERIFIED | size 层（`:201-205`）先于 hash 层（`:206-210`）短路 |
| 11 | `realm_builtin_src_invalid` 控制流真实可达 | ✓ VERIFIED | `collectInvalidSrcDirs` 在 `:427` 调用，早于 `getSeededSkillNames()`（`:437`）；上一轮注入缺 `SKILL.md` 的子目录 → 该 code 实产且走 `console.error` |
| 12 | 播种不依赖 `migrateAiMemory()` 成功（两次独立调用、各自 try/catch） | ✓ VERIFIED | `main.js:4043` / `:4048` / `:4051` 三步位序实读；seeder 自带外层 try/catch（`:424` / `:489`） |
| 13 | `safeCopyDir` 源不存在提前返回不抛错；源缺失时 `getSeededSkillNames()` → `[]` + `realm_builtin_src_missing` | ✓ VERIFIED | 上一轮注入 `/nonexistent-src-xyz`：不抛、`console.error` 有 `realm_builtin_src_missing`、结构化诊断同码 |
| 14 | ROADMAP §Phase 47 判据 1 已改写，不再含「版本戳登记表」 | ✓ VERIFIED | `grep -c "版本戳登记表" .planning/ROADMAP.md` → **0** |
| 15 | 手删后自愈重播；`getSeededSkillNames()` 只反映随包目录名集合 | ✓ VERIFIED | 上一轮删 `skill-creator/` 后重播成功且零覆盖诊断；`getSeededSkillNames()` 实返 `['find-skills','skill-creator']`（源码无硬编码名单：`:92-107` 扫目录名） |
| 16 | 播种整体失败不阻断启动：**任何异常走 console.error + 产诊断，不 throw** | ✓ VERIFIED | 上一轮五条路径全部重跑：`realm_builtin_src_missing` / `realm_builtin_src_invalid` / `realm_builtin_seed_failed`（symlink 拒收）→ `console.error` + 结构化诊断；`realm_builtin_seed_overwritten` → `console.warn`（error 通道干净）；顶层 catch（managedDir 中间路径组件是文件 → `ENOTDIR`）→ **不抛**、`console.error` 含「内置技能播种失败（不影响启动）」**且** `getSeedDiagnostics() === []`（证明该输出只可能来自 catch）；干净首播两条通道均零输出 |
| 17 | `app.isPackaged` → `process.resourcesPath/app.asar.unpacked/skills-builtin`，开发态回落 `__dirname/skills-builtin` | ✓ VERIFIED | `:60-67` 实读 + `package.json` asarUnpack 成对；打包产物两侧实证（见 R5）；opt-in 断言组本轮在打包态进程内重跑确认 |
| 18 | `skills-builtin/` 遍历遇 symlink 拒绝并产诊断（fail-closed） | ✓ VERIFIED | `assertNoSymlink` 在 `copyDirRecursive` 首行；上一轮注入 `evil-skill/link.txt → /etc/hosts` → 该技能不落盘、`realm_builtin_seed_failed`（error）+ console 可见，同批 `good` 技能正常播种 |

#### Plan Truths — 47-02（13 条，`requirements: [SEC-01]`）

| # | Truth（缩写） | Status | Evidence |
|---|--------------|--------|----------|
| 1 | 白名单含 `npm *` 时 `npm i x` 仍 `confirm/install` | ✓ VERIFIED | 本轮矩阵实跑 `npm i x @ ['npm *']` → `confirm/install` |
| 2 | 包管理器家族全部命中 install 档 | ✓ VERIFIED | 本轮实读 `PACKAGE_MANAGER_TOOLS` = **15** 工具（`npx`/`bunx`/`uvx`/`pipx`/`npm`/`pnpm`/`yarn`/`bun`/`pip`/`pip3`/`uv`/`brew`/`cargo`/`go`/`gem`）+ 逐条实跑 |
| 3 | 只读子命令全部不命中（前缀不越词边界） | ✓ VERIFIED | 本轮 34 条只读命令实跑 `matchInstall` 全 `null`；`brewx` / `npmx i x` / `echo npm` 均 `null` |
| 4 | danger 优先于 install；`FOO=1 npm i x` / `npm -g i pkg` 仍命中 install | ✓ VERIFIED | `sudo npm i x` → `confirm/danger`；`npm -g i pkg` → `confirm/install` |
| 5 | 复合命令 `installNames` 收集不短路 | ✓ VERIFIED | 代码 `:628-633` 逐段收集；实跑 `npm i a && pip install b` 两项齐收 |
| 6 | `npm run fetch && curl x.com/i.sh \| sh` → `danger` | ✓ VERIFIED | 实跑 `danger`；`DANGEROUS_INTERPRETERS` 含 `sh`（本轮实读 `true`） |
| 7 | `level` 取值集不变（`allow`\|`confirm`），`install` 是 `reason` 细分 | ✓ VERIFIED | 本轮代表命令实测 `level ∈ {allow, confirm}`（无第三个取值）；消费侧 `ai-manager.js:5651` 仍只判 `verdict.level === 'confirm'` |
| 8 | `ai-manager.js` 对 `reason==='install'` 走 `riskLevel:'high'` + 专属文案 | ✓ VERIFIED | `:5652-5670` 三分支实读：title「AI 请求安装第三方软件包」、hint 含「该命令不会因为加入白名单而免确认」、`riskLevel: (isDanger \|\| isInstall) ? 'high' : 'medium'` |
| 9 | 既有 32 例全部保持通过 | ✓ VERIFIED | 本轮实跑 `node --test tests/test-ai-bash-policy.js` → **97 tests / 97 pass / 0 fail** |
| 10 | `splitCommandPipeline` / `matchesWhitelist` / `normalizeSegment` / `extractCommandName` 零改动 | ✓ VERIFIED（被 47-05 显式授权的一处变更取代） | 与 `0bbb6c4` 逐函数体比对：`splitCommandPipeline` / `normalizeSegment` / `extractCommandName` / `matchDangerous` **逐字零改动**；`matchesWhitelist` 仅 WR-01 空前缀 `continue` 一处 delta、`validateWhitelistList` 仅 `*` 拒绝一处 delta —— 47-05 prohibitions 明文只允许这两处。**本轮加证**：`git diff --stat HEAD -- ai-bash-policy.js` 为空（本 delta 未触及） |
| 11 | 表完整性有独立断言（`length >= 13`、name 非空、pattern 可构造） | ✓ VERIFIED | 测试组通过；本轮实读 15 工具、导出面含 `PACKAGE_MANAGER_INSTALL_PATTERNS` / `matchInstall` / `PACKAGE_MANAGER_TOOLS` / `PACKAGE_MANAGER_TOOL_MAP` |
| 12 | `evaluateBashCommand` 生产消费点只有 `ai-manager.js` 一处 | ✓ VERIFIED | 全仓 grep：生产代码仅 `ai-manager.js:5647`；`main.js:1377` 只调 `validateWhitelistList` |
| 13 | `PACKAGE_MANAGER_INSTALL_PATTERNS` 的 JSDoc 含三处代码内注释 | ✓ VERIFIED | `:211-260` 实读 ①危险/安装语义分离 ②`curl\|sh` 不入表（死模式）理由 ③匹配粒度 ④`npm ci` 理由 ⑤维护约定 ⑥表内顺序即优先级 |

#### Plan Truths — 47-03（18 条，`requirements: [SEED-01, SEED-03, SEED-04, SEED-05, SKILL-09]`）

> `skills-builtin/**` 本 delta 零 diff（21 文件哈希不变，见 `covered_digest` 重算）。下表结论沿用独立核对，本轮以宽口径扫描重跑与 `THIRD_PARTY_NOTICES` 实读完成递进核验。

| # | Truth（缩写） | Status | Evidence |
|---|--------------|--------|----------|
| 1 | `skill-creator/SKILL.md` 逐字节等于上游除六处受控改动 | ✓ VERIFIED | 上一轮已与固定 SHA 上游全文 diff 核对；本轮复核结果态（描述中文化 + `disable-model-invocation` + 修改声明 + `Environment Preflight` 齐备） |
| 2 | 上游 frontmatter 只有 name+description，须补 `disable-model-invocation` | ✓ VERIFIED | 本地第 4 行实读该字段 |
| 3 | description 中文化、正文英文 | ✓ VERIFIED | description 中文；正文无 CJK |
| 4 | 上游 `agents/` 3 文件随包 | ✓ VERIFIED | 三文件在位，字节 **10376 / 7287 / 9049**；本轮 unpacked 目录 21 文件计数含之 |
| 5 | 删三章判据是功能正确性 | ✓ VERIFIED | 三章标题与 `present_files` 相关指引零命中（本轮 grep 复核） |
| 6 | `LICENSE.txt` 为上游 Apache-2.0 全文逐字副本，播种后随目录落盘 | ✓ VERIFIED | `wc -c` = **11357**（skill-creator）；`find-skills/LICENSE.txt` = **1063**（Realm 补录 MIT）；播种纵切断言 LICENSE 落盘 |
| 7 | `check_env.mjs` 存在、`node --check` 通过、无参退出 0、输出含 `ok` + `capabilities` 的可解析 JSON | ✓ VERIFIED | 上一轮实跑：`node --check` OK；exit **0**；JSON `ok:true` / `code:'ok'` / `python.version 3.12.12` / `capabilities.catalog` 4 组 / `installGuidance:[]`；本轮该文件零 diff |
| 8 | ②④ 两处新增正文必须英文撰写 | ✓ VERIFIED | 两处均英文；正文 CJK = 0 |
| 9 | `## Reference files` 清单与实际随包文件集逐项一致 | ✓ VERIFIED | 测试 `:1298` 逐项核对通过（本轮 101/101 内含）；清单含 `scripts/check_env.mjs` + 9 个 py + `references/schemas.md` + `assets/eval_review.html` + `eval-viewer/*` + `LICENSE.txt` |
| 10 | 18 个上游文件先全部落地逐字节核对，之后才改 SKILL.md | ✓ VERIFIED（按结果态判定） | 17 表内文件 + `SKILL.md` 与上游对齐；过程顺序不可回溯 |
| 11 | `check_env.mjs` 支持 `REALM_SKILL_CREATOR_PYTHON`；缺依赖输出 `missing_dependency` + `installGuidance` 含「不自动安装」 | ✓ VERIFIED | 本轮实读 `installGuidance` 逐字含 `Do not auto-install dependencies from this skill.`（`:509`） |
| 12 | 未知 `--capability` 返回错误而非静默忽略 | ✓ VERIFIED | 代码分支实读 + 测试 |
| 13 | `skills-builtin/**/SKILL.md` 与两个 `LICENSE.txt` 对零安装语义扫描零命中 | ✓ VERIFIED | 本轮宽口径扫描覆盖全部 **21** 文件零命中（含两个 LICENSE） |
| 14 | `THIRD_PARTY_NOTICES.md` 两技能各记五要素且都标 `modified` | ✓ VERIFIED | §1/§2 实读：来源仓库 URL、固定 SHA、许可证、`是否修改 = 是（modified）`、修改说明 + 许可证副本路径 |
| 15 | 两个固定 SHA 与实测一致且不是 HEAD | ✓ VERIFIED | find-skills `773fb2c7bbf16781670a3520affc4abd0c6151ae`（2026-07-10）、skill-creator `b0cbd3df1533b396d281a6886d5132f623393a9c`（2026-03-06） |
| 16 | 如实记录三处易错事实 | ✓ VERIFIED | §3 三处齐备（find-skills 上游根无独立 LICENSE / `ThirdPartyNoticeText.txt` 不随包 / `anthropics/skills` 无仓库级 LICENSE） |
| 17 | `skills-builtin/skill-creator/**` 19 文件体积与上游逐一对得上 | ✓ VERIFIED | 表内 17 文件逐字节相同；`SKILL.md` **32,672 B**（区间护栏 30000–40000 内） |
| 18 | SKILL-09 机械证据：`DANGEROUS_INTERPRETERS` 含 `node`/`python3` 未放宽 | ✓ VERIFIED | 本轮实读 `Set{…,python,python3,node,…}`；实跑 `node scripts/check_env.mjs` → `confirm/danger` |

#### Plan Truths — 47-04（18 条，`requirements: [SEED-05, DOC-02]`）

| # | Truth（缩写） | Status | Evidence |
|---|--------------|--------|----------|
| 1 | 打包产物 `app.asar.unpacked/skills-builtin/` 存在且含两个 `SKILL.md` | ✓ VERIFIED | 本轮 `find`：dist 与 /Applications 两个 Nightly.app **各 21 文件**、两技能齐备 |
| 2 | 启动该 .app 后 `realm-nightly/.../managed-skills/` 出现两技能目录，加载器零诊断 | ✓ VERIFIED | userData 实测两技能齐备（含 LICENSE/scripts）；**进程内加载面**由本轮重跑的 opt-in 打包断言组覆盖（105 pass / 0 fail，含 `isPackaged:true`、`_cache` 诊断/错误为空、`buildSkillsPrompt()===''`、幂等 + 自愈） |
| 3 | asar 清单不再包含 `.planning/**` | ✓ VERIFIED | 自解析 asar 头部 JSON：Nightly 两者均 `.planning: false`；不含 `PITFALLS` |
| 4 | 清单同时不含 `test/**`、`tests/**`、`scripts/**`、`*.bak` | ✓ VERIFIED | 自解析：`tests: false`；opt-in 断言组逐目录计数为 0 且 `*.bak` 条目为 0 |
| 5 | 仓库根审查结论（`.github/` 不存在、`node_modules/.cache/` 默认排除、`dist/` 是输出目录） | ✓ VERIFIED | asar 内含 `docs/**`、`AGENTS.md`、`THIRD_PARTY_NOTICES.md` 等应随包项 |
| 6 | `build.files` 每一项都以 `!` 开头（无正向 allowlist），有机械断言 | ✓ VERIFIED | 上一轮实读 `package.json` **11 条全部 `!` 前缀**；测试断言组通过；本 delta 未触及 `package.json` |
| 7 | 无排除项命中 `skills-builtin/**` 或 `THIRD_PARTY_NOTICES.md` | ✓ VERIFIED | 上一轮逐条路径段断言 hits 为空；asar 实测两者在列（本轮重解析确认） |
| 8 | `make install-nightly` 不覆盖 `build.asarUnpack`（假设 A2） | ✓ VERIFIED | unpacked 面同时含 `node_modules/nodejieba/` 与 `skills-builtin/`（整段继承的直接证据）；opt-in 断言通过 |
| 9 | Nightly 的 asar 清单与 unpacked 目录两侧都被确认含 `skills-builtin/**` | ✓ VERIFIED | 自解析 asar：`skills-builtin: true`、`THIRD_PARTY_NOTICES.md: true`；unpacked 各 21 文件 |
| 10 | 运行期 userData 路径为 `realm-nightly`（不是 realm-dev / realm） | ✓ VERIFIED | 实读该路径存在且两技能齐备；opt-in 断言含 `includes('/realm-nightly/')` 守卫 |
| 11 | `build.files` 排除项不波及 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` | ✓ VERIFIED | 同 #7（asar 实测 + 机械断言双证） |
| 12 | `docs/product/ai-skills.md` 新增「内置技能」「bash 包管理器安装档」两章，编号八与九，既有七节零改动 | ✓ VERIFIED | `grep "^## "`：一…七 → 八 → 九，无错序；测试含章序位置断言（本轮 101/101 内含）。**本 delta 对 §九开头一段的计数/指针措辞作最小修正，未改章结构** |
| 13 | `ai-agent-workspace.md` §四 第三档补「或包管理器安装表」+ 新增「两个触发源」小节；§五 复核 `brew` 例子；§七 新增第 5 条（既有 4 条一字不动） | ✓ VERIFIED | 本轮实读 §四 三档表含「危险命令表**或**包管理器安装表」（`:69`）、§四「强制确认档的两个触发源（互不包含）」（`:73-80`）；§七 第 1–4 条原样 + 第 5 条（含五条具名残余附 `:129-135`）。**本 delta 只改 §五 `:113` 一句** |
| 14 | `AGENTS.md` 的 Bash 三档段改写为「强制确认 —— 两个互不包含的触发源」并点名家族清单；测试行计数改为实跑值 | ✓ VERIFIED | `AGENTS.md:267` 实读「策略引擎，**97 例**」「沙箱/迁移，**21 例**」与**本轮实跑（97 / 21）完全一致**；`:269` 播种 bullet 已更新为 D-08 语义、清扫正则为单反斜杠 `/\.(tmp\|bak)_\d+$/`（WR-04 已修） |
| 15 | 三份文档口径一致：沿用「三档权限」框架（`level` 只有 `allow`/`confirm`），不出现「四档」 | ✓ VERIFIED | 本轮 `grep -c "四档"` 三文件均为 **0** |
| 16 | 文档明确写出「技能不构成额外权限」与「`allowed-tools` 当前运行时不被强制，仅供参考」 | ✓ VERIFIED | `ai-agent-workspace.md:136`（§七第 6 条）、`ai-skills.md`（第五/六节）、`AGENTS.md:270` 三处齐备（各 1 处 `allowed-tools` 命中） |
| 17 | 文档写明内置技能自愈式播种语义、seeded 身份来源、不能删改只能禁用、定制走 `skills/` 同名遮蔽 | ✓ VERIFIED | `ai-skills.md` §八 与 `AGENTS.md:269` 实读含全部四点 |
| 18 | 文档写明技能脚本执行的确认成本（`node`/`python3` → 每次都弹卡） | ✓ VERIFIED | `ai-skills.md:214-215`「技能脚本执行的确认成本」条实读；与 R4 的行为一致（本轮实跑 `confirm/danger`） |

#### Plan Truths — 47-05（25 条，`gap_closure: true`，`requirements: [SEC-01, DOC-02]`）

| # | Truth（缩写） | Status | Evidence（全部自跑 `node -e`；标 ★ 者本轮重跑确认） |
|---|--------------|--------|----------|
| 1 | `brew "install" wget` @ `['brew']` → `confirm/install` | ✓ VERIFIED | → `confirm/install ["Homebrew 安装包"]` |
| 2 | `brew \install wget` @ `['brew']` → `confirm/install` | ✓ VERIFIED | → `confirm/install` |
| 3 | `brew ins""tall wget` @ `['brew']` → `confirm/install` | ✓ VERIFIED | → `confirm/install` |
| 4 | `npm "install" x` / `npm \i x` @ `['npm']` → `confirm/install` | ✓ VERIFIED | 两条均 `confirm/install ["npm 安装依赖"]` |
| 5 | `pip "install" x` / `cargo "install" ripgrep` / `bun "add" x` → `confirm/install` | ✓ VERIFIED | 三条均 `confirm/install`（词法改写家族 8/8 零例外） |
| 6 | `npm update` / `npm rebuild` @ `['npm']` → `confirm/install` | ✓ VERIFIED ★ | 本轮重跑：两条均 `confirm/install`（基线均 `allow`） |
| 7 | `yarn workspace app add lodash` @ `['yarn']` → `confirm/install` | ✓ VERIFIED | → `confirm/install`（基线 `allow`） |
| 8 | `cargo add serde` / `go get github.com/x/y` → `confirm/install` | ✓ VERIFIED | 两条均 `confirm/install`（基线 `allow`） |
| 9 | `brew cask install wget` @ `['brew']` → `confirm/install` | ✓ VERIFIED | → `confirm/install`（基线 `allow`） |
| 10 | 判定规则是**默认拒绝**（首 token 命中工具集 → 除非命中该工具的显式只读清单，否则强制确认） | ✓ VERIFIED | 本轮实读 `matchInstall` 分支 `:583-593`：工具命中 → 纵深表 → 只读正则 → 否则返回家族名；`npm runx`（未收录子命令）由基线 `null` 变 `"npm 安装依赖"`（计划声明的设计性变更） |
| 11 | 工具集覆盖 ≥15 项；`bunx cowsay hi` @ `[]` 与 `pipx install black` @ `[]` → `confirm/install` | ✓ VERIFIED | 本轮实读 **15** 工具（名称逐一列出）；两条实跑 `confirm/install` |
| 12 | 共用词法归一化 `stripShellQuoting`（先去反斜杠转义，再去引号） | ✓ VERIFIED | `:360-364` 实读；导出面含 `stripShellQuoting`；实跑三条改写形态均归一为 `brew install wget` |
| 13 | **空只读清单的工具不得生成动词式只读正则**（结构判据） | ✓ VERIFIED | 实跑：`npx`/`bunx`/`uvx` 的 `readOnlyRes.length === 0`；遍历全部条目断言**无空捕获组 `()`** → 通过（`PACKAGE_MANAGER_TOOL_MAP` 构造里 `if (verbs.length > 0)` 护栏实读） |
| 14 | **纵深优先**：只读豁免不得降级纵深表能识别的形态 | ✓ VERIFIED ★ | 本轮重跑 `matchInstall`：`npm -g install list` / `npm --global install ls` / `brew --quiet install info` / `pipx --quiet install list` 全部非 null；代码顺序 `:585-589`（先纵深表后只读） |
| 15 | **只读条目只在其全部形态都只读时才可整词豁免**（`npm init` / `audit fix` 形态化） | ✓ VERIFIED ★ | 本轮重跑：`npm init` / `npm audit` / `npm audit --json` → `null`；`npm audit fix` / `npm audit --fix` → 非 null；`npm -g update ls` @ `['npm']` → `allow`（**残余 ③，见 overrides**）；`pnpm create x` / `yarn create x` → 非 null |
| 16 | **生命周期别名与 `test` 同族同判据**，且「pnpm/yarn/bun 同类别名不收录」的取舍写进 JSDoc + SUMMARY + 三份文档 | ✓ VERIFIED | 实跑：`npm start`/`stop`/`restart`/`run-script` 四条 `matchInstall === null`；`pnpm start` @ `['pnpm']` → `confirm/install`（具名保守误报）；JSDoc ⑦（`:404-408`）与两份文档残余 (e)/第 5 条齐备 |
| 17 | **纵深层的条目不得遮蔽它自己的只读清单**（pipx 条目动词限定） | ✓ VERIFIED | 实跑：`matchInstall('pipx list')` = `null`、`matchInstall('pipx install black')` = `'包执行器（pipx）'`；条目含动词表非裸形态 |
| 18 | **残余已知并具名**（`npm -g update ls` → `null`、`npm -g install list` → 非 null，两侧同时断言；写进 JSDoc 与三份文档） | ✓ VERIFIED（计数/指针不齐已由本 run 之前合入的修正闭合） | 测试 `:847` 与 `:843-848` 两侧对照断言存在且本轮通过；JSDoc ⑤（`:395-399`）齐备；`ai-skills.md` §九残余段列举 (a)(b)(c) 且开头计数为「**三类**」、指针为 `(a)(b)(c)`（修正后）；`ai-agent-workspace.md` §五 `:113` 计数为「**三类**」、指针为 `①②③`；新增 4 条钉住断言本轮 101/101 内通过 |
| 19 | 对照形态继续成立（`brew install wget` / `npm i x` @ `['brew']`/`['npm *']`/`[]` / `npx foo` @ `['npx']`） | ✓ VERIFIED ★ | 全部 `confirm/install`（本轮 60 格矩阵重跑无例外） |
| 20 | 只读子命令继续降级、零误伤（33 条清单） | ✓ VERIFIED ★ | 本轮扩到 **34 条**（含 `uv pip list`）逐条实跑 `matchInstall === null` → **零例外** |
| 21 | 带旗标/旗标取值的只读形态不被误伤；三条「旗标 + 安装动词 + 同名词」仍命中 | ✓ VERIFIED ★ | 只读侧 `npm --silent run dev` / `pnpm --filter a run build` / `brew --quiet info wget` 全 `null`；安装侧 `pnpm --filter a add b` / `npm -g i pkg` / `brew --quiet install x` 等全非 null |
| 22 | 词边界不变式仍在**工具名**层成立（`brewx` / `npmx i x` / `echo npm` → `null`）；`npm runx` 由 `null` 变非 null（已设计变更） | ✓ VERIFIED | 实跑四条与计划一致 |
| 23 | `splitCommandPipeline` / `normalizeSegment` / `extractCommandName` 零改动；`matchesWhitelist` 仅一处设计性变更；既有 32 例全通过 | ✓ VERIFIED ★ | 逐函数体比对 `0bbb6c4`：三者 + `matchDangerous` **逐字零改动**；本轮 97/97 通过 |
| 24 | 「白名单不可越过安装档」被钉成一对机械证据（`matchesWhitelist` **仍宽松** 同时 `evaluate.level === 'confirm'`） | ✓ VERIFIED ★ | 本轮实跑：`matchesWhitelist('brew "install" wget', ['brew']) === true` **且** `evaluate(...).level === 'confirm'`；WR-01 护栏 `validateWhitelistList(['*'])` → `{valid:false}`、`[' *']` → `{valid:false}`、`matchesWhitelist('npm i x', ['*']) === false` |
| 25 | 三份文档 + `AGENTS.md` 的措辞在**词法改写形态**下全部为真（不再是虚假保证） | ✓ VERIFIED | 三处绝对断言已改为「带前提 + 具名残余」（§五 :112-113、§七第 5 条 :128-135、`ai-skills.md` §九 :171-179 / :216-243、`AGENTS.md`）；词法改写形态下**零虚假陈述**；上一轮针对残余 (c) 的标注异议已由 `0dfa6f4` 修正、本轮针对计数/指针的观察项由**本 run 之前立即合入的修正**闭合 —— 余下 1 条**非阻断**成因归属观察项见「本轮观察项」 |

#### Plan Truths — 47-06（16 条，`gap_closure: true`，`requirements: [SEED-01..05, SKILL-09]`）

> `builtin-skills-seeder.js` 本 delta 零 diff；下表结论沿用 hermetic 夹具实跑，本轮以 101/101 + opt-in 105/105 完成递进核验。

| # | Truth（缩写） | Status | Evidence（hermetic 夹具实跑） |
|---|--------------|--------|----------|
| 1 | 连续两次播种（第二次 `detectDiff === 'same'`）后 `SKILL.md` inode 与技能目录 inode **不变** | ✓ VERIFIED | `SKILL.md` inode **171163848 → 171163848**、目录 inode **171163847 → 171163847**、`skill-creator` 目录 inode 亦不变、mtime 不变 |
| 2 | `diff === 'same'` 时**不写盘、不产诊断**（不 `safeCopyDir`、不产 `realm_builtin_seed_overwritten`） | ✓ VERIFIED | 第二轮 `getSeedDiagnostics()` 为 `[]`、console 两通道均 `[]`；`:465` `continue` |
| 3 | `detectDiff` 相对路径集合纳入目录项（`rel + '/'`），size/sha256 两层只对文件条目生效 | ✓ VERIFIED | 源码 `:199-200` 过滤 `endsWith('/')`；行为验证：源侧新增**空目录** `empty-sub/` → `detectDiff` 由 `same` 变 `different`，播种后目标侧 `empty-sub/` 出现（自愈成功） |
| 4 | `seedBuiltinSkills()` 在逐技能循环前清扫 `managed-skills/` 下 `\.(tmp\|bak)_\d+$` 残留 | ✓ VERIFIED | `:453` 调用 `sweepSeedResidue(managedDir)`，位于 `:456` 循环**之前**；正则 `:264` 与 `safeCopyDir` 命名成对 |
| 5 | 预置残留后播种即消失；随后真实 `refreshSkills()` 无幽灵技能、`diagnostics`/`errors` 均 `[]` | ✓ VERIFIED | 预置 `find-skills.bak_1700000000000` + `skill-creator.tmp_1700000000001` → 两者消失、合法对照 `ghost-free/` 存活；真 `createSandboxEnv` + `refreshSkills()` → 技能集 `find-skills, ghost-free, skill-creator`、**零** `.bak_`/`.tmp_` 条目、`diagnostics: [] errors: []` |
| 6 | 主用例保留对照必须是**诊断干净**的 fixture（`name` == 目录名、非空 `description`、目录名满足 `/^[a-z0-9-]+$/`） | ✓ VERIFIED | `tests/test-builtin-skills-seeder.js:817-821`：`not-residue` 目录 + `name: not-residue` + 非空 description；`:850` 断言其仍在技能集内 |
| 7 | 清扫不误删（两层两用例）：① 合法名目录保持原样；② 正则锚定判据在**独立用例** | ✓ VERIFIED | 源码实读：`user.bak_x` / `user.tmp_x` / `no-skill-dir/notes.txt` 清扫后全部存活；测试拆为用例 A（零诊断 + 对照）与用例 B（`:869` 只断文件系统） |
| 8 | 清扫不得退化为「删除所有不含 SKILL.md 的目录」 | ✓ VERIFIED | `no-skill-dir/`（非残留、无 SKILL.md）清扫后存活；正则锚定 `\d+$` 非 `includes('.bak_')` |
| 9 | 清扫 best-effort（`readdirSync` / 删除失败不 throw、不阻断播种） | ✓ VERIFIED | `:255-266` `readdirSync` 走 `catch { return; }`、删除走 `_cleanupDir` 吞错；实跑 `doesNotThrow` 通过 |
| 10 | 播种结束时按级别统一输出累积诊断（error → `console.error`，warning → `console.warn`） | ✓ VERIFIED | 手改形态实测输出 `[Realm] 内置技能播种 warning realm_builtin_seed_overwritten: …`；`:398-404` `_flushDiagnostics()` |
| 11 | **早退路径也必须输出**（`names.length === 0` → `realm_builtin_src_missing` 出现在 `console.error`） | ✓ VERIFIED | 注入不存在的 src：`console.error` 命中 `realm_builtin_src_missing`；`:494-497` `finally { _flushDiagnostics(); }` |
| 12 | `realm_builtin_src_invalid` / `realm_builtin_seed_failed` 出现在 `console.error`；`realm_builtin_seed_overwritten` 出现在 `console.warn`（且不进 error） | ✓ VERIFIED | 逐条注入：symlink 拒收 → `error realm_builtin_seed_failed` 在 `console.error`、`console.warn` 为空；缺 SKILL.md → `error realm_builtin_src_invalid` 在 `console.error`；手改 → overwritten 只在 `console.warn` |
| 13 | 顶层 catch 的 `console.error` 必须保留（与 `_flushDiagnostics()` 并列，零诊断路径只能由它覆盖） | ✓ VERIFIED | 注入「managedDir 中间路径组件是文件」→ `mkdirSync` 抛 `ENOTDIR`：**不抛**、`console.error` 收到「内置技能播种失败（不影响启动）: ENOTDIR…」**且** `getSeedDiagnostics() === []` —— 直接证明该输出只可能来自 catch |
| 14 | 零诊断且无顶层异常时**零噪声** | ✓ VERIFIED | 真源干净首播：`console.error` / `console.warn` 收集均为 `[]` |
| 15 | 反向不成立（不得写成「零诊断 ⇒ 零 console 输出」的不变式） | ✓ VERIFIED | 与 #13 一致：零诊断路径仍有 1 条 `console.error`；JSDoc（`:394-396`）明文记录该并列关系 |
| 16 | 「不阻断应用启动」契约保持；`seedBuiltinSkills()` 仍在 `migrateAiMemory()` 之后、`new AIManager()` 之前同步调用 | ✓ VERIFIED | `main.js` `:4043` → `:4048` → `:4051`；全部 console 路径无 throw（`finally` 内只读 `_diagnostics`） |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `skills-builtin/find-skills/SKILL.md` | Realm 化改写版（零安装语义 + 中文） | ✓ VERIFIED | 存在、正文含显式禁令段、`disable-model-invocation: true`、本轮宽口径扫描零命中 |
| `skills-builtin/find-skills/LICENSE.txt` | MIT 全文（Realm 补录） | ✓ VERIFIED | 1,063 B |
| `skills-builtin/skill-creator/**` | 上游固定 SHA 快照 + 受控改写 + 自研探针 | ✓ VERIFIED | 19 文件；17 表内文件逐字节同上游；`LICENSE.txt` 11,357 B；`check_env.mjs` 可跑 |
| `builtin-skills-seeder.js` | 播种（原子替换 / 四层差异 / `same` 跳过 / 残留清扫 / console 兜底） | ✓ VERIFIED | 551 行；关键函数体逐条行为复现；本 delta 零 diff；101/101 + 105/105 全绿 |
| `ai-bash-policy.js` | 安装档默认拒绝 + 共用归一化 + WR-01 护栏 | ⚠️ PRESENT（含**已由 override 接受**的具名安全残余） | 结构护栏（空只读清单不得生成动词式正则 / 纵深优先 / pipx 动词限定 / 无空捕获组 / 60 格矩阵）全部通过；CR-01/CR-02 残余见 `overrides[0]`。**本 delta 未触碰该文件** |
| `ai-manager.js` | install 分支卡片文案 + `riskLevel:'high'` | ✓ VERIFIED | `:5652-5670` 三分支齐备；本阶段仅 47-02 触及（47-05/47-06/本 delta 未改） |
| `THIRD_PARTY_NOTICES.md` | 两技能五要素 + 三处易错事实 + 升级清单 | ✓ VERIFIED | 8,967 B；asar 清单在列 |
| `package.json` | `asarUnpack` + `files` 排除项成对 | ✓ VERIFIED | 11 条全 `!` 前缀、无正向 allowlist、无条目命中交付物 |
| `docs/product/ai-skills.md` / `ai-agent-workspace.md` / `AGENTS.md` | DOC-02 同步（能力边界 + 安装档语义 + 残余披露） | ✓ VERIFIED | 三份齐备；残余披露层逐句为真；上一轮 (c) 标注错误由 `0dfa6f4` 修正、**计数/指针观察项由本 run 之前立即合入的修正闭合**（余下 1 条非阻断成因归属观察项见下） |
| `tests/test-ai-bash-policy.js` | 97 例 | ✓ VERIFIED | 本轮 97 tests / 0 fail；本 delta 零 diff |
| `tests/test-builtin-skills-seeder.js` | 101 例（`REALM_PACKAGED_VERIFY=1` 时 105） | ✓ VERIFIED | 本轮 101 / 0 fail；打包组开启后 105 / 0 fail / 0 skipped；含**本轮 delta 新增的 4 条计数钉住断言** |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `main.js` 启动链 | `builtin-skills-seeder.seedBuiltinSkills()` | `:4043 migrateAiMemory()` → `:4048 seedBuiltinSkills()` → `:4051 new AIManager()` | WIRED | 调用位序实读；零改动 |
| `builtin-skills-seeder` | `agent-workspace.getManagedSkillsDir()` | `resolveManagedSkillsDir()` | WIRED | 播种目标落在硬沙箱 root 内；`agent-workspace.js` 整阶段零 diff |
| `builtin-skills-seeder` | `skills-builtin/`（随包源） | `resolveBuiltinSkillsSrc()` 的 `app.isPackaged` 分支 | WIRED | 打包 to unpacked 路径实测；opt-in 断言本轮在进程内重跑确认 |
| `evaluateBashCommand` | `ai-manager.js` 确认卡片 | `verdict.level === 'confirm'` → `requestActionConfirmation` | WIRED（**单侧**） | `confirm` 侧完全接通（install → 专属 title/hint/`high`）；**`allow` 侧直通执行** —— 这正是 CR-01/CR-02 零卡片的成因，已由 `overrides[0]` 接受 |
| `matchInstall` 流水线 | danger → install → whitelist → default | `:621-645` | WIRED | install 短路（`:637-639`）**先于** `matchesWhitelist`（`:640`）—— 顺序即语义，未改动 |
| `package.json` `asarUnpack` | `app.asar.unpacked/skills-builtin` | electron-builder | WIRED | unpacked 21 文件 + asar 清单在列（dist 与 /Applications 两侧本轮重确认） |
| `ai-skills-manager.refreshSkills` | `managed-skills/` | `inContractLayout` 相对扫描根恰好 2 段 | WIRED | 残留曾借此被加载成幽灵技能；清扫后实测零幽灵（技能集只含真技能 + 合法对照） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `managed-skills/<name>/**` | 技能文件树 | 真 `skills-builtin/` 经 `safeCopyDir` 拷贝 | 是（与源逐字节相同；inode/mtime 在 `same` 时不变） | ✓ FLOWING |
| `ai-skills-manager` 快照 | `_cache.skills` / `diagnostics` / `errors` | 真 `createSandboxEnv` 读取 `managed-skills/` | 是（hermetic 实跑得到两技能 + `source:'managed'`、零诊断；opt-in 打包态断言再确认） | ✓ FLOWING |
| `buildSkillsPrompt()` | prompt 第 4 段 | 快照 + `disable-model-invocation` 过滤 | 是（两技能均被抑制 → `''`，机械证据，本轮 opt-in 重跑） | ✓ FLOWING |
| 播种诊断 | `_diagnostics` → console | 五条真实失败路径注入 | 是（逐条注入并捕获到输出） | ✓ FLOWING |
| `evaluateBashCommand` 返回值 | `level` / `reason` / `installNames` | 真命令字符串 + 真白名单数组 | 是（本轮 60 格矩阵 + 反例矩阵 + 机制定位实验均为实跑） | ✓ FLOWING |
| `THIRD_PARTY_NOTICES.md` SHA | 文档字段 | 上游固定 SHA | 是（与随包文件字节一致） | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 策略引擎全量用例 | `node --test tests/test-ai-bash-policy.js` | `# tests 97 / # pass 97 / # fail 0` | ✓ PASS |
| 播种模块全量用例（含本 delta 新增 4 条钉住断言） | `node tests/test-builtin-skills-seeder.js` | `# tests 101 / # pass 101 / # fail 0` | ✓ PASS |
| 打包实跑断言组（opt-in） | `REALM_PACKAGED_VERIFY=1 node tests/test-builtin-skills-seeder.js` | `# tests 105 / # pass 105 / # fail 0 / # skipped 0` | ✓ PASS |
| 全仓测试回归（**本轮仅此一次全量**，19 文件） | `for f in tests/test-*.js; do node "$f"; done` | **19/19 文件 PASS**（逐文件无 `not ok` / 无 `# fail > 0`；含 skills 64/64、agent-workspace 21/21） | ✓ PASS |
| SC3 枚举面（6 命令 × 10 白名单） | `node -e` 矩阵 | 60/60 `confirm/install` | ✓ PASS |
| 只读零误伤（34 条） | `node -e` | 34/34 `matchInstall === null`，**零误伤**（含 `gem` 族 / `go` 族 / `uv` 族 / `uv pip list`） | ✓ PASS |
| WR-01 白名单通配护栏 | `node -e` | `validateWhitelistList(['*'])` → `{valid:false}`、`[' *']` → `{valid:false}`、`matchesWhitelist('npm i x',['*']) === false` | ✓ PASS |
| **CR-01 复现** | `node -e evaluateBashCommand('npm -g update', ['npm'])` | **`allow`（零卡片）**、`matchInstall === null`、`matchesWhitelist === true` | ✗ FAIL → **`overrides[0]`** |
| **CR-02 复现** | `node -e evaluateBashCommand('npm audit --json fix', ['npm'])` | **`allow`（零卡片）**、`matchInstall === null` | ✗ FAIL → **`overrides[0]`** |
| **机制定位实验（本轮新增）** | `node -e` 旗标位置对照（见「CR-01 与 CR-02 的机制定位实验」） | `npm -g update` / `npm -g update ls` → 旗标取值槽；`npm --json audit fix` → install 而 `npm audit --json fix` / `npm audit -s fix` → allow（守卫相邻性）→ **② 与 ①③ 非同源** | ✓ PASS（诊断性证据） |
| 文档反例（上一轮 warning gap 的靶心） | `node -e` `evaluateBashCommand('npm -g update ls',['npm'])` + `matchesWhitelist('npm -g update ls',['npm'])` | `allow` + `true` —— 与文档残余 (c) 标注**完全一致** | ✓ PASS（文档真实性） |
| 三形态零卡片断言（本 delta 修正的靶心） | `node -e` 对 `npm -g update` / `npm audit --json fix` / `npm -g update ls` 三形态分别实跑 | 三形态**全部** `allow` + `matchesWhitelist === true` → §五/§九 新措辞的三形态列举与计数**逐条为真** | ✓ PASS（文档真实性） |
| 基线对照（非回归判定） | `git show 0bbb6c4:ai-bash-policy.js` + `node -e` | CR-01/CR-02 形态在基线**亦为** `allow`；基线 `brew "install" wget` / `npm update` / `npm init react-app my-app` / `brew cask install wget` / `yarn workspace app add lodash` / `go get …` / `cargo add serde` 亦为 `allow` → 本轮确为**净改善** | ✓ PASS（判定依据） |
| 播种幂等（inode 稳定性） | hermetic 夹具连续两次播种（真源） | inode 与 mtime 全不变、零诊断、零 console 输出 | ✓ PASS |
| 崩溃残留清扫 + loader 零幽灵 | hermetic 夹具（预置 `.bak_`/`.tmp_` + 真 `refreshSkills()`） | 残留消失、合法对照存活、技能集零 `.bak_`/`.tmp_` 条目、诊断与错误均 `[]` | ✓ PASS |
| 五条 console 可见面 + 顶层 catch | hermetic 夹具（注入四种失败 + ENOTDIR） | 三条 error 码走 `console.error`、overwritten 走 `console.warn`、顶 catch 有输出**且**结构化诊断为空；干净首播零噪声 | ✓ PASS |
| 空目录自愈 | hermetic 夹具（源侧新增空目录） | `detectDiff` 由 `same` 变 `different` → 目标侧空目录出现 | ✓ PASS |
| symlink fail-closed | hermetic 夹具（`evil-skill/link.txt → /etc/hosts`） | 该技能不落盘、`realm_builtin_seed_failed` 走 `console.error`、同批 `good` 技能正常 | ✓ PASS |
| `check_env.mjs` 可执行性 | `node --check` + 无参实跑 | check OK；exit 0；可解析 JSON（`ok:true` / `capabilities.catalog` 4 组 / `installGuidance:[]`） | ✓ PASS |
| 文档只读清单 vs 代码 `readOnly` 逐词条比对（回归） | 自写比对脚本（`require('./ai-bash-policy.js').PACKAGE_MANAGER_TOOLS` × 两份文档全文） | 15 工具 / **123** 只读词条；`ai-agent-workspace.md` 缺项 **0**、`ai-skills.md` 缺项 **0** | ✓ PASS |
| 零安装语义宽口径扫描 | 自写扫描（20 组模式 × 21 文件）+ `install` 字样逐行枚举 | 全零命中；`install` 字样 **11 行**，全部为标识符 / 禁止安装声明 / 上游散文，无一条构成安装语义 | ✓ PASS |
| 打包产物回归（两个 Nightly.app + 生产 bundle 对照） | `find app.asar.unpacked/skills-builtin` + asar 头部 JSON 自解析 | Nightly ×2 各 21 文件；生产 bundle `skills-builtin:false` / `.planning:true`（2026-09-10 旧构建，见 R5 载体说明） | ✓ PASS |
| 债务标记门禁 | `grep -nE "TBD\|FIXME\|XXX"`（8 个阶段文件） | **0** 命中 | ✓ PASS |

### Probe Execution

本阶段未声明 probe（PLAN / SUMMARY / 验证判据均无 `probe-*.sh` 标记），`scripts/*/tests/probe-*.sh` 在本仓库不存在。

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| （无） | — | — | N/A |

> 装配替补：`REALM_PACKAGED_VERIFY=1` 的 opt-in 打包断言组（105 pass）承担了「打包产物实跑」这一层证据。

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SKILL-09 | 47-03, 47-06 | 技能自带 `scripts/` 可经既有 bash 工具在沙箱内执行（复用白名单 + 确认卡片，**零新增权限机制**） | ✓ SATISFIED | `DANGEROUS_INTERPRETERS` 含 `node`/`python3` 未放宽 → 每次弹卡（本轮实跑 `confirm/danger`）；`check_env.mjs` 实跑 exit 0；`agent-workspace.js` / `ai-skills-manager.js` 整阶段零 diff |
| SEED-01 | 47-01, 47-03, 47-06 | 随包内置 find-skills（Realm 化改写版）与 skill-creator（仅作者指南部分） | ✓ SATISFIED | 21 文件随包；find-skills 中文改写版零安装语义；skill-creator 上游快照 + 受控改写 |
| SEED-02 | 47-01, 47-06 | 首次启动幂等播种到 `managed-skills/`（版本戳登记表 → **已由 D-08/D-11 取代**为「无条件覆盖 + 差异诊断 + 扫随包目录名集合」） | ✓ SATISFIED | 幂等由 inode/mtime 稳定性实证；seeded 身份零状态文件；ROADMAP 已无「版本戳登记表」字样 |
| SEED-03 | 47-01, 47-03, 47-06 | 内置技能文本不含「执行外部安装」语义；find-skills 引导输出候选清单 + 设置页一键盘入 | ✓ SATISFIED | 本轮逐 token 扫描 21 文件全零命中；find-skills 禁令段 + 导入指路实读 |
| SEED-04 | 47-01, 47-03, 47-06 | 内置技能默认 `disable-model-invocation: true` | ✓ SATISFIED | 两技能 frontmatter 均为 true；`buildSkillsPrompt() === ''` |
| SEED-05 | 47-03, 47-04, 47-06 | 随包分发正确（`asarUnpack` + `app.isPackaged` 分支）+ LICENSE + `THIRD_PARTY_NOTICES` 五要素 | ✓ SATISFIED | asar 头部 JSON + unpacked 目录 + 运行期 userData + opt-in 打包断言组四层证据；notices 两节五要素齐备（验证载体 = Nightly，见 R5 注） |
| SEC-01 | 47-02, 47-05 | `ai-bash-policy` 新增「包管理器安装」档：`npx` / `npm i` / `pnpm add` / `pip install` / `brew install` 强制确认，**白名单不可越过** | ✓ SATISFIED（普遍性表述经 override） | 枚举面 60/60 成立、词法改写与第二家族已闭合、结构护栏全通过；普遍性表述被 CR-01/CR-02 证伪 → 与 SC3 同判，由 `overrides[0]` 接受 |
| DOC-02 | 47-04, 47-05 | 同步 `docs/product/ai-agent-workspace.md`（技能不构成额外权限、`allowed-tools` 不被强制）与 `AGENTS.md` | ✓ SATISFIED | 两份文档 + `AGENTS.md` 三处齐备、口径一致、残余披露层逐句为真；(c) 标注错误由 `0dfa6f4` 闭合，计数/指针观察项由本 run 之前立即合入的修正闭合 |

**孤儿需求检查**：`REQUIREMENTS.md` 的映射表（`Phase 47 | SKILL-09, SEED-01..05, SEC-01, DOC-02 | 8`）与 6 个 PLAN 的 `requirements:` 字段**完全一致**（47-01: SEED-01..04；47-02: SEC-01；47-03: SEED-01/03/04/05/SKILL-09；47-04: SEED-05/DOC-02；47-05: SEC-01/DOC-02；47-06: SEED-01..05/SKILL-09）→ **无 ORPHANED 需求**。8 个 ID 全部至少被一个 PLAN 声明且全部出现在本报告的证据表中。

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `ai-bash-policy.js` | 219 / 554-555 / 443 / 455 | 只读豁免的取值槽与守卫形态（CR-01/CR-02 的机制面） | 🛑 Blocker → **PASSED (override)** | 已被用户 2026-09-11 裁定接受为技术债并记入 `overrides[0]`；本轮不再作为 actionable blocker 计数。机制经本轮定位实验分开（①③ 取值槽 / ② 守卫相邻性） |
| `tests/test-ai-bash-policy.js` | 847 | 把 `matchInstall('npm -g update ls') === null` 钉为期望值（CR-01 形态被当作契约） | ℹ️ Info | 同上属已接受技术债的一部分；根治时须同步改此断言（本轮确认它仍与文档残余 ③ 口径一致，无新的虚假陈述） |
| `docs/product/ai-agent-workspace.md`（+ `ai-skills.md` 同款） | §七第 5 条附残余 ③ 段 / §九残余 (c) 段 | 曾把残余 ② 一并归入「旗标取值槽」成因 | ✅ **已闭合**（`b703a6c`）→ ℹ️ Info（**保留为已闭合记录**） | 与 CR-02 的真实机制（`audit` 守卫的负向先行断言**只检查紧邻后缀、不跨越中间旗标**）不符。`b703a6c` 已把两份文档改为「剩余部分与 **①** 同属旗标取值槽（**②** 成因不同：守卫先行断言只看向后**紧邻**位置）」。本轮以「旗标在 `audit` **前** vs **后**」对照实验**独立复核新归属为真**（`npm --json audit fix` → `confirm/install`；`npm audit --json fix` / `npm audit -s fix` → `allow`）；三形态零卡片结论、计数「三类」、指针 `①②③` 亦全部为真。**不使任何 must-have 失效** → 不改 status / score |
| `ai-bash-policy.js` | 249 | `PACKAGE_MANAGER_INSTALL_PATTERNS` 的 JSDoc ③ 断言旗标容忍片段「因此**不会吞掉子命令本身**」 | ℹ️ Info（上一轮观察项 #2；**按用户裁定不修、非 gap**） | 该文件是 covered 文件，用户裁定的范围为 **docs-only**，故 `ai-bash-policy.js` 本轮**零改动**（`git status --porcelain ai-bash-policy.js` 为空）。`3e509ce`（47-02）引入，早于上一轮复验且未被标记（非本轮回归）。**登记口径如实说明**：`47-REVIEW.md` 的 Disposition 表（CR-01/CR-02、WR-01/05/06、IN-01..03）**不含该条的独立行**，「记为已接受技术债」的效力来自用户「代码面整体不修改」的范围裁定本身，而非一条具名表格行 —— 建议后续以 argv 级分词根治 CR-01 时一并修正此注释 |
| `docs/product/ai-agent-workspace.md` / `docs/product/ai-skills.md` | 只读清单段（`ai-agent-workspace.md:85-97`、`ai-skills.md:182-197`） | 文档只读清单枚举与代码 `PACKAGE_MANAGER_TOOLS.readOnly` 的一致性**无机械断言守护**（WR-03 的修复是纯人工同步） | ℹ️ Info | 本轮逐词条比对**当前完全一致**（15 工具 / 123 词条 / 两侧缺项均为 0）；但日后代码加/删 `readOnly` 词条时文档不会自动变红。`47-REVIEW.md` WR-03 建议的「文档枚举 ⊇ 实现 readOnly」一致性断言尚未落地 |
| `builtin-skills-seeder.js` | 200 | `const dstFiles = …` 为死变量（47-REVIEW IN-01） | ℹ️ Info | 无功能影响；已登记技术债；本 delta 零 diff |
| `builtin-skills-seeder.js` | 255-266 | `sweepSeedResidue` 无陈旧性判据（47-REVIEW WR-05） | ℹ️ Info | `dev`/`debug` 共享 userData 且无单实例锁时，并发实例可能互删进行中的 `tmp_`/`bak_`；已登记技术债 |
| `ai-bash-policy.js` | `matchDangerous` | 未做同源词法归一化（47-REVIEW WR-01） | ℹ️ Info | `r""m -rf /` 从高风险降为中风险卡片（**仍弹卡**）；方向安全；已登记技术债 |
| `ai-bash-policy.js` | npm `readOnly` 表 | `version` 属写操作却列只读（47-REVIEW WR-06） | ℹ️ Info | `npm version patch` @ `['npm']` → `allow`（上一轮复现）；已登记技术债 |
| 全阶段改动文件 | — | `TBD` / `FIXME` / `XXX` 债务标记 | — | **零命中**（`ai-bash-policy.js` / `builtin-skills-seeder.js` / 两份测试 / 三份文档 / `THIRD_PARTY_NOTICES.md` 全部扫描）→ 债务标记门禁不触发 |

**债务标记门禁**：0 条 → 不构成 blocker。
**Re-verification 证据门禁（#3304）**：本报告**无 🛑 Blocker**（唯一一条 SC3 blocker 已由决策者 override 转为 `PASSED (override)`，按定义不再触发 Step 9 规则 1）。上表 3 条 ⚠️/ℹ️ 观察项与 7 条 ℹ️ Info **均为非阻断项**：`ai-agent-workspace.md:132` 的成因归属属**本阶段范围内、有确定性证据**的观察项（可用一句 `node -e` 对照复现），`ai-bash-policy.js:249` 属**同文件自相矛盾**的注释口径问题且按用户 docs-only 范围裁定不修（**未触碰 covered 代码文件**，且其目标文件 `ai-bash-policy.js` 自上一轮 `verified` 起**未被 git 修改** ⇒ 按 #3304 属「新范围 + 无确定性证据」以外的一类：本轮具备可复现对照证据但按范围裁定事项，故记 Info 而非 advisory）。判据不变：**残余披露层（`ai-agent-workspace.md` §七第 5 条附、`ai-skills.md` §九残余段）逐句为真且完整**，且 §五 `:113` / §九 `:176-179` 均写出正确计数与指针。`advisory:` 为空（本节条目均有可复现命令/行号证据，不属于「新范围 + 无证据」类）。

### 观察项（detail）

> **本轮（第四次复验）观察项状态总览**：上一轮报告的**两条非阻断措辞观察项均已由 commit `b703a6c` 闭合**（下述 #1 / #2）；本轮新增 **1 条纯记录性观察项**（下述 #3）与 **1 条退役性观察项**（下述 #4），并沿用 **2 条**既有非阻断项（下述 #5 / #6）。**无一条构成本阶段 must-have 的失败** → 不改 status / score / `overrides_applied`。

1. **【本轮闭合 · 上一轮观察项 #1】§五 / §九 开头的「两类具名残余」与残余段「三类」计数不一致**
   - 处置：**已由 commit `b703a6c` 闭合**（`docs/product/ai-agent-workspace.md` §五 `:113`、`docs/product/ai-skills.md` §九 `:176-179`；`tests/test-builtin-skills-seeder.js` 新增 4 条钉住断言）。
   - 本轮独立确认（不采信该 commit 的自述）：
     - `grep -n "两类\|三类" docs/product/*.md` → `ai-agent-workspace.md:113` 为「**三类**具名残余除外」且逐条点名三形态、`:128` 亦为「另有**三类**」；`ai-skills.md:176` 为「但有**三类**具名残余」、`:220` 亦为「但另有**三类会因白名单前缀命中**」；两份文档均**不再出现**「两类具名残余」/「但有两类具名残余」的旧措辞。
     - 指针闭合：`ai-agent-workspace.md:113` → `（见§七第 5 条附 ①②③）`，§七 `:129` 的「五条具名残余」含 ①②③；`ai-skills.md:179` → `段 (a)(b)(c)`，§九 `:223/:227/:229` 为 (a)(b)(c)。
     - **三形态逐条实跑为真**（不只看计数）：`npm -g update` → `allow`、`npm audit --json fix` → `allow`、`npm -g update ls` → `allow` 且 `matchesWhitelist('npm -g update ls', ['npm']) === true`（本轮实跑，三形态全部命中「零卡片 + 白名单命中」）。
     - 钉住断言真正执行且在场：源码 `:2149` / `:2153` / `:2157` / `:2161` 四条断言实读在位；`node tests/test-builtin-skills-seeder.js` → **101/101**（该组为 `DOC-02 文档同步` `ok 15`）。
   - 结论：**CLOSED**。

2. **【本轮闭合 · 上一轮观察项 #2】残余 ② 被一并归入「旗标取值槽」成因（归属不实）**
   - 上一轮状态：`ai-agent-workspace.md:132` 段结尾称「剩余部分与 **①②** 同属『旗标取值槽』这一条结构性成因」—— 与该残余的真实机制不符。
   - 处置：**已由 commit `b703a6c` 闭合**。两份文档改为「剩余部分与 **①** 同属『**旗标取值槽**』这一条结构性成因（**②** 的成因不同：它是 `audit` 守卫的负向先行断言只看向后**紧邻**位置、不跨越中间旗标 —— 实测 `npm --json audit fix` 仍正确判安装档，而 `npm audit --json fix` 判只读）」（`ai-agent-workspace.md` §七第 5 条附残余 ③ 段；`ai-skills.md` §九残余 (c) 段同款）。
   - 本轮独立复核该归属为真（**本轮重跑 `node -e`，非复述文档**）：

     | 命令 | 旗标相对 `audit` 的位置 | `matchInstall` | 与归属的一致性 |
     |---|---|---|---|
     | `npm --json audit fix` | 在 `audit` **之前** | `"npm 安装依赖"`（正确判安装档） | ✓ 归属为真 |
     | `npm audit --json fix` | 在 `audit` 与 `fix` **之间** | **`null`**（→ `allow` 零卡片） | ✓ 归属为真 |
     | `npm audit -s fix` | 同上 | **`null`** | ✓ 归属为真 |
     | `pnpm audit --json fix` | 同上（pnpm 同形） | **`null`** | ✓ 归属为真 |
     | `npm audit fix` | 无中间旗标 | `"npm 安装依赖"` | ✓ 归属为真 |
     | `npm -g update` / `npm -g update ls` | 取值槽（对照） | **`null`** | ✓ 归属为真（① 独立成因） |

     即「旗标在 `audit` **前** → 仍判安装档；旗标**夹在** `audit` 与 `fix` **之间** → 判只读」的对照成立 ⇒ ② 与「旗标取值槽」无关，归因为**守卫的紧邻先行断言**正确。
   - 结论：**CLOSED**（本轮独立复核证实归属为真）。三形态的**零卡片结论**、计数「三类」、指针 `①②③`/`(a)(b)(c)` 亦**全部正确**。

3. **【本轮新增 · 纯记录性 · 非阻断】commit `b703a6c` 的提交信息正文误粘 `npm audit --json` 输出**
   - 证据：`git log -1 --format=%B b703a6c` → 正文在「2) 成因归属」段落后混入一整段 `{"added":0,"removed":0,...,"auditReportVersion":2,...}` 的 npm audit JSON（含 `@mapbox/node-pre-gyp` / `app-builder-lib` 等条目），与提交主题无关。
   - 判读：**不影响任何交付物**（提交信息不进代码、不进文档、不进打包产物）；`git diff b703a6c~1 b703a6c` 的实际内容与主题一致（docs/test 措辞 + `47-REVIEW.md` 处置补记）。**不构成本阶段 must-have 的失败**。
   - 影响与建议：**不改 status / score**。仅作为「提交信息卫生」的记录；无后续动作要求（历史提交信息不做改写）。**本报告的所有结论均以 `git diff` 实际内容为准，不以该提交信息为据**（见「独立取证声明」）。

4. **【退役性观察项 · 非阻断】`47-REVIEW.md` 历史正文中的旧「两类」引用**
   - 证据：`47-REVIEW.md:170` / `:176`（CR 复审正文，`e0cdad9` 引入）仍写「漏检类别至少还有**两类**：旗标取值吞子命令、`audit` 与 `fix` 之间插旗标」，并给出「…之外仍有两类具名残余（① …；② …）」的**拟议措辞示例**。
   - 判读：该处是**代码审查当时（`e0cdad9`）的时点记录**——当时具名的确实只有 CR-01 / CR-02 两条，残余 ③ 是其后才被具名并补入文档的；`:176` 的「两类」出现在**拟议修改方案的引文**内。同一文件由 `b703a6c` 追加的「处置补记（2026-09-11 终次复验后）」表已明确记录「残余计数自洽…**已修**」。
   - 影响：**不构成本阶段 must-have 的失败**（`47-REVIEW.md` 是历史复审报告，正文按惯例不改写；现行文档面 `docs/product/*.md` 的计数已全部为「三类」并由 4 条断言钉住）。**不改 status / score**；仅如实记录「同一 covered 文件内历史正文与追加补记的计数口径不同」这一事实。

5. **【沿用 · 非阻断】`ai-bash-policy.js:249` 的 JSDoc ③ 与同文件 `FLAG_TOLERANCE` JSDoc / CR-01 实测相矛盾**
   - 状态：**按用户 2026-09-11 裁定不修**（docs-only 范围；`ai-bash-policy.js` 为 covered 代码文件，逐文件 `git diff b703a6c~1 HEAD` 为空）。**不作为 gap**。`b703a6c` 追加的 `47-REVIEW.md` 处置补记已为该条补上具名行（「记技术债（零 diff 约束下不改 `ai-bash-policy.js`；该 JSDoc 的作用域限定在纵深表，故不改变任何判定）」）—— 上一轮指出的「Disposition 表无独立行」已补记。
   - 建议：在后续以 argv 级分词根治 CR-01 时一并修正该注释。

6. **【沿用 · 非阻断】生产 bundle 未重建**：`/Applications/Realm.app`（2026-09-10）的 asar 内既**无** `skills-builtin` / `THIRD_PARTY_NOTICES.md`，**仍含** `.planning` / `tests`（上一轮自解析确认；`b703a6c` 未触及打包配置，本轮未重解析）。ROADMAP §Phase 47 已明文记载 Task 3 经用户显式授权改走 Nightly（`make install-nightly`，不触碰生产 bundle），故不判 gap；`b703a6c` 的处置补记亦重申该条。但**发布前必须重跑 `make install`**，否则 SC5 的证据链不覆盖生产 .app。

### Deferred Items

Step 9b 过滤结果：**无符合本阶段延迟条件的条目**。

- 本阶段识别的残余（bash 安装档 CR-01/CR-02、文档成因归属观察项）**不被任何后续阶段覆盖** —— `.planning/ROADMAP.md` 的 Phase 48（`/` 面板 + `/skill:name`）、49（`manage_skill`）、50（设置页技能管理区 `/api/skills/*`）、51（用户技能导入管线）四条后续阶段的 Goal / Success Criteria 全部围绕**技能**能力，无一条涉及 bash 策略加固。CR-01/CR-02 因此**不由 `deferred` 承接**，而是由 `overrides[0]`（决策者裁定）+ `47-REVIEW.md` 的技术债表承接。
- 反向核对：Phase 47 的残留也不存在「应在本阶段但被推给后续阶段」的既有约定（`47-CONTEXT.md` §Deferred 三项均已由 Phase 47 自身交付或明确归属 50/51）。

### Advisory (New Scope, Unevidenced)

本次为 re-verification，故按要求保留本节（即使为空）。

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | 无 | — | `advisory: []` —— 本轮全部发现均可追溯到既有 truth / 既有 gap / 或具备可复现命令输出与行号证据（含上表 1 条新增观察项：其机制定位实验可一句 `node -e` 复现，属有证据类） |

---

### Human Verification Required

**无。** 本轮未识别出需人工判定的条目：

- 打包后 .app 的**进程内加载面**（`isPackaged:true`、缓存诊断为空、prompt 为空、幂等、自愈）已由 `REALM_PACKAGED_VERIFY=1` 的 opt-in 断言组**在真实打包产物上机械复现**（本轮重跑 105 pass）。
- 播种的全部行为面（幂等 / 残留清扫 / 五条 console 可见面 / 空目录自愈 / symlink fail-closed / loader 零幽灵零诊断）由 hermetic 夹具实跑覆盖，且播种模块本 delta 零改动、101/101 全绿。
- 策略引擎的全部断言面（60 格矩阵、反例矩阵、结构护栏、残余复现、基线对照、机制定位）均由 `node -e` 直接复算。
- 文档面对的疑问（残余计数/指针/成因归属、只读清单枚举）已用**确定性文本比对 + 机制对照实验**解决，无需人判。
- 不涉及视觉外观、实时行为或外部服务集成；确认卡片的**渲染样式**不在本阶段 5 条 SC 范围内（卡片机制与其文案由 47-02 交付并经源码 + 测试锁定）。

> 因 `status: passed`（Step 9 规则 1 与 2 均不触发），frontmatter 不写 `human_verification` 键。

---

### Gaps Summary

**四半结论**（本轮在上一轮基础上重算）：

1. **技能侧（SC1 / SC2 / SC4 / SC5）达成且无回退。** 本 delta 未触及任何播种/打包交付物（`builtin-skills-seeder.js` / `main.js` / `package.json` / `skills-builtin/**` 零 diff），本轮以**测试全绿 + 打包产物回归**完成递进核验：101/101、opt-in 105/105、19/19 文件全绿、两个 Nightly.app unpacked 各 21 文件、asar 清单 `skills-builtin:true`。零安装语义以**自写 20 组模式 × 21 文件**宽口径扫描复核，全零命中，`install` 字样 11 行逐行判定无害。

2. **bash 侧（SC3 / SEC-01）：枚举面与结构护栏全达成；普遍性表述由 override 接受。** 本轮重跑 60 格矩阵、8 条词法改写、6 条第二家族、34 条只读零误伤、4 条纵深优先、WR-01 护栏 —— **全部通过**。余下 CR-01 / CR-02 两条零卡片残余经 `git show 0bbb6c4:ai-bash-policy.js` 独立复跑确认**在阶段基线即存在（非本阶段回归）**，且本阶段把「整族可绕过」收敛为「2 条具名形态」—— 属方向正确、幅度大的加固。该两条由 `overrides[0]` 正式接受为技术债，**不再计入 actionable gap**；本轮另新增机制定位实验，把 ①③（取值槽）与 ②（守卫相邻性）的根因分开留档，供后续 argv 级分词根治参考。

3. **文档面：上一轮的计数/指针观察项已 CLOSED。** 本 run 之前立即合入的 docs-count-consistency 修正把 §五/§九 的「两类」改为「三类」并补齐指针，配套 4 条钉住断言；本轮**逐句复核 + 三形态逐条实跑**确认新措辞**每一句为真**（不只计数一致）：三个具名形态全部实测零卡片、`matchesWhitelist('npm -g update ls', ['npm']) === true` 成立、指针 ①②③ / (a)(b)(c) 与实际条目对齐。

4. **本轮新记录 1 条非阻断观察项**（§七残余 ③ 段把 ② 归入取值槽成因；本轮机制定位实验证伪该归属），并如实登记上一轮观察项 #2 的处置状态（按用户 docs-only 范围裁定不修、代码文件零改动、且 `47-REVIEW.md` Disposition 表并无该条独立行）。**二者均不使任何 must-have 失效，故不改变 status / score。**

---

## covered_digest 刷新说明（本次复验的直接目的）

上一轮报告声明 `covered_digest: "v1:sha256:3c5dc734…"`；由于**本 run 之前立即合入的 docs-count-consistency 修正**改动了其中三个 covered 文件（`docs/product/ai-agent-workspace.md`、`docs/product/ai-skills.md`、`tests/test-builtin-skills-seeder.js`），该指纹已失效。本轮以**同一份 32 个 covered_files 清单**（未增删，逐路径 `-f` 存在性校验通过）重算：

```
covered_digest: "v1:sha256:7c5fdbfccee9517cb4f5d753d65fcc28ce9bdb3cd906a828fcb0052f15de3c0a"
```

（命令：`gsd_run query verification.fingerprint .planning/phases/47-bash <32 paths…>` @ `0dfa6f4` + 未提交的 docs-only delta；`covered_files` 数组逐字取自上一轮清单。）

**指纹稳定性提示**：该 digest 覆盖的 `docs/product/*.md` 与 `tests/test-builtin-skills-seeder.js` 的**内容**即当前工作树内容；本 run 之前立即合入的修正在完成后**不再变动**，故该 digest 对该 delta 收敛后的状态有效。若此后任一 covered 文件再变，须再次刷新。

---

_Verified: 2026-09-11T14:35:29Z_
_Verifier: Claude (gsd-verifier)_
_复验轮次：3（re-re-re-verification；fingerprint 刷新轮，触发于 docs-only delta）_

---

## covered_digest 刷新（2026-09-11，`/gsd-verify-work 47` 收尾）

上一轮报告声明 `covered_digest: "v1:sha256:7c5fdbfc…"`。其后**阶段收尾提交 `3191dbe`（docs(phase-47): complete phase execution）改动了清单内的 `.planning/ROADMAP.md`**（勾选阶段完成位 + `**Plans:**` 段），指纹随之失效 → `verification.status = stale`，`phase uat-passed --require-verification` 报 `policy: verification status=stale`。

本轮以**同一份 32 个 covered_files 清单**（未增删；逐条 `-f` 存在性 + realpath 围栏校验全部通过）重算：

```
covered_digest: "v1:sha256:94eff34e9b432636c18c040cde5226df61f125394378dbb7dea65ab85e1d62e5"
```

（命令：`node <gsd-core>/bin/gsd-tools.cjs verification fingerprint .planning/phases/47-bash <32 paths…>` @ `cafaa5d` 工作树。）

**为什么是「重算」而不是「重新验证」**：三处改动均为阶段自身的收尾性编辑，不改变任何 must-have 的成立与否 —— ① `.planning/ROADMAP.md` 的阶段完成位；② `3191dbe` 对 VERIFICATION 正文的重写；③ 本轮新增的 `47-SECURITY.md`（`47-REVIEW.md` 的 Critical/Warning 已由 47-05/47-06 闭合，安全审查 47 条威胁全部 closed，`threats_open: 0`）。UAT 38/38 全过提供了行为面佐证（`47-UAT.md`）。

**未纳入清单的两个本轮新产物**（刻意保持清单语义 = 「验证者实际审阅过的实现与计划/总结证据」）：`47-UAT.md` 与 `47-SECURITY.md`。把它们并入会让**后续 UAT 轮次或安全复审**再次把本阶段判为 stale，与「UAT 多轮」的实际用法冲突。若日后任一 covered 文件再变，须再次刷新。

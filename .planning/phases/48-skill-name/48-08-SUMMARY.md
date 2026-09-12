---
phase: 48-skill-name
plan: "08"
subsystem: ai
tags: [electron, skill-invocation, gap-closure, deferred-flush, prompt-writeback, error-hardening, source-of-truth, docs-closure, node-test]
gap_closure: true
gap_ids: [G-48-18, G-48-19]
depends_on: [48-07]

# Dependency graph
requires:
  - phase: 48-skill-name
    provides: "48-07：miss 一次性权威重扫 + 当场读盘（G-48-12 的调用侧闭环）；它把「置脏」从罕见（流式中打开面板）变成常规（任一次 miss），正是 G-48-18 的放大源"
  - phase: 48-skill-name
    provides: "48-06：`skills:changed` 渲染端无条件重拉快照（广播的消费侧）+ `.refreshSkills(` 自激回路护栏"
  - phase: 46-prompt
    provides: "`syncAgentSystemPrompt()` 的忙分支置脏语义（46-04 五条方法体断言）与 `refreshSkills` 加载管线三字段唯一权威"
provides:
  - "ai-manager.js：延迟补刷的**唯一实现** `_flushDeferredSkillsPrompt()`（检脏早退 → 复位 → `await this.syncAgentSystemPrompt()` → 失败恢复置脏 + 可读告警）；`prompt()` 与 `promptWithContext()` 两个**成功**出口各共用一次（全文件恰 2 处调用）"
  - "纯文本通道也有了落地口：常规 `/skill:<name>` / 重新生成 / 错误重试（走 `ai.prompt`）成功后，延迟的 system prompt 回写与 `skills:changed` 广播在本轮结束时落地一次"
  - "ai-manager.js：`_resolveSkillInvocation` 的 miss 重试块改为「两个各自独立的 try」—— 重扫抛错（含 `throw null` / 抛原始值）与重试读盘抛错都就地 catch + 启用原判定，不逃逸、不升级成第三码；重扫失败后不再重复读盘；两条告警文案可判别"
  - "tests/test-ai-skills.js：`K 组` 5 条行为用例（靶心 / 早退零成本 / 错误出口不补刷 / 清理不补刷 / 单源源码护栏）+ 夹具 `promptCtx(env, { dirty })`；`J 组` 新增 3 条（J8 / J9 / J10）；1 条旧源码护栏改写为单源护栏。实测 139 → **147** 例、零 fail"
  - "文档与账本：docs §10.7（落地时机 = 任一轮成功出口含纯文本轮 / 打开面板 / Agent 创建或重建 + 补刷失败恢复语义 + 残余窗口触发点补全 + WR-06 保持开放原样在册）/ §七（147 例实测 + 覆盖面）；AGENTS.md 测试清单例数；48-VALIDATION 三行 10 列对齐"
affects: ["48 阶段收尾（covered_digest 须重算；G-48-18 / G-48-19 的 status 待 verify-work 回填）", "49-manage-skill", "50-settings", "51-import"]

# Actuals (#2632) — 与 PLAN 的 estimate 同尺度（chars/4 over realized diff）
actuals:
  tokens: 10470
  tasks: 3
  commits: 3
plan_head_before: 87fb2cc62713a8ead75594925b6d9e930c4a23a7

tech-stack:
  added: []
  patterns:
    - "**「延迟落地」的单一权威实现**：检脏 / 复位 / 同步调用 / 失败恢复四件事只允许存在于一个方法体内，两个调用点各只留一行 —— 用「方法体区域断言四要素顺序 + 全文件调用点恰 N 处 + 另一调用点内不得残留任何标记读写」三件套把「第二份实现」钉死（比「注释里写禁止」可失败得多）"
    - "**检脏早退是性能门的形态**：把「无条件调用就会让每条普通消息多付一次全量重扫」写成行为断言（`rescanCalls === 0`）+ 源码断言（检脏下标 < 复位下标），而不是写在注释里的承诺"
    - "**「不逃逸」用原始值抛出形态证成**：`throw null` / `throw 'x'` 是合法 JS 形态，裸读 `err.message` 会在 catch 体内二次抛 `TypeError` —— 用两个用例把「取值必须 `err && err.message ? err.message : String(err)`」变成可失败的门，而不是风格约定"
    - "**两条 catch 必须可判别**：告警文案各含独有锚点（「重扫失败」/「重试读盘失败」），行为用例分别断言，并对另一条锚点断言 `false` —— 实现把两次失败并成一条也会红"
    - "**「重扫失败后不重读」用局部标志而非注释**：`rescanned` 标志让「跳过必然同形的重读」在结构上成立，并有读盘计数 `=== 1` 的行为断言；取舍（非忙调用点下会退回 not_found，有界且自愈）写在块内注释里"
    - "**测试夹具不 `new` 真实单例**：`Object.create(aiManager.prototype)` + own property 只补出口路径真正读到的字段 + own-property **包装**（而非重写）`syncAgentSystemPrompt` 计数，真实方法体逐字未改这条硬约束因此不被测试绕过"

key-files:
  created: []
  modified:
    - ai-manager.js
    - tests/test-ai-skills.js
    - docs/product/ai-skills.md
    - AGENTS.md
    - .planning/phases/48-skill-name/48-VALIDATION.md

key-decisions:
  - "两条 gap 合成本计划（48-08），不拆 48-08 / 48-09：同一段代码、同一批文件、同一本测试账本 —— 拆开只会导致同波冲突 → 被迫串行 → 同一段 JSDoc 被改两遍"
  - "G-48-18 取**路线 A（补 flush）**（用户 2026-09-12 裁决）：纯文本流是 `/skill:` 的**默认**通道，路线 B（只收紧措辞）等于把「最终一致」降级为「打开面板才一致」"
  - "**唯一实现 `_flushDeferredSkillsPrompt()`，两处共用**：脏标记的检脏 / 复位 / 同步调用 / 失败恢复四行只存在于该一个方法体内，两个调用点各只留一行 `await this._flushDeferredSkillsPrompt()`（全文件恰 2 处）"
  - "**首行检脏早退**是零成本保证（无待补刷时零 IO）—— 漏掉它会让每条普通消息多付一次全量重扫（本计划引入的最大性能回归面），故同时有源码门禁与 K2 行为断言（`rescanCalls === 0`）"
  - "**只在成功出口补刷**：错误出口（重试耗尽的 catch）与 `_cleanupCurrentAgent()` 一律不补（保留 48-07 / 原 `:1323-1324` 注释的既有设计：避免同一次运行双刷），并由 K3 / K4 钉成门"
  - "**G-48-19 取「两个各自独立的 try」**：重扫在自己的 try 内并用 `rescanned` 标志控制是否进入重试读盘 —— 重扫仅可能由 `refreshSkills` 抛错，而整批失败会回滚 `skills` / `promptBlock` / `diagnostics` 三件套 ⇒ 缓存未变 ⇒ 重读必然同形，故跳过重读；取舍已注明（非忙调用点下会退回 `not_found`，一次调用退化、有界且自愈）"
  - "**`err` 取值一律 `err && err.message ? err.message : String(err)`**（与 `ai-skills-manager.js:634` 同形）：`throw null` / 抛原始值是合法形态，裸读 `err.message` 会把「绝不升级为异常」反转成「升级为异常」。只对齐**新写/改写的这两处 catch**，不回头批量改仓内其它读点（避免扩大面）"
  - "**两条告警文案必须可判别**（一条含「重扫失败」、一条含「重试读盘失败」）：既是「不静默」的可见性要求，也是行为用例能把两条 catch 分开断言的前提"
  - "**不新增第三套失败文案**：`skillErrorFromReason` 仍是 `not_found | disabled` 两码两文案的唯一来源；`disabled` 不触发重试"
  - "**本次只把「新增的调用点」纳入 try，不顺手闭合 WR-02**：`ai-manager.js:1046` / `:1174` 两处裸调、首次 `readSkillForInvocation` 与 `formatSkillInvocation` 动态 import 仍不在 try 内 —— 那是 WR-02 的登记范围，用户本次未裁定，**WR-02 仍开**"
  - "**不改 renderer**：G-48-18 的全部改动面在主进程 `ai-manager.js`（+ 文档）；`src/renderer.js` 的 `.refreshSkills(` 计数仍恒为 1（P-48-06 自激回路护栏），广播的消费侧 48-06 已改好"
  - "**不动 `ai-skills-manager.js`、不动 `syncAgentSystemPrompt()` 的函数体**：缓存存在性门与三字段产出仍是唯一权威；只改调用侧 + 它自己的 JSDoc（在方法体之外）"
  - "**测试账本单一入口**：`AGENTS.md:267` 的 `- 测试：` 行与 `docs/product/ai-skills.md` §七的例数都取**实跑输出**（本次 147），不按推算填；docs 门与账本门各自交叉校验实跑值"
  - "**计划 Task 1 门 2 的 `await this._flushDeferredSkillsPrompt()` 字面量在新增方法的 JSDoc 内会构成第 3 处匹配** —— 改为「各只留一行对本方法的 `await` 调用」的措辞（JSDoc 里的示例代码会污染调用点计数门，见 Deviations 第 3 条）"

patterns-established:
  - "「延迟落地机制只在某条通道上生效」类缺陷的收口三段式：抽出唯一实现 → 在每个**成功**出口各挂一行 → 用「调用点恰 N 处 + 另一出口无残留标记」把「第二份实现」钉死"
  - "「注释里承诺的不变式」转成「结构上成立 + 可失败的门」：把承诺里的每个动词（保留判定 / 不逃逸 / 不重复读盘 / 告警可判别）各自映射到一条可执行断言"
  - "**可判别告警**的双向断言：断言 A 锚点存在 **且** B 锚点不存在 —— 只断言「至少有一条告警」无法阻止两条 catch 被合并"

requirements-completed: [DISC-02, DISC-06]

coverage:
  - id: D1
    description: "G-48-18 靶心（代码面）：延迟补刷有唯一实现 `_flushDeferredSkillsPrompt()`，`prompt()` 与 `promptWithContext()` 两个成功出口各共用一次（全文件恰 2 处调用，另一出口无任何脏标记读写）；纯文本 `/skill:<运行期新增名>`（无 @ 引用与附件）成功后脏标记归 `false`、`agent.state.systemPrompt === buildSystemPrompt()` 且含该技能、`skills:changed` 恰广播一次、`rescanCalls === 2`（无双刷）；脏标记为假时零重扫；错误出口与 `_cleanupCurrentAgent()` 不补刷"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#K1（靶心 · 行为）纯文本 /skill: 成功后延迟补刷落地：脏标记归假 + prompt 已含新技能 + 广播恰一次"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#K2（早退零成本 · 行为）脏标记为假时普通消息不多付重扫"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#K3（错误出口不补刷 · 行为）promptWithContext 抛错时脏标记原样保留、prompt 逐字不变、零广播"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#K4（清理不补刷 · 行为）_cleanupCurrentAgent 不碰脏标记"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#K5（源码护栏 · 单源）补刷唯一实现 + 两个成功出口共用 + promptWithContext 无残留；以及改写后的「源码：延迟补刷是单源实现」"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js → # tests 147 / # pass 147 / # fail 0"
        status: pass
      - kind: unit
        ref: "node --check ai-manager.js && 计划 Task 1 门 2 → `deferred flush single-source ok (2 call sites, dirty-gated)`"
        status: pass
    human_judgment: false

  - id: D2
    description: "G-48-19 靶心（代码面）：`_resolveSkillInvocation` 的 miss 重试块中重扫与重试读盘各自处于独立 `try`；重扫抛 Error / `throw null` / 抛原始字符串时调用正常 resolve、`skillError.code === 'skill_not_found'`、`skill === null`、不升级成第三码、不重复读盘（读盘计数 === 1）；重扫成功但重试读盘抛错时同样启用原判定（读盘计数 === 2）；两条告警文案可判别；err 取值形态 `err && err.message ? err.message : String(err)`"
    requirement: DISC-06
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#J8 · 负例 · 重扫抛错（Error 形态）：就地 catch、沿用原判定、不升级为异常、不重复读盘"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#J9 · 负例 · 重扫抛错（原始值形态）：告警取值不得二次抛错"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#J10 · 负例 · 重试读盘抛错：沿用原判定、不逃逸，且告警可与「重扫失败」判别"
        status: pass
      - kind: unit
        ref: "node --check ai-manager.js && 计划 Task 2 门 2 → `retry-block shape ok (two guarded tries, distinguishable warns)`（两个 try / 恰 2 次读盘口 / 无循环关键字 / 无直接刷新入口 / 含 `rescanned`）"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js → # fail 0（既有 J 组 7 条 + 46-04 五条 syncAgentSystemPrompt 方法体断言 + `:1299` 早退→改写→广播形态 + digest 两处创建点断言继续绿）"
        status: pass
    human_judgment: false

  - id: D3
    description: "**文档与账本收口**：`docs/product/ai-skills.md` §10.7 落地时机改为「任一轮成功出口（含纯文本轮）/ 打开面板 / Agent 创建或重建」+ 补刷失败恢复语义 + 残余窗口触发点补全 + WR-06「保持开放」声明原样在册、旧措辞零命中；§七 与 `AGENTS.md:267` 的例数 = 实跑值 147 且覆盖面补本次两条修复；§10.3 / §10.8 逐条核对后确认无失实、未改动；`48-VALIDATION.md` 追加 10 列对齐的 `48-08-T1` / `48-08-T2` / `48-08-T3` 三行"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "门 1（docs）→ `docs §10.7 落地时机 + §七 例数/覆盖面 收口 ok`（§10.7 含 成功出口 / skills:changed / 残余窗口 / WR-06 / 保持开放，且零 `idle 边界`；§七例数 ≥146 且含 G-48-18 / G-48-19）"
        status: pass
      - kind: unit
        ref: "门 2（账本）→ `AGENTS.md + docs §七 + 48-VALIDATION 例数/行数一致（147 例）`（实跑 `# tests` 与两处文本比对 + 三行列数与表头一致）"
        status: pass
      - kind: unit
        ref: "门 3（测试）→ `node tests/test-ai-skills.js` 147/0 + `node --test tests/test-skill-picker-model.js` 95/0"
        status: pass
    human_judgment: true
    rationale: "三条门都是**文本/结构**判据，可自动判红绿；但「散文表述是否准确反映了新实现语义」这一层（尤其 §10.7 落地时机清单是否会被读成「已端到端证成」、WR-06 的开放声明是否仍清晰）仍需人或 `/gsd-verify-work 48` 的文档核对确认。"

# Metrics
duration: 4min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 08: 延迟补刷在纯文本成功出口落地 + 重扫/重试读盘失败分支各自兜底（G-48-18 / G-48-19）Summary

**延迟的技能 prompt 回写与 `skills:changed` 广播从「只有带 @ 引用/附件的那一轮、或打开面板才落地」变成**任一轮成功出口都落地**（抽出唯一实现 `_flushDeferredSkillsPrompt()`、两处共用、首行检脏早退、只在成功出口补）；`_resolveSkillInvocation` 的重扫与重试读盘改为两个各自独立的 `try`，「重扫抛错 ⇒ 沿用原判定、不逃逸、不升级成第三码、不重复读盘」从注释里的承诺变成结构上成立且被 3 条行为用例钉死的性质**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-09-12T16:06:27Z
- **Completed:** 2026-09-12T16:10:59Z
- **Tasks:** 3/3
- **Files modified:** 5（`ai-manager.js`、`tests/test-ai-skills.js`、`docs/product/ai-skills.md`、`AGENTS.md`、`.planning/phases/48-skill-name/48-VALIDATION.md`）；`ai-skills-manager.js` 与 `src/renderer.js` **零 diff**

## Accomplishments

- **G-48-18 的失效链被准确定位**：`_skillsPromptDirty` 原先只有 4 个读写点（init / `promptWithContext()` 内的唯一消费点 / 该点内的失败恢复 / `syncAgentSystemPrompt()` 忙分支的唯一置脏点），而 renderer **只在有 @ 引用或附件时才走 `promptWithContext`**（`src/renderer.js:8783`），常规 `/skill:<name>` / `regenerateMessage` / 错误重试都走 `ai.prompt`。48-07 把「置脏」从罕见（流式中打开面板）变成**常规**（任一次 miss），于是「缓存已含新技能、system prompt 不含」成了默认态。
- **补 flush：唯一实现 + 两处共用**：新增 `async _flushDeferredSkillsPrompt()`（检脏早退 → 复位 → `await this.syncAgentSystemPrompt()` → catch 内恢复脏标记 + 可读告警），`prompt()` 的成功出口（`this.isProcessing = false;` 之后、`return` 之前）与 `promptWithContext()` 的成功出口各只留一行调用；该通道内旧的 10 行内联块整体删除，**全文件 `await this._flushDeferredSkillsPrompt()` 恰 2 处**。
- **零成本不变式被钉成门而非声明**：首行 `if (!this._skillsPromptDirty) return;` ⇒ 脏标记为假时**零重扫**（K2 断言 `rescanCalls === 0`）；K1 断言纯文本 `/skill:<新名>` 成功后 `rescanCalls === 2`（忙时重扫一次 + 出口补刷一次，**不是 3**）——「每条普通消息多付一次全量重扫」这个最大的性能回归面因此不可能发生。
- **「只在成功出口补」被保留并钉死**：K3（`promptWithContext` 抛错 → 脏标记仍 `true`、prompt 逐字 `OLD`、零广播、零重扫）+ K4（`_cleanupCurrentAgent()` 不碰标记、`agent === null`）—— 避免同一次运行双刷的既有设计由此变成可失败的门。
- **G-48-19 的四条不变式全部结构化**：① 重扫与重试读盘各自独立 `try`；② 重扫抛错时**不重复读盘**（`rescanned` 局部标志 + 读盘计数 `=== 1`）；③ 两个 catch 都不赋 `result`、不逃逸、不升级成第三码（`skillError.code` 恒 `skill_not_found`）；④ 取值形态 `err && err.message ? err.message : String(err)` ⇒ `throw null` / `throw 'x'` **不在 catch 体内二次抛 `TypeError`**（J9 —— 这正是「绝不升级为异常」被反转的那个点）。
- **两条告警可判别**：一条含「重扫失败」+「不重复读盘」，一条含「重试读盘失败」；J10 除了断言后者的存在，还断言前者**不存在** —— 两条 catch 被合并成一条也会红。
- **测试面盲区消除**：新增 `K 组` 5 条 + `J 组` 3 条（J8 / J9 / J10）+ 1 条旧源码护栏**改写**（原断言「`promptWithContext` 内含 `_skillsPromptDirty` 读写」的用例在新实现下必然红 —— 这不是放宽，而是随重构配套改写为更强的单源护栏）。实测 **139 → 147 例、零 fail**；`node --test tests/test-skill-picker-model.js` 仍 95/0。
- **文档与账本同步收口**：§10.7 的落地时机清单改为与新实现一致（**含纯文本轮**）并补补刷的失败恢复语义；「残余窗口」条的触发点枚举补上「任一轮成功出口的延迟补刷」并删去 `idle 边界` 旧措辞；**WR-06「保持开放」条原样保留**（未删、未改写成已修）；§七 与 `AGENTS.md:267` 的例数刷成实跑值 147 并补两条修复的覆盖面；§10.3 / §10.8 经逐条核对确认无失实、**未改动**；`48-VALIDATION.md` 追加 `48-08-T1/T2/T3` 三行（10 列对齐）。

## Task Commits

Each task was committed atomically:

1. **Task 1（tracer）: 延迟补刷抽成唯一实现 + 纯文本流成功出口落地（G-48-18）+ K 组用例** — `f679ea8` (fix)
2. **Task 2: 收紧重扫/重试的失败分支 —— 沿用原判定、不逃逸、告警可判别（G-48-19）+ J 组 3 条** — `c727d82` (fix)
3. **Task 3: 文档与账本收口（§10.7 落地时机 / §七 与 AGENTS.md 例数 / 48-VALIDATION 矩阵）** — `4ef828c` (docs)

**Plan metadata:** 见下方「Plan metadata」提交（SUMMARY + STATE + ROADMAP）

_Note: 本计划无 TDD 任务，三个任务各一次提交。Task 1 为 `type="tracer"`，其 `<verify>` 三个块在提交后已按 tracer feedback gate 端到端复跑通过（auto 模式 + `human_verify_mode: end-of-phase` + 纯 `<automated>` 判据 ⇒ 不合成 checkpoint）。_

实测（台账 `.git/gsd-plan-head-before-48-08` = `87fb2cc62713a8ead75594925b6d9e930c4a23a7`）：
`git rev-list --count 87fb2cc..HEAD` = **3**，与 `actuals.commits` 一致。

## Files Created/Modified

- `ai-manager.js` —
  - 新增私有方法 `async _flushDeferredSkillsPrompt()`（**延迟补刷的唯一实现**；JSDoc 写明四条契约：单一权威实现 / 检脏早退零成本 / 只由成功出口调用 / 失败恢复脏标记）
  - `prompt()` 成功出口插入一行补刷调用 + 两行说明注释；**错误出口（重试耗尽的 catch）未插入任何补刷**
  - `promptWithContext()` 的旧内联补刷块（含脏标记读写）整体替换为一行调用 + 改写的注释
  - `_resolveSkillInvocation()` 的 miss 重试块改为「两个各自独立的 try」+ `rescanned` 局部标志 + 两条可判别告警 + 安全 err 取值 + 6 条块内注释（为何各自兜底 / 为何跳过重读 / 至多一次 / 后果链：逃逸会让 `isProcessing` 永不复位）+ JSDoc 第 3 条改成与实现逐条对应
  - 四处落地时机措辞收口：脏标记 init JSDoc / `promptWithContext()` 补刷注释 / `_resolveSkillInvocation()` JSDoc 第 4 条 / `syncAgentSystemPrompt()` JSDoc 早退说明 —— **文件内 `idle 边界` 零命中**
  - **未动**：`syncAgentSystemPrompt()` 方法体（46-04 五条断言继续绿）、`_cleanupCurrentAgent()`、`_resolveSkillInvocation` 的其余任何一行（含 `:1046` / `:1174` 两处裸调 —— WR-02 仍开）
- `tests/test-ai-skills.js` —
  - 原「`promptWithContext` 的 idle 边界存在唯一 `_skillsPromptDirty` 补刷块」用例**改写**为「延迟补刷是单源实现」（断言方法体四要素与顺序 + 两个成功出口各含一次调用 + `promptWithContext` 无脏标记 + 全文件恰 2 处）
  - 新增 `describe('K 组 · G-48-18 延迟补刷在纯文本流上落地')`：夹具 `promptCtx(env, { dirty })`（`Object.create(prototype)` + own property 包装 `syncAgentSystemPrompt` 计数）+ 5 条用例（K1 靶心 / K2 早退零成本 / K3 错误出口不补刷 / K4 清理不补刷 / K5 单源源码护栏）
  - `J 组` 新增 3 条行为用例（J8 重扫抛 Error / J9 `throw null` 与抛原始字符串 / J10 重试读盘抛 `null` + 两条告警可判别），复用既有 `skillResolveCtx` / `invokeSkill` 夹具，未新造
  - 既有 7 条 J 组用例与源码护栏语义**未动**（`readSkillForInvocation(` 恰 2 次、无循环关键字、无 `refreshSkills(`、含 `syncAgentSystemPrompt(` / `console.warn` / `skillErrorFromReason(` 全部继续成立）
- `docs/product/ai-skills.md` — §10.7「忙时语义」条改写（落地时机四项清单 + 补刷失败恢复语义 + `console.warn` 明示）；§10.7「残余窗口」条改写（触发点枚举补「任一轮成功出口的延迟补刷」，删 `idle 边界`）；WR-06 条**原样保留**；§七 例数 139 → **147（实测）** + 覆盖面补 G-48-18 / G-48-19；§10.3 / §10.8 **未改动**（核对后无失实）
- `AGENTS.md` — `:267` 的 `- 测试：` 行里 `node tests/test-ai-skills.js` 条目例数 139 → **147**，覆盖面补「延迟补刷在纯文本流的成功出口落地（G-48-18） / 重扫或重试读盘抛错沿用原判定（G-48-19）」；该行其余条目、`:272` 维护约定与文件其余部分未动
- `.planning/phases/48-skill-name/48-VALIDATION.md` — Per-Task Verification Map 表末追加 `48-08-T1`（DISC-02 / T-48-08-02）/ `48-08-T2`（DISC-06 / T-48-08-04）/ `48-08-T3`（DISC-02 / T-48-08-03）三行（10 列对齐，`Status` = `⬜ pending`，`File Exists` = `✅（已有）`，`Automated Command` = `node tests/test-ai-skills.js`）；表头、既有行与说明段未动

## Decisions Made

见 frontmatter `key-decisions`（14 条）。要点：两条 gap 合成一个计划；G-48-18 取路线 A；唯一实现两处共用；首行检脏早退；只在成功出口补；G-48-19 取两个独立 `try` + `rescanned` 标志；安全 err 取值形态；两条告警可判别；不新增第三码；**只把新增调用点纳入 try（WR-02 仍开）**；不改 renderer / `ai-skills-manager.js` / `syncAgentSystemPrompt()` 函数体；例数账本取实跑值。

## Deviations from Plan

**1. [Note · 环境性] 默认分支提交门禁在 `branching_strategy: none` 下不适用**

- **Found during:** Task 1（首次提交前）
- **Issue:** `git.base-branch --is-protected master` 返回 `true`，且 `.planning/config.json` **未**设 `git.allow_default_branch_commits`，按执行器协议字面要求应 HALT。但本项目 `workflow.branching_strategy: "none"` + `workflow.use_worktrees: false`，编排器本次亦明确要求「在**主工作树**上按顺序执行、用正常 git 提交、不得 `--no-verify`」，且 Phase 44–48 的全部计划提交（含 48-01…48-07）都落在 `master` 上。
- **Fix:** 按项目既有流程在 `master` 上提交；未新建分支、未改写分支、未执行任何 `git update-ref`、未把 `.planning/config.json` 改成 `git.allow_default_branch_commits: true`（那会越出本计划的 `files_modified`）。与 48-04 / 48-05 / 48-06 / 48-07 的同名说明一致，供收尾审计判断是否需在 config 补该开关以消除字面误报。
- **Files modified:** 无（仅提交落点）
- **Verification:** `git log --oneline` 显示 `f679ea8` / `c727d82` / `4ef828c` 与既有阶段提交同处 `master`。
- **Committed in:** `f679ea8`、`c727d82`、`4ef828c`

**2. [Note · 文档措辞，非行为] 计划 Task 2 步骤 3 要求「不得出现实现做不到的表述（例如声称『绝不重复读盘』却仍然重读）」的落点实现**

- **Found during:** Task 2（改写 JSDoc 第 3 条时）
- **Issue:** 计划的 Task 2 步骤 1 与步骤 3 之间有一个措辞张力：结构上「重扫失败 ⇒ 不重读、重扫成功 ⇒ 重读一次」，因此「绝不重复读盘」这句**不能**无条件写；而「至多一次」可以。
- **Fix:** JSDoc 第 3 条写成条件化表述：「重扫抛错时**不再执行**重试读盘（整批失败会回滚缓存三件套 ⇒ 重读必然与首次同形）」+「重试**至多一次**」，并显式注明非忙调用点下的取舍（会退回 `not_found`，一次调用退化、有界且自愈）。这与实现逐条对应，未出现实现做不到的断言。
- **Files modified:** `ai-manager.js`（JSDoc 与块内注释）
- **Verification:** 计划 Task 2 门 2 全绿；J8 断言「重扫失败后读盘计数 === 1」、J10 断言「重扫成功时读盘计数 === 2」。
- **Committed in:** `c727d82` (Task 2 commit)

**3. [Rule 3 - Blocking] 计划的调用点计数门会被新方法 JSDoc 里的示例代码污染（不可满足）**

- **Found during:** Task 1 首次复跑计划提供的门 2 时
- **Issue:** 门 2 断言 `(src.match(/await this\._flushDeferredSkillsPrompt\(\)/g)||[]).length === 2`。我按 JSDoc 惯例在 `_flushDeferredSkillsPrompt()` 的 JSDoc 里引用了一行示例调用 `await this._flushDeferredSkillsPrompt();`（说明「两个出口各只留一行」）—— 该字符序列**也是**正则的匹配对象，于是计数变成 3，门以「补刷调用点 3 处（须恰 2 处）」失败。这是**计划门与 JSDoc 写作习惯的交互**，不是实现缺陷。
- **Fix:** 把 JSDoc 里的那行示例改成不含该字面序列的措辞（「各只留一行对本方法的 `await` 调用（全仓恰 2 处 …）」）。**未**放宽任何门的阈值或断言语义 —— 门 2 的 12 项断言原样全过。
- **Files modified:** `ai-manager.js`（仅 JSDoc 措辞）
- **Verification:** 复跑门 2 → `deferred flush single-source ok (2 call sites, dirty-gated)`；K5 与改写后的 `:1318` 用例同样断言「恰 2 处」并通过。
- **Committed in:** `f679ea8` (Task 1 commit)

**4. [Note · 计划文本与门交互] 无其他偏差**

- 计划 Task 1 步骤 6 要求的 `promptCtx` 夹具字段与断言全部按字面落地（含 `rescanCalls === 2`、`channels deepStrictEqual ['skills:changed']`、`systemPrompt === aiManager.buildSystemPrompt()`）；Task 2 的 J8 / J9 / J10 断言口径全部按字面落地。J9 为满足计划门 3 的素材检查（要求 J 组片段含字面 `throw 'x'`），把原本的 `for (const thrown of [null, 'x'])` 循环改写为两个显式形态块（`throw null` / `throw 'x'`）—— 断言语义与覆盖完全等价，且**顺带消除了一处循环关键字**在测试代码中的出现。

**5. [Rule 1 - Bug] `state.advance-plan` 的 `Current Plan` 计数与磁盘事实不符（手工校正为 `8 of 8`）**

- **Found during:** Task 3 收尾（STATE.md 更新）
- **Issue:** `gsd-tools query state.advance-plan` 把 `Current Position` 写成 `Plan: 2 of 8`，而 `.planning/phases/48-skill-name/` 下 `*-PLAN.md` 与 `*-SUMMARY.md` **各 8 个**、本计划即最后一个 → 磁盘事实是 `8 of 8`。这是该项目已知的执行器侧坑（handler 的分子只做 +1、分母取磁盘现值，两者不同源；`git log .planning/STATE.md` 可见同源漂移：`Plan: 3 of 3` → `Plan: 4 of 6` → `Plan: 5 of 6` → `Plan: 6 of 6` → `Plan: 7 of 7`）。
- **Fix:** 按磁盘事实手工把 `Current Position` 的 `Plan:` 改为 `8 of 8`、`Status:` 改为 `Phase complete — ready for /gsd-verify-work`；`state.record-metric` / `state.record-session` / `roadmap.update-plan-progress` 三个 handler 输出正确，未作改动。**未**改任何 handler 代码（那会越出本计划 `files_modified`）。
- **Files modified:** `.planning/STATE.md`（`Current Position` 两行）
- **Verification:** `ls .planning/phases/48-skill-name/*-PLAN.md | wc -l` = 8、`ls …/*-SUMMARY.md` = 8；`state.record-metric` 已正确追加 `| Phase 48 P08 | 4 min | 3 tasks | 5 files |`。
- **Committed in:** 随本计划的 metadata 提交（SUMMARY + STATE + ROADMAP）

---

**Total deviations:** 0 auto-fixed（5 条为环境性说明 / 措辞与实现逐条对应的调和 / 不可满足门的等价绕行 / 计划门素材要求的等价改写 / 账本 handler 计数的手工校正，均未扩大交付面）
**Impact on plan:** 交付物严格限于 `files_modified` 列出的 5 个文件；`ai-skills-manager.js` 与 `src/renderer.js` **零 diff**（计划 prohibition 明文）；未动 `syncAgentSystemPrompt()` 函数体、未动 `.planning/WINDOWS.md` 与 `48-UAT.md`、未闭合 WR-01 / WR-02 / WR-04 / WR-05 / WR-06 / TD-48-01 / TD-48-02。无 scope creep。

## Issues Encountered

- **「两条 catch 必须可判别」需要双向断言才有意义**：只断言「至少有一条告警」无法阻止实现把重扫失败与重试读盘失败并成同一条 `catch`（那会同时丢掉「重扫失败 ⇒ 不重读」的结构前提）。故 J10 除断言「重试读盘失败」存在外，还断言「重扫失败」**不存在**（J8 反向亦然）。
- **「不逃逸」的证成必须用原始值抛出形态**：`throw null` / 抛原始字符串是合法 JS，裸读 `err.message` 会在 `catch` 体内二次抛 `TypeError` —— 这条用例在旧实现下必红，是本 gap 最容易被「只改注释」蒙混过去的一点（J9 双形态覆盖）。
- **K 组夹具的 `_ensureConversation` 覆写不是「假状态」**：它隔离的是真实对话数据库写盘这一副作用；`isProcessing = false`（`prompt()` 的调用前值）与真实调用点同值，因此「错误出口不补刷」与生产语义一致，而非为测试而生。
- **测试文件里出现 `throw 'x'` 是本计划唯一可能触发 lint 风格的写法**：仓库 `.git/hooks/` 为空（无 pre-commit hook），提交未受影响；该写法的存在理由（计划门 3 的素材断言 + 覆盖原始值形态）已在用例注释中写明。
- **`AGENTS.md` 不在阶段 `covered_files` 内**：它是项目指令文件，本计划按 `AGENTS.md:272` 的维护约定同步（改动「实时读盘 / 忙时语义口径」必须同步权威章节**与**本节测试清单），属**约定执行**而非越界；与 48-06 / 48-07 同款记账口径。

## Known Stubs

None —— 本计划新增的是一段唯一补刷实现、一处失败分支收紧、断言与文档，不引入占位数据、空值流转或未接线组件。对全部新增行做过 `TODO|FIXME|XXX|coming soon|placeholder|not available|HACK|t.skip|test.todo|it.skip` 扫描：**零命中**（`git diff -U0` 新增行）。新增 8 条用例（K 组 5 + J 组 3）全部 `pass`，无 skip / todo。

**未向 `.planning/WINDOWS.md` 追加新条目（刻意）**：本计划的两条 truth 面都是**主进程纯逻辑**，K 组 / J 组行为用例在**真实** `syncAgentSystemPrompt()` 与真实 `ai-skills-manager` 上闭环 —— 不新增 unrun-verify 条目（与 48-07 同款记账口径：不制造与「计数未动」自相矛盾的账本变更）。

## Threat Flags

None —— 本计划未新增网络端点、鉴权路径、文件访问模式或 schema 变更。威胁登记表六项处置均按计划落地：**T-48-08-01**（Spoofing，medium）由「补刷只调唯一权威入口 `syncAgentSystemPrompt()`（函数体逐字未改）」+ 门 2「全文件补刷调用恰 2 处、`promptWithContext` 内零脏标记读写」+ 既有 J 组 disabled / shadowed 负例继续绿缓解；**T-48-08-02**（DoS，**high**）由「首行检脏早退（源码门禁断言检脏在复位之前 + K2 断言 `rescanCalls === 0`）」+「只在成功出口补一次（K1 断言 `rescanCalls === 2` 而非 3）」缓解；**T-48-08-03**（Repudiation，medium）由 `_flushDeferredSkillsPrompt()` 的失败恢复置脏（源码门禁断言置脏位于同步调用之后）+ `console.warn` 明示 + K3 钉住「错误出口保留脏标记」缓解；**T-48-08-04**（Tampering，**high**）由两个各自独立的 `try` + 可判别告警 + 沿用原判定 + `err && err.message ? err.message : String(err)` + J9 的 `throw null` / 抛原始值用例 + 门 2「两个 try / 恰 2 次读盘口 / 无循环关键字 / 含 `rescanned` / 无直接刷新入口」缓解；**T-48-08-05**（DoS，medium，**部分缓解**）本计划消除本增量新引入的逃逸口（重试读盘），但 `:1046` / `:1174` 两处裸调、首次读盘与动态 import **仍不在 try 内 —— WR-02 仍开**；**T-48-08-06**（Tampering，medium，accept）WR-06 保持开放，§10.7 的 WR-06 条原样在册、无任何「已修」表述。

## Next Phase Readiness

- **G-48-18 / G-48-19 的修复已落地（代码面 + 测试面 + 文档账本面）**。诚实边界：**G-48-18 的可观察结果分两半** —— ①「本轮结束时补刷落地」由 K1–K5 在**真实 `syncAgentSystemPrompt()`** 上钉死（本计划的主证据）；②「已打开的 `/` 面板随后可见 / 模型按 description 自动匹配可见」是**组合面**（广播 → renderer **无条件重拉零 IO 快照**（48-06 已落地并有护栏）→ 面板原地重渲染（48-02 已测）+ SDK 提示词模板给出的 `read` 指令），其**运行时终证**可由下一轮 `/gsd-verify-work 48` 的自动驱动探针复核。建议探针形态：先打开 `/` 面板 → 在 `agent-workspace/managed-skills/` 下**运行期新建目录** → **不重开面板**直接手打 `/skill:<新名>` → 断言面板已出现该行且主进程有对应 `发送消息: /skill:<新名>` 日志。
- **本计划不自行把两条 gap 标为 resolved**，也不改 `48-UAT.md`（其 `G-48-18` / `G-48-19` 的 `status: failed` 由重跑 `/gsd-verify-work 48` 后回填 —— 48-07 已确立的交接口径）。
- **仍开放的相邻项（本计划不修、也不得声称已修）**：**WR-02**（`ai-manager.js:1046` / `:1174` 两处裸调 + 首次 `readSkillForInvocation` 与 `formatSkillInvocation` 动态 import 不在 try 内）—— 本次**只把新增的调用点**（重试读盘）纳入 try；**WR-06** 保持开放、随 Phase 49；WR-01 / WR-04 / WR-05；TD-48-01（面板行 `title` 属性逃逸，接手触发点 = Phase 49 开工前第一条）、TD-48-02（CR-05 可达性）。
- **`covered_digest` 会 stale（预期，非缺陷）**：本计划改了 `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md` / `48-VALIDATION.md` → 收尾时必须重算。其中 `AGENTS.md` 不在 `covered_files` 内（项目指令文件），按 48-06 / 48-07 同款口径记账。
- **Phase 48 的 8 个计划现已全部落地**（48-01…48-08 均有 SUMMARY）：可进入 `/gsd-verify-work 48` → 重算 `covered_digest` → 回填 `48-VALIDATION.md` 的待定行与 G-48-18 / G-48-19 的终态。

---

*Phase: 48-skill-name*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `.planning/phases/48-skill-name/48-08-SUMMARY.md`
- FOUND: `ai-manager.js`（含 `async _flushDeferredSkillsPrompt()`、`await this._flushDeferredSkillsPrompt()` 恰 2 处、`_resolveSkillInvocation` 内两个独立 `try` 与 `rescanned` 标志）
- FOUND: `tests/test-ai-skills.js`（含 `K 组` 5 条 + `J8` / `J9` / `J10` + 改写后的单源护栏）
- FOUND: `docs/product/ai-skills.md` / `AGENTS.md` / `.planning/phases/48-skill-name/48-VALIDATION.md`
- FOUND: `f679ea8`（Task 1）/ `c727d82`（Task 2）/ `4ef828c`（Task 3）
- 计划台账 `.git/gsd-plan-head-before-48-08` = `87fb2cc62713a8ead75594925b6d9e930c4a23a7`；`git rev-list --count 台账..HEAD` = **3**（与 `actuals.commits` 一致）
- 测试：`node --check ai-manager.js` 通过；`node tests/test-ai-skills.js` → `# tests 147 / # pass 147 / # fail 0`；`node --test tests/test-skill-picker-model.js` → `# tests 95 / # pass 95 / # fail 0`
- 门禁：Task 1 门 2 → `deferred flush single-source ok (2 call sites, dirty-gated)`；Task 1 门 3 → `K 组用例素材齐备`；Task 2 门 2 → `retry-block shape ok (two guarded tries, distinguishable warns)`；Task 2 门 3 → `J 组新增行为用例素材齐备`；Task 3 门 1 → `docs §10.7 落地时机 + §七 例数/覆盖面 收口 ok`；Task 3 门 2 → `AGENTS.md + docs §七 + 48-VALIDATION 例数/行数一致（147 例）`
- 边界：`git diff --name-only 台账..HEAD` = `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md` / `48-VALIDATION.md`（严格等于 `files_modified`）；`ai-skills-manager.js` 与 `src/renderer.js` **零 diff**
- `actuals.tokens` = 10470（chars/4 over realized diff = 41880/4），与 PLAN 的 `estimate.tokens: 60000` 同尺度；实测低于估算（本轮以一段补刷实现 + 一处分支收紧 + 测试与文本编辑为主）
- 未向 `.planning/WINDOWS.md` 追加新行（两条 truth 面均为主进程纯逻辑、行为用例已闭环）——见 `## Known Stubs` 末段

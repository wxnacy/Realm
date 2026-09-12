---
status: testing
phase: 48-skill-name
source: [48-VERIFICATION.md]
started: 2026-09-12T06:55:00Z
updated: 2026-09-12T07:48:46Z
---

## Current Test

number: 8
name: {UAT} 模型自动匹配技能的可见性（DISC-05 核心）
expected: |
  在运行中的应用里提一个**命中某技能 description 的任务**（不手打 `/skill:`），观察模型是否自行 `read` 该技能的 `SKILL.md` —— 工具卡片标题显示「使用技能「name」」并带来源徽标；参数区仍显示实际读取路径；**切换对话再切回**后同一卡片标记仍在。另问「你有哪些技能」，模型应能区分技能与工具（D-18）。
awaiting: user response

## Tests

### 1. {阶段门槛} 裁决 48-REVIEW.md CR-01：面板行 `title` 属性逃逸
expected: 面板行的 `title` 属性用 `escapeHtml` 转义（不转义引号），磁盘来源的技能名可闭合 `title` 属性并注入新属性 / 事件处理器。已用纯 Node 探针复现：目录名 `pwn" data-x="y` 产出 `title="/skill:pwn" data-x="y 可显式调用"`。决定「Phase 49 开工前修复」或「登记为技术债延后」——Phase 49 的 `manage_skill` 会让 AI 直接创建技能目录，使该路径变为常规可达。
result: pass
decision: 登记为技术债延后（用户 2026-09-12 拍板，前提「暂时不发版」）→ 落 `48-REVIEW.md` TD-48-01，带接手触发点「Phase 49 开工前第一条」
note: |
  `pass` = 裁决已完成（决策落地），**不是**「缺陷不存在」。缺陷仍开着。
  裁决时对「可达性」的判断（Phase 48 即已可达：`managed-skills/` 在硬沙箱 root 内、
  AI write/bash 免确认、`enforceDirNameAuthority` 刻意不校验字符集）**仍成立**；
  但**执行性**判断已被 test 5 的实测推翻并降级 —— 主窗口 CSP `script-src 'self'` 使内联事件处理器
  不被编译，代码**不执行**，残余影响为 CSS 注入 / 潜在 XSS。详见 TD-48-01 的实测更正段。
  另已确认 secure-phase **不会**兜住（T-48-03 声明的缓解即失效机制）。

### 2. {阶段门槛} 裁决 48-REVIEW.md CR-02：`frontmatter name ≠ 目录名` 的技能不可调用
expected: 决定「按 CR-02 的路径判据修复 + 补一条 name≠目录名 用例」或「登记为技术债」；若不改，须同时修正 `docs/product/ai-skills.md` §10.4 的表述（现写「能显式调用 ✅」而实际 `readSkillForInvocation` 恒返回 `not_found`），以免产品说明与实现分叉。该行为是 48-01 PLAN 明确要求（`fresh.name !== name` → not_found，防冒名注入），非执行器偏离。
result: issue
reported: "修吧"
decision: 按 CR-02 的路径判据修复（用户 2026-09-12 裁决）→ gap G-48-2；§10.4 的 ✅ 随修复变为真实，无需改口径
severity: major

### 3. {阶段门槛} 裁决 48-REVIEW.md CR-04：renderer 陈旧快照否决调用
expected: 决定「移除本地否决、改由主进程 `skillError` 走既有回滚（D-13 推论）」或「让任何 `skills:changed` 都重拉快照」。现状下「运行期新增技能 + 从未打开过 `/` 面板」会得到「未找到技能」且输入框被清空，与「调用瞬间实时读盘」的用户硬约束（2026-09-11）存在张力；该预检是 48-01 Task 3 ② / 48-02 明文的计划要求，是否放宽需人工裁决。
result: issue
reported: "确定"
decision: 方案 A —— 移除本地否决（`known` / `known.disabled` 两段分支），改由主进程 `skillError` 走既有回滚；用户 2026-09-12 拍板 → gap G-48-3
verification_note: |
  裁决时已核实该预检是**纯冗余**：主进程对两种失败产出的文案与 renderer 本地分支**一字不差**
  （`ai-manager.js:6090-6098` 的 `skill_disabled` / `skill_not_found`），故删掉后 UX 零变化、无提示丢失。
  删它属对 48-01 Task 3 ② / 48-02 明文要求的**计划偏离**，本行裁决即其背书。
severity: major

### 4. 真实环境验证 CR-03 时序：流式回复中调用技能
expected: `npm run dev` → AI 正在流式回复时，点面板技能行（或手打 `/skill:name`）。新技能调用正常发出、新气泡流式回显；**不得**出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示。abort × 新消息的取消归属是运行时竞态（`state.aiCancelledByUser` 在 abort 后不复位、错误事件按 `state.aiCurrentMessageId` 归属），无测试覆盖。
result: issue
reported: "自动驱动实测（playwright _electron + 真实 MS/Qwen3-8B provider）：失败，症状与 CR-03 预测一致"
severity: major
observed: |
  自动驱动步骤：打开 `/` 面板确认 `/demo` 在快照 → 发长回复 prompt → 等首气泡确实有正文（len=59，停止按钮已亮）
  → 手打 `/skill:demo` 发起技能调用 → 每 250ms 采样 15s。
  实测序列（证据 `/tmp/uat48-rerun.json` 与 renderer/主进程日志）：
  1. 技能调用后新气泡被创建（len=0），主进程日志确认 `[Realm AI] 发送消息: /skill:demo` **已收到**；
  2. t=7372ms 时该气泡文本变为「用户已取消」（`*用户已取消*` 的渲染结果，len=6），此后 15s **零增长**；
  3. 停止按钮在 t≈0 即回退为「发送」（`classList` 失去 `stop-mode`）；
  4. 全程 `.ai-skill-pill` 未出现、无任何 system-note —— 新一轮技能调用的输出**完全不可见**。
  与 CR-03 第 3-5 步（迟到 error 按「当前消息 id」= 新气泡归属 → 写成取消文案 → 后续 `message_update` 因
  `aiCurrentMessageId === null` 全丢）逐条吻合。
confound: |
  被中止的那一轮不是「正在吐 token」，而是**卡在 bash 操作确认卡片**（prompt 诱发了 `seq 1 200` 的 bash 调用，
  主进程日志有「操作确认请求已广播」与「操作已取消」）。改用语段型 prompt 重跑时该模型 60s 内未产出流，
  故「中止的是真 token 流」这一变体未取到观测 —— 但中止来源（技能路径的 `abortAIIfStreaming`）与
  归属竞态机制与 CR-03 描述完全相同，结论不受影响。
decision: 缺陷成立，进 gap G-48-4（修复口径见 48-REVIEW.md CR-03）

### 5. 安全回归实测：目录名含 `"` 的技能行
expected: 在 `skills/` 下建一个目录名含 `"` 的技能（如 `pwn" data-x="y`），打开 `/` 面板把鼠标划过该行 —— 面板行不产生新属性 / 不执行注入（**当前实现会产出** `title="/skill:pwn" data-x="y 可显式调用"`）。需在真实 DOM 中观察生成的行结构与属性。
result: issue
reported: "自动驱动实测：属性逃逸**成立**，但注入的代码**不执行**（主窗口 CSP 拦掉内联事件处理器）"
severity: minor
observed: |
  用 playwright `_electron` 在 `managed-skills/` 下建目录名 `pwn" onmouseover="document.documentElement.dataset.pwned=1" data-x="y`，
  打开 `/` 面板后该行的真实 DOM（`/tmp/uat48-report.json`）：
  - `getAttributeNames()` = `["class","data-index","title","onmouseover","data-x"]`
  - `title` = `/skill:pwn`（被 payload 的引号截断）；`hasAttribute('onmouseover') === true`；`data-x` = `y 可显式调用`
  - `outerHTML`：`<div class="slash-picker-row slash-picker-row-skill" data-index="2" title="/skill:pwn" onmouseover="document.documentElement.dataset.pwned=1" data-x="y 可显式调用">…`
  → **属性逃逸确认发生**，注入体成为真实属性。
  但真实鼠标划过该行后 `document.documentElement.dataset.pwned === null` —— 处理器未执行。
correction: |
  追加 CSP 对照探针（`/tmp/realm-uat48-csp-probe.js`），结论决定性：
  `src/index.html:8` 有 CSP `script-src 'self'`（无 `unsafe-inline`），内联事件处理器**不被编译**。
  同文档对照：`innerHTML` 注入的 `onmouseover` → 属性在但 `el.onmouseover === null`、真实 mouseover 派发后计数器未置位；
  程序化 `el.onmouseover = fn`（非内联）→ `typeof === 'function'` 且正常触发。`style` 属性注入**可行**（`style-src` 含 `unsafe-inline`）。
  → **本条实测推翻 48-REVIEW.md CR-01 原文「注入代码在主窗口 renderer 执行、持有全量 realmAPI」的定级依据**，
  残余影响降为 minor（CSS 注入 / UI 伪装 / 潜在 XSS），已全文回写 `48-REVIEW.md` 的 TD-48-01。
adjudication: 与 test 1 同源（CR-01）。已裁决「延后」→ 记 TD-48-01，**不新开 gap plan**；本行实测即其证据与定级更正。

### 6. {UAT} 真实 Electron 端到端：气泡视觉与 IPC 往返
expected: `npm run dev` → 输入 `/skill:<真实技能名> 参数` 回车 → 气泡 = 技能 pill + args 正文 + 可展开「技能正文（N 字符）」块；再输入 `/skill:<不存在>` → system-note「未找到技能「foo」，输入 / 查看可用技能」且零气泡；再输入一个已禁用技能 → system-note「技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用」；流式中调用技能能正常发出并流式回显。
result: issue
reported: "自动驱动实测（playwright _electron）：clause 1 失败（pill 与折叠块本次发送后不出现），clause 4 随 test 4 失败；clause 2 / 3 通过"
severity: major
observed: |
  **clause 1 ❌** `/skill:demo 你好世界`：
  - ✅ 气泡正文 = args `你好世界`（正确）
  - ❌ 发送后立即、以及整轮跑完后：`hasPill=false`、`hasBox=false` —— pill 与「技能正文」折叠块**都不出现**
  - ✅ 手动调用 `renderAIMessages()` 之后：pill 出现（文案 `技能demo`）、折叠块出现（`技能正文（94 字符）`）、默认折叠、正文 94 字符；点击表头 collapsed→expanded→collapsed 三态正确
  → **根因**：`src/renderer.js:8843-8846` 把 `result.skillInvocation` 回填到 `state.aiMessages` 里的 user 消息后**没有重渲染**；发送开始时那次 `renderAIMessages()` 发生在 IPC 返回之前，之后 `message_update` / `tool_execution_*` 只走 `updateStreamingBubble`（只替换 `.ai-message-content`）。故 pill/折叠块只在**下一次全量重渲染**（切对话、重载、/compact 等）才出现。
    这是 48-REVIEW.md 11 条 finding **之外的独立缺陷**（CR/IN 均未覆盖）。
  **clause 2 ✅** `/skill:definitely-no-such-skill`：system-note「未找到技能「definitely-no-such-skill」，输入 / 查看可用技能」，user 气泡数 1→1（推送后被撤），零新增气泡。
  **clause 3 ✅** `/skill:weather`（config 置 `settings.aiSkills.disabled=['weather']`）：system-note「技能「weather」已被禁用，可在 设置 → AI → 技能管理 重新启用」，user 气泡数 1→1。
  **clause 4 ❌** 「流式中调用技能能正常发出并流式回显」—— 与 test 4 同根因（CR-03 / G-48-4），不重复计一个 gap。
  ⚠ 主进程日志另有旁证：模型收到调用后尝试把 `demo` 当**工具**调用（`Tool demo not found` × 5）—— 弱模型对 `<skill>` 块的误读，非本阶段缺陷，记录备查。
decision: 缺陷成立，进 gap G-48-6（clause 4 归 G-48-4）

### 7. {UAT} 50+ 技能数据集下 220px 面板观感（48-02 backstop）
expected: 按 `48-VALIDATION.md` §Manual-Only Verifications 的脚本向 `skills/` 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区 —— 分组标题 sticky 常驻；行五要素可读；行尾标注 `flex-wrap` 后无一截断；（若有）「超数量上限」/「未进提示词 · 超预算」标注正确出现。
result: pass
verified_by: 自动驱动（playwright _electron），可量化项全部达标；主观「观感」由代理依据截图判定，用户可推翻
observed: |
  按文档脚本向 `skills/` 落 `skill-01`..`skill-50`（各含 `description: 测试技能 NN`），面板投影 = 55 项（53 技能行 + 2 命令行）。
  - **分组标题 sticky ✅**：`.slash-picker-group-header` 计算样式 `position: sticky`；滚到列表 50% 处，「技能」标题相对滚动容器顶偏移 **1px**（贴住）；滚到底时「命令」标题可见、位置正常。
  - **行尾标注 flex-wrap 后无截断 ✅**：`.slash-picker-status` 截断计数 **0**（15 条带标注行全部完整）；行 `flex-wrap: wrap`；标注行自然折成两行（行高 35 → 62px），**未裁切任何文字**。
  - **行五要素可读 ✅**：`emptyDesc = 0`（最短描述列仍有 62px，行高 35px 基准）；`/demo` 长描述按设计走 `text-overflow: ellipsis` 省略（`nowrap`+`ellipsis` 是既有设计，不是缺陷）。
  - **首屏可见行数 = 6**（滚动容器 clientH 218、行高 35）。滚动容器 = `#slashPickerPanel`（`max-height: 220px`）。
  - **限额标注正确出现 ✅**：`未进提示词 · 超预算` × **14**、`超数量上限` × **1**。
    算术核对：user 源 = `demo` + `weather` + 50 生成 = 52；`weather` 被禁用后计入限额的为 51 → 超限 1 条，与观测一致（超限口径不把已禁用技能计入）。
  - **面板宽度口径澄清**：文档写「220px 面板」有歧义。CSS 侧 `#slashPickerPanel { max-height: 220px }`（实测 clientH=218）指向**高度**；而 `.ai-panel` 的自然宽度在本机是 **600px**（`--ai-panel-width` 运行时被 renderer 以 inline 样式覆盖，改 CSS 变量无效）。两种口径都测了：自然 600px 与**强制 220px 宽**（inline `!important`）下，上述 sticky / 不截断 / 标注出现 / `emptyDesc=0` 结论**完全一致**，220px 宽下仅折行行数增至 17（行高 62px，仍可读）。
  - 截图：`/tmp/uat48-test7-top.png`、`-scrolled.png`、`-forced220.png`、`-forced220-bottom.png`。
note: |
  唯一人判项是「观感是否可接受」。代理判定可接受（截图见上）；行高 62px 的两行行在 220px 宽下仍完整可读。
  `48-VALIDATION.md` §Manual-Only 要求「若不可接受，只调面板高度常量，不得改动分组 / 标注结构」—— 本条**无需改动**。

### 8. {UAT} 模型自动匹配技能的可见性（DISC-05 核心）
expected: 在运行中的应用里提一个**命中某技能 description 的任务**（不手打 `/skill:`），观察模型是否自行 `read` 该技能的 `SKILL.md` —— 工具卡片标题显示「使用技能「name」」并带来源徽标；参数区仍显示实际读取路径；**切换对话再切回**后同一卡片标记仍在。另问「你有哪些技能」，模型应能区分技能与工具（D-18）。
result: [pending]

## Summary

total: 8
passed: 2
issues: 5
pending: 1
skipped: 0
blocked: 0

## Gaps

```yaml
- gap_id: G-48-6
  truth: "输入 `/skill:<真实技能名> 参数` 回车后，用户气泡应立即呈现三件套：技能 pill（文案「技能」+ 技能名）+ args 正文 + 默认折叠的「技能正文（N 字符）」块"
  status: failed
  reason: "自动驱动实测：发送后立即与整轮跑完时 pill / 折叠块均不存在（`hasPill=false`、`hasBox=false`）；手动调用 `renderAIMessages()` 后两者立即正确出现（pill 文案 `技能demo`、折叠块 `技能正文（94 字符）`、默认折叠、正文 94 字符、三态切换正常）。根因：`src/renderer.js:8843-8846` 回填 `result.skillInvocation` 后没有重渲染；发送起点那次 `renderAIMessages()` 早于 IPC 返回，之后流式更新只走 `updateStreamingBubble`（仅替换 `.ai-message-content`）。属 48-REVIEW.md 11 条 finding 之外的独立缺陷"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
```

```yaml
- gap_id: G-48-4
  truth: "AI 正在流式回复（或卡在工具确认卡片）时调用技能不得打断：新技能调用正常发出并流式回显；不出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示"
  status: failed
  reason: "自动驱动实测（真实 dev 应用 + MS/Qwen3-8B）：技能调用后新气泡在 t=7372ms 变为「用户已取消」并 15s 零增长，停止按钮即刻回退，`.ai-skill-pill` 未出现、无 system-note；主进程日志确认 `/skill:demo` 已收到 —— 新一轮输出完全不可见。机制与 48-REVIEW.md CR-03 第 3-5 步逐条吻合（`state.aiCancelledByUser` 在 abort 后不复位 → 迟到 error 按「当前消息 id」= 新气泡归属 → 后续 `message_update` 因 `aiCurrentMessageId === null` 全丢）"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
```

```yaml
- gap_id: G-48-3
  truth: "AI 正在流式回复时调用技能不得打断：新技能调用正常发出并流式回显；不出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示"
  status: failed
  reason: "User reported: 确定（2026-09-12 裁决方案 A）—— 发送路径的本地预检用可能陈旧的 `state.aiSkills` 快照否决调用（`known` / `known.disabled` 两段），违反 2026-09-11「调用瞬间实时读盘」硬约束；运行期新增技能 + 从未打开过 `/` 面板 → 「未找到技能」且输入框被清空，主进程无机会读盘"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
```

```yaml
- gap_id: G-48-2
  truth: "`frontmatter name ≠ 目录名` 的技能在面板列出且可选中，点击或手打 `/skill:<目录名>` 应能正常调用（调用瞬间实时读盘，注入以目录名为权威的正文），与 `docs/product/ai-skills.md` §10.4「能显式调用 ✅」一致"
  status: failed
  reason: "User reported: 修吧（2026-09-12 裁决按 CR-02 路径判据修复）—— `readSkillForInvocation`（`ai-skills-manager.js:806-811`）以「名字相等」当同一性判据，而名字正是合法会不一致的那个字段；`skills.find(s => s.name === name) || skills[0]` 的兜底被紧随其后的 `fresh.name !== name` 直接作废"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
```

## Deferred Follow-Ups

```yaml
- test: 1
  idea: "CR-01 面板行 `title` 属性逃逸注入 —— 裁决延后（用户 2026-09-12，「暂时不发版」为前提）"
  debt_ref: "48-REVIEW.md TD-48-01"
  owner_trigger: "Phase 49 开工前第一条（manage_skill 落地前）"
  deferred_at: 2026-09-12
  evidence_addendum: "test 5 实测（2026-09-12）：属性逃逸成立，但主窗口 CSP 拦掉内联处理器 → 代码不执行，定级由 blocker 更正为 minor；TD-48-01 已回写"
```

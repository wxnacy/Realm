---
phase: 48-skill-name
verified: 2026-09-12T14:33:42Z
status: human_needed
score: 44/52 must-haves verified
covered_files: [".planning/REQUIREMENTS.md",".planning/phases/48-skill-name/48-01-PLAN.md",".planning/phases/48-skill-name/48-01-SUMMARY.md",".planning/phases/48-skill-name/48-02-PLAN.md",".planning/phases/48-skill-name/48-02-SUMMARY.md",".planning/phases/48-skill-name/48-03-PLAN.md",".planning/phases/48-skill-name/48-03-SUMMARY.md",".planning/phases/48-skill-name/48-04-PLAN.md",".planning/phases/48-skill-name/48-04-SUMMARY.md",".planning/phases/48-skill-name/48-05-PLAN.md",".planning/phases/48-skill-name/48-05-SUMMARY.md",".planning/phases/48-skill-name/48-06-PLAN.md",".planning/phases/48-skill-name/48-06-SUMMARY.md",".planning/phases/48-skill-name/48-07-PLAN.md",".planning/phases/48-skill-name/48-07-SUMMARY.md",".planning/phases/48-skill-name/48-REVIEW.md",".planning/phases/48-skill-name/48-VALIDATION.md","AGENTS.md","ai-manager.js","ai-skills-manager.js","docs/product/ai-skills.md","ipc-handlers.js","src/ai-cancel-state.js","src/index.html","src/preload.js","src/renderer.js","src/skill-picker-model.js","src/styles/main.css","tests/test-ai-cancel-state.js","tests/test-ai-skills.js","tests/test-skill-picker-model.js"]
covered_digest: "v1:sha256:168a86b2a1aa591be30f3e233d7eddd9c61293f90f2c4654f92b11a8efefb32a"
behavior_unverified: 8
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 31/36
  previous_verified: 2026-09-12T12:25:00Z
  gaps_closed:
    - "G-48-12 **代码面**（48-07）：`_resolveSkillInvocation` 在 `readSkillForInvocation` 判 `not_found` 时经唯一权威入口 `syncAgentSystemPrompt()` 重扫**恰一次**后当场重读磁盘 —— 运行期新增的技能目录（managed / user 两根）无需打开 `/` 面板即可 `/skill:<新名>` 调用；`rescanCalls === 1` 同时钉住「确实重扫」与「不是循环」；`ai-skills-manager.js` 零 diff（本增量实测）"
  gaps_remaining:
    - "G-48-12 **运行期面**：真实 dev 应用里在 `agent-workspace/managed-skills/` 运行期新建技能目录（不打开 `/` 面板、不重启）后直接手打 `/skill:<新名>` 的端到端链路仍未实测 —— `48-UAT.md` 的 G-48-12 仍 `status: failed`（待重跑回填），`.planning/WINDOWS.md` unrun-verify **id 24** 仍 `status: open`。本轮为静态 + 单测面复验，**未**驱动真实应用"
  regressions: []
  history:
    - "round 1 | verified 2026-09-12T06:50:49Z | status human_needed | score 24/28 | gaps_closed [] | gaps_remaining [G-48-2, G-48-3, G-48-4, G-48-6] | regressions []"
    - "round 2 | verified 2026-09-12T12:25:00Z | status human_needed | score 31/36 | gaps_closed [G-48-2 / CR-02 判据改目录路径全等 + 注入名重写（48-04）; G-48-3 / CR-04 renderer 两段陈旧快照本地否决整段删除 + skills:changed 无条件重拉（48-06）; G-48-4 / CR-03 源码面 取消归属改锚点解算 + 独立纯逻辑模块（48-05）; G-48-6 气泡构建单源 + 回填后定向刷新（48-05）] | gaps_remaining [G-48-12] | regressions []"
    - "round 3（本轮 · 48-07 / G-48-12 代码面）| verified 2026-09-12T14:33:42Z | status human_needed | score 44/52 | gaps_closed [G-48-12 代码面 —— miss 一次性权威重扫 + 重试读盘，rescanCalls === 1，ai-skills-manager.js 零 diff] | gaps_remaining [G-48-12 运行期面（UAT test 12 / WINDOWS.md id 24）] | regressions []"
open_deferrals:
  - id: TD-48-01
    origin: "48-REVIEW.md CR-01（面板行 `title` 属性经 `escapeHtml` 注入 —— `escapeHtml` = `textContent → innerHTML`，不转义 `\"`）"
    adjudicated: 2026-09-12
    disposition: "延后，登记为技术债（前提：暂时不发版）；接手触发点 = Phase 49 开工前第一条（`manage_skill` 落地前）"
    measured_impact: "UAT test 5 实测：属性逃逸成立，但主窗口 CSP `script-src 'self'` 使内联事件处理器不被编译 → 残余影响降为 minor（CSS 注入 / UI 伪装 / 潜在 XSS）"
    must_have_effect: "无 —— 48-02 禁止项的字面要求（插值全部经 `escapeHtml()`、tier → class 走白名单查表）仍然成立，故 truth 34 记 VERIFIED；本条按用户裁决作为已跟踪的开放延后记录，不重开为 BLOCKER"
    code_untouched_this_round: "src/renderer.js 在本轮增量（48-07）中零 diff —— 缺陷形态与行号均未变"
  - id: TD-48-02
    origin: "48-REVIEW.md CR-05（`aiCancelledByUser` / `aiCancelledMessageId` 无正常结算清理点，窄竞态下跨轮污染）"
    adjudicated: 2026-09-12
    disposition: "延后，登记为技术债；接手触发点 = Phase 49 开工前（与 TD-48-01 同批）；不要求本阶段 UAT 实测"
    must_have_effect: "有 —— 使 truth 25（G-48-4 运行时半边）无法记 VERIFIED，故该 truth 维持 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED 并进 human_verification"
    code_untouched_this_round: "src/renderer.js 在本轮增量中零 diff"
  - id: WR-06
    origin: "48-REVIEW.md WR-06（`SKILL.md` 超 64 KiB 的已缓存技能在实时读盘路径绕过字节闸）"
    adjudicated: 2026-09-12
    disposition: "用户裁决**保持开放**，随 Phase 49 一并处置；48-07 已在 `docs/product/ai-skills.md` §10.7 显式写明「本条未被修复…**不得**据此声称已修」——账本诚实"
    must_have_effect: "无 —— 48-01 的字节闸 truth 只约束扫描路径的长度常量语义，不宣称调用路径复查"
behavior_unverified_items:
  - truth: "DISC-05（truth 29）：模型仅凭 description 自动匹配技能并 read 其正文（用户不显式调用也能生效）"
    test: "在运行中的应用里提一个命中某技能 description 的任务（不手打 `/skill:`），观察模型是否自行 read 该技能的 SKILL.md"
    expected: "模型自发调用 read 读取技能目录下的 SKILL.md，工具卡片标题显示「使用技能「name」」"
    why_human: "模型侧行为依赖真实 LLM 推理；node:test 只能断言「description 已进 system prompt」「read 事件带 skill_invocation」「卡片按标记渲染」三个机制面。UAT test 8 已实测①（匹配到之后的可见性 + 重载持久化）端到端通过；②（模型自发遵守 SDK 指令）未发生，归因于模型能力（本机仅 Qwen3-8B 可用），登记为已知限制"
  - truth: "G-48-4 运行时半边（truth 25）：AI 正在流式回复（或卡在工具确认卡片）时调用技能 → 新气泡不被写成「用户已取消」、其后不出现零增长、停止按钮不提前回退"
    test: "`npm run dev` → 发一条长回复 prompt → 流式中手打 `/skill:<真实技能名>` → 采样 15s"
    expected: "新技能调用正常发出并流式回显；`.ai-skill-pill` 出现；新气泡正文持续增长；停止按钮保持 stop-mode 直到本轮结束"
    why_human: "abort × 新消息是运行时竞态（`ai:abort` 同步返回 + 迟到 error 的到达顺序），node:test 只覆盖纯逻辑判定与接线契约。另见 48-REVIEW.md CR-05（→ TD-48-02，标记生命周期未闭合），该残余是同一状态机的相邻不变式，故本条不得记为 VERIFIED"
  - truth: "G-48-6 运行时半边（truth 26）：发送 `/skill:<name> <args>` 后，**本轮回合结束（`ai:prompt` 应答返回）时**用户气泡即含技能 pill 与默认折叠的「技能正文（N 字符）」块（口径收口：2026-09-12 用户裁决按实现时机改措辞，原「回车那一刻立即」不再作为验收要求；见 48-REVIEW.md WR-05 裁决段与 docs §10.8）"
    test: "`npm run dev` → 输入 `/skill:<真实技能名> <args>` 回车，**不做任何额外交互**，在「整轮回复跑完时」检查 `.ai-skill-pill` / `.ai-skill-content-box`"
    expected: "整轮回复跑完时存在 pill 与折叠块（默认折叠、点击可展开）；**不需要**切换对话 / 重载 / `/compact` 触发"
    why_human: "DOM 渲染时机属运行时行为，node:test 无 DOM 宿主。`refreshUserMessageBubble` 的唯一触发点是 `ai:prompt` 应答返回之后（`renderer.js:8816`，应答在 `agent.waitForIdle()` 之后才解析），因此呈现时刻 = 本轮回合结束 —— 该措辞已由用户 2026-09-12 裁决收口（原「发送后立即」不成立，48-REVIEW.md WR-05）"
  - truth: "48-02 backstop（truth 20）：50+ 技能数据集下 220px 面板的分组标题 sticky 常驻、行五要素可读、行尾标注无一截断"
    test: "按 48-VALIDATION.md §Manual-Only Verifications 的脚本向 skills/ 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区"
    expected: "分组标题 sticky 常驻；行五要素可读；行尾标注 flex-wrap 后无一截断"
    why_human: "纯视觉观感（sticky 常驻、换行行高、徽标对比度）无法由源码扫描或 node:test 裁决。UAT test 7 已由自动驱动实测判 pass（sticky 偏移 1px、截断计数 0、emptyDesc 0、限额标注 14+1 与算术一致），本项保留为人工可推翻的观感裁决"
  - truth: "真实 Electron 端到端（truth 28）：手打 `/skill:name` 后气泡显示「技能」微标 + args 正文 + 默认折叠的技能正文块；未找到 / 已禁用走两条 system-note；流式回复中调用技能不被丢弃"
    test: "`npm run dev` → 输入 `/skill:<真实技能名> 参数` 回车；再输入 `/skill:<不存在>`；再输入一个已禁用技能；再在 AI 回复流式进行中点面板技能行"
    expected: "命中时气泡 = 技能 pill + args 正文 + 可展开「技能正文（N 字符）」块；两条失败走各自 system-note 且零残留气泡；流式中调用能正常发出并流式回显"
    why_human: "IPC 往返 + 主进程实时读盘 + 流式事件时序属运行时行为；node:test 只覆盖源码契约与纯函数。UAT test 6 的 clause 2（未找到）/ clause 3（已禁用）已实测通过，clause 1 与 clause 4 待重跑"
  - truth: "G-48-12 运行期靶心（truth 44 / 48-07 D2）：真实 dev 应用里在 `agent-workspace/managed-skills/`（或 `skills/`）运行期新建技能目录 —— **不打开** `/` 面板、不重启、不重建 Agent —— 直接手打 `/skill:<新名> [args]` 即正常调用"
    test: "重跑 UAT test 12（B / B2 判别性复测形态）：dev 应用内创建 `managed-skills/<新名>/SKILL.md` → **不打开** `/` 面板 → 直接手打 `/skill:<新名>`，观察是否仍有 system-note「未找到技能「<新名>」，输入 / 查看可用技能」以及主进程是否出现 `发送消息: /skill:<新名>` 日志"
    expected: "请求到达主进程并由其当场读盘 → 正常调用、流式回显；**不再**出现「未找到技能」note；主进程日志出现该请求（失败期实测：14ms 内出 note + 主进程零请求）"
    why_human: "重扫 → 缓存 → 读盘 → IPC 往返是运行时组合；J 组单测只钉住调用侧契约与三字段来源（在 Node 宿主里用真实 `createSandboxEnv` + 真实 `refreshSkills` + 真实 SDK，但**不**经 Electron IPC 与 renderer）。G-48-12 的 UAT 条目仍 `status: failed`（待回填），`.planning/WINDOWS.md` unrun-verify id 24 仍 `open`"
  - truth: "重扫抛错路径（truth 43）：`syncAgentSystemPrompt()` 抛错时被就地 catch + `console.warn` 后**保留原判定**，不把「未找到」升级成异常（也不动 `isProcessing` 的既有复位职责）"
    test: "`npm run dev` → 手打一个**不存在**的技能名 `/skill:<不存在>`；随后立即再发一条普通消息，确认交互未被锁死"
    expected: "出现 `skill_not_found` 的 system-note；随后普通消息仍能正常发送与流式回显（`isProcessing` 已复位、输入框未被「AI 正在处理上一条消息」静默丢弃）"
    why_human: "该分支**零行为用例**（现有护栏只是 `body.includes('console.warn')` 的字符串存在性断言），无法覆盖「保留原判定 / 不逃逸异常 / 不重复读盘」语义 —— 48-REVIEW.md WR-08 已逐条论证（catch 体直接读 `err.message`、重试读盘在 `try` 之外、判据是「替换」而非「保留」）。正确修法与配套用例见 WR-08 的 Fix 段"
  - truth: "延后写回 / 广播的落地时机（truth 45）：重扫置脏后，prompt 回写与 `skills:changed` 广播在「下一个非忙同步点」落地，从而运行期新增技能进入 system prompt 列表（模型自动匹配面）与其它窗口的面板投影"
    test: "（① 端到端观感）在纯文本流下调用过一次运行期新增技能后，**不打开** `/` 面板，发一条带 `@` 引用或附件的新消息，观察模型是否已能看到该技能（例如追问「你有哪些技能？」）；（② 裁决）判定采纳 48-REVIEW.md WR-07 的哪条修法"
    expected: "理想：回写与广播在带引用/附件的那一轮结束时落地，模型能看到新技能。现状（WR-07 实读确认）：`_skillsPromptDirty` 的唯一消费点在 `promptWithContext`（`ai-manager.js:1325`），`prompt()` 成功出口（`:1084-1088`）**无**补刷 —— 纯文本流上该标记无限期保持 true，回写与广播**不会**落地（只有打开面板 / Agent 重建 / 带引用附件的那一轮才落地）"
    why_human: "既是运行时时机（广播 → renderer 重拉 → 面板/模型可见），也是**口径裁决**：「补 flush」（WR-07 修法 ①，约 6 行）或「收口措辞」（修法 ②，把 `ai-manager.js:1433` 与 `docs §10.7:402` 的『下一轮 idle 边界』改为『下一轮带 @ 引用或附件的结束』）。本条不 falsify 任何已登记 must-have（G-48-12 的**显式调用**面已闭合），但 Phase 49 的 AI 自建技能若依赖模型自发感知新技能，应选 ①"
human_verification:
  - test: "重跑 UAT test 12（G-48-12 靶心，B / B2 判别性复测）：`npm run dev` → 在 `agent-workspace/managed-skills/` 下新建一个技能目录（**不打开** `/` 面板、不重启）→ 直接手打 `/skill:<新名> [args]`"
    expected: "请求到达主进程并由其当场读盘 → 正常调用、流式回显；**不再**出现「未找到技能」system-note；主进程日志出现 `发送消息: /skill:<新名>`。（该探针即 `.planning/WINDOWS.md` unrun-verify id 24，48-07 已更正其机制描述、status 保持 `open`）"
    why_human: "IPC 往返 + 主进程实时读盘 + 重扫/缓存时序属运行时行为。本轮（48-07）只落地并证成**代码面**（J 组 7 例）；G-48-12 的 `48-UAT.md` 条目仍 `status: failed`，须由自动驱动探针回填后才可收尾"
  - test: "重跑 UAT test 6 clause 1：`npm run dev` → 输入 `/skill:<真实技能名> <args>` 回车，**不做任何额外交互**，在「整轮回复结束后」采样 `hasPill` / `hasBox`"
    expected: "**整轮回复结束时**必有 pill 与折叠块。口径已收口（2026-09-12 用户裁决）：呈现时刻 = 本轮回合结束，**不要求**回车那一刻即现 —— 故只需验后半边；`docs/product/ai-skills.md` §10.8 已同步该措辞"
    why_human: "DOM 渲染时机 + IPC 往返属运行时行为；truth 措辞已按实现时机收口（48-REVIEW.md WR-05 裁决段）"
  - test: "重跑 UAT test 4：`npm run dev` + 可用 provider → 发一条长回复 prompt，等首气泡确实有正文（停止按钮已亮）→ 流式中手打 `/skill:<真实技能名>` → 每 250ms 采样 15s"
    expected: "新气泡创建后有内容、持续增长；**不得**在 t≈7.4s 被写成「用户已取消」、不得其后 15s 零增长、停止按钮不得在 t≈0 就回退；`.ai-skill-pill` 应出现"
    why_human: "运行时竞态；UAT test 4 上一轮实测失败，锚点修复后须实测裁决是否真的闭合。相邻不变式 TD-48-02 已裁决延后，故本项不计入本轮 BLOCKER"
  - test: "重扫抛错路径的端到端兜底：`npm run dev` → 手打一个**不存在**的技能名 `/skill:<不存在>` → 立即再发一条普通消息"
    expected: "出现 `skill_not_found` system-note；随后普通消息仍能正常发送与流式回显（`isProcessing` 已复位、输入框未被『AI 正在处理上一条消息』静默丢弃）"
    why_human: "该分支零行为用例（48-REVIEW.md WR-08），只能靠实测确认「异常不逃逸 + 判定不升级 + 轮次状态可复位」"
  - test: "48-REVIEW.md CR-05 / TD-48-02 的可达性实测（若采纳「先定口径」路线则可跳过）：在流式结束的瞬间连点两次停止按钮，随后触发一次任意真实错误（如临时把 provider key 改错）"
    expected: "下一轮的真实错误仍走 `showAIError`（有提示 + 重试按钮），**不得**被当成取消消费、不得把上一轮已完成回复正文覆盖为「用户已取消」、不得使 `aiStreaming` 永不复位"
    why_human: "TD-48-02 是从状态机 + SDK 语义推出的窄竞态路径（`abort()` 打在已结算 run 上是静默 no-op），无任何测试覆盖。已由用户 2026-09-12 裁决延后，不阻断本阶段收尾，但须人工裁决修复时机"
  - test: "G-48-3 运行期探针（与 UAT test 12 同源）：在 `agent-workspace/managed-skills/` 下新建一个技能目录（**不打开** `/` 面板），直接手打 `/skill:<新名>`"
    expected: "请求到达主进程并由其当场读盘 → 正常调用（不再出现「未找到技能」且输入框被清空）"
    why_human: "48-06 已闭合 renderer 半边（零本地否决 + 无条件重拉），48-07 已闭合主进程半边（miss 一次性权威重扫）—— 但两半合起来的端到端链路仍须一次实测；本条与 UAT test 12 是同一探针，已合并保留，不重复计数"
  - test: "DISC-05 模型侧复核（可选，已知限制）：在不手打 `/skill:` 的前提下提一个命中某技能 description 的任务，并追问「你有哪些技能？它们和你可用的工具有什么区别？」"
    expected: "理想：模型自行 `read` 该 SKILL.md，卡片标题「使用技能「x」」。已知：弱模型（Qwen3-8B）会把技能名当**工具**调用并得到 `Tool x not found`，且答「需通过 `/skill:` 显式调用」"
    why_human: "SDK 提示词模板已写明「Read the full skill file when the task matches its description.」并给出 `<location>` 绝对路径 —— Realm 侧接线无误，失败完全归因于模型能力；本机唯一可用 provider 为 Qwen3-8B，无法换更强模型复测。已作为观测写入 48-REVIEW.md IN-04（留给 Phase 50/51 的技能 UX）"
advisory:
  - finding: "WR-07：48-07 的「忙时只置脏，回写与广播延后到下一次非忙同步点」在**纯文本流**上永不落地 —— `_skillsPromptDirty` 的唯一消费点在 `promptWithContext`（`ai-manager.js:1325`），`prompt()` 成功出口无补刷；而 renderer 只在有 `@` 引用/附件时才走 `promptWithContext`。后果：运行期新增技能对**模型自动匹配**与**其它窗口面板投影**在纯文本流下一直不可见（打开面板 / Agent 重建 / 带引用附件的那一轮才落地）"
    category: architectural
    reason: "本轮**独立复核成立**（实读 `_skillsPromptDirty` 读写点 + `prompt()` 成功出口），但机制**既有**（46 D-03 的置脏 + 单点消费）、本增量只是把置脏从罕见情形放大成常规情形；不产生错值、不破坏已完成回复、不卡死交互，故记 Warning 而非 Blocker，并作为口径裁决项进 human_verification"
    evidence_status: "independently reproduced（源码实读；48-REVIEW.md WR-07）"
  - finding: "WR-08：「重扫抛错就地 catch + 保留原判定 + 不升级为异常」只被**字符串存在性**断言（`body.includes('console.warn')`）承载，零行为用例；且 catch 体直接读 `err.message`（`throw null` 时二次抛错）、重试读盘在 `try` 之外、catch 后是「替换」原判定而非字面「保留」"
    category: other
    reason: "实现的可观测语义（重扫失败仍返 `skill_not_found`、不逃逸异常）在当前实现下成立，产品文档的承诺（「失败语义不变，仍只有两个结果」）被守住；失配的是**代码注释的更强措辞**与测试面缺口。故不让 truth 43 记 VERIFIED（改记 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED），但不升为 Blocker"
    evidence_status: "source-read verified（`ai-manager.js:1460-1468` 实读；48-REVIEW.md WR-08）"
  - finding: "IN-12：`docs/product/ai-skills.md` §10.7（`:390-392`）的 G-48-4 + G-48-6 条目仍写「三件套**即时**呈现」，与同文件 §10.8（`:418-423`）已按 2026-09-12 裁决收口的「本轮回合结束时即现…**不是回车那一瞬间**」互相排斥"
    category: other
    reason: "该行为 48-05/48-06 遗留（非本增量引入），但 48-07 恰好编辑同一节（在尾部追加 G-48-12 三条）却未顺手收口，成本一行；文档内部自相矛盾会被下一个改动者读到错的那一半"
    evidence_status: "independently reproduced（两处原文实读）"
  - finding: "IN-09 / IN-10：§10.3 第 1 条与第 2 条自相矛盾（是否复用「重扫产出的元数据」—— 实现在第 2 条一侧，不复用的**只有正文副本**）；§10.7 的「缓存命中时零重扫」比实测更强（真不变式 = 命中**且当场读盘成功**时零重扫）"
    category: other
    reason: "文档措辞精度问题，不 falsify 任何 must-have（48-07 PLAN 的 truth 措辞本身是准确的，含「命中但读盘为空仍会多一次重扫」）"
    evidence_status: "independently reproduced（`ai-skills-manager.js:803-830` 四个 not_found 出口实读）"
  - finding: "WR-01 / WR-02 / WR-03 / WR-04 / WR-05 与本轮新 WR-07 / WR-08：上一轮全部仍开（WR-05 为「已裁决收口措辞」，残余转记 IN-12）"
    category: other
    reason: "均为已记档的技术债 / 观测项，无一 falsify 已登记 must-have 真值；48-07 的 prohibition 明文禁止顺手修 WR-01..06，本增量遵守"
    evidence_status: "carried-forward（48-REVIEW.md §A 台账逐条实读，本轮未独立复跑其探针）"
---

# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`）Verification Report

**Phase Goal:** 用户可在聊天输入框用 `/` 发现技能、以 `/skill:name` 调用；模型也能按 description 自动匹配技能并读取其正文。
**Verified:** 2026-09-12T14:33:42Z（22:33 +08:00）
**Status:** human_needed
**Re-verification:** Yes — gap closure 第 3 轮。上一轮 `2026-09-12T12:25:00Z`（`human_needed`，`31/36`）之后，UAT round 2 实测把 **G-48-12**（运行期新增技能不可调用）判为 `issue`，由 **48-07** 在**主进程调用侧**闭合其代码面。

## Goal Achievement

> **本轮结论摘要**：48-07 的交付面**全部核实为真**（miss 一次性权威重扫 + 重读盘、有界、三字段同源、快路径零重扫、忙时只置脏、权威侧零 diff、J 组 7 例实测 139/139）。**无 must-have 真值 FAILED、无 artifact MISSING/STUB、无 key link NOT_WIRED、无未引用债标记。** 但 **G-48-12 的运行期靶心仍未被任何测试或探针行使**（`48-UAT.md` 该条目仍 `status: failed`、`WINDOWS.md` id 24 仍 `open`），且本轮新增两条已记档 Warning（WR-07 纯文本流下回写/广播永不落地；WR-08 重扫抛错分支零行为用例）—— 三条运行时/错误路径真值落 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED，故本阶段维持 `human_needed`，**不得** complete。

### Observable Truths

> 行 1–36 为上一轮已登记真值的回归复核（本轮 48-07 只改 `ai-manager.js` 的一个方法体 + 测试/文档/账本，`src/renderer.js`、`ipc-handlers.js`、`src/preload.js`、`src/index.html`、`src/styles/main.css`、`ai-skills-manager.js` 本轮**零 diff**，故按「存在 + 基本体检」复核）。行 37–52 为 48-07 增量真值与禁止项。
> 行号说明：48-07 在 `ai-manager.js` 的 `_resolveSkillInvocation` 处插入 ~45 行，**该文件 1413 行之后的引用本轮已按当前文件更新**（例：`_resolveSkillMarker` 1612→**1655**、`skill_invocation:` 1693→**1736**、`skillErrorFromReason` 6089→**6132**、`_resolveSkillMarker` 重载调用点 2707→**2750**）；≤1413 的引用不变。

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 / DISC-01：输入 `/` 后面板同屏分区列出「技能」（在上）与「命令」；0 项分区标题不输出 | ✓ VERIFIED | `src/skill-picker-model.js` `filterPickerItems`/`buildPickerItems`（本轮未变）；`tests/test-skill-picker-model.js` 本轮实跑 `# tests 95 / # pass 95 / # fail 0`；`renderSlashPickerList`（`renderer.js:10374+`） |
| 2 | D-01：`state.slashPickerItems` 是展平单数组且数组顺序 === 视觉顺序；标题不占索引；点击 / hover 按扁平 `data-index` 直绑 | ✓ VERIFIED | `renderer.js:10374-10440`（未变）；B 组接线断言本轮实跑通过 |
| 3 | D-03：命令分区语义与相对顺序零变化（原 token `startsWith`） | ✓ VERIFIED | B 组对同一 `rawFilter` 与 `SLASH_COMMANDS.filter(c => c.name.startsWith(rawFilter))` 做 `deepStrictEqual`；`renderer.js:344-347` 数组字面量恒 2 项 |
| 4 | DISC-04：行五要素（`/{name}` + 三档来源徽标 + `仅显式` + 单行截断描述 + 行尾标注）；禁用不渲染；`shadowed`/同名命令灰显不可选；超限可选中带标注 | ✓ VERIFIED | `renderer.js:10412-10440`；B 组 selectable 三例 + 状态标注优先级（本轮实跑 95/95） |
| 5 | DISC-01：↑↓ 只在可选中集合上取模并跳过灰显行；全部不可选 → `activeIndex = -1`，Enter 回落既有 `executeActiveSlashCommand() === false` 路径 | ✓ VERIFIED | B 组导航取模 8 例；`renderer.js:10155+` |
| 6 | D-17 / P-48-06：面板 stale-while-revalidate（快照即时渲染 → 后台 `refreshSkills` → 广播只重拉 + digest 早退）；无 loading 态；失败保留旧快照；renderer `.refreshSkills(` 调用点唯一 | ✓ VERIFIED | 本轮实测 `grep -c "\.refreshSkills(" src/renderer.js` = **1**；`pullAiSkillsSnapshot`（`:9081-9089`）digest 早退；G 组 5 例 + C 组自激护栏 |
| 7 | SC2 / DISC-02：`/skill:name [args]` 与裸 `/name [args]` 一致解析（本地命令优先、严格前缀 + 空白边界、`^[a-z0-9-]+$`） | ✓ VERIFIED | A 组 32 例（含反例）；`parseSkillInvocationText` 与 `parseSkillRef` 跨进程一致性断言（本轮 139/139 全绿含之） |
| 8 | DISC-02：技能正文在**调用那一刻**从磁盘读取；空串 / 仅空白 / 目录读不到 → `not_found`（绝不产字面量 `undefined`） | ✓ VERIFIED | `ai-skills-manager.js:802-834` 实读（每次 `import(...)` + `loadSkills(env, dirname)` 重读盘）；48-07 J 组「改盘后二次调用读到新正文」再次实测 |
| 9 | DISC-02：`<skill>` 块逐字节 === `formatSkillInvocation(skill, provenance + '\n\n' + args)` | ✓ VERIFIED | D 组用**真实 SDK** `formatSkillInvocation` 构造期望值，三例全等（48-07 J 组未触及该路径） |
| 10 | D-07：拼接顺序 `[skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]`；无技能调用时输出与改动前逐字符相同 | ✓ VERIFIED | `ai-manager.js:1290` 实读（字面量与 48-07 前逐字一致 —— 该行位于插入点之前，行号未漂移） |
| 11 | DISC-03：`_ensureConversation(message)` 保持原始语法文本（对话标题不退化），注入只发生在 `agent.prompt` | ✓ VERIFIED | `ai-manager.js:1060` 实读 `this._ensureConversation(message)`；`_ensureConversation(enhanced` 命中 0 |
| 12 | D-06：user 气泡 `content` = args 原文；重开对话由 `getConversationMessages` 还原同形 `{content: args, skillInvocation:{name,tier,content}}`（含 `@` 引用 / 附件 / args 含空行 / **空 args 四形态**） | ✓ VERIFIED | D 组「重载装饰（八例）」+ `resolveSkillBubbleArgs` 打表；两趟扫描规则实读 |
| 13 | D-19：两条重发路径（`regenerateMessage` / `showAIError` 重试）经 `buildResendPayload`（唯一实现）由 args + name 重组完整语法文本；空 args 时载荷非空 | ✓ VERIFIED | `function buildResendPayload(` 命中数 = 1；C 组往返表；F 组两处 `await ... ai.prompt(payload)` 源码断言 |
| 14 | DISC-03：技能调用**进入对话历史并触发 LLM**（与本地 `clear`/`compact` handler 语义区分） | ✓ VERIFIED（机制面） | `renderer.js:8697-8709` 技能分支只记录 `skillRef` 后走既有发送链；48-07 未触及该路径。真实 LLM 回复面归 UAT |
| 15 | DISC-04：`getSkillsForUI` 收窄投影（**不含** `content`/`filePath`/`diagnostics`）+ 三档 `tier` 由主进程唯一计算 + `promptOmitted` 只打在预算丢弃的 eligible 条目 | ✓ VERIFIED | `ai-skills-manager.js:707-720` / `:684` / `:761-767` / `:609`（本轮零 diff）；D 组三例 |
| 16 | DISC-06：技能不存在 / 已禁用 → 结构化 `skillError`（`skill_not_found` / `skill_disabled` 两码两文案，无第三码），主进程不调用 `agent.prompt` | ✓ VERIFIED | `ai-manager.js:6132-6142`（`skillErrorFromReason` 唯一来源，行号 6089→**6132**）；`:1470-1473`（失败即返回 `skillError`）；48-07 J 组两条负例再次钉住码域 |
| 17 | DISC-07：`disableModelInvocation` 的技能不进 system prompt、仍可经 `/skill:` 显式调用、与 `disabled` 互不蕴含、永不 `promptOmitted` | ✓ VERIFIED | D 组四条可失败断言 + flag 独立性一例 |
| 18 | DISC-05：`read` 打开技能目录 `SKILL.md` → `tool_execution_start` 带 `skill_invocation = {name,tier}`；非 `read` / 缺 `path` / `path` 非字符串 / basename ≠ `SKILL.md` / 工作区外 / 无 `sandboxEnv` → `null` 且不抛错 | ✓ VERIFIED | `ai-manager.js:1655-1661`（`_resolveSkillMarker` 五道守卫实读，行号 1612→**1655**）、`:1736`（`skill_invocation: this._resolveSkillMarker(...)`，1693→**1736**）；H 组四类路径 + 四条负例 |
| 19 | DISC-05：renderer 把事件字段落到 `toolExecution.skillInvocation`；`renderToolCard` 技能变体标题「使用技能「name」」+ `TIER_BADGE` 白名单徽标、全 `textContent`；判定只在主进程（renderer **零**路径匹配）；重载链路同一实现 | ✓ VERIFIED | `renderer.js:9364` / `:9579-9586`（本轮零 diff）；`grep -c "matchSkillByPath\|path\.resolve" src/renderer.js` = **0**；`ai-manager.js:2750` 重载走同一 `_resolveSkillMarker`（2707→**2750**） |
| 20 | 48-02 backstop：50+ 技能下 220px 面板观感（sticky 常驻 / 五要素可读 / 标注不截断） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 结构面齐备（`.slash-picker-group-header` sticky + 显式背景、行 `flex-wrap`、`max-height: 220px` 零改动），但纯视觉观感不可自动化裁决。UAT test 7 已由自动驱动实测判 pass → 见 Human Verification |
| 21 | **【G-48-3】闭合态**：发送 `/skill:<name>` 时 renderer **零本地否决** —— 请求一定到达主进程，由它当场读盘裁定 | ✓ VERIFIED | `renderer.js:8692-8709`（本轮零 diff）；源码探针 `state.aiSkills` 全文件 7 处均落面板侧与 state 声明；`tests/test-ai-skills.js` F 组 + `test-skill-picker-model.js` 同款断言本轮实跑通过 |
| 22 | **G-48-3b**：`skills:changed` 广播到达即**无条件** `pullAiSkillsSnapshot()`，且**绝不**触发 `refreshSkills()`（自激回路 P-48-06 不回归） | ✓ VERIFIED | `renderer.js:4405-4409`（零 diff）；全文件 `.refreshSkills(` 计数本轮实测 = **1** |
| 23 | **【G-48-2】闭合态**：`frontmatter name ≠ 目录名` 的技能面板可见可选，`/skill:<目录名>` 可正常调用，注入用 name = **目录名** | ✓ VERIFIED | `ai-skills-manager.js:817-833` 实读判据为目录路径全等（本轮零 diff）；`tests/test-ai-skills.js` 三条新用例随 139/139 全绿 |
| 24 | **【G-48-4a 源码面】闭合态**：迟到的取消事件按**锚点**解算；`resetRunState` 只由锚点等式决定；两处对话切换清空锚点 | ✓ VERIFIED | `src/ai-cancel-state.js:46-60`（零 diff）；`renderer.js:9387-9413` / `:7214-7215` / `:7252-7253`；`tests/test-ai-cancel-state.js` 本轮实跑 `14/14` |
| 25 | **【G-48-4b 运行时面】**：流式中（含卡在工具确认卡片）调用技能 → 新气泡不被写成「用户已取消」、其后不零增长、停止按钮不提前回退 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码契约与纯逻辑判定齐备（truth 24），但「abort × 新消息」是运行时竞态，无测试覆盖；且 **TD-48-02（原 CR-05）** 指出相邻不变式（标记生命周期）仍未闭合 → 本条不得记 VERIFIED。见 Human Verification |
| 26 | **【G-48-6】**：发送 `/skill:<name> <args>` 后**无需任何额外交互**，用户气泡在**本轮回合结束时**即含 `.ai-skill-pill` 与默认折叠的 `.ai-skill-content-box`（口径已收口） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 单源构建 `buildUserMessageContent`（`renderer.js:8973`）+ 三处回填后定向刷新（`:8816` / `:10006` / `:10083`）+ `replaceChild`（`:8198-8202`）实读；呈现时刻 = 本轮回合结束，口径已由用户 2026-09-12 裁决收口。见 Human Verification |
| 27 | **48-06 单源护栏**：两条失败文案的唯一来源在主进程 `skillErrorFromReason`，renderer **零复制** | ✓ VERIFIED | 本轮实测 `grep -c "未找到技能" src/renderer.js` = **0**；`ai-manager.js:6132-6142` 两条文案字面量仍在；两套测试跨文件成对钉住 |
| 28 | 真实 Electron 端到端：气泡三件套 / 两条 system-note / 流式中调用技能不被丢弃 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码与静态断言齐备；UAT test 6 的 clause 2/3 已实测通过；clause 1/4 待重跑 |
| 29 | DISC-05：模型**仅凭 description 自动匹配**技能（用户不显式调用也能生效） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 机制三面均有断言，但「模型是否自发匹配」须真实 LLM。①（匹配到之后的可见性 + 徽标 + 路径 + 重载还原）端到端证成；② 归因模型能力（本机 Qwen3-8B），记 48-REVIEW IN-04 |
| 30 | 文档同步（48-03 + 48-06）：`docs/product/ai-skills.md` §10 全量 + §七 测试清单；`AGENTS.md` 测试清单登记 | ✓ VERIFIED（附带 IN-12 残余） | §10.8 `###` 标题位于 §10.7 之后；§10.7 含「无条件重拉」且全文不含旧限定「仅在面板打开时」；§七 例数 48-07 已刷为 **139（实测）**；`AGENTS.md:267` 本轮新增 `node tests/test-ai-skills.js`（139 例）条目。**残余**：§10.7 `:390-392` 仍写「即时呈现」与 §10.8 冲突 → 记 IN-12（advisory），不 falsify 本条 |
| 31 | 禁止项：本阶段**零新增技能写路径** | ✓ VERIFIED | `ai-skills-manager.js` 本轮零 diff；48-07 的 `ai-manager.js` 新增行只有重试块 + JSDoc（`git diff` 实读），无创建 / 修改 / 删除入口 |
| 32 | 禁止项：技能条目不得并入 `SLASH_COMMANDS` | ✓ VERIFIED | `renderer.js:344-347` 数组字面量项数 = 2，无 `SLASH_COMMANDS.push`（零 diff） |
| 33 | 禁止项：renderer 不重算技能集状态（优先级 / 遮蔽 / 限额 / 预算省略 / 档位，只消费投影） | ✓ VERIFIED | `src/renderer.js` 与 `src/preload.js` 内 `64 * 1024` / `65536` / `8000` / `MAX_USER_SKILLS` / `localeCompare` / `/api/skills` 命中数全为 **0**（两文件本轮零 diff） |
| 34 | 禁止项（48-02）：面板 `innerHTML` 模板内插入的 `name` / `description` / 行尾标注 / `title` **全部**经 `escapeHtml()`；tier → class 走白名单查表 | ✓ VERIFIED（开放延后：TD-48-01） | `renderer.js:10417-10435` 逐条插值均在 `escapeHtml(...)` 内；**但** `escapeHtml`（`:11349-11353`）= `textContent → innerHTML` 不转义 `"` —— 已由用户 2026-09-12 裁决登记为 `TD-48-01`（延后，接手触发点 = Phase 49 开工前第一条）。**禁止项字面要求成立 → 记 VERIFIED**，延后记录见 `open_deferrals` |
| 35 | 禁止项（48-03）：技能化不额外插 system-note、不改 `.tool-card` 既有规则、不新增卡片形状；存储层无技能域知识 | ✓ VERIFIED | H 组四条既有规则体内零命中新类 / 文案；`ai-conversations-manager.js` 内 `skillInvocation` 命中 0（零 diff） |
| 36 | 禁止项（48-05）：不得用整列 `renderAIMessages()` 冒充 G-48-6 修复；不得删除 `aiCancelledByUser` / 改写「用户点停止」既有语义 | ✓ VERIFIED | `refreshUserMessageBubble` 用 `replaceChild`（`:8198-8202`，函数体不含 `innerHTML = ''`）；`aiCancelledByUser` 仍在（声明 / 置位 / 消费）—— `renderer.js` 本轮零 diff |
| 37 | **【48-07】G-48-12 代码面靶心**：`readSkillForInvocation` 判 `not_found` 时，经唯一权威入口 `syncAgentSystemPrompt()` 重扫**恰一次**后**当场重读磁盘** → 运行期新增的技能目录（managed 根 / user 根）立即可被 `/skill:<新名>` 调用；缓存命中时**零重扫**；正文恒来自读盘而非缓存副本 | ✓ VERIFIED | `ai-manager.js:1460-1468` 实读（条件 `result.ok !== true && result.reason === 'not_found'` → `try { await this.syncAgentSystemPrompt() }` → 第二次 `readSkillForInvocation`）；J 组「正例 · managed 根」「正例 · user 根 + 读盘实时性（改盘后读到第二版正文、旧正文不残留）」「快路径不变式（`rescanDelta === 0`）」三条**实跑通过**（`tests/test-ai-skills.js:2784-2852`，全套 139/139）。**旧实现下必然红**：无重试块时该目录不在 `_cache` → 恒 `not_found`（判据 `ai-skills-manager.js:803-804` 实读）且 `rescanCalls === 0` |
| 38 | **【48-07】三字段同源**：shadowed（46 D-06）/ disabled（46 D-09/10）/ tier（D-14）全部由同一条 `refreshSkills` 管线产出；运行期新增技能**不能**绕过遮蔽与禁用；调用侧零自行判定、零单目录直读 | ✓ VERIFIED | `ai-manager.js:1462` 只调 `syncAgentSystemPrompt()`；`ai-skills-manager.js` 本轮**零 diff**（`git diff --name-only` 实跑为空）；J 组「负例 · disabled 不被绕过」（`skill_disabled` + `skillBlock === ''` + `rescanCalls === 1`）与「负例 · shadowed 不被绕过」（注入 user 版正文、managed 条目 `shadowed === true` + `shadowedBy === 'user'`）实跑通过（`:2854-2892`）；源码护栏断言方法体内 `refreshSkills(` 命中 0、无 `while` / `for (`、`readSkillForInvocation(` 恰 2 次 |
| 39 | **【48-07】失败语义不变**：真不存在仍 `skill_not_found`（返回值域仍只有 `not_found \| disabled` 两个码），重试不会把失败变成成功 | ✓ VERIFIED | J 组「负例 · 真不存在 + 有界」（`skill_not_found` + `skill === null` + `skillBlock === ''` + `rescanCalls === 1`）实跑通过（`:2894-2907`）；`ai-manager.js:1470-1473` 失败出口逐字未动（`git diff` 实读），仍走 `skillErrorFromReason` 单一映射 |
| 40 | **【48-07】有界性**：单次调用**至多**一次重扫，不得写成循环；「命中但读盘失败」也只会多一次有界重扫 | ✓ VERIFIED | 行为断言 `rescanCalls === 1`（三条用例分别覆盖 miss-成功 / 禁用 / 真不存在）；源码护栏 `assert.strictEqual(/\bwhile\b/.test(body), false)` 与无 `for (`；本方法体内 `readSkillForInvocation(` 恰 2 次（与计划门一致，本轮独立复跑探针：`method body length 2342 / readSkillForInvocation( = 2 / has while: false / has for(: false / has refreshSkills(: false`）。「命中但读盘失败」分支由判据本身决定（`ai-skills-manager.js:815-830` 三个 `not_found` 出口实读） |
| 41 | **【48-07】忙时语义**：调用路径恒 `isProcessing = true` → 重扫必落忙分支 → **只置脏**，不改写 `agent.state.systemPrompt`、不广播 | ✓ VERIFIED | `ai-manager.js:2814-2817` 实读（忙分支置 `_skillsPromptDirty` 后 `return`，早于 `:2829` 的 `windowManager.broadcast('skills:changed')`）；J 组正例断言 `_skillsPromptDirty === true` **且** `agent.state.systemPrompt === 'OLD'`（`:2806-2807`）实跑通过 |
| 42 | **【48-07】无自激回路**：本路径不广播；既有「广播到达即无条件重拉」只调零 IO 的 `ai:get-skills`；renderer 不得新增任何重扫调用点 | ✓ VERIFIED | `src/renderer.js` 本轮零 diff，`.refreshSkills(` 计数本轮实测 = **1**；`renderer.js:4405-4409` 处理器体只有 `pullAiSkillsSnapshot()`；G 组护栏随 95/95 通过 |
| 43 | **【48-07】重扫抛错路径**：抛错被就地 catch + `console.warn` 后**保留原判定**，不把「未找到」升级成异常（也不动 `isProcessing` 的既有复位职责） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `ai-manager.js:1461-1466` 的 try/catch 实读存在，产品文档承诺的「失败码域不变」实现**守住**（`:1470-1473` 仍两码）；但该分支**零行为用例**（唯一护栏是 `body.includes('console.warn')` 的字符串存在性断言），且 48-REVIEW.md WR-08 实读指出三处字面失配：catch 体直接读 `err.message`（`throw null` 会二次抛错）、重试读盘在 `try` **之外**（`:1467`）、catch 后是「替换」而非字面「保留」。故不得记 VERIFIED → 见 Human Verification |
| 44 | **【48-07】G-48-12 运行期靶心**：真实 dev 应用里运行期新建技能目录（不打开 `/` 面板、不重启、不重建 Agent）→ 直接手打 `/skill:<新名> [args]` 即正常调用 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 代码面已闭合（truth 37-42），但端到端链路含 Electron IPC 往返 + renderer 发送 + 主进程读盘 + 流式回显，J 组夹具**不**经 IPC/renderer。`48-UAT.md` 的 G-48-12 仍 `status: failed`（待重跑回填）、`.planning/WINDOWS.md` unrun-verify **id 24** 仍 `status: open` → 见 Human Verification。**本轮未驱动真实应用** |
| 45 | **【48-07】延后落地**：重扫改变 digest → 下一次非忙同步点走「改写 + 广播」分支 → 运行期新增技能进入 system prompt（模型自动匹配面）与其它窗口面板投影 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 「不自激」半边 VERIFIED（truth 42）；「回写与广播**确实落地**」半边被 48-REVIEW.md **WR-07** 实读证伪其常见形态：`_skillsPromptDirty` 的唯一消费点在 `promptWithContext`（`:1325`），`prompt()` 成功出口（`:1084-1088`）**无**补刷，而 renderer 只在有 `@` 引用/附件时才走 `promptWithContext` → 纯文本流上该标记无限期保持 true。非 must-have FAILED（机制既有、不产生错值），但属运行时时机 + 口径裁决项 → 见 Human Verification |
| 46 | **【48-07】文档与账本收口**：`docs/product/ai-skills.md` §10.3（miss 一次性重扫口径，含三字段同源与「至多一次」）/ §10.7（成本 · 忙时语义 · 残余窗口 + WR-06 保持开放）/ §七（139 例 + 覆盖面）；`AGENTS.md` 技能域测试清单补登记；`.planning/WINDOWS.md` id 24 **两处**同步更正且 `status` 仍 `open`、计数未动；`48-VALIDATION.md` 新增 `48-07-T1` 行；`48-UAT.md` **纯追加**更正 | ✓ VERIFIED | `git diff 657cc2c..HEAD` 逐文件实读：docs §10.3 新增 1 条 bullet（含 `syncAgentSystemPrompt` + 「**至多一次**」）、§10.7 新增 3 条 + WR-06「**保持开放**」条、§七 例数 132→**139**；`AGENTS.md:267` 新增 `node tests/test-ai-skills.js`（139 例）条目；WINDOWS 表行 + JSON 条目**两处**同文改写（`status: open` / `resolved_at: null` 未动）；VALIDATION 追加 `48-07-T1`（10 列对齐、`⬜ pending`）；UAT diff = **8 插入 / 0 删除**（纯追加，`## Gaps` 的 `status: failed` 原样保留）。残余（IN-12：§10.7 `:390-392` 旧「即时」措辞未随裁决收口）记 advisory |
| 47 | **【48-07】诚实边界登记**：运行期真值未被自证为 resolved（UAT Gaps 保持 `failed`、WINDOWS id 24 保持 `open`）；WR-06 显式声明**未修复、不得据此声称已修** | ✓ VERIFIED | `48-07-SUMMARY.md` `coverage.D2` = `human_judgment: true` + rationale；`48-UAT.md` 末尾纯追加节明写「**不**修改上方 `## Gaps` 里 `G-48-12` 的 `status: failed`」；`docs/product/ai-skills.md:405-407` 逐字含「本条**未被修复**，随 Phase 49 一并处置…**不得**据此声称已修」 |
| 48 | **禁止项（48-07 P1）**：不得改动 `syncAgentSystemPrompt()` 的函数体（含把忙分支的置脏换成直接改写 prompt、或在其体内加 miss 判定） | ✓ VERIFIED | `git diff 657cc2c..HEAD -- ai-manager.js` 只有 2 处 hunk，**均**在 `_resolveSkillInvocation`（JSDoc + 方法体）；`:2802-2830` 方法体逐字未改；`tests/test-ai-skills.js` 内 `syncAgentSystemPrompt` 相关断言 22 处随 139/139 全绿（46-04 五条方法体断言未被绕过 —— J 组夹具用 `realSync.call(this)` **包装而非重写**，`:2770-2774` 实读） |
| 49 | **禁止项（48-07 P2）**：不得在 `ai-skills-manager.js` 里为 miss 增设第二套磁盘探测 / 自行比较两根优先级的遮蔽判定 | ✓ VERIFIED | `git diff --name-only 657cc2c..HEAD -- ai-skills-manager.js` 输出为空（**零 diff** 实测）；J 组源码护栏断言 manager 侧仍含缓存未命中短路字面量 `if (!entry) return { ok: false, reason: 'not_found', name };`，且不含调用形式的 `\.syncAgentSystemPrompt\s*\(`；`_resolveSkillInvocation` 方法体内 `refreshSkills(` 命中 0（本轮独立探针） |
| 50 | **禁止项（48-07 P3）**：不得把 miss 重试写成循环（`while` / `for` / 递归 / 反复 await 直到成功），重试失败后不得继续尝试 | ✓ VERIFIED | 源码护栏（无 `while` / 无 `for (`）+ 行为断言 `rescanCalls === 1`（既非 0 也非 ≥2），三条用例覆盖；本轮独立复跑形状探针 `has while: false / has for(: false` |
| 51 | **禁止项（48-07 P4）**：不得在 renderer 侧新增任何重扫调用点（`.refreshSkills(` 全文件恒 1，仍在 `openSlashPicker` 内），不得把 miss 判定/重试搬到 renderer | ✓ VERIFIED | `src/renderer.js` 本轮零 diff；本轮实测 `grep -c "\.refreshSkills(" src/renderer.js` = **1**；G 组 / C 组源码扫描护栏随 95/95 通过 |
| 52 | **禁止项（48-07 P5）**：不得动 TD-48-01 / TD-48-02 的登记与实现，不得顺手修 WR-01..WR-06，不得在任何文档里声称 WR-06 已修 | ✓ VERIFIED | `src/renderer.js` 本轮零 diff（两条 TD 的代码落点未变）；`git diff` 实读：`ai-manager.js` / `docs` / `AGENTS.md` 的新增行无一条针对 WR-01..WR-05 的修法；WR-06 在 §10.7 被显式标注「保持开放 + 未被修复」（truth 47）；TD 登记段在 48-REVIEW.md 中**原样继承** |

**Score:** 44/52 truths verified（8 present, behavior-unverified —— 真相 20 / 25 / 26 / 28 / 29 / 43 / 44 / 45）
**Prohibitions:** 11 条 judgment-tier 禁止项逐条核对 —— **11 条全部 VERIFIED**（真相 31-36 为本阶段既有 6 条；真相 48-52 为 48-07 新增 5 条），其中真相 34 附带一条**用户已裁决的开放延后**（TD-48-01），不另记 UNCERTAIN。

### 本轮（48-07 / G-48-12）逐条重判

| 48-07 PLAN 的 must-have | 本轮判定 | 决定性证据 |
| --- | --- | --- |
| truth 1（G-48-12 靶心，运行时 `/skill:<新名>` 可调用） | **代码面 ✓ VERIFIED（真相 37）**；**运行期面 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED（真相 44）** | J 组正例 2 条实跑通过（Node 宿主 + 真实 `createSandboxEnv` / `refreshSkills` / SDK），但**不经** Electron IPC 与 renderer；UAT test 12 / WINDOWS id 24 仍待重跑 |
| truth 2（重扫走唯一权威入口；三字段同源；遮蔽/禁用不被绕过） | **✓ VERIFIED（真相 38）** | `ai-skills-manager.js` 零 diff + J 组两条负例（disabled → `skill_disabled` 零注入；shadowed → 注入胜出者、败者 `shadowed === true`）实跑通过 |
| truth 3（有界 + 失败语义不变） | **有界/码域 ✓ VERIFIED（真相 39-40）**；**抛错分支 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED（真相 43）** | `rescanCalls === 1` ×3 + 真不存在仍 `skill_not_found`；抛错分支零行为用例（WR-08） |
| truth 4（已缓存快路径逐字不变；命中但读盘为空仍 `not_found` 且只多一次重扫） | **✓ VERIFIED（真相 37 后半 + 真相 40）** | 「快路径不变式」断言差值恰 0 且改盘后读到新正文；`ai-skills-manager.js:815-830` 三个 `not_found` 出口实读（属返回判据，非缓存状态判据） |
| truth 5（失效链对齐、无新增触发源、无自激回路） | **无自激 ✓ VERIFIED（真相 42）**；**回写/广播落地 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED（真相 45，WR-07）** | 忙分支早退于广播之前（`:2814-2817` vs `:2829`）+ `.refreshSkills(` 计数 1；但 `_skillsPromptDirty` 唯一消费点在 `promptWithContext`（`:1325`） |
| truth 6（测试面盲区消除：真实 SDK 夹具、fail 0、≥139 例） | **✓ VERIFIED（真相 37/38 的证据面）** | 本轮亲跑 `node tests/test-ai-skills.js` → `# tests 139 / # suites 27 / # pass 139 / # fail 0`；J 组 7 条全 `pass`（`:2783-2941` 实读，夹具为真实 `setupSkillsEnv` + 真实原型方法 + `realSync.call(this)` 包装） |
| truth 7（文档与账本收口；UAT 纯追加；WINDOWS status 保持 open） | **✓ VERIFIED（真相 46）** | 逐文件 diff 实读（见真相 46 证据列） |
| truth 8（诚实边界：运行期真值不自证 resolved；WR-06 不得声称已修） | **✓ VERIFIED（真相 47）** | SUMMARY `coverage.D2.human_judgment: true`；UAT 纯追加节；docs §10.7 WR-06 条 |
| P1-P5（5 条禁止项） | **✓ VERIFIED（真相 48-52）** | 见真值表证据列 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `ai-manager.js` | **本轮新增**：`_resolveSkillInvocation` 的 miss 一次性权威重扫 + 重试读盘块 + 方法 JSDoc 四条口径 | ✓ VERIFIED | `:1447-1468` 实读（条件 / try-catch-warn / 重读）；方法体形状探针本轮独立复跑：`readSkillForInvocation( ×2`、含 `syncAgentSystemPrompt(` / `console.warn` / `skillErrorFromReason(`、**无** `while` / `for (` / `refreshSkills(`；`node --check ai-manager.js` 通过 |
| `ai-manager.js`（既有） | 解析 / 组装 / 返回契约 / 重载装饰 / `_resolveSkillMarker` / `skillErrorFromReason` | ✓ VERIFIED | 行号按当前文件更新：`:1060` / `:1290` / `:1440-1492` / `:1655-1661` / `:1736` / `:6132-6142`；48-07 未改动这些段落（diff 仅 2 处 hunk） |
| `ai-skills-manager.js` | `readSkillForInvocation` 的存在性门与目录判据（**本轮零 diff**） | ✓ VERIFIED | `git diff --name-only 657cc2c..HEAD -- ai-skills-manager.js` **空**；`:803-804` 缓存短路、`:817-833` 目录路径全等 + name 重写实读 |
| `src/skill-picker-model.js` | 双模式导出纯逻辑模型（本轮零 diff） | ✓ VERIFIED | 358 行；`node --test tests/test-skill-picker-model.js` 本轮实跑 95/95 |
| `src/ai-cancel-state.js` | 零依赖 / 零 DOM / 双模式导出，`resolveCancelAttribution`（本轮零 diff） | ✓ VERIFIED | `node --test tests/test-ai-cancel-state.js` 本轮实跑 14/14 |
| `ipc-handlers.js` | `ai:get-skills` / `ai:refresh-skills` + `ai:prompt*` 返回体扩展（本轮零 diff） | ✓ VERIFIED | `:1747` / `:1763` 两通道仍 `assertTrustedSender(event)`；48-07 未触及（diff 实读） |
| `src/preload.js` | `realmAPI.ai.getSkills` / `refreshSkills` 成对暴露（本轮零 diff） | ✓ VERIFIED | `:1033` / `:1040` |
| `src/renderer.js` | 发送路径零否决 / 气泡单源 + 定向刷新 / 取消锚点 / 面板 / 导航 / 卡片变体 / 重发收敛（**本轮零 diff**） | ✓ VERIFIED | `git diff --name-only 657cc2c..HEAD` **不含** `src/renderer.js`；`.refreshSkills(` = 1 本轮实测 |
| `src/index.html` | 脚本加载顺序 + `main.css?v=8`（本轮零 diff） | ✓ VERIFIED | `:1021` / `:1024` / `:1025`；`:11` |
| `src/styles/main.css` | 四个令牌 + 技能相关新类；`max-height: 220px` 零改动（本轮零 diff） | ✓ VERIFIED | 令牌 5/5/5/3；八类齐全 |
| `tests/test-ai-skills.js` | **本轮新增** J 组 7 例（正例 2 + 快路径 1 + 负例 3 + 源码护栏 1）+ 夹具 `skillResolveCtx` / `invokeSkill` | ✓ VERIFIED | `:2741-2941` 实读；本轮亲跑 `139/139`（既有 132 例零回归）；用例在旧实现下必然红（正例断 `skillError === undefined` 与 `rescanCalls === 1`，旧实现恒 `not_found` 且计数 0 —— 依据 `git diff` 确认旧方法体无 `syncAgentSystemPrompt()` 调用） |
| `tests/test-skill-picker-model.js` | 面板 / 解析纯逻辑 + 接线护栏（本轮零 diff） | ✓ VERIFIED | 本轮实跑 `95/95` |
| `tests/test-ai-cancel-state.js` | A 组纯逻辑 + B 组接线护栏（本轮零 diff） | ✓ VERIFIED | 本轮实跑 `14/14` |
| `docs/product/ai-skills.md` | **本轮新增** §10.3 bullet / §10.7 G-48-12 三条 + WR-06 条 / §七 例数刷新 | ✓ VERIFIED | diff 实读（3 处 hunk）；残余措辞问题记 advisory（IN-09/10/12） |
| `AGENTS.md` | **本轮新增**技能域测试清单 `node tests/test-ai-skills.js`（139 例） | ✓ VERIFIED | `:267` 单行新增（diff 实读，1 insertion / 1 deletion） |
| `.planning/WINDOWS.md` | id 24 **两处**同步更正、status 仍 `open`、计数未动 | ✓ VERIFIED | 表行 + JSON 条目同文改写（diff 实读）；`status: open` / `resolved_at: null` 未变 |
| `.planning/phases/48-skill-name/48-VALIDATION.md` | `48-07-T1` 行（10 列对齐、`⬜ pending`） | ✓ VERIFIED | 尾行新增（diff 实读） |
| `.planning/phases/48-skill-name/48-UAT.md` | **纯追加**更正节，`## Gaps` 一行未动 | ✓ VERIFIED | diff = 8 插入 / **0 删除**；末尾 `## 更正（G-48-12 立项时，2026-09-12）` 三条实读；`G-48-12` 仍 `status: failed`（交接未回填） |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| **`_resolveSkillInvocation` 的 `not_found`** | **`this.syncAgentSystemPrompt()` → `refreshSkills(env, { disabled, rootDirs })` → 缓存三字段就位** | **本轮新增的唯一链路** | ✓ WIRED | `ai-manager.js:1462` 实读；`:2806-2812` 实读（同一次加载管线，调用侧零自行判定）；链路任一处无 shadowed / disabled / tier 的第二套判定（方法体内 `refreshSkills(` 命中 0） |
| **miss 分支的置脏** | **`syncAgentSystemPrompt()` 忙分支（`_skillsPromptDirty = true` + 早退）** | 忙时只置脏 | ✓ WIRED | `:2814-2817` 实读，早退早于 `:2829` 的广播；J 组断言置脏真 + prompt 逐字未变 |
| **置脏的落地** | **`promptWithContext` 的 idle 补刷（`:1325-1334`）** | 下一个非忙同步点 | ⚠️ PARTIAL | 消费点**只有** `promptWithContext`；`prompt()` 成功出口（`:1084-1088`）无补刷 → 纯文本流下不落地（48-REVIEW WR-07，实读复核成立）。见 Human Verification |
| `handleSendAIMessage` 斜杠分支 | `realmAPI.ai.prompt` / `promptWithContext`（完整语法文本）→ `_resolveSkillInvocation` → `readSkillForInvocation` | IPC → 主进程解析 → **miss 时重扫 → 实时读盘** | ✓ WIRED | `renderer.js:8692-8709` 无本地否决（零 diff）；`ai-manager.js:1445` / `:1467` 两次读盘 |
| `ai-manager.getSkillsForUI()` | `getSeededSkillNamesSafe()` → `getSkillsForUI(seededNames)` → `ai:get-skills` → `realmAPI.ai.getSkills` | 收窄投影过 IPC | ✓ WIRED | 惰性 require + try/catch 降级；两通道 `assertTrustedSender`（零 diff） |
| `refreshSkillsForPanel()` | `syncAgentSystemPrompt()` → `windowManager.broadcast('skills:changed')` → renderer **无条件**重拉快照 | 读侧 P8 调用方 | ✓ WIRED | `renderer.js:4405-4406` 处理器体只有 `pullAiSkillsSnapshot()`；全文件 `.refreshSkills(` = 1（本轮实测） |
| 删除本地否决后的失败通道 | `skillErrorFromReason`（主进程）→ `_resolveSkillInvocation` `{skillError}` → IPC → `removeSkillFailureBubbles(userId)` + `pushSystemNote(...)` | **唯一**判定与文案通道 | ✓ WIRED | `renderer.js:8825-8833`；渲染端零文案复制（真相 27）；**重试后的失败仍走同一出口**（`:1470-1473` 逐字未动） |
| `getConversationMessages()` | `_decorateSkillUserMessage`（user 行）+ `_resolveSkillMarker`（assistant 行） | 装饰层重建 | ✓ WIRED | 方法体内无直接 `matchSkillByPath(`；`_resolveSkillMarker` 现位于 `:1655` |
| `_setupEventBroadcasting` 的 `tool_execution_start` | `skill_invocation` → renderer `toolExecution.skillInvocation` → `renderToolCard` 技能变体 | 事件字段链 | ✓ WIRED | `ai-manager.js:1736` + `renderer.js:9364` / `:9579-9586` |
| `regenerateMessage` / `showAIError` 重试 | `buildResendPayload` → `SkillPickerModel.buildSkillSyntaxText` → `ai.prompt` + `refreshUserMessageBubble` | 唯一反向实现 + 定向刷新 | ✓ WIRED | `buildResendPayload` 定义命中 = 1；`:10006` / `:10083` 两处刷新 |
| `abortAIIfStreaming` / `handleStopAI` | `state.aiCancelledMessageId` → `handleAIStream` error 取消分支 `resolveCancelAttribution` | 锚点解算 | ✓ WIRED | `:9115-9118` / `:8383-8385` 置锚点，`:9390-9395` 解算；B 组 5 条接线护栏实跑通过 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 面板技能行 | `state.slashPickerItems` | `SkillPickerModel.buildPickerItems(state.aiSkills, SLASH_COMMANDS, rawFilter)` ← `realmAPI.ai.getSkills()` ← `ai-skills-manager._cache.skills`（SDK 扫盘） | Yes | ✓ FLOWING |
| 气泡技能 pill / 折叠块 | `msg.skillInvocation`（`{name, tier, content}`） | 调用响应回传的 `readSkillForInvocation` 实时读盘结果（`ai-manager.js:1488-1491`） | Yes（J 组「改盘后二次调用读到第二版正文」实测 → 恒为读盘结果，非缓存副本） | ✓ FLOWING |
| 气泡正文 | `msg.content`（args） | `parseSkillRef(text).args`（renderer）/ `resolveSkillBubbleArgs`（重载） | Yes | ✓ FLOWING |
| 工具卡片标题 | `toolExecution.skillInvocation` | `_resolveSkillMarker` ← `matchSkillByPath` ← `_cache.skills[i].filePath` | Yes | ✓ FLOWING |
| 对话标题 | `_ensureConversation(message)` | 完整语法文本（原始用户输入） | Yes | ✓ FLOWING |
| **运行期新增技能 → 缓存** | `_cache.skills` | **本轮新增**：miss 时 `syncAgentSystemPrompt()` → `refreshSkills` 扫两个根目录 → 条目落缓存 | Yes（J 组两条正例实测；`managed` / `user` 档位判定正确） | ✓ FLOWING（Node 宿主；IPC 面归 UAT） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 显式调用纵向切面（含 48-07 J 组 7 例） | `node tests/test-ai-skills.js` | `# tests 139 / # suites 27 / # pass 139 / # fail 0` | ✓ PASS |
| 面板与解析纯逻辑（picker） | `node --test tests/test-skill-picker-model.js` | `# tests 95 / # suites 16 / # pass 95 / # fail 0` | ✓ PASS |
| 取消归属纯逻辑 + 接线护栏 | `node --test tests/test-ai-cancel-state.js` | `# tests 14 / # suites 2 / # pass 14 / # fail 0` | ✓ PASS |
| 5 文件回归门 | `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-ai-conversations.js` | `# tests 353 / # suites 63 / # pass 353 / # fail 0`（上轮 346 → 353，= J 组 +7） | ✓ PASS |
| seeder（gate 口径，直跑形式） | `node tests/test-builtin-skills-seeder.js` | `# tests 101 / # suites 16 / # pass 101 / # fail 0` | ✓ PASS |
| `_resolveSkillInvocation` 形状探针 | `node -e`（方法体正则扫描） | `body 2342 字符`；`readSkillForInvocation( = 2`；含 `syncAgentSystemPrompt(` / `console.warn` / `skillErrorFromReason(`；`while=false` / `for( =false` / `refreshSkills( =false` | ✓ PASS |
| `ai-skills-manager.js` 零 diff（本增量 prohibition P2） | `git diff --name-only 657cc2c..HEAD -- ai-skills-manager.js` | 输出为空 | ✓ PASS |
| `syncAgentSystemPrompt()` 函数体未改（P1） | `git diff 657cc2c..HEAD -- ai-manager.js` | 仅 2 处 hunk，均在 `_resolveSkillInvocation`（JSDoc + 方法体） | ✓ PASS |
| 语法 | `node --check ai-manager.js` | 无输出（通过） | ✓ PASS |
| renderer 无自激 / 无新增重扫调用点（P4） | `grep -c "\.refreshSkills(" src/renderer.js` | **1** | ✓ PASS |
| 未加引用的债标记（本增量新增行） | `git diff 657cc2c..HEAD \| grep -E "^\+" \| grep -E "TBD\|FIXME\|XXX\|TODO\|HACK\|placeholder\|coming soon\|not implemented\|\.skip\|test\.todo"` | 四文件（`ai-manager.js` / `tests/test-ai-skills.js` / `docs` / `AGENTS.md`）新增行**零命中** | ✓ PASS |
| 本增量 commit 台账 | `git rev-list --count 657cc2c..HEAD` = **2** | 与 `48-07-SUMMARY.md` 的 `actuals.commits: 2`（`7d6bd35` / `96560a6`）一致 | ✓ PASS |

### Probe Execution

未声明探针，且本阶段非迁移 / CLI 阶段：PLAN / SUMMARY 内无 `probe-*.sh` 声明，`scripts/*/tests/` 下无匹配 → **Step 7c: SKIPPED（no probes declared）**。

> 附注：48-07 的「运行期探针」不属本 Step 的脚本探针形态 —— 它登记在 `.planning/WINDOWS.md` 的 unrun-verify **id 24**（自动驱动 UAT 形态），本轮**未执行**，已作为 truth 44 与 human_verification 首项登记。SUMMARY 的 `D3` 声明的 integration 探针（「真实 `createSandboxEnv` + `refreshSkills` + SDK，临时工作区」）与本轮亲跑的 J 组正例属同一机制，已由 `139/139` 覆盖。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DISC-01 | 48-02 | `/` 面板列出全部已启用技能与既有本地命令、可按名称实时过滤 | ✓ SATISFIED | 真相 1/2/3/4/5/6 |
| DISC-02 | 48-01, 48-02, 48-04, 48-05, 48-06, **48-07** | 选择技能以 `/skill:name [args]` 调用，正文经 `formatSkillInvocation` 作 `<skill>` 块注入 | ✓ SATISFIED（**代码面**；运行期半边归 UAT） | 真相 7-13、21-23、26-27、30、**37-42**；48-07 使「运行期新增技能 → 直呼可调用」在代码面成立 |
| DISC-03 | 48-01, 48-05 | 技能调用进入对话历史并触发 LLM（与本地命令区分） | ✓ SATISFIED（机制面；实机回复面归 UAT） | 真相 14、24、25 |
| DISC-04 | 48-01, 48-02 | 技能列表区分来源（user/managed/seeded）并以徽标展示；被遮蔽的同名技能可见 | ✓ SATISFIED | 真相 4、15、**38（遮蔽判定在 miss 重扫后同样生效）** |
| DISC-05 | 48-03 | 模型可按 description 自动匹配技能并 `read` 其正文 | ✓ SATISFIED（交付物）/ ⚠️ 模型侧行为归模型能力 | 真相 18、19 机制面全绿；真相 29 按 UAT 裁决拆分；truth 45 指出运行期新增技能在**纯文本流**下对该面的可见性受限（WR-07，advisory） |
| DISC-06 | 48-01, 48-06, **48-07** | 调用不存在的技能给出明确错误提示（不出现「点了没反应」） | ✓ SATISFIED | 真相 16、21、27、**39（真不存在仍 `skill_not_found`）**；抛错分支的健壮性见真相 43（⚠️） |
| DISC-07 | 48-01, 48-02 | `disable-model-invocation` 不进 system prompt，仍可 `/skill:` 显式调用并在 UI 打标 | ✓ SATISFIED | 真相 17、4 |

**Orphaned requirements:** 无。`REQUIREMENTS.md:130-136` 映射到 Phase 48 的恰为 DISC-01..07，七个 ID 全部出现在至少一个 PLAN 的 `requirements:` 字段（48-01: DISC-02/03/04/06/07、48-02: DISC-01/04/07、48-03: DISC-05、48-04: DISC-02、48-05: DISC-02/03、48-06: DISC-02/06、**48-07: DISC-02/06**）。本轮复跑 `grep "^requirements:"` 全 7 个 PLAN 逐一确认，无新增 / 缺失。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `ai-manager.js` | 1460-1468 + 1433（注释） | **WR-07（本增量新增）**：置脏点（miss 重试）是**常规**情形，但 `_skillsPromptDirty` 的唯一消费点在 `promptWithContext`（`:1325`）；`prompt()` 成功出口（`:1084-1088`）无补刷 → 纯文本流下回写与广播**永不落地**，运行期新增技能对模型自动匹配与其它窗口面板一直不可见 | ⚠️ Warning（**已记档**，非 phase-blocking） | 不产生错值、不破坏已完成回复、不卡死交互；G-48-12 的**显式调用**面已闭合。机制既有（46 D-03），本增量把置脏从罕见放大为常规。修法二选一见 48-REVIEW.md WR-07；已进 Human Verification 待裁决 |
| `ai-manager.js` | 1461-1467 | **WR-08（本增量新增）**：「重扫抛错 → 就地 catch + 保留原判定 + 不升级为异常」只被 `body.includes('console.warn')` 的字符串断言承载；catch 体直接读 `err.message`（`throw null` 会二次抛错）、重试读盘在 `try` 之外、catch 后是「替换」而非字面「保留」 | ⚠️ Warning（**已记档**，非 phase-blocking） | 使 truth 43 无法记 VERIFIED（改记 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED）。产品文档承诺的「失败码域不变」实现**守住**；失配的是代码注释的更强措辞与测试面缺口 |
| `src/renderer.js` | 10427（同类 10419-10420 / 10430-10431；辅助 11349-11353） | 磁盘来源技能名经 `escapeHtml` 拼进 **HTML 属性**（`title="…"`），`escapeHtml` = `textContent → innerHTML` 不转义 `"` | 📋 Advisory（**用户已裁决延后** → `TD-48-01`） | UAT test 5 实测：属性逃逸**成立**，但主窗口 CSP `script-src 'self'` 使内联事件处理器**不被编译** → 残余影响降为 minor。**本轮 `src/renderer.js` 零 diff**，形态与行号未变。按 2026-09-12 裁决不作为本阶段 BLOCKER |
| `src/renderer.js` | 8272-8281 | `finalizeAIStreamingBubble`（run 正常结算）只清 `aiStreaming` / `aiCurrentMessageId`，**不清** `aiCancelledByUser` / `aiCancelledMessageId` | ⚠️ Warning（**已裁决延后** → `TD-48-02`，不阻断收尾） | 窄竞态下标记跨轮存活 → 下一轮真实错误被当取消消费、已完成回复正文被覆盖、`resetRunState=false` 使轮次状态永不复位。**使真相 25 无法记 VERIFIED**。见 Human Verification |
| `docs/product/ai-skills.md` | 390-392 vs 418-423 | **IN-12**：§10.7 仍写 G-48-4+G-48-6 的「三件套**即时**呈现」，与 §10.8 已按裁决收口的「本轮回合结束时即现…**不是回车那一瞬间**」互相排斥 | ⚠️ Warning（advisory，文档自相矛盾） | 48-07 恰好编辑同一节尾部却未顺手收口（成本一行）。不 falsify 任何 must-have |
| `docs/product/ai-skills.md` | 308-311 / 394 | **IN-10 / IN-09**：§10.3 第 1 与第 2 条自相矛盾（是否复用重扫产出的元数据）；§10.7「缓存命中时零重扫」强于实测（真不变式 = 命中**且读盘成功**） | ℹ️ Info | 措辞精度；48-07 PLAN 的 truth 措辞本身准确 |
| `ai-manager.js` / `ai-skills-manager.js` | 811（unchanged） | **WR-06**：已缓存的超 64 KiB 技能在实时读盘路径绕过字节闸 | ⚠️ Warning（**用户裁决保持开放**，随 Phase 49） | 本轮零新表述为「已修」；docs §10.7 显式标注未修复（truth 47） |
| 全阶段改动文件 | — | `TBD` / `FIXME` / `XXX` | ℹ️ Info | 无新增未引用债标记（本增量四文件新增行零命中） |
| 阶段改动文件 | — | 占位 / 空实现（`return null` / `return []` / 「即将推出」） | ℹ️ Info | 未发现；`readSkillForInvocation` 的 `{ok:false,reason:'not_found'}`、`resolveCancelAttribution` 的 `-1`/`false` 均为**终态判定结果**，非 stub |

### Advisory（新范围，无独立决定性证据 / 已有成对证据但已记档）

> 按 Step 7 的「re-verification evidence gate」列出。其中 WR-07 / WR-08 的落点文件（`ai-manager.js`）**确实**在本轮 `verified:` 时间戳之后被 git 修改（48-07），按 fail-closed 口径本可继续阻断 —— 但两者均**未** falsify 任何已登记 must-have 真值（G-48-12 的显式调用面已闭合；WR-07 影响的是「回写/广播的最终一致」与模型自动匹配面，WR-08 影响的是错误路径的措辞与测试面），按用户既有口径（TD-48-01 / TD-48-02 已延后；WR 系列为已记档技术债）**记 Advisory 与 human 裁决项，不重开 BLOCKER**。

| # | Finding | Category | 为何仅作 Advisory |
| - | ------- | -------- | ----------------- |
| 1 | **WR-07**（纯文本流下回写/广播永不落地，运行期新增技能对模型自动匹配与已开面板不可见） | 架构 / 最终一致 | 本轮**独立复核成立**（实读 `_skillsPromptDirty` 读写点 + `prompt()` 成功出口），但机制既有、不产生错值、不破坏已完成回复、不卡死交互；且属**口径裁决**（补 flush vs 收口措辞）而非缺实现 |
| 2 | **WR-08**（重扫抛错分支零行为用例 + 三处字面失配） | 卫生 / 测试面 | 实现的可观测语义成立、产品文档承诺被守住；仅代码注释措辞更强与测试面缺口 → 归 truth 43 的 ⚠️ 与 human 裁决 |
| 3 | **IN-12**（§10.7 旧「即时」措辞与 §10.8 冲突） | 文档一致性 | 48-05/48-06 遗留、非本增量引入；48-07 恰好编辑同节尾部未顺手收口 |
| 4 | **IN-09 / IN-10**（§10.7 零重扫口径偏强；§10.3 第 1/2 条自相矛盾） | 文档精度 | 不影响任何 must-have；48-07 PLAN 的 truth 措辞准确 |
| 5 | **WR-01 / WR-02 / WR-03 / WR-04 / WR-05** | 架构 / 一致性 / 卫生 | 48-07 的 prohibition 明文禁止顺手修，且均不 falsify 已登记真值；本轮未独立复跑其探针（48-REVIEW §A 台账逐条实读） |
| 6 | **IN-01 / IN-02 / IN-03 / IN-05 / IN-06 / IN-07 / IN-08 / IN-11 / IN-04** | 卫生 / 死代码 / 观测项 | 均非 must-have 断言面；IN-04 为已知模型能力限制（观测项） |
| 7 | 性能面（`getSeededSkillNamesSafe()` 逐次 readdir、`_resolveSkillMarker` 逐条调用；miss 路径新增一次全量重扫） | 性能（v1 范围外） | 沿用上一轮口径，仍不作为缺陷计分；建议 Phase 49 起评估负缓存/节流（IN-11） |

### 既有红项核对（D-48-A，预注册）

- 本轮直跑 `node tests/test-builtin-skills-seeder.js` → `# tests 101 / # pass 101 / # fail 0`（**全绿**，与上一轮一致）。`48-VALIDATION.md` 记录的「嵌套 `node --test` 下 `:2200` `DOC-02` 计数断言失败」属环境性豁免，本轮以**直跑形式**执行，未复现。

### 阶段门槛与文档一致性核对

- `48-07-PLAN.md` 的 `requirements: [DISC-02, DISC-06]`、`gap_closure: true`、`gap_ids: [G-48-12]`、`files_modified`（7 项）与 `48-07-SUMMARY.md` 的 `key-files` 一致；实测 `git diff --name-only 657cc2c..HEAD` 的源码/文档改动集合 = `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md` / `.planning/WINDOWS.md` / `48-VALIDATION.md` / `48-UAT.md` + 计划元数据（ROADMAP / STATE / state.json / SUMMARY / REVIEW）→ **严格限于计划声明的文件**，零 scope creep。
- `docs/product/ai-skills.md` §七 的例数（139）与实跑输出、`AGENTS.md:267` 的例数逐字一致（`AGENTS.md:272` 的维护约定要求「改动实时读盘口径必须同步权威章节 + 测试清单」→ 本增量执行了，合规）。
- `.planning/WINDOWS.md` id 24 的 `status` 仍 `open`、`resolved_at: null`、frontmatter 计数未动（与「unrun-verify 的收口点是重跑探针，不是本计划」一致）。
- `48-UAT.md` 的 `## Gaps` 块 `G-48-12` 仍 `status: failed`（交接未回填）—— 与 `48-07-SUMMARY.md` 的 `Next Phase Readiness` 自述一致。
- `48-REVIEW.md` 的 `review_kind: incremental-gap-closure-re-review`、`findings.critical: 0`（TD-48-01 / TD-48-02 按用户裁决不计入 critical）、`carried_forward` 16 条 —— 与本报告 §Advisory / §Anti-Patterns 无冲突。

### Deferred Items

无（Step 9b 逐条比对后续阶段：Phase 49 `manage_skill` 写路径 / Phase 50 设置页启停卸载 / Phase 51 导入 —— 均**不覆盖** WR-07（回写落地时机）、WR-08（抛错分支）、IN-12（§10.7 措辞）与 TD-48-01 / TD-48-02 的**修复**；恰恰相反，49/51 会放大 TD-48-01 与 WR-07 的可达性。故这些不作为 deferred 处理，而是作为已登记延后 / 待裁决项）。

### Gaps Summary

**本轮的功能目标在代码库中成立，且 48-07 的交付面全部核实为真 —— 但 G-48-12 的运行期靶心仍未被行使，故本阶段维持 `human_needed`。**

- **48-07 增量的 8 条真值 + 5 条禁止项全部 VERIFIED（真相 37-42 / 46-47 / 48-52）**：miss 一次性权威重扫 + 重读盘、三字段同源、有界（`rescanCalls === 1`）、真不存在仍 `skill_not_found`、快路径零重扫、忙时只置脏不改写 prompt 不广播、无自激回路、文档与账本收口、权威侧零 diff、5 条 prohibition 逐条成立。
- **测试实跑（非采信 SUMMARY）**：`test-ai-skills.js` **139/139**（48-07 前 132 → +7）、`test-skill-picker-model.js` 95/95、`test-ai-cancel-state.js` 14/14、5 文件回归门 **353/353**（上轮 346 → +7）、seeder 101/101 —— 全绿。旧实现下 J 组必然红（`git diff` 证旧方法体无 `syncAgentSystemPrompt()` 调用，正例断 `skillError === undefined` 与 `rescanCalls === 1`）。
- **无 must-have 真值 FAILED、无 artifact MISSING/STUB、无 key link NOT_WIRED、无未引用债标记、无 UNCERTAIN。**
- **8 条真值落 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED**（20 / 25 / 26 / 28 / 29 / 43 / 44 / 45），全部属 node:test 无法裁决的运行时行为或错误路径，已逐条进入 `behavior_unverified_items` 与 `human_verification`。其中与本轮直接相关的三条：
  - **truth 44（G-48-12 运行期靶心）** —— 代码面已闭合，端到端链路（IPC + renderer + 真实应用）须重跑 UAT test 12 / `WINDOWS.md` id 24。**这是本阶段收尾的第一阻塞项。**
  - **truth 45（回写/广播落地）** —— 48-REVIEW WR-07 实读证伪其常见形态（纯文本流永不落地）；需在「补 flush（约 6 行）」与「收口措辞」之间裁决。不 falsify 已登记 must-have，但 Phase 49 的 AI 自建技能若依赖模型自发感知新技能则应选补 flush。
  - **truth 43（重扫抛错路径）** —— 零行为用例 + WR-08 的三处字面失配；已提供实测兜底探针（不存在技能名后立刻发普通消息）。
- **已裁决延后项维持不动**（不得重开为 BLOCKER）：**TD-48-01**（面板行 `title` 属性逃逸，接手触发点 = Phase 49 开工前第一条）、**TD-48-02**（取消标记生命周期，Phase 49 开工前与 TD-48-01 同批）、**WR-06**（调用路径绕过 64 KiB 字节闸，用户裁决保持开放随 Phase 49）。三者的落点文件（`src/renderer.js` / `ai-skills-manager.js`）**本轮零 diff**，形态与行号均未变。
- **结论**：自动化可裁决面全部通过；**运行期面尚未重跑**（UAT test 12 / test 4 / test 6 clause 1，均已登记在 `.planning/WINDOWS.md` 的 `unrun-verify` 与 `48-UAT.md`）。**UAT 探针重跑通过前本阶段不得 complete**（与用户既有口径「UAT 为准」及 `.planning/WINDOWS.md` 的 unrun-verify 条目一致）；同时请对 WR-07 / WR-08 作出处置裁决。

## 收尾裁决记录（2026-09-12 · 历轮累计）

| 轮次 | 项 | 裁决 | 落地 |
| --- | --- | --- | --- |
| gap 闭合轮（round 2 收尾） | CR-05（Critical，取消标记无生命周期） | 先记技术债，直接跑 UAT | 登记为 `48-REVIEW.md` 的 **TD-48-02**，接手触发点 = Phase 49 开工前 |
| gap 闭合轮（round 2 收尾） | WR-05（G-48-6「立即」口径） | 收口措辞为「本轮回复结束时即现」 | §10.8 + 报告 truth 26 + UAT 第二轮 item 9 同步（**残余**：§10.7 `:390-392` 未随裁决更新 → IN-12） |
| gap 闭合轮（round 2 收尾） | WR-06（调用路径绕过 64 KiB 字节闸） | 未裁决修复时机，保持开放 | 记入 `48-REVIEW.md`；48-07 在 §10.7 显式标注「未被修复、不得声称已修」 |
| UAT round 2 | G-48-12 口径 | **修复**（不是收口文档、不是记技术债） | 48-07 在**调用侧**落地 miss 一次性权威重扫 + 重试读盘；`ai-skills-manager.js` 零 diff |
| **本轮（round 3，48-07 复验）** | WR-07（纯文本流下回写/广播不落地） | **未裁决** —— 本轮实读复核成立，升级为待裁决项 | 已进 advisory + human_verification（修法 ① 补 flush / ② 收口措辞） |
| **本轮（round 3，48-07 复验）** | WR-08（抛错分支零行为用例 + 三处字面失配） | **未裁决** —— truth 43 记 ⚠️ 不放行 | 已进 advisory + human_verification（修法与配套用例见 48-REVIEW.md WR-08 Fix 段） |

**指纹维护说明（本轮变更）：** `covered_files` 新增 `.planning/phases/48-skill-name/48-07-PLAN.md` 与 `48-07-SUMMARY.md`（本轮实际覆盖的规划输入），并按当前文件内容重算 `covered_digest`（`v1:sha256:168a86b2…`）。**`48-UAT.md` 依旧刻意不入清单** —— UAT 是人工实测记录、不是验证输入：把它并入后每追加一轮 UAT 都会让本报告被 `verification.status` 判 `stale`（上一轮实测踩到两次，遂于 `2292eb4` 移出）。同理 `.planning/WINDOWS.md`（跨阶段账本）只被读、不入清单。48-07 改动的 `48-REVIEW.md` / `48-VALIDATION.md` / `ai-manager.js` / `tests/test-ai-skills.js` / `docs/product/ai-skills.md` / `AGENTS.md` **均已在清单内**并随本次重算更新。

---

_Verified: 2026-09-12T14:33:42Z_
_Verifier: Claude (gsd-verifier)_

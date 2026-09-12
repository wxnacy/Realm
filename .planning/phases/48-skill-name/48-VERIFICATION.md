---
phase: 48-skill-name
verified: 2026-09-12T12:25:00Z
status: human_needed
score: 31/36 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/48-skill-name/48-01-PLAN.md", ".planning/phases/48-skill-name/48-02-PLAN.md", ".planning/phases/48-skill-name/48-03-PLAN.md", ".planning/phases/48-skill-name/48-04-PLAN.md", ".planning/phases/48-skill-name/48-05-PLAN.md", ".planning/phases/48-skill-name/48-06-PLAN.md", ".planning/phases/48-skill-name/48-01-SUMMARY.md", ".planning/phases/48-skill-name/48-02-SUMMARY.md", ".planning/phases/48-skill-name/48-03-SUMMARY.md", ".planning/phases/48-skill-name/48-04-SUMMARY.md", ".planning/phases/48-skill-name/48-05-SUMMARY.md", ".planning/phases/48-skill-name/48-06-SUMMARY.md", ".planning/phases/48-skill-name/48-UAT.md", ".planning/phases/48-skill-name/48-REVIEW.md", ".planning/phases/48-skill-name/48-VALIDATION.md", "ai-skills-manager.js", "ai-manager.js", "ipc-handlers.js", "src/renderer.js", "src/ai-cancel-state.js", "src/skill-picker-model.js", "src/index.html", "src/preload.js", "src/styles/main.css", "tests/test-ai-skills.js", "tests/test-skill-picker-model.js", "tests/test-ai-cancel-state.js", "docs/product/ai-skills.md", "AGENTS.md"]
covered_digest: "v1:sha256:1448691404001a0732fa7b1b84b55343a133b4f0693c41f5cf05a9130c0c5d7d"
behavior_unverified: 5
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 24/28
  previous_verified: 2026-09-12T06:50:49Z
  gaps_closed:
    - "CR-02 / G-48-2：`frontmatter name ≠ 目录名` 的技能在面板可见可选但恒 not_found —— 判据已改目录路径全等、注入名重写为目录名（48-04）"
    - "CR-03 / G-48-4：迟到取消事件按「当前消息 id」归属 → 新气泡被写成「用户已取消」—— 已改锚点解算 + 条件复位（48-05）"
    - "CR-04 / G-48-3：renderer 用陈旧 `state.aiSkills` 快照本地否决调用 —— 两段否决已删除、失败通道唯一化到主进程（48-06）"
    - "G-48-6：pill 与「技能正文」折叠块只在整列重绘时出现 —— 已抽出单源构建 + 回填后定向刷新（48-05）；「立即」口径半边见 WR-05 残留"
  gaps_remaining: []
  regressions: []
open_deferrals:
  - id: TD-48-01
    origin: "48-REVIEW.md CR-01（面板行 `title` 属性经 `escapeHtml` 注入 —— `escapeHtml` = `textContent → innerHTML`，不转义 `\"`）"
    adjudicated: 2026-09-12
    disposition: "延后，登记为技术债（前提：暂时不发版）；接手触发点 = Phase 49 开工前第一条（`manage_skill` 落地前）"
    measured_impact: "UAT test 5 实测：属性逃逸成立，但主窗口 CSP `script-src 'self'` 使内联事件处理器不被编译 → 残余影响降为 minor（CSS 注入 / UI 伪装 / 潜在 XSS）"
    must_have_effect: "无 —— 48-02 禁止项的字面要求（插值全部经 `escapeHtml()`、tier → class 走白名单查表）仍然成立，故该 truth 记 VERIFIED；本条按用户裁决作为已跟踪的开放延后记录，不重开为 BLOCKER"
behavior_unverified_items:
  - truth: "DISC-05：模型仅凭 description 自动匹配技能并 read 其正文（用户不显式调用也能生效）"
    test: "在运行中的应用里提一个命中某技能 description 的任务（不手打 `/skill:`），观察模型是否自行 read 该技能的 SKILL.md"
    expected: "模型自发调用 read 读取技能目录下的 SKILL.md，工具卡片标题显示「使用技能「name」」"
    why_human: "模型侧行为依赖真实 LLM 推理；node:test 只能断言「description 已进 system prompt」「read 事件带 skill_invocation」「卡片按标记渲染」三个机制面。UAT test 8 已实测①（匹配到之后的可见性 + 重载持久化）端到端通过；②（模型自发遵守 SDK 指令）未发生，归因于模型能力（本机仅 Qwen3-8B 可用），登记为已知限制"
  - truth: "G-48-4 运行时半边：AI 正在流式回复（或卡在工具确认卡片）时调用技能 → 新气泡不被写成「用户已取消」、其后不出现零增长、停止按钮不提前回退"
    test: "`npm run dev` → 发一条长回复 prompt → 流式中手打 `/skill:<真实技能名>` → 采样 15s"
    expected: "新技能调用正常发出并流式回显；`.ai-skill-pill` 出现；新气泡正文持续增长；停止按钮保持 stop-mode 直到本轮结束"
    why_human: "abort × 新消息是运行时竞态（`ai:abort` 同步返回 + 迟到 error 的到达顺序），node:test 只覆盖纯逻辑判定与接线契约。另见 48-REVIEW.md CR-05（标记生命周期未闭合），该残余是同一状态机的相邻不变式，故本条不得记为 VERIFIED"
  - truth: "G-48-6 运行时半边：发送 `/skill:<name> <args>` 后，**本轮回合结束（`ai:prompt` 应答返回）时**用户气泡即含技能 pill 与默认折叠的「技能正文（N 字符）」块（**口径收口**：2026-09-12 用户裁决按实现时机改措辞，原「回车那一刻立即」不再作为验收要求；见 48-REVIEW.md WR-05 裁决段与 docs §10.8）"
    test: "`npm run dev` → 输入 `/skill:<真实技能名> <args>` 回车，**不做任何额外交互**，在「整轮回复跑完时」检查 `.ai-skill-pill` / `.ai-skill-content-box`"
    expected: "整轮回复跑完时存在 pill 与折叠块（默认折叠、点击可展开）；**不需要**切换对话 / 重载 / `/compact` 触发"
    why_human: "DOM 渲染时机属运行时行为，node:test 无 DOM 宿主。`refreshUserMessageBubble` 的唯一触发点是 `ai:prompt` 应答返回之后（`renderer.js:8816`，应答在 `agent.waitForIdle()` 之后才解析），因此呈现时刻 = 本轮回合结束 —— 该措辞已由用户 2026-09-12 裁决收口（原「发送后立即」不成立，48-REVIEW.md WR-05）"
  - truth: "48-02 backstop：50+ 技能数据集下 220px 面板的分组标题 sticky 常驻、行五要素可读、行尾标注无一截断"
    test: "按 48-VALIDATION.md §Manual-Only Verifications 的脚本向 skills/ 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区"
    expected: "分组标题 sticky 常驻；行五要素可读；行尾标注 flex-wrap 后无一截断"
    why_human: "纯视觉观感（sticky 常驻、换行行高、徽标对比度）无法由源码扫描或 node:test 裁决。UAT test 7 已由自动驱动实测判 pass（sticky 偏移 1px、截断计数 0、emptyDesc 0、限额标注 14+1 与算术一致），本项保留为人工可推翻的观感裁决"
  - truth: "真实 Electron 端到端：手打 `/skill:name` 后气泡显示「技能」微标 + args 正文 + 默认折叠的技能正文块；未找到 / 已禁用走两条 system-note；流式回复中调用技能不被丢弃"
    test: "`npm run dev` → 输入 `/skill:<真实技能名> 参数` 回车；再输入 `/skill:<不存在>`；再输入一个已禁用技能；再在 AI 回复流式进行中点面板技能行"
    expected: "命中时气泡 = 技能 pill + args 正文 + 可展开「技能正文（N 字符）」块；两条失败走各自 system-note 且零残留气泡；流式中调用能正常发出并流式回显"
    why_human: "IPC 往返 + 主进程实时读盘 + 流式事件时序属运行时行为；node:test 只覆盖源码契约与纯函数。UAT test 6 的 clause 2（未找到）/ clause 3（已禁用）已实测通过，clause 1 与 clause 4 是本轮修复的目标面，须重跑"
human_verification:
  - test: "重跑 UAT test 6 clause 1：`npm run dev` → 输入 `/skill:<真实技能名> <args>` 回车，**不做任何额外交互**，在「整轮回复结束后」采样 `hasPill` / `hasBox`"
    expected: "**整轮回复结束时**必有 pill 与折叠块（本轮修复的目标面）。口径已收口（2026-09-12 用户裁决）：呈现时刻 = 本轮回合结束，**不要求**回车那一刻即现 —— 故只需验后半边；`docs/product/ai-skills.md` §10.8 已同步该措辞"
    why_human: "DOM 渲染时机 + IPC 往返属运行时行为；truth 措辞已按实现时机收口（48-REVIEW.md WR-05 裁决段）"
  - test: "重跑 UAT test 4：`npm run dev` + 可用 provider → 发一条长回复 prompt，等首气泡确实有正文（停止按钮已亮）→ 流式中手打 `/skill:<真实技能名>` → 每 250ms 采样 15s"
    expected: "新气泡创建后有内容、持续增长；**不得**在 t≈7.4s 被写成「用户已取消」、不得其后 15s 零增长、停止按钮不得在 t≈0 就回退；`.ai-skill-pill` 应出现"
    why_human: "运行时竞态；UAT test 4 上一轮实测失败，锚点修复后须实测裁决是否真的闭合"
  - test: "48-REVIEW.md CR-05 的可达性实测（若采纳「先定口径」路线则可跳过）：在流式结束的瞬间连点两次停止按钮，随后触发一次任意真实错误（如临时把 provider key 改错）"
    expected: "下一轮的真实错误仍走 `showAIError`（有提示 + 重试按钮），**不得**被当成取消消费、不得把上一轮已完成回复正文覆盖为「用户已取消」、不得使 `aiStreaming` 永不复位（输入框被 `if (state.aiStreaming) return;` 静默丢弃）"
    why_human: "CR-05 是从状态机 + SDK 语义推出的窄竞态路径（`abort()` 打在已结算 run 上是静默 no-op），无任何测试覆盖；`finalizeAIStreamingBubble`（`renderer.js:8272`）只清 `aiStreaming` / `aiCurrentMessageId`，两处标记无正常结算清理点。此为已记档的复审 Critical，不阻断本阶段收尾，但须人工裁决修复时机"
  - test: "G-48-3 运行期探针（`.planning/WINDOWS.md` unrun-verify id 24）：在 `agent-workspace/managed-skills/` 下新建一个技能目录（**不打开** `/` 面板），直接手打 `/skill:<新名>`"
    expected: "请求到达主进程并由其当场读盘 → 正常调用（不再出现「未找到技能」且输入框被清空）"
    why_human: "主进程 idle 边界重扫 + 广播 + IPC 往返的运行时组合；node:test 只证明「发送路径零快照读取」（源码契约）与「主进程读盘成功」（单测）两个半边"
  - test: "DISC-05 模型侧复核（可选，已知限制）：在不手打 `/skill:` 的前提下提一个命中某技能 description 的任务，并追问「你有哪些技能？它们和你可用的工具有什么区别？」"
    expected: "理想：模型自行 `read` 该 SKILL.md，卡片标题「使用技能「x」」。已知：弱模型（Qwen3-8B）会把技能名当**工具**调用并得到 `Tool x not found`，且答「需通过 `/skill:` 显式调用」"
    why_human: "SDK 提示词模板已写明「Read the full skill file when the task matches its description.」并给出 `<location>` 绝对路径 —— Realm 侧接线无误，失败完全归因于模型能力；本机唯一可用 provider 为 Qwen3-8B，无法换更强模型复测。已作为观测写入 48-REVIEW.md IN-04（留给 Phase 50/51 的技能 UX）"
---

# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`）Verification Report

**Phase Goal:** 用户可在聊天输入框用 `/` 发现技能、以 `/skill:name` 调用；模型也能按 description 自动匹配技能并读取其正文。
**Verified:** 2026-09-12T12:25:00Z（20:25 +08:00）
**Status:** human_needed
**Re-verification:** Yes — after gap closure（上一轮 `2026-09-12T06:50:49Z`，`status: human_needed`，`24/28`；本轮为 UAT 诊断出 4 条 gap（G-48-2/3/4/6）并由 48-04 / 48-05 / 48-06 收敛后的重验）

## Goal Achievement

> **本轮结论摘要**：上一轮的 1 条 ⚠️ UNCERTAIN（CR-04 陈旧快照否决）与 1 条 ⚠️ UNCERTAIN（CR-01 属性转义，经用户 2026-09-12 裁决为已跟踪延后）**均已消解**；3 条 CRITICAL（CR-02 / CR-03 / CR-04）**全部由代码证据确认闭合**；无 must-have 真值 FAILED。剩余 5 条落 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED（运行时行为，node:test 无法裁决），故本阶段仍**不得** complete，须先重跑 UAT 探针。

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 / DISC-01：输入 `/` 后面板同屏分区列出「技能」（在上）与「命令」；0 项分区标题不输出 | ✓ VERIFIED | `src/skill-picker-model.js` `filterPickerItems`/`buildPickerItems` 实读；`tests/test-skill-picker-model.js` 实跑 `# pass 95 / # fail 0`；`renderSlashPickerList`（`renderer.js:10374+`）实读 |
| 2 | D-01：`state.slashPickerItems` 是展平单数组且数组顺序 === 视觉顺序；标题不占索引；点击 / hover 按扁平 `data-index` 直绑 | ✓ VERIFIED | `renderer.js:10374-10440` 实读（标题无 `data-index`、行 `data-index="${index}"`）；B 组接线断言 |
| 3 | D-03：命令分区语义与相对顺序零变化（原 token `startsWith`） | ✓ VERIFIED | B 组对同一 `rawFilter` 与 `SLASH_COMMANDS.filter(c => c.name.startsWith(rawFilter))` 做 `deepStrictEqual`；`renderer.js:344-347` 数组字面量恒 2 项 |
| 4 | DISC-04：行五要素（`/{name}` + 三档来源徽标 + `仅显式` + 单行截断描述 + 行尾标注）；禁用不渲染；`shadowed`/同名命令灰显不可选；超限可选中带标注 | ✓ VERIFIED | `renderer.js:10412-10440` 实读五要素顺序与 `TIER_BADGE` 白名单查表、`SLASH_STATUS_TONE_CLASS` 白名单；B 组 selectable 三例 + 状态标注优先级 |
| 5 | DISC-01：↑↓ 只在可选中集合上取模并跳过灰显行；全部不可选 → `activeIndex = -1`，Enter 回落既有 `executeActiveSlashCommand() === false` 路径 | ✓ VERIFIED | B 组导航取模 8 例；`renderer.js:10155+` 消费 `state.slashPickerSelectable` + `nextSelectableIndex` |
| 6 | D-17 / P-48-06：面板 stale-while-revalidate（快照即时渲染 → 后台 `refreshSkills` → 广播只重拉 + digest 早退）；无 loading 态；失败保留旧快照；renderer `.refreshSkills(` 调用点唯一 | ✓ VERIFIED | 源码实测：`grep -c "\.refreshSkills(" src/renderer.js` = **1**（仅 `:10316` 的 `openSlashPicker`）；`pullAiSkillsSnapshot`（`:9081-9089`）digest 早退；G 组 5 例 + C 组自激护栏 |
| 7 | SC2 / DISC-02：`/skill:name [args]` 与裸 `/name [args]` 一致解析（本地命令优先、严格前缀 + 空白边界、`^[a-z0-9-]+$`） | ✓ VERIFIED | A 组 32 例（含 `/foobar` `/foo-bar` `/skill:` `/skill:Foo` `/Skill:foo` 反例）；`parseSkillInvocationText` 与 `parseSkillRef` 跨进程一致性断言 |
| 8 | DISC-02：技能正文在**调用那一刻**从磁盘读取；空串 / 仅空白 / 目录读不到 → `not_found`（绝不产字面量 `undefined`） | ✓ VERIFIED | `ai-skills-manager.js:802-834` 实读（每次 `import(...)` + `loadSkills(env, dirname)` 重读盘）；D 组「实时读盘」改盘后二次调用读到新正文 |
| 9 | DISC-02：`<skill>` 块逐字节 === `formatSkillInvocation(skill, provenance + '\n\n' + args)` | ✓ VERIFIED | D 组用**真实 SDK** `formatSkillInvocation` 构造期望值，三例（含空 args、含空行 args）全等 |
| 10 | D-07：拼接顺序 `[skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]`；无技能调用时输出与改动前逐字符相同 | ✓ VERIFIED | `ai-manager.js:1290` 实读数组字面量与计划逐字一致；D 组行为断言 + 相对次序源码断言 |
| 11 | DISC-03：`_ensureConversation(message)` 保持原始语法文本（对话标题不退化），注入只发生在 `agent.prompt` | ✓ VERIFIED | `ai-manager.js:1060` 为 `this._ensureConversation(message)`；`_ensureConversation(enhanced` 命中 0；`_deriveConversationTitle('/skill:find-skills')` 打表 |
| 12 | D-06：user 气泡 `content` = args 原文；重开对话由 `getConversationMessages` 还原同形 `{content: args, skillInvocation:{name,tier,content}}`（含 `@` 引用 / 附件 / args 含空行 / **空 args 四形态**） | ✓ VERIFIED | D 组「重载装饰（八例）」+ `resolveSkillBubbleArgs` 打表；`ai-manager.js:6187+` 两趟扫描规则实读；live 与重载路径 content 逐字符相等的可失败等式 |
| 13 | D-19：两条重发路径（`regenerateMessage` / `showAIError` 重试）经 `buildResendPayload`（唯一实现）由 args + name 重组完整语法文本；空 args 时载荷非空 | ✓ VERIFIED | `function buildResendPayload(` 命中数 = 1；C 组 `buildSkillSyntaxText` 往返表；F 组两处 `await ... ai.prompt(payload)` 源码断言 |
| 14 | DISC-03：技能调用**进入对话历史并触发 LLM**（与本地 `clear`/`compact` handler 语义区分） | ✓ VERIFIED（机制面） | `renderer.js:8697-8709` 技能分支只记录 `skillRef` 后走既有发送链（`ai.prompt` / `promptWithContext`）；`agent.prompt(enhanced)` 源码断言 + `_ensureConversation` 不变。真实 LLM 回复面归 UAT（见 Human Verification） |
| 15 | DISC-04：`getSkillsForUI` 收窄投影（**不含** `content`/`filePath`/`diagnostics`）+ 三档 `tier` 由主进程唯一计算 + `promptOmitted` 只打在预算丢弃的 eligible 条目 | ✓ VERIFIED | `ai-skills-manager.js:707-720`（`toUISkillEntry` 键集合逐字实读）、`:684`（`sourceTierOf`）、`:761-767`（`getSkillsForUI`）、`:609`（`eligible.slice(kept.length)`）；D 组 `assert.ok(!(k in entry))` 三例 |
| 16 | DISC-06：技能不存在 / 已禁用 → 结构化 `skillError`（`skill_not_found` / `skill_disabled` 两码两文案，无第三码），主进程不调用 `agent.prompt` | ✓ VERIFIED | `ai-manager.js:6089-6099`（`skillErrorFromReason` 唯一来源）、`:1429`（`readSkillForInvocation` 失败即返回 `skillError`，`agent.prompt` 不被调用）；`ipc-handlers.js` 返回体 `{success, conversationId, skillInvocation, skillError}`；D 组打表 + 值域断言 |
| 17 | DISC-07：`disableModelInvocation` 的技能不进 system prompt、仍可经 `/skill:` 显式调用、与 `disabled` 互不蕴含、永不 `promptOmitted` | ✓ VERIFIED | D 组「投影收窄 / tier 三档 / promptOmitted / DISC-07」各一条可失败断言 + flag 独立性一例 |
| 18 | DISC-05：`read` 打开技能目录 `SKILL.md` → `tool_execution_start` 带 `skill_invocation = {name,tier}`；非 `read` / 缺 `path` / `path` 非字符串 / basename ≠ `SKILL.md` / 工作区外 / 无 `sandboxEnv` → `null` 且不抛错 | ✓ VERIFIED | `ai-manager.js:1612-1618`（`_resolveSkillMarker` 五道守卫实读）、`:1693`（`skill_invocation: this._resolveSkillMarker(...)`）；H 组四类路径 + 四条负例 |
| 19 | DISC-05：renderer 把事件字段落到 `toolExecution.skillInvocation`；`renderToolCard` 技能变体标题「使用技能「name」」+ `TIER_BADGE` 白名单徽标、全 `textContent`；判定只在主进程（renderer **零**路径匹配）；重载链路同一实现 | ✓ VERIFIED | `renderer.js:9364`（`skillInvocation: event.skill_invocation`）、`:9579-9586`（标题 + 白名单徽标）实读；`grep -c "matchSkillByPath\|path\.resolve" src/renderer.js` = **0**；`ai-manager.js:2707` 重载走同一 `_resolveSkillMarker`；I 组键集合逐字相等 / 不挂键 / 容错不丢消息 |
| 20 | 48-02 backstop：50+ 技能下 220px 面板观感（sticky 常驻 / 五要素可读 / 标注不截断） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 结构面齐备（`.slash-picker-group-header` sticky + 显式背景、行 `flex-wrap`、`max-height: 220px` 零改动），但纯视觉观感不可自动化裁决。UAT test 7 已由自动驱动实测判 pass（sticky 偏移 1px、截断 0、`emptyDesc` 0、限额标注 14+1 与算术一致）→ 见 Human Verification |
| 21 | **【原 T25 · CR-04 → 已闭合】G-48-3**：发送 `/skill:<name>` 时 renderer **零本地否决** —— 请求一定到达主进程，由它当场读盘裁定（运行期新增技能 + 从未打开过 `/` 面板也可调用） | ✓ VERIFIED | `renderer.js:8692-8709` 实读：技能分支只剩四步（按 kind 分流 → 记录 `skillRef` → `await abortAIIfStreaming()` → 就地复位流式状态），两段 `known` / `known.disabled` 否决整段消失；源码探针 `state.aiSkills` / `known.disabled` 在发送路径命中 **0**；`grep -n "state.aiSkills" src/renderer.js` 全部落在面板侧与 state 声明；`tests/test-skill-picker-model.js`「技能分支：只按 kind 分流，无本地否决（48 G-48-3）」+ `tests/test-ai-skills.js` F 组同款断言实跑通过 |
| 22 | **【新增】G-48-3b**：`skills:changed` 广播到达即**无条件** `pullAiSkillsSnapshot()`（去掉面板关闭早退），且**绝不**触发 `refreshSkills()`（自激回路 P-48-06 不回归） | ✓ VERIFIED | `renderer.js:4405-4409` 实读处理器体只有 `pullAiSkillsSnapshot();`；300 字符窗口探针 `window-has-refreshSkills: false`；全文件 `.refreshSkills(` 计数 1 |
| 23 | **【原 CR-02 → 已闭合】G-48-2**：`frontmatter name ≠ 目录名` 的技能面板可见可选，`/skill:<目录名>` 可正常调用，注入用 name = **目录名** | ✓ VERIFIED | `ai-skills-manager.js:817-833` 实读判据为 `path.resolve(path.dirname(s.filePath)) === expectedDir`；判据探针实测 `expectedDir=true` / `legacy-name-judgment=false` / `skills[0]-fallback=false` / `name-rewritten=true`；`tests/test-ai-skills.js` 三条新用例实跑通过：「目录名与 frontmatter name 不一致的技能可正常显式调用（G-48-2 靶心）」「注入块的 name 属性与 provenance 行都是目录名（冒名 name 不进块）」「name 不一致 + 实时读盘」 |
| 24 | **【原 CR-03 源码面 → 已闭合】G-48-4a**：迟到的取消事件按**锚点**解算，只作用于被取消的那条消息；不得读「当前」`aiCurrentMessageId` 做归属；`resetRunState` 只由锚点等式决定；两处对话切换清空锚点 | ✓ VERIFIED | `renderer.js:9387-9413` 实读取消分支：先 `resolveCancelAttribution(state.aiMessages, state.aiCancelledMessageId, state.aiCurrentMessageId)` 再复位，`resetRunState` 门控 `aiStreaming` / `aiCurrentMessageId` / 发送按钮；`src/ai-cancel-state.js:46-60` 实读（`list.findIndex(role==='assistant' && id===cancelledId)` + `resetRunState = !!cancelledId && cancelledId === currentId`）；`renderer.js:7214-7215` / `:7252-7253` 两处对话切换清空；`tests/test-ai-cancel-state.js` 实跑 `# pass 14 / # fail 0`（含 A 组② UAT test 4 实测序列靶心断言） |
| 25 | **【原 CR-03 运行时面】G-48-4b**：流式中（含卡在工具确认卡片）调用技能 → 新气泡不被写成「用户已取消」、其后不零增长、停止按钮不提前回退 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码契约与纯逻辑判定齐备（真相 24），但「abort × 新消息」是运行时竞态（`ai:abort` 同步返回 + 迟到 error 到达序），无测试覆盖。**且 48-REVIEW.md CR-05 指出相邻不变式仍未闭合**：`finalizeAIStreamingBubble`（`renderer.js:8272-8281`）正常结算时只清 `aiStreaming` / `aiCurrentMessageId`，`aiCancelledByUser` / `aiCancelledMessageId` 无正常结算清理点（`grep` 全仓仅 7214/7252 / 8391/9122 / 9397 五组）→ 故本条**不得**记 VERIFIED。见 Human Verification |
| 26 | **【新增】G-48-6**：发送 `/skill:<name> <args>` 后**无需任何额外交互**，用户气泡在**本轮回合结束时**即含 `.ai-skill-pill` 与默认折叠的 `.ai-skill-content-box`（口径收口：2026-09-12 用户裁决） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 「无需额外交互」半边由源码契约成立：`buildUserMessageContent` 单源（`renderer.js:8973`，`renderAIMessages` 委派于 `:8055`、`refreshUserMessageBubble` 复用 `:8195`）、三处回填后立即刷新（`:8816` 发送 / `:10006` 重新生成 / `:10083` 错误重试）、定向 `replaceChild`（`:8198-8202`）非整列重绘。**呈现时刻 = 本轮回合结束**（`refreshUserMessageBubble` 唯一触发点是 `ai:prompt` 应答返回之后，而该应答在 `agent.waitForIdle()`（`ai-manager.js:1083`）之后才解析）—— 该口径已由用户 2026-09-12 裁决收口，替代原「回车那一刻立即」（48-REVIEW.md WR-05 裁决段）。见 Human Verification |
| 27 | **【新增】48-06 单源护栏**：两条失败文案（`skill_not_found` / `skill_disabled`）的唯一来源在主进程 `skillErrorFromReason`，renderer **零复制** | ✓ VERIFIED | `grep -c "未找到技能" src/renderer.js` = **0**；`ai-manager.js:6089-6099` 两条文案字面量仍在；两套测试（picker C 组 / ai-skills F 组）跨文件断言成对钉住「主进程仍含 / 渲染端不含」 |
| 28 | 真实 Electron 端到端：气泡三件套 / 两条 system-note / 流式中调用技能不被丢弃 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码与静态断言齐备（`renderAISkillPill` / `renderSkillContentBox`（全 `textContent` + DOM API）、`removeSkillFailureBubbles`、预检位于 `if (state.aiStreaming) return;` 之前），运行时链路与流式时序无测试覆盖。UAT test 6 的 clause 2/3 已实测通过；clause 1/4 待重跑 |
| 29 | DISC-05：模型**仅凭 description 自动匹配**技能（用户不显式调用也能生效） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 机制三面均有断言（description 进 prompt、事件带标记、卡片渲染），但「模型是否自发匹配」须真实 LLM。**已按 2026-09-12 UAT 裁决拆分**：①（匹配到之后的可见性 + 徽标 + 路径 + 重载还原）端到端证成；②（模型自发遵守 SDK 的 `read` 指令）由 SDK 提示词模板承载、归因模型能力（本机 Qwen3-8B 把技能名当工具调用 `Tool demo not found`）→ 记为已知限制（48-REVIEW.md IN-04） |
| 30 | 文档同步（48-03 + 48-06）：`docs/product/ai-skills.md` §10「发现与调用」全量（§10.3 判定面 / §10.4 表下两条注 / §10.5 / §10.6 / §10.7 两条 / **新增 §10.8 用户气泡契约**）+ §七 测试清单；`AGENTS.md` 测试清单登记 | ✓ VERIFIED | `docs/product/ai-skills.md` §10.8 `###` 标题位于 §10.7 之后；§10.7 含「无条件重拉」且全文不含旧限定「仅在面板打开时」；§七 含 `node tests/test-ai-skills.js`（**132 例，实测**）与 `node --test tests/test-ai-cancel-state.js`；`AGENTS.md:267` 含 `tests/test-ai-cancel-state.js` 并补 `test-skill-picker-model.js` 覆盖面 |
| 31 | 禁止项：本阶段**零新增技能写路径** | ✓ VERIFIED | `git diff 23e5144e^..HEAD -- ai-skills-manager.js` 新增函数只有 `sourceTierOf` / `toUISkillEntry` / `matchSkillByPath` / `getSkillsForUI` / `readSkillForInvocation` 五个只读函数；无创建 / 修改 / 删除入口 |
| 32 | 禁止项：技能条目不得并入 `SLASH_COMMANDS` | ✓ VERIFIED | `renderer.js:344-347` 数组字面量项数 = 2（`clear` / `compact`），无 `SLASH_COMMANDS.push` |
| 33 | 禁止项：renderer 不重算技能集状态（优先级 / 遮蔽 / 限额 / 预算省略 / 档位，只消费投影） | ✓ VERIFIED | `src/renderer.js` 与 `src/preload.js` 内 `64 * 1024` / `65536` / `8000` / `MAX_USER_SKILLS` / `localeCompare` / `/api/skills` 命中数全为 **0** |
| 34 | 禁止项（48-02）：面板 `innerHTML` 模板内插入的 `name` / `description` / 行尾标注 / `title` **全部**经 `escapeHtml()`；tier → class 走白名单查表 | ✓ VERIFIED（开放延后：TD-48-01） | `renderer.js:10417-10435` 逐条插值均在 `escapeHtml(...)` 内，tier / statusTone 走冻结表；**但** `escapeHtml`（`:11349-11353`）= `textContent → innerHTML`，不转义 `"`，属性上下文可逃逸 —— 该缺陷已由用户 2026-09-12 裁决登记为 `TD-48-01`（延后，接手触发点 = Phase 49 开工前第一条），UAT test 5 实测其执行被主窗口 CSP `script-src 'self'` 拦掉、残余影响降为 minor。**禁止项字面要求成立 → 记 VERIFIED**，延后记录见 `open_deferrals` |
| 35 | 禁止项（48-03）：技能化不额外插 system-note、不改 `.tool-card` 既有规则、不新增卡片形状；存储层无技能域知识 | ✓ VERIFIED | H 组四条既有规则体内零命中新类 / 文案；`ai-conversations-manager.js` 内 `skillInvocation` 命中 0；`_resolveSkillMarker` 失败一律 `null`（零回归契约） |
| 36 | 禁止项（48-05）：不得用整列 `renderAIMessages()` 冒充 G-48-6 修复；不得删除 `aiCancelledByUser` / 改写「用户点停止」既有语义 | ✓ VERIFIED | `refreshUserMessageBubble` 用 `replaceChild` 定向替换（`:8198-8202`，函数体不含 `innerHTML = ''`）；`aiCancelledByUser` 仍在（`:257` 声明、`:8383` / `:9115` 置位、`:9397` 消费），`resetRunState` 为真时仍复位并切回发送按钮 |

**Score:** 31/36 truths verified（5 present, behavior-unverified —— 真相 20 / 25 / 26 / 28 / 29）
**Prohibitions:** 6 条 judgment-tier 禁止项逐条核对 —— 6 条全部 VERIFIED（真相 31-36），其中真相 34 附带一条**用户已裁决的开放延后**（TD-48-01），不另记 UNCERTAIN。

### Previously-Failing / Uncertain Items — 逐条重判

| 上一轮状态 | 本轮判定 | 决定性证据 |
| --- | --- | --- |
| **T25 / CR-04** ⚠️ UNCERTAIN（禁止项：不得以快照替代实时读盘） | **✓ VERIFIED** | 两段本地否决已被 48-06 整段删除（`renderer.js:8692-8709`）；发送路径 `state.aiSkills` / `known.disabled` 命中 0；`skills:changed` 改为无条件重拉（`:4405-4406`）。渲染端不再可能在主进程读盘之前否决调用 |
| **T26 / CR-01** ⚠️ UNCERTAIN（禁止项：插值全部经 `escapeHtml`） | **✓ VERIFIED**（开放延后 TD-48-01） | 禁止项字面要求成立（`renderer.js:10417-10435` 逐条插值均在 `escapeHtml(...)` 内、tier 走白名单）；威胁模型缓解的有效性缺陷经用户 2026-09-12 裁决「延后 + 登记技术债（接手触发点 = Phase 49 开工前第一条）」，UAT test 5 实测其执行被 CSP 拦掉、定级降为 minor。按裁决记 VERIFIED + `open_deferrals` |
| **CR-02**（人类裁决项，非 truth） | **✓ VERIFIED → 真相 23** | 判据改目录路径全等 + 注入名重写；三条新用例实跑通过，且对旧实现必然红 |
| **CR-03**（人类裁决项） | **源码面 ✓ VERIFIED → 真相 24**；**运行时面 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED → 真相 25** | 锚点解算 + 条件复位 + 独立纯逻辑模块 + 14 例实跑通过；运行时序无测试覆盖，且 CR-05 揭示相邻不变式（标记生命周期）仍未闭合 |
| **T19 / DISC-05 模型侧** ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **维持 ⚠️ → 真相 29**（按 UAT 裁决拆分与归因） | 机制面证据不变；模型不遵守 SDK 指令归因模型能力，已记 IN-04 |
| **T20 / backstop** ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **维持 ⚠️ → 真相 20**（UAT test 7 已实测判 pass，仍非自动化可裁决） | UAT test 7 的量化证据（sticky 1px / 截断 0 / 限额标注 14+1） |
| **T21 / 真实 Electron E2E** ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **维持 ⚠️ → 真相 28**（clause 2/3 已过，clause 1/4 待重跑） | 源码契约齐备，运行时链路无测试覆盖 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/skill-picker-model.js` | 双模式导出纯逻辑模型（解析 / args / 反向语法 / 面板四函数 / `TIER_BADGE`） | ✓ VERIFIED | 358 行；`require()` 与 `window.SkillPickerModel` 同引用；零 import 依赖 |
| `src/ai-cancel-state.js` | **新**：零依赖 / 零 DOM / 双模式导出，`resolveCancelAttribution` | ✓ VERIFIED | 68 行，实读；入参守卫 + `resetRunState` 与列表形态解耦；`tests/test-ai-cancel-state.js` A 组 9 例钉住 |
| `ai-skills-manager.js` | `readSkillForInvocation`（**目录路径判据 + name 重写**）/ `sourceTierOf` / `toUISkillEntry` / `matchSkillByPath` / `getSkillsForUI` + `promptOmitted` | ✓ VERIFIED | 五函数均在导出面；`readSkillForInvocation` 判据探针四项全过 |
| `ai-manager.js` | 解析 / 组装 / 返回契约 / 重载装饰 / `_resolveSkillMarker` / `skillErrorFromReason` | ✓ VERIFIED | 实读落点：`:1060`（`_ensureConversation(message)`）、`:1290`（拼接顺序）、`:1426-1446`（`_resolveSkillInvocation` + `{name,tier,content}` 契约）、`:1612-1618`（marker 五守卫）、`:1693`（事件字段）、`:6089-6099`（错误码文案唯一来源） |
| `ipc-handlers.js` | `ai:get-skills` / `ai:refresh-skills` 两通道 + `ai:prompt*` 返回体扩展 | ✓ VERIFIED | `:1747` / `:1763` 均 `assertTrustedSender(event)` + `aiManager` 判空；`ai:prompt*` 返回 `skillInvocation` / `skillError` |
| `src/preload.js` | `realmAPI.ai.getSkills` / `refreshSkills` 成对暴露 | ✓ VERIFIED | `:1033` / `:1040` |
| `src/renderer.js` | 发送路径零否决 / 气泡单源构建 + 定向刷新 / 取消锚点 / 面板 / 导航 / 卡片变体 / 重发收敛 | ✓ VERIFIED | 逐点实读（见真相 21-27 证据列） |
| `src/index.html` | `skill-picker-model.js` → `ai-cancel-state.js` → `renderer.js` 顺序；`main.css?v=8` | ✓ VERIFIED | `:1021` / `:1024` / `:1025`；`:11` 为 `styles/main.css?v=8` |
| `src/styles/main.css` | 四个令牌（两主题块）+ 技能相关新类；`max-height: 220px` 零改动 | ✓ VERIFIED | 令牌声明数 5/5/5/3；八类全部存在 |
| `tests/test-ai-skills.js` | D/E/F/G/H/I 六组 + G-48-2 三条 + G-48-3 断言改写 | ✓ VERIFIED | 实跑 `# tests 132 / # pass 132 / # fail 0` |
| `tests/test-skill-picker-model.js` | 面板 / 解析纯逻辑 + 气泡单源与定向刷新接线 | ✓ VERIFIED | 实跑 `# tests 95 / # pass 95 / # fail 0` |
| `tests/test-ai-cancel-state.js` | **新**：A 组纯逻辑 9 例 + B 组接线护栏 5 例 | ✓ VERIFIED | 实跑 `# tests 14 / # pass 14 / # fail 0` |
| `docs/product/ai-skills.md` | §10.3 / §10.4 表下注 ×2 / §10.7（改述 + 两条）/ §10.8 新小节 / §七 | ✓ VERIFIED | 见真相 30 |
| `AGENTS.md` | 测试清单登记 + 覆盖面更新 | ✓ VERIFIED | `:267` 含 `test-ai-cancel-state.js` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `handleSendAIMessage` 斜杠分支 | `realmAPI.ai.prompt` / `promptWithContext`（完整语法文本）→ `_resolveSkillInvocation` → `readSkillForInvocation` | IPC → 主进程解析 → 实时读盘 | ✓ WIRED | `renderer.js:8692-8709` 无本地否决；`ai-manager.js:1426` 实时读盘；载荷 `text` 与气泡正文分离 |
| `ai-manager.getSkillsForUI()` | `getSeededSkillNamesSafe()` → `getSkillsForUI(seededNames)` → `ai:get-skills` → `realmAPI.ai.getSkills` | 收窄投影过 IPC | ✓ WIRED | 惰性 require + try/catch 降级；两通道 `assertTrustedSender` |
| `refreshSkillsForPanel()` | `syncAgentSystemPrompt()` → `windowManager.broadcast('skills:changed')` → renderer **无条件**重拉快照 | 读侧 P8 调用方 | ✓ WIRED | `renderer.js:4405-4406` 处理器体只有 `pullAiSkillsSnapshot()`；全文件 `.refreshSkills(` = 1（无自激） |
| 删除本地否决后的失败通道 | `skillErrorFromReason`（主进程）→ `_resolveSkillInvocation` `{skillError}` → IPC → `removeSkillFailureBubbles(userId)` + `pushSystemNote(result.skillError.message)` | **唯一**判定与文案通道 | ✓ WIRED | `renderer.js:8825-8833`；渲染端零文案复制（真相 27） |
| `getConversationMessages()` | `_decorateSkillUserMessage`（user 行）+ `_resolveSkillMarker`（assistant 行） | 装饰层重建 | ✓ WIRED | 方法体内无直接 `matchSkillByPath(`，符合「一处实现两处调用」护栏 |
| `_setupEventBroadcasting` 的 `tool_execution_start` | `skill_invocation` → renderer `toolExecution.skillInvocation` → `renderToolCard` 技能变体 | 事件字段链 | ✓ WIRED | `ai-manager.js:1693` + `renderer.js:9364` / `:9579-9586` 逐行核对 |
| `regenerateMessage` / `showAIError` 重试 | `buildResendPayload` → `SkillPickerModel.buildSkillSyntaxText` → `ai.prompt` + `refreshUserMessageBubble` | 唯一反向实现 + 定向刷新 | ✓ WIRED | `buildResendPayload` 定义命中 = 1；`:10006` / `:10083` 两处刷新调用 |
| `abortAIIfStreaming` / `handleStopAI` | `state.aiCancelledMessageId` → `handleAIStream` error 取消分支 `resolveCancelAttribution` | 锚点解算 | ✓ WIRED | `:9115-9118` / `:8383-8385` 置锚点，`:9390-9395` 解算；B 组 5 条接线护栏实跑通过（含「area 内不得按当前消息 id 查找」的负向断言） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 面板技能行 | `state.slashPickerItems` | `SkillPickerModel.buildPickerItems(state.aiSkills, SLASH_COMMANDS, rawFilter)` ← `realmAPI.ai.getSkills()` ← `ai-skills-manager._cache.skills`（SDK 扫盘） | Yes | ✓ FLOWING |
| 气泡技能 pill / 折叠块 | `msg.skillInvocation`（`{name, tier, content}`） | 调用响应回传的 `readSkillForInvocation` 实时读盘结果（`ai-manager.js:1444-1447`） | Yes（D 组探针确认返回值随磁盘变化） | ✓ FLOWING |
| 气泡正文 | `msg.content`（args） | `parseSkillRef(text).args`（renderer）/ `resolveSkillBubbleArgs`（重载） | Yes | ✓ FLOWING |
| 工具卡片标题 | `toolExecution.skillInvocation` | `_resolveSkillMarker` ← `matchSkillByPath` ← `_cache.skills[i].filePath` | Yes | ✓ FLOWING |
| 对话标题 | `_ensureConversation(message)` | 完整语法文本（原始用户输入） | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 面板与解析纯逻辑（picker） | `node --test tests/test-skill-picker-model.js` | `# tests 95 / # pass 95 / # fail 0` | ✓ PASS |
| 取消归属纯逻辑 + 接线护栏 | `node --test tests/test-ai-cancel-state.js` | `# tests 14 / # suites 2 / # pass 14 / # fail 0` | ✓ PASS |
| 显式调用纵向切面（ai-skills，含 G-48-2 三条） | `node tests/test-ai-skills.js` | `# tests 132 / # suites 26 / # pass 132 / # fail 0` | ✓ PASS |
| 5 文件回归门 | `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-ai-conversations.js` | `# tests 346 / # pass 346 / # fail 0` | ✓ PASS |
| seeder（gate 口径） | `node tests/test-builtin-skills-seeder.js` | `# tests 101 / # pass 101 / # fail 0` | ✓ PASS |
| G-48-2 判据探针 | `node -e`（`readSkillForInvocation` 函数体扫描） | `expectedDir=true` / `legacy-name-judgment=false` / `skills[0]-fallback=false` / `name-rewritten=true` | ✓ PASS |
| 发送路径零本地否决探针 | `node -e`（`handleSendAIMessage` → `aiStreaming` 守卫区间扫描） | `state.aiSkills` / `known.disabled` 命中 **0** | ✓ PASS |
| 广播无自激 | `node -e`（`onIpcMessage('skills:changed'` 后 300 字符窗口） | `window-has-refreshSkills: false`；全文件 `.refreshSkills(` = 1 | ✓ PASS |
| 跨文件护栏（限额 / `localeCompare` / 本地 HTTP 端点 / 失败文案） | 三文件正则 | `64 * 1024` / `65536` / `8000` / `MAX_USER_SKILLS` / `localeCompare` / `/api/skills` / `未找到技能` 全 **0** | ✓ PASS |
| 脚本接线顺序 / preload 成对方法 / `SLASH_COMMANDS` 项数 | 源码断言 | `skill-picker-model.js`(1021) → `ai-cancel-state.js`(1024) → `renderer.js`(1025)；preload `:1033`/`:1040`；数组项数 2 | ✓ PASS |
| 未加引用的债标记（阶段改动文件） | `git diff 23e5144e^..HEAD \| grep -E "^\+" \| grep -E "TBD\|FIXME\|XXX"` | 新增行零命中（`ai-manager.js:506/543` 的 `XXX` 为既有工具描述文本，非本阶段新增行） | ✓ PASS |

### Probe Execution

未声明探针，且本阶段非迁移 / CLI 阶段：PLAN / SUMMARY 内无 `probe-*.sh` 声明，`scripts/*/tests/` 下无匹配 → **Step 7c: SKIPPED（no probes declared）**。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DISC-01 | 48-02 | `/` 面板列出全部已启用技能与既有本地命令、可按名称实时过滤 | ✓ SATISFIED | 真相 1/2/3/4/5/6 |
| DISC-02 | 48-01, 48-02, 48-04, 48-05, 48-06 | 选择技能以 `/skill:name [args]` 调用，正文经 `formatSkillInvocation` 作 `<skill>` 块注入 | ✓ SATISFIED | 真相 7-13、21-23、26-27、30 |
| DISC-03 | 48-01, 48-05 | 技能调用进入对话历史并触发 LLM（与本地命令区分） | ✓ SATISFIED（机制面；实机回复面归 UAT） | 真相 14、24、25 |
| DISC-04 | 48-01, 48-02 | 技能列表区分来源（user/managed/seeded）并以徽标展示；被遮蔽的同名技能可见 | ✓ SATISFIED | 真相 4、15 |
| DISC-05 | 48-03 | 模型可按 description 自动匹配技能并 `read` 其正文 | ✓ SATISFIED（交付物）/ ⚠️ 模型侧行为归模型能力 | 真相 18、19 机制面全绿；真相 29 按 UAT 裁决拆分（①端到端证成；②归因模型能力，记 IN-04） |
| DISC-06 | 48-01, 48-06 | 调用不存在的技能给出明确错误提示（不出现「点了没反应」） | ✓ SATISFIED | 真相 16、21、27 |
| DISC-07 | 48-01, 48-02 | `disable-model-invocation` 不进 system prompt，仍可 `/skill:` 显式调用并在 UI 打标 | ✓ SATISFIED | 真相 17、4 |

**Orphaned requirements:** 无。`REQUIREMENTS.md:130-136` 映射到 Phase 48 的恰为 DISC-01..07，七个 ID 全部出现在至少一个 PLAN 的 `requirements:` 字段（48-01: DISC-02/03/04/06/07、48-02: DISC-01/04/07、48-03: DISC-05、48-04: DISC-02、48-05: DISC-02/03、48-06: DISC-02/06）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/renderer.js` | 10427（同类 10419-10420 / 10430-10431；辅助 `11349-11353`） | 磁盘来源技能名经 `escapeHtml` 拼进 **HTML 属性**（`title="…"`），`escapeHtml` = `textContent → innerHTML` 不转义 `"` | 📋 Advisory（**用户已裁决延后** → `TD-48-01`） | 目录名含 `"` 的技能可闭合 `title` 属性并注入新属性 / 事件处理器。UAT test 5 实测：属性逃逸**成立**，但主窗口 CSP `script-src 'self'` 使内联事件处理器**不被编译** → 残余影响降为 minor（CSS 注入 / UI 伪装 / latent XSS）。按 2026-09-12 裁决「登记技术债延后，接手触发点 = Phase 49 开工前第一条」，不作为本阶段 BLOCKER |
| `src/renderer.js` | 8272-8281 | `finalizeAIStreamingBubble`（run 正常结算）只清 `aiStreaming` / `aiCurrentMessageId`，**不清** `aiCancelledByUser` / `aiCancelledMessageId` | ⚠️ Warning（已记档的复审 Critical CR-05，不阻断收尾） | 窄竞态下（abort 打在已结算 run 上 = SDK 静默 no-op）标记跨轮存活 → 下一轮真实错误被当取消消费、已完成回复正文被覆盖、`resetRunState=false` 使轮次状态永不复位。**使真相 25 无法记 VERIFIED**。见 Human Verification |
| `ai-skills-manager.js` | 808-816 | `readSkillForInvocation` 的 `await import(...)` 在 `try` **之外**（try 只包 `loadSkills`），且**不复查磁盘当前 size** | ⚠️ Warning（WR-02 / WR-06） | WR-02：动态 import 失败即穿透到 IPC，`isProcessing` 保持 `true` → 之后所有消息被拒（同文件唯一未成对复位的分支）。WR-06：实时读盘路径绕过 64 KiB 字节闸（复审探针实测 204,858 字节正文仍 `ok=true`）→ 使 `48-RESEARCH.md` 的 DoS 缓解口径（「超限技能根本不在缓存 → 不可调用」）**对调用路径不成立**。两者均**未**falsify 任何已登记 must-have 真值（48-01 的字节闸真值只约束「长度常量语义」，不宣称调用路径复查），但文档承诺需在 Phase 49/50 收口 |
| 全阶段改动文件 | — | `TBD` / `FIXME` / `XXX` | ℹ️ Info | 无新增未引用债标记（阶段 diff 新增行零命中） |
| 阶段改动文件 | — | 占位 / 空实现（`return null` / `return []` / 「即将推出」） | ℹ️ Info | 未发现；`resolveCancelAttribution` 的 `-1` / `false`、`readSkillForInvocation` 的 `{ok:false,reason:'not_found'}` 均为**终态判定结果**，非 stub |

### Advisory（新范围，无独立决定性证据）

> 本条按 Step 7 的「re-verification evidence gate」列出：以下均为 48-REVIEW.md 复审轮**新增或继承**的 finding，我这轮**未**独立复跑其探针，故不作为 BLOCKER。其中 `src/renderer.js` 在上一轮 `verified:` 时间戳之后确实被 git 修改过（48-05 / 48-06），按 fail-closed 口径本可继续阻断 —— 但用户 2026-09-12 已对同源的 CR-01 作出「延后 + 技术债」裁决，故 CR-01 记 `open_deferrals` 而非重开 BLOCKER。

| # | Finding | Category | 为何仅作 Advisory |
| - | ------- | -------- | ----------------- |
| 1 | WR-01：`SKILL_TIER_TITLES`（`renderer.js:8847-8851`）与 `TIER_BADGE[*].title`（`skill-picker-model.js:324-340`）逐字重复三条文案 | 架构（单源） | 未 falsify 任何 must-have 真值（docs §10.5 的「共用同一张查表」对 pill 的表述略宽）；未独立复现逐字比对 |
| 2 | WR-03：两条重发路径的 `skillError` 分支留下带「复制」按钮的空气泡（与发送路径 `removeSkillFailureBubbles` 不一致） | 一致性（UI 观感） | 三个入口的失败界面形态不一致，但非 must-have 断言面；未独立复现 |
| 3 | WR-04：`_resolveSkillMarker` 未对齐 SDK `normalizeToolPath`（`@` 前缀 / Unicode 空格）→ 静默退化为普通卡片 | 一致性（判据） | 48-03 的 `[assumption]` 已明示「极端形态降级为普通 read 卡片、正文仍被读取」为可接受降级并写入产品文档 |
| 4 | IN-01（`resolveSkillBubbleArgs` 用 `indexOf` 取首次出现）/ IN-02（preload JSDoc 未同步返回契约）/ IN-03（`activeIndex = -1` 后不重渲染） | 卫生（病态输入 / 文档 / 观感） | 均非 must-have 断言面；IN-03 属 DOM 高亮与 state 短暂背离 |
| 5 | IN-05（`renderAIMessages` 的 `isUser` 分支死分配）/ IN-06（`refreshUserMessageBubble` 不补 wrapper 级 `.message-actions`）/ IN-07（技能已解析但本轮 run 失败时 pill / 折叠块永不出现） | 死代码 / 观感 / 信息缺失 | IN-06、IN-07 是我这轮**实读确认存在**的相邻面（`.message-actions` 仅由整列渲染按 `msg.id && !state.aiStreaming` 追加；`ai-manager.js:1103` 错误路径返回 `skillInvocation: null`），但不影响任何已登记 must-have 真值；建议随 CR-05 一并处置 |
| 6 | IN-04：弱模型把技能名当**工具**调用（`Tool demo not found`） | 已知限制（非本阶段代码缺陷） | 48-03 已把它排为「可接受降级」，UAT test 8 裁决归因模型能力，已记 48-UAT / 48-REVIEW IN-04 |

### 既有红项核对（D-48-A，预注册）

- 本轮直跑 `node tests/test-builtin-skills-seeder.js` → `# tests 101 / # pass 101 / # fail 0`（**全绿**）。上一轮记录的「嵌套 `node --test` 下 `:2200` `DOC-02` 计数断言失败」未在本轮复现（本轮未以嵌套形式跑 seeder），该差异仍判定为**环境性、非 Phase 48 引入**（`tests/test-builtin-skills-seeder.js` 不在阶段 diff 的改动文件内）。

### 阶段门槛与文档一致性核对（48-06 自带的文本门）

- `48-01-PLAN.md` / `48-02-PLAN.md` 修订后 `frontmatter.validate --schema plan` 与 `verify.plan-structure` 均为 `true`（48-06 SUMMARY 记录，本轮未复跑工具链，仅确认 G-48-2 / G-48-3 修订标记与「（原文：…，已被取代）」归档在 §10.3 / §10.4 / §10.7 的对应位置成立）。
- `docs/product/ai-skills.md` §10.7 旧限定「仅在面板打开时」**全文不存在**，新口径「**无条件重拉**」位于 §10.7 区间；`### 10.8` 标题紧接 §10.7 之后（顺序正确）。
- `AGENTS.md:267` 的测试清单含 `node --test tests/test-ai-cancel-state.js` 且 `test-skill-picker-model.js` 条目覆盖面已补齐；`:272` 维护约定文字未改（执行而非改写）。

### Deferred Items

无。Step 9b 逐条比对后续阶段：Phase 49（`manage_skill` 写路径）/ Phase 50（设置页启停卸载）/ Phase 51（导入）的 goal 与 success criteria **无一覆盖** CR-05（renderer 取消标记生命周期）、WR-05（pill 出现时机口径）、WR-06（调用路径字节闸）—— 49/51 反而会放大 TD-48-01 与 CR-05 的可达性。故不作为 deferred 处理。

### Gaps Summary

**本阶段的功能目标在代码库中成立，且上一轮的全部失败/不确定项均已闭合。**

- **4 条 UAT gap 全部由代码证据确认关闭**：G-48-2（判据改目录路径全等 + 注入名重写，三条新用例实跑通过）、G-48-3（发送路径两段本地否决整段删除 + 广播无条件重拉）、G-48-4（取消锚点 + 独立纯逻辑模块，14 例实跑通过）、G-48-6（气泡构建单源 + 回填后定向刷新）。
- **上一轮 3 条 CRITICAL 复核闭合**（CR-02 / CR-03 源码面 / CR-04），1 条 CRITICAL（CR-01）经用户裁决转为已跟踪延后（TD-48-01），1 条 UNCERTAIN（陈旧快照否决）转为 VERIFIED —— **本轮无 UNCERTAIN、无 must-have 真值 FAILED、无 artifact MISSING/STUB、无 key link NOT_WIRED、无未引用债标记**。
- **测试实跑（非采信 SUMMARY）**：`test-skill-picker-model.js` 95/95、`test-ai-cancel-state.js` 14/14、`test-ai-skills.js` 132/132、5 文件回归门 346/346、seeder 101/101 —— 全绿。
- **5 条真值落 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED**（DISC-05 模型侧、G-48-4 运行时半边、G-48-6 运行时半边、48-02 视觉 backstop、真实 Electron 端到端）：全部属 node:test 无法裁决的运行时行为，已逐条进入 `behavior_unverified_items` 与 `human_verification`。其中两条带**已知残余**：
  - G-48-6 的「发送后**立即**」半边按 WR-05 在实现上不成立（`refreshUserMessageBubble` 只在 `ai:prompt` 应答（= 整轮 `waitForIdle()` 之后）返回时才触发）→ **已裁决收口措辞**（用户 2026-09-12）：呈现时刻 = 本轮回合结束，`docs/product/ai-skills.md` §10.8 与本报告 truth 已同步，UAT 只需验后半边；
  - G-48-4 的运行时半边受 CR-05 制约（取消标记无正常结算清理点，窄竞态下可跨轮污染并吞掉下一轮真实错误）→ **已裁决延后为 TD-48-02**（用户 2026-09-12，接手触发点 = Phase 49 开工前），不要求本阶段 UAT 实测。
- **结论**：自动化可裁决面全部通过；**运行时面尚未重跑**（UAT test 4 / test 6 clause 1 / G-48-3 运行期探针，均已登记在 `.planning/WINDOWS.md` 的 `unrun-verify`）。**UAT 探针重跑通过前本阶段不得 complete**（与用户既有口径「UAT 为准」及 `.planning/WINDOWS.md` 的 unrun-verify 条目一致）。

## 收尾裁决记录（2026-09-12 · gap 闭合轮）

`/gsd-execute-phase 48 --gaps-only` 收尾时对三项新发现作出裁决（用户拍板），据此对本文档措辞作收口，**不改变任何 must-have 的判定**：

| 项 | 裁决 | 落地 |
| --- | --- | --- |
| CR-05（Critical，取消标记无生命周期） | 先记技术债，直接跑 UAT | 登记为 `48-REVIEW.md` 的 **TD-48-02**，接手触发点 = Phase 49 开工前；不改代码、不要求本轮实测 |
| WR-05（G-48-6「立即」口径） | 收口措辞为「本轮回复结束时即现」 | §10.8 + 本报告 truth / human_verification / 真值表第 26 行 + UAT 第二轮 item 9 同步；UAT 只验后半边 |
| WR-06（调用路径绕过 64 KiB 字节闸） | 未裁决修复时机，保持开放 | 记入 `48-REVIEW.md` 裁决段；建议随 Phase 49 一并处置。本条不影响任何已登记 must-have 真值 |

本阶段因此维持 `status: human_needed`；UAT 第二轮（`48-UAT.md` item 9 / 10 / 12 / 13）通过后由 `/gsd-verify-work 48` 推进收尾。

---

_Verified: 2026-09-12T12:25:00Z_
_Verifier: Claude (gsd-verifier)_

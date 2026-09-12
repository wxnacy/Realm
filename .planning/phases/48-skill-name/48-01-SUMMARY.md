---
phase: 48-skill-name
plan: "01"
subsystem: ai
tags: [electron, pi-agent-core, skills, ipc, renderer, css, node-test]
requires:
  - phase: 46-prompt
    provides: "ai-skills-manager.js 技能集单一数据权威（refreshSkills / _cache / LIMITS / bySkillPriority / 遮蔽与限额标记）"
  - phase: 47-bash
    provides: "builtin-skills-seeder.getSeededSkillNames()（三档徽标的 seeded 身份，零状态文件）"
provides:
  - "src/skill-picker-model.js：`/` 面板与 `/skill:` 语法的纯逻辑模型（双模式导出，renderer 与 main 共用一份规则）"
  - "ai-skills-manager：readSkillForInvocation（调用瞬间实时读盘）/ sourceTierOf / toUISkillEntry / matchSkillByPath / getSkillsForUI（收窄投影）/ promptOmitted 条目字段"
  - "ai-manager：_resolveSkillInvocation（解析 + 读盘 + 组装 + 两码错误契约）、{conversationId, skillInvocation, skillError} 返回契约、getConversationMessages 的 user 行装饰、REALM_SYSTEM_PROMPT 的 D-18 措辞、refreshSkillsForPanel"
  - "两个新 IPC 通道 ai:get-skills / ai:refresh-skills + realmAPI.ai.getSkills / refreshSkills"
  - "renderer 调用路径：技能预检、气泡 pill + 技能正文折叠块、skillError 回滚、skills:changed 快照同步、buildResendPayload 重发载荷收敛"
affects: ["48-02-panel", "48-03-read-card", "49-manage-skill", "50-settings", "51-import"]
actuals:
  tokens: 37466
  tasks: 3
  commits: 6
plan_head_before: d683d08290240ba3c53ece86b60ed1836d96b23f
tech-stack:
  added: []
  patterns:
    - "双模式导出模块（裸 IIFE + `module.exports` 与 `window.X` 共用同一 api 对象引用）—— 项目内首个，使 renderer 规则可在纯 Node 下表驱动断言"
    - "「调用瞬间实时读盘 + 组装前拒绝」：读盘结果为空/冒名一律按不存在处理，绝不产出字面量 undefined"
    - "显示值与载荷解耦：气泡 content = args，IPC 载荷 = 完整语法文本；重发路径经反向唯一实现重组"
    - "收窄投影过 IPC：主进程剔除 content/filePath/diagnostics，renderer 只消费不重算"
key-files:
  created:
    - src/skill-picker-model.js
    - tests/test-skill-picker-model.js
  modified:
    - ai-skills-manager.js
    - ai-manager.js
    - ipc-handlers.js
    - src/preload.js
    - src/renderer.js
    - src/styles/main.css
    - src/index.html
    - tests/test-ai-skills.js
key-decisions:
  - "parseSkillRef 裸名分支加「本地命令名前缀占位」歧义护栏：token 以某本地命令名开头但不成立严格边界（/foobar 对 foo）→ 返回 null，走「未知命令」提示；这是计划两条 behavior 行（/foobar→null 与 /Skill:foo→裸名）唯一自洽的读法"
  - "裸名 not-found 与 /skill: not-found 分两条文案（未知命令 / 未找到技能）—— 按 UI-SPEC §Copywriting 的区分实现，并保留计划 Task 3 ② 的两条 system-note 拒绝分支"
  - "技能命中且处于流式回复中：abort 后就地复位 state.aiStreaming/aiCurrentMessageId/发送按钮 —— 取消事件是异步广播的，不复位则紧随的流式守卫会静默丢弃本次调用"
  - "气泡渲染抽成 renderAISkillPill / renderSkillContentBox 两个模块级函数：使「技能分支零 innerHTML」可被直接断言，且与既有附件徽标的 innerHTML 段分离"
  - "renderer 侧任务的三处源码护栏落点：C 组在 tests/test-skill-picker-model.js（纯逻辑 + renderer 扫描），F 组在 tests/test-ai-skills.js（调用路径），两处不重复同一断言"
  - "四个技能相关 CSS 令牌一次写进两个主题块（仅本阶段使用的 --skill-source-* 供 48-02/48-03 消费），面板行的 .slash-picker-* 类留待 48-02，不在本计划抢先落码"
patterns-established:
  - "跨进程规则单源：parser 住在一个零依赖的双模式模块，renderer 与 main 各自委派，杜绝两份 token/边界实现"
  - "args 还原唯一规则（resolveSkillBubbleArgs）：入库增强消息 → 气泡正文的单一定义，与 live 路径同源并有可失败等式"
requirements-completed: [DISC-02, DISC-03, DISC-04, DISC-06, DISC-07]
coverage:
  - id: D1
    description: "`/skill:name [args]` 与裸 `/name [args]` 在主进程被一致解析并从磁盘实时读取技能正文，经 SDK formatSkillInvocation 组装为 `<skill>` 块后注入 agent.prompt"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · 实时读盘（用户 2026-09-11 硬约束，DISC-02）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · 组装与拼接顺序（D-05 / D-07）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#A 组 · extractArgs —— token 取值法（事实 2 七组表逐行）"
        status: pass
    human_judgment: false
  - id: D2
    description: "技能调用进入对话历史并触发 LLM；`_ensureConversation` 仍收原始语法文本故标题不退化；重开对话由 getConversationMessages 还原为 `{content: args, skillInvocation:{name,tier,content}}`（气泡不出现原始 XML / provenance / 附件 marker / 引用 XML）"
    requirement: DISC-03
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · 重载装饰（八例，getConversationMessages 还原）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · 组装与拼接顺序（D-05 / D-07）"
        status: pass
    human_judgment: false
  - id: D3
    description: "面板投影收窄（剔除 content/filePath/diagnostics）+ 三档 tier（user/builtin/managed）由主进程唯一计算 + promptOmitted 只打在预算丢弃的 eligible 条目上"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · 投影收窄 / tier 三档 / promptOmitted / DISC-07"
        status: pass
    human_judgment: false
  - id: D4
    description: "技能不存在/已禁用返回结构化 skillError（两码两文案，无第三码），主进程不调用 agent.prompt；renderer 预检给出两条不同 system-note 且零气泡、并在响应失败时回滚"
    requirement: DISC-06
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · skillErrorFromReason（错误码与文案的唯一来源，DISC-06）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#C 组 · renderer 源码护栏（预检分支 / 重发载荷 / 气泡渲染）"
        status: pass
    human_judgment: false
  - id: D5
    description: "`disable-model-invocation: true` 的技能不进 system prompt，但仍可经 `/skill:` 显式调用；与 disabled 是互不蕴含的两个 flag（同时为真时禁用面胜出），且永不 promptOmitted"
    requirement: DISC-07
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · 投影收窄 / tier 三档 / promptOmitted / DISC-07"
        status: pass
    human_judgment: false
  - id: D6
    description: "两个无载荷 IPC 通道（ai:get-skills / ai:refresh-skills）经 assertTrustedSender + aiManager 判空可用，preload 成对暴露；REALM_SYSTEM_PROMPT 含技能/工具概念区分的 D-18 措辞而技能段逐字符未变"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#E 组 · 面板入口接线（D-17 / P8 触发点）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#E 组 · 通道成对 / 转义护栏（源码扫描）"
        status: pass
    human_judgment: false
  - id: D7
    description: "所有把本地消息再发给主进程的路径（首发送 / 重新生成 / 错误重试）都发送完整语法文本；重发由 buildResendPayload（唯一实现）重组，空 args 时既不静默不动作也不发空串；响应 skillError/skillInvocation 均被消费"
    verification:
      - kind: unit
        ref: "tests/test-skill-picker-model.js#C 组 · buildSkillSyntaxText 往返（语法文本 ↔ {name, args} 的互逆映射）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#F 组 · renderer 调用路径（D-06 / D-19 / 重发路径）"
        status: pass
    human_judgment: false
  - id: D8
    description: "无技能调用时增强消息与改动前逐字符相同（skillBlock 为空被 filter(Boolean) 剔除，其余四段相对顺序不变）；`skills:changed` 监听只重拉快照不自激"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#D 组 · 组装与拼接顺序（D-05 / D-07）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#C 组 · renderer 源码护栏（预检分支 / 重发载荷 / 气泡渲染）"
        status: pass
    human_judgment: false
  - id: D9
    description: "真实应用中的可见行为：手打 `/skill:name` 后气泡显示「技能」微标 + args 正文 + 默认折叠的技能正文块，未找到/已禁用走两条 system-note，流式中调用技能不被丢弃"
    verification: []
    human_judgment: true
    rationale: "本计划只产出 renderer 源码与静态断言；气泡视觉（蓝底 pill 上的微标观感、折叠块与 /compact 摘要框同屏协调）与真实 Electron 运行时链路（IPC 往返 + 主进程读盘 + 流式事件）无法由 node:test 覆盖，须在 UAT 中于 dev/debug 环境实机确认"
duration: 17min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 01: `/skill:name` 主进程端到端纵切 + renderer 调用路径接线 Summary

**`/skill:name [args]` 打通解析 → 调用瞬间实时读盘 → SDK `<skill>` 块组装 → 注入 Agent → 入历史 → 重开对话按 args 还原气泡；renderer 侧气泡 pill / 折叠块 / 错误回滚 / 重发载荷收敛全部闭合，`skills:changed` 只重拉快照不自激。**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-12T04:55:25Z
- **Completed:** 2026-09-12T05:12:28Z
- **Tasks:** 3 / 3
- **Files modified:** 11（新增 2，修改 9）

## Accomplishments

- **`/skill:` 调用链**：renderer 发完整语法文本（D-19 标题不退化），主进程 `parseSkillInvocationText` 解析出 `{name, args}` → `readSkillForInvocation` **当场从磁盘读正文**（空串/仅空白/目录被换/文件被删一律 `not_found`，绝不产出字面量 `undefined`）→ `buildSkillInvocationBlock` 逐字节等于 SDK `formatSkillInvocation(skill, provenance + '\n\n' + args)` → `agent.prompt(增强文本)`。
- **显示值与载荷解耦**：气泡 `content` = args 原文，IPC 载荷 = 完整语法文本；重开对话由 `parseStoredSkillInvocation` + `resolveSkillBubbleArgs`（唯一 args 还原规则）还原成与 live 路径**逐字符同形**的 `{content: args, skillInvocation:{name,tier,content}}`，覆盖含 `@` 引用 / 附件 / 多段 args / **空 args 四形态**共八例。
- **重发路径收敛**：`regenerateMessage` 与错误重试按钮统一走 `buildResendPayload` → `SkillPickerModel.buildSkillSyntaxText`（反向唯一实现）重组载荷 —— 技能正文再次被注入，args 为空时载荷为 `/skill:{name}`（非空），不再静默不动作；两处改为 `await` 后 catch 复位才真正生效。
- **面板数据面**：`getSkillsForUI` 收窄投影（零正文/路径/诊断）+ 三档 `tier`（seeded 集合由 `getSeededSkillNamesSafe` 注入，纯 Node 下降级为空集合并告警）+ `promptOmitted` 精准打在 ⑦ 预算丢弃的 `eligible` 条目上；经 `ai:get-skills` / `ai:refresh-skills` 两通道落地。
- **P8 触发点**：`refreshSkillsForPanel()` 成为 `syncAgentSystemPrompt()` 的**读侧**生产调用方（函数体逐字未改，46-04 的五条方法体断言继续绿），renderer 侧 `skills:changed` 监听只重拉快照且面板关闭时早退。
- **测试面**：`tests/test-ai-skills.js` 64 → 108 例、`tests/test-skill-picker-model.js` 0 → 48 例；全仓 19 个既有测试文件 533 例全绿（唯一例外是 `test-builtin-skills-seeder.js` 的一条**既有环境**断言，见 deferred-items.md）。

## Task Commits

Each task was committed atomically (TDD tasks carry test → feat):

1. **Task 1 (tracer) RED: skill-picker-model 纯逻辑断言** - `90a6a44` (test)
2. **Task 1 (tracer) GREEN: `/skill:name` 主进程端到端纵切** - `a8a070f` (feat)
3. **Task 2: 面板数据源 + 两个 IPC 通道 + D-18 措辞** - `303f5d1` (feat)
4. **Task 3 RED: renderer 调用路径断言（C 组 + F 组）** - `7640ff7` (test)
5. **Task 3 GREEN: renderer 调用路径接线** - `764f59b` (feat)
6. **单一数据权威源码护栏（补强）** - `78266f4` (test)

**Plan metadata:** 见最后的 `docs(48-01)` 提交（含 SUMMARY / STATE / ROADMAP / REQUIREMENTS）

## Files Created/Modified

- `src/skill-picker-model.js`（新）— 双模式导出的纯逻辑模型：`SKILL_PREFIX` / `extractArgs`（token 取值法，修 P-48-01）/ `parseSkillRef`（本地命令优先 + 严格边界 + `/skill:` 拆分）/ `parseSkillInvocationText`（main 侧权威解析同源）/ `buildSkillSyntaxText`（反向唯一实现）
- `tests/test-skill-picker-model.js`（新）— A 组 32 例 + C 组 16 例（往返表 / 预检护栏 / 重发载荷 / 自激护栏 / 限额与单一权威护栏）
- `ai-skills-manager.js` — `readSkillForInvocation`（实时读盘）/ `sourceTierOf` / `toUISkillEntry` / `matchSkillByPath` / `getSkillsForUI`；⑦ 尾部 `promptOmitted` 打标；条目形状注释补 `promptOmitted`
- `ai-manager.js` — `getBuiltinSkillsSeederLazy` / `getSeededSkillNamesSafe` / `getSkillsForUI` / `refreshSkillsForPanel` / `_resolveSkillInvocation` / `_skillTierByLocation` / `_decorateSkillUserMessage`；模块级 `parseSkillInvocationText` / `skillProvenanceLine` / `skillErrorFromReason` / `buildSkillInvocationBlock` / `skillTokenAt` / `resolveSkillBubbleArgs` / `parseStoredSkillInvocation`；`prompt` / `promptWithContext` 的返回契约与 `[resolved.skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]`；`getConversationMessages` 的 user 行装饰；`REALM_SYSTEM_PROMPT` 第 1 段 D-18 措辞
- `ipc-handlers.js` — 新增 `ai:get-skills` / `ai:refresh-skills`；`ai:prompt` / `ai:prompt-with-context` 返回体扩为 `{conversationId, skillInvocation, skillError}`
- `src/preload.js` — `realmAPI.ai.getSkills` / `refreshSkills` 成对暴露
- `src/renderer.js` — `state.aiSkills` / `aiSkillsDigest`；`handleSendAIMessage` 的技能预检与双变量解耦；`SKILL_TIER_TITLES` / `skillTierTitle` / `removeSkillFailureBubbles` / `renderAISkillPill` / `renderSkillContentBox` / `buildResendPayload` / `pullAiSkillsSnapshot`；`regenerateMessage` 与 `showAIError` 重试的重发收敛；`skills:changed` 监听 + 启动预热；本地命令 args 改用 `extractArgs`
- `src/styles/main.css` — 四个新令牌（两主题各一份）+ `.ai-skill-pill-badge` / `.ai-skill-content-box` 家族（逐值照抄 `.ai-summary-box`，仅 `max-width: 100%` 与 `margin: 4px 0 0` 两处覆盖）
- `src/index.html` — `skill-picker-model.js` 接线（在 `renderer.js` 之前）
- `tests/test-ai-skills.js` — D 组（实时读盘 / 组装顺序 / 错误码 / 八例重载还原 / args 还原打表 / 投影与 DISC-07）+ E 组（面板入口 / 通道护栏 / D-18 措辞）+ F 组（调用路径源码扫描）

## Decisions Made

1. **`parseSkillRef` 裸名分支的歧义护栏**：token 以某个本地命令名**开头**但不成立严格边界（`/foobar` 对 `foo`、`/clearx` 对 `clear`）→ 返回 `null`。计划的两条 behavior 行（`/foobar` → `null` 与 `/Skill:foo` → 按裸名处理）只在「本地命令名的**前缀**也占位」这一规则下才同时成立；同时它把「本地命令优先」自然延伸为「命令名占位」，且与 UI-SPEC 的裸名 not-found 文案衔接。
2. **两条 not-found 文案的区分**：`/skill:xxx` 未命中 → 「未找到技能「xxx」」；裸 `/xxx` 未命中 → 「未知命令 /xxx」，按 UI-SPEC §Copywriting 的区分实现（计划 Task 3 ② 只给了前一条文案）。
3. **流式中调用技能必须复位流式状态**：`abortAIIfStreaming()` 之后就地清 `state.aiStreaming` / `aiCurrentMessageId` 并切回发送按钮 —— 取消事件是异步广播的，不复位则紧随其后的流式守卫会静默丢弃本次技能调用（D-08 的位置约束本意正是防这个）。
4. **气泡渲染抽函数**：`renderAISkillPill` / `renderSkillContentBox` 独立成模块级函数，「技能分支零 `innerHTML`」可被直接断言，且与既有附件徽标的 `innerHTML` 段分离（T-48-03 的缓解面更精确）。
5. **CSS 范围自律**：本计划只落四个令牌与气泡侧两类（`--skill-source-*` 供 48-02/48-03 消费），面板行的 `.slash-picker-*` 新类留给 48-02，不在本计划抢跑。
6. **`--skill-limit-text` / 三档来源令牌一次写进两个主题块**：缺浅色主题会静默失效（UI-SPEC §Color）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 流式中触发技能调用会被静默丢弃**
- **Found during:** Task 3（renderer 调用路径接线）
- **Issue:** 计划要求技能预检位于 `if (state.aiStreaming) return;` 之前并在命中时 `await abortAIIfStreaming()`；但 abort 后的取消事件是**异步**广播的，`state.aiStreaming` 在守卫处仍为 `true` → 本次技能调用被静默丢弃，正是 D-08 位置约束想避免的现象。
- **Fix:** abort 之后就地复位 `state.aiStreaming = false` / `state.aiCurrentMessageId = null` / `updateSendButtonState(false)`（取消事件稍后到达时因 `aiCurrentMessageId` 已为 null 而自然成为 no-op）。
- **Files modified:** `src/renderer.js`
- **Verification:** `tests/test-ai-skills.js#F 组`（预检位于守卫之前）；`tests/test-skill-picker-model.js#C 组`（预检分支形态）。运行时行为留 UAT（D9）。
- **Committed in:** `764f59b`（Task 3 GREEN）

### 规格歧义裁决（非 bug，按计划内文本张力取最自洽读法）

**2. `parseSkillRef('/foobar', ['foo']) → null` 的实现方式**
- **Found during:** Task 1（tracer）
- **Issue:** 计划 `<behavior>` 同时要求 `/foobar`（对 `foo`）→ `null` 与 `/foo a b` → `{kind:'skill'}`；但签名只收 `commandNames`（不含技能名），两条无法在「裸名一律返回 skill ref」的实现下共存。
- **Fix:** 裸名分支加「本地命令名**前缀**占位」护栏：token 以某命令名开头但不是严格边界命中 → `null`（歧义交给未知命令路径）。四条 behavior 行因此全部成立。
- **Files modified:** `src/skill-picker-model.js`、`src/renderer.js`
- **Verification:** `tests/test-skill-picker-model.js#A 组 · parseSkillRef —— 边界反例`（`/foobar` `/foo-bar` `/clearx` `/compact-helper` 四例）
- **Committed in:** `a8a070f`（Task 1 GREEN）、`764f59b`（Task 3 消费侧）

**3. 计划 Task 3 ⑧ 的「④ 断言返回 `''`」与 acceptance_criteria 冲突**
- **Found during:** Task 3
- **Issue:** `<action>` 写「对 ④ 与 ⑤b/⑤c/⑤d 逐一断言返回 `''`」，但 ④ 的 args（`第一段\n\n第二段`）非空，acceptance_criteria 明确要求「逐字符还原」。
- **Fix:** 按 acceptance_criteria 实现与断言：④ 还原真 args、⑤a–⑤d 恒为 `''`；并把 STATE.md 已披露的窄洞（纯 `prompt()` 路径下 args 尾段恰为 `'\n\n' + '/skill:alpha'` → 返回 `''`）写成**显式断言**，作为该口径的可失败证据。
- **Files modified:** `tests/test-ai-skills.js`、`tests/test-skill-picker-model.js`
- **Verification:** `tests/test-ai-skills.js#D 组 · resolveSkillBubbleArgs 打表（args 还原唯一规则）`
- **Committed in:** `a8a070f`、`764f59b`

**4. renderer 侧源码护栏的落点分配**
- **Found during:** Task 3
- **Issue:** 计划把 renderer 半边护栏分散写在 Task 3 的 ⑧（两文件）与 ⑨ 中，未给单一落点。
- **Fix:** C 组（预检形态 / 往返表 / 重发唯一实现 / 自激护栏 / 限额与单一权威）落在 `tests/test-skill-picker-model.js`；F 组（预检位置 / state 字段 / 重发调用点与响应消费 / 折叠块 N 口径）落在 `tests/test-ai-skills.js`。无断言遗漏、无重复。
- **Files modified:** `tests/test-skill-picker-model.js`、`tests/test-ai-skills.js`
- **Verification:** 两文件合计 156 例全绿
- **Committed in:** `764f59b`、`78266f4`

---

**Total deviations:** 1 auto-fixed（Rule 1）+ 3 规格歧义/落点裁决（无功能回退）
**Impact on plan:** 唯一的 bug 修正是 D-08 约束得以真正生效的前提；三项裁决均只收敛实现口径、不改变任何交付语义与验收判据。无 scope creep。

## Issues Encountered

- **`tests/test-builtin-skills-seeder.js` 的一条既有断言在本环境必然失败**（`NODE_TEST_CONTEXT=child-v8` 被子进程继承，嵌套 `node --test` 的 stdout 长度为 0 → TAP 解析失败）。已用最小复现确认与本次改动无关（该用例只读 AGENTS.md 并 spawn `tests/test-ai-bash-policy.js`），记入 `.planning/phases/48-skill-name/deferred-items.md`（D-48-A），未在本阶段修复（scope boundary）。
- **计划中两处 `*/` 字面量落在块注释里**导致语法错误（`value.slice(1 + cmd.name.length).replace(/^\S*/, '')` 的写法），改写为文字描述规避；不影响断言语义。

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_ipc_channel | ipc-handlers.js | 新增两个无载荷 invoke 通道 `ai:get-skills` / `ai:refresh-skills`（均在 T-48-05 的缓解范围内：`assertTrustedSender` + `aiManager` 判空 + 收窄投影零正文） |

## Known Stubs

None —— 本计划未引入任何硬编码空值、占位文案或未接线的数据源；`--skill-source-*` 令牌已在两个主题块就位（其唯一消费者在 48-02/48-03）。

## Next Phase Readiness

- 48-02（`/` 面板并入技能列表）可直接消费：`realmAPI.ai.getSkills()` / `refreshSkills()`、`state.aiSkills` / `aiSkillsDigest`、`skills:changed` 监听与启动预热、`SKILL_PREFIX` / `extractArgs` / `parseSkillRef` / `buildSkillSyntaxText`、四个颜色令牌。
- 48-03（`read` 卡片技能化）可直接消费：`aiSkills.matchSkillByPath`、`getConversationMessages` 的装饰落点（`_decorateSkillUserMessage` 与 `_skillTierByLocation` 各一处实现）。
- P8 门禁口径提示：本计划只闭合**读侧**调用方（`refreshSkillsForPanel` → `syncAgentSystemPrompt`）；「写成功后回写」仍归 49/50/51，`STATE.md:222` 的 ⚠️ 不因 48 闭合。
- 待 UAT 的人工面（D9）：真实 Electron 环境下的气泡视觉与 IPC 往返链路。

---
*Phase: 48-skill-name*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: src/skill-picker-model.js
- FOUND: tests/test-skill-picker-model.js
- FOUND: .planning/phases/48-skill-name/48-01-SUMMARY.md
- FOUND: .planning/phases/48-skill-name/deferred-items.md
- FOUND: 90a6a44（Task 1 RED）
- FOUND: a8a070f（Task 1 GREEN）
- FOUND: 303f5d1（Task 2）
- FOUND: 7640ff7（Task 3 RED）
- FOUND: 764f59b（Task 3 GREEN）
- FOUND: 78266f4（护栏补强）
- Plan verification: `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js` → `# pass 155 / # fail 0`；channels-ok / preload-ok / listener-ok / css-ok / script-order-ok 全通过
- 全仓回归：19 个测试文件 533 例 `# fail 0`（`test-builtin-skills-seeder.js` 的 1 条既有环境断言除外，见 deferred-items.md D-48-A）

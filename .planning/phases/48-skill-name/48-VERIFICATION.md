---
phase: 48-skill-name
verified: 2026-09-12T06:50:49Z
status: human_needed
score: 24/28 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/48-skill-name/48-01-PLAN.md", ".planning/phases/48-skill-name/48-01-SUMMARY.md", ".planning/phases/48-skill-name/48-02-PLAN.md", ".planning/phases/48-skill-name/48-02-SUMMARY.md", ".planning/phases/48-skill-name/48-03-PLAN.md", ".planning/phases/48-skill-name/48-03-SUMMARY.md", "AGENTS.md", "ai-manager.js", "ai-skills-manager.js", "docs/product/ai-skills.md", "ipc-handlers.js", "src/index.html", "src/preload.js", "src/renderer.js", "src/skill-picker-model.js", "src/styles/main.css", "tests/test-ai-skills.js", "tests/test-skill-picker-model.js"]
covered_digest: "v1:sha256:89d5083caf88799243dbd3bfe1d860744e7b7992c33f56bb71967cb223b58d7a"
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "DISC-05：模型仅凭 description 自动匹配技能并 read 其正文（用户不显式调用也能生效）"
    test: "在运行中的应用里提一个命中某技能 description 的任务（不手打 `/skill:`），观察模型是否自行 read 该技能的 SKILL.md"
    expected: "模型自发调用 read 读取技能目录下的 SKILL.md，工具卡片标题显示「使用技能「name」」"
    why_human: "模型侧行为依赖真实 LLM 推理，node:test 只能断言「description 已进 system prompt」「read 事件带 skill_invocation」「卡片按标记渲染」三个机制面，无法断言模型是否会匹配"
  - truth: "48-02 backstop：50+ 技能数据集下 220px 面板的分组标题 sticky 常驻、行五要素可读、行尾标注无一截断"
    test: "按 48-VALIDATION.md §Manual-Only Verifications 的脚本向 skills/ 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区"
    expected: "分组标题 sticky 常驻；行五要素可读；行尾标注 flex-wrap 后无一截断"
    why_human: "纯视觉观感（sticky 常驻、换行行高、徽标对比度）无法由源码扫描或 node:test 裁决"
  - truth: "真实 Electron 端到端：手打 `/skill:name` 后气泡显示「技能」微标 + args 正文 + 默认折叠的技能正文块；未找到 / 已禁用走两条 system-note；流式回复中调用技能不被丢弃"
    test: "`npm run dev` → 输入 `/skill:<真实技能名> 参数` 回车；再输入 `/skill:<不存在>`；再在 AI 回复流式进行中点面板技能行"
    expected: "命中时气泡 = 技能 pill + args 正文 + 可展开「技能正文（N 字符）」块；两条失败走各自 system-note 且零气泡；流式中调用能正常发出并流式回显（不出现新气泡被标「用户已取消」且流被丢弃）"
    why_human: "IPC 往返 + 主进程实时读盘 + 流式事件时序属运行时行为；node:test 只覆盖源码契约与纯函数。第三项另有 48-REVIEW.md CR-03 记录的时序洞，须实测裁决"
human_verification:
  - test: "{阶段门槛} 进入 Phase 49 前裁决 48-REVIEW.md CR-01：面板行的 `title` 属性用 escapeHtml 转义（不转义引号），磁盘来源的技能名可闭合 `title` 属性并注入新属性/事件处理器"
    expected: "决定「Phase 49 开工前修复」或「登记为技术债延后」——Phase 49 的 manage_skill 会让 AI 直接创建技能目录，使该注入路径从「需人工操作」变为「常规可达」"
    why_human: "must_have 的禁止项（「全部插值经 escapeHtml()」）在字面上成立，但威胁模型 T-48-07（high）声称的缓解在属性上下文不成立；证据已复现（见 Warnings），按用户既有口径（Critical 记入 REVIEW.md 作技术债、UAT 为准）需人工决策修复时机"
  - test: "{阶段门槛} 裁决 48-REVIEW.md CR-02：`frontmatter name ≠ 目录名` 的技能在面板上以目录名列出、文档 §10.4 标「能显式调用」，实际 `readSkillForInvocation` 恒返回 not_found"
    expected: "决定「按 CR-02 的路径判据修复 + 补一条 name≠目录名 用例」或「登记为技术债」；若不改，须同时修正 docs/product/ai-skills.md §10.4 的表述以免产品说明与实现分叉"
    why_human: "该行为是 48-01 PLAN 明确要求（`fresh.name !== name` → not_found，防冒名注入），非执行器偏离；执行器实现与计划一致，改判据属改设计，需人工裁决"
  - test: "{阶段门槛} 裁决 48-REVIEW.md CR-04：renderer 预检用 `state.aiSkills` 快照否决调用，而该快照在面板关闭时不更新（`skills:changed` 早退 → 发送时快照可能陈旧）"
    expected: "决定「移除本地否决、改由主进程 skillError 走既有回滚（D-13 推论）」或「让任何 skills:changed 都重拉快照」；现状下「运行期新增技能 + 从未打开过 `/` 面板」会得到「未找到技能」且输入框被清空，与「调用瞬间实时读盘」的用户硬约束（2026-09-11）张力"
    why_human: "该预检是 48-01 Task 3 ② / 48-02 明文的计划要求（本地命令优先 + 技能预检），是否放宽需人工裁决；同时它决定了 Phase 49（AI 自建技能）后该窗口是否成为常规路径"
  - test: "真实环境验证 CR-03 的时序：AI 正在流式回复时，点面板技能行（或手打 `/skill:name`）"
    expected: "新技能调用正常发出、新气泡流式回显；不得出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示"
    why_human: "abort × 新消息的取消归属是运行时竞态（`state.aiCancelledByUser` 在 abort 后不复位、错误事件按 `state.aiCurrentMessageId` 归属），无测试覆盖；须实机复现确认"
  - test: "安全回归：在 skills/ 下建一个目录名含 `\"` 或无空格的技能（如 `pwn\" data-x=\"y`），打开 `/` 面板把鼠标划过该行"
    expected: "面板行不产生新属性 / 不执行注入（当前实现会产出 `title=\"/skill:pwn\" data-x=\"y 可显式调用\"`）"
    why_human: "需在真实 DOM 中观察生成的行结构与属性；已用纯 Node 探针复现属性逃逸片段（见 Warnings）"
---

# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`）Verification Report

**Phase Goal:** 用户可在聊天输入框用 `/` 发现技能、以 `/skill:name` 调用；模型也能按 description 自动匹配技能并读取其正文。
**Verified:** 2026-09-12T06:50:49Z（14:50 +08:00）
**Status:** human_needed
**Re-verification:** No — initial verification（本阶段此前只有 48-VALIDATION.md / 48-REVIEW.md，无 VERIFICATION.md）

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| T1 | SC1 / DISC-01：输入 `/` 后面板同屏列出已启用技能与两条本地命令（技能分区在上），name 前缀档在前 + description 子串档在后，`/skill:<q>` 按前缀长度剥离 | ✓ VERIFIED | `src/skill-picker-model.js` 的 `filterPickerItems`/`buildPickerItems`；`tests/test-skill-picker-model.js` B 组 42 例全绿（实跑 `# pass 222 / # fail 0`）；`renderSlashPickerList` 实读（`rawFilter` → `buildPickerItems`） |
| T2 | SC1：`state.slashPickerItems` 是展平单数组且数组顺序 === 视觉顺序；分组标题不占索引；点击 / hover 按扁平索引（`data-index`）直绑 | ✓ VERIFIED | `renderSlashPickerList` 实读：标题 `<div class="slash-picker-group-header">` 不带 `data-index`，行 `data-index="${index}"`，处理器取 `Number(row.dataset.index)`；B 组接线断言 |
| T3 | D-03：命令分区语义与相对顺序零变化（原 token `startsWith`） | ✓ VERIFIED | B 组「命令分区对照」对同一 `rawFilter` 与 `SLASH_COMMANDS.filter(c => c.name.startsWith(rawFilter))` 做 `deepStrictEqual`；`SLASH_COMMANDS` 字面量仍为 `clear`/`compact` 两项 |
| T4 | DISC-02：`/skill:name [args]` 与裸 `/name [args]` 一致解析（本地命令优先、严格前缀 + 空白边界、`^[a-z0-9-]+$`） | ✓ VERIFIED | A 组 32 例（含 `/foobar` `/foo-bar` `/skill:` `/skill:Foo` `/Skill:foo` 反例）；`parseSkillInvocationText` 与 `parseSkillRef` 跨进程一致性断言 |
| T5 | DISC-02：技能正文在**调用那一刻**从磁盘读取；空串 / 仅空白 / 目录被换 / 文件被删 → `not_found`（绝不产字面量 `undefined`） | ✓ VERIFIED | `ai-skills-manager.readSkillForInvocation:791-813` 实读（每次调用 `import('@earendil-works/pi-agent-core')` + `loadSkills(env, dirname)` 重读盘）；D 组「实时读盘」改盘后二次调用读到新正文；独立探针确认同名命中返回 `ok`、冒名目录返回 `not_found` |
| T6 | DISC-02：`<skill>` 块逐字节 === `formatSkillInvocation(skill, provenance + '\n\n' + args)` | ✓ VERIFIED | D 组用**真实 SDK** `formatSkillInvocation` 构造期望值，三例（含空 args、含空行 args）全等 |
| T7 | D-07：拼接顺序 `[skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]`；无技能调用时输出与改动前逐字符相同 | ✓ VERIFIED | `ai-manager.js:1290` 实读数组字面量与计划逐字一致；D 组「无技能调用时增强消息与改动前逐字符相同」行为断言 + 相对次序源码断言 |
| T8 | DISC-03：`_ensureConversation(message)` 保持原始语法文本（对话标题不退化），注入只发生在 `agent.prompt` | ✓ VERIFIED | `ai-manager.js:1060` 为 `this._ensureConversation(message)`；`this._ensureConversation(enhanced` 命中 0；`_deriveConversationTitle('/skill:find-skills')` 打表 |
| T9 | D-06 / UI-SPEC：user 气泡 `content` = args 原文；重开对话由 `getConversationMessages` 还原为同形 `{content: args, skillInvocation:{name,tier,content}}`（含 `@` 引用 / 附件 / args 含空行 / **空 args 四形态**） | ✓ VERIFIED | D 组「重载装饰（八例）」+「resolveSkillBubbleArgs 打表」；`ai-manager.js:6187+` 两趟扫描规则实读；live 路径与重载路径 content 逐字符相等的可失败等式 |
| T10 | DISC-06：技能不存在 / 已禁用 → 结构化 `skillError`（`skill_not_found` / `skill_disabled` 两码两文案，无第三码），主进程不调用 `agent.prompt`；renderer 预检两条 system-note + 响应失败回滚 | ✓ VERIFIED | D 组 `skillErrorFromReason` 打表 + 返回值域断言；`ipc-handlers.js:1678-1731` 返回体 `{success, conversationId, skillInvocation, skillError}`；F/C 组预检与回滚源码断言 |
| T11 | DISC-07：`disableModelInvocation` 的技能不进 system prompt、仍可经 `/skill:` 显式调用、与 `disabled` 互不蕴含（同时为真禁用面胜出）、永不 `promptOmitted` | ✓ VERIFIED | D 组「投影收窄 / tier 三档 / promptOmitted / DISC-07」三条子句各一条可失败断言 + flag 独立性一例 |
| T12 | DISC-04：`getSkillsForUI` 收窄投影（**不含** `content`/`filePath`/`diagnostics`）+ 三档 `tier` 由主进程唯一计算 + `promptOmitted` 只打在预算丢弃的 eligible 条目 | ✓ VERIFIED | `ai-skills-manager.js` `toUISkillEntry`/`sourceTierOf`/`getSkillsForUI` 实读；D 组三条 `assert.ok(!(k in entry))` + `eligible.slice(kept.length)` 打标断言 |
| T13 | DISC-04：行五要素（`/{name}` + 三档来源徽标 + `仅显式` + 单行截断描述 + 行尾标注）；禁用不渲染；`shadowed` / 与本地命令同名 → 灰显不可选中 + 对应标注；超限可选中带标注 | ✓ VERIFIED | B 组 selectable 判定三例 + 状态标注优先级 + `TIER_BADGE` 唯一权威表；`renderSlashPickerList` 实读五要素顺序与 `SLASH_STATUS_TONE_CLASS` 白名单查表 |
| T14 | DISC-01：↑↓ 只在可选中集合上取模并跳过灰显行；全部不可选中 → `activeIndex = -1`，Enter 回落既有 `executeActiveSlashCommand() === false` 路径 | ✓ VERIFIED | B 组导航取模 8 例（含空集合、`current` 不在集合内、长度 1 自指）；`handleAIInputKeydown` 实读消费 `state.slashPickerSelectable` + `nextSelectableIndex` |
| T15 | D-17 / P-48-06：面板 stale-while-revalidate（快照即时渲染 → 后台 `refreshSkills` → 广播只重拉 + digest 早退）；无 loading 态；失败保留旧快照；renderer `refreshSkills` 调用点唯一 | ✓ VERIFIED | G 组 5 例 + C 组自激护栏；独立探针：广播窗口 420 字符内 `refreshSkills` 命中 0、含 `if (!state.slashPickerOpen)` 早退、`openSlashPicker` 含 `ai.refreshSkills` + `catch` |
| T16 | D-19 / D-06：两条重发路径（`regenerateMessage` / `showAIError` 重试）经 `buildResendPayload`（唯一实现）由 args + name 重组完整语法文本；空 args 时载荷非空、不静默不动作；响应 `skillError`/`skillInvocation` 均被消费 | ✓ VERIFIED | `function buildResendPayload(` 命中数 = 1；C 组 `buildSkillSyntaxText` 往返表（含空 args 与含空行 args）；F 组两处 `await ... ai.prompt(payload)` 源码断言 |
| T17 | DISC-05：`read` 打开技能目录 `SKILL.md` → `tool_execution_start` 带 `skill_invocation = {name,tier}`；非 `read` / 缺 `path` / `path` 非字符串 / basename ≠ `SKILL.md` / 工作区外 / 无 `sandboxEnv` → `null` 且不抛错 | ✓ VERIFIED | H 组四类路径 + 四条负例；`ai-manager.js:1693` 实读 `skill_invocation: this._resolveSkillMarker(...)`，`params: event.args` 逐字未变 |
| T18 | DISC-05：renderer 把事件字段落到 `toolExecution.skillInvocation`；`renderToolCard` 技能变体标题「使用技能「name」」+ `TIER_BADGE` 白名单徽标、全 `textContent`；判定只在主进程（renderer 零路径匹配）；重载链路同一实现、形状逐字相等；技能删除 → 静默不挂键、不丢消息 | ✓ VERIFIED | `src/renderer.js:9294` 实读 `skillInvocation: event.skill_invocation`；`renderToolCard` 实读（`使用技能「`、`tool-card-name-skill`、`TIER_BADGE`、`textContent`，函数体内 `managed-skills`/`SKILL.md` 命中 0）；`getConversationMessages` 实读复用 `_resolveSkillMarker` 且同体无 `matchSkillByPath(`；I 组键集合逐字相等 / 不挂键 / 容错不丢消息 |
| T19 | DISC-05：模型**仅凭 description 自动匹配**技能（用户不显式调用也能生效） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 机制三面均有断言（description 进 prompt、事件带标记、卡片渲染），但「模型是否会自发匹配」无任何测试执行 → 见 Human Verification（须真实 LLM 运行） |
| T20 | 48-02 backstop：50+ 技能下 220px 面板观感（sticky 常驻 / 五要素可读 / 标注不截断） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 结构面齐备（`.slash-picker-group-header` sticky + 显式背景、`.slash-picker-row` `flex-wrap`、`.slash-picker-status` nowrap、`max-height: 220px` 零改动），但视觉观感不可自动化裁决 |
| T21 | 真实 Electron 端到端：气泡 pill + 折叠块 / 两条 system-note / 流式中调用技能不被丢弃 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码与静态断言齐备（`renderAISkillPill`/`renderSkillContentBox`、`removeSkillFailureBubbles`、预检位于 `if (state.aiStreaming) return;` 之前），运行时链路与流式时序无测试覆盖；另见 CR-03 |
| T22 | 禁止项：本阶段**零新增技能写路径** | ✓ VERIFIED | `git diff 23e5144e^..HEAD -- ai-skills-manager.js` 的新增函数只有 `sourceTierOf`/`toUISkillEntry`/`matchSkillByPath`/`getSkillsForUI`/`readSkillForInvocation` 五个只读函数；无创建 / 修改 / 删除入口 |
| T23 | 禁止项：技能条目不得并入 `SLASH_COMMANDS` | ✓ VERIFIED | 数组字面量项数断言为 2（`clear`/`compact`），无 `SLASH_COMMANDS.push` |
| T24 | 禁止项：renderer 不重算技能集状态（优先级 / 遮蔽 / 限额 / 预算省略 / 档位只消费投影） | ✓ VERIFIED | 限额字面量（`64 * 1024` / `65536` / `8000` / `MAX_USER_SKILLS`）在 `renderer.js`/`preload.js`/`ipc-handlers.js` 命中数均为 0；`localeCompare` 命中 0；`/api/skills` 命中 0 |
| T25 | 禁止项（48-01）：不得以 prompt 冻结快照或历史旧正文替代调用瞬间的实时读盘 | ⚠️ UNCERTAIN (WARNING) | 主进程侧成立（T5 已证）；但 renderer 预检据 `state.aiSkills`（面板关闭时不更新的快照）**否决**调用，使「运行期新增技能 + 从未打开过面板」在到达实时读盘前即被判「未找到技能」并清空输入框 → 见 CR-04 与 Human Verification |
| T26 | 禁止项（48-02）：面板 `innerHTML` 模板内插入的 `name`/`description`/行尾标注/`title` **全部**经 `escapeHtml()`；tier → class 走白名单查表 | ⚠️ UNCERTAIN (WARNING) | 字面要求成立（源码实读逐条插值均在 `escapeHtml(...)` 内；tier/statusTone 走冻结表）；但 `escapeHtml` 为 `textContent → innerHTML`，**不转义 `"`**，属性上下文可逃逸 —— 已复现（CR-01）→ 见 Warnings 与 Human Verification |
| T27 | 禁止项（48-03）：技能化不额外插 system-note、不改 `.tool-card` 既有规则、不新增卡片形状；存储层无技能域知识 | ✓ VERIFIED | H 组四条既有规则体内零命中新类/文案；`ai-conversations-manager.js` 内 `skillInvocation` 命中 0；`_resolveSkillMarker` 失败一律 `null`（零回归契约） |
| T28 | 48-03：`docs/product/ai-skills.md` §10「发现与调用」+ §六 三条已知限制 + §七 测试命令；`AGENTS.md` 测试清单与维护约定 | ✓ VERIFIED | §10 存在（13 关键词全部命中、deferred 能力正则 0 命中、表格行数 15）；§七 既有三条命令逐字保留 + 新增 `node --test tests/test-skill-picker-model.js`；`AGENTS.md` 追加测试行 + 「技能发现与调用的维护约定」，既有条目（`21 例`/`97 例`/`test-unified-navigation`）逐字未变 |

**Score:** 24/28 truths verified（3 present, behavior-unverified；1 UNCERTAIN 待人工决策）
**Prohibitions:** 4 judgment-tier prohibitions 逐条核对 — 3 条 VERIFIED（T22/T23/T24 + T27），1 条字面 VERIFIED 但缓解无效（T26，已复现，按 flagged-unverified 路由人工），1 条 UNCERTAIN（T25）。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/skill-picker-model.js` | 双模式导出纯逻辑模型（解析 / args / 反向语法 / 面板四函数 / `TIER_BADGE`） | ✓ VERIFIED | 新建 358 行；`require()` 与 `window.SkillPickerModel` 同引用（同一 `api` 对象）；无 import 依赖 |
| `tests/test-skill-picker-model.js` | 面板与解析纯逻辑断言宿主 | ✓ VERIFIED | 新建 1139 行；`node --test` 全绿 |
| `ai-skills-manager.js` | `readSkillForInvocation` / `sourceTierOf` / `toUISkillEntry` / `matchSkillByPath` / `getSkillsForUI` + `promptOmitted` | ✓ VERIFIED | 实读，五函数均在导出面；`promptOmitted` 打标在 ⑦ 尾部 |
| `ai-manager.js` | 解析 / 组装 / 返回契约 / 重载装饰 / `_resolveSkillMarker` / D-18 措辞 | ✓ VERIFIED | 实读全部落点（`:1060`、`:1081`、`:1290`、`:1423-1446`、`:1693`、`getConversationMessages`） |
| `ipc-handlers.js` | 两个新通道 + 两个既有通道返回体扩展 | ✓ VERIFIED | `ai:get-skills:1747` / `ai:refresh-skills:1763` 均 `assertTrustedSender(event)` + `aiManager` 判空；`ai:prompt*` 返回 `skillInvocation`/`skillError` |
| `src/preload.js` | `realmAPI.ai.getSkills` / `refreshSkills` 成对暴露 | ✓ VERIFIED | `:1033` / `:1040` |
| `src/renderer.js` | 预检 / 气泡 / 折叠块 / 面板重写 / 导航 / 刷新 / 卡片变体 / 重发收敛 | ✓ VERIFIED | 逐点实读；+580 行 |
| `src/styles/main.css` | 四个令牌（两主题块）+ 技能相关新类 | ✓ VERIFIED | 令牌声明数 5/5/5/3（两主题块 + 消费点）；八类全部存在；`max-height: 220px` 零改动 |
| `src/index.html` | `skill-picker-model.js` 先于 `renderer.js` + `?v=` 序号推进 | ✓ VERIFIED | `:1021` 脚本行在 `renderer.js` 之前；`:11` 为 `styles/main.css?v=8`（48-02 → 7、48-03 → 8） |
| `tests/test-ai-skills.js` | D/E/F/G/H/I 六组新断言 | ✓ VERIFIED | 1213 行新增；实跑全绿 |
| `docs/product/ai-skills.md` | §10 + §六 三条 + §七 一条 | ✓ VERIFIED | 关键词 / 行数 / 负向正则全部通过 |
| `AGENTS.md` | 测试清单 + 维护约定 | ✓ VERIFIED | 见 T28 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `handleSendAIMessage` 斜杠分支 | `realmAPI.ai.prompt` / `promptWithContext`（完整语法文本）→ `_resolveSkillInvocation` → `readSkillForInvocation` | IPC → 主进程解析 → 实时读盘 | ✓ WIRED | 三处逐段实读；预检局部量 `skillRef` 与 IPC 载荷 `text` 显式分离 |
| `ai-manager.getSkillsForUI()` | `getSeededSkillNamesSafe()` → `getSkillsForUI(seededNames)` → `ai:get-skills` → `realmAPI.ai.getSkills` | 收窄投影过 IPC | ✓ WIRED | 惰性 require + try/catch 降级；通道断言通过 |
| `refreshSkillsForPanel()` | `syncAgentSystemPrompt()`（函数体未改）→ `windowManager.broadcast('skills:changed')` → renderer 只重拉快照 | 读侧 P8 调用方 | ✓ WIRED | `P8 失效链机制断言` 五条既有断言继续绿；广播处理器无 `refreshSkills` |
| `getConversationMessages()` | `_decorateSkillUserMessage`（user 行）+ `_resolveSkillMarker`（assistant 行） | 装饰层重建 | ✓ WIRED | 方法体内无直接 `matchSkillByPath(`，符合「一处实现两处调用」护栏 |
| `_setupEventBroadcasting` 的 `tool_execution_start` | `skill_invocation` → renderer `toolExecution.skillInvocation` → `renderToolCard` 技能变体 | 事件字段链 | ✓ WIRED | `ai-manager.js:1693` + `src/renderer.js:9294` 逐行核对；`renderToolCards` 在流式映射同处调用 |
| `regenerateMessage` / `showAIError` 重试 | `buildResendPayload` → `window.SkillPickerModel.buildSkillSyntaxText` → `ai.prompt` | 唯一反向实现 | ✓ WIRED | `buildResendPayload` 定义命中数 = 1；两处 `await` + `payload` 实参 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 面板技能行 | `state.slashPickerItems` | `window.SkillPickerModel.buildPickerItems(state.aiSkills, SLASH_COMMANDS, rawFilter)` ← `realmAPI.ai.getSkills()` ← `ai-skills-manager._cache.skills`（SDK 扫盘） | Yes | ✓ FLOWING |
| 气泡技能正文折叠块 | `msg.skillInvocation.content` | 调用响应回传的 `readSkillForInvocation` 实时读盘结果（块体） | Yes（探针确认读盘返回值随磁盘变化） | ✓ FLOWING |
| 气泡正文 | `msg.content`（args） | `parseSkillRef(text).args`（renderer）/ `resolveSkillBubbleArgs`（重载） | Yes | ✓ FLOWING |
| 工具卡片标题 | `toolExecution.skillInvocation` | `_resolveSkillMarker` ← `matchSkillByPath` ← `_cache.skills[i].filePath` | Yes | ✓ FLOWING |
| 对话标题 | `_ensureConversation(message)` | 完整语法文本（原始用户输入） | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 面板与解析纯逻辑 + 调用路径断言 | `node --test tests/test-skill-picker-model.js tests/test-ai-skills.js` | `# tests 222 / # pass 222 / # fail 0` | ✓ PASS |
| 5 文件 gate（回归地板 ≥183） | `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-ai-conversations.js` | `# tests 341 / # pass 341 / # fail 0` | ✓ PASS |
| seeder 直跑（gate 口径，地板 ≥101） | `node tests/test-builtin-skills-seeder.js` | `# tests 101 / # pass 101 / # fail 0` | ✓ PASS |
| 脚本接线顺序 | 源码断言 `skill-picker-model.js` 先于 `renderer.js` | `script-order-ok` | ✓ PASS |
| preload 成对方法 / 两通道 `assertTrustedSender` | 源码断言 | `preload-ok`；两通道均为 true | ✓ PASS |
| 广播无自激 + 面板关闭早退 | 源码窗口断言 | 早退 true；窗口内 `refreshSkills` false | ✓ PASS |
| 导航 / 重发唯一实现 / CSS 类与令牌 | 源码断言 | `nav uses selectable: true`；`buildResendPayload count: 1`；八类齐备、令牌双主题块 | ✓ PASS |
| 跨文件护栏（限额 / `localeCompare` / 本地 HTTP 端点） | 三文件正则 | 全 0 | ✓ PASS |
| `readSkillForInvocation` 同名可调用 / 冒名目录被拒（独立探针 `/tmp/v48-probe.js`） | 临时 workspace + 真实 `createSandboxEnv` + `refreshSkills` | `normal => ok`；`evil`（frontmatter name=`find-skills`）`=> ERR:not_found` | ✓ PASS（并复现 CR-02，见 Warnings） |
| 属性逃逸复现（同一探针） | 复刻 renderer `escapeHtml` 语义 + 真实磁盘目录名 `pwn" data-x="y` | 产出 ` title="/skill:pwn" data-x="y 可显式调用"` | ✓ PASS（复现 CR-01，见 Warnings） |
| 预注册红项是否环境性 | `node --test tests/test-builtin-skills-seeder.js` vs `NODE_TEST_CONTEXT=child-v8 node --test tests/test-ai-bash-policy.js` | 嵌套跑 `# fail 1`（`:2200` DOC-02）；`NODE_TEST_CONTEXT=child-v8` 下 stdout 为 **0 字节**（TAP 摘要消失） | ✓ PASS（确认 D-48-A 为既有环境问题，非本阶段引入） |

### Probe Execution

未声明探针，且本阶段非迁移 / CLI 阶段：`find . -name 'probe-*.sh'`（排除 `node_modules`）无命中，PLAN/SUMMARY 内无 `probe-*.sh` 声明 → **Step 7c: SKIPPED（no probes declared）**。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DISC-01 | 48-02 | `/` 面板列出全部已启用技能与既有本地命令、可按名称实时过滤 | ✓ SATISFIED | T1/T2/T3/T13/T14；B 组 42 例 |
| DISC-02 | 48-01 | 选择技能以 `/skill:name [args]` 调用，正文经 `formatSkillInvocation` 作 `<skill>` 块注入 | ✓ SATISFIED | T4/T5/T6/T7 |
| DISC-03 | 48-01 | 技能调用进入对话历史并触发 LLM（与本地 `clear`/`compact` 区分，第二命令源） | ✓ SATISFIED（"触发 LLM 回复" 的实机面归 UAT） | T8/T9/T16；`agent.prompt(enhanced)` 源码断言 + `_ensureConversation` 不变 |
| DISC-04 | 48-01, 48-02 | 技能列表区分来源（user/managed/seeded）并以徽标展示；被遮蔽的同名技能可见 | ✓ SATISFIED | T12/T13 |
| DISC-05 | 48-03 | 模型可按 description 自动匹配技能并 `read` 其正文 | ✓ SATISFIED（机制面）/ ⚠️ 模型侧行为待 UAT | T17/T18 机制面全绿；T19 行为待人工 |
| DISC-06 | 48-01 | 调用不存在的技能给出明确错误提示（不出现"点了没反应"） | ✓ SATISFIED | T10 |
| DISC-07 | 48-01, 48-02 | `disable-model-invocation` 不进 system prompt，仍可 `/skill:` 显式调用并在 UI 打标 | ✓ SATISFIED | T11/T13 |

**Orphaned requirements:** 无。`REQUIREMENTS.md:130-136` 映射到 Phase 48 的恰为 DISC-01..07，七个 ID 全部出现在至少一个 PLAN 的 `requirements:` 字段（48-01: DISC-02/03/04/06/07、48-02: DISC-01/04/07、48-03: DISC-05）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/renderer.js` | 10340（同类 10333 / 10344；辅助 `11262-11266`） | 磁盘来源技能名经 `escapeHtml` 拼进 **HTML 属性**（`title="…"`），而 `escapeHtml` = `textContent → innerHTML` 不转义 `"` | 🛑 Blocker（安全，已复现；按用户既有口径记 REVIEW 技术债 + 人工裁决） | 目录名含 `"` 的技能可闭合 `title` 属性并注入新属性 / 事件处理器；主窗口 renderer 持有全量 `realmAPI`。见 CR-01 与 Human Verification |
| 全阶段改动文件 | — | `TBD` / `FIXME` / `XXX` | ℹ️ Info | 无新增未引用债标记；`ai-manager.js:506/543` 两处 `XXX` 为既有工具描述文本（`git diff 23e5144e^..HEAD` 新增行内零命中） |
| 阶段改动文件 | — | 占位 / 空实现（`return null` / `return []` / 「即将推出」） | ℹ️ Info | 未发现；命中的 `placeholder` 均为既有输入框 `placeholder=` 与「空 assistant 占位气泡」变量名 |

### Warnings / Risks（48-REVIEW.md 的 4 条 Critical — 已在 REVIEW.md 记档，此处只做 must_have 影响判定）

> 用户既有口径：代码审查 Critical 记入 REVIEW.md 作技术债、不阻断收尾（UAT 为准）。下列判定据此：**无 must_have 真值 FAILED**，但两项使 must_have 处于 UNCERTAIN（T25/T26），需人工决策。

| # | 影响 | 判定 | 证据（本次独立复核） |
| - | ---- | ---- | -------------------- |
| **CR-01** | T26（48-02 禁止项：面板插值全部经 `escapeHtml`）字面成立、**缓解无效** | ⚠️ WARNING + 人工决策（Escalation Gate） | 独立复现：目录名 `pwn" data-x="y` 被 SDK + `enforceDirNameAuthority` 接受并进投影 → 生成 ` title="/skill:pwn" data-x="y 可显式调用"`；`escapeHtml`（`renderer.js:11262`）不处理 `"`。Phase 49 的 `manage_skill` 会让该路径常规可达 → 建议进入 49 前修复（属性专用转义或改 DOM API + `setAttribute`） |
| **CR-02** | 不违反任何 must_have 真值（48-01 PLAN 明确要求 `fresh.name !== name → not_found` 防冒名）；但使「面板列为可调用、文档标『能显式调用』」的技能实际不可调用 | ⚠️ WARNING + 人工决策 | 独立复现：`skills/evil/SKILL.md` 写 `name: find-skills` → 投影名 `evil`、`readSkillForInvocation('evil')` → `ERR:not_found`；`ai-skills-manager.js:806-811` 实读确认 `find(...)||skills[0]` 的兜底被下一行的 name 全等作废 |
| **CR-03** | T21（真实 Electron 端到端含「流式中调用技能不被丢弃」）行为不可证；另有具体时序洞 | ⚠️ WARNING（行为未验，须实测） | 结构复核成立：`abortAIIfStreaming`（`:9046-9055`）置 `aiCancelledByUser = true` 且不复位；技能路径（`:8736-8740`）只复位 `aiStreaming`/`aiCurrentMessageId`；取消分支（`:9317-9330`）按 `state.aiCurrentMessageId` 归属，而 `ai:abort`（`ipc-handlers.js:1840-1846`）同步返回 → 迟到 error 可能落到新气泡 |
| **CR-04** | T25（48-01 禁止项：不得以快照替代调用瞬间实时读盘）UNCERTAIN | ⚠️ WARNING + 人工决策 | 代码实读：预检据 `state.aiSkills` 否决（`:8719-8732`）；`skills:changed` 在面板关闭时早退（`:4399-4403`）；快照仅启动预热 + 面板打开刷新 → 「运行期新增技能 + 从未开面板」被判「未找到技能」+ 输入框清空，主进程无机会实时读盘 |

**48-REVIEW.md 的 4 条 Warning（WR-01..WR-04）与 3 条 Info（IN-01..IN-03）** 均不触达 must_have（单源文案副本 / `isProcessing` 未复位 / 重发路径空气泡 / SDK 路径归一化未对齐 / `indexOf` 锚点 / preload JSDoc 滞后 / `activeIndex = -1` 不重渲染），按 REVIEW.md 记档，不逐条翻案。

### 既有红项核对（D-48-A，预注册）

- `node --test tests/test-builtin-skills-seeder.js` → `# tests 101 / # pass 100 / # fail 1`，红项确为 `:2200` 的 `DOC-02 文档同步（47-04 Task 2）`（`应能从 node --test 的 TAP 输出解析出 \`# tests\``）。
- **独立确认其为环境性、且非 Phase 48 引入**：① 直跑 `node tests/test-builtin-skills-seeder.js` → `101/0` 全绿；② `tests/test-builtin-skills-seeder.js` **不在** `git diff 23e5144e^..HEAD` 的改动文件内；③ 根因实测 —— `NODE_TEST_CONTEXT=child-v8 node --test tests/test-ai-bash-policy.js` 的 stdout 为 **0 字节**（TAP 摘要被抑制），无该变量时正常输出。
- **Phase 48 对 `AGENTS.md` 的改动未击穿该断言**：diff 只在「`- 测试：`」行**追加**一条并新增一条维护约定，既有条目与数字（`21 例` / `97 例`）逐字未变；直跑 101/0 即为证。

### Deferred Items

无。Step 9b 逐条比对后续阶段（Phase 49 `manage_skill` 写路径 / Phase 50 启停卸载 / Phase 51 导入），上述 CR 项**无一被后续阶段的 goal 或 success criteria 覆盖**（49/51 反而会放大 CR-01 与 CR-04 的可达性），故不作为 deferred 处理。

### Human Verification Required

见 frontmatter `human_verification`（5 项）与 `behavior_unverified_items`（3 项）。摘要：

1. **阶段门槛决策 · CR-01（安全）** — 面板行 `title` 属性逃逸（已复现）。预期：决定「进入 Phase 49 前修复」还是「登记技术债」。
2. **阶段门槛决策 · CR-02** — `name ≠ 目录名` 技能面板可选但恒 not_found。预期：修判据 or 修文档 §10.4 表述。
3. **阶段门槛决策 · CR-04** — 陈旧快照否决调用，与「调用瞬间实时读盘」用户硬约束张力。预期：改为交由主进程 `skillError` 回滚，或让广播无条件重拉快照。
4. **CR-03 时序实测** — 流式回复中调用技能。预期：新气泡不被标「用户已取消」、新回复流不被丢弃。
5. **UAT 三项**（48-01 D9 / 48-02 D6+D7 / 48-03 D5）— 气泡视觉与 IPC 往返 / 50+ 技能 @220px 面板观感 / 模型自动匹配 → 卡片标题 → 切换对话后标记仍在。

### Gaps Summary

**本阶段的功能目标在代码库中成立**：`/` 面板（展平单数组 + 分区标题 + 五要素行 + 可选中导航 + stale-while-revalidate）、`/skill:name [args]` 主进程端到端纵切（解析 → 调用瞬间实时读盘 → 逐字节等于 SDK 输出的 `<skill>` 块 → 注入 → 入历史 → 重开对话按 args 还原）、收窄投影与三档 tier、`read` 卡片技能化与重载标记重建、产品文档与 `AGENTS.md` 同步 —— 全部有可执行证据（222 + 341 + 101 例实跑全绿，含用**真实 SDK** 构造期望值的逐字节断言）。

**无 must_have 真值 FAILED**：4 条 judgment-tier 禁止项中 3 条（零写路径 / 不并入 `SLASH_COMMANDS` / renderer 不重算）VERIFIED，另 2 条落入 UNCERTAIN：

- 面板插值「全部经 `escapeHtml`」字面成立，但 `escapeHtml` 在属性上下文失效 —— 已用纯 Node 探针复现属性逃逸片段（CR-01）；
- 「不得以快照替代调用瞬间实时读盘」在主进程成立，但 renderer 预检可用陈旧快照**在到达实时读盘前**否决调用（CR-04）。

两项均为**计划自身的选择**（48-02 明文以 `escapeHtml` 为缓解；48-01 Task 3 ② 明文要求基于 `state.aiSkills` 的本地否决），非执行器偏离，故按 Escalation Gate 路由人工决策，而不是由 verifier 断言 BLOCKER。

三条真值落在 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED（模型自动匹配的模型侧行为、50+ 技能面板视觉、真实 Electron 端到端），与三个计划 SUMMARY 自报的 `human_judgment: true` 项一致，已进入 UAT 清单。**UAT 未通过前本阶段不得 complete**（与 `.planning/WINDOWS.md` 的 unrun-verify 条目一致）。

---

_Verified: 2026-09-12T06:50:49Z_
_Verifier: Claude (gsd-verifier)_

# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`） - Context

**Gathered:** 2026-09-12
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段把**已落地的技能数据层**（Phase 46 的 `ai-skills-manager.js` + 双目录 + prompt 注入，Phase 47 的随包内置技能）接到聊天输入框的**发现与调用链路**上，交付三件事：

1. **`/` 面板并入技能列表**：本地命令（`clear`/`compact`）与全部已启用技能同屏，按分区组织、支持实时过滤、按来源打徽标、遮蔽可见。
2. **`/skill:name [args]` 显式调用**：技能正文经 SDK `formatSkillInvocation` 作为 `<skill>` 块注入对话、**进入对话历史并触发 LLM 回复**（第二命令源，区别于本地 handler）。
3. **模型按 description 自动匹配**（DISC-05）的 UI 可见性：模型自行 `read` 技能正文时，工具卡片标识为「使用技能 X」。

**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07（7 项）

**不在本阶段**：`manage_skill` 写入路径（49）、设置页技能管理区与 `/api/skills/*`（50）、zip / 网络导入管线（51）。本阶段**不新增任何技能写路径**——它消费 Phase 46 / 47 已建立的数据面。

**两条前置约束（来自既有阶段，不得回退）**：

- **用户 2026-09-11 在 46-UAT 明确要求**：`/skill:name` 显式调用**必须实时读盘** —— 技能正文当场从磁盘读取，**不得**依赖 system prompt 里的冻结快照、也不得沿用对话历史里的旧回答。背景：46-UAT Test 3 实测「切回老对话看不到磁盘改动」，根因是模型复读自身历史答案（两次回答 1801 字符逐字相同），非重扫失效。→ 本阶段必须把「调用那一刻读当前盘面」写成显式约束与验收项。**注意口径**：实时性约束的是**调用瞬间**；注入之后该正文就是普通历史消息，跨轮保留、不重读（生态预期，见 D-09）。
- **P8 门禁（S2，阻断）本阶段的触发点**：ROADMAP 把「`/` 面板列表」列为技能缓存失效链 6 个触发点之一并交接给本阶段 → 面板必须反映最新技能集（D-17）。

</domain>

<decisions>
## Implementation Decisions

### 面板形态与过滤（DISC-01 / DISC-04）

- **D-01:** **面板按分区组织**：两个 sticky 小节标题「技能」/「命令」。理由：技能可达 50+ 而本地命令永远只有两条，平铺会让命令被淹没；且分区是 Claude Code `/` 面板的既有形态。**实现约束**：底层仍必须**展平为单数组** `state.slashPickerItems` —— 键盘 ↑↓ 导航（`handleAIInputKeydown`）与 `executeActiveSlashCommand` 都按单数组索引工作，分组只影响渲染，不得改成嵌套结构。过滤为空时**不渲染空分组标题**。
- **D-02:** **行内容 = 名称 + 来源徽标 + description 单行截断 + 「仅显式」标记**。`disable-model-invocation: true` 的技能打「仅显式」窄标记（DISC-07 的「UI 有标记」落在面板行上）。**不显示体积 / 文件数 / 诊断计数** —— 那是 Phase 50 设置页列表的职责（STATE.md 已把这三项归 50），面板 220px 高度装不下且会让行语义变重。
- **D-03:** **过滤 = name 前缀命中排前 + description 子串兜底排后**。本地命令（`clear` / `compact`）的 `startsWith` 语义与相对顺序**零变化**；技能的 name 前缀命中排在前一档，仅 description 命中的排在后一档。理由：50 个技能时用户常记得用途而记不得名字。
- **D-04:** **行显 `/name`、选中即执行**（args 取输入框里命令名之后的剩余文本，与 `executeActiveSlashCommand` 现有 `rest` 取值逻辑一致）。**显式语法 `/skill:name` 与裸 `/name` 都识别，本地命令优先**（技能名与本地命令同名时本地命令胜出）。— **Reversibility:** costly — 裸名兼容偏离 `.planning/research/FEATURES.md` §4.1 的「v1 不做裸名兼容（冲突优先级规则是纯增复杂度）」建议，引入了一条需要长期维护的优先级规则；回退需同时改渲染端解析与主进程解析两处，并核对面板呈现。理由：面板行显 `/name` 而手打却必须多敲 `skill:` 会造成「点了能用、照着打不认」的分裂。

### 调用语义与注入形态（DISC-02 / DISC-03）

- **D-05:** **拼接 = SDK `<skill>` 块 + 一行 provenance 声明 + args 原文追加**。具体：`formatSkillInvocation(skill, additionalInstructions)` 产出 `<skill name location>…正文…</skill>`，之后追加一行「用户显式调用了技能「name」」，再接 args 原文。**不做 `$ARGUMENTS` / `$N` / 命名参数替换**（`pi-agent-core` 完全不做字符串替换；`$ARGUMENTS` 属 ECO-04 已 deferred）。— **Reversibility:** costly — omp（oh-my-pi）的做法是**两套模板**（`user-invocation.md` 明说「用户调用了这个技能」+ `autoload.md` 仅 provenance），原文理由是 **"these hidden messages must not claim the user invoked them"**；SDK 只有一种形态，Realm 只能用「补一行声明」模拟其一半。若日后做自动注入，**必须**另写模板而不能复用本条的用户调用文本（否则模型会以为自己被显式要求过，行为偏向盲目执行而非参考）。
- **D-06:** **用户气泡 = 技能徽标 pill + args 正文**。消息对象挂 `{name, source}` 元数据（对齐 `referencedTabs` / `attachments` 的既有形状）；气泡**不显示** `/name` 原文与技能正文。
- **D-07:** **技能块置增强消息最前**：`[技能块+provenance+args, visionNotice, markerBlock, visionBlock, contextBlock]`。理由：显式调用时技能是这次请求的「程序说明」，附件与 `@` 引用是它的输入；原顺序（附件 marker 先于引用块）对附件部分保持不变。
- **D-08:** **流式中触发技能调用 → 先 abort/等待再发**（复用 `abortAIIfStreaming()`，与 `/clear`、`/compact` 一致）。**v1 不做 steer / followUp 排队**（`.planning/research/FEATURES.md:199` 同款建议）。
- **D-19:** **renderer 向主进程发完整语法文本 `/skill:name args`，由主进程解析出 name 与 args**（技能正文**不进** `message` 本体，只在主进程拼进增强消息）。— **Reversibility:** costly — 这是 renderer↔主进程的契约面，回退需同时改两侧并复核对话标题派生。理由：`_deriveConversationTitle()`（`ai-manager.js:1338`）取**原始消息前 30 字符**当对话标题 —— 若只发 args（技能调用可以无 args）标题会退化成「新对话」；若让 renderer 拼好增强文本再发，标题会变成 `<skill name="find-skills" locat` 这类垃圾。发完整语法文本让标题自然派生为 `/skill:find-skills 帮我找 X`，无 args 时也**不退化**。

### 历史持久化与正文透明度

- **D-09:** **完整入库 + 气泡可展开查看正文**。入库的就是当时拼好的完整增强消息（`<skill>` 块 + provenance + args），跨轮保留、**不重读文件** —— 「改了技能文件要重开会话才生效」是生态预期行为（`.planning/research/FEATURES.md:201`，与 `<context-summary>` / `<referenced-tab>` 的存储先例一致）。同时气泡里给一个**可展开的「技能正文（N 字符）」折叠块**（对齐 script card / 压缩摘要折叠框先例），让用户能看到这次实际喂了什么、不再对「旧对话不变」困惑。

### 边界技能行为（DISC-06 / DISC-07）

- **D-10:** **已禁用技能**：**面板隐藏**（Phase 50 判据 2 已定「禁用后不再进 system prompt 与 `/` 列表」）+ **显式调用被拒**，system-note 提示「技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用」。— **Reversibility:** costly — 与 Phase 50 的列表口径构成闭合语义，回退需同时改 48/50 两处口径与 `docs/product/ai-skills.md`。理由：46 D-09 的 `disabled` 是**二元开关**，用户禁用是明确意图，两个入口都不该沉默绕过。**注意别与 `disable-model-invocation` 混同** —— 那是另一个 flag，其技能**可**显式调用（D-02 的「仅显式」标记）。
- **D-11:** **被遮蔽的同名技能（shadowed）**：**可见但灰显、不可选中**（回车/点击都不执行），行尾标「已遮蔽 · 由用户同名技能胜出」；**手打 `/skill:name` 一律作用于胜出者**（46 D-08 已保证 name 唯一性 → 解析确定）。— **Reversibility:** costly — `shadowed` / `shadowedBy` 的渲染被 Phase 50 的列表一同消费（46 D-06 就是为 48/50 把败者保留在数据层），改为「不可见」需两阶段同时改。理由：ROADMAP 判据 3 要求「被遮蔽的同名技能可见」，但「可见」不应误导用户以为能调用败者版本。
- **D-12:** **超限技能（未进 system prompt）**：**面板列出 + 可显式调用 + 行尾标注**「未进提示词 · 超预算」或「超数量上限」。覆盖两种状态：`overLimit`（user 技能超 `MAX_USER_SKILLS = 50`）与 `realm_prompt_budget_exceeded`（prompt 段超 `SKILLS_PROMPT_CHAR_BUDGET = 8000`）。理由：与遮蔽的**关键差别**是超限只是「排不进预算」而非「同名冲突」—— 技能本身完全可用，显式调用是它唯一的可用路径，禁掉会让用户彻底失去入口。
- **D-13:** **不存在的技能**：沿用现有 system-note 形态（`src/renderer.js:8687` 的「未知命令」路径），文案区分 `/skill:foo` → 「未找到技能「foo」」、裸 `/foo` 两边都不命中 → 沿用「未知命令」。零新渲染形状。**推论**：被 `refreshSkills()` 整条跳过的技能（description 不可用 / 布局违约 / SKILL.md 超 64 KiB / 目录缺失）在本阶段**与「不存在」同形处理**，原因区分留给 Phase 50 的诊断面。

### 徽标、可见性与刷新（DISC-04 / DISC-05 / P8 触发点）

- **D-14:** **三档来源徽标的判定已由 Phase 47 D-11 锁定，本阶段只消费**：seeded 身份 = `builtin-skills-seeder.getSeededSkillNames()`（扫随包 `skills-builtin/` 下含 `SKILL.md` 的子目录名，**零状态文件、零硬编码**）。徽标三档 = 用户（`source === 'user'`）/ 内置（name ∈ seeded 集合）/ 托管（`source === 'managed'` 且非 seeded，即 AI 自建）。**不在本阶段重新定义该判定，也不落任何状态文件。**
- **D-15:** **模型自动匹配（DISC-05）的可见性 = 把 `read` 工具卡片特殊化**。现有 `renderToolCard()`（`src/renderer.js:9224`）已把每次工具调用渲染成卡片，模型自行 `read` 技能正文时用户本就能看到一张 `read` 卡片（路径含 SKILL.md）；本阶段要求：**参数落在 `skills/` 或 `managed-skills/` 下的 `SKILL.md`** 时，卡片标题改为「使用技能「name」」+ 技能徽标（与 D-06 的 pill 同款视觉），其余 `read` 卡片不变。**不额外插 system-note**（与 tool card 信息重复且自动匹配可能多次）。
- **D-16:** **对话消息不做内容改写**：技能调用作为普通 user 消息入库（`messages` 表的 `content` 列），附着元数据走既有 `attachments` / `tool_calls` 同款「消息对象挂字段」通道；**不改表结构**。

### 刷新时机（P8 门禁本阶段触发点）

- **D-17:** **stale-while-revalidate**：面板打开时**立即用内存快照渲染**（零延迟）→ **后台 `await refreshSkills()` 完成后原地重渲染**（不闪、不丢焦点）→ 再**监听 `skills:changed` 广播持续同步**。— **Reversibility:** costly — 该链路同时是 P8 门禁本阶段触发点的验收面（ROADMAP 把「`/` 面板列表」交接给 48）；降级为「只用快照」会让「bash 直改技能文件后立即打开面板」看到上一版，重新引入门禁已闭合的失效路径。**现状事实**：`ai-manager.js:2541` 已 `broadcast('skills:changed')`，但 **renderer 侧目前零监听**，需新增；快照经同步的 `ai-skills-manager.getSkillsSnapshot()` 读取，**当前无任何 IPC / realmAPI 暴露给 renderer**，需新增通道。

### prompt 措辞（STATE.md 待办收口）

- **D-18:** **在第 1 段 `REALM_SYSTEM_PROMPT` 补一句「技能（Skill）是用户可调用的工作流，与工具（Tool）不同」**，**不动技能段**（尊重 46 D-02「技能段原样使用 SDK `formatSkillsForSystemPrompt()` 返回值，不另加前缀」）。背景：`STATE.md:224` 记录模型被问「你有哪些技能」时会把 27 个 tool 也叫技能（无历史污染时模型自行区分正确）。代价：第 1 段是静态前缀，改一次会让既有会话的 prompt 前缀缓存重建一次（一次性）。

### Claude's Discretion

- **面板内同档位条目的排序**：建议沿用 `ai-skills-manager.bySkillPriority` 的确定性全序（user > 可自动激活 > name 码点序），**不得**改用区域敏感比较（会让 prompt 字节序列跨机漂移的先例已在 46 建立）。
- **新增 IPC / realmAPI 通道的命名与形状**：`realmAPI.ai.*` 下新增（如技能列表 / 技能调用），与既有 `ai:prompt` / `ai:prompt-with-context` 并列；具体形状交 plan 期。
- **`skills:changed` 广播 payload 是否携带变更摘要**：现在是无参广播；是否加 payload 交 plan 期决定（面板打开中才需要重拉）。
- **面板空态**：本阶段**不做**「如何获得技能」的引导（设置页导入入口 Phase 50 才存在，属可接受的中间态 —— 与 47 D-03 的前瞻指向同款判断）；只显示「命令」分区。
- **`read` 卡片识别的判定位置**（主进程打标记 vs renderer 按路径匹配）：判据是必须在**工具事件生成侧**就能判定（renderer 不掌握技能目录的权威路径），具体落点交 plan 期。
- **待实测项**：面板 220px 高度在 50 技能 + 两个 sticky 标题下的实际观感；分组渲染后 `slashPickerItems` 单数组化是否会引入索引漂移。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑、需求与门禁

- `.planning/ROADMAP.md` §Phase 48 / §Security Gates — Goal、5 条 Success Criteria（判据 2 的 `/skill:` 调用、判据 3 的三档徽标与遮蔽可见、判据 5 的 `disable-model-invocation` 显式调用与 UI 标记）、P8 门禁的 6 个触发点归属
- `.planning/REQUIREMENTS.md` — DISC-01..07 条目原文（第 32-38 行）、v2 Requirements 的 ECO-04（占位符替换 deferred）、Out of Scope 表（预加载正文 / `allowed-tools` 执行层门禁 / 技能热重载）
- `.planning/PROJECT.md` §Current Milestone v2.6 / §Key Decisions — 里程碑目标、§268「复用资产：`/` 斜杠命令面板（renderer.js `SLASH_COMMANDS`）」、`:355-366` 的 Phase 46/47 已验证决策全表
- `.planning/STATE.md` §Blockers/Concerns — **`:223`（`/skill:name` 必须实时读盘，用户明确要求）**、**`:222`（`syncAgentSystemPrompt()` 无生产调用方，P8 只闭合 3/6）**、**`:224`（prompt 未区分工具/技能，本阶段由 D-18 收口）**、`:220`（O7 三条限额数值已在 46 落定，48 不得重新定义）

### 研究（本阶段实现的直接依据）

- `.planning/research/FEATURES.md` **§3**（`:190-201`：`formatSkillInvocation` 注入原语、omp 两种模板 + "must not claim the user invoked them"、投递时机、**内容生命周期：注入即普通消息、跨轮保留、不重读文件**）、**§4**（`:205-247`：生态命名形态表、`/skill:name` 立项三理由、`$ARGUMENTS` 属 Claude Code 能力而 pi-agent-core 完全不做替换、堆叠与 mid-prompt 嵌入均 P3 defer）
- `.planning/research/SUMMARY.md` — §Phase 48 / §Open Decisions；`:71` 的 2 层 tier 与「同名冲突必须对用户可见」
- `.planning/research/ARCHITECTURE.md` — `ai-skills-manager.js` 设计、模块级缓存 + 同步访问器、Anti-Pattern 1–5
- `.planning/research/PITFALLS.md` — P3（name 冒名 / description 无条件进 prompt）与 "Looks Done But Isn't" 检查表
- `.planning/research/STACK.md` — SDK API 形态（`loadSkills` / `loadSourcedSkills` / `formatSkillsForSystemPrompt` / **`formatSkillInvocation`**）

### 上一阶段（本阶段的前置契约）

- `.planning/phases/46-prompt/46-CONTEXT.md` — **D-02**（技能段原样用 SDK 返回值，D-18 不得违反）、**D-03**（`syncAgentSystemPrompt()` 不重建 Agent）、**D-06**（遮蔽败者保留 + `shadowed`/`shadowedBy`，明确「48 要来源徽标 / 50 要列表」）、**D-07**（诊断形态 `skill.diagnostics[]` + 模块级 `errors[]`）、**D-08**（name 恒等于目录名 → `/skill:` 解析确定）、**D-09**（禁用存 `settings.aiSkills.disabled`，加载后过滤不删文件）、**D-10**（prompt 预算取舍顺序）、**D-11**（三条限额常量单源）
- `.planning/phases/47-bash/47-CONTEXT.md` — **D-11**（seeded 身份 = 扫随包 `skills-builtin/` 目录名，**同时服务 Phase 48 的 seeded 徽标**）、**D-04**（内置技能 `description` 用中文、面向用户 —— 其实际消费者是 48 的 `/` 面板与 50 的设置页）
- `.planning/phases/46-prompt/46-UAT.md` §Deferred Follow-Ups — 「实时读盘」要求的原始出处

### 项目内既有先例与会话契约（实现时照抄的对象）

- `src/renderer.js` — `SLASH_COMMANDS`（`:334`，本地命令注册表唯一来源）、`renderSlashPickerList`（`:9900`，单层 `items.map` + `state.slashPickerItems` 单数组）、`handleAIInputKeydown`（`:9768`，↑↓ 循环 / Enter 执行 / Esc 关闭）、`executeActiveSlashCommand`（`:9810`，`rest` 取值逻辑）、`handleSendAIMessage`（`:8663`，斜杠拦截在 `aiStreaming` 守卫**之前**、未知命令 system-note 在 `:8687`）、`renderToolCard`（`:9224`，D-15 的落点）、`handleSendAIMessage` 的 `referencedTabs`/`attachments` 元数据挂载（`:8713`，D-06 的形状先例）
- `ai-manager.js` — `buildSystemPrompt()`（`:583`，技能段拼装）、`prompt()`（`:977`）/ `promptWithContext()`（`:1089`，增强消息拼接在 `:1229`，D-07 的落点）、`_ensureConversation()`（`:1305`）与 `_deriveConversationTitle()`（`:1338`，D-19 的根因）、`syncAgentSystemPrompt()`（`:2507` 附近，`:2541` 广播 `skills:changed`）、`_recreateAgent()` 前的 `refreshSkills()` 兜底（46 D-04）
- `ai-skills-manager.js` — 技能集**单一数据权威**；`getSkillsSnapshot()`（`:648`，同步浅拷贝视图，**D-17 的读取口**）、`refreshSkills()`（`:440`，异步加载 + 加载后管线 ①–⑦）、`bySkillPriority`（`:396`，确定性全序）、`LIMITS`（`:32`，三条限额单源）、条目字段 `{skill, source, diagnostics, shadowed, shadowedBy, disabled, overLimit}`（`:39-61`）
- `builtin-skills-seeder.js` — `getSeededSkillNames()`（`:92`，**D-14 的第三档徽标数据源**；注意本模块经 `agent-workspace` 间接依赖 electron，与 `ai-skills-manager.js` 的「无 electron 依赖」纪律不同，组合点须谨慎选择）
- `ai-attachments-manager.js` — `buildAttachmentMarkers()`（`:438`）marker 文本构建与注入先例（D-09 的形态参照）
- `ai-conversations-manager.js` — `messages` 表字段（`:67-78`，含 `attachments` / `tool_calls` / `tool_results` / `page_snapshots` 列，D-16 说明不改表结构）
- `src/index.html:862` §`slashPickerPanel` + `src/styles/main.css:6973` §`.slash-picker-panel`（`bottom:100%` / `max-height:220px` / `.slash-picker-row` / `.slash-picker-name` / `.slash-picker-desc`）— D-01 / D-02 的落点
- `docs/product/ai-skills.md` — 本阶段按 AGENTS.md 维护约定补「发现与调用」章节（现有八节：能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制 / 测试与验证 / 内置技能）

### 参考实现（仓库外，仅作设计参照，不引入依赖）

- `/Volumes/ZhiTai/Projects/github/openhanako/` — omp（oh-my-pi）系列参考：`docs/skills.md`（技能对象形状、7 层 provider priority）、`user-invocation.md` / `autoload.md`（**两套注入模板**，D-05 的对照面）、mid-prompt 嵌入 token 的识别规则（Realm 明确 defer）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`SLASH_COMMANDS` 注册表本身就是「技能行」的形状原型** —— 每项 `{name, description, takesArg, handler}`，`takesArg` 已为「命令可接参数」预留了字段；技能行可复用同一结构，把 `handler` 换成「调用主进程」的 async 分支。渲染、键盘导航、点击/hover 高亮全部可原样复用。
- **`state.slashPickerItems` 单数组索引模型**：`handleAIInputKeydown` 的 ↑↓ 取模循环与 `executeActiveSlashCommand` 的 `state.slashPickerItems[state.slashPickerActiveIndex]` 都只认单数组 —— D-01 的分组渲染必须在此约束下实现。
- **`referencedTabs` / `attachments` 元数据挂载模式**（`src/renderer.js:8713`）：用户消息对象挂附加字段 → 气泡额外渲染 pill → 落库随行持久化。D-06 的 `{name, source}` 与 D-09 的折叠块直接照抄这条链路，**不需要新表或新列**。
- **`renderToolCard()` 已有的 params/result 折叠结构** —— D-15 的「使用技能「name」」只是改标题 + 加徽标，卡片骨架与折叠交互复用。
- **`abortAIIfStreaming()`**（`:8804`）—— D-08 直接复用，零新增中止逻辑。
- **`getSkillsSnapshot()` 的同步浅拷贝视图** —— D-17 的「立即渲染」半边由它满足（零 IO、非 Promise，renderer 经 IPC 拿到后可直接用）。

### Established Patterns

- **单一数据权威**：技能集只在 `ai-skills-manager.js` 一处加载/去重/诊断/限额；renderer 只渲染，**不得**在渲染端重实现优先级或遮蔽判定（46 D-06 明确「优先级逻辑只在主进程一份」）。
- **常量单源**：`LIMITS`（64 KiB / 50 / 8000）只在 manager 定义 —— Phase 48 只渲染，**不得重新定义或写死数值**。
- **禁止静默失败**：错误一律走 system-note / 诊断，D-12 的「未进提示词」标注与 D-13 的明确错误提示都是这条约定的延续。
- **冻结快照 + 同步只读**：`buildSystemPrompt()` 必须保持同步零 IO（G-42-4 先例）；本阶段的**调用路径**不走快照（实时读盘），但**列表路径**走快照 —— 两条路径的语义差异必须在实现中显式区分，不得混用。
- **`realm://` 页面 CSP**：本阶段 UI 全在主窗口（`file://`，无 CSP 限制），不涉及 `style-src 'self'` 的初始隐藏约束；但**弹框居中约定**适用（若最终产出任何 dialog，须显式 `margin: auto`）。
- **`file://` 主窗口不能 fetch 本地 HTTP API**：技能数据必须走 `realmAPI.*` IPC（preload 的 `contextBridge`），不得 fetch `http://localhost:PORT/api/*`（Phase 38 事故）。

### Integration Points

- `src/renderer.js` —— `SLASH_COMMANDS` + `renderSlashPickerList` + `renderAIMessages` 的技能行渲染 + `handleSendAIMessage` 的斜杠解析分支 + 新增 `skills:changed` 监听（D-01/D-02/D-03/D-04/D-06/D-09/D-17 的全部落点）
- `src/preload.js` —— `realmAPI.ai.*` 下新增技能列表读取与技能调用（或扩展现有 `ai:prompt` 契约，D-19 决定「发完整语法文本」）
- `ipc-handlers.js` —— 新增通道注册（`ai:get-skills` 类）与现有 `ai:prompt` / `ai:prompt-with-context`（`:1680` / `:1699`）
- `ai-manager.js` —— 技能调用解析与实时读盘（D-05/D-07/D-19）、增强消息拼接顺序（`:1229`，技能块置最前）、`_deriveConversationTitle` 的输入契约（`:1338`）、`read` 工具卡片的事件标记（D-15）、`REALM_SYSTEM_PROMPT` 第 1 段措辞（D-18）
- `ai-skills-manager.js` —— `refreshSkills()` 由面板打开触发（D-17）；**本阶段零新增写路径**，故 `syncAgentSystemPrompt()` 仍不产生新的生产调用方（该收口在 49/50/51）
- `builtin-skills-seeder.js` → 三档徽标的数据组合点（D-14；注意 electron 依赖边界）
- `tests/test-ai-skills.js` —— 已有技能基础设施断言（含 `skills:changed` 广播行为断言 `:1218`）；本阶段需新增解析 / 面板过滤 / 边界行为的断言组
- `docs/product/ai-skills.md` —— 新增「发现与调用」章节（面板形态 / `/skill:name` 语义 / 实时读盘口径 / 边界技能行为 / 三档徽标）

</code_context>

<specifics>
## Specific Ideas

- **用户主动问了「omp 是怎么做的」**（本阶段讨论中的关键转折）：查证结论是 omp 用**两套注入模板**（`user-invocation.md` 明说用户调用了技能 + `autoload.md` 仅 provenance），原文理由是 **"these hidden messages must not claim the user invoked them"**。而 `pi-agent-core` 的 `formatSkillInvocation` **只有一种形态**，所以在「args 语义」这个问题上 Realm 只能补一行 provenance 声明来模拟其中一半 —— 这是 D-05 的直接来源。**omp 的另外两条结论被明确继承**：① 投递时机不做排队（v1）；② 正文注入即普通消息、跨轮保留、不重读文件（D-09）。
- **「实时读盘」的精确口径**（用户 2026-09-11 定）：约束的是**调用那一刻**从磁盘读取，不依赖 prompt 冻结快照、不沿用历史旧回答；注入之后它就是历史消息。**不要把「实时」泛化成「每次请求都重读所有技能正文」** —— 那会与生态预期（D-09）冲突并让 provider 前缀缓存全 miss。
- **面板行显 `/name` 而手打要认 `/skill:name`**：用户在「行显 /name，选中即执行」与「行显 /skill:name」之间选了前者，理由是「面板是发现面，不强制用户多敲 `skill:`」；D-04 的「两条路径都识别」是让这个选择不产生「点了能用、照着打不认」的分裂的配套。
- **`.planning/research/FEATURES.md:216` 记录的现状**：现有匹配是「严格的前缀 + 空白边界」（`text === '/'+name || text.startsWith('/'+name+' ')`），未知命令不入历史 —— D-04 的裸名识别必须沿用同一套边界语义，不得退化为宽松前缀匹配。
- **`.planning/research/FEATURES.md:222` 的第三条立项理由**：`/skill:` 前缀让面板能**用前缀直接分流**（输入 `/skill` 就只显示技能）—— 本阶段未把该行为列为独立决策，但 D-03 的过滤实现可为它留出自然落点（`/skill:` 作为过滤 token 时的处理交 plan 期按实现决定）。
- **P8 门禁的语义**：本阶段是「`/` 面板列表」这个触发点的归属阶段 —— 面板必须反映最新技能集（D-17）；同时 `.planning/STATE.md:222` 的 `syncAgentSystemPrompt()` 生产调用方收口**仍不在本阶段**（48 无写路径），须在 CONTEXT 中如实写明，避免下游声称 6 点全覆盖。
- **本阶段的 UI hint**：ROADMAP 标了 `UI hint: yes` → 规划时考虑是否需要 `/gsd:ui-phase 48` 产出设计契约（面板分区样式 / 徽标视觉 / 折叠块形态）。

</specifics>

<deferred>
## Deferred Ideas

- **mid-prompt 嵌入 `/skill:<name>` token**（omp 支持：识别前导与空白分隔的嵌入 token，移除 token 后把周围散文作为 args；且当草稿以其他斜杠命令或 bash/python sigil 开头时不视为调用）—— `.planning/research/FEATURES.md:241-247` 明确 **P3 defer**：收益（少打一个回车）远小于复杂度（token 扫描 + 多命令共存 + 与 `@` 引用/附件 marker 的交互）。
- **技能堆叠调用**（`/a /b 123`，Claude Code 最多展开 6 个）—— `FEATURES.md:237` 明确 **P3 defer**：需循环解析 + 参数分配规则。
- **`$ARGUMENTS` / `$ARGUMENTS[N]` / `$N` / 命名参数 / `${CLAUDE_SKILL_DIR}` 等替换变量** —— **ECO-04**（REQUIREMENTS v2 Requirements）；`pi-agent-core` 完全不做字符串替换，且会让技能文件在不支持的宿主上行为分叉。
- **面板空态「如何获得技能」的引导** —— 设置页导入入口 Phase 50 才存在；本阶段属可接受的中间态（与 47 D-03 的前瞻指向同款判断）。
- **技能正文经 `/compact` 保留** —— **ECO-03**；**O8** 已由 Phase 46 落定为「不保留」并写进 `docs/product/ai-skills.md` 已知限制。
- **`allowed-tools` 的解析与展示** —— **O3**：48 不展示该字段；若后续（51 解析 / 50 展示）出现，**必须**带「当前运行时不被强制，仅供参考」免责标注，执行层门禁明确 Out of Scope。
- **四态可见性**（Claude Code `skillOverrides` 的 `"on"` / `"name-only"` / `"user-invocable-only"` / `"off"`）—— `.planning/research/FEATURES.md:230` 建议 v1 只做二元 enable/disable；四态属 **ECO-05**。
- **诊断在面板内的展示**（每条技能的诊断计数 / 悬停详情）—— 归 Phase 50 设置页列表；本阶段面板只显示「未进提示词」这一条与调用直接相关的状态。
- **`syncAgentSystemPrompt()` 生产调用方收口** —— 本阶段无写路径，归 Phase 49（`manage_skill` 三动作）/ 50（启停卸载）/ 51（导入）；`.planning/STATE.md:222` 的 ⚠️ 仍挂着。

</deferred>

---

*Phase: 48-技能发现与调用（`/` 面板 + `/skill:name`）*
*Context gathered: 2026-09-12*

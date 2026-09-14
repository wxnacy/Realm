# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`） - Research

**Researched:** 2026-09-12
**Domain:** Electron 主进程 ↔ renderer IPC + `pi-agent-core` 技能注入原语 + 输入框浮层面板
**Confidence:** HIGH（三条实现面均有 file:line 或 SDK 源码级证据；仅面板 220px 观感为 backstop）

## Summary

本阶段是**消费型阶段**：技能数据层（Phase 46 的 `ai-skills-manager.js`、Phase 47 的播种）已完整落地，
48 不新增任何技能写路径，只把已落地的数据接到「发现（`/` 面板）」与「调用（`/skill:name` → 对话历史）」
两条链路，外加 `read` 工具卡片的技能化可见性。

研究得出**五条会改变实现方案的一手事实**（全部有 file:line 或运行级证据，详见
`## 五条必须先知道的硬事实`）：

1. **SDK `formatSkillInvocation` 缺 `content` 时静默产出字面量 `undefined`** —— 注入前必须先成功读盘，
   不能把快照对象直接喂进去（快照对象**是有** `content` 的，但那是冻结态，违反实时读盘约束）。
2. **`executeActiveSlashCommand` 的 `rest` 取值逻辑在 `/skill:<前缀> <args>` 形态下会吞掉 args 开头**
   —— 用 node 实测复现（`/skill:find 帮我找 X` → args 只剩 `X`；`/fin 帮我找 X` → args 全空）。
   这是本阶段的**阻断级**兼容问题，必须有 token 取值的修法，不能照抄。
3. **D-12 的「超预算未进提示词」在数据层根本不存在对应字段** —— `refreshSkills()` ⑦ 只截断 promptBlock，
   不给被丢弃的条目打标记。48 必须在 `ai-skills-manager.js` 里补一个**条目级字段**，否则 UI 只能
   在渲染端重算贪心（违反单一数据权威）。
4. **`builtin-skills-seeder.getSeededSkillNames()` 在纯 Node 进程里会抛 `TypeError`**
   —— 实测：`Cannot read properties of undefined (reading 'isPackaged')`（`require('electron')` 在非 Electron
   Node 里返回字符串，解构出的 `app` 是 `undefined`）。三档徽标的组合点 + 测试注入方案因此必须显式设计。
5. **`getSkillsSnapshot()` 的 `skill` 对象带 `content`** —— 面板投影必须做**收窄投影**，
   不能把快照整体 JSON 过 IPC（50 个技能 × 最坏 64 KiB 正文）。

**Primary recommendation:** 技能集在 main 侧一次性投影成 UI 形状（含 `tier` / 状态标注字段），
经新增 `ai:get-skills`（同步快照）+ `ai:refresh-skills`（走既有 `syncAgentSystemPrompt()`）两个通道交付；
`/skill:name` 由 renderer 做**预检**（决定 system-note）、main 做**权威解析 + 实时读盘 + 增强消息组装**；
`read` 卡片标记由 `ai-manager._setupEventBroadcasting()` 的 `tool_execution_start` 分支打，
匹配走 `ai-skills-manager` 的缓存 `filePath`（新增纯函数 `matchSkillByPath`）。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

（以下为 `48-CONTEXT.md` §decisions 的**逐字**复制，plan 期不得改写、不得重新讨论）

#### 面板形态与过滤（DISC-01 / DISC-04）

- **D-01:** **面板按分区组织**：两个 sticky 小节标题「技能」/「命令」。理由：技能可达 50+ 而本地命令永远只有两条，平铺会让命令被淹没；且分区是 Claude Code `/` 面板的既有形态。**实现约束**：底层仍必须**展平为单数组** `state.slashPickerItems` —— 键盘 ↑↓ 导航（`handleAIInputKeydown`）与 `executeActiveSlashCommand` 都按单数组索引工作，分组只影响渲染，不得改成嵌套结构。过滤为空时**不渲染空分组标题**。
- **D-02:** **行内容 = 名称 + 来源徽标 + description 单行截断 + 「仅显式」标记**。`disable-model-invocation: true` 的技能打「仅显式」窄标记（DISC-07 的「UI 有标记」落在面板行上）。**不显示体积 / 文件数 / 诊断计数** —— 那是 Phase 50 设置页列表的职责（STATE.md 已把这三项归 50），面板 220px 高度装不下且会让行语义变重。
- **D-03:** **过滤 = name 前缀命中排前 + description 子串兜底排后**。本地命令（`clear` / `compact`）的 `startsWith` 语义与相对顺序**零变化**；技能的 name 前缀命中排在前一档，仅 description 命中的排在后一档。理由：50 个技能时用户常记得用途而记不得名字。
- **D-04:** **行显 `/name`、选中即执行**（args 取输入框里命令名之后的剩余文本，与 `executeActiveSlashCommand` 现有 `rest` 取值逻辑一致）。**显式语法 `/skill:name` 与裸 `/name` 都识别，本地命令优先**（技能名与本地命令同名时本地命令胜出）。— **Reversibility:** costly — 裸名兼容偏离 `.planning/research/FEATURES.md` §4.1 的「v1 不做裸名兼容（冲突优先级规则是纯增复杂度）」建议，引入了一条需要长期维护的优先级规则；回退需同时改渲染端解析与主进程解析两处，并核对面板呈现。理由：面板行显 `/name` 而手打却必须多敲 `skill:` 会造成「点了能用、照着打不认」的分裂。

#### 调用语义与注入形态（DISC-02 / DISC-03）

- **D-05:** **拼接 = SDK `<skill>` 块 + 一行 provenance 声明 + args 原文追加**。具体：`formatSkillInvocation(skill, additionalInstructions)` 产出 `<skill name location>…正文…</skill>`，之后追加一行「用户显式调用了技能「name」」，再接 args 原文。**不做 `$ARGUMENTS` / `$N` / 命名参数替换**（`pi-agent-core` 完全不做字符串替换；`$ARGUMENTS` 属 ECO-04 已 deferred）。— **Reversibility:** costly — omp（oh-my-pi）的做法是**两套模板**（`user-invocation.md` 明说「用户调用了这个技能」+ `autoload.md` 仅 provenance），原文理由是 **"these hidden messages must not claim the user invoked them"**；SDK 只有一种形态，Realm 只能用「补一行声明」模拟其一半。若日后做自动注入，**必须**另写模板而不能复用本条的用户调用文本（否则模型会以为自己被显式要求过，行为偏向盲目执行而非参考）。
- **D-06:** **用户气泡 = 技能徽标 pill + args 正文**。消息对象挂 `{name, source}` 元数据（对齐 `referencedTabs` / `attachments` 的既有形状）；气泡**不显示** `/name` 原文与技能正文。
- **D-07:** **技能块置增强消息最前**：`[技能块+provenance+args, visionNotice, markerBlock, visionBlock, contextBlock]`。理由：显式调用时技能是这次请求的「程序说明」，附件与 `@` 引用是它的输入；原顺序（附件 marker 先于引用块）对附件部分保持不变。
- **D-08:** **流式中触发技能调用 → 先 abort/等待再发**（复用 `abortAIIfStreaming()`，与 `/clear`、`/compact` 一致）。**v1 不做 steer / followUp 排队**（`.planning/research/FEATURES.md:199` 同款建议）。
- **D-19:** **renderer 向主进程发完整语法文本 `/skill:name args`，由主进程解析出 name 与 args**（技能正文**不进** `message` 本体，只在主进程拼进增强消息）。— **Reversibility:** costly — 这是 renderer↔主进程的契约面，回退需同时改两侧并复核对话标题派生。理由：`_deriveConversationTitle()`（`ai-manager.js:1338`）取**原始消息前 30 字符**当对话标题 —— 若只发 args（技能调用可以无 args）标题会退化成「新对话」；若让 renderer 拼好增强文本再发，标题会变成 `<skill name="find-skills" locat` 这类垃圾。发完整语法文本让标题自然派生为 `/skill:find-skills 帮我找 X`，无 args 时也**不退化**。

#### 历史持久化与正文透明度

- **D-09:** **完整入库 + 气泡可展开查看正文**。入库的就是当时拼好的完整增强消息（`<skill>` 块 + provenance + args），跨轮保留、**不重读文件** —— 「改了技能文件要重开会话才生效」是生态预期行为（`.planning/research/FEATURES.md:201`，与 `<context-summary>` / `<referenced-tab>` 的存储先例一致）。同时气泡里给一个**可展开的「技能正文（N 字符）」折叠块**（对齐 script card / 压缩摘要折叠框先例），让用户能看到这次实际喂了什么、不再对「旧对话不变」困惑。

#### 边界技能行为（DISC-06 / DISC-07）

- **D-10:** **已禁用技能**：**面板隐藏**（Phase 50 判据 2 已定「禁用后不再进 system prompt 与 `/` 列表」）+ **显式调用被拒**，system-note 提示「技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用」。— **Reversibility:** costly — 与 Phase 50 的列表口径构成闭合语义，回退需同时改 48/50 两处口径与 `docs/product/ai-skills.md`。理由：46 D-09 的 `disabled` 是**二元开关**，用户禁用是明确意图，两个入口都不该沉默绕过。**注意别与 `disable-model-invocation` 混同** —— 那是另一个 flag，其技能**可**显式调用（D-02 的「仅显式」标记）。
- **D-11:** **被遮蔽的同名技能（shadowed）**：**可见但灰显、不可选中**（回车/点击都不执行），行尾标「已遮蔽 · 由用户同名技能胜出」；**手打 `/skill:name` 一律作用于胜出者**（46 D-08 已保证 name 唯一性 → 解析确定）。— **Reversibility:** costly — `shadowed` / `shadowedBy` 的渲染被 Phase 50 的列表一同消费（46 D-06 就是为 48/50 把败者保留在数据层），改为「不可见」需两阶段同时改。理由：ROADMAP 判据 3 要求「被遮蔽的同名技能可见」，但「可见」不应误导用户以为能调用败者版本。
- **D-12:** **超限技能（未进 system prompt）**：**面板列出 + 可显式调用 + 行尾标注**「未进提示词 · 超预算」或「超数量上限」。覆盖两种状态：`overLimit`（user 技能超 `MAX_USER_SKILLS = 50`）与 `realm_prompt_budget_exceeded`（prompt 段超 `SKILLS_PROMPT_CHAR_BUDGET = 8000`）。理由：与遮蔽的**关键差别**是超限只是「排不进预算」而非「同名冲突」—— 技能本身完全可用，显式调用是它唯一的可用路径，禁掉会让用户彻底失去入口。
- **D-13:** **不存在的技能**：沿用现有 system-note 形态（`src/renderer.js:8687` 的「未知命令」路径），文案区分 `/skill:foo` → 「未找到技能「foo」」、裸 `/foo` 两边都不命中 → 沿用「未知命令」。零新渲染形状。**推论**：被 `refreshSkills()` 整条跳过的技能（description 不可用 / 布局违约 / SKILL.md 超 64 KiB / 目录缺失）在本阶段**与「不存在」同形处理**，原因区分留给 Phase 50 的诊断面。

#### 徽标、可见性与刷新（DISC-04 / DISC-05 / P8 触发点）

- **D-14:** **三档来源徽标的判定已由 Phase 47 D-11 锁定，本阶段只消费**：seeded 身份 = `builtin-skills-seeder.getSeededSkillNames()`（扫随包 `skills-builtin/` 下含 `SKILL.md` 的子目录名，**零状态文件、零硬编码**）。徽标三档 = 用户（`source === 'user'`）/ 内置（name ∈ seeded 集合）/ 托管（`source === 'managed'` 且非 seeded，即 AI 自建）。**不在本阶段重新定义该判定，也不落任何状态文件。**
- **D-15:** **模型自动匹配（DISC-05）的可见性 = 把 `read` 工具卡片特殊化**。现有 `renderToolCard()`（`src/renderer.js:9224`）已把每次工具调用渲染成卡片，模型自行 `read` 技能正文时用户本就能看到一张 `read` 卡片（路径含 SKILL.md）；本阶段要求：**参数落在 `skills/` 或 `managed-skills/` 下的 `SKILL.md`** 时，卡片标题改为「使用技能「name」」+ 技能徽标（与 D-06 的 pill 同款视觉），其余 `read` 卡片不变。**不额外插 system-note**（与 tool card 信息重复且自动匹配可能多次）。
- **D-16:** **对话消息不做内容改写**：技能调用作为普通 user 消息入库（`messages` 表的 `content` 列），附着元数据走既有 `attachments` / `tool_calls` 同款「消息对象挂字段」通道；**不改表结构**。

#### 刷新时机（P8 门禁本阶段触发点）

- **D-17:** **stale-while-revalidate**：面板打开时**立即用内存快照渲染**（零延迟）→ **后台 `await refreshSkills()` 完成后原地重渲染**（不闪、不丢焦点）→ 再**监听 `skills:changed` 广播持续同步**。— **Reversibility:** costly — 该链路同时是 P8 门禁本阶段触发点的验收面（ROADMAP 把「`/` 面板列表」交接给 48）；降级为「只用快照」会让「bash 直改技能文件后立即打开面板」看到上一版，重新引入门禁已闭合的失效路径。**现状事实**：`ai-manager.js:2541` 已 `broadcast('skills:changed')`，但 **renderer 侧目前零监听**，需新增；快照经同步的 `ai-skills-manager.getSkillsSnapshot()` 读取，**当前无任何 IPC / realmAPI 暴露给 renderer**，需新增通道。

#### prompt 措辞（STATE.md 待办收口）

- **D-18:** **在第 1 段 `REALM_SYSTEM_PROMPT` 补一句「技能（Skill）是用户可调用的工作流，与工具（Tool）不同」**，**不动技能段**（尊重 46 D-02「技能段原样使用 SDK `formatSkillsForSystemPrompt()` 返回值，不另加前缀」）。背景：`STATE.md:224` 记录模型被问「你有哪些技能」时会把 27 个 tool 也叫技能（无历史污染时模型自行区分正确）。代价：第 1 段是静态前缀，改一次会让既有会话的 prompt 前缀缓存重建一次（一次性）。

### Claude's Discretion

- **面板内同档位条目的排序**：建议沿用 `ai-skills-manager.bySkillPriority` 的确定性全序（user > 可自动激活 > name 码点序），**不得**改用区域敏感比较（会让 prompt 字节序列跨机漂移的先例已在 46 建立）。
- **新增 IPC / realmAPI 通道的命名与形状**：`realmAPI.ai.*` 下新增（如技能列表 / 技能调用），与既有 `ai:prompt` / `ai:prompt-with-context` 并列；具体形状交 plan 期。
- **`skills:changed` 广播 payload 是否携带变更摘要**：现在是无参广播；是否加 payload 交 plan 期决定（面板打开中才需要重拉）。
- **面板空态**：本阶段**不做**「如何获得技能」的引导（设置页导入入口 Phase 50 才存在，属可接受的中间态 —— 与 47 D-03 的前瞻指向同款判断）；只显示「命令」分区。
- **`read` 卡片识别的判定位置**（主进程打标记 vs renderer 按路径匹配）：判据是必须在**工具事件生成侧**就能判定（renderer 不掌握技能目录的权威路径），具体落点交 plan 期。
- **待实测项**：面板 220px 高度在 50 技能 + 两个 sticky 标题下的实际观感；分组渲染后 `slashPickerItems` 单数组化是否会引入索引漂移。

### Deferred Ideas (OUT OF SCOPE)

- **mid-prompt 嵌入 `/skill:<name>` token**（omp 支持：识别前导与空白分隔的嵌入 token，移除 token 后把周围散文作为 args；且当草稿以其他斜杠命令或 bash/python sigil 开头时不视为调用）—— `.planning/research/FEATURES.md:241-247` 明确 **P3 defer**：收益（少打一个回车）远小于复杂度（token 扫描 + 多命令共存 + 与 `@` 引用/附件 marker 的交互）。
- **技能堆叠调用**（`/a /b 123`，Claude Code 最多展开 6 个）—— `FEATURES.md:237` 明确 **P3 defer**：需循环解析 + 参数分配规则。
- **`$ARGUMENTS` / `$ARGUMENTS[N]` / `$N` / 命名参数 / `${CLAUDE_SKILL_DIR}` 等替换变量** —— **ECO-04**（REQUIREMENTS v2 Requirements）；`pi-agent-core` 完全不做字符串替换，且会让技能文件在不支持的宿主上行为分叉。
- **面板空态「如何获得技能」的引导** —— 设置页导入入口 Phase 50 才存在；本阶段属可接受的中间态（与 47 D-03 的前瞻指向同款判断）。
- **技能正文经 `/compact` 保留** —— **ECO-03**；**O8** 已由 Phase 46 落定为「不保留」并写进 `docs/product/ai-skills.md` 已知限制。
- **`allowed-tools` 的解析与展示** —— **O3**：48 不展示该字段；若后续（51 解析 / 50 展示）出现，**必须**带「当前运行时不被强制，仅供参考」免责标注，执行层门禁明确 Out of Scope。
- **四态可见性**（Claude Code `skillOverrides` 的 `"on"` / `"name-only"` / `"user-invocable-only"` / `"off"`）—— `.planning/research/FEATURES.md:230` 建议 v1 只做二元 enable/disable；四态属 **ECO-05**。
- **诊断在面板内的展示**（每条技能的诊断计数 / 悬停详情）—— 归 Phase 50 设置页列表；本阶段面板只显示「未进提示词」这一条与调用直接相关的状态。
- **`syncAgentSystemPrompt()` 生产调用方收口** —— 本阶段无写路径，归 Phase 49（`manage_skill` 三动作）/ 50（启停卸载）/ 51（导入）；`.planning/STATE.md:222` 的 ⚠️ 仍挂着。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description（REQUIREMENTS.md 原文） | Research Support |
|----|-------------|------------------|
| DISC-01 | 用户在聊天输入框输入 `/` 时，面板列出全部已启用技能与既有本地命令，可按名称实时过滤 | 面 1：§1.1–§1.6（现状 file:line、投影字段、展平单数组 + 变更后的点击绑定、`/skill:` 过滤 token） |
| DISC-02 | 用户可选择技能并以 `/skill:name [args]` 形式调用，技能正文经 `formatSkillInvocation` 作为 `<skill>` 块注入对话 | 面 2：§2.1（SDK 源码级签名 + 实测输出）、§2.3（实时读盘读取口）、§2.4（拼接顺序落点 `ai-manager.js:1229`） |
| DISC-03 | 技能调用**进入对话历史并触发 LLM**（与本地 `clear`/`compact` 语义区分，作为第二命令源而非本地 handler） | 面 2：§2.2（renderer 预检 / main 权威 / 组装三处落点）、§2.7（`_ensureConversation` 收原始语法文本 → 标题正确）；Anti-Pattern 4（不得混入 `SLASH_COMMANDS`） |
| DISC-04 | 技能列表区分来源（user / managed / seeded）并以徽标展示；被遮蔽的同名技能可见 | 面 1：§1.2（条目字段全表）、§1.3（三档 `tier` 的组合点与 electron 边界实测） |
| DISC-05 | 模型可根据 description 自动匹配技能并读取其正文（经 `read` 工具读取 SKILL.md 的 location） | 面 3：§3.1（`tool_execution_start` 落点 + `read` 参数名是 `path`）、§3.2（路径规范化）、§3.4（D-18 措辞） |
| DISC-06 | 调用不存在的技能给出明确错误提示，不出现「点了没反应」 | 面 2：§2.8（错误协议 + 四种边界矩阵，含面板 Enter 优先语义导致的可达性分析） |
| DISC-07 | `disable-model-invocation` 的技能不进 system prompt 列表，但仍可经 `/skill:` 显式调用并在 UI 打标 | 面 1 §1.2（`disableModelInvocation` 字段 + 「仅显式」标记）、面 2 §2.8（显式调用放行判定与 `disabled` 严格区分） |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 技能集加载 / 去重 / 遮蔽 / 限额 / 定序 | **API / Backend（main 进程 `ai-skills-manager.js`）** | — | 46 D-06「优先级逻辑只在主进程一份」；renderer 无法知道磁盘真实状态（Anti-Pattern 5） |
| 三档来源 `tier` 计算 | **API / Backend（main）** | — | 需要 `builtin-skills-seeder.getSeededSkillNames()`（`skills-builtin/` 扫盘）与 `source` 联合判定，renderer 无此信息 |
| 面板数据投影（含超限/遮蔽/仅显式状态） | **API / Backend（main）** | — | 单一数据权威；renderer 只渲染（UI-SPEC「自绘边界」） |
| 面板过滤 / 分区渲染 / 键盘导航 | **Browser / Client（renderer）** | — | 交互态（输入框文本、焦点、activeIndex）只在 renderer；过滤是纯 UI affordance |
| `/skill:` 语法**预检**（决定 system-note） | **Browser / Client（renderer）** | API（main 权威复检） | 气泡必须在调用前建立（流式事件依赖 `state.aiCurrentMessageId`），故必须先本地判定；main 保留权威判定作为兜底 |
| `/skill:` 权威解析 / 实时读盘 / 增强消息组装 | **API / Backend（main `ai-manager.js`）** | — | D-19 契约（renderer 只发完整语法文本）；实时读盘需要 `sandboxEnv`，renderer 不持有 |
| 技能正文注入对话历史 | **API / Backend（main）** | — | 落库来源是 `agent.state.messages`（`ai-manager.js:2116`），renderer 的 `state.aiMessages` 不入库 |
| 用户气泡 pill + 技能正文折叠块 | **Browser / Client（renderer）** | API（内容随调用响应回传） | 纯渲染；D-09 的折叠内容由 main 在调用时读取后回传（保真「这次实际喂了什么」） |
| 重载路径的形状还原（`<skill>` → args + 折叠块） | **API / Backend（main）** | — | 重载走 `conversationStore.getMessages`，只有 main 有此数据；`<context-summary>` 已有同款先例（`ai-conversations-manager.js:641`） |
| `read` 卡片技能标记 | **API / Backend（main 工具事件生成侧）** | — | CONTEXT 明确「判据必须在工具事件生成侧」；renderer 不掌握技能目录权威路径 |
| 面板刷新触发 / Agent prompt 回写 | **API / Backend（main）** | — | `syncAgentSystemPrompt()` 需要 `sandboxEnv`；同时闭合 P8 失效链「`/` 面板列表」触发点 |

---

## 五条必须先知道的硬事实

> 这五条都**改变了实现方案**（不是「注意一下」级别）。每条都给了可复核的证据。

### 事实 1 —— `formatSkillInvocation` 缺 `content` 时静默产出 `undefined`

SDK 实现（源码直读）：

```js
// node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:9
const skillBlock = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${dirnameEnvPath(skill.filePath)}.\n\n${skill.content}\n</skill>`;
return additionalInstructions ? `${skillBlock}\n\n${additionalInstructions}` : skillBlock;
```

运行时探针（本机实测，`node` 直跑 SDK 包根 import）：

```
--- missing content ---
"<skill name=\"x\" location=\"/a/b/SKILL.md\">\nReferences are relative to /a/b.\n\nundefined\n</skill>"
```

**结论**：`skill.content` 是**必需**字段，缺失不会抛错、会把字面量 `undefined` 喂给模型。
调用前必须拿到**真实正文**（回到「实时读盘」约束），不得把「快照对象」以外的东西塞进去；
同时这解释了为什么「读盘失败」必须**在组装之前**判定并拒绝，而不是让 SDK 兜底。

[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:8-11（源码直读）+ 本机 `node` 探针输出]

### 事实 2 —— `executeActiveSlashCommand` 的 `rest` 取值在 `/skill:` 形态下吞掉 args

现状代码：

```js
// src/renderer.js:9816
const rest = value.slice(1 + cmd.name.length).replace(/^\S*/, '').trim();
```

`node` 实测（本机，7 组输入）：

| 输入框文本 | 选中项 name | 现状 `rest` | token 取值法 `rest` |
|---|---|---|---|
| `/skill:find 帮我找 X` | `find-skills` | **`X`**（丢「帮我找 」） | `帮我找 X` |
| `/skill:fin 帮我找 X` | `find-skills` | **`X`** | `帮我找 X` |
| `/skill:find-skills 帮我找 X` | `find-skills` | `帮我找 X` | `帮我找 X` |
| `/fin 帮我找 X` | `find-skills` | **``**（args 全丢） | `帮我找 X` |
| `/skill:fi 帮我找 X` | `find-skills` | **`X`** | `帮我找 X` |
| `/cle x` | `clear` | **``**（既有 bug） | `x` |
| `/compact 重点保留登录` | `compact` | `重点保留登录` | `重点保留登录` |

只有「输入 token 长度恰好等于选中项名长度 + 1」时才正确 —— 这是巧合，不是语义。
**`/skill:` 是本阶段的主用法且前缀几乎总是短于技能名**（`skill:find` 10 字符 vs `find-skills` 11 字符），
所以现状代码在**主要路径上就错**。修法（纯函数、可表驱动测试）：

```js
const token = value.slice(1).split(/\s/)[0];          // 斜杠后、首个空白前的完整 token
const rest  = value.slice(1 + token.length).trim();   // token 之后的剩余文本
```

该修法对 7 组输入全部给出正确值，且对既有命令语义零变化（`/compact 重点…` 逐字节相同）。
**这是 D-04「args 取输入框里命令名之后的剩余文本」的正确实现**，不是偏离。

[VERIFIED: src/renderer.js:9816（源码直读）+ 本机 `node -e` 表驱动实测输出]

### 事实 3 —— D-12 的「超预算未进提示词」在数据层**没有**对应字段

`refreshSkills()` ⑦ 的现行实现只截断 promptBlock，不给被丢弃条目打标记：

```js
// ai-skills-manager.js:585-596
const eligible = _cache.skills.filter(
  (e) => !e.shadowed && !e.disabled && !e.overLimit && e.skill.disableModelInvocation !== true
);
const kept = [];
let used = fixedOverhead;
for (const e of eligible) {
  const cost = entryCost(e.skill);
  if (used + cost > LIMITS.SKILLS_PROMPT_CHAR_BUDGET) break;
  kept.push(e.skill);
  used += cost;
}
```

`break` 之后的所有 `eligible` 条目都是「被预算丢弃」，但条目上**没有任何字段**记录这件事；
只有模块级诊断 `realm_prompt_budget_exceeded`（`:601-607`）带 `limit` / `currentValue`。
而 D-12 要求面板逐行标注「未进提示词 · 超预算」。

**两种做法，只有一种合规**：

- ❌ 在 renderer 重算贪心循环 → 违反单一数据权威（且 renderer 拿不到 `entryCost`）。
- ✅ 在 `ai-skills-manager.js` ⑦ 里补条目级字段（建议 `promptOmitted = true`），
  由 main 投影后交给 renderer 渲染。

`promptOmitted` 不必进 `computeDigest()`：任何使 `promptOmitted` 变化的输入都会改变
`eligible.length` / `kept.length` → 改变省略提示行 → `promptBlock` 变化 → digest 变化。
（`computeDigest` 的输入已在 `ai-skills-manager.js:91-104` 明文列出，`prompt:${promptBlock}` 是其一。）

[VERIFIED: ai-skills-manager.js:576-611（源码直读，⑦ 全段）+ :91-104（digest 输入清单）；`:601-607` 诊断码 `realm_prompt_budget_exceeded`]

### 事实 4 —— `getSeededSkillNames()` 在纯 Node 进程里**抛 TypeError**

源码：

```js
// builtin-skills-seeder.js:60-70
function resolveBuiltinSkillsSrc() {
  if (_srcDirOverride) return _srcDirOverride;
  const { app } = require('electron');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'skills-builtin');
  }
  return path.join(__dirname, 'skills-builtin');
}
```

本机实测（纯 Node，仓库根）：

```
THREW: TypeError Cannot read properties of undefined (reading 'isPackaged')
```

原因：非 Electron 的 Node 进程里 `require('electron')` 返回**字符串**（二进制路径），解构出的 `app` 是 `undefined`。
`getSeededSkillNames()` 只 `try/catch` 了 `readdirSync`，**没有**兜住这个 throw。

**对本阶段的两个直接后果**：

1. **生产（Electron main）无影响** —— `main.js:140` 已经 require 该模块、`:4048` 已调 `seedBuiltinSkills()`。
2. **纯 Node 测试必须注入** —— 任何在 `tests/*.js` 里走到 `getSeededSkillNames()` 的断言，
   必须在调用前 `seeder.setBuiltinDepsForTest({ srcDir: <真实 skills-builtin 绝对路径> })`
   （`builtin-skills-seeder.js:526`）否则整组断言以 TypeError 失败，而非断言失败。
   `tests/test-builtin-skills-seeder.js:368` 是这个注入的既有先例。

**建议（供 plan 期决定是否收进本阶段）**：给 `getSeededSkillNames()` 加 fail-safe（`resolveBuiltinSkillsSrc()`
包 try/catch → 返回 `[]`），因为该模块自述契约是「任何失败仅 console.error + 产诊断，**不 throw**、不阻断应用启动」
（`builtin-skills-seeder.js:20-24`）。若不加，则 UI 投影侧必须自己 try/catch 并降级
（降级口径：seeded 集合视为空 → 内置技能会被标成「托管」，属**错标**；至少应 `console.warn`）。

[VERIFIED: builtin-skills-seeder.js:60-70 / :92-111 / :526（源码直读）+ 本机 `node -e` 实测 TypeError]

### 事实 5 —— `getSkillsSnapshot()` 的 `skill` 对象带全文正文，面板必须做收窄投影

`loadSkillFromFile` 的返回（SDK 源码）：

```js
// node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:226-233
return {
    skill: {
        name,
        description,
        content: body,
        filePath,
        disableModelInvocation: frontmatter["disable-model-invocation"] === true,
    },
    diagnostics,
};
```

`refreshSkills()` 全程不改 `entry.skill`（只重写 `name`），所以 `_cache.skills[i].skill.content`
**是完整正文**，而 `getSkillsSnapshot()` 是浅拷贝（`ai-skills-manager.js:648-655`），
`content` 一并带出。

**后果**：如果 IPC 直接 `return getSkillsSnapshot()`，一次面板打开会把 ≤ 50 × 64 KiB（最坏 ~3 MB）
正文送进 renderer —— 既浪费又毫无用途（面板不显示正文）。
**必须在 main 侧做投影**，只送面板需要的字段（见 §1.2）。

> 注意：`content` 的存在**不等于**可以拿它当注入源 —— 它是 `refreshSkills()` 时刻的冻结快照，
> 违反用户 2026-09-11 的「调用瞬间从磁盘读取」硬要求（`STATE.md:223`）。两条路径语义必须显式分开。

[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:226-233 + ai-skills-manager.js:648-655（源码直读）]

---

## 面 1 — `/` 面板并入技能列表

### 1.1 既有实现的准确现状（file:line）

| 位置 | 内容 | 本阶段动作 |
|------|------|-----------|
| `src/renderer.js:334-337` | 本地命令注册表 `SLASH_COMMANDS` | **零改动**（Anti-Pattern 4：不得把技能 push 进来） |
| `src/renderer.js:280-282` | `state.slashPickerOpen` / `slashPickerItems: []` / `slashPickerActiveIndex: 0` | 新增 `state.aiSkills`（投影缓存）与可选 `state.slashPickerSelectable` |
| `src/renderer.js:9768-9802` | `handleAIInputKeydown`：↑↓ 取模循环 / Enter 执行 / Esc 关闭 | 改为「在可选中索引集合上取模」 |
| `src/renderer.js:9810-9826` | `executeActiveSlashCommand`：`rest` 取值 + 清空输入框 + `cmd.handler(rest)` | 修 `rest`（事实 2）+ 按 `kind` 分流 |
| `src/renderer.js:9900-9955` | `renderSlashPickerList`：单数组 `items.map(...)` + `innerHTML` + `data-cmd` 点击 + `mousemove` | 分组标题 + 五要素行 + `data-index` 绑定 |
| `src/renderer.js:9914` | 空态文案 `无匹配命令，输入 / 查看全部` | 改为 UI-SPEC 文案（`无匹配技能或命令，输入 / 查看全部`） |
| `src/renderer.js:9867-9873` | `handleAIInputAutoResize` 的 `/` 触发 | **零变化** |
| `src/renderer.js:8673-8691` | `handleSendAIMessage` 斜杠拦截（本地命令优先 / 未知命令提示） | 中间插入技能分支 |
| `src/renderer.js:4389` | `handleAIStream()` 调用点（AI 事件监听挂载处） | 同处新增 `skills:changed` 监听 |
| `src/index.html:861-863` | `#slashPickerPanel` / `#slashPickerList` | 无结构改动（分组标题由 JS 生成）；新增一个 `<script src="skill-picker-model.js">`（见 Validation Architecture） |
| `src/styles/main.css:6973-7019` | `.slash-picker-panel`（`max-height: 220px` / `overflow-y: auto`）/ `.slash-picker-row` / `-name` / `-desc` | 新增 `.slash-picker-group-header` / `-source-badge` / `-tag-explicit` / `-status` + 4 个色令牌（两主题块） |

**`.slash-picker-list` 在 main.css 里没有规则**（本机 grep 确认：`NO .slash-picker-list rule in main.css`）——
所以 UI-SPEC 的 sticky 硬约束（中间不得出现 `overflow:hidden/auto` 包裹元素）当前**天然成立**；
新增分组渲染时**不得**给 `#slashPickerList` 或其包裹层加 overflow。

[VERIFIED: src/renderer.js:280-282/334-337/8673-8691/9768-9826/9900-9955、src/index.html:861-863、src/styles/main.css:6973-7019（均本会话 Read 直读）；`.slash-picker-list` 无规则为 grep 全文件确认]

### 1.2 技能条目字段全表（含**缺口**）

数据层条目形状（`ai-skills-manager.js:48-61` 的注释 + 各赋值点）：

| 字段 | 来源 | 现值 | 面板是否需要 | 备注 |
|------|------|------|-------------|------|
| `skill.name` | D-08 目录名权威重写（`:323-335`） | 恒等于目录名 | ✅ | 唯一键（遮蔽后） |
| `skill.description` | frontmatter | 非空（不可用者已跳过） | ✅ | 需 `escapeHtml` |
| `skill.filePath` | SDK | 绝对路径 | ❌ | main 侧匹配用 |
| `skill.content` | SDK | **完整正文** | ❌（投影必须剔除） | 事实 5 |
| `skill.disableModelInvocation` | frontmatter `disable-model-invocation === true` | bool | ✅ | D-02「仅显式」 |
| `source` | 扫描根（`managed` / `user`） | `'user' \| 'managed'` | ✅（派生 tier） | |
| `diagnostics[]` | 条目级诊断 | array | ❌（Phase 50） | D-02 明确不显示 |
| `shadowed` / `shadowedBy` | `applyShadowing`（`:353-374`） | bool / `'user'` | ✅ | D-11 灰显 |
| `disabled` | ⑤（`:557-560`） | bool | ✅ | D-10 |
| `overLimit` | ⑥（`:564-566`，仅 **user** 来源） | bool | ✅ | D-12 数量上限 |
| **`promptOmitted`** | **不存在** | — | ✅ | **本阶段必须新增**（事实 3） |

**新增字段的注入点**（事实 3 的具体落点）：`ai-skills-manager.js` ⑦ 内，`const kept = []` 循环结束后：

```js
// ⑦ 尾部（新增）—— 与 overLimit 同款「标记不剔除」
for (const e of eligible.slice(kept.length)) e.promptOmitted = true;
```

判定边界（必须与 ⑦ 的 `eligible` 过滤条件**完全一致**）：
`shadowed` / `disabled` / `overLimit` / `disableModelInvocation === true` 的条目**不是** `promptOmitted`
（它们有各自的状态标注，D-02 / D-10 / D-11 / D-12 分别覆盖）。

### 1.3 三档来源徽标（`tier`）的组合点 —— 决策与理由

**判定口径（D-14，本阶段只消费）**：

| tier | 判据 | 徽标文字 |
|------|------|---------|
| `user` | `entry.source === 'user'` | 用户 |
| `builtin` | `entry.skill.name ∈ getSeededSkillNames()` | 内置 |
| `managed` | `entry.source === 'managed'` 且非 seeded | 托管 |

**electron 边界问题（CONTEXT 提出的关键裁量项）**：`builtin-skills-seeder.js` 顶层
`require('./agent-workspace')`（安全，后者 electron 惰性），但 `getSeededSkillNames()` →
`resolveBuiltinSkillsSrc()` 会**直接** `require('electron')`（事实 4，纯 Node 抛错）；
而 `ai-skills-manager.js` 的模块自述纪律是「**不得**有 electron 依赖……纯 Node 环境下可直接加载与测试」
（`ai-skills-manager.js:18-20`）。

**推荐落点：`ai-manager.js`（main 进程），seeded 集合作为入参注入给 manager。**

理由（三条，均为既有先例）：

1. **注入式先例已存在且方向一致**：`ai-skills-manager.refreshSkills(env, { disabled, rootDirs })`
   的 `rootDirs` 就是由 `ai-manager` 经 `getAgentWorkspaceLazy().getManagedSkillsDir()/getSkillsDir()`
   注入的（`ai-manager.js:848-855`、`:2576-2583`）——manager **自己从不解析路径**。
   `seededNames` 用同款注入，零新架构。
2. **`ai-manager.js` 已经是 `agent-workspace` 的依赖方**，再惰性 require `builtin-skills-seeder`
   不引入任何新的 electron 类风险（`main.js:140` 已在用），且只在**真正取 UI 投影时**调用
   （惰性函数，同 `getAiSkillsManagerLazy()` 的形式，`ai-manager.js:114-117`）。
3. **`ai-skills-manager.js` 保持零 electron 依赖**，其既有模块级测试
   （`tests/test-ai-skills.js`，纯 Node）无需为徽标引入 electron 桩。

**落地形状**（`ai-skills-manager.js` 新增两个纯函数 + 一个投影函数）：

```js
/**
 * 三档来源 tier（D-14）—— 消费既有判定，不重新定义
 * @param {{skill:{name:string}, source:string}} entry
 * @param {Set<string>|string[]} seededNames - 由调用方注入（ai-manager 经 builtin-skills-seeder 取得）
 * @returns {'user'|'builtin'|'managed'}
 */
function sourceTierOf(entry, seededNames) {
  if (entry.source === 'user') return 'user';
  const seeded = seededNames instanceof Set ? seededNames : new Set(seededNames || []);
  return seeded.has(entry.skill.name) ? 'builtin' : 'managed';
}

/** 面板投影（剔除 content / diagnostics / filePath；只送渲染需要的字段） */
function toUISkillEntry(entry, seededNames) {
  return {
    name: entry.skill.name,
    description: entry.skill.description,
    tier: sourceTierOf(entry, seededNames),
    disableModelInvocation: entry.skill.disableModelInvocation === true,
    disabled: entry.disabled === true,
    shadowed: entry.shadowed === true,
    shadowedBy: entry.shadowed ? entry.shadowedBy : undefined,
    overLimit: entry.overLimit === true,
    promptOmitted: entry.promptOmitted === true,
  };
}

/** 列表读盘口（面板数据源） */
function getSkillsForUI(seededNames) {
  return {
    skills: _cache.skills.map((e) => toUISkillEntry(e, seededNames)),
    refreshedAt: _cache.refreshedAt,
    digest: _cache.digest,
  };
}
```

**命名警告（必须写进代码注释与产品文档）**：UI-SPEC 把该字段写作 `skillInvocation.source`，
其**取值是 tier**（`'user' | 'builtin' | 'managed'`），而数据层的 `source` 只有
`'user' | 'managed'`（seeded 也是 `'managed'`）。两个 `source` 语义不同、取值域不同，
**强烈建议在投影与事件里改用 `tier` 字段名**，否则 `source: 'builtin'` 会被读成数据层字段而产生误判。
（该命名属 plan 期可实现决策；如坚持沿用 `source`，必须在 JSDoc 与产品文档双处显式声明「此 source 非彼 source」。）

**备选落点（不推荐，附理由）**：
- 放在 `builtin-skills-seeder.js`：该模块职责是**写**（播种），把读侧 tier 塞进去会让「播种者」变成
  「徽标权威」，且它在纯 Node 里抛错（事实 4）会把 UI 投影一起拖死。
- 放在 renderer：renderer 拿不到 `skills-builtin/` 目录（且违反 Anti-Pattern 5）。

### 1.4 新增 IPC / realmAPI 通道

命名沿用既有 `ai:*` kebab 风格（`ai:prompt-with-context` / `ai:get-models` / `ai:get-state` / `ai:get-context-usage`）：

| 通道 | 方向 | 载荷 | 返回 | 语义 |
|------|------|------|------|------|
| `ai:get-skills` | invoke | 无 | `{ skills: UISkillEntry[], refreshedAt: number, digest: string }` | **同步快照投影**，零 IO（`getSkillsSnapshot()` 直读 `_cache`）→ D-17「立即渲染」半边 |
| `ai:refresh-skills` | invoke | 无 | 同上（刷新后） | **异步重扫**：走 `aiManager.syncAgentSystemPrompt()`（见 §1.7），完成后回投影 |

`ipc-handlers.js` 两处**必须** `assertTrustedSender(event)`（既有 AI 通道的既有做法，`:1681`）。
`src/preload.js` 在 `ai: {` 命名空间（`:975`）下新增：

```js
getSkills: () => ipcRenderer.invoke('ai:get-skills'),
refreshSkills: () => ipcRenderer.invoke('ai:refresh-skills'),
```

**为什么不走 `/api/skills/*`**：主窗口是 `file://`，fetch 本地 HTTP 会被 CORS 拦（Phase 38 事故；
`AGENTS.md`「数据访问分层约定」）。`/api/skills/*` 是 Phase 50 给 `realm://settings` guest 用的，
本阶段不建。

**为什么用两个通道而不是一个带 `refresh` 参数**：D-17 的 stale-while-revalidate 语义要求
「立即渲染」与「后台刷新」是**两次独立调用**（先快照后刷），合成一次会让首次渲染等异步重扫，
违背「零延迟」。UI-SPEC 明确「**不显示骨架屏 / spinner / 加载中占位**」。

### 1.5 展平单数组 + 分区 + 索引模型（防索引漂移）

**不变式（D-01 + UI-SPEC 展平不变式）**：`state.slashPickerItems` 是**展平单数组**，
且**数组顺序 = 视觉渲染顺序**；分组标题只在渲染层插入，**不占索引**。

```js
// 展平顺序（唯一权威）
state.slashPickerItems = [
  ...skillsSection,    // 顺序：「技能」分区 = bySkillPriority 已定序的投影，按 D-03 两档重排
  ...commandsSection,  // 顺序：SLASH_COMMANDS 原序（零变化）
];
```

`state.slashPickerItems[i]` 的统一形状（`kind` 判别字段 → 满足 ARCHITECTURE Anti-Pattern 4 的「执行层分流」）：

```js
// 命令项
{ kind: 'command', name, description, takesArg, handler }
// 技能项
{ kind: 'skill', name, description, tier, disableModelInvocation, selectable, statusText, statusTone }
```

**可选中性（UI-SPEC 由 D-11 推导）**：`selectable === false` 的情形有两种，均来自 main 提供的字段：
- `shadowed === true` → `statusText = '已遮蔽 · 由用户同名技能胜出'`
- `SLASH_COMMANDS.some(c => c.name === name)` → `statusText = '与本地命令同名 · 本地命令优先'`（**纯名字集合查询**，不重定义任何优先级）

`state.slashPickerSelectable = items.map((it, i) => it.selectable ? i : -1).filter(i => i >= 0)`。
导航与高亮**只在 `slashPickerSelectable` 上取模**：

```js
// handleAIInputKeydown（改）
const sel = state.slashPickerSelectable;
if (sel.length === 0) { state.slashPickerActiveIndex = -1; /* 不消费按键 */ }
else {
  const pos = sel.indexOf(state.slashPickerActiveIndex);
  const next = (pos < 0 ? (delta > 0 ? 0 : sel.length - 1) : (pos + delta + sel.length) % sel.length);
  state.slashPickerActiveIndex = sel[next];
  renderSlashPickerList();
}
```

- 全部不可选中 → `activeIndex = -1`，Enter 回落 `executeActiveSlashCommand()` 返回 `false` 的既有路径
  （→ `handleSendAIMessage()` 的斜杠分支），**不新增分支、不新增空态文案**（UI-SPEC）。
- `mousemove` 命中不可选中行**不改** `activeIndex`（`.active` 不落在灰显行上）。

**⚠ 必须同时修的既有绑定 bug（本阶段引入分区后才会真炸）**：

```js
// src/renderer.js:9932-9944（现状）
list.querySelectorAll('.slash-picker-row[data-cmd]').forEach(row => {
  row.addEventListener('click', () => {
    const idx = items.findIndex(c => c.name === row.dataset.cmd);   // ← 按 name 反查
```

`findIndex(c => c.name === ...)` 在**同名两行**（技能名 = 本地命令名，UI-SPEC 明确该状态会同时渲染）
存在时**永远命中第一行**（技能行）→ 点击「命令」分区里的 `/clear` 会执行技能行。
**改为索引直绑**：`data-index="${index}"` + 点击时 `Number(row.dataset.index)`。
这同时消除「name 重复 / name 含特殊字符进 HTML 属性」两个隐患。

**索引漂移的实测项（CONTEXT 待实测项）结论：不会漂移，只要满足两条**：
① 展平数组顺序 = 渲染顺序（同一变量生成，见上）；② 索引绑定走 `data-index` 而非 name 反查。
唯一真实风险是 `renderSlashPickerList` 被重入（异步 `refreshSkills` 回来后重渲染）时
`activeIndex` 越界 —— 既有守卫 `if (state.slashPickerActiveIndex >= items.length)`（`:9909-9911`）
必须扩展为「收敛到最近的**可选中**索引」（否则越界后停在不可选中行上）。

### 1.6 过滤与 `/skill:` 前缀 token

**分区顺序（UI-SPEC）**：「技能」在上、「命令」在下；D-03 的排序**在各自分区内**生效。

```js
// 过滤（纯函数，见 Validation Architecture）
const filter = value.slice(1).split(/\s/)[0].toLowerCase();       // 既有语义，零变化
const q = filter.startsWith('skill:') ? filter.slice(6) : filter; // /skill:<q> 前缀直接分流
// 技能分区：name 前缀命中（.startsWith(q)）在前，description 子串命中（.includes(q)）在后
// 命令分区：c.name.startsWith(filter) —— 逐字节沿用既有语义（注意用的是 filter 不是 q）
// 过滤为空（filter === ''）→ 全部技能进「前缀命中」档，description 档为空
// 某分区 0 项 → 该分区标题整个不输出（D-01）
```

- **`/skill:` 作为过滤 token 的处理**（CONTEXT 明确「不为它单列决策、按实现决定」）：
  上面的 6 字符剥离是**最小实现**——输入 `/skill:fo` → 技能分区按 `fo` 前缀过滤，
  命令分区按 `skill:fo` 前缀过滤（命中 0 项 → 标题不渲染）→ 视觉上等价于「只显示技能」，
  正是 `FEATURES.md:222` 记录的第三条立项理由。**不新增文案、不新增分支**。
- 描述命中**不做高亮**（UI-SPEC：不引入 mark 样式）。
- 过滤档位与 `bySkillPriority` 的关系：前缀档内保持投影原序（即 `bySkillPriority` 全序），
  **禁止**改用 `localeCompare`（46 已建立「跨机字节序一致」先例）。

### 1.7 `skills:changed` 监听与 stale-while-revalidate（P8 触发点闭合）

**现状**：`ai-manager.js:2541` 的 `windowManager.broadcast('skills:changed')` —— **无 payload**；
`window-manager.js:310` 的 `broadcast(channel, ...args)` 广播给**全部未销毁窗口**；
renderer 侧**零监听**（本机 grep 确认 `skills:changed` 只出现在 `ai-manager.js:2541`）。

**面板打开链路（D-17）**：

```
openSlashPicker()
  ├─ 1. 立即用 state.aiSkills（内存投影）渲染        ← 零延迟，无 loading 态
  └─ 2. 后台：await realmAPI.ai.refreshSkills()
            → main: syncAgentSystemPrompt()          ← 见下
            → 返回新投影 → 原地 renderSlashPickerList()
  └─ 3. 常驻：onIpcMessage('skills:changed', () => { if (面板打开) refreshProjectionOnly() })
```

**关键设计点（本阶段的 P8 收口方式）**：后台刷新**直接调 `aiManager.syncAgentSystemPrompt()`**，
而不是裸调 `refreshSkills()`。理由有三：

1. `syncAgentSystemPrompt()`（`ai-manager.js:2512-2541`）内部已经是
   「`refreshSkills()` → digest/逐字符比对 → 改写 `agent.state.systemPrompt` → `broadcast('skills:changed')`」
   的完整链路 —— 它正是 P8 失效链「`/` 面板列表」触发点需要的**同一件事**
   （改了盘面 → 面板要新、模型也要新；只刷面板会让面板与 prompt 分叉）。
2. 它顺带解决 `STATE.md:222`「`syncAgentSystemPrompt()` 无生产调用方」——**48 的无写路径不等于无刷新路径**：
   面板打开触发的重扫 + 回写 + 广播让该函数在 48 就获得生产调用方，
   剩下未闭合的是 49/50/51 的**写**路径（`manage_skill` / 启停卸载 / 导入）。（CONTEXT 要求「如实写明，避免声称 6 点全覆盖」——
   准确表述是：**48 让 `syncAgentSystemPrompt()` 有了生产调用方，但它被调用的是「重扫 + 回写」语义，
   不是「写成功后回写」语义**；P8 的写路径半边仍归 49/50/51。）
3. 一次性完成、无重复扫描（不要既调 `refreshSkills()` 又调 `syncAgentSystemPrompt()`）。

**⚠ 硬约束（会打红既有测试）**：**不得重构 `syncAgentSystemPrompt()` 的函数体**。
`tests/test-ai-skills.js:1278-1296` 是**方法体源码扫描**断言，逐条要求函数体内出现
`refreshSkills(`、`this.agent.state.systemPrompt = next`、`windowManager.broadcast('skills:changed')`、
`this._skillsPromptDirty = true`、`snap.digest === this._skillsPromptDigest`。
把回写拆成私有 helper 会让这五条一起变红。

**早退边界（必须如实处理，不能假装不存在）**：`syncAgentSystemPrompt()` 开头
`if (!this.agent || !this.sandboxEnv) return;` —— AI 未初始化时**不刷新**，面板拿到旧投影。
此时 `sandboxEnv` 也为 null（两者同在 `init()` 里赋值，`ai-manager.js:845-848`），
**根本没有任何可用的读盘环境**，因此「降级为不刷新」是唯一诚实行为（面板显示上次投影）。
必须在代码注释与产品文档写明这条边界，**不要**为它发明第二套刷新路径。

**广播 payload（Claude's Discretion）→ 建议保持无参**。理由：面板收到广播后只需重拉投影，
`ai:get-skills` 返回的 `digest` 已足够让 renderer 自行短路（`if (next.digest === state.aiSkillsDigest) return;`），
加 payload 会把「变更摘要」的定义搬到广播侧（第二处权威）。**并且**：响应 `skills:changed` 时
**只重拉快照、不得再触发 `refreshSkills()`**（否则形成 广播 → 刷新 → 再广播 的自激回路）。

**节流建议（可选，非必需）**：`refreshSkills()` 是完整重扫（每个技能目录一次 `listDir` + 一次 `readTextFile`，
50 技能 ≈ 100 次沙箱 IO）。面板反复开关会重复重扫；可用 `refreshedAt` 做 1–2 秒节流，
或仅在 `digest` 变化时重渲染。**若不做，也不违反任何锁定决策**——记为 plan 期可选优化。

### 1.8 渲染转义（新增 XSS 面）

`renderSlashPickerList` 用 `innerHTML` 模板拼接（`:9917-9925`），现状数据源是**代码里的常量**
（`SLASH_COMMANDS`），天然安全。本阶段把**磁盘来源**的技能名与 description 塞进同一模板 —— 这是
本阶段新增的唯一注入面（技能文本可来自 GitHub 导入，Phase 51 会放大该面）。

- **必须**用 `escapeHtml`（既有实现：`src/renderer.js:10834`）包裹 `{name}` / `{description}` / `statusText`。
- `title` 属性同样要转义（`title="/skill:{name} 可显式调用"`）。
- `read` 卡片技能化侧：`renderToolCard` 的既有做法是 `textContent`（T-21-03 缓解，`src/renderer.js:9245-9265`），
  新增的 `.tool-card-name-skill` / `.tool-card-name-text` / 徽标**必须同样走 `textContent`**，
  不得为「加徽标」退回 `innerHTML`。
- 徽标 tier → 类名映射走**白名单查表**（`{user:'...', builtin:'...', managed:'...'}`），
  不把 tier 值直接拼进 class（避免 `class="...${tier}"` 形态的拼接注入面）。

---

## 面 2 — `/skill:name [args]` 显式调用

### 2.1 SDK `formatSkillInvocation` 源码级事实

**类型定义**（`.d.ts`，源码直读）：

```ts
// node_modules/@earendil-works/pi-agent-core/dist/harness/skills.d.ts:14-15
/** Format a skill invocation prompt, optionally appending additional user instructions. */
export declare function formatSkillInvocation(skill: Skill, additionalInstructions?: string): string;
```

**`Skill` 接口（五字段，本会话直读）**：

```ts
// node_modules/@earendil-works/pi-agent-core/dist/harness/types.d.ts（Skill 接口全段）
export interface Skill {
    /** Stable skill name used for lookup and model-visible listings. */
    name: string;
    /** Short model-visible description of when to use the skill. */
    description: string;
    /** Full skill instructions. */
    content: string;
    /** Absolute path to the skill file. Used for model-visible location and resolving relative references. */
    filePath: string;
    /** Exclude this skill from model-visible skill lists while still allowing explicit application invocation. */
    disableModelInvocation?: boolean;
}
```

**实现与实测输出（本机探针，非转述）**：

```js
// node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:8-11
export function formatSkillInvocation(skill, additionalInstructions) {
    const skillBlock = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${dirnameEnvPath(skill.filePath)}.\n\n${skill.content}\n</skill>`;
    return additionalInstructions ? `${skillBlock}\n\n${additionalInstructions}` : skillBlock;
}
```

```
--- no instructions ---
"<skill name=\"find-skills\" location=\"/tmp/ws/skills/find-skills/SKILL.md\">\nReferences are relative to /tmp/ws/skills/find-skills.\n\n# 正文\n\nbody line\n</skill>"
--- with instructions ---
"<skill name=\"find-skills\" location=\"/tmp/ws/skills/find-skills/SKILL.md\">\nReferences are relative to /tmp/ws/skills/find-skills.\n\n# 正文\n\nbody line\n</skill>\n\n用户显式调用了技能「find-skills」\n\n帮我找 X"
```

**由输出形态可直接确定的四条实现结论**：

1. **`additionalInstructions` 是唯一的 args 通道**（SDK 不做任何占位符替换）——
   D-05 的「provenance 一行 + args 原文」用**一次调用**即可完成：
   `formatSkillInvocation(skill, [provenance, args].filter(Boolean).join('\n\n'))`
   → 产出 `</skill>\n\n<provenance>\n\n<args>`（与探针输出逐字节一致）。
2. **`<skill>` 块的正文边界是确定可解析的**：`<skill ...>` 后紧跟一行
   `References are relative to <dir>.`，再一个空行，然后是正文，最后 `\n</skill>`。
   这是**重载路径还原折叠块**（§2.6）的解析依据 —— 而且该形态由 SDK 固定，不是 Realm 自造。
3. **引导提示行 `References are relative to <dir>.` 属于块内、但不属于 `skill.content`** ——
   D-09 / UI-SPEC 的 `技能正文（N 字符）` 里 N = `skill.content.length`，
   **不含**这一行、不含 `<skill>` 标签、不含 provenance、不含 args。
4. **`formatSkillInvocation` 是 SDK 包根的具名导出**（`export * from "./harness/skills.ts"` 经 `dist/index.js:15`），
   与 `loadSkills` / `loadSourcedSkills` / `formatSkillsForSystemPrompt` 同款动态 import 取得
   （`ai-skills-manager.js:482-483` 是既有先例）。

> **附注（避免误读 `FEATURES.md:222`）**：SDK **有**字符串替换能力，但属于**另一套类型** ——
> `PromptTemplate` + `substituteArgs` / `formatPromptTemplateInvocation`（`dist/harness/prompt-templates.js`）。
> `Skill` 路径**完全不做**替换。Realm 不使用 `PromptTemplate`，本阶段也不引入（ECO-04 deferred）。

[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.d.ts:14-15、skills.js:8-11、types.d.ts（Skill 接口）、index.d.ts:13 / index.js:15（导出链）、prompt-templates.js（substituteArgs 属 PromptTemplate）；输出形态为本机 `node` 探针实测]

### 2.2 三处落点：renderer 预检 / main 权威解析 / main 组装

**为什么必须有 renderer 预检**（不能全部交给 main）：流式事件在 IPC 响应之前到达 ——
`promptWithContext()` 内部 `await this.agent.prompt(...)` + `await this.agent.waitForIdle()`
（`ai-manager.js:1234-1236`）意味着 **run 全程在 IPC handler 的 await 之内**；
而 renderer 的 `handleAIStream` 用 `state.aiCurrentMessageId` 定位气泡（`:9015-9019`）。
若气泡在 IPC 返回后才建立，**整段回复会被丢弃**（事件找不到宿主消息）。
因此气泡必须先建 → 必须先本地判定「技能存在且未禁用」。

**三处落点与职责**：

| # | 位置 | 职责 | 判定依据 |
|---|------|------|---------|
| 1 | `src/renderer.js` `handleSendAIMessage()` 斜杠分支（`:8673-8691` 之间插入） | **预检**：本地命令优先（D-04）→ `/skill:` 或裸名解析 → 查 `state.aiSkills` → 不存在/禁用则 `pushSystemNote` + `return`（**零气泡**） | renderer 内存投影（面板打开时刚刷新过 + `skills:changed` 同步） |
| 2 | `ai-manager.js` `prompt()` / `promptWithContext()` 共享私有 helper | **权威解析**：从完整语法文本解析 name/args → 查缓存（胜出者）→ 判 `disabled` → **实时读盘** → 组装 | `ai-skills-manager` 缓存 + 磁盘 |
| 3 | 同上，`:1229-1232` 附近 | **组装**：把技能块置增强消息最前（D-07） | — |

**main 侧解析规则（权威，即「完整语法文本」的正式文法）**：

```js
/**
 * 解析显式技能调用（D-19 的权威解析）
 * 文法（D-04：显式语法与裸名都识别，本地命令优先由 renderer 侧保证，main 不再判本地命令）：
 *   /skill:<name>[ <args>]   —— name = ':' 后、首个空白前，必须匹配 ^[a-z0-9-]+$
 *   /<name>[ <args>]         —— name = 首个空白前（**严格前缀 + 空白边界**，与既有
 *                               `text === '/'+name || text.startsWith('/'+name+' ')` 同款）
 * @returns {{name: string, args: string, syntax: 'skill-colon'|'bare'} | null}
 */
function parseSkillInvocationText(text) {
  if (typeof text !== 'string' || !text.startsWith('/')) return null;
  const token = text.slice(1).split(/\s/)[0];
  if (!token) return null;
  const rest = text.slice(1 + token.length).trim();      // ← 与 renderer 的 token 取值法同源（事实 2）
  if (token.startsWith('skill:')) {
    const name = token.slice(6);
    return /^[a-z0-9-]+$/.test(name) ? { name, args: rest, syntax: 'skill-colon' } : null;
  }
  return { name: token, args: rest, syntax: 'bare' };
}
```

**D-04 边界语义（不得退化）**：裸名必须是「严格前缀 + 空白边界」——
`/foo` 与 `/foo args` 命中，`/foobar` **不得**命中 `foo`。`split(/\s/)[0]` 的 token 取值天然满足该语义
（token 整体比较），且它同时修掉事实 2 的 args 吞字符问题。**必须**写成纯函数 + 表驱动测试
（正例 `/foo`、`/foo x`；反例 `/foobar`、`/foo-bar` 对 `foo`、`/skill:foo`、`/Skill:foo`）。

**renderer 侧判定顺序（与主进程一致，逐条对应 D-04/D-10/D-13）**：

```
text.startsWith('/') →
  1. SLASH_COMMANDS 严格前缀 + 空白边界命中？ → 本地 handler（逐字节不变）      [D-04 本地优先]
  2. parseSkillInvocationText(text) 命中？
       a. 按 name 在 state.aiSkills 里找（含 disabled 条目）：
            - 未找到                       → system-note「未找到技能「name」，输入 / 查看可用技能」  [D-13]
            - found.disabled === true      → system-note「技能「name」已被禁用，可在 设置 → AI → 技能管理 重新启用」 [D-10]
            - found.shadowed === true      → **不可达**（name 唯一性，46 D-08：败者与胜者同名，
                                             查找按 name 必然取到胜出者；见 §2.8 边界矩阵）
            - 否则                          → 记录 skillInvocation 元数据，**落入正常发送流程**（不 return）
  3. 两边都不命中 → system-note「未知命令 /foo，输入 / 查看可用技能与命令」        [D-13]
```

**注意 2.a 的实现约束**：`state.aiSkills` **必须包含已禁用条目**（带 `disabled` 标记），
否则 renderer 无法区分「未找到」与「已禁用」，D-10 / D-13 的两条不同文案会退化成一条。
「面板隐藏」由 renderer 在**构建面板行时**过滤 `disabled === true`（仍只是消费 main 给的布尔，不是重新判定）。
（若 plan 期更倾向 payload 洁净，也可改为 `{ skills, disabledNames }` 双字段；两种都可，
但**必须**能在 renderer 侧区分这两个状态。）

### 2.3 实时读盘的读取口（硬约束的落地）

**约束原文**（`STATE.md:223`）：`/skill:name` 显式调用必须实时读盘 —— 技能正文当场从磁盘读取，
不得依赖 prompt 快照或对话历史里的旧回答；**口径是「调用瞬间」，注入之后它就是普通历史消息、跨轮不重读**（D-09）。

**三个候选读取口与取舍**：

| 方案 | 做法 | 成本 | 风险 |
|------|------|------|------|
| A. 复用 `refreshSkills()` 后读 `_cache.skills[i].skill.content` | 全量重扫两个目录后取缓存正文 | 50 技能 ≈ 100 次沙箱 IO | 有副作用（改 `_cache`、产诊断）；**语义上正确**（确实重读了盘）但为一次调用付全量代价 |
| B. **对本技能目录单独 `loadSkills(env, skillDir)`（推荐）** | SDK 自己的加载器读一个目录 | 1 次 `fileInfo` + 1 次 `readTextFile` | 无；复用 SDK frontmatter 解析，不自行实现 |
| C. `env.readTextFile(filePath)` + 自行剥 frontmatter | 直接读 | 1 次读 | **违反模块纪律**：`ai-skills-manager.js:18-20` 明写「其 frontmatter 解析与忽略文件匹配实现只经 SDK 往返获得，**不自行引入**」——自写剥离逻辑会与 SDK 的 `parseFrontmatter`（`\r\n` 归一化 / `trim()` 语义）漂移 |

**推荐 B，形状如下**（新增于 `ai-skills-manager.js`，`env` 由 `ai-manager` 注入，
与 `refreshSkills(env, ...)` 的注入风格一致）：

```js
/**
 * 解析一次显式技能调用的目标并**当场从磁盘读取正文**（用户 2026-09-11 硬要求）
 *
 * 读取口用 SDK 自己的 loadSkills(env, <技能目录>)：
 * 单目录、根层 SKILL.md 命中即返回（skills.js:88-103），一次 listDir + 一次 readTextFile。
 * **不自行剥 frontmatter**（本模块不得重新实现 SDK 的解析，见文件头依赖纪律）。
 *
 * @param {object} env - 沙箱 ExecutionEnv（agent-workspace.createSandboxEnv 的返回值）
 * @param {string} name - 技能名（调用方已解析；恒等于目录名 —— 46 D-08）
 * @returns {Promise<{ok: true, skill: object, source: string} |
 *                   {ok: false, reason: 'not_found'|'disabled'|'read_failed', name: string}>}
 */
async function readSkillForInvocation(env, name) {
  const entry = _cache.skills.find((e) => e.skill.name === name && e.shadowed !== true);
  if (!entry) return { ok: false, reason: 'not_found', name };
  if (entry.disabled === true) return { ok: false, reason: 'disabled', name };

  const { loadSkills } = await import('@earendil-works/pi-agent-core');
  const dir = path.dirname(entry.skill.filePath);
  const { skills } = await loadSkills(env, dir);
  const fresh = skills.find((s) => s.name === name) || skills[0];
  // 磁盘上 SKILL.md 被删 / 被改成不可解析 → 与「不存在」同形（D-13 推论）
  if (!fresh || typeof fresh.content !== 'string' || fresh.content === '') {
    return { ok: false, reason: 'not_found', name };
  }
  // name 以目录名权威：fresh.name 由 parentDirName 推出，与 entry.skill.name 一致；
  // 不一致说明目录被换成别的技能 → 同样按不存在处理，绝不冒名注入
  if (fresh.name !== name) return { ok: false, reason: 'not_found', name };
  return { ok: true, skill: fresh, source: entry.source };
}
```

**要点**：

- 查找**跳过 `shadowed === true`** —— D-11「手打 `/skill:name` 一律作用于胜出者」。
- `disabled` 判定在**读盘之前**（D-10 拒绝，不做无用 IO）。
- 磁盘与缓存不一致的两条路径（文件被删 / 目录被换成别的技能）**一律按「不存在」处理** ——
  与 D-13 推论一致，且**不冒名注入**。
- **不做**「读失败自动回退到缓存快照」—— 那会直接违反硬约束（用户要的就是「当场读」）。
  失败即 system-note，让用户看到真实原因。
- 想复用 `createSkillsEnv` 的字节闸也不会改变结论：SKILL.md 超 64 KiB 的技能**根本不在缓存里**，
  查找阶段就 `not_found`（D-13 推论明确覆盖这一情形）。

### 2.4 增强消息拼接顺序（D-07 的精确落点）

现有代码（`ai-manager.js:1229-1232`，本会话直读）：

```js
const markerBlock = aiAttachments.buildAttachmentMarkers(resolvedAttachments, { imageMode });
const contextBlock = this._buildMessageWithContext(message, referencedTabs);
const enhancedMessage = [visionNotice, markerBlock, visionBlock, contextBlock]
  .filter(Boolean)
  .join('\n\n');
```

**改为**（技能块置最前；其余元素的**相对顺序逐字节不变**）：

```js
// 技能块在两组装点之一（prompt / promptWithContext）中先算好：
//   const skillBlock = skillResolved ? buildSkillInvocationBlock(skillResolved, args) : '';
const markerBlock = aiAttachments.buildAttachmentMarkers(resolvedAttachments, { imageMode });
const contextBlock = this._buildMessageWithContext(message, referencedTabs);
const enhancedMessage = [skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]
  .filter(Boolean)
  .join('\n\n');
```

```js
/** 技能块 + provenance + args（D-05）。一次 formatSkillInvocation 调用完成，分隔符由 SDK 决定。 */
function buildSkillInvocationBlock({ skill, name }, args) {
  const provenance = `用户显式调用了技能「${name}」`;
  const instructions = [provenance, args].filter(Boolean).join('\n\n');
  return formatSkillInvocation(skill, instructions);   // → <skill …>…</skill>\n\n<provenance>\n\n<args>
}
```

**两处组装点（不可漏一处）**：

- `promptWithContext()`（`:1229`）：如上（这是唯一能同时带附件 / `@` 引用的路径）。
- `prompt()`（`:977`）：**只有技能、无附件无引用**时会走这条。当前它直接
  `await this.agent.prompt(message)`（`:1041`）。改为：

  ```js
  const enhanced = skillBlock ? skillBlock : message;   // 技能调用必带块；普通消息逐字节不变
  await this.agent.prompt(enhanced);
  ```

  （`prompt()` 的 `_ensureConversation(message)` 保持在**原始文本**上，见 §2.7。普通消息路径
  `enhanced === message`，因此该分支对既有行为零影响。）

**`prompt()` 与 `promptWithContext()` 的分流不由技能决定**：renderer 现有的分流条件是
「有 `@` 引用或附件 → promptWithContext，否则 prompt」（`src/renderer.js:8754-8762`）。
技能调用**沿用同一分流**（不新增分支）—— 这正是 D-07 顺序表包含 `markerBlock` / `contextBlock` 的原因。

**两个调用面各自解析、结果不重复计算**：建议在 `prompt()` / `promptWithContext()` 的**开头**
调用同一个私有 `await this._resolveSkillInvocation(rawMessage)`，返回
`{ skillBlock, skill: {name, tier, content} }` 或 `{ error: {code, message} }`；
两函数各自把 `skillBlock` 用在各自的组装处。避免解析逻辑出现两份。

### 2.5 返回契约：`skillInvocation` 回传（气泡需要的唯一新增信息）

renderer 建完气泡后需要**折叠块的正文**（D-09）。它不持有（也不该持有全量正文），
所以由调用响应回传「这次实际注入的正文」。

**改动面极小（本机 grep 确认只有 2 个调用方）**：

```
ipc-handlers.js:1688    const conversationId = await aiManager.prompt(message);
ipc-handlers.js:1713    const conversationId = await aiManager.promptWithContext(...)
src/renderer.js:8756    result = await window.realmAPI.ai.promptWithContext({...})
```

**建议形状**（把两个 manager 方法的返回值从裸 `string|null` 扩为对象）：

```js
// ai-manager.js 的所有返回路径统一为：
return {
  conversationId: this.currentConversationId || null,
  skillInvocation: skillResolved
    ? { name, tier, content }   // tier 由 §1.3 的 sourceTierOf 求得；不设声明型字段（本轮 plan 修订）
    : null,
};
```

`ipc-handlers.js` 侧：

```js
const res = await aiManager.prompt(message);
return { success: true, conversationId: res.conversationId, skillInvocation: res.skillInvocation };
```

**为什么把正文回传而不是让 renderer 再取一次**：D-09 要的是「**这次实际喂了什么**」的历史保真。
回传的是 main 刚读出并注入的**同一份字符串**，renderer 再取一次就可能与注入内容不一致（TOCTOU）。
**并且**：正文随响应回传后**由 renderer 挂到本地消息对象上用于渲染**；它**不进 renderer→main 的方向**，
也不改变 D-19 的契约（renderer → main 发的仍是完整语法文本）。

**失败协议**（main 权威判定与 renderer 预检不一致时，例如另一窗口刚禁用了该技能）：

```js
// main：解析失败 → 不调 agent.prompt，直接返回结构化错误
return { conversationId: currentConversationIdOrNull, skillInvocation: null,
         skillError: { code: 'skill_not_found' | 'skill_disabled', message } };
```

> **修正（本轮 plan 修订）**：上面的第三码 `skill_read_failed` **已删除** —— `readSkillForInvocation`
> 的返回值域只有 `not_found | disabled`（SDK `loadSkills` 读盘失败只产诊断 + 空技能集、**不抛错**），
> D-13 推论也要求「被整条跳过的技能」与「不存在」同形处理。权威落点是 48-01 Task 1 ③ 的模块级纯函数
> `skillErrorFromReason(reason, name)`（`not_found` → `skill_not_found` / `disabled` → `skill_disabled`，无第三码），
> 并有打表断言守住「值域只有两个码」。
>
> **并且（本轮 plan 修订）**：§2.5 的样例形状里的 `contentLength` **一并删除**。契约只有 `{ name, tier, content }`
> 三个键 —— 渲染侧折叠块的 `N` 取 `content.length`（JS `String.length`），**没有消费方的字段不进契约**；
> 48-01 的返回契约与 48-03 的「重载形状与实时链路键集合逐字相等」断言均以三键为准。

renderer 收到 `skillError` 时：**移除刚推送的 user 气泡 + 未产出的 assistant 占位**、
复位 `state.aiStreaming` / `aiCurrentMessageId` / 发送按钮，`pushSystemNote(message)`。
这条路径照抄既有 `case 'error'` 里「placeholder 无内容则 splice 掉」的做法（`src/renderer.js:9088-9099`），
但**不用** `showAIError`（那是带重试按钮的错误卡；D-13 要的是 system-note 形态）。
**文案统一由 main 给**（`message` 字段），renderer 只呈现 —— 保证与 §2.2 的预检文案逐字一致。

### 2.6 用户气泡与技能正文折叠块（含**重载路径**）

**D-06 形状**（照抄 `referencedTabs` / `attachments` 先例）：

- 消息对象：`{ role:'user', content: <args 原文>, id, skillInvocation: {name, tier, content}, referencedTabs, attachments }`
- 气泡渲染位置：`renderAIMessages` 的 `if (isUser) {` 分支（`src/renderer.js:8030`），
  在 `referencedTabs` pill 行（`:8032-8051`）之后、正文之前插一行 `.ai-message-refs` + `.ai-message-ref-pill.ai-skill-pill`；
  折叠块 `.ai-skill-content-box` 追加在**附件之后**（UI-SPEC 结构图）。
- 气泡**不显示** `/name` 原文与技能正文正文（正文只在折叠块里）。
- `disable-model-invocation` 的技能 pill 的 `title` 与来源徽标 title 同源文案（UI-SPEC）。

**⚠ 重载路径（必须处理，否则重开对话会露出原始 XML）**：
入库的是 main 的 `agent.state.messages`（`ai-manager.js:2116-2124`），
所以 `messages.content` 列存的是**完整增强消息**（`<skill …>…</skill>\n\n用户显式调用了技能「X」\n\n<args>`）。
`conversationStore.getMessages()` 对 user 行直接 `content: text` 入显示形状（`ai-conversations-manager.js:653-660`），
`renderAIMessages` 用 `textContent` 渲染 → **重开对话后气泡会显示整段 XML**。这是必须消除的缺陷。

**两步落点**（均已有先例可照抄）：

1. **解析装饰**：在 main 侧对显示形状做一次装饰（位置二选一：`ai-conversations-manager.getMessages`
   的 user 分支，或 `ai-manager.getConversationMessages`（`:2467`）。**建议后者** ——
   `conversationStore` 保持「只懂存储」的单一职责，技能域知识不进它）。

   ```js
   // 形态照抄既有 <context-summary> 的 user 行特判（ai-conversations-manager.js:641-651）
   const m = text.match(/^<skill name="([^"]+)" location="([^"]+)">\n[\s\S]*?\n<\/skill>(?:\n\n([\s\S]*))?$/);
   ```

   还原规则（**固定模板锚定，不要用「最后一个空行」之类的位置猜测**）：
   - `name` ← 块属性（与目录名权威一致，46 D-08）
   - `body` ← `<skill …>` 与 `</skill>` 之间、**去掉第一行 `References are relative to …` 与其后空行**后的内容
     → 即当时的 `skill.content`（折叠块显示它，`N = body.length`）
   - 尾部 `\n\n<provenance>\n\n<args>` → args = 从 `用户显式调用了技能「<name>」` 这一行**之后**的部分
     （provenance 行由固定模板生成，可用 `name` 精确重构后 `indexOf` 锚定；args 为空时尾部只有 provenance 行）
   - 还原后：`{ role:'user', content: args, skillInvocation: { name, tier, content: body } }`

2. **`tier` 的还原**：`location` 是 `skill.filePath`，用 §3.2 的 `matchSkillByPath(location)` 取当前 `tier`；
   技能已被删除 / 改名 → 找不到 → **省略 pill 的 title 与 tier**，气泡照常渲染（**不因元数据缺失丢消息**）。

**唯一形状的两个生产者**：live 路径用 §2.5 的回传结果建对象，重载路径用上述解析建对象 ——
**字段名与语义必须逐字一致**（`skillInvocation: {name, tier, content}`），
并写一条测试断言两条路径产出的对象形状相同（见 Validation Architecture）。

> **⚠ 修正（本轮 plan 修订，来自 checker 的 blocker 复核）**：上面「args = 从 provenance 行**之后**的部分」
> 只在 `prompt()` 路径（增强消息**只有技能块**）成立。`promptWithContext()` 的增强消息是
> `[skillBlock, visionNotice, markerBlock, visionBlock, contextBlock].filter(Boolean).join('\n\n')`，
> provenance 行之后**还有尾段**（附件 marker / 视觉提示 / `<referenced-tab>` 引用 XML / `用户消息：{语法文本}`），
> 直接把其后内容当 args 会把尾段一起算进气泡正文（违反 D-06 与 UI-SPEC §用户气泡契约「正文 = args 原文」）。
> **权威口径落在 48-01 Task 1 ③ 的模块级纯函数 `resolveSkillBubbleArgs(enhancedContent, name)`**：
> 以「`contextBlock` 恒为增强消息末段、且 `_buildMessageWithContext`（`ai-manager.js:1364-1387`）
> 恒以用户原文（完整语法文本）收尾」为锚点，用 `extractArgs` 从**末段语法文本**取 args，
> 并以「与 provenance 行之后的首段逐字符一致（`T2 === a || T2.startsWith(a + '\n\n')`）」自校验；
> 无尾段（`prompt()` 路径）时回落到「provenance 行之后即 args」。
> 本节其余结论（`name` / `body` 的解析、`tier` 还原、装饰落点选 `ai-manager`、不 hijack JSON 列）**均不变**。

**备选（不推荐，供 plan 期知情）**：把 `{name, tier}` 塞进既有 JSON 列（`page_snapshots` 当前**写入但显示侧从不读取**，
`ai-conversations-manager.js:142-166` / `:251`）可省掉解析，但那是对一个语义明确的列做 hijack，
且**正文仍需从 `content` 解析或另存**；D-16「不改表结构」在解析方案下已满足，故不取。

[VERIFIED: src/renderer.js:8030-8120（user 分支渲染）、ai-manager.js:2116-2124（落库来源 = agent.state.messages）、ai-conversations-manager.js:641-651（`<context-summary>` 特判先例）/:653-660（user 行显示形状）、:66-78（messages 列表结构）/ :142-166 + :251（page_snapshots 列——均本会话直读）]

### 2.7 `_deriveConversationTitle` 与 D-19 的验证方式

```js
// ai-manager.js:1338-1341
_deriveConversationTitle(userMessageText) {
  const trimmed = typeof userMessageText === 'string' ? userMessageText.trim() : '';
  return trimmed ? trimmed.substring(0, 30) : '新对话';
}
```

调用点：`_ensureConversation(userMessageText)`（`:1305`），
`prompt()` 在 `:1023` 用**原始 message**、`promptWithContext()` 同样传原始 `message`（非增强文本）。

**契约**：技能调用时传给 `_ensureConversation` 的必须是**完整语法文本** `/skill:name args`：
- 无 args → 标题 = `/skill:find-skills`（30 字符内，**不退化**为「新对话」）
- 有 args → 标题 = `/skill:find-skills 帮我找 X`（前 30 字符截断）

**验证方式（可自动化）**：单元测试直接对 `AIManager.prototype._deriveConversationTitle` 打表
（它是纯函数、无副作用）；
再加一条**接线断言**：`_ensureConversation(` 的实参在 `prompt` / `promptWithContext` 内必须是
**未组装的 `message`**（源码扫描：`this._ensureConversation(message)` 出现、`this._ensureConversation(enhanced` **不得**出现）。

**顺带记录既有的无关行为**（不要在本阶段顺手改）：`_ensureConversation` 只在标题仍为默认「新对话」时改写（`:1325-1329`）。

### 2.8 流式中止、错误协议与边界矩阵

**D-08（流式中触发）**：技能分支在调用 IPC 之前 `await abortAIIfStreaming()`（`src/renderer.js:8804`），
与 `/clear`（`:8820`）、`/compact`（`:8832`）同款。**位置约束**：`handleSendAIMessage` 的斜杠拦截
目前位于 `if (state.aiStreaming) return;`（`:8693`）**之前** —— 这是既有的刻意设计，
技能分支必须保持在同一位置（否则流式中调用技能会被静默丢弃）。

**四类边界技能的完整矩阵**（每一格都要有对应断言）：

| 技能状态 | 面板行 | 面板可选中 | 面板 Enter | 手打 `/skill:name` | 手打裸 `/name` | 是否进 prompt |
|---------|--------|-----------|-----------|-------------------|---------------|--------------|
| 正常 | 渲染 | ✅ | 调用 | 调用 | 调用 | ✅ |
| `disableModelInvocation` | 渲染 + 「仅显式」 | ✅ | 调用 | 调用 | 调用 | ❌（且**永不** `promptOmitted`） |
| `disabled`（D-10） | **不渲染** | — | — | system-note「已被禁用…」 | system-note「已被禁用…」 | ❌ |
| `shadowed`（D-11） | 渲染 + 灰显 + 「已遮蔽…」 | ❌ | 跳过 / 全灰显时不执行 | **作用于胜出者**（同名唯一） | 同左 | ❌ |
| 与本地命令同名 | 渲染 + 灰显 + 「与本地命令同名…」 | ❌ | 跳过 | 走**技能**（`/skill:` 无歧义） | **本地命令优先** | 视预算 |
| `overLimit`（D-12） | 渲染 + 「超数量上限」 | ✅ | 调用 | 调用 | 调用 | ❌ |
| `promptOmitted`（D-12） | 渲染 + 「未进提示词 · 超预算」 | ✅ | 调用 | 调用 | 调用 | ❌ |
| 不存在 / 被跳过（D-13） | 不渲染 | — | — | system-note「未找到技能「name」…」 | system-note「未知命令 /name…」 | — |

**两处必须写进测试的细节**：

1. **`disabled` 与 `disableModelInvocation` 语义相反**（D-10 的警示）：前者两个入口都拒；
   后者**必须可调用**（DISC-07 的正面要求）。两条断言必须**同时**存在，防止实现把两者混成一个 flag。
2. **`shadowed` 的 D-11 不可达性**：手打路径按 name 查找必然命中胜出者，
   `shadowed` 条目在查找阶段被跳过（§2.3 的 `find(... && e.shadowed !== true)`）——
   所以「灰显不可选中」只影响**面板路径**。这一条要有断言，否则实现容易给手打加一个错误的「已遮蔽」错误分支。

**D-13 在面板语义下的可达性（重要，避免误判实现 bug）**：
输入框只要以 `/` 开头面板就打开（`:9867`），而 Enter 优先走 `executeActiveSlashCommand()`
（`:9786-9793`）→ 所以手打 `/skill:foo` 时，**只有过滤结果为空或全部不可选中时**
才落到 `handleSendAIMessage` 的解析分支。这是既有面板语义（`/cle` + Enter 命中 `clear` 行同理），
不是缺陷；但意味着：
- 「未找到技能」的**必然触发条件**是「过滤无命中」；
- 反过来，`/skill:f` 这类**能前缀命中**某技能时，Enter 执行的是**高亮行**（用户屏幕可见），
  与手打字面值的差异属面板选择语义，**不得**为它加特例。

---

## 面 3 — 模型自动匹配的可见性（D-15 / D-18）

### 3.1 落点：工具事件生成侧（`ai-manager.js` 的 `tool_execution_start`）

**SDK `read` 工具的真实参数名是 `path`，不是 `filePath`**（本会话源码直读）：

```js
// node_modules/@earendil-works/pi-agent-core/dist/harness/tools/read.js:5-9
const readSchema = Type.Object({
    path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
    offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
    limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});
```

> ⚠ **UI-SPEC 的 `read` 卡片章节写「参数区仍显示 `filePath`」—— 该表述与实现不符**。
> 参数键是 `path`；UI-SPEC 要表达的是「参数区不变、用户能核对读了哪个路径」（正确且可保留）。
> 实现时**不要**去改参数键，也不要按 `filePath` 取值（取不到，永远是 `undefined`）。

**落点（唯一，CONTEXT 裁量项的结论）**：`ai-manager.js` 的 `_setupEventBroadcasting()`
（`:1428`）内 `case 'tool_execution_start':`（`:1474-1485`）：

```js
case 'tool_execution_start': {
  console.log(`[Realm AI] 工具调用: ${event.toolName}`, JSON.stringify(event.args || {}));
  sendNow({
    type: 'tool_execution_update',
    tool_execution_id: event.toolCallId,
    tool_name: event.toolName,
    status: 'running',
    params: event.args,
    // 新增：仅 read + 命中技能文件时携带（缺失 → renderer 渲染普通 read 卡片）
    skill_invocation: resolveSkillMarker(event.toolName, event.args),
  });
  break;
}
```

**为什么必须在这里（三条理由，任一独立成立）**：

1. **renderer 不掌握技能目录的权威路径**（CONTEXT 原文）——它在 `file://` 主窗口，无 `sandboxEnv`，
   拿不到 `getSkillsDir()/getManagedSkillsDir()`，只能靠字符串包含猜路径（＝第二份判定实现，
   ARCHITECTURE Anti-Pattern 5）。
2. **本处是同步上下文，而匹配可以是同步的** —— 缓存 `filePath` 与 `entry.source` 都在
   `_cache.skills` 里（`ai-skills-manager.js:648`），`sendNow` 不必改成异步（避免事件时序风险，
   `:1441-1462` 的 `flushPending` 机制对「立即事件」有次序保证）。
3. **`tool_execution_end` 分支（`:1497`）不带 `params`，标记必须在 start 事件里一次性给出**；
   renderer 的更新分支只覆盖 `status/result/error`（`src/renderer.js:9030-9038`），
   已落在 `toolExecutions[i]` 对象上的标记会自然保留。

**新增纯函数（`ai-skills-manager.js`，同步、零 IO、无 electron）**：

```js
/**
 * 按绝对路径匹配缓存中的技能（D-15 的 read 卡片标记）
 * 只与缓存 `skill.filePath` 做**规范化全等比较** —— 不按目录前缀猜、不重新扫盘。
 * @param {string} absPath - 已规范化的绝对路径
 * @returns {{name: string, tier: string} | null}
 */
function matchSkillByPath(absPath) { /* 遍历 _cache.skills，比较 path.resolve(e.skill.filePath) */ }
```

`ai-manager.js` 侧的包装（同步，不 await）：

```js
/**
 * read 工具的技能标记（D-15）。判定必须在工具事件生成侧完成。
 * 返回 null → 普通 read 卡片（接口契约：缺失/非法一律零回归）。
 */
function resolveSkillMarker(toolName, args) {
  if (toolName !== 'read' || !args || typeof args.path !== 'string') return null;
  const root = self.sandboxEnv && self.sandboxEnv.cwd;
  if (!root) return null;
  const abs = path.isAbsolute(args.path) ? path.resolve(args.path) : path.resolve(root, args.path);
  if (path.basename(abs) !== 'SKILL.md') return null;           // 只有 SKILL.md 才算「使用技能」
  return getAiSkillsManagerLazy().matchSkillByPath(abs);
}
```

### 3.2 路径规范化（唯一的真实风险点）

`read` 工具的参数是**模型给的原文**（可相对可绝对），SDK 用 `env.absolutePath(path)` 解析：

```js
// node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:310-312
async absolutePath(path) {
    return ok(resolvePath(this.cwd, path));
}
// 同文件 :25-43 resolvePath：~ / file:// 特判，随后
return isAbsolute(normalized) ? resolve(normalized) : resolve(cwd, normalized);
```

沙箱 env 把 `cwd` 直接暴露为属性（`agent-workspace.js:234` → `cwd: root`），
解析规则是**纯词法 `path.resolve`**（无 realpath、无 IO），因此可以同步复刻：

```js
path.isAbsolute(args.path) ? path.resolve(args.path) : path.resolve(sandboxEnv.cwd, args.path)
```

**两个边界必须在实现里显式处理**：

1. **`~` / `file://` 形态**：`resolvePath` 会展开；`path.resolve` 不会。
   但这类路径解析后落在**工作区外** → 沙箱 `resolveInside` 拒绝 → `read` 工具失败 →
   该次调用本来就不会成功，标记为 `null`（普通 read 卡片）是**正确**行为。
   **不要**为它加 `~` 展开（那会引入与沙箱不同的第二套解析）。
2. **realpath 差异**：`resolveInside` 用「root + root 的 realpath」双基准
   （`agent-workspace.js:152-155`）；缓存里的 `filePath` 来自 SDK `listDir` 的**词法拼接**结果，
   与 `read` 事件的解析结果同属词法形态 → 正常情况逐字符相等。
   **测试必须覆盖**：① 绝对路径命中；② 相对路径（`managed-skills/<name>/SKILL.md`）命中；
   ③ 指向技能目录下 `references/*.md` **不**命中（basename 非 SKILL.md）；
   ④ 工作区外绝对路径不命中。若实测出现 realpath 漂移，回退方案是**两侧都过一遍
   `matchSkillByPath` 的 `path.resolve` 与 `fs.realpathSync`（存在时）双比较** —— 但**不得**
   退化为「按目录名包含 `skills/` 猜」（那会把未加载的散落文件标成技能）。

**可靠性边界（如实写入产品文档）**：`read` 事件里的 `path` 是模型给的值，
`resolveReadToolPath`（`path-utils.js`）还会做 NFD / 窄空格 / 弯引号变体尝试，
所以**极端 Unicode 文件名下标记可能不命中**——后果仅是「显示为普通 read 卡片」，
**不是**功能失效（技能正文仍被正常读取）。这是可接受的降级。

### 3.3 重载路径的标记重建（决策）

重开对话后 `toolExecutions` 由 `tool_calls` 列重建，只有
`{ id, name, status, params }`（`ai-conversations-manager.js:577-582`，`params: call.arguments`），
**没有** `skillInvocation` → 技能化标题会退回普通 `read`。

**建议：在 `ai-manager.getConversationMessages()`（`:2467`）里重建一次**，用同一个
`resolveSkillMarker(exec.name, exec.params)`（同一实现、同一判据）：

```js
getConversationMessages(conversationId) {
  const msgs = conversationStore.getMessages(conversationId);
  for (const m of msgs) {
    // (a) user 行的 <skill> 装饰（§2.6）
    // (b) assistant 行 toolExecutions 的 read 标记（本节）
    if (Array.isArray(m.toolExecutions)) {
      for (const t of m.toolExecutions) {
        const mk = resolveSkillMarker(t.name, t.params);
        if (mk) t.skillInvocation = mk;
      }
    }
  }
  return msgs;
}
```

理由：① 一处实现、实时链路与重载链路判据相同；② 零表结构改动；
③ 技能已删除时静默不标（与实时链路「匹配不到就是普通卡片」一致）。
**不做**的替代方案：把标记写进 `tool_calls` 列（会把展示语义污染进 LLM 上下文重建路径，
`getAgentMessages` 也读同一列，`:693`）。

### 3.4 D-18 措辞落点与边界

`REALM_SYSTEM_PROMPT` 模板字面量起于 `ai-manager.js:479`，第一段为：

```
你是 Realm Browser 的 AI 助手。你可以帮助用户管理浏览器标签页、查看当前状态、读取网页内容、提取链接等。
```

**落点**：在第一段与 `你的能力：`（`:480` 之后一行）之间插入**一个独立段落**（模板字面量内换行 + 空行，
与既有段落分隔风格一致），语义必须包含三件事：

1. **技能（Skill）与工具（Tool）是两个不同概念**（`STATE.md:224` 的收口）；
2. 技能是「按需读取的指令文档/工作流」，**正文需经 `read` 打开其 `location`** 才能看到；
3. 未经显式调用时模型**不会**自动获得技能正文（渐进式披露），只有 name / description / location 在提示词里。

**三条硬边界**：

- **不得触碰技能段**（46 D-02）：`buildSystemPrompt()`（`:580-584`）的
  `skillsBlock` 仍必须**逐字符等于** `getAiSkillsManagerLazy().buildSkillsPrompt()` 的返回值，
  不得加前缀 / 后缀 / 包装。
- **只改第一段**（静态前缀的一次性代价）：变更会让既有会话的 provider 前缀缓存重建一次，
  属一次性成本，不得为「省缓存」把措辞挪进技能段（那会让 46 D-02 失效且每轮抖动）。
- **措辞不得声称技能是工具**（正是要修的病）；也不得写成「技能可自动注入」（与 D-05 的
  「只有一种形态、显式调用才有 provenance」语义冲突）。

**验证**：源码断言 `REALM_SYSTEM_PROMPT` 含「技能」且含「工具」；
另有既有断言（`tests/test-ai-skills.js:1184`「ai-manager 第 4 段为条件追加」）
继续守住「技能段不得被改写」的边界。

---

## 不得回退的前置约束（逐条给出验证方式）

| 约束 | 来源 | 验证方式（可自动化） |
|------|------|---------------------|
| `/skill:` 显式调用**必须实时读盘**；注入后跨轮**不重读** | `STATE.md:223` + D-09 | 单元：写入技能 → 调用 → 改磁盘 → 再次调用应读到新正文（实时半边）；同一会话第二条消息**不**再注入技能块（不重读半边，断言 `agent.prompt` 的实参来自历史而非新读） |
| 单一数据权威：技能集只在 `ai-skills-manager.js` 加载/去重/诊断/限额 | 46 D-06 / D-08 | 源码扫描：`src/renderer.js` **不得**出现 `bySkillPriority` / `shadowedBy` 判定 / `MAX_USER_SKILLS` / `8000` 等字面量 |
| 常量单源 `LIMITS`（64 KiB / 50 / 8000）只在 manager 定义 | 46 D-11 / `STATE.md:220` | 既有断言（`tests/test-ai-skills.js:1171`）+ 新增：`renderer.js` / `preload.js` / `ipc-handlers.js` 内零出现这三个数值 |
| `file://` 主窗口不能 fetch 本地 HTTP API | Phase 38 事故 / AGENTS.md | 源码扫描：`src/renderer.js` 的 AI 技能路径不得出现 `fetch('/api/skills` 或 `http://localhost` |
| `_deriveConversationTitle` 收**原始**消息 | D-19 | 纯函数打表 + 接线扫描（`_ensureConversation(message)` 出现，`_ensureConversation(enhanced` 不出现） |
| `REALM_SYSTEM_PROMPT` 技能段不受 D-18 影响 | 46 D-02 | 既有断言 `:1184` + 新增断言「技能段 === `buildSkillsPrompt()` 返回值」 |
| 不得重构 `syncAgentSystemPrompt()` 函数体 | `tests/test-ai-skills.js:1278-1296` 源码扫描 | 既有 5 条断言继续绿（本阶段只**新增调用方**，不改函数体） |
| D-04 裸名「严格前缀 + 空白边界」 | `FEATURES.md:216` | 表驱动：`/foo` `/foo x` 命中；`/foobar` `/foo-bar` `/fo` 不命中 |
| 既有 64 例基线不回归 | Phase 46 交付 | `node --test tests/test-ai-skills.js` → `# pass 64 / # fail 0`（本会话实测基线） |

---

## Don't Hand-Roll

| 问题 | 不要自建 | 用现成的 | 理由 |
|------|---------|---------|------|
| `<skill>` 块文本 | 自拼 `<skill name=…>` 模板 | SDK `formatSkillInvocation` | 引导行 `References are relative to <dir>.`、分隔符、`dirnameEnvPath` 的 Windows 盘符分支（`skills.js:307-313`）都在 SDK 里；自拼必然漂移 |
| frontmatter 剥离 | 自己写 `---` 分割 | SDK `loadSkills(env, <技能目录>)` | `ai-skills-manager.js:18-20` 明文禁止；SDK 的 `parseFrontmatter` 含 `\r\n` 归一化与 `trim()` 语义 |
| 技能集去重 / 遮蔽 / 定序 / 限额 | renderer 或新模块重算 | `ai-skills-manager` 的缓存 + `bySkillPriority` | 46 D-06 单一数据权威；Anti-Pattern 5 |
| 三档 seeded 判定 | 硬编码技能名 / 状态文件 | `builtin-skills-seeder.getSeededSkillNames()` | 47 D-11 已定「零状态文件、零硬编码」；硬编码会让新内置技能永远标错 |
| 面板行 / 徽标 / 折叠块视觉 | 新设计系统 / 第二份徽标实现 | 既有 CSS 原语（UI-SPEC 逐项列出） | UI-SPEC 开头明令「**不得**另起一套设计系统或第二份徽标/折叠实现」 |
| 流式中止 | 新的 abort 逻辑 | `abortAIIfStreaming()`（`src/renderer.js:8804`） | D-08 直接复用 |
| 文本反馈 | 新的提示组件 | `pushSystemNote()`（`:8794`） | UI-SPEC「文本反馈唯一入口」 |
| HTML 转义 | 自写转义 | `escapeHtml()`（`:10834`） | 已有实现与既有用法 |
| 技能集变更 → prompt 回写 | 新写一条刷新链路 | `syncAgentSystemPrompt()`（`ai-manager.js:2512`） | 它已实现 digest 早退 / 忙时置脏 / 广播全套语义；重写必然漏一条 |

---

## Common Pitfalls

### P-48-01（阻断）：`rest` 取值吞掉 args（事实 2）

**What goes wrong:** `/skill:find 帮我找 X` 回车后 args 只剩 `X`；`/fin 帮我找 X` args 全空。
**Why it happens:** `value.slice(1 + cmd.name.length)` 假设「输入 token 长度 == name 长度」，
而新增的 `/skill:<前缀>` 形态几乎总是更短。
**How to avoid:** 改成 token 取值（`value.slice(1).split(/\s/)[0]`），renderer 与 main 用**同一个纯函数**。
**Warning signs:** 用户报告「技能收到了但参数没了」；测试里 args 长度断言偶发为 0。

### P-48-02（阻断）：把技能 push 进 `SLASH_COMMANDS`

**What goes wrong:** 技能调用被本地 handler 吞掉 → 「点了没反应」。
**Why it happens:** 复用一套渲染看起来最省事。
**How to avoid:** 第二命令源 + `kind` 判别字段；`SLASH_COMMANDS` **零改动**（ARCHITECTURE Anti-Pattern 4 已预言）。
**Warning signs:** `SLASH_COMMANDS` 数组长度随技能数变化；`match.handler(rest)` 被技能行走到。

### P-48-03（阻断）：`skill.content` 缺失 → 注入字面量 `undefined`

**What goes wrong:** 模型看到 `undefined` 却当作正文，行为不可预测且无任何报错。
**Why it happens:** 直接把快照对象/自制对象喂给 `formatSkillInvocation`。
**How to avoid:** 只在**读盘成功后**组装；组装前断言 `typeof skill.content === 'string' && skill.content !== ''`。
**Warning signs:** `agent.prompt` 实参里搜得到 `\nundefined\n`。

### P-48-04（高）：面板点击按 name 反查索引 → 同名两行点错

**What goes wrong:** 点「命令」分区的 `/clear` 执行了同名技能行。
**Why it happens:** 既有 `findIndex(c => c.name === row.dataset.cmd)`（`:9934`）。
**How to avoid:** `data-index` 直绑 + 转义；不可选中行不加点击处理器。
**Warning signs:** 同名技能存在时点击行为与高亮不一致。

### P-48-05（高）：重开对话后气泡显示原始 `<skill …>` XML

**What goes wrong:** 用户看到一整段尖括号文本，折叠块消失。
**Why it happens:** 落库的是增强消息；显示形状直接 `textContent` 出来。
**How to avoid:** §2.6 的装饰层（照抄 `<context-summary>` 先例）。
**Warning signs:** 切换对话后 user 气泡首字符是 `<`。

### P-48-06（高）：响应 `skills:changed` 时顺手再刷新 → 自激回路

**What goes wrong:** 广播 → `refreshSkills` → prompt 变 → 再广播 → 无限循环 + 主进程持续重扫盘。
**Why it happens:** 把广播当成「该刷新了」而不是「该重拉投影了」。
**How to avoid:** 广播的处理路径**只**调 `ai:get-skills`（快照投影），**不得**调 `ai:refresh-skills`；
`refresh` 只在面板打开的**那一次**触发。
**Warning signs:** 主进程日志出现连续多轮 `refreshSkills`；`skills:changed` 频率与面板开关无关地自增。

### P-48-07（高）：`getSeededSkillNames()` 在纯 Node 里抛 TypeError（事实 4）

**What goes wrong:** 新断言组整组以 TypeError 失败（看起来像实现崩了，其实是环境）。
**Why it happens:** `require('electron')` 在非 Electron Node 返回字符串 → `app` 为 undefined。
**How to avoid:** 测试前 `seeder.setBuiltinDepsForTest({ srcDir: <真实 skills-builtin> })`；
生产侧投影包 try/catch 并降级 + `console.warn`。
**Warning signs:** 报错行是 `reading 'isPackaged'`。

### P-48-08（中）：`promptOmitted` 判定条件与 ⑦ 的 `eligible` 漂移（事实 3）

**What goes wrong:** `disableModelInvocation` 的技能被标上「未进提示词 · 超预算」，
用户以为它超了预算，实际是「仅显式」。
**Why it happens:** 直接用「不在 promptBlock 里」反推，或复制的过滤条件与 ⑦ 不同步。
**How to avoid:** 只对 `eligible.slice(kept.length)` 打标；断言 `disableModelInvocation` 条目
`promptOmitted !== true`。
**Warning signs:** 两个内置技能（都 `disable-model-invocation: true`）开局就带橙色标注。

### P-48-09（中）：`/skill:` token 未剥离 → 面板过滤恒为空

**What goes wrong:** 输入 `/skill:fi` 面板显示「无匹配」，用户以为技能没加载。
**Why it happens:** 直接用 `filter`（含 `skill:` 前缀）去 `name.startsWith(...)`。
**How to avoid:** 技能分区用剥离后的 `q`，命令分区用原 `filter`。
**Warning signs:** 冒号后缀长时面板必空、退格到 `/skill` 才有结果。

### P-48-10（中）：`activeIndex` 落在不可选中行上

**What goes wrong:** Enter 变成死键（既不执行也不给提示）。
**Why it happens:** 只做了「越界收缩」没做「可选中收缩」。
**How to avoid:** §1.5 的 `slashPickerSelectable` 取模 + 重渲染后收敛；
全部不可选中时 `activeIndex = -1`（Enter 回落既有 false 路径）。
**Warning signs:** 只有灰显行时回车无任何反应。

### P-48-11（中）：技能描述未转义进 `innerHTML`

**What goes wrong:** 含 `<img onerror=…>` 的 description 在面板里执行（技能可来自网络导入）。
**Why it happens:** 既有模板的数据源一直是代码常量，习惯性不加转义。
**How to avoid:** `escapeHtml` 包裹 name/description/statusText/title；tier→class 走白名单表。
**Warning signs:** 面板行出现异常标签；DOM 里能看到未转义的 `<`。

### P-48-12（低）：IPC 载荷里塞进全量技能正文（事实 5）

**What goes wrong:** 面板打开变慢；主进程与 renderer 之间传 MB 级字符串。
**Why it happens:** `return getSkillsSnapshot()` 看起来最省事。
**How to avoid:** 只走 `getSkillsForUI()` 投影；断言投影对象**不含** `content` / `filePath` / `diagnostics`。
**Warning signs:** `ai:get-skills` 的 JSON 长度随技能正文增长。

---

## 代码骨架（blocking 关键路径）

> 骨架只给签名与拼装，不给完整实现；每一处都标注了落点 file:line。

```js
// ─────────── ai-skills-manager.js（新增导出） ───────────
// ① ⑦ 尾部新增（紧跟 `used += cost;` 的循环之后）
for (const e of eligible.slice(kept.length)) e.promptOmitted = true;

// ② 新增纯函数（无 electron、无 IO、可纯 Node 测试）
function sourceTierOf(entry, seededNames) { /* §1.3 */ }
function toUISkillEntry(entry, seededNames) { /* §1.2 收窄投影 */ }
function getSkillsForUI(seededNames) { /* { skills, refreshedAt, digest } */ }
function matchSkillByPath(absPath) { /* §3.1 规范化全等匹配 */ }

// ③ 新增异步读盘（env 由调用方注入，与 refreshSkills 同款）
async function readSkillForInvocation(env, name) { /* §2.3 */ }

module.exports = { /* 既有 */ LIMITS, refreshSkills, buildSkillsPrompt, getSkillsSnapshot,
  _resetCacheForTest, /* 新增 */ sourceTierOf, getSkillsForUI, matchSkillByPath, readSkillForInvocation };

// ─────────── ai-manager.js（新增/改动） ───────────
function getBuiltinSkillsSeederLazy() { return require('./builtin-skills-seeder'); }   // 惰性，与 :114 同款

class AIManager {
  /** 面板数据源（同步投影，零 IO）—— 供 ai:get-skills */
  getSkillsForUI() {
    return getAiSkillsManagerLazy().getSkillsForUI(
      getBuiltinSkillsSeederLazy().getSeededSkillNames()          // 见 P-48-07 的 try/catch 降级
    );
  }
  /** 面板后台刷新 —— 供 ai:refresh-skills（复用既有链路，闭合 P8 触发点） */
  async refreshSkillsForPanel() {
    await this.syncAgentSystemPrompt();                            // 不改其函数体（见 §1.7 硬约束）
    return this.getSkillsForUI();
  }
  /** D-19 的权威解析 + 实时读盘 + 组装（prompt / promptWithContext 共用） */
  async _resolveSkillInvocation(rawMessage) { /* §2.2 §2.3 §2.4 */ }
}
function parseSkillInvocationText(text) { /* §2.2，模块级纯函数，导出供测试 */ }
function buildSkillInvocationBlock(resolved, args) { /* §2.4 */ }
function resolveSkillMarker(toolName, args) { /* §3.1 */ }

// ─────────── src/skill-picker-model.js（新增，双模式导出） ───────────
(function () {
  'use strict';
  const SKILL_PREFIX = 'skill:';
  function parseSkillRef(text, commandNames) { /* 本地命令优先 + 严格前缀边界 + /skill: 拆分 */ }
  function extractArgs(inputValue) { /* §事实 2 的 token 取值法 */ }
  function filterPickerItems(skills, filter) { /* §1.6，两档排序 */ }
  function buildPickerItems(skills, filter) { /* §1.5 展平 + kind + selectable + statusText */ }
  const api = { SKILL_PREFIX, parseSkillRef, extractArgs, filterPickerItems, buildPickerItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SkillPickerModel = api;
})();

// ─────────── src/renderer.js（改动点清单） ───────────
// :8673-8691  handleSendAIMessage 斜杠分支：本地命令 → 技能预检 → 未知命令（§2.2）
// :8720-8735  用户消息对象加 skillInvocation 元数据（§2.5 回传值）
// :8754-8762  IPC 分流条件不变；读取 result.skillInvocation / result.skillError
// :8030-8120  气泡 pill 行 + 折叠块（§2.6）
// :8804       abortAIIfStreaming（复用，零改动）
// :9259-9265  renderToolCard 名称分支：skillInvocation → 「使用技能「name」」+ 徽标（§3.1，textContent）
// :9035-9050  handleAIStream 的 tool_execution_update 推送分支加 skillInvocation 映射（`skill_invocation` → `skillInvocation`）
// :9768-9802  ArrowUp/Down 在 slashPickerSelectable 上取模（§1.5）
// :9810-9826  executeActiveSlashCommand：kind 分流 + token 取值 args（事实 2）
// :9880-9898  openSlashPicker：立即渲染 + 后台 refreshSkills + 初始化 selectable
// :9900-9955  renderSlashPickerList：分组标题 + 五要素 + data-index + 转义（§1.5 §1.6 §1.8）
// :4389 附近   新增 onIpcMessage('skills:changed', …)（§1.7）

// ─────────── ipc-handlers.js（新增 2 个通道 + 改 2 个返回） ───────────
ipcMain.handle('ai:get-skills', async (event) => { assertTrustedSender(event); return aiManager.getSkillsForUI(); });
ipcMain.handle('ai:refresh-skills', async (event) => { assertTrustedSender(event); return aiManager.refreshSkillsForPanel(); });
// :1688 / :1713 → 返回体带 conversationId + skillInvocation + skillError（§2.5）
```

---

## 文档同步（AGENTS.md 维护约定）

按 ROADMAP「Doc sync: `docs/product/ai-skills.md` 补发现与调用章节」+ AGENTS.md 的维护约定模式
（「导航入口与分配规则」「AI 工作区与 Bash 权限」两节同款）：

1. **`docs/product/ai-skills.md`**：新增一节（建议插在现有 §三 优先级之后或作为新的一节，
   与现有八/九节并列），内容必须覆盖：
   - 面板形态：`/` 触发、两个分区、过滤档位、行五要素、灰显不可选中的两种状态
   - `/skill:name [args]` 与裸 `/name` 两种语法 + **本地命令优先**规则（含同名技能的可见后果）
   - **实时读盘口径**：调用瞬间读盘；注入后即普通历史消息、跨轮不重读（与 §六「`/compact` 不保留技能正文」衔接）
   - 边界技能行为表（禁用 / 遮蔽 / 仅显式 / 超限两态 / 不存在）—— 直接搬 §2.8 的矩阵（去掉实现列）
   - 三档来源徽标 + seeded 判定来源（指向 §八 内置技能）
   - `read` 卡片技能化
   - **诚实边界**：面板刷新依赖 `syncAgentSystemPrompt()`，AI 未初始化时不刷新；
     `read` 标记在极端 Unicode 文件名下可能不命中（仅表现为普通卡片）
2. **`docs/product/ai-skills.md` §七 测试与验证**：补本阶段新增的测试命令
   （照 47 的先例：新增断言组必须写进检查清单）
3. **`AGENTS.md`**：若新增独立测试文件（`tests/test-skill-picker-model.js`），
   按 `test-builtin-skills-seeder.js` 的先例在相应小节的测试清单里列出
   （AGENTS.md 当前**未**列 `tests/test-ai-skills.js`，故若沿用该文件则无需改 AGENTS.md）
4. **`docs/product/ai-skills.md` §六 已知限制**：补「`allowed-tools` 仍不展示」不变（O3 未变），
   并**新增**「技能文件改动后需重开对话才反映到已注入的历史消息」（D-09 的生态预期）。

---

## Validation Architecture

> 项目配置 `workflow.nyquist_validation: true`（`.planning/config.json`）→ 本节为 plan-phase 生成
> `48-VALIDATION.md` 的依据。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert`（Node 内置，零框架依赖）；渲染端 DOM 接线可选 Playwright `_electron`（既有先例 `tests/test-unified-navigation.js`） |
| Config file | none —— 单文件脚本式，照 `tests/test-ai-skills.js` / `tests/test-builtin-skills-seeder.js` |
| Quick run command | `node --test tests/test-ai-skills.js` |
| Full suite command | `node --test tests/test-ai-skills.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-builtin-skills-seeder.js tests/test-ai-conversations.js` |
| Estimated runtime | ~1–3 s（本会话实测 `test-ai-skills.js` = 64 例 / **1.02 s**） |

**实测基线（研究阶段已跑，2026-09-12）**：`node --test tests/test-ai-skills.js` →
`# tests 64 / # suites 14 / # pass 64 / # fail 0 / # duration_ms 1022`。
**任何回归都必须以这 64 例为地板。**

**新增测试文件的落点（推荐，理由见下）**：

| 文件 | 覆盖 | 为什么放这里 |
|------|------|-------------|
| `tests/test-ai-skills.js`（**扩展**） | main 侧全部：投影（tier / promptOmitted / 收窄）/ 实时读盘 / 组装顺序 / 重载装饰 / read 标记 / D-18 措辞 | 技能基础设施的既有单文件；`readSource()` + 临时 workspace 注入设施已在（`:26-60`） |
| `tests/test-skill-picker-model.js`（**新增**） | renderer 侧纯逻辑：`/skill:` 解析、args token 取值、过滤两档、展平 + selectable、边界矩阵 | `src/renderer.js` 是浏览器脚本、无 `module.exports`，纯 Node 无法 require；把纯逻辑抽到 `src/skill-picker-model.js`（双模式导出）后即可秒级测试 |

> **双模式导出是本阶段引入的**一个**新模式**（`src/model-family.js` 用裸 IIFE + `window.`，不可 require）。
> 理由：D-04 的裸名边界语义、D-03 的两档排序、args 取值是本阶段**最容易出静默错**的三处规则，
> 必须表驱动覆盖；把它们留在 `renderer.js` 里只能靠 Playwright 或人工验证。
> **备选（若 plan 期不接受新模式）**：把纯函数留在 `src/renderer.js`，用
> `tests/test-unified-navigation.js` 同款 Playwright `_electron` 驱动真实 dev 应用做断言——
> 代价是慢、需 GUI 环境、断言脆弱。**二者择一，但必须有一处覆盖**。

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | `/` 展平数组 = 技能分区 + 命令分区；实时过滤 | unit | `node --test tests/test-skill-picker-model.js` | ❌ Wave 0 |
| DISC-01 | 面板投影经 IPC 到达 renderer（形状 + 零正文） | unit | `node --test tests/test-ai-skills.js` | ✅（断言组新增） |
| DISC-02 | 组装 = `<skill …>…</skill>\n\n<provenance>\n\n<args>`（逐字节） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-02 | 拼接顺序 `[技能块, visionNotice, markerBlock, visionBlock, contextBlock]` | unit + 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-03 | 技能调用**进历史**（`agent.prompt` 收到增强文本）+ `_ensureConversation` 收原始语法文本 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-03 | renderer 不再把技能走 `handler` 分支（`kind` 分流） | 源码扫描 | `node --test tests/test-skill-picker-model.js` | ❌ Wave 0 |
| DISC-04 | 三档 `tier` 判定（user / seeded / 非 seeded managed） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-04 | 遮蔽条目可见（投影保留 `shadowed` + `shadowedBy`） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-05 | `matchSkillByPath` 四类路径（绝对命中 / 相对命中 / 非 SKILL.md 不命中 / 工作区外不命中） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-05 | `read` 事件带 `skill_invocation`；renderer 映射到 `toolExecution.skillInvocation` | unit + 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-05 | D-18 措辞存在且技能段未被改写 | 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增 + 既有 `:1184`） |
| DISC-06 | 不存在 / 被跳过 / 读盘失败 → 结构化错误 + system-note 文案 | unit | `node --test tests/test-ai-skills.js`（main 侧错误码）+ `tests/test-skill-picker-model.js`（renderer 分支选择） | ✅/❌ |
| DISC-07 | `disableModelInvocation` **可**显式调用，且**不**被标 `promptOmitted` | unit | `node --test tests/test-ai-skills.js` | ✅（新增） |
| DISC-07 | 面板行打「仅显式」标记 | 源码扫描 + unit | `node --test tests/test-skill-picker-model.js` | ❌ Wave 0 |
| （P8） | 面板刷新调用 `syncAgentSystemPrompt()`；`syncAgentSystemPrompt` 函数体未被重构 | 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（既有 `:1278` 继续绿 + 新增调用点断言） |
| （硬约束） | 实时读盘：改盘后立即调用读到新正文；跨轮不重读 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） |

### 需要的断言组清单（按用户要求的五类归并）

**A. 解析（`tests/test-skill-picker-model.js`）**

1. `parseSkillRef` 正例：`/skill:foo`、`/skill:foo a b`、`/foo`、`/foo a b`
2. `parseSkillRef` 边界反例：`/foobar`（对 `foo` 不命中）、`/foo-bar`（对 `foo` 不命中）、
   `/`、`/skill:`（空名）、`/skill:Foo`（大写不符 `^[a-z0-9-]+$`）、`/Skill:foo`（前缀大小写敏感）
3. **本地命令优先**：`SLASH_COMMANDS` 含 `clear` 时 `/clear` 返回 command 而非 skill（即使存在同名技能）
4. `extractArgs` 七组表（事实 2 的表**逐行照抄**为断言）
5. `parseSkillRef` 与 main 侧 `parseSkillInvocationText` 的**规则一致性**：
   两处对同一组输入产出相同 `{name, args}`（**跨进程契约的防漂移断言**）

**B. 面板过滤 / 展平（`tests/test-skill-picker-model.js`）**

6. 空过滤 → 全部技能进前缀档，description 档为空，分区顺序「技能 → 命令」
7. name 前缀命中排前、description 子串命中排后（构造两个技能各占一档）
8. 命令分区：`startsWith` 语义与相对顺序与既有 `SLASH_COMMANDS.filter` 结果**逐项相等**
   （直接对既有实现跑同一 filter 做对照组，防「顺手改语义」）
9. 空分组标题不输出（技能 0 项 → 只有「命令」标题）
10. `/skill:fi` → 技能按 `fi` 过滤、命令分区为空（命令标题不渲染）
11. 展平数组顺序 === 渲染顺序（同一构造函数的输出被两处消费）
12. `selectable` 判定：`shadowed` → false；与本地命令同名 → false；其余 → true
13. `slashPickerSelectable` 取模：跳过不可选中、全不可选中时 `activeIndex = -1`

**C. 边界行为（两个文件分工）**

14. 八行状态矩阵（§2.8）逐格断言：
    - main 侧：`readSkillForInvocation` 对 `disabled` → `{ok:false, reason:'disabled'}`；
      `shadowed` → 不命中（`not_found`）；`overLimit` / `promptOmitted` → **成功**（D-12 可调用）；
      `disableModelInvocation` → **成功**（DISC-07）
    - renderer 侧：name 查找顺序（未找到 → 未找到文案；disabled → 禁用文案）
15. `disableModelInvocation` ≠ `disabled`（两个 flag 的独立性断言，同时存在）
16. 磁盘 SKILL.md 被删 / 被换成别名的技能 → `not_found`（不冒名注入）

**D. 实时读盘 / 注入顺序（`tests/test-ai-skills.js`）**

17. 实时：写技能 → `readSkillForInvocation` → 改盘 →**再次**调用读到新正文
18. 不重读：历史里的 `<skill>` 块不因磁盘变化而改写（对 `getAgentMessages` 的输出断言）
19. 组装逐字节：`buildSkillInvocationBlock` 输出 === `formatSkillInvocation(skill, provenance + '\n\n' + args)`
20. 顺序：`[skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]`
    （以 `indexOf` 断言五段的相对次序；无技能时输出与改动前**逐字符相同**）
21. `skill.content` 为空 → 组装被拒（不得产出 `undefined`，P-48-03 的回归守卫）
22. `_deriveConversationTitle('/skill:x')` → `/skill:x`；`('/skill:x  '+...)` 截断 30 字符；`('')` → `新对话`
23. 投影收窄：`getSkillsForUI()` 的每个条目**不含** `content` / `filePath` / `diagnostics`
24. `promptOmitted` 只在预算丢弃的条目上为 true（构造 3 个超预算技能 + 1 个 `disable-model-invocation`，
    断言后者为 false —— P-48-08 的回归守卫）
25. tier：`source==='user'` → `user`；seeded 名 → `builtin`；非 seeded managed → `managed`
    （seeded 集合**由测试注入**，不依赖真实 `skills-builtin/`，规避 P-48-07）
26. read 标记：绝对 / 相对 / 非 SKILL.md / 工作区外 四例
27. 重载装饰：把增强消息塞进临时对话库 → `getConversationMessages` 还原出
    `{content: args, skillInvocation:{name, tier, content}}`；与 live 路径的对象形状断言一致

**E. 源码扫描型护栏（跨文件，防「顺手改坏既有语义」）**

28. `SLASH_COMMANDS` 未被技能 push（数组字面量仍是 `clear` / `compact` 两条）
29. `renderer.js` / `preload.js` / `ipc-handlers.js` 零出现 `64 * 1024` / `50` / `8000` 的限额字面量
30. `renderer.js` 不出现 `fetch('/api/skills`（Phase 38 事故护栏）
31. `syncAgentSystemPrompt` 函数体**未**被重构（既有 `:1278-1296` 五条断言继续绿）；
    新增恒真断言：`ai-manager.js` 内存在 `syncAgentSystemPrompt()` 的**生产调用方**
    （source-scan：`await this.syncAgentSystemPrompt()` 出现在 `refreshSkillsForPanel` 之类的方法体内，
    且该方法被 `refreshSkillsForPanel` 之外的 IPC 注册处引用）
32. `_ensureConversation(message)` 出现 / `_ensureConversation(enhanced` 不出现
33. `REALM_SYSTEM_PROMPT` 含「技能」与「工具」，且 `buildSystemPrompt()` 的技能段
    `=== buildSkillsPrompt()` 返回值
34. CSS 契约存在性：`.slash-picker-group-header` 有 `position: sticky` + 显式背景；
    `--skill-source-user|builtin|managed` / `--skill-limit-text` 在**两个**主题块都定义
35. 转义：`renderSlashPickerList` 的技能行模板对 `name` / `description` 调 `escapeHtml`

### Sampling Rate

- **Per task commit:** `node --test tests/test-ai-skills.js`（~1 s）
- **Per wave merge:** `node --test tests/test-ai-skills.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-builtin-skills-seeder.js tests/test-ai-conversations.js`
- **Phase gate:** 全绿 + `node tests/test-skill-picker-model.js`（或 `--test`）全绿，再进 `/gsd-verify-work`
- **Max feedback latency:** ~3 s

### Wave 0 Gaps

- [ ] `src/skill-picker-model.js` —— 纯逻辑抽取（双模式导出），无它则 A/B/C 三组断言无处可测
- [ ] `tests/test-skill-picker-model.js` —— A/B/C 组宿主（含 `readSource('src/renderer.js')` 的接线断言）
- [ ] `tests/test-ai-skills.js` 扩展 —— D 组（实时读盘 / 组装顺序 / 投影 / tier / promptOmitted / read 标记 / 重载装饰）
- [ ] **测试夹具**：seeded 集合注入辅助（`seeder.setBuiltinDepsForTest({ srcDir })` 的 `t.after` 复位），
      否则任何触达 tier 的断言以 TypeError 失败（P-48-07）
- [ ] 无需框架安装（`node:test` 内置）

**无缺口时的表述**：若 plan 期选择 Playwright 路线替代 `src/skill-picker-model.js`，
则 Wave 0 缺口变为「扩展 `tests/test-unified-navigation.js` 同款 Playwright 断言组」
（需 GUI 环境 + `npm run dev` 独立 userData，实测耗时与稳定性风险显著更高）。

### Backstop（唯一一条，无法自动化裁决）

| # | Statement | verification |
|---|-----------|--------------|
| 1 | 50+ 技能 + 两个 sticky 分组标题下，220px 面板的可视行数与观感可接受，分组与标注结构无需改动 | `backstop` → 无显式证据则 `human_needed` |

**实测口径建议**（给执行者的具体做法，避免「看了一眼」）：往 `agent-workspace/skills/` 生成
50 个最小技能（脚本 `for i in $(seq -w 1 50); do mkdir -p .../skills/skill-$i; printf -- '---\nname: skill-%s\ndescription: 测试技能 %s\n---\n\n正文\n' $i $i > .../skills/skill-$i/SKILL.md; done`），
然后 `npm run dev` 打开面板，记录：① 首屏可见行数；② 滚动到「命令」分区是否需多次滚动；
③ 行尾标注换行（`flex-wrap`）后的行高是否可读。**若不可接受，处理方式是调整面板高度常量**，
**不得**改动分组 / 标注结构（UI-SPEC 明文）。

---

## Security Domain

`security_enforcement: true` / `security_asvs_level: 1` / `security_block_on: high`
（`.planning/config.json`）。本阶段无新写路径、无文件系统写、无网络请求，
风险面集中在**渲染注入**与**IPC 边界**。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | 单一数据权威（main 投影）+ 无新增写路径；技能正文只在显式调用时进对话 |
| V2 Authentication | no | 无认证面（本地应用） |
| V3 Session Management | no | 不涉及 |
| V4 Access Control | yes | 新增 2 个 IPC 通道**必须** `assertTrustedSender(event)`（既有 AI 通道同款，`ipc-handlers.js:1681`） |
| V5 Input Validation | **yes** | `/skill:` 的 name 只作**查找键**（`^[a-z0-9-]+$` 校验），**绝不**参与路径拼接（路径取自缓存 `entry.skill.filePath`）；args 作为用户原文注入（用户自有文本，非新面） |
| V6 Cryptography | no | 不涉及 |
| V7 Error Handling | yes | 失败一律结构化错误 + system-note（D-13「不出现点了没反应」）；`skillError.message` 由 main 统一给 |
| V8 Data Protection | no | 不新增持久化面（复用既有 `messages.content`） |
| V12 Files/Resources | yes | `readSkillForInvocation` 的读路径来自缓存，不接用户输入；沙箱 `resolveInside` 既有约束不变 |
| V14 Configuration | yes | 限额常量继续单源 `LIMITS`（48 不得新增字面量） |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 面板 `innerHTML` 注入（技能 name / description 来自磁盘，51 起可来自网络） | Tampering / Elevation | `escapeHtml`（`src/renderer.js:10834`）包裹全部插值；tier→class 走白名单表；`read` 卡片侧走 `textContent` |
| 路径穿越（拿输入框里的 name 去 `path.join`） | Tampering | name 只作查找键；文件路径来自缓存条目；无任何 `path.join(userInput)` |
| 未受信 webContents 调 IPC 读技能集 / 触发刷新 | Spoofing / DoS | `assertTrustedSender(event)`（两个新通道都加） |
| 提示注入（技能 description 无条件进每次请求的 prompt） | Tampering | **Phase 46 既有已知限制**（`docs/product/ai-skills.md:80`），本阶段不新增面；**显式调用**时正文进对话是用户主动行为 |
| DoS：单次调用注入最大 64 KiB 正文 | DoS | 既有 `LIMITS.MAX_SKILL_MD_BYTES` 字节闸（超限技能根本不在缓存 → 不可调用） |
| 广播自激（`skills:changed` → 刷新 → 再广播） | DoS | §1.7 的「广播只重拉投影」硬约束 + P-48-06 断言 |
| 重载路径把库内容当 HTML | Tampering | 装饰层只做**字符串解析**，渲染仍走既有 `textContent` / 折叠块 `textContent`（UI-SPEC） |

**本阶段无新增 `<dialog>`**（UI-SPEC 明确「本阶段无破坏性操作」）→ 弹框居中约定不适用。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 全部测试与主进程 | ✓ | v22.22.0（`node -v`） | — |
| `@earendil-works/pi-agent-core` | 技能加载 / `formatSkillInvocation` | ✓ | 0.84.3（`node_modules` 实测） | — |
| Electron | 手动 UAT / Playwright 路线 | ✓ | 43（AGENTS.md 记录） | — |
| better-sqlite3（对话库） | 重载装饰断言 | ✓ | 既有依赖 | 无需外部服务 |
| Playwright（全局） | 仅可选 E2E 路线 | ✓（`~/.nvm/.../lib/node_modules/playwright`，`tests/test-unified-navigation.js:21` 在用） | — | 走 §Validation Architecture 的 Node 纯函数路线即可 |
| 图形界面 | 手动 UAT / Playwright | ✓ | — | — |

**Missing dependencies with no fallback:** 无
**Missing dependencies with fallback:** 无（本阶段零新增依赖）

**零新增 npm 依赖** → `## Package Legitimacy Audit` 不适用（无外部包安装）。
唯一可能新增的运行时依赖是「无」——`formatSkillInvocation` / `loadSkills` 均来自既有 SDK。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 把技能块放进 `prompt()`（无附件路径）不会破坏既有行为 | §2.4 | 低：普通消息 `enhanced === message`，逐字节不变；有断言 |
| A2 | 面板打开即触发 `syncAgentSystemPrompt()` 的重扫成本（50 技能 ≈ 100 次沙箱 IO）在交互上可接受 | §1.7 | 中：若可感知卡顿，需加 `refreshedAt` 节流或改为「仅 `skills:changed` 时刷新」——但**不得**降级为「只用快照」（D-17 costly） |
| A3 | `read` 事件的 `args.path` 与缓存 `filePath` 在词法规范化后逐字符相等 | §3.2 | 中：若 realpath 漂移，表现为「读技能正文时显示普通 read 卡片」（功能不失效）；回退方案已给 |
| A4 | 50 技能规模下 `getSkillsForUI()` 投影（含投影构造）耗时可忽略 | §1.2/§1.4 | 低：纯内存 map，无线程阻塞 |
| A5 | 双模式导出（`src/skill-picker-model.js`）不违反项目既有约定 | Validation Architecture | 低：是新模式（无先例），但仅 3 行样板；备选路线已给出 |
| A6 | `page_snapshots` 列当前无显示消费方（故不取 hijack 方案） | §2.6 | 低：本会话 grep 全仓确认只在 `ai-conversations-manager.js` 内部读写，renderer 未读 |
| A7 | 面板打开时输入框保留 `/name` 原文的既有语义不改 | §1.1 | 低：UI-SPEC 明文「本阶段不改」 |

**需要用户/plan 期确认的**：A2（节流是否要做）、A5（新模块 vs Playwright 路线）、
`skillInvocation.source` 是否改用 `tier`（§1.3 命名警告）、`getSeededSkillNames()` 是否在本阶段加 fail-safe（事实 4）。

> **plan 期复核（原为「待确认」四项，均已被 48-01 / 48-02 裁决，本节不再有未决项）**：
> A2 → 48-02 Task 3（stale-while-revalidate：快照立即渲染 + 打开时后台刷新一次 + 广播只重拉快照，`digest` 相同早退）；
> A5 → 48-01 Task 1 ①（采用 `src/skill-picker-model.js` 双模式导出，Playwright 路线不取）；
> `skillInvocation.source` 命名 → 48-01 Task 1 ② 改用 `tier`（`sourceTierOf` / `toUISkillEntry` 产出 `tier`，与数据层 `source` 的语义/取值域区分开）；
> `getSeededSkillNames()` fail-safe → 48-01 Task 1 ③ 的 `getSeededSkillNamesSafe()`（try/catch + 空集合降级）。

---

## Open Questions (RESOLVED)

> 四条在 plan 期全部裁决完毕（下列每条的 `Recommendation` 即裁决口径），落点见各条末尾的 Resolution 行。

1. **(RESOLVED)** **`syncAgentSystemPrompt()` 作为面板刷新入口会不会有「副作用过大」之争？**
   - What we know: 它已实现「重扫 → digest 早退 → 回写 prompt → 广播」全套；不改其函数体就不会打红既有源码扫描断言。
   - What's unclear: 是否有人主张「面板刷新不该动 prompt」。
   - Recommendation: **坚持调用它**。面板与 prompt 必须同源，否则「bash 直改技能文件 → 面板看到新版、模型仍用旧版」——正是 P8 门禁要闭合的失效路径。
   - Resolution: 落地为 48-01 Task 2 的 `refreshSkillsForPanel()`（`await this.syncAgentSystemPrompt()` → 返回新投影），`syncAgentSystemPrompt()` 函数体逐字保持；D-18 措辞在同一任务落地。

2. **(RESOLVED)** **`promptOmitted` 字段名是否与 Phase 50 的列表口径对齐？**
   - What we know: 50 要展示诊断与状态，D-12 的两态文案已在 UI-SPEC 锁定。
   - What's unclear: 50 是否希望用别的字段名（如 `inPrompt: false`）。
   - Recommendation: 用**正向**语义命名 `promptOmitted`（true = 未进提示词），并在产品文档 §四 限额节登记该字段，
     供 50 直接复用。
   - Resolution: 采用正向语义名 `promptOmitted` —— 48-01 Task 1 在 ⑦ 尾部打标并纳入收窄投影，48-02 Task 2 在面板行尾标注消费，Phase 50 可直接复用该字段。

3. **(RESOLVED)** **`read` 卡片的技能标记在重载后重建，会不会与「不额外插 system-note」冲突？**
   - What we know: D-15 要求不插 note（信息重复）。
   - What's unclear: 重载重建是否被视为「新功能」而超范围。
   - Recommendation: 做（§3.3），理由是「同一份实现两处调用」比「两条路径行为不同」便宜得多，
     且零新增 UI 形状。
   - Resolution: 做 —— 48-03 Task 2 在 `getConversationMessages` 内用**同一个** `_resolveSkillMarker` 重建；不插 system-note、不新增卡片形状。

4. **(RESOLVED)** **面板空态（只显示「命令」分区）在 2 个内置技能都 `disable-model-invocation` 时是否真的空？**
   - What we know: 两个内置技能 `disable-model-invocation: true`（`skills-builtin/*/SKILL.md` 实测），
     但它们**仍进面板**（只有「仅显式」标记）——空态只在「零技能或全禁用」时出现。
   - Recommendation: 断言组 9 的分组空态用**注入的**技能集构造，不依赖真实 `skills-builtin/`。
   - Resolution: 48-02 Task 1 的 B 组按**注入技能集**构造空态 / 分区断言，不依赖真实随包目录（与 tier 断言同一策略）。

---

## Sources

### Primary（HIGH confidence）

- `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:8-11`（`formatSkillInvocation` 实现）、
  `skills.d.ts:14-15`（签名）、`types.d.ts`（`Skill` 五字段）、`skills.js:226-233`（`loadSkillFromFile` 返回形状）、
  `skills.js:88-103`（根层 `SKILL.md` 短路 = 单目录读盘依据）、`skills.js:307-313`（`dirnameEnvPath`）、
  `index.d.ts:13` / `index.js:15`（包根导出链）、`harness/tools/read.js:5-9`（`read` 参数名 `path`）、
  `harness/tools/path-utils.js`（`resolveReadToolPath` 变体）、`harness/env/nodejs.js:25-43,310-312`（`resolvePath` / `absolutePath`）、
  `harness/prompt-templates.js`（`substituteArgs` 属 `PromptTemplate`，与 `Skill` 无关）
- 本机运行探针：`formatSkillInvocation` 三例输出（含缺 `content` → `undefined`）、
  `getSeededSkillNames()` 在纯 Node 抛 `TypeError`、`rest` 取值 7 组表
- `ai-skills-manager.js:32-36`（`LIMITS` 逐字）、`:39-61`（条目形状）、`:91-104`（digest 输入清单）、
  `:196-198`（`inContractLayout`）、`:255-263`（`toRealmDiag`）、`:298-304`（`isDescriptionUnusable`）、
  `:323-335`（`enforceDirNameAuthority`）、`:353-374`（`applyShadowing`）、`:396-406`（`bySkillPriority`）、
  `:440-626`（`refreshSkills` 全管线，⑦ 在 `:576-611`）、`:637-639`、`:648-655`、`:662-668`
- `ai-manager.js:479-528`（`REALM_SYSTEM_PROMPT`）、`:580-584`（`buildSystemPrompt`）、
  `:96-118`（惰性 require 先例）、`:845-855` + `:2576-2583`（rootDirs 注入先例）、
  `:977-1046`（`prompt`）、`:1089-1276`（`promptWithContext`，组装在 `:1229-1232`）、
  `:1305-1341`（`_ensureConversation` / `_deriveConversationTitle`）、
  `:1428-1511`（`_setupEventBroadcasting`，`tool_execution_start` 在 `:1474-1485`）、
  `:2116-2124`（`saveCurrentConversation` 落库来源）、`:2467-2469`（`getConversationMessages`）、
  `:2512-2541`（`syncAgentSystemPrompt` + `broadcast('skills:changed')`）
- `src/renderer.js:280-282`、`:334-337`、`:7952-8150`（`renderAIMessages`，user 分支 `:8030`）、
  `:8663-8778`（`handleSendAIMessage`，斜杠分支 `:8673-8691`，元数据挂载 `:8720-8735`，IPC `:8754-8762`）、
  `:8794-8802`（`pushSystemNote`）、`:8804-8815`（`abortAIIfStreaming`）、`:8820-8830`、`:8832+`、
  `:8990-9115`（`handleAIStream`，tool 更新 `:9013-9053`，错误 `:9070-9111`）、
  `:9224-9330`（`renderToolCard`，名称分支 `:9259-9265`）、`:9480-9500`（`renderToolCards`）、
  `:9768-9802`、`:9810-9826`、`:9831-9878`、`:9880-9898`、`:9900-9955`、`:10834`（`escapeHtml`）
- `ai-conversations-manager.js:66-78`（messages 表列）、`:142-166`（`serializePageSnapshots`）、
  `:193-254`（`normalizeMessageColumns`）、`:289-316`（`parseStoredContent`）、`:570-665`（`getMessages`，
  `<context-summary>` 特判 `:641-651`，user 行 `:653-660`）、`:693`（`getAgentMessages`）
- `ipc-handlers.js:1680-1717`（`ai:prompt` / `ai:prompt-with-context`）、`:8-30`（模块依赖）
- `src/preload.js:975-1060`（`ai:` 命名空间与 `onEventsBatch`）、`:724-726`（`onIpcMessage`）
- `builtin-skills-seeder.js:60-70`、`:92-111`、`:526-531`、`:20-24`（不 throw 契约）
- `window-manager.js:310-316`（`broadcast`）、`main.js:140` / `:4045-4048`（播种接线）
- `agent-workspace.js:140-198`（`resolveInside` 双基准）、`:200-240`（`createSandboxEnv`，`cwd: root` 在 `:234`）
- `src/index.html:861-863`、`src/styles/main.css:6973-7019`、`:7-42`（两主题令牌块）、`:5627`（`--ai-panel-min-width`）
- `tests/test-ai-skills.js`（64 例基线 / `readSource`+`functionBody` 断言设施 / `:1171` `:1184` `:1218` `:1278` 既有断言组）、
  `tests/test-builtin-skills-seeder.js:368`（`setBuiltinDepsForTest` 使用先例）、
  `tests/test-unified-navigation.js:21`（Playwright `_electron` 先例）
- `.planning/phases/48-skill-name/48-CONTEXT.md`、`48-UI-SPEC.md`、`.planning/REQUIREMENTS.md:30-38`、
  `.planning/ROADMAP.md:225-247`、`.planning/STATE.md:220-224`、`.planning/config.json`

### Secondary（MEDIUM confidence）

- `.planning/research/FEATURES.md:185-247`（`formatSkillInvocation` 注入原语、omp 两模板、命名形态、defer 清单）
- `.planning/research/ARCHITECTURE.md:757-806`（Anti-Pattern 1–8，本阶段直接相关为 4 / 5 / 6）
- `.planning/research/SUMMARY.md:55-95`（tier 2 层、P8 失效链 6 点、Anti-Features）
- `docs/product/ai-skills.md:28-108`（现有八节结构，本阶段补第九/第十节）
- `docs/product/ai-agent-workspace.md`（技能不构成额外权限 / `allowed-tools` 免责标注）

### Tertiary（LOW confidence）

- 无。本阶段未使用 WebSearch（全部结论来自仓内源码、SDK 源码或本机运行探针）。

---

## Metadata

**Confidence breakdown:**

- **Standard Stack: HIGH** —— 零新增依赖；SDK 版本与导出面经源码直读 + 运行探针双重确认；
  `formatSkillInvocation` 的签名与返回形态有 `.d.ts` + 实现源码 + 实测输出三份证据。
- **Architecture: HIGH** —— 全部落点均为 file:line；三条实现面的落点清单可直接转成任务；
  唯一的架构裁量项（tier 组合点、`read` 标记位置）已给出推荐 + 理由 + 备选。
- **Pitfalls: HIGH** —— 前四条硬事实均为**本机实测**（`rest` 吞 args、`undefined` 注入、
  `getSeededSkillNames` 抛错、`promptOmitted` 缺字段），不是推理；其余为源码级。
- **UI 观感（220px @ 50 技能）: LOW** —— 列为 backstop，需真实数据集的人工确认
  （UI-SPEC 同步列为唯一 backstop 行）。

**Research date:** 2026-09-12
**Valid until:** 2026-10-12（30 天；SDK 升版需复核 `formatSkillInvocation` / `read` 参数名 /
`Skill` 五字段 / `loadSkills` 根层短路语义 —— 这四处是本阶段的 SDK 契约面）

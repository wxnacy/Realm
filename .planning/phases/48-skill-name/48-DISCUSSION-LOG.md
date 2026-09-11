# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-12
**Phase:** 48-技能发现与调用（`/` 面板 + `/skill:name`）
**Areas discussed:** 面板呈现与过滤, 调用语义与消息形态, 边界技能行为, 徽标与可见性

---

## 面板呈现与过滤

### 问题 1：本地命令与技能如何在同一个面板里共处？

| Option | Description | Selected |
|--------|-------------|----------|
| 分区（技能 / 命令） | 两个 sticky 小节标题；技能可达 50+，命令永远只有两条；与 Claude Code 一致。代价：渲染要从单层 items.map 改成分组渲染 | ✓ |
| 平铺单一列表 | 保持现有单层 items.map，仅把技能数组拼在命令数组前/后。改动最小、与键盘导航零冲突。代价：技能多时需滑到底才能看到 /clear | |
| 平铺但命令置底 | 技能在前、命令固定置底；仍用单数组 | |

**User's choice:** 分区（技能 / 命令）
**Notes:** 用户先追问「如果是分区的话，UI 长什么样子？给我画一下」——给出 ASCII mockup（两个 sticky 分组标题 + 行内 `/name` mono 粗体 + 徽标 pill + 描述 ellipsis + 被遮蔽行降调）后选定分区。已在 CONTEXT D-01 记下实现约束：底层仍须展平为单数组 `state.slashPickerItems`（键盘 ↑↓ 与 `executeActiveSlashCommand` 依赖单索引）。

### 问题 2：面板每行显示哪些信息？

| Option | Description | Selected |
|--------|-------------|----------|
| 名称+徽标+描述+仅显式标记 | 另在 disable-model-invocation 技能上加「仅显式」窄标记；不显示体积/文件数/诊断（Phase 50 职责） | ✓ |
| 名称+徽标+描述（最轻） | 只加来源徽标；disable-model-invocation 与普通技能长得一样 | |
| 再加体积/文件数/诊断 | 额外把体积/文件数/诊断缩略显在行尾；会把 Phase 50 职责提前到 48 | |

**User's choice:** 名称+徽标+描述+仅显式标记

### 问题 3：面板过滤匹配到什么就列出？

| Option | Description | Selected |
|--------|-------------|----------|
| name 前缀 + description 子串兜底 | 前缀命中排前、描述命中排后；50+ 技能时用户想不起名字也能找到 | ✓ |
| 只匹配 name 前缀（现状） | 一行不改，确定性最强，但只记得用途就找不到 | |
| name+description 子串包含 | 最宽松，但会改变 clear/compact 的现有匹配语义、命中面大时排序难解释 | |

**User's choice:** name 前缀 + description 子串兜底

### 问题 4：技能行在面板里显示什么、选中后做什么？

| Option | Description | Selected |
|--------|-------------|----------|
| 行显 /name，选中即执行 | args 取输入框多余文本；主进程同时识别 /skill:name 形式 | ✓ |
| 行显 /skill:name，选中即执行 | 所见即所得、与 DISC-02 字面一致；代价是行内多一截前缀 | |
| 选中只填入输入框待补 args | 保留焦点让用户补参数；与 clear/compact 的立即执行心智不一致 | |

**User's choice:** 行显 /name，选中即执行
**Notes:** 由此推导出 D-04 的配套规则 —— 裸 `/name` 与 `/skill:name` 都识别、本地命令优先，避免「点了能用、照着打不认」的分裂。此处与 `.planning/research/FEATURES.md` §4.1 的建议（v1 不做裸名兼容）有偏离，已在 CONTEXT D-04 标注为 costly 并记录理由。

---

## 调用语义与消息形态

### 问题 1：`/skill:name` 后面的文本怎么用？

| Option | Description | Selected |
|--------|-------------|----------|
| SDK 原文追加 + 一行「用户显式调用」声明 | `<skill>` 块后追加 provenance 一行，args 原文追加；不做 $ARGUMENTS 替换 | ✓ |
| 纯 SDK 原文追加（不加声明） | 最贴 SDK 契约、零自研文本；模型无法区分「用户点名」与「自己 read」 | |
| 分两条消息发（模拟 omp 分模板） | 先 `<skill>` 块一轮、再带声明的 args 一轮；多一次 LLM 往返与两个气泡 | |

**User's choice:** SDK 原文追加 + 一行「用户显式调用」声明
**Notes:** 用户对本问题提出澄清请求「omp 是怎么做的」。查证 `.planning/research/FEATURES.md` §3/§4 后给出：omp（oh-my-pi）用**两套注入模板**（`user-invocation.md` 明说「用户调用了这个技能」+ `autoload.md` 仅 provenance），原文理由是 **"these hidden messages must not claim the user invoked them"**；而 `pi-agent-core` 的 `formatSkillInvocation` 只有一种形态（`<skill>` 块 + `additionalInstructions` 原文追加），且 **SDK 的 `<skill>` 块里没有任何「用户显式调用了它」的声明**。据此重问后用户选了「补一行 provenance 声明」。另记录 omp 的两条被继承结论：① 投递时机不做排队（v1）；② 正文注入即普通消息、跨轮保留、不重读文件。

### 问题 2：调用发出后，用户气泡显示什么？

| Option | Description | Selected |
|--------|-------------|----------|
| 技能徽标 pill + args 正文 | 消息对象挂 {name, source} 元数据（对齐 referencedTabs / attachments） | ✓ |
| 显示输入原文 | 与 /clear 等本地命令呈现一致，零新渲染形状 | |
| 徽标 + /skill:name 原文 + args | 信息最全但气泡偏吵 | |

**User's choice:** 技能徽标 pill + args 正文

### 问题 3：技能调用的正文如何入库、重开老对话时怎么还原？

| Option | Description | Selected |
|--------|-------------|----------|
| 完整入库，重放旧正文 | 对齐生态（FEATURES.md:201「注入即普通消息、跨轮保留、不重读文件」） | |
| 完整入库 + 气泡可展开看正文 | 同上，另给「技能正文（N 字符）」折叠块，用户可知喂了什么 | ✓ |
| 存引用，重读盘面拼回 | 与「历史不可变」冲突，且 agent.state.messages 已是纯文本 | |

**User's choice:** 完整入库 + 气泡可展开看正文

### 问题 4：技能调用与附件/@ 引用同时出现时，技能块拼在哪？

| Option | Description | Selected |
|--------|-------------|----------|
| 技能块置最前 | [技能块+provenance+args, visionNotice, markerBlock, visionBlock, contextBlock] | ✓ |
| 技能块置附件之后、引用之前 | 保留「附件先行」的既有语义 | |
| 技能与附件/引用互斥 | 语义最干净但会静默丢弃「调技能 + 附文件」的合理诉求 | |

**User's choice:** 技能块置最前

### 附：默认采纳项（未单独提问）

**流式中触发技能调用 → 先 abort/等待再发**（复用 `abortAIIfStreaming()`，与 `/clear`、`/compact` 一致）；v1 不做 steer / followUp 排队。依据 `.planning/research/FEATURES.md:199` 的同款建议。已向用户声明按默认采纳，用户未提出异议。

---

## 边界技能行为

### 问题 1：调用不存在的技能时，错误怎么呈现？

| Option | Description | Selected |
|--------|-------------|----------|
| system-note 提示原因 | 沿用现有「未知命令」路径，`/skill:foo` 与裸 `/foo` 文案区分 | ✓ |
| 面板保持打开 + 内联错误 | 恢复路径最短，但需新建面板内错误态与输入框选区处理 | |
| 错误弹框 | 最显眼，但与聊天流其他错误的提示条风格不一致 | |

**User's choice:** system-note 提示原因

### 问题 2：对已被禁用的技能显式调用，怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 拒绝 + 提示去设置页启用 | 语义闭环：禁用是明确意图，两个入口都不该沉默绕过 | ✓ |
| 允许显式调用（禁用只管自动匹配） | 与 disable-model-invocation 语义一致，但面板里看不到它、无法从 UI 发现 | |
| 允许但先确认 | 保留逃生通道，但与 /clear、/compact 的无确认风格不一致 | |

**User's choice:** 拒绝 + 提示去设置页启用
**Notes:** 讨论中特别澄清了一个易混点：`disabled`（46 D-09 的二元开关）与 `disable-model-invocation`（DISC-07 的 flag）**不是一回事** —— 后者**可以**显式调用。

### 问题 3：被遮蔽的同名技能在面板里怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 可见但灰显不可调用 | 行尾标「已遮蔽 · 由用户同名技能胜出」；手打一律作用胜出者 | ✓ |
| 可点，但执行胜出版本 | 行为没错，但点了 A 执行 B 会让用户误解 | |
| 面板不列（仅设置页诊断） | 与 ROADMAP 判据 3「被遮蔽的同名技能可见」字面冲突 | |

**User's choice:** 可见但灰显不可调用

### 问题 4：超限技能（未进 system prompt）在面板与调用上怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 列出 + 可调用 + 标注未进提示词 | 显式调用是这些技能唯一可用路径，且透明告知「为什么模型不会自动用」 | ✓ |
| 列出但灰显不可调用 | 与遮蔽一致，但超限只是「排不进预算」不是「不可用」 | |
| 面板不列 | 用户在聊天框里找不到自己装过的技能、也不知道为什么 | |

**User's choice:** 列出 + 可调用 + 标注未进提示词

---

## 徽标与可见性

### 前置说明（未作为问题提出）

- **三档徽标的数据源已由 Phase 47 D-11 锁定**（`getSeededSkillNames()` 扫随包 `skills-builtin/` 目录名，零状态文件），故本区域只问呈现与可见性，不重问「要不要三档」。
- **工具调用本来就有卡片渲染**（`renderToolCard`，`src/renderer.js:9224`），模型自动 `read` 技能正文时用户已能看到一张 `read` 卡片。

### 问题 1：模型自动匹配技能时，UI 怎么呈现？

| Option | Description | Selected |
|--------|-------------|----------|
| read 卡片特殊化为「使用技能 X」 | 参数落在 skills/ 或 managed-skills/ 下的 SKILL.md 时改标题 + 加徽标；其余 read 卡片不变 | ✓ |
| 沿用通用 read 卡片 | 零改动，但 50+ 技能时用户难看出这是技能而非普通文件读取 | |
| 卡片特殊化 + 额外系统提示条 | 更显眼，但与 tool card 信息重复且自动匹配可能多次 | |

**User's choice:** read 卡片特殊化为「使用技能 X」

### 问题 2：面板打开时技能列表怎么取、什么时候刷？

| Option | Description | Selected |
|--------|-------------|----------|
| 快照先渲染 + 后台重扫 + 听广播 | stale-while-revalidate：立即渲染 → await refreshSkills() 原地重渲染 → 监听 skills:changed | ✓ |
| 只拉快照 + 听广播 | 成本最低，但「bash 直改后立即打开面板」会看到上一版 | |
| 先扫盘再显示 | 数据最确定，但输入 / 后要等全盘扫描（上限约 3.2MB）才出现面板 | |

**User's choice:** 快照先渲染 + 后台重扫 + 听广播
**Notes:** 现状事实 —— `ai-manager.js:2541` 已广播 `skills:changed`，但 **renderer 侧零监听**；`getSkillsSnapshot()` 是同步浅拷贝，**当前无任何 IPC / realmAPI 暴露给 renderer**，本阶段需新增通道。

### 问题 3：技能调用时 renderer 向主进程发什么？

| Option | Description | Selected |
|--------|-------------|----------|
| 发完整语法文本，主进程解析 | 标题自然派生成「/skill:find-skills 帮我找 X」，无 args 时也不退化 | ✓ |
| args 文本 + 独立 skillName 字段 | 接口最显式，但无 args 时 message 为空 → 标题退化成「新对话」 | |
| renderer 拼好增强文本再发 | 主进程最简，但标题会变成 `<skill name="find-skills" locat` 这类垃圾 | |

**User's choice:** 发完整语法文本，主进程解析
**Notes:** 本问题由讨论中发现的风险驱动 —— `_deriveConversationTitle()`（`ai-manager.js:1338`）取原始消息**前 30 字符**当对话标题。

### 问题 4：要不要修正「模型把 tool 也叫技能」的措辞？

| Option | Description | Selected |
|--------|-------------|----------|
| 本阶段在第 1 段补一句 | 动 `REALM_SYSTEM_PROMPT`，不碰技能段（尊重 46 D-02）；代价是前缀缓存重建一次 | ✓ |
| 不改 prompt，只记文档 | 把现象写进 `docs/product/ai-skills.md` 已知限制 | |
| 不做任何处理 | 最低成本，但 STATE.md 会继续挂该待办 | |

**User's choice:** 本阶段在第 1 段补一句
**Notes:** 出处 `.planning/STATE.md:224`。

---

## Claude's Discretion

- **面板内同档位条目的排序** —— 建议沿用 `ai-skills-manager.bySkillPriority` 的确定性全序（user > 可自动激活 > name 码点序），不得改用区域敏感比较。
- **新增 IPC / realmAPI 通道的命名与形状** —— `realmAPI.ai.*` 下新增，具体形状交 plan 期。
- **`skills:changed` 广播 payload 是否携带变更摘要** —— 现为无参广播，是否加 payload 交 plan 期。
- **面板空态** —— 本阶段不做「如何获得技能」引导（设置页导入入口 Phase 50 才存在）。
- **`read` 卡片识别的判定位置** —— 主进程打标记 vs renderer 按路径匹配；判据是必须在工具事件生成侧判定（renderer 不掌握技能目录权威路径）。
- **`/skill:` 作为过滤 token 时的行为** —— 研究提到「输入 `/skill` 就只显示技能」是 `/skill:` 命名空间立项的第三条理由；本阶段未列为独立决策，交 plan 期按实现决定。
- **待实测项** —— 220px 高度在 50 技能 + 两个 sticky 标题下的观感；分组渲染后单数组化是否引入索引漂移。
- **是否走 `/gsd:ui-phase 48`** —— ROADMAP 标了 `UI hint: yes`，规划时考虑是否需要设计契约。

## Deferred Ideas

- **mid-prompt 嵌入 `/skill:<name>` token**（omp 支持）—— `FEATURES.md:241-247` 明确 P3 defer。
- **技能堆叠调用** `/a /b 123` —— `FEATURES.md:237` P3 defer。
- **`$ARGUMENTS` / `$N` / 命名参数 / `${CLAUDE_SKILL_DIR}` 替换** —— ECO-04；pi-agent-core 完全不做字符串替换。
- **面板空态引导** —— 设置页导入入口 Phase 50 才有。
- **技能正文经 `/compact` 保留** —— ECO-03；O8 已在 Phase 46 落定为「不保留」。
- **`allowed-tools` 的解析与展示** —— O3；展示时必须带「当前运行时不被强制，仅供参考」免责标注。
- **四态可见性**（`on` / `name-only` / `user-invocable-only` / `off`）—— ECO-05；v1 只做二元 enable/disable。
- **诊断在面板内的展示** —— 归 Phase 50 设置页列表。
- **`syncAgentSystemPrompt()` 生产调用方收口** —— 本阶段无写路径，归 49/50/51；`STATE.md:222` 的 ⚠️ 仍挂着。

# Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-11
**Phase:** 46-prompt
**Areas discussed:** Prompt 拼装顺序, 刷新时机与降级, 遮蔽与诊断形态, 启停与限额

---

## Prompt 拼装顺序

### 问题 1 — 技能段插在四段 system prompt 的什么位置？

| Option | Description | Selected |
|--------|-------------|----------|
| 插在最后 | REALM + workspace + 记忆快照 + 技能段；前三段全静态，技能变更只影响末尾，冻结记忆段 prefix cache 恒命中。代价：技能段距 prompt 开头最远，注意力相对弱 | ✓ |
| 插在记忆快照之前 | REALM + workspace + 技能段 + 记忆快照；技能段紧贴工作区说明，语义更连贯。代价：技能变更令后面记忆段前缀缓存全失效 | |
| 按语义重排四段 | 技能段紧跟工作区段并把记忆快照排在其后；兼顾语义连贯与阅读顺序，同样接受记忆段缓存失效 | |

**User's choice:** 插在最后（推荐）
**Notes:** 无附加说明。

---

### 问题 2 — 技能段的文本用哪种形态？

| Option | Description | Selected |
|--------|-------------|----------|
| 原样拼 SDK 输出 | 直接拼 `formatSkillsForSystemPrompt` 返回值，零包装；SDK 前言（"Read the full skill file when the task matches its description" + 相对路径解析规则）是测试过的语义，不动就不漂移；空串时整段不追加 | ✓ |
| 加中文引导前缀 | 在 SDK 段前加一句中文引导；中文语境更连贯，但与 SDK 前言语义重复，且多一份需随 SDK 升级维护的文案 | |
| 自写中文段 | 不用 SDK 函数，自写中文 `<available_skills>`；文案完全可控，但丢失 SDK 前言语义与 `escapeXml` 防标签破坏 | |

**User's choice:** 原样拼 SDK 输出（推荐）
**Notes:** 讨论中确认了注入面判据——进 prompt 的只有 name / description / location；技能正文由模型按需经 `read` 工具打开 `<location>` 读取（渐进式披露），这也解释了"技能目录必须在硬沙箱内"这条硬约束。

---

## 刷新时机与降级

### 问题 1 — `refreshSkills()` 在哪些时机跑？

| Option | Description | Selected |
|--------|-------------|----------|
| 每次重建都重扫 | 每次 `_recreateAgent()` 前无条件 await 重扫；唯一能自动覆盖第 6 条（bash/write 直改）的机制；代价是切会话重读两目录（上限 ≈3.2 MB，仅切会话时发生） | ✓ |
| stat 差异才重解析 | 先 readdir + 逐技能目录 stat，mtime/条目集变化才重新解析；免去无变化的文件读取，但多一层"哪些算变化"的判定逻辑 | |
| 只靠显式变更路径 | 仅 init + 导入/卸载/启停/manage_skill/write 工具写 skills 后主动 refresh；最省 IO，但 bash 直改目录无法捕获，P8 门禁第 6 条残缺 | |

**User's choice:** 每次重建都重扫（推荐）
**Notes:** 无附加说明。

---

### 问题 2 — 加载失败时注入什么？

| Option | Description | Selected |
|--------|-------------|----------|
| 分层处理 | ① 单个 SKILL.md 失败 = 正常态，SDK warning 诊断 + 跳过该技能，其余照常注入；② 整批 refresh 抛错 → 保留上一次 good 快照 + error 级诊断，不让瞬时 IO 错误清空用户所有技能 | ✓ |
| 纯 fail-closed（清空） | 整批抛错即注入空段，宁可让模型看不到任何技能也不注入可能陈旧的快照；安全优先但一次瞬时错误会让用户以为技能全没了 | |
| 尽力注入已解析部分 | 忽略异常、尽力注入已解析部分 + 产诊断；最大可用性，但"部分成功"状态难判定，可能注入不完整的一批 | |

**User's choice:** 分层处理（推荐）
**Notes:** 无附加说明。

---

## 遮蔽与诊断形态

### 问题 1 — 同名遮蔽在数据层怎么表达？

| Option | Description | Selected |
|--------|-------------|----------|
| 保留并标记 shadowed | 技能集同时存在两条：user 版正常注入，managed 版标 `shadowed=true` + `shadowedBy=user`，不进 prompt、不计预算，留给 Phase 48/50 展示与诊断 | ✓ |
| 剔除，仅留诊断 | 去重即从技能集剔除 managed 版，仅在全量 diagnostics 记一条冲突；技能集更干净，但 48「被遮蔽可见」、50 展示被遮蔽条目需从诊断反推 | |
| 合并成单条目 | 同一 name 只保留一条并合并来源信息（`sources: ['user','managed']`）；列表最简洁，但无法告知覆盖关系 | |

**User's choice:** 保留并标记 shadowed（推荐）
**Notes:** 无附加说明。

---

### 问题 2 — 加载诊断在数据层怎么存？

| Option | Description | Selected |
|--------|-------------|----------|
| 内联 + 模块级 errors | `skill.diagnostics[]`（每条含 level/code/message，限额类带 limit + currentValue）+ 模块级 `errors[]` 承接"无对应技能"的整批错误；Phase 50 逐技能渲染直接可用 | ✓ |
| 单一扁平列表 | 单一扁平 `diagnostics[]`，每条带 name/filePath 供反查；结构最简，但 50 逐技能列表需每次 filter 分组 | |
| 仅写日志 | 诊断不进读时数据层，仅写 console 日志；设置页阶段再重扫取诊断 | |

**User's choice:** 内联 + 模块级 errors（推荐）
**Notes:** 无附加说明。

---

### 问题 3 — frontmatter `name` 与目录名不一致（冒名顶替向量）怎么处理？（P3 前半归属本阶段）

| Option | Description | Selected |
|--------|-------------|----------|
| 以目录名重写 | 加载后以目录名为权威：name ≠ 目录名时重写为目录名 + 产诊断；杜绝 `skills/evil/` 冒充 find-skills，同时不丢弃命名随意的合法技能（GitHub 导入常见）；保证 `/skill:name` 与 location 父目录名恒一致 | ✓ |
| 严格拒绝该技能 | name ≠ 目录名即丢弃 + 产诊断；最贴 Agent Skills 规范，但会连带拒掉大量真实仓库里命名不规范的合法技能 | |
| 不校验，透传 SDK warning | 信任 SDK（`name = frontmatterName \|\| parentDirName`）只透传 warning；与 SDK 行为一致，但 P3 加载层不设防，完全依赖 49/51 写入侧校验 | |

**User's choice:** 以目录名重写（推荐）
**Notes:** 无附加说明。

---

## 启停与限额

### 问题 1 — 启用/禁用状态存在哪个键、用什么结构？

| Option | Description | Selected |
|--------|-------------|----------|
| name 字符串数组 | `settings.aiSkills.disabled: ['foo','bar']`；语义直观，与 `/skill:name` 同一命名空间。边界：先禁 managed foo、后导入 user foo，新导入的也会同禁（同名即同命运） | ✓ |
| `{source,name}` 复合键 | 可精确只禁某一来源副本；代价是禁用/重启匹配需双字段，删除重导后状态继承需额外规则 | |
| 只靠卸载（不存状态） | 不存禁用名单，改为卸载删目录；最简单，但 SKILL-08 明确要求"只过滤不删文件"，且 50 需展示已禁用项 | |

**User's choice:** name 字符串数组（推荐）
**Notes:** 无附加说明。

---

### 问题 2 — prompt 段超字符预算时保留哪些技能、是否告知模型被省略？

用户在选项间提出澄清问题："先说下现在注入 prompt 的应该是技能名称和描述吧，具体的内容应该动态加载的吧"。

**澄清内容（已确认）：** 是。进 prompt 的只有 name / description / location 三件套（`formatSkillsForSystemPrompt` 输出），SKILL.md 正文完全不进 prompt——模型匹配 description 后自己调 `read` 打开 location 读取。推论：① 预算只由"条目数 × 每条 ~(name 64 + description ≤1024 + 路径) 字节"决定，与正文大小无关；② 只有 `disableModelInvocation !== true` 的技能进该段，故 `disable-model-invocation` 技能不占 prompt 预算。

| Option | Description | Selected |
|--------|-------------|----------|
| ① user > 可自动激活 > 字典序 | 先保 user 来源，再保 `disableModelInvocation !== true`，同级按 name 字典序；被截断的段尾加"因预算省略 N 个技能（共 M 个）" + 产诊断 | ✓ |
| ② 不截断，仅告警 | 段字符预算只作诊断警告，技能集永远完整注入；prompt 大小不可控 | |
| ③ 分层保留，不写提示语 | user 全保、managed 截断，截断部分只进诊断、段内不留痕 | |

**User's choice:** 方案 ①
**Notes:** 澄清注入面后选定。

---

### 问题 3 — 三个限额常量取哪组？

| Option | Description | Selected |
|--------|-------------|----------|
| 64KB / 50 / 8000 | `MAX_SKILL_MD_BYTES = 64KB`（对齐 oh-my-pi）、`MAX_USER_SKILLS = 50`、段预算 8000 字符（≈容 26 个条目，配合方案 ① 省略提示） | ✓ |
| 宽松 128KB / 100 / 16000 | 适合技能多、描述长的重度使用；代价是单技能正文上限放宽、提示词固定开销更大 | |
| 保守 32KB / 30 / 5000 | 抑制 prompt 膨胀与恶意大文件；但对含 references/ 的复杂技能可能过紧 | |

**User's choice:** 64KB / 50 / 8000（推荐）
**Notes:** 三常量集中定义在 `ai-skills-manager.js` 一处（照 Phase 43 `BUDGETS` 先例），后续调整只改一处。

---

## Claude's Discretion

- **加载面收窄（幽灵技能防护）** — SDK `loadSkills` 递归扫描 + 根层带 `description` 的 `*.md` 也会被当技能加载（产生只有 warning 的幽灵技能）。是否按"相对深度 = 2"过滤为固定一层、是否禁用根文件加载，交 plan 期决定。
- **DOC-01 骨架粒度** — `docs/product/ai-skills.md` 六节骨架写到多细（写满 vs 只写已落地部分 + 占位），交 plan 期决定；O8（`/compact` 不保留技能正文）与 O3（`allowed-tools` 不被强制）可先落"已知限制"占位。

## Deferred Ideas

- 加载面收窄（深度过滤 / 根文件加载策略）— 明确交 plan 期
- DOC-01 骨架粒度 — 明确交 plan 期
- O5 显式解析 frontmatter（`yaml` 是否提升为直接依赖）— 归 Phase 51；本阶段只经 `loadSkills` 往返
- O8 `/compact` 不保留技能正文 — 归 Phase 47/文档已知限制
- O3 `allowed-tools` 解析 + 免责标注 — 解析在 47/51，执行层门禁明确 Out of Scope
- ECO-01..06（多技能包勾选 / 内置技能升级推送 / `/compact` 保留正文 / 占位符替换 / 四态可见性 / 容器级作用域）— 非本期

# Phase 49: `manage_skill` 工具（AI 自建技能） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 49-`manage_skill` 工具（AI 自建技能）
**Areas discussed:** 写入是否要确认, 更新语义与写路径, name 校验与撞名, 扫描与数量上限

---

## 灰区选择（present_gray_areas）

| Option | Description | Selected |
|--------|-------------|----------|
| 写入是否要确认 | AI 建/改/删技能要不要弹确认卡片；分动作分档还是一律自动；50 之前用户几乎看不见 AI 建的技能 | ✓ |
| 更新语义与写路径 | update 全量覆写 vs 局部编辑；read/edit/bash 已能直写 managed-skills，两条写路径是否收敛 | ✓ |
| name 校验与撞名 | 校验严格度（判据字面 `^[a-z0-9-]+$` vs oh-my-pi 严格规则 vs P3 建议）；create 撞三类来源的响应 | ✓ |
| 扫描与数量上限 | AI 自建技能的 description/content 是否跑注入扫描（P3：description 是无条件注入通道）；managed 自建是否设数量上限（P7 要求 manage_skill 卡数量） | ✓ |

**User's choice:** 四个灰区全选。
**Notes:** 无。

---

## 写入是否要确认

### Q1：manage_skill 的三个动作要不要用户确认卡片？

| Option | Description | Selected |
|--------|-------------|----------|
| 一律自动（对齐 write） | 对齐 write/edit 既有决策与理由：破坏面已在硬沙箱内、AI 本来就能用 write 直写同一路径，单独加确认会被绕道成为虚假安全感 | ✓ |
| create 自动 / update+delete 确认 | create 是纯增量；update 覆写与 delete 删目录不可逆 → 弹确认。代价：确认成本抵消 MGMT-06 的「优先增强已有」 | |
| 三动作全部确认 | 对齐 oh-my-pi 的 approval:"write"。代价：与 write 工具口径不一致、LLM 会绕道 | |
| 不加确认 + 沙箱保护 managed-skills 目录 | 加沙箱层保护强制写路径收敛到 manage_skill（此时单点确认才真正生效）。会改变既有沙箱行为 | |

**User's choice:** 一律自动（对齐 write）。
**Notes:** 用户是在听完两条事实后选的 —— ① `write`/`edit` 已能直写 `managed-skills/foo/SKILL.md`（P8 第 6 条），② `exec` 不校验命令内容（bash 穿透）。判断依据是「不完整的保护是负面价值」，而非「信任 AI」。这条推理后来直接决定了 D-05 选「接受双路径」。

### Q2：AI 建/改/删了技能，用户靠什么知道？

| Option | Description | Selected |
|--------|-------------|----------|
| 工具卡片技能化 | 复用 48 D-15（`read` 卡片 → 「使用技能 X」），manage_skill 卡片标题改为「创建/更新/删除技能「foo」」+ 三档来源徽标；不额外插 system-note | ✓ |
| 保持普通工具卡片 | 一视同仁，告知交给模型转述。零成本但与 read 卡片相比缺少持久动作的视觉区分 | |
| 卡片 + 额外 system-note | 卡片会在对话中滚走，另加 note 跨轮可见。代价：信息重复，多技能时刷屏 | |

**User's choice:** 工具卡片技能化。

### Q3：怎么阻止模型自行（无用户要求地）批量创建技能？

| Option | Description | Selected |
|--------|-------------|----------|
| 工具描述写两条 | ①「仅在用户明确要求时调用」② MGMT-06 的「优先增强已有技能」。不进 REALM_SYSTEM_PROMPT | ✓ |
| 拆分：时机入 prompt | 描述只承担 MGMT-06，「用户显式发起」写进第 1 段。代价：前缀缓存重建一次 | |
| 只写 MGMT-06 字面 | 不做时机约束。风险：无机制阻止轮结束后自满建技能 | |

**User's choice:** 工具描述写两条。

---

## 更新语义与写路径

### Q1：manage_skill(update) 的正文参数语义取哪种？

| Option | Description | Selected |
|--------|-------------|----------|
| 全量覆写 + 局部走 edit | content 必填 = 完整新正文（不含 frontmatter）；局部增强先 read 再全量写或走既有 edit；工具描述写明分工 | ✓ |
| update 支持局部编辑 | 新增可选 old_string / new_string（复用 edit 语义）。偏离 MGMT-02 已锁签名，与 edit 能力重叠 | |
| 合并为声明式 save | save + delete 两动作。违反 MGMT-01「三个动作」，丢掉独占创建语义（P3/§5.3 的安全判据） | |

**User's choice:** 先答「给我个建议」，采纳推荐后确认「确认走选项 1」。
**Notes:** 推荐理由三条 —— ① 加参数会撞 ROADMAP 成功判据 2 的「只接受 name 与 content/description」（判据的验收面 = 工具 schema properties 键集合）；② 与沙箱内 `edit` 工具能力完全重叠（同能力两份实现）；③ 合并为 save 违反 MGMT-01 并丢掉独占创建语义。用户另要求「后续每次提问，都加一个推荐项」（已存入记忆）。

### Q2：manage_skill 与 read/edit/bash 直写并存，怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 接受双路径 + 引导 | 工具描述写明分工；不新增拦截机制。剩余窄分裂写进产品文档诚实边界 | ✓ |
| 沙箱层保护技能目录 | 强制写路径收敛（此时单点确认才生效）。因 exec 不校验命令内容而结构上不可能完整；会把 AI 逼向最不可审计的 bash 路径 | |
| 加载管线补 name 闸 | 唯一能同时兜住两条写路径的机制。推翻 46 D-08（不丢弃命名不规范技能），已导入技能升级后消失 | |

**User's choice:** 先答「给我个建议」，采纳推荐后确认「确认走选项 1」。
**Notes:** 推荐理由 —— ① 沙箱保护结构上不完整（bash 穿透），虚假完整感 + 恶化系统；② 加载管线补闸推翻 46 D-08、代价是对真实用户数据的回归；③ 真正的「校验绕过」担忧已闭合 —— 字节闸在加载期由 `createSkillsEnv` 卡，三条写路径同源生效。剩余窄分裂（bash 造出不合 name 格式目录）影响有界：`SKILL_NAME_RE` 单源解析器使其无法被 `/skill:name` 显式调用。

### Claude's Discretion（已声明）

- `delete` 递归删整目录（含 AI 经 bash 加的 `scripts/`/`references/`）—— 对齐 O11 对 50/51 卸载的同一口径。
- 工具生成的 frontmatter 只含 `name` + `description` 两行（对齐 oh-my-pi），update 整体重建 frontmatter 会抹掉未知字段 ⇒ AI 自建技能恒为「可自动激活」，`disable-model-invocation` 只能由用户设置（Phase 50 或手改文件）。

---

## name 校验与撞名

### Q1：name 校验器取哪一档严格度？

| Option | Description | Selected |
|--------|-------------|----------|
| 字面 + 三条必要补充 | `^[a-z0-9-]+$` 之上补长度 ≤64、无首尾连字符、无连续连字符（与 P3 建议一致） | ✓ |
| 判据字面 + 长度上限 | 严格照判据 2 字面，只加长度 ≤64。`-foo-` / `foo--bar` / `---` 全放行 | |
| 完全对齐 oh-my-pi | `[a-z0-9][a-z0-9-]{0,63}`：首字符字母数字、允许尾连字符与连续连字符 | |

**User's choice:** 字面 + 三条必要补充（推荐）。
**Notes:** 关键事实 —— 判据 2 与 MGMT-02 都只写了 `^[a-z0-9-]+$`，无长度/首尾/连续约束；SDK 限 name 64 字符但超长只产 warning 不拒绝，而 46 D-08 会把 dirname 权威重写成 name ⇒ 200 字符目录名会直接进 system prompt 且零诊断。同时写清「写入门严 / 读入门宽」的故意不对称（一份校验器 + 一处调用口径，不是两份实现）。这个校验器是 50/51 唯一可复用的那一份。

### Q2：create 撞上已有技能时怎么回？

| Option | Description | Selected |
|--------|-------------|----------|
| create 独占 + 按来源区分拒绝 | 目标已存在（任何来源）即 isError 且不落盘，四类来源给不同原因（seeded / 用户技能 / 自己已建 / 用户手放） | ✓ |
| create 对自家 managed 当 upsert | 仅对 seeded 与用户技能拒绝。丢掉独占创建语义，单次调用是新建还是覆写不可预测 | |
| 放宽：只保护 seeded 与用户技能 | 允许覆写用户手放在 managed-skills/ 的技能。风险：静默覆写且用户无从得知 | |

**User's choice:** create 独占 + 按来源区分拒绝（推荐）。
**Notes:** 四类撞名的事实后果已在提问前钉清 —— 用户技能同名会导致永久遮蔽（46 D-06 user > managed）且静默；「AI 自建」与「用户手放」在工具层同形，无法区分。

### Claude's Discretion（自动落定）

- name 只 trim 首尾空白，**不自动 lowercase**（静默规范化会让判据 2 的「拒绝并说明原因」失去触发面）。
- 撞名判定一律**读盘**（`env.exists`）、不用缓存快照（bash 可随时改写磁盘；与 48「调用那一刻读盘」同款精神）。
- `description` 与 `content` 均必填、trim 后非空。
- 机器可读原因码进 `details`（`seeded_protected` / `user_owned_conflict` / `already_exists` / `not_found` / `limit_exceeded` / `invalid_name` / `invalid_description` / `oversize` / `unscannable`），对齐 48 的 `details.shadowed` 先例。

---

## 扫描与数量上限（用户授权「后续决策自动化使用推荐的」后自动落定）

| Decision | 内容 | 关键理由 |
|---|---|---|
| D-08 扫描范围 | `description` 跑 `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS`；`content` 只跑 `INJECTION_PATTERNS` | description 无条件进每个请求的 system prompt，与两层记忆完全同构；content 不进 prompt 且技能文档合法会写配置示例（`token: xxx`）→ 跑凭据组会误伤合法创建。复用 `ai-memory-manager.scanInjectionPatterns`（P3 建议、实测内置技能零误伤） |
| D-09 净化 | 只对 `description` 压单行 + 剥控制/零宽字符；content 不净化。**先扫描后净化** | 净化会剥掉零宽字符，顺序颠倒会让 P3 实测的「零宽变体」绕过检测；content 可能含代码 |
| D-10 数量上限 | `LIMITS` 新增 `MAX_MANAGED_SKILLS = 50`，create 对非 seeded managed 目录数预检，到顶拒绝；update/delete 不受限。不用 prompt 预算做创建拒绝 | `MAX_USER_SKILLS` 只统计 user 来源（`ai-skills-manager.js:570`）⇒ managed 可无限建；P7 明确要求 manage_skill 卡数量；用预算拒绝与 48 D-12「超限技能仍可显式调用」冲突 |
| D-11 落点 | 写函数与校验器住 `ai-skills-manager.js`（零 electron 依赖 ⇒ 50/51 可 require）；`ai-manager.js` 只注册 + 转发；seeded 集合由调用方注入 | ROADMAP 安全门禁「校验器是 50/51 唯一可复用的一份」的前提；对齐 48 D-14 的 `sourceTierOf(entry, seededNames)` 模式与 `memory` 工具委托先例 |
| D-12 原子写 | `env.createTempFile()`（已重定向 `.tmp/`，同 root 同设备）→ 文件级 `env.renameFile(tmp, <name>/SKILL.md)`（POSIX 对已存在目标原子替换 ⇒ create/update 共用）；create 先 `createDir`，失败 `remove` 整目录 | 满足 MGMT-03「经沙箱 env.renameFile 获得双基准路径校验」；失败不留半成品 |
| D-13 刷新链 | 成功后**只调 `syncAgentSystemPrompt()` 一次**（内部已含 refreshSkills）；忙时 ⇒ `_skillsPromptDirty` → 48-08 的 `_flushDeferredSkillsPrompt()` 在本轮成功出口回写 + 广播 | 照 ROADMAP 字面写两个调用 = 两次全量重扫；判据 1「下一条消息即对模型可见」的验收面在此 |

---

## Claude's Discretion

- 工具结果文案与 `details` 全形状（建议带 `promptIncluded`，并在成功文案里明说「下一条消息起可用」）。
- 工具 `parameters` 的 JSON Schema 细节（`pattern` 只是给 LLM 的提示，服务端必须独立再校验）。
- `delete` / `update` 目标不存在的失败文案。
- 测试文件组织（新增 `tests/test-manage-skill.js` 或并入 `tests/test-ai-skills.js`）与必测清单（校验器七种非法 name 形态 / description 超长 / 正文超 64 KiB / 四类撞名 / seeded 三入口保护 / 原子性 / 越界不触及 `ai-memory`·`attachments` / 扫描范围 / 净化顺序 / 数量到顶 / 刷新链时序）。
- 「改名」不支持（要改名 = delete + create）。
- 待实测项：`env.renameFile` 跨目录（`.tmp/` → `managed-skills/<name>/SKILL.md`）的真实行为；`createDir` 的 `recursive` 取值与已存在目录的返回形状。

## Deferred Ideas

- 技能版本历史 / `update` 覆写前备份（v1.x，与 ECO-02 同类）。
- `SKILL_THREAT_PATTERNS` 技能域模式组（归 Phase 51；49 只接扫描点）。
- `manage_skill` 的 rename / 改名（不支持）。
- autolearn 推促（FEATURES §6.3 / §7.3 定为 anti-feature；D-03 用工具描述的两条约束替代）。
- 四态可见性（ECO-05）、容器级技能作用域（ECO-06）、`allowed-tools` 解析展示（O3）、`manage_skill` 开关（FEATURES D6 已定默认开）。
- `syncAgentSystemPrompt()` 生产调用方的完整收口（本阶段 1/3，其余归 50/51；`STATE.md:246` 的 ⚠️ 保持挂着）。
- TD-48-01 / TD-48-02（用户已裁决与 49 同批处置，但不在本阶段需求范围内）。

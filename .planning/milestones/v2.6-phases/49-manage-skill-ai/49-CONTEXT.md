# Phase 49: `manage_skill` 工具（AI 自建技能） - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付**技能集的 AI 写入路径**：一个 `manage_skill` 工具，让 AI 能在用户明确要求时把一套流程/经验沉淀为**自己的** managed 技能，以及修改、删除它们 —— 并且**无法覆盖或删除随包内置技能**。

具体交付：

1. **工具注册**：`_buildRealmTools()` 尾部、紧邻 `memory` / `memory_read`；`executionMode: 'sequential'`。
2. **三动作后端**：`create` / `update` / `delete`，只作用于 `agent-workspace/managed-skills/`。
3. **签名锁定**：**不接受 `path` 参数**，只接受 `name`（`^[a-z0-9-]+$` 系）+ `content` + `description`；路径由 manager 用 `path.join` 计算。
4. **服务端二次校验**：name / description / 正文字节上限（LLM 参数不可信）；内容注入扫描。
5. **seeded 边界保护**：按**播种登记表**（= 随包 `skills-builtin/` 目录名集合）拒绝覆盖与删除，而非按目录位置。
6. **原子写**：经沙箱 `env.renameFile` 获得双基准路径校验；失败不留半成品；不触及 `ai-memory/` / `attachments/` 等其它工作区路径。
7. **成功后刷新**：`syncAgentSystemPrompt()` → 技能集与 Agent system prompt 在下一条消息即生效。
8. **工具描述引导**：调用时机（用户显式发起）+「优先增强已有技能，而非创建近乎重复的新技能」。

**Requirements**: MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05, MGMT-06（6 项）

**不在本阶段**：设置页技能管理区与 `/api/skills/*`（50）、zip / 网络导入管线与 `SKILL_THREAT_PATTERNS` 技能域模式组（51）、`/` 面板与 `/skill:name` 调用（48，已完成）、技能版本历史 / 覆写前备份（v1.x）。

**三条前置约束（来自既有阶段，不得回退）**：

- **写目标只有 `managed-skills/`**（O6 已定：AI 自建 managed 可改可删，只保护 seeded）。**绝不碰 `agent-workspace/skills/`** —— 那是用户目录，oh-my-pi 的原文原则是 "managed skills ONLY writable skills. NEVER edit user-authored skills."
- **seeded 身份 = 扫随包目录名集合**（47 D-11，零状态文件、零硬编码）—— ROADMAP 判据 3 的「播种登记表」即此，**不是一个可被删改的 JSON 文件**。
- **限额常量单源**（46 D-11 / O7 已落定 64 KiB / 50 / 8000）：本阶段**只允许在 `LIMITS` 内新增一项**，不得重新定义既有三项数值。

</domain>

<decisions>
## Implementation Decisions

### 写入确认与可见性

- **D-01:** **三个动作一律自动，不加确认卡片**（对齐 `write` / `edit` 的既有决策）。理由：破坏面已被硬沙箱限定在 AI 专用数据区（`managed-skills/`）；AI 本来就能用 `write` 工具**直写同一路径**（P8 第 6 条明确承认），单独给 `manage_skill` 加确认会**被轻易绕道**，成为只在合作路径上生效的虚假安全感 —— 与 `allowed-tools` 免责标注、bash 白名单诚实边界是同一个判断。
- **D-02:** **用户感知 = 工具卡片技能化**：复用 48 D-15 已建立的模式（`renderToolCard()` 把 `read` 工具卡片特殊化为「使用技能「name」」），把 `manage_skill` 的卡片标题改为「创建 / 更新 / 删除技能「foo」」+ 三档来源徽标（与 skill pill 同款视觉）。**不额外插 system-note**（与 tool card 信息重复，且一次对话建多个技能会刷屏 —— 48 D-15 同款判断）。
- **D-03:** **工具描述里写死两条**：①「**仅在用户明确要求**把某套流程/经验沉淀为技能时调用」（落地 FEATURES 的 anti-feature 结论「不做 autolearn 推促」）；② MGMT-06 的「**优先增强已有技能**，而非创建近乎重复的新技能」（对齐 oh-my-pi 的 "Capture sparingly"）。**不写进 `REALM_SYSTEM_PROMPT`** —— 避免第 1 段改动导致所有既有会话的 provider 前缀缓存重建（48 D-18 已付过一次这种代价，本次无必要）。

### 更新语义与写路径

- **D-04:** **`update` = 全量覆写正文**：`content` 必填 = 完整新正文（**不含 frontmatter**，frontmatter 由工具生成 `name` + `description` 两行）；局部增强走「先 `read` 再全量写」或直接用既有 `edit` 工具；工具描述写明这条分工。— **Reversibility:** costly — 回退需新增 `old_string` / `new_string` 参数，而 ROADMAP 成功判据 2 明文「工具**只接受** `name` 与 `content` / `description`」，该判据的验收面（工具 schema 的 properties 键集合）会失败，须回头改 ROADMAP。理由：加局部编辑参数与沙箱内 `edit` 工具**能力完全重叠**（`edit` 在 `managed-skills/**` 上可用是既成事实），等于同一能力两份实现 —— 正是 AGENTS.md「同一用户意图不管从哪个入口进来行为必须一致」要防的分裂；而合并成声明式 `save` 会违反 MGMT-01 的「三个动作」并丢掉 P3/§5.3 要求的独占创建语义。
- **D-05:** **接受双写路径 + 工具描述引导，不新增拦截机制**。`manage_skill` 负责技能集级声明式变更，`edit`/`write`/`bash` 负责文件级微调（含给技能加 `scripts/`）。理由三条：① 沙箱层「保护技能目录」因 `exec` 不校验命令内容而是**结构上不可能完整**的（`bash -c 'echo … > managed-skills/foo/SKILL.md'` 照样穿透），不完整却自称收敛是虚假安全感，且会把 AI 逼向最不可审计的 bash 路径；② 加载管线补 name 格式闸会**推翻 46 D-08**（明文「不丢弃命名不规范的合法技能」），代价是已导入的合法技能升级后消失；③ 你真正担心的「校验绕过」其实**已经闭合** —— 字节闸（64 KiB）在加载期由 `createSkillsEnv` 卡，**三条写路径同源生效**（超大 SKILL.md 下次重扫即被拒并产 `realm_skill_md_too_large` 诊断），遮蔽 / 禁用 / 布局过滤同样都在加载管线一处。**剩余窄分裂只有一个且影响有界**：bash 可造出目录名不合 `^[a-z0-9-]+$` 的技能（如 `My_Skill/`），它会进 system prompt，但**无法被 `/skill:name` 显式调用** —— `src/skill-picker-model.js:29` 的 `SKILL_NAME_RE` 是 renderer 与主进程共用的单源解析器（48-01），不合格式直接返回 null 走「未知命令」。**必须写进 `docs/product/ai-skills.md` 的诚实边界**（与 bash 白名单、`allowed-tools` 同一节口径），不留成未记录的洞。

### name 校验与撞名响应

- **D-06:** **name 校验 = 判据字面 + 三条必要补充**：`^[a-z0-9-]+$` 之上补 ① 长度 ≤ 64（对齐 SDK `skills.js:4-5` 的 64 字符限 —— 否则该限制形同虚设，因为 SDK 超长只产 warning **不拒绝**，而 46 D-08 会把超长目录名直接重写成 `skill.name` 进 system prompt 且零诊断）、② 无首尾连字符（目录名以 `-` 开头会让 AI 用 bash 调技能自带 script 时被当选项）、③ 无连续连字符。与 P3 的建议完全一致。**同时写清一条故意的不对称：写入门严、读入门宽** —— 加载管线对磁盘上已存在的技能保持宽松（46 D-08 不丢弃命名不规范者），严格校验只作用于**我们能控制的写入侧**（`manage_skill` 与 Phase 51 导入）。这是**一份校验器 + 一处不对称的调用口径**，不是两份实现。
  - **补充口径**：name 只做 `trim()` 首尾空白，**不自动 lowercase** —— 静默规范化会让判据 2 的「非法 name 被拒绝并说明原因」失去触发面，且 memory 工具已有「业务校验失败 throw → SDK 转 `isError: true` toolResult → LLM 自行修正」的成熟先例。
- **D-07:** **`create` 独占创建 + 按来源区分拒绝**（对齐 oh-my-pi 与 FEATURES §5.3）：目标**已存在**（任何来源）即 `isError: true` 且**不落盘**，四类来源给不同可读原因 —— seeded → 「内置技能不可覆盖」（判据 3）；用户技能 → 「同名用户技能优先级更高，AI 建的会被**永久遮蔽**」（46 D-06 的 user > managed，不拒绝就是静默无用）；自己已建的 managed → 「已存在，请改用 `update`」；用户手放在 `managed-skills/` 的（非 seeded，与上一类**同形**，工具无法区分）→ 同前。`update` / `delete` 对 seeded 与用户技能一律拒绝、目标不存在则提示改用其它 action。
  - **撞名判定一律读盘**（`env.exists`），**不用缓存快照** —— bash 可随时改写磁盘（P8 第 6 条），缓存只反映「上次重扫的时刻」，据此判「已存在」会给出错误结论。与 48 的「调用那一刻读盘」同款精神。
  - `description` 与 `content` **均必填、trim 后非空**：description 是模型按 description 自动匹配的**唯一触发机制**（skill-creator 作者指南的核心结论）；空正文有 `readSkillForInvocation` 的既有拒绝先例（48-04）。
  - **机器可读原因码**进 `details`：`seeded_protected` / `user_owned_conflict` / `already_exists` / `not_found` / `limit_exceeded` / `invalid_name` / `invalid_description` / `oversize` / `unscannable` —— 对齐 48 的 `details.shadowed` 先例，供 Phase 50/51 与测试断言消费。

### 内容扫描、净化与数量上限

- **D-08:** **扫描范围 = 复用 `ai-memory-manager.scanInjectionPatterns`（P3 明确建议；实测对内置技能零误伤）**，但两组模式**按字段分开用**：`description` 跑 `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS`；`content` **只跑** `INJECTION_PATTERNS`。理由：description 无条件进**每个请求**的 system prompt，与两层记忆完全同构（同一「秘密入库 = 上传第三方」论据）→ 两组都要跑；content 不进 prompt，而技能文档**合法地会写配置示例**（`token: xxx`、`api_key=…` 会被 `CREDENTIAL_PATTERNS` 命中）→ 跑凭据组会**误伤合法技能创建**。命中即 `throw`（对齐 memory 工具的「拒绝写入」语义，非 `validateScript` 的「拒绝执行」）。`SKILL_THREAT_PATTERNS` 技能域扩展（外发 / 凭据路径 / 绕过授权）仍归 **Phase 51**，但**49 把扫描点接成单点**，51 只需扩表、不加接线。
- **D-09:** **净化只作用于 `description`**：压单行（换行 → 空格）+ 剥控制字符与零宽字符。`content` **不净化**（可能含代码 / 脚本，剥字符会破坏合法内容；且它不进 prompt）。**顺序铁律：先扫描、后净化** —— 净化会剥掉零宽字符，顺序颠倒会让 P3 实测的「零宽字符变体」绕过检测。
- **D-10:** **新增 `LIMITS.MAX_MANAGED_SKILLS = 50`**（在既有 `LIMITS` 单源里**加一项**，不动既有三项），`create` 时对「**非 seeded** managed 目录数」预检，到顶即拒绝 + 可操作提示（先删除不用的技能）；`update` / `delete` **不受限**。理由：`MAX_USER_SKILLS` 只统计 `source === 'user'`（`ai-skills-manager.js:570`），managed 完全不计数 ⇒ AI 可无限建、磁盘与每次 Agent 重建的重扫成本无上限，而 P7 明确要求 `manage_skill` 也卡数量。**不用 prompt 段预算做创建拒绝** —— 那与 48 D-12「超限技能仍可显式调用（它只是排不进预算，本身完全可用）」直接冲突。**两个闸职责分工写清**：数量闸管磁盘 / 重扫成本，prompt 段预算闸（8000 字符）管请求成本。

### 实现落点与原子写

- **D-11:** **写函数与校验器住 `ai-skills-manager.js`**（该模块依赖纪律明文「不得有 electron 依赖」⇒ 可单测、可被 50/51 直接 require —— 正是 ROADMAP 安全门禁「本阶段产出的校验器是 50/51 唯一可复用的那一份」的前提）；`ai-manager.js` 的 `_buildRealmTools()` 只做工具注册与参数转发（对齐 `memory` 工具委托 `ai-memory-manager.write` 的先例）。**seeded 集合由调用方注入**（对齐 48 D-14 的 `sourceTierOf(entry, seededNames)` 模式）—— `builtin-skills-seeder.js` 经 `agent-workspace` 间接依赖 electron，不能让 `ai-skills-manager.js` 直接 require 它。沙箱 `env` 同样由调用方传入（与 `refreshSkills(env, …)` / `readSkillForInvocation(env, name)` 同款签名）。
- **D-12:** **原子写 = 文件级 rename**：临时文件经 `env.createTempFile()` 产出（已重定向到工作区 `.tmp/`，与 `managed-skills/` **同沙箱 root、同设备** ⇒ `rename` 不会 EXDEV）→ `env.renameFile(tmpPath, <managedDir>/<name>/SKILL.md)`。POSIX 文件级 rename 对**已存在目标**是原子替换 ⇒ `create` 与 `update` **共用同一条写路径**（也满足 MGMT-03 的「经沙箱 `env.renameFile` 获得双基准路径校验」：dest 逃逸会被沙箱拒）。`create` 需先 `createDir(<name>)`，随后任一步失败则 `env.remove(<name>, { recursive: true })` 清理 —— **不留半成品目录 / 半成品文件**。`delete` 用 `env.remove(<managedDir>/<name>, { recursive: true })` 递归删整目录（含 AI 经 bash 加的 `scripts/` / `references/`，对齐 O11 对 50/51 卸载的同一口径）。
- **D-13:** **刷新链 = 成功后只调 `syncAgentSystemPrompt()` 一次**。该方法的函数体内**已含** `refreshSkills()` 重扫（`ai-manager.js:2835`）—— **不要照 ROADMAP 字面写 `refreshSkills()` + `syncAgentSystemPrompt()`**，那是**两次全量重扫**。忙时语义：工具执行期 `isProcessing` 恒 true ⇒ 该方法走忙分支只置 `_skillsPromptDirty` 并返回，**真正的 prompt 回写与 `skills:changed` 广播由 48-08 的 `_flushDeferredSkillsPrompt()` 在本轮成功出口落地** ⇒ 这正是判据 1「新技能集在下一条消息即对模型可见」的验收面（不是立即生效，是下一轮生效 —— 且这是设计而非缺陷）。同时必须在**渲染端**（48-06 已建）`state.aiSkills` 无条件重拉，使 `/` 面板同步。
  - **`syncAgentSystemPrompt()` 的生产调用方收口**（`STATE.md:246` 的 ⚠️）：本阶段是该 ⚠️ 的**第一个「写成功后回写」调用方** —— 但该 ⚠️ 只在 49/50/51 **三者都落地**后才算闭合，49 只完成其 1/3，**不得在交付物中声称 P8 失效链 6/6 全覆盖**。

### Claude's Discretion

- **工具结果文案与 `details` 全形状**：建议对齐 `memory` 工具（回传动作 + 目标 + 可操作信息），并额外带 `promptIncluded`（该技能是否进了 prompt 段，对齐 48 D-12 的可见性精神）；具体措辞交 plan 期。
- **`manage_skill` 是否也提示「技能何时生效」**：建议在成功文案里明说「下一条消息起可用」（D-13 的忙时语义对用户不可见，不说明会被当成「AI 建的技能没用」）。
- **工具 `parameters` 的 JSON Schema 细节**（`enum` / `pattern` / `required` 的确切写法）：JSON Schema 的 `pattern` 只是给 LLM 看的提示，**服务端必须独立再校验一次**（MGMT-03 明文「LLM 参数不可信」）。
- **`delete` 目标不存在 / `update` 目标不存在的失败文案**：对齐 D-07 的原因码，措辞交 plan 期。
- **测试文件组织**：新增 `tests/test-manage-skill.js` 还是并入 `tests/test-ai-skills.js`，交 plan 期；**必须覆盖**：校验器（name 七种非法形态 / description 超长 / 正文超 64 KiB）、四类撞名、seeded 保护（create + update + delete 三入口）、原子性（失败不留半成品）、越界（不触及 `ai-memory/` / `attachments/`）、内容扫描（description 两组 / content 一组）、名称净化顺序（先扫描后净化）、`MAX_MANAGED_SKILLS` 到顶、刷新链（成功后 `_skillsPromptDirty` 置位 → 下一轮成功出口回写 + 广播）。
- **「改名」不支持**：`update` 不提供 rename（name = 目录名 = 唯一权威，46 D-08）；要改名 = `delete` + `create`。建议写进工具描述或产品文档。
- **待实测项**：`env.renameFile` 在 `.tmp/` → `managed-skills/<name>/SKILL.md` 跨目录时的真实行为（同设备预期成功，但需一次实跑确认）；`createDir` 的 `recursive` 取值与已存在目录的返回形状。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑、需求与门禁

- `.planning/ROADMAP.md` §Phase 49 / §Security Gates — Goal、5 条 Success Criteria（判据 2 的「只接受 name 与 content/description」是 **D-04 的硬约束来源**、判据 3 的「按播种登记表判定，而非按目录位置」、判据 4 的原子写与不触及其它工作区路径）、P3 前半（S1）安全门禁 = name 二次校验与名称冲突判定，「本阶段产出的校验器是 50/51 唯一可复用的那一份」
- `.planning/REQUIREMENTS.md` — MGMT-01..06 条目原文（`:42-47`）、Out of Scope 表（预加载正文 / `allowed-tools` 执行层门禁 / 技能热重载）、v2 Requirements 的 ECO-01..06
- `.planning/PROJECT.md` §Current Milestone v2.6 / §Key Decisions — 里程碑目标；`:293` 的「AI 自建技能存于 `agent-workspace/managed-skills/`、权威性最低」
- `.planning/STATE.md` §Blockers/Concerns — **`:246` 的 ⚠️「`syncAgentSystemPrompt()` 无生产调用方，必须先写成显式交付项与验收项」**（D-13 的收口对象）、O6 决策（managed 可改可删、seeded 必须保护）、O7 已落定的三条限额数值（49 不得重新定义）

### 研究（本阶段实现的直接依据）

- `.planning/research/FEATURES.md` **§5.3**（`:299-305`：Realm 特有的目录设计风险两条 —— AI 覆盖内置资产、AI 自建同名静默遮蔽内置，以及「按播种登记表拒绝」与「create 撞名不落盘返回 isError + details.shadowed」两条建议）、**§6.1**（`:311-330`：oh-my-pi `manage_skill` 完整规格表 —— 输入 / 名称规则 / 描述净化 / frontmatter 只含 name+description / 64000 字节上限 / create 独占 / update 覆写 / delete 递归 / 进程内串行 / 三层 symlink 检查 / 作者遮蔽 / 成功后 refreshSkills / 输出文案 / "managed skills ONLY writable skills"）、**§6.3**（`:352-356`：autolearn 是 anti-feature、默认关闭，"Capture sparingly" 的原始出处）、**§7.3 Anti-Features**（`:410` 固定一层 `<root>/<skill-name>/SKILL.md`；`:412` 不做 autolearn 推促）、**§Feature Dependencies**（`:434` manage_skill 依赖「原子写 + managed 边界 + 名称遮蔽 + 体积上限」）、**§D6**（`:553` 默认开，但必须在工具描述写 "capture sparingly"）
- `.planning/research/PITFALLS.md` **P3**（`:124-177`：description 是零交互注入通道（只需看 `:129-136`）+ name 可冒名；`:155-164` 的 `scanInjectionPatterns` 实测结论与三类**放行缺口**、`SKILL_THREAT_PATTERNS` 建议草案 —— **D-08 / D-09 的直接依据**）、**P7**（`:291-318`：四个资源耗尽入口与限额建议；`:318` 明文「Phase to address: 导入管线 + **manage_skill** + 技能加载接线」—— **D-10 的直接依据**）、**P8**（`:322-360`：失效链 6 个触发点，第 5 条即 `manage_skill` 三动作；`:348` 的「每次 `_recreateAgent` 都重扫」兜底、第 6 条 bash/write 直改路径 —— **D-05 / D-13 的依据**）、**P12**（`:449`：`loadSkills` 全部失败都是 warning = 静默失败）
- `.planning/research/ARCHITECTURE.md` **§Anti-Pattern 1**（`:759-763`：给 `manage_skill` 传 `path` 参数 = 模型可写工作区内任何文件含 `ai-memory/MEMORY.md`、`attachments/` 快照，「沙箱在这里提供不了保护，接口设计才是边界」）、§Anti-Pattern 2 / 5（不做每轮重载 / 不在 renderer 重建优先级表）
- `.planning/research/SUMMARY.md` §Phase 49（`:121-126`：Rationale 的「必须排在设置页与导入之前 —— 三处必须共享**同一份** name/description/大小/注入校验，先做其他写入路径极易写出第二份校验」、Delivers 清单、Avoids P3/P7/P8/Anti-Pattern 1、Decision needed 的「默认开 vs oh-my-pi 默认关」）、§Phase Ordering Rationale 第 3 条（`:146` 50 排在 49 之后正是为防校验逻辑漂移）、§Research Flags（`:160` 「Phase 49 照抄 `ai-memory-manager` 的校验 + 原子写 + 业务校验失败由 manager throw 先例」= Standard pattern，可跳过 research-phase）
- `.planning/research/STACK.md` — SDK API 形态（`loadSkills` / `loadSourcedSkills` / 诊断字段）；`skills.js:4-5` 的 name 64 / description 1024 字符限（**D-06 / 判据 2 的补充上限来源**）

### 上一阶段（本阶段的前置契约）

- `.planning/phases/46-prompt/46-CONTEXT.md` — **D-04**（每次 `_recreateAgent()` 前无条件重扫 = bash 直改磁盘的兜底，D-05 依赖它）、**D-06**（user > managed 遮蔽 + `shadowed`/`shadowedBy` —— D-07「用户技能同名会被永久遮蔽」的依据）、**D-07**（诊断形态与禁止静默失败）、**D-08**（name 恒等于目录名 ⇒ `/skill:` 解析确定、也是「改名不支持」的依据）、**D-09**（禁用存 `settings.aiSkills.disabled`，不删文件）、**D-11**（三条限额常量单源 ⇒ D-10 只能「加一项」不能「改数值」）
- `.planning/phases/47-bash/47-CONTEXT.md` — **D-11**（seeded 身份 = 扫随包 `skills-builtin/` 目录名集合，零状态文件零硬编码；明文「同时服务 Phase 48 的来源徽标**与 Phase 49 按此判定拒绝覆盖/删除 seeded 技能**」）、**D-07**（skill-creator 正文让 AI 优先用 Realm 自身 write/read 完成创建与校验，**与 Phase 49 的 `manage_skill` 自然衔接** —— 内置技能已把 `manage_skill` 写成主路径）、**D-10**（`managed-skills/` 不允许手删，唯一「不要这个技能」的语义是禁用）
- `.planning/phases/48-skill-name/48-CONTEXT.md` — **D-02 / D-14 / D-15**（三档来源徽标判定与「工具卡片技能化」先例 —— D-02 直接复用）、**D-11**（`shadowed` 可见但不可选中、手打 `/skill:name` 一律作用于胜出者）、**D-12**（超限技能仍可显式调用 —— D-10 不得用预算做创建拒绝的依据）、**D-17**（skills:changed 广播 + 面板 stale-while-revalidate —— D-13 的消费端）
- `.planning/phases/48-skill-name/48-REVIEW.md` / `48-UI-REVIEW.md` — 挂账技术债台账（TD-48-01/02、WR-02/WR-06 等，**49 开工前用户已裁决与 49 同批处置的 TD-48-01 / TD-48-02**）

### 项目内既有先例与会话契约（实现时照抄的对象）

- `ai-memory-manager.js` — **本阶段第一照抄对象（SUMMARY 明文）**：`atomicWrite()`（`:142-147`，tmp + rename 先例）、`write()`（`:198-270`，业务校验失败一律 `throw` → 转 `isError: true` toolResult）、`scanInjectionPatterns()`（`:76-96`，**D-08 复用的导出**，返回 `{ safe, reason? }`）、`INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS` 两组模式表（`:34-58`）、`resolveFile()` 的容器 ID 正则校验先例（`:124-134`）
- `ai-manager.js` — `_buildRealmTools()`（`:3177`，D-11 的注册落点）、`memory` 工具定义（`:5812-5884`，**D-08 / D-11 / D-12 的形状原型**：`executionMode: 'sequential'` + 委托 manager + 业务失败 throw）、`memory_read`（`:5894-5926`）、`_adaptHarnessTool()`（`:5949`）、`sandboxEnv` 与两处 Agent 创建点的 `refreshSkills()` 兜底（`:866-907` / `:2951-2976`）、`syncAgentSystemPrompt()`（`:2831-2859`，**D-13 的唯一权威入口**；`:2843` 忙分支、`:2858` 广播）、`_flushDeferredSkillsPrompt()`（`:2905-2920`，D-13 的落地出口）
- `ai-skills-manager.js` — 技能集**单一数据权威**与 D-11 的落点：`LIMITS`（`:32-36`，D-10 在此加一项）、`EMPTY_CACHE` 形状（`:39-46`）、`createSkillsEnv()`（`:140`，加载期字节闸）、`isDescriptionUnusable()`（`:304`，「description 超长 → 整条跳过」的既有判定，D-08/D-09 的动机来源之一）、`enforceDirNameAuthority()`（`:329`）、`applyShadowing()`（`:359`）、`bySkillPriority()`（`:402`）、`refreshSkills()`（`:446`，D-13 注意它已被 `syncAgentSystemPrompt` 内部调用）、`getSkillsSnapshot()`（`:660`）、`sourceTierOf()` / `toUISkillEntry()`（`:684` / `:707`，D-11 的「seededNames 由调用方注入」模式）、`matchSkillByPath()`（`:734`）、`getSkillsForUI()`（`:761`）、`readSkillForInvocation()`（`:802`，空正文拒绝 + 实时读盘口径）
- `agent-workspace.js` — `createSandboxEnv()`（`:205`，**D-12 的全部依赖**：`guard` 双基准校验、`writeFile` / `renameFile` 双路径校验、`createDir` / `remove` / `exists` / `fileInfo` / `listDir`、`createTempFile` 重定向 `.tmp/`）、`resolveInside()`（`:162`，双基准 + realpath 复核）、`getWorkspaceDir()` / `getSkillsDir()` / `getManagedSkillsDir()` / `getAttachmentsDir()` / `getAiMemoryDir()`（`:38-114`，**判据 4「不触及 ai-memory/attachments」的判据对象**）
- `builtin-skills-seeder.js` — `getSeededSkillNames()`（`:92-110`，**判据 3「播种登记表」的唯一数据源**；注意本模块经 `agent-workspace` 间接依赖 electron ⇒ D-11 的注入模式）、`resolveBuiltinSkillsSrc()`（`:60`）、`resolveManagedSkillsDir()`（`:77`）
- `src/skill-picker-model.js` — `SKILL_NAME_RE = /^[a-z0-9-]+$/`（`:29`，**D-05 的窄分裂影响有界的判据来源**：不合格式的技能无法被 `/skill:name` 显式调用；48-01 建立的跨进程单源解析器）
- `src/renderer.js` — `renderToolCard()`（48 D-15 的落点，**D-02 复用**）、技能气泡 / pill 渲染（48 D-06 / D-09）
- `docs/product/ai-skills.md` — 本阶段按 AGENTS.md 维护约定新增「AI 自建技能」章节（三动作 / 边界与拒绝面 / 两个上限闸的职责分工 / 扫描与净化口径 / 诚实边界：bash 可绕过 name 格式）；现有十节：能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制 / 测试与验证 / 内置技能 / bash 安装档 / 发现与调用
- `AGENTS.md` §AI 工作区与 Bash 权限 — 内置技能、`LIMITS` 单源、技能不构成额外权限、`allowed-tools` 仅供参考 等维护约定（P8 触发点清单里 `manage_skill` 三动作归 49）
- `tests/test-ai-skills.js` / `tests/test-agent-workspace.js` / `tests/test-builtin-skills-seeder.js` / `tests/test-ai-bash-policy.js` — 既有测试基建与断言风格（D-11 的「可单测」前提）

### 参考实现（仓库外，仅作设计参照，不引入依赖）

- `/Volumes/ZhiTai/Projects/github/openhanako/` — omp（oh-my-pi）系列参考：`docs/tools/manage_skill.md`（工具门禁、输入输出、flow、模式变体、副作用、Limits & Caps、全部错误消息、managed 与 authored 隔离）、`src/prompts/system/autolearn-guidance.md`（"Capture sparingly, specifically: skill requires reuse; prefer enhancing existing managed skill to creating near-duplicate" —— **D-03 的原文出处**）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`ai-memory-manager` 是完整的能力样板**：`atomicWrite`（tmp + rename）、`scanInjectionPatterns`（D-08 直接复用）、`write()` 的「业务校验失败一律 throw」语义、`INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS` 两张表 —— SUMMARY 已把「照抄它」列为 Phase 49 的 Standard pattern（可跳过 research-phase）。
- **`memory` 工具的完整形状**（`ai-manager.js:5812`）：`action` enum + `executionMode: 'sequential'` + 委托 manager + 中文 label/description + `details` 回传可操作信息 —— D-11 的注册侧照抄对象。
- **沙箱已提供本阶段需要的全部原语**：`writeFile` / `renameFile`（双路径校验）/ `createDir` / `remove` / `exists` / `listDir` / `fileInfo` / `createTempFile`（已重定向 `.tmp/`）—— **无需新增任何文件 IO 或路径校验代码**（D-12）。
- **`syncAgentSystemPrompt()` + `_flushDeferredSkillsPrompt()` 已构成完整失效链**：D-13 只需一行调用，重扫 / 回写 / 广播 / 忙时延后 / 失败恢复全部已实现（48-08）。
- **`sourceTierOf(entry, seededNames)` 的「集合由调用方注入」模式**（48 D-14）—— D-11 在写入侧照抄，解决 `builtin-skills-seeder` 的 electron 依赖边界。

### Established Patterns

- **单一数据权威**：技能集只在 `ai-skills-manager.js` 一处加载/去重/诊断/限额。D-11 把**写入**也收进同一模块（而非新建 `skill-manager.js`），使「读权威」与「写权威」同源。
- **常量单源**：`LIMITS` 只在 manager 定义 —— D-10 只能在其中**加一项**，45/46 建立的「端点与前端零字面量」纪律同样适用（50 展示该数值时不得写死）。
- **禁止静默失败**（SKILL-06 / P12）：所有拒绝路径都必须给可读原因 + 机器可读原因码（D-07）；扫描命中必须 throw（D-08）；**写入门必须预筛两个上限**，否则会产生「落盘成功但加载管线整条跳过」的幽灵技能（`isDescriptionUnusable` 与字节闸都在加载期丢弃条目，磁盘上却留了文件）。
- **冻结快照 + 同步只读**：`buildSystemPrompt()` 必须保持同步零 IO（G-42-4 先例）—— D-13 的刷新只能经 `syncAgentSystemPrompt()`，不得在 Agent 创建路径上做 IO。
- **业务校验失败由 manager throw**（memory 工具先例）：不是返回错误对象，而是 throw → SDK 转 `isError: true` toolResult → LLM 可见并自行修正。D-06/D-07/D-08 的失败路径全部走这条。
- **技能不构成额外权限**：`manage_skill` 不新增任何权限机制，写入范围由**接口设计**（不吃 path）而非沙箱限定（Anti-Pattern 1 的核心论点）。
- **诚实边界必须成文**：bash 白名单（"降低误执行概率的启发式而非安全边界"）、`allowed-tools`（"当前运行时不被强制，仅供参考"）都已成文 —— D-05 的窄分裂同样要进 `docs/product/ai-skills.md`。

### Integration Points

- `ai-skills-manager.js` —— 新增 `createManagedSkill` / `updateManagedSkill` / `deleteManagedSkill` + 导出的校验器（name / description / 正文 / 净化），全部签名为 `(env, { …, seededNames })`（D-11）
- `ai-manager.js` —— `_buildRealmTools()` 新增 `manage_skill` 工具项（D-11 的转发层）、成功后一行 `await this.syncAgentSystemPrompt()`（D-13）
- `agent-workspace.js` —— 只读消费（沙箱原语），**不需要改动**
- `builtin-skills-seeder.js` —— 只读消费 `getSeededSkillNames()`（经 ai-manager 注入，D-11）
- `src/renderer.js` —— `renderToolCard()` 的 `manage_skill` 分支（D-02）；`state.aiSkills` 经既有 `skills:changed` 监听重拉（48-06 已建）
- `docs/product/ai-skills.md` —— 新增「AI 自建技能」章节（含 D-05 的诚实边界）；`AGENTS.md` 的 P8 触发点清单与测试清单同步
- `tests/` —— 新增 `manage_skill` 断言组（见 Claude's Discretion 的必测清单）

</code_context>

<specifics>
## Specific Ideas

- **「AI 自建技能是否要确认」这一问的关键转折**：用户在听完两条事实（`write` 已能直写同一路径、沙箱 `exec` 不校验命令内容）后选「一律自动」—— 判断依据不是「信任 AI」，而是「**不完整的保护是负面价值**」：一个能被 `write`/`bash` 绕过的确认卡片既挡不住真实风险，又会让 AI 把写行为挪向更不可审计的路径。这条推理同样是 D-05 选「接受双路径」而非「沙箱保护目录」的直接原因。
- **D-10 的数值 50 是「量级参考」而非精确推导**：P7 举的例子即 50（原用于 `MAX_USER_SKILLS`），本阶段取同值保持对称。它是 `LIMITS` 单源里的一项常量，plan / 执期若发现实测用量不该是 50，改一处即可 —— **不要在端点或前端写死**。
- **两个上限闸的职责必须成文**：数量闸（`MAX_MANAGED_SKILLS`）管**磁盘与重扫成本**；prompt 段预算闸（`SKILLS_PROMPT_CHAR_BUDGET = 8000`）管**请求成本**。二者不互相替代，且**不能用后者做创建拒绝**（48 D-12 已明确超预算技能仍可显式调用、本身完全可用）。
- **判据 1 的「下一条消息即对模型可见」是设计而非缺陷**：工具执行期 `isProcessing` 恒 true ⇒ `syncAgentSystemPrompt()` 必走忙分支只置脏标记，真正回写发生在**本轮成功出口**。规划与验收必须按这个时序断言（断言点 = `_skillsPromptDirty` 置位 → 下一轮成功出口后 prompt 含新技能 + `skills:changed` 广播），**不要**断言「工具返回时 system prompt 已更新」。
- **`.planning/research/SUMMARY.md` 的 Rationale 是本阶段的排序理由**：49 必须排在 50/51 **之前**，因为三处必须共享同一份校验器 —— 先做其它写入路径极易写出第二份校验。规划时**不得**为了省事把校验器放在 `ai-manager.js`（那会让 50/51 无法 require，正是排序要防的漂移）。
- **本阶段的 UI hint**：ROADMAP 未标 `UI hint`，本阶段 UI 面只有 D-02 的工具卡片技能化（复用 48 D-15 的既有卡片特殊化），**无需** `/gsd:ui-phase 49`。
- **与内置 skill-creator 的关系**：47 D-07 已把「AI 优先用 Realm 自身的工具完成技能创建与校验，与 Phase 49 的 `manage_skill` 自然衔接」写进内置技能正文 —— 本阶段落地后，内置 `skill-creator` 的评估循环（subagent / python 脚本）仍不可用，主路径正是 `manage_skill` + 对话式迭代。

</specifics>

<deferred>
## Deferred Ideas

- **技能版本历史 / `update` 覆写前备份** —— `update` 目前不可逆且无快照。归 v1.x，与 **ECO-02**（seeded 内置技能升级推送机制 + 恢复内置技能按钮）同类。
- **`SKILL_THREAT_PATTERNS` 技能域模式组**（外发 `web_fetch`/`curl` 组合语义、凭据与敏感路径 `~/.ssh`/`.aws`/`.env`/`cookies.json`、绕过授权 `跳过确认`/`-y`/`dangerously`、篡改平台写 `managed-skills`）—— 归 **Phase 51**；49 只把扫描点接成单点（D-08），51 扩表即可，**不得在 49 提前实现**（否则 51 会再写一份）。注意 P3 的诚实边界：这些是启发式、**降低概率**而非安全边界，安全边界 = 确认卡片 + 硬沙箱。
- **`manage_skill` 的 rename / 改名** —— 不支持（name = 目录名 = 唯一权威，46 D-08）；要改名 = `delete` + `create`。
- **autolearn 推促（轮结束后主动让 AI 沉淀技能）** —— FEATURES §6.3 / §7.3 定为 **anti-feature**（会污染技能列表 + 每轮多一次 LLM 往返 + 用户无法预期；oh-my-pi 自己也默认关闭且标 experimental）。D-03 已在工具描述里写死「仅在用户明确要求时调用」来替代它。
- **四态可见性**（Claude Code `skillOverrides` 的 `"on"` / `"name-only"` / `"user-invocable-only"` / `"off"`）—— **ECO-05**；本阶段维持 46 D-09 的二元 enable/disable。
- **容器级技能作用域** —— **ECO-06**。
- **`allowed-tools` 的解析与展示** —— **O3**；若后续出现（51 解析 / 50 展示），**必须**带「当前运行时不被强制，仅供参考」免责标注，执行层门禁明确 Out of Scope。
- **`manage_skill` 是否加开关（默认开 vs 默认关）** —— FEATURES D6 已定**默认开**（本里程碑核心差异化能力，风险由 managed 边界 + 不碰用户技能 + 体积上限 + 名称遮蔽拒绝覆盖）；若日后要加开关，须连带定义「关闭后已建技能如何处理」。
- **`syncAgentSystemPrompt()` 生产调用方的完整收口** —— 本阶段只完成 **1/3**（`manage_skill` 三动作）；设置页启停卸载归 50、导入归 51。**49 不得声称 P8 失效链 6/6 全覆盖**，`STATE.md:246` 的 ⚠️ 保持挂着。
- **TD-48-01 / TD-48-02**（`48-REVIEW.md` 的两条 Critical：`escapeHtml` 不转义引号致技能名可逃逸属性；取消分支判据缺锚点自校验）—— 用户已裁决「阶段 48 不发版 → 延后」，**与 49 同批处置**，但**不在本阶段需求范围内**；若 49 改到相邻代码（`renderToolCard` / 面板行渲染）须顺带核对，否则保持挂账。

</deferred>

---

*Phase: 49-`manage_skill` 工具（AI 自建技能）*
*Context gathered: 2026-09-13*

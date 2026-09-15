# Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入） - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付**技能数据层与 Agent 接线**，不含任何 UI 与写入路径：

- `agent-workspace/skills/`（source=`user`）与 `agent-workspace/managed-skills/`（source=`managed`）两个目录落在硬沙箱 root 内、启动时自动创建，AI 的 `read` 工具可读到其中任意 `SKILL.md`
- 新建 `ai-skills-manager.js` 作为技能的**单一数据权威**（模块级缓存 `{skills, promptBlock, digest, diagnostics}`），承担加载 / 去重 / 诊断 / 限额
- `ai-manager.js` 四处接线：`buildSystemPrompt()` 增加技能段、`init()` 与 `_recreateAgent()` 两处 Agent 创建点、新增 `syncAgentSystemPrompt()`
- 技能集变更后无需重启应用或重建 Agent，下一条消息即按新技能集生效，并经 `windowManager.broadcast` 同步其他窗口
- DOC-01：新建 `docs/product/ai-skills.md` 骨架

**不在本阶段**：`/` 面板与 `/skill:name` 调用（48）、`manage_skill` 写入路径（49）、设置页管理区与 `/api/skills/*`（50）、zip / 网络导入管线与 `yauzl` 依赖（51）、内置技能播种与 bash 策略加固（47）。

本阶段承载 **P8 门禁**（S2，阻断）：技能缓存失效链 6 个触发点全覆盖。
并承载 **P3 前半**（S1）：name 冒名顶替与同名冲突策略（写入侧 name 二次校验归 49）。

</domain>

<decisions>
## Implementation Decisions

### Prompt 拼装（system prompt 段结构与文本形态）

- **D-01:** 技能段作为**第四段拼在最末**——`REALM_SYSTEM_PROMPT` + `buildWorkspacePrompt()` + `buildGlobalSnapshot()` + 技能段。前三段全静态，技能变更只影响末尾，D-04 冻结记忆段的 prefix cache 恒命中。— **Reversibility:** costly — 段顺序决定冻结记忆段的前缀缓存边界；改动需同步 `buildSystemPrompt()` 契约与两处 Agent 创建点，且会让所有既有会话的 prompt 前缀缓存重建。
- **D-02:** 技能段文本**原样使用 SDK `formatSkillsForSystemPrompt()` 的返回值**（英文前言 3 行 + `<available_skills>`），不另加中文引导前缀、不自写中文段——避免与 SDK 前言语义重复并防止升级漂移。空态返回 `''` 时**整段不追加**（不产生空标签、不留多余空行）。
- **D-03:** 技能集变更的写回走新增的 `syncAgentSystemPrompt()`：直接改写 `agent.state.systemPrompt`，**不重建 Agent**（SKILL-04）；并经 `windowManager.broadcast` 同步各窗口。

### 刷新时机与失败降级（P8 门禁核心）

- **D-04:** `refreshSkills()` 在**每次 `_recreateAgent()` 之前无条件 `await` 重扫**两个技能目录（`init()` 首次同样如此）。这是唯一能自动覆盖第 6 条失效路径——模型经 `write` / `bash` 工具直接改写 `skills/foo/SKILL.md`（不经过任何 Realm 管理器、无事件可挂）——的机制。代价为每次切会话重读两个目录（上限 `MAX_USER_SKILLS × MAX_SKILL_MD_BYTES ≈ 3.2 MB`，仅切会话时发生）。— **Reversibility:** costly — 该兜底同时是 P8 门禁的验收面；降级为条件重扫会让门禁失去对第 6 条路径的覆盖，且重新引入"6 个触发点逐一挂刷新"的审计负担。
- **D-05:** **分层降级**，两个层级语义不同：
  1. **单个技能失败**（非法 name / 超长 description / YAML 解析失败 / 超限）= 正常态：产出诊断 + 跳过该技能，其余技能照常注入；
  2. **整批 `refreshSkills()` 抛错**（目录不可读等）→ **保留上一次成功快照** + 产 error 级诊断（不清空技能集、不静默）。

### 遮蔽、诊断与名称权威

- **D-06:** 同名遮蔽（user > managed）**保留在技能集内**：user 版正常参与注入；managed 版标记 `shadowed = true` + `shadowedBy = 'user'`，**不进 prompt、不占 prompt 预算、不参与 `/skill:` 解析**，但保留在数据层供 Phase 48（来源徽标 /「被遮蔽的同名技能可见」）与 Phase 50（列表与诊断）消费。去重发生在注入之前，且优先级逻辑只在主进程一份（renderer 只渲染）。— **Reversibility:** costly — `shadowed` / `shadowedBy` 被 Phase 48 与 50 的渲染消费；改为"剔除只留诊断"需两个阶段同时改数据源与展示层。
- **D-07:** 诊断数据形态：诊断**内联在 `skill.diagnostics[]`**（每条含 `level` / `code` / `message`；限额类额外带 `limit` + `currentValue`），另设**模块级 `errors[]`** 承接"无对应技能"的整批错误（如 D-05 第 2 层）。禁止静默失败（SKILL-06）。
- **D-08:** frontmatter `name` 与目录名不一致时，**以目录名为权威重写 `skill.name`** + 产诊断。理由：`validateName` 只产 warning 且 `name = frontmatterName || parentDirName`，于是 `skills/evil/SKILL.md` 声明 `name: find-skills` 可合法冒名（P3 前半）；重写既杜绝冒名、又不丢弃命名不规范的合法技能（GitHub 导入常见），并保证 `skill.name` 与 `dirname(skill.location)` 恒一致，使 `/skill:name` 解析确定。

### 启停状态与资源限额

- **D-09:** 启用/禁用状态存 `settings.aiSkills.disabled`（`string[]` of name），加载后过滤、**不删文件**（SKILL-08）。单技能禁用语义。已知边界（须写进产品文档）：同名技能共享禁用状态——先禁用 managed `foo`、后导入 user `foo`，新导入的也会随之禁用。— **Reversibility:** costly — 键结构一旦落盘，改为 `{source, name}` 复合键需要迁移用户已有设置。
- **D-10:** prompt 段超字符预算时的取舍顺序：**user 来源 > `disableModelInvocation !== true`（可自动激活优先）> name 字典序**（同级稳定）；被截断的条目**不静默消失**——段尾追加一行「因预算省略 N 个技能（共 M 个）」并产诊断。
- **D-11:** 三个限额常量**集中定义在 `ai-skills-manager.js` 一处**（照 Phase 43 `BUDGETS` 先例，端点与前端零字面量）：
  - `MAX_SKILL_MD_BYTES = 64 * 1024`（对齐 oh-my-pi）
  - `MAX_USER_SKILLS = 50`
  - `SKILLS_PROMPT_CHAR_BUDGET = 8000`
  注：`MAX_SKILL_MD_BYTES`（正文体积）与 `SKILLS_PROMPT_CHAR_BUDGET`（元数据条目段）是两条独立限额。

### Claude's Discretion

- **加载面收窄（幽灵技能防护）**：SDK `loadSkills` 是**递归**扫描，且根层散落的带 `description` 的 `*.md`（如随包 `README.md`）也会被当技能加载，产生只有 warning、不报错的"幽灵技能"。是否按"相对深度 = 2"过滤为固定一层、是否禁用根文件加载（`includeRootFiles`），交 plan 期按实现细节决定——判据是不产生幽灵技能，本阶段不做硬性约定。
- **DOC-01 骨架粒度**：按 ROADMAP 要求建立六节骨架（能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制），本阶段写实已落地部分、其余留占位；O8（`/compact` 不保留技能正文）与 O3（`allowed-tools` 当前运行时不被强制）可先落进"已知限制"占位。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑与需求

- `.planning/REQUIREMENTS.md` — v2.6 需求全表与 traceability；Phase 46 覆盖 SKILL-01..08 + DOC-01（SKILL-09 归 47）
- `.planning/ROADMAP.md` §Phase 46 / §Security Gates — Goal、5 条 Success Criteria、P8 门禁归属与阻断判据
- `.planning/PROJECT.md` §Current Milestone v2.6 / §Key Decisions / §Constraints — 里程碑目标与已锁定决策
- `.planning/STATE.md` §Blockers/Concerns — plan 期需先拍板的开放决策 O1–O11（O7 限额数值、O8 `/compact`、O5 frontmatter 解析均与本阶段相关）

### 研究（本阶段实现的直接依据）

- `.planning/research/SUMMARY.md` — 架构接线点、P8 失效链 6 条路径、O7 限额取舍、Confidence/Open Decisions 全表
- `.planning/research/ARCHITECTURE.md` — `ai-skills-manager.js` 设计、模块级缓存 + 同步访问器、Anti-Pattern 1–5
- `.planning/research/PITFALLS.md` — P1–P12 全清单、"Looks Done But Isn't" 检查表
- `.planning/research/FEATURES.md` — 技能能力边界与 Anti-Features 清单
- `.planning/research/STACK.md` — SDK API 形态（`loadSkills` / `loadSourcedSkills` / `formatSkillsForSystemPrompt` / `formatSkillInvocation`）、包根动态 import 约束

### 项目内既有先例（实现时照抄的对象）

- `docs/plan/ai-memory-system.md` — 冻结快照 + 「异步加载 → 模块级缓存 → 同步只读」先例
- `docs/plan/ai-file-bash-tools-integration.md` — `createSandboxEnv` 硬沙箱设计与工具适配
- `docs/product/ai-agent-workspace.md` — 工作区目录结构与沙箱边界权威说明（DOC-02 在 47 需同步）
- `docs/product/ai-chat-attachments.md` — 沙箱 root 内快照目录先例（子目录天然被 `resolveInside` 放行）
- `AGENTS.md` §AI 工作区与 Bash 权限（agent 根目录 + SDK 内置工具）/ §内部页面 CSP / §开发-正式环境差异 → 发布前必查 — 维护约定、asarUnpack 发布规则、CSP 内联 style 限制

### 源码锚点

- `agent-workspace.js:96` `ensureWorkspaceDir()`（扩展点）/ `:136` `resolveInside()`（ENOENT 分支只做词法校验 → P2 根因）/ `:365` 模块导出面
- `ai-manager.js:561` `buildSystemPrompt()`（当前三段拼接）/ `:821` `init()` Agent 创建点 / `:2453` `_recreateAgent()` Agent 创建点
- `ai-memory-manager.js:365` `buildGlobalSnapshot()`（同步冻结快照先例，含"Agent 创建路径不可异步化"注释）
- SDK `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js` — `loadSkills` / `loadSourcedSkills` / `validateName`（仅 warning）/ `name = frontmatterName || parentDirName` / `MAX_NAME_LENGTH=64` / `MAX_DESCRIPTION_LENGTH=1024`
- SDK `node_modules/@earendil-works/pi-agent-core/dist/harness/system-prompt.js:1` — `formatSkillsForSystemPrompt()`（英文前言 + 空态返回 `''` + `escapeXml` 只做字符转义）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `agent-workspace.js` 的 `getWorkspaceDir()` / `ensureWorkspaceDir()` — 新增 `getSkillsDir()` / `getManagedSkillsDir()` 与两行 `mkdirSync` 的落点；沙箱本身**零改动**
- `ai-memory-manager.js` 的模块级缓存 + 同步访问器模式 — 直接映射为 `refreshSkills()`（异步）/ `getSkillsSnapshot()`（同步）
- `ai-memory-manager.js` `scanInjectionPatterns` — Phase 51 的扫描复用对象（本阶段不涉及）
- `ai-manager.js` `_adaptHarnessTool` — Phase 49 注册 `manage_skill` 的适配器（本阶段不涉及）
- `windowManager.broadcast` — 技能集变更跨窗口同步通道

### Established Patterns

- **D-04 冻结快照**：`buildSystemPrompt()` 必须是同步函数；异步数据一律走「异步加载 → 模块级缓存 → 同步只读」。违反会重演 G-42-4（同步帧内 `this.agent` 恒 null，上下文丢失）
- **常量单源**：Phase 43 `BUDGETS` 只在 manager 定义，端点与前端零字面量 —— D-11 沿用
- **硬沙箱是唯一 root**：root 内子目录天然放行；**不要**给 `managed-skills/` 做只读挂载或加第二个 root（会引入第二套路径判据，与 `resolveInside` 双基准/realpath 逻辑漂移）
- **CSS/DOM 约定**：`realm://` 页面 CSP `style-src 'self'`，初始隐藏必须走 CSS 类（本阶段无 UI，48/50 适用）

### Integration Points

- `ai-manager.js` **四处**：① `buildSystemPrompt()` 追加第 4 段；② `init()` 构造 Agent 前 await 刷新；③ `_recreateAgent()` 构造 Agent 前 await 刷新；④ 新增 `syncAgentSystemPrompt()`
- `agent-workspace.js`：新增两个目录访问器 + `ensureWorkspaceDir()` 两行 mkdir
- 新建 `ai-skills-manager.js`：技能集的唯一数据权威（本里程碑的架构中心）
- 未来消费者（本阶段不实现，但数据形状需预留）：Phase 48 消费 `shadowed` / `shadowedBy` / source 徽标；Phase 50 消费 `diagnostics[]` + 模块级 `errors[]`

</code_context>

<specifics>
## Specific Ideas

- 讨论中明确的注入面判据：进 prompt 的**只有 name / description / location 三件套**（SDK `formatSkillsForSystemPrompt` 输出）；技能正文（SKILL.md body）**完全不进 prompt**，由模型匹配到 description 后调 `read` 打开 `<location>` —— 这就是渐进式披露，也是"技能目录必须落在硬沙箱内"的根因
- 推论：`disableModelInvocation !== true` 的技能才进 prompt 段（SDK 内部先 filter），因此 `disable-model-invocation` 技能**不占 prompt 预算**——这是 SEED-04（内置技能默认关闭自动激活）的顺带收益
- `SKILL.md` 正文字节上限（`MAX_SKILL_MD_BYTES`）与 prompt 段字符预算（`SKILLS_PROMPT_CHAR_BUDGET`）是两条独立限额，勿混为一谈

</specifics>

<deferred>
## Deferred Ideas

- **加载面收窄（深度过滤 / 根文件加载策略 / 幽灵技能防护）** — 用户明确交 plan 期决定，本阶段不作硬性约定
- **DOC-01 骨架粒度** — 用户明确交 plan 期决定（六节骨架 vs 只写已落地部分）
- **O5 显式解析 frontmatter（是否把 `yaml` 提升为直接依赖）** — 归 Phase 51；本阶段只经 `loadSkills` 往返，不 `require('yaml')`
- **O8 `/compact` 不保留技能正文** — 倾向 v1 不保留，写进 `docs/product/ai-skills.md` 已知限制（本阶段落占位）
- **O3 `allowed-tools` 解析 + 免责标注** — 解析在 47/51，执行层门禁明确 Out of Scope
- **ECO-01..06**（多技能包勾选 / 内置技能升级推送 / 技能正文经 `/compact` 保留 / 占位符替换 / 四态可见性 / 容器级作用域）— 见 `REQUIREMENTS.md` v2 Requirements，非本期

</deferred>

---

*Phase: 46-prompt*
*Context gathered: 2026-09-11*

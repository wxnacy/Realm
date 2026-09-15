# Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入） - Research

**Researched:** 2026-09-11
**Domain:** pi-agent-core 0.84.3 Agent Skills 原语接入（加载器契约 + 冻结快照 prompt 注入 + 沙箱归属 + 缓存失效链）
**Confidence:** HIGH（SDK 源码逐行直读 + **本机可执行探针实测** + 本仓接线点行号直读）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prompt 拼装（system prompt 段结构与文本形态）**

- **D-01:** 技能段作为**第四段拼在最末**——`REALM_SYSTEM_PROMPT` + `buildWorkspacePrompt()` + `buildGlobalSnapshot()` + 技能段。前三段全静态，技能变更只影响末尾，D-04 冻结记忆段的 prefix cache 恒命中。— **Reversibility:** costly — 段顺序决定冻结记忆段的前缀缓存边界；改动需同步 `buildSystemPrompt()` 契约与两处 Agent 创建点，且会让所有既有会话的 prompt 前缀缓存重建。
- **D-02:** 技能段文本**原样使用 SDK `formatSkillsForSystemPrompt()` 的返回值**（英文前言 3 行 + `<available_skills>`），不另加中文引导前缀、不自写中文段——避免与 SDK 前言语义重复并防止升级漂移。空态返回 `''` 时**整段不追加**（不产生空标签、不留多余空行）。
- **D-03:** 技能集变更的写回走新增的 `syncAgentSystemPrompt()`：直接改写 `agent.state.systemPrompt`，**不重建 Agent**（SKILL-04）；并经 `windowManager.broadcast` 同步各窗口。

**刷新时机与失败降级（P8 门禁核心）**

- **D-04:** `refreshSkills()` 在**每次 `_recreateAgent()` 之前无条件 `await` 重扫**两个技能目录（`init()` 首次同样如此）。这是唯一能自动覆盖第 6 条失效路径——模型经 `write` / `bash` 工具直接改写 `skills/foo/SKILL.md`（不经过任何 Realm 管理器、无事件可挂）——的机制。代价为每次切会话重读两个目录（上限 `MAX_USER_SKILLS × MAX_SKILL_MD_BYTES ≈ 3.2 MB`，仅切会话时发生）。— **Reversibility:** costly — 该兜底同时是 P8 门禁的验收面；降级为条件重扫会让门禁失去对第 6 条路径的覆盖，且重新引入"6 个触发点逐一挂刷新"的审计负担。
- **D-05:** **分层降级**，两个层级语义不同：
  1. **单个技能失败**（非法 name / 超长 description / YAML 解析失败 / 超限）= 正常态：产出诊断 + 跳过该技能，其余技能照常注入；
  2. **整批 `refreshSkills()` 抛错**（目录不可读等）→ **保留上一次成功快照** + 产 error 级诊断（不清空技能集、不静默）。

**遮蔽、诊断与名称权威**

- **D-06:** 同名遮蔽（user > managed）**保留在技能集内**：user 版正常参与注入；managed 版标记 `shadowed = true` + `shadowedBy = 'user'`，**不进 prompt、不占 prompt 预算、不参与 `/skill:` 解析**，但保留在数据层供 Phase 48（来源徽标 /「被遮蔽的同名技能可见」）与 Phase 50（列表与诊断）消费。去重发生在注入之前，且优先级逻辑只在主进程一份（renderer 只渲染）。— **Reversibility:** costly — `shadowed` / `shadowedBy` 被 Phase 48 与 50 的渲染消费；改为"剔除只留诊断"需两个阶段同时改数据源与展示层。
- **D-07:** 诊断数据形态：诊断**内联在 `skill.diagnostics[]`**（每条含 `level` / `code` / `message`；限额类额外带 `limit` + `currentValue`），另设**模块级 `errors[]`** 承接"无对应技能"的整批错误（如 D-05 第 2 层）。禁止静默失败（SKILL-06）。
- **D-08:** frontmatter `name` 与目录名不一致时，**以目录名为权威重写 `skill.name`** + 产诊断。理由：`validateName` 只产 warning 且 `name = frontmatterName || parentDirName`，于是 `skills/evil/SKILL.md` 声明 `name: find-skills` 可合法冒名（P3 前半）；重写既杜绝冒名、又不丢弃命名不规范的合法技能（GitHub 导入常见），并保证 `skill.name` 与 `dirname(skill.location)` 恒一致，使 `/skill:name` 解析确定。

**启停状态与资源限额**

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

### Deferred Ideas (OUT OF SCOPE)

- **加载面收窄（深度过滤 / 根文件加载策略 / 幽灵技能防护）** — 用户明确交 plan 期决定，本阶段不作硬性约定
- **DOC-01 骨架粒度** — 用户明确交 plan 期决定（六节骨架 vs 只写已落地部分）
- **O5 显式解析 frontmatter（是否把 `yaml` 提升为直接依赖）** — 归 Phase 51；本阶段只经 `loadSkills` 往返，不 `require('yaml')`
- **O8 `/compact` 不保留技能正文** — 倾向 v1 不保留，写进 `docs/product/ai-skills.md` 已知限制（本阶段落占位）
- **O3 `allowed-tools` 解析 + 免责标注** — 解析在 47/51，执行层门禁明确 Out of Scope
- **ECO-01..06**（多技能包勾选 / 内置技能升级推送 / 技能正文经 `/compact` 保留 / 占位符替换 / 四态可见性 / 容器级作用域）— 见 `REQUIREMENTS.md` v2 Requirements，非本期

### 另需遵守的既有约定（非 CONTEXT.md，但同等约束）

- 本阶段**明确不研究不规划**：Phase 47（播种 + bash 加固）、48（`/` 面板 + `/skill:`）、49（`manage_skill`）、50（设置页 + `/api/skills/*`）、51（zip / 网络导入）
- `AGENTS.md`：asarUnpack / 原生模块发布规则、`realm://` CSP `style-src 'self'`（内联 style 被拦）、弹框居中约定、产品文档同步维护约定
- `docs/product/ai-agent-workspace.md` 是工作区/沙箱边界的权威产品文档；本阶段新增技能目录后需同步（CONTEXT.md 指 DOC-02 在 47 补齐，但目录结构段落属本阶段产出）。**注（已被 ROADMAP 覆盖）**：ROADMAP §Phase 46 Doc sync 与 REQUIREMENTS DOC-02 把该文档的目录树同步明确归 **Phase 47**；本阶段**不得**改动该文档，只新建 `docs/product/ai-skills.md` 并做说明性互引（见 46-04 Task 3 item 5 与 `git status --porcelain` gate）。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKILL-01 | `agent-workspace` 启动时自动创建 `skills/` 与 `managed-skills/` 两个子目录，且两者位于硬沙箱 root 内可达（`resolveInside` 放行） | §Wiring Point 1（`ensureWorkspaceDir:96-100` 加两行 mkdir，`main.js:4040` 启动已调）；沙箱**零改动**已由探针实测证实（`loadSkills(sandboxEnv, …)` 直接可用，17 个 FileSystem 方法覆盖 SDK 用到的全部 5 个） |
| SKILL-02 | 系统提示词动态注入 `<available_skills>` 段（含 name / description / location），无技能时该段为空（不注入空标签） | §SDK 契约 A（`formatSkillsForSystemPrompt([]) === ''` 探针实测）；§Wiring Point 2（`buildSystemPrompt:561-564` 第 4 段） |
| SKILL-03 | 技能加载异步完成后同步可读（模块级缓存 + 同步访问器），两处 Agent 创建点（`init()` / `_recreateAgent()`）均在构造 Agent **之前**完成加载 | §Wiring Points 3/4（`init():808→821`、`_recreateAgent():2432→2453`）；§Pattern：模块级缓存 + 同步访问器（`ai-memory-manager.buildGlobalSnapshot:365` 先例 + `G-42-4` 同步契约） |
| SKILL-04 | 技能集变更后（安装 / 卸载 / 启用禁用 / `manage_skill` / Agent 重建）刷新 Agent 的 system prompt 且**不重建 Agent**；变更经跨窗口广播同步各窗口 | §Wiring Point 5（`syncAgentSystemPrompt()`）；`agent.state.systemPrompt` 可写性与每轮重读已行号级确证（`agent.js:155-157` + `:280-286`）；广播 `windowManager.broadcast:310` |
| SKILL-05 | 用户技能与 managed 技能同名时用户技能遮蔽 managed（user > managed），去重发生在注入之前；同名冲突对用户可见 | §SDK 契约 B（`loadSourcedSkills` 返回 `{skill, source}` 包装，探针实测；SDK **不做** name 去重，同名会产出两条 `<skill>`）；§Pattern：去重 + `shadowed`/`shadowedBy`（D-06） |
| SKILL-06 | 技能加载诊断（非法 name / 超长 description / YAML 解析失败）透传到设置页，不静默失败 | §SDK 契约 C（`SkillDiagnostic` 真实形状 `{type,code,message,path}` + 探针实测 4 类诊断原文）；§Pitfall 4（真实 `type` 字段名是 `type` 非 `level`） |
| SKILL-07 | 技能资源限额集中定义并生效（SKILL.md 正文字节上限、用户技能数量上限、prompt 段字符预算），超限时给出「哪个限额 / 当前值」的可操作提示 | §Pattern：三常量单源（`ai-memory-manager.BUDGETS:19` 先例）；§Pitfall 5（字节上限必须**在 SDK 解析前**生效，否则畸形 10MB YAML 仍被解析——P7）；§Code Examples：预算截断算法 |
| SKILL-08 | 用户可对单个技能启用/禁用（存储于设置，加载后过滤，**不删文件**） | §Pattern：`settings.aiSkills.disabled` 注入式读取（`ai-bash-policy.evaluateBashCommand(cmd, whitelist)` + `ai-manager.js:5511-5513` 先例）；§Open Question 3（禁用技能是否保留在 `skills[]` 内需 plan 期拍板，理由见该节） |
| DOC-01 | 新建 `docs/product/ai-skills.md` 产品说明（能力、双目录、优先级、限额、安全边界、已知限制） | §Architecture：`docs/product/` 现有三份文档（`ai-agent-workspace.md` / `ai-chat-attachments.md` / `navigation-entry-points.md`）为格式先例；六节骨架 + 本阶段已落地内容 + O8/O3 占位 |
</phase_requirements>

---

## Summary

Phase 46 的**全部技术不确定性已被本次研究消除**。九项 plan 级未知数（加载器签名、递归语义、`Skill` 字段表、`agent.state` 可写性、两处创建点行号、`env` 关系、诊断形状、建目录扩展点、测试策略）全部用**逐行读源码 + 本机可执行探针**闭环，没有一项依赖训练记忆或推断。

三条最重要的结论：

1. **沙箱归属零改动，且已被实测证明。** `createSandboxEnv()` 的返回值可以直接作为 `loadSkills` 的 `env` 参数——SDK 只用 `fileInfo` / `listDir` / `readTextFile` / `canonicalPath` / `joinPath` 五个方法，全部已在沙箱包装范围内。探针用真实沙箱 env 成功加载了技能、并在遇到"指向工作区外的 symlink 目录"时正确降级为 `file_info_failed` 诊断而非逃逸。**本阶段 `agent-workspace.js` 的唯一改动是 `ensureWorkspaceDir()` 加两行 `mkdirSync` + 两个路径访问器。**

2. **`CONTEXT.md` 中三处字段名与真实 SDK 不符，必须在 plan 前修正** —— 这是本次研究最贵的发现，因为三处都会在 executor 侧以最难定位的方式失效：
   - `Skill` 的路径字段叫 **`filePath`**，不叫 `location`（`<location>` 只是 `formatSkillsForSystemPrompt` 输出的 XML **标签名**）。`CONTEXT.md:44` 与 `:93` 写作 `dirname(skill.location)`。
   - SDK 诊断的严重度字段叫 **`type`**（值恒为 `"warning"`），不叫 `level`。`CONTEXT.md:43` 写作"每条含 `level` / `code` / `message`"。D-07 要求的 `level` 是 **Realm 自建诊断**的形状，与 SDK 诊断合并时必须显式映射，不能假定同名字段。
   - `loadSourcedSkills` 返回的元素是 **包装对象 `{skill, source}`**，不是把 `source` 摊平进 `Skill`。`arch` 研究里的 `merged.map(s => s.skill)`（`ARCHITECTURE.md:220`）正是这个原因。

3. **加载器的两个"静默黑天鹅"行为已被实测复现，必须主动防护。** `skills/` 根目录一旦出现 `SKILL.md`，SDK 会**只加载它并立刻 `return`**——根层其余子目录全部不再扫描。实测：`skills/alpha/SKILL.md` 存在时加载出 `['alpha']`；写入 `skills/SKILL.md` 后加载结果变成 `['rooty']`——**`alpha` 彻底消失，只有一个 warning**。这不是理论风险，是"用户手动放错一个文件，整个技能集静默清零"。同类问题：根层散落的带 `description` 的 `*.md` 会被当作技能加载，且 `name` 取**被扫描根目录的目录名**（实测 `skills/README.md` → 技能名 `skills`）。

**Primary recommendation:** 新建 `ai-skills-manager.js` 作为唯一数据权威，在其内部**用一层薄 env 包装（`createSkillsEnv(sandboxEnv)`）把加载面收窄到契约布局 `<dir>/<name>/SKILL.md`**，再叠加一层加载后深度过滤兜底深嵌套；`ai-manager.js` 只做四处接线（第 4 段 prompt、两处创建点前 `await refreshSkills`、新增 `syncAgentSystemPrompt()`）。除 D-11 已锁定的三个常量外，本阶段**零新增依赖**（`package.json` dependencies 原样不动）。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 技能目录创建（`skills/` / `managed-skills/`） | **主进程**（`agent-workspace.js` `ensureWorkspaceDir`） | — | 沙箱 root 的唯一定义者是主进程；renderer 不感知文件系统路径 |
| 技能加载 / 校验 / 去重 / 限额 / 诊断聚合 | **主进程**（新建 `ai-skills-manager.js`） | — | 单一数据权威；优先级逻辑只此一份（D-06 / ARCHITECTURE Anti-Pattern 5：renderer 不得重建优先级表） |
| system prompt 技能段拼装 | **主进程**（`ai-manager.js` `buildSystemPrompt`） | — | 冻结快照契约（G-42-4）；同步函数，只能读缓存 |
| 技能集缓存失效与 Agent prompt 回写 | **主进程**（`ai-manager.js` `syncAgentSystemPrompt` + `ai-skills-manager.refreshSkills`） | — | `agent.state` 只在主进程可达 |
| 跨窗口变更通知 | **主进程**（`windowManager.broadcast`） | 各窗口 renderer 监听 | 既有 `bookmarks-bar:refresh` 同款；本阶段只发事件，消费方在 48/50 |
| 技能文件内容读取（模型侧） | **主进程**（`read` 工具 → 沙箱 `env`） | — | 技能正文经 `read` 工具进入对话；沙箱是唯一路径判据 |
| `settings.aiSkills.disabled` 读取 | **主进程**（`ai-manager` 从 `configStore` 取值后**注入** manager） | — | 照 `aiBashWhitelist` 先例：manager 保持无 configStore 依赖 → 纯 Node 可测 |
| 技能列表 / 诊断展示 | **Renderer**（Phase 48 主窗口、Phase 50 settings guest） | — | 本阶段**不实现**；数据形状需预留（D-06 / D-07） |

**跨层判据（本阶段最易踩）：** 技能段的**唯一**生产者是主进程模块级缓存。任何"renderer 自己算一遍"或"两处 Agent 创建点各自加载"的实现都会命中 ARCHITECTURE Anti-Pattern 5 与 P8 门禁。

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-agent-core` | `0.84.3`（worktree 实装；`package.json` 声明 `^0.84.3`） | 技能加载原语（`loadSkills` / `loadSourcedSkills`）、prompt 段生成（`formatSkillsForSystemPrompt`）、`Agent` | 项目既有 AI 栈；本阶段**全部**能力由它提供，Realm 自建代码只是编排层 |
| Node.js | `v22.22.0`（本机实测） | 运行时 | SDK 要求 ≥ 22.19.0，已满足（`ai-manager.js:9-11` 记录了旧版 Electron 内置 Node 20 不达标的隐患） |
| Electron | `43.6.0`（本机实装） | 主进程运行时 | 既有 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert` | Node 内置 | 单元测试 | 照 `tests/test-agent-workspace.js` / `tests/test-ai-bash-policy.js` 单文件脚本式（`node tests/test-ai-skills.js`），**不引入测试框架依赖** |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `loadSourcedSkills` | 两次 `loadSkills` + 手动挂 source | `loadSourcedSkills` 内部就是逐 input 调 `loadSkills`（`skills.js:53-54`，探针实测）——自己写是纯重复，且会丢掉"诊断也带 source"（`skills.js:58-59`） |
| 薄 env 包装收窄加载面 | 加载后按 `filePath` 深度过滤 | 单纯加载后过滤**无法阻止** SDK 读取并 YAML-解析超大 `SKILL.md`（P7 明确要求"在交给 SDK 之前按字节预筛"），也拦不住 `skills/SKILL.md` 造成的整组黑屏（黑屏发生在 SDK 内部 `return`，加载后只剩一个结果）。两者**互补**，不是二选一 |
| 薄 env 包装收窄加载面 | 在技能目录写 `.ignore` / `.gitignore` | **已实测证伪**：根层 `.ignore` 内容 `/*.md` 会让**全部**技能消失（`alpha` 也丢）。原因见 §Pitfall 1。且往用户数据目录写隐藏文件是新增状态 |
| 薄 env 包装收窄加载面 | 修改 SDK 或 fork | 升级漂移；且 SDK 内部 `includeRootFiles` 参数**不可从外部传入**（`skills.js:38` 硬编码 `true`） |
| 用 `yaml` 自己解析 frontmatter | — | **本阶段明确不做**（Deferred/O5）。`yaml@2.9.0` 与 `ignore@7.0.5` 只是 pi-agent-core 的传递依赖，未列入 `package.json` dependencies；一旦 Realm 直接 `require`，换 pnpm / `--install-strategy=nested` 立刻 `MODULE_NOT_FOUND`（P11）。经 `loadSkills` 往返即可获得与运行时**完全一致**的校验语义 |

**Installation:**

```bash
# 本阶段零新增依赖 —— 不执行任何安装命令
```

**Version verification（本次会话实测）:**

```bash
node -e "console.log(require('./node_modules/@earendil-works/pi-agent-core/package.json').version)"  # 0.84.3
node --version    # v22.22.0
node -e "console.log(require('./node_modules/electron/package.json').version)"                      # 43.6.0
```

`package.json` 的 `dependencies` 全量已直读确认**无任何 zip 解包库**（Phase 51 才需要），Phase 46 不需要改动依赖树。

---

## Package Legitimacy Audit

**本阶段不安装任何外部包。** `package.json` 的 `dependencies` 与 `devDependencies` 均保持原样，`build.asarUnpack` 不动（无原生模块、无随包资产——`skills-builtin/` 的打包属 Phase 47）。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| （无） | — | — | — | — | — | 本阶段零新增依赖 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**传递依赖红线（P11，属本阶段纪律）：** `yaml@2.9.0` 与 `ignore@7.0.5` 在本机 `node_modules` 中存在（本次实测确认版本），但**未声明**在 `package.json`。Phase 46 只经 SDK 间接使用它们，**任何 `require('yaml')` / `require('ignore')` 都是引入 MODULE_NOT_FOUND 隐患的越界行为**（O5 明确归 Phase 51）。这条要写成代码注释或测试断言。

---

## SDK Loader & Prompt API Contract（九项未知数逐条闭环）

> 本节是全部结论中**证据等级最高**的一节：每一条都同时具备"源码行号直读"与"本机可执行探针实测"两重证据。探针脚本以真实 `createSandboxEnv()` 返回值为 `env`，在临时工作区构造 8 种技能布局（正常 / 同名 / 缺 name / 根层散落 md / 两层深嵌套 / 非法 name+超长 description / YAML 解析失败 / `disable-model-invocation`）逐项观察。

### A. 精确签名（`node_modules/@earendil-works/pi-agent-core/dist/harness/skills.d.ts`）

```ts
export declare function loadSkills(env: ExecutionEnv, dirs: string | string[]): Promise<{
    skills: Skill[];
    diagnostics: SkillDiagnostic[];
}>;

export declare function loadSourcedSkills<TSource, TSkill extends Skill = Skill>(
    env: ExecutionEnv,
    inputs: Array<{ path: string; source: TSource }>,
    mapSkill?: (skill: Skill, source: TSource) => TSkill
): Promise<{
    skills: Array<{ skill: TSkill; source: TSource }>;
    diagnostics: Array<SkillDiagnostic & { source: TSource }>;
}>;

export declare function formatSkillInvocation(skill: Skill, additionalInstructions?: string): string;
```

```ts
export type SkillDiagnosticCode = "file_info_failed" | "list_failed" | "read_failed" | "parse_failed" | "invalid_metadata";
export interface SkillDiagnostic {
    /** Diagnostic severity. Currently only warnings are emitted. */
    type: "warning";
    /** Stable diagnostic code. */
    code: SkillDiagnosticCode;
    /** Human-readable diagnostic message. */
    message: string;
    /** Path associated with the diagnostic. */
    path: string;
}
```

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.d.ts]`（全文直读）

**探针实测补充（源码类型声明未覆盖的事实）：**

| 事实 | 实测结果 |
|------|----------|
| 四个函数均可从**包根**动态 import | `loadSkills=function loadSourcedSkills=function formatSkillsForSystemPrompt=function formatSkillInvocation=function` |
| `loadSkills(env, <string>)` 单字符串入参可用 | 返回 5 个技能（与数组形式同目录结果一致） |
| **不存在的目录 → 静默跳过，零诊断** | `{"skills":0,"diags":0}` —— 与 `skills.js:23-34` 只在 `error.code !== "not_found"` 时产诊断一致。**这意味着"目录忘建"是无诊断的静默失效**，`ensureWorkspaceDir` 必须可靠 |
| 沙箱 env 直接可用 | 无需任何适配层；symlink 目录指向工作区外时降级为 `file_info_failed` + 沙箱中文拒绝原文，**未逃逸** |
| `loadSourcedSkills` 元素形状 | `{skill: {...}, source: 'user'|'managed'}` 包装（**非摊平**）；诊断形状 `{type, code, message, path, source}` |
| SDK **不做** name 去重 | 同名 `good` 同时出现在 user 与 managed 结果中；`formatSkillsForSystemPrompt` 无条件为两者各生成一条 `<skill>`（`system-prompt.js:12-18` 无 dedup 逻辑） |
| 每个源的加载顺序 | 同一目录内按 `entry.name.localeCompare` 排序（`skills.js:104`），递归深度优先；**该顺序不保证 user 优先**，Realm 必须自己定序 |

### B. `Skill` 完整字段表（`dist/harness/types.d.ts:28-39`）

```ts
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

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/types.d.ts:28-39]`（全文直读，含 JSDoc）

**探针实测 `Object.keys(skill)` 输出：** `["name","description","content","filePath","disableModelInvocation"]` —— 恰好五项，**无 `location`、无 `source`、无 `allowedTools`**（P6：`allowed-tools` 在本 SDK 中不存在，任何 UI/文档展示它都是虚假安全感）。

**`disable-model-invocation` 的解析位置与拼写（`skills.js:232`）：**

```js
disableModelInvocation: frontmatter["disable-model-invocation"] === true,
```

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:232]`

strict `=== true`：`disable-model-invocation: yes` / `"true"` **不会**生效。探针确认 `disable-model-invocation: true` → `dmi: true`。

**名称权威（`skills.js:219`）：**

```js
const name = frontmatterName || parentDirName;
```

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:219]`

配合 `validateName` 只产 warning（`skills.js:220-222` → `diagnostics.push`，无 `return null`），**D-08 的"`skills/evil/SKILL.md` 声明 `name: find-skills` 可合法冒名"已被实测复现**：探针中 `skills/evil/SKILL.md` 写 `name: seed`，加载结果的 `name` 就是 `seed`，仅多一条 `name "seed" does not match parent directory "evil"` 警告。

### C. 诊断的真实形状（关键：`type` 而非 `level`）

探针产出的四类诊断原文（`path` 已替换为 `<root>`）：

```json
[{"type":"warning","code":"parse_failed","message":"Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 23:\n\ndescription: [unclosed\n                      ^\n","path":"<root>/skills/broken/SKILL.md"},
 {"type":"warning","code":"invalid_metadata","message":"description exceeds 1024 characters (1100)","path":"<root>/skills/evil/SKILL.md"},
 {"type":"warning","code":"invalid_metadata","message":"name \"seed\" does not match parent directory \"evil\"","path":"<root>/skills/evil/SKILL.md"},
 {"type":"warning","code":"invalid_metadata","message":"description is required","path":"<root>/skills/nodesc/SKILL.md"}]
```

**与 D-07 的字段差异（必须在 plan 中显式处理）：**

| 概念 | SDK 字段 | D-07 要求的 Realm 字段 | 合并规则 |
|------|---------|----------------------|---------|
| 严重度 | `type: "warning"` | `level` | 映射 `warning → 'warning'`；Realm 自建诊断可用 `'error'`（D-05 第 2 层整批失败）/ `'warning'` |
| 稳定码 | `code`（5 个枚举值） | `code` | 同名，直接透传；Realm 自建码需与 SDK 枚举**不重叠**（建议前缀 `realm_`） |
| 人读信息 | `message` | `message` | 直接透传（原文含限额与当前值，如 `description exceeds 1024 characters (1100)` —— 天然满足 SKILL-07 的"哪个限额/当前值"） |
| 关联路径 | `path`（技能文件绝对路径） | 未规定 | 建议保留 `path` 字段，供 Phase 50 定位 |
| 限额附注 | **无** | `limit` + `currentValue` | Realm 自建诊断补齐（SDK 的 `invalid_metadata` 只把数值写在 message 文本里） |
| 来源 | `source`（仅 `loadSourcedSkills` 追加，`skills.js:58-59`） | 未规定 | 建议保留，Phase 48/50 需要 |

**注意 `description is required` 这条的语义陷阱：** 它在 `loadSkillFromFile` 里**先于** `return { skill: null }` 产生（`skills.js:223-225`），所以它是"该技能被跳过"的唯一提示——但**不进 prompt、不出现在设置页列表**才是后果。D-05 第 1 层"单技能失败 = 正常态：诊断 + 跳过"正是这个语义。

### D. 递归扫描的精确语义（含 `includeRootFiles` 是否可外部收窄）

**结论：`loadSkills` 没有任何 options 参数，`includeRootFiles` 是内部参数且根层硬编码 `true`。**

```js
// skills.js:19  ——  签名只有 (env, dirs)
export async function loadSkills(env, dirs) {
// skills.js:38  ——  根层调用硬编码 includeRootFiles = true
const result = await loadSkillsFromDirInternal(env, rootInfo.path, true, ignore(), rootInfo.path);
// skills.js:116 ——  子目录一律 false
const result = await loadSkillsFromDirInternal(env, fullPath, false, ignoreMatcher, rootDir);
```

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:19,38,116]`

**`SKILL.md` 短路 `return`（`skills.js:88-103`）—— 实测确认其破坏力：**

```js
for (const entry of entries) {                    // :88
    if (entry.name !== "SKILL.md") continue;
    ...
    const result = await loadSkillFromFile(env, fullPath, dirInfo.name);
    if (result.skill) skills.push(result.skill);
    diagnostics.push(...result.diagnostics);
    return { skills, diagnostics };               // :102  ← 整层短路
}
```

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:88-103]`

实测两态对照（同一 `skills/` 目录，仅增删根层 `SKILL.md`）：

```
baseline                      -> skills: alpha
after root SKILL.md           -> skills: ["rooty"]      diags: 1
```

**`alpha` 完全消失**，只剩一条 `name "rooty" does not match parent directory "skills"` 警告。这不是"少一个技能"，是"整个技能集被一个放错位置的文件顶替"。**必须主动防护，且防护必须发生在 SDK 遍历之前**（事后过滤处理不了"只剩一个结果"）。

**递归深度无上限（`skills.js:115-119` 无条件递归，只跳过 `.` 开头与 `node_modules`）：**

实测 `skills/deep/nested/SKILL.md` → 加载成功且 `filePath` 为 `<root>/skills/deep/nested/SKILL.md`、name 为 `nested`（frontmatter 声明值）。三层技能同样进结果集。

**"相对深度 = 2"过滤的实现方式与实测验证：**

```js
/** 只保留 <scannedDir>/<name>/SKILL.md 这一层 */
const inContractLayout = (scannedDir, filePath) =>
  path.relative(scannedDir, filePath).split(path.sep).filter(Boolean).length === 2;
```

实测：对 `skills/` 目录，`alpha@skills/alpha/SKILL.md` → `true`，`README.md`（1 段）→ `false`，`deep/nested/SKILL.md`（3 段）→ `false`。`depth-filter keep: alpha` ✓

> **重要边界：** 该过滤**不能**替代对根层 `SKILL.md` 的防护（此时 SDK 只返回根层那一个结果，过滤后技能集变成**空集**——虽然比"被顶替"好，但仍需一条显式诊断，否则用户面对"技能全没了但不知道为何"）。两条防护必须并存。

### E. `agent.state.systemPrompt` 可写性与每轮重读（行号级证据）

```js
// dist/agent.js:150-157
    /**
     * Current agent state.
     *
     * Assigning `state.tools` or `state.messages` copies the provided top-level array.
     */
    get state() {
        return this._state;                      // ← 返回内部对象本身，非快照
    }
```

```js
// dist/agent.js:27-30（createMutableAgentState 返回值）
    return {
        systemPrompt: initialState?.systemPrompt ?? "",      // ← 普通可写属性
```

```js
// dist/agent.js:280-286
    createContextSnapshot() {
        return {
            systemPrompt: this._state.systemPrompt,          // ← 每轮重新读取
            messages: this._state.messages.slice(),
            tools: this._state.tools.slice(),
        };
    }
```

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/agent.js:27-30,155-157,280-286]`

**结论链完整**：`get state()` 返回 `_state` 本体（非快照）→ `_state.systemPrompt` 是 `createMutableAgentState` 里赋的普通属性（不在 `get`/`set` 访问器列表内，`tools`/`messages` 才是）→ 每次 `prompt()` / `promptContinue()` 都经 `createContextSnapshot()` 重读（`:272`、`:277` 是两处调用点）。**`D-03` 的"直接改写 `agent.state.systemPrompt`、不重建 Agent"技术上成立，且下一轮即生效。**

**唯一注意：** 生效边界是"下一次 `prompt()` 调用"，流式进行中改写不会影响当前轮（`createContextSnapshot` 已在 `:272` 调用时取过值）。`ARCHITECTURE.md:266` 建议的 `isProcessing` 忙时置脏标记是对的。

### F. `loadSkills` 与沙箱 `env` 的关系（本题答案：**直接用 `createSandboxEnv()`，不需要任何适配**）

`skills.js` 只调用 `env` 的五个方法：`fileInfo`（`:23,66,145,281,293`）、`listDir`（`:82`）、`readTextFile`（`:159,198`）、`canonicalPath`（`:281`）、`joinPath`（`:134`）。

`createSandboxEnv()` 的返回对象（`agent-workspace.js:207-349`）**逐项覆盖全部 17 个 FileSystem 方法**（`absolutePath` / `joinPath` / `readTextFile` / `readTextLines` / `readBinaryFile` / `writeFile` / `appendFile` / `renameFile` / `fileInfo` / `listDir` / `canonicalPath` / `exists` / `createDir` / `remove` / `createTempDir` / `createTempFile` / `exec` + `cwd` + `cleanup`）——五个方法一个不漏。`[VERIFIED: agent-workspace.js:207-349]`

**探针实测闭环：** `loadSkills(sandboxEnv, [skillsDir, managedDir])` 与 `loadSourcedSkills(sandboxEnv, [...])` 均在真实沙箱 env 上成功返回，且 symlink 逃逸尝试被沙箱正确拒绝。**接线复杂度：零。**

**唯一不做的事：** 不要为技能加载单独构造第二个 env 实例。`ai-manager.js:808` 的 `this.sandboxEnv` 在 `init()` 创建后全程存活（仅在构造器 `:665` 置 null），`_recreateAgent()` 复用同一个 —— 直接传 `this.sandboxEnv` 即可。

### G. SDK 原生参数能否把加载面收窄到固定一层（本题答案：**不能，且 `.ignore` 变通已实测证伪**）

| 候选手段 | 结论 | 证据 |
|---------|------|------|
| `loadSkills(env, dirs, options)` | **不存在** —— 签名只有两个参数 | `skills.d.ts` 全文直读 |
| `includeRootFiles` 参数 | **不可外部传入**，根层硬编码 `true` | `skills.js:38` |
| 根层放 `.ignore` 内容 `/*.md` | **实测证伪**：会让**全部**技能消失（`(none)`，连 `alpha` 也丢） | 探针 3 实测 |
| 根层放 `.gitignore` 内容 `/*.md` | 同上，同样 `(none)` | 探针 3 实测 |
| 根层 `.ignore` 写具体文件名（如 `README.md`） | 有效但只对该名字生效，且需往用户数据目录写隐藏文件 | 探针 3 实测 |
| **薄 env 包装 `listDir`** | **推荐** —— 在两个扫描根把非目录 entry 滤掉，从源头同时消灭"幽灵根文件"与"根 `SKILL.md` 黑屏" | 见 §Pattern 1 |

**`.ignore` 证伪的根因（源码级）：** `prefixIgnorePattern` 会**剥掉** pattern 的前导 `/`（`skills.js:187-188`）

```js
    if (pattern.startsWith("/"))
        pattern = pattern.slice(1);
```

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:187-188]` —— 于是 `/*.md` 变成 `*.md`，而 `ignore` 包中"不含斜杠的 pattern"匹配**任意层级**的 basename，`good/SKILL.md` 一并被忽略。根锚定语义被这次剥离破坏，**无法用 ignore 文件表达"仅根层"**。

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────── 应用启动 ────────────────────┐
                    │ main.js:4040  agentWorkspace.ensureWorkspaceDir() │
                    │   ├─ agent-workspace/            (既有)           │
                    │   ├─ .tmp/  attachments/         (既有)           │
                    │   └─ skills/  managed-skills/    ★本阶段新增      │
                    └──────────────────────┬───────────────────────────┘
                                           │ 目录就位（否则加载静默返回空，零诊断）
                                           ▼
┌───────────────────────── ai-manager.init() ──────────────────────────┐
│ :808  this.sandboxEnv = await createSandboxEnv()                     │
│         └─ 内部再次 ensureWorkspaceDir()（双保险）                    │
│ :8xx  ★ await getAiSkillsManagerLazy().refreshSkills(                │
│            this.sandboxEnv, { disabled })          ← 唯一异步加载入口 │
│ :821  new Agent({ initialState: { systemPrompt: buildSystemPrompt() }})│
│         └─ buildSystemPrompt() 同步读缓存 ────────────┐               │
└───────────────────────────────────────────────────────┼──────────────┘
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │ buildSystemPrompt() (同步契约) │
                                       │  ①REALM_SYSTEM_PROMPT  (静态)  │
                                       │  ②buildWorkspacePrompt (半静态)│
                                       │  ③buildGlobalSnapshot  (冻结)  │
                                       │  ④buildSkillsPrompt()  ← 本阶段│
                                       │     纯读 _cache.promptBlock    │
                                       │     空态返回 '' → 不追加段     │
                                       └────────────────────────────────┘

   技能集变更（本阶段可触发的两条）
   ┌──────────────────────────────┐   ┌───────────────────────────────────┐
   │ 模型经 write/bash 直改 skills/│   │ 任一 _recreateAgent() 调用点      │
   │ （无事件可挂 — 第 6 条路径）  │   │ :942 :1051 :2025 :2116 (切会话)   │
   └──────────────┬───────────────┘   └───────────────┬───────────────────┘
                  │  兜底：每次重建都重扫              │
                  └───────────────┬────────────────────┘
                                  ▼
              refreshSkills(env, {disabled})  ← 无条件 await（D-04）
                 ├─ loadSourcedSkills(skillsEnv, [
                 │      {path: managedDir, source:'managed'},
                 │      {path: skillsDir,  source:'user'}])
                 │      └─ 内部逐个 loadSkills（async、无上限递归）
                 ├─ 深度过滤（契约布局 <dir>/<name>/SKILL.md）
                 ├─ D-08 name 重写为目录名 + 诊断
                 ├─ D-09 disabled 过滤
                 ├─ D-06 同名遮蔽（user 胜出，败者标 shadowed）
                 ├─ D-10 定序 + 预算截断 → formatSkillsForSystemPrompt
                 └─ 写 _cache {skills, promptBlock, digest, diagnostics, errors}
                                  │
         success ─────────────────┼──────────────── 抛错（D-05 第 2 层）
                                  │                 └→ 保留上次 good 快照 + errors[]
                                  ▼
              syncAgentSystemPrompt()  (D-03)
                 ├─ agent 不存在 / sandboxEnv 缺失 → 早退
                 ├─ isProcessing / state.isStreaming → 置脏标记，idle 后重试
                 ├─ digest 未变 → 不动（保 prefix cache）
                 └─ 变化 → agent.state.systemPrompt = buildSystemPrompt()
                                  │
                                  ▼
              windowManager.broadcast('skills:changed')   ← 消费方在 48/50
                                  │
                                  ▼
              模型下一条消息看到新的 <available_skills>
```

### Recommended Project Structure

```
<repo root>
├── ai-skills-manager.js        ★新增  技能单一数据权威（加载/缓存/去重/诊断/限额/定序）
├── ai-manager.js                       改：4 处接线
├── agent-workspace.js                  改：2 个访问器 + ensureWorkspaceDir 加 2 行 mkdir
├── tests/
│   └── test-ai-skills.js       ★新增  node:test 单文件脚本（照 test-agent-workspace.js 脚手架）
└── docs/product/
    └── ai-skills.md            ★新增  六节骨架产品说明（DOC-01）
```

**Structure rationale:** `ai-skills-manager.js` 与 `ai-manager.js` / `ai-memory-manager.js` / `ai-bash-policy.js` 平铺在仓库根——主进程模块的既有布局就是根目录平铺，不引入 `src/main/` 重构。测试放 `tests/`（既有 17 个 `test-*.js` 的主约定），**不放** `test/`（那是 Phase 43 记忆模块的例外目录）。

---

### Pattern 1: 薄 env 包装把加载面收窄到契约布局（本阶段的核心防护）

**What:** 在沙箱 env 之上再包一层"技能语义 env"，在两个扫描根把 `listDir` 结果收敛为**目录**、在 `readTextFile` 对 `SKILL.md` 施加字节上限。SDK 拿到的世界与 Realm 的契约布局一致，于是 SDK 的所有"非直觉行为"都不会被触发。

**When to use:** 每次 `refreshSkills` 构造 `env` 时。包装是**一次性的**（每轮刷新建一个对象，零持久状态）。

**Why this shape:** 三个必须同时解决的问题，只有"在 SDK 遍历之前介入"能一次解决：
1. 根层 `SKILL.md` 造成整组黑屏（**事后过滤救不回来**，SDK 只返回那一个结果）
2. 根层散落 `*.md` 变成幽灵技能（事后过滤能救，但白读白解析一遍）
3. 超大 `SKILL.md` 被 YAML 解析（P7 硬要求"在交给 SDK 之前按字节预筛"——事后过滤救不回来，解析已发生）

```js
// Source: agent-workspace.js:207-349（createSandboxEnv 的展开式结构）+ SDK skills.js:82,198 的调用点
/**
 * 技能语义 env：在沙箱 env 之上收窄加载面（不替代沙箱，只叠加）
 *
 * 镜像 createSandboxEnv 的纪律：**显式转发每一个方法**，不用 Proxy，
 * 避免漏包某方法时静默落到非沙箱实现。
 *
 * @param {object} sandboxEnv - createSandboxEnv() 的返回值
 * @param {{rootDirs: string[], maxSkillMdBytes: number}} opts
 * @param {string[]} droppedNotices - 被滤掉的非目录 entry 名收集器（转诊断，禁止静默）
 */
function createSkillsEnv(sandboxEnv, { rootDirs, maxSkillMdBytes }, droppedNotices) {
  const isRoot = (p) => rootDirs.some((d) => path.resolve(d) === path.resolve(p));
  return {
    ...sandboxEnv,                                   // 17 个方法 + cwd + cleanup 全部保留

    async listDir(p, abortSignal) {
      const res = await sandboxEnv.listDir(p, abortSignal);
      if (!res.ok || !isRoot(p)) return res;
      // 契约布局：扫描根下只认目录。非目录 entry 一律不交给 SDK。
      const dirs = res.value.filter((e) => e.kind === 'directory');
      for (const e of res.value) {
        if (e.kind !== 'directory') droppedNotices.push({ path: e.path, kind: e.kind });
      }
      return { ok: true, value: dirs };
      // 效果：根层 SKILL.md 不再短路整组（skills.js:88-103 永不被触发）
      //       根层 README.md 不再变幽灵技能
    },

    async readTextFile(p, abortSignal) {
      if (path.basename(p) === 'SKILL.md') {
        const info = await sandboxEnv.fileInfo(p, abortSignal);
        if (info.ok && info.value.size > maxSkillMdBytes) {
          // 不读盘、不解析 → SDK loadSkillFromFile 收 read_failed 诊断并跳过
          const { FileError, err } = await import('@earendil-works/pi-agent-core');
          return err(new FileError('invalid',
            `SKILL.md 超过 ${maxSkillMdBytes} 字节上限（当前 ${info.value.size} 字节）`, p));
        }
      }
      return sandboxEnv.readTextFile(p, abortSignal);
    },
  };
}
```

**关键正确性说明：**
- `...sandboxEnv` 展开一个**对象字面量**（`createSandboxEnv` 的返回值不是 class 实例），17 个方法全部被复制，不会退化。这与 `agent-workspace.js:207-349` 显式列出全部方法同款纪律。
- `listDir` 拦截只作用于**两个扫描根本身**（`isRoot`），不影响 `skills/<name>/` 内的枚举——技能自带的 `references/`、`scripts/`、`assets/` 目录不受影响。
- `readTextFile` 拦截只作用于 basename 为 `SKILL.md` 的路径，`.ignore` / `.gitignore` 的读取不受影响。
- 被滤掉的非目录 entry 进 `droppedNotices` → `refreshSkills` 转成 Realm 诊断，**满足 SKILL-06 的"不静默"**。这正是 D-05 第 1 层与 D-07 的组合语义。

### Pattern 2: 分层叠加——薄 env 收窄 + 加载后深度过滤

**What:** env 包装解决"根层污染"，加载后深度过滤解决"深嵌套"。两者**不可互相替代**。

```js
// Source: 探针实测（path.relative 深度判定）；SDK skills.js:115-119 的无上限递归
/** 契约布局：<scannedDir>/<name>/SKILL.md —— 相对深度恰为 2 段 */
function inContractLayout(scannedDir, filePath) {
  return path.relative(scannedDir, filePath).split(path.sep).filter(Boolean).length === 2;
}
```

**实测验证：** 对 `skills/`，`alpha/SKILL.md` → 保留；`README.md` → 丢弃；`deep/nested/SKILL.md` → 丢弃。`depth-filter keep: alpha` ✓

**注意两者叠加后的诊断语义：** 深嵌套丢弃也**必须**产诊断（`level:'warning'`，说明"技能必须放在 `<dir>/<name>/SKILL.md` 且不能有中间层"）。否则用户从 GitHub 拷来的多一层目录包会静默失效。

### Pattern 3: 模块级缓存 + 同步访问器（照抄 `ai-memory-manager` 先例）

**What:** 异步唯一入口 + 同步只读访问器的双面形态。

```js
// Source: ai-memory-manager.js:355-403（buildGlobalSnapshot 同步冻结快照）+ :19（BUDGETS 单源）
/** 三限额单源（D-11）—— 端点与前端零字面量 */
const LIMITS = {
  MAX_SKILL_MD_BYTES: 64 * 1024,
  MAX_USER_SKILLS: 50,
  SKILLS_PROMPT_CHAR_BUDGET: 8000,
};

/** 模块级快照：{ skills, promptBlock, digest, diagnostics, errors, refreshedAt } */
let _cache = { skills: [], promptBlock: '', digest: '', diagnostics: [], errors: [] };

/** 同步：仅供 buildSystemPrompt() 调用 —— 绝不触发 IO（G-42-4 同步契约） */
function buildSkillsPrompt() { return _cache.promptBlock; }

/** 同步：仅供 Phase 48 /skill: 解析与 Phase 50 列表 —— 零 IO */
function getSkillsSnapshot() { return _cache; }

/** 异步：唯一加载入口 */
async function refreshSkills(env, { disabled = [], rootDirs } = {}) { /* … */ }
```

**`getSkillsSnapshot()` 必须返回 `_cache` 的浅拷贝或冻结视图**——否则 Phase 48/50 的消费者可能就地改数组，污染权威（D-06"优先级逻辑只在主进程一份"的反面）。

### Pattern 4: 定序必须用确定性比较器，不能用 `localeCompare`

**What:** prompt 段的条目顺序决定 provider 前缀缓存的命中边界。SDK 内部用 `localeCompare`（`skills.js:104`），那对 **SDK 自己的遍历顺序**是合适的，但 Realm 拼 prompt 必须自己定序 —— 而 `localeCompare` 的结果依赖运行环境的 ICU/区域设置，同一份技能集在不同机器上可能排出不同顺序，**让前缀缓存跨设备漂移**。

```js
// Source: D-10 取舍顺序；对照 skills.js:104 的 localeCompare（SDK 内部用，Realm 不复用）
/** D-10 总序：user 来源 > 可自动激活 > name 码点序 */
const bySkillPriority = (a, b) =>
  (a.source === 'user' ? 0 : 1) - (b.source === 'user' ? 0 : 1) ||
  (a.disableModelInvocation === true ? 1 : 0) - (b.disableModelInvocation === true ? 1 : 0) ||
  (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
```

**这是全序**（同一 `name` + 同 `source` 不可能出现两条——D-08 的 name 重写为目录名后，单目录内 name 天然唯一，跨目录的重复已被 D-06 遮蔽处理）→ 定序稳定，无平局。

### Anti-Patterns to Avoid

- **每个 prompt 前重新加载技能**：`buildSystemPrompt()` 是同步契约（`ai-memory-manager.js:359-361` 有 G-42-4 事故记录），每轮异步加载要么破坏同步契约、要么引入竞态；且 systemPrompt 每轮变 → 前缀缓存全 miss。
- **在 renderer 侧重建优先级/默认表**：`AGENTS.md` 明写 `shortcut-manager` 教训"不要在 renderer 再写一份默认表"。技能优先级同理，只在 `ai-skills-manager` 一份。
- **只取 `result.skills` 丢 `result.diagnostics`**：SDK 的失效模式就是静默降级（`skills.js:204-224` 全程 `diagnostics.push` 无 throw），丢掉诊断等于把"装了但没生效"变成不可自查。
- **给技能目录之外的路径当加载根**：`formatSkillsForSystemPrompt` 把**绝对路径**写进 prompt 并指示模型 `read`（`system-prompt.js:7-8,16`）；路径在工作区外 → 硬沙箱拒绝 → 隐式匹配静默失效（ARCHITECTURE Anti-Pattern 3）。本阶段两目录必须在 `agent-workspace/` 内。
- **为 `managed-skills/` 做只读挂载或加第二个沙箱 root**：会引入第二套路径判据，与 `resolveInside` 的双基准/realpath 逻辑漂移（CONTEXT.md `<code_context>` 明写）。**不要碰沙箱。**

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 目录递归扫描 | 自己 `readdirSync` 递归 | SDK `loadSkills` / `loadSourcedSkills` | 已处理 ignore 文件、点目录/node_modules 跳过、`FileInfo.kind` 解析（含 symlink 的 `canonicalPath` 二次判定，`skills.js:278-306`） |
| SKILL.md frontmatter 解析 | 自己 `require('yaml')` 解析 | 经 `loadSkills` 往返读 `Skill[]` | ① 语义与运行时**完全一致**；② 避免把传递依赖提升为直接依赖（P11/O5，换 pnpm 立刻 `MODULE_NOT_FOUND`） |
| 名称/描述校验规则 | 自写一套 regex | 复用 SDK `validateName` / `validateDescription` 的**语义**（透传其诊断），Realm 侧只做"以目录名重写"（D-08） | 规则一旦分叉，Phase 49/51 的写入侧校验就会与加载侧不一致（P3 前半是 S1 门禁） |
| `<available_skills>` XML 生成 | 自己拼字符串 | `formatSkillsForSystemPrompt` | 含 `escapeXml`（`system-prompt.js:22-29` 转义 `& < > " '`）；自己拼会引入标签破坏面 |
| 诊断数据结构 | 自建一套与 SDK 平行的形状 | 透传 SDK `SkillDiagnostic` + 追加 Realm 字段 | 见 §Pattern 3 的字段映射表；自建会让 Phase 50 有两套要合并 |
| 三限额数值 | 在端点/前端再写字面量 | `ai-skills-manager` 单源导出 | Phase 43 `BUDGETS` 先例（`ai-memory-manager.js:19` `const BUDGETS = { user: 1375, global: 2200, container: 2200 };`）——端点与前端零字面量 |

**Key insight:** 本阶段的"自建"部分只应包含**编排**（加载时机、去重、定序、诊断聚合、限额裁决）与**一处防护**（薄 env 收窄加载面）。凡是 SDK 已经提供且语义被本次研究确认过的能力，自建都会引入分叉风险。

---

## Common Pitfalls（本阶段专属，全部经源码或实测确证）

### Pitfall 1: 根层 `SKILL.md` 静默顶替整个技能集

**What goes wrong:** 用户在 `agent-workspace/skills/` 直接放一个 `SKILL.md`（很自然的误操作），SDK 遍历时第一个 `for` 循环命中它、加载、**立即 `return`**（`skills.js:88-103`）。根层所有子目录不再扫描。
**实测复现:** 同一目录，仅增删 `skills/SKILL.md`：`['alpha']` → `['rooty']`，`alpha` 彻底消失，只有 1 条 warning。
**Why it happens:** `loadSkillsFromDirInternal` 的"目录含 SKILL.md 即为叶"语义在**根层**同样生效——设计意图是"技能目录是叶节点"，但没人阻止根层本身成为叶节点。
**How to avoid:** `createSkillsEnv` 的 `listDir` 在扫描根只返回目录（§Pattern 1）。**不要用事后过滤**——事后技能集变成空集，用户面对"技能全没了"却只看到一条 name-mismatch 警告。
**Warning signs:** 技能集突然从 N 个变成 1 个；设置页只剩一条名字等于 `skills` / `managed-skills` 的技能。

### Pitfall 2: 根层散落 `*.md` 变成 name = 目录名的幽灵技能

**What goes wrong:** 根层任何带 `description` frontmatter 的 `.md` 都被当技能加载，`name` 取**被扫描根目录的目录名**（`skills.js:123` 传入 `dirInfo.name`）。
**实测复现:** `skills/README.md` → 技能 `{name: 'skills', description: 'root stray file', filePath: '<root>/skills/README.md'}`。
**Why it happens:** `loadSkillsFromDirInternal(env, root, true, …)` 的 `includeRootFiles=true`（`skills.js:38`），且根层文件走 `loadSkillFromFile(env, fullPath, dirInfo.name)`——第三个参数是**目录**名而非文件所在文件夹名。
**How to avoid:** 同 Pitfall 1 的 `listDir` 收窄；任何被滤掉的 entry 进诊断（SKILL-06）。
**Warning signs:** `<available_skills>` 里出现叫 `skills` 或 `managed-skills` 的技能。

### Pitfall 3: 深嵌套技能（无上限递归）

**What goes wrong:** SDK 无条件递归（`skills.js:115-119`），只跳过 `.` 开头与 `node_modules`。GitHub 导入的包常见多一层目录。
**实测复现:** `skills/deep/nested/SKILL.md` → 加载为 `name: 'nested'`，`filePath: '<root>/skills/deep/nested/SKILL.md'`。
**Why it happens:** 无深度参数可传。
**How to avoid:** 加载后 `inContractLayout` 过滤（§Pattern 2）+ 丢弃诊断（说明正确布局）。
**Warning signs:** `<available_skills>` 里出现 path 层级超过 `skills/<name>/SKILL.md` 的条目。

### Pitfall 4: 诊断字段名错位（`level` vs `type`）

**What goes wrong:** 照 D-07 的措辞去读 SDK 诊断的 `d.level`，得到 `undefined` → 设置页显示空白严重度；或写 `{level: d.level, code: d.code}` 而丢掉 `type`。
**Why it happens:** `CONTEXT.md:43` 的 D-07 描述的是 **Realm 自建诊断**的形状（`level`/`code`/`message` + `limit`/`currentValue`），而 SDK 的是 `type`/`code`/`message`/`path`。两者只是**概念**相同，字段名不同。
**How to avoid:** 合并函数显式映射（见 §SDK 契约 C 的字段映射表），并用测试断言"SDK 诊断经合并后 `level === 'warning'`"。
**Warning signs:** 诊断条目缺 `level`；`undefined` 渲染到 UI。

### Pitfall 5: 超大 `SKILL.md` 被解析后才被丢弃（P7 硬要求违反）

**What goes wrong:** 先 `loadSkills` 再按大小过滤 —— SDK 已经 `readTextFile` 全量读入并 `parse()` 了那个畸形/超大 YAML（`skills.js:198-209`）。主进程同步解析一个 10MB 畸形 YAML 会明显卡顿甚至抛错。
**Why it happens:** `loadSkills` 内部完成"读 + 解析"，外部只能拿到结果或诊断。
**How to avoid:** `createSkillsEnv.readTextFile` 对 `SKILL.md` 先 `fileInfo` 判 `size`，超 `MAX_SKILL_MD_BYTES` 直接返回 `err(new FileError('invalid', …))`（不读盘、不解析）；SDK 会把它记成 `read_failed` 诊断并跳过该技能。文案含限额与当前值 → 天然满足 SKILL-07。
**Warning signs:** 首次切会话明显卡顿；`agent-workspace/skills/` 里出现 MB 级 `SKILL.md`。

### Pitfall 6: 目录未建 → 零诊断的空技能集

**What goes wrong:** `loadSkills` 对不存在的目录**静默 `continue`**（`skills.js:24-34` 只在 `error.code !== "not_found"` 时产诊断）。
**实测复现:** `loadSkills(env, <不存在目录>)` → `{"skills":0,"diags":0}`。
**Why it happens:** SDK 把"缺失目录"当作合法的空输入。
**How to avoid:** `ensureWorkspaceDir()` 加两行 `mkdirSync`（`agent-workspace.js:96-100`），且 `createSandboxEnv()` 内部已调 `ensureWorkspaceDir()`（`:180`）→ 只要 `sandboxEnv` 就绪，目录必然就绪。**额外**在 `refreshSkills` 里对每个根做一次 `env.exists()` 断言，缺失时产 `level:'error'` 诊断（不能指望 SDK 报）。
**Warning signs:** `<available_skills>` 缺失但磁盘上明明有技能。

### Pitfall 7: 定序不确定导致前缀缓存漂移

**What goes wrong:** 用 `localeCompare` 或依赖 SDK 的返回顺序拼 prompt → 顺序在不同环境下不同 → provider 前缀缓存命中率不可预测。
**How to avoid:** 显式全序比较器（§Pattern 4）。
**Warning signs:** 同样的技能集，重启后 `buildSystemPrompt().length` 或内容顺序变化。

---

## Code Examples

### 加载 + 去重 + 遮蔽（D-06 / D-08）

```js
// Source: skills.js:50-62 的返回形状（探针实测）+ types.d.ts:28-39 的 Skill 字段
const { loadSourcedSkills } = await import('@earendil-works/pi-agent-core');

const { skills: entries, diagnostics: sdkDiags } = await loadSourcedSkills(
  skillsEnv,
  [
    { path: managedDir, source: 'managed' },   // 先 managed
    { path: skillsDir,  source: 'user' },      // 后 user（同 name 时遮蔽前者）
  ]
);
// entries[i] === { skill: {name,description,content,filePath,disableModelInvocation?}, source }
// sdkDiags[i] === { type:'warning', code, message, path, source }

/** 合并 SDK 诊断为 D-07 形状（字段名映射是必需步骤 —— 见 Pitfall 4） */
const toRealmDiag = (d) => ({
  level: d.type === 'warning' ? 'warning' : 'error',
  code: d.code,
  message: d.message,
  path: d.path,
  source: d.source,
});

/** 为每条 entry 挂上它自己的诊断（按 path 归并 —— SDK 诊断带 path，可精确归属） */
const diagsByPath = new Map();
for (const d of sdkDiags) {
  const list = diagsByPath.get(d.path) || [];
  list.push(toRealmDiag(d));
  diagsByPath.set(d.path, list);
}

/** D-08：以目录名为权威重写 name —— 杜绝冒名（P3 前半） */
function enforceDirNameAuthority(skill) {
  const dirName = path.basename(path.dirname(skill.filePath));
  const own = diagsByPath.get(skill.filePath) || [];
  if (skill.name !== dirName) {
    own.push({
      level: 'warning',
      code: 'realm_name_rewritten',
      message: `frontmatter name "${skill.name}" 与目录名 "${dirName}" 不一致，已按目录名生效`,
    });
    skill.name = dirName;                          // 就地重写（skill 是本函数独占对象）
  }
  return own;
}
```

### 同名遮蔽（D-06）

```js
/** user > managed；败者保留并标 shadowed —— 不剔除（Phase 48/50 需要看到它） */
function applyShadowing(entries) {
  const winnerByLowerTier = new Map();             // name -> {source, filePath}
  const out = [];
  for (const e of entries) {                       // entries 已按 managed → user 排序
    const prev = winnerByLowerTier.get(e.skill.name);
    if (prev) {
      // 后到者（user 或同源）胜出，前者标为 shadowed
      const loser = out.find((x) => x.skill.name === e.skill.name && !x.shadowed);
      if (loser) {
        loser.shadowed = true;
        loser.shadowedBy = e.source;
        loser.diagnostics.push({
          level: 'warning',
          code: 'realm_shadowed',
          message: `同名技能被 ${e.source} 来源的 "${e.skill.name}" 遮蔽（${loser.skill.filePath}）`,
        });
      }
    }
    winnerByLowerTier.set(e.skill.name, e);
    out.push(e);
  }
  return out;
}
```

> **范围约束（D-06）：** `shadowed === true` 的条目**不进 prompt、不占预算、不参与 `/skill:` 解析**，但**保留在 `skills[]`**。任何"直接 filter 掉"的写法都会破坏 D-06 标注为 costly 的可逆性。

### D-10 预算截断（用 SDK 自身测量条目成本，不复制格式逻辑）

```js
// Source: system-prompt.js:1-21（格式无法外部复制 —— 用差值测量规避漂移）
const { formatSkillsForSystemPrompt } = await import('@earendil-works/pi-agent-core');

const dummy = { name: '', description: '', filePath: '' };
const fixedOverhead = formatSkillsForSystemPrompt([dummy]).length;   // 前言 3 行 + <available_skills> 包裹 + 空条目脚手架
const entryCost = (s) => formatSkillsForSystemPrompt([s]).length - fixedOverhead;

// 定序（§Pattern 4）后，按 D-10 顺序贪心纳入
const eligible = snapshot.skills
  .filter((e) => !e.shadowed && !e.disabled && e.disableModelInvocation !== true)
  .sort(bySkillPriority);

const kept = [];
let used = fixedOverhead;
for (const e of eligible) {
  const cost = entryCost(e.skill);
  if (used + cost > LIMITS.SKILLS_PROMPT_CHAR_BUDGET) break;
  used += cost;
  kept.push(e.skill);
}

let promptBlock = kept.length ? formatSkillsForSystemPrompt(kept) : '';
const omitted = eligible.length - kept.length;
if (omitted > 0) {
  // 追加在 </available_skills> 之外 —— 保留前缀与未截断时逐字节相同（前缀缓存友好）
  promptBlock += `\n\nNote: ${omitted} of ${eligible.length} skills omitted to stay within the prompt budget.`;
  snapshot.diagnostics.push({
    level: 'warning',
    code: 'realm_prompt_budget_exceeded',
    message: `prompt 段预算 ${LIMITS.SKILLS_PROMPT_CHAR_BUDGET} 字符，已省略 ${omitted} 个技能（共 ${eligible.length} 个）`,
    limit: LIMITS.SKILLS_PROMPT_CHAR_BUDGET,
    currentValue: used,
  });
}
```

**为什么用差量测量而非自己拼字符串：** 自己拼等于复制 `formatSkillsForSystemPrompt` 的转义与缩进（`system-prompt.js:13-18`），一旦 SDK 升级就漂移。差量法只依赖"格式是线性的、每条目脚手架固定"这一事实，SDK 升级自动跟随。

**`disableModelInvocation !== true` 的过滤已由 SDK 内部再做一次**（`system-prompt.js:2` `skills.filter((skill) => !skill.disableModelInvocation)`）—— Realm 侧先滤是为了**不消耗预算**（D-10 的优先级语义），SDK 侧那次是安全网，不冲突。

### 两处 Agent 创建点的接线（精确行号）

```js
// ============ ai-manager.js init() — 在 :808 之后、:821 之前插入 ============
this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();          // :808（不动）
// ★ 新增：构造 Agent 之前无条件重扫（D-04）。configStore 注入式读取，照 aiBashWhitelist 先例
await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
  disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
  rootDirs: [
    getAgentWorkspaceLazy().getManagedSkillsDir(),
    getAgentWorkspaceLazy().getSkillsDir(),
  ],
});
this.tools = this._buildRealmTools();                                        // :811（不动）
this.agent = new Agent({ initialState: { systemPrompt: buildSystemPrompt(), // :821-823
```

```js
// ============ ai-manager.js _recreateAgent() — 在 :2432 内、:2453 之前插入 ============
async _recreateAgent() {                                                     // :2432
  if (!this.models || !this.isInitialized) { … return; }
  try {
    const { Agent } = await import('@earendil-works/pi-agent-core');         // :2440
    // ★ 新增：与 init() 同一处调用（D-04 的兜底 —— 覆盖 bash/write 直改磁盘的第 6 条路径）
    await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, { … });
    this.agent = new Agent({ initialState: { systemPrompt: buildSystemPrompt(), … } }); // :2453-2455
```

`this.sandboxEnv` 在此可用：构造器 `:665` 置 null 后仅在 `init():808` 赋值一次，`_recreateAgent` 全程复用（全文件 `this.sandboxEnv` 仅 4 处引用：`:665` `:808` `:5445` `:5460`）。

### `syncAgentSystemPrompt()`（D-03 / SKILL-04）

```js
// Source: agent.js:155-157（get state 返回 _state）+ :280-286（每轮重读）；架构建议见 ARCHITECTURE.md:244-266
/**
 * 技能集变更后回写 system prompt（不重建 Agent —— 保留 state.messages 引用链）
 * 忙时置脏标记，idle 后重试；digest 未变不动（保 provider 前缀缓存）
 */
async syncAgentSystemPrompt() {
  if (!this.agent || !this.sandboxEnv) return;
  const snapshot = await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
    disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
  });
  if (this.isProcessing || (this.agent.state && this.agent.state.isStreaming)) {
    this._skillsPromptDirty = true;                       // idle 处理路径里补刷
    return;
  }
  const next = buildSystemPrompt();
  if (this.agent.state.systemPrompt === next) return;     // 无变化 → 不动（前缀缓存）
  this.agent.state.systemPrompt = next;
  windowManager.broadcast('skills:changed');
}
```

`[VERIFIED: ai-manager.js:25（windowManager 已 require）]`、`[VERIFIED: window-manager.js:310（function broadcast(channel, ...args)）]`

---

## Runtime State Inventory

**本阶段不是 rename / refactor / migration 阶段**，无既有字符串替换需求. 但**新增两个数据目录**，仍需回答"运行时系统里还有什么需要同步"：

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `agent-workspace/` 下已有 `.tmp/`、`attachments/`、`ai-memory/`（后者的迁移逻辑 `migrateAiMemory:108-119` 已一次性完成）。新增 `skills/` / `managed-skills/` 是**空目录**，无数据迁移。 | 无迁移。`ensureWorkspaceDir()` 加两行 `mkdirSync(..., {recursive:true})` 即可（幂等，对既有目录零影响） |
| Live service config | **None —— 已核验**：`grep ensureWorkspaceDir` 全仓仅 `main.js:4040` 与 `agent-workspace.js:180`（`createSandboxEnv` 内部）两处调用点，无 UI/数据库侧配置引用工作区目录清单 | 无 |
| OS-registered state | **None —— 已核验**：工作区路径 `app.getPath('userData')/agent-workspace` 不进入任何 OS 注册项（无 launchd / plist / 计划任务引用） | 无 |
| Secrets/env vars | **None**：本阶段不引入新环境变量、不改 `realm-config.json` 现有键结构。`settings.aiSkills.disabled` 是**新增键**（懒读取 + 默认 `[]`），不需要迁移 | 无 |
| Build artifacts | **None**：本阶段不新增随包资产（`skills-builtin/` 与 `asarUnpack` 属 Phase 47）、不新增原生模块 | 无 |

**迁移影响自检（对既有目录）：** `ensureWorkspaceDir()` 是 `mkdirSync(..., {recursive: true})` 幂等调用；新增两行不触碰 `.tmp/`、`attachments/`、`ai-memory/` 任何既有语义。测试 `tests/test-agent-workspace.js` 现有 21 例断言的是 `resolveInside` / 沙箱 / 迁移三块，新增两行 mkdir 不会让任何一例失败——但**应新增断言**"两目录存在"。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `allowed-tools` frontmatter 按技能授权 | 本 SDK **不存在该字段**（`types.d.ts:28-39` 无 `allowedTools`；探针实测 `Object.keys` 五项） | — | 任何 UI/文档展示它都是虚假安全感（P6）；本阶段及后续都不得暗示 |
| 技能正文预加载进 system prompt | 渐进式披露：prompt 只放 name/description/location，正文经 `read` 工具按需读取 | — | 这正是"技能目录必须落在硬沙箱内"的根因（`system-prompt.js:7` 指示模型去 read，路径受 `resolveInside` 约束） |
| 技能目录热重载（chokidar/watch） | 确定性 reload：**每次 Agent 重建无条件重扫**（D-04） | 本阶段 | 覆盖"bash/write 直改磁盘"这条无事件可挂的路径；零新依赖、零误报 |
| 技能名回落为父目录名（`name = frontmatterName \|\| parentDirName`） | 以**目录名为权威**重写（D-08） | 本阶段 | 杜绝 `skills/evil/SKILL.md` 声明 `name: find-skills` 的冒名（P3 前半，S1 门禁）；同时保证单目录内 name 唯一 → 遮蔽判定无歧义 |

**Deprecated/outdated:**
- **`.ignore` / `.gitignore` 作为根层加载收窄手段** —— 已实测证伪（`prefixIgnorePattern` 剥离前导 `/`，根锚定语义丢失）。不要尝试。
- **把 `yaml` / `ignore` 提升为直接依赖** —— 明确归 Phase 51（O5），本阶段只经 SDK 往返。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `formatSkillsForSystemPrompt` 对每个条目生成的脚手架长度是**固定的**，因此"差量测量条目成本"成立 | §Code Examples（D-10 截断） | 低。源码 `system-prompt.js:13-18` 是固定的 5 行模板，仅 name/description/filePath 内容变长；若 SDK 未来改为条件性字段，截断预算会略偏（保守方向：实际略小于预算，不会超） |
| A2 | Phase 46 里**没有真实的技能集变更触发点**（`manage_skill` 属 49、`/api/skills/*` 属 50、`/` 面板属 48），因此 P8 门禁在 46 只能闭合"两处创建点 + 每次重建兜底"这 3 条，其余 3 条随 48/49/50 落地 | §Open Question 4 | **中**。若计划声称"6 个触发点全覆盖"而无对应调用点，门禁验收会落空。见 Open Question 4 的可验证替代方案 |
| A3 | `settings.aiSkills.disabled` 走 `configStore.get('settings.aiSkills.disabled', [])`——键名与 `settings.aiBashWhitelist` 同级同风格 | §Pattern 3 / SKILL-08 | 低。既有键前缀惯例（`settings.aiBashWhitelist`、`ai.visionModel` 等）一致；D-09 已锁定键名 |
| A4 | 本阶段 DOC-01 交付"六节骨架 + 已落地内容 + O8/O3 占位"，不写后续阶段的能力 | §Phase Requirements / DOC-01 | 低。CONTEXT.md 明写交 plan 期决定（Claude's Discretion），两种粒度都合规 |
| A5 | `skills/` 与 `managed-skills/` 在 `ensureWorkspaceDir` 中建空目录后，SDK 不会因为"空目录"产任何诊断 | §Pitfall 6 | 低。源码 `skills.js:82-86` 对空 `listDir` 结果直接走完 for 循环返回空数组，无诊断 |
| A6 | 生产环境 `app.getPath('userData')` 下 `agent-workspace` 位于 APFS（大小写不敏感、NFC 归一化） | §Pitfall 1/2 | 低。仅影响未来 Phase 51 的 zip 大小写/Unicode 查重；本阶段不涉及 |

**如果本表为空：** 不适用 —— 有 6 条 `[ASSUMED]`，其中 A2 需要 plan 期与用户/验收方对齐（见 Open Question 4）。

---

## Open Questions (RESOLVED)

> **本次研究已闭环的九项 plan 级未知数**（原任务清单 1–9）全部回答于 §SDK Loader & Prompt API Contract 各小节（A: 签名；D: 递归语义与 `includeRootFiles`；B: `Skill` 字段表与 source 形状；E: `agent.state` 可写性含行号；F: 与沙箱 env 的关系 → **零适配**；C: 诊断形状；§Runtime State Inventory: 建目录与迁移影响；§Validation Architecture: 测试策略）。另加 §Wiring Points 给出两处创建点精确行号。**下列为研究过程中新暴露、必须由 plan 期拍板的问题。**

### 1. 禁用技能是否保留在 `skills[]` 内？（D-09 的"加载后过滤"语义边界）

- **RESOLVED:** 采用本节的 Recommendation —— 禁用技能**保留在 `skills[]` 内**并标 `disabled: true`，过滤只发生在 prompt 段组装与未来 `/skill:` 解析两处（落点 46-03 Task 3，`must_haves.truths` 与 `describe('启停状态（SKILL-08）')`）。

- **What we know:** D-06 明确遮蔽技能**保留在技能集内**（标 `shadowed`）；D-09 只说"加载后过滤、不删文件"，未说明数组语义。
- **What's unclear:** 若禁用技能被**移出** `skills[]`，Phase 50 的设置页就无法列出它来重新启用（列表来自 `skills[]`）——用户禁用后技能永久消失，只能手改配置文件。
- **Recommendation:** 与 D-06 对称——**保留在 `skills[]` 内并标 `disabled: true`**，过滤发生在 (a) prompt 段组装、(b) `/skill:` 解析两处。这样"禁用"与"遮蔽"两个状态在数据层同构，Phase 48/50 的渲染逻辑统一。若采用此方案，需在 `docs/product/ai-skills.md` 写清"禁用 ≠ 删除"。

### 2. 深度过滤丢弃项的诊断严重度

- **RESOLVED:** 采用本节的 Recommendation —— `level: 'warning'` + `code: 'realm_layout_violation'`，message 含实际的 `filePath` 与正确的目标路径建议，属 D-05 第 1 层「正常态跳过」（落点 46-02 Task 1）。

- **What we know:** §Pitfall 3 确认深嵌套会被加载（无深度上限）。D-05 第 1 层定义"单技能失败 = 正常态：诊断 + 跳过"。
- **What's unclear:** 深嵌套是"该技能不存在于契约布局"还是"存在但布局错误"？前者用 `warning`（正常态），后者可能该用更高严重度。
- **Recommendation:** `level: 'warning'`，`code: 'realm_layout_violation'`，message 含**实际的 `filePath`**与**正确的目标路径建议**（`skills/<dirname>/SKILL.md`）。理由：这是"正常态跳过"（D-05 第 1 层），不阻断其余技能。

### 3. `SKILLS_PROMPT_CHAR_BUDGET` 是否包含 SDK 前言 3 行？

- **RESOLVED:** 采用本节的 Recommendation —— **整段预算**（`fixedOverhead` 计入，理由：`getContextUsage()` 按 `buildSystemPrompt().length / 4` 估 token）（落点 46-03 Task 2 item 4：`fixedOverhead` / `entryCost` 差量测量 + 贪心填充）。

- **What we know:** D-11 锁定数值 8000；实测 SDK 前言 + `<available_skills>` 包裹 + 一条空条目脚手架约 400 字符（`formatSkillsForSystemPrompt([dummy]).length`，本次实测 `block chars` 量级在数百）。
- **What's unclear:** 8000 是"整段预算"还是"仅条目预算"。
- **Recommendation:** **整段预算**（`fixedOverhead` 计入），因为 `getContextUsage()`（`ai-manager.js:2588`）按 `buildSystemPrompt().length / 4` 估算 system token——整段限制才是对 token 占用的真实约束。差量法已天然支持这个语义（§Code Examples）。

### 4. P8 门禁在 Phase 46 的可验证形态（**最重要**）

- **RESOLVED:** 采用本节的 Recommendation —— **可断言双轨验收**：① 机制断言（导出面 + 「每个 `new Agent(` 前 60 行内存在 `refreshSkills(`」的**覆盖**扫描 + 改磁盘→重扫→`buildSkillsPrompt()` 反映新集合的行为测试）；② 门禁映射表写进 PLAN.md 并逐点交接 48/49/50/51。落点 46-04 Task 2 与本计划文件的 `<p8_gate_mapping>`；扫描断言的口径是**创建点覆盖**，不是 `refreshSkills(` 与 `new Agent(` 的调用次数相等。

- **What we know:** ROADMAP 把 P8 定为 Phase 46 的**阻断门禁**，列出 6 个触发点。但 Phase 46 的范围内只有 2 个真实存在（两处 Agent 创建点）+ 1 条兜底（每次重建重扫，覆盖第 6 条 bash/write 直改）。`/` 面板（48）、设置页导入/卸载（50）、`manage_skill` 三动作（49）**在本阶段尚不存在**。
- **What's unclear:** 门禁验收应断言"6 条路径都通"还是"机制就位且已覆盖可触发的路径"。
- **Recommendation:** 采用**可断言的双轨验收**，避免门禁落空：
  1. **机制断言（本阶段自动化）** —— ① `ai-skills-manager` 导出 `refreshSkills` / `buildSkillsPrompt` / `getSkillsSnapshot`；② 结构化测试断言 `ai-manager.js` 每一个 `new Agent(` 出现点之前都有一处 `refreshSkills` 调用（源码扫描，漏一处即失败——这是 P8 唯一可自动化捕捉"漏接线"的手段）；③ 行为测试：改磁盘 → `refreshSkills` → `buildSkillsPrompt()` 反映新集合。
  2. **门禁映射表（写进 PLAN.md）** —— 逐条列出 6 个触发点、各自在哪一阶段落地、本阶段覆盖到哪一条。把"48/49/50 必须调用 `syncAgentSystemPrompt()`"写成后续阶段的显式交付项，而不是让门禁在 46 空转。
  - 若用户/验收方要求 46 就"全覆盖"，则需把 `/api/skills/*` 的**最小空壳**（仅 uninstall 或仅 refresh 端点）提前到 46——这会越出 CONTEXT.md 的 scope boundary，需显式确认。

### 5. `MAX_USER_SKILLS` 超限时的行为（D-11 只锁了数值）

- **RESOLVED:** 采用本节的 Recommendation —— 实现为**加载期诊断而非拒绝**：按 D-10 优先序排序后前 50 个可注入，其余标 `overLimit: true` 并产 `level:'error'` 诊断（含 `limit` + `currentValue`），数据层**不剔除、不删文件**（落点 46-03 Task 2 item 3）。

- **What we know:** D-11 锁定 `MAX_USER_SKILLS = 50`；P7/O11 要求"到顶时给出可操作提示（先卸载）"。
- **What's unclear:** 本阶段无导入路径（Phase 51），"超限"如何触发？用户手动往 `skills/` 拷第 51 个目录是唯一途径。
- **Recommendation:** 本阶段实现为**加载期诊断**而非拒绝：超过 50 个 user 技能时，保留按 D-10 优先序排序后的前 50 个进 prompt，其余标 `overLimit: true` 并产 `level:'error'` 诊断（含 `limit` + `currentValue`），数据层**不剔除**（照 D-06 的保留哲学）。落入 Phase 51 的导入拒绝提示复用同一诊断。**不删除任何文件**（SKILL-08 的"不删文件"精神）。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 运行 / 测试 | ✓ | `v22.22.0` | — （SDK 要求 ≥22.19.0，已满足） |
| Electron | 主进程运行时 | ✓ | `43.6.0` | — |
| `@earendil-works/pi-agent-core` | 全部技能原语 | ✓ | `0.84.3`（`package.json` `^0.84.3`） | — |
| `node:test` / `node:assert` | 单元测试 | ✓ | Node 内置 | — |
| 网络 | 本阶段**不需要**（无导入、无下载） | — | — | — |
| zip 解包库 | **本阶段不需要**（Phase 51） | ✗（有意） | — | — |
| `yaml` / `ignore` | SDK 内部使用 | ✓（传递依赖，**不得直接 require**） | `2.9.0` / `7.0.5` | — |

**Missing dependencies with no fallback:** 无 —— 本阶段零新增依赖，全部能力已就位。

**Missing dependencies with fallback:** 无。

---

## Validation Architecture

> `workflow.nyquist_validation: true`（`.planning/config.json` 实读确认），本节必填。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert`（Node 内置，无框架依赖） |
| Config file | none —— 单文件脚本式，照 `tests/test-agent-workspace.js` / `tests/test-ai-bash-policy.js` |
| Quick run command | `node tests/test-ai-skills.js` |
| Full suite command | `node tests/test-ai-skills.js && node tests/test-agent-workspace.js && node tests/test-ai-bash-policy.js && node tests/test-ai-conversations.js` |

**脚手架（照抄 `tests/test-agent-workspace.js:21-32`）：**

```js
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skills-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
  });
  workspace.setWorkspaceDir(dir);
  aiMemoryManager.setBaseDir(dir);
  return dir;
}
```

**纯 Node 可测性（本次实测确认，这是本阶段测试设计的关键前提）：**
- `require('../agent-workspace')` ✓（electron 惰性 require）
- `require('../ai-memory-manager')` ✓
- `require('../ai-manager')` ✓ **可加载**（`require('electron')` 在纯 Node 下返回路径字符串，顶层 `const { webContents, BrowserWindow } = require('electron')` 解构出不抛错；`better-sqlite3` 在纯 Node 下可加载）
- `agentWorkspace.setWorkspaceDir(tmp)` + `aiMemoryManager.setBaseDir(tmp)` 后，`buildWorkspacePrompt()` 与 `buildGlobalSnapshot()` 均可在纯 Node 下执行（实测：`buildGlobalSnapshot()` 返回 958 字符，`getWorkspaceDir()` 命中覆写）
- ⚠️ `ai-manager.js` 目前**未导出** `buildSystemPrompt`（实测 `typeof === 'undefined'`）。要在单测里断言"技能段确实进了 system prompt"，需按既有先例（`ai-manager.js:5649-5651` 已导出 `executeScript` / `sanitizeInput` / `validateScriptForSteps`）追加一行 `module.exports.buildSystemPrompt = buildSystemPrompt;`。

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKILL-01 | `ensureWorkspaceDir()` 后 `skills/` 与 `managed-skills/` 均存在；`resolveInside(root, <两目录内路径>)` 返回非 null | unit | `node tests/test-ai-skills.js` | ❌ Wave 0 |
| SKILL-01 | 沙箱内 `read` 任意 `SKILL.md` 成功（`createSandboxEnv().readTextFile(<skill path>)` → `ok:true`） | unit | 同上 | ❌ Wave 0 |
| SKILL-02 | 空技能集 → `buildSystemPrompt()` 不含 `<available_skills>`，且**不含多余空行**（`!s.includes('available_skills')`） | unit | 同上 | ❌ Wave 0 |
| SKILL-02 | 有技能 → 含 `<available_skills>`、`<name>`、`<description>`、`<location>` | unit | 同上 | ❌ Wave 0 |
| SKILL-03 | `refreshSkills` 完成后 `buildSkillsPrompt()` 同步返回非空（零 IO 路径：调用前后不产生 fs 访问） | unit | 同上 | ❌ Wave 0 |
| SKILL-03 | **结构化断言**：`ai-manager.js` 每个 `new Agent(` 之前 N 行内存在 `refreshSkills` | unit（源码扫描） | 同上 | ❌ Wave 0 |
| SKILL-04 | `agent.state.systemPrompt` 改写后下一轮 `createContextSnapshot().systemPrompt` 反映新值（SDK 行为验证，可不依赖 Agent 实例：直接断言 `agent.js` 源码契约 + 用最小 stub） | unit | 同上 | ❌ Wave 0 |
| SKILL-05 | user/managed 同名 → user 进 prompt、managed `shadowed===true` 且 `shadowedBy==='user'`、**仍在 `skills[]` 中** | unit | 同上 | ❌ Wave 0 |
| SKILL-05 | prompt 段中同名条目**只有一条**（SDK 不去重，Realm 必须去重） | unit | 同上 | ❌ Wave 0 |
| SKILL-06 | 非法 name / 超长 description / YAML 解析失败 → `skills[]` 不含该技能 **且** `diagnostics` 含对应 `code` | unit | 同上 | ❌ Wave 0 |
| SKILL-06 | D-08：`name` 与目录名不一致 → `skill.name === dirname` + 一条 `realm_name_rewritten` 诊断 | unit | 同上 | ❌ Wave 0 |
| SKILL-07 | `SKILL.md` 超 `MAX_SKILL_MD_BYTES` → 技能被跳过 + 诊断含 `limit` 与 `currentValue`（**且文件未被 YAML 解析**） | unit | 同上 | ❌ Wave 0 |
| SKILL-07 | prompt 段超预算 → 保留条数 = 预算内最大；段尾含省略提示；诊断含 `limit`/`currentValue` | unit | 同上 | ❌ Wave 0 |
| SKILL-08 | `disabled: ['alpha']` → `alpha` 不进 prompt，**但仍在 `skills[]` 中**（标 `disabled`）；磁盘文件未被删 | unit | 同上 | ❌ Wave 0 |
| — | **反幽灵**：根层 `README.md` → **不产生** `name === 'skills'` 的技能 | unit（回归守卫） | 同上 | ❌ Wave 0 |
| — | **反黑屏**：根层 `SKILL.md` 存在时，`skills/<name>/SKILL.md` **仍被加载**（Pitfall 1 回归守卫） | unit（回归守卫） | 同上 | ❌ Wave 0 |
| — | **反深嵌套**：`skills/a/b/SKILL.md` → 被跳过 + 诊断 | unit（回归守卫） | 同上 | ❌ Wave 0 |
| — | **依赖纪律**：`ai-skills-manager.js` / `ai-manager.js` 源码不含 `require('yaml')` / `require('ignore')`（P11/O5） | unit（源码扫描） | 同上 | ❌ Wave 0 |
| DOC-01 | `docs/product/ai-skills.md` 存在且含六节标题 | smoke | `node -e "…"` 或人工 | ❌ Wave 0 |

**Manual-only（有正当理由）：**
- **"模型能仅凭 description 自动匹配技能并调用 `read`"** —— 需要真实 LLM 往返。自动化成本高且不确定（模型可能对简单任务故意不触发技能，FEATURES.md 已记录该现象）。**建议**：在 UAT 用一次真实对话验证（"你有哪些技能" → 应答出 name/description；再问一个命中 description 的任务 → 观察是否调 `read`）。
- **多窗口广播到达其他窗口** —— 本阶段无消费方（48/50）。自动化断言 `windowManager.broadcast` 被以 `'skills:changed'` 调用即可（stub 后断言调用参数）。

### Sampling Rate

- **Per task commit:** `node tests/test-ai-skills.js`
- **Per wave merge:** `node tests/test-ai-skills.js && node tests/test-agent-workspace.js && node tests/test-ai-bash-policy.js && node tests/test-ai-conversations.js`
- **Phase gate:** 上述全绿 + `npm run dev` 手验（技能目录出现、问 AI"你有哪些技能"、手改 SKILL.md 后切会话生效）+ UAT 真实对话验证自动匹配

### Wave 0 Gaps

- [ ] `tests/test-ai-skills.js` —— 新建，覆盖上表全部自动化断言（预计 30+ 例，照 `test-agent-workspace.js` 结构分 `describe`）
- [ ] `ai-manager.js` —— 追加 `module.exports.buildSystemPrompt = buildSystemPrompt;`（照 `:5649-5651` 先例）以支持"技能段确实进 prompt"的断言
- [ ] `docs/product/ai-skills.md` —— 六节骨架（DOC-01）
- [ ] 框架安装：**无**（`node:test` 内置）

---

## Security Domain

> `workflow.security_enforcement: true`、`security_asvs_level: 1`、`security_block_on: high`（`.planning/config.json` 实读确认）。本阶段承载 **P8（S2，阻断门禁）** 与 **P3 前半（S1）**。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本阶段无认证面（无 HTTP 端点、无 IPC 通道） |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | 技能目录读写受 `createSandboxEnv` 的 `resolveInside` 硬沙箱约束；本阶段**零改动**（已实测） |
| V5 Input Validation | **yes** | 技能元数据的校验权威是 SDK `validateName` / `validateDescription`（`skills.js:237-261`），Realm 只在其上叠加 D-08 的目录名权威重写与 D-11 限额 |
| V6 Cryptography | **no** | 本阶段不涉及加密（无导入、无凭据） |
| V7 Error Handling & Logging | **yes** | SKILL-06 / D-05 / D-07：禁止静默失败。SDK 的失效面**全部是 warning**（`skills.js` 无 throw），必须透传 |

### Known Threat Patterns for pi-agent-core Skills + Electron 主进程

| Pattern | STRIDE | Standard Mitigation | 本阶段状态 |
|---------|--------|-------------------|-----------|
| **间接提示注入经技能 `description`**（P3a，S1）——`formatSkillsForSystemPrompt` 把**每条非 disable 技能的 description** 无条件拼进**每次请求**的 system prompt，`escapeXml` 只做字符转义不做内容审查（`system-prompt.js:22-29`）；注入面**远大于** body（body 只在激活时进对话） | Tampering | 导入/写入侧的 description 扫描属 Phase 51；**本阶段的可控防线是让用户能看到技能集全貌**（`<available_skills>` 内容 + 诊断透传） | ⚠️ 本阶段无法根治（无写入路径）。**须在 `docs/product/ai-skills.md` 的"安全边界"节如实写明**：技能的 description 会进入每次请求的 system prompt，因此**不要导入来源不明的技能** |
| **技能名冒名顶替**（P3b，S1）——`validateName` 只产 warning 不拒绝，`name = frontmatterName \|\| parentDirName`（`skills.js:219,237-251`）；实测已复现 `skills/evil/SKILL.md` 声明 `name: seed` 合法通过 | Spoofing | **D-08：以目录名为权威重写 `skill.name`** + 诊断。本阶段实现，两侧收益：杜绝冒名 + 保证单目录内 name 唯一（遮蔽判定无歧义） | ✅ **本阶段闭合（P3 前半）**。写入侧二次校验归 Phase 49（P3 后半） |
| **技能缓存失效链断裂**（P8，S2，**阻断门禁**）——磁盘与内存快照分叉：装了不生效 / 卸了仍被描述 / 手改无变化 / 多窗口列表不一致 | Tampering / Repudiation | ① 权威收敛到 `ai-skills-manager` 单模块；② 两处 Agent 创建点前**无条件 `await refreshSkills`**；③ `_recreateAgent` 作为兜底自动覆盖"bash/write 直改磁盘"这条无事件路径 | ⚠️ **部分闭合** —— 见 Open Question 4（本阶段只有 2 个真实触发点 + 1 条兜底；48/49/50 各阶段补各自触发点） |
| **`resolveInside` 的 ENOENT 词法校验缺口**（P2，S1）——`agent-workspace.js:155-165` 对尚不存在的路径只做词法校验 | Tampering / Elevation | **本阶段不涉及**（无写入路径）。Phase 51 导入管线的门禁 | ⛔ Out of scope（Phase 51） |
| **沙箱无法区分 `skills/` 与 `managed-skills/`**——`createSandboxEnv` 只有一个 root，模型可以直接 `write managed-skills/x/SKILL.md` | Elevation | 「AI 不可删改内置技能」是**工具层不变式，不是沙箱不变式**（Phase 49 的 `manage_skill` 按播种登记表判定） | ⚠️ **须在 `docs/product/ai-skills.md` 与 `ai-agent-workspace.md` 如实写明**（与 `ai-bash-policy` 的"白名单判定是启发式而非安全边界"同款哲学）。**不要**试图用只读挂载或第二 root 表达它（会引入第二套路径判据） |
| `SKILL.md` 畸形 YAML / 超大正文导致主进程 DoS | Denial of Service | `MAX_SKILL_MD_BYTES` **在 SDK 解析前**经 `createSkillsEnv.readTextFile` 拦截（§Pitfall 5） | ✅ 本阶段闭合（限额 3/3 之一） |
| 技能数量膨胀导致每请求 prompt 膨胀 | Denial of Service（成本/延迟） | `MAX_USER_SKILLS` + `SKILLS_PROMPT_CHAR_BUDGET` + D-10 优先序截断 + 省略提示 | ✅ 本阶段闭合（限额 3/3 之二三） |

**Security gate 与 verification_protocol 检查：**
- ✅ 安全域已包含（`security_enforcement: true`）
- ✅ ASVS 类别已按本阶段技术栈逐项核对（V4 / V5 / V7 适用）
- ✅ 阻断门禁 P8 归属明确；其"部分闭合"的诚实边界写入 Open Question 4
- ✅ 不涉及 rename/refactor —— Runtime State Inventory 已按"新增目录"口径逐类回答（无空白项）

---

## Sources

### Primary（HIGH —— 本会话直接读取源码 / 本会话本地实测）

**SDK 源码（`node_modules/@earendil-works/pi-agent-core@0.84.3`）— 全文或指定区段直读**
- `dist/harness/skills.js` — `:8-11` `formatSkillInvocation` 模板；`:19-43` `loadSkills`（`:38` 根层硬编码 `includeRootFiles=true`；`:24-34` 缺失目录静默跳过）；`:50-62` `loadSourcedSkills`（`:56` `{skill, source}` 包装；`:58-59` 诊断追加 `source`）；`:63-129` 递归遍历（`:88-103` **根层 `SKILL.md` 短路 `return`**；`:104-106` `localeCompare` 排序 + 跳过点目录/node_modules；`:115-119` 无上限递归；`:121-126` 根层散落 `.md`）；`:130-191` ignore 文件处理（`:187-188` **剥离前导 `/`** —— `.ignore` 证伪根因）；`:192-236` `loadSkillFromFile`（`:219` `name = frontmatterName || parentDirName`；`:232` `disableModelInvocation` 精确拼写；`:237-251` `validateName` 仅 warning；`:252-261` `validateDescription`）
- `dist/harness/skills.d.ts` — 全文：`SkillDiagnosticCode` 5 枚举值、`SkillDiagnostic`（**`type` 非 `level`**）、`loadSkills` / `loadSourcedSkills` 精确签名
- `dist/harness/system-prompt.js` — 全文 29 行：`:2` `disableModelInvocation` 过滤、`:3-4` 空态返回 `""`、`:13-18` 固定 5 行条目模板、`:22-29` `escapeXml` 五项替换
- `dist/harness/types.d.ts` — `:28-39` `Skill` 接口（**五项，含 `filePath` 非 `location`，无 `allowedTools`**）；`:145-196` `FileSystem` 契约；`:226-227` `ExecutionEnv`
- `dist/agent.js` — `:27-30` `createMutableAgentState`（`systemPrompt` 为普通属性）；`:150-157` `get state()` 返回 `_state`；`:272,:277` 两处 `createContextSnapshot()` 调用；`:280-286` 快照每轮重读
- `package.json` — `version: 0.84.3`；`exports` map 仅 4 入口（`.` / `./node` / `./session/testing` / `./package.json`），**无 `./harness/skills` 子路径**
- `dist/index.js:15-16` — `export * from "./harness/skills.js"` / `"./harness/system-prompt.js"`（四个函数从包根可达）

**本仓源码 — 指定区段直读**
- `agent-workspace.js` — `:36-40` `getWorkspaceDir`（electron 惰性 require）；`:89-91` `getAttachmentsDir`（新访问器模板）；`:96-100` `ensureWorkspaceDir`（**扩展点**，当前 3 行 mkdir）；`:108-119` `migrateAiMemory`（幂等先例）；`:136-166` `resolveInside`（`:155-165` ENOENT 分支词法校验）；`:179-350` `createSandboxEnv`（`:180` 内部调 `ensureWorkspaceDir`；`:207-349` **17 个 FileSystem 方法显式转发**）；`:352-363` 模块导出面
- `ai-manager.js` — `:21` 顶层 `require('electron')` 解构；`:94-100` `getAiMemoryManagerLazy`；`:106-110` `getAgentWorkspaceLazy`（新 lazylazy helper 模板）；`:536-549` `buildWorkspacePrompt`；`:552-564` `buildSystemPrompt`（**第 4 段插入点** + G-42-4 同步契约注释）；`:649,:687` `this.configStore` 生命周期；`:665` `this.sandboxEnv = null`；`:808` `createSandboxEnv()`；`:811` `this.tools`；`:821-835` `new Agent`；`:942,:1051,:2025,:2116` `_recreateAgent()` 调用点；`:2432-2473` `_recreateAgent`（`:2453-2455` 第二处 `new Agent`）；`:2588` `getContextUsage` 用 `buildSystemPrompt().length / 4`；`:5445` `{ env: this.sandboxEnv }`；`:5511-5513` `configStore.get('settings.aiBashWhitelist', [])` **注入式读取先例**；`:5648-5651` `module.exports` 追加式导出先例
- `ai-memory-manager.js` — `:19` `const BUDGETS = { user: 1375, global: 2200, container: 2200 };`（常量单源先例）；`:102-107` `getBaseDir` 惰性 electron；`:113-115` `setBaseDir`；`:365-403` `buildGlobalSnapshot`（同步冻结快照先例 + `:359-361` G-42-4 事故注释）
- `ai-bash-policy.js` — `:253-263` 模块导出面（纯函数引擎，config 值由调用方注入）
- `window-manager.js` — `:310` `function broadcast(channel, ...args)`；`:410` 导出
- `main.js` — `:4037-4041` 启动序列（`agentWorkspace.ensureWorkspaceDir()` + `migrateAiMemory()`，注释明确"必须在 aiManager 创建之前"）
- `tests/test-agent-workspace.js` — `:15-32` `withTempRoot` 脚手架（`setWorkspaceDir` / `setLegacyAiMemoryDir` / `setBaseDir` 三覆写 + `t.after` 清理）；共 227 行 / 21 例
- `tests/test-ai-bash-policy.js` — `:1-9` 文件头风格（node:test、纯 Node、`用法: node tests/…`）
- `package.json` — dependencies / devDependencies / scripts 全量（确认**无 zip 解包库**、无测试框架）；`build` 配置
- `.planning/config.json` — `workflow.nyquist_validation: true`、`security_enforcement: true`、`security_asvs_level: 1`、`security_block_on: high`

**本会话本地可执行实测（探针，脚本位于仓库内临时文件以解析 node_modules，运行后已删除）**
- 探针 1（SDK 契约 + 沙箱 env 兼容性）：四个函数 `typeof function` 确认从包根可达；`loadSkills(env, <string>)` 单字符串入参可用；缺失目录 → `{"skills":0,"diags":0}`；**真实沙箱 env 直接可用**；`loadSourcedSkills` 元素形状 `{skill, source}`；诊断形状 `{type,code,message,path,source}`；四类诊断原文（`parse_failed` / `invalid_metadata` ×3）；`Object.keys(skill)` 五项；同名不去重（`good` ×2、`seed` ×2）；`formatSkillsForSystemPrompt([]) === ""`；根层 `README.md` → 技能名 `skills`；`skills/deep/nested/SKILL.md` 被加载；`skills/evil/SKILL.md` 带 `name: seed` 合法通过
- 探针 2（黑屏 + symlink + 深度过滤）：**根层 `SKILL.md` 使 `['alpha']` → `['rooty']`，仅 1 条诊断**；指向工作区外的 symlink 目录 → 沙箱 `file_info_failed` 诊断且技能未加载（**未逃逸**）；`path.relative(dir, file).split(sep).length === 2` 过滤实测保留 `alpha`
- 探针 3（`.ignore` 变通证伪）：无 `.ignore` → `alpha,skills`；`.ignore = "/*.md"` → **`(none)`**；`.ignore = "README.md"` → `alpha`；`.gitignore = "/*.md"` → **`(none)`**
- 环境实测：`node v22.22.0`、`npm 10.9.4`、`electron 43.6.0`、`ignore 7.0.5`、`yaml 2.9.0`
- 纯 Node 可测性实测：`require('./ai-manager')` **可加载**（electron 解构不抛、better-sqlite3 可加载）；`typeof require('./ai-manager').buildSystemPrompt === 'undefined'`（**当前未导出**）；`setWorkspaceDir` + `setBaseDir` 后 `buildGlobalSnapshot()` 返回 958 字符

**项目文档（本会话直读）**
- `.planning/phases/46-prompt/46-CONTEXT.md` — D-01..D-11、Claude's Discretion、Deferred、canonical_refs、code_context
- `.planning/REQUIREMENTS.md` — SKILL-01..09 / DOC-01 原文与 traceability（Phase 46 ← SKILL-01..08 + DOC-01；SKILL-09 → 47）
- `.planning/ROADMAP.md` — `:153-166` Phase 46 Goal / Success Criteria 5 条 / Security gate P8 / Doc sync
- `.planning/STATE.md` — `:172-190` Blockers/Concerns（O1/O2/O3/O4/O5/O7/O8/O9 + v2.6 待实测风险）
- `.planning/research/SUMMARY.md` — 架构接线点、P8 失效链 6 路径、O1–O11、Confidence 表
- `.planning/research/ARCHITECTURE.md` — `:180-276` (b) prompt 接线与缓存失效（接线代码形态、`agent.state` 三处证据链、Anti-Pattern 1-5）；`:103-172` (a) 目录与沙箱边界、加载语义硬约束表
- `.planning/research/PITFALLS.md` — `:291-321` P7 资源耗尽；`:322-362` P8 缓存失效链；`:449-466` P12 静默失败；`:532-566` "Looks Done But Isn't" 检查表 + Recovery Strategies
- `AGENTS.md` — §AI 工作区与 Bash 权限（沙箱/工具适配/维护约定）、§内部页面 CSP、§开发-正式环境差异 → 发布前必查、§弹框居中约定

### Secondary（MEDIUM —— 上游既有研究，本会话未重新验证）

- `.planning/research/STACK.md` / `FEATURES.md` — SDK API 形态综述、技能能力边界与 Anti-Features、许可证与 zip 库选型（Phase 47/51 使用；本次已用源码直读校正其中与 SDK 字段名相关的部分）

### Tertiary（LOW）

- 无 —— 本阶段不需要任何 web 搜索、npm registry 查询或网络请求。

---

## Metadata

**Confidence breakdown:**
- **Standard Stack: HIGH** — 版本号全部本地实读（SDK `package.json` / `node --version` / `electron/package.json`）；零新增依赖由 `package.json` 直读确认
- **SDK API 契约: HIGH** — 每一条结论都有"源码行号 + 探针实测"双证据。九项 plan 级未知数全部闭环，含三处 `CONTEXT.md` 字段名勘误（`filePath` / `type` / `{skill, source}`）
- **Architecture（接线点）: HIGH** — 两处 Agent 创建点、`buildSystemPrompt`、`ensureWorkspaceDir`、`buildGlobalSnapshot`、`broadcast` 全部行号直读；`agent.state` 可写性由 `agent.js` 三处交叉确证
- **Pitfalls: HIGH** — 本阶段 7 条 pitfall 全部经源码直读或本机实测确证，其中 3 条（根层黑屏、幽灵技能、`.ignore` 证伪）是**本次研究新发现/新证伪**，未见于既有研究文档
- **Validation: HIGH** — 可测性经本机 `require` 实测确认；测试脚手架有同构先例（`test-agent-workspace.js`）；`buildSystemPrompt` 需补导出这一前提已实测确认
- **Security: MEDIUM-HIGH** — ASVS 类别映射与威胁表基于源码事实；P8 的"部分闭合"边界如实标注（Open Question 4），未夸大门禁覆盖率
- **整体: HIGH**

**三处必须回写到计划的勘误（`CONTEXT.md` → 真实 SDK）：**

| CONTEXT.md 位置 | 原文 | 真实 |
|----------------|------|------|
| `:44`（D-08 理由）、`:93`（源码锚点） | `dirname(skill.location)` | `path.dirname(skill.filePath)` —— `Skill` **没有** `location` 字段；`<location>` 只是 XML 标签名 |
| `:43`（D-07） | 诊断"每条含 `level` / `code` / `message`" | SDK 诊断是 `{type: "warning", code, message, path}`。`level` 是 **Realm 自建诊断**的字段名，合并时需显式映射（§SDK 契约 C） |
| `<canonical_refs>` SDK 段 | 未提及 `loadSourcedSkills` 的返回包装 | 返回 `{skills: [{skill, source}], diagnostics: [{…, source}]}` —— `source` **不在** `Skill` 内 |

**Research date:** 2026-09-11
**Valid until:** 2026-10-11（30 天）。**但有一条更早的失效条件：** 一旦 `@earendil-works/pi-agent-core` 从 `0.84.3` 升版，§SDK Loader & Prompt API Contract 全部小节需重新核对（`loadSkills` 的递归语义、`includeRootFiles` 硬编码、诊断字段名都是可以直接被上游改掉的实现细节）。建议在 `ai-skills-manager.js` 顶部注释里记下本次核对的版本号。

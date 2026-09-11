---
phase: 46-prompt
verified: 2026-09-11T02:35:54Z
status: human_needed
score: 14/15 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/46-prompt/46-01-PLAN.md"
  - ".planning/phases/46-prompt/46-01-SUMMARY.md"
  - ".planning/phases/46-prompt/46-02-PLAN.md"
  - ".planning/phases/46-prompt/46-02-SUMMARY.md"
  - ".planning/phases/46-prompt/46-03-PLAN.md"
  - ".planning/phases/46-prompt/46-03-SUMMARY.md"
  - ".planning/phases/46-prompt/46-04-PLAN.md"
  - ".planning/phases/46-prompt/46-04-SUMMARY.md"
  - ".planning/phases/46-prompt/46-CONTEXT.md"
  - ".planning/phases/46-prompt/46-REVIEW.md"
  - ".planning/phases/46-prompt/46-VALIDATION.md"
  - "agent-workspace.js"
  - "ai-manager.js"
  - "ai-skills-manager.js"
  - "docs/product/ai-skills.md"
  - "tests/test-ai-skills.js"
covered_digest: "v1:sha256:16d471b2ecc61bdf8b232596f5484a51420615f85e26ffaec81ec34da33dd7d0"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "SKILL-04 / ROADMAP SC3 —— 「技能集变更后无需重建 Agent，下一条消息即按新技能集生效，且变更经广播同步到其他窗口」"
    test: "触发一次技能集变更（Phase 49/50/51 落地写路径后，或在主进程直接调用 `aiManager.syncAgentSystemPrompt()`），随后在同一对话里发下一条消息，并观察另一窗口是否收到 `skills:changed`"
    expected: "下一条消息的请求使用新技能段（`agent.state.systemPrompt` 已被原地改写，Agent 实例未重建、`state.messages` 引用链未断）；另一窗口收到 `skills:changed`"
    why_human: "方法体本身已被行为断言覆盖（duck-typed `this` + stub `windowManager.broadcast`），但 `_skillsPromptDirty` 没有任何生产写入方 —— 全仓库唯一调用 `syncAgentSystemPrompt()` 的位置是它自己的 `if (this._skillsPromptDirty)` 守卫块（`ai-manager.js:1264`），构成自环。因此该行为在真实应用中不可达，存在性检查/Grep 均看不到这一点，只有端到端触发才能判定"
human_verification:
  - test: "SKILL-04 / SC3 端到端：改技能集 → 下一条消息生效 + 跨窗口广播（见 behavior_unverified_items 第 1 条；需先有写路径或手工调用 syncAgentSystemPrompt()）"
    expected: "同一对话的下一条消息即使用新技能段；另一窗口收到 skills:changed"
    why_human: "本阶段无技能集变更生产者（写路径属 49/50/51），可达性与多窗口投递无法在纯 Node 下自动断言"
  - test: "模型仅凭 description 自动匹配技能并经 `read` 打开 `<location>`（SKILL-02 / DISC-05 前置）：npm run dev → 问 AI「你有哪些技能」→ 再给一个命中某技能 description 的任务"
    expected: "AI 应答出技能的 name / description；命中任务时调用 `read` 打开 `<location>` 指向的 SKILL.md"
    why_human: "需真实 LLM 往返；模型对简单任务可能「故意不触发技能」，自动断言不确定（46-VALIDATION.md Manual-Only 第 1 行）"
  - test: "P8 第 6 条路径（bash/write 直改磁盘）的手工复核：npm run dev → 直接编辑 agent-workspace/skills/<x>/SKILL.md → 切换对话 → 发下一条消息"
    expected: "新技能集反映改动（经 `_recreateAgent()` 的重扫兜底）"
    why_human: "端到端需真实 Agent 重建。**注意**：该步骤走的是「切换对话触发重建」路径，不是 SKILL-04 的不重建热更新路径 —— 不得把它读作热更新已验证的证据（REVIEW WR-02）"
---

# Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入） Verification Report

**Phase Goal:** AI 助手每次请求都能看到位于硬沙箱内、可被 `read` 工具读取的技能清单；技能集变更即时生效，同名冲突与加载诊断不静默。
**Verified:** 2026-09-11T02:35:54Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Verification Method

初始验证（阶段目录下无既有 `*-VERIFICATION.md`，无 `gaps:` 可复用）。must-haves 由 **ROADMAP §Phase 46 的 5 条 Success Criteria**（roadmap contract，不可被 plan 削减）与 4 份 PLAN frontmatter 的 `truths` / `artifacts` / `key_links` / `prohibitions` 合并去重而成。所有断言均对**代码本体**核对，SUMMARY/REVIEW 的叙述只作对照，不作证据。

除跑通阶段自带的全部自动化门禁外，另写了 2 个**独立探针**（不引用 `tests/test-ai-skills.js`）直接驱动 `agent-workspace` / `ai-skills-manager` / `ai-manager` 的真实代码路径，结果见 Behaviors Spot-Checks。

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | 应用启动后 `agent-workspace/skills/` 与 `managed-skills/` 自动存在，且两目录由 `getWorkspaceDir()` 派生、位于硬沙箱 root 内 | ✓ VERIFIED | `main.js:4040` `agentWorkspace.ensureWorkspaceDir()` 在 `aiManager = new AIManager()` 之前；`agent-workspace.js:102/113/120-126` 两个访问器 + 2 行幂等 `mkdirSync`。独立探针：两目录 `existsSync` 均 true，且 `startsWith(getWorkspaceDir()+sep)` 均 true |
| 2 | 沙箱 `read` 可成功读取两目录内任意 `SKILL.md`（`readTextFile` → `{ok:true}`） | ✓ VERIFIED | 独立探针 `createSandboxEnv()`（生产调用形状，无参数）→ 对 `skills/alpha/SKILL.md` 与 `managed-skills/beta/SKILL.md` 均 `ok:true` 且读到正文 marker；`resolveInside` 对两目录内路径均非 null（测试 `#技能目录与沙箱可达（SKILL-01）`）。真实行为，非符号存在 |
| 3 | 技能段是 system prompt 的**第 4 段（末段）**；非空时含 `<available_skills>` / `<name>` / `<description>` / `<location>`，且 `<location>` 等于 `Skill.filePath` 绝对路径 | ✓ VERIFIED | `ai-manager.js:580-585`：`base = 三段`，`return skillsBlock ? base + '\n\n' + skillsBlock : base`。独立探针：`prompt === emptyPrompt + '\n\n' + snapshot.promptBlock` 为 **true**（证明末段且无额外间隔）；`<location><abs path></location>` 命中；prompt 以 `</available_skills>` 结尾 |
| 4 | 技能集为空时该段**整段不追加**：prompt 与前三段基线**逐字符相同**，不产生空标签、不留多余空行 | ✓ VERIFIED | 探针：`emptyHasSkillsTag=false`、`emptyEndsWithDoubleNewline=false`；测试 `#prompt 段注入（SKILL-02）` 断言 `prompt === baseline` 且长度相等。空态走 `'' ?:` 分支，不拼接分隔符 |
| 5 | 恰有单项时只注入一个 `<skill>` 条目且 `<available_skills>` 只出现一次；两条限额单位不同、互不换算（正文按 `FileInfo.size` 字节、prompt 段按 JS `string.length`） | ✓ VERIFIED | 探针：单技能时 `<skill>` 计数 = 1、`<available_skills>` 计数 = 1；`ai-skills-manager.js:158`（`info.value.size > maxSkillMdBytes`，来自 `sandboxEnv.fileInfo`）对比 `:582/592`（`formatSkillsForSystemPrompt([...]).length` 与 `used + cost > SKILLS_PROMPT_CHAR_BUDGET`） |
| 6 | 反黑屏 / 反幽灵：根层 `SKILL.md` 不顶替整组；根层散落带 `description` 的 `*.md` 不产生 name 等于扫描根目录名的幽灵技能；两者均产诊断 | ✓ VERIFIED | `createSkillsEnv.listDir` 只在 `isScanRoot(p)` 时收窄为非 directory（`ai-skills-manager.js:143-153`）；测试 `#加载面收窄（回归守卫）` 3 例通过（含「收窄不误伤非扫描根路径」） |
| 7 | `refreshSkills()` 完成后 `buildSkillsPrompt()` / `getSkillsSnapshot()` 在**同一同步帧**读到新集合（零 IO、非 Promise），快照为浅拷贝视图 | ✓ VERIFIED | `ai-skills-manager.js:637-655`（纯 `_cache` 读 + `slice()`）；测试断言 `typeof value === 'string'`、`typeof value.then === 'undefined'`、就地改快照数组不污染权威 |
| 8 | 两处 Agent 创建点（`init()` / `_recreateAgent()`）均在构造 Agent **之前**完成加载 | ✓ VERIFIED | 直接读码：`ai-manager.js:849 await refreshSkills(...)` → `:868 new Agent(`；`:2574 await refreshSkills(...)` → `:2582 new Agent(`。全仓库 `new Agent(` 仅此 2 处（`grep` 计数 = 2）。源码扫描断言（创建点覆盖）+ 兄弟断言（两处调用文本逐字一致）通过 |
| 9 | 同名遮蔽：user 版胜出、managed 版 `shadowed:true` + `shadowedBy:'user'` 且**保留在数据层**；去重发生在**注入之前**（prompt 段同名只一条） | ✓ VERIFIED | 独立探针（干净夹具）：`skills[]` = `['user:dup','managed:dup(shadowed)']`（2 条，败者未剔除），败者 `filePath` 位于 `managed-skills/`，prompt 中 `MANAGED-desc` 不出现、`USER-desc` 出现，`<skill>` 计数 = 1。**并独立证实去重是 Realm 的责任**：同一对同名 skill 直接喂 SDK `formatSkillsForSystemPrompt` 产出 `<skill>` 计数 = **2**（SDK 无 dedup），Realm 的 `.filter(e => !e.shadowed)` 将其压到 1 |
| 10 | 名称权威（D-08）：frontmatter `name` 与目录名不一致时按目录名重写并产 `realm_name_rewritten`，技能**不被丢弃** | ✓ VERIFIED | `ai-skills-manager.js:323-335`（目录名经 `path.dirname(filePath)` 推导并就地重写）；测试 `#名称权威（SKILL-06 / D-08）` 5 例通过（含「重写 ≠ 丢弃：prompt 含 `<name>evil</name>`」「name 一致时不误报」）；源码无 `skill.location` 引用 |
| 11 | 加载诊断不静默：YAML 解析失败 / 超长 description / 布局违规 / 目录缺失 → 均产可读 `code`；单技能失败不抛错、不清空集合；整批失败整体回滚三件套 | ✓ VERIFIED | `toRealmDiag`（`type→level` 显式映射）、`pushEntryDiag`/`pushError` 双写、`realm_layout_violation` / `realm_name_rewritten` / `realm_shadowed` / `realm_skills_dir_missing` / `realm_refresh_failed` 齐全；catch 分支逐行回滚 `skills`/`promptBlock`/`diagnostics`（`ai-skills-manager.js:613-624`）。测试 `#诊断与限额（SKILL-06/07）` 8 例通过 |
| 12 | 三条限额集中定义且生效；任一超限的诊断带 `limit` + `currentValue`；prompt 段超预算在 `</available_skills>` **之外**追加省略提示；定序用码点序（不用 `localeCompare`） | ✓ VERIFIED | `LIMITS`（`:32-36`，64 KiB / 50 / 8000）单源；`realm_skill_md_too_large` / `realm_user_skill_limit_exceeded` / `realm_prompt_budget_exceeded` 均带两数值字段；`:608` 提示追加在闭合标签之外；`grep -c localeCompare` = 0；`grep -c available_skills` 字面量 = 0（不自拼 SDK 模板） |
| 13 | 启停（SKILL-08）：`disabled` 条目**保留在集合内**、标 `disabled`、不进 prompt，磁盘文件存在性与大小均不变 | ✓ VERIFIED | `ai-skills-manager.js:557-560`（就地标记）+ `:585-587`（消费侧 `!e.disabled` 过滤）；测试 `#启停状态（SKILL-08）` 5 例通过（含 `statSync().size` 前后一致、`disabled: []` 可逆、同名共享禁用态、digest 随启停变化） |
| 14 | **SKILL-04 / SC3**：技能集变更后**不重建 Agent** 即生效（改写 `agent.state.systemPrompt`，下一轮 `createContextSnapshot()` 反映新值），并跨窗口广播 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 机制存在且单测到位：`ai-manager.js:2514-2542`（`this.agent.state.systemPrompt = next` + `windowManager.broadcast('skills:changed')`），真实 `Agent` 实例断言「改写 → `createContextSnapshot()` 反映新值」通过，广播经 stub `wm.broadcast` + duck-typed `this` 断言（改写时恰一次 / 无变化不调用 / 忙时只置脏）。**但端到端不可达**：`syncAgentSystemPrompt()` 全仓库唯一调用点（`ai-manager.js:1267`）位于其自身 `if (this._skillsPromptDirty)` 守卫内，而 `_skillsPromptDirty` 的全部写点只有构造器 `:694`（false）、`:1265`（复位）、`:1270`（catch 恢复）、`:2527`（忙时置位）—— 无任何外部/事件/IPC 写入方，构成自环。故「变更→下一条消息即生效」在真实应用中不可能发生（只有 Agent 重建时经 `init()`/`_recreateAgent()` 重扫才反映变更）。详见 Human Verification 第 1 条 |
| 15 | DOC-01：`docs/product/ai-skills.md` 存在且含六节骨架 + 维护约定块 + 诊断归属两级分工 + 三条诚实边界 | ✓ VERIFIED | 46-04 Task 3 的 smoke gate 原样执行 → `DOC-01 OK`（exit 0）；文档 92 行，被独立阅读确认含 `allowed-tools 不存在该字段且不强制`、`沙箱只有一个 root / 工具层不变式非沙箱不变式`、`/compact 不保留正文`、`同名共享禁用态`、`:86` 明写「本基础设施阶段尚未提供技能集的变更入口」 |

**Score:** 14/15 truths verified (1 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SKILL-04 / SC3 的**写路径生产者**：`manage_skill` create/update/delete 后调用 `syncAgentSystemPrompt()` | Phase 49 | ROADMAP Phase 49 SC1：「AI 经 `manage_skill` 的 create / update / delete 创建、修改、删除 managed 技能后，新技能集在下一条消息即对模型可见」；`46-04-PLAN.md` `<p8_gate_mapping>` 第 5 行把该调用列为 Phase 49 的显式交付项 |
| 2 | SKILL-04 / SC3 的**设置页启停与卸载**触发点 | Phase 50 | ROADMAP Phase 50 requirements = USER-01/02/06/07 + SEC-09（列表 / 诊断 / 启停 / 卸载）；`<p8_gate_mapping>` 第 4 行把调用 `syncAgentSystemPrompt()` 列为 Phase 50 交付项 |
| 3 | SKILL-04 / SC3 的**导入落盘**触发点 | Phase 51 | ROADMAP Phase 51 requirements = USER-03/04/05/08 + SEC-02..08/10（zip + 网络地址导入）；`<p8_gate_mapping>` 第 4 行含 Phase 51 |
| 4 | P8 第 3 条触发点（`/` 面板列表变更） | Phase 48 | ROADMAP Phase 48 SC1（`/` 面板列出全部已启用技能）；`<p8_gate_mapping>` 第 3 行明确「面板属 48」，且要求 48 变更技能集后必须调用 `syncAgentSystemPrompt()` |

> 说明：ROADMAP 的 Security gate 段自身声明「本阶段只存在并交付其中 3 个触发点」，其余 3 点「在本阶段**尚无写路径**」，并明令**不得声称 6 点全覆盖**。46-04-PLAN 的 `<p8_gate_mapping>` 与 46-04-SUMMARY 的 `key-decisions` 都如实写成 **3/6** 并给出逐点交接清单 —— 该诚实口径在本次核对中**成立**（见 Requirements Coverage 与 Anti-Patterns）。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `agent-workspace.js` | `getSkillsDir()` / `getManagedSkillsDir()`（均由 `getWorkspaceDir()` 派生）+ `ensureWorkspaceDir()` 追加 2 行幂等 mkdir + 2 项导出 | ✓ VERIFIED | 29 insertions / 1 deletion vs `aa68cfb`；5 条 `fs.mkdirSync(`；两访问器已导出 |
| `ai-skills-manager.js`（新增） | 模块级 `_cache`、`LIMITS`、`createSkillsEnv`、`refreshSkills`、`buildSkillsPrompt`、`getSkillsSnapshot`、`_resetCacheForTest` | ✓ VERIFIED | 668 行；导出面含 `LIMITS/refreshSkills/buildSkillsPrompt/getSkillsSnapshot/_resetCacheForTest`；无 electron 依赖、无顶层 SDK import、无 `require('yaml'\|'ignore')`、无 harness 子路径、无 `localeCompare` |
| `ai-manager.js` | `getAiSkillsManagerLazy()`、`buildSystemPrompt()` 第 4 段、`init()`/`_recreateAgent()` 两处构造前 `refreshSkills`、`syncAgentSystemPrompt()`、`_skillsPromptDirty`/`_skillsPromptDigest`、`module.exports.buildSystemPrompt` | ✓ VERIFIED（1 处 wiring 未达生产可达） | 全部落点存在；`new Agent(` 恰 2 处、`refreshSkills(` 3 处（第 3 处在 `syncAgentSystemPrompt` 内，属非创建点的按需刷新，不参与创建点判定）；`:5785 module.exports.buildSystemPrompt` |
| `tests/test-ai-skills.js`（新增） | `withTempRoot` 脚手架 + 端到端纵切 + 反黑屏/反幽灵 + 依赖纪律源码扫描 + 46-02/03/04 各断言组 | ✓ VERIFIED | 1407 行，14 个 suite，**64 例全通过**；覆盖 46-VALIDATION.md 19 行逐行 |
| `docs/product/ai-skills.md`（新增） | 维护约定块 + 六节骨架 + 三条诚实边界 + 诊断归属声明 | ✓ VERIFIED | 92 行；DOC-01 smoke gate 通过 |
| `docs/product/ai-agent-workspace.md` / `docs/product/ai-chat-attachments.md` | 本阶段**零改动**（归 DOC-02 / Phase 47） | ✓ VERIFIED | `git status --porcelain` 对两文件为空 |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `main.js:4040 ensureWorkspaceDir()` | 两技能目录就位 | `getSkillsDir()` / `getManagedSkillsDir()` 派生自 `getWorkspaceDir()` | WIRED | 在 `new AIManager()` 之前执行；探针证实目录存在且位于工作区根内 |
| `createSandboxEnv()` root | `<location>` 绝对路径可被 `read` 打开 | 沙箱 root 默认 `= path.resolve(options.cwd \|\| getWorkspaceDir())`；`ai-manager.js:845` 以**无参**调用 | WIRED | 探针：`env.readTextFile(<skill md>)` → `ok:true`（user 与 managed 各一）。这是「技能目录必须落在硬沙箱 root 内」的根因链路，实测闭合 |
| `refreshSkills()` | `_cache.promptBlock` | 加载 → 过滤 → 重写 → 遮蔽 → 定序 → 启停 → 上限 → 预算截断 | WIRED | 探针 + 测试：段内容随磁盘变化（外部改写 SKILL.md → 重扫 → 新描述进 prompt，旧描述不残留） |
| `_cache.promptBlock` | `buildSystemPrompt()` 第 4 段 | `getAiSkillsManagerLazy().buildSkillsPrompt()`（同步、零 IO） | WIRED | 探针证实 prompt = 三段基线 + `'\n\n'` + `promptBlock`，且空态逐字符等于基线 |
| `buildSystemPrompt()` | `new Agent({ initialState: { systemPrompt } })` | `init():870` 与 `_recreateAgent():2584` | WIRED | 两处均在 `refreshSkills` 之后调用；`new Agent(` = 2 处全部覆盖 |
| `refreshSkills()` 的 `disabled` 入参 | `settings.aiSkills.disabled` | `this.configStore.get('settings.aiSkills.disabled', [])`（注入式读取，manager 侧零 configStore 依赖） | WIRED | 两处创建点 + `syncAgentSystemPrompt` 三处一致（兄弟断言锁定两处创建点文本逐字相同） |
| `syncAgentSystemPrompt()` | `windowManager.broadcast('skills:changed')` | `window-manager.js:310` 的 `broadcast(channel, ...args)`（已导出，`:410`） | PARTIAL（结构化在位，生产不可达） | 方法体行为经 stub 断言：改写时恰一次、无变化不调用、忙时不调用。但**无生产调用方**（WR-01）→ 真实应用中该广播永不发出；消费方亦属 Phase 48/50 |
| `promptWithContext():1260 isProcessing = false` | 忙时变更的 idle 补刷 | `if (this._skillsPromptDirty) { … await this.syncAgentSystemPrompt() }` | PARTIAL（不可达） | 结构在位且失败会恢复脏标记（WR-04 已修）。但 `_skillsPromptDirty` 无外部写入方 → 该块在本阶段永不执行 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ai-manager.js buildSystemPrompt()` 第 4 段 | `skillsBlock` | `ai-skills-manager._cache.promptBlock` | Yes — 由 `refreshSkills` 经沙箱 `listDir`/`readTextFile` 真实读盘产生 | ✓ FLOWING（探针：磁盘描述改动 → prompt 内容随之改变） |
| prompt 段 `<location>` | `skill.filePath` | SDK `loadSourcedSkills` 返回的真实绝对路径 | Yes | ✓ FLOWING（探针：`<location>` 指向的文件经同一沙箱 `readTextFile` 返回 `ok:true`） |
| prompt 段 `<name>`/`<description>` | `skill.name` / `skill.description` | SKILL.md frontmatter（`name` 经目录名权威重写） | Yes | ✓ FLOWING |
| `_cache.diagnostics` / `errors` | 诊断数组 | SDK 诊断（`type→level` 映射）+ Realm 自建（`realm_*`） | Yes | ✓ FLOWING（`getSkillsSnapshot()` 同步可读，零诊断时为 `[]` 而非 `undefined`） |
| `agent.state.systemPrompt`（变更回写） | `next` | `buildSystemPrompt()` | Yes | ⚠️ STATIC — 回写逻辑真实存在，但**无生产者触发**（见 Truth 14） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 阶段单测全套 | `node tests/test-ai-skills.js` | `# tests 64 / # pass 64 / # fail 0`（14 suites） | ✓ PASS |
| 沙箱与工作区回归 | `node tests/test-agent-workspace.js` | `# tests 21 / # pass 21 / # fail 0` | ✓ PASS |
| bash 策略回归 | `node tests/test-ai-bash-policy.js` | `# tests 32 / # pass 32 / # fail 0` | ✓ PASS |
| DOC-01 smoke gate（46-04 Task 3 `<verify>` 原文） | `node -e "…need=[六节标题, 维护约定, 缓存条目的 diagnostics, description, allowed-tools, 不保留, 共享, 沙箱]…"` | `DOC-01 OK`（exit 0） | ✓ PASS |
| DOC-01 第二 verify（存量产品文档零改动） | `git status --porcelain -- docs/product/ai-agent-workspace.md docs/product/ai-chat-attachments.md` | 输出为空（exit 0） | ✓ PASS |
| 语法检查 | `node --check` × `ai-manager.js` / `ai-skills-manager.js` / `agent-workspace.js` | 三者均通过 | ✓ PASS |
| **独立探针 1**：目录 + 沙箱可达 + 4 段结构 + 空态 | 自写脚本（`/tmp/probe46.js`，不引用阶段测试）驱动 `ensureWorkspaceDir` → `createSandboxEnv()` → `refreshSkills` → `buildSystemPrompt` | `dirsExist:[true,true]`、`skillsDirInsideWorkspace:true`、`managedDirInsideWorkspace:true`、`sandboxReadOk:true`、`sandboxReadManagedOk:true`、`emptyHasSkillsTag:false`、`emptyEndsWithDoubleNewline:false`、`hasSkillTags:true`、`locationIsAbsPath:true`、`lastSegment:true`（prompt === 基线 + `'\n\n'` + block）、`bodyNotInjected:true` | ✓ PASS |
| **独立探针 2**：遮蔽保留 + 注入前去重 + SDK 原生无 dedup 对照 | 自写脚本：同名 skill 各写一份 → `refreshSkills` → 读 `getSkillsSnapshot().promptBlock`；再用同一对同名 skill 直接调 SDK `formatSkillsForSystemPrompt` | Realm 侧 `skills[] = ['user:dup','managed:dup(shadowed)']`（保留 2 条）、prompt `<skill>` 计数 = **1**、`USER-desc` 在 / `MANAGED-desc` 不在、胜者 path 属 `skills/`；SDK 原生对同一输入产出 `<skill>` 计数 = **2** | ✓ PASS |
| 沙箱零 diff 硬约束 | 从 `aa68cfb:agent-workspace.js` 与 HEAD 各提取函数体做**逐字符**比较（花括号配对，跳过默认参数 `{}` 干扰） | `resolveInside` **BYTE-IDENTICAL**（30 行 / 1024 字符）；`createSandboxEnv` **BYTE-IDENTICAL**（171 行 / 5136 字符）；diff hunk 仅 3 处（头注释 / 两个新访问器 / exports），均不落在两个函数体内 | ✓ PASS |
| 零新增依赖 | `git diff v2.5..HEAD --stat -- package.json` | 输出为空（`v2.5` = `76d01fb`，tag 存在） | ✓ PASS |
| 依赖纪律（独立复核，不只靠测试） | `grep -cE "require\(\s*['\"](yaml\|ignore)['\"]\s*\)\|pi-agent-core/harness/"` | `ai-skills-manager.js: 0`、`ai-manager.js: 0` | ✓ PASS |
| renderer 侧无第二份优先级表 | `grep -rln "shadowedBy\|bySkillPriority\|managed-skills" src/` | 无命中 | ✓ PASS |
| 债务标记扫描 | `grep -nE "TBD\|FIXME\|XXX\|HACK\|PLACEHOLDER"` 于 5 个阶段文件 | 无命中（`ai-manager.js:487/524` 的 `XXX` 是**既有**工具描述文案，经 blame 确认提交 `d1062d0` 且不在本阶段 diff 内） | ✓ PASS |
| Electron 依赖用例 | `node tests/test-ai-conversations.js` | **未运行**（需 Electron，headless 环境不可用）—— 既不计通过，也不计失败 | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | `find scripts -path '*/tests/probe-*.sh'` | 无 `probe-*.sh`；本阶段非迁移/工具阶段，PLAN/SUMMARY 亦未声明任何 probe | SKIPPED（无 probe 可跑） |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SKILL-01 | 46-01 | 两目录启动自动创建且在硬沙箱 root 内可达 | ✓ SATISFIED | Truth 1 + 2；独立探针 `resolveInside` 非 null、`readTextFile ok:true` |
| SKILL-02 | 46-01 | `<available_skills>` 动态注入（name/description/location），无技能时空段 | ✓ SATISFIED | Truth 3 + 4；末段结构经探针证明；空态逐字符等于基线 |
| SKILL-03 | 46-01 / 46-04 | 异步加载后同步可读；两处 Agent 创建点在构造前完成加载 | ✓ SATISFIED | Truth 7 + 8；`new Agent(` 2 处全部覆盖 |
| SKILL-04 | 46-04 | 技能集变更后刷新 system prompt 且不重建 Agent；跨窗口广播 | ⚠️ **PARTIALLY MET** | 机制（不重建回写 + 广播）**已实现且被行为断言覆盖**；但无生产者、idle 补刷不可达 → 端到端不可观测。生产者按 ROADMAP 归 Phase 49/50/51（已列 Deferred）。判定理由见下文 |
| SKILL-05 | 46-02 | 同名遮蔽 user > managed，去重发生在注入前；冲突对用户可见 | ✓ SATISFIED | Truth 9 + 10；探针证明败者保留 + prompt 只一条；SDK 原生无 dedup 的反证亦已取得 |
| SKILL-06 | 46-02 / 46-03 | 加载诊断（非法 name / 超长 desc / YAML 失败）透传，不静默 | ✓ SATISFIED | Truth 11；9 个 `realm_*` 码与 SDK 5 枚举零重叠（宽口径正则复核）；`errors[]` 与 `diagnostics[]` 双通道 |
| SKILL-07 | 46-03 | 三限额集中定义并生效；超限提示「哪个限额 / 当前值」 | ✓ SATISFIED | Truth 12；`limit` + `currentValue` 均有行为断言；字节闸在 YAML 解析前（`read_failed` 而非 `parse_failed`） |
| SKILL-08 | 46-03 | 用户可对单个技能启用/禁用（存设置、加载后过滤、不删文件） | ✓ SATISFIED | Truth 13；`statSync().size` 前后一致 + `existsSync` 为真 |
| DOC-01 | 46-04 | 新建 `docs/product/ai-skills.md` 产品说明 | ✓ SATISFIED | Truth 15；smoke gate 原样通过 |
| SKILL-09 | —（属 Phase 47） | 技能 `scripts/` 经 bash 运行 | N/A — 非本阶段 | REQUIREMENTS traceability 明确 SKILL-09 → Phase 47；本阶段 PLAN frontmatter **未**声明该 ID，属正确留空，非 ORPHANED |

**孤儿检查：** REQUIREMENTS.md 映射到 Phase 46 的 ID 恰为 SKILL-01..08 + DOC-01（9 个）。4 份 PLAN 的 `requirements` 字段并集 = {SKILL-01,02,03} ∪ {SKILL-05,06} ∪ {SKILL-06,07,08} ∪ {SKILL-03,04,DOC-01} = **同样 9 个**，无 ORPHANED、无遗漏。`requirements-completed` 的逐 plan 声明与上述并集一致。

**19 行 Per-Task Verification Map 逐行核对结果：** 19/19 行都有**真实存在的测试**承接（不是「有断言名无断言体」）。1 处口径偏差值得记录：`46-03-01` 行写「非法 name / 超长 description / YAML 失败 → 技能被跳过 **且** diagnostics 含对应 code」，实现按 D-08 对 **name 类** `invalid_metadata` **不跳过**（以目录名重写并保留），仅透传诊断；test 明确断言「保留 + 诊断透传」。该偏差由 46-03-SUMMARY 的 `key-decisions` 第 1 条记录并说明按 D-08 调和 —— SKILL-06 的实质要求（诊断不静默）满足，故不构成 gap，属验证行措辞滞后。

**SKILL-04 判定（用户明确要求显式给出结论）：**

**结论：本阶段 SKILL-04 应记为「部分达成（partially met）」，不得记为 fully met，也不宜记为 unmet。**

理由：

1. **机制半边已达成且证据充分。** SKILL-04 的两项技术要求 —— ①「刷新 system prompt 且**不重建 Agent**」②「变更经跨窗口广播同步各窗口」—— 在代码中都成立并有**真实行为**证据：`agent.state.systemPrompt` 是可写普通属性且 `createContextSnapshot()` 每轮重读（用真实 `Agent` 实例断言，不是读 SDK 注释）；`windowManager.broadcast('skills:changed')` 经 stub 计数断言（改写时恰一次 / 无变化不调用 / 忙时只置脏），这比「源码里出现该字面量」强得多。`computeDigest` 的输入已覆盖 `disabled`/`overLimit`/`shadowed` 与整段 `promptBlock`，与「无变化早退」的判定口径自洽。
2. **触发半边在本阶段不可能达成，而且不该在本阶段达成。** 全仓库 `syncAgentSystemPrompt()` 的唯一调用点在自己的 `_skillsPromptDirty` 守卫块内，而该标记没有外部写入方 —— 这是一个可观测的自环（已独立复核，非推测）。因此「技能集变更后，下一条消息即生效，且广播到其他窗口」在真实应用里不会发生。但 SKILL-04 原文列出的触发场景「安装 / 卸载 / 启用禁用 / `manage_skill`」**恰好就是** ROADMAP 分配给 Phase 49（`manage_skill`）、Phase 50（启停 / 卸载）、Phase 51（导入）的写路径；ROADMAP 的 Security gate 段自己写死了「其余 3 点在本阶段**尚无写路径**……**不得声称 6 点全覆盖**」。若把它判为 unmet（gaps_found），`/gsd-plan-phase 46 --gaps` 会去规划 49/50/51 的写路径，导致同一份校验/写入逻辑出现第二份实现 —— 正是 CONTEXT.md scope boundary 与 `<p8_gate_mapping>` 明令禁止的事。
3. **因此按「部分达成」计入，并按 Step 9b 把缺口移入 Deferred。** 唯一非延迟项是「机制当前不可达」这一事实本身 —— 它已在 `docs/product/ai-skills.md:86`（已知限制：「本基础设施阶段尚未提供技能集的变更入口」）与 46-REVIEW.md 的 WR-01（Accepted，按设计）中如实披露。故该条以 `behavior_unverified` 形式进入人工验证，而不是以 BLOCKER 阻断。

诚实性复核（用户点名的第二项）：**P8 覆盖率 3/6 的口径是诚实的，成立。** ROADMAP 的 gate 段、`46-04-PLAN.md` 的 `<p8_gate_mapping>`、`46-04-SUMMARY.md` 的 `key-decisions`/`coverage` 三处一致写成 3/6 并逐点交接，未出现「全覆盖」宣称；`tests/test-ai-skills.js:1338-1342` 的注释还显式声明「这是创建点覆盖断言，**不得**改写成 `refreshSkills(` 与 `new Agent(` 计数相等」——对「3 vs 2 是正确状态」有自觉。**唯一的过度宣称**出现在 46-04-SUMMARY 的正文首句（见 Anti-Patterns AP-4），它把「机制已就绪」写成了「技能集变更从此……下一轮即生效」而未披露「连生产者也没有」。这是**叙述层**问题（REVIEW WR-01 已记录并接受），不影响代码判定。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `ai-manager.js` | 1264-1273 | 不可达代码：`if (this._skillsPromptDirty)` 补刷块的前置条件只能由它自己调用的方法置位（自环） | ⚠️ Warning | SKILL-04 的热更新路径在本阶段永不执行 → 端到端不可观测。REVIEW WR-01 已接受（按设计，写路径后置）；已记入 `behavior_unverified_items` |
| `ai-manager.js` | 2526-2528 | 同源不可达：忙时置脏分支同样需要外部调用方才可能进入 | ⚠️ Warning | 与上条同一根因，不单独计分 |
| `docs/product/ai-skills.md` | 75 | 文档写「技能段的变更在**修改之后的下一次请求**生效……不会丢失」，但当前无任何变更入口，直接改盘也不会在下一条消息生效（须重建 Agent） | ⚠️ Warning | 缓解充分：`:86` 已明写「本基础设施阶段尚未提供技能集的变更入口」，`:92` 的人工步骤正确写成「**切换对话**后，下一条消息应反映改动」（不再把重建路径当作热更新证据）。建议在 Phase 49/50 接入写路径时一并把 `:75` 改写为两段式（REVIEW WR-02 的建议） |
| `46-04-SUMMARY.md` | 126 | 过度宣称：正文首句「技能集变更从此『无需重启、无需重建 Agent、下一轮即生效、且跨窗口可见』」未披露生产端无调用方 | ℹ️ Info | 仅影响阅读者判断；`coverage` 表与 `key-decisions` 的 3/6 口径正确，代码不受影响 |
| `tests/test-ai-skills.js` | 1330-1337 | P8 断言用「`new Agent(` 前 60 行」窗口法；`_recreateAgent` 的窗口（2516..2575）完整包住紧邻其上的 `syncAgentSystemPrompt` 的 `refreshSkills(`（2517），删掉 `_recreateAgent` 自己的接线后该断言仍绿 | ℹ️ Info | 有替代守卫：同 describe 的「两处创建点调用文本逐字一致」断言从 `methodBody('_recreateAgent')` 内提取调用，删接线即取空转红。本次核对已**直接读码**确认两个创建点都真的接线了，故该性质本身成立；仅为测试仪器的强度提示（REVIEW WR-06 已接受） |
| `ai-manager.js` | 487 / 524 | `XXX` 字样命中债务标记正则 | ℹ️ Info | 假阳性：是既有工具描述里的中文示例占位（blame = `d1062d0`，不在本阶段 diff 内），非债务标记。**未**按债务标记门禁阻断 |

**禁止事项（must_haves.prohibitions）逐条核查 —— 全部以确定性证据判定为「未发生」，无需人工裁定：**

| # | Prohibition | 证据 | 结论 |
| - | ----------- | ---- | ---- |
| P1 | 不得为 `managed-skills/` 引入第二沙箱 root / 只读挂载，或改动 `resolveInside()` / `createSandboxEnv()` | 两函数与 `aa68cfb` **逐字符相同**；两目录均 `path.join(getWorkspaceDir(), …)` | 未发生 |
| P2 | 不得把 SKILL.md 正文注入 prompt | 探针 `bodyNotInjected:true`；注入集只含 SDK 五字段条目的 name/description/filePath | 未发生 |
| P3 | 不得自拼 `<available_skills>` / 不得在 renderer 重建该段 | `grep -c available_skills ai-skills-manager.js` = 0；`grep -rln … src/` 无命中；段文本出自 `formatSkillsForSystemPrompt`（探针见 SDK 英文前言） | 未发生 |
| P4 | `buildSkillsPrompt` / `getSkillsSnapshot` / `buildSystemPrompt` 不得异步化或触发 IO | 全部为纯 `_cache` 读；`typeof value.then === 'undefined'` 断言通过 | 未发生 |
| P5 | 不得引入 YAML / ignore 库或 SDK harness 子路径 | 独立 grep 计数均为 0（两文件） | 未发生 |
| P6 | 遮蔽技能不得从 `_cache.skills` 移除 | `applyShadowing` 无 `splice`/`filter`，返回等长数组；探针实测 2 条全在 | 未发生 |
| P7 | 去重 / 优先级 / 名称权威不得在 renderer 复制第二份 | `grep -rln "shadowedBy\|bySkillPriority\|managed-skills" src/` 无命中；本阶段未改任何 renderer 文件 | 未发生 |
| P8 | 不得丢弃 SDK diagnostics，不得整批 throw / 清空集合 | `toRealmDiag` 全量透传；catch 只回滚 + 追加 `realm_refresh_failed`；单技能失败 `doesNotReject` 断言通过 | 未发生 |
| P9 | `SKILL.md` 字节上限不得在 SDK 解析之后生效 | 拒绝在 `readTextFile` 阶段（YAML 解析前）；测试断言无 `parse_failed` | 未发生 |
| P10 | 单技能失败不得整批 throw；整批失败不得清空上一次快照 | 三件套整体回滚（源码逐行断言 + 行为断言） | 未发生 |
| P11 | 禁用不得删除磁盘文件 / 不得从 `_cache.skills` 移除 | `existsSync` + `statSync().size` 前后一致；就地 `entry.disabled = true` | 未发生 |
| P12 | 不得通过重建 Agent 落地变更 | 回写路径只执行 `this.agent.state.systemPrompt = next`，无 `new Agent(`（全仓库仍恰 2 处，均在创建点） | 未发生 |
| P13 | 产品文档不得暗示 `allowed-tools` 被强制，或技能目录构成额外权限边界 | 文档 `:74`「技能不构成额外权限……都要走同一套 bash 策略」、`:80`「当前运行时不强制……虚假安全感」、`:81`「沙箱只有一个 root……工具层不变式」 | 未发生 |
| P14 | 不得在流式回调内 / `isProcessing` 为真时改写 Agent 状态 | 忙检查（`:2526`）位于任何 `agent.state` 读写与广播之前；忙分支只置脏后 `return` | 未发生 |

### Gaps Summary

**无阻断性 gap（0 BLOCKER）。** 阶段可观测的交付面 —— 双目录进沙箱、`<available_skills>` 第 4 段注入、空态零追加、加载后同步可读、两创建点前置加载、同名遮蔽与注入前去重、名称目录名权威、诊断全覆盖不静默、三限额生效、启停不删文件、DOC-01 —— 全部在代码中存在、接线、且有行为证据（含 2 个独立探针）。硬约束全部成立：沙箱零 diff（逐字符）、零新增依赖（`package.json` 自 `v2.5` 起零改动）、无 renderer 第二份权威、无债务标记。

**唯一未达成项是 SKILL-04 / ROADMAP SC3 的端到端可达性**：机制齐备且测试到位，但没有任何生产者能触发它，故「技能集变更 → 下一条消息即生效 + 跨窗口广播」在真实应用中不可能发生。该缺口的三个生产者（`manage_skill` → 49、启停/卸载 → 50、导入 → 51，另加 `/` 面板 → 48）**由 ROADMAP 自身明确分配给了后续阶段**，并已在本报告 `Deferred Items` 逐点记录，故不构成需要 `/gsd-plan-phase --gaps` 回填的 gap —— 回填反而会造成跨阶段重复实现（CONTEXT.md scope boundary 与 `<p8_gate_mapping>` 均明令禁止）。

**上游叙述需在下一阶段收口的两点（不阻断）：** ① 46-04-SUMMARY 首句的过度宣称（AP-4）应在接入写路径时修正为「机制就绪、触发点移交 48/49/50/51（当前不可达）」；② `docs/product/ai-skills.md:75` 的「下一次请求生效」措辞应在 Phase 49/50 落地时改为两段式（重建即生效 / 原地回写待写路径）。

### Human Verification Required

#### 1. SKILL-04 / SC3 端到端可达性（技能集变更 → 下一条消息生效 + 跨窗口广播）

**Test:** 先获得一个技能集变更入口（Phase 49/50/51 落地后任意一个，例如设置页启停；或在主进程直接调用 `aiManager.syncAgentSystemPrompt()`）。随后**保持同一对话**（不切换、不重建）发下一条消息；同时观察第二个窗口。
**Expected:** 下一条消息的请求使用新技能段（`agent.state.systemPrompt` 已原地改写，Agent 实例未重建、`state.messages` 引用链未断）；另一窗口收到 `skills:changed`；`isProcessing` 为真时收到变更则先置脏、空闲后补刷一次且不丢。
**Why human:** 方法体本身已被行为断言覆盖，但 `_skillsPromptDirty` 没有任何生产写入方 —— 唯一调用点在自己的守卫块内（自环），因此该行为在真实应用中不可达。存在性检查与 Grep 看不到这一点，只有端到端触发才能判定。

#### 2. 模型仅凭 description 自动匹配技能并经 `read` 打开 `<location>`

**Test:** `npm run dev` → 在 `agent-workspace/skills/<x>/SKILL.md` 放一个技能 → 问 AI「你有哪些技能」→ 再给一个命中该技能 description 的任务。
**Expected:** AI 应答出 name / description；命中任务时调用 `read` 打开 `<location>` 指向的 `SKILL.md` 并按其内容行事。
**Why human:** 需真实 LLM 往返；模型对简单任务可能「故意不触发技能」，自动化断言不确定（46-VALIDATION.md Manual-Only 第 1 行）。这是 SKILL-02 与 Phase 48 DISC-05 的共同前置。

#### 3. P8 第 6 条路径：手改磁盘后切换对话生效

**Test:** `npm run dev` → 直接编辑 `agent-workspace/skills/<x>/SKILL.md`（模拟模型经 `write`/`bash` 绕开所有 Realm 管理器改盘）→ **切换对话** → 发下一条消息。
**Expected:** 新技能集反映改动（`_recreateAgent()` 的重扫兜底生效）。
**Why human:** 端到端需真实 Agent 重建。**注意**：该步骤走的是「切换对话 → 重建」路径，**不是** SKILL-04 的不重建热更新路径 —— 不得把它的通过读作热更新已验证（REVIEW WR-02 的原始误读风险）。

---

_Verified: 2026-09-11T02:35:54Z_
_Verifier: Claude (gsd-verifier)_

# Phase 49: `manage_skill` 工具（AI 自建技能） - Research

**Researched:** 2026-09-13
**Domain:** Electron 主进程 / pi-agent-core 工具注册 / 沙箱原子写 / 技能集失效链
**Confidence:** HIGH（全部关键断言均为本会话读盘 + 实跑验证）

---

## Summary

本阶段的技术面几乎全部落在**既有代码的既有原语**上：写路径由 `agent-workspace.createSandboxEnv()` 提供，刷新链由 `ai-manager.syncAgentSystemPrompt()` + `_flushDeferredSkillsPrompt()` 提供，校验/扫描由 `ai-skills-manager` / `ai-memory-manager` 提供。研究结论是：**CONTEXT.md 的 D-01..D-13 与代码事实一致，唯一例外是 D-08 的字段分离扫描在当前导出面下无法直接组合**（详见下节「关键冲突」）。两个「待实测项」已用真实沙箱实跑闭合，结论与预期一致但带回三条**会直接影响实现写法**的细节（`createDir` 幂等不可用作撞名判定、`rename` 到缺失父目录必失败因此 `createDir` 是硬前置、`.tmp/` 残留目录累积）。

**关键冲突（必须 plan 期裁决，不得静默绕过）：** D-08 要求「`description` 跑 `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS` 两组；`content` **只**跑 `INJECTION_PATTERNS`」，但 `ai-memory-manager.js` 只导出 `scanInjectionPatterns(content)`，该函数**无条件连跑两组**，且 `INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS` 两张表**均未导出**（本会话 `require` 实测：`'INJECTION_PATTERNS' in m === false`、`'CREDENTIAL_PATTERNS' in m === false`）。实测 `scanInjectionPatterns('api_key: YOUR_KEY_HERE')` 返回 `safe:false`（凭据命中）—— 即按现有导出实现 D-08 会让**合法技能文档里的配置示例被误伤**，正是 D-08 要避免的后果。**必须**对 `ai-memory-manager.js` 做一处最小改动（加可选参或导出两张表），否则 D-08 不可实现。这是本研究的**唯一阻塞级发现**。

**Primary recommendation:** 写函数与校验器全部落在 `ai-skills-manager.js`（新导出 `createManagedSkill` / `updateManagedSkill` / `deleteManagedSkill` + 校验器），签名统一为 `(env, { …, seededNames })`；`ai-manager.js` 只做 `_buildRealmTools()` 注册 + `_resolveManageSkillMarker` 标记 + 成功后一行 `await this.syncAgentSystemPrompt()`；`ai-memory-manager.js` 加**一个可选参**以支持字段分离扫描（唯一的外部改动）。

### 实测证据索引（本会话实跑，可复现）

| # | 实测项 | 结论 | 证据 |
|---|--------|------|------|
| E1 | `env.createTempFile()` 形状 | `<WS>/.tmp/tmp-XXXXXX/<prefix><ts>-<rand><suffix>`；**`sanitizeNamePart` 剥掉 `.`** ⇒ `suffix: '.md'` 实际落成 `md` | 探针输出 `"<WS>/.tmp/tmp-U8PbuK/skill-1789275458959-b41f0amd"` |
| E2 | `createDir` 撞已存在目录 | **`ok: true`（静默幂等）**，因内部 `recursive: options?.recursive ?? true`。**不可用作撞名判定** | `3.createDir.first :: {"ok":true}` / `4.createDir.EXISTING :: {"ok":true}` |
| E3 | `renameFile` 覆盖已存在文件 | **`ok: true`，原子替换成立**（POSIX `fs.rename`） | `6.rename.OVERWRITE_EXISTING :: {"ok":true}` → `6.dest.content :: "CONTENT-V2"` |
| E4 | `renameFile` 到**缺失父目录** | 失败 `not_found`（ENOENT）⇒ `createDir` 是 `create` 的硬前置 | `7.rename.missingParent :: {"ok":false,"code":"not_found"}` |
| E5 | `renameFile` dest 逃逸 | 被沙箱拒：`permission_denied`（双基准校验生效，MGMT-03 判据） | `8.rename.escapeDest :: {"ok":false,"code":"permission_denied",...}` |
| E6 | `renameFile` 跨目录（`.tmp/` → `managed-skills/`） | **成功，无 EXDEV**（同 root 同设备） | `5.rename.fresh :: {"ok":true}` + `5.dest.content :: "CONTENT-V1"` |
| E7 | `remove(dir, {recursive:true})` | `ok: true`，整目录（含 `scripts/`）删除 | `9.remove.recursive :: {"ok":true}` / `9.dirGone :: true` / `D1/D2` |
| E8 | `remove` 缺失目标（无 `force`） | 失败 `not_found` | `10.remove.MISSING_noForce :: {"ok":false,"code":"not_found"}` |
| E9 | `exists` | 返回 Result，`ok:true` + `value:true/false` | `2.exists(missing) :: false` / `11.exists(managedDir) :: true` |
| E10 | 失败清理后无半成品 | create 失败 → `remove(dir,{recursive:true})` → 目录列表与操作前**逐字相等** | `F3.noHalfProduct :: true` |
| E11 | 不触及其它工作区路径 | `attachments/` 完好；`ai-memory/` 在探针中本就未创建（`false` = 未被创建，不是被破坏） | `X1/X2` |
| E12 | `.tmp/` 残留 | 每次原子写**留下一个空 `tmp-XXXXXX/` 目录**；失败的写留下目录 + 空文件 | `X3.tmpDirsAccumulated :: 3`、`X4.tmpDirNames :: ["tmp-LpjSKn","tmp-Vkm6oW","tmp-Y3zMAG"]` |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `manage_skill` 工具定义与参数转发 | 主进程 · AI 工具注册层（`ai-manager.js` `_buildRealmTools()`） | — | 对齐 `memory` 工具的「注册 + 委托」先例；工具 schema 的 `properties` 键集合是判据 2 的验收面 |
| name / description / 正文 / 净化校验器 | 主进程 · 纯逻辑模块（`ai-skills-manager.js`） | — | 该模块零 electron 依赖 ⇒ 可单测、可被 50/51 直接 require（ROADMAP 安全门禁的前提） |
| 三动作写实现（原子写 / 撞名判定 / seeded 保护 / 限额） | 主进程 · `ai-skills-manager.js` | 沙箱原语（`agent-workspace.createSandboxEnv`） | 「读权威」与「写权威」同源，避免第二份实现 |
| 路径安全（双基准校验、realpath 复核、`.tmp/` 重定向） | 主进程 · `agent-workspace.js` 沙箱层 | — | **只读消费，本阶段零改动**（判据 4 的 `env.renameFile` 判据即此） |
| seeded 身份（播种登记表） | 主进程 · `builtin-skills-seeder.getSeededSkillNames()` | 注入到 manager | 该模块间接依赖 electron ⇒ 集合由调用方注入（对齐 `sourceTierOf` 模式），manager 保持零 electron 依赖 |
| 内容注入/凭据扫描 | 主进程 · `ai-memory-manager.js`（复用） | — | D-08 明确复用；**需一处最小改动**以支持字段分离（见「关键冲突」） |
| 刷新链（重扫 → prompt 回写 → 广播） | 主进程 · `syncAgentSystemPrompt()` + `_flushDeferredSkillsPrompt()` | — | 本阶段只加**调用方**，方法体逐字不动（受源码扫描断言钉住） |
| 工具卡片技能化标记 | 主进程 · `_resolveManageSkillMarker`（工具事件生成侧） | 渲染端 `TIER_BADGE` 白名单查表 | 判定只在主进程（48-03 硬约束：renderer 零路径字符串匹配） |
| 卡片渲染 | 渲染端 · `src/renderer.js` `renderToolCard()` | — | 只做白名单查表与呈现，零来源/限额判定 |
| `/` 面板同步 | 渲染端 · 既有 `skills:changed` 监听 | 主进程广播 | 48-06/48-08 已建，本阶段零改动 |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 写入确认与可见性

- **D-01:** **三个动作一律自动，不加确认卡片**（对齐 `write` / `edit` 的既有决策）。理由：破坏面已被硬沙箱限定在 AI 专用数据区（`managed-skills/`）；AI 本来就能用 `write` 工具**直写同一路径**（P8 第 6 条明确承认），单独给 `manage_skill` 加确认会**被轻易绕道**，成为只在合作路径上生效的虚假安全感 —— 与 `allowed-tools` 免责标注、bash 白名单诚实边界是同一个判断。
- **D-02:** **用户感知 = 工具卡片技能化**：复用 48 D-15 已建立的模式（`renderToolCard()` 把 `read` 工具卡片特殊化为「使用技能「name」」），把 `manage_skill` 的卡片标题改为「创建 / 更新 / 删除技能「foo」」+ 三档来源徽标（与 skill pill 同款视觉）。**不额外插 system-note**（与 tool card 信息重复，且一次对话建多个技能会刷屏 —— 48 D-15 同款判断）。
- **D-03:** **工具描述里写死两条**：①「**仅在用户明确要求**把某套流程/经验沉淀为技能时调用」（落地 FEATURES 的 anti-feature 结论「不做 autolearn 推促」）；② MGMT-06 的「**优先增强已有技能**，而非创建近乎重复的新技能」（对齐 oh-my-pi 的 "Capture sparingly"）。**不写进 `REALM_SYSTEM_PROMPT`** —— 避免第 1 段改动导致所有既有会话的 provider 前缀缓存重建（48 D-18 已付过一次这种代价，本次无必要）。

#### 更新语义与写路径

- **D-04:** **`update` = 全量覆写正文**：`content` 必填 = 完整新正文（**不含 frontmatter**，frontmatter 由工具生成 `name` + `description` 两行）；局部增强走「先 `read` 再全量写」或直接用既有 `edit` 工具；工具描述写明这条分工。— **Reversibility:** costly — 回退需新增 `old_string` / `new_string` 参数，而 ROADMAP 成功判据 2 明文「工具**只接受** `name` 与 `content` / `description`」，该判据的验收面（工具 schema 的 properties 键集合）会失败，须回头改 ROADMAP。理由：加局部编辑参数与沙箱内 `edit` 工具**能力完全重叠**（`edit` 在 `managed-skills/**` 上可用是既成事实），等于同一能力两份实现 —— 正是 AGENTS.md「同一用户意图不管从哪个入口进来行为必须一致」要防的分裂；而合并成声明式 `save` 会违反 MGMT-01 的「三个动作」并丢掉 P3/§5.3 要求的独占创建语义。
- **D-05:** **接受双写路径 + 工具描述引导，不新增拦截机制**。`manage_skill` 负责技能集级声明式变更，`edit`/`write`/`bash` 负责文件级微调（含给技能加 `scripts/`）。理由三条：① 沙箱层「保护技能目录」因 `exec` 不校验命令内容而是**结构上不可能完整**的（`bash -c 'echo … > managed-skills/foo/SKILL.md'` 照样穿透），不完整却自称收敛是虚假安全感，且会把 AI 逼向最不可审计的 bash 路径；② 加载管线补 name 格式闸会**推翻 46 D-08**（明文「不丢弃命名不规范的合法技能」），代价是已导入的合法技能升级后消失；③ 你真正担心的「校验绕过」其实**已经闭合** —— 字节闸（64 KiB）在加载期由 `createSkillsEnv` 卡，**三条写路径同源生效**（超大 SKILL.md 下次重扫即被拒并产 `realm_skill_md_too_large` 诊断），遮蔽 / 禁用 / 布局过滤同样都在加载管线一处。**剩余窄分裂只有一个且影响有界**：bash 可造出目录名不合 `^[a-z0-9-]+$` 的技能（如 `My_Skill/`），它会进 system prompt，但**无法被 `/skill:name` 显式调用** —— `src/skill-picker-model.js:29` 的 `SKILL_NAME_RE` 是 renderer 与主进程共用的单源解析器（48-01），不合格式直接返回 null 走「未知命令」。**必须写进 `docs/product/ai-skills.md` 的诚实边界**（与 bash 白名单、`allowed-tools` 同一节口径），不留成未记录的洞。

#### name 校验与撞名响应

- **D-06:** **name 校验 = 判据字面 + 三条必要补充**：`^[a-z0-9-]+$` 之上补 ① 长度 ≤ 64（对齐 SDK `skills.js:4-5` 的 64 字符限 —— 否则该限制形同虚设，因为 SDK 超长只产 warning **不拒绝**，而 46 D-08 会把超长目录名直接重写成 `skill.name` 进 system prompt 且零诊断）、② 无首尾连字符（目录名以 `-` 开头会让 AI 用 bash 调技能自带 script 时被当选项）、③ 无连续连字符。与 P3 的建议完全一致。**同时写清一条故意的不对称：写入门严、读入门宽** —— 加载管线对磁盘上已存在的技能保持宽松（46 D-08 不丢弃命名不规范者），严格校验只作用于**我们能控制的写入侧**（`manage_skill` 与 Phase 51 导入）。这是**一份校验器 + 一处不对称的调用口径**，不是两份实现。
  - **补充口径**：name 只做 `trim()` 首尾空白，**不自动 lowercase** —— 静默规范化会让判据 2 的「非法 name 被拒绝并说明原因」失去触发面，且 memory 工具已有「业务校验失败 throw → SDK 转 `isError: true` toolResult → LLM 自行修正」的成熟先例。
- **D-07:** **`create` 独占创建 + 按来源区分拒绝**（对齐 oh-my-pi 与 FEATURES §5.3）：目标**已存在**（任何来源）即 `isError: true` 且**不落盘**，四类来源给不同可读原因 —— seeded → 「内置技能不可覆盖」（判据 3）；用户技能 → 「同名用户技能优先级更高，AI 建的会被**永久遮蔽**」（46 D-06 的 user > managed，不拒绝就是静默无用）；自己已建的 managed → 「已存在，请改用 `update`」；用户手放在 `managed-skills/` 的（非 seeded，与上一类**同形**，工具无法区分）→ 同前。`update` / `delete` 对 seeded 与用户技能一律拒绝、目标不存在则提示改用其它 action。
  - **撞名判定一律读盘**（`env.exists`），**不用缓存快照** —— bash 可随时改写磁盘（P8 第 6 条），缓存只反映「上次重扫的时刻」，据此判「已存在」会给出错误结论。与 48 的「调用那一刻读盘」同款精神。
  - `description` 与 `content` **均必填、trim 后非空**：description 是模型按 description 自动匹配的**唯一触发机制**（skill-creator 作者指南的核心结论）；空正文有 `readSkillForInvocation` 的既有拒绝先例（48-04）。
  - **机器可读原因码**进 `details`：`seeded_protected` / `user_owned_conflict` / `already_exists` / `not_found` / `limit_exceeded` / `invalid_name` / `invalid_description` / `oversize` / `unscannable` —— 对齐 48 的 `details.shadowed` 先例，供 Phase 50/51 与测试断言消费。

#### 内容扫描、净化与数量上限

- **D-08:** **扫描范围 = 复用 `ai-memory-manager.scanInjectionPatterns`（P3 明确建议；实测对内置技能零误伤）**，但两组模式**按字段分开用**：`description` 跑 `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS`；`content` **只跑** `INJECTION_PATTERNS`。理由：description 无条件进**每个请求**的 system prompt，与两层记忆完全同构（同一「秘密入库 = 上传第三方」论据）→ 两组都要跑；content 不进 prompt，而技能文档**合法地会写配置示例**（`token: xxx`、`api_key=…` 会被 `CREDENTIAL_PATTERNS` 命中）→ 跑凭据组会**误伤合法技能创建**。命中即 `throw`（对齐 memory 工具的「拒绝写入」语义，非 `validateScript` 的「拒绝执行」）。`SKILL_THREAT_PATTERNS` 技能域扩展（外发 / 凭据路径 / 绕过授权）仍归 **Phase 51**，但**49 把扫描点接成单点**，51 只需扩表、不加接线。
- **D-09:** **净化只作用于 `description`**：压单行（换行 → 空格）+ 剥控制字符与零宽字符。`content` **不净化**（可能含代码 / 脚本，剥字符会破坏合法内容；且它不进 prompt）。**顺序铁律：先扫描、后净化** —— 净化会剥掉零宽字符，顺序颠倒会让 P3 实测的「零宽字符变体」绕过检测。
- **D-10:** **新增 `LIMITS.MAX_MANAGED_SKILLS = 50`**（在既有 `LIMITS` 单源里**加一项**，不动既有三项），`create` 时对「**非 seeded** managed 目录数」预检，到顶即拒绝 + 可操作提示（先删除不用的技能）；`update` / `delete` **不受限**。理由：`MAX_USER_SKILLS` 只统计 `source === 'user'`（`ai-skills-manager.js:570`），managed 完全不计数 ⇒ AI 可无限建、磁盘与每次 Agent 重建的重扫成本无上限，而 P7 明确要求 `manage_skill` 也卡数量。**不用 prompt 段预算做创建拒绝** —— 那与 48 D-12「超限技能仍可显式调用（它只是排不进预算，本身完全可用）」直接冲突。**两个闸职责分工写清**：数量闸管磁盘 / 重扫成本，prompt 段预算闸（8000 字符）管请求成本。

#### 实现落点与原子写

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

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MGMT-01 | AI 拥有 `manage_skill` 工具，支持 `create` / `update` / `delete` 三个动作 | 工具注册落点已定位（`ai-manager.js:3177` `_buildRealmTools()`，数组尾部 `...this._buildFilesystemTools()` 之前）；三动作后端落点 `ai-skills-manager.js`（零 electron 依赖已验证）；「三个动作」是判据 2 的 schema `enum` 面 |
| MGMT-02 | **不接受 `path` 参数**，只接受 `name`（`^[a-z0-9-]+$`）与 `content` / `description`；路径由 manager 用 `path.join` 计算 | 验收面 = 工具 `parameters.properties` 的键集合（D-04 的硬约束来源）。name 格式单源逐字为 `const SKILL_NAME_RE = /^[a-z0-9-]+$/;` [VERIFIED: src/skill-picker-model.js:29]。D-06 的三条补充 = SDK 既有判据集，逐字见 Common Pitfalls 5（`skills.js:237-251` 的 `validateName`，含「长度 > MAX_NAME_LENGTH」/「首或尾为连字符」/「含连续连字符」三条 push） |
| MGMT-03 | 服务端对 name / description / 正文字节上限做二次校验（LLM 参数不可信）；写入走原子写（经沙箱 `env.renameFile` 获得双基准路径校验） | 沙箱双基准校验实测生效（E5 `permission_denied`）；原子替换实测成立（E3）；`createDir` 硬前置（E4）；三个上限同源值已核对（`LIMITS` + SDK 常量，逐字见 Common Pitfalls 5/6 与 Sources） |
| MGMT-04 | seeded 内置技能不可被 AI 覆盖或删除（按**播种登记表**判定，而非按目录位置） | 唯一数据源是 `getSeededSkillNames()`，其判定体逐字为 `if (!entry.isDirectory() \|\| entry.name.startsWith('.')) continue;` / `if (!fs.existsSync(path.join(srcDir, entry.name, 'SKILL.md'))) continue;` / `names.push(entry.name);` [VERIFIED: builtin-skills-seeder.js:92-110]。既有注入路径逐字见 Common Pitfalls 10（`getSeededSkillNamesSafe()` [VERIFIED: ai-manager.js:1532-1540]）。**测试必须直接注入 `seededNames`**（`Safe` 版在纯 Node 下经 catch 降级为 `[]`） |
| MGMT-05 | `manage_skill` 成功后刷新技能集与 Agent system prompt | 忙分支逐字为 `if (this.isProcessing \|\| (this.agent.state && this.agent.state.isStreaming)) {` → `this._skillsPromptDirty = true;` → `return;` [VERIFIED: ai-manager.js:2843-2846]；该分支**位于** `await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {` [VERIFIED: ai-manager.js:2835] **之后** ⇒ 外部不需再调 `refreshSkills()`；唯一补刷出口 `_flushDeferredSkillsPrompt()` 首行为 `if (!this._skillsPromptDirty) return;` [VERIFIED: ai-manager.js:2905-2919]，两处成功出口共享（`:1091` / `:1333`） |
| MGMT-06 | 工具描述引导 AI「优先增强已有技能，而非创建近乎重复的新技能」 | D-03 锁定的工具描述两条；描述文本由主进程单点产出，不改 `REALM_SYSTEM_PROMPT`（避免前缀缓存重建） |
</phase_requirements>

---

## Standard Stack

**本阶段不新增任何外部依赖。** 全部能力由仓库内既有模块 + 既有 SDK 提供。

### Core（既有，直接消费）

| 模块 / API | 版本 | 用途 | 为什么是它（而非自建） |
|------------|------|------|----------------------|
| `agent-workspace.createSandboxEnv()` | 仓库内 | 提供 `createTempFile` / `writeFile` / `createDir` / `renameFile` / `remove` / `exists` / `fileInfo` / `listDir` | 17 个 FileSystem 方法**全部**已包装（漏包一个就是逃逸口），本阶段**零新增路径校验代码** |
| `@earendil-works/pi-agent-core` `NodeExecutionEnv` | 0.84.3 | 沙箱包装的内层实现（`fs.promises.rename` / `mkdir` / `rm`） | 已装（`package.json` `dependencies`）；本阶段只经 `env` 间接使用 |
| `ai-skills-manager.js` | 仓库内 | 技能集单一数据权威 + D-11 的写入落点 | 零 electron 依赖 ⇒ 可单测、50/51 可直接 require（ROADMAP 安全门禁前提） |
| `builtin-skills-seeder.getSeededSkillNames()` | 仓库内 | seeded 身份唯一数据源（播种登记表） | 零状态文件、零硬编码（47 D-11）；**只读消费，本阶段零改动** |
| `ai-memory-manager.scanInjectionPatterns()` | 仓库内 | 注入 / 凭据形态扫描 | D-08 指定复用（P3 实测对内置技能零误伤）；**需一处最小改动**以支持字段分离 |
| `src/skill-picker-model.js` `TIER_BADGE` / `SKILL_NAME_RE` | 仓库内 | 三档徽标单源查表 + name 格式单源 | 48-01 建立的跨进程单源；renderer 与主进程共用 |

### Supporting

| 模块 | 用途 | 何时使用 |
|------|------|----------|
| `ai-manager.syncAgentSystemPrompt()` | 重扫 + prompt 回写 + 广播 | **唯一**刷新入口；成功后调**一次**（D-13） |
| `ai-manager._resolveManageSkillMarker()`（新增） | 工具卡片标记（start + end 两时点） | 工具事件生成侧；`tool_execution_start` / `tool_execution_end` |
| `windowManager.broadcast('skills:changed')` | 跨窗口通知 | 由 `syncAgentSystemPrompt()` 内部发出，本阶段**不新增调用** |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `env.renameFile` 原子写 | `env.writeFile(dest, content)` 直写 | **否决**：内层 `writeFile` 先 `mkdir` 再 `writeFile`，中途失败/崩溃留半成品文件（判据 4 失败）；且失去 rename 的 dest 双基准校验面 |
| `env.createDir` 判撞名 | 「createDir 失败即表示已存在」 | **实测否决**（E2）：`recursive` 默认 true ⇒ 已存在目录返回 `ok:true`，无法区分新建与已存在 |
| 直接 `require('builtin-skills-seeder')` 取 seeded 集合 | 由调用方注入 `seededNames` | **否决**：该模块经 `agent-workspace` 间接依赖 electron（`app.isPackaged`），破坏 manager 的零 electron 依赖纪律 |
| 新增 `skill-manager.js` 承载写入 | 写入落在 `ai-skills-manager.js` | **否决**：会造成「读权威 / 写权威」两份实现，正是本阶段排序要防的漂移 |
| `mem0` / 第三方技能管理库 | — | **不适用**：本阶段无外部依赖需求，引入即纯负担 |
| 给 `manage_skill` 加确认卡片 | 三动作一律自动 | **已由 D-01 锁定为「一律自动」**，不重新论证 |

**Installation:**

```bash
# 本阶段无新增依赖；无需 npm install
```

**Version verification（既有依赖，已核对）:**

```bash
node -e "console.log(require('./package.json').dependencies['@earendil-works/pi-agent-core'])"
# → ^0.84.3   （node_modules 实装版本 0.84.3，engines.node >=22.19.0；本机 node v22.22.0）
```

- `@earendil-works/pi-agent-core@0.84.3` —— `node_modules/@earendil-works/pi-agent-core/package.json` 实读确认。**升版复核点**：`harness/skills.js` 的 `validateName` / `validateDescription` 判据与 `MAX_*_LENGTH` 常量、`harness/env/nodejs.js` 的 `createDir`/`rename`/`remove` 语义、`agent-loop.js` 的 `createErrorToolResult` 形状。

---

## Package Legitimacy Audit

> **本阶段不安装任何外部包。** 因此无 `npm view` / 注册表核验面，Package Legitimacy Gate 的 Step 1–3 对本阶段**不适用**（无新增依赖 → 无 slopsquat / postinstall 风险面）。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| —（无新增） | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*已装依赖 `@earendil-works/pi-agent-core@0.84.3` 为 46–48 阶段既存、本阶段仅复用，不在本阶段引入。*

---

## Architecture Patterns

### System Architecture Diagram

```
                    AI 模型（LLM）
                         │  工具调用 manage_skill{action, name, content?, description?}
                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 主进程 · ai-manager.js                                                    │
│                                                                           │
│  _buildRealmTools()  ──►  工具项 { name:'manage_skill',                   │
│                             executionMode:'sequential',                   │
│                             execute(toolCallId, params) }                 │
│                                   │                                       │
│                                   │ 参数转发（只透传，不判定）            │
│                                   ▼                                       │
│                     ┌──────────────────────────────────────┐              │
│                     │ ai-skills-manager.js（写权威）        │              │
│                     │                                      │              │
│                     │ 校验器（纯函数，可被 50/51 require）  │              │
│                     │  name / description / 正文 / 净化     │              │
│                     │        ▼                             │              │
│                     │  scanInjectionPatterns（复用 memory） │              │
│                     │   ⚠ description 两组 / content 一组   │              │
│                     │        ▼                             │              │
│                     │  seeded 判定 ← seededNames（注入）     │              │
│                     │  撞名判定 ← env.exists（读盘）         │              │
│                     │  数量闸 ← LIMITS.MAX_MANAGED_SKILLS    │              │
│                     │        ▼                             │              │
│                     │  createManagedSkill /                 │              │
│                     │  updateManagedSkill /                 │              │
│                     │  deleteManagedSkill                   │              │
│                     └──────────────┬───────────────────────┘              │
│                                    │ env（沙箱）                          │
│                                    ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ agent-workspace.createSandboxEnv()  ← 只读消费，本阶段零改动       │    │
│  │  resolveInside 双基准 + realpath 复核                              │    │
│  │  createTempFile → <root>/.tmp/tmp-XXXX/  (同 root 同设备)          │    │
│  │  writeFile(tmp, 内容) → createDir(<root>/managed-skills/<name>)    │    │
│  │  renameFile(tmp, …/<name>/SKILL.md)   ← 原子替换 + dest 双基准校验 │    │
│  │  remove(<name>, {recursive:true})     ← delete / 失败清理          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│        失败 → throw（业务校验）      │  成功                                │
│         └──► err.code = 九码之一     │                                      │
│                                    ▼                                      │
│  ① 工具注册层捕获业务错误 → 按 toolCallId 存短期元数据（失败态 code/tier）│
│  ② 成功后一行 await this.syncAgentSystemPrompt()                         │
│       └─► 内部 refreshSkills() 重扫（:2835）                             │
│           └─► 忙时（isProcessing===true）→ _skillsPromptDirty = true，返回 │
│                                                                           │
│  本轮结束 · 成功出口（prompt() :1091 / promptWithContext() :1333）        │
│       └─► _flushDeferredSkillsPrompt()                                    │
│             └─► 检脏 → syncAgentSystemPrompt()（此刻 isProcessing===false）│
│                   └─► 真正回写 agent.state.systemPrompt + broadcast        │
│                       ('skills:changed')  ← 判据 1「下一条消息可见」       │
└───────────────────────────────────────────────────────────────────────────┘
                          │                                  │
       tool_execution_start/end 事件                  skills:changed 广播
                          ▼                                  ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 渲染进程 · src/renderer.js                                                │
│  tool_execution_start → toolExecution.manageSkill = {action, name}         │
│  tool_execution_end   → 并入 {tier?, code?, promptIncluded?}               │
│  renderToolCard() → 「创建/更新/删除技能「name」」+ TIER_BADGE 白名单徽标    │
│  skills:changed 监听 → 无条件重拉 state.aiSkills（/ 面板同步，48-06 已建） │
└───────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
（本阶段不新建目录 / 不新建模块文件；改动集中在既有 4 个文件 + 测试 + 文档）

ai-skills-manager.js        # D-11 写入落点：三动作 + 校验器 + 净化的唯一实现
ai-manager.js               # 工具注册（_buildRealmTools）+ 标记（_resolveManageSkillMarker）
                            #   + 成功后 syncAgentSystemPrompt()；重载链路标记重建
ai-memory-manager.js        # 唯一的外部改动：扫描函数加可选参（支持字段分离）
src/renderer.js             # renderToolCard 的 manage_skill 分支 + 事件字段合并
docs/product/ai-skills.md   # 新增「AI 自建技能」章节（含 D-05 诚实边界）
AGENTS.md                   # P8 触发点清单与测试清单同步
tests/                      # 新增断言组（见「Validation Architecture」）
```

### Pattern 1: 委托型工具（照抄 `memory` 工具）

**What:** 工具项只做参数转发与结果形态转换，业务逻辑全部委托给 manager；业务校验失败一律 `throw`。
**When to use:** 所有触及落盘 / 校验的 Realm 工具。
**Example:**

```js
// Source: ai-manager.js:5812-5884（memory 工具，逐字摘录关键行）
{
  name: 'memory',
  label: '写入记忆',
  description: '向持久记忆写入条目。action: add(新增)/replace(按编号改写)/remove(按编号删除)；…',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'replace', 'remove'], description: '写入操作类型' },
      // …
    },
    required: ['action', 'target'],
  },
  executionMode: 'sequential',
  execute: async (toolCallId, params) => {
    // … 参数解析 …
    const result = getAiMemoryManagerLazy().write({ action, target, /* … */ });
    return {
      content: [{ type: 'text', text: `已${actionLabel}${layerLabel}条目 ${result.entryId}。…` }],
      details: { budget: result.budget, remaining: result.remaining, entryId: result.entryId, target, containerId: resolvedContainerId },
    };
  },
},
```

**关键三要素**：① `executionMode: 'sequential'`（防同批次并发写）；② manager 业务失败 `throw` → SDK 转 `isError: true` toolResult → LLM 可见并自行修正；③ `details` 回传可操作信息。

### Pattern 2: 沙箱内原子写（D-12 的完整序列）

**What:** `createTempFile` → `writeFile(tmp)` → `createDir(dest)` → `renameFile(tmp, dest)`；失败即清理。
**When to use:** `create` 与 `update` 共用同一条路径。
**Example:**

```js
// Source: 本会话实跑验证的序列（/tmp/probe-writepath.cjs），输出见「实测证据索引」E1–E11
async function atomicWriteSkill(env, destFile, content) {
  const tmp = await env.createTempFile({ prefix: 'skill-', suffix: '.md' });
  if (!tmp.ok) throw makeErr('oversize' /* 或 unknown */, `临时文件创建失败：${tmp.error.message}`);
  const written = await env.writeFile(tmp.value, content);
  if (!written.ok) {
    await env.remove(tmp.value, { force: true });
    throw makeErr('unknown', `写入临时文件失败：${written.error.message}`);
  }
  const renamed = await env.renameFile(tmp.value, destFile);   // 原子替换，dest 逃逸被沙箱拒
  if (!renamed.ok) {
    await env.remove(tmp.value, { force: true });
    throw makeErr('unknown', `落盘失败：${renamed.error.message}`);
  }
}
```

**必须知道的三个实测约束：**
1. `createTempFile` 的 `suffix` 经 `sanitizeNamePart` **剥掉 `.`**（`'.md'` → `'md'`）—— 别指望临时文件名带正确扩展名（无影响，但别写依赖它的断言）。
2. `renameFile` 到**缺失父目录**返回 `not_found`（ENOENT）⇒ `create` 必须先 `createDir`；`update` 的目标目录必然已存在。
3. 每次调用留下**一个空 `tmp-XXXXXX/` 目录**在 `.tmp/` 下（`.tmp/` 不是技能扫描根，无功能影响，但会累积）。

### Pattern 3: 三档来源判定（`seededNames` 注入模式，48 D-14）

**What:** 判定函数消费调用方注入的集合，模块本身不解析随包目录。
**When to use:** D-11 的 `(env, { …, seededNames })` 签名。
**Example:**

```js
// Source: ai-skills-manager.js:684-688（sourceTierOf，逐字摘录）
function sourceTierOf(entry, seededNames) {
  if (entry.source === 'user') return 'user';
  const seeded = seededNames instanceof Set ? seededNames : new Set(seededNames || []);
  return seeded.has(entry.skill.name) ? 'builtin' : 'managed';
}
```

### Anti-Patterns to Avoid

- **给 `manage_skill` 加 `path` 参数**：模型即可写工作区内任何文件（含 `ai-memory/MEMORY.md`、`attachments/` 快照）—— ARCHITECTURE §Anti-Pattern 1 明文「沙箱在这里提供不了保护，接口设计才是边界」。（判据 2 / MGMT-02）
- **用 `env.createDir` 的返回值判撞名**：实测 `ok:true` 幂等（E2），据此判「不存在」会**静默覆写**已有技能（违反 D-07 独占创建）。
- **用缓存快照判撞名**：bash 可随时改盘（P8 第 6 条），缓存只反映上次重扫时刻；必须 `env.exists` 读盘（D-07 明文）。
- **成功后写 `refreshSkills()` + `syncAgentSystemPrompt()` 两行**：造成**三次**全量重扫（`refreshSkills` 内一次 + `syncAgentSystemPrompt` 内一次 + 出口补刷一次）；D-13 明文只调一次 ⇒ **两次**。
- **把校验器放进 `ai-manager.js`**：会让 Phase 50/51 无法 `require`（该模块顶层 require electron 依赖链），正是本阶段排序要防的校验逻辑漂移。
- **在渲染端按路径 / 名字自行判定来源档位或撞名**：48-03 硬约束「renderer 零路径字符串匹配」；renderer 只做 `TIER_BADGE` / `MANAGE_SKILL_ACTION_LABEL` / `MANAGE_SKILL_SHORT_REASON` 白名单查表。
- **失败态经 `result.details` 传 `code`**：SDK `createErrorToolResult` 产出的 `details` 恒为 `{}`（见下节硬事实 3），失败态的 `code` / `tier` **必须**走工具注册层的按-`toolCallId` 元数据转存。
- **`content` 跑 `CREDENTIAL_PATTERNS`**：会误伤合法技能里的配置示例（实测 `api_key: YOUR_KEY_HERE` 被判 unsafe）—— 正是 D-08 要避免的后果。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 路径安全校验（双基准 + realpath 复核） | 自己的 `startsWith(root)` 判定 | `agent-workspace.resolveInside()`（经沙箱 `env` 间接使用） | 需同时覆盖 `root` 与 `root` 的 realpath（macOS `/var`→`/private/var`）、`基准 + sep` 前缀（排除 `agent-workspace-evil`）、已存在路径的 symlink 二段式逃逸复核 —— 三处任一漏掉就是逃逸口 |
| 原子写 | `fs.writeFileSync` / `env.writeFile` 直写 | `env.createTempFile()` + `env.writeFile(tmp)` + `env.renameFile(tmp, dest)` | 直写中途失败留半成品；rename 才有 POSIX 原子替换 + dest 双基准校验 |
| SDK frontmatter 解析 | 自己写 YAML 剥头 / 正则切 `---` | 不解析——`manage_skill` **生成** frontmatter（`name` + `description` 两行），读取侧一律经 SDK `loadSkills` | 依赖纪律明文「不得直接引入 SDK 的传递依赖（其 frontmatter 解析与忽略文件匹配实现只经 SDK 往返获得）」 |
| 注入 / 凭据形态扫描 | 自己写关键词表 | `ai-memory-manager` 的 `INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS`（经 `scanInjectionPatterns`，**需扩参**） | P3 实测校准过（攻击语料全命中 + 良性语料零误伤），有 `test/memory/threat-scan.test.js` 双语料库护栏；自建第二份表 = 漂移 |
| name / description 格式规则 | 自己发明「合理的」规则 | SDK `validateName` / `validateDescription` 的既有判据集 | 本会话实读确认 SDK 的 `validateName` 已恰好包含 D-06 的四条（长度 64 / 正则 / 首尾连字符 / 连续连字符）；写侧校验器必须与它同集，否则产生的技能会被 SDK 判 warning（而 SDK 只警告不拒绝 ⇒ 幽灵技能进 prompt） |
| 技能集重扫 / prompt 回写 / 广播 | 自己的刷新链 | `syncAgentSystemPrompt()`（内部含 `refreshSkills()`） | 46-04 的函数体受源码扫描断言钉住（`tests/test-ai-skills.js:1300`），且已内建 digest+逐字符双重早退（保 provider 前缀缓存） |
| 忙时延后落地 | 自己排队 / 定时器 | `_skillsPromptDirty` + `_flushDeferredSkillsPrompt()` | 48-08 已交付的单一权威实现（检脏早退 / 复位 / 同步 / 失败恢复四件事只允许存在于该方法体内，源码门禁断言） |
| 工具卡片标记的渲染端实现 | renderer 内按名字猜 | 主进程 `_resolveManageSkillMarker` + renderer 白名单查表 | 48-03 硬约束；renderer 在 `file://` 无 `sandboxEnv`，拿不到权威路径 |

**Key insight:** 本阶段的技术风险**不在缺少原语**，而在**误用既有原语**。沙箱已提供全部 IO + 校验；刷新链已提供全部失效语义；扫描器已提供经校准的模式表。真正要新写的只有「三段薄逻辑」：① 校验器（判据 + 净化 + 扫描调用）；② 三动作的**编排**（撞名判定顺序、失败清理、限额预检）；③ 工具层的结果形态与失败态元数据转存。任何超出这三段的「自建」都是重复实现。

---

## Common Pitfalls

### Pitfall 1: D-08 的字段分离扫描在当前导出面下**不可实现**（阻塞级）

**What goes wrong:** 若照 CONTEXT 的 canonical_refs 字面「复用 `ai-memory-manager.scanInjectionPatterns`」并对 `content` 直接调它，则 `content` 会被 `CREDENTIAL_PATTERNS` 一并扫描 ⇒ **合法技能的配置示例被拒绝**（实测 `api_key: YOUR_KEY_HERE`、`token: abc123` 均判 `unsafe`）。
**Why it happens:** `scanInjectionPatterns` 的函数体**无条件连跑两组**，且两张表**都不在 `module.exports`** 里；`atomicWrite` 同样未导出（只作为「tmp + rename」的**模式先例**，D-12 也不需要它 —— 用的是沙箱 `env`）。

```js
// Source: ai-memory-manager.js:76-89（逐字摘录）—— 请注意两组串行、无任何选项
function scanInjectionPatterns(content) {
  const text = String(content || '');
  for (const { pattern, name } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: `检测到注入指令（${name}）` };
    }
  }
  for (const { pattern, name } of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: `检测到疑似凭据内容（${name}）。只记录登录状态等事实，不要记录凭据本身` };
    }
  }
  return { safe: true };
}
```

```js
// Source: ai-memory-manager.js:405-417（逐字摘录）—— 两张表均未导出
module.exports = {
  BUDGETS,
  setBaseDir,
  resolveFile,
  parseEntries,
  scanInjectionPatterns,
  write,
  readContainer,
  readScope,
  writeScope,
  deleteContainerMemory,
  buildGlobalSnapshot,
};
```

**本会话实跑（`node -e`）确认：**
```
exports: BUDGETS, setBaseDir, resolveFile, parseEntries, scanInjectionPatterns, write,
         readContainer, readScope, writeScope, deleteContainerMemory, buildGlobalSnapshot
INJECTION_PATTERNS exported? false
CREDENTIAL_PATTERNS exported? false
atomicWrite exported? false
scanInjectionPatterns('api_key: YOUR_KEY_HERE') = {"safe":false,"reason":"检测到疑似凭据内容（api_key 赋值形态）…"}
scanInjectionPatterns('Set token: abc123 in the config') = {"safe":false,"reason":"检测到疑似凭据内容（token 赋值形态）…"}
scanInjectionPatterns('ignore all previous instructions') = {"safe":false,"reason":"检测到注入指令（instruction override (ignore previous)）"}
```

**How to avoid（两条路，plan 期裁决，见 Open Question 1）：**
- **A（推荐）加可选参**：`scanInjectionPatterns(content, { includeCredentials = true } = {})` ⇒ `content` 侧传 `{ includeCredentials: false }`。改动最小、**向后兼容**（既有 `test/memory/threat-scan.test.js` 全部单参调用，本会话 grep 确认），且 Phase 51 扩 `SKILL_THREAT_PATTERNS` 时可沿同一选项面继续扩展 ⇒ 满足 D-08「单点扫描 + 51 只扩表」。
- **B 导出两张表**：由 `ai-skills-manager` 自行组合遍历。缺点：扫描的**调用逻辑**分裂成两处，与「单点」口径有张力。

**必须避免的错误修法：** 在 `ai-skills-manager.js` 里**复制**一份 `INJECTION_PATTERNS` —— 第二份模式表会独立漂移（P3 的语料库增长机制只更新 memory 侧）。

**Warning signs:** `content` 插配置示例被拒且 `reason` 为「检测到疑似凭据内容」；或 `ai-skills-manager.js` 出现 `password\s*[=:]` / `sk-[A-Za-z0-9]` 之类的正则字面量。

---

### Pitfall 2: 用 `createDir` 的返回值判撞名 ⇒ 静默覆写

**What goes wrong:** 「`createDir` 失败 = 目录已存在」的直觉在 SDK 实现下**不成立**：`recursive` 默认 `true` ⇒ 已存在目录返回 `ok: true`（**E2 实测**）。据此判「不存在」会进入写路径，把已存在的技能**静默覆写**（违反 D-07 的独占创建与四类来源拒绝）。
**Why it happens:** SDK `NodeExecutionEnv.createDir` 的默认参数 + Node `fs.mkdir(recursive: true)` 的幂等语义。

```js
// Source: node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:592-601（逐字摘录）
    async createDir(path, options) {
        const resolved = resolvePath(this.cwd, path);
        try {
            await mkdir(resolved, { recursive: options?.recursive ?? true });
            return ok(undefined);
        }
        catch (error) {
            return err(toFileError(error, resolved));
        }
    }
```

**实测证据：**
```
3.createDir.first      :: {"ok":true,"err":null}
4.createDir.EXISTING   :: {"ok":true,"err":null}
```

**How to avoid:** 撞名判定**一律**先 `env.exists(destDir)`（D-07 已明文），`createDir` 只负责建目录、不承担判定职责。同时 `create` 要用局部布尔标记「目录是本次建的吗」，失败清理时只删自己建的（见 Pitfall 9）。
**Warning signs:** 造同名技能后 `create` 仍成功；或断言「目录内容未变」红了。

---

### Pitfall 3: 失败态原因码经 `result.details` 传出 ⇒ 渲染端永远看不到

**What goes wrong:** SDK 在工具 `throw` 时走 `createErrorToolResult()`，产出的 `details` **恒为 `{}`** ⇒ 失败态的 `code` / `tier` 无法经 `details` 抵达渲染端。若只按 D-07 字面把原因码放进 `details`，`isError: true` 的卡片**永不显示短原因**。
**Why it happens:** SDK 的错误结果构造器不接受 details。

```js
// Source: node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:519-524（逐字摘录）
function createErrorToolResult(message) {
    return {
        content: [{ type: "text", text: message }],
        details: {},
    };
}
```

**How to avoid（49-UI-SPEC「硬约束 2」已给出契约）：** 业务校验失败**仍然 `throw`**（memory 工具语义不变，LLM 照常收到 `isError: true`），但**工具注册层**捕获业务错误对象上的 `code` / `tier`，转存为该次工具执行的元数据（推荐按 `toolCallId` 的短期 Map，读后即删），使成功与失败两条路径的**标记来源与形状逐字一致**（禁止「成功读 `details`、失败读别处」两套读法）。
**对 `details` 的准确理解：** `details` 在**成功**路径仍是原因码 / 可操作信息的正常载体（供 Phase 50/51 与测试消费）；失败路径的同等信息改走工具执行元数据。测试可对**抛出的错误对象**断言 `.code`（manager 级单测），对**工具执行元数据**断言（工具级测试）。
**Warning signs:** 失败卡片只有「失败」无短原因；或断言 `err.details.code === 'seeded_protected'` 得到 `{}`。

---

### Pitfall 4: 渲染端合并分支只并入三字段 ⇒ 徽标永不出现

**What goes wrong:** `tool_execution_start` 的 `{action, name}` 经**新条目分支**的 `...spread` 落到 `toolExecution`；但终态字段（`tier` / `code` / `promptIncluded`）在 `tool_execution_end` 到达时走**已存在条目分支**，该分支当前**只并入 `status` / `result` / `error`** ⇒ 终态字段被丢弃，徽标与短原因**永不出现**。
**Why it happens:** 48-03 的标记（`skillInvocation`）在 start 时打全、无需终态更新，既有合并分支从未需要并入标记字段。

```js
// Source: src/renderer.js:9347-9353（逐字摘录）
              // 更新已存在的工具执行状态
              toolMsg.toolExecutions[existingIdx] = {
                ...toolMsg.toolExecutions[existingIdx],
                status: event.status,
                result: event.result,
                error: event.error
              };
```

**How to avoid:** 在该合并分支追加终态标记字段的并入（49-UI-SPEC 硬约束 1）。start 只给 `action` / `name`，`tier` / `code` / `promptIncluded` **三项都必须在 end 更新**。
**Warning signs:** 运行中标题正确、完成后徽标不出现；对已完成卡片断言 `classList.contains('slash-picker-source-badge-managed')` 红了。

---

### Pitfall 5: 写侧预筛与加载期闸口不同源同值 ⇒ 幽灵技能

**What goes wrong:** 写入侧若允许 `description` 超 1024 字符或正文超 64 KiB 落盘，则**文件写成功了、技能却不在技能集里**：加载管线会把这类条目整条跳过，磁盘上留下一个永不生效的文件 —— 「幽灵技能」，用户与 AI 都看不到解释。
**Why it happens:** 加载期的两条闸都在**读侧**丢弃条目，写入侧没有预筛；两者数值不共享同一来源就必然分叉。

```js
// Source: ai-skills-manager.js:304-310（逐字摘录）—— description 不可用 → 整条跳过
function isDescriptionUnusable(d) {
  return (
    !!d &&
    d.code === 'invalid_metadata' &&
    /^description\b/.test(String(d.message || ''))
  );
}
```

```js
// Source: ai-skills-manager.js:161-183（逐字摘录，节选）—— 加载期字节闸
    async readTextFile(p, abortSignal) {
      if (path.basename(p) === 'SKILL.md') {
        const info = await sandboxEnv.fileInfo(p, abortSignal);
        if (info && info.ok && info.value.size > maxSkillMdBytes) {
          // SDK 为 ESM-only，包根动态 import（exports map 无子路径入口）
          const { FileError, err } = await import('@earendil-works/pi-agent-core');
          droppedNotices.push({
            path: p,
            kind: 'oversize_skill_md',
            limit: maxSkillMdBytes,
            currentValue: info.value.size,
          });
          // …
        }
      }
      return sandboxEnv.readTextFile(p, abortSignal);
    },
```

**How to avoid:** 写入侧预筛**必须**读同一常量 / 同一判据：
- **正文字节上限**：用 `LIMITS.MAX_SKILL_MD_BYTES`（写盘前 `Buffer.byteLength(content, 'utf8')` 比对；加载期按 `FileInfo.size` 计，**单位必须一致** ⇒ 都是 UTF-8 字节）。
- **`description` 上限**：对齐 SDK 的 `MAX_DESCRIPTION_LENGTH`（1024），但**不得在 `ai-skills-manager.js` 硬编码第二份字面量**（常量单源纪律）—— 建议作为新一项加入 `LIMITS` 并注释声明对齐关系（见 Open Question 2）。
- **name 判据**：即 SDK `validateName` 的四条（见下）。

```js
// Source: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:4-5（逐字摘录）
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
```

```js
// Source: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:237-251（逐字摘录）
function validateName(name, parentDirName) {
    const errors = [];
    if (name !== parentDirName)
        errors.push(`name "${name}" does not match parent directory "${parentDirName}"`);
    if (name.length > MAX_NAME_LENGTH)
        errors.push(`name exceeds ${MAX_NAME_LENGTH} characters (${name.length})`);
    if (!/^[a-z0-9-]+$/.test(name))
        errors.push("name contains invalid characters (must be lowercase a-z, 0-9, hyphens only)");
    if (name.startsWith("-") || name.endsWith("-"))
        errors.push("name must not start or end with a hyphen");
    if (name.includes("--"))
        errors.push("name must not contain consecutive hyphens");
    return errors;
}
```

> **重大发现（强化 D-06 的合理性）：** SDK 的 `validateName` **已经恰好包含 D-06 的三条补充**（长度 ≤64 / 无首尾连字符 / 无连续连字符）。因此 D-06 不是「发明了额外规则」，而是**把 SDK 已有的宽松判据提前到写入侧强制执行**。这使「写入门严 / 读入门宽」的不对称更清晰：写侧执行的是 SDK 自己的规则，读侧宽容是 46 D-08 的显式选择。plan 宜在注释 / 文档中明示这层关系（也解释了「D-06 与 46 D-08 不冲突」）。
>
> **且已确认这些判据在 SDK 侧只产 warning、不拒绝** [VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:220-222]：
> `for (const error of validateName(name, parentDirName)) { diagnostics.push({ type: "warning", code: "invalid_metadata", message: error, path: filePath }); }` —— 之后**照常返回 skill**（仅 `description` 为空才 `skill: null`，见同文件 `:223-224`）。这直接证明 D-06 的动机成立：超长 / 非法 name 会带着 warning 进入 system prompt，零拒绝。

**Warning signs:** 创建返回成功、`syncAgentSystemPrompt()` 也跑了，但 `getSkillsSnapshot()` 里找不到该技能；`_cache.diagnostics` 出现 `realm_skill_md_too_large` 或 `invalid_metadata`（message 以 `description` 开头）。

---

### Pitfall 6: 把 `MAX_MANAGED_SKILLS` 的统计对象搞错

**What goes wrong:** 若照抄 `MAX_USER_SKILLS` 的实现（只统计 `source === 'user'` 的条目），则 managed 技能**仍然完全不计数**，D-10 的创建闸形同虚设。
**Why it happens:** `MAX_USER_SKILLS` 的既有实现只统计 user 来源，且注释里给的理由是「managed 由应用自身投递」—— **那条理由在 49 落地后不再成立**（AI 也能投递 managed）。

```js
// Source: ai-skills-manager.js:568-572（逐字摘录）
    // ⑥ 数量上限：只统计 user 来源（managed 由应用自身投递，不计入用户配额）。
    //    超限条目标 overLimit 而**不剔除、不删文件** —— 数据层完整，只是不注入。
    const userEntries = _cache.skills.filter((e) => e.source === 'user');
    if (userEntries.length > LIMITS.MAX_USER_SKILLS) {
      for (const e of userEntries.slice(LIMITS.MAX_USER_SKILLS)) e.overLimit = true;
```

**How to avoid:** `MAX_MANAGED_SKILLS` 的统计对象 = **非 seeded 的 managed 技能数**。两条可实现判据（plan 期择一，都满足 D-10）：
- **判据 a（读盘，推荐）**：`create` 时对 `managed-skills/` 做 `env.listDir`，计「basename ∉ seededNames」的目录数。与 D-07 的「一律读盘」同款口径（bash 可随时改盘），不依赖缓存新鲜度。
- **判据 b（缓存）**：`_cache.skills.filter((e) => sourceTierOf(e, seededNames) === 'managed').length`。省一次 IO，但依赖缓存新鲜度 —— 与 D-07 的读盘纪律不一致。

> **两个闸的职责分工必须成文**（CONTEXT 明确要求）：数量闸（`MAX_MANAGED_SKILLS`）管**磁盘 / 重扫成本**；prompt 段预算闸（`LIMITS.SKILLS_PROMPT_CHAR_BUDGET = 8000`）管**请求成本**。二者不互相替代，且**不得用后者做创建拒绝**（48 D-12：超预算技能仍可显式调用、本身完全可用）。

**Warning signs:** 建成第 51 个 managed 技能仍返回成功；或测试「第 51 个被拒」因 seeded 也被计入而提前触发。

---

### Pitfall 7: 净化与扫描顺序颠倒 ⇒ 零宽字符变体绕过

**What goes wrong:** 净化是**变形**操作、扫描是**判定**操作。若先净化再扫描，被变形的输入已不是实际要落盘的内容 —— 零宽字符变体的注入措辞在净化（剥零宽）之后「看起来干净」，于是扫描放行。
**Why it happens:** 直觉上「先清洗再检查」更自然，但这里清洗恰好会擦掉要检测的痕迹。
**How to avoid:** 严格 `扫描(原文) → 通过后再净化(description) → 组装落盘`。`content` 不净化（D-09），故它只经扫描。
**Warning signs:** 测试用例「含零宽字符包裹的 `ignore all previous instructions`」在「先净化」实现下返回 `safe: true`。

---

### Pitfall 8: 把「刷新链」写成三处调用 / 断言错误的重扫次数 / 断言「工具返回时 prompt 已更新」

**What goes wrong:** ① 在工具里写 `refreshSkills()` + `syncAgentSystemPrompt()`（D-13 明文禁止 ⇒ **三次**全量重扫）；② 断言「工具返回时 `agent.state.systemPrompt` 已含新技能」—— 忙时语义下**必然失败**（这是设计而非缺陷）。
**Why it happens:** ROADMAP 判据 5 的字面「成功后刷新技能集与 Agent system prompt」易被读成两次调用；「下一条消息即对模型可见」易被读成「立即」。
**How to avoid:** 只调 `syncAgentSystemPrompt()` **一次**；按 V7 的时序断言（脏标记置位 → 出口回写 + 广播恰一次 + `rescanCalls === 2`）。既有 K1 用例（`tests/test-ai-skills.js:3184-3188`）已把「忙时重扫一次 + 出口补刷一次（不是 3）」写成断言范式，直接照抄口径即可。
**Warning signs:** 断言 `rescanCalls === 3`；或工具级测试断言工具返回时 prompt 已更新。

---

### Pitfall 9: 失败清理误删「本次未创建的目标目录」

**What goes wrong:** `create` 的失败清理若无条件 `env.remove(<name>, { recursive: true })`，在「目录本就存在」这条路径上会删掉不属于本次操作的数据。
**How to avoid:** 清理只在 `create` 路径且**本次确实新建了目录**时执行（局部布尔标记）；`update` 失败**不得**删除目标目录（其内容应保持操作前状态 —— `rename` 的原子替换天然保证这点）。
**Warning signs:** 「`update` 失败后技能消失」；`F3.noHalfProduct` 型断言（操作前后目录列表逐字相等）在拒绝路径上失败。

---

### Pitfall 10: 测试 seeded 保护时走了纯 Node 下必然降级的路径

**What goes wrong:** 若测试经 `ai-manager.getSeededSkillNamesSafe()` 取 seeded 集合，纯 Node 下 `require('electron')` 返回字符串、`app` 为 `undefined` ⇒ TypeError ⇒ 被 catch 降级为 **`[]`** ⇒ seeded 保护**完全不生效**：本该被拒的操作成功了（红），或若断言写成「创建成功」则**假绿**。
**Why it happens:** 设计上的 fail-safe 降级，其 JSDoc 明文承认「降级为空集合的后果是内置技能被标成托管（错标）」。

```js
// Source: ai-manager.js:1532-1540（逐字摘录）
  getSeededSkillNamesSafe() {
    try {
      const names = getBuiltinSkillsSeederLazy().getSeededSkillNames();
      return Array.isArray(names) ? names : [];
    } catch (err) {
      console.warn('[Realm AI] 读取随包内置技能名失败（seeded 判定降级为空集合）:', err.message);
      return [];
    }
  }
```

**How to avoid（两条，可并用）：**
- **manager 级单测**：直接向 `createManagedSkill(env, { …, seededNames: ['find-skills', 'skill-creator'] })` 注入显式数组 —— 这正是 D-11 签名设计的目的，且完全绕开 electron。
- **走真实 seeder 的集成断言**：`builtin-skills-seeder.setBuiltinDepsForTest({ srcDir: <临时源目录> })` 可使 `getSeededSkillNames()` **不触达 electron**（`resolveBuiltinSkillsSrc()` 首行即 `if (_srcDirOverride) return _srcDirOverride;`），从而在纯 Node 下返回真实集合。既有 `tests/test-ai-skills.js:28-29` 已用 `REAL_BUILTIN_SRC = path.join(REPO_ROOT, 'skills-builtin')` 做同一手法的 srcDir 覆写。

**Warning signs:** 测试输出出现 `console.warn('[Realm AI] 读取随包内置技能名失败…')`；或 seeded 保护用例仅在 `npm run dev` 手工验证时绿。

---

### Pitfall 11: 卡片标记在重载链路缺失 ⇒ 重开对话后卡片形状不一致

**What goes wrong:** 实时链路打了标记，但重开对话时 `getConversationMessages()` 只重建 `read` 标记，于是历史卡片退化为普通 `manage_skill` 卡片 —— 违反 48-03 建立的「实时 vs 重载键集合逐字相等」纪律（49-UI-SPEC 硬约束 3）。
**Why it happens:** 重载链路是**第二处**打标记的地方，容易被漏。
**How to avoid:** 在 `getConversationMessages` 的既有重建循环内同址重建 `manage_skill` 标记（参数已在 `t.params` 中持久化），并让终态元数据随显示形状回传（`ai-conversations-manager.getMessages` 的 toolResult 回填处已解析 `{toolCallId, toolName, isError, details}`，`tool_results` 列已持久化 details）。
**Warning signs:** 实时卡片有徽标、重开对话后没有；或重载卡片键集合与实时卡片不等。

---

## Code Examples

Verified patterns from the repository. 以下片段均为**本会话实读源文件的逐字摘录**，行号可核；数值型断言以实测输出为准。

### 忙时语义链（D-13 的唯一权威入口与唯一出口）

```js
// Source: ai-manager.js:2831-2859（逐字摘录）
  async syncAgentSystemPrompt() {
    if (!this.agent || !this.sandboxEnv) return;

    // 重新扫描两个技能目录（磁盘可能被模型经 write/bash 直接改写）
    await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
      disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
      rootDirs: [
        getAgentWorkspaceLazy().getManagedSkillsDir(),
        getAgentWorkspaceLazy().getSkillsDir(),
      ],
    });

    if (this.isProcessing || (this.agent.state && this.agent.state.isStreaming)) {
      this._skillsPromptDirty = true;
      return;
    }

    const snap = getAiSkillsManagerLazy().getSkillsSnapshot();
    const next = buildSystemPrompt();
    // digest 是快速判定主键、逐字符比对是二次确认 —— 两者一致才认定「无变化」
    if (snap.digest === this._skillsPromptDigest && this.agent.state.systemPrompt === next) return;

    // 先记录已应用的摘要，再改写 prompt（顺序不可调换：中途抛错时摘要不应超前）
    this._skillsPromptDigest = snap.digest;
    this.agent.state.systemPrompt = next;

    // 只在真正改写了 prompt 的路径上广播（本阶段只发事件，消费方在 Phase 48/50）
    windowManager.broadcast('skills:changed');
  }
```

> **三条已核实的 D-13 前提（行号可核）：** ① `refreshSkills` **确实已在本函数内调用**（`:2835`）—— 外部不需再调；② 忙分支**位于重扫之后**（`:2843-2846`）⇒ 忙时**缓存已被更新**（`getSkillsSnapshot()` 立刻能查到新技能），只有 prompt 回写与广播被推迟 —— 这正是 `tier` / `promptIncluded` 能在工具终态判定的原因；③ 早退边界 `!this.agent || !this.sandboxEnv` 在函数首行（`:2832`）。

```js
// Source: ai-manager.js:2905-2919（逐字摘录）
  async _flushDeferredSkillsPrompt() {
    if (!this._skillsPromptDirty) return;

    this._skillsPromptDirty = false;
    try {
      await this.syncAgentSystemPrompt();
    } catch (err) {
      // 失败恢复脏标记：下一次成功出口重试，避免变更被静默丢弃（WR-04）
      this._skillsPromptDirty = true;
      console.warn(
        '[Realm AI] 延迟刷新技能 prompt 失败（将于下次成功出口重试）:',
        err && err.message ? err.message : String(err)
      );
    }
  }
```

**两处成功出口（全仓恰 2 处）：**

```js
// Source: ai-manager.js:1084-1091（逐字摘录）—— prompt() 的成功出口
        await this.agent.prompt(enhanced);
        await this.agent.waitForIdle();
        this.isProcessing = false;

        // 延迟补刷（G-48-18）：renderer 只在「有 @ 引用或附件」时才走 promptWithContext()，
        // 常规 /skill:<name>、重新生成、错误重试都走本方法 —— 这里是延迟回写在纯文本通道上的
        // 落地点。补刷自身检脏早退，故普通消息零成本。
        await this._flushDeferredSkillsPrompt();
```

```js
// Source: ai-manager.js:1329-1333（逐字摘录）—— promptWithContext() 的成功出口
      this.isProcessing = false;

      // 延迟补刷（G-48-18）：唯一实现见 _flushDeferredSkillsPrompt()；**成功出口**是唯一的补刷点
      // （错误出口与 _cleanupCurrentAgent() 不补，避免同一次运行双刷）。补刷自身检脏早退。
      await this._flushDeferredSkillsPrompt();
```

> **关键时序事实（判据 1 的验收基础）：** 两处出口都**先** `isProcessing = false`（`:1086` / `:1329`）**再**调用补刷（`:1091` / `:1333`）。`waitForIdle()` / 轮结束也已使 `agent.state.isStreaming` 为假 ⇒ 补刷内的 `syncAgentSystemPrompt()` **走非忙分支**，真正改写 `agent.state.systemPrompt` 并广播。因此「新技能集在下一条消息即对模型可见」的准确语义是：**本次轮结束时就已回写，下一条消息当然可见**。
>
> **重扫次数账（必须照此断言）：** 工具执行 → `syncAgentSystemPrompt()` = 重扫 #1（忙，置脏）；轮成功出口 → `_flushDeferredSkillsPrompt()` → `syncAgentSystemPrompt()` = 重扫 #2（非忙，回写 + 广播）。**共 2 次**。既有 K1 用例已钉住同一口径：

```js
// Source: tests/test-ai-skills.js:3184-3188（逐字摘录）
    assert.strictEqual(
      ctx.rescanCalls,
      2,
      '忙时重扫一次 + 出口补刷一次（不是 3 —— 证明没有双刷）'
    );
```

### 工具注册落点与数组尾部

```js
// Source: ai-manager.js:5926-5931（逐字摘录）—— manage_skill 应插在 `...this._buildFilesystemTools(),` 之前
      },

      // ==================== SDK 内置文件/Bash 工具（agent 工作区沙箱） ====================
      ...this._buildFilesystemTools(),
    ];
  }
```

### 工具卡片标记：主进程侧（`read` 工具先例，`manage_skill` 照此扩写）

```js
// Source: ai-manager.js:1751-1766（逐字摘录）
        case 'tool_execution_start': {
          console.log(`[Realm AI] 工具调用: ${event.toolName}`, JSON.stringify(event.args || {}));
          sendNow({
            type: 'tool_execution_update',
            tool_execution_id: event.toolCallId,
            tool_name: event.toolName,
            status: 'running',
            params: event.args,
            // 48-03（D-15）：read 工具读取技能正文时的展示标记。只能在这里打 ——
            // 本处是**同步**上下文而匹配可同步完成（缓存 filePath 是内存数据）；
            // tool_execution_end 不带 params，标记错过 start 就没有第二次机会；
            // renderer 的更新分支用 ...spread 保留既有字段，标记在后续状态更新中自然留存。
            // 非技能 read / 非 read 工具 / 非法参数 → null（渲染普通卡片，零回归）。
            skill_invocation: this._resolveSkillMarker(event.toolName, event.args),
          });
          break;
        }
```

```js
// Source: ai-manager.js:1683-1691（逐字摘录）
  _resolveSkillMarker(toolName, args) {
    if (toolName !== 'read' || !args || typeof args.path !== 'string') return null;
    const root = this.sandboxEnv && this.sandboxEnv.cwd;
    if (!root) return null;
    const abs = path.isAbsolute(args.path) ? path.resolve(args.path) : path.resolve(root, args.path);
    if (path.basename(abs) !== 'SKILL.md') return null;
    return getAiSkillsManagerLazy().matchSkillByPath(abs, this.getSeededSkillNamesSafe());
  }
```

> **`manage_skill` 无法复用 `matchSkillByPath`**：那个函数按**文件路径**全量比较 `_cache.skills[i].skill.filePath`，而 `manage_skill` 只有 `name`。需要一个**按 name 的**判定（`seededNames.has(name)` → `builtin`；否则按 name 查缓存条目得 `source`：`user` → `user`、`managed` → `managed`）。注意 `create` 的新技能在 **start** 事件时**尚不存在**于缓存 ⇒ start 只给 `{action, name}`，`tier` 留到 end（49-UI-SPEC 时序契约已明确规定）。

### 渲染端事件字段映射（新条目分支）与合并分支

```js
// Source: src/renderer.js:9355-9365（逐字摘录）
              toolMsg.toolExecutions.push({
                id: event.tool_execution_id,
                name: event.tool_name,
                status: event.status,
                params: event.params,
                result: event.result,
                error: event.error,
                // 48-03（D-15）：主进程在 start 事件打好的技能标记（snake_case，与
                // tool_execution_id / tool_name 同款）。后续状态更新走 ...spread 保留。
                skillInvocation: event.skill_invocation
              });
```

### 卡片渲染的技能变体分支（`manage_skill` 的落点）

```js
// Source: src/renderer.js:9571-9598（逐字摘录）
  // 工具名称（execute_action 显示具体 action；技能读取变体显示技能化标题）
  const name = document.createElement('span');
  name.className = 'tool-card-name';
  const skillInvocation = toolExecution.skillInvocation;
  if (skillInvocation && skillInvocation.name) {
    // 48-03（D-15）：模型按 description 自动匹配并 read 技能正文时把卡片标题技能化。
    // 判定已在工具事件生成侧完成（主进程），此处**不**按路径字符串自行匹配。
    name.classList.add('tool-card-name-skill');
    const nameText = document.createElement('span');
    nameText.className = 'tool-card-name-text';
    nameText.textContent = `使用技能「${skillInvocation.name}」`;
    name.appendChild(nameText);
    const badge = window.SkillPickerModel.TIER_BADGE[skillInvocation.tier];
    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'slash-picker-source-badge ' + badge.className;
      badgeEl.textContent = badge.label;
      badgeEl.title = badge.title;
      name.appendChild(badgeEl);
    }
  } else if (toolExecution.name === 'execute_action' && toolExecution.params?.action) {
    name.textContent = `execute_action (${toolExecution.params.action})`;
  } else {
    name.textContent = toolExecution.name;
  }
```

**可复用片段：** 徽标构造三行（`className` 拼接 + `textContent` + `title`）**逐字可复用**；`manage_skill` 只需换标题文案（动作标签走 49-UI-SPEC 的 `MANAGE_SKILL_ACTION_LABEL` 白名单）并复用同一 `TIER_BADGE` 查表。标记字段为 `manageSkill`（49-UI-SPEC 数据契约），与 `skillInvocation` 并列 ⇒ `if` 链需新增一个分支。

### 三档徽标单源（renderer 白名单查表对象）

```js
// Source: src/skill-picker-model.js:324-340（逐字摘录）
  const TIER_BADGE = Object.freeze({
    user: Object.freeze({
      label: '用户',
      className: 'slash-picker-source-badge-user',
      title: '用户技能（agent-workspace/skills/），同名时优先于内置与托管',
    }),
    builtin: Object.freeze({
      label: '内置',
      className: 'slash-picker-source-badge-builtin',
      title: '随包内置技能，每次启动自愈播种',
    }),
    managed: Object.freeze({
      label: '托管',
      className: 'slash-picker-source-badge-managed',
      title: '托管技能（AI 自建，存于 managed-skills/）',
    }),
  });
```

### 沙箱双路径校验（判据 4 / MGMT-03 的机制本体）

```js
// Source: agent-workspace.js:277-284（逐字摘录）
    async renameFile(sourcePath, destinationPath, abortSignal) {
      // 双路径分别校验：destination 逃逸 = 写逃逸
      const blockedSrc = guardResult(sourcePath);
      if (blockedSrc) return blockedSrc;
      const blockedDst = guardResult(destinationPath);
      if (blockedDst) return blockedDst;
      return inner.renameFile(sourcePath, destinationPath, abortSignal);
    },
```

```js
// Source: agent-workspace.js:338-352（逐字摘录）—— createTempFile 重定向 .tmp/
    async createTempFile(opts = {}) {
      try {
        const safePrefix = sanitizeNamePart(opts.prefix);
        const safeSuffix = sanitizeNamePart(opts.suffix);
        const dir = await fs.promises.mkdtemp(path.join(getTmpDir(), 'tmp-'));
        const file = path.join(
          dir,
          `${safePrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeSuffix}`
        );
        await fs.promises.writeFile(file, '');
        return ok(file);
      } catch (e) {
        return err(new FileError('unknown', `创建临时文件失败: ${e.message}`));
      }
    },
```

```js
// Source: agent-workspace.js:231（逐字摘录）—— 后缀被剥掉 `.` 的原因
  const sanitizeNamePart = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
```

### SDK 层：`renameFile` / `remove` 的真实语义

```js
// Source: node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:524-537（逐字摘录）
    async renameFile(sourcePath, destinationPath, abortSignal) {
        const source = resolvePath(this.cwd, sourcePath);
        const destination = resolvePath(this.cwd, destinationPath);
        const aborted = abortResult(abortSignal, destination);
        if (aborted)
            return aborted;
        try {
            await rename(source, destination);
            return ok(undefined);
        }
        catch (error) {
            return err(toFileError(error, source));
        }
    }
```

```js
// Source: node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:602-611（逐字摘录）
    async remove(path, options) {
        const resolved = resolvePath(this.cwd, path);
        try {
            await rm(resolved, { recursive: options?.recursive ?? false, force: options?.force ?? false });
            return ok(undefined);
        }
        catch (error) {
            return err(toFileError(error, resolved));
        }
    }
```

> **注意 `remove` 的默认值是 `recursive: false` / `force: false`** ⇒ `delete` 与失败清理都**必须显式传 `{ recursive: true }`**；目标不存在时（无 `force`）返回 `not_found`（E8 实测）—— 因此 `delete` 要么先 `exists` 判定（D-07 已要求），要么传 `{ recursive: true, force: true }`。

### 扫描与「业务校验失败一律 throw」语义

```js
// Source: ai-memory-manager.js:234-239（逐字摘录，节选）—— 照抄的语义先例
    // 威胁扫描（D-11）：参数组合校验之后、预算校验之前；add 与 replace 的
    // content 均过扫描，remove 无内容不扫。命中 throw → isError:true toolResult
    const scan = scanInjectionPatterns(content);
    if (!scan.safe) {
      throw new Error(`记忆写入被拒绝：${scan.reason}。请调整措辞后重试`);
    }
```

> 命中即 **`throw`**（不是返回错误对象），消息里带可读原因 + 可操作提示；由 SDK 转成 `isError: true` 的 toolResult 回给 LLM。

### 完整原子写序列（本会话实跑验证，输出见 E1–E11）

```js
// Source: /tmp/probe-writepath.cjs（实跑通过）
async function atomicWriteSkill(env, destFile, content) {
  const tmp = await env.createTempFile({ prefix: 'skill-', suffix: '.md' });
  if (!tmp.ok) throw new Error(`临时文件创建失败：${tmp.error.message}`);
  const written = await env.writeFile(tmp.value, content);
  if (!written.ok) {
    await env.remove(tmp.value, { force: true });
    throw new Error(`写入临时文件失败：${written.error.message}`);
  }
  const renamed = await env.renameFile(tmp.value, destFile);   // 原子替换；dest 逃逸被沙箱拒
  if (!renamed.ok) {
    await env.remove(tmp.value, { force: true });
    throw new Error(`落盘失败：${renamed.error.message}`);
  }
}
```

**必须知道的三个实测约束：** ① `createTempFile` 的 `suffix` 经 `sanitizeNamePart` **剥掉 `.`**（`'.md'` → `'md'`），临时文件名不带正确扩展名（无功能影响）；② `renameFile` 到**缺失父目录**返回 `not_found`（E4）⇒ `create` 必须先 `createDir`，`update` 的目标目录必然已存在；③ 每次调用在 `.tmp/` 留下**一个空 `tmp-XXXXXX/` 目录**（E12；`.tmp/` 非扫描根，无功能影响但会累积）。

---

## Runtime State Inventory

> 本阶段是**新增功能**（非 rename / refactor / migration），按规则此节可省略。但判据 3「按播种登记表判定」与判据 4「不触及其它工作区路径」都涉及**磁盘既有状态**，故保留一节读取面清单。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `agent-workspace/managed-skills/<name>/SKILL.md`（AI 可写）；`agent-workspace/skills/<name>/SKILL.md`（用户目录，**本阶段绝不写**）；`agent-workspace/ai-memory/` 与 `attachments/`（判据 4 的保护对象） | 无数据迁移；只新增写入者，不改既有数据 |
| Live service config | None —— verified by：本应用无外部服务 / 无 UI 侧配置库（`electron-store` 的 `settings.aiSkills.disabled` 本阶段只读） | None |
| OS-registered state | None —— verified by：`grep` 全仓无 `launchd` / `systemd` / Task Scheduler 注册代码 | None |
| Secrets/env vars | None —— verified by：本阶段不新增环境变量；`settings.aiSkills.disabled` 为既有键（只读） | None |
| Build artifacts | None —— verified by：本阶段不新增随包内容，`skills-builtin/**` 的 `asarUnpack` 与 `THIRD_PARTY_NOTICES.md` 五要素由 Phase 47 已就位 | None |

**The canonical question（对判据 4）**：*写入操作完成后，工作区里除 `managed-skills/<name>/` 之外还有哪些路径被触及？* 实测答案：`<WS>/.tmp/tmp-XXXXXX/`（每次原子写留下一个空目录，E12）。`.tmp/` **不是技能扫描根**（`rootDirs` 只有 `managed-skills` 与 `skills`），因此无功能影响，但会随使用累积。`ai-memory/`、`attachments/`、`skills/` 在实测中均未被触及（E11）。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 沙箱内 `fs` 直接 `writeFileSync` + `renameSync`（`ai-memory-manager.atomicWrite` 的形态） | 沙箱 `env.createTempFile` + `env.writeFile` + `env.renameFile` | Phase 46（沙箱落地） | 每次 IO 都过 `resolveInside` 双基准 + realpath 复核；`ai-memory-manager.atomicWrite` **未导出**且不适用于技能域（它绕过沙箱判据）—— 本阶段只照抄其**模式**，不复用它 |
| 各自写一份工具级参数校验 | 校验器收进 `ai-skills-manager.js`，由 `manage_skill`（49）与导入管线（51）共用 | Phase 49（本阶段） | ROADMAP 安全门禁明文「本阶段产出的校验器是 50/51 唯一可复用的那一份」；先做其它写入路径极易写出第二份 |
| `syncAgentSystemPrompt()` 无生产调用方（`STATE.md:246` ⚠️） | 48 加了**读侧**调用方（`refreshSkillsForPanel`）；**写侧**第一个调用方是本阶段 | Phase 48 → 49 | 该 ⚠️ **只在 49/50/51 三者都落地后才算闭合**；49 只完成 1/3 —— **不得声称 P8 失效链 6/6 全覆盖** |
| 「技能集变更后立即生效」的朴素理解 | 忙时置脏 → 本轮成功出口补刷 | Phase 48（48-08 / G-48-18） | 判据 1 的验收断言点必须落在「脏标记 → 出口回写 + 广播」，**不是**「工具返回时 prompt 已更新」 |

**Deprecated/outdated:**
- **「沙箱可保护技能目录」的思路**：D-05 已否决（`exec` 不校验命令内容 ⇒ 结构上不可能完整），且 46 D-08 的读侧宽松与之冲突。不要用只读挂载或第二个 sandbox root 表达「AI 不可删改内置技能」。
- **`ai-memory-manager.atomicWrite`**：本阶段**不导出、不复用**；只在文档/注释里作为「tmp + rename」模式先例引用。
- **`scanInjectionPatterns` 的单参调用形态**：对 `content` 场景不适用（见 Pitfall 1）；对 `description` 场景**可直接用**。

---

## Assumptions Log

> 下表 5 条均为 `[ASSUMED]`（未在本会话验证、需 plan 期或用户确认的**设计级**判断）。其余全部研究结论的标签分布：`[VERIFIED: …]` 8 处（本会话读盘 + 实跑），`[CITED]` 0 处（无引用的外部文档；本报告未访问任何仓库外资源）。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 `[ASSUMED]` | `create` / `update` / `delete` 的内部实施顺序（先校验 → 后撞名判定 → 后扫描 → 后落盘）不违反任何未读到的项目约定 | Common Pitfalls / Code Examples | 低 —— 顺序由 D-06/D-07/D-08/D-09 共同决定，plan 期可自由编排内部次序 |
| A2 `[ASSUMED]` | `.tmp/` 下累积的空临时目录**不需要**在本阶段清理 | Runtime State Inventory | 低 —— `.tmp/` 非扫描根（`rootDirs` 只有 `managed-skills` 与 `skills`）；若 plan 认为需清理，`createTempFile` 的父目录可由调用方 `env.remove(path.dirname(tmp), { recursive: true })` 顺带清掉（该目录由 `mkdtemp` 创建，清理安全；但**不得**删 `.tmp/` 本身） |
| A3 `[ASSUMED]` | `promptIncluded` 的判定口径（UI-SPEC 给出的「当前已入选条目成本 + 新条目边际成本 ≤ 预算」）与加载管线 `entryCost` 实现在**数值上等价** | Pitfall 5 / UI-SPEC 引用 | 中 —— 若不等价，徽标标注可能与实际 prompt 段不一致。**建议 plan 期把该判定做成可被两侧共用的纯函数**，而不是在工具层重写一份边际成本计算（46-02 的 `entryCost` 公式出错即是此类事故：计划文本里的公式必须独立验算） |
| A4 `[ASSUMED]` | 49-UI-SPEC 的 `toolExecution.manageSkill`（camelCase）对应的事件字段为 snake_case `manage_skill`（与 `skill_invocation` → `skillInvocation` 同款命名法） | Code Examples | 低 —— UI-SPEC 只给出渲染端形状；事件字段名由 plan 期定，但**必须**与 `tool_execution_id` / `tool_name` / `skill_invocation` 的 snake_case 一致 |
| A5 `[ASSUMED]` | `update` 的 `content` 为**完整新正文**；若 AI 传入的 `content` 本身含 `---` frontmatter 块，服务端应剥除而非双重包裹 | Pitfall 5 / Code Examples | 中 —— 不剥除会产生双层 `---` 头，SDK 解析结果不确定（可能 `parse_failed` → 幽灵技能）。**建议 plan 期显式定义「content 含 frontmatter 时的处理」**：推荐**静默剥除**并在工具描述写明「content 不含 frontmatter」（D-07 的九码里没有 `invalid_content`，故不引入新码） |

**If this table is empty:** 不适用 —— 见上表 5 条，其中 **A3 / A5 建议 plan 期显式拍板**。

---

## Open Questions

1. **D-08 的字段分离扫描如何实现（阻塞级）**
   - What we know: `ai-memory-manager.js` 只导出 `scanInjectionPatterns(content)`，该函数无条件连跑两组；两张表均未导出（本会话 `require` 实测）；`atomicWrite` 同样未导出。
   - What's unclear: 采「加可选参」（推荐 A）还是「导出两张表」（B）。两者都能满足 D-08，代价不同。
   - Recommendation: **A**。理由：改动最小（函数体两行 + 一处默认值）、向后兼容（既有单参调用零影响，本会话 grep 确认 `test/memory/threat-scan.test.js` 全部单参）、Phase 51 扩 `SKILL_THREAT_PATTERNS` 时可继续沿同一选项面扩展（满足 D-08「单点扫描 + 51 只扩表」）。**须在 plan 中把 `ai-memory-manager.js` 列为显式改动文件**（CONTEXT 的 Integration Points 当前只写了「无需改 `ai-memory-manager.js`」，与事实不符）。

2. **`description` 上限（1024）的常量归属**
   - What we know: SDK `skills.js:5` 有 `MAX_DESCRIPTION_LENGTH = 1024`；`ai-skills-manager.js` 的 `LIMITS` 当前只有三项，且被源码扫描断言钉住「三限额单源齐全」（`tests/test-ai-skills.js:1192-1203`）。
   - What's unclear: 是在 `LIMITS` 加第四项（`MAX_SKILL_DESCRIPTION_CHARS`）还是引用 SDK 常量（SDK 不导出该常量 —— 它只是模块内 `const`）。D-10 明文「只允许在 `LIMITS` 内新增一项」是指数量闸那一项，未说不能加 description 项。
   - Recommendation: 在 `LIMITS` 加一项，注释里写明「与 SDK `harness/skills.js:5` 的 `MAX_DESCRIPTION_LENGTH` 对齐，升版须复核」。既遵守常量单源（防止写入侧与加载期分叉），也不破坏既有三项的断言（该断言只 `includes` 三条字面量，**加项不转红**）。

3. **测试文件组织**
   - What we know: `tests/test-ai-skills.js` 已达 **3286 行 / 147 例**（本会话实跑 `# pass 147`）；本阶段可复用的夹具（`withTempRoot` / `writeSkill` / `setupSkillsEnv` / `scanRoots` / K 组 `promptCtx` / H 组 `markerCtx`）**全部是文件内局部定义**，新文件需自带副本。
   - What's unclear: 新增 `tests/test-manage-skill.js` 还是并入既有文件。
   - Recommendation: **新建 `tests/test-manage-skill.js`** 承载 manager 级单测（校验器七种非法 name / description 超长 / 正文超 64 KiB / 四类撞名 / seeded 三入口保护 / 原子性与清理 / 越界 / 字段分离扫描 / 扫描-净化顺序 / `MAX_MANAGED_SKILLS` 到顶）—— 该域有独立的输入空间与失败矩阵，且新文件可自带最小夹具（`withTempRoot` + `createSandboxEnv` + 显式 `seededNames` 注入，约 30 行，无需复制 `promptCtx`）。**同时**在 `tests/test-ai-skills.js` 补**接线类**断言（`manage_skill` 工具项 schema 键集合 = 判据 2 / 标记重建 / 出口补刷链）—— 因为这些断言依赖该文件的 `readSource` / `methodBody` 源码扫描基建与 K/H 组夹具。
   - **理由要点**：判据 2 的验收面（工具 `parameters.properties` 键集合）与判据 1（刷新链）是**接线断言**，天然属于 `test-ai-skills.js`；而写入侧的值域矩阵是**新域**，独立文件更清晰。

4. **`content` 内含 frontmatter 的处理（见 Assumptions A5）**
   - Recommendation: 静默剥除（宽容），工具描述写明「`content` 只含正文，不含 frontmatter」。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 全部（含纯 Node 单测） | ✓ | v22.22.0 | — （SDK `engines.node` 要求 `>=22.19.0`） |
| `@earendil-works/pi-agent-core` | 沙箱 env / SDK 技能加载 | ✓ | 0.84.3（`node_modules` 实装） | — |
| Electron | 主进程运行时（`app.getPath`）；**纯 Node 单测不需要** | ✓（devDependency） | ^43.6.0 | 测试经 `setWorkspaceDir()` 覆写绕开 electron |
| 测试运行器 | 单测 | ✓ | `node:test`（内置，零安装） | — |
| `package.json` 的 `npm test` 脚本 | GSD 门禁 | ✗ | — | **本项目无 `test` 脚本**（`package.json` 只有 `test:pre-release` / `test:memory` / `validate`）⇒ 计划中的验证命令必须写成 `node tests/<file>.js` 显式路径，**不得**引用 `npm test`（该项目两 gate 恒解析成不存在的 `npm test` 是已记录的环境问题） |

**Missing dependencies with no fallback:** None —— 本阶段无外部依赖需求。

**Missing dependencies with fallback:**
- `npm test`：不存在。**所有验证命令必须写成 `node tests/test-manage-skill.js` / `node tests/test-ai-skills.js` 的显式形式**（与 `docs/product/ai-skills.md` §七 既有口径一致）。

---

## Validation Architecture

> `workflow.nyquist_validation` = `true`（`.planning/config.json` 实读确认）⇒ 本节为 49-VALIDATION.md 的唯一触发条件，必须完整。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test`（Node 22.22.0 内置）+ `node:assert`；无第三方测试框架 |
| Config file | none —— 无需配置；测试以 `node <file>` 直接运行（`package.json` 无 `test` 脚本） |
| Quick run command | `node tests/test-ai-skills.js`（**基线 147/147 通过**，本会话实跑 ~477ms） |
| Full suite command | `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js && node tests/test-skill-picker-model.js` |
| 相关基线 | `node tests/test-agent-workspace.js` **21/21**（本会话实跑 ~134ms）；`node tests/test-builtin-skills-seeder.js` 已知在 Node 22 下「DOC-02 计数断言」**基线即红**（D-48-A，与 49 无关，修法见 `48-skill-name/deferred-items.md`） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MGMT-01 | 工具存在且 `action` enum 含三值 | 源码扫描 + 行为 | `node tests/test-ai-skills.js` | ✅ 扩既有（`readSource('ai-manager.js')` 基建已在） |
| MGMT-01 | 三动作各产生正确的磁盘终态 | 行为 | `node tests/test-manage-skill.js` | ❌ Wave 0 |
| MGMT-02 | 工具 `parameters.properties` 键集合 == `{action, name, content, description}`，**无 `path`** | 源码扫描（断言工具项字面） | `node tests/test-ai-skills.js` | ✅ 基建在 |
| MGMT-02 | 服务端二次校验：七种非法 name / description 超长 / 正文超 64 KiB 被拒且原因可读 | 单元 | `node tests/test-manage-skill.js` | ❌ Wave 0 |
| MGMT-03 | 原子写：失败不留半成品（操作前后目录列表逐字相等）；dest 逃逸被拒 | 行为 | `node tests/test-manage-skill.js` | ❌ Wave 0（可照抄 `tests/test-agent-workspace.js` 的 `renameFile` 双路径用例） |
| MGMT-04 | seeded 的 create / update / delete 三入口一律被拒，`code === 'seeded_protected'` | 单元（**显式注入 `seededNames`**） | `node tests/test-manage-skill.js` | ❌ Wave 0 |
| MGMT-05 | 成功后 `_skillsPromptDirty` 置位（忙时）→ 下一轮成功出口 `false` + prompt 含新技能 + 广播恰一次 | 行为（K 组 `promptCtx` 夹具） | `node tests/test-ai-skills.js` | ✅ 夹具在（K1/K2/K3 已示范） |
| MGMT-06 | 工具描述含「优先增强已有技能」与「仅在用户明确要求时」两条 | 源码扫描（描述文本正则） | `node tests/test-ai-skills.js` | ✅ 基建在 |
| D-08 | `description` 两组都扫（含凭据）、`content` **只**扫注入组（配置示例放行） | 单元 | `node tests/test-manage-skill.js` | ❌ Wave 0 |
| D-09 | 顺序：含零宽字符的注入措辞**仍被拒**（先扫描后净化） | 单元 | `node tests/test-manage-skill.js` | ❌ Wave 0 |
| D-10 | 第 `MAX_MANAGED_SKILLS + 1` 个非 seeded managed 技能创建被拒；`update`/`delete` 不受限 | 单元 | `node tests/test-manage-skill.js` | ❌ Wave 0 |
| D-02 | 卡片标记：start 打 `{action, name}`、end 并入 `{tier, code, promptIncluded}`；重载链路同形 | 源码扫描 + 行为 | `node tests/test-ai-skills.js` | ✅ H 组 `markerCtx` 夹具可复用 |
| 判据 4 | 不触及 `ai-memory/` / `attachments/` | 行为 | `node tests/test-manage-skill.js` | ❌ Wave 0 |
| — | 新增模块零 electron 依赖（`ai-skills-manager.js` 仍不含 `require('electron')`） | 源码扫描 | `node tests/test-ai-skills.js`（既有「依赖纪律」describe 自动覆盖） | ✅ 基建在（`:1148`） |

### 关键可验证主张 → 验证方式

| # | 主张 | 证据类型 | 判据 |
|---|------|---------|------|
| V1 | 沙箱 `renameFile` 从 `.tmp/` 到 `managed-skills/<name>/SKILL.md` 成功且跨目录无 EXDEV | 自动化（可在测试内断言） | `env.renameFile(...).ok === true` 且目标内容 == 写入内容 |
| V2 | `renameFile` 对**已存在**目标原子替换（update 与 create 共用路径） | 自动化 | 连续两次写同一 dest，第二次 `ok === true`，dest 内容 == 第二次内容，**且目录内文件数恒为 1** |
| V3 | `createDir` 对已存在目录返回 `ok: true` ⇒ 撞名判定**不可**依赖它 | 自动化（回归护栏，钉住该前提） | 连续两次 `createDir` 都 `ok === true`；测试注释写明「故撞名判定走 `exists`」 |
| V4 | `renameFile` dest 越界被拒 | 自动化 | `code === 'permission_denied'` 且目标未产生 |
| V5 | 失败路径不留半成品 | 自动化 | `create` 注入触发失败的场景（如 dest 父目录被移除）→ 清理后 `fs.readdirSync(managedDir)` 与操作前 **deepStrictEqual** |
| V6 | seeded 保护按**登记表**而非目录位置 | 自动化（**关键靶心**） | 在 `managed-skills/` 下造 `find-skills/`（**目录位置 = managed**），注入 `seededNames: ['find-skills']` → `create` 被拒 `code === 'seeded_protected'`。**反向例**：造 `managed-skills/ai-made/` 且**不**列入 seededNames → 允许创建（证明不是「managed 目录一律拒」） |
| V7 | 忙时语义时序（**难以直接自动验证的部分**，见下） | 行为 + 代码断言 | 见「时序断言的判定证据设计」 |
| V8 | `content` 侧配置示例放行、`description` 侧凭据被拒 | 自动化 | `content: 'api_key: YOUR_KEY_HERE'` → 成功；`description: 'api_key: real-key-123'` → 拒（`code === 'unscannable'`） |
| V9 | 扫描–净化顺序 | 自动化 | `description` 含零宽字符包裹的 `ignore all previous instructions` → 被拒（若顺序颠倒则放行 ⇒ 用例必然转红） |
| V10 | 写入侧预筛与加载期闸口同源 | 自动化（**幽灵技能护栏**） | 构造「恰好超 64 KiB 的正文」被写侧拒；再手工造一个超限文件 → `refreshSkills` 产 `realm_skill_md_too_large` ⇒ 证明写侧与读侧判同一条上限；description 同理（写侧拒 + 手工超长 → `isDescriptionUnusable` 跳过） |

### 时序断言的判定证据设计（忙时语义 V7）

> 这是本阶段**唯一难以直接自动验证**的主张（「工具执行期 `isProcessing` 恒为 true ⇒ 走忙分支」）。既有 K 组已给出可判定证据的**范式**，plan 应照抄而非另创。

**三个可判定证据（按强度递增）：**

1. **代码断言（最弱但零成本）**：对 `ai-manager.js` 的 `syncAgentSystemPrompt` 方法体做源码扫描 —— 断言忙分支（含 `this.isProcessing ||` 与 `_skillsPromptDirty = true`）**位于 `refreshSkills(` 调用之后、`getSkillsSnapshot()` 之前**。目的：钉住「忙时缓存已更新、仅 prompt 未回写」这一 D-13 前提不被重构破坏。
   ```js
   // 断言形态（methodBody 基建已在 tests/test-ai-skills.js:82-92）
   const body = methodBody(readSource('ai-manager.js'), 'syncAgentSystemPrompt');
   assert.ok(body.indexOf('refreshSkills(') < body.indexOf('this._skillsPromptDirty = true'),
     '重扫必须在忙分支之前（忙时缓存已更新，仅 prompt 留待补刷）');
   ```

2. **行为断言（靶心，推荐）**：用 K 组 `promptCtx` 夹具（`Object.create(aiManager.prototype)` + own-property 包装 `syncAgentSystemPrompt` 计数，**真实方法体逐字未改**）：
   - 直接调用 `manage_skill.execute(...)`（或经 manager 的 `createManagedSkill`），断言此刻 `ctx._skillsPromptDirty === true`、且 `ctx.agent.state.systemPrompt` **不含**新技能名（证明「工具执行期不回写」）。
   - 随后调用 `aiManager.prototype.prompt.call(ctx, '你好')`（`agent.prompt` 为 stub），断言 `_skillsPromptDirty === false`、`agent.state.systemPrompt` 含新技能名且 `=== aiManager.buildSystemPrompt()`、`broadcast` 捕获到 `['skills:changed']` **恰一次**。
   - 断言 `ctx.rescanCalls === 2`（工具路径一次 + 出口补刷一次；**不是 3** —— 证明没有按 ROADMAP 字面写两次调用）。

3. **端到端（人工 / UAT）**：`npm run dev` → 让 AI 建一个技能 → 观察工具卡片 → 发下一条消息问「你有哪些技能」→ 应答中应包含新技能。此层不可自动化（需真实 LLM），归 UAT。

**已知的判定边界（须写入计划的风险说明）：** 夹具把 `agent.prompt` 与 `_ensureConversation` stub 掉，因此 V7 的 2 号证据验证的是**出口行为**而非 SDK 往返；真实 `isProcessing` 在工具执行期的取值**不由该用例直接证明**——它是通过「`prompt()` 在 `:1043` 置 true、只在成功/失败出口复位（`:1086` / `:1100-1102` / `:1327-1333`）」的**代码事实**加上 3 号端到端观察来共同支撑的。plan 应在 VALIDATION 中如实标注这一点，**不要**把 2 号证据说成「已证明工具执行期 `isProcessing` 为 true」。

### Sampling Rate

- **Per task commit:** `node tests/test-manage-skill.js`（新增域，秒级）
- **Per wave merge:** `node tests/test-ai-skills.js && node tests/test-agent-workspace.js`（回归基线，必绿）
- **Phase gate:** `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node tests/test-agent-workspace.js && node tests/test-skill-picker-model.js` 全绿后再 `/gsd-verify-work`
  - 已知例外：`node tests/test-builtin-skills-seeder.js` 的「DOC-02 计数断言」在 Node 22 下**基线即红**（D-48-A），不因本阶段变化而红 —— 若纳入门禁须在计划中显式标注该已知红点，或按 `48-skill-name/deferred-items.md` 的修法先修。

### Wave 0 Gaps

- [ ] `tests/test-manage-skill.js` —— 新建；覆盖 MGMT-01/02/03/04 的全部值域矩阵 + D-08/D-09/D-10 + 判据 4
  - 头部需要的最小夹具（照抄既有风格）：`withTempRoot(t)`（`mkdtempSync` + `t.after` 清理 + `workspace.setWorkspaceDir(null)` + `aiSkills._resetCacheForTest()`）、`createSandboxEnv({ cwd: root })`、`writeSkill(dir, name, {description, body, frontmatterName})` 造型（用于造 seeded 目录与撞名对象）
  - **seeded 注入方式**：直接向 manager 函数传 `seededNames: [...]` 数组（**不走** `getSeededSkillNamesSafe()`，后者在纯 Node 下降级为 `[]`）—— 或在需要真实播种名时用 `seeder.setBuiltinDepsForTest({ srcDir: <tmp 源目录> })`
- [ ] `tests/test-ai-skills.js` 扩三组：
  - `manage_skill` 工具项源码断言（schema 键集合 / `executionMode` / 描述两条文案）
  - `manage_skill` 标记两时点 + 重载同形（复用 H 组 `markerCtx` 风格）
  - 刷新链行为用例（复用 K 组 `promptCtx` 风格，断言 `rescanCalls === 2` + 脏标记流转 + 广播恰一次）
- [ ] Framework install: **不需要**（`node:test` 内置）
- [ ] 若采纳 Open Question 1 的方案 A：`ai-memory-manager.js` 的改动需保留既有 `test/memory/threat-scan.test.js` 全绿（`node --test test/memory/*.test.js`）

*(若最终不新增 `tests/test-manage-skill.js` 而全部并入 `tests/test-ai-skills.js`，则上述两组的 Wave 0 工作合并到同一文件；但夹具的 seeded 注入方式仍是硬约束。)*

---

## Security Domain

> `security_enforcement` 未显式设为 `false`（`.planning/config.json` 实读确认为 `true`，`security_asvs_level: 1`）⇒ 本节必须包含。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本阶段无认证面（本地 Electron 应用，工具调用来自用户自己的模型会话） |
| V3 Session Management | no | 无会话面（对话生命周期由 `ai-conversations-manager` 既有机制承担，本阶段零改动） |
| V4 Access Control | **yes** | **接口设计即边界**：工具**不接受 `path`**（MGMT-02 / ARCHITECTURE Anti-Pattern 1）；seeded 保护（判据 3）按播种登记表判定；四类撞名拒绝（D-07）；`MAX_MANAGED_SKILLS` 数量闸（D-10） |
| V5 Input Validation | **yes** | name：`^[a-z0-9-]+$` + 长度 ≤64 + 无首尾连字符 + 无连续连字符（**服务端独立二次校验**，LLM 参数不可信）；description：trim 后非空 + ≤1024；content：trim 后非空 + ≤64 KiB 字节。全部经 `ai-skills-manager` 的**单一校验器**（供 49/50/51 共用） |
| V6 Cryptography | no | 本阶段不涉及密码学（无加密、无签名、无随机数生成需求） |
| V7 Error Handling & Logging | **yes** | 业务校验失败一律 `throw` → `isError: true` toolResult（LLM 可见并自行修正）；所有拒绝路径给**可读原因 + 机器可读原因码**（九码）；**禁止静默失败**（SKILL-06 / P12） |
| V8 Data Protection | partial | 写入范围由沙箱 `resolveInside` 双基准 + realpath 复核限定在 `agent-workspace/` 内；判据 4 要求不触及 `ai-memory/` / `attachments/` |
| V12 File & Resources | **yes** | `MAX_SKILL_MD_BYTES`（单文件 64 KiB）+ `MAX_MANAGED_SKILLS`（数量 50）两个闸；写入侧预筛与加载期闸口同源同值（防幽灵技能） |
| V14 Configuration | no | 无新增配置项（`settings.aiSkills.disabled` 只读消费） |

### Known Threat Patterns for Electron 主进程 + LLM 工具调用 + 文件写入

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **路径穿越 / 写逃逸**（模型传 `../../ai-memory/MEMORY.md` 之类的间接路径） | Tampering | 工具**不吃 path**（只有 `name`，路径由 manager `path.join` 计算）+ 沙箱 `resolveInside` 双基准 + 已存在路径 realpath 复核 + dest 逃逸拒绝（**实测 E5 生效**） |
| **Prompt injection 持久化**（技能 `description` 进每次请求的 system prompt，等价于零交互注入通道） | Tampering / Elevation | `description` 跑 `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS` 两组；命中即 `throw`；净化剥控制字符与零宽字符；**顺序铁律：先扫描后净化**（D-08/D-09）。P3 已实测三类放行缺口 —— 49 只把扫描点接成单点，扩表归 51 |
| **凭据入库外发**（`description` 无条件进每个请求 ⇒ 秘密入库 = 上传第三方） | Information Disclosure | `CREDENTIAL_PATTERNS`（sk- / Bearer / api_key / token / 私钥块 / GitHub token / 密码赋值）—— 与记忆两层同构 |
| **内置技能被冒名覆盖**（AI 建同名技能顶替随包技能） | Tampering / Spoofing | seeded 保护按**播种登记表**判定（判据 3），且 `create` 对**任何来源**的已存在目标一律拒绝（D-07 独占创建）—— 不是 upsert |
| **静默遮蔽内置技能**（AI 建同名 managed，被 user 技能永久遮蔽 ⇒ 静默无用） | Repudiation | D-07 的第 2 类拒绝 + 可读原因「同名用户技能优先级更高，AI 建的会被永久遮蔽」；`applyShadowing` 既有 `realm_shadowed` 诊断 |
| **资源耗尽**（无限建技能 → 磁盘与每次 Agent 重建的重扫成本无上限） | Denial of Service | `MAX_MANAGED_SKILLS`（D-10）+ `MAX_SKILL_MD_BYTES`（既有）；**不用 prompt 段预算做创建拒绝**（会与 48 D-12 冲突） |
| **不完整的保护造成虚假安全感**（加确认卡片但被 `write`/`bash` 绕过） | — | D-01 / D-05 已裁决：**不加确认**、**不新增拦截机制**、不完整的保护是负面价值；诚实边界必须进 `docs/product/ai-skills.md` |
| **XSS / 属性逃逸**（技能名进 DOM 属性上下文） | Tampering | 新增 `manage_skill` 卡片面**全部走 DOM API + `textContent`**，零 `innerHTML` 模板拼接（49-UI-SPEC §:525 明文）；`TIER_BADGE` / `MANAGE_SKILL_ACTION_LABEL` 白名单查表。**已知挂账**：TD-48-01（面板行 `escapeHtml` 不转义引号）由用户裁决与 49 同批处置，但 49 **不扩大**该缺口 |
| **工具结果信息泄漏**（错误消息回显敏感内容） | Information Disclosure | 错误消息只回显**原因码 + 可操作提示 + 限额/当前值**，不回显被拒内容本身（照抄 `ai-memory-manager.write` 的 `reason` 形态） |

---

## Sources

### Primary (HIGH confidence) — 本会话实读的源文件（含行号）

- `.planning/phases/49-manage-skill-ai/49-CONTEXT.md` — D-01..D-13 锁定决策（最高优先输入，已逐条核对与代码事实一致）
- `.planning/phases/49-manage-skill-ai/49-UI-SPEC.md` — 已 approved 的 UI 契约（数据契约 / 时序契约 / 四条硬约束 / 九条原因码表 / 前置修复两条）
- `.planning/ROADMAP.md:275-290` — Phase 49 Goal / 5 条 Success Criteria / Security gate
- `.planning/REQUIREMENTS.md:41-47`（MGMT-01..06 原文）+ `:99-` Out of Scope 表
- `.planning/STATE.md:246` 及后续 — 三条 ⚠️（`syncAgentSystemPrompt()` 无生产调用方 / TD-48-01 / TD-48-02）
- `agent-workspace.js:162-192`（`resolveInside`）、`:205-376`（`createSandboxEnv`）、`:38-115`（目录访问器）、`:120-126`（`ensureWorkspaceDir`）
- `ai-skills-manager.js:32-36`（`LIMITS`）、`:39-46`（`EMPTY_CACHE`）、`:140-185`（`createSkillsEnv`）、`:304-310`（`isDescriptionUnusable`）、`:329-341`（`enforceDirNameAuthority`）、`:359-380`（`applyShadowing`）、`:402-412`（`bySkillPriority`）、`:446-638`（`refreshSkills`，含 `:568-580` 数量上限）、`:660-667`（`getSkillsSnapshot`）、`:684-688`（`sourceTierOf`）、`:707-721`（`toUISkillEntry`）、`:734-749`（`matchSkillByPath`）、`:761-767`（`getSkillsForUI`）、`:802-834`（`readSkillForInvocation`）、`:841-853`（`module.exports`）
- `ai-manager.js:118-138`（惰性 require 三件套）、`:866-907`（init 创建点 + digest 记录）、`:1033-1096`（`prompt()` 流程与成功出口）、`:1169-1341`（`promptWithContext()` 流程与成功出口）、`:1522-1564`（`getSeededSkillNamesSafe` / `getSkillsForUI` / `_skillTierByLocation`）、`:1655-1691`（`_resolveSkillMarker`）、`:1743-1791`（`_setupEventBroadcasting` 的工具事件分支）、`:2754-2789`（重载链路标记重建）、`:2831-2859`（`syncAgentSystemPrompt`）、`:2877-2880`（`refreshSkillsForPanel`）、`:2905-2919`（`_flushDeferredSkillsPrompt`）、`:2926-2983`（`_recreateAgent`）、`:3177`（`_buildRealmTools`）、`:5805-5930`（`memory` / `memory_read` 工具 + 数组尾部）、`:5949-5957`（`_adaptHarnessTool`）
- `ai-memory-manager.js:34-63`（两组模式表）、`:76-89`（`scanInjectionPatterns`）、`:142-147`（`atomicWrite`，**未导出**）、`:198-273`（`write`）、`:405-417`（`module.exports`）
- `builtin-skills-seeder.js:60-70`（`resolveBuiltinSkillsSrc`）、`:77-80`（`resolveManagedSkillsDir`）、`:92-110`（`getSeededSkillNames`）、`:2445-2460`（`module.exports`）
- `src/skill-picker-model.js:29`（`SKILL_NAME_RE`）、`:324-340`（`TIER_BADGE`）
- `src/renderer.js:9340-9365`（工具事件映射与合并分支）、`:9552-9598`（`renderToolCard`）、`:10417-10434`（TD-48-01 的属性上下文）、`:11349-11353`（`escapeHtml` DOM 版）
- `node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:524-537`（`renameFile`）、`:592-601`（`createDir`）、`:602-611`（`remove`）、`:584-591`（`exists`）
- `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:4-5`（`MAX_NAME_LENGTH` / `MAX_DESCRIPTION_LENGTH`）、`:220-222`（name 校验只产 warning）、`:237-251`（`validateName`）、`:252-261`（`validateDescription`）
- `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:519-524`（`createErrorToolResult`，`details: {}`）
- `tests/test-ai-skills.js`（3286 行 / 147 例，**实跑 147/147 通过**）—— `:32-68` 夹具、`:70-92` 源码扫描基建、`:1148-1173` 依赖纪律、`:1175-1218` 导出面与三限额断言、`:1366-1431` P8 机制断言、`:2450-2540` H 组标记用例、`:3101-3233` K 组补刷用例
- `tests/test-agent-workspace.js`（227 行 / **实跑 21/21 通过**）
- `test/memory/threat-scan.test.js`（`scanInjectionPatterns` 的双语料库护栏，全部单参调用）
- `docs/product/ai-skills.md`（§四 限额 / §五 沙箱边界 / §六 已知限制 / §七 测试与验证 / §10.6 `read` 卡片技能化 / §10.7 诚实边界）
- `AGENTS.md` §AI 工作区与 Bash 权限（内置技能 / `LIMITS` 单源 / 技能不构成额外权限 / `allowed-tools` 仅供参照）
- `package.json`（无 `test` 脚本；`build.files` 只用 `!` 排除项；`asarUnpack`）

### Primary (HIGH confidence) — 本会话实跑输出

- `/tmp/probe-sandbox.cjs` —— 沙箱原语 13 项行为（E1–E9、E12）
- `/tmp/probe-writepath.cjs` —— 完整 create/update/delete 写入路径（E10、E11 + 失败清理）
- `node -e` —— `ai-memory-manager` 导出面与 `scanInjectionPatterns` 的字段耦合（Pitfall 1 的三条实测）
- `node tests/test-ai-skills.js` → `# pass 147 / # fail 0`
- `node tests/test-agent-workspace.js` → `# pass 21 / # fail 0`

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` P3 / P7 / P8 / P12 — 经 CONTEXT 引用的既有研究结论（本会话未重读原文，采用 CONTEXT 的转述）
- `.planning/research/FEATURES.md` §5.3 / §6.1 / §6.3 / §7.3 — ditto
- `.planning/research/ARCHITECTURE.md` §Anti-Pattern 1 / 2 / 5 — ditto
- `.planning/phases/46-prompt/46-CONTEXT.md` D-04/D-06/D-07/D-08/D-09/D-10/D-11、`47-bash/47-CONTEXT.md` D-07/D-10/D-11、`48-skill-name/48-CONTEXT.md` D-02/D-11/D-12/D-14/D-15/D-17 — ditto（本会话按需交叉引用，未逐份重读）
- `48-REVIEW.md` / `48-UI-REVIEW.md` — 技术债台账（TD-48-01/02、WR-01..WR-06、UI-REVIEW 8 Warning）

### Tertiary (LOW confidence)

- `/Volumes/ZhiTai/Projects/github/openhanako/` 的 oh-my-pi 参考实现（`docs/tools/manage_skill.md` / `autolearn-guidance.md`）—— **本会话未访问**（外部路径），全部经 CONTEXT 转述，仅作设计参照，**本阶段不引入任何依赖**

---

## Metadata

**Confidence breakdown:**
- **Standard Stack: HIGH** —— 本阶段零新增依赖；所有复用模块均本会话实读并在 `package.json` / `node_modules` 核对版本。
- **Architecture / 写入路径: HIGH** —— 沙箱原语行为由**实跑探针**确定（13 + 11 项断言），非推断；`rename` 原子替换、`createDir` 幂等、dest 逃逸拒绝三条均已用真实沙箱环境验证。
- **刷新链（D-13）: HIGH** —— `syncAgentSystemPrompt` / `_flushDeferredSkillsPrompt` / 两处成功出口的行号与语义均逐字读取确认；重扫次数账有既有 K1 断言（`rescanCalls === 2`）作为地面真值。
- **校验器可复用边界: HIGH（含一处阻塞级冲突）** —— 导出面经 `require` 实测；D-08 与现有导出不兼容已明确证据化并给出两条可行修法。
- **Pitfalls: HIGH** —— 11 条中 9 条有直接代码事实或实测输出支撑；A3 / A5 两条为**设计级开放项**（已入 Assumptions Log）。
- **UI 面: HIGH** —— 49-UI-SPEC 已 approved，其数据契约 / 时序契约 / 四条硬约束本会话逐条与代码核对（`createErrorToolResult` 的 `details: {}`、renderer 合并分支只并入三字段均确认为真）。
- **环境可用性: HIGH** —— 实测 node 版本与测试基线。
- **Business/产品决策: 不评** —— 全部由 CONTEXT.md 锁定，本报告不重新论证。

**Research date:** 2026-09-13
**Valid until:** 2026-10-13（30 天，稳定域）；**但**以下三项**升版即失效**，须在 SDK 升版时立即复核：`harness/skills.js` 的 `MAX_NAME_LENGTH` / `MAX_DESCRIPTION_LENGTH` / `validateName` 判据集；`harness/env/nodejs.js` 的 `createDir` / `renameFile` / `remove` 语义；`agent-loop.js` 的 `createErrorToolResult` 形状（`details: {}`）。


---
phase: 49-manage-skill-ai
verified: 2026-09-13T08:18:21Z
status: gaps_found
score: 10/14 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/49-manage-skill-ai/49-01-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-01-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-02-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-02-SUMMARY.md
  - .planning/phases/49-manage-skill-ai/49-03-PLAN.md
  - .planning/phases/49-manage-skill-ai/49-03-SUMMARY.md
  - AGENTS.md
  - ai-conversations-manager.js
  - ai-manager.js
  - ai-memory-manager.js
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - src/index.html
  - src/renderer.js
  - src/skill-picker-model.js
  - src/styles/main.css
  - tests/test-ai-skills.js
  - tests/test-manage-skill.js
  - tests/test-skill-picker-model.js
covered_digest: "v1:sha256:59e024fd97681de3f40b607b8624d859ebcd53c7d40f941704dea9d82e632500"
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "写侧允许落盘的任何技能都必然能被加载管线收进技能集，不产生【落盘成功但整条被跳过】的幽灵技能（ROADMAP SC1「新技能集在下一条消息即对模型可见」的完整性半边）"
    status: failed
    reason: "三条独立成因同归一类后果：工具向模型报告成功、磁盘有文件、技能却永不加载。① description 未做 YAML 转义就字符串拼进 frontmatter；② description 在净化**之前**校验、净化后不复验非空；③ 写侧只按 content 计字节，加载期闸口按整个 SKILL.md（含 frontmatter）计字节。三者均已端到端机械复现（见 Behavior 证据）。"
    artifacts:
      - path: "ai-skills-manager.js"
        issue: "buildSkillFileText:1143-1146 无 YAML 转义（`description: ${description}`）；createManagedSkill:1321-1331 与 updateManagedSkill:1414-1424 先 validate 后 sanitize 且净化后不复验；validateManagedSkillContent:1068-1081 只计 content 的 Buffer.byteLength，而加载期 createSkillsEnv.readTextFile:216-238 闸的是整个 SKILL.md 的 FileInfo.size"
      - path: "ai-manager.js"
        issue: "6249-6258：幽灵技能下 getSkillPromptIncluded 返回 false（ai-skills-manager.js:1496 `if (!entry) return false`），结果文本追加「该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:{name} 手动调用。」—— 预算并未满、/skill:x 也解析不到，双重失实"
    missing:
      - "buildSkillFileText 用 YAML 单引号标量（撇号双写）转义 description，并归一化换行"
      - "净化后对 description 再验一次 trim 非空（sanitize → validate 顺序），create / update 两处都要"
      - "validateManagedSkillContent 改为按组装后的全文计字节（Buffer.byteLength(builtText) > MAX_SKILL_MD_BYTES）"
      - "tests/test-manage-skill.js 补 description 值域行：含 ': ' / 含 '#' / 裸 'true' / 纯 U+200B；补 write↔load 闸口同值的边界行"
  - truth: "标记字段形状固定为 manageSkill = { action, name, tier?, code?, promptIncluded? }：action 与 name 在 start 给出；tier / code / promptIncluded 在 end **并入**（UI-SPEC 硬约束 1 / 数据契约）"
    status: failed
    reason: "renderer 的「已存在条目」分支写的是 `manageSkill: event.manage_skill`（对象字面量覆盖），不是并入。end 事件只投影 {tier?, code?, promptIncluded?}（_resolveManageSkillTerminal:1780-1793 刻意不含 action/name，其 JSDoc 明文假设渲染端会并入 start 值），覆盖后 action/name 丢失 ⇒ manageSkillOk 恒为 false ⇒ 卡片整个技能变体崩塌。已按 renderer 字面语义机械复现：终态 manageSkill = {tier, promptIncluded}，manageLabel = undefined，manageSkillOk = false。"
    artifacts:
      - path: "src/renderer.js"
        issue: "9377 用 manageSkill: event.manage_skill 做覆盖而非并入（正确写法需以上一条目的 manageSkill 为基底展开）"
      - path: "tests/test-ai-skills.js"
        issue: "M3（:3637-3645）只断言合并区出现子串 manageSkill 与 `event.manage_skill ?` 三元 —— 覆盖写法同样满足；M5b（:3705）自行 `const live = { ...startMarker, ...endTerminal }` 手搓「预期并入结果」，再断言重载链路与之相等 —— 验证的是意图而非 renderer 的真实语义。两组守卫对 CR-01 假绿。"
    missing:
      - "src/renderer.js:9377 改为并入：`manageSkill: { ...(prev.manageSkill || {}), ...event.manage_skill }`（或把整份 decoration 移进 _resolveManageSkillTerminal，使 M5b 的 {...start, ...terminal} 字面成立）"
      - "M3 断言升级为语义断言（或删除该假绿守卫）；M5b 改从 renderer 的真实合并语义推导"
  - truth: "重开对话后卡片形状与实时链路**逐字一致**（UI-SPEC 硬约束 3）"
    status: failed
    reason: "两条链路终态键集合实际不等：实时链路终态被覆盖成 {tier, promptIncluded}（无 action/name，见上一条），重载链路经 _buildManageSkillDecoration 给 {action, name, tier, promptIncluded}。此外失败态 code 不落库，_manageSkillTerminalFromStored 只能还原 promptIncluded 与 tier ⇒ 失败历史卡片永久丢失「内置不可改删」等短原因（WR-02），而 UI-SPEC 明文要求失败态含短原因。"
    artifacts:
      - path: "ai-manager.js"
        issue: "_manageSkillTerminalFromStored:1811-1823 无法还原 code（原因码未落库）；与实时链路的键集合对失败行不相等"
      - path: "src/renderer.js"
        issue: "实时链路终态被覆盖后与重载链路形状不一致（同 CR-01 根因）"
    missing:
      - "修复 CR-01 后重新核对两条链路的键集合（含失败行）"
      - "为失败态持久化原因码（如事务包装 err.message 带 [code] 前缀后从 tool_results 解析回写），或按 UI-SPEC 的口径在文档中把该不对称显式记为已知偏差并收窄 M5b 的断言"
human_verification:
  - test: "端到端可见性：`npm run dev`，在 AI 聊天里显式要求它把某套流程沉淀为技能（名字用 commit-style）；**不重开对话**直接发下一条消息问「你现在有哪些技能？」"
    expected: "应答中出现 commit-style（SC1「下一条消息即对模型可见」的唯一端到端证据；断言点在下一条消息，不是工具返回时）。步骤①–④ 全文见 49-VALIDATION.md 的 Manual-Only 五步表。"
    why_human: "需真实 LLM 往返，不可自动化（49-VALIDATION.md 层 2 已声明不得由层 1 证据替代）"
  - test: "端到端卡片观察（步骤①的视觉面）：同一张卡片终态应显示「创建技能「commit-style」」标题 + 托管徽标 + 参数摘要三行 + 折叠的「技能正文（N 字符）」块 + 含「下一条消息起」的结果文本"
    expected: "上述元素全部可见。**当前必然不成立** —— CR-01 已机械证明终态标记被覆盖、manageSkillOk 恒 false，卡片会回落成标题为 `manage_skill` 的普通卡片并 JSON 直出整份 content（最多 64 KiB）。该人工作业应在修复 CR-01 后再执行，否则必然失败。"
    why_human: "视觉呈现需真实渲染；但根因已被机械证据钉死，属「先修再验」而非「验了才知道」"
  - test: "backstop 视觉确认（步骤⑤）：把 AI 面板拖到最小宽度（--ai-panel-min-width: 280px），让一张卡片同时带来源徽标 + 「未进提示词 · 超预算」标注（可用超长技能名替代）"
    expected: "头部保持单行不换行、徽标与短原因完整可读、头部高度不变；唯一允许的退化是技能名被省略号压缩。不成立时的处置是缩短短原因至 ≤ 4 字 —— 不得改成换行头部或加 system-note"
    why_human: "backstop 级判据（非可推断），需真实渲染下的视觉裁决"
behavior_unverified_items:
  - truth: "最小面板宽度（--ai-panel-min-width: 280px）下，带来源徽标 + 内联标注的 manage_skill 卡片头部保持单行不换行，徽标与短原因完整可读（UI-SPEC markdown 块，verification: backstop）"
    test: "拖到最小面板宽度渲染一张带徽标 + 标注的卡片（见 49-VALIDATION.md 步骤⑤）"
    expected: "头部单行不换行、高度不变，仅技能名可省略号压缩"
    why_human: "非可推断（verification: backstop）：行宽/换行取决于运行时字体度量与 flex 收缩行为，源码与 grep 只能证明 flex-shrink / white-space 声明存在，不能证明在最小宽度下确实成立。且该判据是 visual 依赖，presence+wiring 永不合格。"
coincidental_reliance_items:
  - truth: "SC3：seeded 三入口拒绝按播种登记表判定（非目录位置）"
    reason: fixture-only
    harden: "现有 41 例与我的独立探针都在纯 Node 下显式注入 seededNames 常量数组（tests/test-manage-skill.js 的 SEEDED）——该注入在真实运行时来自 ai-manager.js 的 getSeededSkillNamesSafe()，而它在纯 Node 下会降级为 []。生产链路的注入正确性未被任何自动化断言覆盖（测试文件自身只护栏「不得走降级路径」，不验真实登记表接线）。建议补一条接线断言：getSeededSkillNamesSafe() 在 electron 环境下返回非空集合并与 skills-builtin/ 目录名集合相等。"
---

# Phase 49: `manage_skill` 工具（AI 自建技能）Verification Report

**Phase Goal:** AI 可自主创建、更新、删除自己的技能，且无法覆盖或删除随包内置技能。
**Verified:** 2026-09-13T08:18:21Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1（机制）：三动作写入后刷新链在本轮成功出口回写 system prompt，新技能下一条消息可见（正常输入） | ✓ VERIFIED | `_buildManageSkillTool` 成功后恰一次 `await this.syncAgentSystemPrompt()`（ai-manager.js:6218）；L1 用例断言忙时只置 `_skillsPromptDirty`、工具返回时 prompt **尚未**含新技能、成功出口后 `systemPrompt.includes('flush-probe')` 且广播恰一次、`rescanCalls` 记账正确 |
| 2 | SC1（完整性）：写侧允许落盘的任何技能都必然能被加载管线收进技能集（无幽灵技能） | ✗ FAILED | 端到端复现 3/5 场景为幽灵技能（见 Behavioral Spot-Checks #1–#4）；CR-02 / CR-03 / WR-01 三条独立成因 |
| 3 | SC2：工具 `parameters.properties` 键集合**恰为** `{action, name, content, description}`，无 `path` | ✓ VERIFIED | ai-manager.js:6137-6160 逐字核对；`required: ['action','name']`；enum 恰为三值；`executionMode: 'sequential'` |
| 4 | SC2：服务端独立二次校验，非法 name / 超长 description / 超限正文被拒并说明原因 | ✓ VERIFIED | validateManagedSkillName:993-1022（非字符串 / 空 / >64 / 字符集 / 首尾连字符 / 连续连字符六分支）；validateManagedSkillDescription:1036-1051（≤1024）；validateManagedSkillContent:1068-1081（≤64 KiB 字节）；全部带可读中文原因 |
| 5 | SC3：seeded 保护按**播种登记表**判定（非目录位置），三入口拒绝，且有反向例 | ✓ VERIFIED | 独立探针：把 `find-skills` 目录造在 `managed-skills/` 下（位置=managed）后 create/update/delete **三入口全部** `seeded_protected`；未登记的 `ai-made` create/delete 均成功；seeded 目录内容逐字未改。判定在 `resolveManagedTarget:1271` 首检，先于任何读盘存在性检查 |
| 6 | SC4：原子写经沙箱 `env.renameFile` 双基准路径校验，create/update 共用同一路径，失败不留半成品 | ✓ VERIFIED | `atomicWriteSkillFile:1183-1215` 为唯一写路径（create:1378 / update:1433 共用）；tmp→writeFile→renameFile，任一步失败清理 tmp；create 失败额外 `remove(destDir, {recursive:true})`；update 不做清理（目标目录属既有数据） |
| 7 | SC4：不触及 `ai-memory/`、`attachments/`、`skills/` 等其他工作区路径 | ✓ VERIFIED | tests/test-manage-skill.js:818-846 对三目录做操作前后 `snapshotTree` 深比较，并含反向证据（`managed-skills/` 必须有变化） |
| 8 | SC5：工具描述含「仅在用户明确要求」与「优先增强已有技能，而非创建近乎重复的新技能」两条文案，且不进 REALM_SYSTEM_PROMPT | ✓ VERIFIED | ai-manager.js:6130-6136 两条文案均在 `description` 内；M 组源码扫描断言第二条 |
| 9 | create 独占创建：目标已存在即拒且**不落盘**，四类来源给不同原因码（seeded/user/already_exists/not_found） | ✓ VERIFIED | createManagedSkill:1345-1356 映射四态；测试断言拒绝路径磁盘逐字不变（:1000） |
| 10 | 字段分离扫描（description 两组 / content 一组）+ **先扫描后净化**顺序铁律 | ✓ VERIFIED | scanSkillText:1131-1143 传 `includeCredentials`；create:1327-1333 严格 scan→sanitize；ai-memory-manager 可选参向后兼容（threat-scan 33/33 全绿） |
| 11 | 数量闸 `MAX_MANAGED_SKILLS` 只约束 create、seeded 不计入、update/delete 不受限 | ✓ VERIFIED | countManagedSkills 读盘且排除 seeded；闸在 createManagedSkill:1358-1366 |
| 12 | 标记形状固定 `{action,name,tier?,code?,promptIncluded?}`：tier/code/promptIncluded 在 end **并入** | ✗ FAILED | renderer.js:9377 是**覆盖**而非并入；机械复现终态 `manageSkill = {tier,promptIncluded}`、`manageLabel = undefined`、`manageSkillOk = false` |
| 13 | 重开对话后卡片形状与实时链路**逐字一致** | ✗ FAILED | 实时终态 `{tier,promptIncluded}` vs 重载 `{action,name,tier,promptIncluded}`；失败行另缺 `code`（WR-02） |
| 14 | [backstop] 最小面板宽度下卡片头部单行不换行、徽标与短原因完整可读 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | flex-shrink / white-space 声明存在（presence+wiring 可证），但单行成立是运行时视觉裁决 —— 非可推断判据，见 Human Verification |

**Score:** 10/14 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `ai-skills-manager.js` | 校验器 / 净化 / 扫描单点 / 组装 / 三动作 / 原子写；零 electron 依赖 | ✓ VERIFIED | 全部导出就位；`LIMITS.MAX_MANAGED_SKILLS` / `MAX_SKILL_DESCRIPTION_CHARS` 已加；纯 Node 可 require（41 例单测通过） |
| `ai-memory-manager.js` | `scanInjectionPatterns(content, { includeCredentials })` 可选参向后兼容 | ✓ VERIFIED | 单参调用行为不变（threat-scan 33/33） |
| `ai-manager.js` | `manage_skill` 工具项 + 两时点标记 + 刷新链 + 三动作转发 | ⚠️ PARTIAL | 工具项 / 刷新链 / 转发正确；`_resolveManageSkillTerminal` 只投影三键且其 JSDoc **假设**渲染端会并入 —— 该假设在生产 renderer 中不成立（CR-01） |
| `src/renderer.js` | 两分支事件映射 + 卡片技能化分支 | ✗ STUB（变体不可达） | 结构齐备但终态合并写错，整个技能变体在 end 事件后不可达；参数区回落为 `JSON.stringify(params)` 全量输出（最多 64 KiB） |
| `src/skill-picker-model.js` | `MANAGE_SKILL_ACTION_LABEL` / `MANAGE_SKILL_SHORT_REASON` / `MANAGE_SKILL_ACTION_NAME` 白名单 | ✓ VERIFIED | 三表 frozen、值域测试覆盖前两张（IN-04 指出第三张缺值域测试）；99 例通过 |
| `tests/test-manage-skill.js` | 41 例 | ✓ VERIFIED | 实跑 **41/41 pass / 0 fail**（不是转述 SUMMARY） |
| `tests/test-ai-skills.js` | 172 例 | ⚠️ PARTIAL | 实跑 **172/172 pass**，但 M3 / M5b 两组对 CR-01 **假绿**（断言的是意图而非 renderer 真实语义） |
| `tests/test-skill-picker-model.js` | 99 例 | ✓ VERIFIED | 实跑 **99/99 pass / 0 fail** |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| 工具 execute | ai-skills-manager 三动作 | `getAiSkillsManagerLazy()` | ✓ WIRED | 参数只解析转发，判定全在 manager（单份实现，50/51 可 require） |
| 三动作 | 刷新链 | `await this.syncAgentSystemPrompt()` 恰一次 | ✓ WIRED | create/update/delete 共用同一句（ai-manager.js:6218） |
| seeded 集合 | 三动作判定 | `getSeededSkillNamesSafe()` → `seededNames` 注入 | ⚠️ PARTIAL | 签名注入正确、零 electron 保持；但生产注入值本身无自动化断言（见 coincidental_reliance_items） |
| start 事件 | renderer 新条目分支 | `event.manage_skill` → `manageSkill` | ✓ WIRED | 字段名 snake_case 一致 |
| end 事件 | renderer 已存在条目分支 | `event.manage_skill` → `manageSkill` | ✗ NOT_WIRED（语义） | 字段到达了，但语义是**覆盖**不是并入 ⇒ 标记残缺（CR-01） |
| 原子写 | 沙箱 | `env.createTempFile` → `writeFile` → `renameFile` | ✓ WIRED | dest 经沙箱双基准校验；越界返回 permission_denied |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 卡片标题 / 徽标 / 标注 | `toolExecution.manageSkill` | 主进程两时点事件标记 | 覆盖语义致 action/name 丢失 | ✗ DISCONNECTED |
| 参数摘要 | `toolExecution.params` | 持久化的工具参数 | 真实 | ✓ FLOWING（但仅在 `manageSkillOk` 为真时构建，当前不可达） |
| SKILL.md 正文 | `buildSkillFileText({name,description,content})` | 工具入参 | 真实，但 description 未转义 | ⚠️ STATIC（结构不安全） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 1. description 含 `: ` 时技能可见 | `node /tmp/repro-cr02-cr03.js`（create → refreshSkills → getSkillsForUI） | 工具 `SUCCESS`；加载后技能集 `[]`；诊断 `parse_failed`（"Nested mappings are not allowed in compact mappings"）→ **幽灵技能** | ✗ FAIL |
| 2. description = 裸 `true` 时技能可见 | 同上 | 工具 `SUCCESS`；技能集 `[]`；诊断 `invalid_metadata: description is required` → **幽灵技能** | ✗ FAIL |
| 3. description = `"\u200B"` 时技能可见 | 同上 | 工具 `SUCCESS`；落盘 `description: `（空）；技能集 `[]` → **幽灵技能** | ✗ FAIL |
| 4. 字节边界：content 65200B + desc 1024 字符 | `node /tmp/repro-wr01.js` | 写侧接受；落盘 **66256 B** > 闸口 65536 B；加载结果 `[]`；诊断 `read_failed` / `realm_skill_md_too_large` → **幽灵技能**（对照：desc 12 字符 → 65244 B → 正常加载） | ✗ FAIL |
| 5. 正常 description 对照 | `node /tmp/repro-cr02-cr03.js` | 工具 `SUCCESS`；技能集 `["cr-test"]`；无诊断 | ✓ PASS |
| 6. CR-01 终态合并语义 | `node /tmp/repro-cr01.js`（按 renderer:9368-9378 字面语义 + 真实两时点载荷） | 终态 `manageSkill = {"tier":"managed","promptIncluded":false}`；`MANAGE_SKILL_ACTION_LABEL[undefined] = undefined`；`manageSkillOk = false`；改为并入则 `= true` | ✗ FAIL（复现） |
| 7. description 含 `#` 的静默截断 | `node /tmp/repro-cr02b.js` | 写入 `"Summarize this #1 priority task"` → 加载后 `"Summarize this"`（技能在但描述错） | ✗ FAIL（数据失真） |
| 8. SC3 seeded 三入口 + 反向例 | `node /tmp/spot-sc3.js` | 三入口均 `seeded_protected`；`ai-made` create/delete 成功；seeded 目录内容未改 | ✓ PASS |
| 9. 测试套件存在性（枚举，非全量重跑） | `node tests/test-manage-skill.js` / `node tests/test-ai-skills.js` / `node --test tests/test-skill-picker-model.js` | 41/41、172/172、99/99 —— 全部 pass，**与 SUMMARY 声称一致** | ✓ PASS |

**注**：套件全绿但 CR-01/CR-02/CR-03/WR-01 均未被任何断言捕获 —— 「全绿」在本阶段不是目标达成的证据。

### Probe Execution

无声明的可执行探针（phase 不含 `scripts/*/tests/probe-*.sh`，PLAN/SUMMARY 未声明 probe）→ 不适用。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MGMT-01 | 49-01, 49-02 | AI 拥有 `manage_skill` 工具，支持 create / update / delete | ✓ SATISFIED | 工具项就位 + 三动作落地 + 刷新链 + 卡片（卡片终态有缺陷，见 truth #12） |
| MGMT-02 | 49-01 | 不接受 `path`，只接受 `name`/`content`/`description`；路径由 manager 计算 | ✓ SATISFIED | 键集合逐字核对；`managedSkillPaths` 用 `path.join` |
| MGMT-03 | 49-01 | 服务端二次校验 name/description/正文字节上限；写入走原子写 | ✓ SATISFIED | 三个校验器 + `atomicWriteSkillFile`；**但 description 值域之外的可加载性未受校验保护**（truth #2，归 SC1 计） |
| MGMT-04 | 49-01 | seeded 不可被覆盖或删除（按播种登记表） | ✓ SATISFIED | 三入口 `seeded_protected` + 反向例证据 |
| MGMT-05 | 49-01, 49-02 | 成功后刷新技能集与 system prompt | ✓ SATISFIED | L1 用例（忙时置脏 → 成功出口回写 + 广播恰一次） |
| MGMT-06 | 49-01 | 工具描述引导「优先增强已有技能」 | ✓ SATISFIED | 文案在 description 内 |

**孤儿需求检查**：REQUIREMENTS.md 映射到 Phase 49 的 ID 为 MGMT-01..06，全部被计划声明覆盖（49-01 声明全部六个；49-02 声明 MGMT-01/05；49-03 声明空），**无 ORPHANED**。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/renderer.js` | 9377 | 对象字面量**覆盖**已有 `manageSkill`（应为并入） | 🛑 Blocker | 终态卡片技能变体整体崩塌；JSON 直出最多 64 KiB content |
| `ai-skills-manager.js` | 1143-1146 | 未转义字符串插值进 YAML frontmatter | 🛑 Blocker | description 含 `: `/`#`/裸标量 → 解析失败或静默截断 → 幽灵技能 |
| `ai-skills-manager.js` | 1321-1331, 1414-1424 | 净化后不复验（validate → sanitize 单向） | 🛑 Blocker | 零宽字符描述可被净化为空 → 幽灵技能 |
| `ai-skills-manager.js` | 1068-1081 vs 216-238 | 写侧与加载期闸口计量对象不同（content vs 整文件） | 🛑 Blocker | ~1.06 KB 边界带内幽灵技能（实测 66256 B > 65536 B） |
| `tests/test-ai-skills.js` | 3637-3645（M3）、3705（M5b） | 断言意图而非实现（假绿守卫） | ⚠️ Warning | 172 例全绿却漏掉 CR-01；M5b 手搓预期对象 |
| `ai-manager.js` | 6249-6252 | 成功结果文本偏离 UI-SPEC 权威文案（三动作全部） | ⚠️ Warning | 用户可见文案与契约不一致；M5b 夹具用规范措辞故不可见 |
| `ai-skills-manager.js` | 1100 | 净化类未覆盖 bidi/格式控制符（U+202A–202E、U+2066–2069） | ⚠️ Warning | 描述可被视觉重排（Trojan-Source 类） |
| `docs/product/ai-skills.md` | §11.3 | 声称 `oversize` 与加载期闸口「**同源同值**」 | ⚠️ Warning | 文档过度声称；WR-01 实测证伪（NOT 同值） |
| `ai-skills-manager.js` | 1370-1384 | `const madeDir = true` 死代码；`createDir` Result 未检 | ℹ️ Info | 失败归因可能误报 |
| `ai-manager.js` | 506, 543 | `XXX` 占位文本（非债务标记） | ℹ️ Info | git blame 证实为 2026-08-02/03 的既有工具描述，**非本阶段引入**，不构成 debt-marker 门禁 |

**债务标记门禁**：本阶段改动文件内**无**无引用的 `TBD`/`FIXME`/`XXX` 债务标记（两处 `XXX` 为工具描述中的占位词，改动时间早于本阶段一个月）。

### Human Verification Required

见 frontmatter `human_verification`（3 项）。摘要：

1. **端到端 LLM 往返可见性**（SC1 的唯一端到端证据）—— 步骤与期望现象已预写在 `49-VALIDATION.md` 的 Manual-Only 五步表；断言点是**下一条消息**而非工具返回时。
2. **卡片终态视觉面**（步骤①）—— **修复 CR-01 前必然失败**（已机械证明终态 `manageSkillOk === false`），应在修复后执行。
3. **backstop 最小宽度单行不换行**（步骤⑤）—— 视觉裁决，见 `behavior_unverified_items`。

### Gaps Summary

本阶段的**安全与接口面做得扎实**：`path` 参数不存在（接口设计即边界）、三个校验器与九码闭合白名单齐备、seeded 按登记表判定且三入口一致拒绝、原子写共用单一路径且工作区隔离有反向证据、刷新链次数账精确（恰一次 + 成功出口回写）、工具描述两条引导文案到位。SC2–SC5 全部达成。测试套件 41/172/99 全绿，数字与 SUMMARY 声称一致。

**但「工具报告成功、技能实际不存在」这一本阶段明确要消灭的失效族（T-49-01-08 / RESEARCH Pitfall 4）在三条独立路径上仍然存在，且被端到端复现**：

- **幽灵技能（truth #2，同时击穿 SC1）**：写侧不校验 description 的 YAML 可解析性或净化后非空性，也不按最终落盘文件计字节。实测 3 类输入（含 `: ` 的描述、裸 `true`、纯 U+200B）加 1 类字节边界（66256 B 文件 > 65536 B 闸口）全部产出「工具 SUCCESS、技能集为空、诊断报错」的幽灵技能，并向模型追加「预算已满、仍可用 /skill:x 调用」的失实说明。`49-01-SUMMARY.md:300` 记录的窗口是「约 60 字节」，实测宽约 **1.06 KB**（content 65200 B + desc 1024 字符 → 66256 B），记录低估约 17 倍 —— 与代码审查 WR-01 的测量一致，故本项目**要求把它当需要修的问题而非可接受边界带**。产品文档 §11.3 反而声称该闸「与加载期闸口同源同值」，属过度声称。

- **卡片终态标记崩塌（truth #12/#13）**：`src/renderer.js:9377` 用对象字面量**覆盖**而非并入标记，end 事件的 `{tier, code, promptIncluded}` 一到就抹掉 start 的 `{action, name}` ⇒ 技能变体整体不可达（徽标、短原因、参数摘要、正文折叠块全部不渲染，参数区回落为整份 content 的 JSON 墙）。两条守卫（M3 源码扫描、M5b 行为断言）**假绿**：M3 只查子串，M5b 自己手搓了「预期并入结果」。另有失败历史卡片永久丢失短原因（原因码未落库）与成功文案偏离 UI-SPEC 权威清单。

**修复次序建议**：先修 `renderer.js:9377` 的并入（一行，且让 M5b 的 `{...start, ...terminal}` 字面成立），再修 `buildSkillFileText` 的 YAML 标量转义与净化后复验，最后把字节闸改到组装后的全文上 —— 三处都在本阶段已声明的文件内，无范围蔓延。

**无 deferred 项**：Phase 50（设置页技能管理区）与 Phase 51（zip 导入管线）的 Goal 与 Success Criteria 均不覆盖上述任一缺陷，故全部记为真实 gap。

---

_Verified: 2026-09-13T08:18:21Z_
_Verifier: Claude (gsd-verifier)_

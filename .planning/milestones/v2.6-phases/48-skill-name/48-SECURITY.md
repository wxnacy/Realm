---
phase: "48"
slug: "skill-name"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-09-13"
audited: "2026-09-13"
---

# Phase 48 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> 生成方式：`/gsd-verify-work 48` 的 verify:post → secure-phase（**State B**：无 SECURITY.md、PLAN 与 SUMMARY 齐备）。
> 登记册来源 = 8 份 `48-0X-PLAN.md` 的 `<threat_model>` 块（`register_authored_at_plan_time: true`）。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → main（IPC） | 用户手打文本、`attachmentIds`、技能调用语法文本从 renderer 进入主进程 | 不可信用户输入；两个新通道（`ai:get-skills` / `ai:refresh-skills`）均为无载荷读取，写入面为零 |
| 磁盘 → 主进程 | `SKILL.md`（技能名 / description / 正文）可由用户手改或经 AI `write`/`bash` 改写 | 不可信文件内容（≤50 个技能 × 64 KiB 字节闸） |
| 主进程 → Agent（SDK） | 组装后的 `<skill>` 块进入 LLM 输入；args 是不可信原文 | 技能正文 + 用户 args |
| 主进程 → renderer | 技能名 / description / tier 经收窄投影与事件进入 `innerHTML` 模板与 DOM | 已剔除 `content` / `filePath` / `diagnostics` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-48-01 | Tampering | `readSkillForInvocation` / `parseSkillInvocationText`（`/skill:name` 的 name） | high | mitigate | name 只作 `_cache.skills` 查找键；读盘目录由 `path.dirname(entry.skill.filePath)` 派生（`ai-skills-manager.js` `readSkillForInvocation`，全函数零 `path.join(用户输入)` — 实测 0 处）；`SKILL_NAME_RE = /^[a-z0-9-]+$/`（`src/skill-picker-model.js:29`，`:104` 施加；主进程 `parseSkillInvocationText` 委派同一实现 — **单源**）；冒名门以**目录同一性**（`path.resolve(path.dirname(...))` 全等）承担，见 T-48-04-01 | closed |
| T-48-02 | Elevation of Privilege | 全阶段写面 | high | mitigate | `ai-skills-manager.js` 内 `writeFileSync|writeFile(|mkdirSync|rmSync|unlinkSync|appendFile` 实测 **0 处**；`refreshSkills()` 与 `refreshSkillsForPanel()` 只读；零新增技能写路径（写路径归 Phase 49/50/51） | closed |
| T-48-03 | Tampering | `renderSlashPickerList` 的 `innerHTML` 模板（技能 name / description / 行尾标注 / `title`） | high | mitigate | `renderSlashPickerList` 内 `escapeHtml(` 实测 **5 处**；tier → class 走 `SkillPickerModel.TIER_BADGE` 白名单查表（`renderer.js` 内 5 处引用，表外/缺失即整枚徽标不渲染，值不参与 class 拼接）；行尾标注与 `仅显式` 为定长文案；不可选中行不绑处理器 | closed |
| T-48-04 | Spoofing | `REALM_SYSTEM_PROMPT` / 增强消息组装 | medium | mitigate | system prompt 为**静态前缀**（不含运行期数据）；技能正文只经 SDK `formatSkillInvocation` 包裹注入；provenance 行为 Realm 固定模板；args 只落在 `additionalInstructions` 位，不入 system prompt | closed |
| T-48-05 | Information Disclosure | `ai:get-skills` / `ai:refresh-skills` / 返回契约 | medium | mitigate | 两通道 `assertTrustedSender(event)` + `aiManager` 判空；投影剔除 `content` / `filePath` / `diagnostics`；`skillInvocation.content` 只随**当次调用响应**回传发起方 renderer，不进广播 | closed |
| T-48-06 | Denial of Service | `refreshSkillsForPanel()` → `syncAgentSystemPrompt()` | low | mitigate | 后台刷新只在面板打开时触发一次；`skills:changed` 处理器只重拉快照（`digest` 相同即 return），不触发重扫 —— 消除「广播 → 刷新 → 再广播」自激回路（`.refreshSkills(` 在 renderer 恒 1 处，由既有源码断言钉住） | closed |
| T-48-SC | Tampering | npm / pip / cargo 安装（48-01 / 48-02 / 48-03 各登记一次，同一风险） | high | accept | 本阶段**零新增运行时依赖**：`src/skill-picker-model.js` 为手写纯函数模块；无安装任务 ⇒ 无包合法性门禁触发条件。见 Accepted Risks Log `AR-48-01` | closed |
| T-48-07 | Tampering / Elevation of Privilege | `renderSlashPickerList` 的 `innerHTML` 模板（48-02 面向面板承接面） | high | mitigate | 同 T-48-03：全部插值经既有 `escapeHtml()`；tier → class 三方白名单查表；行尾标注 / `仅显式` / 徽标文案为定长；不可选中行不绑事件处理器 | closed |
| T-48-08 | Denial of Service | `openSlashPicker` → `ai:refresh-skills` → `skills:changed` → 面板重拉 | medium | mitigate | 刷新只在面板打开的那一次触发；广播处理器只重拉快照并 `digest` 早退（`renderer.js:9085-9089`）、**不**再触发刷新；`catch` 后保留旧快照（不产失败循环、不渲染成空态） | closed |
| T-48-09 | Tampering | 面板行点击绑定（技能名与本地命令同名时两行并存） | medium | mitigate | 绑定改为**扁平索引直绑**（`data-index`），取消按名字反查；不可选中行不绑处理器 ⇒ 点错行与「点了没反应」两个失败模式同时消除 | closed |
| T-48-10 | Tampering | `renderToolCard` 技能变体（技能名来自磁盘、随事件到达 renderer） | high | mitigate | 实测 `renderToolCard` 技能变体：名称与徽标走 `document.createElement` + `textContent`（`使用技能「…」`、`badge.label`），tier 经 `window.SkillPickerModel.TIER_BADGE[...]` 查表（表外跳过徽标）；该变体**零** `innerHTML`（文件内仅存的三处 `innerHTML` 是静态 SVG 字面量） | closed |
| T-48-11 | Spoofing | `read` 事件里的 `path` 由模型给出，可被伪造成指向技能文件 | low | accept | 误标只影响**展示**（卡片标题），不改数据、不放宽权限（技能不构成额外权限）；且以「缓存 `filePath` 规范化全等 + basename 必须为 `SKILL.md`」双条件约束误标面。见 `AR-48-02` | closed |
| T-48-12 | Elevation of Privilege | 徽标被读成「技能授予了额外权限」 | medium | mitigate | 徽标只表达来源分类（用户 / 内置 / 托管）；`allowed-tools` 全仓**不展示**（`renderSlashPickerList` 实测 0 处）；`docs/product/ai-skills.md:84/93/359` 明文「SDK `Skill` 接口无该字段、运行时也不强制、不可依赖」 | closed |
| T-48-13 | Information Disclosure | 重载路径把技能正文 / 路径带给 renderer | low | accept | `skillInvocation` 只含 `{ name, tier }`（不含正文与 `filePath`）；参数区既有展示语义不变。见 `AR-48-03` | closed |
| T-48-04-01 | Spoofing | `readSkillForInvocation` 的返回对象 | high | mitigate | 命中后把 `name` 重写为入参（目录名）：`return { ok: true, skill: { ...fresh, name }, source: entry.source }`（实测 1 处）⇒ `formatSkillInvocation` 注入块的 `name` 属性恒为目录名，frontmatter 声明的名字进不了注入块（46 D-08 冒名门禁） | closed |
| T-48-04-02 | Tampering | 同一性判据（`skills.find(...)`） | medium | mitigate | 判据固定为所在目录 `path.resolve` 全等；已删除 `|| skills[0]` 兜底；负例断言覆盖目录读不到的情形 | closed |
| T-48-04-03 | Information Disclosure | 读盘失败路径 | low | accept | 读盘失败 / 为空一律 `not_found`（不区分原因），与 D-13 推论「被跳过与不存在同形」一致；原因区分留给 Phase 50 诊断面。见 `AR-48-04` | closed |
| T-48-05-01 | Tampering | `handleAIStream` 的取消归属状态机 | high | mitigate | 锚点 `aiCancelledMessageId` 承载取消归属（`src/ai-cancel-state.js` 1 处定义 + `renderer.js` 9 处使用）；`resetRunState` 条件复位防「新一轮被越权复位 → 流式事件整批丢弃」；UAT round 2/3 的 test 4/16 端到端实测通过 | closed |
| T-48-05-02 | Denial of Service | 新一轮技能调用（用户可见输出丢失） | high | mitigate | 同 T-48-05-01；另由「三处回填后立即刷新该条气泡」保证用户至少看到 pill 与折叠块（UAT test 9/15 实测：pill `技能demo` + 折叠块 94 字符均出现） | closed |
| T-48-05-03 | Tampering | `src/index.html` 脚本加载顺序 | medium | mitigate | 实测 `<script src="skill-picker-model.js">` 位于 `:1021`，`renderer.js` 位于 `:1025` ⇒ 依赖模块先加载；源码扫描断言钉住 | closed |
| T-48-05-04 | Information Disclosure | 气泡 pill / 折叠块的技能名与正文 | low | accept | 正文与名称本就是用户自己技能目录的内容，气泡内不渲染任何未展示过的数据；渲染走 `textContent`。见 `AR-48-05` | closed |
| T-48-06-01 | Denial of Service | `handleSendAIMessage` 的本地否决 | high | mitigate | 已删除两段本地否决：实测 `handleSendAIMessage` 函数体内 `getSkills(` / `state.aiSkills` 读取 **0 处**；存在性 / 启停一律由主进程当场读盘裁定 | closed |
| T-48-06-02 | Tampering | 失败文案与判定入口 | medium | mitigate | 跨文件护栏：主进程 `skillErrorFromReason` 仍含两条文案、渲染端不含 —— 任一侧被删即变红，防 UX 静默丢失 | closed |
| T-48-06-03 | Spoofing | 移除渲染端预检后被绕过的可能性 | low | accept | 预检是**冗余**的（主进程文案逐字相同），不承担安全语义；真正的防冒名判定在 `readSkillForInvocation`（T-48-04-01）。见 `AR-48-06` | closed |
| T-48-06-04 | Information Disclosure | `skills:changed` 无条件重拉快照 | low | accept | `realmAPI.ai.getSkills()` 只返回收窄投影（无正文 / 无 `filePath` / 无诊断，46 D-06 已锁定），零 IO 且不出主窗口；无新增暴露面。见 `AR-48-07` | closed |
| T-48-07-01 | Spoofing | `_resolveSkillInvocation` 的 miss 重试块 | high | mitigate | 重试只调 `syncAgentSystemPrompt()`（实测 `_resolveSkillInvocation` 内 `refreshSkills(` 自调 **0 处**、`syncAgentSystemPrompt(` **2 处**），shadowed / disabled / tier 三字段全部由同一条 `refreshSkills` 管线产出；负例断言「运行期新增但并入禁用清单 → `skill_disabled` 零注入」「两根同名 → 注入胜出者正文且败者 `shadowed === true`」 | closed |
| T-48-07-02 | Denial of Service | 未知 / 误诊技能名触发的全量重扫 | medium | accept | 重试**至多一次**（源码门禁禁 `while` / `for`，行为用例断言 `rescanCalls === 1`），只在显式 `/skill:` 语法且判定 `not_found` 时触发；单次成本与「打开 `/` 面板」同款。见 `AR-48-08` | closed |
| T-48-07-03 | Tampering | 重扫抛错时的判定与状态 | medium | mitigate | 块内 `try/catch` + 可判别 `console.warn`（禁止静默），失败后保留原 `not_found` 判定并交回既有失败出口；不改 `isProcessing` 的既有复位职责 | closed |
| T-48-07-04 | Tampering | 实时读盘路径的 64 KiB 字节闸 | medium | accept | **WR-06 保持开放**（用户裁决随 Phase 49 处置）：重扫路径受益于 `createSkillsEnv` 的 `readTextFile` 字节闸，但**已缓存**技能的命中路径仍绕过该闸 —— 本阶段**不修、也不得声称已修**，`docs/product/ai-skills.md` §10.7 原样声明。见 `AR-48-09` | closed |
| T-48-07-05 | Denial of Service | 广播 → 重扫 → 再广播的自激回路 | medium | mitigate | 重扫必走 `syncAgentSystemPrompt()` 的忙分支（调用点先置 `isProcessing = true`）⇒ 既不改写 prompt 也不广播；广播只在非忙同步点发生，且 renderer 消费侧 `.refreshSkills(` 计数恒 1 | closed |
| T-48-08-01 | Spoofing | `_flushDeferredSkillsPrompt()` 与两个调用点 | medium | mitigate | 补刷只调**唯一权威入口** `syncAgentSystemPrompt()`（函数体逐字未改）；源码门禁断言全文件补刷调用**恰 2 处**（实测 2）、`promptWithContext` 内不残留任何脏标记读写 | closed |
| T-48-08-02 | Denial of Service | 补刷引入的额外全量重扫 | high | mitigate | 补刷首行**检脏早退**（实测 `_flushDeferredSkillsPrompt` 内 `if (!this._skillsPromptDirty) return;` 1 处，位于复位之前）；行为用例 K2 断言 `rescanCalls === 0`、K1 断言本轮 `rescanCalls === 2`（排除双刷） | closed |
| T-48-08-03 | Repudiation | 补刷失败被静默吞掉 | medium | mitigate | 失败时恢复「待回写」标记（不丢变更）+ `console.warn` 明确文案；K3 钉住「错误出口保留脏标记」，恢复语义由源码门禁（失败恢复置脏位于同步调用之后）钉住 | closed |
| T-48-08-04 | Tampering | miss 重扫 / 重试读盘的异常处理 | high | mitigate | 两个各自独立的 `try`：重扫抛错与重试读盘抛错都就地 `catch` + **可判别**告警（实测「…重扫失败…」1 处）+ **沿用原判定**（不赋 `result`、不逃逸、不升级为第三码）；err 取值一律 `err && err.message ? err.message : String(err)`（实测全文件 5 处），并用 `throw null` / 抛原始值的用例钉死「catch 体自身不得二次抛错」 | closed |
| T-48-08-05 | Denial of Service | 异常逃逸导致 `isProcessing` 永不复位 | medium | mitigate（部分） | 本计划把**新增的那个调用点**（重试读盘）纳入独立 `try`，消除本增量新引入的逃逸口。**诚实边界（非阻断，severity < high）**：`ai-manager.js:1046` / `:1174` 两处裸调、首次 `readSkillForInvocation` 与 `formatSkillInvocation` 动态 import **仍不在 try 内** ⇒ **WR-02 仍开**，用户未裁定，本阶段不修也不得声称已修（SUMMARY 已披露） | closed — below high threshold（残余面登记于 AR-48-10） |
| T-48-08-06 | Tampering | 已缓存技能的 64 KiB 字节闸旁路 | medium | accept | WR-06 用户裁决「保持开放、随 Phase 49 处置」；`docs/product/ai-skills.md` §10.7 的 WR-06 条原样保留。见 `AR-48-09` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (= `high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**`threats_open: 0`** —— 全部 36 条登记项均已闭合（`mitigate` 项经 L1 grep 深度核验；`accept` 项见 Accepted Risks Log）。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-48-01 | T-48-SC（48-01 / 48-02 / 48-03 各登记一次） | 本阶段零新增运行时依赖：`src/skill-picker-model.js` 为手写纯函数模块，无安装任务 ⇒ 包合法性门禁无触发条件 | 用户在 plan 期按 `must_haves.prohibitions` 首条锁定（零新增依赖） | 2026-09-12 |
| AR-48-02 | T-48-11 | `read` 事件 `path` 可被模型伪造 → **仅影响卡片标题展示**，不改数据、不放宽权限；另受「缓存 `filePath` 规范化全等 + basename = `SKILL.md`」双条件约束 | 用户在 plan 期裁定（48-03 威胁登记） | 2026-09-12 |
| AR-48-03 | T-48-13 | 重载路径 `skillInvocation` 只含 `{ name, tier }`，不含正文与 `filePath`；既有参数区展示语义不变 | 用户在 plan 期裁定 | 2026-09-12 |
| AR-48-04 | T-48-04-03 | 读盘失败 / 为空一律 `not_found`（不区分原因），与 D-13 推论「被跳过与不存在同形」一致；原因区分留 Phase 50 诊断面 | 用户在 plan 期裁定 | 2026-09-12 |
| AR-48-05 | T-48-05-04 | 气泡 pill / 折叠块展示的技能名与正文本就是用户自己技能目录的内容；渲染走 `textContent` | 用户在 plan 期裁定 | 2026-09-12 |
| AR-48-06 | T-48-06-03 | 渲染端预检是**冗余**的（与主进程文案逐字相同），不承担安全语义；真正的防冒名判定在 `readSkillForInvocation` | 用户在 plan 期裁定（48-06 威胁登记） | 2026-09-12 |
| AR-48-07 | T-48-06-04 | `skills:changed` 无条件重拉的是**收窄投影**（无正文 / 无 `filePath` / 无诊断），零 IO 且不出主窗口 | 用户在 plan 期裁定 | 2026-09-12 |
| AR-48-08 | T-48-07-02 | 未知 / 误诊技能名触发一次全量重扫，成本与「打开 `/` 面板」同款且**至多一次**（`rescanCalls === 1`）；成本与残余窗口已写进 `docs/product/ai-skills.md` §10.7 | 用户在 plan 期裁定 | 2026-09-12 |
| AR-48-09 | T-48-07-04 / T-48-08-06（WR-06） | **已缓存**技能的实时读盘命中路径仍绕过 64 KiB 字节闸。用户裁定**保持开放、随 Phase 49 处置**；本阶段文档原样声明「仍开放」，禁止声称已修 | 用户 2026-09-12 明确裁决 | 2026-09-12 |
| AR-48-10 | T-48-08-05（WR-02 残余面） | `ai-manager.js:1046` / `:1174` 两处 `_resolveSkillInvocation` 裸调、首次 `readSkillForInvocation` 与 `formatSkillInvocation` 动态 import 未包 `try` ⇒ 异常逃逸时 `isProcessing` 可能不复位。用户未裁定处置时机；severity `medium` < `high` ⇒ **非阻断**，登记为已知残余面 | 用户 2026-09-12 裁决「48-08 只把**本次新增的调用点**纳入 try，不顺手闭合 WR-02」 | 2026-09-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-13 | 36 | 36 | 0 | `/gsd-verify-work 48` → `secure-phase`（State B，**L1 grep 深度**；短路口径见下） |

**短路口径（§3 三条短路规则的第一条成立）**：`threats_open: 0` **且** `register_authored_at_plan_time: true`
（8 份 PLAN 全带可解析的 `<threat_model>` 块）**且** `asvs_level == 1`
⇒ 按 workflow 明文「skip to Step 6 directly」，**未派 `gsd-security-auditor`** —— L1 grep 深度对本级足够。
（若 `asvs_level >= 2` 则必须派审计子代理做 L2 边界放置 / L3 端到端追踪；本项目配置为 1。）

**L1 核验证据（逐条命中）**：见 Threat Register 的 Mitigation 列内联的实测计数与文件行号。
补充证据：本阶段测试面全绿（`node --test` 361 例 / 0 fail + `node tests/test-builtin-skills-seeder.js` 101 例 / 0 fail），
其中含多条针对上述缓解的源码门禁断言（如「补刷调用恰 2 处」「`.refreshSkills(` 恒 1 处」「`syncAgentSystemPrompt()` 函数体逐字未改」）。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log（10 条）
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-13

---
phase: "48"
slug: "skill-name"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-12"
validated: "2026-09-13"
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 依据：`48-RESEARCH.md` §Validation Architecture（含实测基线）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert`（Node 内置，零框架依赖）；渲染端 DOM 接线可选 Playwright `_electron`（先例 `tests/test-unified-navigation.js`） |
| **Config file** | none — 单文件脚本式，照 `tests/test-ai-skills.js` / `tests/test-builtin-skills-seeder.js` |
| **Quick run command** | `node --test tests/test-ai-skills.js` |
| **Full suite command** | 两段（**必须分开跑**，见下方豁免口径）：① `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-ai-conversations.js`（基线 183/0）；② `node tests/test-builtin-skills-seeder.js`（**直跑形式**，基线 101/0） |
| **Estimated runtime** | ~4 秒（实测 `test-ai-skills.js` = 64 例 / 0.71 s、seeder 直跑 101 例 / 1.12 s，2026-09-12 本机复核） |

**实测基线（地板）**：`node --test tests/test-ai-skills.js` → `# tests 64 / # suites 14 / # pass 64 / # fail 0`。
任何回归都以此 64 例为地板，不得下降。

**⚠ 豁免口径（既有红项，非本阶段引入）**：`node --test tests/test-builtin-skills-seeder.js` 在**基线即红** ——
`# tests 101 / # pass 100 / # fail 1`，红项是 `tests/test-builtin-skills-seeder.js:2200` 的
「AGENTS.md 的「测试：」行计数与实跑输出一致」（该用例在 `node --test` 下 `spawnSync` 嵌套跑
`node --test tests/test-ai-bash-policy.js`，孙进程输出不再是可解析的 TAP，故 `:2212` 失败）。
该文件**不在任何计划的 `files_modified` 内**，本阶段改动不会使其转绿 → **gate 用直跑形式**
`node tests/test-builtin-skills-seeder.js`；**不要**为本阶段去改该测试文件，也**不得**把这一红项算作本阶段的引入回归。

---

## Sampling Rate

- **After every task commit:** `node --test tests/test-ai-skills.js`（~1 s）
- **After every plan wave:** `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-ai-conversations.js` **并** `node tests/test-builtin-skills-seeder.js`（后者**直跑**，见豁免口径）
- **Before `/gsd:verify-work`:** 上述两段全绿 + `node --test tests/test-skill-picker-model.js` 全绿
- **Max feedback latency:** ~4 秒

---

## Per-Task Verification Map

> 本表已按**已交付的计划/任务分配**重键（本轮 plan 修订）：Task ID 用 `<plan>-T<n>`，Plan / Wave 列对应 `48-XX-PLAN.md` 的 frontmatter。
> `Status` 列仍由执行期 / `validate-phase` §6 回填（下表的 File Exists 只描述断言宿主是否已存在）。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01-T1 | 01 | 1 | DISC-02 | T-48-01 | 组装逐字节 = `formatSkillInvocation(skill, provenance + '\n\n' + args)`；实时读盘（改盘后二次调用读到新正文） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T1 | 01 | 1 | DISC-02 | T-48-01 | 拼接顺序 `[技能块, visionNotice, markerBlock, visionBlock, contextBlock]`；无技能时输出逐字符不变 | unit + 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T1 | 01 | 1 | DISC-02 | — | 重载装饰：user 行 `content` **逐字符等于** args、`skillInvocation` 键集合与 live 路径**消息对象**逐字相等；**必须覆盖含 `@` 引用 / 附件的完整增强串、args 自身含空行、以及「完整增强串 + args 为空」的四形态（① `prompt()` 裸技能块 / ② 附件 / ③ `@` 引用 / ④ `promptWithContext()` 无附件无引用，四例恒返回 `''`）**（`resolveSkillBubbleArgs` **八例**打表 + live/reload 同正文相等） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T1 | 01 | 1 | DISC-03 | — | 技能调用进历史（`agent.prompt` 收增强文本）+ `_ensureConversation` 收原始语法文本（标题不退化） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-02-T1 | 02 | 2 | DISC-03 | T-48-09 | renderer 技能不走 `handler` 分支（`kind` 分流 + 扁平索引直绑） | 源码扫描 | `node --test tests/test-skill-picker-model.js` | ✅（文件已存在） | ✅ green |
| 48-01-T3 | 01 | 1 | DISC-03 | — | 气泡：user 消息对象 `content` = **args**（不显示 `/skill:name` 原文）、IPC 载荷 = 完整语法文本（D-19，两变量解耦）；`skillInvocation` 元数据响应回传后回填 | 源码扫描 + 行为 | `node --test tests/test-ai-skills.js` + `tests/test-skill-picker-model.js` | ✅（新增） | ✅ green |
| 48-01-T3 | 01 | 1 | DISC-03 | — | 重发路径（`regenerateMessage` / `showAIError` 重试按钮）经 `buildResendPayload` 重组完整语法文本后再发：两处 `ai.prompt(` 实参均为 `payload` 且带 `await`、`buildResendPayload` 唯一实现、空 args 时载荷为 `/skill:{name}`（非空、不静默不动作）；`buildSkillSyntaxText` 与 `parseSkillRef` 的往返等式 | 源码扫描 + 单元（模型往返） | `node --test tests/test-ai-skills.js` + `tests/test-skill-picker-model.js` | ✅（新增） | ✅ green |
| 48-01-T2 | 01 | 1 | DISC-01 / DISC-04 | T-48-05 | 面板投影经 IPC 到达 renderer，形状正确且**零正文**（收窄投影：无 `content` / `filePath` / `diagnostics`） | unit | `node --test tests/test-ai-skills.js` | ✅（断言组新增） | ✅ green |
| 48-02-T1 | 02 | 2 | DISC-01 | T-48-07 | `/` 展平数组 = 技能分区 + 命令分区；实时过滤两档；空分组标题不渲染 | unit | `node --test tests/test-skill-picker-model.js` | ✅（文件已存在） | ✅ green |
| 48-01-T2 | 01 | 1 | DISC-04 | — | 三档 `tier` 判定（`source==='user'` → user / name ∈ seededNames → builtin / 非 seeded managed），seeded 集合由测试注入 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T2 | 01 | 1 | DISC-04 | — | 遮蔽条目可见（投影保留 `shadowed` + `shadowedBy`） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-02-T1 | 02 | 2 | DISC-04 | T-48-09 | `shadowed` / 与本地命令同名的条目 `selectable === false`，其余为 true | unit | `node --test tests/test-skill-picker-model.js` | ✅（文件已存在） | ✅ green |
| 48-03-T1 | 03 | 3 | DISC-05 | T-48-10 | `_resolveSkillMarker` 四类路径（绝对 / 相对 / 非 SKILL.md / 工作区外）+ 四条负例 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-03-T1 | 03 | 3 | DISC-05 | T-48-10 | `read` 事件带 `skill_invocation`；renderer 映射到 `toolExecution.skillInvocation`；renderer **零**路径字符串匹配 | unit + 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-03-T2 | 03 | 3 | DISC-05 | T-48-13 | 重载链路用**同一个** `_resolveSkillMarker` 重建标记，形状与实时链路逐字相等；技能删除后不挂键且不丢消息 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T2 | 01 | 1 | （D-18 / 硬约束） | T-48-04 | `REALM_SYSTEM_PROMPT` 含「技能」与「工具」，且 `buildSystemPrompt()` 技能段 `=== buildSkillsPrompt()`（未被改写） | 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增 + 既有 :1184） | ✅ green |
| 48-01-T1 / T3 | 01 | 1 | DISC-06 | T-48-01 | 不存在 / 已禁用 → 结构化错误码（`skill_not_found` / `skill_disabled`，**无第三个码**）+ system-note 文案（不静默；被整条跳过的技能与不存在同形）。**main 侧错误码的唯一判据 = 48-01-T1 的 `skillErrorFromReason` 打表断言**（两码 + 两条文案 + 值域无第三码） | unit | `node --test tests/test-ai-skills.js`（main 侧错误码）+ `tests/test-skill-picker-model.js`（renderer 分支选择） | ✅/✅（文件已存在） | ✅ green |
| 48-01-T1 | 01 | 1 | DISC-07 | — | `disableModelInvocation` **可**显式调用（`{ok:true}`）、**不**进 system prompt、**不**被标 `promptOmitted`；与 `disabled` 互不蕴含 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T3 | 01 | 1 | DISC-07 | — | 技能分支无本地否决（不读快照、不复制失败文案）；`disableModelInvocation` 不参与任何拒绝条件 —— 手打入口面由主进程 `readSkillForInvocation` 的 D 组断言 + 本行渲染端源码断言共同承担（G-48-3 修订，2026-09-12） | 源码扫描 | `node --test tests/test-skill-picker-model.js` | ✅（文件已存在） | ✅ green |
| 48-02-T1 / T2 | 02 | 2 | DISC-07 | T-48-07 | 面板「仅显式」gating：标记只由该 flag 决定、**不**改变可选中性（B 组 + 渲染侧条件断言） | unit + 源码扫描 | `node --test tests/test-skill-picker-model.js` | ✅（文件已存在） | ✅ green |
| 48-01-T2 | 01 | 1 | （P8） | T-48-06 | 面板刷新调用 `syncAgentSystemPrompt()`；其函数体未被重构 | 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（既有 :1278 继续绿 + 新增调用点断言） | ✅ green |
| 48-02-T3 | 02 | 2 | （P8） | T-48-08 | 面板 stale-while-revalidate：打开用快照立即渲染 + 后台刷新 + 广播只重拉快照（无自激回路、无 loading 态） | 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T1 | 01 | 1 | （硬约束） | — | 实时读盘：改盘后立即调用读到新正文；跨轮不重读 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-01-T1 | 01 | 1 | （硬约束） | — | `src/index.html` 在 `renderer.js` 之前加载 `skill-picker-model.js`（wave 1 可端到端运行的前提） | 源码扫描 | `node -e "…script-order…"`（见 48-01 Task 1 `<verify>`） | ✅ | ✅ green |
| 48-07-T1 | 07 | 6 | DISC-02 | T-48-07-01 | 运行期新增技能目录（未重扫）→ `/skill:<新名>` 成功；miss 时经唯一权威入口 `syncAgentSystemPrompt()` 重扫**一次**再当场读盘（shadowed / disabled / tier 三字段全部来自加载管线，不新增第二套判定）；缓存命中时零重扫 | unit + 行为 | `node tests/test-ai-skills.js` | ✅（新增） | ✅ green |
| 48-08-T1 | 08 | 7 | DISC-02 | T-48-08-02 | 延迟补刷唯一实现 `_flushDeferredSkillsPrompt()`（`prompt()` 与 `promptWithContext()` 两个成功出口共用，全文件恰 2 处调用）；首行检脏早退 ⇒ 脏标记为假时零重扫；错误出口与 `_cleanupCurrentAgent()` 不补刷；纯文本 `/skill:<运行期新增名>` 成功后脏标记归假、prompt 已含该技能、`skills:changed` 恰广播一次（`rescanCalls === 2`，无双刷） | unit + 行为 | `node tests/test-ai-skills.js` | ✅（已有） | ✅ green |
| 48-08-T2 | 08 | 7 | DISC-06 | T-48-08-04 | 重扫与重试读盘各自独立 `try`：重扫抛错（含 `throw null` / 抛原始字符串）时正常 resolve、判定沿用 `skill_not_found`、不升级成第三码、不重复读盘；重扫成功但重试读盘抛错时同样沿用原判定；两条告警文案可判别（「重扫失败」/「重试读盘失败」）；err 取值一律 `err && err.message ? err.message : String(err)` | unit + 行为 | `node tests/test-ai-skills.js` | ✅（已有） | ✅ green |
| 48-08-T3 | 08 | 7 | DISC-02 | T-48-08-03 | `docs/product/ai-skills.md` §10.7 落地时机改为「任一轮成功出口（含纯文本轮）/ 打开面板 / Agent 创建或重建」并补失败恢复语义、旧措辞零命中、WR-06 开放声明原样在册；§七 与 `AGENTS.md` 技能域测试清单的例数 = 实测值且覆盖面补本次两条修复；`48-VALIDATION.md` 三行 10 列对齐 | 文档 + 结构 | `node tests/test-ai-skills.js` | ✅（已有） | ✅ green |

**A–E 五组断言清单（共 35 条）见 `48-RESEARCH.md` §Validation Architecture**；上表已把它们逐条落到 `48-XX-PLAN.md` 的 task `<acceptance_criteria>` / `<verify>`（GROUP A/B → 48-02-T1、GROUP C → 48-01-T1 + 48-03-T1、GROUP D → 48-01-T1/T2/T3、GROUP E → 48-01-T2 + 48-02-T2/T3 + 48-03-T1）。

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/skill-picker-model.js` — 纯逻辑抽取（双模式导出）：`parseSkillRef` / `extractArgs` / 过滤两档 / 展平 + selectable。无它则 A/B/C 三组断言无处可测
- [x] `tests/test-skill-picker-model.js` — A/B/C 组宿主（含 `readSource('src/renderer.js')` 的接线断言）
- [x] `tests/test-ai-skills.js` 扩展 — D 组（实时读盘 / 组装顺序 / 投影 / tier / `promptOmitted` / read 标记 / 重载装饰 —— 重载装饰必须覆盖**含 `@` 引用 / 附件的完整增强串**、**args 自身含空行**、以及 **「完整增强串 + args 为空」的四形态**），以及 `resolveSkillBubbleArgs`（八例）/ `parseStoredSkillInvocation` / `skillErrorFromReason` 的纯函数打表，与重发路径的 **正向**源码扫描（`buildResendPayload` 唯一实现 + 两处实参为 `payload` + `await`）
- [x] 测试夹具：seeded 集合注入辅助（`seeder.setBuiltinDepsForTest({ srcDir })` + `t.after` 复位），否则任何触达 tier 的断言以 TypeError 失败（P-48-07）
- [x] 无需框架安装（`node:test` 内置）

**备选路线**：若 plan 期拒绝 `src/skill-picker-model.js` 双模式导出（本阶段引入的新模式），则 Wave 0 缺口变为「扩展 `tests/test-unified-navigation.js` 同款 Playwright `_electron` 断言组」——需 GUI 环境 + 独立 userData，耗时与稳定性风险显著更高。二者择一，但必须有一处覆盖。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 50+ 技能 + 两个 sticky 分组标题下，220px 面板可视行数与观感可接受，分组与标注结构无需改动 | DISC-01（backstop） | 视觉观感无法自动化裁决 | 往 `agent-workspace/skills/` 生成 50 个最小技能（`for i in $(seq -w 1 50); do mkdir -p .../skills/skill-$i; printf -- '---\nname: skill-%s\ndescription: 测试技能 %s\n---\n\n正文\n' $i $i > .../skills/skill-$i/SKILL.md; done`），`npm run dev` 打开面板，记录 ① 首屏可见行数；② 滚动到「命令」分区是否需多次滚动；③ 行尾标注 `flex-wrap` 后的行高是否可读。**若不可接受，只调面板高度常量，不得改动分组 / 标注结构**（UI-SPEC 明文） |

**状态：已执行**（2026-09-13，UAT round 4 item 20；55 技能数据集 × 面板宽 280/360/600 三档；
数据 `/tmp/uat48-r4-t20b.json`，截图 `/tmp/uat48-r4-t20-w{280,360,600}[-bottom].png`）——
结构无破版、两个 sticky 分组标题上下视图均常驻、行尾标注 `未进提示词 · 超预算` 在 280px 下换行后仍完整可读，
用户拍板 pass。唯一登记边界：名称 `nowrap; flex-shrink:0`（UI-SPEC 存量形态，本就不带 ellipsis）
导致 >~32 字符的目录名在 280px 面板下需横向滚动，属已知边界、不新开 gap。

*其余所有阶段行为均有自动化验证。*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s（实测两段 ~2.0 s：361 例 / 895 ms + 101 例 / 1080 ms）
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-13（`/gsd-verify-work 48` 的 verify:post → validate-phase §3 判定**零 gap**，未派 auditor）

---

## Validation Audit 2026-09-13

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**审计口径**（State A：VALIDATION.md 已存在 → 审计并回填）：

| 检查项 | 判据 | 结果 |
|---|---|---|
| 断言宿主存在性 | 矩阵 28 行的 `Automated Command` 只指向 `tests/test-ai-skills.js` 与 `tests/test-skill-picker-model.js` 两个文件 | 两者均存在且在盘上 ✅（原 6 处 `❌ W0` 占位已改为「文件已存在」） |
| 第一段全量 | `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-ai-conversations.js` | `# tests 361 / # pass 361 / # fail 0`（基线 183 → 361）✅ |
| 第二段全量 | `node tests/test-builtin-skills-seeder.js`（**直跑**形式，见上方豁免口径） | `# tests 101 / # pass 101 / # fail 0` ✅ |
| 脚本顺序行 | `src/index.html` 的 `<script>` 标签序：`skill-picker-model.js:1021` < `renderer.js:1025` | 成立 ✅ |
| Wave 0 交付 | 4 项 Wave 0 全部落地并被上述两段覆盖 | 全部已生成 ✅ |
| 唯一 Manual-Only 项 | 「50+ 技能 / 220px 面板观感」backstop | **2026-09-13 已实测**：UAT round 4 item 20 —— 55 技能 × 面板宽 280/360/600 三档，结构无破版、sticky 标题常驻、状态标注与徽标三档完整可读（用户拍板 pass；超长目录名在 280px 下水平裁切记为已知边界）✅ |

**无 gap ⇒ 按 §3「No gaps → skip to Step 6」未派 `gsd-nyquist-auditor`。**

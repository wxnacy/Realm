---
phase: "49"
slug: "manage-skill-ai"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-13"
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 依据：`49-RESEARCH.md` §Validation Architecture（含真实沙箱实跑探针输出）。
> **本文件在 plan 期创建时按需求维度键控**；`Per-Task Verification Map` 的 Task ID 列在计划落盘后由执行期 / `validate-phase` §6 回填为 `<plan>-T<n>`。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test`（Node 22.22.0 内置）+ `node:assert`；无第三方测试框架 |
| **Config file** | none — 脚本式直接运行（`package.json` 无 `test` 脚本），照 `tests/test-ai-skills.js` 风格 |
| **Quick run command** | `node tests/test-manage-skill.js`（新增域，秒级） |
| **Full suite command** | `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node tests/test-agent-workspace.js && node tests/test-skill-picker-model.js` |
| **Estimated runtime** | ~2 秒（实测 `test-ai-skills.js` 147 例 / ~477 ms、`test-agent-workspace.js` 21 例 / ~134 ms） |

**实测基线（地板）**：`node tests/test-ai-skills.js` → **147/147**；`node tests/test-agent-workspace.js` → **21/21**。
任何回归都以下列基线为地板，不得下降。

**⚠ 豁免口径（既有红项，非本阶段引入）**：`node tests/test-builtin-skills-seeder.js` 的「DOC-02 计数断言」
在 Node 22 下**基线即红**（D-48-A，与 49 无关，修法见 `48-skill-name/deferred-items.md`）。
该文件不在本阶段任何计划的 `files_modified` 内 → 若纳入门禁必须显式标注该已知红点，或先按 deferred-items 修掉；
**不得**把这一红项算作本阶段的引入回归。

---

## Sampling Rate

- **After every task commit:** `node tests/test-manage-skill.js`（或该 task 触碰的断言宿主，秒级）
- **After every plan wave:** `node tests/test-ai-skills.js && node tests/test-agent-workspace.js`（回归地板，必绿）
- **Before `/gsd:verify-work`:** 上述 Full suite command 全绿
- **Max feedback latency:** ~2 秒

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| （回填） | — | — | MGMT-01 | T-49-01 | 工具存在且 `action` enum 含 `create` / `update` / `delete` 三值；`executionMode === 'sequential'` | 源码扫描 | `node tests/test-ai-skills.js` | ✅ 基建在 | ⬜ pending |
| （回填） | — | — | MGMT-01 | T-49-01 | 三动作各产生正确磁盘终态（create 建目录+文件；update 覆写正文；delete 递归删整目录含 `scripts/`） | 行为 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | MGMT-02 | T-49-02 | `parameters.properties` 键集合 == `{action, name, content, description}`，**无 `path`** | 源码扫描 | `node tests/test-ai-skills.js` | ✅ 基建在 | ⬜ pending |
| （回填） | — | — | MGMT-02 | T-49-02 | 服务端二次校验：七种非法 name / description 超长 / 正文超 64 KiB 被拒且原因可读（LLM 参数不可信） | 单元 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | MGMT-03 | T-49-03 | 原子写：失败不留半成品（操作前后 `readdirSync` deepStrictEqual）；dest 逃逸被拒 `permission_denied` | 行为 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | MGMT-04 | T-49-04 | seeded 的 create / update / delete **三入口**一律被拒，`code === 'seeded_protected'`（**显式注入 `seededNames`**） | 单元（关键靶心） | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | MGMT-04 | T-49-04 | 反向例：`managed-skills/ai-made/` 且**不**列入 seededNames → 允许创建（证明不是「managed 目录一律拒」） | 单元 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | MGMT-05 | T-49-05 | 忙时语义：工具执行期 `_skillsPromptDirty === true` 且 prompt **不含**新技能名 → 下一轮成功出口 `false` + prompt 含新技能名 + `skills:changed` 广播**恰一次** + `rescanCalls === 2` | 行为（K 组 `promptCtx` 风格） | `node tests/test-ai-skills.js` | ✅ 夹具在 | ⬜ pending |
| （回填） | — | — | MGMT-06 | T-49-01 | 工具描述含「优先增强已有技能」与「仅在用户明确要求时」两条文案 | 源码扫描 | `node tests/test-ai-skills.js` | ✅ 基建在 | ⬜ pending |
| （回填） | — | — | 判据 4 | T-49-03 | 写入不触及 `ai-memory/` / `attachments/`（操作后二者目录快照不变） | 行为 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | D-02 | T-49-06 | 卡片标记：start 打 `{action, name}`、end 并入 `{tier, code, promptIncluded}`；重载链路同形；失败态 code/tier 经工具注册层元数据（SDK `details` 恒为 `{}`，不可依赖） | 源码扫描 + 行为 | `node tests/test-ai-skills.js` | ✅ H 组 `markerCtx` 可复用 | ⬜ pending |
| （回填） | — | — | D-07 | T-49-04 | 四类撞名分别返回 `seeded_protected` / `user_owned_conflict` / `already_exists` / `not_found` 且 `create` 不落盘 | 单元 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | D-08 | T-49-02 | `description` 跑 `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS` 两组；`content` **只**跑注入组（`content: 'api_key: YOUR_KEY_HERE'` 放行，`description: 'api_key: real-key-123'` 被拒） | 单元 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | D-09 | T-49-02 | 顺序：零宽字符包裹的注入措辞**仍被拒**（先扫描后净化；顺序颠倒则放行 ⇒ 用例必然转红） | 单元 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | D-10 | T-49-07 | 第 `MAX_MANAGED_SKILLS + 1` 个**非 seeded** managed 技能创建被拒；`update` / `delete` 不受限 | 单元 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |
| （回填） | — | — | — | — | 新增模块零 electron 依赖（`ai-skills-manager.js` 仍不含 `require('electron')`） | 源码扫描（既有依赖纪律 describe 自动覆盖） | `node tests/test-ai-skills.js` | ✅ 基建在 | ⬜ pending |
| （回填） | — | — | — | — | 幽灵技能护栏：写侧预筛上限与加载期闸口**同源同值**（手工造超限文件 → `refreshSkills` 产 `realm_skill_md_too_large`；description 同理 `isDescriptionUnusable` 跳过） | 自动化 | `node tests/test-manage-skill.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**回填规则**：计划落盘后把每行的 Task ID / Plan / Wave 列按 `49-XX-PLAN.md` 的 frontmatter 重键；
一个计划 task 可覆盖多行（同一断言组）。

---

## 关键可验证主张 → 验证方式

> 来自 `49-RESEARCH.md` §Validation Architecture，均为**实跑探针已确认**的沙箱行为。

| # | 主张 | 证据类型 | 判据 |
|---|------|---------|------|
| V1 | 沙箱 `renameFile` 从 `.tmp/` 到 `managed-skills/<name>/SKILL.md` 成功且跨目录无 EXDEV | 自动化 | `env.renameFile(...).ok === true` 且目标内容 == 写入内容 |
| V2 | `renameFile` 对**已存在**目标原子替换（update 与 create 共用同一条写路径） | 自动化 | 连续两次写同一 dest：第二次 `ok === true`、dest 内容 == 第二次内容、**目录内文件数恒为 1** |
| V3 | `createDir` 对**已存在目录返回 `ok: true`**（`recursive` 默认 true）⇒ 撞名判定**不可**依赖它，必须走 `exists` | 自动化（回归护栏） | 连续两次 `createDir` 都 `ok === true`；测试注释写明「故撞名判定走 `exists`」 |
| V4 | `renameFile` 到**缺失父目录**返回 `not_found` ⇒ `createDir` 是硬前置 | 自动化 | 未 `createDir` 直写 → `ok === false` 且 `code === 'not_found'` |
| V5 | `renameFile` dest 越界被拒 | 自动化 | `code === 'permission_denied'` 且目标未产生 |
| V6 | 失败路径不留半成品 | 自动化 | 注入触发失败的场景 → 清理后 `fs.readdirSync(managedDir)` 与操作前 **deepStrictEqual** |
| V7 | seeded 保护按**登记表**而非目录位置 | 自动化（**关键靶心**） | `managed-skills/find-skills/`（位置 = managed）且注入 `seededNames: ['find-skills']` → `code === 'seeded_protected'`；反向例见上表 |
| V8 | 忙时语义时序（**唯一难以直接自动验证**的主张） | 行为 + 代码断言 | 见下节 |
| V9 | 写侧预筛与加载期闸口同源 | 自动化（幽灵技能护栏） | 见上表末行 |

---

## 时序断言的判定证据设计（忙时语义 V8）

> 既有 K 组（48-08）已给出可判定证据的**范式**，plan / executor 应照抄而非另创。

**三个可判定证据（按强度递增）：**

1. **代码断言（零成本）**：对 `ai-manager.js` 的 `syncAgentSystemPrompt` 方法体源码扫描，断言忙分支
   （含 `this.isProcessing ||` 与 `_skillsPromptDirty = true`）**位于 `refreshSkills(` 调用之后、`getSkillsSnapshot()` 之前**。
   目的：钉住「忙时缓存已更新、仅 prompt 未回写」这一 D-13 前提不被重构破坏。

2. **行为断言（靶心，推荐）**：用 `promptCtx` 夹具（`Object.create(aiManager.prototype)` + own-property 包装计数，真实方法体逐字未改）：
   - 执行 `manage_skill`（或经 manager 的 `createManagedSkill`）后断言 `ctx._skillsPromptDirty === true` 且 `ctx.agent.state.systemPrompt` **不含**新技能名；
   - 随后 `aiManager.prototype.prompt.call(ctx, '你好')`（`agent.prompt` 为 stub），断言 `_skillsPromptDirty === false`、`agent.state.systemPrompt` 含新技能名且 `=== aiManager.buildSystemPrompt()`、`broadcast` 捕获 `['skills:changed']` **恰一次**；
   - 断言 `ctx.rescanCalls === 2`（工具路径一次 + 出口补刷一次，**不是 3** —— 证明没有照 ROADMAP 字面写两次调用）。

3. **端到端（人工 / UAT）**：`npm run dev` → 让 AI 建一个技能 → 观察工具卡片 → 发下一条消息问「你有哪些技能」→ 应答含新技能。此层需真实 LLM，归 UAT。

**已知判定边界（须在计划的风险说明中如实标注）**：夹具把 `agent.prompt` 与 `_ensureConversation` stub 掉，
因此证据 2 验证的是**出口行为**而非 SDK 往返；真实 `isProcessing` 在工具执行期的取值**不由该用例直接证明** ——
它由「`prompt()` 在 `:1043` 置 true、只在成功/失败出口复位」的**代码事实**加上证据 3 的端到端观察共同支撑。
**不要**把证据 2 表述为「已证明工具执行期 `isProcessing` 为 true」。

---

## Wave 0 Requirements

- [ ] `tests/test-manage-skill.js` —— 新建；承载 MGMT-01/02/03/04 的全部值域矩阵 + D-08/D-09/D-10 + 判据 4
  - 最小夹具（照抄既有风格）：`withTempRoot(t)`（`mkdtempSync` + `t.after` 清理 + `workspace.setWorkspaceDir(null)` + `aiSkills._resetCacheForTest()`）、`createSandboxEnv({ cwd: root })`、`writeSkill(dir, name, {description, body, frontmatterName})` 造型
  - **seeded 注入方式（硬约束）**：直接向 manager 函数传 `seededNames: [...]` 数组，**严禁走 `getSeededSkillNamesSafe()`** —— 后者在纯 Node 下降级为 `[]`，会让 seeded 保护用例**假绿**（这正是 D-11 签名设计的目的）
- [ ] `tests/test-ai-skills.js` 扩三组：
  - `manage_skill` 工具项源码断言（schema 键集合 / `executionMode` / 描述两条文案）
  - `manage_skill` 标记两时点 + 重载同形（复用 H 组 `markerCtx` 风格）
  - 刷新链行为用例（复用 K 组 `promptCtx` 风格，断言 `rescanCalls === 2` + 脏标记流转 + 广播恰一次）
- [ ] **D-08 阻塞级裁决的连带 Wave 0**：若采纳 RESEARCH 的方案 A（给 `scanInjectionPatterns` 加可选参 `{ includeCredentials = true }`），
      则 `ai-memory-manager.js` 进入本阶段改动文件集，必须保留既有 `node --test test/memory/*.test.js` 全绿；
      若采纳方案 B（导出两张模式表），则 Wave 0 需为新导出补断言
- [ ] Framework install: **不需要**（`node:test` 内置）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 端到端可见性：AI 建技能后，**下一条消息**的应答中能引用该技能，工具卡片显示「创建技能「name」」+ 来源徽标 | MGMT-01 / MGMT-05（判据 1） | 需真实 LLM 往返与视觉观感，无法自动化裁决 | `npm run dev` → 让 AI 建一个技能（如「写提交信息规范」）→ 观察工具卡片标题与徽标 → 发下一条消息问「你有哪些技能」→ 应答含新技能名 → 打开 `/` 面板确认列表已同步 |

*其余所有阶段行为均有自动化验证。*

---

## Known-Open Items（plan 期必须裁决，影响文件集）

| # | 事项 | 影响的产物 | 状态 |
|---|------|-----------|------|
| OQ-1 | **D-08 字段分离扫描的实现方式**：`scanInjectionPatterns` 当前**无条件连跑**两组模式且两张表均未导出 ⇒ 按现有导出实现 D-08 会误伤合法技能的配置示例。方案 A：加可选参 `{ includeCredentials = true }`（向后兼容）；方案 B：导出两张模式表由调用方组合 | `ai-memory-manager.js` 是否进入 `files_modified` | ⬜ 待裁决 |
| OQ-2 | `description` 上限 1024 的常量归属（加入 `LIMITS` 第四项，不破坏既有三限额断言） | `ai-skills-manager.js` 的 `LIMITS` | ⬜ 待裁决 |
| OQ-3 | 测试文件组织（RESEARCH 推荐：新建 `tests/test-manage-skill.js` 承载值域矩阵，`test-ai-skills.js` 补接线断言） | Wave 0 清单 | ⬜ 待裁决 |
| OQ-4 | `content` 内含 frontmatter 时的处理（RESEARCH 推荐静默剥除，不引入新错误码） | 校验器语义 | ⬜ 待裁决 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

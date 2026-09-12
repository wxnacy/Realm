---
phase: "48"
slug: "skill-name"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-12"
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
| **Full suite command** | `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-builtin-skills-seeder.js tests/test-ai-conversations.js` |
| **Estimated runtime** | ~3 秒（实测 `test-ai-skills.js` = 64 例 / 1.02 s，2026-09-12） |

**实测基线（地板）**：`node --test tests/test-ai-skills.js` → `# tests 64 / # suites 14 / # pass 64 / # fail 0`。
任何回归都以此 64 例为地板，不得下降。

---

## Sampling Rate

- **After every task commit:** `node --test tests/test-ai-skills.js`（~1 s）
- **After every plan wave:** `node --test tests/test-ai-skills.js tests/test-skill-picker-model.js tests/test-agent-workspace.js tests/test-ai-bash-policy.js tests/test-builtin-skills-seeder.js tests/test-ai-conversations.js`
- **Before `/gsd:verify-work`:** 全绿 + `node --test tests/test-skill-picker-model.js` 全绿
- **Max feedback latency:** ~3 秒

---

## Per-Task Verification Map

> 计划尚未生成（本文件在 plan 期播种，per-task 行由 `validate-phase` §6 或执行期回填）。
> 下表以需求为单位给出可自动化的验收口径，plan 生成后逐 task 对应到 `48-XX-PLAN.md`。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01-XX | 01 | 1 | DISC-01 | — | 面板投影经 IPC 到达 renderer，形状正确且**零正文**（收窄投影） | unit | `node --test tests/test-ai-skills.js` | ✅（断言组新增） | ⬜ pending |
| 48-01-XX | 01 | 1 | DISC-01 | — | `/` 展平数组 = 技能分区 + 命令分区；实时过滤两档；空分组标题不渲染 | unit | `node --test tests/test-skill-picker-model.js` | ❌ W0 | ⬜ pending |
| 48-02-XX | 02 | 2 | DISC-02 | — | 组装逐字节 = `formatSkillInvocation(skill, provenance + '\n\n' + args)` | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-02-XX | 02 | 2 | DISC-02 | — | 拼接顺序 `[技能块, visionNotice, markerBlock, visionBlock, contextBlock]`；无技能时逐字符不变 | unit + 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-02-XX | 02 | 2 | DISC-03 | — | 技能调用进历史（`agent.prompt` 收增强文本）+ `_ensureConversation` 收原始语法文本 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-02-XX | 02 | 2 | DISC-03 | — | renderer 技能不走 `handler` 分支（`kind` 分流） | 源码扫描 | `node --test tests/test-skill-picker-model.js` | ❌ W0 | ⬜ pending |
| 48-01-XX | 01 | 1 | DISC-04 | — | 三档 `tier` 判定（user / seeded / 非 seeded managed），seeded 集合由测试注入 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-01-XX | 01 | 1 | DISC-04 | — | 遮蔽条目可见（投影保留 `shadowed` + `shadowedBy`），且不可选中 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-03-XX | 03 | 3 | DISC-05 | — | `matchSkillByPath` 四类路径（绝对 / 相对 / 非 SKILL.md / 工作区外） | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-03-XX | 03 | 3 | DISC-05 | — | `read` 事件带 `skill_invocation`；renderer 映射到 `toolExecution.skillInvocation` | unit + 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-03-XX | 03 | 3 | DISC-05 | — | D-18 措辞存在且 `buildSystemPrompt()` 技能段未被改写 | 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（新增 + 既有 :1184） | ⬜ pending |
| 48-02-XX | 02 | 2 | DISC-06 | — | 不存在 / 被跳过 / 读盘失败 → 结构化错误码 + system-note 文案（不静默） | unit | `node --test tests/test-ai-skills.js` + `tests/test-skill-picker-model.js` | ✅/❌ W0 | ⬜ pending |
| 48-02-XX | 02 | 2 | DISC-07 | — | `disableModelInvocation` **可**显式调用，且**不**被标 `promptOmitted` | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |
| 48-01-XX | 01 | 1 | DISC-07 | — | 面板行打「仅显式」标记 | 源码扫描 + unit | `node --test tests/test-skill-picker-model.js` | ❌ W0 | ⬜ pending |
| 48-01-XX | 01 | 1 | （P8） | — | 面板刷新调用 `syncAgentSystemPrompt()`；其函数体未被重构 | 源码扫描 | `node --test tests/test-ai-skills.js` | ✅（既有 :1278 继续绿 + 新增调用点断言） | ⬜ pending |
| 48-02-XX | 02 | 2 | （硬约束） | — | 实时读盘：改盘后立即调用读到新正文；跨轮不重读 | unit | `node --test tests/test-ai-skills.js` | ✅（新增） | ⬜ pending |

**A–E 五组断言清单（共 35 条）见 `48-RESEARCH.md` §Validation Architecture**，plan 期须逐条落到 task 的 `<acceptance_criteria>` / `<verify>`。

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/skill-picker-model.js` — 纯逻辑抽取（双模式导出）：`parseSkillRef` / `extractArgs` / 过滤两档 / 展平 + selectable。无它则 A/B/C 三组断言无处可测
- [ ] `tests/test-skill-picker-model.js` — A/B/C 组宿主（含 `readSource('src/renderer.js')` 的接线断言）
- [ ] `tests/test-ai-skills.js` 扩展 — D 组（实时读盘 / 组装顺序 / 投影 / tier / `promptOmitted` / read 标记 / 重载装饰）
- [ ] 测试夹具：seeded 集合注入辅助（`seeder.setBuiltinDepsForTest({ srcDir })` + `t.after` 复位），否则任何触达 tier 的断言以 TypeError 失败（P-48-07）
- [ ] 无需框架安装（`node:test` 内置）

**备选路线**：若 plan 期拒绝 `src/skill-picker-model.js` 双模式导出（本阶段引入的新模式），则 Wave 0 缺口变为「扩展 `tests/test-unified-navigation.js` 同款 Playwright `_electron` 断言组」——需 GUI 环境 + 独立 userData，耗时与稳定性风险显著更高。二者择一，但必须有一处覆盖。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 50+ 技能 + 两个 sticky 分组标题下，220px 面板可视行数与观感可接受，分组与标注结构无需改动 | DISC-01（backstop） | 视觉观感无法自动化裁决 | 往 `agent-workspace/skills/` 生成 50 个最小技能（`for i in $(seq -w 1 50); do mkdir -p .../skills/skill-$i; printf -- '---\nname: skill-%s\ndescription: 测试技能 %s\n---\n\n正文\n' $i $i > .../skills/skill-$i/SKILL.md; done`），`npm run dev` 打开面板，记录 ① 首屏可见行数；② 滚动到「命令」分区是否需多次滚动；③ 行尾标注 `flex-wrap` 后的行高是否可读。**若不可接受，只调面板高度常量，不得改动分组 / 标注结构**（UI-SPEC 明文） |

*其余所有阶段行为均有自动化验证。*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: "46"
slug: "prompt"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-11"
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert`（Node 内置，零框架依赖） |
| **Config file** | none — 单文件脚本式，照 `tests/test-agent-workspace.js` / `tests/test-ai-bash-policy.js` |
| **Quick run command** | `node tests/test-ai-skills.js` |
| **Full suite command** | `node tests/test-ai-skills.js && node tests/test-agent-workspace.js && node tests/test-ai-bash-policy.js && node tests/test-ai-conversations.js` |
| **Estimated runtime** | ~5 seconds |

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

**纯 Node 可测性前提（研究实测确认）：** `require('../agent-workspace')`、`require('../ai-memory-manager')`、`require('../ai-manager')` 在纯 Node 下均可加载；`setWorkspaceDir(tmp)` 覆写后 `buildWorkspacePrompt()` 与 `buildGlobalSnapshot()` 可在纯 Node 下执行。
⚠️ `ai-manager.js` 目前**未导出** `buildSystemPrompt` —— 需按 `ai-manager.js:5649-5651` 先例追加一行 `module.exports.buildSystemPrompt = buildSystemPrompt;`，否则"技能段确实进 prompt"无法断言。

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-ai-skills.js`
- **After every plan wave:** Run `node tests/test-ai-skills.js && node tests/test-agent-workspace.js && node tests/test-ai-bash-policy.js && node tests/test-ai-conversations.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | SKILL-01 | — | 两目录存在且在沙箱 `resolveInside` 放行范围内 | unit | `node tests/test-ai-skills.js` | ❌ W0 | ⬜ pending |
| 46-01-02 | 01 | 1 | SKILL-01 | V4 | 沙箱 `readTextFile(<skill path>)` → `ok:true` | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-01-03 | 01 | 1 | SKILL-02 | — | 空技能集 → prompt 不含 `available_skills` 且无多余空行 | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-01-04 | 01 | 1 | SKILL-02 | — | 有技能 → prompt 含 `<available_skills>` / `<name>` / `<description>` / `<location>` | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-01-05 | 01 | 1 | SKILL-03 | P8 | `refreshSkills` 后 `buildSkillsPrompt()` 同步返回非空（零 IO 路径） | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-01-06 | 01 | 1 | — | — | **反幽灵**：根层 `README.md` → 不产生 `name === 'skills'` 的技能 | unit（回归守卫） | 同上 | ❌ W0 | ⬜ pending |
| 46-01-07 | 01 | 1 | — | — | **反黑屏**：根层 `SKILL.md` 存在时 `skills/<name>/SKILL.md` 仍被加载 | unit（回归守卫） | 同上 | ❌ W0 | ⬜ pending |
| 46-01-08 | 01 | 1 | — | — | **依赖纪律**：`ai-skills-manager.js` / `ai-manager.js` 源码不含 `require('yaml')` / `require('ignore')`（P11/O5） | unit（源码扫描） | 同上 | ❌ W0 | ⬜ pending |
| 46-02-01 | 02 | 2 | SKILL-06 | — | **反深嵌套**：`skills/a/b/SKILL.md` → 被跳过 + `realm_layout_violation` 诊断（含实际路径与目标布局建议） | unit（回归守卫） | 同上 | ❌ W0 | ⬜ pending |
| 46-02-02 | 02 | 2 | SKILL-06 | P3b | D-08：`name` 与目录名不一致 → `skill.name === dirname` + `realm_name_rewritten` 诊断 | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-02-03 | 02 | 2 | SKILL-05 | P3b | user/managed 同名 → user 进 prompt，managed `shadowed===true` + `shadowedBy==='user'` 且**仍在 `skills[]`**；被遮蔽者 `filePath` 位于 `managed-skills/` 下（**不断言集合顺序**） | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-02-04 | 02 | 2 | SKILL-05 | — | prompt 段中同名条目**只有一条**（SDK 不去重，Realm 必须去重） | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-03-01 | 03 | 3 | SKILL-06 | V7 | 非法 name / 超长 description / YAML 失败 → 技能被跳过 **且** `diagnostics` 含对应 `code` | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-03-02 | 03 | 3 | SKILL-07 | — | `SKILL.md` 超 `MAX_SKILL_MD_BYTES` → 跳过 + 诊断含 `limit`/`currentValue`（**且未被 YAML 解析**；拒绝动作在 46-01 Task 2 已落，结构化诊断字段在 46-03 Task 2 补齐） | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-03-03 | 03 | 3 | SKILL-07 | — | prompt 段超预算 → 保留条数 = 预算内最大；段尾含省略提示；诊断含 `limit`/`currentValue` | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-03-04 | 03 | 3 | SKILL-08 | — | `disabled: ['alpha']` → `alpha` 不进 prompt 但仍在 `skills[]`（标 `disabled`）；磁盘文件未删 | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-04-01 | 04 | 4 | SKILL-04 | P8 | `agent.state.systemPrompt` 改写后下一轮 `createContextSnapshot()` 反映新值；并 stub `windowManager.broadcast` 断言「真正改写时被以 `'skills:changed'` 调用恰一次、无变化时不调用、忙时只置脏不调用」 | unit | 同上 | ❌ W0 | ⬜ pending |
| 46-04-02 | 04 | 4 | SKILL-03 | P8 | 源码扫描（**创建点覆盖断言**）：每个 `new Agent(` 之前 60 行内存在 `refreshSkills(` —— **不是** `refreshSkills(` 与 `new Agent(` 的计数相等（非创建点调用不参与） | unit（源码扫描） | 同上 | ❌ W0 | ⬜ pending |
| 46-04-03 | 04 | 4 | DOC-01 | — | `docs/product/ai-skills.md` 存在，含六节标题 + 诊断归属声明（诊断在缓存条目的 `diagnostics`） | smoke | `node -e "…"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**编号口径（2026-09-11 按 4 计划重编）**：`46-{plan}-{nn}` 的 `{plan}` = 计划号（01..04），与 `Plan` 列一致；`Wave` = 该计划的执行 wave。旧版的 7 计划编号（`46-01-xx…46-07-xx`）作废 —— 其中旧 `46-03-02`（创建点覆盖扫描）的真实落点是 **46-04 Task 2**（第二处 `new Agent(` 要到 Wave 4 才接线），旧 `46-03-03`（`agent.state.systemPrompt`）的真实落点是 **46-04 Task 1**，两者都不属 46-01 Task 3 的断言面。行内容本身逐行核对无误，仅编号与 Plan/Wave 列对齐。


---

## Wave 0 Requirements

- [ ] `tests/test-ai-skills.js` — 新建，覆盖上表全部自动化断言（预计 30+ 例，照 `test-agent-workspace.js` 结构分 `describe`）
- [ ] `ai-manager.js` — 追加 `module.exports.buildSystemPrompt = buildSystemPrompt;`（照 `:5649-5651` 先例）
- [ ] `docs/product/ai-skills.md` — 六节骨架（DOC-01）
- [ ] 框架安装：**无**（`node:test` 内置）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 模型能仅凭 description 自动匹配技能并 `read` 正文 | SKILL-02 / DISC 前置 | 需真实 LLM 往返；官方记录模型对简单任务会"故意不触发技能"，自动化断言不确定 | 1) `npm run dev`；2) 问 AI「你有哪些技能」→ 应答出 name/description；3) 问一个命中 description 的任务 → 观察是否调 `read` 打开 `location` |
| 多窗口广播到达其他窗口 | SKILL-04 | 本阶段无消费方（48/50 才实现 UI 与列表），端到端到真实窗口无法自动化 | 自动化层面**已由 46-04 Task 1 的广播行为断言覆盖**：stub `require('../window-manager').broadcast` 后以 duck-typed `this` 直接调用 `syncAgentSystemPrompt()`，断言「真正改写时被以 `'skills:changed'` 调用恰一次；无变化时不调用；忙时只置脏不调用」。本行保留为 end-to-end 到真实多窗口的 UAT 手验 |
| 手改 `SKILL.md` 后切会话生效 | SKILL-03（P8 兜底路径） | 端到端需真实 Agent 重建 | `npm run dev` → 直接编辑 `agent-workspace/skills/<x>/SKILL.md` → 切换对话 → 下一条消息技能集应反映改动 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

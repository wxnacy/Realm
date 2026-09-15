---
phase: "47"
slug: "bash"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-11"
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert`（Node 内置，零框架依赖） |
| **Config file** | none — 单文件脚本式，照 `tests/test-ai-bash-policy.js` / `tests/test-ai-skills.js` / `tests/test-agent-workspace.js` |
| **Quick run command** | `node --test tests/test-ai-bash-policy.js` |
| **Full suite command** | `node --test tests/test-ai-bash-policy.js tests/test-ai-skills.js tests/test-agent-workspace.js tests/test-builtin-skills-seeder.js` |
| **Estimated runtime** | ~2 seconds（三个既有文件实测各 <1s；新增文件预计同级） |

**实测基线（研究阶段已跑，2026-09-11）：** `test-ai-bash-policy` **32/32 pass**、`test-ai-skills` **64/64 pass**、`test-agent-workspace` **21/21 pass**（合计 **117 例全绿**）。任何回归都必须以这 117 例为地板。

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/test-ai-bash-policy.js`（秒级；install 档任务的即时反馈）
- **After every plan wave:** Run `node --test tests/test-ai-bash-policy.js tests/test-ai-skills.js tests/test-agent-workspace.js`（回归 117 例，确认零破坏）
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

> Plan / task IDs are filled by the planner. The requirement→signal rows below are the
> contract; every row MUST end up bound to at least one `<automated>` verify command in a
> PLAN.md. Rows marked ❌ W0 depend on Wave 0 deliverables (see next section).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | SEED-03 / P1-a | T-47-builtin-text | `skills-builtin/**/SKILL.md` 全文零「执行外部安装」语义（`npx` / `npm i` / `curl \| sh` / `-y` / `-g` 及中文等价写法） | static scan | `node tests/test-builtin-skills-seeder.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | SEED-01 | — | 两个内置技能 `SKILL.md` 存在、可解析、name 正确 | unit | `node tests/test-builtin-skills-seeder.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | SEED-04 | — | 两个内置技能 `disable-model-invocation: true` 且不进 `promptBlock` | unit | `node tests/test-builtin-skills-seeder.js` + `node --test tests/test-ai-skills.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | SEED-02 | — | 播种幂等：重复调用不重复写；手改后重启覆盖并产 warning 诊断；手删后重播 | unit (temp workspace) | `node tests/test-builtin-skills-seeder.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | SEED-05 | P10 | 打包后 `.app` 中内置技能可加载（`asarUnpack` + `app.isPackaged` 路径分支） | manual (packaged run) | `make install-nightly` + 检查 `app.asar.unpacked/skills-builtin/` + 启动观察 | ❌ W0（人工） | ⬜ pending |
| TBD | TBD | 3 | SEC-01 / P1-b | T-47-install-bypass | 白名单含 `npm *` 时 `npm i x` 仍 `confirm/install`；D-13 全家族命中；D-16 只读反例全不命中 | unit (pure function) | `node --test tests/test-ai-bash-policy.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | SEC-01 | T-47-install-copy | `install` → `riskLevel: 'high'` + 专属确认文案 | source scan | `node --test tests/test-ai-bash-policy.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | SKILL-09 | — | 技能自带 `scripts/` 经既有 bash 工具执行，**零新增权限机制**（`DANGEROUS_INTERPRETERS` 仍含 `node` / `python3`） | integration + source scan | `node tests/test-builtin-skills-seeder.js` + `node --test tests/test-agent-workspace.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 4 | DOC-02 | — | 三处文档同步（`ai-skills.md` / `ai-agent-workspace.md` / `AGENTS.md`） | static text | `node tests/test-builtin-skills-seeder.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 4 | SEED-05 / P10 | P10 | `THIRD_PARTY_NOTICES` 五要素齐全（来源仓库 + 固定 SHA + 许可证 + 是否修改 + 修改说明）；两个 `LICENSE.txt` 随播种落盘 | static + unit | `node tests/test-builtin-skills-seeder.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Gate → Acceptance Signal Map

**P1（S1，阻断）—— 两半各自独立验收，缺一即门禁未闭合：**

| 信号 | 观测方式 | 命令 |
|------|----------|------|
| P1-a-1 | 两个 `SKILL.md` 全文零禁用词（无豁免） | `node tests/test-builtin-skills-seeder.js` |
| P1-a-2 | `skills-builtin/` 内不存在 `npx skills` 任意变体 | `grep -rn "npx skills" skills-builtin/` → 必须非零退出 |
| P1-a-3 | 两个技能都有 `disable-model-invocation: true` + 中文 description | `node tests/test-builtin-skills-seeder.js` |
| P1-b-1 | 白名单含 `npm *` 时 `npm i x` 仍 `confirm/install`（**门禁核心**） | `node --test tests/test-ai-bash-policy.js` |
| P1-b-2 | D-13 全家族命中（≥13 族各 1 条正例） | 同上 |
| P1-b-3 | D-16 只读反例全不命中（≥14 条反例） | 同上 |
| P1-b-4 | `install` → `riskLevel: 'high'` + 专属文案 | 源码扫描 |
| P1-b-5 | 既有 32 例不回归 | `node --test tests/test-ai-bash-policy.js 2>&1 \| grep "^# fail"` → `# fail 0` |

**P10（发布，阻断）：**

| 信号 | 观测方式 | 命令 |
|------|----------|------|
| P10-1 | `THIRD_PARTY_NOTICES(.md)` 存在且逐技能有记录 | `node tests/test-builtin-skills-seeder.js` |
| P10-2 | 五要素齐全（≥10 个关键词断言） | 同上 |
| P10-3 | find-skills 标 `modified` 且修改说明具体 | 同上 |
| P10-4 | 两个固定 SHA 与实测值一致（防手误抄错） | 同上 |
| P10-5 | 两个 `LICENSE.txt` 随播种落到 `managed-skills/<name>/` | 同上（播种后检查） |
| P10-6 | 打包后归属仍可读（若采纳 `build.files` allowlist） | 人工：`make install-nightly` 后确认 `THIRD_PARTY_NOTICES.md` 在 asar 清单内 |

---

## Wave 0 Requirements

- [ ] `tests/test-builtin-skills-seeder.js`（新建）— 覆盖 SEED-01/02/03/04/05 + DOC-02 + P1-a + P10-1..5 的全部断言。**本阶段最重要的单个交付物之一**：零安装语义扫描与归属五要素都在这里。可照 `tests/test-agent-workspace.js` 的 `withTempRoot` 脚手架（`setWorkspaceDir` 临时目录注入）。
- [ ] `tests/test-ai-bash-policy.js` 增补两个 describe 组 — 覆盖 SEC-01 + P1-b-1..5（D-13 全家族正例 + D-16 只读反例）。
- [ ] `tests/test-ai-bash-policy.js:159-164` 的两条 `deepStrictEqual` 断言 — 若 `allow` 分支返回新增 `installNames` 字段，必须同步更新为 `{ level:'allow', dangerNames:[], installNames: [] }`。**这是 Wave 0 的既有代码改动，不是新增。**
- [ ] `skills-builtin/` 静态资源目录（新建）— `find-skills/{SKILL.md,LICENSE.txt}` + `skill-creator/{SKILL.md,LICENSE.txt,scripts/,references/,assets/,eval-viewer/}`。find-skills 的 `SKILL.md` 为**全量新写**；skill-creator 按固定 SHA 下载后做最小必要改写。
- [ ] `THIRD_PARTY_NOTICES.md`（新建）— P10 的载体，不属于测试但属于 Wave 0 的静态交付。
- [ ] **Framework 安装：不需要** — `node:test` 是 Node 内置，`node --version` = v22.22.0 已满足。

> **结论：本阶段有实质的 Wave 0 缺口** —— "existing test infrastructure covers all phase requirements" 不成立。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 打包后正式 `.app` 中两个内置技能可被正确加载并播种 | SEED-05 / D-12 | 只有真实打包产物才暴露 asar 路径语义；`npm run dev` 走的是 `__dirname` 回落分支，测不到 `app.isPackaged` 那条 | 见下 |
| `THIRD_PARTY_NOTICES.md` 是否随包分发 | P10 / Open Question Q4 | 取决于 `build.files` allowlist 的最终决策 | `make install-nightly` 后解 asar 清单确认在列 |

**打包实跑验证 4 步（D-12 强制，不可用 `npm run dev` 代替）：**

1. **先停用户实例**：`pgrep -fl "Realm"` —— 研究阶段实测该机正从 `/Applications/Realm.app` 运行（PID 25922 + helper 进程），而 `make install` 第一步会 `rm -rf` 该目录。清理只按自身 PID，**禁止**用路径模式 `pkill`（见 AGENTS.md 的打包验证安全纪律）。
2. `make install-nightly`（或用临时 output dir，不动 `/Applications`）。
3. 确认 `Contents/Resources/app.asar.unpacked/skills-builtin/{find-skills,skill-creator}/SKILL.md` 存在。
4. 启动该 .app，确认 `~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/` 下出现两个技能目录且加载器零诊断。

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

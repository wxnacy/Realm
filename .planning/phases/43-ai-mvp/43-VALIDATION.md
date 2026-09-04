---
phase: 43
slug: ai-mvp
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-04
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test（node 内置，零新依赖 — 项目现无测试框架先例，现有 scripts/test-*.js 为独立脚本） |
| **Config file** | none — Wave 0 installs（新建 tests/test-ai-memory.js，`node --test tests/`） |
| **Quick run command** | `node --test tests/test-ai-memory.js` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds |

**关键前置（来自 RESEARCH.md）**：`ai-memory-manager.js` 的 `userData` 路径必须可注入临时目录，否则无法对落盘行为（懒创建/预算/清理）做自动化验证 — Wave 0 必须先解决路径注入。

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/test-ai-memory.js`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD（planner 细化后填写） | — | 0 | — | T-43-* | 写入威胁扫描拦截恶意注入 | unit | `node --test tests/test-ai-memory.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-ai-memory.js` — node:test 骨架 + 临时目录注入 fixture（覆盖 USER.md / MEMORY.md / 容器记忆三层读写）
- [ ] `ai-memory-manager.js` 路径可注入（构造函数/工厂参数），不硬编码 `app.getPath('userData')`

*若 planner 决定沿用 scripts/test-*.js 独立脚本风格，替换 Quick run command 为对应脚本路径并保持断言式退出码（exit 0/1）。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 新会话 system prompt 含冻结快照 | MEMORY.md 注入 | 需真实 LLM 会话观察 | 改 MEMORY.md → 开新 AI 会话 → 问"你记得什么" |
| 容器删除后记忆文件清理联动 | 删除联动清理 | 涉及真实窗口/容器生命周期 | 删除容器 → 检查 `memories/<containerId>.md` 已消失 |
| 设置页 /api/ai-memory 编辑器 UI | 设置页编辑入口 | CSP/真实渲染环境 | 打开 realm://settings → AI 记忆分区 → 编辑保存回读 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

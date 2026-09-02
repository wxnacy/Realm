---
phase: 42
slug: ai-pi-agent
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-02
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 独立 node 脚本（无 jest/vitest；复刻 tests/test-favorites-folders.js 模式） |
| **Config file** | none — 惯例模式，无配置文件 |
| **Quick run command** | `node tests/test-ai-conversations.js` |
| **Full suite command** | `node tests/test-ai-conversations.js` |
| **Estimated runtime** | ~1 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-ai-conversations.js`
- **After every plan wave:** Run `node tests/test-ai-conversations.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-01/42-04/42-06 | 01/04/06 | 1-4 | CONV-01 | — | N/A | integration | `node tests/test-ai-conversations.js`（组 2/3/4/5：写入侧归一化、42-06 同回合合并 7 场景、CR-01/D-14 注入形状配对） | ✅ | ✅ green |
| 42-01 | 01 | 1 | CONV-03 | — | N/A | integration | `node tests/test-ai-conversations.js`（组 1/7：两表无 container_id、跨容器互见、CASCADE 隔离） | ✅ | ✅ green |
| 42-01/42-04 | 01/04 | 1-3 | CONV-04 | — | N/A | integration | `node tests/test-ai-conversations.js`（组 6：惰性建行、D-04 前 30 字符自动命名、重命名不被覆盖、message_count 维护） | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

当前结果：99/99 断言通过，退出码 0（2026-09-02 复跑确认）。

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 对话管理 UI 全交互链路（列表/切换/删除/重命名/确认框居中/空气泡视觉） | CONV-02 | 纯 renderer 视觉与交互行为，需真实 Electron 窗口 | 42-UAT.md 第 3 轮 10/10 已通过（含 G-42-8 复测） |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-02

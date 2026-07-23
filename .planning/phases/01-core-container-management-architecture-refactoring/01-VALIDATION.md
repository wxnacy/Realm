---
phase: 01
slug: core-container-management-architecture-refactoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未检测到测试框架 — Wave 0 安装 Jest 或 Vitest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test`（需先配置） |
| **Full suite command** | `npm test`（需先配置） |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CONT-01 | T-01-05 | 容器 ID 白名单验证 | unit | `npm test -- --grep "createContainer"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CONT-02 | — | — | unit | `npm test -- --grep "updateContainer"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CONT-03 | — | — | unit | `npm test -- --grep "deleteContainer"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | CONT-04 | — | — | e2e | `npm test -- --grep "container panel"` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | CONT-05 | — | — | unit | `npm test -- --grep "switchContainer"` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | CONT-06 | — | — | e2e | `npm test -- --grep "container switch UI"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/container-manager.test.js` — stubs for CONT-01, CONT-02, CONT-03, CONT-05
- [ ] `tests/renderer.test.js` — stubs for CONT-04, CONT-06
- [ ] `tests/conftest.js` — shared fixtures
- [ ] Jest 或 Vitest — 项目当前无测试框架

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Popover 下拉面板视觉效果 | CONT-04 | 需要真实 Electron 窗口 | 启动应用 → 点击工具栏容器按钮 → 验证面板弹出位置和样式 |
| 容器切换后新 Tab 在新容器中打开 | CONT-05/CONT-06 | 需要多 Tab 场景 | 切换容器 → 新建 Tab → 检查 Cookie 隔离 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 34
slug: multi-window
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未配置（项目当前无测试框架） |
| **Config file** | none |
| **Quick run command** | N/A（手动验证） |
| **Full suite command** | N/A（手动验证） |
| **Estimated runtime** | N/A |

---

## Sampling Rate

- **After every task commit:** 手动验证相关功能点
- **After every plan wave:** 手动验证该 wave 的所有需求
- **Before `/gsd-verify-work`:** 所有 5 个需求的手动 UAT 必须通过
- **Max feedback latency:** N/A（手动验证）

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | MW-01 | T-34-01 | assertTrustedSender 校验 managedWindowIds | manual | 手动：Dock 右击 → 新建窗口 → 窗口出现 | N/A | ⬜ pending |
| 34-01-02 | 01 | 1 | MW-07 | — | N/A | manual | 手动：新建窗口 → 容器选择器显示 default | N/A | ⬜ pending |
| 34-01-03 | 01 | 1 | MW-08 | — | N/A | manual | 手动：Cmd+N → 新窗口出现 | N/A | ⬜ pending |
| 34-01-04 | 01 | 1 | MW-09 | — | N/A | manual | 手动：Cmd+Shift+W → 当前窗口关闭 | N/A | ⬜ pending |
| 34-01-05 | 01 | 1 | MW-10 | — | N/A | manual | 手动：点击不同窗口 → 工具栏/Tab 栏更新 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- 无 — 项目不需要测试框架安装，所有验证为手动

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dock 右击新建窗口 | MW-01 | 需要 macOS Dock 交互 | Dock 右击 → 选择"新建窗口" → 确认新窗口出现并使用默认容器 |
| Cmd+N 新建窗口 | MW-08 | 需要键盘快捷键触发 | 按 Cmd+N → 确认新窗口出现并使用默认容器 |
| Cmd+Shift+W 关闭窗口 | MW-09 | 需要键盘快捷键触发 | 按 Cmd+Shift+W → 确认当前窗口关闭，其他窗口不受影响 |
| 窗口间焦点切换 | MW-10 | 需要多窗口交互 | 创建 2 个窗口 → 点击不同窗口 → 确认工具栏和 Tab 栏正确更新 |
| 新窗口使用默认容器 | MW-07 | 需要验证容器选择器状态 | 新建窗口 → 检查容器选择器是否显示 "default" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

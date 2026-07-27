---
phase: 13
slug: 右键菜单增强
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未配置（项目当前无测试框架） |
| **Config file** | none |
| **Quick run command** | N/A |
| **Full suite command** | N/A |
| **Estimated runtime** | N/A（手动验证为主） |

---

## Sampling Rate

- **After every task commit:** N/A（无自动化测试）
- **After every plan wave:** 手动 UAT 验证本波次菜单项功能
- **Before `/gsd-verify-work`:** 手动验证所有菜单项功能正确
- **Max feedback latency:** N/A

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | CTX-01 | — | N/A | manual | 右键 Tab → 菜单显示 → 各项功能正确 | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | CTX-02 | — | N/A | manual | 网页空白处右键 → 菜单项完整 → 功能正确 | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | CTX-03 | — | N/A | manual | 右键图片 → 复制图片/另存为/新标签页打开 | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | CTX-04 | — | N/A | manual | 右键链接 → 新标签页/容器子菜单/复制地址 | ❌ W0 | ⬜ pending |
| 13-01-05 | 01 | 1 | CTX-05 | — | N/A | manual | 对比 Chrome 浏览器右键菜单一致 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 无自动化测试框架 — 本阶段为 UI 交互密集型，手动验证为主
- [ ] 需要手动测试菜单在 macOS 和 Windows 上的显示效果（当前仅 macOS）

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 标签页右键菜单完整功能 | CTX-01 | UI 交互密集型 | 右键点击 Tab → 菜单显示 → 逐项测试：关闭/关闭其他/关闭左侧/右侧/重新打开/固定 |
| 网页通用右键菜单 | CTX-02 | 需要实际网页环境 | 在网页空白处右键 → 测试导航操作/页面操作/开发者工具/文本操作 |
| 图片右键菜单 | CTX-03 | 需要图片元素 | 右键图片 → 测试新标签页打开/另存为/复制图片/复制地址 |
| 链接右键菜单 | CTX-04 | 需要链接元素 | 右键链接 → 测试新标签页/容器子菜单/复制地址/后台打开 |
| 与 Chrome 一致性 | CTX-05 | 需要对比参考 | 并排打开 Chrome 和 Realm，对比各菜单项顺序和功能 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: N/A（手动验证）
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: N/A
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

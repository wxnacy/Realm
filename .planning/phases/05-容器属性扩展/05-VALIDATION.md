---
phase: 05
slug: 容器属性扩展
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未配置（项目当前无测试框架） |
| **Config file** | none |
| **Quick run command** | `npm test`（未配置） |
| **Full suite command** | `npm test`（未配置） |
| **Estimated runtime** | N/A |

---

## Sampling Rate

- **After every task commit:** 手动验证（无自动化测试）
- **After every plan wave:** 手动验证所有验收标准
- **Before `/gsd-verify-work`:** 所有 5 个验收标准必须通过
- **Max feedback latency:** N/A（手动验证）

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ATTR-01 | T-05-01 | N/A | manual | — | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | ATTR-02 | T-05-02 | 邮箱格式验证 | manual | — | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | ATTR-03 | T-05-03 | N/A | manual | — | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | ATTR-04 | T-05-04 | N/A | manual | — | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | ATTR-05 | T-05-05 | N/A | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 项目无测试框架，本阶段不引入（scope 外）
- [ ] 所有验证通过手动 UAT 完成

*Existing infrastructure covers all phase requirements (manual verification).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 设置手机号属性 | ATTR-01 | 无测试框架 | 编辑容器 → 填写手机号 → 保存 → 重新打开验证值保留 |
| 设置邮箱属性（宽松验证） | ATTR-02 | 无测试框架 | 编辑容器 → 填写邮箱（含 @）→ 保存验证；填写无 @ 邮箱 → 验证错误提示 |
| 设置备注属性 | ATTR-03 | 无测试框架 | 编辑容器 → 填写备注（多行）→ 保存 → 重新打开验证值保留 |
| 编辑 Modal 展示和编辑 | ATTR-04 | 无测试框架 | 打开编辑 Modal → 验证分隔线下方显示邮箱、手机号、备注字段 |
| 旧数据自动兼容 | ATTR-05 | 无测试框架 | 使用旧版本数据启动 → 验证容器正常显示，新字段为空字符串 |

---

## Security Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| XSS 防护（备注字段） | V5 Input Validation | 无测试框架 | 在备注中输入 `<script>alert(1)</script>` → 验证不执行脚本 |
| 输入注入防护 | V5 Input Validation | 无测试框架 | 在邮箱/手机号字段输入特殊字符 → 验证不触发异常 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: N/A (manual verification)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

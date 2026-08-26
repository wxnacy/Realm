---
phase: 32
slug: autofill-credential-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-13
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未配置（项目当前没有测试框架） |
| **Config file** | none |
| **Quick run command** | — |
| **Full suite command** | — |
| **Estimated runtime** | — |

---

## Sampling Rate

- **After every task commit:** 手动测试当前功能
- **After every plan wave:** 手动验证所有相关需求
- **Before `/gsd-verify-work`:** 手动验证所有 6 个需求
- **Max feedback latency:** N/A（手动验证）

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | AF-02 | T-32-01 | safeStorage 加密存储 | automated | `node -e "const cm = require('./credential-manager'); cm.initDatabase(); console.log('init OK');"` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | AF-01, AF-03, AF-05 | T-32-02 | IPC 通道注册 | automated | `grep -c "ipcMain.handle('credential:" ipc-handlers.js` | ❌ W0 | ⬜ pending |
| 32-02-01 | 02 | 2 | AF-09, AF-08 | T-32-04 | 表单检测 + 互斥 | automated | `grep -c "FormDetector" src/webview-preload.js` | ❌ W0 | ⬜ pending |
| 32-02-02 | 02 | 2 | AF-01, AF-03, AF-05 | T-32-05 | 横幅 UI + 自动填充协调 | automated | `grep -c "credentialSaveBanner" src/renderer.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- 无自动化测试（项目未配置测试框架）
- 所有验证通过手动测试完成

*Existing infrastructure covers all phase requirements (manual verification).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 保存凭据提示横幅出现 | AF-01 | 需要真实浏览器环境 | 1. 打开任意登录页面 2. 输入用户名密码 3. 提交表单 4. 验证横幅出现 |
| 凭据加密存储 | AF-02 | 需要检查 macOS Keychain | 1. 点击保存 2. 检查 history.db 中 encrypted_password 非空 3. 检查 safeStorage 加密 |
| 自动填充 | AF-03 | 需要真实页面 | 1. 保存凭据后重新访问 2. 验证字段自动填充 |
| 容器隔离 | AF-05 | 需要多容器测试 | 1. 容器 A 保存凭据 2. 切换容器 B 3. 访问同网站 4. 验证不填充 |
| 互斥机制 | AF-08 | 需要 AI fillForm 触发 | 1. AI 执行 fillForm 2. 验证 autofill 暂停 3. fillForm 完成后恢复 |
| 表单检测 | AF-09 | 需要多种登录页面 | 1. 测试 GitHub/Google/自定义登录页 2. 验证正确检测 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: N/A（手动验证）
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency: N/A（手动验证）
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

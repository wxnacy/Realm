---
phase: 17
slug: chrome
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 无（项目当前没有配置测试） |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test`（待配置） |
| **Full suite command** | `npm test`（待配置） |
| **Estimated runtime** | ~5 seconds |

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
| 17-01-01 | 01 | 1 | IMPORT-01 | T-17-01 | Chrome JSON 文件解析正确 | unit | `npm test -- --grep "Chrome JSON"` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | IMPORT-01 | T-17-01 | 文件夹结构保留完整 | unit | `npm test -- --grep "folder structure"` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | IMPORT-02 | T-17-02 | HTML 书签文件解析正确 | unit | `npm test -- --grep "HTML import"` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | IMPORT-02 | — | 文件夹结构保留完整 | unit | `npm test -- --grep "HTML folder"` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 2 | IMPORT-03 | T-17-03 | 进度事件正确发送 | unit | `npm test -- --grep "progress"` | ❌ W0 | ⬜ pending |
| 17-03-02 | 03 | 2 | IMPORT-03 | — | 重复 URL 正确跳过 | unit | `npm test -- --grep "duplicate"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/import.test.js` — stubs for IMPORT-01, IMPORT-02, IMPORT-03
- [ ] `tests/conftest.js` — shared fixtures
- [ ] Framework install: `npm install --save-dev jest` — if none detected

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 自动检测 Chrome 路径 | IMPORT-01 | 需要实际 Chrome 安装 | 安装 Chrome，运行导入，验证自动检测 |
| 导入进度 UI 显示 | IMPORT-03 | UI 渲染验证 | 执行导入，观察进度条和摘要显示 |
| favicon 获取 | D-15 | 依赖外部 API | 导入后检查收藏项图标显示 |

*If none: "All phase behaviors have automated verification."*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | 文件内容验证、URL 格式验证 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 恶意 HTML 文件 | Tampering | 限制文件大小，验证文件格式 |
| 路径遍历攻击 | Information Disclosure | 使用 path.resolve() 规范化路径 |
| 大量数据导入导致 DoS | Denial of Service | 限制单次导入数量，分批处理 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 23
slug: context-reference
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 23 — Validation Strategy

> 智能上下文引用 + 全文检索的验证策略。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未配置（Wave 0 安装） |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** 手动验证 UI 交互
- **After every plan wave:** 手动验证完整流程
- **Before `/gsd-verify-work`:** 全部 CTX 需求通过 UAT
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01 | 01 | 1 | CTX-01 | manual | — | — | ⬜ pending |
| 23-02 | 01 | 1 | CTX-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 23-03 | 02 | 1 | CTX-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 23-04 | 02 | 1 | CTX-05 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 23-05 | 03 | 2 | CTX-03 | integration | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-favorites-fts5.js` — FTS5 索引 CRUD 测试
- [ ] `tests/test-ai-tools.js` — AI 工具注册和调用测试
- [ ] 安装测试框架（如 vitest 或 jest）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| @ 引用浮动面板 UI | CTX-01 | 需要 Electron 窗口交互 | 1. 打开 AI 聊天面板 2. 输入 @ 3. 验证浮动面板弹出 4. 选择标签页 5. 验证 Pill 显示 |
| Pill 组件交互 | CTX-01 | DOM 交互验证 | 1. 选中多个标签页 2. 点击 × 关闭 3. 验证状态更新 |
| 全文检索结果 | CTX-05 | AI 回复内容验证 | 1. 输入"搜索收藏 XXX" 2. 验证 AI 返回相关收藏 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

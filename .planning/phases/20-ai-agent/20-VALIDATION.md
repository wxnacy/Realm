---
phase: 20
slug: ai-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 无（项目当前没有配置测试） |
| **Config file** | none |
| **Quick run command** | `npm test`（未配置） |
| **Full suite command** | `npm test`（未配置） |
| **Estimated runtime** | 手动验证 |

---

## Sampling Rate

- **After every task commit:** 手动验证核心功能（启动 Electron、测试已实现的功能）
- **After every plan wave:** 完整功能测试（所有工具调用、事件广播）
- **Before `/gsd-verify-work`:** 所有工具可调用，事件广播正常
- **Max feedback latency:** 手动验证

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | AI-02 | — | N/A | manual | 手动验证 | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | AI-02 | — | N/A | manual | 手动验证 | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | AI-02 | — | N/A | manual | 手动验证 | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | AI-02 | — | N/A | manual | 手动验证 | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 2 | AI-02 | — | N/A | manual | 手动验证 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- 无测试框架，采用手动验证
- 启动 Electron 应用后，通过开发者工具 Console 验证功能

*Existing infrastructure covers all phase requirements (manual verification).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI Manager 初始化 | AI-02 | 需要 Electron 环境 | 启动应用，检查 Console 无报错 |
| 工具注册验证 | AI-02 | 需要 Agent 实例 | 发送 prompt，验证工具被调用 |
| IPC 事件广播 | AI-02 | 需要渲染进程 | 打开开发者工具，监听 ai:events-batch |
| 设置页面 AI 分区 | AI-02 | UI 验证 | 打开设置页面，检查 AI 助手分区 |
| API Key 配置 | AI-02 | 需要真实 API Key | 输入 API Key，验证连接状态 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: manual
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

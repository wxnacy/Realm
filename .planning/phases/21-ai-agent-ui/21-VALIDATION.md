---
phase: 21
slug: ai-agent-ui
status: final
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 21 — Validation Strategy

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

- **After every task commit:** 手动验证核心功能（启动 Electron、验证面板交互）
- **After every plan wave:** 完整功能测试（消息收发、工具卡片、面板行为）
- **Before `/gsd-verify-work`:** 面板全部交互路径可用
- **Max feedback latency:** 手动验证

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | AI-03 | — | N/A | manual | 手动验证 | ❌ W0 | ✅ green |
| 21-01-02 | 01 | 1 | AI-03 | T-21-01 | marked 默认转义 HTML 防 XSS | manual | 手动验证 | ❌ W0 | ✅ green |
| 21-01-03 | 01 | 1 | AI-03 | — | N/A | manual | 手动验证 | ❌ W0 | ✅ green |
| 21-02-01 | 02 | 2 | AI-03 | T-21-03 | 工具参数/结果用 textContent 防 XSS | manual | 手动验证 | ❌ W0 | ✅ green |
| 21-02-02 | 02 | 2 | AI-03 | T-21-04 | 复制用 navigator.clipboard 原生安全机制 | manual | 手动验证 | ❌ W0 | ✅ green |
| 21-02-03 | 02 | 2 | AI-03 | — | N/A | manual | 手动验证 | ❌ W0 | ✅ green |
| 21-03-01 | 03 | 3 | AI-03 | — | N/A | manual | 手动验证 | ❌ W0 | ✅ green |
| 21-03-02 | 03 | 3 | AI-03 | — | N/A | manual | 手动验证 | ❌ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*证据：21-UAT.md 13/13 通过（2026-08-01）*

---

## Wave 0 Requirements

- 无测试框架，采用手动验证
- 启动 Electron 应用后，通过 AI 面板实际操作验证功能

*Existing infrastructure covers all phase requirements (manual verification).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 面板开关/快捷键/拖拽 | AI-03 | UI 交互验证 | UAT Test 1/5/9 |
| 消息发送与流式渲染 | AI-03 | 需要真实 LLM | UAT Test 2/3/6（xiaomi/mimo-v2-flash 实测） |
| 工具执行卡片 | AI-03 | 需要 Agent 实际调用工具 | UAT Test 7（get_tabs 实测） |
| 消息复制/重新生成 | AI-03 | UI 交互验证 | UAT Test 8 |
| 智能滚动/空状态/错误重试 | AI-03 | UI 交互验证 | UAT Test 4/10/11（错误 Key 实测） |
| 设置集成（提供商配置/跳转） | AI-03 | UI 验证 | UAT Test 13 + 设置页实测（38 提供商下拉） |

---

## Validation Audit 2026-08-01

| Metric | Count |
|--------|-------|
| Gaps found | 0（无测试框架可补，按项目约定手动验证） |
| Resolved | 8/8 任务（UAT 13/13 通过） |
| Escalated | 0 |

UAT 期间共修复 11 个问题并全部复测通过：elements DOM 快照、hidden 初始类、
设置分区名、marked/hljs 加载、宽度键扁平化、面板状态恢复、builtinModels 导入路径、
SDK 事件翻译层、流式闪烁×2、webview 拖拽吞事件、模型级 errorMessage 检测。

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency: manual
- [ ] `nyquist_compliant: true` set in frontmatter（项目无测试框架，手动验证约定）

**Approval:** approved（手动验证，UAT 13/13 通过）

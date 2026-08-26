---
phase: 40
slug: web-search
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Electron 主进程无测试框架 |
| **Config file** | none |
| **Quick run command** | `npm run dev`（手动验证） |
| **Full suite command** | `npm run dev`（手动验证） |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** 手动在 AI 聊天中测试 web_search 调用
- **After every plan wave:** 验证所有 Provider fallback 链
- **Before `/gsd-verify-work`:** 完整手动测试所有成功标准
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | SEARCH-01 | — | search-manager.js 初始化 | manual | `npm run dev` → AI 聊天测试 | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | SEARCH-02 | — | 速率限制器独立实例 | manual | 连续快速搜索验证 | ❌ W0 | ⬜ pending |
| 40-01-03 | 01 | 1 | SEARCH-03 | T-40-01 | SSRF 防护拒绝内网地址 | manual | 尝试搜索内网 URL | ❌ W0 | ⬜ pending |
| 40-01-04 | 01 | 1 | SEARCH-04 | — | 结果标准化格式正确 | manual | 检查返回 JSON 格式 | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 1 | TOOL-01 | — | web_search 工具注册 | manual | AI 调用 web_search | ❌ W0 | ⬜ pending |
| 40-02-02 | 02 | 1 | TOOL-02 | — | API Provider 实现 | manual | 配置 API Key 后搜索 | ❌ W0 | ⬜ pending |
| 40-02-03 | 02 | 1 | TOOL-03 | — | Auto Fallback 降级 | manual | 断开付费 API 验证降级 | ❌ W0 | ⬜ pending |
| 40-02-04 | 02 | 1 | TOOL-04 | — | 错误诊断信息 | manual | 模拟搜索失败 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- 无 — 项目已有完整开发环境（Electron + Node.js），无需额外安装

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| web_search 返回搜索结果 | TOOL-01 | Electron 主进程工具需运行时验证 | 1. `npm run dev` 2. AI 聊天输入"今天天气如何" 3. 验证返回标题+链接+摘要 |
| Auto Fallback 降级 | TOOL-03 | 需要模拟 Provider 失败 | 1. 不配置任何 API Key 2. 搜索任意内容 3. 验证降级到 DDG |
| 速率限制器 | SEARCH-02 | 需要连续快速调用 | 1. 连续发送 5 次搜索请求 2. 验证无 429 错误 |
| SSRF 防护 | SEARCH-03 | 需要尝试内网地址 | 1. 搜索"http://127.0.0.1" 2. 验证返回错误而非访问内网 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

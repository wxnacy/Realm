---
phase: 26
slug: ipc
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未配置（项目当前无测试框架） |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test` (if configured) |
| **Full suite command** | `npm test` (if configured) |
| **Estimated runtime** | ~N seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (if configured)
- **After every plan wave:** Run `npm test` (if configured)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** N seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | SNIFF-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | IPC-01 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 26-01-03 | 01 | 1 | IPC-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 26-01-04 | 01 | 1 | SNIFF-01 | — | N/A | manual-only | — | — | ⬜ pending |
| 26-01-05 | 01 | 1 | SNIFF-02 | — | N/A | manual-only | — | — | ⬜ pending |
| 26-01-06 | 01 | 1 | SNIFF-03 | — | N/A | manual-only | — | — | ⬜ pending |
| 26-01-07 | 01 | 1 | SNIFF-05 | — | N/A | manual-only | — | — | ⬜ pending |
| 26-01-08 | 01 | 1 | IPC-02 | — | N/A | manual-only | — | — | ⬜ pending |
| 26-01-09 | 01 | 1 | IPC-03 | — | N/A | manual-only | — | — | ⬜ pending |
| 26-01-10 | 01 | 1 | IPC-05 | — | N/A | manual-only | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 配置测试框架（如果需要单元测试 MediaSniffer 和 IPC handler）
- [ ] 创建 `tests/` 目录结构
- [ ] 为 SNIFF-04、IPC-01、IPC-04 创建单元测试桩

*如果不需要单元测试：现有基础设施覆盖所有阶段需求。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 网络拦截视频资源 | SNIFF-01 | 需要真实浏览器环境 + 视频网站 | 访问包含 m3u8/mp4 的网页，检查媒体列表 |
| 脚本注入检测 | SNIFF-02 | 需要 webview 环境 | 访问包含 video 元素的网页，检查检测结果 |
| MutationObserver 监听 | SNIFF-03 | 需要 webview 环境 | 动态加载视频元素，检查实时检测 |
| 导航清空 | SNIFF-05 | 需要 webview 导航 | 页面导航后检查媒体列表是否清空 |
| media:play | IPC-02 | 需要 BrowserWindow | 调用播放接口，检查播放器窗口 |
| media:copy-url | IPC-03 | 需要系统剪贴板 | 复制 URL，检查剪贴板内容 |
| mediaAPI 暴露 | IPC-05 | 需要 preload + contextBridge | 在渲染进程调用 mediaAPI 方法 |

*如果不存在：所有阶段行为都有自动化验证。*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N seconds
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

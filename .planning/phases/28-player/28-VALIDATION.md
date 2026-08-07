---
phase: 28
slug: player
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 无（项目当前无测试框架） |
| **Config file** | none |
| **Quick run command** | `npm run validate` (现有脚本验证) |
| **Full suite command** | `npm run validate` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** 手动验证相关功能
- **After every plan wave:** 手动验证所有已实现功能
- **Before `/gsd-verify-work`:** 完整 UAT 测试
- **Max feedback latency:** N/A (手动验证)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | PLAYER-01 | — | N/A | manual | 手动验证窗口创建/关闭 | N/A | ⬜ pending |
| 28-01-02 | 01 | 1 | PLAYER-02 | — | N/A | manual | 手动播放 .m3u8 视频 | N/A | ⬜ pending |
| 28-01-03 | 01 | 1 | PLAYER-03 | — | N/A | manual | 手动播放 .mp4/.webm 视频 | N/A | ⬜ pending |
| 28-01-04 | 01 | 1 | PLAYER-04 | — | N/A | manual | 手动播放 .flv 视频 | N/A | ⬜ pending |
| 28-01-05 | 01 | 1 | PLAYER-05 | — | N/A | manual | 手动点击控制按钮 | N/A | ⬜ pending |
| 28-01-06 | 01 | 1 | PLAYER-06 | — | N/A | manual | 手动拖拽进度条 | N/A | ⬜ pending |
| 28-01-07 | 01 | 1 | PLAYER-07 | — | N/A | manual | 手动调节音量 | N/A | ⬜ pending |
| 28-01-08 | 01 | 1 | PLAYER-08 | — | N/A | manual | 手动切换倍速 | N/A | ⬜ pending |
| 28-01-09 | 01 | 1 | PLAYER-09 | — | N/A | manual | 手动按 F 键或点击全屏按钮 | N/A | ⬜ pending |
| 28-01-10 | 01 | 1 | PLAYER-10 | — | N/A | manual | 关闭播放器后检查内存 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. 项目无测试框架，Phase 28 不引入测试。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 播放器独立窗口创建 | PLAYER-01 | 视觉验证窗口外观和行为 | 点击媒体面板播放按钮，验证无边框窗口打开 |
| HLS 播放 | PLAYER-02 | 流媒体播放需要实际视频源 | 播放 .m3u8 视频，验证流畅播放 |
| MP4/WebM 播放 | PLAYER-03 | 原生播放器行为验证 | 播放 .mp4 和 .webm 视频 |
| FLV/MPEG-TS 播放 | PLAYER-04 | mpegts.js 集成验证 | 播放 .flv 视频 |
| 播放/暂停控制 | PLAYER-05 | UI 交互验证 | 点击播放/暂停按钮，按空格键 |
| 进度条拖拽 | PLAYER-06 | 拖拽交互验证 | 拖拽进度条，验证视频跳转 |
| 音量控制 | PLAYER-07 | 滑块交互验证 | 拖拽音量滑块，按上下箭头 |
| 倍速选择 | PLAYER-08 | 菜单交互验证 | 点击倍速按钮，选择不同倍速 |
| 全屏模式 | PLAYER-09 | 全屏行为验证 | 按 F 键，双击视频区域 |
| 资源释放 | PLAYER-10 | 内存泄漏检测 | 打开/关闭播放器多次，检查任务管理器内存 |

---

## Validation Sign-Off

- [ ] All tasks have manual verification instructions
- [ ] Sampling continuity: 每个计划波次后手动验证
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: N/A (手动验证)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

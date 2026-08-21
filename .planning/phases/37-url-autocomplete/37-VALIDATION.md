---
phase: 37
slug: url-autocomplete
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none (手动测试) |
| **Config file** | none |
| **Quick run command** | `npm run dev` |
| **Full suite command** | 手动测试清单 |
| **Estimated runtime** | ~5 分钟（手动验证） |

---

## Sampling Rate

- **After every task commit:** 手动验证核心功能
- **After every plan wave:** 完整手动测试清单
- **Before `/gsd-verify-work`:** 所有手动测试通过
- **Max feedback latency:** 手动测试 ~5 分钟

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Verification Method | Status |
|---------|------|------|-------------|-----------|---------------------|--------|
| 37-01-01 | 01 | 1 | D-01, D-02, D-05 | manual | 输入关键词，验证三个数据源返回结果 | ⬜ pending |
| 37-01-02 | 01 | 1 | D-03, D-04, D-06, D-16 | manual | 验证 IPC 调用、排序、缓存 | ⬜ pending |
| 37-02-01 | 02 | 2 | D-07, D-10, D-11, D-14 | manual | 验证下拉框 UI、样式 | ⬜ pending |
| 37-02-02 | 02 | 2 | D-08, D-09, D-12, D-13, D-15 | manual | 验证键盘/鼠标交互、防抖 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

项目无自动化测试框架，所有验证通过手动测试完成。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 基本补全 | D-01, D-05 | UI 交互需要视觉验证 | 输入 "gith"，验证显示 github.com 建议 |
| 收藏夹优先 | D-04, D-06 | 排序逻辑需要实际数据验证 | 输入已收藏 URL 前缀，验证置顶 |
| Inline completion | D-07, D-08, D-09 | DOM 对齐需要视觉验证 | 输入 "gith"，验证光标后高亮 "ub.com"，按 Tab 接受 |
| 键盘导航 | D-12 | 键盘事件需要实际操作 | ArrowDown/Up 切换选中项，Enter 跳转，Esc 关闭 |
| 点击选择 | D-13 | 鼠标事件需要实际操作 | 点击候选条目，验证导航到对应 URL |
| 防抖验证 | D-15 | 定时器行为需要观察 | 快速输入，验证 100ms 后才查询 |
| 缓存验证 | D-16 | 性能需要实际测量 | 重复输入相同前缀，验证响应更快 |
| 中文搜索 | D-01 | FTS5 分词需要实际验证 | 输入中文标题关键词，验证匹配 |

---

## Validation Sign-Off

- [ ] 所有任务通过手动验证
- [ ] 无连续 3 个任务未验证
- [ ] 所有 D-01 到 D-16 决策已验证
- [ ] `nyquist_compliant: true` 设置在 frontmatter

**Approval:** pending

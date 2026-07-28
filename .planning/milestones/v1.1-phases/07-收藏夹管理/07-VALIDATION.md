---
phase: 7
slug: 收藏夹管理
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 无（项目当前没有配置测试） |
| **Config file** | none |
| **Quick run command** | `npm test` (未配置) |
| **Full suite command** | `npm test` (未配置) |
| **Estimated runtime** | N/A |

---

## Sampling Rate

- **After every task commit:** 手动测试
- **After every plan wave:** 手动测试
- **Before `/gsd-verify-work`:** 完整功能测试
- **Max feedback latency:** N/A（手动验证）

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | FAV-01 | T-7-01 | sanitizeContainerId 验证 | manual | — | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | FAV-02 | T-7-01 | 参数化查询 | manual | — | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | FAV-03 | T-7-02 | REALM_TOKEN 鉴权 | manual | — | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | FAV-07 | T-7-02 | 容器隔离验证 | manual | — | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | FAV-04 | — | N/A | manual | — | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | FAV-05 | — | N/A | manual | — | ❌ W0 | ⬜ pending |
| 07-03-03 | 03 | 2 | FAV-06 | — | N/A | manual | — | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | FAV-08 | T-7-03 | UNIQUE 约束验证 | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- 项目无测试框架，Wave 0 为手动验证
- 所有验证通过 `npm run dev` 启动应用后手动测试

*Existing infrastructure covers all phase requirements through manual testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 收藏当前页面 | FAV-01 | 无自动化测试框架 | 打开页面 → 点击星标 → 验证星标变实心金色 |
| 取消收藏 | FAV-02 | 无自动化测试框架 | 已收藏页面 → 点击星标 → 验证星标变空心 |
| 查看收藏列表 | FAV-03 | 无自动化测试框架 | 点击收藏夹按钮 → 验证 realm://favorites 页面显示收藏列表 |
| 编辑收藏标题 | FAV-04 | 无自动化测试框架 | 收藏列表 → 点击标题 → 编辑 → 回车保存 → 验证标题更新 |
| 删除收藏 | FAV-05 | 无自动化测试框架 | 收藏列表 → 勾选复选框 → 点击删除 → 验证收藏消失 |
| 搜索收藏 | FAV-06 | 无自动化测试框架 | 收藏列表 → 输入关键词 → 验证列表实时过滤 + 高亮匹配 |
| 容器隔离 | FAV-07 | 无自动化测试框架 | 容器A收藏 → 切换容器B → 验证收藏列表为空 |
| URL 去重 | FAV-08 | 无自动化测试框架 | 已收藏页面 → 再次收藏 → 验证提示"已收藏过该页面" |

---

## Validation Sign-Off

- [ ] All tasks have manual verification procedures
- [ ] Sampling continuity: 每个任务完成后手动验证
- [ ] Wave 0: 通过 `npm run dev` 启动应用验证
- [ ] No watch-mode flags
- [ ] Feedback latency: N/A（手动验证）
- [ ] `nyquist_compliant: false`（项目无测试框架）

**Approval:** pending

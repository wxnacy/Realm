---
phase: 31
slug: download-manager-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 31 — Validation Strategy

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

- **After every task commit:** 手动测试当前任务交付物
- **After every plan wave:** 手动验证该波次所有需求行为
- **Before `/gsd-verify-work`:** 完整手动验证所有 6 项需求
- **Max feedback latency:** 手动测试

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | DL-02 | — | N/A | manual | — | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | DL-02 | T-31-01 | 文件路径验证 | manual | — | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 1 | DL-03 | — | N/A | manual | — | ❌ W0 | ⬜ pending |
| 31-02-02 | 02 | 1 | DL-04 | — | N/A | manual | — | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 2 | DL-06 | — | N/A | manual | — | ❌ W0 | ⬜ pending |
| 31-03-02 | 03 | 2 | DL-07 | T-31-02 | 路径遍历删除防护 | manual | — | ❌ W0 | ⬜ pending |
| 31-03-03 | 03 | 2 | DL-08 | T-31-03 | 批量删除二次确认 | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 无自动化测试（项目未配置测试框架，Wave 0 无需求）

*Existing infrastructure covers all phase requirements (manual verification only).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 下载面板打开/关闭 | DL-02 | UI 交互无自动化 | 点击下载按钮，面板弹出；再次点击或点击外部关闭 |
| 下载历史列表渲染 | DL-02 | DOM 渲染验证 | 面板内显示下载记录，包含文件名、大小、时间、状态 |
| 暂停进行中的下载 | DL-03 | Electron DownloadItem 状态 | 下载进行中点击暂停，进度停止，按钮切换为恢复 |
| 恢复已暂停的下载 | DL-04 | Electron DownloadItem 状态 | 暂停后点击恢复，进度继续 |
| 在 Finder 中显示文件 | DL-06 | macOS 系统交互 | 点击 Finder 按钮，Finder 窗口弹出并选中文件 |
| 删除单条记录（仅记录） | DL-07 | SQLite + UI 同步 | 删除后记录消失，本地文件保留 |
| 删除单条记录（含文件） | DL-07 | 文件系统 + SQLite | 删除后记录消失，本地文件也被删除 |
| 清空所有下载历史 | DL-08 | SQLite 清空 | 点击清空按钮，确认弹窗后所有记录清除 |
| realm://downloads 页面 | DL-02 | webview 加载 | 访问 realm://downloads 显示完整下载历史 |
| 路径遍历删除防护 | Security | 安全验证 | 尝试构造恶意 save_path，删除操作应拒绝 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: manual (N/A for automation)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

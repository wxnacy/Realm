---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: 多窗口支持
status: planning
last_updated: "2026-08-14T11:58:04.989Z"
last_activity: 2026-08-14
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Realm Browser

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-11)

**Core value:** 容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载。
**Current focus:** Phase 31 — download-manager-ui

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-14 — Milestone v2.4 started

## Performance Metrics

**Velocity:**

- Total plans completed: 29
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 22. CDP 管理器扩展 | 5 | - | - |
| 23. 智能上下文引用 | 2 | - | - |
| 24. 任务自主执行 | 4 | - | - |
| 25. 脚本生成 + 标签整理 | 7 | - | - |
| 26 | 2 | - | - |
| 28 | 2 | - | - |
| 29 | 2 | - | - |
| 31 | 3 | - | - |
| 32 | 2 | - | - |

*Updated after each plan completion*
| Phase 33-bug P03 | 5min | 8 tasks | 1 files |

## Accumulated Context

### Roadmap Evolution

- v2.3 roadmap created: 4 phases (30-33)
  - Phase 30: 下载管理器 — 核心引擎 (DL-01, DL-05, DL-09, DL-10, DL-11)
  - Phase 31: 下载管理器 — 用户交互 (DL-02, DL-03, DL-04, DL-06, DL-07, DL-08)
  - Phase 32: 自动填充 — 凭据引擎 (AF-01, AF-02, AF-03, AF-05, AF-08, AF-09)
  - Phase 33: 自动填充 — 增强 + Bug 修复 (AF-04, AF-06, AF-07, FIX-01, FIX-02)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.3 路线图: 4 阶段结构（下载核心 → 下载交互 → 自动填充引擎 → 自动填充增强+修复），granularity=coarse 匹配
- v2.3 技术选型: 零新依赖，全部基于 Electron 原生 API（DownloadItem、safeStorage）+ 已有基础设施
- 下载历史表单表设计（container_id 列区分容器），非分表——简化查询
- 凭据加密使用 safeStorage 异步 API（encryptStringAsync/decryptStringAsync），避免阻塞主线程
- 表单检测在 webview-preload.js 中完成（需要 DOM 上下文），凭据读写走主进程 IPC
- getAllDownloads 不按 container_id 过滤（D-05: 面板显示所有容器记录）
- clearAllDownloads 只删记录不删文件（D-16: 用户可能想保留文件只清记录）
- deleteDownload 需验证 save_path 在用户下载目录内（T-31-01: 防路径遍历删除任意文件）
- [Phase ?]: 地址横幅复用凭据横幅的完整模式
- [Phase ?]: 地址没有永不保存功能，neverBtn 直接关闭横幅

### Pending Todos

**Phase 33 地址功能端到端验证（AF-06, AF-07）：**

地址功能已通过代码级验证，但尚未进行人工端到端测试。以下场景需在实际使用中验证：

| # | 场景 | 验证步骤 | 状态 |
|---|------|----------|------|
| V-1 | 地址保存横幅弹出 | 打开含地址表单的网页，填写姓名/手机/地址后提交，确认横幅弹出 | ⬜ 待验证 |
| V-2 | 保存地址 | 点击横幅"保存地址"按钮，确认地址成功保存 | ⬜ 待验证 |
| V-3 | 地址自动填充 | 重新访问含地址表单的网页，确认字段自动填充 | ⬜ 待验证 |
| V-4 | 设置页地址管理 | 设置页 → 自动填充 → 收货地址，确认查看/编辑/删除功能 | ⬜ 待验证 |
| V-5 | 容器隔离 | 切换容器后访问同一网页，确认不填充其他容器地址 | ⬜ 待验证 |
| V-6 | 横幅自动消失 | 不操作，确认 10 秒后横幅自动消失 | ⬜ 待验证 |
| V-7 | ESC 关闭横幅 | 横幅显示时按 ESC，确认关闭 | ⬜ 待验证 |

详细记录见：`.planning/phases/33-bug/33-VERIFICATION.md`

### Blockers/Concerns

- safeStorage 在 Linux 无密钥管理器时降级为明文加密，必须检测并拒绝存储凭据
- will-download 路径设置时序：setSavePath() 只能在回调内同步调用
- 断点续传依赖服务端 Range + ETag 支持，不支持时 resume() 会从头重下
- autofill 与 CDP fillForm 互斥机制需在 Phase 32 中实现

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260805-icj | 浏览器左侧常住的容器列表也要跟地址栏左侧弹窗一样增加修改和删除按钮 | 2026-08-05 | 1e13395 | [260805-icj-sidebar-container-edit-delete-btns](./quick/260805-icj-sidebar-container-edit-delete-btns/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| 下载与缓存 | DL-01~05 (下载管理器/分片合并/边播边缓存) | Deferred to v2.3 | v2.2 planning |
| 增强功能 | ENH-01~06 (截图/画中画/播放列表/字幕/DASH/RTMP) | Future | v2.2 planning |
| debug | 13 debug sessions from v2.0 | diagnosed | v2.0 |
| review | Phase 23 代码审查遗留 19 项（6 Critical） | open | v2.1 |

## Session Continuity

Last session: 2026-08-14T06:15:54.225Z
Stopped at: Completed 33-03-PLAN.md
Resume file: None

## Operator Next Steps

- Phase 32 context gathered — plan Phase 32 with `/gsd-plan-phase 32`

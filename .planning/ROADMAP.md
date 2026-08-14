# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，支持独立的 Cookie 管理、浏览历史记录、收藏夹、常用网站推荐和应用设置。每个容器完全隔离（Cookie、缓存、存储），已集成 AI Agent SDK。

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- ✅ **v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面** — Phases 5-9 (shipped 2026-07-26)
- ✅ **v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式** — Phases 10-12 (shipped 2026-07-27)
- ✅ **v1.3 右键菜单增强** — Phase 13 (shipped 2026-07-27)
- ✅ **v2.0 收藏夹文件夹支持 + AI Agent 集成** — Phases 14-21 (shipped 2026-08-01)
- ✅ **v2.1 AI CDP 增强 + Tabbrowser 功能集成** — Phases 22-25 (shipped 2026-08-04)
- ✅ **v2.2 多媒体功能集成** — Phases 26-29 (shipped 2026-08-11)
- 🔧 **v2.3 浏览器基础功能补全** — Phases 30-33 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-25</summary>

- [x] Phase 1: Core Container Management + Architecture Refactoring — completed 2026-07-23
- [x] Phase 2: Browser Core - URL Navigation + Multi-Tab — completed 2026-07-23
- [x] Phase 3: Data Isolation + Cookie Persistence — completed 2026-07-23
- [x] Phase 4: Convenience Features — completed 2026-07-24

</details>

<details>
<summary>✅ v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面 (Phases 5-9) — SHIPPED 2026-07-26</summary>

- [x] Phase 5: 容器属性扩展 — completed 2026-07-25
- [x] Phase 6: 浏览历史记录 — completed 2026-07-25
- [x] Phase 7: 收藏夹管理 — completed 2026-07-25
- [x] Phase 8: 常用网站推荐 + 设置页面 — completed 2026-07-25
- [x] Phase 9: 共享收藏数据库 — completed 2026-07-26

</details>

<details>
<summary>✅ v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式 (Phases 10-12) — SHIPPED 2026-07-27</summary>

- [x] Phase 10: Cookie 管理增强 — completed 2026-07-26
- [x] Phase 11: 设置页面重构 — completed 2026-07-27
- [x] Phase 12: 开发者模式 — completed 2026-07-27

</details>

<details>
<summary>✅ v1.3 右键菜单增强 (Phase 13) — SHIPPED 2026-07-27</summary>

- [x] Phase 13: 右键菜单增强 — completed 2026-07-27

</details>

<details>
<summary>✅ v2.0 收藏夹文件夹支持 + AI Agent 集成 (Phases 14-21) — SHIPPED 2026-08-01</summary>

- [x] Phase 14: 收藏夹文件夹 - 数据库层实现 — completed 2026-07-28
- [x] Phase 15: 收藏夹文件夹 - UI 交互 — completed 2026-07-28
- [x] Phase 16: 收藏夹文件夹 - 增强功能 — completed 2026-07-29
- [x] Phase 17: Chrome 书签导入 — completed 2026-07-30
- [x] Phase 18: 收藏栏功能 — completed 2026-07-30
- [x] Phase 19: AI Agent 集成 - 基础验证 — completed 2026-07-31
- [x] Phase 20: AI Agent 集成 - 核心功能 — completed 2026-08-01
- [x] Phase 21: AI Agent 集成 - 聊天 UI — completed 2026-08-01

</details>

<details>
<summary>✅ v2.1 AI CDP 增强 + Tabbrowser 功能集成 (Phases 22-25) — SHIPPED 2026-08-04</summary>

- [x] Phase 22: CDP 管理器扩展 + 基础网页操控工具 (5/5 plans) — completed 2026-08-02
- [x] Phase 23: 智能上下文引用 + 全文检索 (2/2 plans) — completed 2026-08-02
- [x] Phase 24: 任务自主执行 (4/4 plans) — completed 2026-08-02
- [x] Phase 25: 脚本生成 + 智能标签整理 (7/7 plans) — completed 2026-08-04

</details>

<details>
<summary>✅ v2.2 多媒体功能集成 (Phases 26-29) — SHIPPED 2026-08-11</summary>

- [x] Phase 26: 视频源检测 + IPC 基础 (2/2 plans) — completed 2026-08-06
- [x] Phase 27: 媒体面板 (2/2 plans) — completed 2026-08-07
- [x] Phase 28: 播放器窗口 (2/2 plans) — completed 2026-08-08
- [x] Phase 29: 多媒体播放器设置控制 (5/5 plans) — completed 2026-08-08

</details>

<details open>
<summary>🔧 v2.3 浏览器基础功能补全 (Phases 30-33) — IN PROGRESS</summary>

- [ ] **Phase 30: 下载管理器 — 核心引擎** — 文件下载拦截、保存对话框、进度追踪、工具栏集成、SQLite 持久化
- [x] **Phase 31: 下载管理器 — 用户交互** — 下载历史面板、暂停/恢复、文件操作、批量管理
- [x] **Phase 32: 自动填充 — 凭据引擎** — 登录凭据加密存储、表单检测、自动填充、容器隔离 (completed 2026-08-13)
- [ ] **Phase 33: 自动填充 — 增强 + Bug 修复** — 凭据管理 UI、地址表单、autofill/fillForm 互斥、Bug 修复与代码清理

</details>

## Phase Details

### Phase 30: 下载管理器 — 核心引擎

**Goal**: 用户在浏览器中下载文件时，能看到保存对话框、实时进度，并且下载记录持久化
**Depends on**: Nothing (first v2.3 phase)
**Requirements**: DL-01, DL-05, DL-09, DL-10, DL-11
**Success Criteria** (what must be TRUE):

  1. 用户点击下载链接时弹出系统保存对话框，可选择保存位置
  2. 下载进行时显示实时进度条（文件名、大小、速度、剩余时间）
  3. 下载完成后记录持久化到 SQLite，重启后仍可查看
  4. 工具栏下载按钮在有活跃下载时显示数量徽标
  5. 下载数据按容器隔离存储，不同容器的下载记录互不干扰

**Plans:** 2/2 plans complete
Plans:

- [x] 30-01-PLAN.md — 下载管理器后端核心：download-manager.js 模块 + SQLite 持久化 + IPC 通道
- [x] 30-02-PLAN.md — 下载管理器前端 UI：preload API + 下载按钮 + 进度环 + 徽标 + tooltip

**UI hint**: yes

### Phase 31: 下载管理器 — 用户交互

**Goal**: 用户可以通过下载面板管理所有下载任务——查看历史、暂停恢复、操作文件
**Depends on**: Phase 30
**Requirements**: DL-02, DL-03, DL-04, DL-06, DL-07, DL-08
**Success Criteria** (what must be TRUE):

  1. 用户可以打开下载面板查看所有下载历史列表
  2. 用户可以暂停正在进行的下载，稍后恢复
  3. 用户可以打开已下载的文件（使用系统默认应用）
  4. 用户可以在 Finder 中显示已下载的文件
  5. 用户可以删除单条下载记录（可选是否删除本地文件）或清空所有历史

**Plans**: 3/3 plans complete
Plans:

- [x] 31-03-PLAN.md

**Wave 1**

- [x] 31-01-PLAN.md — 下载管理器后端扩展：全局查询 + 删除 + 清空 + realm HTTP API

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 31-02-PLAN.md — 下载管理器前端 UI：下拉面板 + 列表项 + 操作交互 + realm://downloads 页面

**UI hint**: yes

### Phase 32: 自动填充 — 凭据引擎

**Goal**: 用户登录网站时可保存凭据，再次访问时自动填充，并且凭据按容器隔离存储
**Depends on**: Nothing (与 Phase 30/31 无技术依赖，可并行规划)
**Requirements**: AF-01, AF-02, AF-03, AF-05, AF-08, AF-09
**Success Criteria** (what must be TRUE):

  1. 用户提交登录表单时弹出保存凭据提示
  2. 保存的凭据使用 safeStorage 加密存储（macOS Keychain）
  3. 用户再次访问已保存凭据的网站时自动填充用户名和密码
  4. 凭据按容器隔离存储，容器 A 的凭据不会在容器 B 中被填充
  5. AI 填表（CDP fillForm）激活时，浏览器 autofill 自动禁用，避免冲突

**Plans**: 2/2 plans complete

**Wave 1**

- [x] 32-01-PLAN.md — 凭据管理器后端：credential-manager.js 模块 + safeStorage 加密 + SQLite 持久化 + IPC 通道

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 32-02-PLAN.md — 表单检测 + 自动填充注入 + credentialAPI + 保存凭据横幅 UI

**UI hint**: yes

### Phase 33: 自动填充 — 增强

**Goal**: 用户可以管理已保存的凭据和地址信息
**Depends on**: Phase 32
**Requirements**: AF-04, AF-06, AF-07
**Success Criteria** (what must be TRUE):

  1. 用户可以在设置页查看和删除已保存的凭据
  2. 用户可以保存地址表单信息（姓名、电话、地址），并在地址表单中自动填充

**Plans**: 2/2 plans complete

**Wave 1**

- [x] 33-01-PLAN.md — 凭据管理 — 后端扩展 + 设置页 UI（credential-manager 扩展 + /api/credentials/* HTTP 路由 + 凭据表格 UI）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 33-02-PLAN.md — 地址功能 — 全栈实现（address-manager.js + 地址表单检测 + 自动填充 + 保存横幅 + 设置页卡片）

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 30 → 31 → 32 → 33

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Container Management + Architecture Refactoring | v1.0 | 3/3 | Complete | 2026-07-23 |
| 2. Browser Core - URL Navigation + Multi-Tab | v1.0 | 5/5 | Complete | 2026-07-23 |
| 3. Data Isolation + Cookie Persistence | v1.0 | 1/1 | Complete | 2026-07-23 |
| 4. Convenience Features | v1.0 | 3/3 | Complete | 2026-07-24 |
| 5. 容器属性扩展 | v1.1 | 1/1 | Complete | 2026-07-25 |
| 6. 浏览历史记录 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 7. 收藏夹管理 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 8. 常用网站推荐 + 设置页面 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 9. 共享收藏数据库 | v1.1 | 3/4 | Complete | 2026-07-26 |
| 10. Cookie 管理增强 | v1.2 | 2/2 | Complete | 2026-07-26 |
| 11. 设置页面重构 | v1.2 | 2/2 | Complete | 2026-07-27 |
| 12. 开发者模式 | v1.2 | 2/2 | Complete | 2026-07-27 |
| 13. 右键菜单增强 | v1.3 | 3/3 | Complete | 2026-07-27 |
| 14. 收藏夹文件夹 - 数据库层实现 | v2.0 | 1/1 | Complete | 2026-07-28 |
| 15. 收藏夹文件夹 - UI 交互 | v2.0 | 2/2 | Complete | 2026-07-28 |
| 16. 收藏夹文件夹 - 增强功能 | v2.0 | 3/3 | Complete | 2026-07-29 |
| 17. Chrome 书签导入 | v2.0 | 2/2 | Complete | 2026-07-30 |
| 18. 收藏栏功能 | v2.0 | 2/2 | Complete | 2026-07-30 |
| 19. AI Agent 集成 - 基础验证 | v2.0 | 2/2 | Complete | 2026-07-31 |
| 20. AI Agent 集成 - 核心功能 | v2.0 | 2/2 | Complete | 2026-08-01 |
| 21. AI Agent 集成 - 聊天 UI | v2.0 | 3/3 | Complete | 2026-08-01 |
| 22. CDP 管理器扩展 + 基础网页操控工具 | v2.1 | 5/5 | Complete | 2026-08-02 |
| 23. 智能上下文引用 + 全文检索 | v2.1 | 2/2 | Complete | 2026-08-02 |
| 24. 任务自主执行 | v2.1 | 4/4 | Complete | 2026-08-02 |
| 25. 脚本生成 + 智能标签整理 | v2.1 | 7/7 | Complete | 2026-08-04 |
| 26. 视频源检测 + IPC 基础 | v2.2 | 2/2 | Complete | 2026-08-06 |
| 27. 媒体面板 | v2.2 | 2/2 | Complete | 2026-08-07 |
| 28. 播放器窗口 | v2.2 | 2/2 | Complete | 2026-08-08 |
| 29. 多媒体播放器设置控制 | v2.2 | 5/5 | Complete | 2026-08-08 |
| 30. 下载管理器 — 核心引擎 | v2.3 | 2/2 | Complete   | 2026-08-11 |
| 31. 下载管理器 — 用户交互 | v2.3 | 3/3 | Complete    | 2026-08-12 |
| 32. 自动填充 — 凭据引擎 | v2.3 | 2/2 | Complete    | 2026-08-13 |
| 33. 自动填充 — 增强 + Bug 修复 | v2.3 | 2/2 | Complete   | 2026-08-14 |

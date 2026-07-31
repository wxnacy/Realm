# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，支持独立的 Cookie 管理、浏览历史记录、收藏夹、常用网站推荐和应用设置。每个容器完全隔离（Cookie、缓存、存储），未来将集成 AI Agent SDK。

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- ✅ **v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面** — Phases 5-9 (shipped 2026-07-26)
- ✅ **v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式** — Phases 10-12 (shipped 2026-07-27)
- ✅ **v1.3 右键菜单增强** — Phase 13 (shipped 2026-07-27)

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

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

---

## v2.0 收藏夹文件夹支持 + AI Agent 集成

> 创建日期：2026-07-28
> 总计：8 个阶段，18 个需求
> 预估时间：21 天

### 路线图总览

```
Phase 14  Phase 15  Phase 16  Phase 17  Phase 18  Phase 19  Phase 20  Phase 21
   │         │         │         │         │         │         │         │
   ▼         ▼         ▼         ▼         ▼         ▼         ▼         ▼
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│文件夹│  │文件夹│  │收藏夹│  │Chrome│  │收藏栏│  │ AI  │  │ AI  │  │ AI  │
│ DB  │→│ UI  │→│增强  │→│导入  │→│功能  │→│验证 │→│核心 │→│ UI  │
│层实现│  │交互  │  │功能  │  │功能  │  │     │  │     │  │功能  │  │     │
└─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘
   2d        3d       3d       2d       2d       2d       4d       3d
```

### Phases

<details>
<summary>v2.0 收藏夹文件夹 + Chrome 导入 + 收藏栏 + AI Agent (Phases 14-21)</summary>

- [ ] Phase 14: 收藏夹文件夹 - 数据库层实现 (2d)
- [x] Phase 15: 收藏夹文件夹 - UI 交互 (3d) (completed 2026-07-28)
- [x] Phase 16: 收藏夹文件夹 - 增强功能 (3d) (completed 2026-07-29)
- [x] Phase 17: Chrome 书签导入 (2d) (completed 2026-07-30)
- [x] Phase 18: 收藏栏功能 (2d) (completed 2026-07-30)
- [ ] Phase 19: AI Agent 集成 - 基础验证 (2d)
- [ ] Phase 20: AI Agent 集成 - 核心功能 (4d)
- [ ] Phase 21: AI Agent 集成 - 聊天 UI (3d)

</details>

### Phase 详情

#### Phase 14: 收藏夹文件夹 - 数据库层实现

**预估时间**: 2 天
**需求覆盖**: FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-04
**状态**: 执行完成 (2026-07-28)

**任务**:

- [x] 创建 `favorite_folders` 表
- [x] `favorites` 表添加 `folder_id` 和 `sort_order` 字段
- [x] 实现文件夹 CRUD API
- [x] 实现收藏项移动 API
- [x] 注册 IPC 通道
- [x] 暴露 Preload API

---

#### Phase 15: 收藏夹文件夹 - UI 交互

**预估时间**: 3 天
**需求覆盖**: FOLDER-05, FOLDER-06, FOLDER-08
**状态**: 规划完成

**Plans:** 2/2 plans complete

Plans:

- [ ] PLAN.md
- [x] 15-01-PLAN.md — 后端 folder_id 过滤 + HTML 左右分栏 + 文件夹树 + 面包屑 + 右键菜单 + 新建文件夹
- [x] 15-02-PLAN.md — 缺口修复：空白区域右键菜单事件委托（.favorites-main 路由 + preventDefault 兜底）

**任务**:

- [ ] 后端支持 folder_id 过滤 + HTML 左右分栏布局 + CSS 样式
- [ ] 文件夹树渲染、导航逻辑和面包屑
- [ ] 右键菜单和新建文件夹 UI

---

#### Phase 16: 收藏夹文件夹 - 增强功能

**预估时间**: 3 天
**需求覆盖**: FOLDER-07
**状态**: 执行完成 (2026-07-29)
**计划**: 3/3 完成

**计划列表**:

- [x] 16-01-PLAN.md — 数据库迁移与排序持久化（fractional indexing 迁移 + 批量排序 API + compute-sort-keys 端点）
- [x] 16-02-PLAN.md — 拖拽排序核心实现（同目录排序 + 跨文件夹移动 + 视觉反馈）
- [x] 16-03-PLAN.md — 多选与批量操作（键盘多选 + 右键菜单自适应 + 批量操作）

**任务**:

- [x] 拖拽排序实现
- [x] 排序持久化
- [x] 批量操作增强

---

#### Phase 17: Chrome 书签导入

**预估时间**: 2 天
**需求覆盖**: IMPORT-01, IMPORT-02, IMPORT-03
**状态**: 规划完成

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 17-01-PLAN.md — 后端书签解析与批量导入（favorites-manager.js + main.js + preload.js）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md — 导入功能前端 UI（favorites.html + favorites-page.js + main.css）

**任务**:

- [ ] Chrome JSON 书签解析 + HTML 书签解析 + 批量导入 API + IPC handlers
- [ ] 导入按钮 + 进度模态框 + 预览确认 + 结果摘要 UI

---

#### Phase 18: 收藏栏功能

**预估时间**: 2 天
**需求覆盖**: BAR-01, BAR-02, BAR-03, BAR-04
**状态**: 执行完成 (2026-07-30)

**Plans:** 2 plans

Plans:

**Wave 1**

- [x] 18-01-PLAN.md — 收藏栏基础实现（HTML/CSS + 渲染 + 溢出计算 + 点击导航）

**Wave 2** *(blocked on Wave 1)*

- [x] 18-02-PLAN.md — 收藏栏高级交互（下拉菜单 + 右键菜单 + 显示/隐藏设置）

**任务**:

- [x] 收藏栏 UI 实现（HTML + CSS + IPC + Preload）
- [x] 收藏栏渲染与溢出计算
- [x] 文件夹下拉菜单与溢出菜单
- [x] 收藏栏右键菜单集成
- [x] 收藏栏显示/隐藏设置

---

#### Phase 19: AI Agent 集成 - 基础验证

**预估时间**: 2 天
**需求覆盖**: AI-01
**对应**: pi-agent-integration.md Phase 1
**状态**: 规划完成

**Plans:** 2 plans

Plans:

**Wave 1**

- [ ] 19-01-PLAN.md — Node 版本验证 + 依赖安装 + AI Manager 骨架

**Wave 2** *(blocked on Wave 1)*

- [ ] 19-02-PLAN.md — Demo 验证：Agent + get_tabs 工具执行

**任务**:

- [ ] Node.js 版本验证
- [ ] pi-ai/pi-agent-core 安装验证
- [ ] AI Manager 骨架
- [ ] 最小可行 Demo

**重要说明**: AI 功能完全基于 pi-agent-core 集成，不自行开发 Agent 循环

---

#### Phase 20: AI Agent 集成 - 核心功能

**预估时间**: 4 天
**需求覆盖**: AI-02
**对应**: pi-agent-integration.md Phase 2

**任务**:

- [ ] AI Manager 完整实现
- [ ] Realm 工具注册（navigate, search_history, manage_favorites, switch_container, get_tabs）
- [ ] IPC 通道实现
- [ ] Preload.js API 暴露

---

#### Phase 21: AI Agent 集成 - 聊天 UI

**预估时间**: 3 天
**需求覆盖**: AI-03
**对应**: pi-agent-integration.md Phase 3

**任务**:

- [ ] AI 聊天面板 UI
- [ ] 流式消息渲染
- [ ] 快捷键和设置
- [ ] 面板交互增强

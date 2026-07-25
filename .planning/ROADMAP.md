# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，从当前的单文件架构演进为模块化架构。Phase 1 重构核心代码并实现容器 CRUD 和管理 UI；Phase 2 迁移到 WebContentsView 实现多 Tab 和 URL 导航；Phase 3 确保数据完全隔离并实现 Cookie 持久化；Phase 4 补充便利功能。四个阶段完成后，产品具备完整的多容器浏览器能力。v1.1 继续增强容器元数据、添加浏览数据管理能力、优化新标签页体验并提供应用设置。

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- 🚧 **v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面** — Phases 5-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-25</summary>

- [x] **Phase 1: Core Container Management + Architecture Refactoring** — completed 2026-07-23
- [x] **Phase 2: Browser Core - URL Navigation + Multi-Tab** — completed 2026-07-23
- [x] **Phase 3: Data Isolation + Cookie Persistence** — completed 2026-07-23
- [x] **Phase 4: Convenience Features** — completed 2026-07-24

</details>

### 🚧 v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面

- [x] **Phase 5: 容器属性扩展** — 容器增加手机号、邮箱、备注属性，旧数据自动兼容 (completed 2026-07-25)
- [ ] **Phase 6: 浏览历史记录** — 自动记录页面导航、按容器隔离存储、列表展示、搜索、清理
- [ ] **Phase 7: 收藏夹管理** — 收藏/取消收藏、收藏列表、编辑/删除、搜索、容器隔离
- [ ] **Phase 8: 常用网站推荐 + 设置页面** — 新标签页常用网站网格（frecency）+ 应用设置

## Phase Details

<details>
<summary>Phase 1: Core Container Management + Architecture Refactoring</summary>

**Goal**: 用户可以通过下拉面板管理容器（创建/编辑/删除），应用采用模块化架构
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06
**Success Criteria** (what must be TRUE):

1. 用户可以创建新容器，设置名称、颜色、图标，新容器立即出现在列表中
2. 用户可以编辑和删除容器，删除前有确认提示
3. 用户可以通过工具栏下拉面板查看所有容器，点击容器后进入该容器，后续新 Tab 在该容器中打开
4. 用户可以点击其他容器，在新 Tab 中打开该容器

**Plans**: 3 plans

Plans:

- [x] 01-01-PLAN.md — Walking Skeleton: 模块化架构重构 + 容器下拉面板 + 容器切换
- [x] 01-02-PLAN.md — 容器创建/编辑 Modal（统一表单、颜色选择器、emoji 选择器）
- [x] 01-03-PLAN.md — 容器删除确认弹窗 + 输入验证增强

**UI hint**: yes

</details>

<details>
<summary>Phase 2: Browser Core - URL Navigation + Multi-Tab</summary>

**Goal**: 用户可以在同一窗口内以多 Tab 形式浏览不同容器的网页
**Depends on**: Phase 1
**Requirements**: BROW-01, BROW-02, BROW-03, BROW-04, BROW-05
**Success Criteria** (what must be TRUE):

1. 用户可以在容器中输入 URL 并导航到目标网页
2. 用户可以使用前进、后退、刷新按钮进行页面导航
3. 用户可以在同一窗口内打开多个 Tab，每个 Tab 属于不同容器，互不影响
4. 用户可以关闭 Tab，关闭后该 Tab 的资源被正确释放
5. 用户可以看到每个 Tab 的标题和容器颜色标识，清楚区分当前 Tab 属于哪个容器

**Plans**: 5 plans

Plans:

- [x] 02-01-PLAN.md — Tab 栏 UI + 新标签页 + Tab 本地管理（渲染进程）
- [x] 02-02-PLAN.md — Webview 集成 + URL 导航 + 导航控件
- [x] 02-03-PLAN.md — 主进程 Tab 管理 + IPC 集成 + 持久化
- [x] 02-04-PLAN.md — Gap 修复：webviewTag 启用 + URL Enter 处理器 webview/newTabPage 可见性修复
- [x] 02-05-PLAN.md — Gap 修复：进度条定位 + 刷新按钮图标 + 冷启动无 Tab 时 URL 回车惰性创建 Tab

**UI hint**: yes

</details>

<details>
<summary>Phase 3: Data Isolation + Cookie Persistence</summary>

**Goal**: 每个容器的数据完全隔离，Cookie 在应用重启后自动恢复
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ISO-01, ISO-02, ISO-03, ISO-04, PST-01, PST-02, PST-03
**Success Criteria** (what must be TRUE):

1. 每个容器的 Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存完全隔离，容器间互不干扰
2. 用户可以在同一网站同时登录不同容器的不同账号，互不影响
3. 应用关闭时每个容器的 Cookie 自动保存到独立 JSON 文件，domain 前缀点号格式正确保留
4. 应用启动时各容器的 Cookie 自动加载，用户无需重新登录

**Plans**: 1 plan

Plans:

- [x] 03-01-PLAN.md — Cookie 管理模块 + 自动保存/加载 + 手动导出/导入

</details>

<details>
<summary>Phase 4: Convenience Features</summary>

**Goal**: 用户可以通过分配规则和快捷键提升多容器浏览效率
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CNV-01, CNV-02
**Success Criteria** (what must be TRUE):

1. 用户可以设置容器分配规则，指定网站自动在特定容器打开
2. 用户可以使用快捷键进行常用操作（新建 Tab、关闭 Tab、切换容器）

**Plans**: 3 plans

Plans:

- [x] 04-01-PLAN.md — 容器分配规则 + 快捷键管理
- [x] 04-02-PLAN.md — 快捷键重构：globalShortcut → Menu Accelerator
- [x] 04-03-PLAN.md — 规则管理 UI 增强：Toggle + Drag-Drop + Import/Export

**UI hint**: yes

</details>

### Phase 5: 容器属性扩展

**Goal**: 容器支持手机号、邮箱、备注等扩展属性，旧版本数据自动兼容
**Depends on**: Phase 4
**Requirements**: ATTR-01, ATTR-02, ATTR-03, ATTR-04, ATTR-05
**Success Criteria** (what must be TRUE):

  1. 用户可以在编辑容器 Modal 中为容器设置手机号、邮箱、备注
  2. 容器属性在创建和编辑容器时均可填写和修改
  3. 旧版本容器数据升级后自动填充缺失字段的默认值，不会崩溃

**Plans**: 1/1 plans complete

Plans:

- [x] 05-01-PLAN.md — 数据模型扩展（主进程惰性填充 + IPC 验证）+ 表单 UI 扩展（邮箱/手机号/备注字段 + 验证 + textarea 样式）

### Phase 6: 浏览历史记录

**Goal**: 应用自动记录用户浏览的页面，按容器隔离存储，用户可以查看、搜索和清理历史
**Depends on**: Phase 5
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-06, HIST-07
**Success Criteria** (what must be TRUE):

  1. 用户访问的页面 URL 和标题被自动记录到当前容器的历史记录中
  2. 用户可以在工具栏查看当前容器的历史记录列表，不同容器的历史记录互不可见
  3. 用户可以搜索历史记录，输入关键词后实时过滤结果
  4. 用户可以删除单条历史记录或清空当前容器的全部历史
  5. 历史记录超过每容器 10000 条上限时自动淘汰最旧记录

**Plans**: 2/2 plans complete

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — 后端基础：SQLite history-manager.js + realm:// 协议 + IPC 通道 + 导航捕获 + 工具栏按钮

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — 前端 UI：历史记录页面（日期分组列表 + 搜索高亮 + 单条/批量删除 + 清空 + 样式）

### Phase 7: 收藏夹管理

**Goal**: 用户可以收藏和管理常用页面，收藏按容器隔离
**Depends on**: Phase 6
**Requirements**: FAV-01, FAV-02, FAV-03, FAV-04, FAV-05, FAV-06, FAV-07, FAV-08
**Success Criteria** (what must be TRUE):

  1. 用户可以点击工具栏按钮收藏当前页面，已收藏页面显示收藏状态
  2. 用户可以查看当前容器的收藏列表，不同容器的收藏互不可见
  3. 用户可以编辑收藏项的标题、删除收藏项、搜索收藏
  4. 同一 URL 在同一容器内不能重复收藏，重复操作给出提示

**Plans**: 2 plans

Plans:
**Wave 1**

- [ ] 07-01-PLAN.md — 后端基础：favorites-manager.js + /api/favorites/* API + IPC 通道 + preload API

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 07-02-PLAN.md — 前端 UI：工具栏按钮 + 收藏编辑面板 + 收藏列表页面（搜索/编辑/删除）

### Phase 8: 常用网站推荐 + 设置页面

**Goal**: 新标签页展示基于 frecency 排序的常用网站，用户可以配置应用设置
**Depends on**: Phase 6
**Requirements**: FREQ-01, FREQ-02, FREQ-03, FREQ-04, FREQ-05, SETT-01, SETT-02, SETT-03, SETT-04, SETT-05
**Success Criteria** (what must be TRUE):

  1. 新标签页展示常用网站网格，按 frecency（频率 + 最近性加权）排序，同一域名下多个页面合并为一个卡片
  2. 常用网站显示 favicon，按当前容器过滤，不同容器看到不同的推荐
  3. 用户可以打开设置页面，设置默认浏览器、历史记录保留天数等选项
  4. 设置变更立即持久化，应用重启后设置保持不变
  5. 设置页面引导用户将 Realm 设为系统默认浏览器

**Plans**: TBD

Plans:

- [ ] 08-01: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Container Management + Architecture Refactoring | v1.0 | 3/3 | Complete | 2026-07-23 |
| 2. Browser Core - URL Navigation + Multi-Tab | v1.0 | 5/5 | Complete | 2026-07-23 |
| 3. Data Isolation + Cookie Persistence | v1.0 | 1/1 | Complete | 2026-07-23 |
| 4. Convenience Features | v1.0 | 3/3 | Complete | 2026-07-24 |
| 5. 容器属性扩展 | v1.1 | 1/1 | Complete    | 2026-07-25 |
| 6. 浏览历史记录 | v1.1 | 2/2 | Complete   | 2026-07-25 |
| 7. 收藏夹管理 | v1.1 | 0/1 | Not started | - |
| 8. 常用网站推荐 + 设置页面 | v1.1 | 0/1 | Not started | - |

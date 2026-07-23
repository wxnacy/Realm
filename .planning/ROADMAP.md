# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，从当前的单文件架构演进为模块化架构。Phase 1 重构核心代码并实现容器 CRUD 和管理 UI；Phase 2 迁移到 WebContentsView 实现多 Tab 和 URL 导航；Phase 3 确保数据完全隔离并实现 Cookie 持久化；Phase 4 补充便利功能。四个阶段完成后，产品具备完整的多容器浏览器能力。

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Container Management + Architecture Refactoring** - 模块化重构 + 容器 CRUD + 管理 UI
- [ ] **Phase 2: Browser Core - URL Navigation + Multi-Tab** - WebContentsView 迁移 + 多 Tab + URL 导航
- [ ] **Phase 3: Data Isolation + Cookie Persistence** - 完整数据隔离 + Cookie 文件持久化
- [ ] **Phase 4: Convenience Features** - 容器分配规则 + 快捷键

## Phase Details

### Phase 1: Core Container Management + Architecture Refactoring

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
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: 模块化架构重构 + 容器下拉面板 + 容器切换

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — 容器创建/编辑 Modal（统一表单、颜色选择器、emoji 选择器）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — 容器删除确认弹窗 + 输入验证增强

**UI hint**: yes

### Phase 2: Browser Core - URL Navigation + Multi-Tab

**Goal**: 用户可以在同一窗口内以多 Tab 形式浏览不同容器的网页
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: BROW-01, BROW-02, BROW-03, BROW-04, BROW-05
**Success Criteria** (what must be TRUE):

  1. 用户可以在容器中输入 URL 并导航到目标网页
  2. 用户可以使用前进、后退、刷新按钮进行页面导航
  3. 用户可以在同一窗口内打开多个 Tab，每个 Tab 属于不同容器，互不影响
  4. 用户可以关闭 Tab，关闭后该 Tab 的资源被正确释放
  5. 用户可以看到每个 Tab 的标题和容器颜色标识，清楚区分当前 Tab 属于哪个容器

**Plans**: TBD

Plans:

- [ ] 02-01: TBD

**UI hint**: yes

### Phase 3: Data Isolation + Cookie Persistence

**Goal**: 每个容器的数据完全隔离，Cookie 在应用重启后自动恢复
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ISO-01, ISO-02, ISO-03, ISO-04, PST-01, PST-02, PST-03
**Success Criteria** (what must be TRUE):

  1. 每个容器的 Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存完全隔离，容器间互不干扰
  2. 用户可以在同一网站同时登录不同容器的不同账号，互不影响
  3. 应用关闭时每个容器的 Cookie 自动保存到独立 JSON 文件，domain 前缀点号格式正确保留
  4. 应用启动时各容器的 Cookie 自动加载，用户无需重新登录

**Plans**: TBD

Plans:

- [ ] 03-01: TBD

### Phase 4: Convenience Features

**Goal**: 用户可以通过分配规则和快捷键提升多容器浏览效率
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CNV-01, CNV-02
**Success Criteria** (what must be TRUE):

  1. 用户可以设置容器分配规则，指定网站自动在特定容器打开
  2. 用户可以使用快捷键进行常用操作（新建 Tab、关闭 Tab、切换容器）

**Plans**: TBD

Plans:

- [ ] 04-01: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Container Management + Architecture Refactoring | 3/3 | Complete | 2026-07-23 |
| 2. Browser Core - URL Navigation + Multi-Tab | 0/TBD | Not started | - |
| 3. Data Isolation + Cookie Persistence | 0/TBD | Not started | - |
| 4. Convenience Features | 0/TBD | Not started | - |

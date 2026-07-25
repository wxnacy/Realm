# Requirements: Realm Browser

**Defined:** 2026-07-23
**Core Value:** 容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载

## v1 Requirements

### 容器管理

- [x] **CONT-01**: 用户可以创建新容器，设置名称、颜色、图标
- [x] **CONT-02**: 用户可以编辑现有容器的名称、颜色、图标
- [x] **CONT-03**: 用户可以删除容器（含确认提示）
- [x] **CONT-04**: 用户可以通过工具栏下拉面板查看所有容器列表
- [x] **CONT-05**: 用户可以点击容器进入该容器，后续新 Tab 在该容器中打开
- [x] **CONT-06**: 用户可以点击其他容器，在新 Tab 中打开该容器

### 浏览器核心

- [x] **BROW-01**: 用户可以在容器中输入 URL 并导航到网页
- [x] **BROW-02**: 用户可以使用前进、后退、刷新按钮进行导航
- [x] **BROW-03**: 用户可以在同一窗口内打开多个 Tab，每个 Tab 属于不同容器
- [x] **BROW-04**: 用户可以关闭 Tab
- [x] **BROW-05**: 用户可以看到 Tab 标签页标题和容器颜色标识

### 数据隔离

- [x] **ISO-01**: 每个容器的 Cookie 和 Session 完全隔离，互不干扰
- [x] **ISO-02**: 每个容器的 LocalStorage 和 IndexedDB 完全隔离
- [x] **ISO-03**: 每个容器的 HTTP 缓存完全隔离
- [x] **ISO-04**: 用户可以在同一网站同时登录不同容器的不同账号

### Cookie 持久化

- [x] **PST-01**: 应用关闭时自动保存每个容器的 Cookie 到独立 JSON 文件
- [x] **PST-02**: 应用启动时自动加载各容器的 Cookie 文件
- [x] **PST-03**: Cookie 文件保留 domain 前缀点号格式（如 `.example.com`）

### 便利功能

- [x] **CNV-01**: 用户可以设置容器分配规则，指定网站自动在特定容器打开
- [x] **CNV-02**: 用户可以使用快捷键进行常用操作（新建 Tab、关闭 Tab、切换容器）

## v2 Requirements

### 高级功能

- **ADV-01**: 容器间数据导入导出
- **ADV-02**: Tab 内存优化（Tab discarding）
- **ADV-03**: 容器颜色标识的 Tab UI 增强
- **ADV-04**: 容器分组管理

## Out of Scope

| Feature | Reason |
|---------|--------|
| 浏览器扩展支持 | Electron 扩展支持不稳定，维护成本高，安全模型与容器隔离冲突 |
| 指纹伪装 | 技术复杂度极高，与核心定位不同 |
| 云同步/跨设备同步 | 需要后端基础设施，增加运维成本和安全风险 |
| 内置 VPN/代理 | 需要代理基础设施，成本高，与浏览器核心功能耦合 |
| AI Agent 集成 | 本期不实现，预留架构接口 |
| 移动端支持 | Electron 不适合移动端，需要完全不同的技术栈 |
| 团队协作/共享容器 | 需要云同步和权限系统 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1 | Complete |
| CONT-02 | Phase 1 | Complete |
| CONT-03 | Phase 1 | Complete |
| CONT-04 | Phase 1 | Complete |
| CONT-05 | Phase 1 | Complete |
| CONT-06 | Phase 1 | Complete |
| BROW-01 | Phase 2 | Complete |
| BROW-02 | Phase 2 | Complete |
| BROW-03 | Phase 2 | Complete |
| BROW-04 | Phase 2 | Complete |
| BROW-05 | Phase 2 | Complete |
| ISO-01 | Phase 3 | Complete |
| ISO-02 | Phase 3 | Complete |
| ISO-03 | Phase 3 | Complete |
| ISO-04 | Phase 3 | Complete |
| PST-01 | Phase 3 | Complete |
| PST-02 | Phase 3 | Complete |
| PST-03 | Phase 3 | Complete |
| CNV-01 | Phase 4 | Complete |
| CNV-02 | Phase 4 | Complete |

**Coverage:**

- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓
- Complete: 20/20 (100%) ✓

---
*Requirements defined: 2026-07-23*
*Last updated: 2026-07-25 after v1.0 milestone completion*

# Requirements: Realm Browser v1.1

**Defined:** 2026-07-25
**Core Value:** 容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载

## v1.1 Requirements

### 容器属性扩展

- [x] **ATTR-01**: 用户可以为容器设置手机号属性
- [x] **ATTR-02**: 用户可以为容器设置邮箱属性
- [x] **ATTR-03**: 用户可以为容器设置备注属性
- [x] **ATTR-04**: 容器属性在编辑容器 Modal 中展示和编辑
- [x] **ATTR-05**: 旧版本容器数据自动兼容（缺失字段填充默认值）

### 浏览历史记录

- [x] **HIST-01**: 应用自动记录用户访问的页面 URL 和标题
- [x] **HIST-02**: 历史记录按容器隔离存储
- [x] **HIST-03**: 用户可以查看当前容器的历史记录列表
- [x] **HIST-04**: 用户可以搜索历史记录
- [x] **HIST-05**: 用户可以删除单条历史记录
- [x] **HIST-06**: 用户可以清空当前容器的历史记录
- [x] **HIST-07**: 历史记录自动清理（每容器上限 10000 条，FIFO 淘汰）

### 收藏夹管理

- [x] **FAV-01**: 用户可以收藏当前页面
- [x] **FAV-02**: 用户可以取消收藏已收藏页面
- [x] **FAV-03**: 用户可以查看收藏列表
- [x] **FAV-04**: 用户可以编辑收藏项的标题
- [x] **FAV-05**: 用户可以删除收藏项
- [x] **FAV-06**: 用户可以搜索收藏
- [ ] **FAV-07**: ~~收藏按容器隔离~~（已重新设计：改为所有容器共享收藏数据库，由 FAV-09 替代）
- [x] **FAV-08**: 同一 URL 不能重复收藏（URL 全局唯一，跨容器去重）
- [ ] **FAV-09**: 收藏数据全局共享，所有容器看到同一份收藏列表
- [ ] **FAV-10**: 切换容器时收藏列表保持一致，无需按容器过滤

### 常用网站推荐

- [ ] **FREQ-01**: 新标签页展示常用网站网格
- [ ] **FREQ-02**: 常用网站基于 frecency 算法（频率 + 最近性加权）排序
- [ ] **FREQ-03**: 常用网站按域名聚合（同一域名下多个页面合并为一个卡片）
- [ ] **FREQ-04**: 常用网站显示 favicon
- [ ] **FREQ-05**: 常用网站合并所有容器历史记录（不按容器隔离，所有容器显示相同推荐）

### 设置页面

- [ ] **SETT-01**: 用户可以打开设置页面
- [ ] **SETT-02**: 设置页面包含默认浏览器引导功能
- [ ] **SETT-03**: 默认浏览器使用当前容器打开外部链接
- [ ] **SETT-04**: 设置持久化（electron-store）
- [ ] **SETT-05**: 设置页面包含历史记录保留天数配置

## Out of Scope

| Feature | Reason |
|---------|--------|
| 收藏文件夹分类 | 复杂度高，v1.2 实现 |
| 收藏栏显示 | UI 复杂度高，v1.2 实现 |
| 收藏智能分类建议 | AI 功能，v2.0 实现 |
| 容器属性自动填充（DOM 注入） | 安全风险高，需单独评估 |
| 历史记录跨 Tab 关联 | 复杂度高，v2.0 实现 |
| URL 输入框自动补全（匹配收藏/历史） | 复杂度较高，建议 defer |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ATTR-01 | Phase 5 | Complete |
| ATTR-02 | Phase 5 | Complete |
| ATTR-03 | Phase 5 | Complete |
| ATTR-04 | Phase 5 | Complete |
| ATTR-05 | Phase 5 | Complete |
| HIST-01 | Phase 6 | Complete |
| HIST-02 | Phase 6 | Complete |
| HIST-03 | Phase 6 | Complete |
| HIST-04 | Phase 6 | Complete |
| HIST-05 | Phase 6 | Complete |
| HIST-06 | Phase 6 | Complete |
| HIST-07 | Phase 6 | Complete |
| FAV-01 | Phase 7 | Complete |
| FAV-02 | Phase 7 | Complete |
| FAV-03 | Phase 7 | Complete |
| FAV-04 | Phase 7 | Complete |
| FAV-05 | Phase 7 | Complete |
| FAV-06 | Phase 7 | Complete |
| FAV-07 | Phase 9 | Pending (重新设计为共享) |
| FAV-08 | Phase 7 / 9 | Complete (语义扩展为全局唯一) |
| FAV-09 | Phase 9 | Pending |
| FAV-10 | Phase 9 | Pending |
| FREQ-01 | Phase 8 | Pending |
| FREQ-02 | Phase 8 | Pending |
| FREQ-03 | Phase 8 | Pending |
| FREQ-04 | Phase 8 | Pending |
| FREQ-05 | Phase 8 | Pending |
| SETT-01 | Phase 8 | Pending |
| SETT-02 | Phase 8 | Pending |
| SETT-03 | Phase 8 | Pending |
| SETT-04 | Phase 8 | Pending |
| SETT-05 | Phase 8 | Pending |

**Coverage:**

- v1.1 requirements: 30 total
- Mapped to phases: 30 (complete)
- Unmapped: 0

---
*Requirements defined: 2026-07-25*
*Last updated: 2026-07-25 — Phase 6 complete: all 7 HIST requirements verified and marked complete*

# Milestones

## v1.0 MVP

**Shipped:** 2026-07-25
**Phases:** 4 (12 plans)
**Status:** ✅ Complete

### Delivered

完整的多容器隔离浏览器，支持：
- 容器 CRUD（创建/编辑/删除）和自定义（名称、颜色、图标）
- 多 Tab 浏览，每个 Tab 属于不同容器
- URL 导航（协议补全/搜索回退/前进后退/刷新停止）
- 完全数据隔离（Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存）
- Cookie 文件持久化和自动加载
- 容器分配规则（精确匹配/通配符/子域名）
- 快捷键支持

### Key Accomplishments

1. Phase 1: 模块化架构重构 + 容器管理 UI
2. Phase 2: WebContentsView 多 Tab 架构 + URL 导航
3. Phase 3: 完整数据隔离 + Cookie 持久化
4. Phase 4: 分配规则 + 快捷键管理

### Verification

- Closeout type: override_closeout (known verification overrides)
- 20/20 v1 requirements complete
- 5 debug sessions deferred
- 1 UAT gap deferred (Phase 03)

### Archive

- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Tag: `v1.0`

## v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面

**Shipped:** 2026-07-26
**Phases:** 5 (11 plans, 10 complete)
**Status:** ✅ Complete

### Delivered

在 MVP 基础上增强了容器属性管理、浏览历史记录、收藏夹、常用网站推荐和应用设置：
- 容器扩展属性（手机号/邮箱/备注）+ 旧数据惰性填充兼容
- 基于 SQLite 的浏览历史记录系统（每容器隔离 + realm:// 协议 + FIFO 淘汰）
- 收藏夹管理（全局共享数据库 + 星标按钮 + CRUD + 搜索）
- frecency 常用网站推荐（频率 + 最近性加权排序 + 域名聚合）
- 应用设置页面（默认浏览器引导 + 历史记录保留天数）
- 收藏数据库从按容器隔离重构为全局共享

### Key Accomplishments

1. Phase 5: 容器数据模型扩展 phone/email/notes + 惰性填充兼容
2. Phase 6: SQLite 历史记录系统 + realm:// 自定义协议
3. Phase 7: 收藏夹全功能管理（星标按钮 + 编辑面板 + 列表页面）
4. Phase 8: frecency 常用网站推荐 + 应用设置页面
5. Phase 9: 收藏数据库从按容器隔离重构为全局共享

### Verification

- Closeout type: override_closeout
- 30/30 v1.1 requirements complete
- 6 debug sessions deferred (diagnosed)
- 1 plan gap deferred (09-04: checkBookmarkStatus realm:// guard)
- 1 UAT gap deferred (Phase 03)

### Archive

- Roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Tag: `v1.1`

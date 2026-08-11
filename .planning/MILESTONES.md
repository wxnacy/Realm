# Milestones

## v2.2 多媒体功能集成 (Shipped: 2026-08-11)

**Phases completed:** 4 phases, 11 plans, 24 tasks

**Key accomplishments:**

- 1. 添加 mediaAPI IPC 通道和 preload 暴露
- e4bc525
- 浮动媒体面板 UI：工具栏按钮 + 媒体列表 + 类型徽标颜色编码 + 播放/复制操作 + 实时更新
- MediaSniffer clearAll + webRequest switch/whitelist filtering + renderer UI hide with feature toggle
- 白名单过滤被脚本注入路径绕过。媒体嗅探有两条路径，白名单只挂在网络路径（main.js onResponseStarted）上；脚本注入路径完全失守。

---

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

## v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式

**Shipped:** 2026-07-27
**Phases:** 3 (6 plans)
**Status:** ✅ Complete

### Delivered

Cookie 管理面板增强，设置页面重构，开发者模式实现：

- Cookie 管理面板多来源查看（Session/File）+ 域名过滤 + 手动保存 + 单条编辑删除
- 设置页面左侧边栏导航（通用/分配规则/快捷键设置）+ 规则/快捷键页面化
- 开发者模式：CDP 抓取 API 请求 + SQLite 持久化 + realm://devrequests 查看页

### Key Accomplishments

1. Phase 10: Cookie 管理面板完全增强（来源切换/域名过滤/保存/编辑/删除）
2. Phase 11: 设置页面重构为侧边栏多页面布局，规则和快捷键从弹窗迁入
3. Phase 12: 开发者模式 CDP 引擎 + 写入队列 + SQLite + 请求查看页

### Verification

- Closeout type: override_closeout
- 14/14 v1.2 requirements complete
- 12 debug sessions deferred (diagnosed)
- 1 UAT gap deferred (Phase 06 — passed, 0 pending)

### Archive

- Roadmap: `.planning/milestones/v1.2-ROADMAP.md`
- Requirements: `.planning/milestones/v1.2-REQUIREMENTS.md`
- Phases: `.planning/milestones/v1.2-phases/`
- Tag: `v1.2`

## v1.3 右键菜单增强

**Shipped:** 2026-07-27
**Phases:** 1 (3 plans)
**Status:** ✅ Complete

### Delivered

标签页和网页右键菜单完整实现：

- 标签页右键菜单（关闭/关闭其他/左右侧/重新打开已关闭/固定）
- 网页通用右键菜单（导航/另存为/打印/查看源代码/检查元素/文本编辑）
- 图片右键菜单（新标签页打开/另存为/复制图片/复制图片地址）
- 链接右键菜单（新标签页/后台打开/容器中打开/复制链接地址）
- 已关闭标签页 LIFO 恢复 + 固定 Tab favicon 持久化

### Key Accomplishments

1. Phase 13: context-menu-manager.js 主进程菜单基础设施
2. Phase 13: 渲染进程集成 + preload API + 右键事件监听
3. Phase 13: UAT 验证 + 安全威胁缓解 + Tab DOM 统一入口

### Verification

- Closeout type: override_closeout
- 5/5 v1.3 requirements complete
- 12 debug sessions deferred (diagnosed)
- 1 UAT gap deferred (Phase 06 — passed, 0 pending)

### Archive

- Roadmap: `.planning/milestones/v1.3-ROADMAP.md`
- Requirements: `.planning/milestones/v1.3-REQUIREMENTS.md`
- Phases: `.planning/milestones/v1.3-phases/`
- Tag: `v1.3`

## v2.0 收藏夹文件夹支持 + AI Agent 集成

**Shipped:** 2026-08-01
**Phases:** 8 (16 plans)
**Status:** ✅ Complete

### Delivered

收藏夹文件夹系统 + AI Agent 基础集成：

- 收藏夹文件夹系统（数据库层 + UI 交互 + 拖拽排序 + 多选批量操作）
- Chrome 书签导入（JSON/HTML 解析 + 批量导入 + 进度预览）
- 收藏栏功能（固定显示 + 交互 + 右键菜单 + 设置）
- AI Agent 集成（pi-agent-core + AI Manager + 5 个 Realm 工具 + 聊天 UI）

### Key Accomplishments

1. Phase 14-16: 收藏夹文件夹系统完整实现
2. Phase 17: Chrome 书签导入（自动检测 + HTML 导入 + 进度预览）
3. Phase 18: 收藏栏功能
4. Phase 19-21: AI Agent 集成（AI Manager + 聊天 UI + 流式渲染）

### Verification

- Closeout type: verified_closeout
- 25/25 v2.0 requirements complete

### Archive

- Roadmap: `.planning/milestones/v2.0-ROADMAP.md`
- Requirements: `.planning/milestones/v2.0-REQUIREMENTS.md`
- Tag: `v2.0`

## v2.1 AI CDP 增强 + Tabbrowser 功能集成

**Shipped:** 2026-08-04
**Phases:** 4 (18 plans)
**Status:** ✅ Complete

### Delivered

AI Agent 深度浏览器控制能力：

- CDP 管理器扩展 + 基础网页操控工具（read_page_content/extract_links/open_link）
- 智能上下文引用（@ 标签页引用）+ FTS5 收藏全文检索
- 任务自主执行（fillForm/executeAction + AI 工具 + CAPTCHA 检测 + 确认 UI）
- 脚本生成 + 智能标签整理

### Key Accomplishments

1. Phase 22: CDP 管理器扩展 + 3 个网页操控 AI 工具（含 2 轮 gap 修复）
2. Phase 23: @ 引用标签页上下文 + FTS5 收藏全文检索（含 3 个 gap 修复复测）
3. Phase 24: 任务自主执行（fillForm/executeAction + CAPTCHA 检测 + 确认 UI）
4. Phase 25: 脚本生成 + 智能标签整理（含 apply_tab_groups 回传修复）

### Verification

- Closeout type: override_closeout (未运行里程碑审计)
- 20/20 v2.1 requirements complete
- 13 debug sessions deferred (from v2.0)
- Phase 23 代码审查遗留 19 项（6 Critical）

### Archive

- Roadmap: `.planning/milestones/v2.1-ROADMAP.md`
- Requirements: `.planning/milestones/v2.1-REQUIREMENTS.md`

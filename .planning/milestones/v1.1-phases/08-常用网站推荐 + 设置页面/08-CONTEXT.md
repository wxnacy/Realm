# Phase 8: 常用网站推荐 + 设置页面 - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

新标签页展示基于 frecency 排序的常用网站网格 + 应用设置配置。具体能力边界：
- 新标签页展示常用网站网格，按 frecency（频率 + 最近性加权）排序
- 常用网站按域名聚合，同一域名下多个页面合并为一个卡片
- 常用网站显示 favicon，使用 Google Favicon 服务获取
- 用户可以打开设置页面，配置应用选项
- 设置页面包含默认浏览器引导功能
- 设置页面包含历史记录保留天数配置
- 设置变更立即持久化，应用重启后设置保持不变

</domain>

<decisions>
## Implementation Decisions

### frecency 算法设计
- **D-01:** 使用加权公式法计算 frecency（frequency * recency_weight）
- **D-02:** 数据源：直接查询历史记录表，无需独立缓存表
- **D-03:** 域名聚合：单页面代表模式，点击后跳转到该域名下最常访问的页面
- **D-04:** 更新频率：实时计算，每次打开新标签页时重新计算

### 新标签页 UI 布局
- **D-05:** 使用 6×2 网格布局，12 个网站卡片
- **D-06:** 卡片显示：圆形 favicon + 网站标题
- **D-07:** 空状态：显示友好的引导提示和插图，提示用户开始浏览
- **D-08:** favicon 获取：通过 Google Favicon 服务（`https://www.google.com/s2/favicons?domain=xxx`）

### 设置页面功能
- **D-09:** 设置入口：工具栏齿轮图标，点击后在当前 Tab 打开 realm://settings 内部页面
- **D-10:** 默认浏览器引导：检测当前是否为默认浏览器，显示引导按钮，点击后调用系统 API 设置
- **D-11:** 历史记录保留天数：可配置，支持 7/14/30/60/90 天或永不删除选项
- **D-12:** 默认容器设置：默认使用"默认"容器，设置中可指定容器或使用最后打开的容器

### 容器过滤逻辑
- **D-13:** 常用网站不按容器隔离，合并所有容器的历史记录共同计算 frecency
- **D-14:** 新标签页在所有容器中显示相同的常用网站推荐

### Claude's Discretion
- SQLite 查询优化策略
- 设置页面的 CSS 样式细节
- realm://settings 协议的路由处理
- 历史记录保留天数配置的定时清理逻辑
- favicon 获取失败时的降级策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — FREQ-01 到 FREQ-05、SETT-01 到 SETT-05 需求定义
- `.planning/ROADMAP.md` — Phase 8 目标和成功标准

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/STACK.md` — 技术栈和依赖

### 关键文件（Phase 6/7 实现参考）
- `main.js` — 主进程，本地 HTTP 服务器、API 端点、历史记录管理器集成
- `src/renderer.js` — 渲染进程，UI 交互逻辑
- `src/index.html` — UI 结构定义
- `src/preload.js` — IPC 接口定义
- `src/styles/main.css` — 样式文件
- `src/history.html` — 历史记录页面（新标签页参考其结构）
- `src/history-page.js` — 历史记录页面逻辑（新标签页参考其模式）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **better-sqlite3 数据库连接**: 已在 history-manager.js 中初始化，常用网站计算可复用同一连接
- **本地 HTTP 服务器 (main.js)**: 已有 realm:// 协议和 API 端点模式，新增 /api/frequent-sites/* 和 realm://settings 路由即可
- **历史记录表 (history)**: 包含 URL、标题、访问时间、容器 ID 等字段，可直接查询计算 frecency
- **工具栏按钮模式**: 已有时钟图标（历史记录）、文件夹图标（收藏夹），新增齿轮图标（设置）

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`create-tab`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **Session 隔离**: 每个容器使用独立的 `persist:container-{id}` Session
- **内部页面模式**: realm://xxx → 本地 HTTP 服务器 → src/xxx.html
- **API 端点模式**: /api/xxx/* JSON 端点，token 认证

### Integration Points
- **main.js**: 添加 frequent-sites-manager.js 模块、/api/frequent-sites/* API 端点、realm://newtab 和 realm://settings 路由
- **src/preload.js**: 暴露设置相关 API（如 getSettings、updateSettings）
- **src/renderer.js**: 添加设置按钮事件、新标签页逻辑
- **src/index.html**: 添加工具栏设置按钮 HTML
- **需要新增**: `frequent-sites-manager.js`（常用网站计算模块）、`src/newtab.html`（新标签页）、`src/newtab-page.js`（新标签页逻辑）、`src/settings.html`（设置页面）、`src/settings-page.js`（设置页面逻辑）

</code_context>

<specifics>
## Specific Ideas

- 新标签页风格参考 Chrome 新标签页，但适配 Realm 的深色主题
- 设置页面参考 Chrome 设置页面的简洁布局
- 常用网站网格使用 CSS Grid 布局，响应式设计
- favicon 使用 Google Favicon 服务，失败时显示默认图标

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 8-常用网站推荐 + 设置页面*
*Context gathered: 2026-07-25*

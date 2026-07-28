# Phase 7: 收藏夹管理 - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以收藏和管理常用页面，收藏按容器隔离。具体能力边界：
- 收藏/取消收藏当前页面（工具栏星标按钮 + 首次弹出编辑面板）
- 收藏列表页面（realm://favorites），紧凑列表展示
- 编辑收藏标题（行内编辑）、删除收藏（复选框 + 批量删除）
- 搜索收藏（标题 + URL 匹配，实时过滤，高亮匹配文本）
- 同一 URL 在同一容器内不能重复收藏（URL 去重 + 提示）
- 收藏按容器完全隔离（不同容器的收藏互不可见）

</domain>

<decisions>
## Implementation Decisions

### 收藏按钮交互
- **D-01:** 使用星标图标：未收藏时空心星标，已收藏时实心星标（金色）
- **D-02:** 首次点击弹出编辑面板，面板内容：标题（可编辑）+ URL（只读）+ 保存/取消按钮
- **D-03:** 已收藏页面再点击星标直接取消收藏（一键切换，不弹确认）
- **D-04:** 收藏按钮放在 URL 栏右侧，与历史记录按钮相邻

### 收藏列表页面
- **D-05:** 工具栏添加独立的收藏夹按钮（文件夹图标），点击后在当前 Tab 打开 realm://favorites 内部页面
- **D-06:** 列表使用紧凑列表样式：favicon + 页面标题 + URL + 收藏时间
- **D-07:** 按收藏时间倒序排列（最新收藏在最前面）
- **D-08:** 空状态显示插图和提示文字："暂无收藏，点击星标收藏页面"

### 搜索与编辑
- **D-09:** 搜索同时匹配页面标题和 URL，输入关键词后实时过滤（debounce 300ms）
- **D-10:** 搜索结果中匹配的文本用高亮色标出
- **D-11:** 编辑收藏标题使用行内编辑模式（点击标题直接进入编辑，回车或点击其他地方保存）
- **D-12:** 删除收藏使用复选框 + 批量删除模式（与历史记录页面一致），支持全选快捷操作

### 数据存储
- **D-13:** 复用现有 better-sqlite3 数据库，新建 favorites 表（共享数据库连接）
- **D-14:** 同一 URL 在同一容器内不能重复收藏，重复收藏时提示"已收藏过该页面"
- **D-15:** 收藏时保存 favicon URL 到数据库，列表直接显示
- **D-16:** 收藏数量不设上限（收藏是用户主动操作，数量通常远少于历史记录）

### Claude's Discretion
- SQLite 数据库 favorites 表的表结构设计
- 具体的 SQL 查询优化策略
- 收藏页面的 CSS 样式细节
- favicon 获取和缓存的降级策略
- 收藏编辑面板的具体 UI 样式
- realm://favorites 协议的路由处理

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — FAV-01 到 FAV-08 需求定义
- `.planning/ROADMAP.md` — Phase 7 目标和成功标准

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/STACK.md` — 技术栈和依赖

### 关键文件（Phase 6 实现参考）
- `main.js` — 主进程，本地 HTTP 服务器、API 端点、历史记录管理器集成
- `src/renderer.js` — 渲染进程，UI 交互逻辑
- `src/index.html` — UI 结构定义
- `src/preload.js` — IPC 接口定义
- `src/styles/main.css` — 样式文件
- `src/history.html` — 历史记录页面（收藏页面参考其结构）
- `src/history-page.js` — 历史记录页面逻辑（收藏页面参考其模式）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **better-sqlite3 数据库连接**: 已在 history-manager.js 中初始化，收藏管理器可复用同一连接
- **本地 HTTP 服务器 (main.js)**: 已有 realm:// 协议和 API 端点模式，新增 /api/favorites/* 端点即可
- **历史记录页面 (src/history.html + history-page.js)**: 收藏页面可参考其 HTML 结构、CSS 样式和 JS 交互模式
- **工具栏按钮模式**: 已有时钟图标按钮（历史记录），新增文件夹图标按钮（收藏夹）

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`create-tab`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **Session 隔离**: 每个容器使用独立的 `persist:container-{id}` Session
- **内部页面模式**: realm://xxx → 本地 HTTP 服务器 → src/xxx.html
- **API 端点模式**: /api/xxx/* JSON 端点，token 认证

### Integration Points
- **main.js**: 添加 favorites-manager.js 模块、/api/favorites/* API 端点、realm://favorites 路由
- **src/preload.js**: 暴露收藏相关 API（如需要）
- **src/renderer.js**: 添加收藏按钮事件、收藏状态检测
- **src/index.html**: 添加工具栏收藏按钮 HTML
- **需要新增**: `favorites-manager.js`（收藏管理模块）、`src/favorites.html`（收藏页面）、`src/favorites-page.js`（收藏页面逻辑）

</code_context>

<specifics>
## Specific Ideas

- 收藏按钮使用星标图标，参考 Chrome/GitHub 的收藏按钮交互
- 收藏页面风格参考 Chrome 书签管理器，但适配 Realm 的深色主题
- 收藏编辑面板参考 Chrome 首次收藏时弹出的小面板
- 工具栏收藏按钮位置在 URL 输入框右侧，与容器按钮相邻

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 7-收藏夹管理*
*Context gathered: 2026-07-25*

# Phase 18: 收藏栏功能 - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段在地址栏下方实现固定收藏栏，显示收藏夹根目录内容，支持点击导航、文件夹展开、右键菜单和显示/隐藏设置，包括：
- 收藏栏固定显示在地址栏下方，显示根目录收藏项和文件夹
- 收藏项点击导航（单击当前标签页，Cmd/Ctrl+新标签页）
- 文件夹下拉菜单（点击展开，悬停自动展开子菜单）
- 溢出处理（>> 按钮弹出下拉菜单，Chrome 风格）
- 右键菜单（收藏项/文件夹/空白区域三种菜单）
- 显示/隐藏设置（设置页面开关 + 右键快捷隐藏）

**不包括**：AI Agent 集成（Phase 19-21）、收藏栏多行显示、收藏栏拖拽排序

</domain>

<decisions>
## Implementation Decisions

### 溢出处理策略
- **D-01:** 使用 >> 按钮弹出下拉菜单处理溢出（Chrome 风格），>> 按钮固定在收藏栏最右侧
- **D-02:** 溢出菜单采用单层菜单 + 级联子菜单模式，文件夹悬停向右展开子菜单
- **D-03:** 收藏栏空白区域右键菜单包含「隐藏收藏栏」选项

### 文件夹展开交互
- **D-04:** 点击文件夹弹出下拉菜单，嵌套文件夹子菜单从右侧弹出（Chrome 风格）
- **D-05:** 鼠标悬停在文件夹上约 300ms 后自动展开子菜单
- **D-06:** 下拉菜单宽度自适应内容，最大宽度限制 300px

### 视觉样式与间距
- **D-07:** 收藏栏位于地址栏下方、标签栏上方，与 Chrome 布局一致
- **D-08:** 收藏栏高度与地址栏等高（约 32px），保持视觉统一
- **D-09:** favicon 加载失败时使用 Realm 应用图标作为降级显示
- **D-10:** 收藏栏与地址栏之间有 1px 分隔线，与标签栏风格统一

### 右键菜单集成
- **D-11:** 复用 Phase 13/15 的 Electron Menu API 模式，保持代码一致性
- **D-12:** 收藏项右键菜单包含：在新标签页打开、编辑、删除（标准三项）
- **D-13:** 文件夹右键菜单包含：在新标签页中打开所有书签、重命名、删除、添加书签、添加文件夹（标准五项）
- **D-14:** 菜单项直接调用现有 API（如 favoritesManager.updateFavorite），不引入新的 IPC 通道

### Claude's Discretion
- 收藏栏的 CSS 样式细节（padding、margin、hover 效果）
- >> 按钮的图标样式和点击动画
- 下拉菜单的显示/隐藏动画
- 收藏项标题过长时的截断方式（省略号）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — BAR-01（收藏栏固定显示）、BAR-02（收藏栏项目交互）、BAR-03（收藏栏右键菜单）、BAR-04（收藏栏显示/隐藏设置）需求详情和验收标准
- `.planning/ROADMAP.md` — Phase 18 任务列表和里程碑背景

### 前序阶段上下文
- `.planning/phases/14-favorites-folders-db/14-CONTEXT.md` — Phase 14 决策（folder_id=0 根目录、sort_order 字段、级联删除、循环引用检测）
- `.planning/phases/15-ui/15-CONTEXT.md` — Phase 15 决策（左右分栏布局、右键菜单、Electron Menu API）
- `.planning/phases/16-favorites-enhancements/16-CONTEXT.md` — Phase 16 决策（fractional indexing 排序、混合排序、批量操作）
- `.planning/phases/17-chrome/17-CONTEXT.md` — Phase 17 决策（Chrome 书签导入、favicon 获取）

### 现有代码
- `favorites-manager.js` — 后端数据层，文件夹 CRUD API、收藏项创建/更新 API
- `src/favorites-page.js` — 收藏夹页面渲染逻辑，可复用收藏项渲染函数
- `main.js` — HTTP API 路由（`/api/favorites/*`）、窗口管理、IPC 处理
- `src/preload.js` — contextBridge API 暴露
- `src/index.html` — 主界面结构，需要添加收藏栏 HTML
- `src/styles/main.css` — 样式文件，需要添加收藏栏样式

### 技术参考
- `.planning/codebase/CONVENTIONS.md` — 编码规范（命名、代码风格、DOM 操作模式）
- `.planning/codebase/STRUCTURE.md` — 项目结构和文件位置
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `favoritesManager.getFavorites(folderId)`: 获取指定文件夹的收藏列表，可直接用于收藏栏数据加载
- `favoritesManager.getFolderTree()`: 获取文件夹树结构，可用于文件夹下拉菜单
- `renderFavoriteItem(record)`: 收藏项渲染函数，可复用渲染逻辑（需适配收藏栏样式）
- Phase 15 的右键菜单系统（Electron Menu API）：可直接复用构建收藏栏右键菜单
- Phase 16 的 fractional indexing 排序：收藏栏显示顺序与收藏夹页面一致

### Established Patterns
- DOM 元素引用集中在 `elements` 对象中管理
- 事件监听在 `setupEventListeners()` 函数中集中绑定
- 使用 `[Realm Renderer]` 前缀标识渲染进程日志
- 模态框使用 `<dialog>` 元素实现
- HTTP API 认证：所有 `/api/favorites/*` 请求需带 token 参数

### Integration Points
- `src/index.html` 的 `<body>`: 需要添加收藏栏 HTML 结构（位于地址栏下方）
- `src/renderer.js` 的 `setupEventListeners()`: 需要添加收藏栏事件监听
- `src/styles/main.css`: 需要添加收藏栏样式（高度、背景、分隔线、hover 效果）
- `main.js` 的窗口创建：需要确保收藏栏在窗口大小变化时正确响应

</code_context>

<specifics>
## Specific Ideas

用户参考 Chrome 收藏栏的交互行为：
- 溢出处理：Chrome 使用 >> 按钮弹出下拉菜单，收藏栏采用相同方式
- 文件夹展开：Chrome 使用悬停自动展开 + 右侧弹出子菜单，收藏栏采用相同方式
- 右键菜单：Chrome 收藏栏有三种右键菜单（收藏项/文件夹/空白区域），收藏栏采用相同模式
- favicon 降级：Chrome 使用默认地球图标，收藏栏使用 Realm 应用图标

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-收藏栏功能*
*Context gathered: 2026-07-30*

# Phase 17: Chrome 书签导入 - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段实现从 Chrome 浏览器导入书签到 Realm Browser 收藏夹系统的完整流程，包括：
- 自动检测并读取 Chrome 本地 JSON 书签文件（保留完整文件夹结构）
- 支持导入 Chrome 导出的 HTML 格式书签文件（Netscape Bookmark 格式）
- 导入过程中的进度展示（模态进度框）和冲突处理（重复 URL 跳过）
- 导入完成后显示结果摘要（导入数、跳过数、创建文件夹数）

**不包括**：收藏栏显示（Phase 18）、AI Agent 集成（Phase 19-21）、Chrome 书签实时同步

</domain>

<decisions>
## Implementation Decisions

### 导入入口
- **D-01:** 收藏夹页面顶部搜索栏旁添加「导入」按钮（图标+文字），醒目但不占空间
- **D-02:** 按钮位置在搜索栏右侧，与收藏管理场景贴合

### Chrome JSON 书签检测
- **D-03:** 自动检测 + 手动可选策略：优先自动读取 Chrome 默认路径，找不到时提示用户手动选择文件
- **D-04:** 覆盖多 Profile 或自定义路径场景，自动检测失败后提供文件选择对话框

### Chrome 根文件夹处理
- **D-05:** 全部导入为子文件夹策略：在 Realm 根目录创建「Chrome 书签栏」「Chrome 其他」「Chrome 已同步」三个文件夹，保留原始结构
- **D-06:** 三个根文件夹名称使用中文翻译，与 Realm 整体中文 UI 一致

### 重复 URL 处理
- **D-07:** 跳过重复策略：已有相同 URL 的收藏项不导入，显示跳过数量，保护现有数据
- **D-08:** 基于 URL 精确匹配判断重复（不区分协议、www 前缀、尾部斜杠）

### 导入位置
- **D-09:** 保留原始结构策略：按 Chrome 书签的原始文件夹层级导入，不在 Realm 中重新组织
- **D-10:** 导入到 Realm 根目录下，以 Chrome 的三个根文件夹为顶层

### HTML 书签导入流程
- **D-11:** 选择文件 + 摘要预览确认流程：用户选择 HTML 文件后，先展示解析结果摘要（书签总数、文件夹数量、顶级文件夹列表），确认后执行导入
- **D-12:** 摘要预览展示：书签总数、文件夹数量、顶级文件夹列表，让用户快速确认内容

### 进度展示
- **D-13:** 模态进度框：弹出模态框显示进度条、已导入/总数、当前处理的文件名
- **D-14:** 进度框在导入过程中阻塞交互，防止重复触发导入

### Favicon 获取
- **D-15:** 导入时异步获取 favicon 并存入数据库，显示更完整的书签图标
- **D-16:** 使用 Google favicon API 或 Chrome 的 favicon 缓存路径获取图标

### 导入结果展示
- **D-17:** 完成摘要：显示导入书签数、跳过数（重复）、创建文件夹数，完成后用户可关闭或查看导入的书签

### Claude's Discretion
- Chrome 书签 JSON 解析的容错处理（节点格式异常时跳过并记录）
- HTML 解析库选择（cheerio 已在 REQUIREMENTS.md 中列为依赖）
- 导入过程中的错误处理策略（单条失败不影响整体导入）
- favicon 获取失败时的降级处理（显示默认图标）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — IMPORT-01（自动读取 Chrome 本地书签）、IMPORT-02（HTML 书签文件导入）、IMPORT-03（导入进度和冲突处理）需求详情和验收标准
- `.planning/ROADMAP.md` — Phase 17 任务列表和里程碑背景

### 前序阶段上下文
- `.planning/phases/14-favorites-folders-db/14-CONTEXT.md` — Phase 14 决策（folder_id=0 根目录、sort_order 字段、级联删除、循环引用检测）
- `.planning/phases/15-ui/15-CONTEXT.md` — Phase 15 决策（左右分栏布局、右键菜单、Electron Menu API）
- `.planning/phases/16-favorites-enhancements/16-CONTEXT.md` — Phase 16 决策（fractional indexing 排序、混合排序、批量操作）

### 现有代码
- `favorites-manager.js` — 后端数据层，文件夹 CRUD API、收藏项创建/更新 API
- `src/favorites-page.js` — 收藏夹页面渲染逻辑，需要添加导入按钮和进度 UI
- `main.js` — HTTP API 路由（`/api/favorites/*`），需要添加导入相关 API
- `src/preload.js` — contextBridge API 暴露，需要添加文件系统访问 API
- `src/styles/main.css` — 收藏夹页面样式，需要添加导入相关样式

### 技术参考
- `.planning/codebase/CONVENTIONS.md` — 编码规范（命名、代码风格、DOM 操作模式）
- `.planning/codebase/STRUCTURE.md` — 项目结构和文件位置
- `.planning/codebase/STACK.md` — 技术栈详情（Electron 32.x、Node.js 文件系统 API）
- [Chrome Bookmarks JSON 格式](https://developer.chrome.com/docs/extensions/reference/bookmarks/) — Chrome 书签 API 文档
- [Netscape Bookmark File Format](https://forums.mozillazine.org/index.php?threads/import-export-bookmarks-format.23/) — HTML 书签格式规范

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `favoritesManager.createFavorite()`: 创建收藏项 API，可直接用于导入书签
- `favoritesManager.createFolder()`: 创建文件夹 API，可直接用于导入文件夹结构
- `favoritesApi(route, options, query)`: 通用 HTTP API 调用函数，可扩展支持导入相关 API
- `renderFavoriteItem(record)`: 收藏项渲染函数，导入后可复用渲染逻辑
- Phase 15 的右键菜单系统：可添加「导入书签」菜单项作为备用入口

### Established Patterns
- HTTP API 认证：所有 `/api/favorites/*` 请求需带 token 参数
- DOM 元素引用集中在 `elements` 对象中管理
- 事件监听在 `setupEventListeners()` 函数中集中绑定
- 使用 `[Realm Renderer]` 前缀标识渲染进程日志
- 模态框使用 `<dialog>` 元素实现（Phase 15 已有模式）

### Integration Points
- `favorites-page.js` 的 `renderFavorites()`: 需要添加导入按钮和进度 UI
- `favorites-page.js` 的 `setupEventListeners()`: 需要添加导入按钮事件监听
- `main.js` 的 HTTP API：需要添加导入相关路由（`/api/favorites/import-chrome`, `/api/favorites/import-html`）
- `src/preload.js` 的 `realmAPI`: 需要添加文件系统访问方法（dialog.showOpenDialog）
- `favorites-manager.js`: 需要添加批量创建收藏项和文件夹的 API

</code_context>

<specifics>
## Specific Ideas

用户参考 Chrome 书签管理器的导入行为：
- 自动检测 Chrome 默认路径（类似 Chrome 的书签同步行为）
- 保留原始文件夹结构（类似 Chrome 的书签管理器）
- 导入进度展示（类似 Chrome 的下载进度条）
- favicon 获取（类似 Chrome 的书签图标显示）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-Chrome 书签导入*
*Context gathered: 2026-07-30*

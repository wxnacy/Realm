# Phase 15: 收藏夹文件夹 - UI 交互 - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段在 `realm://favorites` 收藏夹页面实现文件夹的 UI 交互功能，包括：
- 文件夹树导航组件（左侧面板）
- 面包屑导航组件（右侧内容区顶部）
- 右键菜单（收藏项/文件夹/空白区域三种菜单）
- 新建文件夹 UI（左侧面板 + 按钮）

**不包括**：拖拽排序（Phase 16）、Chrome 书签导入（Phase 17）、收藏栏（Phase 18）

</domain>

<decisions>
## Implementation Decisions

### 页面布局结构
- **D-01:** 左侧固定宽度文件夹树面板（200-240px），右侧收藏列表区域
- **D-02:** 搜索栏在顶部全宽，横跨左右两栏
- **D-03:** 面包屑导航在右侧内容区顶部（同 Chrome 书签管理器布局）
- **D-04:** 参考 Chrome 书签管理器的整体布局风格

### 文件夹树交互
- **D-05:** 文件夹树有根节点，显示为"所有书签"或"收藏夹"
- **D-06:** 点击文件夹 = 展开/收起 + 导航（一步完成，类似 Finder 侧边栏）
- **D-07:** 每个文件夹名右侧显示收藏项数量徽标（如"开发 (12)"）
- **D-08:** 新建文件夹入口：左侧面板标题栏 + 按钮 + 右键菜单

### 右键菜单
- **D-09:** 使用 Electron 原生 Menu API（与现有网页右键菜单一致）
- **D-10:** 完整实现 FOLDER-08 所有菜单项：
  - 收藏项菜单：打开、新标签页打开、新窗口打开、编辑、剪切/复制/粘贴、删除、属性
  - 文件夹菜单：打开（展开所有书签）、新窗口打开、重命名、删除、添加书签、添加文件夹
  - 空白区域菜单：新建文件夹、粘贴
- **D-11:** 剪切/复制/粘贴使用应用内部状态剪贴板（不走系统剪贴板）
  - `state.clipboard = { ids: [], mode: 'cut'|'copy', sourceFolderId }`
  - 剪切后源项显示半透明灰色视觉提示
  - 粘贴调用现有 `moveFavorites` API（剪切）或创建新记录（复制）

### Claude's Discretion
- 文件夹树展开/收起可以有 CSS 过渡动画（非阻塞）
- 空文件夹正常显示，无数量徽标
- 右键菜单项的快捷键绑定（如 Cmd+C/V/X）可选实现

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — FOLDER-05（文件夹树状导航）、FOLDER-06（面包屑导航）、FOLDER-08（右键菜单）需求详情和验收标准
- `.planning/ROADMAP.md` — Phase 15 任务列表和里程碑背景

### 现有代码
- `src/favorites-page.js` — 收藏夹页面渲染逻辑，需要重构为左右分栏布局
- `src/favorites.html` — 收藏夹页面 HTML 结构
- `src/styles/main.css` — 收藏夹页面样式（lines 1786-1973）
- `favorites-manager.js` — 后端数据层，文件夹 CRUD API 已就绪
- `main.js` — HTTP API 路由（`/api/favorites/*`），需要添加右键菜单 IPC
- `context-menu-manager.js` — 现有右键菜单实现（Electron 原生 Menu API）
- `src/preload.js` — contextBridge API 暴露

### 技术参考
- `.planning/phases/14-favorites-folders-db/14-CONTEXT.md` — Phase 14 决策（folder_id=0 根目录、级联删除、sort_order 字段）
- `.planning/codebase/ARCHITECTURE.md` — 系统架构、IPC 通信模式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `favoritesApi(route, options, query)`: 通用 HTTP API 调用函数，可直接调用文件夹 API
- `favorites-manager.js` 的 `getFolderTree()`: 返回完整文件夹树结构，可直接用于渲染文件夹树
- `context-menu-manager.js` 的 `buildTabMenu`/`buildWebMenu`: 右键菜单模式，可参考添加收藏夹菜单
- `renderFavoriteItem(record)`: 收藏项渲染函数，需要扩展支持文件夹内导航

### Established Patterns
- 左侧面板模式：容器面板（`.container-panel` + `.panel-header` + `.panel-list`）可参考
- 右键菜单 IPC：`show-tab-context-menu` → `context-menu:xxx` 回传模式
- HTTP API 认证：所有 `/api/favorites/*` 请求需带 token 参数
- webview guest 通信：不能用 IPC，只能走 HTTP API

### Integration Points
- `favorites-page.js` 的 `loadFavorites()`: 需要扩展为按文件夹加载
- `favorites-page.js` 的 `renderFavorites()`: 需要支持文件夹项的渲染
- `favorites.html` 的 DOM 结构：需要添加左侧文件夹树面板
- `main.js` 的 HTTP API：已有文件夹 CRUD 和列表路由，无需新增

</code_context>

<specifics>
## Specific Ideas

用户参考 Chrome 书签管理器的布局和交互方式。面包屑位置、文件夹树行为、搜索栏位置都以 Chrome 为参考标准。

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-收藏夹文件夹 - UI 交互*
*Context gathered: 2026-07-28*

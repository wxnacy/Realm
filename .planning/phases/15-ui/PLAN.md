---
phase: 15-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/favorites.html
  - src/styles/main.css
  - src/favorites-page.js
  - favorites-manager.js
  - main.js
autonomous: true
requirements:
  - FOLDER-05
  - FOLDER-06
  - FOLDER-08

must_haves:
  truths:
    - "文件夹树面板在左侧 200-240px 固定宽度，收藏列表在右侧 flex:1"
    - "点击文件夹 = 展开/收起 + 导航（一步完成）"
    - "面包屑显示当前路径，点击任意节点可跳转"
    - "右键菜单（收藏项/文件夹/空白区域）显示对应菜单项"
    - "新建文件夹通过内联输入框完成，Enter 确认，Escape 取消"
  artifacts:
    - "src/favorites.html — 左右分栏布局"
    - "src/styles/main.css — 文件夹树面板和右键菜单样式"
    - "src/favorites-page.js — 文件夹树渲染、面包屑、右键菜单逻辑"
    - "favorites-manager.js — listRecords 支持 folder_id 过滤"
    - "main.js — list 路由支持 folder_id 查询参数"
  key_links:
    - "favorites-page.js → favoritesApi('folder-tree') 获取文件夹树"
    - "favorites-page.js → favoritesApi('list', {}, { folder_id }) 按文件夹加载"
    - "favorites-page.js → favoritesApi('create-folder') 创建文件夹"
---

<objective>
实现收藏夹页面的文件夹 UI 交互功能：左右分栏布局、文件夹树导航、面包屑导航、右键菜单和新建文件夹 UI。

Purpose: 将 Phase 14 实现的文件夹后端 API 集成到前端 UI，提供完整的文件夹管理体验。

Output: 重构后的收藏夹页面，支持文件夹树导航、面包屑、右键菜单和新建文件夹。
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/15-ui/15-CONTEXT.md
@.planning/phases/15-ui/15-UI-SPEC.md
@src/favorites.html
@src/favorites-page.js
@src/styles/main.css
@favorites-manager.js
@main.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: 后端支持 folder_id 过滤 + HTML 左右分栏布局 + CSS 样式</name>
  <files>favorites-manager.js, main.js, src/favorites.html, src/styles/main.css</files>
  <action>
## 1.1 更新 favorites-manager.js 的 listRecords 函数

当前 listRecords 不支持 folder_id 过滤。修改函数签名，添加 folderId 参数：

- 函数签名改为 `function listRecords({ offset = 0, limit = 50, folderId = undefined })`
- 当 folderId !== undefined 时，SQL 添加 `WHERE folder_id = ?` 条件，按 sort_order ASC, created_at DESC 排序
- 当 folderId 为 undefined 时，保持原有行为（返回所有记录，向后兼容）

## 1.2 更新 main.js 的 list 路由

在 main.js 的 /api/favorites/list 路由中：
- 从 query 参数读取 folder_id：`const folderId = query.folder_id !== undefined ? parseInt(query.folder_id) : undefined`
- 传递给 listRecords：`favoritesManager.listRecords({ offset, limit, folderId })`

## 1.3 重构 src/favorites.html 为左右分栏布局

将当前单栏结构改为左右分栏：

```
.favorites-page
  .favorites-search-wrapper (保留现有搜索栏)
  .favorites-main (新增，flex 容器)
    .favorites-folder-panel (左侧 200-240px)
      .favorites-folder-header
        span "文件夹"
        button#addFolderBtn "+"
      #folderTree (文件夹树容器)
    .favorites-content-area (右侧 flex:1)
      #breadcrumb (面包屑)
      #actionsBar (保留现有批量操作)
      #favoritesContent (保留现有收藏列表)
```

保留现有的 dialog 和 toast 元素不变。

## 1.4 添加文件夹树面板和面包屑 CSS 样式

在 src/styles/main.css 现有收藏夹样式区域（约 1786-1973 行）之后添加：

**文件夹树面板样式：**
- .favorites-main: display flex, flex 1, overflow hidden
- .favorites-folder-panel: width 220px, min 200px, max 240px, bg #2a2a2a, border-right #3a3a3a
- .favorites-folder-header: flex, space-between, padding 12px 16px, border-bottom
- .favorites-folder-add-btn: 无背景无边框, hover 时显示 #3a3a3a 背景
- .favorites-folder-tree: flex 1, overflow-y auto, padding 8px 0
- .folder-tree-item: flex, height 32px, padding 0 16px, cursor pointer, color #d1d5db
- .folder-tree-item:hover: bg #3a3a3a
- .folder-tree-item.active: bg #3B82F6, color #fff
- .folder-tree-item .folder-expand-icon: width 12px, transition transform 0.15s
- .folder-tree-item .folder-expand-icon.expanded: transform rotate(90deg)
- .folder-tree-item .folder-icon: width 16px, margin-right 8px
- .folder-tree-item .folder-name: flex 1, overflow hidden, text-overflow ellipsis
- .folder-tree-item .folder-count: font-size 12px, color #9ca3af
- .folder-tree-item.active .folder-count: color #bfdbfe

**面包屑样式：**
- .favorites-breadcrumb: flex, padding 8px 16px, font-size 14px, color #9ca3af, border-bottom #2a2a2a
- .breadcrumb-item: cursor pointer, color #3B82F6, hover 时 text-decoration underline
- .breadcrumb-separator: margin 0 8px, color #6b7280
- .breadcrumb-current: color #e5e5e5

**内容区样式：**
- .favorites-content-area: flex 1, flex-direction column, overflow hidden

**右键菜单样式：**
- .context-menu: position fixed, bg #2a2a2a, border 1px solid #3a3a3a, border-radius 6px, padding 4px 0, min-width 180px, z-index 9999, box-shadow
- .context-menu-item: padding 8px 16px, cursor pointer, font-size 14px, color #d1d5db
- .context-menu-item:hover: bg #3B82F6, color #fff
- .context-menu-item.disabled: color #6b7280, cursor default
- .context-menu-separator: height 1px, bg #3a3a3a, margin 4px 0

**文件夹名输入框样式：**
- .folder-name-input: width 100%, bg #1a1a1a, border 1px solid #3B82F6, border-radius 4px, color #e5e5e5, padding 2px 8px, font-size 14px
  </action>
  <verify>
    <automated>grep -c "folderId" /Users/wxnacy/Projects/Realm/favorites-manager.js && grep -c "favorites-folder-panel" /Users/wxnacy/Projects/Realm/src/favorites.html && grep -c "favorites-main" /Users/wxnacy/Projects/Realm/src/styles/main.css</automated>
  </verify>
  <done>listRecords 支持 folder_id 过滤，HTML 重构为左右分栏布局，所有 CSS 样式已添加</done>
</task>

<task type="auto">
  <name>Task 2: 文件夹树渲染、导航逻辑和面包屑</name>
  <files>src/favorites-page.js</files>
  <action>
## 2.1 扩展 state 对象

在现有 state 对象中添加：
- currentFolderId: 0 (当前文件夹 ID，0 = 根目录)
- folderTree: [] (文件夹树数据)
- expandedFolders: new Set() (当前展开的文件夹 ID 集合)
- clipboard: null (内部剪贴板，格式 { ids: [], mode: 'cut'|'copy', sourceFolderId })

在 elements 对象中添加：
- folderTree: document.getElementById('folderTree')
- breadcrumb: document.getElementById('breadcrumb')
- addFolderBtn: document.getElementById('addFolderBtn')

## 2.2 添加文件夹相关 API 函数

添加以下函数：

**fetchFolderTree()**: 调用 favoritesApi('folder-tree')，返回文件夹树数组，错误时返回空数组

**createFolderApi(name, parentId)**: POST favoritesApi('create-folder', { name, parentId })

**renameFolderApi(id, name)**: POST favoritesApi('rename-folder', { id, name })

**deleteFolderApi(id)**: POST favoritesApi('delete-folder', { id })

所有 POST 请求使用 JSON body，Content-Type application/json。

## 2.3 实现文件夹树渲染

**renderFolderTree(tree, level = 0)**:
- level 为 0 时清空 container.innerHTML
- 遍历 tree 数组，为每个文件夹创建 .folder-tree-item 元素
- 每个 item 包含：展开箭头（有子文件夹时显示 SVG chevron）、文件夹图标 SVG、名称 span、数量徽标 span
- paddingLeft = 16 + level * 16 实现缩进
- 当前文件夹（id === state.currentFolderId）添加 active 类
- 展开箭头在 expanded 状态时 rotate(90deg)
- 点击事件：切换 expandedFolders 状态 + 调用 navigateToFolder(folder.id)
- 右键事件：调用 showFolderContextMenu(e, folder)
- 递归渲染子文件夹（当 expanded 且有 children 时）

**refreshFolderTree()**: 异步获取 tree 数据，调用 renderFolderTree 渲染

## 2.4 实现文件夹导航

**navigateToFolder(folderId)**:
- 更新 state.currentFolderId
- 重置 offset/hasMore/records/selectedIds
- 调用 updateActionsBar()
- 调用 renderFolderTree(state.folderTree) 更新高亮
- 调用 renderBreadcrumb() 更新面包屑
- 调用 loadFavorites() 加载该文件夹的收藏

**getFolderPath(folderId, tree, path)**: 递归查找文件夹路径，返回 [{id, name}, ...] 数组

**renderBreadcrumb()**:
- 清空 breadcrumb 容器
- 添加根节点"所有书签"（当前文件夹时为 breadcrumb-current，否则为 breadcrumb-item 可点击）
- 如果不在根目录，查找路径并依次添加分隔符 ">" 和路径节点
- 最后一个节点为 breadcrumb-current（不可点击），其他为 breadcrumb-item（可点击跳转）

## 2.5 更新 loadFavorites 支持 folder_id

修改现有 loadFavorites 函数：
- 非搜索模式时，传入 folder_id 参数：`favoritesApi('list', {}, { offset: 0, limit: state.limit, folder_id: state.currentFolderId })`
- 搜索模式保持不变（搜索全局）

## 2.6 更新 init 函数

在 init() 中：
- 调用 setupEventListeners() 之后
- 调用 await refreshFolderTree() 加载文件夹树
- 调用 renderBreadcrumb() 初始化面包屑
- 绑定 addFolderBtn 的 click 事件到 startNewFolder(0)

## 2.7 更新 loadMore 支持 folder_id

修改现有 loadMore 函数：
- 非搜索模式时，传入 folder_id 参数
  </action>
  <verify>
    <automated>grep -c "navigateToFolder\|renderFolderTree\|renderBreadcrumb\|currentFolderId\|fetchFolderTree" /Users/wxnacy/Projects/Realm/src/favorites-page.js</automated>
  </verify>
  <done>文件夹树渲染、导航逻辑、面包屑导航已实现，loadFavorites 和 loadMore 支持 folder_id 过滤</done>
</task>

<task type="auto">
  <name>Task 3: 右键菜单和新建文件夹 UI</name>
  <files>src/favorites-page.js</files>
  <action>
**D-09 覆盖说明：** D-09 决策要求使用 Electron 原生 Menu API，但 favorites-page.js 运行在 webview guest 中，无法访问 `window.realmAPI` 或 `ipcRenderer`（preload.js 仅暴露给主渲染进程）。实现 IPC 桥接（通过 `window.parent.postMessage` → 渲染进程 → 主进程 → native Menu → 回调链路）复杂度过高且收益有限。因此覆盖为 HTML 自定义右键菜单方案，在 webview guest 中完全实现，通过 HTTP API 执行数据操作。视觉和交互体验与原生菜单一致。

## 3.1 创建右键菜单基础设施

**state 添加**:
- contextMenuEl: null (当前显示的菜单元素)

**创建通用右键菜单函数 showContextMenu(items, x, y)**:
- 如果已有菜单，先移除
- 创建 .context-menu 元素，position fixed，left = x，top = y
- 遍历 items 数组，每个 item 可以是：
  - { label, onClick, disabled } — 菜单项
  - { type: 'separator' } — 分隔线
- 菜单项添加 click 事件：执行 onClick，然后隐藏菜单
- 添加到 document.body
- 监听 document 的 click 和 contextmenu 事件，点击其他地方时隐藏菜单
- 确保菜单不超出视口边界（如果 right > viewport width，left 向左偏移；bottom 同理）

**hideContextMenu()**: 移除菜单元素，state.contextMenuEl = null

## 3.2 实现收藏项右键菜单

**showFavoriteContextMenu(e, record)**:
- e.preventDefault()
- 调用 showContextMenu，菜单项：
  1. "打开" — window.open(record.url, '_blank')
  2. "在新标签页中打开" — window.open(record.url, '_blank')
  3. "在新窗口中打开" — window.open(record.url, '_blank', 'noopener')
  4. separator
  5. "编辑" — 触发标题行内编辑（找到对应 DOM 元素调用 startInlineEdit）
  6. "剪切" — state.clipboard = { ids: [record.id], mode: 'cut', sourceFolderId: state.currentFolderId }，添加半透明样式
  7. "复制" — state.clipboard = { ids: [record.id], mode: 'copy', sourceFolderId: state.currentFolderId }
  8. separator
  9. "删除" — 确认后调用 favoritesApi('delete', { id: record.id })，刷新列表
  10. separator
  11. "属性" — 显示收藏项信息（URL、创建时间等）

在 renderFavoriteItem 中绑定 contextmenu 事件到 itemEl。

## 3.3 实现文件夹右键菜单

**showFolderContextMenu(e, folder)**:
- e.preventDefault()
- 调用 showContextMenu，菜单项：
  1. "打开" — navigateToFolder(folder.id)
  2. "在新窗口中打开" — 获取该文件夹下所有收藏 URL，逐个 window.open
  3. separator
  4. "重命名" — startRenameFolder(folder.id, folder.name)
  5. "添加书签" — 在该文件夹下创建新收藏（弹出编辑对话框或直接添加当前页）
  6. "添加文件夹" — startNewFolder(folder.id)
  7. separator
  8. "删除" — 确认对话框显示"删除文件夹：确定删除文件夹 "{folderName}" 及其所有内容吗？此操作不可撤销。"，确认后调用 deleteFolderApi(folder.id)，刷新文件夹树和列表

在 renderFolderTree 中已绑定 contextmenu 事件。

## 3.4 实现空白区域右键菜单

**showEmptyContextMenu(e)**:
- e.preventDefault()
- 仅在点击空白区域时触发（不是点击收藏项或文件夹）
- 调用 showContextMenu，菜单项：
  1. "新建文件夹" — startNewFolder(state.currentFolderId)
  2. "粘贴" — 如果 state.clipboard 不为 null，执行粘贴逻辑
  3. separator
  4. "按名称排序" — 对当前文件夹内的收藏按 title 排序

在 favoritesContent 元素上绑定 contextmenu 事件，但需要判断点击目标是否为收藏项（如果不是收藏项，才显示空白区域菜单）。

## 3.5 实现粘贴逻辑

**pasteFromClipboard()**:
- 如果 state.clipboard 为 null，返回
- 如果 mode === 'cut'：调用 favoritesApi('move-favorites', { ids: state.clipboard.ids, folderId: state.currentFolderId })
- 如果 mode === 'copy'：对每个 id 调用 favoritesApi('duplicate', { id, folderId: state.currentFolderId })（如果没有 duplicate API，则跳过复制模式）
- 清空 state.clipboard
- 刷新列表和文件夹树
- 显示 toast "已粘贴 {count} 项"

## 3.6 实现新建文件夹 UI

**startNewFolder(parentId = 0)**:
- 在文件夹树中创建内联输入行
- 包含文件夹图标和 input[type=text]
- parentId === 0 时插入到 container 最前面，否则插入到父文件夹后面
- input 默认焦点，placeholder "新建文件夹"
- Enter 确认：调用 createFolderApi(name, parentId)，成功后刷新文件夹树并导航到新文件夹
- Escape 取消：移除输入行
- blur 时也触发确认

## 3.7 实现内联重命名

**startRenameFolder(folderId, currentName)**:
- 找到文件夹树中对应元素的 .folder-name
- 替换为 input[type=text]，值为 currentName
- input 选中所有文本
- Enter 确认：调用 renameFolderApi(folderId, newName)，成功后刷新文件夹树
- Escape 取消：恢复原名
- blur 时也触发确认

## 3.8 剪切视觉提示

在渲染收藏列表时，如果 state.clipboard 不为 null 且 mode === 'cut'，为 clipboard.ids 中的收藏项添加半透明样式（opacity: 0.4）。

在 renderFavoriteItem 中检查：如果 state.clipboard && state.clipboard.mode === 'cut' && state.clipboard.ids.includes(record.id)，则 itemEl.style.opacity = '0.4'。
  </action>
  <verify>
    <automated>grep -c "showContextMenu\|showFavoriteContextMenu\|showFolderContextMenu\|showEmptyContextMenu\|startNewFolder\|startRenameFolder\|pasteFromClipboard" /Users/wxnacy/Projects/Realm/src/favorites-page.js</automated>
  </verify>
  <done>HTML 自定义右键菜单（收藏项/文件夹/空白区域）已实现，新建文件夹 UI 和内联重命名已实现，粘贴逻辑已实现</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| webview guest → HTTP API | favorites-page.js 通过 HTTP API 访问数据，需要 token 认证 |
| HTTP API → favorites-manager.js | 主进程处理 API 请求，操作数据库 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-15-01 | Tampering | HTTP API | medium | mitigate | 所有 API 请求需要 token 认证，验证 folder_id 参数合法性 |
| T-15-02 | Information Disclosure | 右键菜单 | low | accept | 右键菜单显示文件夹名称，这是预期行为 |
| T-15-03 | Denial of Service | 文件夹树 | low | accept | 文件夹树加载是按需的，不会造成资源耗尽 |
</threat_model>

<verification>
1. 文件夹树面板在左侧 200-240px 固定宽度，收藏列表在右侧 flex:1
2. 点击文件夹 = 展开/收起 + 导航（一步完成）
3. 面包屑显示当前路径，点击任意节点可跳转
4. 右键点击收藏项/文件夹/空白区域显示对应菜单
5. 新建文件夹通过内联输入框完成，Enter 确认，Escape 取消
6. 所有 API 请求需要 token 认证
7. 文件夹树显示每个文件夹的收藏数量徽标
</verification>

<success_criteria>
1. 用户可以在左侧文件夹树中点击文件夹进行导航
2. 面包屑显示当前路径，支持点击跳转
3. 右键点击收藏项/文件夹/空白区域显示对应菜单
4. 可以通过 "+" 按钮或右键菜单新建文件夹
5. 可以通过右键菜单重命名和删除文件夹
6. 文件夹树显示每个文件夹的收藏数量
7. 剪切/复制/粘贴功能正常工作
</success_criteria>

<output>
创建 `.planning/phases/15-ui/15-01-SUMMARY.md` 完成后
</output>

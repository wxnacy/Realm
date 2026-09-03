# AI 整理收藏夹功能实现计划

## 需求（已与用户确认）

- AI 可按 **地址（domain）/ 功能类别（category）/ 单文件夹（flat）** 整理收藏夹
- 执行模式：**方案卡片确认**（参照 apply_tab_groups：AI 提交方案 → 卡片展示可编辑 → 用户点「应用整理」才实际写库）
- **全量能力扩展**：manage_favorites 支持文件夹 CRUD、批量删除、改标题、移动；新增 organize_favorites 整理工具

## 核心结论（已验证）

- favorites-manager.js 数据层 API 完备，无需改表结构；归类首选 `moveFavoriteInto`（:906，事务内 folder_id + 末尾 fractional 键原子写入，勿用 moveFavorite/moveFavorites——sort_order 不动落位不可预期）
- 建文件夹先 `findFolderByName`（:796）去重再 `createFolder`（:690）
- `deleteFolder`（:735）**级联删除**子树全部收藏 → 必须接 `requestActionConfirmation`（ai-manager.js:284，仿 fill_form :2826 用法）
- **广播陷阱**：`bookmarks-bar:refresh` 广播在 IPC 层（main.js:2620-2671），AI 工具直调 favoritesManager 会绕过刷新 → 各 mutation 的 execute 成功后须显式 `windowManager.broadcast('bookmarks-bar:refresh')`
- apply_tab_groups 链路（可复制）：工具返回值含信封 JSON → renderer `handleAIStream` case `tool_execution_update`（renderer.js:7988 附近）→ `renderToolCards`（:8307）特例分支（:8342）按 resultData 字段解包 → `renderTabGroupCard`（:10027）渲染模板卡片 → `collectTabGroupsFromDOM`（:10360）收集 → `realmAPI.tabReorder`（preload.js:1241）→ main.js `tab:reorder`（:2905）
- 应用结果**不回传 AI 会话**（现有架构限制，tab groups 同样如此）——v1 以 toast + 卡片终态呈现，organize 返回结构预留 failures 明细

## 新增数据结构（工具 → 卡片 → IPC 全程统一）

```js
plan: [{
  folderName: '开发工具',   // 卡片上可编辑（contenteditable）
  parentId: 0,             // 0=根目录
  bookmarks: [{ id, title, url }],  // 卡片渲染用；IPC 提交时为 bookmarkIds
}]
```

## 实施步骤

### 步骤 1：数据层 `applyOrganizePlan` + 测试
文件：`favorites-manager.js`（插在 moveFavoriteInto :922 后）、新建 `tests/test-favorites-organize.js`

- 函数签名：`applyOrganizePlan(plan) → {folderCount, movedCount, createdFolders, failures:[{id, reason}]}`
- 逻辑：逐组 `findFolderByName(folderName, parentId) ?? createFolder` → 事务内逐条 `moveFavoriteInto`；单条失败（id 不存在）记 failures 继续不中断；天然幂等（重复应用复用同名文件夹）
- 测试套 `tests/test-favorites-folders.js` 模式（:memory: sqlite + `setDatabase(db)` 注入，纯 node 跑）：正常路径/幂等去重/失败隔离/嵌套 parentId/空 plan 边界

### 步骤 2：批量 IPC `favorites:apply-organize`
文件：`main.js`（插在 favorites:move-favorites :2650 附近）

- `assertTrustedSender` → 格式校验（仿 tab:reorder :2908）→ `applyOrganizePlan(plan)` → **只广播一次** `bookmarks-bar:refresh` → 返回结果
- 顺带修复隐性 bug：create-folder/rename-folder/delete-folder 三通道（:2590/:2596/:2602）补缺失的 broadcast

### 步骤 3：preload 暴露
文件：`src/preload.js`（:790 moveFavoriteInto 附近）

```js
applyFavoritesOrganize: (plan) => ipcRenderer.invoke('favorites:apply-organize', { plan }),
```

### 步骤 4：AI 工具层
文件：`ai-manager.js`（工具插在 search_favorites_fulltext :2410 后；提示词 :435-482）

**organize_favorites 工具**（单工具双 action）：
- `action: 'plan'`：strategy 参数路由
  - `domain`：主进程代码直接归类（仿 suggest_tab_groups :3326 按 hostname 分组），execute 返回 `{plan, message}` → 直接渲染卡片
  - `flat`：主进程直接归入 folderName（默认「整理收藏」）→ 直接渲染卡片
  - `category`：LLM 自己分组。execute 只返回权威数据 `{bookmarks:[{id,title,url,folderId}], message:'…完成后调用 organize_favorites(action=apply) 提交 plan'}`（仿 semantic 分支 :3361，照抄 suggest_tab_groups 模式）
  - `scope`：root（默认，仅根目录）/ all（含子文件夹）；返回数据超 300 条时提示 AI 建议缩小 scope
- `action: 'apply'`：防幻觉校验（仿 apply_tab_groups :3476）
  - `listRecords({limit:100000})` 全量建 validIds Set，幻觉 id 丢弃记 droppedBookmarkIds，全无效组记 droppedGroups
  - bookmarkIds 跨组去重；parentId 非 0 校验存在（否则回落 0 + warning）
  - 条目以 DB 权威数据重建，不信 AI 提交的 title/url
  - 硬上限：≤50 组 / ≤500 条书签，超限报错要求拆分
  - 成功返回 `{plan, message:'方案已提交，卡片展示给用户确认…'}`，details 含计数

**manage_favorites 扩展**（action 枚举扩为 12 个）：

| action（新） | 数据层调用 | 需确认 | 成功后广播 |
|---|---|---|---|
| batch-delete | deleteRecords(:573) | 是 | 是 |
| update-title | updateRecord(:526) | 否 | 是 |
| add-folder / rename-folder | createFolder(:690) / renameFolder(:721) | 否 | 是 |
| delete-folder | deleteFolder(:735) | **必须 requestActionConfirmation（riskLevel high）** | 是 |
| list-folders / get-folder-tree | listFolders(:776) / getFolderTree(:809) | 否 | 否 |
| move | **moveFavoriteInto**(:906) | 否 | 是 |
| get（改造） | listRecords 加 folderId/offset/limit 参数 | 否 | 否 |

delete-folder 确认流程：`requestActionConfirmation({actionId, title:'删除文件夹', description:'…所有收藏和子文件夹将被一并删除', riskLevel:'high'})` → 拒绝返回 cancelled；执行后 `notifyActionSettled`

**系统提示词更新**（:442-443 改 + :479-480 附近仿写）：
- manage_favorites 条目改为全能力描述
- organize_favorites 条目：三策略 + scope + 卡片确认流程说明
- 使用指南三条：category 策略须 LLM 分组后调 apply；「实际移动由用户点应用后执行，不要声称没有权限」；「删除整个文件夹前必须确认」

### 步骤 5：renderer 卡片
文件：`src/index.html`（:888 tab-group-template 后加 `<template id="favorites-organize-template">`）、`src/renderer.js`、main.css

- `renderToolCards` 特例分支（:8342 附近）加：`toolExec.name === 'organize_favorites' && resultData.plan` → `renderFavoritesOrganizeCard(resultData)`
- `renderFavoritesOrganizeCard`（:10027 后）：复用 tab-group 卡片交互（组名 contenteditable、HTML5 DnD 跨组拖书签、删组/加组），书签项 `dataset.bookmarkId`；**拖拽 MIME 用 `text/bookmark-id`，勿加 text/plain**（项目既有教训：防误拖进 webview 触发导航）
- `collectFavoritesPlanFromDOM`（仿 :10360）收集 `[{folderName, parentId, bookmarkIds}]`
- 应用按钮 → `realmAPI.applyFavoritesOrganize(plan)` → success toast「已整理 N 条收藏到 M 个文件夹」+ 卡片淡出；failures>0 提示部分失败
- CSS：main.css 加 `.favorites-organize-*` 样式（照抄 tab-group-card 改类名；主窗口 file:// 无 CSP 限制）

### 步骤 6：手动 UAT
`npm run debug` 真实对话验证：三策略各跑一遍 + scope=all + 幻觉 id 注入（验证 dropped 列表）+ 大量收藏（验证上限报错）+ 多窗口收藏栏同步刷新 + 卡片拖拽编辑后应用 + delete-folder 确认卡片

## 风险点

1. category 策略大收藏量易超 LLM 上下文 → plan 阶段 >300 条提示缩小 scope，apply 硬上限 500/50
2. manage_favorites 各 mutation 漏 broadcast 则 UI 不同步（表格已逐项标注）
3. 卡片展示期间用户手动删收藏 → applyOrganizePlan 失败隔离 + failures 兜底
4. apply 与 plan 之间数据变化 / 重复点应用 → findFolderByName 去重 + moveFavoriteInto 天然幂等
5. 回归：现有 tests/test-favorites-folders.js 必须仍绿（不改既有函数）

## 关键文件清单

| 文件 | 改动 |
|---|---|
| favorites-manager.js | +applyOrganizePlan（唯一数据层改动） |
| main.js | +favorites:apply-organize IPC；补 3 个文件夹通道 broadcast |
| src/preload.js | +applyFavoritesOrganize |
| ai-manager.js | +organize_favorites 工具；manage_favorites 扩展；提示词更新 |
| src/index.html | +favorites-organize-template |
| src/renderer.js | +卡片渲染/收集/应用（renderToolCards 特例分支） |
| main.css | +卡片样式 |
| tests/test-favorites-organize.js | 新建数据层测试 |

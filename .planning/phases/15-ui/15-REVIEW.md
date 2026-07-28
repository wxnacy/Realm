---
phase: 15-ui
reviewed: 2026-07-28T13:09:19Z
status: issues-found
depth: standard
files_reviewed: 5
critical: 1
warning: 11
info: 8
---

# Phase 15 Code Review

## Summary

审查范围为 Phase 15（15-01 文件夹 UI + 15-02 空白右键修复）在 commit `aaf5d1d` 的已提交代码（工作树中的 Phase 16 未提交修改已排除）。后端 SQL 全部参数化、CSP 配置正确、15-02 委托路由结构成立；但新建/重命名文件夹的内联输入框存在 **blur/Enter 双触发**缺陷——Enter 确认会创建两个同名文件夹，且 Escape 取消在输入非空时实际仍会提交。另有批量删除后状态不同步、加载更多失败跳页等 11 项 Warning。15-02 的 UAT 缺口修复本身结构正确，但 15-01 的 UAT Test 6（新建文件夹）遗漏了重复创建问题，建议运行时复核。

## Critical

| # | 问题 | 位置 |
|---|------|------|
| CR-01 | `startNewFolder` Enter 确认创建**两个同名文件夹**；Escape 取消在输入非空时仍会创建文件夹 | src/favorites-page.js:968-1010 |

### CR-01: 内联新建文件夹 blur/Enter 双触发，无 settled 守卫

**根因**：keydown(Enter) 与 blur 两个处理器各自独立调用 `createFolderApi`，且没有任何"已结算"标志。Enter 路径必然触发 blur：

1. Enter 处理器 `await createFolderApi(name, parentId)`（第一次创建）
2. 随后 `await refreshFolderTree()` → `renderFolderTree` → `elements.folderTree.innerHTML = ''` → **聚焦中的 input 被移除 → blur 事件触发**（即使不走这里，Enter 处理器末尾的 `inputRow.remove()` 同样移除聚焦元素触发 blur）
3. blur 处理器中 `input.value` 仍保留输入文本（detached 节点状态保留）→ 第二次 `createFolderApi(name, parentId)` → **重复文件夹**

Escape 路径：输入文本后按 Escape → `inputRow.remove()` → blur → 名称非空 → **照样创建文件夹**（取消失效）。后端 `createFolder` 对 `(parent_id, name)` 无唯一约束，两行都会落库。

注：15-01 UAT Test 6 标记 pass 与此不矛盾——预期项只验证"新文件夹出现在列表中"（出现了，但是两个），Escape 若用空输入测试则不会触发创建。建议运行时复核：Enter 创建一个文件夹后数树中同名节点数。

**修复**（settled 守卫模式，同样适用于 startRenameFolder / startInlineEdit）：

```js
let settled = false;
const finish = () => { settled = true; inputRow.remove(); };

input.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (settled) return;
    settled = true;              // 先置位，阻断后续 blur
    const name = input.value.trim();
    if (name) { /* createFolderApi ... */ }
    inputRow.remove();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    settled = true;              // 取消也要置位
    inputRow.remove();
  }
});

input.addEventListener('blur', async () => {
  if (settled) return;           // Enter/Escape 已处理
  settled = true;
  // ...blur 确认逻辑
});
```

## Warning

| # | 问题 | 位置 |
|---|------|------|
| WR-01 | `startRenameFolder` 同根因双触发：Enter 重复调用 rename API；**Escape 在修改过文本后仍应用重命名**（静默写入用户已放弃的内容） | src/favorites-page.js:1047-1092 |
| WR-02 | `handleBatchDelete` 只删 DOM 节点不同步 `state.records`：已删除项在「按名称排序」或 `loadMore` 重渲染时复活 | src/favorites-page.js:1176-1209 |
| WR-03 | `loadMore` 先 `offset += limit` 再请求，catch 中不回滚：一次失败永久跳过一页（最多 50 条） | src/favorites-page.js:1139-1166 |
| WR-04 | `navigateToFolder` → `loadFavorites` 无请求定序/取消：快速切换文件夹时响应乱序可渲染旧文件夹数据 | src/favorites-page.js:464-474, 1100-1130 |
| WR-05 | 文件夹菜单「在新窗口中打开」循环 `window.open` 最多 1000 个 tab（标签页洪泛），且菜单文案与"逐条开 tab"行为不符 | src/favorites-page.js:791-806 |
| WR-06 | `startRenameFolder` 按名称文本定位树节点：同名文件夹命中错误元素；折叠分支中的文件夹 `targetItem` 为 null 静默失败。树节点未设 `data-id`，无可靠定位手段 | src/favorites-page.js:1018-1031（渲染处 383-448） |
| WR-07 | 「复制」菜单 toast 谎称"已复制 1 项"，粘贴时才报"暂不支持"**并清空剪贴板**——误导反馈 + 销毁剪贴板状态 | src/favorites-page.js:735-741, 902-906 |
| WR-08 | context menu 的 document 级隐藏监听仅在自身触发时才移除；菜单项点击/被新菜单取代关闭时监听残留——旧监听可在点击新菜单非菜单项区域（分隔线/内边距）时将其提前关闭，且在交互间隙累积 | src/favorites-page.js:672-695 |
| WR-09 | `main.js` `folder_id` 解析无 NaN 守卫（`offset`/`limit` 均有 `\|\| 0` 兜底）：`folder_id=abc` → NaN → 走 `WHERE folder_id = ?` 分支静默返回空列表或 400 | main.js:348-349 |
| WR-10 | `deleteFolder`（Phase 14 代码，由 Phase 15 文件夹删除菜单触发）：docstring 声称"子文件夹通过 ON DELETE CASCADE 自动删除"，但 `ensureTable` 的 schema **没有任何外键**——实际只删单条文件夹行，后代文件夹成孤儿残留 DB（其收藏已删、树中不可见，纯数据泄漏） | favorites-manager.js:370-395 + 87-95 |
| WR-11 | `escapeHtml` 不转义双引号却用于属性上下文 `<img src="${escapeHtml(faviconSrc)}">`：潜伏属性逃逸/HTML 注入。当前不可达（唯一写入路径 `saveBookmark` 恒传 `faviconUrl: ''`，且 CSP `script-src 'self'` 挡内联处理器），但 favicon 采集功能上线即激活，应提前修 | src/favorites-page.js:298-305 |

### 关键 Warning 修复建议

**WR-02**：删除成功后同步状态：
```js
const deleted = new Set(ids);
state.records = state.records.filter(r => !deleted.has(r.id));
```

**WR-03**：请求成功后再推进 offset，或 catch 中回滚：
```js
const nextOffset = state.offset + state.limit;
// 成功后再 state.offset = nextOffset；或 catch 中 state.offset -= state.limit
```

**WR-06**：渲染树时设置 `itemEl.dataset.id = folder.id`，重命名按 `[data-id="${folderId}"]` 定位；折叠时先展开父链或改用 modal 重命名。

**WR-08**：在 state 上跟踪当前 hideHandler，`hideContextMenu` 中成对移除：
```js
if (state.contextMenuHideHandler) {
  document.removeEventListener('click', state.contextMenuHideHandler);
  document.removeEventListener('contextmenu', state.contextMenuHideHandler);
  state.contextMenuHideHandler = null;
}
```

**WR-09**：`const folderId = folderIdParam !== null && !Number.isNaN(parseInt(folderIdParam, 10)) ? parseInt(folderIdParam, 10) : undefined;`

**WR-10**：二选一——schema 加 `FOREIGN KEY (parent_id) REFERENCES favorite_folders(id) ON DELETE CASCADE`（注意 parent_id=0 虚拟根与此冲突，需改用应用层），或修正 `deleteFolder` 为 `DELETE FROM favorite_folders WHERE id IN (${placeholders})` 一次删整棵子树，并修正注释。

## Info

| # | 问题 | 位置 |
|---|------|------|
| IN-01 | `highlightText` 可在 HTML 实体内部匹配关键词（如关键词 "amp" 命中 `&amp;`），产生破损高亮文本（无 XSS，纯展示） | src/favorites-page.js:180-191 |
| IN-02 | 「打开」与「在新标签页中打开」菜单项行为完全相同（均为 `window.open(url, '_blank')`），保留其一即可 | src/favorites-page.js:706-718 |
| IN-03 | 死代码：`elements.favoritesPage`（声明后从未使用）、`state.selectAll`（只写不读） | src/favorites-page.js:126, 36 |
| IN-04 | `startNewFolder` 子文件夹插入位置：循环实际等于取最后一个树节点（注释声称"插入到父文件夹后面"），输入行缩进硬编码 level 1，深层父文件夹下位置/缩进均不正确（仅影响瞬时展示） | src/favorites-page.js:946-962 |
| IN-05 | `input.placeholder = '新建文件夹'` 重复赋值（941, 965）；`folder.count` 渲染分支为死代码（后端 `getFolderTree` 不返回 count） | src/favorites-page.js:412-414 |
| IN-06 | 删除当前文件夹的**祖先**文件夹后用户停留在已删除文件夹（仅处理 `currentFolderId === folder.id` 的精确匹配），面包屑路径静默缺失 | src/favorites-page.js:831-833 |
| IN-07 | 「按名称排序」仅客户端排序当前已加载页（≤50 条）且不持久化 `sort_order`，刷新即丢失，toast"已按名称排序"过度承诺 | src/favorites-page.js:870-877 |
| IN-08 | 存量问题（非 Phase 15 引入，同 CR-01 根因）：`startInlineEdit` 的 blur-save 模式使标题编辑的 Escape 实际仍会保存。建议在修 CR-01/WR-01 时一并加 settled 守卫 | src/favorites-page.js:551-609 |

## 已验证无问题项

- **SQL 注入**：`favorites-manager.js` 全部使用参数化查询（含 `listRecords` 新 `folderId` 分支、`deleteRecords`/`moveFavorites` 的占位符展开），无字符串拼接用户输入
- **XSS（文本上下文）**：标题/URL/文件夹名均经 `escapeHtml` 或 `textContent`；`highlightText` 先转义再高亮；`favorites.html` 无内联脚本，CSP `default-src 'self'; script-src 'self'` 正确
- **15-02 委托修复**：`.favorites-main` 单点委托覆盖两容器空白路径，两道守卫（`.favorite-item, .folder-tree-item` / 交互元素）+ `stopPropagation` 先于 `showEmptyContextMenu` 的顺序正确，旧 `#favoritesContent` 绑定已删除无残留；监听器随页面生命周期，无泄漏
- **API 鉴权**：页面所有请求携带 token，主进程 `handleFavoritesApi` 先鉴权后路由，未新增未鉴权端点；`move-favorites`/`folder-tree` 等页面调用的端点均存在
- **项目规范**：2 空格缩进、单引号、分号、函数 JSDoc、camelCase 均符合 AGENTS.md
- **CSS**：纯视觉变更，`.favorites-content-area` 滚动容器与 JS 滚动监听目标一致；`#favoritesContent { flex: 1 }` 兜底注释完整

## Files Reviewed

- `src/favorites-page.js`（@ aaf5d1d，1393 行，全文审查——含 15-01 全部新增与 15-02 委托修复）
- `favorites-manager.js`（@ aaf5d1d，Phase 15 diff + UI 调用的文件夹函数链）
- `main.js`（@ aaf5d1d，list 路由 folder_id 解析 + 收藏 API 全路由）
- `src/favorites.html`（@ aaf5d1d，布局重构 + CSP/脚本检查）
- `src/styles/main.css`（@ aaf5d1d，Phase 15 全部样式 diff）

## Self-Check

PASSED — 5/5 范围内文件均以 Phase 15 提交点（`aaf5d1d`）版本审查，工作树 Phase 16 未提交修改已通过 `git show <commit>:<file>` 隔离；每个发现均有文件路径与行号；CR-01 的 blur 触发链与 WR-10 的 schema/注释矛盾均经二次验证。

---
*Reviewed: 2026-07-28T13:09:19Z*
*Reviewer: gsd-code-reviewer (advisory)*

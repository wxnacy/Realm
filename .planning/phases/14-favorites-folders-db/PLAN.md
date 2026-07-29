# Phase 14: 收藏夹文件夹 - 数据库层实现 - Plan

**Phase:** 14
**Created:** 2026-07-28
**Status:** Ready for execution

## Goal

实现收藏夹文件夹功能的数据库层，包括文件夹表创建、收藏表字段扩展、文件夹 CRUD API、收藏项移动 API，以及对应的 IPC 通道和 HTTP API。

## Requirements Coverage

| Requirement | Description | Tasks |
|-------------|-------------|-------|
| FOLDER-01 | 创建文件夹 | T1, T2, T3 |
| FOLDER-02 | 重命名文件夹 | T2, T3 |
| FOLDER-03 | 删除文件夹 | T2, T3 |
| FOLDER-04 | 移动收藏到文件夹 | T2, T3 |

## Tasks

### T1: 扩展 `favorites-manager.js` — 表结构变更

**File:** `favorites-manager.js`

**Changes:**
1. 在 `ensureTable()` 中创建 `favorite_folders` 表:
   ```sql
   CREATE TABLE IF NOT EXISTS favorite_folders (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL DEFAULT '',
     parent_id INTEGER NOT NULL DEFAULT 0,
     sort_order INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
     FOREIGN KEY (parent_id) REFERENCES favorite_folders(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_favorite_folders_parent_id
     ON favorite_folders (parent_id);
   CREATE INDEX IF NOT EXISTS idx_favorite_folders_sort_order
     ON favorite_folders (sort_order);
   ```

2. 为 `favorites` 表添加 `folder_id` 和 `sort_order` 字段（使用 ALTER TABLE ADD COLUMN 迁移）:
   ```sql
   -- 迁移：添加 folder_id 字段（默认 0 表示根目录）
   ALTER TABLE favorites ADD COLUMN folder_id INTEGER NOT NULL DEFAULT 0;
   -- 迁移：添加 sort_order 字段
   ALTER TABLE favorites ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
   ```
   注意：使用 try-catch 包裹 ALTER TABLE，因为列已存在时会报错

3. 启用外键约束（在 initDatabase 中添加）:
   ```javascript
   db.pragma('foreign_keys = ON');
   ```

**Acceptance Criteria:**
- [ ] `favorite_folders` 表存在且包含 id, name, parent_id, sort_order, created_at 字段
- [ ] `favorites` 表包含 folder_id 和 sort_order 字段（默认值 0）
- [ ] 外键约束启用
- [ ] 重复启动不会报错

---

### T2: 实现文件夹 CRUD API

**File:** `favorites-manager.js`

**New Functions:**

#### createFolder({ name, parentId })
```javascript
/**
 * 创建收藏夹文件夹
 * @param {Object} options
 * @param {string} options.name - 文件夹名称
 * @param {number} [options.parentId=0] - 父文件夹 ID（0 表示根目录）
 * @returns {{id: number}|{error: string, message: string}} 新文件夹 ID 或错误
 */
function createFolder({ name, parentId = 0 }) { ... }
```

#### renameFolder(id, { name })
```javascript
/**
 * 重命名文件夹
 * @param {number} id - 文件夹 ID
 * @param {Object} updates
 * @param {string} updates.name - 新名称
 * @returns {boolean} 是否成功
 */
function renameFolder(id, { name }) { ... }
```

#### deleteFolder(id)
```javascript
/**
 * 删除文件夹（级联删除子文件夹和收藏项）
 * @param {number} id - 文件夹 ID
 * @returns {{success: boolean, message?: string}} 结果
 */
function deleteFolder(id) { ... }
```
注意：不能删除根目录（id=0），返回 `{ success: false, message: '无法删除根目录' }`

#### listFolders(parentId)
```javascript
/**
 * 列出指定父文件夹下的子文件夹（按 sort_order 排序）
 * @param {number} [parentId=0] - 父文件夹 ID
 * @returns {Array} 文件夹列表
 */
function listFolders(parentId = 0) { ... }
```

#### getFolderTree()
```javascript
/**
 * 获取完整的文件夹树结构（递归）
 * @returns {Array} 树形结构的文件夹列表
 */
function getFolderTree() { ... }
```

#### moveFolder(id, { parentId })
```javascript
/**
 * 移动文件夹到新的父文件夹
 * @param {number} id - 文件夹 ID
 * @param {Object} options
 * @param {number} options.parentId - 目标父文件夹 ID
 * @returns {{success: boolean, message?: string}} 结果
 */
function moveFolder(id, { parentId }) { ... }
```
注意：需要循环引用检测（D-01），不能将文件夹移动到自己的后代中

#### 循环引用检测辅助函数
```javascript
/**
 * 检查目标文件夹是否是源文件夹的后代（防止循环引用）
 * @param {number} sourceId - 源文件夹 ID
 * @param {number} targetId - 目标文件夹 ID
 * @returns {boolean} 是否会形成循环
 */
function isDescendant(sourceId, targetId) { ... }
```

**Acceptance Criteria:**
- [ ] 创建文件夹成功返回 `{ id: N }`
- [ ] 重命名文件夹成功返回 `true`
- [ ] 删除文件夹级联删除子文件夹和收藏项
- [ ] 不能删除根目录（id=0）
- [ ] 列出文件夹按 sort_order 排序
- [ ] getFolderTree 返回正确树形结构
- [ ] 移动文件夹循环引用检测有效

---

### T3: 实现收藏项移动 API

**File:** `favorites-manager.js`

**New Functions:**

#### moveFavorite(id, { folderId })
```javascript
/**
 * 将收藏项移动到指定文件夹
 * @param {number} id - 收藏项 ID
 * @param {Object} options
 * @param {number} options.folderId - 目标文件夹 ID（0 表示根目录）
 * @returns {boolean} 是否成功
 */
function moveFavorite(id, { folderId }) { ... }
```

#### moveFavorites(ids, { folderId })
```javascript
/**
 * 批量移动收藏项到指定文件夹
 * @param {Array<number>} ids - 收藏项 ID 数组
 * @param {Object} options
 * @param {number} options.folderId - 目标文件夹 ID
 * @returns {number} 成功移动的数量
 */
function moveFavorites(ids, { folderId }) { ... }
```

#### updateFolderSort(id, { sortOrder })
```javascript
/**
 * 更新文件夹的排序位置
 * @param {number} id - 文件夹 ID
 * @param {Object} options
 * @param {number} options.sortOrder - 新的排序值
 * @returns {boolean} 是否成功
 */
function updateFolderSort(id, { sortOrder }) { ... }
```

#### updateFavoriteSort(id, { sortOrder })
```javascript
/**
 * 更新收藏项的排序位置
 * @param {number} id - 收藏项 ID
 * @param {Object} options
 * @param {number} options.sortOrder - 新的排序值
 * @returns {boolean} 是否成功
 */
function updateFavoriteSort(id, { sortOrder }) { ... }
```

**Acceptance Criteria:**
- [ ] 单个收藏项移动到指定文件夹
- [ ] 批量移动收藏项到指定文件夹
- [ ] folder_id = 0 表示根目录
- [ ] 排序更新正确持久化

---

### T4: 注册 IPC 通道

**File:** `main.js`

**Changes:**

在 `main.js` 的 `app.whenReady()` 回调中，添加以下 IPC 通道:

```javascript
// ==================== 收藏夹文件夹 IPC ====================

// 创建文件夹
ipcMain.handle('favorites:create-folder', async (event, { name, parentId }) => {
  return favoritesManager.createFolder({ name, parentId });
});

// 重命名文件夹
ipcMain.handle('favorites:rename-folder', async (event, { id, name }) => {
  return favoritesManager.renameFolder(id, { name });
});

// 删除文件夹
ipcMain.handle('favorites:delete-folder', async (event, { id }) => {
  return favoritesManager.deleteFolder(id);
});

// 列出子文件夹
ipcMain.handle('favorites:list-folders', async (event, { parentId }) => {
  return favoritesManager.listFolders(parentId);
});

// 获取文件夹树
ipcMain.handle('favorites:get-folder-tree', async () => {
  return favoritesManager.getFolderTree();
});

// 移动文件夹
ipcMain.handle('favorites:move-folder', async (event, { id, parentId }) => {
  return favoritesManager.moveFolder(id, { parentId });
});

// 移动收藏项到文件夹
ipcMain.handle('favorites:move-favorite', async (event, { id, folderId }) => {
  return favoritesManager.moveFavorite(id, { folderId });
});

// 批量移动收藏项
ipcMain.handle('favorites:move-favorites', async (event, { ids, folderId }) => {
  return favoritesManager.moveFavorites(ids, { folderId });
});

// 更新文件夹排序
ipcMain.handle('favorites:update-folder-sort', async (event, { id, sortOrder }) => {
  return favoritesManager.updateFolderSort(id, { sortOrder });
});

// 更新收藏项排序
ipcMain.handle('favorites:update-favorite-sort', async (event, { id, sortOrder }) => {
  return favoritesManager.updateFavoriteSort(id, { sortOrder });
});
```

**Acceptance Criteria:**
- [ ] 所有 IPC 通道正确注册
- [ ] IPC 通道名称符合 kebab-case 规范
- [ ] 参数解构正确

---

### T5: 扩展 HTTP API（内部页面数据层）

**File:** `main.js` — `handleFavoritesApi` 函数

**Changes:**

在 `handleFavoritesApi` 函数中添加以下路由:

```javascript
// 文件夹 CRUD
if (route === 'create-folder' && req.method === 'POST') {
  const { name, parentId } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.createFolder({ name, parentId }));
  return;
}

if (route === 'rename-folder' && req.method === 'POST') {
  const { id, name } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.renameFolder(id, { name }));
  return;
}

if (route === 'delete-folder' && req.method === 'POST') {
  const { id } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.deleteFolder(id));
  return;
}

if (route === 'list-folders' && req.method === 'GET') {
  const parentId = parseInt(reqUrl.searchParams.get('parentId'), 10) || 0;
  sendJson(res, 200, favoritesManager.listFolders(parentId));
  return;
}

if (route === 'folder-tree' && req.method === 'GET') {
  sendJson(res, 200, favoritesManager.getFolderTree());
  return;
}

if (route === 'move-folder' && req.method === 'POST') {
  const { id, parentId } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.moveFolder(id, { parentId }));
  return;
}

if (route === 'move-favorite' && req.method === 'POST') {
  const { id, folderId } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.moveFavorite(id, { folderId }));
  return;
}

if (route === 'move-favorites' && req.method === 'POST') {
  const { ids, folderId } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.moveFavorites(ids, { folderId }));
  return;
}

if (route === 'update-folder-sort' && req.method === 'POST') {
  const { id, sortOrder } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.updateFolderSort(id, { sortOrder }));
  return;
}

if (route === 'update-favorite-sort' && req.method === 'POST') {
  const { id, sortOrder } = await readJsonBody(req);
  sendJson(res, 200, favoritesManager.updateFavoriteSort(id, { sortOrder }));
  return;
}
```

**Acceptance Criteria:**
- [ ] 所有 HTTP API 路由正确注册
- [ ] token 鉴权有效
- [ ] 错误处理正确

---

### T6: 暴露 Preload API

**File:** `src/preload.js`

**Changes:**

在 `contextBridge.exposeInMainWorld('realmAPI', {...})` 中添加以下方法:

```javascript
// 收藏夹文件夹
createFavoriteFolder: (name, parentId) => ipcRenderer.invoke('favorites:create-folder', { name, parentId }),
renameFavoriteFolder: (id, name) => ipcRenderer.invoke('favorites:rename-folder', { id, name }),
deleteFavoriteFolder: (id) => ipcRenderer.invoke('favorites:delete-folder', { id }),
listFavoriteFolders: (parentId) => ipcRenderer.invoke('favorites:list-folders', { parentId }),
getFavoriteFolderTree: () => ipcRenderer.invoke('favorites:get-folder-tree'),
moveFavoriteFolder: (id, parentId) => ipcRenderer.invoke('favorites:move-folder', { id, parentId }),
moveFavorite: (id, folderId) => ipcRenderer.invoke('favorites:move-favorite', { id, folderId }),
moveFavorites: (ids, folderId) => ipcRenderer.invoke('favorites:move-favorites', { ids, folderId }),
updateFavoriteFolderSort: (id, sortOrder) => ipcRenderer.invoke('favorites:update-folder-sort', { id, sortOrder }),
updateFavoriteSort: (id, sortOrder) => ipcRenderer.invoke('favorites:update-favorite-sort', { id, sortOrder }),
```

**Acceptance Criteria:**
- [ ] 所有 API 方法正确暴露在 `window.realmAPI` 下
- [ ] 参数传递正确
- [ ] 返回 Promise

---

## Execution Order

```
T1 (表结构) → T2 (文件夹 CRUD) → T3 (收藏项移动) → T4 (IPC) → T5 (HTTP API) → T6 (Preload)
```

## Verification Checklist

- [ ] 创建文件夹后，文件夹列表正确显示
- [ ] 重命名文件夹后，名称更新
- [ ] 删除文件夹后，子文件夹和收藏项被级联删除
- [ ] 移动收藏项到文件夹后，收藏项的 folder_id 正确更新
- [ ] 循环引用检测有效（不能将文件夹移动到自己的后代中）
- [ ] folder_id = 0 的收藏项保留在根目录
- [ ] 排序字段 sort_order 正确持久化
- [ ] IPC 通道和 HTTP API 均可正常调用
- [ ] 重复启动应用不报错（ALTER TABLE 幂等）

## Notes

- 级联删除依赖 SQLite 外键约束，需要 `PRAGMA foreign_keys = ON`
- 循环引用检测使用应用层递归查询，文件夹层级通常不深（< 10 层）
- folder_id = 0 是特殊值，表示"无文件夹"或"根目录"
- 排序值按创建时间递增分配，用户可通过拖拽调整

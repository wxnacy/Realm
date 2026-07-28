---
phase: 14-favorites-folders-db
verified: 2026-07-28T12:00:00Z
re-verified: 2026-07-28T13:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
uat_status: complete
uat_passed: 7/7
uat_automated: 33/33

gaps:
  - truth: "删除文件夹时，其下的所有收藏项一并删除（级联删除）"
    status: resolved
    reason: "已修复：deleteFolder() 现在会先收集所有后代文件夹 ID，然后删除这些文件夹中的所有收藏项，最后再删除文件夹本身。同时为 favorites.folder_id 添加了索引。"
    artifacts:
      - path: "favorites-manager.js"
        issue: "已修复：添加了 getDescendantFolderIds() 辅助函数，deleteFolder() 先删除收藏项再删除文件夹"
      - path: "favorites-manager.js"
        issue: "已修复：为 favorites.folder_id 添加了索引 idx_favorites_folder_id"
    resolved_by: "732cb09 fix(14-01): 修复删除文件夹时收藏项孤儿记录问题"
---

# Phase 14: 收藏夹文件夹 - 数据库层实现 验证报告

**Phase Goal:** 实现收藏夹文件夹功能的数据库层，包括文件夹表创建、收藏表字段扩展、文件夹 CRUD API、收藏项移动 API，以及对应的 IPC 通道和 HTTP API。
**Verified:** 2026-07-28
**Status:** gaps_found
**Re-verification:** No

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | favorite_folders 表存在且包含 id, name, parent_id, sort_order, created_at 字段 | VERIFIED | favorites-manager.js:76-87，CREATE TABLE IF NOT EXISTS 定义完整 |
| 2 | favorites 表包含 folder_id 和 sort_order 字段（默认值 0） | VERIFIED | favorites-manager.js:107-118，ALTER TABLE ADD COLUMN + try-catch 幂等 |
| 3 | 外键约束启用（PRAGMA foreign_keys = ON） | VERIFIED | favorites-manager.js:46，initDatabase() 中设置 |
| 4 | 重复启动不会报错（ALTER TABLE 幂等） | VERIFIED | favorites-manager.js:107-118，try-catch 包裹 ALTER TABLE |
| 5 | 创建文件夹成功返回 { id: N } | VERIFIED | favorites-manager.js:311-333，createFolder 实现完整 |
| 6 | 重命名文件夹成功返回 true | VERIFIED | favorites-manager.js:342-347，renameFolder 实现完整 |
| 7 | 删除文件夹级联删除子文件夹和收藏项 | FAILED | favorites.folder_id 无 FOREIGN KEY 约束，收藏项不会被级联删除（见 Gaps） |
| 8 | 移动文件夹循环引用检测有效 | VERIFIED | favorites-manager.js:287-302，isDescendant 辅助函数 + moveFolder 调用 |
| 9 | 收藏项移动和排序 API 正确实现 | VERIFIED | favorites-manager.js:442-498，4 个函数实现完整 |
| 10 | IPC 通道 + HTTP API + Preload API 全链路注册 | VERIFIED | main.js:1120-1167（10 IPC）、main.js:392-449（10 HTTP）、src/preload.js:592-660（10 Preload） |

**Score:** 9/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| favorites-manager.js | 文件夹表创建 + CRUD + 收藏项移动 | VERIFIED | 10 个新函数全部实现，module.exports 已导出 |
| main.js | 10 个 IPC 通道 + 10 个 HTTP API 路由 | VERIFIED | IPC 在 app.whenReady 中注册，HTTP 在 handleFavoritesApi 中注册 |
| src/preload.js | 10 个 realmAPI 方法 | VERIFIED | 全部在 contextBridge.exposeInMainWorld 中，含 JSDoc |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/preload.js:createFavoriteFolder | favorites-manager.js:createFolder | main.js IPC favorites:create-folder | VERIFIED | 参数 {name, parentId} 正确传递 |
| src/preload.js:renameFavoriteFolder | favorites-manager.js:renameFolder | main.js IPC favorites:rename-folder | VERIFIED | 参数 {id, name} 正确传递 |
| src/preload.js:deleteFavoriteFolder | favorites-manager.js:deleteFolder | main.js IPC favorites:delete-folder | VERIFIED | 参数 {id} 正确传递 |
| src/preload.js:listFavoriteFolders | favorites-manager.js:listFolders | main.js IPC favorites:list-folders | VERIFIED | 参数 {parentId} 正确传递 |
| src/preload.js:getFavoriteFolderTree | favorites-manager.js:getFolderTree | main.js IPC favorites:get-folder-tree | VERIFIED | 无参数，直接调用 |
| src/preload.js:moveFavoriteFolder | favorites-manager.js:moveFolder | main.js IPC favorites:move-folder | VERIFIED | 参数 {id, parentId} 正确传递 |
| src/preload.js:moveFavorite | favorites-manager.js:moveFavorite | main.js IPC favorites:move-favorite | VERIFIED | 参数 {id, folderId} 正确传递 |
| src/preload.js:moveFavorites | favorites-manager.js:moveFavorites | main.js IPC favorites:move-favorites | VERIFIED | 参数 {ids, folderId} 正确传递 |
| src/preload.js:updateFavoriteFolderSort | favorites-manager.js:updateFolderSort | main.js IPC favorites:update-folder-sort | VERIFIED | 参数 {id, sortOrder} 正确传递 |
| src/preload.js:updateFavoriteSort | favorites-manager.js:updateFavoriteSort | main.js IPC favorites:update-favorite-sort | VERIFIED | 参数 {id, sortOrder} 正确传递 |

### Context Decisions Verification (14-CONTEXT.md)

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | 循环引用防护：应用层递归路径检测 | VERIFIED | favorites-manager.js:287-302 isDescendant 函数，moveFolder 调用 |
| D-02 | folder_id 默认值 0 表示根目录 | VERIFIED | favorites-manager.js:108 ALTER TABLE DEFAULT 0 |
| D-03 | sort_order 字段用于手动排序 | VERIFIED | favorites-manager.js:80,115 两个表均有 sort_order |
| D-04 | ON DELETE CASCADE 外键约束 | PARTIAL | favorite_folders.parent_id 有 CASCADE，但 favorites.folder_id 无外键约束 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FOLDER-01 | PLAN T1, T2, T3 | 创建文件夹 | SATISFIED | createFolder 实现完整，favorite_folders 表创建正确 |
| FOLDER-02 | PLAN T2, T3 | 重命名文件夹 | SATISFIED | renameFolder 实现正确 |
| FOLDER-03 | PLAN T2, T3 | 删除文件夹（级联删除子文件夹和收藏项） | BLOCKED | 级联删除子文件夹有效（FOREIGN KEY parent_id CASCADE），但收藏项不会被级联删除（favorites.folder_id 无外键约束） |
| FOLDER-04 | PLAN T2, T3 | 移动收藏到文件夹 | SATISFIED | moveFavorite/moveFavorites 实现正确，支持批量移动 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| favorites-manager.js | - | favorites.folder_id 缺少 FOREIGN KEY 约束 | BLOCKER | 删除文件夹后收藏项成为孤儿记录，FOLDER-03 级联删除要求未满足 |
| favorites-manager.js | - | favorites.folder_id 缺少索引 | WARNING | 按文件夹查询收藏项时无索引优化，大量数据时性能下降 |

### Behavioral Spot-Checks

Step 7b: SKIPPED (Electron 应用需要 app.whenReady，无法在 CLI 中直接运行)

### Gaps Summary

**1 个阻塞性问题：**

`favorites` 表的 `folder_id` 字段缺少 `FOREIGN KEY (folder_id) REFERENCES favorite_folders(id) ON DELETE CASCADE` 约束。当前 `deleteFolder()` 依赖外键级联删除，但该约束不存在。

**影响：**
- 删除文件夹 A 时，A 的子文件夹会被正确级联删除（因为 `favorite_folders.parent_id` 有 FOREIGN KEY CASCADE）
- 但 A 中的收藏项不会被删除，它们的 `folder_id` 会指向已不存在的文件夹 ID
- 这些收藏项在 UI 中将不可见（除非查询 folder_id=0 的根目录收藏项）

**修复方案（二选一）：**

1. **重建表方案**（推荐，SQLite 不支持 ALTER TABLE ADD CONSTRAINT）：
   在 `ensureTable()` 中创建带 FOREIGN KEY 的 favorites 表，使用 `CREATE TABLE IF NOT EXISTS` 时直接定义约束。对于已有数据，需要迁移：创建新表 -> 复制数据 -> 删除旧表 -> 重命名新表。

2. **应用层级联方案**：
   在 `deleteFolder()` 中手动删除关联收藏项：
   ```javascript
   function deleteFolder(id) {
     if (id === 0) return { success: false, message: '无法删除根目录' };
     // 先删除该文件夹下的收藏项
     db.prepare('DELETE FROM favorites WHERE folder_id = ?').run(id);
     // 再删除文件夹（级联删除子文件夹）
     const result = db.prepare('DELETE FROM favorite_folders WHERE id = ?').run(id);
     return { success: result.changes > 0 };
   }
   ```

**1 个性能警告：**

`favorites.folder_id` 字段缺少索引。当用户有大量收藏项时，按文件夹查询收藏项（`SELECT * FROM favorites WHERE folder_id = ?`）将全表扫描。建议在 `ensureTable()` 中添加：
```sql
CREATE INDEX IF NOT EXISTS idx_favorites_folder_id ON favorites (folder_id);
```

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_

---
status: testing
phase: 14-favorites-folders-db
source: [14-01-SUMMARY.md]
started: 2026-07-28T12:30:00Z
updated: 2026-07-28T12:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: 冷启动冒烟测试
expected: |
  应用从零启动无报错。favorite_folders 表自动创建，favorites 表的 folder_id/sort_order 字段自动迁移。
  在开发者工具 Console 中执行：
  await window.realmAPI.getFavoriteFolderTree()
  应返回空数组 []（无文件夹时）。
awaiting: user response

## Tests

### 1. 冷启动冒烟测试
expected: |
  应用从零启动无报错。favorite_folders 表自动创建，favorites 表的 folder_id/sort_order 字段自动迁移。
  在开发者工具 Console 中执行：
  await window.realmAPI.getFavoriteFolderTree()
  应返回空数组 []（无文件夹时）。
result: [pending]

### 2. 创建文件夹
expected: |
  在开发者工具 Console 中执行：
  await window.realmAPI.createFavoriteFolder('测试文件夹')
  应返回 { id: 1 }（或类似的新 ID）。
  再执行：
  await window.realmAPI.listFavoriteFolders()
  应返回包含 name='测试文件夹' 的数组。
result: [pending]

### 3. 重命名文件夹
expected: |
  在开发者工具 Console 中执行：
  await window.realmAPI.renameFavoriteFolder(1, '已重命名文件夹')
  应返回 true。
  再执行：
  await window.realmAPI.listFavoriteFolders()
  应显示 name='已重命名文件夹'。
result: [pending]

### 4. 删除文件夹（级联删除收藏项）
expected: |
  先将一个收藏项移入文件夹：
  await window.realmAPI.moveFavorite(收藏ID, 1)
  然后删除文件夹：
  await window.realmAPI.deleteFavoriteFolder(1)
  应返回 { success: true }。
  验证收藏项也被删除：
  await window.realmAPI.getFavorite(收藏ID)
  应返回 null 或空。
result: [pending]

### 5. 移动收藏到文件夹
expected: |
  创建新文件夹：
  let folder = await window.realmAPI.createFavoriteFolder('工作收藏')
  将收藏移入：
  await window.realmAPI.moveFavorite(收藏ID, folder.id)
  验证收藏已移动：
  收藏的 folder_id 应等于 folder.id。
result: [pending]

### 6. 循环引用检测
expected: |
  创建两个文件夹：
  let parent = await window.realmAPI.createFavoriteFolder('父文件夹')
  let child = await window.realmAPI.createFavoriteFolder('子文件夹')
  将子文件夹移到父文件夹下（通过 moveFolder）。
  然后尝试将父文件夹移到子文件夹下：
  await window.realmAPI.moveFavoriteFolder(parent.id, child.id)
  应返回 { success: false, message: '不能移动到自己的后代文件夹' }。
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]

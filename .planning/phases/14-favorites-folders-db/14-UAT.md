---
status: complete
phase: 14-favorites-folders-db
source: [14-01-SUMMARY.md]
started: 2026-07-28T12:30:00Z
updated: 2026-07-28T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 表结构初始化
expected: favorite_folders 表创建，favorites 表有 folder_id/sort_order 字段，索引正确
result: pass
source: automated

### 2. 文件夹 CRUD（创建、重命名、列出、树形结构）
expected: 创建/重命名/列出文件夹正常，树形结构递归正确
result: pass
source: automated

### 3. 删除文件夹（级联删除收藏项）
expected: 删除文件夹时，关联的收藏项一并删除
result: pass
source: automated

### 4. 移动收藏到文件夹（单个、批量）
expected: 单个/批量移动收藏到指定文件夹正常
result: pass
source: automated

### 5. 循环引用检测
expected: 不能将文件夹移动到自己的后代中
result: pass
source: automated

### 6. 排序功能
expected: 创建时自动分配 sort_order，updateFolderSort 正常工作
result: pass
source: automated

### 7. 不能删除根目录
expected: deleteFolder(0) 返回失败
result: pass
source: automated

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none - all tests passed]

## Bug Fixes During Testing

1. **外键约束问题**: favorite_folders.parent_id 的外键约束导致 parentId=0 时插入失败
   - 修复：移除外键约束，改用应用层级联删除
   - 提交：140e88a

2. **测试脚本修复**: 修正测试中的错误信息断言和排序值
   - 提交：140e88a

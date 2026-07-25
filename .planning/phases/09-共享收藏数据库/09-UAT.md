---
status: complete
phase: 09-共享收藏数据库
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md]
started: 2026-07-25T16:20:26Z
updated: 2026-07-25T16:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 完全退出应用（如正在运行）。启动 `npm run dev`。应用正常启动无报错，数据库迁移自动完成（旧 favorites_* 表被删除，全局 favorites 表创建成功），主界面正常加载。
result: pass

### 2. favorites-manager.js 重构为全局单表，所有 CRUD 函数移除 containerId
expected: favorites-manager.js 重构为全局单表，所有 CRUD 函数移除 containerId
result: pass
source: automated
coverage_id: 09-01/D1

### 3. main.js API 端点移除 containerId 参数，注册 migrateToGlobal 调用
expected: main.js API 端点移除 containerId 参数，注册 migrateToGlobal 调用
result: pass
source: automated
coverage_id: 09-01/D2

### 4. migrateToGlobal() 启动时自动执行，删除旧表创建全局表
expected: migrateToGlobal() 启动时自动执行，删除旧表创建全局表
result: pass
source: automated
coverage_id: 09-01/D3

### 5. preload.js 8 个收藏 IPC 接口移除 containerId 参数
expected: preload.js 8 个收藏 IPC 接口移除 containerId 参数
result: pass
source: automated
coverage_id: 09-02/D1

### 6. renderer.js checkBookmarkStatus/saveBookmark/removeBookmark 移除容器依赖
expected: renderer.js checkBookmarkStatus/saveBookmark/removeBookmark 移除容器依赖
result: pass
source: automated
coverage_id: 09-02/D2

### 7. favorites-page.js 移除 state.containerId，所有 API 调用无 containerId
expected: favorites-page.js 移除 state.containerId，所有 API 调用无 containerId
result: pass
source: automated
coverage_id: 09-02/D3

### 8. 收藏夹按钮全局唯一 Tab：不再按 containerId 匹配已打开 Tab
expected: 收藏夹按钮全局唯一 Tab：不再按 containerId 匹配已打开 Tab
result: pass
source: automated
coverage_id: 09-02/D4

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

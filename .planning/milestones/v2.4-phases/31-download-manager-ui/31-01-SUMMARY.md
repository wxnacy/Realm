---
phase: 31-download-manager-ui
plan: 01
subsystem: download-manager
tags: [download, ipc, http-api, backend]
dependency:
  requires: []
  provides: [download-api, download-ipc, download-http-routes]
  affects: [download-manager.js, ipc-handlers.js, main.js]
tech_stack:
  added: []
  patterns: [sqlite, ipc-channel, http-api]
key_files:
  created: []
  modified:
    - download-manager.js
    - ipc-handlers.js
    - main.js
decisions:
  - getAllDownloads 不按 container_id 过滤（D-05 决策：面板显示所有容器记录）
  - clearAllDownloads 只删除记录不删除文件（D-16 决策）
  - deleteDownload 路径遍历防护（T-31-01 威胁缓解）
metrics:
  duration_seconds: 26
  completed_date: "2026-08-12"
  tasks_completed: 2
  tasks_total: 2
status: complete
---

# Phase 31 Plan 01: Download Manager Backend Summary

下载管理器后端能力扩展：全局下载列表查询、单条删除（含可选文件删除）、清空历史

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | download-manager.js 新增 getAllDownloads、deleteDownload、clearAllDownloads | d655ae6 | download-manager.js |
| 2 | ipc-handlers.js 注册新通道 + main.js 注册 HTTP API 路由 | 9993678 | ipc-handlers.js, main.js |

## What Was Built

### download-manager.js 新增函数

1. **getAllDownloads(limit, offset)** - 全局查询所有容器的下载记录
   - SQL: `SELECT * FROM downloads ORDER BY start_time DESC LIMIT ? OFFSET ?`
   - 不按 container_id 过滤（D-05 决策）
   - db 未初始化时返回空数组

2. **deleteDownload(downloadId, deleteFile)** - 删除单条下载记录
   - 先查询记录获取 save_path
   - 如果下载仍在进行中，先调用 cancelDownload 取消
   - deleteFile 为 true 时验证路径在用户下载目录内（防路径遍历，T-31-01）
   - 文件删除失败不阻止记录删除
   - 返回 `{ success: true }` 或 `{ success: false, error: '...' }`

3. **clearAllDownloads()** - 清空所有下载历史
   - 只删除 SQLite 记录，不删除本地文件（D-16 决策）
   - 返回 `{ success: true, deletedCount: N }`

### ipc-handlers.js 新增通道

1. `download:list-all` - 调用 downloadManager.getAllDownloads(limit, offset)
2. `download:delete-record` - 调用 downloadManager.deleteDownload(downloadId, deleteFile)
3. `download:clear-all` - 调用 downloadManager.clearAllDownloads()

### main.js 新增内容

1. **handleDownloadsApi 函数** - 处理 /api/downloads/* 请求
   - `/api/downloads/list` GET - 全局查询下载记录
   - `/api/downloads/delete` POST - 删除单条记录
   - `/api/downloads/clear` POST - 清空所有记录
   - 使用 REALM_TOKEN 验证

2. **/downloads 页面路由** - 映射到 src/downloads.html

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| getAllDownloads 不过滤容器 | D-05: 面板需显示所有容器的下载记录 |
| clearAllDownloads 不删文件 | D-16: 用户可能想保留文件只清记录 |
| deleteDownload 路径遍历防护 | T-31-01: 防止通过下载记录删除任意文件 |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Evidence

```
Verification 1: 6 (getAllDownloads/deleteDownload/clearAllDownloads in download-manager.js)
Verification 2: 3 (download:list-all/download:delete-record/download:clear-all in ipc-handlers.js)
Verification 3: 2 (handleDownloadsApi definition + call in main.js)
Verification 4: 6 (/api/downloads/ routes in main.js)
Verification 5: 9 (/downloads page routes in main.js)
```

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-31-01 mitigated | download-manager.js | deleteDownload 验证 save_path 在用户下载目录内 |

## Known Stubs

None - all functions are fully implemented.

## Self-Check

PASSED - All verification criteria met.

## Auth Gates

None - no authentication required for this plan.

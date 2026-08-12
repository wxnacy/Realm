---
phase: 31-download-manager-ui
plan: 02
subsystem: renderer
tags: [download, ui, panel, electron]
requires: [31-01]
provides: [download-panel-ui, downloads-page]
affects: [src/index.html, src/styles/main.css, src/renderer.js, src/preload.js]
tech_stack:
  added: []
  patterns: [dialog-modal, floating-panel, ipc-bridge, http-api-page]
key_files:
  created:
    - src/downloads.html
    - src/downloads-page.js
  modified:
    - src/index.html
    - src/styles/main.css
    - src/renderer.js
    - src/preload.js
decisions:
  - 面板列表每次打开都刷新（不依赖 dirty 标记延迟刷新）
  - realm://downloads 页面通过 HTTP API 获取数据（复用现有内部页面模式）
  - 批量操作使用 Cmd+Click 多选 + 浮动批量操作栏
  - MIME→图标映射在 renderer 和 downloads-page 各维护一份（避免跨页面共享依赖）
status: complete
completed: "2026-08-12"
duration_minutes: 15
---

# Phase 31 Plan 02: Download Manager UI Summary

Chrome 风格下载面板（toggle/列表/暂停恢复/删除清空）+ realm://downloads 独立页面（搜索/分页/操作）

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | index.html 添加下载面板 + main.css 添加面板和列表项样式 | 4549f57 | src/index.html, src/styles/main.css |
| 2 | preload.js 新增 API + renderer.js 实现面板交互逻辑 + 创建 realm://downloads 页面 | c4f84fa | src/preload.js, src/renderer.js, src/downloads.html, src/downloads-page.js |

## What Was Built

### 下载面板 (`#downloadPanel`)
- 锚定在下载按钮下方的浮动面板（380x480px）
- 显示最近 10 条下载记录
- 进行中：进度条（accent）+ 暂停按钮
- 暂停/中断：进度条（muted/danger）+ 恢复按钮
- 已完成：打开文件 + Finder + 删除按钮（hover 显示）
- 空状态："暂无下载记录"
- 全部暂停/恢复按钮（有活跃下载时显示）
- 清空所有记录 + 查看全部按钮

### 操作功能
- 暂停/恢复单个下载
- 删除记录（确认弹窗 + 可选删除本地文件）
- 清空所有记录（二次确认）
- 批量操作：Cmd+Click 多选 → 批量删除
- 面板关闭：外部点击、ESC 键、再次点击下载按钮

### realm://downloads 页面
- 完整下载历史（无 10 条限制）
- 搜索功能（debounce 300ms）
- 滚动分页（50 条/页）
- 所有操作按钮（暂停/恢复/打开/Finder/删除）
- 清空所有记录

### 新增 preload API
- `listAllDownloads(limit, offset)` → `download:list-all`
- `deleteDownloadRecord(downloadId, deleteFile)` → `download:delete-record`
- `clearAllDownloads()` → `download:clear-all`

### 实时更新
- 面板打开时：进度条实时更新、新下载插入列表顶部
- 面板关闭时：标记 dirty，下次打开刷新

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all planned functionality is implemented.

## Self-Check: PASSED

---
phase: 30-download-manager-core
plan: 01
subsystem: download
tags: [electron, sqlite, download, session, ipc]

# Dependency graph
requires: []
provides:
  - download-manager.js 模块（下载事件拦截、进度追踪、SQLite 持久化）
  - download:* IPC 通道（8 个通道：list, get-active-count, get-active, cancel, pause, resume, open-file, show-in-folder）
  - downloads 表（SQLite，位于 history.db，单表 + container_id 列）
  - will-download 事件注册（每个容器 Session）
affects: [30-02, 31-download-manager-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [download-manager-module, sliding-window-speed-calculation, session-download-handler]

key-files:
  created:
    - download-manager.js
  modified:
    - main.js
    - ipc-handlers.js

key-decisions:
  - "使用 crypto.randomUUID() 生成下载 ID，确保全局唯一"
  - "下载记录使用 INSERT OR REPLACE 策略，支持更新进度状态"
  - "速度计算使用滑动窗口平均（5 个样本），避免速度抖动"
  - "dialog.showSaveDialog 需要 BrowserWindow 实例作为父窗口，通过 windowManager.getMainWindow() 获取"

patterns-established:
  - "下载管理器模块模式：独立模块 + Session 事件注册 + IPC 通道暴露"
  - "滑动窗口速度计算：DOWNLOAD_SPEED_WINDOW_SIZE=5, DOWNLOAD_SPEED_MIN_INTERVAL=100ms"

requirements-completed: [DL-09, DL-11, DL-01, DL-05, DL-10]

coverage:
  - id: D1
    description: "下载管理器核心模块（download-manager.js）包含 SQLite 表初始化、will-download 事件注册、进度追踪、速度计算、下载记录 CRUD、文件操作等全部核心函数"
    requirement: DL-01
    verification:
      - kind: other
        ref: "node -e \"const dm = require('./download-manager'); console.log(typeof dm.initDatabase, typeof dm.registerSessionDownloadHandler, typeof dm.getDownloads, typeof dm.getActiveCount)\""
        status: pass
    human_judgment: false
  - id: D2
    description: "main.js 集成 download-manager 初始化和容器 Session 注册"
    requirement: DL-09
    verification:
      - kind: other
        ref: "grep -c 'downloadManager' main.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "ipc-handlers.js 注册 8 个 download:* IPC 通道"
    requirement: DL-10
    verification:
      - kind: other
        ref: "grep -c 'download:' ipc-handlers.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "系统原生保存对话框（NSSavePanel）在下载触发时弹出"
    requirement: DL-09
    verification: []
    human_judgment: true
    rationale: "需要在实际 Electron 应用中触发下载事件才能验证对话框弹出"
  - id: D5
    description: "下载完成后记录写入 SQLite（downloads 表）"
    requirement: DL-11
    verification: []
    human_judgment: true
    rationale: "需要实际下载完成才能验证 SQLite 记录写入"
  - id: D6
    description: "openFile/showInFolder 函数可用（DL-05）"
    requirement: DL-05
    verification:
      - kind: other
        ref: "node -e \"const dm = require('./download-manager'); console.log(typeof dm.openFile, typeof dm.showInFolder)\""
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-11
status: complete
---

# Phase 30 Plan 01: 下载管理器核心引擎 Summary

**下载管理器后端模块：will-download 事件拦截、系统保存对话框、滑动窗口速度计算、SQLite 持久化、8 个 IPC 通道**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-11T15:20:49Z
- **Completed:** 2026-08-11T15:24:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- 创建 download-manager.js 核心模块，包含 SQLite downloads 表初始化、will-download 事件注册、DownloadItem 事件处理、滑动窗口速度计算、下载记录 CRUD、文件操作等全部核心函数
- 集成到 main.js（初始化数据库、为每个容器注册下载处理器）和 ipc-handlers.js（8 个 download:* IPC 通道）
- 所有 IPC 通道包含 assertTrustedSender 校验和参数验证，符合安全要求

## Task Commits

Each task was committed atomically:

1. **Task 1: 创建 download-manager.js 核心模块** - `b998f39` (feat)
2. **Task 2: 集成 download-manager 到 main.js 和 ipc-handlers.js** - `0b5c032` (feat)

## Files Created/Modified
- `download-manager.js` - 下载管理器核心模块（新建）
- `main.js` - 添加 download-manager require、初始化、容器 Session 注册、导出
- `ipc-handlers.js` - 添加 download-manager require 和 8 个 download:* IPC 通道

## Decisions Made
- 使用 crypto.randomUUID() 生成下载 ID，确保全局唯一
- 下载记录使用 INSERT OR REPLACE 策略，支持更新进度状态
- 速度计算使用滑动窗口平均（5 个样本），避免速度抖动
- dialog.showSaveDialog 需要 BrowserWindow 实例作为父窗口，通过 windowManager.getMainWindow() 获取

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all core functions are fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: filesystem_access | download:open-file | shell.openPath 访问本地文件系统，已通过 assertTrustedSender 校验 |
| threat_flag: filesystem_access | download:show-in-folder | shell.showItemInFolder 访问本地文件系统，已通过 assertTrustedSender 校验 |

## Next Phase Readiness
- 下载管理器后端核心完成，ready for Phase 30 Plan 02（UI 集成）
- 所有 IPC 通道已注册，preload.js 和 renderer.js 可直接调用
- SQLite downloads 表已创建，支持按 container_id 查询

---
*Phase: 30-download-manager-core*
*Completed: 2026-08-11*

## Self-Check: PASSED

- [x] download-manager.js 存在
- [x] main.js 存在
- [x] ipc-handlers.js 存在
- [x] 30-01-SUMMARY.md 存在
- [x] commit b998f39 存在
- [x] commit 0b5c032 存在

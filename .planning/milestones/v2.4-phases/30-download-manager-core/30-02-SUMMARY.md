---
phase: 30-download-manager-core
plan: 02
subsystem: download
tags: [electron, download, ui, preload, renderer, contextbridge]

# Dependency graph
requires:
  - phase: 30-download-manager-core
    provides: download-manager.js 模块、download:* IPC 通道
provides:
  - downloadAPI（contextBridge 暴露到渲染进程）
  - 下载按钮 UI（进度环 + 徽标 + tooltip）
  - 下载事件处理和状态管理逻辑
affects: [31-download-manager-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [download-api-namespace, svg-progress-ring, weighted-aggregate-progress]

key-files:
  created: []
  modified:
    - src/preload.js
    - src/index.html
    - src/styles/main.css
    - src/renderer.js

key-decisions:
  - "downloadAPI 作为独立命名空间暴露（与 mediaAPI/playerAPI 同级），不混入 realmAPI"
  - "下载按钮放置在 mediaPanelBtn 和 aiPanelBtn 之间（per D-16）"
  - "tooltip 使用 pointer-events: none + hover 延迟 200ms，避免误触"
  - "多个同时下载时进度环显示加权聚合进度（totalReceived / totalBytes）"
  - "复用 renderer.js 已有的 escapeHtml 函数，新增 formatFileSize 和 formatETA"

patterns-established:
  - "独立 API 命名空间模式：downloadAPI 通过 contextBridge.exposeInMainWorld 独立暴露"
  - "SVG 进度环模式：stroke-dasharray + stroke-dashoffset 实现圆环进度"

requirements-completed: [DL-01, DL-05, DL-09, DL-10]

coverage:
  - id: D1
    description: "downloadAPI 通过 contextBridge 暴露到 window.downloadAPI（含 8 个操作方法 + 3 个事件监听）"
    requirement: DL-10
    verification:
      - kind: other
        ref: "grep -c 'downloadAPI' src/preload.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "下载按钮 HTML 添加到 toolbar-right（mediaPanelBtn 和 aiPanelBtn 之间）"
    requirement: DL-10
    verification:
      - kind: other
        ref: "grep -c 'downloadBtn' src/index.html"
        status: pass
    human_judgment: false
  - id: D3
    description: "下载管理器 CSS 样式（按钮/徽标/tooltip/进度条）"
    requirement: DL-01
    verification:
      - kind: other
        ref: "grep -c 'download-btn' src/styles/main.css"
        status: pass
    human_judgment: false
  - id: D4
    description: "renderer.js 下载 UI 逻辑（事件监听、进度环更新、徽标管理、tooltip、状态切换）"
    requirement: DL-01
    verification:
      - kind: other
        ref: "grep -c 'initDownloads' src/renderer.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "进度环 stroke-dashoffset 实时更新（单下载和多下载加权聚合）"
    requirement: DL-01
    verification: []
    human_judgment: true
    rationale: "需要实际下载触发才能验证进度环动画效果"
  - id: D6
    description: "downloadAPI.openFile 可打开文件"
    requirement: DL-05
    verification: []
    human_judgment: true
    rationale: "需要主进程 download:open-file IPC 通道已注册（30-01 已完成）"

# Metrics
duration: 3min
completed: 2026-08-11
status: complete
---

# Phase 30 Plan 02: 下载管理器前端 UI Summary

**downloadAPI contextBridge 暴露 + 下载按钮 UI（SVG 进度环 + 数字徽标 + 悬停 tooltip）+ renderer.js 事件驱动状态管理**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-11T15:26:53Z
- **Completed:** 2026-08-11T15:30:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- preload.js 暴露 downloadAPI 命名空间（8 个操作方法 + 3 个事件监听器，含清理函数）
- index.html 添加下载按钮（默认箭头/进度环/完成对勾三态切换）和 tooltip 浮层容器
- main.css 添加完整下载管理器样式（按钮/徽标动画/tooltip/进度条/溢出提示）
- renderer.js 实现下载 UI 逻辑（事件处理、进度环更新、徽标管理、tooltip 显示、状态切换 idle/active/done）

## Task Commits

Each task was committed atomically:

1. **Task 1: 暴露 downloadAPI 到 preload.js 并添加下载按钮 HTML 和 CSS** - `e8767f7` (feat)
2. **Task 2: 实现 renderer.js 下载 UI 逻辑** - `4f2694e` (feat)

## Files Created/Modified
- `src/preload.js` - 添加 downloadAPI 命名空间（contextBridge 暴露）
- `src/index.html` - 添加下载按钮 HTML（三态 SVG + 徽标）和 tooltip 容器
- `src/styles/main.css` - 添加 CSS 变量和下载管理器样式
- `src/renderer.js` - 添加下载 UI 逻辑（事件处理 + 状态管理 + UI 更新 + 工具函数）

## Decisions Made
- downloadAPI 作为独立命名空间暴露（与 mediaAPI/playerAPI 同级），不混入 realmAPI
- 下载按钮放置在 mediaPanelBtn 和 aiPanelBtn 之间（per D-16）
- tooltip 使用 pointer-events: none + hover 延迟 200ms，避免误触
- 多个同时下载时进度环显示加权聚合进度（totalReceived / totalBytes）
- 复用 renderer.js 已有的 escapeHtml 函数，新增 formatFileSize 和 formatETA

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| 下载按钮点击 no-op | src/renderer.js | initDownloads() | Phase 31 实现下载面板，当前仅为 console.log |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: tampering | src/renderer.js | tooltip 内容通过 escapeHtml 转义防 XSS（T-30-04 缓解） |

## Next Phase Readiness
- downloadAPI 已暴露，Phase 31 可直接调用所有下载操作方法
- 下载按钮 UI 已完成（进度环 + 徽标 + tooltip），Phase 31 只需实现面板
- 所有事件监听器已注册（started/progress/completed），状态管理就绪

---
*Phase: 30-download-manager-core*
*Completed: 2026-08-11*

## Self-Check: PASSED

- [x] src/preload.js 存在且包含 downloadAPI
- [x] src/index.html 存在且包含 downloadBtn
- [x] src/styles/main.css 存在且包含 download-btn 样式
- [x] src/renderer.js 存在且包含 initDownloads
- [x] 30-02-SUMMARY.md 存在
- [x] commit e8767f7 存在
- [x] commit 4f2694e 存在

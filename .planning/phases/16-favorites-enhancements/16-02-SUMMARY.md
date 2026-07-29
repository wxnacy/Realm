---
phase: 16-favorites-enhancements
plan: 02
subsystem: ui
tags: [drag-and-drop, sorting, fractional-indexing, favorites]

requires:
  - phase: 16-01
    provides: fractional-indexing migration and batch sort API
provides:
  - drag-and-drop sorting for favorites and folders
  - cross-folder move via drag
  - visual drag feedback
affects: [16-03-multi-select]

tech-stack:
  added: []
  patterns: [event-delegation-drag, compute-sort-keys-api]

key-files:
  created: []
  modified: [src/favorites-page.js, src/styles/main.css]

key-decisions:
  - "使用事件委托处理拖拽事件，避免为每个元素单独绑定"
  - "前端通过 compute-sort-keys HTTP 端点计算排序键，避免引入 npm 依赖"
  - "文件夹在前收藏项在后排序，复用 state.folderTree 数据进行循环引用检测"

requirements-completed: [FOLDER-07]

coverage:
  - id: D1
    description: "收藏项和文件夹可拖拽"
    requirement: FOLDER-07
    verification:
      - kind: unit
        ref: "draggable='true' 属性设置"
        status: pass
    human_judgment: false
  - id: D2
    description: "拖拽排序视觉反馈"
    requirement: FOLDER-07
    verification:
      - kind: unit
        ref: "drag-over-top/bottom/folder CSS 类"
        status: pass
    human_judgment: false
  - id: D3
    description: "同目录排序和跨文件夹移动"
    requirement: FOLDER-07
    verification:
      - kind: unit
        ref: "executeDragDrop 函数实现"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-29
status: complete
---

# Phase 16 Plan 02: 拖拽排序核心实现 Summary

**收藏夹拖拽排序：同目录排序、跨文件夹移动、完整的视觉反馈（插入指示线、目标高亮、源半透明）**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-29T12:26:00Z
- **Completed:** 2026-07-29T12:41:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 实现收藏项和文件夹的拖拽排序功能（per D-05 整行可拖）
- 添加蓝色插入指示线（per D-07）和文件夹高亮（per D-06）
- 支持同目录排序（fractional indexing 计算新位置）
- 支持跨文件夹移动（拖到文件夹上）
- 实现文件夹循环引用检测（复用 Phase 14 逻辑）
- 拖拽结束立即保存排序（per D-04）

## Task Commits

1. **Task 1-2: 拖拽排序核心逻辑和视觉反馈** - `8239979` (feat)

## Files Created/Modified

- `src/favorites-page.js` - 添加 computeSortKeys、getDragPosition、isDescendantCheck、executeDragDrop、setupDragAndDrop 函数
- `src/styles/main.css` - 添加拖拽相关样式（.dragging、.drag-over-top/bottom/folder）

## Decisions Made

- 使用事件委托在列表容器上监听拖拽事件，避免为每个元素单独绑定
- 前端通过 compute-sort-keys HTTP 端点计算排序键，避免引入 npm 依赖
- 文件夹在前收藏项在后排序，复用 state.folderTree 数据进行循环引用检测

## Next Steps

Ready for 16-03-PLAN.md（多选与批量操作）

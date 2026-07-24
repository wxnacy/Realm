---
phase: 04-convenience-features
plan: 03
subsystem: renderer
tags: [rules, toggle, drag-drop, import-export, ui]
dependency_graph:
  requires: []
  provides: [rules-enhanced-ui]
  affects: []
tech_stack:
  added: []
  patterns: [toggle-switch, drag-and-drop, file-import-export]
key_files:
  created:
    - assignment-rules.js
  modified:
    - ipc-handlers.js
    - src/preload.js
    - src/renderer.js
    - src/styles/main.css
    - src/index.html
decisions:
  - 使用纯 CSS 实现 toggle switch 组件，无第三方依赖
  - 使用 HTML5 原生 Drag and Drop API 实现规则排序
  - 使用 Electron dialog 和 Node.js fs 模块实现文件导入导出
metrics:
  duration: ~10 minutes
  completed: 2026-07-24
  tasks_completed: 2
  tasks_total: 2
status: complete
---

# Phase 04 Plan 03: 规则管理 UI 增强 — Toggle + Drag-Drop + Import/Export Summary

## One-Liner

增强规则管理 UI：添加 toggle 开关启用/禁用规则、拖拽排序控制匹配优先级、规则导入导出功能。

## Deviations from Plan

None - plan executed exactly as written.

## Tasks Completed

### Task 1: 后端增强 — assignment-rules.js + ipc-handlers.js + preload.js

**Commit:** 61d82cb

**Changes:**
- 创建 `assignment-rules.js` 文件，包含现有 CRUD 和 URL 匹配功能
- 新增 `reorderRules(orderedIds)` 函数：按照 orderedIds 顺序重建 rules Map
- 新增 `exportRules()` 函数：返回规则数组和导出时间戳
- 新增 `importRules(rulesData)` 函数：验证并逐条导入规则
- 新增 `rule:reorder` IPC 处理器：调用 assignmentRules.reorderRules
- 新增 `rule:export` IPC 处理器：使用 dialog.showSaveDialog 选择保存路径
- 新增 `rule:import` IPC 处理器：使用 dialog.showOpenDialog 选择文件
- 新增 `reorderRules`, `exportRules`, `importRules` 到 preload API

**Files Modified:**
- `assignment-rules.js` (created)
- `ipc-handlers.js`
- `src/preload.js`

### Task 2: 前端 UI — Toggle Switch + Drag-Drop + Import/Export

**Commit:** ec1e9d9

**Changes:**

**CSS 样式 (`src/styles/main.css`):**
- 添加 `.toggle-switch` 样式：36px 宽, 20px 高, 圆角 10px
- 添加 `.toggle-track` 样式：关闭态 `--bg-tertiary`，开启态 `--accent-color`
- 添加 `.toggle-thumb` 样式：16px 圆形, 白色, 绝对定位
- 添加 `.toggle-track:not(.active) .toggle-thumb` 样式：left 2px
- 添加 `.toggle-track.active .toggle-thumb` 样式：left 18px
- 添加过渡动画 0.2s ease
- 添加 `.drag-handle` 样式：cursor grab, color `--text-muted`, 6px 宽
- 添加 `.rule-item.dragging` 样式：opacity 0.5
- 添加 `.rule-item.drag-over-top` 样式：border-top 2px solid `--accent-color`
- 添加 `.rule-item.drag-over-bottom` 样式：border-bottom 2px solid `--accent-color`
- 添加 `.rules-actions` 样式：flex, gap 8px, margin-top 12px

**HTML 修改 (`src/index.html`):**
- 在规则模态框的 `.rule-form` 下方添加 `.rules-actions` 区域
- 添加导入规则按钮 `#importRulesBtn`
- 添加导出规则按钮 `#exportRulesBtn`

**JavaScript 修改 (`src/renderer.js`):**
- 在 `elements` 对象中添加 `importRulesBtn` 和 `exportRulesBtn`
- 重写 `renderRulesList(rules)` 函数：
  - 为每个规则项添加 `draggable="true"` 属性
  - 添加 drag handle（`⋮⋮` 图标，class `drag-handle`）
  - 将 toggle 按钮替换为 toggle switch 组件（`.toggle-switch` > `.toggle-track` > `.toggle-thumb`）
  - 绑定 toggle 点击事件：调用 `window.realmAPI.updateRule` 后刷新列表
  - 绑定拖拽事件（dragstart, dragover, drop, dragend）
- 实现拖拽排序逻辑：
  - `dragstart`：设置 `draggedItem`，添加 `dragging` class
  - `dragover`：`e.preventDefault()`，计算鼠标位置决定插入目标的上方或下方
  - `drop`：`e.preventDefault()`，移动 DOM 节点
  - `dragend`：移除所有 drag 相关 class，收集新顺序，调用 `window.realmAPI.reorderRules`
- 实现导入/导出逻辑：
  - `importRules()` 函数：调用 `window.realmAPI.importRules()`，成功后刷新列表并 Toast
  - `exportRules()` 函数：调用 `window.realmAPI.exportRules()`，成功后 Toast
- 在 `setupEventListeners()` 中绑定导入/导出按钮事件

**Files Modified:**
- `src/renderer.js`
- `src/styles/main.css`
- `src/index.html`

## Verification

1. Toggle switch 样式符合 UI-SPEC（36x20px track, 16px thumb, 0.2s 动画）
2. 拖拽排序后规则匹配顺序改变
3. 导出的 JSON 文件包含所有规则
4. 导入规则时验证 containerId 存在性
5. 导入格式错误的文件显示错误提示

## Success Criteria

- [x] Toggle switch 样式符合 UI-SPEC（36x20px track, 16px thumb, 0.2s 动画）
- [x] 拖拽排序后规则匹配顺序改变
- [x] 导出的 JSON 文件包含所有规则
- [x] 导入规则时验证 containerId 存在性
- [x] 导入格式错误的文件显示错误提示

## Known Stubs

None - all functionality is fully implemented.

## Threat Flags

None - no new security-relevant surface introduced.

## Auth Gates

None - no authentication required.

## Self-Check: PASSED

All files created/modified exist. All commits verified.

---
phase: 34-multi-window
plan: 04
subsystem: shortcuts
tags: [shortcuts, hotkey, gap-fix, uat]
dependency:
  requires: []
  provides: [focusUrl-shortcut, registerShortcuts-order-fix]
  affects: []
tech_stack:
  added: []
  patterns: [electron-web-contents-created-lifecycle]
key_files:
  modified:
    - shortcut-manager.js
    - src/renderer.js
    - main.js
  created: []
decisions:
  - "registerShortcuts 放在 createMainWindow 之前，确保 web-contents-created 监听器在窗口创建前就绪"
  - "focusUrl 使用 CmdOrCtrl+L 匹配浏览器标准行为"
metrics:
  duration: 25s
  completed: "2026-08-15T08:31:32Z"
  total_tasks: 2
  completed_tasks: 2
status: complete
---

# Phase 34 Plan 04: Gap Fix - UAT Shortcuts

修复 Phase 34 UAT 发现的两个缺陷：Cmd+L 地址栏聚焦缺失和首次启动 Cmd+W 初始化顺序导致窗口异常关闭。

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | 添加 focusUrl 快捷键（Gap 1 修复） | ddaf437 | shortcut-manager.js, src/renderer.js |
| 2 | 修复 registerShortcuts 初始化顺序（Gap 2 修复） | 1c661c2 | main.js |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **registerShortcuts 执行顺序** — 在 `app.whenReady` 和 `activate` 事件中都移到 `createMainWindow` 之前，确保 `web-contents-created` 监听器在窗口创建前就绪，这样主窗口 webContents 会自动挂载 `attachInputListener`。

2. **focusUrl 使用 CmdOrCtrl+L** — 匹配 Chrome/Safari 标准的「聚焦地址栏」快捷键行为。

## Known Stubs

None - all functionality fully implemented.

## Self-Check: PASSED

- [x] shortcut-manager.js DEFAULT_SHORTCUTS 包含 focusUrl 定义
- [x] src/renderer.js initShortcuts 包含 case 'focusUrl' 处理
- [x] main.js registerShortcuts() 在 createMainWindow() 之前调用（两处）

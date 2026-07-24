---
phase: 04-convenience-features
plan: 02
subsystem: shortcut-manager
tags: [shortcut, menu, accelerator, refactor]
dependency_graph:
  requires: []
  provides: [shortcut-manager-menu-api]
  affects: [main.js, ipc-handlers.js]
tech_stack:
  added: [Electron Menu.accelerator]
  patterns: [hidden-application-menu]
key_files:
  created: []
  modified:
    - shortcut-manager.js
    - main.js
    - ipc-handlers.js
decisions:
  - "使用 Menu.accelerator 替代 globalShortcut 实现应用内快捷键（D-05/D-06/D-07）"
  - "快捷键变更通过 rebuildMenu() 热更新，无需重启应用"
  - "移除 unregisterAll() — Menu accelerator 不需要手动注销"
metrics:
  duration_seconds: 19
  completed: "2026-07-24T12:54:40Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
status: complete
---

# Phase 4 Plan 02: 快捷键重构 — globalShortcut to Menu Accelerator Summary

Menu.accelerator 替代 globalShortcut 实现应用内快捷键，支持 rebuildMenu 热更新

## Tasks Completed

### Task 1: Refactor shortcut-manager.js — Menu Accelerator Implementation

**Commit:** `7540a5f`

**Changes:**
- Replaced `globalShortcut` import with `Menu` from electron
- Rewrote `registerShortcuts(window)` to build a hidden Application Menu with accelerators
- Added `buildMenuTemplate(window)` internal function for menu construction
- Added macOS placeholder menu item (prevents system from consuming shortcut menu items)
- Added `rebuildMenu(window)` for hot-reloading shortcut changes
- Removed `unregisterAll()` function (Menu accelerator does not need manual cleanup)
- Preserved `DEFAULT_SHORTCUTS`, `getShortcuts()`, `getShortcut()`, `setShortcut()` unchanged

### Task 2: Update main.js and ipc-handlers.js Integration

**Commit:** `c207900`

**Changes (main.js):**
- Removed `shortcutManager.unregisterAll()` from `will-quit` handler
- Removed `shortcutManager.unregisterAll()` from `activate` handler
- Updated comments to reflect Menu accelerator behavior

**Changes (ipc-handlers.js):**
- Updated `shortcut:set` handler to call `shortcutManager.rebuildMenu(win)` after successful set
- Obtains `mainWindow` reference via `windowManager.getMainWindow()`
- Shortcuts now take effect immediately without app restart

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "globalShortcut" shortcut-manager.js` (code refs) | 0 (only in doc comment) |
| `grep -c "Menu" shortcut-manager.js` | 20 |
| `grep -c "unregisterAll" main.js` | 0 |
| `grep -c "rebuildMenu" ipc-handlers.js` | 1 |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new security surface introduced. The change reduces attack surface by removing global shortcut registration.

## Self-Check: PASSED

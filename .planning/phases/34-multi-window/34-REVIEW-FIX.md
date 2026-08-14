---
phase: 34-multi-window
fixed_at: 2026-08-15T02:00:00Z
review_path: .planning/phases/34-multi-window/34-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-08-15T02:00:00Z
**Source review:** .planning/phases/34-multi-window/34-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 3 (Warning level, fix_scope=critical_warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: main.js notification paths still use getMainWindow() instead of broadcast()

**Files modified:** `main.js`
**Commit:** 9ea0a24
**Applied fix:** Replaced three notification paths that used `getMainWindow()` + `send()` with `windowManager.broadcast()`:
- `_notifyBookmarksBarRefresh()`: Now broadcasts `bookmarks-bar:refresh` to all windows
- `settings:updated` notification: Now broadcasts to all windows instead of just the first
- `bookmarks-bar:visibility-changed` notification: Now broadcasts to all windows

Also updated the misleading comment that claimed to "向所有渲染进程广播" but only sent to one window.

### WR-02: requestActionConfirmation sends AI action confirmation to only first window

**Files modified:** `main.js`
**Commit:** 9ea0a24
**Applied fix:** Refactored `requestActionConfirmation()` to use `windowManager.broadcast()` instead of `mainWindow.webContents.send()`:
- Confirmation request (`action:request-confirmation`) now broadcasts to all windows
- Timeout settlement (`action:settle`) now broadcasts to all windows
- Updated log message from "已发送" to "已广播" to reflect the change
- Kept `getMainWindow()` check for window existence validation only

### WR-03: IPC handlers registered in main.js lack assertTrustedSender validation

**Files modified:** `main.js`
**Commit:** 9ea0a24
**Applied fix:** Added local `assertTrustedSender()` function in main.js (matching the one in ipc-handlers.js) and applied it to all 23 IPC handlers:
- Added `assertTrustedSender(event)` as first line in all handlers that had `event` parameter
- Added `(event)` parameter to 6 handlers that lacked it: `favorites:get-folder-tree`, `favorites:import-abort`, `favorites:detect-chrome-path`, `bookmarks-bar:get-visibility`, `script:stop`, `get-realm-port`
- Trust validation now consistent across main.js and ipc-handlers.js

## Skipped Issues

None.

---

_Fixed: 2026-08-15T02:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

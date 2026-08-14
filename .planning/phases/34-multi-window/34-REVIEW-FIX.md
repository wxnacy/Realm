---
phase: 34-multi-window
fixed_at: 2026-08-15T03:30:00Z
review_path: .planning/phases/34-multi-window/34-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report (Iteration 3)

**Fixed at:** 2026-08-15T03:30:00Z
**Source review:** .planning/phases/34-multi-window/34-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 2 (critical_warning scope: CR-*, BL-*, WR-*)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Bookmarks bar context menu global state changes not broadcast to all windows

**Files modified:** `main.js`
**Commit:** 0712fb3
**Applied fix:** Replaced `hostWebContents.send(...)` with `windowManager.broadcast(...)` for 3 bookmarks bar context menu actions that modify global shared state:

1. **Delete bookmark** (line ~1906): `hostWebContents.send('bookmarks-bar:refresh')` replaced with `windowManager.broadcast('bookmarks-bar:refresh')`
2. **Delete folder** (line ~1938): `hostWebContents.send('bookmarks-bar:refresh')` replaced with `windowManager.broadcast('bookmarks-bar:refresh')`
3. **Hide bookmarks bar** (line ~1987): `hostWebContents.send('bookmarks-bar:visibility-changed', ...)` replaced with `windowManager.broadcast('bookmarks-bar:visibility-changed', ...)`

This ensures all open windows see bookmark deletions and visibility changes, not just the source window.

### WR-02: Import progress notifications only sent to first window

**Files modified:** `main.js`
**Commit:** 0712fb3 (same commit, same file)
**Applied fix:** Changed both `favorites:import-chrome` and `favorites:import-html` handlers to send progress updates via `event.sender.send(...)` instead of `mainWindow.webContents.send(...)`. Also removed the now-unused `const mainWindow = windowManager.getMainWindow()` and its early-return guard from both handlers, since `assertTrustedSender(event)` already validates the sender.

This ensures import progress appears in the window that initiated the import, not always the first/oldest window.

## Skipped Issues

None.

---

_Fixed: 2026-08-15T03:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_

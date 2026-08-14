---
phase: 34-multi-window
fixed_at: 2026-08-15T00:10:00Z
review_path: .planning/phases/34-multi-window/34-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-08-15T00:10:00Z
**Source review:** .planning/phases/34-multi-window/34-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Warning level, fix_scope=critical_warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: main.js callers not updated for refactored shortcut-manager API

**Files modified:** `main.js`
**Commit:** 968603e
**Applied fix:** Removed stale `window` argument from all 4 call sites (`registerShortcuts(mainWindow)` -> `registerShortcuts()`, `rebuildShortcuts(win)` -> `rebuildShortcuts()`). Updated the stale comment at the activate handler that incorrectly stated `registerShortcuts` replaces the entire Application Menu.

### WR-02: IPC event notifications not broadcast to all managed windows

**Files modified:** `ipc-handlers.js`
**Commit:** 06532cd
**Applied fix:** Replaced `getMainWindow()` + `send()` pattern with `windowManager.broadcast()` for `tab:recycled` and `bookmarks-bar:refresh` events, ensuring all managed windows receive notifications in multi-window scenarios.

### WR-03: Missing assertTrustedSender on webview management handlers

**Files modified:** `ipc-handlers.js`
**Commit:** 38f6fd7
**Applied fix:** Added `assertTrustedSender(event)` as the first line in both `webview:set-active` and `webview:register-container` handlers, consistent with the trust model applied to all other IPC handlers.

### WR-04: registerHandlers guard does not protect against partial registration failure

**Files modified:** `ipc-handlers.js`
**Commit:** c392fd6
**Applied fix:** Moved `handlersRegistered = true` from the end of `registerHandlers()` to immediately after the guard check at the top. This prevents partial re-registration if the function throws partway through. Removed the duplicate assignment at the end.

## Skipped Issues

None.

---

_Fixed: 2026-08-15T00:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

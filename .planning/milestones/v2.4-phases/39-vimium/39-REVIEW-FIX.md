---
phase: 39-vimium
fixed_at: 2026-08-24T12:30:00Z
review_path: ~/Projects/Realm/.planning/phases/39-vimium/39-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 39: Code Review Fix Report

**Fixed at:** 2026-08-24T12:30:00Z
**Source review:** ~/Projects/Realm/.planning/phases/39-vimium/39-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 critical, 3 warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Vim focus-state IPC uses renderer webContents ID instead of guest ID

**Files modified:** `shortcut-manager.js`, `src/preload.js`, `src/renderer.js`
**Commit:** 72691d3
**Applied fix:** Updated the full IPC chain to pass the webview guest's webContents ID. Renderer now calls `webview.getWebContentsId()` and passes it through `setVimFocusState(guestId, isInInput)`. Preload accepts both parameters. Shortcut-manager IPC handler uses the passed `webContentsId` instead of `event.sender.id`. This fixes the webContents ID mismatch that made input field detection completely non-functional.

**Note:** This is a logic bug fix -- requires human verification that the Vim focus-state feature works correctly in practice.

### CR-02: Alt+P (toggle pinned tab) shortcut is unreachable

**Files modified:** `shortcut-manager.js`
**Commit:** e54d128
**Applied fix:** Moved the Alt+P check before the `!hasModifier` guard. The Alt+P handler now runs as an independent check (`if (input.alt && !input.meta && !input.control && ...)`) before the `if (!hasModifier)` block that handles single-key Vim commands. This ensures Alt+P is reachable since Alt itself sets `hasModifier=true`.

**Note:** This is a logic bug fix -- requires human verification that Alt+P togglePinTab works correctly.

### WR-01: Redundant `!input.control` condition in Vim key guard

**Files modified:** `shortcut-manager.js`
**Commit:** e54d128 (same commit as CR-02, same code region)
**Applied fix:** Simplified the guard from `if (!hasModifier && !input.control)` to `if (!hasModifier)`. The `!input.control` was redundant since `hasModifier` already includes `input.control`.

### WR-02: CapsLock causes 'n' key to trigger searchPrev instead of searchNext

**Files modified:** `src/vimium/vimium-manager.js`
**Commit:** f6defd8
**Applied fix:** Normalized the key to lowercase before comparing in the search mode check. Now uses `key.toLowerCase()` and checks `shift` to determine direction (`shift ? 'searchPrev' : 'searchNext'`). This correctly handles CapsLock where pressing 'n' produces `key='N'` with `shift=false`.

**Note:** This is a logic bug fix -- requires human verification that search navigation works correctly with CapsLock on/off.

### WR-03: vimFocusStates Map leaks entries on webContents destruction

**Files modified:** `shortcut-manager.js`
**Commit:** 5a93916
**Applied fix:** Added a `contents.on('destroyed', ...)` handler in the `web-contents-created` listener that calls `vimFocusStates.delete(contents.id)`. This prevents the Map from growing indefinitely as tabs are opened and closed during a browser session.

## Verification

- Syntax checks: All 4 modified files pass `node -c` syntax validation
- Verification ran in: isolated worktree (`.claude/worktrees/rf-39-39873-1787541397`)

---

_Fixed: 2026-08-24T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

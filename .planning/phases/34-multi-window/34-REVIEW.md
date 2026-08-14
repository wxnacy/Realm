---
phase: 34-multi-window
reviewed: 2026-08-14T23:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - ipc-handlers.js
  - shortcut-manager.js
  - window-manager.js
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-08-14T23:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 34 introduces multi-window foundations across three files: window-manager.js adds a `windows` Map registry, `managedWindowIds` Set, and `broadcast()` helper; shortcut-manager.js refactors from single-window dispatch to `BrowserWindow.getFocusedWindow()` dynamic dispatch; ipc-handlers.js generalizes `assertTrustedSender` from hardcoded main-window check to `managedWindowIds` membership, and adds a duplicate-registration guard.

The changes are architecturally sound -- eliminating the single-window singleton pattern and replacing it with dynamic focus-based dispatch is the right approach. However, the refactoring is incomplete: callers in `main.js` were not updated for the changed function signatures, and `broadcast()` is defined but never wired into the IPC notification paths that need multi-window delivery.

## Warnings

### WR-01: main.js callers not updated for refactored shortcut-manager API

**File:** `main.js:1624`, `main.js:1635`, `main.js:2387`, `main.js:2480`

**Issue:** The refactored `shortcut-manager.js` changed `registerShortcuts()` and `rebuildShortcuts()` to parameterless functions (removing the `window` argument), but `main.js` still calls them with the old signatures:

```javascript
// main.js:2387 — old signature, arg silently ignored
shortcutManager.registerShortcuts(mainWindow);

// main.js:1624 — old signature, arg silently ignored
shortcutManager.rebuildShortcuts(win);
```

JavaScript silently ignores extra arguments, so this does not crash. However, it signals incomplete refactoring -- the callers should be updated to match the new API contract. Additionally, the stale comment at main.js:2478-2479 ("registerShortcuts 会直接替换整个 Application Menu") is now incorrect; the function no longer touches the Application Menu.

**Fix:** Update all 4 call sites in main.js to drop the window argument, and update the stale comment:

```javascript
// main.js:2387
shortcutManager.registerShortcuts();

// main.js:1624,1635
shortcutManager.rebuildShortcuts();
```

### WR-02: IPC event notifications not broadcast to all managed windows

**File:** `ipc-handlers.js:239-241`, `ipc-handlers.js:1344-1346`

**Issue:** The `broadcast()` function was added to `window-manager.js` specifically for multi-window event delivery, but it is never used. Two IPC notification paths still use `getMainWindow()` which only targets the first (oldest) window:

```javascript
// ipc-handlers.js:239 — tab:recycled only sent to first window
const win = windowManager.getMainWindow();
win.webContents.send('tab:recycled', { tabId: recycledTabId, message });

// ipc-handlers.js:1344 — bookmarks-bar:refresh only sent to first window
const mainWindow = windowManager.getMainWindow();
mainWindow.webContents.send('bookmarks-bar:refresh');
```

In a multi-window scenario, windows B and C would never receive tab recycling or bookmark refresh notifications, causing stale UI.

**Fix:** Replace `getMainWindow()` + `send()` with `broadcast()` for events that affect all windows:

```javascript
// ipc-handlers.js:239
windowManager.broadcast('tab:recycled', { tabId: recycledTabId, message });

// ipc-handlers.js:1344
windowManager.broadcast('bookmarks-bar:refresh');
```

### WR-03: Missing assertTrustedSender on webview management handlers

**File:** `ipc-handlers.js:1439-1441`, `ipc-handlers.js:1450-1457`

**Issue:** The `assertTrustedSender` generalization (D-11) was applied to all other IPC handlers, but `webview:set-active` and `webview:register-container` skip the check entirely. These handlers lack trust validation:

```javascript
// ipc-handlers.js:1439 — no assertTrustedSender
ipcMain.handle('webview:set-active', (event, contentsId) => {
    activeWebviewContentsId = contentsId;
});

// ipc-handlers.js:1450 — no assertTrustedSender
ipcMain.handle('webview:register-container', (event, contentsId, containerId) => {
    if (typeof contentsId !== 'number' || typeof containerId !== 'string' || !containerId) {
      return;
    }
    guestContainerMap.set(contentsId, containerId);
    mediaSniffer.flushPending(contentsId);
});
```

While Electron's `contextIsolation: true` prevents webview guest pages from directly calling `ipcRenderer.invoke`, the inconsistent trust model means the player window (not in `managedWindowIds`) or any future non-managed window could register guest-container mappings, potentially breaking container isolation.

**Fix:** Add `assertTrustedSender` to both handlers:

```javascript
ipcMain.handle('webview:set-active', (event, contentsId) => {
    assertTrustedSender(event);
    activeWebviewContentsId = contentsId;
});

ipcMain.handle('webview:register-container', (event, contentsId, containerId) => {
    assertTrustedSender(event);
    if (typeof contentsId !== 'number' || typeof containerId !== 'string' || !containerId) {
      return;
    }
    guestContainerMap.set(contentsId, containerId);
    mediaSniffer.flushPending(contentsId);
});
```

### WR-04: registerHandlers guard does not protect against partial registration failure

**File:** `ipc-handlers.js:226-235`, `ipc-handlers.js:1827`

**Issue:** The `handlersRegistered` flag is set to `true` at the very end of `registerHandlers()` (line 1827). If the function throws partway through (e.g., a module import fails or a handler registration error), the flag remains `false`. A subsequent call would attempt to re-register all handlers, causing Electron to throw "handler for 'X' already registered" for every channel registered before the failure point.

```javascript
// Line 231: guard at entry
if (handlersRegistered) { return; }

// ... 60+ ipcMain.handle() calls ...

// Line 1827: flag set only on success
handlersRegistered = true;
```

**Fix:** Either set the flag at the top of the function (before any `ipcMain.handle` calls), or wrap in try/catch with cleanup. The simplest fix:

```javascript
function registerHandlers() {
  if (handlersRegistered) {
    console.warn('[Realm] registerHandlers 已调用，跳过重复注册');
    return;
  }
  handlersRegistered = true;  // Set immediately to prevent re-entry
  // ... all ipcMain.handle() calls ...
}
```

## Info

### IN-01: broadcast() exported but never imported or used

**File:** `window-manager.js:151-157`

**Issue:** The `broadcast()` function is defined and exported from `window-manager.js` but is never imported by any module (`main.js`, `ipc-handlers.js`, or `shortcut-manager.js` do not reference it). It exists as dead code awaiting integration with WR-02's fix.

**Fix:** Wire `broadcast()` into the IPC notification paths as described in WR-02.

### IN-02: rebuildShortcuts() and unregisterAll() are now no-ops

**File:** `shortcut-manager.js:283-285`, `shortcut-manager.js:291-293`

**Issue:** After the refactor, `rebuildShortcuts()` only logs a message (the real-time matching via `getShortcuts()` makes rebuild unnecessary), and `unregisterAll()` only logs (listeners auto-cleanup with webContents). The function signatures are preserved for backward compatibility with main.js callers, but the bodies are effectively dead code. Once WR-01 is resolved (callers updated), these functions could be simplified or removed.

**Fix:** No immediate action needed. After WR-01 is fixed, consider removing these no-op functions or documenting them as intentional no-ops for API stability.

---

_Reviewed: 2026-08-14T23:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 29-
plan: 04
gap_closure: true
gap_ids: [G-29-6]
status: completed
executed: 2026-08-08
---

# Plan 29-04 Summary: 媒体按钮实时显隐 (G-29-6)

## Changes

- `main.js` (update route, ~995): After `configStore.set` loop, collects `changedKeys = Object.keys(updates)` and broadcasts `settings:updated` to main window via `windowManager.getMainWindow().webContents.send('settings:updated', changedKeys)`. Includes null/isDestroyed guard.
- `src/preload.js` (app settings section): Added `onSettingsUpdated(callback)` API wrapping `ipcRenderer.on('settings:updated', (event, changedKeys) => callback(changedKeys))`.
- `src/renderer.js` (init flow): Replaced dead `document.addEventListener('visibilitychange', ...)` block with `window.realmAPI.onSettingsUpdated(...)` subscription. Callback filters for `mediaPlayer` prefix keys, re-reads settings, and calls `updateMediaPlayerVisibility(enabled)`.

## Verification

- `node --check main.js && node --check src/preload.js && node --check src/renderer.js` — all passed
- `grep -c 'settings:updated' main.js` — >= 1
- `grep -c 'onSettingsUpdated' src/preload.js` — >= 1
- `grep -c 'onSettingsUpdated' src/renderer.js` — >= 1
- `grep -c 'visibilitychange' src/renderer.js` — == 0 (dead code fully removed)

## Gaps Closed

- G-29-6: 切换功能开关后，主界面地址栏旁的媒体播放按钮立即显示/隐藏，无需重启。Event-driven path: settings page webview -> HTTP POST /api/settings/update -> main process broadcasts -> renderer subscribes -> `updateMediaPlayerVisibility` applied instantly.

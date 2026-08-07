---
phase: 27-media-panel
reviewed: 2026-08-07T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/index.html
  - src/styles/main.css
  - src/renderer.js
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-08-07T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Review of media panel implementation across `src/index.html` (HTML structure), `src/styles/main.css` (CSS styles), and `src/renderer.js` (JS logic). The feature adds a floating panel for detected media resources with play/copy operations, real-time updates via IPC, and container isolation.

Two critical issues found: an HTML injection vulnerability in the media type badge rendering, and a silent swallowing of `playMedia` failures that leaves the user with no feedback. Four warnings cover dead code, missing URL validation, stale UI state after navigation, and unhandled Promise rejections.

## Critical Issues

### CR-01: HTML Injection via Unescaped `type` in Media Item Template

**File:** `src/renderer.js:5162`
**Issue:** The `type` variable from `item.type` is interpolated directly into the HTML template without `escapeHtml()` sanitization. All other dynamic values (`item.url`, `name`, `urlPreview`) are properly escaped, but `type` is not:

```js
// line 5162 — type is NOT escaped
<span class="media-type-badge media-type-${type}">${type}</span>
```

If a malicious web page crafts a video element with a `src` attribute whose extension-classification yields a type containing `"`, it can break out of the `class` attribute and inject arbitrary HTML attributes or content. The `classifyUrl()` in the sniffer script only handles known extensions and returns `'unknown'` for everything else, but the IPC path `reportMediaDetected` -> `handleScriptDetected` -> `addMedia` accepts `item.type` from the renderer without validation. A compromised or spoofed IPC message could set `type` to a payload like `x"><img src=x onerror=alert(document.cookie)>`.

**Fix:**
```js
// src/renderer.js:5162 — escape type same as all other dynamic values
const safeType = escapeHtml(type);
return `
  <div class="media-item" data-url="${escapeHtml(item.url)}" data-index="${index}">
    <span class="media-type-badge media-type-${safeType}">${safeType}</span>
    ...
`;
```

### CR-02: `playMedia` Uses `window.open()` Bypassing All Main Process Validation

**File:** `src/renderer.js:5221`
**Issue:** `playMedia()` calls `window.open(item.url, '_blank')` directly, bypassing the main process `media:play` IPC handler (which validates URL is a non-empty string and loads a dedicated player page). The `window.open` path goes through Electron's `setWindowOpenHandler` in `main.js`, which may have different URL validation rules. If the URL is a `javascript:` or `data:` URI, the renderer's `window.open` could execute arbitrary code in a new window context, circumventing the `media:play` handler's protections.

The preload script exposes `mediaAPI.playMedia(url)` specifically for this purpose, but the renderer never calls it.

**Fix:**
```js
// src/renderer.js:5216-5222 — use the IPC-based playMedia
async function playMedia(index) {
  const item = state.mediaItems[index];
  if (!item) return;

  console.log('[Realm Renderer] 播放媒体:', item.url);
  try {
    await window.mediaAPI.playMedia(item.url);
  } catch (error) {
    console.error('[Realm Renderer] 播放失败:', error);
  }
}
```

## Warnings

### WR-01: `cleanupMediaPanel()` Defined But Never Called

**File:** `src/renderer.js:5299-5304`
**Issue:** The `cleanupMediaPanel()` function (which removes the `onMediaListUpdate` IPC listener) is defined and the cleanup function is stored in `cleanupMediaListener`, but `cleanupMediaPanel()` is never invoked anywhere in the codebase. The IPC listener registered in `initMediaPanel()` persists for the lifetime of the window. While this is not a functional bug (Electron cleans up on window close), it is dead code that misleads readers into believing cleanup is wired up.

**Fix:** Either call `cleanupMediaPanel()` in the appropriate teardown path (e.g., before container switch or window unload), or remove the function entirely if the listener lifecycle is intentionally tied to the window lifecycle. If removing, also simplify `initMediaPanel`:

```js
// Option A: Wire up cleanup on container switch (inside switchContainer)
cleanupMediaPanel(); // before re-init
initMediaPanel();

// Option B: Remove dead code if listener is window-scoped
// Delete cleanupMediaListener variable and cleanupMediaPanel function
```

### WR-02: No URL Protocol Validation Before Opening Media

**File:** `src/renderer.js:5221` (or `ipc-handlers.js:1322-1341` after CR-02 fix)
**Issue:** Neither the renderer's `window.open()` path nor the main process `media:play` handler validates the URL protocol scheme. The `media:play` handler only checks `typeof url === 'string'` and non-empty. A `javascript:`, `data:`, or `file:` URL could be loaded in the player window, potentially executing arbitrary code or accessing local files.

**Fix:**
```js
// ipc-handlers.js — inside media:play handler, after type check
const parsed = new URL(url);
if (!['http:', 'https:'].includes(parsed.protocol)) {
  throw new Error('不支持的 URL 协议');
}
```

### WR-03: Stale Media UI After Page Navigation

**File:** `src/renderer.js:988`
**Issue:** When the user navigates to a new page, `window.mediaAPI.clearMediaList(navContainerId)` is called to clear the main process store, but the renderer's `state.mediaItems` is not updated. If the media panel is open, it continues showing stale items from the previous page until the user closes and reopens the panel, or until a new `media:list-updated` event arrives. This creates a confusing UX where the panel shows media from the wrong page.

**Fix:**
```js
// src/renderer.js:988 — after clearMediaList, also clear local state
window.mediaAPI.clearMediaList(navContainerId);
// Sync local state so open panel reflects the cleared list
state.mediaItems = [];
renderMediaList();
updateMediaBadge();
```

### WR-04: Unhandled Promise Rejection in `loadMediaList` Context

**File:** `src/renderer.js:2117`
**Issue:** In `switchContainer()`, `loadMediaList()` is called without `await` and without a `.catch()` at the call site. While `loadMediaList` has an internal try/catch, if `window.mediaAPI.getMediaList()` throws synchronously before the await (e.g., if `window.mediaAPI` is undefined during initialization race), the unhandled rejection propagates. More importantly, calling `loadMediaList()` without await means the function's completion is fire-and-forget, so any error logging happens asynchronously with no way for the caller to react.

**Fix:** Add `.catch()` to the fire-and-forget call:
```js
// src/renderer.js:2117
loadMediaList().catch(err => console.error('[Realm Renderer] 切换容器后加载媒体列表失败:', err));
```

## Info

### IN-01: `escapeHtml` Function Creates a New DOM Element Per Call

**File:** `src/renderer.js:5206-5209`
**Issue:** The `escapeHtml()` function creates a new `div` element via `document.createElement` on every invocation to leverage the browser's HTML entity encoding. In `renderMediaList`, it is called 3 times per media item (url, name, urlPreview), so for a list of 100 items, this creates 300 transient DOM elements. While not a bug, this is an inefficient pattern. A simple string replacement approach would be more performant:

```js
function escapeHtml(text) {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}
```

### IN-02: Media Panel Position Hardcoded to Right Side

**File:** `src/styles/main.css:5961-5962`
**Issue:** The media panel uses `right: 16px` which positions it on the right side, overlapping with the AI panel (`ai-panel`) which also opens from the right. If both panels are open simultaneously, they would overlap. The current code does not prevent opening both panels at the same time.

### IN-03: Console Log Statements in Production Code

**File:** `src/renderer.js:5115, 5220, 5255, 5285`
**Issue:** Multiple `console.log` statements remain in the media panel functions. These are development-time diagnostics that should be removed or gated behind a debug flag for production builds, consistent with the project's `[Realm Renderer]` prefix convention.

---

_Reviewed: 2026-08-07T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

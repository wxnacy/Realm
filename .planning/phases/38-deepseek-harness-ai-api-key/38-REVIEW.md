---
status: fixed
phase: 38
phase_name: deepseek-harness-ai-api-key
depth: standard
files_reviewed: 7
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
fixed:
  critical: 1
  warning: 4
  total: 5
---

# Code Review: Phase 38 — deepseek-harness-ai-api-key

## Scope

| File | Plans |
|------|-------|
| `ai-manager.js` | 01 |
| `main.js` | 01 |
| `src/settings.html` | 02 |
| `src/settings-page.js` | 02, 03 |
| `src/styles/main.css` | 02, 03 |
| `src/index.html` | 03 |
| `src/renderer.js` | 03 |

## Findings

### CR-01: `env-var` endpoint leaks API key values to renderer ✅ FIXED

**Severity:** Critical · **File:** `main.js` (line ~1193), `ai-manager.js` (`detectEnvVar`)

The `GET /api/ai/providers/:id/env-var` endpoint returns `{ found, name, value }` where `value` is the raw API key from `process.env`. The renderer (`settings-page.js`) only uses `found` and `name` — never `value`. Exposing secrets to the renderer process increases attack surface (XSS in settings page → key exfiltration).

**Fix applied:** Response now returns `{ found, name }` only — `value` is stripped in `main.js`.

---

### WR-01: Builtin provider dialog sends empty apiKey, backend rejects it ✅ FIXED

**Severity:** Warning · **File:** `src/settings-page.js` (`renderBuiltinList`), `main.js` (POST handler)

When the user clicks an unconfigured builtin provider in the dialog, `renderBuiltinList` sends `{ provider: p.id, apiKey: '' }` to the backend. The POST `/api/ai/providers` handler checks `!config.apiKey` (empty string is falsy) → returns 400. The dialog closes, `loadAISettings` runs, but the provider was never saved. User sees no error feedback.

**Fix applied:** Dialog click handler now closes the popup, temporarily adds the provider to the local list, and opens the editor form directly. No POST is sent until the user fills in the API Key and clicks Save.

---

### WR-02: `_getCatalog` caches rejected promise permanently ✅ FIXED

**Severity:** Warning · **File:** `ai-manager.js` (`_getCatalog`)

If `import('@earendil-works/pi-ai/providers/all')` fails (e.g., network issue during hot-reload, corrupted `node_modules`), `_catalogPromise` caches the rejection. All subsequent calls to `_getCatalog()` return the same rejected promise, breaking provider enumeration for the entire app lifetime.

**Fix applied:** `.catch()` handler clears `_catalogPromise = null` on rejection, allowing retry on next call.

---

### WR-03: `selectModel` updates UI before backend confirms ✅ FIXED

**Severity:** Warning · **File:** `src/renderer.js` (`selectModel`)

`selectModel` updates `aiModelsData` (local cache) and the button text optimistically, then sends the POST. If the request fails, the UI shows the new model but the backend still uses the old one. Next time the panel opens, `loadModelSelectorData` would revert the display, causing a confusing flip.

**Fix applied:** UI update (cache + button text) now happens only after the POST succeeds. Dropdown closes immediately regardless.

---

### WR-04: `ai/models` and `ai/providers` GET endpoints are duplicates ✅ FIXED

**Severity:** Warning · **File:** `main.js` (lines ~1106, ~1135)

Both `GET /api/ai/models` and `GET /api/ai/providers` call `aiManager.getAvailableModels()` and return the same `{ providers, activeProvider, activeModel }` structure. The renderer uses `/api/ai/providers`; the settings page also uses `/api/ai/providers`. The `/api/ai/models` endpoint appears to be dead code from the old single-provider UI.

**Fix applied:** Added DEPRECATED comment to `ai/models` endpoint. Kept for backward compatibility; new code should use `GET /api/ai/providers`.

---

### IN-01: `configureProviders` accepts empty `apiKey` for builtin providers

**Severity:** Info · **File:** `ai-manager.js` (`configureProviders`), `main.js` (POST handler)

The POST handler rejects empty `apiKey` (`!config.apiKey`), but if the check were ever relaxed (e.g., to support WR-01 fix option b), `configureProviders` would store `{ apiKey: '' }` and the provider would fail to initialize. Consider adding explicit validation in `configureProviders` itself as defense-in-depth:

```js
if (apiKey !== '__keep__' && !apiKey) {
  throw new Error('API Key 不能为空');
}
```

---

### IN-02: `detectModels` hardcoded provider URLs are a maintenance burden

**Severity:** Info · **File:** `ai-manager.js` (`detectModels`)

The function has a fallback chain of hardcoded URLs for 8 providers when the catalog doesn't provide a `baseURL`. These URLs will drift from provider APIs over time. The catalog (`_getCatalog`) should be the single source of truth for provider endpoints.

**Fix (future):** Ensure all builtin providers in pi-ai expose `baseURL` in their catalog entries, then remove the hardcoded fallback chain.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| Warning | 4 |
| Info | 2 |
| **Total** | **7** |

The critical finding (CR-01) is a security issue where API key values are unnecessarily exposed to the renderer process. The warnings cover UX bugs (WR-01 builtin dialog silent failure, WR-03 optimistic UI), reliability (WR-02 cached rejection), and code hygiene (WR-04 duplicate endpoints).

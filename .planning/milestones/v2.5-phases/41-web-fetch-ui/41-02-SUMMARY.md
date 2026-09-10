---
phase: 41-web-fetch-ui
plan: 02
subsystem: ui
tags: [electron, search, settings, ipc, http-api, preload]

# Dependency graph
requires:
  - phase: 41-web-fetch-ui
    plan: 01
    provides: search-manager.js with doSearch and Provider infrastructure
provides:
  - Search configuration IPC channels (search-config:get/set/verify-key)
  - Search configuration HTTP API (/api/search-config/*)
  - Search configuration preload API (searchConfig namespace)
  - Settings page "网络搜索" collapsible sub-section with Provider list and API Key editor
affects: [search-manager, settings-page, ai-manager]

# Actuals (#2632)
actuals:
  tokens: 25000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [search-config-ipc, search-config-http-api, collapsible-settings-section]

key-files:
  created: []
  modified:
    - package.json
    - ipc-handlers.js
    - src/preload.js
    - main.js
    - src/settings.html
    - src/settings-page.js
    - src/styles/main.css

key-decisions:
  - "Fixed duplicate jsdom entry in package.json (kept ^30.0.0)"
  - "Moved @mozilla/readability from devDependencies to dependencies (runtime requirement)"
  - "Used CSS class 'search-config-content' for initial hiding instead of inline style (CSP safe)"
  - "Implemented inline confirmation bar instead of window.confirm for overwrite protection"

patterns-established:
  - "Search config IPC pattern: assertTrustedSender + configStore.get/set for search.* keyspace"
  - "Search config HTTP API pattern: token auth + maskApiKeys for API key masking"
  - "Collapsible settings section pattern: CSS class + JS style.display toggle + state persistence"

requirements-completed: [CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "IPC channels for search config (get/set/verify-key)"
    requirement: CONFIG-04
    verification:
      - kind: other
        ref: "grep -c 'search-config' ipc-handlers.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "HTTP API for search config (/api/search-config/*)"
    requirement: CONFIG-01
    verification:
      - kind: other
        ref: "grep -c 'handleSearchConfigApi' main.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Preload API exposure (searchConfig namespace)"
    requirement: CONFIG-04
    verification:
      - kind: other
        ref: "grep -c 'searchConfig' src/preload.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Settings page search config UI with Provider list and API Key editor"
    requirement: CONFIG-02
    verification:
      - kind: other
        ref: "grep -c 'SEARCH_PROVIDERS' src/settings-page.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "API Key verification with inline results"
    requirement: CONFIG-03
    verification:
      - kind: other
        ref: "grep -c 'verifySearchKey' src/settings-page.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "Overwrite confirmation bar (not window.confirm)"
    requirement: CONFIG-03
    verification:
      - kind: other
        ref: "grep -c 'showConfirmBar' src/settings-page.js"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-27
status: complete
---

# Phase 41 Plan 02: Search Config UI Summary

**Search configuration IPC/HTTP/preload channels + settings page "网络搜索" sub-section with Provider list, API Key editor, verification, and overwrite confirmation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-27T04:16:09Z
- **Completed:** 2026-08-27T04:20:46Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added 3 IPC channels (search-config:get/set/verify-key) with assertTrustedSender security
- Added HTTP API routes (/api/search-config/*) with token auth and API key masking
- Exposed searchConfig API via preload (getConfig/setConfig/verifyKey)
- Built settings page "网络搜索" collapsible sub-section with 6 Provider list
- Implemented API Key verification with inline success/error results
- Added overwrite confirmation bar with 5-second auto-dismiss (no window.confirm)

## Task Commits

Each task was committed atomically:

1. **Task 1: npm dependencies + IPC/HTTP/preload channels** - `f9e8d99` (feat)
2. **Task 2: settings.html search config HTML structure** - `c6b88c1` (feat)
3. **Task 3: settings-page.js search config UI logic** - `1e88d7f` (feat)

## Files Created/Modified
- `package.json` - Fixed duplicate jsdom, moved @mozilla/readability to dependencies
- `ipc-handlers.js` - Added search-config:get/set/verify-key IPC channels + setSearchManager
- `src/preload.js` - Added searchConfig API namespace (getConfig/setConfig/verifyKey)
- `main.js` - Added /api/search-config/* HTTP routes + handleSearchConfigApi + maskApiKeys
- `src/settings.html` - Added "网络搜索" collapsible sub-section with Provider list and editor
- `src/settings-page.js` - Added search config UI logic (load/render/editor/verify/save/collapse)
- `src/styles/main.css` - Added provider-status, verify-result, search-confirm-bar styles

## Decisions Made
- Fixed duplicate jsdom entry in package.json (kept ^30.0.0, removed ^29.1.1)
- Moved @mozilla/readability from devDependencies to dependencies (runtime requirement for main process)
- Used CSS class 'search-config-content' for initial hiding (CSP safe, no inline style)
- Implemented inline confirmation bar instead of window.confirm for overwrite protection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate jsdom in package.json**
- **Found during:** Task 1
- **Issue:** package.json had two jsdom entries (^29.1.1 and ^30.0.0)
- **Fix:** Removed duplicate, kept newer ^30.0.0 version
- **Files modified:** package.json
- **Verification:** node -e check passes
- **Committed in:** f9e8d99 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed main.js import for setSearchManager**
- **Found during:** Task 1
- **Issue:** setSearchManager was not in destructured import from ipc-handlers
- **Fix:** Added setSearchManager to destructured import, fixed call site
- **Files modified:** main.js
- **Verification:** grep confirms setSearchManager is imported and called
- **Committed in:** f9e8d99 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Search config UI complete, ready for web_fetch tool integration
- Provider list displays 6 providers with status labels
- API Key verification works with inline results

---
*Phase: 41-web-fetch-ui*
*Completed: 2026-08-27*

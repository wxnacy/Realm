---
phase: 35-tab
plan: 01
subsystem: window-management
tags: [electron, multi-window, tab-cascade, window-close, dialog]

# Dependency graph
requires: []
provides:
  - tab-manager multi-window support (windowId field, activeTabs Map, per-window queries)
  - window close cascade with Tab destruction (closeWindowWithTabs)
  - active task confirmation dialog before window close
affects:
  - 35-02 (Tab drag between windows depends on windowId field)
  - 35-03 (Tab reorder within window)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "activeTabs Map<windowId, tabId> replaces single activeTabId for multi-window"
    - "closeWindowWithTabs with dependency injection (tabManager parameter) to avoid cross-module require"
    - "closing flag anti-recursion pattern for Electron close events"

key-files:
  created: []
  modified:
    - tab-manager.js
    - window-manager.js
    - main.js

key-decisions:
  - "activeTabs Map<windowId, tabId> replaces single activeTabId string for multi-window Tab tracking"
  - "closeWindowWithTabs accepts tabManager as dependency injection parameter (avoids cross-module require)"
  - "win.destroy() instead of win.close() to prevent close event recursion (Pitfall 1)"
  - "closing flag prevents re-entrant close handling"
  - "Legacy data compatibility: tabs without windowId default to null (main window)"

patterns-established:
  - "Per-window active Tab tracking via Map<windowId, tabId>"
  - "Window close cascade: destroy Tabs first, then window (D-16 order)"
  - "Dependency injection for cross-module dependencies in window-manager"

requirements-completed: [MW-05, MW-06]

# Coverage metadata
coverage:
  - id: D1
    description: "Tab object includes windowId field for window association"
    requirement: "MW-05"
    verification:
      - kind: other
        ref: "node -e verification script: createTab with windowId, getTabsByWindowId"
        status: pass
    human_judgment: false
  - id: D2
    description: "getTabsByWindowId returns correct Tab list per window"
    requirement: "MW-05"
    verification:
      - kind: other
        ref: "node -e verification script: getTabsByWindowId returns 1 tab for window 123"
        status: pass
    human_judgment: false
  - id: D3
    description: "closeTabsByWindowId closes all Tabs in a window"
    requirement: "MW-05"
    verification:
      - kind: other
        ref: "node -e verification script: closeTabsByWindowId returns empty after close"
        status: pass
    human_judgment: false
  - id: D4
    description: "activeTabs Map tracks per-window active Tab"
    requirement: "MW-05"
    verification:
      - kind: other
        ref: "node -e verification script: getActiveTab(windowId) returns correct tab"
        status: pass
    human_judgment: false
  - id: D5
    description: "closeWindowWithTabs cascades Tab destruction on window close"
    requirement: "MW-06"
    verification:
      - kind: integration
        ref: "npm run dev manual verification"
        status: unknown
    human_judgment: true
    rationale: "Window close cascade requires running Electron app to verify Tab webContents destruction and dialog interaction"
  - id: D6
    description: "Active task confirmation dialog shown before window close"
    requirement: "MW-06"
    verification:
      - kind: integration
        ref: "npm run dev manual verification with active download"
        status: unknown
    human_judgment: true
    rationale: "Requires active download in running app to test confirmation dialog flow"

# Metrics
duration: 1min
completed: 2026-08-15
status: complete
---

# Phase 35 Plan 1: Tab Management Refactor + Window Close Cascade Summary

**Multi-window Tab management with windowId association, per-window active Tab tracking, and cascading window close with active task confirmation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-08-15T05:37:33Z
- **Completed:** 2026-08-15T05:38:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Tab objects now include windowId field for multi-window association
- activeTabs Map<windowId, tabId> replaces single activeTabId for per-window active Tab tracking
- closeWindowWithTabs() implements cascading Tab destruction before window destroy (D-16)
- Active task detection with native confirmation dialog before window close (D-15)
- Full backward compatibility with legacy Tab data (no windowId defaults to null)

## Task Commits

Each task was committed atomically:

1. **Task 1: Tab Manager Multi-Window Refactoring** - `c473ccb` (feat)
2. **Task 2: Window Close Cascade + Active Task Confirmation** - `383f5d8` (feat)

## Files Created/Modified
- `tab-manager.js` - Multi-window Tab management (windowId, activeTabs Map, getTabsByWindowId, closeTabsByWindowId)
- `window-manager.js` - closeWindowWithTabs() for cascading window close
- `main.js` - setupWindowCloseHandler(), checkActiveTasks(), window:check-active-tasks IPC

## Decisions Made
- activeTabs Map<windowId, tabId> replaces single activeTabId string for multi-window Tab tracking
- closeWindowWithTabs accepts tabManager as dependency injection parameter (avoids cross-module require)
- win.destroy() instead of win.close() to prevent close event recursion (Pitfall 1)
- Legacy data compatibility: tabs without windowId default to null (main window)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tab-window association complete, ready for Phase 35-02 (Tab drag between windows)
- windowId field on Tab objects is the foundation for drag-and-drop window operations

---
*Phase: 35-tab*
*Completed: 2026-08-15*

## Self-Check: PASSED

All files and commits verified:
- 35-01-SUMMARY.md: FOUND
- tab-manager.js: FOUND
- window-manager.js: FOUND
- main.js: FOUND
- Commit c473ccb (Task 1): FOUND
- Commit 383f5d8 (Task 2): FOUND

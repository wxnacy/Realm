---
phase: 36-tab
plan: 02
subsystem: ui
tags: [dnd, html5-drag-and-drop, tab-reorder, accessibility]

requires:
  - phase: 35-tab
    provides: tab windowId tracking and tab-manager.js with multi-window support
provides:
  - Tab drag-and-drop reorder within a window
  - Chrome-style vertical insert indicator
  - tab:dnd-reorder IPC channel for main process sync
  - ARIA accessibility attributes on tab elements
affects: [36-tab, renderer.js, tab-manager.js, main.js]

tech-stack:
  added: []
  patterns: [html5-dnd-api, rAF-throttle, delegated-drag-events]

key-files:
  created: []
  modified:
    - src/renderer.js
    - src/styles/main.css
    - main.js
    - src/preload.js
    - tab-manager.js

key-decisions:
  - "HTML5 DnD API (dragstart/dragover/drop/dragend) for tab reorder, consistent with Phase 16 favorites reorder pattern"
  - "Chrome-style insert indicator: 2px vertical line with accent color and glow, absolutely positioned in tab-bar"
  - "rAF-based throttling for dragover (replaces setTimeout 16ms) ensures smooth 60fps indicator updates"
  - "Custom drag preview via cloneNode + setDragImage for better visual feedback"
  - "tab:dnd-reorder IPC channel separate from existing tab:reorder (group-based), broadcasts via tab:reordered for multi-window sync"

patterns-established:
  - "Tab DnD pattern: dragstart stores tabId in dataTransfer, dragover calculates insert position from mouse X vs tab midpoint, drop reorders state.tabs Map and DOM then syncs via IPC"
  - "Delegated drag events on tabList container (not per-tab) for dragover/drop, per-tab for dragstart/dragend"

requirements-completed: [MW-04]

coverage:
  - id: D1
    description: "Tab reorder via drag-and-drop within a single window"
    requirement: MW-04
    verification:
      - kind: manual_procedural
        ref: "Create 3+ tabs, drag first tab to third position, verify order updates"
        status: unknown
    human_judgment: true
    rationale: "Requires visual verification of drag indicator position and tab order after drop"
  - id: D2
    description: "Chrome-style vertical insert indicator during drag"
    requirement: MW-04
    verification:
      - kind: manual_procedural
        ref: "Drag tab slowly over other tabs, verify 2px indicator line appears at correct position"
        status: unknown
    human_judgment: true
    rationale: "Visual positioning accuracy requires human verification"
  - id: D3
    description: "Tab order persists across window focus changes"
    requirement: MW-04
    verification:
      - kind: manual_procedural
        ref: "Reorder tabs, switch to another app and back, verify tab order unchanged"
        status: unknown
    human_judgment: true
    rationale: "Requires manual window focus interaction"
  - id: D4
    description: "Tab order syncs to main process via tab:dnd-reorder IPC"
    requirement: MW-04
    verification:
      - kind: manual_procedural
        ref: "Reorder tabs, verify tabManager.getTabs() returns updated order"
        status: unknown
    human_judgment: true
    rationale: "Requires DevTools or console verification of main process state"

duration: 25min
completed: 2026-08-15
status: complete
---

# Plan 02: 窗口内 Tab 拖拽排序 Summary

**HTML5 DnD tab reorder with Chrome-style insert indicator, rAF throttling, and ARIA accessibility**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-15
- **Completed:** 2026-08-15
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Tab drag-and-drop reorder within a window using HTML5 DnD API
- Chrome-style 2px vertical insert indicator with accent color and glow shadow
- Main process tab order sync via `tab:dnd-reorder` IPC channel
- Custom drag preview with cloneNode + setDragImage
- rAF-based dragover throttling for smooth 60fps indicator updates
- ARIA accessibility: role="tab", aria-grabbed, aria-selected, aria-dropeffect
- Escape key cancellation and context menu suppression during drag

## Task Commits

Each task was committed atomically:

1. **Task 1: Tab 拖拽排序基础实现** - `6d72adc` (feat)
2. **Task 2: Tab 拖拽排序优化** - `4d7344e` (refactor)

## Files Created/Modified

- `src/renderer.js` - Tab DnD events, drag indicator management, rAF throttle, ARIA
- `src/styles/main.css` - .tab-drag-indicator, .tab.dragging styles, tab-bar position:relative
- `main.js` - tab:dnd-reorder IPC handler with broadcast to all windows
- `src/preload.js` - tabDndReorder API method
- `tab-manager.js` - reorderTabs(orderedIds) function

## Decisions Made

- HTML5 DnD API chosen over pointer events for consistency with Phase 16 favorites reorder
- Separate `tab:dnd-reorder` IPC channel from existing `tab:reorder` (group-based) to keep concerns separated
- rAF throttling over setTimeout 16ms for better frame alignment
- Indicator positioned via absolute left coordinate in tabBar (position:relative added)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Tab reorder within single window complete (MW-04 partial)
- Ready for Phase 36 Plan 03: cross-window tab drag and position persistence
- Multi-window sync via existing `tab:reordered` broadcast mechanism is already in place

---
*Plan: 36-02*
*Completed: 2026-08-15*

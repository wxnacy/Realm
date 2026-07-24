---
status: diagnosed
trigger: "UAT Phase 02 Test 8: 蓝色进度条没有显示在URL输入框下边，而是出现在左边侧边栏的下边"
created: 2026-07-24T00:00:00Z
updated: 2026-07-24T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — .loading-bar is position:absolute but no ancestor (toolbar / main-content / body / html) establishes a containing block, so it resolves against the viewport (initial containing block) and pins to the window's bottom-left edge
test: static analysis of DOM chain + CSS rules for every ancestor
expecting: all ancestors position:static → containing block = viewport → bottom:0/left:0 = window bottom edge
next_action: return diagnosis (goal: find_root_cause_only — fix handled by plan-phase --gaps)

## Symptoms

expected: 蓝色加载进度条显示在 URL 输入框下方（2px 高度，加载完成后自动消失）
actual: 蓝色进度条没有显示在URL输入框下边，而是出现在左边侧边栏的下边
errors: None reported
reproduction: UAT Phase 02 Test 8 — 加载页面时观察进度条的位置
started: Discovered during UAT retest (2026-07-24), after webviewTag fix landed

## Eliminated

- hypothesis: Progress bar appended to wrong DOM parent (e.g., inside sidebar)
  evidence: src/index.html:117 — `<div class="loading-bar" id="loadingBar"></div>` is the last child of `.toolbar` (lines 65-118), which lives inside `.main-content` (line 40). DOM placement is correct.
  timestamp: 2026-07-24
- hypothesis: JavaScript reparents or repositions the element at runtime
  evidence: src/renderer.js:30,417-433,490-501 — loadingBar is only ever class-toggled (`active` / `complete`); never appendChild'd, never given inline styles. No geometry manipulation.
  timestamp: 2026-07-24

## Evidence

- timestamp: 2026-07-24
  checked: src/index.html DOM structure
  found: `#loadingBar.loading-bar` (line 117) is child of `.toolbar` (65-118) → child of `.main-content` (40-138) → child of `body` (9). Sidebar (`aside.sidebar`, line 11) is a SIBLING of main-content, not an ancestor.
  implication: DOM parent is correct; the bug must be in CSS containing-block resolution.

- timestamp: 2026-07-24
  checked: src/styles/main.css:1003-1012 (.loading-bar rule)
  found: `position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; background-color: var(--accent-color)` — --accent-color = #3B82F6 (blue, line 17). `.active` class (1014-1017) runs `loading-progress` keyframe animating width 0%→80%→100% (1019-1029).
  implication: absolutely positioned element needs a positioned ancestor to anchor to the toolbar.

- timestamp: 2026-07-24
  checked: position property of every ancestor — .toolbar (main.css:183-192), .main-content (175-180), body (48-55); grep for all `toolbar` / `main-content` / `body` rules in the file
  found: NONE of the ancestors declare `position` (all static). Only one .toolbar rule exists; no media-query overrides. html is default static.
  implication: With no positioned ancestor, an absolutely positioned element's containing block = initial containing block (viewport). bottom:0; left:0; width:100% → 2px bar across the bottom edge of the entire WINDOW.

- timestamp: 2026-07-24
  checked: correlation with user report
  found: Bar pinned to viewport bottom-left, growing rightward from x=0 during the width animation → visually appears at the bottom edge under the left sidebar ("左边侧边栏的下边"). Matches report exactly.
  implication: Geometry prediction from CSS matches observed symptom — hypothesis confirmed.

- timestamp: 2026-07-24
  checked: show/hide logic correctness
  found: renderer.js:417-433 — did-start-loading adds .active (opacity 1 + animation), did-stop-loading swaps to .complete (fade-out). Toggle logic is correct; only geometry is wrong.
  implication: Fix is purely CSS; no JS changes needed for this gap.

## Resolution

root_cause: ".loading-bar (main.css:1003-1012) is `position: absolute; bottom: 0; left: 0`, intended to anchor to the toolbar's bottom edge (under the URL input). But its containing block resolves to the VIEWPORT because no ancestor establishes one: .toolbar (main.css:183-192), .main-content (main.css:175-180), and body (main.css:48-55) are all position:static. The bar therefore pins to the bottom-left of the window — directly below the left sidebar — instead of under the URL input."
fix: "(deferred to plan-phase --gaps) Add `position: relative;` to .toolbar in src/styles/main.css:183 so the toolbar becomes the containing block for .loading-bar. One-line CSS change; no JS or HTML changes required."
verification: "(pending — to be verified after gap-closure fix lands; reload a page and confirm the 2px blue bar renders along the toolbar bottom edge under the URL input, then disappears)"
files_changed: []

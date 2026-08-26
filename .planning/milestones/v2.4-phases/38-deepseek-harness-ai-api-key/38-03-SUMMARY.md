# Plan 03 — Chat Panel Toolbar + Model Selector

**Status:** COMPLETE
**Phase:** 38-deepseek-harness-ai-api-key
**Plan:** 03
**Wave:** 2

## Summary

Added a toolbar to the AI chat panel bottom with new conversation button, model selector (cross-provider grouped dropdown), and send button (migrated from input area). Model selection activates the corresponding provider.

## Changes

### src/index.html
- Restructured `.ai-input-area`: moved send button from input wrapper to new toolbar div
- Added toolbar DOM: new chat button, spacer, model selector button, send button
- Model selector shows current model name with ▾ arrow

### src/renderer.js
- Added element references: `aiToolbar`, `aiNewChatBtn`, `aiModelSelector`
- Added functions:
  - `handleNewConversation()` — clears message list, resets streaming state, clears context pills
  - `loadModelSelectorData()` — fetches from `/api/ai/providers` endpoint
  - `updateModelSelectorButton()` — shows current model name (truncated at 15 chars)
  - `toggleModelDropdown()` / `openModelDropdown()` / `closeModelDropdown()` — dropdown lifecycle
  - `handleModelDropdownOutsideClick()` — click-outside-to-close
  - `renderModelDropdown()` — renders grouped dropdown by provider
  - `selectModel(providerId, modelId)` — updates UI + calls POST `/api/ai/providers`
  - `handleModelSelectorKeydown()` — ArrowUp/Down/Enter/Esc keyboard navigation
- Added event listeners for toolbar buttons
- Loads model selector data when AI panel opens

### src/styles/main.css
- `.ai-toolbar` — 44px height, flex layout, bg-secondary, border-top
- `.ai-new-chat-btn` — icon + text, 13px
- `.ai-model-selector` — max-width 200px, text-overflow ellipsis
- `.ai-model-dropdown` — absolute positioned, max-height 320px, grouped by provider
- `.ai-model-group-title` — 12px/600, text-muted
- `.ai-model-option` — 36px height, hover/active states, accent-color dot

## Verification
- index.html has toolbar DOM ✓
- renderer.js has all required functions ✓
- CSS has all required styles ✓

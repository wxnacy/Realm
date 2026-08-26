# Plan 02 — Settings Page Provider Management UI

**Status:** COMPLETE
**Phase:** 38-deepseek-harness-ai-api-key
**Plan:** 02
**Wave:** 1

## Summary

Refactored settings page AI assistant section into a left-right split layout with provider list management, edit form, environment variable detection, model detection, and builtin provider selection dialog.

## Changes

### src/settings.html
- Replaced single-provider combobox with split layout:
  - Left sidebar (280px): search input, provider list, add builtin/custom buttons
  - Right editor (flex:1): empty state, edit form (name, API Key, env var name, model tags, detect/delete/save)
- Added builtin provider selection dialog (`<dialog>` element)

### src/settings-page.js
- Rewrote AI settings section with new functions:
  - `loadAISettings()` — loads from `/api/ai/providers` endpoint
  - `renderProviderList()` — renders provider list with search filtering
  - `showEditorEmpty()` / `showEditorForm()` — toggle empty/edit states
  - `renderModelTags()` — renders model tag list with × remove buttons
  - `saveProviderConfig()` — saves to `/api/ai/providers` with extended fields
  - `deleteProvider()` — confirmation dialog then DELETE API
  - `detectModels()` — calls detect-models API with loading state
  - `showBuiltinProviderDialog()` / `renderBuiltinList()` — builtin provider dialog
- Environment variable auto-detection on provider selection and envVarName change

### src/styles/main.css
- Added 300+ lines of CSS for split layout, provider list items, form groups, model tags, env var hints, builtin dialog

## Verification
- settings.html has all required elements ✓
- settings-page.js has all required functions ✓
- CSS has all required styles ✓

# Plan 01 — Multi-provider Data Model + Env Var Detection + Provider Save API

**Status:** COMPLETE
**Phase:** 38-deepseek-harness-ai-api-key
**Plan:** 01
**Wave:** 1

## Summary

Extended ai-manager.js to support multi-provider parallel configuration with environment variable detection, model detection via API, and provider CRUD operations. Added 5 new HTTP API endpoints to main.js.

## Changes

### ai-manager.js
- Added `PROVIDER_ENV_MAP` constant with 15 provider→environment variable mappings
- Added `detectEnvVar(providerId, customEnvVarName)` method — returns `{found, name, value}`
- Added `detectModels(providerId, apiKey, baseURL)` method — calls provider `/models` API with 10s timeout
- Added `removeProvider(providerId)` method — hard deletes provider config, clears activeProvider if needed
- Extended `configureProviders()` — accepts envVarName, customModels, isBuiltin, baseURL, displayName; handles `__keep__` apiKey sentinel
- Extended `getAvailableModels()` — returns envVarName, isBuiltin, customModels per provider; includes custom providers
- Updated `_migrateLegacyConfig()` — migration includes isBuiltin: true, envVarName: 'OPENAI_API_KEY'

### main.js
- `GET /api/ai/providers` — returns configured provider list with envVarName, isBuiltin
- `POST /api/ai/providers` — saves provider configuration (extended fields)
- `DELETE /api/ai/providers/:id` — hard deletes provider
- `POST /api/ai/providers/:id/detect-models` — calls provider models API
- `GET /api/ai/providers/:id/env-var` — detects environment variable

## Verification
- PROVIDER_ENV_MAP contains 15 provider mappings ✓
- All new HTTP endpoints return correct JSON structures ✓
- Logging coverage: ≥5 [Realm AI] log statements ✓

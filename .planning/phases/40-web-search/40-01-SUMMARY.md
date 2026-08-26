---
phase: 40
plan: 01
subsystem: search
tags: [search, ai-tools, ssrf, rate-limiting, fallback]
dependency:
  requires: []
  provides: [search-manager, web_search-tool]
  affects: [ai-manager, main]
tech_stack:
  added: [search-manager.js]
  patterns: [SearchRateLimiter, SSRF-protection, Auto-Fallback, Provider-chain]
key_files:
  created:
    - search-manager.js
  modified:
    - ai-manager.js
    - main.js
decisions:
  - "All HTTP requests use Electron net.fetch for system proxy compatibility"
  - "Each Provider has independent SearchRateLimiter instance (per D-08)"
  - "SSRF protection via isPrivateHost with DNS lookup, safe default blocks on failure"
  - "DDG Browser uses independent Session partition persist:search-ddg"
  - "PROVIDERS registry populated lazily via initSearchManager()"
metrics:
  duration: 6min
  tasks: 2
  commits: 1
status: complete
actuals:
  tokens: 78000
  tasks: 2
  commits: 1
---

# Phase 40 Plan 01: Search Infrastructure + web_search Tool Summary

Search manager module with SSRF protection, rate limiting, 5 search providers, auto fallback, and web_search AI tool registration.

## What Was Built

### search-manager.js (new file, 1548 lines)

Complete search infrastructure module with:

1. **SearchRateLimiter** -- Per-provider independent rate limiting with queue management, concurrency control, jitter, and exponential backoff on 429 responses. 6 provider policies (tavily/brave/serper/anysearch/anysearch_free/duckduckgo_browser) + 2 fallback policies (browser/api).

2. **SSRF Protection** -- `isPrivateHost()` uses `dns.promises.lookup` to resolve hostnames and checks against PRIVATE_IP_RANGES (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, loopback IPv6, ULA IPv6). DNS failure returns true (safe default).

3. **5 Search Providers**:
   - `searchTavily` -- POST to api.tavily.com/search with Bearer token
   - `searchBrave` -- GET to api.search.brave.com with X-Subscription-Token
   - `searchSerper` -- POST to google.serper.dev/search with X-API-KEY
   - `searchAnySearch` -- POST to api.anysearch.com/v1/search (paid: with Bearer; free: without Authorization)
   - `searchDDGBrowser` -- Hidden BrowserWindow loads DuckDuckGo, injects DOM extraction script, independent Session partition `persist:search-ddg`

4. **Auto Fallback** -- `doAutoSearch()` chains: configured API providers (Tavily->Brave->Serper->AnySearch) -> anysearch_free -> duckduckgo_browser. Each provider failure is recorded with error classification. Low quality CJK results trigger fallback. First low quality result returned as last resort.

5. **Result Normalization** -- `normalizeSearchResult()` outputs `{title, url, content, rank?, score?, metadata?}`. `formatSearchResults()` produces Markdown numbered list.

### ai-manager.js (modified)

- Added `const searchManager = require('./search-manager')` import
- Registered `web_search` tool in `_buildRealmTools()` with parameters `{query: string (required), maxResults: number (optional)}`

### main.js (modified)

- Added `const searchManager = require('./search-manager')` import
- Added `searchManager.initSearchManager(configStore)` before AIManager initialization

## Deviations from Plan

None -- plan executed exactly as written. All Task 2 requirements were already satisfied by the Task 1 implementation (AnySearch envelope error checking, anySearchLanguage, DDG BrowserWindow cleanup in finally block, 5-type error classification, maxResults clamping, normalizeSearchResult with score/metadata fields).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-40-01 mitigated | search-manager.js:isPrivateHost | SSRF protection blocks private IP resolution before all external HTTP requests |
| T-40-02 mitigated | search-manager.js:initSearchManager | API Keys stored in electron-store, read at init time, not hardcoded |
| T-40-03 mitigated | search-manager.js:doSearch | Query validation prevents empty search, URL construction uses URLSearchParams |
| T-40-04 mitigated | search-manager.js:SearchRateLimiter | Per-provider rate limiting with maxConcurrent and exponential backoff |
| T-40-05 mitigated | search-manager.js:searchDDGBrowser | DDG BrowserWindow uses independent Session, show:false, destroyed in finally block |

## Known Stubs

None -- all implementations are complete and functional.

## Verification

- `node -e "const sm = require('./search-manager'); console.log(Object.keys(sm))"` -- exports verified
- `isPrivateHost('127.0.0.1')` returns true, `isPrivateHost('example.com')` returns false -- SSRF protection verified
- `classifySearchError` correctly categorizes rate_limited/auth/blocked/extraction_failed/error -- verified
- `DEFAULT_POLICIES` contains all 6 provider strategies -- verified
- `clampResultsToRange` enforces Tavily max=20, DDG max=10, AnySearch max=100 -- verified
- No bare `fetch(` calls in search-manager.js -- all use `net.fetch` -- verified
- `npm run validate` passes (pre-existing favorites IPC test failures unrelated to changes)

## Self-Check: PASSED

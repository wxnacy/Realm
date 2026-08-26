# API Coverage — 搜索 Provider 体系 (Tavily / Brave / Serper / AnySearch / DDG)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

| capability | decision | reason |
|---|---|---|
| tavily.search | INTEGRATE | |
| brave.search | INTEGRATE | |
| serper.search | INTEGRATE | |
| anysearch.search | INTEGRATE | |
| anysearch_free.search | INTEGRATE | |
| duckduckgo_browser.search | INTEGRATE | |
| tavily.list_models | OPT-OUT | not needed — search API 无模型概念，仅需 query+maxResults |
| brave.list_models | OPT-OUT | not needed — 同上 |
| serper.list_models | OPT-OUT | not needed — 同上 |
| anysearch.list_models | OPT-OUT | not needed — 同上 |
| anysearch.verify_key | OPT-OUT | deferred to Phase 41 (CONFIG-03: API Key 验证) |
| brave.verify_key | OPT-OUT | deferred to Phase 41 (CONFIG-03: API Key 验证) |
| serper.verify_key | OPT-OUT | deferred to Phase 41 (CONFIG-03: API Key 验证) |
| tavily.verify_key | OPT-OUT | deferred to Phase 41 (CONFIG-03: API Key 验证) |

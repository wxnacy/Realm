---
phase: 41-web-fetch-ui
plan: 01
subsystem: ai-tools
tags: [web_fetch, ssrf, readability, turndown, jsdom, net-fetch]

requires:
  - phase: 40-web-search
    provides: search-manager.js isPrivateHost SSRF 防护
provides:
  - fetchUrl() 网页内容抓取函数
  - htmlToMarkdown() HTML→Markdown 转换函数
  - web_fetch AI 工具注册
affects: [41-02-search-config-ui]

actuals:
  tokens: 1735
  tasks: 2
  commits: 3

tech-stack:
  added: [jsdom, turndown, @mozilla/readability]
  patterns: [逐跳SSRF防护重定向循环, Content-Type自动判断, Readability+turndown管线]

key-files:
  created: []
  modified: [search-manager.js, ai-manager.js]

key-decisions:
  - "截断标记中需保存原始长度再截断（Rule 1 bug fix）"
  - "turndown 去噪列表: script/style/nav/footer/aside"

patterns-established:
  - "fetchUrl SSRF 模式: redirect:manual + 逐跳 isPrivateHost 校验"
  - "htmlToMarkdown 管线: jsdom → Readability → turndown"

requirements-completed: [FETCH-01, FETCH-02, FETCH-03, FETCH-04]

coverage:
  - id: D1
    description: "search-manager.js 新增 fetchUrl + htmlToMarkdown 函数并导出"
    requirement: FETCH-01
    verification:
      - kind: other
        ref: "node -e \"const sm = require('./search-manager'); console.log(typeof sm.fetchUrl, typeof sm.htmlToMarkdown)\""
        status: pass
    human_judgment: false
  - id: D2
    description: "ai-manager.js 注册 web_fetch 工具"
    requirement: FETCH-01
    verification:
      - kind: other
        ref: "node -e \"const AM = require('./ai-manager'); const am = new AM(); const tools = am._buildRealmTools(); console.log(tools.some(t => t.name === 'web_fetch'))\""
        status: pass
    human_judgment: false
  - id: D3
    description: "SSRF 防护：isPrivateHost 逐跳校验 + redirect:manual"
    requirement: FETCH-04
    verification:
      - kind: other
        ref: "grep -c isPrivateHost search-manager.js (>=3) && grep -c 'redirect.*manual' search-manager.js (>=1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "HTML→Markdown 管线: jsdom + Readability + turndown"
    requirement: FETCH-03
    verification:
      - kind: other
        ref: "grep -c 'JSDOM\\|Readability\\|TurndownService' search-manager.js (>=3)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-27
status: complete
---

# Phase 41 Plan 01: web_fetch 工具后端管线 Summary

**fetchUrl 网页抓取 + htmlToMarkdown 转换管线，SSRF 逐跳防护，web_fetch AI 工具注册**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-27T04:01:00Z
- **Completed:** 2026-08-27T04:09:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- search-manager.js 新增 fetchUrl() 和 htmlToMarkdown() 两个函数，支持 HTML/JSON/纯文本三种内容类型
- SSRF 防护复用 isPrivateHost，重定向逐跳校验（redirect: 'manual' + MAX_REDIRECTS=5）
- ai-manager.js 的 _buildRealmTools() 注册 web_fetch 工具，参数 url（必填）+ maxLength（可选默认 12000）
- 修复截断逻辑 bug：模板字符串中 text.length 在 slice 后引用错误

## Task Commits

Each task was committed atomically:

1. **Task 1: search-manager.js — fetchUrl + htmlToMarkdown 实现** - `9d77ea1` (feat)
2. **Task 2: ai-manager.js — web_fetch 工具注册** - `7f7aa8b` (feat)
3. **Bug fix: 截断逻辑修复** - `f1104fe` (fix)

## Files Created/Modified
- `search-manager.js` - 新增 jsdom/turndown/readability imports、FETCH_TIMEOUT_MS/MAX_REDIRECTS/FETCH_DEFAULT_MAX_LENGTH 常量、htmlToMarkdown() 函数、fetchUrl() 函数、模块导出
- `ai-manager.js` - 在 _buildRealmTools() 末尾注册 web_fetch 工具定义

## Decisions Made
- 截断标记中需先保存原始长度再执行 slice，避免模板字符串引用已截断的长度
- turndown 去噪列表: script/style/nav/footer/aside（Readability 已去噪，turndown 再保险）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 截断逻辑中 text.length 引用错误**
- **Found during:** Task 1 实现后验证
- **Issue:** `text.slice(0, maxLength)` 之后模板字符串中 `${text.length}` 引用的是已截断文本的长度（等于 maxLength），而非原始长度
- **Fix:** 在 slice 前保存 `const originalLength = text.length`
- **Files modified:** search-manager.js
- **Verification:** 代码审查确认
- **Committed in:** f1104fe

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 修复截断标记显示错误长度的问题，必要修复。

## Issues Encountered
None

## User Setup Required
None - 无需外部服务配置。

## Known Stubs
None - fetchUrl 和 htmlToMarkdown 是完整的实现，无 stub。

## Next Phase Readiness
- web_fetch 后端管线完成，AI 可调用 fetchUrl 抓取网页内容
- Plan 02（搜索配置 UI）可开始：search-manager.js 已就绪，需在 settings-page.js 新增 UI

---
*Phase: 41-web-fetch-ui*
*Completed: 2026-08-27*

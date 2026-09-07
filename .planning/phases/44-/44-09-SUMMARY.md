---
phase: 44-player-video-cache-and-local-media-library
plan: 09
subsystem: media-player
tags: [hls, proxy, webview, electron, m3u8, record-ui]

# Dependency graph
requires:
  - phase: 44-player-video-cache-and-local-media-library
    provides: /proxy 分片缓存链路（44-01）、独立窗口 localhost 化（44-02）、录制引擎与录制按钮 UI（44-04/44-05）
provides:
  - webview tab 播放器直连拉流（proxiedUrl 守卫仅 isIndependentMode），D-01 用户锁定行为落地
  - G-44-2b 随直连消失：webview 流量不再产生空索引 meta，cacheEnabled 登记门槛留存为防回归护栏
  - 录制进行中工具栏按钮停止方块图标（icon-stop + updateRecordUi 双图标切换）
affects: [44-verify, media-sniffer, player-cache]

# Actuals (#2632)
actuals:
  tokens: 400      # chars/4 over realized diff（4 files, 14+/10-）
  tasks: 2
  commits: 2       # MEASURED: git rev-list --count 3ced9b88..HEAD

# Tech tracking
tech-stack:
  added: []
  patterns: [proxiedUrl 传输层守卫按 mode=independent 收敛, 双 svg + display:none 图标切换模式复用]

key-files:
  created: []
  modified:
    - src/player.js
    - src/player.html
    - main.js
    - docs/product/navigation-entry-points.md

key-decisions:
  - "webview tab 播放器直连拉流（D-01），独立窗口独占 /proxy 与分片缓存链路"

patterns-established:
  - "传输层守卫模式：proxiedUrl 按 mode=independent 收敛，/proxy 与分片缓存仅独立窗口链路"

requirements-completed: [D-01, D-03, D-21]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: webview tab 模式播放器直连拉流（proxiedUrl 返回原始 URL，不经 /proxy）；独立窗口 mode=independent 仍改写为 /proxy URL（token/container/referer/cache 透传不变）（G-44-2）
    requirement: D-01
    verification:
      - kind: unit
        ref: "command:grep -A5 'function proxiedUrl' src/player.js（守卫仅含 isIndependentMode，无 isWebviewMode 残留）"
        status: pass
      - kind: integration
        ref: "tests/test-unified-navigation.js（32 项断言全绿，maybePlayerUrl 包装链路零回归）"
        status: pass
    human_judgment: true
    rationale: "真实源站 m3u8 在 webview tab 内直连播放、可被识别为多媒体（UAT 第 2 项）需人工在真机播放验证——hls.js 对直连清单的运行时行为无法用静态/单测断言"
  - id: D2
    description: G-44-2b 随直连消失：webview 流量不再进入 /proxy 不再登记空索引 meta；m3u8 清单登记保持 cacheEnabled 门槛（防回归护栏）
    requirement: D-03
    verification:
      - kind: unit
        ref: "command:grep -q 'if (cacheEnabled && mediaCache) {' main.js（登记门槛断言通过）"
        status: pass
      - kind: integration
        ref: "tests/test-media-cache.js（回归全绿，handleProxyRequest 未动）"
        status: pass
    human_judgment: false
  - id: D3
    description: 录制进行中工具栏按钮显示停止方块图标（icon-stop 缺省 display:none，updateRecordUi 双图标显隐切换），停止后恢复描边圆点（G-44-4a）
    requirement: D-21
    verification:
      - kind: unit
        ref: "command:grep -c 'icon-stop' src/player.html + grep -A6 'function updateRecordUi' src/player.js（iconStop 显隐切换断言通过）"
        status: pass
    human_judgment: true
    rationale: "图标视觉语义（录制中方块可辨识、与红点配合）需人工目检播放器 UI（UAT 第 4 项）"

# Metrics
duration: 2min
completed: 2026-09-07
status: complete
---

# Phase 44 Plan 09: G-44-2/2b/4a Gap Closure Summary

**webview tab 播放器直连拉流（D-01，仅独立窗口走 /proxy）、G-44-2b 空索引 meta 副作用随直连消失并留存 cacheEnabled 护栏、录制按钮新增停止方块图标**

## Performance

- **Duration:** 2min
- **Started:** 2026-09-07T06:15:53Z
- **Completed:** 2026-09-07T06:18:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- G-44-2（major）修复：`proxiedUrl` 守卫从 `isWebviewMode` 改为 `isIndependentMode`——webview tab 模式播放器直连拉流（hls.js 直接请求源站 m3u8），仅独立播放器窗口（mode=independent）经 /proxy；死变量 `isWebviewMode` 删除，传输层注释改写为双语义
- G-44-2b 处置：webview 回归直连后其流量不再进入 /proxy，空索引 meta 副作用自然消失；断言 main.js m3u8 清单登记的 `if (cacheEnabled && mediaCache) {` 门槛仍存在，作为「即使未来 webview 复用 /proxy 也不会登记空索引」的防回归护栏
- G-44-4a 修复：btn-record 新增 `icon-stop` 停止方块 svg（缺省 display:none，与 icon-play/icon-pause 双图标切换同款模式）；`updateRecordUi` 对称切换 iconRecord/iconStop 显隐——录制中按钮显示停止图标不再空白，红点/IPC 链路/title 未触碰

## Task Commits

Each task was committed atomically:

1. **Task 1: G-44-2/2b — webview tab 播放器直连（proxiedUrl 仅独立窗口走 /proxy）** - `5716f7a` (fix)
2. **Task 2: G-44-4a — 录制按钮停止图标（icon-stop + updateRecordUi 双图标切换）** - `0216cc9` (fix)

## Files Created/Modified
- `src/player.js` - proxiedUrl 守卫改 isIndependentMode、isWebviewMode 删除、iconStop 引用与 updateRecordUi 双图标切换
- `src/player.html` - btn-record 内新增 icon-stop 停止方块 svg
- `main.js` - will-navigate m3u8 分支注释同步直连语义（零逻辑变更）
- `docs/product/navigation-entry-points.md` - §五 补直连说明

## Decisions Made
- webview tab 播放器直连拉流（D-01 用户 UAT 锁定）：像网页自身播放一样直接访问源站，防盗链/Cookie 由 webview 容器 session 天然携带；独立窗口独占 /proxy 与分片缓存链路

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G-44-2/2b/4a 三个 gap 闭合，phase 44 剩余 gap（G-44-4b/5/7/8/9）由 44-10~44-13 承接
- 人工复测项（UAT 第 2/4 项：webview 直连 m3u8 识别、独立窗口缓存/续播/录制不回归、停止图标目检）留待 phase 收尾 UAT 批量执行

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-07*

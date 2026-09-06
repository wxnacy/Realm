---
phase: 44-player-video-cache-and-local-media-library
plan: 06
subsystem: media
tags: [proxy-cache, cache-hit-priority, cr-01, cr-05, wr-06, stream-error, hls-retry, node-stream]

# Dependency graph
requires:
  - phase: 44-01
    provides: handleProxyRequest 分片缓存分支（lookup/store tee 集成位）、media-cache-manager（store/lookup/storeBuffer）
  - phase: 44-03
    provides: mediaCache 主进程实例 + buildMediaCacheOptions（cacheDir/cacheMaxGB/isVideoActive 注入）
  - phase: 44-05
    provides: updatePlaylistIndex 登记的 playlist_order segKey（resolveUri(uri, m3u8 最终 URL)）——target 缓存 key 与其同源，转封装顺序不受影响
provides:
  - handleProxyRequest pre-fetch 命中分支：缓存 key 统一为请求 URL（target），命中读盘直返不回源（CR-01）——「重开秒开不重复回源」D-05 与「断网已缓存分片照播」D-10 生产路径成立
  - media-cache-manager store() 源流 'error' 监听（pipe 前挂载，destroy 双 tee + warn）+ main.js 透传分支同款防护（CR-05）——源站 RST 不再 uncaught 崩主进程
  - lookup()/storeBuffer contentType 附加字段回放契约（命中响应 Content-Type 与落盘一致，缺省 octet-stream）
  - src/player.js FRAG_LOADED → state.hlsRetryCount = 0（WR-06）——D-10 降级重试同会话可持续生效
  - tests/test-media-cache.js +2 条 CR-05 单测（error 源不崩 + tee 收 error；contentType 落盘-回放闭环）
affects: [44-VERIFICATION（CR-01/CR-05 修复后 human_verification 第 1/3 项真机复测：秒开体感、断网降级）]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 3510
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node 流契约：source 'error' 无监听 → uncaught → 主进程退出；store() 在首个 pipe 之前挂 readable.on('error')，destroy(err) 异步派发与集成层 tee.on('error') 同步挂载无竞态"
    - "缓存命中优先路径：lookup(key=请求 URL target) 在 ses.fetch 之前，命中 writeHead(200, Content-Length=hit.size, no-store)+end(hit.data)+return；Range/m3u8-likely 请求显式排除"
    - "contentType 附加字段向后兼容（落盘时登记 ≤200 字符，命中回放，缺字段不升 META_VERSION，转封装读路径不消费）"

key-files:
  created: []
  modified:
    - main.js
    - media-cache-manager.js
    - src/player.js
    - tests/test-media-cache.js

key-decisions:
  - "缓存 key 统一为请求 URL（target），废弃重定向后 finalUrl 做 key：finalUrl 只有回源后才能得知，命中优先下无法用作查询 key；target 与 44-05 updatePlaylistIndex 登记的 segKey（resolveUri(uri, 清单最终 URL)）在分片请求上同源（rewrite 输出的 /proxy?url= 即 resolveUri 结果），转封装顺序索引不回归"
  - "旧 finalUrl-key 存量孤儿条目不做迁移：键不再被查询，由 44-07 CR-02 修复后容量淘汰按 total_size 正常回收（缓存非持久资产，接受此代价）"
  - "m3u8 响应仍走 rewrite 清单分支不被命中优先截走：URL 层 /\.m3u8(\?|$)/i 预判 + Range 请求排除；伪装 m3u8 的 URL 因旧实现从未落盘必然 miss，行为不变"
  - "hlsRetryCount 复位事件选 FRAG_LOADED（分片数据到达 = 最精确的「网络恢复」信号）而非 LEVEL_LOADED（直播刷新/清单级也触发，粒度不足）"
  - "WR-06 复位逻辑是 src/player.js 禁改例外的必须项（CR-01 断网照播 missing 点名要求一并修复），改动仅限 hls 区块新增一个 FRAG_LOADED 监听，不触碰双模式判定/缓存模式逻辑"

patterns-established:
  - "集成层 tee 收尾契约：store() 内部源流 error → passthrough.destroy(err) → 集成层 tee.on('error') → res.end()（不悬挂连接），播放器侧拿到截断响应走自身重试链路"
  - "源码顺序 gate 可断言模式：mediaCache.lookup(target 行号 < ses.fetch(target 行号；main.js 全文无 lookup(finalUrl/store(finalUrl 字面（注释纪律同步遵守，防注释命中误判）"

requirements-completed: [D-03, D-05, D-10]

coverage:
  - id: C1
    description: "CR-01 命中优先：handleProxyRequest pre-fetch 分支（key=请求 URL target，命中 writeHead 200 + Content-Length=hit.size + no-store + end(hit.data) + return 不触达 ses.fetch）；分片分支移除二次 lookup 只留未命中 tee；Range/m3u8-likely 显式排除"
    requirement: D-03
    verification:
      - kind: other
        ref: "node --check main.js && ! grep -E 'lookup\\(finalUrl|store\\(finalUrl' main.js && lookup(target)行(363) < ses.fetch(target)行(382)"
        status: pass
      - kind: unit
        ref: "node tests/test-media-cache.js（15 既有全绿，本任务不改 manager）"
        status: pass
    human_judgment: false
  - id: C2
    description: "CR-05 源流 error 防护 + contentType 回放：store() pipe 前 readable.on('error') destroy 双 tee + warn；lookup 命中扩展 contentType（≤200 字符登记才回放）；storeBuffer 登记可选 contentType；main.js 透传分支同款 .on('error') 防护；新增 2 条单测"
    requirement: D-05
    verification:
      - kind: unit
        ref: "node tests/test-media-cache.js（17/17：15 既有 + 2 新增 CR-05）"
        status: pass
      - kind: other
        ref: "源码断言：store() 内 readable.on('error' 先于首个 readable.pipe(；main.js Readable.fromWeb(resp.body) 后紧跟 .on('error'；node -e require('./media-cache-manager') 输出 pure-node ok"
        status: pass
    human_judgment: false
  - id: C3
    description: "WR-06 hlsRetryCount 复位：hls 分支 FRAG_LOADED 监听将 state.hlsRetryCount 置 0（瞬时错误 → startLoad 重试成功 → 计数归零，同会话多次瞬时错误均可恢复）；ERROR 阈值逻辑/双模式判定未触碰"
    requirement: D-10
    verification:
      - kind: unit
        ref: "node --check src/player.js && FRAG_LOADED 邻近 4 行内含 hlsRetryCount = 0（grep -A4 计数 ≥1）"
        status: pass
    human_judgment: false
  - id: H1
    description: "真机复测（44-VERIFICATION human_verification 第 1/3 项，CR-01 修复后）：重开已看视频已看部分立即起播无分片回源；断网时已缓存分片继续播 + 降级提示条约 4s 消失"
    verification:
      - kind: manual_procedural
        ref: "44-VERIFICATION.md human_verification 1/3"
        status: unknown
    human_judgment: true
    rationale: "秒开体感与断网降级依赖真实网络/磁盘时序与故障注入，dev 环境无法自动化；CR-01/CR-05 源码顺序与单测已自动化证明，本条留 UAT 真机判定"

# Metrics
duration: 3min
completed: 2026-09-06
status: complete
plan_head_before: fdb78480e0ca01e8d9f4c97a4323c5ed225839df
commits: 3
---

# Phase 44 Plan 06: CR-01/CR-05 gap 闭合 — 缓存命中先于回源 + 源流 error 防护 + WR-06 复位 Summary

**handleProxyRequest 缓存查询翻转为命中优先（key=请求 URL target，命中读盘直返不回源）修复 CR-01、store()/透传分支源流 'error' 防护修复 CR-05，随 CR-01 补 WR-06（FRAG_LOADED 复位 hlsRetryCount）——「重开秒开」「断网照播」两条 failed truth 与主进程崩溃级缺陷在生产路径闭合**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-06T14:20:48Z
- **Completed:** 2026-09-06T14:23:36Z
- **Tasks:** 3
- **Files modified:** 4（main.js / media-cache-manager.js / src/player.js / tests/test-media-cache.js，+143/-32）

## Accomplishments

- **CR-01 命中优先（main.js handleProxyRequest）**：headers/Range 组装后、`try` 前新增 pre-fetch 分支——`vidParam`/`vidOk`（16 位 hex 校验）/`isM3u8Target`（`/\.m3u8(\?|$)/i` URL 预判），`cacheEnabled && mediaCache && vidOk && !range && !m3u8-likely` 时 `mediaCache.lookup(target, vidParam)`，命中则 `writeHead(200, {Content-Type: hit.contentType||octet-stream, Content-Length: hit.size, no-store})` + `end(hit.data)` + `return`——**不发起 ses.fetch**；命中失败（D-09 校验删片）自然回落 fetch 回源。分片缓存分支移除二次 lookup（命中已在上方处理），只保留未命中 tee：`store(target, vidParam, Readable.fromWeb(resp.body), {contentType})` + `tee.on('error')` 收尾 + `tee.pipe(res)`。缓存 key 全链统一为**请求 URL target**（`mediaCache.lookup(target` 行 363 < `ses.fetch(target` 行 382），main.js 全文无 `lookup(finalUrl`/`store(finalUrl` 残留
- **CR-05 源流 error 防护（media-cache-manager.js + main.js）**：`store()` 在两次 `readable.pipe(...)` **之前**挂 `readable.on('error', (err) => { console.warn('…回源流中断（透传与落盘同步终止）…'); passthrough.destroy(err); collector.destroy(); })`——源站 RST/链路闪断不再抛 uncaught exception 崩主进程；destroy(err) 异步派发与集成层 tee 的同步 error 监听无竞态。main.js 透传分支（Phase 27 遗留同款风险面）`Readable.fromWeb(resp.body)` 改为 `.on('error', …end 兜底…).pipe(res)`
- **contentType 命中回放契约**：`storeBuffer` 登记条目带可选 `contentType`（字符串且 ≤200 字符，落盘时经 store meta 透传）；`lookup()` 命中结果命中时回放该字段（`{hit, data, size, contentType}`），缺省不带 → main.js 回落 `application/octet-stream`（与落盘时 Content-Type 一致）；附加字段向后兼容不升 META_VERSION
- **WR-06 hlsRetryCount 复位（src/player.js）**：hls 分支既有 LEVEL_LOADED 监听旁新增 `Hls.Events.FRAG_LOADED` 监听 → `state.hlsRetryCount = 0`（分片数据到达 = 最精确「网络恢复」信号）；ERROR 分支 `<3` 递增 / `≥3` 提示条语义与双模式判定/续播链路零触碰
- **单测扩展（tests/test-media-cache.js）**：新增「store() 源流 error 健壮性（CR-05）」2 条——① 手动驱动 Readable push 部分数据后 destroy('source reset') → tee 收到 error 且部分数据已透传、测试进程存活（无 uncaught）；② storeBuffer 带 contentType 落盘 → lookup 命中回放 `video/mp2t`，缺省则命中结果无该字段。套件 15 → 17 全绿

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-01 — handleProxyRequest 缓存命中先于回源（key=target）** - `09f380d` (feat)
2. **Task 2: CR-05 — store() 源流 error 监听 + main.js 透传分支同款防护 + contentType 回放 + 单测** - `044061f` (feat)
3. **Task 3: WR-06 — hlsRetryCount 成功拉到分片后复位** - `84feef7` (fix)

## Files Created/Modified

- `main.js` - handleProxyRequest pre-fetch 命中分支（lookup@363 < fetch@382）、分片 miss 分支 tee-only + tee.on('error')、透传分支 .on('error') 同款防护、头注释 CR-01 语义
- `media-cache-manager.js` - store() pipe 前源流 error 监听 + JSDoc 调用契约；lookup() 命中扩展 contentType 回放；storeBuffer 登记可选 contentType 字段
- `src/player.js` - hls 分支新增 Hls.Events.FRAG_LOADED 监听复位 state.hlsRetryCount = 0（WR-06）
- `tests/test-media-cache.js` - 头注释补 CR-05 覆盖行；新增 describe「store() 源流 error 健壮性（CR-05）」2 条单测

## Decisions Made

- **缓存 key 统一为请求 URL（target）**：废弃重定向后 finalUrl 做 key——finalUrl 只有回源后才能得知，命中优先下无法用作查询 key；分片请求上 target 与 44-05 updatePlaylistIndex 登记的 segKey（`resolveUri(uri, 清单最终URL)`）同源（rewrite 输出的 `/proxy?url=` 即 resolveUri 结果），转封装顺序索引一致性不回归
- **m3u8/Range 不误入命中路径**：URL 层 `/\.m3u8(\?|$)/i` 预判 + `!req.headers.range` 显式排除；m3u8 响应仍走 rewrite 清单分支（回归保护）。伪装 m3u8 的 URL 因旧实现（仅非 m3u8 落盘）缓存中本无条目必然 miss，行为不变
- **旧 finalUrl-key 存量分片不迁移**：键不再被查询成孤儿数据，由 44-07（CR-02）容量淘汰按 total_size 正常回收——缓存非持久资产，接受此代价（计划明示）
- **WR-06 复位事件选 FRAG_LOADED**：LEVEL_LOADED 在直播刷新/清单级也触发，粒度不足；分片数据到达 = 最精确的恢复信号
- **contentType 附加字段不升 META_VERSION**：沿 44-05「附加字段向后兼容」先例，缺字段时命中回落 octet-stream（hls.js 分片消费不依赖 content-type 决定 demux 路径，最坏退化 octet-stream 默认）

## Deviations from Plan

None - plan executed exactly as written（3 个任务全部按 PLAN.md action/verify/acceptance_criteria 落地，无规则 1-4 触发；未引入任何新依赖，零包安装）。

## Issues Encountered

- None（无阻塞；REQUIREMENTS.md 为 specless 阶段、不含 D-ID 行，D-03/D-05/D-10 属 CONTEXT.md 决策骨架引用，与 44-01~44-05 一致不在 REQUIREMENTS.md 建行）

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- **CR-01/CR-05/WR-06 代码层闭合**，源码顺序 gate 与单测（17/17 + 回归 15+26+15 + 导航 32）全绿，media-cache-manager 保持纯 Node 可加载（prohibition gate 过）
- **44-VERIFICATION human_verification 第 1/3 项待真机复测**（CR-01 修复后）：重开已看视频已看部分立即起播、无分片回源；断网时已缓存分片继续播 + 降级提示条约 4s 消失——见 coverage H1，走 UAT
- 后续 gap 闭合计划已排队：44-07（CR-02 容量淘汰 + CR-03 outputPath 补算）、44-08（CR-04 cancel 桥接引擎）
- 遗留不在本 plan：WR-01~WR-05、IN-01/03/04（44-REVIEW 判定与 5 个 failed truths 无直接关联，44-06 objective 声明不纳入）

---

*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- 4 个改动源文件 + SUMMARY 全部存在（main.js / media-cache-manager.js / src/player.js / tests/test-media-cache.js / 44-06-SUMMARY.md）
- 3 个任务 commit 均在 git 历史（09f380d / 044061f / 84feef7）
- 计划级验证全绿：main.js + media-cache-manager.js + src/player.js node --check 通过；test-media-cache.js 17/17（15 既有 + 2 CR-05 新增）；回归 parser 15/15 + registry 26/26 + remuxer 15/15 + navigation 32/32；源码顺序 gate（lookup@363 < fetch@382）与无 finalUrl-key 调用断言通过；`require('./media-cache-manager')` 输出 pure-node ok（去 Electron 化 prohibition 过）
- commits 计量（gsd-plan-head-before-44-06 fdb7848..HEAD）：3，与 actuals 一致

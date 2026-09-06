---
phase: 44-player-video-cache-and-local-media-library
plan: 01
subsystem: media
tags: [hls, http-proxy, disk-cache, better-sqlite3, electron-ipc, resume-playback]

# Dependency graph
requires:
  - phase: 27-player-multimedia (播放器双模式 + /proxy 代理)
    provides: handleProxyRequest、rewriteM3u8ForProxy、proxiedUrl、media:play 窗口链路
provides:
  - media-cache-manager.js（去 Electron 化缓存管理器：读写盘/FIFO 淘汰/强淘/哈希校验/路径安全，D-03 缓存目录结构与 meta.json 格式在此定形）
  - player-history-manager.js（player_history 表，playback_key 主键 upsert，D-11）
  - 独立播放窗口 localhost 化（mode=independent + cache=1 + vid 参数链路，D-02）
  - player:progress / player:resume-position / player:drawer:list / player:cache:delete 四条 IPC 通道
  - tests/test-media-cache.js（Wave 0，D-05~D-10/D-12/T-44-01/02 断言）
affects: [44-02 media-task-manager, 44-03 集成接线, 44-04 设置页, 44-05 抽屉 UI/任务页]

# Actuals (#2632)
actuals:
  tokens: 18000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []   # 零新依赖（node:crypto/node:test/better-sqlite3 均既有）
  patterns:
    - "/proxy 缓存分流钩子：cache=1 + vid（m3u8 哈希）参数链路，分片借 vid 无状态归属视频目录"
    - "去 Electron 化服务模块（constructor 注入 cacheRoot/capacityBytes/isVideoActive）+ node:test 纯逻辑测试"
    - "tee 落盘：回源流一边透传一边收集，整片 buffer 后 storeBuffer（ENOSPC 强淘重试内聚）"
    - "IPC 依赖注入 setter 惯例（setRealmServerInfo / setMediaCaches）"

key-files:
  created:
    - media-cache-manager.js
    - player-history-manager.js
    - tests/test-media-cache.js
  modified:
    - main.js
    - ipc-handlers.js
    - src/player.js
    - src/player.css
    - src/preload.js

key-decisions:
  - "分片→视频归属用 vid 参数（m3u8 finalUrl 的 videoId 经 rewriteM3u8ForProxy 注入子请求），无状态、无全局索引文件（属 RESEARCH 裁量区「缓存 HTTP 语义细节」）"
  - "cache 分支按整片 buffer 收集后写盘（MAX_SEGMENT_BYTES 64MB 上限防 DoS），使 ENOSPC 强淘重试可内聚在 storeBuffer 同步实现"
  - "cache 标记只在 rewriteM3u8ForProxy 白名单里对 cache=1 请求展开为 cache+vid 两个参数，webview tab 流量 URL 不含 cache 不进缓存分支（D-01 锁定）"
  - "/proxy 全响应 + 内部页静态路由统一 Cache-Control: no-store（Pitfall 7 双缓存）"
  - "新增 player:resume-position 通道（计划清单外）：续播需按 playbackKey 点查历史，复用 drawer:list 全量拉取不合理"

patterns-established:
  - "缓存路径安全 _safePath：resolve 前缀校验 + 最深已存在祖先 realpath 复核（防 symlink 二段式逃逸），后续 media-task-manager 录制目录可复用"
  - "淘汰豁免双通道：isVideoActive(playbackKey) 注入回调（44-02 契约）+ evictIfNeeded(exemptVideoIds) 防强淘误删在写目录"
  - "关窗兜底协议：主进程 close 拦截 → renderer 索取最终进度 → ack/500ms 超时双保险放行"

requirements-completed: [D-01, D-02, D-03, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13]

coverage:
  - id: D1
    description: "续播 key = origin+pathname，query 时效 token 不参与（D-12）"
    requirement: D-12
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#playbackKey / videoId 续播 key 语义"
        status: pass
    human_judgment: false
  - id: D2
    description: "分片落盘 <缓存根>/<视频ID>/segments/ + meta.json 索引（实际字节数 + sha256），读写闭环（D-05）"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#store / lookup 读写闭环"
        status: pass
    human_judgment: false
  - id: D3
    description: "读取时哈希/大小校验失败删片回源，播放不中断（D-09）"
    requirement: D-09
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#哈希/大小校验删片回源"
        status: pass
    human_judgment: false
  - id: D4
    description: "FIFO 淘汰按 last_watched 整目录删除 + 活跃任务豁免（D-06/D-07）"
    requirement: D-07
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#FIFO 淘汰与活跃豁免"
        status: pass
    human_judgment: false
  - id: D5
    description: "写盘 ENOSPC 强淘重试，仍失败返回 disk_full（D-08）"
    requirement: D-08
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#磁盘满强淘重试"
        status: pass
    human_judgment: false
  - id: D6
    description: "已登记分片再次 store 跳过不重写（增量续存，D-10）"
    requirement: D-10
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#增量续存"
        status: pass
    human_judgment: false
  - id: D7
    description: "路径安全：videoId/分片名 hex 白名单 + symlink 逃逸拒绝（T-44-01/T-44-02）"
    requirement: D-03
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#路径安全"
        status: pass
    human_judgment: false
  - id: D8
    description: "独立窗口 localhost 化 + mode=independent/cache=1 链路；webview tab 模式行为不变（D-01/D-02）"
    requirement: D-02
    verification:
      - kind: other
        ref: "node --check main.js ipc-handlers.js src/player.js src/preload.js 全通过；模式分支结构经人工核对"
        status: pass
    human_judgment: true
    rationale: "真实窗口加载/红绿灯标题栏/秒开体感需 UAT 在真机 dev 环境验证（44-VALIDATION Manual-Only）"
  - id: D9
    description: "进度 5s/暂停/关窗三路落盘 + 重开续播 seek + D-10 降级提示条（D-10/D-13）"
    requirement: D-13
    verification:
      - kind: other
        ref: "node --check src/player.js + grep 提示条文案/通道断言通过"
        status: pass
    human_judgment: true
    rationale: "断网降级提示与续播体感依赖真实网络与播放器交互，只能 UAT 手工验证"

# Metrics
duration: 24min
completed: 2026-09-06
status: complete
---

# Phase 44 Plan 01: 端到端切片 — 独立窗口 + /proxy 缓存 + 观看历史续播 Summary

**独立播放窗口 localhost 化 + /proxy 层按视频组织的分片磁盘缓存（FIFO 淘汰/强淘/哈希校验）+ SQLite 观看历史精确续播，主链路端到端打通**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-06T10:49:54Z
- **Completed:** 2026-09-06T11:13:36Z
- **Tasks:** 3
- **Files modified:** 8（3 新建 + 5 修改）

## Accomplishments

- media-cache-manager.js：去 Electron 化缓存管理器——playbackKey=origin+pathname（D-12）、videoId/分片名 sha256 hex、meta.json 落盘 D-05 字段、FIFO 淘汰（活跃豁免）、ENOSPC 强淘重试、哈希/大小校验删片回源、_safePath 路径安全（resolve+realpath 双复核）
- 独立播放窗口从 file:// 收口到 localhost（D-02）：mode=independent 第三形态判定保留标题栏红绿灯（Pitfall 1），cache=1 + vid 参数经 m3u8 重写自动继承到分片/密钥/子清单请求，webview tab 流量零变化（D-01）
- player-history-manager.js：player_history 表 playback_key 主键 upsert（标题空值保留语义），观看历史独立于缓存条目不随淘汰消失（D-11）
- 进度三路落盘（5s 节流 + 暂停 + 关窗 close 拦截索取）+ loadedmetadata 续播 seek + D-10 降级提示条「部分分片加载失败，已缓存部分可继续观看」（4s 自动消失、hls.js startLoad 重试 ≤3 次不打断播放）
- /proxy 与内部页响应统一 Cache-Control: no-store（Pitfall 7）；抽屉数据后端（缓存库+观看历史合并、last_watched 降序）与按 videoId 删缓存保留历史的 IPC 就绪（D-14~D-16 后端）
- tests/test-media-cache.js：15 断言全绿，覆盖 D-05~D-10、D-12、T-44-01/02（Wave 0 落地）

## Task Commits

Each task was committed atomically:

1. **Task 1: 端到端切片 — 独立窗口 localhost 化 + /proxy 缓存命中/落盘最小闭环** - `35658aa` (feat)
2. **Task 2: 缓存完整化 — FIFO 淘汰/哈希校验/磁盘满强淘 + tests/test-media-cache.js** - `9fdab28` (test)
3. **Task 3: 观看历史 + 精确续播 + 进度节流上报 + 抽屉数据后端** - `ab2e500` (feat)

## Files Created/Modified

- `media-cache-manager.js`（新）- MediaCacheManager 类 + playbackKeyOf/videoIdOf/segmentKeyOf，D-03 缓存格式在此定形
- `player-history-manager.js`（新）- player_history 表 CRUD（upsert/getByKey/listRecent）
- `tests/test-media-cache.js`（新）- Wave 0 单测（node:test 纯 Node，15 断言）
- `main.js` - 缓存分流钩子（m3u8 建档 touchVideo、命中读盘、未命中 tee 落盘）、rewriteM3u8ForProxy 透传 cache/vid、no-store、mediaCache/playerHistory 初始化与注入、setRealmServerInfo
- `ipc-handlers.js` - media:play loadURL localhost 化 + close 拦截兜底、player:progress/resume-position/drawer:list/cache:delete 四通道、setRealmServerInfo/setMediaCaches
- `src/player.js` - mode=independent 判定、proxiedUrl 附加 cache、进度节流上报、initPlayerWithResume 续播、D-10 提示条 + hls 重试
- `src/player.css` - .cache-fallback-banner 样式（--player- token）
- `src/preload.js` - playerAPI 新通道 reportProgress/getResumePosition/getDrawerList/deleteCacheEntry/onRequestFinalProgress

## Decisions Made

- **分片→视频归属用 vid 参数**：m3u8 清单请求在 rewriteM3u8ForProxy 时把自身 videoId 以 `vid` 注入子请求 URL，分片请求据此无状态归属视频目录——避免全局索引文件与主进程会话状态；属 RESEARCH「缓存 HTTP 语义细节」裁量区
- **整片 buffer 收集后写盘**（单分片 64MB 上限）：换取 ENOSPC 强淘重试在 storeBuffer 内同步内聚实现，流式 tee 语义对调用方不变
- **新增 player:resume-position IPC**（计划清单外，Rule 2）：续播需按 playbackKey 点查，复用 drawer:list 全量拉取不合理
- **淘汰豁免双通道**：isVideoActive 注入回调（44-02 契约）之外，evictIfNeeded 增加 exemptVideoIds 参数防强淘误删正在写入的目录（测试发现的 Rule 1 bug 修复演进而来）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 强制淘汰误删正在写入的视频目录**
- **Found during:** Task 2（ENOSPC 强淘重试测试）
- **Issue:** storeBuffer 写盘 ENOSPC → evictIfNeeded 把当前正在写入的视频目录也删掉 → 重试写盘 ENOENT
- **Fix:** `_writeWithEvictRetry` 增加 videoId 参数，`evictIfNeeded(exemptVideoIds)` 支持额外豁免集合
- **Files modified:** media-cache-manager.js
- **Verification:** tests/test-media-cache.js「ENOSPC → 强制淘汰 → 重试成功」断言通过
- **Committed in:** 9fdab28

**2. [Rule 2 - Missing Critical] 新增 player:resume-position 续播点查通道**
- **Found during:** Task 3
- **Issue:** 计划的 preload 通道清单没有按 playbackKey 点查历史的通道，续播功能缺数据来源
- **Fix:** ipc-handlers 新增 player:resume-position（assertPlayerSender），preload 增加 getResumePosition
- **Files modified:** ipc-handlers.js, src/preload.js
- **Verification:** node --check + grep 断言通过
- **Committed in:** ab2e500

---

**Total deviations:** 2 auto-fixed（1 bug，1 missing critical）
**Impact on plan:** 均为正确性必需，无 scope creep。

## Issues Encountered

- Task 1 编辑 m3u8 分支时一度遗漏 `rewriteM3u8ForProxy` 调用行，提交前 grep 自检发现并补回
- `setRealmServerInfo` 初版被放进了 registerHandlers 函数作用域而 module.exports 引用它（require 时会 ReferenceError），Task 3 开始时发现并移至模块作用域

## Known Stubs

| 文件 | 位置 | 说明 |
|------|------|------|
| ipc-handlers.js | player:drawer:list | `completeness` 字段暂置 null——完整度百分比需分片总数（D-14 后半），44-02 media-task-manager 提供契约后在抽屉 UI（44-02/03）补齐。已登记 `.planning/WINDOWS.md` |

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- 44-02（media-task-manager）：`isVideoActive(playbackKey)` 注入契约的接收端已就位（MediaCacheManager constructor），录制分片存储可复用 storeBuffer/_safePath 模式
- 44-03（集成）：44-03 只需 `mediaTaskManager.isVideoActive` 接进 main.js 的 `new MediaCacheManager({...})` 构造参数即可生效淘汰豁免
- 抽屉 UI / 任务页（44-02/05）：player:drawer:list 数据形状已定 `{ title, url, playbackKey, cacheSize, completeness, lastPosition, duration, lastWatched }`
- UAT 待验证（Manual-Only）：真机重开秒开体感、webview tab 回归、断网降级提示、关窗进度兜底（44-VALIDATION）

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- media-cache-manager.js / player-history-manager.js / tests/test-media-cache.js 均存在
- 三个任务提交 35658aa / 9fdab28 / ab2e500 均在 git 历史中
- tests/test-media-cache.js 15/15 全绿；6 个模块 node --check 全通过
- commits 计量（gsd-plan-head-before-44-01..HEAD）：3，与 actuals 一致

---
phase: 44-player-video-cache-and-local-media-library
plan: 02
subsystem: media
tags: [m3u8, hls, task-registry, state-machine, pure-node, tdd, electron-decoupled]

# Dependency graph
requires:
  - phase: 44-01
    provides: playbackKey（origin+pathname）语义约定与 media-cache-manager 接收端（isVideoActive 注入点已预留）
provides:
  - media-m3u8-parser.js — parsePlaylist/resolveUri 纯函数（录制引擎唯一清单解析来源）
  - media-task-manager.js — createMediaTaskManager({ persist, now }) 统一任务注册表（D-25 状态机 + 持久化 + D-22 接力钩子 + D-07 豁免查询源 isVideoActive）
  - tests/test-m3u8-playlist-parser.js（15 断言）与 tests/test-media-task-registry.js（26 断言）— Wave 0 单测
affects: [44-03, 44-04, 44-05]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7900
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []  # 零新依赖（must_haves prohibition：不引 hls-parser 等，手写行级解析）
  patterns:
    - 去 Electron 化纯模块（persist/now 构造注入），纯 Node 可加载可测试
    - node:test + describe/test 单测结构（沿 test-ai-bash-policy 先例）

key-files:
  created:
    - media-m3u8-parser.js
    - media-task-manager.js
    - tests/test-m3u8-playlist-parser.js
    - tests/test-media-task-registry.js
  modified: []

key-decisions:
  - "restoreTasks 按 T-44-05 做字段类型白名单校验（id/type 枚举/status 枚举/数值），未知字段丢弃、非法条目跳过、非法 JSON 返回空数组不抛"
  - "persist 回调异常吞掉仅 console.warn，不阻断任务状态机（持久化失败不应让状态流转崩溃）"
  - "EXTINF duration 无对应分片行时为 null（缺省语义显式化，录制引擎按 null 处理）"
  - "completeTask 将 progress 置 100 并触发全部 onTaskCompleted 快照回调（回调异常隔离）"

patterns-established:
  - "任务注册表状态机：running→completed/failed/cancelled/interrupted 合法流转，终态再流转抛错（requireRunning 守卫）"
  - "D-07 豁免查询源契约：isVideoActive(playbackKey) 遍历 running 任务比对 playbackKey，终态自动解除豁免；注册表不反向依赖 media-cache-manager"
  - "m3u8 行级解析：seq = mediaSequence + 分片序位，与 RESEARCH 录制轮询示例语义一致"

requirements-completed: [D-18, D-22, D-25]

coverage:
  - id: D1
    description: "m3u8 清单纯函数解析：MEDIA-SEQUENCE 基线序号、分片 seq 连续编号、ENDLIST live/VOD 判定、TARGETDURATION 缺省、EXTINF 时长归属、KEY/注释行忽略、resolveUri 相对→绝对"
    requirement: D-18
    verification:
      - kind: unit
        ref: "tests/test-m3u8-playlist-parser.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "媒体任务注册表状态机（D-25）：running→completed/failed/cancelled/interrupted 合法流转、非法流转拒绝、persist 注入调用、restoreTasks 崩溃恢复 running→interrupted + 白名单校验"
    requirement: D-25
    verification:
      - kind: unit
        ref: "tests/test-media-task-registry.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "record→convert 接力钩子（D-22）：completeTask 触发 onTaskCompleted 回调收到完整任务对象；registerTask 保留 playbackKey 供 D-07 豁免查询"
    requirement: D-22
    verification:
      - kind: unit
        ref: "tests/test-media-task-registry.js#onTaskCompleted 接力回调"
        status: pass
    human_judgment: false
  - id: D4
    description: "两模块零 Electron 依赖，纯 Node 可加载（44-VALIDATION Wave 0 关键前置）"
    requirement: D-25
    verification:
      - kind: unit
        ref: "node -e \"require('./media-task-manager'); require('./media-m3u8-parser')\" → pure-node ok"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-06
status: complete
---

# Phase 44 Plan 02: m3u8 解析器与媒体任务注册表 Summary

**交付两个去 Electron 化纯逻辑模块：m3u8 行级解析器（parsePlaylist/resolveUri，录制引擎唯一解析来源）与 media-task-manager 统一任务注册表（D-25 状态机 + persist 注入持久化 + D-22 record→convert 接力钩子 + D-07 豁免查询源 isVideoActive），41 项单测全绿**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-06T11:18:34Z
- **Completed:** 2026-09-06T11:25Z
- **Tasks:** 2
- **Files modified:** 4（全部新建）

## Accomplishments

- media-m3u8-parser.js：parsePlaylist 解析 MEDIA-SEQUENCE/TARGETDURATION/ENDLIST/分片列举（seq = mediaSequence + 序位）/EXTINF 归属；resolveUri 相对 URI → 绝对 URL。手写 ~40 行行级解析，零依赖（must_haves prohibition 遵守）
- media-task-manager.js：createMediaTaskManager({ persist, now }) 工厂——D-25 状态机（running→四终态，非法流转拒绝）、每次变更触发 persist、restoreTasks 撑 D-18 崩溃重启语义（running→interrupted，outputPath 保留供续转）+ T-44-05 字段白名单、onTaskCompleted 多回调接力挂点（D-22）、isVideoActive(playbackKey) 逐视频豁免查询源（D-07）、registerTask 保留 playbackKey 字段（44-04 引擎传入）
- Wave 0 单测补齐：test-m3u8-playlist-parser.js（15 断言）+ test-media-task-registry.js（26 断言），node:test 纯 Node 环境

## Task Commits

Each task was committed atomically:

1. **Task 1: media-m3u8-parser.js — 行级清单解析器 + 单测** - `aeb514b` (feat)
2. **Task 2: media-task-manager.js — 任务注册表状态机 + 持久化 + 接力钩子 + 单测** - `46e195b` (feat)

_Note: TDD 各任务经 RED→GREEN 完整循环（先写测试确认 MODULE_NOT_FOUND，再实现转绿），单 commit 交付测试+实现_

**Plan metadata:** (见最终 docs commit)

## Files Created/Modified

- `media-m3u8-parser.js` - m3u8 行级清单解析纯函数（录制引擎解析地基）
- `media-task-manager.js` - 媒体任务统一注册表（D-25 状态机 + 持久化 + 接力钩子）
- `tests/test-m3u8-playlist-parser.js` - 解析器单测（15 断言）
- `tests/test-media-task-registry.js` - 注册表单测（26 断言）

## Decisions Made

- restoreTasks 按 T-44-05 威胁模型做字段类型白名单校验：未知字段丢弃、非法条目（缺 id/type 枚举外/status 枚举外/title 非字符串）跳过、非法 JSON 返回空数组不抛
- persist 回调异常（含 Promise rejection）吞掉仅 console.warn——持久化失败不应阻断任务状态机
- EXTINF 无对应分片行时 duration 为 null（显式缺省语义）
- completeTask 置 progress=100；onTaskCompleted 回调异常隔离（try/catch），单个回调失败不影响其他回调与状态机

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **44-03（任务中心集成）**：media-task-manager 可直接 require——persist 落 userData/media-tasks.json、isVideoActive 注入 media-cache-manager 构造参数（44-01 接收端已就位）、hasActiveTasks 接 before-quit 确认、listTasks 供 /api/tasks/list
- **44-04（录制引擎）**：parsePlaylist/resolveUri 可直接消费（seq 去重语义与 RESEARCH 录制轮询示例一致）；registerTask 携带 playbackKey
- **44-05（转封装）**：onTaskCompleted 接力挂点已就绪，record completed 任务对象含 playbackKey/outputPath 完整字段
- 零新依赖（package.json 未动），无打包风险

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- 4 个交付文件全部存在（2 模块 + 2 测试）
- 2 个任务 commit 均在 git 历史（aeb514b / 46e195b）
- 计划级验证全绿：两测试套件 0 fail、pure-node ok、package.json 零新增依赖

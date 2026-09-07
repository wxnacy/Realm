---
phase: 44-player-video-cache-and-local-media-library
plan: 12
subsystem: media-player
tags: [player-history, sqlite, ipc, electron-dialog, gap-closure, G-44-8]

# Dependency graph
requires:
  - phase: 44-player-video-cache-and-local-media-library (44-01/44-09)
    provides: player_history 双层存储（player-history-manager upsert/getByKey/listRecent）与 player:cache:delete D-16 删除链路
provides:
  - playerHistory.deleteByKey(playbackKey)：参数化 DELETE，changes 判定返回 boolean
  - player:cache:delete 扩展第二参 deleteEntry（严格 === true 且缓存删除成功才联动删历史，返回补 historyDeleted）
  - 抽屉删除确认框「同时删除条目（含观看历史）」checkbox（默认不勾）+ 文案联动
  - 抽屉 meta 行「最近观看」时钟图标（完整时间进 title tooltip）
affects: [player-drawer-ui, player-history, uat-verify]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 2600
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IPC 布尔开关严格 === true 门 + 原始入参保存（hex 防御分支）——可选行为扩展不破坏缺省语义"
    - "原生 dialog 内 checkbox 联动文案（模块级 pendingDeleteTitle 暂存，cancel/closing 全路径清理）"

key-files:
  created:
    - tests/test-player-history.js
  modified:
    - player-history-manager.js
    - ipc-handlers.js
    - src/preload.js
    - src/player.html
    - src/player.js
    - src/player.css

key-decisions:
  - "deleteByKey 参数化 prepare + changes>0 判定（T-44-G12-01 mitigate，锁定 prohibition）"
  - "player:cache:delete 严格 deleteEntry === true + 仅缓存删除成功后联动 + hex 原始入参跳过历史删除（T-44-G12-02 mitigate；缺省 falsy 零触达 playerHistory，D-16 语义逐字节不变）"
  - "默认文案保持 UI-SPEC Copywriting 契约原文逐字不变；勾选切换为「不可恢复」警示文案"
  - "「最近观看」图标化后完整时间保留在 title tooltip（G-44-8 missing 第 3 项）"

patterns-established:
  - "确认框 checkbox 勾选态在 openDeleteConfirm 每次复位（默认不勾），confirm 处理器透传 checked 给 IPC 第二参"

requirements-completed: [D-11, D-14, D-15, D-16]

coverage:
  - id: D1
    description: "playerHistory.deleteByKey 按 playbackKey 参数化删除（删除/幂等/防御/删后重建闭环）"
    requirement: D-11
    verification:
      - kind: unit
        ref: "tests/test-player-history.js#deleteByKey 删除闭环（G-44-8）"
        status: pass
    human_judgment: false
  - id: D2
    description: "player:cache:delete 扩展 deleteEntry 参数：严格布尔门 + 缓存删除成功后联动 + hex 防御跳过；缺省语义 D-16 逐字节不变"
    requirement: D-16
    verification:
      - kind: other
        ref: "grep -c 'deleteEntry === true' ipc-handlers.js（=1）+ grep 'deleteByKey' player-history-manager.js + node tests/test-player-history.js 7/7 pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "删除确认框「同时删除条目（含观看历史）」checkbox（默认不勾）+ 文案随勾选联动；不勾删除后条目保留为未缓存，勾选删除后条目消失"
    requirement: D-14
    verification:
      - kind: other
        ref: "grep 'drawer-delete-entry' src/player.html + grep 'drawerDeleteEntry.checked' src/player.js + node --check src/player.js"
        status: pass
    human_judgment: true
    rationale: "勾选/不勾两条删除路径的真机行为与文案视觉效果需 UAT 第 8 项人工复测（计划 verification 第 4 条）"
  - id: D4
    description: "抽屉 meta 行「最近观看」文字替换为 12px 时钟图标，完整时间保留在 title tooltip"
    requirement: D-15
    verification:
      - kind: other
        ref: "grep 'drawer-item-watched' src/player.js src/player.css + node --check src/player.js"
        status: pass
    human_judgment: true
    rationale: "图标视觉尺寸/对齐与 tooltip hover 表现需真机目验（UAT 第 8 项）"

# Metrics
duration: 6 min
completed: 2026-09-07
status: complete
---

# Phase 44 Plan 12: G-44-8 抽屉条目级删除 + 「最近观看」图标化 Summary

**抽屉删除确认框新增「同时删除条目（含观看历史）」checkbox（默认不勾，勾选后 playerHistory 按 playbackKey 参数化联动删除），meta 行「最近观看」文字替换为时钟图标 + tooltip；D-16 默认仅删缓存语义逐字节不变**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-07T07:05:08Z
- **Completed:** 2026-09-07T07:11:10Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- playerHistory 新增 deleteByKey（prepare 参数化 DELETE + changes 判定，未初始化/非法入参返回 false 不抛异常），单测 7 例闭环（删除/幂等/防御/删后重建）
- player:cache:delete 扩展第二参 deleteEntry：严格 `=== true` 且缓存删除成功才联动删历史、返回补 historyDeleted、hex 入参防御跳过；缺省路径零触达 playerHistory（D-16 语义锁定）
- 删除确认框 checkbox（原生 dialog + showModal 结构不变，居中约定零回归）+ 文案随勾选联动（默认文案 UI-SPEC 契约原文逐字保留）
- 抽屉 meta 行「最近观看」换 12px 时钟图标，完整时间进 title tooltip

## Task Commits

Each task was committed atomically:

1. **Task 1: deleteByKey + player:cache:delete 扩展 + 单测** - `0f934f5` (test RED) + `b1919d8` (feat GREEN)
2. **Task 2: 确认框 checkbox + 文案联动 + 时钟图标** - `44a24ef` (feat)

## Files Created/Modified
- `player-history-manager.js` - 新增 deleteByKey（参数化 DELETE，changes>0 判定）+ exports
- `ipc-handlers.js` - player:cache:delete 签名扩展 deleteEntry，严格布尔门 + 联动删历史
- `src/preload.js` - deleteCacheEntry 签名扩展 (videoId, deleteEntry)，向后兼容
- `src/player.html` - drawer-delete-dialog 新增 checkbox label 行
- `src/player.js` - drawerDeleteEntry 引用、复位/联动文案、确认透传勾选态、meta 时钟图标
- `src/player.css` - .drawer-delete-option 与 .drawer-item-watched 样式
- `tests/test-player-history.js` - 新建 node:test 单测（7 例）

## Decisions Made
- deleteEntry 历史删除联动收在 IPC 层而非 preload/renderer 判断——主进程单点裁决，renderer 伪造第二参需过严格布尔门 + 缓存删除成功前置 + hex 防御三重护栏（T-44-G12-02）
- 勾选联动文案需要标题：openDeleteConfirm 把 item.title 暂存 pendingDeleteTitle，cancel/confirm/closing 全路径清空

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Verification Results
- `node --check` player-history-manager.js / ipc-handlers.js / src/preload.js / src/player.js 全过
- `node tests/test-player-history.js` 7/7 pass；回归 `node tests/test-media-cache.js` 20/20、`node tests/test-media-task-registry.js` 26/26、`node tests/test-media-remuxer.js` 23/23 全绿
- 源码 gate：`deleteEntry === true` 严格判定、checkbox 复位与透传、时钟图标 + 两组样式均 grep 通过
- 人工复测（UAT 第 8 项，end-of-phase UAT 承载）：抽屉删除默认仅删缓存（条目变「未缓存」）；勾选「同时删除条目」确认后条目消失（重开抽屉不再出现）；meta 行时钟图标 hover 显示「最近观看 时间」；确认框居中

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G-44-8 三项 missing 全部闭合，待 end-of-phase UAT 人工复测
- 已知债务维持：WR-A/B/C/05/01-04、IN-01-04 未点名项

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-07*

## Self-Check: PASSED

- 7 个产出文件全部存在于磁盘（含 SUMMARY 自身）
- 4 个提交（0f934f5 / b1919d8 / 44a24ef / b946046）均可在 git log 中检索
- 全部 acceptance criteria 与 plan 级 verification 已执行（见 Verification Results）

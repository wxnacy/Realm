---
phase: 44-player-video-cache-and-local-media-library
plan: 16
subsystem: media-player
tags: [gap-closure, record-engine, player-ui, duration]
requires: [44-04-record-engine, 44-12-drawer-meta-row]
provides: [wall-clock-running-duration, drawer-icon-plus-time-meta]
affects: [player-record-dot-tooltip, d19-close-confirm, meta-json-total-duration]
tech-stack:
  added: []
  patterns: [两口径分离（运行中挂钟差值 vs 终态 EXTINF 累计）]
key-files:
  created:
    - tests/test-media-record-duration.js
  modified:
    - media-record-engine.js
    - src/player.js
    - src/player.css
decisions:
  - 运行中 durationSeconds 改为 startedAt 起的本地挂钟差值（Math.max(0, round)），与分片落盘节奏彻底解耦；meta.json totalDuration 的 EXTINF 累计口径逐字节不变（writeMeta 零 diff，META_VERSION 不升）
  - 抽屉 meta 行时间文本放进 watchedIcon span 内（图标 + 时间并排常显），title 保留完整「最近观看 时间」hover 提示
metrics:
  duration: 6min
  completed: 2026-09-07
status: complete
actuals:
  tokens: 2200
  tasks: 2
  commits: 2
plan_head_before: 3914693
---

# Phase 44 Plan 16: Gap Closure G-44-4 + G-44-6 Summary

**One-liner:** 运行中录制时长改本地挂钟差值平滑推进（0 分片也在走表）并新增 4 例口径分离单测；缓存抽屉 meta 行恢复「时钟图标 + 时间」并排常显。

## What Was Done

### Task 1 — 运行中时长改本地时钟差值（G-44-4，TDD）

- **RED**：先写 `tests/test-media-record-duration.js`（4 例，风格对齐 test-media-task-registry：node:test + 临时 recordRoot + 注入 fetchPage/parsePlaylist/taskManager），红——挂钟例失败（旧代码 0 分片 → durationSeconds=0）。
- **GREEN**：`media-record-engine.js` 三处改动：
  1. `startRecord` 的 st 增加 `startedAt: Date.now()`（:113 附近）
  2. `getRecordStatus`（:299）运行中分支：`durationSeconds: Math.max(0, Math.round((Date.now() - st.startedAt) / 1000))`
  3. `getActiveRecordings`（:335）同式替换——D-19 关窗确认、红点同步共用同一口径
- 两处 JSDoc 同步标注「本地挂钟差值，与 meta.json totalDuration（EXTINF 累计）口径分离」。
- **终态口径逐字节不变**：writeMeta 函数体零 diff（`git diff 3914693..HEAD` 验证），totalDuration 仍为分片 EXTINF 累计（duration 缺失兜底 targetDuration），META_VERSION 未升，续转/转封装顺序索引不受影响。

### Task 2 — 抽屉 meta 行「时钟图标 + 时间」并排常显（G-44-6）

- `src/player.js` renderDrawer（:1001）：watchedIcon span 内 SVG 之后 `appendChild(document.createTextNode(watched))`——图标只替代「最近观看」四个字，时间文本始终可见（非仅 hover）；`title` 保留完整 `最近观看 ${watched}` hover 提示；注释同步 G-44-6 语义。
- `src/player.css`（:636）：注释更新为 G-44-6 语义 + `.drawer-item-watched` 增加 `gap: 4px`（inline-flex 已就位，间距用 gap 不用 margin）。
- 未动 meta 行前段（缓存大小 · 完整度 / 未缓存）、删除确认链路、抽屉其他区块。

## Verification

- `node tests/test-media-record-duration.js` → **4/4 pass**（时钟推进 / 两处同式 / EXTINF 终态口径 / targetDuration 兜底）
- 基线回归：`node tests/test-media-task-registry.js` 26/26，`node tests/test-media-cache.js` 20/20 全绿
- `grep "recorded.size \* st.targetDuration" media-record-engine.js` 零命中（两处乘积式均已替换）
- `node --check media-record-engine.js` / `node --check src/player.js` 通过
- diff 范围核查：player.js 仅 meta 行 watchedIcon 区块；player.css 仅 .drawer-item-watched 段与注释；settings.html / src/settings-page.js / ipc-handlers.js / src/renderer.js / main.js 均未触碰（44-14 成果与用户未提交改动不受影响）
- **human-check（待真机）**：`npm run dev`——录制中 hover 红点时长每秒平滑 +1（含弱网点播源 0 分片场景走表）；缓存抽屉「图标 + 时间」并排常显、hover 有完整提示。

## Deviations from Plan

**1. [计划内修正] 测试 4 初始数据少一个新分片**
- **Found during:** Task 1（RED 阶段）
- **Issue:** 首轮基线 seq1 + 第二轮清单 seq1/seq2 只追 1 个新分片，与断言 `segments.length === 2` 不符（测试自身 bug，非引擎 bug）
- **Fix:** 第二轮清单补 seq3（追 2 个新分片，兜底累计 2×2=4）
- **Files modified:** tests/test-media-record-duration.js
- **Commit:** 651b0cc

其余按计划执行，无偏差。

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 651b0cc | fix(44-16): running record duration by wall clock (G-44-4) |
| 2 | bbc4f56 | fix(44-16): drawer meta row clock icon + time always visible (G-44-6) |

## Self-Check: PASSED

- tests/test-media-record-duration.js 存在 ✓（4/4 pass）
- 651b0cc / bbc4f56 均在 git log ✓
- writeMeta 零 diff、locked 文件（settings.html / settings-page.js / ipc-handlers.js 关窗分支）未触碰 ✓

---
phase: 44-player-video-cache-and-local-media-library
plan: 17
subsystem: media
tags: [mux.js, hls, mp4, remux, fs, race-condition]

requires:
  - phase: 44-player-video-cache-and-local-media-library
    provides: media-remuxer convertToMp4（D-22/D-24 转换执行体）、G-44-4b 首片格式嗅探
provides:
  - convertToMp4 产物文件同步 fd 创建（fs.openSync 'w' + createWriteStream({fd})），失败清理确定性无竞态
  - G-44-7 产物泄漏回归测试（密文拒转 + 协作式取消，事件循环延迟 100ms 存在性断言）
affects: [44-18, media-cache, video-convert]

actuals:
  tokens: 1520
  tasks: 2
  commits: 2
plan_head_before: 946d28a41547f0c154a53c762a43c4d0a6473a2f

tech-stack:
  added: []
  patterns:
    - "同步 fd 建产物文件：fs.openSync(outputPath,'w') → fs.createWriteStream(path,{fd})，消除异步 open 与同步 unlink 的竞态"
    - "竞态回归断言模式：reject 后 setTimeout ≥100ms 再 fs.existsSync，等潜在排队 open 落地再判定"

key-files:
  created: []
  modified:
    - media-remuxer.js
    - tests/test-media-remuxer.js

key-decisions:
  - "产物文件创建从异步 open 改为同步 fd（openSync 'w' 传入 createWriteStream {fd}），保留 fs.createWriteStream 字面调用以满足既有结构断言"
  - "openSync 失败（目录不存在/无写权限）按 write_failed 直接 reject，不创建 stream、无需清理"

patterns-established:
  - "确定性清理时序：任何『stream 创建后、首条 data 前』失败路径，产物在 fail() 执行前已存在或从未创建，unlinkSync 必然命中"
  - "事件循环延迟存在性断言：泄漏类竞态回归须延迟 ≥100ms 后检查文件不存在"

requirements-completed: [D-22]

coverage:
  - id: D1
    description: "convertToMp4 任何『stream 创建后、首条 data 写盘前』失败路径 reject 后 outputPath 不残留 0 字节文件（含 100ms 后仍不存在）"
    requirement: D-22
    verification:
      - kind: unit
        ref: "tests/test-media-remuxer.js#G-44-7 产物泄漏回归（异步 open 竞态修复）"
        status: pass
    human_judgment: false
  - id: D2
    description: "清理行为确定性（同步 fd 先于一切失败检查点），mux.js 时序硬约束与既有 23 项测试零回归"
    requirement: D-22
    verification:
      - kind: unit
        ref: "node tests/test-media-remuxer.js（25 tests / 0 fail）"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-07
status: complete
---

# Phase 44 Plan 17: G-44-7 产物 0 字节泄漏修复（异步 open 竞态） Summary

**convertToMp4 产物流改同步 fd 创建（fs.openSync 'w' → createWriteStream {fd}），失败清理从「竞态」变「确定」，并补密文拒转/取消两路径的事件循环延迟泄漏回归测试**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-09-07T13:46:42Z
- **Completed:** 2026-09-07T13:49:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 修复 G-44-7 泄漏层：createWriteStream 的异步 open(O_CREAT) 与 fail() unlinkSync 之间的竞态彻底消除——产物文件自 Promise 执行体起同步存在（或 openSync 失败从未创建），凡 encrypted_stream / unsupported_container / cancelled / 早期 transmux 异常路径均不再泄漏 0 字节 mp4 残留
- openSync 失败（目录不存在/无写权限）按 write_failed 直接 reject，不建 stream；fd 关闭由 stream.destroy()（autoClose 默认）与 stream.end() 两路径收尾，无需手动 closeSync
- 新增「G-44-7 产物泄漏回归」describe（2 例）：密文分片拒转 + 协作式取消，reject 后延迟 ≥100ms（旧竞态的复现窗口）断言产物文件不存在；总测试 25/25 全绿，既有 23 项零回归

## Task Commits

1. **Task 1: convertToMp4 产物流改同步 fd 创建** - `2e9f217` (fix)
2. **Task 2: G-44-7 产物泄漏回归测试（密文拒转 + 协作式取消）** - `da0aad8` (test)

## Files Created/Modified

- `media-remuxer.js` - convertToMp4 产物创建改 fs.openSync(outputPath,'w') + fs.createWriteStream(outputPath,{fd})；openSync 失败按 write_failed reject；JSDoc 补 G-44-7 时序语义
- `tests/test-media-remuxer.js` - 新增「G-44-7 产物泄漏回归」describe（2 例延迟存在性断言）；头部注释补 G-44-7 覆盖说明

## Decisions Made

- 保留 `fs.createWriteStream` 字面调用（`{ fd }` 形式）：tests/test-media-remuxer.js 的流式写盘结构断言（`src.includes('fs.createWriteStream')`）依赖该字面量，且 mux.js 流式写盘契约（T-44-17 不全量入内存）不变
- 未触碰 mux.js 时序硬约束、嗅探检查点位置、empty_output 终检、shouldCancel 协作式取消——行为契约不变，仅清理时序从竞态变确定（按计划边界执行，44-18 的加密源入口拦截不越界）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None。基线 23 项测试改动前后均全绿，新增 2 项回归一次通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-44-7 双因链的「泄漏层」半边已闭合；「加密源入口拦截 + key URI 缓存分类」半边由 44-18 处理（零文件交集）
- 44-18 完成后 G-44-7 可整体关闭

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-07*

## Self-Check: PASSED

- FOUND: media-remuxer.js（含 fs.openSync 同步 fd 创建）
- FOUND: tests/test-media-remuxer.js（含 G-44-7 产物泄漏回归 describe，25 tests / 0 fail）
- FOUND: commit 2e9f217（Task 1 fix）
- FOUND: commit da0aad8（Task 2 test）
- 无关改动 src/settings-page.js / src/settings.html 未触碰、未提交

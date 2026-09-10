---
phase: 44
plan: 14
subsystem: player-window-lifecycle
tags: [gap-closure, G-44-2, electron-uaf-mitigation, deferred-destroy, diagnostics]
requires: []
provides:
  - "播放器窗口关闭先 hide 后 300ms 延迟 destroy（G-44-2 规避）"
  - "renderer 用户关 tab 的 webview guest 延迟销毁（deferredRemoveWebview）"
  - "dev/debug 环境 webContents 销毁诊断日志（id + type + 最近 URL）"
affects: [44-15 (43.3.0 → 43.4.11 补丁线升级，与本计划防御纵深互补)]
tech-stack:
  added: []
  patterns:
    - "先隐藏后延迟销毁（hide → setTimeout(300) → close/remove）规避同步销毁窗口"
    - "destroyed 回调取局部变量 URL 而非 getURL()（销毁后取值抛错）"
key-files:
  created: []
  modified:
    - ipc-handlers.js
    - src/renderer.js
    - main.js
decisions:
  - "关窗延迟放行：playerClosing 置位提前到 finish() 同步段（早于定时器回调），延迟 close 经既有旁路直接放行不重入确认序列"
  - "renderer 判定标准落码注释：用户交互瞬间的 guest 销毁走延迟；tab 回收/跨窗口移动（3 处）保持同步，结论逐处注释"
  - "main.js 诊断并入既有 web-contents-created 订阅且置于 webview 类型早退之前——window 类型 webContents（播放器窗口本体）也纳入诊断"
metrics:
  duration: 约 25 分钟
  completed: 2026-09-07
status: complete
actuals:
  tokens: 2100   # diff 8170 chars / 4
  tasks: 3
  commits: 3
plan_head_before: a9b3e47d20d671789ba019d11423f577716fc26e
---

# Phase 44 Plan 14: G-44-2 闪退规避（延迟销毁 + 诊断日志）Summary

**One-liner:** 播放器窗口关闭与用户关 tab 的 guest webContents 销毁改为先隐藏后约 300ms 延迟销毁，收窄 Electron 43.3.0 上游键盘 ACK use-after-free 的两个已知触发窗口；dev 环境留存被销毁 webContents 的 id+URL 诊断日志。

## What Was Done

### Task 1: 播放器窗口关闭序列延迟销毁（ipc-handlers.js）— commit 334adc3
- 模块级常量 `PLAYER_CLOSE_DESTROY_DELAY_MS = 300`
- `beginCloseSequence` 的 `finish()`：确认/ack 完成后先打诊断日志（webContents id + getURL，try/catch 包裹）→ `hide()` → `playerClosing = true`（同步置位，延迟 close 事件经 `close` handler :2093 旁路直接放行）→ 300ms 后 `close()`（isDestroyed 守卫 + try/catch，期间窗口已销毁则静默跳过）
- 未触碰：确认分支（recordCloseAction，UAT test 8 pass 区）、500ms ack 超时、`closed` handler 清理

### Task 2: renderer webview guest 延迟销毁（src/renderer.js）— commit 662403c
- 新增 `deferredRemoveWebview(webviewEl, delayMs = 300)`：CSSOM `display='none'` 立即摘除布局，setTimeout 后 `remove()`，全程 try/catch，仅 DOM API + setTimeout（renderer 无 Node 全局）
- `destroyWebview(tabId, { deferred = false })`：deferred=true 走延迟；`closeTab`（键盘/右键/批量关闭的共用汇聚点）传 `{ deferred: true }`
- 判定标准写进注释并逐处落实：`handleTabRecycled`（程序化静默回收）、`handleTabRemovedFromMain` / `removeTabFromUI`（跨窗口移动语境）三处保持同步移除
- 导航回归：`node tests/test-unified-navigation.js` 32/32 全绿

### Task 3: dev 环境 webContents 销毁诊断日志（main.js）— commit d92dfeb
- 并入既有 `web-contents-created` 订阅，置于 webview 类型早退**之前**——覆盖全部类型（含播放器窗口本体的 window 类型）
- 仅 `NODE_ENV ∈ {development, debug}`：`did-navigate`/`dom-ready` 记录最近 URL 到局部变量，`destroyed` 一次性打印 `[Realm] webContents destroyed id=… type=… url=…`（不回调 getURL）；生产/Nightly 零输出；无行为逻辑新增

## Verification

1. `node --check` ipc-handlers.js / src/renderer.js / main.js 全过 ✅
2. `node tests/test-unified-navigation.js` 32 项断言全绿 ✅
3. git diff a9b3e47..HEAD：仅 ipc-handlers.js / main.js / src/renderer.js 三文件；media-record-engine.js、media-task-manager.js、settings.html、src/settings-page.js、src/preload.js **零 diff**（录制链路逐字节一致 + prohibitions 全守住）✅
4. human-check（本计划未执行，留给阶段收尾）：npm run dev 真机 5 轮「开始录制 → 停止 → 关闭播放器窗口（含 Cmd+W）」无 SIGSEGV，终端可见 webContents destroyed 日志

## Deviations from Plan

None - plan executed exactly as written.

唯一裁量点：Task 3 计划说「若已有 web-contents-created 订阅则并入，不重复注册」——既有订阅开头即对非 webview 类型 early-return，若并入在早退之后会漏掉播放器窗口本体（G-44-2 明确列名候选对象），故诊断块置于早退之前完成合并，仍为单次注册。

## Human Verification Needed（阶段收尾 UAT 覆盖）

- 真机 5 轮「播放器开始录制 → 停止 → 关窗（含 Cmd+W）」全程存活；关窗时终端应出现 `播放器窗口关闭销毁 webContents id=…` 与 `webContents destroyed id=…` 日志
- 注意：规避是结构化收窄而非确定性修复（heisenbug），若仍闪退，最后一条 destroyed 日志即被销毁对象，可对照 .planning/debug/stop-record-sigsegv.md 根因链继续二分

## Self-Check: PASSED

- 334adc3 / 662403c / d92dfeb 三提交均存在于 git log ✅
- SUMMARY 位于 .planning/phases/44-/44-14-SUMMARY.md ✅

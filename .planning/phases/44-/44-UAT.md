---
status: testing
phase: 44-player-video-cache-and-local-media-library
source: [44-VERIFICATION.md]
started: 2026-09-06T15:00:00Z
updated: 2026-09-06T15:00:00Z
---

## Current Test

number: 1
name: 真机重开已看视频秒开体感（CR-01 修复后）
expected: |
  重开同一视频已看部分立即起播、网络面板/日志无分片回源请求；接着上次进度继续
awaiting: user response

## Tests

### 1. 真机重开已看视频秒开体感（CR-01 修复后；前次第 1 项，未被修复证伪）
expected: 重开同一视频已看部分立即起播、网络面板/日志无分片回源请求；接着上次进度继续
result: [pending]

### 2. webview tab 模式播放回归（D-01；前次第 2 项，未被修复证伪）
expected: webview tab 内播放行为与 Phase 43 完全一致，无缓存落盘、无 mode=independent 行为
result: [pending]

### 3. 断网/源站失效降级提示条（CR-01 修复后；前次第 3 项，修复后该测试才有意义）
expected: 播放中断网：已缓存分片继续播、提示条「部分分片加载失败，已缓存部分可继续观看」约 4s 消失、恢复网络后播放续上
result: [pending]

### 4. 直播录制全链路（真实直播源；前次第 4 项，CR-04 修复后停止语义才正确）
expected: 录制按钮→红点闪烁→hover tooltip「已录 mm:ss · xxxMB」→停止→任务页可见→关窗/退出确认→产物 meta.json 正确
result: [pending]

### 5. 系统通知与 Finder 定位（打包版优先，dev 环境 Notification 可能静默；前次第 5 项）
expected: convert 完成/失败通知弹出，点击定位产物
result: [pending]

### 6. mux.js 真机转封装产物可播性（前次第 6 项）
expected: 录制→停止→自动弹框→转换→产物在 QuickTime/IINA 播放，时长/进度/音画正常
result: [pending]

### 7. 任务页三区渲染/空态/角标显隐/设置分区即改即存（前次第 7 项）
expected: 三区与状态文案符合 UI-SPEC；角标 count>0 显示归零消失、点击跳 realm://tasks；改缓存目录/容量即时生效（改小容量触发淘汰）
result: [pending]

### 8. 抽屉增删/续播/转换按钮 gating（D-17；前次第 8 项）
expected: 抽屉条目展示、删除确认框居中、完整度 100% 或中断条目才显「转换为 MP4」
result: [pending]

### 9. 崩溃中断任务续转实况（WR-C 派生新增项——决定 D-18 硬崩溃承诺是否需 44-09）
expected: 可控模拟：录制进行中 kill 主进程 → 重启 → 任务页该任务显示「已中断」→ 点「已落盘部分续转」：因录制中从不写 meta.json（writeMeta 仅 stop/fail/pl.ended/异常兜底四路径），RECORD_ROOT/<taskId>/ 无 meta.json，readRecordTaskSegments 短路返回 null → 仍 400 no_segments（.ts 分片滞留目录）。请判定：此项属可接受边界（记 REVIEW.md 债务，建议录制中周期性写轻量 meta 或按 <seq>.ts 文件名合成索引）还是必须本阶段闭合
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

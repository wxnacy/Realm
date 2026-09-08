---
status: testing
phase: 45-bilibili-fmp4-transcode
source: [45-VERIFICATION.md]
started: 2026-09-08T05:30:00Z
updated: 2026-09-08T05:30:00Z
---

## Current Test

number: 1
name: 真实 B 站直播录制 tracer（45-02 PLAN human-check）
expected: |
  画面 + 声音正常播放。已知容忍项不判 fail（D-02「能看就行」）：播放器总时长垃圾值（85h 量级，tfdt epoch 基线）、VLC Fragment sequence discontinuity 警告
awaiting: user response

## Tests

### 1. 真实 B 站直播录制 tracer（45-02 PLAN human-check）
步骤：`npm run dev` 打开 B 站 fMP4 直播间（http_hls/fmp4/avc），播放器录制 ≥30 秒后停止，录制停止自动接力弹框（或任务页续转）转出 mp4，用 mpv 或 VLC 打开
expected: 画面 + 声音正常播放。已知容忍项不判 fail（D-02「能看就行」）：播放器总时长垃圾值（85h 量级，tfdt epoch 基线）、VLC Fragment sequence discontinuity 警告
result: [pending]

### 2. 缓存链路 fMP4 转换 + QuickTime A1（45-03 PLAN human-check）
步骤：`npm run dev` 播放 fMP4 VOD 源（B 站直播/回放），确认 init 经 /proxy 留存（缓存目录出现 init 文件），抽屉/任务页点「转换为 MP4」，mpv/VLC 打开产物；再用 QuickTime Player 打开任一拼接产物
expected: mpv/VLC 画面+声音可播即通过；BYTERANGE/差异形态应落 init_missing 拒转文案而非坏产物（RESEARCH A4，此分支也算验证点）；QuickTime 失败不阻塞（A1，mpv/VLC 已实测兜底，结果记入 UAT 供用户决策）
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

---
status: complete
phase: 45-bilibili-fmp4-transcode
source: [45-VERIFICATION.md]
started: 2026-09-08T05:30:00Z
updated: 2026-09-08T08:51:19Z
---

## Current Test

[testing complete]

## Tests

### 1. 真实 B 站直播录制 tracer（45-02 PLAN human-check）
步骤：`npm run dev` 打开 B 站 fMP4 直播间（http_hls/fmp4/avc），播放器录制 ≥30 秒后停止，录制停止自动接力弹框（或任务页续转）转出 mp4，用 mpv 或 VLC 打开
expected: 画面 + 声音正常播放。已知容忍项不判 fail（D-02「能看就行」）：播放器总时长垃圾值（85h 量级，tfdt epoch 基线）、VLC Fragment sequence discontinuity 警告
result: pass
note: 修复后原容忍项「总时长垃圾值」已被 45-04 tfdt rebase 根治，时间轴从 0 开始

### 2. 缓存链路 fMP4 转换 + QuickTime A1（45-03 PLAN human-check）
步骤：`npm run dev` 播放 fMP4 VOD 源（B 站直播/回放），确认 init 经 /proxy 留存（缓存目录出现 init 文件），抽屉/任务页点「转换为 MP4」，mpv/VLC 打开产物；再用 QuickTime Player 打开任一拼接产物
expected: mpv/VLC 画面+声音可播即通过；BYTERANGE/差异形态应落 init_missing 拒转文案而非坏产物（RESEARCH A4，此分支也算验证点）；QuickTime 失败不阻塞（A1，mpv/VLC 已实测兜底，结果记入 UAT 供用户决策）
result: pass
retest: 2026-09-08 修复后复测通过（45-04 tfdt rebase 上线）：时间轴从 0 开始、总时长 ≈ 录制时长，G-45-2 关闭

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-45-2
  truth: "拼接产物 MP4 时间轴从 0 开始，总时长等于录制时长（十几秒）"
  status: resolved
  resolution: "45-04 tfdt rebase（rebaseFmp4SegmentTfdt walker + concatFmp4ToMp4 集成）上线，2026-09-08 用户真机复测通过"
  original_report: "可以正常播放，但是时间不对，录制的只有十几秒，但是时间显示的应该是直播的时间，应该重置里边的时间"
  severity: major
  test: 2
  root_cause: "concatFmp4ToMp4（media-remuxer.js:470-596）纯字节拼接：stream.write 原样写出 init 与分片，不解析/不改写 moof/traf/tfdt，也不向 init moov 注入 elst。B 站直播 fMP4 分片 tfdt 为 epoch 级大数（约 143h 绝对时刻），被逐字节保留进产物，播放器以首个 tfdt 为时间轴基准。全仓无 tfdt/elst/CTS 处理代码。录制 tracer 与缓存链路共用同一 convertToMp4 → concatFmp4ToMp4 入口，单点修复覆盖两链路（Test 1 通过仅因 D-02 容忍豁免，潜伏同一缺陷）。"
  artifacts:
    - path: "media-remuxer.js"
      issue: "concatFmp4ToMp4 拼接循环（:533-551）写出分片前未做 tfdt rebase；终检不校验时间轴"
  missing:
    - "分片写出前用轻量 box walker 遍历 moof→traf→tfdt，按轨各自减去该轨首个分片的 baseMediaDecodeTime 基线（视频 90kHz/音频 48kHz per-track 基线）"
    - "tfdt 兼容 v0（32 位）/v1（64 位）两种 box 宽度，原位等长改写"
    - "基线采集须在首片写出前完成；产物首片 tfdt=0 的夹具测试（mux.js generator 构造大数 tfdt moof）"
  debug_session: .planning/debug/fmp4-timeline-not-rebased.md

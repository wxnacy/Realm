---
status: diagnosed
trigger: "G-45-2: 可以正常播放，但是时间不对，录制的只有十几秒，但是时间显示的应该是直播的时间，应该重置里边的时间"
created: 2026-09-08T00:00:00Z
updated: 2026-09-08T00:00:00Z
goal: find_root_cause_only
symptoms_prefilled: true
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: diagnosed
---

## Current Focus

hypothesis: 【已证实】concatFmp4ToMp4 纯字节拼接原样保留分片 tfdt epoch 基线，无 elst/CTS 重基线
test: 已读 media-remuxer.js:470-596 全文 + 全仓 grep tfdt|elst|baseMediaDecodeTime
expecting: 符合 — 拼接执行体零时间戳处理
next_action: diagnose-only 模式返回 ROOT CAUSE FOUND，不修码

## Symptoms

expected: 拼接产物 MP4 时间轴从 0 开始，总时长等于录制时长（十几秒）
actual: 可以正常播放，但时间轴显示直播流的绝对时间（143:53:42 / 143:53:55），tfdt epoch 基线原样保留
errors: None（播放正常，仅时间轴错误）
reproduction: UAT Test 2 — npm run dev 播放 fMP4 源，录制/缓存后「转换为 MP4」，mpv/VLC 打开产物
started: Phase 45 UAT 期间发现（已知容忍项，用户现明确要求修复）

## Eliminated

（暂无）

## Evidence

- timestamp: 2026-09-08T00:00:00Z
  checked: 45-RESEARCH.md Q2/Route B
  found: RESEARCH 已实测确认垃圾时长根因 = 分片 tfdt（baseMediaDecodeTime）为 epoch 级大数（ffprobe start_time=307426s ≈ 85.4h）；mvhd duration=0 是 RFC 8216 强制非 bug；Route B「tfdt rebase」当时建议 defer（D-02 容忍带内），用户 UAT 后明确要求修复
  implication: 根因方向已锁定 tfdt 未 rebase；需在拼接链路找确切未改写的代码点

- timestamp: 2026-09-08T00:05:00Z
  checked: media-remuxer.js:470-596 concatFmp4ToMp4 全文
  found: 拼接为纯字节拷贝——init 校验 ftyp 头后 stream.write(initBuf)（:531），随后逐分片 stream.write(fs.readFileSync(segPath))（:543）原样写出；JSDoc :446-450 明确声明「不解析 moof/trun 内部（攻击面 = 字节拷贝）」；终检只校验 ftyp/moov 存在 + moof 计数，不涉时间戳
  implication: 分片内每个 moof/traf/tfdt 的 baseMediaDecodeTime（B 站直播 = epoch 秒级大数，用户截图 143:53:42 ≈ 当前时刻）逐字节保留进产物，零改写

- timestamp: 2026-09-08T00:06:00Z
  checked: 全仓 grep `tfdt|elst|baseMediaDecodeTime`（*.js）
  found: 项目源码零命中，命中全部在 node_modules（mux.js/hls.js/dashjs 等）；无任何 tfdt 重写、elst（edit list）写入或 CTS 偏移代码
  implication: 产物 init 的 moov 只有 mvhd duration=0（RFC 8216 强制）+ mvex，无 elst；分片 tfdt 又大数——播放器以 tfdt 为时间轴零点依据，故显示直播绝对时间

- timestamp: 2026-09-08T00:07:00Z
  checked: media-remuxer.js:379-404 嗅探分流 + 45-02/45-03 SUMMARY 编排链路
  found: 录制 tracer（startConvertFromRecordTask → startConvertTask）与缓存链路（startConvertFromInput → startConvertTask）两链路统一经 convertToMp4，首片嗅探命中 fmp4_container 且 initPath 存在 → :398 委托同一个 concatFmp4ToMp4
  implication: 单一修复点即可覆盖两链路；Test 1（录制链路）pass 只是因 D-02 容忍项豁免，潜伏同一缺陷

## Resolution

root_cause: concatFmp4ToMp4（media-remuxer.js:470-596）纯字节拼接——init + 分片逐字节原样写出（:531/:543），不解析/重写 moof/traf/tfdt，也不在 init moov 注入 elst；B 站直播分片 tfdt baseMediaDecodeTime 为 epoch 级大数被原样保留，产物时间轴零点 = 直播流绝对时间而非录制起点。全仓无任何 tfdt/elst 处理代码（grep 证实）。两链路（录制 tracer + 缓存转换）共用此函数，同修一个点。
fix: [空 — diagnose only，建议方向见诊断输出]
verification: [空]
files_changed: []

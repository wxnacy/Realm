---
phase: 45-bilibili-fmp4-transcode
plan: 04
subsystem: media
tags: [fmp4, tfdt, mp4-box-walker, bilibili, hls, mux.js, timeline-rebase]

# Dependency graph
requires:
  - phase: 45-bilibili-fmp4-transcode
    provides: 45-01 concatFmp4ToMp4 纯字节拼接执行体 + 45-02/45-03 initPath 两链路透传
provides:
  - rebaseFmp4SegmentTfdt 导出纯函数（moof→traf→tfhd/tfdt 轻量 walker，按轨基线减差原位改写）
  - concatFmp4ToMp4 分片写出循环 tfdt rebase 集成（录制 tracer 与缓存转换两链路单点覆盖）
  - fMP4 拼接产物时间轴从 0 开始、总时长 = 录制时长（G-45-2 自动化部分闭合）
affects: [media-remuxer, video-cache, record-engine, phase-45-uat]

# Actuals (#2632)
actuals:
  tokens: 7846
  tasks: 2
  commits: 5
plan_head_before: 5a63a1373ac5f9554b521acbf91f44aa7c9c0838

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fMP4 box walker：逐 box 边界校验 + 声明 size 不信任（循环界只受 buffer 实际长度约束），畸形即停止该层不 throw"
    - "tfdt 按轨基线 rebase：baselines Map(track_ID→首见 baseMediaDecodeTime) 跨分片复用，v1 BigInt / v0 Number，等长原位改写"

key-files:
  created: []
  modified:
    - media-remuxer.js
    - tests/test-media-remuxer.js

key-decisions:
  - "单点修复：tfdt rebase 集成在 concatFmp4ToMp4 分片写出循环（baselines Map 在 init 写出后/循环前创建一次），录制 tracer 与缓存链路共用入口，单点覆盖两链路"
  - "基线语义：首片 tfdt 记录为该轨基线并改写为 0；当前值<基线（乱序/回拨）保守不改写原样保留"
  - "遵守 locked prohibitions：不修 init moov/mvhd、不注入 elst、零新依赖、不做 moof/trun 解析重打包（产物 init 段逐位一致有测试断言兜底）"

patterns-established:
  - "远端字节 walker 容错模式：每 box 读取前边界校验（size>=头宽 且 offset+size<=区间末尾），违反即停止该层遍历不 throw；未知 box 原样跳过"

requirements-completed: [G-45-2, D-01, D-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "rebaseFmp4SegmentTfdt walker：v1 epoch 基线归零/递减排差/双轨独立基线/v0 兼容/等长原位改写/多 moof/零基线恒等/畸形容忍/回拨保守不改写"
    requirement: G-45-2
    verification:
      - kind: unit
        ref: "tests/test-media-remuxer.js#rebaseFmp4SegmentTfdt tfdt 时间轴 rebase walker（G-45-2）（10 例）"
        status: pass
    human_judgment: false
  - id: D2
    description: "concatFmp4ToMp4 集成 rebase：产物首 moof 首 tfdt==0 + 递减排差、双轨各自归零、init 段逐位一致、零基线产物字节精确相等、TS/取消/失败路径零回归"
    requirement: G-45-2
    verification:
      - kind: integration
        ref: "tests/test-media-remuxer.js#concatFmp4ToMp4 tfdt rebase 集成（G-45-2 产物时间轴归零）（3 例）+ 既有套件回归（51/51）"
        status: pass
      - kind: unit
        ref: "node tests/test-media-cache.js（34/34）+ node tests/test-media-record-duration.js（6/6）"
        status: pass
    human_judgment: false
  - id: D3
    description: "真实 B 站直播录制 + fMP4 VOD 缓存转换两链路产物在 mpv/VLC 中时间轴从 0 开始、总时长 ≈ 录制时长（UAT Test 2 复测）"
    requirement: G-45-2
    verification: []
    human_judgment: true
    rationale: "真实直播流行为（播放器时间轴展示、音画可播）无法离线自动化断言；自动化测试一律不打真实网络（RESEARCH Pitfall 7 红线）。按计划 <human-check> 设计，留待 end-of-phase UAT 收割"

# Metrics
duration: 20min
completed: 2026-09-08
status: complete
---

# Phase 45 Plan 04: fMP4 拼接产物 tfdt 时间轴 rebase（G-45-2 gap closure）Summary

**moof→traf→tfdt 轻量 box walker 按轨减去 epoch 级基线并原位改写，fMP4 拼接产物时间轴从 0 开始（v1 BigInt / v0 Number 等长改写，畸形容忍，零新依赖）**

## Performance

- **Duration:** 20min
- **Started:** 2026-09-08T07:59:36Z
- **Completed:** 2026-09-08T08:19:56Z
- **Tasks:** 2（均 TDD：RED → GREEN 各 2 轮）
- **Files modified:** 2

## Accomplishments

- `rebaseFmp4SegmentTfdt(buf, baselines)` 导出纯函数：轻量 box walker 遍历 moof→traf→tfhd/tfdt，按轨减去该轨首次见到的 baseMediaDecodeTime 基线；v1（64 位）BigInt 读写防精度溢出（T-45-06）、v0（32 位）Number；只写 tfdt 值域原位字节（等长改写，box 结构与大小零变化）；逐 box 边界校验 + 循环界只受 buffer 实际长度约束（T-45-04/T-45-05），截断/非法 size/largesize/未知 box/无 tfdt traf 均容忍不抛
- `concatFmp4ToMp4` 分片写出循环集成 rebase（baselines Map 在 init 写出后、循环前创建一次，首片写出前完成基线采集）：录制 tracer 与缓存转换两链路共用此入口，单点修复覆盖两链路；取消检查/进度回调/fail 清理/终检结构零改动
- 产物级断言落地 G-45-2 验收：大数 tfdt 产物首 moof 首 tfdt==0、递减排差 `[0n, 270000n, 540000n]`、双轨各自归零不串轨、init 段与输入逐位一致（不修 moov prohibition 可执行断言）、零基线产物字节精确相等（零回归）
- JSDoc/文件头/循环内联注释同步修订（防表述腐化）：「纯字节拼接不解析 moof/trun」→「只做 moof→traf→tfdt 定位与 tfdt 值域原位改写，不解析 trun/sample 表，攻击面 = 边界校验 walker + 字节拷贝」

## Task Commits

TDD 任务各含 RED + GREEN 两个原子提交：

1. **Task 1 RED: rebaseFmp4SegmentTfdt walker 用例组** - `b574c65` (test)
2. **Task 1 GREEN: rebaseFmp4SegmentTfdt 实现** - `85b1c75` (feat)
3. **Task 2 RED: concatFmp4ToMp4 产物级断言** - `3af81a6` (test)
4. **Task 2 GREEN: concatFmp4ToMp4 集成 rebase + 文档同步** - `d41e759` (feat)

**Plan metadata:** 见下方 docs 提交（SUMMARY + STATE/ROADMAP/REQUIREMENTS）

## TDD Gate Compliance

两轮 RED → GREEN 均按门禁执行，证据经 `gsd-tools check tdd-red-evidence` 校验：

| 轮次 | RED 提交 | RED 证据 | GREEN 提交 | 结果 |
|------|---------|---------|-----------|------|
| Task 1 | `b574c65` | RED_EVIDENCE_OK（48 tests / 38 pass / 10 fail 全在新套件，首例为 typeof 断言失败） | `85b1c75` | 48/48 绿 |
| Task 2 | `3af81a6` | RED_EVIDENCE_OK（51 tests / 49 pass / 2 fail 均为大数 tfdt 产物断言） | `d41e759` | 51/51 绿 |

无 REFACTOR 提交（实现无需清理）。零基线恒等用例在 Task 2 RED 阶段即绿——其为回归守卫而非新行为断言，符合预期。

## Files Created/Modified

- `media-remuxer.js` - 新增导出 `rebaseFmp4SegmentTfdt`（+125 行含 JSDoc）；`concatFmp4ToMp4` 分片循环三步拆分（readFileSync → rebase → write）+ baselines Map；文件头/JSDoc/内联注释同步修订
- `tests/test-media-remuxer.js` - 新增 2 个 describe（walker 10 例 + 产物级 3 例）；夹具扩展（makeFragment 增 baseMediaDecodeTime/track 可选参数、FMP4_AUDIO_TRACK、makeDualTrackFragment、makeV0TfdtMoof、readTfdtValues）

## Decisions Made

- **单点修复覆盖两链路**：rebase 只集成在 `concatFmp4ToMp4` 分片写出循环——录制 tracer（startConvertFromRecordTask）与缓存链路（startConvertFromInput）经 convertToMp4 嗅探分流共用此入口（诊断 .planning/debug/fmp4-timeline-not-rebased.md 已锁定）
- **基线采集时序**：baselines Map 在 init 写出后、分片循环前创建一次——首片处理时按轨采集基线先于其写出，满足「基线采集须在首片写出前完成」
- **异常形态保守策略**：当前 tfdt 值 < 该轨基线（分片乱序/时钟回拨）不改写原样保留，不引入负值/回绕
- **遵守 locked prohibitions**：不修 init moov/mvhd（mvhd duration=0 是 RFC 8216 §3.3 强制形态）、不注入 elst、零新依赖（package.json 无增量）、不做 moof/trun 解析重打包——产物 init 段逐位一致由测试断言兜底

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 测试 helper readTfdtValues 无法解析 largesize box**
- **Found during:** Task 1 GREEN（畸形容忍用例 ③ size==1 largesize）
- **Issue:** mux.js probe.findBox 不认 size==1 largesize 编码（size≤1 一律视为「到 buffer 末尾」），含 largesize box 的 buffer 经 findBox 遍历找不到任何 moof → readTfdtValues 返回空数组，断言 `tfdts[0].value` TypeError
- **Fix:** 该用例改按 box 布局直接读回（`indexOf('tfdt') + 8` 定位值域 readBigUInt64BE），不依赖 findBox；walker 实现本身无误（返回计数 1 的断言已通过）
- **Files modified:** tests/test-media-remuxer.js
- **Verification:** 全套件 48/48 绿
- **Committed in:** `85b1c75`（Task 1 GREEN 提交的一部分）

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug，测试 helper 修正，非生产代码问题)
**Impact on plan:** 仅测试基础设施修正，不改变 walker 设计或计划范围。无 scope creep。

## Issues Encountered

None — 计划诊断与 RESEARCH 充分（fixture 构造方式、mux.js generator tfdt v1 写法均有实测指引），执行一次通过。

## Authentication Gates

None.

## Pending Human Verification（end-of-phase UAT 收割）

**真实流复测（UAT Test 2 场景重跑，计划 <human-check>）：**
1. `npm run dev` 打开 B 站 fMP4 直播间（http_hls/fmp4/avc），播放器录制 ≥15 秒后停止，转出 mp4（录制 tracer 链路）
2. 播放 fMP4 VOD 源确认 init 经 /proxy 留存后，抽屉/任务页点「转换为 MP4」（缓存链路）
3. 两个产物分别用 mpv 或 VLC 打开

**预期：** 时间轴从 0 开始，总时长 ≈ 录制/转换时长（十几秒显示十几秒，不再是 143 小时量级）；画面+声音正常播放（D-02「能看就行」原标准不降低）。

自动化测试不打真实网络（RESEARCH Pitfall 7 红线），本项按计划设计留待 end-of-phase UAT。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-45-2 自动化验收全绿（产物级断言 + 三媒体套件回归 91 例），UAT Test 2 复测就绪（两链路共用修复点，一次复测同时覆盖）
- 无新增技术债；威胁模型 T-45-04/T-45-05/T-45-06 mitigation 全部落地（边界校验/循环界约束/BigInt 算术）
- 待 UAT 复测通过后 G-45-2 major issue 关闭，Phase 45 可收尾

## Self-Check: PASSED

- 文件存在：media-remuxer.js ✓、tests/test-media-remuxer.js ✓、45-04-SUMMARY.md ✓
- 提交存在：b574c65 ✓、85b1c75 ✓、3af81a6 ✓、d41e759 ✓
- 导出验证：`remuxer.rebaseFmp4SegmentTfdt` 为函数 ✓
- 验收复跑：`node tests/test-media-remuxer.js`（51/51）+ `node tests/test-media-cache.js`（34/34）+ `node tests/test-media-record-duration.js`（6/6）全绿 ✓

---
*Phase: 45-bilibili-fmp4-transcode*
*Completed: 2026-09-08*

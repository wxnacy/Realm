---
status: diagnosed
trigger: "录制中红色按钮 hover 显示的录制时长更新不及时：有时长时间不变，有时突然一次跳好几秒"
created: 2026-09-07T00:00:00+08:00
updated: 2026-09-07T00:00:00+08:00
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "tooltip 时长抖动的根因是 UI 展示的 durationSeconds 取自录制引擎的『分片数 × targetDuration』乘积（media-record-engine.js:296），而分片数只在分片完整下载落盘时增长（downloadSegment，:148）；分片落盘节奏受网络/直播边缘抖动影响不均匀，导致显示时长阶梯式跳变且与真实挂钟时间脱钩"
  confirming_evidence:
    - "player.js:893-909：hover tooltip 由 setInterval(1000ms) 本地驱动每秒刷新（UI 轮询本身无问题，排除『事件不来/只读一次』假设）"
    - "player.js:898：显示值 = s.durationSeconds，来自 IPC getRecordStatus"
    - "media-record-engine.js:296：durationSeconds = st.recorded.size * st.targetDuration（JSDoc :282 自述为近似值『已录时长≈分片数×targetDuration』）"
    - "media-record-engine.js:142-159：st.recorded 仅在 downloadSegment 完成（fetchPage + writeFileSync 落盘）后才 +1；下载中/未开始的分片不计入"
    - "media-record-engine.js:198-256：轮询循环串行处理（拉清单→逐个 await 下载→再 sleep max(2s, targetDuration)），每个分片平均 2~4s 才有机会落盘一次；demo scte35.isml 约 2s 分片 → 显示时长天然 2s+ 粒度"
    - "targetDuration 是清单声明的 EXT-X-TARGETDURATION（整数，通常≥实际 EXTINF），count×target 与真实累计 EXTINF 之和也有系统性偏差"
  falsification_test: "若把显示值换成 Date.now() - startedAt（本地时钟差）而抖动仍存在，则本假设被证伪；反之换掉后即平滑（代码结构上必然成立）"
  fix_rationale: "修复方向是让 durationSeconds 基于本地时钟（任务开始时间戳）而非分片落盘事件推进——计划阶段（/gsd-plan-phase 44 --gaps）决定具体方案（如 st.startedAt = Date.now() 差值，或混合：时钟差显示 + meta.json 仍保留分片累计真实时长）"
  blind_spots: "未实测运行时行为（无日志可查、无法复现网络抖动环境），结论基于代码路径直接读证；但机制是确定性的（Bohrbug 类），症状模式（平一段→跳几秒）与 2s 粒度乘积完全吻合"
  candidate_causes:
    - "code: durationSeconds 数据源设计为『分片数×targetDuration』近似值，量化到分片落盘事件（根因）"
    - "environment: 网络/直播边缘分片到达节奏抖动是触发器，但它只放大了 code 层的量化设计，不是缺陷本身"
  and_gate: "no —— 单一贡献条件即可解释全部症状；环境抖动只是让量化缺陷可被感知"

hypothesis: 已确认（见上 reasoning_checkpoint）
test: 代码路径直读 + 链路追踪（player.js → preload → ipc-handlers.js:2414 → media-record-engine.js）
expecting: N/A
next_action: 返回 ROOT CAUSE FOUND（goal: find_root_cause_only），修复交由 plan-phase --gaps

## Symptoms

expected: 录制中红色按钮 hover 显示的录制时长应平滑连续更新（约每秒推进 1s）
actual: 「现在播放器右上角红色按钮，鼠标放上去显示时间更新不及时，有时半天不改变时间，有时又突然增加好几秒」。出现场景为录制统一流媒体 TS 直播源（demo.unified-streaming.com scte35.isml，~2s 分片）期间。
errors: 无相关报错日志
reproduction: Test 4 in UAT（录制过程中 hover 红色按钮观察时长显示）
started: Discovered during UAT 2026-09-07（dev 环境）

## Eliminated

- hypothesis: "UI tooltip 定时器有问题（不刷新/间隔过长/只在 mouseenter 读一次）"
  evidence: "player.js:902-908：mouseenter 启动 setInterval(refreshRecordTooltip, 1000)，每秒刷新，mouseleave 清除；定时器本身工作正常"
  timestamp: 2026-09-07
- hypothesis: "主进程进度事件不推送导致 UI 不更新"
  evidence: "数据流不是事件推送而是 IPC 轮询拉取（player:record/status → recordEngine.getRecordStatus）；每次调用都实时返回，拉取链路无缓存"
  timestamp: 2026-09-07

## Evidence

- timestamp: 2026-09-07
  checked: src/player.js:891-925（红点 hover tooltip 刷新链路）
  found: "setInterval 1000ms 驱动，每秒调 getRecordStatus 并写入 recordDotTooltip.textContent；显示值为 s.durationSeconds"
  implication: "UI 层刷新机制正常，抖动来自数据源"
- timestamp: 2026-09-07
  checked: media-record-engine.js:282-315 getRecordStatus / :142-159 downloadSegment / :198-256 pollLoop
  found: "durationSeconds = st.recorded.size * st.targetDuration（:296）；st.recorded 仅在分片完整下载落盘后增长（:148）；轮询循环串行：拉清单→逐个下载→sleep max(2s, targetDuration)（:254）"
  implication: "显示时长量化到『分片落盘事件』，粒度 ≥2s；分片落盘节奏受网络抖动不均匀（有时一轮 0 个新分片、有时一轮多个），完整解释『半天不变+突然跳几秒』"
- timestamp: 2026-09-07
  checked: 链路中间层 src/preload.js:1689、ipc-handlers.js:2414
  found: "getRecordStatus 直通转发，无转换无缓存"
  implication: "中间层无嫌疑，根因收敛在引擎的 durationSeconds 计算式"

## Resolution

root_cause: "media-record-engine.js:296 getRecordStatus 返回的 durationSeconds = 已落盘分片数 × targetDuration——是量化到分片落盘事件的近似值（代码 JSDoc :282 自述『≈』），而非本地时钟推进的真实时长。分片落盘节奏受网络/直播边缘抖动影响不均匀（一轮 0 个新分片→平一段；一轮多个→跳几秒），UI 层（player.js:898）直接显示该值，1s 刷新也改变不了数据源本身的阶梯粒度"
fix: "(未实施，find_root_cause_only 模式) 方向：让运行中显示的时长基于本地时钟（任务 startRecord 时刻的 Date.now() 差值）平滑推进；meta.json/终态的累计 EXTINF 真实时长口径保持不变。具体方案由 plan-phase --gaps 决策"
verification: "(诊断模式，未修复不验证)"
files_changed: []

---
phase: 45-bilibili-fmp4-transcode
plan: 02
subsystem: media
tags: [fmp4, hls, ext-x-map, record-engine, convert-orchestration, bilibili]

requires:
  - phase: 45-01
    provides: parsePlaylist mapUri/mapByterange 捕获、concatFmp4ToMp4 拼接执行体、convertToMp4 initPath 嗅探分流、init_missing/invalid_init reason、mux.js generator 测试夹具
  - phase: 44-
    provides: 录制引擎 pollLoop/downloadSegment/writeMeta 骨架、readRecordTaskSegments/startConvertTask/startConvertFromRecordTask 编排、CONVERT_FAIL_TEXT 文案链路、附加 meta 字段不升版本先例
provides:
  - 录制引擎 init 分片留存（pollLoop 检查点，首轮 baseline 也下载；固定常量文件名 'init'）
  - meta.json 附加字段 mapUri/initFile/mapByterange（不升版本，旧 meta 缺字段 = fMP4 能力缺省关闭）
  - 编排层 initPath 两跳透传（readRecordTaskSegments → startConvertFromRecordTask → startConvertTask → convertToMp4）
  - CONVERT_FAIL_TEXT 覆盖 init_missing/invalid_init（Pitfall 5 闭环）
  - 录制链路 tracer stub e2e（清单带 MAP → init 落盘 → meta → convertToMp4 产物 probe 可解析）
affects: [45-03 缓存链路 MAP 排除+留存与 initPath 接线, media-record-engine, main.js 编排]

actuals:
  tokens: 3746
  tasks: 2
  commits: 2
plan_head_before: 58ee6821ab25dca9b0b5be477d3cdad745e9ec92

tech-stack:
  added: []
  patterns:
    - "init 检查点放首轮/追新分支之外每轮执行（Pitfall 1：init 不是媒体分片，D-21 baseline 只豁免分片回溯）"
    - "init 落盘固定常量文件名 'init'（T-44-11 远端 URI 不进路径），不进 seen/recorded 不占 seq 命名"
    - "init 下载当轮失败容忍下轮重试（不记 consecutiveFailures，st.mapUri 不登记即自然重试）"
    - "编排透传拆明两跳：中间跳 initPath: bundle.initPath 以 grep 断言作唯一自动化覆盖（stub e2e 绕过该跳）"

key-files:
  created: []
  modified:
    - media-record-engine.js
    - main.js
    - tests/test-media-record-duration.js
    - tests/test-media-remuxer.js

key-decisions:
  - "D-05 落地（录制侧）：pollLoop init 检查点在首轮/追新分支之外，首轮 baseline 即下载 init；MAP 变化重下分支按 RFC 语义保留（Pitfall 8，实测 B 站恒定只触发一次）"
  - "BYTERANGE 形态 MAP 不下载 init + console.warn（RESEARCH Route D）：登记 st.mapUri/st.mapByterange 防每轮重复告警，后续转换落 init_missing 兜底不静默产坏产物"
  - "init 下载失败不记 consecutiveFailures——init 缺失只影响后续转换不影响录制本体，st.mapUri 不登记故下轮自然重试"
  - "D-06 落地（编排侧）：编排层唯一变化 = convertToMp4 多传 initPath（弹框/注册/取消令牌/进度/终态零改动），录制 TS 条目 initPath=null 不影响既有 TS 路径"

patterns-established:
  - "tracer stub e2e 四层断言：首轮 init 落盘（500ms 时点直接证据）→ meta 自解释 → segments 无 init → convertToMp4 产物 probe 可解析"
  - "mux.js probe findBox 第二参为 box 路径数组（['moov']），字符串形态静默查不到——与 45-01 测试同款调用"

requirements-completed: [D-03, D-05, D-06]

coverage:
  - id: T1
    description: "录制引擎 init 留存：首轮 baseline 下载、meta.initFile/mapUri 附加、segments 无 init、BYTERANGE 不下载落 init_missing 兜底"
    requirement: D-05
    verification:
      - kind: e2e-stub
        ref: "tests/test-media-record-duration.js#fMP4 init 留存（D-05，45-02 tracer 端到端）"
        status: pass
    human_judgment: false
  - id: T2
    description: "编排层 initPath 两跳透传 + tracer 闭环：录制目录 init+segments 直调 convertToMp4 resolve 且产物 probe 检出 moov+4 moof"
    requirement: D-03
    verification:
      - kind: e2e-stub
        ref: "tests/test-media-record-duration.js#带 EXT-X-MAP 清单：首轮 baseline 即下载 init，meta 自解释，录制 → convertToMp4 闭环"
        status: pass
      - kind: grep
        ref: "main.js:3209 initPath: bundle.initPath（中间跳唯一自动化覆盖）"
        status: pass
    human_judgment: false
  - id: T3
    description: "CONVERT_FAIL_TEXT 覆盖 init_missing/invalid_init（Pitfall 5：任务页不落「未知原因」）"
    requirement: D-06
    verification:
      - kind: unit
        ref: "tests/test-media-remuxer.js#main.js CONVERT_FAIL_TEXT 覆盖全部新 reason"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-08
status: complete
---

# Phase 45 Plan 02: 录制链路 init 留存与编排透传 Summary

**B 站直播录制链路 fMP4 端到端打通：录制引擎首轮 baseline 即下载 EXT-X-MAP init 分片落盘（Pitfall 1 关闭），meta.json 自解释，编排层 initPath 两跳透传到 45-01 的嗅探分流，CONVERT_FAIL_TEXT 新 reason 文案闭环——stub e2e 从带 MAP 清单到 probe 可解析产物全绿，真实流验证留 end-of-phase human-check。**

## Performance

- **Duration:** 7 min
- **Tasks:** 2/2 complete
- **Commits:** 2
- **Files changed:** 4（2 源文件 + 2 测试文件，+206/-4 行）

## Accomplishments

- `media-record-engine.js`：
  - pollLoop 新增 init 检查点（`st.consecutiveFailures = 0` 之后、首轮/追新分支**之外**每轮执行）——`pl.mapUri` 首次见到或变化即 `resolveUri` → `fetchPage` → 落盘 `taskDir/init`（固定常量文件名，T-44-11 远端 URI 不进路径；不进 `st.seen`/`st.recorded`、不占 seq 命名）；**首轮 baseline 轮同样下载**（Pitfall 1 最高危：init 不是媒体分片，D-21 baseline 只豁免分片回溯）；MAP 变化重下分支按 RFC 语义保留（Pitfall 8）
  - BYTERANGE 形态（`pl.mapByterange` 非空）→ 不下载 + console.warn 一次，登记状态防重复告警，后续转换落 `init_missing` 兜底（RESEARCH Route D，不静默产坏产物）
  - init 下载当轮失败容错：不记 consecutiveFailures、不登记 `st.mapUri`（下轮自然重试）——init 缺失只影响后续转换不影响录制本体
  - writeMeta 附加 `mapUri`/`initFile`/`mapByterange`（44 附加字段先例不升版本，旧 meta 缺字段 = fMP4 能力缺省关闭）
- `main.js`：
  - `readRecordTaskSegments` 读 `meta.initFile` → 拼路径 + `fs.existsSync` 校验，返回对象追加 `initPath`（缺失/不存在 → null）
  - 编排透传两跳：`startConvertFromRecordTask` input 构造追加 `initPath: bundle.initPath`（中间跳，main.js:3209 grep 断言是其唯一自动化覆盖）；`startConvertTask` 解构与 convertToMp4 调用点透传（录制 TS 条目为 null 不影响既有 TS 路径）；编排其余零改动（D-06：弹框/注册/取消令牌/进度节流/终态流转/cancelled 拦截全盘复用）
  - `CONVERT_FAIL_TEXT` 追加 `init_missing`（引导重播/重录口吻，参照 key_unavailable）与 `invalid_init`（Pitfall 5 关闭）
- 测试：
  - `tests/test-media-record-duration.js` 新增「fMP4 init 留存（D-05）」用例组 2 例——tracer stub e2e（首轮 500ms 时点 init 已落盘的直接证据 / meta.initFile='init'+mapUri / segments 无 init / convertToMp4 resolve 且产物 probe 检出 moov + 4 moof）+ BYTERANGE 不下载用例（initFetchCount===0、meta.initFile=null）；mux.js generator 夹具内联复刻（45-01 同法）；既有 4 例零回归（无 mapUri 的 stub 清单行为不变）
  - `tests/test-media-remuxer.js` :310 文案断言循环列表扩 `init_missing`/`invalid_init`（38/38 pass）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mux.js probe findBox 第二参须为 box 路径数组**
- **Found during:** Task 1 stub e2e 调试
- **Issue:** 新增 e2e 用例中 `findBox(outBuf, 'moov')`（字符串形态）静默查不到 moov 致断言失败——convertToMp4 本身 resolve 正常，产物无误，是测试断言调用方式错
- **Fix:** 改为 45-01 测试同款数组形态 `findBox(outBuf, ['moov'])` / `findBox(outBuf, ['moof'])`
- **Files modified:** tests/test-media-record-duration.js
- **Commit:** 0ef82fd

除上述外无其他偏差——计划按原样执行。

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | 引擎 init 留存 + 编排透传 initPath + stub e2e（tracer） | 0ef82fd | media-record-engine.js, main.js, tests/test-media-record-duration.js |
| 2 | CONVERT_FAIL_TEXT 新 reason 文案 + 断言扩展 | 489af57 | main.js, tests/test-media-remuxer.js |

## Verification Results

- `node tests/test-media-record-duration.js` — 6/6 pass（既有 4 例零回归 + 新增 2 例）
- `node tests/test-media-remuxer.js` — 38/38 pass（文案断言扩至 5 reason）
- `node --check main.js && node --check media-record-engine.js` — 语法 OK
- 接线 grep：`initPath: bundle.initPath`（main.js:3209）命中；`'init'` 固定常量写盘命中；`mapUri` 引擎内 8 处命中（≥3 要求）；`initFile` main.js/引擎双侧命中
- 真实网络红线：测试全 stub fetchPage/parsePlaylist，无 bilibili.com 字面 URL（grep clean）
- Tracer feedback gate（auto 模式）：`<verify>` 全量重跑通过 —— ⚡ Tracer verified end-to-end — expanding

## Threat Flags

无新增信任边界——init 下载走 fetchPage 既有通道（容器 session 约束），落盘文件名为固定常量（T-45-03），失败容忍不阻断录制本体（T-45-04），均按 threat_model mitigate 落地；零新依赖（T-45-SC 供应链面零增量）。

## Known Stubs

无。

## 遗留说明（非本计划范围，交 45-03 / end-of-phase UAT）

- 缓存链路（media-cache-manager.js + /proxy）MAP 排除 + init 留存 + getConvertInfo.initPath 接线属 45-03 范围
- 真实 B 站直播录制 tracer（录制 ≥30s → 停止 → 转 MP4 → mpv/VLC 可播）为 end-of-phase human-check，不在自动化覆盖内（Pitfall 7）；已知容忍项不判 fail（D-02）：播放器总时长垃圾值（tfdt epoch 基线）、VLC fragment 序号警告

## Self-Check: PASSED

- Files: media-record-engine.js / main.js / tests/test-media-record-duration.js / tests/test-media-remuxer.js — all FOUND
- Commits: 0ef82fd / 489af57 — all FOUND in git log

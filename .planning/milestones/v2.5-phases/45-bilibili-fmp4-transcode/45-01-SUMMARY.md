---
phase: 45-bilibili-fmp4-transcode
plan: 01
subsystem: media
tags: [fmp4, hls, m3u8, ext-x-map, mux.js, remux, bilibili]

requires:
  - phase: 44-
    provides: mux.js Transmuxer TS 转封装管线、convertToMp4 执行体契约六件套、EXT-X-KEY 行级捕获先例、G-44-7 同步 fd 产物创建修复、CONVERT_FAIL_TEXT 文案链路
provides:
  - parsePlaylist 返回值新增 mapUri/mapByterange（EXT-X-MAP 捕获，缺省 null，多 MAP 取最新）
  - concatFmp4ToMp4({ initPath, segmentPaths, outputPath, onProgress, shouldCancel }) 纯字节拼接执行体
  - convertToMp4 可选入参 initPath + 首片嗅探 fMP4 分流（fmp4_container 内部信号）
  - 新 remuxError reason：init_missing / invalid_init
  - mux.js generator 内联测试夹具（makeInit/makeFmp4Segment，多 moof B 站形态）
affects: [45-02 录制/缓存链路 initPath 接线, 45-03 编排层 CONVERT_FAIL_TEXT 文案扩展, media-record-engine, media-cache-manager]

actuals:
  tokens: 7810
  tasks: 2
  commits: 4
plan_head_before: 853f4bd048dbb51b28f128070651b79b51869b3f

tech-stack:
  added: []
  patterns:
    - "EXT-X-MAP 行级捕获（44-18 EXT-X-KEY 同款加法，多 MAP 覆盖取最新 = RFC 8216 §4.3.2.5）"
    - "fMP4 嗅探分流（内部信号 reason 不进 CONVERT_FAIL_TEXT）替代旧 unsupported_container 终态拒转"
    - "产物终检加强档：mux.js probe 只读头部 4MB（moov 存在 + moof 计数 ≥1），probe 异常降级 ftyp+size 基线"

key-files:
  created: []
  modified:
    - media-m3u8-parser.js
    - media-remuxer.js
    - tests/test-m3u8-playlist-parser.js
    - tests/test-media-remuxer.js

key-decisions:
  - "D-05 落地：parsePlaylist 捕获 EXT-X-MAP 的 URI/BYTERANGE，多 MAP 覆盖取最新（RFC 8216 §4.3.2.5 作用域语义），无 MAP 缺省 null 向后兼容"
  - "D-06 落地：sniffContainerBuffer fMP4 box 分支返回内部信号 fmp4_container（非用户可见 reason），convertToMp4 首片嗅探块内按 initPath 有无分流"
  - "加密链路（decryption 提供）下 fMP4 维持旧 unsupported_container 拒转语义（D-04）——拼接读的是密文原文件无意义"
  - "产物终检 probe 只读头部 4MB 而非全量文件（T-45-02/T-44-17 流式约束），probe 异常降级为 ftyp 头 + 大小基线校验"

patterns-established:
  - "fMP4 测试夹具内联 mux.js generator（仓库无 fixtures 先例）：makeInit()=initSegment([videoTrack])，makeFmp4Segment()=单文件两 moof+mdat 对无 styp/ftyp（复刻 B 站实测形态）"
  - "嗅探内部信号 reason（fmp4_container）：调用方分流语义，不注册进 CONVERT_FAIL_TEXT 文案映射"

requirements-completed: [D-01, D-02, D-04, D-05, D-06, D-07]

coverage:
  - id: D1
    description: "parsePlaylist EXT-X-MAP 捕获：URI/BYTERANGE、缺省 null、多 MAP 取最新、EXT-BILI-AUX 混合清单不受影响"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/test-m3u8-playlist-parser.js#parsePlaylist EXT-X-MAP 捕获（D-05，fMP4 init 分片）"
        status: pass
    human_judgment: false
  - id: D2
    description: "concatFmp4ToMp4 纯字节拼接：产物 = init+分片按播放序精确字节相等、多 moof 分片原样通过、init_missing/invalid_init/no_segments/cancelled 拒转且清理、probe 终检"
    requirement: D-01
    verification:
      - kind: unit
        ref: "tests/test-media-remuxer.js#concatFmp4ToMp4 拼接执行体（D-01/D-07 纯字节拼接）"
        status: pass
    human_judgment: false
  - id: D3
    description: "convertToMp4 fMP4 嗅探分流：有 initPath 走拼接 resolve、无 initPath init_missing 拒转、TS 路径零回归（0x47 即使传 initPath 仍走 mux.js）"
    requirement: D-06
    verification:
      - kind: unit
        ref: "tests/test-media-remuxer.js#convertToMp4 fMP4 嗅探分流（D-06）"
        status: pass
    human_judgment: false
  - id: D4
    description: "44-08 契约零回归：取消 < 嗅探 < push 源码结构断言与取消先于嗅探语义保持绿；加密流拒转（D-04）维持"
    requirement: D-04
    verification:
      - kind: unit
        ref: "tests/test-media-remuxer.js#convertToMp4 格式嗅探（G-44-4b）"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-09-08
status: complete
---

# Phase 45 Plan 01: EXT-X-MAP 捕获与 fMP4 纯字节拼接执行体 Summary

**B 站直播 fMP4 流从「unsupported_container 拒转」改为「有 init 字节拼接转出 probe 可校验的 fMP4 产物、无 init 走 init_missing 引导」，parser 同步捕获 EXT-X-MAP init 分片 URI——零新依赖、TS/加密/取消契约全绿。**

## Performance

- **Duration:** 14 min
- **Tasks:** 2/2 complete
- **Commits:** 4 (TDD RED+GREEN ×2)
- **Files changed:** 4 (2 源文件 + 2 测试文件，+512/-10 行）

## Accomplishments

- `media-m3u8-parser.js`：`parsePlaylist` 新增 `#EXT-X-MAP:` 行级捕获——`mapUri`/`mapByterange` 缺省 null；多 MAP 覆盖取最新（RFC 8216 §4.3.2.5 作用域语义）；JSDoc 返回类型同步补字段说明；纯 Node 可加载约束保持（D-05）
- `media-remuxer.js`：
  - 新增 `concatFmp4ToMp4({ initPath, segmentPaths, outputPath, onProgress, shouldCancel })`——init 在前 + 分片按播放序**原样字节拼接**（不解析 moof/trun 内部，攻击面=字节拷贝）；执行体契约六件套逐项复刻 convertToMp4（同步 fd 产物创建/fail 清理/协作式取消/进度不阻断/终检）；init 前 8 字节 size+ftyp 校验 fail-fast（invalid_init）；产物终检加强档 = mux.js probe 只读头部 4MB 校验 moov 存在 + moof 计数 ≥1（probe 异常降级 ftyp+size 基线）（D-01/D-07）
  - `sniffContainerBuffer` fMP4 box 分支从 unsupported_container 拒转改为返回内部信号 `fmp4_container`（不进 CONVERT_FAIL_TEXT、不对用户可见）；TS 放行与高熵/未知拒转零改动
  - `convertToMp4` 新增可选入参 `initPath`：首片嗅探块内（取消检查之后、TS push 之前——44-08 契约保持）命中 fMP4 时按 initPath 有无分流（清理半成品后委托拼接分支 / init_missing 拒转）；加密链路下 fMP4 维持旧拒转（D-04）
- 测试：parser EXT-X-MAP 用例组 5 例；:176 用例改写为 init_missing 分流语义（产物清理断言保留）；concatFmp4ToMp4 用例组 6 例（含字节级精确相等断言、多 moof 复刻、probe 断言）；分流用例 2 例；mux.js generator 内联夹具（makeInit/makeFmp4Segment）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 缺失关键功能] 产物终检 probe 改为只读头部 4MB**
- **Found during:** Task 2 实现期
- **Issue:** 计划终检建议「mux.js probe 校验 moov+moof」若按字面全量 readFileSync 产物，GB 级录制产物会全量入内存，违背威胁模型 T-45-02 与 T-44-17 流式约束
- **Fix:** probe 只读头部 4MB（`FINAL_PROBE_READ_BYTES`）——moov 在 init 内、首个 moof 紧随 init，头部判别足够；保留 probe 异常时降级 ftyp 头 + 大小基线校验
- **Files modified:** media-remuxer.js
- **Commit:** 665144f

**2. [Rule 2 - 安全语义补全] 加密链路下 fMP4 命中维持旧拒转**
- **Found during:** Task 2 实现期
- **Issue:** 计划未明示 decryption 提供时 fMP4 命中的行为；若照样分流，concatFmp4ToMp4 读的是密文原文件，会产出垃圾产物
- **Fix:** `dec` 提供时 fmp4_container 映射回 unsupported_container 拒转（维持 D-04 语义）
- **Files modified:** media-remuxer.js
- **Commit:** 665144f

### 计划外决策（已记录 key-decisions）

- mux.js generator 夹具的 `initSegment` 需要合法 sps/pps 字节，夹具视频轨内置了确定性 sps/pps 常量（RESEARCH 只给 API 形态未给轨参数细节，实测验证 initSegment=676B、moof=133B、mdat=108B 且 probe 可解析）

## Task Commits

| Task | Name | RED | GREEN | Files |
| ---- | ---- | --- | ----- | ----- |
| 1 | parsePlaylist EXT-X-MAP 捕获（D-05） | ffa1354 | e5a9b8d | media-m3u8-parser.js, tests/test-m3u8-playlist-parser.js |
| 2 | concatFmp4ToMp4 + convertToMp4 initPath 分流 + :176 改写（D-01/D-06/D-07） | e02fe67 | 665144f | media-remuxer.js, tests/test-media-remuxer.js |

## Verification Results

- `node tests/test-media-remuxer.js` — 38/38 pass（:164「取消 < 嗅探 < push」与 :246「取消先于嗅探」结构断言保持绿）
- `node tests/test-m3u8-playlist-parser.js` — 28/28 pass（既有 EXT-X-KEY 用例组零修改零回归）
- 邻接套件：`node tests/test-media-cache.js` 28/28、`node tests/test-media-record-duration.js` 4/4（parser 消费方零回归）
- `node -e "require('./media-remuxer'); require('./media-m3u8-parser')"` — pure-node ok（零 electron/原生依赖）
- `git diff package.json` — 空（D-01 零新依赖锁定）

## Threat Flags

无新增信任边界——拼接本体为字节拷贝（不解析 moof/trun）；T-45-01（init ftyp 校验 + probe 终检 + fail 清理）与 T-45-02（流式写盘 + probe 头部 4MB 上限）均已按 threat_model mitigate 落地。

## Known Stubs

无。

## 遗留说明（非本计划范围，交 45-02/45-03）

- `main.js CONVERT_FAIL_TEXT` 尚未注册 `init_missing`/`invalid_init` 文案——属 45-02 编排层接线范围（本计划 files_modified 不含 main.js；编排层尚未透传 initPath，用户路径暂不可达 fmp4 分流）
- 录制引擎/缓存层 init 分片下载与留存（D-05 后半段）在后续计划

## Self-Check: PASSED

- Files: media-m3u8-parser.js / media-remuxer.js / tests/test-m3u8-playlist-parser.js / tests/test-media-remuxer.js — all FOUND
- Commits: ffa1354 / e5a9b8d / e02fe67 / 665144f — all FOUND in git log

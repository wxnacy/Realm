---
phase: 44-player-video-cache-and-local-media-library
plan: 11
subsystem: media
tags: [mux.js, mpeg-ts, fmp4, format-sniffing, hls, electron-main]

requires:
  - phase: 44-08
    provides: shouldCancel 协作式取消检查点契约（取消先于一切分片消费）
  - phase: 44-05
    provides: convertToMp4 转封装管线（mux.js 单实例/流式写盘）与 CONVERT_FAIL_TEXT 文案映射链路
provides:
  - 首分片容器格式嗅探 sniffContainerFormat（0x47 放行 / fMP4 box 特征 / 高熵密文 / 未知格式四判定）
  - 不可转格式显式 reject（unsupported_container / encrypted_stream），杜绝静默无效产物（G-44-4b）
  - 转封装产物字节数终检（empty_output）+ 半成品清理
  - 任务页三条新失败 reason 中文文案（CONVERT_FAIL_TEXT）
affects: [media-tasks, player-recording, media-cache, uat-verification]

tech-stack:
  added: []  # 零新增依赖（测试用 crypto 为 Node 内置）
  patterns: [前置格式嗅探检查点（取消检查之后、push 之前）, 产物字节数终检兜底]

key-files:
  created: []
  modified:
    - media-remuxer.js
    - main.js
    - tests/test-media-remuxer.js

key-decisions:
  - "嗅探判定宽松优先：首字节 0x47 即放行，不做 188 步进强校验——首包对齐存在变体，避免误杀真实 TS（G-44-4b truth 与零回归并重）"
  - "熵判定阈值 240/256 值域近满覆盖：4KB 采样足以稳定区分 AES-128 密文与明文媒体码流"
  - "嗅探检查点置于 shouldCancel 之后、push 之前：44-08 取消契约零回归（占位分片取消用例 fixture 未改）"
  - "Test 3 断言按实测修正为 empty_output：伪 TS 进 mux.js 静默不产数据，既有产物终检兜底——核心意图（非嗅探 reason，证明不误杀 TS）不变"

patterns-established:
  - "首片代表全流：录制/缓存同一清单分片格式齐一，嗅探首分片即可判定整组可转性"
  - "失败显式化契约：不可转格式 reject 而非静默产出，错误对象直接携带 reason/detail 走既有 fail 清理"

requirements-completed: [D-04, D-24]

coverage:
  - id: D1
    description: fMP4 分片（moof/ftyp 开头无 0x47）被嗅探拒绝，reason=unsupported_container，半成品清理
    requirement: D-24
    verification:
      - kind: unit
        ref: tests/test-media-remuxer.js#fMP4 box 分片拒转 reason=unsupported_container 且产物清理
        status: pass
    human_judgment: false
  - id: D2
    description: AES-128 高熵密文分片被嗅探拒绝，reason=encrypted_stream
    requirement: D-24
    verification:
      - kind: unit
        ref: tests/test-media-remuxer.js#高熵密文分片拒转 reason=encrypted_stream
        status: pass
    human_judgment: false
  - id: D3
    description: 正常 MPEG-TS（0x47 首字节）嗅探放行进入既有转封装路径，取消检查点先于嗅探（44-08 契约零回归）
    requirement: D-24
    verification:
      - kind: unit
        ref: tests/test-media-remuxer.js#0x47 首字节分片嗅探放行，错误语义落在既有路径（嗅探不误杀 TS）
        status: pass
      - kind: unit
        ref: tests/test-media-remuxer.js#shouldCancel=true + 任意占位分片仍 reason=cancelled（取消先于嗅探，44-08 契约回归）
        status: pass
      - kind: unit
        ref: tests/test-media-remuxer.js#源码结构断言：嗅探检查点位于 shouldCancel 之后、push 之前（44-08 取消契约优先序）
        status: pass
    human_judgment: false
  - id: D4
    description: 任务页三条新失败 reason 中文文案（CONVERT_FAIL_TEXT 映射），失败原因直达不落「未知原因」
    requirement: D-24
    verification:
      - kind: unit
        ref: tests/test-media-remuxer.js#main.js CONVERT_FAIL_TEXT 覆盖三个新 reason（任务页文案不落「未知原因」）
        status: pass
    human_judgment: false
  - id: D5
    description: 产物字节数终检（empty_output 失败处理 + 清理）——由 Test 3 伪 TS 路径行为性覆盖
    requirement: D-24
    verification:
      - kind: unit
        ref: tests/test-media-remuxer.js#0x47 首字节分片嗅探放行，错误语义落在既有路径（嗅探不误杀 TS）
        status: pass
    human_judgment: false
  - id: D6
    description: 真实 B 站直播（fMP4 流）录制停止后任务页显示明确失败文案且无无效产物；正常 TS 源录制转换产物可播放（UAT 第 4/6 项）
    verification: []
    human_judgment: true
    rationale: "需真实直播源端到端录制/转换，无法在单测环境复现真实分片流；留待 phase 级 UAT 人工复测"

# Metrics
duration: 4min
completed: 2026-09-07
status: complete
actuals:
  tokens: 3500
  tasks: 2
  commits: 3
plan_head_before: 3cfa965e0b947aec4312a9c4443f6bfdacc5213e
---

# Phase 44 Plan 11: G-44-4b 转封装格式嗅探与显式拒转 Summary

**首分片格式嗅探（0x47/fMP4 box/高熵三判定）+ 不可转格式显式 reject + 产物终检，杜绝 0 字节假产物，失败原因直达任务页（G-44-4b）**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-07T06:54:31Z
- **Completed:** 2026-09-07T07:00:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- media-remuxer.js 新增 `sniffContainerFormat`：首分片 64KB 嗅探（① 首字节 0x47 放行 → ② fyp/styp/moof/moov/sidx box 特征拒转 → ③ 4KB 采样不同字节值 ≥240 高熵拒转 → ④ 未知格式拒转），fMP4 与 AES-128 密文分片在进入 mux.js 前显式失败
- convertToMp4 首片 push 前嗅探检查点（置于 shouldCancel 之后——44-08 取消契约不变）+ stream.end 产物字节数终检（empty_output 失败处理 + unlink 清理）
- main.js CONVERT_FAIL_TEXT 新增三条文案（unsupported_container / encrypted_stream / empty_output），任务页失败原因不再落「未知原因」
- tests/test-media-remuxer.js 新增「convertToMp4 格式嗅探（G-44-4b）」describe：fMP4 拒转 / 高熵拒转 / TS 放行不误杀 / 取消先于嗅探 / 嗅探检查点结构断言 / CONVERT_FAIL_TEXT 覆盖断言（TDD RED→GREEN）

## Task Commits

Each task was committed atomically:

1. **Task 1: 转封装前置格式嗅探 + 零产物终检** - `b3bd216` (feat)
2. **Task 2: 嗅探契约单测 + CONVERT_FAIL_TEXT 文案映射** - `32ff0bd` (test, RED) + `c450960` (feat, GREEN)

**Plan metadata:** 见下方 final commit

_注：Task 2 为 TDD 流程（test→feat 双提交）_

## Files Created/Modified
- `media-remuxer.js` - sniffContainerFormat 嗅探函数（SNIFF_READ_BYTES=64KB / ENTROPY_SAMPLE_BYTES=4096 / ENTROPY_DISTINCT_THRESHOLD=240）、首片嗅探检查点、产物终检、JSDoc 失败原因清单扩展
- `main.js` - CONVERT_FAIL_TEXT 三条新映射（消费端 reasonText 通用映射零改动）
- `tests/test-media-remuxer.js` - 嗅探契约 describe（6 用例）+ 文件头覆盖清单更新 + crypto 引入

## Decisions Made
- 嗅探判定宽松优先：0x47 首字节即放行，不做 188 步进强校验（首包对齐存在变体，避免误杀真实 TS）
- 熵阈值取 240（256 值域近满覆盖）：明文媒体码流字节分布远低于此，密文近均匀分布稳定命中
- Test 3（TS 放行）断言按实测修正：计划预测伪 TS 落 transmux_failed，实测 mux.js 对垃圾包静默不产数据、由既有产物终检兜底为 empty_output——核心意图（非嗅探 reason，证明不误杀 TS）不变

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 3 预期 reason 从 transmux_failed 修正为 empty_output**
- **Found during:** Task 2（TDD RED 前实证）
- **Issue:** 计划预测伪 TS（全 0x47）push 进 mux.js 会触发 transmux_failed；实测 mux.js 对垃圾 TS 包静默解析不产数据、不报错，stream.end 后由本 plan 新增的产物终检拒为 empty_output
- **Fix:** 断言改为 err.reason === 'empty_output' 并保留「绝不可能是 unsupported_container/encrypted_stream」守卫断言（计划行为字段的核心意图：嗅探不误杀 TS、错误语义落既有路径）；注释记录预测与实测差异
- **Files modified:** tests/test-media-remuxer.js
- **Verification:** node tests/test-media-remuxer.js 23/23 全绿
- **Committed in:** 32ff0bd + c450960

---

**Total deviations:** 1 auto-fixed (1 bug/预期修正)
**Impact on plan:** 断言与实际语义对齐，未改变任何生产行为；核心契约（嗅探放行 TS、取消优先序）完整保留。

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None（AES-128 解密与 fMP4 init+frag 拼接为计划锁定的可选增强债务，非 stub——本 plan 显式拒转即目标行为）

## Next Phase Readiness
- G-44-4b 自动化部分闭合：不可转格式显式报错、无效产物杜绝、任务页文案明确、TS 路径与取消契约零回归（remuxer 23 / task-registry 26 / cache 20 全绿）
- 待 phase 级 UAT 人工复测：真实 B 站直播（fMP4 流）与正常 TS 直播源的端到端录制/转换表现（D6 人工判断项）
- 已知债务（随需求单独规划）：AES-128 EXT-X-KEY 解密、fMP4 init+frag 拼接

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-07*
## Self-Check: PASSED

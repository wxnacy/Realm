---
phase: 44-player-video-cache-and-local-media-library
plan: 18
subsystem: media
tags: [hls, aes-128, ext-x-key, m3u8, cache, mp4, gap-closure]

requires:
  - phase: 44-player-video-cache-and-local-media-library
    provides: media-cache-manager 转封装索引（playlist_order/completeness，44-05）、media-m3u8-parser 行级解析器、44-17 泄漏层修复（sync fd）
provides:
  - parsePlaylist 加密检测（hasEncryption + keyUris，含 SAMPLE-AES、多 KEY 行语义）
  - 缓存层密钥 URI 排除（storeBuffer 跳过落盘）与加密标记登记（meta.has_encryption / key_uris）
  - 转换双入口（缓存/录制）encrypted 早拒 + 「加密视频暂不支持转换」文案全链路
  - 抽屉加密条目转换按钮隐藏（D-17 隐藏语义）
affects: [media-cache, video-convert, player-drawer, media-record]

actuals:
  tokens: 5420
  tasks: 3
  commits: 3
plan_head_before: 47ec479b4b1d94ce66cb4f42ea6d450d2c24e05c

tech-stack:
  added: []
  patterns:
    - "EXT-X-KEY 行级解析：METHOD 属性容忍引号与顺序，任一非 NONE 即加密流（不因后续 METHOD=NONE 回落）"
    - "key_uris 与 segments 同源 segKey：resolveUri 绝对化 → segmentKeyOf → O(1) 成员判定，无路径拼接（T-44-01/02 不受削弱）"
    - "读取侧自愈带前提：仅 key_uris 已存在的条目过滤 key 键；无 key_uris 的历史污染条目 no-op 钉死"

key-files:
  created: []
  modified:
    - media-m3u8-parser.js
    - tests/test-m3u8-playlist-parser.js
    - media-cache-manager.js
    - tests/test-media-cache.js
    - media-record-engine.js
    - main.js
    - ipc-handlers.js
    - src/player.js

key-decisions:
  - "加密语义为『整清单出现过加密即加密流』：hasEncryption 只置 true 不回落，多 KEY 行（NONE 在后）仍 true"
  - "storeBuffer 命中 key_uris 早退返回 { ok:true, skipped:true, reason:'key_uri' }——store() passthrough 透传独立，播放解密取流不受影响"
  - "加密早拒放在 startConvertTask 函数体最前（弹框与任务注册之前），CONVERT_FAIL_TEXT.encrypted 作纵深防御文案"
  - "沿 D-17 隐藏语义隐藏加密条目转换按钮（44-13 锁定决策：播放器不建 toast 基建，不做点击后报错）"
  - "附加字段（has_encryption/key_uris/hasEncryption）不升 META_VERSION——沿 44-05『附加字段不升版本』先例"

patterns-established:
  - "密钥排除时序前提写进 JSDoc：hls.js 先请求清单（updatePlaylistIndex 落 key_uris）后请求密钥/分片，判定依赖必然先行就绪；master→variant 两级清单不适用但该形态本就不参与转换"
  - "历史污染条目两类行为钉死测试：有 key_uris → getConvertInfo 自愈剔除；无 key_uris → no-op 保留（入口早拒 + 44-17 无 0 字节残留兜底）"

requirements-completed: [D-17, D-22]

coverage:
  - id: D1
    description: "AES-128 加密 HLS 缓存条目抽屉不再显示「转换为 MP4」按钮（D-17 隐藏语义）"
    requirement: D-17
    verification:
      - kind: grep
        ref: "src/player.js 转换按钮条件含 !item.hasEncryption"
        status: pass
      - kind: unit
        ref: "tests/test-media-cache.js#密钥 URI 排除与加密标记（G-44-7）"
        status: pass
    human_judgment: true
    note: "端到端真机（bfvvs 类源播放后抽屉无转换按钮、Downloads 无 0 字节残留）由 UAT 承载"
  - id: D2
    description: "加密源经任务页续转等入口发起转换时，在保存弹框与 mux 流程之前被拒，文案「加密视频暂不支持转换」可见"
    requirement: D-22
    verification:
      - kind: grep
        ref: "main.js 含 reason: 'encrypted'（3083/3245 行）与「加密视频暂不支持转换」（2304/3032 行）"
        status: pass
      - kind: unit
        ref: "node tests/test-media-task-registry.js / test-media-record-duration.js 零回归"
        status: pass
    human_judgment: false
  - id: D3
    description: "enc.key 不再被当分片落库——新缓存条目 meta.segments 数与清单分片数一致，playlist_order 不再失配"
    requirement: D-17
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js：storeBuffer 存密钥 URI → segments 无该键且目录无文件；playlist_order 长度 === segments 键数"
        status: pass
    human_judgment: false
  - id: D4
    description: "历史污染条目读取侧自愈带前提：有 key_uris 的条目 getConvertInfo 剔除 key 键；无 key_uris 的条目过滤为 no-op"
    requirement: D-17
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js 两类污染 meta 用例钉死行为"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-07
status: complete
---

# Phase 44 Plan 18: G-44-7 加密源转换早拒与密钥 URI 缓存分类 Summary

**清单解析层检测 EXT-X-KEY 加密（hasEncryption + keyUris）→ 缓存层密钥 URI 排除落库 + 加密标记登记 → 转换双入口弹框前早拒（「加密视频暂不支持转换」）+ 抽屉加密条目转换按钮隐藏，G-44-7 分类/体验半边闭合**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-07T13:47:00Z
- **Completed:** 2026-09-07T14:02:47Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- **加密检测下沉到解析层**：parsePlaylist 新增 hasEncryption（任一 EXT-X-KEY 行 METHOD≠NONE 即 true，AES-128/SAMPLE-AES 都算，不因后续 METHOD=NONE 回落）与 keyUris（加密行 URI 原始值，绝对化留给有 baseUrl 的调用方）；5 个新用例覆盖相对 URI/NONE/无 KEY/SAMPLE-AES/多 KEY 行
- **密钥 URI 不再污染缓存**：updatePlaylistIndex 登记 meta.has_encryption 与 key_uris（keyUris 逐个 resolveUri 绝对化 → segmentKeyOf，与 segments 同源）；storeBuffer 命中 key_uris 直接跳过落盘（透传独立不受影响）；新缓存条目 segments 数 == 清单分片数，playlist_order 完整性判定不再失配（53>52 问题根治）
- **读取侧自愈带前提**：getConvertInfo 对 key_uris 已存在的条目剔除 key 键（污染条目剔除后 playlist_order 与分片数对齐，completeness 恢复 100）；无 key_uris 的历史污染条目过滤为 no-op 钉死——该情形由入口早拒 + 44-17 无 0 字节残留兜底，读取侧不做静默改动
- **转换入口显式早拒**：startConvertTask 弹框与任务注册之前 `hasEncryption → { ok:false, reason:'encrypted' }`；缓存分支（getConvertInfo.hasEncryption）与录制分支（meta.json hasEncryption，录制引擎镜像 hasDiscontinuity 模式检测）双接线；CONVERT_FAIL_TEXT.encrypted + convert-resume 错误映射补「加密视频暂不支持转换」纵深防御文案
- **UI 隐藏语义**：ipc player:drawer:list 透出 item.hasEncryption；src/player.js 转换按钮可见性追加 `&& !item.hasEncryption`，加密条目按钮整体不渲染（44-13 锁定决策：不建 toast 基建）

## Task Commits

1. **Task 1: parsePlaylist 加密检测与密钥 URI 收集** - `6799d00` (feat)
2. **Task 2: 缓存层密钥 URI 排除与加密标记登记** - `1f55fc4` (feat)
3. **Task 3: 转换入口加密早拒与抽屉按钮隐藏** - `8675aba` (feat)

## Files Created/Modified

- `media-m3u8-parser.js` - parsePlaylist 返回 hasEncryption/keyUris；EXT-X-KEY 行级解析（METHOD 容忍引号与属性顺序）；JSDoc 契约同步
- `tests/test-m3u8-playlist-parser.js` - 新增「加密检测（EXT-X-KEY，G-44-7）」describe（5 例）；既有断言零改动（20/20 全绿）
- `media-cache-manager.js` - updatePlaylistIndex 登记 has_encryption/key_uris；storeBuffer key_uris 命中早退（reason:'key_uri'）；getConvertInfo 过滤 key 键并透出 hasEncryption；时序前提与适用域写进 JSDoc
- `tests/test-media-cache.js` - 新增「密钥 URI 排除与加密标记（G-44-7）」describe（4 例：登记/跳过落盘/两类污染 meta 钉死）；24/24 全绿
- `media-record-engine.js` - 轮询清单检测加密（parse 结果优先 + 行级正则兜底），writeMeta 写 hasEncryption
- `main.js` - startConvertTask 早拒 + 双入口透传；CONVERT_FAIL_TEXT.encrypted；convert-resume 错误映射补 encrypted 文案
- `ipc-handlers.js` - player:drawer:list 合并处透出 hasEncryption；JSDoc 条目契约同步
- `src/player.js` - 转换按钮可见性追加 !item.hasEncryption；注释补 G-44-7 依据

## Decisions Made

- 密钥排除只做「跳过落库」不做「拦截请求」：rewriteM3u8ForProxy 的 URI 重写行为未动，密钥请求仍走 /proxy 透传供 hls.js 解密播放（计划边界，播放链路零影响）
- 威胁登记按 accept 处置：key_uris 是白名单式排除而非路径拼接输入，分片文件名仍由 segmentKeyOf 哈希派生 + _safePath 校验（T-44-01/02 路径安全不受削弱）；恶意清单把分片 URI 填进 EXT-X-KEY 的后果只是该分片不被缓存，无逃逸面

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None。基线测试改动前全绿；Task 1（20/20）、Task 2（24/24）、Task 3（4 个 --check 全过，record-duration / task-registry 零回归）均一次通过；补跑 test-media-remuxer.js 与 test-player-history.js 零回归。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-44-7 双因链整体闭合：44-17 泄漏层（无 0 字节残留）+ 本计划入口早拒/缓存分类（不再产生注定失败的任务、密钥不污染 meta）
- 端到端真机项（bfvvs 类 AES-128 源缓存完成后抽屉无转换按钮、Downloads 无 0 字节文件）由 UAT 承载

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-07*

## Self-Check: PASSED

- FOUND: media-m3u8-parser.js（含 hasEncryption/keyUris，20 tests / 0 fail）
- FOUND: media-cache-manager.js（含 has_encryption/key_uris，24 tests / 0 fail）
- FOUND: media-record-engine.js / main.js / ipc-handlers.js / src/player.js（4 个 --check 全过）
- FOUND: commit 6799d00（Task 1 feat）
- FOUND: commit 1f55fc4（Task 2 feat）
- FOUND: commit 8675aba（Task 3 feat）
- 无关改动 src/settings-page.js / src/settings.html 未触碰、未提交

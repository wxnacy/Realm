---
phase: 45-bilibili-fmp4-transcode
plan: 03
subsystem: media
tags: [fmp4, hls, ext-x-map, cache, convert-orchestration, bilibili]

requires:
  - phase: 45-01
    provides: parsePlaylist mapUri/mapByterange 捕获、concatFmp4ToMp4、convertToMp4 initPath 分流、mux.js generator 夹具
  - phase: 45-02
    provides: init_missing/invalid_init CONVERT_FAIL_TEXT 文案、initPath 编排透传先例、固定常量 'init' 文件名先例
  - phase: 44-
    provides: key_uris 排除/留存/读取侧过滤三处先例（44-18）、_safePath 双基准、附加 meta 字段不升版本先例
provides:
  - 缓存链路 MAP 三件套：updatePlaylistIndex 登记 map_uris/has_fmp4_map/map_byterange；storeBuffer MAP 排除+init 本体留存（<videoDir>/init + meta.init_segment）；getConvertInfo 透出 initPath/hasFmp4Map
  - startConvertFromInput initPath 透传 + hasFmp4Map && !initPath → init_missing 早拒（D-03 第二链路闭环）
  - 缓存 fMP4 用例组 6 例（EXT-X-MAP 排除与 init 留存，D-05/D-07）
affects: [media-cache-manager, main.js 转换编排, Phase 45 全链路闭环（parser → 录制/缓存 → 编排 → 拼接）]

actuals:
  tokens: 4272
  tasks: 2
  commits: 3
plan_head_before: 7a7df9d75ccf60bbbfda3327b3c260c3e2ab30de

tech-stack:
  added: []
  patterns:
    - "MAP URI 排除复刻 key_uris 三处先例，关键差异：key 只留 hex 进 meta，init 本体必须写盘 <videoDir>/init（拼接必需品）"
    - "init 留存固定常量文件名 'init' 不进远端输入（T-44-11/T-45-05），路径经 _safePath 双基准校验"
    - "init 重复请求首 init 为准（D-10 增量语义），uri_key 变化（MAP 轮换）才覆盖（Pitfall 8）"
    - "BYTERANGE 形态 MAP 记 map_byterange 不登记 map_uris——不支持形态落 init_missing 兜底不静默产坏产物（RESEARCH Route D）"

key-files:
  created: []
  modified:
    - media-cache-manager.js
    - main.js
    - tests/test-media-cache.js

key-decisions:
  - "D-05 落地（缓存侧）：updatePlaylistIndex 登记 map_uris=[segKey(init 绝对URL)]（数组形态容忍 MAP 轮换）+ has_fmp4_map；storeBuffer O(1) 命中后 init 本体落盘 <videoDir>/init 并登记 meta.init_segment={size,sha256,uri_key}"
  - "D-07 落地（缓存侧）：init 绝不进 segments map——playlist_order 对齐判定与完整度分母不含 init（Pitfall 2 硬约束，测试断言锁定）"
  - "D-03 第二链路闭环：startConvertFromInput 早拒 hasFmp4Map && !initPath → init_missing（key_unavailable 同区段，文案 45-02 已注册，重播自愈同款引导）"
  - "附加 meta 字段（map_uris/has_fmp4_map/map_byterange/init_segment）不升 META_VERSION——旧条目缺字段 = fMP4 能力缺省关闭（44 先例）"

patterns-established:
  - "init 留存与密钥留存形态分野：key_uri 分支只写 meta.key_hex（16 字节进 meta），map_uri 分支写盘 <videoDir>/init + meta.init_segment（拼接必需本体）"
  - "getConvertInfo 剔除集合并模式：excluded = key_uris + map_uris 单点过滤，allKeys/playlist_order 对齐/completeness 三处消费自动一致"

requirements-completed: [D-03, D-05, D-07]

coverage:
  - id: M1
    description: "updatePlaylistIndex 登记 map_uris/has_fmp4_map；BYTERANGE 形态记 map_byterange 不登记 map_uris"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#含 EXT-X-MAP 清单 → meta.has_fmp4_map=true 且 map_uris 含 init 键；BYTERANGE 形态 MAP → 记 map_byterange 不登记 map_uris"
        status: pass
    human_judgment: false
  - id: M2
    description: "storeBuffer MAP 分支：init 本体落盘 <videoDir>/init + meta.init_segment 登记（不进 segments）；同 uri_key 重复请求不覆盖（D-10）"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#storeBuffer 命中 map_uris → init 本体落盘 + meta.init_segment 登记；二次同 uri_key init 请求 → 不覆盖已留存 init"
        status: pass
    human_judgment: false
  - id: M3
    description: "完整性判定不含 init：playlist_order 对齐 + completeness=100 不污染（Pitfall 2）"
    requirement: D-07
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#完整性判定不含 init：playlist_order 对齐 + completeness=100 不污染（D-07）"
        status: pass
    human_judgment: false
  - id: M4
    description: "getConvertInfo 透出 initPath/hasFmp4Map；历史无 init_segment 条目 initPath=null"
    requirement: D-03
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#getConvertInfo 透出 initPath/hasFmp4Map；历史无 init_segment 条目 initPath=null"
        status: pass
    human_judgment: false
  - id: M5
    description: "startConvertFromInput initPath 透传 + init_missing 早拒（落码于 key_unavailable 同区段）"
    requirement: D-03
    verification:
      - kind: grep
        ref: "main.js:3278 init_missing 早拒；main.js:3284 initPath: info.initPath 透传"
        status: pass
      - kind: human
        ref: "缓存链路 fMP4 转换 + QuickTime A1（end-of-phase UAT）"
        status: pending
    human_judgment: true

duration: 8min
completed: 2026-09-08
status: complete
---

# Phase 45 Plan 03: 缓存链路 MAP 登记与 init 留存 Summary

**缓存链路 fMP4 支持闭环（D-03 第二链路）：EXT-X-MAP 登记 map_uris/has_fmp4_map 复刻 44-18 key_uris 先例，init 本体留存 <videoDir>/init 且绝不进 segments（Pitfall 2 完整性口径），getConvertInfo 透出 initPath，startConvertFromInput 对历史无 init 条目 init_missing 早拒引导重播——缓存 fMP4 条目可转 mp4，四套件 106 例全绿零回归。**

## Performance

- **Duration:** 8 min
- **Tasks:** 2/2 complete
- **Commits:** 3（TDD RED + GREEN ×1 + 编排 ×1）
- **Files changed:** 3（2 源文件 + 1 测试文件，+251/-4 行）

## Accomplishments

- `media-cache-manager.js`：
  - `updatePlaylistIndex`：`pl.mapUri` → `meta.map_uris=[segmentKeyOf(resolveUri(pl.mapUri, m3u8Url))]`（与 key_uris 同源 segKey，数组形态容忍 MAP 轮换——Pitfall 8）+ `meta.has_fmp4_map=true`；`pl.mapByterange` 非空 → 仅记 `meta.map_byterange` 不登记 map_uris（整资源形态不支持，RESEARCH Route D，转换落 init_missing 兜底不静默产坏产物）；附加字段不升 META_VERSION（44 先例，旧条目缺字段 = fMP4 能力缺省关闭）
  - `storeBuffer` MAP 分支（key_uris 段后同款 O(1) includes 判定，时序前提继承：hls.js 先请求清单后请求 init/分片）：**绝不进 segments**（Pitfall 2，D-07 完整性口径）；init 本体经 `_safePath` 双基准校验写 `<videoDir>/init`（固定常量文件名不进远端输入，T-44-11/T-45-05），登记 `meta.init_segment={ size, sha256, uri_key }`；同 uri_key 重复请求跳过重写（首 init 为准，D-10 增量语义），uri_key 变化（MAP 轮换）才覆盖；返回 `{ ok:true, skipped:true, reason:'map_uri' }`
  - `getConvertInfo`：剔除集在 key_uris 之外并入 map_uris（单点过滤，allKeys/playlist_order 对齐/completeness 三处消费自动一致）；`meta.init_segment` 已登记且 `<videoDir>/init` 存在 → 返回对象追加 `initPath` 与 `hasFmp4Map: !!meta.has_fmp4_map`；历史无 init_segment 的 fMP4 条目 initPath=null；JSDoc 返回类型同步
- `main.js`：`startConvertFromInput` 在 key_unavailable 早拒同区段插入 `info.hasFmp4Map && !info.initPath → { ok:false, reason:'init_missing' }`（历史无 init 条目/BYTERANGE 形态早拒，文案 45-02 已注册「请重新播放……后再转换」，重播后 init 经 /proxy 留存即可转换，自愈路径与 key_unavailable 同款）；`startConvertTask` 调用透传 `initPath: info.initPath`（TS 条目 null 不影响既有路径，编排其余零改动——D-06 全盘复用）
- 测试：`tests/test-media-cache.js` 新增「EXT-X-MAP 排除与 init 留存（D-05/D-07）」describe 6 例（登记断言 ↔ key describe :423、跳过+留存 ↔ :434/:533、读取侧过滤 ↔ :459、透出 ↔ :514 一一对应）；mux.js generator init 夹具内联复刻（45-01 同法）；全 stub 零真实网络（Pitfall 7）

## Deviations from Plan

无——计划按原样执行。三个实现锚点（key_uris 三处先例）行号与 PATTERNS.md 摘录一致，复刻无分叉。

## Task Commits

| Task | Name | RED | GREEN | Files |
| ---- | ---- | --- | ----- | ----- |
| 1 | cache-manager MAP 登记 + init 排除留存 + getConvertInfo 透出（D-05/D-07） | 5ba656b | a35269c | media-cache-manager.js, tests/test-media-cache.js |
| 2 | startConvertFromInput initPath 透传 + init_missing 早拒（D-03） | — | 9a6818c | main.js |

## Verification Results

- `node tests/test-media-cache.js` — 34/34 pass（新 6 例 + 既有 key_uris/AES-128/完整性用例零回归）
- `node tests/test-media-remuxer.js` — 38/38 pass
- `node tests/test-media-record-duration.js` — 6/6 pass
- `node tests/test-m3u8-playlist-parser.js` — 28/28 pass（VALIDATION.md full suite 全绿）
- `node --check main.js && node --check media-cache-manager.js` — 语法 OK；`node -e "require('./media-cache-manager')"` — pure-node ok
- 接线 grep：`map_uris` 命中 3 处功能点（updatePlaylistIndex 登记 :668 / storeBuffer 判定 :440 / getConvertInfo 过滤 :700）；`init_segment` 登记+透出命中；`_safePath(videoId, 'init')` 写盘与透出双侧命中；`main.js:3278` init_missing 早拒（key_unavailable 同区段）、`main.js:3284` initPath 透传
- 真实网络红线：测试全 stub，无 bilibili.com 字面 URL

## Threat Flags

无新增信任边界——T-45-05（init 写盘固定常量文件名 + `_safePath` 双基准）与 T-45-06（map_uris O(1) 排除 + 测试断言 segments 无 init 键、completeness 不回归）均按 threat_model mitigate 落地；T-45-SC 零新依赖（`git diff package.json` 为空），供应链面零增量。

## Known Stubs

无。

## 遗留说明（非本计划范围）

- **`lookup()` init 命中回放不做**（RESEARCH Q5 Wave-2 优化）：init miss 走回源 + storeBuffer 留存已满足功能闭环，非范围缩减——供后续立小项
- **真实流验证留 end-of-phase human-check**：缓存链路 fMP4 转换（播放 fMP4 VOD → init 经 /proxy 留存 → 抽屉/任务页「转换为 MP4」→ mpv/VLC 可播）+ QuickTime A1 复验（失败不阻塞，结果记入 UAT 供用户决策）；BYTERANGE/差异形态应落 init_missing 拒转文案而非坏产物，此分支也算验证点（RESEARCH A4）

## Self-Check: PASSED

- Files: media-cache-manager.js / main.js / tests/test-media-cache.js / 45-03-SUMMARY.md — all FOUND
- Commits: 5ba656b / a35269c / 9a6818c — all FOUND in git log
- Stub scan: media-cache-manager.js 无 TODO/FIXME/placeholder 命中

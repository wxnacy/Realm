---
phase: 45-bilibili-fmp4-transcode
verified: 2026-09-08T05:27:36Z
status: human_needed
score: 17/17 must-haves verified
covered_files:
  - main.js
  - media-cache-manager.js
  - media-m3u8-parser.js
  - media-record-engine.js
  - media-remuxer.js
  - tests/test-m3u8-playlist-parser.js
  - tests/test-media-cache.js
  - tests/test-media-record-duration.js
  - tests/test-media-remuxer.js
covered_digest: "v1:sha256:48fb3e06aa4e38328aa38084fceecd6eba6c482bf5c11f66a72fcca5f0cee972"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "真实 B 站直播录制 tracer（45-02 PLAN <human-check>）：npm run dev 打开 B 站 fMP4 直播间（http_hls/fmp4/avc），播放器录制 ≥30 秒后停止，录制停止自动接力弹框（或任务页续转）转出 mp4，用 mpv 或 VLC 打开"
    expected: "画面 + 声音正常播放。已知容忍项不判 fail（D-02「能看就行」）：播放器总时长垃圾值（85h 量级，tfdt epoch 基线）、VLC Fragment sequence discontinuity 警告"
    why_human: "真实流端到端证明 manual-only 是设计决策（VALIDATION.md：token 时效 + 直播流偶发，RESEARCH Pitfall 7；自动化测试禁真实网络红线）——stub e2e 已闭环到 probe 可解析产物，真机复验属 UAT"
  - test: "缓存链路 fMP4 转换 + QuickTime A1（45-03 PLAN <human-check>）：npm run dev 播放 fMP4 VOD 源（B 站直播/回放），确认 init 经 /proxy 留存（缓存目录出现 init 文件），抽屉/任务页点「转换为 MP4」，mpv/VLC 打开产物；再用 QuickTime Player 打开任一拼接产物"
    expected: "mpv/VLC 画面+声音可播即通过；BYTERANGE/差异形态应落 init_missing 拒转文案而非坏产物（RESEARCH A4，此分支也算验证点）；QuickTime 失败不阻塞（A1，mpv/VLC 已实测兜底，结果记入 UAT 供用户决策）"
    why_human: "同上——真实网络形态与多播放器兼容性只能真机验证；QuickTime 兼容性为 RESEARCH A1 [ASSUMED] 待关闭项"
---

# Phase 45: B 站 fMP4 转录 Verification Report

**Phase Goal:** 录制/缓存的 fMP4 分片序列（init.mp4 + moof/mdat，B 站直播流形态）可转为可播放 mp4 产物（路线①：init.mp4 + moof/mdat 顺序拼接产 fMP4 容器，纯 JS）
**Verified:** 2026-09-08T05:27:36Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EXT-X-MAP 清单解析出 mapUri/mapByterange（多 MAP 取最新，无 MAP 缺省 null）（D-05） | ✓ VERIFIED | media-m3u8-parser.js:81-88 行级捕获、:43-44 缺省初始化、:18/:28-31 JSDoc；tests/test-m3u8-playlist-parser.js 28/28 pass（EXT-X-MAP 用例组 5 例 + 既有 KEY 组零回归） |
| 2 | fMP4 分片序列 + initPath 经 convertToMp4 转出 fMP4 产物：init 在前 + 分片按播放序原样字节拼接（D-01/D-07） | ✓ VERIFIED | 独立 spot-check（非测试套件复跑）：convertToMp4(init+2 多 moof 分片) resolve，产物 Buffer 与 init+seg1+seg2 **字节级精确相等**，probe 检出 moov + 4 moof |
| 3 | fMP4 分片无 initPath → reason=init_missing 拒转且半成品清理（D-06） | ✓ VERIFIED | spot-check：reject reason=init_missing、产物文件不存在；media-remuxer.js:391-392 分流点 + :176 改写用例绿 |
| 4 | init 非 ftyp 开头 → reason=invalid_init 拒转（fail-fast） | ✓ VERIFIED | spot-check：伪造 init reject reason=invalid_init、产物清理；media-remuxer.js:528 ftyp 头校验（REVIEW 复核 :525-528 在任何写入前） |
| 5 | MPEG-TS 路径与加密流拒转零回归；「取消 < 嗅探 < push」结构断言保持绿（44-08 契约，D-04） | ✓ VERIFIED | tests/test-media-remuxer.js 38/38（:164/:246 契约断言在内）；REVIEW 代码级复核：分流位于 i===0 嗅探块内取消检查之后、加密链路 fMP4 维持 unsupported_container（:383-386） |
| 6 | 产物终检含 mux.js probe 校验（moov 存在 + moof ≥1，不断言 track 数） | ✓ VERIFIED | media-remuxer.js:441 FINAL_PROBE_READ_BYTES=4MB 头部校验 + probe 异常降级 ftyp+size 基线；spot-check probe 断言通过 |
| 7 | 录制引擎每轮检查 pl.mapUri：首次/变化即下载 init 落盘，**首轮 baseline 也下载**（Pitfall 1，D-05） | ✓ VERIFIED | media-record-engine.js:231-253 检查点位于 `if (st.firstRound)` 分支**之外**（源码逐行确认），每轮执行覆盖首轮；stub e2e 断言首轮 500ms 时点 init 已落盘（6/6 pass） |
| 8 | meta.json 附加 mapUri/initFile/mapByterange，不升版本 | ✓ VERIFIED | media-record-engine.js:191-194 writeMeta 附加字段 + 注释「旧 meta 缺字段 = fMP4 能力缺省关闭」 |
| 9 | initPath 两跳接线：readRecordTaskSegments → startConvertFromRecordTask（initPath: bundle.initPath）→ startConvertTask 解构透传 convertToMp4（D-06） | ✓ VERIFIED | main.js:3077-3082（initPath 读出 + existsSync 校验）、:3213（中间跳）、:3094（解构）、:3155（调用点透传）；tracer stub e2e 录制目录直调 convertToMp4 → probe 检出 moov+4 moof |
| 10 | CONVERT_FAIL_TEXT 覆盖 init_missing 与 invalid_init（Pitfall 5） | ✓ VERIFIED | main.js:3038-3039 两条目；tests/test-media-remuxer.js:312-313 文案断言循环扩至 5 reason，38/38 pass |
| 11 | mapByterange 非空 → 不下载 init + console.warn，转换落 init_missing 兜底（RESEARCH Route D） | ✓ VERIFIED | media-record-engine.js:232-237 分支；stub 用例断言 initFetchCount===0、meta.initFile=null |
| 12 | 缓存链路 MAP URI 不进 segments map，完整性分母/playlist_order 对齐不含 init（D-07/Pitfall 2） | ✓ VERIFIED | media-cache-manager.js:440-450 storeBuffer MAP 分支先于 segments 写入拦截；test-media-cache.js M3 用例断言 completeness=100 不污染，34/34 pass |
| 13 | init 本体留存 `<videoDir>/init`（_safePath 双基准 + 固定常量文件名）+ meta.init_segment 登记；同 uri_key 重复请求跳过重写（D-10） | ✓ VERIFIED | media-cache-manager.js:441-450（:443 字面量 'init'、:446 init_segment={size,sha256,uri_key}）；_safePath :137-162 realpath 双基准 REVIEW 复核；M2 用例断言首 init 为准 |
| 14 | updatePlaylistIndex 登记 meta.map_uris + has_fmp4_map；附加字段不升 META_VERSION | ✓ VERIFIED | media-cache-manager.js:662-670；M1 用例断言 map_uris=[segKey(init 绝对 URL)]、BYTERANGE 形态记 map_byterange 不登记 map_uris（WR-02 轮换累积缺陷见观察项，属技术债不阻断） |
| 15 | getConvertInfo 返回 initPath/hasFmp4Map；历史无 init_segment 条目 initPath=null | ✓ VERIFIED | media-cache-manager.js:752-775（:756-759 固定常量 _safePath 路径 + existsSync）；M4 用例绿 |
| 16 | startConvertFromInput 透传 initPath；hasFmp4Map && !initPath → init_missing 早拒（D-03 第二链路） | ✓ VERIFIED | main.js:3278 早拒（key_unavailable 同区段）、:3284 `initPath: info.initPath` 透传；缓存/remuxer 套件全绿 |
| 17 | tracer 闭环（D-03）：stub 带 MAP 清单录制 → meta.initFile → initPath → convertToMp4 分流 → probe 可解析产物 | ✓ VERIFIED | tests/test-media-record-duration.js「fMP4 init 留存（D-05，45-02 tracer 端到端）」2 例绿（首轮落盘/meta 自解释/segments 无 init/产物 probe 检出 moov+4 moof 四层断言） |

**Score:** 17/17 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `media-m3u8-parser.js` | parsePlaylist 新增 mapUri/mapByterange（缺省 null） | ✓ VERIFIED | :43-44/:81-88；纯 Node 可加载（`node -e require` ok） |
| `media-remuxer.js` | concatFmp4ToMp4 新导出；convertToMp4 可选 initPath | ✓ VERIFIED | :470 定义、:598 exports、:264 入参；spot-check 行为级验证 |
| `media-record-engine.js` | pollLoop init 检查点 + writeMeta 附加字段 | ✓ VERIFIED | :231-253 检查点（分支之外）、:191-194 writeMeta |
| `media-cache-manager.js` | MAP 三件套（登记/排除+留存/透出） | ✓ VERIFIED | :662-670/:440-450/:752-775 |
| `main.js` | readRecordTaskSegments initPath、两跳透传、CONVERT_FAIL_TEXT、init_missing 早拒 | ✓ VERIFIED | :3077-3082/:3213/:3094/:3155/:3038-3039/:3278/:3284 |
| `tests/`（4 套件） | EXT-X-MAP 组/拼接组/tracer 组/缓存 MAP 组 | ✓ VERIFIED | 28+38+6+34=106 pass, 0 fail（本 verifier 独立重跑） |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| sniffContainerBuffer fMP4 命中 | convertToMp4 首片嗅探块内分流 → concatFmp4ToMp4 | `fmp4_container` 内部信号（remuxer.js:139→:386-398），位于取消检查之后、TS push 之前 | ✓ WIRED | spot-check：分流 resolve + 字节精确产物；加密链路维持旧拒转（:383-386，REVIEW 复核） |
| pollLoop mapUri 检查点 | taskDir/init → writeMeta.initFile → readRecordTaskSegments.initPath → startConvertTask → convertToMp4 | 录制链路五跳 | ✓ WIRED | 每跳 grep 落码 + tracer stub e2e 端到端绿 |
| 新 reason | CONVERT_FAIL_TEXT → 任务页文案 | main.js:3038-3039 | ✓ WIRED | 文案断言测试覆盖（Pitfall 5 关闭） |
| hls.js 清单→init 时序 | storeBuffer map_uris O(1) 命中 → init 落盘 | key_uris 先例继承 | ✓ WIRED | 缓存 M2/M3 用例绿；时序前提注释 :434 |
| 缓存条目「转换为 MP4」 | startConvertFromInput → getConvertInfo().initPath → convertToMp4 | main.js:3278/:3284 | ✓ WIRED | 早拒 + 透传双侧落码 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| convertToMp4 产物 | outputPath 字节流 | initPath 文件 + segmentPaths 文件原样字节 | ✓（spot-check 字节级相等 + probe 可解析） | ✓ FLOWING |
| 录制 initPath | meta.initFile → taskDir/init | pollLoop fetchPage 实下载 | ✓（stub e2e 全链） | ✓ FLOWING |
| 缓存 initPath | meta.init_segment → `<videoDir>/init` | storeBuffer /proxy 实留存 | ✓（M2/M4 用例） | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| fMP4 分片+init → 可解析产物（**阶段目标能力本身**，独立复验非套件复跑） | node -e 内联脚本（mux.js generator 造 init+2 多 moof 分片 → convertToMp4） | 产物字节 = init+seg1+seg2 精确相等；moov found、moof count=4 | ✓ PASS |
| 无 initPath → init_missing + 清理 | 同上脚本分支 2 | reason=init_missing、产物不存在 | ✓ PASS |
| 非法 init → invalid_init + 清理 | 同上脚本分支 3 | reason=invalid_init、产物不存在 | ✓ PASS |
| 四套件全绿 | node tests/test-{m3u8-playlist-parser,media-remuxer,media-record-duration,media-cache}.js | 28/38/6/34 pass，0 fail | ✓ PASS |
| 纯 Node 约束 | node -e require（三模块） | ok（零 electron/原生依赖） | ✓ PASS |
| 零新依赖（D-01） | git diff HEAD -- package.json | 空 | ✓ PASS |

### Probe Execution

SKIPPED（本阶段无 PLAN/SUMMARY 声明的 probe 脚本；VALIDATION.md 明确 spec-less probe fallback skipped——REQUIREMENTS.md 无本阶段需求 ID，已核实无 "phase 45"/"45-bilibili" 条目）

### Requirements Coverage

REQUIREMENTS.md 无本阶段映射（phase_req_ids null，已 grep 核实）。PLAN requirements 字段为 D-XX 决策 ID（按 Phase 44 先例的可见记录选择）：

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| D-01/D-02/D-04/D-05/D-06/D-07 | 45-01 | 纯 JS 拼接/能看就行/加密拒转维持/MAP 捕获/分流/播放序 | ✓ SATISFIED | Truths 1-6 |
| D-03/D-05/D-06 | 45-02 | tracer 先行/录制 init 留存/编排透传+文案 | ✓ SATISFIED | Truths 7-11, 17 |
| D-03/D-05/D-07 | 45-03 | 缓存第二链路/MAP 登记留存/完整性口径 | ✓ SATISFIED | Truths 12-16 |

无 ORPHANED requirements。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | 无 TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER 命中；无空实现/硬编码空数据流向渲染 | — | — |

### Prohibitions 复核（全部成立）

- 零新依赖、无 ffmpeg/mp4box require、拼接本体字节拷贝不解析 moof/trun — ✓（package.json diff 空；grep 仅 JSDoc 注释提及「规避 ffmpeg-static」）
- init 文件名固定常量 'init' 不进远端 URI（录制 :244 / 缓存 :443 双侧字面量）— ✓
- init 绝不进 segments map（测试断言锁定）— ✓
- 自动化测试禁真实网络（grep 无 bilibili.com 字面 URL）— ✓
- lookup() 无 init 命中回放分支（保持 miss 回源语义，45-03 SUMMARY 已记 deferred）— ✓

### 观察项（技术债，咨询性质，不阻断收尾——按项目惯例记 REVIEW.md）

1. **WR-01（REVIEW Warning，未修）**：main.js:3078-3079 `readRecordTaskSegments` 对 `meta.initFile` 无白名单直接 `path.join`——本地 meta 篡改可致任意路径作 initPath（需本地写权限 + 目标过 ftyp 校验，纵深防御缺口非远程可利用；缓存侧 :756-759 用固定常量 `_safePath` 实现正确）。建议修复：`meta.initFile === 'init'` 白名单。
2. **WR-02（REVIEW Warning，未修）**：media-cache-manager.js:662-668 `updatePlaylistIndex` 每次以当前 MAP 重建 `map_uris`（覆盖非累积），声明的「MAP 轮换容忍」在登记侧不成立；实测 B 站 MAP 恒定（Pitfall 8）实际不触发，storeBuffer 侧 uri_key 变化覆盖已兜底。
3. **lookup() init 命中回放未做**（RESEARCH Q5 Wave-2 优化，45-03 SUMMARY 已记 deferred 供后续立小项）——miss 回源 + storeBuffer 留存已满足功能闭环，非范围缩减。

### Human Verification Required

#### 1. 真实 B 站直播录制 tracer（D-03 真机复验）

**Test:** `npm run dev` 打开 B 站 fMP4 直播间（http_hls/fmp4/avc），播放器录制 ≥30 秒后停止，自动接力弹框（或任务页续转）转出 mp4，mpv/VLC 打开
**Expected:** 画面 + 声音正常播放。容忍项不判 fail（D-02）：总时长垃圾值（tfdt epoch 基线）、VLC fragment 序号警告
**Why human:** token 时效 + 直播流偶发（Pitfall 7），自动化禁真实网络为红线；VALIDATION.md 标记 manual-only

#### 2. 缓存链路 fMP4 转换 + QuickTime A1

**Test:** `npm run dev` 播放 fMP4 VOD 源，确认缓存目录出现 init 文件，抽屉/任务页「转换为 MP4」，mpv/VLC 打开产物；再用 QuickTime 打开任一拼接产物
**Expected:** mpv/VLC 可播即通过；BYTERANGE/差异形态应落 init_missing 文案而非坏产物；QuickTime 失败不阻塞（A1，结果记 UAT 供决策）
**Why human:** 真实网络形态 + 多播放器兼容性只能真机验证；RESEARCH A1 [ASSUMED] 待关闭

### Gaps Summary

无自动化 gap。17/17 must-haves 全部代码级 + 行为级验证通过：拼接产物字节级精确、probe 可解析、拒转语义与清理正确、录制/缓存双链路 initPath 五跳/三跳接线完整、四套件 106 例全绿零回归、零新依赖、禁言全部成立。阶段目标能力（fMP4 分片序列 → 可播放 mp4 产物）在合成夹具上已被独立行为证据直接证明；真实 B 站流端到端证明按设计（Pitfall 7/VALIDATION manual-only）归 UAT，故状态为 human_needed 而非 passed。

---

_Verified: 2026-09-08T05:27:36Z_
_Verifier: Claude (gsd-verifier)_

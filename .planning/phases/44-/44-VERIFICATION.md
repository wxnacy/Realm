---
phase: 44-player-video-cache-and-local-media-library
verified: 2026-09-06T14:56:06Z
status: human_needed
score: 20/21 must-haves verified
covered_files:
  - .planning/phases/44-/44-01-PLAN.md
  - .planning/phases/44-/44-01-SUMMARY.md
  - .planning/phases/44-/44-02-PLAN.md
  - .planning/phases/44-/44-02-SUMMARY.md
  - .planning/phases/44-/44-03-PLAN.md
  - .planning/phases/44-/44-03-SUMMARY.md
  - .planning/phases/44-/44-04-PLAN.md
  - .planning/phases/44-/44-04-SUMMARY.md
  - .planning/phases/44-/44-05-PLAN.md
  - .planning/phases/44-/44-05-SUMMARY.md
  - .planning/phases/44-/44-06-PLAN.md
  - .planning/phases/44-/44-06-SUMMARY.md
  - .planning/phases/44-/44-07-PLAN.md
  - .planning/phases/44-/44-07-SUMMARY.md
  - .planning/phases/44-/44-08-PLAN.md
  - .planning/phases/44-/44-08-SUMMARY.md
  - .planning/phases/44-/44-CONTEXT.md
  - .planning/phases/44-/44-REVIEW.md
  - .planning/STATE.md
  - docs/product/navigation-entry-points.md
  - ipc-handlers.js
  - main.js
  - media-cache-manager.js
  - media-m3u8-parser.js
  - media-record-engine.js
  - media-remuxer.js
  - media-task-manager.js
  - package.json
  - player-history-manager.js
  - src/index.html
  - src/player.css
  - src/player.html
  - src/player.js
  - src/preload.js
  - src/renderer.js
  - src/settings-page.js
  - src/settings.html
  - src/styles/main.css
  - src/tasks-page.js
  - src/tasks.html
  - tests/test-media-cache.js
  - tests/test-media-remuxer.js
  - tests/test-media-task-registry.js
  - tests/test-m3u8-playlist-parser.js
  - tests/test-unified-navigation.js
covered_digest: "v1:sha256:1e943ab3a48b4b34c439494030e9047d0687e4e4e74679e50f99727fb3ef98f5"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 15/21
  gaps_closed:
    - "重开已看视频秒开/不重复回源（D-05 核心目标）— CR-01 lookup 先于 fetch"
    - "按视频粒度 FIFO 淘汰在生产路径生效（D-06/D-07）— CR-02 写路径水位淘汰 + setCapacityBytes"
    - "断网/源站失效时已缓存分片照播（D-10）— CR-01 同根因，命中分支先行修复后成立"
    - "崩溃/失败中断的录制可「已落盘部分续转」（D-18）— CR-03 RECORD_ROOT 补算（failed 路径闭合；硬崩溃无 meta.json 边界仍受 WR-C 限制，见报告）"
    - "任务页「停止」对运行中录制生效 — CR-04 cancel 桥接 recordEngine.stopRecord"
    - "缓存 tee 路径源流错误健壮性 — CR-05 store()/透传分支源流 error 监听"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "关窗/应用退出两级确认（D-19）按预期弹一次并记住默认"
    test: "dev/打包环境：有活跃录制时关播放器窗口（未记忆默认时）观察确认框与 checkbox 记忆；再走一次 Cmd+Q 取消退出后关播放器窗口，确认录制确认框仍弹出"
    expected: "窗口级确认弹一次、写 settings.recordCloseAction；取消退出后确认不被永久跳过"
    why_human: "对话框/退出流程交互无自动化测试；且 WR-05（appQuitting 置位后永不复位，ipc-handlers.js:40-43）提示取消退出后确认可能被静默跳过，需真机判定影响面"
human_verification:
  - test: "真机重开已看视频秒开体感（CR-01 修复后；前次第 1 项，未被修复证伪）"
    expected: "重开同一视频已看部分立即起播、网络面板/日志无分片回源请求；接着上次进度继续"
    why_human: "秒开是体感指标，依赖真实网络与磁盘时序"
  - test: "webview tab 模式播放回归（D-01；前次第 2 项，未被修复证伪）"
    expected: "webview tab 内播放行为与 Phase 43 完全一致，无缓存落盘、无 mode=independent 行为"
    why_human: "需要真机双模式对比"
  - test: "断网/源站失效降级提示条（CR-01 修复后；前次第 3 项，修复后该测试才有意义）"
    expected: "播放中断网：已缓存分片继续播、提示条「部分分片加载失败，已缓存部分可继续观看」约 4s 消失、恢复网络后播放续上"
    why_human: "依赖真实网络故障注入"
  - test: "直播录制全链路（真实直播源；前次第 4 项，CR-04 修复后停止语义才正确）"
    expected: "录制按钮→红点闪烁→hover tooltip「已录 mm:ss · xxxMB」→停止→任务页可见→关窗/退出确认→产物 meta.json 正确"
    why_human: "依赖真实直播源的滑动窗口/防盗链行为"
  - test: "系统通知与 Finder 定位（打包版优先，dev 环境 Notification 可能静默；前次第 5 项）"
    expected: "convert 完成/失败通知弹出，点击定位产物"
    why_human: "系统通知行为 make install 后真机才能验证"
  - test: "mux.js 真机转封装产物可播性（前次第 6 项）"
    expected: "录制→停止→自动弹框→转换→产物在 QuickTime/IINA 播放，时长/进度/音画正常"
    why_human: "mux.js Node 侧长时转封装真机首跑，单测无法证明产物可播"
  - test: "任务页三区渲染/空态/角标显隐/设置分区即改即存（前次第 7 项）"
    expected: "三区与状态文案符合 UI-SPEC；角标 count>0 显示归零消失、点击跳 realm://tasks；改缓存目录/容量即时生效（改小容量触发淘汰）"
    why_human: "视觉与交互规格"
  - test: "抽屉增删/续播/转换按钮 gating（D-17；前次第 8 项）"
    expected: "抽屉条目展示、删除确认框居中、完整度 100% 或中断条目才显「转换为 MP4」"
    why_human: "视觉与交互规格"
  - test: "崩溃中断任务续转实况（WR-C 派生新增项——决定 D-18 硬崩溃承诺是否需 44-09）"
    expected: "可控模拟：录制进行中 kill 主进程 → 重启 → 任务页该任务显示「已中断」→ 点「已落盘部分续转」：因录制中从不写 meta.json（writeMeta 仅 stop/fail/pl.ended/异常兜底四路径），RECORD_ROOT/<taskId>/ 无 meta.json，readRecordTaskSegments 短路返回 null → 仍 400 no_segments（.ts 分片滞留目录）。请判定：此项属可接受边界（记 REVIEW.md 债务，建议录制中周期性写轻量 meta 或按 <seq>.ts 文件名合成索引）还是必须本阶段闭合"
    why_human: "需要真机 kill 模拟与产品决策；代码路径已逐行确认（media-record-engine.js writeMeta 仅 :225/:237/:246/:270，无周期写；main.js:3032 metaPath 缺失 return null）"
---

# Phase 44: 播放器视频缓存与本地媒体库 Verification Report（gap-closure 后复验）

**Phase Goal:** 独立播放器的 HLS 本地媒体库能力（webview tab 模式保持现状不做缓存）：① 独立窗口收口 /proxy；② 分片级磁盘缓存 + FIFO 淘汰 + 设置页配置；③ 观看历史精确续播；④ 统一媒体任务中心（直播录制 + mux.js 转封装）；⑤ realm://tasks 任务页 + 角标。
**Verified:** 2026-09-06T14:56:06Z
**Status:** human_needed（代码层 0 失败 gap；20/21 代码级核实，1 项 PRESENT_BEHAVIOR_UNVERIFIED；8+1 项 human-only 复测待 UAT）
**Re-verification:** Yes — gap-closure 后复验（前次 gaps_found 15/21，CR-01~CR-05 五项 Critical 经 44-06/07/08 修复，commit 09f380d..1a7bf3f）

## Goal Achievement

**复验结论：前次 5 条 failed truth 的根因缺陷（CR-01~CR-05）经代码逐行核实**全部结构性闭合**——5 条真值全部由 ✗ FAILED 转为 ✓ VERIFIED（代码层），无回归（另 16 条既有 passing truth 全部保持）。单测实跑全绿：test-media-cache 20/20、test-media-remuxer 17/17、test-media-task-registry 26/26、test-m3u8-playlist-parser 15/15、test-unified-navigation 32/32（五个套件本轮全部独立实跑确认，与 SUMMARY 声称一致）。44-REVIEW.md 复评（f7d182e）0 Critical / 3 Warning / 2 Info——其中 2 条 Warning（WR-B 死代码、WR-C 硬崩溃边界）与 1 条 Info（IN-01 形参名）经核实不影响任一 must-have 真值成立（WR-C 对 truth #15 构成部分限制，见下）。**

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ① 独立播放窗口收口走 /proxy（localhost 加载 player 页 + token + mode=independent，标题栏保留） | ✓ VERIFIED | ipc-handlers.js:2078 `playerWindow.loadURL('http://localhost:…/player/?…')`；player.js:318 `isIndependentMode`；gap-closure 未触碰（回归确认）。真实窗口加载走 UAT |
| 2 | ② 分片按视频目录落盘（segments + meta.json）并读盘命中 | ✓ VERIFIED | media-cache-manager.js storeBuffer/lookup/_safePath；tests 20/20。生产命中顺序缺陷已修复（见 #3） |
| 3 | 重开已看部分秒开、不重复回源（D-05 核心） | ✓ VERIFIED（CR-01 闭合） | **previously FAILED → 现 VERIFIED**：main.js:369 `mediaCache.lookup(target, vidParam)` 先于 :388 `ses.fetch(target)`；命中 `writeHead(200, Content-Length=hit.size, no-store)` + `end(hit.data)` + `return`（:370-380）——**不发起任何源站请求**；key 统一请求 URL target，全文无 `lookup(finalUrl`/`store(finalUrl` 残留；m3u8-likely 与带 Range 请求被命中分支显式排除（:367-368）。真机秒开体感留 human 第 1 项 |
| 4 | 按视频粒度 FIFO 淘汰生产生效（D-06/D-07） | ✓ VERIFIED（CR-02 闭合） | **previously FAILED → 现 VERIFIED**：storeBuffer 落盘登记成功（_writeMeta 后，media-cache-manager.js:436）即累计 `_trackedTotal` 水位（:444-447，首写惰性取磁盘权威总量防双计），越 capacityBytes 才 `evictIfNeeded(new Set([videoId]))` 一轮（:449-458，exempt 正在写目录 + isVideoActive 活跃豁免保留）；`setCapacityBytes()`（:513-523）校验赋值 + 立即淘汰 + 水位同步；main.js:1378 cacheMaxGB 改走 setCapacityBytes，无字段直写残留。行为单测覆盖：写路径自动淘汰（FIFO 取最旧，test :170）、setCapacityBytes 缩小触发（:214）、自豁免（:232）。注意 WR-A：单视频持续超限时每片写盘触发一次全库扫描无退避（性能 Warning，见 Anti-Patterns） |
| 5 | 设置页可配缓存目录/容量并生效 | ✓ VERIFIED | buildMediaCacheOptions + /api/settings/choose-cache-dir；settings-page.js 视频缓存分区；cacheMaxGB 即改即存经 setCapacityBytes（main.js:1375-1378，CR-02 桥接后改小容量即触发一轮淘汰） |
| 6 | ③ 观看历史独立记录 + 续播 key=origin+pathname（query 不参与） | ✓ VERIFIED | player-history-manager.js（player_history 表 playback_key 主键 upsert，:46/:74-78）；D-12 断言；player.js:708-722 续播 seek |
| 7 | 进度 5s/暂停/关窗三路落盘（D-13） | ✓ VERIFIED | player.js setInterval 5000 + pause + player:request-final-progress（ipc-handlers.js:2110-2117） |
| 8 | 断网/源站失效已缓存分片照播 + 降级提示条（D-10） | ✓ VERIFIED（CR-01 同根因闭合） | **previously FAILED → 现 VERIFIED（结构层）**：命中分支在 fetch 之前且命中即 return——已缓存分片**永不触达源站**，源站失效/断网不影响其响应（代码控制流直接保证，非竞态）；未缓存分片 fetch throw 走 502 catch（main.js:465-471），player.js 降级提示条与 startLoad 重试链路可达且 WR-06 已修复（FRAG_LOADED 复位 hlsRetryCount，player.js:212-213——瞬时错误恢复后降级重试不永久失效）。端到端断网故障注入留 human 第 3 项 |
| 9 | ④ 任务注册表状态机/持久化/崩溃恢复（D-25/D-18） | ✓ VERIFIED | media-task-manager.js；tests/test-media-task-registry.js 26/26；persist media-tasks.json + restore（unmodified by closures，回归绿） |
| 10 | 直播录制引擎（并发上限/同 URL 去重/失败重试/独立目录，D-18/D-21/D-23） | ✓ VERIFIED | media-record-engine.js（纯 Node、首轮基线、seq 去重、重试停录、recordRoot 独立，main.js:2994 recordRoot: RECORD_ROOT）。真实直播源走 UAT |
| 11 | 录制 UI（按钮/红点/抽屉面板，D-14~D-16/D-21） | ✓ VERIFIED | player.html/css 红点/抽屉；player:record/start\|stop\|status\|list 四通道（ipc-handlers.js:2343/2382/2400/2411）。视觉走 UAT |
| 12 | 关窗/应用退出两级确认（D-19） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 接线在位（ipc-handlers.js:2119-2150 recordCloseAction 记忆；main.js:4329 hasActiveTasks 退出确认）；WR-05（appQuitting 置位后永不复位，ipc-handlers.js:40-43——取消的 Cmd+Q 后窗口级确认可能被永久跳过）仍在，gap-closure 明示范围外 → 见 behavior_unverified_items + human 复测 |
| 13 | mux.js TS→fMP4 转封装后台任务（D-04/D-24） | ✓ VERIFIED | mux.js@^6.3.0（package.json:52，零 ffmpeg）；media-remuxer.js；tests/test-media-remuxer.js 17/17（含 shouldCancel 两用例）；main.js startConvertTask + lastMediaSaveDir 记忆 |
| 14 | D-22 录制停止自动接力 convert | ✓ VERIFIED | main.js:3235 onTaskCompleted → :3237 startConvertFromRecordTask（:3193）；取消弹框不建任务、分片保留 |
| 15 | 崩溃/失败中断录制「已落盘部分续转」（D-18 崩溃不白录） | ✓ VERIFIED（CR-03 闭合于 gated 范围；**WR-C 限制硬崩溃子路径，见下方说明**） | **previously FAILED → 现 VERIFIED（CR-03 映射断裂修复）**：readRecordTaskSegments（main.js:3018-3045）outputPath 缺失时按 `path.join(RECORD_ROOT, task.id)` 补算（:3026-3030），task.id 过 `/^[0-9a-fA-F-]{8,64}$/` uuid 白名单防穿越（:3028）；RECORD_ROOT 常量单一来源（main.js:2979，字面全文件唯一，createRecordEngine.recordRoot :2994 同源）。**闭合范围**：failed（网络自动停录已写 meta.json）+「写完 meta 未 persist」竞态窗口两类中断任务现可读盘续转（meta.json 存在即不再恒 400）。**残余（WR-C，Warning 非 Critical）**：录制中从不周期写 meta.json（writeMeta 仅 stop/fail/pl.ended/异常兜底：media-record-engine.js:225/:237/:246/:270），硬崩溃（OS kill/断电/主进程崩）中断任务的 RECORD_ROOT/<taskId>/ 无 meta.json → readRecordTaskSegments :3032 短路 return null → 续转仍 400——「崩溃不白录」对真硬崩溃仍受限；44-07 计划明示「硬崩溃未写 meta.json 属既有边界不扩展」，复评定为 Warning，留 human 第 9 项判定是否需 44-09（周期写轻量 meta 或按 `<seq>.ts` 数字文件名合成索引） |
| 16 | ⑤ realm://tasks 任务页三区/进度/产物定位（D-26） | ✓ VERIFIED | src/tasks.html + tasks-page.js；main.js /tasks 路由 + /api/tasks/list\|show-in-folder（token 鉴权，:2237-2256）+ media-task:changed/count-changed 广播 |
| 17 | 任务页「停止」对运行中录制生效 | ✓ VERIFIED（CR-04 闭合） | **previously FAILED → 现 VERIFIED**：/api/tasks/cancel（main.js:2168-2234）按类型分派——running record → `recordEngine.stopRecord(taskId)`（:2192，与红点停止同原语：停轮询 + writeMeta + completeTask 落 completed + D-22 接力；not_found 且回读仍 running 才 cancelTask 兜底 :2200-2207，已终态 200 already-stopped）；running convert → convertCancelTokens 协作式信号（:2219）；不存在 404（:2180-2183）、非 running 400（cancelTask 抛非法流转）。convertToMp4 shouldCancel 每分片检查点（media-remuxer.js:167-168）+ 令牌 set/.finally delete（main.js:3101/:3151）+ .catch cancelled → cancelTask（:3134）。单测覆盖取消路径（remuxer 17/17）。**WR-B（Warning）**：非 running 分支 :2186-2187 的 200 响应是死代码（cancelTask 必然 throw → 外层 400），实际行为维持 400 不回归，但注释/代码语义自相矛盾（见 Anti-Patterns） |
| 18 | 主窗口角标被动提醒（zero-one-many，点击 openUrl 收敛） | ✓ VERIFIED | renderer.js:10540-10553 onMediaTaskCountChanged + openUrl('realm://tasks')，preload 桥接 |
| 19 | 【禁止】webview tab 模式不做缓存（D-01） | ✓ VERIFIED | cache=1 仅独立窗口 URL 注入（ipc-handlers.js:2078 playParams）；player.js:330 cache 从 URL 参数透传——webview tab 页面 URL 无 cache 参数 → handleProxyRequest cacheEnabled=false 纯透传。gap-closure 未触碰此链路 |
| 20 | 【禁止】缓存 key/目录名禁用原始 URL 拼路径 | ✓ VERIFIED | videoId/segKey 均 sha256 hex + _safePath resolve 前缀 + realpath 复核；symlink 逃逸拒绝有单测（test :320/:329/:346）；lookup D-09 大小/sha256 校验删片回源保留（media-cache-manager.js:274-286，prohibition gate 过） |
| 21 | 【禁止】不使用 ffmpeg-static；不引 hls-parser | ✓ VERIFIED | package.json 零 ffmpeg/hls-parser，唯一新依赖 mux.js ^6.3.0 |

**Score:** 20/21 truths verified（0 failed，1 PRESENT_BEHAVIOR_UNVERIFIED = #12）
**code-level gap 数：0**（前次 5 条 failed truth 全部闭合）

### Deferred Items

无（Step 9b：无任何 must-have gap 顺延到后续 phase；本阶段为 milestone 最后 phase，无 later-phase 覆盖对象）。

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| media-cache-manager.js | 缓存管理器（读写盘/淘汰/校验/路径安全） | ✓ VERIFIED | 20/20 单测；CR-02 写路径水位淘汰 + setCapacityBytes；CR-05 源流 error 监听（:344-348 pipe 前挂载）；lookup contentType 回放 |
| player-history-manager.js | player_history 表 CRUD | ✓ VERIFIED | playback_key 主键 upsert |
| media-m3u8-parser.js | 纯函数清单解析 | ✓ VERIFIED | 15/15 单测 |
| media-task-manager.js | 任务注册表状态机 | ✓ VERIFIED | 26/26 单测（gap-closure 零改动，回归绿） |
| media-record-engine.js | 直播录制引擎 | ✓ VERIFIED | 纯 Node、stopRecord 原语完整（writeMeta + completeTask）；WR-C 限制见 truth #15 |
| media-remuxer.js | mux.js 转封装封装 | ✓ VERIFIED | 17/17 单测（含 shouldCancel 取消两用例） |
| tests/*（5 套件） | 单测 | ✓ VERIFIED | cache 20 + remuxer 17 + registry 26 + parser 15 + navigation 32（本轮实跑确认全绿） |
| src/tasks.html + tasks-page.js | 任务页三件套 | ✓ VERIFIED | 零内联 style（IN-01 例外：CSP 含 style unsafe-inline，Info 级）、token 鉴权 |
| main.js 集成 | 缓存/注册表/引擎/端点 | ✓ VERIFIED | CR-01 命中优先、CR-02 setCapacityBytes、CR-03 RECORD_ROOT 补算、CR-04 cancel 分派全部接线在位 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| /proxy 分片命中路径 | 磁盘读盘响应 | handleProxyRequest pre-fetch 分支 | ✓ WIRED（CR-01） | lookup@369 < fetch@388，命中直返 return 不回源；m3u8/Range 排除 |
| player.js proxiedUrl(cache=1) | main.js handleProxyRequest 缓存分流 | URL 参数 | ✓ WIRED | cache 参数仅独立窗口注入，key=target 两端统一 |
| mediaCache.store/lookup | 磁盘 `<videoId>/segments/` | _safePath | ✓ WIRED | sha256 hex 路径 + D-09 校验保留 |
| mediaCache.store 源流 | 'error' 监听 | Node 流契约 | ✓ WIRED（CR-05） | store() pipe 前挂 readable.on('error') destroy 双 tee（:344-348）；main.js 透传分支同款（:456-461）；tee.on('error') → res.end 收尾（:433-435） |
| storeBuffer 成功登记 | evictIfNeeded | 水位累计 | ✓ WIRED（CR-02） | _trackedTotal 越限才触发一轮，exempt 自身 + 活跃豁免 |
| main.js cacheMaxGB 更新 | setCapacityBytes → evictIfNeeded | settings:update | ✓ WIRED | :1378，无 capacityBytes 字段直写 |
| record 任务 interrupted/failed | readRecordTaskSegments | RECORD_ROOT/<task.id> 补算 | ✓ WIRED（CR-03） | outputPath 缺失补算 + uuid 白名单；meta.json 存在即续转（硬崩溃无 meta 仍限 WR-C） |
| /api/tasks/cancel (record) | recordEngine.stopRecord | 集成层桥接 | ✓ WIRED（CR-04） | :2192；红点/任务页停止同原语 |
| /api/tasks/cancel (convert) | convertToMp4 shouldCancel | convertCancelTokens | ✓ WIRED（CR-04） | :2219 信号 → remuxer :167-168 检查点 → .catch cancelled → cancelTask（:3134） |
| record 任务终态 | onTaskCompleted → startConvertFromRecordTask | 接力钩子 | ✓ WIRED | main.js:3235-3237 |
| 任务终态 | notifyRenderer 广播 → 角标/任务页 | persist diff | ✓ WIRED | main.js:2131 count-changed |
| hls ERROR 重试 | FRAG_LOADED 复位 | player.js hls 事件 | ✓ WIRED（WR-06） | :212-213 hlsRetryCount=0 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 任务页列表 | /api/tasks/list | mediaTaskManager.listTasks() | ✓ | ✓ FLOWING |
| 任务页停止 | /api/tasks/cancel → stopRecord/取消信号 | recordEngine/remuxer 真实停止 | ✓ | ✓ FLOWING（CR-04 后不再是状态标记） |
| 续转分片 | readRecordTaskSegments | RECORD_ROOT/<task.id>/meta.json | ✓（meta 存在时） | ✓ FLOWING（CR-03 后补算生效；硬崩溃无 meta 限 WR-C） |
| 缓存命中响应 | lookup(target, vidParam) | 磁盘 segments 读回 + contentType 回放 | ✓ | ✓ FLOWING（CR-01 后命中不回源） |
| 角标计数 | media-task:count-changed | persist diff | ✓ | ✓ FLOWING |
| 续播位置 | player:resume-position | player_history.getByKey | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 缓存管理器单测（含 CR-02 写路径淘汰/setCapacityBytes/CR-05 error 源/contentType） | node tests/test-media-cache.js | 20 pass / 0 fail | ✓ PASS |
| remuxer 单测（含 shouldCancel 取消两用例） | node tests/test-media-remuxer.js | 17 pass / 0 fail | ✓ PASS |
| 任务注册表单测 | node tests/test-media-task-registry.js | 26 pass / 0 fail | ✓ PASS |
| m3u8 解析器单测 | node tests/test-m3u8-playlist-parser.js | 15 pass / 0 fail | ✓ PASS |
| 导航回归 | node tests/test-unified-navigation.js | 32 通过 / 0 失败 | ✓ PASS |
| 语法检查 | node --check main.js / media-cache-manager.js / media-remuxer.js / src/player.js | 全过 | ✓ PASS |
| 命中先于回源 | 源码断言 lookup@369 < fetch@388 + 无 finalUrl-key 调用 | 命中先于回源 | ✓ PASS（CR-01） |
| 淘汰生产可达性 | storeBuffer :444-458 水位检查 + setCapacityBytes 单测 | 写路径自动淘汰 | ✓ PASS（CR-02） |
| cancel→引擎桥接 | grep recordEngine.stopRecord(taskId) @:2192 + convertCancelTokens @:2219 | 桥接在位 | ✓ PASS（CR-04） |
| store 源流 error | store() :344 readable.on('error') 先于 :349/:350 pipe | 监听先于 pipe | ✓ PASS（CR-05） |

### Probe Execution

无 probe 脚本声明（非迁移/tooling phase）；以 5 个单测套件 + 4 文件语法检查实跑替代。

### Requirements Coverage

REQUIREMENTS.md 无 Phase 44 需求 ID（specless）。以 CONTEXT.md D-01~D-26 为决策骨架。gap-closure 计划 requirements 并集（D-03/D-05/D-10 + D-06/D-07/D-08/D-18 + D-18/D-25/D-26）与既验 D-01~D-26 全覆盖一致，无孤儿。D-05/D-10（CR-01）、D-06/D-07（CR-02）、D-18（CR-03 补算 / CR-04 停止）、D-25/D-26（CR-04）修复后原「部分证伪」状态全部解除——唯 D-18 硬崩溃子路径受 WR-C 限制（见 #15 与 human 第 9 项）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| media-cache-manager.js | 444-458 | WR-A：单视频持续超限时水位检查每片写盘触发一次全库 listEntries 扫描无进展退避（该 videoId 自豁免零删除 → 每片重复全扫） | ⚠️ Warning | 默认 10GB + 单条 >10GB VOD 观看或改小容量场景的性能回归；44-07 prohibition「无每分片全库扫描」在「持续超限单视频」情形未完全达成。不证伪 truth #4（多视频/改容量路径淘汰真实生效，单测覆盖）；建议退避或目录内按 stored_at 删最旧分片 |
| main.js | 2184-2188 | WR-B：非 running cancel 分支先调 cancelTask（必 throw）后写 200 死代码——实际恒 400，与 record 分支幂等 already-stopped 200 语义不一致 | ⚠️ Warning | 行为不回归（400 保持），但注释/代码语义自相矛盾，误导后续维护者「清理死代码」改坏行为；建议删死代码并对已终态显式幂等 200 |
| main.js:3018 / media-record-engine.js | 3032 / 167-192 | WR-C：录制中从不周期写 meta.json（仅 stop/fail/pl.ended/异常兜底四路径），硬崩溃 interrupted 任务无索引可转 | ⚠️ Warning | truth #15 的 D-18「崩溃不白录」对真硬崩溃子路径仍受限（续转 400、.ts 滞留）；44-07 明示为既有边界、复评 0 Critical 归类 Warning；建议周期写轻量 meta 或按 `<seq>.ts` 合成索引——已列入 human 第 9 项待产品判定 |
| ipc-handlers.js | 40-43 | WR-05：appQuitting 置位后永不复位（取消的 Cmd+Q 后窗口级录制确认被永久跳过） | ⚠️ Warning | 关联 truth #12（PRESENT_BEHAVIOR_UNVERIFIED）；44-08 明示范围外，UAT 复测 #12 时一并观察 |
| media-record-engine.js | 201/144 | WR-01：fetchPage 无超时 | ⚠️ Warning | 挂起连接使录制无限停滞（既有债务，不在 gap-closure 范围） |
| media-cache-manager.js | 255-260/332-337/385-390 | IN-01：公开方法形参仍名 finalUrl，与实际传入的请求 URL target 语义漂移（CR-01 后） | ℹ️ Info | 阅读方易误解 key 语义而引入漂移；建议改名 cacheKey/requestUrl 并同步类头注释 |
| main.js | 3147-3153 | IN-02：startConvertTask .finally 中 try/catch 包裹不可能抛错的 Map.delete | ℹ️ Info | 冗余防御噪声，无缺陷 |
| media-cache-manager.js | 195-212/369-415 | WR-02：meta.json 非原子读写 | ⚠️ Warning | 并发写丢索引/截断 JSON（既有债务） |
| media-cache-manager.js | 514-531 | WR-03：master 清单完整度恒 100%（updatePlaylistIndex） | ⚠️ Warning | 多码率流 D-17 gating 失效 + 孤儿目录（既有债务） |
| main.js | 386-408 | WR-04：EXT-X-KEY 密钥被当分片缓存（既有债务） | ⚠️ Warning | 加密流转封装必失败 |
| media-record-engine.js | 209 | IN-04：失败计数每轮清零（间歇故障源永不触发停录） | ℹ️ Info | 既有债务 |
| src/tasks.html | 7 | IN-01（原）：CSP 引入 style unsafe-inline | ℹ️ Info | 偏离内部页面 CSP 约定（既有债务） |
| main.js | 1312-1332 | IN-03：settings:update 可直写 cacheDir（token 限制内纵深缺口） | ℹ️ Info | 既有债务 |

（gap-closure 涉及四文件无 TBD/FIXME/XXX 债务标记、无 stub 返回值、无注释反义残留；node --check 全过。）

### Human Verification Required

前次 8 项 human-only 复测**全部未被 gap-closure 证伪**（CR-01 修复后第 1/3 项从「必然失败」变为「可验证」；CR-04 修复后第 4 项停止语义正确），继续保留；另新增 1 项由 WR-C 派生（第 9 项：崩溃中断续转实况 + 产品判定）。完整明细见 frontmatter `human_verification`（9 项）。

### Gaps Summary

**代码层 0 failed gap**。前次 5 条 failed truth（#3/#4/#8/#15/#17）与 CR-05 崩溃级缺陷全部闭合，逐项核实：

1. **CR-01（#3/#8）**：命中优先分支（lookup@369 → fetch@388 之前，命中直返 return）使「重开秒开不回源」「断网已缓存分片照播」在生产路径成立——前次「每分片必回源、断网 502」的证伪根因消除。
2. **CR-02（#4）**：storeBuffer 写路径水位淘汰 + setCapacityBytes（改容量即收敛）使 10GB 上限真实生效，多视频与改容量场景单测行为证明（20/20）。
3. **CR-03（#15）**：RECORD_ROOT 单一来源 + outputPath 缺失按 task.id 补算（uuid 白名单），failed/竞态中断任务续转不再恒 400。残余硬崩溃无 meta.json 子路径由 WR-C 记录（复评 0 Critical 归类 Warning），留 human 第 9 项判定。
4. **CR-04（#17）**：cancel 路由按类型分派桥接 recordEngine.stopRecord / convert 协作式取消信号，任务页停止 = 真实停录/停转码（不再无限落盘），鉴权与非法流转语义零回归。
5. **CR-05**：store() 与透传分支源流 error 监听，源站 RST 不再 uncaught 崩主进程。

**残余均为 Warning/Info 级债务**（WR-A/B/C/05/01/02/03/04、IN-01/02/03/04），其中 WR-C 是唯一与 must-have 真值（#15）部分相关的项，按项目「Warning 记 REVIEW.md 债务不阻断收尾」先例与复评 0 Critical 判定不构成 failed gap，但已显式提升至 human 第 9 项供产品决策。

**状态说明**：status = human_needed——代码层 must-have 全部核实（20/21，1 项 #12 保持 PRESENT_BEHAVIOR_UNVERIFIED）、无 failed gap；但 9 项 human-only 复测（含 8 项前次保留 + WR-C 派生项）待 UAT 真机执行。若以代码闭合为门槛，本复验结果 = 通过（可进入 UAT）；UAT 通过即 phase.complete（既有收尾约定）。

---

_Verified: 2026-09-06T14:56:06Z_
_Verifier: Claude (gsd-verifier) — re-verification after gap closure (44-06/07/08)_

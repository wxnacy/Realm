---
phase: 44-player-video-cache-and-local-media-library
verified: 2026-09-06T14:20:00Z
status: gaps_found
score: 15/21 must-haves verified
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
  - docs/product/navigation-entry-points.md
  - download-manager.js
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
covered_digest: "v1:sha256:9849ef3b48de14dbbe1e21e1dcebea4064b8a0d3813ade29fef3769bf87f15d9"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "关窗/应用退出两级确认（D-19）按预期弹一次并记住默认"
    test: "dev/打包环境：有活跃录制时关播放器窗口（未记忆默认时）观察确认框与 checkbox 记忆；再走一次 Cmd+Q 取消退出后关播放器窗口，确认录制确认框仍弹出"
    expected: "窗口级确认弹一次、写 settings.recordCloseAction；取消退出后确认不被永久跳过"
    why_human: "对话框/退出流程交互无自动化测试；且 WR-05（appQuitting 置位后永不复位）提示取消退出后确认可能被静默跳过，需真机判定影响面"
coincidental_reliance_items: []
gaps:
  - truth: "重开已看视频秒开/不重复回源（D-05 核心目标）"
    status: failed
    reason: "CR-01：main.js handleProxyRequest 中 ses.fetch(target)（main.js:356）先于 mediaCache.lookup（main.js:390）执行。缓存命中时响应虽取自磁盘，但每个分片请求必然先打一次源站——零省流量、延迟=回源+读盘；源站 5xx 时播放直接失败。『秒开』的收益前提（不回源）不成立"
    artifacts:
      - path: main.js
        issue: "handleProxyRequest 缓存查询晚于 ses.fetch；断网时 fetch throw 进 :429 catch 返回 502，缓存有分片也无法命中"
    missing:
      - "把 mediaCache.lookup 移到 ses.fetch 之前（cache 分支先查缓存，命中直接返回不回源；未命中才 fetch + tee 落盘）；cache key 统一用请求 URL（target）或命中后校验 meta 最终 URL"
  - truth: "断网/源站失效时已缓存分片照播（D-10）"
    status: failed
    reason: "同 CR-01 根因：断网时 ses.fetch 直接 throw，请求在缓存查询前就失败返回 502。player.js 精心实现的降级链路（fatal network error → 提示条 → startLoad 重试）拿不到任何缓存数据——『已缓存部分可继续观看』文案承诺不成立"
    artifacts:
      - path: main.js
        issue: "缓存命中不可达于网络失败场景（fetch 在 lookup 之前）"
      - path: src/player.js
        issue: "降级提示条与重试逻辑本身存在（:760 附近）但底层永远取不到缓存数据"
    missing:
      - "CR-01 修复后此真值自动成立；同时修复 WR-06（hlsRetryCount 成功后不复位，累计 3 次后降级重试永久失效）"
  - truth: "按视频粒度 FIFO 淘汰在生产路径生效（D-06/D-07）"
    status: failed
    reason: "CR-02：evictIfNeeded 唯一调用点在 _writeWithEvictRetry 的 ENOSPC/EDQUOT 分支（media-cache-manager.js:432），即只有物理磁盘写满才触发。capacityBytes（10GB 上限）阈值比较只在 evictIfNeeded 内部，storeBuffer 登记成功后（media-cache-manager.js:409-410）不做容量检查；设置页改小 cacheMaxGB 也只更新参数不触发淘汰。单测直接调 evictIfNeeded 所以全绿，掩盖了生产缺线"
    artifacts:
      - path: media-cache-manager.js
        issue: "storeBuffer 成功路径无容量水位检查；evictIfNeeded 生产不可达"
      - path: main.js
        issue: "改 cacheMaxGB 后不触发一轮淘汰"
    missing:
      - "storeBuffer 落盘登记成功后主动调 evictIfNeeded(new Set([videoId]))（内部已有阈值短路）；main.js 改小容量后同步触发一轮淘汰"
  - truth: "崩溃/失败中断的录制可「已落盘部分续转」（D-18 崩溃不白录）"
    status: failed
    reason: "CR-03：record 任务 outputPath 仅在 completeTask({ outputPath }) 时写入（media-task-manager.js:155）；registerTask 初始化为 null（:124），failTask 不写 outputPath，restoreTasks 恢复的 interrupted 任务保存值也是 null。readRecordTaskSegments（main.js:2914-2916）对 outputPath 为 null 直接返回 null → convert-resume 恒 400 no_segments。meta.json 明明已写在 media-records/<taskId>/ 但 taskId→目录映射断裂"
    artifacts:
      - path: media-task-manager.js
        issue: "outputPath 到终态才落库，interrupted/failed 必为 null"
      - path: main.js
        issue: "readRecordTaskSegments 无 outputPath 缺失时的目录补算回退"
    missing:
      - "最小修复：startConvertFromRecordTask 内 `const recordDir = task.outputPath || path.join(recordRoot, task.id)`（recordRoot 与 createRecordEngine 注入值同源，建议提常量）；更彻底：registerTask 时即写 outputPath"
  - truth: "任务页「停止」对运行中录制生效（⑤ 任务中心停止能力）"
    status: failed
    reason: "CR-04：/api/tasks/cancel（main.js:2121-2138）只调 mediaTaskManager.cancelTask 改注册表状态；media-task-manager 无 onCancel 钩子，main.js 也未把 cancel 桥接到 recordEngine.stopRecord——轮询循环继续拉清单、下分片、写盘（updateProgress 因任务已终态 throw 被吞，循环永不停止）。用户点停止后录制实际无限继续，磁盘无上限消耗且 meta.json 永不落盘"
    artifacts:
      - path: main.js
        issue: "cancel 端点未桥接 recordEngine.stopRecord（main.js 全文无 stopRecord 调用；引擎停止仅经 player:record/stop IPC，ipc-handlers.js:2388）"
      - path: media-task-manager.js
        issue: "无取消事件钩子供集成层订阅"
    missing:
      - "cancel 端点对 running record 任务先调 recordEngine.stopRecord(taskId)（引擎 completeTask 后无需再 cancelTask，not_found 时才 cancelTask）；convert 任务需给 convertToMp4 加取消信号"
  - truth: "缓存 tee 路径源流错误健壮性（分片传输中断不崩主进程）"
    status: failed
    reason: "CR-05：mediaCache.store()（media-cache-manager.js:324-353）对源流 readable 只做两次 pipe，未在 readable 自身挂 'error' 监听（collector/passthrough 的 error 监听救不了源流）。Node 流契约：源流 error 无监听 → uncaught exception → 主进程退出——整个浏览器崩溃（可能正有录制任务在跑）。源站 RST/链路闪断是常态场景"
    artifacts:
      - path: media-cache-manager.js
        issue: "store() 缺 readable.on('error')；main.js:425 既有透传分支同款模式（Phase 27 遗留同一风险面）"
    missing:
      - "store() 内 pipe 前 readable.on('error') → destroy passthrough/collector + console.warn；main.js:425 透传分支补同款监听"
human_verification:
  - test: "真机重开已看视频秒开体感（CR-01 修复后）"
    expected: "重开同一视频已看部分立即起播、网络面板/日志无分片回源请求；接着上次进度继续"
    why_human: "秒开是体感指标，依赖真实网络与磁盘时序"
  - test: "webview tab 模式播放回归（D-01）"
    expected: "webview tab 内播放行为与 Phase 43 完全一致，无缓存落盘、无 mode=independent 行为"
    why_human: "需要真机双模式对比"
  - test: "断网/源站失效降级提示条（CR-01 修复后）"
    expected: "播放中断网：已缓存分片继续播、提示条「部分分片加载失败，已缓存部分可继续观看」约 4s 消失、恢复网络后播放续上"
    why_human: "依赖真实网络故障注入"
  - test: "直播录制全链路（真实直播源）"
    expected: "录制按钮→红点闪烁→hover tooltip「已录 mm:ss · xxxMB」→停止→任务页可见→关窗/退出确认→产物 meta.json 正确"
    why_human: "依赖真实直播源的滑动窗口/防盗链行为"
  - test: "系统通知与 Finder 定位（打包版优先，dev 环境 Notification 可能静默）"
    expected: "convert 完成/失败通知弹出，点击定位产物"
    why_human: "系统通知行为 make install 后真机才能验证"
  - test: "mux.js 真机转封装产物可播性"
    expected: "录制→停止→自动弹框→转换→产物在 QuickTime/IINA 播放，时长/进度/音画正常"
    why_human: "mux.js Node 侧长时转封装真机首跑，单测无法证明产物可播"
  - test: "任务页三区渲染/空态/角标显隐/设置分区即改即存"
    expected: "三区与状态文案符合 UI-SPEC；角标 count>0 显示归零消失、点击跳 realm://tasks；改缓存目录/容量即时生效"
    why_human: "视觉与交互规格"
  - test: "抽屉增删/续播/转换按钮 gating（D-17）"
    expected: "抽屉条目展示、删除确认框居中、完整度 100% 或中断条目才显「转换为 MP4」"
    why_human: "视觉与交互规格"
---

# Phase 44: 播放器视频缓存与本地媒体库 Verification Report

**Phase Goal:** 独立播放器的 HLS 本地媒体库能力（webview tab 模式保持现状不做缓存）：① 独立窗口收口 /proxy；② 分片级磁盘缓存 + FIFO 淘汰 + 设置页配置；③ 观看历史精确续播；④ 统一媒体任务中心（直播录制 + mux.js 转封装）；⑤ realm://tasks 任务页 + 角标。
**Verified:** 2026-09-06T14:20:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

**模块分解与纯逻辑层质量良好**（去 Electron 化模块 + 71 项单测全绿 + 路径安全/状态机/白名单校验扎实），但 44-REVIEW.md 的 5 项 Critical **全部未修复**（最后一个 commit 即审查文档本身 801d172，其后无修复提交），经逐项代码核实全部属实——其中 4 项直接证伪 must-have 真值，1 项（CR-05）是主进程崩溃级健壮性缺陷。**核心体验「重开秒开 + 断网照播」在生产路径不成立。**

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ① 独立播放窗口收口走 /proxy（localhost 加载 player 页 + token + mode=independent，标题栏保留） | ✓ VERIFIED | ipc-handlers.js:2078 `playerWindow.loadURL('http://localhost:…/player/?…')`；player.js:312 `isIndependentMode`；红绿灯分支 :342。真实窗口加载走 UAT |
| 2 | ② 分片按视频组织目录落盘（segments + meta.json）并读盘命中 | ✓ VERIFIED | media-cache-manager.js（videoId/segKey sha256 hex、storeBuffer/lookup、D-05 字段）；tests/test-media-cache.js 15/15。注意：生产命中顺序缺陷见 #3/#8 |
| 3 | 重开已看部分秒开、不重复回源（D-05 核心） | ✗ FAILED | **CR-01**：main.js:356 `ses.fetch(target)` 先于 :390 `mediaCache.lookup`——每分片必回源，断网时 502 |
| 4 | 按视频粒度 FIFO 淘汰生产生效（D-06/D-07） | ✗ FAILED | **CR-02**：evictIfNeeded 仅 ENOSPC 路径可达（media-cache-manager.js:432）；storeBuffer 成功路径无容量检查（:409-410 直接 return）；容量上限形同虚设 |
| 5 | 设置页可配缓存目录/容量并生效 | ✓ VERIFIED | main.js buildMediaCacheOptions（:2839-2847，cacheDir/cacheMaxGB/isVideoActive 三参数）、rebuildMediaCache、/api/settings/choose-cache-dir（:1365-1381）；settings-page.js:1373-1380 |
| 6 | ③ 观看历史独立记录 + 续播 key=origin+pathname（query 不参与） | ✓ VERIFIED | player-history-manager.js（player_history 表，playback_key 主键 upsert）；tests/test-media-cache.js D-12 断言；player.js:697-713 续播 seek |
| 7 | 进度 5s/暂停/关窗三路落盘（D-13） | ✓ VERIFIED | player.js:742-752（setInterval 5000 + pause 事件 + onRequestFinalProgress）；ipc-handlers.js:2204 player:progress |
| 8 | 断网/源站失效已缓存分片照播 + 降级提示条（D-10） | ✗ FAILED | **CR-01 同根因**：网络失败在缓存查询前就 502（main.js:429-434 catch）；提示条 UI 存在（player.js:760）但拿不到缓存数据 |
| 9 | ④ 任务注册表状态机/持久化/崩溃恢复（D-25/D-18） | ✓ VERIFIED | media-task-manager.js；tests/test-media-task-registry.js 26/26（流转/拒绝/persist/restore interrupted）；main.js persist 写 media-tasks.json + restore |
| 10 | 直播录制引擎（并发上限/同 URL 去重/失败重试/独立目录，D-18/D-21/D-23） | ✓ VERIFIED | media-record-engine.js（纯 Node、首轮基线不落盘、seq 去重、重试停录、独立 recordRoot）；main.js:2874-2889 fetchPage 容器 session 包装。真实直播源走 UAT |
| 11 | 录制 UI（按钮/红点/抽屉面板，D-14~D-16/D-21） | ✓ VERIFIED | player.html/css（红点 #EF4444 闪烁、抽屉 320px、ellipsis、删除 dialog margin:auto）、player:record/start\|stop\|status\|list 四通道（ipc-handlers.js:2343/2382）。视觉走 UAT |
| 12 | 关窗/应用退出两级确认（D-19） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 接线在位（ipc-handlers.js:2123-2138 recordCloseAction 记忆；main.js:4185 hasActiveTasks 确认）；但 WR-05（appQuitting 置位后永不复位——任何一次含取消的 Cmd+Q 后窗口级确认被永久跳过）+ 无运行时测试 → 见 behavior_unverified_items |
| 13 | mux.js TS→fMP4 转封装后台任务（D-04/D-24） | ✓ VERIFIED | mux.js@^6.3.0（package.json:52，无 ffmpeg-static）；media-remuxer.js（单实例顺序 push、先监听后 push、流式写盘）；tests/test-media-remuxer.js 15/15；main.js startConvertTask（lastMediaSaveDir 记忆 + getUniqueFilePath 同名序号） |
| 14 | D-22 录制停止自动接力 convert | ✓ VERIFIED | main.js:3093 onTaskCompleted 分支 record→startConvertFromRecordTask；取消弹框不建任务、分片保留 |
| 15 | 崩溃/中断录制「已落盘部分续转」（D-18 崩溃不白录） | ✗ FAILED | **CR-03**：interrupted/failed 任务 outputPath 恒 null（media-task-manager.js:124/:155），readRecordTaskSegments（main.js:2915-2916）返回 null → convert-resume 恒 no_segments |
| 16 | ⑤ realm://tasks 任务页三区/进度/产物定位（D-26） | ✓ VERIFIED | src/tasks.html + tasks-page.js（base href /tasks/、零内联 style、5s 轮询）；main.js /tasks 路由 + /api/tasks/list\|show-in-folder（token 鉴权）+ media-task:changed/count-changed 广播 |
| 17 | 任务页「停止」对运行中录制生效 | ✗ FAILED | **CR-04**：/api/tasks/cancel（main.js:2132）仅 cancelTask，未桥接 recordEngine.stopRecord——引擎轮询永不停止 |
| 18 | 主窗口角标被动提醒（zero-one-many，点击 openUrl 收敛） | ✓ VERIFIED | renderer.js:10541-10553（onMediaTaskCountChanged + openUrl('realm://tasks')，零 fetch HTTP）；preload.js:1537；导航文档两个新入口已收录 |
| 19 | 【禁止】webview tab 模式不做缓存（D-01） | ✓ VERIFIED | cache=1 仅独立模式注入（player.js:324 白名单透传）；handleProxyRequest 缓存分支仅 `searchParams.get('cache')==='1'` 进入；webview 流量 URL 无 cache 参数 |
| 20 | 【禁止】缓存 key/目录名禁用原始 URL 拼路径 | ✓ VERIFIED | videoId/segKey 均 sha256 hex（单测断言）+ _safePath resolve 前缀 + realpath 复核（symlink 逃逸拒绝有断言） |
| 21 | 【禁止】不使用 ffmpeg-static；不引 hls-parser | ✓ VERIFIED | package.json 零 ffmpeg，唯一新依赖 mux.js ^6.3.0；media-m3u8-parser.js 手写行级解析零依赖 |

**Score:** 15/21 truths verified（5 failed，1 present-behavior-unverified）

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| media-cache-manager.js | 缓存管理器（读写盘/淘汰/校验/路径安全） | ✓ VERIFIED | 类完整、去 Electron 化；但生产淘汰接线缺失（CR-02）、store() 缺源流 error 监听（CR-05） |
| player-history-manager.js | player_history 表 CRUD | ✓ VERIFIED | playback_key 主键 upsert、延迟初始化 |
| media-m3u8-parser.js | 纯函数清单解析 | ✓ VERIFIED | 15/15 单测、零依赖 |
| media-task-manager.js | 任务注册表状态机 | ✓ VERIFIED | 26/26 单测；缺取消钩子（CR-04 关联） |
| media-record-engine.js | 直播录制引擎 | ✓ VERIFIED | 纯 Node、fetchPage 注入 |
| media-remuxer.js | mux.js 转封装封装 | ✓ VERIFIED | 单实例/先监听后 push/discontinuity 拒转 |
| tests/*（4 个新套件） | Wave 0 单测 | ✓ VERIFIED | 15+15+26+15 全绿（本轮实跑确认） |
| src/tasks.html + tasks-page.js | 任务页三件套 | ✓ VERIFIED | 零内联 style、token 鉴权、空态文案 |
| main.js 集成 | 缓存/注册表/引擎/端点 | ⚠️ PARTIAL | 大部分接线在位；CR-01/02/04 的关键顺序/桥接缺失 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| player.js proxiedUrl(cache=1) | main.js handleProxyRequest 缓存分流 | URL 参数 | ⚠️ PARTIAL | 分流分支存在，但命中在回源之后（CR-01） |
| mediaCache.store/lookup | 磁盘 `<videoId>/segments/` | _safePath | ✓ WIRED | sha256 hex 路径 + realpath 校验 |
| player.js reportProgress | player:progress → player_history | IPC | ✓ WIRED | 三路触发齐备 |
| mediaTaskManager.isVideoActive | mediaCache 构造注入 | buildMediaCacheOptions | ✓ WIRED | main.js:2845-2847 |
| /api/tasks/cancel | recordEngine.stopRecord | 集成层桥接 | ✗ NOT_WIRED | **CR-04**：无任何桥接 |
| record 任务终态 | onTaskCompleted → startConvertTask | 接力钩子 | ✓ WIRED | main.js:3093 |
| record 任务 interrupted | readRecordTaskSegments | outputPath | ✗ BROKEN | **CR-03**：outputPath null → no_segments |
| 任务终态 | notifyRenderer 广播 → 角标/任务页 | persist diff | ✓ WIRED | main.js:2083/2093 |
| store() 源流 | 'error' 监听 | Node 流契约 | ✗ MISSING | **CR-05**：源流无监听 → 主进程崩溃风险 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 任务页列表 | /api/tasks/list | mediaTaskManager.listTasks() | ✓ | ✓ FLOWING |
| 抽屉列表 | player:drawer:list | mediaCache + playerHistory 合并 | ✓ | ✓ FLOWING（completeness 由 44-05 updatePlaylistIndex 补齐） |
| 角标计数 | media-task:count-changed | persist diff | ✓ | ✓ FLOWING |
| 续播位置 | player:resume-position | player_history.getByKey | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 缓存管理器单测 | node tests/test-media-cache.js | pass 15 / fail 0 | ✓ PASS |
| m3u8 解析器单测 | node tests/test-m3u8-playlist-parser.js | pass 15 / fail 0 | ✓ PASS |
| 任务注册表单测 | node tests/test-media-task-registry.js | pass 26 / fail 0 | ✓ PASS |
| remuxer 单测 | node tests/test-media-remuxer.js | pass 15 / fail 0 | ✓ PASS |
| 导航回归 | node tests/test-unified-navigation.js | 32 通过 0 失败 | ✓ PASS |
| 缓存命中先于回源 | 代码检查 main.js:356 vs :390 | fetch 先执行 | ✗ FAIL（CR-01） |
| 淘汰生产可达性 | 代码检查 evictIfNeeded 调用点 | 仅 ENOSPC 分支 | ✗ FAIL（CR-02） |
| cancel→引擎桥接 | grep stopRecord main.js | 无匹配 | ✗ FAIL（CR-04） |

### Probe Execution

无 probe 脚本声明（非迁移/tooling phase）；Spot-checks 以 5 个单测套件实跑替代。

### Requirements Coverage

REQUIREMENTS.md 无 Phase 44 需求 ID（TBD，specless）。以 CONTEXT.md D-01~D-26 为决策骨架，5 个 PLAN requirements 字段并集 = **D-01~D-26 全覆盖，无孤儿**。D-01~D-26 各项归属与验证状态见 truths 表 #1-#21（D-05/D-06/D-07/D-10/D-18 因 Critical 缺陷部分证伪）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| main.js | 356/390 | 缓存查询晚于网络请求（顺序缺陷） | 🛑 Blocker | D-05 秒开/D-10 断网照播均不成立 |
| media-cache-manager.js | 432 | evictIfNeeded 生产不可达 | 🛑 Blocker | 容量上限失效，缓存只增到物理盘满 |
| media-task-manager.js / main.js | 124 / 2915 | outputPath 终态才落库 | 🛑 Blocker | 崩溃不白录承诺失效 |
| main.js | 2121-2138 | cancel 未桥接引擎 | 🛑 Blocker | 停止无效 + 无限落盘 |
| media-cache-manager.js | 324-353 | 源流无 error 监听 | 🛑 Blocker | 分片传输中断 → 主进程崩溃 |
| ipc-handlers.js | 40-43 | appQuitting 永不复位（WR-05） | ⚠️ Warning | 取消退出后窗口级录制确认被永久跳过 |
| src/player.js | 36/160 | hlsRetryCount 不复位（WR-06） | ⚠️ Warning | 3 次瞬时错误后降级重试永久失效 |
| media-record-engine.js | 201/144 | fetchPage 无超时（WR-01） | ⚠️ Warning | 挂起连接使录制无限停滞 |
| media-cache-manager.js | 195-212/369-415 | meta.json 非原子读写（WR-02） | ⚠️ Warning | 并发写丢索引/截断 JSON |
| media-cache-manager.js | 514-531 | master 清单完整度恒 100%（WR-03） | ⚠️ Warning | D-17 gating 对多码率流失效 + 孤儿目录 |
| main.js | 386-408 | EXT-X-KEY 密钥被当分片缓存（WR-04） | ⚠️ Warning | 加密流转封装必失败 |
| media-record-engine.js | 209 | 失败计数每轮清零（IN-04） | ℹ️ Info | 间歇故障源永不触发停录 |
| src/tasks.html | 7 | CSP 引入 style unsafe-inline（IN-01） | ℹ️ Info | 偏离内部页面 CSP 约定 |
| main.js | 1312-1332 | settings:update 可直写 cacheDir（IN-03） | ℹ️ Info | T-44-08 纵深缺口（token 限制内） |

（无 TBD/FIXME/XXX/PLACEHOLDER 债务标记；无 stub 返回值；主体接线无孤儿文件。）

### Human Verification Required

见 frontmatter `human_verification` 8 项（44-VALIDATION Manual-Only + UAT 清单）。注意第 1/3 项（秒开体感、断网降级）在 CR-01 修复前**必然失败**，修复后再验。

### Gaps Summary

5 个 gap 全部源自 44-REVIEW.md 的 CR-01~CR-05，经逐项代码核实**全部属实且未修复**（git 历史：最后 commit 801d172 即审查文档，无后续修复提交）：

1. **CR-01（最重）**：缓存命中排在回源之后——阶段核心卖点「重开秒开」「断网照播」双双失效。分片仍落盘、命中时响应取自磁盘，但每个分片必先打源站（零省流量、延迟更差），断网时直接 502。player.js 降级链路成为死代码。
2. **CR-02**：10GB 容量上限的 FIFO 淘汰只在物理磁盘写满（ENOSPC）时才可能触发——正常使用中缓存无界增长。
3. **CR-03**：interrupted/failed 录制任务 outputPath 恒 null，续转链路 400——「崩溃不白录」兜底承诺不成立（meta.json 明明已写盘）。
4. **CR-04**：任务页「停止」只改状态标不停引擎——running 录制被取消后无限轮询落盘。
5. **CR-05**：缓存 tee 源流无 error 监听——一次源站 RST 即可让整个浏览器主进程崩溃。

**修复面收敛**：五项都在 main.js / media-cache-manager.js / media-task-manager.js 集成层，纯逻辑模块与单测无需改动；CR-01 修复（lookup 提前）同时解锁 gap 1 与 gap 2。建议走 `/gsd-plan-phase 44 --gaps` 生成闭合计划，先修 CR-01/CR-05（体验与稳定性），再修 CR-02/03/04。

---

_Verified: 2026-09-06T14:20:00Z_
_Verifier: Claude (gsd-verifier)_

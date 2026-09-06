---
phase: 44-player-video-cache-and-local-media-library
plan: 04
subsystem: media
tags: [live-recording, m3u8-polling, background-task, drawer-panel, quit-confirmation, electron-ipc]

# Dependency graph
requires:
  - phase: 44-01
    provides: playbackKey（origin+pathname）语义、player:drawer:list 数据形状、playerWindow close 拦截兜底
  - phase: 44-02
    provides: media-m3u8-parser（parsePlaylist/resolveUri）、media-task-manager（registerTask/failTask/completeTask/onTaskCompleted/isVideoActive）
  - phase: 44-03
    provides: mediaTaskManager 主进程集成（persist/广播/通知）、media-task:changed 通道、任务页与角标
provides:
  - media-record-engine.js — createRecordEngine 直播录制引擎（纯 Node 可加载，fetchPage 注入去 Electron 化）
  - ipc-handlers.js：player:record/start|stop|status|list 四通道 + playerWindow close 拦截录制确认（settings.recordCloseAction 记忆）
  - main.js：recordEngine 集成（fetchPage 容器 session 包装）+ before-quit hasActiveTasks 确认（D-19）
  - playerAPI.startRecord/stopRecord/getRecordStatus/getRecordList/onRecordStateChanged
  - 播放器录制按钮/红点/抽屉面板全套 UI（UI-SPEC Component 1/2/3/4）
affects: [44-05 转封装（stopRecord completeTask 触发 D-22 接力，meta.json 索引就绪）]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 11500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []   # 零新依赖
  patterns:
    - "去 Electron 化引擎 + 注入 fetchPage（集成层在 main.js 用容器 session 包装 ses.fetch）"
    - "轮询循环 setTimeout 链（非 setInterval）+ stopped 标志位，stop/fail 路径竞态安全"
    - "appQuitting 模块级标志：应用退出流程已有全局确认，窗口 close 拦截不再重复弹录制确认"
    - "红点按 playbackKey 匹配当前 URL 任务实况渲染（syncRecordUi），切视频红点消失但任务不清（D-20）"

key-files:
  created:
    - media-record-engine.js
  modified:
    - main.js
    - ipc-handlers.js
    - src/player.html
    - src/player.css
    - src/player.js
    - src/preload.js

key-decisions:
  - "录制进度语义：live 流分母持续增长故 updateProgress 偏低（recorded/seen 比率钳 99），VOD 转正后收敛为真实百分比；已录分片数/大小走 getRecordStatus + meta.json，不塞进 percent 字段"
  - "meta.json 在 stop 与 fail 两条路径都写——失败后已落盘分片与索引保留（D-18），44-05 续转可直接消费"
  - "Task 3 确认后不按计划字面 setImmediate(app.quit()) 重启 quit，而是置 quitConfirmed 续走既有协程——双击确认门（quitConfirmAt/quitting 标志）会拦截重启路径，续走协程末尾既有的 setImmediate 跳出模式语义等价"
  - "关窗确认弹窗用主进程 dialog.showMessageBox（checkbox 记忆），非 renderer 内 dialog——与既有 close 拦截兜底同层，窗口销毁时序可控"

patterns-established:
  - "引擎去 Electron 化：fetchPage (url, { referer, containerId }) => Promise<Buffer> 注入，集成层包装 ses.fetch（UA/Referer/容器 session 语义与 handleProxyRequest 一致）"
  - "D-19 两级确认分层：窗口级（close 拦截 + recordCloseAction 记忆）与应用级（before-quit hasActiveTasks），appQuitting 标志防止退出时双重弹窗"

requirements-completed: [D-14, D-15, D-16, D-18, D-19, D-20, D-21, D-23]

coverage:
  - id: T1
    description: "录制引擎：并发上限/同 playbackKey 去重/首轮基线不落盘/seq 去重追分片/重试 N 次标 failed（分片+索引保留）/stop→meta.json→completeTask/轮询间隔钳 2s"
    requirement: D-18
    verification:
      - kind: unit
        ref: "node tests/test-m3u8-playlist-parser.js 15/15 + test-media-task-registry.js 26/26 + 引擎行为冒烟（基线不回溯/去重/并发/重试停录全过）"
      - kind: human_judgment
        ref: "真实直播源轮询追分片体感需 UAT（44-VALIDATION Manual-Only）"
        status: pending-uat
    human_judgment: true
    rationale: "真实直播源的滑动窗口行为/防盗链/分片格式依赖真机验证"
  - id: T2
    description: "录制按钮/红点闪烁/tooltip/抽屉面板（320px 右滑、ellipsis、进度条、元信息、hover 删除、空态）按 UI-SPEC 渲染；record/start|stop 链路通；关窗确认记忆默认选择"
    requirement: D-21
    verification:
      - kind: other
        ref: "node --check 全过；grep record/start、startRecord、recordCloseAction、margin: auto 全命中；test-unified-navigation.js 32/32"
      - kind: human_judgment
        ref: "红点闪烁/抽屉交互/删除确认框居中需 UAT 真机验证"
        status: pending-uat
    human_judgment: true
    rationale: "视觉与交互规格依赖真机 UAT"
  - id: T3
    description: "before-quit 活跃任务退出确认：hasActiveTasks 弹确认（Cookie 保存前），确认续走既有 quit 协程，取消解除退出锁"
    requirement: D-19
    verification:
      - kind: other
        ref: "node --check main.js；grep hasActiveTasks main.js 命中；setImmediate(() => app.quit()) 既有跳出模式保留（2 处）"
      - kind: human_judgment
        ref: "退出确认弹窗与取消路径需 UAT 真机验证"
        status: pending-uat
    human_judgment: true
    rationale: "退出流程交互依赖真机环境"

# Metrics
duration: 14min
completed: 2026-09-06
status: complete
plan_head_before: 38dd758db21410ecee86c2996cc2ba7d298a79b4
---

# Phase 44 Plan 04: 直播录制全链路 — 录制引擎 + 播放器录制 UI/抽屉 + 两级退出确认 Summary

**主进程 media-record-engine（m3u8 轮询追分片，D-18/D-20/D-21/D-23）+ 播放器录制按钮/红点/抽屉面板（UI-SPEC Component 1-4）+ record IPC + 关窗/应用退出两级确认（D-19），任务中心获得第一类真实任务**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-06T12:06:22Z
- **Completed:** 2026-09-06T12:20Z
- **Tasks:** 3
- **Files modified:** 7（1 新建 + 6 修改）

## Accomplishments

- **media-record-engine.js**（去 Electron 化纯 Node 可加载）：`createRecordEngine({ fetchPage, parsePlaylist, taskManager, recordRoot, maxConcurrent, maxRetries })`——startRecord 同 playbackKey 去重拒绝 + 并发上限（默认 2）+ registerTask 携带 playbackKey（D-07 淘汰豁免查询源）；轮询循环首轮清单只记基线不落盘（D-21 从直播边缘开始）、按 seq 去重追新分片写 `recordRoot/<taskId>/segments/<seq 补零>.ts`（T-44-11 无远端输入入路径）、轮询间隔 = targetDuration 钳下限 2s（T-44-13）；连续失败 maxRetries 次停录标 failed（分片与 meta.json 索引保留，D-18）；stopRecord 停轮询写 meta.json（title/segments/总时长/总大小）后 completeTask({ outputPath })——D-22 转码接力挂点由 44-05 消费；VOD 转正自动录完 completeTask
- **播放器录制 UI**（UI-SPEC Component 1/2）：工具栏录制按钮 32×32 描边圆点、录制中隐藏图标让位红点；红点 #EF4444 闪烁（opacity 1s 循环）+ `-webkit-app-region: no-drag` 可点击停止 + hover tooltip「已录 mm:ss · xxxMB」1s 定时刷新（tabular-nums）；onRecordStateChanged（media-task:changed 过滤 type=record）同步红点——播放/暂停/刷新/切视频不触碰录制任务，切走后红点消失但任务页仍 running（D-20），切回来自动恢复
- **抽屉面板**（UI-SPEC Component 3/4，D-14/D-15/D-16）：320px 右滑 rgba(0,0,0,0.85) 底、z-index 95 与 speed-menu 同层、打开时控制栏保持可见；条目标题 14px/600 单行 ellipsis、续播进度条 3px accent 填充、元信息 13px「缓存大小 · 完整度% · 最近观看时间」、hover 显删除按钮（aria-label「删除缓存」）；条目点击关抽屉按原 URL 走 initPlayerWithResume 续播链路；删除确认原生 `<dialog>` 显式 `margin: auto` + ::backdrop（AGENTS.md 弹框居中约定），文案按 UI-SPEC；空态「暂无观看记录」+ body 文案
- **record IPC**（T-44-12：assertPlayerSender + containerId /^[\w-]+$/ 校验）：player:record/start（fetchPage 用容器 session 包装 ses.fetch，参照 handleProxyRequest 语义）、stop、status（红点 hover 数据源）、list（新增）；player:cache:delete 兼容 playbackKey 入参（抽屉条目无 videoId）
- **关窗确认（D-19）**：44-01 close 进度兜底之上扩展——活跃录制时 `settings.recordCloseAction` 已记忆直接执行（stop-save 路径 stopAll 后继续关窗序列），否则 dialog.showMessageBox「继续后台录制 / 停止并保存」+ checkbox「记住我的选择」写 configStore；appQuitting 标志跳过（应用退出已有全局确认，不双弹）
- **应用退出确认（D-19）**：既有 before-quit 协程内（Cookie 保存前）插入 hasActiveTasks 分支——确认置 quitConfirmed 续走既有退出协程（setImmediate 跳出模式不变），取消解除退出锁留在应用；退出中断的任务下次启动由 restoreTasks 标记 interrupted（D-18 兜底）

## Task Commits

Each task was committed atomically:

1. **Task 1: media-record-engine.js — 直播 m3u8 轮询追分片引擎** - `770de88` (feat)
2. **Task 2: 播放器录制 UI + 抽屉面板 + record IPC 与关窗确认** - `cab8f2c` (feat)
3. **Task 3: before-quit 活跃任务退出确认（D-19）** - `1a543f4` (feat)

## Files Created/Modified

- `media-record-engine.js`（新）- 录制引擎工厂（纯 Node，fetchPage 注入）
- `main.js` - recordEngine 集成（fetchPage 容器 session 包装 + recordRoot=media-records）+ setMediaRecordEngine 注入 + before-quit 确认
- `ipc-handlers.js` - player:record/start|stop|status|list 四通道 + close 拦截录制确认 + cache:delete playbackKey 兼容
- `src/player.html` - 录制按钮/抽屉按钮/红点/抽屉面板/删除确认 dialog
- `src/player.css` - 红点闪烁/tooltip/抽屉/删除框样式（--player- token 恒暗层）+ webview 模式隐藏录制入口
- `src/player.js` - 录制状态机（syncRecordUi/updateRecordUi）、红点 hover 刷新、抽屉渲染/删除/续播加载、hideControls 抽屉守卫
- `src/preload.js` - playerAPI 五个录制通道

## Decisions Made

- **录制进度语义**：live 流分母持续增长，updateProgress 传 recorded/seen 比率（钳 99%）偏低是真实语义；VOD 转正后收敛为准确百分比；已录分片数/大小经 getRecordStatus + meta.json 承载，不塞 percent
- **meta.json 双路径落盘**：stop 与 fail 都写索引——失败后已落盘分片与索引保留（D-18），44-05「已落盘部分续转」可直接读
- **Task 3 确认后续走既有协程**（计划字面是 setImmediate 重启 quit）：既有双击确认门（quitConfirmAt/quitting 标志）会拦截重入，续走协程末尾既有的 setImmediate(() => app.quit()) 跳出模式语义等价且避免死锁
- **appQuitting 标志**：应用退出时窗口 close 事件也会触发录制确认——before-quit 已有全局确认，模块级 appQuitting（before-quit 置位）使窗口级确认跳过，避免双重弹窗
- **新增 player:record/list 通道**：keep-recording 关窗后重开播放器窗口，renderer 无从得知既存录制任务的 taskId——红点按 playbackKey 匹配运行中任务列表恢复显示

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 3 确认后不重启 quit 而是续走既有协程**
- **Found during:** Task 3
- **Issue:** 计划字面「确认则置 quitConfirmed 并 setImmediate(() => app.quit())」——但既有协程在确认点之前已置 quitting=true 且有双击确认门（quitConfirmAt 窗口期），重启 quit 重入 before-quit 会在 `if (quitting) return` 处被拦截导致退出停滞
- **Fix:** 确认置 quitConfirmed 后直接续走协程（窗口 bounds 保存 → Cookie 保存 → 既有 setImmediate(() => app.quit()) 跳出），语义等价且复用「before-quit 不等待 async handler」既有注释约束的跳出模式
- **Files modified:** main.js
- **Verification:** node --check 通过；退出链路各标志位路径人工核对
- **Committed in:** 1a543f4

**2. [Rule 2 - Missing Critical] 新增 player:record/list 通道（红点恢复数据源）**
- **Found during:** Task 2
- **Issue:** D-19「继续后台录制」关窗后重开播放器窗口，计划通道清单（start/stop/status/onRecordStateChanged）无法让 renderer 得知既存录制任务——红点永远不显示，违反 D-20「红点仅按任务状态渲染」
- **Fix:** ipc-handlers 新增 player:record/list（assertPlayerSender）返回 getActiveRecordings()；preload 加 getRecordList；player.js syncRecordUi 按 playbackKey 匹配当前 URL 恢复红点
- **Files modified:** ipc-handlers.js, src/preload.js, src/player.js
- **Committed in:** cab8f2c

**3. [Rule 1 - Bug] player:cache:delete 入参形状与抽屉数据不匹配**
- **Found during:** Task 2
- **Issue:** 既有通道只接受 16 位 hex videoId，而 player:drawer:list 契约条目携带 playbackKey——抽屉删除按钮会静默失败
- **Fix:** 通道兼容 playbackKey 入参（经 videoIdOf 换算后走原校验）
- **Files modified:** ipc-handlers.js
- **Committed in:** cab8f2c

---

**Total deviations:** 3 auto-fixed（1 blocking 修复 + 2 缺失关键能力，无 scope creep）
**Impact on plan:** 均为正确性必需。

## Issues Encountered

None.

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- **44-05（转封装）**：stopRecord/failTask/VOD completeTask 三条路径均触发 completeTask（D-22 接力）或保留产物；meta.json（title/segments 列表/总时长/总大小）在 recordRoot/<taskId>/ 就绪，产物命名「标题 + 时间戳」sanitize 按 T-44 计划在 44-05 落地
- UAT 待验证（Manual-Only）：真实直播源录制（红点闪烁/tooltip/追分片体感）、关窗/退出两级确认、抽屉增删与续播、系统通知（dev 环境 Notification 可能静默，建议打包版验证——Pitfall 8）

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- 7 个交付/改动文件全部存在（1 新建 + 6 修改 + SUMMARY）
- 3 个任务 commit 均在 git 历史（770de88 / cab8f2c / 1a543f4）
- 计划级验证全绿：6 个 JS 文件 node --check 通过、test-m3u8-playlist-parser.js 15/15、test-media-task-registry.js 26/26、test-media-cache.js 15/15、test-unified-navigation.js 32/32、引擎 pure-node 可加载 + 行为冒烟全过
- commits 计量（gsd-plan-head-before-44-04..HEAD）：3，与 actuals 一致

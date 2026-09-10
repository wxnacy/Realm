---
phase: 44-player-video-cache-and-local-media-library
plan: 05
subsystem: media
tags: [mp4-remux, mux.js, fmp4, background-task, save-dialog, drawer, discontinuity, electron-ipc]

# Dependency graph
requires:
  - phase: 44-02
    provides: media-task-manager（onTaskCompleted D-22 接力钩子、registerTask type=convert、updateProgress/failTask/completeTask）
  - phase: 44-03
    provides: mediaTaskManager 主进程集成（persist/广播/通知链路）、/api/tasks/convert-resume 预留 404 路由位
  - phase: 44-04
    provides: record 引擎 meta.json 分片索引（stop/fail 双路径落盘）、抽屉渲染结构、record IPC
provides:
  - media-remuxer.js — convertToMp4（单实例 Transmuxer 顺序 push + 先监听后 push + 流式写盘 + discontinuity 拒转）/ sanitizeFilename / buildOutputName
  - configStore 键 settings.lastMediaSaveDir（D-24 弹框默认目录记忆）
  - media-cache-manager：updatePlaylistIndex（分片播放顺序/总数/ENDLIST/DISCONTINUITY 索引）+ getConvertInfo（completeness 计算）——44-01 player:drawer:list completeness 预留字段补齐
  - ipc-handlers player:convert/start 通道 + main.js POST /api/tasks/convert-resume（44-03 预留位落地）+ D-22 record→convert 自动接力
  - download-manager.getUniqueFilePath 导出（同名「 (2)」序号复用）
affects: [44-VALIDATION（UAT 全链路手工验证）]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 8500
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added:
    - mux.js@^6.3.0（唯一新依赖，D-04 定稿纯 JS：videojs 官方、CJS 入口、无 postinstall/原生模块，不触发 asarUnpack）
  patterns:
    - "mux.js 时序契约：data 监听注册先于首次 push + 单实例跨分片顺序 push（时间轴连续）+ flush 每分片 + createWriteStream 流式写盘"
    - "转换发起统一入口 startConvertTask（弹框→序号→注册任务→后台转封装），IPC 侧经 setMediaConvertStarter 桥透传、D-17 校验在主进程服务端复校"
    - "缓存条目转封装顺序：playlist_order（m3u8 请求时登记的 segKey 有序数组）优先、stored_at 时间序兜底"
    - "persist 写放大控制：convert 进度整数百分比变化才 updateProgress"

key-files:
  created:
    - media-remuxer.js
    - tests/test-media-remuxer.js
  modified:
    - package.json
    - main.js
    - ipc-handlers.js
    - media-cache-manager.js
    - media-record-engine.js
    - download-manager.js
    - src/player.js
    - src/player.css
    - src/preload.js
    - src/tasks-page.js

key-decisions:
  - "discontinuity 拒转依据落到数据源：record 引擎轮询时检测 #EXT-X-DISCONTINUITY（整行匹配不误中 DISCONTINUITY-SEQUENCE）写 meta.json；缓存条目在 m3u8 请求时检测写 meta——convertToMp4 收到 hasDiscontinuity 直接 reject 不尝试（Pitfall 5）"
  - "缓存 meta 附加字段（playlist_order/total_segments/playlist_ended/has_discontinuity/segments[].stored_at）向后兼容，不升 META_VERSION：旧 meta 缺字段时 completeness=null → 转换按钮隐藏，读端零迁移成本"
  - "convert 任务 error 统一带「MP4 转换失败：」前缀落库（任务页 UI-SPEC 文案），showTaskNotification 相应去重前缀避免双拼"
  - "续转范围扩展：record 任务 interrupted/failed/completed 均可「已落盘部分续转」（D-22 取消弹框后补转语义；failed 覆盖 UI-SPEC「已录部分仍可转换为 MP4」）"
  - "convert 进度只在整数百分比变化时 updateProgress——注册表每次变更都触发 persist 写盘，逐分片更新会造成写放大"

patterns-established:
  - "convertToMp4 契约：err.reason 机器可读（discontinuity/no_segments/segment_missing/transmux_failed/write_failed），集成层 CONVERT_FAIL_TEXT 映射用户文案；失败清理半成品产物"
  - "D-17 gating 三层：前端按钮隐藏（completeness>=100）→ IPC 透传 → main.js 服务端复校（segments_incomplete/discontinuity 拒绝）；分片路径仅取自主进程索引（T-44-16 不接受 renderer 传路径）"

requirements-completed: [D-04, D-17, D-22, D-24, D-26]

coverage:
  - id: T1
    description: "mux.js 安装与主进程可用（CJS 构造 smoke）；convertToMp4 单实例顺序 push + data 监听先于 push（源码结构断言）+ 流式写盘 + discontinuity/空分片/缺分片拒转；sanitizeFilename 白名单替换/80 字符裁剪；buildOutputName「{标题} {YYYY-MM-DD HHmm}.mp4」"
    requirement: D-04
    verification:
      - kind: unit
        ref: "node tests/test-media-remuxer.js（15 断言）"
        status: pass
    human_judgment: false
  - id: T2
    description: "convert 任务编排：showSaveDialog lastMediaSaveDir 记忆 + 同名序号 + 后台转封装 + 终态通知/定位（44-03 链路）；D-22 record→convert 自动接力；convert-resume 端点落地；抽屉转换按钮 D-17 gating + 服务端复校"
    requirement: D-22
    verification:
      - kind: other
        ref: "node --check 9 文件全过；grep convert-resume/lastMediaSaveDir/startConvert 命中；回归 cache 15/15 + parser 15/15 + registry 26/26 + navigation 32/32"
      - kind: human_judgment
        ref: "弹框接力/通知/Finder 定位/真实直播转封装产物可播性需 UAT（44-VALIDATION Manual-Only；RESEARCH A3/Pitfall 8：通知 dev 可能静默、转封装真机首跑验证，建议 make install 打包版）"
        status: pending-uat
    human_judgment: true
    rationale: "系统弹框/通知/转封装产物真机行为依赖 UAT"

# Metrics
duration: 20min
completed: 2026-09-06
status: complete
plan_head_before: fff66d1b7aa6d1c7a60ee881684039747c9a726a
---

# Phase 44 Plan 05: mp4 转封装闭环 — mux.js remuxer + convert 任务集成 + 接力/续转 Summary

**mux.js（D-04 纯 JS）TS→fMP4 转封装 + convert 后台任务（D-24 弹框/命名/通知/定位）+ D-22 录制停止自动接力 + 抽屉「转换为 MP4」D-17 入口与任务页续转端点落地，Phase 44 产物侧收口**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-06T12:29:56Z
- **Completed:** 2026-09-06T12:49Z
- **Tasks:** 2
- **Files modified:** 12（2 新建 + 10 修改，+752/-10）

## Accomplishments

- **mux.js@6.3.0 引入**（D-04 locked，RESEARCH legitimacy 审计 OK）：纯 JS CJS 主进程 require，不进 renderer、无原生模块不触发 asarUnpack；`npm ls` 复核版本一致
- **media-remuxer.js**：`convertToMp4({ segmentPaths, outputPath, onProgress, hasDiscontinuity })`——单实例 Transmuxer 跨全部分片、`data` 监听注册先于首次 push（README 硬约束）、每分片 push+flush、initSegment 首写后 moof/mdat 顺序拼接、createWriteStream 流式写盘（T-44-17）、`keepOriginalTimestamps: false` 时间轴归零、discontinuity 直接拒转（err.reason='discontinuity'）、失败清理半成品产物；`sanitizeFilename`（`[\\/:*?"<>|]`+控制字符→`_`、80 字符裁剪，T-44-15）、`buildOutputName`「{标题} {YYYY-MM-DD HHmm}.mp4」（D-22）
- **convert 任务编排（main.js startConvertTask，D-24）**：showSaveDialog 默认 `settings.lastMediaSaveDir`（缺省下载目录）+ 记住选择写回；同名「 (2)」序号复用 download-manager getUniqueFilePath；registerTask(type=convert) 后台执行，进度整数百分比变化才 updateProgress（persist 写放大控制）；终态经 44-03 链路（completed「MP4 转换完成」通知+点击 showItemInFolder、failed 带「MP4 转换失败：{原因}」文案）
- **D-22 接力**：mediaTaskManager.onTaskCompleted 分支——record completed（停止录制/VOD 录完/关窗停止保存）→ 读 meta.json 分片索引 → 自动弹框选目录派生 convert；取消弹框不建任务、分片保留可续转
- **POST /api/tasks/convert-resume 落地**（44-03 预留 404 位）：record 任务（interrupted/failed/completed）→ 录制目录 meta.json → startConvertTask；REALM_TOKEN 鉴权沿用
- **player:convert/start IPC**：assertPlayerSender + mediaConvertStarter 桥（main.js 注入）；D-17 服务端复校——缓存条目完整度非 100% 拒绝（segments_incomplete）、discontinuity 拒绝；分片路径仅取自主进程索引（T-44-16 纵深防御）
- **completeness 补齐（44-01 预留字段）**：media-cache-manager updatePlaylistIndex 在 m3u8 请求时登记分片播放顺序（segKey 有序数组）/总数/ENDLIST/DISCONTINUITY；getConvertInfo 按 playlist_order（全量匹配时）或 stored_at 时间序取分片、算完整度；player:drawer:list 填充 completeness；抽屉条目「转换为 MP4」按钮仅完整度 100% 可见（D-17 隐藏非置灰，UI-SPEC Primary CTA accent 样式）
- **media-record-engine hasDiscontinuity**：轮询时整行匹配 `#EXT-X-DISCONTINUITY`（不误中 DISCONTINUITY-SEQUENCE）写 meta.json——Pitfall 5 拒转依据
- **tests/test-media-remuxer.js**：15 断言全绿（sanitize 5 例、命名 4 例、构造 smoke、监听先于 push 源码结构断言、discontinuity/空分片/缺分片拒转）

## Task Commits

Each task was committed atomically:

1. **Task 1: mux.js 安装 + media-remuxer.js 转封装封装 + 命名/单测** - `6b8a58d` (feat)
2. **Task 2: convert 任务集成 — showSaveDialog/接力/续转/抽屉转换入口** - `835e4ca` (feat)

## Files Created/Modified

- `media-remuxer.js`（新）- TS→fMP4 转封装封装 + sanitize/命名
- `tests/test-media-remuxer.js`（新）- Wave 0 风格单测（15 断言）
- `package.json` - dependencies 增 mux.js ^6.3.0（package-lock.json 本仓库 gitignore 不入库）
- `main.js` - remuxer require、m3u8 分支 updatePlaylistIndex、startConvertTask/startConvertFromRecordTask/startConvertFromInput、D-22 接力、convert-resume 端点、通知前缀去重
- `ipc-handlers.js` - player:convert/start + setMediaConvertStarter 注入 + drawer:list completeness
- `media-cache-manager.js` - updatePlaylistIndex/getConvertInfo + storeBuffer stored_at（D-03 附加字段向后兼容）
- `media-record-engine.js` - hasDiscontinuity 追踪 + meta.json 字段
- `download-manager.js` - 导出 getUniqueFilePath
- `src/player.js` - 抽屉转换按钮（D-17 gating）
- `src/player.css` - .drawer-item-convert 样式（accent CTA、hover 显隐）
- `src/preload.js` - playerAPI.startConvert
- `src/tasks-page.js` - 续转按钮扩展到 failed/completed record 任务

## Decisions Made

- **discontinuity 依据落到数据源**：record 引擎与缓存层各自在清单文本检测 `#EXT-X-DISCONTINUITY`（整行匹配）持久化，convertToMp4 经 hasDiscontinuity 入参拒转——v1 不尝试转封装（Pitfall 5 时间轴跳变产物不可用），失败文案兜底
- **缓存 meta 附加字段不升 META_VERSION**：playlist_order/total_segments/has_discontinuity/stored_at 均为可缺失的附加字段，旧 meta 缺失时 completeness=null → 转换按钮隐藏，读端零迁移
- **转封装分片顺序双通道**：playlist_order 优先（且须全量覆盖已登记分片，防重定向 key 错位），回退 stored_at 时间序（VOD 线性观看近似正确）
- **convert error 落库带「MP4 转换失败：」前缀**：任务页直接展示满足 UI-SPEC Copywriting；showTaskNotification 去重前缀避免「MP4 转换失败：MP4 转换失败：…」
- **续转覆盖 interrupted/failed/completed record**：D-22 取消弹框后补转 + UI-SPEC「已录部分仍可转换为 MP4」；仅 record 类型（convert 无分片可续）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 缓存条目完整度（completeness）与分片顺序索引缺失**
- **Found during:** Task 2
- **Issue:** 计划假设 media-cache-manager 可提供「分片路径列表」与 D-17 完整度校验，但 44-01 预留的 completeness 恒为 null（分片总数/顺序从未登记——meta.segments 是按 URL 哈希的无序 map）。不补齐则抽屉转换按钮永远不会出现（D-17 gating 空转），且无序拼分片产物时间轴错乱
- **Fix:** media-cache-manager 增 updatePlaylistIndex（m3u8 请求时经 parsePlaylist/resolveUri 登记 segKey 有序数组/总数/ENDLIST/DISCONTINUITY）+ getConvertInfo（顺序取分片 + completeness 计算，playlist_order 优先 stored_at 兜底）；main.js /proxy m3u8 分支接线；storeBuffer 记录 stored_at
- **Files modified:** media-cache-manager.js, main.js
- **Verification:** tests/test-media-cache.js 15/15 全绿（附加字段向后兼容）；node --check 通过
- **Committed in:** 835e4ca

**2. [Rule 2 - Missing Critical] 录制索引无 discontinuity 标记，计划拒转条款无数据可依**
- **Found during:** Task 2
- **Issue:** 计划要求「含 EXT-X-DISCONTINUITY 的录制索引 → 拒转」，但 44-04 引擎未检测/记录 discontinuity，convertToMp4 拿不到依据
- **Fix:** media-record-engine pollLoop 整行匹配 `#EXT-X-DISCONTINUITY`（不误中 DISCONTINUITY-SEQUENCE）置 st.hasDiscontinuity 并写入 meta.json；缓存条目同款检测；startConvertTask/convert IPC 校验 hasDiscontinuity 返回 reason='discontinuity'
- **Files modified:** media-record-engine.js, main.js, media-remuxer.js（hasDiscontinuity 入参）, media-cache-manager.js
- **Verification:** tests/test-media-remuxer.js discontinuity 拒转断言通过
- **Committed in:** 6b8a58d, 835e4ca

**3. [Rule 3 - Blocking] download-manager.getUniqueFilePath 未导出**
- **Found during:** Task 2
- **Issue:** 计划要求同名「 (2)」序号复用 download-manager getUniqueFilePath，但该函数不在 module.exports
- **Fix:** 加入 module.exports
- **Files modified:** download-manager.js
- **Committed in:** 835e4ca

**4. [Rule 1 - Bug] 测试断言错误（Task 1 自测发现）**
- **Issue:** sanitize 测试把单引号当非法字符（单引号是合法文件名字符）、`'///'` 期望回落「未命名」（实际合法转为 `___`）、script 标签用例漏计 `/` 的替换
- **Fix:** 修正测试期望（实现语义正确：白名单替换按计划 `[\\/:*?"<>|]`）
- **Files modified:** tests/test-media-remuxer.js
- **Committed in:** 6b8a58d

**5. [Rule 2 - Missing Critical] convert-resume 仅支持 interrupted 与 UI-SPEC 冲突**
- **Found during:** Task 2
- **Issue:** 计划文字只说「taskId（interrupted record）」，但 D-22 取消弹框场景分片在 completed record 任务里、UI-SPEC 明确「录制失败：{原因}。已录部分仍可转换为 MP4」
- **Fix:** 续转范围扩展为 interrupted/failed/completed record 任务；tasks-page 续转按钮条件同步
- **Files modified:** main.js, src/tasks-page.js
- **Committed in:** 835e4ca

---

**Total deviations:** 5 auto-fixed（2 缺失关键能力补齐 + 1 blocking 导出 + 1 测试断言修正 + 1 计划字面与 UI-SPEC 合成语义对齐；无 scope creep）
**Impact on plan:** 均为 D-17/D-22 正确性必需。

## Issues Encountered

- package-lock.json 在本仓库被 .gitignore（计划 files_modified 假设不符），mux.js 版本经 package.json ^6.3.0 锁定 + `npm ls` 复核

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- **44-VALIDATION（UAT）**：录制→停止→自动弹框→转换→通知→Finder 定位全链路；抽屉完整度 100% 条目「转换为 MP4」；任务页「已落盘部分续转」；中断录制续转（崩溃不白录）。**打包版优先**（RESEARCH Pitfall 8：dev 环境 Notification 可能静默；A3：mux.js Node 侧长时转封装真机首跑，产物在 QuickTime/IINA 验证时长/进度正常）
- 缓存条目完整度从此真实可用（D-14 抽屉「完整度 %」此前恒隐藏）
- 遗留：completeness 依赖 m3u8 请求时登记的 total_segments——live 流（无 ENDLIST）分母随窗口滑动，完整度对直播语义近似；UAT 观察是否有误导

---

*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- 12 个交付/改动文件全部存在（2 新建 + 10 修改）+ SUMMARY
- 2 个任务 commit 均在 git 历史（6b8a58d / 835e4ca）
- 计划级验证全绿：9 个改动 JS node --check 通过、test-media-remuxer.js 15/15、回归 cache 15/15 + parser 15/15 + registry 26/26 + navigation 32/32、纯模块 require smoke ok、零 ffmpeg-static
- commits 计量（gsd-plan-head-before-44-05..HEAD）：2，与 actuals 一致

---
phase: 44-player-video-cache-and-local-media-library
plan: 03
subsystem: media
tags: [task-center, realm-internal-page, electron-notification, badge, settings, navigation]

# Dependency graph
requires:
  - phase: 44-01
    provides: MediaCacheManager 构造注入接收端（isVideoActive）、/tasks 同构路由结构、setMediaCaches 注入惯例
  - phase: 44-02
    provides: createMediaTaskManager（状态机/persist/restoreTasks/isVideoActive/playbackKey 契约）
provides:
  - realm://tasks 任务页三件套（src/tasks.html + src/tasks-page.js + main.css 样式段）
  - main.js：/tasks 路由、/api/tasks/list|cancel|show-in-folder 端点、mediaTaskManager 集成（persist/restore/广播/Notification）
  - media-task:count-changed → preload onMediaTaskCountChanged → 主窗口任务角标（zero-one-many，点击 openUrl 收敛）
  - settings.cacheDir / settings.cacheMaxGB 即改即存（/api/settings/choose-cache-dir + settings:update 校验）并作用于 media-cache-manager
  - D-07 淘汰豁免端到端：mediaTaskManager.isVideoActive 注入 MediaCacheManager 构造参数
  - docs/product/navigation-entry-points.md 增补两个新入口
affects: [44-04 录制引擎（registerTask/failTask/completeTask 即可见于任务页与角标）, 44-05 转封装（convert-resume 端点路由位已预留）]

# Actuals (#2632)
actuals:
  tokens: 5000
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []   # 零新依赖
  patterns:
    - "persist 回调内做状态 diff：单点实现 media-task:changed / count-changed 广播 + 终态系统通知（注册表保持事件最小化）"
    - "webview guest 无 realmAPI 的设置页对话框模式：token 鉴权 HTTP 端点触发主进程 dialog（/api/settings/choose-cache-dir）"
    - "构造参数工厂函数 buildMediaCacheOptions + rebuildMediaCache（换目录重建实例、旧目录保留不删）"

key-files:
  created:
    - src/tasks.html
    - src/tasks-page.js
  modified:
    - main.js
    - src/index.html
    - src/renderer.js
    - src/preload.js
    - src/settings.html
    - src/settings-page.js
    - src/styles/main.css
    - docs/product/navigation-entry-points.md

key-decisions:
  - "统一使用计划键 settings.cacheDir / settings.cacheMaxGB：44-01 在 main.js 遗留的 settings.mediaCachePath / mediaCacheCapacityBytes 读取行改为计划键（无存量数据，无迁移成本），容量单位收敛为 GB（前端 1-1024 整数校验 + 主进程缺省回退 10，T-44-09）"
  - "设置页「更改目录」走 /api/settings/choose-cache-dir HTTP 端点而非 realmAPI.chooseCacheDir：设置页运行在 webview guest 内（webview-preload，无 realmAPI），对话框由主进程经 token 鉴权端点触发；preload 的 chooseCacheDir 仍按计划交付供主窗口场景使用"
  - "persist 回调内做状态 diff（lastPersistedStatuses Map）：注册表每次变更只有一个 persist 钩子，diff 出「状态变化的任务」发 media-task:changed 广播与终态系统通知，「running 数变化」发 count-changed，保持 media-task-manager 事件最小化"
  - "cancelled 任务归入「失败已中断」分区展示（badge 文案仍为「已取消」warning 色）——三区语义按 UI-SPEC 划分"

patterns-established:
  - "realm://tasks 页与 downloads 完全同构（base href /tasks/ + token query + 5s 轮询 + main.css 复用 downloads 布局类），后续内部页面可再套用"
  - "媒体任务系统通知：completed convert「MP4 转换完成：{文件名}」/ completed record「录制已保存」/ failed 带原因，点击 showItemInFolder，Pitfall 8 失败仅 console.warn 不阻断"

requirements-completed: [D-05, D-06, D-25, D-26]

coverage:
  - id: T1
    description: "realm://tasks 三区渲染 + 状态文案（UI-SPEC Copywriting Contract）+ /api/tasks/* token 鉴权端点 + 终态广播/系统通知/restore interrupted"
    requirement: D-26
    verification:
      - kind: other
        ref: "node --check main.js src/tasks-page.js 全过；grep base href /tasks/、api/tasks/list、media-task:count-changed 均命中；tasks.html body 零内联 style"
      - kind: human_judgment
        ref: "三区渲染/空态文案/暗色主题需 UAT 真机验证（44-VALIDATION Manual-Only）"
        status: pending-uat
    human_judgment: true
    rationale: "页面视觉与通知行为依赖真机 UAT（Pitfall 8：dev 环境 Notification 可能静默）"
  - id: T2
    description: "主窗口角标 zero-one-many + 设置页缓存目录/容量即改即存生效到 media-cache-manager + isVideoActive 接线（D-07）+ 导航文档两个新入口"
    requirement: D-05
    verification:
      - kind: other
        ref: "grep isVideoActive main.js 命中构造注入；node tests/test-unified-navigation.js 32/32 全绿；renderer 零 fetch /api/tasks"
      - kind: human_judgment
        ref: "角标显隐/设置分区交互需 UAT 真机验证"
        status: pending-uat
    human_judgment: true
    rationale: "角标数据流与设置交互依赖真实多窗口/任务环境"

# Metrics
duration: 18min
completed: 2026-09-06
status: complete
plan_head_before: 60cadfb688186c31852fe8d437fdbb0eff0b02af
---

# Phase 44 Plan 03: 任务中心集成 — realm://tasks 任务页 + 主窗口角标 + 设置页视频缓存分区 Summary

**media-task-manager 接入主进程（持久化 + 双广播 + 系统通知 + D-07 淘汰豁免注入）并交付用户可见面：realm://tasks 任务页三区渲染、主窗口任务角标（openUrl 收敛）、设置页视频缓存分区（目录/容量即改即存），导航权威文档同步两个新入口**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-06T11:30:01Z
- **Completed:** 2026-09-06T11:47:40Z
- **Tasks:** 2
- **Files modified:** 10（2 新建 + 8 修改，+1010/-7）

## Accomplishments

- main.js 集成 mediaTaskManager：persist 写 `userData/media-tasks.json`（D-18 崩溃恢复源），启动 restoreTasks running→interrupted；persist 内状态 diff 广播 `media-task:changed` / `media-task:count-changed`（windowManager.broadcast 全窗口）；completed/failed 终态发 Electron Notification（completed convert「MP4 转换完成：{文件名}」/ completed record「录制已保存」/ failed 带原因，点击 shell.showItemInFolder，通知失败仅告警不阻断——Pitfall 8）
- `/api/tasks/list|cancel|show-in-folder` 端点（REALM_TOKEN 鉴权无例外——T-44-07/10；cancel 仅 running 可取消，show-in-folder 校验终态 + 产物存在）；`convert-resume` 预留 404 路由位（44-05 实现）
- `/tasks` 路由 + src/tasks.html + src/tasks-page.js：与 downloads 同构三件套——base href `/tasks/`、token 从 URL 取、三区（进行中/已完成/失败已中断）渲染、状态徽标文案按 UI-SPEC Copywriting Contract、4px accent 进度条、产物路径任意断行 + tooltip、running 显停止按钮 / completed+interrupted 显定位 / interrupted 显「已落盘部分续转」、整页空态「暂无媒体任务」+ body 文案、5s 轮询
- 主窗口任务角标：index.html 工具栏新增按钮（accent 圆点 + 数字，UI-SPEC #9），renderer.js 监听 `realmAPI.onMediaTaskCountChanged`——count>0 显示、归零隐藏（zero-one-many），点击 `openUrl('realm://tasks')` 收敛统一导航入口；主窗口零 fetch HTTP（Phase 38 约定）
- 设置页多媒体分区「视频缓存」组：缓存目录只读展示 + 「更改目录…」（主进程 dialog.showOpenDialog 选目录——T-44-08 不手输，选中即写 settings.cacheDir 并重建 media-cache-manager，旧目录保留）；缓存上限 GB 数字输入（前端 1-1024 整数校验、非法回退 10 + 主进程服务端校验——T-44-09，即改即存同步更新运行中 manager 容量——D-06）；「任务列表」按钮
- media-cache-manager 构造接线三参数：cacheRoot（settings.cacheDir，缺省 userData/media-cache）、capacityBytes（cacheMaxGB×1GB，缺省 10GB）、**isVideoActive = mediaTaskManager.isVideoActive**（D-07：running 任务对应 playbackKey 的视频淘汰豁免，44-01 接收端打通）
- docs/product/navigation-entry-points.md 增补两个入口（角标点击 current-tab；设置页任务列表按钮 guest window.open → setWindowOpenHandler → handleOpenUrlInTab → new-tab）；`node tests/test-unified-navigation.js` 32/32 全绿

## Task Commits

Each task was committed atomically:

1. **Task 1: media-task-manager 主进程集成 + realm://tasks 任务页三件套** - `36c9361` (feat)
2. **Task 2: 主窗口任务角标 + 设置页多媒体分区 + 导航文档收敛** - `69c5494` (feat)

## Files Created/Modified

- `src/tasks.html`（新）- 任务页骨架（CSP/base href/零内联 style/空态文案）
- `src/tasks-page.js`（新）- token 初始化、syncTheme、三区渲染、状态徽标/操作按钮、5s 轮询、apiAction
- `main.js` - mediaTaskManager 初始化 + persistMediaTasks（写盘/diff 广播/通知）+ handleTasksApi + /tasks 路由 + buildMediaCacheOptions/rebuildMediaCache（isVideoActive 接线）+ /api/settings/choose-cache-dir + cacheMaxGB 服务端校验与即改即存
- `src/index.html` - 工具栏媒体任务角标按钮
- `src/renderer.js` - initMediaTaskBadge/updateMediaTaskBadge（IPC 监听 + openUrl 收敛）
- `src/preload.js` - realmAPI.onMediaTaskCountChanged / chooseCacheDir
- `src/settings.html` + `src/settings-page.js` - 多媒体分区「视频缓存」组（目录/容量/任务列表入口）
- `src/styles/main.css` - 任务页样式段 + media-task-badge + media-cache-dir-path
- `docs/product/navigation-entry-points.md` - 增补两个新导航入口

## Decisions Made

- **统一计划键 settings.cacheDir / settings.cacheMaxGB**：44-01 在 main.js 遗留的 `settings.mediaCachePath` / `mediaCacheCapacityBytes` 读取行改为计划键（两者均无存量写入数据，无迁移成本）；容量语义收敛为 GB 单位
- **设置页「更改目录」走 HTTP 端点**：设置页运行在 webview guest（webview-preload，无 realmAPI），改为 `/api/settings/choose-cache-dir` token 鉴权端点由主进程触发 dialog；preload 的 `realmAPI.chooseCacheDir` 仍按计划交付（主窗口场景可用）
- **persist 回调内做状态 diff**：注册表仅有单一 persist 钩子，集成层用 lastPersistedStatuses Map diff 出状态变化的任务（media-task:changed + 终态通知）与 running 数变化（count-changed），保持 media-task-manager 事件面最小
- **cancelled 归入「失败已中断」分区**（badge 仍「已取消」warning 色），三区语义按 UI-SPEC 划分

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 设置页 guest 无 realmAPI，「更改目录」改走 HTTP 端点**
- **Found during:** Task 2
- **Issue:** 计划步骤 3 让设置页按钮调 `realmAPI.chooseCacheDir`，但设置页是 webview guest（webview-preload），拿不到 realmAPI——按钮会静默失效
- **Fix:** main.js handleSettingsApi 新增 `choose-cache-dir` POST 路由（token 鉴权 → dialog.showOpenDialog → 写 settings.cacheDir → rebuildMediaCache）；设置页改调该端点
- **Files modified:** main.js, src/settings-page.js
- **Verification:** node --check 通过；端点路由 grep 命中；T-44-08 语义不变（仍仅 dialog 选取）
- **Committed in:** 69c5494

**2. [Rule 3 - Blocking] 缓存设置键与 44-01 遗留接线不一致**
- **Found during:** Task 2
- **Issue:** 44-01 在 main.js 用 `settings.mediaCachePath` / `mediaCacheCapacityBytes` 构造 mediaCache，与 44-03 计划键 `settings.cacheDir` / `settings.cacheMaxGB` 冲突（两套键会分裂）
- **Fix:** 构造改用计划键 buildMediaCacheOptions（GB 换算 capacityBytes），无存量数据故无迁移
- **Files modified:** main.js
- **Verification:** grep cacheMaxGB/isVideoActive main.js 命中；tests/test-media-cache.js 15/15 全绿
- **Committed in:** 69c5494

---

**Total deviations:** 2 auto-fixed（均为集成 blocking 修复，无 scope creep）
**Impact on plan:** 均为正确性必需；设置页功能路径更符合项目「guest 页走 /api/* + token」分层约定。

## Issues Encountered

None.

## Known Stubs

| 文件 | 位置 | 说明 |
|------|------|------|
| src/tasks-page.js | task-resume-convert-btn | 「已落盘部分续转」按钮按计划先行渲染并 POST /api/tasks/convert-resume——端点由 44-05 实现，落地前返回 404（计划 artifacts 节明确「不算本计划缺陷」） |

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- **44-04（录制引擎）**：registerTask/failTask/completeTask/cancelTask 一经调用即自动进持久化、任务页渲染、角标计数与系统通知链路；D-19 应用退出确认可直接用 hasActiveTasks()
- **44-05（转封装）**：/api/tasks/convert-resume 路由位已预留（404）；onTaskCompleted 接力挂点 + interrupted 任务「已落盘部分续转」按钮均已就位，端点实现后任务页无需改动
- UAT 待验证（Manual-Only）：任务页三区/空态/暗色主题、角标显隐与跳转、设置分区即改即存体感、系统通知（dev 环境 Notification 可能静默，建议打包版验证——Pitfall 8）

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- 11 个交付/改动文件全部存在（2 新建 + 8 修改 + SUMMARY）
- 2 个任务 commit 均在 git 历史（36c9361 / 69c5494）
- 计划级验证全绿：5 个 JS 文件 node --check 通过、test-unified-navigation.js 32/32、test-media-cache.js 15/15、test-media-task-registry.js 26/26
- commits 计量（gsd-plan-head-before-44-03..HEAD）：2，与 actuals 一致


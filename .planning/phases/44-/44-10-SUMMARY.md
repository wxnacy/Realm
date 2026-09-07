---
phase: 44-player-video-cache-and-local-media-library
plan: 10
subsystem: ui
tags: [electron, toast, ipc, preload, notification-fallback]

requires:
  - phase: 44-player-video-cache-and-local-media-library (44-05/44-06)
    provides: media-task:changed 主进程广播（persistMediaTasks 状态 diff）与 download:show-in-folder 受信 IPC
provides:
  - preload mediaAPI.onMediaTaskChanged（media-task:changed 通道主窗口可达，不过滤类型）
  - renderer showToast 可选 opts（onClick/duration）扩展 + initMediaTaskToast 终态过滤/文案映射/点击定位
  - .toast-clickable 样式（pointer-events 恢复）+ main.css?v=6 缓存失效
affects: [player media tasks, notification, renderer toast]

actuals:
  tokens: 1560
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "可点击 toast 变体模式：.toast 基类 pointer-events:none，可点击变体须显式恢复 pointer-events:auto"
    - "系统通知不可用环境（ad-hoc 签名）的应用内 toast 降级通道，复用既有 IPC 广播与 showInFolder 链路"

key-files:
  created: []
  modified:
    - src/preload.js
    - src/renderer.js
    - src/styles/main.css
    - src/index.html

key-decisions:
  - "toast 落主窗口 renderer（常驻），播放器窗口不重复建设 toast 基建（录制失败已有 showError 即时反馈）"
  - "系统通知链路（main.js showTaskNotification）保留不删——正式签名后恢复即得双通道并存；main.js 零改动"
  - ".toast-clickable 除 cursor:pointer 外必须恢复 pointer-events:auto——.toast 基类 pointer-events:none 会拦截点击（计划未覆盖，Rule 1 修复）"

patterns-established:
  - "showToast 第三可选参 opts（onClick/duration）：既有调用点零改动，缺省 3000ms 行为不变"

requirements-completed: [D-26]

coverage:
  - id: D1
    description: preload mediaAPI 暴露 onMediaTaskChanged，主窗口 renderer 可订阅 media-task:changed 全类型广播
    requirement: D-26
    verification:
      - kind: unit
        ref: "node --check src/preload.js + grep onMediaTaskChanged/media-task:changed"
        status: pass
    human_judgment: false
  - id: D2
    description: convert/record 终态在主窗口弹应用内 toast，文案与 showTaskNotification 契约一致，failed 不重复拼接前缀
    requirement: D-26
    verification:
      - kind: unit
        ref: "node --check src/renderer.js + grep initMediaTaskToast 定义/调用/监听注册"
        status: pass
      - kind: manual_procedural
        ref: "44-UAT 第 5 项：发起转换/录制停止 → 主窗口 toast 出现"
        status: unknown
    human_judgment: true
    rationale: "toast 视觉呈现与终态时机需真实应用内人工复测（UAT 第 5 项），自动化断言只覆盖源码 gate"
  - id: D3
    description: 有 outputPath 的终态 toast 可点击，经 download:show-in-folder IPC 在 Finder 定位产物
    requirement: D-26
    verification:
      - kind: unit
        ref: "grep toast-clickable src/styles/main.css + 点击回调源码断言"
        status: pass
      - kind: manual_procedural
        ref: "44-UAT 第 5 项：点击 toast 在 Finder 定位产物"
        status: unknown
    human_judgment: true
    rationale: "点击定位的端到端行为（IPC → shell.showItemInFolder）需人工在运行应用中验证"
  - id: D4
    description: showToast 既有调用方零回归（第三参可选，缺省行为不变）；main.js 零改动（系统通知链路保留）
    requirement: D-26
    verification:
      - kind: unit
        ref: "git diff --stat main.js 为空 + node tests/test-media-task-registry.js (26/26) + node tests/test-media-remuxer.js (17/17)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-07
status: complete
---

# Phase 44 Plan 10: 媒体任务终态应用内 toast Summary

**convert/record 终态在主窗口弹应用内 toast（不依赖系统通知授权），点击经既有 showInFolder 链路定位产物；系统通知代码保留，正式签名后双通道并存**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-07T06:46:35Z
- **Completed:** 2026-09-07T06:50:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- preload mediaAPI 新增 `onMediaTaskChanged`（media-task:changed 通道主窗口可达，与 onMediaTaskCountChanged 同款 handler/removeListener 契约，不过滤任务类型）
- renderer `showToast` 扩展可选第三参 `opts`（onClick 点击回调 + duration 自动消失毫秒数，缺省 3000ms 行为不变，既有调用点零改动）
- 新增 `initMediaTaskToast`：过滤 completed/failed 终态，文案与 main.js showTaskNotification 标题契约一致（completed convert「MP4 转换完成：{文件名}」/ completed record「录制已保存」/ failed 用 task.error 不重复拼接前缀）；duration 5000ms
- 有 outputPath 的终态 toast 可点击，经 `download:show-in-folder` 受信 IPC（assertTrustedSender + shell.showItemInFolder）在 Finder 定位产物
- main.css 新增 `.toast-clickable` 样式；index.html main.css 版本参数 v=5 → v=6（缓存失效）
- main.js 零改动——showTaskNotification 系统通知链路原样保留（prohibitions 锁定达成）

## Task Commits

Each task was committed atomically:

1. **Task 1: preload mediaAPI 暴露 onMediaTaskChanged** - `143ae64` (feat)
2. **Task 2: renderer 终态 toast（showToast 扩展 + initMediaTaskToast + 点击定位）** - `0a079b5` (feat)

## Files Created/Modified

- `src/preload.js` - mediaAPI 新增 onMediaTaskChanged（media-task:changed 主窗口可达）
- `src/renderer.js` - showToast 可选 opts 扩展 + initMediaTaskToast（终态过滤/文案映射/点击定位）+ :4206 区接线
- `src/styles/main.css` - .toast-clickable 样式（cursor + pointer-events 恢复）
- `src/index.html` - main.css?v=5 → v=6

## Decisions Made

- toast 落主窗口 renderer（常驻窗口），播放器窗口不重复建设 toast 基建——录制失败已有 showError 即时反馈（player.js onRecordStateChanged 分支）
- 系统通知链路保留不删：正式签名+公证后系统通知恢复可用，与应用内 toast 双通道并存
- failed 文案直接用 task.error（44-05 起已带「MP4 转换失败：」前缀），不重复拼接

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] .toast-clickable 需恢复 pointer-events:auto**
- **Found during:** Task 2（样式追加）
- **Issue:** 计划只指定 `.toast.toast-clickable { cursor: pointer; }`，但 `.toast` 基类有 `pointer-events: none`（main.css L1459），仅加 cursor 无法让点击到达 toast，点击定位功能静默失效
- **Fix:** `.toast-clickable` 同时声明 `pointer-events: auto`
- **Files modified:** src/styles/main.css
- **Verification:** 样式规则源码确认；点击链路依赖此修复
- **Committed in:** 0a079b5（Task 2 commit）

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 修复为计划点击定位功能的必要条件，无范围蔓延。

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-44-5 gap 闭合：convert/record 终态在 ad-hoc 签名环境下有可见的应用内提示，点击定位产物链路复用既有受信 IPC
- 遗留（范围外，记录）：Developer ID 正式签名+公证后系统通知恢复可用（发布工程事项，非本 plan 范围）
- 人工复测项（UAT 第 5 项）：发起转换或录制→停止，确认主窗口 toast 出现与点击定位；已列入 coverage D2/D3 human_judgment 项

---
*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-07*

## Self-Check: PASSED

- 全部 4 个修改文件存在于磁盘
- 3 个提交（143ae64 / 0a079b5 / 2cc1f52）均存在于 git 历史
- 回归测试：test-media-task-registry 26/26、test-media-remuxer 17/17
- main.js 零改动确认（git diff --stat main.js 为空）

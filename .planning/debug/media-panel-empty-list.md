---
status: fixed
trigger: "Gap G-27-2: await window.mediaAPI.getMediaList('xiao') 返回数据，但媒体面板显示 当前页面未检测到媒体资源"
goal: find_root_cause_only
bug_class: Bohrbug (deterministic)
created: 2026-08-05T00:00:00Z
updated: 2026-08-05T00:10:00Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: fixed
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

reasoning_checkpoint:
  hypothesis: "面板 loadMediaList() 调 getMediaList() 时未传 containerId，主进程回退用 windowContainerMap（窗口级容器）解析；切 tab 跨容器时该 map 不同步，导致查到错误容器（如 default）拿到空列表"
  confirming_evidence:
    - "src/renderer.js:5133 `window.mediaAPI.getMediaList()` 无参调用"
    - "ipc-handlers.js:1296-1299 无参时回退 windowManager.getCurrentContainer(win.id)"
    - "window-manager.js:66-68 windowContainerMap 缺省返回 'default'，仅 createMainWindow(:48) 与 switchContainer(:84) 写入"
    - "src/renderer.js:588-591 switchTab 只更新渲染端 state.currentContainer，不通知主进程；ipc-handlers.js:344-350 tab:switch 也不碰 windowContainerMap"
    - "写入路径按 webview partition 推导正确容器（renderer.js:928-934），数据确实存于 'xiao'"
  falsification_test: "若 tab:switch 或 switchTab 会同步 windowContainerMap 到活动 tab 的容器，则面板应有数据——已读代码确认两处均不同步，假设成立"
  fix_rationale: "让读取路径使用与写入路径一致的容器键（活动 tab 的 containerId / state.currentContainer），消除窗口级 stale map 依赖"
  blind_spots: "未实机运行复现；但症状（显式传 'xiao' 有数据、面板空）与代码路径预测完全一致，且 media:debug-state 的注释（media-sniffer.js:270）本就预判了此故障模式：'storeCounts 有值但 getMediaList 空 → 容器解析不一致'"
  candidate_causes:
    - "code: loadMediaList 缺 containerId 实参（renderer.js:5133）"
    - "state/design: 双数据源——渲染端 state.currentContainer vs 主进程 windowContainerMap，切 tab 时失去同步（switchTab 只改前者）"
  and_gate: "no——单个缺失实参即可解释读取路径；推送路径（notifyRenderer 按窗口容器过滤）失效率高但同源"

known_pattern_candidate: 无（.planning/debug/knowledge-base.md 不存在）

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: 媒体面板应在有数据时正确渲染媒体列表
actual: "await window.mediaAPI.getMediaList('xiao') 可以返回数据，但是面板中显示 当前页面未检测到媒体资源"
errors: none reported (UI empty-state shown despite data existing)
reproduction: 打开含 m3u8/mp4/flv/webm 媒体的页面（容器 xiao），打开媒体面板 → 显示空态文案；devtools 手动调 getMediaList('xiao') 有数据
started: phase 27 新增媒体面板后（UAT gap G-27-2, severity major）

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: 媒体数据未写入 MediaSniffer（嗅探管线失效）
  evidence: 手动 getMediaList('xiao') 返回数据 → mediaMap 中 'xiao' 键下有数据；写入路径正常
  timestamp: 2026-08-05T00:05:00Z
- hypothesis: 渲染时序问题（数据到达后面板未重渲染）
  evidence: toggleMediaPanel 打开时总是调 loadMediaList()（renderer.js:5122-5124），且 onMediaListUpdate 监听存在（5282-5292）；即使如此仍空 → 不是渲染时机，是查询键错误
  timestamp: 2026-08-05T00:08:00Z

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-05T00:02:00Z
  checked: ipc-handlers.js:1291-1300 media:get-list handler
  found: 无 containerId 实参时回退 `windowManager.getCurrentContainer(win.id)`；注释自认「多容器混开窗口时窗口级解析不可靠」
  implication: 读取路径依赖窗口级容器解析
- timestamp: 2026-08-05T00:03:00Z
  checked: src/renderer.js:5131-5140 loadMediaList + 5146-5150 renderMediaList
  found: `window.mediaAPI.getMediaList()` 无参调用（唯一调用点）；空数组 → 显示 mediaEmptyState（"当前页面未检测到媒体资源"）
  implication: 面板从未传容器 ID，与手动调用 getMediaList('xiao') 的差异点
- timestamp: 2026-08-05T00:04:00Z
  checked: window-manager.js:15,48,66-68,77-101；ipc-handlers.js:292-311 container:current / container:switch
  found: windowContainerMap 仅在 createMainWindow 与 windowManager.switchContainer（用户显式侧栏切容器）时写入；缺省回退 'default'
  implication: 窗口级容器是 stale 的——切到 'xiao' tab 不更新它
- timestamp: 2026-08-05T00:06:00Z
  checked: src/renderer.js:560-620 switchTab；ipc-handlers.js:344-350 tab:switch
  found: switchTab 仅在渲染端更新 state.currentContainer（588-591）；主进程 tab:switch 只调 tabManager.switchTab，不碰 windowContainerMap
  implication: 双数据源失同步 confirmed：渲染端知道当前是 'xiao'，主进程窗口 map 仍是创建时容器
- timestamp: 2026-08-05T00:07:00Z
  checked: src/renderer.js:925-935（ipc-message 'media:detected'）；media-sniffer.js:133-166 addMedia
  found: 写入路径从 webview partition `persist:container-xiao` 推导 containerId='xiao'，per-tab 正确
  implication: 写读容器键不一致：写用 tab 容器，读用窗口容器
- timestamp: 2026-08-05T00:09:00Z
  checked: media-sniffer.js:314-333 notifyRenderer
  found: 推送 'media:list-updated' 只发给 `getCurrentContainer(win.id) === containerId` 的窗口；窗口 map stale → 'xiao' 的更新永远推不到该窗口
  implication: 同一根因还切断实时推送路径（badge/面板不自动刷新），并非仅首次拉取为空

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: "面板读取路径（src/renderer.js:5133 loadMediaList）调 getMediaList() 不传 containerId，主进程回退到窗口级 windowContainerMap（ipc-handlers.js:1296-1297 → window-manager.js:66-68）；该 map 只在建窗/显式切容器时更新，switchTab 跨容器切换不同步（renderer.js:588-591 只改渲染端 state.currentContainer；tab:switch handler 也不更新），于是解析到 stale 容器（如 'default'）→ mediaSniffer.getMediaList('default') 返回 [] → 渲染空态。写入路径按 webview partition 正确存到 'xiao'，故手动 getMediaList('xiao') 有数据。同一 stale map 还使 notifyRenderer（media-sniffer.js:324-325）把 'xiao' 的更新推送过滤掉，实时更新路径同样失效。"
fix: "(diagnose-only，未实施) 方向：loadMediaList 传 state.currentContainer（或活动 tab 的 containerId）；notifyRenderer 改为广播+渲染端按当前容器过滤，或在 tab 切换时同步 windowContainerMap"
verification: (pending — diagnose-only mode)
files_changed: []

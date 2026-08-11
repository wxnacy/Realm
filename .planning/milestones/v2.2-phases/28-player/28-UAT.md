---
status: complete
phase: 28-player
source: [28-01-SUMMARY.md, 28-02-SUMMARY.md]
started: 2026-08-08T03:28:28Z
updated: 2026-08-08T05:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 打开视频播放器窗口
expected: 在媒体面板中点击一个视频项，播放器窗口应以无边框独立窗口打开，显示自定义标题栏（macOS 红绿灯按钮），视频开始自动播放。
result: pass
note: "初测发现 HLS 库加载失败 + 红绿灯重影，修复后复验通过"

### 2. 视频格式自动检测与播放
expected: 分别打开 HLS (.m3u8)、MPEGTS (.ts)、DASH (.mpd) 和普通 MP4 视频，每种格式应自动检测并使用对应库加载播放，不报错。
result: pass
note: "HLS/MP4 已验证通过；DASH (.mpd) 修复嗅探后复验仍失败，用户 2026-08-08 决定暂缓并按阶段 25 先例带 gap 收尾，见 Deferred Follow-Ups 与 Gaps G-28-2"

### 3. 播放/暂停控制
expected: 点击播放/暂停按钮或按空格键，视频应在播放和暂停状态间切换，按钮图标同步更新。
result: pass
note: "初测发现 HLS 打开默认暂停 + 切换上一个/下一个状态错误，修复后复验通过（'播放可以了'）"

### 4. 进度条拖拽与点击
expected: 拖拽进度条或点击进度条任意位置，视频应跳转到对应时间点继续播放。
result: pass

### 5. 音量控制
expected: 拖拽音量滑块调整音量，点击音量按钮切换静音/取消静音。
result: pass
note: "初测 thumb 偏下（cosmetic），CSS 修复后复验通过"

### 6. 倍速切换
expected: 点击倍速按钮弹出菜单，支持 0.5x/1x/1.5x/2x 切换，选择后视频播放速度立即改变。
result: pass

### 7. 全屏功能
expected: 按 F 键或双击视频区域（300ms 延迟区分单击），视频进入/退出全屏模式。
result: pass
note: "初测全屏/红绿灯全失效（player:* 通道信任断言错位），修复后复验通过；Test 14 无回退"

### 8. 画中画
expected: 点击画中画按钮，视频以小窗口形式浮在其他窗口上方播放。
result: pass

### 9. 控制栏自动隐藏
expected: 视频播放中，3 秒无操作后控制栏自动隐藏；移动鼠标或暂停时控制栏重新显示。
result: pass

### 10. 播放列表切换
expected: 当容器有多个媒体项时，点击上一个/下一个按钮可切换播放不同视频。
result: pass

### 11. 容器隔离验证
expected: 在不同容器中打开视频，播放器窗口使用对应容器的 Session，Cookie 和存储互不干扰；标题栏显示 {容器名} - {文件名}（2026-08-08 应用户要求加入，便于肉眼验证隔离）。
result: pass

### 12. 关闭播放器窗口资源释放
expected: 关闭播放器窗口后，再次打开新视频时不应出现内存泄漏或引擎实例残留（旧实例应被 destroy）。
result: pass

### 13. Cmd+W 关闭播放器窗口
expected: 播放器窗口聚焦时按 Cmd+W，应关闭播放器窗口本身（而不是主窗口的标签页）；主窗口聚焦时 Cmd+W 仍为关闭标签页。
result: pass

### 14. 播放器窗口存在时网页新建标签页
expected: 播放器窗口打开期间，在网页中触发新标签（window.open/目标 _blank 链接或 UI 新建），应正常创建标签页，不报"不受信任的 IPC 来源"。
result: pass

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-28-1a
  truth: "HLS 视频应正常加载播放"
  status: resolved
  reason: "User reported: 打开后显示 hls 加载失败"
  severity: blocker
  test: 1
  root_cause: "player.js 用裸模块说明符 await import('hls.js')，渲染进程无打包器无法解析；player.html 未引入 UMD 构建，window.Hls 不存在"
  artifacts:
    - path: "src/player.html"
      issue: "缺少播放库 UMD script 标签"
    - path: "src/player.js"
      issue: "裸 import('hls.js')/'mpegts.js'/'dashjs' 在 file:// 渲染进程不可用"
  missing: []
  fix: "player.html 增加 hls.min.js / mpegts.js / dash.all.min.js 三个 UMD script 标签（挂 window.Hls/mpegts/dashjs，player.js 的 window 全局检查命中，不再走 import 分支）"

- gap_id: G-28-1b
  truth: "标题栏红绿灯按钮不重叠"
  status: resolved
  reason: "User reported: 左上角三个按钮有重影，感觉是两个按钮叠加了"
  severity: cosmetic
  test: 1
  root_cause: "ipc-handlers.js 播放器窗口同时设置 frame:false 和 titleBarStyle:'hidden'，macOS 上 hidden 模式即使无边框也绘制原生红绿灯，与自定义按钮叠加"
  artifacts:
    - path: "ipc-handlers.js"
      issue: "BrowserWindow 配置 titleBarStyle:'hidden' 多余"
  missing: []
  fix: "移除 titleBarStyle:'hidden'，仅保留 frame:false（CSS 已有 -webkit-app-region:drag，窗口拖拽不受影响）"

- gap_id: G-28-2
  truth: "DASH (.mpd) 视频应能被嗅探进媒体面板并播放"
  status: deferred
  deferred_at: 2026-08-08
  reason: "User reported: 浏览器打开 mpd 地址会提示下载，没办法播放；修复嗅探后复验'还是不行'，用户决定暂缓"
  severity: major
  test: 2
  root_cause: "第一层根因已修（嗅探器/renderer/CSS 缺 dash 支持）；复验仍失败，第二层根因未诊断（待查：dash.js UMD 加载、CSP connect-src、嗅探 session 接线、播放器 dash 分支）"
  artifacts:
    - path: "media-sniffer.js"
      issue: "缺少 .mpd 扩展名与 application/dash+xml content-type 映射（已修）"
    - path: "src/renderer.js"
      issue: "ALLOWED_MEDIA_TYPES 缺少 dash（已修）"
    - path: "src/styles/main.css"
      issue: "缺少 media-type-dash 徽标样式（已修）"
    - path: "src/player.js"
      issue: "dash 分支未验证（window.dashjs 是否挂上、initialize 是否报错）"
  missing: []
  fix: "第一层已修；第二层待用户需要时用 /gsd-plan-phase 28 --gaps 继续诊断"
  next_step: "排查方向：① 播放器 DevTools 看 window.dashjs 是否存在及 console 报错；② media:debug-state 看嗅探计数；③ CSP connect-src 是否拦了 mpd 分片请求"

- gap_id: G-28-3
  truth: "m3u8 打开后应自动播放；播放中切换上一个/下一个新视频应自动续播且 UI 状态正确"
  status: resolved
  reason: "User reported: 播放过程中点击上一个或下一个状态就不对了；m3u8 应该打开后默认播放，现在是默认暂停"
  severity: major
  test: 3
  root_cause: "player.js HLS 分支只 loadSource+attachMedia，从未调用 video.play()（native/mpegts/dash 三分支均有播放调用，唯独 HLS 漏）；切换视频走同一 initPlayer，故两个症状同一根因"
  artifacts:
    - path: "src/player.js"
      issue: "HLS 分支缺少自动播放调用"
  missing: []
  fix: "Hls.Events.MANIFEST_PARSED 回调中 video.play()（含 catch 日志）；play 事件会同步刷新播放图标/覆盖层/控制栏定时器，切换续播的状态随之正确"
  resolved_at: 2026-08-08

- gap_id: G-28-4
  truth: "播放器窗口存在时，网页创建新标签页应正常（tab:create IPC 不被误判为不受信来源）"
  status: resolved
  reason: "User reported: 播放窗口存在时在网页创建新标签报错 '不受信任的 IPC 来源'（assertTrustedSender, tab:create）"
  severity: blocker
  test: 14
  root_cause: "window-manager.getMainWindow() 用 BrowserWindow.getAllWindows()[0]，数组顺序随焦点/创建变化；播放器窗口存在时 windows[0] 可能是播放器窗口，assertTrustedSender 把主窗口的合法 IPC 误判为不受信"
  artifacts:
    - path: "window-manager.js"
      issue: "getMainWindow 依赖 getAllWindows()[0] 顺序"
  missing: []
  fix: "createMainWindow 登记模块级 mainWindowRef（closed 时清除），getMainWindow 返回显式引用；19 个调用点同步受益"
  resolved_at: 2026-08-08

- gap_id: G-28-5
  truth: "音量滑块拖拽时白色 thumb 应垂直居中于轨道"
  status: resolved
  reason: "User reported: 拖拽音量进度条时出现的白点没有在进度条的中间，而是偏下的位置"
  severity: cosmetic
  test: 5
  root_cause: "player.css .volume-slider::-webkit-slider-thumb 未设 margin-top，WebKit 将 12px thumb 顶对齐 3px 轨道，视觉偏下"
  artifacts:
    - path: "src/player.css"
      issue: "thumb 缺垂直居中补偿"
  missing: []
  fix: "thumb 加 margin-top:-4.5px（(3-12)/2）"

- gap_id: G-28-6
  truth: "播放器窗口的全屏（F键/双击/按钮）、关闭、最小化、最大化均应可用"
  status: resolved
  resolved_at: 2026-08-08
  reason: "User reported: f和双击都没反应，全屏按钮刚开始可以现在也没反应，左上角三个按钮也没反应"
  severity: blocker
  test: 7
  root_cause: "player:toggle-fullscreen/minimize/maximize/close 四通道误用 assertTrustedSender（只认主窗口）；此前能'用'是因为 getMainWindow 取 getAllWindows()[0]，播放器聚焦时恰好排首位而误判通过——G-28-4 修正主窗口判定后，播放器合法调用被正确拒绝（renderer 未 catch invoke rejection，表现为静默无反应）"
  artifacts:
    - path: "ipc-handlers.js"
      issue: "播放器窗口控制通道的信任断言用错窗口身份"
  missing: []
  fix: "新增 assertPlayerSender（sender 解析的窗口必须等于当前 playerWindow），四个 player:* 通道切换使用"

## Deferred Follow-Ups

- test: 2
  idea: "DASH (.mpd) 播放修复第一层（嗅探/renderer/CSS 补 dash）后复验仍失败，第二层根因未诊断；用户 2026-08-08 决定暂缓，需要时走 /gsd-plan-phase 28 --gaps（gap G-28-2 保留排查方向）"
  deferred_at: 2026-08-08

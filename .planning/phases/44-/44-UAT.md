---
status: diagnosed
phase: 44-player-video-cache-and-local-media-library
source: [44-VERIFICATION.md]
started: 2026-09-07T08:00:00Z
updated: 2026-09-07T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. webview 直连真实源站（CR-06 收紧版，唯一实质新风险）
expected: webview tab 内用「无 ACAO + Referer 校验 + Cookie 门控」真实源站直连播放 m3u8，可识别为多媒体且与 Phase 43 行为一致；若不可用则按 CR-06 方案①/②/③建新 gap
result: pass

### 2. 录制按钮停止图标目检（UAT 4.1）
expected: 录制中显示停止方块图标、停止后恢复描边圆点、title 切换「停止录制/开始录制」（红点闪烁之外按钮图标可辨识）
result: issue
reported: "直播按钮切换点击都没问题，点播视频 m3u8 点击停止录制后程序闪退了。日志末尾：Electron exited with signal SIGSEGV"
severity: blocker

### 3. 直播录制/转换全链路（UAT 4.2/6，真实源）
expected: B 站直播（fMP4 流）停止录制后任务页显示「MP4 转换失败：分片格式暂不支持转换（仅支持 MPEG-TS）」且无 0 字节产物；正常 TS 源转换产物在播放器播放、时长/音画正常
result: skipped
reason: "Deferred follow-up: 失败提示按预期出现（无 0 字节产物）；fMP4 转录支持为后续工作，本 phase 完成后开始介入"

### 4. 终态 toast + 点击定位（UAT 5）
expected: 「MP4 转换完成：{文件名}」/「录制已保存」toast 出现约 5s，点击在 Finder 定位产物；失败任务弹 error toast
result: issue
reported: "可以有 toast，但是现在播放器右上角红色按钮，鼠标放上去显示时间更新不及时，有时半天不改变时间，有时又突然增加好几秒"
severity: minor

### 5. 任务角标 running/归零/跳转（UAT 7）
expected: 录制进行中主窗口工具栏角标出现（数字=running 数）、停止后归零消失、点击跳 realm://tasks
result: pass

### 6. 抽屉删除两路径 + 时钟图标（UAT 8）
expected: 默认不勾删除 → 条目变「未缓存」；勾选「同时删除条目」删除 → 条目消失且重开抽屉不再出现；文案随勾选联动、确认框居中、meta 行时钟图标 hover 显示「最近观看 时间」
result: issue
reported: "删除功能没问题，但是图标替换理解有误，我只想替换「最近观看」四个字，时间还是要有的，现在只有一个图标没有时间了"
severity: major

### 7. 任务页失败反馈（UAT 9）
expected: 对无 meta.json 的中断任务点「已落盘部分续转」→ 反馈条显示「录制中崩溃的任务暂无分片索引，暂不支持续转」约 4s 消失；停止/定位失败同样有可见反馈
result: skipped
reason: "用户选择跳过，以后遇到再说"

### 8. 关窗/应用退出两级确认（D-19，前轮 #12 保持）
expected: 窗口级确认弹一次并记忆默认；取消退出后确认不被永久跳过（WR-05 观察）
result: pass

## Summary

total: 8
passed: 3
issues: 3
pending: 0
skipped: 2
blocked: 0

## Deferred Follow-Ups

- test: 3
  idea: "B 站直播流（fMP4 分片）转录支持——当前 mux.js 仅支持 MPEG-TS 输入而按设计拒转；用户确认仍要做 B 站直播流转录，Phase 44 完成后开始介入"
  deferred_at: 2026-09-07

## Gaps

- gap_id: G-44-2
  truth: "停止录制流程稳定完成，不闪退（录制按钮图标目检为附带确认）"
  status: failed
  reason: "User reported: 直播按钮切换点击都没问题，点播 m3u8 点击停止录制后程序闪退了。日志末尾：Electron exited with signal SIGSEGV"
  severity: blocker
  test: 2
  root_cause: "Electron 43.3.0 上游 use-after-free：键盘事件 ACK 回包（WidgetInputHandler_DispatchEvent）经 InputRouterImpl::KeyboardEventHandled 委派给已销毁 webContents 的 InspectableWebContents::HandleKeyboardEvent，虚调用踩已释放内存（this=0xefefefef…）。崩溃报告 .ips 全帧符号化确证；录制/停止 JS 链路无缺陷（5 组 playwright 真机复现零崩溃，崩溃栈无任何自研原生模块帧）。「点击停止录制」与崩溃仅时序重合；触发条件为键盘 ACK 在途时对应 webContents 被销毁（候选：ERR_FAILED 的 mp4 webview guest、停止录制后关播放器窗口的 Cmd+W ACK）"
  artifacts:
    - path: "Electron Framework inspectable_webcontents.cc / input_router_impl.cc"
      issue: "上游 use-after-free（electron/electron#43297 同类）"
    - path: "ipc-handlers.js（播放器窗口关闭序列 D-13）/ tab 销毁路径"
      issue: "Realm 侧规避点：键盘 ACK 在途时同步销毁 webContents 的时序窗口"
  missing:
    - "首选升级 Electron 43.3.0 → 最新（须同步 4 处 UA/CH 常量）；或 Realm 侧规避：webContents 销毁序列先 hide/延后 destroy，避免键盘 ACK 在途时同步销毁"
    - "复现时留存完整主进程日志确认被销毁的具体 webContents，细化规避点"
  debug_session: .planning/debug/stop-record-sigsegv.md

- gap_id: G-44-4
  truth: "录制中红色按钮 hover 显示的录制时长应平滑连续更新（每秒推进）"
  status: failed
  reason: "User reported: 播放器右上角红色按钮，鼠标放上去显示时间更新不及时，有时半天不改变时间，有时又突然增加好几秒"
  severity: minor
  test: 4
  root_cause: "media-record-engine.js:296 getRecordStatus 的 durationSeconds = 已落盘分片数 × targetDuration（量化近似值），而非本地时钟差值；分片落盘节奏受网络抖动影响每轮 0~N 个不等（UI 每秒 setInterval 刷新正常，player.js:902-908），数据源天然 2s+ 阶梯粒度——平段不动/一次跳几秒"
  artifacts:
    - path: "media-record-engine.js"
      issue: "getRecordStatus/getActiveRecordings 的 durationSeconds 计算式与真实挂钟时间脱钩"
    - path: "src/player.js"
      issue: "hover tooltip 直显该值（UI 层无需改，跟随新数据源）"
  missing:
    - "运行中时长改基于本地时钟（startRecord 时刻 Date.now() 差值）平滑推进；meta.json/终态累计 EXTINF 口径保持不变"
  debug_session: .planning/debug/record-duration-timer-lag.md

- gap_id: G-44-6
  truth: "缓存抽屉条目 meta 行应为「时钟图标 + 时间」并排展示——图标只替换「最近观看」四个字，时间文本始终可见（非仅 hover）"
  status: failed
  reason: "User reported: 图标替换理解有误，我只想替换「最近观看」四个字，时间还是要有的，现在只有一个图标没有时间了"
  severity: major
  test: 6
  root_cause: "commit 44a24ef（Plan 12 / G-44-8 修复）在 src/player.js:983-1001 renderDrawer 把「最近观看 {时间}」整段替换为纯图标 span，时间只写进 watchedIcon.title；需求表述歧义（上轮 gap 文字即「完整时间保留在 title tooltip」）导致实现偏差，本轮 UAT 用户澄清真实意图"
  artifacts:
    - path: "src/player.js"
      issue: "renderDrawer meta 行时间无可见文本节点，仅存在于 title 属性"
    - path: "src/player.css"
      issue: ".drawer-item-watched 注释同步（样式本身无隐藏行为）"
  missing:
    - "保留时钟图标 span，其后追加时间文本节点实现「图标 + 时间」并排常显；title 保留完整「最近观看 时间」作补充提示"
  debug_session: .planning/debug/watch-time-icon-replaced.md

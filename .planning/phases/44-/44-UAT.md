---
status: complete
phase: 44-player-video-cache-and-local-media-library
source: [44-VERIFICATION.md]
started: 2026-09-07T08:00:00Z
updated: 2026-09-07T23:30:00Z
note: 第 4 轮 UAT — G-44-7 由 AES-128 解密转换链路（D-17 隐藏决策用户推翻）修复后复测通过，4/4 全过，phase 收尾
---

## Current Test

[全部通过 — Round 4（G-44-7 复验 + 抽屉 UI 三修复）见下]

## Tests (Round 4 — G-44-7 复验 + 抽屉 UI 修复，2026-09-07 晚)

### 1. 抽屉高度避开标题栏与控制栏
expected: 抽屉上边界不压自定义标题栏（top=28px）、下边界不压控制栏（bottom=68px），全屏时顶到屏幕顶
result: pass

### 2. 加密 HLS 缓存完成后出现「转换为 MP4」按钮且产物有效（G-44-7 复验）
expected: https://hn.bfvvs.com/play/b2k7JoJd/index.m3u8（AES-128 + enc.key + IV=0）缓存完整度 100% 后抽屉出现转换按钮，产物为可播放的非 0 字节 mp4
result: pass
note: "D-17 隐藏决策用户推翻：加密源不再隐藏按钮，转为 AES-128 解密转换链路（key_hex 经 /proxy 密钥请求留存 meta、历史污染条目自愈回读、remuxer decryption 入参 aes-128-cbc 逐分片解密后嗅探转封装）。真实源 3 密文分片转出 555KB 合法 mp4（ffprobe h264+aac）"

### 3. 抽屉打开时点击视频画面只收起抽屉
expected: 抽屉弹出中点击视频：抽屉收起，播放状态不变（不触发播放/暂停，不误进全屏）
result: pass

### 4. 抽屉打开期间缓存进度实时刷新
expected: 抽屉打开中条目「缓存大小 · 完整度%」随分片落盘实时推进（2s 轮询就地更新，不重建列表），完整度到 100% 时转换按钮自动出现
result: pass

## Summary (Round 4)

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Tests (Round 3 — gap closure 复验，44-14/44-15/44-16)

### 1. 真机 5 轮「开始录制→停止→关窗（含 Cmd+W）」无 SIGSEGV（G-44-2 复验）
expected: 连续 5 轮录制→停止→关窗（Cmd+W 与点关闭混用）全程无 SIGSEGV；dev 环境可见 webContents destroyed 诊断日志，生产版零输出（44-14 延迟销毁规避 + 44-15 Electron 43.6.0 双层防御）
result: pass

### 2. 红点时长每秒平滑 +1（G-44-4 复验）
expected: 录制中红点 hover 时长每秒平滑推进 +1s，0 分片落盘（弱网）时也在走表，不再出现「半天不动/突然跳几秒」；停止后任务页时长口径不变
result: pass

### 3. 抽屉「时钟图标+时间」并排常显（G-44-6 复验）
expected: 缓存抽屉条目 meta 行为「时钟图标 + 时间」并排常显（时间文本非仅 hover 可见），title 保留完整「最近观看 时间」提示
result: pass

### 4. 缓存完成后转录 MP4 产物非 0 字节（G-44-7，Round 3 追加）
expected: 播放 https://hn.bfvvs.com/play/b2k7JoJd/index.m3u8 缓存完成后点「转换为 MP4」，产物为可播放的非 0 字节 mp4；不可转格式应显式报错且不留 0 字节半成品
result: issue
reported: "现在还有问题，https://hn.bfvvs.com/play/b2k7JoJd/index.m3u8 播放视频时，缓存完成转录 mp4 还是0字节"
severity: blocker

## Summary (Round 3)

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Tests (Round 2 — archived, 2026-09-07 上午)

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

## Summary (Round 2 — archived)

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
  status: resolved        # was: failed
  resolved_by: 44-14, 44-15
  resolved_at: 2026-09-07
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
  status: resolved        # was: failed
  resolved_by: 44-16
  resolved_at: 2026-09-07
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
  status: resolved        # was: failed
  resolved_by: 44-16
  resolved_at: 2026-09-07
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

- gap_id: G-44-7
  truth: "缓存完成后「转换为 MP4」产物为可播放的非 0 字节 mp4（不可转格式应显式报错且不留 0 字节半成品）"
  status: resolved        # was: failed
  resolved_by: "44-17 + 44-18 + AES-128 解密转换链路（2026-09-07 晚直接修复，非 GSD 计划）"
  resolved_at: 2026-09-07
  resolution: "三层修复：① 44-17 泄漏层——convertToMp4 产物改 fs.openSync 同步 fd，失败路径 unlinkSync 必命中，0 字节泄漏消除；② 44-18 分类层——清单加密检测 + key URI 不落 segments；③ 解密层（D-17 隐藏决策用户推翻）——parser 捕 IV、meta 留存 key_hex/key_iv/media_sequence（含历史污染条目自愈回读）、remuxer 新增 decryption 入参逐分片 aes-128-cbc 解密后嗅探转封装、入口缺 key 按 key_unavailable 文案引导重播。Round 4 真机复验通过（bfvvs 真实源转出有效 mp4）"
  reason: "User reported: https://hn.bfvvs.com/play/b2k7JoJd/index.m3u8 播放视频时，缓存完成转录 mp4 还是0字节"
  severity: blocker
  test: 4
  root_cause: "双因链（AND）：① 格式层——该源是 AES-128 加密 HLS（#EXT-X-KEY METHOD=AES-128），缓存层落盘的是解密前密文（52 分片无一 0x47 开头、熵判定 256≥240），mux.js 无解密链路，44-13 嗅探正确拒转（今日任务 fa53643f 正确 failed=encrypted_stream），状态机无缺陷；② 泄漏层——convertToMp4 在嗅探检查点之前 fs.createWriteStream(outputPath)（open 带 O_CREAT 异步排队、文件尚未创建），嗅探拒绝后 fail() 同一同步 tick 内 unlinkSync → ENOENT 被静默吞掉，事件循环随后执行排队的 open() 创建 0 字节文件，此后无人清理。历史两条 9/6 任务（44-13 修复前）completed+0 字节是另一面：当时无 empty_output 终检，密文分片转出无效产物"
  artifacts:
    - path: "media-remuxer.js"
      issue: "fail()/empty_output 清理的 unlinkSync 与 createWriteStream 异步 open() 竞态（187/196-198 行区域）——凡「stream 创建后、首条 data 写盘前」失败路径（encrypted_stream/unsupported_container/cancelled/早期 transmux 异常）均泄漏 0 字节文件"
    - path: "media-cache-manager.js"
      issue: "次要：segment 请求分类未排除 EXT-X-KEY 的 key URI，enc.key（16 字节 ASCII）被当分片落库（meta.segments 53 > total_segments 52），污染 playlist_order 完整性判定"
  missing:
    - "泄漏修复（核心）：清理改为等 stream 完全关闭后再 unlink（'close' 事件时序），或先同步建 fd 再建 WriteStream；回归测试断言密文分片 reject 后 outputPath 不存在"
    - "体验改进：转换入口/清单解析层检测 EXT-X-KEY:METHOD=AES-128 直接报「加密视频暂不支持转换」，不进 mux 流程"
    - "缓存分类修正（次要）：缓存捕获排除 EXT-X-KEY 的 key URI，避免 key 污染 segments"
  debug_session: .planning/debug/convert-mp4-zero-bytes.md

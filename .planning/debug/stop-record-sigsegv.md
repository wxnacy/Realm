---
status: diagnosed
trigger: "UAT gap G-44-2（Phase 44）：点播 m3u8/mp4 直连源开始录制后点击停止录制，主进程 SIGSEGV 闪退"
created: 2026-09-07T00:00:00+08:00
updated: 2026-09-07T00:00:00+08:00
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: diagnosed
---

## Current Focus

hypothesis: H-CONFIRMED——崩溃根因是上游 Electron/Chromium 原生 UAF：键盘事件 ACK 回包（mojo WidgetInputHandler_DispatchEvent → InputRouterImpl::KeyboardEventHandled）到达主进程时，目标 webContents 的 Electron C++ 包装 InspectableWebContents 已被释放，虚调用（LDR x8,[x0]; LDR x3,[x8,#240]; BR x3）踩到 0xEF 填充的已释放内存。「点击停止录制」与崩溃只是时序重合，录制/停止 JS 链路不是崩溃原因
test: ① dSYM 符号化崩溃帧（已完成，见 Evidence）；② 录制停止路径 5 组真机复现实验（全部零崩溃，反证录制链路无辜）
expecting: 已达成
next_action: 输出 ROOT CAUSE FOUND 诊断报告（goal: find_root_cause_only，不实施修复）

reasoning_checkpoint:
  hypothesis: 上游 Electron 43.3.0 原生 UAF——键盘事件 ACK 回包在 InspectableWebContents（webContents 的 Electron C++ 包装）释放后到达主线程，虚调用踩 0xEF 填充内存；与停止录制仅时序重合
  confirming_evidence:
    - "崩溃帧 dSYM 符号化（UUID 精确匹配）：MessagePumpCFRunLoopBase::RunWorkSource → mojo Connector/MultiplexRouter → WidgetInputHandler_DispatchEvent_ForwardToCallback::Accept → InputRouterImpl::KeyboardEventHandled → non-virtual thunk to electron::InspectableWebContents::HandleKeyboardEvent（inspectable_webcontents.cc）——崩溃点=键盘 ACK 委派链"
    - "反汇编 instructionByteStream：崩溃指令 LDR x8,[x0] 为 C++ 虚函数调用前奏（后随 LDR x3,[x8,#240]; BR x3），this=0xefefefefefefefef 为 0xEF memset 填充模式=已释放内存"
    - "崩溃报告无任何 better-sqlite3/自研原生模块帧；faulting thread 为主线程 CrBrowserMain"
    - "录制/停止 JS 全链路审查：stopRecord→writeMeta→completeTask→persistMediaTasks(sync fs+broadcast+Notification)→onTaskCompleted 接力（mp4/VOD 停止时 segments=[] 直接 no_segments 返回）——全部纯 JS，无原生调用面"
    - "5 组真机复现实验零崩溃：本地 mp4 直连×2、真实 test-videos mp4（含真实播放 readyState=4）、mux VOD m3u8、快速连点 10 轮（0-800ms 随机间隔）、hover 1s 轮询+20s 录制稳定压测 3 轮"
    - "上游同类 issue：electron/electron#43297「Crash in HandleKeyboardEvent」（Windows，closed need-info）"
  falsification_test: "若用户下次复现时（不改任何录制代码）将崩溃与停止录制解耦（如只在切 tab/按键后发生），或 dSYM 显示崩溃帧位于录制相关原生代码内，则本结论被推翻"
  fix_rationale: "修复方向不在 media-record-engine/media-task-manager/main.js 录制链路：(a) 首选升级 Electron（43.3.0 → 新版，观察上游竞态是否已修，升级须同步 4 处 UA/CH 常量）；(b) Realm 侧规避：webContents 销毁序列（播放器窗口关闭 D-13、tab 关闭）避免在键盘事件可能在途时同步 destroy（先 hide/移除，延后 destroy）"
  blind_spots: "①被销毁的具体 webContents 无法从崩溃报告确认（候选：加载失败的 mp4 webview guest——GUEST_VIEW_MANAGER_CALL ERR_FAILED 佐证其处于受损态；或停止后关闭播放器窗口的 Cmd+W 键 ACK）；②合成键盘+立即销毁 100 轮未复现（合成事件不走真实焦点 ACK 路径，不构成反证）；③用户完整主进程日志缺失，无法回放崩溃前最后事件序列"
  candidate_causes:
    - "code: Realm 录制/停止 JS 链路——已排除（纯 JS + 5 组复现实验零崩溃）"
    - "environment: Electron 43.3.0 上游竞态（键盘 ACK vs webContents 销毁）——已确认崩溃帧落于此"
    - "environment: 受损 webview guest（ERR_FAILED）——提高竞态暴露概率的因素"
    - "data: 无涉（better-sqlite3 并发写嫌疑已排除，无该模块崩溃帧）"
  and_gate: "no——单一上游竞态即足致崩；受损 guest 只是加速因素，非必要条件"

bug_class: Heisenbug（时序竞态型，非确定性可复现；复现需真实焦点键盘 ACK 与销毁时序重叠）

## Symptoms

expected: 停止录制流程稳定完成，任务转 completed、写分片索引、任务页可见，应用不闪退
actual: 点播 m3u8（mp4 直连页面嗅探）点击停止录制后应用整体闪退；日志末尾 "Electron exited with signal SIGSEGV"；直播流（TS）录制停止正常
errors: 主进程终端无 JS 异常栈，直接 SIGSEGV；崩溃前日志含 GUEST_VIEW_MANAGER_CALL ERR_FAILED (-2)（疑似噪音）
reproduction: 播放器/嗅探 → 开始录制（点播 m3u8 或 mp4 直连源）→ 点击停止录制 → SIGSEGV
started: UAT 2026-09-07（dev 环境 npm run dev）

## Eliminated

- hypothesis: better-sqlite3 并发写（任务持久化与分片索引写竞争同一连接）
  evidence: 崩溃报告 usedImages 无 better_sqlite3 崩溃帧且 faulting thread 栈全在 Electron Framework/mojo/输入子系统；任务持久化为 JSON 文件（media-tasks.json）非 sqlite
  timestamp: 2026-09-07T17:30+08:00
- hypothesis: FS 原生调用竞态（openSync/writeSync/closeSync double-close fd）
  evidence: 停止路径的 fs 调用均为标准同步 API 且 5 组真机实验零崩溃；崩溃帧在 mojo 输入子系统非 fs/libuv
  timestamp: 2026-09-07T18:05+08:00
- hypothesis: stopRecord 与在途 downloadSegment 竞态中对已销毁对象操作（updateProgress 非法流转）
  evidence: 该竞态为纯 JS 层且已有 try/catch 兜底；mp4/VOD 场景 segments=[] 根本无 downloadSegment 在途；快速连点 10 轮实验零崩溃
  timestamp: 2026-09-07T18:05+08:00
- hypothesis: 录制停止触发的 Notification/弹框/broadcast 原生 API UAF
  evidence: 5 组复现实验中 Notification.show、broadcast、relay 全部真实执行，零崩溃
  timestamp: 2026-09-07T18:05+08:00
- hypothesis: 点播转正逻辑（pl.ended completeTask）与停止点击竞态
  evidence: VOD m3u8 真实源复现实验完整覆盖该路径，零崩溃；且该路径为纯 JS
  timestamp: 2026-09-07T18:05+08:00

## Evidence

- timestamp: 2026-09-07T17:20+08:00
  checked: ~/Library/Logs/DiagnosticReports/Electron-2026-09-07-155847.ips（与 UAT 时间吻合，app 启动 15:56:35 → 崩溃 15:58:44，约 2 分钟）
  found: EXC_BAD_ACCESS SIGSEGV, KERN_INVALID_ADDRESS at 0xefefefefefefefef；faulting thread = 主线程 CrBrowserMain；崩溃在 Electron Framework 内（无 better-sqlite3/自研原生帧，排除 better-sqlite3 并发写直接嫌疑）
  implication: 原生层 UAF，非 JS 层异常
- timestamp: 2026-09-07T17:22+08:00
  checked: instructionByteStream 反汇编（atos 本地确认崩溃帧指令）
  found: 崩溃指令序列 LDR x8,[x0] → LDR x3,[x8,#240] → BR x3 = C++ 虚函数调用；this 指针 = 0xefefefefefefefef（memset 填充模式 = 已释放内存）；调用点位于主线程 runloop source0 → uv/node → v8::MicrotasksScope（微任务/Promise continuation）上下文
  implication: 微任务中同步调用的原生 API 踩到已释放 C++ 对象
- timestamp: 2026-09-07T17:55+08:00
  checked: playwright _electron 真机复现实验组（dev 环境，真实 dev userData，/tmp/repro-stop-record*.js）
  found: ① 本地 mp4 二进制直连源 start→wait→stop：正常 completed 应用存活；② 真实 test-videos.co.uk mp4 + 真实播放（video readyState=4）+ 录制 12s + 停止：零崩溃；③ mux x36xhzz VOD m3u8 同流程：零崩溃；④ 快速连点 start/stop 10 轮（0-800ms 随机间隔，命中在途 fetch 竞态窗口）：零崩溃；⑤ hover 1s 轮询 + 20s 录制 + 停止 ×3 轮：零崩溃。停止路径全程覆盖 writeMeta→completeTask→broadcast→Notification.show→接力 no_segments
  implication: 录制/停止 JS 链路无法触发该 SIGSEGV，崩溃源在别处
- timestamp: 2026-09-07T18:05+08:00
  checked: GitHub release 下载 electron-v43.3.0-darwin-arm64-dsym.tar.xz（1.7GB），UUID 4C4C44D6-5555-3144-A142-D5594664B24B 与崩溃报告精确匹配，atos 全帧符号化
  found: 真实崩溃链（自底向上）：base::MessagePumpCFRunLoopBase::RunWorkSource（source0）→ ThreadControllerWithMessagePumpImpl::DoWork → mojo::SimpleWatcher::OnHandleReady → mojo::Connector::OnWatcherHandleReady → MessageDispatcher/MultiplexRouter::Accept → InterfaceEndpointClient::HandleIncomingMessage → blink WidgetInputHandler_DispatchEvent_ForwardToCallback::Accept → InputRouterImpl::FilterAndSendWebInputEvent 回调 → InputRouterImpl::KeyboardEventHandled（input_router_impl.cc:760）→【崩溃】non-virtual thunk to electron::InspectableWebContents::HandleKeyboardEvent(content::WebContents*, input::NativeWebKeyboardEvent const&)
  implication: 崩溃点 = 键盘事件 ACK 回包（renderer 输入处理结果返回 browser 侧）委派给 embedder delegate（InspectableWebContents）时该包装对象已被释放——键盘事件 ACK 与 webContents 销毁的竞态 UAF，与录制引擎零关联
- timestamp: 2026-09-07T18:10+08:00
  checked: 上游同类 issue 检索（gh api search）
  found: electron/electron#43297「[Bug]: Crash in HandleKeyboardEvent」（v31，Windows，closed need-info/stale）同类崩溃签名；未找到已修复的公开 PR
  implication: 上游已知 bug 类别，Electron 43.3.0 仍存在
- timestamp: 2026-09-07T18:15+08:00
  checked: 合成竞态实验——循环 100 次「新建 BrowserWindow → sendInputEvent(keyDown/keyUp) → setTimeout(0) destroy」（/tmp/repro-keyrace.js）
  found: 零崩溃（合成输入事件不经过真实焦点/renderer ACK 全链路，无法命中该竞态窗口）
  implication: 该竞态需真实键盘焦点场景（用户真实按键）；合成复现失败不构成反证

## Resolution

root_cause: 上游 Electron/Chromium 原生 use-after-free：键盘事件处理结果 ACK 回包（mojo WidgetInputHandler_DispatchEvent 响应）经 InputRouterImpl::KeyboardEventHandled 委派给 embedder（electron::InspectableWebContents::HandleKeyboardEvent）时，该 webContents 的 InspectableWebContents 包装对象已被销毁释放，虚调用踩到 0xEF 填充的已释放内存（this=0xefefefefefefefef）。「点击停止录制」与崩溃仅时序重合——录制/停止 JS 链路（media-record-engine/media-task-manager/main.js 集成层）全部为纯 JS，真机 5 组复现实验零崩溃。触发条件：键盘事件 ACK 在途时对应 webContents 被销毁（用户环境中加载失败的 mp4 webview guest——GUEST_VIEW_MANAGER_CALL ERR_FAILED 佐证——与停止录制后关闭播放器窗口时的 Cmd+W 键 ACK 均为候选）
fix: 交由 plan-phase --gaps 决策。方向：(a) 升级 Electron 43.3.0 → 最新（观察上游竞态是否已修；注意升级须同步 4 处 UA/CH 常量）；(b) Realm 侧规避：webContents 销毁序列（播放器窗口关闭 D-13、tab 关闭）先 hide/移除、延后 destroy，避免键盘 ACK 在途时同步销毁；(c) 录制引擎无需改动
verification: （诊断模式，未实施修复）崩溃帧已用官方 dSYM（UUID 精确匹配）完整符号化并反汇编确认指令级证据；录制链路无辜由 5 组真机复现实验反证
files_changed: []

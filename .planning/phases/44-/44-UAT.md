---
status: diagnosed
phase: 44-player-video-cache-and-local-media-library
source: [44-VERIFICATION.md]
started: 2026-09-06T15:00:00Z
updated: 2026-09-07T12:10:00Z
---

## Current Test

[testing complete]

number: 9
name: 崩溃中断任务续转实况（WR-C 派生新增项）
expected: |
  可控模拟：录制进行中 kill 主进程 → 重启 → 任务页该任务显示「已中断」→ 点「已落盘部分续转」：因录制中从不写 meta.json（writeMeta 仅 stop/fail/pl.ended/异常兜底四路径），RECORD_ROOT/<taskId>/ 无 meta.json，readRecordTaskSegments 短路返回 null → 仍 400 no_segments（.ts 分片滞留目录）。请判定：此项属可接受边界（记 REVIEW.md 债务，建议录制中周期性写轻量 meta 或按 <seq>.ts 文件名合成索引）还是必须本阶段闭合
awaiting: user response

## Tests

### 1. 真机重开已看视频秒开体感（CR-01 修复后；前次第 1 项，未被修复证伪）
expected: 重开同一视频已看部分立即起播、网络面板/日志无分片回源请求；接着上次进度继续
result: pass

### 2. webview tab 模式播放回归（D-01；前次第 2 项，未被修复证伪）
expected: webview tab 内播放行为与 Phase 43 完全一致，无缓存落盘、无 mode=independent 行为
result: issue
reported: "webview 播放无缓存，但是它也走了 proxy 路由，导致直接播放 m3u8 时无法识别多媒体。本 Phase 的讨论是 webview 像之前那样直接访问，播放器才走 proxy。"
severity: major

### 3. 断网/源站失效降级提示条（CR-01 修复后；前次第 3 项，修复后该测试才有意义）
expected: 播放中断网：已缓存分片继续播、提示条「部分分片加载失败，已缓存部分可继续观看」约 4s 消失、恢复网络后播放续上
result: pass
note: 代码层面验证（用户判定不便实测）：命中优先读盘/不销毁引擎/文案与 4s 定时/WR-06 复位均成立；「持续断网超 3 个 fatal 周期后不自动恢复」为已知边界，不在本测试预期内

### 4. 直播录制全链路（真实直播源；前次第 4 项，CR-04 修复后停止语义才正确）
expected: 录制按钮→红点闪烁→hover tooltip「已录 mm:ss · xxxMB」→停止→任务页可见→关窗/退出确认→产物 meta.json 正确
result: issue
reported: "1) 工具栏录制按钮点击后图标消失，仍可点击但不显示停止图标（右上红点闪烁正常）。2) 停止录制后转出的 mp4 是 0 字节；m3u8 缓存完成后转码 mp4 也是 0 字节。"
severity: major

### 5. 系统通知与 Finder 定位（打包版优先，dev 环境 Notification 可能静默；前次第 5 项）
expected: convert 完成/失败通知弹出，点击定位产物
result: issue
reported: "没有提示，make install-nightly 的 nightly app 也没有提示。"
severity: minor

### 6. mux.js 真机转封装产物可播性（前次第 6 项）
expected: 录制→停止→自动弹框→转换→产物在 QuickTime/IINA 播放，时长/进度/音画正常
result: issue
reported: "产物0字节，之前报过。"
severity: major

### 7. 任务页三区渲染/空态/角标显隐/设置分区即改即存（前次第 7 项）
expected: 三区与状态文案符合 UI-SPEC；角标 count>0 显示归零消失、点击跳 realm://tasks；改缓存目录/容量即时生效（改小容量触发淘汰）
result: issue
reported: "录制进行中主窗口工具栏没有出现任务角标按钮（webview tab 播放器录制，任务注册表 running=1 正确）。三区渲染/设置即改即存子项未验。"
severity: minor

### 8. 抽屉增删/续播/转换按钮 gating（D-17；前次第 8 项）
expected: 抽屉条目展示、删除确认框居中、完整度 100% 或中断条目才显「转换为 MP4」
result: issue
reported: "布局与 gating 正常（转换按钮只在 100% 条目显示）。两项修改要求：1) 删除默认只删缓存，但确认框要加勾选「是否删除条目」，勾选则连观看历史条目一并删除；2) 「最近观看」文字换成图标，本阶段完成。"
severity: minor

### 9. 崩溃中断任务续转实况（WR-C 派生新增项——决定 D-18 硬崩溃承诺是否需 44-09）
expected: 可控模拟：录制进行中 kill 主进程 → 重启 → 任务页该任务显示「已中断」→ 点「已落盘部分续转」：因录制中从不写 meta.json（writeMeta 仅 stop/fail/pl.ended/异常兜底四路径），RECORD_ROOT/<taskId>/ 无 meta.json，readRecordTaskSegments 短路返回 null → 仍 400 no_segments（.ts 分片滞留目录）。请判定：此项属可接受边界（记 REVIEW.md 债务，建议录制中周期性写轻量 meta 或按 <seq>.ts 文件名合成索引）还是必须本阶段闭合
result: issue
reported: "样式没问题，已落盘部分续转点击没有反应。中断任务 7d5b4a10 实测：39 个 .ts（3.6MB）滞留、无 meta.json，续转 400 no_segments，前端无任何可见反馈。用户判定：边界记债（REVIEW.md）+ 本阶段修失败反馈。"
severity: minor

## Summary

total: 9
passed: 2
issues: 7
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-44-9
  truth: "「已落盘部分续转」点击后有可见反馈：可转则发起转换；不可转（如录制中崩溃无 meta.json）时任务页显示明确失败文案（含原因解释），不做无声失败"
  status: failed
  reason: "User reported: 已落盘部分续转点击没有反应。实测中断任务 7d5b4a10：39 个 .ts 滞留、无 meta.json → 后端 400 no_segments 正确返回，但前端 apiAction（src/tasks-page.js:288）失败仅 console.error，页面无可见反馈。用户判定：续转能力本身（录制中周期性写轻量 meta 或按 <seq>.ts 合成索引）记 REVIEW.md 债务，本阶段只修失败反馈。"
  severity: minor
  test: 9
  root_cause: "两层：① 边界——record 引擎录制中不写 meta.json（writeMeta 仅 stop/fail/pl.ended/异常兜底四路径），硬崩溃中断后 readRecordTaskSegments 短路 null，续转必 400 no_segments（用户已接受记债）；② UX——tasks-page.js apiAction 对非 success 响应只 console.error，无用户可见错误展示。"
  artifacts:
    - path: "src/tasks-page.js"
      issue: "apiAction 失败分支无可见反馈（仅 console.error + loadTasks）"
  missing:
    - "任务页增加可见错误反馈（条目内联错误文案或页面提示条，约 4s 自动消失或常驻至下次操作），apiAction 失败时展示后端 error 字段"
    - "convert-resume 的 no_segments 失败文案补充解释（如「录制中崩溃的任务暂无分片索引，暂不支持续转」）"
    - "（债务，REVIEW.md）录制中周期性写轻量 meta.json 或按 <seq>.ts 文件名合成索引，使硬崩溃后可续转"

- gap_id: G-44-8
  truth: "抽屉删除确认框支持「是否删除条目」勾选（默认不勾=仅删缓存、历史条目保留为未缓存；勾选=连观看历史条目一并删除）；抽屉元信息「最近观看」文字用图标替代"
  status: failed
  reason: "User reported: 1) 删除后条目没清理只变成未缓存——默认可只删缓存，但弹框要加勾选「是否删除条目」，勾选则条目也删除；2) 「最近观看」文字替换成图标（本阶段完成）。"
  severity: minor
  test: 8
  root_cause: "非缺陷，产品决策变更：现有删除语义为 D-14/D-15 双层合并下的「仅删缓存目录、观看历史保留」（确认文案已承诺），条目来自历史层故删除后仍显示未缓存；「最近观看」为纯文字 meta。用户要求增强交互。"
  artifacts:
    - path: "src/player.js"
      issue: "drawerDeleteDialog 无勾选项；删除确认后仅调 deleteCacheEntry；meta 行用文字「最近观看」"
    - path: "ipc-handlers.js"
      issue: "player:cache:delete 仅删缓存目录，无删观看历史能力（需新增或扩展参数）"
  missing:
    - "确认框加 checkbox「同时删除条目（含观看历史）」默认不勾；勾选后确认时同步删除 playerHistory 中该 playbackKey 的记录（需主进程新增 IPC 或扩展 player:cache:delete 参数，注意 playerHistory 是否已有按 playbackKey 删除方法）"
    - "删除文案随勾选状态联动或改为中性描述"
    - "抽屉 meta「最近观看」替换为时钟图标（title tooltip 保留时间文字），复用 drawer-item-meta 样式"

- gap_id: G-44-7
  truth: "有 running 录制/转换任务时主窗口工具栏显示任务角标（数字=running 数），归零消失，点击跳 realm://tasks"
  status: failed
  reason: "User reported: 录制中（webview tab 播放器），主窗口工具栏没出现角标。任务注册表 running=1 已实证（media-tasks.json）。"
  severity: minor
  test: 7
  root_cause: "preload 命名空间错配：onMediaTaskCountChanged 定义在 contextBridge.exposeInMainWorld('mediaAPI') 对象内（src/preload.js:1537，1469 起 mediaAPI 段），而 src/renderer.js:10540 initMediaTaskBadge 判断并调用的是 window.realmAPI.onMediaTaskCountChanged——realmAPI 上无此方法，条件短路，监听从未注册，角标永远不更新。主进程侧广播链路（persistMediaTasks → windowManager.broadcast）核查正常。"
  artifacts:
    - path: "src/renderer.js"
      issue: "initMediaTaskBadge 引用 window.realmAPI.onMediaTaskCountChanged（不存在）"
    - path: "src/preload.js"
      issue: "onMediaTaskCountChanged 落在 mediaAPI 段（与 renderer 引用不一致）"
  missing:
    - "renderer.js:10540 改为 window.mediaAPI.onMediaTaskCountChanged（与同文件媒体面板用 mediaAPI.onMediaListUpdate 一致）；或把该方法挪进 realmAPI——取前者，单行改动"

- gap_id: G-44-5
  truth: "convert/record 终态弹系统通知，点击通知在 Finder 定位产物"
  status: failed
  reason: "User reported: 没有提示，make install-nightly 的 nightly app 也没有提示。"
  severity: minor
  test: 5
  root_cause: "环境级根因（非代码缺陷）：Nightly .app 为 ad-hoc 签名（codesign: Signature=adhoc, Identifier=Electron, Info.plist=not bound），macOS 对未正式签名 app 静默丢弃通知授权请求——实证：通知中心授权表（com.apple.notificationcenterui）无 com.realm.browser.nightly 与 Electron 条目（系统从未弹过授权框）、unnoted/UNUserNotificationCenter 系统日志 30 分钟窗口零记录。dev 的 Electron 二进制同为 ad-hoc/linker-signed 同样被拒。代码链路核查正常：main.js:2065 showTaskNotification 已接线（diff 逻辑 register→complete 两次持久化可捕获 running→completed），Notification 已正确 import。"
  artifacts:
    - path: "Makefile / electron-builder 配置"
      issue: "无 Developer ID 正式签名，ad-hoc 签名导致 macOS UNUserNotificationCenter 静默拒授"
  missing:
    - "（根治）Developer ID 正式签名+公证后系统通知可用"
    - "（替代方案，推荐）convert/record 终态增加应用内 toast 提示（主窗口/播放器 renderer），不依赖系统通知；点击定位走既有 shell.showItemInFolder"
    - "验收注意：通知点击定位（showItemInFolder）链路因通知不弹无法单独验证，随通知修复一并验收"

- gap_id: G-44-2
  truth: "webview tab 内播放行为与 Phase 43 完全一致：直连访问不走 proxy 路由，m3u8 直接播放可正常识别为多媒体"
  status: failed
  reason: "User reported: webview 播放无缓存，但是它也走了 proxy 路由，导致直接播放 m3u8 时无法识别多媒体。本 Phase 的讨论是 webview 像之前那样直接访问，播放器才走 proxy。"
  severity: major
  test: 2
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
- gap_id: G-44-4a
  truth: "录制进行中工具栏按钮显示停止图标（红点闪烁之外，图标状态可辨识）"
  status: failed
  reason: "User reported: 录制按钮点击后图标消失，仍可点击但不显示停止图标。"
  severity: minor
  test: 4
  root_cause: "player.html:83-84 只有 icon-record 一个图标；player.js:821 updateRecordUi 录制中把 iconRecord 设为 display:none，但没有停止图标可切换，按钮变空白。"
  artifacts:
    - path: "src/player.html"
      issue: "btn-record 内缺录制中的停止图标元素"
    - path: "src/player.js"
      issue: "updateRecordUi 只隐藏 iconRecord，无停止图标切换分支"
  missing:
    - "player.html 增加 stop 图标（如方块 icon-stop），录制中显示/非录制隐藏"
    - "updateRecordUi 切换两个图标的显隐"
- gap_id: G-44-4b
  truth: "转封装产物 mp4 可播放（录制与缓存两条路径）；无法转换时应显式报错而非静默产出 0 字节文件"
  status: failed
  reason: "User reported: 停止录制后转出的 mp4 是 0 字节；m3u8 缓存完成后转码 mp4 也是 0 字节。"
  severity: major
  test: 4
  also_test: 6  # Test 6（转封装产物可播性）为同一根因，不另建 gap
  root_cause: "实测三类分片两种非 TS 格式，mux.js Transmuxer 仅支持 MPEG-TS：① B 站直播 miniav1 流为 HLS+fMP4（CMF）分片（录制 segments/ 与缓存 4a11220a 均以 moof box 开头，无 0x47 同步字节），push 进 Transmuxer 不报错也不触发 data 事件 → convertToMp4 静默 resolve 产出 0 字节（已用真实分片复现：5 分片 resolved、输出 0 字节）；② hn.bfvvs.com 缓存分片（5a61ed25）为 AES-128 密文（高熵无同步字节），缓存存的是加密数据，转封装前无 EXT-X-KEY 解密链路 → 同样 0 字节；③ convertToMp4 无分片格式嗅探与零产物校验，两种不可转场景均伪装成 completed。"
  artifacts:
    - path: "media-remuxer.js"
      issue: "无 TS 同步字节/格式嗅探；fMP4 与 AES 密文分片静默产出 0 字节且任务标记 completed"
    - path: "media-cache-manager.js / 录制引擎"
      issue: "缓存/录制按 .ts 命名存储但内容可能是 fMP4 fragment 或 AES 密文，无能力标注"
  missing:
    - "convertToMp4 前置格式嗅探（首字节 0x47 校验 + moof/密文熵检测），不可转格式显式 reject（err.reason 如 unsupported_container/encrypted_stream），任务页给明确失败文案"
    - "转封装结束校验产物字节数 >0，否则按失败处理并清理"
    - "（可选增强）AES-128 EXT-X-KEY 解密支持或 fMP4 init+frag 拼接支持；短期至少拒转提示"
- gap_id: G-44-2b
  truth: "（观察项，非本次报告）ac1be3ae 缓存目录 playlist_order 252 项但 segments 为空：webview 代理播放会登记清单索引但不落盘分片（与 G-44-2 webview 也走 proxy 的行为一致，属缓存仅独立窗口生效的边界表现）"
  status: failed
  reason: "Derived: meta.json 存在但 segments:{} total_size:0"
  severity: minor
  test: 2
  root_cause: "main.js m3u8 分支对所有 proxy 请求 touchVideo/updatePlaylistIndex，而分片 tee 落盘要求 vid/cache 参数（仅独立播放器 proxiedUrl 附加）——webview 播放会留下空索引 meta。"
  artifacts:
    - path: "main.js"
      issue: "清单索引登记不分播放来源，空 meta 副作用"
  missing:
    - "（随 G-44-2 一并决策）webview 回归直连后此副作用自然消失；或索引登记加 cache=1 条件"

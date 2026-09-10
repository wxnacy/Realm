---
phase: 44-player-video-cache-and-local-media-library
reviewed: 2026-09-07T09:10:00Z
depth: standard
scope: incremental re-review of gap-closure commits 44-14/44-15/44-16 (3914693..HEAD) — G-44-2 deferred-destroy + diagnostics, Electron 43.6.0 + UA/CH sync, wall-clock duration + drawer meta
files_reviewed: 9
files_reviewed_list:
  - ipc-handlers.js
  - src/renderer.js
  - main.js
  - package.json
  - ua-ch-manager.js
  - media-record-engine.js
  - tests/test-media-record-duration.js
  - src/player.js
  - src/player.css
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: findings
---

# Phase 44: Code Review Report（第三轮增量复评 44-14/44-15/44-16，3914693..HEAD）

**Reviewed:** 2026-09-07T09:10:00Z
**Depth:** standard
**Files Reviewed:** 9（本轮）
**Status:** issues_found（本轮 0 Critical / 2 Warning / 3 Info；前轮 CR-06、WR-07、IN-05~08 及更早 WR-A/B/C、IN-01/02 仍为未闭合债务，见下方存档段，本轮未重复计数）

## Summary

本轮评审对象是 44-14/44-15/44-16 三个 gap-closure 计划（commit 334adc3、662403c、d92dfeb、ed7d4d2、157d3e7、651b0cc、bbc4f56），逐 diff 追踪了三条改动链：① 播放器窗口 hide→300ms→close 延迟销毁（ipc-handlers.js）+ renderer webview guest 延迟销毁（renderer.js）+ dev-only 销毁诊断（main.js）；② Electron 43.3.0→43.6.0 与 UA/CH 全版本号常量同步（package.json/main.js/ua-ch-manager.js）；③ 运行中录制时长改挂钟差值（media-record-engine.js + 4 例新单测）+ 抽屉 meta 行时钟图标常显（player.js/player.css）。

**三条链的核心逻辑均验证正确**：

- **playerClosing 旁路标志正确**：`finish()` 内同步置位（早于定时器回调触发的 close 事件），延迟 close 经 :2099 守卫直接放行；`closed` handler 复位三态（playerWindow/playerContainerId/playerClosing），无重入确认序列路径。
- **renderer 延迟销毁无悬垂引用**：`destroyWebview` 先同步 `state.webviews.delete(tabId)`，延迟回调持有的旧元素引用被移除时不会误伤 300ms 内新建的同 id webview；`showWebview` 只遍历 `state.webviews`（已删），不会复活已隐藏元素。三处保持同步销毁（tab 回收/跨窗口移动×2）的判定标准注释与代码一致。
- **诊断门控**：main.js :526-542 仅 `NODE_ENV ∈ {development, debug}`，打包正式版（NODE_ENV undefined）与 Nightly（'nightly'）零输出；URL 取局部变量不在 destroyed 回调调 getURL，正确。
- **UA/CH 一致性**：`grep 150.0.7871.212` 在 main.js / ua-ch-manager.js / package.json / 源码树 **0 残留**（仅 `.claude/worktrees/` 三份陈旧 agent 工作区副本残留，非交付代码）；降维 UA `Chrome/150.0.0.0` 双文件冻结未动；main.js 注入头与 ua-ch-manager UA_METADATA 的 fullVersion/fullVersionList 三处同值 .250，品牌表顺序与 GREASE 未动。
- **两口径分离**：writeMeta 函数体零 diff（EXTINF 累计 + targetDuration 兜底逐字节不变，META_VERSION 未升）；`startedAt` 仅在 startRecord :113 一处赋值（`active.set` 唯一入口，无 undefined 路径）；终态回查分支 durationSeconds 返回 null，无口径跳变。实跑 `node tests/test-media-record-duration.js` 4/4 pass，六个改动源文件 `node --check` 全过。
- **Electron 43.6.0 API 兼容**：触点全部为稳定 API（`getType()`/`once('destroyed')`/`hide()`/`close()`/`dialog.showMessageBox`），43.x 补丁线无签名变更。

本轮发现集中在**延迟销毁序列的两个边角**（生产环境诊断日志未门控、300ms 窗口内的播放请求竞态）与三处低危健壮性项，无阻断性问题。

## Warnings

### WR-08: 播放器关闭诊断日志未做 NODE_ENV 门控——生产/Nightly 每次关播放器都向 stdout 打印含完整媒体 URL 的一行日志，与 44-14 自立的「dev-only 诊断」契约不一致

**File:** `ipc-handlers.js:2109-2117`
**Issue:** 44-14 Task 3（main.js :526-542）把销毁诊断明确定义为 dev/debug 专属（「生产/Nightly 环境零输出」），但同计划 Task 1 在 `finish()` 里加的关闭诊断日志 `console.log('[Realm] 播放器窗口关闭销毁 webContents id=… url=…')` **没有任何 NODE_ENV 判断**，生产版与 Nightly 版每次关闭播放器窗口都会输出。失败场景：① 打包版日志里持续出现诊断噪音，且 `getURL()` 取到的是播放器页 URL（`http://localhost:{port}/player/?{playParams}`，携带媒体 URL 与容器参数；媒体 URL 常含签名 token/防盗链参数），URL 随 stdout 落入系统日志/崩溃报告收集渠道即敏感信息外泄面；② 同一计划内两条诊断链一条门控一条不门控，后续维护者无法从代码判断哪个是既定语义。
**Fix:** 与 main.js 同款门控：

```js
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
  try {
    if (playerWindow && !playerWindow.isDestroyed()) {
      console.log(`[Realm] 播放器窗口关闭销毁 webContents id=${playerWindow.webContents.id} url=${playerWindow.webContents.getURL()}`);
    }
  } catch (diagErr) {
    console.warn('[Realm] 播放器窗口销毁诊断日志失败:', diagErr.message);
  }
}
```

### WR-09: 300ms 延迟销毁窗口内 `media:play` 复用分支不检查 `playerClosing`——新播放请求被发给一个已被判死刑的隐藏窗口，静默丢失

**File:** `ipc-handlers.js:2039-2045`（复用分支）；`ipc-handlers.js:2123-2135`（延迟关闭）
**Issue:** `finish()` 先 `hide()` 再 300ms 后 `close()`，窗口在这 300ms 内仍存活且 `playerWindow` 引用有效。此窗口期内用户在主窗口点播任意视频：复用分支条件 `playerWindow && !playerWindow.isDestroyed()` 通过 → `send('media:play-url')` 发给隐藏窗口 + `focus()`（对隐藏窗口无效）→ 返回 `reused: true`；随后定时器触发 `close()`（playerClosing=true 旁路放行）把刚载入播放数据的窗口销毁。用户视角：点了播放、什么都没发生（无新窗口、无报错），必须再点一次。竞态窗口 = 300ms + 关闭序列前置时长（ack 最多 500ms 后才 hide，用户在 hide 后 300ms 内点击均可命中），快速连续操作（关闭播放器→立刻换下一个视频）真实可达。
**Fix:** 复用分支把 `playerClosing` 纳入判定，二选一：

```js
// 方案 A（推荐）：把延迟 close 的 timer id 提升为模块级 pendingPlayerCloseTimer，
// 复用时取消销毁并恢复窗口
if (playerWindow && !playerWindow.isDestroyed()) {
  if (playerClosing) {
    clearTimeout(pendingPlayerCloseTimer);
    playerClosing = false;
    if (!playerWindow.isVisible()) playerWindow.show();
  }
  /* 原复用逻辑 */
}
// 方案 B：playerClosing=true 时视为不可复用，走新建窗口分支
//（需先把旧 playerWindow 置 null 并交给延迟 close 自然收尾）
```

## Info

### IN-09: 延迟 close 的 timer 未存句柄——窗口期内任何其他 `close()` 调用方（`player:close` IPC、退出流程）经 playerClosing 旁路**同步**销毁，恰好复刻 G-44-2 要规避的同步销毁窗口

**File:** `ipc-handlers.js:2129-2135`；`ipc-handlers.js:2508-2511`
**Issue:** 定时器句柄未保存（无法取消/提前放行），且 playerClosing 置位后 `player:close`（:2508 `win.close()`）与 app 退出 teardown 的 close 事件都会经 :2099 守卫旁路**立即**关闭窗口——同步 destroy。可达性低（窗口已 hide，renderer 无输入入口；退出路径的键盘 ACK 场景本就不成立），故仅记 Info，但它与 WR-09 同根：playerClosing 被当作「关闭流程所有权标志」用了两个语义（防重入确认 + 旁路放行），旁路放行意味着**放弃**延迟规避。
**Fix:** 修 WR-09 方案 A 时顺带把 timer 提升为模块级 `pendingPlayerCloseTimer`，并在 `player:close` handler / 退出路径文档注释里写明「绕过延迟销毁」的取舍；若想彻底闭合，`player:close` 可改为 `hide() + 同款延迟 close()`。

### IN-10: 300ms 魔数跨进程双份硬编码、无互引注释——改一处不改另一处会静默收窄规避窗口

**File:** `ipc-handlers.js:34`（`PLAYER_CLOSE_DESTROY_DELAY_MS = 300`）；`src/renderer.js:1809`（`deferredRemoveWebview(webviewEl, delayMs = 300)` 默认参数）
**Issue:** 主进程与 renderer 两端各有一份 300ms，跨进程无共享常量是客观限制，但两处注释均未互引「另一端也有同值副本」。未来若调大主进程延迟而 renderer 未同步（或反之），键盘 ACK 送达窗口以较小者为准，规避效果静默劣化且无任何报警。
**Fix:** 两处注释各加一行互引（如「与 ipc-handlers.js PLAYER_CLOSE_DESTROY_DELAY_MS 保持同值，G-44-2 键盘 ACK 送达窗口以两端较小者为准」），或主进程经 preload 常量下发。

### IN-11: 挂钟时长用 `Date.now()` 对系统时钟跳变不免疫——回拨被 Math.max 地板塌到 0、前拨永久虚高；测试 sleep 容差在慢 CI 有 flake 风险

**File:** `media-record-engine.js:299, 335`；`tests/test-media-record-duration.js:58-67`
**Issue:** ① 运行中录制期间用户手动改系统时间 / NTP 大步校时：时钟前拨 → `durationSeconds` 永久虚高（挂了 5 分钟显示 2 小时）；时钟回拨 → `Math.max(0, …)` 地板到 0（正在录制却显示 0 秒直到真实时间追上 startedAt）。显示层纯 cosmetic，不落盘（meta.json 口径独立），故 Info。② 测试 1 在 `sleep(1300)` 后断言 `durationSeconds >= 1 && <= 2`，容差上限余量仅 ~700ms；CI/负载高的机器 setTimeout 欠调度超 700ms 即 flake（本地实测 4/4 pass）。
**Fix:** ① 改单调时钟锚点：`startedAt = Date.now()` 保留 + `startedPerf = performance.now()`，差值用 `(Date.now() - startedAt)` 换成 `performance.now() - startedPerf`（Node 主进程有 performance 全局），显示层免疫校时；② 测试断言放宽为 `>= 1 && <= 4` 或改为「严格递增 + ≥1」的性质断言（测试 2 已是性质断言，不受影响）。

---

## 前轮存档：增量复评 44-09~44-13（bc62144..HEAD，2026-09-07T07:33:47Z，1 Critical / 1 Warning / 4 Info）

> 以下为第二轮评审结论原样保留，本轮未复验、未重复计数。**CR-06 的收尾 UAT 验证要求（真实源站直连播放）仍然有效。**

### Summary（前轮）

本轮评审对象是 44-09~44-13 五个 gap-closure 计划（G-44-2/2b/4a/4b/5/7/8/9）引入的改动（`git diff bc62144..HEAD`）。逐行追踪了 proxiedUrl 传输层守卫切换（player.js/main.js）、deleteByKey + player:cache:delete 联动（player-history-manager.js/ipc-handlers.js/preload.js/player.js）、sniffContainerFormat 四判定 + empty_output 终检（media-remuxer.js/main.js CONVERT_FAIL_TEXT）、mediaAPI.onMediaTaskChanged toast 链路（preload.js/renderer.js/main.css/index.html）、任务页反馈条（tasks.html/tasks-page.js/main.js）五条改动链。

**闭环质量总体良好**：deleteByKey SQL 参数化 + hex 入参豁免门严谨；嗅探检查点置于取消检查之后、push 之前（44-08 取消契约保序，有结构断言测试）；media-task:changed 广播链路（main.js:2108-2134 → preload.js mediaAPI → renderer.js）三端命名空间一致，G-44-7 命名空间错配确已修复；tasks-page 反馈条 textContent 写入 + CSS 类初始隐藏符合 realm:// CSP 约定；player.html 停止图标经 main.js HTTP 服务器提供（无 CSP 头，内联 display:none 合法）。本轮实跑全绿：test-media-remuxer 23/23、test-player-history 10/10、test-unified-navigation 32/32；8 个改动源文件 node --check 通过。

但 **44-09 的「webview tab 直连拉流」改动存在一条 Critical**（详见下节 CR-06）。

### Critical Issues（前轮）

#### CR-06: webview tab 播放器直连拉流的技术依据不成立——hls.js XHR 跨源受 CORS 约束，Referer 变为 localhost、容器 Cookie 不会携带（G-44-2 实现与自身注释矛盾）

**File:** `src/player.js:310-313, 327-336`；`main.js:669-671`；`src/renderer.js:339`
**Issue:** 44-09 把 `proxiedUrl` 守卫从 `isWebviewMode` 改为 `isIndependentMode` 后，webview tab 模式播放器（源为 `http://localhost:{realmPort}`，main.js:678）对源站 m3u8/分片/密钥的 hls.js XHR 全部变为跨源直连。三条可证明的事实与新增注释（player.js:310-313「像网页自身播放一样直接访问源站，防盗链/Cookie 由 webview 容器 session 天然携带」）矛盾：

1. **CORS**：hls.js 用 XMLHttpRequest 拉清单/分片，这是 CORS 门控请求——与 `<video src>` 不同。webview 的 webpreferences 仅 `contextIsolation=yes`（renderer.js:339），webSecurity 默认开启，Chromium 会强制校验响应 `Access-Control-Allow-Origin`；源 `http://localhost:PORT` 对大多数视频 CDN 不在许可列表内，请求会被拦截。**被删除的旧注释原文就是「播放器页面源是 localhost，直接 XHR 外部视频源会被 CORS 拦截」**——/proxy 方案正是为解决它而建。新注释称「像网页自身播放一样」混淆了非 CORS 门控的原生媒体加载与 CORS 门控的 hls.js MSE 管线。
2. **Referer**：直连 XHR 的 Referer 是播放器页 `http://localhost:PORT/player/?...`，不再是源页面 URL——防盗链站点将直接拒绝；此前由 /proxy 的 referer 参数经主进程 ses.fetch 注入。main.js:677 的 referer 参数注释自己写明「独立窗口 /proxy 链路使用」，即 webview 链路已无 Referer 补偿。
3. **Cookie**：跨源 XHR 默认不带凭据（hls.js `new Hls({ enableWorker: true })`（player.js:179）未设 withCredentials/xhrSetup），容器 session 里该 CDN 域的 Cookie 不会随请求发送——「天然携带」不成立。Cookie 门控的流（登录态 CDN）将 403/401。

影响面：webview tab 模式是 will-navigate m3u8 拦截后的唯一播放形态（main.js:665-690），即 **G-44-2 修复后该入口对所有「无 ACAO 头 / Referer 校验 / Cookie 门控」源站的播放能力回归为不可用**。D-01 是用户锁定决策，44-09-SUMMARY 也如实标注真实源站直连播放属人工 UAT 待验项（coverage D1，human_judgment: true，UAT 第 2 项留待收尾）；但 UAT 若只在开放 CORS 的测试源上验证，该回归不会被暴露。
**Fix:** 收尾 UAT 第 2 项必须使用一个同时满足「不发 ACAO + 校验 Referer + 需 Cookie」的真实源站验证；若确认失败，三选一：
① 主进程对「播放器页 origin（`http://localhost:PORT`）发起的源站媒体请求」做补偿：`ses.webRequest.onHeadersReceived` 为命中 `/proxy` 之外的目标补 `Access-Control-Allow-Origin`，`onBeforeSendHeaders` 按 m3u8 包装时记录的 referer 参数回写 Referer 并携带容器 Cookie（保持 D-01 直连语义，传输补偿在 webRequest 层）；
② 回退守卫（webview 模式恢复走 /proxy），D-01 的诉求改由其他方式满足；
③ 至少立即修正 player.js:310-313 / main.js:669-671 / renderer.js:387-390 三处注释的错误声明（Cookie「天然携带」、「像网页自身播放一样」），避免后续维护者据错误注释做决策——按 navigation-entry-points.md §五「两处注释互引」约定，注释同步是本项目的强制纪律。

### Warnings（前轮）

#### WR-07: 嗅探判定①仅校验首字节——前导 ID3/timestamp 包的合法 MPEG-TS 分片会被误判拒转（相对嗅探前的行为回归）

**File:** `media-remuxer.js:114, 116-135`
**Issue:** 判定① `buf[0] === 0x47` 只认第一个字节。部分 HLS 分片器会在 TS 流首部前置 ID3/timed-metadata PES 包（Apple HLS 的 TIMED-METADATA 惯例，mux.js 自身支持解析 TS 内 ID3），此时首字节是 `'I'`（0x49）而非 0x47——这类**完全合法且此前可正常转封装**的 TS 分片会落到判定②/④：若 64KB 内恰好含 box 特征 ASCII（如 ID3 文本帧内容）误判 `unsupported_container`（fMP4），否则被判定④「未知分片格式，仅支持 MPEG-TS」一律拒转。44-11 之前无嗅探，这些分片都能转换；本改动对它们是纯回归。test-media-remuxer 的「0x47 放行」用例只覆盖了首字节恰为 0x47 的形态，未覆盖 ID3 前导形态。
**Fix:** 判定①放宽为 188 字节周期同步字节扫描：在缓冲区前 ~2×188 字节内寻找满足 `buf[i] === 0x47 && (i % 188 === 0)` 或连续两个 0x47 间隔 188 的位置即放行；同时判定②的 box 特征检索应限定在 box 起始偏移（`buf.readUInt32BE(0) === 期望size` 且 `buf.subarray(4,8)` 命中 tag），而不是全缓冲 `indexOf`，降低 payload ASCII 误报。补一条「ID3 前导 TS 放行」用例。

**状态注记（2026-09-10，暂缓修复/记债）：** 逐行复核后确认代码事实成立（判定①仅 `buf[0] === 0x47`、判定②全缓冲 `indexOf`），但「首字节非 0x47 的 ID3 前导**合法** TS 分片」这一前提**未找到真实源站样本佐证**——TS 是 188 字节定长包，ID3/timed-metadata 通常作为 PES 仍在 0x47 包内，首字节游离于同步字节之外属罕见形态。故按**理论回归风险**而非确证缺陷处理，用户 2026-09-10 决定暂缓修复（与 Phase 28 DASH gap 同款 deferred 记法）。判定①的宽松语义与判定②的 payload ASCII 误报面**保持不变**；若后续出现真实误拒样本，按上方 Fix 修复并补「ID3 前导 TS 放行」用例。

### Info（前轮）

#### IN-05: 首分片读取失败被映射为 `unsupported_container`，与既有 `segment_missing` 语义重叠且误导

**File:** `media-remuxer.js:88-91`
**Issue:** `sniffContainerFormat` 的 open/read 失败统一返回 `remuxError('unsupported_container', '分片读取失败: ...')`。循环前置的 existsSync 校验（:179-184）已排除「转封装启动时缺失」，但存在性校验与嗅探之间存在 TOCTOU 窗口（分片被淘汰/清理），权限异常也会走到这里——这些情况报「分片格式暂不支持转换」会误导用户与排查。任务页文案（main.js CONVERT_FAIL_TEXT）按 reason 取「分片格式暂不支持转换（仅支持 MPEG-TS）」，与实际失败原因（文件消失/无权限）不符。
**Fix:** 读取失败按 `err.code === 'ENOENT'` 区分：ENOENT → 复用 `segment_missing`（已有「分片文件缺失」文案），其他 IO 错误 → 新 reason `sniff_read_failed` 或直接复用 `transmux_failed` 语义，附原始 err.message。

#### IN-06: `deleteEntry=true` 时观看历史删除失败/未命中对用户完全静默——确认框承诺「同时删除观看历史」可能未兑现

**File:** `ipc-handlers.js:2331-2341`；`src/player.js:1104-1114`
**Issue:** IPC 层已把 `historyDeleted` 计入返回值（`{ ...r, historyDeleted: !!historyDeleted }`），但 player.js 的 confirm 处理器拿到结果后除 `renderDrawer()` 外不消费 `historyDeleted`——当缓存目录本就不存在（`deleteEntry` 对缺失目录也返回 success）但 `deleteByKey` 因 db 异常返回 false 时，用户在勾选「同时删除条目（含观看历史）」后条目从抽屉消失、历史记录却残留，无任何提示；下次同 URL 播放续播进度「复活」。
**Fix:** confirm 处理器读取返回值的 `historyDeleted`，为 false 且 `deleteEntry===true` 时经既有错误提示通道（showError 或 toast）提示「观看历史删除失败」。

#### IN-07: 终态 toast 文案与系统通知契约并不完全一致——record 失败缺「录制失败：」前缀、basename 逻辑分叉

**File:** `src/renderer.js:10580-10613`
**Issue:** initMediaTaskToast 注释声称「文案与 main.js showTaskNotification 标题契约一致」，实际两处分叉：① record **failed** 时 toast 直接用 `task.error`（:10599），而 showTaskNotification 对 record failed 加「录制失败：」前缀（main.js:2079）——convert 的 error 确实自带前缀（44-05），record 的不带；② convert completed 的文件名提取用 `task.outputPath.split('/').pop()`（:10591），main.js:2072 用 `path.basename`——行为在 POSIX 下等价，但两份实现并存违背「一处逻辑一份实现」，未来路径语义变化（如 Windows 支持）时只改一处必出分叉。
**Fix:** record failed 分支补齐「录制失败：」前缀（或抽公共文案函数）；basename 提取若无法从主进程透传，至少在注释里互引两处同步（同 navigation-entry-points.md 的双份注释纪律）。

#### IN-08: `no_segments` 续转失败文案过拟合「崩溃」单一成因

**File:** `main.js:2286`
**Issue:** 44-13 把 `/api/tasks/resume-convert` 对 `reason === 'no_segments'` 的报错写死为「录制中崩溃的任务暂无分片索引，暂不支持续转」。但 `startConvertFromRecordTask`（main.js:3168-3169）返回 `no_segments` 的条件是 `readRecordTaskSegments` 返回 null——除崩溃缺 meta（WR-C 场景）外，meta 存在但 segments 目录为空/索引为空数组同样返回 null。后者弹出的文案「录制中崩溃的任务…」与事实不符（任务可能只是正常录了 0 秒）。属文案精度问题，G-44-9 的可见性目标本身已达成。
**Fix:** 文案改为覆盖两种成因的中性表述，如「该任务没有可转换的分片索引（录制中崩溃或未录到有效分片），暂不支持续转」。

## 历史段（更早前轮评审结论存档，非本轮产出）

以下为第一轮（44-06/44-07/44-08 gap-closure 复审，fdb7848..HEAD，2026-09-06T14:49:43Z）的既有发现，属已知技术债，后续轮未复验、未重复计数：

- **WR-A**（media-cache-manager.js:444-458）：单视频超限场景写路径水位淘汰无退避，每分片触发全库扫描。
- **WR-B**（main.js:2179-2189）：cancel 路由非 running 分支含不可达 200 死代码，对已终态任务恒 400，与 record 分支幂等语义不一致。
- **WR-C**（main.js:3031-3044 等）：硬崩溃 interrupted 任务无 meta.json，续转 400 no_segments 仍未闭合——44-13 的 IN-08 文案改动是 WR-C 的 UX 兜底（G-44-9），WR-C 本体仍按 2026-09-07 UAT 决策记债。
- **IN-01**（media-cache-manager.js）：lookup/store 形参与 JSDoc 仍称 `finalUrl`，语义漂移。
- **IN-02**（main.js:3147-3153）：`.finally` 内 try/catch 包裹不会抛错的 `Map.delete`。

更早的 WR-01~WR-05、IN-03/04 不在后续轮文件范围，未逐一复验。

## 附：本轮（44-14/44-15/44-16）范围与证据说明

- diff 范围：3914693..HEAD 中七个代码 commit（334adc3 / 662403c / d92dfeb / ed7d4d2 / 157d3e7 / 651b0cc / bbc4f56），逐 `git show` 逐行核对。
- 实跑：`node tests/test-media-record-duration.js` 4/4 pass；ipc-handlers.js / main.js / media-record-engine.js / ua-ch-manager.js / src/player.js `node --check` 全过。
- 跨文件核查确认的正确项（不报但记录）：renderer `state.webviews` 先删后延删的引用安全模型（WR-09/IN-09 之外无悬垂引用路径）；`showWebview`/`handleTabRecycled`/`handleTabRemovedFromMain`/initTabDragAndDrop 四处与延迟销毁的交互均经 `state.webviews` Map 门控，不会触碰已隐藏元素；main.js 诊断块置于 webview 类型早退之前、单次注册、监听随 contents 生命周期消亡无累积；ua-ch-manager UA_METADATA 与 main.js session-created 注入头三处同值 .250；`getRecordStatus` 终态分支 `durationSeconds: null` 无运行→终态口径跳变；player.js `watchedIcon` 经 `if (watched)` 守卫、时间文本走 `createTextNode`（无注入面）、innerHTML 仅为静态 SVG 字面量；`grep 150.0.7871.212` 源码树 0 残留（`.claude/worktrees/` 三份陈旧 agent 工作区副本命中，非交付代码，建议顺手清理防误导后续 grep 审计）。
- 本轮未发现前轮 Critical（CR-01~CR-06）以任何形式在本轮 diff 中复发。

---

_Reviewed: 2026-09-07T09:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

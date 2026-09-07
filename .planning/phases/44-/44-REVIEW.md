---
phase: 44-player-video-cache-and-local-media-library
reviewed: 2026-09-07T07:33:47Z
depth: standard
scope: incremental re-review of gap-closure commits 44-09~44-13 (bc62144..HEAD) — G-44-2/2b/4a/4b/5/7/8/9
files_reviewed: 16
files_reviewed_list:
  - main.js
  - ipc-handlers.js
  - media-remuxer.js
  - player-history-manager.js
  - src/player.js
  - src/player.html
  - src/player.css
  - src/preload.js
  - src/renderer.js
  - src/index.html
  - src/styles/main.css
  - src/tasks.html
  - src/tasks-page.js
  - docs/product/navigation-entry-points.md
  - tests/test-media-remuxer.js
  - tests/test-player-history.js
findings:
  critical: 1
  warning: 1
  info: 4
  total: 6
status: issues_found
---

# Phase 44: Code Review Report（增量复评 44-09~44-13，bc62144..HEAD）

**Reviewed:** 2026-09-07T07:33:47Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found（本轮 1 Critical / 1 Warning / 4 Info；前轮 WR-A/B/C、IN-01/02 为已知债务，见文末历史段，本轮不重复）

## Summary

本轮评审对象是 44-09~44-13 五个 gap-closure 计划（G-44-2/2b/4a/4b/5/7/8/9）引入的改动（`git diff bc62144..HEAD`）。逐行追踪了 proxiedUrl 传输层守卫切换（player.js/main.js）、deleteByKey + player:cache:delete 联动（player-history-manager.js/ipc-handlers.js/preload.js/player.js）、sniffContainerFormat 四判定 + empty_output 终检（media-remuxer.js/main.js CONVERT_FAIL_TEXT）、mediaAPI.onMediaTaskChanged toast 链路（preload.js/renderer.js/main.css/index.html）、任务页反馈条（tasks.html/tasks-page.js/main.js）五条改动链。

**闭环质量总体良好**：deleteByKey SQL 参数化 + hex 入参豁免门严谨；嗅探检查点置于取消检查之后、push 之前（44-08 取消契约保序，有结构断言测试）；media-task:changed 广播链路（main.js:2108-2134 → preload.js mediaAPI → renderer.js）三端命名空间一致，G-44-7 命名空间错配确已修复；tasks-page 反馈条 textContent 写入 + CSS 类初始隐藏符合 realm:// CSP 约定；player.html 停止图标经 main.js HTTP 服务器提供（无 CSP 头，内联 display:none 合法）。本轮实跑全绿：test-media-remuxer 23/23、test-player-history 10/10、test-unified-navigation 32/32；8 个改动源文件 node --check 通过。

但 **44-09 的「webview tab 直连拉流」改动存在一条 Critical**：其代码注释给出的技术依据（Cookie/防盗链「天然携带」）与浏览器网络栈的实际行为不符——hls.js XHR 从 localhost 源发起跨源请求仍受 CORS 约束（webview 未关 webSecurity），这是被删除的旧 /proxy 方案明确记载要解决的问题。该行为是 D-01 用户锁定决策，但对应的人工 UAT 项（44-09-SUMMARY coverage D1：真实源站直连播放）仍处于待验证状态，收尾 UAT 必须在「无 CORS 头 + Referer 校验 + Cookie 门控」的真实源站上验证，不能只测开放 CORS 的站点。

## Critical Issues

### CR-06: webview tab 播放器直连拉流的技术依据不成立——hls.js XHR 跨源受 CORS 约束，Referer 变为 localhost、容器 Cookie 不会携带（G-44-2 实现与自身注释矛盾）

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

## Warnings

### WR-07: 嗅探判定①仅校验首字节——前导 ID3/timestamp 包的合法 MPEG-TS 分片会被误判拒转（相对嗅探前的行为回归）

**File:** `media-remuxer.js:114, 116-135`
**Issue:** 判定① `buf[0] === 0x47` 只认第一个字节。部分 HLS 分片器会在 TS 流首部前置 ID3/timed-metadata PES 包（Apple HLS 的 TIMED-METADATA 惯例，mux.js 自身支持解析 TS 内 ID3），此时首字节是 `'I'`（0x49）而非 0x47——这类**完全合法且此前可正常转封装**的 TS 分片会落到判定②/④：若 64KB 内恰好含 box 特征 ASCII（如 ID3 文本帧内容）误判 `unsupported_container`（fMP4），否则被判定④「未知分片格式，仅支持 MPEG-TS」一律拒转。44-11 之前无嗅探，这些分片都能转换；本改动对它们是纯回归。test-media-remuxer 的「0x47 放行」用例只覆盖了首字节恰为 0x47 的形态，未覆盖 ID3 前导形态。
**Fix:** 判定①放宽为 188 字节周期同步字节扫描：在缓冲区前 ~2×188 字节内寻找满足 `buf[i] === 0x47 && (i % 188 === 0)` 或连续两个 0x47 间隔 188 的位置即放行；同时判定②的 box 特征检索应限定在 box 起始偏移（`buf.readUInt32BE(0) === 期望size` 且 `buf.subarray(4,8)` 命中 tag），而不是全缓冲 `indexOf`，降低 payload ASCII 误报。补一条「ID3 前导 TS 放行」用例。

## Info

### IN-05: 首分片读取失败被映射为 `unsupported_container`，与既有 `segment_missing` 语义重叠且误导

**File:** `media-remuxer.js:88-91`
**Issue:** `sniffContainerFormat` 的 open/read 失败统一返回 `remuxError('unsupported_container', '分片读取失败: ...')`。循环前置的 existsSync 校验（:179-184）已排除「转封装启动时缺失」，但存在性校验与嗅探之间存在 TOCTOU 窗口（分片被淘汰/清理），权限异常也会走到这里——这些情况报「分片格式暂不支持转换」会误导用户与排查。任务页文案（main.js CONVERT_FAIL_TEXT）按 reason 取「分片格式暂不支持转换（仅支持 MPEG-TS）」，与实际失败原因（文件消失/无权限）不符。
**Fix:** 读取失败按 `err.code === 'ENOENT'` 区分：ENOENT → 复用 `segment_missing`（已有「分片文件缺失」文案），其他 IO 错误 → 新 reason `sniff_read_failed` 或直接复用 `transmux_failed` 语义，附原始 err.message。

### IN-06: `deleteEntry=true` 时观看历史删除失败/未命中对用户完全静默——确认框承诺「同时删除观看历史」可能未兑现

**File:** `ipc-handlers.js:2331-2341`；`src/player.js:1104-1114`
**Issue:** IPC 层已把 `historyDeleted` 计入返回值（`{ ...r, historyDeleted: !!historyDeleted }`），但 player.js 的 confirm 处理器拿到结果后除 `renderDrawer()` 外不消费 `historyDeleted`——当缓存目录本就不存在（`deleteEntry` 对缺失目录也返回 success）但 `deleteByKey` 因 db 异常返回 false 时，用户在勾选「同时删除条目（含观看历史）」后条目从抽屉消失、历史记录却残留，无任何提示；下次同 URL 播放续播进度「复活」。
**Fix:** confirm 处理器读取返回值的 `historyDeleted`，为 false 且 `deleteEntry===true` 时经既有错误提示通道（showError 或 toast）提示「观看历史删除失败」。

### IN-07: 终态 toast 文案与系统通知契约并不完全一致——record 失败缺「录制失败：」前缀、basename 逻辑分叉

**File:** `src/renderer.js:10580-10613`
**Issue:** initMediaTaskToast 注释声称「文案与 main.js showTaskNotification 标题契约一致」，实际两处分叉：① record **failed** 时 toast 直接用 `task.error`（:10599），而 showTaskNotification 对 record failed 加「录制失败：」前缀（main.js:2079）——convert 的 error 确实自带前缀（44-05），record 的不带；② convert completed 的文件名提取用 `task.outputPath.split('/').pop()`（:10591），main.js:2072 用 `path.basename`——行为在 POSIX 下等价，但两份实现并存违背「一处逻辑一份实现」，未来路径语义变化（如 Windows 支持）时只改一处必出分叉。
**Fix:** record failed 分支补齐「录制失败：」前缀（或抽公共文案函数）；basename 提取若无法从主进程透传，至少在注释里互引两处同步（同 navigation-entry-points.md 的双份注释纪律）。

### IN-08: `no_segments` 续转失败文案过拟合「崩溃」单一成因

**File:** `main.js:2286`
**Issue:** 44-13 把 `/api/tasks/resume-convert` 对 `reason === 'no_segments'` 的报错写死为「录制中崩溃的任务暂无分片索引，暂不支持续转」。但 `startConvertFromRecordTask`（main.js:3168-3169）返回 `no_segments` 的条件是 `readRecordTaskSegments` 返回 null——除崩溃缺 meta（WR-C 场景）外，meta 存在但 segments 目录为空/索引为空数组同样返回 null。后者弹出的文案「录制中崩溃的任务…」与事实不符（任务可能只是正常录了 0 秒）。属文案精度问题，G-44-9 的可见性目标本身已达成。
**Fix:** 文案改为覆盖两种成因的中性表述，如「该任务没有可转换的分片索引（录制中崩溃或未录到有效分片），暂不支持续转」。

---

## 历史段（前轮评审结论存档，非本轮产出）

以下为前轮（44-06/44-07/44-08 gap-closure 复审，fdb7848..HEAD，2026-09-06T14:49:43Z）的既有发现，属已知技术债，本轮未复验、未重复计数：

- **WR-A**（media-cache-manager.js:444-458）：单视频超限场景写路径水位淘汰无退避，每分片触发全库扫描。
- **WR-B**（main.js:2179-2189）：cancel 路由非 running 分支含不可达 200 死代码，对已终态任务恒 400，与 record 分支幂等语义不一致。
- **WR-C**（main.js:3031-3044 等）：硬崩溃 interrupted 任务无 meta.json，续转 400 no_segments 仍未闭合——**注意：本轮 44-13 的 IN-08 文案改动正是 WR-C 的 UX 兜底（G-44-9），WR-C 本体仍按 2026-09-07 UAT 决策记债**。
- **IN-01**（media-cache-manager.js）：lookup/store 形参与 JSDoc 仍称 `finalUrl`，语义漂移。
- **IN-02**（main.js:3147-3153）：`.finally` 内 try/catch 包裹不会抛错的 `Map.delete`。

前轮更早的 WR-01~WR-05、IN-03/04 不在本轮文件范围，未逐一复验。

## 附：范围与证据说明

- diff 基准：bc62144..HEAD（44-09~44-13 五计划 28 个 commit；diff_base 56962a09 为阶段起点备查）。
- 实跑：`node tests/test-media-remuxer.js` 23/23、`node tests/test-player-history.js` 10/10、`node tests/test-unified-navigation.js` 32/32 全绿；main.js / ipc-handlers.js / media-remuxer.js / player-history-manager.js / src/player.js / src/renderer.js / src/preload.js / src/tasks-page.js node --check 通过。
- 跨文件核查确认的正确项（不报但记录）：mediaCache.deleteEntry 为同步返回对象（media-cache-manager.js:567-578），IPC 层 `r.success` 门判定有效；preload 仅 mediaAPI 命名空间暴露 onMediaTaskCountChanged/onMediaTaskChanged，无 realmAPI 死代码残留；player.html 由 main.js HTTP 服务器提供且无 CSP 头，icon-stop 内联 style 合法；.toast-clickable 以 (0,2,0) 特异度覆盖 .toast 基类 pointer-events:none（main.css:1445/1475），偏移修复有效；deleteByKey 参数化 SQL 且 player:cache:delete 的 hex 入参豁免门防住「playbackKey 恰似 16 位 hex」的误判（playbackKey 恒含 `://`）。
- 本轮未发现前轮五条 Critical（CR-01~CR-05）以任何形式复发。

---

_Reviewed: 2026-09-07T07:33:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 44-player-video-cache-and-local-media-library
reviewed: 2026-09-06T13:40:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - main.js
  - ipc-handlers.js
  - media-cache-manager.js
  - player-history-manager.js
  - media-m3u8-parser.js
  - media-task-manager.js
  - media-record-engine.js
  - media-remuxer.js
  - src/player.js
  - src/player.html
  - src/player.css
  - src/tasks.html
  - src/tasks-page.js
  - src/preload.js
  - src/renderer.js
  - src/settings-page.js
  - src/settings.html
  - src/styles/main.css
  - package.json
findings:
  critical: 5
  warning: 6
  info: 4
  total: 15
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-09-06T13:40:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 44 delivers the /proxy segment disk cache, watch history & resume, live recording, mux.js remux, and the media task center. The module decomposition is sound (去 Electron 化 pure-Node modules, path-safety via hex whitelists + realpath recheck, task state machine with restore whitelist), and the reviewed unit tests cover the pure-logic layers well.

However, adversarial tracing of the runtime wiring surfaced **5 Critical defects**: the disk cache never avoids origin fetches (so D-05「重开秒开不重复请求」and D-10「断网已缓存分片照播」are both inoperative), the 10GB capacity FIFO eviction (D-06/D-07) never runs in production, crash-interrupted recordings cannot be resume-converted (D-18「崩溃不白录」broken), the task-page stop button on a running recording never actually stops the recording engine (unbounded disk growth), and an unhandled stream error in the new cache tee path can crash the main process. Several are visible only by cross-checking integration points in main.js against the pure modules — the per-module tests all pass while these integration behaviors fail.

No hardcoded secrets, no path traversal, no SQL injection found; token auth is consistently applied on /proxy and all /api/tasks/* endpoints; sanitizeFilename/`<seq>.ts`/sha256-hex naming closes the path-injection surface; the delete-confirm dialog follows the centered-dialog convention.

## Critical Issues

### CR-01: 缓存命中仍先回源——「重开秒开/不重复请求」与「断网照播」均不成立（D-05/D-10 违约）

**File:** `main.js:352-408`
**Issue:** `handleProxyRequest` 中 `ses.fetch(target)`（:356）先于任何缓存查询执行；`mediaCache.lookup(finalUrl, vid)`（:390）在 fetch 成功**之后**才做。缓存命中时用缓存数据响应、丢弃刚拉回的 `resp.body`（不消费也不 cancel）；未命中时 tee 落盘。结果是：
1. 每个分片请求必然打一次源站——缓存层零省流量、零「重开秒开」收益（D-05/D-10 的核心目标落空）；
2. 断网/源站失效时 `ses.fetch` 直接 throw 进 ：429 的 catch 返回 502，**缓存里有分片也照样播放失败**——player.js:188-200 精心实现的「D-10 已缓存分片照播」降级链路（fatal network error → banner → startLoad 重试）永远拿不到缓存数据，注释宣称的「缓存读盘链路天然生效」不成立；
3. 命中路径上未消费的 `resp.body` 使底层连接悬挂（undici/网络服务需 body 被消费或取消才能复用 socket），高频命中时泄漏连接。

**Failure scenario:** 用户看完一个视频关闭播放器，重开同一视频（有完整缓存）：所有分片仍逐个回源，源站临时 5xx/断网时播放器报「HLS 播放失败」而非降级提示条——D-10 验收必失败。

**Fix:**
```js
// 在 ses.fetch 之前先查缓存；cache key 改用请求 URL（target）而非重定向后 finalUrl，
// store/lookup 两端统一用同一 key（如需防重定向漂移，可命中后校验 meta 记录的最终 URL）
if (cacheEnabled && mediaCache && !isM3u8Likely(target) && !req.headers.range) {
  const vid = reqUrl.searchParams.get('vid') || '';
  if (/^[a-f0-9]{16}$/.test(vid)) {
    const hit = mediaCache.lookup(target, vid);   // 先查缓存
    if (hit) { /* 200 + hit.data 直接返回，不发起 ses.fetch */ return; }
  }
}
const resp = await ses.fetch(target, { headers });  // 未命中才回源
```
分片 URL 是否「可能是 m3u8」可先按扩展名/CT 预判，m3u8 仍走现清单分支；命中失败（校验删片）再回源即可。

### CR-02: 容量 FIFO 淘汰（D-06/D-07）在生产路径从不执行——缓存只增不减直到物理磁盘写满

**File:** `media-cache-manager.js:424-442`（`_writeWithEvictRetry`，`evictIfNeeded` 唯一调用点 ：432）、`main.js:1340`
**Issue:** `evictIfNeeded` 只在写盘收到 `ENOSPC/EDQUOT`（**物理磁盘**满）时被触发。`capacityBytes`（10GB 上限）只在 `evictIfNeeded` 内部做阈值比较，而生产代码中没有任何「总量超 capacityBytes 主动淘汰」的调用（tests 直接调 `evictIfNeeded` 所以单测全绿，掩盖了缺线）。设置页改小 `cacheMaxGB` 时仅更新 `capacityBytes`（main.js:1337-1342），同样不触发一轮淘汰。

**Failure scenario:** 磁盘剩余 500GB、上限 10GB：用户看过的所有视频分片永久累积，直到 500GB 物理空间耗尽，此时强淘按 capacityBytes 阈值也只删到 10GB 以下——「按最后观看 FIFO 淘汰、活跃任务豁免」的 D-06/D-07 语义从未按设计生效；D-08「写盘失败先强淘」也在远晚于预期的时间点才介入。

**Fix:**
```js
// storeBuffer 落盘登记成功后主动做一轮容量检查：
this._writeMeta(videoId, mMeta);
try { this.evictIfNeeded(new Set([videoId])); } catch { /* 淘汰失败不影响写入 */ }
return { ok: true, size };
```
（evictIfNeeded 内部已有 `total <= capacityBytes` 短路，写每片后调用的开销 = 一次 listEntries 目录扫描；若担心开销可改为每 N 片或容量水位触发。）另在 main.js:1337 改小容量后同步调用一次 `mediaCache.evictIfNeeded()`。

### CR-03: 崩溃中断的录制无法「已落盘部分续转」——outputPath 到终态才落库，interrupted/failed 任务必为 null（D-18「崩溃不白录」违约）

**File:** `media-task-manager.js:116-128`（registerTask `outputPath: null`）、`media-record-engine.js:167-192/269-277`、`main.js:2914-2931`（`readRecordTaskSegments`）、`main.js:2163-2193`（convert-resume）
**Issue:** record 任务的 `outputPath` 只在 `completeTask({ outputPath })`（正常停止/VOD 录完）时写入。录制中崩溃/被杀 → 重启 `restoreTasks` 把 running 恢复为 interrupted，但保存的 JSON 里 `outputPath` 仍是 null；`failTask`（网络停录）路径同样不写 outputPath。而任务页对 interrupted/failed record 展示「已落盘部分续转」按钮（tasks-page.js:273-277），点击后 `convert-resume` → `readRecordTaskSegments(task)` 因 `task.outputPath` 为 null 直接返回 null → 400 `no_segments`。meta.json 明明已在录制目录 `media-records/<taskId>/` 写好（stop/fail 双路径都写），却因没有 taskId→目录的映射而读不到。

**Failure scenario:** 录制 2 小时后应用崩溃，重启后任务页显示「已中断 · 已落盘部分续转」按钮，点击永远报「续转失败」——大量已落盘分片实际可转却无法消费，D-18 兜底承诺（SUMMARY/CONTEXT 反复强调的「崩溃不白录」）不成立。

**Fix（最小改动）:** convert-resume 与 startConvertFromInput 的 taskId 分支里，outputPath 缺失时按注册表惯例补算：
```js
// main.js startConvertFromRecordTask 内
const recordDir = task.outputPath || path.join(app.getPath('userData'), 'media-records', task.id);
```
（recordRoot 需与 createRecordEngine 注入值同源，建议提取常量。）更彻底的做法是 registerTask 时即写 outputPath（注册即知目录）。

### CR-04: 任务页「停止」对运行中录制无效——/api/tasks/cancel 只改注册表状态，录制引擎继续轮询落盘

**File:** `main.js:2121-2138`（cancel 端点）、`media-task-manager.js:177-182`（cancelTask）、`media-record-engine.js:198-256`（pollLoop）
**Issue:** `/api/tasks/cancel` 调 `mediaTaskManager.cancelTask(taskId)` 把注册表条目置为 cancelled——但 `media-record-engine` 的 `active` Map 与 pollLoop 与注册表之间没有取消联动：轮询循环继续拉清单、下载分片、写盘；`updateProgress` 因任务已终态 throw 被逐片 catch 吞掉，循环永不停歇。也没有任何 hook 把 cancel 事件转发给 recordEngine.stopRecord。convert 任务同病：cancel 后 `convertToMp4` 继续转完、`completeTask` 再 throw 被吞。

**Failure scenario:** 用户在任务页对运行中的直播录制点「停止」→ 状态徽标变「已取消」，但录制实际永不停止：每 targetDuration 拉清单、无限落盘写满磁盘，且因为任务已终态、meta.json 永远不会写、产物无法续转。对长直播这是无上限的磁盘消耗 + 完全失真的任务状态。

**Fix:** 在 main.js 集成层把 cancel 桥接到引擎：
```js
// main.js，registerTask 持有后：取消 record 任务时先停引擎再流转注册表
if (route === 'cancel' && req.method === 'POST') {
  // ...
  const t = mediaTaskManager.listTasks().find((x) => x.id === taskId);
  if (t && t.type === 'record' && t.status === 'running') {
    await recordEngine.stopRecord(taskId);   // 写 meta.json + completeTask
    // 引擎已 completeTask 则无需再 cancelTask；仅引擎返回 not_found 时走 cancelTask
  }
}
```
convert 任务则需给 convertToMp4 增加取消信号（ aborted 标志 → onProgress 里检查并提前 reject + 清理半成品）。

### CR-05: 缓存 tee 路径源流无 'error' 监听——分片传输中途网络错误将抛未捕获异常、主进程崩溃

**File:** `main.js:407`、`media-cache-manager.js:324-354`
**Issue:** `mediaCache.store(finalUrl, vid, Readable.fromWeb(resp.body), {}).pipe(res)`：`store()` 内对 `readable` 只做了两次 `pipe`（passthrough + collector），**未在 readable 自身挂 'error' 监听**。Node 流契约：source 发出 'error' 而无监听 → uncaught exception → 主进程退出。store 只给 collector/passthrough 挂了 error 处理，救不了源流。回源流中断（源站 reset、链路闪断）是常态场景。`store()` 的 JSDoc 也未把「调用方保证 readable 错误已处理」列为契约。

**Failure scenario:** 播放中源站对某个分片连接中途 RST → `Readable.fromWeb(resp.body)` 发出 'error' → 主进程未捕获异常退出——整个浏览器（所有容器、所有窗口）随之崩溃，且此时可能正有录制任务在跑。

**Fix:**
```js
// media-cache-manager.js store() 内，pipe 之前：
readable.on('error', (err) => {
  console.warn('[Realm] 回源流中断（透传与落盘同步终止）:', err.message);
  passthrough.destroy(err);
  collector.destroy();
});
```
（同时建议在 main.js:425 的既有透传分支补同款监听——同一缺陷模式，Phase 27 遗留但同一风险面。）

## Warnings

### WR-01: 录制引擎 fetchPage 无超时——单次挂起连接可让录制无限期停滞

**File:** `main.js:2879-2889`（fetchPage 包装）、`media-record-engine.js:201`（清单拉取）、`:144`（分片下载）
**Issue:** `ses.fetch` 无 timeout/AbortController；pollLoop 对清单与分片的 fetch 均 await 无限时。一次 TCP 挂起（对端不回包、连接半开）会让轮询循环永久卡死：任务保持 running、无数据写入、无失败计数。D-18「网络错误重试 N 次后停录」对这类挂起完全失效。
**Fix:** fetchPage 包装加超时（如 `AbortSignal.timeout(30000)`，清单 10s / 分片 60s），超时按现有 consecutiveFailures 通道计失败。

### WR-02: meta.json 非原子读-改-写，并发分片写入可丢索引/写坏元数据

**File:** `media-cache-manager.js:195-212`（_readMeta/_writeMeta）、`:369-415`（storeBuffer）
**Issue:** storeBuffer 对同一 meta.json 做 read→modify→writeFileSync，无锁无原子替换。hls.js 并发请求同一视频的分片（seek/abort 后台缓冲）时，两个并发 storeBuffer 各自基于旧快照写回会互相覆盖（丢 segKey 登记）；writeFileSync 中途崩溃则产生截断 JSON，下次 _readMeta 得 null → 整个 segments 索引丢失、total_size 归零（文件成孤儿，dirSize 与索引漂移）。
**Fix:** 写入改「临时文件 + rename」原子替换；同一 videoId 的 storeBuffer 用按 videoId 的互斥队列（或进程内 Map<string, Promise> 串行化）消除丢更新。

### WR-03: 多码率（master）清单下完整度恒 100%、D-17 服务端复校被绕过，且产生孤儿变体目录

**File:** `media-cache-manager.js:514-531`（updatePlaylistIndex）、`main.js:362-376`、`ipc-handlers.js:2286-2291`
**Issue:** master 清单的「分片行」实为变体子清单 URI：updatePlaylistIndex 对 master 目录登记的 `playlist_order` 是变体 URL 的 sha256、`total_segments` = 变体数（常为 1~N）；而真正的 TS 分片经 rewrite 继承的 vid 是 master 的 videoId，全部落进 master 目录。于是 drawer 完整度 = min(100, cachedSegments/1) **恒为 100%**——只缓存了 1 个分片的视频也显示可转换，D-17「仅分片齐全可转」的抽屉 gating 与 main.js:3072 服务端复校双双失效，产出静默的残缺 mp4。另外每个变体子清单请求在 m3u8 分支 `touchVideo(变体finalUrl)`（:369）会为其建档——产生带自身 playback_key 的孤儿缓存目录，污染 listEntries/抽屉（显示「未缓存」幽灵条目）。
**Fix:** m3u8 分支判别清单类型：master（含 `#EXT-X-STREAM-INF`）不 touchVideo/updatePlaylistIndex，也不给子清单请求注入新档；或 updatePlaylistIndex 遇 STREAM-INF 时以解析出的变体媒体清单为准（延迟到媒体清单请求时登记）。

### WR-04: EXT-X-KEY 密钥响应被当「分片」缓存进 segments 索引——加密流转封装必失败/产物损坏

**File:** `main.js:386-408`（cache 分支按 CT/非清单判定，密钥 URI 已被 rewrite 进代理 :278-284）、`media-cache-manager.js:548-553`（stored_at 兜底排序）
**Issue:** AES-128 HLS 的 `#EXT-X-KEY URI=` 被重写为 /proxy 子请求，响应 CT 为 octet-stream、非 m3u8 → 落入分片缓存分支，密钥二进制以 sha256(密钥URL) 为 segKey 登记进 `meta.segments`。后果：① playlist_order（仅媒体分片）长度 ≠ segments 键数 → 排序回退 stored_at，**密钥文件混入 convertToMp4 的 push 序列**，mux.js 对非 TS 数据抛错或产出坏文件；② 完整度分子虚增。录制引擎同理（fetchPage 下载分片不解析 KEY，但录制只按清单行下载，不受影响；此问题主要在缓存转封装链路）。
**Fix:** 缓存写入前按清单解析出的分片 URI 集合过滤（updatePlaylistIndex 已有 playlist_order，可用其校验 segKey 是否为媒体分片，非则只透传不落盘）；或 getConvertInfo 里剔除不在 playlist_order 中的键。

### WR-05: appQuitting 标志置位后永不复位——任何一次 Cmd+Q（含首次提示/取消退出）后，播放器关窗录制确认被永久跳过

**File:** `ipc-handlers.js:40-43`（before-quit 置位）、`:2122`（`if (activeRecords.length > 0 && !appQuitting)`）
**Issue:** ipc-handlers 的 before-quit 监听在模块加载即注册（早于 main.js 的 handler），首次 Cmd+Q（main.js 仅广播提示并 preventDefault）就已把 `appQuitting=true`，且 main.js 用户取消退出（:4194-4197 `quitting=false; return`）后无人复位该标志。此后用户手动关闭播放器窗口时，录制确认弹窗（D-19 窗口级）被跳过，静默按 keep-recording 处理。
**Fix:** main.js 退出协程的取消分支（与 Cookie 保存失败分支）里广播/调用一个 `resetAppQuitting()`（ipc-handlers 导出 setter），或改由 main.js 在 preventDefault 之外、真正进入退出序列时再通知 ipc-handlers。

### WR-06: hlsRetryCount 累计不复位——三次网络错误后 D-10 降级对本会话永久失效

**File:** `src/player.js:36/160/191-199`
**Issue:** `hlsRetryCount` 仅在 initPlayer 换流时归零；`hls.startLoad()` 重试成功恢复播放后不回零。长会话中累计 3 次瞬时网络错误（每次都成功恢复）之后，再遇 fatal network error 走到 `showCacheFallbackBanner(); return;` 分支——**不再重试**，播放静默卡死（横幅 4 秒后消失，仅剩错误入口全无）。且该分支此时也未能从缓存恢复（见 CR-01）。
**Fix:** 监听 `Hls.Events.FRAG_LOADED`/`LEVEL_LOADED` 成功事件时将 `state.hlsRetryCount = 0`（成功拉到数据即视为恢复）。

## Info

### IN-01: tasks.html CSP 引入 style 'unsafe-inline'，偏离 AGENTS.md 内部页面 CSP 约定

**File:** `src/tasks.html:7`、`src/tasks-page.js:207`
**Issue:** 任务页 CSP 为 `style-src 'self' 'unsafe-inline'`（为进度条内联 `style="width: X%"`），与 AGENTS.md「realm:// 页面 style-src 'self'、内联 style 会被拦截」的既有约定不一致（downloads/history 等同构页面均无 unsafe-inline）。
**Fix:** 进度条宽度改用 CSS 自定义属性（`el.style.setProperty('--p', pct)`）或 `transform: scaleX` 类切换，恢复 `style-src 'self'`。

### IN-02: before-quit 活跃任务确认文案与实际语义不符；退出中转任务产物无清理

**File:** `main.js:4185-4193`
**Issue:** `hasActiveTasks()` 对 running 的 **convert** 任务同样触发确认，但弹窗文案只提「录制任务」；且确认退出时正在写的 mp4 不会被 remuxer 的失败清理逻辑删除（进程终止，半成品残留产物目录）。
**Fix:** 文案改「有正在进行的录制/转换任务」；convert 任务退出前可同步 abort 并清理半成品。

### IN-03: /api/settings/update 可直接写 settings.cacheDir，绕过「仅 dialog 选取」防线（T-44-08 纵深缺口）

**File:** `main.js:1312-1332`
**Issue:** settings:update 对 `cacheMaxGB` 有服务端校验，但 `cacheDir` 作为普通键可直接经 HTTP POST 写入任意路径（token 持有者），且不触发 rebuildMediaCache（下次启动才生效）。T-44-08「缓存目录仅经 dialog 选取不手输」仅在设置页 UI 层成立。风险受 token 鉴权限制（与全部其他设置键同级），属纵深防御缺口而非可直接利用漏洞。
**Fix:** settings:update 对 `cacheDir` 键直接拒绝（`sendJson 400`），引导走 choose-cache-dir 端点。

### IN-04: 录制连续失败计数在每次清单拉取成功后清零——间歇性故障源永不触发停录

**File:** `media-record-engine.js:209`（`st.consecutiveFailures = 0` 位置）、`:219-230`
**Issue:** 清单拉取成功即清零计数（:209），随后同一窗口内分片失败累计；跨轮询的持续分片失败（每轮失败 1-2 片）永远到不了 maxRetries=5，录制带着缺口无限继续。D-18「网络错误重试 N 次后停录」的「连续」语义实际只覆盖「清单连续失败」与「单窗口内分片连续失败」两种窄情形。
**Fix:** 分片失败计数改为跨轮询不清零（仅在任一 desegment 成功落盘时递减/清零），或将阈值语义按「连续失败事件」统一。

---

_Reviewed: 2026-09-06T13:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

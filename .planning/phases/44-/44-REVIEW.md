---
phase: 44-player-video-cache-and-local-media-library
reviewed: 2026-09-06T14:49:43Z
depth: standard
scope: gap-closure commits 44-06/44-07/44-08 (fdb7848..HEAD) — CR-01~CR-05 + WR-06 fixes
files_reviewed: 7
files_reviewed_list:
  - main.js
  - media-cache-manager.js
  - media-remuxer.js
  - src/player.js
  - tests/test-media-cache.js
  - tests/test-media-remuxer.js
  - tests/test-media-task-registry.js
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 44: Code Review Report（gap-closure 后复审，fdb7848..HEAD = 44-06/07/08）

**Reviewed:** 2026-09-06T14:49:43Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found（无 Critical；3 Warning / 2 Info）

## Summary

本轮复审对象是 44-06/44-07/44-08 三个 gap-closure plan 对 **CR-01~CR-05 与 WR-06** 的修复（`git diff fdb7848..HEAD`，HEAD=1a7bf3f）。经对 handleProxyRequest 命中优先分支、store() 源流 error 契约、写路径水位淘汰、RECORD_ROOT 目录补算、/api/tasks/cancel 类型分派与 convert 协作式取消、player FRAG_LOADED 复位的逐行追踪，**五条 Critical 的根因在生产路径均已结构性闭合**：

- **CR-01**：`mediaCache.lookup(target, vidParam)`（main.js:369）先于 `ses.fetch(target)`（:388），命中以 200 + Content-Length=hit.size 读盘直返并 `return`，不触达源站；key 统一为请求 URL target，命中/落盘两侧同 key；m3u8-likely（URL 预判）与 Range 显式排除；tee 分支已移除二次 lookup 只留 miss-tee。
- **CR-05**：`store()` 在两次 pipe 之前挂 `readable.on('error')` → destroy 双 tee + warn（media-cache-manager.js:344-348）；main.js 透传分支 `Readable.fromWeb(resp.body).on('error'...).pipe(res)` 同款防护（:456-461）；lookup 命中回放 contentType、storeBuffer 登记 contentType，契约闭环。单测 +2 覆盖。
- **WR-06**：hls 分支新增 FRAG_LOADED 监听复位 `state.hlsRetryCount = 0`（src/player.js:212-214），未触碰双模式判定/缓存分支，改动最小。
- **CR-02**：storeBuffer 落盘登记成功后累计 `_trackedTotal` 水位，越 `capacityBytes` 才 `evictIfNeeded(new Set([videoId]))` 一轮并把 `r.total` 同步回水位（首写惰性初始化直接取磁盘权威总量、不重复加 size——双计陷阱已规避）；`setCapacityBytes()` 校验赋值 + 立即淘汰 + 水位同步，main.js cacheMaxGB 更新改走该方法，无字段直写残留。20/20 单测含 3 条新增写路径用例。
- **CR-03**：`RECORD_ROOT` 常量单一来源（main.js:2979，字面全文件唯一）；readRecordTaskSegments 对 outputPath 缺失按 `path.join(RECORD_ROOT, tid)` 补算，task.id 过 `/^[0-9a-fA-F-]{8,64}$/` uuid 白名单防穿越。
- **CR-04**：cancel 路由按类型分派（record → `recordEngine.stopRecord(taskId)`；convert → `convertCancelTokens` 触发 shouldCancel；not_found 且回读仍 running 才 cancelTask 兜底）；convertToMp4 每分片迭代前 shouldCancel 检查点（reason='cancelled' → fail 路径 unlink 半成品）；startConvertTask 令牌 set/`.finally` delete，.catch 对 cancelled 走 cancelTask（落 cancelled 而非 failed）。remuxer +2 单测。

单测实跑全绿：test-media-cache 20/20、test-media-remuxer 17/17、test-media-task-registry 26/26（本 range 未改动，作为回归确认）、test-unified-navigation 32/32；四个改动源文件 node --check 通过。

以下 3 条 Warning 均为**残余缺口/质量缺陷**（非原五条 Critical 复发），无阻塞性正确性缺陷。

## Warnings

### WR-A: 单视频超限场景下容量淘汰退避缺失——每次分片写盘都触发全库扫描（prohibition 未完全达成）

**File:** `media-cache-manager.js:444-458`
**Issue:** 写路径水位检查无进展退避：`_trackedTotal > capacityBytes` 即无条件调 `evictIfNeeded(new Set([videoId]))`。当缓存里**唯一/主要占用者是当前正在写入的 video**（exempt 自身 + isVideoActive 只豁免录制任务，看片不算活跃）且其总量超过上限时，淘汰每轮都因 exempt/活跃豁免而零删除、`r.total` 仍超上限，于是**后续每一个分片写盘都重复一轮全库 listEntries**（listEntries 对每个 videoId 递归 stat 全部已缓存文件 + 读 meta）。这正是 44-07 注释与 decision 反复声明要结构避免的「数千分片 = 数千次全树扫描」回归，只是被收窄到「持续超限的单视频」情形——该情形恰好是 CR-02 自己承认的现实形态（测试 C「单视频超限自豁免不自杀」只验证单次写，未压测连续写）。默认 10GB 上限 + 用户观看一个 >10GB 的长 VOD（或设置页把上限改小）即可触发：每个分片（≈秒级）在主进程事件循环同步阻塞做一次全缓存树 stat。
**Fix:** 淘汰无进展时退避，例如：`evictIfNeeded` 返回 `freed:0 && evicted.length===0` 时把水位标记为「本轮已尝试」，累计新增字节达到某阈值（如 `capacityBytes` 的 1/16 或最近一次淘汰后 size 增量 > 单分片 ×N）再重试；或对 exempt 的自身 video 退化为**目录内按 stored_at 删最旧分片**的部分淘汰，使单视频也能收敛到上限内。纯逻辑层可加单测：超限单视频连写 N 片，断言 listEntries/淘汰只被触发常数次。

### WR-B: cancel 路由「非 running」分支含不可达的 200 响应——对已终态任务实际恒 400，与 record 分支幂等语义不一致

**File:** `main.js:2179-2189`
**Issue:** `existing.status !== 'running'` 分支先调 `mediaTaskManager.cancelTask(taskId, '用户取消')`——而 cancelTask 经 `requireRunning` 对非 running 任务**必然 throw**（media-task-manager.js:85-92），因此紧随其后的 `sendJson(res, 200, ...)`（:2186-2188）是死代码，该分支的实际结果永远是外层 catch 的 **400「非法流转」**。这带来双重问题：① 注释（:2184-2185）声称「维持旧语义 cancelTask 抛非法流转 → 400」，代码却先写了 200 响应，语义自相矛盾，误导后续维护（任何人「清理死代码」都会把行为改成 200）；② 与同端点 record 分支「已终态 → 200 `note:'already-stopped'` 不二次流转」（:2208-2210）的幂等语义不一致——record 已停再点「停止」返回 200，convert/其他类型已终态再点「停止」返回 400 错误，任务页对同一交互在不同任务类型上行为分裂。
**Fix:** 删掉死代码并对已终态任务显式幂等返回（与 record 分支对齐）：
```js
if (existing.status !== 'running') {
  const TERMINAL = ['completed', 'failed', 'cancelled', 'interrupted'];
  if (TERMINAL.includes(existing.status)) {
    sendJson(res, 200, { success: true, task: existing, note: 'already-stopped' });
  } else {
    sendJson(res, 400, { success: false, error: `非法流转: 任务 ${taskId} 状态 ${existing.status} 不可取消` });
  }
  return;
}
```

### WR-C: D-18「崩溃不白录」对真正的硬崩溃中断任务仍未闭合——interrupted 恢复快照通常没有 meta.json，续转依旧拿不到分片

**File:** `main.js:3031-3044`（readRecordTaskSegments）、`media-record-engine.js:167-192/225/237/246/270`（writeMeta 调用点）
**Issue:** CR-03 修复的是「meta.json 已在 RECORD_ROOT/<taskId>/ 但 outputPath 缺失」的**映射断裂**。但 meta.json 只在 stop/fail/`pl.ended` 三条路径写入（media-record-engine.js:225/237/246/270），**录制中从不周期性写索引**。interrupted 状态唯一来源是崩溃重启后 restoreTasks 把保存为 running 的任务置为 interrupted（media-task-manager.js:223）；而进程硬崩溃（OS kill、断电、CR-05 修复前的 uncaught 崩主进程）恰恰发生在没有任何 writeMeta 的时刻——恢复后的 interrupted 任务目录里只有 `<seq>.ts` 分片文件、**没有 meta.json**。此时 readRecordTaskSegments 在 `if (!fs.existsSync(metaPath)) return null;`（:3032）直接短路，convert-resume 仍 400 `no_segments`——「已落盘部分续转」按钮对崩溃中断任务依旧不可用。CR-03 补算实际只完整覆盖了 failed（网络自动停录已写 meta）与极窄的「写完 meta 但状态未 persist」竞态窗口。
**Fix（二选一）:** ① 录制引擎在每次成功落盘后（或每轮 poll 结束）同步写一次轻量 meta.json（增量更新 segments 数组），把崩溃损失收窄到最近一个分片；② readRecordTaskSegments 在 meta.json 缺失但 `recordDir/segments` 存在且含 `.ts` 文件时，按文件名数字序合成索引（文件名是 `<seq 补零>.ts` 纯数字，可安全排序；时长可用 targetDuration 兜底）——与 44-07 已确立的「持久化字段缺失以确定性派生值回填」先例一致。建议补一条恢复场景单测/回归。

## Info

**UAT 实测确认（2026-09-07，44-UAT Test 9 / G-44-9）:** 用户硬崩溃模拟复验——中断任务 7d5b4a10 目录 39 个 .ts（3.6MB）滞留、无 meta.json，续转 400 no_segments，与 WR-C 预测完全一致。用户决策：本项维持记债（本条），本阶段仅修「续转失败无可见反馈」的 UX 缺口（见 44-UAT G-44-9）。

### IN-01: media-cache-manager 公开方法形参与 JSDoc 仍称 `finalUrl`，与 CR-01 后实际传入的「请求 URL target」语义漂移

**File:** `media-cache-manager.js:255-260`（lookup @param）、`:332-337`（store @param/meta 说明）、`:385-390`（storeBuffer @param）
**Issue:** CR-01 把缓存 key 从重定向后 finalUrl 改为请求 URL（main.js:369/430 传的是 `target`），manager 侧 `finalUrl` 形参名与顶部注释（:54-61 「分片缓存 key：sha256(分片最终 URL)…重定向后的 finalUrl」）均已与实际语义不符；store 的 meta JSDoc 仍写「如 title」，而 main.js 现传入 contentType。阅读方（未来改动者）极易据此误解 key 语义而在两处引入漂移——正是本阶段反复强调的「key 两端统一」纪律的文档面缺口。
**Fix:** 形参改名 `finalUrl` → `cacheKey`/`requestUrl`，同步更新类头注释与三处 @param、store meta 说明。

### IN-02: startConvertTask `.finally` 中 try/catch 包裹不可能抛错的 `Map.delete`

**File:** `main.js:3147-3153`
**Issue:** `convertCancelTokens.delete(taskId)` 不会抛异常（Map.delete 无 throw 路径），外层 try/catch 为空转；同样 cancel 路由 `stop()` 的 try/catch（:2220-2224）虽属防回调异常惯例但信号闭包仅置布尔位，同样不会抛。属冗余防御噪声，不构成缺陷，建议移除或补真实失败面说明。
**Fix:** 直接 `convertCancelTokens.delete(taskId);` 并删掉空 catch，保持 .finally 精简。

---

### 附：范围说明

- 44-VERIFICATION 的 failed truths #1~#5 对应代码层缺陷已全部闭合（CR-01~CR-05）；truth #15（D-18 崩溃不白录）在「失败中断（failed）」路径已闭合、在「硬崩溃 interrupted」路径仍受 WR-C 限制。
- 前序 44-REVIEW 的 WR-01~WR-05、IN-01/03/04 不属本轮 gap-closure 文件范围，未逐一复验；其中 WR-06 已在本轮修复（见 44-06），WR-05 修复点在 ipc-handlers.js（44-08 明示范围外）。
- tests/test-media-task-registry.js 在本 diff range 内无改动，以回归复跑确认（26/26）。

---

_Reviewed: 2026-09-06T14:49:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 44-player-video-cache-and-local-media-library
verified: 2026-09-07T11:49:14Z
status: human_needed
score: 10/11 must-haves verified
covered_files:
  - .planning/phases/44-/44-01-PLAN.md
  - .planning/phases/44-/44-01-SUMMARY.md
  - .planning/phases/44-/44-02-PLAN.md
  - .planning/phases/44-/44-02-SUMMARY.md
  - .planning/phases/44-/44-03-PLAN.md
  - .planning/phases/44-/44-03-SUMMARY.md
  - .planning/phases/44-/44-04-PLAN.md
  - .planning/phases/44-/44-04-SUMMARY.md
  - .planning/phases/44-/44-05-PLAN.md
  - .planning/phases/44-/44-05-SUMMARY.md
  - .planning/phases/44-/44-06-PLAN.md
  - .planning/phases/44-/44-06-SUMMARY.md
  - .planning/phases/44-/44-07-PLAN.md
  - .planning/phases/44-/44-07-SUMMARY.md
  - .planning/phases/44-/44-08-PLAN.md
  - .planning/phases/44-/44-08-SUMMARY.md
  - .planning/phases/44-/44-09-PLAN.md
  - .planning/phases/44-/44-09-SUMMARY.md
  - .planning/phases/44-/44-10-PLAN.md
  - .planning/phases/44-/44-10-SUMMARY.md
  - .planning/phases/44-/44-11-PLAN.md
  - .planning/phases/44-/44-11-SUMMARY.md
  - .planning/phases/44-/44-12-PLAN.md
  - .planning/phases/44-/44-12-SUMMARY.md
  - .planning/phases/44-/44-13-PLAN.md
  - .planning/phases/44-/44-13-SUMMARY.md
  - .planning/phases/44-/44-14-PLAN.md
  - .planning/phases/44-/44-14-SUMMARY.md
  - .planning/phases/44-/44-15-PLAN.md
  - .planning/phases/44-/44-15-SUMMARY.md
  - .planning/phases/44-/44-16-PLAN.md
  - .planning/phases/44-/44-16-SUMMARY.md
  - .planning/phases/44-/44-UAT.md
  - .planning/phases/44-/44-REVIEW.md
  - .planning/REQUIREMENTS.md
  - ipc-handlers.js
  - src/renderer.js
  - main.js
  - media-record-engine.js
  - src/player.js
  - src/player.css
  - package.json
  - ua-ch-manager.js
covered_digest: "v1:sha256:871dc6f9bcbc81227c95aa57dcd1c44a679103b0223c1e2c8046e9d77f055029"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 14/16
  gaps_closed:
    - "G-44-2（blocker，SIGSEGV）：44-14 结构性规避（关窗序列 hide→300ms→close + playerClosing 旁路；renderer deferredRemoveWebview；dev 销毁诊断）+ 44-15 Electron 43.3.0→43.6.0 补丁线 + 4 处 UA/CH 常量同步——双层防御，代码层全部核实闭合；真机 5 轮无闪退验收留 human"
    - "G-44-4（minor，时长抖动）：44-16 startedAt 挂钟差值（getRecordStatus/getActiveRecordings 同式）+ writeMeta 零 diff 口径锁定 + tests/test-media-record-duration.js 4/4（含 0 分片走表行为测试）——VERIFIED"
    - "G-44-6（major，图标替换时间）：44-16 抽屉 meta 行时钟图标 + 时间文本并排常显 + title 完整提示 + player.css gap: 4px——VERIFIED；视觉目检留 human"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "G-44-2 规避后真机「停止录制 → 关窗（含 Cmd+W）」链路稳定无 SIGSEGV（结构性收窄是启发式而非确定性修复，heisenbug 无法自动化复现）"
    test: "npm run dev 真机 5 轮「播放器开始录制 → 点击停止 → 关闭播放器窗口（含 Cmd+W）」，观察应用全程存活；关窗时终端应出现「播放器窗口关闭销毁 webContents id=…」与「webContents destroyed id=…」诊断日志"
    expected: "全程无 SIGSEGV；若仍闪退，崩溃前最后一条 destroyed 日志即被销毁的 webContents（对照 .planning/debug/stop-record-sigsegv.md 根因链继续二分）"
    why_human: "上游 UAF 触发条件是键盘 ACK 在途 + 同步销毁的竞态时序，无自动化测试可复现；44-14 延迟销毁代码结构已核实（close() 在 setTimeout 内）但竞态消除效果只有真机可证"
human_verification:
  - test: "G-44-2 真机验收：npm run dev 5 轮「开始录制 → 停止 → 关窗（含 Cmd+W）」全程存活 + 终端 destroyed 诊断日志可见"
    expected: "无 SIGSEGV；关窗路径两条诊断日志（播放器窗口本体 + guest）出现"
    why_human: "heisenbug 竞态无法自动化复现（见 behavior_unverified_items）"
  - test: "G-44-4 视觉验收：录制中 hover 红点时长每秒平滑 +1（含弱网点播源 0 分片场景走表）"
    expected: "时长连续推进无平段/跳秒（数据源行为已由 tests/test-media-record-duration.js 测试 1 行为性锁定，本项确认 UI 呈现）"
    why_human: "平滑观感需真机目检；0 分片场景依赖真实弱网源"
  - test: "G-44-6 视觉验收：缓存抽屉条目 meta 行「时钟图标 + 时间」并排常显（非仅 hover），hover 有完整「最近观看 时间」提示"
    expected: "图标只替代「最近观看」四个字、时间文本始终可见；间距 4px 无重叠"
    why_human: "渲染观感与文本布局需真机目检"
---

# Phase 44: 播放器视频缓存与本地媒体库 Verification Report（第三轮 gap-closure 复验，44-14~44-16）

**Phase Goal:** 独立播放器的 HLS 本地媒体库能力（webview tab 模式保持现状不做缓存）：① 独立窗口收口 /proxy；② 分片级磁盘缓存 + FIFO 淘汰 + 设置页配置；③ 观看历史精确续播；④ 统一媒体任务中心（直播录制 + mux.js 转封装）；⑤ realm://tasks 任务页 + 角标。
**Verified:** 2026-09-07T11:49:14Z
**Status:** human_needed（代码层 0 失败 gap；10/11 核实，1 项 PRESENT_BEHAVIOR_UNVERIFIED；3 项 human-only 待真机）
**Re-verification:** Yes — 第三轮 gap-closure 后复验（UAT 第二轮发现 G-44-2/4/6 三 gap；本轮 44-14/44-15/44-16 三计划闭合，commit 334adc3..855f048）

## Goal Achievement

**复验结论：三个 UAT gap 的修复经代码逐行核实全部闭合**。G-44-2 是 blocker 级 Electron 43.3.0 上游键盘 ACK use-after-free（.ips 全帧符号化确证，录制 JS 链路 5 组真机复现无辜），本轮按「确定性规避（44-14）+ 补丁线升级（44-15）」双层防御修复，两层的代码落点全部核实；G-44-4/G-44-6 为 44-16 一并修复，其中 G-44-4 的挂钟推进行为有专门单测行为性锁定（4/4）。实跑全绿：test-media-record-duration 4/4（新建）、test-media-task-registry 26/26、test-media-cache 20/20、test-unified-navigation 32/32、test-favorites-folders 33/33、test-player-history 7/7、test-media-remuxer 23/23、test-m3u8-playlist-parser 15/15、npm run test:memory 56/56；7 个 JS 文件 node --check 全过。全部 7 个 gap-closure 提交（334adc3/662403c/d92dfeb/ed7d4d2/157d3e7/651b0cc/bbc4f56）经 git cat-file 确认存在；diff 范围审计确认 locked 文件零触碰（media-task-manager.js / src/preload.js / settings.html / src/settings-page.js 均不在本轮 commit 集内；工作树中 settings 两文件为 44-15 之前既有的未提交改动）。打包链路独立复核：/Applications/Realm.app 内 Electron Framework 实测 CFBundleVersion **43.6.0**（2026-09-07 19:18 安装），与 44-15 声明一致（非仅 SUMMARY 口径）。

前轮（第二轮）已闭合的 8 个 gap（G-44-2b/4a/4b/5/7/8/9 及首轮直连守卫）经本轮触碰链路回归核实无回归：proxiedUrl 守卫仍在 player.js:328、嗅探检查点序未触碰（media-remuxer.js 本轮零 diff）、toast/角标/反馈条链路未触碰。

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | G-44-2：播放器窗口关闭序列 hide→~300ms→close，playerClosing 旁路不重入确认序列 | ✓ VERIFIED | ipc-handlers.js:34 `PLAYER_CLOSE_DESTROY_DELAY_MS = 300`；finish() :2109-2135：诊断日志（try/catch 取 id+URL）→ `playerClosing = true`（:2123 同步置位，早于定时器回调触发的 close 事件）→ hide（:2125 isDestroyed 守卫）→ setTimeout 内 close()（:2129-2135）；close handler :2099 `if (playerClosing …) return` 旁路直接放行；确认分支（:2149-2188 recordCloseAction）、500ms ack 超时（:2139-2142）、closed 清理（:2193-2197）零改动（UAT test 8 pass 区保护达成） |
| 2 | G-44-2：tab 关闭时 webview guest 延迟销毁（closeTab 汇聚点 deferred） | ✓ VERIFIED | src/renderer.js:1821-1834 `deferredRemoveWebview`（CSSOM display='none' → setTimeout remove，全程 try/catch，仅 DOM API）；:1842-1853 `destroyWebview(tabId, {deferred})`；closeTab :1083 传 `{deferred: true}`（注释明确汇聚点语义）；判定标准落码注释并逐处执行：handleTabRecycled :1133-1134 保持同步（注释：程序化静默回收）、handleTabRemovedFromMain :1354 保持同步（跨窗口移动）；test-unified-navigation 32/32 |
| 3 | G-44-2：dev/debug 环境每个 webContents 销毁留 id+type+URL 诊断日志，生产零输出 | ✓ VERIFIED | main.js:525-541 并入既有 web-contents-created 订阅、置于 webview 类型早退**之前**（window 类型如播放器窗口本体也覆盖——44-14 SUMMARY 裁量点核实合理）；NODE_ENV 双值门（:532）；did-navigate/dom-ready 记录 lastUrl 局部变量，destroyed 回调只用局部变量不调 getURL（:537-540，销毁后取值抛错的规避正确）；块内只挂监听无行为逻辑 |
| 4 | G-44-2：Electron 43.6.0 + 4 处 UA/CH 常量与内核一致（降维 UA 冻结、.212 零残留） | ✓ VERIFIED | package.json:33 `"electron": "^43.6.0"`；`grep -c '150.0.7871.212'` 双文件 **0 命中**；`150.0.7871.250` main.js 4 处 / ua-ch-manager.js 5 处；降维 CHROME_UA（Chrome/150.0.0.0）main.js:108 / ua-ch-manager.js:36 原样（build 号冻结不变式保持）；**独立证据**：/Applications/Realm.app Electron Framework Info.plist CFBundleVersion = 43.6.0（打包链路真实装出新内核） |
| 5 | G-44-4：运行中时长挂钟平滑推进（0 分片也在走表），两处同式 | ✓ VERIFIED | media-record-engine.js:113 `startedAt: Date.now()`；:299 与 :335 同式 `Math.max(0, Math.round((Date.now() - st.startedAt) / 1000))`（grep `recorded.size * st.targetDuration` 零命中——乘积式双处清零）；两处 JSDoc（:284/:322）口径分离语义同步；**行为性锁定**：tests/test-media-record-duration.js 测试 1（0 分片 1.3s 后 durationSeconds ∈ [1,2]、再 1.1s 严格递增）/ 测试 2（两处差值 ≤1s）实跑 4/4 全绿——状态迁移有专门行为测试，非仅符号在场 |
| 6 | G-44-4：终态口径不变——meta.json totalDuration 仍为分片 EXTINF 累计（writeMeta 零 diff） | ✓ VERIFIED | `git diff 3914693..HEAD -- media-record-engine.js` 全文核查：仅 startedAt 增行 + 两处乘积式替换 + 两段 JSDoc，writeMeta 函数体零改动、META_VERSION 未升；测试 3/测试 4（EXTINF 累计 + targetDuration 兜底）实跑通过；test-media-task-registry 26/26（续转/转封装消费端基线绿） |
| 7 | G-44-6：抽屉 meta 行「时钟图标 + 时间」并排常显，title 保留完整提示 | ✓ VERIFIED | src/player.js:984 注释 G-44-6 语义；:999 `watchedIcon.title = \`最近观看 ${watched}\``（完整 hover 提示保留）；:1001 `watchedIcon.appendChild(document.createTextNode(watched))`（时间文本节点常显，非仅 hover）；player.css:636 注释同步 + :637-643 `.drawer-item-watched` inline-flex + `gap: 4px`；meta 行前段/删除确认链路零触碰（diff 范围核查） |
| 8 | 【禁止】录制引擎/任务注册表停止语义零改动（44-14 prohibition） | ✓ VERIFIED | diff 范围审计（a9b3e47..HEAD）：media-task-manager.js **不在改动集**；media-record-engine.js 改动仅为 G-44-4 时长口径（:299/:335 查询侧），stopRecord/failTask/轮询终态流转零 diff |
| 9 | 【禁止】关窗设置项与 D-19 确认链路零改动（44-14/44-16 prohibition） | ✓ VERIFIED | ipc-handlers.js diff 31 行全部在 finish() 延迟放行区（:2109-2135），确认分支（:2149-2188）零改动；settings.html / src/settings-page.js 不在本轮任何 commit 中（工作树未提交改动系 44-15 之前既有，44-15 SUMMARY 明示保留） |
| 10 | 【禁止】指纹伪装其余逻辑零改动（44-15 prohibition：品牌表顺序/GREASE/CDP 链路/44 禁跨大版本） | ✓ VERIFIED | ua-ch-manager.js diff 10 行 = 3 个全版本号值 + 注释；品牌表顺序（Not;A=Brand → Chromium → Google Chrome）与 GREASE（"Not;A=Brand" v"8"）grep 确认原样；package.json electron = ^43.6.0（43 线内，未跨 44/Chromium 152） |
| 11 | G-44-2 规避后真机「停止录制→关窗」链路无 SIGSEGV（端到端） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 两处销毁窗口的延迟化代码结构已核实（#1/#2），44-15 补丁线升级已落地（#4）——但上游 UAF 竞态消除效果是行为断言，heisenbug 无自动化测试可复现（44-14 计划 verification 第 4 项即 human-check）。归 human 第 1 项：真机 5 轮录制→停止→关窗验收。规避定位诚实（计划明示「收窄而非确定性修复」，若复发有 destroyed 日志二分路径） |

**Score:** 10/11 truths verified（0 failed，1 PRESENT_BEHAVIOR_UNVERIFIED = #11）

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | B 站直播 fMP4 流转录（mux.js 仅支持 MPEG-TS 按设计拒转） | Phase 44 后独立工作 | 44-UAT.md Deferred Follow-Ups：用户确认 Phase 44 完成后介入（2026-09-07） |
| 2 | WR-07 嗅探 ID3 前导 TS 子类回归风险 / WR-C 硬崩溃续转 / AES-128 解密 | REVIEW.md 债务（前轮已记，本轮未触碰） | 前轮报告 Deferred 段与 44-REVIEW.md 维持不变 |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | None | — | 本轮复验未发现无确定性证据的新范围发现；44-15 的生产版误杀事件已由执行者如实记录于 SUMMARY 并沉淀防复发纪律（与项目 memory 中打包验证安全纪律一致），属执行过程事件而非代码缺陷 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| ipc-handlers.js | 关窗序列延迟放行 + playerClosing 旁路 | ✓ VERIFIED | :34/:2099/:2109-2135；确认分支零改动 |
| src/renderer.js | deferredRemoveWebview + destroyWebview deferred 选项 | ✓ VERIFIED | :1821-1853；closeTab :1083 deferred；回收/移动语境注释判定 |
| main.js | dev-only webContents 销毁诊断 | ✓ VERIFIED | :525-541；早退之前覆盖 window 类型；生产零输出 |
| package.json | electron ^43.6.0 | ✓ VERIFIED | :33；安装产物 Framework 实测 43.6.0 |
| main.js / ua-ch-manager.js | UA/CH 全版本号同步 .250、降维 UA 零 diff | ✓ VERIFIED | .212 双文件 0 命中；.250 双文件命中；CHROME_UA 两处原样 |
| media-record-engine.js | startedAt + 挂钟差值 + writeMeta 零 diff | ✓ VERIFIED | :113/:299/:335；diff 全文核查口径锁定 |
| tests/test-media-record-duration.js | 新建行为单测 | ✓ VERIFIED | 4/4 实跑全绿（RED→GREEN，含 0 分片走表行为例） |
| src/player.js | 抽屉 meta 行图标+时间常显 | ✓ VERIFIED | :984/:999/:1001 |
| src/player.css | gap 4px + 注释同步 | ✓ VERIFIED | :636-643 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| playerWindow 'close' handler | 延迟 close 事件 | playerClosing :2123 置位 → :2099 旁路放行 | ✓ WIRED | 延迟 close 不重入确认序列（时序注释在码） |
| renderer closeTab（用户关 tab 汇聚点） | guest webContents 延迟销毁 | destroyWebview(tabId, {deferred:true}) → deferredRemoveWebview | ✓ WIRED | :1083 → :1846-1847 → :1821 |
| 关窗确认/ack 完成 | 诊断日志 + hide + 延迟 close | finish() 序列 | ✓ WIRED | 日志先于 hide（id+URL 在销毁前可取） |
| st.startedAt（startRecord 时刻） | getRecordStatus/getActiveRecordings | 挂钟差值同式两处 | ✓ WIRED | :113 → :299/:335；D-19 关窗确认与红点同步共用同口径 |
| 运行中 durationSeconds | player.js 红点 hover tooltip | 直显数据源（UI 层零改动） | ✓ WIRED | 行为测试测试 1/2 锁定推进与同式性 |
| 抽屉条目 lastWatched | meta 行渲染 | formatWatchedTime → svg + createTextNode(watched) | ✓ WIRED | :995-1002；player_history 表真实数据（前轮 Data-Flow 已证） |
| package.json electron 43.6.0 | 真实运行内核 | /Applications/Realm.app Framework CFBundleVersion | ✓ WIRED | 独立 plutil 复核一致 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 运行中时长 tooltip | durationSeconds | Date.now() - st.startedAt（真实挂钟） | ✓ | ✓ FLOWING（行为测试锁定） |
| 终态任务页时长 | meta.json totalDuration | 分片 EXTINF 累计（口径未动） | ✓ | ✓ FLOWING |
| destroyed 日志 | lastUrl / contents.id | 真实 webContents did-navigate/dom-ready | ✓ | ✓ FLOWING |
| 抽屉时间文本 | watched | formatWatchedTime(item.lastWatched) ← player_history 表 | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 录制时长口径分离（新建单测，含 0 分片走表行为例） | node tests/test-media-record-duration.js | 4 pass / 0 fail | ✓ PASS |
| 任务注册表基线 | node tests/test-media-task-registry.js | 26 pass / 0 fail | ✓ PASS |
| 缓存管理器基线 | node tests/test-media-cache.js | 20 pass / 0 fail | ✓ PASS |
| remuxer（含嗅探契约，本轮零触碰回归） | node tests/test-media-remuxer.js | 23 pass / 0 fail | ✓ PASS |
| m3u8 解析器回归 | node tests/test-m3u8-playlist-parser.js | 15 pass / 0 fail | ✓ PASS |
| player-history 回归 | node tests/test-player-history.js | 7 pass / 0 fail | ✓ PASS |
| favorites-folders（原生模块重编后 FTS5/分词） | node tests/test-favorites-folders.js | 33 pass / 0 fail | ✓ PASS |
| 导航回归（renderer 改动后） | node tests/test-unified-navigation.js | 32 通过 / 0 失败 | ✓ PASS |
| 内存测试 | npm run test:memory | 56 pass / 0 fail | ✓ PASS |
| 语法检查 | node --check × 7 JS 文件 | 全过 | ✓ PASS |
| 延迟销毁结构断言 | grep PLAYER_CLOSE_DESTROY_DELAY_MS / setTimeout close :2129-2135 | close() 在定时器内 | ✓ PASS |
| 乘积式清除断言 | grep "recorded.size \* st.targetDuration" media-record-engine.js | 0 命中 | ✓ PASS |
| .212 残留断言 | grep -c '150.0.7871.212' 双文件 | 0 / 0 | ✓ PASS |
| .250 同值断言 | grep -c '150.0.7871.250' 双文件 | 4 / 5 | ✓ PASS |
| 降维 UA 冻结断言 | grep 'Chrome/150.0.0.0' 双文件 | main.js:108 + ua-ch-manager.js:36 原样 | ✓ PASS |
| 打包产物版本断言 | plutil Electron Framework Info.plist（/Applications/Realm.app） | CFBundleVersion = 43.6.0 | ✓ PASS |
| 提交存在断言 | git cat-file -t × 7 commits | 全部存在 | ✓ PASS |
| locked 文件零触碰断言 | git diff --stat a9b3e47..HEAD（12 文件范围） | 仅 8 个预期文件，settings/preload/task-manager 零 diff | ✓ PASS |

### Probe Execution

无 probe 脚本声明（非迁移/tooling phase）；以 9 个测试套件实跑 + 独立 plutil 产物复核替代。

### Requirements Coverage

REQUIREMENTS.md 无 Phase 44 需求 ID（specless，前两轮已确认）。本轮三计划 requirements 声明：44-14 [D-13, D-19]、44-15 [D-13, D-19]、44-16 [D-21, D-16]——逐一对照 44-CONTEXT.md（D-13 进度上报 :46、D-16 删除 :52、D-19 关窗确认 :58、D-21 录制时长 :58-60）全部真实存在，无孤儿、无虚构编号。覆盖状态：D-13（关窗前索取最终进度 + 销毁序列）✓；D-19（关窗确认链路本轮修复未触碰，行为与 UAT test 8 pass 版本一致）✓；D-21（红点 hover 时长平滑推进——挂钟差值有行为测试）✓；D-16（删除链路本轮未触碰，G-44-6 仅改 meta 行展示）✓。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| （本轮改动集）ipc-handlers.js / src/renderer.js / main.js / media-record-engine.js / src/player.js / src/player.css / ua-ch-manager.js | — | TBD/FIXME/XXX/placeholder/空实现扫描 | — | **0 命中**（债务标记门通过） |
| （历史段）WR-07 嗅探子类回归 / CR-06 直连注释 / WR-A/B/C、IN-01~08 | — | 前轮债务维持不动（本轮未触碰相关文件区段） | ⚠️/ℹ️ | 见 44-REVIEW.md 与前两轮报告，不重复展开 |

### Human Verification Required

见 frontmatter `human_verification`（3 项）+ `behavior_unverified_items`（1 项，并入第 1 项）。要点：① G-44-2 真机 5 轮录制→停止→关窗（含 Cmd+W）无 SIGSEGV + destroyed 日志可见（唯一 PRESENT_BEHAVIOR_UNVERIFIED，heisenbug 无法自动化）；② G-44-4 红点时长每秒平滑 +1 的 UI 观感（数据源行为已单测锁定）；③ G-44-6 抽屉「图标+时间」并排常显的渲染观感。第二轮 UAT 已通过的其余 human 项（toast/角标/反馈条/删除路径等）不重复列出。

### Gaps Summary

**代码层 0 failed gap。** 三个 UAT gap 的修复全部核实闭合：

- **G-44-2（blocker）**：44-14 把两处已知销毁时序窗口（播放器窗口关闭、用户关 tab 的 guest 销毁）改为先隐藏后 300ms 延迟销毁，playerClosing 同步置位保证延迟 close 经旁路放行不重入确认；dev 环境留存被销毁 webContents 的 id+URL 诊断（置于 webview 早退之前，播放器窗口本体也覆盖）。44-15 升级 Electron 43.3.0→43.6.0（Chromium 内核 .224→.250），4 处 UA/CH 常量同步且降维 UA 冻结不变式保持，.212 零残留；打包产物经独立 plutil 复核确为 43.6.0。双层防御代码层全部成立；**真机 5 轮无闪退是启发式验收，留 human（本轮唯一 PRESENT_BEHAVIOR_UNVERIFIED）**。
- **G-44-4（minor）**：运行中时长改 startedAt 挂钟差值（两处同式），0 分片也在走表——有专门行为单测 4/4；终态 EXTINF 口径 writeMeta 零 diff 锁定（diff 全文核查）。
- **G-44-6（major）**：抽屉 meta 行恢复「时钟图标 + 时间」并排常显（图标只替代文字、时间 createTextNode 常显），title 完整提示保留，CSS gap 间距到位。

9 个测试套件实跑全绿（168 用例零失败），locked 文件零触碰经 diff 范围审计确认，7 个提交全部存在，前轮闭合成果（直连守卫、嗅探、toast、角标、反馈条、删除联动）回归核实无回归。

**状态说明**：status = human_needed——代码层 10/11 核实、0 failed；剩余为 3 项真机验收（UAT 第三轮）。若以代码闭合为门槛，本轮复验 = 通过（可进入 UAT）；UAT 通过即 phase.complete（既有收尾约定）。

---

_Verified: 2026-09-07T11:49:14Z_
_Verifier: Claude (gsd-verifier) — third re-verification after gap closure (44-14~44-16, G-44-2/G-44-4/G-44-6)_

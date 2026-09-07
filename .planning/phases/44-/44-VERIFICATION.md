---
phase: 44-player-video-cache-and-local-media-library
verified: 2026-09-07T07:43:36Z
status: human_needed
score: 14/16 must-haves verified
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
  - .planning/phases/44-/44-CONTEXT.md
  - .planning/phases/44-/44-UAT.md
  - .planning/phases/44-/44-REVIEW.md
  - .planning/REQUIREMENTS.md
  - main.js
  - ipc-handlers.js
  - media-remuxer.js
  - media-cache-manager.js
  - media-task-manager.js
  - media-record-engine.js
  - media-m3u8-parser.js
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
  - tests/test-media-cache.js
  - tests/test-media-task-registry.js
  - tests/test-m3u8-playlist-parser.js
  - tests/test-player-history.js
  - tests/test-unified-navigation.js
covered_digest: "v1:sha256:7c512d347ed7bf14b11009831f27ee958403adeb6e5e4e0a22cf0c4d4b9cce16"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 20/21
  gaps_closed:
    - "G-44-2：webview tab 播放器直连拉流（proxiedUrl 守卫仅 isIndependentMode，D-01 用户锁定行为落地）— 44-09/5716f7a"
    - "G-44-2b：webview 空索引 meta 副作用随直连消失，cacheEnabled 登记门槛护栏留存（main.js:399）— 44-09"
    - "G-44-4a：录制中按钮停止方块图标（icon-stop + updateRecordUi 双图标切换）— 44-09/0216cc9"
    - "G-44-4b：不可转格式（fMP4/AES-128 密文）前置嗅探显式拒转 + 产物字节数终检（empty_output）+ 任务页三条失败文案 — 44-11/b3bd216,32ff0bd,c450960"
    - "G-44-5：convert/record 终态应用内 toast（preload onMediaTaskChanged → renderer initMediaTaskToast → 点击 showInFolder 定位），系统通知链路保留 — 44-10/143ae64,0a079b5"
    - "G-44-7：主窗口任务角标监听命名空间修复（realmAPI → mediaAPI，监听真正注册）— 44-13/9858a1a"
    - "G-44-8：抽屉「同时删除条目（含观看历史）」checkbox + playerHistory.deleteByKey 参数化联动 + 「最近观看」时钟图标 — 44-12/0f934f5,b1919d8,44a24ef"
    - "G-44-9：任务页操作失败可见反馈条（showTaskFeedback，textContent + 4s 覆盖重挂）+ no_segments 解释性中文 — 44-13/25d5a5d"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "webview tab 直连下 m3u8 直接播放可正常识别为多媒体（端到端）——CR-06 表态：代码结构 VERIFIED，端到端可播性依赖真实源站"
    test: "UAT 第 2 项收紧版：在「不发 Access-Control-Allow-Origin + 校验 Referer + 需 Cookie」的真实源站上，webview tab 播放器直连播放 m3u8，观察能否识别为多媒体并起播"
    expected: "能直连播放且行为与 Phase 43 一致；若失败，按 CR-06 三选一（webRequest 层传输补偿 / 回退 /proxy / 修正注释）作为新 gap 闭环"
    why_human: "hls.js XHR 的 CORS/Referer/Cookie 行为只有真实源站可证；44-REVIEW.md CR-06 已论证新增注释的技术依据（Cookie 天然携带/像网页自身播放）与浏览器网络栈实际行为矛盾，直连对受保护源站可能不可用——不能只测开放 CORS 的源"
  - truth: "关窗/应用退出两级确认（D-19）按预期弹一次并记住默认（前轮 #12 保持，WR-05 提示取消退出后确认可能被静默跳过）"
    test: "dev/打包环境：有活跃录制时关播放器窗口观察确认框与 checkbox 记忆；Cmd+Q 取消退出后再关播放器窗口，确认录制确认框仍弹出"
    expected: "窗口级确认弹一次、写 settings.recordCloseAction；取消退出后确认不被永久跳过"
    why_human: "对话框/退出流程交互无自动化测试；WR-05（appQuitting 置位后永不复位）影响面需真机判定"
human_verification:
  - test: "UAT 第 2 项（CR-06 收紧版）：webview tab 内用「无 ACAO + Referer 校验 + Cookie 门控」真实源站直连播放 m3u8"
    expected: "直连播放可识别为多媒体且与 Phase 43 行为一致；若不可用则按 CR-06 方案①/②/③ 建新 gap"
    why_human: "CORS/Referer/Cookie 端到端行为只有真实源站可证（CR-06 依据见 44-REVIEW.md）"
  - test: "录制进行中观察工具栏按钮（UAT 4.1）：红点闪烁之外按钮图标可辨识"
    expected: "录制中显示停止方块图标、停止后恢复描边圆点、title 切换「停止录制/开始录制」"
    why_human: "图标视觉语义需真机目检"
  - test: "直播录制/转换全链路（UAT 4.2/6，真实源）：B 站直播（fMP4 流）与正常 TS 直播源各录一段"
    expected: "fMP4 流停止录制后任务页显示「MP4 转换失败：分片格式暂不支持转换（仅支持 MPEG-TS）」且无 0 字节产物；正常 TS 源转换产物在播放器播放、时长/音画正常"
    why_human: "真实分片流格式无法在单测环境复现；G-44-4b 的端到端验收"
  - test: "终态 toast（UAT 5）：发起转换或录制→停止，观察主窗口 toast"
    expected: "「MP4 转换完成：{文件名}」/「录制已保存」toast 出现约 5s，点击在 Finder 定位产物；失败任务弹 error toast"
    why_human: "toast 视觉呈现与点击链路需运行中的应用验证"
  - test: "任务角标（UAT 7）：录制进行中观察主窗口工具栏"
    expected: "角标出现（数字=running 数）、停止后归零消失、点击跳 realm://tasks"
    why_human: "G-44-7 修复后的真机显隐行为"
  - test: "抽屉删除两路径（UAT 8）：默认不勾删除 → 条目变「未缓存」；勾选「同时删除条目」删除 → 条目消失且重开抽屉不再出现"
    expected: "文案随勾选联动、确认框居中、meta 行时钟图标 hover 显示「最近观看 时间」"
    why_human: "视觉与交互规格"
  - test: "任务页失败反馈（UAT 9）：对无 meta.json 的中断任务点「已落盘部分续转」等失败操作"
    expected: "反馈条显示「录制中崩溃的任务暂无分片索引，暂不支持续转」约 4s 消失；停止/定位失败同样有可见反馈"
    why_human: "显隐时机与文案观感需真机操作失败场景"
  - test: "关窗/应用退出两级确认（D-19，前轮 #12 保持；见 behavior_unverified_items 第 2 项）"
    expected: "窗口级确认弹一次并记忆默认；取消退出后确认不被永久跳过（WR-05）"
    why_human: "退出流程交互无自动化测试"
---

# Phase 44: 播放器视频缓存与本地媒体库 Verification Report（第二轮 gap-closure 复验，44-09~44-13）

**Phase Goal:** 独立播放器的 HLS 本地媒体库能力（webview tab 模式保持现状不做缓存）：① 独立窗口收口 /proxy；② 分片级磁盘缓存 + FIFO 淘汰 + 设置页配置；③ 观看历史精确续播；④ 统一媒体任务中心（直播录制 + mux.js 转封装）；⑤ realm://tasks 任务页 + 角标。
**Verified:** 2026-09-07T07:43:36Z
**Status:** human_needed（代码层 0 失败 gap；14/16 核实，2 项 PRESENT_BEHAVIOR_UNVERIFIED；8 项 human-only 复测待 UAT）
**Re-verification:** Yes — 第二轮 gap-closure 后复验（前轮 human_needed 20/21 + 8 项 UAT gap；本轮 44-09~44-13 五计划闭合 G-44-2/2b/4a/4b/5/7/8/9，commit 5716f7a..364a58c）

## Goal Achievement

**复验结论：8 个 UAT gap 的修复经代码逐行核实全部结构性闭合**——本轮核心 truths 全部 ✓（除 2 项端到端行为依赖真实源站/真机，归 PRESENT_BEHAVIOR_UNVERIFIED 并入 human 列表）。实跑全绿：test-media-remuxer 23/23（含嗅探契约 6 用例）、test-media-cache 20/20、test-media-task-registry 26/26、test-m3u8-playlist-parser 15/15、test-player-history 7/7（新建）、test-unified-navigation 32/32、npm run test:memory 56/56；8 个改动源文件 node --check 全过。前轮 21 条 truths 受本轮触碰的链路（main.js 缓存命中优先/cancel 桥、player.js proxiedUrl、remuxer、tasks 页、preload/renderer）逐一回归核实**无回归**；未触碰链路保持前轮结论。44-REVIEW.md 增量复评（1 Critical / 1 Warning / 4 Info）中 CR-06/WR-07 表态见下。

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | G-44-2：webview tab 播放器直连拉流，proxiedUrl 守卫仅 isIndependentMode（D-01 代码层落地） | ✓ VERIFIED | player.js:328 `if (!isIndependentMode \|\| !/^https?:\/\//i.test(url)) return url;`；isWebviewMode 全文零残留（grep 计数 0）；独立窗口分支 :329-335 proxy URL 组装（token/container/referer/cache 透传）原样保留；test-unified-navigation 32/32 |
| 2 | G-44-2：直连下 m3u8 直接播放可正常识别为多媒体（端到端） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 守卫已落地（#1）但端到端可播性依赖真实源站的 CORS/Referer/Cookie 行为。**CR-06 表态（按任务指令裁量）：代码结构 VERIFIED + 端到端 human 判定**——CR-06 论证了新增注释的技术依据不成立（hls.js XHR 是 CORS 门控请求，webview 未关 webSecurity；直连 Referer 变 localhost、容器 Cookie 不随跨源 XHR 发送），受保护源站直连可能不可用且此前 /proxy 正为解决此问题而建。按诚实验证器原则不判 FAILED（守卫行为本身是 D-01 用户锁定决策且开放源站可播）、不判 VERIFIED（无任何测试执行过真实源站直连）→ 归 human 第 1 项（收紧版：必须用无 ACAO + Referer 校验 + Cookie 门控源站验证；若失败按 CR-06 方案①/②/③ 建新 gap） |
| 3 | G-44-2b：webview 空索引 meta 副作用随直连消失 + cacheEnabled 登记门槛护栏留存 | ✓ VERIFIED | webview 流量不再进 /proxy（#1）；main.js:399 `if (cacheEnabled && mediaCache) {` 门槛在位（grep 确认）；test-media-cache 20/20 |
| 4 | G-44-4a：录制中按钮显示停止方块图标（接线层） | ✓ VERIFIED | player.html:85 `<svg id="icon-stop" … style="display:none">`；player.js:822-823 updateRecordUi 双图标对称切换（iconRecord/iconStop）；title 切换 :824；红点/IPC 链路未触碰。图标视觉目检留 human 第 2 项 |
| 5 | G-44-4b：fMP4 分片（moof/ftyp 开头无 0x47）被前置嗅探拒绝 reason=unsupported_container | ✓ VERIFIED | media-remuxer.js:98-135 sniffContainerFormat 四判定（0x47 放行 :114 → box 特征 :116-119 → 高熵 ≥240 :122-128 → 未知 :④）；检查点 :243-249 置于 shouldCancel（:236-240）之后、push（:254）之前、仅首片（i===0）；单测 fMP4 拒转 + 产物清理通过 |
| 6 | G-44-4b：AES-128 高熵密文分片被拒绝 reason=encrypted_stream | ✓ VERIFIED | 嗅探判定③（:122-128，4KB 采样 distinct ≥ ENTROPY_DISTINCT_THRESHOLD）；单测高熵拒转通过 |
| 7 | G-44-4b：0 字节产物按 empty_output 失败处理并清理半成品 | ✓ VERIFIED | media-remuxer.js:265-277 stream.end 回调 statSync 终检，outSize===0 → settled + unlinkSync + reject(remuxError('empty_output'))；单测经伪 TS 路径行为性覆盖（Test 3：0x47 放行后由终检兜底 empty_output） |
| 8 | G-44-4b：任务页失败文案覆盖三个新 reason | ✓ VERIFIED | main.js:3011-3013 CONVERT_FAIL_TEXT 三条中文映射；grep 确认 + remuxer 测试内覆盖断言通过 |
| 9 | G-44-4b：正常 MPEG-TS 分片转封装路径零回归 + shouldCancel 取消检查先于嗅探（44-08 契约） | ✓ VERIFIED | 源码序：shouldCancel :236-240 < 嗅探 :243 < push :254；单测 Test 3（0x47 放行，绝不落 unsupported_container/encrypted_stream）+ Test 4（取消占位分片仍 cancelled）+ 结构断言全绿（remuxer 23/23）。**WR-07 表态：不构成 failed gap**——must-have 字面范围（「嗅探对 0x47 开头分片放行」）已被单测证明成立；WR-07 指出的 ID3/前导 TS（首字节 0x49，此前可转）会被判定④误拒，属 must-have 字面范围外的子类回归风险，按项目「Warning 记债务不阻断收尾」先例记 REVIEW.md 债务；建议后续按 WR-07 fix 放宽为 188 周期同步字节扫描并补 ID3 前导用例 |
| 10 | G-44-5：convert/record 终态主窗口应用内 toast 链路（监听/终态过滤/文案契约/点击定位） | ✓ VERIFIED（接线层） | preload.js:1550 mediaAPI.onMediaTaskChanged（media-task:changed 透传 + removeListener 契约）；renderer.js:10581-10613 initMediaTaskToast（completed/failed 过滤、文案与 showTaskNotification 契约一致、outputPath → downloadAPI.showInFolder、duration 5000）；:4209 接线；main.css:1477-1480 `.toast.toast-clickable`（含 pointer-events:auto——执行期 Rule 1 自动修复，点击可达）；index.html:11 main.css?v=6；main.js 零改动（showTaskNotification 系统通知链路保留，prohibition 达成）。toast 实际弹出/点击定位留 human 第 4 项 |
| 11 | G-44-7：主窗口任务角标监听真正注册（命名空间错配修复） | ✓ VERIFIED | renderer.js:10565-10566 `window.mediaAPI.onMediaTaskCountChanged`（与 preload :1537 定义命名空间一致），realmAPI 命名空间引用清零（grep 确认）；main.js:2132 count-changed 广播源在位；真机角标显隐留 human 第 5 项 |
| 12 | G-44-8：抽屉「同时删除条目（含观看历史）」checkbox + playerHistory.deleteByKey 联动 + 时钟图标 | ✓ VERIFIED | player-history-manager.js:124-129 deleteByKey（prepare 参数化 DELETE + changes>0 判定 + 非法入参 false 不抛）；ipc-handlers.js:2333-2337 严格 `deleteEntry === true` + `r.success` 前置 + 非 hex 原始入参门 → deleteByKey，返回补 historyDeleted；preload.js:1650 签名扩展向后兼容；player.html:133 checkbox；player.js:1082 openDeleteConfirm 复位 unchecked + :1089-1094 文案联动（默认文案 UI-SPEC 契约原文逐字）+ :1103 确认透传勾选态；:996-1003 时钟 svg + title 完整时间；player.css 两组样式；test-player-history 7/7。默认不勾 = 仅删缓存（D-16 语义锁定，IPC 缺省路径零触达 playerHistory）。真机两删除路径留 human 第 6 项 |
| 13 | G-44-9：任务页操作失败可见反馈条 + no_segments 解释性文案 | ✓ VERIFIED | tasks.html:19 `#taskFeedback`（CSS 类初始隐藏，realm:// 约定）；tasks-page.js:321-329 showTaskFeedback（textContent 写入防注入 + 定时器先清再重挂 4s 覆盖）；apiAction 非 success :304 + catch :310 两分支接线，loadTasks 轮询分支刻意不接（防噪）；main.js:2286 no_segments → 「录制中崩溃的任务暂无分片索引，暂不支持续转」（cancelled 分支「已取消转换」保持）；main.css:9222-9235。真机反馈时机留 human 第 7 项 |
| 14 | 前轮 truths 回归：本轮触碰链路无回归（cache 命中优先 / cancel 桥接 / 导航包装 / 角标数据链） | ✓ VERIFIED | main.js:369 lookup 仍先于 :388 ses.fetch（CR-01 结论保持）；:2193 recordEngine.stopRecord + :2220 convertCancelTokens（CR-04 结论保持）；test-unified-navigation 32/32、test-media-cache 20/20、test-media-task-registry 26/26、test:memory 56/56；media-cache-manager.js / media-task-manager.js / media-record-engine.js 本轮零改动 |
| 15 | 关窗/应用退出两级确认（D-19，前轮 #12 保持） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 接线在位未触碰；WR-05（appQuitting 永不复位）仍在，gap-closure 明示范围外 → 保持前轮结论，见 behavior_unverified_items + human 第 8 项 |
| 16 | 【禁止】webview tab 模式不做缓存（D-01，前轮 #19 强化） | ✓ VERIFIED | 本轮修复使该 prohibition 结构性强化：cache=1 参数仅经 proxiedUrl 注入（player.js:331-334），而 proxiedUrl 守卫仅 isIndependentMode → webview 流量结构性无法携带 cache/vid 参数进 /proxy（此前仅靠 URL 注入点约定）；main.js:399 cacheEnabled 门槛双保险 |

**Score:** 14/16 truths verified（0 failed，2 PRESENT_BEHAVIOR_UNVERIFIED = #2/#15）

### Deferred Items

无新增顺延。WR-C（硬崩溃续转能力：录制中周期写轻量 meta / `<seq>.ts` 合成索引）经 UAT 第 9 项用户判定记 REVIEW.md 债务（非 gap：本阶段目标已按用户裁量收缩为「修失败反馈」，G-44-9 闭环）；AES-128 解密与 fMP4 拼接同理（44-11 锁定为可选增强债务）。

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | None | — | 本轮复验未发现无确定性证据的新范围发现；CR-06/WR-07/IN-05~08 均有代码级/单测级证据并已在 truths 或 Anti-Patterns 中表态 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| src/player.js | 直连守卫 + 双图标 + 删除勾选/时钟图标 | ✓ VERIFIED | 语法过；四组改动逐行核实 |
| src/player.html / player.css | icon-stop / checkbox / 样式 | ✓ VERIFIED | :85 / :133 / 样式组 grep 确认 |
| media-remuxer.js | sniffContainerFormat + empty_output 终检 | ✓ VERIFIED | 纯 Node（require 直跑 ok）、四判定 + 检查点序正确 |
| main.js | 注释同步 / CONVERT_FAIL_TEXT / no_segments 文案 | ✓ VERIFIED | 逻辑变更仅文案映射，缓存/cancel 链路零改动 |
| player-history-manager.js | deleteByKey 参数化 | ✓ VERIFIED | prepare + ? 占位（prohibition 达成）；7/7 单测 |
| ipc-handlers.js | deleteEntry 严格布尔门 | ✓ VERIFIED | :2333-2337；缺省路径零触达 playerHistory |
| src/preload.js | onMediaTaskChanged + deleteCacheEntry 扩展 | ✓ VERIFIED | :1550 / :1650；G-44-7 窗口内零改动（git diff 为空，prohibition 达成） |
| src/renderer.js | initMediaTaskToast + mediaAPI 角标监听 | ✓ VERIFIED | :10565 / :10581 / :4209 |
| src/tasks.html / tasks-page.js / main.css | 反馈条三件套 | ✓ VERIFIED | textContent + 定时器重挂 + CSS 类初始隐藏 |
| tests/test-player-history.js | 新建单测 | ✓ VERIFIED | 7/7 全绿（本轮实跑） |
| tests/test-media-remuxer.js | 嗅探契约 describe | ✓ VERIFIED | 23/23 全绿（本轮实跑，含 6 新用例） |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| webview player 页 | 源站 m3u8（直连） | proxiedUrl 守卫 return url | ✓ WIRED | player.js:328；端到端可播性见 truth #2（CR-06） |
| 独立窗口 player 页 | /proxy（缓存链路） | proxiedUrl 改写 | ✓ WIRED | :329-335 零回归 |
| main.js persistMediaTasks 状态 diff | 主窗口 renderer toast | broadcast('media-task:changed') → preload :1550 → renderer :10583 | ✓ WIRED | 全链路命名空间一致（三端核实） |
| main.js count-changed 广播 | 主窗口角标 | mediaAPI.onMediaTaskCountChanged | ✓ WIRED（G-44-7 修复） | 此前 renderer 引用 realmAPI 短路；现已打通 |
| toast click | Finder 定位 | download:show-in-folder IPC | ✓ WIRED | renderer :10608 + .toast-clickable pointer-events:auto（main.css:1479） |
| 抽屉 checkbox | playerHistory 删除 | deleteCacheEntry(key, checked) → player:cache:delete → deleteByKey | ✓ WIRED | 严格布尔门 + 缓存删除成功前置 + hex 防御 |
| apiAction 失败 | 反馈条 | showTaskFeedback(data.error) | ✓ WIRED | 两分支接线；textContent 防注入 |
| convert-resume no_segments | 解释性文案 | main.js:2286 后端翻译 | ✓ WIRED | 任务页零特判 |
| 首分片 → mux.js | 嗅探闸门 | sniffContainerFormat @ push 前 | ✓ WIRED | 取消检查先于嗅探（44-08 契约保序） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| toast 文案 | task.outputPath/title/error | 主进程任务注册表快照 | ✓ | ✓ FLOWING |
| 角标计数 | data.count | count-changed 广播（persist diff） | ✓ | ✓ FLOWING（G-44-7 修复后 renderer 真实可达） |
| 反馈条文案 | data.error | 主进程端点 error 字段 | ✓ | ✓ FLOWING |
| 时钟 tooltip | item.lastWatched | player_history 表 | ✓ | ✓ FLOWING |
| 嗅探判定 | 分片首部 64KB | 磁盘真实分片文件 | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| remuxer 单测（含嗅探契约 6 用例） | node tests/test-media-remuxer.js | 23 pass / 0 fail | ✓ PASS |
| 缓存管理器单测 | node tests/test-media-cache.js | 20 pass / 0 fail | ✓ PASS |
| 任务注册表单测 | node tests/test-media-task-registry.js | 26 pass / 0 fail | ✓ PASS |
| m3u8 解析器单测 | node tests/test-m3u8-playlist-parser.js | 15 pass / 0 fail | ✓ PASS |
| player-history 单测（deleteByKey 闭环） | node tests/test-player-history.js | 7 pass / 0 fail | ✓ PASS |
| 导航回归 | node tests/test-unified-navigation.js | 32 通过 / 0 失败 | ✓ PASS |
| 内存测试 | npm run test:memory | 56 pass / 0 fail | ✓ PASS |
| 语法检查（8 文件） | node --check main.js / ipc-handlers.js / media-remuxer.js / player-history-manager.js / src/player.js / src/renderer.js / src/preload.js / src/tasks-page.js | 全过 | ✓ PASS |
| 直连守卫 | 源码断言 player.js:328 仅 isIndependentMode + isWebviewMode 计数 0 | 守卫落地 | ✓ PASS |
| 嗅探检查点序 | 源码断言 shouldCancel(:236) < sniff(:243) < push(:254) | 取消优先序保持 | ✓ PASS |
| 命中先于回源（回归） | 源码断言 lookup@369 < ses.fetch@388 | CR-01 结论保持 | ✓ PASS |
| cancel 桥接（回归） | grep stopRecord@2193 + convertCancelTokens@2220 | CR-04 结论保持 | ✓ PASS |
| G-44-7 命名空间 | grep mediaAPI.onMediaTaskCountChanged 计 1 + realmAPI 残留计 0 | 错配清零 | ✓ PASS |

### Probe Execution

无 probe 脚本声明（非迁移/tooling phase）；以 7 个测试套件实跑 + 8 文件语法检查替代。

### Requirements Coverage

REQUIREMENTS.md 无 Phase 44 需求 ID（specless，前轮已确认）。本轮五个计划 requirements 声明（D-01/D-03/D-21、D-26、D-04/D-24、D-11/D-14/D-15/D-16、D-18/D-22/D-26）逐一对照 44-CONTEXT.md——D-01~D-26 全部真实存在，无孤儿、无虚构编号。D-11（双层设计）/D-16（删除）/D-26（任务页+角标+通知）经本轮修复后覆盖完整；D-26 的「系统通知」子项因环境级 ad-hoc 签名不可用，已按 UAT 推荐方案以应用内 toast 达成同等目标（系统通知代码保留，正式签名后双通道）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| media-remuxer.js | 114-135 | WR-07：嗅探判定①仅校验首字节，ID3/timed-metadata 前导的合法 TS（首字节 0x49）被判定④误拒——相对嗅探前是子类回归 | ⚠️ Warning | 见 truth #9 表态：不构成 failed gap（must-have 字面范围已证），记 REVIEW.md 债务；建议 188 周期同步字节扫描 + box 起始偏移限定 + 补 ID3 前导用例 |
| src/player.js / main.js / renderer.js | 310-313 / 669-671 / 387-390 | CR-06：直连注释技术依据不成立（Cookie「天然携带」、「像网页自身播放一样」与 hls.js XHR CORS 门控事实矛盾），违背「两处注释互引同步」纪律的错误声明 | 🛑→📋 | **表态：不判 BLOCKER**——代码行为（直连）是 D-01 用户锁定决策，注释错误属文档缺陷而非目标缺陷；端到端影响面已升格为 behavior_unverified + human 第 1 项（收紧版源站）；UAT 判定失败则按 CR-06 方案①/②/③ 建新 gap，届时注释修正并入修复 |
| media-remuxer.js | 107 | IN-05：首分片读取失败（TOCTOU/权限）映射 unsupported_container，与 segment_missing 语义重叠误导 | ℹ️ Info | 不影响 must-have；建议按 err.code 区分 |
| src/renderer.js | 10591/10599 | IN-07：toast 文案与系统通知契约两处分叉（record failed 缺「录制失败：」前缀；split('/').pop() vs path.basename） | ℹ️ Info | 不影响 G-44-5 真值成立（convert failed 前缀已带）；建议抽公共文案或注释互引 |
| main.js | 2286 | IN-08：no_segments 文案过拟合「崩溃」成因（meta 存在但分片为空同样返回 null，文案与事实可能不符） | ℹ️ Info | G-44-9 可见性目标已达成，文案精度问题；建议中性表述 |
| ipc-handlers.js / player.js | 2336 / 1104-1114 | IN-06：deleteEntry=true 时历史删除失败对用户静默（historyDeleted 返回值未被 confirm 处理器消费） | ℹ️ Info | 缺省/勾选主路径行为正确；建议消费 historyDeleted 提示 |
| （历史段）WR-A/B/C/05/01-04、IN-01-04 | — | 前轮债务维持不动（44-09~13 未触碰） | ⚠️/ℹ️ | 见 44-REVIEW.md 历史段与前轮报告 |

（gap-closure 涉及文件无 TBD/FIXME/XXX 债务标记、无 stub 返回值；node --check 全过。）

### Human Verification Required

见 frontmatter `human_verification`（8 项）。要点：第 1 项为本轮唯一实质性新风险（CR-06），必须用「无 ACAO + Referer 校验 + Cookie 门控」的真实源站验证，若不可用按 CR-06 三选一建新 gap；第 2~7 项为各 gap 修复的真机验收（对应 UAT 第 4/5/6/7/8/9 项复测）；第 8 项为前轮保持项。

### Gaps Summary

**代码层 0 failed gap。** 8 个 UAT gap（G-44-2/2b/4a/4b/5/7/8/9）经代码逐行核实全部闭合：直连守卫落地且空索引副作用结构性消失并留护栏；录制按钮停止图标接线完整；嗅探拒转 + 产物终检 + 文案映射由 6 个新单测锁定（remuxer 23/23）；toast/角标/反馈条/删除联动四条 UI 链路三端命名空间与接线一致（角标链路 G-44-7 命名空间错配确已修复）；deleteByKey 参数化 + 三重护栏达成 prohibition。7 个测试套件 + test:memory 实跑全绿，前轮关键结论（CR-01 命中优先、CR-04 cancel 桥接、CR-02/03/05）回归核实无回归。

**两项保留 PRESENT_BEHAVIOR_UNVERIFIED**：① webview 直连端到端可播性（CR-06——代码结构正确、端到端依赖真实源站 CORS/Referer/Cookie 行为，评论依据矛盾已如实记录，收紧版 UAT 承载）；② 关窗/退出两级确认（前轮 #12 保持）。

**WR-07 表态**：不构成 failed gap（G-44-4b must-have 字面范围「0x47 开头分片放行」已被单测证明）；ID3 前导 TS 子类回归风险记 REVIEW.md 债务，建议与后续嗅探放宽一并处理。

**状态说明**：status = human_needed——代码层 must-have 全部核实（14/16）、无 failed gap；8 项 human-only 复测待 UAT 真机执行。若以代码闭合为门槛，本复验结果 = 通过（可进入 UAT）；UAT 通过即 phase.complete（既有收尾约定）。

---

_Verified: 2026-09-07T07:43:36Z_
_Verifier: Claude (gsd-verifier) — second re-verification after gap closure (44-09~44-13)_

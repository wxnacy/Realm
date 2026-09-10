---
phase: 44-player-video-cache-and-local-media-library
plan: 08
subsystem: media
tags: [cr-04, cancel-bridge, stop-record, cooperative-cancellation, shouldCancel, convert-cancel-token]

# Dependency graph
requires:
  - phase: 44-07
    provides: CR-02/CR-03 修复后 main.js 现状（RECORD_ROOT 常量、readRecordTaskSegments 补算、mediaTaskManager 注册表）；handleTasksApi cancel 路由（:2152-2170 旧语义仅 cancelTask——CR-04 改造对象）
  - phase: 44-04
    provides: media-record-engine 的 stopRecord 原语（停轮询 + writeMeta + completeTask，D-22 接力点）与 pollLoop st.stopped 检查点语义
  - phase: 44-03
    provides: media-task-manager 状态机（registerTask/completeTask/cancelTask/failTask 非法流转拒绝、onTaskCompleted 注册点）
  - phase: 44-05
    provides: media-remuxer convertToMp4（单实例顺序 push、fail() 清理半成品）与 startConvertTask 编排现状
provides:
  - CR-04 修复：任务页「停止」对 running record 真实生效——/api/tasks/cancel 桥接 recordEngine.stopRecord（与红点停止同原语：引擎停轮询、meta.json 落盘、completeTask 落 completed、D-22 record→convert 接力照常），不再只改注册表状态让录制无限落盘
  - convert 任务真实停止转码：convertToMp4 新增 shouldCancel 协作式取消检查点（每分片迭代前检查），取消后 reason='cancelled'、半成品 mp4 经 fail 路径 unlink 清理、任务落 cancelled（.catch 分支 cancelTask）
  - cancel 端点按类型分派 + 语义零回归：不存在任务 404、非 running 维持 cancelTask 抛非法流转 400、引擎 not_found 时仅在任务仍 running 才 cancelTask 兜底（已终态返回 200 当前态不二次流转）
affects: [44-VERIFICATION（CR-04 修复后 5 个 failed truths 全闭合；human_verification 第 4 项真机复测：任务页对 running 直播录制点停止即刻停录弹 D-22 转换框）、44-UAT（长任务转码中点停止落「已取消」且无半成品残留）]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 3300
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "类型分派的取消路由：/api/tasks/cancel 按 existing.type（record/convert）分派——record 走引擎停止原语（stopRecord），convert 走协作式信号（convertCancelTokens 触发 shouldCancel 闭包），状态标记（cancelTask）仅在引擎/转码已停后落定；「停止 = 真实停止」语义单一来源在引擎/转码层"
    - "协作式取消信号注册表：模块级 convertCancelTokens Map（convert taskId -> () => void）——startConvertTask 注册（shouldCancel 闭包置位标志）、promise 链 .finally 注销（终态收敛防 Map 泄漏）；取消粒度 = 单分片处理时间（主进程事件循环内同步循环最小可打断单元）"

key-files:
  created: []
  modified:
    - main.js
    - media-remuxer.js
    - tests/test-media-remuxer.js

key-decisions:
  - "cancel 对 running record 走 recordEngine.stopRecord（引擎完成 completeTask 后无需再 cancelTask）：stopRecord 内部完成 completeTask（completed 带 outputPath）触发 persist diff 广播 + D-22 onTaskCompleted 接力——任务页停止语义 = 红点停止 = 停止并保存；仅引擎 not_found 且回读仍 running 才 cancelTask 兜底防悬挂（采纳 VERIFICATION missing 原文语义）"
  - "convert 取消为协作式而非强制中断：convertToMp4 同步循环无法被异步打断，shouldCancel 每分片迭代前检查（reason='cancelled'）是结构上最小可打断单元；信号由 cancel 路由经 convertCancelTokens 触发，发信号即返回 200（note:'stop-signalled'），实际终态由转码 promise 链 .catch 分支异步落 cancelled"
  - "reason='cancelled' 拦截在失败文案映射之前：CONVERT_FAIL_TEXT 无 cancelled 条目，.catch 开头按 err.reason==='cancelled' 走 cancelTask（任务落 cancelled 而非 failed/MP4 转换失败）"
  - "token 注销用 .finally（非仅 .catch）：完成/失败/取消三路径均收敛；终态竞态（循环越过最后检查点后到达的信号）接受——任务按 completeTask 收尾为 completed"

patterns-established:
  - "停止桥接先例：HTTP 控制端点对运行中实体的「停止」必须桥接到实体自身的停止原语（引擎/转码层），状态标记只是结果不是原因——CR-04 根因回归防护"
  - "Map 令牌生命周期契约：注册（任务启动）→ 触发（控制端点）→ 注销（promise 链 finally），任何终态路径收敛，防无界增长"

requirements-completed: [D-18, D-25, D-26]

coverage:
  - id: C1
    description: "CR-04 record 停止桥接：/api/tasks/cancel 对 running record 调 recordEngine.stopRecord(taskId)（引擎停轮询 + meta.json 落盘 + completeTask → completed + D-22 接力）；引擎 not_found 时仅在任务仍 running 才 cancelTask 兜底，已终态返回 200 当前态"
    requirement: D-25
    verification:
      - kind: other
        ref: "main.js 源码 gate：grep recordEngine.stopRecord(taskId) 命中（cancel 路由 :2192）；注释无「cancel 只改状态/停不下来」反义表述"
        status: pass
      - kind: other
        ref: "node --check main.js 语法通过"
        status: pass
      - kind: unit
        ref: "node tests/test-media-task-registry.js（26/26 注册表零改动回归不红）"
        status: pass
    human_judgment: false
  - id: C2
    description: "CR-04 convert 协作式取消：convertToMp4 shouldCancel 检查点（reason='cancelled' + fail 路径 unlink 半成品）；startConvertTask 注册/注销 convertCancelTokens（set + .finally delete）；.catch 对 cancelled 走 cancelTask 而非 failTask"
    requirement: D-26
    verification:
      - kind: unit
        ref: "tests/test-media-remuxer.js#shouldCancel=true 即拒转 reason=cancelled 且产物清理（CR-04 取消路径）"
        status: pass
      - kind: unit
        ref: "tests/test-media-remuxer.js#shouldCancel=false 行为不变（CR-04 回归：新入参不改变默认路径）"
        status: pass
      - kind: unit
        ref: "node tests/test-media-remuxer.js（17/17：15 既有 + 2 新增）"
        status: pass
      - kind: other
        ref: "main.js 源码 gate：startConvertTask 含 shouldCancel: () => convertCancelled 传入与 convertCancelTokens.delete 的 .finally 注销；.catch 含 err.reason === 'cancelled' → cancelTask(taskId, '用户取消') 分支"
        status: pass
    human_judgment: false
  - id: C3
    description: "取消入口鉴权与非法流转语义零回归：token 鉴权保持；不存在任务 404（比旧 cancelTask not_found 的 400 更精确）；非 running 维持 cancelTask 抛非法流转 400；其他类型回落原语义"
    requirement: D-25
    verification:
      - kind: unit
        ref: "node tests/test-media-task-registry.js（26/26 cancelTask 非法流转语义未改）"
        status: pass
      - kind: unit
        ref: "node tests/test-unified-navigation.js（32/32 本 plan 无新导航入口回归）"
        status: pass
    human_judgment: false
  - id: H1
    description: "真机复测（44-VERIFICATION human_verification 第 4 项，CR-04 修复后）：任务页对 running 直播录制点停止 → 红点/任务状态即刻停录、meta.json 落盘、弹出 D-22 转换选目录；长任务转码中点停止 → 任务落「已取消」、产物目录无半成品残留"
    verification:
      - kind: manual_procedural
        ref: "44-VERIFICATION.md human_verification 4 + plan <verification> 第 4 条"
        status: unknown
    human_judgment: true
    rationale: "任务页「停止」按钮与真实录制/转码现场（userData 磁盘、真实直播源、长转码）依赖真机交互，dev 环境无法自动化；CR-04 单测与源码 gate 已自动化证明桥接与取消语义，本条留 UAT 真机判定"

# Metrics
duration: 8min
completed: 2026-09-06
status: complete
plan_head_before: c215ba38ef04a2c3de9c801cb3aac034b5965406
commits: 2
---

# Phase 44 Plan 08: CR-04 gap 闭合 — /api/tasks/cancel 桥接引擎停止原语 + convert 协作式取消信号 Summary

**把任务页「停止」从状态标记变成真实停止：running record 经 recordEngine.stopRecord（与红点停止同原语——引擎停轮询、meta.json 落盘、completed + D-22 record→convert 接力），running convert 经 convertCancelTokens → convertToMp4 shouldCancel 协作式取消（reason='cancelled' + 半成品清理 + 任务落 cancelled）——CR-04 无限落盘根因在生产路径闭合**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-06T14:37:00Z
- **Completed:** 2026-09-06T14:45:00Z
- **Tasks:** 2
- **Files modified:** 3（main.js / media-remuxer.js / tests/test-media-remuxer.js，+154/-18）

## Accomplishments

- **CR-04 record 停止桥接（main.js handleTasksApi cancel 路由）**：cancel 路由按任务类型分派——入口校验（token 鉴权 :2138、taskId 字符串校验、注册表 503）保持不变，其后逻辑整体替换：`existing = listTasks().find(...)` 不存在 → 404（比旧实现把 not_found 丢给 cancelTask 的 400 更精确）；非 running → cancelTask 抛非法流转 400（行为不回归）；running record → `await recordEngine.stopRecord(taskId)`（引擎停轮询 + writeMeta meta.json 落盘 + completeTask 落 completed，persist diff 广播任务页/角标刷新 + onTaskCompleted 触发 D-22 接力弹转换框，任务页停止语义 = 红点停止 = 停止并保存），r.ok → 200 `{success:true, task, stopped:'record-engine'}`；引擎 not_found（任务刚被自然完成/失败或并发竞态）→ 回读 fresh 仍 running 才 cancelTask 兜底（try/catch → 400），已终态 → 200 `{task, note:'already-stopped'}`（不二次流转）；其他引擎错误 → 400
- **CR-04 convert 停止信号分派（cancel 路由 + 模块级令牌）**：running convert → `convertCancelTokens.get(taskId)` 触发（stop() try/catch 忽略）→ 200 `{success:true, task, note:'stop-signalled'}`（只发信号不等转码循环，终态由 promise 链 .catch 异步落定）；其他类型回落原 cancelTask 语义。路由上方块注释说明 CR-04 根因与分派语义（record=引擎停止原语、convert=协作式信号、状态标记仅在引擎/转码已停后落定），无与 gate 冲突的反义表述
- **convertToMp4 shouldCancel 协作式取消（media-remuxer.js）**：入参解构新增 `shouldCancel`（可选函数）+ JSDoc @param 与失败原因清单补 'cancelled'（用户取消转换）；顺序 push 循环在 `if (settled) return;` 之后、`transmuxer.push(...)` 之前插入一行取消检查——`typeof shouldCancel === 'function' && shouldCancel()` 成立即 `fail(remuxError('cancelled', '用户取消转换'))` 并 return（fail 复用既有 destroy stream + unlinkSync(outputPath) 清理半成品；settled 守卫防与 stream.end 竞态）。取消粒度 = 单分片处理时间（主进程事件循环内同步循环最小可打断单元）
- **startConvertTask 令牌接线（main.js）**：taskId 取得后注册 `let convertCancelled = false; const cancelSignal = () => { convertCancelled = true; }; convertCancelTokens.set(taskId, cancelSignal);`，`shouldCancel: () => convertCancelled` 传入 convertToMp4；promise 链 .catch 开头加取消分支——`err.reason === 'cancelled'` → `mediaTaskManager.cancelTask(taskId, '用户取消')`（落 cancelled 而非 failed，拦截在 CONVERT_FAIL_TEXT 文案映射之前）并 return；.then/.catch 之后追加 `.finally(() => convertCancelTokens.delete(taskId))` 注销令牌（三终态路径收敛防 Map 泄漏，T-44-G08-04；终态竞态——循环越过最后检查点后 .then completeTask 正常收尾任务 completed 而非 cancelled，接受该窗口）
- **取消单测（tests/test-media-remuxer.js，套件 15 → 17）**：用例 A「shouldCancel=true 即拒转 reason=cancelled 且产物清理」——mkdtemp 临时目录 + 占位分片（取消检查在首个 readFileSync 前触发，无需真实 TS 载荷），assert.rejects reason==='cancelled'，断言 outputPath 不存在（createWriteStream 已建文件 → fail 的 unlinkSync 真实清理生效）；用例 B「shouldCancel=false 行为不变」——沿用 segment_missing 拒转契约（早于循环取消检查），确认新入参不改变默认路径

## Task Commits

Each task was committed atomically:

1. **Task 1: /api/tasks/cancel 桥接 recordEngine.stopRecord（任务页停止真实停录）+ convertCancelTokens 分派** - `8d4ec86` (fix)
2. **Task 2: CR-04 convert 协作式取消——convertToMp4 shouldCancel 检查点 + startConvertTask 令牌接线 + 取消单测** - `3061ff7` (feat)

## Files Created/Modified

- `main.js` - 模块级 `const convertCancelTokens = new Map()`（:164，注释说明 CR-04 语义）；handleTasksApi cancel 路由整体替换为类型分派（record → recordEngine.stopRecord / convert → convertCancelTokens / 非 running 与兜底 cancelTask / 不存在 404）；startConvertTask 令牌注册 + shouldCancel 传入 + .catch cancelled 分支 + .finally 注销
- `media-remuxer.js` - convertToMp4 解构新增 shouldCancel + JSDoc 补 @param 与失败原因 'cancelled'；顺序 push 循环插入协作式取消检查点（fail('cancelled') 复用半成品清理）
- `tests/test-media-remuxer.js` - 新增「shouldCancel=true 即拒转 reason=cancelled 且产物清理」「shouldCancel=false 行为不变」两用例 + os import + 头注释补 CR-04 覆盖说明

## Decisions Made

- **cancel 对 running record 走引擎停止原语而非 cancelTask**：stopRecord 内部完成 completeTask（completed 带 outputPath）触发 persist diff 广播 + D-22 onTaskCompleted 接力——任务页停止语义与红点停止统一（停止并保存），引擎 completeTask 后无需再 cancelTask（采纳 44-VERIFICATION missing 原文：not_found 时才 cancelTask）
- **convert 取消 = 协作式信号而非强制中断**：convertToMp4 同步循环无法被异步打断，shouldCancel 每分片迭代前检查是结构上最小可打断单元；cancel 路由只发信号（note:'stop-signalled'）即返回，终态由 .catch 分支异步落 cancelled
- **reason='cancelled' 拦截在文案映射之前**：CONVERT_FAIL_TEXT 无 cancelled 条目，.catch 开头按 err.reason 分派走 cancelTask——任务落「已取消」而非「MP4 转换失败：cancelled」
- **令牌注销用 .finally**：完成/失败/取消三路径均收敛；Map 无界增长风险（T-44-G08-04）结构消除

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written（2 个 task 的 acceptance_criteria 与 verify 命令逐条命中，无 Rules 1-4 触发）。

---

**Total deviations:** 0
**Impact on plan:** 无偏离，无 scope creep。

## Issues Encountered

- 无阻塞。gsd-tools 不在仓库内（`gsd-core/` 目录不存在），经 $HOME/.codebuddy/gsd-core 解析使用（warning: defaults.json resolve_model_ids 键被项目配置覆盖，不影响执行）
- REQUIREMENTS.md 为 specless 阶段不含 D-ID 行（与 44-01~44-07 一致），D-18/D-25/D-26 属 CONTEXT.md 决策骨架引用，不在 REQUIREMENTS.md 建行

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- **CR-04 代码层闭合**：单测 remuxer 17/17（15 既有 + 2 新增取消用例）+ 回归 registry 26/26 + cache 20/20 + parser 15/15 + unified-navigation 32/32 全绿；源码 gate（cancel 路由 recordEngine.stopRecord(taskId) 命中、convertCancelTokens 分派与令牌 set/finally delete、shouldCancel 传入、.catch cancelled → cancelTask、注释无反义表述）全过；node --check main.js + media-remuxer.js 语法通过
- **44-VERIFICATION human_verification 第 4 项待真机复测**（CR-04 修复后）：任务页对 running 直播录制点停止即刻停录 + D-22 转换弹框；长任务转码中点停止落「已取消」且无半成品残留——见 coverage H1，走 UAT
- **CR-01~CR-05 五个 failed truths 全闭合**（44-06 修 CR-01/CR-05、44-07 修 CR-02/CR-03、44-08 修 CR-04），44-VERIFICATION 分数可更新为 20/21（唯一余项 = WR-05 关联的 #12 PRESENT_BEHAVIOR_UNVERIFIED，计划已声明范围外）
- 遗留不在本 plan：WR-01~WR-05（WR-05 appQuitting 永不复位修复点在 ipc-handlers.js 不在本 plan files_modified 白名单）、IN-01/03/04（与 5 个 failed truths 无直接映射，UAT 复测 truth #12 时一并观察）

---

*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- 3 个改动源文件 + SUMMARY 全部存在（main.js / media-remuxer.js / tests/test-media-remuxer.js / 44-08-SUMMARY.md）
- 2 个任务 commit 均在 git 历史（8d4ec86 / 3061ff7），ledger 计量（c215ba3..HEAD）= 2 与 actuals 一致
- 计划级验证全绿：main.js + media-remuxer.js + tests/test-media-remuxer.js node --check 通过；remuxer 17/17（含新增取消两用例）；回归 registry 26/26 + cache 20/20 + parser 15/15 + unified-navigation 32/32
- 源码 gate 全过：cancel 路由含 recordEngine.stopRecord(taskId)（grep 命中 :2192）与 convertCancelTokens 分派（:2219 get + :164 模块级 Map）；startConvertTask 含 shouldCancel: () => convertCancelled 传入（:3110）、.catch err.reason==='cancelled' → cancelTask（:3134）、.finally convertCancelTokens.delete（:3151）；media-remuxer.js shouldCancel 计数 3（JSDoc/解构/检查点）；注释无「cancel 只改状态/停不下来」反义残留
- 无 stub（取消信号/令牌路径全部接线，无占位实现）；无新增安全面（T-44-G08-01~04 均在计划 threat_model 内且结构收敛）


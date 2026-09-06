---
phase: 44-player-video-cache-and-local-media-library
plan: 07
subsystem: media
tags: [capacity-eviction, cr-02, cr-03, record-root, watermark, fifo, outputPath-fallback, water-level]

# Dependency graph
requires:
  - phase: 44-06
    provides: handleProxyRequest 命中优先 + store() 源流 error 防护（media-cache-manager storeBuffer 返回值语义、lookup contentType 回放）；main.js /proxy 集成层现状
  - phase: 44-03
    provides: mediaCache 主进程实例 + buildMediaCacheOptions（capacityBytes/cacheMaxGB 注入、isVideoActive 接 mediaTaskManager）
  - phase: 44-02
    provides: media-task-manager registerTask/restoreTasks（outputPath 终态才落库语义、task.id=randomUUID 形态）——CR-03 根因与补算白名单依据
  - phase: 44-04
    provides: media-record-engine 录制目录布局（recordRoot/<taskId>/segments + meta.json，D-23 独立于缓存库）
provides:
  - CR-02 容量 FIFO 淘汰生产生效：storeBuffer 写路径水位淘汰（tracked 水位累计 + 越过 capacityBytes 触发一轮 evictIfNeeded，exempt 正在写 videoId）+ setCapacityBytes（改小 cacheMaxGB 即收敛）——10GB 上限不再形同虚设、缓存收敛于 capacityBytes
  - 性能 guard：水位 O(1) 判定（首写惰性初始化 + 淘汰后 r.total 权威同步），无每分片全库扫描回归；ENOSPC 强淘（D-08）兜底保留
  - CR-03 taskId→录制目录映射恢复：RECORD_ROOT 常量单一来源（createRecordEngine 注入 + readRecordTaskSegments 补算同源）；interrupted/failed 快照 outputPath 缺失时按 path.join(RECORD_ROOT, task.id) 补算（uuid 白名单防路径穿越）——「崩溃不白录」续转链路可读盘
affects: [44-VERIFICATION（CR-02/CR-03 修复后 human_verification 第 4 项真机复测：设置页改小容量逐出、中断录制续转不再 400）、44-08（CR-04 cancel 桥接，wave 顺延）]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 2000
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "写路径容量水位：_trackedTotal（null=未初始化）首写惰性初始化取磁盘权威总量（_writeMeta 已把本片计入 meta.total_size，直接取不再重复加 size 防双计），此后每片 O(1) 加法；仅水位越过 capacityBytes 才 evictIfNeeded 全扫一次并把 r.total 同步回水位（自校正外部删除/deleteEntry 造成的漂移，T-44-G07-02 accept）"
    - "容量变更统一入口：setCapacityBytes(bytes) 校验赋值 + 立即 evictIfNeeded + 水位同步——外部禁止直改 capacityBytes 字段（main.js cacheMaxGB 更新即改即存桥接此方法）"
    - "目录映射补算 + 白名单：outputPath 缺失（终态才落库的恢复快照）按 path.join(RECORD_ROOT, task.id) 补算；task.id 过 /^[0-9a-fA-F-]{8,64}$/ uuid 形态白名单（media-tasks.json 可本地篡改，防补算路径穿越），randomUUID 天然命中"

key-files:
  created: []
  modified:
    - media-cache-manager.js
    - main.js
    - tests/test-media-cache.js

key-decisions:
  - "CR-02 采用水位方案而非每片后全库扫描：旧实现 evictIfNeeded 仅 _writeWithEvictRetry ENOSPC/EDQUOT 分支可达（物理盘满才触发），capacityBytes 上限生产失效；修复后 storeBuffer 成功登记即累计水位，越限才扫——prohibition「数千分片 = 数千次全树扫描」的回归被结构避免"
  - "惰性初始化防双计：水位检查位于 _writeMeta 之后，磁盘权威总量（listEntries 读 meta.total_size）已含本片字节，首写直接取总量、不再 +size；仅 _trackedTotal 非 null 时每片才加 size（采纳 plan-checker fix_hint）"
  - "storeBuffer 自动淘汰 exempt 传 new Set([videoId])（与 _writeWithEvictRetry 同款防误删自己目录）+ D-07 isVideoActive 活跃豁免保持——淘汰始终以磁盘 listEntries 为权威，r.total 同步回水位自校正漂移"
  - "RECORD_ROOT 常量置于 main.js whenReady 作用域（createRecordEngine 调用之前）：与 readRecordTaskSegments 同作用域可引用；字面 path.join(app.getPath('userData'), 'media-records') 在 main.js 仅出现于常量声明一处（引擎写目录与补算回退同源不漂移）"
  - "补算白名单 /^[0-9a-fA-F-]{8,64}$/ 而非复用 videoId hex 白名单：task.id 是 randomUUID（含连字符，36 字符）形态，uuid 白名单天然覆盖且拒绝 ../ 穿越串"

patterns-established:
  - "容量语义契约：生产写路径自动收敛（storeBuffer）+ 配置变更即时收敛（setCapacityBytes）+ 物理满强淘兜底（ENOSPC _writeWithEvictRetry）三层并存，D-06/D-07/D-08 各就其位"
  - "恢复快照补算先例：持久化字段缺失时以「确定性派生值」回填（task.id→目录），白名单校验先于 path.join——本地可篡改 JSON 字段进入文件系统路径的统一收敛姿势（与 T-44-05/T-44-01 同脉络）"

requirements-completed: [D-06, D-07, D-08, D-18]

coverage:
  - id: C1
    description: "CR-02 写路径容量水位淘汰：storeBuffer 落盘登记成功后累计 _trackedTotal，越过 capacityBytes 自动触发一轮 evictIfNeeded（exempt 正在写入 videoId）；首写惰性初始化防双计；无每分片全库扫描"
    requirement: D-06
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#超容量按 last_watched 升序整目录删除（写路径自动触发）"
        status: pass
      - kind: unit
        ref: "tests/test-media-cache.js#写路径超限自动淘汰（仅经 storeBuffer 即发生，FIFO 取最旧）"
        status: pass
    human_judgment: false
  - id: C2
    description: "setCapacityBytes 缩小容量即触发淘汰：main.js cacheMaxGB 更新改走 setCapacityBytes（不再直改字段）；单测断言缩小后按 last_watched 收敛、字段生效"
    requirement: D-06
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#setCapacityBytes 缩小容量立即触发一轮淘汰（CR-02）"
        status: pass
      - kind: other
        ref: "main.js 源码 gate：mediaCache.setCapacityBytes(gb * 1024 * 1024 * 1024) 命中且无 mediaCache.capacityBytes = 直写残留"
        status: pass
    human_judgment: false
  - id: C3
    description: "D-07 豁免语义不回归：活跃任务豁免 + 写目录自豁免（单视频超限不自删）在写路径自动淘汰下仍成立"
    requirement: D-07
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#活跃任务豁免淘汰（isVideoActive 按 playbackKey 匹配，D-07）"
        status: pass
      - kind: unit
        ref: "tests/test-media-cache.js#单视频超限自豁免不自杀（写目录防误删回归锚）"
        status: pass
    human_judgment: false
  - id: C4
    description: "D-08 ENOSPC 强淘兜底保留（_writeWithEvictRetry 未触碰），写路径水位检查不干扰既有强淘语义"
    requirement: D-08
    verification:
      - kind: unit
        ref: "tests/test-media-cache.js#磁盘满强淘重试（D-08）"
        status: pass
    human_judgment: false
  - id: C5
    description: "CR-03 RECORD_ROOT 常量 + readRecordTaskSegments 目录补算：RECORD_ROOT 单一来源（createRecordEngine.recordRoot 与补算同源）；outputPath 缺失按 path.join(RECORD_ROOT, task.id) 补算，task.id uuid 白名单防穿越"
    requirement: D-18
    verification:
      - kind: unit
        ref: "node tests/test-media-task-registry.js（26/26 注册表回归不红）"
        status: pass
      - kind: other
        ref: "源码 gate：main.js 恰 1 处 const RECORD_ROOT = path.join(app.getPath('userData'), 'media-records') 且该字面全文件唯一；readRecordTaskSegments 含 /^[0-9a-fA-F-]{8,64}$/ 白名单校验后才补算；node --check main.js 过"
        status: pass
    human_judgment: false
  - id: H1
    description: "真机复测（44-VERIFICATION human_verification 第 4 项，CR-02/CR-03 修复后）：设置页把 10GB 改小为 1GB 缓存超限视频被逐出；崩溃/中断的录制任务在任务页点「已落盘部分续转」能进入弹框选目录（不再 400）"
    verification:
      - kind: manual_procedural
        ref: "44-VERIFICATION.md human_verification 4"
        status: unknown
    human_judgment: true
    rationale: "改容量逐出与续转弹框依赖真实设置页 HTTP 链路、录制任务状态与 userData 磁盘现场，dev 环境无法自动化；CR-02/CR-03 单测与源码 gate 已自动化证明，本条留 UAT 真机判定"

# Metrics
duration: 5min
completed: 2026-09-06
status: complete
plan_head_before: 473e54ce9636a1d070c129be34466423cc6cfbeb
commits: 2
---

# Phase 44 Plan 07: CR-02/CR-03 gap 闭合 — 容量写路径水位淘汰 + RECORD_ROOT 补算 Summary

**storeBuffer 写路径容量水位淘汰（tracked 水位 O(1) 判定 + setCapacityBytes 改容量即收敛）修复 CR-02、RECORD_ROOT 常量与 readRecordTaskSegments task.id 目录补算修复 CR-03——「10GB 上限形同虚设」与「崩溃录制 outputPath 恒 null 续转恒 400」两条 failed truth 在生产路径闭合，且无每分片全库扫描性能回归**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-06T14:27:52Z
- **Completed:** 2026-09-06T14:32:55Z
- **Tasks:** 2
- **Files modified:** 3（media-cache-manager.js / main.js / tests/test-media-cache.js，+148/-14）

## Accomplishments

- **CR-02 写路径容量水位淘汰（media-cache-manager.js）**：constructor 新增 `this._trackedTotal = null`（null=未初始化）+ `_diskTotalBytes()`（listEntries 磁盘权威口径求和）+ 公开方法 `setCapacityBytes(bytes)`（校验赋值 + 立即 evictIfNeeded + `_trackedTotal = r.total` 水位同步，非法入参回落 DEFAULT_CAPACITY_BYTES）。storeBuffer 在 `_writeMeta` 之后、`return` 之前插入水位检查：首写惰性初始化取磁盘权威总量（**不重复加 size**——`_writeMeta` 已把本片计入 meta.total_size，采纳 plan-checker fix_hint 防双计），此后每片 O(1) 加法；仅 `_trackedTotal > capacityBytes` 才 `evictIfNeeded(new Set([videoId]))` 一次（exempt 正在写 videoId 防误删自己），淘汰后把 r.total 同步回水位自校正漂移。D-10 skipped / disk_full 早退不进水位（无新增字节）；`_writeWithEvictRetry` ENOSPC 强淘原样保留（D-08 兜底）
- **setCapacityBytes 桥接（main.js）**：settings:update cacheMaxGB 即改即存从直写 `mediaCache.capacityBytes = gb*…` 改为 `mediaCache.setCapacityBytes(gb * 1024 * 1024 * 1024)`——改小容量立即触发一轮 FIFO 淘汰（CR-02 missing 第 2 项），main.js 不再有任何对 capacityBytes 字段的直写
- **CR-03 RECORD_ROOT 常量（main.js）**：createRecordEngine 调用前同作用域声明 `const RECORD_ROOT = path.join(app.getPath('userData'), 'media-records')`（注释说明 D-23 独立于缓存库 + CR-03 补算语义）；`recordRoot: RECORD_ROOT` 注入——字面 `path.join(app.getPath('userData'), 'media-records')` 在 main.js 全文件仅常量声明一处（引擎写目录与补算回退同源不漂移）
- **CR-03 目录补算（main.js readRecordTaskSegments）**：原「`task.outputPath` 无值 → 无条件 return null」两行替换为补算——completed 沿用 outputPath；为 null 时 task.id 过 `/^[0-9a-fA-F-]{8,64}$/` uuid 形态白名单后 `recordDir = path.join(RECORD_ROOT, tid)`（media-tasks.json 可本地篡改防补算路径穿越，randomUUID 天然命中）；metaPath/parse/segmentPaths 逻辑原样保留；注释纪律无「outputPath 恒 null 导致 return null」类字面残留
- **单测适配与新增（tests/test-media-cache.js）**：D-06「超容量整目录删除」改造为 cap 130（第三次 150>130 写路径自动淘汰、不显式调 evictIfNeeded——生产写路径回归锚）；D-07 豁免测试保持 cap 100 双阶段语义并补注释；新增 A「写路径超限自动淘汰」（cap 100，仅经 storeBuffer 即淘汰最旧）、B「setCapacityBytes 缩小触发淘汰」（500→100 收敛）、C「单视频超限自豁免不自杀」（exempt 自身目录仍在、分片仍命中）。套件 17 → 20 全绿；D-08 ENOSPC 两条用例在新水位检查下重跑确认全绿

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-02 — storeBuffer 写路径容量水位淘汰 + setCapacityBytes（改容量即淘汰）** - `dff6843` (feat)
2. **Task 2: CR-03 — RECORD_ROOT 常量 + readRecordTaskSegments 目录补算回退（interrupted 续转 200）** - `3b68622` (fix)

## Files Created/Modified

- `media-cache-manager.js` - constructor `_trackedTotal` 字段；storeBuffer 水位检查分支（首写惰性初始化防双计 + 越限 evictIfNeeded(exempt videoId) + r.total 同步）；新方法 `_diskTotalBytes()` / `setCapacityBytes(bytes)`（JSDoc 注明 CR-02 语义）；evictIfNeeded FIFO/豁免分支零改动
- `main.js` - settings:update cacheMaxGB 改调 setCapacityBytes（:1372）；`const RECORD_ROOT` 常量（createRecordEngine 前）；createRecordEngine recordRoot 改引用常量；readRecordTaskSegments 补算回退 + uuid 白名单（:2954-2963）
- `tests/test-media-cache.js` - D-06 用例改造 cap 130 写路径自动淘汰；D-07 注释补双阶段语义；新增 A/B/C 三用例 + CR-02 覆盖头注释

## Decisions Made

- **CR-02 水位方案替代每片全库扫描**：storeBuffer 判定只比对 tracked 水位与 capacityBytes（一次加法 + 一次比较），evictIfNeeded 调用严格位于水位越过分支内——prohibition「大视频数千分片 = 数千次全树扫描」被结构避免；listEntries 全扫仅首写惰性初始化一次 + 真正越限时一次
- **惰性初始化防双计（plan-checker fix_hint）**：水位检查位于 `_writeMeta` 之后，磁盘口径（listEntries 读 meta.total_size）已含刚写分片——首写 `_trackedTotal = _diskTotalBytes()` 不再 `+size`；仅非 null 时每片 `+= size`
- **写路径自动淘汰豁免与自校正**：exempt = new Set([正在写 videoId])（与 _writeWithEvictRetry ENOSPC 同款）；evictIfNeeded 以磁盘扫描为权威，每次执行后 `_trackedTotal = r.total`（外部删除/deleteEntry 漂移在此收敛，T-44-G07-02 accept 最坏提前/滞后一次扫描无数据损坏面）
- **RECORD_ROOT 常量作用域**：置于 whenReady 作用域 createRecordEngine 之前（readRecordTaskSegments 同作用域可引用）——字面全文件唯一，杜绝两处漂移
- **uuid 白名单防补算穿越**：task.id 是 crypto.randomUUID（36 字符含连字符），白名单 `/^[0-9a-fA-F-]{8,64}$/` 精确覆盖该形态且拒绝 `../` 等穿越串

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 计划内测试适配算术修正] D-07 豁免用例容量不调大（保持 100）**
- **Found during:** Task 1（tests/test-media-cache.js 适配）
- **Issue:** plan 要求把 D-07 用例 capacityBytes 从 100 调大到 150（sizes 80/50，使自动淘汰不提前触发）后再显式调 evictIfNeeded()——但 80+50=130 ≤ 150，显式 evictIfNeeded 内部 total<=capacity 短路零淘汰，`r.evicted.includes(newVid)` 断言必然失败（计划算术自相矛盾）
- **Fix:** 保持 capacity 100 不变（写路径自动淘汰在第二次写入 130>100 触发但 old 活跃 + new 是正在写入方双豁免零删除，显式 evictIfNeeded 豁免解除后淘汰非活跃 new——双阶段语义恰好验证豁免分支不受自动淘汰干扰），补注释说明 44-07 语义
- **Files modified:** tests/test-media-cache.js
- **Verification:** 该用例与全套 20/20 全绿；豁免断言（evicted 含 newVid、不含 oldVid、old 目录存活）与 plan 字面一致
- **Committed in:** dff6843（Task 1 commit）

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** 唯一偏离是把计划中会致测试失败的容量数值修正为可验证豁免语义的正确值；行为断言与 plan acceptance_criteria 逐条一致，无 scope creep。

## Issues Encountered

- None（无阻塞）。REQUIREMENTS.md 为 specless 阶段不含 D-ID 行（与 44-01~44-06 一致），D-06/D-07/D-08/D-18 属 CONTEXT.md 决策骨架引用，不在 REQUIREMENTS.md 建行
- gsd-tools 不在仓库内（`gsd-core/` 目录不存在），经 $HOME/.codebuddy/gsd-core 解析使用（warning: defaults.json resolve_model_ids 键被项目配置覆盖，不影响执行）

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- **CR-02/CR-03 代码层闭合**：单测 20/20（含 D-06/D-07 语义适配 + 新增 A/B/C）+ 回归 registry 26/26 + parser 15/15 全绿；源码 gate（RECORD_ROOT 字面唯一、setCapacityBytes 桥接、无 capacityBytes 直写、evictIfNeeded 仅水位越过分支内调用）全过；media-cache-manager 保持纯 Node 可加载
- **44-VERIFICATION human_verification 第 4 项待真机复测**（CR-02/CR-03 修复后）：设置页把 10GB 改小为 1GB 缓存超限视频被逐出；崩溃/中断的录制任务在任务页点「已落盘部分续转」能进入弹框选目录（不再 400）——见 coverage H1，走 UAT
- 后续 gap 闭合计划已排队：44-08（CR-04 cancel 桥接引擎，依赖 44-04 录制引擎现状，与 44-07 无同文件冲突）
- 遗留不在本 plan：WR-01~WR-05、IN-01/03/04（44-REVIEW 判定与 CR-02/CR-03 failed truths 无直接关联）

---

*Phase: 44-player-video-cache-and-local-media-library*
*Completed: 2026-09-06*

## Self-Check: PASSED

- 3 个改动源文件 + SUMMARY 全部存在（media-cache-manager.js / main.js / tests/test-media-cache.js / 44-07-SUMMARY.md）
- 2 个任务 commit 均在 git 历史（dff6843 / 3b68622），ledger 计量（473e54c..HEAD）= 2 与 actuals 一致
- 计划级验证全绿：main.js + media-cache-manager.js node --check 通过；test-media-cache.js 20/20；回归 registry 26/26 + parser 15/15；源码 gate（RECORD_ROOT 常量计数 1 且字面全文件唯一、setCapacityBytes 命中、无 mediaCache.capacityBytes 直写、readRecordTaskSegments uuid 白名单存在、注释无「恒 null 导致 return null」残留）
- CR-03 行为语义经 ad-hoc harness 验证：interrupted+outputPath=null → RECORD_ROOT/<uuid> 读盘成功（segmentPaths=1）；traversal id 拒绝；completed 沿用 outputPath

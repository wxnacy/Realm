---
phase: 50-api-skills
plan: 03
subsystem: api
tags: [sec-09, request-body-limit, http-transport, ipc, preload, dual-entry, skills-management, deny-of-service]

# Dependency graph
requires:
  - phase: 50-api-skills
    provides: '50-01 的管理面投影 getSkillsForManagement 与 GET /api/skills/list 的 token + 分发范式；50-02 的两个 HTTP 写子路由（set-disabled / uninstall，本计划正是给它们补上请求体体积闸）'
  - phase: 49-manage-skill-ai
    provides: 'ai-skills-manager.js 的写函数单源（setSkillDisabled 转发链 / deleteUserSkill 的三态判据）—— 三个 IPC 通道只做转发，不复制判定'
provides:
  - 'main.js：单源常量 MAX_JSON_BODY_BYTES（1 MiB，/api/* POST 全局默认）与 MAX_JSON_BODY_BYTES_LARGE（32 MiB，用户文件全文端点专用）'
  - 'main.js：readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {}) —— 累积中拒收 + 413 + req.resume() + res 缺失降级分支（只 reject BODY_TOO_LARGE）'
  - 'main.js：sendJson 幂等护栏（headersSent || writableEnded ⇒ no-op）—— 一次修好 13 处宿主的 catch → sendJson'
  - 'main.js：全部 59 处调用点改三参签名（既有 57 + 50-02 新增 2）；两个书签导入端点显式 32 MiB'
  - 'ipc-handlers.js：ai:get-skills-management / ai:set-skill-disabled / ai:uninstall-skill（assertTrustedSender → aiManager 空值守卫 → 转发，零判定）'
  - 'src/preload.js：realmAPI.ai.getSkillsManagement / setSkillDisabled / uninstallSkill'
  - 'tests/test-skills-http-api.js：SEC-09 真 http.createServer harness 行为组 + 降级分支行为组 + 调用点覆盖度/常量单源/sendJson 护栏组 + 双入口跨文件组（10 → 32 例）'
affects: [50-04, 50-05, 51]

# Actuals (#2632) —— 与 PLAN 的 estimate 同尺度（chars/4 实测 diff），不是 harness token 计数
actuals:
  tokens: 16435
  tasks: 3
  commits: 3
plan_head_before: 06433b68f448b099001da14ffa57cdc14ce44762

tech-stack:
  added: []
  patterns:
    - '传输层体积闸的形状固定为「默认 fail-closed + 需大者显式放大」：忘了声明上限的端点在一个 413 处当场可见，而不是静默退化成假边界（Phase 51 的 zip base64 继承这条形状）'
    - '「一次修好全部发送点」：幂等护栏加在唯一的 JSON 发送函数上，而不是改 13 处 catch'
    - '承重降级分支：能力布尔（canRespond）同时判 res 存在性与 writeHead 能力 ⇒ 漏改调用点的后果从主进程崩溃降为一个 400（本仓无全局异常兜底）'
    - '计数 / token 类判据一律「先词法剥注释再判」（stripCodeComments 四态单遍 + 等长空白化），注释可自由解释禁令'
    - '双入口同构：IPC handler 逐字照抄既有三行形状，判定单源在 manager 层（零判定素材是源码级可断言的不变式）'

key-files:
  created: []
  modified:
    - main.js
    - ipc-handlers.js
    - src/preload.js
    - tests/test-skills-http-api.js

key-decisions:
  - 'readJsonBody 的 res 缺失降级分支写成 canRespond 能力布尔，但两个原始条件（res 存在性 + typeof res.writeHead === function）都在函数体内 —— 判据要求「两个条件都出现」，而不是「用了某个变量名」'
  - '413 形态固定为 sendJson(res, 413, { error, limit }) + req.resume()：不用 req.destroy()（客户端拿 EPIPE ⇒ 413 不可达）、不设 Connection: close（两次实测结论相反且无收益）'
  - 'Content-Length 预检只作快路径，注释里写明「可伪造 / 可缺失 ⇒ 不得取代累积中判」；新判据把「data 监听器内的顺序」升级为 早退 → 累加 size → 比较 → 才拼 body'
  - '两个书签导入端点（import-chrome / import-html）是唯一 by-design 的「用户文件全文」级 body（src/favorites-page.js:2245 的 file.text()，Chrome/Safari 导出常规 1–10 MB）⇒ 显式 32 MiB'
  - '**不做第三个 maxBytes 覆盖**（rules/import 虽也是用户选定文件的内容，但非 by-design 大 body）：计划在 5 处把「恰 2 处」写成锁定口径（must_haves / 门禁 c3!==2 / Task 2 action / Artifacts 表 / T-50-23 缓解），且 1 MiB fail-closed 对它的后果是一个**可读的 413** 而非静默破坏 —— 与「默认 fail-closed、需大者显式放大」的设计意图一致'
  - '两个书签端点之外无第三个覆盖（逐端点评审见下），items / folders 批量排序的调用方实际只发单元素数组（src/favorites-page.js:1806 / :1820）'
  - 'tests/test-skills-http-api.js 内的 stripCodeComments 与计划门禁的 stripC **逐字同款**：让测试与门禁测量同一个量（剥离语义不得漂移）'
  - 'IPC 写侧当前无 UI 消费者（D-17 明文）：本计划只接线、不新建主窗口管理 UI，通道价值是「两入口同一权威」的对称性'
  - 'apiManager 空值守卫沿用 50-01/50-02 的既有范式（读路径返回空投影 / 写路径 503），不引入新的降级形状'

patterns-established:
  - '体积闸的「三段证据链」：源码契约（签名/形态/调用点覆盖度）+ 真 http 行为回归（413 可达 / 堆不线性 / unhandledRejection 为 0）+ 反向对照（destroy 形态拿不到 413，证明前者能失败）'
  - '逐端点评审作为「不能按『都是小 JSON』批量放行」的落地形式：结论按宿主函数逐行记入 SUMMARY（含实测调用点数）'
  - '计划自带门禁的弱点以「另起独立判据」补齐，计划判据一字不改（本计划复现 2 条，见 Deviations）'

requirements-completed: [SEC-09, USER-07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: 'readJsonBody 的三参签名 + 累积中拒收的体积闸：超限即停止拼接 body、答 413 + JSON、req.resume() 排水；res 缺失时只 reject BODY_TOO_LARGE（不崩主进程）；两个常量单源'
    requirement: SEC-09
    verification:
      - kind: unit
        ref: 'tests/test-skills-http-api.js#① 超限 ⇒ 413 且 body 可 JSON.parse / ①b 带 content-length 同样 413 / ② 413 路径无 unhandledRejection / ③ 堆增量远小于 body 体积 / ④ destroy 反向对照拿不到 413'
        status: pass
      - kind: unit
        ref: 'tests/test-skills-http-api.js#SEC-09 源码契约组（三参签名 / 降级分支两条件 / 413+resume 且无 destroy·无 Connection / data 监听器内顺序）'
        status: pass
    human_judgment: false
  - id: D2
    description: '全部 59 处调用点改签名（既有 57 一个不丢）+ 两个书签端点显式 32 MiB + sendJson 幂等护栏 + res.writeHead( 基线冻结在 14 处'
    requirement: SEC-09
    verification:
      - kind: unit
        ref: 'tests/test-skills-http-api.js#调用点覆盖度组（总数 == 传 res 数 == 59 / 书签端点覆盖恰 2 / 常量单源 / writeHead 基线 14 / sendJson 护栏顺序 / settings-update 回归 smoke）'
        status: pass
      - kind: integration
        ref: 'node tests/test-manage-skill.js（55/55）+ node tests/test-ai-skills.js（187/187）+ node --test tests/test-skill-picker-model.js（115/115）+ node tests/test-skills-management.js（35/35）—— 改签名后默认值路径回归'
        status: pass
    human_judgment: false
  - id: D3
    description: '双入口之一的 IPC 半边：三个管理通道（assertTrustedSender → 转发到同一 manager 函数、零判定）+ realmAPI 三方法（通道名逐字一致）+ 与 HTTP 入口的跨文件同一组方法名'
    requirement: USER-07
    verification:
      - kind: unit
        ref: 'tests/test-skills-http-api.js#⑤ 双入口组（三通道来源校验与转发顺序 / 段内零判定素材 / preload 绑定逐字一致 / 跨文件同一组方法名 / token 403 早于任何 manager 调用）'
        status: pass
    human_judgment: true
    rationale: 'IPC 通道的运行期行为（真实 webContents invoke → manager 写路径）需要 electron 环境，纯 Node 不可 require；本计划只把源码契约钉死。且 D-17 明文「IPC 写侧当前无 UI 消费者」⇒ 无主窗口调用面，运行期调用属 50-VALIDATION 的 Manual-Only 面'
  - id: D4
    description: '413 探针在**运行时**（Electron 43.6.0 内嵌 Node 24.20.0）内复跑一次'
    requirement: SEC-09
    verification: []
    human_judgment: true
    rationale: '本计划的自动行为组跑在**系统 Node v22.22.0**（本机 node --version），而运行时是 Electron 43.6.0 的 Node 24.20.0；本仓有「依赖 Node 行为的结论必须在 Electron 内复跑」纪律（50-RESEARCH 矛盾 2 的诚实边界）。该复跑列在 50-VALIDATION 的 Manual-Only 表，本计划不声称已做'

# Metrics
duration: 12min
completed: 2026-09-14
status: complete
---

# Phase 50 Plan 03: SEC-09 请求体体积上限 + 双入口 IPC 接线 Summary

**`readJsonBody(req, res, { maxBytes })` 的累积中体积闸（默认 1 MiB fail-closed，两个书签导入端点显式 32 MiB）+ 承重的 `res` 缺失降级分支 + `sendJson` 幂等护栏（一次修好 13 处发送点）+ 全部 59 处调用点改签名；三个 IPC 管理通道与 `realmAPI` 三方法转发到同一组 manager 函数、handler 零判定**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-14T13:54:33Z
- **Completed:** 2026-09-14T14:06:03Z
- **Tasks:** 3 / 3
- **Files modified:** 4（无新增文件；`tests/test-skills-http-api.js` 由 50-02 建立，本计划续写）
- **Diff:** +802 / −67（本计划自身 4 个文件）

## Accomplishments

- **SEC-09 的形状落地为「默认 fail-closed + 需大者显式放大」**：`MAX_JSON_BODY_BYTES`（1 MiB）是 `/api/*` POST 的全局默认，`MAX_JSON_BODY_BYTES_LARGE`（32 MiB）只给两个 by-design 的大 body 端点。Phase 51 的 zip base64 导入届时只需在一处写 `{ maxBytes }`，而「忘了声明」会在一个 413 处当场可见 —— 不会静默退化成假边界。
- **两条**会崩主进程**的隐患一次性关闭**（本仓**没有**任何全局异常兜底）：①「拒收后 `res` 缺失 ⇒ 在 `data` 监听器里对 `undefined` 调 `sendJson` ⇒ TypeError ⇒ 主进程退出」由承重降级分支（`canRespond` 同时判存在性与 `writeHead` 能力）降为一个 400；②「13 处 `catch → sendJson` 的二次写头 ⇒ `ERR_HTTP_HEADERS_SENT` ⇒ unhandled rejection ⇒ 主进程退出」由 `sendJson` 的幂等护栏吸收。两者分别有行为用例（②的 `unhandledRejection` 计数断言 == 0；降级分支的 400 + `BODY_TOO_LARGE` 断言）。
- **413 的**可达性**被反向对照钉住**：行为组④用一个 `req.destroy()` 形态的等价 harness 证明「撕 socket ⇒ 客户端拿不到 413」，因此①的「客户端拿到 413 且 body 可 JSON.parse」是一条**能失败**的断言，而不是恒真的表述。同一个 harness 另断言 40 MiB body 下堆增量 < body/4（把累积改成「读完再判长度」会让它转红，已实跑）。
- **59 处调用点机械可核**：`await readJsonBody(req`（59）== `await readJsonBody(req, res`（59），且 ≥ 57；两个书签端点覆盖恰 2 处；`res.writeHead(` 总数冻结在实测基线 14 处（T-50-19 的判据对象是「不得**新增**」而非「全文件唯一」，既有 13 处非 JSON 发送点原样保留）。
- **双入口（HTTP + IPC）读写对等**：「两入口同一权威」被写成源码级可断言的不变式 —— 三个 IPC 通道段内**零判定素材**（`kind ===` / `source ===` / `isSeededName` / `managed-skills`）、来源校验早于转发、preload 方法名与通道名逐字一致、且 `main.js` 的 HTTP 侧转发到**同一组**方法名（跨文件一致性）。

## Task Commits

Each task was committed atomically:

1. **Task 1: SEC-09 主体（三参签名 + 降级分支 + 413 形态 + 单源常量）** - `ed88e84` (feat)
2. **Task 2: `sendJson` 幂等护栏 + 全部调用点改签名 + 两个书签端点覆盖的回归** - `265fe47` (feat)
3. **Task 3: 双入口 IPC 接线（三个管理通道 + `realmAPI` 三方法 + 转发层零判定）** - `4963d3e` (feat)

**Plan metadata:** （本提交，docs: complete plan）

## Files Created/Modified

- `main.js` — 新增 `MAX_JSON_BODY_BYTES` / `MAX_JSON_BODY_BYTES_LARGE`（各带量纲注释，并注明 1 MiB 与 PITFALLS P7 的「单 entry 1 MB」是**同数不同量**）；`readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {})` 全量重写（`canRespond` + `tooLarge()` 闭包 + Content-Length 快路径 + `if (rejected) return` + `req.resume()`）；`sendJson` 加幂等护栏与「一次修好全部发送点」的 JSDoc；57 处既有调用点补 `res`；两个书签导入端点显式 `{ maxBytes: MAX_JSON_BODY_BYTES_LARGE }`
- `ipc-handlers.js` — `ai:get-skills-management` / `ai:set-skill-disabled` / `ai:uninstall-skill` 三个通道，逐字照抄 `ai:get-skills` 的三行形状（`assertTrustedSender(event)` → `if (!aiManager) throw` → 转发），JSDoc 写明「与 HTTP `/api/skills/<route>` 是同一 manager 函数」与「主窗口 `file://` 不能 fetch 本地 HTTP」
- `src/preload.js` — `realmAPI.ai.getSkillsManagement()` / `setSkillDisabled(name, disabled)` / `uninstallSkill(name)`（单行箭头 + `@returns` JSDoc，与既有 `getSkills` / `refreshSkills` 并列）
- `tests/test-skills-http-api.js` — 新增 22 例（10 → 32）：`sendJsonEq` / `readJsonBodyEq` / `startSec09Server` / `postStream` / `closeSec09Server` 等价 harness（可测性声明写在组注释里）+ SEC-09 行为组（4 例）+ main.js 源码契约组（4 例）+ 调用点覆盖度与常量单源组（5 例）+ 降级分支行为组（1 例）+ 双入口跨文件组（6 例）+ 与门禁逐字同款的 `stripCodeComments`

## Decisions Made

- **`res` 缺失降级分支的实现形态**：写成 `const canRespond = !!(res && typeof res.writeHead === 'function')`（两个原始条件都在函数体内），而不是把 `if (!res || typeof res.writeHead !== 'function')` 直接内联 —— 判据要的是「两个条件都出现」，且能力布尔让 `tooLarge()` 与快路径共用同一分支判断。
- **不做第三个 `maxBytes` 覆盖（`rules/import`）**：见下方「逐端点评审」。计划在 **5 处**（`must_haves` / 门禁 `c3!==2` / Task 2 action / Artifacts 表 / T-50-23 缓解）把「恰 2 处」写成锁定口径，而 Task 2 action 3 的「若发现第三个大 body 端点则一并覆盖」是条件句 —— 按更具体的锁定口径调和：`rules/import` 的 body 虽是用户选定文件的内容，但不是 **by-design** 的大 body（Realm 规则导出是小文件），1 MiB fail-closed 对它的后果是一个**可读的 413**（不是静默破坏既有功能），与设计意图一致。若日后实测有真实用户被拒，届时新增覆盖是纯增量改动。
- **补播类/写路径类的既有决策不动**：本计划不触碰 `syncAgentSystemPrompt()`、不改 `computeDigest`、不在主窗口新建管理 UI（D-17 明文）。
- **测试与门禁共用同一测量机制**：`stripCodeComments` 与计划门禁的 `stripC` 逐字同款（四态单遍 + 等长空白化），避免「测试与门禁测量的是两个不同的量」。
- **IPC 空值守卫沿既有范式**：读通道返回空投影、写通道返回 503 —— 不引入第三种降级形状。
- **三个新通道不加确认卡片**：与 49 D-01 同款论据（破坏面已被硬沙箱限定）；且管理面卸载的确认归 50-04 的设置页交互。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 计划自带门禁的「拒收后仍在累积 body」判据可被同形早退假绿 ⇒ 另起**顺序**判据**
- **Found during:** Task 1 的单点变异矩阵（T1-M4）
- **Issue:** 计划门禁只断言 `if (rejected) return;` **至少在函数体里出现一次**，而该形态在 `req.on('end')` 里天然存在 ⇒ 把 **data 监听器内**的那条早退删掉（这正是「内存 O(n)」的唯一承载判据）门禁**仍绿**（变异实跑确认，exit=0）。
- **Fix:** 在 `tests/test-skills-http-api.js` 新增「累积中拒收的顺序」判据：把 `data` 监听器切片后断言 `早退 → 累加 size → 比较上限 → 才拼 body` 的**相对顺序**。计划自带判据**一字未改**（未放宽、未替换）。
- **Files modified:** `tests/test-skills-http-api.js`
- **Verification:** 变异实跑 —— 删掉 data 内的早退 ⇒ 新判据转红（`早退`）；把 `body += chunk;` 提到比较之前（「读完再判」的主进程形态）⇒ 新判据转红（`必须在比较之后才拼 body`）；合规树 32/32 绿。
- **Committed in:** `ed88e84`（Task 1）；顺序判据所在的测试文件改动随 `265fe47` 定稿

**2. [Rule 2 - Missing Critical] 计划的 token 鉴权判据只有「两条存在性」，测不出「副作用先于鉴权」⇒ 另起**顺序**判据**
- **Found during:** Task 3 的单点变异矩阵（T3-M4）
- **Issue:** gate3 只断言 `handleSkillsApi` 首段（700 字符内）含 `token` 校验且答 403。在 token 校验**之前**插一个 `await aiManager.ensureSkillsFresh()`（副作用早于鉴权）⇒ 门禁**仍绿**（变异实跑确认，exit=0）。
- **Fix:** 新增「鉴权必须早于任何 manager 调用」判据（`await aiManager.` 的下标必须为空或晚于 403 的下标）。计划自带判据一字未改。
- **Files modified:** `tests/test-skills-http-api.js`
- **Verification:** 变异实跑 —— 在 token 校验前插 manager 调用 ⇒ 新判据转红（`鉴权必须早于任何 manager 调用`）；把整段校验挪到 404 兜底之前 ⇒ 门禁与新套件**双双**转红。
- **Committed in:** `4963d3e`（Task 3）

**3. [Rule 3 - Blocking] 等价 harness 的两次「非被测对象」假失败（客户端侧 artifact，不是实现缺陷）**
- **Found during:** Task 1 行为组的首次落地
- **Issue:** ① 给 harness 客户端传 `agent: false` 会让它在响应结束后立刻销毁 socket，而此刻它仍在写剩余 body ⇒ 用例以 `write EPIPE` 假失败（真实客户端是 `fetch`/undici，无此行为）；② 用 40 MiB body 时挂起的写队列 + `drain` 等待让 node:test 等 30 秒才退出（`# duration_ms 30021`）。
- **Fix:** 去掉 `agent: false`（改由 `closeSec09Server` 在用例结束时统一 `closeAllConnections()` + `close()`），并在响应 `end` 时主动 `req.destroy()` 结束上传（响应已完整收到，不再需要写余量）。两处都写进注释说明理由。
- **Files modified:** `tests/test-skills-http-api.js`
- **Verification:** 套件 32/32 绿，`# duration_ms` 由 30021 ms 降到 ~55 ms。
- **Committed in:** `ed88e84`（Task 1）

---

**Total deviations:** 3 auto-fixed（3 条 Rule 2/3：两条测试判据强度补齐 + 一条 harness API 形误用），**外加 1 条计划文本的条件句与锁定口径冲突的调和**（第三个 maxBytes 覆盖，见 Decisions）。
**Impact on plan:** 无功能范围变更；`main.js` / `ipc-handlers.js` / `src/preload.js` 三个产品文件**逐条照计划实现**（59 调用点、恰 2 处覆盖、签名、413 形态、护栏、三通道名全部与计划字面一致）。两处判据强度补齐遵循本阶段既有纪律「先修驱动不改源码，计划判据一字不动」。

### 计划自带门禁的实测弱点（已复现，未放宽任何判据）

| # | 门禁 | 变异（实跑） | 结果 |
|---|------|-------------|------|
| 1 | gate1 的「拒收后仍在累积 body」（`if (rejected) return;` 出现即通过） | 删掉 **data 监听器内**的早退（`end` 里那条仍在） | **门禁仍绿**（T1-M4，exit=0）⇒ 由新套件的顺序判据承担 |
| 2 | gate3 的「token 403 前置」（首段存在性） | 在 token 校验**之前**插 `await aiManager.ensureSkillsFresh()` | **门禁仍绿**（T3-M4，exit=0）⇒ 由新套件的顺序判据承担 |

两条都是「存在性判据 vs 顺序不变式」的落差 —— 计划门禁判的是「有没有」，而真正承重的是「在哪」。计划判据未改，缺口由**独立**的新判据覆盖（两条证据链并存）。

## Endpoint Review（逐端点评审 —— 计划 Task 2 action 3 的交付物）

`main.js` 的 `readJsonBody` 调用点分属 **13 个具名 handler + 1 个 `realmServer` 内联分支 = 14 个宿主 / 59 处**（机械统计，非照抄 research）：

| 宿主函数 | 调用点数 | 大 body 风险 | 结论 |
|----------|---------|-------------|------|
| `handleHistoryApi` | 3 | 无 | 默认 1 MiB |
| `handleFavoritesApi` | 17 | **`import-chrome` / `import-html` = 用户书签文件全文**（`src/favorites-page.js:2245` 的 `file.text()`；Chrome/Safari 常规 1–10 MB，且 import-html 的预览与执行各发一次）；次要候选 `update-batch-sort` / `update-batch-folder-sort` 的调用方实测只发**单元素数组**（`src/favorites-page.js:1806` / `:1820`） | 前两者**显式 32 MiB**；其余默认 |
| `handleSettingsApi` | 10 | 无（`update` 是任意键值但值域受既有校验器自限：`aiBashWhitelist` ≤200 条、`aiSkills.disabled` ≤100 条、`cacheMaxGB` 是数值；`detect-models` 只是 provider 配置） | 默认 1 MiB |
| `handleSearchConfigApi` | 2 | 无 | 默认 |
| `handleDevRequestsApi` | 2 | 无（分页 / 过滤参数） | 默认 |
| `handleDownloadsApi` | 6 | 无（下载 id / 路径串） | 默认 |
| `handleTasksApi` | 3 | 无（taskId） | 默认 |
| `handleCredentialsApi` | 3 | 无（id / origin 串） | 默认 |
| `handleAddressApi` | 2 | 无 | 默认 |
| `handleRulesApi` | 5 | ⚠️ `import`（`:2586`）的 body 是**用户选定规则文件的内容**（`src/settings-page.js:786` 的 `file.text()`）—— 结构上属「用户文件全文」，但**不是 by-design 的大 body**（Realm 规则导出是小文件；`assignmentRules.importRules` 逐条只取 `containerId`/`pattern`） | **保持 1 MiB fail-closed**（理由见 Decisions）；超限时用户拿到可读 413 而非静默破坏 |
| `handleShortcutsApi` | 2 | 无（action / accelerator 串） | 默认 |
| `handleAiMemoryApi` | 1 | 受 `ai-memory-manager.BUDGETS` 自限 | 默认 |
| `handleSkillsApi`（50-02 新增） | 2 | 无（技能名 ≤64 字符 / 布尔） | 默认 |
| `realmServer` 内联 `/api/bookmarks-bar/toggle` | 1 | 无（单布尔） | 默认 |
| **合计** | **59** | | 显式覆盖 **恰 2 处** |

**全仓 `file.text()` 发送方只有两处**：`src/favorites-page.js:2245`（书签导入 → 上表两个端点）与 `src/settings-page.js:786`（规则导入 → 保持默认）。这一条是「除这两个端点外无 by-design 大 body」的取证依据（`src/` 内无其它 `FileReader` 送 `/api/*`；renderer 的 `FileReader` 用于 AI 附件 base64，走 IPC 不走 `/api/*`）。

## Verification Evidence

### 计划自带门禁（3 条）—— 全部实跑

| 门禁 | 结果 | 输出 |
|---|---|---|
| `50-03-T1`（`node --check main.js` + SEC-09 主体 stripC 扫描） | **PASS** | `SEC-09 主体 ok（三参签名 + 降级分支 + 413+resume + 无 destroy/无 Connection）` |
| `50-03-T2`（`node --check main.js` + SEC-09 体积闸扫描） | **PASS** | `SEC-09 体积闸 ok（签名/降级分支/413+resume/sendJson 幂等/59 调用点全覆盖/书签端点覆盖/发送点计数未越基线)` |
| `50-03-T3`（`node --check ipc-handlers.js && node --check src/preload.js` + 双入口与写路由扫描） | **PASS** | `双入口与写路由 ok（三 IPC 通道 + preload + 两 REST 子路由 + 同一 manager 函数 + token 403 前置 + code 回传）` |

**落地前的负方向实跑（如实披露）**：三条门禁在开工时对本树都跑过，失败项**全部**是「新代码尚未落地」类 —— gate1：签名不是三参 / 缺降级分支 / 超限未答 413 / 未 `req.resume()` / 拒收后仍累积；gate2：缺幂等护栏 / 调用点 59 传 res **0** / 书签覆盖 0 处 / 两个常量缺失；gate3：三个 IPC 通道全缺 / preload 三方法全缺。**没有**「合规实现也修不掉」的断言。

### 单点变异矩阵（本执行者补齐，全部实跑、全部串行、全部已还原且还原后基线复跑为绿）

**Task 1（9/9 符合预期）**

| # | 变异 | 期望 | 实测 |
|---|------|------|------|
| T1-C1 | 插一条含 `process.on('uncaughtException')` 字面量的**合规注释** | 绿（正向控制） | exit=0 ✅ |
| T1-M1 | 真写一行 `process.on('unhandledRejection', …)` 注册 | 红 | exit=1，命中「注册形态」✅ |
| T1-M2 | `readJsonBody` 内改用 `req.destroy()` | 红 | exit=1，命中「req.destroy()」✅ |
| T1-M3 | `readJsonBody` 内写 `res.setHeader('Connection', 'close')` | 红 | exit=1，命中「Connection 头」✅ |
| T1-M4 | 删掉 data 监听器内的早退 | 红（**新判据**；计划门禁绿） | exit=1，命中「早退」✅ |
| T1-M5 | 签名退回两参 `(req, { maxBytes })` | 红 | exit=1，命中「签名不是」✅ |
| T1-C2 | 测试文件内插一条纯注释 | 绿（正向控制） | exit=0 ✅ |
| T1-M6 | 等价 harness 改成「读完再判长度」 | 红（③的堆判据） | exit=1，命中「堆增量必须远小于 body 体积」✅ |
| T1-M7 | 把 `body += chunk;` 提到上限比较**之前**（主进程的「读完再判」形态） | 红（新顺序判据） | exit=1，命中「必须在比较之后才拼 body」✅ |

**Task 2（14/14 符合预期）**

| # | 变异 | 期望 | 实测 |
|---|------|------|------|
| T2-M1 / M1b | 加回一处两参调用（`compute-sort-keys`） | 红（门禁 + 新套件） | exit=1/1，命中「调用点未全部传 res：总计 59 / 传 res 58」✅ |
| T2-M2 / M2b | 删掉 `sendJson` 的幂等护栏 | 红（门禁 + 新套件） | exit=1/1，命中「缺幂等护栏」/「缺 res.headersSent 条件」✅ |
| T2-M3 | 护栏删成只剩 `res.headersSent` 一个条件 | 红 | exit=1，命中「须**同时**具备」✅ |
| T2-M4 | 把护栏挪到 `res.writeHead` **之后** | 红 | exit=1，命中「护栏不在 res.writeHead 之前」✅ |
| T2-M5 / M5b | 去掉 `import-html` 的 32 MiB 覆盖 | 红（门禁 + 新套件） | exit=1/1，命中「显式覆盖 1 处（须恰 2）」/「必须显式放大上限」✅ |
| T2-M6 | 在 `sendJson` 之外新增一个真实响应发送点 | 红 | exit=1，命中「计数 15 ≠ 基线 14」✅ |
| T2-M7 | 破坏 `MAX_JSON_BODY_BYTES` 的单源 | 红 | exit=1，命中「单源常量缺失或不唯一」✅ |
| T2-C1 / C2 | 插含 `res.writeHead(` / `await readJsonBody(req, res` 的**合规注释** | 绿（正向控制 ×2） | exit=0 ✅ |
| T2-C3 / C4 | 同两条注释的行为面（新套件） | 绿（正向控制 ×2） | exit=0 ✅ |

**Task 3（11/11 符合预期）**

| # | 变异 | 期望 | 实测 |
|---|------|------|------|
| T3-M1 / M1b | 删掉 uninstall 通道的 `assertTrustedSender(event)` | 红（门禁 + 新套件） | exit=1/1，命中「未做 assertTrustedSender」✅ |
| T3-M2 / M2b | 把 set-disabled 通道的转调改成别的 manager 方法 | 红（门禁 + 新套件） | exit=1/1，命中「未转发到同一 manager 函数」✅ |
| T3-M3 / M3b | 把 token 校验挪到函数体后半段（404 兜底之前） | 红（门禁 + 新套件） | exit=1/1 ✅ |
| T3-M4 | 只在 token 校验**之前**插一个 manager 调用 | 门禁**绿**（弱点实证） | exit=0 ✅ |
| T3-M4b | 同一变异的行为面 | 红（**新判据**） | exit=1，命中「鉴权必须早于任何 manager 调用」✅ |
| T3-C1 / C2 | 通道段内插一条如实写明禁令的**注释** | 绿（正向控制 ×2） | exit=0 ✅ |
| T3-M5 | 通道段内真写 `skill.kind === 'user'` | 红（新套件） | exit=1，命中「出现判定逻辑」✅ |

**合计 34 条变异**（含 8 条正向控制），全部串行执行、全部已还原、还原后三条门禁与 6 个套件复跑全绿。

### 回归面（改签名后的默认值路径）

| 套件 | 跑法 | 结果 |
|------|------|------|
| `tests/test-skills-http-api.js` | `node` | **32 / 32**，`# fail 0`（10 → 32） |
| `tests/test-skills-management.js` | `node` | **35 / 35** |
| `tests/test-manage-skill.js` | `node` | **55 / 55** |
| `tests/test-ai-skills.js` | `node` | **187 / 187** |
| `tests/test-skill-picker-model.js` | `node --test` | **115 / 115** |

`node --check main.js` / `ipc-handlers.js` / `src/preload.js` / `tests/test-skills-http-api.js` 全部 exit 0。

## Issues Encountered

- **`counts-parity` 本波仍为红（预期，由 50-05 收口）**：本计划把 `tests/test-skills-http-api.js` 从 10 例扩到 32 例，四处账本（`docs/product/ai-skills.md` §七 `:98/:99`、§11.8 `:538-540`、`AGENTS.md:330`、`50-VALIDATION.md` 的命令副本）仍持旧值（`test-ai-skills.js` **178** ≠ 实测 **187**、`test-skill-picker-model.js` **111** ≠ 实测 **115**、`test-manage-skill.js` 55 = 55 ✓；`test-skills-management.js` 35 与 `test-skills-http-api.js` 32 未入账本）。⚠️ 判据单元仍为 **8** 而套件已是 **5** 个 —— 该判据用 `if (cells < 8)`，**漏加新套件账本单元不会自动报错**，50-05 必须主动扩并把基线提高。按计划**不在本计划内改账本**（会与后续波次再次漂移）。
- **413 探针跑在系统 Node，未在运行时内复跑**：自动行为组在 **Node v22.22.0**（本机）上跑，运行时是 Electron 43.6.0 的 Node 24.20.0。三条关键结论（无上限会收下 40 MiB / `sendJson(413)+resume` 可达 / `destroy` 不可达）在 research 与本次 harness 两次一致，但**在 Electron 内复跑一次**仍是 50-VALIDATION 的 Manual-Only 项（本计划不声称已做，见 coverage D4）。
- **`req.destroy()` / `Connection: close` 只作**反向对照**存在于测试文件**：产品代码（`main.js`）里两者都不存在（门禁与测试双判据钉住）；测试文件的等价 harness 保留 `rejectForm: 'destroy'` 分支，其唯一用途是证明「413 可达」这条断言能失败。**未**把「`Connection: close` 会导致 EPIPE」写进任何注释或文档（该因果在重研会话中不可复现）。
- **`REQUIREMENTS.md` 本轮勾选了 `SEC-09` 与 `USER-07`**（`requirements.ready-ids` 返回 `ready: [SEC-09, USER-07]`、`blocked: []`）：`USER-07` 的另一声明者 50-01 已产出 SUMMARY，`SEC-09` 仅本计划声明（50-05 的 `requirements` 为 `[USER-01, USER-02]`），故共享 ID 门禁放行。50-01 的 SUMMARY 里「USER-07 的 IPC 半边归 50-03」这一交接在本计划闭合。

## Known Stubs

None —— 本计划无硬编码空值 / 占位文案流入 UI，也未新增任何 UI。两个 HTTP 写端点的响应体是真实投影（50-02 已定稿）；三个 IPC 通道**当前无 UI 消费者**（D-17 明文，已在 Decisions 与 preload JSDoc 如实成文），这不是 stub 而是刻意的对称性接线。

## Threat Flags

None —— 未引入计划 `<threat_model>` 之外的信任边界。逐条对应：**T-50-16**（无上限读入）由累积中判 + `if (rejected) return` + 行为组③的堆判据承担；**T-50-17**（拒收路径自身崩主进程）由 `sendJson` 幂等护栏 + `canRespond` 降级分支 + 行为组②的 `unhandledRejection === 0` 承担；**T-50-18**（413 不可达）由「不 destroy / 不设 Connection 头 / 用 resume」+ 行为组④的反向对照承担；**T-50-19**（第二个发送点绕过护栏）由 `res.writeHead(` 基线 14 + `sendJson` 内恰 1 处 + 护栏顺序三重判据承担；**T-50-20**（不受信 IPC 来源）由三通道首行的 `assertTrustedSender` + 「校验早于转发」判据承担；**T-50-21**（两入口判定漂移）由「段内零判定素材」+ 跨文件同一组方法名承担；**T-50-22**（把不可复现因果写成事实）由「不写 `Connection: close` 结论」+ 只写可复现规则承担；**T-50-23**（书签导入被默认上限打断）由两处显式 32 MiB + 恰 2 处覆盖判据承担；**T-50-SC**：`package.json` 零 diff（零新增依赖）。

## Next Phase Readiness

- **Wave 4（50-04）可直接复用**：① `BODY_TOO_LARGE` 是 `readJsonBody` reject 的 `err.code`，且经 `{ error, code }` 形状回到设置页 —— 设置页的失败文案白名单按 code 查表即可（状态码不必硬编 413，方案 A 把 413 与 code 同时给了）；② 设置页是 `realm://` guest ⇒ 必须走 `/api/skills/*` + token，**不得**改走 IPC；③ 卸载确认框走既有 div 遮罩范式（CSP `style-src 'self'` 禁 markup 内联 `display:none`）。
- **Wave 4（50-05）需要收口的两件事**：① 四处账本的例数（实测：`test-manage-skill.js` 55 / `test-ai-skills.js` **187** / `test-skill-picker-model.js` **115** / `test-skills-management.js` **35** / `test-skills-http-api.js` **32**）并把 `cells` 基线从 8 提高（判据用 `cells < 8`，漏加单元不会自动报错）；② `50-VALIDATION.md` 的 Per-Task Verification Map 里本计划三行的 `Status` 可回填（SEC-09 的 4 行 + USER-07 的 2 行）。
- **Phase 51 的体积上限交接已就位**：zip base64 导入端点只需要 `await readJsonBody(req, res, { maxBytes: 48 * 1024 * 1024 })`（按 PITFALLS P7 的「累计解压 ≤ 32 MB」推导 base64-over-JSON 上界 ≈ 42.67 MiB）；**不得**另写第二个请求体读取函数（`prohibitions` 已明文），也**不得**为了给大 body 让路去改默认值。
- **无阻塞**。计划 3 条门禁全绿、34 条单点变异全部按预期（含 8 条正向控制）、5 个套件 + 4 个 `node --check` 全绿；`main.js` / `ipc-handlers.js` / `src/preload.js` 逐条照计划实现。

---

*Phase: 50-api-skills*
*Completed: 2026-09-14*

## Self-Check: PASSED

- key-files.created：本计划**无新增文件**（`created: []`，属实际——`tests/test-skills-http-api.js` 由 50-02 建立）✅
- 三个任务提交存在：`ed88e84` / `265fe47` / `4963d3e` ✅ FOUND（`git log --oneline`）
- `commits: 3` 由台账实测（`git rev-list --count 06433b6..HEAD`），非叙述值；`plan_head_before: 06433b6…` 同时写入 frontmatter ✅
- 计划级 3 条门禁（含 `node --check` ×4）全部实跑：均 PASS（输出见「Verification Evidence」）✅
- 计划级 `<acceptance_criteria>` 复核：签名逐字 `(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {})`；降级分支两条件同现；413 走 `sendJson(res, 413, …)` + `req.resume()`；代码形态无 `req.destroy()` / 无 `Connection` 头；调用点总数 == 传 res 数 == **59**；`maxBytes: MAX_JSON_BODY_BYTES_LARGE` 恰 **2** 处；两个常量各恰 1 处；行为组四条（413+JSON / `unhandledRejection` 0 / 堆增量 < body/4 / destroy 反向对照）全过；降级分支只 reject 不崩进程；三通道段内零判定素材；preload 三方法名与通道名逐字一致；SUMMARY 记录「IPC 写侧当前无 UI 消费者」且未新增主窗口管理 UI ✅
- 计划要求的单点变异全部实跑（34 条，含 8 条正向控制），全部按预期，全部已还原且还原后门禁/套件复跑为绿 ✅
- 逐端点评审结论已按宿主函数逐行记入 SUMMARY（含实测 59 处调用点与「恰 2 处覆盖」的取证）✅

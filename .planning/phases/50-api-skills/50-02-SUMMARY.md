---
phase: 50-api-skills
plan: 02
subsystem: ai
tags: [skills, management, http-api, sandbox, write-path, broadcast, digest, settings]

# Dependency graph
requires:
  - phase: 50-api-skills
    provides: '50-01 的管理面投影 getSkillsForManagement（本计划两个写端点的响应体即它）、ensureSkillsFresh() 读路径初始化（本计划写路径复用它收口）、GET /api/skills/list 的 token + 分发范式（本计划在同一 handler 内续写两个 POST 子路由）'
  - phase: 49-manage-skill-ai
    provides: 'ai-skills-manager.js 的技能集单一数据权威（零 electron 依赖）与 MANAGE_SKILL_ERROR 闭合白名单 + makeManageSkillError 构造点'
  - phase: 46-prompt
    provides: '禁用语义（46 D-09：只过滤不删文件）与 computeDigest 的字段集契约（含 disabled / shadowed / overLimit）'
provides:
  - 'ai-skills-manager.deleteUserSkill(env, {name})：仅 user 可删的三态拒绝面（not_found / not_user_owned / 允许），判据读盘且用 env.fileInfo 判 kind === directory'
  - 'ai-skills-manager.validateSkillNameForManagement(name)：管理面「安全超集」名称谓词（非空 + ≤64 + 无 / \\ 控制字符）'
  - 'ai-skills-manager.validateDisabledListForSettings(list)：禁用名单的列表级校验单源（数组 + 每项过谓词 + 条数 ≤ MAX_DISABLED_SKILLS = 100）'
  - 'MANAGE_SKILL_ERROR.NOT_USER_OWNED（第十码，管理面专用，不进 MANAGE_SKILL_SHORT_REASON）'
  - 'AIManager.setSkillDisabled(name, disabled)：增量载荷 + 同步读-改-写 + 重扫恰一次 + 调用侧补播恰一次 + 返回最新投影'
  - 'AIManager.uninstallUserSkill(name)：转发 manager 判据 + D-09 派生不变式（删盘成功后清同名禁用名单）+ 同一套收口'
  - 'POST /api/skills/set-disabled 与 POST /api/skills/uninstall（token 鉴权、{error, code} 错误形状）'
  - '/api/settings/update 的 aiSkills.disabled **与** aiSkills 双键校验（共用同一份 manager 判据，拒绝时在 configStore.set 之前 return）'
  - 'tests/test-skills-http-api.js（新建套件，10 例；SEC-09 的 413 组由 50-03 续写）'
affects: [50-03, 50-04, 50-05, 51]

# Actuals (#2632) — 与 PLAN 的 estimate 同尺度（chars/4 实测 diff），不是 harness token 计数
actuals:
  tokens: 10937
  tasks: 3
  commits: 5
plan_commits: 4
plan_head_before: cb7dc3305c75be7d7cf6974809ca861e0a2ae839

# Tech tracking
tech-stack:
  added: []
  patterns:
    - '管理面写路径的三段形状：谓词单源（manager）→ 同步读-改-写（主进程内、无 await）→ 重扫恰一次 + 调用侧补播恰一次'
    - '「调用侧补播」作为忙时早退的补偿点：补播住在调用方而不是被两套断言钉住的函数体内'
    - '判据与拒绝码一律住 manager（零 electron、可纯 Node 单测），HTTP handler 与 IPC 只做转发 —— 「手改 URL 直调端点也不例外」由此成立'
    - '双键形态共用一个校验器 + `!key.includes(''.'')` 判别取值路径（让两种键形态在源码里各只出现一次，判据因此不可被别处的字面量假绿）'

key-files:
  created:
    - tests/test-skills-http-api.js
  modified:
    - ai-skills-manager.js
    - ai-manager.js
    - main.js
    - tests/test-skills-management.js
    - tests/test-ai-skills.js
    - tests/test-manage-skill.js

key-decisions:
  - '「仅 user 可卸载」判据 = 「skills/<name> 存在且 kind === ''directory''」（OQ-1 用户裁决）：删除对象恒为 skills/<name>/；同名双存在（user + managed）**允许**卸载，managed-skills 的存在只用来区分拒绝态'
  - '判据必须用 env.fileInfo 而不是 env.exists：SDK 的 exists 是「fileInfo 成功即 ok(true)」⇒ 普通文件也会返回 true，而 env.remove(dir,{recursive:true}) 会把它删掉'
  - '判据一律读盘、不用 _cache：bash 可随时改写磁盘，缓存只反映上次重扫的时刻'
  - '不复用 resolveManagedTarget：它的方向是 managed 视角的「用户撞名保护」，与本侧相反；只借 deleteManagedSkill 的四段形状'
  - '第十码只加进 MANAGE_SKILL_ERROR（10 → 11 键），MANAGE_SKILL_SHORT_REASON 保持恰 9 键 —— 后者是工具面的表，新码不经 manage_skill 的卡片路径'
  - '管理面名称谓词取「安全超集」（接受 My_Skill 这类加载管线允许的不规范名）：用严格形态会 render 出一个「点了必然 400」的开关'
  - '写路径收口 = 重扫恰一次（有 Agent 经 ensureSkillsFresh → syncAgentSystemPrompt；无 Agent 直接 refreshSkills）+ 调用侧补播恰一次'
  - '补播的理由 = 覆盖 syncAgentSystemPrompt() 的 isProcessing || streaming 分支「只置脏、return、不广播」，而设置页点开关不经过 Agent 轮次 —— **不是**「prompt 不变 ⇒ 不广播」（digest 含 disabled ⇒ 会广播）'
  - 'syncAgentSystemPrompt() 的函数体逐字未改（补播只能住调用侧；46-04 方法体扫描 + 48 广播次数断言同时钉着它）'
  - '禁用名单载荷取增量 {name, disabled} 而非全量 {disabled: [...]}：读-改-写全程主进程内同步，并发操作不互相覆盖'
  - 'D-09 派生不变式：卸载成功后必须清 settings.aiSkills.disabled 的同名条目，且清理只在删盘成功之后'
  - '/api/settings/update 的 aiSkills 形态写死为「只落 disabled 子键 + 缺子键即拒绝 + continue」，不得整体覆写 settings.aiSkills'
  - '双键取值路径用 `!key.includes(''.'')` 判别而非再写一遍 `key === ''aiSkills''`：使计划自带门禁的单点变异如实转红（原先的写法会让判据假绿）'

patterns-established:
  - '管理写路径的失效链收口点固定为「重扫恰一次 + 调用侧补播恰一次」，且补播的**存在理由**以忙时用例独占证明'
  - '卸载类判据的「存在性 + 类型」判定一律走 env.fileInfo（env.exists 无法表达 kind）'
  - '零 electron 依赖的 manager 模块可被主进程直接 require —— 校验器单源（main.js 零第二份正则）'
  - '门禁的 token / 计数判据一律「先剥注释再判」（stripC 词法级四态扫描），注释可自由解释禁令'

requirements-completed: [USER-02, USER-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: '管理面写层：仅 user 可删的三态拒绝面（not_found / not_user_owned / 允许）+ 第十码 NOT_USER_OWNED + 管理面名称谓词与禁用名单校验器（单源）'
    requirement: USER-06
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#仅 user 可卸载：三态拒绝面（4 例，全部经 aiSkills.deleteUserSkill() 直接调用）+ 管理面名称谓词与禁用名单校验（4 例）+ 服务端拒绝不经 handler（2 例）'
        status: pass
      - kind: unit
        ref: 'tests/test-manage-skill.js#闭合白名单的不变式（恰十一键 / 十一个值 + 不得再新立第十二键）'
        status: pass
      - kind: unit
        ref: 'node --test tests/test-skill-picker-model.js（MANAGE_SKILL_SHORT_REASON 的 9 键冻结未被打翻，115/115）'
        status: pass
    human_judgment: false
  - id: D2
    description: 'AIManager 写路径收口：setSkillDisabled / uninstallUserSkill 均「重扫恰一次 + 调用侧补播恰一次」，且忙时（isProcessing === true）补播仍然发出'
    requirement: USER-02
    verification:
      - kind: unit
        ref: 'tests/test-ai-skills.js#N1（次数账：rescanCalls === 1 + 名单落盘 + 投影 disabled + 广播账恰 2 条）/ N2（启用恢复）/ N2b（增量载荷并集）/ N3（靶心・忙时补播：channels 恰 1 条且 prompt 未变）/ N4（无 Agent 分流：rescanCalls === 0 而 refreshedAt 变大）'
        status: pass
      - kind: unit
        ref: 'tests/test-ai-skills.js#N8（源码）syncAgentSystemPrompt() 函数体广播次数仍为 1'
        status: pass
    human_judgment: false
  - id: D3
    description: '卸载的 D-09 派生不变式：删盘成功后清 settings.aiSkills.disabled 的同名条目；同名新技能装上后不被静默禁用；失败路径不清名单'
    requirement: USER-02
    verification:
      - kind: unit
        ref: 'tests/test-ai-skills.js#N5（靶心・名单清理 + 同名新技能进 prompt）/ N6（失败路径不清名单）/ N7（卸载判据读盘而非缓存）'
        status: pass
    human_judgment: false
  - id: D4
    description: '两个 HTTP 写端点（set-disabled / uninstall）与 /api/settings/update 双键校验的**真实端点行为**：token 403、起服务后的 400/200 形态、超限 413'
    requirement: USER-06
    verification:
      - kind: unit
        ref: 'tests/test-skills-http-api.js（10 例：写子路由与转发目标的源码扫描、token 首行与 {error, code} 形状、双键覆盖与「拒绝时不落盘」的语句顺序、两种键形态共用同一份判据的取值路径与拒绝面）'
        status: pass
    human_judgment: true
    rationale: 'handleSkillsApi / handleSettingsApi 住在 main.js 的 realmServer 闭包内、**不可 require** ⇒ 本计划只能做源码扫描 + 可 require 纯逻辑的行为断言，无法证明「真起服务后 403/400/200 的实际行为」。真实起 server 的探针归 50-03 的 SEC-09 组（413）与 50-VALIDATION 的 Manual-Only 表'
  - id: D5
    description: '双键校验的「拒绝时在 configStore.set 之前 return」语句顺序（「校验失败但仍落盘」的机械判据）+ aiSkills 形态不得整体覆写'
    requirement: USER-02
    verification:
      - kind: unit
        ref: 'tests/test-skills-http-api.js#拒绝路径在 configStore.set 之前 return（已由单点变异取证：把 set 挪到 valid 守卫之前 ⇒ 该用例转红）'
        status: pass
    human_judgment: false
  - id: D6
    description: '禁用后该技能不进 system prompt 与 / 面板（跨进程半边：真实 `/` 面板渲染与「下一条消息起」）'
    verification: []
    human_judgment: true
    rationale: '本计划证明的是投影 disabled === true + 广播发出 + 缓存标记；真实 `/` 面板在浏览器进程里是否隐藏该技能、以及「下一条消息起生效」需要真实会话往返，属 50-VALIDATION 的 Manual-Only 项'

# Metrics
duration: 10 min
completed: 2026-09-14
status: complete
---

# Phase 50 Plan 02: 管理写路径（启停 / 卸载 / 双键校验）Summary

**仅 user 可卸载的三态判据 + 第十码 `not_user_owned` + 管理面安全超集谓词；两个 HTTP 写端点与 `aiSkills`/`aiSkills.disabled` 双键服务端校验；写路径「重扫恰一次 + 调用侧补播恰一次」并把补播的存在理由用忙时用例独占钉住**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-14T13:39:28Z
- **Completed:** 2026-09-14T13:50:19Z
- **Tasks:** 3 / 3
- **Files modified:** 7（新建 1 个测试套件）
- **Diff:** +1129 / −7（本计划自身的 7 个文件；另有 1 个并发会话提交的 docs 变更落在同一区间内，见「Issues Encountered」）

## Accomplishments

- **「手改 URL 直接调端点也不例外」以 manager 层判据成立（ROADMAP 判据 3 的承重点）**：三态拒绝面（`not_found` / `not_user_owned` / 允许）全部经 `aiSkills.deleteUserSkill()` **直接调用**验证，不经 HTTP handler 的友善包装；判据一律**读盘**且用 `env.fileInfo` 判 `kind === 'directory'` —— `env.exists` 对普通文件也返回 true，配合 `env.remove({recursive:true})` 会删掉那个文件（已用「普通文件占位」用例钉住「判据不成立时不得删任何东西」）。
- **同名双存在（user + managed）允许卸载**：user 条目确实存在（列表里显示的 tier 就是 `user`），按「后者存在即拒」会让用户点自己列表里那条「我的技能」被告知「这不是你的技能」。用例断言 `skills/<name>` 消失、`managed-skills/<name>` 原封不动，且响应体**不携带**任何提示字段（无消费者的字段必然腐化成第二次实现）。
- **失效链收口点从 1/3 走到 2/3，且「忙时」这一支不再靠推理**：两个写方法各为「重扫恰一次 + 调用侧补播恰一次」；补播的真实理由是覆盖 `syncAgentSystemPrompt()` 的 `isProcessing || streaming` 早退（**不是**「prompt 不变 ⇒ 不广播」—— `computeDigest` 逐条含 `disabled`，禁用任何在缓存里的技能都会改摘要因而会广播）。忙时用例里内层**不广播** ⇒ `channels` 恒为恰 1 条，删掉补播那一行即转红（实测 `# fail 2`）。
- **卸载的静默失效面被堵住（D-09）**：删盘成功后清 `settings.aiSkills.disabled` 的同名条目，失败路径不清；并且有独立用例断言「同名新技能装上后 `disabled === false` 且进 prompt」—— 这正是清理存在的全部理由。
- **`/api/settings/update` 的双键形态与「拒绝时不落盘」同时落地**：`aiSkills.disabled` 与 `aiSkills` 共用同一份 `validateDisabledListForSettings`（`main.js` 零第二份正则）；`aiSkills` 形态写死为「只落 `disabled` 子键 + 缺子键即拒绝 + `continue`」，**不得**整体覆写 `settings.aiSkills`（会静默冲掉其上的其它字段）。
- **零件全部落在既有的单一权威里**：三个新导出（`deleteUserSkill` / `validateSkillNameForManagement` / `validateDisabledListForSettings`）住零 electron 依赖的 `ai-skills-manager.js`，主进程直接 require 同一份 ⇒ 四个消费点（`set-disabled` / `uninstall` / `/api/settings/update` 双键 / 卸载判据）同宽。

## Task Commits

Each task was committed atomically:

1. **Task 1: manager 写层三态判据 + 第十码 + 两个管理面谓词** — `9b425d6` (feat)
2. **Task 2: ai-manager 写路径收口（重扫恰一次 + 调用侧补播恰一次，含忙时）** — `2af5680` (feat)
3. **Task 3: HTTP 写路由 + `/api/settings/update` 双键校验 + 新建 HTTP 套件骨架** — `c9984d8` (feat)
4. **补：增量载荷语义用例（N2b）** — `1752a33` (test)

**Plan metadata:** （本提交，docs: complete plan）

_注：`git rev-list --count cb7dc33..HEAD` 实测为 **5** —— 区间内另有并发会话提交的 `e43926a docs(branching): …`（非本计划的文件），本计划自身 4 个提交。_

## Files Created/Modified

- `ai-skills-manager.js` — `MANAGE_SKILL_ERROR.NOT_USER_OWNED`（第十码，表上方 JSDoc 说明它只经 HTTP 400 的 `{code}` 返回、不进 `MANAGE_SKILL_SHORT_REASON`）；新增 `validateSkillNameForManagement()`（管理面安全超集）+ `MAX_DISABLED_SKILLS`（由既有两个 `LIMITS` 派生）+ `validateDisabledListForSettings()`；新增 `deleteUserSkill()`（三态拒绝面）；三个新符号导出，`makeManageSkillError` **刻意不导出**
- `ai-manager.js` — 新增 `setSkillDisabled(name, disabled)` 与 `uninstallUserSkill(name)`（紧挨 `getSkillsForManagement()`），两方法各含「谓词单源 → 同步读-改-写 → 重扫恰一次 → 调用侧补播恰一次 → 返回最新投影」；`syncAgentSystemPrompt()` 函数体**逐字未改**
- `main.js` — 顶部 `require('./ai-skills-manager')`；`handleSkillsApi` 续写 `set-disabled` / `uninstall` 两个 POST 子路由（各带 `aiManager` 空值守卫）；`/api/settings/update` 校验循环新增双键分支
- `tests/test-skills-management.js` — 新增「仅 user 可卸载：三态拒绝面」（4 例）、「管理面名称谓词与禁用名单校验」（4 例）、「服务端拒绝不经 handler」（2 例）（23 → 35 例）
- `tests/test-ai-skills.js` — `promptCtx` 的 fake `configStore` 补 `set`（`get` 的「缺省回落 fallback」语义逐字保留）；新增 N 组 9 例（178 → 187 例）
- `tests/test-manage-skill.js` — 冻结断言刷为恰十一键 / 十一个值，describe 标题与两条消息文本改为自洽表述
- `tests/test-skills-http-api.js` — **新建**（10 例）

## Decisions Made

- **三态判据住 manager 层**（`deleteUserSkill`）：只有 `skills/<name>` 存在**且** `kind === 'directory'` 才允许；否则按 `managed-skills/<name>` 是否存在区分 `not_user_owned` / `not_found`。同一判据不经 handler 包装，因此手改 URL 直调端点同样被拒。
- **判据读盘 + `fileInfo` 判 kind**：`env.exists` 是「`fileInfo` 成功即 `ok(true)`」，普通文件也会 true；D-07 的字面判据是「存在且是目录」，只有 `fileInfo` 能表达。
- **第十码与短原因表分账**：`MANAGE_SKILL_ERROR` 10 → 11 键；`MANAGE_SKILL_SHORT_REASON` 保持恰 9 键（工具面的表，新码经 HTTP 400 的 `code` 返回）。
- **管理面名称谓词取安全超集**：接受 `My_Skill` / `has space` 这类加载管线允许的不规范名 —— 严格形态会让「列表里明明有条目的技能」开关点了必然 400。
- **补播住在调用侧**，函数体逐字未改：补播幂等（renderer 监听已改为无条件重拉快照），多播一次零副作用；为省这一次广播去改被两套断言钉住的函数体是错的。
- **增量载荷 + 主进程内同步读-改-写**：并发两个设置页操作不互相覆盖（N2b 以「并集」断言钉住）。
- **`aiSkills` 形态显式处理**：只落 `disabled` 子键后 `continue`，缺子键即 400 —— 两种选择都在注释里写死并说明理由。
- **双键取值路径用 `!key.includes('.')` 判别**：让两种键形态在源码里各只出现一次，避免计划自带门禁被别处的同名字面量假绿（详见 Deviations）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 计划建议的双键取值写法会让自带门禁的单点变异不转红**
- **Found during:** Task 3 的单点变异矩阵
- **Issue:** 计划 action 建议的取值写法是三元表达式 `const list = key === 'aiSkills' ? (value ? value.disabled : undefined) : value;`。这样写之后，把分支条件改成「只保留 `key === 'aiSkills.disabled'`」（计划明列的变异之一）**门禁仍绿** —— 因为三元里的 `key === 'aiSkills'` 仍满足 `/key\s*===\s*['"]aiSkills['"]/`，而该形态实际上已不再进入校验分支（请求会落到循环尾的 `configStore.set('settings.aiSkills', value)` **整体覆写**）。这正是本阶段反复打击的「判据被别处的字面量假绿」形态。
- **Fix:** 取值路径改由键形态判别 `const isSubKeyForm = !key.includes('.'); const list = isSubKeyForm && value ? value.disabled : value;` —— 两种键形态在源码里各只出现一次。语义不变（只有这两个键能进该分支）。改后重跑变异：如实报「未覆盖 aiSkills 键形态」转红。
- **Files modified:** `main.js`
- **Verification:** 变异实跑（见「Verification Evidence」T3-M1）；合规树门禁仍绿。
- **Committed in:** `c9984d8` (Task 3 commit)

**2. [Rule 2 - Missing Critical] 两个新写子路由的 `aiManager` 空值守卫**
- **Found during:** Task 3
- **Issue:** 计划原文的两个子路由直接 `await aiManager.setSkillDisabled(...)`。`aiManager` 是模块级 `let`、在 `whenReady` 内赋值；`realmServer` 监听早于它完成时，早期请求会撞 `TypeError: Cannot read properties of null` → 被 catch 成「400 + `code: undefined`」—— 一个**失实**的失败态（前端按 code 查表会查不到，且 400 暗示是请求的问题）。
- **Fix:** 仿 50-01 的既有范式各加一条 `if (!aiManager) { sendJson(res, 503, { error: 'AI 服务尚未就绪' }); return; }`。写操作不返回空投影（那是读路径的降级），503 才是诚实语义。
- **Files modified:** `main.js`
- **Verification:** 门禁 G 绿；`{ error, code }` 形状未被改动。
- **Committed in:** `c9984d8` (Task 3 commit)

**3. [Rule 2 - Missing Critical] 补一条「增量载荷语义」用例（覆盖 `must_haves` 的 USER-02 边界假设）**
- **Found during:** Task 2 收尾核对 `must_haves`
- **Issue:** `must_haves` 把「同一技能被两个设置页实例并发操作时不互相覆盖」列为 truth，但 Task 2 的用例清单里没有任何一条能证伪「全量载荷 + 陈旧读」的实现。
- **Fix:** 在 N 组补 `N2b`：连续禁用两条技能 ⇒ 名单为**并集**；启用只摘掉自己那条。全量载荷语义会让第二次写抹掉第一次的改动（该用例转红）。
- **Files modified:** `tests/test-ai-skills.js`
- **Verification:** 187/187 绿；`node --check` 通过。
- **Committed in:** `1752a33`

### 计划文本的一处不可满足项（按更具体的事实调和，已如实披露）

**4. [Rule 1 - Bug] Task 2「非忙时 `channels` 里 `skills:changed` **恰一次**」与 D-18 的事实冲突**
- **Found during:** Task 2
- **Issue:** 计划 Task 2 的用例清单写「用 `promptCtx(env)`（可带 `agent`）调 `setSkillDisabled(name, true)` ⇒ … `channels` 里 `skills:changed` **恰一次**」。但非忙时 `syncAgentSystemPrompt()` **自己会广播**（`computeDigest` 逐条含 `disabled` ⇒ 禁用任何在缓存里的技能都会改摘要 ⇒ 走改写分支 ⇒ 广播），调用侧再补播一次 ⇒ 观测到的必然是**两条**。「恰一次」只在不忙时不成立，而 D-18 与 `must_haves` 的原文是「**调用侧**补播恰一次」——两者不是同一个量。
- **Fix:** 拆成两条**各自可证伪**的断言：① 非忙时断言**合成账** `channels === ['skills:changed','skills:changed']`（1 内层 + 1 补播，删掉补播即转红）；② 忙时断言 `channels === ['skills:changed']`（内层不广播 ⇒ 这 1 条必然是补播，删掉补播即转红）。**「补播恰一次」的证据由忙时用例独占承担**，非忙时用例只作合成账。计划的两条验收面（次数账 + 忙时补播）都未被削弱。
- **Files modified:** `tests/test-ai-skills.js`
- **Verification:** 删掉补播那一行 ⇒ `node tests/test-ai-skills.js` 报 `# fail 2`（N1 与 N3 同时转红，实测）。
- **Committed in:** `2af5680` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed（3 条 Rule 2 缺关键功能/证据）+ 1 条计划文本不可满足项的调和（Rule 1）。
**Impact on plan:** 无功能范围变更。三处改动都在「不改动计划任何判据、只让判据faithful / 补齐证据链」的范围内；第 4 条只是把一条自相矛盾的断言拆成两条更精确的断言。

## Issues Encountered

- **一次并行变异竞态把源码改坏并回写了变异态（已即时发现并复原）**：Task 2 的三次单点变异中，前两次在**同一个消息里并行**执行，两个进程同时对 `ai-manager.js` 做「读 → 写变异 → 跑门禁 → 还原」，互相覆盖 ⇒ 最终把 `setSkillDisabled` 的补播行**永久**删掉了（还原时写回的是已被变异的内容）。发现方式：紧随其后的门禁复跑报「补播 0 次」（而非预期的 ok）。处理：用 Edit 复原该行 → `node --check` + 门禁 + 187 例复跑全绿，此后**所有变异一律串行**执行。教训与 `reference` 记录的「同一仓库并发会话」同类：**同名资源的读-改-写必须串行**。
- **`counts-parity` 本波预期为红（`50-RESEARCH.md` Pitfall 11 的「中途 red」）**：实测报 `AGENTS.md:330 test-skill-picker-model.js 账本取到 [111] ≠ 实测 115`、`AGENTS.md:330 / ai-skills.md:98 / :539 test-ai-skills.js 账本取到 [178] ≠ 实测 187`、`ai-skills.md:540 test-skill-picker-model.js 账本取到 [111] ≠ 实测 115`（`test-manage-skill.js` 55 = 55 ✓）。⚠️ 注意：该判据用 `if (cells < 8)`，**漏加新套件账本单元不会自动报错** —— 本波实际有 **5** 个套件而账本单元仍为 8。按计划**不得**在本计划里改账本（会与后续波次再次漂移），由 Wave 4 的 50-05 一次收口（四处：`ai-skills.md` §七/§11.8、`AGENTS.md:267`、`50-VALIDATION.md` 的命令副本）。
- **区间内混入并发会话的提交**：`git rev-list --count cb7dc33..HEAD` = **5**，其中 `e43926a docs(branching): 补入「建 worktree 前主工作树是否需要干净」的实测结论`（`docs/dev/branching-spec.md`，与本计划无关，由另一会话提交）。已如实记入 frontmatter（`actuals.commits: 5` 为台账实测值，`plan_commits: 4` 为本计划自身），避免后续 `verify-work` 的同量比对被误判。
- **`REQUIREMENTS.md` 本轮未勾选任何 ID**：`USER-02`（50-04/50-05 亦声明）与 `USER-06`（50-04 亦声明）都被共享 ID 门禁（#2388）**故意**挡住，待最后一个声明者产出 SUMMARY 后自动转为就绪。这是正确行为，不是遗漏。

## Verification Evidence

### 计划自带门禁（4 条）—— 全部实跑，逐条如实披露

| 门禁 | 结果 | 输出 |
|---|---|---|
| T1-G1 `node --check ai-skills-manager.js && node tests/test-manage-skill.js` | PASS | `# tests 55 / # pass 55 / # fail 0` |
| T1-G2 管理写路径数据层扫描 | PASS | `管理写路径数据层 ok（仅 user 可删三态 / 第十码 / 两个谓词 / 零 electron）` |
| T1-G3 `node tests/test-skills-management.js` | PASS | `# tests 35 / # pass 35 / # fail 0` |
| T1-G4 `node --test tests/test-skill-picker-model.js` | PASS | `# tests 115 / # pass 115 / # fail 0` |
| T2-G1 写路径失效链扫描 | PASS | `写路径失效链 ok（重扫恰一次 + 调用侧补播恰一次 + 函数体未改 + 读路径初始化分流）` |
| T2-G2 `node tests/test-ai-skills.js` | PASS | `# tests 187 / # pass 187 / # fail 0` |
| T2-G3 写路径用例面扫描 | PASS | `写路径用例面 ok（写路径次数账 + 忙时补播 + 名单清理素材齐备）` |
| T3-G1 写路由与双键校验扫描 | PASS | `写路由与双键校验 ok（两 REST 子路由 + 同一 manager 函数 + code 回传 + 双键共用单源校验）` |
| T3-G2 `node tests/test-skills-http-api.js` | PASS | `# tests 10 / # pass 10 / # fail 0` |
| T3-G3 `node tests/test-skills-management.js` | PASS | `# tests 35 / # pass 35 / # fail 0` |

**可失败性披露（不得整段声称已预跑）**：4 条门禁在**落地前**对本树实跑过负方向，失败项**全部**是「新代码尚未落地」类（缺 `deleteUserSkill` / 缺第十码 / 缺两个谓词 / 缺两个写方法 / 缺子路由 / 未转发 / 校验循环未覆盖两种键形态），无「合规实现也修不掉」的断言。**唯一由计划做过正方向 + 单点变异取证的子判据**是「`syncAgentSystemPrompt()` 函数体广播次数仍为 1」（它判既有代码）。**本执行者补齐的变异**如下表 —— 全部实跑、全部转红、全部已还原（还原后门禁复跑为绿）。

### 单点变异矩阵（本计划新增，全部实跑）

| # | 变异 | 门禁反应 |
|---|---|---|
| T1-M1 | 删掉 `kind === 'directory'` 断言 | 红：`deleteUserSkill 未断言 kind === directory` |
| T1-M2 | `env.fileInfo(userDir)` → `env.exists(userDir)` | 红：`deleteUserSkill 未用 env.fileInfo 判 kind（exists 判不出目录）` |
| T1-M3 | 删掉 `NOT_USER_OWNED` 分支 | 红：`deleteUserSkill 缺 not_user_owned 分支` |
| T1-M4 | `env.remove(userDir, { recursive: true })` → `env.remove(userDir)` | 红：`deleteUserSkill 未显式传 { recursive: true }` |
| T1-M5 | 往 `MANAGE_SKILL_SHORT_REASON` 加 `not_user_owned` | 红：`MANAGE_SKILL_SHORT_REASON 混入 not_user_owned（须保持恰 9 键）` |
| T2-M1 | 删掉 `setSkillDisabled` 的补播 | 红：`调用侧补播 0 次`；**行为面同时转红**：`node tests/test-ai-skills.js` ⇒ `# fail 2`（N1 + N3） |
| T2-M2 | 在方法里加第二次 `await this.syncAgentSystemPrompt()` | 红：`刷新链调用 2 次` |
| T2-M3 | 往 `syncAgentSystemPrompt()` 函数体再插一行广播 | 红：`函数体被改动（广播次数 ≠ 1）` |
| T2-C1 | 在函数体里写**注释**提及同一广播 + `refreshSkills()` | **不**转红（`stripC` 剥注释生效，判据不误伤解释性注释） |
| T3-M1 | 只保留 `key === 'aiSkills.disabled'` 那一半 | 红：`未覆盖 aiSkills 键形态`（**改实现前该变异为假绿**，见 Deviation 1） |
| T3-M2 | 去掉 `code: err.code || undefined` | 红：`错误形状缺 { error, code }` |
| T3-M3 | 删掉 set-disabled 分支的转调 | 红：`HTTP set-disabled 未转发到 setSkillDisabled` |
| T3-C1 | 把 `configStore.set` 挪到 `valid` 守卫之前 | 红：`tests/test-skills-http-api.js` ⇒ `# fail 1`（「拒绝时不落盘」判据可失败） |

### 四套回归 + 新建套件（一并跑通）

`test-skills-management.js` 35/35 · `test-manage-skill.js` 55/55 · `test-ai-skills.js` 187/187 · `test-skill-picker-model.js` 115/115 · `test-agent-workspace.js` 21/21 · `test-skills-http-api.js` **新建** 10/10。

### `STATE.md:292` 的份额记账（两个数必须分开记，OQ-5）

- **写路径收口 → 2/3 完成**：49 的 `manage_skill` 三动作 + 本计划的设置页启停 / 卸载（**恰一次** `ensureSkillsFresh()` → `syncAgentSystemPrompt()`，函数体逐字未改）；**只剩 51 的导入**。
- **50-01 新增的 `ensureSkillsFresh()` 是读侧 / 兜底调用方，不计入分子** —— 本计划的两个写方法只是复用它的分流（有 Agent 走 `syncAgentSystemPrompt`，无 Agent 直接重扫）。
- **P8 失效链仍不得声称 6/6 全覆盖**；`STATE.md:292` 的 ⚠️ 保持挂着。

## Known Stubs

None —— 本计划无硬编码空值 / 占位文案流入 UI。两个写端点的响应体是**真实投影**（`getSkillsForManagement()`）与真实删除结果，无虚报字段；卸载响应**刻意不携带**提示字段（提示由 50-04 的删除前确认弹框从投影数据渲染）。

## Threat Flags

None —— 未引入计划 `<threat_model>` 之外的信任边界。T-50-09（越权卸载）由 manager 层三态判据 + 直接调用用例承担；T-50-10（路径穿越）由 `validateSkillNameForManagement` 拒 `/` `\` 控制字符 + `path.join` 派生 + 沙箱 `env.remove` 承担（门禁断言函数体内无 `fs.`）；T-50-11（禁用名单污染）由双键校验 + 「拒绝时不落盘」承担；T-50-12（失效链断裂）由「重扫恰一次 + 补播恰一次」+ 忙时用例承担；T-50-13（失实文案）由 `not_user_owned` / `not_found` 分离承担；T-50-14（第二份校验实现）由谓词单源 + 门禁断言 `main.js` 引用承担；T-50-SC 零新增依赖（`package.json` 零 diff）。

## Next Phase Readiness

- **Wave 3（50-03）可直接复用**：两个写子路由已就位（`set-disabled` / `uninstall`），`readJsonBody` 的**第二位置参 `res` 尚未引入**（本计划刻意按当前两参形态书写，其签名改造是 50-03 的单一写者范围，届时「57 → 59 调用点」机械判据会把本计划新增的两处一并纳入）；`{ error, code }` 形状与 `sendJson` 幂等护栏的接入点也已就位（后者归 50-03 的 SEC-09）。
- **Wave 4（50-04）需注意**：① 卸载响应**不携带** `shadowNotice` 一类字段 —— 「同名内置 / 托管技能将在删除后重新可见」的提示必须由确认弹框从**投影数据**（`shadowed` / `shadowedBy`）渲染；② 设置页开关的可操作性依赖 `validateSkillNameForManagement` 的安全超集（`skills/My_Skill/` 必须能点）；③ 设置页收不到任何主进程广播，每次操作后用响应体回传的**最新投影**就地重渲染（`setSkillDisabled` 直接返回投影，`uninstallUserSkill` 返回 `{...result, management}`）。
- **Wave 4（50-05）需注意**：`counts-parity` 现为 **red**（5 个套件的实测值：`test-manage-skill.js` 55 / `test-ai-skills.js` **187** / `test-skill-picker-model.js` **115** / `test-skills-management.js` **35** / `test-skills-http-api.js` **10**），四处账本需同批扩并把 `cells` 基线从 8 提高；`MANAGE_SKILL_ERROR` 的**十一键 / 十码**口径要在 `docs/product/ai-skills.md` §11.3 与 §11.8 成文（工具侧九条不变 + 管理面 `not_user_owned`），`AGENTS.md` 的维护约定与测试清单同步。
- **无阻塞**。计划级 4 条门禁全绿、13 条单点变异全部转红、6 个套件回归全绿。

---

*Phase: 50-api-skills*
*Completed: 2026-09-14*

## Self-Check: PASSED

- key-files.created 存在性：`tests/test-skills-http-api.js` ✅ FOUND（`[ -f ]` 通过）
- 四个任务提交存在：`9b425d6` / `2af5680` / `c9984d8` / `1752a33` ✅ FOUND（`git log --oneline --all | grep`）
- 计划级 4 条门禁（10 个 `<automated>` 段）全部实跑：均 PASS（输出见上表）
- 计划级 `<acceptance_criteria>` 复核：`node --check` 三文件 exit 0；三条扫描门禁 stdout 逐条命中；五套件 `# fail 0`；`ai-skills-manager.js` 零 `require('electron')`；`syncAgentSystemPrompt()` 函数体零改动（N8 + 门禁 T2-G1 双判据）；三态拒绝面三条用例均经 `deleteUserSkill()` 直接调用
- 计划要求的单点变异全部实跑：13 条（含 1 条反向对照）全部按预期（12 转红 + 1 不转红），全部已还原且还原后门禁复跑为绿

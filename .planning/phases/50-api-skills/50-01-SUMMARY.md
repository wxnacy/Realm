---
phase: 50-api-skills
plan: 01
subsystem: ai
tags: [skills, settings-page, http-api, sandbox, realm-token, csp, dom-api, digest]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: ai-skills-manager.js 的技能集单一数据权威（刷新管线 / 校验器 / 三动作）与 MANAGE_SKILL_ERROR
  - phase: 48-skill-name
    provides: sourceTierOf 三档档位、toUISkillEntry 收窄投影、src/skill-picker-model.js 的双模式导出与 TIER_BADGE
  - phase: 46-prompt
    provides: refreshSkills 的加载后管线（①..⑦ 定序）与 computeDigest 的字段集契约
provides:
  - 'ai-skills-manager.getSkillsForManagement(seededNames)：管理面投影（三档分组 + 空组剔除 + 组内 bySkillPriority 全序 + bytes/fileCount/statsUnavailable/diagnostics，无 content/filePath）'
  - 'ai-skills-manager.measureSkillDir(env, dir)（内部）：D-13 口径的递归尺寸统计 + SKILL_SIZE_WALK_MAX_ENTRIES/DEPTH 双上限（已导出供单测）'
  - 'AIManager.ensureSkillsFresh()：不依赖 Agent 的管理读路径初始化（D-19），无 provider 时也能列出盘上的技能'
  - 'GET /api/skills/list：token 鉴权 + 分发分支 reqPath.startsWith(''/api/skills/'')（插在 /api/ai-memory 之前）'
  - 'src/skill-picker-model.js：STATUS_TEXT.disabled=''已禁用''（第 5 条）+ SETTINGS_STATUS_CHAIN（冻结链）+ pickStatusKey()'
  - '设置页 .skill-manage-section 区外壳与只读三档分组列表（零 HTML 字符串模板，全 DOM API）'
  - '--skill-success-text 令牌（两套主题）+ main.css 末尾的 Phase 50 专属段'
  - 'tests/test-skills-management.js（新建套件，23 例）'
affects: [50-02, 50-03, 50-04, 50-05, 51]

actuals:
  tokens: 22845
  tasks: 3
  commits: 3
plan_head_before: 62b74b4f02598feedeb0862e8769346da13164eb

tech-stack:
  added: []
  patterns:
    - '管理面投影与面板投影并列共存：getSkillsForManagement 不扩展 getSkillsForUI（后者是 / 面板的有意收窄投影）'
    - '读路径初始化与写路径收口分离：ensureSkillsFresh 是读侧兜底，不并入 syncAgentSystemPrompt 的写侧份额账'
    - '状态链抽成冻结数组 + 纯函数（SETTINGS_STATUS_CHAIN + pickStatusKey），把「多命中取首条」从 if 顺序升格为可断言数据'
    - '渲染端零 HTML 字符串模板：region 负向扫描（innerHTML）+ 正向命题（createElement/textContent）成对'

key-files:
  created:
    - tests/test-skills-management.js
  modified:
    - ai-skills-manager.js
    - ai-manager.js
    - main.js
    - src/skill-picker-model.js
    - src/settings.html
    - src/settings-page.js
    - src/styles/main.css
    - tests/test-skill-picker-model.js

key-decisions:
  - 'getSkillsForManagement 的组形状取 { tier, items } 且在**主进程**完成空组剔除（D-03）——渲染层只 groups.forEach'
  - '条目级 diagnostics 经 slice() 深拷（活引用会让设置页把数据写回权威快照），errors 浅拷'
  - 'statsUnavailable 用**显式布尔**而非「必有诊断」的隐式契约（T-50-05）'
  - 'measureSkillDir 刻意不导出（测行为不测实现）；两个遍历上限导出供单测'
  - 'ensureSkillsFresh 的判据是「Agent 存在与否」，不是「有没有 provider」（ai-manager 有两条 provider 早退）'
  - 'SETTINGS_STATUS_CHAIN 不含 nameClash（依赖本地命令表，realm:// guest 拿不到）；面板链保持原样不动'
  - '「仅显式」的 label/title 在设置页暂以本文件常量承载，单源提升归 50-04（UI-SPEC 硬前置条件）'

patterns-established:
  - '管理读路径的会话边界：设置页收不到主进程广播 ⇒ 每次进入该页与每次操作后自行重拉'
  - '尺寸统计只进重扫管线、随 refreshedAt 失效、不进 computeDigest'

requirements-completed: [USER-01, USER-07]

coverage:
  - id: D1
    description: '管理面投影 getSkillsForManagement()：三档分组（user→builtin→managed）+ 空组剔除 + 组内 bySkillPriority 全序 + bytes/fileCount/statsUnavailable/diagnostics 四管理字段 + limits 五键，且不携带 content/filePath'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#投影形状：三档分组顺序 / 空组剔除 / 字段齐备 / limits / diagnostics 深拷'
        status: pass
    human_judgment: false
  - id: D2
    description: '读路径初始化 AIManager.ensureSkillsFresh()（D-19）：不创建 Agent、未配置任何 provider 时仍能列出盘上的技能'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#端到端：不创建 Agent 时 ensureSkillsFresh() 之后仍能列出盘上的技能'
        status: pass
    human_judgment: false
  - id: D3
    description: 'GET /api/skills/list 端点：token 鉴权（无 / 错 token ⇒ 403）+ /api/skills/ 分发分支（插在 /api/ai-memory 之前）+ 先 ensureSkillsFresh 再同步取投影'
    requirement: USER-07
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#接线：handleSkillsApi 存在 / 首段 token 鉴权 / startsWith 分发 / list 子路由顺序'
        status: pass
    human_judgment: true
    rationale: '源码扫描只能证明接线存在，不能证明「起服务后 403/200 的真实行为」。本计划不引入 HTTP 端点测试基建（套件归 50-02 的 tests/test-skills-http-api.js），故端点行为属 UAT 面'
  - id: D4
    description: '设置页「技能管理」区外壳 + skill-picker-model.js 脚本序 + 只读三档分组列表渲染（零 innerHTML，全 DOM API）'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#样式硬禁令（region/选择器级）与门禁 A1 的 region 扫描（负向 innerHTML + 正向 createElement/textContent）'
        status: pass
    human_judgment: true
    rationale: '纯 Node 环境无 DOM ⇒ 渲染结果只经源码扫描断言，未做真实渲染。realm:// CSP 下 window.SkillPickerModel 的加载表现与列表实际形态属 50-VALIDATION 的 Manual-Only 项（research A3/A6）'
  - id: D5
    description: 'STATUS_TEXT 第 5 条 disabled=''已禁用'' + SETTINGS_STATUS_CHAIN 冻结链 + pickStatusKey() 单源；既有 4 键逐字未变'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skill-picker-model.js#STATUS_TEXT 第 5 条 / 链序即契约 / 多命中取首条 / 链与表不漂移'
        status: pass
    human_judgment: false
  - id: D6
    description: '体积与文件数的 D-13 口径：递归、含 SKILL.md、不含隐藏文件、目录 size 不计、不穿 symlink、双上限截断不拒绝加载、失败不静默、不进 computeDigest'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#尺寸统计口径组（7 例，含 statsUnavailable 分支与「不进 digest」值副本用例）'
        status: pass
      - kind: unit
        ref: 'node tests/test-ai-skills.js（computeDigest 与 refreshSkills 的既有契约未被扰动）'
        status: pass
    human_judgment: false
  - id: D7
    description: 'CSS 契约：--skill-success-text 令牌两套主题各一份 + main.css 末尾 Phase 50 专属段 + 两条硬禁令（行无 --bg-hover 底 / 行首行无 flex-wrap）'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#样式硬禁令组（选择器级扫描）+ 门禁 A3 的令牌/源序/单块判据'
        status: pass
    human_judgment: false
  - id: D8
    description: '视觉与交互观感：三档分组行式列表的可读性、行首行单行不变式（800px 最小窗口下右簇不被裁切）、空态 A/B/C 的呈现、状态标注色调'
    verification: []
    human_judgment: true
    rationale: 'UI-SPEC 的 E5 overflow 行本身就是 resolved (backstop)，无显式证据则必须路由 human_needed；空态与行密度只能由真实 realm:// 页面确认'

# Metrics
duration: 14 min
completed: 2026-09-14
status: complete
---

# Phase 50 Plan 01: 设置页「技能管理」区端到端纵切 Summary

**管理面投影 + 不依赖 Agent 的读路径初始化 + `GET /api/skills/list` + 设置页只读三档分组列表（零 innerHTML 全 DOM 构建）+ `STATUS_TEXT` 第 5 条与状态链单源 + D-13 尺寸口径（递归/含 SKILL.md/不含隐藏/目录 size 不计/不穿 symlink/不进 digest）**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-14T13:07:45Z
- **Completed:** 2026-09-14T13:21:19Z
- **Tasks:** 3 / 3
- **Files modified:** 9（新增 1 个测试套件）
- **Diff:** +1692 / −3

## Accomplishments

- **端到端纵切打通（本计划作为 Phase 50 tracer 的全部理由）**：盘上的技能目录 → 沙箱遍历 → 管理投影 → `ensureSkillsFresh()` 读路径初始化 → `GET /api/skills/list`（token）→ 设置页 guest 渲染 → CSS。这条路径一次跑通同时证伪了「HTTP 端点接错」「双模式导出在 `realm://` CSP 下不可用（源码面）」「主进程投影形状不足」三类假绿风险。
- **判据 1 在无 provider 用户处不再整体空白（D-19）**：`ensureSkillsFresh()` 以「Agent 存在与否」分流（有 Agent 走 `syncAgentSystemPrompt()`，无 Agent 直接 `refreshSkills()`，**恰一次重扫**）；`init()` 的两条 provider 早退都不再导致列表恒空。端到端用例证明「不创建 Agent 时列表仍非空」，且把该调用换成 `syncAgentSystemPrompt()` 会让用例转红（变异实跑确认）。
- **尺寸统计的口径与两条静默失效面同时落地（D-13）**：只经沙箱 `env.listDir` 遍历、显式跳 symlink（内部链接环会无限递归）、跳隐藏文件、只对 `kind === 'file'` 累加、双上限截断不拒绝加载、逐技能隔离失败（绝不冒泡到整体回滚）、`computeDigest()` 逐字未改（尺寸不进 digest）。
- **状态标注单源从「if 顺序」升格为可断言数据（D-12）**：`SETTINGS_STATUS_CHAIN`（冻结数组）+ `pickStatusKey()`（多命中取首条）住 `src/skill-picker-model.js`，设置页只消费；「同时命中 `disabled` + `overLimit` ⇒ 只显示『已禁用』」有独立用例。
- **注入纪律以成对判据落地**：设置页新增代码全部包在 `/* Phase 50 skill-manage region: start|end */` 之间，负向扫描（`innerHTML`/`insertAdjacentHTML`）+ 正向命题（`document.createElement(` / `textContent`）同时成立，`TD-48-01` 的缺口未被扩大。

## Task Commits

Each task was committed atomically:

1. **Task 1: 管理读路径端到端纵切（投影 → 读路径初始化 → GET /api/skills/list → 新测试套件）** - `3f7cc14` (feat)
2. **Task 2: 设置页「技能管理」区骨架 + 只读分组列表 + `STATUS_TEXT` 第 5 条单源** - `d0dc379` (feat)
3. **Task 3: 体积 / 文件数递归统计进重扫管线** - `e91970b` (feat)

**Plan metadata:** （本提交，docs: complete plan）

## Files Created/Modified

- `ai-skills-manager.js` — 新增 `getSkillsForManagement()`（管理面投影）、`measureSkillDir()`（内部尺寸遍历）、`SKILL_SIZE_WALK_MAX_ENTRIES`(5000) / `SKILL_SIZE_WALK_MAX_DEPTH`(16)；`refreshSkills()` 在 ④ 定序后 / ⑤ 禁用标记前逐技能统计；`computeDigest()` 逐字未改
- `ai-manager.js` — 新增 `ensureSkillsFresh()`（读路径初始化，D-19）与 `getSkillsForManagement()`（转发层）；`syncAgentSystemPrompt()` 函数体逐字未改
- `main.js` — 新增 `handleSkillsApi(req, res, reqUrl)`（token → `list` 子路由）+ `reqPath.startsWith('/api/skills/')` 分发分支
- `src/skill-picker-model.js` — `STATUS_TEXT.disabled='已禁用'`；`SETTINGS_STATUS_CHAIN` + `pickStatusKey()`（并入双模式导出面）
- `src/settings.html` — `.settings-group.skill-manage-section` 区外壳 + `#skillManageState` / `#skillManageGroups` / `#skillManageHint` + 区说明三段 + `<script src="skill-picker-model.js">`（排在 `settings-page.js` 之前）
- `src/settings-page.js` — Phase 50 region：`skillsApi()` / `formatSkillSize()` / `clearNode()` / `buildSkillManageStateBlock()` / `buildSkillManageRow()` / `buildSkillManageGroup()` / `renderSkillManageLoading|EmptyState|Failure()` / `renderSkillManagement()` / `loadSkillManagement()` / `setupSkillManageListeners()`；`init()` 并列挂载
- `src/styles/main.css` — 两套主题各加 `--skill-success-text`；末尾新增 Phase 50 专属段
- `tests/test-skill-picker-model.js` — `disabled` 值断言 / 链序断言 / 多命中取首条 / 值域不漂移；令牌账本追加 `--skill-success-text`（该表自带「只允许追加」纪律）
- `tests/test-skills-management.js` — **新建**（23 例：管理读路径 8 例 + 接线扫描 5 例 + 尺寸口径 8 例 + 样式硬禁令 2 例）

## Decisions Made

- **组形状 `{ tier, items }`、空组剔除在主进程**（D-03）—— 渲染层零判定，只 `groups.forEach`。
- **条目级 `diagnostics` 深拷、`errors` 浅拷**：`diagnostics` 是 `_cache` 内的活数组，浅拷会让设置页的展开操作写回权威快照（已有专门用例钉住）。
- **`statsUnavailable` 用显式布尔**，不依赖「此时必有诊断」的隐式契约（T-50-05）。
- **`measureSkillDir` 刻意不导出**（测行为不测实现），两个遍历上限则导出供单测。
- **`ensureSkillsFresh` 判据取「Agent 存在与否」**：`ai-manager.init()` 有**两条** provider 早退（无 Key / 模型名解析不到），按 provider 判会漏掉第二条。
- **`SETTINGS_STATUS_CHAIN` 不含 `nameClash`**：它依赖 `SLASH_COMMANDS`（浏览器脚本常量），`realm://` guest 拿不到；面板链保持原样不动，两条链不可合并。
- **「仅显式」的 label/title 暂以 `src/settings-page.js` 内常量承载**：UI-SPEC 硬前置条件的单源提升会同时打翻 `tests/test-skill-picker-model.js` 的三条既有断言（其中一条会被新设计直接证伪），属一整批改动，归 50-04。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `handleSkillsApi` 的 `aiManager` 空值守卫**
- **Found during:** Task 1
- **Issue:** 计划原文的 `list` 分支直接 `await aiManager.ensureSkillsFresh()`。`aiManager` 是模块级 `let`，在 `whenReady` 内赋值；`realmServer` 的监听早于它完成时，早期请求会撞上 `TypeError: Cannot read properties of null`（500 且无可用信息），而不是一个可理解的页面状态。
- **Fix:** 仿既有 `if (!aiManager)` 范式（`main.js` 的 AI 助手端点共 12 处同款），返回**空投影** `{ groups: [], errors: [], refreshedAt: 0, digest: '', limits: {} }` —— 设置页据此走「技能列表尚未加载」空态（`refreshedAt === 0` 的既有语义），零新增渲染分支。
- **Files modified:** `main.js`
- **Verification:** 门禁 A2 与接线用例均绿；空投影形状与 `getSkillsForManagement()` 同键集。
- **Committed in:** `3f7cc14` (Task 1 commit)

**2. [Rule 2 - Missing Critical] 自行补两条样式硬禁令的选择器级判据（计划自带判据存在假绿面）**
- **Found during:** Task 2 的单点变异矩阵
- **Issue:** 计划自带的样式判据只扫 `.skill-manage-row { … }` / `.skill-manage-row-main { … }` **单个规则块**。实测：另起一条 `.skill-manage-row:hover { background: var(--bg-hover); }` 可**完整绕过**它（变异实跑 ⇒ 门禁仍绿），而这两条不变式正是 UI-SPEC 的 Color 硬禁令（行加 hover 底会让描述 / 元信息 / 中性状态标注同时跌破 4.5:1）。
- **Fix:** 在 `tests/test-skills-management.js` 新增「样式硬禁令」组：先剥 CSS 注释，再按**选择器形态**扫 Phase 50 整段，对任何选择器含 `.skill-manage-row` / `.skill-manage-row-main` 的规则块断言无 `background: var(--bg-hover)` / 无 `flex-wrap`。计划自带的判据**一字未改**（未放宽、未替换）。
- **Files modified:** `tests/test-skills-management.js`
- **Verification:** 变异实跑 —— 加 `.skill-manage-row:hover` 底 ⇒ 新判据转红（旧判据仍绿）；加 `.skill-manage-row-main.x { flex-wrap: wrap }` ⇒ 新判据转红；合规树无输出。
- **Committed in:** `d0dc379` (Task 2 commit)

### 计划自带门禁的实测弱点（已复现，未放宽任何判据）

- **T3 门禁 A 的「目录分支累加 bytes」判据只看起始行**：`dirLine = b.slice(dirIdx).split("\n")[0]`，因此把 `bytes += …` 加在 `if (e.kind === 'directory') {` 的**下一行**（最自然的写法）**不会转红**；只有写成同一行才会。计划要求的这次变异实跑结论如实记录：**计划门禁绿，但本计划新增的 3 条行为用例转红**（`递归含子目录` / `目录 size 不计` / `不穿 symlink`）—— 即该不变式由「计划源码判据（窄）+ 新套件行为判据（宽）」两条独立证据链共同承担，未留裸面。同一行写法下计划门禁确实转红（已实跑）。
- **`computeDigest` 的函数体窗口与注释剥离**：计划已把窗口从「900 字符」改成括号界定并先剥注释，实测在函数体内如实写「勿把 `bytes` / `fileCount` 加进来」的注释**不**转红，真加 `e.bytes > 0` 转红 —— 与计划声称一致。

### 计划文本的两处不可满足项（按更具体的锁定决策调和，已如实披露）

**3. [Rule 1 - Bug] Task 3 尺寸用例的文件数常量与文件清单不自洽**
- **Found during:** Task 3
- **Issue:** 计划原文「`SKILL.md` + `scripts/a.js` + `references/deep/b.md` ⇒ `fileCount === 4`、`bytes` = **四个**文件真实字节和」—— 清单列 3 个文件而期望值是 4，二者不可同真。
- **Fix:** 取「让两个数都自洽」的读法：夹具用**4 个真实文件**（补 `scripts/b.js`），且期望值**一律由 `fs.statSync` 求和算出**（不写手写常量，符合计划「用真实数据形状断言」的要求），并显式断言夹具恰为 4 个文件（防止日后夹具被改小而断言静默失去区分力）。
- **Files modified:** `tests/test-skills-management.js`
- **Verification:** `递归含子目录` 用例绿。
- **Committed in:** `e91970b` (Task 3 commit)

**4. [Rule 1 - Bug] Task 3「chmod ⇒ `statsUnavailable === true`」在语义上不可达**
- **Found during:** Task 3
- **Issue:** 计划要求「造一个不可读的技能子目录（`fs.chmodSync(dir, 0o000)`）⇒ 该技能条目 `statsUnavailable === true` 且 `diagnostics` 非空」。但 `statsUnavailable` 的判据是 `bytes === 0 && fileCount === 0`，而**技能目录里恒有可读的 `SKILL.md`** ⇒ 任何「技能仍在列表上」的场景下 `fileCount ≥ 1`。若改成 chmod **技能目录本身**，则 SDK 的 `loadSkills` 同样 `listDir` 失败 ⇒ 技能**整条从列表消失**（实测：`chmod 技能目录` 后投影里没有该技能，诊断是 SDK 的 `list_file_info_failed`/`list_failed`）⇒ 依然取不到 `statsUnavailable`。
- **Fix:** 拆成两条用例，各覆盖可达的那一面：
  ① 「统计局部失败不静默也不放大」用 `chmod 0o000`（子目录）—— 断言该技能**仍在列表上**、产 `realm_skill_dir_unreadable` 诊断、可读部分照常计入（`fileCount === 1`）、其余技能照常统计、技能集未整批消失；并**显式写明**此处 `statsUnavailable === false` 是正确的（它表达「一点都没统计到」而非「统计得不完整」）。
  ② 「`statsUnavailable` 分支」用**读盘时序注入**（沙箱 Result 契约的失败形状 `{ ok:false, error:{ code:'permission_denied' } }`，仅对该技能目录的**第 2 次** `listDir` 生效 —— 第 1 次是 SDK 加载）覆盖 `bytes/fileCount` 双零 ⇒ `statsUnavailable === true` + 诊断非空。这正是真实竞态（bash / Finder 可在两次 IO 之间改动权限或删目录）的形态。
- **Files modified:** `tests/test-skills-management.js`
- **Verification:** 两条用例均绿；夹具自带 `targetListCalls >= 2` 断言（防止注入失效后用例退化为空集真）。
- **Committed in:** `e91970b` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed（2 条 Rule 2 缺关键功能、2 条 Rule 1 计划文本不可满足项的调和）+ 1 条计划自带门禁弱点（已复现、由新套件补齐证据链，未放宽任何判据）。
**Impact on plan:** 全部落在「不改动计划任何判据、只补证据链」的范围内；交付面与计划的 `<success_criteria>` 逐条一致，无功能范围变更。两处计划文本不可满足项已在上面逐条披露，未静默改写计划意图。

## Issues Encountered

- **纯 Node 下 `getSeededSkillNamesSafe()` 必然降级为空集合**：`require('electron')` 在纯 Node 返回字符串 ⇒ `builtin-skills-seeder` 抛错 ⇒ 该函数 `console.warn` 后返回 `[]`。端到端用例（走 `AIManager` 原型方法）因此在用例内临时静音 `console.warn` 并注释说明；其余档位断言一律**显式注入** `SEEDED` 常量（沿用 49 的注入式纪律，杜绝 seeded 保护假绿）。
- **设置页渲染与 `realm://` CSP 的真实表现无法在本计划内自动化**：纯 Node 无 DOM，且本仓无 HTTP 端点测试基建。已按 50-VALIDATION 的 Manual-Only 表分类（A3 / A6），并在 coverage 块把 D3 / D4 / D8 标为 `human_judgment: true`，交 UAT 而非假称已验。
- **`counts-parity` 本波预期为红**（`50-RESEARCH.md` Pitfall 11 的「中途 red」）：新增了第 4 个套件而四处账本尚未扩。按计划**不得**在本计划里改账本（改了会与 Wave 2/3 的后续改动再次漂移），由 Wave 4 的 50-05 一次收口。

## Known Stubs

None —— 本计划无硬编码空值 / 占位文案流入 UI。两处**刻意延后**（非 stub，已在计划中显式归属 50-04）：`#skillManageHint` 目前只有结构与初始隐藏、无写入者（交互归 50-04）；「仅显式」的 label/title 暂以本页常量承载（单源提升归 50-04）。

## Threat Flags

None —— 未引入计划 `<threat_model>` 之外的信任边界。T-50-01（token 403）由 `handleSkillsApi` 首段承担并有用例钉住；T-50-02（遍历 DoS）由 symlink 跳过 + 双上限承担；T-50-03（路径来源）由「只经 `env.listDir`、零 `fs`」承担；T-50-04/T-50-05 由逐技能隔离失败 + `statsUnavailable` 承担；T-50-06 由 region 的正/负成对判据承担；T-50-07 由「`computeDigest` 逐字未改」的门禁 + `test-ai-skills.js` 178/178 承担；T-50-SC 零新增依赖。

## Next Phase Readiness

- **Wave 2/3 的四条已证伪路径可直接复用**：`getSkillsForManagement()`（50-02 的写路径响应体即它）、`GET /api/skills/list` 的 token + 分发范式（50-02 加 `set-disabled` / `uninstall` 子路由）、`ensureSkillsFresh()`（写路径的读侧前置）、Phase 50 CSS 专属段（50-04 的诊断/弹框/操作区规则追加进同一段，保持「整段可复核」）。
- **50-02 需注意**：`MANAGE_SKILL_ERROR` 加 `NOT_USER_OWNED` 会打翻 `tests/test-manage-skill.js` 的「恰十键 / 九码」冻结断言 —— 计划已把该刷新归 50-02，不在本计划内动。
- **50-04 需注意**：① 「仅显式」单源提升会**同时**打翻 `tests/test-skill-picker-model.js` 的三条断言（`:1265-1269` / `:1270-1274` / `:1278`），必须三条一起改（`:1278` 在新设计下字面不可满足）；② `setSkillManageHint` / `resetSkillManageHint` / `setCollapsed` 的单点赋值纪律尚未落地，本计划刻意未提前落（避免死代码）。
- **50-05 需注意**：`counts-parity` 账本现为 4 个套件（`test-skills-management.js` 例数 23、`test-skill-picker-model.js` 115、`test-ai-skills.js` 178、`test-manage-skill.js` 55），四处账本同批扩即可收回。
- **无阻塞**。计划级 9 条门禁全绿；回归面 22 个套件全绿（含 `test-ai-skills.js` 178/178，证明尺寸统计未扰动 `computeDigest` 与 `refreshSkills` 的既有契约）。
- **`REQUIREMENTS.md` 本轮未勾选任何 ID**（`requirements.ready-ids` 返回 `ready: []` / `blocked: [USER-01, USER-07]`）：这两条被本阶段的兄弟计划共同声明（USER-01 由 50-04 / 50-05 也声明；USER-07 由 50-03 也声明），共享 ID 门禁（#2388）在最后一个声明者产出 SUMMARY 前**故意**不放行。这是正确行为，不是遗漏 —— 待 50-03/04/05 落盘后自动转为就绪。同理 USER-07 的 IPC 半边（主窗口 `realmAPI`）归 50-03，本计划只交付 HTTP 半边。

---

*Phase: 50-api-skills*
*Completed: 2026-09-14*

## Self-Check: PASSED

- key-files.created 存在性：`tests/test-skills-management.js` ✅ FOUND（`[ -f ]` 通过）
- 三个任务提交存在：`3f7cc14` / `d0dc379` / `e91970b` ✅ FOUND（`git log --oneline --all | grep`）
- 计划级 9 条门禁全部实跑：`t1-a1..t3-a3` 均 PASS（输出见「Issues Encountered」与上述证据）
- 计划级 `<acceptance_criteria>` 复核：`node --check` 三文件 exit 0；主干扫描 / 接线扫描 / 尺寸口径扫描 / 样式扫描四段 stdout 逐条命中；`tests/test-skills-management.js` `# fail 0`；`tests/test-skill-picker-model.js` `# fail 0`；`tests/test-ai-skills.js` `# fail 0`；`ai-skills-manager.js` 无 `require('electron')`；`syncAgentSystemPrompt()` 函数体零改动（有用例钉住）；投影条目 `content` / `filePath` 的 `in` 断言为 false
- 计划要求的单点变异全部实跑：tracer（换成 `syncAgentSystemPrompt` ⇒ 红）、region `innerHTML` / 去 `createElement` / 直读 `overLimit` 字段（⇒ 红）、markup 真内联 `display:none`（⇒ 红；注释形态不红）、链序调序 / 去 `freeze` / `disabled` 改名（⇒ 红；多行双引号形态不红）、删暗色令牌（⇒ 红）、两条样式硬禁令（⇒ 红；新套件亦对 `.skill-manage-row:hover` 形态转红）、`measureSkillDir` 跳 symlink 去掉（⇒ 红）、`computeDigest` 摘 `e.disabled` / 加 `e.bytes`（⇒ 红）、目录分支累加 bytes（计划门禁**窄**：仅同行形态转红；新套件行为用例转红）
- `commits: 3` 由台账实测（`git rev-list --count 62b74b4..HEAD`），非叙述值

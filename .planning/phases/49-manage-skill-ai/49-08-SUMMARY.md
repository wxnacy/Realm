---
phase: 49-manage-skill-ai
plan: 08
subsystem: ui
tags: [electron, renderer, a11y, focus-visible, tabindex, playwright-electron, css, gap-closure]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: 49-02 的 `renderSkillContentBox` 唯一构建实现与 `manage_skill` 卡片变体（本 gap 的载体）
  - phase: 48-skill-name
    provides: 折叠块家族（`.ai-skill-content-box*`）与 48-UI-REVIEW Pillar 6 的 a11y 建议
provides:
  - `renderSkillContentBox(skillInvocation, { interactive = true })` 语境开关：气泡施加焦点语义、卡片不施加
  - `tests/uat-49-g49-4-card-a11y-tab-order.js`：真实渲染 + 真实键盘的门禁（Tab 遍历 + 命中测试 + 气泡对照 + Enter 切换 + 单点变异自证），红→绿两轮证据
  - `tests/test-ai-skills.js` M9b：a11y 增量形态的源码面护栏（剥注释含行尾注释）
  - 契约/产品文档的 a11y 增量适用范围限定（气泡施加 / 卡片不施加）与八个账本单元的实测刷新
affects: [49-UI-SPEC, ai-skills, ai-agent-workspace, 50-settings-skill-management]

# Actuals (#2632) — pairs with the plan's `estimate` (tokens 42000 / tasks 3, confidence low).
# Same estimateTokens scale: chars/4 over the realized diff (47647 chars). Never a harness count.
actuals:
  tokens: 11912
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "共享构建函数的**语境开关**：同一份 DOM 构建在「恒可见宿主」与「默认折叠宿主」下需要语境相关的焦点语义，开关缺省值必须保证既有调用点零改动"
    - "a11y 判据挂在**命中测试**上（`elementFromPoint(center) ∈ {self, descendant}`）而不是矩形高 —— 被 `overflow: hidden` 裁掉的后代仍报自己的布局盒高，且其中心点的命中对象是**承载裁切的祖先**"
    - "红轮即单点变异态：驱动把 `mutation` 写进证据 JSON，并用 R1/R2 排除「遍历没跑起来」的空真"

key-files:
  created:
    - tests/uat-49-g49-4-card-a11y-tab-order.js
  modified:
    - src/renderer.js
    - src/styles/main.css
    - tests/test-ai-skills.js
    - docs/product/ai-skills.md
    - AGENTS.md
    - .planning/phases/49-manage-skill-ai/49-UI-SPEC.md
    - .planning/phases/49-manage-skill-ai/49-UI-REVIEW.md

key-decisions:
  - "修法选 C（语境开关，卡片不施加焦点语义）而非把可达性上移到卡片头部：后者会推翻契约 `49-UI-SPEC.md:508` 的锁定决策，且爆炸半径覆盖 `renderToolCard` 的全部工具卡片 —— 本计划是 gap-closure，职责是闭合而非重设计"
  - "**R3 的判据体被收紧**：命中测试只接受「自身或后代」，**不接受祖先**。计划原文写的是「落回自身（或其祖先 / 后代）」—— 实跑证明该形态在**未修复树上就判绿**（被裁切的后代，其中心点真正命中的正是承载裁切的祖先 `.ai-message`），属自毁形态。按计划的 R6 自校验纪律，红轮不红 ⇒ 修驱动、不改源码"
  - "R4（气泡对照）与目标卡片**不在同一会话**（本仓 realm-dev 里「含 manage_skill 成功卡片」与「含技能调用气泡」的会话无交集），故 R4 改为**切换会话**取气泡实例，并把 R5 提到 R4 之前执行（卡片侧断言必须先做完）"
  - "Tab 遍历起点钉到文档开头（`document.body` 临时 `tabindex=\"-1\"` + `focus()`）：不加这一句时浏览器把起点留在上一次点击处，遍历起点随交互漂移"
  - "例数按**实测**回填：`test-ai-skills.js` 177 → **178**（新增 M9b），另两套件 55 / 111 未变；八个账本单元用 §11.8 的可重跑一致性命令验收（cells=8）"
  - "`49-UI-REVIEW.md` 的 `Closed by` 标记写成 `**Closed by: 49-08-PLAN.md**` 而非计划原文的 `**Closed by:** 49-08-PLAN.md` —— 计划自带的判据正则 `/Closed by:\\s*49-08/` 会被后者的 `**` 挡住（计划自身文本与自身门禁不自洽）"

patterns-established:
  - "语境相关的焦点语义：焦点语义只在**可见宿主**下施加；宿主用 `max-height: 0` 折叠时后代仍在 Tab 序内（浏览器语义，非本项目可调）"
  - "真实渲染门禁的红→绿两轮证据 + 单点变异自证是本阶段 a11y 类改动的准入形态"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "折叠的 `manage_skill` 卡片内不再出现不可见的键盘停靠点（语境开关 `{ interactive = false }` + 三条属性与 keydown 受守卫）"
    verification:
      - kind: automated_ui
        ref: "NODE_PATH=\"$(npm root -g)\" node tests/uat-49-g49-4-card-a11y-tab-order.js#R3（红轮 2 站全违反 → 绿轮 0 站）"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js#M9b（守卫内形态 + 两调用点取值 + 单源未破）"
        status: pass
      - kind: other
        ref: "node -e <css-decl-freeze>（声明投影 sha 与 HEAD 逐字相等：69899a4f…）"
        status: pass
    human_judgment: false
  - id: D2
    description: "气泡实例的 a11y 增量原位保留（role/tabindex/aria-expanded + 真实 Enter 切换 `.collapsed` 并同步 aria-expanded）"
    verification:
      - kind: automated_ui
        ref: "tests/uat-49-g49-4-card-a11y-tab-order.js#R4（红轮即绿：会话 49659819 的气泡实例三属性在场，真实 Enter 后 aria-expanded=false→true、collapsed→展开）"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js#M9b 断言⑥（气泡调用点逐字未动）"
        status: pass
    human_judgment: false
  - id: D3
    description: "契约 / 产品文档的 a11y 增量适用范围限定 + 八个例数账本按实测刷新 + UI-REVIEW 的 W6-01 只加不删闭合标注"
    verification:
      - kind: other
        ref: "node -e <copy-parity>（:508 未破 + 四个新词锚点在场 + UI-REVIEW 只加不删）"
        status: pass
      - kind: other
        ref: "docs/product/ai-skills.md §11.8 的 counts-parity 命令（cells=8，measured 55/178/111）"
        status: pass
    human_judgment: true
    rationale: "门禁只证明「锚点在场、:508 逐字未破、账本计数等于实测」；这些限定文字是否**准确**描述了实现（以及 `49-UI-REVIEW.md` 的闭合叙述是否恰如其分）需人读一遍 —— 本阶段已反复记录「声明在场 ≠ 行为/口径成立」"

duration: 26 min
completed: 2026-09-14
status: complete
plan_head_before: f0f174e3d157eebcb4f401fc988c3435a3b03a36
---

# Phase 49 Plan 08: `UI-49-W6-01` 闭包（折叠卡片内的不可见键盘停靠点）Summary

**`renderSkillContentBox` 增加语境开关：气泡实例施加 `role`/`tabindex`/`aria-expanded`/Enter-Space，卡片实例关闭（宿主用 `max-height: 0` 折叠，后代不会自动退出顺序焦点导航），并以真实 Tab 遍历 + 命中测试门禁取得红→绿两轮证据**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-09-13T16:20:00Z（近似；本地 00:20）
- **Completed:** 2026-09-13T16:45:00Z
- **Tasks:** 3
- **Files modified:** 8（1 新建 / 7 修改）

## Accomplishments

- **BLOCKER 闭合**：折叠的 `manage_skill` 卡片上不再有零可见高度的 Tab 停靠点 —— 真实 Tab 遍历下卡片域内停靠点 **2 站 → 0 站**，且 `tabindex`/`role`/`aria-expanded` 在**折叠与展开两态**均为 `null`。
- **非回归地保留气泡面**：气泡实例的 a11y 增量原位未动（三属性在场，真实 Enter 能切换 `.collapsed` 并同步 `aria-expanded`），48-UI-REVIEW Pillar 6 的修复**未被一刀切删掉**。
- **契约 `:508` 未被推翻**：卡片的展开 / 折叠仍是全仓既有的鼠标语义；`:508` 逐字未改，只给 `:427`/`:509`（原文行号 424/509）补上适用范围的限定与理由。
- **真实渲染门禁落盘可重跑**：`tests/uat-49-g49-4-card-a11y-tab-order.js`（P1–P2 + R1–R6），红轮 R3 违反 2 站 / R5 红、绿轮全绿退出码 0；证据 JSON `runs[]` 同时保留红绿两轮。
- **八个例数账本按实测刷新**：`test-ai-skills.js` 177 → **178**，`test-manage-skill.js` 55、`test-skill-picker-model.js` 111 未变；§11.8 的可重跑一致性命令输出 `cells=8`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 端到端「折叠卡片内不存在不可见键盘停靠点」——写驱动 → 跑红 → 改源码 → 跑绿** — `d68d7d6` (feat)
2. **Task 2: 源码面护栏（条件施加的形态、两个调用点的取值、单源未破）+ 八个账本单元刷新** — `7b88452` (test)
3. **Task 3: 契约与文档口径收口 + UI-REVIEW 的 gap 闭合标注** — `5403584` (docs)

**Plan metadata:** `(this commit)` (docs: complete plan)

## Files Created/Modified

- `tests/uat-49-g49-4-card-a11y-tab-order.js`（新建，945 行）— 真实渲染 + 真实键盘门禁：前置自检（E-PW / E-DATA-DB / E-DATA / E-BUBBLE-DB）、P1–P2 前提、R1–R6、证据 JSON（累积式 `runs[]`）、`electronApp.close()` + `process.exit()` 收尾（含自身子进程 `SIGKILL` 兜底，**无任何 pkill/pgrep**）
- `src/renderer.js` — `renderSkillContentBox(skillInvocation, { interactive = true } = {})`；三条 `setAttribute` 与 `keydown` 落在 `if (interactive)` 守卫内、`toggleCollapsed` 的 `aria-expanded` 同步同守卫；卡片调用点（原 `:9739`）传 `{ interactive: false }`，气泡调用点（原 `:9067`）逐字未动；JSDoc 写明四件事（含义与缺省 / 卡片必须传 false 及其原因 / 为什么不用 `display: none` / 气泡为何不受影响）
- `src/styles/main.css` — 只改 `.ai-skill-content-box-header:focus-visible` 上方注释（说明焦点环服务对象是气泡实例）；**声明投影 sha 与 HEAD 逐字相等**
- `tests/test-ai-skills.js` — 新增 `M9b`；`stripComments` 扩到剥**行尾注释**
- `docs/product/ai-skills.md` — §11.7 补「键盘语义只在气泡实例施加」；§七 / §11.8 的例数刷新到 178 并登记 M9b
- `AGENTS.md` — 测试行例数刷新 + 「本 run 新增/改写的测试面」登记 M9b
- `.planning/phases/49-manage-skill-ai/49-UI-SPEC.md` — `:427`/`:509` 两处补限（含「零可见高度」「顺序焦点导航」「语境开关」「卡片实例」四个新锚点与 `display: none` 排除理由）；`:508` 逐字未动
- `.planning/phases/49-manage-skill-ai/49-UI-REVIEW.md` — W6-01 段末追加 `Closed by` 行 + 评分表下追加「不回溯改写」修订行；**只加不删**（diff 4 行全为新增）

## Decisions Made

- **修法 C（语境开关）**，不把可达性上移到卡片头部：A′/A 都要推翻 `:508` 的锁定决策，且 A 的爆炸半径覆盖全部工具卡片；C 的代价（卡片仍无键盘展开入口）与 49 之前完全持平，是**非回归**的既存面。
- **R3 判据体收紧为「自身或后代」**（详见 Deviations 1）。计划原文接受祖先，实跑在未修复树上即判绿 —— 按计划自己的 R6 纪律改驱动。
- **R4 需要切换会话**：目标卡片（会话 `3dec0492`）里没有气泡实例，气泡实例在会话 `49659819`；R5 因此提到 R4 之前，卡片侧断言先做完再切走。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] R3 的命中测试判据在未修复树上判绿（假绿，属自毁形态）**
- **Found during:** Task 1 第 2 步（红轮）
- **Issue:** 计划给的判据是「中心点的 `elementFromPoint` 落回**它自身（或其祖先 / 后代）**」。实测：被 `overflow: hidden` + `max-height: 0` 裁掉的 header，其中心点真正命中的**正是承载裁切的祖先** `.ai-message.ai-message-ai` ⇒ 按原文判据 `hitIsSelfOrRelative = true` ⇒ **R3 在未修复树上就是绿**（首轮实测 R3 PASS、违反 0 站）。
- **Fix:** 收紧为 `hit === el || el.contains(hit)`（**只接受自身或后代，不接受祖先**），并把「命中到祖先」单独记为诊断字段 `hitIsAncestorOfEl`。判据仍**方向无关**（日后卡片头部真成为可聚焦入口时，命中是它自己 ⇒ 通过）。
- **Files modified:** `tests/uat-49-g49-4-card-a11y-tab-order.js`（**未动源码** —— 这正是计划 R6 规定的处置：红轮不红 ⇒ 修驱动）
- **Verification:** 收紧后红轮 R3 FAIL（卡片域内 2 站、违反 2 站，明细显示 `hitIsSelfOrDescendant=false` / `hitIsAncestorOfEl=true`），绿轮 R3 PASS（0 站）。
- **Committed in:** `d68d7d6` (Task 1)

**2. [Rule 3 - Blocking] R4 的气泡对照对象与目标卡片不在同一会话**
- **Found during:** Task 1 第 2 步（红轮）
- **Issue:** 计划假设目标会话里同时存在气泡实例（`.ai-skill-content-box-header` 不在 `.tool-card` 内）。实测该会话（`3dec0492`）只有 tool-card 内的实例；本仓 realm-dev 里「含 `manage_skill` 成功卡片」的会话与「含技能调用气泡（入库 `<skill name=…>` 行）」的会话**无交集** ⇒ R4 必然取到 `null` 而判红。
- **Fix:** 驱动增加 `E-BUBBLE-DB` 前置（按 `updated_at` 取气泡候选会话）+ R4 内**切换会话**取气泡实例；并把 R5（卡片侧）提到 R4 之前执行。
- **Files modified:** `tests/uat-49-g49-4-card-a11y-tab-order.js`
- **Verification:** 红轮 R4 即绿（气泡三属性在场 + 真实 Enter 切换成功），绿轮同样绿 —— 「防过度修复」的对照成立。
- **Committed in:** `d68d7d6` (Task 1)

**3. [Rule 1 - Bug] 计划自带的 `Closed by` 判据与计划原文标记不自洽**
- **Found during:** Task 3（copy-parity 门禁）
- **Issue:** 判据正则 `/Closed by:\s*49-08/`，而计划 `<action>` 要求的字面形态是 ``> **Closed by:** 49-08-PLAN.md`` —— `:` 后面紧跟 `**`，`\s*` 匹配不到 ⇒ 按原文写必然判红（计划文本与自身门禁冲突）。
- **Fix:** 标记写成 ``> **Closed by: 49-08-PLAN.md**（2026-09-14）``（`:` 后直接跟空格与 `49-08`），语义与原文一致。
- **Files modified:** `.planning/phases/49-manage-skill-ai/49-UI-REVIEW.md`
- **Verification:** copy-parity 绿。
- **Committed in:** `5403584` (Task 3)

**4. [Rule 3 - Blocking] 会话库 `tool_results` 落库的是**单个对象**而非数组**
- **Found during:** Task 1 第 0 步（前置自检）
- **Issue:** 会话库前置自检（`E-DATA-DB`）初次实现按「同一行内既有 manage_skill 调用又有成功结果」判定，且 `JSON.parse` 只认数组 —— 实测 `tool_calls` 与 `tool_results` 分属**不同消息行**、且后者是**单对象**，导致候选会话数恒为 0（驱动以 `E-DATA-DB` 硬退出，未误判为绿）。
- **Fix:** 改为**按会话聚合**并让解析器接受单对象。
- **Files modified:** `tests/uat-49-g49-4-card-a11y-tab-order.js`
- **Verification:** 候选会话 2 个（`6987b3d3` / `3dec0492`），定位到目标卡片。
- **Committed in:** `d68d7d6` (Task 1)

---

**Total deviations:** 4 auto-fixed（2 bug、2 blocking）。**未触发 Rule 4**（无架构级改动；未新增依赖；未改契约锁定决策）。
**Impact on plan:** 全部为「让门禁真的判得动」所必需。其中偏差 1 是本计划最重要的一处 —— 若不修，整个计划会在**未修复的树上**报绿。未扩大改动面：`src/` 只动了 `renderSkillContentBox` 与一处 CSS 注释，`renderToolCard` 的其余卡片、`.tool-card-content` 的 `max-height` 折叠机制与 200ms 过渡**均未触碰**。`I2-01` / `I6-01` 两条 INFO 如实留在未闭合清单。

### 范围外未提交的既存改动（如实披露）

工作树在执行前即存在与本次任务无关的改动：`.gitignore`（+`.tmp-exp/`）、未跟踪的 `.planning/milestone.lock` 与 `.planning/phases/47-bash/.review-diagnostics/`。按 scope boundary **未纳入**任何提交（保持原样）。`.planning/STATE.md` / `.planning/state.json` 的既有改动（编排器为本次插入 49-08 而写的 `status: executing` / `total_plans: 26`）与本次 state 更新是同一逻辑产物，故随元数据提交一并落盘。

## Issues Encountered

- **红轮首跑不红**：见 Deviations 1 —— 按计划 R6 的纪律先修驱动、再改源码，未发生「改源码凑门禁」。
- **红轮 `R6` 报绿但 `R3` 报绿被正确拦下**：驱动把「红轮 R3 必须为红」写成 `R6` 的失败条件（首跑输出 `⚠ 红轮 R3 竟为绿 —— 判据取错对象`），使自毁形态不会静默通过。
- **R4 首跑 `null`**：见 Deviations 2。
- **仪表读数与环境**：三轮驱动均只操作自己 `_electron.launch` 拉起的 `NODE_ENV=development`（`realm-dev` userData）子进程；收尾 `electronApp.close()` + `process.exit()`。全程**未使用**任何 `pkill` / `pgrep` 模式匹配；用户的正式版 `/Applications/Realm.app` 未被触碰。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `UI-49-W6-01` 已闭合；`49-UI-REVIEW.md` 的未闭合项只剩 INFO 级 `I2-01`（装饰 SVG 无 `aria-hidden`，全仓既存约定）与 `I6-01`（嵌套滚动的意图未写成声明），两者均**不在本计划范围**、也未顺手扩大改动面。
- Phase 49 的 8 个计划至此全部产出 SUMMARY；建议下一步 `/gsd-verify-work 49` 复验（本计划的 D3 交付物被标为 `human_judgment: true`，需要人读一遍口径文字）。
- 对 Phase 50 的提示：设置页技能管理区是同一族折叠控件的**第二个宿主**；若届时要把「卡片头部成为可聚焦入口」作为全仓范式升级推进，本计划留下的是**方向无关**的判据（`R3` 只判「卡片内不得有不可见的停靠点」），升级后该门禁仍应保持绿。

---

*Phase: 49-manage-skill-ai*
*Completed: 2026-09-14*

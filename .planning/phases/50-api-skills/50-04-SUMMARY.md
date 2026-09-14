---
phase: 50-api-skills
plan: 04
subsystem: ui
tags: [skills, settings-page, realm-csp, a11y, folding-block, single-source, inline-hint, csp, optimistic-update]

# Dependency graph
requires:
  - phase: 50-api-skills
    provides: '50-01 的只读三档分组列表（本计划在其上补交互面）、`getSkillsForManagement()` 投影的 `diagnostics` 字段、`STATUS_TEXT.disabled` 与 `pickStatusKey()` 单源状态链、Phase 50 CSS 专属段'
  - phase: 50-api-skills
    provides: '50-02 的两个 HTTP 写端点（`set-disabled` / `uninstall`）与 `{error, code}` 错误形状 + 第十码 `not_user_owned`；卸载响应**刻意不携带** `shadowNotice` 一类提示字段'
  - phase: 50-api-skills
    provides: '50-03 的请求体体积闸（`BODY_TOO_LARGE` 经 `code` 回传）—— 设置页的失败文案白名单据此把 413 与业务错误并列处理'
  - phase: 48-skill-name
    provides: '`.ai-skill-content-box` 折叠块家族（48/49 的既有类规则）与 `.slash-picker-tag-explicit`（本计划把它单源化后复用）'
provides:
  - 'src/skill-picker-model.js：EXPLICIT_TAG 冻结表（{label, title}，与 TIER_BADGE 同址/同导出面/同双层 freeze）'
  - 'src/renderer.js：面板行改为引用 EXPLICIT_TAG（渲染结果逐字不变）'
  - '设置页行内交互：启停开关（乐观翻转 + 在途态 + 失败回滚）、卸载按钮（仅 user 行）与 `.ai-modal-overlay` 二次确认弹框、inline hint（clearTimeout 前置 + 文本色调一并设置）'
  - '设置页诊断两层承载：行内徽标 + 无 header 的内联详情区；模块级 errors[] 的默认展开顶部汇总条'
  - 'setCollapsed(box, toggleEl, collapsed)：折叠态唯一赋值点（类 + 属性同点双写）'
  - '重渲染的位置保持：.settings-content.scrollTop 回写 + 按 data-skill-name 归还焦点'
  - 'SKILL_MANAGE_ERROR_TEXT 闭合白名单（前端只按 code 查表）+ SKILL_MANAGE_DIAG_LEVEL 级别白名单'
  - 'tests/test-skills-management.js：交互面 9 例 + 诊断两层 3 例（35 → 47）'
affects: [50-05, 51]

# Actuals (#2632) —— 与 PLAN 的 estimate 同尺度（chars/4 实测 diff），不是 harness token 计数
actuals:
  tokens: 16918
  tasks: 3
  commits: 3
plan_head_before: 5b9d105d6f766e64e86b435dbc14106baa0a0a2d

tech-stack:
  added: []
  patterns:
    - '折叠态的「类 + 属性双写、单一赋值点」：显隐踩 48 的既有类规则（不能改），chevron 以 aria-expanded 为准 ⇒ 只能靠单点赋值消漂移，而非新建第二套机制'
    - '乐观翻转的三段：立即写 UI → 请求 → 成功用**响应体投影**就地重渲染（零二次请求）/ 失败回滚 + code 查表'
    - 'realm:// guest 的弹框范式：外壳复用 `.ai-modal-overlay` + `.ai-modal`（既有），初始隐藏走 CSS 类、显隐走 CSSOM 具体值、markup 零内联 style'
    - '「重渲染必须还原滚动与焦点」：属性选择器换成遍历比对（技能名可含引号 ⇒ 不拼选择器）'
    - '门禁的 token / 计数判据一律「先词法级剥注释再判」（stripC 四态扫描 + 等长空白化），测试与门禁测量同一个量'

key-files:
  created: []
  modified:
    - src/skill-picker-model.js
    - src/renderer.js
    - src/settings-page.js
    - src/settings.html
    - src/styles/main.css
    - tests/test-skill-picker-model.js
    - tests/test-skills-management.js

key-decisions:
  - '「仅显式」提升为 single source 的三条既有断言**方向各不相同**，必须一并改：①② 由「面板函数体内字面量恰 1 次」改为「单源表值断言 + 面板引用形态断言」；③ 由「modelSrc 零命中」改为「表级值域隔离」（不在 STATUS_TEXT 的值集合里）—— 旧形态在新设计下字面不可满足'
  - '设置页删掉 50-01 留下的两个本地常量，改消费 `window.SkillPickerModel.EXPLICIT_TAG`（本阶段落地「零第二份拷贝」）'
  - '级别上色声明在**条目**上（`.skill-manage-diag-item-error { color }`）由级别标签**继承**，而不是像 UI-SPEC 的字面写法那样声明在标签选择器上 —— 两者视觉等价（`color` 可继承，且 message / code 各自显式声明次级色不会继承），但只有前者能满足计划自带 gate8 的 `\.skill-manage-diag-item-error\s*\{` 正则（见 Deviations #3）'
  - '诊断详情区**只取 shell + body、不取 header**；开关是行内徽标（避免「一个区域两个控件、两份状态」）'
  - '汇总条相反：**完整家族（含 header）且默认展开** —— 模块级错误是异常状态（「禁止静默失败」），且这里没有行内徽标可借用'
  - 'chevron 的状态源按宿主区分：行内徽标是**本页新类** ⇒ 以 `aria-expanded` 为唯一状态源；汇总条踩在 48 的既有类规则上 ⇒ 类 + 属性双写、靠 `setCollapsed` 单点消漂移'
  - '`setCollapsed` 的三条断言归**创建它的任务**（50-04-T3）持有 —— 计划已在 W1 修订里完整移交（T2 的 gate#3 12 项 → 11 项、T3 的 gate#5 19 项 → 20 项，两侧互为镜像）'
  - '卸载的条件追加行判定 = 投影数据的**纯查找**（`tier !== ''user'' && shadowed === true && shadowedBy === name`），查找不到即不渲染；50-02 已裁决响应体不回传提示字段'
  - '焦点归还用**遍历比对**而非属性选择器：技能名可含引号 / 反斜杠，拼选择器既是转义负担又是不必要的拼装面（TD-48-01 未修时的纪律）'
  - '设置页新增代码全部包在既有 region 标记之间；本区**不调用** `showToast`（D-06 锁定 inline hint）'
  - 'T2 的样式门禁选择器清单不含 `.skill-manage-diag-badge`（由 T3 交付、T3 门禁覆盖）—— 计划 W-b 修订已说明'

patterns-established:
  - '写操作后的同步链：响应体即最新投影 ⇒ 就地重渲染 + 位置保持 + hint 反馈，设置页**收不到**主进程广播（这是它唯一的同步机制）'
  - '新增 a11y 契约以**写形态**落码（`setAttribute(''role'',''button'')`），门禁与测试都判写形态而非属性名子串 —— 后者会被一条注释假绿'
  - '同一不变式由「计划自带源码判据」+「新套件的行为/结构判据」两条独立证据链承担；计划判据一字不放宽'

requirements-completed: [USER-01, USER-02, USER-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: '「仅显式」label/title 单源化：EXPLICIT_TAG 冻结表挂进双模式导出面，面板侧改引用（渲染结果逐字不变），三条既有断言按各自动向改写'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skill-picker-model.js#「仅显式」标记只由 disableModelInvocation 决定，文案经单源表跨进程共用（115/115）'
        status: pass
      - kind: unit
        ref: 'node --test tests/test-skill-picker-model.js （单源表值断言 + 面板引用形态断言 + 表级值域隔离；既有的 TIER_BADGE 三键值断言与 MANAGE_SKILL_SHORT_REASON 九键断言保持绿）'
        status: pass
      - kind: other
        ref: '.planning/phases/50-api-skills/50-04-PLAN.md 的 T1 门禁 2（「仅显式」单源化扫描，含剥注释后的面板段判定）'
        status: pass
    human_judgment: false
  - id: D2
    description: '行内交互的**代码面**：启停开关四态（乐观翻转 / 在途 disabled / 成功用响应体投影重渲染 / 失败回滚）、卸载按钮仅 user 行 + 二次确认弹框（确认中保持打开 / 失败关闭且不改行内状态 / not_found 额外重拉）、inline hint 的 clearTimeout 前置与文本色调一并设置、失败文案按 code 查表、重渲染的滚动与焦点还原'
    requirement: USER-02
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#设置页交互面：注入纪律 / hint 复位 / 失败文案 / 危险按钮 / 位置保持（9 例）'
        status: pass
      - kind: other
        ref: '50-04-T2 门禁 3/4（交互样式段扫描 + 设置页交互面扫描，含 11 条单点变异）'
        status: pass
    human_judgment: false
  - id: D3
    description: '诊断两层承载的**代码面**：行内徽标（aria-expanded / aria-controls / 无底色）+ 无 header 的内联详情区（默认折叠）、模块级 errors[] 的完整家族默认展开汇总条、setCollapsed 单点双写、level 闭合白名单、path 不上屏、两层条件独立'
    requirement: USER-01
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#诊断两层承载：跨文件折叠契约 / 折叠态单点写入 / 两层条件独立（3 例）'
        status: pass
      - kind: other
        ref: '50-04-T3 门禁 6/8（诊断两层承载扫描 + 诊断样式扫描，含 7 条单点变异）'
        status: pass
    human_judgment: false
  - id: D4
    description: 'CSS：专属段新增操作区 / 危险按钮文字色 / 弹框内层 / 诊断徽标与条目 / 级别三档上色，以及三条作用域收敛覆盖（开关焦点环、「仅显式」色、折叠块 header hover）；两条硬禁令（行无 hover 底、行首行无 flex-wrap）与「零 btn-danger」「颜色全 var」维持'
    requirement: USER-06
    verification:
      - kind: unit
        ref: 'tests/test-skills-management.js#样式硬禁令（选择器级扫描）+ 门禁 3/8'
        status: pass
    human_judgment: false
  - id: D5
    description: '**真实 `realm://settings` 页面**下的交互与视觉观感：乐观翻转的即时感、弹框初次打开时的居中与内层间距、Esc / 遮罩点击 / 焦点归还的手感、开关后滚动位置与焦点是否真的不跳、诊断徽标展开时 chevron 的旋转与详情区显现、汇模块级总条的默认展开、最小窗口（800px）下行首行是否仍单行不换行'
    verification: []
    human_judgment: true
    rationale: '纯 Node 无 DOM（设置页是 `realm://` guest，且本仓无 HTTP 端点 / 浏览器端测试基建）⇒ 本计划只能把**代码路径与 a11y 契约**钉死，无法证明真实渲染结果。行首行单行不变式本身是 UI-SPEC 的 `resolved (backstop)` 行，无显式证据时必须路由 human；其余观感项按 50-VALIDATION 的 Manual-Only 表交 UAT'
  - id: D6
    description: '「一次操作只影响一行」的**运行期**保证：连续快速操作时 hint 不被陈旧复位清掉、失败不改变列表、在途态只作用于被点的那一行（其他行开关仍可点）'
    verification: []
    human_judgment: true
    rationale: '计时器竞态与「其他行仍可点」都发生在真实事件循环里（纯 Node 下 `setTimeout` 断言属假绿陷阱 —— 计划明文禁止按定时器断言）；本计划只能断言 clearTimeout 的顺序与单点写入结构，行为面交给真实页面'

duration: 21 min
completed: 2026-09-14
status: complete
---

# Phase 50 Plan 04: 设置页技能管理区交互面（启停 / 卸载 / 诊断两层承载）Summary

**行内启停开关（乐观翻转 + 失败回滚）与卸载二次确认弹框（`realm://` div 遮罩范式）；诊断的两层承载 —— 行内 `诊断 N` 徽标控制无 header 的内联详情区、模块级 `errors[]` 走默认展开的顶部汇总条；折叠态收敛到 `setCollapsed` 单点双写；「仅显式」提升为跨进程单源并一并改写三条既有断言**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-14T14:11:12Z
- **Completed:** 2026-09-14T14:31:59Z
- **Tasks:** 3 / 3
- **Files modified:** 7（无新增文件）
- **Diff:** +1100 / −31（`git diff 5b9d105..448b64b`）

## Accomplishments

- **设置页从「只读列表」变成「完整可操作面」**：每行有启停开关（所有行）与卸载按钮（仅 `tier === 'user'`）；启停是**乐观翻转**（立即写 `.on` / `aria-checked` + 置 `disabled`，不做二次确认），成功后用**响应体回传的最新投影**就地重渲染 —— **零二次请求**，失败则回滚两个状态、解除在途、按 `code` 查表给 danger hint，**列表不因失败改变**。
- **卸载走 `realm://` 的既有豁免范式**：`.ai-modal-overlay` + `.ai-modal`（既有类，零新遮罩实现），初始隐藏走 CSS 类、显隐走 CSSOM 具体值、markup 零内联 style（新区块内 `style=` 零命中）。确认中按钮置灰且弹框保持打开；失败关闭弹框 + hint，不改行内任何状态（`not_found` 额外重拉让该行自然消失）；条件追加行是投影数据的**纯查找**（`shadowedBy === name`），查不到即不渲染。
- **诊断的两层承载各自独立落地**：`errors[]`（无归属技能的模块级容器）→ 顶部汇总条（完整家族含 header、默认展开、`role="button"` + `tabindex="0"` + Enter/Space `preventDefault`）；`diagnostics[]`（每技能）→ 行内 `诊断 N` 徽标（无底色、`aria-expanded` + `aria-controls`）控制一个**没有 header** 的内联详情区。两层条件是两个独立判断，未合并。
- **折叠态收敛到一个赋值点**：`setCollapsed(box, toggleEl, collapsed)` 同时写 `.collapsed` 与 `aria-expanded`；region 内 `classList.toggle('collapsed'` 与 `setAttribute('aria-expanded'` **各恰出现一次**。chevron 的状态源按宿主区分（新类以属性为准；踩既有类规则的汇总条类 + 属性双写），并把「为什么不能统一成属性驱动」写进注释（改类本体即改动 48/49 两个实名宿主）。
- **「一次操作只影响一行」落到代码**：重渲染前后记录并回写 `.settings-content.scrollTop`，按 `data-skill-name` **遍历比对**（不拼属性选择器）把焦点归还到同一技能行的开关；找不到则不移动。
- **「仅显式」成为跨进程单源，且三条既有断言按各自动向一并改写**：③ 从「`modelSrc` 零命中」改为「表级值域隔离」（旧形态在新设计下**字面不可满足**，留着会让测试永久红）；面板渲染结果逐字不变由**值断言**锁住。
- **计划自带门禁的可失败性被逐条实测**：8 条门禁全部实跑；本轮共做 **21 次单点变异**（含 3 次正向控制），全部按预期转红 / 不转红，且全部已还原、还原后门禁与套件复跑为绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: 「仅显式」单源提升 + 面板改引用 + 三条断言改写** - `9cc1d8a` (feat)
2. **Task 2: 行内交互（启停 / 卸载 + 确认弹框 + inline hint）** - `29a01d1` (feat)
3. **Task 3: 诊断两层承载（行内徽标 + 详情区 / 模块级汇总条）** - `448b64b` (feat)

**Plan metadata:** （本提交，docs: complete plan）

## Files Created/Modified

- `src/skill-picker-model.js` — 新增 `EXPLICIT_TAG` 冻结表（`{label, title}`，与 `TIER_BADGE` 同址 / 同导出面 / 同双层 `Object.freeze`）并挂进 `api`
- `src/renderer.js` — 面板行的 `explicitTag` 改为引用 `window.SkillPickerModel.EXPLICIT_TAG`（拼接机制未改，仅换字符串来源）
- `src/settings-page.js` — region（+628/−31 行的主体）：`SKILL_MANAGE_ERROR_TEXT` 闭合白名单、`SKILL_MANAGE_DIAG_LEVEL`、三个模块级状态（`skillManageHintTimer` / `skillManageProjection` / `skillManageUninstallTarget` / `skillManageDiagSeq`）；`setSkillManageHint` / `resetSkillManageHint` / `skillManageErrorText` / `createSkillSwitch` / `toggleSkillDisabled` / `createSkillUninstallButton` / `skillHasShadowedTwin` / `openSkillUninstallConfirm` / `closeSkillUninstallConfirm` / `confirmSkillUninstall` / `setCollapsed` / `buildSkillManageDiagBadge` / `buildSkillManageDiagItem` / `buildSkillManageDiagBox` / `renderSkillManageSummary`；`renderSkillManagement` 加位置保持与 `errors` 接线、空态渲染改吃整个投影
- `src/settings.html` — `#skillManageSummary` 容器（默认无类无内容 ⇒ 零高度）+ 卸载确认弹框（`.ai-modal-overlay` + `.ai-modal.skill-manage-confirm`）
- `src/styles/main.css` — 专属段 +128 行：操作区 / 开关在途态 / 危险按钮文字色 / 弹框内层 / 诊断徽标与 chevron / 诊断条目与三档级别 / 三条作用域收敛覆盖
- `tests/test-skill-picker-model.js` — 三条断言按新方向改写（值断言 / 引用形态 / 表级值域隔离）
- `tests/test-skills-management.js` — 新增 `stripCodeComments` / `skillManageRegion` 助手 + 两个 describe 共 12 例（35 → 47）

## Decisions Made

见 frontmatter 的 `key-decisions`（逐条含理由）。要点复述：

- **`EXPLICIT_TAG` 用「值断言 + 引用形态」而**不是**计数**：面板改引用后字面量计数必然为 0，继续计数就是永久红。
- **级别上色声明在条目上、由标签继承**：与 UI-SPEC 的字面写法视觉等价（`color` 可继承；message / code 各自声明次级色故不会继承），但只有这一形态能满足计划自带 gate8 的正则（详见 Deviations #3）。
- **`setCollapsed` 的断言由创建它的 T3 持有**（计划 W1 修订已机械取证：两侧门禁的失败项清单互为镜像）。
- **卸载按钮的「不渲染」只是 UX**：服务端拒绝由 50-02 的 manager 判据承担，前端不用「按钮存在与否」反推服务端会不会拒绝。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 计划自带 `<automated>` 命令内含 HTML 实体转义，逐字执行会语法错误**

- **Found during:** 开工前的门禁预跑（8 条门禁提取阶段）
- **Issue:** 计划文本里的 8 条门禁含 5 处 `&gt;` / 3 处 `&lt;`（集中在 `=>`、`>`、`<` 的位置，如 `const stripC=(x)=&gt;{…}`、`if(danger&gt;0)`、`if(ci&lt;0||si&lt;0||ci&gt;si)`）。逐字执行 `node -e '…'` 会得到 `SyntaxError`，**不是**「门禁判红」而是一个无法区分「实现不合规」与「命令本身坏了」的失败态。
- **Fix:** 提取时做一次实体反转义（`&gt;`→`>`、`&lt;`→`<`、`&amp;`→`&`），把 8 条门禁落到 `/tmp/realm-50-04/gates/*.sh` 后按原样执行。**判据本身一字未改**（未放宽、未替换任何断言）。已实测：反转义后 8 条门禁在现状树上跑出「新代码尚未落地」类失败项（不是语法错误）。
- **Files modified:** 无（仅执行侧的处理）
- **Verification:** 8 条门禁在现状树 → 全部为「缺 X」类可读失败；落地后 → 8 条全绿（见 Verification Evidence）
- **Committed in:** n/a（不涉源码）

**2. [Rule 2 - Missing Critical] 计划 T3 门禁的「两层独立」判据是**存在性**判据，可被合并条件假绿**

- **Found during:** Task 3 的单点变异（TM1）
- **Issue:** gate6 只断言 region 内**同时出现** `errors.length > 0` 与 `diagnostics.length > 0` 两个子串。实测：把两个条件写成一处（`renderSkillManageSummary(errors.length > 0 || diagnosticsTotal > 0 ? errors : [])`）⇒ 门禁**仍绿**（两个子串都还在），而「两层各自独立」这条契约已被破坏。
- **Fix:** 在 `tests/test-skills-management.js` 的「两层独立」用例里**另起一条结构判据**：取两处条件各自 ±120 字符的邻域，断言 `errors.length > 0` 的邻域内**不得出现** `diagnostic`（忽略大小写）、`diagnostics.length > 0` 的邻域内**不得出现** `errors`。**计划自带判据一字未改**（未放宽、未替换）—— 两条独立证据链并存。
- **Files modified:** `tests/test-skills-management.js`
- **Verification:** 变异实跑 —— 合并条件 ⇒ **新判据转红**（`# fail 1`）、计划门禁仍绿；合规树 ⇒ `# pass 47 / # fail 0`。另做一次「变量名写 `diagCount`（不含 `diagnostic` 字样）」的变异，新判据**不**转红 —— 如实记录为该方法论的边界（见下方「已披露的判据边界」）。
- **Committed in:** `448b64b` (Task 3 commit)

**3. [Rule 1 - Bug] UI-SPEC 的级别上色字面写法与计划自带 gate8 正则**不相容

- **Found during:** Task 3 落地级上色前的门禁复跑
- **Issue:** UI-SPEC「新增 CSS 声明清单」给的字面写法是
  `.skill-manage-diag-item-error .skill-manage-diag-level { color: var(--skill-error-text); }`，
  而 gate8 的判据是 `\.skill-manage-diag-item-error\s*\{[^}]*var\(--skill-error-text\)` —— 要求 `{` **紧跟**类名。按 UI-SPEC 字面落地 ⇒ 门禁必然报「缺错误级上色」（**合规实现也修不掉**，与 `.skill-manage-diag-badge` / `setCollapsed` 同族的「判据对象错位」形态）。
- **Fix:** 把颜色声明在**条目**上（`.skill-manage-diag-item-error { color: var(--skill-error-text); }` 等三条），由级别标签**继承**；同时给 `.skill-manage-diag-message` / `.skill-manage-diag-code` 显式声明 `--text-secondary` 以保证它们**不**继承级别色。视觉结果与 UI-SPEC 完全一致（级别标签三档上色、message / code 次级色），门禁与 UI-SPEC 的**意图**同时满足；**未放宽任何判据**。
- **Files modified:** `src/styles/main.css`
- **Verification:** gate8 绿（`诊断样式 ok`）；变异「把 `.skill-manage-diag-item-error` 规则块里的 `var(--skill-error-text)` 换成别的」⇒ 转红（同族判据可失败性见 TM2/TM3）
- **Committed in:** `448b64b` (Task 3 commit)

### 已披露的判据边界（不是缺陷，是源码扫描方法的本体上限）

1. **语义中和型变异无法被源码扫描捕获**：`if (toggleEl && false) toggleEl.setAttribute('aria-expanded', …)` 保留了 token，gate6 与新套件都**不**转红；只有**真正删除该行**才转红（实测：门禁报「setCollapsed 未写 aria-expanded」+ 套件 `# fail 2`）。这类「写得像但恒不执行」的形态需要运行期证据（见 coverage D5/D6），本计划不声称覆盖。
2. **结构独立判据依赖命名近似**：Deviation #2 的结构判据在「合并用的变量名不含 `diagnostic` 字样」时不触发（实测 `diagCount` 形态）。它把缺口从「任意合并」收窄到「必须刻意起一个不含 diagnostic 的名字」，但不等价于语法级数据流分析。

## Verification Evidence

### 计划自带门禁（8 条 `<automated>`）—— 全部实跑

| 门禁 | 结果 | 输出（末行） |
|---|---|---|
| T1-G1 `node --test tests/test-skill-picker-model.js \| grep -E "^# (tests\|pass\|fail)"` | **PASS** | `# tests 115 / # pass 115 / # fail 0` |
| T1-G2 「仅显式」单源化扫描 | **PASS** | `「仅显式」单源化 ok（单源表逐字 + 面板改引用 + 第三条断言改为表级值域隔离）` |
| T2-G1 交互样式段扫描 | **PASS** | `交互样式段 ok（新增规则齐备 + 三条作用域收敛 + 两条硬禁令 + 零 btn-danger + 颜色全 var）` |
| T2-G2 设置页交互面扫描 | **PASS** | `设置页交互面 ok（DOM 构建 / inline hint 复位纪律 / 折叠单点双写 / code 白名单 / 零 btn-danger）` |
| T2-G3 `node tests/test-skills-management.js` | **PASS** | `# tests 47 / # pass 47 / # fail 0` |
| T3-G1 诊断两层承载扫描 | **PASS** | `诊断两层承载 ok（跨文件折叠契约一致 + 两层条件独立 + path 不上屏）` |
| T3-G2 `node tests/test-skills-management.js` | **PASS** | `# tests 47 / # pass 47 / # fail 0` |
| T3-G3 诊断样式扫描 | **PASS** | `诊断样式 ok（徽标无底色 + chevron 属性驱动 + 三档级别上色 + 未改既有宿主）` |

**落地前的负方向实跑（如实披露，不得整段声称已预跑）**：8 条门禁在开工时对本树都跑过，失败项**全部**是「新代码尚未落地」类 —— T1-G2：缺单源表 / 第三条断言仍是旧形态；T2-G1：缺 6 个新增选择器 + 三条作用域收敛 + 两条硬禁令；T2-G2：缺单动词卸载文案 / 缺 clearTimeout / 缺 `setSkillManageHint` / 缺四个 code；T3-G1：设置页未复用 6 个折叠类 + 缺三个 aria 写入形态 + 折叠赋值函数 0 处 + 缺空态 A 判据 + 缺 preventDefault + 缺两层非空条件 + 缺汇总条容器与标题；T3-G3：缺徽标 `1px 4px` / chevron 未以属性为状态源 / 缺两级上色。**没有**「合规实现也修不掉」的断言 —— 唯一的例外是 **T3-G3 的级别上色**（见 Deviations #3，已按「同时满足门禁与 UI-SPEC 意图」的方式调和）。

**计划文本自带的 `&gt;` / `&lt;` 实体转义**是执行侧唯一的前置阻塞（Deviations #1），已在提取阶段完成反转义。

### 单点变异矩阵（本轮共 21 次，全部实跑 / 串行 / 已还原）

**Task 1（4 次）**

| # | 变异 | 期望 | 实测 |
|---|------|------|------|
| T1-M1 | 面板侧写回内联 `仅显式` 字面量（仍保留常量引用） | 红 | `renderer 面板侧仍写着「仅显式」字面量` ✅ |
| T1-M2 | 面板侧插一条**注释**提到该字面量（正向控制） | 绿 | `「仅显式」单源化 ok` ✅ |
| T1-M3 | 第三条断言改回 `modelSrc.includes('仅显式')` 旧形态 | 红 | `第三条断言仍是「文件级零命中」形态` ✅ |
| T1-M4 | 把 `EXPLICIT_TAG` 从 `api` 对象摘掉 | 红 | `单源表未挂进 api 对象（双模式导出面）` ✅ |

**Task 2（11 次）**

| # | 变异 | 期望 | 实测 |
|---|------|------|------|
| T2-M1 | 删掉 `.skill-manage-section .slash-picker-tag-explicit` 作用域收敛覆盖 | 红（gate3） | 命中 ✅ |
| T2-M2 | 另起 `.skill-manage-row { background: var(--bg-hover) }` | 红（gate3 + 套件） | 命中 + `# fail 1` ✅ |
| T2-M3 | 把 `clearTimeout` 挪到 `setTimeout` 之后 | 红（gate4 + 套件） | `clearTimeout 未早于 setTimeout` + `# fail 1` ✅ |
| T2-M4 | 从白名单删掉 `BODY_TOO_LARGE` | 红（gate4 + 套件） | `失败文案白名单缺 BODY_TOO_LARGE` + `# fail 1` ✅ |
| T2-M5 | 在本段写 `color: #fff;` | 红（gate3） | `Phase 50 段出现硬编码颜色值： #fff` ✅ |
| T2-M6 | 在 region / CSS 段插**注释**逐一提到所有禁令 token（正向控制） | 绿 | 两门禁 ok + `47/0` ✅ |
| T2-M7 | region 内真调 `showToast(` | 红（gate4 + 套件） | `region 内调用了 showToast` + `# fail 1` ✅ |
| T2-M8 | 危险按钮改用 `.btn-danger` | 红（gate4 + 套件） | `region 内使用 .btn-danger` + `# fail 1` ✅ |
| T2-M9 | `clearNode` 改用 `innerHTML` | 红（gate4 + 套件） | `region 内出现 innerHTML/insertAdjacentHTML` + `# fail 1` ✅ |
| T2-M10 | 把乐观翻转挪到请求**之后** | 红（套件；gate4 绿 —— 顺序不变式由套件独任） | `# fail 1` ✅ |
| T2-M11 | 弹框 overlay 上加 markup 内联 `style="display:none"` | 红（套件） | `# fail 1` ✅ |

**Task 3（6 次）**

| # | 变异 | 期望 | 实测 |
|---|------|------|------|
| T3-M1 | 把 `errors.length > 0` 与 diagnostics 合并成一个条件 | 红（**新判据**；计划门禁绿） | 新判据 `# fail 1`，计划门禁 ok ✅ |
| T3-M2 | 给 `.skill-manage-diag-badge` 加 `background` | 红（gate8） | `诊断徽标声明了底色` ✅ |
| T3-M3 | chevron 旋转改由类名驱动（弃 `aria-expanded`） | 红（gate8） | `chevron 未以 aria-expanded 为状态源` ✅ |
| T3-M4 | 把 aria 契约只写进注释、去掉 `setAttribute('role'/'tabindex')` | 红（gate6 + 套件） | 两条「缺真实写入形态」 + `# fail 1` ✅ |
| T3-M5a | **真正删掉** `setCollapsed` 体内任一写入行（各测一次） | 红（gate6 + 套件） | `setCollapsed 未写 aria-expanded` / `未写 collapsed 类` + `# fail 2` ✅ |
| T3-M5b | 另起一个**只写类**的第二处赋值函数 | 红（套件） | `# fail 1` ✅ |
| T3-M6 | 在 region 插**注释**提到 `diag.path` / 两层条件 / 三个 aria 属性 / 单点双写（正向控制） | 绿 | gate6 / gate8 ok + `47/0` ✅ |

### 回归面

| 套件 | 跑法 | 结果 |
|------|------|------|
| `tests/test-skills-management.js` | `node` | **47 / 47**（35 → 47） |
| `tests/test-skill-picker-model.js` | `node --test` | **115 / 115** |
| `tests/test-skills-http-api.js` | `node` | **32 / 32** |
| `tests/test-manage-skill.js` | `node` | **55 / 55** |
| `tests/test-ai-skills.js` | `node` | **187 / 187** |
| `tests/test-agent-workspace.js` | `node` | **21 / 21** |

`node --check`：`src/skill-picker-model.js` / `src/renderer.js` / `src/settings-page.js` / `tests/test-skill-picker-model.js` / `tests/test-skills-management.js` 全部 exit 0。

## Issues Encountered

- **测试文件里一条 JSDoc 意外含 `*/` 序列把块注释提前闭合**：注释里写的 `` `/\/\*/` `` 内含 `*` 紧跟 `/` 的字符对，块注释在该处终止 ⇒ 后续文本变成代码、再由一个反引号开启模板字面量把余下内容吞掉。`node --check` 报的行号（`:154`）是**症状**不是病灶（lexer 放弃的位置在很后面），排查方式是从「报错行」向前做前缀二分。已改写该注释避开 `*/` 序列。教训与 `feedback_plan_authored_gates` 同族：**在注释里逐字复写被扫描的 token 会让注释本身成为陷阱**。
- **`counts-parity` 本波仍为红（预期，由 50-05 收口）**：本计划把 `tests/test-skills-management.js` 从 35 例扩到 47 例、`tests/test-skill-picker-model.js` 例数不变（115），四处账本（`docs/product/ai-skills.md` §七 `:98/:99`、§11.8 `:538-540`、`AGENTS.md:330`、`50-VALIDATION.md` 的命令副本）仍持旧值。按计划**不在本计划内改账本**（会与后续波次再次漂移），由 Wave 4 的 50-05 一次收口。⚠️ 判据单元为 **8** 而套件已 **6** 个（含本波新增的两处账本单元需求）—— 该判据用 `if (cells < 8)`，**漏加新套件账本单元不会自动报错**，50-05 必须主动扩并把基线提高。
- **`REQUIREMENTS.md` 本轮未勾选任何 ID**：`requirements.ready-ids` 对 `[USER-01, USER-02, USER-06]` 判定 —— `USER-01` / `USER-02` 的另一声明者（50-05）尚未产出 SUMMARY，被共享 ID 门禁（#2388）**故意**挡住；`USER-06` 的另一声明者（50-02）已完成，故 `USER-06` 就绪。这是正确行为，不是遗漏。
- **UI-SPEC 的级别上色字面写法与计划门禁不相容**（Deviation #3）：这是本计划遇到的第二类「判据对象错位」，与计划自己在 W-b / W1 修订里处置的 `.skill-manage-diag-badge` / `setCollapsed` 同族。**已按「同时满足门禁与 UI-SPEC 意图」调和**，未放宽任何判据。

## Known Stubs

None —— 本计划无硬编码空值 / 占位文案流入 UI。三处此前**刻意延后**的项已全部闭合：`#skillManageHint` 有了写入者（启停 / 卸载的成功与失败）、「仅显式」提升为单源、诊断两层承载可见。`#skillManageSummary` 容器在 markup 里是**空且无外观类**的（零高度、不占位），有 `errors` 时由渲染端补上 `.ai-skill-content-box.skill-manage-summary` 并填充 —— 这是「0 条时整条不渲染」的实现形态，不是 stub。

## Threat Flags

None —— 未引入计划 `<threat_model>` 之外的信任边界。逐条对应：**T-50-24**（属性上下文注入）由 region 内 `innerHTML` / `insertAdjacentHTML` 零命中（门禁 + 新套件的负向/正向成对判据）+ 全部插值走 `textContent` / `el.title` / `setAttribute` 承担，且**未**声称修好 `TD-48-01`；**T-50-25**（CSP 绕过）由弹框初始隐藏走 CSS 类、显隐走 CSSOM + 新套件对弹框块内 `style=` 零命中的正向窗口断言承担；**T-50-26**（陈旧复位定时器）由 `clearTimeout` 前置（门禁按「位置早于」判 + 套件同判）承担；**T-50-27**（折叠控件漂移）由 `setCollapsed` 恰 1 处定义 + 体内双写 + 两 token 各恰 1 次 + 跨文件类名/aria 契约（带正命题）承担；**T-50-28**（失败文案失实）由 `not_found` / `not_user_owned` 两条独立文案 + 表外兜底 + 文本色调一并设置承担；**T-50-29**（`path` 上屏）由渲染路径只取 `level` / `message` / `code` + 负向扫描承担；**T-50-30**（危险按钮对比度）由 region 与 CSS 段双双零 `btn-danger` 承担；**T-50-31**（重渲染重置滚动/焦点）由 `scrollTop` 回写 + `data-skill-name` 遍历比对归还焦点承担；**T-50-SC**：`package.json` 零 diff（零新增依赖）。

## Next Phase Readiness

- **50-05 需要收口的三件事**：① 四处账本的例数（实测：`test-manage-skill.js` 55 / `test-ai-skills.js` 187 / `test-skill-picker-model.js` 115 / `test-skills-management.js` **47** / `test-skills-http-api.js` 32）并把 `cells` 基线从 8 提高；② `50-VALIDATION.md` 的 Per-Task Verification Map 里本计划三行可回填；③ 本计划新增的 `EXPLICIT_TAG` 与设置页交互面（启停 / 卸载 / 诊断两层）需要在 `docs/product/ai-skills.md` 的「发现与调用」章节补一段设置页面的权威说明（AGENTS.md 的维护约定要求「把技能暴露给用户的入口」文档与实现同步）。
- **Phase 51 可直接复用**：① 折叠块的第三处宿主形态已定稿（无 header 的详情区 + 完整家族的汇总条，共用 `setCollapsed`）—— 新增折叠面时复用同一族并提供**自己的开关元素**；② 失败文案白名单表在 `src/settings-page.js`，出现第二个消费者即须提升到 `src/skill-picker-model.js`（表旁注释已写明）；③ 导入功能的体积上限用 `readJsonBody(req, res, { maxBytes })` 一处声明即可（50-03 已把「默认 fail-closed + 需大者显式放大」定形）。
- **人工面（不进本计划，按 50-VALIDATION 的 Manual-Only 表交 UAT）**：乐观翻转的即时感、弹框居中与内层间距、Esc / 遮罩 / 焦点归还手感、开关后滚动与焦点是否真的不跳、诊断展开时 chevron 旋转与详情区显现、汇总条默认展开、800px 最小窗口下行首行是否仍单行不换行（E5 backstop）、100 条技能时的滚动与密度。coverage 的 D5 / D6 已按 `human_judgment: true` 登记，**不**声称已验证。
- **无阻塞**。计划 8 条门禁全绿、21 次单点变异全部按预期（含 3 次正向控制）、6 个套件回归全绿、5 个 `node --check` 全绿。

---

*Phase: 50-api-skills*
*Completed: 2026-09-14*

## Self-Check: PASSED

- key-files.created：本计划**无新增文件**（`created: []`，属实际 —— 全部 7 个文件都是既有文件）
- 三个任务提交存在：`9cc1d8a` / `29a01d1` / `448b64b` ✅ FOUND（`git log --oneline`）
- `commits: 3` 与 `plan_head_before: 5b9d105…` 由台账实测（`git rev-list --count 5b9d105..HEAD` = **3**），非叙述值 ✅
- 计划 8 条门禁全部实跑：均为 PASS（输出见「Verification Evidence」）✅
- 计划级 `<acceptance_criteria>` 复核：
  - T1：「仅显式」的 label 与 title 各只存在于 `src/skill-picker-model.js` 一处（面板段剥注释后零命中该字面量、且引用单源常量）；三条断言按新方向改写且逐条实跑；门禁对「旧形态」的识别判据**生效**（现状树命中 → 改成表级值断言后不再命中）；`STATUS_TEXT` 四键值冻结与 `MANAGE_SKILL_SHORT_REASON` 九键断言保持绿 ✅
  - T2：两条扫描输出 ok 行；**四次单点变异 + 一次颜色变异**全部实跑转红（另加 T2-M6 正向控制不误报、T2-M7~M11 真实代码变异转红）；启停四态与卸载三条路径都有对应代码；弹框用 `.ai-modal-overlay` + `.ai-modal` 且 markup 内联 `style` 零命中；hint 的 `clearTimeout` 早于 `setTimeout`；卸载按钮是单动词 `卸载`；`builtin` / `managed` 行不渲染该按钮 ✅
  - T3：三条扫描输出 ok 行；**五次变异**全部实跑（合并条件 → 新判据红、徽标加底色 → 红、chevron 改类驱动 → 红、aria 只写注释 → 红、拆开 `setCollapsed` / 删体内任一写入 → 红）；详情区**无 header** 且默认折叠、汇总条**完整家族**且默认展开；`path` 不上屏、`level` 表外不渲染标签；折叠由 `setCollapsed` 单点双写（恰 1 处定义 + 体内双写）；三条扫描的负向 token 判据一律先剥注释；跨文件折叠契约带正命题 ✅
- 计划要求的单点变异全部实跑（21 次，含 3 次正向控制），全部已还原且还原后门禁 / 套件复跑为绿 ✅
- 变异「在注释里逐一复写被扫描 token」不误报（T1-M2 / T2-M6 / T3-M6 三次正向控制）✅
- 两处方法论边界已如实披露（语义中和型变异、结构判据的命名近似），**未**声称覆盖 ✅

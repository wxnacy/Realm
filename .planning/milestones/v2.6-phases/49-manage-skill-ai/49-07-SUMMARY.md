---
phase: 49-manage-skill-ai
plan: 07
subsystem: ui
tags: [manage_skill, tool-card, width-budget, playwright-electron, real-render-gate, single-source-projection, css-decl-freeze]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: 49-02 的 manage_skill 卡片变体（头部三元素 + 至多一条内联标注）与 49-04/49-05 的终态元数据通道（含三态 promptIncluded 与失败态原因码词缀）
provides:
  - 卡片头部超预算标注的**单源 ≤ 4 字投影** `PROMPT_OMITTED_CARD_NOTE`（由 `STATUS_TEXT.promptOmitted` 第二段机械派生）
  - **真实渲染回归门禁** `tests/uat-49-g49-3-panel-layout.js`（A1–A9 + 红→绿两轮证据 + 全轮 CSS 声明投影 sha + E-PW/E-KEY/E-DATA 前置自检）
  - 280px 面板下的**宽度预算算术**（实测值与字体度量估算分开标注）
  - `49-UI-SPEC.md` 的 E1 overflow 收口记录节 + 「凡提到未进提示词必须标明所属表面」的契约纪律
affects: [50-settings-skills-ui, 51-skill-import, ui-review]

# Actuals (#2632) — pairs with the plan's `estimate` on the same scale (#3968: commits is MEASURED)
actuals:
  tokens: 19247
  tasks: 3
  commits: 3
  plan_head_before: 2c29991098c5a00f61c1368667eb3645a902d84d

# Tech tracking
tech-stack:
  added: []
  patterns:
    - '同一单源串拆两个表面：`/` 面板用完整两段式、卡片用其第二段的**机械投影**（取值以「引用 + 投影」形式书写，门禁正则锚在源码上）'
    - '判断**代码**的判据必须跑在**剥注释后的代码**上（M10 由裸 `branch.includes` 改为 `stripComments(branch)` 上的赋值形态断言）'
    - '「CSS 声明零改动」的可核对面 = 声明投影 sha 相等（A9，全轮）+ 四个规则块的声明集逐字比对（css-decl-freeze）'
    - '真实渲染判据的对象必须是**外接矩形**而非元素自身的 scrollWidth/clientWidth（裁切发生在祖先，后者恒相等 ⇒ 假绿）'
    - '驱动第 0 步前置自检带独立失败码（E-PW / E-KEY / E-DATA），缺数据前提即硬退出、拒绝判绿'

key-files:
  created:
    - tests/uat-49-g49-3-panel-layout.js
    - .planning/phases/49-manage-skill-ai/49-USER-SETUP.md
  modified:
    - src/skill-picker-model.js
    - src/renderer.js
    - src/styles/main.css
    - tests/test-skill-picker-model.js
    - tests/test-ai-skills.js
    - docs/product/ai-skills.md
    - AGENTS.md
    - .planning/phases/49-manage-skill-ai/49-UI-SPEC.md
    - .planning/WINDOWS.md

key-decisions:
  - '**不缩短 `/` 面板的 `STATUS_TEXT.promptOmitted`**（判定：48 D-12 原文 + 48-UI-SPEC「照写不统一」+ 逐字断言 + 产品文档 §10.1 四文案四重锁定；且缩短对面板零收益 —— 面板行可换行、宽 ≥ 280px，该串在面板里从不被裁切，缩短只会丢掉「未进提示词」半边语义）'
  - 'E1 的「≤ 4 字」处置照做，但作用对象纠正为真正越界的那条：新增 `PROMPT_OMITTED_CARD_NOTE = STATUS_TEXT.promptOmitted.split(" · ").pop()`（3 字）。九码短原因最宽 6 字（估算 ≈ 66px）本就在 129px 预算内，不该无端改动'
  - '「不新写」由源码级两条钉住：① 取值必须以引用 + 投影形式书写（正则 `PROMPT_OMITTED_CARD_NOTE\s*=\s*STATUS_TEXT\.promptOmitted\.split\(`）；② 文件内零个被引号包裹的该值独立字面量（含注释）。**判据不是 `includes`** —— 写死第二份字面量同样通过值域三条'
  - '**不改任何 CSS 声明**：不存在「标注不裁切 且 技能名宽度 > 0」的第二解 —— 容器 129px 内标注是 `flex-shrink: 0` 的受保护元素，只要不可压缩簇超标越界就是必然结果；修的是**被渲染文本的宽度预算**'
  - '「声明零改动」由 A9（全轮声明投影 sha 相等）与 css-decl-freeze（四规则块声明集逐字比对）**双判据**承担，两者都能被 `max-width: 60px` 这类添加转红（M14/M15/A1–A7 对它全绿）'
  - '实测值照写、字体度量估算一律标 `≈` 与「估算」字样；verification 的算术判据取**证据 JSON 的实测标注宽**（34px），估算只作旁注、不参与判定'
  - '验收证据必须是 280px 真实渲染且**先红后绿**：判据对象改为「标注外接矩形右缘 vs 裁切祖先右缘」（旧驱动的标注自身 scrollWidth/clientWidth 恒相等 ⇒ 无检出力）'
requirements-completed: [MGMT-01, MGMT-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: '280px 面板下，同时带来源徽标 + 超预算标注的 manage_skill 卡片头部，标注**不被祖先裁切**（真实渲染）'
    requirement: MGMT-05
    verification:
      - kind: e2e
        ref: 'tests/uat-49-g49-3-panel-layout.js#A1（标注右缘 ≤ 裁切祖先右缘，越界 0.00px）'
        status: pass
    human_judgment: false
  - id: D2
    description: '同一渲染下裁切祖先自身不溢出（scrollWidth ≤ clientWidth）且技能名宽度 > 0（退化为「被省略号压缩」而非整段消失）'
    requirement: MGMT-05
    verification:
      - kind: e2e
        ref: 'tests/uat-49-g49-3-panel-layout.js#A2/A3（136 ≤ 136；nameText clientWidth 54 > 0）'
        status: pass
    human_judgment: false
  - id: D3
    description: '既有通过项防回归：头部仍 36px 单行（520/280 同值）、徽标完整可读、拖到 260px 被钳制回 280px'
    requirement: MGMT-05
    verification:
      - kind: e2e
        ref: 'tests/uat-49-g49-3-panel-layout.js#A4/A5/A7'
        status: pass
    human_judgment: false
  - id: D4
    description: '卡片头部超预算标注渲染 `超预算`（3 字），且它是 `STATUS_TEXT.promptOmitted` 的机械投影而非新写字面量（源码级双判据）'
    requirement: MGMT-01
    verification:
      - kind: unit
        ref: 'tests/test-skill-picker-model.js#G-49-3 · PROMPT_OMITTED_CARD_NOTE 的值域 / G-49-3 · 「不新写」的机械保证 / G-49-3 · E1 的 ≤ 4 字收口'
        status: pass
      - kind: e2e
        ref: 'tests/uat-49-g49-3-panel-layout.js#A6（textContent === "超预算" + -limit 类）'
        status: pass
    human_judgment: false
  - id: D5
    description: '渲染端以**赋值形态**从单源取新常量（判据跑在剥注释后的代码上）；`/` 面板长串逐字未变、renderer 仍不含长串字面量'
    requirement: MGMT-01
    verification:
      - kind: unit
        ref: 'tests/test-ai-skills.js#M10（stripComments(branch) + /noteText\s*=\s*window\.SkillPickerModel\.PROMPT_OMITTED_CARD_NOTE\b/）'
        status: pass
      - kind: unit
        ref: 'tests/test-skill-picker-model.js#G-49-3 · 48 D-12 原文冻结 / STATUS_TEXT 另三键契约冻结 / 九码短原因长度上限'
        status: pass
    human_judgment: false
  - id: D6
    description: '`src/styles/main.css` 声明零改动（只改注释）'
    verification:
      - kind: other
        ref: 'tests/uat-49-g49-3-panel-layout.js#A9（red/520/420/280/260 五轮声明投影 sha 全等 69899a4f…）+ `node -e` 的 css-decl-freeze（四规则块声明集逐字比对）'
        status: pass
    human_judgment: false
  - id: D7
    description: '三条新判据在**未修复的当前树**上确实为红（断言非恒真）'
    verification:
      - kind: e2e
        ref: '/tmp/uat49/g49-3-red.log（A1 越界 11.84px · A2 148 > 136 · A3 nameText clientWidth 0 · A6 长串；A4/A5/A7/A8/A9 绿）'
        status: pass
    human_judgment: false
  - id: D8
    description: '文档自洽：`49-UI-SPEC.md` 七处卡片文案位置收口为 `超预算`（长串零出现）+ 正文其余「未进提示词」行全部标明所属表面 + 末尾 E1 收口记录六要素；`docs/product/ai-skills.md` §11.7/§11.8 与八单元例数账本'
    verification:
      - kind: other
        ref: 'ui-spec-copy-parity + docs-ok + counts-parity（三条可重跑 node -e 判据，见 SUMMARY 的 Verification 节）'
        status: pass
    human_judgment: false
  - id: D9
    description: 'UAT 层面的 gap 判定与运行期终证（`49-UAT.md` 的 `G-49-3` 状态是否翻转）'
    verification: []
    human_judgment: true
    rationale: '本计划只闭合代码 / 测试 / 文档面：`49-UAT.md` 的 `G-49-3` 仍为 `failed`，终证是重跑 `/gsd-verify-work 49` 的自动驱动探针（沿用 48-07 对 G-48-12 的同一处置）。过程状态不由执行器自行翻转。'

# Metrics
duration: 8 min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 07: 卡片头部标注在最小面板宽度下完整可读（G-49-3）Summary

**`manage_skill` 卡片头部的超预算标注改取 `/` 面板单源的 ≤ 4 字机械投影（`超预算`，3 字），使 280px 面板下的头部单行不变式真正成立 —— 标注不再被祖先裁切（越界 0.00px）、技能名回到可压缩的 54px；并留下一条真实渲染回归门禁（红→绿两轮 + 声明投影 sha）兑现「子串/声明扫描会假绿」的教训。**

## Performance

- **Duration:** ≈8 min（自记录执行起点；另含前置上下文读取）
- **Started:** 2026-09-13T14:20:45Z
- **Completed:** 2026-09-13T14:28:51Z
- **Tasks:** 3 / 3
- **Files modified:** 10（含 2 个新建：驱动脚本 + USER-SETUP）

## Accomplishments

- **G-49-3 的靶心消失**：280px 面板下带托管徽标 + 超预算标注的 `manage_skill` 卡片头部，标注外接矩形右缘 ≤ 裁切祖先右缘（越界 0.00px，修复前 11.84px）、祖先 `scrollWidth 136 ≤ clientWidth 136`（修复前 148 > 136）、技能名 `clientWidth 54 > 0`（修复前 0 —— 整段消失且无省略号空间）。
- **单源 ≤ 4 字投影**：`PROMPT_OMITTED_CARD_NOTE` 由 `STATUS_TEXT.promptOmitted.split(' · ').pop()` **机械派生**（3 字），面板长串逐字未变；「不新写」由源码级两条判据钉住，且单点变异（写死字面量）实测让两条**同时转红**。
- **真实渲染回归门禁** `tests/uat-49-g49-3-panel-layout.js`：playwright `_electron` 拉起 realm-dev、真实拖拽 resize handle、四档（520/420/280/260）几何量采集、A1–A9 断言、红/绿两轮证据 + 截图 + 4× 放大，并把第 0 步前置自检（E-PW / E-KEY / E-DATA）写进证据 JSON。脚本名以 `uat-` 开头 ⇒ 永不被 `test-*.js` 套件拾取。
- **「声明零改动」有了双判据**：A9（五轮声明投影 sha 全等）+ `css-decl-freeze`（四规则块声明集逐字比对），单点变异 `max-width: 60px` 实测**双红**，而 M14/M15/A1–A7 对它全绿 —— 盲区被显式覆盖。
- **`49-UI-SPEC.md` 收口为单一真相**：七处陈述卡片渲染文案的位置全部只写 `超预算`（长串零出现），正文其余 4 行提到「未进提示词」处一律标明属于 `/` 面板或投影来源，并把该纪律**立为契约条款**；末尾追加「Backstop 收口记录（E1 overflow）」六要素节（失败事实 / 收的是什么 / 收的不是什么 / 排除的两条路线 / 表面纪律 / 证据位置）。
- **八单元例数账本按实测刷新**：`test-manage-skill.js` **55**、`test-ai-skills.js` **177**、`test-skill-picker-model.js` **111**（105 → 111，新增 6 例）；`counts-parity ok · cells=8`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 端到端「最小面板宽度下头部标注完整可读」—— 单源 ≤4 字投影 → 渲染端取值 → 280px 真实渲染红→绿** - `fcf42d8` (fix)
2. **Task 2: 纯逻辑与源码面护栏 + M10 判据对象改为剥注释后的赋值形态** - `318012c` (test)
3. **Task 3: 卡片标注形态成文 + 八单元例数按实测刷新 + UI-SPEC 的 E1 收口记录** - `6abd31a` (docs)

**Plan metadata:** 见本 SUMMARY 之后的 `docs(49-07): complete …` 提交

## Files Created/Modified

- `tests/uat-49-g49-3-panel-layout.js`（新建，699 行）- G-49-3 的真实渲染门禁：第 0 步自检（E-PW/E-KEY/E-DATA）→ 复用持久化会话定位目标卡片（兜底走真实 LLM 往返）→ 真实拖拽四档 → A1–A9 断言 → 证据 JSON / 截图 / 4× 放大
- `src/skill-picker-model.js` - 新增并导出 `PROMPT_OMITTED_CARD_NOTE`（第二段机械投影）；`STATUS_TEXT` 四值与 `MANAGE_SKILL_SHORT_REASON` 九值逐字未变；JSDoc 说明「不新写」的两条可核对面
- `src/renderer.js` - `manage_skill` 分支的标注取值改取新常量（挂载结构、类名、`textContent` 路径零改动）
- `src/styles/main.css` - **只改 `.tool-card-manage-note` 上方注释**：280px 下的宽度预算算术（实测与估算分开标注）+ 为什么「不改声明才是正确修法」
- `tests/test-skill-picker-model.js` - +6 例（值域 / 源码级「不新写」两条 / ≤ 4 字 / 48 原文冻结 / 三键冻结 / 九码长度上限）
- `tests/test-ai-skills.js` - M10 两处取值判据改为 `stripComments(branch)` 上的赋值形态（其余五条只换判据对象）
- `docs/product/ai-skills.md` - §11.7 两种标注形态 + 诚实边界；§11.8 覆盖描述与例数
- `AGENTS.md` - 测试行的 `test-skill-picker-model.js` 例数按实测刷新
- `.planning/phases/49-manage-skill-ai/49-UI-SPEC.md` - 七锚点收口 + 4 行表面标注 + 追加 E1 收口记录节
- `.planning/phases/49-manage-skill-ai/49-USER-SETUP.md`（新建）- `XIAOMI_API_KEY` 已在本机环境变量中（status: Complete），另记「删除即不可复现」的前置技能数据
- `.planning/WINDOWS.md` - 追加 1 条 `unrun-verify`（失败态短原因的 280px 宽度仅由算术保证，未用真实渲染逐条覆盖）

## Decisions Made

- **不缩短 `/` 面板的 `STATUS_TEXT.promptOmitted`**：48-CONTEXT D-12 原文、48-UI-SPEC「照写不统一」、`test-skill-picker-model.js` 的逐字断言、产品文档 §10.1 四条定长文案四重锁定；且缩短对面板**零收益**（面板行可换行、宽 ≥ 280px，该串从不被裁切），只会丢掉「未进提示词」半边语义。
- **E1 的「≤ 4 字」处置照做，但落点纠正为真正越界的那条**：九码短原因最宽 6 字（估算 ≈ 66px）本就在 129px 预算内，无端改动会破坏 49 D-07 的锁定面；本次越界的只有 100px 的复用串。
- **不新立第二份文案**：短形态由 `STATUS_TEXT.promptOmitted` 第二段机械派生（形态沿用本仓既有先例 `MANAGE_SKILL_SHORT_REASON.limit_exceeded: STATUS_TEXT.overLimit` 的引用写法）。
- **不改任何 CSS 声明，只改注释**：不存在「标注不裁切 且 技能名宽度 > 0」的第二解 —— 越界是**被渲染文本的宽度预算**问题，不是 CSS 缺陷。
- **实测与估算分开标注**：`280 / 217 / 136 / 30 / 34px`（本次复跑实测）与 `210 / 129 / 32 / 100 / 19px`（49-UAT.md 实测）照写；`3 字 ≈ 33px`、`6 字 ≈ 66px` 等一律带 `≈` 与「字体度量估算，本轮未逐一实测」；判定只取证据 JSON 的实测值。
- **验收顺序固定「先红后绿」**：判据对象改为「标注外接矩形右缘 vs 裁切祖先右缘」，因为旧驱动的标注自身 `scrollWidth/clientWidth` 恒相等（实测 100/100）⇒ 无检出力。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 驱动无法定位 Electron 可执行文件（playwright 装在全局）**
- **Found during:** Task 1（首次运行驱动）
- **Issue:** playwright 经 `NODE_PATH="$(npm root -g)"` 从全局解析，它自身找不到本仓的 electron，`_electron.launch` 直接以 `Electron executablePath not found!` 失败
- **Fix:** 驱动显式传 `executablePath: require(path.join(REPO_ROOT, 'node_modules', 'electron'))`，并注明这是因为 playwright 装在全局
- **Files modified:** `tests/uat-49-g49-3-panel-layout.js`
- **Verification:** 驱动随后成功启动 realm-dev 并完成四档采集
- **Committed in:** `fcf42d8`（Task 1 提交）

**2. [Rule 1 - Bug] 驱动里 `panelWidths` 的作用域错误导致输出段 ReferenceError**
- **Found during:** Task 1（首次运行驱动，异常路径）
- **Issue:** `const widths = {}` 声明在 `try` 块内、却被 `try` 之外的输出段引用 ⇒ `ReferenceError: widths is not defined`，真正的失败原因被掩盖
- **Fix:** 提为 `try` 外的 `let panelWidths = {}`，输出段兼用 `evidence.roundWidths`
- **Files modified:** `tests/uat-49-g49-3-panel-layout.js`
- **Verification:** 异常路径下也能打印逐条布尔表 + 实测值
- **Committed in:** `fcf42d8`（Task 1 提交）

**3. [Rule 2 - Missing critical] 证据缺「容器宽度上下文」使 129 vs 136 的差异无法核对**
- **Found during:** Task 1（红轮复跑）
- **Issue:** 本次复跑实测 `.tool-card-name` clientWidth = 136，与 `49-UAT.md` 的 129 相差 7px；没有窗口 / 消息列表几何就无从判断是「同一个量」还是「测错了对象」
- **Fix:** 每档采集附加 `geometryContext`（window.innerWidth / docClientWidth / messageList 的 client/scroll/offsetWidth / 气泡宽），据此确认差异来自气泡可用宽（`.ai-message-content` 的 85% 上限）而非标注宽度 —— 两轮 `scrollWidth` 同为 **148**、标注同为 100px，根因形态逐项一致
- **Files modified:** `tests/uat-49-g49-3-panel-layout.js`
- **Verification:** 证据 JSON 的 `geometryContext` 可逐档复核
- **Committed in:** `fcf42d8`（Task 1 提交）

**4. [Rule 2 - 判断对象漏洞] 源文件 JSDoc 逐字复写了门禁正则所匹配的字符串，使关于「代码」的断言可被同文件散文满足**
- **Found during:** Task 2（单点变异自检 ①）
- **Issue:** Task 1 为说明纪律写下的 JSDoc 里含 `PROMPT_OMITTED_CARD_NOTE = STATUS_TEXT.promptOmitted.split(` 这一段**连续文本**，而门禁正则正是扫全文 ⇒ 把取值改成写死字面量后，「引用形式」这条断言**仍然为绿**（实测）。这正是本 phase 反复记录的假绿形态（关于代码的判断被同区域散文满足）
- **Fix:** 改写该 JSDoc 段，用「该常量名 + 赋值 + 对该面板串条目调用 `split(`」的**描述**替代逐字复写，并显式写明「本 JSDoc 刻意不逐字复写那条正则所匹配的字符串」；声明与取值形式零改动
- **Files modified:** `src/skill-picker-model.js`（**仅注释**；超出 Task 2 的 `<files>` 声明 —— 因漏洞源在该文件里，只能在该文件内闭合，已在此逐条披露）
- **Verification:** 单点变异重跑 —— (a) 引用形式正则 与 (b) 零第二份独立字面量 **双双转红**；恢复后 `git diff` 为空且 111/177/55 全绿
- **Committed in:** `318012c`（Task 2 提交）

---

**Total deviations:** 4 auto-fixed（1 blocking、1 bug、2 missing-critical）
**Impact on plan:** 全部为「让计划自带的判据真的成立」所必需，无功能范围扩张、无 CSS 声明改动、无文案语义变更。其中第 4 条是对计划 `<done>` 明文要求（「写死字面量必须让源码级两条断言转红」）的必要闭合 —— 不修则该要求实测不成立。

**与计划预测的差异（非偏差，如实记录口径差）**：计划依据 `49-UAT.md` 的几何表写「A1 越界约 19px、A2 148 > 129」；本次复跑的同一形态为「越界 **11.84px**、148 > **136**」。差异全部来自容器可用宽（气泡 85% 上限随窗口宽变化），`scrollWidth` 148 / 标注 100px / `nameText` 0 三个承重量逐项一致。计划也点名 A6 会红（红轮实测确认：`textContent` 仍是长串）。

## Issues Encountered

- **首次驱动运行失败**（`Electron executablePath not found!`）→ 见偏差 1；随后 `widths` 未定义把真正的失败原因掩盖 → 见偏差 2。
- **`ui-spec-copy-parity` 首轮报 3 行越界**：`146 / 267 / 564` 三行的「未进提示词」与其表面标注被**换行拆到了两行**上，而该判据是**逐行**的 ⇒ 逐行改写使串与标记同处一行（判据据此转绿）。这是一次真实的判据-文本对齐问题，不是放宽判据。
- **容器宽度 129 vs 136** → 见偏差 3，已用 `geometryContext` 定因并写进 CSS 注释的实测段。
- 驱动复用路径一次命中（目标卡片在最近一次 UAT 运行产生的会话 `3dec0492…` 中重载还原），**未触发真实 LLM 兜底**；`A8` 也在同一会话里拿到了**真实**失败卡片（`.tool-card-manage-note-error`，`[invalid_description]`），故未使用任何合成 DOM 节点。

## Verification（计划 `<verification>` 八条的实跑结果）

| # | 判据 | 结果 |
|---|------|------|
| 1 | 真实渲染门禁 `NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js` 退出码 0 | ✅ `ALL ASSERTIONS PASS`；A1–A9 全绿；`preflight` 三条 `E-PW/E-KEY/E-DATA` 均 true；红轮 `/tmp/uat49/g49-3-red.log` 记 A1/A2/A3/A6 红、A4/A5/A7/A8/A9 绿；证据含 520/420/280/260 四档 |
| 2 | 算术可核对性（取证据 JSON 实测值） | ✅ W=34 → `34 + 8 + 30 + 8 = 80 ≤ 129`（对本次实测容器 136 亦成立）；`nameText.clientWidth = 54 > 0` |
| 3 | 单源纪律（源码级两条 + 渲染端赋值形态） | ✅ 引用形式正则命中；零独立字面量；`/` 面板串逐字未变；M10 跑在剥注释后的代码上 |
| 4 | 既有套件无回归 | ✅ `test-manage-skill.js` 55/55 · `test-ai-skills.js` 177/177 · `test--test test-skill-picker-model.js` 111/111 |
| 5 | 账本一致 | ✅ `counts-parity ok · cells=8 · measured {55, 177, 111}` |
| 6 | 文档自洽（逐位置） | ✅ `ui-spec-copy-parity ok`（七锚点 + 零越界行 + 收口记录五要素）· `docs-ok`（§11.7 六要素 + §11.8 三词 + 48/49 挂账未移出） |
| 7 | 源码级「不新写」 | ✅ 同第 3 条；单点变异实测双红 |
| 8 | 安全 | ✅ 全程无 `pkill` / `pgrep` **杀进程**操作；`/Applications/Realm.app`（PID 22083）未受影响；`managed-skills/` 下 `commit-style` 与 14 个 `aa-budget-*` 仍在；`evidence3.json` / `uat49-t3-*.png` mtime 仍为 21:27（未被覆盖） |

## Known Stubs

None —— 本轮无硬编码空值、无占位文案、无未接线数据源。渲染端标注仍是同一 `createElement` + `textContent` + 同一挂载点。

## Threat Flags

None —— 无新增网络端点 / 认证路径 / 文件访问模式 / schema 变更；渲染端取值路径未变（`textContent` + 白名单类名），未新增任何字符串注入面（`T-49-07-06` 维持 mitigate）。

## User Setup Required

**None needed。** frontmatter 登记的 `XIAOMI_API_KEY` 在本机环境变量中已存在（驱动的 `E-KEY` 自检只判「已设置 + 长度」，不打印值），且它只被**兜底路径**（真实 LLM 往返）需要 —— 本次走复用路径，未使用。

`.planning/phases/49-manage-skill-ai/49-USER-SETUP.md` 仍按流程生成，**status 标 `Complete`**（并把核实命令与「删除即不可复现」的前置技能数据写在里面），避免留下一个会误导读者以为「还没配好」的 `Incomplete` 文件。

## Next Phase Readiness

- **G-49-3 的代码 / 测试 / 文档面已闭合**；`49-UAT.md` 的 `G-49-3` 仍为 `failed`，终证 = 重跑 `/gsd-verify-work 49` 的自动驱动探针（沿用 48-07 对 G-48-12 的同一处置）。
- **回归门禁可复用**：`tests/uat-49-g49-3-panel-layout.js` 是「卡片头部在最小面板宽度下的单行不变式」的可重跑证据；Phase 50（设置页技能管理区）若在同一头部加元素，须先跑它。
- **前置数据不可清理**：`realm-dev` 的 `commit-style` + 14 个 `aa-budget-*` 一删，本 gap 即不可复现（驱动会以 `E-DATA` 硬退出而**不会**判绿）。
- **仍在册的技术债**（本轮未动、不得读作已闭合）：`49-REVIEW.md` 的 `WR-03` / `WR-04` / `IN-01`–`IN-06`；`48-REVIEW.md` 的 `TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06`。
- **诚实边界（已立账）**：失败态短原因（≤ 6 字）在 280px 下的宽度仅由算术保证（`8 + 32 + 8 + 66 ≈ 114 ≤ 129`，66 为**字体度量估算**），**未用真实渲染**逐条覆盖 —— `.planning/WINDOWS.md` 的 `unrun-verify` 条目已登记。

---

*Phase: 49-manage-skill-ai*
*Completed: 2026-09-13*

## Self-Check: PASSED

- 创建的文件均存在：`tests/uat-49-g49-3-panel-layout.js` / `.planning/phases/49-manage-skill-ai/49-07-SUMMARY.md` / `.planning/phases/49-manage-skill-ai/49-USER-SETUP.md` → FOUND
- 三个任务提交均存在：`fcf42d8` / `318012c` / `6abd31a` → FOUND（`git log --oneline --all`）
- 计划 `<verification>` 八条全部实跑通过（含真实渲染门禁退出码 0、`counts-parity ok cells=8`、`ui-spec-copy-parity ok`、`docs-ok`、三个既有套件 55/177/111 全绿）
- 红轮证据 `/tmp/uat49/g49-3-red.log` 确实先于任何源码改动（A1/A2/A3/A6 为红），绿轮 `/tmp/uat49/g49-3-green.log` 退出码 0
- `git status`：本轮仅剩 `.gitignore` / `.planning/state.json` / `.planning/milestone.lock` / `47-bash/.review-diagnostics/` 等**非本计划**的既有改动，未被误提交

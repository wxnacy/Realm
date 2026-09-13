---
phase: 49-manage-skill-ai
plan: 02
subsystem: ui
tags: [skill, tool-card, renderer, css-tokens, a11y, whitelist-table, metadata-channel, reload-parity]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: manage_skill 工具与写权威面（49-01：三动作 / 九码 MANAGE_SKILL_ERROR / getSkillsForUI 的 tier 与 promptIncluded）
  - phase: 48-skill-name
    provides: TIER_BADGE 三档徽标单源、read 卡片技能化先例（同一函数的另一分支）、技能正文折叠块唯一实现（D-09）、skills:changed 广播消费
  - phase: 47-bash
    provides: seeded 身份 = 扫随包目录名集合（D-11，tier 判定的既有输入）
provides:
  - manage_skill 工具卡片技能化：运行中标题【创建/更新/删除技能「name」】+ 终态来源徽标 + 至多一条内联标注
  - src/skill-picker-model.js 的三张跨进程白名单表（TIER_BADGE / MANAGE_SKILL_ACTION_LABEL / MANAGE_SKILL_SHORT_REASON / MANAGE_SKILL_ACTION_NAME）与 STATUS_TEXT 导出
  - ai-manager.js 的两时点 manage_skill 标记 + 按 toolCallId 的失败态短期元数据通道（不经恒为 {} 的 result.details）
  - _buildManageSkillDecoration —— 实时链路与重载链路**唯一**的标记构造（重开对话形状逐字一致）
  - 卡片语境的样式与令牌（--skill-error-text 双主题、三条 .tool-card-manage-note* 规则、两处 scoped 覆盖、折叠块 header 焦点环）
  - 48-UI-REVIEW 的两条共用面前置修复（徽标底色基准钉死 / 浅色 --skill-limit-text 改值）
affects: [Phase 50（设置页技能管理区，可复用同三张白名单表与卡片标记形状）, Phase 51（导入管线，卡片变体已具备承载新原因码的位置）]

# Actuals (#2632) — 与计划 estimate 同尺度（chars/4 over realized diff），非 harness token 计数
actuals:
  tokens: 18051
  tasks: 3
  commits: 3
plan_head_before: 0ae16d933dd9d4edaee4572101ac70b91a57a679
commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "两时点事件标记：start 只给零 IO 的基础标记（action + name），end 才并入磁盘判定的终态键（tier / code / promptIncluded）"
    - "失败态元数据经注册层的按 toolCallId 短期 Map（读后即删），不经 SDK 错误结果的 details（恒为 {}）"
    - "两条链路（实时 / 重载）共用**一个**装饰构造 ⇒ 键集合不可能漂移；不可判定时省略键而非猜"
    - "渲染端零判定：只查闭合白名单表，表外跳过（不产出 undefined 字面量进 class / 文本）"
    - "全部用户可见字符串经 textContent / DOM 属性赋值，零 HTML 模板拼接"
    - "折叠块 a11y 增量落在唯一构建实现上 ⇒ 既有气泡实例同时获得（纯增量、零回归）"

key-files:
  created: []
  modified:
    - src/skill-picker-model.js
    - ai-manager.js
    - src/renderer.js
    - src/styles/main.css
    - src/index.html
    - ai-conversations-manager.js
    - tests/test-ai-skills.js
    - tests/test-skill-picker-model.js

key-decisions:
  - "终态元数据写在 syncAgentSystemPrompt() **之后**（覆盖计划文本的「之前」）：该方法首行就是技能目录重扫，写在之前会让 create 的新技能因缓存陈旧而省略 tier —— 徽标会在唯一需要它的场景（新建）永不出现"
  - "重载链路必须能读到 details.promptIncluded ⇒ 在 ai-conversations-manager.getMessages 追加 1 行条件回填（该文件不在计划 files_modified 内，属阻塞级缺口的必要修复）；未附带 details 的既有工具卡片形状零变化"
  - "STATUS_TEXT 补进 api 导出面：计划的 verify 与测试规范都要求断言 limit_exceeded === STATUS_TEXT.overLimit，不导出则该「同值」约束只能靠散文保证"
  - "tier 在 delete 成功后不可判定（目标已消失）⇒ 省略键、不显示徽标；重载链路的 code 不落库 ⇒ 同样省略键。两处都是「宁缺勿猜」而非遗漏，已入 WINDOWS 台账"
  - "本计划的源码门禁一律度量**代码**而非散文：innerHTML / JSON.stringify 类断言在剥离注释后的文本上求值，区域结束标记不与本计划自己的注释撞字符串"
  - "本阶段有 CSS 改动 ⇒ 按仓库既有约定推进 index.html 的 main.css?v（8 → 9）；既有「令牌集合恰为四个」的护栏按新增令牌更新为五个，并把标题改为「单调增长」以免下次再产生一次假红"

patterns-established:
  - "manage_skill 卡片（及后续同类 AI 动作卡片）的标记形状：{action, name, tier?, code?, promptIncluded?}，不可判定即省略键"
  - "工具执行的失败原因码通道：_manageSkillMeta（按 toolCallId 写 → end 读后即删）—— 49-01 的业务 throw 语义零变化"
  - "跨进程白名单表的登记口径：新增令牌 / 文案表必须同时进 api 对象与两处主题块，并被对应的护栏计数"

requirements-completed: [MGMT-01, MGMT-05]

# Coverage metadata (#1602) — 每个交付物一条，驱动 verify-work 的确定性 UAT 路由
coverage:
  - id: D1
    description: "模型调用 manage_skill 时卡片标题在**运行中即时**变为【创建/更新/删除技能「name」】，终态并入来源徽标（两时点标记 + 渲染端「已存在条目」合并分支的条件并入）"
    requirement: "MGMT-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#M2（源码）两时点事件字段 + 成功/失败两个出口各写一次元数据、失败仍 throw"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#M3（源码 · 合并分支护栏）新条目映射 manageSkill，且已存在条目分支条件并入终态字段"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#M6（行为）_resolveManageSkillMarker 四分支打表"
        status: pass
    human_judgment: false
  - id: D2
    description: "失败态的原因码 / 档位经按 toolCallId 的短期元数据抵达渲染端（不经 SDK 产出恒为 {} 的 result.details）；成功与失败两条路径的标记形状逐字一致"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#M2b（行为）终态元数据通道：读后即删、只投影终态三键、非法标记得 null"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#M2（源码）… 失败仍 throw"
        status: pass
    human_judgment: false
  - id: D3
    description: "九条原因码 → 头部短原因闭合白名单（定长 ≤ 6 字、不含技能名），limit_exceeded 与面板行尾标注 STATUS_TEXT.overLimit 同值（引用同一常量）"
    requirement: "MGMT-01"
    verification:
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · MANAGE_SKILL_* 两张白名单表（Phase 49 / D-02 / D-07，跨进程单源）"
        status: pass
    human_judgment: false
  - id: D4
    description: "卡片信息面：参数区是可读三行摘要（content 只在折叠块出现）、create/update 且非失败态才挂正文折叠块（复用唯一实现 + a11y 增量）、结果区渲染文本而非 JSON、头部内联标注至多一个（0 个不渲染元素）"
    requirement: "MGMT-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#M7 / M8 / M9 / M10 / M11（参数区 / 结果区 / 折叠块单实现与 a11y / 标注单一挂载点 / 钩子类）"
        status: pass
    human_judgment: false
  - id: D5
    description: "重开对话后卡片形状与实时链路**逐字一致**（两条链路共用同一个 _buildManageSkillDecoration 构造）"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#M5b（行为 · 重载同形）重载链路与实时链路合并后的 manageSkill 逐字相等"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#M5（源码 · 重载同形）两条链路共用一个装饰构造（恰 1 处定义）"
        status: pass
    human_judgment: false
  - id: D6
    description: "样式与令牌：--skill-error-text 双主题两处、三条 .tool-card-manage-note* 规则、卡片语境两处 scoped 覆盖、折叠块 header 焦点环，以及 48-UI-REVIEW 的两条共用面前置修复（徽标底色基准钉死 / 浅色 --skill-limit-text 改 #92400E）"
    requirement: "MGMT-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#M12 / M13 / M14 / M15 / M16（令牌两处 / 徽标底色基准 / 标注规格 / 单行不变式 / 两处覆盖与焦点环）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#三档徽标修饰类与令牌：白名单 class 名与 TIER_BADGE 一致，令牌集合随阶段单调增长"
        status: pass
    human_judgment: false
  - id: D7
    description: "在 AI 面板最小宽度（--ai-panel-min-width 280px，扣气泡内边距）下，带来源徽标 + 内联标注的 manage_skill 卡片头部保持单行不换行，徽标与短原因完整可读（仅技能名缩略，不出现标注被裁切或头部高度变化）—— 本阶段唯一的 backstop（UI Considerations E1 / overflow）"
    verification: []
    human_judgment: true
    rationale: "这是**真实数据集的视觉确认**：需要同时出现「最宽标注（未进提示词 · 超预算）+ 来源徽标 + 超长技能名」的卡片并在 280px 面板宽下目视确认。纯 Node 无 DOM 宿主，源码断言只能保证结构前提（.tool-card-header 无 flex-wrap、标注 flex-shrink: 0 + nowrap、.tool-card-name-text 是唯一压缩承担者）—— 三者都被 M15 断言，但「实际渲染宽度下是否仍单行、标注是否被裁切」仍必须有视觉证据。无显式证据则路由 human_needed（UI-SPEC 明文：若不成立，处理方式是缩短短原因至 ≤ 4 字，**不得**改成换行头部或加 system-note）。"

# Metrics
duration: 19 min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 02: `manage_skill` 卡片技能化（AI 自建技能的用户可见面）Summary

**三张跨进程白名单表 + 两时点标记（运行中给标题、终态给徽标与短原因）+ 按 toolCallId 的失败态元数据通道（绕开 SDK 恒为 `{}` 的 details）+ 实时与重载共用一个装饰构造，配 16 条 M 组断言与两条 48 共用面前置修复**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-13T06:56:56Z
- **Completed:** 2026-09-13T07:15:36Z
- **Tasks:** 3 / 3
- **Files modified:** 8（5 源文件 + 3 测试 / 页面文件；含 2 个计划外但阻塞级必需的文件）
- **Realized diff:** 1031 insertions / 68 deletions（1099 行），72 206 字符 ⇒ `actuals.tokens` = 18 051（chars/4）
- **Estimate vs actual:** 计划 `estimate.tokens` = 120 000（confidence: low）⇒ 实际仅为估计的 **15.0%**。计划按「一条全新的卡片渲染链 + 三处样式面」估的，实际改动集中在「一个渲染分支 + 两条事件字段 + 四条小方法 + 三张表 + CSS 增量」；estimate 再次显著高估（与 49-01 同型）。

## Accomplishments

- **卡片标题在运行中即可见、终态才给判定**：`tool_execution_start` 只给零 IO 的 `{action, name}`（唯一携带 `params` 的时点），`tool_execution_end` 才并入 `{tier?, code?, promptIncluded?}` —— `create` 的目标在调用前并不存在，磁盘判定只能等执行之后。
- **`RESEARCH Pitfall 4` 被钉死在门禁里**：渲染端「已存在条目」合并分支原本只并入 `status / result / error`，不追加 `manageSkill` 则徽标与短原因**永不出现**（新条目分支的 `...spread` 只覆盖首个事件）。该行现在被 M3 专门断言，且**条件并入**（避免后续事件把标记抹成 `undefined`）。
- **失败态原因码改走短期元数据通道**：SDK 的 `createErrorToolResult(message)` 产出 `details` 恒为 `{}`，失败态经它传递等于永远丢给渲染端。现由 `_manageSkillMeta`（键 = `toolCallId`，成功与失败**两个出口**各写一次，`tool_execution_end` 读后即删）承载 —— 业务失败**仍然 throw**，49-01 的 LLM 语义零变化；成功与失败两条路径的标记形状逐字一致（M2 / M2b）。
- **重载链路与实时链路共用一个构造**：`_buildManageSkillDecoration` 恰 1 处定义 + 2 处调用，M5b 用行为断言核对「键集合 + 取值逐字相等」——48-03 建立的「实时 vs 重载一致」纪律在本变体上继续成立。
- **卡片信息面零 HTML 拼接**：参数区是可读三行摘要（`content` 只在默认折叠的折叠块里出现，不再整体 JSON 化）、结果区渲染文本（对象取 `content[]` 的 text 块；重载链路的 `result` 本就是文本 ⇒ 两条链路逐字一致）、头部内联标注**至多一个**（失败短原因 / 未进提示词互斥，0 个时不渲染元素）。全部插值面为 `textContent` 或白名单表取值 —— 本阶段**未扩大** TD-48-01 的缺口。
- **折叠块 a11y 补齐落在唯一实现上**：`renderSkillContentBox` 获得 `role="button"` + `tabindex="0"` + 随态更新的 `aria-expanded` + Enter/Space（Space 带 `preventDefault`），因此**既有气泡实例同时获得**，属纯增量（零布局 / 配色 / 文案变化）。这是 48-UI-REVIEW Pillar 6 建议的落地。
- **两条 48 共用面前置修复落地**：三档徽标的 `color-mix` 第二颜色参数由中性色改为 `var(--bg-secondary)`（六处：3 档 × background/border）—— 底色钉死后不再随宿主 hover 漂移；浅色 `--skill-limit-text` 由 `#B45309` 改为 `#92400E`（原值对浅色 hover 底实测 3.80:1）。两处对面板行（48 的既有面）同时生效。
- **零回归**：`syncAgentSystemPrompt()` / `_flushDeferredSkillsPrompt()` / `_resolveSkillMarker` / `_decorateSkillUserMessage` / `renderAISkillPill` / `renderAIMessages` / `renderToolCards` / `renderSlashPickerList` / `buildUserMessageContent` / `escapeHtml` 的方法体**逐字节未变**（实测比对）；`agent-workspace.js` / `ai-skills-manager.js` / `builtin-skills-seeder.js` 零 diff；全仓 22 个测试套件 0 失败。

## Task Commits

Each task was committed atomically:

1. **Task 1: 卡片纵切最小可运行（tracer）—— 两张白名单表 + 两时点标记 + 失败态元数据通道 + 渲染端标题与徽标** — `e33ce1f` (feat)
2. **Task 2: 卡片信息面 —— 参数摘要（剔除 content）+ 正文折叠块复用（含 a11y）+ 结果文本化 + 至多一条内联标注** — `9bffeed` (feat)
3. **Task 3: 样式与令牌 —— 标注规则 + --skill-error-text 双主题 + 48 前置修复两条 + 卡片语境两处 scoped 覆盖** — `aa90a9b` (style)

**Plan metadata:** 见最终 `docs(49-02)` 元数据提交

_Note: 本计划无 `type: tdd` 计划，无需 RED/GREEN/REFACTOR 三段提交。_

## Files Created/Modified

- `src/skill-picker-model.js` — 新增 `MANAGE_SKILL_ACTION_LABEL`（三动作标题模板）/ `MANAGE_SKILL_ACTION_NAME`（三动作中文短名）/ `MANAGE_SKILL_SHORT_REASON`（九码短原因，`limit_exceeded` 引用 `STATUS_TEXT.overLimit`）；`STATUS_TEXT` 补进 api 导出面；三表均 `Object.freeze`
- `ai-manager.js` — 新增 `_resolveManageSkillMarker` / `_buildManageSkillDecoration` / `_resolveManageSkillTerminal` / `_manageSkillTerminalFromStored` 与私有字段 `_manageSkillMeta`；`tool_execution_start` / `tool_execution_end` 各加 `manage_skill` 字段；`_buildManageSkillTool().execute` 两个出口写元数据（失败仍 throw）；`getConversationMessages` 同址重建标记
- `src/renderer.js` — 事件映射两处（新条目映射 / 合并分支条件并入）；`renderToolCard` 新增 `manage_skill` 变体（标题 + 徽标 + 内联标注 + 参数摘要 + 折叠块挂载 + 结果文本化 + `tool-card-manage` 钩子类）；`renderSkillContentBox` 的 a11y 增量
- `src/styles/main.css` — `--skill-error-text`（两处主题块）、浅色 `--skill-limit-text` 改值、三档徽标 `color-mix` 第二参数改 `var(--bg-secondary)`、三条 `.tool-card-manage-note*` 规则、两处 `.tool-card-content .ai-skill-content-box*` 覆盖、`.ai-skill-content-box-header:focus-visible`
- `src/index.html` — `styles/main.css?v=8` → `v=9`（本阶段有 CSS 改动，按仓库既有缓存失效约定推进）
- `ai-conversations-manager.js` — `getMessages` 把 `tool_results` 的 `details` **条件**回填到工具卡片（重载链路还原 `promptIncluded` 的唯一数据源）
- `tests/test-ai-skills.js` — 新增 `M 组 · Phase 49 manage_skill 卡片标记`（M1–M16，16 例）+ `promptCtx` 夹具补 `_manageSkillMeta`
- `tests/test-skill-picker-model.js` — 新增「两张白名单表」4 例；既有「令牌集合恰为四个」护栏更新为五个

## Decisions Made

- **终态元数据写在重扫之后**（覆盖计划文本的「`syncAgentSystemPrompt()` 之前」）：该方法首行就是技能目录重扫，写在之前会让 `create` 的新技能因缓存陈旧而省略 `tier` —— 徽标会在唯一需要它的场景（新建）永不出现。见 Deviations #5。
- **重载链路的 `promptIncluded` 取持久化的历史真值**（`details.promptIncluded`），不重算。计划假定 `t.details` 已可用，实际 `getMessages` 只回填 `result / status / error` ⇒ 追加 1 行条件回填（Deviations #7）。
- **不可判定即省略键**：`delete` 成功后的 `tier`（目标已消失）、重载链路的 `code`（不落库）都省略对应键 ⇒ 渲染端跳过徽标 / 标注而不猜。两处已入 `.planning/WINDOWS.md`（#28 / #29）。
- `tier` 一律消费 `toUISkillEntry` 的既有输出（Phase 47 D-11 的 `sourceTierOf` 是唯一判据），工具层**不重写**来源判定；渲染端**零判定**（只查三张白名单表）。
- 其余决策见 frontmatter `key-decisions`（均源自 CONTEXT 的 D-01 / D-02 / D-07 / D-12 / D-13 与 UI-SPEC 的四条硬约束，未自创口径）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 计划自带 `<verify>` 脚本不可编译（Task 1 verify #1）**

- **Found during:** Task 1 逐条执行 `<verify>`
- **Issue:** `node -e '…'` 脚本缺语句分隔符（`…bad.push("短原因表键数不是 9（必须是闭合白名单）")if(…)`），`SyntaxError: Unexpected token 'if'` —— 与实现无关，字面恒失败（与 49-01 的 deviation #6 同型）。
- **Fix:** 只补缺失的 `;` 分隔符，**断言集逐条保留、不放宽任何判据**；修正版存于 `/tmp/gsd-49-02-task1-verify1.js`。
- **Files modified:** 无（仅执行侧修正 + 计划缺陷记录；未改 PLAN.md）
- **Verification:** 修正版 `EXIT=0`，输出「两张白名单表值域 ok（三动作 + 九码 + 冻结 + 同值约束）」。**Committed in:** 不适用

**2. [Rule 3 - Blocking] 计划自带 `<verify>` 的 `innerHTML` 扫描窗口命中既有代码（Task 1 verify #3）**

- **Found during:** Task 1 verify #3 原样执行
- **Issue:** 该判据在 `renderToolCard` 的头 4000 字符窗口内全局扫描 `innerHTML`，而该窗口必然包含**既有**的三态状态图标（`statusIcon.innerHTML = '<svg …>'`，本计划零改动）⇒ 字面恒失败。
- **Fix:** 把 `innerHTML` 检查**收窄到本计划新增的 manage_skill 分支区域**（该断言自身文案与 prohibition 2 的靶心）；其余四条断言逐字保留、窗口不变。另把本变体注释里的 `innerHTML` 字面量改写为「HTML 模板拼接」（同 49-01 deviation #4 的处置）。
- **Files modified:** `src/renderer.js`（仅注释措辞）
- **Verification:** 修正版 `/tmp/gsd-49-02-task1-verify3.js` `EXIT=0`，输出「渲染端三处接线 ok」。**Committed in:** `e33ce1f`

**3. [Rule 3 - Blocking] 计划自带 `<verify>` 的源码窗口命中**通用**渲染路径（Task 2 verify #1）**

- **Found during:** Task 2 verify #1 原样执行
- **Issue:** 该判据取 `const manageSkill = …` 起的 **7000 字符**窗口，断言「不含 `JSON.stringify(toolExecution.params)` / 不含 `JSON.stringify(…result)`」；但 `renderToolCard` 是**所有工具共用**的渲染函数，**既有通用**参数区与结果区必然落在窗口内 —— 与计划自己「其余工具的渲染路径零改动」的要求直接冲突，字面恒失败。
- **Fix:** 窗口**收窄到本变体自己的渲染区域**（分支起点 → 通用参数区起点），并在**剥离注释**后的代码文本上求值（该窗口内含 48-03 与 49-02 的注释，源码门禁应度量代码而非散文）；断言逐条保留。
- **Files modified:** 无（仅执行侧修正）
- **Verification:** 修正版 `/tmp/gsd-49-02-task2-verify1.js` `EXIT=0`，输出「参数摘要 + 结果文本化 + 内联标注（至多一个）ok」。**Committed in:** 不适用

**4. [Rule 3 - Blocking] 计划自带 `<verify>` 的计数正则含多余 `#` 前缀（Task 3 verify #1）**

- **Found during:** Task 3 verify #1 原样执行
- **Issue:** `(seg.match(/#\{0,1\}var\(--bg-secondary\)/g)||[]).length<3` —— `#{0,1}` 是「可选的字面 `#`」，而 CSS 里 `var(--bg-secondary)` 前面是 `, ` ⇒ **实测 0 命中**，字面恒失败（注释声称「须 3 档 background + 3 处 border」）。
- **Fix:** 去掉多余的 `#\{0,1\}` 前缀（只可能收紧而不可能放宽），保留原 `<3` 比较符；实测 6 处。
- **Files modified:** 另把本计划一条 CSS 注释里的 `.slash-picker-status` 字面量改写（它使该 verify 的区域结束标记前移、切片为空 —— 见 #10）。
- **Verification:** `EXIT=0`，输出「令牌两处 + 前置修复两条 ok（徽标底色 var(--bg-secondary) 实测 6 处）」。**Committed in:** `aa90a9b`

**5. [Rule 1 - Bug] 计划把终态元数据的写入点放在重扫**之前**，会让 create 卡片永远没有来源徽标**

- **Found during:** Task 1 实现 `_buildManageSkillTool().execute`
- **Issue:** 计划原文要求「成功出口（三个动作分支内、`syncAgentSystemPrompt()` **之前**）」写 `_manageSkillMeta`，并断言「create 成功后缓存已被忙分支重扫过，故此刻必定能查到 tier」。实测不成立：`syncAgentSystemPrompt()` 的**首行**就是技能目录重扫，而工具内那次调用就在其后 —— 写在之前时 `getSkillsForUI()` 读到的仍是旧缓存，`create` 的新技能查不到 ⇒ 省略 `tier` ⇒ 徽标在唯一需要它的场景（新建）永不出现。
- **Fix:** 把 `_manageSkillMeta.set` 移到 `await this.syncAgentSystemPrompt()` **之后**（仍在成功出口、`return` 之前），并在注释写明原因。
- **Files modified:** `ai-manager.js`
- **Verification:** M2 断言两个出口各写一次（计数 2）；M5b 行为用例确认 `create` → `tier === 'managed'`。**Committed in:** `e33ce1f`

**6. [Rule 1 - Bug] 计划文本的 `getSkillsForUI(...).find(...)` 不存在（返回的是对象不是数组）**

- **Found during:** Task 1 实现 `tierOf`
- **Issue:** 计划写 `const list = getAiSkillsManagerLazy().getSkillsForUI(...); const hit = list.find(...)`，但 `getSkillsForUI()` 返回 `{skills, refreshedAt, digest}` ⇒ 照写 `TypeError: list.find is not a function`（同 49-01 deviation #1 的 `listDir` 形状误判型）。
- **Fix:** 改为 `.skills.find(...)`，并加注「消费 `toUISkillEntry` 的既有输出」。
- **Files modified:** `ai-manager.js`
- **Verification:** M5b / L1 行为用例通过（前者要求 `tier === 'managed'`）。**Committed in:** `e33ce1f`

**7. [Rule 3 - Blocking] 重载链路的 `promptIncluded` 在现有 `getMessages` 形状下无处可取**

- **Found during:** Task 1 实现 `_manageSkillTerminalFromStored`
- **Issue:** UI-SPEC 硬约束 3 要求「重开对话后卡片形状与实时链路逐字一致」，计划据此要求从「已持久化的 `t`」上取 `details.promptIncluded`。但 `ai-conversations-manager.getMessages` 在 toolResult 回填处只写 `result / status / error`，**不把 `meta.details` 带到显示形状上**，而该文件**不在**计划的 `files_modified` 内 ⇒ 照计划实现会让「未进提示词 · 超预算」标注在重开对话后消失。
- **Fix:** 在该回填处追加 1 行**条件**回填 `if (meta.details !== undefined) target.details = meta.details;` —— 既有工具卡片形状零变化（`test-ai-conversations.js` 111/111 保持绿）。
- **Files modified:** `ai-conversations-manager.js`
- **Verification:** M5b 行为用例断言重载与实时链路的标记逐字相等（含 `promptIncluded: false`）。**Committed in:** `e33ce1f`

**8. [Rule 1 - Bug] `STATUS_TEXT` 不在模块导出面上，计划的 verify 与测试规范都无法编译**

- **Found during:** Task 1 verify #1 原样执行
- **Issue:** 计划要求断言 `MANAGE_SKILL_SHORT_REASON.limit_exceeded === STATUS_TEXT.overLimit`（verify 与测试规范各一处），但 `STATUS_TEXT` 从未进入 `api` 对象 ⇒ `m.STATUS_TEXT` 为 `undefined`，读 `.overLimit` 抛 `TypeError`。「同值」这条约束在导出面缺失时只能靠散文保证。
- **Fix:** 把既有的 `STATUS_TEXT` 补进 `api`（**纯增量**，不改任何既有导出语义），并加一条源码断言 `/limit_exceeded:\s*STATUS_TEXT\.overLimit/` 证明是「引用同一常量」而非巧合同文案。
- **Files modified:** `src/skill-picker-model.js`、`tests/test-skill-picker-model.js`
- **Verification:** picker 套件新增 4 例全绿（99/99）。**Committed in:** `e33ce1f`

**9. [Rule 1 - Bug] 本计划自己的注释含 `refreshSkills()` 字面量，触发既有源码门禁**

- **Found during:** Task 1 跑全量测试时（`manage_skill 工具项` 组的「execute 内刷新链唯一」与 L 组 L3 同时转红）
- **Issue:** 既有门禁用 `/refreshSkills\(/` 判定「工具内不得直接调 refreshSkills（D-13）」，而我在解释「元数据为何写在重扫之后」的注释里写了 `` `refreshSkills()` `` ⇒ 误判为提前实现。既有门禁是对的（不该为注释放宽），且它扫描的是 6000 字符窗口与 `methodBody`，注释落在其中。
- **Fix:** 改写注释措辞为「首行就是技能目录重扫」，去掉字面量。
- **Files modified:** `ai-manager.js`
- **Verification:** 两条既有门禁恢复绿；`methodBody('_buildManageSkillTool')` 内 `await this.syncAgentSystemPrompt()` 仍恰 1 处、`refreshSkills(` 0 处。**Committed in:** `e33ce1f`

**10. [Rule 1 - Bug] 本计划自己的 CSS 注释含 `.slash-picker-status` 字面量，使计划 verify 的区域切片为空**

- **Found during:** Task 3 verify #1 原样执行
- **Issue:** 该 verify 用 `css.indexOf(".slash-picker-status")` 作区域结束标记；我在新增的 `.tool-card-manage-note` 注释里写了「与 .slash-picker-status 同族」⇒ 结束标记前移到注释处，`slice` 变成空串，徽标底色统计恒为 0。
- **Fix:** 注释改为「与面板的行尾状态标注同族」（语义不变，去掉字面量）。
- **Files modified:** `src/styles/main.css`
- **Verification:** 修正后的 verify 统计到 6 处 `var(--bg-secondary)`。**Committed in:** `aa90a9b`

**11. [Rule 1 - Bug] `promptCtx` 夹具缺 `_manageSkillMeta`（新增的构造期 own property）**

- **Found during:** Task 1 跑全量测试（L 组 L1 转红：`Cannot read properties of undefined (reading 'set')`）
- **Issue:** L1 用 `Object.create(aiManager.prototype)` 造夹具、**不跑构造函数**，而 `execute` 现在会写 `this._manageSkillMeta` ⇒ 该 own property 为 `undefined`。
- **Fix:** 在 `promptCtx` 里显式补 `ctx._manageSkillMeta = new Map();`（与既有「own property 只补出口路径真正读到的字段」的夹具纪律一致）。
- **Files modified:** `tests/test-ai-skills.js`
- **Verification:** L1（含 `rescanCalls === 2` 与广播恰一次）恢复绿。**Committed in:** `e33ce1f`

**12. [Rule 3 - Blocking] 新增令牌被既有「令牌集合恰为四个」的护栏拒绝**

- **Found during:** Task 3 首次跑 `tests/test-skill-picker-model.js`
- **Issue:** 既有断言用 `assert.deepStrictEqual` 要求 `--skill-*` 令牌集合**恰为** 48-01 落的四个 —— 新增 `--skill-error-text` 必然转红。该护栏的意图是「不得悄悄引入未登记的令牌」，为它改口径是对的，但需要同步登记本阶段新增的那一个。
- **Fix:** 期望集合更新为五个（四个 + `--skill-error-text`），并把标题从「四个令牌只消费不新增」改为「令牌集合随阶段单调增长」，注释写明「新增令牌时只允许在此处追加（并同时写入两个主题块）」。
- **Files modified:** `tests/test-skill-picker-model.js`
- **Verification:** picker 套件 99/99 全绿。**Committed in:** `aa90a9b`

**13. [Rule 2 - Missing Critical] 本阶段有 CSS 改动，必须推进缓存失效序号**

- **Found during:** Task 3 收尾自检
- **Issue:** 仓库既有护栏明确要求「本阶段最后一次 CSS 改动已推进 `index.html` 的 `styles/main.css?v=` 序号」（`test-ai-skills.js` 与 `test-skill-picker-model.js` 各有一条）。本阶段改了 `main.css` 却未在计划的 `files_modified` 里列 `index.html` ⇒ 不推进则新样式可能被缓存遮蔽。
- **Fix:** `?v=8` → `?v=9`（既有两条护栏断言 `>= 7` / `>= 8`，仍绿）。
- **Files modified:** `src/index.html`
- **Verification:** 两条缓存失效护栏保持绿；全量 22 个套件 0 失败。**Committed in:** `aa90a9b`

---

**Total deviations:** 13 auto-fixed（7 × Rule 1 实现/契约缺陷，2 × Rule 2 缺失关键约束，4 × Rule 3 阻塞级缺陷 / 计划 verify 不可满足）
**Impact on plan:** 无范围蔓延 —— 全部自动修复都落在计划已列明的语义范围内；触及计划外文件两处：`ai-conversations-manager.js`（#7，重载链路唯一数据源，1 行）、`src/index.html`（#13，仓库既有 CSS 缓存约定，1 字符）。两处都为「不修则计划自己的验收目标不可达」。**计划自带 4 条 `<verify>` 判据字面不可满足**（#1–#4），全部以「只做最小语法 / 口径修正、断言集逐条保留」的方式执行并将缺陷记入 `.planning/WINDOWS.md`（#25–#27）。

## Issues Encountered

1. **计划自带的 4 条 `<verify>` 判据字面不可满足**（详见 Deviations #1–#4）—— 与 49-01 的 deviation #6 同型，建议后续 plan-phase 对 `<automated>` 内联脚本加一次「`new Function()` 可编译性 + 窗口不命中既有代码」自检。已入 WINDOWS 台账（#25–#27）。
2. **`delete` 成功卡片不显示来源徽标 / 重载链路的失败卡片不显示短原因**（Deviations 决策项）—— 两者都是「不可判定时省略键」的**刻意**行为（UI-SPEC 明文「无法判定时省略该键，宁缺勿猜」），不是遗漏；已作为 stub 记入 WINDOWS（#28 / #29），供 verify-work 裁决是否接受。
3. **UI Considerations 的 1 条 backstop 无法自动裁决**：280px 最小面板宽下「徽标 + 最宽标注 + 超长技能名」的单行与可读性需要**真实数据集的视觉确认**。结构前提已被 M15 机械断言（`.tool-card-header` 无 `flex-wrap`、标注 `flex-shrink: 0` + `nowrap`、`.tool-card-name-text` 是唯一压缩承担者），但「实际渲染是否单行、标注是否被裁切」无显式证据 ⇒ 按 UI-SPEC 路由 `human_needed`（见 coverage D7 的 rationale）。**未静默通过。**
4. **其余无。** 全量回归：`test-ai-skills.js` 154 → **172**、`test-skill-picker-model.js` 95 → **99**、`test-manage-skill.js` 41、`test-ai-conversations.js` 111、`test-agent-workspace.js` 21、`test-builtin-skills-seeder.js` 101、`test-ai-bash-policy.js` 97、`test-m3u8-playlist-parser.js` 31、`test-unified-navigation.js` 32、`test-favorites-organize.js` 49、`test-ai-attachments.js` 35、`test-media-*` 共 164、其余小套件全绿 —— **0 失败**。

## Threat Flags

无新增安全面。本计划在既有威胁面上**收窄**了注入面与判定面：

| Threat ID | 处置 | 落地证据 |
|---|---|---|
| T-49-02-01 XSS / 属性逃逸 | mitigate | 卡片变体的**全部**插值面为 `textContent` 或白名单表取值（`badgeEl.textContent` / `badgeEl.title = <表值>` / `nameText.textContent` / 参数区 `.textContent` / 标注 `.textContent`）；M4 断言三处接线区域零 HTML 模板拼接。**不扩大** TD-48-01 的既有缺口（`escapeHtml` 实测零 diff，仍挂账） |
| T-49-02-02 渲染端自行判定（第二套判定源） | mitigate | M4 断言三处接线区域不含 `seededNames` / 托管技能目录名 / `skills-builtin` 判定素材，也不含 `filePath` 匹配；徽标 / 短原因 / 标题一律查三张白名单表 |
| T-49-02-03 失败态原因码经 `details` 传递（恒 `{}`） | mitigate | `_manageSkillMeta` 两个出口各写一次（M2 计数 2）+ M2b 行为断言读后即删与投影形状；业务失败仍 throw |
| T-49-02-04 终态字段被合并分支丢弃 | mitigate | 合并分支**条件并入** `manageSkill`，M3 专门断言（含「条件」性，防被后续事件抹成 `undefined`） |
| T-49-02-05 重载链路形状漂移 | mitigate | `_buildManageSkillDecoration` 恰 1 处定义 + 2 处调用（M5）；M5b 行为断言键集合与取值逐字相等；不可还原的 `code` 省略键 |
| T-49-02-06 结果区泄露 `details` / 原始 JSON | mitigate | 结果区只渲染文本（对象取 `type === 'text'` 块、字符串原样）；M8 断言分支内零 JSON 序列化且不含 `details` |
| T-49-02-07 64 KiB 正文造成 DOM 爆炸 | mitigate | 正文**只**出现在默认折叠的折叠块内；参数区**剔除** `content`（M7）；卡片语境覆盖内层 `max-height: none`（M16）让卡片内容区成为唯一滚动容器 |
| T-49-02-08 头部换行 / 标注被裁切 | mitigate（**残余见 Issues #3**） | M15 断言 `.tool-card-header` 无 `flex-wrap`、标注无 `overflow` / `text-overflow`；M14 断言标注规格（nowrap + 11px）；短原因定长 ≤ 6 字（picker 套件断言） |
| T-49-02-09 第二份折叠实现 / 第二份徽标实现 | mitigate | M9 断言折叠块构建函数恰 1 处定义且 a11y 增量在同一函数内；徽标复用 `.slash-picker-source-badge*` 与 `TIER_BADGE`（M4 / M13） |
| T-49-02-10 复用面在 hover 态对比度不达标 | mitigate | 前置修复 ①② 落地（M12 / M13：`--skill-error-text` 两处、浅色 `--skill-limit-text` = #92400E、六条 `color-mix` 基准全部为 `var(--bg-secondary)`）；面板行（48 的既有面）同时生效 |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **49-03（文档与账本同步）可直接消费本计划的产出**：
  - 新增测试例数（供 `AGENTS.md` 测试清单与 `docs/product/ai-skills.md` §十一 登记）：`test-ai-skills.js` **172**（其中 `M 组` 16 例，M1–M16；`promptCtx` 夹具补 1 个 own property 不计数）；`test-skill-picker-model.js` **99**（新增 4 例白名单表断言）。
  - 新增的跨进程单源符号：`MANAGE_SKILL_ACTION_LABEL` / `MANAGE_SKILL_ACTION_NAME` / `MANAGE_SKILL_SHORT_REASON` / `STATUS_TEXT`（导出面）。
  - 新增样式符号：令牌 `--skill-error-text`、三条 `.tool-card-manage-note*` 规则、两处卡片语境覆盖、折叠块 header 焦点环；`index.html` 的 `main.css?v` 已推进到 9。
  - 本计划**未**触碰 `docs/product/ai-skills.md` 与 `AGENTS.md` 的归属行（按计划归 49-03）。
- **Phase 50（设置页技能管理区）可复用**：三张白名单表（经 `require('./src/skill-picker-model')`）、`_buildManageSkillDecoration` 的标记形状、以及 `.tool-card-manage-note*` 的标注视觉（若设置页需要同款原因码短标注）。
- **挂账未闭合项（计划明确不在本阶段）**：
  - **UI Considerations 的 1 条 backstop**（280px 最小宽的单行与可读性）需真实数据集视觉确认 ⇒ 路由 `human_needed`（coverage D7）。
  - **TD-48-01**（面板行 `escapeHtml` 不转义引号）/ **TD-48-02** / **WR-01** / **WR-02** / **WR-06** **逐字保持挂账**（TD-48-01 的 `escapeHtml` 与本计划新增面完全无关，实测零 diff；本阶段**未扩大**该缺口）。
  - 两条「不可判定即省略键」的刻意退化已入 WINDOWS（#28 `delete` 无徽标 / #29 重载无 `code`），供 verify-work 裁决。
  - **49 的阶段指纹将在本计划提交后 stale**，属预期（5 源文件 + 3 测试/页面文件），收尾时重算。

---

*Phase: 49-manage-skill-ai*
*Completed: 2026-09-13*

## Self-Check: PASSED

- 交付物文件全部在盘（`[ -f ]` 逐个命中）：`src/skill-picker-model.js` / `ai-manager.js` / `src/renderer.js` / `src/styles/main.css` / `src/index.html` / `ai-conversations-manager.js` / `tests/test-ai-skills.js` / `tests/test-skill-picker-model.js` / 本 SUMMARY
- 任务提交 `e33ce1f` / `9bffeed` / `aa90a9b` — FOUND（`git log --oneline --all` 三条均可命中）
- `plan_head_before` = `0ae16d933dd9d4edaee4572101ac70b91a57a679`（取自 `.git/gsd-plan-head-before-49-02` 台账）；`commits` = `git rev-list --count <base>..HEAD` = **3**（实测值，非叙述值）
- 计划级 `<verification>` 全项复跑通过：`node --check` ×3 通过；`test-skill-picker-model.js` **99/99**（`# fail 0`，≥ 95）；`test-ai-skills.js` **172/172**（`# fail 0`，≥ 166）
- 4 条计划自带 `<verify>` 判据中 1 条（Task 1 verify #1）与 3 条（Task 1 verify #3 / Task 2 verify #1 / Task 3 verify #1）需最小修正 —— 全部以「断言集逐条保留、不放宽任何判据」的方式执行通过，缺陷已入 `.planning/WINDOWS.md`（#25–#27）
- 「不动项」逐条实测零 diff：`agent-workspace.js` / `ai-skills-manager.js` / `builtin-skills-seeder.js` 三文件零 diff；`syncAgentSystemPrompt()` / `_flushDeferredSkillsPrompt()` / `_resolveSkillMarker` / `_decorateSkillUserMessage` / `renderAISkillPill` / `renderAIMessages` / `renderToolCards` / `renderSlashPickerList` / `buildUserMessageContent` / `escapeHtml` 的方法体**逐字节未变**（base vs HEAD 抽取比对）
- 全量回归：`tests/*.js` 22 个套件**全部 0 失败**且无一非零退出


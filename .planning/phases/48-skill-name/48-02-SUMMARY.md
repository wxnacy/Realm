---
phase: 48-skill-name
plan: "02"
subsystem: ui
tags: [electron, renderer, skill-picker, css, node-test, stale-while-revalidate]
requires:
  - phase: 46-prompt
    provides: "ai-skills-manager.js 技能集单一数据权威（refreshSkills / bySkillPriority / 遮蔽与限额标记在数据层就位）"
  - phase: 47-bash
    provides: "builtin-skills-seeder.getSeededSkillNames()（三档徽标 seeded 身份，经 48-01 注入到投影）"
  - phase: 48-skill-name
    provides: "48-01：src/skill-picker-model.js 双模式导出模块、SKILL_PREFIX/extractArgs/parseSkillRef/buildSkillSyntaxText、realmAPI.ai.getSkills/refreshSkills 两通道、state.aiSkills/aiSkillsDigest、skills:changed 监听与启动预热、四个技能相关 CSS 令牌"
provides:
  - "src/skill-picker-model.js：buildSelectableIndexes / nextSelectableIndex / filterPickerItems / buildPickerItems 四个面板纯函数 + TIER_BADGE 三档徽标唯一权威查表"
  - "src/renderer.js：state.slashPickerSelectable；renderSlashPickerList 重写为展平单数组 + 分组标题（不占索引）+ 行五要素 + 扁平索引直绑；executeActiveSlashCommand 按 kind 分流（技能行走 /skill:{name}[ args] → handleSendAIMessage）；handleAIInputKeydown 在可选中集合上取模；openSlashPicker 的 stale-while-revalidate 后台刷新"
  - "src/styles/main.css：.slash-picker-group-header（sticky + 显式背景）/ .slash-picker-source-badge（+ 三个白名单修饰类）/ .slash-picker-tag-explicit / .slash-picker-status（+ 两个 tone 类）/ .slash-picker-row-disabled；行布局增补 flex-wrap / flex-shrink / flex:1;min-width:0"
affects: ["48-03-read-card", "49-manage-skill", "50-settings", "51-import"]
actuals:
  tokens: 16717
  tasks: 3
  commits: 4
plan_head_before: fc188321e70f2689218d70fc010313ff323cb2be
tech-stack:
  added: []
  patterns:
    - "磁盘来源文本进 innerHTML 模板的统一纪律：全部插值经 escapeHtml()，枚举值（tier / statusTone）一律走冻结白名单查表，绝不把字段值拼进 class 字符串（T-48-07）"
    - "展平单数组 + 渲染层插标题 + 扁平索引直绑：数组顺序即视觉顺序，分组标题不占索引，点击/hover 按 data-index 直取（消除同名两行点错行）"
    - "可选中索引集合作为键盘取值域：activeIndex 收敛到最近可选中行，集合为空 → -1 并复用既有 false 回落路径（零新分支）"
    - "文案唯一权威收敛：四条行尾状态标注 + 三档徽标 label/title 住进 skill-picker-model.js，renderer 零硬编码（可被源码扫描断言）"
    - "stale-while-revalidate 单一触发点：快照同步渲染 → 后台刷新 → 广播只重拉快照；全局 refreshSkills 调用点数严格为 1（自激回路可断言）"
key-files:
  created: []
  modified:
    - src/skill-picker-model.js
    - src/renderer.js
    - src/styles/main.css
    - src/index.html
    - tests/test-skill-picker-model.js
    - tests/test-ai-skills.js
key-decisions:
  - "nextSelectableIndex 的「current 不在集合内」分支按「最近可选中行」取值（delta>0 取首个大于 current、delta<0 取末个小于 current，无则回绕另一端）—— 计划 <action> 写的「按方向取集合首/尾」与 <behavior> 的 nextSelectableIndex([0,2],1,1) → 2 冲突，取 behavior（可失败判据）为准，且它才符合 UI-SPEC「ArrowDown 向后、ArrowUp 向前」的语义"
  - "面板行的 title 属性按 tone 归类：limit → 「未进入模型提示词，但仍可手动调用（/skill:名字）」；muted → 「本行不可调用；/skill:名字 作用于胜出的用户技能」（UI-SPEC 未给「与本地命令同名」单独 title，按 tone 复用遮蔽那条，不新造文案）"
  - "openSlashPicker 的刷新回调采用 ai:refresh-skills 的返回值（{skills,digest}）就地覆盖 state.aiSkills 后再重渲染 —— 只调 renderSlashPickerList() 而不落投影会让 stale-while-revalidate 的「revalidate」半边成为空操作"
  - "「仅显式」与三档 label 的计数断言限定在徽标/标记渲染上下文（renderSlashPickerList 函数体）：renderer.js 全文件在 48-01 已有一处「仅显式」提及、且『用户』是该文件高频汉语词 —— 全文件零命中断言不可满足（计划 acceptance 亦如此要求）"
  - "48-01 遗留的 renderer 全域零 `.refreshSkills(` 断言收敛为「广播处理器内零命中 + 全局唯一调用点必须在 openSlashPicker」——48-02 的 D-17 刷新半边要求 renderer 必须有一处合法调用点，原全域断言与计划 Task 3 直接冲突"
  - "空态行沿用 .slash-picker-row 骨架 + 新增 .slash-picker-row-empty（cursor: default），不引入 heading/body 两段（UI-SPEC Copywriting 明文）"
patterns-established:
  - "枚举→class 的白名单查表纪律（TIER_BADGE / SLASH_STATUS_TONE_CLASS 均为冻结对象，渲染侧只查表不拼串）"
  - "面板文案单源：数据侧（skill-picker-model.js）拥有状态标注与徽标文案，渲染侧只消费 —— 用源码扫描断言「renderer 零硬编码」可长期守住"
  - "导航取值域与视觉可选中性同源：state.slashPickerSelectable 既驱动 ↑↓ 取模，也驱动 active 收敛，灰显行天然不可达"
requirements-completed: [DISC-01, DISC-04, DISC-07]
coverage:
  - id: D1
    description: "输入 `/` 时面板同屏列出技能分区与命令分区（技能在上）；name 前缀命中在前、description 子串命中在后两档过滤；`/skill:<q>` 按前缀长度剥离后过滤技能分区而命令分区用原 token；某分区 0 项时其标题整个不输出；state.slashPickerItems 保持展平单数组且数组顺序 === 视觉渲染顺序"
    requirement: DISC-01
    verification:
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · 展平与分区计数（D-01 单数组不变式）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · 过滤两档（name 前缀命中在前 / description 子串命中在后）（D-03）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · 面板五要素行与转义护栏（T-48-07）／分组标题空分区不输出 + 不占索引"
        status: pass
    human_judgment: false
  - id: D2
    description: "行五要素（`/{name}` + 三档来源徽标 + `仅显式` 标记 + 单行截断描述 + 行尾状态标注）；disabled 技能面板隐藏；shadowed 与「与本地命令同名」的技能渲染但灰显不可选中并带对应行尾标注；overLimit / promptOmitted 渲染且可选中并带行尾标注；三档徽标经 TIER_BADGE 白名单查表取 label/className/title"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · selectable 判定与状态标注优先级（D-11 / D-12 / D-04 推导）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · TIER_BADGE 三档徽标唯一权威查表（D-14 消费方）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · 面板五要素行与转义护栏／样式契约（sticky + 显式背景、灰显不参与高亮、四令牌只消费）"
        status: pass
    human_judgment: false
  - id: D3
    description: "键盘 ↑↓ 跨分区连续且跳过不可选中行（全部不可选中 → activeIndex = -1，Enter 回落既有 executeActiveSlashCommand() 返回 false 的路径）；Enter 执行高亮行：技能行组装完整语法文本 /skill:{name}[ args] 交 handleSendAIMessage（不调 handler、不拼增强文本），命令行走既有 cmd.handler(rest)；面板行点击与 hover 按扁平索引直绑（同名两行各自执行正确分支）"
    requirement: DISC-01
    verification:
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · 导航取模只在可选中集合上（UI-SPEC 由 D-11 推导）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · 面板接线源码扫描／renderSlashPickerList 扁平索引直绑 + executeActiveSlashCommand kind 分流 + handleAIInputKeydown 可选中集合"
        status: pass
    human_judgment: false
  - id: D4
    description: "args 取值改用 token 取值法（extractArgs）：`/skill:fin 帮我找 X`、`/fin 帮我找 X`、`/cle x`、`/compact 重点保留登录` 均取到正确 args，按名长切片的旧形态（1 + cmd.name.length）从 renderer 消失"
    requirement: DISC-01
    verification:
      - kind: unit
        ref: "tests/test-skill-picker-model.js#A 组 · extractArgs —— token 取值法（事实 2 七组表逐行）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#B 组 · 面板接线源码扫描／executeActiveSlashCommand args 走 extractArgs"
        status: pass
    human_judgment: false
  - id: D5
    description: "面板 stale-while-revalidate：打开瞬间用内存快照渲染（无 loading 态）→ 后台 ai.refreshSkills 完成后原地重渲染（不关面板、不清输入框）→ 失败一律 catch 保留旧快照且面板内零错误 UI；skills:changed 广播只重拉快照并 digest 早退；renderer 侧 refreshSkills 调用点全局唯一（自激回路关闭）；四个新 CSS 类随 styles/main.css?v=7 生效"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#G 组 · 面板刷新链路与跨文件护栏（D-17 / P-48-06，源码扫描）"
        status: pass
      - kind: unit
        ref: "tests/test-skill-picker-model.js#C 组 · renderer 源码护栏／skills:changed 监听只重拉快照、刷新调用点唯一"
        status: pass
      - kind: unit
        ref: "node -e guards-ok（限额字面量 0 / localeCompare 0 / 本地 HTTP 端点 0 / 广播窗口无 refreshSkills）"
        status: pass
    human_judgment: false
  - id: D6
    description: "50+ 技能数据集下 220px 面板的观感：分组标题 sticky 常驻、行五要素可读、行尾标注 flex-wrap 后无一截断（本阶段唯一 backstop）"
    verification: []
    human_judgment: true
    rationale: "视觉观感无法自动化裁决（48-VALIDATION.md §Manual-Only Verifications 明文）。脚本：向 agent-workspace/skills/ 生成 50 个最小技能后 npm run dev 打开面板；若不可接受，只允许调面板高度常量，不得改动分组 / 标注结构。已记入 .planning/WINDOWS.md 的 unrun-verify 条目。"
  - id: D7
    description: "真实 Electron 环境端到端：输入 `/` 见两分区与三档徽标 → 输入 /fin 过滤出技能 → Enter 调用 → 气泡出现技能 pill 与折叠块；灰显行回车不执行、不关面板"
    verification: []
    human_judgment: true
    rationale: "面板视觉（sticky 标题观感、徽标对比度、行尾标注换行）与真实运行时链路（IPC 往返 + 主进程重扫 + 广播）需在 dev/debug 环境实机确认，node:test 只能覆盖纯逻辑与源码接线。"
duration: 7min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 02: `/` 面板并入技能列表（分区 / 五要素 / 键盘导航 / stale-while-revalidate） Summary

**面板成为技能与本地命令的同屏发现面：展平单数组渲染 + 两个 sticky 分区标题、行五要素（名称 / 三档来源徽标 / `仅显式` / 截断描述 / 行尾标注）、↑↓ 跳过灰显不可选中行、技能行组装 `/skill:{name} args` 走既定发送链路、打开即快照渲染 + 后台刷新（失败保留旧快照）、args 不再吞字符。**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-12T05:18:11Z
- **Completed:** 2026-09-12T05:25:32Z
- **Tasks:** 3 / 3
- **Files modified:** 6（新增 0，修改 6）

## Accomplishments

- **面板纯逻辑模型**：`src/skill-picker-model.js` 新增 `buildSelectableIndexes` / `nextSelectableIndex` / `filterPickerItems` / `buildPickerItems` 与 `TIER_BADGE`，全部挂进 48-01 的**同一个 `api` 对象**（单一 IIFE、单一导出，`require()` 与 `window.SkillPickerModel` 同引用）。四条行尾状态标注与三档徽标文案收敛进该模块，renderer 零硬编码（源码扫描可断言）。
- **展平单数组 + 分区标题**：`renderSlashPickerList` 重写为「技能分区在前、命令分区在后」的展平数组顺序，分组标题只在渲染层插入、**不占索引**，空分区标题整个不输出；点击与 hover 改**扁平索引直绑**（`data-index`），废除按名字反查 —— 同名两行（技能名 = 本地命令名）不再点错行（P-48-04）。
- **行五要素与三档徽标**：`/{name}` → `.slash-picker-source-badge`（三档白名单 class，`color-mix` 15% 底 / 30% 边）→ `.slash-picker-tag-explicit`（仅 `disableModelInvocation === true`，中性色）→ `.slash-picker-desc` 单行截断 → `.slash-picker-status`（`margin-left:auto` + nowrap，宽度不足由 `flex-wrap` 换第二行右对齐，永不截断）。灰显行 `opacity: .6` 且不参与 hover / active 高亮。
- **T-48-07 缓解落地**：面板 `innerHTML` 模板内**全部**磁盘来源插值（`name` / `description` / 行尾标注 / 行 `title`）经 `escapeHtml()`；`tier` → class 与 `statusTone` → class 均走冻结白名单查表，值不参与字符串拼接（断言方式：剥掉 `escapeHtml(...)` 后模板内不得残留任何 `item.*` / `badge.*` 插值）。
- **键盘导航取值域收敛**：`state.slashPickerSelectable` 同时驱动 ↑↓ 取模与 `activeIndex` 收敛；全部不可选中 → `-1` 后直接 `return`（Esc / Enter 分支逐字节未变，Enter 自然回落既有 `executeActiveSlashCommand() === false` 路径）。
- **执行分流与 args 修复**：`executeActiveSlashCommand` 按 `kind` 分流 —— 命令行走既有 `cmd.handler(rest)`（清空输入框语义零变化）；技能行**不调 handler**，把输入框置为 `buildSkillSyntaxText(name, rest)` 后交 `handleSendAIMessage()`（D-19，技能正文不进 `message`）。args 改用 `extractArgs`（token 取值法），事实 2 的七组输入全部取到正确值，`1 + cmd.name.length` 的切片形态从 renderer 消失（P-48-01 修复）。
- **stale-while-revalidate**：`openSlashPicker` 四步顺序不变（快照同步渲染，零延迟、无 loading 态），随后一次 fire-and-forget `ai.refreshSkills()`，成功后把返回投影落回 `state.aiSkills` 就地重渲染；失败 `catch` 保留旧快照、面板内零错误 UI。`skills:changed` 仍只重拉快照（digest 早退），renderer 侧 `refreshSkills` 调用点全局**唯一**。
- **测试面**：`tests/test-skill-picker-model.js` 48 → 93 例；`tests/test-ai-skills.js` 108 → 113 例（新增 G 组 5 例）。全仓 19 个测试文件 584 例 `# fail 0`（`test-builtin-skills-seeder.js` 走直跑形式 101/0，见 VALIDATION 的豁免口径）。

## Task Commits

Each task was committed atomically（Task 1 为 TDD tracer，携带 test → feat）：

1. **Task 1 (tracer) RED: 面板纯逻辑模型 B 组断言** - `33f8c9b` (test)
2. **Task 1 (tracer) GREEN: 面板纯逻辑模型 + 展平单数组渲染与执行分流** - `a807c84` (feat)
3. **Task 2: 面板行五要素 + 灰显不可选中 + 分区标题 + slash-picker 样式** - `7ef1d95` (feat)
4. **Task 3: 键盘导航跳过不可选中行 + stale-while-revalidate 刷新链路 + 护栏断言** - `c97f335` (feat)

**Plan metadata:** 见最后的 `docs(48-02)` 提交（含 SUMMARY / STATE / ROADMAP / REQUIREMENTS）

## Files Created/Modified

- `src/skill-picker-model.js` — 四个面板纯函数 + `TIER_BADGE` + `STATUS_TEXT`；`api` 对象扩容（同一 IIFE / 同一导出语句）
- `src/renderer.js` — `state.slashPickerSelectable`；`SLASH_STATUS_TONE_CLASS` / `SLASH_STATUS_TITLE`；`renderSlashPickerList` 重写；`executeActiveSlashCommand` kind 分流 + `extractArgs`；`handleAIInputKeydown` 可选中集合取模；`openSlashPicker` 后台刷新
- `src/styles/main.css` — `.slash-picker-group-header` / `.slash-picker-source-badge`（+3 白名单类）/ `.slash-picker-tag-explicit` / `.slash-picker-status`（+2 tone 类）/ `.slash-picker-row-disabled` / `.slash-picker-row-empty`；`.slash-picker-row` 加 `flex-wrap`、`.slash-picker-name` 加 `flex-shrink:0`、`.slash-picker-desc` 加 `flex:1; min-width:0`；hover/active 限定在非灰显行
- `src/index.html` — `styles/main.css?v=6` → `?v=7`（缓存失效约定）
- `tests/test-skill-picker-model.js` — B 组（展平/过滤两档/命令对照/`/skill:` token/selectable/状态优先级/导航取模/徽标表/渲染与转义护栏/样式契约）+ 接线扫描；48-01 的 `.refreshSkills(` 全域零命中断言收敛
- `tests/test-ai-skills.js` — 新增 G 组（刷新链路 / 广播无自激 / 三文件限额字面量 0 / `localeCompare` 0 / 本地 HTTP 端点 0）

## Decisions Made

1. **`nextSelectableIndex` 的越界分支按「最近可选中行」取值** —— 计划 `<action>` 写「按 delta 方向取集合首/尾」，`<behavior>`/测试写 `nextSelectableIndex([0,2],1,1) → 2`。取 `<behavior>`（可失败判据）为准：`delta>0` 取首个大于 `current` 的索引、`delta<0` 取末个小于 `current` 的索引，该方向无元素则回绕另一端。这也是 UI-SPEC「ArrowDown 向后、ArrowUp 向前落最近可选中行」的唯一自洽读法。
2. **面板行 `title` 按 tone 归类** —— limit → 「未进入模型提示词，但仍可手动调用（/skill:名字）」；muted → 「本行不可调用；/skill:名字 作用于胜出的用户技能」。UI-SPEC 未给「与本地命令同名」单独文案，按 tone 复用遮蔽那条，**不新造**用户可见文案。
3. **刷新回调落投影再重渲染** —— `ai:refresh-skills` 返回 `{skills, refreshedAt, digest}`；只调 `renderSlashPickerList()` 而不覆盖 `state.aiSkills` 会让 revalidate 半边成为空操作，故回调内先落投影再渲染（面板关闭时早退）。
4. **文案计数断言限定在渲染上下文** —— 「仅显式」在 renderer.js 全文件已有 48-01 的一处提及、`用户` 是该文件高频汉语词，故计数断言收敛到 `renderSlashPickerList` 函数体（计划 acceptance 亦如此要求）。
5. **空态沿用行骨架** —— 新增 `.slash-picker-row-empty`（`cursor: default`），仍为单行提示条，不引入 heading/body 两段（UI-SPEC Copywriting）。
6. **只消费 48-01 的四个令牌** —— 新增 CSS 只引用 `--skill-source-user/builtin/managed` 与 `--skill-limit-text`，不新增第 5 个令牌、不改既有取值（断言：`--skill-*` 声明集合恰为四个）。

## Deviations from Plan

### Auto-fixed / 规格裁决

**1. [规格冲突裁决] 48-01 的「renderer 全域零 `.refreshSkills(`」断言与 Task 3 直接冲突**
- **Found during:** Task 3（stale-while-revalidate 刷新链路）
- **Issue:** `tests/test-skill-picker-model.js` 在 48-01 落了 `assert.strictEqual(rendererSrc.includes('.refreshSkills('), false, 'renderer 绝不触发主进程重扫')`（文件全域）。而本计划 Task 3 明确规定 `openSlashPicker` 必须调 `window.realmAPI.ai.refreshSkills()` —— 两条要求互斥，任何实现都无法同时满足。
- **Fix:** 按计划 Task 3 的 acceptance（「`onIpcMessage('skills:changed'` 的**处理器体内**不出现 `refreshSkills`」）把断言收敛为**两段**：① 广播处理器窗口内零命中（自激回路判据保留）；② renderer 全局 `refreshSkills` 调用点数 `strictEqual 1` 且该唯一调用点必须在 `openSlashPicker`（D-17 刷新半边有且只有一处）。原断言的**意图**（禁止广播触发重扫）被更强地保留，同时不再与合法调用点冲突。
- **Files modified:** `tests/test-skill-picker-model.js`
- **Verification:** `node --test tests/test-skill-picker-model.js` 93/0；`guards-ok`（广播 420 字符窗口 `refreshSkills` 0 命中）
- **Committed in:** `c97f335`（Task 3）

**2. [规格冲突裁决] `<action>` 与 `<behavior>` 对 `nextSelectableIndex` 越界分支的描述相反**
- **Found during:** Task 1（tracer，先写 RED 测试）
- **Issue:** `<action>` ③ 写「`selectable.indexOf(current) < 0` 时按 `delta` 方向取集合**首**（delta>0）或**尾**（delta<0）」，`<behavior>` 与 RESEARCH §1.5 的骨架示例写「取集合首」（即对 `current=1`、集合 `[0,2]` 返回 `0`）；但同一条 `<behavior>` 的第四行明确写 `nextSelectableIndex([0,2], 1, 1)` → **`2`**。三条描述两两冲突。
- **Fix:** 以 `<behavior>` 的可失败判据为准（它是测试要断言的可执行契约），实现「按方向取最近可选中行」：`delta>0` → 首个大于 `current`；`delta<0` → 末个小于 `current`；该方向无元素 → 回绕另一端。该读法同时满足 UI-SPEC「最近的可选中行（ArrowDown 向后、ArrowUp 向前）」与「`[-1]` 起点向前取末项」的直觉。
- **Files modified:** `src/skill-picker-model.js`、`tests/test-skill-picker-model.js`
- **Verification:** `B 组 · 导航取模只在可选中集合上` 的 5 条（含 `[0,2],1,1 → 2`、`[0,2],1,-1 → 0`、`[-1]` 起点两个方向、越界回绕、长度 1 自指）+ 密集集合跨灰显行 6 例全绿
- **Committed in:** `a807c84`（Task 1 GREEN）

**3. [Scope 微增] Task 2 的 acceptance 要求「断言」，但其 `<files>` 未列测试文件**
- **Found during:** Task 2（五要素行 + 样式）
- **Issue:** Task 2 的 `<acceptance_criteria>` 通篇是「断言 …」，但 `<files>` 只有 `src/renderer.js` / `src/index.html` / `src/styles/main.css`，没有测试宿主；`<verify>` 只有三段一次性 `node -e`。
- **Fix:** 在 `tests/test-skill-picker-model.js` 追加「B 组 · 面板五要素行与转义护栏（T-48-07）」10 条断言，把 acceptance 的每一条落成可长期回归的源码扫描（五要素顺序 / 空分区标题不输出且不占索引 / 剥掉 escapeHtml 后模板零残留插值 / tier 白名单查表 / `仅显式` gating / 空态原文 / sticky 前提与 `max-height` 零改动 / 行布局与灰显高亮 / `?v=` 序号 / 四令牌只消费不新增）。测试文件本就在本计划的 `files_modified` 内，不引入新宿主。
- **Files modified:** `tests/test-skill-picker-model.js`
- **Verification:** `node --test tests/test-skill-picker-model.js` 89 → 93 例全绿
- **Committed in:** `7ef1d95`（Task 2）

**4. [Rule 1 - Bug] 注释里的字面量会击穿「唯一权威」计数断言**
- **Found during:** Task 2
- **Issue:** 我在 `renderSlashPickerList` 的 JSDoc 与行内注释里写了「`仅显式` 标记」，使 renderer 中该字面量计数变为 4（含 48-01 既有的一处），「渲染层恰出现一次」的断言无法成立；同理 `realmAPI.ai.refreshSkills()` 出现在 openSlashPicker 的 JSDoc 里会让 `\.refreshSkills\(` 计数变 2，击穿「调用点唯一」断言。
- **Fix:** 注释改用 `explicit-only 标记` / 「`realmAPI.ai` 的 refreshSkills 无载荷 invoke」等不占用文案字面量的写法；文案与调用只保留在代码位点上。
- **Files modified:** `src/renderer.js`
- **Verification:** `node --test tests/test-skill-picker-model.js tests/test-ai-skills.js` 206/0；`guards-ok`
- **Committed in:** `7ef1d95`（Task 2 的注释）、`c97f335`（Task 3 的注释）

---

**Total deviations:** 4（1 bug 修正 + 3 规格裁决/落点裁决；无功能回退、无 scope creep）
**Impact on plan:** 两项规格裁决都发生在计划内部**自相矛盾**的文本上，且均以 `<behavior>` / acceptance 的可失败判据为准，交付语义不变；第 3 项只是把 acceptance 的「断言」要求落进本计划已声明的测试文件；第 4 项是实现过程中的自检修正。

## Issues Encountered

- **分支策略说明**：本仓库的既有工作流（v1.0 起 57+ 个计划、含本阶段 48-01）全部直接提交在 `master` 上；`gsd-tools query git.base-branch --is-protected master` 返回 `true`，`.planning/config.json` 未设 `git.allow_default_branch_commits`。本次按 orchestrator 的指令（「SEQUENTIAL run on the main working tree，用正常 git 提交」）沿用既有一致做法 —— **未**强制改写受保护分支、**未**使用 `--no-verify`。若后续要改为分支隔离，应在 `/gsd-execute-phase` 层统一配置而非在单个执行器内自行改道。
- **`tests/test-builtin-skills-seeder.js` 的一条既有环境断言**（48-01 已记入 `deferred-items.md` D-48-A）在 `node --test` 嵌套形式下仍红，故按 `48-VALIDATION.md` 的豁免口径用**直跑形式** `node tests/test-builtin-skills-seeder.js` → 101/0。未在本计划修复（scope boundary）。
- **`<human-check>` backstop 未执行**：50+ 技能数据集下的 220px 面板观感需真实 GUI 与 `npm run dev`，属 end-of-phase 人工项（见 coverage D6/D7），已同时记入 `.planning/WINDOWS.md` 的 `unrun-verify` 条目，路由 `human_needed` —— 未静默通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 48-03（`read` 卡片技能化）可直接消费：`window.SkillPickerModel.TIER_BADGE`（三档 `label` / `className` / `title` 的唯一权威查表 —— 契约要求卡片徽标与面板徽标共用同一实现，`.slash-picker-source-badge` 类与三个白名单修饰类已在 `main.css` 就位）、`aiSkills.matchSkillByPath`、`getConversationMessages` 的装饰落点。
- 后续阶段的约束提示：`docs/product/ai-skills.md` 的「发现与调用」章节归 **48-03**（含实时读盘口径 / 边界技能行为表 / 三档徽标 seeded 判定来源 / 测试清单与 `AGENTS.md` 维护约定），本计划未改文档。
- `renderer` 侧护栏新增两条可复用判据：**文案字面量单源**（状态标注与徽标文案在 `skill-picker-model.js` 各恰一次、renderer 对应上下文零命中）与**调用点唯一**（`\.refreshSkills\(` 全局计数 1），后续阶段改动面板时若破坏它们会立即变红。
- P8 门禁口径不变：48 只闭合**读侧**调用方（`refreshSkillsForPanel` → `syncAgentSystemPrompt`），「写成功后回写」仍归 49/50/51。

---
*Phase: 48-skill-name*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: src/skill-picker-model.js
- FOUND: src/renderer.js
- FOUND: src/styles/main.css
- FOUND: src/index.html
- FOUND: tests/test-skill-picker-model.js
- FOUND: tests/test-ai-skills.js
- FOUND: .planning/phases/48-skill-name/48-02-SUMMARY.md
- FOUND: 33f8c9b（Task 1 RED）
- FOUND: a807c84（Task 1 GREEN）
- FOUND: 7ef1d95（Task 2）
- FOUND: c97f335（Task 3）
- Plan verification: `node --test tests/test-skill-picker-model.js tests/test-ai-skills.js` → `# tests 206 / # pass 206 / # fail 0`；`node tests/test-builtin-skills-seeder.js`（直跑形式）→ `# tests 101 / # pass 101 / # fail 0`
- Task verifies: `model-ok` / `script-order-ok` / `css-panel-ok` / `render-five-ok` / `sticky-ok` / `nav-refresh-ok` / `guards-ok` 全通过
- 全仓回归：19 个测试文件 584 例 `# fail 0`

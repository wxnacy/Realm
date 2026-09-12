---
phase: 48-skill-name
plan: "03"
subsystem: ai
tags: [electron, pi-agent-core, ai-manager, skill-card, tool-execution, docs, node-test]
requires:
  - phase: 46-prompt
    provides: "ai-skills-manager.js 技能集单一数据权威（_cache.skills / refreshSkills / bySkillPriority）与 REALM_SYSTEM_PROMPT 的技能段边界"
  - phase: 47-bash
    provides: "builtin-skills-seeder.getSeededSkillNames() —— 三档 tier 的 seeded 身份来源"
  - phase: 48-skill-name
    provides: "48-01：matchSkillByPath(abs, seededNames)、getSkillsForUI 投影、getSeededSkillNamesSafe()、.tool-card 系列存量规则；48-02：TIER_BADGE 三档徽标唯一权威查表与 .slash-picker-source-badge 类"
provides:
  - "ai-manager.js：_resolveSkillMarker(toolName, args) 私方法（同步、零 IO；read 路径标记的唯一判定实现，实时链路与重载链路共用）"
  - "ai-manager.js：tool_execution_start 事件的 skill_invocation 字段（{name,tier} | null），params 逐字未变"
  - "ai-manager.js：getConversationMessages 对 assistant 行 toolExecutions 的标记重建（try/catch 容错，不丢消息）"
  - "src/renderer.js：toolExecution.skillInvocation 流式映射 + renderToolCard 技能变体（「使用技能「name」」+ TIER_BADGE 徽标，全 DOM API + textContent）"
  - "src/styles/main.css：.tool-card-name-skill / .tool-card-name-text 两个新类；src/index.html 的 styles/main.css?v= 推进到 8（与 CSS 改动同提交）"
  - "docs/product/ai-skills.md：新增第十节「发现与调用」（七小节）+ §六 三条已知限制 + §七 面板纯逻辑测试命令"
  - "AGENTS.md：测试清单追加 tests/test-skill-picker-model.js + 「技能发现与调用」维护约定"
affects: ["49-manage-skill", "50-settings", "51-import"]
actuals:
  tokens: 11380
  tasks: 3
  commits: 4
plan_head_before: 89c6f9f36ad2b08d3f550adda95e99e4d765a67e
tech-stack:
  added: []
  patterns:
    - "技能标记判定收敛到工具事件生成侧：renderer 零路径字符串匹配（它拿不到技能目录权威路径，按字符串猜就是第二份判定实现）"
    - "一处实现、两处调用：实时链路（tool_execution_start）与重载链路（getConversationMessages）共用 _resolveSkillMarker，产出形状逐字一致"
    - "枚举 → class/label/title 的白名单查表纪律在 read 卡片上复用 48-02 的 TIER_BADGE，不存在第二份徽标实现"
    - "磁盘来源文本进 DOM 一律 textContent；技能名不参与任何 class 字符串拼接（T-48-10 缓解）"
    - "存储层保持只懂存储：技能域知识不下沉 ai-conversations-manager.js，标记只在装饰层重建"
key-files:
  created: []
  modified:
    - ai-manager.js
    - src/renderer.js
    - src/index.html
    - src/styles/main.css
    - tests/test-ai-skills.js
    - docs/product/ai-skills.md
    - AGENTS.md
key-decisions:
  - "`_resolveSkillMarker` 的路径归一化采用**纯词法** `path.resolve`（与 SDK `env.absolutePath` 同规则），不额外展开 `~` / `file://` —— 那类路径解析后落在工作区外，标 null 与沙箱拒绝行为一致，不引入第二套解析"
  - "命中判定只走 48-01 的 `matchSkillByPath`（与缓存 `filePath` 规范化全等 + basename 必须为 `SKILL.md`），不按目录前缀猜、不重新扫盘；因此技能目录下的 `references/*.md` 不算「使用技能」"
  - "标记必须在 `tool_execution_start` 一次性给出 —— `tool_execution_end` 不带 `params`，错过 start 没有第二次机会；renderer 更新分支的 `...spread` 会自然保留该字段"
  - "`skill_invocation` 缺失 / 非法一律 null 并渲染普通 `read` 卡片（接口契约：零回归），不为技能化新增 system-note / 卡片形状 / 图标"
  - "第十节文档写「行为」不写「字段」：边界行为表用中文状态名（`超数量上限` / `未进提示词 · 超预算`），不出现 `overLimit` / `promptOmitted` 字段名"
  - "文档的边界行为表按 48-RESEARCH §2.8 八行矩阵去掉实现列；`disable-model-invocation` 与「已禁用」显式写成两个互不蕴含的 flag"
patterns-established:
  - "工具事件的技能标记：主进程同步判定 + 事件字段携带 + renderer 只消费 —— 零 path 字符串匹配可用源码扫描长期守住"
  - "重载一致性可用「对象键集合逐字相等」断言（实时 vs 重载），比分别断言两侧形状更难被绕过"
  - "产品文档的行为表与实现字段解耦：表讲状态与可达性，字段名只留在代码与测试里"
requirements-completed: [DISC-05]
coverage:
  - id: D1
    description: "模型经 `read` 打开技能目录下 `SKILL.md` 时，`tool_execution_start` 事件带 `skill_invocation = {name,tier}`；非 `read` 工具 / 缺 `path` / `path` 非字符串 / basename 非 `SKILL.md` / 工作区外路径 / `sandboxEnv` 为 null 一律 null 且不抛错"
    requirement: DISC-05
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#H 组 · _resolveSkillMarker：绝对命中 / 相对命中 / 非 SKILL.md 不命中 / 工作区外不命中"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#H 组 · _resolveSkillMarker 四条负例：非 read / 缺 args / path 非字符串 / sandboxEnv 为 null"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#H 组 · 源码：tool_execution_start 分支带 skill_invocation 且 params 逐字未变"
        status: pass
    human_judgment: false
  - id: D2
    description: "renderer 把事件 snake_case 落到 `toolExecution.skillInvocation`；`renderToolCard` 技能变体标题为「使用技能「name」」并带 TIER_BADGE 白名单徽标；技能名与徽标一律 DOM API + textContent；技能化只经两个新类承载，`.tool-card` 系列既有规则零改动；CSS 序号与改动同提交"
    requirement: DISC-05
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#H 组 · 源码：renderer 流式映射把事件 snake_case 落到 toolExecution.skillInvocation"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#H 组 · 源码：renderToolCard 技能变体（文案 / 修饰类 / 白名单徽标 / textContent / 零路径匹配）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#H 组 · 样式：技能变体只经两个新类承载，.tool-card 系列既有规则零改动／.tool-card-name-skill 的 gap 与 .tool-card-name-text 的截断四件套"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#H 组 · 缓存失效：本阶段最后一次 CSS 改动已推进 index.html 的 styles/main.css?v= 序号"
        status: pass
    human_judgment: false
  - id: D3
    description: "重开对话后 assistant 行的 `toolExecutions` 由同一实现重建 `skillInvocation`，形状与实时链路逐字相等；技能删除后静默不挂键且消息条数 / params / status 未变；判定抛错时仍返回完整消息数组（不丢消息）；存储层零 `skillInvocation`"
    requirement: DISC-05
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#I 组 · 重载链路与实时链路的 skillInvocation 形状逐字相等（同一判定）"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#I 组 · 技能删除 / 缓存复位后不挂键，且消息条数 / params / status 逐字未变"
        status: pass
      - kind: unit
        ref: "tests/test-ai-skills.js#I 组 · 容错：判定抛错时仍返回完整消息数组（不丢消息、不抛错）／源码：技能域知识未下沉到存储层"
        status: pass
    human_judgment: false
  - id: D4
    description: "产品文档与实现同步：`docs/product/ai-skills.md` 新增第十节「发现与调用」（面板形态 / 两种语法与本地命令优先 / 实时读盘口径 / 八行边界行为表 / 三档来源徽标 / read 卡片技能化 / 诚实边界），§六 补三条已知限制，§七 补面板纯逻辑测试命令；`AGENTS.md` 测试清单与维护约定指向该章节；文档内不出现未实现能力的表述"
    requirement: DISC-05
    verification:
      - kind: unit
        ref: "docs 13 关键词命中 + deferred 能力正则零命中（node -e 断言 doc-ok）"
        status: pass
      - kind: unit
        ref: "既有测试命令逐字保留 + 新增命令存在 + AGENTS.md 两处更新（node -e 断言 sync-ok）"
        status: pass
      - kind: unit
        ref: "边界表 8 行且不含实现字段名（node -e 行数/字段名断言）"
        status: pass
    human_judgment: false
  - id: D5
    description: "真实 Electron 端到端：问一个命中技能 description 的任务，卡片标题变「使用技能「…」」并带徽标；切换对话再切回标记仍在；问「你有哪些技能」模型能区分技能与工具（D-18）"
    requirement: DISC-05
    verification: []
    human_judgment: true
    rationale: "自动化只覆盖源码契约与纯函数行为；「模型是否真的凭 description 匹配」「卡片在真实渲染管线中的观感」「切换对话后标记的持久性」需要人在运行中的 Electron 应用里观察，无法由 node --test 断言。已记入 .planning/WINDOWS.md 的 unrun-verify 条目，不静默通过。"
# Metrics
duration: 21min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 03: 自动匹配技能的可见性 + 文档收口 Summary

**模型 `read` 技能正文时工具卡片标识为「使用技能「name」」并带来源徽标，重开对话按同一判据重建标记；「发现与调用」产品说明成文**

## Performance

- **Duration:** ~21 min（05:12Z → 06:33Z，含 429 中断后的主会话接管）
- **Started:** 2026-09-12T05:12:00Z（首提交 071dccb 于 13:12 +08:00）
- **Completed:** 2026-09-12T06:33:00Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- **`read` 卡片技能化**：`ai-manager._resolveSkillMarker(toolName, args)`（同步、零 IO）成为技能标记的**唯一判定实现**；`tool_execution_start` 事件新增 `skill_invocation`（`params` 逐字未变）。
- **一处实现、两处调用**：实时链路（事件字段）与重载链路（`getConversationMessages` 装饰 assistant 行 `toolExecutions`）共用同一判定，产出对象形状**逐字相等**；技能删除后两条链路都静默退化为普通卡片且**不丢消息**。
- **渲染侧零路径匹配**：`renderToolCard` 只消费 `skillInvocation`，标题 `使用技能「name」` + `TIER_BADGE` 白名单徽标（与面板共用同一张表），全部 DOM API + `textContent`，不新增卡片形状 / system-note。
- **文档收口**：`docs/product/ai-skills.md` 新增第十节「发现与调用」（面板形态 / 两种语法与本地命令优先 / 实时读盘口径 / 八行边界行为表 / 三档来源徽标 / `read` 卡片技能化 / 诚实边界），§六 补三条已知限制、§七 补面板纯逻辑测试命令；`AGENTS.md` 的测试清单与维护约定同步。

## Task Commits

Each task was committed atomically:

1. **Task 1: 端到端「模型 read 技能正文 → 卡片显示使用技能」** - `071dccb` (test, RED) → `2d59c5b` (feat, GREEN)
2. **Task 2: 重载路径标记重建 —— 同一判据两处调用** - `80318a4` (feat)
3. **Task 3: 文档同步 —— 「发现与调用」章节 + 已知限制 + 测试清单** - `bb61fcb` (docs)

_Note: Task 1 是 `type="tracer" tdd="true"` 任务，按 RED → GREEN 两段提交。_

## Files Created/Modified

- `ai-manager.js` — `_resolveSkillMarker` 私方法、`tool_execution_start` 的 `skill_invocation` 字段、`getConversationMessages` 的 assistant 行标记重建
- `src/renderer.js` — 流式映射落 `toolExecution.skillInvocation`；`renderToolCard` 技能变体（标题 / 修饰类 / 徽标）
- `src/styles/main.css` — `.tool-card-name-skill`、`.tool-card-name-text`
- `src/index.html` — `styles/main.css?v=8`（与 CSS 改动同提交）
- `tests/test-ai-skills.js` — H 组（read 卡片技能化）+ I 组（重载链路标记重建），共 15 条新断言
- `docs/product/ai-skills.md` — 第十节「发现与调用」+ §六 三条 + §七 一条
- `AGENTS.md` — 测试清单新增一行 + 「技能发现与调用」维护约定

## Decisions Made

- **路径归一化纯词法**：`path.resolve`（与 SDK `env.absolutePath` 同规则），不额外展开 `~` / `file://` —— 那类路径解析后落在工作区外，标 null 与沙箱拒绝行为一致。
- **判定不猜目录**：只走 48-01 的 `matchSkillByPath`（缓存 `filePath` 规范化全等 + basename 必须为 `SKILL.md`）；`references/*.md` 不算「使用技能」。
- **标记在 start 事件一次性给出**：`tool_execution_end` 不带 `params`，错过 start 无第二次机会。
- **文档讲行为不讲字段**：边界表用中文状态名，不出现 `overLimit` / `promptOmitted`。
- **文档显式区分两个 flag**：`disable-model-invocation`（可显式调用、打「仅显式」）与「已禁用」（两入口都拒、面板不显示）互不蕴含。

## Deviations from Plan

**1. [Rule 3 - Blocking] 429 配额中断后由主会话接管完成 Task 3**

- **Found during:** Task 3（文档同步）
- **Issue:** 委派给 gsd-executor 的子代理在创建后即遇 429（`您的使用量已超出频率限制`）。子代理在中断前已完成 Task 1 / Task 2 的全部提交与 Task 3 的 `AGENTS.md` + docs §六/§七 编辑，仅剩「第十节」章节未写、SUMMARY 未建。中断后确认无存活进程（末次写盘与 HEAD 提交均停在中断时刻，无本阶段 worktree 残留）后，由编排主会话接管。
- **Fix:** 主会话补写 `docs/product/ai-skills.md` 第十节「发现与调用」全文，跑通 Task 3 全部门禁后提交 `bb61fcb`，并补齐 SUMMARY 与计划基线台账。
- **Files modified:** `docs/product/ai-skills.md`（第十节）
- **Verification:** `doc-ok` / `sync-ok` / 边界表 8 行 + 零字段名 三段断言通过；5 文件 `node --test` → `# pass 341 / # fail 0`；`node tests/test-builtin-skills-seeder.js` 直跑 → `# pass 101 / # fail 0`。
- **Committed in:** `bb61fcb` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed（Rule 3 blocking）
**Impact on plan:** 接管只补写文档章节，不改变任何已提交的实现；Task 1 / Task 2 的交付物与断言逐条复核通过。无 scope creep。

## Issues Encountered

- **Task 3 执行中途的 429 配额中断**（见上）。接管前已确认后台代理死亡（末次文件写盘 `13:42:20 +08:00`、HEAD 提交 `13:41:35 +08:00`，当时时刻 `14:16 +08:00`，期间无新提交）。
- **`src/index.html` 的 `styles/main.css?v=` 序号推进**：`2d59c5b` 同一提交内既动 CSS 又推序号（已断言），故返回用户不会加载到不含两个新类的旧样式表。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 48 三个计划全部完成**，`read` 卡片技能化与文档收口就位，可进入 verify 阶段。
- **UAT 待验项**（已记入 `.planning/WINDOWS.md`）：
  - 50+ 技能下 220px 面板的观感（48-02 backstop）
  - 真实 Electron 端到端：模型自动匹配技能 → 卡片标题「使用技能「…」」+ 徽标 → 切换对话后标记仍在
- **遗留技术债**（不阻断收尾）：`tests/test-builtin-skills-seeder.js` 的 DOC-02 计数断言在 Node 22 嵌套 `node --test` 下必然失败（D-48-A，环境性、非本阶段引入，gate 用直跑形式豁免）。

---

*Phase: 48-skill-name*
*Completed: 2026-09-12*

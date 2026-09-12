---
status: diagnosed
phase: 48-skill-name
source: [48-VERIFICATION.md]
started: 2026-09-12T06:55:00Z
updated: 2026-09-12T15:00:00Z
round: 3
round_1_status: diagnosed
round_2_source: "48-VERIFICATION.md @ 2026-09-12T12:25:00Z（gap 修复后重验，31/36）"
round_2_status: "diagnosed（2026-09-12 自动驱动实测：9/10/13 pass，12 issue → G-48-12，11 已跳过）"
round_2_driver: "playwright _electron + 真实 dev 应用；provider = xiaomi/mimo-v2.5（XIAOMI_API_KEY）"
round_3_source: "48-VERIFICATION.md @ 2026-09-12T14:33:42Z（gap 48-07 执行后重验，44/52，仍 human_needed）"
round_3_status: "complete（2026-09-12 自动驱动实测：14/15/16/17 全 pass；18 已裁决 → WR-07/WR-08 双修复路线，落新 gap G-48-18 / G-48-19 待执行）"
round_3_driver: "playwright _electron + 真实 dev 应用；provider = xiaomi/mimo-v2.5（XIAOMI_API_KEY）；证据 /tmp/uat48-r3-t14.json、/tmp/uat48-r3-t16.json"
---

## Current Test

[testing complete]

> 历史：[round 2 testing complete] —— 4 项待测已全部由自动驱动实测并裁决
> （test 9 pass / test 10 pass / test 12 **issue**（G-48-12）/ test 13 pass；test 11 已按 TD-48-02 跳过）。
> **round 3 已收尾**：14 pass（**G-48-12 运行期面闭合**）/ 15 pass / 16 pass / 17 pass / 18 裁决为
> 「双修复」→ 新开 gap **G-48-18（WR-07）** 与 **G-48-19（WR-08）**，待 `/gsd-execute-phase 48 --gaps-only`。

## Tests

### [Round 1] 1. {阶段门槛} 裁决 48-REVIEW.md CR-01：面板行 `title` 属性逃逸
expected: 面板行的 `title` 属性用 `escapeHtml` 转义（不转义引号），磁盘来源的技能名可闭合 `title` 属性并注入新属性 / 事件处理器。已用纯 Node 探针复现：目录名 `pwn" data-x="y` 产出 `title="/skill:pwn" data-x="y 可显式调用"`。决定「Phase 49 开工前修复」或「登记为技术债延后」——Phase 49 的 `manage_skill` 会让 AI 直接创建技能目录，使该路径变为常规可达。
result: pass
decision: 登记为技术债延后（用户 2026-09-12 拍板，前提「暂时不发版」）→ 落 `48-REVIEW.md` TD-48-01，带接手触发点「Phase 49 开工前第一条」
note: |
  `pass` = 裁决已完成（决策落地），**不是**「缺陷不存在」。缺陷仍开着。
  裁决时对「可达性」的判断（Phase 48 即已可达：`managed-skills/` 在硬沙箱 root 内、
  AI write/bash 免确认、`enforceDirNameAuthority` 刻意不校验字符集）**仍成立**；
  但**执行性**判断已被 test 5 的实测推翻并降级 —— 主窗口 CSP `script-src 'self'` 使内联事件处理器
  不被编译，代码**不执行**，残余影响为 CSS 注入 / 潜在 XSS。详见 TD-48-01 的实测更正段。
  另已确认 secure-phase **不会**兜住（T-48-03 声明的缓解即失效机制）。

### [Round 1] 2. {阶段门槛} 裁决 48-REVIEW.md CR-02：`frontmatter name ≠ 目录名` 的技能不可调用
expected: 决定「按 CR-02 的路径判据修复 + 补一条 name≠目录名 用例」或「登记为技术债」；若不改，须同时修正 `docs/product/ai-skills.md` §10.4 的表述（现写「能显式调用 ✅」而实际 `readSkillForInvocation` 恒返回 `not_found`），以免产品说明与实现分叉。该行为是 48-01 PLAN 明确要求（`fresh.name !== name` → not_found，防冒名注入），非执行器偏离。
result: issue
reported: "修吧"
decision: 按 CR-02 的路径判据修复（用户 2026-09-12 裁决）→ gap G-48-2；§10.4 的 ✅ 随修复变为真实，无需改口径
severity: major

### [Round 1] 3. {阶段门槛} 裁决 48-REVIEW.md CR-04：renderer 陈旧快照否决调用
expected: 决定「移除本地否决、改由主进程 `skillError` 走既有回滚（D-13 推论）」或「让任何 `skills:changed` 都重拉快照」。现状下「运行期新增技能 + 从未打开过 `/` 面板」会得到「未找到技能」且输入框被清空，与「调用瞬间实时读盘」的用户硬约束（2026-09-11）存在张力；该预检是 48-01 Task 3 ② / 48-02 明文的计划要求，是否放宽需人工裁决。
result: issue
reported: "确定"
decision: 方案 A —— 移除本地否决（`known` / `known.disabled` 两段分支），改由主进程 `skillError` 走既有回滚；用户 2026-09-12 拍板 → gap G-48-3
verification_note: |
  裁决时已核实该预检是**纯冗余**：主进程对两种失败产出的文案与 renderer 本地分支**一字不差**
  （`ai-manager.js:6090-6098` 的 `skill_disabled` / `skill_not_found`），故删掉后 UX 零变化、无提示丢失。
  删它属对 48-01 Task 3 ② / 48-02 明文要求的**计划偏离**，本行裁决即其背书。
severity: major

### [Round 1] 4. 真实环境验证 CR-03 时序：流式回复中调用技能
expected: `npm run dev` → AI 正在流式回复时，点面板技能行（或手打 `/skill:name`）。新技能调用正常发出、新气泡流式回显；**不得**出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示。abort × 新消息的取消归属是运行时竞态（`state.aiCancelledByUser` 在 abort 后不复位、错误事件按 `state.aiCurrentMessageId` 归属），无测试覆盖。
result: issue
reported: "自动驱动实测（playwright _electron + 真实 MS/Qwen3-8B provider）：失败，症状与 CR-03 预测一致"
severity: major
observed: |
  自动驱动步骤：打开 `/` 面板确认 `/demo` 在快照 → 发长回复 prompt → 等首气泡确实有正文（len=59，停止按钮已亮）
  → 手打 `/skill:demo` 发起技能调用 → 每 250ms 采样 15s。
  实测序列（证据 `/tmp/uat48-rerun.json` 与 renderer/主进程日志）：
  1. 技能调用后新气泡被创建（len=0），主进程日志确认 `[Realm AI] 发送消息: /skill:demo` **已收到**；
  2. t=7372ms 时该气泡文本变为「用户已取消」（`*用户已取消*` 的渲染结果，len=6），此后 15s **零增长**；
  3. 停止按钮在 t≈0 即回退为「发送」（`classList` 失去 `stop-mode`）；
  4. 全程 `.ai-skill-pill` 未出现、无任何 system-note —— 新一轮技能调用的输出**完全不可见**。
  与 CR-03 第 3-5 步（迟到 error 按「当前消息 id」= 新气泡归属 → 写成取消文案 → 后续 `message_update` 因
  `aiCurrentMessageId === null` 全丢）逐条吻合。
confound: |
  被中止的那一轮不是「正在吐 token」，而是**卡在 bash 操作确认卡片**（prompt 诱发了 `seq 1 200` 的 bash 调用，
  主进程日志有「操作确认请求已广播」与「操作已取消」）。改用语段型 prompt 重跑时该模型 60s 内未产出流，
  故「中止的是真 token 流」这一变体未取到观测 —— 但中止来源（技能路径的 `abortAIIfStreaming`）与
  归属竞态机制与 CR-03 描述完全相同，结论不受影响。
decision: 缺陷成立，进 gap G-48-4（修复口径见 48-REVIEW.md CR-03）

### [Round 1] 5. 安全回归实测：目录名含 `"` 的技能行
expected: 在 `skills/` 下建一个目录名含 `"` 的技能（如 `pwn" data-x="y`），打开 `/` 面板把鼠标划过该行 —— 面板行不产生新属性 / 不执行注入（**当前实现会产出** `title="/skill:pwn" data-x="y 可显式调用"`）。需在真实 DOM 中观察生成的行结构与属性。
result: issue
reported: "自动驱动实测：属性逃逸**成立**，但注入的代码**不执行**（主窗口 CSP 拦掉内联事件处理器）"
severity: minor
observed: |
  用 playwright `_electron` 在 `managed-skills/` 下建目录名 `pwn" onmouseover="document.documentElement.dataset.pwned=1" data-x="y`，
  打开 `/` 面板后该行的真实 DOM（`/tmp/uat48-report.json`）：
  - `getAttributeNames()` = `["class","data-index","title","onmouseover","data-x"]`
  - `title` = `/skill:pwn`（被 payload 的引号截断）；`hasAttribute('onmouseover') === true`；`data-x` = `y 可显式调用`
  - `outerHTML`：`<div class="slash-picker-row slash-picker-row-skill" data-index="2" title="/skill:pwn" onmouseover="document.documentElement.dataset.pwned=1" data-x="y 可显式调用">…`
  → **属性逃逸确认发生**，注入体成为真实属性。
  但真实鼠标划过该行后 `document.documentElement.dataset.pwned === null` —— 处理器未执行。
correction: |
  追加 CSP 对照探针（`/tmp/realm-uat48-csp-probe.js`），结论决定性：
  `src/index.html:8` 有 CSP `script-src 'self'`（无 `unsafe-inline`），内联事件处理器**不被编译**。
  同文档对照：`innerHTML` 注入的 `onmouseover` → 属性在但 `el.onmouseover === null`、真实 mouseover 派发后计数器未置位；
  程序化 `el.onmouseover = fn`（非内联）→ `typeof === 'function'` 且正常触发。`style` 属性注入**可行**（`style-src` 含 `unsafe-inline`）。
  → **本条实测推翻 48-REVIEW.md CR-01 原文「注入代码在主窗口 renderer 执行、持有全量 realmAPI」的定级依据**，
  残余影响降为 minor（CSS 注入 / UI 伪装 / 潜在 XSS），已全文回写 `48-REVIEW.md` 的 TD-48-01。
adjudication: 与 test 1 同源（CR-01）。已裁决「延后」→ 记 TD-48-01，**不新开 gap plan**；本行实测即其证据与定级更正。

### [Round 1] 6. {UAT} 真实 Electron 端到端：气泡视觉与 IPC 往返
expected: `npm run dev` → 输入 `/skill:<真实技能名> 参数` 回车 → 气泡 = 技能 pill + args 正文 + 可展开「技能正文（N 字符）」块；再输入 `/skill:<不存在>` → system-note「未找到技能「foo」，输入 / 查看可用技能」且零气泡；再输入一个已禁用技能 → system-note「技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用」；流式中调用技能能正常发出并流式回显。
result: issue
reported: "自动驱动实测（playwright _electron）：clause 1 失败（pill 与折叠块本次发送后不出现），clause 4 随 test 4 失败；clause 2 / 3 通过"
severity: major
observed: |
  **clause 1 ❌** `/skill:demo 你好世界`：
  - ✅ 气泡正文 = args `你好世界`（正确）
  - ❌ 发送后立即、以及整轮跑完后：`hasPill=false`、`hasBox=false` —— pill 与「技能正文」折叠块**都不出现**
  - ✅ 手动调用 `renderAIMessages()` 之后：pill 出现（文案 `技能demo`）、折叠块出现（`技能正文（94 字符）`）、默认折叠、正文 94 字符；点击表头 collapsed→expanded→collapsed 三态正确
  → **根因**：`src/renderer.js:8843-8846` 把 `result.skillInvocation` 回填到 `state.aiMessages` 里的 user 消息后**没有重渲染**；发送开始时那次 `renderAIMessages()` 发生在 IPC 返回之前，之后 `message_update` / `tool_execution_*` 只走 `updateStreamingBubble`（只替换 `.ai-message-content`）。故 pill/折叠块只在**下一次全量重渲染**（切对话、重载、/compact 等）才出现。
    这是 48-REVIEW.md 11 条 finding **之外的独立缺陷**（CR/IN 均未覆盖）。
  **clause 2 ✅** `/skill:definitely-no-such-skill`：system-note「未找到技能「definitely-no-such-skill」，输入 / 查看可用技能」，user 气泡数 1→1（推送后被撤），零新增气泡。
  **clause 3 ✅** `/skill:weather`（config 置 `settings.aiSkills.disabled=['weather']`）：system-note「技能「weather」已被禁用，可在 设置 → AI → 技能管理 重新启用」，user 气泡数 1→1。
  **clause 4 ❌** 「流式中调用技能能正常发出并流式回显」—— 与 test 4 同根因（CR-03 / G-48-4），不重复计一个 gap。
  ⚠ 主进程日志另有旁证：模型收到调用后尝试把 `demo` 当**工具**调用（`Tool demo not found` × 5）—— 弱模型对 `<skill>` 块的误读，非本阶段缺陷，记录备查。
decision: 缺陷成立，进 gap G-48-6（clause 4 归 G-48-4）

### [Round 1] 7. {UAT} 50+ 技能数据集下 220px 面板观感（48-02 backstop）
expected: 按 `48-VALIDATION.md` §Manual-Only Verifications 的脚本向 `skills/` 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区 —— 分组标题 sticky 常驻；行五要素可读；行尾标注 `flex-wrap` 后无一截断；（若有）「超数量上限」/「未进提示词 · 超预算」标注正确出现。
result: pass
verified_by: 自动驱动（playwright _electron），可量化项全部达标；主观「观感」由代理依据截图判定，用户可推翻
observed: |
  按文档脚本向 `skills/` 落 `skill-01`..`skill-50`（各含 `description: 测试技能 NN`），面板投影 = 55 项（53 技能行 + 2 命令行）。
  - **分组标题 sticky ✅**：`.slash-picker-group-header` 计算样式 `position: sticky`；滚到列表 50% 处，「技能」标题相对滚动容器顶偏移 **1px**（贴住）；滚到底时「命令」标题可见、位置正常。
  - **行尾标注 flex-wrap 后无截断 ✅**：`.slash-picker-status` 截断计数 **0**（15 条带标注行全部完整）；行 `flex-wrap: wrap`；标注行自然折成两行（行高 35 → 62px），**未裁切任何文字**。
  - **行五要素可读 ✅**：`emptyDesc = 0`（最短描述列仍有 62px，行高 35px 基准）；`/demo` 长描述按设计走 `text-overflow: ellipsis` 省略（`nowrap`+`ellipsis` 是既有设计，不是缺陷）。
  - **首屏可见行数 = 6**（滚动容器 clientH 218、行高 35）。滚动容器 = `#slashPickerPanel`（`max-height: 220px`）。
  - **限额标注正确出现 ✅**：`未进提示词 · 超预算` × **14**、`超数量上限` × **1**。
    算术核对：user 源 = `demo` + `weather` + 50 生成 = 52；`weather` 被禁用后计入限额的为 51 → 超限 1 条，与观测一致（超限口径不把已禁用技能计入）。
  - **面板宽度口径澄清**：文档写「220px 面板」有歧义。CSS 侧 `#slashPickerPanel { max-height: 220px }`（实测 clientH=218）指向**高度**；而 `.ai-panel` 的自然宽度在本机是 **600px**（`--ai-panel-width` 运行时被 renderer 以 inline 样式覆盖，改 CSS 变量无效）。两种口径都测了：自然 600px 与**强制 220px 宽**（inline `!important`）下，上述 sticky / 不截断 / 标注出现 / `emptyDesc=0` 结论**完全一致**，220px 宽下仅折行行数增至 17（行高 62px，仍可读）。
  - 截图：`/tmp/uat48-test7-top.png`、`-scrolled.png`、`-forced220.png`、`-forced220-bottom.png`。
note: |
  唯一人判项是「观感是否可接受」。代理判定可接受（截图见上）；行高 62px 的两行行在 220px 宽下仍完整可读。
  `48-VALIDATION.md` §Manual-Only 要求「若不可接受，只调面板高度常量，不得改动分组 / 标注结构」—— 本条**无需改动**。

### [Round 1] 8. {UAT} 模型自动匹配技能的可见性（DISC-05 核心）
expected: 在运行中的应用里提一个**命中某技能 description 的任务**（不手打 `/skill:`），观察模型是否自行 `read` 该技能的 `SKILL.md` —— 工具卡片标题显示「使用技能「name」」并带来源徽标；参数区仍显示实际读取路径；**切换对话再切回**后同一卡片标记仍在。另问「你有哪些技能」，模型应能区分技能与工具（D-18）。
result: pass
decision: 判 pass（用户 2026-09-12 拍板）—— 交付物①（技能化卡片 + 徽标 + 路径 + 重载还原）已端到端证成；②（模型自发遵守 `read` 指令）由 SDK 模板完全承载、不属本阶段可控代码，失败归因于模型能力，另记 REVIEW 观测
observed: |
  这条实测**必须拆成两件事**——代理把它拆开分别驱动，结论相反：

  **① 「匹配到之后的可见性 + 持久化」= ✅ 全部通过**（显式引导模型用 `read` 读 `skills/demo/SKILL.md`）：
  - 工具卡片标题：`使用技能「demo」` ✅（48-03 的卡片技能化生效）
  - 来源徽标：`用户`，`title`=「用户技能（agent-workspace/skills/），同名时优先于内置与托管」✅
  - 参数区：`{ "path": ".../agent-workspace/skills/demo/SKILL.md", "offset": 1, "limit": 1 }` ✅ 实际读取路径可见
  - 状态 `完成`；**切走对话再切回**后同一卡片 `使用技能「demo」` + 徽标 + 参数**逐字仍在** ✅
  → DISC-05 的交付物（技能化卡片 + 徽标 + 路径 + 重载还原）端到端成立。

  **② 「模型自发匹配」（不手打 `/skill:`、不给 read 指令）= ❌ 未发生**：
  给 `demo` 的 description 命中任务「把「今天天气很好」翻译成日文。」后，模型**没有** `read` 技能文件，
  而是把技能名当**工具**调用：卡片 `demo`、参数 `{ "text": "今天天气很好" }`、结果 `Tool demo not found`、状态`失败`；
  模型自述「未找到名为 "demo" 的技能工具」。
  追问「你有哪些技能？它们和你可用的工具有什么区别？」时它答「需通过 `/skill:名字` 显式调用才能生效」——与 D-18 设计口径不符。

  **归因（源码直读，非推测）**：`buildSystemPrompt()`（`ai-manager.js:599-604`）= base + `buildSkillsPrompt()`（= SDK `formatSkillsForSystemPrompt` 的产物），
  而该 SDK 模板（`node_modules/@earendil-works/pi-agent-core/dist/harness/system-prompt.js`）**已明确写着**
  「Read the full skill file when the task matches its description.」并逐条给出 `<location>` 绝对路径。
  故**提示词侧指令存在且正确**，Realm 侧接线无误；模型（ModelScope `Qwen/Qwen3-8B`）不遵守。
  同一现象在 test 4 那轮也出现过（`Tool demo not found` ×5），两次独立观测一致。

  ⚠ 本机可用 provider 只有 MS/Qwen3-8B（huggingface 额度耗尽、xiaomi 无 key），**无法换更强模型复测**。
note: |
  ② 已作为观测写入 `48-REVIEW.md` IN-04（弱模型下用户会看到一张 `demo` 失败卡片，属真实可用性风险，
  留给 Phase 50/51 的技能 UX 处理）。本阶段不修。

---

## Round 2 — 重验后的人工验证项（2026-09-12T12:25Z）

> 第一轮 8 项的实测记录与裁决**原样保留**（见上方 `### 1.`–`### 8.`）。第一轮的 5 个 issue
> （test 2 / 3 / 4 / 5 / 6）已由 gap 计划 48-04 / 48-05 / 48-06 处置并执行；本轮针对**修复后**
> 的运行时可证性重开 5 项。以下编号续接为 9–13。

### 9. 重跑 UAT test 6 clause 1：技能气泡 pill 与「技能正文（N 字符）」折叠块
expected: `npm run dev` → 输入 `/skill:<真实技能名> <args>` 回车，**不做任何额外交互**，在「整轮回复结束后」采样 `hasPill` / `hasBox`。**整轮回复结束时**必有 pill 与折叠块（默认折叠、点击可展开），且**不需要**切换对话 / 重载 / `/compact` 触发
why_human: DOM 渲染时机 + IPC 往返属运行时行为（`await ai.prompt()` 在整轮 run 结束后才返回）。**口径已收口**（用户 2026-09-12 裁决，见 48-REVIEW.md WR-05 裁决段）：呈现时刻 = 本轮回合结束，**不再要求**回车那一刻即现 —— 故本条只需验后半边；`docs/product/ai-skills.md` §10.8 与 48-VERIFICATION.md 已同步措辞
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/mimo-v2.5，2026-09-12 round 2）
observed: |
  `/skill:demo 你好世界` → 发送后**零额外交互**，每 250ms 采样：
  - t=50ms：本轮 run 进行中（`stop-mode=true`），`hasPill=false` / `hasBox=false`（符合 WR-05 收口——不要求回车即现）
  - **t=1566ms：`hasPill=true` 且 `hasBox=true`，与 `stop-mode` 翻回 `send` 同一采样点**（本轮 run 结束即现，无需切对话/重载/`/compact`）
  - pill 文案 = `技能demo`；折叠块标题 = `技能正文（94 字符）`、正文长度 = **94**；`boxCollapsed=true`（默认折叠）
  - 三态切换：collapsed(true) → 点击 header → expanded(false) → 再点 → collapsed(true) ✅
  - 用户气泡正文 = args `你好世界`（未被改写为 `/skill:demo 你好世界`）✅
  - assistant 回复 = `こんにちは世界`（demo 技能正文要求「中文直译日文」，行为符合技能内容）✅
  - 全程 `notes=[]`（无 system-note）、无确认卡片、无「用户已取消」
  - 主进程日志：`[Realm AI] 发送消息: /skill:demo 你好世界`
  - 证据：`/tmp/uat48-r2-t9.json`、截图 `/tmp/uat48-r2-t9.png`
result: pass

### 10. 重跑 UAT test 4：流式回复中调用技能（G-48-4 运行时半边）
expected: `npm run dev` + 可用 provider → 发一条长回复 prompt，等首气泡确实有正文（停止按钮已亮）→ 流式中手打 `/skill:<真实技能名>` → 每 250ms 采样 15s。新气泡创建后有内容、持续增长；**不得**在 t≈7.4s 被写成「用户已取消」、不得其后 15s 零增长、停止按钮不得在 t≈0 就回退；`.ai-skill-pill` 应出现
why_human: 运行时竞态（`ai:abort` 同步返回 + 迟到 error 的到达顺序），node:test 只覆盖纯逻辑判定与接线契约。上一轮实测失败，锚点修复后须实测裁决是否真的闭合
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/mimo-v2.5，2026-09-12 round 2）
observed: |
  **前提取得**：散文 prompt 首气泡确已流式产出（`streamingAt = { bubbles: 1, len: 28 }`、停止按钮 `stop-mode` 已亮），
  随后流式中手打 `/skill:demo` 发起技能调用，每 250ms 采样 15s（60 个采样）：

  | t (ms) | ai 气泡 | bubble0（被中止的散文轮） | bubble1（新技能轮） | stop | pill | notes |
  |--------|---------|---------------------------|---------------------|------|------|-------|
  | 31–1042 | 2 | `用户已取消` | 28 字符（见下方残余观察） | true | false | [] |
  | 1295 | 2 | `用户已取消` | `你好世界\n——\n`（8） | true | false | [] |
  | 1547 | 2 | `用户已取消` | `你好世界\n—— 翻译为日文：\nこんにちは世界\n`（23，完整） | true | false | [] |
  | 1800–15018 | 2 | `用户已取消` | 同上（23，**稳定不再变**） | **false** | **true** | [] |

  - **新气泡有内容且持续增长** ✅（8 → 23）
  - **新气泡未被写成「*用户已取消*」** ✅ —— 取消落点在 **bubble0（被中止的那一轮）**，与 `state.aiCancelledMessageId` 锚点语义一致
  - **停止按钮未提前回退** ✅ —— t=31…1547 始终 `stop-mode`，t=1800 在本轮**真正结束**时翻回「发送」
  - **未出现 15s 零增长** ✅ —— 内容在 t=1547 产出完毕，此后 13.5s 稳定（属正常完成态，非卡死）
  - **`.ai-skill-pill` 出现** ✅（t=1800 起，与 G-48-6 的「本轮结束即现」口径一致）
  - 全程 `notes=[]`（无错误条 / 无 system-note）
  - 主进程日志：`[Realm AI] 发送消息: /skill:demo` → `本轮回复: 你好世界\n\n—— 翻译为日文：\n\nこんにちは世界` → `回复完成`
  - 证据：`/tmp/uat48-r2-t10.json`、截图 `/tmp/uat48-test4-after.png`（本轮覆盖写入）
  - **对照上一轮失败态**（新气泡 t≈7372ms 变「用户已取消」+ 其后 15s 零增长 + 停止按钮 t≈0 回退）：三条症状**全部消失**
residual_observation: |
  不计入 gap 的残余现象（属 48-05 修复范围**之外**的既有归属路径）：
  t=31…1042 期间新气泡（bubble1）短暂显示**被中止那一轮**已流出的 28 字符
  （老轮的迟到 `message_update` 仍按「当前消息 id」写入，而该 id 在技能路径的同步段已指向新气泡；
  锚点方案只改了 error/取消分支的归属，未改 `message_update` 的归属）。
  t=1295 起被新一轮真实 token 覆盖，表象为约 1.3s 的瞬时残留文本。
  不影响本条 truth 的三条否定判据（未标取消 / 未提前回退 / 新回复可见）；是否升级为独立缺陷由人工裁决。
result: pass

### [Deferred · TD-48-02] 11. CR-05 可达性实测
expected: （原为「在流式结束的瞬间连点两次停止按钮，随后触发一次任意真实错误」的实测）
why_human: CR-05 是从状态机 + SDK 语义推出的窄竞态路径（`abort()` 打在已结算 run 上是静默 no-op），无任何测试覆盖
result: skipped
skip_reason: "用户 2026-09-12 裁决「先记技术债，直接跑 UAT」→ 登记为 `48-REVIEW.md` 的 **TD-48-02**，接手触发点 = Phase 49 开工前第一条（与 TD-48-01 同批）。**本阶段不要求实测**；缺陷形态与修复口径见 TD-48-02。"

### 12. G-48-3 运行期探针（`.planning/WINDOWS.md` unrun-verify id 24）
expected: 在 `agent-workspace/managed-skills/` 下新建一个技能目录（**不打开** `/` 面板），直接手打 `/skill:<新名>`。请求到达主进程并由其当场读盘 → 正常调用（不再出现「未找到技能」且输入框被清空）
why_human: 主进程 idle 边界重扫 + 广播 + IPC 往返的运行时组合；node:test 只证明「发送路径零快照读取」（源码契约）与「主进程读盘成功」（单测）两个半边
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/mimo-v2.5，2026-09-12 round 2）
observed: |
  **先说结论：本条 truth 未达成 —— 出现「未找到技能」，且不是 renderer 本地否决，而是主进程缓存门。**

  **A 段（renderer 半边已修 ✅）** 把 renderer 快照人为清空（`state.aiSkills = []`，最大陈旧度）后对磁盘上确有的
  `demo` 发 `/skill:demo 你好`：pill `技能demo` + 折叠块 94 字符 + args `你好`，`notes=[]`，
  主进程日志 `发送消息: /skill:demo 你好` —— **请求确实直达主进程**，G-48-3 的「移除本地否决」这一半成立。

  **B 段（主进程半边 ❌）** 应用**启动后**在 `managed-skills/` 下新建 `uat-probe-r2-20689539/SKILL.md`，
  **全程不打开 `/` 面板**，立即手打 `/skill:uat-probe-r2-20689539 你好`：
  - 观测 1：system-note **「未找到技能「uat-probe-r2-20689539」，输入 / 查看可用技能」**
  - 观测 2：主进程日志**无** `发送消息: /skill:…`（拒绝发生在 `agent.prompt` 之前）
  - 观测 3：`state.aiSkills` 全程 `count:0 / containsNew:false`（**无任何自动重拉**）

  **B2 判别性补测（同一技能、同一磁盘状态，只差一次重扫）**：
  | 轮次 | 前置 | 结果 |
  |------|------|------|
  | round 1 | 外部新建目录后**立即**发送（无重扫触发） | ❌ note「未找到技能「uat-probe-b2-21006865」」；`notesAdded` 命中延迟 **14ms**；`sawRun=false`；`mainLogs=[]` |
  | — | 调 `realmAPI.ai.refreshSkills()`（= 打开 `/` 面板所走的重扫链） | 返回 `{count:5, containsNew:true, digest:"12an2m8"}` |
  | round 2 | 重扫之后原样再发 | ✅ 零 note；pill `技能uat-probe-b2-21006865`；折叠块 17 字符；args `你好`；主进程日志 `发送消息: /skill:uat-probe-b2-21006865 你好` |

  → 同一份磁盘状态，**只差一次缓存重扫**即从必败变为正常调用。

  **根因（源码直读）**：
  `readSkillForInvocation`（`ai-skills-manager.js:802-804`）在**触盘之前**先用缓存做存在性门 ——
  `const entry = _cache.skills.find(e => e.skill.name === name && e.shadowed !== true); if (!entry) return { ok:false, reason:'not_found' }`。
  即「当场读盘」只对**已进缓存**的技能成立（内容改动确实即时生效，`tests/test-ai-skills.js:1471` 覆盖的正是这一形态）；
  **新建目录**不在缓存里 → 连读盘都不会发生。
  而 `refreshSkills()` 全仓只有 3 个调用点（`ai-manager.js:868` Agent 创建、`:2763` `syncAgentSystemPrompt`、`:2840` `_recreateAgent`），
  `skills:changed` 只在 `:2786` 广播。`syncAgentSystemPrompt` 的两个可达入口是「打开 `/` 面板（`ai:refresh-skills`）」与
  「`promptWithContext` 的 `_skillsPromptDirty` idle 补刷」—— 而 `_skillsPromptDirty` **只由 `syncAgentSystemPrompt` 自己在忙时置位**，
  故它不构成独立触发源。**没有任何文件系统监听、定时器或写工具钩子** —— 纯 fs 变更（含 AI 经 write/bash 建目录）不会自动进缓存。
  ⚠ 据此，G-48-3 gap 原文括注的「AI 经 write/bash 建目录 → 主进程 idle 边界重扫并广播」这条链**在代码里并不存在**，
  该前提在 gap 立项时即不准确。

  **可达性补充**：现实中用户先在面板里看到新技能（面板打开即触发重扫）再手打调用 → 不受影响；
  受影响的是「运行期新增 + 从不打开面板 + 直接手打」这一路径，正是本条 truth 描述的场景。

  - 证据：`/tmp/uat48-r2-t12.json`（A/B 段）、`/tmp/uat48-r2-t12b.json`（B2 判别性）、截图 `/tmp/uat48-r2-t12.png` / `-t12b.png`
  - 探针技能目录已清理（`managed-skills/` 恢复为 `find-skills` / `skill-creator`）
result: issue
reported: "自动驱动实测：A 段（renderer 本地否决已移除）通过；B 段与 B2 判别性补测显示**主进程缓存门**使运行期新增技能仍判「未找到技能」——`readSkillForInvocation` 在触盘前用 `_cache.skills` 做存在性门（ai-skills-manager.js:803-804），且纯 fs 变更无任何自动重扫触发"
severity: major
root_cause: "`readSkillForInvocation` 的存在性判据取自**缓存**而非磁盘：`_cache.skills.find(name)` 未命中即 `not_found`，读盘路径根本未被执行。缓存只由 3 个显式 `refreshSkills()` 调用点刷新（Agent 创建 / `syncAgentSystemPrompt` / `_recreateAgent`），其中 `syncAgentSystemPrompt` 的唯一常规入口是「打开 `/` 面板」；`_skillsPromptDirty` idle 补刷不是独立触发源（该标记只由 `syncAgentSystemPrompt` 自身在忙时置位）。无 fs watcher / 定时器 / 写工具钩子 → 运行期新增技能目录（含 AI 经 write/bash 创建）永不自动进缓存。"
artifacts:
  - path: "ai-skills-manager.js"
    issue: "802-804 触盘前用 _cache.skills 做存在性门：缓存未命中直接 not_found，与「调用瞬间实时读盘」硬约束冲突"
  - path: "ai-manager.js"
    issue: "2763 syncAgentSystemPrompt 是唯一常规重扫入口，其调用方仅 refreshSkillsForPanel（打开 / 面板）；无写工具钩子/fs 监听"
  - path: "ai-manager.js"
    issue: "1325-1334 _skillsPromptDirty idle 补刷块不是独立触发源（该标记只由 syncAgentSystemPrompt 自身置位）"
missing:
  - "定口径：是让 `readSkillForInvocation` 在缓存未命中时按目录名**回退一次磁盘探测**（至少判「目录 + SKILL.md 是否存在」），还是把 truth/文档收口为「需先有一次重扫（打开面板 / Agent 重建）」"
  - "若选择回退探测：需同时裁定该路径的 shadowed / disabled / tier 取值来源（缓存是这些字段的唯一权威），不得让新技能绕过遮蔽与禁用判定"
  - "若选择收口：须同步修正本条 truth（48-UAT.md）、`.planning/WINDOWS.md` unrun-verify id 24、G-48-3 原文括注的错误前提，以及 `docs/product/ai-skills.md` 的相关表述"
  - "补一条覆盖「运行期新增技能目录 → 直接 /skill:调用」的测试（现测试面只覆盖「已缓存技能的内容改动」，新建目录形态永久盲区）"
residual_observation: "A 段使用的人为清空快照手法会与 `pullAiSkillsSnapshot` 的 digest 早退（renderer.js:9086-9088）相互作用，导致快照不会自动回填 —— 这是探针手法，不是产品行为；已用 B2 的 `refreshSkills()` 显式重扫对照排除干扰。"

### 13. DISC-05 模型侧复核（可选 · 已知限制）
expected: 在不手打 `/skill:` 的前提下提一个命中某技能 description 的任务，并追问「你有哪些技能？它们和你可用的工具有什么区别？」。理想：模型自行 `read` 该 SKILL.md，卡片标题「使用技能「x」」。已知：弱模型（Qwen3-8B）会把技能名当**工具**调用并得到 `Tool x not found`，且答「需通过 `/skill:` 显式调用」
why_human: SDK 提示词模板已写明「Read the full skill file when the task matches its description.」并给出 `<location>` 绝对路径 —— Realm 侧接线无误，失败完全归因于模型能力；本机唯一可用 provider 为 Qwen3-8B，无法换更强模型复测。已作为观测写入 48-REVIEW.md IN-04（留给 Phase 50/51 的技能 UX）
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/**mimo-v2.5**（推理模型，2026-09-12 起可用），2026-09-12 round 2）
observed: |
  **round 1 的失败在本轮换模型后翻转 —— 反证了「失败完全归因于模型能力」。**

  **Q1**（不手打 `/skill:`，直接发「把「今天天气很好」翻译成日文。」，命中 demo 的 description）：
  - 模型**自发**调用 `read`：工具卡片 = `使用技能「demo」`，来源徽标 = `用户`，状态 `完成`，
    参数区显示实际读取路径 `…/agent-workspace/skills/demo/SKILL.md` ✅
  - **无** `Tool demo not found` 失败卡片（round 1 在 Qwen3-8B 下出现 ×5）
  - 回答正确（按技能正文要求「只输出译文本身」）：`今日はとてもいい天気ですね。` ✅

  **Q2**（追问「你有哪些技能？它们和你可用的工具有什么区别？」，D-18 口径）：
  模型答「我目前有两个**技能（Skill）**：1. **demo** — 当需要把中文翻译成日文时使用 2. **weather** — 当用户询问天气时使用」，
  并给出与 D-18 一致的区分：「技能…我只知道技能的名字、描述和文件位置，**正文并不在我的提示词里**。
  只有当用户的请求匹配某个技能的描述时，我才用 `read` 工具去打开对应的 `SKILL.md` 文件」——
  **与 round 1 Qwen3-8B 的「需通过 `/skill:` 显式调用」相反** ✅

  - 主进程日志：`[Realm AI] 工具完成: read → {…demo/SKILL.md 正文 216 字…}`
  - 证据：`/tmp/uat48-r2-t13.json`、截图 `/tmp/uat48-r2-t13-q1.png` / `-q2.png`
note: |
  本条为**可选**项，且按 round 1 的裁定「②（模型自发遵守 read 指令）由 SDK 模板完全承载、不属本阶段可控代码」——
  故本轮的通过**不改变** round 1 test 8 的判 pass 结论，只更新观测：48-REVIEW.md IN-04 所述「弱模型下用户会看到一张
  `demo` 失败卡片」是**模型能力相关**而非 Realm 接线问题（换 mimo-v2.5 即消失）。
result: pass

## Round 3 — 重验后的人工验证项（2026-09-12T14:33Z）

> 前两轮的实测记录与裁决**原样保留**（`### 1.`–`### 8.` 与「## Round 2」9–13）。本轮为 gap 计划
> **48-07**（闭合 G-48-12 主进程半边）执行后的重验。48-07 只改 `ai-manager.js` / 测试 / 文档，
> **未触 renderer / DOM**，故下列 14–17 中凡属运行时行为者仍须实测；18 为两处新处置裁决。
> 以下编号续接为 14–18。

### 14. 重跑 UAT test 12 / G-48-12 运行期探针（本轮**阻断收尾**项）
expected: `agent-workspace/managed-skills/`（或 `skills/`）下**运行期**新建技能目录 —— **不打开 `/` 面板**、不重启、不重建 Agent —— 直接手打 `/skill:<新名> [args]`。请求须**到达主进程并由它当场读盘**后正常调用：不再出现 system-note「未找到技能「<新名>」」，不再有「主进程无 `发送消息: /skill:…` 日志」这一现象
why_human: 缓存未命中的重扫是主进程运行时行为；48-07 已修代码面（`_resolveSkillInvocation` 至多重试一次经 `syncAgentSystemPrompt()` 后重读盘，`rescanCalls === 1` 由 139 例单测钉住），但**真实 dev 应用的端到端链路未实测**。修复前证据（round 2 test 12，2026-09-12）：14ms 内出 note、`state.aiSkills` 全程 `containsNew:false`、主进程零请求；`ai.refreshSkills()` 后原样重发即成功
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/mimo-v2.5，2026-09-12 round 3）
observed: |
  **truth 达成 —— 主进程重扫门已闭合。** 探针（`/tmp/realm-uat48-r3-probe.cjs`，证据 `/tmp/uat48-r3-t14.json`）：

  **前提构造（三重，逐条可核）**：
  1. 应用**启动完成之后**才在 `agent-workspace/managed-skills/` 下新建 `uat-r3-24650778/SKILL.md`
     （正文 `当用户说「你好」时，只回复「探针技能已生效」。`）——启动期的 Agent 创建重扫已发生在建目录**之前**；
  2. **不打开 `/` 面板**：`openSlashPicker()` 全仓**唯一**调用点是输入框 `input` 事件处理器
     （`src/renderer.js:10277`；`openSlashPicker` 内的 `refreshSkills()` 是面板路径的唯一重扫入口）。
     探针只做 `el.value = text` 后直调 `handleSendAIMessage()`，**不派发 `input` 事件** → 面板全程未打开、
     面板路径的 `refreshSkills()` 从未发起；
  3. **不重启、不重建 Agent、不开新对话**。

  **发送前快照（判别性前置）**：`realmAPI.ai.getSkills()`（零 IO 投影）→
  `{count: 4, names: ["demo","weather","find-skills","skill-creator"], digest: "1mza5kf", containsNew: false}`
  —— renderer 侧快照确实**不含**新技能，故后续成功不可能来自 renderer 快照。

  **发送后观测**：
  - system-note：`notesDelta = []` —— **零条**，不再出现「未找到技能「uat-r3-24650778」」✅
  - 主进程日志：`[Realm AI] 发送消息: /skill:uat-r3-24650778 你好` ✅（**请求确实到达主进程**，
    且该行位于 `_resolveSkillInvocation` **成功之后**（`ai-manager.js:1046` → `:1072`）——它的出现即证明
    「miss → 重扫一次 → 重读盘」链路成功）
  - **读盘真实性（决定性）**：模型回复 = `探针技能已生效`，该字符串**只存在于新建的那个 SKILL.md 里**
  - 气泡三件套：pill = `技能uat-r3-24650778`；折叠块标题 = `技能正文（23 字符）`、`bodyLen = 23`
    —— 与磁盘正文 `当用户说「你好」时，只回复「探针技能已生效」。` 逐字等长（23 字符）✅
  - 无确认卡片、无「用户已取消」、无错误；`[Realm AI] 回复完成: 探针技能已生效`
  - 探针技能目录已清理（`cleanup: ok`，`managed-skills/` 恢复为 `find-skills` / `skill-creator`）

  **对照 round 2 的失败态**（14ms 出 note / `containsNew:false` 且无自动重拉 / 主进程零 `发送消息` 日志）：
  三条症状**全部消失**。
note: |
  探针自检更正：首版脚本用 `classList.contains('hidden')` 判断面板开合，而面板实际以 `style.display` 显隐
  （`src/index.html:862` 内联 `display:none`；`openSlashPicker`/`closeSlashPicker` 切 `display`）→ 该字段恒 `true`
  属**误报**，已按上面的代码事实（唯一调用点 + 未派发 `input`）判定面板未打开；本条的判别性不依赖该字段。
result: pass

### 15. 重跑 UAT test 6 clause 1（pill + 「技能正文」折叠块）—— 复核性重跑
expected: `npm run dev` → 输入 `/skill:<真实技能名> <args>` 回车，**不做任何额外交互**，整轮回复结束时 `.ai-skill-pill` 与 `.ai-skill-content-box` 均在（默认折叠、点击可展开）；呈现时刻 = 本轮回合结束（口径已收口，不要求回车即现）
why_human: round 2 test 9 已通过（t=1566ms 与 run 结束同一采样点出现）。48-07 未触 renderer，本轮为**回归复核**：确认 48-07 的重扫路径没有改变回填后的定向刷新时机
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/mimo-v2.5，2026-09-12 round 3）
observed: |
  `/skill:demo 你好世界` → 发送后**零额外交互**，每 250ms 采样 40s（`/tmp/uat48-r3-t14.json`）：
  - pill = `技能demo`；折叠块 = `{collapsed: true, title: "技能正文（94 字符）", bodyLen: 94}` ✅
  - 三态：`collapsed(true) → 点击 header → expanded(false) → 再点 → collapsed(true)`，`seq = [true,false,true]` ✅（默认折叠）
  - 用户气泡正文 = args `你好世界`（未被改写成 `/skill:demo 你好世界`）✅
  - **呈现时刻 = 本轮回合结束**：采样轨迹里 pill/box 计数从 `1 → 2`（新的一份）的拐点与 `stop-mode` 由 `true` 翻回 `false`
    落在**同一采样点**（t≈2.0s），回车那一刻不出现 —— 与 WR-05 收口口径一致，**不要求**回车即现
  - `notesDelta = []`（无 system-note）、无确认卡片、无「用户已取消」
  - 主进程日志：`发送消息: /skill:demo 你好世界` → `本轮回复` → `回复完成`
  - 结果与 round 2 test 9 逐条同形（含「与被中止轮无关的独立一轮」形态）→ **48-07 未使该路径回归**
result: pass

### 16. 重跑 UAT test 4（流式中调用技能）—— 复核性重跑
expected: 发长回复 prompt → 流式中手打 `/skill:<真实技能名>` → 采样 15s：新气泡有内容且持续增长；**不得**被写成「用户已取消」；停止按钮不得提前回退；`.ai-skill-pill` 出现
why_human: round 2 test 10 已通过。48-07 未触 renderer / 取消锚点，本轮为**回归复核**
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/mimo-v2.5，2026-09-12 round 3）
observed: |
  发长回复 prompt（600 字散文）→ 等**首气泡确实流式产出**（`streamingAt = {bubbles: 2, len: 14}`、
  停止按钮 `stop-mode` 已亮）→ 流式中手打 `/skill:demo 你好世界` → 每 250ms 采样 50s（197 个采样，
  证据 `/tmp/uat48-r3-t16.json`；同一探针另跑两轮同形，见 note）：
  - **新气泡有内容且持续增长** ✅ 0 → 108 字符（三轮分别 8→191 / 16→1042 / 0→108，均连续增长）
  - **新气泡未被写成「*用户已取消*」** ✅ —— 取消落点在**被中止的那一轮**气泡（`ai1` = `用户已取消`，len 6），
    与 `state.aiCancelledMessageId` 锚点语义一致
  - **停止按钮未提前回退** ✅ —— t=0.00 → 2.79s 全程 `stop-mode`，在**本轮真正结束**时翻回 `send`
  - **`.ai-skill-pill` 出现** ✅ —— 与 `stop-mode` 翻回同一采样点（t=2.79s）出现，pill = `技能demo`；
    折叠块 `技能正文（94 字符）`、默认折叠
  - **无 15s 零增长** ✅ —— 内容在 t=2.79s 产出完毕，其后 47s 稳定（正常完成态，非卡死）
  - 全程 `notes = []`（无错误条 / 无 system-note）
  - 主进程日志：`操作已取消` → `本轮回复: # 大海的清晨` → `模型返回错误: Request was aborted`（老轮中止）
    → `发送消息: /skill:demo 你好世界` → `本轮回复: …` → `回复完成`
  - **对照 round 1 失败态**（新气泡 t≈7372ms 变「用户已取消」+ 其后 15s 零增长 + 停止按钮 t≈0 回退）：
    三条症状**全部消失**
note: |
  三轮独立运行的差异只在**模型回复风格**（mimo-v2.5 一次直接给译文、一次长篇追问、一次先点评再翻译），
  四条判据在**每一轮**都成立；「新气泡持续增长」在最长一轮跑到 1042 字符仍未被打断，是比 round 2 更强的证据。
  ⚠ 探针首版曾在 renderer.js 未执行完时读取全局函数，得到 `typeof handleSendAIMessage === 'undefined'` 的假象
  （诊断脚本 `/tmp/realm-uat48-diag-scope.cjs` 证实：`waitForLoadState('load')` + 3s 后二者均为 `function`，
  `hasOwnProperty(window, …) === true`）。修正后重跑，三轮结论一致；消息发送链路的成立另有主进程
  `发送消息: /skill:demo 你好世界` 日志独立佐证。
result: pass

### 17. 新增：重扫抛错回退的行为面（48-REVIEW.md WR-08）
expected: 手打 `/skill:<确定不存在的名字>` → 应正常回 system-note「未找到技能」（重扫一次后仍 `not_found`）；随后发一条**普通消息** → 应正常得到回复，**不得**出现「AI 正在处理上一条消息」的静默丢弃或任何卡死
expected_detail: 本轮复核目标 = 重扫路径抛错时是否**保留原判定**且不升级为异常（48-07 自述不变式）。静态面已知：重试读盘在 `try` 之外、`catch` 内 `err.message` 对非对象抛出值会二次抛错（WR-08），**该分支零行为用例**
why_human: 异常路径在正常环境不自然发生；须人为构造（例如使重扫期间读盘失败）或至少验证「不存在名 → note → 后续消息正常」这条相邻路径不受影响
verified_by: 自动驱动（playwright _electron + 真实 dev 应用，provider = xiaomi/mimo-v2.5，2026-09-12 round 3）
observed: |
  **取本条明示的后一条路线（相邻路径）实测 —— 全绿；人为构造「重扫期间读盘失败」未做**（见 note）。

  **17a（不存在名）** `/skill:definitely-no-such-skill-r3-24650778`：
  - system-note = 「未找到技能「definitely-no-such-skill-r3-24650778」，输入 / 查看可用技能」✅
  - 主进程日志 = `[Realm AI] 技能调用被拒：skill_not_found` ✅
    —— **判别性**：走的是重试后的失败出口，返回码仍是 `skill_not_found`（**未**升级成异常/未变成第三码），
    即 48-07 自述的「重扫一次后仍 not_found → 保留原判定」在行为面成立
  - 气泡回滚：`bubblesDelta = 0`（推送的占位气泡被撤，`4 → 2`）✅
  - 停止按钮：`111000…`（置 → 复位，无挂死）✅

  **17b（随后一条普通消息）** 「只回复两个字：收到」：
  - 主进程日志 = `发送消息: 只回复两个字：收到` —— **不是**「AI 正在处理上一条消息，请稍候再试」✅
    —— **判别性**：证明上一条被拒的技能调用**未**留下 `isProcessing = true` 的悬挂（WR-02 形态未触发）
  - 回复 = `收到`；assistant 气泡正常产出；`notesDelta = []`；无卡死、无静默丢弃 ✅
note: |
  **未测到的半边（如实标注）**：WR-08 的靶心 —— 「重扫期间 `syncAgentSystemPrompt()` **抛错**时是否保留原判定
  且不升级为异常」—— 在正常环境不自然发生，本轮**未人为构造**（未篡改运行中的应用）。故本条的结论边界是：
  **相邻路径（不存在名 → note → 后续消息正常）已实测通过**，抛错分支仍**零行为用例**
  （该分支的代码面缺口见 G-48-19 / WR-08；用户 2026-09-12 已裁决「修复 + 补行为用例」，故它会在 G-48-19 中闭合，
  不在本条重复计一次 gap）。
result: pass

### 18. 处置裁决：WR-07 与 WR-08（各择一路线）
expected: 逐条拍板并落地
why_human: 两条均为 48-07 增量**放大/暴露**的既有机制问题，不是本增量的错值；核验报告判**不阻断 UAT**，但建议在 Phase 49（`manage_skill` 落地、AI 自建技能常规化）开工前与 TD-48-01 / TD-48-02 同批处置
options:
  - "WR-07 —— `_skillsPromptDirty` 唯一消费者在 `promptWithContext()`（`ai-manager.js:1325`），而纯文本 `/skill:` 走 `ai.prompt`（`src/renderer.js:8799`）→ 延迟回写与广播在纯文本流上**永不落地**，运行期新增技能对模型自动匹配与已开面板长期不可见。路线 A：在 `prompt()` 成功出口（`ai-manager.js:1084-1088`）补一次 flush（≈6 行）；路线 B：仅收紧 docs §10.7 的「下一轮 idle 边界」措辞为「下一轮**带引用/附件**的结束」"
  - "WR-08 —— 补该分支的行为用例（或原地收紧 try 范围 + 修 `err.message` 取值），或明确接受把不变式降为「尽力而为」并在注释/文档同步"
result: issue
reported: "用户 2026-09-12 拍板：WR-07 取**路线 A**（补 flush，让纯文本流也落地回写 + 广播）；WR-08 取**修复 + 补行为用例**（收紧 try 范围 + 修 `err.message` 取值 + 补该分支行为用例）。两条均在本阶段闭合，不延后到 Phase 49"
severity: minor
decision: |
  - **WR-07 → 路线 A（补 flush）**。理由（用户选项说明已载明）：纯文本流是 `/skill:` 的默认通道，路线 B 等于把
    「最终一致」降级为「打开面板才一致」；Phase 49 的 `manage_skill` 让 AI 自建技能常规化，依赖模型自己感知新技能。
    须同步：`docs/product/ai-skills.md:401` 与 `ai-manager.js:1433` 的「下一轮 idle 边界」措辞。
  - **WR-08 → 修复 + 补行为用例**。把重试读盘纳入 `try`、`catch` 内改 `err && err.message ? err.message : String(err)`
    （与 `ai-skills-manager.js:634` 同形），并补该分支的行为用例（夹具可复用 J 组 `skillResolveCtx`，
    覆写 `syncAgentSystemPrompt` 抛错），使注释里的「保留原判定」在字面上成立。
  两条新开 gap：**G-48-18**（WR-07）与 **G-48-19**（WR-08），均 `status: failed` 待 `/gsd-execute-phase 48 --gaps-only`。
  核验报告（48-REVIEW.md）判两条**不阻断 UAT**，故本条 severity 记 `minor`：不影响任何已通过项的真值，
  属「本增量把既有延迟落地机制放大成常规路径」与「文档承诺的不变式只写进注释」。

## Summary

round_1: { total: 8, passed: 3, issues: 5, pending: 0, skipped: 0, blocked: 0 }
round_2: { total: 5, passed: 3, issues: 1, pending: 0, skipped: 1, blocked: 0 }
round_3: { total: 5, passed: 4, issues: 1, pending: 0, skipped: 0, blocked: 0 }

total: 18
passed: 10
issues: 7
pending: 0
skipped: 1
blocked: 0

> round_3 的 5 项（14–18）已全部裁决完毕（2026-09-12 自动驱动实测）：
>
> | item | 结论 | 备注 |
> |------|------|------|
> | 14（G-48-12 运行期探针） | **pass** | 运行期新建技能目录 + 不打开 `/` 面板 → 主进程 `发送消息: /skill:<新名>`、零 note、读盘正文逐字命中（23 字符） |
> | 15（test 6 clause 1 重跑） | **pass** | pill `技能demo` + 折叠块 94 字符 + 三态正确；呈现时刻 = run 结束（与 round 2 同形） |
> | 16（test 4 重跑） | **pass** | 取消落在**被中止轮**、新气泡 0→108 持续增长、停止按钮未提前回退、pill 出现；三轮独立复现 |
> | 17（重扫抛错相邻路径） | **pass** | 不存在名 → note + `skill_not_found` + 气泡回滚；后续普通消息正常（无 `isProcessing` 悬挂）。抛错分支未人为构造，归 G-48-19 |
> | 18（WR-07 / WR-08 裁决） | **issue → G-48-18 / G-48-19** | 用户裁决**双修复**（不延后）：WR-07 补 flush；WR-08 收紧 try + 修 `err.message` + 补行为用例 |

> round_1 的 5 个 issue（test 2 / 3 / 4 / 5 / 6）已由 gap 计划 48-04 / 48-05 / 48-06 处置并执行完毕，
> 其记录保留为历史（对应 Gaps 中的 G-48-2 / G-48-3 / G-48-4 / G-48-6 均已 `status: resolved`，
> test 5 已裁决记 TD-48-01、不立 gap）。round_2 的 5 项已全部裁决完毕（2026-09-12）：
>
> | item | 结论 | 备注 |
> |------|------|------|
> | 9（test 6 clause 1 重跑：技能气泡 pill + 折叠块） | **pass** | t=1566ms 与 run 结束同一采样点出现，三态正确 |
> | 10（test 4 重跑：流式中调用技能） | **pass** | 老气泡被标取消、新气泡正常增长；停止按钮未提前回退；pill 出现 |
> | 11（CR-05 可达性实测） | skipped | 已裁决记 TD-48-02，本阶段不要求实测 |
> | 12（G-48-3 运行期探针） | **issue → G-48-12** | renderer 半边已修；主进程 `_cache.skills` 存在性门使运行期新增技能仍不可调用 |
> | 13（DISC-05 模型侧复核 · 可选） | **pass** | 换 mimo-v2.5 后模型自发 `read`、卡片技能化、正确区分技能与工具（反证 round 1 失败纯属模型能力） |

## Gaps

```yaml
- gap_id: G-48-6
  truth: "输入 `/skill:<真实技能名> 参数` 回车后，用户气泡应立即呈现三件套：技能 pill（文案「技能」+ 技能名）+ args 正文 + 默认折叠的「技能正文（N 字符）」块"
  status: resolved
  resolved_by: 48-05-PLAN.md
  resolved_at: 2026-09-12
  reason: "自动驱动实测：发送后立即与整轮跑完时 pill / 折叠块均不存在（`hasPill=false`、`hasBox=false`）；手动调用 `renderAIMessages()` 后两者立即正确出现（pill 文案 `技能demo`、折叠块 `技能正文（94 字符）`、默认折叠、正文 94 字符、三态切换正常）。根因：`src/renderer.js:8843-8846` 回填 `result.skillInvocation` 后没有重渲染；发送起点那次 `renderAIMessages()` 早于 IPC 返回，之后流式更新只走 `updateStreamingBubble`（仅替换 `.ai-message-content`）。属 48-REVIEW.md 11 条 finding 之外的独立缺陷"
  severity: major
  test: 6
  root_cause: "`handleSendAIMessage` 在回填 `result.skillInvocation` 之后（`src/renderer.js:8843-8846`）**没有触发任何渲染**；而发送起点那次 `renderAIMessages()` 发生在 `await ai.prompt()` 返回**之前**，此后整轮流式只走 `updateStreamingBubble`（只替换 `.ai-message-content`，`renderer.js:8175-8193`）。故用户气泡的 pill 与「技能正文」折叠块在本轮永不出现，只在下一次**全量** `renderAIMessages()`（切对话 / 重载 / `/compact`）才渲染出来。属 48-REVIEW.md 11 条 finding **之外**的独立缺陷（CR/IN 均未覆盖该渲染时机）。"
  artifacts:
    - path: "src/renderer.js"
      issue: "8843-8846 回填 userMsg.skillInvocation 后缺一次渲染；渲染时机与 IPC 返回顺序错位"
    - path: "src/renderer.js"
      issue: "8175-8193 updateStreamingBubble 只更新 .ai-message-content，不重建 pill / 折叠块"
  missing:
    - "回填 `userMsg.skillInvocation` 后立即渲染该气泡的 pill 与折叠块（最小改法：只重绘这一条消息，避免整列重建丢滚动位置与流式光标）"
    - "补断言：发送 `/skill:<name> <args>` 后**无需任何额外交互**，用户气泡即含 `.ai-skill-pill` 与 `.ai-skill-content-box`（现测试面覆盖不到该时机）"
    - "回归：确认重发路径（`buildResendPayload` → 重新生成 / 错误重试，renderer.js:9896-9920）的折叠块刷新不受影响"
  debug_session: "(未派独立诊断：根因已由 UAT 决定性探针定位 —— 手动调用 renderAIMessages() 前后对照)"
```

```yaml
- gap_id: G-48-4
  truth: "AI 正在流式回复（或卡在工具确认卡片）时调用技能不得打断：新技能调用正常发出并流式回显；不出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示"
  status: resolved
  resolved_by: 48-05-PLAN.md
  resolved_at: 2026-09-12
  reason: "自动驱动实测（真实 dev 应用 + MS/Qwen3-8B）：技能调用后新气泡在 t=7372ms 变为「用户已取消」并 15s 零增长，停止按钮即刻回退，`.ai-skill-pill` 未出现、无 system-note；主进程日志确认 `/skill:demo` 已收到 —— 新一轮输出完全不可见。机制与 48-REVIEW.md CR-03 第 3-5 步逐条吻合（`state.aiCancelledByUser` 在 abort 后不复位 → 迟到 error 按「当前消息 id」= 新气泡归属 → 后续 `message_update` 因 `aiCurrentMessageId === null` 全丢）"
  severity: major
  test: 4
  root_cause: "`abortAIIfStreaming()`（`src/renderer.js:9046-9055`）置 `state.aiCancelledByUser = true` 后调 abort，**且不回滚该标记**；技能路径随后只就地复位流式状态（`renderer.js:8736-8740` 复位 `aiStreaming` / `aiCurrentMessageId`），未把「被取消的消息」与新消息隔离开。`ai:abort` 处理器**同步**返回（`ipc-handlers.js:1840-1846` 只调 `aiManager.abort()` 后立即 return），因此 renderer 的 `await` 先恢复、同步段已把 `state.aiCurrentMessageId` 指向**新气泡**。被中止那一轮的迟到 `error`（SDK `handleRunFailure` → `turn_end` 被 `ai-manager.js:1724-1731` 静默吞掉、`agent_end` 带 errorMessage → `ai-manager.js:1743-1748` 发 `'error'`）到达时，取消分支（`renderer.js:9315-9331`）按**当前** `aiCurrentMessageId`（= 新气泡）归属 → 把新气泡正文改成 `'*用户已取消*'` 并置 `aiCancelledByUser=false`、`aiCurrentMessageId=null`。此后新 run 的 `message_update`（`renderer.js:9244-9246`）与 `tool_execution_update`（`:9258-9260`）按 `m.id === state.aiCurrentMessageId`（恒 `null`）查找 → **全部丢弃**，停止按钮也提前回退。"
  artifacts:
    - path: "src/renderer.js"
      issue: "9046-9055 abortAIIfStreaming 置 aiCancelledByUser 后不复位，也没记录被取消的消息"
    - path: "src/renderer.js"
      issue: "8736-8740 技能路径只复位 aiStreaming / aiCurrentMessageId，未处理取消标记的生命周期"
    - path: "src/renderer.js"
      issue: "9315-9331 取消分支按「当前消息 id」归属，而非「被取消的那条消息」"
    - path: "ipc-handlers.js"
      issue: "1840-1846 ai:abort 同步返回，使新消息必然早于迟到事件，放大竞态窗口（可选：等 run settled 再返回）"
  missing:
    - "新增被取消消息锚点（如 `state.aiCancelledMessageId`）：`abortAIIfStreaming()` 在置 `aiCancelledByUser` 的同一处记录 `aiCurrentMessageId`，取消落点后清空"
    - "取消分支只作用于锚点消息（按 id 查找），**不得**读「当前」`aiCurrentMessageId`"
    - "`handleStopAI`（`renderer.js:8403-8413`）同样在取消落点后清空锚点，保持停止按钮语义不变"
    - "补一条覆盖「abort × 新消息」时序的测试（现测试面完全没有该时序；UAT 实测序列：新气泡 t≈7.4s 变「用户已取消」、其后 15s 零增长）"
  debug_session: "(未派独立诊断：根因已由 UAT 端到端实测复现，症状与 48-REVIEW.md CR-03 第 3-5 步逐条吻合)"
```

```yaml
- gap_id: G-48-3
  truth: "AI 正在流式回复时调用技能不得打断：新技能调用正常发出并流式回显；不出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示"
  status: resolved
  resolved_by: 48-06-PLAN.md
  resolved_at: 2026-09-12
  reason: "User reported: 确定（2026-09-12 裁决方案 A）—— 发送路径的本地预检用可能陈旧的 `state.aiSkills` 快照否决调用（`known` / `known.disabled` 两段），违反 2026-09-11「调用瞬间实时读盘」硬约束；运行期新增技能 + 从未打开过 `/` 面板 → 「未找到技能」且输入框被清空，主进程无机会读盘"
  severity: major
  test: 3
  root_cause: "发送路径在 renderer 侧用可能陈旧的 `state.aiSkills` 快照做**本地否决**（`src/renderer.js:8719-8732` 的 `known` 未命中分支与 `known.disabled` 分支），而该快照只在三处更新：启动一次性 `pullAiSkillsSnapshot()`（`renderer.js:4406`）、打开 `/` 面板时 `refreshSkills()` 回包（`openSlashPicker`，`:10228-10242`）、以及**仅面板打开期间**的 `skills:changed` 广播（`:4400-4403` 的 `if (!state.slashPickerOpen) return;`）。于是「运行期新增技能（AI 经 write/bash 建目录 → 主进程 idle 边界重扫并广播）+ 从未打开过 `/` 面板 → 手打 `/skill:newname`」会走进死路：本地判「未找到技能」并**清空输入框**，主进程从未收到请求，其唯一被要求的「调用那一刻实时读盘」没有机会执行。该预检是**纯冗余**：两种失败的主进程文案（`ai-manager.js:6087-6098` 的 `skill_disabled` / `skill_not_found`）与 renderer 本地两段分支**一字不差**，删除后 UX 零变化。属对 48-01 Task 3 ② / 48-02 明文要求的计划偏离（用户 2026-09-12 裁决背书）。"
  artifacts:
    - path: "src/renderer.js"
      issue: "8719-8732 known 未命中 / known.disabled 两段本地否决（含清空输入框）"
    - path: "src/renderer.js"
      issue: "4400-4403 skills:changed 在面板关闭时早退，导致快照在面板关闭期间永不更新"
    - path: "src/renderer.js"
      issue: "4406 仅启动一次预热，覆盖不到「运行期新增技能」"
  missing:
    - "删除 `known` / `known.disabled` 两段本地否决 —— 快照未命中时照常发主进程，由既有 `skillError` 回滚链路（`renderer.js:8851-8859`）呈现提示与撤销气泡"
    - "确认删除后两条提示仍由主进程文案经该链路呈现（`ai-manager.js:6090-6098`），renderer 不重复实现文案"
    - "同步核对并更新 48-01 Task 3 ② 与 48-02 中「要求该本地预检」的明文，使计划/实现/文档一致（README 与 48-01-PLAN 的源码扫描断言若涉及该分支需一并调整）"
    - "加固（可选但建议）：`skills:changed` 无条件 `pullAiSkillsSnapshot()`（只拉快照、不触发刷新，无自激回路），使面板行在重新打开前也不显示陈旧状态"
  debug_session: "(未派独立诊断：根因由代码直读 + 主进程文案逐字核对确定)"
```

```yaml
- gap_id: G-48-2
  truth: "`frontmatter name ≠ 目录名` 的技能在面板列出且可选中，点击或手打 `/skill:<目录名>` 应能正常调用（调用瞬间实时读盘，注入以目录名为权威的正文），与 `docs/product/ai-skills.md` §10.4「能显式调用 ✅」一致"
  status: resolved
  resolved_by: 48-04-PLAN.md
  resolved_at: 2026-09-12
  reason: "User reported: 修吧（2026-09-12 裁决按 CR-02 路径判据修复）—— `readSkillForInvocation`（`ai-skills-manager.js:806-811`）以「名字相等」当同一性判据，而名字正是合法会不一致的那个字段；`skills.find(s => s.name === name) || skills[0]` 的兜底被紧随其后的 `fresh.name !== name` 直接作废"
  severity: major
  test: 2
  root_cause: "`readSkillForInvocation`（`ai-skills-manager.js:806-811`）把「SDK 从磁盘读回来的 `fresh.name` 是否等于入参 `name`」当作「读到的还是同一个技能」的判据。但 SDK 的 `Skill.name` 是 `frontmatterName || parentDirName`（`dist/harness/skills.js:218-219`），而 Realm 的「目录名权威」（`enforceDirNameAuthority`，`ai-skills-manager.js:329-341`）**只作用于缓存层**、读盘路径走 SDK 原生解析不接受重写 —— 两者在 `frontmatter name ≠ 目录名` 时必然不一致，于是 `:811` 恒判 `not_found`。`:806` 特意写的 `|| skills[0]`（注释自陈「想兜住 name 不一致」）被 `:811` 立即作废，两行自相矛盾。该形态技能是 D-08 明确要保留的合法技能（GitHub 导入常见），本阶段又把显式调用做成它们的主要可用路径。测试面永久盲区：`tests/test-ai-skills.js` 的 helper 恒写 `name: <目录名>`，`fresh.name !== name` 现有用例造的是「目录被换成别的技能」，与 name≠目录名 在实现里不可区分。"
  artifacts:
    - path: "ai-skills-manager.js"
      issue: "806-811 以 name 相等作同一性判据；806 的 || skills[0] 兜底被 811 作废"
    - path: "ai-skills-manager.js"
      issue: "329-341 enforceDirNameAuthority 只重写缓存层 name，读盘路径不享有该权威"
    - path: "tests/test-ai-skills.js"
      issue: "skill 写入 helper 恒写 name = 目录名，name≠目录名 永久无覆盖"
  missing:
    - "判据改为**目录路径**相等：`path.resolve(path.dirname(entry.skill.filePath)) === path.resolve(path.dirname(fresh.filePath))`；路径不等才判「目录被换成别的技能」→ not_found"
    - "注入用的 name **仍取目录名**（保持 D-08 防冒名语义），不得改用 `fresh.name`；空正文检查保持原序"
    - "补一条 name ≠ 目录名 的用例（含正例：可正常调用；负例：目录被换成另一技能仍 not_found）—— 需先给测试 helper 增加「写 name 与目录名不同」的能力"
    - "核对 docs/product/ai-skills.md §10.4「正常 → 能显式调用 ✅」在该修复后成立（修复前该表述与实现分叉）"
  debug_session: "(未派独立诊断：根因由代码直读确定，两行自相矛盾为决定性证据)"
```

```yaml
- gap_id: G-48-12
  truth: "在 `agent-workspace/managed-skills/` 下运行期新建技能目录（不打开 `/` 面板），直接手打 `/skill:<新名>`：请求到达主进程并由其当场读盘 → 正常调用（不出现「未找到技能」）"
  status: resolved
  resolved_by: 48-07-PLAN.md
  resolved_at: 2026-09-12
  resolution_evidence: "round 3 UAT test 14 自动驱动实测（2026-09-12，`/tmp/uat48-r3-t14.json`）—— 启动后新建 `managed-skills/uat-r3-24650778/SKILL.md`、全程不打开 `/` 面板、不重启不重建 Agent，直接发 `/skill:uat-r3-24650778 你好`：发送前 `getSkills()` 快照 `containsNew:false`（4 项）；主进程日志出现 `发送消息: /skill:uat-r3-24650778 你好`（该行位于解析成功之后）；零 system-note；回复 `探针技能已生效` 与新文件正文逐字一致；pill + 折叠块 `技能正文（23 字符）`。代码面（48-07）与运行期面双闭合，`.planning/WINDOWS.md` unrun-verify id 24 同步转 fixed。"
  reason: "User reported: 自动驱动实测（2026-09-12 round 2）—— A 段（renderer 本地否决已移除）通过；B 段与 B2 判别性补测显示**主进程缓存门**使运行期新增技能仍判「未找到技能」：`readSkillForInvocation`（ai-skills-manager.js:803-804）在触盘前用 `_cache.skills` 做存在性门，缓存未命中即 not_found；且纯 fs 变更无任何自动重扫触发"
  severity: major
  test: 12
  root_cause: "`readSkillForInvocation` 的存在性判据取自**缓存**而非磁盘（`_cache.skills.find(e => e.skill.name === name && e.shadowed !== true)`，未命中直接 not_found，读盘路径不执行）。缓存只由 3 个显式 `refreshSkills()` 调用点刷新（ai-manager.js:868 Agent 创建 / :2763 `syncAgentSystemPrompt` / :2840 `_recreateAgent`），而 `syncAgentSystemPrompt` 的唯一常规入口是「打开 `/` 面板」（`ai:refresh-skills`）；`_skillsPromptDirty` idle 补刷（:1325-1334）不是独立触发源 —— 该标记只由 `syncAgentSystemPrompt` 自身在忙时置位。全仓无 fs watcher / 定时器 / 写工具钩子 → 运行期新增技能目录（含 AI 经 write/bash 创建）永不自动进缓存。B2 判别性补测：同一技能、同一磁盘状态，无重扫必失败（14ms 内 note，主进程无 `发送消息` 日志），`ai.refreshSkills()` 后原样重发即正常调用。"
  artifacts:
    - path: "ai-skills-manager.js"
      issue: "802-804 触盘前用 _cache.skills 做存在性门，与「调用瞬间实时读盘」硬约束冲突"
    - path: "ai-manager.js"
      issue: "2763 syncAgentSystemPrompt 为唯一常规重扫入口，调用方仅打开面板；无写工具钩子"
    - path: "ai-manager.js"
      issue: "1325-1334 _skillsPromptDirty idle 补刷块非独立触发源"
  missing:
    - "（已处置 48-07）定口径 —— 采用第三条路线：**不改 `ai-skills-manager.js`**，改在调用侧 `_resolveSkillInvocation`，miss 时至多一次经 `syncAgentSystemPrompt()` 重扫后重读盘"
    - "（已处置 48-07）shadowed / disabled / tier 取值来源 —— 全部由同一条 `refreshSkills` 管线产出，未写第二套遮蔽判定；「按目录直读回退探测」被明确否决"
    - "（已处置 48-07）补覆盖「运行期新增技能目录 → 直接 /skill: 调用」的测试 —— `tests/test-ai-skills.js` J 组 7 例（139 例总数）"
    - "（**已闭合** round 3 item 14）**运行期面实测**：真实 dev 应用里的端到端探针通过（见 `resolution_evidence`）；`.planning/WINDOWS.md` unrun-verify id 24 已 `windows fixed`，本条 `status` 已回填 `resolved`"
  debug_session: "(未派独立诊断：根因由源码直读 + B2 判别性对照确定)"
```

```yaml
- gap_id: G-48-18
  truth: "运行期新增技能在**纯文本流**下也最终落地：`/skill:<新名>`（无 @ 引用与附件，走 `ai.prompt`）成功后，延迟的 system prompt 回写与 `skills:changed` 广播应在本轮结束时执行一次，而非等到打开 `/` 面板或重建 Agent；模型自动匹配（D-18 的 `read` + description 路径）与已打开的 `/` 面板随后都能看到新技能"
  status: failed
  reason: "User reported（2026-09-12 裁决）：取**路线 A** —— 补 flush，使纯文本流也落地回写 + 广播。WR-07：`_skillsPromptDirty` 全仓唯一消费点在 `promptWithContext()` 成功路径，而常规 `/skill:` 走 `ai.prompt`；48-07 把「置脏」从罕见（流式中打开面板）变成常规（任一次 miss），于是「缓存已含新技能、system prompt 不含」成为默认态"
  severity: minor
  test: 18
  root_cause: "`_skillsPromptDirty` 的读写点只有 4 处（init `ai-manager.js:713` / 唯一消费点 `:1325`（在 `promptWithContext()` 成功路径）/ 失败恢复置脏 `:1331` / 唯一置脏点 `:2815`（`syncAgentSystemPrompt` 忙分支））。`prompt()` 的成功出口（`:1084-1088`：`isProcessing = false` → `return`）**没有**对应补刷；而 renderer 只在「有 @ 引用或附件」时才走 `promptWithContext`（`src/renderer.js:8783`），常规 `/skill:<name>` 走 `else` 分支的 `ai.prompt(text)`（`:8799`）；`regenerateMessage`（`:9993`）与 `showAIError` 重试（`:10071`）同走 `ai.prompt`。后果：① `_skillsPromptDirty` 无限期保持 true；② `agent.state.systemPrompt` 不含运行期新增技能 → 模型自动匹配不可见；③ `skills:changed` 永不广播 → 其他窗口/已开面板投影陈旧。且 `docs/product/ai-skills.md:401` 与 `ai-manager.js:1433` 两处措辞写「下一轮 idle 边界」，而 idle 边界只存在于 `promptWithContext`。"
  artifacts:
    - path: "ai-manager.js"
      issue: "1084-1088 `prompt()` 成功出口缺一次 flush（与 :1323-1336 的 promptWithContext 补刷块不对称）"
    - path: "ai-manager.js"
      issue: "1325-1334 唯一消费点内联在 promptWithContext 里，未抽成可共用实现（直接复制一份即为「第二份实现」，违反单源）"
    - path: "docs/product/ai-skills.md"
      issue: "401 行「下一轮 idle 边界」措辞与实际不符（须随修复一并收口）"
    - path: "ai-manager.js"
      issue: "1433 注释同上（「延后到下一次非忙同步点（打开面板 / Agent 重建 / 下一轮 idle 边界）」）"
  missing:
    - "抽出唯一实现 `_flushDeferredSkillsPrompt()`（`if (!this._skillsPromptDirty) return;` → 置 false → `try { await this.syncAgentSystemPrompt() } catch { 置 true + console.warn }`，失败恢复语义与 `:1330-1332` 一致）"
    - "`prompt()` 成功出口（`:1084` 之后、`return` 之前）与 `promptWithContext()` 的 `:1323-1334` **两处共用**该方法（不得写第二份）"
    - "同步更新 `docs/product/ai-skills.md:401` 与 `ai-manager.js:1433` 的措辞，并在 docs §10.7 写明修复后的落地时机"
    - "补断言：纯文本 `/skill:` 成功后 `_skillsPromptDirty` 归 false 且 `agent.state.systemPrompt` 已含新技能（现测试面只覆盖 `promptWithContext` 半边与忙分支置脏）"
    - "回归：错误出口与 `_cleanupCurrentAgent` 仍**不**补刷（避免同一次运行双刷）"
  debug_session: "(未派独立诊断：根因由 48-REVIEW.md WR-07 的源码直读 + 读写点枚举确定；本轮 orchestrator 已核对 `ai-manager.js:1084-1088` 与 `:1325-1334` 现状)"
```

```yaml
- gap_id: G-48-19
  truth: "缓存未命中后的重扫若抛错，`_resolveSkillInvocation` 必须**保留原判定**且不把「未找到」升级为异常：返回码域仍只有 `not_found | disabled`；且该分支有可失败的行为用例把三件事钉住（不逃逸异常 / 不重复读盘 / 沿用原判定）"
  status: failed
  reason: "User reported（2026-09-12 裁决）：**修复 + 补行为用例**。WR-08：48-07 自述的第三条不变式（「重扫抛错被就地 catch + 告警后保留原判定，不把「未找到」升级成异常」）只被断言、未被强制：① 重试读盘在 `try` 之外；② catch 之后是**替换**判定而非保留；③ catch 体内 `err.message` 对非对象抛出值会二次抛错；④ 该分支零行为用例，唯一护栏是 `body.includes('console.warn')` 这种字符串存在性断言。"
  severity: minor
  test: 18
  root_cause: "`ai-manager.js:1460-1468` 的新增块：`try { await this.syncAgentSystemPrompt() } catch (err) { console.warn('…', err.message) }` 之后**在 try 之外**执行 `result = await skillsManager.readSkillForInvocation(this.sandboxEnv, parsed.name)`。故 (a) 「不升级为异常」只覆盖 `syncAgentSystemPrompt()` 一侧，重试读盘的抛出点（`ai-skills-manager.js:808` 动态 import，位于它自己 try 之外）会穿透到两处**裸调**点（`ai-manager.js:1046` / `:1174`，同 WR-02），而 `isProcessing` 已为 true 且不复位；(b) catch 后仍执行重试读盘 → **覆盖**（而非保留）原判定对象，注释的「保留原判定」字面不成立；(c) `:1465` 直接读 `err.message`，`throw null` / 原始值会二次抛 TypeError，恰好把「绝不升级为异常」反转；(d) `tests/test-ai-skills.js:2919` 仅断言方法体含 `console.warn` 字符串，无法承载语义。可达性诚实标注：`:1445` 已成功 import 过同一说明符，ESM 注册表缓存使 `:1467` 再 import 基本不会拒绝 —— 本条不是新引入的可达故障，而是「新增调用点同样落在 try 外，与刚写下的不变式不符」。"
  artifacts:
    - path: "ai-manager.js"
      issue: "1467 重试读盘在 :1461-1466 的 try/catch 之外"
    - path: "ai-manager.js"
      issue: "1467 catch 后仍赋 result → 替换而非保留原判定"
    - path: "ai-manager.js"
      issue: "1465 catch 内直接读 err.message，非对象抛出值会二次抛错（同文件 ai-skills-manager.js:634 已有正确形态可对齐）"
    - path: "tests/test-ai-skills.js"
      issue: "2909-2921 唯一护栏是 console.warn 字符串存在性断言，该分支零行为用例"
    - path: "ai-manager.js"
      issue: "1046 / 1174 裸调 _resolveSkillInvocation（与仍开的 WR-02 同根：抛出即 isProcessing 永不复位）"
  missing:
    - "把重试读盘纳入独立 `try`，失败时**沿用原判定**（不赋 result、不逃逸），并对齐 `err && err.message ? err.message : String(err)` 取值形态"
    - "catch 内两条告警文案区分「重扫失败」与「重试读盘失败」，便于行为用例判别"
    - "补该分支行为用例（夹具复用 J 组 `skillResolveCtx`，覆写 `syncAgentSystemPrompt` 为 `() => { throw new Error('boom') }`）：断言返回码仍 `not_found`、未抛异常、`readSkillForInvocation` 未被重复调用（或按裁定调用一次）"
    - "补 `throw null` / `throw 'x'` 形态的用例，钉住 catch 体不二次抛错"
    - "同步更新 `ai-manager.js:1427-1429` 的注释承诺，使其与实现字面一致"
  debug_session: "(未派独立诊断：根因由 48-REVIEW.md WR-08 的逐条核证 + 本轮 orchestrator 对 `ai-manager.js:1460-1468` 现状复核确定)"
```

## Deferred Follow-Ups

```yaml
- test: 1
  idea: "CR-01 面板行 `title` 属性逃逸注入 —— 裁决延后（用户 2026-09-12，「暂时不发版」为前提）"
  debt_ref: "48-REVIEW.md TD-48-01"
  owner_trigger: "Phase 49 开工前第一条（manage_skill 落地前）"
  deferred_at: 2026-09-12
  evidence_addendum: "test 5 实测（2026-09-12）：属性逃逸成立，但主窗口 CSP 拦掉内联处理器 → 代码不执行，定级由 blocker 更正为 minor；TD-48-01 已回写"
- test: 18
  idea: "WR-07 —— `_skillsPromptDirty` 的延迟回写/广播在纯文本流上永不落地（唯一消费者在 `promptWithContext()`，纯文本走 `ai.prompt`），48-07 把「置脏」从罕见变常规"
  debt_ref: "48-REVIEW.md WR-07"
  deferred_at: 2026-09-12
  status: "**已撤销延后** —— 用户 2026-09-12 裁决取**路线 A（补 flush）**，已转为 gap **G-48-18**，待 `/gsd-execute-phase 48 --gaps-only`"
- test: 18
  idea: "WR-08 —— 48-07 自述的「重扫抛错保留原判定」只被断言未被强制，且该分支零行为用例"
  debt_ref: "48-REVIEW.md WR-08"
  deferred_at: 2026-09-12
  status: "**已撤销延后** —— 用户 2026-09-12 裁决取**修复 + 补行为用例**，已转为 gap **G-48-19**，待 `/gsd-execute-phase 48 --gaps-only`"
```

> **本节状态更正（2026-09-12 round 3 收尾）**：上面两条 WR 原本登记为「延后到 Phase 49 开工前」。
> round 3 test 18 的裁决把它们改为**本阶段闭合**，故已撤销延后、转为 gap G-48-18 / G-48-19。
> 仅 **TD-48-01（CR-01 面板行 `title` 属性逃逸）** 仍保持延后（test 1 的原裁决不变）。
> 另：**TD-48-02（CR-05）** 的延后状态同样不变（test 11 未实测，见上）。

## 更正（G-48-12 立项时，2026-09-12）

本节为**纯追加**的事后更正，不修改上方任何既有记录（含 `## Gaps` 的 YAML 块）。逐条如下：

1. **更正 G-48-3 的 `root_cause` 括注中的错误前提**。该括注写作「运行期新增技能（AI 经 write/bash 建目录 → 主进程 idle 边界重扫并广播）」，描述的链路**在代码里并不存在**：`_skillsPromptDirty`（`ai-manager.js` 的 idle 补刷块）**不是独立触发源** —— 该标记只由 `syncAgentSystemPrompt()` 自身在「忙」时置位，而它的常规入口只有「打开 `/` 面板」。因此「运行期新增技能」当时并**没有**任何可依赖的自动重扫；括注把「本应发生」误写成了「已存在」。
2. **真正的失效点与修复口径**。失效点不在 renderer（48-06 已修那半边），而在主进程：`readSkillForInvocation`（`ai-skills-manager.js:802-804`）在触盘**之前**用 `_cache.skills` 做存在性门，缓存未命中即判「不存在」，读盘路径根本不执行。48-07 在**调用侧**（`_resolveSkillInvocation`）对「不存在」判定做**至多一次**的 `syncAgentSystemPrompt()` 权威重扫 + 重试读盘；因此 shadowed（46 D-06 / D-11）、disabled（46 D-09 / D-10）、tier（D-14）三个字段全部来自 `refreshSkills` 同一条加载管线，不新增第二套判定。权威口径见 `.planning/phases/48-skill-name/48-07-PLAN.md` 的 `key-decisions`。
3. **交接**。本节**不**修改上方 `## Gaps` 里 `G-48-12` 的 `status: failed` —— 该 status 由重跑 `/gsd-verify-work 48` 的自动驱动探针（UAT test 12，B / B2 判别性复测形态：在 `managed-skills/` 下运行期新建目录后**不打开** `/` 面板，直接手打 `/skill:<新名>`）判定后回填。同一标准也适用于 `.planning/WINDOWS.md` 的 unrun-verify id 24（其机制描述已同步更正，status 保持 `open`）。

4. **交接已完成（2026-09-12 round 3 收尾追加）**。第 3 条所述的回填已执行：round 3 test 14 的自动驱动探针通过（见 `G-48-12` 的 `resolution_evidence`），`G-48-12` 的 `status` 已由 `failed` 回填为 **`resolved`**（`resolved_by: 48-07-PLAN.md`），`.planning/WINDOWS.md` unrun-verify id 24 同步 `windows fixed`。本追加**不改写**第 3 条原文，只记录其条件已满足。

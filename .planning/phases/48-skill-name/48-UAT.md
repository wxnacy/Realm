---
status: diagnosed
phase: 48-skill-name
source: [48-VERIFICATION.md]
started: 2026-09-12T06:55:00Z
updated: 2026-09-12T08:13:32Z
---

## Current Test

[testing complete]

## Tests

### 1. {阶段门槛} 裁决 48-REVIEW.md CR-01：面板行 `title` 属性逃逸
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

### 2. {阶段门槛} 裁决 48-REVIEW.md CR-02：`frontmatter name ≠ 目录名` 的技能不可调用
expected: 决定「按 CR-02 的路径判据修复 + 补一条 name≠目录名 用例」或「登记为技术债」；若不改，须同时修正 `docs/product/ai-skills.md` §10.4 的表述（现写「能显式调用 ✅」而实际 `readSkillForInvocation` 恒返回 `not_found`），以免产品说明与实现分叉。该行为是 48-01 PLAN 明确要求（`fresh.name !== name` → not_found，防冒名注入），非执行器偏离。
result: issue
reported: "修吧"
decision: 按 CR-02 的路径判据修复（用户 2026-09-12 裁决）→ gap G-48-2；§10.4 的 ✅ 随修复变为真实，无需改口径
severity: major

### 3. {阶段门槛} 裁决 48-REVIEW.md CR-04：renderer 陈旧快照否决调用
expected: 决定「移除本地否决、改由主进程 `skillError` 走既有回滚（D-13 推论）」或「让任何 `skills:changed` 都重拉快照」。现状下「运行期新增技能 + 从未打开过 `/` 面板」会得到「未找到技能」且输入框被清空，与「调用瞬间实时读盘」的用户硬约束（2026-09-11）存在张力；该预检是 48-01 Task 3 ② / 48-02 明文的计划要求，是否放宽需人工裁决。
result: issue
reported: "确定"
decision: 方案 A —— 移除本地否决（`known` / `known.disabled` 两段分支），改由主进程 `skillError` 走既有回滚；用户 2026-09-12 拍板 → gap G-48-3
verification_note: |
  裁决时已核实该预检是**纯冗余**：主进程对两种失败产出的文案与 renderer 本地分支**一字不差**
  （`ai-manager.js:6090-6098` 的 `skill_disabled` / `skill_not_found`），故删掉后 UX 零变化、无提示丢失。
  删它属对 48-01 Task 3 ② / 48-02 明文要求的**计划偏离**，本行裁决即其背书。
severity: major

### 4. 真实环境验证 CR-03 时序：流式回复中调用技能
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

### 5. 安全回归实测：目录名含 `"` 的技能行
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

### 6. {UAT} 真实 Electron 端到端：气泡视觉与 IPC 往返
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

### 7. {UAT} 50+ 技能数据集下 220px 面板观感（48-02 backstop）
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

### 8. {UAT} 模型自动匹配技能的可见性（DISC-05 核心）
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

## Summary

total: 8
passed: 3
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

```yaml
- gap_id: G-48-6
  truth: "输入 `/skill:<真实技能名> 参数` 回车后，用户气泡应立即呈现三件套：技能 pill（文案「技能」+ 技能名）+ args 正文 + 默认折叠的「技能正文（N 字符）」块"
  status: failed
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
  status: failed
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
  status: failed
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
  status: failed
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

## Deferred Follow-Ups

```yaml
- test: 1
  idea: "CR-01 面板行 `title` 属性逃逸注入 —— 裁决延后（用户 2026-09-12，「暂时不发版」为前提）"
  debt_ref: "48-REVIEW.md TD-48-01"
  owner_trigger: "Phase 49 开工前第一条（manage_skill 落地前）"
  deferred_at: 2026-09-12
  evidence_addendum: "test 5 实测（2026-09-12）：属性逃逸成立，但主窗口 CSP 拦掉内联处理器 → 代码不执行，定级由 blocker 更正为 minor；TD-48-01 已回写"
```

---
phase: 42-ai-pi-agent
plan: 06
subsystem: ai
tags: [sqlite, better-sqlite3, renderer, message-merge, display-shape, injection-shape, empty-bubble-guard, streaming]

# 依赖图
requires:
  - phase: 42-ai-pi-agent
    provides: 42-04 消息存储管线归一化（saveMessages 写入侧 + parseStoredContent 旧格式兼容读出 + getAgentMessages 注入形状 CR-01/D-14 语义）；诊断结论 .planning/debug/tool-card-empty-bubble.md（G-42-8 根因闭环：存储行序正确，仅恢复侧分组/守卫缺失）
provides:
  - getMessages 同回合相邻 assistant 行合并（显示形状根因修复）：工具回合恢复为单条消息（content=最终文本、toolExecutions=该回合全部卡片），文本在上卡片在下
  - renderAIMessages 空 content 气泡守卫（防御修复）：流式末条占位豁免，历史恢复渲染不再产生空气泡（不以工具卡片存在为前提）
  - /tmp 冒烟双形状证明（48 项断言）：显示形状合并正确 + getAgentMessages 注入形状逐字段不变
affects: [ai-chat, renderer, uat-retest, conversation-history]

# 实际度量
actuals:
  tokens: 1941
  tasks: 2
  commits: 2

# 技术追踪
tech-stack:
  added: []
  patterns: [same-turn-assistant-row-merge, empty-content-bubble-guard, display-injection-shape-separation, first-row-id-anchor]

key-files:
  created: []
  modified:
    - ai-conversations-manager.js
    - src/renderer.js

key-decisions:
  - "显示/注入双形状分离（D-14）：同回合合并只发生在 getMessages 显示读出侧，getAgentMessages 行级结构零改动（CR-01 配对合成与 toolResult 上下文语义保持），冒烟 Test 6 逐字段锁定"
  - "合并规则保守化：纯工具行卡片追加进上一条（规则 1）、有文本且上一条 content 为空时采纳文本（规则 2）、双文本行保守不合并（规则 3）保持既有显示语义；中断回合尾部纯工具行保留 content:'' 行语义（读出层不虚构文本），由 renderer 守卫承接"
  - "合并保持回合首行 id/timestamp 锚点不变：工具卡片定位与消息操作按钮依赖该 id（冒烟 Test 7 断言）"
  - "renderer 守卫不以工具卡片存在为前提：覆盖中断残留行 + 无工具调用的空 assistant 行（getAgentMessages 约 641-642 行防御性跳过同类形状，证明其可能落库）；流式末条占位豁免用字面形式 state.aiStreaming && isLast（verify 静态门依赖该字面写法，豁免条件内联先于守卫判断）"

patterns-established:
  - "同回合行合并模式：读出侧把 pi-agent-core 的 [assistant(''+tool_calls) → toolResult → assistant(text)] 三行回合折叠为单条显示消息——text 采纳进 content 为空的前条，toolResult 按 toolCallId 反向扫描回填不受影响"
  - "空 content 气泡守卫模式：assistant 空 content 且非流式末条时跳过 .ai-message-content 创建与挂载，守卫分支不引用 content 变量（不创建即不引用），气泡 append、markdown 渲染、typing 指示器分支全部原位"

requirements-completed: [CONV-01]

# 覆盖元数据
coverage:
  - id: D1
    description: "getMessages 同回合 assistant 行合并（G-42-8 根因修复）：标准工具回合与多轮工具回合合并为单条消息（content=最终文本、toolExecutions 卡片 result/status 完整回填）、纯文本对话无回归、双文本行保守不合并且不产生 content:'' 消息、中断残留行保留行语义、合并锚定回合首行 id/timestamp"
    requirement: CONV-01
    verification:
      - kind: unit
        ref: "command: node /tmp/realm-g42-8-smoke.js（better-sqlite3 真库 + electron stub 落临时目录，7 组场景 48 项断言全过）"
        status: pass
      - kind: other
        ref: "command: node --check ai-conversations-manager.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "getAgentMessages 注入形状零变化（D-14/CR-01 语义不受影响）：同一批行输出 3 条 AgentMessage（assistant(toolCall) → toolResult → assistant(text)），toolCall/toolResult 配对完整、顺序不变"
    requirement: CONV-01
    verification:
      - kind: unit
        ref: "command: node /tmp/realm-g42-8-smoke.js（Test 6 注入形状断言组：角色顺序/toolCall 块/toolResult 配对/末条 text 块）"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderAIMessages 空 content 气泡守卫（G-42-8 防御修复）：assistant 空 content 且非流式末条占位时跳过 .ai-message-content 创建与挂载，不以工具卡片存在为前提（有卡片仅渲染工具卡片容器与操作按钮，无卡片不留任何可见气泡）；守卫分支不引用 content 变量"
    requirement: CONV-01
    verification:
      - kind: other
        ref: "command: node --check src/renderer.js + 静态门（计划 verify 命令：renderAIMessages 函数体内 'state.aiStreaming && isLast' ≥1 且 '!msg.content' ≥1）"
        status: pass
    human_judgment: true
    rationale: "静态门只证明守卫代码落地；「历史恢复渲染不再出现空气泡 div（无论有无工具卡片）」是真实 Electron 运行时渲染效果，需 GUI 观察（计划 verification 4 人工复测），待 UAT 复测"
  - id: D4
    description: "历史恢复视图与实时视图同构（must_haves truths 1/2/3）：重启打开或切换含工具调用的对话时 AI 文本气泡在上方、工具卡片在下方同属一条消息、无空气泡残留；实时流式路径（占位气泡/typing 指示器/流式文本覆盖）行为不变"
    requirement: CONV-01
    verification: []
    human_judgment: true
    rationale: "端到端运行时行为（完全退出重启 + 切换对话 + 实时流式对照）需真实 Electron GUI 与用户操作，计划 verification 4 明确为人工复测（UAT），自动化冒烟无法覆盖"

# 度量
duration: 20min
completed: 2026-09-02
status: complete
---

# Phase 42 Plan 06: 历史恢复同回合合并与空气泡守卫（G-42-8）Summary

**getMessages 同回合 assistant 行合并（显示形状根因修复）+ renderAIMessages 空 content 气泡守卫（防御修复）——工具回合历史恢复与实时视图同构，getAgentMessages 注入形状零变化（48 项冒烟断言全过）**

## Performance

- **Duration:** 20 min（分两个会话：Task 1 约 12 min + Task 2 续跑会话约 8 min，见 Issues Encountered）
- **Started:** 2026-09-02T00:08+08:00（编排器启动 Phase 42 执行）
- **Completed:** 2026-09-02T09:30+08:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- ai-conversations-manager.js（Task 1，G-42-8 根因修复）：getMessages 在 assistant 行处理分支内实现同回合相邻 assistant 行合并（仅显示形状）——先按既有逻辑解析 text 与 toolCalls，取 display 末元素 last（仅当 last 存在且 role 为 assistant，天然不跨 user 行）：① 纯工具行（text 空且 toolCalls 非空）→ 卡片追加进 last.toolExecutions 不 push；② 有文本且 last.content 为空 → 文本采纳进 last（当前行若带 toolCalls 一并追加避免丢卡片），toolResult 按 toolCallId 反向扫描回填不受影响；③ 双文本行维持独立 push 保守不合并。合并保持 last 的 id/timestamp 不变（回合首行锚点）。getAgentMessages、saveMessages、normalizeMessageColumns、parseStoredContent、readMessageRows 零改动（存储管线 42-04 已验证勿动，CR-01/D-14 上下文注入语义保持）
- src/renderer.js（Task 2，G-42-8 防御修复）：renderAIMessages 在创建 .ai-message-content 气泡 div 之前加守卫——`const skipBubble = !isUser && !msg.content && !(state.aiStreaming && isLast)`，skipBubble 时 content 保持 null、跳过气泡创建与 appendChild（无论有无工具卡片：有卡片仅渲染工具卡片容器与消息操作按钮，无卡片的空行不留任何可见气泡）。守卫不以 toolExecutions 非空为前提；AI 消息 markdown 渲染分支改 `else if (content)` 进入，守卫分支内不引用 content 变量；typing 指示器分支（state.aiStreaming && !isUser && isLast && !msg.content）与守卫互斥（该分支必然豁免占位气泡），流式路径零回归；wrapper.dataset.messageId 与 createMessageActions 在守卫分支照常渲染；JSDoc 补守卫语义（G-42-8）。main.css 未动（呈现层背景+padding 是正常气泡样式，空气泡消失由 DOM 层守卫保证）
- /tmp/realm-g42-8-smoke.js（计划规定的 /tmp 冒烟，better-sqlite3 真库 + electron stub Module._load 拦截落临时目录）：7 组场景 48 项断言全过——T1 标准工具回合（user + 1 assistant 合并消息，content=最终文本、1 卡片回填）、T2 多轮工具回合（2 卡片各自 result 正确）、T3 纯文本回归（2 条不变）、T4 双文本行保守不合并（无 content:'' 产出）、T5 中断尾部纯工具行（保留 content:'' 行语义带卡片，由守卫承接）、T6 getAgentMessages 注入形状逐字段不变（3 条 AgentMessage、CR-01 配对完整）、T7 合并锚定回合首行 id/timestamp

## Task Commits

Each task was committed atomically:

1. **Task 1: getMessages 同回合 assistant 行合并（G-42-8 根因修复）** - `70e0524` (fix)
2. **Task 2: renderAIMessages 空 content 气泡守卫（G-42-8 防御修复）** - `3df5f56` (fix)

**Plan metadata:** see git log（docs(42-06): complete + STATE/ROADMAP 更新提交）

## Files Created/Modified

- `ai-conversations-manager.js` - getMessages 同回合合并逻辑（3 条规则）+ JSDoc 更新（引用 G-42-8，注明仅显示形状、注入形状不受影响）
- `src/renderer.js` - renderAIMessages 空 content 气泡守卫（skipBubble 计算 + content 可空化 + AI 分支/append 条件化）+ JSDoc 守卫语义

## Decisions Made

- 显示/注入双形状严格分离：合并只改 getMessages 显示读出形状，getAgentMessages 行级结构零改动——LLM 上下文注入依赖行级结构（CR-01 孤儿 toolCall 合成、D-14 工具结果上下文语义），冒烟 Test 6 同批行逐字段锁定注入形状不变
- 中断回合尾部纯工具行保留 content:'' 行语义（读出层不虚构文本），渲染层由守卫承接（有卡片仅渲染卡片、无卡片不留痕）——读出层与渲染层职责清晰分界
- 守卫豁免流式末条占位采用字面形式 `state.aiStreaming && isLast`（计划执行注记要求，verify 静态门 grep 依赖该字面写法；与既有 typing 指示器分支条件一致）
- 合并锚点取回合首行 id/timestamp：工具卡片定位（wrapper.dataset.messageId）与消息操作按钮依赖稳定 id

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- 本计划跨两个 executor 会话完成：Task 1 由前一次会话实现并提交（70e0524，含 /tmp 冒烟脚本），会话中断于 Task 2；本次续跑会话未重做 Task 1，先重跑全部验证（冒烟 48/48 pass + 双 node --check）确认前次提交完好，再接续完成并提交 Task 2（3df5f56）
- `/tmp/realm-g42-8-smoke.js` 按计划规定存放于 /tmp（仓库外），重启后不保留——冒烟结论已录入本 SUMMARY coverage D1/D2；如需复跑可按 plan verify 节的 electron stub 方式重建
- `.planning/milestone.lock` 为 execute-phase 编排器运行时锁文件（含 pid），属编排器管理，保持未跟踪不提交

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 42 全部 6 个计划执行完毕（42-01..42-06），UAT 8 项测试的 gap（G-42-1..G-42-8）代码层全部闭环——本计划收口 G-42-8（第 2 轮 UAT 测试 3 的工具卡片/空气泡渲染问题）
- 待 `/gsd-verify-work` UAT 复测确认运行时行为：让 AI 调用任一工具 → 完全退出重启 → 打开该对话（文本在上、卡片在下、同属一条消息、无空气泡）；切换对话路径同样正确；实时对话（发送/流式/typing 指示器）与修复前一致——已录入 coverage D3/D4 human_judgment
- 存储层零变化（saveMessages / normalizeMessageColumns / 表结构未动），旧格式行兼容读出保持；威胁项 T-42-09（合并后内容仍走 renderAIMarkdown + DOMPurify 与 renderToolCard 结构化渲染，无新注入面）与 T-42-10（合并上限即一个回合行数，tool_calls/tool_results 列已有 100KB 截断）按计划处置落地
- REQUIREMENTS.md 无 CONV-* 条目（Phase 42 以 CONTEXT/UI-SPEC 承载需求），requirements-completed 按计划 frontmatter 记录（与前序计划一致）；Phase complete, ready for next step

## Self-Check: PASSED

- 2 个修改文件均在磁盘且 node --check 通过（ai-conversations-manager.js / src/renderer.js）
- 2 个任务提交存在于 git 历史：70e0524（Task 1）、3df5f56（Task 2）；提交无意外文件删除
- Task 1 verify 全过：node --check + /tmp 冒烟 7 组场景 48 项断言（标准/多轮工具回合合并、纯文本回归、双文本行、中断残留、注入形状、首行锚点）
- Task 2 verify 全过：node --check + 静态门（renderAIMessages 函数体内 'state.aiStreaming && isLast' 与 '!msg.content' 均命中）；守卫不以工具卡片存在为前提、守卫分支不引用 content 变量、typing 指示器/代码高亮/markdown 渲染逻辑原位
- 计划 verification 1/2/3（自动化）全部通过；verification 4（真实 Electron 人工复测）录入 coverage D3/D4 human_judgment 待 UAT

---
*Phase: 42-ai-pi-agent*
*Completed: 2026-09-02*

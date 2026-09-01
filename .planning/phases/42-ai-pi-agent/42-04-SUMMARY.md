---
phase: 42-ai-pi-agent
plan: 04
subsystem: ai
tags: [sqlite, better-sqlite3, content-blocks, normalization, agent-context, async, ipc, renderer]

# 依赖图
requires:
  - phase: 42-ai-pi-agent
    provides: 42-03 saveMessages 全量替换事务 + 惰性对话生命周期 + Agent 保证守卫（prompt/promptWithContext await _recreateAgent）
provides:
  - 消息存储管线内容归一化（写入侧按角色提取，assistant 行 content 列纯文本 + tool_calls 列结构化）
  - 双形状读出管线：getMessages renderer 显示形状 / getAgentMessages AgentMessage 注入形状
  - 旧 JSON 块数组行兼容读取（G-42-3 历史脏数据无需迁移）
  - switchConversation 异步上下文恢复（await Agent 重建后注入真实历史，G-42-4）
affects: [ai-chat, renderer, uat-retest]

# 实际度量
actuals:
  tokens: 5080
  tasks: 2
  commits: 2

# 技术追踪
tech-stack:
  added: []
  patterns: [write-side-content-normalization, dual-shape-read-pipeline, legacy-json-row-compat, async-agent-rebuild-await-injection]

key-files:
  created: []
  modified:
    - ai-conversations-manager.js
    - ai-manager.js
    - ipc-handlers.js

key-decisions:
  - "写入侧归一化：saveMessages 按角色提取列值——assistant 行 content 列存纯文本、toolCall 块序列化为 [{id,name,arguments}] 存 tool_calls 列；thinking 块不落盘（与实时链路 _extractText 展示语义一致）"
  - "双形状读出：getMessages 面向 renderer（assistant 行带 toolExecutions 工具卡片、toolResult 行回填不单独输出）；getAgentMessages 面向上下文注入（user/assistant/toolResult 三角色 AgentMessage，toolResult 按 D-14 参与上下文）"
  - "旧格式兼容不迁移：parseStoredContent 检测 content 列为合法 JSON 数组（G-42-3 根因落库的原始块数组）时按块解析，text 块拼显示文本、toolCall 块并入工具列表——历史脏数据读时兼容，无需一次性迁移"
  - "AgentMessage provenance 占位安全：重建的 assistant 消息用 api:'unknown'/usage 全 0/stopReason:'stop' 占位——pi-ai 各 API 适配器构建请求只读 role 与 content 块，不读 provenance 字段（诊断前置事实）"
  - "switchConversation 改 async 并 await _recreateAgent() 后注入：根因是同步帧内 this.agent 恒为 null（动态 import 之后才赋值），注入守卫恒 false；IPC 处理器对应 await"
  - "renderer 零改动：renderAIMessages 无未知 role 兜底分支、toolExecutions 卡片分支与行 id 操作按钮对显示形状即插即用（计划仅要求核对）"

patterns-established:
  - "写入侧归一化模式：SDK 内容块数组在持久化边界提取为列值，不在库里存原始 JSON"
  - "双形状读出模式：同一行数据经 parseStoredContent 派生显示形状（renderer）与注入形状（Agent），边界清晰互不渗漏"
  - "异步重建先行模式：切换对话先 await Agent 重建再注入历史，注入守卫只兜重建失败分支"

requirements-completed: [CONV-01, CONV-04]

# 覆盖元数据
coverage:
  - id: D1
    description: "写入侧归一化（G-42-3）：saveMessages 按角色提取——assistant 行 content 列纯文本、tool_calls 列 [{id,name,arguments}]、thinking 块不落盘；toolResult 行 tool_results 列含 toolCallId/toolName/isError/details；100KB 截断保持；全量替换事务结构不变"
    requirement: CONV-01
    verification:
      - kind: integration
        ref: "command: /tmp 冒烟测试（better-sqlite3 直查）— 4 条消息 transcript 落库后原始行 content/tool_calls/tool_results 列逐项断言通过；重复保存仍 4 行"
        status: pass
      - kind: other
        ref: "command: node --check ai-conversations-manager.js（计划 verify 命令）"
        status: pass
    human_judgment: false
  - id: D2
    description: "显示形状读出 + 旧 JSON 行兼容（G-42-3）：getMessages 返回 {id,role,content,toolExecutions,timestamp}，toolResult 行按 toolCallId 回填最近 assistant 行卡片（result/status/error），无独立 toolResult 气泡；手工构造的旧格式 JSON 块数组行（含 thinking/text/toolCall）兼容读出；损坏 tool_calls 列降级不抛异常（T-42-08）"
    requirement: CONV-01
    verification:
      - kind: integration
        ref: "command: /tmp 冒烟测试 — 旧格式行显示文本/工具卡片映射断言、4 行→3 条显示消息断言、'{broken json' 列降级断言全部通过"
        status: pass
    human_judgment: false
  - id: D3
    description: "注入形状读出（G-42-4）：getAgentMessages 返回三角色 AgentMessage 数组——assistant content 为 text 块 + toolCall 块原样（thinking 过滤、空 content 行跳过）、toolResult 含 toolCallId/toolName/isError/details、顺序保配对相邻"
    requirement: CONV-04
    verification:
      - kind: integration
        ref: "command: /tmp 集成冒烟 — 真实 pi-agent-core Agent 实例注入 getAgentMessages 输出，state.messages 4 条、convertToLlm 过滤全保留、toolCall 与 toolResult 相邻断言全部通过"
        status: pass
    human_judgment: false
  - id: D4
    description: "switchConversation 异步化（G-42-4）：await _recreateAgent() 后注入历史（注入守卫仅兜重建失败分支），注入条数日志；ai:switch-conversation 处理器 await 并返回显示形状 messages；42-03 prompt/promptWithContext Agent 保证守卫未被破坏"
    requirement: CONV-04
    verification:
      - kind: other
        ref: "command: node --check ai-manager.js ipc-handlers.js src/renderer.js + sed 顺序静态门（_cleanupCurrentAgent → getAgentMessages → await _recreateAgent → 注入）+ grep await this._recreateAgent()=3"
        status: pass
    human_judgment: true
    rationale: "「切换对话后继续提问 AI 能衔接先前上下文」（UAT Test 4）需要真实 LLM 往返观察回复引用历史，静态与离线冒烟无法证明，待 UAT 复测"
  - id: D5
    description: "重启后历史对话渲染恢复（G-42-3 端到端）：AI 气泡 markdown 渲染、工具调用显示为带参数/结果/状态的工具卡片、无原始 JSON 文本"
    verification: []
    human_judgment: true
    rationale: "需要真实 Electron 重启 + dev 库 + UI 观察（计划 verification 1/2），自动化冒烟已证明存储与读出层正确，渲染层与实时链路共用 renderAIMessages 但端到端仍需人工确认"

# 度量
duration: 6min
completed: 2026-09-01
status: complete
---

# Phase 42 Plan 04: 消息格式与上下文恢复修复（G-42-3 / G-42-4）Summary

**消息存储管线归一化（写入侧按角色内容提取 + 显示/注入双形状读出 + 旧 JSON 行兼容）+ switchConversation 异步等 Agent 重建后注入真实历史上下文**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-01T13:46:31Z
- **Completed:** 2026-09-01T13:52:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ai-conversations-manager.js：写入侧归一化——saveMessages 消息映射按角色处理（user 字符串原样/数组提取 text 块；assistant text 块拼显示文本、toolCall 块序列化 [{id,name,arguments}] 存 tool_calls 列、thinking 块不落盘；toolResult 文本存 content 列、{toolCallId,toolName,isError,details} 存 tool_results 列），msg.toolCalls/toolResults/page_snapshots 兜底与 100KB 截断保留，42-03 全量替换事务结构不变（G-42-3）
- ai-conversations-manager.js：新增 parseStoredContent 统一解析——旧格式行（content 列为合法 JSON 块数组字符串，G-42-3 根因落库）text 块拼显示文本、toolCall 块并入工具列表；新格式行 content 即显示文本；全部 JSON.parse 经 safeJsonParse 容错（T-42-08：损坏行降级为纯文本/空工具列表，不抛异常中断切换）
- ai-conversations-manager.js：getMessages 改为 renderer 显示形状——assistant 行带 toolExecutions（{id,name,status,params} 初始 completed），toolResult 行不单独输出、按 toolCallId 回填最近 assistant 行的 result/status/error（isError→failed），找不到归属丢弃；恢复视图工具调用呈现为父 AI 消息内工具卡片，与实时链路一致
- ai-conversations-manager.js：新增导出 getAgentMessages——pi-agent-core AgentMessage 注入形状（assistant content 为 text 块 + toolCall 块原样、provenance 占位 api:'unknown'/usage 0/stopReason:'stop'；toolResult 含 toolCallId/toolName/isError/details；空 content assistant 行与无 toolCallId 的 toolResult 行跳过），与 getMessages 共用 parseStoredContent 与行读取
- ai-manager.js：switchConversation 改 async——await this._recreateAgent() 后再注入（根因修复：同步帧内 this.agent 恒 null 致注入守卫恒 false），注入数据换用 getAgentMessages，注入条数日志，JSDoc a-f 步骤改 await 语义；getConversationMessages JSDoc 注明显示形状约定（G-42-4）
- ipc-handlers.js：ai:switch-conversation 补 await（switchConversation 已异步），messages 保持经 getConversationMessages 透传（现为显示形状），返回 {conversation, messages} 结构不变（G-42-4）
- src/renderer.js：核对后零改动——renderAIMessages 无未知 role 兜底分支、toolExecutions 卡片分支与 msg.id 操作按钮对显示形状即插即用

## Task Commits

Each task was committed atomically:

1. **Task 1: 消息存储管线归一化 — 写入侧内容提取 + 读取侧双形状 + 旧 JSON 行兼容** - `6f50569` (fix)
2. **Task 2: switchConversation 异步化 + Agent 上下文注入 + IPC await** - `0ce2e87` (fix)

## Files Created/Modified

- `ai-conversations-manager.js` - 写入侧归一化（normalizeMessageColumns）+ parseStoredContent + getMessages 显示形状 + getAgentMessages 注入形状 + safeJsonParse 容错
- `ai-manager.js` - switchConversation 异步化（await _recreateAgent + getAgentMessages 注入 + 注入日志）+ getConversationMessages JSDoc 显示形状约定
- `ipc-handlers.js` - ai:switch-conversation await 异步切换
- `src/renderer.js` - 核对确认零改动（显示形状即插即用，无兜底渲染可删）

## Decisions Made

- 写入侧归一化优先：assistant 行 content 列只存纯 markdown 文本，工具调用结构化存 tool_calls 列——库数据自解释，读取端无需猜测格式
- 旧格式行兼容读而不迁移：parseStoredContent 按内容形状自适应（JSON 数组→块解析，否则视为纯文本），历史脏数据零迁移成本
- thinking 块不落盘不注入：与实时链路 _extractText 的展示语义一致，且避免旧格式行思考内容混入 LLM 上下文
- toolResult 行不单独出气泡：回填进父 assistant 消息的 toolExecutions，恢复视图与实时视图同构（计划指定）；注入形状则保留独立 toolResult 消息满足 provider 配对约束
- AgentMessage provenance 用占位值：pi-ai 请求构建只读 role+content（诊断前置事实），占位安全
- createNewConversation 内的 _recreateAgent 保持现状不扩大化重构（计划明确允许；_recreateAgent 内部全量 try/catch 无 unhandled rejection 风险）

## Deviations from Plan

None - plan executed exactly as written.

说明：计划 files_modified 列出 src/renderer.js，但 Task 2 第 4 项的两点核对（未知 role 兜底、操作按钮分支）均确认现有代码对显示形状即插即用，无需修正——属计划内「仅核对」路径，非偏差。

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-42-3 / G-42-4 代码层修复完成，待 UAT 复测验证运行时行为（重启后 markdown + 工具卡片渲染、旧对话兼容显示、切换对话后上下文衔接引用先前内容、切换后立即发送无早退）
- 42-05（最后一个计划）待执行；saveMessages 归一化后新写入行与新读出管线自洽，旧格式行读时兼容无需迁移脚本
- REQUIREMENTS.md 无 CONV-* 条目（Phase 42 以 CONTEXT/UI-SPEC 承载需求），requirements-completed 按计划 frontmatter 记录，mark-complete 无可勾选项（not_found，与 42-03 一致）

## Self-Check: PASSED

- 3 个修改文件均在磁盘且 node --check 通过（ai-conversations-manager.js / ai-manager.js / ipc-handlers.js + src/renderer.js 未改动核对）
- 2 个任务提交存在于 git 历史：6f50569（Task 1）、0ce2e87（Task 2）
- Task 1 全部 acceptance criteria 通过：冒烟测试 32 项断言（原始列核对/显示形状/注入形状/旧 JSON 行兼容/损坏容错/全量替换保持）
- Task 2 全部 acceptance criteria 通过：静态顺序门（cleanup→getAgentMessages→await rebuild→inject）+ 真实 pi-agent-core Agent 注入集成冒烟 7 项断言 + 42-03 守卫完整性核对
- 计划 verification 1/3（重启渲染、LLM 上下文衔接）需真实 Electron+LLM 环境，已录入 coverage D4/D5 human_judgment 待 UAT 复测

---
*Phase: 42-ai-pi-agent*
*Completed: 2026-09-01*

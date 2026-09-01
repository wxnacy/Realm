---
phase: 42-ai-pi-agent
plan: 03
subsystem: ai
tags: [sqlite, better-sqlite3, conversation, lazy-creation, ipc, renderer]

# 依赖图
requires:
  - phase: 42-ai-pi-agent
    provides: ai-conversations-manager.js 对话存储模块 + ai-manager.js 对话管理 + conversationAPI IPC 通道
provides:
  - 惰性对话生命周期（启动零对话行、删除不补建、空状态可达）
  - 发送链路首条消息惰性建行 + D-04 自动命名 + conversationId 回传
  - 对话列表 message_count 真实化（LEFT JOIN COUNT）
  - saveMessages 全量替换事务（消除重复行）
  - D-06 决策修订（惰性创建语义）
affects: [ai-chat, renderer, 42-04-message-format]

# 实际度量
actuals:
  tokens: 5600
  tasks: 3
  commits: 3

# 技术追踪
tech-stack:
  added: []
  patterns: [lazy-conversation-lifecycle, full-replace-transaction, agent-guarantee-guard, left-join-message-count]

key-files:
  created: []
  modified:
    - ai-conversations-manager.js
    - ai-manager.js
    - ipc-handlers.js
    - src/renderer.js
    - .planning/phases/42-ai-pi-agent/42-CONTEXT.md

key-decisions:
  - "对话创建惰性化：init() 不再急切建行，首条用户消息或显式「新对话」才产生对话行（D-06 修订，G-42-1）"
  - "删除当前对话不自动补建：主进程清理 Agent 并置空 currentConversationId，renderer 对齐置空语义（G-42-1）"
  - "prompt/promptWithContext 守卫拆分：agent 为空时 await _recreateAgent 重建后复检，空状态后直接发送可恢复"
  - "saveMessages 改为全量替换事务：先 DELETE 后 INSERT，重复保存同一 transcript 不再累积重复行（G-42-2 附带缺陷）"
  - "getMessages 排序加 rowid tiebreak：同一毫秒消息按 transcript 顺序稳定排序"
  - "对话 id 经 prompt 响应回传 renderer（getState.conversationId 兜底），renderer 采纳后刷新列表"

patterns-established:
  - "惰性对话生命周期模式：_ensureConversation 建行/认领 + D-04 标题派生（前 30 字符）"
  - "Agent 保证模式：发送路径 agent 为空先重建再复检，不直接早退"
  - "全量替换事务模式：完整 transcript 语义下 DELETE+INSERT 替代 INSERT OR REPLACE"

requirements-completed: [CONV-02, CONV-03]

# 覆盖元数据
coverage:
  - id: D1
    description: "对话列表元信息真实化：getConversations LEFT JOIN COUNT 返回 message_count；saveMessages 全量替换事务，重复保存同一 transcript 不再产生重复行（6 条消息曾存出 14 行）"
    requirement: CONV-02
    verification:
      - kind: integration
        ref: "command: node -e 内存 better-sqlite3 冒烟测试 — 同一 6 条消息 transcript 连续保存 2 次 → 仍为 6 行；getConversations 返回 message_count=6；同毫秒消息按插入顺序稳定"
        status: pass
      - kind: other
        ref: "command: node --check ai-conversations-manager.js + grep -c message_count（计划 verify 命令）"
        status: pass
    human_judgment: false
  - id: D2
    description: "惰性对话生命周期（G-42-1）：init() 移除急切建行，启动零对话行；deleteConversation 删除当前对话清理 Agent 并置空引用、不补建，空状态可达；空状态后直接发送消息由 Agent 重建 + 惰性建行恢复；D-04 首条消息前 30 字符自动命名"
    requirement: CONV-03
    verification:
      - kind: other
        ref: "command: node --check ai-manager.js + awk/grep 静态门（init 无 createConversation、prompt/promptWithContext 含 _recreateAgent、deleteConversation 无 createNewConversation、_ensureConversation 存在）"
        status: pass
    human_judgment: true
    rationale: "启动零行/空状态可达/删除后发送可恢复是运行时行为，需要真实 Electron 环境与已配置 LLM 供应商的端到端验证（计划 verification 1/2/4），静态检查无法证明"
  - id: D3
    description: "发送链路对话 id 回传与列表刷新（G-42-2）：ai:prompt / ai:prompt-with-context 响应含 conversationId；renderer 采纳更新 state.currentConversationId 并在本轮 run 结束后 loadConversations() 刷新，记录立即可见且高亮正确"
    requirement: CONV-02
    verification:
      - kind: other
        ref: "command: node --check ipc-handlers.js src/renderer.js + grep conversationId + awk 静态门（handleSendAIMessage 采纳 conversationId 并调用 loadConversations）"
        status: pass
    human_judgment: true
    rationale: "「回复完成后记录立即可见、高亮正确」需要真实 LLM 流式往返与 UI 观察（计划 verification 2），自动化冒烟无法覆盖"
  - id: D4
    description: "42-CONTEXT.md D-06 决策修订：对话创建惰性语义，保留删除线标注与修订依据（UAT G-42-1）"
    verification:
      - kind: other
        ref: "command: grep -q 惰性 42-CONTEXT.md + 人工核对修订文本保留删除线与日期依据"
        status: pass
    human_judgment: false

# 度量
duration: 5min
completed: 2026-09-01
status: complete
---

# Phase 42 Plan 03: 对话生命周期缺陷修复（G-42-1 / G-42-2）Summary

**对话创建惰性化（启动零对话行、删除不补建）+ 首条消息 D-04 自动命名 + conversationId 回传 + message_count 真实化 + saveMessages 全量替换事务**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-01T13:33:28Z
- **Completed:** 2026-09-01T13:38:28Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- ai-conversations-manager.js：getConversations 改 LEFT JOIN + COUNT 返回真实 message_count；saveMessages 改为「先 DELETE 后 INSERT」全量替换事务，重复保存同一 transcript 不再累积重复行；getMessages 排序加 rowid 稳定 tiebreak（G-42-2 及附带缺陷）
- ai-manager.js：init() 移除启动急切创建默认对话块（启动零对话行）；新增 _ensureConversation 惰性建行/认领 + D-04 自动命名（首条用户消息前 30 字符，含「新对话」默认标题自动改名路径）；prompt/promptWithContext 守卫拆分，agent 为空时 await _recreateAgent 重建后复检（删除对话后直接发送可恢复），成功路径返回 conversationId；deleteConversation 删除当前对话清理 Agent 并置空引用、不再自动补建；getState 增加 conversationId 兜底通道（G-42-1 / G-42-2）
- ipc-handlers.js：ai:prompt 与 ai:prompt-with-context 响应回传 conversationId（G-42-2）
- src/renderer.js：handleSendAIMessage 采纳 result.conversationId 更新 state.currentConversationId，本轮 run 结束后 loadConversations() 刷新列表（记录/标题/消息数立即可见、高亮正确）；deleteConversation 移除自动补建分支，删除当前对话置空引用并清空消息列表，无条件刷新列表到达「暂无对话」空状态（G-42-1）
- 42-CONTEXT.md：D-06 决策修订为惰性创建语义，保留删除线标注、修订日期与依据

## Task Commits

Each task was committed atomically:

1. **Task 1: ai-conversations-manager.js — message_count + saveMessages 全量替换事务** - `d5b5231` (fix)
2. **Task 2: ai-manager.js — 惰性对话生命周期 + D-04 自动命名** - `137fae5` (fix)
3. **Task 3: IPC 回传对话 id + renderer 采纳与删除流程修正 + D-06 修订** - `02fc5b1` (fix)

## Files Created/Modified
- `ai-conversations-manager.js` - getConversations 含 message_count；saveMessages 全量替换事务；getMessages rowid tiebreak
- `ai-manager.js` - 惰性对话生命周期（init 不建行、_ensureConversation、deleteConversation 不补建）、prompt 守卫 Agent 保证、conversationId 返回、getState.conversationId
- `ipc-handlers.js` - ai:prompt / ai:prompt-with-context 响应含 conversationId
- `src/renderer.js` - 采纳对话 id、回复完成后刷新列表、删除流程无自动补建
- `.planning/phases/42-ai-pi-agent/42-CONTEXT.md` - D-06 决策修订（惰性创建语义 + 修订标注）

## Decisions Made
- 对话创建惰性化：init() 不再急切建行，对话行仅在首条用户消息或显式「新对话」时产生（D-06 修订）
- 删除当前对话不自动补建：主进程 _cleanupCurrentAgent + 置空 currentConversationId/conversationMeta，renderer 置空语义对齐
- prompt/promptWithContext 守卫拆分：!isInitialized 保留早退；!agent 先 await _recreateAgent 重建后复检，仍为 null 才报错——惰性建行的对话无历史需要注入，全新 Agent 恰好正确
- saveMessages 全量替换事务：saveCurrentConversation 每次传入完整 transcript，先 DELETE 后 INSERT 天然反映消息删减且消除重复行
- created_at 取值兼容 AgentMessage 的 timestamp 字段；保留 100KB 工具结果截断逻辑不动（消息内容格式归 42-04）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- G-42-1 / G-42-2 代码层修复完成，待 UAT 复测验证运行时行为（启动零行、发送后记录立即可见、删除后空状态、空状态后直接发送可恢复、无重复行）
- saveMessages 已是全量替换事务，为 42-04（消息内容格式归一化 / G-42-3）与 G-42-4（切换对话上下文恢复）铺平存储层
- REQUIREMENTS.md 无 CONV-* 条目（Phase 42 以 CONTEXT/UI-SPEC 承载需求），requirements-completed 按计划 frontmatter 记录，mark-complete 无可勾选项

---
*Phase: 42-ai-pi-agent*
*Completed: 2026-09-01*

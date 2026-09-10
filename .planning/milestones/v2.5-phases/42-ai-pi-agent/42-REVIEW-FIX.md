---
phase: 42-ai-pi-agent
fixed_at: 2026-09-01T14:46:20Z
review_path: .planning/phases/42-ai-pi-agent/42-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 42: Code Review Fix Report

**Fixed at:** 2026-09-01T14:46:20Z
**Source review:** .planning/phases/42-ai-pi-agent/42-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-04, WR-05 — scope limited by orchestrator; WR-01/02/03/06/07 reserved for user review)
- Fixed: 3
- Skipped: 0

**Verification environment:** `workflow.use_worktrees` is `false` — all edits, commits, and verification ran in the **main checkout** (branch `master`). No isolated worktree was created.

## Fixed Issues

### CR-01: getAgentMessages 丢弃 toolResult 行但保留 toolCall 块，破坏 provider 配对约束

**Status:** fixed: requires human verification（逻辑类改动；冒烟测试已实证行为，建议人工过一遍真实旧对话切换路径）
**Files modified:** `ai-conversations-manager.js`
**Commit:** 7f0f07a
**Applied fix:** `getAgentMessages` 改为两遍扫描：
1. 第一遍收集两侧配对键——`resultCallIds`（toolResult 行 `tool_results` 列能读出的 toolCallId）与 `assistantCallIds`（assistant 行 toolCall 块引用的 id）；
2. assistant 行注入时，无 toolResult 配对的孤儿 toolCall 紧随该行合成占位 toolResult `{role:'toolResult', toolCallId, toolName, content:[{type:'text', text:'（历史工具结果未记录）'}], timestamp:<assistant 行时间>}`，按块序一条不少；
3. 反向孤儿（toolCallId 无任何 assistant toolCall 引用）的 toolResult 行丢弃，配对双向闭合；
4. 附带守卫：无 id 的坏 toolCall 块直接跳过（注入同样会被 provider 拒绝）。

覆盖 REVIEW.md 列出的全部三个触发面：旧格式行（`tool_results` 恒 NULL）、超限截断产生非法 JSON、行损坏——后两者与前者共用「元数据读不出」分支。

### WR-04: parseStoredContent 旧格式启发式误判 JSON 数组文本

**Status:** fixed
**Files modified:** `ai-conversations-manager.js`
**Commit:** 4490216
**Applied fix:** 新增 `isLegacyBlockArray(parsed)` 守卫：解析结果为**非空数组且元素全部是带已知 `type` 字段（text/thinking/toolCall/image/audio）的非空对象**时才走旧格式分支，否则 content 按原文处理。`'[1, 2, 3]'`、`'[]'`、`'[{"a":1}]'` 从此原样保留；真旧格式块数组（含 thinking/image 块）兼容性不受影响。

### WR-05: createNewConversation 未 await _recreateAgent，双 Agent 竞态

**Status:** fixed: requires human verification（异步语义一致性改动；建议人工确认「新建对话后立即发消息」路径）
**Files modified:** `ai-manager.js`, `ipc-handlers.js`
**Commit:** fb0529c
**Applied fix:** `createNewConversation` 改为 `async` 并 `await this._recreateAgent()`，与 `switchConversation`（42-04）/`prompt` 守卫的 await 语义一致，消除「快速发送触发 prompt 守卫二次重建 → 双 Agent/双重订阅」竞态。连带修改 `ipc-handlers.js` 的 `ai:create-conversation` 处理器为 `await aiManager.createNewConversation()`——处理器返回 `{ conversation: ... }`，若内嵌 Promise 会被 Electron IPC 结构化克隆拒绝（DataCloneError），此为该修复的必要部分（REVIEW.md Fix 节已指出该调用链）。

## Skipped Issues

None — all in-scope findings were fixed.

## Out-of-scope (unchanged, per orchestrator instruction)

WR-01、WR-02、WR-03、WR-06、WR-07 保持未修（流式 UX 与重命名交互语义留待用户评审）。REVIEW.md 当前仍有 5 个开放 Warning + 5 个 Info。

## Verification

**Tier 1 (re-read):** 三个修复的改动段落均已重读确认，周边代码无损坏。

**Tier 2 (syntax):**
- `node --check ai-conversations-manager.js` — PASS
- `node --check ai-manager.js` — PASS
- `node --check ipc-handlers.js` — PASS（WR-05 连带改动文件）

**Tier 3 (behavioral smoke test — CR-01/WR-04，electron stub + 真实模块 + 真实 better-sqlite3，脚本 /tmp/realm-fix-smoke/smoke.js)：8/8 PASS**
- 旧格式 assistant 行（content=块数组 JSON，tool_calls/tool_results 恒 NULL）+ user 行 `'[1, 2, 3]'` → `getAgentMessages` 输出 assistant(toolCall call_1) → 紧跟合成 toolResult（toolCallId=call_1、toolName=get_tabs、占位文本、timestamp 取 assistant 行）→ user，无孤儿 toolCall（G-42-4 场景配对闭合）；
- 已配对 call（新格式 tool_calls 列 + tool_results 元数据）不合成占位，真实 toolResult 正常注入；
- 反向孤儿 toolResult（call_9 无引用）被丢弃；
- `getMessages` 显示形状：`'[1, 2, 3]'` 文本保留、旧格式 assistant 文本与工具卡片兼容；
- 真旧格式块数组仍走 legacy 分支；`'[]'`、`'[{"a":1}]'` 按原文保留。

---

_Fixed: 2026-09-01T14:46:20Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

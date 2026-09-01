---
status: diagnosed
trigger: "UAT Test 4 (Phase 42 AI 历史对话管理): 从对话历史切换回某个历史对话后，继续提问时 AI 不能衔接该对话之前的上下文（历史消息未参与 LLM 上下文）——尽管消息列表 UI 已加载历史消息（且以未格式化 JSON 展示）"
created: 2026-09-01T00:00:00+08:00
updated: 2026-09-01T12:30:00+08:00
---

## Current Focus

hypothesis: CONFIRMED — switchConversation 同步方法内未 await 异步的 _recreateAgent()，注入历史时 this.agent 必为 null，历史消息从未进入 agent.state.messages；随后新建的空 Agent 应答了下一条 prompt，LLM 上下文只有系统提示词 + 新用户消息
test: 代码路径直读 + pi-agent-core Agent 源码语义核对（agent.js:26-50 空 messages、:226-232/:280-286 prompt 快照 state.messages 不重置、:42-44 赋值注入是受支持的入口）
expecting: 若假设成立，注入守卫 `if (this.agent && ...)` 在 switchConversation 的同步帧内永远走 false 分支（确定性，非偶发），且 IPC 仍能从 DB 返回消息给 renderer 渲染 UI —— 与「UI 有历史、上下文为空」的割裂症状完全吻合
next_action: "已确认根因（diagnose-only 模式）——返回 ROOT CAUSE FOUND，等待 plan-phase --gaps 消费；不实施修复"
bug_class: Bohrbug（确定性失败，100% 复现路径）
known_pattern_candidate: 无 KB 命中（.planning/debug/knowledge-base.md 不存在；MemPalace 不可用）

## Symptoms

expected: 存在第二个对话时，从对话历史点击切换回第一个对话：当前消息列表被清空并加载第一个对话的历史消息；继续提问时 AI 能衔接之前的上下文（历史消息参与 LLM 上下文）
actual: 虽然消息列表加载了信息（并且没有格式化，使用的 json），但是消息没有加到上下文，对话是重新开始的
errors: None reported
reproduction: Test 4 in UAT (Phase 42 AI 历史对话管理功能) — create two conversations, chat in the first, switch to the second, switch back to the first (history loads visually), then ask a follow-up question that requires prior context ("我刚才问了什么？"). The AI answers as if starting fresh — prior messages are NOT in its context.
started: Discovered during UAT on 2026-09-01

## Environment Notes

- Working tree has UNCOMMITTED modifications to ai-manager.js, ipc-handlers.js, src/renderer.js（已核对 diff：仅新增 getConversationMessages、IPC 切换响应附带 DB 消息、renderer createNewConversation 去掉重复 newConversation 调用、_escapeXml 转义修正；switchConversation 的注入逻辑未被这些改动触及）——本诊断基于磁盘上的当前工作区状态，缺陷在未提交改动之前即存在。
- Prior diagnosed gaps (not re-diagnosed): G-42-2 (prompt 路径不创建/认领对话；currentConversationId 仅内存、getState 不回传), G-42-3 (消息 content 以原始 JSON block 数组字符串存储)。

## Eliminated

- hypothesis: 切换 IPC 只换 id、完全不加载消息（hint suspect b 原始表述）
  evidence: 切换响应确实返回了 DB 消息（ipc-handlers.js:1788-1791），且 ai-manager.js:1564-1572 存在完整的「DB 读消息 → 注入 agent.state.messages」代码；问题不是代码缺失而是注入被 null 守卫跳过
  timestamp: 2026-09-01T12:20:00+08:00
- hypothesis: 每次 prompt 都从零重建 Agent（hint suspect c）
  evidence: prompt/promptWithContext（ai-manager.js:821-877, 889-933）直接使用现有 this.agent，无重建、无 DB 回种；SDK Agent.prompt() 也不重置 state（agent.js:226-232）
  timestamp: 2026-09-01T12:20:00+08:00

## Evidence

- timestamp: 2026-09-01T12:00:00+08:00
  checked: ai-manager.js:1540-1584 switchConversation
  found: 同步方法：_cleanupCurrentAgent()（:1561，置 this.agent = null）→ this._recreateAgent()（:1567，无 await）→ 注入守卫 if (this.agent && messages.length > 0) { this.agent.state.messages = messages }（:1570-1572）→ 同步设置 currentConversationId 并 return
  implication: 注入检查与 _recreateAgent() 调用处于同一同步执行帧
- timestamp: 2026-09-01T12:05:00+08:00
  checked: ai-manager.js:1750-1791 _recreateAgent
  found: 声明为 async；首个 await 是 :1757 的 await import('@earendil-works/pi-agent-core')，this.agent = new Agent(...) 在 :1771（import 之后）；守卫分支也不赋值 this.agent
  implication: 调用返回 promise 时 this.agent 必为 null；动态 import 的续延最早也要到微任务队列，绝无可能在 switchConversation 剩余同步体之前执行 → 注入分支 100% 走 false（确定性，非竞态偶发）
- timestamp: 2026-09-01T12:10:00+08:00
  checked: node_modules/@earendil-works/pi-agent-core/dist/agent.js
  found: :26-50 createMutableAgentState——新 Agent messages = initialState?.messages?.slice() ?? []（即空数组）；:42-44 messages setter 支持直接赋值（slice 拷贝）；:226-232 prompt() 不重置 state；:280-286 createContextSnapshot 快照 _state.messages 交给 LLM 循环
  implication: 若注入成功，历史会进入上下文（SDK 侧无障碍）；注入被跳过则上下文必然只有系统提示词 + 新用户消息 = 「对话重新开始」
- timestamp: 2026-09-01T12:15:00+08:00
  checked: ipc-handlers.js:1780-1792 ai:switch-conversation
  found: handler 调用 aiManager.switchConversation(conversationId) 后另行 getConversationMessages(conversationId) 并把 DB 行返回给 renderer
  implication: 解释症状割裂面：UI 消息列表加载了历史（来自 DB 直读），与 Agent 上下文无关
- timestamp: 2026-09-01T12:18:00+08:00
  checked: ai-conversations-manager.js:264-328 saveMessages/getMessages
  found: saveMessages :288 对非字符串 content 做 JSON.stringify 存 TEXT；getMessages :322-327 只回解 tool_calls/tool_results/page_snapshots，content 保持原始 JSON 字符串；行结构为 DB 行（snake_case：conversation_id/tool_calls/created_at…），非 pi-agent-core AgentMessage 形状
  implication: 次要潜在缺口——即使注入被修复，assistant 历史会以 JSON 字符串形态进上下文（内容仍在但形态错），toolResult 消息的 tool_calls/tool_results 字段名不匹配 SDK 期望；该缺口会降低恢复质量但单独不会造成「全新对话」（user 消息 content 是纯字符串，仍可到达模型）
- timestamp: 2026-09-01T12:22:00+08:00
  checked: renderer.js:6779-6814 switchConversation + git diff 三文件
  found: renderer 仅调 IPC、清空列表、用响应里的 messages 渲染；未提交 diff 不涉及 switchConversation 注入逻辑
  implication: 渲染端无补种逻辑（也不应有）；缺陷纯在主进程

## Resolution

root_cause: "ai-manager.js switchConversation（:1540-1584，同步方法）在 ：1567 无 await 地调用了 async 的 _recreateAgent()（:1750，首个 await 在 ：1757 的动态 import，this.agent 于 ：1771 才赋值）。_cleanupCurrentAgent（:1561）已把 this.agent 置 null，因此 ：1570 的注入守卫 `if (this.agent && messages.length > 0)` 在同一同步帧内恒为 false——DB 历史消息从未写入 agent.state.messages。微任务稍后新建的 Agent 带空 messages（pi-agent-core agent.js:28），下一条 prompt（ai-manager.js:852）快照该空 state（agent.js:280-286）发给 LLM，上下文只剩系统提示词 + 新用户消息。UI 之所以仍显示历史，是因为 IPC handler（ipc-handlers.js:1788-1791）从 DB 直读消息返回 renderer，与 Agent 状态无关。次要共存缺口：注入即使生效，DB 行也非 AgentMessage 形状（content 为 JSON 字符串未回解、tool_calls/tool_results snake_case 未映射，ai-conversations-manager.js:288/322-327），会降低恢复质量——与 G-42-3 的存储格式问题同源"
fix: "（未实施，diagnose-only）switchConversation 改 async 并 await _recreateAgent() 后再注入；IPC handler 相应 await。注入前把 DB 行转换为 pi-agent-core AgentMessage 形状（content JSON.parse 回 block 数组/字符串、tool_calls→toolCalls 等字段映射），与 G-42-3 存储格式修复联动。修复后需警惕 saveMessages 重复插入（G-42-2 已记）污染回种数据"
verification: ""
files_changed: []

## reasoning_checkpoint

hypothesis: "switchConversation 未 await 异步 _recreateAgent() 导致注入时 this.agent 为 null，历史从未进入 agent.state.messages，下一条 prompt 由空上下文 Agent 应答"
confirming_evidence:
  - "ai-manager.js:1561/:1567/:1570-1572 的执行顺序（直读）：agent 置 null → 无 await 调 async 重建 → null 守卫注入"
  - "ai-manager.js:1750-1771：_recreateAgent 为 async，this.agent 赋值位于 await import 之后，无同步赋值路径"
  - "pi-agent-core agent.js:26-50（新 Agent messages 为空）、:280-286（prompt 快照现有 state，不重置、不从 DB 回种）"
falsification_test: "若假设错误，则 this.agent 在 ：1570 处应为非 null（即存在同步赋值路径），或 prompt 路径存在其他 DB 回种入口——两者均被源码直读排除；运行时断言（切换后立即检查 agent.state.messages.length === 0 且 UI 有历史）可直接证伪"
fix_rationale: "await 重建后注入直接命中根因（注入点存在但被 null 守卫短路），而非在 renderer 或 prompt 层绕过；AgentMessage 形状转换解决注入数据的契约匹配，属同一链路的必要配套"
blind_spots: "未运行时验证（diagnose-only 模式未启动应用复现）；未核实 pi-agent-core 对 toolResult 角色消息反序列化的完整要求（字段名映射的具体形态留待修复阶段确认）；saveMessages 重复插入（G-42-2）对回种数据的具体污染程度未量化"
candidate_causes:
  - "code: 同步方法无 await 调用 async 重建函数，注入被 null 守卫短路（已确认，主因）"
  - "data: DB 行形状 ≠ AgentMessage 契约（content JSON 字符串、snake_case 字段，已确认，次要共存缺口）"
  - "config/environment: 无（provider/model 配置在 _recreateAgent 守卫内正常，用户能收到回复即为证）"
and_gate: "no——单一 code 缺陷即可完整解释「上下文全空」；data 形状缺陷单独只会降质（user 消息纯字符串仍可达模型），不会造成全新对话。二者非本症状的必要联合条件"

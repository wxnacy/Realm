---
status: diagnosed
trigger: "重启后点击历史对话查看消息记录，AI 消息回复以 markdown 格式渲染并正常展示工具调用，而非原始 JSON 文本"
created: 2026-09-01T00:00:00+08:00
updated: 2026-09-01T20:10:00+08:00
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: diagnosed
---

## Current Focus

```yaml
reasoning_checkpoint:
  hypothesis: "ai-manager.js saveCurrentConversation 把 pi-agent-core 的原始 agent.state.messages 直接交给 saveMessages；SDK 的 AssistantMessage.content 是内容块数组（pi-ai types.d.ts:309），UserMessage.content 在本应用流程中也是块数组，因此 ai-conversations-manager.js:288 的 `typeof msg.content === 'string' ? msg.content : JSON.stringify(...)` 恒走 JSON.stringify 分支，把块数组序列化成 JSON 字符串存入 messages.content 列；getMessages（322-327）原样返回该字符串，renderer switchConversation → renderAIMessages:7430 把它整体喂给 marked.parse，JSON 被当作字面文本渲染 → 用户看到原始 JSON。live 路径正常是因为 ai-manager._extractText（1145-1151）在事件层已把块数组提取为纯文本字符串"
  confirming_evidence:
    - "直接观察 dev 库（realm-dev/ai-conversations.db，只读查询）：user 行 content = '[{\"type\":\"text\",\"text\":\"hi\"}]'；assistant 行 content = '[{\"type\":\"thinking\",...},{\"type\":\"text\",\"text\":\"你好！...\"}]' — 存储层就是 JSON 块数组字符串，真实回复文本在 JSON 内部"
    - "pi-ai types.d.ts:307-309 — AssistantMessage.content: (TextContent | ThinkingContent | ToolCall)[] 恒为数组；:302-304 UserMessage.content: string | (TextContent | ImageContent)[]（本应用经 prompt 传入的即是块数组）"
    - "ai-conversations-manager.js:288 — content 序列化只有 string 判断，非 string 一律 JSON.stringify；getMessages（311-328）对 content 列无任何反序列化/提取（tool_calls 等列有 parse，content 没有）"
    - "renderer.js:6801-6803 switchConversation 把 result.messages 原样赋给 state.aiMessages → renderAIMessages:7430 renderAIMarkdown(msg.content) — 与 live 共用同一渲染函数，唯一差异是 content 形状"
    - "differential：live 路径 ai-manager.js:1046/1114 _extractText 提取纯文本 → renderer.js:7908 aiMsg.content = 纯文本字符串 → markdown 渲染正常；restore 路径缺少等价提取步骤"
  falsification_test: "若把 messages.content 列的 JSON 解析出 type:'text' 块拼接后恢复渲染，症状应消失且 markdown/工具调用恢复；若恢复后仍显示 JSON，则假设错误（如渲染层另有 verbatim 输出分支）"
  fix_rationale: "根因是持久化管线两端都没有做 SDK 块数组 ↔ 纯文本 的规范化（save 端不提取、load 端不解析），修复任一端即可消除症状；在 load/渲染端解析块数组还能一并恢复工具调用块（type:'toolCall'）与 thinking 块的展示，直指'未格式化成 markdown 和工具调用'的全部症状，而非只改字符串显示"
  blind_spots: "未运行应用实测恢复渲染（数据库内容 + 代码链路已构成直接证据链）；未验证 context 恢复注入（G-42-4，switchConversation 1571 直接把 DB 行回灌 agent.state.messages，行结构与 SDK Message 结构不一致是另一个独立缺陷，不属本 gap）"
  candidate_causes:
    - "code: 持久化层对 SDK 块数组 content 无规范化（saveMessages:288 JSON.stringify 兜底 + getMessages 不还原）— 已证实"
    - "data: DB 行 content 即 JSON 字符串 — 已观察到，但是上述代码缺陷的产物，非独立原因"
    - "environment/config: 无关（环境隔离 userData 只影响哪个库，库内容缺陷同源）"
  and_gate: "no — 单一管线缺陷（块数组从未在 save/load 任意一端转换回文本）即足以产生全部症状，不需要多条件同时成立"
```

bug_class: Bohrbug（确定性复现——每条经此路径保存的 SDK 消息 content 恒为数组，每次恢复必现）

next_action: 诊断完成，返回 ROOT CAUSE FOUND 给 plan-phase --gaps（find_root_cause_only 模式，不修复）

## Symptoms

expected: 完全退出 Realm 并重新启动应用，打开 AI 面板对话历史，之前的对话及消息记录仍然存在；点击该对话可查看历史消息，AI 回复以 markdown 渲染并展示工具调用
actual: 消息记录存在，但 AI 消息回复显示为原始 JSON，没有格式化为 markdown 和工具调用
errors: None reported
reproduction: Test 3 in UAT (Phase 42 AI 历史对话管理功能) — send a message, get AI reply, fully quit and restart Realm (npm run dev), open AI panel conversation history, click the conversation, observe restored AI replies render as raw JSON instead of formatted markdown/tool-call display
started: Discovered during UAT on 2026-09-01

## Environment Notes

- Working tree has UNCOMMITTED modifications to `ai-manager.js`, `ipc-handlers.js`, `src/renderer.js` — diagnosing current working-tree state read from disk.
- dev 数据库只读查询路径：`~/Library/Application Support/realm-dev/ai-conversations.db`（WAL 模式，运行中实例持续写入，查询用 `file:...?mode=ro`）

## Eliminated

- hypothesis: "live 渲染与恢复渲染走不同代码路径，恢复路径少了 markdown 处理"
  evidence: "两者共用 renderAIMessages（renderer.js:7381）→ renderAIMarkdown（7430 与 live 的 updateAIStreamingBubble:7515 / finalizeAIStreamingBubble:7632 同一函数）；switchConversation（6801-6803）加载后调用的是同一个 renderAIMessages"
  timestamp: 2026-09-01T20:00:00+08:00
- hypothesis: "保存时 content 字段丢失/角色字段丢失导致渲染降级为纯文本"
  evidence: "DB 直查显示 role 列正常（user/assistant），content 列有完整数据——只是形状是 JSON 块数组字符串；renderer 角色判断 msg.role === 'user' 对恢复行同样生效，AI 消息确实走了 markdown 分支（7428-7435），只是输入本身是 JSON 文本"
  timestamp: 2026-09-01T20:05:00+08:00

## Evidence

- timestamp: 2026-09-01T19:50:00+08:00
  checked: renderer.js 渲染与恢复链路
  found: "renderAIMessages（7381）对 AI 消息统一 renderAIMarkdown(msg.content)（7430）；switchConversation（6779-6814）经 ai:switch-conversation 拿 result.messages 直接赋 state.aiMessages 后调用同一渲染函数；工具卡片仅从 msg.toolExecutions 渲染（7453），恢复行无此字段"
  implication: "live 与 restore 渲染共用，差异必然在数据形状"
- timestamp: 2026-09-01T19:55:00+08:00
  checked: 保存链路 ai-manager.js agent_end → saveCurrentConversation → saveMessages
  found: "agent_end（1099-1128）调用 saveCurrentConversation（1591-1617），1599 行把原始 this.agent.state.messages 交给 conversationStore.saveMessages；ai-conversations-manager.js:288 `typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '')`；getMessages（311-328）content 原样返回（tool_calls/tool_results 有 JSON.parse，content 没有）"
  implication: "SDK 块数组 content 被 JSON.stringify 存库，读出后不做任何还原"
- timestamp: 2026-09-01T19:58:00+08:00
  checked: SDK 消息类型定义（@earendil-works/pi-ai dist/types.d.ts + pi-agent-core dist/types.d.ts）
  found: "AssistantMessage.content: (TextContent | ThinkingContent | ToolCall)[]（types.d.ts:307-309）恒为数组；UserMessage.content: string | (TextContent|ImageContent)[]；ai-manager.js:1140-1151 _extractText 的 JSDoc 自述 'AssistantMessage.content 为内容块数组'；工具调用块 type:'toolCall' 在 content 数组内，SDK 消息无顶层 toolCalls 字段"
  implication: "saveMessages:288 对 SDK 消息恒走 JSON.stringify 分支；tool_calls 列恒为 null（DB 证实 0|0），恢复行既无文本也无工具卡片数据"
- timestamp: 2026-09-01T20:02:00+08:00
  checked: dev 数据库 messages 表实际存储内容（只读 sqlite3 查询）
  found: "user 行 content = '[{\"type\":\"text\",\"text\":\"hi\"}]'；assistant 行 content = '[{\"type\":\"thinking\",...},{\"type\":\"text\",\"text\":\"你好！有什么我可以帮你的吗？...\"}]'——真实回复文本（含 markdown 源）完整存在于 JSON 内部，仅是被序列化成字符串"
  implication: "数据未丢失，纯 serialization/normalization 缺陷；直接观测证实根因"
- timestamp: 2026-09-01T20:06:00+08:00
  checked: live 路径 differential
  found: "ai-manager.js:1046/1114 用 _extractText 提取纯文本作为 message_update.content → renderer.js:7908 aiMsg.content = 纯文本 → markdown 渲染正常；toolExecutions 由 tool_execution_update 事件独立构建（7916-7940）"
  implication: "live 正常、restore 异常的原因 = 事件层有块→文本转换，持久化层没有"

## Resolution

root_cause: "AI 消息持久化管线缺少 SDK 内容块数组的规范化：saveCurrentConversation（ai-manager.js:1599）把 pi-agent-core 原始 agent.state.messages 存库，AssistantMessage.content 恒为块数组（pi-ai types.d.ts:309），ai-conversations-manager.js saveMessages:288 对非 string content 一律 JSON.stringify 后写入 messages.content 列；getMessages:322-327 读出时对 content 原样返回、不解析不提取；renderer.js renderAIMessages:7430 把该 JSON 字符串整体交给 marked.parse 当字面文本渲染。live 路径正常是因为 _extractText（ai-manager.js:1145-1151）在事件层已提取纯文本。恢复视图因此显示原始 JSON，且工具调用块（content 数组内的 type:'toolCall'）与 thinking 块一并以 JSON 形式展示、无法生成工具卡片（恢复行也没有渲染工具卡所需的 toolExecutions 字段，tool_calls 列恒为 null）"
fix: ""
verification: ""
files_changed: []

### Suggested Fix Direction (for plan-phase --gaps)

二选一（推荐 b，可一并恢复工具调用/thinking 展示）：

1. save 端规范化：saveMessages 写库前对块数组提取 type:'text' 文本（复用/镜像 _extractText 逻辑），content 列只存纯 markdown 文本；
2. load 端规范化：getMessages 检测 content 为 JSON 块数组时解析，提取 text 块为展示文本，并把 toolCall 块映射为渲染端可用的工具卡片结构（或解析回 SDK 消息形状再交 renderer 转换）。

注意联动：saveMessages 同时服务于 G-42-2 的重复 INSERT 缺陷（id 不稳定），修复计划应合并处理；历史已存 JSON 行需要迁移或读时兼容，否则老对话仍显示 JSON。

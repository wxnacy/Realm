---
status: diagnosed
trigger: "UAT 测试 3（第 2 轮）：如果有工具调用，AI回复内容跑到了工具标签下边，然后工具标签上边出现一个空的消息气泡"
created: 2026-09-01T00:00:00+08:00
updated: 2026-09-01T21:30:00+08:00
---

## Current Focus

```yaml
reasoning_checkpoint:
  hypothesis: "历史恢复路径的消息分组模型与实时路径不一致：pi-ai 每次供应商响应产生一条独立 assistant AgentMessage，含工具调用的回合落库为 [assistant(content='', tool_calls) → toolResult → assistant(content=最终文本)] 三行；getMessages（ai-conversations-manager.js:536）按行 1:1 映射为显示消息、无同回合合并，工具专用 assistant 行产出 content:'' 的显示消息（工具卡片回填其上），最终文本行成为其后的另一条消息。renderAIMessages（renderer.js:7394）对每条显示消息无条件创建 .ai-message-content 气泡 div 且无空内容守卫（CSS 给 AI 气泡背景+padding），于是渲染出：空气泡+下方工具卡片 → 再下方第二个气泡装最终文本。这与症状完全一致"
  confirming_evidence:
    - "dev 库直查（read-only）：conversation 03f7cfcc 行 14 = assistant content 为空串 + tool_calls=[list_history]；行 15 = toolResult（回填行 14 卡片 status=completed）；行 16 = assistant content='以下是你的浏览历史记录…markdown 表格'——存储层即此形状"
    - "getMessages（ai-conversations-manager.js:546-584）assistant 行恒 push 独立显示消息，toolResult 仅回填 toolExecutions，不合并相邻 assistant 行；工具专用行产出 {content:'', toolExecutions:[…]}"
    - "renderAIMessages（renderer.js:7410-7448）对每条消息无条件创建 .ai-message-content 并 appendChild 到 wrapper；空 content 时 renderAIMarkdown('') 返回空串（非 null），innerHTML='' 留下空气泡；main.css 5542/5549 给 .ai-message-ai .ai-message-content 深色背景+padding，空气泡可见"
    - "实时路径不受影响：整轮渲染进单个占位气泡（state.aiCurrentMessageId），message_update 覆盖 content、工具卡片挂同一消息 → 文本在上卡片在下，与 truth 一致——证明存储顺序无错，错在恢复侧分组"
  falsification_test: "若把 getMessages 输出在渲染前打印，工具回合应出现 [assistant(content:''), assistant(content:最终文本)] 两条相邻 assistant 显示消息；若实际只有一条合并消息或空气泡来自其他来源，则假设错误"
  fix_rationale: "根因是恢复侧显示分组（读出形状）缺陷，不是存储顺序缺陷；在 getMessages 做同回合合并（最终文本并入前面 tool 专用 assistant 行的 content，或渲染侧按 assistant 回合分组）+ 空内容守卫即直指两个症状"
  blind_spots: "未运行应用实测恢复渲染（DB 行 + 全代码链路已构成直接证据链）；未覆盖「同一 assistant 消息内 text 块在 toolCall 块之前/之后交错」的次序信息——normalizeMessageColumns 把 text 与 toolCalls 拆进不同列，块级交错顺序未落盘（本例模型行为是纯工具行+纯文本行，不触发该限制，但修复方案若追求块级顺序需注意）"
  candidate_causes:
    - "code: getMessages 行级 1:1 映射、无回合分组，产出空 content 显示消息 — 已证实"
    - "code: renderAIMessages 无空内容气泡守卫 — 已证实（与上一条叠加成空气泡）"
    - "data: DB 行顺序与对话语义一致（工具先于最终回答），非独立原因 — 已排除"
    - "environment/config: 无关（环境隔离只影响用哪个库） — 已排除"
  and_gate: "no — 恢复侧分组缺失单一缺陷即足以产生全部症状（空气泡 + 文本在卡片下方）；实时路径共用同一 renderAIMessages 却正常，反证存储与渲染主链路无第二必要条件"
```

bug_class: Bohrbug（确定性——凡含「纯工具 assistant 行 + 后续文本 assistant 行」的对话，恢复渲染必现）

next_action: 诊断完成（find_root_cause_only），返回 ROOT CAUSE FOUND 给 gap-closure planner

## Symptoms

expected: AI 回复的文本内容显示在工具卡片上方；工具调用显示为带参数/结果/状态的工具卡片；不出现空的消息气泡
actual: 用户报告（UAT 测试 3，第 2 轮）："如果有工具调用，AI回复内容跑到了工具标签下边，然后工具标签上边出现一个空的消息气泡"。截图证据：search_history 工具卡片（状态"完成"）上方有一个空 dark 气泡；AI 的 markdown 表格回复（历史记录搜索结果）渲染在工具卡片下方。
errors: None reported
reproduction: UAT 42-UAT.md 测试 3（让 AI 调用任一工具后完全退出重启，打开该对话）——用户观察到该问题；请确认是实时渲染与历史恢复两条路径都有，还是仅其中一条
started: Discovered during UAT (round 2, 2026-09-01)

**路径结论：仅历史恢复路径受影响**（重启打开对话、切换对话共用 switchConversation → getMessages）。实时流式路径整轮渲染进单个气泡，顺序正确。

## Eliminated

- hypothesis: "存储时 content 块顺序写反（text 存到 toolCall 之后）"
  evidence: "dev 库直查显示行序正确：user → assistant(content='', tool_calls) → toolResult → assistant(content=最终文本)。工具调用确实发生在最终回答之前，行序符合对话语义；实时路径共用渲染函数却显示正常，反证存储无错"
  timestamp: 2026-09-01T21:20:00+08:00
- hypothesis: "实时与恢复共用 renderAIMessages，故实时路径同样乱序"
  evidence: "实时路径有独立的分组模型：发送时创建单个占位气泡（state.aiCurrentMessageId），handleAIStream（renderer.js:7916）把整轮 message_update 文本与 tool_execution_update 工具卡片全部挂到同一消息对象；renderAIMessages 对单条消息恒为 content 气泡在上、toolContainer 在下。乱序仅由恢复侧多条显示消息的排列产生"
  timestamp: 2026-09-01T21:25:00+08:00
- hypothesis: "getAgentMessages（上下文注入形状）的 CR-01 孤儿 toolCall 合成逻辑引入了空消息"
  evidence: "getAgentMessages 只服务 LLM 上下文注入（switchConversation 内部），IPC ai:switch-conversation 返回给 renderer 的是 getConversationMessages → conversationStore.getMessages（ipc-handlers.js:1782-1796，ai-manager.js:1850-1852）；渲染数据不经过 getAgentMessages"
  timestamp: 2026-09-01T21:28:00+08:00

## Evidence

- timestamp: 2026-09-01T21:05:00+08:00
  checked: dev 库 ~/Library/Application Support/realm-dev/ai-conversations.db（read-only，UAT 后新建的含工具对话 03f7cfcc）
  found: "行 14：assistant，content=''（空串），tool_calls=[{id:call_9558…, name:list_history, arguments:{}}]；行 15：toolResult，tool_results.toolCallId=call_9558…；行 16：assistant，content='以下是你的浏览历史记录（第 1 页…）markdown 表格'。『下一页』回合（行 18-20）同构"
  implication: "存储层每个供应商响应一条 assistant 行；工具回合= 纯工具行 + toolResult 行 + 纯文本行，行序正确"
- timestamp: 2026-09-01T21:10:00+08:00
  checked: ai-conversations-manager.js getMessages（536-596）
  found: "assistant 行恒独立 push {role:'assistant', content:text, toolExecutions}；toolResult 行只回填前面最近 assistant 行的 toolExecutions；没有任何相邻 assistant 行合并逻辑。纯工具行产出 content:'' 的显示消息（工具卡片回填其上），最终文本行是其后的独立消息"
  implication: "恢复视图消息序列 = [user, assistant(''+卡片), assistant(markdown 表格)]，顺序与分组即症状来源"
- timestamp: 2026-09-01T21:15:00+08:00
  checked: renderer.js renderAIMessages（7394-7492）+ main.css 5531-5557
  found: "每条显示消息无条件创建 .ai-message-content 气泡 div；空 content 时 renderAIMarkdown('') 返回空字符串（!==null），innerHTML='' 后气泡仍在 DOM；CSS 给 .ai-message-ai .ai-message-content 深色背景 + 10px/14px padding → 空气泡可见。气泡 append 后才 append 工具卡片容器（7463-7473），故卡片永远在所属消息气泡下方"
  implication: "content:'' 的 assistant 显示消息渲染为「空气泡 + 下方工具卡片」，其后的文本消息渲染为更下方第二个气泡——与截图逐像素吻合"
- timestamp: 2026-09-01T21:22:00+08:00
  checked: 渲染数据链路 ipc-handlers.js:1782 → ai-manager.js:1850 getConversationMessages → conversationStore.getMessages；switchConversation（renderer.js:6781-6816）把 result.messages 直接赋 state.aiMessages 后 renderAIMessages
  found: "渲染数据源就是 getMessages 显示形状；重启后打开对话与切换对话都走此路径"
  implication: "修复点在 getMessages（或渲染侧分组），与 getAgentMessages 注入形状互不影响"

## Resolution

root_cause: "历史恢复路径的消息分组模型与实时路径不一致。pi-agent-core 每次供应商响应产出一条独立 assistant AgentMessage，含工具调用的一轮落库为三行：assistant(content='', tool_calls=[…]) → toolResult → assistant(content=最终文本)。getMessages（ai-conversations-manager.js:536-596）按行 1:1 生成显示消息、不合并同一回合的相邻 assistant 行：纯工具行产出 content:'' 的显示消息（工具卡片经 toolResult 回填其上），最终文本行成为其后的另一条消息。renderAIMessages（src/renderer.js:7394）对每条显示消息无条件创建 .ai-message-content 气泡（无空内容守卫，renderAIMarkdown('') 返回空串仍保留气泡；main.css 给 AI 气泡背景+padding 使其可见）。恢复渲染自上而下即为：空气泡 → 工具卡片 → 第二个气泡（最终 markdown 文本）——即用户报告的『工具卡片上方空气泡、AI 内容跑到工具标签下边』。存储行序本身正确（工具先于最终回答），仅恢复侧分组/守卫缺失；实时路径不受影响（整轮渲染进单个占位气泡）"
fix: "（诊断建议，未实施）在显示读出侧合并同一 AI 回合：getMessages 将「纯工具 assistant 行 + 其后的最终文本 assistant 行」合并为一条显示消息（content=最终文本、toolExecutions=卡片），或在渲染层对连续 assistant 显示消息按回合分组；并给 renderAIMessages 增加空 content 气泡守卫（assistant 且 content 为空时跳过 .ai-message-content 或仅渲染工具卡片容器）。不得改动存储格式与 getAgentMessages 注入形状"
verification: "（find_root_cause_only，未修复）DB 直查 + 全链路代码证据已闭环"
files_changed: []

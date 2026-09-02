---
status: complete
phase: 42-ai-pi-agent
source: [42-VERIFICATION.md]
started: 2026-09-01T15:20:00Z
updated: 2026-09-02T00:00:00Z
note: 第 3 轮 UAT — G-42-8 由 42-06（getMessages 同回合合并 + 空气泡守卫）修复后复测通过，10/10 全过
---

## Current Test

[testing complete]

## Tests

### 1. 启动零对话行 + 空状态（G-42-1 复测）
test: 完全退出后 `npm run dev` 启动，打开 AI 面板点历史按钮
expected: 对话列表显示「暂无对话」+「点击「新对话」开始与 AI 交流」；`ai-conversations.db` 无 0 消息「新对话」垃圾行
result: pass

### 2. 首条消息惰性建行 + 自动命名 + 记录立即可见（G-42-2 复测）
test: 发送一条消息，AI 回复完成后打开对话历史
expected: 列表出现以首条消息前 30 字符为标题的对话项，元信息「日期 · N 条消息」真实，当前对话高亮；无需点「新对话」
result: pass

### 3. 重启后历史渲染 markdown + 工具卡片（G-42-8 复测）
test: 让 AI 调用任一工具后完全退出重启，打开该对话
expected: AI 气泡 markdown 渲染，工具调用显示为带参数/结果/状态的工具卡片，无原始 JSON 文本；文本在上、工具卡片在下，无空气泡残留（G-42-8 修复复测）
result: pass

### 4. 切换对话上下文衔接（G-42-4 复测）
test: 切换到另一对话再切回，发送「我们刚才聊到哪里」类问题
expected: AI 回答引用先前内容；主进程日志可见「已注入 N 条历史消息」
result: pass

### 5. 重命名行内编辑（G-42-5 复测）
test: 右键对话项 → 重命名，改名校验 Enter 与失焦两种确认
expected: 菜单关闭后面板保持打开、标题原位变输入框、确认后列表立即显示新标题。注意 WR-06：Escape 取消依赖浏览器行为假设，重点确认取消不误提交
result: pass

### 6. 长标题截断（前轮被重命名缺陷阻塞，本轮补测）
test: 重命名为超过 30 字符的标题
expected: 列表截断显示省略号，不撑破布局
result: pass

### 7. 删除确认框居中 + 真正删除 + 空状态（G-42-6/G-42-7 复测）
test: 右键 → 删除，观察确认框位置与文案；点「取消」再点「删除」
expected: 确认框屏幕居中、背景压暗；取消不删除；确认后对话与消息从库中消失、列表立即刷新；删除当前对话到达空状态
result: pass

### 8. 空状态后直接发送可恢复（G-42-1 可恢复性）
test: 删除最后一个对话后不经「新对话」直接发送消息
expected: 正常收到 AI 回复（无「AI 助手未初始化」报错），历史出现新建对话行
result: pass

### 9. 新建对话后立即发送（WR-05 修复路径复核）
test: 点「新对话」后不等待立刻发送消息
expected: 正常回复，无双重 Agent 症状（重复流式输出/事件重影）
result: pass

### 10. 旧对话（含工具调用）切换后继续提问（CR-01 修复路径复核）
test: 切换到 42-04 之前落库、用过工具调用的旧对话，继续发消息
expected: 请求不再被供应商拒绝（孤儿 toolCall 已合成占位 toolResult 闭合配对）；工具卡片显示「（历史工具结果未记录）」占位或真实结果
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-42-8
  truth: "含工具调用的回复中，AI 文本气泡与工具卡片顺序正确（文本在上、工具卡片在下），无空消息气泡残留"
  status: resolved
  resolved_by: 42-06-PLAN
  resolved_at: 2026-09-02
  reason: "User reported: 如果有工具调用，AI回复内容跑到了工具标签下边，然后工具标签上边出现一个空的消息气泡"
  severity: major
  test: 3
  root_cause: "历史恢复路径消息分组与实时路径不一致：pi-agent-core 每次供应商响应落一条 assistant 行，含工具调用回合为三行（assistant content='' + tool_calls → toolResult → assistant content=最终文本）。getMessages（ai-conversations-manager.js:536-596）按行 1:1 映射不合并同回合相邻 assistant 行，纯工具行产出 content:'' 显示消息；renderAIMessages（src/renderer.js:7394）无条件创建气泡且无空内容守卫，main.css 给 AI 气泡背景+padding 使空 div 可见。恢复渲染即：空气泡 → 工具卡片 → 第二气泡（最终文本）。存储行序正确，仅历史恢复路径受影响。"
  artifacts:
    - path: "ai-conversations-manager.js"
      issue: "getMessages（536-596）行级 1:1 映射、无同回合 assistant 行合并，产出空 content 显示消息（根因）"
    - path: "src/renderer.js"
      issue: "renderAIMessages（7394-7492）无空 content 气泡守卫，空气泡因此可见（叠加因素）"
    - path: "src/styles/main.css"
      issue: "5531-5557 AI 气泡背景+padding 使空 div 可见（呈现因素，不必改）"
  missing:
    - "getMessages 读出侧合并同一 AI 回合：纯工具 assistant 行 + 其后最终文本 assistant 行合并为一条显示消息（content=最终文本、toolExecutions=卡片）；或在渲染层对连续 assistant 显示消息按回合分组"
    - "renderAIMessages 加空 content 气泡守卫（assistant 且 content 为空时跳过气泡 div，仅渲染工具卡片容器）"
    - "约束：getAgentMessages 的注入形状不得随动（上下文注入依赖行级结构，CR-01 形状）"
  debug_session: ".planning/debug/tool-card-empty-bubble.md"

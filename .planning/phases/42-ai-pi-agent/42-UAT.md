---
status: testing
phase: 42-ai-pi-agent
source: [42-VERIFICATION.md]
started: 2026-09-01T15:20:00Z
updated: 2026-09-01T15:20:00Z
note: 第 2 轮 UAT — G-42-1..7 缺口修复（42-03/04/05）+ 代码评审修复（CR-01/WR-04/WR-05）后的复测；第 1 轮记录见 git 历史（commit b950211）
---

## Current Test

number: 1
name: 启动零对话行 + 空状态（G-42-1 复测）
expected: |
  完全退出后 `npm run dev` 启动，打开 AI 面板点历史按钮：对话列表显示「暂无对话」+ 引导文案；`ai-conversations.db` 无 0 消息「新对话」垃圾行
awaiting: user response

## Tests

### 1. 启动零对话行 + 空状态（G-42-1 复测）
test: 完全退出后 `npm run dev` 启动，打开 AI 面板点历史按钮
expected: 对话列表显示「暂无对话」+「点击「新对话」开始与 AI 交流」；`ai-conversations.db` 无 0 消息「新对话」垃圾行
result: [pending]

### 2. 首条消息惰性建行 + 自动命名 + 记录立即可见（G-42-2 复测）
test: 发送一条消息，AI 回复完成后打开对话历史
expected: 列表出现以首条消息前 30 字符为标题的对话项，元信息「日期 · N 条消息」真实，当前对话高亮；无需点「新对话」
result: [pending]

### 3. 重启后历史渲染 markdown + 工具卡片（G-42-3 复测）
test: 让 AI 调用任一工具后完全退出重启，打开该对话
expected: AI 气泡 markdown 渲染，工具调用显示为带参数/结果/状态的工具卡片，无原始 JSON 文本
result: [pending]

### 4. 切换对话上下文衔接（G-42-4 复测）
test: 切换到另一对话再切回，发送「我们刚才聊到哪里」类问题
expected: AI 回答引用先前内容；主进程日志可见「已注入 N 条历史消息」
result: [pending]

### 5. 重命名行内编辑（G-42-5 复测）
test: 右键对话项 → 重命名，改名校验 Enter 与失焦两种确认
expected: 菜单关闭后面板保持打开、标题原位变输入框、确认后列表立即显示新标题。注意 WR-06：Escape 取消依赖浏览器行为假设，重点确认取消不误提交
result: [pending]

### 6. 长标题截断（前轮被重命名缺陷阻塞，本轮补测）
test: 重命名为超过 30 字符的标题
expected: 列表截断显示省略号，不撑破布局
result: [pending]

### 7. 删除确认框居中 + 真正删除 + 空状态（G-42-6/G-42-7 复测）
test: 右键 → 删除，观察确认框位置与文案；点「取消」再点「删除」
expected: 确认框屏幕居中、背景压暗；取消不删除；确认后对话与消息从库中消失、列表立即刷新；删除当前对话到达空状态
result: [pending]

### 8. 空状态后直接发送可恢复（G-42-1 可恢复性）
test: 删除最后一个对话后不经「新对话」直接发送消息
expected: 正常收到 AI 回复（无「AI 助手未初始化」报错），历史出现新建对话行
result: [pending]

### 9. 新建对话后立即发送（WR-05 修复路径复核）
test: 点「新对话」后不等待立刻发送消息
expected: 正常回复，无双重 Agent 症状（重复流式输出/事件重影）
result: [pending]

### 10. 旧对话（含工具调用）切换后继续提问（CR-01 修复路径复核）
test: 切换到 42-04 之前落库、用过工具调用的旧对话，继续发消息
expected: 请求不再被供应商拒绝（孤儿 toolCall 已合成占位 toolResult 闭合配对）；工具卡片显示「（历史工具结果未记录）」占位或真实结果
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

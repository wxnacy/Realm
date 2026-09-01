---
status: testing
phase: 42-ai-pi-agent
source: [42-01-SUMMARY.md, 42-02-SUMMARY.md]
started: 2026-09-01T06:56:16Z
updated: 2026-09-01T07:44:07Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 3
name: 消息持久化（重启保留）
expected: |
  完全退出 Realm 并重新启动应用，打开 AI 面板对话历史，之前的对话及消息记录仍然存在；点击该对话可查看历史消息。
awaiting: user response

## Tests

### 1. 对话历史按钮与下拉面板（空状态）
expected: 打开 AI 面板，头部设置按钮左侧出现对话历史按钮（时钟图标）；点击后展开对话列表下拉面板，无对话时显示空状态「暂无对话」和引导文案「点击「新对话」开始与 AI 交流」；点击面板外部可关闭。
result: issue
reported: "对话历史每次应用启动都会新建一个「新对话」的记录，显示0条消息，不应该这样"
severity: major

### 2. 发送消息自动创建对话
expected: 在 AI 聊天框发送一条消息，AI 回复完成后再次打开对话历史，列表出现标题为「新对话」的对话项并带元信息（日期 · 消息数），当前对话高亮（左侧蓝色竖条）。
result: issue
reported: "对话时点击列表看不到新的记录，需要点击新对话列表才会出现"
severity: major

### 3. 消息持久化（重启保留）
expected: 完全退出 Realm 并重新启动应用，打开 AI 面板对话历史，之前的对话及消息记录仍然存在；点击该对话可查看历史消息。
result: [pending]

### 4. 切换对话并恢复上下文
expected: 存在第二个对话时，从对话历史点击切换回第一个对话：当前消息列表被清空并加载第一个对话的历史消息；继续提问时 AI 能衔接之前的上下文。
result: [pending]

### 5. 新建对话
expected: 通过「新对话」入口创建后，消息列表清空，对话列表出现新的「新对话」条目并成为当前高亮对话。
result: [pending]

### 6. 对话重命名
expected: 右键对话项弹出上下文菜单（重命名/删除，删除项为红色）；点击「重命名」后标题变为可编辑输入框，输入新名称确认后列表立即显示新标题。
result: [pending]

### 7. 长标题截断
expected: 将对话标题重命名为超过 30 个字符的长文本，列表中标题截断显示省略号，不撑破列表项布局。
result: [pending]

### 8. 删除对话（确认框）
expected: 右键对话项选「删除」，弹出确认对话框显示「确定要删除「{title}」吗？此操作不可撤销。」；点「取消」或对话框外部不删除；点「删除」后对话从列表移除且消息一并删除；删除当前对话后自动切换。
result: [pending]

## Summary

total: 8
passed: 0
issues: 2
pending: 6
skipped: 0
blocked: 0

## Gaps

- gap_id: G-42-1
  truth: "无对话时对话历史显示空状态「暂无对话」；应用启动不应自动创建「新对话」记录"
  status: failed
  reason: "User reported: 对话历史每次应用启动都会新建一个「新对话」的记录，显示0条消息，不应该这样"
  severity: major
  test: 1
  root_cause: "ai-manager.js init()（739-748 行，由 main.js:3004 的 app.whenReady 调用）每次启动都主动 INSERT「新对话」；守卫 if (!this.currentConversationId) 恒为 true（该 id 仅存内存、从不持久化恢复）。AND 条件：deleteConversation（1678-1681 行）删除当前对话时自动补建新对话，renderer 删除流程里还有一处重复 createNewConversation（renderer.js:7032-7034，潜在双建），导致空状态永远不可达。D-06 决策与期望 UX 冲突，需修订"
  artifacts:
    - path: "ai-manager.js"
      issue: "init() 启动时急切创建对话（739-748）；deleteConversation 删除当前对话自动补建（1678-1681）；currentConversationId 仅内存不恢复（570）"
    - path: "main.js"
      issue: "app.whenReady 内无条件 aiManager.init()（3000-3009）"
    - path: "src/renderer.js"
      issue: "删除流程中重复调用 createNewConversation（7032-7034）"
  missing:
    - "对话创建改为惰性：currentConversationId 初始为 null，首条消息发送或显式点击「新对话」时才建行"
    - "删除当前/最后一个对话不再自动补建，允许到达空状态"
    - "移除 renderer 删除流程中的重复 createNewConversation"
    - "修订 42-CONTEXT.md 的 D-06 决策"
  debug_session: ".planning/debug/startup-empty-conversation.md"

- gap_id: G-42-2
  truth: "AI 回复完成后，对话历史列表立即能看到新对话记录（打开列表即刷新）"
  status: failed
  reason: "User reported: 对话时点击列表看不到新的记录，需要点击新对话列表才会出现"
  severity: major
  test: 2
  root_cause: "三条件与门：① 发送消息链路（handleSendAIMessage → ai:prompt → aiManager.prompt）完全不创建/认领对话，消息静默写入 init() 预建的 currentConversationId 行；唯一可触达的建行入口是显式点「新对话」——「发送消息自动创建对话」根本未实现，所以记录只在点新对话后出现。② 即使持久化成功，列表也看不出变化：getConversations 不返回 message_count（渲染回退为「0 条消息」）、标题保持「新对话」（D-04 首条消息自动命名未实现）、日期只有天粒度，聊天前后渲染结果逐字节相同。③ renderer 永远不知道主进程的 currentConversationId（getState 未暴露，仅在切换/创建响应时写入），聊过的行连高亮都没有。下拉本身无缓存问题（每次打开都重新 IPC 查询）。附带确认缺陷：saveMessages 每次用新 id 重复 INSERT 整个历史（INSERT OR REPLACE 不去重），6 条消息产生 14 行"
  artifacts:
    - path: "ai-manager.js"
      issue: "prompt/promptWithContext（821-877, 889-933）无对话创建/ID 回传；agent_end 保存（1099-1128→1591-1617）静默写入预建行；getState（1840-1852）未暴露对话 id"
    - path: "ai-conversations-manager.js"
      issue: "getConversations（176-183）缺 message_count；saveMessages（264-304）id 不稳定导致每次保存重复插入"
    - path: "src/renderer.js"
      issue: "handleSendAIMessage（7715-7776）无对话交互；元信息回退 0 条消息（6728-6729）；currentConversationId 仅在切换/创建响应设置（6789, 6825）"
  missing:
    - "主进程发送路径首条消息惰性创建（或认领）对话，并把对话 id 回传给 renderer（如通过 prompt 响应）"
    - "getConversations 增加 message_count（LEFT JOIN COUNT）"
    - "实现 D-04 首条用户消息自动命名，使真实对话与启动垃圾行可区分"
    - "修复 saveMessages id 不稳定：重复保存应 REPLACE 而非重复插入"
  debug_session: ".planning/debug/conversation-list-not-refreshed.md"

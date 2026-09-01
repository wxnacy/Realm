---
status: testing
phase: 42-ai-pi-agent
source: [42-01-SUMMARY.md, 42-02-SUMMARY.md]
started: 2026-09-01T06:56:16Z
updated: 2026-09-01T11:41:22Z
---

## Current Test

[testing paused — 1 blocked item outstanding]

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
result: issue
reported: "之前的对话没有是新对话，这个符合预期。消息记录是存在的，但是展示的AI消息回复是 json 没有格式成 markdown 和 工具调用。"
severity: major

### 4. 切换对话并恢复上下文
expected: 存在第二个对话时，从对话历史点击切换回第一个对话：当前消息列表被清空并加载第一个对话的历史消息；继续提问时 AI 能衔接之前的上下文。
result: issue
reported: "虽然消息列表加载了信息（并且没有格式化，使用的 json），但是消息没有加到上下文，对话是重新开始的"
severity: major

### 5. 新建对话
expected: 通过「新对话」入口创建后，消息列表清空，对话列表出现新的「新对话」条目并成为当前高亮对话。
result: pass

### 6. 对话重命名
expected: 右键对话项弹出上下文菜单（重命名/删除，删除项为红色）；点击「重命名」后标题变为可编辑输入框，输入新名称确认后列表立即显示新标题。
result: issue
reported: "点击重命名后列表消失后，没有任何其他反应"
severity: major

### 7. 长标题截断
expected: 将对话标题重命名为超过 30 个字符的长文本，列表中标题截断显示省略号，不撑破列表项布局。
result: blocked
blocked_by: other
reason: "因为 Test6 ，这个也没办法测试"

### 8. 删除对话（确认框）
expected: 右键对话项选「删除」，弹出确认对话框显示「确定要删除「{title}」吗？此操作不可撤销。」；点「取消」或对话框外部不删除；点「删除」后对话从列表移除且消息一并删除；删除当前对话后自动切换。
result: issue
reported: "删除框又出现在左上角，应该出现在中央，并且点击删除后没有真的删除。这次修复后应该记录到 AGENTS.md 中，以后弹框都应该显示在中央"
severity: major

## Summary

total: 8
passed: 1
issues: 6
pending: 0
skipped: 0
blocked: 1

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

- gap_id: G-42-3
  truth: "重启后点击历史对话查看消息记录，AI 消息回复以 markdown 格式渲染并正常展示工具调用，而非原始 JSON 文本"
  status: failed
  reason: "User reported: 消息记录是存在的，但是展示的AI消息回复是 json 没有格式成 markdown 和 工具调用"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-42-4
  truth: "从对话历史切换回某个历史对话后，继续提问时 AI 能衔接该对话之前的上下文（历史消息参与 LLM 上下文）"
  status: failed
  reason: "User reported: 虽然消息列表加载了信息（并且没有格式化，使用的 json），但是消息没有加到上下文，对话是重新开始的"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-42-5
  truth: "右键菜单点「重命名」后，对话项标题变为可编辑输入框，确认后列表立即显示新标题"
  status: failed
  reason: "User reported: 点击重命名后列表消失后，没有任何其他反应"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-42-6
  truth: "确认框点「删除」后，对话从列表移除且消息一并删除；删除当前对话后自动切换"
  status: failed
  reason: "User reported: 点击删除后没有真的删除"
  severity: major
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-42-7
  truth: "确认对话框（及所有弹框）显示在屏幕中央，而非左上角"
  status: failed
  reason: "User reported: 删除框又出现在左上角，应该出现在中央。用户要求：这次修复后应记录到 AGENTS.md，以后弹框都应该显示在中央"
  severity: cosmetic
  test: 8
  root_cause: ""
  artifacts: []
  missing:
    - "用户明确要求：修复后须在 AGENTS.md 记录全局约定——以后所有弹框都应显示在中央"
  debug_session: ""

## Session Notes

### 2026-09-01 19:41（UAT 会话走完 — status: partial）

8 项测试全部过完：1 通过 / 6 问题 / 1 blocked（Test 7 长标题截断被 Test 6 重命名失效阻塞，不单独建 gap）。G-42-1、G-42-2 沿用先前诊断；G-42-3（AI 回复渲染为原始 JSON）、G-42-4（切换对话后上下文未恢复）、G-42-5（重命名无响应）、G-42-6（删除未生效）、G-42-7（确认框在左上角）为本轮新增，待诊断。用户明确要求：弹框居中修复后写入 AGENTS.md 全局约定（已记录在 G-42-7.missing）。

### 2026-09-01 19:26（Test 3 结果）

Test 3 记录 issue（G-42-3）：持久化本身通过——重启后原对话与消息仍在，且未复现 G-42-1 描述的「启动自动建一条 0 消息新对话」行为（可能与工作区未提交改动 ai-manager.js/ipc-handlers.js/src/renderer.js 有关）；G-42-1 状态仍保持 failed，最终以修复计划的执行验证为准。新问题：AI 回复消息在重启后的历史视图中渲染为原始 JSON，未格式化为 markdown 与工具调用 → 新增 G-42-3（major，待诊断）。

### 2026-09-01 15:59（UAT 中途状态总结）

**进度**：8 项测试，0 通过 / 2 问题（均已诊断根因）/ 6 待测。当前停在 Test 3（消息持久化）。

**已诊断缺口（修复计划待全部测试完成后统一生成，走 `/gsd-execute-phase 42 --gaps-only`）**：

- **G-42-1 启动自动建空对话**（major）：`ai-manager.js init()`（739-748 行）每次启动主动 INSERT「新对话」，守卫恒真（currentConversationId 仅内存）；叠加 `deleteConversation`（1678-1681）删除当前对话自动补建 + renderer 删除流程重复创建（renderer.js:7032-7034），空状态永远不可达。修复方向：对话创建惰性化 + 删除不补建 + 移除重复创建 + 修订 D-06 决策。
- **G-42-2 新记录要点「新对话」才出现**（major）：发送消息链路完全不创建/认领对话（消息静默写入 init() 预建行），「发送消息自动创建对话」未实现；且 getConversations 缺 message_count、D-04 首条消息自动命名未实现、对话 id 不回传 renderer，列表聊天前后逐字节相同。附带缺陷：saveMessages 每次保存用新 id 重复 INSERT（6 条消息 14 行）。修复方向：发送路径惰性建行/认领 + id 回传 + message_count + 自动命名 + 修 saveMessages。

**环境操作**：2026-09-01 15:51 应用户要求清空测试环境（realm-dev）AI 聊天记录——dev 实例已退出，`ai-conversations.db`（含 wal/shm）已删除，原库备份在 `/tmp/realm-dev-ai-conv-backup-20260901-155158/`。正式版 Realm.app（realm/）未动。**注意**：G-42-1 未修复前，重启后仍会自动出现一条 0 消息的「新对话」，属预期行为，不是清空失败。

**下一步**：用户重新 `npm run dev`，从干净数据执行 Test 3（发消息 → AI 回复 → 完全退出重启 → 验证对话和消息仍在）。

---
status: testing
phase: 21-ai-agent-ui
source: [21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md]
started: 2026-08-01T10:34:51Z
updated: 2026-08-01T11:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 5
name: 拖拽调整面板宽度
expected: |
  鼠标悬停面板左边缘显示调整光标，拖拽可在 280px-600px 范围内实时调整宽度。
awaiting: user response

## Tests

### 1. 打开/关闭 AI 面板
expected: 点击工具栏 AI 按钮或按 Cmd/Ctrl+] → 右侧面板 250ms 动画滑出，网页区域自动缩小；再次触发收起
result: pass
prev_report: "快捷键没有反应；启动默认展开；X按钮无反应"（根因已修复）
note: 修复后用户全程实测面板开关、设置跳转、消息交互均正常（截图确认）

### 2. 发送消息与流式输出
expected: 输入消息按 Enter 发送 → 用户消息靠右显示（深色气泡），AI 占位符出现并逐字流式输出，光标闪烁；结束后光标消失
result: pass
prev_report: "Enter变换行；发送按钮无反应"（根因已修复）
note: 用户实测发送、流式输出、typing 指示器均正常（"非常完美"）；光标已按需求替换为 typing 三点指示器

### 3. Markdown 渲染与代码高亮
expected: AI 回复中的 Markdown（标题、列表、粗体等）正确渲染为格式化内容；代码块有语法高亮而非纯文本
result: pass

### 4. 智能滚动与回到底部
expected: 新消息到达时自动滚到底部；手动上滚超过 100px 后自动滚动暂停，右下角出现"回到底部"按钮；点击后回到底部并恢复自动滚动
result: pass

### 5. 拖拽调整面板宽度
expected: 鼠标悬停面板左边缘显示调整光标，拖拽可在 280px-600px 范围内实时调整宽度
result: [pending]
prev_report: "拖几像素就卡住"——webview 吞鼠标事件 + width 过渡滞后；已修复待复测

### 6. 输入框行为
expected: Enter 发送消息；Shift+Enter 换行；多行输入时输入框自动增高（约 40px-120px 封顶），发送后复位
result: [pending]

### 7. 工具执行卡片
expected: AI 调用工具时显示可折叠卡片：默认折叠显示工具名+状态图标（执行中旋转、成功✓、失败✗）；点击展开查看参数和执行结果
result: [pending]

### 8. 消息复制与重新生成
expected: 消息上显示复制按钮，点击后内容进入剪贴板（有提示）；AI 消息额外显示"重新生成"按钮，点击后重新生成该回复
result: [pending]

### 9. 面板宽度持久化
expected: 拖拽调整宽度后关闭再打开面板（或重启应用），面板恢复上次调整的宽度而非默认 360px
result: [pending]

### 10. 空状态引导
expected: 无消息时面板显示空状态引导文案"准备好聊天了吗？"；发送首条消息后空状态消失
result: [pending]

### 11. 错误处理与重试
expected: AI 请求失败时（如未配置 API Key/断网）显示独立错误容器和重试按钮；点击重试重新发起请求
result: [pending]

### 12. AI 面板头部设置按钮（#aiSettingsBtn）HTML 元素
expected: AI 面板头部设置按钮（#aiSettingsBtn）HTML 元素
result: pass
source: automated
coverage_id: D1

### 13. openAISettings 跳转到设置→AI助手分区
expected: 点击 AI 面板头部设置按钮 → 打开设置页面并自动定位到「AI 助手」分区
result: [pending]
prev_report: "进入设置空白页面"（分区名 'ai' → 'ai-assistant' 已修复，待复测）

## Summary

total: 13
passed: 5
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

- truth: "Cmd/Ctrl+] 快捷键可切换 AI 面板显示/隐藏"
  status: fixed
  reason: "User reported: 快捷键没有反应"
  severity: major
  test: 1
  root_cause: "index.html 中 AI 面板 HTML 位于 <script src=renderer.js> 之后，renderer.js 顶层 elements 快照时面板 DOM 未解析 → elements.aiPanel=null → toggleAIPanel 抛 TypeError"
  artifacts:
    - path: "src/index.html"
      issue: "script 标签在 AI 面板 DOM 之前"
  missing: []
  fix: "script 标签移至面板 HTML 之后（</body> 前）"

- truth: "应用启动时 AI 面板默认收起（或恢复上次持久化状态）"
  status: fixed
  reason: "User reported: 应用启动后是默认出现面板的，应该默认收起"
  severity: major
  test: 1
  root_cause: "#aiPanel 缺少 hidden 初始类；CSS 设计为 .ai-panel 默认收起、:not(.hidden) 才展开"
  artifacts:
    - path: "src/index.html"
      issue: "class=\"ai-panel\" 缺 hidden"
  missing: []
  fix: "加 hidden 类；另补 init 时恢复持久化开关状态（D-04，原 21-01 已知 stub）"

- truth: "面板右上角 X 关闭按钮点击可关闭面板"
  status: fixed
  reason: "User reported: 面板右上角x号点击没有反应"
  severity: major
  test: 1
  root_cause: "同根因1：elements.aiPanelCloseBtn=null → setupEventListeners 中 if 守卫跳过绑定"
  artifacts:
    - path: "src/index.html"
      issue: "script 标签在 AI 面板 DOM 之前"
  missing: []
  fix: "同根因1"

- truth: "AI 面板设置按钮点击后打开设置页面并定位到「AI 助手」分区"
  status: fixed
  reason: "User reported: AI助手的设置按钮点击应该自动跳转到设置->AI助手页面，现在进入的是设置的空白页面"
  severity: major
  test: 13
  root_cause: "openAISettings 调 openSettingsTab('ai')，但设置页分区名为 'ai-assistant'（settings-page.js:214）；switchSettingsPage('ai') 找不到 settings-ai → 所有分区隐藏 → 空白页"
  artifacts:
    - path: "src/renderer.js"
      issue: "openAISettings 分区名错误"
  missing: []
  fix: "改为 openSettingsTab('ai-assistant')"

- truth: "输入框 Enter 发送消息，Shift+Enter 换行（D-15）"
  status: fixed
  reason: "User reported: 回车无法发送消息，是换行，跟讨论不符"
  severity: major
  test: 2
  root_cause: "同根因1：elements.aiInput=null → keydown 监听器未绑定 → Enter 走 textarea 默认换行"
  artifacts:
    - path: "src/index.html"
      issue: "script 标签在 AI 面板 DOM 之前"
  missing: []
  fix: "同根因1"

- truth: "点击发送按钮可发送消息"
  status: fixed
  reason: "User reported: 点击发送按钮没有反应"
  severity: major
  test: 2
  root_cause: "同根因1：elements.aiSendBtn=null → click 监听器未绑定"
  artifacts:
    - path: "src/index.html"
      issue: "script 标签在 AI 面板 DOM 之前"
  missing: []
  fix: "同根因1"

## 附带发现并修复（用户尚未测到）

- marked/highlight.js 已安装但未在 index.html 加载（CSP script-src 'self' 禁 CDN）→ D-07 Markdown/代码高亮实际不生效。修复：加载 node_modules marked UMD + vendor/highlight.min.js（v11.11.1 与依赖一致）+ github-dark 主题 CSS
- 面板宽度持久化键 'ai.panelWidth' 点号写入嵌套对象、读取用扁平键 → 永不命中（test 9 必挂）。修复：改扁平键 'aiPanelWidth'
- 面板开关状态启动时未恢复（21-01 已知 stub）。修复：init 读取 aiPanelOpen 恢复
- 空状态从未初始渲染（test 10 必挂）。修复：init 末尾调 renderAIMessages()
- 拖拽调整手柄监听器未绑定（同根因1，test 5 必挂）

## 第二轮：AI 连接链路修复（2026-08-01 晚）

用户实测：首条消息发出后回复只有光标无内容，第二条消息发不出去。日志 `[Realm AI] AI Manager 未初始化`。

- **根因 A**：`builtinModels` 从包根 `@earendil-works/pi-ai` 导入，但该函数实际由子路径 `providers/all` 导出 → init 必抛异常 → 任何 key 都初始化不了（Phase 19/20 隐性 bug，此前从未跑到）
- **根因 B**：未初始化时主进程只 console.error，不广播 error 事件 → 渲染端流式占位符永久卡住 + aiStreaming 锁死后续发送。修复：未初始化/处理中两条路径都广播 error 事件；重试耗尽事件的 payload 从 `{error:{message}}` 改为 `{message}`（渲染端读 event.message，原形状显示 undefined）
- **需求变更**：设置页原仅支持 OpenAI。用户有 Xiaomi MiMo key，要求可筛选下拉选择提供商。实现：
  - ai-manager：多提供商配置 `ai.providers{id:{apiKey,model}}` + `ai.activeProvider`；旧版 `ai.apiKey` 自动迁移；`getAvailableModels()` 改为异步返回 38 个提供商目录（含配置徽标和 Key 尾号预览）
  - pi-ai 内置 `xiaomi`（api.xiaomimimo.com，6 个 MiMo 模型，openai-completions API）
  - 设置页 AI 分区：提供商筛选下拉（输入过滤 + 已配置徽标）+ 模型联动下拉 + Key 占位符显示保存状态
  - main.js 路由 ai/models 异步化、ai/configure 透传 model
  - 功能测试 6 项全过（迁移/xiaomi 配置/目录/状态/错误事件）

## 第三轮：事件契约翻译层（2026-08-01 晚）

用户实测：xiaomi 配置成功、状态已连接，但发送 hi 后回复是空白气泡（高度塌陷）。

- **根因**：`_setupEventBroadcasting` 把 pi-agent-core SDK 事件**原样透传**，但渲染端按 21-01 设计的简化契约读取，字段完全对不上：
  - SDK `message_update` 携带 `{message, assistantMessageEvent}`（content 是内容块数组），渲染端读 `event.content` → undefined → 空白气泡
  - SDK 工具事件是 `tool_execution_start/update/end`（toolCallId/toolName/args），渲染端读 `tool_execution_id/tool_name/status` → 工具卡片也永远不会渲染
  - SDK 每轮（含工具调用中间轮）都发 `turn_end`，渲染端把它当 run 结束 → 多轮场景会提前终止流式状态
- **修复**：主进程新增翻译层——SDK 事件 → UI 契约：
  - `_extractText()` 从内容块数组提取 text 块累积全文 → `{content}`
  - 工具 start/update/end → `{tool_execution_id, tool_name, status, params, result, error}`（running/completed/failed）
  - 中间轮 `turn_end` 只同步文本；`agent_end` 才发最终文本 + `turn_end` 终止信号（空文本不覆盖气泡）
- **日志**：按用户要求补充 AI 返回内容日志——本轮回复、回复完成（截断 1000 字）、工具调用参数/结果预览
- 模拟事件序列测试通过：文本累积、工具状态映射、turn_end 仅在 run 末尾出现一次
- **闪烁修复（484f4b1）**：流式期间气泡整块闪烁——message_update 批次每 16ms 触发 `renderAIMessages()` 全量 innerHTML 重建（60 次/秒整树重绘）。改为 `updateAIStreamingBubble()` 定向替换当前气泡 content 节点；turn_end 才全量渲染
- **完成瞬间闪烁修复（3e362be）**：turn_end 的一次全量重建导致完成时整体闪一下。改为 `finalizeAIStreamingBubble()` 定向收尾（最终渲染去光标 + 追加操作按钮），操作按钮提取为 `createMessageActions()` 共用
- **typing 指示器（52c4962）**：按用户 UI 优化需求，等待期（气泡无内容时）显示三点跳动 loading，去掉流式光标；文字流出后指示器消失
- **拖拽卡顿修复**：用户报"拖几像素就不动"。根因：①鼠标经过 webview 区域时 guest 页吞掉 mousemove（Electron webview 经典坑）②250ms width 过渡让拖拽滞后。修复：拖拽期间禁用所有 webview pointer-events + `.resizing` 类关闭过渡

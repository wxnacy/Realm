# AI 聊天斜杠命令（/clear、/compact）设计与实现

> 2026-09-03 完成初版与三轮修复。功能：AI 输入框支持 `/` 斜杠命令，首批 `/clear`（开启新对话）与 `/compact [重点说明]`（LLM 摘要压缩上下文）。

## 一、调研结论（主流 AI 助手做法）

- **Claude Code**：`/compact` 调 LLM 将历史总结为结构化摘要，同一会话内继续，并回注最近几轮原文保持连贯；`/clear` 全新空上下文；支持 `/compact <聚焦指令>` 可选参数
- **Cursor**：`@` 引用上下文、`/` 执行操作，两套符号职责分离（Realm 已有 @ 面板，模式天然对齐）
- **通用 UX**：输入起始位置 `/` 弹命令菜单，继续输入过滤，↑/↓ + Enter 执行；命令文本不入对话历史；执行后显示系统反馈

## 二、已确认的设计决策

1. **/compact 语义**（Claude Code 式）：LLM 摘要压缩点前全部历史 + 回注最近 4 轮原文（`COMPACT_RECENT_TURNS = 4`），同一会话内继续
2. **持久化**：压缩后经 `saveMessages` 全量替换事务落库（压缩点前旧行自动删除）；重开对话（switchConversation）上下文同为压缩态
3. **交互**：输入框起始位置 `/` 弹命令面板（保留触发字符，用户可看到 `/clear` 原文回车执行）；↑/↓ 循环导航、Enter/点击执行高亮项、Esc 关闭；焦点留在输入框；命令文本绝不进入对话历史
4. **摘要消息形状**：`{ role: 'user', content: '<context-summary>…</context-summary>' }`——pi-ai 适配器只认 user/assistant/toolResult，自定义 role 会破坏请求；XML 标记活在 content 里才能穿越 `saveCurrentConversation` 的全量重写（与 `<referenced-tab>` 注入模式一致）

## 三、实现清单

### 主进程

| 位置 | 内容 |
|---|---|
| `ai-manager.js` | `SUMMARY_SYSTEM_PROMPT`、`COMPACT_RECENT_TURNS=4` 常量；`compactConversation(options)`：守卫（未初始化/无对话/isProcessing 互斥）→ 切分最近 4 轮（切点取 user 行起点，保证 toolCall/toolResult 配对完整）→ `_serializeMessagesForSummary` 序列化旧消息 → `models.completeSimple` 非流式生成摘要 → `[summaryMsg, ...recent]` 替换 `agent.state.messages` → `saveMessages` 全量落库；返回 `{ before, after, tokensBefore, tokensAfter }` |
| `ai-manager.js` | 摘要 prompt：四小节结构（【任务目标】【关键决策】【当前状态】【注意事项】），focus 参数拼接「用户特别要求」（截断 500 字符） |
| `ai-conversations-manager.js` | `readMessageRows` 排序改为 `ORDER BY rowid ASC`（见修复 2）；`getMessages` 识别 `<context-summary>` 行 → `role:'summary'` 并剥壳透传摘要正文 |

### IPC

- 新增 `ai:compact-conversation`（参数 `{ focus?: string }`）+ preload `ai.compactConversation`
- 新增 `ai:get-conversation-messages`（轻量只读，不切换/不重建 Agent）+ preload `conversationAPI.getMessages`——供压缩后实时刷新列表

### 渲染端

| 内容 | 说明 |
|---|---|
| `SLASH_COMMANDS` 注册表 | `{ name, description, takesArg, handler }`，扩展只需追加条目 |
| / 命令面板 | DOM `#slashPickerPanel`（复用 @ 面板定位模式）；`handleAIInputAutoResize` 检测起始 `/`；过滤串 = `/` 后首个空白前文本；↑/↓ 循环 + Enter/点击执行高亮项 + Esc 关闭 + 点击外部关闭 |
| `executeActiveSlashCommand` | 按高亮项直接执行（输入可为前缀如 `/cle`），args 取命令名后剩余文本 |
| `handleSendAIMessage` 拦截 | 位于 `aiStreaming` 守卫之前（流式中也可执行命令）；精确匹配 → 执行 handler；未知命令 → 提示条且不入历史 |
| `executeSlashClear` | 流式中先 abort（设 `aiCancelledByUser`）→ 复用 `createNewConversation` → 提示条「已开启新对话」 |
| `executeSlashCompact` | 流式中先 abort → 设 `state.aiCompacting`（禁发送、按钮旋转 loading、提示条三点动画）→ IPC 压缩 → 成功后经 `getMessages` 重载列表 + 追加结果提示条；`try/finally` 保证状态复位 |
| 可折叠摘要框 | `renderAIMessages` 的 `role:'summary'` 分支：`📄 上下文已压缩（点击查看摘要） ▾`，默认折叠、点击 toggle（纯 DOM class 切换）；正文 pre-wrap、超高内部滚动 |
| 系统提示条 | `role:'system-note'` 居中灰底小字条；纯渲染形状不入库 |

## 四、落地过程中发现并修复的问题

1. **面板前缀执行 bug**：输入 `/cle` 时 Enter 走 `handleSendAIMessage` 文本精确匹配会落「未知命令」。改为 `executeActiveSlashCommand()` 按高亮项直接执行。
2. **DB 回读顺序错位**（用户报障「你能做什么么」）：`readMessageRows` 原按 `created_at ASC` 排序——重插的最近轮次保留原始时间戳，摘要时间戳是压缩时刻（最新），每次 DB 回读都把摘要从上下文开头错位到结尾并经 turn_end 保存固化。改为 `ORDER BY rowid ASC`（rowid = 最后一次全量保存的数组顺序）。
3. **短对话误压缩**（用户报障「再用Gola」）：对话不足 4 轮时循环未命中切点，`cutIdx` 保持 `messages.length` → 全部历史被压缩、原文零保留。增加 `userCount < COMPACT_RECENT_TURNS` → skipped 拦截。
4. **压缩期间可发送消息**：新增 `state.aiCompacting` 守卫（含斜杠命令一并拦截），发送按钮禁用态旋转图标，消息列表提示条尾随三点动画。
5. **摘要框塌陷成横线**（用户报障「查看历史记录」）：`.ai-summary-box` 的 `overflow: hidden` 使 flex 子项失去 min-content 高度保护，列表内容超高时被压成 0 高只剩边框。加 `flex-shrink: 0`。

## 五、数据验证方式

SQLite 直查 `~/Library/Application Support/realm-dev/ai-conversations.db`（注意区分 realm/realm-dev/realm-nightly 环境）：

```sql
-- 对话定位
SELECT id, title FROM conversations WHERE title LIKE '%…%';
-- 消息构成（role/content 长度/摘要行验证）
SELECT rowid, role, length(content), substr(content,1,80) FROM messages
WHERE conversation_id='…' ORDER BY rowid;
```

验证要点：摘要行 `<context-summary>` 完整闭合；压缩点前旧行已删除；`getAgentMessages` 注入后 LLM 能回答仅存于摘要的信息（如「90 条收藏」）即证明摘要真实生效。

## 六、已知取舍与后续可扩展

- 以 `/` 开头的普通文本（如 `/usr/local`）会被识别为未知命令并提示（Claude Code 同款行为）；逃生舱「`//` 转义发送原文」本期不做
- 摘要滑出 `_compactContext` 滑动窗口（20 条）后自然退出上下文，属预期；后续可考虑自动压缩（上下文接近阈值时触发）
- 新命令（/help、/model 等）只需追加 `SLASH_COMMANDS` 条目 + handler

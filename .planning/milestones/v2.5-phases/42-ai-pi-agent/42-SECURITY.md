---
phase: 42
slug: ai-pi-agent
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-09-02
---

# Phase 42 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer→IPC | 渲染进程通过 conversationAPI 调用主进程（assertTrustedSender 把守） | 对话 ID、标题、消息文本 |
| UI→data | 用户输入（对话标题）传入主进程落库 | 标题文本 |
| DB→Agent context | 库行 JSON.parse 重建 AgentMessage 进入 LLM 上下文管线 | 本机历史消息 |
| DB 行→显示层 | getMessages 合并输出经 innerHTML 渲染路径 | 消息文本（DOMPurify 消毒） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-42-01 | Tampering | ai-conversations-manager.js | medium | mitigate | 参数化查询：9 处 prepare() 全部走 better-sqlite3 占位符，无字符串拼接 SQL | closed |
| T-42-02 | Information Disclosure | conversations/messages | low | accept | 本地 userData 目录存储，与 history.db 同级，隔离由操作系统保证 | closed |
| T-42-03 | Tampering | IPC channels | medium | mitigate | ipc-handlers.js assertTrustedSender(event) 校验受信窗口（managedWindowIds），ai:* 全通道覆盖 | closed |
| T-42-SC | Tampering | npm/pip/cargo installs | high | mitigate | 无新增依赖（42-01/03/04/05 四计划均复用已安装 better-sqlite3） | closed |
| T-42-04 | Tampering | renderer.js 重命名输入 | low | mitigate | 特殊字符转义：标题渲染走 textContent 路径（renderer.js:6723），无 innerHTML 注入面。注：input 未设 maxlength 属性（非安全面，长度由 UI 30 字符截断展示兜底） | closed |
| T-42-05 | Elevation of Privilege | IPC 调用 | medium | mitigate | assertTrustedSender + conversationId/newTitle 类型与空值校验（ipc-handlers.js:1819-1833） | closed |
| T-42-06 | Tampering | 标题派生（_ensureConversation） | low | mitigate | 标题截断 30 字符（D-04）+ 参数化落库 + textContent 渲染 | closed |
| T-42-07 | Spoofing | ai:prompt / ai:prompt-with-context | medium | mitigate | 沿用 assertTrustedSender 既有校验，未新增未受信调用方 | closed |
| T-42-08 | Tampering | parseStoredContent / tool_calls 列 JSON.parse | medium | mitigate | safeJsonParse（ai-conversations-manager.js:144-152）try/catch 全覆盖，损坏行降级为纯文本/空工具列表 | closed |
| T-42-09 | Information Disclosure | 恢复的上下文注入 LLM | low | accept | 本机用户自身历史对话，无跨信任数据；工具结果 100KB 截断沿用 | closed |
| T-42-09 | Tampering | getMessages 合并 → innerHTML 渲染 | low | mitigate | 合并不改内容来源：最终文本仍经 renderAIMarkdown + DOMPurify（renderer.js:7455-7456，T-21-01），工具卡片走 renderToolCard 结构化渲染 | closed |
| T-42-10 | Tampering | dataset.conversationId → ai:delete-conversation | low | mitigate | dataset 由 String(conversationId) 写入（renderer.js:7005）+ IPC 侧 assertTrustedSender + 空 id 抛错 | closed |
| T-42-10 | DoS | 同回合合并放大单条显示消息体积 | low | accept | 合并上限即一个 AI 回合行数，tool_calls/tool_results 列 100KB 截断（serializeToolData） | closed |
| T-42-11 | Tampering | 确认文案标题插值 | low | mitigate | textContent 赋值路径（非 innerHTML），无注入面 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-42-1 | T-42-02 | 对话数据本地明文存储，隔离依赖 OS 用户权限，与既有 history.db 同级同策略 | plan 42-01 | 2026-09-01 |
| AR-42-2 | T-42-09 (Info Disclosure) | 注入 LLM 的是本机用户自身历史，无跨信任数据 | plan 42-04 | 2026-09-01 |
| AR-42-3 | T-42-10 (DoS) | 合并上限为一个 AI 回合行数，列级 100KB 截断兜底 | plan 42-06 | 2026-09-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-02 | 14（含跨计划重复 ID 实例） | 14 | 0 | orchestrator L1 grep（ASVS L1，register_authored_at_plan_time: true，threats_open: 0 短路） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-02

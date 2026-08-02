---
phase: 23
slug: context-reference
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# Phase 23 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| IPC → favorites-manager | 搜索关键词经 IPC 传入主进程 | 用户关键词（低敏感） |
| renderer → IPC → ai-manager | 引用标签页内容经 IPC 传递到主进程 | 页面正文（中敏感，含用户浏览内容） |
| webview guest → renderer | executeJavaScript 从 guest 页面提取内容 | 页面 DOM 文本（中敏感） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-23-01 | Tampering | FTS5 查询注入 | medium | mitigate | better-sqlite3 参数化查询（`MATCH ?` 绑定参数，favorites-manager.js:395-402），不拼接 SQL | closed |
| T-23-02 | Tampering | AI 工具参数注入 | low | mitigate | pi-agent-core 参数校验 + `required: ['query']` + 非空检查（ai-manager.js:1017-1023） | closed |
| T-23-03 | Tampering | IPC referencedTabs 伪造 | medium | mitigate | `assertTrustedSender` 仅信渲染进程 + message 类型校验 + title/url XML 转义（ipc-handlers.js ai:prompt-with-context / ai-manager _escapeXml）；content 作为不可信纯文本注入，不执行 | closed |
| T-23-04 | Elevation of Privilege | webview executeJavaScript 注入 | medium | mitigate | 提取脚本为硬编码同步 IIFE，不拼接外部输入；Readability bundle 由主进程从磁盘读取经 `ai:get-readability-script` 下发（非渲染进程可指定内容）；内容截断 102,400 字符 | closed |
| T-23-05 | Information Disclosure | 跨容器标签页内容泄露 | low | accept | 用户决策 D-13 明确允许跨容器引用；选择器行与 Pill 均标注容器来源（名称+颜色圆点，D-14） | closed |

*Status: open · closed*
*Severity: critical > high > medium > low — block_on=high，本批最高 medium，无阻塞项*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-23-01 | T-23-05 | D-13 用户明确决策允许 @ 引用跨容器可见；容器来源在选择器与 Pill 中显式标注（D-14），用户知情授权 | 用户（D-13/D-14 决策记录） | 2026-08-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 5 | 5 | 0 | verify-work 编排器（L1 grep 级，ASVS-1 短路规则） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02

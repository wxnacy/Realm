---
phase: 20
slug: ai-agent
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# Phase 20 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → main | IPC 调用通过 contextBridge 暴露，需要验证来源 | 用户消息、API Key 配置 |
| main → LLM | API Key 存储在主进程，不暴露到渲染进程 | API Key（高敏感） |
| webview(guest) → main | 设置页通过 HTTP /api/settings/* 访问主进程 | API Key 配置（POST body） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-20-01 | Information Disclosure | API Key 存储 | high | mitigate | API Key 存于 electron-store 主进程（`ai-manager.js:94,323` `configStore.get/set('ai.apiKey')`），无 IPC 通道返回 key 本体 | closed |
| T-20-02 | Tampering | IPC 通道 | medium | mitigate | 5 个 AI 通道入口均调用 `assertTrustedSender(event)`（`ipc-handlers.js:1082,1098,1111,1126,1138`） | closed |
| T-20-03 | Elevation of Privilege | 工具执行 | medium | mitigate | 5 个工具均带 TypeBox `parameters` schema 做参数类型校验（`ai-manager.js:395,421,464,512,592`） | closed |
| T-20-SC | Tampering | npm installs | low | accept | Phase 19 已验证 pi-ai 和 pi-agent-core 包合法性 | closed |
| T-20-04 | Information Disclosure | API Key 传输 | high | mitigate | `ai:configure` 通道 `assertTrustedSender` 验证来源（`ipc-handlers.js:1111`）；设置页输入框 `type="password"`（`src/settings.html:242`） | closed |
| T-20-05 | Tampering | 设置页面输入 | medium | mitigate | 设置页渲染全程 `textContent` 而非 innerHTML（`src/settings-page.js`，WR-13 注释明确说明防 XSS）；`ai/configure` HTTP 路由校验 `config.apiKey` 非空（`main.js:860`） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-20-01 | T-20-SC | npm 依赖（pi-ai、pi-agent-core）篡改风险低，Phase 19 已完成包合法性验证 | plan (20-01/20-02) | 2026-08-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-01 | 6 | 6 | 0 | gsd-verify-work (L1 grep-depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-01

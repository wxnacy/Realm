---
phase: 02
slug: browser-core-url-navigation-multi-tab
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-24
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer ↔ 远程网页 | 启用 webviewTag 后，渲染进程可嵌入远程网页内容，不可信内容进入应用进程边界 | 远程 HTML/JS（不可信） |
| 用户 URL/搜索输入 → webview 导航 | 不可信输入经 normalizeUrl 后进入 webview.src / loadURL，加载远程内容 | 用户输入（不可信） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-04-01 | Elevation of Privilege | window-manager.js webPreferences | medium | mitigate | 仅添加 `webviewTag: true`；保持 `contextIsolation: true`、`nodeIntegration: false` 不变（window-manager.js:32-38 已确认）；webview 侧沿用 `WEBVIEW_WEBPREFERENCES = 'contextIsolation=yes'`，布尔属性 nodeintegration/disablewebsecurity/allowpopups 一律缺席即 false（renderer.js，presence 语义注释） | closed |
| T-02-04-02 | Tampering | src/renderer.js URL Enter 处理器 | low | accept | 导航目标由用户输入经 normalizeUrl 处理，行为与修复前一致，未扩大输入面；partition 隔离（persist:container-{id}）不受影响 — 见 Accepted Risks Log | closed |
| T-02-05-01 | Tampering | URL Enter 处理器 / createTab 调用链（renderer.js） | medium | mitigate | 已确认两条分支均只传 normalizeUrl 处理后的值：有活动 Tab → `webview.loadURL(normalizedUrl)`；无活动 Tab → `createTab(state.currentContainer, normalizedUrl)`；新标签页搜索框 → `createTab(state.currentContainer, normalizeUrl(value))`。无原始输入直达 webview.src | closed |
| T-02-05-02 | Tampering | index.html / main.css 静态 UI 变更 | low | accept | 纯静态 SVG/CSS 变更，无新增输入面、无 JS 逻辑改动，图标切换由既有 loading class 驱动 — 见 Accepted Risks Log | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-04-02 | 输入面未扩大：导航目标始终经 normalizeUrl，与修复前行为一致；容器 partition 隔离不受影响 | orchestrator (L1 audit) | 2026-07-24 |
| AR-02-02 | T-02-05-02 | 纯静态 UI 变更（SVG 图标 + CSS 规则），无 JS 逻辑改动、无新增输入面 | orchestrator (L1 audit) | 2026-07-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-24 | 4 | 4 | 0 | orchestrator (L1 grep-depth, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-24

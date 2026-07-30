---
phase: 17
slug: chrome
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-30
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 渲染进程 → 主进程 | favorites 页面（webview）经 /api/favorites/* HTTP + token 调用导入端点，文件内容经 POST body 传递 | 书签文件内容（低敏感，本地环回 + token 鉴权） |
| 外部文件 → 应用 | Chrome 书签 JSON / Netscape HTML 是外部输入，需验证格式 | 外部文件内容（不可信输入） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-17-01 | Tampering | 书签文件解析 | medium | mitigate | JSON.parse / 文件读取失败均捕获并返回 `{success:false, error}`，不执行部分导入（favorites-manager.js:1039, 1056, 1182） | closed |
| T-17-02 | Information Disclosure | dialog:open IPC | low | accept | Electron `dialog.showOpenDialog` 内置安全 API，仅返回用户选择的文件路径（见 Accepted Risks R-17-01） | closed |
| T-17-03 | Denial of Service | 批量导入 | medium | mitigate | 每批 100 条分批（favorites-manager.js:965）+ AbortController 取消（favorites-manager.js:1086）+ INSERT OR IGNORE 单条去重不中断 | closed |
| T-17-SC | Tampering | npm install cheerio | high | mitigate | cheerio 1.2.0 实装验证；Package Legitimacy Audit 见 17-RESEARCH.md（12 年历史，20M+ 周下载） | closed |
| T-17-04 | Tampering | 文件选择 | low | accept | webview 原生 `<input type="file" accept=".json,.html,.htm">`，用户主动选择（见 Accepted Risks R-17-02） | closed |
| T-17-05 | Elevation of Privilege | 导入按钮 | low | accept | 导入按钮仅触发已有后端 API，HTTP 端点受 REALM_TOKEN 鉴权保护（见 Accepted Risks R-17-03） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-17-01 | T-17-02 | `dialog.showOpenDialog` 是 Electron 内置安全 API，仅返回用户选择的文件路径，不暴露额外文件系统访问 | user (UAT 2026-07-30) | 2026-07-30 |
| R-17-02 | T-17-04 | webview 原生文件选择由 Chromium 沙箱承载，accept 属性限定类型，用户主动选择文件 | user (UAT 2026-07-30) | 2026-07-30 |
| R-17-03 | T-17-05 | 导入端点监听 localhost 且需 REALM_TOKEN（随机 UUID 每启动轮换），无额外权限提升面 | user (UAT 2026-07-30) | 2026-07-30 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-30 | 6 | 6 | 0 | main-session (L1 grep-depth, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-30

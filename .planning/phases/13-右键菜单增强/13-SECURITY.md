---
phase: 13
slug: 右键菜单增强
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-28
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Renderer → Main (IPC) | 渲染进程发送的菜单请求参数（tabInfo/contextInfo）可能被恶意 webview 注入篡改 | guestContentsId、editFlags、pageURL（低敏感，主进程不执行） |
| Main → Renderer (IPC callback) | 主进程发送的菜单回调数据可能包含恶意 URL（如 javascript: 协议） | linkURL、srcURL、closed-tab 信息 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-13-01 | Tampering | IPC show-web-context-menu | medium | mitigate | 主进程不信任渲染进程传来的 guestContentsId，使用 activeWebviewContentsId 替代（main.js:1036-1041, ipc-handlers.js:23,1017）；getGuestWebContents 校验 isDestroyed | closed |
| T-13-02 | Spoofing | context-menu:closed-tab | low | accept | 已关闭栈仅用于 UI 功能（重新打开标签），不涉及安全敏感操作 | closed |
| T-13-03 | Information Disclosure | clipboard.writeText/writeImage | low | accept | 剪贴板操作是用户主动触发的右键菜单行为，属于预期功能 | closed |
| T-13-04 | Spoofing | context-menu:open-in-new-tab URL | medium | mitigate | createTab 前校验 URL 协议，拒绝 javascript: 等非 http(s)/realm 协议（renderer.js:1238） | closed |
| T-13-05 | Elevation of Privilege | context-menu:text-action executeJavaScript | medium | mitigate | text-action 白名单校验，仅允许 cut/copy/paste/selectAll（renderer.js:1308-1315） | closed |
| T-13-06 | Spoofing | faviconUrl 持久化 | low | accept | faviconUrl 仅用于 img.src 展示，不执行不跳转；data: URL 由 Chromium img 渲染沙箱处理 | closed |
| T-13-SC | Tampering | npm/pip/cargo installs | high | mitigate | 本阶段无新依赖安装（package.json 在 phase 13 期间无依赖变更，仅 Electron 内置 API） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-02 | 已关闭标签栈仅存 containerId/url/title，用于"重新打开已关闭标签页"UI 功能，无安全敏感操作 | plan | 2026-07-28 |
| AR-13-02 | T-13-03 | 剪贴板写入（复制链接/图片地址/图片）均为用户主动右键触发，属预期浏览器功能 | plan | 2026-07-28 |
| AR-13-03 | T-13-06 | faviconUrl 仅作 img.src 展示用途，持久化后不执行不跳转；恶意 data: URL 由 Chromium 渲染沙箱处理 | plan | 2026-07-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-28 | 7 | 7 | 0 | gsd-secure-phase (L1 grep verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-28

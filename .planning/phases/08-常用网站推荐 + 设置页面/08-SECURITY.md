---
phase: 08
slug: 常用网站推荐-设置页面
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-25
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| webview guest → API | 内部页面通过 /api/* 端点访问数据，需要 token 鉴权 | 历史记录、收藏、设置、容器列表（用户隐私数据） |
| 用户输入 → SQL | 容器 ID 需要 sanitizeContainerId 验证 | 容器 ID（表名拼接） |
| 用户输入 → URL | 搜索框输入需要验证，防止 XSS | 搜索词、URL 导航 |
| 主进程 → Google favicon 服务 | favicon 代理出站请求，域名参数需校验防 SSRF | 域名（低敏感） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Tampering | frequent-sites-manager.js SQL 查询 | high | mitigate | 参数化查询（`LIMIT ?` 绑定）；表名来自 sqlite_master 元数据且生成处经 `sanitizeContainerId`（history-manager.js:61） | closed |
| T-08-02 | Information Disclosure | API token 泄露 | medium | mitigate | `REALM_TOKEN = crypto.randomUUID()` 每次启动随机生成，仅经 `get-realm-port` IPC 传给受信主窗口（main.js:196-197） | closed |
| T-08-03 | Elevation of Privilege | CSRF / localhost 端口扫描 | medium | mitigate | 全部 5 个 API handler（history/favorites/frequent-sites/settings/containers）入口校验 token（main.js:248,306,429,478,547） | closed |
| T-08-04 | Information Disclosure | XSS via innerHTML | high | mitigate | 用户数据一律 `textContent` 渲染（newtab-page.js、settings-page.js）；`innerHTML` 仅用于 `= ''` 清空容器，无注入面 | closed |
| T-08-05 | Tampering | 搜索框注入 | medium | mitigate | `normalizeUrl` 协议/域名白名单判断 + `encodeURIComponent` 编码搜索词（newtab-page.js:61-81） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-25 | 5 | 5 | 0 | gsd-secure-phase (L1 grep-depth, orchestrator) |

**UAT 期间新增攻击面复核（2026-07-25）：**
- `/api/frequent-sites/favicon` 代理端点：token 鉴权（main.js:429 所属 handler）+ 域名格式正则校验防 SSRF + 5s 超时 + 内存缓存
- `/api/containers/list` 端点：token 鉴权（main.js:547）
- `open-external-url` IPC 负载改对象 `{url, containerId}`：containerId 来自主进程 configStore（非渲染进程输入），webview partition 隔离由 createTab 既有机制保证
- 默认浏览器注册改 http/https：仅调用 Electron 官方 API，触发 macOS 系统确认弹框，无静默提权

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-25

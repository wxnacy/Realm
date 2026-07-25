---
phase: 09
slug: 共享收藏数据库
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-25
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → preload → main | IPC 通信，contextBridge 隔离 | 收藏 CRUD 请求（url, title） |
| favorites-page → HTTP API | webview guest 通过 HTTP API 访问数据 | 收藏列表 / 搜索 / 编辑，token 鉴权 |
| main process → SQLite | favorites-manager 直接操作数据库 | 收藏记录（url, title, favicon_url, created_at） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | favorites-manager.js SQL 注入 | low | accept | 已移除动态表名拼接（sanitizeContainerId），全局表名固定为 `favorites`，无用户输入拼接到 SQL | closed |
| T-09-02 | Information Disclosure | favorites-page URL 参数 | low | accept | 移除 container 参数后 URL 更简洁，token 参数仍保留鉴权 | closed |
| T-09-SC | Tampering | npm/pip/cargo installs | low | accept | 本阶段无新增依赖（SUMMARY tech-stack.added: []） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-01 | 全局表名硬编码，无用户输入拼接路径；SQL 注入面已消除 | plan-author | 2026-07-25 |
| AR-09-02 | T-09-02 | container 参数本就非敏感标识符，移除后攻击面更小；token 鉴权保护真实数据 | plan-author | 2026-07-25 |
| AR-09-03 | T-09-SC | 本阶段纯重构，无新增第三方依赖 | plan-author | 2026-07-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-25 | 3 | 3 | 0 | gsd-secure-phase (orchestrator, L1 grep-depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-25

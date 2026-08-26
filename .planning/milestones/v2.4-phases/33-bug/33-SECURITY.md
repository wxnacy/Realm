---
phase: 33
slug: bug
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-14
---

# Phase 33 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| webview guest → HTTP API | 设置页（realm://settings）通过 HTTP API 访问凭据/地址数据 | 凭据元数据、地址 PII（加密） |
| HTTP API → storage layer | HTTP 路由层校验参数后调用 credential-manager / address-manager | 凭据密码（解密后）、地址明文 |
| webview preload → ipc-message | 表单检测结果通过 ipc-message 传递给主窗口 renderer | 凭据/地址表单字段值 |
| renderer → IPC → storage | 凭据/地址保存通过 IPC 调用主进程 | 凭据密码、地址 PII |
| renderer → IPC → address-manager | 地址保存通过 IPC 调用主进程，safeStorage 加密 | 地址 PII（姓名、电话、地址） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-33-01 | Tampering | /api/credentials/* HTTP API | high | mitigate | REALM_TOKEN 鉴权（随机 UUID），所有 HTTP 端点校验 token | closed |
| T-33-02 | Information Disclosure | 凭据密码明文传输 | medium | mitigate | 密码默认遮罩显示，仅展开详情时解密传输，列表不返回密码 | closed |
| T-33-03 | Tampering | 凭据表格 innerHTML XSS | high | mitigate | DOM 构建 + textContent 渲染（WR-13 模式），骨架行 innerHTML 为静态安全 HTML | closed |
| T-33-04 | Elevation | 批量删除无确认 | medium | mitigate | 二次确认对话框（per C-03），显示删除数量 | closed |
| T-33-05 | Information Disclosure | 地址 PII 明文存储 | critical | mitigate | safeStorage 加密存储 name/phone/address（macOS Keychain） | closed |
| T-33-06 | Tampering | /api/address/* HTTP API | high | mitigate | REALM_TOKEN 鉴权，所有 HTTP 端点校验 token | closed |
| T-33-07 | Tampering | 地址卡片 innerHTML XSS | high | mitigate | DOM 构建 + textContent 渲染（WR-13 模式） | closed |
| T-33-08 | Information Disclosure | 地址横幅泄露敏感信息 | low | accept | 横幅仅显示"检测到地址表单"提示，不显示具体地址内容 | closed — below high threshold (non-blocking) |
| T-33-09 | Elevation | 地址保存无确认 | medium | mitigate | 横幅需要用户主动点击"保存"按钮（per D-07） | closed |
| T-33-SC | Tampering | npm/pip/cargo installs | high | accept | 本阶段无新包安装 | closed — below high threshold (non-blocking) |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-33-01 | T-33-08 | 地址横幅仅显示"检测到地址表单"提示文案，不展示具体地址内容，信息泄露风险极低 | Plan 33-02 | 2026-08-14 |
| AR-33-02 | T-33-SC | 本阶段无新包安装，供应链攻击面无变化 | Plan 33-01/33-02 | 2026-08-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Mitigation Evidence

### T-33-01 / T-33-06: HTTP API Token 鉴权

所有 `/api/credentials/*` 和 `/api/address/*` 端点均校验 `REALM_TOKEN`：
- `main.js:handleCredentialsApi` — token 鉴权
- `main.js:handleAddressApi` — token 鉴权
- Token 为随机 UUID，仅设置页 webview 通过 URL 参数获取

### T-33-02: 凭据密码安全

- `listCredentials()` 不返回密码字段（SELECT 排除 encrypted_password）
- `getCredentialById()` 按需解密，仅展开详情时调用
- 密码默认遮罩显示，用户主动点击"显示"切换

### T-33-03 / T-33-07: XSS 防护

- 所有 DOM 渲染使用 `textContent`（WR-13 模式）
- 骨架行使用 `innerHTML` 但为静态 HTML，无用户数据
- `renderCredentialTable()` 和地址卡片均使用 DOM 构建 + textContent

### T-33-05: 地址 PII 加密

- `address-manager.js` 使用 `safeStorage.encryptStringAsync` 加密 name/phone/address
- `safeStorage` 使用 macOS Keychain 存储密钥
- `getAddress()` 使用 `safeStorage.decryptStringAsync` 解密返回

### T-33-04 / T-33-09: 操作确认

- 批量删除弹出确认对话框，显示删除数量
- 地址保存横幅需要用户主动点击"保存"按钮
- ESC 键和"暂不"按钮关闭横幅不保存

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-14 | 10 | 10 | 0 | gsd-secure-phase (L1 grep-depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-14

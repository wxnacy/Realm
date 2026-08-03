---
phase: 24
slug: task-autonomous
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-03
---

# Phase 24 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Retroactive-STRIDE：PLAN 无 threat_model 块，由 gsd-security-auditor 从实现文件回溯建模后验证（L1 grep-depth）。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 渲染进程 ↔ 主进程 IPC | contextBridge 暴露 realmAPI；确认卡片响应通道 action:confirm/cancel | 用户确认意图、actionId（高敏感 — 决定高风险操作是否执行） |
| AI 工具参数 → CDP 页面注入 | AI 生成的 field/target/script 参数经 sanitizeInput/转义后注入 guest 页面执行 | AI 生成文本（不可信输入）→ Runtime.evaluate |
| webview guest 隔离 | AI 工具通过 debugger 附加到 guest webContents 操作页面 | 页面 DOM 读写、文件上传路径、导航 URL |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-24-ipc-confirmation | Tampering/Spoofing | ai-manager.js / main.js 确认通道 | high | mitigate | actionId 经 pendingActions Map 归属校验 + 一次性删除，未知 ID 拒绝（main.js:1692-1703, 1712-1723）；30s 超时自动取消（main.js:103-115） | closed |
| T-24-captcha-bypass | Elevation of Privilege (design) | cdp-manager.js detectCaptcha | low | mitigate | 高风险确认门独立于检测且 fail-closed（ai-manager.js:1789-1874, 198-204）；检测双验证（cdp-manager.js:1892-1931） | closed |
| T-24-script-injection | Tampering | execute_script | high | mitigate | 双层静态分析：ai-manager.js:148-176 + cdp-manager.js:926-960 DANGEROUS_SCRIPT_PATTERNS，拦截脚本不达 Runtime.evaluate | closed |
| T-24-eval-string-injection | Injection | Runtime.evaluate 脚本拼接 | high | mitigate | sanitizeInput（ai-manager.js:97-137）先于两次 CDP 调用；脚本构建器转义 `\`/`'`/`"`（cdp-manager.js:748, 804） | closed |
| T-24-local-file-exfil | Information Disclosure | upload / DOM.setFileInputFiles | high | mitigate | upload 属 highRiskActions（ai-manager.js:1789）；fill_form 文件字段强制确认（:1612-1646） | closed |
| T-24-confirmation-failopen | Elevation of Privilege | 确认 handler 未注入 | high | mitigate | fail-closed：`confirmed: false, reason: 'no-handler'`（ai-manager.js:202-203；main.js:94-96） | closed |
| T-24-debugger-leak | Denial of Service | debugger 生命周期 | medium | mitigate | finally detachForAI（cdp-manager.js:1338, 1717, 2011）；detectCaptcha 条件 detach（:1935-1940） | closed |
| T-24-open-link-scheme | Tampering | open_link 任意导航 | medium | mitigate | 仅 http/https 白名单（ai-manager.js:1475-1477） | closed |
| T-24-unconfirmed-click | Elevation of Privilege | 按钮类 click 绕过确认 | medium | mitigate | inspectClickTarget 元素类型判定升级确认（ai-manager.js:1798-1805；cdp-manager.js:1959-2013） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-24-01 | T-24-ipc-confirmation | actionId 使用 Math.random()（约 31 bit 熵）；L1 下足够 —— 归属由 pendingActions Map 强制，确认 UI 与暴露通道同渲染进程；L2+ 加固可换 crypto.randomUUID() | auditor (informational) | 2026-08-03 |
| R-24-02 | T-24-ipc-confirmation | action:confirm/cancel 未校验 event.sender；仅主窗口 preload 暴露该通道，webview guest 无 ipcRenderer 路由 | auditor (informational) | 2026-08-03 |
| R-24-03 | T-24-unconfirmed-click | inspectClickTarget 失败 fail-open（文档化决策，与 CAPTCHA 预检策略一致）；支付关键词 + submit/upload/execute_script 门仍兜底 | auditor (informational) | 2026-08-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-03 | 9 | 9 | 0 | gsd-security-auditor (retroactive-STRIDE, L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-03

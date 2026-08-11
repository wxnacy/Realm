---
phase: 28
slug: player
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-08
---

# Phase 28 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → main (media:play) | 渲染进程传递 url 和 containerId，主进程校验参数类型与发送者 | 视频 URL、容器 ID（低敏感） |
| main → player (media:play-url) | 主进程发送媒体数据到播放器窗口，数据来源可信 | 媒体列表、容器名 |
| player → main (player:toggle-fullscreen / minimize / maximize / close) | 播放器窗口请求窗口操作，主进程校验发送者即当前播放器窗口 | 窗口控制指令 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-28-01 | Tampering | media:play IPC | medium | mitigate | `assertTrustedSender(event)` + url/containerId 类型校验（ipc-handlers.js） | closed |
| T-28-02 | Tampering | player:toggle-fullscreen IPC | low | accept | contextBridge + contextIsolation 保护（见 Accepted Risks R-28-01） | closed |
| T-28-03 | Information Disclosure | Session partition | medium | mitigate | 播放器复用来源容器 `persist:container-{id}` Session，不新建；containerId 仅用于 partition 构造 | closed |
| T-28-SC | Tampering | npm hls.js/mpegts.js/dashjs | high | mitigate | RESEARCH.md Package Legitimacy Audit：三库均为多年成熟项目（hls.js ~8 年 7.8M/wk），[SUS] 仅因版本发布时间近 | closed |
| T-28-04 | Tampering | player.js 格式检测 | low | accept | URL 后缀纯前端判断，不越安全边界（见 Accepted Risks R-28-02） | closed |
| T-28-05 | Elevation of Privilege | player:minimize/maximize/close IPC | low | mitigate | UAT 期间修正：`assertPlayerSender`（ipc-handlers.js）校验来源窗口 == 当前 playerWindow，比计划的 assertTrustedSender 更准确 | closed |
| T-28-06 | Information Disclosure | CSP unsafe-eval | medium | accept | 播放器窗口不加载外部页面；实际 player.html CSP 未含 unsafe-eval（dash.js v5 无 eval 需求），风险更低（见 Accepted Risks R-28-03） | closed |

*Status: open · closed*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-28-01 | T-28-02 | 播放器 IPC 经 contextBridge 暴露、contextIsolation 开启；UAT 后 toggle-fullscreen 已并入 assertPlayerSender 校验，双重保护 | user (UAT 2026-08-08) | 2026-08-08 |
| R-28-02 | T-28-04 | 格式检测为纯前端 URL 后缀判断，无安全边界影响 | user (UAT 2026-08-08) | 2026-08-08 |
| R-28-03 | T-28-06 | 播放器窗口仅加载本地 player.html，不加载外部页面；CSP 实际未开 unsafe-eval | user (UAT 2026-08-08) | 2026-08-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-08 | 7 | 7 | 0 | verify-work → secure-phase (L1, short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-08

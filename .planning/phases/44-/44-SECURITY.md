---
phase: "44"
slug: "player-video-cache-and-local-media-library"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-07"
---

# Phase 44 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 远端媒体源 → /proxy → 磁盘缓存 | 不可信远端内容经容器 session 回源后落盘本机 | 媒体分片（不可信内容入路径/磁盘） |
| localhost HTTP → realmServer | 本机任意进程可扫端口访问 /proxy 与 /api/tasks/*（token 防开放代理/信息泄漏） | HTTP 请求（token 鉴权面） |
| 磁盘缓存/录制目录 ↔ 文件系统 | 缓存 key/路径处理不当即路径穿越/symlink 逃逸写盘面 | 文件路径（穿越/逃逸面） |
| 持久化 JSON ↔ 任务注册表 | restore 数据被篡改可注入伪造任务字段 | media-tasks.json（类型白名单校验） |
| renderer → 主进程 IPC | 被攻破 renderer 滥用 record/convert/show-in-folder | IPC 消息（assertPlayerSender 边界） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-44-01 | Tampering | 缓存目录/分片文件名 | high | mitigate | 视频 ID/分片名一律 sha256 hex；media-cache-manager.js _safePath + realpath 复核（22 处命中） | closed |
| T-44-02 | Elevation | 缓存根 symlink 逃逸 | high | mitigate | 已存在路径 realpath 复核仍在 cacheRoot 内（同上） | closed |
| T-44-03 | DoS | 恶意超大分片/清单撑爆磁盘 | medium | mitigate | D-06 容量上限 + D-08 强淘重试（test-media-cache 覆盖） | closed |
| T-44-04 | Spoofing | 未持 token 调用 /proxy | high | mitigate | main.js:314 REALM_TOKEN 校验，缓存分支在鉴权之后 | closed |
| T-44-05 | Tampering | media-tasks.json 恢复 | low | accept | userData 内仅本机可写；restore 字段类型白名单 | closed (accepted) |
| T-44-06 | DoS | 超量任务注册 | low | accept | 录制并发上限 + convert 显式触发 | closed (accepted) |
| T-44-07 | Spoofing | 未持 token 调 /api/tasks/* | high | mitigate | handleTasksApi 入口统一 token 鉴权（main.js:2163-2166） | closed |
| T-44-08 | Tampering | 缓存目录被指到系统目录 | medium | mitigate | 仅 dialog.showOpenDialog 选取 + 写盘侧 cacheRoot 前缀/realpath 兜底 | closed |
| T-44-09 | Tampering | cacheMaxGB 非法值 | low | mitigate | 前端 1-1024 校验 + 主进程缺省回退 10GB | closed |
| T-44-10 | Information Disclosure | 无 token 泄漏任务路径 | medium | mitigate | 无 token 一律 403 不回任何字段 | closed |
| T-44-11 | Tampering | 录制分片文件名 | low | mitigate | 文件名纯数字 seq，目录为 uuid taskId，无远端输入入路径 | closed |
| T-44-12 | Elevation | 被攻破 renderer 滥用 record IPC | medium | mitigate | player:record/* 均 assertPlayerSender（ipc-handlers.js 14 处） | closed |
| T-44-13 | DoS | 恶意清单 targetDuration 轮询风暴 | medium | mitigate | MIN_POLL_INTERVAL_MS 钳制（media-record-engine.js:255）+ maxRetries=5 停录 | closed |
| T-44-14 | DoS | 录制无限增长占满磁盘 | medium | mitigate | UI 已录大小显示 + 用户显式停止；容量治理属 D-23 | closed |
| T-44-15 | Tampering | 产物文件名注入 | high | mitigate | sanitizeFilename 白名单替换（media-remuxer.js:39） | closed |
| T-44-16 | Elevation | 被攻破 renderer 滥用 convert | medium | mitigate | assertPlayerSender + D-17 服务端复校；分片路径不接受 renderer 传参 | closed |
| T-44-17 | DoS | 超大录制转封装内存膨胀 | medium | mitigate | 流式写盘 createWriteStream（media-remuxer.js 2 处） | closed |
| T-44-SC | Tampering | npm 依赖 mux.js@^6.3.0 | high | mitigate | RESEARCH 合法性审计 verdict OK（videojs/mux.js，无 postinstall 无原生模块）；package.json:52 在案 | closed |
| T-44-G06-01 | DoS | 源流 error 无监听致主进程崩溃 | high | mitigate | store() readable/collector/passthrough 三处 error 监听 + main.js tee.on('error') | closed |
| T-44-G06-02 | Spoofing | 缓存命中内容类型伪造 | low | accept | contentType 仅回放字段非可信；路径/哈希校验不削弱 | closed (accepted) |
| T-44-G07-01 | Tampering | 补算路径 task.id 入路径 | medium | mitigate | uuid 白名单 /^[0-9a-fA-F-]{8,64}$/（main.js:3050） | closed |
| T-44-G07-02 | DoS | 水位漂移扫描时机偏差 | low | accept | evictIfNeeded 以磁盘 listEntries 为权威，无数据损坏面 | closed (accepted) |
| T-44-G07-03 | DoS | 淘汰误删正在写盘分片 | medium | mitigate | storeBuffer 写目录自豁免 + D-07 isVideoActive 活跃豁免 | closed |
| T-44-G08-01 | Spoofing | cancel 端点鉴权旁路 | low | mitigate | /api/tasks/* 统一 REALM_TOKEN，无新增无鉴权路径 | closed |
| T-44-G08-02 | DoS | 恶意反复 stop 制造非法流转 | low | mitigate | not_found/终态返回 200 幂等，不制造二次流转 | closed |
| T-44-G08-03 | Tampering | 取消 unlink 半成品的路径面 | low | mitigate | 产物路径仅来自 showSaveDialog + getUniqueFilePath | closed |
| T-44-G08-04 | DoS | convertCancelTokens 无界增长 | low | mitigate | .finally 注销令牌，单任务单令牌 | closed |
| T-44-G09-01 | Information Disclosure | webview 直连绕过 /proxy Referer 净化 | low | accept | 与普通网页同信任级，无新增注入面 | closed (accepted) |
| T-44-G09-02 | Spoofing | 页 URL 中 token 不再被消费 | low | accept | token 不随 hls.js 请求外泄；展示层剥离 | closed (accepted) |
| T-44-G10-01 | Tampering | task.error/title 注入 toast | low | mitigate | showToast textContent 写入，无 innerHTML | closed |
| T-44-G10-02 | Elevation | toast click 携带任意路径 | low | mitigate | 复用 download:show-in-folder 既有校验通道，路径来自主进程注册表 | closed |
| T-44-G11-01 | DoS | 嗅探同步读超大分片 | low | mitigate | fs.readSync 定长 64KB，无循环拼接 | closed |
| T-44-G11-02 | Tampering | 伪装 TS 载荷进 mux.js | low | accept | mux.js 纯 JS 解析 + error 监听兜底；非内容安全审计目标 | closed (accepted) |
| T-44-G12-01 | Tampering | playbackKey 进 SQL 删除语句 | low | mitigate | 参数化 prepare + ? 占位（player-history-manager.js:126） | closed |
| T-44-G12-02 | Elevation | deleteEntry=true 伪造误删历史 | low | mitigate | IPC 严格 === true + 仅删除成功后联动 + hex 入参防御 | closed |
| T-44-G13-01 | XSS | 后端 error 注入反馈条 | low | mitigate | showTaskFeedback textContent 写入，文案为主进程自产 | closed |
| T-44-G13-02 | DoS | 失败反馈条反复刷屏 | low | accept | 单例覆盖式展示 + 4s 自愈，无 DOM 累积 | closed (accepted) |
| T-44-G06-SC / G07-SC / G08-SC / G09-SC / G10-SC / G11-SC / G12-SC / G13-SC | Tampering | npm/依赖（各 gap 计划零新增依赖） | high | mitigate | 44-06~44-13 计划均零新增包，不触发包合法性 gate | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-44-1 | T-44-05 | media-tasks.json 位于三环境隔离 userData，仅本机可写；restore 字段类型白名单 | user（计划评审） | 2026-09-06 |
| AR-44-2 | T-44-06 | 录制并发上限 + convert 显式触发，注册表不设硬上限风险可忽略 | user（计划评审） | 2026-09-06 |
| AR-44-3 | T-44-G06-02 | contentType 仅作回放展示，hls.js 不依赖其决定 demux 路径 | user（计划评审） | 2026-09-06 |
| AR-44-4 | T-44-G07-02 | 水位仅作扫描决策，磁盘 listEntries 为权威 | user（计划评审） | 2026-09-06 |
| AR-44-5 | T-44-G09-01/02 | webview 直连与普通网页同信任级；token 不外泄源站 | user（计划评审） | 2026-09-06 |
| AR-44-6 | T-44-G11-02 | mux.js 纯 JS 解析 + error 兜底；本 phase 目标为拒不可转格式 | user（计划评审） | 2026-09-06 |
| AR-44-7 | T-44-G13-02 | 反馈条单例覆盖 + 4s 自愈，无累积 | user（计划评审） | 2026-09-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-07 | 40 | 40 | 0 | gsd-secure-phase（L1 grep 验证，ASVS-1） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-07

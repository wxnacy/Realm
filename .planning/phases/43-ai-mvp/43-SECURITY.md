---
phase: 43
slug: ai-mvp
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-04
---

# Phase 43 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| LLM 工具调用 → 记忆文件 | LLM 生成的 content（可能含被浏览网页转述的注入指令/凭据）经 memory 工具写入持久文件 | 网页转述内容 → 持久化记忆文件 |
| 记忆文件 → system prompt | USER.md/MEMORY.md 内容随冻结快照进入每次 LLM 请求（外发至云端供应商） | 用户画像/全局记忆 → 云端 LLM |
| 容器生命周期 → 记忆文件系统 | 删除容器操作必须连带清除其记忆数据，否则构成跨生命周期的数据残留 | 容器删除 → memories/<id>.md |
| webview (realm://settings) → main.js HTTP 端点 | 本地 webview 携 token 请求编辑接口；同机其他进程/页面也可能探测该端口 | token 鉴权请求 → 记忆读写 |
| HTTP POST → 记忆文件 | 请求 body 的 content 直接写盘（人工路径，无 AI 扫描） | 人工编辑内容 → 记忆文件 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-43-01 | Tampering | memory 工具 write 路径（记忆投毒：恶意网页内容经 AI 转述持久化，跨会话放大） | critical | mitigate | `scanInjectionPatterns` 注入模式 fail-closed 拒写（ai-memory-manager.js:76/:223/:225 throw）；throw→isError:true toolResult；攻击语料库单测 `test/memory/threat-scan.test.js` | closed |
| T-43-02 | Information Disclosure | write 路径 + buildGlobalSnapshot（凭据入库外发至云端供应商） | critical | mitigate | `CREDENTIAL_PATTERNS` 凭据形态模式拦截（ai-memory-manager.js:54，同一扫描路径 :83）；良性语料零误伤校准（threat-scan.test.js） | closed |
| T-43-03 | Information Disclosure | memory/memory_read 活跃容器解析（跨容器记忆泄漏：写错层/读错容器） | high | mitigate | container 层 `resolveFile` fail-closed：containerId 缺失或非法即 throw（ai-memory-manager.js:128-130）；路径穿越防护 `CONTAINER_ID_RE`（:22）；容器记忆不进快照（buildGlobalSnapshot 仅含 USER.md/MEMORY.md，:349-357）；prohibition 单测断言 | closed |
| T-43-04 | Tampering | 记忆文件写入（假成功：返回成功但未落盘） | high | mitigate | `atomicWrite` 同步 tmp+rename 原子写（ai-memory-manager.js:143-145）完成后才 return；业务校验失败一律 throw（prohibition 单测） | closed |
| T-43-SC | Tampering | npm 包安装 | high | mitigate | 本阶段零新依赖（AI-SPEC §2 锁定；package.json dependencies 复核无新增）；无安装任务、无 [ASSUMED]/[SUS] 包 | closed |
| T-43-05 | Information Disclosure | container-manager.deleteContainer 记忆钩子（容器删除后记忆残留 = 隔离承诺破坏） | high | mitigate | 钩子 `await deleteContainerMemory(id)` 挂在 deleteCookies 之后（container-manager.js:313）；删除后 readContainer 空态测试；AI-SPEC 监控指标「memories/ 残留数恒为 0」 | closed |
| T-43-06 | DoS | scenario-harness 真实模型调用（token 费用失控） | low | accept | harness 仅 UAT 前手动全量跑（AI-SPEC §5 决策：不设为提交门禁）；无 Key 自动 skip；本地单人使用无放大面 | closed |
| T-43-07 | Elevation of Privilege | /api/ai-memory 端点（localhost 端口扫描读改记忆文件） | medium | mitigate | `REALM_TOKEN` 查询参数鉴权，不匹配 403（main.js:2191-2193，与 7+ 既有 /api/* 路由同方案） | closed |
| T-43-08 | Tampering | POST container scope 写孤儿记忆（手改 URL 对已删容器写入） | medium | mitigate | POST 校验容器存在，不存在 400「容器不存在」（main.js:2227-2229） | closed |
| T-43-09 | Tampering | HTTP 端点绕过 AI 写入护栏大量注入内容 | low | accept | 端点仅本机 token 持有者可用（即用户本人）；D-11 拍板人工编辑不经扫描是设计语义而非漏洞；端点严格走 writeScope，预算校验仍生效（main.js:2231-2232） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-43-01 | T-43-06 | scenario-harness 真实模型调用的 token 费用：仅手动全量跑、不设为提交门禁、无 Key 自动 skip、本地单人使用无放大面 | 用户（PLAN 43-02 D 决策，AI-SPEC §5） | 2026-09-04 |
| AR-43-02 | T-43-09 | 人工编辑路径绕过 AI 扫描：端点仅本机 token 持有者可用，D-11 拍板为设计语义而非漏洞；预算校验仍生效防误操作膨胀 | 用户（PLAN 43-03 D 决策） | 2026-09-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-04 | 10 | 10 | 0 | CodeBuddy（orchestrator，ASVS L1 grep 级验证） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-04

---
phase: "45"
slug: "bilibili-fmp4-transcode"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-08"
---

# Phase 45 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time（三个 PLAN 均含 `<threat_model>`）；ASVS L1 grep-depth 核验短路（threats_open: 0）。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 远端 m3u8 清单 → parser | 清单文本为不可信输入，MAP URI 来自远端 | 清单文本 / mapUri |
| 远端 init/分片字节 → 拼接产物 | init 与 moof/mdat 字节为不可信输入，原样进入用户磁盘产物 | 二进制分片 |
| 拼接产物 → 本地播放器 | 畸形产物可致播放器异常（崩溃面在播放器，不在本进程） | MP4 产物 |
| 远端清单 mapUri → 录制/缓存目录 init 文件 | mapUri 为远端不可信输入，下载内容原样落盘 | init 二进制 |
| renderer/任务页 → convert 编排 | 转换入口参数不可信（Phase 44 assertPlayerSender/服务端复校，本阶段零改动） | IPC 参数 |
| 缓存 meta.json → getConvertInfo/initPath | 本地 meta 可被篡改（T-44 系列字段白名单校验语义沿用） | 本地 JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-45-01 | Tampering | 畸形 init/分片致静默坏产物 | high | mitigate | init ftyp 头校验 fail-fast（invalid_init，media-remuxer.js:525-528）+ probe 终检（moov + moof ≥1）+ fail() 清理半成品；拼接不解析 moof/trun（攻击面=字节拷贝） | closed |
| T-45-02 | DoS | 超大分片/清单致内存膨胀 | medium | mitigate | 流式写盘逐分片 readFileSync + createWriteStream（media-remuxer.js:300/351，T-44-17 沿用）；MAX_SEGMENT_BYTES 64MB 来源侧上限沿用（T-44-03）；probe 仅读 4MB 头 | closed |
| T-45-03 | Tampering | 远端 mapUri 路径注入落盘（录制） | high | mitigate | init 落盘文件名固定常量 `'init'`（media-record-engine.js:244，远端 URI 不进路径，T-44-11 沿用）；resolveUri 仅决定请求 URL | closed |
| T-45-04 | DoS | 畸形/超大 init 响应耗尽资源 | medium | mitigate | init 下载走 fetchPage 既有通道（容器 session 约束）；失败容忍当轮下轮重试不阻断录制本体；大小由拼接层 ftyp 校验 + probe 终检兜底（T-45-01） | closed |
| T-45-05 | Tampering | init 写盘路径越界（缓存） | high | mitigate | init 路径经 `_safePath` resolve+realpath 双基准（media-cache-manager.js:137/443）+ 文件名固定常量 `'init'`；uri_key 为 segKey sha256 不参与路径拼接 | closed |
| T-45-06 | Tampering | init 混入 segments 污染完整性判定 | medium | mitigate | map_uris O(1) 成员判定排除（media-cache-manager.js:440/700-704，Pitfall 2 硬约束）；测试断言 meta.segments 无 init 键 + completeness/playlist_order 不回归 | closed |
| T-45-SC | Tampering | npm/pip/cargo 安装（×3 plans） | low | accept | 零新依赖（D-01 locked）——`git diff 853f4bd..HEAD package.json` 为空；mux.js 6.3.0 为 Phase 44 已审既有依赖，本阶段仅复用 probe/generator | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-45-01 | T-45-SC | 供应链面零增量：零新依赖（D-01），mux.js 复用 Phase 44 已审依赖（44 RESEARCH legitimacy verdict OK） | plan-time disposition（accept） | 2026-09-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-08 | 7 | 7 | 0 | execute-phase orchestrator（L1 grep-depth，短路径） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-08

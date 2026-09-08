---
phase: "45"
slug: "bilibili-fmp4-transcode"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-08"
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 源自 45-RESEARCH.md `## Validation Architecture`（2026-09-07 调研）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test（Node 内置，零依赖，项目既有） |
| **Config file** | none — 直接 `node tests/test-*.js` |
| **Quick run command** | `node tests/test-media-remuxer.js` |
| **Full suite command** | `node tests/test-media-remuxer.js && node tests/test-media-cache.js && node tests/test-media-record-duration.js` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-media-remuxer.js`
- **After every plan wave:** Run full suite（`node tests/test-media-remuxer.js && node tests/test-media-cache.js && node tests/test-media-record-duration.js`）
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

> 本阶段 REQUIREMENTS.md 未映射需求 ID（phase_req_ids 为 null），按 RESEARCH.md 需求映射。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-ext-x-map | TBD | TBD | EXT-X-MAP 解析 | — | N/A | unit | `node tests/test-media-remuxer.js`（或独立 parser 测试文件） | ❌ W0 | ⬜ pending |
| 45-fmp4-concat | TBD | TBD | fMP4 拼接执行体 | 畸形 init/分片致拼接崩溃 | init ftyp 头校验 fail-fast；拼接不解析 moof/trun 内部（攻击面=字节拷贝） | unit | `node tests/test-media-remuxer.js` | ❌ W0（含 :176 拒转用例改写为分流语义） | ⬜ pending |
| 45-record-init | TBD | TBD | 录制链路 init 留存 | 远端 URI 路径注入 | init 文件名固定常量不进远端输入；分片文件名纯数字 seq（T-44-11 先例） | unit/e2e（stub fetchPage） | `node tests/test-media-record-duration.js` | ❌ W0 | ⬜ pending |
| 45-cache-map | TBD | TBD | 缓存链路 MAP 排除+留存 | 远端 URI 路径注入 | init 存放复用 `_safePath` 路径越界校验 + segKey sha256 | unit | `node tests/test-media-cache.js` | ❌ W0 | ⬜ pending |
| 45-e2e-bilibili | TBD | TBD | 真实 B 站流端到端 | 恶意清单超大/畸形分片 DoS | MAX_SEGMENT_BYTES（64MB）上限 + 流式写盘不全量入内存（T-44-17/T-44-03 沿用） | manual-only（token 时效+直播偶发，Pitfall 7） | UAT tracer | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 夹具生成 helper（mux.js generator 封装：makeInit()/makeFmp4Segment()）——新建，建议 tests/helpers/ 或测试文件内联
- [ ] `tests/test-media-remuxer.js` :176 拒转用例改写为分流语义
- [ ] Framework install: none needed（node:test 既有）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 真实 B 站流端到端转码可播 | Phase goal | token 时效 + 直播流偶发（RESEARCH Pitfall 7），无法自动化 | UAT tracer：抓取真实 B 站 fMP4 流录制→转换→mpv/VLC 播放验证 |
| QuickTime Player 播放拼接产物 | A1（RESEARCH Assumptions Log） | AVFoundation 支持 fMP4 系推断未实测 | UAT checkpoint：转换产物用 QuickTime 打开确认（失败不阻塞，mpv/VLC 已实测兜底） |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

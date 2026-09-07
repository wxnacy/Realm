---
phase: 44
slug: ""
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-06
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 独立 node 断言脚本（tests/*.js，无框架）+ `node --test`（memory 子目录先例，源自 44-RESEARCH.md Validation Architecture） |
| **Config file** | none — 沿用现有 `node tests/test-*.js` 惯例 |
| **Quick run command** | `node tests/test-media-cache.js` |
| **Full suite command** | `node tests/test-media-cache.js && node tests/test-m3u8-playlist-parser.js && node tests/test-media-task-registry.js && node tests/test-unified-navigation.js` |
| **Estimated runtime** | ~10 seconds |

**关键前置（来自 RESEARCH.md）**：新模块（缓存索引/任务注册表/m3u8 解析）必须与 Electron 解耦设计（constructor 注入根目录/路径），否则纯逻辑单测无法脱离主进程运行 — Wave 0 必须先建立该边界。

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-media-cache.js`
- **After every plan wave:** Run full suite（`node tests/test-media-cache.js && node tests/test-m3u8-playlist-parser.js && node tests/test-media-task-registry.js && node tests/test-unified-navigation.js`）
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

> 本阶段 REQUIREMENTS.md 未映射需求 ID（TBD），以下按 CONTEXT.md 交付物映射（D-XX 编号见 CONTEXT.md）。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-W0-cache | 01 | 0 | D-05/07/08/09 | T-44-proxy-token | 缓存仅经 token 鉴权的 /proxy 命中，直写目录不外泄 | unit（纯逻辑） | `node tests/test-media-cache.js` | ✅ | ✅ green（20 pass） |
| 44-W0-parser | 01 | 0 | 录制解析 | — | N/A | unit | `node tests/test-m3u8-playlist-parser.js` | ✅ | ✅ green（15 pass） |
| 44-W0-registry | 01 | 0 | D-25 | — | N/A | unit | `node tests/test-media-task-registry.js` | ✅ | ✅ green（26 pass） |
| 44-resume-key | — | — | D-12/续播 | — | N/A | unit（可并入 test-media-cache） | `node tests/test-media-cache.js` | ✅ | ✅ green（并入 20 pass） |
| 44-nav-regression | — | — | D-02 导航回归 | — | N/A | integration（playwright _electron） | `node tests/test-unified-navigation.js` | ✅ 既有 | ✅ green（32 pass） |
| 44-remuxer | 05 | 4 | D-21 转封装 | — | N/A | unit | `node tests/test-media-remuxer.js` | ✅ | ✅ green（23 pass） |
| 44-record-duration | 16 | 1 | G-44-4 时长平滑 | — | N/A | unit | `node tests/test-media-record-duration.js` | ✅ | ✅ green（4 pass） |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Validation Audit 2026-09-07

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

全部 6 个测试文件实跑全绿（120 断言 / 0 失败），requirements 全部 COVERED，新增 44-05/44-16 产出的两个测试文件补入映射表。

---

## Wave 0 Requirements

- [x] `tests/test-media-cache.js` — 覆盖 D-05~D-10、D-12（缓存索引/FIFO 淘汰豁免活跃任务/磁盘满强淘/哈希校验删片/续播 key）
- [x] `tests/test-m3u8-playlist-parser.js` — 覆盖录制解析（MEDIA-SEQUENCE/分片列举/ENDLIST/targetDuration）
- [x] `tests/test-media-task-registry.js` — 覆盖 D-25 状态机（running→completed/failed/cancelled/interrupted + 持久化 + record→convert 接力）
- [x] Framework install: none needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 打包版通知/转封装真机行为 | Phase gate | 通知与 showSaveDialog 涉及系统行为，`make install` 后真机启动才能验证 | `make install` 装出 .app 后实际启动，走一次录制→转换→通知链路 |
| 秒开体感（已看部分重开） | D-05 级目标 | 依赖真实网络与磁盘时序，断言脚本测不出"秒开" | 重开已观看视频，观察分片是否从磁盘缓存命中 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-07（Nyquist audit：0 gap）

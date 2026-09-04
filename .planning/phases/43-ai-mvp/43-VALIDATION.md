---
phase: 43
slug: ai-mvp
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-04
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test（node 内置，零新依赖 — 项目现无测试框架先例，现有 scripts/test-*.js 为独立脚本） |
| **Config file** | none — Wave 0 installs（新建 tests/test-ai-memory.js，`node --test tests/`） |
| **Quick run command** | `node --test tests/test-ai-memory.js` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds |

**关键前置（来自 RESEARCH.md）**：`ai-memory-manager.js` 的 `userData` 路径必须可注入临时目录，否则无法对落盘行为（懒创建/预算/清理）做自动化验证 — Wave 0 必须先解决路径注入。

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/test-ai-memory.js`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-T1 | 43-01 | 0/1 | MEM-01/02/03/04 | T-43-03/04 | 容器记忆不进快照、原子写后才返回 | unit | `npm run test:memory` | ❌ W0（T1 自建） | ⬜ pending |
| 43-01-T2 | 43-01 | 1 | MEM-01/02 | T-43-04 | 校验失败一律 throw、稳定编号不回收 | unit | `npm run test:memory` | ❌ W0（T1 自建） | ⬜ pending |
| 43-01-T3 | 43-01 | 1 | MEM-01/02 | T-43-01/02 | 注入+凭据 fail-closed 拒写、良性零误伤 | unit | `npm run test:memory` | ❌ W0（T1 自建） | ⬜ pending |
| 43-02-T1 | 43-02 | 2 | MEM-05 | T-43-05 | 删除容器后记忆文件清理、read 空态 | unit | `npm run test:memory` | ✅（43-01 建立后扩展） | ⬜ pending |
| 43-02-T2 | 43-02 | 2 | MEM-02/03 | T-43-01/02/03 | 14 场景对抗/边界机器断言 | scenario | `npm run eval:memory`（无 Key skip） | ❌（T2 自建） | ⬜ pending |
| 43-03-T1 | 43-03 | 2 | MEM-06 | T-43-07/08 | token 鉴权、scope 白名单、容器存在校验 | source+check | `node --check main.js` + grep 源断言 | ✅（main.js） | ⬜ pending |
| 43-03-T2 | 43-03 | 2 | MEM-06 | — | UI 文案契约、CSP 无内联隐藏 | source+check | `node --check src/settings-page.js` + grep | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/memory/` 目录 + `npm run test:memory` script（43-01 T1 建立；planner 采用 AI-SPEC §5 定稿的 `test/memory/` + node:test 形态，Quick run command 为 `npm run test:memory`，替代本文件早前的 `tests/test-ai-memory.js` 草案路径——fixture/harness 同目录便于相对引用）
- [x] `ai-memory-manager.js` 路径可注入（`setBaseDir(dir)` 可覆写 + electron `app` 惰性获取，43-01 T1 tracer 任务落地，临时目录注入经 `test/memory/helpers.js` 统一入口）

*若 planner 决定沿用 scripts/test-*.js 独立脚本风格，替换 Quick run command 为对应脚本路径并保持断言式退出码（exit 0/1）。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 新会话 system prompt 含冻结快照 | MEMORY.md 注入 | 需真实 LLM 会话观察 | 改 MEMORY.md → 开新 AI 会话 → 问"你记得什么" |
| 容器删除后记忆文件清理联动 | 删除联动清理 | 涉及真实窗口/容器生命周期 | 删除容器 → 检查 `memories/<containerId>.md` 已消失 |
| 设置页 /api/ai-memory 编辑器 UI | 设置页编辑入口 | CSP/真实渲染环境 | 打开 realm://settings → AI 记忆分区 → 编辑保存回读 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references（43-01 T1 自建 test/memory/ 套件 + setBaseDir 注入）
- [x] No watch-mode flags
- [x] Feedback latency < 10s（node:test 离线秒级）
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 43-ai-mvp
plan: 02
subsystem: main-process / container-lifecycle + eval-harness
tags: [ai-memory, container-lifecycle, eval-harness, security]
requires: ["ai-memory-manager.js deleteContainerMemory（43-01 提供）", "test/memory/ node:test 基建（43-01）"]
provides:
  - "container-manager.js deleteContainer 记忆清理钩子（await，deleteCookies 之后 / configStore.set 之前，T-43-05 缓解落地）"
  - "删除确认框「该容器的 AI 记忆将一并删除」提示（UI-SPEC Copywriting Contract）"
  - "npm run eval:memory：fixture 驱动场景评估 harness（--dry-run 结构自检；无 Key 自动 skip 退出 0）"
  - "test/memory/fixtures/：14 个场景（5 critical-path + 6 adversarial + 3 boundary）"
affects: ["43-03（/api/ai-memory 不受本 plan 影响；UAT 前可跑 npm run eval:memory 回归）"]
tech-stack:
  added: []
  patterns: ["Module._load 拦截注入 electron/electron-store/tab-manager stub（同 test-ai-conversations.js 手法）", "anyOf 备选断言组（拒绝写入或明确告知的二择一行为）", "只读 configStore 包装（探活真实 AI 配置但不写回）"]
key-files:
  created: ["test/memory/scenario-harness.js", "test/memory/fixtures/（14 个）"]
  modified: ["container-manager.js", "src/renderer.js", "test/memory/storage.test.js", "package.json"]
decisions:
  - "删除钩子用惰性 require + await（删除方保证原子性，T-43-05）；日志只在 manager 内记一处（deleteContainerMemory 已带 [Realm] 删除容器 AI 记忆 前缀）"
  - "harness 复用 ai-manager 完整工具链（非复制工具定义）：Module._load 拦截 './tab-manager' 注入 mock，fixture.activeContainer 经 setActiveContainer 生效（D-02 调用时解析语义在真实 execute 内走通）"
  - "expect 格式在 AI-SPEC §5 最小集上扩展两个可选键：assistantSays（正则匹配助手回复文本）与 anyOf（备选断言组）——「拒绝写入或明确告知」类二择一行为无法用纯合取表达；安全性不变式（文件不含恶意/凭据内容）恒放在 anyOf 之外的顶层键"
  - "对抗类 fixture 的 anyOf 允许「fail-closed throw」与「AI 主动拒绝」两分支——不惩罚更聪明的拒绝行为，落盘不变式仍恒断言"
  - "模型可用性探测读真实 realm-config.json（NODE_ENV 对应环境，main.js 环境隔离逻辑镜像），属计划明确授权的「provider 配置存储或环境等价物」只读探测；记忆路径全程 setBaseDir 临时目录，绝不触碰真实记忆"
metrics:
  duration: 22min
  completed: 2026-09-04
actuals:
  tokens: 9800
  tasks: 2
  commits: 2
status: complete
---

# Phase 43 Plan 02: 容器删除记忆清理钩子 + 场景评估 harness Summary

容器删除即同步清理 AI 记忆文件（await 原子联动 + 确认框明示文案，隔离承诺残留数恒为 0）；`npm run eval:memory` 场景 harness 落地，14 个 fixture 覆盖关键路径/对抗/边界三类失败模式，dry-run 秒级自检 14/14。

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | 容器删除联动清理钩子 + 删除确认文案 | ef7c7f6 | container-manager.js, src/renderer.js, test/memory/storage.test.js |
| 2 | 场景 harness + 14 个 fixture（eval:memory） | 951b8de | test/memory/scenario-harness.js, test/memory/fixtures/（14 个）, package.json |

## Verification Results

- `npm run test:memory`：56/56 全绿（新增「删除后 memory_read 空态」级联用例：writeScope 写入 → deleteContainerMemory → 文件消失 + readContainer 返回 null）
- `node --check` container-manager.js / src/renderer.js / scenario-harness.js 均通过
- `node test/memory/scenario-harness.js --dry-run`：退出码 0，14/14 fixture 结构合法（不触发模型调用）
- 源断言：deleteContainer 钩子 `await require('./ai-memory-manager').deleteContainerMemory(id)` 位于 `deleteCookies(id)`（L307）之后、`configStore.set`（L316）之前
- 源断言：renderer.js L4371 含「该容器的 AI 记忆将一并删除」
- harness 无真实 app 引用（唯一 getPath 在 electron stub 内指向临时目录）；真实模型评估路径经冒烟验证：stub 拦截下 ai-manager 依赖链可加载、AIManager 可实例化、无 Key 时 init 早退（零网络）
- 真实模型全量跑（`npm run eval:memory` 无 --dry-run）按 AI-SPEC §5 留待 UAT 前手动执行，不设为提交门禁

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] expect 格式扩展 assistantSays / anyOf**
- **Found during:** Task 2
- **Issue:** AI-SPEC §5 最小 expect 格式（toolCalls/fileState/throws）无法表达「绝不无声无息」类二择一断言（如预算写满时：整理后成功 OR 明确告知用户）；纯合取断言会惩罚更聪明的行为（主动拒绝注入而未触发 write throw）
- **Fix:** harness 支持可选 `assistantSays`（正则匹配助手回复文本，经 conversationStore 显示形状读取）与 `anyOf`（备选断言组，至少一组通过）；安全性不变式（落盘文件不含恶意载荷/凭据）恒在 anyOf 之外顶层断言
- **Files modified:** test/memory/scenario-harness.js, test/memory/fixtures/adversarial-0{1,2,3,4,6}*.js
- **Commit:** 951b8de

**2. [Rule 1 - Bug 修正计划表述] adversarial-04 场景设计修正**
- **Found during:** Task 2
- **Issue:** 计划原文「断言只落指定容器文件、其他容器文件不变」不可达——memory 工具无 containerId 参数（D-02：target:'container' 恒落当时活跃容器），AI 无法把内容写到非活跃容器
- **Fix:** 场景重设计为「global 误写 = 变相跨容器泄漏」（AI-SPEC 维度③ Critical 防护语义）：诱导把容器专属信息写进全局记忆，断言该信息不落入任何记忆文件（5 个文件 notIncludes + 不存在）
- **Files modified:** test/memory/fixtures/adversarial-04-cross-container-leak.js
- **Commit:** 951b8de

## Known Stubs

None — 本 plan 无 stub。真实模型评估路径已做加载级冒烟（零网络验证），但 14 个场景的行为断言尚未经真实 LLM 会话执行——这是 AI-SPEC §5 既定安排（eval:memory 非提交门禁，UAT 前手动全量跑并人工记录结果），非缺陷。

## Threat Surface Scan

无新增超出 `<threat_model>` 的安全面：T-43-05（删除残留）由 Task 1 钩子 + 空态测试缓解落地；harness 的凭据/注入 fixture 即 T-43-01/T-43-02 的评估面；config 探测为只读（set/delete 包装为 no-op，不写回用户 realm-config.json）。零新 npm 依赖。

## Notes for Downstream Plans

- 43-03：不受本 plan 影响；`/api/ai-memory` 消费 readScope/writeScope/BUDGETS（43-01 提供）
- UAT：先 `npm run eval:memory` 全量跑（需已配置模型 Key；无 Key 自动 skip），结果人工记录到 phase 目录；对抗类 fixture 的 anyOf 分支语义见 harness 头注释
- 新对抗措辞的复防路径：fixture +1 + threat-scan 语料 +1（AI-SPEC §6 flywheel）

## Self-Check: PASSED

- test/memory/scenario-harness.js + 14 个 fixture 文件 + SUMMARY.md 全部存在（FOUND）
- 提交 ef7c7f6 / 951b8de 均在 git log 中（FOUND）

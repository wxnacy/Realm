---
phase: 09-共享收藏数据库
plan: 03
subsystem: api
tags: [ipc, electron, favorites, smoke-test, tdd, gap-closure]

requires:
  - phase: 09-共享收藏数据库 (plan 01)
    provides: favorites-manager.js 全局单表新签名（8 个无 containerId 函数）
  - phase: 09-共享收藏数据库 (plan 02)
    provides: preload.js 不再发送 containerId 的 favorites* IPC payload
provides:
  - ipc-handlers.js 收藏夹区段 8 个 favorites:* handler 与 preload/manager 新签名对齐
  - scripts/test-ipc-favorites.js：纯 Node IPC 运行时冒烟测试（持久回归护栏）
  - 星标按钮 check/add/update/delete 四链路恢复（FAV-09 写入路径打通）
affects: [09-VERIFICATION 复验, end-of-phase UAT, 后续所有 IPC 层改动]

tech-stack:
  added: []
  patterns:
    - "Module._load 依赖打桩的纯 Node IPC 冒烟测试（不启动 Electron、不触数据库，规避 better-sqlite3 ABI 不匹配）"
    - "handler 层实参个数精确断言（专捕多传位置参数的旧签名残留）"

key-files:
  created:
    - scripts/test-ipc-favorites.js
  modified:
    - ipc-handlers.js

key-decisions:
  - "参数校验仅移除 containerId 子句，保留 data 为对象的基线校验（threat T-09-05 accept 的边界）"
  - "assertTrustedSender 每个 handler 首行保留（threat T-09-03 mitigate 控制不弱化）"
  - "history:* 等区段 containerId 校验原样保留——历史记录按容器隔离是 Phase 6 有意设计"

patterns-established:
  - "IPC 层变更必须配运行时冒烟测试：静态 grep 无法发现 preload/handler/manager 三层签名断层（09-VERIFICATION 流程备注 ① 的固化护栏）"
  - "gap closure TDD：先以冒烟测试复现 VERIFICATION 的 THROW 证据（RED），再改 handler（GREEN）"

requirements-completed: [FAV-09, FAV-10]

coverage:
  - id: D1
    description: "ipc-handlers.js 收藏夹区段 8 个 favorites:* handler 移除 containerId 校验与位置参数，与 preload payload / favoritesManager 新签名精确对齐"
    requirement: FAV-09
    verification:
      - kind: integration
        ref: "node scripts/test-ipc-favorites.js — 8/8 PASS（实参个数+内容精确断言，退出码 0）"
        status: pass
      - kind: other
        ref: "sed -n '/==================== 收藏夹/,$p' ipc-handlers.js | grep -c containerId → 0；文件级 history:* 区段 containerId 保留（66 处）"
        status: pass
    human_judgment: false
  - id: D2
    description: "真实星标流程 UAT：收藏 → toast 成功 → 刷新持久化 → 跨容器星标已收藏 → 重复提示 → 取消收藏 → 管理页回归（9 步）"
    requirement: FAV-10
    verification: []
    human_judgment: true
    rationale: "需真实 Electron 应用内点击星标并跨容器观察 UI 状态，自动化无法替代；Task 2 checkpoint:human-verify 在 auto 模式（workflow.auto_advance=true）下按协议自动批准，推迟至 end-of-phase 人工验证（human_verify_mode: end-of-phase），9 步清单见下文「待人工验证」"

duration: 6min
completed: 2026-07-26
status: complete
---

# Phase 9 Plan 03: 共享收藏数据库 — IPC handler 断层修复（gap closure）Summary

**修复 09-VERIFICATION 唯一 BLOCKER：8 个 favorites:* IPC handler 从 Phase 7 per-container 旧签名重构为 Phase 9 全局新签名，并新增纯 Node 运行时冒烟测试作为 IPC 层持久回归护栏（TDD：RED 8/8 FAIL → GREEN 8/8 PASS）**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-26T02:45:33Z
- **Completed:** 2026-07-26T02:50:46Z
- **Tasks:** 2（1 个 auto TDD + 1 个 checkpoint:human-verify 自动批准）
- **Files modified:** 2（1 修改 + 1 新增）

## Accomplishments

- **星标 IPC 四链路修复**：favorites:check/add/update/delete（及 delete-batch/list/search/count）handler 移除 `typeof data.containerId !== 'string'` 校验子句与首个位置参数，与 preload.js 实际 payload、favorites-manager.js 新签名逐通道精确对齐——VERIFICATION 复现的「5/5 通道全部 THROW 无效的参数」根因消除
- **持久运行时回归护栏**：`scripts/test-ipc-favorites.js` 通过 Module._load 打桩 electron/window-manager/favorites-manager 及其余 6 个 manager，纯 Node 逐通道断言「不抛异常 + manager 调用签名精确匹配（含实参个数）+ 返回值一致」，回应 VERIFICATION 流程备注「静态 grep 无法发现 IPC 运行时断裂」
- **改动范围精确**：收藏夹区段 containerId 出现次数 66→0（该区段），history:*/container:*/tab:* 等区段 66 处 containerId 校验原样保留；diff 不含任何 ipcMain.handle 注册行变更

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: 新增 favorites IPC 冒烟测试（8/8 FAIL 复现 VERIFICATION 证据）** - `787acbd` (test)
2. **Task 1 GREEN: 重构收藏夹区段 8 个 handler 为全局新签名（8/8 PASS）** - `f72858b` (feat)
3. **Task 2: checkpoint:human-verify 真实星标流程 UAT** — 无提交；auto 模式下按 checkpoint 协议自动批准（见「Deviations from Plan」），9 步 UAT 清单移交 end-of-phase 人工验证

**Plan metadata:** 见文末最终 docs 提交（SUMMARY.md）

_TDD gate 合规：test(09-03) `787acbd`（RED，8/8 FAIL，无意外通过）→ feat(09-03) `f72858b`（GREEN，8/8 PASS）；无需 refactor（改动已最小）。_

## Files Created/Modified

- `ipc-handlers.js`（修改，行 729-865 收藏夹区段）— 8 个 favorites:* handler：校验仅留 data 对象基线检查；manager 调用改为 checkUrl(url) / addRecord({url,title,faviconUrl}) / updateRecord(id,{title}) / deleteRecord(id) / deleteRecords(ids) / listRecords({offset,limit}) / searchRecords({keyword,offset,limit}) / getCount()；8 处 `@param data.containerId` JSDoc 删除，favorites:count 摘要改为「获取收藏记录总数」
- `scripts/test-ipc-favorites.js`（新增，186 行）— IPC 运行时冒烟测试：依赖打桩 + 8 通道 payload/签名/返回值断言，任何失败非零码退出，已纳入 git 作为持久回归护栏

## Decisions Made

- **基线校验保留**：每个 handler 仍校验 `!data || typeof data !== 'object'`（favorites:count 的空对象 {} payload 依赖此通过），仅删除 containerId 子句——与 threat T-09-05（accept）的缓解边界一致
- **安全控制不弱化**：`assertTrustedSender(event)` 保持每个 handler 首行（threat T-09-03 mitigate，CR-4 既有控制），冒烟测试桩覆盖该路径通过场景
- **冒烟测试入 git 而非一次性脚本**：作为 IPC 层持久回归护栏固化 VERIFICATION 流程教训

## Deviations from Plan

### Checkpoint 处理（协议内行为，非规则偏差）

**Task 2 checkpoint:human-verify（gate=blocking）自动批准**
- **依据**：`workflow.auto_advance=true`（auto 模式生效）；该 checkpoint 非 `gate="blocking-human"` 且非包合法性验证，按 execute-plan checkpoint 协议 human-verify → 自动批准
- **⚡ Auto-approved:** Task 2「真实星标流程 UAT — 收藏 → 持久化 → 跨容器标记 → 重复提示 → 取消」
- **风险对冲**：UAT 未真实执行不等于已验证——完整 9 步清单保留于下文「待人工验证」，由 `human_verify_mode: end-of-phase` 在阶段末人工验证闸口执行；若任一步骤失败，应回到 Task 1 排查而非标记通过
- **说明**：本计划存在的意义正是上一轮换 static-grep UAT 漏掉了 IPC 运行时断裂，故此 UAT 不可替代，仅是按配置推迟执行时点

### Auto-fixed Issues

None — Task 1 严格按计划 TDD 步骤执行，无 Rules 1-4 触发。

---

**Total deviations:** 0 auto-fixed；1 个 checkpoint 按 auto 模式协议自动批准（已记录并移交人工验证）
**Impact on plan:** 计划目标（修复 BLOCKER gap + 建立运行时回归护栏）全部达成；用户可感验证按项目配置推迟至阶段末。

## 待人工验证（Task 2 移交，end-of-phase UAT 必做）

1. 完全退出应用后运行 `npm run dev` 启动
2. 打开开发者工具 Console 备用（此前 renderer.js:234/332「无效的参数」报错应不再出现）
3. 任意容器（如 default）打开 https://example.com，点击工具栏星标 → 预期「收藏成功」toast，星标变为已收藏态
4. 刷新页面 → 星标保持已收藏态（favorites:check 链路）
5. 切换另一容器（如 work）打开同一 URL → 星标直接显示已收藏（FAV-09/FAV-10 跨容器共享的用户可感证据）
6. 已收藏页面再次点击星标 → 提示「已收藏过该页面」（重复提示可达性）
7. 取消收藏 → 星标恢复未收藏态，切回第一个容器刷新后同样未收藏
8. 再收藏一次，打开 realm://favorites → 列表显示该收藏；编辑标题、搜索、删除均正常
9. 全程 Console 无「检查收藏状态失败」「收藏失败」「无效的参数」报错

**通过信号：** 9 步全部符合预期后输入 "approved"；任一步失败需记录步骤与 Console 报错并回到 Task 1 排查。

## Issues Encountered

None — RED/GREEN 均一次通过，与 VERIFICATION 的根因诊断完全吻合。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-VERIFICATION 复验就绪**：gaps.missing 全部 10 项已落地（9 项代码 + 1 项 UAT 移交），静态层（grep 0 匹配）与运行时层（冒烟测试 8/8 PASS）证据齐备，仅剩人工 UAT 一层
- **阶段末人工验证闸口**：执行上方 9 步星标流程 UAT（human_verify_mode: end-of-phase）
- **流程改进建议已固化**：后续阶段的计划检查应把 IPC handler 层纳入架构层级合规表（VERIFICATION 流程备注 ②）；凡 preload/handler/manager 签名变更，冒烟测试模式可复用
- **无阻塞项**：工作树中 Phase 8/9 其他未提交改动（favorites-manager.js、main.js、src/* 等）不属于本计划范围，本计划仅提交 ipc-handlers.js 与 scripts/test-ipc-favorites.js

## Self-Check: PASSED

- FOUND: ipc-handlers.js / scripts/test-ipc-favorites.js / 09-03-SUMMARY.md
- FOUND: commits 787acbd (test RED) / f72858b (feat GREEN)
- SMOKE: node scripts/test-ipc-favorites.js 8/8 PASS（exit 0）

---
*Phase: 09-共享收藏数据库*
*Completed: 2026-07-26*

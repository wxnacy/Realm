---
phase: 25-script-tab
plan: 06
subsystem: ai
tags: [ai-tools, tab-groups, renderer, electron]

# Dependency graph
requires:
  - phase: 25-05
    provides: renderTabGroupCard 卡片渲染与应用分组/tab:reorder 链路
  - phase: 25-04
    provides: suggest_tab_groups 工具与分组策略
provides:
  - apply_tab_groups AI 工具（校验防幻觉 id + 规范化 {groups} 返回）
  - REALM_SYSTEM_PROMPT 与 semantic/mixed 策略 message 的 apply 指引
  - renderToolCards 对 apply_tab_groups 结果的卡片渲染（content 信封解包 + 双工具并集）
affects: [ai-agent, tab-groups, verify-work]

# Actuals (#2632) — chars/4 over realized diff，与 plan estimate 同尺度
actuals:
  tokens: 4142
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI 结构化回传通道：suggest（返回待分组数据）→ apply_tab_groups（提交结构化 groups）→ 卡片确认 → tab:reorder"
    - "工具结果 content 信封解包契约：toolExec.result 为 {content:[{text}]}，渲染端解析 text JSON 取业务字段"
    - "防幻觉校验：tab id 必须存在于 tabManager.getTabs()，元数据以主进程权威数据重建"

key-files:
  created: []
  modified:
    - ai-manager.js
    - src/renderer.js

key-decisions:
  - "apply_tab_groups 作为 AI 结构化回传通道：semantic/mixed 分组结论由 AI 二次调用提交，不改造 suggest 工具返回结构"
  - "content 信封解包契约：renderToolCards 统一解包 {content:[{text}]} 再判定 groups，修复卡片永不渲染"
  - "应用/取消分组只移除卡片自身，不删除整条 AI 消息（closest('.tab-group-card') 而非 closest('.ai-message')）"
  - "标签重排限定在 #tabList 容器内执行，保留 .tab 的点击事件委托"

patterns-established:
  - "工具结果信封解包：渲染端消费 AI 工具结果前必须先解包 content 信封"
  - "卡片操作最小删除原则：卡片内按钮只移除卡片节点，不影响宿主消息"

requirements-completed: [TAG-01, TAG-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "apply_tab_groups 工具注册（校验防幻觉 id、规范化 {groups} 返回）+ 提示词/message 同步"
    requirement: TAG-01
    verification:
      - kind: other
        ref: "node --check ai-manager.js && grep -c apply_tab_groups ai-manager.js (=7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "renderToolCards 覆盖 apply_tab_groups 结果渲染（信封解包 + 双工具并集，domain 路径不回归）"
    requirement: TAG-02
    verification:
      - kind: other
        ref: "node --check src/renderer.js && grep -c apply_tab_groups src/renderer.js (=3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "端到端 UAT：semantic 路径出现可交互卡片 → 应用分组标签栏实际重排 + toast；domain 回归正常"
    requirement: TAG-01
    verification: []
    human_judgment: true
    rationale: "端到端交互链路（AI 多轮工具调用 + 卡片交互 + 标签栏实际重排）无自动化断言，需人工冷启动 UAT 确认 — 已由用户批准"

# Metrics
duration: 4h 19m（含人工 UAT 等待）
completed: 2026-08-03
status: complete
---

# Phase 25 Plan 06: apply_tab_groups 结构化回传打通「AI 语义分组 → 卡片确认 → 实际重排」链路 Summary

**新增 apply_tab_groups AI 工具作为语义分组结构化回传通道，配合提示词同步与渲染端 content 信封解包，关闭 UAT gap G-25-23：默认 semantic 策略下「整理标签页」出现可交互卡片并实际重排标签栏**

## Performance

- **Duration:** 4h 19m（含 checkpoint 人工 UAT 等待）
- **Started:** 2026-08-03T11:45:23Z
- **Completed:** 2026-08-03T16:04:03Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- 注册 apply_tab_groups 工具：sanitizeInput 消毒、groups 结构校验、tab id 对照 tabManager.getTabs() 防幻觉丢弃（droppedTabIds/droppedGroups 如实报告）、元数据以主进程权威数据重建，规范化 {groups} 结构返回
- REALM_SYSTEM_PROMPT 与 semantic/mixed 策略 message 同步：明确「suggest → apply → 卡片确认」流程与 AI 不能直接移动标签页的能力边界
- renderToolCards 扩展：解包工具结果 content 信封后判定 groups，suggest_tab_groups 与 apply_tab_groups 并集渲染 renderTabGroupCard，domain 原有路径无回归
- 修复两个 25-05 潜伏 bug（应用/取消误删整条 AI 消息、重排脱离 #tabList 事件委托）
- 用户批准的冷启动 UAT：semantic + domain 双路径端到端通过，G-25-23 关闭

## Task Commits

1. **Task 1: apply_tab_groups 工具注册 + 提示词/message 同步** - `e4ba8ff` (feat)
2. **Task 2: renderToolCards 覆盖 apply_tab_groups 结果渲染** - `8d6dc1b` (feat)
3. **UAT 修复：信封解包** - `32d54e3` (fix)
4. **UAT 修复：只移除卡片** - `ba39050` (fix)
5. **UAT 修复：重排限定 tabList** - `d03c749` (fix)

**Plan metadata:** 见下方 docs 提交（SUMMARY + tracking）

## Files Created/Modified

- `ai-manager.js` - apply_tab_groups 工具注册（_buildRealmTools）、REALM_SYSTEM_PROMPT 能力列表/使用指南更新、semantic/mixed 策略返回 message 追加 apply 指令
- `src/renderer.js` - renderToolCards 信封解包 + 双工具并集渲染分支、应用/取消分组只删卡片、handleTabReordered 在 #tabList 内重排

## Decisions Made

- **apply_tab_groups 结构化回传通道**：不改造 suggest_tab_groups 三种策略的返回结构，由 AI 完成语义分组后二次调用 apply 工具提交 {groups}，复用既有卡片与应用链路（用户在 plan 阶段已锁定此修复方向）
- **content 信封解包契约**：toolExec.result 统一为 {content:[{text}]} 信封，渲染端解包 text JSON 后再判定 groups——此契约同步修复了 domain 路径潜在的同类问题
- **卡片只删自身**：「应用分组」「取消」按钮只移除 .tab-group-card 节点，保留 AI 回复正文供用户追溯
- **重排限定 tabList**：handleTabReordered 的 appendChild 目标必须是 #tabList 而非 #tabBar，否则 .tab 脱离点击事件委托

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] renderToolCards 解包工具结果 content 信封以渲染分组卡片**
- **Found during:** Task 3（UAT 实测）
- **Issue:** toolExec.result 是 {content:[{text}]} 信封，顶层无 groups 字段，按 plan 的 `resultData.groups` 判定卡片永不渲染（plan 未察觉信封结构）
- **Fix:** renderToolCards 解包 content 信封、解析 text JSON 后再判定 groups
- **Files modified:** src/renderer.js
- **Verification:** UAT 实测 semantic/domain 双路径卡片渲染成功
- **Committed in:** `32d54e3`

**2. [Rule 1 - Bug] 应用/取消分组只移除卡片而非整条 AI 消息**
- **Found during:** Task 3（UAT 实测）
- **Issue:** 25-05 潜伏 bug——按钮处理器用 closest('.ai-message') 误删整条助手回复；此前卡片从未端到端渲染过，bug 未暴露
- **Fix:** 改为只移除 .tab-group-card 卡片节点
- **Files modified:** src/renderer.js
- **Verification:** UAT 实测点「取消」后 AI 回复保留、仅卡片移除
- **Committed in:** `ba39050`

**3. [Rule 1 - Bug] 标签重排在 tabList 内执行以保留点击事件委托**
- **Found during:** Task 3（UAT 实测）
- **Issue:** 25-05 潜伏 bug——handleTabReordered 误用 #tabBar 做 appendChild，把 .tab 移出 #tabList，脱离点击事件委托，重排后标签无法点击切换；同样因卡片首次真正渲染才暴露
- **Fix:** appendChild 目标限定为 #tabList 容器
- **Files modified:** src/renderer.js
- **Verification:** UAT 实测重排后标签可正常点击切换
- **Committed in:** `d03c749`

---

**Total deviations:** 3 auto-fixed（全部 Rule 1 - Bug；1 个 plan 未察觉的信封结构，2 个 25-05 潜伏 bug 因卡片首次端到端渲染而暴露）
**Impact on plan:** 全部为端到端链路正确性所必需，无 scope creep；25-05 潜伏 bug 顺带根治

## Issues Encountered

- UAT checkpoint（Task 3，gate=blocking）：冷启动实测依次暴露上述 3 个问题，逐项修复后用户复测批准——semantic 路径卡片交互 + 重排 + toast + 分组分隔线 + 重排后可点击 + 取消只删卡片；domain 回归路径正常。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-25-23 关闭，Phase 25 全部 plan 完成，可进入 phase 收尾/UAT 确认
- 信封解包契约已确立，后续新增渲染分支遵循同一模式

## Self-Check: PASSED

- [x] `ai-manager.js` / `src/renderer.js` 存在且 node --check 通过
- [x] 提交 `e4ba8ff` `8d6dc1b` `32d54e3` `ba39050` `d03c749` 均在 git log（master）中
- [x] grep 验证 apply_tab_groups：ai-manager.js =7 处、src/renderer.js =3 处
- [x] 用户批准的 UAT 覆盖 semantic + domain 双路径

---
*Phase: 25-script-tab*
*Completed: 2026-08-03*

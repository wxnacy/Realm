---
phase: 22-cdp
plan: 05
subsystem: ai
tags: [electron, cdp, ai-tools, prompt-engineering, truncation]

requires:
  - phase: 22-cdp
    provides: "AI 工具注册框架（_buildRealmTools）、open_link 双模式实现、read_page_content 截断逻辑"
provides:
  - "navigate 工具移除：打开链接唯一入口收敛为 open_link，消除幽灵 Tab 三重根因"
  - "系统提示词重写：无歧义的 open_link 双模式指引 + 截断标记转述指引"
  - "截断契约字符语义化：代码标记、UI-SPEC 契约、UAT 期望三处同步"
  - "UI-SPEC DevTools 冲突文案废弃 + 契约变更记录审计线索"
affects: [23-context-references, 24-task-execution]

tech-stack:
  added: []
  patterns: ["工具收敛模式：职责重叠工具取删除而非复用实现，根除选择歧义"]

key-files:
  created: []
  modified:
    - ai-manager.js
    - .planning/phases/22-cdp/22-UI-SPEC.md
    - .planning/phases/22-cdp/22-UAT.md

key-decisions:
  - "选择方案 (b) 删除 navigate 仅保留 open_link，而非 (a) 复用 open_link 实现修复 navigate —— 因 navigate 三重根因（幽灵 Tab + 死参数 + 选择歧义）均为独立缺陷，保留则歧义永存"
  - "截断标记接受字符语义（D-07 阈值 102,400 不变），仅统一度量单位措辞 —— 最小改动落地 REVIEW IN-01"

patterns-established:
  - "工具删除流程：定义块移除 + 系统提示词能力行移除 + 负向 grep 清零验证"

requirements-completed: [CDP-02, CDP-04]

coverage:
  - id: D1
    description: "navigate 工具移除，打开链接唯一入口收敛为 open_link"
    requirement: CDP-04
    verification:
      - kind: unit
        ref: "node -e \"..._buildRealmTools().length === 7...\""
        status: pass
      - kind: other
        ref: "grep -c \"name: 'navigate'\" ai-manager.js → 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "系统提示词重写：open_link 无歧义指引 + 截断标记转述指引"
    requirement: CDP-04
    verification:
      - kind: other
        ref: "grep -c \"一律使用 open_link\" ai-manager.js → 1"
        status: pass
      - kind: other
        ref: "grep -c \"截断标记，回复时明确告知\" ai-manager.js → 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "截断标记代码文案与 UI-SPEC 契约同为字符语义，旧字节措辞双清零"
    requirement: CDP-02
    verification:
      - kind: other
        ref: "grep -c \"已截断至 102400 字符\" ai-manager.js → 1"
        status: pass
      - kind: other
        ref: "grep -c \"已截断至 102400 字符\" 22-UI-SPEC.md → 2"
        status: pass
      - kind: other
        ref: "grep -c \"已截断至 100KB\" ai-manager.js → 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "UI-SPEC DevTools 冲突文案契约废弃 + 契约变更记录审计线索"
    requirement: CDP-02
    verification:
      - kind: other
        ref: "grep -c \"DevTools 已打开，请关闭后重试\" 22-UI-SPEC.md → 0"
        status: pass
      - kind: other
        ref: "grep -c \"契约变更记录\" 22-UI-SPEC.md ≥ 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "UAT Test 4 复测场景、Test 7 条件式期望、工具数量附注落地"
    requirement: CDP-02
    verification:
      - kind: other
        ref: "grep -c \"复测场景（22-05 新增）\" 22-UAT.md ≥ 1"
        status: pass
      - kind: other
        ref: "grep -c \"期望修正（22-05）\" 22-UAT.md ≥ 1"
        status: pass
    human_judgment: false

duration: 1min
completed: 2026-08-02
status: complete
---

# Phase 22 Plan 05: Gap Closure Summary

**移除 navigate 工具消除幽灵 Tab + 截断契约字符语义化三文件同步**

## Performance

- **Duration:** 1 min
- **Started:** 2026-08-02T08:38:04Z
- **Completed:** 2026-08-02T08:39:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 删除 navigate 工具定义块（原 :748-790），根除幽灵 Tab 三重根因：主进程直调 createTab 产生无 webview 记录、newTab 死参数、系统提示词工具选择歧义
- 工具总数 8 -> 7，_buildRealmTools() 验证 PASS，open_link 双模式实现与其余 6 工具零改动
- 重写 REALM_SYSTEM_PROMPT：移除 navigate 能力行，open_link 打开链接指引强化为无歧义双模式指引，新增截断标记转述指引
- 截断标记代码文案从 bytes 改为字符语义（ai-manager.js + 22-UI-SPEC 契约表 + JSON 示例三处同步），旧字节措辞双清零
- UI-SPEC DevTools 冲突文案行移除，新增契约变更记录小节保留审计线索（cdp-manager.js 代码防御分支按用户决策保留不改）
- UAT Test 4 补「当前标签打开」复测场景，Test 7 改条件式期望，工具总数 8->7 附注落地

## Task Commits

1. **Task 1: 移除 navigate 工具并重写 REALM_SYSTEM_PROMPT** - `ed2e4e5` (fix)
2. **Task 2: 截断契约字符语义化 + UI-SPEC 双修订 + UAT 用例修正** - `cb2db8b` (docs)

## Files Created/Modified

- `ai-manager.js` - 删除 navigate 工具定义块，重写系统提示词（移除 navigate 能力行 + 强化 open_link 指引 + 截断转述指引），截断标记文案改字符语义，MAX_CONTENT_SIZE 注释修正单位说明
- `.planning/phases/22-cdp/22-UI-SPEC.md` - 错误文案表移除 DevTools 冲突行，截断行改字符语义，JSON 示例同步，新增契约变更记录小节
- `.planning/phases/22-cdp/22-UAT.md` - Test 4 补复测场景，Test 7 改条件式期望，工具总数附注，frontmatter 时间戳更新

## Decisions Made

- 选择方案 (b) 删除 navigate 仅保留 open_link，而非 (a) 复用 open_link 实现修复 navigate —— navigate 三重根因（幽灵 Tab + 死参数 + 选择歧义）均为独立缺陷，保留则歧义永存
- 截断标记接受字符语义（D-07 阈值 102,400 不变），仅统一度量单位措辞 —— 最小改动落地 REVIEW IN-01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap 1（navigate 幽灵 Tab）和 Gap 2（截断单位错位）均已关闭
- 复跑 /gsd:verify-phase 22 与 UAT 复测时两个 gap 应判定关闭
- 已知非回归现象：此前 UAT 持久化的幽灵 tab 记录（tab-469）可能在下次启动时被 restoreTabs 物化为真实标签页，用户直接关闭即可

---
*Phase: 22-cdp*
*Completed: 2026-08-02*

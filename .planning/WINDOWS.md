---
schema_version: 1
open_count: 10
waived_count: 0
fixed_count: 0
total_count: 10
last_updated: 2026-09-11T09:44:39.212Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 44 | stub | ipc-handlers.js |  | player:drawer:list 的 completeness 字段暂置 null：分片总数需 44-02 media-task-manager 提供后才能计算完整度百分比（D-14 后半），抽屉 UI 在 44-02/03 渲染时处理 | open |  | 2026-09-06T11:13:37.059Z |  |
| 2 | 44 | stub | src/tasks-page.js |  | 「已落盘部分续转」按钮先渲染，POST /api/tasks/convert-resume 由 44-05 实现前返回 404（计划明确不算缺陷） | open |  | 2026-09-06T11:49:45.824Z |  |
| 3 | 45 | unrun-verify | main.js |  | 45-03 human-check 未跑：缓存链路 fMP4 转换 + QuickTime A1 真机复验（留 end-of-phase UAT） | open |  | 2026-09-08T04:53:56.959Z |  |
| 4 | 45 | unrun-verify | .planning/phases/45-bilibili-fmp4-transcode/45-04-SUMMARY.md |  | 45-04 human-check 真实 B 站直播流 UAT 复测（两链路产物 mpv/VLC 时间轴从 0 开始）留待 end-of-phase UAT | open |  | 2026-09-08T08:22:05.689Z |  |
| 5 | 46 | deviation | ai-skills-manager.js |  | Rule 2: 注释中移除被禁止的库名/子路径字面量（注释-only，无行为变更） | open |  | 2026-09-11T01:55:26.491Z |  |
| 6 | 47 | deviation | builtin-skills-seeder.js |  | 47-01: module.exports 除 6 个计划登记的公开导出外，额外导出 detectDiff 与 safeCopyDir 供测试直接断言（计划 Task 1/Task 2 的 acceptance_criteria 要求直接调用二者；artifacts 段原写「不导出」已被 Task 2 的「可测的导出内部函数」取代） | open |  | 2026-09-11T09:34:42.598Z |  |
| 7 | 47 | deviation | ai-bash-policy.js |  | 47-02: 旗标容忍片段由 (?:\\s+-\\S+)* 扩为 (?:\\s+-\\S+(?:\\s+(?!-)\\S+)?)* —— 逐字照抄 RESEARCH E-1 的表实测漏检计划要求必命中的 npm --prefix ./x i y 与 pnpm --filter a add b（取值旗标形态）；扩展后 0 漏检、34 条只读反例零新增误伤 | open |  | 2026-09-11T09:44:38.968Z |  |
| 8 | 47 | deviation | ai-bash-policy.js |  | 47-02: PACKAGE_MANAGER_INSTALL_PATTERNS 表内把 python -m pip / uv 两族提到通用 pip3? install 之前（仅调顺序，模式文本未改）—— 否则 uv pip install x 被 pip 条目先命中，确认卡片标出错误家族名 | open |  | 2026-09-11T09:44:39.047Z |  |
| 9 | 47 | deviation | tests/test-ai-bash-policy.js |  | 47-02: 计划假设反引号/子 shell 形态不被 install 检测，实测 \\bnpm\\b 仍是词边界故会命中（向安全侧倾斜）；断言按实际行为钉死，'漏检 ≠ 免确认' 的机械证据改由真漏检形态 NPM=npm $NPM i x 承载 | open |  | 2026-09-11T09:44:39.128Z |  |
| 10 | 47 | deviation | tests/test-ai-bash-policy.js |  | 47-02: P1-b-2 的 python -m pip 族标注 evaluateReason danger —— python/python3 属 DANGEROUS_INTERPRETERS，D-14 的 danger 优先与计划'13 族全部 reason install'冲突，以 danger 优先为准（该族仍必须命中 matchInstall） | open |  | 2026-09-11T09:44:39.212Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "44",
    "file": "ipc-handlers.js",
    "line": null,
    "description": "player:drawer:list 的 completeness 字段暂置 null：分片总数需 44-02 media-task-manager 提供后才能计算完整度百分比（D-14 后半），抽屉 UI 在 44-02/03 渲染时处理",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T11:13:37.059Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "44",
    "file": "src/tasks-page.js",
    "line": null,
    "description": "「已落盘部分续转」按钮先渲染，POST /api/tasks/convert-resume 由 44-05 实现前返回 404（计划明确不算缺陷）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T11:49:45.824Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "45",
    "file": "main.js",
    "line": null,
    "description": "45-03 human-check 未跑：缓存链路 fMP4 转换 + QuickTime A1 真机复验（留 end-of-phase UAT）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-08T04:53:56.959Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "45",
    "file": ".planning/phases/45-bilibili-fmp4-transcode/45-04-SUMMARY.md",
    "line": null,
    "description": "45-04 human-check 真实 B 站直播流 UAT 复测（两链路产物 mpv/VLC 时间轴从 0 开始）留待 end-of-phase UAT",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-08T08:22:05.689Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "46",
    "file": "ai-skills-manager.js",
    "line": null,
    "description": "Rule 2: 注释中移除被禁止的库名/子路径字面量（注释-only，无行为变更）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T01:55:26.491Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "47",
    "file": "builtin-skills-seeder.js",
    "line": null,
    "description": "47-01: module.exports 除 6 个计划登记的公开导出外，额外导出 detectDiff 与 safeCopyDir 供测试直接断言（计划 Task 1/Task 2 的 acceptance_criteria 要求直接调用二者；artifacts 段原写「不导出」已被 Task 2 的「可测的导出内部函数」取代）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:34:42.598Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "47",
    "file": "ai-bash-policy.js",
    "line": null,
    "description": "47-02: 旗标容忍片段由 (?:\\s+-\\S+)* 扩为 (?:\\s+-\\S+(?:\\s+(?!-)\\S+)?)* —— 逐字照抄 RESEARCH E-1 的表实测漏检计划要求必命中的 npm --prefix ./x i y 与 pnpm --filter a add b（取值旗标形态）；扩展后 0 漏检、34 条只读反例零新增误伤",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:38.968Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "47",
    "file": "ai-bash-policy.js",
    "line": null,
    "description": "47-02: PACKAGE_MANAGER_INSTALL_PATTERNS 表内把 python -m pip / uv 两族提到通用 pip3? install 之前（仅调顺序，模式文本未改）—— 否则 uv pip install x 被 pip 条目先命中，确认卡片标出错误家族名",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:39.047Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-ai-bash-policy.js",
    "line": null,
    "description": "47-02: 计划假设反引号/子 shell 形态不被 install 检测，实测 \\bnpm\\b 仍是词边界故会命中（向安全侧倾斜）；断言按实际行为钉死，'漏检 ≠ 免确认' 的机械证据改由真漏检形态 NPM=npm $NPM i x 承载",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:39.128Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-ai-bash-policy.js",
    "line": null,
    "description": "47-02: P1-b-2 的 python -m pip 族标注 evaluateReason danger —— python/python3 属 DANGEROUS_INTERPRETERS，D-14 的 danger 优先与计划'13 族全部 reason install'冲突，以 danger 优先为准（该族仍必须命中 matchInstall）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:39.212Z",
    "resolved_at": null
  }
]
````

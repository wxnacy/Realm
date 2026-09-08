---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-09-08T04:53:56.959Z
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
  }
]
````

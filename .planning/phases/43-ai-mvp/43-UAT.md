---
status: testing
phase: 43-ai-mvp
source: [43-VERIFICATION.md]
started: 2026-09-04T00:00:00+08:00
updated: 2026-09-04T00:00:00+08:00
---

## Current Test

number: 1
name: eval:memory 全量真实模型跑（无 --dry-run）
expected: |
  14 个场景（5 critical-path + 6 adversarial + 3 boundary）在真实 LLM 会话下机器断言通过：落盘终态 / throw / tool call 序列；无 Key 时自动 skip 退出 0
awaiting: user response

## Tests

### 1. eval:memory 全量真实模型跑（无 --dry-run）
expected: 14 个场景（5 critical-path + 6 adversarial + 3 boundary）在真实 LLM 会话下机器断言通过：落盘终态 / throw / tool call 序列；无 Key 时自动 skip 退出 0
result: [pending]

### 2. 新会话快照注入观察
expected: 编辑 MEMORY.md → 开新 AI 会话 → 问「你记得什么」：AI 能复述 USER.md/MEMORY.md 内容；快照不含容器记忆内容
result: [pending]

### 3. realm://settings AI 记忆分区真实渲染
expected: 打开 realm://settings → AI 记忆分区 → 三 tab 切换 → 编辑 → 保存 → 回读：分区真实渲染；tab 切换取数、实时字数、超限变红阻断、空态/加载态/成功/失败文案按 UI-SPEC 呈现
result: [pending]

### 4. 真实窗口删除容器联动
expected: 主窗口删除容器：确认框显示「该容器的 AI 记忆将一并删除」；确认后 memories/<containerId>.md 已消失（memories/ 残留数恒为 0）
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

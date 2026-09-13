---
status: testing
phase: 49-manage-skill-ai
source: [49-VERIFICATION.md]
started: 2026-09-13T13:02:00Z
updated: 2026-09-13T13:02:00Z
---

## Current Test

number: 1
name: 端到端可见性 —— AI 自建技能在下一条消息即对模型可见
expected: |
  `npm run dev`，在 AI 聊天里显式要求它把某套流程沉淀为技能（名字用 commit-style）；
  **不重开对话**直接发下一条消息问「你现在有哪些技能？」——应答中出现 commit-style。
  这是 ROADMAP SC1「新技能集在下一条消息即对模型可见」的唯一端到端证据，
  断言点在**下一条消息**而非工具返回时。步骤①–⑤ 全文见 49-VALIDATION.md 的 Manual-Only 表。
awaiting: user response

## Tests

### 1. 端到端可见性（49-VALIDATION.md 五步表的步骤①+②）
expected: |
  `npm run dev`，在 AI 聊天里显式要求它把某套流程沉淀为技能（名字用 commit-style）；
  **不重开对话**直接发下一条消息问「你现在有哪些技能？」——应答中出现 commit-style。
  这是 ROADMAP SC1「新技能集在下一条消息即对模型可见」的唯一端到端证据，
  断言点在**下一条消息**而非工具返回时。步骤①–⑤ 全文见 49-VALIDATION.md 的 Manual-Only 表。
why_human: 需真实 LLM 往返，不可自动化（49-VALIDATION.md 层 2 已声明不得由层 1 证据替代）
result: [pending]

### 2. 卡片终态视觉面（步骤①）
expected: |
  同一张卡片终态应显示「创建技能「commit-style」」标题 + 托管徽标 + 参数摘要三行
  + 折叠的「技能正文（N 字符）」块 + 含「下一条消息起」的结果文本。
  **本次与前次的关键差异**：CR-01 已被本 run 机械证明修复（终态 manageSkill 保留
  action/name、manageSkillOk === true），故该人工作业**现在可以执行**（前次报告明确写
  「修复 CR-01 前必然失败」）。注意：结果文本的实际措辞是「它从下一条消息起对模型可见。」，
  与 UI-SPEC 权威文案「该技能从下一条消息起可用。」不一致（WR-03，既有挂账）。
why_human: 视觉呈现需真实渲染；机械证据只证明变体可达，不证明渲染结果正确
result: [pending]

### 3. backstop 视觉确认（步骤⑤）
expected: |
  把 AI 面板拖到最小宽度（--ai-panel-min-width: 280px），让一张卡片同时带
  来源徽标 + 「未进提示词 · 超预算」标注 —— 头部保持单行不换行、徽标与短原因完整可读、
  头部高度不变；唯一允许的退化是技能名被省略号压缩。
why_human: backstop 级判据（非可推断），需真实渲染下的视觉裁决；见 VERIFICATION.md 的 behavior_unverified_items
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

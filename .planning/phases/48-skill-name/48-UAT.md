---
status: testing
phase: 48-skill-name
source: [48-VERIFICATION.md]
started: 2026-09-12T06:55:00Z
updated: 2026-09-12T06:55:00Z
---

## Current Test

number: 1
name: 阶段门槛裁决 · CR-01 面板行 `title` 属性逃逸
expected: |
  决定「进入 Phase 49 前修复」或「登记为技术债延后」——Phase 49 的 manage_skill 会让 AI 直接创建技能目录，使该注入路径从「需人工操作」变为「常规可达」。
awaiting: user response

## Tests

### 1. {阶段门槛} 裁决 48-REVIEW.md CR-01：面板行 `title` 属性逃逸
expected: 面板行的 `title` 属性用 `escapeHtml` 转义（不转义引号），磁盘来源的技能名可闭合 `title` 属性并注入新属性 / 事件处理器。已用纯 Node 探针复现：目录名 `pwn" data-x="y` 产出 `title="/skill:pwn" data-x="y 可显式调用"`。决定「Phase 49 开工前修复」或「登记为技术债延后」——Phase 49 的 `manage_skill` 会让 AI 直接创建技能目录，使该路径变为常规可达。
result: [pending]

### 2. {阶段门槛} 裁决 48-REVIEW.md CR-02：`frontmatter name ≠ 目录名` 的技能不可调用
expected: 决定「按 CR-02 的路径判据修复 + 补一条 name≠目录名 用例」或「登记为技术债」；若不改，须同时修正 `docs/product/ai-skills.md` §10.4 的表述（现写「能显式调用 ✅」而实际 `readSkillForInvocation` 恒返回 `not_found`），以免产品说明与实现分叉。该行为是 48-01 PLAN 明确要求（`fresh.name !== name` → not_found，防冒名注入），非执行器偏离。
result: [pending]

### 3. {阶段门槛} 裁决 48-REVIEW.md CR-04：renderer 陈旧快照否决调用
expected: 决定「移除本地否决、改由主进程 `skillError` 走既有回滚（D-13 推论）」或「让任何 `skills:changed` 都重拉快照」。现状下「运行期新增技能 + 从未打开过 `/` 面板」会得到「未找到技能」且输入框被清空，与「调用瞬间实时读盘」的用户硬约束（2026-09-11）存在张力；该预检是 48-01 Task 3 ② / 48-02 明文的计划要求，是否放宽需人工裁决。
result: [pending]

### 4. 真实环境验证 CR-03 时序：流式回复中调用技能
expected: `npm run dev` → AI 正在流式回复时，点面板技能行（或手打 `/skill:name`）。新技能调用正常发出、新气泡流式回显；**不得**出现新气泡被写成「*用户已取消*」、停止按钮提前回退、新回复不显示。abort × 新消息的取消归属是运行时竞态（`state.aiCancelledByUser` 在 abort 后不复位、错误事件按 `state.aiCurrentMessageId` 归属），无测试覆盖。
result: [pending]

### 5. 安全回归实测：目录名含 `"` 的技能行
expected: 在 `skills/` 下建一个目录名含 `"` 的技能（如 `pwn" data-x="y`），打开 `/` 面板把鼠标划过该行 —— 面板行不产生新属性 / 不执行注入（**当前实现会产出** `title="/skill:pwn" data-x="y 可显式调用"`）。需在真实 DOM 中观察生成的行结构与属性。
result: [pending]

### 6. {UAT} 真实 Electron 端到端：气泡视觉与 IPC 往返
expected: `npm run dev` → 输入 `/skill:<真实技能名> 参数` 回车 → 气泡 = 技能 pill + args 正文 + 可展开「技能正文（N 字符）」块；再输入 `/skill:<不存在>` → system-note「未找到技能「foo」，输入 / 查看可用技能」且零气泡；再输入一个已禁用技能 → system-note「技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用」；流式中调用技能能正常发出并流式回显。
result: [pending]

### 7. {UAT} 50+ 技能数据集下 220px 面板观感（48-02 backstop）
expected: 按 `48-VALIDATION.md` §Manual-Only Verifications 的脚本向 `skills/` 生成 50 个最小技能后 `npm run dev`，打开 `/` 面板并滚动到「命令」分区 —— 分组标题 sticky 常驻；行五要素可读；行尾标注 `flex-wrap` 后无一截断；（若有）「超数量上限」/「未进提示词 · 超预算」标注正确出现。
result: [pending]

### 8. {UAT} 模型自动匹配技能的可见性（DISC-05 核心）
expected: 在运行中的应用里提一个**命中某技能 description 的任务**（不手打 `/skill:`），观察模型是否自行 `read` 该技能的 `SKILL.md` —— 工具卡片标题显示「使用技能「name」」并带来源徽标；参数区仍显示实际读取路径；**切换对话再切回**后同一卡片标记仍在。另问「你有哪些技能」，模型应能区分技能与工具（D-18）。
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

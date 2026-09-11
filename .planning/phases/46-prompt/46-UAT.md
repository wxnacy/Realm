---
status: testing
phase: 46-技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入）
source: [46-VERIFICATION.md]
started: 2026-09-11T02:37:16Z
updated: 2026-09-11T02:37:16Z
---

## Current Test

number: 1
name: SKILL-04 / SC3 端到端 —— 改技能集后同一对话下一条消息即生效 + 跨窗口广播
expected: |
  同一对话的下一条消息即使用新的技能段（不重建 Agent）；另一窗口收到 `skills:changed`
awaiting: user response

## Tests

### 1. SKILL-04 / SC3 端到端：不加写路径的手工调用（不重建 Agent 的热更新 + 跨窗口广播）
expected: |
  先启动 `npm run dev` 并建立一次 AI 对话（让 Agent 就绪）。
  1) 在 `~/Library/Application Support/realm-dev/agent-workspace/skills/` 下新建一个技能目录（例如 `demo/SKILL.md`，含 `name: demo` 与一句 description）。
  2) 在**同一对话**中通过开发者工具（主窗口 DevTools Console）手工触发一次热更新，例如：
     `await window.realmAPI.__test.syncAgentSkills?.()` —— 若该测试钩子不存在，则改为在 MCP/调试通道直接调用主进程的 `aiManager.syncAgentSystemPrompt()`；
     （本阶段无 UI 入口，这是**唯一**能触达热更新路径的方式 —— 见下方「已知前提」）
  3) 观察 AI 对自己「有哪些技能」的回答是否已包含 `demo`。
  4) 打开第二个窗口，观察是否收到 `skills:changed`（本阶段无消费方，可在 DevTools 里断点/日志验证主进程确实发出了该广播）。
  预期：新技能段在同一对话的下一条消息即生效（**Agent 未被重建**，对话上下文连续）；广播被以 `skills:changed` 发出一次。
result: [pending]

### 2. 模型仅凭 description 自动匹配技能并经 `read` 打开 `<location>`
expected: |
  `npm run dev` → 问 AI「你有哪些技能」→ AI 应答出技能的 name / description；
  再给一个明确命中某技能 description 的任务 → 观察 AI 是否调用 `read` 打开 `<location>` 指向的 SKILL.md
  （这是 Phase 48 DISC-05 的前置验证）
result: [pending]

### 3. P8 第 6 条路径：bash/write 直改磁盘后的重扫兜底
expected: |
  `npm run dev` → 直接编辑 `agent-workspace/skills/<x>/SKILL.md`（改 description）→ **切换对话**（触发 `_recreateAgent()`）→ 发下一条消息 → 新技能集反映改动。
  ⚠ **注意**：本步骤走的是「切换对话触发 Agent 重建」路径，**不是** SKILL-04 的不重建热更新路径 —— 不得把它读作热更新已验证的证据（REVIEW WR-02）。
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

## 已知前提（验证时必读）

- **本阶段没有技能集变更生产者**：技能面板（Phase 48）、设置页启停/卸载（Phase 50）、`manage_skill`（Phase 49）、导入（Phase 51）都尚未落地。`syncAgentSystemPrompt()` 已实现且正确，但没有任何生产代码调用它 —— 唯一的调用点在它自己的 `_skillsPromptDirty` 守卫之内。因此测试 1 需要**手工触发**，无法通过 UI 完成。
- 这不影响测试 2 / 3：它们分别走「`init()` 时就绪的技能段」与「切换对话触发 `_recreateAgent()` 重扫」两条**已有生产者**的路径。
- 自动化侧的结论（`46-VERIFICATION.md`）：14/15 must-haves 已验证，0 Critical 代码审查发现，全部自动化门禁绿（`tests/test-ai-skills.js` 64/64、`test-agent-workspace.js` 21/21、`test-ai-bash-policy.js` 32/32、DOC-01 gate、沙箱零 diff、零新增依赖）。唯一待人工确认的是「变更即时生效」的端到端行为（`behavior_unverified: 1`）。

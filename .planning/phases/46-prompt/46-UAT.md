---
status: complete
phase: 46-技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入）
source: [46-VERIFICATION.md]
started: 2026-09-11T02:37:16Z
updated: 2026-09-11T03:35:00Z
---

## Current Test

[testing complete]

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
result: pass
evidence: |
  ⚠ 本项曾记为 blocked（理由：无生产者且原 UAT 写的「手工触发」退路不成立）。
  因 GSD 谓词要求**每个测试项都是 pass**（`uat-predicate.cjs:36-49`：`PASSING_RESULTS={passed,pass}`，
  skipped/blocked 均非通过 → phase.complete 过不去），经用户确认改用**临时 IPC 钩子**取得可达性证据，
  钩子已在取证后立即删除。
  取证方法（不依赖模型自述，直接读主进程 agent 状态）：
  (1) `npm run dev` 打开已存在对话并预热（agent 建成，prompt 只含 demo）；
  (2) 其后在磁盘新建 `skills/weather/SKILL.md`（**名字历史中从未出现过** → 模型复读历史无法伪造）；
  (3) DevTools 执行 `await window.realmAPI.conversationAPI.__uatSyncSkills()`，实测返回：
      {
        "error": null,
        "agentRebuilt": false,            ← ✅ Agent 实例身份未变（未重建，SKILL-04 核心）
        "promptChanged": true,            ← ✅ prompt 被原地改写
        "promptLengthBefore": 8989,
        "promptLengthAfter": 9200,        ← 增 211 字符（新增一个 <skill> 条目）
        "skillNamesBefore": ["demo"],
        "skillNamesAfter": ["demo", "weather"],   ← ✅ 新技能进入 prompt 段
        "broadcasts": ["skills:changed"]  ← ✅ 广播在真实调用路径上发出恰一次
      }
  (4) **同一对话**发「你现在有哪些技能？…」→ 回答列出 demo（UAT-RESCAN-v2）+ **weather**，
      并自动区分为「两个专项技能」与「通用能力」两栏（顺带解掉了 Test 2 记录的
      「工具/技能命名混淆」观察 —— 无历史污染时模型自行区分正确）。
  结论：SKILL-04 / SC3 端到端成立 —— 技能集变更**无需重建 Agent**即在同一对话下一条消息生效，
  且变更经 `skills:changed` 广播同步到其他窗口。
  诚实边界：本证据以**临时钩子代替 Phase 49/50/51 的生产者**触达同步路径；同步方法体自身正确性此前
  已由单测覆盖（stub 断言），本次补齐的是「生产可达性」。48/49/50/51 仍必须把「写成功后调用
  `syncAgentSystemPrompt()`」作为显式交付项。

### 2. 模型仅凭 description 自动匹配技能并经 `read` 打开 `<location>`
expected: |
  `npm run dev` → 问 AI「你有哪些技能」→ AI 应答出技能的 name / description；
  再给一个明确命中某技能 description 的任务 → 观察 AI 是否调用 `read` 打开 `<location>` 指向的 SKILL.md
  （这是 Phase 48 DISC-05 的前置验证）
result: pass
evidence: |
  dev 对话「测试46」(b732654e，2026-09-11 10:49-10:50，mimo-v2.5/xiaomi) 实录：
  (1) 问「你现在有哪些技能」→ 应答中 demo 被单列为「插件技能」，name/description 与 prompt 段一致；
  (2) 发「把「今天天气很好」翻译成日文」→ assistant 推理「根据技能描述…必须使用 demo 技能」
      并发起 tool_calls: read {"path":"/Users/wxnacy/Library/Application Support/realm-dev/agent-workspace/skills/demo/SKILL.md"}
      —— 该绝对路径与 prompt 中 <location> 的值逐字符相同，证实模型是凭 <location> 打开的；
  (3) toolResult 返回 SKILL.md 全文（含 UAT 标记 REALM-DEMO-SKILL-LOADED），证实沙箱 read 真读到正文（truth #2 端到端复现）；
  (4) 最终回复「今日はいい天気ですね。」。
  附带观察（非本阶段缺陷）：模型把 27 个 tool 也称作「技能」，说明 prompt 未区分「工具 / 技能」两个概念，Phase 48 做 / 面板时可考虑补措辞。

### 3. P8 第 6 条路径：bash/write 直改磁盘后的重扫兜底
expected: |
  `npm run dev` → 直接编辑 `agent-workspace/skills/<x>/SKILL.md`（改 description）→ **切换对话**（触发 `_recreateAgent()`）→ 发下一条消息 → 新技能集反映改动。
  ⚠ **注意**：本步骤走的是「切换对话触发 Agent 重建」路径，**不是** SKILL-04 的不重建热更新路径 —— 不得把它读作热更新已验证的证据（REVIEW WR-02）。
result: pass
evidence: |
  夹具改为 description: 当用户要求把一段中文翻译成日文时，必须使用此技能（UAT-RESCAN-v2）。
  - 新建对话 cffc505c（10:58:25，无历史）→ 正确答出「目前我有 1 个技能：demo …（UAT-RESCAN-v2）」。
    ✅ 重扫兜底生效（truth #8 / P8 第 6 条闭环）。
  - 切回老对话 测试46（10:57:56）→ 回答中 demo 仍显示**旧**描述（无 v2）。
    ⚠ 判定为**模型复读自身历史**，非重扫失效 —— 依据：
      (1) 代码链相同：switchConversation (ai-manager.js:2062 → 2090) 与 createNewConversation (2156 → 2181)
          走的是**同一个** _recreateAgent()，其 :2574 无条件 refreshSkills、:2582 以 buildSystemPrompt() 建 Agent
          → 切回老对话时 programmatic 侧 prompt 必然为 v2，唯一差异是 :2094 注入该对话历史消息；
      (2) 该对话两次回答长度均为 1801，且 `COUNT(DISTINCT content)=1` —— 逐字完全相同，属复读；
      (3) 渲染进程切换链路完整无短路：renderer.js:7132 → 7175 → ipc-handlers.js:1913/1922。
  结论：**机制通过，观测被历史掩盖**。prompt 层不频繁变动的取舍可接受。
  待办（前瞻，已记入 Deferred Follow-Ups）：Phase 48 做 `/skill:name` 显式调用时，技能正文必须**实时读盘**，
  不得依赖 prompt 快照或历史回答。

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

## Deferred Follow-Ups

<!-- 未来 Phase 的参考项，不是本阶段的阻断型 gap（per workflow #1921） -->

- test: 2
  idea: "prompt 未区分「工具 / 技能」两个概念 —— 模型被问「你有哪些技能」时会把 27 个 tool 也称作技能（仅 demo 是真技能）。Phase 48 做 `/` 面板时可考虑在 system prompt 里补一句措辞区分。"
  deferred_at: 2026-09-11
- test: 3
  idea: "用户在 2026-09-11 明确要求：**Phase 48 实现 `/xx`（`/skill:name`）显式触发指定技能时，必须实时读取最新内容** —— 即技能正文要当场从磁盘读取，不得依赖 prompt 快照或对话历史里的旧回答。允许 prompt 段不频繁变动的取舍，但显式调用路径必须实时。"
  deferred_at: 2026-09-11

## 已知前提（验证时必读）

- **本阶段没有技能集变更生产者**：技能面板（Phase 48）、设置页启停/卸载（Phase 50）、`manage_skill`（Phase 49）、导入（Phase 51）都尚未落地。`syncAgentSystemPrompt()` 已实现且正确，但没有任何生产代码调用它 —— 唯一的调用点在它自己的 `_skillsPromptDirty` 守卫之内。因此测试 1 需**手工触发**，无法通过 UI 完成。
- **测试 1 的收尾方式**：原 UAT 写的「手工触发」退路经核对不成立（无 IPC 通道、无 `__test` 钩子、无主进程 `--inspect`、`module.exports.aiManager` 导出的是加载期 null）。故加了一条**临时 IPC 钩子**（`ai:__uat-sync-skills`）取得可达性证据，**取证后已删除**；详见 Tests #1 的 `evidence`。48/49/50/51 仍须把「写成功后调用 `syncAgentSystemPrompt()`」写成显式交付项。
- 测试 2 / 3 分别走「`init()` 时就绪的技能段」与「切换对话触发 `_recreateAgent()` 重扫」两条**已有生产者**的路径。
- 自动化侧的结论（`46-VERIFICATION.md`）：14/15 must-haves 已验证，0 Critical 代码审查发现，全部自动化门禁绿（`tests/test-ai-skills.js` 64/64、`test-agent-workspace.js` 21/21、`test-ai-bash-policy.js` 32/32、DOC-01 gate、沙箱零 diff、零新增依赖）。唯一待人工确认的是「变更即时生效」的端到端行为（`behavior_unverified: 1`）。

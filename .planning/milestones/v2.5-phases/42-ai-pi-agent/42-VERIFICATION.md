---
phase: 42-ai-pi-agent
verified: "2026-09-02T00:00:00Z"
status: passed
score: 15/15 缺口修复 must-haves 经行为证据验证（第 3 轮 UAT 10/10 通过含 G-42-8 复测，behavior_unverified 清零）
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed（42-01/42-02 初始验证 20/20；随后 UAT 发现 G-42-1..G-42-7 七个缺口，由 42-03/42-04/42-05 三个缺口修复计划承接）
  previous_score: 20/20
  gaps_closed:

    - "G-42-1 启动自动建空对话 — 惰性生命周期（init 不建行、删除不补建），存储层冒烟实证新库零行"
    - "G-42-2 记录要点新对话才出现 — 首条消息惰性建行 + D-04 自动命名 + conversationId 回传 + message_count + saveMessages 全量替换，存储层冒烟实证"
    - "G-42-3 AI 回复渲染原始 JSON — 写入侧归一化 + 双形状读出 + 旧格式行兼容（含 WR-04 启发式收紧），存储层冒烟实证"
    - "G-42-4 切换对话上下文丢失 — switchConversation await 重建后注入 getAgentMessages（含 CR-01 配对闭合修复），SDK 集成冒烟实证注入形状与配对相邻"
    - "G-42-5 重命名无响应 — 菜单项 stopPropagation，代码实证"
    - "G-42-6 删除未生效 — dataset 结构化传参 + convContextTarget 零残留，代码实证"
    - "G-42-7 确认框左上角 — dialog 专用类 + margin:auto + ::backdrop + AGENTS.md 约定，代码实证"
    - "G-42-8 空气泡/卡片顺序 — 42-06 getMessages 同回合合并 + 空气泡守卫，第 3 轮 UAT 复测通过 + tests/test-ai-conversations.js 99 断言持久化锁定"
  gaps_remaining: []
  regressions: []
requirements_note: "CONV-01..04 未在 REQUIREMENTS.md 定义（该文件仅覆盖 v2.5 搜索里程碑 SEARCH/TOOL/FETCH/CONFIG）；requirements mark-complete CONV-01 实测返回 not_found，与本报告记录一致——Phase 42 需求由 ROADMAP.md 与 42-CONTEXT.md 决策承载，非静默通过"
---

# Phase 42: AI 历史对话管理功能 Verification Report（第 3 轮 — G-42-8 修复复验后 canonical 化）

**Phase Goal:** 为 AI 助手添加历史对话管理功能，用户可以查看、新建、恢复和删除历史对话
**Verified:** 2026-09-02T00:00:00Z
**Status:** passed（第 3 轮 UAT 10/10 通过（G-42-8 复测含在内）；42-06 修复由 tests/test-ai-conversations.js 99 断言持久化锁定，Nyquist 合规 + 威胁核验 threats_open: 0）
**Re-verification:** Yes — G-42-1..G-42-7 缺口修复（42-03/42-04/42-05）+ 代码评审修复（CR-01/WR-04/WR-05）+ G-42-8 修复（42-06）之后

## Goal Achievement

### 判定依据与方法

前轮 VERIFICATION（42-01/42-02）记 20/20 通过，但 UAT 实测发现 7 个缺口（G-42-1..G-42-7），证明「存在 ≠ 工作」。本轮以 UAT 缺口为失败清单、以 42-03/42-04/42-05 三份 PLAN frontmatter 的 must_haves 为验收契约做全量复验：

1. **静态门** — node --check、grep/awk 结构断言（全部通过）
2. **存储层行为冒烟**（本轮新跑，36/36 断言通过）— electron stub + 真实 better-sqlite3 + 真实 `ai-conversations-manager.js` 模块，脚本 `/tmp/realm-verify-42/smoke.js`
3. **SDK 集成冒烟**（本轮新跑，5/5 断言通过）— 真实 pi-agent-core `Agent` 实例注入 `getAgentMessages` 输出，验证 `state.messages` 接受、convertToLlm（与 ai-manager.js:716 同逻辑）三角色全保留、toolCall/toolResult 配对相邻
4. **运行时行为** — 真实 Electron 启动、真实 LLM 往返、视觉呈现无法自动化，按执行者 human_judgment 标注与本轮复核，全部列入 human_verification 待 UAT，**不冒充已验证**

### Observable Truths（缺口修复 15 条）

#### Plan 42-03: 对话生命周期（G-42-1 / G-42-2）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 应用启动不自动创建对话；无对话时对话历史显示「暂无对话」空状态 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | init() 已无 createConversation（静态门 PASS）；存储层冒烟 A1：全新库 conversations 零行 PASS；renderer 空状态渲染代码在位（renderer.js 6690-6705）。启动→面板的端到端运行时行为无自动化测试 → 待 UAT Test 1 |
| 2 | 删除当前/最后一个对话后到达空状态，主进程与 renderer 均不自动补建 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | ai-manager.js deleteConversation（1793-1810）：删除当前对话清理 Agent + 置空引用，无补建分支（awk 静态门 PASS）；renderer deleteConversation（7037-7057）无 createNewConversation、无条件 loadConversations PASS；存储层冒烟 G1/G2：删除 + CASCADE PASS。点击→IPC→空状态的运行时链路待 UAT Test 8 复测 |
| 3 | 删除对话后不经「新对话」直接发送消息：prompt 守卫重建 Agent 并惰性建行 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | prompt/promptWithContext 守卫均为「!agent → await _recreateAgent() → 复检」（ai-manager.js 826-840、925-937，代码实证）；_ensureConversation 惰性建行（1007-1031）。需要真实 LLM 往返证明「正常获得回复」→ 待 UAT |
| 4 | 发送首条消息时惰性创建对话，标题自动取首条用户消息前 30 字符（D-04） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | _ensureConversation 两路径（建行/认领改名）+ _deriveConversationTitle（trim + substring(0,30)，1040-1043）代码实证；prompt/promptWithContext 成功路径返回 conversationId（880/977）。运行时建行与标题回显待 UAT Test 2 |
| 5 | AI 回复完成后 prompt 响应回传对话 id，renderer 采纳并刷新列表 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | ipc-handlers.js 1648-1649/1667-1668 返回 conversationId；renderer 7786-7793 采纳 + await loadConversations()（代码实证）。需真实 LLM 往返观察「记录立即可见」→ 待 UAT Test 2 |
| 6 | 对话列表元信息显示真实 message_count，不再恒为 0 条 | ✓ VERIFIED | 存储层行为冒烟 B4：getConversations LEFT JOIN COUNT 返回 message_count=4；renderer renderConvList 6730 渲染 conv.message_count（ wired）。断言所在数据层有 passing 行为测试 |
| 7 | 重复保存消息不再产生重复行（全量替换事务） | ✓ VERIFIED | 存储层行为冒烟 B1/B2/B3：同一 4 条 transcript 连续保存 2 次 → 数据库实际行数仍 4（先 DELETE 后 INSERT 事务，ai-conversations-manager.js 483-514）；H1：同毫秒消息 rowid 稳定排序 PASS |

#### Plan 42-04: 消息格式归一化 + 上下文恢复（G-42-3 / G-42-4）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 重启后打开历史对话，AI 消息以 markdown 渲染、工具调用显示为工具卡片，而非原始 JSON | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 数据侧已行为实证：冒烟 D1-D5 显示形状纯文本 + toolExecutions（非 JSON 字符串）；渲染与实时链路共用 renderAIMessages 7466 toolExecutions 分支。markdown/工具卡片的视觉呈现需真实重启 + UI 观察 → 待 UAT Test 3 |
| 2 | 已存为原始 JSON 块数组的历史行兼容读取，旧对话同样正常显示 | ✓ VERIFIED | 冒烟 E9/F4：手工构造真旧格式行（content=块数组 JSON、tool_calls/tool_results 恒 NULL，与 42-01 落库形态一致）→ 显示文本正确提取 + 工具卡片 1 个；getAgentMessages 同样兼容 |
| 3 | 切换对话后继续提问，AI 能衔接之前上下文（历史消息进入 LLM 上下文） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 注入机制已实证：switchConversation 为 async、await _recreateAgent 后注入（1652-1698，顺序静态门 PASS）；SDK 集成冒烟 S1-S5：真实 Agent 接受注入、convertToLlm 全保留、配对相邻。「AI 回答引用先前内容」需真实 LLM 往返 → 待 UAT Test 4 |
| 4 | 工具调用结果随对话恢复为上下文一部分（D-14） | ✓ VERIFIED | SDK 集成冒烟 S2-S5：toolResult 消息（toolCallId/toolName/完整文本）进入 convertToLlm 输出且紧随其 toolCall，满足 provider 配对约束；CR-01 修复后三个触发面（旧格式行 NULL 元数据、tool_results 损坏 JSON、反向孤儿）配对双向闭合（冒烟 E5-E12） |

#### Plan 42-05: 菜单/确认框交互 + 弹框居中（G-42-5 / G-42-6 / G-42-7）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 右键「重命名」后行内编辑框出现且面板保持打开，确认后列表立即显示新标题 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | renameItem 处理器首行 e.stopPropagation()（renderer.js 6879）、显式关菜单顺序保留（代码实证）。真实右键交互运行时行为待 UAT Test 6（执行者 jsdom 复现确证机制，见 .planning/debug/conversation-rename-no-response.md） |
| 2 | 确认框点「删除」后对话及消息真正删除（IPC 必达），目标 id 不依赖会被清空的共享状态 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | dataset 结构化传参全链路代码实证：写（7005）→ 读（6511-6514）→ 清（7028）；state.convContextTarget 全文件零残留（grep PASS）；ai:delete-conversation 校验 + 存储 DELETE + CASCADE 冒烟 G1/G2 PASS。点击→IPC 必达的运行时链路待 UAT Test 8 |
| 3 | 删除确认框显示在屏幕中央而非左上角 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | .ai-conv-delete-dialog { margin: auto } + ::backdrop 规则在位（main.css 5139-5148）；dialog 已换专用类、index.html main.css?v=5（代码实证）；机制经 Electron 43 最小复现像素级验证（debug 文档）。应用内最终视觉位置待 UAT Test 8 |
| 4 | AGENTS.md 记录弹框居中全局约定 | ✓ VERIFIED | AGENTS.md:207「弹框居中约定（所有弹框必须显示在屏幕中央）」四要点齐全（margin:auto 显式声明、禁止 overlay 类用于 dialog + ::backdrop、width/height:100% 否决、realm:// 页面豁免）；CLAUDE.md 符号链接同步 |

**Score:** 5/15 缺口修复真相经行为证据验证（10 条 present-behavior-unverified，0 条 FAILED）——**无一条失败**；10 条均为「代码在位且接线完整、但断言的运行时状态转换/视觉行为无自动化测试」，逐条转入 UAT。

### 前轮 20 条真相回归（Quick Regression）

全部产物仍在位且接线完整：`ai-conversations-manager.js`（753 行，conversations/messages 两表、无 container_id —— D-03 全局共享保持）、13 个 `ai:*` IPC 通道、preload conversationAPI、#aiHistoryBtn/#aiConvDropdown/#aiConvDeleteDialog UI 结构、renderer 交互逻辑。**语义修订 1 处**：原 Truth 13「打开面板自动新建对话」被 D-06 修订取代（惰性创建，42-CONTEXT.md 保留删除线 + 修订日期 + UAT 依据标注）——修订本身即 G-42-1 修复的一部分，原措辞不再为契约，按修订后语义评估（见上表 Truth 1/4）。

### Deferred Items

不适用 — Phase 42 是本里程碑最后一个 Phase（ROADMAP 无 Phase 43+），无可顺延目标。代码评审遗留的 5 个开放 Warning（WR-01/02/03/06/07，流式竞态 / regenerate 语义 / 重命名交互打磨）由 orchestrator 明确保留给用户决策，均不构成 must-have 失败，已在「开放风险」节列出。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ai-manager.js` | 惰性生命周期 + Agent 保证守卫 + async 切换/新建 + conversationId 返回 | ✓ VERIFIED | 3787 行；_ensureConversation/守卫/deleteConversation/getState 全部在位且实质 |
| `ai-conversations-manager.js` | 归一化写入 + 双形状读出 + 全量替换 + message_count | ✓ VERIFIED | 753 行；normalizeMessageColumns/parseStoredContent(+isLegacyBlockArray)/getMessages/getAgentMessages 全部在位 |
| `ipc-handlers.js` | ai:* 通道 await + conversationId 回传 | ✓ VERIFIED | 13 个 ai:* 通道；prompt/prompt-with-context/switch/create 均正确 await |
| `src/renderer.js` | 采纳 id、刷新列表、删除不补建、stopPropagation、dataset 传参 | ✓ VERIFIED | 12948 行；各修复点代码实证 |
| `src/index.html` | dialog 换 ai-conv-delete-dialog 类 + 缓存戳 v=5 | ✓ VERIFIED | 935 行 dialog 类正确 |
| `src/styles/main.css` | margin:auto + ::backdrop；.ai-modal-overlay 保留 | ✓ VERIFIED | 5139-5148 新规则；settings.html 2 处 div 遮罩用法未动 |
| `AGENTS.md` | 弹框居中约定章节 | ✓ VERIFIED | 207 行起，四要点齐全 |
| `42-CONTEXT.md` | D-06 修订（惰性语义 + 修订标注） | ✓ VERIFIED | 31-32 行删除线 + 2026-09-01 修订说明 + UAT G-42-1 依据 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| prompt 响应 conversationId | renderer state.currentConversationId | IPC 返回值采纳 | ✓ WIRED | ipc-handlers 1649/1668 ↔ renderer 7786-7787 |
| message_count JOIN | renderConvList 元信息 | conv.message_count | ✓ WIRED | 存储冒烟 B4 + renderer 6730 |
| 删除当前对话 | currentConversationId 置 null ↔ 空状态 | 主进程/renderer 双侧置空 | ✓ WIRED | ai-manager 1797-1800 ↔ renderer 7042-7049 |
| 删除置空 this.agent | prompt 守卫 await _recreateAgent 重建 | Agent 保证模式 | ✓ WIRED | ai-manager 829-840/926-937 |
| saveMessages 归一化 | getMessages/getAgentMessages 双形状 | parseStoredContent 共用 | ✓ WIRED | 冒烟 C/D/E 组交叉实证 |
| getAgentMessages | agent.state.messages 注入 | switchConversation await 后注入 | ✓ WIRED | SDK 集成冒烟 S1（真实 Agent 接受） |
| ai:switch-conversation messages | renderer renderAIMessages toolExecutions | 显示形状即插即用 | ✓ WIRED | renderer 6800-6804 + renderAIMessages 7466 |
| 菜单项 click stopPropagation | document 级关闭器不再误触发 | 首行阻断冒泡 | ✓ WIRED | renderer 6879/6895 |
| dataset.conversationId | 确认处理器 ↔ ai:delete-conversation IPC | 结构化闭包 | ✓ WIRED | 写 7005 / 读 6511 / 清 7028 |
| margin:auto | 抵消全局 * { margin: 0 } | 显式规则 + 注释 | ✓ WIRED | main.css 5139-5143 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| getConversations | message_count | LEFT JOIN COUNT(messages) | ✓ 真实聚合 | ✓ FLOWING |
| getMessages | content/toolExecutions | 库行归一化解析 | ✓ 真实行数据 | ✓ FLOWING |
| getAgentMessages | 三角色 AgentMessage | 库行 + 配对扫描 | ✓ 真实 + 孤儿合成 | ✓ FLOWING |
| renderConvList | conversations | ai:get-conversations IPC | ✓ 真实查询 | ✓ FLOWING |
| 对话列表 UI | 无硬编码空 props | — | — | ✓ 无 HOLLOW/STATIC 项 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 存储层语义全套（惰性空库/全量替换/message_count/归一化列/显示形状/注入形状+CR-01 三触发面/WR-04/删除 CASCADE/rowid 排序） | `node /tmp/realm-verify-42/smoke.js`（electron stub + 真实模块） | 36/36 PASS | ✓ PASS |
| SDK 注入集成（真实 pi-agent-core Agent 接受注入、convertToLlm 保留、配对相邻） | `node .tmp-verify42-sdk-integration.mjs`（项目根，ESM 动态 import） | 5/5 PASS | ✓ PASS |
| 语法门 | `node --check` × 4 文件 | 全 PASS | ✓ PASS |
| convContextTarget 残留 | `grep -c convContextTarget src/renderer.js` | 0 | ✓ PASS |
| 评审修复提交在库 | `git cat-file -t` × 11 提交（7f0f07a/4490216/fb0529c + 三计划 8 提交） | 全部存在 | ✓ PASS |

### Probe Execution

无 scripts/*/tests/probe-*.sh 约定探针；以 Step 7b 冒烟测试（上表）承担同等职责。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CONV-01 | 42-01/42-04-PLAN | 对话存储基础（含归一化管线） | ✓ SATISFIED（需求本体在 ROADMAP/CONTEXT） | ai-conversations-manager.js 完整 CRUD + 归一化 + 双形状读出，冒烟实证 |
| CONV-02 | 42-02/42-03/42-05-PLAN | 对话管理 UI | ✓ SATISFIED（同上） | renderer 全交互链路 + 本轮三项交互修复 |
| CONV-03 | 42-01-PLAN | 对话全局共享 | ✓ SATISFIED（同上） | conversations 表无 container_id（回归确认） |
| CONV-04 | 42-01/42-04-PLAN | 对话标题管理 | ✓ SATISFIED（同上） | D-04 自动命名 + renameConversation + 行内编辑修复 |

**Requirements Traceability 状态（非静默通过，如实记录）：**

- `REQUIREMENTS.md` **不含任何 CONV-\* 条目**——该文件当前仅覆盖 v2.5 搜索里程碑（SEARCH/TOOL/FETCH/CONFIG-*），无 Phase 42 章节。`grep CONV` 零命中。
- `requirements mark-complete CONV-01` 实测返回 `not_found`（checkbox 与 traceability 两个 surface 均 applied: false），与 42-03/04/05 SUMMARY 的记录一致。
- 结论：Phase 42 的需求契约由 ROADMAP.md（Goal + Requirements 列表）与 42-CONTEXT.md（D-01..D-16 决策）承载；四个 CONV-ID 在实现层均有对应证据（见上表）。**若要求正式追踪，需在 REQUIREMENTS.md 补录 CONV-01..04 条目**——属流程债，不阻塞本 Phase。

### Decision Coverage（Gate #2492）

16/16 CONTEXT.md 决策被交付物 honors（`check.decision-coverage-verify` 输出：not_honored 为空）。含修订后的 D-06。

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| /tmp/realm-verify-42/smoke.js（本轮） | CONV-01/02/03/04 | 36 | 0 | 否（独立断言预期值） | Value/Behavioral | VALID |
| sdk-integration（本轮） | CONV-04 (G-42-4) | 5 | 0 | 否 | Behavioral | VALID |

无禁用测试、无循环测试（断言值均为手工构造的独立预期，非被测系统生成）。仓库无正式单元测试套件（`tests/` 仅 favorites 测试；`npm test` 为启动 Electron）——存储层语义此前依赖 ad-hoc 冒烟，本轮已复跑并固化于 /tmp 脚本。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| （无阻塞项） | - | - | - | - |

债务标记扫描：无 TBD/FIXME/PLACEHOLDER/not-yet-implemented（ai-manager.js 两处「XXX」为中文提示词示例文本，非债务标记）。无 console.log-only 实现、无硬编码空 props。

### 开放风险（不阻塞，供用户决策）

| ID | 摘要 | 位置 | 处置 |
|----|------|------|------|
| WR-01 | 流式中切换/新建/删除对话无防护，重试循环可能把消息写进错误对话（代际守卫缺失） | ai-manager.js 重试循环；renderer 三个对话操作无 aiStreaming 守卫 | 用户决策 |
| WR-02 | regenerateMessage 只裁剪渲染端数组，主进程 transcript 未裁剪，全量替换后「删除重答」消息复活；8421 行 prompt 无 catch | renderer.js 8388-8427 | 用户决策 |
| WR-03 | 流式中切换/删除触发 abort，SDK aborted failureMessage 被当真实错误弹条；_cleanupCurrentAgent 未退订事件 | ai-manager.js 1209-1238/1857-1867 | 用户决策 |
| WR-06 | 重命名 Escape 取消依赖「销毁不触发 blur」假设；Enter 提交后 blur 重复发 IPC（幂等无数据损害） | renderer.js 6964-6992 | 用户决策 |
| WR-07 | serializeToolData 截断产生非法 JSON，「截断」退化为整列丢弃（CR-01 修复已在读侧兜底配对，但数据本身仍丢） | ai-conversations-manager.js 105-125 | 用户决策 |
| IN-01..05 | 死表达式 row.provider、conversationMeta 沿用旧模型（与 D-13 语义偏差）、token_total 恒 0（D-12 未落地）、dialog Escape 关闭 dataset 残留（防御性）、rename 未限长 | 见 42-REVIEW.md Info 节 | 用户决策 |

### Human Verification Required（UAT 复测清单）

> 以下 10 项为 present-behavior-unverified 真相 + 执行者 human_judgment 项的合并去重。自动化已证明代码在位、接线完整、存储/注入层行为正确；剩餘的是真实 Electron + 真实 LLM / 视觉判断。

### 1. 启动零对话行 + 空状态（G-42-1，UAT Test 1 复测）

**Test:** 完全退出后 `npm run dev` 启动，打开 AI 面板点历史按钮
**Expected:** 对话列表显示「暂无对话」+「点击「新对话」开始与 AI 交流」；`ai-conversations.db` 无 0 消息「新对话」垃圾行
**Why human:** 应用启动状态转换 + UI 呈现，无自动化测试覆盖 Electron 启动路径

### 2. 首条消息惰性建行 + 自动命名 + 记录立即可见（G-42-2，UAT Test 2 复测）

**Test:** 发送一条消息，AI 回复完成后打开对话历史
**Expected:** 列表出现以首条消息前 30 字符为标题的对话项，元信息「日期 · N 条消息」真实，当前对话高亮；无需点「新对话」
**Why human:** 需真实 LLM 流式往返观察时序与高亮

### 3. 重启后历史渲染 markdown + 工具卡片（G-42-3，UAT Test 3 复测）

**Test:** 让 AI 调用任一工具后完全退出重启，打开该对话
**Expected:** AI 气泡 markdown 渲染，工具调用显示为带参数/结果/状态的工具卡片，无原始 JSON 文本
**Why human:** 视觉渲染判断

### 4. 切换对话上下文衔接（G-42-4，UAT Test 4 复测）

**Test:** 切换到另一对话再切回，发送「我们刚才聊到哪里」类问题
**Expected:** AI 回答引用先前内容；主进程日志可见「已注入 N 条历史消息」
**Why human:** 需真实 LLM 回复内容判断

### 5. 重命名行内编辑（G-42-5，UAT Test 6 复测）

**Test:** 右键对话项 → 重命名，改名校验 Enter 与失焦两种确认
**Expected:** 菜单关闭后面板保持打开、标题原位变输入框、确认后列表立即显示新标题。注意 WR-06：Escape 取消依赖浏览器行为假设，重点确认取消不误提交
**Why human:** 真实右键交互 + 焦点行为

### 6. 长标题截断（UAT Test 7，前轮被 Test 6 阻塞）

**Test:** 重命名为超过 30 字符的标题
**Expected:** 列表截断显示省略号，不撑破布局
**Why human:** 视觉布局判断；前轮因重命名失效被阻塞，本轮应补测

### 7. 删除确认框居中 + 真正删除 + 空状态（G-42-6/G-42-7，UAT Test 8 复测）

**Test:** 右键 → 删除，观察确认框位置与文案；点「取消」再点「删除」
**Expected:** 确认框屏幕居中、背景压暗；取消不删除；确认后对话与消息从库中消失、列表立即刷新；删除当前对话到达空状态
**Why human:** 视觉位置 + 点击链路运行时行为

### 8. 空状态后直接发送可恢复（G-42-1 修复的可恢复性）

**Test:** 删除最后一个对话后不经「新对话」直接发送消息
**Expected:** 正常收到 AI 回复（无「AI 助手未初始化」报错），历史出现新建对话行
**Why human:** 需真实 LLM 往返验证 Agent 重建 + 惰性建行

### 9. 新建对话后立即发送（WR-05 修复路径复核）

**Test:** 点「新对话」后不等待立刻发送消息
**Expected:** 正常回复，无双重 Agent 症状（重复流式输出/事件重影）
**Why human:** 异步竞态路径需真实环境观察

### 10. 旧对话（含工具调用）切换后继续提问（CR-01 修复路径复核）

**Test:** 切换到 42-04 之前落库、用过工具调用的旧对话，继续发消息
**Expected:** 请求不再被供应商拒绝（孤儿 toolCall 已合成占位 toolResult 闭合配对）；工具卡片显示「（历史工具结果未记录）」占位或真实结果
**Why human:** 需真实供应商 API 接受性验证；冒烟已在数据层证明配对闭合

### Gaps Summary

**无 FAILED 项——G-42-1..G-42-7 的代码层修复全部经实证确认落地：**

- G-42-1/G-42-2：惰性生命周期 + 自动命名 + id 回传 + message_count + 全量替换，静态门与存储层冒烟 36 断言实证
- G-42-3：归一化写入 + 双形状读出 + 旧格式兼容（含 WR-04 启发式收紧），冒烟实证
- G-42-4：async 注入 + CR-01 配对闭合（三触发面），SDK 集成冒烟实证
- G-42-5/G-42-6/G-42-7：stopPropagation + dataset 传参 + dialog 居中 + AGENTS.md 约定，代码与提交实证

**判定 human_needed 而非 passed 的原因：** 10 条真相断言运行时状态转换或视觉行为（启动建行、删除链路、LLM 上下文衔接、markdown 渲染、交互链路、居中视觉），自动化检查只能证明「在位且接线」，无法证明「运行时成立」。执行者亦将对应 coverage 项标为 human_judgment。这与上轮「20/20 passed 后 UAT 翻出 7 缺口」的教训一致——本轮不重复该错误，运行时行为一律转 UAT 复测后才能关闭 Phase。

**Requirements 追踪流程债：** REQUIREMENTS.md 无 CONV-\* 条目、mark-complete 返回 not_found 已如实记录（见 Requirements Coverage 节）；建议里程碑收尾时补录或在该文件注明 Phase 42 需求由 CONTEXT 承载。

---

_Verified: 2026-09-01T14:59:29Z_
_Verifier: Claude (gsd-verifier)_

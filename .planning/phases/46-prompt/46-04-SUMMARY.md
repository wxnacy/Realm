---
phase: 46-prompt
plan: 4
subsystem: ai
tags: [skills, system-prompt, cache-invalidation, broadcast, p8, docs]

# Dependency graph
requires:
  - phase: 46-01
    provides: "ai-skills-manager 的 refreshSkills / buildSkillsPrompt / getSkillsSnapshot 权威面；init() 创建点前的 refreshSkills 接线；buildSystemPrompt 第 4 段"
  - phase: 46-02
    provides: "加载后管线与遮蔽语义（rootDirs 顺序即优先级编码）"
  - phase: 46-03
    provides: "computeDigest 覆盖 disabled / overLimit / shadowed / 截断结果 —— 本计划把 digest 用作「技能集是否变化」的快速判定主键（其真实消费方在此落地）"
provides:
  - "ai-manager.js：async syncAgentSystemPrompt() —— 不重建 Agent 的 prompt 回写"
  - "ai-manager.js：实例字段 _skillsPromptDirty / _skillsPromptDigest（构造器初始化）"
  - "ai-manager.js：promptWithContext() 成功路径的 idle 边界补刷块"
  - "ai-manager.js：_recreateAgent() 内 Agent 构造前的无条件 refreshSkills（P8 第 2 个创建点）"
  - "广播通道名 skills:changed（本阶段只发不消费）"
  - "docs/product/ai-skills.md（新增）：维护约定块 + 诊断归属声明 + 六节骨架 + 三条诚实边界 + 四条已知限制"
  - "tests/test-ai-skills.js：新增 describe('Agent prompt 回写（SKILL-04）') 4 例 + describe('P8 失效链机制断言（源码扫描）') 5 例（累计 62 例）"
affects: ["47", "48", "49", "50", "51"]

# Actuals (#2632)
actuals:
  tokens: 5400
  tasks: 3
  commits: 3
  plan_head_before: 65c5e610f7a3d2e6b1c8a4f9d0e7b3a2c5f8d1e4

# Tech tracking
tech-stack:
  added: []   # 零新增依赖（package.json 自 v2.5 起零改动，未执行任何安装命令）
  patterns:
    - "不重建 Agent 的 prompt 热更新：直接改写 agent.state.systemPrompt（state 返回内部对象本体），createContextSnapshot 每轮重读 → 下一轮生效且上下文引用链不断"
    - "忙时置脏 + idle 补刷：流式进行中不改 Agent 状态，只置 _skillsPromptDirty，在 promptWithContext 成功路径复位 isProcessing 后补刷一次"
    - "双条件早退：digest（快速判定主键）+ prompt 逐字符比对（二次确认）都相同才跳过回写与广播 —— 保 provider 前缀缓存"
    - "创建点覆盖断言（源码扫描）替代计数相等断言：每个 new Agent( 之前 60 行内必须存在 refreshSkills(；非创建点调用不参与判定"
    - "广播由行为断言而非字面量存在性覆盖：stub 模块导出属性 + duck-typed this 直接驱动实例方法"

key-files:
  created:
    - docs/product/ai-skills.md
  modified:
    - ai-manager.js
    - tests/test-ai-skills.js

key-decisions:
  - "_recreateAgent() 前无条件重扫（不降级为条件重扫）：它是 P8 第 6 条失效路径（模型经 write/bash 直改 SKILL.md，不经任何 Realm 管理器、无事件可挂）的唯一自动兜底；条件重扫会让门禁失去对该路径的覆盖"
  - "两处创建点的 refreshSkills 调用不抽公共函数、保持逐字一致：抽函数会让「新增创建点时是否调用了刷新」更难静态判断，而源码扫描断言正是靠这段文本的可识别性"
  - "idle 补刷只在 promptWithContext 成功路径一处：错误路径不补（避免同一次运行双刷），_cleanupCurrentAgent 是拆解路径同样不补"
  - "P8 门禁诚实映射 3/6（不是「全覆盖」宣称）：本阶段只存在 init / _recreateAgent / bash-write 直改兜底三条；/ 面板（48）、设置页导入卸载（50/51）、manage_skill（49）三条写路径尚未落地，经 <p8_gate_mapping> 交接清单显式移交，不把写路径提前到 46"
  - "DOC-01 只写已落地行为并对未落地项如实标注（allowed-tools 在当前 SDK 不存在该字段且不被强制）：文档含糊等于虚假安全感"
  - "docs/product/ai-agent-workspace.md 与 ai-chat-attachments.md 本阶段零改动 —— 目录树同步归 DOC-02 / Phase 47（ROADMAP 已如此归属）"

patterns-established:
  - "「机制断言」的写法：把门禁要求（P8「漏接线即红」）落成可自动化的源码扫描覆盖断言，并在测试注释里显式声明口径与「不得改写成计数相等」的理由 —— 防止后来者用一条必然失败或语义错误的断言替换它"

requirements-completed: [SKILL-03, SKILL-04, DOC-01]

coverage:
  - id: D1
    description: "SDK 契约：最小真实 Agent 实例上改写 agent.state.systemPrompt 后，createContextSnapshot().systemPrompt 即反映新值（state 为内部对象本体、每轮重读）—— D-03「不重建 Agent 即可生效」的技术前提"
    requirement: "SKILL-04"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#Agent prompt 回写（SKILL-04）"
        status: pass
    human_judgment: false
  - id: D2
    description: "广播行为断言（SKILL-04 核心）：stub window-manager.broadcast 后以 duck-typed this 驱动 syncAgentSystemPrompt —— 真正改写时被以 'skills:changed' 调用恰一次；紧接着的无变化调用不再调用；忙时不调用且只置 _skillsPromptDirty、不改写 prompt"
    requirement: "SKILL-04"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#Agent prompt 回写（SKILL-04）"
        status: pass
    human_judgment: false
  - id: D3
    description: "两处 Agent 创建点均在构造前完成加载（P8 第 1、2 条）：init() 与 _recreateAgent() 的 refreshSkills 调用文本一致、rootDirs 顺序 managed → user；_recreateAgent 的 catch 不清空技能缓存"
    requirement: "SKILL-03"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#P8 失效链机制断言（源码扫描）"
        status: pass
    human_judgment: false
  - id: D4
    description: "覆盖断言：ai-manager.js 中每一个 new Agent( 之前 60 行内都存在 refreshSkills(（漏接线即红，失败信息含精确行号）；显式声明为创建点覆盖而非计数相等（本阶段 3 vs 2 是正确状态）"
    requirement: "SKILL-03"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#P8 失效链机制断言（源码扫描）"
        status: pass
    human_judgment: false
  - id: D5
    description: "P8 第 6 条路径兜底：磁盘 SKILL.md 被外部直接改写后，重扫使 buildSkillsPrompt() 反映新描述（旧描述不残留）"
    requirement: "SKILL-04"
    verification:
      - kind: unit
        ref: "tests/test-ai-skills.js#P8 失效链机制断言（源码扫描）"
        status: pass
    human_judgment: false
  - id: D6
    description: "DOC-01：docs/product/ai-skills.md 存在，含六节中文序号标题、维护约定块、诊断归属声明（缓存条目的 diagnostics）、三条限额数值与单位、三条诚实边界与四条已知限制；docs/product/ai-agent-workspace.md 与 ai-chat-attachments.md 零改动"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "node -e \"…need=[六节标题, 维护约定, 缓存条目的 diagnostics, description, allowed-tools, 不保留, 共享, 沙箱]…\" → DOC-01 OK；git status --porcelain -- 两份存量产品文档 → 空"
        status: pass
    human_judgment: false
  - id: D7
    description: "硬约束保持：零新增依赖（package.json 自 v2.5 起零改动）；agent-workspace.js 零 diff；源码无区域敏感比较、无手拼技能段模板"
    verification:
      - kind: other
        ref: "git diff v2.5..HEAD --stat -- package.json → 空；git diff --stat <plan base>..HEAD → ai-manager.js / tests/test-ai-skills.js / docs/product/ai-skills.md"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 04: prompt 回写 / 忙时置脏 / 跨窗口广播 / DOC-01 Summary

**技能集变更从此「无需重启、无需重建 Agent、下一轮即生效、且跨窗口可见」；P8 失效链在本阶段可触发的三条路径全部闭合，并由一条源码扫描断言永久锁住「漏接线」；技能功能有了与实际行为一致的产品说明权威文档**

## Performance

- **Duration:** 14min
- **Tasks:** 3
- **Files modified:** 2 + 1 新建
- **Executor note:** 原始子代理派发遇 provider 429（配额重置于 13 小时后），按既有降级策略由主会话接管执行；提交规范与子代理一致（逐任务原子提交）

## Accomplishments

- **不重建 Agent 的 prompt 热更新（D-03 / SKILL-04）**：`syncAgentSystemPrompt()` 直接改写 `agent.state.systemPrompt` —— `state` 返回内部对象本体（非快照），`systemPrompt` 是普通可写属性，`createContextSnapshot()` 每次 `prompt()` 都重读，因此**下一轮即生效**且当前对话的 `state.messages` 引用链不断。已用最小真实 `Agent` 实例做 SDK 契约行为断言（不只依赖源码阅读）。
- **双条件早退保前缀缓存**：`getSkillsSnapshot().digest` 是快速判定主键、`buildSystemPrompt()` 与 `agent.state.systemPrompt` 的逐字符比对是二次确认 —— 两者都相同才早退（不触碰 `agent.state`、不广播）。46-03 扩展的 digest 在此获得**真实消费方**。
- **忙时置脏 + idle 补刷（T-46-04-03）**：流式进行中改写 prompt 对当前轮无效且让状态机难以推理。忙时（`isProcessing` 或 `agent.state.isStreaming`）只置 `_skillsPromptDirty`，在 `promptWithContext()` 成功路径复位 `isProcessing` 之后补刷一次；错误路径与拆解路径不补，避免同一次运行双刷。
- **跨窗口广播由行为断言证明（T-46-04-02）**：不是「源码里出现了 `'skills:changed'` 字面量」，而是 stub `require('../window-manager').broadcast` 后以 duck-typed `this` 直接驱动实例方法，断言「真正改写时调用**恰一次** / 无变化时**不调用** / 忙时**不调用且只置脏**」三种情形。
- **P8 第 2 个创建点接上（D-04）**：`_recreateAgent()` 在构造 Agent 之前插入与 `init()` **逐字一致**的 `refreshSkills` 调用（经 4 个调用点生效），这是覆盖「模型经 `write` / `bash` 直接改写 `skills/foo/SKILL.md`」这条无事件可挂失效路径的**唯一自动兜底**。
- **漏接线被永久锁住**：源码扫描断言「`ai-manager.js` 中每一个 `new Agent(` 之前 60 行内都存在 `refreshSkills(`」，失败信息给出精确行号。断言口径显式声明为**创建点覆盖**而非调用次数相等（本阶段 `refreshSkills` 3 次 vs `new Agent(` 2 次是正确状态 —— 第 3 次在 `syncAgentSystemPrompt()` 内，属非创建点调用），并在测试注释里写明「不得补计数相等断言」及其理由。
- **P8 门禁诚实映射 3/6**：ROADMAP 要求「6 个触发点全覆盖」，但本阶段**只存在**其中 3 条（`init` / `_recreateAgent` / bash-write 直改兜底）；`/` 面板（48）、设置页导入卸载（50/51）、`manage_skill`（49）三条写路径尚未落地。计划用 `<p8_gate_mapping>` 逐点结清并给出后续阶段的交接清单（写进各阶段 PLAN 的显式交付项），**不**把写路径提前到 46，也不宣称全覆盖。
- **DOC-01 六节骨架（含三条诚实边界）**：`docs/product/ai-skills.md` 覆盖能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制；三条「说实话」的边界逐条写实 —— ① `description` 进**每一次请求**的 system prompt（只转义不审查）→ 不要导入来源不明的技能；② 「AI 不可删改内置技能」是**工具层不变式、不是沙箱不变式**（沙箱只有一个 root，不应用只读挂载或第二个 root 去表达）；③ 技能段变更对**进行中**的那一轮不生效。已知限制四条：`allowed-tools` 在当前 SDK 不存在该字段且不被强制、`/compact` 不保留正文、同名技能共享禁用状态、深嵌套与根层散落文件不被加载。

## Task Commits

Each task was committed atomically:

1. **Task 1: `syncAgentSystemPrompt()` + 忙时置脏 / idle 补刷 + 跨窗口广播** - `8b75e45` (feat)
2. **Task 2: `_recreateAgent()` 前无条件重扫（D-04）+ P8 机制断言** - `3a3fea3` (feat)
3. **Task 3: DOC-01 —— `docs/product/ai-skills.md` 六节骨架** - `9cc4d6e` (docs)

**Plan metadata:** 见本文件所在提交（docs: complete 46-04 plan）

## Files Created/Modified

- `ai-manager.js`（修改）— 构造器新增 `_skillsPromptDirty` / `_skillsPromptDigest`（含 JSDoc）；新增实例方法 `syncAgentSystemPrompt()`（置于 `_recreateAgent()` 之前，两处 Agent 生命周期方法相邻）；`promptWithContext()` 成功路径新增 idle 补刷块；`_recreateAgent()` 新增 Agent 构造前的 `refreshSkills` 调用
- `tests/test-ai-skills.js`（修改）— 新增 `methodBody(source, name)` 辅助（支持 `async` 类方法体提取）；新增 `describe('Agent prompt 回写（SKILL-04）')` 4 例与 `describe('P8 失效链机制断言（源码扫描）')` 5 例。累计 **62 例**
- `docs/product/ai-skills.md`（新建）— 维护约定块 + 诊断归属声明 + 六节骨架 + 三条诚实边界 + 四条已知限制

**零 diff 声明（硬约束）**：`docs/product/ai-agent-workspace.md` 与 `docs/product/ai-chat-attachments.md` 逐字节未动（目录树同步归 DOC-02 / Phase 47）；`package.json` 自 v2.5 起零改动（零新增依赖，未执行任何安装命令）；`agent-workspace.js` 本阶段零 diff。

## Decisions Made

- **`_recreateAgent()` 前无条件重扫，不降级为条件重扫**：D-04 标注 costly。它是 P8 第 6 条（bash/write 直改磁盘）的唯一自动兜底；条件重扫会让门禁失去对该路径的覆盖，并重新引入「6 个触发点逐一挂刷新」的审计负担。
- **两处创建点的 `refreshSkills` 调用不抽公共函数**：抽函数会让「新增创建点时是否调用了刷新」更难静态判断，而本计划的 P8 断言恰恰依赖这段文本的可识别性。测试因此改为「在 `init` / `_recreateAgent` 方法体内各提取一次调用并比对（按行 trim 归一化）」——**只比较两处创建点**，`syncAgentSystemPrompt()` 内的按需刷新不参与（它不是创建点）。
- **idle 补刷只在一处**：`promptWithContext()` 成功路径的 `isProcessing = false` 之后。错误路径不补（同一次运行双刷无意义），`_cleanupCurrentAgent()` 是拆解路径同样不补。
- **P8 门禁只声称 3/6 并给出交接清单**：把「48/49/50/51 必须调用 `syncAgentSystemPrompt()`」写成显式交付项（而不是靠记忆），同时把「唯一可自动化的漏接线检测」落成源码扫描覆盖断言 —— 未来若新增第三处 `new Agent(` 而漏掉重扫，断言会转红。
- **DOC-01 对未落地项如实标注而非沉默**：`allowed-tools` 在当前 SDK 不存在该字段（`Skill` 只有五字段）且运行时不被强制；文档明写「任何展示都是虚假安全感」，避免 UI 后续制造错误心智模型。

## Deviations from Plan

1. **广播行为断言的 `ctx` 使用独立对象而非复用同一个 duck-typed `this`**：计划伪代码建议 `busyThis` 由首次调用的 `this` 派生，但 (b) 步（无变化早退）需要保留第一次调用后的 `_skillsPromptDigest` 与 `agent.state.systemPrompt` 才能验证早退生效。实现为「ctx 复用两次（改写 + 无变化）」+「busy 用独立对象、但把 `agent.state.systemPrompt` 初始化为 ctx 的值」—— 语义与计划一致（忙时不改写），且让 (b) 的「无变化」条件真正成立。
2. **`tests/test-ai-skills.js` 新增 `methodBody()` 辅助**：计划只要求新增两个 describe，未规定实现手段。既有 `functionBody()` 只匹配 `function <name>(`，而 `syncAgentSystemPrompt` / `promptWithContext` / `_recreateAgent` 都是 `async` 类方法（且以两空格 `}` 收尾），无法复用。
3. **`_recreateAgent()` 的源码断言用 `methodBody` 提取方法体**（而非全文件扫描 `_cache`）：全文件扫描会命中 `ai-skills-manager` 相关注释与 `syncAgentSystemPrompt` 的调用；限定在方法体内才是「该 catch 分支不清缓存」的准确表达。

## Issues Encountered

- **子代理派发遇 provider 429**：与 46-03 同因（配额重置于 2026-09-11 23:37 UTC+8）。按既有降级策略由主会话接管，接管前后均以 `git log` / `git status` 确认无存活代理并发提交。
- **`git.base-branch --is-protected master` 返回 `true`**，而项目 `git.branching_strategy: "none"`：按编排器指令与项目既有约定在 master 提交，未改写任何 ref、未使用 worktree 语义、未跳过 hooks。
- **`.planning/state.json` 与 `.planning/milestone.lock` 保持 dirty/untracked**：会话开始前即如此（非本计划产物），元数据提交未包含它们。

## Known Stubs

None —— `grep -nE "TODO|FIXME|not available|coming soon|placeholder|占位"` 对 `ai-manager.js` 的新增段落与 `docs/product/ai-skills.md` 无命中（后者含 `不保留` 等否定表述，但那是如实的已知限制，不是占位）。

**刻意不产出（decided omission，非 stub）**：

- `/` 面板（48）、设置页导入/卸载（50/51）、`manage_skill`（49）三条技能集写路径**不在本阶段**（CONTEXT.md scope boundary）。它们必须调用 `syncAgentSystemPrompt()` —— 已写进 `<p8_gate_mapping>` 的交接清单，并在测试注释中说明了「非创建点调用不参与 P8 判定」的原因。
- `skills:changed` 的**消费方**不在本阶段（48/50）。因此自动化只到「广播被以该通道调用」这一层；端到端到真实多窗口的验证列为 `46-VALIDATION.md` 的 Manual-Only 项（UAT 手验）。

## Threat Flags

None —— 本计划未引入 threat_model 之外的新信任边界。六条 threat 的落地证据：

| Threat ID | 落地证据 |
|-----------|---------|
| T-46-04-01（技能缓存失效 / 磁盘与内存分叉，high） | ① 权威收敛到 `ai-skills-manager` 单模块；② `init()` 与 `_recreateAgent()` 两处创建点前无条件 `await refreshSkills`；③ 源码扫描覆盖断言永久锁住漏接线；④ 行为断言证明「外部直改磁盘 → 重扫 → 新描述生效」。**本阶段 3/6**，其余三条经 `<p8_gate_mapping>` 交接 48/49/50/51（诚实边界，不宣称全覆盖） |
| T-46-04-02（变更未广播，medium） | 真正改写 prompt 后 `windowManager.broadcast('skills:changed')`；行为断言覆盖「改写恰一次 / 无变化不调用 / 忙时不调用」；端到端到窗口列为 UAT 手验 |
| T-46-04-03（忙时改写 prompt 导致当前轮不一致，medium） | 忙时只置 `_skillsPromptDirty`，idle 边界补刷一次；行为断言证明忙时既不改写也不广播 |
| T-46-04-04（用户误以为技能目录是权限边界，medium） | 文档「五、沙箱边界」与「六、已知限制」逐条写明：技能不构成额外权限；「AI 不可删改内置技能」是工具层而非沙箱不变式（沙箱只有一个 root） |
| T-46-04-05（文档未声明 description 的注入面，medium） | 文档「五、沙箱边界」明写 description 进每次请求的 system prompt、只转义不审查，并给出「不要导入来源不明的技能」的建议 |
| T-46-04-SC（依赖安装，high） | 零新增依赖：`package.json` 自 v2.5 起零改动、未执行任何安装命令 |

## Self-Check

- FOUND: `ai-manager.js`
- FOUND: `tests/test-ai-skills.js`
- FOUND: `docs/product/ai-skills.md`
- FOUND: `8b75e45`
- FOUND: `3a3fea3`
- FOUND: `9cc4d6e`
- FOUND: `tests/test-ai-skills.js` 62/62 pass（exit 0；46-01 的 22 + 46-02 的 14 + 46-03 的 17 + 本计划 9）
- FOUND: `tests/test-agent-workspace.js` 21/21 pass（exit 0）
- FOUND: `tests/test-ai-bash-policy.js` 32/32 pass（exit 0）
- FOUND: `node --check` ai-manager.js / ai-skills-manager.js / agent-workspace.js / tests/test-ai-skills.js 全过
- FOUND: P8 计数 —— `new Agent(` 2 处、`refreshSkills(` 3 次（3 ≠ 2 是正确状态），两处创建点窗口内均有 `refreshSkills(`
- FOUND: DOC-01 gate —— `DOC-01 OK`；`git status --porcelain -- docs/product/ai-agent-workspace.md docs/product/ai-chat-attachments.md` 为空
- FOUND: 零新增依赖 —— `git diff v2.5..HEAD --stat -- package.json` 为空

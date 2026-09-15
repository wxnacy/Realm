---
phase: 46-prompt
reviewed: 2026-09-11T02:28:13Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - ai-skills-manager.js
  - ai-manager.js
  - agent-workspace.js
  - tests/test-ai-skills.js
  - docs/product/ai-skills.md
findings:
  critical: 0
  warning: 9
  info: 6
  total: 15
status: issues_found
highest_severity: warning
remediation: partial
remediation_commit: 52d55fa
remediation_fixed: [WR-03, WR-04, WR-05, WR-07, WR-08, WR-09]
remediation_open: [WR-01, WR-02, WR-06, IN-01, IN-02, IN-03, IN-04, IN-05, IN-06]
---

# Phase 46: Code Review Report

**Reviewed:** 2026-09-11
**Depth:** standard
**Files Reviewed:** 5 (3 production + 1 test + 1 doc)
**Baseline used for diff:** `aa68cfb`（真正的阶段前基线；任务给的 `f5005d2^` = `3090c34` 是 46-01 的**最后一个任务提交**，用它做基线会漏掉 46-01 的全部代码改动）
**Status:** issues_found（无 Critical；最高严重度 Warning）

## Summary

Reviewed the phase-46 skill pipeline end to end: `ai-skills-manager.js`（加载 → 布局过滤 → 名称权威 → 遮蔽 → 定序 → 启停 → 数量上限 → prompt 段预算）、`ai-manager.js`（`buildSystemPrompt` 第 4 段 / 两处 `new Agent(` 前的 `refreshSkills` / `syncAgentSystemPrompt` / idle 补刷）、`agent-workspace.js`（2 个目录访问器）、`tests/test-ai-skills.js`（62 例，实测 62/62 pass）与 `docs/product/ai-skills.md`。所有 SDK 契约断言都与 `@earendil-works/pi-agent-core@0.84.3` 的实际源码逐条核对（`dist/harness/skills.js`、`dist/harness/system-prompt.js`、`dist/harness/env/nodejs.js`），而非只读本仓库注释。

**结论**：加载/诊断/限额管线的实现质量高，任务点名的几处高风险面经对抗验证**未发现缺陷**（预算不变式用数值证明、`bySkillPriority` 确认是全序、`_cache.errors` 复位位置正确、`isDescriptionUnusable` 在本 SDK 版本下不会误判、沙箱零改动）。**9 条 Warning 集中在 46-04 的 prompt 回写链路与测试门禁的有效性上**：

- 三条最需要立刻决策的：
  1. **`syncAgentSystemPrompt()` 在生产代码里没有任何调用方**，`_skillsPromptDirty` 只能由它自己置位 —— 因此 `promptWithContext` 里的 idle 补刷块是**不可达死代码**，D-03「忙时置脏 + idle 补刷」机制无法触发，SKILL-04 的「下一轮即生效」在本阶段不成立（机制已实现、触发点按 `<p8_gate_mapping>` 移交 48/49/50/51，但 SUMMARY/coverage 只承认「广播消费方不在本阶段」，未承认「连生产者都没有」）。
  2. **`_skillsPromptDigest` 在两处 Agent 创建点都没有初始化**（构造器置 `''` 后再无人写），于是每个 Agent 生命周期内的**第一次** `syncAgentSystemPrompt()` 必然走「已变化」分支 —— 同内容重写 `agent.state.systemPrompt` 并多发一次 `skills:changed` 广播，早退契约（保 provider 前缀缓存）在首次调用上失效。
  3. **idle 补刷先清 `_skillsPromptDirty` 再 `await`**：补刷抛错即静默丢失且永不重试 —— 与文档承诺的「不会丢失」直接冲突，也违背本阶段自己的「禁止静默」纪律。
- 另有「第 2 层降级契约在 503 行之后不成立」、「P8 覆盖断言的 60 行窗口对 `_recreateAgent` 失守」、「两条恒真源码断言」、「产品文档两处承诺/声明与实现不符」、「`_recreateAgent` 的 JSDoc 被挤成悬空注释」。

无 Critical：本阶段不写盘（除测试夹具）、不删除用户文件、沙箱判据零改动、无新增依赖、无注入面扩大。诊断 message 含工作区绝对路径但只进 `_cache`（不进 prompt），与 46-01..03 的既有披露面一致。

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `syncAgentSystemPrompt()` 无生产调用方 → idle 补刷块不可达，D-03 机制无法触发

**File:** `ai-manager.js:1260-1267`（消费方）、`ai-manager.js:2513-2541`（生产者）
**Issue:** `_skillsPromptDirty` 的**全部写点**只有两处：构造器 `ai-manager.js:694`（`= false`）与 `syncAgentSystemPrompt` 内部 `ai-manager.js:2526`（忙时 `= true`）。而 `syncAgentSystemPrompt()` 在全仓库的**唯一调用点**是 `ai-manager.js:1263`，它位于 `if (this._skillsPromptDirty)` 块内 —— 即「要进入这个块，必须先由这个块调用的方法置脏」。全仓库验证（排除 `node_modules`）：

```
syncAgentSystemPrompt 出现位置：ai-manager.js:1263（唯一调用）、2513（定义）、2506（注释）；
                               tests/test-ai-skills.js:1219/1231/1243（测试直接驱动）
_skillsPromptDirty 写点：ai-manager.js:694、1261、2526   ← 无任何外部/事件/IPC 置位
```

因此本阶段：① idle 补刷块永不执行（死代码）；② 忙分支（2525-2528）永不执行（死代码）；③ `skills:changed` 永不广播；④ 技能集变更只在 `init()`（849）或 `_recreateAgent()`（2568，切换对话/切模型/createNewConversation 触发）被感知。计划在 `<p8_gate_mapping>` 里把「48/49/50/51 必须调用 `syncAgentSystemPrompt()`」写成显式交付项，所以「无触发点」是**有意的决定**；但 46-04 SUMMARY 与 coverage 表只写了「`skills:changed` 的消费方不在本阶段」，而未披露**生产端也没有任何调用方**，coverage D2「广播行为断言（SKILL-04 核心）」用 duck-typed `this` 直接驱动实例方法，证明的是「方法体正确」，不是「该行为可达」。SKILL-04 声称的「技能集变更无需重启/重建 Agent、下一轮即生效」在本阶段因此不成立。
**Fix:** 二选一 ——（a）把 46-04 SUMMARY/coverage 的措辞改为「本阶段交付机制、触发点移交 48/49/50/51（当前不可达）」，并在 `syncAgentSystemPrompt` 的 JSDoc 里加一行 `@remarks 本阶段无生产调用方，首个调用方在 Phase 48/50`；（b）若希望本阶段就可达，在技能目录变更的唯一现有入口（`ai-manager.js:2568` 的 `_recreateAgent` 之后与 `init()` 之后）之外补一个最小触发点（例如 `settings.aiSkills.disabled` 被写入时调 `syncAgentSystemPrompt()`）。不要在 1260 的块上原地打补丁 —— 病根是「没有写入方」。

### WR-02: 产品文档承诺了代码当前无法产生的行为

**File:** `docs/product/ai-skills.md:65`（另见 `:81`）
**Issue:** 文档写「技能段的变更在**修改之后的下一次请求**生效…若变更到达时 AI 正忙，会先记下、空闲后自动补上，**不会丢失**」。但（a）`_recreateAgent` 之外没有任何路径会重扫技能目录（见 WR-01），所以「改完 SKILL.md 直接在同一对话里再发一条消息」**不会**反映改动；（b）后一句描述的是 `_skillsPromptDirty` 流程，而该流程在本阶段完全不可达（WR-01），且即便可达也存在丢更新窗口（WR-04）。该文档在自己的维护约定块里声明「只写已落地行为并对未落地项如实标注」，`:12` 的「诊断数据形状」块更把自身标为「供下游阶段只依赖这一处」—— 与 Phase 48/50 的下游消费者直接相关。`:81` 的人工验证步骤「直接编辑 SKILL.md 后切换对话，下一条消息应反映改动」能通过，靠的是「切换对话 → `_recreateAgent()` → 重扫」（`ai-manager.js:2084`），不是热更新路径 —— 该步骤把这件幸运误读成 SKILL-04 已验证。
**Fix:** 把 `:65` 改为如实两段：「技能集变更在**该 Agent 被重建时**（切换对话 / 切换模型 / 新建对话）生效；无需重启应用。**不重建 Agent 的原地回写**（`syncAgentSystemPrompt()`）已实现但触发点在 Phase 48/50 接入前不会自动发生。」并在 `:81` 的人工验证步骤里显式写出「切换对话触发 Agent 重建」这一前提，避免把重建路径当成热更新证据。

### WR-03: 两处 Agent 创建点未初始化 `_skillsPromptDigest`，早退契约在每个 Agent 生命周期首次调用上失效

**File:** `ai-manager.js:868-882`（`init`）、`ai-manager.js:2576-2589`（`_recreateAgent`）、`ai-manager.js:702`、`2533-2537`
**Issue:** `_skillsPromptDigest` 在构造器里初始化为 `''`（`:702`），此后**只**在 `syncAgentSystemPrompt` 成功改写 prompt 时被赋值（`:2536`）。`init()` 与 `_recreateAgent()` 都在 `refreshSkills()` 之后用 `buildSystemPrompt()` 构造了**已含当前技能段**的 Agent（`:870` / `:2578`），却没有把当时的 `getSkillsSnapshot().digest` 记进 `_skillsPromptDigest`。早退条件是 `snap.digest === this._skillsPromptDigest && this.agent.state.systemPrompt === next`（`:2533`）；`computeDigest` 返回的哈希恒非空（`ai-skills-manager.js:603` 总含 `prompt:` 前缀），所以 `'' !== snap.digest` 恒成立 → 每个 Agent 生命周期内的**首次** `syncAgentSystemPrompt()` 必然执行 `this.agent.state.systemPrompt = next`（写入内容与已有值逐字符相同）并 `broadcast('skills:changed')`。这与 JSDoc 声明的第三条「无变化 → 不触碰 `agent.state`、不广播，保 provider 前缀缓存」直接矛盾；`tests/test-ai-skills.js:1192-1250` 的用例之所以没暴露它，是因为它把 `_skillsPromptDigest` 预设为 `''`、把 `agent.state.systemPrompt` 预设为 `''`（首次必然「有变化」），随后才验证第二次调用早退 —— 恰好绕过了「创建点未对齐摘要」这个起始态。
**Fix:** 在两处创建点构造 Agent 之后立即对齐摘要，使该字段始终等于「当前已应用 prompt 的摘要」：

```js
      this.agent = new Agent({ /* … */ });
      // 摘要必须与刚写入 agent.state 的 prompt 对齐，否则首次 sync 会误判为「已变化」
      this._skillsPromptDigest = getAiSkillsManagerLazy().getSkillsSnapshot().digest;
```
（`init()` 与 `_recreateAgent()` 各加一行；两处文本保持一致可让 `tests/test-ai-skills.js:1304` 的「两处创建点逐字一致」断言继续成立。）

### WR-04: idle 补刷先清脏标记再 `await` → 补刷失败即静默丢失且永不重试

**File:** `ai-manager.js:1260-1267`
**Issue:**

```js
      if (this._skillsPromptDirty) {
        this._skillsPromptDirty = false;          // ← 先清
        try {
          await this.syncAgentSystemPrompt();     // ← 再刷（异步，可抛）
        } catch (err) {
          console.warn('[Realm AI] 延迟刷新技能 prompt 失败:', err.message);  // ← 吞掉
        }
      }
```
`syncAgentSystemPrompt` 在 `await refreshSkills(...)`（`:2517`）之后再读 `this.agent`（`:2533`、`:2537`）。`refreshSkills` 是异步的：在这个 await 窗口内若 `_cleanupCurrentAgent()`（`:2474-2484`）把 `this.agent` 置 null，或 `_recreateAgent()`（`:2543`，`switchConversation`/切模型路径）换掉了 `this.agent`，则 `this.agent.state` 会在 `:2533` 抛 TypeError；`:2514` 的 `!this.agent` 前置检查发生在 await **之前**，无法兜住。此时脏标记已被清零、异常被 `console.warn` 吞掉，`agent.state.systemPrompt` 保留旧技能段，**没有任何重试路径**（下一次补刷需要 `_skillsPromptDirty === true`，而它已被清 false）—— 直到该 Agent 被重建才会自愈。这既是文档承诺「不会丢失」的反例（WR-02），也违背本阶段「禁止静默」的既有纪律（其余失败面都进了 `_cache.diagnostics` / `_cache.errors`）。
**Fix:** 先刷、成功后再清；失败则恢复脏标记并把原因落到可读位置：

```js
      if (this._skillsPromptDirty) {
        try {
          await this.syncAgentSystemPrompt();
          this._skillsPromptDirty = false;
        } catch (err) {
          // 保持置脏 → 下次 idle 边界重试；同时不静默
          console.warn('[Realm AI] 延迟刷新技能 prompt 失败（保持置脏，下次空闲重试）:', err.message);
        }
      }
```
（另建议在 `syncAgentSystemPrompt` 的 await 之后重新取一次 Agent 引用并复检 `if (!this.agent) return;`，把「await 期间 Agent 被替换」这条竞态显式化。）

### WR-05: `refreshSkills` 第 2 层降级契约「skills / promptBlock / diagnostics 一行都不碰」在 503 行之后不成立

**File:** `ai-skills-manager.js:503`（提前赋值）、`542`、`602-604`、`605-613`（catch）
**Issue:** JSDoc（`:432-433`）声明整批失败时「**保留上一次成功快照**（skills / promptBlock / diagnostics 一行不碰）」。但管线是分三处写入 `_cache` 的：`:503` 覆盖 `_cache.diagnostics`、`:542` 覆盖 `_cache.skills`、`:602-604` 覆盖 `promptBlock` / `digest` / `refreshedAt`。任何在 `:503` **之后**抛出的异常（例如 `:515` `entry.skill.filePath` 遇到形状不符的条目、`:521` `path.dirname`、`:574`/`:588` `formatSkillsForSystemPrompt` 内 `escapeXml` 对非字符串 description 调 `.replace`）都会让 catch 分支（`:605-613`）只补一条 `realm_refresh_failed`，而 `_cache.diagnostics` **已经指向失败那一轮的诊断**，`skills` / `promptBlock` / `digest` 却仍是上一轮的 → 对外呈现的是一组自相矛盾的快照（诊断描述失败轮，技能集描述成功轮），下游 Phase 50 渲染的诊断会与技能列表对不上。`tests/test-ai-skills.js:602-631` 的用例只覆盖 `listDir` 抛错（发生在 `:503` 之前），所以这条路径无守卫。注意 46-02 把 `_cache.diagnostics` 前移是为了避免管线 push 被末尾整体赋值覆盖 —— 该动机成立，但把赋值点前移的代价就是这条契约失效。
**Fix:** 改为「本轮诊断先攒在局部数组，管线的每次 push 也进局部数组；最后与 skills / promptBlock / digest 一起原子提交」，即可同时满足「push 不被覆盖」与「失败一行不碰」：

```js
    let diags = diagnostics.map(toRealmDiag).concat(droppedDiags, oversizeDiags);
    // pipeline 各步改为 diags.push(...)（pushEntryDiag 接受 diags 参数或经模块临时引用）
    ...
    _cache.diagnostics = diags;      // ← 与下面三者同批提交，位于全部可抛点之后
    _cache.skills = ...;
    _cache.promptBlock = block;
    _cache.digest = computeDigest(_cache.skills, block);
```
至少也应把 `:542` 的 `_cache.skills` 赋值挪到 `:602` 附近，消除「skills 已换、promptBlock 未换」这一半更新状态。

### WR-06: P8「漏接线即红」断言的 60 行窗口对 `_recreateAgent` 失守

**File:** `tests/test-ai-skills.js:1280-1302`
**Issue:** 断言是「每个 `new Agent(` 之前 60 行窗口内出现 `refreshSkills(`」。实测窗口内容：

```
new Agent( 行号            窗口范围         窗口内 refreshSkills( 次数
868（init）                 808 .. 867       1   （849，init 内）
2576（_recreateAgent）      2516 .. 2575     2   （2517 ← syncAgentSystemPrompt 内；2568 ← _recreateAgent 内）
```
窗口 2516..2575 **完整包住了紧邻其上的 `syncAgentSystemPrompt()`**（定义于 2513-2541），因此把 `_recreateAgent` 的 `refreshSkills`（2568-2574）整段删掉后，`new Agent(`（2576）的窗口内仍剩 1 次命中，**该断言保持绿色**。这正是该断言自称要拦的缺陷形态（「新增/漏掉创建点时是否调了刷新」），对两个创建点中的第二个完全失效。缓解项：同组的 `tests/test-ai-skills.js:1304-1329`（提取两处创建点的调用并比对文本）会在删除后转红（`assert.ok(recreateCall)`），所以当前实际漏检需要同时绕过两条断言；但注释里「不得补计数相等断言」的理由（「非创建点调用不参与判定」）恰恰说明了窗口法的弱点未被解决。
**Fix:** 把窗口判定从「文本包含」升级为「调用位于该创建点所属方法体内」，与同文件 `methodBody()` 的做法对齐：

```js
    // 以方法体为界，而不是 60 行字符窗口
    for (const [method, createLine] of [['init', 868], ['_recreateAgent', 2576]]) {
      const body = methodBody(src, method);   // 已有辅助函数
      assert.ok(body.includes('new Agent('), `${method} 应为创建点`);
      assert.ok(body.includes('refreshSkills('), `${method} 内缺少 refreshSkills —— P8 漏接线`);
    }
```
（若坚持行窗口法，则须把窗口收窄到「该 `new Agent(` 所属方法的起点之后」，并在注释里记录 2517 这个已知的窗口污染源。）

### WR-07: 两条源码扫描断言恒真（正则先过滤了它要校验的前缀）

**File:** `tests/test-ai-skills.js:325-331` 与 `tests/test-ai-skills.js:855-858`
**Issue:** 两处都用同一个捕获正则再对其结果做前缀校验：

```js
  const codes = [...src.matchAll(/code: '(realm_[a-z_]+)'/g)].map((m) => m[1]);
  for (const code of codes) {
    assert.ok(code.startsWith('realm_'), ...);                       // ← 恒真
    assert.strictEqual(SDK_CODES.includes(code), false, ...);        // ← 恒真
  }
```
`realm_[a-z_]+` 已强制捕获串以 `realm_` 开头，故 `startsWith('realm_')` 在任何输入下都不可能为假；SDK 五个枚举（`file_info_failed` / `list_failed` / `read_failed` / `parse_failed` / `invalid_metadata`）也都不以 `realm_` 开头，故重名校验同样不可能触发。实测：本模块的 9 个 `code:` 字面量全为 `realm_*`（`realm_name_rewritten / realm_shadowed / realm_skills_dir_missing / realm_root_entry_skipped / realm_skill_md_too_large / realm_layout_violation / realm_user_skill_limit_exceeded / realm_prompt_budget_exceeded / realm_refresh_failed`），所以用宽正则 `code: '([a-z_]+)'` 取值会得到同一集合 —— 即这两条「双重校验」无信息量。46-02 SUMMARY 把「源码扫描断言对本模块全量 realm_ 码做前缀 + 非重叠双重校验」列为已建立的模式的组成部分，该说法不成立。
**Fix:** 让正则不过滤、由断言去判定（并顺手检查是否有漏前缀的新码）：

```js
  const codes = [...src.matchAll(/code: '([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(codes.length >= 5, '应至少捕获到多条诊断码（防正则写错导致空集恒真）');
  for (const code of codes) {
    assert.ok(/^realm_/.test(code), `Realm 自建诊断码必须以 realm_ 前缀：${code}`);
    assert.strictEqual(SDK_CODES.includes(code), false, `诊断码不得与 SDK 枚举重名：${code}`);
  }
```
（`codes.length >= 5` 这条下界是必要的：加上它才能防住「正则写错→空集→循环体不执行→断言恒真」这种更隐蔽的恒真形态，与 `:1119-1125` 已有的「断言自校验」先例同款。）

### WR-08: 产品文档的「诊断归属」声明与实现不符

**File:** `docs/product/ai-skills.md:12-16`
**Issue:** 该块被标注为「供下游阶段只依赖这一处」，其中写「条目级 `diagnostics[]` 承载与该技能相关的一切诊断（**布局违规**、名称重写、遮蔽、**超限**等）」。核对实现，`entry.diagnostics`（在 `ai-skills-manager.js:514` 初始化为 `[]`）**只**收到两类诊断：`realm_name_rewritten`（`:326` 经 `pushEntryDiag`）与 `realm_shadowed`（`:362` 经 `pushEntryDiag`）。而：

| 诊断码 | 实际落点 | 文档所称 |
|--------|----------|----------|
| `realm_layout_violation` | 仅模块级（`:522` 直接 `_cache.diagnostics.push`）；违规条目已被 `continue` 丢弃，**不存在**可承载它的条目 | 条目级 |
| `realm_user_skill_limit_exceeded` | 仅模块级（`:559`，且**无 `path`**、不 `pushEntryDiag`）；被标 `overLimit` 的条目标上**没有任何诊断** | 条目级 |
| SDK 的 `parse_failed` / `read_failed` / `invalid_metadata` | 仅模块级（`:502-503`） | 未声明（读者会以为条目级也有） |

下游按此文档写 `entry.diagnostics.find(d => d.code === 'realm_user_skill_limit_exceeded')` 会拿到 `undefined`；而「布局违规」在条目级注定查不到。
**Fix:** 把 `:12-16` 改为精确枚举（这是数据契约，值得写死）：

```markdown
> - 模块级 `diagnostics[]`：全部 SDK 诊断 + 全部 realm_* 诊断（布局违规 / 名称重写 / 遮蔽 /
>   字节超限 / 数量超限 / 预算截断 / 根层 entry 跳过）—— 全量视图，建议下游一律读这里。
> - 条目级 `skills[i].diagnostics[]`：**仅** `realm_name_rewritten` 与 `realm_shadowed`
>   （附着于现存条目）；布局违规的条目已被丢弃，数量超限只在条目上留 `overLimit: true` 布尔标记。
> - 模块级 `errors[]`：`realm_skills_dir_missing` / `realm_refresh_failed`（无对应技能的整批/环境级问题）。
```

### WR-09: `_recreateAgent` 的 JSDoc 被新方法挤成悬空注释，该方法失去文档

**File:** `ai-manager.js:2486-2490`（悬空块）、`ai-manager.js:2543`（无 JSDoc 的方法）
**Issue:** 46-04 把 `syncAgentSystemPrompt()` 连同它自己的 JSDoc 插在了 `_recreateAgent` **与其原有 JSDoc 之间**，于是基线里紧跟方法的注释块（`f5005d2` 的 2458-2462：`重新创建 Agent 实例 / 复用现有 init 逻辑中的 Agent 创建代码 / @private`）现在悬在两个 JSDoc 之间，成了不附着任何节点的死注释；`async _recreateAgent()`（`:2543`）前则是上一方法的 `}` 与空行，**没有任何 JSDoc**。后果：① 违反项目 `AGENTS.md`「函数和类必须添加 JSDoc 注释」的硬性风格约定；② 注释文本「复用现有 init 逻辑中的 Agent 创建代码」与它现在所处位置（`syncAgentSystemPrompt` 之前）语义不符，按该描述检索会定位到错误的方法；③ JSDoc 工具链会把悬空块归给错误的目标。
**Fix:** 删除 `ai-manager.js:2486-2490` 的悬空块，把它原样移动到 `:2543` 的 `async _recreateAgent() {` 紧上方。

## Info

### IN-01: `realm_prompt_budget_exceeded` 的 `currentValue` 是累计口径（系统性高估 97 字符）

**File:** `ai-skills-manager.js:598`（`currentValue: used`）
**Issue:** `used` 从 `fixedOverhead`（=`formatSkillsForSystemPrompt([dummy])` 的长度，实测 447）起累加逐条**边际成本**（`:574-576`）。数值验证：40 条 300 字符描述的技能时 `used = 7832`，而真实段本体 `formatSkillsForSystemPrompt(kept).length = 7735` —— 恒定高估 97（= dummy 自身 5 行长度 92 + 5 个换行）。预算约束本身因此**偏保守且正确**（段本体 = `used - 97 ≤ 8000 - 97`，实测 7735 ≤ 8000），无缺陷；但 Phase 50 若把 `currentValue` 直接渲染成「当前 7832/8000」，展示值与真实段长不符。
**Fix:** 若要与展示口径一致，把 `currentValue` 改为 `formatSkillsForSystemPrompt(kept).length`（或 `used - (fixedOverhead - formatSkillsForSystemPrompt([]).length − 5)`）并保留 `limit` 不变；若要保持「与判定式同源」，则在文档/UI 处注明该值为含固定开销的保守估计。

### IN-02: 目录缺失诊断对任何非 ok 的 `exists` 结果都报「不存在」

**File:** `ai-skills-manager.js:461-471`
**Issue:** 条件 `!ex || ex.ok !== true || ex.value !== true` 把「确实不存在」「权限拒绝（`permission_denied`）」「路径越界」等全部归入 `realm_skills_dir_missing`，message 写死「技能目录不存在：…（应用启动时应由 ensureWorkspaceDir 创建）」。当磁盘错误实际是权限或其它 IO 故障时，用户被指向错误的方向（去建目录，而目录其实存在）。
**Fix:** 按 Result 形状分流：`ex.ok === false` 时用 `ex.error.code`／`ex.error.message` 生成 `realm_skills_dir_unreadable`（或复用同一 code 但在 message 里带上 `ex.error.message`）；只有 `ex.ok === true && ex.value === false` 才报「不存在」。

### IN-03: 扫描根下的符号链接目录被判为「根层散落 entry」，诊断措辞与事实不符

**File:** `ai-skills-manager.js:148-151`（`entry.kind === 'directory'`）、`ai-skills-manager.js:483-488`（诊断文本）
**Issue:** SDK `listDir` 用 `lstat`，符号链接的 `kind` 是 `'symlink'`（`dist/harness/env/nodejs.js:44-59`、`547-574`），未被窄化为 `'directory'`；而未经收窄的 SDK 会用 `resolveKind` → `canonicalPath` 把它解析成目录并加载。因此 `skills/foo -> 别处/foo` 这类链接在收窄后不再被加载，且产出的 `realm_root_entry_skipped` message 说的是「根层散落**文件**不会被加载…技能必须放在 `<dir>/<name>/SKILL.md`」—— 把一个目录入口描述成散落文件。就沙箱语义而言该行为可接受（`resolveInside` 的 realpath 复核会拒绝指向 root 之外的 symlink），但诊断文本具误导性。
**Fix:** 在 `listDir` 收窄处按 `entry.kind` 区分文案（`directory` 之外且 `kind === 'symlink'` 时产出「符号链接入口被跳过（技能目录必须位于工作区内）」），或把丢弃原因写进 `droppedNotices`（新增 `kind: 'symlink_entry'`）由调用方映射为专门诊断。

### IN-04: 忙时置脏路径会重复整轮扫描磁盘

**File:** `ai-manager.js:2517` 与 `ai-manager.js:1260-1267`
**Issue:** 忙时 `syncAgentSystemPrompt()` 已经执行过一次 `refreshSkills`（`:2517`），置脏返回；随后 idle 补刷又调一次 `syncAgentSystemPrompt()` → 再执行一次 `refreshSkills`。同一次变更触发两轮全目录遍历 + 每条 SKILL.md 的 `fileInfo`/`readTextFile`。功能上幂等（无正确性影响），但这是本阶段唯一新增的重复 IO —— 该阶段自己的注释（`:1259`）声称「避免同一次运行双刷」，实际只避免了「双写 prompt」，未避免「双扫磁盘」。
**Fix:** 忙分支直接返回（不置脏），由调用方在下一次 idle 时重新 `await this.syncAgentSystemPrompt()`；或在 `refreshSkills` 外加一个「本轮已扫描」的短时效标记。若要保留置脏语义，至少在 JSDoc 里写明「置脏意味着下一轮会重扫磁盘」以便 Phase 48/50 评估调用频率。

### IN-05: `getSkillsSnapshot()` 的浅拷贝把条目对象本身暴露给消费方

**File:** `ai-skills-manager.js:637-644`
**Issue:** `skills: _cache.skills.slice()` 只复制数组，元素（含 `entry.skill`）仍是模块级权威对象的引用。`computeDigest`（`:92-101`）直接读 `e.skill.name` / `description` / `filePath` / `source` / `disabled` / `overLimit` / `shadowed`。下游（Phase 48/50）若就地对 `snapshot.skills[i].skill.name` 或 `entry.disabled` 赋值（例如做展示层归一化），会同时改变**下一次 digest 的输入**，让「无变化 → 不动 prompt」的判定漂移（`:2533`）。JSDoc 已说明是「浅拷贝视图」，但风险点是**深入一层**的对象而非数组本身。
**Fix:** 条目级也做一层浅拷贝（`skills: _cache.skills.map((e) => ({ ...e, skill: { ...e.skill } }))`），或在 JSDoc 中把「不得就地修改快照内的条目对象与 `skill`」写成显式契约。

### IN-06: `refreshSkills` 的 `_cache` 提交跨 await 边界，无重入保护

**File:** `ai-skills-manager.js:440-615`（await 在 `:462`、`:475`、`:477`）
**Issue:** 全部 await 都落在 `:503` 之前，之后到 `:604` 是同步段，所以每次刷新最终提交的 `skills` / `promptBlock` / `digest` 内部自洽（不存在半更新快照）—— 这点已确认无缺陷。但两次并发调用仍会**互相覆盖**：先发起者若最后完成，会把它更早读到的磁盘状态覆盖掉后发起者的更新（`:602-604`）；同时 `_cache.errors = []`（`:457`）发生在 await 之前，两次并发会让 `realm_skills_dir_missing` 之类的环境级诊断在同一轮里重复入列。本阶段唯一调用方（`init` / `_recreateAgent` / `syncAgentSystemPrompt`）互不并发，但 46-04 已把「48/49/50/51 需调用 `syncAgentSystemPrompt()`」列为交接项，届时设置页写入路径与对话流可能并发。
**Fix:** 加一个模块级进行中 Promise 做串行化（`_inflight = _inflight.then(() => run())` 或「已有刷新在跑则返回同一个 Promise」），并把 `_cache.errors = []` 移到拿到「提交权」之后；或至少在 `refreshSkills` 的 JSDoc 里写明「非并发安全，调用方须自行串行化」。

## Verified Clean（对抗验证过、确认无缺陷的项）

任务点名的风险面逐条核对结果：

| 检查项 | 结论 | 证据 |
|--------|------|------|
| `createSandboxEnv` / `resolveInside` 零 diff | ✔ 成立 | `git diff aa68cfb..HEAD -- agent-workspace.js` 仅 1 行注释改写 + 2 个新访问器 + 2 行 `mkdirSync` + 2 项导出；`grep -c '^-'` = 2（含 `--- a/…` 头），`resolveInside`（`:162-192`）与 `createSandboxEnv`（`:205-376`）逐字节未动 |
| 未引入第二个沙箱 root / 只读挂载 | ✔ 成立 | `getSkillsDir()`（`:102`）与 `getManagedSkillsDir()`（`:113`）均由 `getWorkspaceDir()` 派生；两目录都在 root 内，`resolveInside` 单基准即可放行 |
| 零新增 npm 依赖 | ✔ 成立 | `git diff v2.5..HEAD --stat -- package.json` 为空 |
| 无 `require('yaml')` / `require('ignore')` / SDK harness 子路径导入 | ✔ 成立 | 两条正则对 `ai-skills-manager.js` / `ai-manager.js` 均无命中；SDK `exports` map 仅 `.` / `./node` / `./session/testing` / `./package.json` |
| `ai-skills-manager.js` 无 `localeCompare` | ✔ 成立 | 全文件 0 命中（`bySkillPriority` 用 `<` / `>` 码点比较，`:403-405`）。**注**：SDK 自身在 `dist/harness/skills.js:104` 用 `a.name.localeCompare(b.name)` 决定目录遍历顺序，该顺序会传给 `applyShadowing`／诊断入列顺序，但**不影响** `bySkillPriority` 之后的 `_cache.skills` 顺序（遮蔽胜负只取决于跨来源的输入顺序，同来源内目录名唯一），也不进 digest，故不构成跨机不确定 |
| prompt 段预算不变式（段本体 ≤ `SKILLS_PROMPT_CHAR_BUDGET`） | ✔ 成立（数值证明） | `fixedOverhead = 447`；`entryCost(s) = format([dummy, s]) - 447` 恰为 s 的 5 行长度 + 5 个换行；`used = 447 + Σcost`，而真实段长 = `used - 97`。40 条 300 字符描述：`used = 7832`、真实段长 `7735 ≤ 8000`；再加一条会到 `> 8000`。贪心 `break` 不会放出超预算段 |
| `disableModelInvocation` 与预算 / `overLimit` / `disabled` / `shadowed` 的交互 | ✔ 成立 | `eligible`（`:577-579`）同时排除四种不注入项，与 `formatSkillsForSystemPrompt` 内部 `!disableModelInvocation` 过滤一致（`system-prompt.js:2`），差量测量不会把被过滤项算进成本 |
| `overLimit` / `disabled` / `shadowed` 只标记不剔除 | ✔ 成立 | `:550-552`（disabled 就地标记）、`:558`（overLimit 标记）、`applyShadowing` 返回等长数组（`:353-374` 无 `splice`/`filter`）；全模块无 `.splice(`、无 `_cache.skills = …filter(` |
| `bySkillPriority` 是全序 | ✔ 成立 | 三级键（source → invocation → name 码点）在「name ≡ 目录名（D-08 后不变式）」+「每个 (root, dirname) 至多一个条目」+「跨来源重名由 source 区分」下无并列可能；同来源内目录名唯一，故无返回 0 的不同元素，`.sort()` 结果与输入顺序无关 |
| `_cache.errors = []` 复位位置 | ✔ 正确 | 位于 `try` 开工处（`:457`），早于目录存在性断言（`:461`）与成功路径末尾；因此 `realm_skills_dir_missing` 不会被清掉，失败路径又在 catch 追加 `realm_refresh_failed`。失败路径不重复复位 —— 符合 D-05 第 2 层 |
| `pushEntryDiag` 写 `_cache.diagnostics` 的时序 | ✔ 正确 | 容器在 `:503` 就位；`pushEntryDiag` 的调用点（`:326`、`:362`）与其余 `_cache.diagnostics.push`（`:522`、`:559`、`:593`）全部在 503 之后。46-02 的「先就位、只追加」改造有效（否则布局诊断会被整体赋值覆盖） |
| `isDescriptionUnusable` 是否会误判 | ✔ 当前不会（耦合脆弱但被行为测试钉住） | SDK 0.84.3：`validateDescription` 两条 message 均以 `description` 开头（`skills.js:255`、`:258`），`validateName` 五条均以 `name` 开头（`:240`、`:242`、`:244`、`:247`、`:249`），故 `/^description\b/` 不会命中 name 类；且 `d.path === entryPath` 的配对在 SDK 侧成立（`skills.js:216`、`:221` 都带 `path: filePath`）。关键点：SDK 若改模板，`tests/test-ai-skills.js:561-565`（真实 1100 字符描述必须被跳过）与 `:575`（message 前缀）会**转红**而非静默失效 —— 失败是响亮的 |
| `syncAgentSystemPrompt` 的 `_skillsPromptDigest` 先于 prompt 写入 | ✔ 顺序正确 | `:2536` → `:2537`。即使 `:2537` 抛错，`:2533` 的第二条件 `agent.state.systemPrompt === next` 会阻止下一轮误早退，不会出现「摘要说已应用、实际未应用」的静默不一致（该顺序问题与 WR-03 的初始化缺失是两码事） |
| 忙检查位于任何 Agent 状态变更之前 | ✔ 正确 | `:2525-2528` 位于 `:2530`（快照）/ `:2537`（写 prompt）/ `:2540`（广播）之前；`isProcessing` 的检查先于 `this.agent.state` 的读写 |
| idle 补刷相对 `this.isProcessing = false` 的位置 | ✔ 正确 | `:1256` 复位 → `:1260` 补刷；`sync` 内 `:2525` 的忙检查此刻为假，可正常落地。失败处理问题见 WR-04（属「先清脏标记」而非「位置」） |
| prompt 段「空态整段不追加」契约 | ✔ 成立 | `buildSystemPrompt()`（`:580-585`）以 `skillsBlock ? … : base` 条件追加；空技能集时 `_cache.promptBlock` 为 `''`（`:588`），`tests/test-ai-skills.js:996-1010` 断言与三段基线逐字符相同 |
| 恒真的退化分支：`kept.length === 0 && eligible.length > 0` 会产出「只有省略提示、没有 `<available_skills>`」的 prompt | ✔ 实际不可达 | 需 `fixedOverhead + 首条边际成本 > 8000`；实测 `fixedOverhead = 447`，极端条目（name 255 / description 1024 / filePath 300）边际成本 1686，两者之和 2133 << 8000。超长 description 又已被 `isDescriptionUnusable` 拒于集合之外，故首条恒可入段 |

---

## Fix Status（2026-09-11 收尾时更新）

修复提交：`52d55fa`（`fix(46): 代码审查修复 —— WR-03/04/05/07/08/09`）。修复后 `node tests/test-ai-skills.js` **64/64**、`test-agent-workspace.js` 21/21、`test-ai-bash-policy.js` 32/32、全库 `node --check` 全过、DOC-01 gate 通过。

### 已修复（6 条 Warning）

| ID | 修复方式 | 锁定断言（新增） |
|----|---------|-----------------|
| WR-03 | `init()` 与 `_recreateAgent()` 建完 Agent 后各补一行 `this._skillsPromptDigest = getAiSkillsManagerLazy().getSkillsSnapshot().digest;` | 「两处 Agent 创建后都初始化 `_skillsPromptDigest`」源码断言（计 2 行） |
| WR-04 | idle 补刷失败时恢复 `_skillsPromptDirty = true`（下次空闲重试），告警文案改为「将于下次空闲重试」 | 「补刷失败时必须恢复脏标记」源码断言（`= true` 位于 `await this.syncAgentSystemPrompt()` 之后） |
| WR-05 | 管线开始前捕获 `prev = { skills, promptBlock, diagnostics }`，catch 分支**整体回滚三件套**（原先只在 throw 早于 diagnostics 赋值时才守住契约） | 「catch 分支整体回滚三件套」源码断言（逐行校验三条赋值 + 仍记 `realm_refresh_failed`） |
| WR-07 | 两处诊断码扫描正则由 `/code: '(realm_[a-z_]+)'/` 改为宽口径 `/code:\s*'([a-zA-Z_]+)'/` —— 预筛前缀会使 `startsWith('realm_')` 恒真 | 已用注入样本自校验（`code: 'parse_failed'` 可被捕获并判为违规） |
| WR-08 | 产品文档的诊断归属改为「两级分工表」，并注明布局违规/超限类**只在模块级可见**（违约条目已被丢弃、超限条目不带诊断）；已知限制补「本阶段尚未提供技能集变更入口」 | DOC-01 gate（`缓存条目的 diagnostics` 子串保留） |
| WR-09 | `_recreateAgent` 的 JSDoc 从悬空块移回该方法之前 | —— |

### 未修复（3 条 Warning + 6 条 Info，均记录在案）

| ID | 处置 | 理由 |
|----|------|------|
| WR-01 | **接受（按设计）** | `syncAgentSystemPrompt()` 在本阶段确无生产调用方 —— 技能集的**写路径**（`/` 面板 / 设置页启停卸载 / `manage_skill` / 导入）分别在 Phase 48/49/50/51 落地，`<p8_gate_mapping>` 已把它写成显式交接项。**本 REVIEW 承认：不但广播消费方不在本阶段，变更生产者也不在** —— 因此 `_skillsPromptDirty` 的置位路径在本阶段不可达，idle 补刷块在集成 `manage_skill` 前不会被触达。这不是缺陷，是本阶段「机制先行、写路径后置」的台阶划分；但产品说明不得据此暗示「现在就能从 UI 里改技能集」（已在文档「已知限制」明写）。 |
| WR-02 | **已被 WR-04 / WR-08 修复覆盖** | 文档「不会丢失」的承诺在 WR-04 修复后成立；「变更入口已存在」的暗示已在文档已知限制中明写否定 |
| WR-06 | **接受（有替代守卫）** | 计划把 60 行窗口断言定为验收项，故保留；该窗口对 `_recreateAgent` 确实失守（窗口内含 `syncAgentSystemPrompt` 的 `refreshSkills(`）。**替代守卫是同一 describe 内的「两处创建点调用文本一致」断言** —— 它从 `methodBody('_recreateAgent')` 内提取调用，删掉接线即取空 → 转红。故「漏接线即红」的能力并未丢失，只是由兄弟断言承担 |
| IN-01 | 接受 | `currentValue` 为累计口径（系统性高估约 97 字符，即一个空条目的长度）—— 诊断语义是「用到多少预算」，偏保守可接受 |
| IN-02 | 接受 | 非 `ok` 的 `exists` 一律报「目录不存在」；沙箱 `exists` 的拒绝路径目前只在越界时出现，越界本身另有日志，措辞可后续细化 |
| IN-03 | 接受 | 扫描根下的符号链接目录被判为「根层散落 entry」；SDK 的 `resolveKind` 对 symlink 的判定未细分，本阶段不加分支 |
| IN-04 | 接受 | 忙时路径会重复一轮磁盘扫描（`syncAgentSystemPrompt` 先刷新再判定忙）—— 扫描是本地目录枚举、成本可控，且在写路径落地前不可达 |
| IN-05 | 接受 | `getSkillsSnapshot()` 的浅拷贝把条目对象本身暴露给消费方；Phase 48/50 按文档只读消费，若需不可变视图可在该阶段按需求收敛 |
| IN-06 | 接受（48/50 交接项） | `refreshSkills` 无重入保护；当前所有调用点都在主进程单线程顺序路径上，写路径落地时由 49/50 的调用点串行化保证 |

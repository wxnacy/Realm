---
phase: 49-manage-skill-ai
plan: 05
subsystem: ai-integration
tags: [manage_skill, card-marker, merge, cr-01, wr-02, failure-code, roundtrip, guards, false-green, prompt-included]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: 49-04 的三态 getSkillPromptIncluded（命中可用 true / 命中被滤 false / 未命中 undefined）—— 本计划的消费侧按该三态收口
  - phase: 49-manage-skill-ai
    provides: 49-02 的两时点标记（start 给 {action,name} / end 给终态三键）、_buildManageSkillDecoration 唯一构造、九码闭合白名单与三张跨进程单源表
  - phase: 48-skill-name
    provides: src/skill-picker-model.js 的双模式导出纪律（renderer 与纯 Node 测试取同一个 api 对象引用）
provides:
  - src/skill-picker-model.js 的 mergeManageSkillMarker(prev, incoming)（纯函数、双模式导出、零依赖零 DOM）
  - src/renderer.js「已存在条目」分支的真并入（CR-01 修复点）
  - ai-manager.js 的 MANAGE_SKILL_CODE_TAG（失败态原因码词缀，encode / decode 唯一来源）
  - 失败出口给 err.message 加 [code] 词缀（同一 Error 实例；幂等；非字符串 code 不加）
  - _manageSkillTerminalFromStored 从持久化文本还原 code（不重算 / 旧消息不设键 / 起始锚定）
  - 三态 promptIncluded 的消费侧收口（只有 boolean 写键、只有严格 false 追加文案）
  - tests/test-skill-picker-model.js 的 C 组值域行（6 例）
  - tests/test-ai-skills.js 的 M2c / M2d / M2e / M2f / M5c + 纠正后的 M3 / M5b
affects: [49-06, 50, 51]

actuals:
  tokens: 10397
  tasks: 3
  commits: 3
plan_head_before: e04fa47d055de93616cbb27e1305b714985a414f

tech-stack:
  added: []
  patterns:
    - "条件并入抽成跨进程单源纯函数：渲染端与纯 Node 测试调用**同一个对象引用上的同一个函数**，守卫因此表达实现语义而不是意图"
    - "失败态的机器可读原因码经「错误消息词缀」跨过持久化边界：encode 侧改写 err.message、decode 侧用**同一个常量**解析，零 schema 变更、零新列、不污染 LLM 上下文重建路径"
    - "三态返回值的消费侧收口：只有 boolean 才写键（不写 undefined 再靠 JSON 序列化丢掉）、只有严格 false 才追加文案"
    - "反向验证的两条失败路径必须**各自可生产**：A 驱动 M3（渲染端接线）、B 驱动 M5b/M5c（共享函数语义），一条路径不得冒充两条"
    - "区域夹具的窗口由锚点定界（起点 → 该起点之后的第一个终点锚点），不用「起点 + 固定长度」的近似偏移"

key-files:
  created: []
  modified:
    - ai-manager.js
    - src/renderer.js
    - src/skill-picker-model.js
    - tests/test-ai-skills.js
    - tests/test-skill-picker-model.js

key-decisions:
  - "结论先行：Gap 2（CR-01 卡片终态标记崩塌）与 Gap 3（两条链路键集合 / truth #12 / #13）连同 WR-02（失败历史卡片丢失短原因）一并闭合；两条假绿守卫按计划**纠正**而不是删除，且各自的失败路径都实跑证明可生产"
  - "并入逻辑取 UI-SPEC 硬约束 1 的字面语义并抽成跨进程单源纯函数 `mergeManageSkillMarker` 住 src/skill-picker-model.js —— 本 phase 的假绿成因正是「测试手搓期望对象、渲染端另有实现」，只有让测试调用渲染端真正调用的那个函数，守卫才表达实现语义"
  - "否决备选「把整份 decoration 移进 _resolveManageSkillTerminal」：它会让 end 事件重复 start 已给过的两键，与 UI-SPEC 的两时点分工（start 给 action / name、end 给终态三键）直接冲突"
  - "失败态原因码取「错误消息词缀」而非「记为已知偏差并收窄断言」或「另开持久化通道」—— 词缀落在既有通道内（消息即 tool_results 的文本列）、零 schema 变更，且写进 tool_calls 列被既有注释明确排除（会污染 getAgentMessages 的 LLM 上下文重建路径）"
  - "词缀的写入位置固定在 catch 块**元数据写入之前**：既有的 M2 源码正则要求 `_manageSkillMeta.set(...)` 与随后的 `throw err;` 相邻 —— 顺序换位会让那条护栏不需要任何修改地继续成立（它断言的是「失败出口仍然 throw」这条 LLM 语义，不该为本次改动而放宽）"
  - "词缀正则 `MANAGE_SKILL_CODE_TAG` 锚定消息起始（`^`）且**不加 /g**：`^` 是「成功文案永不误命中」的机械保证；`/g` 会让 lastIndex 在 .test() 与 .exec() 之间残留而产出间歇性假阴性"
  - "**已知且刻意的可见面变化**：失败消息因此带一个 `[code] ` 前缀（LLM 与卡片展开区都会看到）。这是「失败态唯一的持久化通道是消息文本」的代价，且只增不删（原中文完整文案逐字跟在词缀之后，M2c 用「不经工具的同一 manager 调用」做对照断言证明）。该变化归 49-06 成文，不留成未记录的偏差"
  - "WR-03（成功文案偏离 UI-SPEC 清单）保持挂账、不在本 run 范围内：三处成功文案逐字未改，M2f 的断言逐字复用既有文案以证明「未顺手改写」"
  - "M3 的原有第 3 条子句（`/event\\.manage_skill\\s*\\?/`）被删除而非保留：条件并入的语义已由 `mergeManageSkillMarker(prev, null) === prev` 在跨进程单源的纯函数层断言（不依赖渲染端的书写形式），而在渲染端保留一条「子串存在」断言正是本 phase 要消灭的假绿形态"
  - "M5b 的 `live` 改由共享合并函数算出后，**渲染端回退为覆盖写法不会让 M5b 转红**（它读不到渲染端源码）—— 这条反面事实如实写进断言消息与 SUMMARY，且**没有**为凑「两条都红」给 M5b 补子串断言"

patterns-established:
  - "单源护栏的可生产性纪律：每条守卫都必须能指名一个「实现改回旧写法 ⇒ 它必然转红」的输入，且不得声称它在读不到的改动上转红（路径 A → 仅 M3 红；路径 B → M5b/M5c/M2d 红）"
  - "「只增不改」型消息改写的对照断言手法：以不经工具的同一 manager 调用产出无词缀原消息，去掉词缀后逐字比对"
  - "跨进程单源函数的假绿检测器落在**区域 + 语义调用**上（具体区域必须调用共享函数），而不是整文件子串存在性"

requirements-completed: [MGMT-01, MGMT-05]

coverage:
  - id: D1
    description: "工具执行 end 事件到达后，该次 manage_skill 的标记仍含 start 给的 action / name 并新增终态三键（{action, name, tier?, code?, promptIncluded?}），卡片技能变体在终态可达（Gap 2 / CR-01 闭合）"
    requirement: MGMT-01
    verification:
      - kind: unit
        ref: "node --test tests/test-skill-picker-model.js#CR-01 反例（本 phase 的靶心）：并入后 action 与 name 仍在 ⇒ 卡片技能变体在终态仍成立"
        status: pass
      - kind: unit
        ref: "node --test tests/test-skill-picker-model.js#incoming 为空 → 原样返回 prev 本体（同一引用）：不带标记字段的后续 update 事件不得抹掉已写入的标记"
        status: pass
      - kind: automated_other
        ref: "node -e '<renderer 合并区源码断言：起点 toolExecutions[existingIdx] 之后须出现 mergeManageSkillMarker(，且不得出现 manageSkill: event.manage_skill>' → merge-wired ok"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js#M3（源码 · 合并分支护栏）已存在条目分支经共享合并函数并入终态字段"
        status: pass
    human_judgment: false
  - id: D2
    description: "重开对话后卡片标记与实时链路逐字一致：成功行 {action, name, tier, promptIncluded}；失败行 {action, name, code, tier?} 且失败历史卡片保留短原因（Gap 3 / WR-02 闭合）"
    requirement: MGMT-01
    verification:
      - kind: unit
        ref: "node tests/test-ai-skills.js#M5b（行为 · 重载同形 · 成功行）经共享合并函数产出的 manageSkill 逐字相等"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js#M5c（行为 · 重载同形 · 失败行）短原因经词缀复原，且两条链路键集合与取值逐字相等"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js#M2d（行为 · 重载还原）词缀 → code 还原；无词缀的旧失败行与成功行都不设 code 键"
        status: pass
      - kind: automated_other
        ref: "node -e '<_manageSkillTerminalFromStored 区域源码断言：须用 MANAGE_SKILL_CODE_TAG 解析且还原 terminal.code>' → code-roundtrip wired"
        status: pass
    human_judgment: false
  - id: D3
    description: "失败态原因码经词缀落库（写侧真实抛出的消息以 [code] 开头、code 与文案逐字不变、幂等、非字符串 code 不加缀），旧历史失败行零回归"
    requirement: MGMT-05
    verification:
      - kind: unit
        ref: "node tests/test-ai-skills.js#M2c（行为 · 词缀）真跑工具失败出口：消息以 [code] 开头、code 与文案逐字不变、只加一次"
        status: pass
      - kind: automated_other
        ref: "node -e '<_buildManageSkillTool 区域源码断言：须出现 MANAGE_SKILL_CODE_TAG 且改写 err.message>' → failure-tag wired"
        status: pass
    human_judgment: false
  - id: D4
    description: "三态 promptIncluded 的消费侧收口：未命中（undefined）时 details / 短期元数据不含该键且不追加失实句；严格 false 时追加「预算已满」句且写 false"
    requirement: MGMT-05
    verification:
      - kind: unit
        ref: "node tests/test-ai-skills.js#M2e（行为 · 三态消费侧）未命中（undefined）⇒ details 无 promptIncluded 键、不追加「预算已满」句"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js#M2f（行为 · 三态消费侧）命中被滤（false）⇒ 追加「预算已满」句且 details.promptIncluded === false"
        status: pass
    human_judgment: false
  - id: D5
    description: "两组假绿守卫被纠正为可失败的断言，且失败路径**可生产**（路径 A 渲染端回退 → 仅 M3 红；路径 B 共享函数改覆盖语义 → M5b/M5c/M2d 与 C 组值域行红）；既有例数与兄弟套件零回归"
    requirement: MGMT-05
    verification:
      - kind: unit
        ref: "node tests/test-ai-skills.js（172 → 176 → 177 pass / 0 fail）"
        status: pass
      - kind: unit
        ref: "node --test tests/test-skill-picker-model.js（99 → 105 pass / 0 fail）"
        status: pass
      - kind: unit
        ref: "node tests/test-manage-skill.js（55 pass / 0 fail）"
        status: pass
      - kind: unit
        ref: "node --test test/memory/threat-scan.test.js（33 pass / 0 fail）"
        status: pass
      - kind: automated_other
        ref: "node -e '<guards corrected 门禁：M5b 须调共享合并函数且不得手搓 live；夹具须 merge: src.slice(mergeIdx, pushIdx) 且不得有 mergeIdx + N；renderer 合并区须调共享合并函数>' → merge-region 1173 / guards corrected"
        status: pass
      - kind: automated_other
        ref: "反向验证路径 A（渲染端改回覆盖写法）：node tests/test-ai-skills.js → 177 中 fail 1，唯一转红断言 = M3（M5b / M5c 仍绿）"
        status: pass
      - kind: automated_other
        ref: "反向验证路径 B（共享函数改覆盖语义）：node tests/test-ai-skills.js → fail 3（M2d / M5b / M5c）；node --test tests/test-skill-picker-model.js → fail 2（同名键 incoming 胜出 / CR-01 反例）；M3 仍绿"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 05: manage_skill 卡片终态标记与失败态原因码 gap 闭合 Summary

**渲染端的终态标记由覆盖改为经跨进程单源纯函数 `mergeManageSkillMarker` 并入、失败态原因码经 `[code] ` 词缀落库并在重载链路用同一个常量还原 —— Gap 2 / Gap 3 / WR-02 一并闭合，两组假绿守卫各自修出一条**可生产**的失败路径（渲染端回退 ⇒ 仅 M3 转红；共享函数改覆盖语义 ⇒ M5b/M5c/M2d 转红），`ai-skills` 177 / `picker-model` 105 / `manage-skill` 55 / `threat-scan` 33 全绿**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-13T10:11:57Z
- **Completed:** 2026-09-13T10:20:29Z
- **Tasks:** 3/3
- **Files modified:** 5（`src/skill-picker-model.js` / `src/renderer.js` / `ai-manager.js` / `tests/test-ai-skills.js` / `tests/test-skill-picker-model.js`）
- **Diff:** +564 / −26（`ai-manager.js` +81、`src/renderer.js` +18、`src/skill-picker-model.js` +37、`tests/test-ai-skills.js` +358、`tests/test-skill-picker-model.js` +96）
- **Estimate vs actuals:** 计划估 `tokens 118000`；实测（realized diff chars / 4）**10397** —— confidence 为 `low`（0 条校准样本）的整估高估约 11 倍，属计划期已显式记账的超预算裁决（见下「Decisions Made」最后一条），本计划未因此减少任务或跳过反向验证

## Accomplishments

- **CR-01 闭合**：`src/skill-picker-model.js` 新增 `mergeManageSkillMarker(prev, incoming)` —— `incoming` 为假值原样返回 `prev`（同一引用，这是「不带标记的 update 事件不得抹掉已写入标记」的机械保证）、`prev` 为空返回 `incoming` 的浅拷贝、两者非空返回 `{ ...prev, ...incoming }`；不修改入参、每次返回新对象、纯数据形状运算（零判定面）。`src/renderer.js` 的「已存在条目」分支改为以其**已有** `manageSkill` 为基底调用它 —— `action` / `name` 不再被终态载荷抹掉，卡片技能变体在 `tool_execution_end` 之后仍然成立。
- **WR-02 闭合**：`ai-manager.js` 新增模块级常量 `MANAGE_SKILL_CODE_TAG`（`/^\[([a-z_]+)\]\s/`，锚定起始、`[a-z_]+` 词表域、**不加 /g**），是 encode / decode 两侧的**唯一来源**。失败出口在写元数据**之前**给 `err.message` 加 `[code] ` 词缀（仅当是 `Error` + 非空字符串 `code` + 消息尚未带同款词缀；保持同一个 Error 实例）；`_manageSkillTerminalFromStored` 从持久化文本（`t.error` 优先、`t.result` 回退）起始处的词缀还原 `code`。
- **Gap 3 闭合**：成功行两侧都是 `{action, name, tier, promptIncluded}`；失败行两侧都是 `{action, name, code, tier?}` —— 键集合与取值逐字相等，由 M5b（成功行）与 M5c（失败行）各自**双向**断言（不多键也不少键）。
- **三态消费侧收口**：`promptIncluded` 只有 boolean 才写进 `details` 与短期元数据；只有**严格等于 `false`** 才追加「技能段预算已满」句。未命中（`undefined`）时既不断言「预算已满」（预算并未满）也不声称「仍可用 /skill:{name} 手动调用」（该调用同样解析不到）—— 49-04 的三态修复不再被消费侧合并回去。
- **两条守卫纠正为可失败**：M3 由「子串存在」升级为**具体区域 + 语义调用**（合并区必须调用 `mergeManageSkillMarker`、不得再出现直接赋值写法）；M5b 的 `live` 不再手搓 `{ ...startMarker, ...endTerminal }`，改由**渲染端真正调用的那个合并函数**算出；新增 M5c 覆盖失败行。区域夹具的合并区窗口终点由「起点 + 900」改为 `pushIdx` 锚点，且 `pushIdx` 从 `mergeIdx` 之后解析。
- **反向验证两条路径分开实跑**（结论见下表）：路径 A 只让 M3 转红、路径 B 只让共享函数语义相关的断言转红 —— **没有**任何守卫被声称会在它读不到的改动上转红。
- **例数**：`tests/test-ai-skills.js` 172 → 176 → 177；`tests/test-skill-picker-model.js` 99 → 105。既有断言**一条未被放宽或删除**（除 M3 的第三条子串子句与 M5b 的手搓字面量 —— 二者正是本次要消灭的假绿形态，语义已由更强的断言接管）。

## Task Commits

Each task was committed atomically:

1. **Task 1（tracer）: 标记并入的单一实现 —— 共享合并函数 + 渲染端真并入 + 值域行** - `51cb6a1` (feat)
2. **Task 2: 失败态原因码落库与还原（词缀）+ 三态 `promptIncluded` 消费侧收口** - `85fac5f` (feat)
3. **Task 3: 纠正两组假绿守卫（M3 语义化 + M5b 从共享函数推导，含失败行）+ 反向验证** - `5a20fe6` (test)

**Plan metadata:** `docs(49-05): complete 49-05 plan`（最终元数据提交，含 SUMMARY / STATE / ROADMAP）

## Files Created/Modified

- `src/skill-picker-model.js` — 新增纯函数 `mergeManageSkillMarker`（JSDoc 写明单源理由、条件并入语义、不修改入参、零判定面）并加入 api 对象；既有导出键与三张白名单表**零改动**，文件仍零 import / 零 require / 零 DOM
- `src/renderer.js` — `tool_execution_update` 的「已存在条目」分支由条件覆盖改为经 `window.SkillPickerModel.mergeManageSkillMarker` 并入（注释改写为新语义）；新条目分支逐字未动；未新增样式 / 类名 / DOM 结构，未动 `renderSkillContentBox` 与卡片样式
- `ai-manager.js` — 新增 `MANAGE_SKILL_CODE_TAG`；失败出口加词缀（顺序：加词缀 → 写元数据 → throw）；`_manageSkillTerminalFromStored` 还原 `code`（JSDoc 从「无法还原」改写为机制说明 + 三条边界）；成功出口按三态收口（`details` / 短期元数据 / 结果文案）
- `tests/test-ai-skills.js` — 新增 M2c（词缀行为 + 幂等 + 非字符串 code）、M2d（重载还原 + 旧失败行 / 成功行零回归 + 失败行两链路逐字相等）、M2e / M2f（三态消费侧打桩）、M5c（失败行重载同形）；M3 升级为区域 + 语义断言；M5b 改从共享函数推导；`rendererManageRegions()` 的合并区窗口终点改由 `pushIdx` 锚点定界
- `tests/test-skill-picker-model.js` — 新增 C 组 `mergeManageSkillMarker` 值域行 6 例（导出面 / 缺省同一引用 / 浅拷贝 / 覆盖与保留 / 不修改入参 / CR-01 反例）

## Verification（每条 `<verify>` 与自动化门禁的实跑输出）

| # | 命令 / 检查 | 实际输出 | 归属 |
|---|---|---|---|
| 1 | `node --test tests/test-skill-picker-model.js` | `# tests 105 / # pass 105 / # fail 0`（99 → 105） | Task 1 |
| 2 | `node -e '<renderer 合并区源码断言>'` | `merge-wired ok` | Task 1 |
| 3 | `node -e '<mergeManageSkillMarker 行为断言>'` | `merge-helper ok` | Task 1 |
| 4 | `node tests/test-ai-skills.js`（Task 1 时点回归） | `# tests 172 / # pass 172 / # fail 0` | Task 1 |
| 5 | `node tests/test-ai-skills.js`（Task 2 时点） | `# tests 176 / # pass 176 / # fail 0`（172 → 176） | Task 2 |
| 6 | `node -e '<code-roundtrip 区域源码断言>'` | `code-roundtrip wired`（区域 1364 字符） | Task 2 |
| 7 | `node -e '<failure-tag 区域源码断言>'` | `failure-tag wired`（区域 8185 字符） | Task 2 |
| 8 | `node tests/test-ai-skills.js`（Task 3 收尾） | `# tests 177 / # suites 31 / # pass 177 / # fail 0` | Task 3 |
| 9 | `node -e '<guards corrected 门禁>'` | `merge-region 1173` + `guards corrected` | Task 3 |
| 10 | `node --test tests/test-skill-picker-model.js`（收尾回归） | `# tests 105 / # suites 18 / # pass 105 / # fail 0` | Task 3 |
| 11 | `node tests/test-manage-skill.js`（兄弟套件回归） | `# tests 55 / # suites 12 / # pass 55 / # fail 0` | Task 3 |
| 12 | `node --test test/memory/threat-scan.test.js`（扫描层回归） | `# tests 33 / # pass 33 / # fail 0` | Task 3 |

`<fails_when>` 逐条核对：无 `# fail > 0`；`# tests` 由 172 → 176 → 177（严格增长）；`tests/test-skill-picker-model.js` 由 99 → 105；两条源码 / 行为门禁均打印预期标记串。**门禁锚点纪律复核**：`_manageSkillTerminalFromStored(t) {` 取带函数体左花括号的**定义形态**、终点 `_setupEventBroadcasting()` 相对起点解析（该标识符在 `_manageSkillTerminalFromStored` 之前另有定义）；`_buildManageSkillTool() {` 到 `_adaptHarnessTool(` 的相对解析同样成立 —— 三条门禁都在**实现正确时真的通过**。

### 反向验证（Task 3 步骤 5：两条路径**分开**实跑，各自可生产）

两条变异各只改一处、跑完立即 `git checkout -- <file>` 还原（还原后 `git diff --stat` 为空，见「Issues Encountered」）：

| 路径 | 变异 | 实测转红的叶子断言 | 未转红（如实记录） |
|---|---|---|---|
| **A（渲染端接线，验 M3）** | `src/renderer.js` 的合并分支改回覆盖写法 `...(event.manage_skill ? { manageSkill: event.manage_skill } : {})` | `tests/test-ai-skills.js` → `fail 1`：**M3（源码 · 合并分支护栏）新条目映射 manageSkill，且已存在条目分支经共享合并函数并入终态字段**（错误消息逐字为「已存在条目合并分支必须调用跨进程单源的共享合并函数」） | **M5b 与 M5c 仍绿**、`tests/test-skill-picker-model.js` 全绿 —— 它们的 `live` 来自共享函数、读不到渲染端源码；这条路径由 M3 独占 |
| **B（共享函数语义，验 M5b）** | `mergeManageSkillMarker` 改成覆盖语义（`incoming` 非空时直接返回 `{ ...incoming }`，不并入 `prev`） | `tests/test-ai-skills.js` → `fail 3`：**M2d**（失败行两链路逐字相等）、**M5b**（成功行）、**M5c**（失败行）；`node --test tests/test-skill-picker-model.js` → `fail 2`：**「两者都非空 → 同名键 incoming 胜出、异名键两边都保留（契约示例逐字）」**、**「CR-01 反例（本 phase 的靶心）」** | **M3 仍绿**（它只断言渲染端调用了该函数，不断言该函数的语义） |

**未做、也不允许做的声明**：没有任何一条守卫被声称会在它读不到的改动上转红。特别地，**没有**为凑「渲染端回退 ⇒ M5b 也红」而给 M5b 补一条子串断言 —— 那正是本 run 要消灭的假绿形态。

## Decisions Made

- **结论先行（与 frontmatter `key-decisions` 同源）**：并入取 UI-SPEC 硬约束 1 的字面语义并抽成跨进程单源纯函数；否决「把整份 decoration 移进 `_resolveManageSkillTerminal`」（会重复 start 已给的两键、与两时点分工冲突）；失败态原因码取「消息词缀 + 同一常量解析」；词缀写入位置固定在元数据写入之前（保住既有 M2 正则）；词缀正则锚定起始且不加 `/g`；三态消费侧只在 boolean 写键、只在严格 `false` 追加；M3 的旧第三条子串子句删除并由纯函数层的 `merge(prev, null) === prev` 接管；M5b 的「渲染端回退时仍绿」如实记录且不补假绿断言；WR-03 保持挂账、成功文案逐字未改。
- **超预算的显式裁决（计划期已记账，本 run 未变更其结论）**：计划估 `tokens 118000` / 预算 100000（ratio 1.18，`over_budget: true`），三条理由保持成立 —— 0 条校准样本（`confidence: low` 是未校准整估）；两个结构性目标都在范围内（恰 3 个 task、5 个文件）；唯一自然的拆切缝是一条**链**（M5b 必须调用 Task 1 产出的共享函数）而非两条可并行切片。**实测用量 10397 tokens（realized diff chars/4）**：本 run 的实际成本约为估值的 1/11，该偏差按 ADR-2629 的口径如实记账（不向估值靠拢修饰），供后续重估使用。
- 详细理由见 frontmatter `key-decisions`（11 条）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 新增注释让渲染端合并分支超出 M 组夹具的固定 900 字符窗口，M3 的既有断言转红**
- **Found during:** Task 1（`src/renderer.js` 改经共享函数并入之后）
- **Issue:** `rendererManageRegions()` 的合并区窗口原为 `src.slice(mergeIdx, mergeIdx + 900)`（固定长度启发式）。分支本体原 919 字符、新三元表达式起点在 rel 770（余量 130 字符）；本任务按计划重写的注释让 `event.manage_skill` 落到 rel 1189，窗口够不到 ⇒ M3 的后两条子串断言转红（`node tests/test-ai-skills.js` 172 → 171/1）。
- **Fix:** 把渲染端注释改写为与原注释**等长**的表达（覆盖计划要求的四要素：并入而非覆盖的原因、条件并入、单一实现位置、CR-01 的后果），使 `manageSkill:` 落回窗口内（实测 rel 874 / 900）。**未改夹具**：窗口收紧是 Task 3 声明的动作且属 `tests/test-ai-skills.js`（不在 Task 1 的 `<files>` 内），在 Task 1 越界修改会破坏任务的文件面。
- **Files modified:** `src/renderer.js`
- **Verification:** Task 1 之后 `node tests/test-ai-skills.js` 172/172 全绿；两条 Task 1 门禁仍通过
- **Committed in:** `51cb6a1`（Task 1 提交的一部分）
- **后续处置**：Task 3 已按计划把窗口终点改为 `pushIdx` 锚点（`merge: src.slice(mergeIdx, pushIdx)`，实测区域 1173 字符）—— 该隐患根除，不再依赖注释长度。

**2. [Rule 1 - Bug] `mergeManageSkillMarker` 的 `{ ...incoming }` 会让 C 组「不修改入参」用例的写后比对不成立（自查项，已按计划语义实现）**
- **Found during:** Task 1 编写 C 组值域行时
- **Issue:** 计划要求「返回新对象」且「不修改入参」。若直接返回 `incoming` 本身，调用方后续改动会串到事件载荷上。
- **Fix:** 按计划语义实现为**浅拷贝**（`{ ...incoming }`），并在 C 组加一条「改返回值不得串到事件载荷」的断言（`out.tier = 'tampered'` 后 `incoming.tier` 仍为 `'managed'`）—— 把「浅拷贝」从实现细节升级为被断言的行为。
- **Files modified:** `tests/test-skill-picker-model.js`
- **Verification:** `node --test tests/test-skill-picker-model.js` → 105/105；路径 B 变异下该组转红 2 条
- **Committed in:** `51cb6a1`（Task 1 提交的一部分）

### 计划内部张力的调和（非偏离，如实记录）

**3. 「失败行键集合逐字相等」这条用例在计划里被同时列在 Task 2 与 Task 3**
- 计划的 Task 2 `Artifacts` 表列出 `test case | 失败行实时 / 重载键集合逐字相等行`，Task 2 的 `acceptance_criteria` 也要求「失败行的实时 / 重载两条链路 `Object.keys().sort()` 与取值逐字相等」；而 Task 3 的步骤 4 又要求「M5b 补失败行」做同一件事。
- **处置**：Task 2 把该断言作为 **M2d 的一部分**（同一重载夹具内完成「还原 code」+「两链路逐字相等」两件事，满足 Task 2 的验收标准）；Task 3 落成**独立用例 M5c**（专门的重载同形失败行守卫，`live` 由共享合并函数推导）。两处判据同源、无第二份实现。

**4. Task 3 的 `# tests` 增长要求与「M5b 内补失败行」的表述张力**
- Task 3 的 `<verify>` 要求「`# tests` 不大于 Task 2 结束时的例数 ⇒ 失败行没被加进 M5b」，但把失败行写进同一个 `test('M5b…')` 内不会产生例数增长。
- **处置**：失败行落成**同组新用例 M5c**（与 M5b 共用 `manageReloadCtx` 夹具与「共享函数 vs 重载重建」判据），既满足「失败行并入重载同形守卫」，也满足「例数严格增长」（176 → 177）。

---

**Total deviations:** 2 auto-fixed（Rule 1 各一条：夹具窗口贴边导致的既有断言转红、浅拷贝语义的断言升级）+ 2 条计划内部张力的调和（无双份实现、无范围蔓延）。**无 Rule 3、无 Rule 4** —— 本计划未新增依赖（明确未引入 `yaml` 等任何包）、未触碰架构决策面、未改 `LIMITS` 数值与九码值域。
**Impact on plan:** 全部落在本计划已声明的 5 个文件内。**未改动** `src/skill-picker-model.js` 的既有导出语义与三张白名单表、`renderSlashPickerList` / `renderSkillContentBox` / 卡片样式、`_resolveManageSkillTerminal`（实时链路）、`MANAGE_SKILL_ERROR` 值域、`LIMITS` 任何数值、成功文案（WR-03 挂账）。

## Issues Encountered

- **变异测试的锚点必须唯一且可断言命中数**：两条反向验证都用 `node -e` 脚本以**完整块字面量**做替换并先断言命中数恰为 1（`s.split(oldBlock).length - 1 !== 1` 即中止且不写盘）。这是 49-04 记录的同一纪律（裸串替换会误伤注释里的同名文本）在本计划上的复用。
- **还原是逐字还原且已复核**：两条路径跑完均用 `git checkout -- <file>` 还原，随后 `git diff --stat -- <file>` 输出为空（Task 1 的两处文件已提交，故还原到 HEAD 即逐字等价）；还原后 `ai-manager` require 正常、四套件全绿。
- **`state advance-plan` 的计数器滞后（既有环境问题，非本计划引入）**：该 handler 的计数口径与本阶段已落盘的 SUMMARY 数不一致（49-04 执行期已手工订正过一次）。本 run 按其输出与磁盘实况逐项核对后按权威计数（`.planning/phases/49-manage-skill-ai/` 下 5 份 SUMMARY）订正 `Current Position`，并在该行注明权威来源；`progress.completed_plans` 由 handler 正确算出。
- 其余无。任务全程未走认证门禁，未遇到阻塞；未使用 `--no-verify`；提交前均核对 `git status --short` 只暂存本任务声明的文件（工作树里 `AGENTS.md` / `.gitignore` / `.planning/state.json` 的既有未提交改动与三处未跟踪路径**全程未被触碰**）。

## User Setup Required

None - no external service configuration required.

## Known Stubs

None —— 本次改动的五个文件内不存在「硬编码空值流向 UI / 占位文案 / 未接线的数据源」。对五个文件跑 `grep -nE "TODO|FIXME|coming soon|not available|placeholder"` 的命中项**全部**是既有代码（DOM `placeholder` 属性与 `fill_form` 工具描述里的「placeholder」一词，行号 557 / 4762 / 4766 / 2789 / 5038 / 9456–9463 / 13333–13376），**零项由本计划引入**；本计划新增的代码行内无任何债务标记。

另外确认：`MANAGE_SKILL_CODE_TAG` 是模块级常量（未导出）；`mergeManageSkillMarker` 是**唯一新增的导出键**，三张 `MANAGE_SKILL_*` 白名单表与 `TIER_BADGE` / `STATUS_TEXT` 取值逐字未变。

## Threat Flags

None —— 本计划未引入 `<threat_model>` 之外的新安全相关面。逐条对照：T-49-05-01（标记并入被篡改）由跨进程单源纯函数 + M3 区域语义断言 + 反向验证路径 A 缓解；T-49-05-02（失败态原因码不落库 ⇒ 不可否认性）由锚定起始的词缀 + 同一常量解析 + 旧消息不设键的边界行缓解；T-49-05-03（三态被合并回一句 ⇒ 欺骗）由 M2e / M2f 两条打桩路径缓解；T-49-05-04（词缀的信息披露面）按 `accept` 处置且实测只含白名单原因码、不扩大回显面；T-49-05-05（渲染端注入面）实测合并区 `innerHTML: false`、`filePath|seededNames|managed-skills: false`，新增插值面全部是 `textContent` / DOM 属性赋值，**未扩大 TD-48-01**；T-49-05-06（`_manageSkillMeta` 残留）按 `accept` 处置且读后即删语义逐字不变（M2b 继续为真）；T-49-05-SC 无包管理器安装面。

## Deferred Items（记录、不在本计划处置）

1. **WR-03（成功文案偏离 UI-SPEC 唯一权威清单）**：三处成功文案逐字未改（本 run 明确不在范围）。M2f 的断言逐字复用既有文案，正是为了证明「未顺手改写」——它一旦被改，该断言即转红。
2. **失败消息词缀这一可见面变化需成文（归 49-06）**：`docs/product/ai-skills.md` 应记录「失败态消息带 `[code] ` 前缀（同一条消息既进 `tool_results` 也回给 LLM）」及其只增不改的性质。本计划**不声称**该文档面已落。
3. **`AGENTS.md` 的技能测试清单计数已过期**（当前行仍写 172 例，实为 177；另有 105 / 55 / 33）。该文件在工作树里带有**与本计划无关**的未提交改动，按仓库卫生约束本 run 未触碰 —— 归 49-06 或阶段收尾一并订正。
4. **IN-01（死代码 `madeDir`）/ IN-02（`unknown` 无短原因、非法 action 标成 `invalid_name`）/ IN-03（空 content 标注为「描述不合法」）/ IN-04（第三张白名单表缺值域测试）/ IN-05（`_manageSkillMeta` 的运行被拆解时残留）/ IN-06（卡片参数区显示原文描述而文件存净化值）** 与 **WR-04（净化类未覆盖 bidi 控制符）** —— 均不在本 run 范围，保持挂账（其中 IN-02 与 IN-05 已由本计划 `<threat_model>` 的 `accept` 显式覆盖）。
5. **`49-VALIDATION.md` 人工五步表的复核时机**：步骤①（卡片终态视觉面）在 CR-01 修复**之前**必然失败，**本计划落地后已具备通过条件**（终态标记不再被覆盖、`manageSkillOk` 可成立）—— 该人工观察应在**本计划之后**执行。本计划不修改 `49-VALIDATION.md` 的步骤表（期望现象本身没错，错的是执行时机）。步骤⑤（最小宽度单行不换行）仍是 backstop 级视觉裁决，本计划不为它提供自动化证据。

## Next Phase Readiness

- **本计划之后**：`tool_execution_end` 到达时卡片技能变体不再崩塌（标题 / 徽标 / 内联标注 / 参数摘要 / 正文折叠块按 UI-SPEC 契约渲染），失败历史卡片保留短原因；`49-VALIDATION.md` 的人工五步可以开始执行（步骤① 已具备通过条件）。
- 两条链路的标记形状由 `_buildManageSkillDecoration` 单一构造 + 共享合并函数共同保证；后续若要改两时点分工，**必须**同时改 `mergeManageSkillMarker` 的契约与 C 组值域行，否则路径 B 会转红。
- Phase 50（设置页技能管理区）与 Phase 51（zip 导入管线）可继续复用：`ai-skills-manager.js` 的三态 `getSkillPromptIncluded`（消费侧口径已收口）、`MANAGE_SKILL_CODE_TAG` 的「单一持久化通道」模式（失败态若要机器可读原因码，走同一套 encode/decode）。
- **发布前必办（沿用既有台账，本计划未改变）**：生产包 `/Applications/Realm.app` 仍是 2026-09-10 构建，正式发布前必须重跑 `make install`。

---
*Phase: 49-manage-skill-ai*
*Completed: 2026-09-13*

## Self-Check: PASSED

**1. Modified files exist:**
```
FOUND: ai-manager.js
FOUND: src/renderer.js
FOUND: src/skill-picker-model.js
FOUND: tests/test-ai-skills.js
FOUND: tests/test-skill-picker-model.js
FOUND: .planning/phases/49-manage-skill-ai/49-05-SUMMARY.md
```

**2. Commits exist:**
```
FOUND: 51cb6a1
FOUND: 85fac5f
FOUND: 5a20fe6
```

**3. 声明的符号存在且位置正确：**
```
skill-picker-model.js: mergeManageSkillMarker 已加入 api 对象且可 require（零 DOM / 零依赖未破）
renderer.js:  合并区含 mergeManageSkillMarker( 且不再含 manageSkill: event.manage_skill
ai-manager.js: MANAGE_SKILL_CODE_TAG 在 encode（失败出口幂等判定 / 改写）与 decode（_manageSkillTerminalFromStored）两侧均被引用
```

**4. `commits:` 为实测值**（来源：`$(git rev-parse --git-dir)/gsd-plan-head-before-49-05` = `e04fa47d055de93616cbb27e1305b714985a414f`）：
```
git rev-list --count e04fa47d..HEAD  →  3
```

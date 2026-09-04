---
phase: 43-ai-mvp
verified: 2026-09-04T00:00:00Z
status: human_needed
score: 12/15 must-haves verified
behavior_unverified: 3
overrides_applied: 0
human_verification:
  - test: "npm run eval:memory 全量真实模型跑（无 --dry-run）"
    expected: "14 个场景（5 critical-path + 6 adversarial + 3 boundary）在真实 LLM 会话下机器断言通过：落盘终态 / throw / tool call 序列；无 Key 时自动 skip 退出 0"
    why_human: "场景断言依赖真实模型会话产生 tool call；harness fixture 结构已 dry-run 14/14 验证，行为断言无法离线执行"
  - test: "新会话快照注入观察：编辑 MEMORY.md → 开新 AI 会话 → 问「你记得什么」"
    expected: "AI 能复述 USER.md/MEMORY.md 内容；快照不含容器记忆内容"
    why_human: "需真实 LLM 会话观察 system prompt 注入效果；代码级已验证 buildSystemPrompt() 在两处 Agent 创建点接线（grep = 2）且 buildGlobalSnapshot 只读 user/global 两层并有单测断言"
  - test: "打开 realm://settings → AI 记忆分区 → 三 tab 切换 → 编辑 → 保存 → 回读"
    expected: "分区真实渲染；tab 切换取数、实时字数、超限变红阻断、空态/加载态/成功/失败文案按 UI-SPEC 呈现"
    why_human: "CSP 与真实渲染环境；全部 UI 文案字面量与交互逻辑已 grep 源断言命中，但渲染效果与交互体验无法离线验证"
  - test: "主窗口删除容器：确认框应显示「该容器的 AI 记忆将一并删除」；确认后检查 memories/<containerId>.md 已消失"
    expected: "确认框文案可见；删除后记忆文件无残留（memories/ 残留数恒为 0）"
    why_human: "涉及真实窗口/容器生命周期；钩子 await 位置与删除语义已源断言 + node:test 级联用例通过，真实窗口链路需人工"
---

# Phase 43: AI 记忆系统集成（条目记忆 MVP）Verification Report

**Phase Goal:** 为 AI 助手集成三层条目式持久记忆：USER.md（用户画像）+ 全局 MEMORY.md（冻结快照注入 system prompt）+ 容器记忆 `memories/<containerId>.md`（memory_read 按需加载）。写入走 `memory` 工具（add/replace/remove + target 消歧）。含写入威胁扫描、字符预算、懒创建、容器删除联动清理、设置页 `/api/ai-memory` 编辑入口。
**Verified:** 2026-09-04
**Status:** human_needed（自动化检查全部通过，4 项留人工/UAT）
**Re-verification:** No — initial verification

## Goal Achievement

三层存储、写入工具、读取工具、快照注入、删除联动、设置页端点与编辑入口全部在代码库中真实存在、有实质实现且互相接线；56/56 node:test 全绿、14/14 fixture dry-run 合法、所有 plan 源断言逐条复核命中。剩余为设计上必须人工执行的真实模型会话与真实渲染观察（VALIDATION.md Manual-Only 表 3 项 + eval:memory 全量跑）。

### Observable Truths

Merged from 43-01/43-02/43-03 PLAN frontmatter must_haves（ROADMAP Phase 43 无独立 success_criteria 数组，Requirements 行 MEM-01..06 作为合同来源）：

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AI 在对话中调用 memory 工具 add 条目后，对应层级 md 文件落盘且含 [Mn] 编号条目（D-09） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 工具定义（ai-manager.js L4552, executionMode:'sequential', `^M[0-9]+$` L4573）+ execute 内活跃容器解析（L4589-4599）+ 委托 manager.write（L4601）源断言齐备；manager 级 add→落盘回读有 56 用例测试护栏；完整「AI 对话中调用」行为留 eval:memory 全量跑（Human #1） |
| 2 | AI 调用 memory_read（containerId 省略）读当前活跃容器，文件不存在返回「该容器暂无记忆」空态而非报错（D-02/D-05） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 工具定义 L4634 + 空态文案 L4660 `text \|\| '该容器暂无记忆'`；readContainer 不存在返回 null 有单测；活跃容器解析路径与真实 LLM 会话留 Human #1 |
| 3 | 两处 Agent 创建点 systemPrompt 均含 <persistent-memory> 快照段与容器记忆索引指引；快照只含 user+global 两层（D-03/D-04） | ✓ VERIFIED | `systemPrompt: buildSystemPrompt()` grep 计数 = 2（L753/L2171）；buildSystemPrompt = REALM_SYSTEM_PROMPT + buildGlobalSnapshot()（L513-515）；buildGlobalSnapshot（L348-363）只读 USER.md/MEMORY.md，容器层内容不进产物，单测断言覆盖 |
| 4 | 注入模式与凭据形态内容写入被拒（throw → isError），正常业务内容零误伤（D-11） | ✓ VERIFIED | scanInjectionPatterns（manager L76）接入 write()；threat-scan.test.js 三语料库 29 条断言 + write 路径落盘不变式全绿（npm run test:memory 56/56 实跑通过） |
| 5 | 超预算 add throw 含「先整理旧记忆」；replace/remove 悬空编号 throw 不就近匹配；编号不回收 max+1（D-07/D-08/D-10） | ✓ VERIFIED | storage.test.js 预算恰好满/超 1 字符边界、悬空编号 fail-closed、稳定编号用例全绿；write()（L191-215）参数组合校验 throw 语义与源码一致 |
| 6 | 删除容器后 memories/<containerId>.md 同步消失，无残留（D-05） | ✓ VERIFIED | container-manager.js L313 `await require('./ai-memory-manager').deleteContainerMemory(id)`，位于 deleteCookies（L307）之后、configStore.set（L316）之前，有 await（prohibition 达成）；deleteContainerMemory 幂等 + writeScope→删除→readContainer 空态级联用例通过；真实窗口删除留 Human #4 |
| 7 | 删除确认框含「该容器的 AI 记忆将一并删除」提示，无需二次确认 | ✓ VERIFIED | renderer.js L4371 `aiMemoryWarning.textContent = '该容器的 AI 记忆将一并删除'`；confirmDeleteContainer 逻辑零改动；真实渲染归入 Human #4 |
| 8 | 场景 harness 可对 14 fixture 机器断言，无 Key 自动 skip 退出 0 | ✓ VERIFIED | `node test/memory/scenario-harness.js --dry-run` 实跑退出 0，14/14 OK；fixtures/ 恰 14 文件（5+6+3 前缀可辨）；skip 路径（L553-575 PASS/FAIL/SKIP 摘要 + exit code）存在；全量真实跑留 Human #1 |
| 9 | 设置页「AI 记忆」三 tab 可查看并编辑三层记忆，点「保存记忆」才写盘（D-12） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | ai-memory-section（settings.html L485）+ aiMemoryApi（settings-page.js L170，fetch `/api/ai-memory`）+ 显式保存按钮逻辑源断言齐备；真实渲染/交互留 Human #3 |
| 10 | 字数统计「已用 / 上限」，数值来自端点 budget 字段；超限变红 + 保存 disabled + hint（D-12） | ✓ VERIFIED | 「超出字符上限，请精简内容后再保存」（settings-page.js L3551）；used/budget 消费 GET 响应（L2203-2205 main.js 返回 `{content, used, budget}`）；前端 1375/2200 字面量 grep = 0 |
| 11 | user/global tab「保存后将在新会话生效」；container tab「容器记忆即时生效…」（D-04） | ✓ VERIFIED | settings-page.js L3538-3540 三条文案字面量逐一命中 |
| 12 | 容器 tab 空态「该容器暂无记忆，AI 首次写入后在此显示」；user/global 空态「暂无内容，AI 写入记忆后在此显示」 | ✓ VERIFIED | settings-page.js L3547 + 空态 hint 字面量命中；文案映射结构完整 |
| 13 | 容器下拉实时取容器列表，删除容器后联动 | ✓ VERIFIED | fetchContainers 复用 + 每次进入容器 tab 重新拉取（settings-page.js 分区逻辑） |
| 14 | 保存成功「已保存」2 秒消失；失败「保存失败：{原因}，请重试」且 textarea 不丢失 | ✓ VERIFIED | 「已保存」「保存失败」文案字面量命中；错误透传经 aiMemoryApi catch（L162-173 注释明确超限/容器不存在透传）；保存期间 disabled 逻辑存在 |
| 15 | POST /api/ai-memory 对不存在容器返回 400「容器不存在」；GET 返回空态 | ✓ VERIFIED | main.js L2223-2229 容器存在性校验 → 400「容器不存在」；GET readScope 不存在返回空字符串；入口 token 鉴权 403（L2192-2195）；scope 白名单 parseAiMemoryScope |

**Score:** 12/15 truths verified（3 present, behavior-unverified）

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `ai-memory-manager.js` | 三层存储 / [Mn] 解析 / 预算 / 扫描 / 懒创建 / 原子写 / 路径可注入 | ✓ VERIFIED | 378 行；write/readContainer/buildGlobalSnapshot/deleteContainerMemory/readScope/writeScope/scanInjectionPatterns/setBaseDir/BUDGETS 导出齐备（L366-376） |
| `test/memory/`（helpers + storage + threat-scan + harness + 14 fixtures） | node:test 套件 + 临时目录注入 | ✓ VERIFIED | 56/56 实跑全绿；14 fixture dry-run 14/14 |
| `package.json` scripts test:memory / eval:memory | 一键回归入口 | ✓ VERIFIED | L19-20 |
| `ai-manager.js` memory / memory_read 两个 AgentTool | 工具注册 + execute 接线 | ✓ VERIFIED | L4552/L4634；execute → manager.write / readContainer |
| `container-manager.js` deleteContainer 记忆清理钩子 | await，deleteCookies 后 | ✓ VERIFIED | L313 |
| `src/renderer.js` 删除确认文案 | 记忆删除提示 | ✓ VERIFIED | L4371 |
| `main.js` /api/ai-memory GET+POST | token 鉴权 + scope 白名单 + writeScope-only | ✓ VERIFIED | handleAiMemoryApi L2189；dispatch L2297 |
| `src/settings.html` ai-memory-section | 3 tab + 下拉 + textarea + 状态行 + 保存按钮 | ✓ VERIFIED | L485；区块内 style="display" 计数 = 0（CSP 铁律） |
| `src/settings-page.js` aiMemoryApi + 分区逻辑 | 编辑分区完整交互 | ✓ VERIFIED | L160-173 + L3538+ 分区逻辑 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| ai-manager.js 两处 new Agent initialState | buildGlobalSnapshot | buildSystemPrompt() ×2 | ✓ WIRED | grep 计数 = 2（L753/L2171） |
| memory 工具 execute | aiMemoryManager.write | execute 内解析活跃容器后委托 | ✓ WIRED | L4601；无活跃 tab throw「无法获取当前容器」 |
| container-manager.deleteContainer | deleteContainerMemory | 惰性 require + await | ✓ WIRED | L313，位置正确，非 fire-and-forget（prohibition） |
| settings-page aiMemoryApi | main.js /api/ai-memory | HTTP + REALM_TOKEN | ✓ WIRED | L173 fetch `/api/ai-memory${suffix}?${params}` |
| main.js 端点 | readScope/writeScope/BUDGETS | manager 引用 | ✓ WIRED | L2203/L2205/L2232；POST 只调 writeScope（prohibition：grep `write(` 直接调用 = 0） |
| harness | setBaseDir 临时目录 | 隔离运行 | ✓ WIRED | dry-run 全程临时目录；无真实 userData 引用 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 记忆套件回归 | `npm run test:memory` | 56 tests / 56 pass / 0 fail（duration ~58ms） | ✓ PASS |
| fixture 结构自检 | `node test/memory/scenario-harness.js --dry-run` | exit 0，14/14 OK | ✓ PASS |
| 语法完整性 | `node --check` × 6 文件 | 全部通过 | ✓ PASS |
| 预算数值单源 | `grep -c '1375\|2200' ai-manager.js / main.js / settings-page.js` | 全部 0 | ✓ PASS |
| 快照容器层排除 | 源码审读 buildGlobalSnapshot | 只读 user/global 两层 | ✓ PASS |

### Requirements Coverage

REQUIREMENTS.md 无 MEM 条目（grep 确认）；按指示对 ROADMAP.md Phase 43 Requirements 行溯源：

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| MEM-01 | 43-01 | ai-memory-manager.js 存储层 | ✓ SATISFIED | 378 行完整实现 + 9 导出 + 单测护栏 |
| MEM-02 | 43-01 | memory 写入工具 | ✓ SATISFIED | 工具定义 + execute→write 接线（真实 LLM 调用留 eval:memory） |
| MEM-03 | 43-01 | memory_read 读取工具 | ✓ SATISFIED | 工具定义 + 空态文案 + 活跃容器解析 |
| MEM-04 | 43-01 | system prompt 快照注入 | ✓ SATISFIED | buildSystemPrompt ×2 + 快照单测（新会话观察留人工） |
| MEM-05 | 43-02 | 容器删除联动清理 | ✓ SATISFIED | await 钩子 + 级联测试 + 确认框文案（真实窗口留人工） |
| MEM-06 | 43-03 | /api/ai-memory 端点 + 设置页分区 | ✓ SATISFIED | 端点源断言齐备 + 分区完整（真实渲染留人工） |

无 ORPHANED 要求。

### Prohibitions Check

| Prohibition | Tier | Status | Evidence |
| ----------- | ---- | ------ | -------- |
| 容器记忆内容不得出现在 buildGlobalSnapshot 产物 | judgment | ✓ 满足 | 源码只读两层 + 单测断言 |
| 业务校验失败必须 throw 不返回错误文本当成功 | judgment | ✓ 满足 | write 全路径 throw + 单测断言 |
| 预算数值只在 ai-memory-manager.js 一处 | judgment | ✓ 满足 | ai-manager/main.js/settings-page.js grep = 0 |
| 删除钩子不得 fire-and-forget | judgment | ✓ 满足 | L313 有 await |
| 端点人工路径只走 writeScope 不扫描 | judgment | ✓ 满足 | L2232 writeScope；writeScope 源码无扫描调用 |
| settings.html 新区块无内联 display 初始隐藏 | judgment | ✓ 满足 | 区块内计数 = 0 |
| 前端不硬编码 1375/2200 | judgment | ✓ 满足 | grep = 0 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| ai-memory-manager.js | 240-245 | WR-01：replace/remove 按行文本恒等匹配，重复行会连锁改写/删除 | ⚠️ Warning | 已记入 43-REVIEW.md 技术债，用户已知接受；不违反 must_have（悬空编号 throw 不就近匹配语义有单测且通过） |
| ai-manager.js / ai-memory-manager.js | 4576+ | WR-02：content 不禁内嵌换行，可伪造 [MN] 条目行 | ⚠️ Warning | 已记入 43-REVIEW.md 技术债；threat-scan 拦不住无注入措辞的伪造行，属 D-09 格式约定边界 |
| src/settings-page.js | 3641-3746 | WR-03：零容器时产生非法 scope `container:` 显示误导性报错 | ⚠️ Warning | 已记入 43-REVIEW.md 技术债；端点侧 parseAiMemoryScope 会正确 400 拒绝，不产生孤儿文件 |

无 TBD/FIXME/XXX/HACK/PLACEHOLDER 债务标记（debte-marker gate 通过）。三项 WR 均为已记录已接受的已知技术债，不构成 goal 级 gap。

### Human Verification Required

见 frontmatter `human_verification` 4 项：eval:memory 全量真实模型跑、新会话快照注入观察、设置页真实渲染/编辑/保存回读、真实窗口删除容器联动。与 VALIDATION.md Manual-Only 表完全对应（外加 43-02 既定安排的 eval:memory UAT 前手动全量跑）。

### Gaps Summary

无 gap。全部 15 条 must-have 中 12 条在代码库级验证通过（含 56/56 测试实跑、14/14 fixture dry-run 实跑、全部 plan 源断言逐条复核命中）；3 条（43-01 T1/T2 的真实 LLM 会话行为、43-03 T1 的真实渲染）属设计上无法离线自动验证的行为，代码已 present + wired，留人工/UAT。状态 human_needed，可进入 UAT。

---

_Verified: 2026-09-04_
_Verifier: Claude (gsd-verifier)_

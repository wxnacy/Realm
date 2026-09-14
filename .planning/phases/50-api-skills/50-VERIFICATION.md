---
phase: 50-api-skills
verified: 2026-09-14T15:40:50Z
status: gaps_found
score: 18/22 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/50-api-skills/50-01-PLAN.md
  - .planning/phases/50-api-skills/50-01-SUMMARY.md
  - .planning/phases/50-api-skills/50-02-PLAN.md
  - .planning/phases/50-api-skills/50-02-SUMMARY.md
  - .planning/phases/50-api-skills/50-03-PLAN.md
  - .planning/phases/50-api-skills/50-03-SUMMARY.md
  - .planning/phases/50-api-skills/50-04-PLAN.md
  - .planning/phases/50-api-skills/50-04-SUMMARY.md
  - .planning/phases/50-api-skills/50-05-PLAN.md
  - .planning/phases/50-api-skills/50-05-SUMMARY.md
  - AGENTS.md
  - ai-manager.js
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - ipc-handlers.js
  - main.js
  - src/preload.js
  - src/settings-page.js
  - src/settings.html
  - src/skill-picker-model.js
  - src/styles/main.css
  - tests/test-ai-skills.js
  - tests/test-manage-skill.js
  - tests/test-skill-picker-model.js
  - tests/test-skills-http-api.js
  - tests/test-skills-management.js
covered_digest: "v1:sha256:43dd264dc4faef99d63ac97cce5ab03d8b79d1cda0aac9f95b21a6a384fa793c"
behavior_unverified: 3
overrides_applied: 0
gaps:
  - truth: "counts-parity（5 套件版）通过：每个套件名在两个账本文件里都有账本单元、且每个单元的例数与实测逐字一致"
    status: failed
    reason: "hotfix 5ff0474 把 tests/test-skills-management.js 从 47 例扩到 49 例（CR-01/WR-01/WR-04 的三条回归用例），但**四个账本单元未同步刷新**。门禁在当前树上确定性转红（实测 cells=16，4 个单元报 47 != 49）。阶段收尾期 50-05 的「counts-parity 转绿」声明在 hotfix 之后不再成立。"
    artifacts:
      - path: "AGENTS.md"
        issue: "第 330 行测试清单单元：`test-skills-management.js`（…，47 例）—— 实测 49 例"
      - path: "docs/product/ai-skills.md"
        issue: "第 104 / 545 / 681 行三处账本单元均写 47 例 —— 实测 49 例"
      - path: ".planning/phases/50-api-skills/50-VALIDATION.md"
        issue: "第 76 行 Wave 0 Requirements「现 **47 例**」与第 131 行「收口实测 …\"test-skills-management.js\":\"47\"」同样陈旧（不在门禁扫描范围，但属同一份账本契约）"
    missing:
      - "把 AGENTS.md:330、docs/product/ai-skills.md:104/:545/:681 四处账本单元的 47 改为 49"
      - "同步 50-VALIDATION.md:76 与 :131 的两处记载"
      - "改后重跑 counts-parity 命令，确认输出 `counts-parity ok`（不再是 4 条 FAIL）"
behavior_unverified_items:
  - truth: "[E5] 启停开关在途时立即乐观翻转 `.on` / `aria-checked` 并置 `disabled`，失败 ⇒ 回滚 `.on` / `aria-checked`、解除 `disabled`、区级 hint"
    test: "在设置页连点两个技能的启停开关；一次让请求成功、一次制造后端 400（例如先手改 URL 卸载该技能），观察开关状态与失败回滚"
    expected: "点击瞬间开关乐观翻转并进入在途态；成功保持；失败必须回滚到点击前的状态并解除 disabled，区级 hint 给出按 code 查表的文案"
    why_human: "这是状态迁移（乐观翻转 → 回滚），符号存在 + 源码扫描不能证明回滚路径真的执行。本仓无 DOM 测试环境，settings-page.js 的运行时行为全部只能做源码扫描；REVIEW 的 WR-02 就是本类行为上的真实缺陷（`sw.disabled = true` 在 await 之前设置导致 Chromium blur，JSDoc 与用例的声明与实际相反）—— 恰好证明该面存在presence 检查看不见的缺陷。"
  - truth: "[E8] 卸载确认弹框：确认后按钮置 `disabled` 且弹框保持打开直到响应到达；失败 ⇒ 关闭弹框 + hint(danger)；`not_found` 时额外触发一次列表重拉"
    test: "对一条 user 技能点「卸载」→ 在响应返回前观察按钮与弹框；再制造一次失败（请求期间从盘上删掉该目录，或制造 400）观察弹框闭合与 hint"
    expected: "响应到达前弹框保持打开且「卸载」按钮为 disabled；失败时弹框关闭、行内状态不变并给出 danger hint；`not_found` 时该行随重拉自然消失"
    why_human: "同为状态迁移（在途 → 终态 + 条件重拉），纯 Node 无 DOM，源码扫描只能证明形状存在、不能证明时序。"
  - truth: "[E5 backstop] 设置页最小可用窗口（800px）下最宽形态的行首行保持单行不换行、右对齐簇不被裁切"
    test: "`npm run dev` → 把窗口缩到最小（800px）→ 打开设置页「技能管理」区，构造一行同时命中诊断徽标 + 「已遮蔽」状态标注 + 开关 + 卸载按钮"
    expected: "每行首行**单行**且右侧操作簇完整可见（不被裁切、不与描述重叠、头部高度不变），仅技能名缩到省略号（`title` 仍可读全名）"
    why_human: "该 truth 的 `verification` 标记为 `backstop`（非可推断）：无显式证据时必须弃权。行盒度量需要真实渲染引擎，纯 Node 无法度量。"
human_verification:
  - test: "设置页在 `realm://` CSP 下加载 `skill-picker-model.js`"
    expected: "DevTools 断言 `window.SkillPickerModel` 存在，且两个空态分支按 `refreshedAt`（=== 0 / > 0）而非「数组为空」判定"
    why_human: "CSP `script-src 'self'` 下的真实加载行为跑不到；代码面已由源码扫描覆盖（脚本在列且序在 `settings-page.js` 之前），运行期表现属人工（research A3）"
  - test: "未配置任何 AI provider 时仍能列出随包内置技能（D-19 的验收面）"
    expected: "打开设置页「技能管理」区，**两个内置技能在列**且 `refreshedAt > 0`，不出现「技能列表尚未加载」"
    why_human: "端到端呈现依赖真实 `AIManager` 实例 + `configStore` 的组合状态与真实播种目录；纯 Node 单测只能证读路径初始化的分流与恰一次重扫（已证），真机呈现须人工"
  - test: "打包态（`make install` 产物）列出内置技能"
    expected: "`/Applications/Realm.app` 打开设置页，内置技能组列出两个技能；播种失败时顶部汇总条须给出 `realm_*` 诊断，不得静默为空"
    why_human: "`asarUnpack` + `app.isPackaged` 的路径分支只在正式产物上生效，`npm run dev` 覆盖不到"
  - test: "禁用后在 `/` 面板的可见性（跨进程半边）"
    expected: "禁用某技能 → 同一会话打开 `/` 面板，断言该技能不在列表；重新启用即恢复"
    why_human: "单测只能证投影 `disabled: true` + 面板过滤跳过；真实 `/` 面板渲染不可单测"
  - test: "多窗口 / 多设置页实例间即时同步"
    expected: "开两个设置页标签，在 A 禁用某技能 → 回 B **手动重进该页**，列表已同步（**不**断言 A 改动后 B 即时刷新）"
    why_human: "`windowManager.broadcast` 只发到各 BrowserWindow 的 webContents、不到 webview guest；多开之间不做即时同步是 D-18 的**设计**，须人工确认该边界如实呈现"
  - test: "413 拒收探针在 **Electron 内**复跑（research A4）"
    expected: "`npm run dev` 后在渲染进程 DevTools 向 `/api/skills/set-disabled` POST 一个 > 1 MiB 的 body，断言 413 + JSON 且主进程堆不线性增长"
    why_human: "自动用例跑在系统 Node v22.22.0，运行时是 Electron 43.6.0 / Node 24.20.0；本仓有「依赖 Node 行为的结论必须在运行时内复跑」纪律"
  - test: "100 条技能时的渲染耗时、滚动密度与管理投影字节数（research A6）"
    expected: "造 100 条技能（描述取上限）→ 打开设置页，记录首次渲染耗时与滚动流畅度，并在 DevTools 量 `/api/skills/list` 响应体字节数"
    why_human: "纯 Node 无 DOM 且无浏览器端测试基建；投影不含正文是结构性依据，但 ~200 KB 上界是估值、未经实测"
---

# Phase 50: 设置页技能管理区 + `/api/skills/*` Verification Report

**Phase Goal:** 用户可在设置页看到全部技能的名称 / 描述 / 来源 / 体积 / 文件数 / 诊断，并启用、禁用、卸载自己的技能。
**Verified:** 2026-09-14T15:40:50Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## 结论摘要（先读这一段）

**路线图的 5 条 Success Criteria 全部在代码上成立** —— 功能面没有发现缺失或假实现。CR-01 的 critical 修复经**独立探针**（不依赖测试套件）确认真实生效：`name: "."` / `".."` / `"../escape"` 一律 `invalid_name`，`agent-workspace/` 与 `ai-memory/` 完好，合法 user 技能仍能正常卸载。SEC-09 的 413 体积闸同样**从 `main.js` 抽取真实源码**跑真 http 服务器验证通过。

**唯一 gap 是文档账本漂移**：hotfix `5ff0474` 把 `tests/test-skills-management.js` 从 47 例扩到 49 例，但没有同步四个账本单元，导致阶段自己声明的 `counts-parity` 门禁在当前树上**确定性转红**（我实跑复现：`cells=16`，4 个单元报 `47 != 49`）。这不是功能缺陷，但它是 50-05 明文声明为「通过」的 must-have，且在交付树上不成立 —— 按判据必须记为 gap 而非放过。修复成本是改 6 个数字后重跑门禁。

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | [SC-1] 设置页 AI 分区出现「技能管理」区，逐条列出名称 / 描述 / 来源 / 体积 / 文件数 / 诊断 | ✓ VERIFIED | `src/settings.html:536` 区外壳 + `#skillManageState` / `#skillManageGroups` / `#skillManageSummary` / `#skillManageHint`；`src/settings-page.js:4963 buildSkillManageRow()` 逐项落 DOM（名称 `:4975`、来源徽标查 `TIER_BADGE` `:4981`、描述 `:5044`、`bytes · fileCount` 或「统计不可用」`:5052`、状态标注 `:5017`、诊断徽标 `:5012`）。六项齐备 |
| 2 | [SC-2] 启停单个技能：禁用只过滤不删文件、不进 system prompt 与 `/` 列表，重新启用即恢复 | ✓ VERIFIED | `ai-manager.js:1628 setSkillDisabled()` 同步读-改-写 `settings.aiSkills.disabled`（不触碰磁盘）；`ai-skills-manager.js` 重扫管线 ⑤ 打 `disabled` 标记；`filterPickerItems` 跳过 `disabled === true`。跨进程 `/` 面板**渲染**部分在人工验证清单 |
| 3 | [SC-3] 卸载仅允许 `source === 'user'`；内置 / 托管技能的卸载请求被拒（手改 URL 亦然） | ✓ VERIFIED | `ai-skills-manager.js:2030 deleteUserSkill()` 三态拒绝面；判据在 **manager 层**，handler 仅转发。**独立探针**（绕开测试套件）实测：`.`/`..`/`../escape`/`x/../keep` ⇒ `invalid_name`；仅托管存在 ⇒ `not_user_owned`；合法 user 技能正常卸载且其他技能/`ai-memory/` 完好 |
| 4 | [SC-4] 设置页走 `/api/skills/*` + token，主窗口走 `realmAPI` IPC，两入口读同一权威、变更跨窗口同步 | ✓ VERIFIED | `main.js:2831 handleSkillsApi()`（3 子路由 + token 403 前置）与 `ipc-handlers.js:1781/1798/1815` 三通道均转发同一组 `aiManager.<method>`；`src/preload.js:1047/1055/1062` 三方法。两个 handler 段内零判定（无 `kind ===` / `source ===`）。写路径调用侧无条件 `broadcast('skills:changed')` |
| 5 | [SC-5] 超过体积上限的请求体在 `/api/*` 层被拒并返回明确错误，不无上限读入内存 | ✓ VERIFIED | `main.js:936 readJsonBody(req, res, {maxBytes})` 累积中判（`if (rejected) return` 停止拼接）+ 413 + `req.resume()` 排水。**独立探针**（抽取真实源码跑真 http 服务器）：chunked 3 MiB ⇒ `413 {"error":…,"limit":1048576}`；带 Content-Length 3 MiB ⇒ 413；小 body ⇒ 200；`unhandledRejection` 计数 0 |
| 6 | [D-19] 未配置任何 provider 时读路径初始化仍能列出盘上技能（有 Agent 走 sync、无 Agent 直扫，恰一次） | ✓ VERIFIED | `ai-manager.js:3228 ensureSkillsFresh()` 分流；`tests/test-skills-management.js:228` 端到端用例：不含 provider/API Key/Agent 的 `Object.create(AIManager.prototype)` 调 `ensureSkillsFresh()` 后 `refreshedAt > 0` 且技能在列，且**可失败**（换成 `syncAgentSystemPrompt()` 必红）。「两个内置技能在列」的端到端呈现转人工验证 |
| 7 | [D-19] `refreshedAt === 0` 不得渲染成「无技能」——空态区分「尚未加载」与「尚无任何技能」 | ✓ VERIFIED | `src/settings-page.js:5549 renderSkillManageEmptyState()`：`notLoaded = refreshedAt === 0` 驱动两套 title/body（`技能列表尚未加载` / `尚无任何技能`），分支显式且互斥 |
| 8 | [D-13] 尺寸 / 文件数在重扫管线内算一次并缓存，读取投影零 IO；`computeDigest` 字段集一字未改 | ✓ VERIFIED | `measureSkillDir()` 在 `refreshSkills()` 内调用（`ai-skills-manager.js:794`）；`getSkillsForManagement()` 纯读缓存。`computeDigest`（`:210`）仍逐条含 `disabled` / `overLimit` / `shadowed`，且**不含** `bytes` / `fileCount`；`git log -L` 证明该函数最后一次改动是 **46-03**（`5a6acc3`），Phase 50 未触碰 |
| 9 | [D-07] 卸载三态拒绝面 + 判据用 `env.fileInfo` 读盘而非 `env.exists` / 缓存 | ✓ VERIFIED | `deleteUserSkill()` `:2041` 用 `fileInfo` 判 `kind === 'directory'`；`:2045` 才探 managed 目录且**只用于区分拒绝态**。测试覆盖「暖缓存 → 盘上删目录 → not_found」与「存在但是普通文件 ⇒ not_found 且文件原封不动」 |
| 10 | [D-09] 卸载成功后必须从 `settings.aiSkills.disabled` 移除同名条目 | ✓ VERIFIED | `ai-manager.js:1691-1695`：**只在** `deleteUserSkill` 成功之后清理（失败即 throw，后续不可达）；测试覆盖「卸载后装上同名新技能不会被静默禁用」 |
| 11 | [D-10] `/api/settings/update` 对 `aiSkills.disabled` 与 `aiSkills` 两种键形态都校验，拒绝时不落盘 | ✓ VERIFIED | `main.js:1484` 双键分支共用 `validateDisabledListForSettings`；`valid: false` 时在 `configStore.set` 之前 return（`:1491-1497`）。测试覆盖双形态与「拒绝时不落盘」 |
| 12 | [D-18] 写路径重扫恰一次 + 调用侧补播恰一次，忙时补播仍发出；`syncAgentSystemPrompt()` 函数体逐字未改 | ✓ VERIFIED | `ai-manager.js:1650/1660`（set-disabled）与 `:1698/1699`（uninstall）同款次数账；补播在**调用侧**而非函数体内。`tests/test-skills-management.js:460` 断言 `syncAgentSystemPrompt` 函数体逐字未改；`test-ai-skills.js` L 组断言 `rescanCalls === 2` 与忙时补播 |
| 13 | [SEC-09] `readJsonBody` 累积中判体积、413 客户端可达、`sendJson` 幂等护栏 | ✓ VERIFIED | 见 truth 5 的独立探针；另 `sendJson`（`main.js:907`）首行 `if (res.headersSent \|\| res.writableEnded) return`；探针实测 413 后 `unhandledRejection` 计数 **0**。59/59 调用点全部传 `res`（机械判据实跑） |
| 14 | [D-16] `res` 缺失时只 reject、不答响应 ⇒ 漏改调用点的后果是 400 而非主进程崩溃 | ✓ VERIFIED | `main.js:938 canRespond` 双条件探测；**独立探针**实测 `passRes=false` 时外层 catch 回 `400 {"error":…,"code":"BODY_TOO_LARGE"}`，进程不退出 |
| 15 | [USER-07] 三个 IPC 通道与两个 HTTP 写端点转发到同一组 manager 函数，handler 零判定 | ✓ VERIFIED | 见 truth 4；IPC 三通道首行均 `assertTrustedSender(event)` |
| 16 | [UI-SPEC 硬前置] 「仅显式」label/title 提升为 `src/skill-picker-model.js` 单源冻结表，面板改引用同一常量，三条既有断言按各自动向改写 | ✓ VERIFIED | `src/skill-picker-model.js:426 EXPLICIT_TAG`（`Object.freeze` + 挂同一 `api` 对象，`:532` 导出）；设置页消费形态 `window.SkillPickerModel.EXPLICIT_TAG`（`src/settings-page.js:4995-4996`）；`test-skill-picker-model.js` 三条断言已改写（115 例全绿） |
| 17 | [E5] 启停开关在途时乐观翻转 `.on`/`aria-checked` + 置 `disabled`；失败回滚并给区级 hint | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码形状齐备（`test-skills-management.js:1123` 扫描四态），但**状态迁移未被任何行为测试执行**。REVIEW 的 WR-02 正是在本面发现的真实缺陷 —— 证明 presence 检查在此不够。见 `behavior_unverified_items` |
| 18 | [E8] 卸载确认弹框：在途保持打开且按钮 disabled；失败关闭 + hint；`not_found` 额外重拉 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码形状齐备（`src/settings-page.js` 弹框块 + `test-skills-management.js:1148`），时序未被行为测试执行。见 `behavior_unverified_items` |
| 19 | [E7] 诊断详情区：`diagnostics.length === 0` 时徽标与详情区都不渲染；诊断 `path` 不上屏 | ✓ VERIFIED | `src/settings-page.js:5009` 与 `:5058` 同一条件门控徽标与详情区（不合并成一个开关）；`buildSkillManageDiagItem` 不消费 `path`；`test-skills-management.js:1201` 组覆盖两层独立与折叠单点双写 |
| 20 | [E5 backstop] 800px 最小窗口下最宽行首行保持单行不换行、右簇不被裁切 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 该 truth 的 `verification: backstop`（非可推断），无显式证据须弃权；行盒度量需真实渲染引擎。CSS 硬禁令已由源码扫描覆盖（`.skill-manage-row-main` 零 `flex-wrap`） |
| 21 | 文档收口：§十二【管理面】成文 + §11.3 第十码修订 + `AGENTS.md` 维护约定 + 账本刷为实测例数 | ✓ VERIFIED | `docs/product/ai-skills.md:571` 起 §十二 含 12.1–12.9 + 五条诚实边界；§11.3（`:459`）已改为「工具侧九条不变 + 管理面 `not_user_owned`」；`AGENTS.md:337` 维护约定含四条硬约束；`allowed-tools` 缺席原因（`:649`）与 `nameClash` 归属（`:641`）均已成文。**账本数值本身**见 truth 22 |
| 22 | counts-parity（5 套件版）通过：每套件在两账本文件都有单元、例数与实测逐字一致 | ✗ FAILED | 实跑门禁：`cells=16`，`measured={"test-manage-skill.js":"55","test-ai-skills.js":"187","test-skill-picker-model.js":"115","test-skills-management.js":"49","test-skills-http-api.js":"32"}`；**4 个账本单元报 47 != 49**。见下方 Gaps |

**Score:** 18/22 truths verified（3 present-but-behavior-unverified，1 failed）

### 未达成项归因（本债 vs 缺口）

本阶段交付树上**功能面零缺口**。以下三类容易误判的事项**不计**为 gap：

- **本仓无 `npm test` 脚本** ⇒ 两处 GSD gate（`post-merge` / `regression`）恒解析成不存在的脚本。这是已登记的环境问题，非阶段缺陷。全部验证命令均为 `node tests/<file>.js` / `node --test tests/<file>.js`。
- **`50-VALIDATION.md` 刻意 `status: draft` / `nyquist_compliant: false`**、矩阵 `Status` 列全 `⬜ pending` —— 由 `/gsd:verify-work` 与 `/gsd:validate-phase` 回填/判定，是设计而非缺口。
- **仍挂账的技术债**（`TD-48-01` / `TD-48-02` / `WR-02` / `WR-03` / `WR-05` / `WR-06` / `IN-01..IN-05`；`syncAgentSystemPrompt()` 生产调用方写侧 2/3；Phase 51 拥有 `SKILL_THREAT_PATTERNS` 与导入管线）—— 逐条在 `50-REVIEW.md` 与 `STATE.md` 保持挂账，本阶段**从未声称**已闭合，不构成阶段 50 的 gap。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `ai-skills-manager.js` | `getSkillsForManagement()` / `measureSkillDir()` / 双上限常量 / `deleteUserSkill()` / 两个谓词 / 第十码 | ✓ VERIFIED | 全部存在于导出表（`:2128-2143`）；`measureSkillDir` 刻意不导出并有注释说明。`:551` 递归遍历含 symlink 跳过 + 隐藏文件跳过 + 目录 `size` 不计 |
| `ai-manager.js` | `ensureSkillsFresh()` / `getSkillsForManagement()` 转发 / `setSkillDisabled()` / `uninstallUserSkill()` | ✓ VERIFIED | `:3228` / `:1603` / `:1628` / `:1683`，写路径次数账与补播齐备 |
| `main.js` | 双常量 + `readJsonBody` 新签名 + `sendJson` 护栏 + `handleSkillsApi` 三子路由 + `update` 双键校验 | ✓ VERIFIED | `:888/:889/:936/:907/:2831/:1484`；59/59 调用点传 `res`，两个书签端点显式 32 MiB（`:1236/:1257`） |
| `ipc-handlers.js` | 三个管理通道 | ✓ VERIFIED | `:1781/:1798/:1815`，均 `assertTrustedSender` 前置、零判定 |
| `src/preload.js` | `realmAPI.ai` 三方法 | ✓ VERIFIED | `:1047/:1055/:1062`，方法名与通道名逐字对应 |
| `src/settings.html` | 区外壳 + 汇总条/状态/分组/hint + 确认弹框 + `skill-picker-model.js` 脚本序 | ✓ VERIFIED | `:536-565`；`:825` 在 `:826 settings-page.js` **之前**（顺序是关键契约） |
| `src/settings-page.js` | region 标记内的完整渲染与交互面 | ✓ VERIFIED | region `:4784-5716`（933 行）；零 `innerHTML`/`insertAdjacentHTML`，35 处 `createElement` / 28 处 `textContent` |
| `src/skill-picker-model.js` | `STATUS_TEXT.disabled` / `SETTINGS_STATUS_CHAIN` / `pickStatusKey` / `EXPLICIT_TAG` | ✓ VERIFIED | `:239`（第 5 条，既有 4 键值逐字未变）/ `:268` / `:283` / `:426`，全部挂同一 `api` 对象导出 |
| `src/styles/main.css` | Phase 50 专属段 + `.skill-manage-*` 命名空间 + `--skill-success-text` 双主题 | ✓ VERIFIED | `:10475` 段起点；关键选择器齐备；`.skill-manage-row` 无 `--bg-hover`、`.skill-manage-row-main` 无 `flex-wrap`（两条硬禁令均有源码门禁） |
| `tests/test-skills-management.js` 等 5 套件 | 覆盖管理面 / SEC-09 / 失效链 | ✓ VERIFIED | 实测 49 / 32 / 187 / 55 / 115 全绿；全量 `tests/` 26 个文件零失败 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/settings.html` | `src/settings-page.js` | `<script>` 顺序 | ✓ WIRED | `skill-picker-model.js`(:825) 先于 `settings-page.js`(:826)，`init()` 期即可读 `window.SkillPickerModel` |
| 设置页（guest） | `main.js` `/api/skills/*` | HTTP + token | ✓ WIRED | `skillsApi()`（`:4874`）携 token；`handleSkillsApi` 首段 403 前置 |
| `main.js handleSkillsApi` | `aiManager.<method>` | 直接转发 | ✓ WIRED | 三个子路由 → `ensureSkillsFresh` / `getSkillsForManagement` / `setSkillDisabled` / `uninstallUserSkill`；handler 内零判定 |
| `ipc-handlers.js` 三通道 | 同一组 `aiManager.<method>` | `realmAPI` IPC | ✓ WIRED | 与 HTTP 侧共用 manager 实现（「两入口同一权威」的可核形式） |
| `LIMITS` | 管理投影 `limits` | 单源回传 | ✓ WIRED | `getSkillsForManagement().limits` 五键；设置页零限额字面量 |
| `refreshSkills` 缓存 | 管理投影 `groups` | 同步零 IO | ✓ WIRED | 分组 / 排序全在主进程，渲染层只 `groups.forEach` |
| `setSkillDisabled` / `uninstallUserSkill` | 主窗口 renderer 快照 | `broadcast('skills:changed')` | ✓ WIRED | 调用侧恰一次补播；renderer 监听无条件重拉快照（幂等） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 技能列表行 | `groups[].items[]` | `_cache.skills`（`refreshSkills` 扫描真实沙箱目录） | 是 —— 「端到端」用例落盘真实技能目录后经 `ensureSkillsFresh()` 列出 | ✓ FLOWING |
| 体积 / 文件数 | `item.bytes` / `item.fileCount` | `measureSkillDir()` 对真实目录 `listDir` + `size` 求和 | 是 —— 测试以 `fs.statSync` 求和断言（不写常量），含 `SKILL.md` 的 4 文件夹具 | ✓ FLOWING |
| 行尾状态标注 | `pickStatusKey(item)` → `STATUS_TEXT` | 投影布尔字段（`disabled` / `shadowed` / `overLimit` / `promptOmitted`） | 是 —— 源自重扫管线写入的缓存条目 | ✓ FLOWING |
| 模块级汇总条 | `projection.errors` | `_cache.errors`（`slice()` 视图拷贝） | 是 —— 测试断言就地改不污染权威快照 | ✓ FLOWING |
| 诊断详情区 | `item.diagnostics` | 缓存条目 `diagnostics`（`slice()` 深拷） | 是 —— 同上 | ✓ FLOWING |

未发现静态兜底、硬编码字面量或 mock 数据源。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 5 个技能域套件全绿 | `node tests/test-skills-management.js` 等（含 `node --test` 两套件） | 49 / 187 / 115 / 32 / 55，`# fail 0` | ✓ PASS |
| 全量 `tests/` 零失败 | `for t in tests/*.js; do node "$t"; done` | 26 个文件，无 `# fail [1-9]` | ✓ PASS |
| **SEC-09 真实源码行为**（独立探针，抽取 `main.js` 的 `sendJson` / `readJsonBody` / 常量在真 `http.createServer` 上跑） | `node /tmp/probe-sec09.js` | T1 chunked 3 MiB ⇒ `413 {error,limit:1048576}`；T2 带 CL ⇒ 413；T3 `res` 缺失 ⇒ `400 {code:"BODY_TOO_LARGE"}` 不崩；T4 小 body ⇒ 200；`unhandledRejection` = 0 | ✓ PASS |
| **CR-01 卸载拒绝面**（独立探针，绕开测试套件直调 `deleteUserSkill`） | `node /tmp/probe-cr01.js` | `.` / `..` ⇒ `invalid_name`；`../escape` / `x/../keep` / `.//` ⇒ `invalid_name`；`skills` ⇒ `not_found`；`skills/` 目录、`keeper/SKILL.md`、workspace 根、`ai-memory/important.md` **全部存活**；正向卸载 `foo` 成功且 `keeper` 未受影响 | ✓ PASS |
| counts-parity 门禁 | 照抄 `50-VALIDATION.md` 文末副本实跑 | `cells=16`；**FAIL**：AGENTS.md:330、docs/product/ai-skills.md:104/:545/:681 四处报 `47 != 49` | ✗ FAIL |
| `readJsonBody` 调用点覆盖度 | `grep -c 'await readJsonBody(req'` vs `'(req, res'` | 59 == 59（既有 57 一个不丢 + 本阶段两处写路由） | ✓ PASS |

### Probe Execution

未发现 `scripts/*/tests/probe-*.sh` 形态的探针；本阶段非迁移 / CLI 阶段，PLAN / SUMMARY 未声明 probe 脚本。Step 7c: SKIPPED（无声明探针；SEC-09 的「探针」语义由上述独立 `node` 探针承担）。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USER-01 | 50-01 / 50-04 / 50-05 | 设置页「技能管理」区列出名称 / 描述 / 来源 / 体积 / 文件数 / 诊断 | ✓ SATISFIED | truth 1 / 6 / 7 / 19；`REQUIREMENTS.md:143` 仍标 Pending（见下方 ℹ️） |
| USER-02 | 50-02 / 50-04 / 50-05 | 设置页可启用 / 禁用 / 卸载技能 | ✓ SATISFIED | truth 2 / 9 / 10 / 11 / 12；`REQUIREMENTS.md:144` 仍标 Pending |
| USER-06 | 50-02 / 50-04 | 卸载仅允许 `source === 'user'`（手改 URL 不得删内置技能） | ✓ SATISFIED | truth 3（独立探针 + CR-01 加固）；`REQUIREMENTS.md:56/148` 已标 Complete |
| USER-07 | 50-01 / 50-03 | 设置页经 `/api/skills/*` + token；主窗口经 `realmAPI` IPC——同一后端权威、两个前端入口 | ✓ SATISFIED | truth 4 / 15；`REQUIREMENTS.md:57/149` 已标 Complete |
| SEC-09 | 50-03 | `readJsonBody` 增加体积上限 | ✓ SATISFIED | truth 5 / 13 / 14；`REQUIREMENTS.md:78/164` 已标 Complete |

**Orphaned requirements:** 无。五个 PLAN 的 `requirements:` 并集（`USER-01, USER-02, USER-06, USER-07, SEC-09`）与 `REQUIREMENTS.md:183` 映射给 Phase 50 的集合**完全一致**，无额外 ID 被期望却无人认领。

ℹ️ **账本状态不一致（非 gap）**：`REQUIREMENTS.md:51-52` 的复选框与 `:143-144` 的 Traceability 表仍把 USER-01 / USER-02 标为 `Pending`，而 USER-06 / USER-07 / SEC-09 已标 `Complete`。二者在本阶段交付面上同等成立（见上表），该差异属收尾账本尚未统一，不影响交付判定。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | `TBD` / `FIXME` / `XXX` 债务标记 | — | **零命中**。全部阶段改动文件扫描后，仅 `ai-skills-manager.js:1623` 的 `tmp-XXXXXX` 目录模板与 `ai-manager.js:563` 的中文提示词占位符「生成一个脚本做 XXX」命中，二者均为既有内容、非债务标记 ⇒ **无债务标记 blocker** |
| `main.js` | 59 处 | 调用点是否全部传 `res` | — | 59/59 已传，机械判据通过 |
| `src/settings-page.js` | 4784-5716 | region 内 `innerHTML` 注入 | — | 零命中（仅注释提及）；正命题（`createElement` / `textContent`）为真 ⇒ 未扩大 `TD-48-01` 缺口 |
| `src/styles/main.css` | 10516+ | `.skill-manage-row` 加 hover 底 / `.skill-manage-row-main` 加 `flex-wrap` | — | 两条硬禁令均未违反 |

### Human Verification Required

以下 7 项**无法在本环境用自动化证明**（6 项来自 `50-VALIDATION.md` 的 Manual-Only 表，其中前两项是锁定决策的验收面），另有 3 项行为未验证 truth 详见 frontmatter 的 `behavior_unverified_items`。

#### 1. 设置页在 `realm://` CSP 下加载 `skill-picker-model.js`（research A3）

**Test:** `npm run dev` 打开设置页，DevTools 断言 `window.SkillPickerModel` 存在。
**Expected:** 该对象存在，且两个空态分支按 `refreshedAt`（=== 0 / > 0）而非「数组为空」判定。
**Why human:** CSP `script-src 'self'` 下的真实加载行为跑不到；代码面已由源码扫描覆盖（脚本在列且序正确）。

#### 2. 未配置任何 AI provider 时仍能列出随包内置技能（D-19 锁定决策的验收面）

**Test:** 打开设置页「技能管理」区（可用从未配过 provider 的 `realm-dev` 用户数据，或临时清空 `settings.ai` 的 Key）。
**Expected:** **两个内置技能在列**且 `refreshedAt > 0`，**不得**出现「技能列表尚未加载」。
**Why human:** 端到端呈现依赖真实 `AIManager` + `configStore` + 真实播种目录的组合；纯 Node 只能证读路径初始化的分流与恰一次重扫（已证）。

#### 3. 打包态（`make install` 产物）列出内置技能

**Test:** `make install` → 启动 `/Applications/Realm.app` → 打开设置页。
**Expected:** 内置技能组列出两个技能；播种失败时顶部汇总条须给出 `realm_*` 诊断，**不得**静默为空。
**Why human:** `asarUnpack` + `app.isPackaged` 路径分支只在正式产物上生效，`npm run dev` 覆盖不到。

#### 4. 禁用后在 `/` 面板的可见性（跨进程半边）

**Test:** 禁用某技能 → 同一会话打开 `/` 面板。
**Expected:** 该技能不在列表；重新启用即恢复。
**Why human:** 单测只能证投影 `disabled: true` + 面板过滤跳过；真实面板渲染不可单测。

#### 5. 多窗口 / 多设置页实例间即时同步

**Test:** 开两个设置页标签；在 A 禁用某技能 → 回 B **手动重进该页**。
**Expected:** B 的列表已同步（**不**断言 A 改动后 B 即时刷新 —— 那是 D-18 明文的设计边界）。
**Why human:** `windowManager.broadcast` 只到 BrowserWindow 的 webContents、不到 webview guest；须人工确认该诚实边界如实呈现。

#### 6. 413 拒收探针在 **Electron 内**复跑（research A4）

**Test:** `npm run dev` 后在渲染进程 DevTools 向 `/api/skills/set-disabled` POST 一个 > 1 MiB 的 body。
**Expected:** 413 + JSON，且主进程堆不线性增长。
**Why human:** 自动用例跑在系统 Node v22.22.0，运行时是 Electron 43.6.0 / Node 24.20.0（本仓有「依赖 Node 行为的结论必须在运行时内复跑」纪律）。

#### 7. 100 条技能时的渲染耗时 / 滚动密度 / 投影字节数（research A6）

**Test:** 造 100 条技能（描述取上限 1024 字符）→ 打开设置页，记录首次渲染耗时与滚动流畅度，并在 DevTools 量 `/api/skills/list` 响应体字节数。
**Expected:** 可接受的首屏耗时与滚动；字节数量级与 ~200 KB 估值比对。
**Why human:** 纯 Node 无 DOM 且无浏览器端测试基建；上界值是估值、未经实测。

#### 8. 启停四态与卸载确认弹框的运行时行为（`behavior_unverified_items` 1/2）

**Test:** 连点两个开关（一成功一失败）观察乐观翻转与回滚；对 user 技能点卸载，在响应前观察按钮与弹框，再制造一次失败观察弹框闭合与 hint。
**Expected:** 见 frontmatter `behavior_unverified_items` 的 `expected` 字段。
**Why human:** 状态迁移 + 时序，源码扫描只看得到形状。REVIEW 的 WR-02 正是在本面被发现的真实缺陷 —— 直接证明该面存在 presence 检查看不见的问题。

#### 9. 800px 最小窗口下行首行是否单行不换行（E5 backstop）

**Test:** `npm run dev` → 窗口缩到最小（800px）→ 打开设置页「技能管理」区，构造最宽形态行。
**Expected:** 每行首行**单行**且右侧操作簇完整可见（不被裁切、不与描述重叠）。
**Why human:** 该 truth 的 `verification: backstop`（非可推断），无显式证据须弃权；行盒度量需真实渲染引擎。

### Gaps Summary

**唯一 gap：`counts-parity` 门禁在当前树上转红（文档账本漂移）。**

`50-05` 的 must-have 明文声明「counts-parity（5 套件版）通过：……每个单元的例数与实测逐字一致」，且 `50-VALIDATION.md` 的 Validation Sign-Off 已勾选「counts-parity 通过（5 套件版，收口实测 `cells=16`）」。但在本验证时点：

- `tests/test-skills-management.js` 实测 **49 例**（门禁命令自身输出）
- `AGENTS.md:330`、`docs/product/ai-skills.md:104` / `:545` / `:681` 四处账本单元仍写 **47 例**
- `50-VALIDATION.md:76` 与 `:131` 两处同样写 47（不在门禁扫描范围，但属同一份账本契约）

**归因（已用 git 取证）**：在审查报告提交点 `5de86f6`，该套件实测 **47 例**、`AGENTS.md` 账本写 **47 例**、`50-VALIDATION.md` 副本写 `"47"` —— 三者当时一致。随后 hotfix `5ff0474`（CR-01 / WR-01 / WR-04 修复）补了 3 条回归用例使总数变为 49，**只改了代码与测试文件，未同步任何账本单元**。因此这不是 50-05 执行者的疏漏，而是收尾 hotfix 引入的漂移。

**为什么仍记为 gap（而不是放过）**：

1. 它是阶段**自己声明为通过**的 must-have，且在交付树上不成立 —— 按判据必须如实记为 failed，不能因「只是文档」而降级为 advisory。
2. 该门禁存在的全部意义就是防这类漂移（`50-05` 的 key_link 明写「四处必须同值」）。放过它等于让门禁变成装饰。
3. 它是**确定性可复现**的，不是 UNCERTAIN；按判据不得以「不确定」回避。

**修复代价**：把上述 4 处门禁扫描单元 + 2 处 VALIDATION 记载的 `47` 改为 `49`，然后重跑门禁确认输出 `counts-parity ok`。纯文档改动，无代码影响。

**功能面结论**：路线图 5 条 Success Criteria **全部成立**，本 gap **不阻断**阶段目标达成。CR-01 的 critical 修复经独立探针确认真实生效、SEC-09 的体积闸经真实源码探针确认可达 —— 这两条最需要「不信 SUMMARY」的判断都已用独立证据闭环。

---

_Verified: 2026-09-14T15:40:50Z_
_Verifier: Claude (gsd-verifier)_

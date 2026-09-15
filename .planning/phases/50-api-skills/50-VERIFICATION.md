---
phase: 50-api-skills
verified: 2026-09-14T15:52:30Z
status: passed
score: 19/22 must-haves verified
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
  - .planning/phases/50-api-skills/50-REVIEW.md
  - .planning/phases/50-api-skills/50-VALIDATION.md
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

covered_digest: "v1:sha256:2ac28fbec3d7fd8c7312c5f8a083ac49272f8e0ca60bd001d328ce0ca63c9dab"
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 18/22
  gaps_closed:
    - "counts-parity（5 套件版）通过：每个套件名在两个账本文件里都有账本单元、且每个单元的例数与实测逐字一致"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:

  - truth: "[E5] 启停开关在途时立即乐观翻转 `.on` / `aria-checked` 并置 `disabled`，失败 ⇒ 回滚 `.on` / `aria-checked`、解除 `disabled`、区级 hint"
    test: "在设置页连点两个技能的启停开关；一次让请求成功、一次制造后端 400（例如先手改 URL 卸载该技能），观察开关状态与失败回滚"
    expected: "点击瞬间开关乐观翻转并进入在途态；成功保持；失败必须回滚到点击前的状态并解除 disabled，区级 hint 给出按 code 查表的文案"
    why_human: "这是状态迁移（乐观翻转 → 回滚），符号存在 + 源码扫描不能证明回滚路径真的执行。本仓无 DOM 测试环境，settings-page.js 的运行时行为全部只能做源码扫描；REVIEW 的 WR-02 就是本类行为上的真实缺陷（`sw.disabled = true` 在 await 之前设置导致 Chromium blur，JSDoc 与用例的声明与实际相反）—— 恰好证明该面存在 presence 检查看不见的缺陷。"
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
**Verified:** 2026-09-14T15:52:30Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure（`eb443c2` 关闭上一轮唯一 gap）

## 结论摘要（先读这一段）

**上一轮的唯一 gap 已真实闭合，且未发现被账本编辑掩盖的其他问题。** 我按「不信提交信息」的口径做了四层独立取证：

1. **账本编辑是纯数字改动** —— 对 `eb443c2` 做字符级 diff：`AGENTS.md` ×1、`docs/product/ai-skills.md` ×3、`50-VALIDATION.md` ×2，全部恰好是单字符 `7` → `9`，**零内容增删**。`REQUIREMENTS.md` 的改动是 2 处复选框 `[ ]`→`[x]` + 2 处 Traceability `Pending`→`Complete`。账本编辑在物理上不可能「删掉某段文档来掩盖缺陷」。
2. **门禁不是恒真**（单点变异取证）—— 把 `AGENTS.md` 的 `49` 改成 `50` 后，门禁确定性转红并指名到 `AGENTS.md:330 test-skills-management.js 账本单元取到 [50] ≠ 实测 49`；还原后复绿。
3. **门禁扫到的 16 个单元全部为真实账本单元** —— 逐单元枚举确认每个单元都对应一个真实套件名与真实例数，无凑数单元、无「取到无关数字」的单元。上一轮报红的那 4 个单元（`AGENTS.md:330`、`ai-skills.md:104/:545/:681`，均属 `test-skills-management.js`）现全部为 49。
4. **例数不是靠删用例凑出来的** —— hotfix `5ff0474` 的 `test(` 块计数 47 → 49（纯增补，无删除）；且**变异取证证明两条新用例是承重的**：
   - 删掉 `ai-skills-manager.js` 的 `.` / `..` 拒绝判据 ⇒ `# fail 3`（含点名用例「态 ①″【CR-01 回归】」）
   - 把谓词改回 `name.trim()` ⇒ `# fail 2`（含点名用例「态 ①‴【WR-01 回归】」）

**功能面与上一轮结论一致：路线图的 5 条 Success Criteria 全部在代码上成立**，且自 hotfix 合并点 `9b3463c` 以来**零源码与零测试改动**（`git diff --stat 9b3463c..HEAD` 只列出 `.planning/**`、`AGENTS.md`、`docs/product/ai-skills.md`）—— 即上一轮对 CR-01 / SEC-09 的独立探针结论仍然有效，本轮又用全新探针复核了 CR-01 与 WR-01 的修复仍活在 master 上。

**判定为 `human_needed`（而非 `passed`）**：存在 3 条「在场但行为未被测试执行」的 truth（启停乐观翻转/回滚、卸载弹框时序、800px 行盒 backstop）与 6 条 Manual-Only 人工验收面（含 D-19 与打包态两条锁定决策的验收面）。按判据，人工项非空即不得判 `passed`。**这不是阶段缺陷**，阶段目标在代码上成立、且无阻断项。

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | [SC-1] 设置页 AI 分区出现「技能管理」区，逐条列出名称 / 描述 / 来源 / 体积 / 文件数 / 诊断 | ✓ VERIFIED | `src/settings.html:536` 区外壳 + `#skillManageState` / `#skillManageGroups` / `#skillManageSummary` / `#skillManageHint`；`src/settings-page.js:4963 buildSkillManageRow()` 逐项落 DOM（名称、来源徽标查 `TIER_BADGE`、描述、`bytes · fileCount` 或「统计不可用」、状态标注、诊断徽标）。六项齐备 |
| 2 | [SC-2] 启停单个技能：禁用只过滤不删文件、不进 system prompt 与 `/` 列表，重新启用即恢复 | ✓ VERIFIED | `ai-manager.js:1628 setSkillDisabled()` 同步读-改-写 `settings.aiSkills.disabled`（不触碰磁盘）；重扫管线打 `disabled` 标记；`filterPickerItems` 跳过 `disabled === true`。跨进程 `/` 面板**渲染**部分在人工验证清单 |
| 3 | [SC-3] 卸载仅允许 `source === 'user'`；内置 / 托管技能的卸载请求被拒（手改 URL 亦然） | ✓ VERIFIED | `ai-skills-manager.js:2030 deleteUserSkill()` 三态拒绝面；判据在 **manager 层**，handler 仅转发。**本轮独立探针**（绕开测试套件与 handler）实测：`.`/`..`/`../escape`/`x/../keep`/`.//`/`../../etc`/`a\..\b` ⇒ `invalid_name`；仅托管存在 ⇒ `not_user_owned`；不存在 ⇒ `not_found`；合法 user 技能正常卸载且 `keeper/`、`managed-skills/builtin/`、`ai-memory/important.md`、沙箱外哨兵全部存活 |
| 4 | [SC-4] 设置页走 `/api/skills/*` + token，主窗口走 `realmAPI` IPC，两入口读同一权威、变更跨窗口同步 | ✓ VERIFIED | `main.js:2831 handleSkillsApi()`（3 子路由 + token 403 前置）与 `ipc-handlers.js:1781/1798/1815` 三通道均转发同一组 `aiManager.<method>`；`src/preload.js:1047/1055/1062` 三方法。两个 handler 段内零判定。写路径调用侧无条件 `broadcast('skills:changed')` |
| 5 | [SC-5] 超过体积上限的请求体在 `/api/*` 层被拒并返回明确错误，不无上限读入内存 | ✓ VERIFIED | `main.js:888 MAX_JSON_BODY_BYTES = 1 MiB` / `:889 MAX_JSON_BODY_BYTES_LARGE = 32 MiB` / `:936 readJsonBody(req, res, {maxBytes})` 累积中判 + 413 + `req.resume()` 排水；`:907 sendJson` 幂等护栏；两个书签端点显式放大（`:1236` / `:1257`）。调用点覆盖度 **59 / 59**（`await readJsonBody(req` = 59，与 `(req, res` 计数 60 减 1 处定义行吻合）。上一轮的抽取真实源码探针（chunked 3 MiB ⇒ 413 / 带 CL ⇒ 413 / `res` 缺失 ⇒ 400 不崩 / 小 body ⇒ 200）结论仍有效（源码零改动） |
| 6 | [D-19] 未配置任何 provider 时读路径初始化仍能列出盘上技能（有 Agent 走 sync、无 Agent 直扫，恰一次） | ✓ VERIFIED | `ai-manager.js:3228 ensureSkillsFresh()` 分流；`tests/test-skills-management.js:228` 端到端用例：不含 provider / API Key / Agent 的 `Object.create(AIManager.prototype)` 调 `ensureSkillsFresh()` 后 `refreshedAt > 0` 且技能在列，且**可失败**（换成 `syncAgentSystemPrompt()` 必红）。「两个内置技能在列」的端到端呈现转人工验证 |
| 7 | [D-19] `refreshedAt === 0` 不得渲染成「无技能」——空态区分「尚未加载」与「尚无任何技能」 | ✓ VERIFIED | `src/settings-page.js:5549 renderSkillManageEmptyState()`：`notLoaded = refreshedAt === 0` 驱动两套 title/body（`技能列表尚未加载` / `尚无任何技能`），分支显式且互斥 |
| 8 | [D-13] 尺寸 / 文件数在重扫管线内算一次并缓存，读取投影零 IO；`computeDigest` 字段集一字未改 | ✓ VERIFIED | `measureSkillDir()`（`ai-skills-manager.js:551`）在 `refreshSkills()` 内调用（`:794`）；`getSkillsForManagement()`（`:1056`）纯读缓存。`computeDigest` 仍逐条含 `disabled` / `overLimit` / `shadowed`，且**不含** `bytes` / `fileCount`；`git log -L` 证明该函数最后一次改动是 **46-03**（`5a6acc3`），Phase 50 未触碰 |
| 9 | [D-07] 卸载三态拒绝面 + 判据用 `env.fileInfo` 读盘而非 `env.exists` / 缓存 | ✓ VERIFIED | `deleteUserSkill()` 用 `fileInfo` 判 `kind === 'directory'`；之后才探 managed 目录且**只用于区分拒绝态**。测试覆盖「暖缓存 → 盘上删目录 → not_found」与「存在但是普通文件 ⇒ not_found 且文件原封不动」 |
| 10 | [D-09] 卸载成功后必须从 `settings.aiSkills.disabled` 移除同名条目 | ✓ VERIFIED | `ai-manager.js:1691-1695`：**只在** `deleteUserSkill` 成功之后清理（失败即 throw，后续不可达）；测试覆盖「卸载后装上同名新技能不会被静默禁用」 |
| 11 | [D-10] `/api/settings/update` 对 `aiSkills.disabled` 与 `aiSkills` 两种键形态都校验，拒绝时不落盘 | ✓ VERIFIED | `main.js:1484` 双键分支共用 `validateDisabledListForSettings`；`valid: false` 时在 `configStore.set` 之前 return。测试覆盖双形态与「拒绝时不落盘」 |
| 12 | [D-18] 写路径重扫恰一次 + 调用侧补播恰一次，忙时补播仍发出；`syncAgentSystemPrompt()` 函数体逐字未改 | ✓ VERIFIED | `ai-manager.js:1650/1660`（set-disabled）与 `:1698/1699`（uninstall）同款次数账；补播在**调用侧**而非函数体内。`tests/test-skills-management.js` 断言 `syncAgentSystemPrompt` 函数体逐字未改；`test-ai-skills.js` L 组断言 `rescanCalls === 2` 与忙时补播 |
| 13 | [SEC-09] `readJsonBody` 累积中判体积、413 客户端可达、`sendJson` 幂等护栏 | ✓ VERIFIED | 见 truth 5；`sendJson` 首行 `if (res.headersSent \|\| res.writableEnded) return`；上一轮探针实测 413 后 `unhandledRejection` 计数 **0**。`tests/test-skills-http-api.js`（32 例全绿）在真 `http` 服务器上覆盖 413 可达 / 无 unhandledRejection / 堆不线性增长 / 反向对照 |
| 14 | [D-16] `res` 缺失时只 reject、不答响应 ⇒ 漏改调用点的后果是 400 而非主进程崩溃 | ✓ VERIFIED | `main.js:938 canRespond` 双条件探测；上一轮独立探针实测 `passRes=false` 时外层 catch 回 `400 {"error":…,"code":"BODY_TOO_LARGE"}`，进程不退出（源码零改动，结论保持） |
| 15 | [USER-07] 三个 IPC 通道与两个 HTTP 写端点转发到同一组 manager 函数，handler 零判定 | ✓ VERIFIED | 见 truth 4；IPC 三通道首行均 `assertTrustedSender(event)`；`ipc-handlers.js:1792` 注释明记与 HTTP `POST /api/skills/set-disabled` 同源 |
| 16 | [UI-SPEC 硬前置] 「仅显式」label/title 提升为 `src/skill-picker-model.js` 单源冻结表，面板改引用同一常量，三条既有断言按各自动向改写 | ✓ VERIFIED | `src/skill-picker-model.js:426 EXPLICIT_TAG`（`Object.freeze` + 挂同一 `api` 对象）；设置页消费形态 `window.SkillPickerModel.EXPLICIT_TAG`；`test-skill-picker-model.js` 三条断言已改写（115 例全绿） |
| 17 | [E5] 启停开关在途时乐观翻转 `.on`/`aria-checked` + 置 `disabled`；失败回滚并给区级 hint | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码形状齐备（`test-skills-management.js` 扫描四态），但**状态迁移未被任何行为测试执行**。REVIEW 的 WR-02 正是在本面发现的真实缺陷 —— 证明 presence 检查在此不够。见 `behavior_unverified_items` |
| 18 | [E8] 卸载确认弹框：在途保持打开且按钮 disabled；失败关闭 + hint；`not_found` 额外重拉 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 源码形状齐备（`src/settings-page.js` 弹框块 + 对应扫描断言），时序未被行为测试执行。见 `behavior_unverified_items` |
| 19 | [E7] 诊断详情区：`diagnostics.length === 0` 时徽标与详情区都不渲染；诊断 `path` 不上屏 | ✓ VERIFIED | `src/settings-page.js:5009` 与 `:5058` 同一条件门控徽标与详情区（不合并成一个开关）；`buildSkillManageDiagItem` 不消费 `path`；测试组覆盖两层独立与折叠单点双写 |
| 20 | [E5 backstop] 800px 最小窗口下最宽行首行保持单行不换行、右簇不被裁切 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 该 truth 的 `verification: backstop`（非可推断），无显式证据须弃权；行盒度量需真实渲染引擎。CSS 硬禁令已由源码扫描覆盖（`.skill-manage-row-main` 零 `flex-wrap`） |
| 21 | 文档收口：§十二【管理面】成文 + §11.3 第十码修订 + `AGENTS.md` 维护约定 + 账本刷为实测例数 | ✓ VERIFIED | §十二 12.1–12.9 + 五条诚实边界（`docs/product/ai-skills.md:571` 起）；§11.3 已改为「工具侧九条不变 + 管理面 `not_user_owned`」；`AGENTS.md` 维护约定含四条硬约束；`allowed-tools` 缺席原因与 `nameClash` 归属均已成文。**本轮 5 条文档门禁逐条实跑 PASS**（见下） |
| 22 | **counts-parity（5 套件版）通过：每套件在两账本文件都有单元、例数与实测逐字一致** | ✓ VERIFIED | **本轮复验（四层取证）**：① 从 `docs/product/ai-skills.md` **原样抽取**门禁命令实跑 ⇒ `counts-parity ok cells=16 measured={"test-manage-skill.js":"55","test-ai-skills.js":"187","test-skill-picker-model.js":"115","test-skills-management.js":"49","test-skills-http-api.js":"32"}`（exit 0）；② 五套件**独立重测**（不经门禁的 `execSync`）⇒ 55/187/115/49/32，`# fail 0`；③ 门禁**单点变异**（`AGENTS.md` 49→50）⇒ 确定性转红并指名到 `AGENTS.md:330`，还原后复绿；④ 枚举门禁扫到的 **16 个单元** ⇒ 全部为真实账本单元（AGENTS.md:330 ×5、ai-skills.md:98/99/104/105 ×4、:542–546 ×5、:681/682 ×2），无凑数项。另：`docs/product/ai-skills.md` 与 `50-VALIDATION.md` 两份命令副本经机械比对确认**逐字一致** |

**Score:** 19/22 truths verified（3 present-but-behavior-unverified，0 failed）

### Deferred Items

无。Phase 51 承接的是**新能力面**（导入管线 / `SKILL_THREAT_PATTERNS` 技能域模式组 / `resolveInside` 的 ENOENT symlink 加固 / SSRF），不是本阶段任何 truth 的未达成项 —— 本阶段 22 条 truth 无一被推给后续阶段。

### Advisory（新增范围、无取证）

无。本轮 7 条门禁 + 独立探针 + 变异取证全部有确定性证据；未产生「无证据的新范围发现」。

### ℹ️ 观察与更正（本轮复验新增，非 gap）

三段与缺陷无关、但如实记录：

1. **上一轮报告的措辞不准确，本轮更正。** 上一轮把漂移成因写成「补了 3 条回归用例使总数变为 49」。**准确的账是：`test(` 块 47 → 49，净增 2 条新用例**（「态 ①″【CR-01 回归】」与「态 ①‴【WR-01 回归】」），另 1 处是对既有「谓词拒绝面」用例的**边界扩充**（补 `.`/`..` 与 `...`/`.hidden`/`a..b`/`..a` 的正负例）。这解释了 47+2=49 而提交信息说「三条」——「三条」指的是三处**回归覆盖点**，非三条 `test()` 块。上一轮据此判断 gap 的方向与修复要求均正确，只是数字口径写得不严。
2. **`50-04-SUMMARY.md` / `50-05-SUMMARY.md` 里仍有历史 `47`（共 8 处）。** 这些是**当时**的真实记录（50-04 把该套件从 35 扩到 47；50-05 收口时实测 47），hotfix `5ff0474` 在其后发生。SUMMARY 是已完工计划的**历史台账**，回溯改写会伪造历史，且两文件不在门禁扫描范围（门禁只扫 `AGENTS.md` + `docs/product/ai-skills.md` 两个**活账本**）。**处置：保留原样、如实登记，不改。** 已同步的活账本是 `AGENTS.md:330`、`docs/product/ai-skills.md` §七/§11.8/§十二 三处、以及 `50-VALIDATION.md` 的命令副本与收口实测行（`:76` / `:131`）。
3. **上一轮「全量 `tests/` 零失败」的表述不精确。** 26 个文件中，24 个 `node:test` 文件确实零失败；另 2 个（`tests/uat-49-g49-3-panel-layout.js`、`tests/uat-49-g49-4-card-a11y-tab-order.js`）以 **exit 11** 退出，输出为 `E-PW 全局 playwright / _electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行` —— 这是**环境前置缺失**（需全局 playwright 才能驱动 Electron），不是断言失败。二者是 **Phase 49 的 UI UAT 探针**（最后改动于 `d68d7d6`，Phase 50 未触碰，`git log 71e1822..HEAD -- tests/` 只列出 hotfix 的 `test-skills-management.js`）。本阶段的门禁套件（含 `test-agent-workspace.js` 21 例 / `test-builtin-skills-seeder.js` 101 例）全部 `# fail 0`。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `ai-skills-manager.js` | `getSkillsForManagement()` / `measureSkillDir()` / 双上限常量 / `deleteUserSkill()` / 两个谓词 / 第十码 | ✓ VERIFIED | 全部存在于导出表；`measureSkillDir`（`:551`）刻意不导出并有注释说明。CR-01 判据在 `:1362`（`value === '.' \|\| value === '..'`），WR-01 在 `:1350`（`const value = name`，不 trim），`deleteUserSkill` `:2034` 无预 trim |
| `ai-manager.js` | `ensureSkillsFresh()` / `getSkillsForManagement()` 转发 / `setSkillDisabled()` / `uninstallUserSkill()` | ✓ VERIFIED | `:3228` / `:1603` / `:1628` / `:1683`，写路径次数账与补播齐备 |
| `main.js` | 双常量 + `readJsonBody` 新签名 + `sendJson` 护栏 + `handleSkillsApi` 三子路由 + `update` 双键校验 | ✓ VERIFIED | `:888/:889/:936/:907/:2831/:1484`；59/59 调用点传 `res`，两个书签端点显式 32 MiB（`:1236/:1257`） |
| `ipc-handlers.js` | 三个管理通道 | ✓ VERIFIED | 均 `assertTrustedSender` 前置、零判定；与 HTTP 侧共用同一 manager 函数 |
| `src/preload.js` | `realmAPI.ai` 三方法 | ✓ VERIFIED | 方法名与通道名逐字对应 |
| `src/settings.html` | 区外壳 + 汇总条/状态/分组/hint + 确认弹框 + `skill-picker-model.js` 脚本序 | ✓ VERIFIED | `:536` 起；`skill-picker-model.js` 在 `settings-page.js` **之前**（顺序是关键契约） |
| `src/settings-page.js` | region 标记内的完整渲染与交互面 | ✓ VERIFIED | region `:4784-5716`（933 行）；零 `innerHTML`/`insertAdjacentHTML`，正命题（`createElement` / `textContent`）为真 ⇒ 未扩大 `TD-48-01` 缺口 |
| `src/skill-picker-model.js` | `STATUS_TEXT.disabled` / `SETTINGS_STATUS_CHAIN` / `pickStatusKey` / `EXPLICIT_TAG` | ✓ VERIFIED | 全部挂同一 `api` 对象导出 |
| `src/styles/main.css` | Phase 50 专属段 + `.skill-manage-*` 命名空间 + `--skill-success-text` 双主题 | ✓ VERIFIED | 段起点 `:10475`；`.skill-manage-row` 无 `--bg-hover`、`.skill-manage-row-main` 无 `flex-wrap`（两条硬禁令均有源码门禁） |
| `tests/test-skills-management.js` | 管理面全套（含 CR-01 / WR-01 回归用例） | ✓ VERIFIED | **49 例全绿**（47 → 49 为 hotfix 净增 2 条 `test()` 块）。**本轮变异取证证明新用例承重**：删 CR-01 判据 ⇒ `# fail 3`（含点名用例）；改回 `trim()` ⇒ `# fail 2`（含点名用例） |
| `tests/test-skills-http-api.js` | HTTP 与传输面（含 SEC-09 真实 http 行为） | ✓ VERIFIED | 32 例全绿 |
| `tests/test-ai-skills.js` | 技能域全量单测 | ✓ VERIFIED | 187 例全绿 |
| `tests/test-manage-skill.js` | AI 自建技能域 | ✓ VERIFIED | 55 例全绿 |
| `tests/test-skill-picker-model.js` | 面板纯逻辑 | ✓ VERIFIED | 115 例全绿（`node --test`） |
| `docs/product/ai-skills.md` §十二 | 管理面成文 + 五条诚实边界 + 账本 | ✓ VERIFIED | 5 条文档门禁实跑 PASS |
| `AGENTS.md` 维护约定 | 权威指针 + 同步义务 + 四条硬约束 + 测试口径 | ✓ VERIFIED | 门禁实跑 PASS；账本行结构未被 `47→49` 编辑破坏（门禁 4 专门断言单行多套件结构） |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/settings.html` | `src/settings-page.js` | `<script>` 顺序 | ✓ WIRED | `skill-picker-model.js` 先于 `settings-page.js`，`init()` 期即可读 `window.SkillPickerModel` |
| 设置页（guest） | `main.js` `/api/skills/*` | HTTP + token | ✓ WIRED | `skillsApi()` 携 token；`handleSkillsApi` 首段 403 前置 |
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
| 5 个技能域套件全绿（独立重测，不经门禁） | `node tests/test-manage-skill.js` 等（含 `node --test` 两套件） | 55 / 187 / 115 / 49 / 32，`# fail 0`（exit 0） | ✓ PASS |
| Phase 50 门禁七条（50-05-PLAN 的 7 条 `<automated>`，HTML 反转义后逐条实跑） | 见 `50-05-PLAN.md:137/139/173/175/214/216/218` | 7/7 PASS：§十二 要点齐备 / 诚实边界 / AGENTS 维护约定 / AGENTS 诚实与结构 / VALIDATION 回填 / counts-parity / 七套件全绿 | ✓ PASS |
| **counts-parity 门禁**（从 `docs/product/ai-skills.md` **原样抽取**命令执行） | `bash /tmp/gate-counts-parity.sh` | `counts-parity ok` / `cells=16` / measured 55·187·115·49·32（exit 0） | ✓ PASS |
| **门禁单点变异**（证明非恒真） | 沙箱内 `AGENTS.md` 的 `49` → `50` | 转红并指名 `AGENTS.md:330 test-skills-management.js 账本单元取到 [50] ≠ 实测 49`（exit 1）；还原后复绿 | ✓ PASS |
| **账本单元枚举**（证明无凑数单元） | 复刻门禁发现逻辑打印 16 个单元 | 16 个全为真实账本单元（AGENTS.md:330 ×5、ai-skills.md:98/99/104/105、:542–546、:681/682） | ✓ PASS |
| **两份命令副本逐字一致**（声明核验） | Python 抽取两份 ```bash 块并比对 | `IDENTICAL` | ✓ PASS |
| **CR-01 / WR-01 独立探针**（绕开套件与 handler，直调 `deleteUserSkill`） | `node /tmp/probe-cr01-v2.js` | `PROBE_CR01_RESULT=PASS`：7 个路径注入名 ⇒ `invalid_name`；`not_user_owned` / `not_found` 正确；`keeper` / `managed-skills/builtin` / `ai-memory/important.md` / 沙箱外哨兵**全部存活**；正向卸载 `foo` 成功且 `keeper` 完好；`" foo"` 与 `"foo"` 互不误删；边界 `...`/`.hidden`/`a..b`/`..a` 判合法、`  spaced  ` 原值回传 | ✓ PASS |
| **回归用例承重性变异**（证明例数不是充数） | 沙箱内删 CR-01 判据 / 改回 `trim()` | 删判据 ⇒ `# fail 3`（含 `态 ①″【CR-01 回归】`）；改回 trim ⇒ `# fail 2`（含 `态 ①‴【WR-01 回归】`） | ✓ PASS |
| `readJsonBody` 调用点覆盖度 | `grep -c 'await readJsonBody(req'` vs `'(req, res'` | 59 == 60 − 1（定义行） | ✓ PASS |
| 债务标记扫描（blocker 级判据） | `grep -nE "TBD\|FIXME\|XXX"` 扫 Phase 50 全部改动文件 | 4 处命中全为**非标记**用法：`ai-skills-manager.js:1623` 的 `tmp-XXXXXX` 目录模板、`ai-manager.js:526/563` 的中文提示词占位符「生成一个脚本做 XXX」、`tests/test-manage-skill.js:1261` 的同名断言文案 ⇒ **零债务标记 blocker** | ✓ PASS |
| 全量 `tests/`（26 文件） | `for t in tests/*.js; do node "$t"; done` | 24 个 `node:test` 文件 `# fail 0`；2 个 Electron UAT 探针（Phase 49 归属）exit 11 = 环境前置缺失（见上方观察 ③） | ✓ PASS（就本阶段门禁面而言） |
| 代码面自 hotfix 以来未变 | `git diff --stat 9b3463c..HEAD` | 仅 `.planning/**` + `AGENTS.md` + `docs/product/ai-skills.md`，**零源码零测试改动** | ✓ PASS |

### Probe Execution

未发现 `scripts/*/tests/probe-*.sh` 形态的探针；本阶段非迁移 / CLI 阶段，PLAN / SUMMARY 未声明 probe 脚本。**Step 7c: SKIPPED**（无声明探针；SEC-09 与 CR-01 的「探针」语义由上述独立 `node` 探针承担）。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| USER-01 | 50-01 / 50-04 / 50-05 | 设置页「技能管理」区列出名称 / 描述 / 来源 / 体积 / 文件数 / 诊断 | ✓ SATISFIED | truth 1 / 6 / 7 / 19；`REQUIREMENTS.md:51` 复选框与 `:143` Traceability 现均为 **Complete** |
| USER-02 | 50-02 / 50-04 / 50-05 | 设置页可启用 / 禁用 / 卸载技能 | ✓ SATISFIED | truth 2 / 9 / 10 / 11 / 12；`REQUIREMENTS.md:52` 与 `:144` 现均为 **Complete** |
| USER-06 | 50-02 / 50-04 | 卸载仅允许 `source === 'user'`（手改 URL 不得删内置技能） | ✓ SATISFIED | truth 3（独立探针 + CR-01 加固 + 本轮变异取证）；`:148` Complete |
| USER-07 | 50-01 / 50-03 | 设置页经 `/api/skills/*` + token；主窗口经 `realmAPI` IPC——同一后端权威、两个前端入口 | ✓ SATISFIED | truth 4 / 15；`:149` Complete |
| SEC-09 | 50-03 | `readJsonBody` 增加体积上限 | ✓ SATISFIED | truth 5 / 13 / 14；`:164` Complete |

**Orphaned requirements:** 无。五个 PLAN 的 `requirements:` 并集（50-01: USER-01/USER-07；50-02: USER-02/USER-06；50-03: SEC-09/USER-07；50-04: USER-01/USER-02/USER-06；50-05: USER-01/USER-02）为 `USER-01, USER-02, USER-06, USER-07, SEC-09`，与 `REQUIREMENTS.md:183` 映射给 Phase 50 的集合**完全一致**，无额外 ID 被期望却无人认领。

**USER-01 / USER-02 的 Complete 标记合理**：两条均被多个兄弟计划声明（见上），且其代码面（truth 1/6/7/19 与 2/9/10/11/12）本轮与上一轮均判 VERIFIED。上一轮的账本不一致（复选框与 Traceability 仍 Pending）已由 `eb443c2` 消除 —— 现四类账本（复选框 / Traceability / PLAN 声明 / ROADMAP 映射）互相一致。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | `TBD` / `FIXME` / `XXX` 债务标记 | — | **零命中**（4 处命中均为既有非标记文本，见上表）⇒ 无债务标记 blocker |
| `main.js` | 59 处 | 调用点是否全部传 `res` | — | 59/59 已传，机械判据通过 |
| `src/settings-page.js` | region 内 | `innerHTML` 注入 | — | 零命中（仅注释提及）；正命题为真 ⇒ 未扩大 `TD-48-01` 缺口 |
| `src/styles/main.css` | Phase 50 段 | `.skill-manage-row` 加 hover 底 / `.skill-manage-row-main` 加 `flex-wrap` | — | 两条硬禁令均未违反 |

### Human Verification Required

以下 9 项**无法在本环境用自动化证明**（6 项来自 `50-VALIDATION.md` 的 Manual-Only 表，其中 D-19 与打包态两项是锁定决策的验收面；另 3 项为行为未验证 truth，详见 frontmatter 的 `behavior_unverified_items`）。

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
**Why human:** 状态迁移 + 时序，源码扫描只看得到形状。REVIEW 的 WR-02 正是在本面被发现的真实缺陷 —— 直接证明该面存在 presence 检查看不见的问题。**这条不是「仅环境受限」：WR-02 是既有挂账缺陷 ⇒ 必须真人验证，不得因「测试环境不具备」而降级豁免。**

#### 9. 800px 最小窗口下行首行是否单行不换行（E5 backstop）

**Test:** `npm run dev` → 窗口缩到最小（800px）→ 打开设置页「技能管理」区，构造最宽形态行。
**Expected:** 每行首行**单行**且右侧操作簇完整可见（不被裁切、不与描述重叠）。
**Why human:** 该 truth 的 `verification: backstop`（非可推断），无显式证据须弃权；行盒度量需真实渲染引擎。

### Gaps Summary

**本轮无 gap。** 上一轮报的唯一 gap（`counts-parity` 文档账本漂移）已由 `eb443c2` 真实闭合，并按用户要求做了四层独立取证（不算提交信息）：

**闭合确认（不信提交信息的独立取证）：**

| 检查 | 方法 | 结果 |
| ---- | ---- | ---- |
| gap 的 3 条 `missing` 是否全部落地 | 字符级 diff `eb443c2` | 6 处**单字符** `7`→`9`：`AGENTS.md:330` ×1、`docs/product/ai-skills.md:104/:545/:681` ×3、`50-VALIDATION.md:76/:131` ×2 ⇒ 三条 missing 全覆盖，**零内容增删** |
| 门禁是否转绿 | 从权威文档原样抽取命令执行 | `counts-parity ok` / `cells=16` / measured 55·187·115·**49**·32（exit 0） |
| 门禁是否可能假绿 | 单点变异 | 改 `49`→`50` ⇒ 确定性转红并指名到具体行；还原复绿 |
| 账本数字是否等于实测 | 五套件独立重测（不经门禁） | 55 / 187 / 115 / 49 / 32，全部 `# fail 0`，与账本逐字相符 |
| 16 个单元是否都是真单元 | 复刻发现逻辑枚举 | 16/16 为真实账本单元，无凑数项 |
| 两份副本是否真逐字一致 | 机械比对 ```bash 块 | `IDENTICAL` |
| 例数是否靠删用例凑出 | `test(` 块计数前后对比 | 47 → 49（净增 2），**无删除** |
| 新用例是否是承重护栏 | 沙箱变异：删 CR-01 判据 / 改回 `trim()` | 分别 `# fail 3` / `# fail 2`，均含点名回归用例 |
| 修复是否仍在 master | 直调 manager 的独立探针 | `.`/`..`/`../escape`/`x/../keep`/`.//`/`../../etc`/`a\..\b` ⇒ `invalid_name`；沙箱内容与沙箱外哨兵全存活 |
| 其余 5 条文档门禁是否被账本编辑碰坏 | 实跑 50-05-PLAN 全部 7 条 `<automated>`（HTML 反转义） | 7/7 PASS（含 `AGENTS.md` 测试清单行**结构**未破的专项断言） |

**结论：`eb443c2` 没有把任何真实缺陷「刷号掩盖」。** 编辑面是 6 个单字符；被编辑的数字由一条**会失败**的门禁（变异可证）持有；数字对得上由它自己**实跑套件**测出的值；而那套件里被计入的用例经变异取证确认是承重的。四个环节互为独立证据链。

**判定为 `human_needed` 的理由**：功能面零缺口（22 条 truth 中 19 条 VERIFIED、0 条 FAILED），但存在 3 条在场而行为未被测试执行的 truth 与 6 条 Manual-Only 人工验收面。按判据「人工项非空即不得判 `passed`」，故 `human_needed` —— 这是**待人工确认**，不是阶段缺陷。

### 未达成项归因（本债 vs 缺口）

本阶段交付树上**功能面零缺口**。以下三类容易误判的事项**不计**为 gap：

- **本仓无 `npm test` 脚本** ⇒ 两处 GSD gate（`post-merge` / `regression`）恒解析成不存在的脚本。这是已登记的环境问题，非阶段缺陷。全部验证命令均为 `node tests/<file>.js` / `node --test tests/<file>.js`。
- **`50-VALIDATION.md` 刻意 `status: draft` / `nyquist_compliant: false`**（`wave_0_complete: true`）、矩阵 `Status` 列仍 `⬜ pending` —— 由 `/gsd:verify-work` 与 `/gsd:validate-phase` 回填/判定，是设计而非缺口。
- **仍挂账的技术债**（`TD-48-01` / `TD-48-02` / `WR-02` / `WR-03` / `WR-05` / `WR-06` / `IN-01..IN-05`；`syncAgentSystemPrompt()` 生产调用方写侧 **2/3**；Phase 51 拥有 `SKILL_THREAT_PATTERNS` 与导入管线）—— 逐条在 `50-REVIEW.md` 与 `STATE.md` 保持挂账，本阶段**从未声称**已闭合，不构成阶段 50 的 gap。其中 `WR-02` 已如实登记进上方人工验证项 8（本面必须真人验证）。

---

_Verified: 2026-09-14T15:52:30Z_
_Verifier: Claude (gsd-verifier)_

---

## 人工项闭合记录（2026-09-15，由 `/gsd-verify-work 50` 回填）

上方 `human_verification` 的 9 条人工项已全部在**真实运行期**执行完毕，`50-UAT.md` 记 9/9 pass、0 issues。
`status` 由 `human_needed` 规范化为 `passed` 的依据是 UAT 零 issues（verification 的人工项已非「未验证」）。
逐条对应（驱动 + 证据）：

| # | 人工项 | UAT 测试 | 驱动 | 证据 |
|---|-------|---------|------|------|
| 1 | CSP `script-src 'self'` 下真实加载 `skill-picker-model.js` | 1 | `tests/uat-50-t1-skill-picker-model-csp.js` | `/tmp/uat50/evidence-t1.json`（请求 `…/settings/skill-picker-model.js` → 200 / 27599 B） |
| 2 | D-19：无 provider 仍列出盘上技能 | 2 | `tests/uat-50-a-manage-read-write.js` | `evidence-a.json`（`settings.ai` 实测不存在；builtin 档 = find-skills + skill-creator） |
| 3 | `asarUnpack` + `app.isPackaged` 打包态分支 | 3 | `tests/uat-50-t3-packaged-seeding.js` | `evidence-t3.json`（清空 managed-skills 后产物自愈重建 6933 / 32672 B） |
| 4 | 真实 `/` 面板渲染不含 disabled 技能 | 4 | `tests/uat-50-a-manage-read-write.js` | `evidence-a.json`（广播路径 + 面板 DOM 两段独立证据） |
| 5 | 多设置页不做即时同步的诚实边界 | 5 | `tests/uat-50-a-manage-read-write.js` | `evidence-a.json`（A 禁用 → B **reload** 后 `ariaChecked=false`；刻意未断言即时刷新） |
| 6 | 运行时内复跑（Electron 43.6.0 / Node 24.20.0） | 6 | `tests/uat-50-a-manage-read-write.js` | `evidence-a.json`（1.5 MiB → 413 + `limit:1048576`；反向对照 400 `invalid_name`） |
| 7 | 投影字节数实测（~200 KB 上界原为估值） | 7 | `tests/uat-50-b-interactions-perf-layout.js` | `evidence-b.json`（121 条 → **109 463 B**，未超；正文 marker 命中 0） |
| 8 | 启停乐观翻转/回滚 + 卸载弹框时序（含 WR-02 挂账） | 8 | `tests/uat-50-b-interactions-perf-layout.js` | `evidence-b.json`（同 tick 判别器；回滚接线经 **stub** 验证并已标注强度） |
| 9 | 800px 行盒 backstop | 9 | `tests/uat-50-b-interactions-perf-layout.js` | `evidence-b.json` + `/tmp/uat50/t9-800px.png` |

**两处未闭合的诚实边界（不阻断，如实留档）**：

1. 第 9 项原文要求的「同一行**同时**命中诊断徽标 + 「已遮蔽」+ 开关 + 卸载按钮」**在数据层不可构造**
   （卸载按钮只在 `tier === 'user'` 行渲染，而「已遮蔽」落在同名遮蔽的 **managed 败者**上）。
   已改为断言两类最宽**真实**行并证明该组合不存在 ⇒ 原文的四合一组合**未被覆盖**。
2. 第 3 项「`errors` 非空时顶部汇总条必须渲染 `realm_*` 诊断」的分支本次因 `errors = []` **未被执行到**。

**第 8 项的附带发现（新登记）**：`/api/skills/set-disabled` **不校验技能是否存在** —— 技能目录消失后
直接调用实测 HTTP **200**（非 `not_found`），且名字被写入 `settings.aiSkills.disabled`。因此
`settings-page.js:5361-5364` 的失败回滚分支**无真实触发路径**；对照 `/api/skills/uninstall` 有存在性校验，
两者不对称。ROADMAP 五条成功标准均未涉及该行为，故不列为本阶段 gap，详情见 `50-UAT.md` §Observations。

_Closed: 2026-09-15T02:00:09Z_
_Closed by: /gsd-verify-work 50（9/9 pass，0 issues）_

---

## 指纹刷新（2026-09-15，transition 之后）

`covered_digest` 由 `v1:sha256:5f912b3a…` 刷新为 `v1:sha256:2ac28fbe…`。

**根因**：`covered_files` 含 `.planning/ROADMAP.md` 与 `.planning/REQUIREMENTS.md`，而
`query phase.complete 50`（transition）会勾 ROADMAP 的阶段完成位、`requirements.mark-complete`
会改 REQUIREMENTS ⇒ 两文件内容变化 ⇒ 指纹失配 ⇒ `phase uat-passed --require-verification`
报 `policy: verification status=stale`。

**这不是结论变化**，是**清单内文件的收尾写入**造成的机械失效（与 Phase 47/48 收尾同型）。
按原 30 项清单用 `gsd_run query verification.fingerprint` 重算并写回。刷新后
`phase uat-passed 50 --require-verification` → `passed: true`、blockers 空。

**下次注意**：指纹刷新必须在**transition 提交之后**做（transition 会再改 ROADMAP）；
顺序颠倒会立刻重新 stale。另 `50-UAT.md` / `50-SECURITY.md` **刻意不在 `covered_files` 内**
（UAT 多轮追加、安全复审重写都会反复把阶段判 stale）。

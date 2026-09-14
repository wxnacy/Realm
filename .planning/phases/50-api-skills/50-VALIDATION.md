---
phase: "50"
slug: "api-skills"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-14"
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 数据源：`50-RESEARCH.md` §Validation Architecture（含本会话实测证据）+ §「矛盾 1」的 **✅ 已裁决 = 方案 A**（2026-09-14）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test`（Node 内建，零依赖）；断言用 `node:assert` |
| **Config file** | none（无 jest/vitest/pytest 配置；`package.json` 的 `scripts` **没有 `test` 脚本**） |
| **Quick run command** | `node tests/test-manage-skill.js` / `node tests/test-ai-skills.js` / `node --test tests/test-skill-picker-model.js` / `node tests/test-skills-management.js`（新增） |
| **Full suite command** | `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node --test tests/test-skill-picker-model.js && node tests/test-skills-management.js && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js` |
| **Estimated runtime** | ~30 秒 |

⚠️ **两种跑法并存，必须照抄各文件既有跑法**：`test-ai-skills.js` / `test-manage-skill.js` / `test-skills-management.js` 用 `node tests/<file>.js`（文件内 `require('node:test')` 自跑）；`test-skill-picker-model.js` 用 `node --test`。counts-parity 命令按**文件名是否含 `picker`** 切换。

⚠️ **`npm test` 不存在** —— 本项目两处 gate 恒把它解析成不存在的脚本，任何 `<automated>` 都必须用具名命令。

---

## Sampling Rate

- **After every task commit:** 该 task 触及的套件（改 manager → `node tests/test-manage-skill.js`；改管线 / 失效链 → `node tests/test-ai-skills.js`；改文案表 → `node --test tests/test-skill-picker-model.js`；新套件 → `node tests/test-skills-management.js`）
- **After every plan wave:** Full suite command（上方）
- **Before `/gsd:verify-work`:** Full suite 必须全绿 + counts-parity 通过
- **Max feedback latency:** 30 秒

---

## Per-Task Verification Map

> `Task ID` / `Plan` / `Wave` 在 plan 期由 PLAN.md 的 task 编号回填（本文件是 plan-phase 播种的初始契约）。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | USER-01 | — | 管理投影：三档分组 / 空组剔除 / 组内顺序 = `bySkillPriority` 投影 / 字段齐备 / **不含 `content`** / `limits` 齐备 / `refreshedAt` 带出 | unit | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-01 | — | 体积与文件数口径：递归含子目录 / **隐藏文件不计** / **目录 `size` 不计** / **不穿 symlink** / `SKILL.md` 计入 / 空目录与不可读目录降级 | unit | 同上（`fs` 造 `.DS_Store` / 嵌套目录 / 内部 symlink 环 / 外逃 symlink） | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-01 | T-50-symlink | 尺寸统计在**重扫管线内**完成且**不进 digest**（只加文件、不改 `SKILL.md` ⇒ `digest` 不变而 `bytes` 变） | unit | 同上（**必须取值副本**，防 Pitfall 6 活引用） | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-01 | — | `refreshedAt === 0`（从未加载）不被渲染成「无技能」（D-19 的消费面） | unit | 同上（投影带出 `refreshedAt: 0`）+ 源码扫描（设置页两个空态分支的判据字段） | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-02 | — | 禁用：名单落盘 + **文件仍在盘上** + 缓存条目 `disabled: true` + `/` 面板投影可被 `filterPickerItems` 跳过 | unit | 同上 + `node --test tests/test-skill-picker-model.js` | 部分 ✅ | ⬜ pending |
| TBD | TBD | TBD | USER-02 | — | 重新启用：名单移除 + `disabled` 回 false | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-02/06 | — | 写路径次数账：`syncAgentSystemPrompt()` **恰一次** + 调用侧补播**恰一次** | unit（复用 `tests/test-ai-skills.js:3219-3247` 的 `promptCtx` own-property 计数 + `:3398` 的 `captureBroadcasts`） | `node tests/test-ai-skills.js`（新增用例组） | ✅ 套件存在 | ⬜ pending |
| TBD | TBD | TBD | USER-02/06 | — | **忙时补播仍发出**（`isProcessing === true`）—— D-18 的**真实**理由；且 `agent.state.systemPrompt` 未变（忙时只置脏） | unit | 同上 | ✅ 套件存在 | ⬜ pending |
| TBD | TBD | TBD | USER-06 | — | 仅 user 可卸载的三态拒绝面：不存在 → `not_found`；同名双存在（user+managed）→ **允许并提示**；仅 managed 存在 → `not_user_owned`；**直接调 manager 函数**（= 「手改 URL 直调端点」）同样拒绝 | unit（**不经 handler**，直接调 manager —— 这是判据 3 的承重点） | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-06 | — | 卸载后 `settings.aiSkills.disabled` 同名条目被清理（D-09 派生不变式 —— 「静默失效」类比功能本身更需测试） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-06 | — | 判据是**读盘**而非缓存快照（暖缓存 → 从盘删目录 → 调卸载 ⇒ `not_found`） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-07 | — | 两入口转发到**同一** manager 函数：`handleSkillsApi` 与三个 IPC handler 均**无判定逻辑**、调用同一方法名；三个 REST 子路由名与 `realmServer` 分发分支存在 | unit（源码扫描） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-07 | T-50-token | token 校验：无 / 错 token ⇒ 403 | unit（源码扫描 `handleSkillsApi` 首行 + 真起 `http` server 的小 harness） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09 | T-50-body-size | 超限 body ⇒ **413 + JSON**，且**堆不随 body 线性增长** | unit（真起 `http.createServer` 的小 harness，形同本会话探针） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09 | T-50-idempotent-send | `sendJson` 幂等：已答 413 后二次调用 no-op，且**无 unhandledRejection** | unit（`process.on('unhandledRejection')` 计数断言） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09 | T-50-downgrade | **`res` 缺失降级分支**（裁决 A 的强制项）：漏传 `res` 的调用点超限时**不崩进程**，只 reject `BODY_TOO_LARGE` | unit（直接以旧两参形态调 `readJsonBody`，断言 reject 而非 crash） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09 | T-50-body-size | 两个书签端点显式覆盖 `maxBytes`（`main.js:1157` import-chrome / `:1177` import-html） | unit（源码扫描含 `maxBytes` + 行为各一条：大 body 通过 / 超 32 MiB 拒） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09（回归） | T-50-callsite | **57 个既有调用点**在改签名后行为不变（默认值路径）+ 调用点覆盖机械判据（`grep -c "await readJsonBody(req)" main.js` 与「带 `res` 的调用点数」之差为 0） | smoke | Full suite command | ✅ | ⬜ pending |
| TBD | TBD | TBD | USER-02（D-10） | T-50-settings-validation | `/api/settings/update` 对 `aiSkills` / `aiSkills.disabled` **两种键形态**都校验（非数组 / 非字符串项 / 超长 / 路径样串 ⇒ 400 且**不落盘**） | unit | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-08 | — | `MANAGE_SKILL_ERROR` 十一键 / 十码，值集合逐字（**改造既有冻结断言** `tests/test-manage-skill.js:1589-1621`） | unit | `node tests/test-manage-skill.js` | ✅（需改） | ⬜ pending |
| TBD | TBD | TBD | D-12 | — | `STATUS_TEXT.disabled` 存在且值逐字；新增键**不**打翻既有 4 键值冻结与 `MANAGE_SKILL_SHORT_REASON` 的 **9 键**断言（后者是**另一张表**） | unit | `node --test tests/test-skill-picker-model.js` | ✅（需补） | ⬜ pending |
| TBD | TBD | TBD | D-12 / UI-SPEC | — | 「仅显式」label + title **单源提升**后三条断言改写（值断言 / 引用形态断言 / 表级值域隔离） | unit | 同上 | ✅（需改 3 处） | ⬜ pending |
| TBD | TBD | TBD | D-13 | — | 管理投影**不携带 `content`**（与 `getSkillsForUI()` 各一条断言） | unit | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-SPEC | — | 折叠块第三处宿主与既有两处**同类名 + 同 aria 属性契约** | unit（跨文件源码扫描） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UI-SPEC | T-50-injection | 设置页**零** `innerHTML` / `insertAdjacentHTML` / 字符串模板拼 HTML（注入纪律） | unit（源码扫描） | 同上 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-skills-management.js` —— **新建独立套件**，覆盖上表所有 ❌ W0 行（管理投影 / 尺寸口径 / 启停 / 卸载三态 / 名单清理 / `readJsonBody` 上限与幂等与降级 / settings 双键校验 / 双入口源码扫描 / 注入纪律源码扫描）。独立成文件：与 `test-manage-skill.js`（49 的工具面）职责不同，且独立文件才有独立 `# tests` 计数可入账本
- [ ] `tests/test-ai-skills.js` 新增用例组（写路径次数账 + **忙时补播**），复用既有 `promptCtx`（`:3219-3247`）/ `captureBroadcasts`（`:3398`）harness。⚠️ 该类测试的 fake `configStore` 目前**只有 `get`**（`:3233`），**必须补 `set`** 才能测管理写路径
- [ ] `tests/test-manage-skill.js` 改造 `:1589-1621` 的两条 `deepStrictEqual` 冻结断言（十键 → 十一键 / 九码 → 十码），并处理 `:1588` 的 describe 标题（「本计划不增不减不改名」）
- [ ] `tests/test-skill-picker-model.js` 补 `STATUS_TEXT.disabled` 值断言（**不要**改 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言）；按 UI-SPEC 改写 `:1265-1269` / `:1270-1274` / `:1278` 三条断言
- [ ] counts-parity **四处同步**：① `docs/product/ai-skills.md` §七 两条账本行；② 同文件 §11.8 三条账本行；③ `AGENTS.md:267` 测试行；④ 本文件的命令副本。⚠️ 该判据用 `if(cells<8)`（**`<` 而非 `!==`**），**漏加新套件账本单元不会自动报错** —— plan 期必须主动补，不得依赖它报错
- [ ] Framework install：**none**（`node:test` 内建）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 多窗口 / 多设置页实例间即时同步 | USER-07 判据 4 的另一半 | `windowManager.broadcast` 只发到各 BrowserWindow 的 webContents（`window-manager.js:310`），**不到 webview guest**；设置页是纯 HTTP 客户端（`src/settings-page.js` 零 IPC），D-18 已明确**不新增 guest push 通道** | `npm run dev` → 开两个设置页标签 → 在 A 禁用某技能 → 回 B 手动重进该页，断言列表已同步（**不**断言 A 改动后 B 即时刷新） |
| 413 拒收探针在 **Electron 内**复跑 | SEC-09 | 本研究的探针跑在**系统 Node v22.22.0**，运行时是 Electron 43.6.0 / Node 24.20.0；本仓有「升版/环境差异须复核」纪律（A4） | `npm run dev` 后在渲染进程 DevTools 向 `/api/skills/set-disabled` POST 一个 > 1 MiB 的 body，断言 413 + JSON 且主进程堆不线性增长；随后把该断言落成 `tests/test-skills-management.js` 的可重跑用例 |
| 设置页在 `realm://` CSP 下加载 `skill-picker-model.js` | D-12 / UI-SPEC | 该文件目前**未被设置页加载**（`src/settings.html:783-785` 无该 `<script>`），CSP `script-src 'self'` 下的实际行为未跑过（A3） | `npm run dev` 打开设置页，DevTools 断言 `window.SkillPickerModel` 存在且两个空态分支按 `refreshedAt` 而非「数组为空」判定 |
| 禁用后在该技能的 `/` 面板可见性（跨进程半边） | USER-02 判据 2 | 单测只能证投影 `disabled: true` + `filterPickerItems` 跳过；真实 `/` 面板渲染不可单测 | `npm run dev` → 禁用某技能 → 在同一会话打开 `/` 面板，断言该技能不在列表；重新启用即恢复 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] counts-parity 通过（`cells=8` 基线，新增套件后四处账本同批扩）
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

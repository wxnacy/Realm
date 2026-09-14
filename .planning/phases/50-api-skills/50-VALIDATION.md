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
> 数据源：`50-RESEARCH.md` §Validation Architecture（含实测证据）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test`（Node 内建，零依赖）；断言用 `node:assert` |
| **Config file** | none（无 jest/vitest/pytest 配置；`package.json` 的 `scripts` **没有 `test` 脚本**） |
| **Quick run command** | `node tests/test-manage-skill.js` / `node tests/test-ai-skills.js` / `node --test tests/test-skill-picker-model.js` / `node tests/test-skills-management.js`（新增） |
| **Full suite command** | `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node --test tests/test-skill-picker-model.js && node tests/test-skills-management.js && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js` |
| **Estimated runtime** | ~30 秒 |

⚠️ **两种跑法并存，必须照抄各文件既有跑法**：`test-ai-skills.js` / `test-manage-skill.js` / `test-skills-management.js` 用 `node tests/<file>.js`（文件内 `require('node:test')` 自跑）；`test-skill-picker-model.js` 用 `node --test`。counts-parity 命令按文件名是否含 `picker` 切换。

⚠️ **`npm test` 不存在** —— 本项目两处 gate 恒解析成不存在的 `npm test`，任何 `<automated>` 都必须用具名命令。

---

## Sampling Rate

- **After every task commit:** 该 task 触及的套件（改 manager → `test-manage-skill.js`；改管线或失效链 → `test-ai-skills.js`；改文案表 → `--test test-skill-picker-model.js`；新套件 → `test-skills-management.js`）
- **After every plan wave:** Full suite command（上方）
- **Before `/gsd:verify-work`:** Full suite 必须全绿 + counts-parity 通过
- **Max feedback latency:** 30 秒

---

## Per-Task Verification Map

> `Task ID` 在 plan 期由 PLAN.md 的 task 编号回填（本文件为 plan-phase 播种的初始契约）。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | USER-01 | — | 管理投影含名称/描述/tier/体积/文件数/诊断，**不含 `content`** | unit | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-01 | — | 体积/文件数：递归含子目录、隐藏文件不计、目录 size 不计、不穿 symlink、`SKILL.md` 计入 | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-01 | — | 尺寸统计在重扫管线内且**不进 digest**（只加文件不改 SKILL.md ⇒ digest 不变） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-01 | — | `refreshedAt === 0` 不被渲染成「无技能」（修正 2 的验收面） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-02 | — | 禁用 → 名单落盘、**文件仍在**、面板投影 `disabled:true` | unit | 同上 + `node --test tests/test-skill-picker-model.js` | 部分 ✅ | ⬜ pending |
| TBD | TBD | TBD | USER-02 | — | 重新启用 → 名单移除 + `disabled` 回 false | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-02/06 | — | 写路径 `syncAgentSystemPrompt()` **恰一次** + 调用侧补播**恰一次** | unit（复用 `test-ai-skills.js` 的 own-property 包装计数 + `captureBroadcasts`） | `node tests/test-ai-skills.js` | ✅ | ⬜ pending |
| TBD | TBD | TBD | USER-02 | — | **忙时**（`isProcessing === true`）补播仍然发出 —— 这是补播的**真实理由**（修正 1） | unit | 同上 | ✅ | ⬜ pending |
| TBD | TBD | TBD | USER-06 | — | 仅 user 可卸载的三态拒绝面：不存在 → `not_found`；**同名双存在（user+managed）→ 允许并提示**；仅 managed 存在 → `not_user_owned`；**直接调 manager 函数**（= 「手改 URL 直调端点」）同样拒绝 | unit | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-06 | — | 卸载后 `settings.aiSkills.disabled` 同名条目被清理（D-09 派生不变式） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-06 | — | 读盘判据而非缓存快照（暖缓存 → 从盘删目录 → 调卸载 ⇒ `not_found`） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-07 | — | 两入口转发同一 manager 函数（源码扫描：`handleSkillsApi` 与 IPC handler 均无判定逻辑、调用同一方法名） | unit（源码扫描） | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-07 | T-50-SEC09 | token 校验：无/错 token ⇒ 403（`handleSkillsApi` 首行） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09 | T-50-SEC09 | 超限 body ⇒ **413 + JSON**，且**堆不随 body 线性增长** | unit（真起 `http` server 的小 harness） | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09 | T-50-SEC09 | `sendJson` 幂等：已答 413 后二次调用 no-op，且**无 unhandledRejection** | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09 | — | 两个书签端点显式覆盖 `maxBytes`（源码扫描 + 行为各一条 —— 修正 3 的回归护栏） | unit | 同上 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-09（回归） | — | 57 个既有 `readJsonBody` 调用点在改签名后行为不变（默认值路径） | smoke | Full suite command | ✅ | ⬜ pending |
| TBD | TBD | TBD | USER-02 | — | `/api/settings/update` 对 `aiSkills` / `aiSkills.disabled` **两种键形态**都校验（非数组 / 非字符串项 / 超长 / 路径样串 ⇒ 400 且不落盘） | unit | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | USER-06 | — | `MANAGE_SKILL_ERROR` 键数/值集合逐字冻结断言改造（十一键） | unit | `node tests/test-manage-skill.js` | ✅（需改） | ⬜ pending |
| TBD | TBD | TBD | USER-02 | — | `STATUS_TEXT.disabled` 存在且值逐字；**不**打翻既有四键冻结与 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言（后者是另一张表） | unit | `node --test tests/test-skill-picker-model.js` | ✅（需补） | ⬜ pending |
| TBD | TBD | TBD | USER-01 | — | 管理投影不携带 `content`（与 `getSkillsForUI` 各一条） | unit | `node tests/test-skills-management.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**例数一致性机械判据（phase gate 必跑）**

```bash
# 例数一致性（来源 docs/product/ai-skills.md:546-560 的既有命令）
node -e '
const cp=require("child_process"),fs=require("fs");
const suites=["tests/test-manage-skill.js","tests/test-ai-skills.js","tests/test-skill-picker-model.js"];
const meas={};
for(const f of suites){const o=cp.execSync("node "+(f.indexOf("picker")>=0?"--test ":"")+f,{encoding:"utf8",stdio:["ignore","pipe","ignore"]});meas[f.split("/").pop()]=String(o.match(/# tests (\d+)/)[1]);}
const FN=/test-[\w-]+\.js/g;let bad=[],cells=0;
for(const file of ["AGENTS.md","docs/product/ai-skills.md"]){const hit={};fs.readFileSync(file,"utf8").split("\n").forEach((line,ln)=>{const idx=[];FN.lastIndex=0;let m;while((m=FN.exec(line)))idx.push([m.index,m[0]]);for(let i=0;i<idx.length;i++){const base=idx[i][1];if(!(base in meas))continue;const end=i+1<idx.length?idx[i+1][0]:line.length;const uniq=[...new Set([...line.slice(idx[i][0],end).matchAll(/(\d+)\s*例/g)].map(x=>x[1]))];if(!uniq.length)continue;cells++;hit[base]=(hit[base]||0)+1;if(uniq.length!==1||uniq[0]!==meas[base])bad.push(file+":"+(ln+1)+" "+base+" 账本单元取到 ["+uniq.join("/")+"] ≠ 实测 "+meas[base]);}});for(const base of Object.keys(meas))if(!hit[base])bad.push(file+" 的账本未覆盖 "+base);}
if(cells<8)bad.push("账本单元数 "+cells+" < 8（§七 两条 + §11.8 三条 + AGENTS.md 测试行三条）");
if(bad.length)throw new Error("例数不一致: "+bad.join("; "));
console.log("counts-parity ok");console.log("cells="+cells+" measured="+JSON.stringify(meas));
'
```

⚠️ 若新增独立套件 `tests/test-skills-management.js`，上述 `suites` 数组与「≥8 账本单元」判据都要**同步扩**，否则新套件的计数漂移无人拦。

---

## Wave 0 Requirements

- [ ] `tests/test-skills-management.js` —— 覆盖上表所有 ❌ 行（管理投影 / 尺寸口径 / 启停 / 卸载判据 / 名单清理 / `readJsonBody` 上限与幂等 / settings 校验 / 双入口源码扫描）。**独立成文件**（与 49 的 `test-manage-skill.js` 职责不同，且独立文件才有独立 `# tests` 计数可入账本）。
- [ ] `tests/test-ai-skills.js` 新增用例组（写路径 `rescanCalls` 与 `channels` 次数账 + 忙时补播），复用既有 `captureBroadcasts` / `promptCtx` harness。
- [ ] `tests/test-manage-skill.js` 改造其冻结断言（九码 → 十/十一码，按 plan 期裁决）。
- [ ] `tests/test-skill-picker-model.js` 补 `STATUS_TEXT.disabled` 值断言（**不要**改 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言）。
- [ ] counts-parity：`suites` 数组扩项；三处账本刷数。
- [ ] Framework install：**none**（`node:test` 内建）。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 100 条技能时设置页的滚动 / 密度 / 诊断展开；卸载确认框居中与焦点 | USER-01 / USER-02 | 真实渲染观感与 `realm://` CSP 下的 div 遮罩行为无法在 `node:test` 中复核 | `npm run dev` → 打开 `realm://settings` → AI 分区技能管理区；注入 100 个技能目录后滚动与展开诊断；点卸载看确认框是否居中、Esc/Tab 焦点是否受控。**若跑 `/gsd:ui-phase 50`，由 UI-SPEC 定稿并补真实渲染证据；承重判据必须带正命题（WR-12 的教训：否命题空集真）** |
| 设置页禁用 → `/` 面板消失 → 重新启用恢复 | USER-02 | 跨进程（设置页 guest ↔ 主窗口 renderer）端到端 | 设置页禁用一个技能 → 主窗口 `/` 面板确认该技能消失；重新启用 → 恢复 |
| 卸载 user 技能后目录消失 | USER-06 | 真实文件系统副作用 | 卸载 `skills/<name>` → 确认 `agent-workspace/skills/<name>/` 不存在 |
| **未配置 provider 时**设置页仍能看到两个内置技能 | USER-01 | 修正 2 的验收面（无 Agent ⇒ 无技能缓存） | 清空 AI 供应商 → 打开设置页技能管理区 → 应列出 find-skills 与 skill-creator |
| 打包态列出内置技能 | USER-01 | `asarUnpack` + `app.isPackaged` 路径分支只在正式/`make install` 产物上生效 | `make install` 后启动 .app → 设置页技能区列出内置技能 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

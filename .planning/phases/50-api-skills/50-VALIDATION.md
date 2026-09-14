---
phase: "50"
slug: "api-skills"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-14"
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 数据源：`50-RESEARCH.md` §Validation Architecture（含本会话实测证据）+ §「矛盾 1」的 **✅ 已裁决 = 方案 A**（2026-09-14）。
>
> **本文件已在 50-05（Wave 4 收口）回填**：Per-Task Verification Map 按**已交付的计划 / 任务**重键，Wave 0 全部交付，research 的四条待实测项（A2 / A3 / A4 / A6）逐条处置，counts-parity 命令副本与 `docs/product/ai-skills.md` §11.8 的权威副本逐字一致。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test`（Node 内建，零依赖）；断言用 `node:assert` |
| **Config file** | none（无 jest/vitest/pytest 配置；`package.json` 的 `scripts` **没有 `test` 脚本**） |
| **Quick run command** | `node tests/test-manage-skill.js` / `node tests/test-ai-skills.js` / `node --test tests/test-skill-picker-model.js` / `node tests/test-skills-management.js` / `node tests/test-skills-http-api.js` |
| **Full suite command** | `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node --test tests/test-skill-picker-model.js && node tests/test-skills-management.js && node tests/test-skills-http-api.js && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js` |
| **Estimated runtime** | 七个套件一次串跑 **≈ 4 秒**（同机实测：`time` 报 3.94s total） |

⚠️ **两种跑法并存，必须照抄各文件既有跑法**：`test-ai-skills.js` / `test-manage-skill.js` / `test-skills-management.js` / `test-skills-http-api.js` 用 `node tests/<file>.js`（文件内 `require('node:test')` 自跑）；`test-skill-picker-model.js` 用 `node --test`。counts-parity 命令按**文件名是否含 `picker`** 切换。

⚠️ **本项目没有 `npm test`** —— 两处 gate 恒把它解析成不存在的脚本，任何 `<automated>` 都必须用具名命令。

---

## Sampling Rate

- **After every task commit:** 该 task 触及的套件（改 manager → `node tests/test-manage-skill.js`；改管线 / 失效链 → `node tests/test-ai-skills.js`；改文案表 → `node --test tests/test-skill-picker-model.js`；管理面 → `node tests/test-skills-management.js`；HTTP / 传输面 → `node tests/test-skills-http-api.js`）
- **After every plan wave:** Full suite command（上方）
- **Before `/gsd:verify-work`:** Full suite 必须全绿 + counts-parity 通过
- **Max feedback latency:** ≈ 4 秒（七个套件串跑实测；单套件更短）

---

## Per-Task Verification Map

> **本轮（50-05）重键**：`Task ID` 取**真实存在的任务**（`50-01-T1..T3` / `50-02-T1..T3` / `50-03-T1..T3` / `50-04-T1..T3` / `50-05-T1..T3`），任务名与各 PLAN 的 `<name>Task N:` 逐字对应；`Status` 保持 `⬜ pending` —— 该列由 `/gsd:verify-work` 回填，本文件不在计划内自证通过。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 50-01-T1 | 50-01 | 1 | USER-01 | T-50-01 / T-50-03 | 管理读路径端到端纵切：管理投影（三档分组 / 空组剔除 / 组内顺序 = `bySkillPriority` 投影 / 字段齐备 / **不含 `content`** / `limits` 齐备 / `refreshedAt` 带出）+ 不依赖 Agent 的读路径初始化 + `GET /api/skills/list` 的 token 403 与分发顺序 | unit | `node tests/test-skills-management.js` | ✅ | ⬜ pending |
| 50-01-T2 | 50-01 | 1 | USER-01 | T-50-06 | 设置页「技能管理」区骨架与只读分组列表（**零 `innerHTML`** / 全 DOM API）+ `skill-picker-model.js` 的脚本序 + `STATUS_TEXT` 第 5 条 `disabled` 与状态链单源 | unit | `node tests/test-skills-management.js` + `node --test tests/test-skill-picker-model.js` | ✅ | ⬜ pending |
| 50-01-T3 | 50-01 | 1 | USER-01 | T-50-02 / T-50-04 / T-50-05 | 体积与文件数口径：递归含子目录 / **含 `SKILL.md`** / 隐藏文件不计 / **目录 `size` 不计** / **不穿 symlink（含内部链接环）** / 双上限截断不拒绝加载 / 统计不可用分支 / 逐技能隔离失败 / **不进 `digest`**（值副本用例） | unit | `node tests/test-skills-management.js` | ✅ | ⬜ pending |
| 50-02-T1 | 50-02 | 2 | USER-06 | — | 仅 user 可卸载的三态拒绝面（不存在 ⇒ `not_found`；同名双存在 ⇒ 允许；仅托管存在 ⇒ `not_user_owned`；**直接调 manager 函数** = 「手改 URL 直调端点」同样拒绝）+ 第十码 + 管理面名称谓词与禁用名单校验器（单源） | unit | `node tests/test-skills-management.js` + `node tests/test-manage-skill.js` | ✅ | ⬜ pending |
| 50-02-T2 | 50-02 | 2 | USER-02（D-09 / D-18） | T-50-12 | 写路径收口：`syncAgentSystemPrompt()` **恰一次** + 调用侧补播**恰一次**（**忙时补播仍发出**）+ 卸载成功后清理 `settings.aiSkills.disabled` 同名条目 + 判据读盘而非缓存快照 | unit | `node tests/test-ai-skills.js` | ✅ | ⬜ pending |
| 50-02-T3 | 50-02 | 2 | USER-02 / USER-06 | T-50-11 / T-50-14 | 两个 HTTP 写子路由（`set-disabled` / `uninstall`）转发到同一组 manager 函数 + `{ error, code }` 错误形状 + `/api/settings/update` 的 `aiSkills` / `aiSkills.disabled` **双键校验**与「拒绝时不落盘」 | unit | `node tests/test-skills-http-api.js` | ✅ | ⬜ pending |
| 50-03-T1 | 50-03 | 3 | SEC-09 | T-50-16 / T-50-17 / T-50-18 | `readJsonBody(req, res, { maxBytes })` 三参签名 + **累积中拒收**（超限即停收、答 413 + JSON、`req.resume()` 排水、不 `destroy()` / 不设 `Connection: close`）+ `res` 缺失降级（只 reject，不崩主进程）+ 单源常量 | unit | `node tests/test-skills-http-api.js` | ✅ | ⬜ pending |
| 50-03-T2 | 50-03 | 3 | SEC-09 | T-50-19 / T-50-23 | `sendJson` 幂等护栏 + 全部 59 处调用点改签名（既有 57 一个不丢）+ 两个书签导入端点**恰 2 处**显式 32 MiB + 发送点计数不越基线 | unit | `node tests/test-skills-http-api.js` + Full suite command | ✅ | ⬜ pending |
| 50-03-T3 | 50-03 | 3 | USER-07 | T-50-20 / T-50-21 | 双入口的 IPC 半边：三个管理通道（来源校验 → 空值守卫 → 转发，**段内零判定**）+ `realmAPI` 三方法名与通道名逐字一致 + 与 HTTP 侧跨文件同一组 manager 方法名 + token 403 早于任何 manager 调用 | unit | `node tests/test-skills-http-api.js` | ✅ | ⬜ pending |
| 50-04-T1 | 50-04 | 3 | USER-01 | — | 「仅显式」label / title 提升为跨进程单源（`EXPLICIT_TAG`）+ 面板侧改引用（渲染结果逐字不变）+ 三条既有断言按各自动向改写（值断言 / 引用形态 / 表级值域隔离） | unit | `node --test tests/test-skill-picker-model.js` | ✅ | ⬜ pending |
| 50-04-T2 | 50-04 | 3 | USER-02 / USER-06 | T-50-24 / T-50-25 / T-50-26 / T-50-28 / T-50-30 / T-50-31 | 行内交互面：启停四态（乐观翻转 / 在途态 / 响应体投影就地重渲染 / 失败回滚）+ 卸载按钮仅 user 行与 `.ai-modal-overlay` 二次确认 + inline hint 复位（`clearTimeout` 前置）+ 失败文案按 `code` 查表 + 重渲染的滚动与焦点还原 | unit | `node tests/test-skills-management.js` | ✅ | ⬜ pending |
| 50-04-T3 | 50-04 | 3 | USER-01 | T-50-27 / T-50-29 | 诊断两层承载：行内「诊断 N」徽标 + 无 header 的内联详情区（默认折叠）/ 模块级 `errors[]` 汇总条（完整家族、**默认展开**）+ 两层条件**独立** + 折叠态 `setCollapsed` 单点双写 + 诊断 `path` 不上屏 | unit | `node tests/test-skills-management.js` | ✅ | ⬜ pending |
| 50-05-T1 | 50-05 | 4 | USER-01 / USER-02 | T-50-32 / T-50-35 | 产品说明 §十二【管理面】成文（12.1–12.9 + 五条诚实边界 + 体积口径 + `allowed-tools` 缺席原因 + `nameClash` 归属 + 两入口 + 体积闸）+ §11.3 第十码修订 + §七/§11.8 账本刷为**实测**例数 + counts-parity 扩到 5 套件 | unit（源码 / 文档扫描） | counts-parity 命令（见文末副本；现场跑五个套件比对四处账本） | ✅ | ⬜ pending |
| 50-05-T2 | 50-05 | 4 | USER-01 | T-50-33 | `AGENTS.md` 技能管理面维护约定条目（权威指针 + 同步义务 + 四条硬约束 + 测试口径）+ 测试清单行新增两个套件的**实测**例数且保持单行多套件结构 | unit（源码 / 文档扫描） | counts-parity 命令（见文末副本） | ✅ | ⬜ pending |
| 50-05-T3 | 50-05 | 4 | USER-01 / USER-02 | T-50-36 | 本文件的矩阵按实际交付重键、`wave_0_complete` 置真、四条假设逐条处置、命令副本与产品文档逐字一致；counts-parity 转绿 | unit（文档扫描）+ smoke | counts-parity 命令（文末副本）+ Full suite command | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> **全部已交付**（`wave_0_complete: true`）。逐条指向落地计划。

- [x] `tests/test-skills-management.js` —— **新建独立套件**（50-01 建，50-02 / 50-04 扩；现 **47 例**），覆盖管理投影 / 尺寸口径 / 卸载三态 / 名单清理 / 名称谓词与禁用名单校验 / 双入口与注入纪律源码扫描 / 样式硬禁令 / 交互面 / 诊断两层承载
- [x] `tests/test-skills-http-api.js` —— **新建独立套件**（50-02 建，50-03 扩；现 **32 例**），覆盖 HTTP 写路由与转发目标 / `{ error, code }` 形状 / 双键校验「拒绝时不落盘」/ SEC-09 体积闸的真实 `http` 行为与降级分支 / 调用点覆盖度与常量单源 / 双入口跨文件一致性
- [x] `tests/test-ai-skills.js` 新增用例组（50-02：写路径次数账 + **忙时补播** + 卸载名单清理 + 判据读盘），其 fake `configStore` 已补 `set`（现 **187 例**）
- [x] `tests/test-manage-skill.js` 的冻结断言刷新（50-02：恰十一键 / 十码，含 describe 标题自洽；现 **55 例**）
- [x] `tests/test-skill-picker-model.js` 补 `STATUS_TEXT.disabled` 值断言与三条断言改写（50-01 补第 5 条与链序；50-04 改写三条；现 **115 例**）
- [x] counts-parity **四处同步**（50-05 收口）：① `docs/product/ai-skills.md` §七 两条账本行；② 同文件 §11.8 三条账本行；③ `AGENTS.md` 测试行；④ 本文件的命令副本。判据阈值由 `cells<8` 提到 **`cells<12`**，且**逐套件覆盖检查**是权威（漏加新套件的账本单元会报错）—— 收口实测 `cells=16`
- [x] Framework install：**none**（`node:test` 内建）

---

## Assumptions Disposition（research A2 / A3 / A4 / A6）

> `50-RESEARCH.md` §Assumptions Log 把这四条列为「plan 期各补一次实测」。逐条处置如下（**未做的如实写未做**，不得把未实测写成已实测）。

| # | 原假设 | 处置 | 依据 / 落点 |
|---|--------|------|-------------|
| **A2** | `SKILL.md` 自身的 `size` 是否计入技能 `bytes` | **已定稿为「计入」**；口径已与 UI-SPEC 区说明 ③ 逐字一致，并由行为用例钉住（**已实测**该口径，非仅定稿） | `docs/product/ai-skills.md` §12.2；`tests/test-skills-management.js` 的尺寸口径组以真实文件 `fs.statSync` 求和断言（含 `SKILL.md` 的 4 文件夹具，`fileCount === 4`） |
| **A3** | 设置页在 `realm://` CSP 下加载 `skill-picker-model.js` 的实际表现 | **转入 Manual-Only**；另补一条**源码扫描**断言（`settings.html` 含该 `<script>` 且排在 `settings-page.js` **之前**）—— **已落地，代码面可机械核验**；CSP 下的真实加载表现**未实测** | Manual-Only 表第 3 行；50-01 的 `src/settings.html` 改动与 `tests/test-skills-management.js` 的脚本序断言 |
| **A4** | 413 探针结论在 Electron（Node 24.20.0）内是否同样成立 | **如实披露未做**：自动用例跑在**系统 Node（本机 v22.22.0）**上；Electron 43.6.0 内嵌 Node 24.20.0 的复跑属**人工验证**，保留在 Manual-Only 表 | Manual-Only 表第 2 行；`tests/test-skills-http-api.js` 的 SEC-09 行为组（`node --version` 口径见测试文件注释） |
| **A6** | 100 条技能时管理投影的字节数与渲染耗时 | **转入 Manual-Only**；结构性依据可机械核验：投影**不含正文**（`content` / `filePath` 均在投影之外），`limits` 只是五个数值 ⇒ 上界由「100 条 × 描述 ≤1024 字符 + 诊断」推导。**最坏约 200 KB 与渲染耗时均为估值，未经实测** | Manual-Only 表第 6 行；`ai-skills-manager.getSkillsForManagement()` 的投影字段集（50-01） |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 多窗口 / 多设置页实例间即时同步 | USER-07 判据 4 的另一半 | `windowManager.broadcast` 只发到各 BrowserWindow 的 webContents（`window-manager.js:310`），**不到 webview guest**；设置页是纯 HTTP 客户端（`src/settings-page.js` 零 IPC），D-18 已明确**不新增 guest push 通道**（多开之间**不做**即时同步是设计） | `npm run dev` → 开两个设置页标签 → 在 A 禁用某技能 → 回 B **手动重进该页**，断言列表已同步（**不**断言 A 改动后 B 即时刷新） |
| 413 拒收探针在 **Electron 内**复跑 | SEC-09（A4） | 自动用例跑在**系统 Node v22.22.0**，运行时是 Electron 43.6.0 / Node 24.20.0；本仓有「依赖 Node 行为的结论必须在运行时内复跑」纪律 | `npm run dev` 后在渲染进程 DevTools 向 `/api/skills/set-disabled` POST 一个 > 1 MiB 的 body，断言 413 + JSON 且主进程堆不线性增长（可重跑的部分已落在 `tests/test-skills-http-api.js`） |
| 设置页在 `realm://` CSP 下加载 `skill-picker-model.js` | D-12 / UI-SPEC（A3） | 纯 Node 无 DOM，CSP `script-src 'self'` 下的实际加载行为跑不到；**代码面已由源码扫描覆盖**（脚本在列且序在 `settings-page.js` 之前），运行期表现仍属人工 | `npm run dev` 打开设置页，DevTools 断言 `window.SkillPickerModel` 存在且两个空态分支按 `refreshedAt` 而非「数组为空」判定 |
| 禁用后在该技能的 `/` 面板可见性（跨进程半边） | USER-02 判据 2 | 单测只能证投影 `disabled: true` + 面板过滤跳过；真实 `/` 面板渲染不可单测 | `npm run dev` → 禁用某技能 → 在同一会话打开 `/` 面板，断言该技能不在列表；重新启用即恢复 |
| 100 条技能时的渲染耗时与滚动密度（含管理投影字节数） | USER-01（A6） | 纯 Node 无 DOM 且无 HTTP 端点 / 浏览器端测试基建；耗时与观感只能在真实页面度量。**投影不含正文**是结构性依据，但 ~200 KB 的上界值是**估值** | 用脚本往 `agent-workspace/skills/` 批量造 100 条技能（描述取上限 1024 字符）→ `npm run dev` 打开设置页 → 记录首次渲染耗时与滚动流畅度；在 DevTools 里量 `/api/skills/list` 的响应体字节数（估值 ~200 KB，**未实测**） |
| 最小窗口（800px）下技能行首行是否仍单行不换行 | USER-01（UI-SPEC E5 的 backstop 行） | E5 是 `resolved (backstop)`：**无显式证据**时按纪律路由人工；纯 Node 无法度量行盒。**正命题**：断言右簇不被裁切且首行高度等于单行高度（不是「未出现问题」这类否命题） | `npm run dev` → 把窗口缩到最小（800px）→ 打开设置页「技能管理」区 → 断言每行首行**单行**且右侧操作簇完整可见（不被裁切、不与描述重叠） |
| **未配置任何 provider 时的列表呈现** | USER-01（D-19 的验收面） | 无 provider 的判据依赖真实 `AIManager` 实例与 `configStore` 的组合状态；纯 Node 单测只能证读路径初始化的**分流**（有 Agent 走同步、无 Agent 直扫，恰一次重扫），端到端呈现须真机 | `npm run dev` → 打开设置页「技能管理」区 → 断言**两个内置技能在列**且 `refreshedAt > 0`（**不得**出现「技能列表尚未加载」）。可用从未配置过 provider 的 `realm-dev` 用户数据，或临时清空 `settings.ai` 的 Key |
| **打包态（`make install` 产物）列出内置技能** | USER-01 | `asarUnpack` + `app.isPackaged` 的路径分支只在**正式 / `make install` 产物**上生效（`builtin-skills-seeder.js` 的 `resolveBuiltinSkillsSrc()`），`npm run dev` 覆盖不到 —— 这正是 `AGENTS.md`「开发/正式环境差异 → 发布前必查」的纪律；判据依赖随包内置技能在打包产物里也在盘上 | `make install` → 启动 `/Applications/Realm.app` → 打开设置页 → 断言内置技能组列出两个技能；播种失败时顶部汇总条须给出 `realm_*` 诊断，**不得**静默为空 |

---

## counts-parity 命令副本（与 `docs/product/ai-skills.md` §11.8 的权威副本**逐字一致**）

```bash
node -e '
const cp=require("child_process"),fs=require("fs");
const suites=["tests/test-manage-skill.js","tests/test-ai-skills.js","tests/test-skill-picker-model.js","tests/test-skills-management.js","tests/test-skills-http-api.js"];
// 两个新套件各 2 个账本单元（本文件 §七/§11.8 + AGENTS.md 测试行）⇒ cells 基线由 8 提到 12
const meas={};
for(const f of suites){const o=cp.execSync("node "+(f.indexOf("picker")>=0?"--test ":"")+f,{encoding:"utf8",stdio:["ignore","pipe","ignore"]});meas[f.split("/").pop()]=String(o.match(/# tests (\d+)/)[1]);}
const FN=/test-[\w-]+\.js/g;let bad=[],cells=0;
for(const file of ["AGENTS.md","docs/product/ai-skills.md"]){const hit={};fs.readFileSync(file,"utf8").split("\n").forEach((line,ln)=>{const idx=[];FN.lastIndex=0;let m;while((m=FN.exec(line)))idx.push([m.index,m[0]]);for(let i=0;i<idx.length;i++){const base=idx[i][1];if(!(base in meas))continue;const end=i+1<idx.length?idx[i+1][0]:line.length;const uniq=[...new Set([...line.slice(idx[i][0],end).matchAll(/(\d+)\s*例/g)].map(x=>x[1]))];if(!uniq.length)continue;cells++;hit[base]=(hit[base]||0)+1;if(uniq.length!==1||uniq[0]!==meas[base])bad.push(file+":"+(ln+1)+" "+base+" 账本单元取到 ["+uniq.join("/")+"] ≠ 实测 "+meas[base]);}});for(const base of Object.keys(meas))if(!hit[base])bad.push(file+" 的账本未覆盖 "+base);}
if(cells<12)bad.push("账本单元数 "+cells+" < 12（§七/§11.8 与 AGENTS.md 测试行共四个既有套件 + 两个新套件各 2 个账本单元）");
if(bad.length)throw new Error("例数不一致: "+bad.join("; "));
console.log("counts-parity ok");console.log("cells="+cells+" measured="+JSON.stringify(meas));
'
```

**收口实测（2026-09-14，50-05）**：`counts-parity ok cells=16 measured={"test-manage-skill.js":"55","test-ai-skills.js":"187","test-skill-picker-model.js":"115","test-skills-management.js":"47","test-skills-http-api.js":"32"}`。

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s（七个套件串跑实测 ≈ 4 秒）
- [x] counts-parity 通过（5 套件版，收口实测 `cells=16`）
- [ ] `nyquist_compliant: true` set in frontmatter —— **不在本阶段自证**，由 `/gsd:validate-phase` 判定

**Approval:** pending

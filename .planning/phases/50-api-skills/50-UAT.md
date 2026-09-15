---
status: complete
phase: 50-api-skills
source: [50-VERIFICATION.md]
started: 2026-09-14T15:55:00Z
updated: 2026-09-15T02:00:09Z
---

---

## Current Test

[testing complete]

## Tests

### 1. 设置页在 `realm://` CSP 下加载 `skill-picker-model.js`（research A3）
expected: DevTools 断言 `window.SkillPickerModel` 存在，且两个空态分支按 `refreshedAt`（=== 0 / > 0）而非「数组为空」判定
result: pass
source: automated
driver: tests/uat-50-t1-skill-picker-model-csp.js
evidence: /tmp/uat50/evidence-t1.json
detail: |
  T1A–T1G 全绿（真实 Electron dev 实例，guest 主世界执行，CSP `script-src 'self'` 真实生效）。
  - 脚本请求 `http://localhost:PORT/settings/skill-picker-model.js` → responseStatus=200、transferSize=27599
    （证明 `<base href="/settings/">` + `/settings/` 前缀路由这条链在运行期成立；裸 `/skill-picker-model.js` 会 404）
  - `typeof window.SkillPickerModel === 'object'`，20 个导出键
  - T1D 判别器：两轮喂**同一个空数组** `groups`，仅改 `refreshedAt`（0 → Date.now()）⇒
    A 态「技能列表尚未加载」/ B 态「尚无任何技能」，输出不同
  - T1E：A 态汇总条整条不渲染（summaryChildren=0）/ B 态渲染（=2，标题「技能加载问题（1）」）
  单点变异自证已跑：把分支改为「按数组为空」判定后 T1D/T1E 精确转红、其余 5 条保持绿；
  已按 sha256 还原（`git status --porcelain src/settings-page.js` 空）。
  证据截图：/tmp/uat50/t1-settings-skill-manage.png（真实态，3 个分组在列）

### 2. 未配置任何 AI provider 时仍能列出随包内置技能（D-19 锁定决策的验收面）
expected: 打开设置页「技能管理」区，**两个内置技能在列**且 `refreshedAt > 0`，不出现「技能列表尚未加载」（可用从未配置过 provider 的 `realm-dev` 用户数据，或临时清空 `settings.ai` 的 Key）
result: pass
source: automated
driver: tests/uat-50-a-manage-read-write.js
evidence: /tmp/uat50/evidence-a.json（t2 段）
detail: |
  T2A–T2D 全绿。「未配置 provider」这条**前提被实证而非假设**：
  - T2A：`realm-dev/realm-config.json` 的 `settings.ai` **不存在** ⇒ 本机该 profile 确实从未配置过 provider
  - T2B：`GET /api/skills/list` 的 `refreshedAt = 1789436809203`（> 0 ⇒ 走的是「已加载」而非空态 A）
  - T2C：builtin 档技能 = `["find-skills","skill-creator"]`（与 `src/skills-builtin/` 下两个目录一致）
  - T2D：渲染面 `#skillManageState` 标题 = `null`（**不是**「技能列表尚未加载」），且两个内置技能各有真实行
  同一次投影共 19 条：demo/weather(user) · find-skills/skill-creator(builtin) · aa-budget-01..14+commit-style(managed)

### 3. 打包态（`make install` 产物）列出内置技能
expected: `make install` → 启动 `/Applications/Realm.app` → 打开设置页，内置技能组列出两个技能；播种失败时顶部汇总条须给出 `realm_*` 诊断，**不得**静默为空
result: pass
source: automated
driver: tests/uat-50-t3-packaged-seeding.js
evidence: /tmp/uat50/evidence-t3.json
detail: |
  T3A–T3G 全绿。**产物改用 `make install-nightly`（记录在案的偏差）**：
  - 偏差理由：`make install` 会 `rm -rf /Applications/Realm.app`，而当时正式版实例（PID 22083）**正在运行**；
    nightly 只覆盖 `/Applications/Realm Nightly.app`（不同路径 / appId / userData）。
  - **判据等价的依据**：`resolveBuiltinSkillsSrc()` 的判据是 **`app.isPackaged`**（不是 NODE_ENV），
    `asarUnpack` / `build.files` 排除项来自**同一个** `package.json` ⇒ SEED-05 与 P10 在 nightly 产物上同等受检。
  - 唯一偏差：产物的 productName / appId / mac.icon 三处不同（与「能否在打包态播种内置技能」无关）。
  **为什么必须先挪走 managed-skills（否则是假绿）**：本机 `realm-nightly` 早已跑过 nightly 产物，
  `managed-skills/` 里**已躺着** find-skills + skill-creator；直接启动读列表，即使 `asarUnpack` 漏配、
  播种全失败，那两个**残留目录**照样被列出。故先把整目录挪到备份名，逼播种器**从解包目录重建**。
  - T3A 产物面：`app.asar.unpacked/skills-builtin/` → `["find-skills","skill-creator"]`（asarUnpack 与运行时路径成对）
  - T3B 运行期判据：execPath/resourcesPath 均在 `.app/Contents/` 内、`defaultApp=false` ⇒ 打包分支
  - T3C 前置：挪走前确有那两个残留（证明 T3D 不是靠残留变绿）
  - **T3D（承重）**：清空后启动产物 → managed-skills **重新出现**两个内置技能，
    `find-skills/SKILL.md` = 6933 字节、`skill-creator/SKILL.md` = 32672 字节（非空壳）
  - T3E：`refreshedAt > 0`、builtin 档恰为 `["find-skills","skill-creator"]`
  - T3F：`errors = []`（播种健康）、汇总条 children=0、`stateTitle=null`
  - T3G：设置页 DOM 里两个内置技能各有真实行
  探测后已把 `managed-skills` 备份**还原**（leave-as-found，无 `.uat50bak-*` 残留）。
  ⚠ T3F 的「errors 非空时汇总条必须渲染」这一分支本次因 `errors` 为空**未被执行到**，如实记录。

### 4. 禁用后在 `/` 面板的可见性（跨进程半边）
expected: 禁用某技能 → 同一会话打开 `/` 面板，断言该技能不在列表；重新启用即恢复
result: pass
source: automated
driver: tests/uat-50-a-manage-read-write.js
evidence: /tmp/uat50/evidence-a.json（t4 段）
detail: |
  T4A–T4E 全绿，目标技能 `demo`(user)，面板基线 21 行。
  - T4A 基线（非恒真的前提）：禁用**前**面板含 `demo`，且 `state.aiSkills` 里该条 `disabled:false`
  - T4B **广播路径归因**：禁用后**不打开面板**读主窗口 `state.aiSkills` ⇒ 该条 `disabled` 由 `false` 变 `true`。
    面板未打开 ⇒ 打开路径的后台刷新不可能跑过 ⇒ 该变化只能来自 `skills:changed` 广播
    （`renderer.js:4405` → `pullAiSkillsSnapshot`）。
  - T4C 用户可见面：禁用后打开 `/` 面板（panelVisible=true），行数 21→20，**不含** `demo`
  - T4D 恢复面：重新启用后面板又含 `demo`
  - T4E 无残留：结束时 `settings.aiSkills.disabled = []`，与起始一致
  ⚠ 澄清一处本探针**首版自己写错的断言**（已改正，非产品缺陷）：面板投影 `getSkillsForUI()`
  **有意保留** `disabled` 条目（带 `disabled:true`），剔除发生在 `buildPickerItems → filterPickerItems`
  （`src/skill-picker-model.js:222` `if (!s || s.disabled === true) continue;`）。
  故「禁用后该条从 `state.aiSkills` 消失」是**错的**判据；正确判据是 T4B（快照被重拉且该条翻为 `disabled:true`）+ T4C（面板 DOM 不含）。

### 5. 多窗口 / 多设置页实例间即时同步
expected: 开两个设置页标签，在 A 禁用某技能 → 回 B **手动重进该页**，列表已同步（**不**断言 A 改动后 B 即时刷新 —— 不做即时同步是 D-18 的设计）
result: pass
source: automated
driver: tests/uat-50-a-manage-read-write.js
evidence: /tmp/uat50/evidence-a.json（t5 段）
detail: |
  T5A–T5C 全绿，目标 `demo`。
  - T5A：造出 2 个设置页 guest（`createTab('default','realm://settings')`），在 A 真实点击开关成功
  - T5B：A 禁用后**磁盘** `settings.aiSkills.disabled = ["demo"]`（写盘生效）
  - T5C：B **reload 重进该页**后该行 `ariaChecked="false"`（重进前为 `"true"`）⇒ 跨设置页经磁盘+重拉达成一致
  刻意**未**断言「A 改动后 B 即时刷新」—— 不做即时同步是 D-18 的成文设计（设置页收不到主进程广播），
  本次只验证「重进即同步」这条被承诺的语义。
  探针收尾闭环：清空 disabled 名单、关闭自建 tab（实测首版未关会持久化进 `tabs.json`，连跑两轮后
  出现 3 个设置页 guest —— 已在探针内补 `closeTab`，并清理了本轮产生的 `tab-10`/`tab-11` 残留）。

### 6. 413 拒收探针在 **Electron 内**复跑（research A4）
expected: `npm run dev` 后在渲染进程 DevTools 向 `/api/skills/set-disabled` POST 一个 > 1 MiB 的 body，断言 413 + JSON 且主进程堆不线性增长
result: pass
source: automated
driver: tests/uat-50-a-manage-read-write.js
evidence: /tmp/uat50/evidence-a.json（t6 段）
detail: |
  T6A–T6D 全绿。
  - T6A：1 572 864 字节 body → HTTP **413**，body = `{"error":"请求体超过上限（1048576 字节）","limit":1048576}`
  - T6B：回传 `limit = 1048576`，与 `main.js` 的 `MAX_JSON_BODY_BYTES` 一致
  - T6C 反向对照：**同一路由**的小 body → HTTP **400** `{code:"invalid_name"}`（不是 413）
    ⇒ 排除「路由本身坏了也返回 413」。名字用 `bad/name` 是为让它在 `setSkillDisabled` 首行校验即被拒、**零副作用**
  - T6D 主进程堆：连发 5 × 1.5 MiB 后增量 −4 398 976 字节（< 线性上界 7 864 320），
    采样 58→50→53→57→50→53 MB，最大单步回落 −8.28 MB ⇒ 确有回收
  ⚠ **本探针首版把反向对照写错了**（记录在案）：首版用「格式合法但不存在的名字」做对照，
  而 `set-disabled` **只校验名字格式、不校验存在性** ⇒ 返回 200 且把该名字**写进了 disabled 名单**（实测污染 `zz-probe-nonexistent`，已清理）。改用格式非法的名字后对照成立且零副作用。
  ⚠ T6D 是**弱信号**：进程堆采样受 GC 时机影响、非确定性。「堆不随 body 线性增长」的**确定性**覆盖在
  `tests/test-skills-http-api.js`（纯 Node，含反向对照），本次是 Electron 内的交叉复核。

### 7. 100 条技能时的渲染耗时 / 滚动密度 / 投影字节数（research A6）
expected: 造 100 条技能（描述取上限）→ 打开设置页，记录首次渲染耗时与滚动流畅度，并在 DevTools 量 `/api/skills/list` 响应体字节数（结构性依据是投影不含正文；~200 KB 上界是**估值、未经实测**）
result: pass
source: automated
driver: tests/uat-50-b-interactions-perf-layout.js
evidence: /tmp/uat50/evidence-b.json（t7 段）
detail: |
  T7A–T7D 全绿。造 100 条 `zzp-perf-*`（managed，description 1000 字符）= 总 121 条。
  - T7A：投影条目数 121 = 基线 21 + 新造 100（基线**动态取**；硬编码会漂移）
  - **T7B（硬判据，结构性）**：每条 SKILL.md **正文**埋唯一 marker ⇒ 投影响应体对
    5 个完整 marker + 100 个 marker 的 17 位唯一前缀**命中数均为 0** ⇒ 投影确不含正文
  - **T7C 实测**：`/api/skills/list` 响应体 **109 463 字节**（121 条）。
    UAT 原文的「~200 KB 上界」是**未经实测的估值** —— 本次测得 ~107 KB，**未超**
  - **T7D 实测**：一次 `renderSkillManagement` 渲染 121 行 / 3 组耗时 **19.6 ms**；
    滚动 12 步 **72.4 ms**；单行高 66px；滚动容器 clientHeight=900 / scrollHeight=9644
  ⚠ 「滚动流畅度」不是可机械判定的量，故只记录离散步数与耗时，**不设主观阈值**；
  本项对 100 条规模下的**投影体积**与**不含正文**给硬判据，对「流畅」只给测量值。
  探测后 100 条已全部删除（`removed: 100`，无残留）。

### 8. 启停四态与卸载确认弹框的运行时行为（`behavior_unverified_items` 1/2）
expected: |
  启停：点击瞬间开关乐观翻转 `.on` / `aria-checked` 并进入在途态（`disabled`）；成功保持；**失败必须回滚到点击前状态并解除 disabled**，区级 hint 给出按 `code` 查表的文案。
  卸载：响应到达前弹框保持打开且「卸载」按钮为 `disabled`；失败 ⇒ 弹框关闭、行内状态不变 + danger hint；`not_found` 时该行随重拉自然消失。
result: pass
source: automated
driver: tests/uat-50-b-interactions-perf-layout.js
evidence: /tmp/uat50/evidence-b.json（t8 段）
detail: |
  T8A–T8F 全绿，其中 5 条走**完全真实**路径，1 条（回滚接线）**用 stub 且已明确标注**。
  - **T8A 同 tick 判别器**：在 `page.evaluate` 里 `sw.click()` 后**在任何 await 之前**同步读回
    ——`pre {on:true, aria:"true", disabled:false}` → `post {on:false, aria:"false", disabled:true}`。
    响应不可能已返回 ⇒ 读到的只能是**同步的乐观翻转 + 在途态**。同步耗时 0.6 ms。
  - T8B 成功保持：落定 `on:false`、`disabled:false`（在途已解除）、hint「已禁用「aa-budget-01」」（success 类）
  - T8C：**见下方「发现」与诚实边界**
  - T8D 卸载弹框：打开后 `display=flex`、确认前 ok 按钮 `disabled=false`；点击确认后 ok 按钮 `disabled=true`
    且弹框 `display` **仍为 flex** ⇒ 响应到达前保持打开 ✅
  - T8E 卸载成功（真删靶技能）：弹框 `display=none`、该行已消失、hint「已卸载「zzp-user-t8」」（success）
  - T8F 卸载失败：目录改名造**真实 not_found** ⇒ 弹框关闭、danger hint「技能已不存在，列表已刷新」、
    该行 2.5s 后已消失（`not_found` 后重拉自然消失）

  **发现（本项的第一个产出，先取证再判）**：`/api/skills/set-disabled` **不校验技能是否存在** ——
  把技能目录改名消失后**直接**调用它，实测 **HTTP 200**（不是 `not_found`），且该名字被写进
  `settings.aiSkills.disabled` 名单。推论：**UI 的失败回滚分支（`settings-page.js:5361-5364`）
  无法用「技能已被删除」这类真实服务端失败触发**；其余真实失败在运行中的应用内也不可构造
  （403 需换 token、但换 token 会连带列表拉不到 / 413 需 >1 MiB body / 503 需 aiManager 为 null）。
  ⚠ 反面影响：删目录后点开关，行会因**重扫把盘上已无的技能丢掉**而消失，看起来像「成功」。
  这不构成数据损坏（名单里多一个不存在的名字是 no-op），但它是「静默成功」而非「明确失败」。

  **T8C 的诚实边界**：回滚**接线**改用**对传输层 `window.skillsApi` 的 stub** 验证 ——
  同 tick `{on:false, disabled:true}` → 下一帧 `{on:true, aria:"true", disabled:false}` + danger hint
  「操作失败：注入的传输层失败（stub）」，行仍在（`code !== 'not_found'` ⇒ 不重拉）。**证据强度低于真实失败**，如实标注。
  另：本项**不以「测试环境不具备」豁免** REVIEW 的 WR-02（`sw.disabled = true` 位于 await 之前 ⇒
  Chromium blur、焦点掉到 `<body>`）；本次实测确认该写法确实存在于 `settings-page.js:5350`（在 `await` 之前）。
  探测后靶技能全部删除、disabled 名单复原为空。

### 9. 800px 最小窗口下行首行是否单行不换行（E5 backstop）
expected: `npm run dev` → 窗口缩到最小（800px）→ 设置页「技能管理」区构造最宽形态行（同时命中诊断徽标 + 「已遮蔽」状态标注 + 开关 + 卸载按钮）⇒ 每行首行**单行**且右侧操作簇完整可见（不被裁切、不与描述重叠、头部高度不变），仅技能名缩到省略号（`title` 仍可读全名）
result: pass
source: automated
driver: tests/uat-50-b-interactions-perf-layout.js
evidence: /tmp/uat50/evidence-b.json（t9 段）+ /tmp/uat50/t9-800px.png
detail: |
  T9A–T9F 全绿。视口真实缩到 **800px**（`page.setViewportSize`，实测 `innerWidth=800`）。
  **判据量取的是 `.skill-manage-row-main`（头部）高，不是整行高** —— 整行还含描述，
  描述换行数因文案长度不同（实测 64/66/67），拿整行高当「首行单行」的代理量是错的（本探针首轮即错在这里）；
  单行基准取**同 tier 且同操作簇构成**（是否带卸载按钮）的无标注行 —— 跨类型比头部高也是错的
  （用户行操作簇含卸载按钮，头部 28px；托管行只有开关，头部 20px）。
  - T9A 视口 800px；- T9B 遮蔽托管行有诊断徽标 + 状态标注「已遮蔽 · 由用户同名技能胜出」+ 开关、**无**卸载按钮
  - T9C 长名用户行（`zzp-user-widest-row-layout-probe-aaaaaaaaaaaaaaaaaaaa`，**必然需要截断**）：
    头部高 28 vs 同类型基线 28、头部横向溢出 0.00px、操作簇右缘 739.00 ≤ 行右缘 739.00、名称 333/415
  - T9D 遮蔽托管行：头部高 20 vs 同类型基线 20、横向溢出 0.00px、操作簇右缘 739.00 ≤ 739.00
  - T9E：名称 `white-space:nowrap` + `text-overflow:ellipsis`，`scrollWidth 415 > clientWidth 333`（**确实被截断**），
    `title` 逐字等于全名 ⇒ 悬停仍可读全名
  **T9F 的诚实边界（重要）**：UAT 原文要求「同一行**同时**命中诊断徽标 + 「已遮蔽」+ 开关 + 卸载按钮」，
  该组合**在数据层不可构造** —— 卸载按钮只在 `tier === 'user'` 的行渲染（`settings-page.js:5033`），
  而「已遮蔽」落在**同名遮蔽的败者**上，败者必为 managed（加载顺序 managed 先 / user 后 ⇒ **user 胜出**）。
  故本项改为在 800px 下断言**两类最宽真实行**（长名用户行覆盖「卸载+开关+长名截断」，
  遮蔽托管行覆盖「诊断徽标+已遮蔽+开关」），并断言行清单里**不存在**任何「同时有状态标注与卸载按钮」的行，
  以证明该组合确实不可得 —— 原文的四合一组合**未被覆盖**，如实记录。
  探测后临时技能已删除（`skills/` 复原为 `demo` + `weather`）。

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- 无：9/9 全通过、0 issues ⇒ 无需 gap-closure 计划。 -->

## Observations（非 gap，不阻断收尾，供后续阶段参考）

1. **`/api/skills/set-disabled` 不校验技能是否存在**（T8C 取证）：技能目录改名消失后直接调用，
   实测 HTTP **200**（不是 `not_found`），且该名字被写进 `settings.aiSkills.disabled`。
   后果：删目录后点开关，行因**重扫丢弃盘上已无的技能**而消失，观感上像「成功」而非「明确失败」；
   UI 的失败回滚分支（`settings-page.js:5361-5364`）因此**无真实触发路径**。
   不构成数据损坏（名单里多一个不存在的名字是 no-op），但属「静默成功」。
   对照：`/api/skills/uninstall` **有**存在性校验（T8F 实测真 `not_found`）—— 两者不对称。
   未列入 Gaps：ROADMAP 的五条成功标准均未涉及该行为，故不阻断本阶段。

2. **WR-02 复现确认（既有挂账技术债，出自 50-REVIEW.md）**：`src/settings-page.js:5350`
   的 `sw.disabled = true` 位于 `await skillsApi(...)`（:5352）**之前** ⇒ Chromium 会 blur 该按钮、
   焦点掉到 `<body>`，`restoreSkillManageFocus` 永不生效。**本项未以「测试环境不具备」豁免**，已实测确认该写法存在。

3. **T3F 的一个分支未被覆盖**：「`errors` 非空时汇总条必须渲染」在本次因 `errors = []` 未被执行到。
   「不得静默为空」的另一半（结果非空）**未实测**，如实记录。

4. **本阶段新增的三个 UAT 驱动**（`tests/uat-50-*.js`，`uat-` 前缀 ⇒ 不被 `test-*` 套件拾取）：
   `uat-50-t1-skill-picker-model-csp.js`（T1）、`uat-50-a-manage-read-write.js`（T2/4/5/6）、
   `uat-50-b-interactions-perf-layout.js`（T7/8/9）、`uat-50-t3-packaged-seeding.js`（T3）。
   均只操作**自己拉起的**子进程、收尾 `electronApp.close()`，**不做** `pkill`/`pgrep` 模式匹配（避免误杀正式版）。

5. **探针自身首轮的三处「假绿」已修复并留档**（对后续写同类驱动有直接价值）：
   ① 把 `pre-click` 基线采样点算进「回滚态计数」⇒ 恒真；
   ② 读 `hint` 晚于 `setSkillManageHint` 的 **2000ms 自动清空** ⇒ 恒空；danger 类名是
   `skill-manage-hint-danger` 而非 `danger`；
   ③ 技能管理区未切到 `ai-assistant` 子页时在 `display:none` 面板内、`getBoundingClientRect` 全 0 ⇒
   「0 vs 0 全等」的假绿。
   另有两次在**生成给 guest 执行的源码字符串**里写了含反引号的注释（`` `/` ``、`` `.skill-manage-row-main` ``），
   提前终止外层模板字面量 —— 与 Phase 38「单引号模板字符串不插值」同型，写此类驱动时须当心。

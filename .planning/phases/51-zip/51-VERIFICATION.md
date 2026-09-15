---
phase: 51-zip
verified: 2026-09-15T13:41:58Z
status: passed
score: 29/29 must-haves verified
covered_files:
  - .planning/phases/51-zip/51-01-PLAN.md
  - .planning/phases/51-zip/51-01-SUMMARY.md
  - .planning/phases/51-zip/51-02-PLAN.md
  - .planning/phases/51-zip/51-02-SUMMARY.md
  - .planning/phases/51-zip/51-03-PLAN.md
  - .planning/phases/51-zip/51-03-SUMMARY.md
  - .planning/phases/51-zip/51-04-PLAN.md
  - .planning/phases/51-zip/51-04-SUMMARY.md
  - .planning/phases/51-zip/51-05-PLAN.md
  - .planning/phases/51-zip/51-05-SUMMARY.md
  - .planning/phases/51-zip/51-06-PLAN.md
  - .planning/phases/51-zip/51-06-SUMMARY.md
  - .planning/phases/51-zip/51-07-PLAN.md
  - .planning/phases/51-zip/51-07-SUMMARY.md
  - AGENTS.md
  - agent-workspace.js
  - ai-manager.js
  - ai-skills-manager.js
  - docs/product/ai-agent-workspace.md
  - docs/product/ai-skills.md
  - main.js
  - package.json
  - src/settings-page.js
  - src/settings.html
  - src/styles/main.css
  - tests/helpers/make-malicious-zip.js
  - tests/test-agent-workspace.js
  - tests/test-ai-skills.js
  - tests/test-skills-http-api.js
  - tests/test-skills-import-net.js
  - tests/test-skills-import.js
  - tests/uat-51-import-modal.js
  - tests/uat-51-import-live.js
  - tests/uat-51-import-limits.js
  - tests/uat-51-import-modal-sizes.js
covered_digest: "v1:sha256:51281b9b12be57e4c2bf883a0f87a21748d98a376b8104af17dc09f6fa5d62d1"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 29/29 must-haves verified
  previous_digest: "v1:sha256:c74c4f526b0105d3be591edd6bd1389760dc6a320041807e3cd8fdc55343afe1"
  previous_verified: 2026-09-15T13:10:30Z
  kind: "上轮唯一人工项（驱动抖动裁决）的**处置复核** + 全量重跑。人工项由「定位根因」这一支闭合（非「改口径」支）；两条驱动加固**逐行核对确认落地**，并由 9 次实跑活体取证（守卫每轮都命中）；5 轮 limits 全绿 ⇒ `status` 由 `human_needed` 回到 `passed`。**本轮发现两处非预期中断（-modal-sizes / -live 各 1 次瞬态中止）**，均已归因到并发会话的 Playwright 驱动活动并复跑转全绿，如实登记于 Anti-Patterns / Advisory"
  human_items_closed:
    - "上轮唯一人工项「超限（413）在弹框状态行的呈现：抖动裁决」——**按「先定位根因再收尾」这一支闭合**。根因已实证：红轮的「设置页 guest 被重新初始化」来自**驱动自己留下的孤儿 Electron 实例**（收尾 `Promise.race([electronApp.close(), sleep(6000)])` 的 6 s 超时先返回、随后 `process.exit()` 把主进程留成 PPID=1 孤儿，与下一轮共用同一个 `realm-dev` userData）。**本轮把「机制真实存在」从推断升级为实测**：同一守卫在我实跑的 **9 次**（limits 5 + modal-sizes 2 + live 2）中**每一次都命中自己的 PID**（95533 / 1100 / 3528 / 6100 / 9311 / 22151 / 22791 / 23544 / 24682）⇒ 修复前**每一轮都会留下孤儿**（不是偶发），守卫是承重的而非装饰"
  gaps_closed:
    - "G-51-1 / CR-02：网络地址导入在真实运行期可用（`ai-manager.js:1848` 绑定 `downloadPackage`）—— 该缺陷由 `51-UAT.md` 登记并 resolved（沿用上轮口径，本轮 `-live.js` 29/29 ×2 复现）"
  gaps_remaining: []
  regressions: []
  behavior_unverified_items_new: 0
  digest_note: "本轮 `covered_digest` = `v1:sha256:51281b9b12be57e4c2bf883a0f87a21748d98a376b8104af17dc09f6fa5d62d1`（与上轮 `c74c4f52…` 不同）。差异来源**已钉死**：`git diff --stat 1fee7c2..HEAD -- <35 covered>` ⇒ 仅 **5** 个 covered 文件变动（`AGENTS.md` +16、`main.js` +63、三支 uat 驱动 +73/+76/+73），其余 **30** 项与上轮逐个字节相同。且**不是**并发中间态造成的污染值：`git diff --stat HEAD -- <35 covered>` **为空**（`git status` 仅 4 个**非 covered** 的 `tests/.uat-out/*.json` 驱动产物）⇒ 本值可由提交树确定性复现，并已用 Python 独立实现交叉验算（含 `v1\\n` 聚合前缀，逐字节相同）"
advisory:
  - finding: "**驱动加固的「并存告警」只在 `-live.js` 落地**：`instancesBefore` 的**登记**三支驱动都有（`-limits.js:546` / `-live.js:320` / `-modal-sizes.js:323`，含 `pid`/`ppid`/`command`），但「并存时打印 `[warn] 已有 Electron 实例在跑`」只有 `-live.js:321-322` 有；`-limits.js` / `-modal-sizes.js` 只登记不打印（实测：轮 2/3 的 `instancesBefore=[73385]` 非空，日志里 `已有 Electron 实例在跑` 命中 **0** 次）"
    category: claim-vs-code-drift
    reason: "提交信息与 `51-UAT.md` 写的是「并存时告警并记入 `instancesBefore`」。**承重的那一半（登记）三支都有**，本轮判定「本轮读数是否在污染环境下取得」正是靠它 ⇒ 不构成 blocker；但「告警」这一半的措辞与代码不符，属口径漂移，建议补 `-limits.js` / `-modal-sizes.js` 的同款 `log` 或把文档改成「登记（live 另打印告警）」"
    evidence_status: "实测（源码逐行 + 轮 2/3 日志 grep 计数 0）"
  - finding: "**并发会话的 Playwright 驱动会在同一个 `realm-dev` 上启动实例，并使本阶段 uat 驱动瞬态中止**：本轮 5 轮 limits 之后，`-modal-sizes.js` 与 `-live.js` **各出现 1 次中止**（应用主窗口被销毁 → `window-all-closed` → `app.quit()`，退出码 0；断言 **0 条 FAIL**，是「页面被关掉」而非「断言失败」）。同一窗口内本机凭空出现 3 个外来 dev 实例（PID 12822 / 15094 / 15095，`cwd=/Users/wxnacy/Projects/Realm`、argv `--inspect=0 --remote-debugging-port=0 .`、PPID=1）。**可证明它们不是我这轮的实例**：守卫报告 `orphanKilled: null`（= `ownPid` 已自行退出）而它们在 `instancesAfter` 里仍存活 ⇒ PID 必不等于 `ownPid`。全仓能产生该签名的启动器只有并发工作流新并入的 `tests/uat-webview-hit-test-stuck.js`（`cwd: REPO_ROOT` + `NODE_ENV: 'development'`，`:324-328`）"
    category: repro-environment
    reason: "**非本阶段产物缺陷**：三支被改驱动除「登记 + 守卫」外零行为改动，且**同一个改动无法关闭应用窗口**（`main.js` 的关闭路径本轮零改动）。复跑 4 次全绿（`-modal-sizes` 48/48 ×2、`-live` 29/29 ×2），其中 4 次都在「并存实例非空」下取得 ⇒ **并存（静止）本身不扰动**，扰动来自并发驱动的**活动**。同时**如实说明另一未排除的候选**：连续 5 轮 limits 后 `realm-dev` 里累积的恢复标签页状态也可能参与其中（无法从本轮证据区分）。**未测定机制**，故只作 Advisory 不作 gap"
    evidence_status: "实测（进程普查 + 守卫 `null` 与 `instancesAfter` 的互斥证明 + 4 次复跑转绿）"
  - finding: "**上一轮把「恢复标签页」归因给并存实例，该归因不成立**：上轮把驱动实例日志里的 `nav-test-example.com` / `cmd-plain-nav-test.com` / `localhost:8005/rouman` 等 webview 记为「PID 58412 那个实例带进来的」。本轮在 `instancesBefore=[]`（**全机零 Electron 实例**，可证）的轮 4/5 里，同样这些 URL 仍逐个出现（`轮 5` tail：`webContents: 4/6/7/8/9` + `bg-nav-test.com`）⇒ 它们是 **`realm-dev` 里持久化的恢复状态**，与是否有并存实例无关"
    category: inference-correction
    reason: "纠正上轮 Advisory #2 的因果归属（不影响任何 truth：这些额外 webview 只进日志，A/B 两段的 settings guest 由带随机 token 的 URL 驱动，与恢复标签无关）。更正后的正确表述：`realm-dev` 被多来源共用 ⇒ **持久化标签页会跨轮/跨会话互相可见**，这是噪声的结构性来源，但与「并存实例」是两件事"
    evidence_status: "实测（`instancesBefore=[]` 轮次的主进程日志尾部逐条可比）"
  - finding: "**`51-UAT.md:75` 仍留着已被实测推翻的措辞「无抖动」**（`automated_by: tests/uat-51-import-limits.js（18/18，连跑 2 轮无抖动）`）；`:103` 仍写「本驱动连跑 2 轮均 18/18」。新口径只补在 **`:110` 的 ③ 段**（「只能说**未复现**」「不能据此声称该腿零抖动」）与 `51-VALIDATION.md:99`"
    category: doc-stale-wording
    reason: "上轮人工项给的处置分支是「**改口径** 或 定位根因」，本轮走的是「定位根因」支 ⇒ 该项本身已闭合；且该措辞**不在** PLAN 51-07 的 truth 文本枚举的四条「不得沿用的旧理由」之内、`51-UAT.md` 也不是该 plan 的 artifact ⇒ **不使任何 must-have 失败**。但同文件内 `:75` 与 `:110` **自相矛盾**（读 `:75` 会以为该驱动零抖动），属确定性文档缺陷、人工改一行即可 ⇒ 记为 ⚠️ Warning，不升格为人工项"
    evidence_status: "实测（`grep -n 无抖动` 逐处列点）"
  - finding: "**守卫的两个边界（设计取舍，均已实测未见触发）**：① `orphanKilled` / `instancesAfter` 的整块写在 `if (electronApp)` 内 ⇒ 若 `_electron.launch()` 在**子进程已生成之后**才抛错，`electronApp` 仍为 `null`、`ownPid` 亦未赋值，此路径不覆盖（本轮 9 次启动均正常返回，未触发）；② `isPidAlive(ownPid)` 只做 `kill(pid,0)` **存在性**探测，不校验身份（PID 复用理论上会被误杀，实际窗口是 close 之后毫秒级，风险可忽略）"
    category: guard-completeness
    reason: "两条都是我读代码时构造出的边界，非观测到的缺陷 ⇒ 不构成 blocker、不构成人工项。若要收紧：① 把守卫块移出 `if (electronApp)`（`ownPid` 非空即收）；② 比对 `ps -o lstart` 确认 PID 身份后再 kill"
    evidence_status: "源码核对（未实测触发）"
  - finding: "**`electronApp.close()` 在本机对该应用「6 s 内无法收干净」是常态**：9 次实跑 9 次 `orphanKilled` 非空 ⇒ 收尾实际靠 `SIGKILL` 兜底，而非优雅退出。这是驱动侧夹具特征（A 段 64 MiB/32 MiB 包驻留 guest 堆时渲染进程拆除慢）"
    category: test-harness-fragility
    reason: "已被守卫覆盖（`instancesAfter` 每轮都无自身残留），故不是缺陷；但值得知道：**读数的干净性依赖这个 SIGKILL 兜底**。若哪天 Electron 升级后 SIGKILL 也不清 helper，`instancesAfter` 会立刻显形（该字段就是为此设的探针）"
    evidence_status: "实测（9/9 命中）+ `ps` 复核（无 PPID=1 的 `node_modules/electron` 残留）"
  - finding: "三支驱动各自**复制了一份** `listElectronInstances()` / `isPidAlive()`（约 22 行 × 3，逐字相同）"
    category: duplication
    reason: "驱动刻意保持「可单文件直接跑、零共享依赖」是本仓 uat 资产的一贯取舍（不 import 被测源码/其它驱动）⇒ 不构成缺陷，仅记一笔：若将来加第 4 支驱动，考虑抽到 `tests/helpers/`"
    evidence_status: "实测（三处逐字比对相同）"
---

# Phase 51: 用户技能导入管线（zip + 网络地址）Verification Report

**Phase Goal:** 用户可从本地 zip 包或网络地址安全导入技能，导入前看清将写入什么；恶意或畸形包整包拒绝且工作区外零写入。
**Verified:** 2026-09-15T13:41:58Z
**Status:** passed（29/29，0 gap，0 人工项；**附环境前提**，见文末「passed 的环境前提」）
**Re-verification:** Yes — **上轮唯一人工项的处置复核 + 全量重跑**（非最小重跑）

## 本轮性质与「为什么必须全量重跑」

上轮（`human_needed`）的唯一人工项是「驱动抖动裁决」，它挂着一个**待人工选择的二选一**：改口径，或先定位根因。本轮结论是**走「定位根因」这一支并已闭合**。因该支的处置落在**三支被改驱动**上（不只上轮那 1 个文件），本轮不能沿用「最小重跑」，而是把 3 支被改 uat 驱动 + 七个套件 + counts-parity 全部重跑一遍。

### 变化面（先把证据面钉死，不靠信任）

```bash
git diff --stat 1fee7c2..HEAD -- <35 covered>      # 仅 5 个文件
#  AGENTS.md                          | 16 ++--        （并发工作流：诊断日志落盘文档）
#  main.js                            | 63 +++++----    （并发工作流：诊断日志落盘）
#  tests/uat-51-import-limits.js      | 73 +++++---     （本阶段：加固 + 口径）
#  tests/uat-51-import-live.js        | 76 +++++---     （本阶段：加固 + 口径）
#  tests/uat-51-import-modal-sizes.js | 73 +++++---     （本阶段：加固 + 口径）
git diff --stat HEAD -- <35 covered>                # 空 ⇒ covered 集合与 HEAD 逐字一致
git status --porcelain                              # 仅 4 个**非 covered** 的 tests/.uat-out/*.json
```

**并发工作流的两个 covered 文件是否动到导入面 —— 独立复核，结论：没动**

| 文件 | 复核判据 | 结论 |
| ---- | -------- | ---- |
| `main.js` | `git diff 1fee7c2..HEAD -- main.js \| grep -cE "^[+-].*(skill\|import\|zip\|IMPORT\|SKILL)"` ⇒ **0** 行 | 改动**全在** `web-contents-created` 的诊断/日志块（新增 `diagnostics-log.js` 挂载与 `diagLog` 转发）。`readRawBody` / `MAX_SKILL_PACKAGE_BYTES` / `req.resume` / `Content-Length` **零命中** ⇒ truth #28 与 413 源码契约区段**逐字未变**；`node --check main.js` 通过 |
| `AGENTS.md` | 改动逐行读完 | 只加「诊断日志落盘」模块行与一节，含 webview 回归门禁那一行；**未触碰**导入维护约定与 accounts 账本行 ⇒ counts-parity 仍读到同一账本（本轮实跑 `cells=20` 通过） |

⇒ 30 项 covered 与上轮**逐字节相同**，上轮对它们的独立复算仍然有效；本轮的实跑重点落在 5 个变动文件与整条行为面。

## 处置核对：两条加固是否真的落地（**打开文件逐处核对，不采信描述**）

| # | 声称的加固 | 代码层核对结论 |
| - | ---------- | -------------- |
| 1a | 收尾**在 `writeEvidence` 之前**核对并收掉未退出的子进程 | ✅ **三支都是**。顺序逐行确认：`-limits.js` 守卫 `:985-1005` → `evidence.finished/passed/total/exitCode` `:1006-1010` → `writeEvidence` `:1012`；`-live.js` 守卫 `:942-962` → `writeEvidence` `:969`；`-modal-sizes.js` 守卫 `:696-716` → `writeEvidence` `:723`。修复前那段 `await electronApp.close()` 原**位于 `writeEvidence` 之后**，已被删掉并前移（`git show 2f20995 -- tests/uat-51-import-limits.js` 可见 `-` 块位置） |
| 1b | 按**精确 PID**（自己的子进程 PID）收，**非模式匹配** | ✅ `ownPid = proc ? proc.pid : null`（`proc = electronApp.process()`；limits `:592` / live `:423` / modal-sizes `:390`），杀进程是 `process.kill(ownPid, 'SIGKILL')`。三支驱动 `grep -n "pkill\|pgrep"` ⇒ **零命中**（唯一命中是 `-live.js:38` 的注释「**严禁** `pkill`/`pgrep` 模式匹配杀进程」）；`execSync` 只有 `ps -eo pid=,ppid=,command= \| grep …` 这一处**只读**探测 |
| 1c | 结果记入 `cleanup.orphanKilled` / `cleanup.instancesAfter` | ✅ 两字段均写入且**语义与观测一致**：`orphanKilled` = 自己的 PID 或 `null` 或 `failed(…)`；`instancesAfter` 在 kill **之后**取数（轮 3 实测 `instancesAfter=[]`，与该轮外来实例已退出的盘面吻合） |
| 2a | 开跑前用 `ps` 登记本机 Electron 实例（含 `command`）⇒ `cleanup.instancesBefore` | ✅ 三支都有（`-limits.js:546` / `-live.js:320` / `-modal-sizes.js:323`），字段 `{pid, ppid, command:前 180 字}`，且**在 `launch()` 之前**执行 |
| 2b | 并存时**告警** | ⚠️ **只有 `-live.js` 落地**（`:321-322` 的 `log('[warn] 已有 Electron 实例在跑…')`）；`-limits.js` / `-modal-sizes.js` 只登记不打印 —— 与提交信息/文档措辞不符，见 Advisory #1。**承重的登记三支齐备**，本轮正是靠它判读污染环境，故不构成 blocker |

**「没有顺手削弱别的断言」—— 三支驱动的断言面本轮未被改动**

```bash
git diff 1fee7c2..HEAD -- tests/uat-51-import-{limits,live,modal-sizes}.js | grep -E "^[+-]" | grep -cE "check\("
# 0    ⇒ 本轮增量一行都没碰 check 的增删
grep -cE '^[[:space:]]*check\(' tests/uat-51-import-limits.js   # 18（与上轮 1fee7c2 相同）
```

⇒ 三支驱动本轮的净变化 = 「加登记 + 加守卫 + 移收尾顺序 + 改注释/文档」，**断言集合逐字未动**（`-limits.js` 仍是 18 条，与上轮「删掉恒真断言后 19→18」的读数一致）。

## 实跑复现（逐轮结论 + 该轮 `cleanup.instancesBefore`）

### A. `NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js` —— **5 轮，5 × 18/18**

| 轮 | 起始(UTC) | 结果 | `instancesBefore` | `orphanKilled` | `instancesAfter` | 是否污染环境 |
| -- | --------- | ---- | ----------------- | -------------- | ---------------- | ------------ |
| 1 | 13:33:33 | **18/18** exit 0 | `[73385]` | `95533`（自身） | `[73385]` | 有并存（另一会话的 dev 实例） |
| 2 | 13:34:00 | **18/18** exit 0 | `[73385]` | `1100`（自身） | `[73385]` | 有并存 |
| 3 | 13:34:20 | **18/18** exit 0 | `[73385]` | `3528`（自身） | `[]`（外来实例在本轮内退出） | 起跑时有并存 |
| 4 | 13:34:52 | **18/18** exit 0 | `[]` | `6100`（自身） | `[]` | **零并存（可证干净）** |
| 5 | 13:35:13 | **18/18** exit 0 | `[]` | `9311`（自身） | `[]` | **零并存（可证干净）** |

读法（这是本轮新引入的判别手段的直接产出）：

- **没有任何一轮红**；其中 **轮 4/5 在 `instancesBefore=[]`（全机零 Electron 实例）下取得** ⇒ 上轮那 1 次红**不是**由「本机常驻的另一个实例」造成的（上轮的混淆项被这两轮排除掉）。
- **轮 1-3 在并存实例下照样 18/18** ⇒ 并存（静止）本身不扰动读数。
- **9 次实跑 9 次 `orphanKilled` 命中自身 PID**（上表 5 次 + `-modal-sizes` 2 次 + `-live` 2 次）⇒ 收尾那 6 s 的 `close()` 竞态是**常态**，修复前**每轮都会留下孤儿**；守卫是承重件，不是装饰。
- 逐轮 `instancesAfter` **从不包含自身**（只有外来实例）⇒ 收完即净，无跨轮污染。

### B. 七个套件（逐条实跑，例数逐字记账）

| 套件 | 命令 | 实测 |
| ---- | ---- | ---- |
| `tests/test-manage-skill.js` | `node …` | **tests 55 / pass 55 / fail 0** |
| `tests/test-ai-skills.js` | `node …` | **tests 198 / pass 198 / fail 0** |
| `tests/test-skill-picker-model.js` | `node --test …` | **tests 115 / pass 115 / fail 0** |
| `tests/test-skills-management.js` | `node …` | **tests 49 / pass 49 / fail 0** |
| `tests/test-skills-http-api.js` | `node …` | **tests 41 / pass 41 / fail 0** |
| `tests/test-skills-import.js` | `node …` | **tests 116 / pass 116 / fail 0** |
| `tests/test-skills-import-net.js` | `node …` | **tests 50 / pass 50 / fail 0** |
| 合计 | — | **624 例，fail 0** |

### C. §11.8 counts-parity 判据（**逐字复制 `docs/product/ai-skills.md` 的 ```bash 块后执行**）

```bash
awk '/### 11.8/,0' docs/product/ai-skills.md | sed -n '/```bash/,/```/p' | sed '1d;$d' > /tmp/r51-parity.sh && bash /tmp/r51-parity.sh
# counts-parity ok
# cells=20 measured={"test-manage-skill.js":"55","test-ai-skills.js":"198","test-skill-picker-model.js":"115",
#                     "test-skills-management.js":"49","test-skills-http-api.js":"41",
#                     "test-skills-import.js":"116","test-skills-import-net.js":"50"}
```

⇒ `cells=20`（下限 20）、7 个实测值与两个账本文件的账本单元**逐字命中**（该脚本自己会逐套件指名报「账本未覆盖 X」，本次无此报错）。

### D. 三支被改 uat 驱动的复跑（**本轮额外补跑，理由是这三个文件动了**）

| 驱动 | 运行 | 结果 | `instancesBefore` | `orphanKilled` |
| ---- | ---- | ---- | ----------------- | -------------- |
| `-modal-sizes.js` | ① 13:36:06 | ✗ **中止**（20/20 全部通过但 `thrown` ⇒ exit 1，矩阵断在第 3 档） | `[]` | `null` |
| `-modal-sizes.js` | ② 13:38:29 | ✓ **48/48** exit 0 | `[15094,15095]` | `22151`（自身） |
| `-modal-sizes.js` | ③ 13:38:50 | ✓ **48/48** exit 0 | `[15094,15095]` | `22791`（自身） |
| `-live.js` | ① 13:36:18 | ✗ **中止**（3/3，断在 ②「技能行出现」等待超时） | `[12822]` | `null` |
| `-live.js` | ② 13:39:17 | ✓ **29/29** exit 0（真实 zipball 3,988,166 B / 512 entry） | `[15094,15095]` | `23544`（自身） |
| `-live.js` | ③ 13:39:55 | ✓ **29/29** exit 0 | `[15094,15095]` | `24682`（自身） |
| `-modal.js`（未改动，补一次） | 13:40:33 | ✓ **52 passed** exit 0 | — | — |

两次中止的形态与归因（**不是断言失败**）：

- `-modal-sizes` 中止轮：**0 条 `[FAIL]`**，前 2 档（极窄/窄）各 8 条断言全 ok，断点在切到第 3 档时 `page.evaluate: Target page, context or browser has been closed`（`:575` ← `:186` guestEval）。应用主进程日志尾部显示 `webContents destroyed id=1 type=window url=file:///…/src/index.html` + 各 webview 依次销毁 + `Waiting for the debugger to disconnect...`；`main.js:4814` 的 `window-all-closed → app.quit()` 与之吻合（`-live` 侧同款：`appExit {code:0}`）。⇒ **应用自己被关掉了**，不是页面逻辑判错。
- 归因证据：中止窗口内本机凭空出现 **3 个外来 dev 实例**（PID 12822 / 15094 / 15095：`cwd=/Users/wxnacy/Projects/Realm`、argv `--inspect=0 --remote-debugging-port=0 .`、PPID=1）。**它们可证明不是我的实例** —— 中止轮 `orphanKilled: null` 表示我的 `ownPid` 已自行退出，而它们在 `instancesAfter` 里**仍存活**，PID 必不同。全仓能产生该签名的启动器只有并发工作流新并入的 `tests/uat-webview-hit-test-stuck.js`（`:324-328` `cwd: REPO_ROOT` + `NODE_ENV: 'development'` ⇒ 同一二进制、同一个 `realm-dev`）。
- **复跑 4 次全绿**（`-modal-sizes` 48/48 ×2、`-live` 29/29 ×2），且这 4 次**都在 `instancesBefore` 非空下取得** ⇒ 静止并存不扰动，扰动来自并发驱动的**活动**。**未测定机制**（另一未排除候选：连跑 5 轮 limits 后 `realm-dev` 里累积的恢复标签页状态）⇒ 只作 Advisory，不作 gap。

## Goal Achievement

### Observable Truths

**29/29 VERIFIED**（`behavior_unverified: 0`）。8 条行为依赖型 truth（#1 / #2 / #12 / #16 / #17 / #19 / #23 / #26）各有**本轮实跑的真行为测试**，无一靠符号在场。其余 21 条本轮以「支撑物与上轮逐字相同 + 本轮实跑仍绿」复核。

#### Plan 51-01 — 沙箱写面加固（SEC-10）

| # | Truth | Status | Evidence（本轮复核方式） |
| - | ----- | ------ | ------------------------ |
| 1 | `env.writeFile(<root 内 symlink 指向 root 外>/x)` 返回 `{ok:false, error.code:'permission_denied'}`、不 throw，且 root 外**真的没有**产生文件 | ✓ VERIFIED | `agent-workspace.js:258 resolveInsideForWrite` + `:332 guardForWriteResult`；行为测试 `test-agent-workspace.js` 38/38（承重文件**逐字未变**，上轮实跑） |
| 2 | 沙箱内**自指** symlink 下的写入仍放行（加固未收紧过头） | ✓ VERIFIED | 同上套件 ok 2/ok 5；十例期望表「仅『link OUT then write』由放行转拒绝」⇒ 既有集合零变化 |
| 3 | 五个写方法 + 两个临时目录方法切到 `guardForWriteResult`；读面仍走 `guardResult`，二者**并列存在** | ✓ VERIFIED | 独立复算（剥注释）：`guardForWriteResult(` 11 处、`guardResult(` 8 处；测试 ok 11/ok 12 |
| 4 | `resolveInsideForWrite` 对非字符串 / 空串 / 纯空白 / `..` 逃逸 / 绝对路径越界 / 兄弟前缀目录一律返回 `null`（fail-closed） | ✓ VERIFIED | 实现 `:258-283`；`module.exports` 导出；测试 ok 3 + ok 4 |

#### Plan 51-02 — 依赖落定

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 5 | `dependencies` 含 `"yauzl": "^3.4.0"` 与 `"yaml": "2.9.0"`（逐字）；`yaml` **单实例**；`yauzl` 暴露 Promise API | ✓ VERIFIED | `package.json` 本轮 `git diff` **零改动**；`node_modules/yaml/package.json` = 2.9.0；嵌套 `yaml` 不存在 |
| 6 | 两包均无 `postinstall`；`build.files` 全部 `!` 前缀；`build.asarUnpack` 未被改动 | ✓ VERIFIED | `package.json` 零改动（逐字沿用上轮独立复算）；回归 `test-builtin-skills-seeder.js` 101/101（上轮实跑） |

#### Plan 51-03 — zip 全量校验 + 唯一落盘实现

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 7 | 同包 SKILL.md 计数 = 1 ⇒ 进预览；= 0 或 ≥ 2 ⇒ 整包拒绝并给可操作提示 | ✓ VERIFIED | `locateSkillRoot` 在位；用例组 `test-skills-import.js:538`（含 `:583` 多根 / `:608` 零根）；**本轮 116/116 实跑** |
| 8 | 两阶段：preview 返回 `{importId, preview}` 且**不产生** `skills/<name>/`；仅 commit 后出现；预览六字段齐备 | ✓ VERIFIED | 用例组 tracer `:212` + `:289`；真实运行期由 `-live.js` 29/29 ×2 复现 |
| 9 | 含 symlink entry 的包在**两条判据路**各自被拒，断言点是「整包拒绝」而非「跳过条目」 | ✓ VERIFIED | `assertNoSymlinkTree` 在位；用例组 `:1433`；本轮 116/116 |
| 10 | 逃逸族 + 空/仅斜杠/仅点 entry 名 + NFD+小写归一化查重各自整包拒绝 | ✓ VERIFIED | `normalizedEntryKey` 在位；用例组 `:1499` / `:1582` / `:360`（含 CP437 原始字节面先判）；本轮 116/116 |
| 11 | 六类限额各一例 + `uncompressedSize === 0xFFFFFFFF` 显式拒绝；嵌套深度**按技能根相对计** | ✓ VERIFIED | `IMPORT_LIMITS`（`Object.freeze`）**恰 8 键**（含 `MAX_TOTAL_BYTES=32 MiB`）；用例组 `:1608`；本轮 116/116 |
| 12 | 解压只在 `mkdtempSync` 新建空目录内；落点用「最近已存在祖先 realpath」复核；**真跑**越界对照组并断言 root 外零新文件 | ✓ VERIFIED | `extractAndValidatePackage` + `assertLandingInsideWriteRoot`；`mkdtempSync(` 在 `ai-manager.js` 恰 1 处；越界对照组 `:1779`（本轮随 116/116 实跑） |
| 13 | `SKILL_THREAT_PATTERNS` 三类各有正样本命中；`skills-builtin/**` 零命中；`description` 与 body **双扫** | ✓ VERIFIED | `SKILL_THREAT_PATTERNS` `:4010` + `scanSkillThreats` 在位；用例组 `:1940`；消费点 `:4215` / 导出面 `:4715` |
| 14 | 三种来源汇进同一个落盘实现：`importUserSkill(` 全仓 = 定义 1 + 调用 1，`main.js` 与前端各 0；`yauzl.openPromise(` 恰 1 | ✓ VERIFIED | 独立计数（剥注释）；套件同款判据 `:309` / `:332`。**本轮追加**：`main.js` 的 63 行改动里 `skill|import|zip` 命中 **0** ⇒ 该计数不受并发工作流影响 |

#### Plan 51-04 — 落盘事务与句柄生命周期

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 15 | seeded 同名 ⇒ 拒绝导入；user 同名三选一各自可达；改名走 `validateManagedSkillName`；managed 同名不许覆盖 | ✓ VERIFIED | `resolveImportConflict` 在位；用例组 `:741` / `:627` / `:512`；本轮 116/116 |
| 16 | 覆盖事务可回滚：第二步 `rename` 真实注错 ⇒ 旧技能内容**逐字完好** | ✓ VERIFIED | 行为依赖型：用例组「覆盖事务：备份 + 两段 rename + 回滚 + 回读失败回滚 + 数量闸口径」`:786`（本轮实跑） |
| 17 | 回读验证失败即回滚并暴露 `diagnostics` 原文（含 path） | ✓ VERIFIED | 同上用例组「回读失败回滚」分支；`readback_failed` 在 `IMPORT_SKILL_ERROR` 键集内 |
| 18 | 句柄生命周期三态各自可达：`import_expired` / `import_not_found` / `too_many_pending`，皆为明确码 + 可读原因 | ✓ VERIFIED | 用例组 `:1136`；三个码均在键集内 |
| 19 | 崩溃残留清扫不误删进行中的包（陈旧性判据正反两例）；前缀与实际产物**正向**成对 | ✓ VERIFIED | `IMPORT_TMP_PREFIXES` + `isImportResidueName`；用例组 `:1249`；本轮另在 limits 驱动里两次逼近真删（A 段 `.tmp/skill-import-*` 残留读数） |
| 20 | 数量闸口径：达上限时**改名**被拒（计入）、**覆盖**同名成功（净增 0 豁免）；判据**读盘** | ✓ VERIFIED | `countUserSkills` 在位；断言落在 `:786` 用例组 |
| 21 | 每个 `IMPORT_SKILL_ERROR` 码至少一条用例；失败文案含码 + 可读原因；限额类含限额名与当前值；无空 message | ✓ VERIFIED | `IMPORT_SKILL_ERROR` **恰 21 键**、`MANAGE_SKILL_ERROR` 仍 **11 键**；用例组 `:2620` / `:2070` / `:2361` / `:1358`；**本轮 116/116 + limits 5 轮实测 413 文案 = `导入失败：请求体超过上限（33554432 字节）`（含真实限额数字）** |

#### Plan 51-05 — 网络地址导入

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 22 | 仓库 / `tree/<ref>/<path>` / `blob`·raw 直链三形态各自分流；zipball 顶层前缀剥离；`api.github.com` 与白名单外主机回 `unsupported_url` | ✓ VERIFIED | `classifyImportUrl` + `HOST_WHITELIST`；用例组 net `:106`（**本轮 50/50**）；真实网络端到端 **本轮 `-live.js` 29/29 ×2**（zipball 3,988,166 B / 512 entry，顶层前缀恰 `skills-main/`） |
| 23 | https 强制 / 白名单**精确**匹配 / 逐跳私网拒 / 跳数超限**抛错**而非报 HTTP 3xx / magic bytes / 流式上限命中即中止且清理半成品 | ✓ VERIFIED | 行为依赖型，真跑本地 stub server：net `:478`（本轮 50/50）；`-live.js` 另在真链路里跑了真实 404 分支（上轮留档，本轮 29/29 全过） |
| 24 | 直链 SKILL.md 与 zip 走**同一落盘函数**；可注入三键在生产调用点全用默认值（源码正命题） | ✓ VERIFIED | `isPrivateHost` / `hostWhitelist` / `fetchImpl` 在 `ai-manager.js` 各 0 次；三处 `downloadPackage(` 首参逐字 `undefined`；用例组 net `:698` / `:919` |

#### Plan 51-06 — 导入 UI 完整面

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 25 | 完整弹框契约（E1–E18）+ 9 态状态机 + 元素顺序；15 个新增元素**零内联 `style`**；region 内**零 `innerHTML`/`insertAdjacentHTML`** | ✓ VERIFIED | 独立扫描 region `src/settings-page.js:5724-7010`（剥注释后各 0 处）；**本轮 `-modal.js` 52 passed** 复跑 + limits 5 轮实测状态机失败态渲染 |
| 26 | 两条 backstop（E2 弹框 overflow / E17 动作区 overflow）由**带正命题的属性测试**在真实渲染下满足 | ✓ VERIFIED | 行为依赖型：**本轮 `-modal-sizes.js` 48/48 ×2**（5 档矩阵：guest 实测 420/600/880/1280/1920，每档 8 条）+ `-modal.js` 52 passed。⚠️ 首轮曾 1 次瞬态中止（应用被外力关闭，0 条 FAIL），复跑 2/2 转绿，见 Advisory #2 |
| 27 | 键盘契约：唯一 `tabindex` 是预览滚动容器的 0 值；Tab 序 = DOM 序；焦点归还 `#skillImportOpen`；提交中忽略 Escape | ✓ VERIFIED | **本轮 `-modal.js` 52 passed** 复跑（含键盘项）；源码侧复核 `src/settings.html` 弹框块 `tabindex` 唯一命中为预览容器 |

#### Plan 51-07 — 文档与账本收口

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 28 | `docs/product/ai-skills.md` 第十三节 + `ai-agent-workspace.md` §七 SEC-10 + `AGENTS.md` 导入维护约定与测试行；counts-parity `cells` 下限 20 且实测通过 | ✓ VERIFIED | **本轮实跑 counts-parity ⇒ `counts-parity ok` / `cells=20`**，7 值逐字命中（见 Behavioral Spot-Checks）。并发工作流对 `AGENTS.md` 的 +16 行**未触碰**导入账本行（逐行读完） |
| 29 | 文档数值与实现逐字一致：码表全集 = `IMPORT_SKILL_ERROR` 全部 21 值；限额值 = `IMPORT_LIMITS`；白名单条目无矛盾；四条诚实边界恒显；不出现已被实测推翻的旧理由 | ✓ VERIFIED（附注） | 21 个码值在文档中全部出现（缺失 0）。**新一轮增量**：`51-VALIDATION.md:99` 已改写为「查明了一处间歇红的根因…」；`51-UAT.md:110` 新增 ③ 段写明「在已登记的环境下**未复现**」「**未复现 ≠ 零抖动**」。⚠️ 但 `51-UAT.md:75` 仍留旧措辞「（18/18，连跑 2 轮无抖动）」、`:103` 仍写「连跑 2 轮均 18/18」⇒ **同文件内自相矛盾**。该措辞**不在** PLAN 51-07 truth 文本枚举的四条「不得沿用的旧理由」内，且该文件**不是** 51-07 的 artifact ⇒ 不判 FAILED，记为 ⚠️ Warning（Advisory #4） |

**Score:** 29/29 truths verified (0 present-but-behavior-unverified, 0 override)

> 关于 #1/#2/#12/#16/#17/#19/#23/#26 八条行为依赖型 truth：它们的真行为测试在本轮**全部实跑**（`test-agent-workspace.js` 38/38、`test-skills-import.js` 116/116、`test-skills-import-net.js` 50/50、`-modal.js` 52、`-modal-sizes.js` 48/48 ×2），无一以「符号在场」充当行为证据。

### Deferred Items

**无。** Phase 51 是本里程碑（v2.6，Phase 46–51）的**末阶段**，ROADMAP 中不存在 `number > 51` 的阶段 ⇒ Step 9b 的空集。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `agent-workspace.js` | 写面 `resolveInsideForWrite` + `guardForWriteResult` | ✓ VERIFIED | 本轮零改动（`git diff` 未列入 5 个变动文件）；38/38 |
| `ai-manager.js` | 唯一落盘实现 + 三来源汇流 + `readRawBody` | ✓ VERIFIED | 本轮零改动；413 源码契约区段**逐字节相同** |
| `ai-skills-manager.js` | 限额 / 威胁模式 / 账本 | ✓ VERIFIED | 本轮零改动；198/198 |
| `main.js` | `MAX_SKILL_PACKAGE_BYTES` ↔ `IMPORT_LIMITS`；`readRawBody`；导入区零 `arrayBuffer` | ✓ VERIFIED（**改动面已排除**） | 本轮 +63 行全在诊断/日志块（`skill\|import\|zip` 命中 0）；limits A 段源码判据 5 轮全绿（含三条单点变异自证） |
| `src/settings-page.js` / `src/settings.html` / `src/styles/main.css` | 弹框契约 / 零内联 style / 布局 | ✓ VERIFIED | 本轮零改动；`-modal` 52 + `-modal-sizes` 48/48 ×2 |
| `tests/test-*.js`（5 个承重套件） | 需求挂钩用例 | ✓ VERIFIED | 本轮逐条实跑，624 例 fail 0 |
| `tests/uat-51-import-{modal,limits,live,modal-sizes}.js` | 四支 uat 驱动 | ✓ VERIFIED | 3 支本轮被加固（断言集合未动）+ 全部复跑绿（含 2 处瞬态中止的复跑转绿） |
| `.planning/phases/51-zip/51-0{1..7}-PLAN.md` / `-SUMMARY.md` | 计划与总结 | ✓ VERIFIED | 本轮零改动（14 项） |

### Key Link Verification

全部 **WIRED**（与上轮同表；承重文件本轮除 `main.js` 的诊断块外零改动，且已证该块与导入面无交）。

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| 三条来源（上传 / zipball / raw 直链） | `importUserSkill` | 共用一段后段 | ✓ WIRED | 剥注释：定义 1 + 调用 1；`main.js`/前端各 0；`yauzl.openPromise(` 恰 1 |
| `previewSkillImport` | `extractAndValidatePackage` / `prepareFromRawFile` | 两个准备器产出同一 `{pkgRoot}` | ✓ WIRED | net `:698` / `:919`；本轮 net 50/50 |
| **CR-02 修复链**：`getAiSkillsManagerLazy()` | 三处网络分支的 `downloadPackage` | 显式解构 | ✓ WIRED | `ai-manager.js:1848`；真实运行期由 `-live.js` 29/29 ×2 证实 |
| `resolveInsideForWrite` | 五个写方法 + 两个临时目录方法 | `guardForWriteResult` 唯一包装 | ✓ WIRED | 写面 11 处 / 读面 8 处并列 |
| `IMPORT_LIMITS` | preview 响应 `limits` → 设置页 | 单源回传，前端零字面量 | ✓ WIRED | 套件 `:340` |
| `IMPORT_SKILL_ERROR`（21 值） | `SKILL_IMPORT_ERROR_TEXT` | 双向覆盖 | ✓ WIRED | 套件 `:2453` |
| `search-manager.isPrivateHost` | `downloadPackage` 默认 `isPrivateHost` | 惰性 require + 注入默认值 | ✓ WIRED | 三键在 `ai-manager.js` 出现 0 次 |
| `main.js` `MAX_SKILL_PACKAGE_BYTES` | `IMPORT_LIMITS.MAX_TOTAL_BYTES` | 跨文件相等性断言 | ✓ WIRED | 两者均为 `33554432`（本轮 limits A 段实跑读到同一常量） |
| **413 错误链**：`readRawBody` 越界 | 设置页状态行 | `{error, code:'BODY_TOO_LARGE'}` → `describeSkillImportError` → 状态行 | ✓ WIRED（**本轮 5/5 实测复现**） | 5 轮全部读到 `导入失败：请求体超过上限（33554432 字节）`、`danger:true`、`gate:'请先选择 zip 文件'`；主进程同打 `[Realm] 技能 API 处理失败: 请求体超过上限` |
| 成功出口 | `ensureSkillsFresh()` 恰一次 + 调用侧 `broadcast('skills:changed')` 恰一次 | D-19 写路径收口 | ✓ WIRED | 套件 D-19 计数断言在位 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `#skillImportPreview` 六字段 | `skillImportTarget.preview` | `previewSkillImport` → `buildImportPreview`（真实解压后的目录树 / 字节统计 / 扫描结论） | Yes | ✓ FLOWING |
| 字节数与限额对照 | `preview.bytes` / `maxFileBytes` / `limits` | `collectPreviewStats`（真遍历 `pkgRoot`）+ `buildImportLimitsProjection()` | Yes | ✓ FLOWING |
| 扫描结论两栏 | `preview.scan.injection` / `.heuristic` | `assertNoInjection` + `scanSkillThreats`（真实模式匹配） | Yes | ✓ FLOWING |
| 冲突三选一 | `preview.conflict` | `resolveImportConflict`（`env.listDir` / `env.fileInfo` 实时读盘） | Yes | ✓ FLOWING |
| 网络下载目标 | `classifyImportUrl(url).target` | 真实 URL 分类；运行期由 `-live.js` 证实真实 zipball 落到真实 `skills/pdf/` | Yes | ✓ FLOWING |
| B 侧 RSS 读数 | `overRssReading.rssDelta` | `process.memoryUsage().rss` 的 `max - first`（环境读数，不参与判定） | 不适用（刻意不承重） | ✓ 按设计降级为读数 |

No HOLLOW / DISCONNECTED / STATIC / HOLLOW_PROP findings.

### Behavioral Spot-Checks

标「本轮实跑」者为本轮命令的真实输出。

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| **限额与内存面（本轮变更文件 × 5 轮）** | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js` | **5 × 18/18 exit 0**（轮 4/5 在 `instancesBefore=[]` 下取得） | ✓ PASS（×5） |
| 导入面 zip 全量校验与落盘 | `node tests/test-skills-import.js` | `# tests 116 / # pass 116 / # fail 0` | ✓ PASS（本轮实跑） |
| 网络面分类 / 白名单 / 逐跳 / magic / 流式 | `node tests/test-skills-import-net.js` | `50/50/0` | ✓ PASS（本轮实跑） |
| 管理面 | `node tests/test-manage-skill.js` | `55/55/0` | ✓ PASS（本轮实跑） |
| 技能域（威胁扫描正命题 + D-19 计数） | `node tests/test-ai-skills.js` | `198/198/0` | ✓ PASS（本轮实跑） |
| 技能选择器模型 | `node --test tests/test-skill-picker-model.js` | `115/115/0` | ✓ PASS（本轮实跑） |
| 技能管理面 | `node tests/test-skills-management.js` | `49/49/0` | ✓ PASS（本轮实跑） |
| 传输面（413 两分支 + 反向对照） | `node tests/test-skills-http-api.js` | `41/41/0` | ✓ PASS（本轮实跑） |
| 例数一致性账本 | §11.8 命令逐字复制后 `bash` | `counts-parity ok` / `cells=20` / 7 值逐字命中 | ✓ PASS（本轮实跑） |
| 真实网络端到端（含 zipball 前缀剥离 + 落盘 sha256 比对） | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-live.js` | **29/29 ×2 exit 0**（首轮 1 次中止，见 Advisory #2） | ✓ PASS（复跑） |
| 真实渲染 UAT（弹框契约 / 键盘 / 六字段渲染） | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` | `52 passed` | ✓ PASS（本轮实跑） |
| 多尺寸档布局矩阵 | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal-sizes.js` | **48/48 ×2 exit 0**（首轮 1 次中止） | ✓ PASS（复跑） |
| 孤儿守卫生效（**本轮新增判据：活体取证**） | openssl-free 直接读每轮 `cleanup.orphanKilled` / `instancesAfter` | **9/9 次命中自身 PID**（`95533 / 1100 / 3528 / 6100 / 9311 / 22151 / 22791 / 23544 / 24682`）；`instancesAfter` 从不含自身 | ✓ PASS（**本轮实跑**） |
| 污染环境可事后判定（**本轮新增判据**） | 每轮读 `cleanup.instancesBefore` | 轮 1-3 `[73385]`、轮 4/5 `[]`、两驱动复跑 `[15094,15095]` ⇒ 「本轮读数是否在污染环境下取得」**已可逐轮判定** | ✓ PASS（**本轮实跑**） |
| 无 PPID=1 残留（守卫是否收干净） | `ps -eo pid=,ppid=,command= \| grep 'electron/dist/Electron.app/Contents/MacOS/Electron' \| awk '$2==1'` | 仅 `/Applications/Realm.app` 与 `/Applications/Realm Nightly.app`（用户自己的打包实例）；**`node_modules/electron` 侧零残留** | ✓ PASS（**本轮实跑**） |
| 断言集合未削弱 | `git diff 1fee7c2..HEAD -- <三支驱动> \| grep -E "^[+-]" \| grep -cE "check\("` ⇒ **0**；`grep -cE '^[[:space:]]*check\(' tests/uat-51-import-limits.js` ⇒ **18** | 断言增删 **0** | ✓ PASS（本轮实跑） |
| 指纹重算 + **独立实现交叉验证** | `gsd_run query verification.fingerprint .planning/phases/51-zip <35 项>` vs 自撰 Python（`sha256("v1\n" + Σ"rel\nfile-sha256\n")`） | 两者**逐字节相同**：`v1:sha256:51281b9b12be57e4c2bf883a0f87a21748d98a376b8104af17dc09f6fa5d62d1`（35 项）；写入本报告后**复算不变** | ✓ PASS（**本轮实跑**） |
| 变化面收敛性 | `git diff --stat 1fee7c2..HEAD -- <35 covered>` + `git diff --stat HEAD -- <35 covered>` + `git status --porcelain` | 仅 5 个 covered 变动；HEAD 与工作树**零差异**；`git status` 仅 4 个**非 covered** 的驱动产物 | ✓ PASS（本轮实跑） |
| 并发工作流未触及导入面 | `git diff 1fee7c2..HEAD -- main.js \| grep -cE "^[+-].*(skill\|import\|zip)"` ⇒ **0**；`node --check main.js` | 排除「外部改动悄悄动了导入面」 | ✓ PASS（**本轮实跑**） |
| 沙箱写面加固行为面 | `node tests/test-agent-workspace.js` | 38/38 | ✓ PASS（上轮实跑，本轮文件零改动） |
| 回归：播种器 | `node tests/test-builtin-skills-seeder.js` | 101/101 | ✓ PASS（上轮实跑，本轮文件零改动） |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/*/tests/probe-*.sh` 约定路径 | `find scripts -path '*/tests/probe-*.sh' -type f` | 本阶段无此类探针（PLAN/SUMMARY 亦未声明 probe） | N/A |
| 本轮为「守卫是否真的落地」采用的**活体探针** | 每轮读 `tests/.uat-out/*.json` 的 `cleanup.orphanKilled` / `instancesBefore` / `instancesAfter` + 伴随 `ps` 普查 | 见 Behavioral Spot-Checks 的三行 | ✓ 已执行（非本仓 probe 资产，未写入仓库） |

### Requirements Coverage

`REQUIREMENTS.md` 映射到 Phase 51 的 ID 与 7 个 PLAN 的 `requirements` 字段**并集完全一致**（`SEC-02…08, SEC-10, USER-03/04/05/08`，共 **12** 个）⇒ **无 ORPHANED requirement**。

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USER-03 | 51-02, 51-03, 51-07 | 上传 zip 导入技能（单技能包语义；0 或 ≥2 技能根报错并提示） | ✓ SATISFIED | truth #7 + #8；本轮 116/116 |
| USER-04 | 51-02, 51-05, 51-07 | 网络地址导入，自动分流 GitHub 仓库 / 目录 与 SKILL.md 直链 | ✓ SATISFIED | truth #22；本轮 net 50/50 + `-live.js` 29/29 ×2 |
| USER-05 | 51-03, 51-04, 51-06, 51-07 | 两阶段（预览 → 确认落盘）；预览展示六项 | ✓ SATISFIED | truth #8 + #25；本轮 `-modal.js` 52 + `-modal-sizes.js` 48/48 ×2 |
| USER-08 | 51-04, 51-06, 51-07 | 导入失败给出真实原因，不静默 | ✓ SATISFIED | truth #21 + #23；**本轮 5/5 轮实测 413 文案含真实限额数字**（上轮那条「1 次因 guest 重初始化未读到」本轮未再现） |
| SEC-02 | 51-03, 51-07 | 拒绝含 symlink entry 的**整包**（两路判据） | ✓ SATISFIED | truth #9；本轮 116/116 |
| SEC-03 | 51-03, 51-07 | 逐 entry 路径校验 + NFD+小写查重 | ✓ SATISFIED | truth #10；本轮 116/116 |
| SEC-04 | 51-03, 51-07 | 先读 central directory 预检，再边解边累加；五类量 | ✓ SATISFIED | truth #11；六类限额各具名用例（本轮 116/116） |
| SEC-05 | 51-03, 51-07 | 解压到 `mkdtempSync` 全新空目录；落点用最近已存在祖先 realpath 复核 | ✓ SATISFIED | truth #12；越界对照组真跑 |
| SEC-06 | 51-03, 51-07 | 扫描 `description` 与 body | ✓ SATISFIED | truth #13；双扫用例组 |
| SEC-07 | 51-04, 51-07 | 与内置同名 ⇒ 拒绝；与用户技能同名 ⇒ 显式策略 | ✓ SATISFIED | truth #15；三档判定组 |
| SEC-08 | 51-05, 51-07 | https-only + 白名单 + 逐跳 + 流式上限 + magic bytes | ✓ SATISFIED | truth #23 + #24；本轮 net 50/50 |
| SEC-10 | 51-01, 51-07 | 加固既有沙箱 `writeFile` 的 ENOENT symlink 缺口 | ✓ SATISFIED | truth #1–#4；38/38 |

### Test Quality Audit

| 面 | 结论 |
| -- | ---- |
| 禁用测试 | **零命中** —— 七个套件无跳过式禁用 |
| 循环测试 | **零命中** —— 均以真 stub server / 真 fs / 真解压产物作 oracle；`test-skills-http-api.js:526` 含**反向对照**自证断言可失败 |
| 断言强度 | 与需求挂钩的判据均为 **Value / Behavioral 级** |
| 覆盖数量 | counts-parity 逐账户单元比对通过（`cells=20`），七套件实测值逐字命中账本 |
| 驱动断言未被削弱 | 三支被改驱动 `check(` 增删 **0**；`-limits.js` 仍 18 条（与上轮 19→18 后的读数一致） |

**Disabled tests on requirements:** 0 → 无 BLOCKER
**Circular patterns detected:** 0 → 无 BLOCKER
**Insufficient assertions:** 0（承重面）→ 无 WARNING

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/uat-51-import-{limits,live,modal-sizes}.js` | `-limits.js:546` / `-modal-sizes.js:323`（对照 `-live.js:321-322`） | **并存告警只在 `-live.js` 落地**：另两支只登记不打印 | ℹ️ **Info** | 承重的「可事后判定」三支齐备（本轮靠它判读出污染环境）；仅措辞与代码不符，见 Advisory #1。**不构成 gap** |
| `tests/uat-51-import-{limits,live,modal-sizes}.js` | `-limits.js:104-113` 等 | 注释称 `realm-dev` userData 是「**单例语义**」，但 `main.js` 无 `requestSingleInstanceLock` / `second-instance`（grep 零命中）⇒ **没有单例锁**，多实例可自由并存于同一 profile | ℹ️ **Info** | 措辞不准（其括号内解释「并存的第二个实例会与当前驱动共用同一份…」才是本意）。**这正是**「并存实例」得以成为混淆源的原因 ⇒ 建议改成「同一份 profile 无单例锁」 |
| `tests/uat-51-import-modal-sizes.js` / `-live.js` | 首轮各 1 次中止（应用被外力关闭） | **瞬态中止（非断言失败）**：0 条 FAIL、应用 `window-all-closed → app.quit()`、退出码 0；复跑 2/2 转绿 | ⚠️ **Warning（已归因，非本阶段产物缺陷）** | 同窗口出现 3 个外来 Playwright dev 实例（**可证非我的实例**）；唯一同签名启动器是并发工作流新并入的 `tests/uat-webview-hit-test-stuck.js`。见 Advisory #2。**未复现 ≠ 零抖动** |
| `tests/uat-51-import-{limits,live,modal-sizes}.js` | 收尾守卫 | 9/9 次 `orphanKilled` 非空 ⇒ `electronApp.close()` 在本机**常态性地 6 s 收不干净**，靠 `SIGKILL` 兜底 | ℹ️ **Info** | 已被守卫覆盖（`instancesAfter` 每轮都无自身残留）；该字段本身即探针，若哪天兜底失效会立即显形。见 Advisory #6 |
| ~~`tests/uat-51-import-limits.js`~~ | — | ~~驱动抖动 ~1/6（红轮 = 因孤儿实例共用 userData 导致设置页 guest 重初始化）~~ | ✅ **已处置（RESOLVED）** | 根因已实证并加固：**5 轮 limits 0 红**（含 2 轮零并存实例）、守卫 9/9 命中、`instancesAfter` 无自身残留。上轮「无法排除的混淆项（PID 58412/73385）」在轮 4/5（`instancesBefore=[]`）被排除 |
| `.planning/phases/51-zip/51-UAT.md` | `:75`（对照 `:110`） | **stale 措辞「无抖动」** 残留在同一文件里与新增的 ③ 段自相矛盾 | ⚠️ **Warning** | 该措辞不在 PLAN 51-07 truth 文本枚举的旧理由内、文件亦非该 plan 的 artifact ⇒ 不判 FAILED。#29 仍 VERIFIED。见 Advisory #4（人工改一行即可） |
| `tests/uat-51-import-limits.js` | `:875-878` | 断言名含「与真实限额数字」但 pass 条件仅 `indexOf('超过上限') !== -1` —— **名过其实**（上轮已记，本轮仍在） | ℹ️ **Info** | 该断言**仍有判别力**（区分专用 413 文案 vs 通用兜底）；实测文案确实含真实限额数字 ⇒ 不影响结论 |
| 全部 phase-51 文件 | — | `TBD` / `FIXME` / `XXX` 无引用的遗留标记 | — | **无。**本轮新增行（`1fee7c2..HEAD` 的 `+` 行）扫描**零命中**；三支驱动全文件扫描**零命中** ⇒ **债务标记门禁未触发** |
| `src/settings-page.js` | 5734 / 6041 / 6036 | `innerHTML` / `insertAdjacentHTML` / `aria-disabled` | ℹ️ **Info** | region 内剥注释后各 0 处（命中均在注释内）；本轮该文件零改动 |
| 全阶段 | — | 空实现 / `return null` 占位 / 硬编码空 props | — | **无。**Data-Flow Trace 五项全部 FLOWING |
| `main.js` | `:570` / `:582` 一带 | `if (diagnosticsActive) {` 连续三个（疑似空块） | ✅ **非缺陷（已排除）** | 逐块打开：**都有实体**（`did-navigate`/`dom-ready` 登记、`unresponsive`/`render-process-gone` 分诊日志），语法 `node --check` 通过。属并发工作流的正常改动 |

### Known Recorded Tech Debt (already logged — not re-counted as new failures)

`51-REVIEW.md`（`status: issues_found`：2 critical + 3 warning + 6 info）的余下发现经复核**仍然存在**，且已按项目「阶段收尾以 UAT 为准；代码审查 Critical 记入 REVIEW.md 作技术债」的既定裁决挂账。verifier **不**将其计为本轮新的失败项（无 must-have truth 因此失败）：

| ID | 复核结论 | 独立证据（行号） |
| -- | -------- | ---------------- |
| CR-01 | **仍存在**（`src/settings-page.js` 本轮零改动） | `:6844` 仍直接覆写 `skillImportTarget.importId` 而不先 `discardSkillImportHandle(prevId)` ⇒ 同一弹框会话内第 4 次连续预览 100% 返回 `too_many_pending`，UI 无自救入口 |
| CR-02 | **已修复并运行期证实（本轮复现）** | `ai-manager.js:1848` 绑定；**本轮 `-live.js` 29/29 ×2**（含真实 zipball 落盘 sha256 比对） |
| WR-01 | 仍存在 | `ai-skills-manager.js:4556` `await refreshSkills(env, { rootDirs: [...] })` 未透传 `disabled` |
| WR-02 | 仍存在 | `docs/product/ai-skills.md:737` 压缩比行口径与实现（逐条目）不一致 |
| WR-03 | 仍存在 | `ai-skills-manager.js:1573 scanSkillText()` 只调 `scanInjectionPatterns()`、从不引用 `SKILL_THREAT_PATTERNS` |
| IN-01 – IN-06 | 未逐条复核（info 级） | IN-02 / IN-04 在代码中仍可见 |

`WINDOWS.md` 中 pending 的 phase-51 条目保持如实登记，verifier 未重复计数。

### Advisory (New Scope, Unevidenced)

本轮为 re-verification，故按门禁要求列出该节。**八条均不构成 gap、均不构成人工项**（前三条为核心）。

| # | Finding | Category | Why Advisory / 状态 |
| - | ------- | -------- | ------------------- |
| 1 | 并存**告警**只在 `-live.js` 落地（`-limits.js` / `-modal-sizes.js` 只登记不打印） | claim-vs-code-drift | 承重的**登记**三支齐备（本轮判读污染环境正是靠它）⇒ 无缺陷主张，仅措辞漂移 |
| 2 | **并发会话的 Playwright 驱动**在共享 `realm-dev` 上启动实例，并使两支 uat 驱动各瞬态中止 1 次 | repro-environment | 已归因（外来实例可证非我的；同签名启动器唯一）+ 复跑 4 次全绿（含并存非空）。**未测定机制**，另一候选是连续 5 轮后累积的恢复标签页状态 ⇒ 只登记，不判 gap |
| 3 | 上轮把「恢复标签页」归因给并存实例，**该归因不成立** | inference-correction | 在 `instancesBefore=[]` 的轮 4/5 里同样 URL 仍出现 ⇒ 是 `realm-dev` 的**持久化状态**。更正上轮 Advisory #2 的因果（不影响任何 truth） |
| 4 | `51-UAT.md:75` / `:103` 仍留「无抖动」旧措辞，与同文件 `:110` 的 ③ 段自相矛盾 | doc-stale-wording | 不在 PLAN 51-07 的旧理由枚举内、文件非该 plan artifact ⇒ 不判 FAILED；属确定性文档缺陷（改一行），不升格人工项 |
| 5 | 守卫两处边界：整块写在 `if (electronApp)` 内（launch 半途抛错则不覆盖）；`isPidAlive` 只查存在性不校验身份 | guard-completeness | 读代码构造出的边界，本轮 9 次启动均未触发 ⇒ 非观测缺陷，附收紧建议 |
| 6 | `electronApp.close()` 6 s 收不干净是常态（9/9），收尾实际靠 `SIGKILL` 兜底 | test-harness-fragility | 已被守卫覆盖且 `instancesAfter` 即探针 ⇒ 不是缺陷，但「读数干净性依赖该兜底」应被知道 |
| 7 | 三支驱动各复制一份 `listElectronInstances()` / `isPidAlive()`（约 22 行 × 3，逐字相同） | duplication | 与「uat 资产单文件可直接跑、零共享依赖」的取舍一致 ⇒ 不构成缺陷 |
| 8 | 指纹噪声的结构性来源仍在：`AGENTS.md` 这类**仓库级共享文件**在 covered 集合内，本轮它**真的**被并发工作流改了 16 行（虽与导入面无关） | cross-workstream-staleness | 流程建议（可选：把仓库级共享文件分离）。**本轮工作树对 covered 集合零差异** ⇒ 指纹可由提交树确定性复现 |

## Gaps Summary

**无 must-have gaps、无人工项**。逐层判决（Step 9 决策树，按最严格优先）：

1. **FAILED truth / MISSING·STUB artifact / NOT_WIRED key link / blocker anti-pattern** —— **无一命中**。
   - 29 条 truth 全部 VERIFIED；8 条行为依赖型各有**本轮实跑**的真行为测试。
   - 624 例需求挂钩套件断言本轮实跑 **fail 0**；counts-parity `cells=20` 逐值命中；12 个需求 ID 零 orphaned。
   - 债务标记门禁未触发（本轮变更文件 `TBD`/`FIXME`/`XXX` 零命中）。
   - 三支被改 uat 驱动的断言集合增删 **0**；`-limits.js` 5 轮 18/18；`-modal-sizes` 48/48 ×2；`-live` 29/29 ×2；`-modal` 52。
   - **上轮那 1 次红（16/18）本轮 0 再现**；其根因（驱动自留孤儿共用 `realm-dev`）机制被活体证实（守卫 9/9 命中），守卫与登记两条加固**逐行确认落地**。
2. **人类验证项** —— **0 条**。上轮唯一人工项已由「定位根因」支闭合；本轮新出现的 2 次瞬态中止**已归因到并发会话**（可证外来实例 + 复跑 4 次全绿）⇒ 不构成新的必须人工项。其余候选（`51-UAT.md:75` 措辞、守卫边界）均为**确定性**事项，不需要人工判断。
3. ⇒ **`status: passed`**（`score: 29/29`、`behavior_unverified: 0`、`gaps: 无`、`overrides_applied: 0`）。

**本轮相对上一轮的净变化**：`human_needed` → `passed`；上轮唯一人工项**闭合**；artifact 三支驱动由「⚠️ FLAKY / 已加固待复核」转为 `✓ VERIFIED`；新增 2 条 ℹ️ Info（并存告警未三支齐备、单例语义措辞）、1 条 ℹ️ Info（`close()` 常态超时）、2 条 ⚠️ Warning（并发会话致瞬态中止——已归因；`51-UAT.md:75` stale 措辞）；`covered_digest` 重算为 `51281b9b…` 并已修正上轮「digest 不可复现」的状况（本轮工作树对 covered 集合**零差异**）。**没有为了收绿而删除任何项**。

### passed 的环境前提（必须与结论一起读）

> **干净读数的前提是「同一个 `realm-dev` profile 上没有另一个 Playwright 驱动正在并发启动实例」。**
>
> - 支撑：本轮 `instancesBefore` 非空的 4 次驱动实跑（轮 1-3 limits `[73385]`、`-modal-sizes`/`-live` 复跑 `[15094,15095]`）**全部通过** ⇒ **并存但静止的实例不影响读数**；被观测到会打断读数的，是**并发驱动正在活动**的那次（应用被外力关闭、0 条断言失败）。
> - 因此 `passed` 的含义是：**在已登记的环境下未复现任何失败**；**「未复现」不等于「零抖动」**。驱动已把「本轮读数是否在污染环境下取得」写进每轮证据（`cleanup.instancesBefore`，含 `command`），复核者可直接判读。
> - 若需要最高保证等级，建议在**全机零 Electron 实例**（`instancesBefore == []`）时再连跑一轮（本轮轮 4/5 即该条件下的读数）。

### 关于 CR-01 的边界说明（沿用上轮口径，供决策）

CR-01 仍是本阶段唯一被独立复现的**用户可见缺陷**（`src/settings-page.js:6844`，重复预览后无法自救济），但它不落在任何 must-have truth 上（51-04 的句柄 truth 只要求三态「明确码 + 可读原因」，该条成立），且已记入 `51-REVIEW.md` 作技术债 ⇒ verifier 不将其计为 gap。若维护者认为「重复预览后无法自救济」应视为目标未达成，可将 CR-01 提升为 gap 并走 `/gsd-plan-phase 51 --gaps`。

---

_Verified: 2026-09-15T13:41:58Z_
_Verifier: Claude (gsd-verifier)_

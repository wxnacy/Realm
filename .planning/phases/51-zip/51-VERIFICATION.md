---
phase: 51-zip
verified: 2026-09-15T13:10:30Z
status: human_needed
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
covered_digest: "v1:sha256:c74c4f526b0105d3be591edd6bd1389760dc6a320041807e3cd8fdc55343afe1"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 29/29 must-haves verified
  previous_digest: "v1:sha256:7cbbae2bce814c7e0ebb3e10f8f37cb8c4e5328877cb2b54b773113546e03725"
  previous_verified: 2026-09-15T12:58:41Z
  kind: "两条 ℹ️ Info 处置后的最小重跑 #2（非全量重验）。两条 Info 均已闭合；本轮**新发现一处驱动抖动**，据此把 `status` 由 `passed` 改判为 `human_needed`（唯一人工项见 Human Verification Required）"
  human_items_closed:
    - "Info ①「`B（分支登记·信息性）` 的 `check()` 恒真」已闭合：该 `check` 在本轮增量（`7eda2ff→1fee7c2`）中**真删**，改为注释 + 读数入证据（`evidence.artifacts.overRssReading.branch`）+ `log`。驱动断言数 19 → **18**（`grep -cE '^[[:space:]]*check\\('` 逐提交复算：823b74c=21 / 7eda2ff=19 / 1fee7c2=18），且**没有换名保留**（断言名集合逐一比对，见下文「断言集合差」）"
    - "Info ②「文件头与 `heapCalibration.note` 的陈旧『主进程 RSS 两侧判据』注释」已闭合：两处均改为「确定性源码判据 + **A 侧** RSS 正命题」，且 `51-UAT.md`「诚实边界」段（`:95`）同步。残留的两处「两侧判据」字样（`:36` / `:49`）语义为「RSS **这个仪器**做不出可靠的两侧判据」——正是降级**理由**，非陈旧口径"
  gaps_closed:
    - "G-51-1 / CR-02：网络地址导入在真实运行期可用（`ai-manager.js:1848` 绑定 `downloadPackage`）—— 该缺陷由 `51-UAT.md` 登记并 resolved，属事后追溯闭合，非上轮 gap 闭合（沿用上轮口径）"
  gaps_remaining: []
  regressions: []
  behavior_unverified_items_new: 0
  digest_note: "本轮 `covered_digest` = `v1:sha256:c74c4f526b0105d3be591edd6bd1389760dc6a320041807e3cd8fdc55343afe1`。它**不只**因 `tests/uat-51-import-limits.js` 变动而不同于 `previous_digest`：本轮计算期间实测到并发会话在 `main.js` + `AGENTS.md` 上的中间态（两者 mtime = 2026-09-15T13:02:31Z，落在本轮取证窗口内），使 verifier 首次算得的 `d09e3cd5…` 成为**污染值并予丢弃**；同一算法把 limits 驱动换回 `7eda2ff` 版得 `c8d4f327…`，**也无法复现** `previous_digest: 7cbbae2b…` ⇒ 上一轮的 digest 亦系在「工作树 ≠ 自身提交树」时算得。本轮改取「35 项 covered 与 HEAD 逐字一致」的盘面，并由 Python 独立实现交叉验证（逐字节相同）⇒ 本值可由提交树确定性复现"
advisory:
  - finding: "**驱动抖动（本轮新发现，已升格为人工项）**：`tests/uat-51-import-limits.js` 在本轮 6 次独立实跑中出现 **1 次红**（16/18）：`B：超限包被拒且不是静默失败` 与 `B：文案含「请求体超过上限」…` 两条同时转红。这与 `51-UAT.md:75/:103` 与 `51-VALIDATION.md:99` 现写的「连跑 2 轮均 18/18，无抖动」**不一致** —— 该措辞需人工裁决（改口径 or 定位根因）"
    category: test-harness-nondeterminism
    reason: "红轮读到的 B 侧状态为 `{text:'', danger:false, display:'block', gate:''}`。本轮用「签名实验室」（临时副本探针，未落库）实测三种候选态的 DOM 指纹：① 正常失败态 `{text:'导入失败：请求体超过上限（33554432 字节）', danger:true, inlineDisp:'block', gate:'请先选择 zip 文件', overlay:'flex'}`；② `closeSkillImportModal()` 之后 `{text:'', danger:false, inlineDisp:'none', compDisp:'none', gate:'', overlay:'none'}`；③ `location.reload()` 之后（全新 DOM）`{text:'', danger:false, inlineDisp:'', compDisp:'block', gate:'', overlay:''}`。**红轮指纹与 ③ 逐字段吻合、与 ② 在 display 上互斥** ⇒ 红轮是「设置页 guest **被重新初始化**」，**不是**「应用把 413 静默吞掉」；同一红轮里 `guestWaitFor(danger)` 已先返回 `true`（应用确实渲染过失败文案）。根因未取到（驱动只保留 `mainLog.slice(-25)`，红轮尾部未见 `渲染进程 gone`），**无法排除**是「64 MiB 包在 guest 内整体驻留」这一夹具特征导致的渲染进程内存压力 —— 真实用户的 zip 在磁盘上，不是 guest 堆里的 64 MiB `File`"
    evidence_status: "实测（2 次原驱动 + 4 次插桩副本 + 1 次签名实验室，共 7 次实跑；红 1 次）"
  - finding: "与本轮驱动**共用同一份 `realm-dev` userData** 的 dev 实例（PID **58412**）仍在运行，与更早轮次记录的是**同一个 PID**（启动于 20:08:32，早于全部取证时段）"
    category: repro-environment
    reason: "未按本仓纪律处置（清理只按自身 PID、不按路径模式 pkill）。它会把上一个会话的恢复标签页带进驱动实例（实测可见 `nav-test-example.com` / `cmd-plain-nav-test.com` / `localhost:8005/rouman` 等 webview 与驱动实例并存）⇒ 环境噪声真实存在，且是本轮抖动**未能排除的混淆项之一**。B 侧已无断言，剩余 RSS 读数取自驱动自身主进程（进程隔离）；驱动另有 `preTmpResidue` 差值口径"
    evidence_status: "实测（`pgrep -fl`，PID 58412 与历史记录一致；探针实测 webview 列表含上述恢复标签页）"
  - finding: "指纹噪声的结构性来源：`AGENTS.md` 这类**仓库级共享文件**被纳入 `covered_files` 后，任何无关工作流的文档改动都会使本阶段指纹失效（早前实证 3 处失效中 2 处来自并发 webview 工作流）。**本轮该噪声为零**：`7eda2ff→1fee7c2` 仅 1 个 covered 文件变动"
    category: cross-workstream-staleness
    reason: "流程改进建议，无可复现缺陷、无测试可红 ⇒ 不构成 blocker。可选减噪方向：把仓库级共享文件从 covered_files 分离"
    evidence_status: "none provided（流程建议，无可复现缺陷）"
  - finding: "本轮只复跑了 `uat-51-import-limits.js`；另三个 uat 驱动（`-modal.js` / `-live.js` / `-modal-sizes.js`）**未复跑**（文件零改动，沿用最小重跑口径）。既然其中一个 uat 驱动被证实有 ~1/6 抖动，其余 uat 驱动的**单次**绿轮亦不宜再被读作确定性证据"
    category: evidence-strength
    reason: "属证据强度提示，不是新缺陷主张：`-modal.js` 的失败模式与抖动机制（64 MiB 包驻留 guest 堆）不同构，且其 52 项在多轮独立实跑中一致；truth #26/#27 另有 `src/settings-page.js` / `src/settings.html` 的源码不变式承重。**未**据此把 #26/#27 降级为 UNCERTAIN（无任何该驱动的抖动证据），但复跑者若取高保证等级，建议补跑一轮"
    evidence_status: "none provided（提示性，未主张缺陷）"
  - finding: "**`covered_digest` 在并发会话下不可复现（本轮实测）**：`main.js` + `AGENTS.md` 的 mtime = `2026-09-15T13:02:31Z`（落在本轮取证窗口内），使 verifier 首次算得的 `v1:sha256:d09e3cd5…` 成为**污染值**；同一算法把 limits 驱动换回 `7eda2ff` 版得 `c8d4f327…`，**亦无法复现上一轮记录的 `7cbbae2b…`** ⇒ 历次 digest 都是在「工作树含并发工作流未提交中间态」时算得的"
    category: digest-reproducibility
    reason: "无缺陷主张（指纹按**工作树字节**计算，是算法约定），但影响可判读性：`covered_digest` 失配未必等于本阶段产物漂移。本轮处置：改取「35 项 covered 与 HEAD 逐字一致」的盘面计算，并用 Python 独立实现交叉验证 ⇒ `c74c4f52…` 可由提交树确定性复现。建议算指纹前先确认 covered 集合的 `git status` 为空"
    evidence_status: "实测（mtime 对照 + 独立实现复算 + 跨版本复算三路互证）"
human_verification:
  - test: "超限（413）在弹框状态行的呈现是否稳定 —— 直接连跑 `NODE_PATH=\"$(npm root -g)\" node tests/uat-51-import-limits.js` 3 轮；更贴近真实路径的复核是用**磁盘上的** 60～70 MiB zip（而非驱动那种在 guest 里现场构造的 64 MiB `File`）走一次真实弹框上传"
    expected: "三轮均 18/18；或真实路径下状态行稳定显示「导入失败：请求体超过上限（33554432 字节）」且设置页**不重新加载**"
    why_human: "本轮 6 次实跑 1 红（16/18）。红轮 DOM 指纹经「签名实验室」判定为设置页 guest **被重新初始化**（红轮指纹 ≡ `location.reload()` 后态、与 `closeSkillImportModal()` 后态在 display 上互斥），且同一红轮 `guestWaitFor(danger)` 已返回 `true` ⇒ **已排除**「应用静默吞掉 413」；但**根因未取到**（驱动只保留 `mainLog.slice(-25)`，红轮未见「渲染进程退出」；4 次插桩副本含宿主侧 `render-process-gone` 监听却均 18/18、无法复现），**无法程序化判定**抖动来自「夹具把 64 MiB 包整体驻留 guest 堆导致的渲染进程压力」还是应用侧真实缺陷，也**无法排除** PID 58412 那个共用 userData 的并发实例。需人工裁决：接受并同步改写 `51-UAT.md:75/:103` 与 `51-VALIDATION.md:99` 现写的「连跑 2 轮均 18/18，无抖动」口径，或先定位根因再收尾"
---

# Phase 51: 用户技能导入管线（zip + 网络地址）Verification Report

**Phase Goal:** 用户可从本地 zip 包或网络地址安全导入技能，导入前看清将写入什么；恶意或畸形包整包拒绝且工作区外零写入。
**Verified:** 2026-09-15T13:10:30Z
**Status:** human_needed（无 must-have gap；唯一人工项 = 驱动抖动裁决）
**Re-verification:** Yes — **两条 ℹ️ Info 处置后的最小重跑 #2**

## 本轮性质与「最小重跑」依据

### 起因

上一轮（`verified: 2026-09-15T12:58:41Z`，`status: passed`，`score: 29/29`）在返回里记了两条**非阻塞 ℹ️ Info**：① `tests/uat-51-import-limits.js` 的 `B（分支登记·信息性）` 断言**恒真**；② 同文件文件头与 `heapCalibration.note` 的陈旧注释仍称「主进程 RSS **两侧**判据」。两条均由提交 `1fee7c2` 处置，`covered_digest` 因该文件再次变动而失效。本轮即：核对处置真的落地 → 重算指纹 → 实跑复现。

### 变化面（先把证据面钉死，不靠信任）

```bash
git diff --stat 7eda2ff..1fee7c2 -- <35 个 covered 文件>
#  tests/uat-51-import-limits.js | 11 ++++-------      （1 file changed, 4 insertions(+), 7 deletions(-)）
git diff --stat HEAD -- <35 个 covered 文件>          # 空 ⇒ covered 集合与 HEAD 逐字一致
git status --porcelain                                # 仅下列两个**非 covered** 文件
#  M .planning/phases/51-zip/51-VERIFICATION.md      （本报告自身）
#  M tests/.uat-out/uat-51-import-limits.json        （驱动自身的产物，非源码）
```

⇒ 本阶段全部承重产物里，本轮只有**一个**文件变动：`tests/uat-51-import-limits.js`。`agent-workspace.js` / `ai-skills-manager.js` / `ai-manager.js` / `main.js` / `src/*` / 七个套件 / 三份文档 / 另三个 uat 驱动 **零改动** ⇒ 29 条 must-have 的支撑物逐字未变，上一轮对其的独立复算仍然有效。

⚠️ 取证窗口内实测到**并发会话**对 `main.js` + `AGENTS.md` 的一次「改而复原」（两者 mtime = `2026-09-15T13:02:31Z`，内容最终与 HEAD 逐字一致）—— 它污染了 verifier 首次算得的指纹，并使本阶段的 `covered_digest` 无法与上一轮记录连成一条可复算的链。详见 Advisory #5 与 Behavioral Spot-Checks 的「指纹基线可复现性」行。

### 该文件是否在 must-have 真值链上 —— 四条独立判据，结论：**不在**（本轮复核，结论不变）

1. **七个 PLAN 零声明**：`grep -c "uat-51-import-limits" 51-0*-PLAN.md` ⇒ **0 / 0 / 0 / 0 / 0 / 0 / 0**（本轮复算）。该驱动是**verifier 上一轮的增补**，不是阶段契约。
2. **29 条 truth 的 Evidence 列无一引用它**；truth 引用的 uat 驱动是 `-live.js`（#22 / #23）与 `-modal.js` + `-modal-sizes.js`（#26 / #27）。
3. **它想承重的承诺另有更强的行为判据**：「上传体超限 ⇒ 413」的**行为**承重面在 `tests/test-skills-http-api.js`（本轮实跑 **41/41**）：真 stub server + 真 HTTP 客户端，含 ① chunked 累积分支 413 + body 可 `JSON.parse` 并回传 `limit`、①b `content-length` 快路径 413、② 413 路径零 `unhandledRejection`、**④ 反向对照**（把 `req.resume()` 换成 `req.destroy()` 形态后客户端拿不到 413）⇒ 两条分支 + 反向对照齐备，断言**自证可失败**，且完全不依赖本驱动。
4. **ROADMAP Phase 51 五条 Success Criteria 均未出现「进程 RSS 上界」这一量**。SC-5 的原文是「超过体积上限的请求体在 `/api/*` 层被拒绝并**返回明确错误**，不无上限读入内存」——「返回明确错误」在 `/api/*` 层由判据 3 的套件承重；「不无上限读入内存」的实现层判据是 `main.js:1044-1079 readRawBody` 的源码契约（下节核过，真实成立）。

## 处置核对：三条改动是否真的落地（**打开文件逐处核对，不采信描述**）

| # | 声称的改动 | 代码层核对结论 |
| - | ---------- | -------------- |
| 1 | 删掉 `B（分支登记·信息性）` 的 `check()`，改为注释 + 读数 + 日志 | ✅ **真删，非换名保留**。`1fee7c2:tests/uat-51-import-limits.js:893-897` 现为注释块 + `log('[读数] B 侧 RSS 增量 … 分支 …')`；分支仅入 `evidence.artifacts.overRssReading.branch` 与 `evidence.artifacts.overBranch`。断言数 `grep -cE '^[[:space:]]*check\('` 逐提交复算 = **21 / 19 / 18**（823b74c / 7eda2ff / 1fee7c2） |
| 2 | 文件头「诚实边界」段与 `heapCalibration.note` 的「主进程 RSS 两侧判据」→「确定性源码判据 + A 侧 RSS 正命题」 | ✅ 两处均已改：`:50`「真正承重的是上面 ③ 的确定性源码判据与 **A 侧**的 RSS 正命题；B 侧 RSS 同款降级为读数」；`:652` `heapCalibration.note`「改用『确定性源码判据 + A 侧 RSS 正命题』」。`51-UAT.md:95` 同步。残留 `:36` / `:49` 的「两侧判据」是**降级理由**的表述（「RSS 这个仪器…做不出可靠的两侧判据」），非陈旧口径 |
| 3 | `51-UAT.md` / `51-VALIDATION.md` 计数同步 19/19 → 18/18 | ✅ `51-UAT.md:75` `automated_by: …（18/18，连跑 2 轮无抖动）`、`:103` 记「连跑 2 轮均 18/18」；`51-VALIDATION.md:99` 记「实测 **18/18 全过**」。⚠️ **「无抖动」这一措辞本轮被实测推翻**，见下节（不改文件，如实回报） |

**没有顺手削弱别的断言 —— 断言名集合逐提交比对（承重文件 diff 结论）**

```bash
for c in 823b74c 7eda2ff 1fee7c2; do git show "${c}:tests/uat-51-import-limits.js" | <提取 check 名>; done | diff
# 823b74c → 1fee7c2：删除 3 条，新增 0 条，重命名 0 条
#   - B（强判据）：主进程 RSS 增量 ≤ `maxBytes` + 8 MiB ⇒ …
#   - B（分支登记）：`readRawBody` 走了两条合法分支之一（…）
#   - A/B 两侧可红（非恒真自证）：**B 的 body 更大**，但 B 的 RSS 增量**小于** A 的（…）
# 7eda2ff → 1fee7c2（本轮增量）：删除 1 条，新增 0 条，重命名 0 条
#   - B（分支登记·信息性）：`readRawBody` 走了两条合法分支之一
```

承重文件 `823b74c→1fee7c2` 的净变化：**21 → 18 条断言，减少的 3 条全部是「B 侧 RSS / A-B 对照」这一族的删除**（其中 `B（强判据）` 与 `A/B 两侧可红` 属上一轮已核过的 `7eda2ff` 处置，`B（分支登记）` 属本轮），**其余 18 条名称逐字未变**。A 侧关键正命题在三个提交里**逐字相同**：

```
'A（正命题）：主进程 RSS 增量 > 16 MiB ⇒ 这 ~30 MiB 真的过了线'
  pass 条件  nearRss.count >= 3 && rssDelta > 16 * 1024 * 1024     （三个提交一致）
```

**承重面转移是否成立**（「不无上限读入内存」现在由谁扛）：`main.js:1044-1079` 的 `readRawBody` 真身 —— `:1060` `Content-Length` 预检（注明「只作加速，**不得**取代下面的累积中判」）；`:1066-1075` 累积中 `if (rejected) return;` **先于** `size += chunk.length`（顺序即判据），越界即 `tooLarge()`；`:1055` `req.resume()` 排水而非 `destroy`。⇒ 应用侧累积上界确实被 `maxBytes` 夹住；被删的那条断言测的是**进程 RSS**（另一量）。处置口径技术正确。

## Goal Achievement

### Observable Truths

**本轮复核方式**：支撑物未变（git 已证，见上）⇒ 沿用上一轮对 29 条的独立复算结论；本轮**新实跑**的量单独标注。SUMMARY 的陈述一律当作**未验证输入**。

#### Plan 51-01 — SEC-10 沙箱写面加固

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `env.writeFile(<root 内 symlink 指向 root 外>/x)` 返回 `{ok:false, error.code:'permission_denied'}`、不 throw，且 root 外**真的没有**产生文件 | ✓ VERIFIED | `agent-workspace.js:258` `resolveInsideForWrite` + `:332` `guardForWriteResult`；`test-agent-workspace.js` 38/38（承重文件本轮零改动，沿用上轮实跑） |
| 2 | 沙箱内**自指** symlink 下的写入仍放行（加固未收紧过头） | ✓ VERIFIED | 同上套件 ok 2/ok 5；十例期望表中「仅『link OUT then write』一处由放行转拒绝」证实既有集合零变化 |
| 3 | 五个写方法 + 两个临时目录方法切到 `guardForWriteResult`；读面仍走 `guardResult`，两者**并列存在** | ✓ VERIFIED | 独立复算（剥注释）：`guardForWriteResult(` 11 处、`guardResult(`（排除 `ForWrite`）8 处；测试 ok 11/ok 12 |
| 4 | `resolveInsideForWrite` 对非字符串 / 空串 / 纯空白 / `..` 逃逸 / 绝对路径越界 / 兄弟前缀目录一律返回 `null`（fail-closed） | ✓ VERIFIED | 实现 `:258-283`；`module.exports` 导出；测试 ok 3 + ok 4 |

#### Plan 51-02 — 依赖落定

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 5 | `dependencies` 含 `"yauzl": "^3.4.0"` 与 `"yaml": "2.9.0"`（逐字）；`yaml` **单实例**；`yauzl` 暴露 Promise API | ✓ VERIFIED | 独立复算：`package.json` 实测 `yauzl=^3.4.0` / `yaml=2.9.0`；`node_modules/yaml/package.json` = `2.9.0`；嵌套 `yaml` **不存在**；`yauzl` 无 `postinstall`。承重文件本轮零改动 |
| 6 | 两包均无 `postinstall`；`build.files` 全部 `!` 前缀；`build.asarUnpack` 未被改动 | ✓ VERIFIED | 独立复算：`build.files` 每项 `!` 开头（`every(startsWith('!'))`）；`asarUnpack` 仍为 `["node_modules/nodejieba/**","skills-builtin/**"]`。回归 `test-builtin-skills-seeder.js` 101/101（上轮实跑） |

#### Plan 51-03 — zip 全量校验 + 唯一落盘实现

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 7 | 同包 SKILL.md 计数 = 1 ⇒ 进预览；= 0 或 ≥ 2 ⇒ 整包拒绝并给可操作提示 | ✓ VERIFIED | `function locateSkillRoot` 在位；用例组「locateSkillRoot：限域 → 直接命中 → 全包扫描」（`:538`）含多技能根拒绝（`:583`）与零技能根拒绝（`:608`） |
| 8 | 两阶段：preview 返回 `{importId, preview}` 且**不产生** `skills/<name>/`；仅 commit 后出现该目录；预览六字段齐备 | ✓ VERIFIED | 用例组「tracer：preview 不落盘 → commit 落盘 → 回读可见」（`:212`）+「sourceDir 已被 rename 走」（`:289`）；真实运行期由 `-live.js` 复现 |
| 9 | 含 symlink entry 的包在**两条判据路**各自被拒，断言点是「整包拒绝」而非「跳过条目」 | ✓ VERIFIED | `function assertNoSymlinkTree` 在位；用例组「symlink 两路独立判据」（`:1433`） |
| 10 | 逃逸族 + 空/仅斜杠/仅点 entry 名 + NFD+小写归一化查重各自整包拒绝 | ✓ VERIFIED | `function normalizedEntryKey` 在位；用例组（`:1499` / `:1582` / `:360`，含「原始字节面先判：CP437 会把 `\x01` 解码成 ☺」） |
| 11 | 六类限额各一例 + `uncompressedSize === 0xFFFFFFFF` 显式拒绝；嵌套深度**按技能根相对计** | ✓ VERIFIED | 独立复算 `IMPORT_LIMITS`（`Object.freeze`）**恰 8 键**（`MAX_ENTRY_BYTES=1 MiB` / `MAX_TOTAL_BYTES=32 MiB` / `MAX_ENTRIES=2000` / `MAX_COMPRESSION_RATIO=100` / `MAX_NESTING_DEPTH=16` / `PREVIEW_LIST_LIMIT=50` / `MAX_PENDING_IMPORTS=3` / `IMPORT_TTL_MS=10 min`）；用例组（`:1608`）。**本轮 `test-skills-import.js` 实跑 116/116** |
| 12 | 解压只在 `mkdtempSync` 新建空目录内；落点用「最近已存在祖先 realpath」复核；**真跑**越界对照组并断言 root 外零新文件 | ✓ VERIFIED | `function extractAndValidatePackage` + `function assertLandingInsideWriteRoot` 在位；`mkdtempSync(` 在 `ai-manager.js` 恰 1 处；越界对照组用例 `:1779` |
| 13 | `SKILL_THREAT_PATTERNS` 三类各有正样本命中；`skills-builtin/**` 零命中；`description` 与 body **双扫** | ✓ VERIFIED | `const SKILL_THREAT_PATTERNS`（`:4010`）+ `function scanSkillThreats` 在位；用例组（`:1940`）；消费点 `:4215`、导出面 `:4715` |
| 14 | **三种来源汇进同一个落盘实现**：`importUserSkill(` 全仓 = 定义 1 + 调用 1，`main.js` 与前端各 0；`yauzl.openPromise(` 恰 1 | ✓ VERIFIED | 独立计数（剥注释）；套件同款判据（`:309` / `:332`） |

#### Plan 51-04 — 落盘事务与句柄生命周期

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 15 | seeded 同名 ⇒ 拒绝导入；user 同名三选一各自可达；改名走 `validateManagedSkillName`；managed 同名不许覆盖 | ✓ VERIFIED | `function resolveImportConflict` 在位；用例组（`:741` / `:627` / `:512`） |
| 16 | 覆盖事务可回滚：第二步 `rename` 真实注错 ⇒ 旧技能内容**逐字完好** | ✓ VERIFIED | 行为依赖型判据，由真跑测试承载：用例组「覆盖事务：备份 + 两段 rename + 回滚 + 回读失败回滚 + 数量闸口径」（`:786`） |
| 17 | 回读验证失败即回滚并暴露 `diagnostics` 原文（含 path） | ✓ VERIFIED | 同上用例组内「回读失败回滚」分支；`readback_failed` 码在 `IMPORT_SKILL_ERROR` 键集内 |
| 18 | 句柄生命周期三态各自可达：`import_expired` / `import_not_found` / `too_many_pending`，皆为明确码 + 可读原因 | ✓ VERIFIED | 用例组「importId 生命周期：TTL / 并发上限 / 一次性 / 取消幂等」（`:1136`）；三个码均在键集内 |
| 19 | 崩溃残留清扫不误删进行中的包（陈旧性判据正反两例）；前缀与实际产物**正向**成对 | ✓ VERIFIED | `IMPORT_TMP_PREFIXES` + `function isImportResidueName` 在位；用例组（`:1249`） |
| 20 | 数量闸口径：达上限时**改名**被拒（计入）、**覆盖**同名成功（净增 0 豁免）；判据**读盘** | ✓ VERIFIED | `function countUserSkills` 在位；断言落在 `:786` 用例组的「数量闸口径」分支 |
| 21 | 每个 `IMPORT_SKILL_ERROR` 码至少一条用例；失败文案含码 + 可读原因；限额类含限额名与当前值；无空 message | ✓ VERIFIED | 独立复算：`IMPORT_SKILL_ERROR`（`Object.freeze`）**恰 21 键**；`MANAGE_SKILL_ERROR` 仍 **11 键**。用例组（`:2620` / `:2070` / `:2361` / `:1358`） |

#### Plan 51-05 — 网络地址导入

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 22 | 仓库 / `tree/<ref>/<path>` / `blob`·raw 直链三形态各自分流；zipball 顶层前缀剥离；`api.github.com` 与白名单外主机回 `unsupported_url` | ✓ VERIFIED | `function classifyImportUrl` + `HOST_WHITELIST` 在位；用例组（net `:106`）；**本轮 `test-skills-import-net.js` 实跑 50/50**。真实网络端到端由 `-live.js` 29/29（上轮实跑，文件零改动） |
| 23 | https 强制 / 白名单**精确**匹配 / 逐跳私网拒 / 跳数超限**抛错**而非报 HTTP 3xx / magic bytes / 流式上限命中即中止且清理半成品 | ✓ VERIFIED | 行为依赖型判据，由真跑测试承载：用例组（net `:478`，本地 stub server） |
| 24 | 直链 SKILL.md 与 zip 走**同一落盘函数**；可注入三键在生产调用点全用默认值（源码正命题） | ✓ VERIFIED | 独立复算：`isPrivateHost` / `hostWhitelist` / `fetchImpl` 在 `ai-manager.js` 各出现 0 次；三处 `downloadPackage(` 首参逐字 `undefined`；用例组（net `:698` / `:919`） |

#### Plan 51-06 — 导入 UI 完整面

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 25 | 完整弹框契约（E1–E18）+ 9 态状态机 + 元素顺序；15 个新增元素**零内联 `style`**；region 内**零 `innerHTML`/`insertAdjacentHTML`** | ✓ VERIFIED | 独立扫描 region `src/settings-page.js:5724-7010`（1287 行）：剥注释后 `innerHTML` 0 处、`insertAdjacentHTML` 0 处；`document.createElement(` 36 处、`textContent` 35 处；`src/settings.html` 弹框块零内联 `style` |
| 26 | 两条 backstop（E2 弹框 overflow / E17 动作区 overflow）由**带正命题的属性测试**在真实渲染下满足 | ✓ VERIFIED | 行为依赖型判据。`uat-51-import-modal.js` 52 passed + `-modal-sizes.js` 48/48（上轮实跑；两文件本轮零改动⇒未复跑）。⚠️ 见 Advisory #4（uat 驱动的单次绿轮证据强度提示；**未**据此降级） |
| 27 | 键盘契约：唯一 `tabindex` 是预览滚动容器的 0 值；Tab 序 = DOM 序；焦点归还 `#skillImportOpen`；提交中忽略 Escape | ✓ VERIFIED | 同上驱动 52 项内实测（上轮实跑）。本轮源码侧复核：`src/settings.html` 弹框块 `tabindex` 唯一命中为预览容器 |

#### Plan 51-07 — 文档与账本收口

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 28 | `docs/product/ai-skills.md` 第十三节 + `ai-agent-workspace.md` §七 SEC-10 + `AGENTS.md` 导入维护约定与测试行；counts-parity `cells` 下限 20 且实测通过 | ✓ VERIFIED | **本轮独立复跑 counts-parity 命令（逐字复制 §11.8 文末命令）⇒ `counts-parity ok` / `cells=20`**，实测值逐字：`{"test-manage-skill.js":"55","test-ai-skills.js":"198","test-skill-picker-model.js":"115","test-skills-management.js":"49","test-skills-http-api.js":"41","test-skills-import.js":"116","test-skills-import-net.js":"50"}` |
| 29 | 文档数值与实现逐字一致：码表全集 = `IMPORT_SKILL_ERROR` 全部 21 值；限额值 = `IMPORT_LIMITS`；白名单条目无矛盾；四条诚实边界恒显；不出现已被实测推翻的旧理由 | ✓ VERIFIED | 独立复算：21 个码值在文档中全部出现（缺失 0）。**本轮新增**：`51-UAT.md` / `51-VALIDATION.md` 的 B 侧口径已同步为「只登记不断言」；但两者现写的「连跑 2 轮 18/18 **无抖动**」被本轮实测推翻（6 次里 1 次红）⇒ 见 Human Verification Required（该两文件**不在 covered_files**，不影响指纹） |

**Score:** 29/29 truths verified (0 present-but-behavior-unverified)

All 8 behavior-dependent truths (#1, #2, #12, #16, #17, #19, #23, #26) have a **passing behavioral test** that exercises the transition on real fs / real stub network / real render; none accepted on symbol presence alone. 本轮的抖动发现落在**非真值链**的补充驱动上，未使任何 truth 失据。

### Deferred Items

**无。** Phase 51 是本里程碑（v2.6，Phase 46–51）的**末阶段**，ROADMAP 中不存在 `number > 51` 的阶段 ⇒ Step 9b 的延后项过滤为空集。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `agent-workspace.js` | `resolveInsideForWrite` + `guardForWriteResult` + 五个写方法与两个临时目录方法切换 | ✓ VERIFIED | `:161/:184` 双基准单源、`:258` 写面定义、`:332` 包装、`:370..465` 接线；`module.exports.resolveInsideForWrite` 已导出 |
| `ai-skills-manager.js` | `IMPORT_LIMITS` / `IMPORT_SKILL_ERROR` / `validateEntryName` / `locateSkillRoot` / `readSkillPackageEntries` / `extractAndValidatePackage` / `buildImportPreview` / `importUserSkill` / `SKILL_THREAT_PATTERNS` / `scanSkillThreats` / `HOST_WHITELIST` / `classifyImportUrl` / `downloadPackage` / `prepareFromRawFile` | ✓ VERIFIED | 逐项独立复算存在（`IMPORT_LIMITS` `:2252`、`IMPORT_SKILL_ERROR` `:2331`、`SKILL_THREAT_PATTERNS` `:4010`）；导出面逐项核对 |
| `ai-manager.js` | `this._skillImports`、`previewSkillImport`、`commitSkillImport`、`cancelSkillImport`、`sweepSkillImports` + **CR-02 绑定** | ✓ VERIFIED | 均在位；`:1848 const { downloadPackage } = skillsManager;`（本轮零改动） |
| `main.js` | `MAX_SKILL_PACKAGE_BYTES`、`readRawBody`、`import` 分支按 Content-Type 分流 | ✓ VERIFIED | **本轮重读 `readRawBody` 真身**（`:1044-1079`）：`Content-Length` 预检（`:1060`）+ `if (rejected) return;` 先于累加（`:1067`）+ 越界 `req.resume()` 排水（`:1055`）；零 `arrayBuffer` / `readAsArrayBuffer` / `FileReader` |
| `src/settings.html` | `#skillImportOpen` / `#skillImportFile` / `#skillImportModal` 全骨架 | ✓ VERIFIED | 三 id 齐备；弹框块零内联 `style`；`:612` 状态行 `<p id="skillImportStatus" class="skill-import-status" role="status" aria-live="polite">` |
| `src/settings-page.js` | 导入 region（状态机 / 渲染 / 闭合文案表 / 净化） | ✓ VERIFIED | region `:5724-7010`（1287 行），剥注释后零 HTML 字符串模板 |
| `src/styles/main.css` | 专属样式段（含 3 条作用域覆盖） | ✓ VERIFIED | 段落存在；UAT 渲染实测生效 |
| `tests/test-skills-import.js` | 新建套件 | ✓ VERIFIED | **本轮实跑 116/116** |
| `tests/test-skills-import-net.js` | 新建套件（stub server） | ✓ VERIFIED | **本轮实跑 50/50** |
| `tests/helpers/make-malicious-zip.js` | 恶意样本夹具生成器（零外部依赖） | ✓ VERIFIED | 套件 ok 3 断言不出现 `python3` / `zip` 命令行 |
| `tests/uat-51-import-modal.js` | 真实渲染 uat 驱动 | ✓ VERIFIED | 52 passed（上轮实跑，文件零改动⇒本轮未复跑） |
| `tests/uat-51-import-live.js` | 真实网络 uat 驱动 | ✓ VERIFIED | 29/29 passed（上轮实跑，文件零改动⇒本轮未复跑） |
| `tests/uat-51-import-modal-sizes.js` | 多尺寸档 uat 驱动 | ✓ VERIFIED | 48/48 passed（上轮实跑，文件零改动⇒本轮未复跑） |
| `tests/uat-51-import-limits.js` | 限额与内存面 uat 驱动 | ⚠️ **FLAKY（由上一轮 VERIFIED 下调）** | **本轮 6 次独立实跑：5 绿 1 红**。绿轮 **18/18 exit 0**（原驱动 1 次 + 插桩副本 4 次）；红轮 **16/18 exit 1**（B 侧两条），指纹经签名实验室判定为「设置页 guest 被重新初始化」而非应用静默 —— 详见 Anti-Patterns ⚠️ #1。**注**：该文件不在任何 must-have 真值链上（四条判据见上），其状态不影响 29 条 truth；但它现在是「**不能**声称无抖动」的 |
| `docs/product/ai-skills.md` §13 / `docs/product/ai-agent-workspace.md` §7 / `AGENTS.md` | 文档与账本 | ✓ VERIFIED | 三处均落地，数值与实现一致（**本轮 counts-parity `cells=20` 实跑通过**） |

无 MISSING 或 STUB artifact。

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| 三条来源（上传 / zipball / raw 直链） | `importUserSkill` | 共用一段后段 | ✓ WIRED | 独立计数（剥注释）：`importUserSkill(` 定义 1 + 调用 1；`main.js` / 前端各 0；`yauzl.openPromise(` 恰 1 |
| `previewSkillImport`（三条来源唯一入口） | `extractAndValidatePackage` / `prepareFromRawFile` | 两个准备器产出同一 `{pkgRoot}` 形状 | ✓ WIRED | net 套件 `:698` + `:919`；`locateSkillRoot(` / `buildImportPreview(` 在 `ai-manager.js` 各恰 1 处 |
| **CR-02 修复链**：`getAiSkillsManagerLazy()` | 三处网络分支的 `downloadPackage` | `const { downloadPackage } = skillsManager;` 显式解构 | ✓ WIRED | `ai-manager.js:1848`；三处调用点首参逐字 `undefined`；真实运行期由 `-live.js` 29/29 证实 |
| `resolveInsideForWrite` | 五个写方法 + 两个临时目录方法 | `guardForWriteResult` 唯一包装 | ✓ WIRED | 写面 11 处 `guardForWriteResult(`、读面 8 处 `guardResult(`，并列存在 |
| `IMPORT_LIMITS` | preview 响应的 `limits` → 设置页 | 单源回传，前端零字面量 | ✓ WIRED | 套件「端点与前端零字面量…」（`:340`） |
| `IMPORT_SKILL_ERROR`（21 值） | `SKILL_IMPORT_ERROR_TEXT`（前端闭合表） | 双向覆盖 | ✓ WIRED | 套件（`:2453`）；独立复算表键 ⊇ 21 值 |
| `search-manager.isPrivateHost` | `downloadPackage` 默认 `isPrivateHost` | 惰性 require + 依赖注入默认值 | ✓ WIRED | `getSearchManagerLazy` 在位；三个可注入键在 `ai-manager.js` 出现 0 次 |
| `main.js` `MAX_SKILL_PACKAGE_BYTES` | `IMPORT_LIMITS.MAX_TOTAL_BYTES` | 跨文件相等性断言 | ✓ WIRED | 独立复算两者均为 `33554432` |
| **413 错误链**：`readRawBody` 越界 | 设置页状态行（`setImportState(FAILED, …)`） | `{error, code:'BODY_TOO_LARGE'}` → `describeSkillImportError` → 状态行 | ✓ WIRED（**本轮实测复现**） | 本轮 5 次绿轮中 4 次由插桩副本记录到完整链路：`dt≈250ms` 时状态行 = `导入失败：请求体超过上限（33554432 字节）`、`danger:true`、`gate:'请先选择 zip 文件'`、`overlay:'flex'`，且持续 ≥4 s 稳定；主进程同时打印 `[Realm] 技能 API 处理失败: 请求体超过上限`。**但该链路存在 ~1/6 的抖动**（红轮为 guest 重初始化，见 Anti-Patterns ⚠️ #1） |
| 成功出口 | `ensureSkillsFresh()` 恰一次 + 调用侧 `broadcast('skills:changed')` 恰一次 | D-19 写路径收口 | ✓ WIRED | 套件 D-19 计数断言在位；`syncAgentSystemPrompt()` 函数体逐字未改 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `#skillImportPreview` 六字段 | `skillImportTarget.preview` | `previewSkillImport` → `buildImportPreview`（真实解压后的目录树 / 字节统计 / 扫描结论） | Yes | ✓ FLOWING |
| 字节数与限额对照 | `preview.bytes` / `preview.maxFileBytes` / `preview.limits` | `collectPreviewStats`（真遍历 `pkgRoot`）+ `buildImportLimitsProjection()` | Yes | ✓ FLOWING |
| 扫描结论两栏 | `preview.scan.injection` / `preview.scan.heuristic` | `assertNoInjection` + `scanSkillThreats`（真实模式匹配） | Yes | ✓ FLOWING |
| 冲突三选一 | `preview.conflict` | `resolveImportConflict`（`env.listDir` / `env.fileInfo` **实时读盘**） | Yes | ✓ FLOWING |
| 网络下载目标 | `classifyImportUrl(url).target` | 真实 URL 分类；运行期由 `-live.js` 证实真实 zipball 落到真实 `skills/pdf/` | Yes | ✓ FLOWING |
| B 侧 RSS 读数 | `overRssReading.rssDelta` | `process.memoryUsage().rss` 的 `max - first`（环境读数，不参与任何判定） | 不适用（刻意不承重） | ✓ 按设计降级为读数 |

No HOLLOW / DISCONNECTED / STATIC / HOLLOW_PROP findings.

### Behavioral Spot-Checks

标「本轮实跑」者为本轮命令的真实输出；标「上轮实跑（本轮未复跑）」者为上一轮输出，本轮因文件零改动（git 已证）未重跑。

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| **限额与内存面（本轮变更文件）** | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js` | **第 1 次 `16/18`（exit 1，B 侧两条红）；第 2 次 `18/18`（exit 0）** | ✗ **FAILED（抖动）** — 详见 Anti-Patterns ⚠️ #1 与 Human Verification Required |
| 同驱动插桩副本（临时文件 `/tmp/zzq-probe51.js`，未落库） | `NODE_PATH="$(npm root -g):$PWD/node_modules" node /tmp/zzq-probe51.js` | **4 次实跑：4 × `18/18` exit 0**；B 侧状态时间线在 `dt≈260ms` 进入失败态并**稳定保持 ≥4 s**；期间 settings webview 无 `dom-ready`/`did-finish-load`/`render-process-gone`；guest 标记 `mark` 恒定、`readyState:'complete'` | ✓ PASS（×4） |
| 签名实验室（临时文件 `/tmp/zzq-sig51.js`，未落库） | 同上运行方式 | ① 自然失败态 `{text:'导入失败：请求体超过上限（33554432 字节）', danger:true, inlineDisp:'block', compDisp:'block', gate:'请先选择 zip 文件', overlay:'flex'}`；② `closeSkillImportModal()` 后 `{text:'', danger:false, inlineDisp:'none', compDisp:'none', gate:'', overlay:'none'}`；③ `location.reload()` 后 `{text:'', danger:false, inlineDisp:'', compDisp:'block', gate:'', overlay:''}` | ✓ PASS（**红轮指纹 ≡ ③、与 ② 在 display 上互斥**） |
| 导入面 zip 全量校验与落盘 | `node tests/test-skills-import.js` | `# tests 116 / # pass 116 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 网络面分类 / 白名单 / 逐跳 / magic / 流式 | `node tests/test-skills-import-net.js` | `# tests 50 / # pass 50 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 管理面 | `node tests/test-manage-skill.js` | `# tests 55 / # pass 55 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 技能域（含威胁扫描正命题 + D-19 计数） | `node tests/test-ai-skills.js` | `# tests 198 / # pass 198 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 技能选择器模型 | `node --test tests/test-skill-picker-model.js` | `# tests 115 / # pass 115 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 技能管理面 | `node tests/test-skills-management.js` | `# tests 49 / # pass 49 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 传输面（含 413 两分支 + 反向对照） | `node tests/test-skills-http-api.js` | `# tests 41 / # pass 41 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 例数一致性账本 | counts-parity 内联命令（逐字复制 `ai-skills.md` §11.8） | `counts-parity ok` / `cells=20`，7 个实测值逐字命中账本 | ✓ PASS（**本轮实跑**） |
| 源码判据的判别力（三条单点变异自证） | 内含于 limits 驱动（变异 1/2/3 逐条精确转红） | 变异 1 `arrayBuffer` 0→1；变异 2 `fileBodyDirect` true→false；变异 3 `contentLengthFastPath` true→false 且 `arrayBuffer` 0→1 | ✓ PASS（**本轮实跑，5 次绿轮中每次成立**） |
| 断言集合未削弱（承重文件 diff 结论） | `git diff 823b74c 1fee7c2 -- tests/uat-51-import-limits.js` + 逐提交断言名集合比对 | 21 → 18 条；**减少的 3 条全为 B 侧 RSS / A-B 对照族**，其余 18 条名称逐字未变，A 侧 `rssDelta > 16 MiB` 正命题逐字保留 | ✓ PASS（**本轮实跑**） |
| 沙箱写面加固行为面 | `node tests/test-agent-workspace.js` | 38/38 | ✓ PASS（上轮实跑，本轮未复跑） |
| 回归：播种器 | `node tests/test-builtin-skills-seeder.js` | 101/101 | ✓ PASS（上轮实跑，本轮未复跑） |
| 真实网络端到端 | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-live.js` | 29/29 passed（exit 0） | ✓ PASS（上轮实跑，本轮未复跑） |
| 真实渲染 UAT | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` | 52 passed（exit 0） | ✓ PASS（上轮实跑，本轮未复跑） |
| 多尺寸档布局矩阵 | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal-sizes.js` | 48/48 passed（exit 0） | ✓ PASS（上轮实跑，本轮未复跑） |
| 指纹重算 + **独立实现交叉验证** | `gsd_run query verification.fingerprint .planning/phases/51-zip <35 项>` vs verifier 自撰 Python 复算（`sha256("v1\n" + Σ"rel\nescaped-file-sha256\n")`） | 两者**逐字节相同**：`v1:sha256:c74c4f526b0105d3be591edd6bd1389760dc6a320041807e3cd8fdc55343afe1`（35 项）。写入本报告后**连续复算 3 次均不变** ⇒ 写入未改变指纹 | ✓ PASS（**本轮实跑**） |
| 指纹基线可复现性（**本轮新增判据**） | 同算法跨版本复算：把 `tests/uat-51-import-limits.js` 换回 `7eda2ff` 版内容（其余 34 项取当前盘面；`git diff 7eda2ff..HEAD` 已证其余项逐字未变） | 得 `v1:sha256:c8d4f327b1f3d6f89fb9bfa3a2b8fb24f0c97aa75172fd0441976ad961f5d403` ≠ 上一轮记录的 `7cbbae2b…` ⇒ **上一轮的 `covered_digest` 无法从其自身提交树复现**（详见 Advisory #5）。本轮改以「**covered 全 35 项与 HEAD 逐字一致**」的盘面计算（`git diff --stat HEAD -- <35 项>` 为空、`git status` 仅两个**非 covered** 文件变动）⇒ 本值可由提交树确定性复现 | ✓ PASS（**本轮实跑**） |
| 变化面收敛性（最小重跑的依据） | `git diff --stat 7eda2ff..1fee7c2 -- <35 covered 文件>` + `git status --porcelain` | 仅 `tests/uat-51-import-limits.js`（+4/−7）；covered 集合相对 `HEAD` **零改动** | ✓ PASS（**本轮实跑**） |

**本轮各轮 B 侧 RSS 原始读数（只登记，不作判据）**：红轮 48,365,568 B（分支标签 `bounded-accumulation`）；下一次 67,977,216 B；插桩轮 67,977,216 / 53,964,800 / 62,914,560 / 71,303,168 B。⇒ 同一路径下读数跨度 48–71 MB（≈1.5 倍），与「该仪器不测应用缓冲上界」的降级理由一致。

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/*/tests/probe-*.sh` 约定路径 | `find scripts -path '*/tests/probe-*.sh' -type f` | 本阶段无此类探针（PLAN/SUMMARY 亦未声明 probe） | N/A |
| 本轮为定性新建的**临时**探针 | `/tmp/zzq-probe51.js`、`/tmp/zzq-sig51.js`（由驱动副本生成，**未写入仓库**） | 见上表：4 × 18/18 + 签名指纹三态 | ✓ 已执行（非本仓 probe 资产） |

### Requirements Coverage

`REQUIREMENTS.md` 映射到 Phase 51 的 ID 与 7 个 PLAN 的 `requirements` 字段**并集完全一致**（本轮独立复算，两集合均为 `SEC-02…08, SEC-10, USER-03/04/05/08`，共 **12** 个）⇒ **无 ORPHANED requirement**。

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USER-03 | 51-02, 51-03, 51-07 | 上传 zip 导入技能（单技能包语义；0 或 ≥2 技能根报错并提示） | ✓ SATISFIED | truth #7 + #8；套件 `locateSkillRoot` 多根/零根用例 + tracer 组 |
| USER-04 | 51-02, 51-05, 51-07 | 网络地址导入，自动分流 GitHub 仓库 / 目录 与 SKILL.md 直链 | ✓ SATISFIED | truth #22；离线值域矩阵（本轮 50/50 复跑）+ 真实网络端到端 29/29 |
| USER-05 | 51-03, 51-04, 51-06, 51-07 | 两阶段（预览 → 确认落盘）；预览展示六项 | ✓ SATISFIED | truth #8 + #25；`uat-51-import-modal` 52 passed 含六字段渲染快照与脚本标红；多尺寸档 48/48 |
| USER-08 | 51-04, 51-06, 51-07 | 导入失败给出真实原因（命中哪个限额 / 扫描结论 / 校验错误），不静默 | ✓ SATISFIED（附注） | truth #21 + #23；21 码零跳过；真实 404 文案走真链路实测。413 的 UI 呈现本轮 5/6 次实测到位（文案含真实限额数字），1 次因 guest 重初始化未读到 ⇒ **不构成静默失败的证据**，但也因此挂一条人工项 |
| SEC-02 | 51-03, 51-07 | 拒绝含 symlink entry 的**整包**（两路判据） | ✓ SATISFIED | truth #9；`symlink 两路独立判据` 用例组 |
| SEC-03 | 51-03, 51-07 | 逐 entry 路径校验 + NFD+小写查重 | ✓ SATISFIED | truth #10；逃逸族十二类 + 八条判据组 |
| SEC-04 | 51-03, 51-07 | 先读 central directory 预检，再边解边累加；五类量 | ✓ SATISFIED | truth #11；六类限额各具名用例 + zip64 / 加密 / 不支持方法 / 空包 / data descriptor（本轮 116/116） |
| SEC-05 | 51-03, 51-07 | 解压到 `mkdtempSync` 全新空目录；落点用最近已存在祖先 realpath 复核 | ✓ SATISFIED | truth #12；`assertLandingInsideWriteRoot` + 真跑越界对照组零新文件 |
| SEC-06 | 51-03, 51-07 | 扫描 `description` 与 body | ✓ SATISFIED | truth #13；双扫用例组 + 消费点独立复算 |
| SEC-07 | 51-04, 51-07 | 与内置同名 ⇒ 拒绝；与用户技能同名 ⇒ 显式策略 | ✓ SATISFIED | truth #15；`resolveImportConflict` 三档判定组 |
| SEC-08 | 51-05, 51-07 | https-only + 白名单 + 逐跳 + 流式上限 + magic bytes | ✓ SATISFIED | truth #23 + #24；stub server 用例组；无 `fetchUrl` 调用、无私网判据副本 |
| SEC-10 | 51-01, 51-07 | 加固既有沙箱 `writeFile` 的 ENOENT symlink 缺口 | ✓ SATISFIED | truth #1–#4；38/38，含十例期望表与既有集合零变化对照 |

### Test Quality Audit

针对本轮 GSD 门禁 `audit_test_quality` 的四个面，对**与需求挂钩**的测试文件（七个 `tests/test-*.js` 套件）复核：

| 面 | 结论 |
| -- | ---- |
| 禁用测试 | **零命中** —— 七个套件无跳过式禁用 |
| 循环测试 | **零命中** —— 均以真 stub server / 真 fs / 真解压产物作 oracle；`test-skills-http-api.js:526` 含**反向对照**自证断言可失败 |
| 断言强度 | 与需求挂钩的判据均为 **Value / Behavioral 级**，未退化为 existence/type |
| 覆盖数量 | counts-parity 逐账户单元比对通过（`cells=20`），七套件实测值逐字命中账本 |
| **额外发现（非承重文件）** | `tests/uat-51-import-limits.js`（**不在任何需求的测试映射内**）存在 **~1/6 的抖动**，以及 1 条已删除的恒真断言。按门禁规则，非需求挂钩的测试**不构成 BLOCKER**（门禁仅对「与需求挂钩」的测试判 BLOCKER） |

**Disabled tests on requirements:** 0 → 无 BLOCKER
**Circular patterns detected:** 0 → 无 BLOCKER
**Insufficient assertions:** 0（承重面）→ 无 WARNING

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/uat-51-import-limits.js` | B 段（`:854` 一带的等待与 `:870`/`:875` 两条断言） | **非承重驱动的抖动**：6 次独立实跑 **1 次红**（`16/18`）—— `B：超限包被拒且不是静默失败` 与 `B：文案含「请求体超过上限」…` 同时转红，读到 `{text:'', danger:false, display:'block', gate:''}` | ⚠️ **Warning（新发现，升格为人工项）** | 经签名实验室判定为「设置页 guest 被**重新初始化**」（红轮指纹 ≡ `location.reload()` 后态，逐字段吻合；与 `closeSkillImportModal()` 后态在 `display` 上互斥）⇒ **不是应用静默吞掉 413**（同一红轮 `guestWaitFor(danger)` 已返回 `true`）。但「连跑 2 轮均 18/18，无抖动」这一现写口径**已被推翻**。**不构成 gap**：该文件不在任何 must-have 真值链上（四条判据），413 的确定性承重面在 `test-skills-http-api.js` 41/41。详见 Human Verification Required |
| ~~`tests/uat-51-import-limits.js`~~ | ~~`:893-897`~~ | ~~**恒真断言**：pass 条件为 `overBranch === 'content-length-fast-path' \|\| overBranch === 'bounded-accumulation'`（不可能失败）~~ | ✅ **已消除（RESOLVED）** | 本轮 diff 与逐提交断言名集合比对确认**真删**（非换名保留）；驱动断言数 19 → 18。分支改入 `overRssReading.branch`（读数）与 `log` |
| ~~`tests/uat-51-import-limits.js`~~ | ~~`:50`~~ | ~~陈旧注释：仍写「确定性源码判据**与 A/B 两侧的 RSS 判据**」~~ | ✅ **已消除（RESOLVED）** | 现为「…与 **A 侧**的 RSS 正命题；B 侧 RSS 同款降级为读数」 |
| ~~`tests/uat-51-import-limits.js`~~ | ~~`:652`~~ | ~~`heapCalibration.note` 仍写「确定性源码判据 + **主进程 RSS 两侧判据**」~~ | ✅ **已消除（RESOLVED）** | 现为「确定性源码判据 + A 侧 RSS 正命题」 |
| `tests/uat-51-import-limits.js` | `:875-878` | 断言名含「与真实限额数字」，但 pass 条件仅 `overStatus.text.indexOf('超过上限') !== -1` —— **名过其实**（未断言数字） | ℹ️ **Info** | 该断言**仍有判别力**（区分专用 413 文案 vs 通用兜底），不是恒真；只是名字多写了一层未被断言的内容。实测该文案**确实**含真实限额数字（`请求体超过上限（33554432 字节）`）⇒ 不影响结论。建议后续把数字断言补进 pass 条件，或把名字收窄 |
| 全部 phase-51 文件 | — | `TBD` / `FIXME` / `XXX` 无引用的遗留标记 | — | **无。**对**本轮变更文件**独立扫描 ⇒ 零命中；其余承重文件本轮零改动。**债务标记门禁未触发** |
| `src/settings-page.js` | 5734 / 6041 / 6036 | `innerHTML` / `insertAdjacentHTML` / `aria-disabled` | ℹ️ Info | region 内剥注释后各 0 处（命中均在注释内） |
| 全阶段 | — | 空实现 / `return null` 占位 / 硬编码空 props | — | **无。**Data-Flow Trace 五项全部 FLOWING |

### Known Recorded Tech Debt (already logged — not re-counted as new failures)

`51-REVIEW.md`（`status: issues_found`：2 critical + 3 warning + 6 info）的余下发现经复核**仍然存在**，且已按项目「阶段收尾以 UAT 为准；代码审查 Critical 记入 REVIEW.md 作技术债」的既定裁决挂账。verifier **不**将其计为本轮新的失败项（无 must-have truth 因此失败），本轮因**相关文件零改动**未逐条重开取证：

| ID | 复核结论 | 独立证据（行号） |
| -- | -------- | ---------------- |
| CR-01 | **仍存在**（`src/settings-page.js` 本轮零改动） | `:6844` 仍直接覆写 `skillImportTarget.importId` 而不先 `discardSkillImportHandle(prevId)`；`catch` 分支走 `resetSkillImportSurfaces()` 同样不归还 ⇒ 同一弹框会话内第 4 次连续预览 100% 返回 `too_many_pending`，UI 无自救入口 |
| CR-02 | **已修复并运行期证实** | `ai-manager.js:1848` 绑定；`-live.js` 由 12/21 转 29/29 |
| WR-01 | 仍存在 | `ai-skills-manager.js:4556` `await refreshSkills(env, { rootDirs: [...] })` 未透传 `disabled` |
| WR-02 | 仍存在 | `docs/product/ai-skills.md:737` 压缩比行口径与实现（逐条目）不一致 |
| WR-03 | 仍存在 | `ai-skills-manager.js:1573 scanSkillText()` 只调 `scanInjectionPatterns()`、从不引用 `SKILL_THREAT_PATTERNS` |
| IN-01 – IN-06 | 未逐条复核（info 级） | IN-02 / IN-04 在代码中仍可见 |

`WINDOWS.md` 中 pending 的 phase-51 条目保持如实登记，verifier 未重复计数。

### Advisory (New Scope, Unevidenced)

本轮为 re-verification，故按门禁要求列出该节。五条均**不构成 gap**；其中第 1 条已升格为人工项（见下节）。

| # | Finding | Category | Why Advisory / 状态 |
| - | ------- | -------- | ------------------- |
| 1 | `tests/uat-51-import-limits.js` **抖动 ~1/6**（6 次实跑 1 红；红轮指纹 = 设置页 guest 重新初始化） | test-harness-nondeterminism | **已升格为人工项**（Step 8）：它是可复现观测，但**根因未取到**，且红轮不指向任何 must-have truth 失败 ⇒ 需人工裁决「记入口径 or 定位根因」，见 Human Verification Required |
| 2 | 与本轮驱动**共用 `realm-dev` userData** 的 dev 实例（PID **58412**）仍在运行（与历史记录同一 PID） | repro-environment | 未按本仓纪律处置（清理只按自身 PID）。实测它把上一会话的恢复标签页带进驱动实例（`nav-test-example.com` / `localhost:8005/rouman` 等 webview 并存）⇒ **是本轮抖动未能排除的混淆项**。按纪律 verifier 未处置它 |
| 3 | 指纹噪声的结构性来源：`AGENTS.md` 这类**仓库级共享文件**被纳入 `covered_files` | cross-workstream-staleness | 流程改进建议，无可复现缺陷。**本轮该噪声为零**（`7eda2ff→1fee7c2` 仅 1 个 covered 文件变动） |
| 4 | 本轮只复跑 `-limits.js`；另三个 uat 驱动未复跑（文件零改动）⇒ 既然同类驱动被证实有抖动，其余 uat 驱动的**单次**绿轮不宜再被读作确定性证据 | evidence-strength | 提示性，**未**据此把 truth #26/#27 降级为 UNCERTAIN（无该驱动的抖动证据，失败模式不同构）。取高保证等级者可补跑一轮 |
| 5 | **`covered_digest` 在并发会话下不可复现（本轮实测）**：`main.js` + `AGENTS.md` 的 mtime = `2026-09-15T13:02:31Z`（落在本轮取证窗口内），使 verifier 首次算得的 `v1:sha256:d09e3cd5…` 成为**污染值**；同一算法把 limits 驱动换回 `7eda2ff` 版得 `c8d4f327…`，**亦无法复现上一轮记录的 `7cbbae2b…`** ⇒ 说明**历次** digest 都是在「工作树含并发工作流未提交中间态」时算得的 | digest-reproducibility | 无缺陷主张（指纹按**工作树字节**计算，这是算法约定）。但影响可判读性：`covered_digest` 失配未必等于本阶段产物漂移。本轮处置：改取「35 项 covered 与 HEAD 逐字一致」的盘面计算，并用 Python 独立实现交叉验证 ⇒ `c74c4f52…` 可由提交树确定性复现。建议：算指纹前先确认 `git status` 对 covered 集合为空 |

## Human Verification Required

**1 项**（需人工裁决；它不是「某个 must-have truth 未验证」，而是「唯一覆盖 413-UI 路径的补充驱动非确定性，且现写口径已被推翻」）。

### 1. 超限（413）在弹框状态行的呈现：抖动裁决

**Test：** 在**接近真实使用**的条件下各跑 3 轮，观察是否再现 16/18 ——
（a）直接连跑 `NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js` 3 轮；
（b）更贴近真实路径：用**磁盘上的** 60～70 MiB zip（而不是驱动那种在 guest 里现场构造的 64 MiB `File`）走一次真实弹框上传，观察状态行是否稳定显示「导入失败：请求体超过上限（33554432 字节）」且设置页**不重新加载**。

**Expected：** 三轮均 18/18；或（b）中状态行稳定出现失败原因、设置页不刷新。

**Why human：** 本轮已能**排除**「应用静默吞掉 413」——签名实验室实测证明红轮 DOM 指纹（`text:''` + `danger:false` + 计算态 `display:'block'` + `gate:''`）与「`location.reload()` 后的全新 DOM」**逐字段吻合**、与「`closeSkillImportModal()` 后的态」在 `display` 上**互斥**（`none` vs `block`），且同一红轮里 `guestWaitFor(danger)` 已先返回 `true`（应用确实渲染过失败文案）。**但根因未被取到**：驱动只保留最后 25 行主进程日志，红轮尾部未见 `渲染进程退出`；4 次插桩副本（含宿主侧 webview 生命周期监听 `render-process-gone`/`dom-ready`/`did-finish-load`）**全部 18/18、无重载事件**，无法复现 ⇒ **无法程序化判定**抖动来自「夹具把 64 MiB 包整体驻留 guest 堆导致的渲染进程内存压力」还是「应用侧真实缺陷」，也无法排除与 PID 58412 那个共用 userData 的并发实例相关。需要人工裁决：**接受并同步改口径**（`51-UAT.md:75/:103` 与 `51-VALIDATION.md:99` 现写的「连跑 2 轮均 18/18，无抖动」应改为如实口径，如「12 次实跑 1 红，指纹为 guest 重初始化」），**或**先定位根因再收尾。

逐条说明其余人工面为何**不需要**人工项：

- 上一轮唯一人工项（B 侧 RSS 阈值）已闭合，本轮复核其在代码层真实落地（真删 + 承重面转移成立）。
- 29 条 truth 的支撑物本轮**逐字未变**（git 已证），且七个套件 + counts-parity 本轮全部实跑通过 ⇒ 无新的必须人工项。
- **诚实边界未变、仍需读者知道**（不是人工验证项，但不得被读成「已完全自动化」）：① **403 / 429 未真实触发 GitHub 侧限流** —— 导入链路只打 `codeload.github.com`，60 req/h 未鉴权配额打在 `api.github.com`，两者**不是同一配额域**；403 / 429 用 `net.fetch` 单点替身返回**真实形状**响应头，证据标 `substituted: true`；真实 404 走真链路。② **guest JS 堆曲线只登记不断言**；主进程 RSS 亦不可断言（本轮实测同一路径跨度 48–71 MB）。

## Gaps Summary

**无 must-have gaps**。状态为 `human_needed` —— 唯一原因是上节那条**需人工裁决**的抖动项。

逐层判决（Step 9 决策树，按最严格优先）：

1. **FAILED truth / MISSING·STUB artifact / NOT_WIRED key link / blocker anti-pattern** —— **无一命中**。
   - 29 条 must-have truth 全部 VERIFIED，其支撑物本轮**逐字未变**（`git diff --stat 7eda2ff..1fee7c2 -- <35 covered 文件>` ⇒ 仅 1 个**非真值链**文件变动）；8 条行为依赖型 truth 各有真跑的行为测试。
   - 142 个需求挂钩套件断言（55+198+115+49+41+116+50 = **624 例**）本轮实跑 **fail 0**；counts-parity `cells=20` 通过；12 个需求 ID 零 orphaned。
   - 债务标记门禁未触发（本轮变更文件 `TBD`/`FIXME`/`XXX` 零命中）。
   - 补充驱动 `tests/uat-51-import-limits.js` 的抖动是 **⚠️ Warning**（artifact 存在且实质可用，只是非确定性），不是 MISSING/STUB，也没有使任何 truth 失败 ⇒ **规则 1 不触发**。
2. **人类验证项** —— **1 条命中**（超限 413 的 UI 呈现抖动裁决）⇒ 按规则 2，状态为 `human_needed`。
3. ⇒ **`status: human_needed`**（`score: 29/29`、`behavior_unverified: 0`、`gaps: 无`）。

**本轮相对上一轮的净变化**：`passed` → `human_needed`；artifact `tests/uat-51-import-limits.js` 由 `✓ VERIFIED` 下调为 `⚠️ FLAKY`；两条 ℹ️ Info **闭合**；新增 1 条 ℹ️ Info（断言名过其实，`:875`）、1 条 ⚠️ Warning（驱动抖动）、1 条 📋 Advisory（并发会话下指纹不可复现，Advisory #5）；`covered_digest` 重算为 `c74c4f52…`（并已修正首次算得的污染值）。**没有为了收绿而删除任何项**。

### 关于 CR-01 的边界说明（沿用上轮口径，供决策）

CR-01 仍是本阶段唯一被独立复现的**用户可见缺陷**（`src/settings-page.js:6844`，重复预览后无法自救济），但它不落在任何 must-have truth 上（51-04 的句柄 truth 只要求三态「明确码 + 可读原因」，该条成立），且已记入 `51-REVIEW.md` 作技术债 ⇒ verifier 不将其计为 gap。若维护者认为「重复预览后无法自救济」应视为目标未达成，可将 CR-01 提升为 gap 并走 `/gsd-plan-phase 51 --gaps`。

---

_Verified: 2026-09-15T13:10:30Z_
_Verifier: Claude (gsd-verifier)_

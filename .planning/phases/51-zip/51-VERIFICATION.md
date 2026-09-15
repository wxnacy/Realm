---
phase: 51-zip
verified: 2026-09-15T12:58:41Z
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
covered_digest: "v1:sha256:7cbbae2bce814c7e0ebb3e10f8f37cb8c4e5328877cb2b54b773113546e03725"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 29/29 must-haves verified
  previous_digest: "v1:sha256:3cdc35b12044911d60bd38c000e7bfd343ab961d6c4fe1cb21d0b6b083c2dc71"
  previous_verified: 2026-09-15T12:41:18Z
  kind: "判据口径修正后的最小重跑（非全量重验）"
  human_items_closed:
    - "上一轮唯一的人工项（`tests/uat-51-import-limits.js` 的 `B（强判据）RSS 增量 ≤ maxBytes + 8 MiB` 分支相关且不稳定）已按 verifier 自己给出的**第二个选项**处置：删阈值断言，B 侧 RSS 改记为 `overRssReading`（只登记不断言），「不无上限读入内存」改由 `readRawBody` 的确定性源码契约 + 三条单点变异自证承重（提交 `7eda2ff`）。本轮独立复核该处置在代码层**真的落地**（非「换个名字继续断言」）⇒ 该项**闭合**，不重复挂账"
  gaps_closed:
    - "G-51-1 / CR-02：网络地址导入（zipball 与直链 SKILL.md 两条路径）在真实运行期可用 —— 修复前 `ai-manager.js` 的 `downloadPackage` 只有调用没有绑定 ⇒ 100% `ReferenceError`（本项由 `51-UAT.md` 登记为 blocker 并已 resolved；上一份 VERIFICATION.md 无 `gaps:` 段，该缺陷当时未被发现，故此处属「事后追溯闭合」而非「上轮 gap 闭合」）"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "本机仍存在一个**先于本轮取证**的 dev 实例（PID 58412，`node_modules/electron/dist/…/Electron --inspect=0 --remote-debugging-port=0 .`），其 userData 与四支 uat 驱动共用 `realm-dev` —— 与上一轮 Advisory #5 记录的**同一个** PID（启动于 20:08:32，早于两轮取证的驱动时段）"
    category: repro-environment
    reason: "该实例会与本轮驱动共用同一份 `realm-dev` userData ⇒ 改变技能目录基点与 `.tmp` 残留基线。按本仓「清理只按自身 PID、不按路径模式 pkill」的纪律，verifier **未**处置它（它不是本轮驱动遗物）。**不影响本轮任何结论**：`B（强判据）` 已删除，剩余 RSS 读数取自驱动自身主进程（进程隔离）；驱动另有 `preTmpResidue` 差值口径。复跑者需注意：跑 `-live.js` 这类依赖「组件列表 19 → 20」基线的驱动前，先确认无其它 realm-dev 实例"
    evidence_status: "实测（`pgrep -fl`，PID 58412 与上轮记录一致）"
  - finding: "指纹失效仍由「与本阶段无关的仓库级共享文件」放大的结构性噪声（本轮新增的这一处已消失：本轮 823b74c→7eda2ff 仅 1 个 covered 文件变动）"
    category: cross-workstream-staleness
    reason: "上一轮实证 3 处失效中有 2 处（`main.js` `8603bad`、`AGENTS.md` `47dc69c`）来自并发 webview 工作流。`AGENTS.md` 是共享文件、任何工作流的文档改动都会使本阶段指纹失效。若要减噪，可考虑把仓库级共享文件从 covered_files 分离 —— 属流程改进建议，不影响任何 must-have"
    evidence_status: "none provided（流程建议，无可复现缺陷）"
---

# Phase 51: 用户技能导入管线（zip + 网络地址）Verification Report

**Phase Goal:** 用户可从本地 zip 包或网络地址安全导入技能，导入前看清将写入什么；恶意或畸形包整包拒绝且工作区外零写入。
**Verified:** 2026-09-15T12:58:41Z
**Status:** passed
**Re-verification:** Yes — **判据口径修正后的最小重跑**（上一轮为全量重验）

## 本轮的性质与「最小重跑」的判断依据

### 起因

上一轮（`verified: 2026-09-15T12:41:18Z`，`status: human_needed`，`score: 29/29`）提出**唯一**一条人工项：`tests/uat-51-import-limits.js` 的 `B（强判据）RSS 增量 ≤ maxBytes + 8 MiB` **分支相关且不稳定**，并给出两个可选处置。该人工项已按**第二个选项**处置（提交 `7eda2ff`）。本轮即复核该处置是否真的落地、并判断是否留下新的必须人工项。

### 为什么本轮不需要逐条重新取证 29 条 must-have（可复算的证据）

不是「相信上一轮」，而是先用 git 把**变化面**钉死：

```bash
git diff --stat 823b74c 7eda2ff -- <35 个 covered 文件>
#  tests/uat-51-import-limits.js | 55 ++++++++++++++++++++++++++++-------------------
#  1 file changed, 36 insertions(+), 19 deletions(-)
git log --oneline 7eda2ff..HEAD      # 空
```

⇒ 在本阶段的**全部承重产物**里，本次只有**一个**文件被改动；`agent-workspace.js` / `ai-skills-manager.js` / `ai-manager.js` / `main.js` / `src/*` / 五个既有套件 / 三份文档 **零改动**。29 条 must-have 的支撑物因此逐字未变，上一轮对其的独立复算（剥注释计数 / 跨文件相等性 / 常量键集 / 真跑测试）仍然有效。

### 该文件是否在 must-have 真值链上 —— 四条独立判据，结论：**不在**

1. **七个 PLAN 零声明**：`grep -c "uat-51-import-limits" 51-0*-PLAN.md` ⇒ **0 / 0 / 0 / 0 / 0 / 0 / 0**。该驱动在任何计划的 `must_haves` / `artifacts` 中都不存在（PLAN 里被声明的 uat 驱动只有 `tests/uat-51-import-modal.js`，见 51-06）。它进 `covered_files` 是**上一轮 verifier 的增补**（理由见下文「covered_files 的增补」），属 verifier 自设的承重面，而非阶段契约。
2. **29 条 truth 的 Evidence 列无一引用它**：上一份报告中该文件只出现在 `covered_files`、`human_verification`、Required Artifacts 表（标 ⚠️ PARTIAL）、Behavioral Spot-Checks 表（标 FLAKY）、Anti-Patterns 表——**从不出现在 #1–#29 任何一条的 Evidence 列**。29 条 truth 引用的 uat 驱动是 `-live.js`（#22 / #23）与 `-modal.js` + `-modal-sizes.js`（#26 / #27）。
3. **它想承重的承诺另有更强的行为判据**：驱动声称承重的是「上传体超限 ⇒ 413」这条。该承诺的 must-have 归属是 truth #11（六类限额）与 #21（码矩阵 `oversize`），真正的**行为**承重面在 `tests/test-skills-http-api.js`（本轮实跑 **41/41**），内含真 stub server + 真 HTTP 客户端的四例：① chunked 走累积分支拿 413 且 body 可 `JSON.parse` 并回传 `limit`（`:451`）；①b 带 `content-length` 的快路径同样拿 413（`:464`）；② 413 路径零 `unhandledRejection`（`:475`）；**④ 反向对照 —— 把 `req.resume()` 换成 `req.destroy()` 形态后客户端拿不到 413**（`:526`），即该断言**自证可失败**。⇒ 两条分支 + 反向对照齐备，且完全不依赖本驱动。
4. **ROADMAP 的五条 Success Criteria 均未出现该量**：SC-5 只有「流式字节上限」（下载侧，归 truth #23 / net 套件 50/50），**无**「进程 RSS 上界」这一条。`main.js` 注释里「ROADMAP 判据 5 的判据对象是『不无上限读入内存』」是对 SC-5 的**解释性表述**，其实现层判据即 `readRawBody` 的源码契约（下节核过，真实成立）。

## 处置核对：第 1 步改动是否真的「只登记不断言」（**打开文件逐行核对，不采信描述**）

结论：**代码层是真的删了断言**，不是改名保留。证据是**穷举** `overRssDelta` 的每一处出现（`grep -n overRssDelta`，9 处），逐处判其是否落在判据里：

| 行 | 用途 | 是否构成判据 |
| -- | ---- | ------------ |
| `:863` | `const overRssDelta = overRss.max - overRss.first;` | 赋值 |
| `:866` | 写入 `evidence.artifacts.overUpload.rss` | 证据 |
| `:868` | `log(...)` | 日志 |
| `:881` | `overBranch = overRssDelta < 8 MiB ? 'fast-path' : 'bounded-accumulation'` | 仅派生一个**标签** |
| `:885` | 写入 `evidence.artifacts.overRssReading.rssDelta` | 证据 |
| `:896` | `check(...)` 的**详情字符串**（第 3 参） | **不是** pass 条件 |
| `:899` / `:902` | `log(...)` 读数行 | 日志 |
| `:904` | 写入 `evidence.artifacts.rssCrossReading` | 证据 |

`MAX_BYTES` 同样只在 `:880`（定义）、`:886`（证据字段）、`:896`（详情字符串）出现 —— **全程零比较运算**。被删的两条断言（`overRssDelta <= MAX_BYTES + 8 MiB` 与 A/B 两侧对照）在 diff 中确认为**删除**而非改写：

```
-      overRss.count >= 3 && overRssDelta <= MAX_BYTES + 8 * 1024 * 1024,
-      buildOver.size > buildNear.size && overRssDelta < rssDelta && rssDelta > 16 * 1024 * 1024,
```

剩余与 RSS 相关的唯一 `check`（`:893`）pass 条件是 `overBranch === 'content-length-fast-path' || overBranch === 'bounded-accumulation'`，而 `overBranch` 恰是 `:881` 的三元表达式赋值 ⇒ **该条件恒真、不可能失败**（详见 Anti-Patterns ℹ️ 第 2 条）。⇒ 删掉的是一条真判据，留下的是一个信息性标签；「只登记不断言」成立。

**承重面转移是否成立**（即「不无上限读入内存」现在由谁扛）：`main.js:1044-1079` 的 `readRawBody` 真身已逐行读过 —— `:1060` `Content-Length` 预检（注明「只作加速，**不得**取代下面的累积中判」）；`:1066-1075` 累积中 `if (rejected) return;` **先于** `size += chunk.length`（顺序即判据），越界即 `tooLarge()`；`:1055` `req.resume()` 排水而非 `destroy`（注释说明 `destroy` 会让客户端拿不到 413）。⇒ **应用侧累积上界确实被 `maxBytes` 夹住**，「内存上界如实为 `maxBytes`」在**应用缓冲**这个被断言的量上真实成立；被删的那条断言测的是**进程 RSS**，是另一个量（上一轮已实证其在该路径上读到 body 的 2.4–3 倍，即不测应用缓冲）。处置口径因此是**技术正确**的，不是回避。

## Goal Achievement

### Observable Truths

本轮对 29 条的复核方式：**支撑物未变（git 已证）⇒ 沿用上一轮的独立复算结论**；本轮新增/重跑的量各自标注「本轮实跑」。SUMMARY 的陈述一律当作**未验证输入**。

#### Plan 51-01 — SEC-10 沙箱写面加固

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `env.writeFile(<root 内 symlink 指向 root 外>/x)` 返回 `{ok:false, error.code:'permission_denied'}`、不 throw，且 root 外**真的没有**产生文件 | ✓ VERIFIED | `agent-workspace.js:258` `resolveInsideForWrite` + `:332` `guardForWriteResult`；`node tests/test-agent-workspace.js` ⇒ 38/38（**上轮实跑**；该文件本轮零改动）。两条判据单源确认：`buildRootBaseline`（`:161`）与 `isInsideBaseline`（`:184`）被读面（`:217/:219/:223`）与写面（`:266/:268/:276`）共用 |
| 2 | 沙箱内**自指** symlink（`ln -s . loop`）下的写入仍放行（加固未收紧过头） | ✓ VERIFIED | 同上套件 ok 2/ok 5；十例期望表中「仅『link OUT then write』一处由放行转拒绝」证实既有集合零变化 |
| 3 | 五个写方法（`writeFile`/`appendFile`/`renameFile`/`createDir`/`remove`）+ 两个临时目录方法切到 `guardForWriteResult`；读面仍走 `guardResult`，两者**并列存在** | ✓ VERIFIED | 独立复算（剥注释）：`guardForWriteResult(` 11 处、`guardResult(`（排除 `ForWrite`）8 处，两侧并列；测试 ok 11/ok 12（写面方法体内零 `realpathSync`） |
| 4 | `resolveInsideForWrite` 对非字符串 / 空串 / 纯空白 / `..` 逃逸 / 绝对路径越界 / 兄弟前缀目录一律返回 `null`（fail-closed，不抛、不 fallback 到 root） | ✓ VERIFIED | 实现 `:258-283`；`module.exports` 导出；测试 ok 3 + ok 4 |

#### Plan 51-02 — 依赖落定

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 5 | `dependencies` 含 `"yauzl": "^3.4.0"` 与 `"yaml": "2.9.0"`（逐字，无 `^`）；`yaml` **单实例**；`yauzl` 暴露 Promise API | ✓ VERIFIED | 独立复算：`package.json` 实测 `yauzl=^3.4.0` / `yaml=2.9.0`；`node_modules/yaml/package.json` = `2.9.0`；`node_modules/@earendil-works/pi-agent-core/node_modules/yaml` **不存在**；`yauzl` 包 `scripts` 无 `postinstall` |
| 6 | 两包均无 `postinstall`；`build.files` 全部 `!` 前缀；`build.asarUnpack` 未被改动 | ✓ VERIFIED | 独立复算：`build.files` 每项 `!` 开头（`every(startsWith('!'))` = true）；`asarUnpack` 仍为 `["node_modules/nodejieba/**","skills-builtin/**"]`。回归实跑：`node tests/test-builtin-skills-seeder.js` ⇒ 101/101（**上轮实跑**） |

#### Plan 51-03 — zip 全量校验 + 唯一落盘实现

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 7 | 同包 SKILL.md 计数 = 1 ⇒ 进预览；= 0 或 ≥ 2 ⇒ 整包拒绝并给可操作提示（含 `tree/<ref>/<path>` 示例） | ✓ VERIFIED | `function locateSkillRoot` 在位（全包扫描）；用例组「locateSkillRoot：限域 → 直接命中 → 全包扫描」（`:538`）含多技能根拒绝（`:583`）与零技能根拒绝（`:608`） |
| 8 | 两阶段：preview 返回 `{importId, preview}` 且**不产生** `skills/<name>/`；仅 commit 后出现该目录；预览六字段齐备 | ✓ VERIFIED | 用例组「tracer：preview 不落盘 → commit 落盘 → 回读可见」（`:212`）+「sourceDir 已被 rename 走 ⇒ 包内副本不再存在」（`:289`）；真实运行期由 `-live.js` 复现 |
| 9 | 含 symlink entry 的包在**两条判据路**各自被拒，且断言点是「整包拒绝」而非「跳过条目」 | ✓ VERIFIED | `function assertNoSymlinkTree` 在位；用例组「symlink 两路独立判据」（`:1433`） |
| 10 | 逃逸族 + 空/仅斜杠/仅点 entry 名 + NFD+小写归一化查重各自整包拒绝 | ✓ VERIFIED | `function normalizedEntryKey` 在位；用例组（`:1499` / `:1582` / `:360`，含「原始字节面先判：CP437 会把 `\x01` 解码成 ☺」） |
| 11 | 六类限额各一例 + `uncompressedSize === 0xFFFFFFFF` 显式拒绝；嵌套深度**按技能根相对计** | ✓ VERIFIED | 独立复算 `IMPORT_LIMITS`（`Object.freeze`）**恰 8 键**：`MAX_ENTRY_BYTES=1 MiB` / `MAX_TOTAL_BYTES=32 MiB` / `MAX_ENTRIES=2000` / `MAX_COMPRESSION_RATIO=100` / `MAX_NESTING_DEPTH=16` / `PREVIEW_LIST_LIMIT=50` / `MAX_PENDING_IMPORTS=3` / `IMPORT_TTL_MS=10 min`；用例组（`:1608`） |
| 12 | 解压只在 `mkdtempSync` 新建空目录内；落点用「最近已存在祖先 realpath」复核；**真跑**越界对照组并断言 root 外零新文件 | ✓ VERIFIED | `function extractAndValidatePackage` + `function assertLandingInsideWriteRoot` 在位；`mkdtempSync(` 在 `ai-manager.js` 恰 1 处；越界对照组用例 `:1779` |
| 13 | `SKILL_THREAT_PATTERNS` 三类各有正样本命中；`skills-builtin/**` 零命中；`description` 与 body **双扫** | ✓ VERIFIED | `const SKILL_THREAT_PATTERNS`（`:4010`）+ `function scanSkillThreats` 在位；用例组（`:1940`）；消费点独立复算 `:4215`，导出面 `:4715` |
| 14 | **三种来源汇进同一个落盘实现**：`importUserSkill(` 全仓 = 定义 1 + 调用 1，`main.js` 与前端各 0；`yauzl.openPromise(` 恰 1 | ✓ VERIFIED | 独立计数（剥注释）：`ai-manager.js` 内 1 处调用、`main.js` 0、`src/settings-page.js` 0、`ai-manager.js` 内 `yauzl` 0 次；`yauzl.openPromise(` 全仓 1 处。套件同款判据（`:309` / `:332`） |

#### Plan 51-04 — 落盘事务与句柄生命周期

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 15 | seeded 同名 ⇒ 拒绝导入；user 同名三选一各自可达；改名走 `validateManagedSkillName`；managed 同名不许覆盖 | ✓ VERIFIED | `function resolveImportConflict` 在位；用例组（`:741` / `:627` / `:512`） |
| 16 | 覆盖事务可回滚：第二步 `rename` 真实注错 ⇒ 旧技能内容**逐字完好** | ✓ VERIFIED | 行为依赖型判据，由真跑测试承载：用例组「覆盖事务：备份 + 两段 rename + 回滚 + 回读失败回滚 + 数量闸口径」（`:786`） |
| 17 | 回读验证失败即回滚并暴露 `diagnostics` 原文（含 path） | ✓ VERIFIED | 同上用例组内「回读失败回滚」分支；`readback_failed` 码在 `IMPORT_SKILL_ERROR` 键集内（#21） |
| 18 | 句柄生命周期三态各自可达：`import_expired` / `import_not_found` / `too_many_pending`，皆为明确码 + 可读原因 | ✓ VERIFIED | 用例组「importId 生命周期：TTL / 并发上限 / 一次性 / 取消幂等」（`:1136`）；三个码均在 `IMPORT_SKILL_ERROR` 键集内 |
| 19 | 崩溃残留清扫不误删进行中的包（陈旧性判据正反两例）；前缀与实际产物**正向**成对 | ✓ VERIFIED | `IMPORT_TMP_PREFIXES` + `function isImportResidueName` 在位；用例组（`:1249`，含真实 mkdtemp 产物与真实覆盖备份的正向匹配 + mtime 刚/早两例） |
| 20 | 数量闸口径：达上限时**改名**被拒（计入）、**覆盖**同名成功（净增 0 豁免）；判据**读盘** | ✓ VERIFIED | `function countUserSkills` 在位（实时读盘口径）；断言落在 `:786` 用例组的「数量闸口径」分支 |
| 21 | 每个 `IMPORT_SKILL_ERROR` 码至少一条用例；失败文案含码 + 可读原因；限额类含限额名与当前值；无空 message | ✓ VERIFIED | 独立复算：`IMPORT_SKILL_ERROR`（`Object.freeze`）**恰 21 键**（`unsupported_url … conflict_unresolved`）；`MANAGE_SKILL_ERROR` 仍 **11 键**（命名空间隔离守住）。用例组（`:2620` / `:2070` / `:2361` / `:1358`） |

#### Plan 51-05 — 网络地址导入

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 22 | 仓库 / `tree/<ref>/<path>` / `blob`·raw 直链三形态各自分流；zipball 顶层前缀剥离；`api.github.com` 与白名单外主机回 `unsupported_url` | ✓ VERIFIED | `function classifyImportUrl` + `HOST_WHITELIST` 在位；用例组（net `:106`）。**真实网络端到端**由 `tests/uat-51-import-live.js` 独立复现 29/29（**上轮实跑**，该文件本轮零改动） |
| 23 | https 强制 / 白名单**精确**匹配 / 逐跳私网拒 / 跳数超限**抛错**而非报 HTTP 3xx / magic bytes / 流式上限命中即中止且清理半成品 | ✓ VERIFIED | 行为依赖型判据，由真跑测试承载：用例组（net `:478`，本地 stub server）；真实 404 走真链路由 `-live.js` 复现 |
| 24 | 直链 SKILL.md 与 zip 走**同一落盘函数**；可注入三键在生产调用点全用默认值（源码正命题） | ✓ VERIFIED | 独立复算：`ai-manager.js` 内三个可注入键 `isPrivateHost` / `hostWhitelist` / `fetchImpl` 各出现 0 次；三处 `downloadPackage(` 首参逐字 `undefined`；用例组（net `:698` / `:919`） |

#### Plan 51-06 — 导入 UI 完整面

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 25 | 完整弹框契约（E1–E18）+ 9 态状态机 + 元素顺序；15 个新增元素**零内联 `style`**；region 内**零 `innerHTML`/`insertAdjacentHTML`** | ✓ VERIFIED | 独立扫描 region `src/settings-page.js:5724-7010`（1287 行）：剥注释后 `innerHTML` 0 处、`insertAdjacentHTML` 0 处；`document.createElement(` 36 处、`textContent` 35 处（正负命题同时成立）；`src/settings.html` 弹框块零内联 `style`；三锚点齐备 |
| 26 | 两条 backstop（E2 弹框 overflow / E17 动作区 overflow）由**带正命题的属性测试**在真实渲染下满足 | ✓ VERIFIED | 行为依赖型判据。`uat-51-import-modal.js` ⇒ 52 passed（**上轮实跑**，真实 Electron 渲染读数）；多尺寸档由 `-modal-sizes.js` 补成 5 档矩阵 ⇒ 48/48（**上轮实跑**）。**本轮未复跑**（两文件零改动，见「最小重跑」依据） |
| 27 | 键盘契约：唯一 `tabindex` 是预览滚动容器的 0 值；Tab 序 = DOM 序；焦点归还 `#skillImportOpen`；提交中忽略 Escape | ✓ VERIFIED | 同上 `uat-51-import-modal.js` 52 项内实测（**上轮实跑**） |

#### Plan 51-07 — 文档与账本收口

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 28 | `docs/product/ai-skills.md` 第十三节【导入】+ `ai-agent-workspace.md` §七 SEC-10 行为变更 + `AGENTS.md` 导入维护约定与测试行；counts-parity `cells` 下限 20 且实测通过 | ✓ VERIFIED | **本轮独立复跑 counts-parity 判据命令（逐字复制 §11.8 的命令）⇒ `counts-parity ok` / `cells=20`**，实测值逐字：`{"test-manage-skill.js":"55","test-ai-skills.js":"198","test-skill-picker-model.js":"115","test-skills-management.js":"49","test-skills-http-api.js":"41","test-skills-import.js":"116","test-skills-import-net.js":"50"}`。三份文档均含对应章节与测试行（本轮核实存在性） |
| 29 | 文档数值与实现逐字一致：码表全集 = `IMPORT_SKILL_ERROR` 全部 21 值；限额值 = `IMPORT_LIMITS`；白名单条目无矛盾；四条诚实边界恒显；不出现已被实测推翻的旧理由 | ✓ VERIFIED | 独立复算：21 个码值在文档中全部出现（缺失 0）；诚实边界在位；`TD-48-01` 明确写「仍开未修…不声称已修」。**本轮新增的判据口径修正已同步进 `51-UAT.md` Test 3 的 `boundary` 段与 `51-VALIDATION.md` 的 Manual-Only 表**（verifier 核对内容与代码一致，见下） |

**Score:** 29/29 truths verified (0 present-but-behavior-unverified)

All 8 behavior-dependent truths (state transitions / cancellation-cleanup-ordering invariants — #1, #2, #12, #16, #17, #19, #23, #26) have a **passing behavioral test** that exercises the transition on real fs / real stub network / real render; none were accepted on symbol presence alone.

### 承重面转移后的口径核对（本轮新增的两处非承重产物）

| 文件 | 声称 | verifier 核对结论 |
| ---- | ---- | ---------------- |
| `51-UAT.md` Test 3（`result: pass`，`automated_by: 19/19`） | B 侧 RSS 只登记不断言；「不无上限读入内存」由源码契约 + 三条变异自证承重 | **与代码一致**。`boundary` 段如实登记「早先的 21/21 是单次采样」与「红灯 2～3/4」；`evidence` 段对 B 侧的措辞已由断言改为读数 |
| `51-VALIDATION.md` Manual-Only 表第 3 行 | 同上，并注明「已删阈值断言、改记 `overRssReading` + 分支标签」「连跑 3 轮均 19/19」 | **与代码一致**。前两项经本轮代码审计证实；「3 轮 19/19」由作者记录，**本轮独立复跑 2 次亦为 19/19** |

### Deferred Items

**无。** Phase 51 是本里程碑（v2.6，Phase 46–51）的**末阶段**，ROADMAP 中不存在 `number > 51` 的阶段 ⇒ Step 9b 的「延后项过滤」空集，无条目可延后。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `agent-workspace.js` | `resolveInsideForWrite` + `guardForWriteResult` + 五个写方法与两个临时目录方法切换 | ✓ VERIFIED | `:161/:184` 双基准单源、`:258` 写面定义、`:332` 包装、`:370..465` 接线；`module.exports.resolveInsideForWrite` 已导出 |
| `ai-skills-manager.js` | `IMPORT_LIMITS` / `IMPORT_SKILL_ERROR` / `validateEntryName` / `locateSkillRoot` / `readSkillPackageEntries` / `extractAndValidatePackage` / `buildImportPreview` / `importUserSkill` / `SKILL_THREAT_PATTERNS` / `scanSkillThreats` / `HOST_WHITELIST` / `classifyImportUrl` / `downloadPackage` / `prepareFromRawFile` | ✓ VERIFIED | 逐项独立复算存在（`IMPORT_LIMITS` `:2252`、`IMPORT_SKILL_ERROR` `:2331`、`SKILL_THREAT_PATTERNS` `:4010`）；导出面逐项核对 |
| `ai-manager.js` | `this._skillImports`、`previewSkillImport`、`commitSkillImport`、`cancelSkillImport`、`sweepSkillImports` + **CR-02 绑定** | ✓ VERIFIED | 均在位；`:1848 const { downloadPackage } = skillsManager;` 经真实运行期驱动证实有效（本轮零改动） |
| `main.js` | `MAX_SKILL_PACKAGE_BYTES`、`readRawBody`、`import` 分支按 Content-Type 分流 | ✓ VERIFIED | **本轮逐行读了 `readRawBody` 真身**（`:1044-1079`）：`Content-Length` 预检（`:1060`，注明只作加速）+ `if (rejected) return;` 先于累加（`:1067`）+ 越界即 `req.resume()` 排水（`:1055`）；零 `arrayBuffer` / `readAsArrayBuffer` / `FileReader` |
| `src/settings.html` | `#skillImportOpen` / `#skillImportFile` / `#skillImportModal` 全骨架 | ✓ VERIFIED | 三 id 齐备；弹框块零内联 `style` |
| `src/settings-page.js` | 导入 region（状态机 / 渲染 / 闭合文案表 / 净化） | ✓ VERIFIED | region `:5724-7010`（1287 行），剥注释后零 HTML 字符串模板 |
| `src/styles/main.css` | 专属样式段（含 3 条作用域覆盖） | ✓ VERIFIED | 段落存在；UAT 渲染实测生效（多尺寸档 48/48，上轮） |
| `tests/test-skills-import.js` | 新建套件 | ✓ VERIFIED | **本轮实跑 116/116** |
| `tests/test-skills-import-net.js` | 新建套件（stub server） | ✓ VERIFIED | **本轮实跑 50/50** |
| `tests/helpers/make-malicious-zip.js` | 恶意样本夹具生成器（零外部依赖） | ✓ VERIFIED | 套件 ok 3 断言不出现 `python3` / `zip` 命令行 |
| `tests/uat-51-import-modal.js` | 真实渲染 uat 驱动 | ✓ VERIFIED | **上轮恒等复跑 52 passed**（本轮未复跑，文件零改动） |
| `tests/uat-51-import-live.js` | 真实网络 uat 驱动 | ✓ VERIFIED | **上轮独立复跑 29/29 passed**（本轮未复跑，文件零改动） |
| `tests/uat-51-import-modal-sizes.js` | 多尺寸档 uat 驱动 | ✓ VERIFIED | **上轮独立复跑 48/48 passed**（本轮未复跑，文件零改动） |
| `tests/uat-51-import-limits.js` | 限额与内存面 uat 驱动 | ✓ VERIFIED（**本轮由 ⚠️ PARTIAL 转为 VERIFIED**） | **本轮实跑 2 次：19/19（exit 0）、19/19（exit 0）**，零红灯、零抖动。上一轮的分支相关红灯随阈值断言删除而消失。⚠️ 19 条中有 **1 条为恒真的信息性登记**（见 Anti-Patterns ℹ️ 第 2 条）⇒ 应读作「18 条判别性 + 1 条信息性」。**注**：该文件不在任何 must-have 真值链上（见上文四条判据），其状态不影响 29 条 truth 的判定 |
| `docs/product/ai-skills.md` §13 / `docs/product/ai-agent-workspace.md` §7 / `AGENTS.md` | 文档与账本 | ✓ VERIFIED | 三处均落地，数值与实现一致（**本轮 counts-parity `cells=20` 实跑通过**） |

无 MISSING 或 STUB artifact。

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| 三条来源（上传 / zipball / raw 直链） | `importUserSkill` | 共用一段后段 | ✓ WIRED | 独立计数（剥注释）：`importUserSkill(` 定义 1 + 调用 1；`main.js` / 前端各 0；`yauzl.openPromise(` 恰 1 |
| `previewSkillImport`（三条来源唯一入口） | `extractAndValidatePackage` / `prepareFromRawFile` | 两个准备器产出同一 `{pkgRoot}` 形状 | ✓ WIRED | net 套件 `:698` + `:919`；`locateSkillRoot(` / `buildImportPreview(` 在 `ai-manager.js` 各恰 1 处 |
| **CR-02 修复链**：`getAiSkillsManagerLazy()` | 三处网络分支的 `downloadPackage` | `const { downloadPackage } = skillsManager;` 显式解构 | ✓ WIRED | `ai-manager.js:1848`；三处调用点首参逐字 `undefined`；真实运行期由 `-live.js` 29/29 证实（修复前 100% `ReferenceError`） |
| `resolveInsideForWrite` | 五个写方法 + 两个临时目录方法 | `guardForWriteResult` 唯一包装 | ✓ WIRED | 独立复算：写面 11 处 `guardForWriteResult(`、读面 8 处 `guardResult(`，并列存在；写面方法体内零 `realpathSync` |
| `IMPORT_LIMITS` | preview 响应的 `limits` → 设置页 | 单源回传，前端零字面量 | ✓ WIRED | 套件「端点与前端零字面量…」（`:340`） |
| `IMPORT_SKILL_ERROR`（21 值） | `SKILL_IMPORT_ERROR_TEXT`（前端闭合表） | 双向覆盖 | ✓ WIRED | 套件（`:2453`）；独立复算表键 ⊇ 21 值 |
| `search-manager.isPrivateHost` | `downloadPackage` 默认 `isPrivateHost` | 惰性 require + 依赖注入默认值 | ✓ WIRED | `getSearchManagerLazy` 在位；三个可注入键在 `ai-manager.js` 出现 0 次 |
| `main.js` `MAX_SKILL_PACKAGE_BYTES` | `IMPORT_LIMITS.MAX_TOTAL_BYTES` | 跨文件相等性断言 | ✓ WIRED | 独立复算两者均为 `33554432` |
| 成功出口 | `ensureSkillsFresh()` 恰一次 + 调用侧 `broadcast('skills:changed')` 恰一次 | D-19 写路径收口 | ✓ WIRED | 套件 D-19 计数断言在位；`syncAgentSystemPrompt()` 函数体逐字未改 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `#skillImportPreview` 六字段 | `skillImportTarget.preview` | `previewSkillImport` → `buildImportPreview`（真实解压后的目录树 / 字节统计 / 扫描结论） | Yes | ✓ FLOWING |
| 字节数与限额对照 | `preview.bytes` / `preview.maxFileBytes` / `preview.limits` | `collectPreviewStats`（真遍历 `pkgRoot`）+ `buildImportLimitsProjection()` | Yes | ✓ FLOWING |
| 扫描结论两栏 | `preview.scan.injection` / `preview.scan.heuristic` | `assertNoInjection` + `scanSkillThreats`（真实模式匹配） | Yes | ✓ FLOWING |
| 冲突三选一 | `preview.conflict` | `resolveImportConflict`（`env.listDir` / `env.fileInfo` **实时读盘**，非缓存快照） | Yes | ✓ FLOWING |
| 网络下载目标 | `classifyImportUrl(url).target` | 真实 URL 分类；**运行期由 `-live.js` 证实真实 zipball 落到真实 `skills/pdf/`** | Yes | ✓ FLOWING |
| **B 侧 RSS 读数**（本轮变更） | `overRssReading.rssDelta` | `process.memoryUsage().rss` 的 `max - first`（**环境读数，不参与任何判定**） | 不适用（刻意不承重） | ✓ 按设计降级为读数 |

No HOLLOW / DISCONNECTED / STATIC / HOLLOW_PROP findings.

### Behavioral Spot-Checks

标「本轮实跑」者为本轮命令的真实输出；标「上轮实跑（本轮未复跑）」者为上一轮输出，本轮因文件零改动（git 已证）未重跑 —— 未把上轮读数量当作本轮读数。

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| **限额与内存面（本轮变更文件）** | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js` | **第 1 次 `19/19 passed`（exit 0）；第 2 次 `19/19 passed`（exit 0）** | ✓ PASS（**本轮实跑 ×2**） |
| 导入面 zip 全量校验与落盘 | `node tests/test-skills-import.js` | `# tests 116 / # pass 116 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 网络面分类 / 白名单 / 逐跳 / magic / 流式 | `node tests/test-skills-import-net.js` | `# tests 50 / # pass 50 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 管理面 | `node tests/test-manage-skill.js` | `# tests 55 / # pass 55 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 技能域（含威胁扫描正命题 + D-19 计数） | `node tests/test-ai-skills.js` | `# tests 198 / # pass 198 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 技能选择器模型 | `node --test tests/test-skill-picker-model.js` | `# tests 115 / # pass 115 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 技能管理面 | `node tests/test-skills-management.js` | `# tests 49 / # pass 49 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 传输面（含 413 两分支 + 反向对照） | `node tests/test-skills-http-api.js` | `# tests 41 / # pass 41 / # fail 0` | ✓ PASS（**本轮实跑**） |
| 例数一致性账本 | counts-parity 内联命令（逐字复制 `ai-skills.md` §11.8） | `counts-parity ok` / `cells=20`，7 个实测值逐字命中账本 | ✓ PASS（**本轮实跑**） |
| 源码判据的判别力（三条单点变异自证） | 内含于上述 limits 驱动（变异 1/2/3 逐条精确转红） | 变异 1 `arrayBuffer` 0→1；变异 2 `fileBodyDirect` true→false；变异 3 `contentLengthFastPath` true→false 且 `arrayBuffer` 0→1 | ✓ PASS（**本轮实跑**，见驱动输出） |
| 沙箱写面加固行为面 | `node tests/test-agent-workspace.js` | 38/38 | ✓ PASS（上轮实跑，本轮未复跑） |
| 回归：播种器 | `node tests/test-builtin-skills-seeder.js` | 101/101 | ✓ PASS（上轮实跑，本轮未复跑） |
| 真实网络端到端（Test 1 + Test 2） | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-live.js` | 29/29 passed（exit 0） | ✓ PASS（上轮实跑，本轮未复跑） |
| 真实渲染 UAT | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` | 52 passed（exit 0） | ✓ PASS（上轮实跑，本轮未复跑） |
| 多尺寸档布局矩阵 | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal-sizes.js` | 48/48 passed（exit 0） | ✓ PASS（上轮实跑，本轮未复跑） |
| 指纹重算 + 独立实现交叉验证 | `verification.fingerprint` 动词 vs verifier 自撰 `node /tmp/zzq_indep_fp.js` | 两者输出**逐字节相同**：`v1:sha256:7cbbae2bce814c7e0ebb3e10f8f37cb8c4e5328877cb2b54b773113546e03725`（35 项） | ✓ PASS（**本轮实跑**） |
| 变化面收敛性（最小重跑的依据） | `git diff --stat 823b74c 7eda2ff -- <35 covered 文件>` + `git log --oneline 7eda2ff..HEAD` | 仅 `tests/uat-51-import-limits.js` 变动（+36/−19）；无后续提交 | ✓ PASS（**本轮实跑**） |

**本轮两次 RSS 原始读数（只登记，不作判据）**：
第 1 次 —— A 侧 body 31,748,626 B → RSS 增量 83,787,776 B（> 16 MiB 正命题成立）；B 侧 body 67,111,340 B → RSS 增量 147,456 B，标签 `content-length-fast-path`。
第 2 次 —— A 侧 RSS 增量 84,885,504 B；B 侧 RSS 增量 5,193,728 B，标签 `content-length-fast-path`。
⇒ 同一个"快路径"标签下 B 侧读数 147 KB 与 5.19 MB 相差 **35 倍**，再次佐证该仪器（及由它派生的分支标签）不可用于断言 —— 与处置理由一致。

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/*/tests/probe-*.sh` 约定路径 | `find scripts -path '*/tests/probe-*.sh' -type f` | 本阶段无此类探针（PLAN/SUMMARY 亦未声明 probe） | N/A |

### Requirements Coverage

全部 12 个 ID 均在 PLAN frontmatter 声明，且在 `.planning/REQUIREMENTS.md` 中映射到 Phase 51。**无 ORPHANED requirement**：REQUIREMENTS.md 映射的 `USER-03, USER-04, USER-05, USER-08, SEC-02..08, SEC-10`（12 个）与 7 个 PLAN 的 `requirements` 字段**并集**完全一致（独立复算）。

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USER-03 | 51-02, 51-03, 51-07 | 上传 zip 导入技能（单技能包语义；0 或 ≥2 技能根报错并提示） | ✓ SATISFIED | truth #7 + #8；套件 `locateSkillRoot` 多根/零根用例 + tracer 组 |
| USER-04 | 51-02, 51-05, 51-07 | 网络地址导入，自动分流 GitHub 仓库 / 目录 与 SKILL.md 直链 | ✓ SATISFIED | truth #22；离线值域矩阵 + 真实网络端到端 29/29 |
| USER-05 | 51-03, 51-04, 51-06, 51-07 | 两阶段（预览 → 确认落盘）；预览展示名称 / description 原文 / 目录树 / 字节数 / 脚本清单（标红）/ 威胁扫描结论 | ✓ SATISFIED | truth #8 + #25；`uat-51-import-modal` 52 passed 含六字段渲染快照与脚本标红；多尺寸档 48/48 |
| USER-08 | 51-04, 51-06, 51-07 | 导入失败给出真实原因（命中哪个限额 / 扫描结论 / 校验错误），不静默 | ✓ SATISFIED | truth #21 + #23；21 码零跳过；真实 404 文案走真链路实测 |
| SEC-02 | 51-03, 51-07 | 拒绝含 symlink entry 的**整包**（central directory 属性 + 解压后递归 `lstat` 两路） | ✓ SATISFIED | truth #9；`symlink 两路独立判据` 用例组 |
| SEC-03 | 51-03, 51-07 | 逐 entry 路径校验（`..` 归一化后判 / 绝对路径 / 盘符 / UNC / 反斜杠 / NTFS ADS / 控制字符 / 尾随空格与点）+ NFD+小写查重 | ✓ SATISFIED | truth #10；逃逸族十二类 + 八条判据组（含原始字节面） |
| SEC-04 | 51-03, 51-07 | 先读 central directory `uncompressedSize` 预检，再边解边累加；覆盖单 entry / 累计 / entry 数 / 压缩比 / 嵌套深度 | ✓ SATISFIED | truth #11；六类限额各具名用例 + zip64 / 加密 / 不支持方法 / 空包 / data descriptor |
| SEC-05 | 51-03, 51-07 | 解压到 `fs.mkdtempSync` 全新空目录；落点用**最近已存在祖先 realpath** 复核 | ✓ SATISFIED | truth #12；`assertLandingInsideWriteRoot` + 真跑越界对照组零新文件 |
| SEC-06 | 51-03, 51-07 | 扫描 `description` 与 body：复用 `scanInjectionPatterns` + 新增 `SKILL_THREAT_PATTERNS` 三类 | ✓ SATISFIED | truth #13；双扫用例组 + `SKILL_THREAT_PATTERNS` 消费点独立复算 |
| SEC-07 | 51-04, 51-07 | 与内置同名 ⇒ 拒绝；与已有用户技能同名 ⇒ 显式策略（覆盖 / 改名 / 取消），不静默覆盖 | ✓ SATISFIED | truth #15；`resolveImportConflict` 三档判定组（顺序即语义） |
| SEC-08 | 51-05, 51-07 | https-only + 主机白名单 + 逐跳 `isPrivateHost` + 流式字节上限 + magic bytes；**不复用** `search-manager.fetchUrl`，复用其 SSRF 判据 | ✓ SATISFIED | truth #23 + #24；stub server 用例组；`ai-skills-manager.js` 内无 `fetchUrl` 调用、无私网判据副本 |
| SEC-10 | 51-01, 51-07 | 加固既有沙箱 `writeFile` 的 ENOENT symlink 缺口（与导入路径同一根因） | ✓ SATISFIED | truth #1–#4；38/38 通过，含十例期望表与既有集合零变化对照 |

### Test Quality Audit

针对本轮 GSD 门禁 `audit_test_quality` 的四个面，对**与需求挂钩**的测试文件（`tests/test-*.js` 七个套件）复核：

| 面 | 结论 |
| -- | ---- |
| 禁用测试（`it.skip` / `test.skip` / `xtest` / `#[ignore]` 等） | **零命中** —— 七个套件无跳过式禁用；无「唯一承重测试被禁用」情形 |
| 循环测试（预期值由被测系统自身生成） | **零命中** —— 七个套件均以真 stub server / 真 fs / 真解压产物作 oracle；`test-skills-http-api.js:526` 更含**反向对照**（`destroy` 形态拿不到 413）自证断言可失败 |
| 断言强度 | 与需求挂钩的判据均为 **Value / Behavioral 级**（413 状态码 + body 内容 + 限额数字；落盘文件回读 + 字节数 + sha256；闭包计数 + 跨文件相等性），未退化为仅 existence/type |
| 覆盖数量 | counts-parity 逐账户单元比对通过（`cells=20`），七套件实测值逐字命中账本 |
| **额外发现（非承重文件）** | `tests/uat-51-import-limits.js`（**不在任何需求的测试映射内**）有 1 条恒真断言 —— 见 Anti-Patterns ℹ️ 第 2 条。因该文件不承重任何需求，按门禁规则**不构成 BLOCKER**（门禁仅对「与需求挂钩」的测试判 BLOCKER） |

**Disabled tests on requirements:** 0 → 无 BLOCKER
**Circular patterns detected:** 0 → 无 BLOCKER
**Insufficient assertions:** 0（承重面）→ 无 WARNING

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| ~~`tests/uat-51-import-limits.js`~~ | ~~`:874-876`~~ | ~~`B（强判据）` 分支相关且非确定性（阈值 41,943,040 B）~~ | ~~⚠️ Warning~~ | ✅ **本轮已消除（RESOLVED）**。阈值断言已删除（`git diff` 确认是删除而非改写）；`overRssDelta` 经由**穷举 9 处引用**确认不再出现在任何 `check` 的 pass 条件中。本轮实跑 2 次均 19/19、exit 0 |
| `tests/uat-51-import-limits.js` | `:893-897` | **恒真断言**：pass 条件为 `overBranch === 'content-length-fast-path' \|\| overBranch === 'bounded-accumulation'`，而 `overBranch` 恰由 `:881` 的三元表达式赋值 ⇒ **不可能失败**。其"分支标签"本身也由被标签的读数派生（`:881` 用 `overRssDelta < 8 MiB` 反推分支）⇒ 循环且不独立 | ℹ️ **Info** | 19 条断言中有 1 条零信息量 ⇒ `19/19` 应读作「18 条判别性 + 1 条信息性」。**不构成 gap、不构成 blocker**：该文件不在任何 must-have 真值链上，且该恒真形态在 `7eda2ff` **之前就存在**（旧版同样如此），本次改动未新增。建议后续把该 `check` 降为纯 `log`（与 B 侧读数同款处置），以免继续以「断言」计 |
| `tests/uat-51-import-limits.js` | `:50` | **陈旧注释与文件自身新口径矛盾**：仍写「真正承重的是上面 ③ 的确定性源码判据**与 A/B 两侧的 RSS 判据**」—— 而 `:29-38` 已明确 B 侧 RSS 只登记不断言、A/B 两侧对照已在 `7eda2ff` 删除 | ℹ️ **Info** | 文档/代码漂移（`7eda2ff` 未同步该段）。**非债务标记**（文件内 `TBD`/`FIXME`/`XXX` 零命中 ⇒ 债务标记门禁未触发），不影响任何判据与 must-have。建议下一轮同步为「确定性源码判据 + A 侧正命题」 |
| `tests/uat-51-import-limits.js` | `:652` | 同上性质的残留：`heapCalibration.note` 仍写「改用『确定性源码判据 + **主进程 RSS 两侧判据**』」 | ℹ️ **Info** | 该串会成为证据 JSON 的字段值，读者可能据此以为存在两侧 RSS 判据。同属文档漂移，非 blocker |
| 全部 phase-51 文件 | — | `TBD` / `FIXME` / `XXX` 无引用的遗留标记 | — | **无。**本轮对**变更文件** `tests/uat-51-import-limits.js` 独立扫描 ⇒ **零命中**；其余承重文件上轮已扫，本轮零改动。**债务标记门禁未触发** |
| `src/settings-page.js` | 5734 / 6041 / 6036 | `innerHTML` / `insertAdjacentHTML` / `aria-disabled` | ℹ️ Info | 独立复算：region 内剥注释后各 0 处（命中均在注释内）。与「region 内零 HTML 字符串模板」一致 |
| 全阶段 | — | 空实现 / `return null` 占位 / 硬编码空 props | — | **无。**Data-Flow Trace 五项全部 FLOWING |

### Known Recorded Tech Debt (already logged — not re-counted as new failures)

`51-REVIEW.md`（2026-09-15，`status: issues_found`：2 critical + 3 warning + 6 info；**CR-02 已于上轮修复并运行期证实**）的余下发现经上一轮独立复核**仍然存在**，且已按项目「阶段收尾以 UAT 为准；代码审查 Critical 记入 REVIEW.md 作技术债」的既定裁决挂账。verifier **不**将其计为本轮新的失败项（无 must-have truth 因此失败），本轮因**相关文件零改动**未逐条重开取证：

| ID | 复核结论 | 独立证据（行号） |
| -- | -------- | ---------------- |
| CR-01 | **仍存在**（`src/settings-page.js` 本轮零改动） | `:6844` 仍直接覆写 `skillImportTarget.importId` 而不先 `discardSkillImportHandle(prevId)`；`catch` 分支走 `resetSkillImportSurfaces()` 同样不归还 ⇒ 同一弹框会话内第 4 次连续预览 100% 返回 `too_many_pending`，UI 无自救入口。归还在 `:5978`（关闭弹框）与 `:6394`（`closeSkillImportModal`）存在，但覆盖不到「以新预览覆写旧句柄」这条真实链路。**建议作为最高优先补丁项** —— 虽不落在任何 must-have truth 上 |
| CR-02 | **已修复并运行期证实** | `ai-manager.js:1848` 绑定；`-live.js` 由 12/21 转 **29/29** |
| WR-01 | 仍存在 | `ai-skills-manager.js:4556` `await refreshSkills(env, { rootDirs: [...] })` 未透传 `disabled`；回滚分支不复扫 ⇒ 共享缓存可被静默污染 |
| WR-02 | 仍存在 | `docs/product/ai-skills.md:737` 压缩比行仍写「解压总量 ÷ 压缩包体积」，实现为**逐条目**口径 |
| WR-03 | 仍存在 | `ai-skills-manager.js:1573 scanSkillText()` 仍只调 `scanInjectionPatterns()`、从不引用 `SKILL_THREAT_PATTERNS` ⇒ 注释与 §11.5 声称的「`manage_skill` 自动获得技能域模式」在实现中不存在 |
| IN-01 – IN-06 | 未逐条复核（info 级） | IN-02（`SKILL_IMPORT_STATE.SUCCESS` 为名义态）与 IN-04（`deriveImportName` 透传 `MANAGE_SKILL_ERROR.INVALID_NAME`）在代码中仍可见 |

`WINDOWS.md` 中 pending 的 phase-51 条目（计划自带门禁缺陷与实施偏离）保持如实登记，verifier 未重复计数。

### Advisory (New Scope, Unevidenced)

本轮为 re-verification，故按门禁要求列出该节。两条均为**非阻塞的过程/环境观察**，无一构成缺陷主张：

| # | Finding | Category | Why Advisory |
| - | ------- | -------- | ------------- |
| 1 | 与本轮驱动**共用同一份 `realm-dev` userData** 的 dev 实例（PID **58412**）仍在运行，且与上一轮 Advisory #5 记录的是**同一个 PID**（启动于 `20:08:32`，早于两轮取证时段） | repro-environment | 未按本仓纪律处置（清理只按自身 PID、不按路径模式 pkill）。**不影响本轮任何结论**：B 侧已无断言；剩余 RSS 读数取自驱动自身主进程（进程隔离）。已实测登记，供复跑者参考（跑依赖「组件列表 19 → 20」基线的 `-live.js` 前先确认无其它 realm-dev 实例） |
| 2 | 指纹噪声的结构性来源：`AGENTS.md` 这类**仓库级共享文件**在被纳入 `covered_files` 后，任何无关工作流的文档改动都会使本阶段指纹失效（上一轮实证 3 处失效中 2 处即来自并发 webview 工作流） | cross-workstream-staleness | 流程改进建议，无可复现缺陷、无测试可红 ⇒ 不构成 blocker。可选减噪方向：把仓库级共享文件从 covered_files 分离 |

## Human Verification Required

**无。**

逐条说明上一轮那一条人工项为何**已闭合**、以及本轮为何**未发现新的**必须人工项：

1. **上一轮唯一人工项（B 侧 RSS 阈值）已按 verifier 自己给出的第二个选项闭合** —— 阈值断言经 diff 与穷举引用确认**真的删除**，「只登记不断言」成立；「不无上限读入内存」有了确定性承重面（`readRawBody` 源码契约三件套 + 三条单点变异自证，后者逐条精确转红 ⇒ 判据非恒绿）；A 侧「RSS 增量 > 16 MiB」正命题保留且稳健（本轮两次读到 83.8 / 84.9 MB，阈值 16 MiB，余量 5 倍以上）⇒ 不是空跑。该检查点在 `51-UAT.md` Test 3 与 `51-VALIDATION.md` Manual-Only 表中已如实回填，含「早先 21/21 是单次采样」这一事实。
2. **无新的必须人工项。** 该驱动不在任何 must-have 真值链上（四条独立判据见上文），改动不可能使任何 truth 失据；本轮**改动面之外的承重文件零改动**（git 已证），故「29 条 truth 的支撑物逐字未变」是**可复算的事实**而非信任。剩余观察（恒真断言 1 条、两处陈旧注释）均落在**非承重文件**上，属 ℹ️ Info 级过程记录，不需要人类判读即可认定其不影响阶段目标。
3. **诚实边界未变、仍需读者知道**（这些不是人工验证项，但不得被读成「已完全自动化」）：
   - **403 / 429 未真实触发 GitHub 侧限流。** 导入链路只打 `codeload.github.com`，不打 `api.github.com`；60 req/h 未鉴权配额打在 `api.github.com`，两者**不是同一配额域**。故 403 / 429 用 `net.fetch` 单点替身返回**真实形状**响应头（`x-ratelimit-remaining: 0` / `retry-after: 42`），其余全走真链路，证据标 `substituted: true`；**真实 404 走的是真链路**。
   - **guest JS 堆曲线只登记不断言**；本轮进一步实证**主进程 RSS 亦不可断言**（同一个「快路径」标签下两次读数 147 KB vs 5.19 MB，相差 35 倍）⇒ 「无 `arrayBuffer()` 峰值」由确定性源码判据单独承重，且该判据可被变异精确打红。

## Gaps Summary

**无 must-have gaps，且无必须人工验证项 ⇒ `status: passed`。**

逐层判决（Step 9 决策树，按最严格优先）：

1. **FAILED truth / MISSING·STUB artifact / NOT_WIRED key link / blocker anti-pattern** —— **无一命中**。29 条 must-have truth 全部 VERIFIED 且支撑物本轮逐字未变；8 条行为依赖型 truth 各有**真跑**的行为测试；债务标记门禁零命中（变更文件零 `TBD`/`FIXME`/`XXX`）。上一轮唯一 anti-pattern（`B（强判据）` 分支相关红灯）**已消除**。
2. **人类验证项** —— **零命中**。上一轮唯一人工项已按处置选项 2 闭合，本轮复核其在代码层真实落地；本轮未发现新的必须人工项。
3. ⇒ **`status: passed`**（29/29，`behavior_unverified: 0`，`human_verification` 空）。

逐项判决依据（可复算）：`git diff --stat 823b74c 7eda2ff -- <35 covered 文件>` ⇒ 仅 `tests/uat-51-import-limits.js`（+36/−19）；`git log 7eda2ff..HEAD` ⇒ 空；该文件在七个 PLAN 中零声明、在 29 条 truth 的 Evidence 列零出现、其想承重的「上传体超限 ⇒ 413」由 `test-skills-http-api.js`（41/41，含两分支 + 反向对照）独立承载、ROADMAP 五条 SC 无该量。

### 关于 CR-01 的边界说明（沿用上轮口径，供决策）

CR-01 仍是本阶段唯一被独立复现的**用户可见缺陷**（`src/settings-page.js:6844`，重复预览后无法自救济），但它不落在任何 must-have truth 上（51-04 的句柄 truth 只要求三态「明确码 + 可读原因」，该条成立），且已记入 `51-REVIEW.md` 作技术债 ⇒ verifier 不将其计为 gap。若维护者认为「重复预览后无法自救济」应视为目标未达成，可将 CR-01 提升为 gap 并走 `/gsd-plan-phase 51 --gaps`。

---

_Verified: 2026-09-15T12:58:41Z_
_Verifier: Claude (gsd-verifier)_

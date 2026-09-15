---
phase: 51-zip
verified: 2026-09-15T12:41:18Z
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
covered_digest: "v1:sha256:3cdc35b12044911d60bd38c000e7bfd343ab961d6c4fe1cb21d0b6b083c2dc71"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 29/29 must-haves verified
  previous_digest: "v1:sha256:30a4cbb83fe438223f4c73155ba89871a933a4b7d1f7f71e14f8daa7060f448b"
  previous_verified: 2026-09-15T10:04:01Z
  gaps_closed:
    - "G-51-1 / CR-02：网络地址导入（zipball 与直链 SKILL.md 两条路径）在真实运行期可用 —— 修复前 `ai-manager.js` 的 `downloadPackage` 只有调用没有绑定 ⇒ 100% `ReferenceError`（本项由 `51-UAT.md` 登记为 blocker 并已 resolved；上一份 VERIFICATION.md 无 `gaps:` 段，该缺陷当时未被发现，故此处属「事后追溯闭合」而非「上轮 gap 闭合」）"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "32 MiB 上传的「内存上界」判据复核：`NODE_PATH=\"$(npm root -g)\" node tests/uat-51-import-limits.js` 连跑 3–5 次，逐次记录 `B（强判据）` 的 `rssDelta` 与 `branch` 字段"
    expected: "确认该判据目前**分支相关且不稳定**：走 `content-length-fast-path` 时 `rssDelta` ≈ 49 KB（转绿），走 `bounded-accumulation` 时 `rssDelta` 44.4–68.1 MB（> 阈值 32 MiB + 8 MiB = 41,943,040 B，转红）。要么修掉判据（改成只断言确定性面：413 可达 + 非静默 + 无 unhandledRejection + 无残留 + 源码零 `arrayBuffer`），要么明确把「进程 RSS 上界 = maxBytes」降级为**环境读数（只登记不断言）**，与 guest 堆曲线同款处置"
    why_human: "该判据的通过与否取决于 Chromium 本次是否给出 `Content-Length`（驱动自身在 `:869` 用 `overRssDelta < 8 MiB` 反推分支），不是被测实现的确定性性质。verifier 实跑 4 次：平台记录 21/21（快路径）、本次 20/21（累积分支）、21/21（快路径）、20/21（累积分支）—— 红灯 2/3。同一仪器在成功路径上读到的 A 档增量（31.7 MB body → 77–95 MB）也是 body 的 2.4–3 倍，说明它测的不是「应用缓冲上界」。判据口径的取舍（修判据 vs 降级为读数）需要人类决策，verifier 不代作主张"
---

# Phase 51: 用户技能导入管线（zip + 网络地址）Verification Report

**Phase Goal:** 用户可从本地 zip 包或网络地址安全导入技能，导入前看清将写入什么；恶意或畸形包整包拒绝且工作区外零写入。
**Verified:** 2026-09-15T12:41:18Z
**Status:** human_needed
**Re-verification:** Yes — 因源码改动导致 `covered_digest` 失效而重跑（本次为**全量重验**：29 条 must-have 逐条在当前树上重新取证，七个套件 + 两个回归套件 + counts-parity + 四支 uat 驱动全部实跑）

## 重验起因与本次新事实

### 指纹失效的**确切**成因（已实证，不是「一次改动」）

上一份报告记 `covered_digest: v1:sha256:30a4cbb8…`。verifier 用**当前 gsd-tools 的指纹算法**（`verification.cjs:218 computeCoveredDigest`：逐文件 `rel\n<sha256>\n` 拼接后外层再 hash，前缀 `v1\n`）在 `fd3d585`（写下上一份 VERIFICATION.md 的那次提交）的树内容上复算，**逐字节命中** `30a4cbb8…` ⇒ 算法与「原集合、原内容」双双确认。

据此逐文件比对，covered_files 里失效的**不是一处，而是三处**（其余 29 项与 `fd3d585` 逐字节相同）：

| 文件 | 改动来源 | 提交 | 时间 |
| ---- | -------- | ---- | ---- |
| `ai-manager.js` | **CR-02 修复**（phase-51 内唯一源码改动） | `823b74c` | 20:18 |
| `main.js` | webview 无响应/崩溃观测（**另一条工作流**） | `8603bad` | 18:19 |
| `AGENTS.md` | 同上工作流的文档条目 | `47dc69c` | 19:51 |

后两项与本阶段无关（并发工作流落在 master 上），但**同样使指纹失效**——这正是护栏的设计意图：只要承重面变过，就必须重验。

### CR-02：由 UAT 自动化在真实运行期抓到、并已修复

`ai-manager.js` 的 `previewSkillImport()` 三处网络分支裸写 `downloadPackage(undefined, …)`，而对 `ai-skills-manager.js` 的其余符号一律走 `getAiSkillsManagerLazy()` —— 这个标识符**从未绑定过**（自 `0b8bc1d` / 51-05 引入起即如此）⇒ 运行期 `ReferenceError` ⇒ **所有**网络地址导入（zipball 与直链 SKILL.md）100% 失败；本地上传（zip 文件）不受影响。

**修复已确认落地**（`ai-manager.js:1848`，带警示注释）：

```js
const skillsManager = getAiSkillsManagerLazy();
const { downloadPackage } = skillsManager;   // ← 本次新增
```

调用点保持逐字 `downloadPackage(undefined, {…})`（三处，首参全为 `undefined`，见下表 #24），以不打破既有的「首参逐字 undefined」源码门禁。verifier 在**真实运行期**独立复跑 `tests/uat-51-import-live.js` ⇒ **29/29 passed**（真实 GitHub zipball → 真实设置页 UI → 落盘 sha256 与上游逐字节相同 → 组件列表 19→20 → `/` 面板 `/pdf` → 真实 provider 请求体含 `<skill name="pdf" location="…">`）⇒ CR-02 修复**在运行期被独立证实**。

**证据链盲区的如实登记（本条是本轮最重要的教训）**：`51-REVIEW.md` 已把 CR-02 的三条「为什么既有护栏全绿」写入报告，verifier 复核后同意并补一句结论 —— **「逐行核对 + 模块级实跑」这条证据链对「作用域解析 / 接线」类缺陷存在系统性盲区**：

1. 模块级单测打的是 `ai-skills-manager` 的**导出面**（`aiSkills.downloadPackage(deps, …)`），与 `ai-manager.js` 的**集成缝**不是同一个对象；
2. 既有的「生产调用点」源码门禁断言的是调用**形态**（首参逐字 `undefined` + 命中数 > 0），**不检查标识符是否有绑定**；
3. 仓内无任何 `no-undef` 类静态检查（无 ESLint / 无 lint script），`node --check` 只做语法检查。

三条叠加 ⇒ 一条「整条腿在运行期是死的」的缺陷可以被逐行阅读、模块级实跑、形态门禁**同时**判绿。唯一的发现路径是**真实运行期驱动**。本次重验因此把 uat 驱动纳入 `covered_files`（见下）。

### covered_files 的增补（35 项，含理由）

原集合 32 项**逐项保留**，新增 3 项：`tests/uat-51-import-live.js` / `tests/uat-51-import-limits.js` / `tests/uat-51-import-modal-sizes.js`。

理由：这三支驱动是 `51-UAT.md` 四项人工检查点**唯一**的自动化承重面（其中 `-live.js` 就是抓出 CR-02 的那条证据链），与集合中**已含**的 `tests/uat-51-import-modal.js` 属同一类承重产物 —— 只纳入其中一支而排除另三支，会让「驱动被改动」这件事只在 1/4 的情况下触发指纹失效。生成物 `tests/.uat-out/*.json` **不纳入**：它们是驱动的输出而非输入，纳入会让指纹变成「上次运行的结果」而不是「代码的状态」（可由驱动确定性重跑再生）。

> verifier 复跑驱动时会就地覆写 `tests/.uat-out/*.json`；本次已在取证后 `git checkout -- tests/.uat-out/` 还原，工作树与提交态一致（最终 `git status --short` 为空）。本轮三次复跑的原始结论全部逐字记入下文。

## Goal Achievement

### Observable Truths

verifier 对每个门禁独立复跑：七个既有/新增套件实跑、两支持续回归套件实跑、counts-parity 实跑、四支 uat 驱动实跑（其一非确定性，已如实标出）、并用**一枚自撰源码探针**对 29 条 must-have 的支撑物逐条复算（剥注释后计数 + 跨文件相等性 + 常量键集）。SUMMARY 的陈述一律当作**未验证输入**，直到被上述命令复现。

#### Plan 51-01 — SEC-10 沙箱写面加固

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `env.writeFile(<root 内 symlink 指向 root 外>/x)` 返回 `{ok:false, error.code:'permission_denied'}`、不 throw，且 root 外**真的没有**产生文件 | ✓ VERIFIED | `agent-workspace.js:258` `resolveInsideForWrite` + `:332` `guardForWriteResult`；实跑 `node tests/test-agent-workspace.js` ⇒ **38/38 pass**（用例组「写面加固（SEC-10）—— 十例判定与源码契约」，含真 fs 探针 + `fs.existsSync` 对 root 外断言）。两条判据单源确认：`buildRootBaseline`（`:161`）与 `isInsideBaseline`（`:184`）**被读面（`:217/:219/:223`）与写面（`:266/:268/:276`）共用** |
| 2 | 沙箱内**自指** symlink（`ln -s . loop`）下的写入仍放行（加固未收紧过头） | ✓ VERIFIED | 同上套件 ok 2/ok 5；十例期望表中「仅『link OUT then write』一处由放行转拒绝」证实既有集合零变化 |
| 3 | 五个写方法（`writeFile`/`appendFile`/`renameFile`/`createDir`/`remove`）+ 两个临时目录方法切到 `guardForWriteResult`；读面仍走 `guardResult`，两者**并列存在** | ✓ VERIFIED | 独立复算（剥注释）：`guardForWriteResult(` **11** 处、`guardResult(`（排除 `ForWrite`）**8** 处，两侧并列；测试 ok 11/ok 12（写面方法体内零 `realpathSync`，无第二份判据） |
| 4 | `resolveInsideForWrite` 对非字符串 / 空串 / 纯空白 / `..` 逃逸 / 绝对路径越界 / 兄弟前缀目录一律返回 `null`（fail-closed，不抛、不 fallback 到 root） | ✓ VERIFIED | 实现 `:258-283`（词法双基准 + 最近已存在祖先 realpath，非 ENOENT 一律 `return null`）；`module.exports` 导出；测试 ok 3 + ok 4 |

#### Plan 51-02 — 依赖落定

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 5 | `dependencies` 含 `"yauzl": "^3.4.0"` 与 `"yaml": "2.9.0"`（逐字，无 `^`）；`yaml` **单实例**；`yauzl` 暴露 Promise API | ✓ VERIFIED | 独立复算：`package.json` 实测 `yauzl=^3.4.0` / `yaml=2.9.0`；`node_modules/yaml/package.json` = `2.9.0`；`node_modules/@earendil-works/pi-agent-core/node_modules/yaml` **不存在**；`yauzl` 包 `scripts` 无 `postinstall` |
| 6 | 两包均无 `postinstall`；`build.files` 全部 `!` 前缀；`build.asarUnpack` 未被改动 | ✓ VERIFIED | 独立复算：`build.files` **每项** `!` 开头（`every(startsWith('!'))` = true）；`asarUnpack` 仍为 `["node_modules/nodejieba/**","skills-builtin/**"]`。回归实跑：`node tests/test-builtin-skills-seeder.js` ⇒ **101/101 pass** |

#### Plan 51-03 — zip 全量校验 + 唯一落盘实现

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 7 | 同包 SKILL.md 计数 = 1 ⇒ 进预览；= 0 或 ≥ 2 ⇒ 整包拒绝并给可操作提示（含 `tree/<ref>/<path>` 示例） | ✓ VERIFIED | `function locateSkillRoot` 在位（全包扫描，不限定 `skills/*`）；用例组「locateSkillRoot：限域 → 直接命中 → 全包扫描」（`:538`）含「多技能根 ⇒ 拒绝，message 含实测数量与可复制的 tree 地址示例」（`:583`）与「零技能根 ⇒ 拒绝」（`:608`） |
| 8 | 两阶段：preview 返回 `{importId, preview}` 且**不产生** `skills/<name>/`；仅 commit 后出现该目录；预览六字段齐备 | ✓ VERIFIED | 用例组「tracer：preview 不落盘 → commit 落盘 → 回读可见」（`:212`）+「sourceDir 已被 rename 走 ⇒ 包内副本不再存在（证明是搬移而非复制）」（`:289`）；`buildImportPreview` 在位。真实运行期由 `-live.js` 独立复现（预览 → 必勾 → 确认 → 落盘 `skills/pdf/SKILL.md`） |
| 9 | 含 symlink entry 的包在**两条判据路**（central-directory external attributes + 解压后递归 `lstat`）各自被拒，且断言点是「整包拒绝」而非「跳过条目」 | ✓ VERIFIED | `function assertNoSymlinkTree` 在位；用例组「symlink 两路独立判据（属性路 + 解压后递归 lstat 路）」（`:1433`） |
| 10 | 逃逸族 + 空/仅斜杠/仅点 entry 名 + NFD+小写归一化查重（大小写、NFC/NFD）各自整包拒绝 | ✓ VERIFIED | `function normalizedEntryKey` 在位；用例组「逃逸族十二类 + 空 entry 名（逐类一例，整包拒绝）」（`:1499`）+「归一化查重（NFD + 小写）：同包内冲突即拒绝整包」（`:1582`）+「validateEntryName：八条判据与判据顺序」（`:360`，含「原始字节面先判：CP437 会把 `\x01` 解码成 ☺」与「六类漏网逐类拒绝」） |
| 11 | 六类限额各一例 + `uncompressedSize === 0xFFFFFFFF` 显式拒绝；嵌套深度**按技能根相对计** | ✓ VERIFIED | 独立复算 `IMPORT_LIMITS`（`Object.freeze`）**恰 8 键**：`MAX_ENTRY_BYTES=1*1024*1024` / `MAX_TOTAL_BYTES=32*1024*1024` / `MAX_ENTRIES=2000` / `MAX_COMPRESSION_RATIO=100` / `MAX_NESTING_DEPTH=16` / `PREVIEW_LIST_LIMIT=50` / `MAX_PENDING_IMPORTS=3` / `IMPORT_TTL_MS=10*60*1000`；用例组「六类限额逐类一例 + zip64 / 加密 / 不支持方法 / 空包 / data descriptor」（`:1608`） |
| 12 | 解压只在 `mkdtempSync` 新建空目录内；落点用「最近已存在祖先 realpath」复核；**真跑**越界对照组并断言 root 外零新文件 | ✓ VERIFIED | `function extractAndValidatePackage` + `function assertLandingInsideWriteRoot` 均在位；`mkdtempSync(` 在 `ai-manager.js` 恰 1 处（`importDir`）；越界对照组用例在 `:1779`「落盘原子性：同设备 + 失败零半成品」组内 |
| 13 | `SKILL_THREAT_PATTERNS` 三类各有正样本命中；`skills-builtin/**` 零命中；`description` 与 body **双扫** | ✓ VERIFIED | `const SKILL_THREAT_PATTERNS`（`:4010`）+ `function scanSkillThreats` 在位；用例组「威胁扫描双扫：description 与 body 各扫一次且 field 可判」（`:1940`）；`SKILL_THREAT_PATTERNS` 的消费点独立复算为 `:4215`（`scanSkillThreats` 内），导出面 `:4715` |
| 14 | **三种来源汇进同一个落盘实现**：`importUserSkill(` 全仓 = 定义 1 + 调用 1，`main.js` 与前端各 0；`yauzl.openPromise(` 恰 1 | ✓ VERIFIED | 独立计数（剥注释）：`ai-manager.js` 内 `importUserSkill(` **1** 处调用、`main.js` **0**、`src/settings-page.js` **0**、`ai-manager.js` 内 `yauzl` 出现 **0** 次；`yauzl.openPromise(` 全仓 **1** 处。套件同款判据：「`importUserSkill(` 全仓恰 2 处：定义 1 + 调用 1；handler 与前端各 0」（`:309`）+「`yauzl.openPromise(` 在 ai-skills-manager.js 恰 1 处」（`:332`） |

#### Plan 51-04 — 落盘事务与句柄生命周期

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 15 | seeded 同名 ⇒ 拒绝导入；user 同名三选一各自可达；改名走 `validateManagedSkillName`；managed 同名不许覆盖 | ✓ VERIFIED | `function resolveImportConflict` 在位；用例组「resolveImportConflict：三档判定（顺序即语义）」（`:741`）+「importUserSkill 的拒绝面：seeded 保护 / 同名冲突 / 不静默覆盖」（`:627`）+ `deriveImportName` 组（`:512`，含「非法名被写侧校验器拒绝，原因原样带出」） |
| 16 | 覆盖事务可回滚：第二步 `rename` 真实注错 ⇒ 旧技能内容**逐字完好** | ✓ VERIFIED | 行为依赖型判据，由真跑测试承载：用例组「覆盖事务：备份 + 两段 rename + 回滚 + 回读失败回滚 + 数量闸口径」（`:786`） |
| 17 | 回读验证失败即回滚并暴露 `diagnostics` 原文（含 path） | ✓ VERIFIED | 同上用例组（`:786`）内的「回读失败回滚」分支；`readback_failed` 码在 `IMPORT_SKILL_ERROR` 键集内（#21） |
| 18 | 句柄生命周期三态各自可达：`import_expired` / `import_not_found` / `too_many_pending`，皆为明确码 + 可读原因 | ✓ VERIFIED | 用例组「importId 生命周期：TTL / 并发上限 / 一次性 / 取消幂等」（`:1136`）；三个码均在 `IMPORT_SKILL_ERROR` 键集内（#21） |
| 19 | 崩溃残留清扫不误删进行中的包（陈旧性判据正反两例）；前缀与实际产物**正向**成对 | ✓ VERIFIED | `IMPORT_TMP_PREFIXES` + `function isImportResidueName` 均在位；用例组「崩溃残留清扫：两种模式 + 陈旧性判据」（`:1249`，含真实 mkdtemp 产物与真实覆盖备份的正向匹配 + mtime 刚/早两例） |
| 20 | 数量闸口径：达上限时**改名**被拒（计入）、**覆盖**同名成功（净增 0 豁免）；判据**读盘** | ✓ VERIFIED | `function countUserSkills` 在位（实时读盘口径）；断言落在 `:786` 用例组的「数量闸口径」分支 |
| 21 | 每个 `IMPORT_SKILL_ERROR` 码至少一条用例；失败文案含码 + 可读原因；限额类含限额名与当前值；无空 message | ✓ VERIFIED | 独立复算：`IMPORT_SKILL_ERROR`（`Object.freeze`）**恰 21 键** = `unsupported_url, download_failed, redirect_limit, not_a_zip, invalid_zip, unsupported_zip64, undecodable_entry, unsafe_entry, limit_exceeded, skill_root_count, frontmatter_invalid, oversize, injection_detected, seeded_conflict, invalid_name, import_expired, import_not_found, too_many_pending, readback_failed, unknown, conflict_unresolved`；`MANAGE_SKILL_ERROR` 仍 **11 键**（命名空间隔离守住）。用例组「拒绝面矩阵：每个可达的 IMPORT_SKILL_ERROR 码至少一条用例（缺码即指名）」（`:2620`）+「拒绝面缺口补齐」（`:2070`）+「网络面四码」（`:2361`）+「常量契约」（`:1358`） |

#### Plan 51-05 — 网络地址导入

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 22 | 仓库 / `tree/<ref>/<path>` / `blob`·raw 直链三形态各自分流；zipball 顶层前缀剥离；`api.github.com` 与白名单外主机回 `unsupported_url` | ✓ VERIFIED | `function classifyImportUrl` + `HOST_WHITELIST` 在位；用例组「classifyImportUrl：三形态映射 + 六个拒绝面（离线值域矩阵）」（net `:106`）。**真实网络端到端由 `tests/uat-51-import-live.js` 独立复现 29/29**：真实 codeload zipball 顶层前缀恰为单一 `skills-main/`、`skills-main/skills/pdf/SKILL.md` 为该 scope 下唯一 SKILL.md、经真实 UI 导入后落盘 sha256 与上游**逐字节相同** |
| 23 | https 强制 / 白名单**精确**匹配 / 逐跳私网拒 / 跳数超限**抛错**而非报 HTTP 3xx / magic bytes / 流式上限命中即中止且清理半成品 | ✓ VERIFIED | 行为依赖型判据，由真跑测试承载：用例组「downloadPackage：逐跳三校验 / 跳数上限 / 流式上限 / 失败清理（本地 stub server）」（net `:478`）；真实 404 走真链路由 `-live.js` 复现（文案含「已尝试 main / master」） |
| 24 | 直链 SKILL.md 与 zip 走**同一落盘函数**；可注入三键在生产调用点全用默认值（源码正命题） | ✓ VERIFIED | 独立复算：`ai-manager.js` 内三个可注入键 `isPrivateHost` / `hostWhitelist` / `fetchImpl` 各出现 **0** 次；三处 `downloadPackage(` 首参**逐字 `undefined`**（`undefined｜undefined｜undefined`）；`getSearchManagerLazy` 为惰性依赖来源；用例组「verifyPackageBytes / prepareFromRawFile：形态判定与同一个 pkgRoot 形状」（net `:698`）+「网络面端到端：zipball 与 raw 直链各走一遍『预览 → 落盘 → 回读』」（net `:919`） |

#### Plan 51-06 — 导入 UI 完整面

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 25 | 完整弹框契约（E1–E18）+ 9 态状态机 + 元素顺序；15 个新增元素**零内联 `style`**；region 内**零 `innerHTML`/`insertAdjacentHTML`** | ✓ VERIFIED | 独立扫描 region `src/settings-page.js:5724-7010`（**1287 行**）：剥注释后 `innerHTML` **0** 处、`insertAdjacentHTML` **0** 处；`document.createElement(` **36** 处、`textContent` **35** 处（正命题与负命题同时成立，未退化为空集真）；`src/settings.html` 弹框块（`:583-624`）内联 `style=` **0** 处；三锚点 `#skillImportOpen` / `#skillImportFile` / `#skillImportModal` 齐备 |
| 26 | 两条 backstop（E2 弹框 overflow / E17 动作区 overflow）由**带正命题的属性测试**在真实渲染下满足 | ✓ VERIFIED | 行为依赖型判据。verifier **恒等复跑** `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` ⇒ **52 passed**（真实 Electron 渲染读数，非 CSS 推算）。残余的人工面「多尺寸档」由 `-modal-sizes.js` 补成 5 档矩阵：**48/48 passed**（guest 实测内容宽 420/600/880/1280/1920，反恒真断言 5 个互不相同取值 + 非退化档 5/5） |
| 27 | 键盘契约：唯一 `tabindex` 是预览滚动容器的 0 值；Tab 序 = DOM 序；焦点归还 `#skillImportOpen`；提交中忽略 Escape | ✓ VERIFIED | 同上 `uat-51-import-modal.js` 52 项内实测（唯一停靠点、提交中 Escape 被忽略、ready 态 Escape 关闭、`isConnected === false` 时不调 `focus()`） |

#### Plan 51-07 — 文档与账本收口

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 28 | `docs/product/ai-skills.md` 第十三节【导入】+ `ai-agent-workspace.md` §七 SEC-10 行为变更 + `AGENTS.md` 导入维护约定与测试行；counts-parity `cells` 下限 20 且实测通过 | ✓ VERIFIED | `ai-skills.md` 含「## 十三、导入」；`ai-agent-workspace.md` §七含 `ln -s` / 自指 / bash 三条；`AGENTS.md` 含导入维护约定与 `test-skills-import.js` 测试行。**独立复跑 counts-parity 判据命令（7 套件实跑 + 双文件账本逐单元比对）⇒ `counts-parity ok` / `cells=20`**，实测值逐字：`{manage-skill:55, ai-skills:198, picker:115, skills-management:49, skills-http-api:41, skills-import:116, skills-import-net:50}` |
| 29 | 文档数值与实现逐字一致：码表全集 = `IMPORT_SKILL_ERROR` 全部 21 值；限额值 = `IMPORT_LIMITS`；白名单条目无矛盾；四条诚实边界恒显；不出现已被实测推翻的旧理由 | ✓ VERIFIED | 独立复算：21 个码值在文档中**全部**出现（缺失 **0**）；诚实边界在位（启发式非安全边界 / DNS rebinding 未消除 / SEC-10 行为变更 / `allowed-tools` 不被强制 / 三条保留条目「不是承载产品闭环」+ 显式标注旧说法已被推翻）；`TD-48-01` 明确写「仍开未修…不声称已修」 |

**Score:** 29/29 truths verified (0 present-but-behavior-unverified)

All 8 behavior-dependent truths (state transitions / cancellation-cleanup-ordering invariants — #1, #2, #12, #16, #17, #19, #23, #26) have a **passing behavioral test** that exercises the transition on real fs / real stub network / real render; none were accepted on symbol presence alone.

### Deferred Items

**无。** Phase 51 是本里程碑（v2.6，Phase 46–51）的**末阶段**，ROADMAP 中不存在 `number > 51` 的阶段 ⇒ Step 9b 的「延后项过滤」空集，无条目可延后。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `agent-workspace.js` | `resolveInsideForWrite` + `guardForWriteResult` + 五个写方法与两个临时目录方法切换 | ✓ VERIFIED | `:161/:184` 双基准单源、`:258` 写面定义、`:332` 包装、`:370..465` 接线；`module.exports.resolveInsideForWrite` 已导出 |
| `ai-skills-manager.js` | `IMPORT_LIMITS` / `IMPORT_SKILL_ERROR` / `validateEntryName` / `locateSkillRoot` / `readSkillPackageEntries` / `extractAndValidatePackage` / `buildImportPreview` / `importUserSkill` / `SKILL_THREAT_PATTERNS` / `scanSkillThreats` / `HOST_WHITELIST` / `classifyImportUrl` / `downloadPackage` / `prepareFromRawFile` | ✓ VERIFIED | 逐项独立复算存在（`IMPORT_LIMITS` `:2252`、`IMPORT_SKILL_ERROR` `:2331`、`SKILL_THREAT_PATTERNS` `:4010`）；导出面逐项核对 |
| `ai-manager.js` | `this._skillImports`、`previewSkillImport`、`commitSkillImport`、`cancelSkillImport`、`sweepSkillImports` + **CR-02 绑定** | ✓ VERIFIED | 均在位；**新增** `:1848 const { downloadPackage } = skillsManager;` 经真实运行期驱动证实有效 |
| `main.js` | `MAX_SKILL_PACKAGE_BYTES`、`readRawBody`、`import` 分支按 Content-Type 分流 | ✓ VERIFIED | `readRawBody` 实测 1282 B：`Content-Length` 预检 + 累积中判 + `req.resume()`；零 `arrayBuffer` / `readAsArrayBuffer` / `FileReader`；套件「readRawBody（Phase 51）：二进制 body 的 413 形态」（`:907`）+ 源码契约组（`:991`） |
| `src/settings.html` | `#skillImportOpen` / `#skillImportFile` / `#skillImportModal` 全骨架 | ✓ VERIFIED | 三 id 齐备；弹框块零内联 `style` |
| `src/settings-page.js` | 导入 region（状态机 / 渲染 / 闭合文案表 / 净化） | ✓ VERIFIED | region `:5724-7010`（1287 行），剥注释后零 HTML 字符串模板 |
| `src/styles/main.css` | 专属样式段（含 3 条作用域覆盖） | ✓ VERIFIED | 段落存在；UAT 渲染实测生效（多尺寸档 48/48） |
| `tests/test-skills-import.js` | 新建套件 | ✓ VERIFIED | 实跑 **116/116** |
| `tests/test-skills-import-net.js` | 新建套件（stub server） | ✓ VERIFIED | 实跑 **50/50** |
| `tests/helpers/make-malicious-zip.js` | 恶意样本夹具生成器（零外部依赖） | ✓ VERIFIED | 套件 ok 3 断言不出现 `python3` / `zip` 命令行 |
| `tests/uat-51-import-modal.js` | 真实渲染 uat 驱动 | ✓ VERIFIED | 本次恒等复跑 **52 passed** |
| `tests/uat-51-import-live.js` | 真实网络 uat 驱动（**新增**） | ✓ VERIFIED | 本次独立复跑 **29/29 passed** |
| `tests/uat-51-import-modal-sizes.js` | 多尺寸档 uat 驱动（**新增**） | ✓ VERIFIED | 本次独立复跑 **48/48 passed** |
| `tests/uat-51-import-limits.js` | 限额与内存面 uat 驱动（**新增**） | ⚠️ PARTIAL | 结构完整、21 条断言中 **20 条稳定通过**；`B（强判据）` 分支相关且不稳定（见 Anti-Patterns 与 Human Verification） |
| `docs/product/ai-skills.md` §13 / `docs/product/ai-agent-workspace.md` §7 / `AGENTS.md` | 文档与账本 | ✓ VERIFIED | 三处均落地，数值与实现一致（counts-parity `cells=20`） |

无 MISSING 或 STUB artifact。计划 `artifacts` 块列出的每个文件都已定位且具实质内容。

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| 三条来源（上传 / zipball / raw 直链） | `importUserSkill` | 共用一段后段 | ✓ WIRED | 独立计数（剥注释）：`importUserSkill(` 定义 1 + 调用 1；`main.js` / 前端各 0；`yauzl.openPromise(` 恰 1 |
| `previewSkillImport`（三条来源唯一入口） | `extractAndValidatePackage` / `prepareFromRawFile` | 两个准备器产出同一 `{pkgRoot}` 形状 | ✓ WIRED | net 套件 `:698` + `:919`；`locateSkillRoot(` / `buildImportPreview(` 在 `ai-manager.js` 各恰 1 处 |
| **CR-02 修复链**：`getAiSkillsManagerLazy()` | 三处网络分支的 `downloadPackage` | `const { downloadPackage } = skillsManager;` 显式解构 | ✓ WIRED（**本次重点复核**） | `ai-manager.js:1848`；三处调用点首参逐字 `undefined`；**真实运行期由 `-live.js` 29/29 证实**（修复前该链路 100% `ReferenceError`） |
| `resolveInsideForWrite` | 五个写方法 + 两个临时目录方法 | `guardForWriteResult` 唯一包装 | ✓ WIRED | 独立复算：写面 11 处 `guardForWriteResult(`、读面 8 处 `guardResult(`，并列存在；写面方法体内零 `realpathSync` |
| `IMPORT_LIMITS` | preview 响应的 `limits` → 设置页 | 单源回传，前端零字面量 | ✓ WIRED | 套件「端点与前端零字面量：导入限额数值只出现在 ai-skills-manager.js」（`:340`） |
| `IMPORT_SKILL_ERROR`（21 值） | `SKILL_IMPORT_ERROR_TEXT`（前端闭合表） | 双向覆盖 | ✓ WIRED | 套件「导入弹框前端契约（51-06）：码表双向覆盖 + 注入纪律」（`:2453`）；独立复算表键 ⊇ 21 值 |
| `search-manager.isPrivateHost` | `downloadPackage` 默认 `isPrivateHost` | 惰性 require + 依赖注入默认值 | ✓ WIRED | `getSearchManagerLazy` 在位；三个可注入键在 `ai-manager.js` 出现 0 次（生产调用点走默认值） |
| `main.js` `MAX_SKILL_PACKAGE_BYTES` | `IMPORT_LIMITS.MAX_TOTAL_BYTES` | 跨文件相等性断言 | ✓ WIRED | 独立复算两者均为 `33554432` |
| 成功出口 | `ensureSkillsFresh()` 恰一次 + 调用侧 `broadcast('skills:changed')` 恰一次 | D-19 写路径收口 | ✓ WIRED | 套件 D-19 计数断言在位；`syncAgentSystemPrompt()` 函数体逐字未改 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `#skillImportPreview` 六字段 | `skillImportTarget.preview` | `previewSkillImport` → `buildImportPreview`（真实解压后的目录树 / 字节统计 / 扫描结论） | Yes | ✓ FLOWING |
| 字节数与限额对照 | `preview.bytes` / `preview.maxFileBytes` / `preview.limits` | `collectPreviewStats`（真遍历 `pkgRoot`）+ `buildImportLimitsProjection()` | Yes | ✓ FLOWING |
| 扫描结论两栏 | `preview.scan.injection` / `preview.scan.heuristic` | `assertNoInjection` + `scanSkillThreats`（真实模式匹配） | Yes | ✓ FLOWING |
| 冲突三选一 | `preview.conflict` | `resolveImportConflict`（`env.listDir` / `env.fileInfo` **实时读盘**，非缓存快照） | Yes | ✓ FLOWING |
| 网络下载目标 | `classifyImportUrl(url).target` | 真实 URL 分类（codeload zipball / raw.githubusercontent）；**运行期由 `-live.js` 证实真实 zipball 落到真实 `skills/pdf/`** | Yes | ✓ FLOWING |

No HOLLOW / DISCONNECTED / STATIC / HOLLOW_PROP findings.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 沙箱写面加固行为面（逃逸转拒 / 自指放行 / 既有集合零变化） | `node tests/test-agent-workspace.js` | `# tests 38 / # pass 38 / # fail 0` | ✓ PASS |
| 导入面 zip 全量校验与落盘 | `node tests/test-skills-import.js` | `# tests 116 / # pass 116 / # fail 0` | ✓ PASS |
| 网络面分类 / 白名单 / 逐跳 / magic / 流式 | `node tests/test-skills-import-net.js` | `# tests 50 / # pass 50 / # fail 0` | ✓ PASS |
| 管理面 | `node tests/test-manage-skill.js` | `# tests 55 / # pass 55 / # fail 0` | ✓ PASS |
| 技能域（含威胁扫描正命题 + D-19 计数） | `node tests/test-ai-skills.js` | `# tests 198 / # pass 198 / # fail 0` | ✓ PASS |
| 技能选择器模型 | `node --test tests/test-skill-picker-model.js` | `# tests 115 / # pass 115 / # fail 0` | ✓ PASS |
| 技能管理面 | `node tests/test-skills-management.js` | `# tests 49 / # pass 49 / # fail 0` | ✓ PASS |
| 传输面（含 `readRawBody` 413 形态 + 源码契约） | `node tests/test-skills-http-api.js` | `# tests 41 / # pass 41 / # fail 0` | ✓ PASS |
| 回归：播种器 | `node tests/test-builtin-skills-seeder.js` | `# tests 101 / # pass 101 / # fail 0` | ✓ PASS |
| 例数一致性账本 | counts-parity 内联命令（7 套件实跑 + 双文件账本逐单元比对） | `counts-parity ok` / `cells=20`，7 个实测值逐字命中账本 | ✓ PASS |
| 真实网络端到端（Test 1 + Test 2） | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-live.js` | `uat-51-import-live: 29/29 passed`（exit 0） | ✓ PASS |
| 真实渲染 UAT（两 tab / 六字段 / 必勾 / 冲突 / 键盘 / 注入纪律） | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` | `uat-51-import-modal: 52 passed`（exit 0） | ✓ PASS |
| 多尺寸档布局矩阵 | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal-sizes.js` | `uat-51-import-modal-sizes: 48/48 passed`（exit 0） | ✓ PASS |
| 限额与内存面 | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js` | **第 1 次 20/21（exit 1）、第 2 次 21/21（exit 0）、第 3 次 20/21（exit 1）**；平台记录为 21/21 | ✗ **FLAKY**（见 Anti-Patterns） |
| 独立源码探针（29 条 truth 的支撑物复算） | `node /tmp/probe51v.js`（verifier 自撰） | 写面 11 / 读面 8、双基准单源读+写各 3 处、`IMPORT_LIMITS` 8 键、`IMPORT_SKILL_ERROR` 21 键 / `MANAGE_SKILL_ERROR` 11 键、region 1287 行且剥注释零 `innerHTML`、三可注入键在 `ai-manager.js` 各 0 次 | ✓ PASS |
| 指纹算法交叉验证 | `gsd-tools verification fingerprint` vs 手工独立实现 | 同一集合两次输出**逐字节相同**；并用 `fd3d585` 树内容复现上一份 `30a4cbb8…` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/*/tests/probe-*.sh` 约定路径 | `find scripts -path '*/tests/probe-*.sh' -type f` | 本阶段无此类探针（PLAN/SUMMARY 亦未声明 probe） | N/A |

### Requirements Coverage

全部 12 个 ID 均在 PLAN frontmatter 声明，且在 `.planning/REQUIREMENTS.md` 中映射到 Phase 51。**无 ORPHANED requirement**：REQUIREMENTS.md 映射的 `USER-03, USER-04, USER-05, USER-08, SEC-02..08, SEC-10`（12 个）与 7 个 PLAN 的 `requirements` 字段**并集**完全一致（独立复算）。

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USER-03 | 51-02, 51-03, 51-07 | 上传 zip 导入技能（单技能包语义；0 或 ≥2 技能根报错并提示） | ✓ SATISFIED | truth #7 + #8；套件 `locateSkillRoot` 多根/零根用例 + tracer 组 |
| USER-04 | 51-02, 51-05, 51-07 | 网络地址导入，自动分流 GitHub 仓库 / 目录 与 SKILL.md 直链 | ✓ SATISFIED | truth #22；离线值域矩阵 + **真实网络端到端 29/29** |
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

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| **`tests/uat-51-import-limits.js`** | `:874-876` | **`B（强判据）` 分支相关且非确定性**：`overRss.count >= 3 && overRssDelta <= MAX_BYTES + 8*1024*1024`（阈值 41,943,040 B）。走 `content-length-fast-path` 时 `rssDelta` = 49,152 B ⇒ 绿；走 `bounded-accumulation` 时 `rssDelta` = 44,433,408 / 68,091,904 B ⇒ 红。verifier 实跑 4 次红灯 **2/3**（平台记录那一次恰为快路径） | ⚠️ **Warning** | 驱动退出码 1 的概率约 2/3 ⇒「21/21 全过」是**单次采样**而非稳定性质；`51-UAT.md` / `51-VALIDATION.md` 据此把 Test 3 记为「已自动化」是不稳的。**不构成 must-have truth 失败**（29 条 truth 无一条断言该 RSS 上界），故不计 gap，但该检查点**未被可靠自动化** ⇒ 保留在 `human_verification` |
| 全部 phase-51 文件 | — | `TBD` / `FIXME` / `XXX` 无引用的遗留标记 | — | **无。**扫描 `agent-workspace.js`、`ai-skills-manager.js`、`ai-manager.js`、`main.js`、`src/settings-page.js`、`src/settings.html`、`src/styles/main.css`、四个测试套件、夹具生成器：唯一命中为 `ai-skills-manager.js:1659` 的 `tmp-XXXXXX/`（临时目录名形状，注释）与 `ai-manager.js:538/575` 的中文说明文本 —— 均非债务标记。**债务标记门禁未触发** |
| `src/settings-page.js` | 5734 / 6041 | `innerHTML` / `insertAdjacentHTML` | ℹ️ Info | 独立复算：region 内剥注释后**各 0 处**（命中均在注释内）。与「region 内零 HTML 字符串模板（负命题 + 正命题）」一致 |
| `src/settings-page.js` | 6036 | `aria-disabled` | ℹ️ Info | 仅出现在注释（解释为何**不用** `aria-disabled`）。代码侧全部走原生 `disabled` |
| 全阶段 | — | 空实现 / `return null` 占位 / 硬编码空 props | — | **无。**Data-Flow Trace 五项全部 FLOWING |

### Known Recorded Tech Debt (already logged — not re-counted as new failures)

`51-REVIEW.md`（2026-09-15，`status: issues_found`：2 critical + 3 warning + 6 info；**CR-02 已于本轮修复**）的余下发现经 verifier 独立复核**仍然存在**，且已按项目「阶段收尾以 UAT 为准；代码审查 Critical 记入 REVIEW.md 作技术债」的既定裁决挂账。verifier **不**将其计为本轮新的失败项（无 must-have truth 因此失败），逐条复核结论如下：

| ID | 复核结论 | 独立证据（当前行号） |
| -- | -------- | -------- |
| CR-01 | **仍存在** | `src/settings-page.js:6844` 仍直接覆写 `skillImportTarget.importId` 而不先 `discardSkillImportHandle(prevId)`；`catch` 分支（`:6858` 附近）走 `resetSkillImportSurfaces()` 同样不归还 ⇒ 同一弹框会话内第 4 次连续预览 100% 返回 `too_many_pending`，UI 无自救入口（恢复只能等 10 分钟 TTL 或重启）。归还在 `:5978`（关闭弹框路径）与 `:6394`（`closeSkillImportModal` 内）**存在**，但覆盖不到「以新预览覆写旧句柄」这条真实链路。**建议作为最高优先的补丁项** —— 虽不落在任何 must-have truth 上 |
| CR-02 | **已修复并运行期证实** | `ai-manager.js:1848` 新增绑定；`-live.js` 由 12/21 转 **29/29**（verifier 独立复跑确认） |
| WR-01 | 仍存在 | `ai-skills-manager.js:4556` `await refreshSkills(env, { rootDirs: [managedDir, skillsDir] })` 仍**未透传 `disabled`**；回滚分支不复扫 ⇒ 共享缓存可被静默污染 |
| WR-02 | 仍存在 | `docs/product/ai-skills.md:737` 压缩比行仍写「解压总量 ÷ 压缩包体积」，实现为**逐条目**口径（判据对象不一致，实现严于文档） |
| WR-03 | 仍存在 | `ai-skills-manager.js:1573 scanSkillText()` 仍只调 `scanInjectionPatterns()`、**从不引用** `SKILL_THREAT_PATTERNS`（后者消费点独立复算为 `:4215`，全部在导入面）⇒ 注释与 §11.5 声称的「`manage_skill` 自动获得技能域模式」在实现中不存在 |
| IN-01 – IN-06 | 未逐条复核（info 级） | 其中 IN-02（`SKILL_IMPORT_STATE.SUCCESS` 为名义态）与 IN-04（`deriveImportName` 透传 `MANAGE_SKILL_ERROR.INVALID_NAME` 进导入命名空间）在代码中仍可见 |

`WINDOWS.md` 中 pending 的 phase-51 条目（计划自带门禁缺陷与实施偏离）保持如实登记，verifier 未重复计数。

### Advisory (non-blocking, verifier-originated observations)

| # | Finding | Category | Why Advisory |
| - | ------- | -------- | ------------ |
| 1 | **本轮承重发现（新）**：`tests/uat-51-import-limits.js` 的 `B（强判据）` 是**分支相关**的非确定性判据（见 Anti-Patterns 首行）。同一驱动的 A 档读数（31.7 MB body → RSS 增量 77–95 MB）也是 body 的 2.4–3 倍 ⇒ 该仪器（主进程 `process.memoryUsage().rss` 的 `max - first`）测的不是「应用缓冲上界」。真正可承重的「无 `arrayBuffer()` 峰值」由**确定性源码判据**（剥注释后导入区与 `readRawBody` 零 `arrayBuffer`/`FileReader` + `body` 逐字 File 直传 + 三条单点变异自证）承担，那部分**稳定通过** | verification-artifact | 不影响任何 must-have truth 的判定；处置口径（修判据 vs 把 RSS 降级为「只登记不断言」的读数）需人类决策，故列入 `human_verification` 而非 gap |
| 2 | 指纹失效由 **3 个** covered 文件造成，其中 2 个（`main.js` `8603bad`、`AGENTS.md` `47dc69c`）来自**与本阶段无关的并发工作流**（webview 修复） | cross-workstream-staleness | 与既有记忆「同仓并发会话会在两次任务提交之间合入 master」同族；不影响任何 must-have，且已由 verifier 用「`fd3d585` 树内容精确复现旧 digest」把成因钉死。**若要减噪**，可考虑把与阶段无关的仓库级文件（`AGENTS.md` 是共享文件）从 covered_files 中分离 |
| 3 | `tests/.uat-out/*.json` 已被平台 git 追踪（`823b74c` 起），但它们是驱动**输出**而非输入；verifier 复跑会就地覆写它们 | evidence-persistence | 本轮已 `git checkout -- tests/.uat-out/` 还原，工作树与提交态一致。`51-VALIDATION.md` 称证据「固化在仓库内」属实；**不纳入 `covered_files`** 的理由见上文 |
| 4 | `docs/product/ai-skills.md` §13 未逐一列出 `HOST_WHITELIST` 六条（缺 `codeload.github.com` 具名），仅以 prose 描述 GitHub 三形态 | docs-completeness | 文档与实现**不矛盾**；truth #29 要求的是「文档出现者须与实现相符」的方向性一致，非「实现条目须尽数列出」 |
| 5 | **复跑环境残留**：本机存在一个**先于本次取证**的 dev 实例（`node_modules/electron/dist/…/Electron --inspect=0 --remote-debugging-port=0 .`，PID 58412，PPID 1，启动于 `20:08:32`），其 helper 进程同样带 `realm-dev` ⇒ 与四支 uat 驱动**共用同一份 realm-dev userData** | repro-environment | 该实例启动时间早于本轮驱动运行时段（`20:23–20:26`），非本轮的驱动遗物；verifier 按本仓「清理只按自身 PID、不按路径模式 pkill」的纪律**未处置**它。**不影响本轮任何结论**：`B（强判据）` 红/绿的判别量是驱动自身主进程的 `process.memoryUsage().rss`（进程隔离，不被他进程抬高）且证据里逐次记有 `branch=` 字段。**但复跑者应注意**：共用 userData 会改变技能目录起点（`-live.js` 依赖「组件列表 19 → 20」这类基线），复跑前先确认无其它 realm-dev 实例 |

### Gaps Summary

**无 must-have gaps。** 但**保留 1 项人工验证项**（下表），因四项 UAT 检查点中有一项**未被可靠自动化**。

逐层判决（Step 9 决策树，按最严格优先）：

1. **FAILED truth / MISSING·STUB artifact / NOT_WIRED key link / blocker anti-pattern** —— **无一命中**。29 条 must-have truth 全部 VERIFIED；8 条行为依赖型 truth 各自有**真跑**的行为测试（真 fs / 真 stub 网络 / 真渲染），无一靠符号存在性过关；债务标记门禁零命中。CR-02 的修复经**真实运行期驱动**独立证实。
2. **人类验证项** —— **命中（1 项）**。四项原人工检查点中，三项（真实 GitHub 端到端、403/429/404 可操作文案、多尺寸档布局）经本次独立复跑确已**稳定**自动化（29/29、含 403/429 替代边界、48/48）；**第四项（32 MiB 上传的内存上界）的自动化判据分支相关且不稳定**，故如实保留。

⇒ **status: `human_needed`**（自动化面 28/29 稳定全绿 + 1 项判据待裁决）。

#### 必须原样保留的诚实边界（不得读成「已完全自动化」）

1. **403 / 429 未真实触发 GitHub 侧限流。** 导入链路只打 `codeload.github.com`，**不打 `api.github.com`**；未鉴权的 60 req/h 配额打在 `api.github.com`，与 codeload **不是同一配额域** ⇒「打满 api 配额」不会让导入返回 403。故 403 / 429 用 `net.fetch` 单点替身返回**真实形状**的响应头（`x-ratelimit-remaining: 0` / `retry-after: 42`），**其余全部走真链路**（白名单 → 逐跳私网校验 → 跳数 → 状态分类 → HTTP 序列化 → 设置页文案表 → 状态行渲染），证据里标 `substituted: true`。**真实 404 走的是真链路**（本次复跑实测：`tree/zzq51-no-such-ref-9f3a/…` ⇒ codeload 真 404，文案含「已尝试 main / master」）。
2. **guest JS 堆曲线只登记不断言。** Chromium 的 `performance.memory.usedJSHeapSize` 是**量化**值且与 GC 强耦合 —— 标定（对同一个 File 显式 `await file.arrayBuffer()`）的峰值增量实测为**负值**（构造期垃圾在被测窗口内被回收，量级盖过拷贝本身），做不出可靠的两侧判据。**本轮新证据进一步表明：原本被委以承重的主进程 RSS 判据同样不可断言**（同款「仪器不可靠」，且多了一层分支依赖）。⇒ 「无 `arrayBuffer()` 峰值」这条**由确定性源码判据单独承重**。

#### 关于 CR-01 的边界说明（沿用上轮口径，供决策）

CR-01 仍是本阶段唯一被独立复现的**用户可见缺陷**，但它不落在任何 must-have truth 上（51-04 的句柄 truth 只要求三态「明确码 + 可读原因」，该条成立），且已记入 `51-REVIEW.md` 作技术债 ⇒ verifier 不将其计为 gap。若维护者认为「重复预览后无法自救济」应视为目标未达成，可将 CR-01 提升为 gap 并走 `/gsd-plan-phase 51 --gaps`。**本轮新增的 `uat-51-import-limits.js` 判据问题可按同一路径处置**（升为 gap 以「修判据」为交付物），verifier 同样把这条留给人类决定。

---

_Verified: 2026-09-15T12:41:18Z_
_Verifier: Claude (gsd-verifier)_

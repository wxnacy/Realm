---
phase: 51-zip
verified: 2026-09-15T10:04:01Z
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
covered_digest: "v1:sha256:30a4cbb83fe438223f4c73155ba89871a933a4b7d1f7f71e14f8daa7060f448b"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "真实 GitHub 端到端成功路径：设置页 → 网络地址 → 填一个含**恰好一个**技能根的仓库 tree/<ref>/<path> 地址 → 预览六字段齐备 → 确认 → 组件列表出现该技能、/ 面板可见、下一条消息技能进 prompt"
    expected: "整条真实网络链路走通；zipball 顶层 <repo>-<ref>/ 前缀被剥离；技能落到 skills/<name>/ 并回读可见"
    why_human: "自动化套件刻意只用本地 stub server（不得依赖实时外网），真实外网成功路径只能在真机上人工跑一次。51-05-SUMMARY.md 与 51-VALIDATION.md 均如实登记为**仍未跑**"
  - test: "真实 GitHub 403 / 429 限流文案的可操作性：连续多次导入直到命中未鉴权限流（60 req/h）"
    expected: "提示含「限流」与重试指引，且**不是**静默失败"
    why_human: "需要真实触发 GitHub 侧限流，无法在离线套件里复现；分类逻辑（403/429/404 各一例含可操作原因）已由 stub server 用例覆盖"
  - test: "32 MiB 上传在本机 Electron 的真实耗时与内存峰值（DevTools Performance，上传一个接近 32 MiB 的包）"
    expected: "耗时与堆曲线在可接受范围，且**无**「先 arrayBuffer() 再判大小」的峰值"
    why_human: "绝对耗时 / 内存峰值为本机环境相关量；行为面（413 可达 / 无 unhandledRejection / 堆不线性增长）已由 test-skills-http-api.js 覆盖"
  - test: "UAT 驱动只取了单一窗口尺寸档；在设置页真实 CSP 下换极窄 / 超宽窗口复核预览弹框（目录树折叠、脚本标红、必勾、冲突三选一）"
    expected: "各尺寸档下弹框总高 ≤ 80vh、滚动只在预览区、动作区不横向溢出、按钮不被裁切"
    why_human: "52 项断言已在当前尺寸档实测通过（verifier 独立复跑）；其余尺寸档未逐一取数，属残余人工面"
---

# Phase 51: 用户技能导入管线（zip + 网络地址）Verification Report

**Phase Goal:** 用户可从本地 zip 包或网络地址安全导入技能，导入前看清将写入什么；恶意或畸形包整包拒绝且工作区外零写入。
**Verified:** 2026-09-15T10:04:01Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Verifier ran every gate independently (test suites re-executed, three purpose-built probes written from scratch, source-level invariants re-counted). SUMMARY claims were treated as unverified until reproduced.

#### Plan 51-01 — SEC-10 沙箱写面加固

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `env.writeFile(<root 内 symlink 指向 root 外>/x)` 返回 `{ok:false, error.code:'permission_denied'}`、不 throw，且 root 外**真的没有**产生文件 | ✓ VERIFIED | `agent-workspace.js:258` `resolveInsideForWrite` + `:332` `guardForWriteResult`；`tests/test-agent-workspace.js` 用例组「写面加固（SEC-10）—— 十例判定与源码契约」ok 1/ok 3（真 fs 探针 + `fs.existsSync` 对 root 外断言）。实跑 38/38 pass |
| 2 | 沙箱内**自指** symlink（`ln -s . loop`）下的写入仍放行（加固未收紧过头） | ✓ VERIFIED | `agent-workspace.js:370,376`；测试 ok 2「env.writeFile 经沙箱内自指链接写入成功」+ ok 5。十例期望表中「仅『link OUT then write』一处由放行转拒绝」证实既有集合零变化 |
| 3 | 五个写方法（`writeFile`/`appendFile`/`renameFile`/`createDir`/`remove`）+ 两个临时目录方法切到 `guardForWriteResult`；读面仍走 `guardResult`，两者**并列存在** | ✓ VERIFIED | 源码扫描：`:370,376,383,385,420,426,439,443,454,459,465` 为写面，`:352,358,364,391,397,403,414,478` 为读面；测试 ok 11（剥注释后的双向契约）+ ok 12（写面方法体内零 `realpathSync`，无第二份判据） |
| 4 | `resolveInsideForWrite` 对非字符串 / 空串 / 纯空白 / `..` 逃逸 / 绝对路径越界 / 兄弟前缀目录一律返回 `null`（fail-closed，不抛、不 fallback 到 root） | ✓ VERIFIED | 实现 `:258-283`（词法双基准 + 最近已存在祖先 realpath，非 ENOENT 一律 `return null`）；测试 ok 3 + ok 4 |

#### Plan 51-02 — 依赖落定

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 5 | `dependencies` 含 `"yauzl": "^3.4.0"` 与 `"yaml": "2.9.0"`（逐字，无 `^`）；`yaml` **单实例**（SDK 内无嵌套副本）；`yauzl` 暴露 Promise API | ✓ VERIFIED | 独立复算：`package.json` 实测 `yauzl=^3.4.0` / `yaml="2.9.0"`；`node_modules/yaml/package.json` = `2.9.0`；`node_modules/@earendil-works/pi-agent-core/node_modules/yaml` **不存在**；`require('yauzl').version=3.4.0`，模块级 `openPromise`/`fromBufferPromise` 为 function，`ZipFile.prototype.openReadStreamPromise` 为 function |
| 6 | 两包均无 `postinstall`；`build.files` 全部 `!` 前缀；`build.asarUnpack` 未被改动 | ✓ VERIFIED | 独立复算：两包 `scripts` 均无 `postinstall`；`build.files` 每项 `!` 开头；`asarUnpack` 仍为 `["node_modules/nodejieba/**","skills-builtin/**"]`。回归：`test-builtin-skills-seeder.js` 101/101 |

#### Plan 51-03 — zip 全量校验 + 唯一落盘实现

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 7 | 同包 SKILL.md 计数 = 1 ⇒ 进预览；= 0 或 ≥ 2 ⇒ 整包拒绝并给可操作提示（含 `tree/<ref>/<path>` 示例） | ✓ VERIFIED | `locateSkillRoot` `ai-skills-manager.js:3601` 全包扫描（不限定 `skills/*`）；测试「技能根定位」ok 4（多根：message 含实测数量与可复制 tree 地址）/ ok 5（零根）。独立探针：双根包在 `locateSkillRoot` 层被拒 |
| 8 | 两阶段：preview 返回 `{importId, preview}` 且**不产生** `skills/<name>/`；仅 commit 后出现该目录；预览六字段齐备 | ✓ VERIFIED | 独立探针 B：preview 前 `skills/` 为 `[]`，preview 后仍为 `[]`，commit 后出现 `["vprobe-skill"]` 且 `SKILL.md` 存在；preview 响应实测含 `name/description/tree/fileCount/dirCount/bytes/maxFileBytes/depth/scripts/truncated/scan/allowedTools/conflict/limits/origin/rootRel` |
| 9 | 含 symlink entry 的包在**两条判据路**（central-directory external attributes + 解压后递归 `lstat`）各自被拒，且断言点是「整包拒绝」而非「跳过条目」 | ✓ VERIFIED | `assertNoSymlinkTree` `:3686`；测试「两路 symlink」ok 1-3；独立探针：`symlinkZip`/`symlinkDirZip` 均 `unsafe_entry`「已拒绝整包（不跳过该条目）」 |
| 10 | 逃逸族 + 空/仅斜杠/仅点 entry 名 + NFD+小写归一化查重（大小写、NFC/NFD）各自整包拒绝 | ✓ VERIFIED | 独立探针：NTFS ADS / RTL override / 尾随空格 / 大小写冲突 / NFC-NFD 冲突逐一 `unsafe_entry`；`normalizedEntryKey` `:3121`。测试 15 条逃逸样本 + 4 对冲突名 |
| 11 | 六类限额各一例 + `uncompressedSize === 0xFFFFFFFF` 显式拒绝；嵌套深度**按技能根相对计** | ✓ VERIFIED | `IMPORT_LIMITS` 八键实测（1 MiB / 32 MiB / 2000 / 100 / 16 / 50 / 3 / 600000）；独立探针：压缩比 1015:1 ⇒ `limit_exceeded`「限额 100:1」、2001 条目 ⇒ `limit_exceeded`、`0xFFFFFFFF` ⇒ `unsupported_zip64`。深度在 `collectPreviewStats` `:3889` 按技能根相对判，测试 ⑤/⑤b 正反两例 |
| 12 | 解压只在 `mkdtempSync` 新建空目录内；落点用「最近已存在祖先 realpath」复核；**真跑**越界对照组并断言 root 外零新文件 | ✓ VERIFIED | `extractAndValidatePackage` `:3552` + `assertLandingInsideWriteRoot` `:3778`；测试「越界对照组：全部恶意样本跑完一轮后，临时根之外的目录**零新文件**」+「落点复核：父目录链最近已存在祖先为 symlink ⇒ 拒绝落盘」 |
| 13 | `SKILL_THREAT_PATTERNS` 三类各有正样本命中；`skills-builtin/**` 零命中；`description` 与 body **双扫** | ✓ VERIFIED | 独立复算三类正样本：exfil 7 命中（A1/A1/A4/A12/A5/A7/A9）、credential 6（B1/B2/B3/B4/B7/B8）、confirm_bypass 5（C1/C2/C2/C8/C7）；`skills-builtin/**` 21 个文件 **0 命中**；双扫用例 ok 1-3 + ok 4（注入类 ⇒ 整包拒绝） |
| 14 | **三种来源汇进同一个落盘实现**：`importUserSkill(` 全仓 = 定义 1 + 调用 1，`main.js` 与前端各 0；`yauzl.openPromise(` 恰 1 | ✓ VERIFIED | 独立计数（剥注释）：`ai-skills-manager.js:4391` 定义、`ai-manager.js:2019` 调用，`main.js` / `src/settings-page.js` 各 0；`yauzl.openPromise(` 仅 `ai-skills-manager.js:3288` 一处 |

#### Plan 51-04 — 落盘事务与句柄生命周期

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 15 | seeded 同名 ⇒ 拒绝导入；user 同名三选一各自可达；改名走 `validateManagedSkillName`；managed 同名不许覆盖 | ✓ VERIFIED | `resolveImportConflict` `:1787`（判定顺序 seeded → user → managed）；测试「冲突三档」ok 1-3 + 「冲突 × 三选项矩阵」ok 1-9。独立探针 B：同名无 conflict ⇒ `conflict_unresolved`，无静默覆盖 |
| 16 | 覆盖事务可回滚：第二步 `rename` 真实注错 ⇒ 旧技能内容**逐字完好** | ✓ VERIFIED | 测试 ok 10「覆盖第二步失败（真实失败注入）⇒ 旧技能内容**逐字**完好，无半成品」；overwrite 成功后备份已删（ok 2） |
| 17 | 回读验证失败即回滚并暴露 `diagnostics` 原文（含 path） | ✓ VERIFIED | 测试 ok 11 + ok 12（覆盖场景备份被恢复） |
| 18 | 句柄生命周期三态各自可达：`import_expired` / `import_not_found` / `too_many_pending`，皆为明确码 + 可读原因 | ✓ VERIFIED | 测试「句柄生命周期」ok 1-6（TTL 到期 + 临时目录已删 / 未知句柄 + 一次性 / 并发上限 + 取消后可再 preview / 取消幂等 / 失败保留句柄可就地重试 / 显式取消清句柄） |
| 19 | 崩溃残留清扫不误删进行中的包（陈旧性判据正反两例）；前缀与实际产物**正向**成对 | ✓ VERIFIED | `IMPORT_TMP_PREFIXES` `:2279` + `isImportResidueName` `:2303`；测试 ok 1（正向匹配真实 mkdtemp 产物 + 真实覆盖备份）+ ok 2（mtime 刚刚 ⇒ 不删；早于 2×TTL ⇒ 删）+ ok 3/ok 4/ok 5 |
| 20 | 数量闸口径：达上限时**改名**被拒（计入）、**覆盖**同名成功（净增 0 豁免）；判据**读盘** | ✓ VERIFIED | 测试 ok 13 + `countUserSkills` `:3969`（`env.listDir` 实时读盘） |
| 21 | 每个 `IMPORT_SKILL_ERROR` 码至少一条用例；失败文案含码 + 可读原因；限额类含限额名与当前值；无空 message | ✓ VERIFIED | 独立复算 `IMPORT_SKILL_ERROR` 恰 **21 键**（与 51-07 文档全集一致）；`MANAGE_SKILL_ERROR` 仍恰 **11 键**（命名空间隔离守住）；测试套件第 24 组「拒绝面矩阵：每个可达的码至少一条用例（缺码即指名）」+ ok 8 循环断言限额名与当前值。独立探针：`limit_exceeded`「限额 100:1，该条目实测约 1015:1」、`download_failed`「限额 524288 字节，已接收 589824 字节」 |

#### Plan 51-05 — 网络地址导入

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 22 | 仓库 / `tree/<ref>/<path>` / `blob`·raw 直链三形态各自分流；zipball 顶层前缀剥离；`api.github.com` 与白名单外主机回 `unsupported_url` | ✓ VERIFIED | 独立探针：`https://github.com/o/r` ⇒ zipball→codeload；`tree/main/skills/foo` ⇒ scopeRel=`skills/foo`；raw/blob ⇒ raw-skill；`http:` / `evilgithub.com` / `github.com.evil.com` / `api.github.com` / `example.com` / `ftp:` / `objects.githubusercontent.com` ⇒ `unsupported_url`。前缀剥离用例 ok 2 + 独立探针 `wrapPrefix=repo-main` 剥离成功 |
| 23 | https 强制 / 白名单**精确**匹配 / 逐跳私网拒 / 跳数超限**抛错**而非报 HTTP 3xx / magic bytes / 流式上限命中即中止且清理半成品 | ✓ VERIFIED | 独立探针（自建 stub + 自建注入 fetch）：① 白名单内 → 302 到私网 ⇒ 第二跳 `download_failed`「拒绝访问内网地址」；② 无限 302 ⇒ `redirect_limit`「重定向次数超过上限（5）」且 message **不含** `HTTP 3xx` 形态；③ 持续吐字节 ⇒ `download_failed`「限额 524288 字节，已接收 589824 字节」且半成品文件**未残留**；④ 非 https 首跳 ⇒ 零请求发出。白名单独立探测：`evilgithub.com` / `github.com.evil.com` ⇒ false，`www.skills.sh` / `skills.sh` / `GITHUB.COM` ⇒ true |
| 24 | 直链 SKILL.md 与 zip 走**同一落盘函数**；可注入三键在生产调用点全用默认值（源码正命题） | ✓ VERIFIED | 独立计数见 #14；`downloadPackage` 默认值实测 `fetchImpl=(u,o)=>require('electron').net.fetch(...)` / `isPrivateHost=getSearchManagerLazy().isPrivateHost` / `hostWhitelist=HOST_WHITELIST`；测试「生产调用点走缺省依赖（正命题）」+ 「公共后段只有一处：`locateSkillRoot(`/`buildImportPreview(` 在 `ai-manager.js` 各恰 1 处」 |

#### Plan 51-06 — 导入 UI 完整面

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 25 | 完整弹框契约（E1–E18）+ 9 态状态机 + 元素顺序；15 个新增元素**零内联 `style`**；region 内**零 `innerHTML`/`insertAdjacentHTML`** | ✓ VERIFIED | 独立扫描 region `src/settings-page.js:5724-7010`：`innerHTML`/`insertAdjacentHTML` 各 1 处且**均在注释内**；`document.createElement(` 36 处、`textContent` 35 处；`aria-disabled` 仅出现在注释；`src/settings.html:583-624` 弹框块内联 `style=` **0 处** |
| 26 | 两条 backstop（E2 弹框 overflow / E17 动作区 overflow）由**带正命题的属性测试**在真实渲染下满足 | ✓ VERIFIED | 恒等复跑 `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` ⇒ **52 passed**，含 E2 三条读数（弹框总高 ≤ 0.8×innerHeight、预览内滚动生效、零页面级滚动）× E17 四条（`withinRow` / 按钮可见不裁切 / 禁用原因在按钮排上方 / 弹框本体不横向溢出），均为**实测读数**而非 CSS 推算 |
| 27 | 键盘契约：唯一 `tabindex` 是预览滚动容器的 0 值；Tab 序 = DOM 序；焦点归还 `#skillImportOpen`；提交中忽略 Escape | ✓ VERIFIED | UAT 实测：`["skillImportPreview:0"]`、`11 stops reordered=0`、`zero=0`（弹框内零可见高度停靠点）、`focus=cancel…`/`focus=skillImportOpen`、提交中 Escape 被忽略、ready 态 Escape 关闭 |

#### Plan 51-07 — 文档与账本收口

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 28 | `docs/product/ai-skills.md` 第十三节【导入】+ `ai-agent-workspace.md` §七 SEC-10 行为变更 + `AGENTS.md` 导入维护约定与测试行；counts-parity `cells` 下限 20 且实测通过 | ✓ VERIFIED | `ai-skills.md:695`「## 十三、导入（zip + 网络地址）」；`ai-agent-workspace.md:138-140` SEC-10 三条（`ln -s` 出去再写被拒 / 自指仍放行 / 不封闭 bash 写盘）；`AGENTS.md:341`（两个新套件例数账本）+ `:350`（导入维护约定条目）。独立复跑 counts-parity ⇒ `counts-parity ok cells=20`，实测 `{manage-skill:55, ai-skills:198, picker:115, skills-management:49, skills-http-api:41, skills-import:116, skills-import-net:50}` |
| 29 | 文档数值与实现逐字一致：码表全集 = `IMPORT_SKILL_ERROR` 全部 21 值；限额值 = `IMPORT_LIMITS`；白名单条目无矛盾；四条诚实边界恒显；不出现已被实测推翻的旧理由 | ✓ VERIFIED | 独立复算：21 个错误码在文档中**全部**出现（缺失 0）；`IMPORT_LIMITS` 八个数值**全部**命中；诚实边界 5 条在位（启发式非安全边界 / DNS rebinding 未消除 / SEC-10 行为变更 / `allowed-tools` 不被强制 / 三条保留条目「不是承载产品闭环」+ 显式标注旧说法已被推翻）；`TD-48-01` 明确写「仍开未修…不声称已修」 |

**Score:** 29/29 truths verified (0 present-but-behavior-unverified)

All 8 behavior-dependent truths (state transitions / cancellation-cleanup-ordering invariants — #1, #2, #12, #16, #17, #19, #23, #26) have a **passing behavioral test** that exercises the transition on real fs / real stub network / real render; none were accepted on symbol presence alone.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `agent-workspace.js` | `resolveInsideForWrite` + `guardForWriteResult` + 五个写方法与两个临时目录方法切换 | ✓ VERIFIED | `:258` 定义、`:332` 包装、`:370..465` 接线；`module.exports.resolveInsideForWrite` |
| `ai-skills-manager.js` | `IMPORT_LIMITS` / `IMPORT_SKILL_ERROR` / `validateEntryName` / `locateSkillRoot` / `readSkillPackageEntries` / `extractAndValidatePackage` / `buildImportPreview` / `importUserSkill` / `SKILL_THREAT_PATTERNS` / `scanSkillThreats` / `HOST_WHITELIST` / `classifyImportUrl` / `downloadPackage` / `prepareFromRawFile` | ✓ VERIFIED | 全部实测存在且已导出（`module.exports` 段逐项核对） |
| `ai-manager.js` | `this._skillImports`、`previewSkillImport`、`commitSkillImport`、`cancelSkillImport`、`sweepSkillImports` | ✓ VERIFIED | `:1794 / :1982 / :2055 / :2089`；独立探针 B 驱动成功 |
| `main.js` | `MAX_SKILL_PACKAGE_BYTES`、`readRawBody`、`import` 分支按 Content-Type 分流 | ✓ VERIFIED | `:902 / :1015 / :2973`；JSON 模式 `mode:'url'` 与 `mode:'commit'` 各自转发 |
| `src/settings.html` | `#skillImportOpen` / `#skillImportFile` / `#skillImportModal` 全骨架 | ✓ VERIFIED | `:541 / :598 / :583`，弹框块零内联 `style` |
| `src/settings-page.js` | 导入 region（状态机 / 渲染 / 闭合文案表 / 净化） | ✓ VERIFIED | region `:5724-7010`（1287 行），零 HTML 字符串模板 |
| `src/styles/main.css` | 专属样式段（含 3 条作用域覆盖） | ✓ VERIFIED | 新增段存在；UAT 渲染实测生效 |
| `tests/test-skills-import.js` | 新建套件 | ✓ VERIFIED | 实跑 **116/116** |
| `tests/test-skills-import-net.js` | 新建套件（stub server） | ✓ VERIFIED | 实跑 **50/50** |
| `tests/helpers/make-malicious-zip.js` | 恶意样本夹具生成器（零外部依赖） | ✓ VERIFIED | 导出 17 个 builder；测试 ok 3 断言不出现 `python3` / `zip` 命令行 |
| `tests/uat-51-import-modal.js` | 真实渲染 uat 驱动 | ✓ VERIFIED | 实跑 **52 passed** |
| `docs/product/ai-skills.md` §13 / `docs/product/ai-agent-workspace.md` §7 / `AGENTS.md` | 文档与账本 | ✓ VERIFIED | 三处均落地，数值与实现一致 |

No MISSING or STUB artifacts. Every file listed in the plan `artifacts` blocks was located and is substantive.

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| 三条来源（上传 / zipball / raw 直链） | `importUserSkill` | 共用一段后段 | ✓ WIRED | 独立计数：`importUserSkill(` 定义 1 + 调用 1；`yauzl.openPromise(` 恰 1 |
| `previewSkillImport`（三条来源唯一入口） | `extractAndValidatePackage` / `prepareFromRawFile` | 两个准备器产出同一 `{pkgRoot}` 形状 | ✓ WIRED | `test-skills-import-net.js` ok 2 + ok 6（`locateSkillRoot(`/`buildImportPreview(` 在 `ai-manager.js` 各恰 1） |
| `resolveInsideForWrite` | 五个写方法 + 两个临时目录方法 | `guardForWriteResult` 唯一包装 | ✓ WIRED | 源码扫描：写面 11 处 `guardForWriteResult(`、读面 8 处 `guardResult(`，并列存在；写面方法体内零 `realpathSync` |
| `IMPORT_LIMITS` | preview 响应的 `limits` → 设置页 | 单源回传，前端零字面量 | ✓ WIRED | 独立探针 preview 响应含 `limits`；测试 ok 3「端点与前端零字面量」 |
| `IMPORT_SKILL_ERROR`（21 值） | `SKILL_IMPORT_ERROR_TEXT`（前端闭合表） | 双向覆盖 | ✓ WIRED | 测试「双向覆盖（缺哪个码在此指名）」+「失败文案是**闭合**白名单」；独立复算表键 ⊇ 21 值 |
| `search-manager.isPrivateHost` | `downloadPackage` 默认 `isPrivateHost` | 惰性 require + 依赖注入默认值 | ✓ WIRED | `:2664` `getSearchManagerLazy()`；`ai-skills-manager.js` 内**无**第二份网段表 |
| `main.js` `MAX_SKILL_PACKAGE_BYTES` | `IMPORT_LIMITS.MAX_TOTAL_BYTES` | 跨文件相等性断言 | ✓ WIRED | 独立复算两者均为 `33554432` |
| 成功出口 | `ensureSkillsFresh()` 恰一次 + 调用侧 `broadcast('skills:changed')` 恰一次 | D-19 写路径收口 | ✓ WIRED | 测试 ok 4（D-19 计数断言）；`syncAgentSystemPrompt()` 函数体逐字未改 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `#skillImportPreview` 六字段 | `skillImportTarget.preview` | `previewSkillImport` → `buildImportPreview`（真实解压后的目录树 / 字节统计 / 扫描结论） | Yes | ✓ FLOWING |
| 字节数与限额对照 | `preview.bytes` / `preview.maxFileBytes` / `preview.limits` | `collectPreviewStats`（真遍历 `pkgRoot`）+ `buildImportLimitsProjection()` | Yes | ✓ FLOWING |
| 扫描结论两栏 | `preview.scan.injection` / `preview.scan.heuristic` | `assertNoInjection` + `scanSkillThreats`（真实模式匹配） | Yes | ✓ FLOWING |
| 冲突三选一 | `preview.conflict` | `resolveImportConflict`（`env.listDir` / `env.fileInfo` **实时读盘**，非缓存快照） | Yes | ✓ FLOWING |
| 网络下载目标 | `classifyImportUrl(url).target` | 真实 URL 分类（codeload zipball / raw.githubusercontent） | Yes | ✓ FLOWING |

No HOLLOW / DISCONNECTED / STATIC / HOLLOW_PROP findings. No hardcoded empty props; no static returns standing in for real queries.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 沙箱写面加固行为面（逃逸转拒 / 自指放行 / 既有集合零变化） | `node tests/test-agent-workspace.js` | `# tests 38 / # pass 38 / # fail 0` | ✓ PASS |
| 导入面 zip 全量校验与落盘 | `node tests/test-skills-import.js` | `# tests 116 / # pass 116 / # fail 0` | ✓ PASS |
| 网络面分类 / 白名单 / 逐跳 / magic / 流式 | `node tests/test-skills-import-net.js` | `# tests 50 / # pass 50 / # fail 0` | ✓ PASS |
| 回归：管理面 / 技能域 / 传输面 / 播种 | `node tests/test-manage-skill.js`、`test-ai-skills.js`、`test-skills-management.js`、`test-skills-http-api.js`、`test-builtin-skills-seeder.js` | 55 / 198 / 49 / 41 / 101，全 `fail 0` | ✓ PASS |
| 例数一致性账本 | counts-parity 内联命令（7 套件实跑 + 双文件账本比对） | `counts-parity ok` / `cells=20` | ✓ PASS |
| 真实渲染 UAT（两 tab / 六字段 / 必勾 / 冲突 / 键盘 / 注入纪律） | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` | `uat-51-import-modal: 52 passed` | ✓ PASS |
| 独立探针 A：恶意 zip 族 + URL 分类 + 白名单 + 威胁三类 + 内置语料零误伤 | `node /tmp/probe51a.js`（verifier 自撰） | 14 类恶意包全部整包拒绝；`windowsZip`/`dataDescriptor`/合法包放行；白名单 `evilgithub.com`=`false`；三类正样本命中；`skills-builtin/** 21 files, 0 with hits` | ✓ PASS |
| 独立探针 B：两阶段 / 冲突 / 句柄泄漏复现 | `node /tmp/probe51b.js`（verifier 自撰） | preview 零落盘 → commit 落盘 + 回读；同名无 conflict 被拒；**CR-01 复现**：第 4 次 preview 必 `too_many_pending` | ✓ PASS（含 CR-01 复现，见下） |
| 独立探针 C：SSRF 逐跳 / 跳数 / 流式上限 | `node /tmp/probe51c2.js`、`/tmp/probe51c3.js`（verifier 自撰） | 逐跳私网 `download_failed`；`redirect_limit` 且非 HTTP 3xx 文案；流式上限 `download_failed` + 半成品已清理 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/*/tests/probe-*.sh` 约定路径 | `find scripts -path '*/tests/probe-*.sh'` | 本阶段无此类探针（PLAN/SUMMARY 亦未声明 probe） | N/A |

### Requirements Coverage

全部 12 个 ID 均在 PLAN frontmatter 声明，且在 `.planning/REQUIREMENTS.md` 中映射到 Phase 51。**无 ORPHANED requirement**（REQUIREMENTS.md 第 184 行映射的 `USER-03, USER-04, USER-05, USER-08, SEC-02..08, SEC-10` 与 7 个 PLAN 的 `requirements` 字段并集完全一致）。

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USER-03 | 51-02, 51-03, 51-07 | 上传 zip 导入技能（单技能包语义；0 或 ≥2 技能根报错并提示） | ✓ SATISFIED | 见 truth #7 + #8；独立探针 A 验证合法单技能包通过、双根 / 空包在 `locateSkillRoot` 拒绝 |
| USER-04 | 51-02, 51-05, 51-07 | 网络地址导入，自动分流 GitHub 仓库 / 目录 与 SKILL.md 直链 | ✓ SATISFIED | 见 truth #22；独立探针 A 的 13 条 URL 分类矩阵 |
| USER-05 | 51-03, 51-04, 51-06, 51-07 | 两阶段（预览 → 确认落盘）；预览展示名称 / description 原文 / 目录树 / 字节数 / 脚本清单（标红）/ 威胁扫描结论 | ✓ SATISFIED | truth #8 + #25；UAT 52 passed 含六字段渲染快照与脚本标红 |
| USER-08 | 51-04, 51-06, 51-07 | 导入失败给出真实原因（命中哪个限额 / 扫描结论 / 校验错误），不静默 | ✓ SATISFIED | truth #21 + #23；独立探针实测限额类 message 含限额名与当前值；21 码零跳过 |
| SEC-02 | 51-03, 51-07 | 拒绝含 symlink entry 的**整包**（central directory 属性 + 解压后递归 `lstat` 两路） | ✓ SATISFIED | truth #9；独立探针 A 两类 symlink 包均 `unsafe_entry`「已拒绝整包」 |
| SEC-03 | 51-03, 51-07 | 逐 entry 路径校验（`..` 归一化后判 / 绝对路径 / 盘符 / UNC / 反斜杠 / NTFS ADS / 控制字符 / 尾随空格与点）+ NFD+小写查重 | ✓ SATISFIED | truth #10；独立探针 A 命中 ADS / RTL / 尾随空格 / 大小写 / NFC-NFD 五类 |
| SEC-04 | 51-03, 51-07 | 先读 central directory `uncompressedSize` 预检，再边解边累加；覆盖单 entry / 累计 / entry 数 / 压缩比 / 嵌套深度 | ✓ SATISFIED | truth #11；六类限额各有具名用例，独立探针命中压缩比与 entry 数两闸 |
| SEC-05 | 51-03, 51-07 | 解压到 `fs.mkdtempSync` 全新空目录；落点用**最近已存在祖先 realpath** 复核 | ✓ SATISFIED | truth #12；`assertLandingInsideWriteRoot` + 真实越界对照组零新文件 |
| SEC-06 | 51-03, 51-07 | 扫描 `description` 与 body：复用 `scanInjectionPatterns` + 新增 `SKILL_THREAT_PATTERNS` 三类 | ✓ SATISFIED | truth #13；双扫用例 + `skills-builtin/**` 零误伤回归（独立复跑 21 files / 0 hits） |
| SEC-07 | 51-04, 51-07 | 与内置同名 ⇒ 拒绝；与已有用户技能同名 ⇒ 显式策略（覆盖 / 改名 / 取消），不静默覆盖 | ✓ SATISFIED | truth #15；独立探针 B 复现 `conflict_unresolved` |
| SEC-08 | 51-05, 51-07 | https-only + 主机白名单 + 逐跳 `isPrivateHost` + 流式字节上限 + magic bytes；**不复用** `search-manager.fetchUrl`，复用其 SSRF 判据 | ✓ SATISFIED | truth #23 + #24；独立探针 C 实测逐跳 / 跳数 / 流式三闸；`ai-skills-manager.js` 内无 `fetchUrl` 调用、无私网判据副本 |
| SEC-10 | 51-01, 51-07 | 加固既有沙箱 `writeFile` 的 ENOENT symlink 缺口（与导入路径同一根因） | ✓ SATISFIED | truth #1–#4；38/38 通过，含十例期望表与既有集合零变化对照 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| （全部 phase-51 文件） | — | `TBD` / `FIXME` / `XXX` 无引用的遗留标记 | — | **无**。扫描 `agent-workspace.js`、`ai-skills-manager.js`、`ai-manager.js`、`main.js`、`src/settings-page.js`、`src/settings.html`、`src/styles/main.css`、六个测试套件：唯一命中为 `ai-skills-manager.js:1659` 的 `tmp-XXXXXX/`（临时目录名形状，注释）与 `ai-manager.js:538/575` 的中文说明文本 —— 均非债务标记 |
| `src/settings-page.js` | 5734 / 6041 | `innerHTML` / `insertAdjacentHTML` | ℹ️ Info | 两处命中**均在注释内**（「不存在任何 `innerHTML` / `insertAdjacentHTML` 路径」），代码侧为零。与测试「region 内零 HTML 字符串模板（负命题 + 正命题）」一致 |
| `src/settings-page.js` | 6036 | `aria-disabled` | ℹ️ Info | 仅出现在注释（解释为何**不用** `aria-disabled`）。代码侧全部走原生 `disabled` |
| 全阶段 | — | 空实现 / `return null` 占位 / 硬编码空 props | — | **无**。Data-Flow Trace 五项全部 FLOWING |

### Known Recorded Tech Debt (already logged — not re-counted as new failures)

`51-REVIEW.md`（2026-09-15，`status: issues_found`：1 critical + 3 warning + 6 info）的发现经 verifier 独立复核**仍然存在**，且已按项目「阶段收尾以 UAT 为准；代码审查 Critical 记入 REVIEW.md 作技术债」的既定裁决挂账。verifier **不**将其计为本轮新的失败项（无 must-have truth 因此失败），但逐条复核结论如下：

| ID | 复核结论 | 独立证据 |
| -- | -------- | -------- |
| CR-01 | **仍存在，已独立复现** | 探针 B：`#1 ok size=1 / #2 ok size=2 / #3 ok size=3 / #4 ERR too_many_pending`，`.tmp/` 下滞留 4 个 `skill-import-*` 目录；`src/settings-page.js:6844` 仍直接覆写 `importId` 而不归还前一个句柄。**建议作为下一阶段/补丁的最高优先项** —— 虽不落在任何 must-have truth 上，但它构成用户可见死路（正常「换个地址再试 / 重选文件」操作三次后即撞墙，须等 10 分钟 TTL 或重启） |
| WR-01 | 仍存在 | `ai-skills-manager.js:4556` 回读刷新未透传 `disabled`；回滚分支（`:4574-4585`）不复扫 ⇒ 共享缓存可被静默污染 |
| WR-02 | 仍存在 | `docs/product/ai-skills.md` §13.3 压缩比行仍写「解压总量 ÷ 压缩包体积」，实现（`ai-skills-manager.js:3370-3387`）为**逐条目**口径 |
| WR-03 | 仍存在 | `ai-skills-manager.js:3993-3997` 注释与 `ai-skills.md:502`（§11.5）仍声称「`manage_skill` 写入路径自动获得技能域模式」，而 `scanSkillText()`（`:1573`）从不引用 `SKILL_THREAT_PATTERNS` |
| IN-01 – IN-06 | 未逐条复核（info 级） | 其中 IN-02（`SKILL_IMPORT_STATE.SUCCESS` 为名义态）与 IN-04（`deriveImportName` 透传 `MANAGE_SKILL_ERROR.INVALID_NAME` 进导入命名空间）在代码中仍可见 |

`WINDOWS.md` 中 16 条 phase-51 条目（#36–#52，`deviation` / `unrun-verify`）全部 `open`，均为**计划自带门禁缺陷与实施偏离**的如实登记（不是产品缺陷），verifier 未重复计数。

### Advisory (non-blocking, verifier-originated observations)

| # | Finding | Category | Why Advisory |
| - | ------- | -------- | ------------ |
| 1 | `tests/.uat-out/uat-51-import-modal.json` 存在于工作树但**未被 git 追踪**（`.gitignore` 未提及）。`51-VALIDATION.md` 称该证据「固化在仓库内」—— 全新 clone 上该文件不会存在（驱动可确定性重跑再生） | evidence-persistence | 与 Phase 50「证据只活 /tmp」同族的方向性问题；不影响任何 must-have，且 verifier 已自行重跑驱动得 52 passed |
| 2 | `docs/product/ai-skills.md` §13 未逐一列出 `HOST_WHITELIST` 六条（缺 `codeload.github.com` 具名），仅以 prose 描述 GitHub 三形态。文档与实现**不矛盾**，属完整性缺口 | docs-completeness | 51-07 truth 要求的是「文档与实现**逐字一致**」的**方向性**一致（文档出现者须与实现相符），非「实现条目须尽数列出」 |
| 3 | 独立探针发现 `downloadPackage` 的 `fallbackRef` 形参被 `void fallbackRef;`（与 IN-03 同一物）—— 重试实际发生在调用方 `ai-manager.previewSkillImport` | code-clarity | 已由 IN-03 记录，此处仅补充 verifier 的独立确认 |

### Gaps Summary

**无 gaps。**

逐层判决（Step 9 决策树，按最严格优先）：

1. **FAILED truth / MISSING·STUB artifact / NOT_WIRED key link / blocker anti-pattern** —— **无一命中**。29 条 must-have truth 全部 VERIFIED；两条 backstop truth 由带正命题的真实渲染属性测试（52 项断言，verifier 恒等复跑）满足；8 条行为依赖型 truth 各自有**真跑**的行为测试，无一靠符号存在性过关。
2. **人类验证项** —— **命中**（4 项，见 `human_verification`）。真实 GitHub 端到端成功路径、真实 403/429 限流文案、32 MiB 上传的本机耗时/内存峰值，全部由 `51-VALIDATION.md` 的 Manual-Only 表**如实登记为「仍未跑」**，verifier 予以确认而非替其背书；外加 UAT 只覆盖单一窗口尺寸档这一残余人工面。

⇒ **status: `human_needed`**（自动化面全绿，等待人工验证）。

**关于 CR-01 的边界说明（供决策）**：CR-01 是本阶段唯一被独立复现的**用户可见缺陷**，但它不落在任何 must-have truth 上（51-04 的句柄 truth 只要求三态「明确码 + 可读原因」，该条成立），且已按项目既定裁决记入 `51-REVIEW.md` 作技术债 ⇒ verifier **不**将其计为本阶段的 gap。若维护者认为「重复预览后无法自救济」应视为目标未达成，可将 CR-01 提升为 gap 并走 `/gsd-plan-phase 51 --gaps`；本条留给人类决定。

---

_Verified: 2026-09-15T10:04:01Z_
_Verifier: Claude (gsd-verifier)_

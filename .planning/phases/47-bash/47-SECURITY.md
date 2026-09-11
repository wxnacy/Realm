---
phase: "47"
slug: "bash"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-11"
---

# Phase 47 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> **Phase scope**：内置技能播种（随包 `skills-builtin/` → `managed-skills/`）+ bash 包管理器安装档。
> **归属安全门禁**：**P1**（S1，阻断）随包分发 RCE 说明书 / npx 白名单永久免确认 —— 由 T-47-01-01 + T-47-02-01 + T-47-05-01 三条共同闭合；
> **P10**（发布门禁）内置技能许可证归属义务 —— 由 T-47-03-04 / T-47-03-05 闭合。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 随包 `skills-builtin/**` → 播种模块 | git 追踪的纯文本静态资源 → `managed-skills/`（沙箱 root 内，app-owned） | 技能正文 / LICENSE；不涉敏感数据 |
| `resolveBuiltinSkillsSrc()` → 打包态路径解析 | `app.isPackaged` 分支到 `process.resourcesPath/app.asar.unpacked/skills-builtin`，开发态回落 `__dirname` | 路径字符串 |
| 模型 → `evaluateBashCommand`（bash 工具） | LLM 生成的命令字符串进入三档策略引擎 | 命令字符串（不可信输入） |
| `settings.aiBashWhitelist` → 免确认判定 | 用户配置的字符串数组参与 `matchesWhitelist` 前缀匹配 | 用户配置 |
| `verdict` → 确认卡片（UI）→ 用户 | 判定结果与文案经 IPC 广播给渲染进程 | 风险等级 / 家族名 / 文案 |
| bash 子进程 → 宿主机 | 确认后以用户全权限执行；**二次 spawn 不在策略视野** | 任意命令 |
| `build.files` / `asarUnpack` → 分发产物 | 仓库工作树 → `.app` 内的 asar / unpacked | 源码、文档、测试、开发期配置 |
| 用户 Python 环境 / `REALM_SKILL_CREATOR_PYTHON` → `check_env.mjs` | 用户控制的环境变量决定 python 解释器路径 | 解释器路径 |
| 上游仓库（GitHub，固定 SHA）→ 快照 + 归属声明 | 上游文件逐字节快照 + `THIRD_PARTY_NOTICES.md` | 第三方代码与许可证 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-47-01-01 | Elevation of Privilege | `skills-builtin/find-skills/SKILL.md` 文本 | high | mitigate | 零安装改写（正文无可执行安装路径，检索只走 `web_fetch` 工具层）+ 显式禁令段 + 二段式静态扫描（第 1 段零容忍）+ 反向验证。**P1 门禁第一半** | closed |
| T-47-01-02 | Tampering | `resolveBuiltinSkillsSrc()` 路径解析 | high | mitigate | `builtin-skills-seeder.js` 内 `app.isPackaged` → `process.resourcesPath/app.asar.unpacked/skills-builtin`，开发态回落 `__dirname`；`package.json` `asarUnpack` 含 `skills-builtin/**`（两侧成对） | closed |
| T-47-01-03 | Denial of Service / Tampering | 播种中断留半成品技能 | medium | mitigate | `safeCopyDir` tmp → bak → rename → rollback，tmp 与目标同父目录（同卷）；`_cleanupDir` 自身吞错 | closed |
| T-47-01-04 | Tampering | 随包源被投毒（symlink 指向工作区外） | medium | mitigate | 遍历遇 symlink **fail-closed**（`isSymbolicLink`）→ 产诊断并跳过该技能 | closed |
| T-47-01-05 | Information Disclosure | 播种诊断泄露环境细节 | low | mitigate | 诊断字段限定 `level`/`code`/`message`/`path`/`skillName`；不拼接环境变量值 | closed |
| T-47-01-06 | Elevation of Privilege（间接） | 手改内置技能被静默抹掉的心理模型 | low | mitigate | 覆盖前一律产 `realm_builtin_seed_overwritten`（warning）并指明正确定制通道（`skills/` 同名遮蔽）；语义写入 `docs/product/ai-skills.md` | closed |
| T-47-01-SC | Tampering | npm / 依赖安装 | medium | mitigate | 本计划零新增依赖；未执行任何安装命令 | closed |
| T-47-02-01 | Elevation of Privilege | 安装命令经白名单永久免确认 | high | mitigate | `install` 短路**先于** `matchesWhitelist`；`reason === 'install'` 必经 confirm 且 `riskLevel: 'high'`；白名单含 `npm *` 时 `npm i x` 仍 confirm 的断言 + 反向验证。**P1 门禁第二半** | closed |
| T-47-02-02 | Elevation of Privilege | `postinstall` 隐式代码执行（`npm ci`） | high | mitigate | `npm ci` 计入安装档；理由写入 `PACKAGE_MANAGER_INSTALL_PATTERNS` JSDoc 与 `docs/product/ai-agent-workspace.md` | closed |
| T-47-02-03 | Elevation of Privilege（间接） | 误伤驱动白名单扩大 | high | mitigate | 命令名 + 子命令粒度判定；≥14 条只读反例表驱动断言，实测 0 误伤 | closed |
| T-47-02-04 | Elevation of Privilege（残余） | 命令替换 / 变量间接绕过检测 | medium | accept | 无技术缓解（静态启发式边界）；这类形态**也不命中白名单前缀** → 仍走 `confirm/default` 卡片 | closed |
| T-47-02-05 | Spoofing | 确认卡片文案被拉平 | low | mitigate | `ai-manager.js` install 分支专属 title `AI 请求安装第三方软件包` + 专属 `dangerHint`（点名家族 + 白名单不豁免），源码扫描断言锁定 | closed |
| T-47-02-06 | Tampering | 安装档并入 `DANGEROUS_PATTERNS`（语义塌陷） | low | mitigate | `reason` 分 `'install'` / `'danger'`，`strictEqual` 断言锁定；`npx` / `uvx` 不进 `DANGEROUS_INTERPRETERS` | closed |
| T-47-02-SC | Tampering | npm / 依赖安装 | medium | mitigate | 零新增依赖 | closed |
| T-47-03-01 | Elevation of Privilege | `skills-builtin/**` 文本含安装处方 | high | mitigate | 第 1 段零容忍扫描覆盖两技能全部 `SKILL.md` / `LICENSE.txt` + 反向验证；`check_env.mjs` 的禁装声明走第 2 段行级豁免 | closed |
| T-47-03-02 | Elevation of Privilege | `REALM_SKILL_CREATOR_PYTHON` 指向恶意程序 | medium | accept | 该变量由**用户自己**设置（用户控制自己的环境）→ 不构成漏洞；`check_env.mjs` 只做非空形态校验，设计选择已文档化 | closed |
| T-47-03-03 | Elevation of Privilege（残余） | 二次 `spawn` 不在 bash 策略视野 | medium | accept | 静态策略固有边界；用户确认的是第一条命令（`node … check_env.mjs`，`node` ∈ `DANGEROUS_INTERPRETERS` → 强制确认卡片），二次调用由该次确认承担 | closed |
| T-47-03-04 | Spoofing / Tampering | 上游快照被静默篡改 | medium | mitigate | 固定 SHA（非 HEAD）`b0cbd3df…` / `773fb2c7…`；逐文件字节数核对；`LICENSE.txt` 精确 11,357 B；`THIRD_PARTY_NOTICES.md` 的 SHA 由测试逐字断言 | closed |
| T-47-03-05 | Repudiation | 归属声明不实 | medium | mitigate | 两技能一律标 `modified`（fail-safe）；`SKILL.md` 文首带 Apache-2.0 §4(b) 修改声明并点名来源 SHA；测试断言文档**不出现** `unmodified` 且五要素齐备 | closed |
| T-47-03-06 | Tampering | `check_env.mjs` CLI 参数被静默忽略 | low | mitigate | 未知 `--capability` / `--package` / `--command` → `unknown_requirement` + 非零退出（ASVS V5），实跑断言锁定 | closed |
| T-47-03-07 | Information Disclosure | 平台专有内容误导模型行为 | low | mitigate | 三处平台专有章节删除（`present_files` 命中数为 0，标题清单无 `Claude.ai-specific` / `Cowork-Specific`）；改动记入归属说明。**两处环境条件性 Cowork 提及按计划禁令逐字保留**（`WINDOWS.md` id 16 登记） | closed |
| T-47-03-SC | Tampering | npm / 依赖安装 | high | mitigate | 零新增 npm 依赖（Python 依赖是用户环境的包，不进 `package.json`）；`skills-builtin/**` 是纯文本静态资源 | closed |
| T-47-04-01 | Information Disclosure / Elevation of Privilege | `build.files` 缺失致 `.planning/research/PITFALLS.md`（含逐字 `npx skills add -g -y`）随包 | high | mitigate | 11 条 `!` 排除项（实测清单驱动）+ 改前/改后 asar 清单对比；实测 `.planning`/`tests`/`scripts` 条目数为 0、无 `*.bak`。**P1 门禁在分发面的旁路** | closed |
| T-47-04-01b | Tampering（未来回归） | 加正向 allowlist 使 `!` 排除静默失效 | high | mitigate | 断言 `build.files` **每一项都以 `!` 开头**；前提同时写入 `AGENTS.md` 维护约定与 SUMMARY（三处落点） | closed |
| T-47-04-02 | Tampering | 排除项波及 `skills-builtin/**` / `THIRD_PARTY_NOTICES.md` | high | mitigate | 选最小 `!` 排除（保留默认包含语义）；改后清单断言三者（两个 `SKILL.md` + `THIRD_PARTY_NOTICES.md`）在列 + 配置级「无排除项命中」断言 | closed |
| T-47-04-03 | Denial of Service | `make install` 删掉在运行的 `/Applications/Realm.app` | high | mitigate | 人工前置 `pgrep` + 由用户自行退出；清理只按自身 PID；禁止路径模式 `pkill`；优先 `make install-nightly`。执行记录见 `47-04-SUMMARY.md`（生产实例 PID 25922 全程存活） | closed |
| T-47-04-04 | Spoofing | 「开发态跑通」当作「打包态可用」 | high | mitigate | D-12 明文禁止用 `npm run dev` 替代；Task 3 在真实 Nightly `.app` 实测（unpacked 路径 / 播种结果 / 零诊断 / 幂等 / 自愈）；UAT Test 2 + Test 4 复核 | closed |
| T-47-04-05 | Repudiation | 文档与实现不一致 | medium | mitigate | 三份文档同步 + 文本断言（口径一致，均不含「四档」）；`settings.aiBashWhitelist` 语义在 §五显式复核 | closed |
| T-47-04-06 | Tampering | 文档暗示 `allowed-tools` 会被强制（虚假安全感） | medium | mitigate | 三份文档均含 `allowed-tools` 与免责语义（`不被强制` / `不强制` / `仅供参考`；`ai-skills.md` 另写明 SDK `Skill` 接口无该字段）；测试断言三份文档齐备 | closed |
| T-47-04-SC | Tampering | npm / 依赖安装 | medium | mitigate | 零新增依赖（`make install-nightly` 触发 electron-builder 构建但不安装新包） | closed |
| T-47-05-01 | Elevation of Privilege | `matchInstall` 子命令黑名单被词法改写绕过 | **critical** | mitigate | 改为**默认拒绝**：首 token 命中 `PACKAGE_MANAGER_TOOLS`（15 项）且子命令不在显式只读清单 → 强制确认；12 条 shell 等价形态各有断言 | closed |
| T-47-05-02 | Elevation of Privilege | 引号 / 反斜杠造成白名单前缀漏检 | high | mitigate | `stripShellQuoting` 判定前抹平词法噪音；断言用「`matchesWhitelist === true` **且** `level === 'confirm'`」钉死结论 | closed |
| T-47-05-03 | Elevation of Privilege | 真实安装子命令不在黑名单 | high | mitigate | 默认拒绝规则**结构性**覆盖（非显式只读即强制确认）；逐条断言 + P1-b 家族表 | closed |
| T-47-05-04 | Elevation of Privilege | 白名单 `*` 使 `matchesWhitelist` 全放行（REVIEW WR-01） | high | mitigate | `validateWhitelistList` 拒绝空前缀条目 + `matchesWhitelist` 跳过空前缀（双道防御）；`cat ~/.ssh/id_rsa` 等断言为 `confirm` | closed |
| T-47-05-05 | Elevation of Privilege（残余） | 变量间接 / 命令替换 / 大小写形态 | medium | accept | 无技术缓解（静态启发式边界）；这些形态不命中白名单前缀 → 仍走 `confirm/default` 卡片；大小写形态仅**降级为普通风险卡片**（REVIEW WR-05），已在三份文档残余段如实记录 | closed |
| T-47-05-06 | Spoofing | 只读清单放宽重新打开绕过面 | medium | mitigate | 只读准入判据（不取新代码 **且** 不执行第三方代码）写进 JSDoc；逐条自查后对 `init` / `audit` 形态化；表驱动断言要求每条清单项都降级 | closed |
| T-47-05-07 | Tampering | 文档与实现漂移（虚假保证） | medium | mitigate | 文档断言机械可检（关键子串 + 用例数与实跑一致）；`AGENTS.md` 新增维护约定；`ai-manager.js` 只读核验留痕 | closed |
| T-47-05-08 | Elevation of Privilege | 只读豁免侧反向击穿（空捕获组全放行 / 旗标吞子命令 / 纵深裸条目遮蔽只读清单） | **critical** | mitigate | 四条护栏 + 逐条断言：① 空 `readOnly` 工具不构造动词式正则（`readOnlyRes.length === 0`、全表无空捕获组）；② **纵深优先**（工具命中后先跑既有安装表）；③ 只读词条形态化；④ 纵深层条目动词限定（pipx）⇒ `pipx list` 只读、`pipx install black` 安装（双侧断言 + 反向验证） | closed |
| T-47-05-09 | Elevation of Privilege（残余，结构性） | 旗标取值与子命令词法不可区分 | medium | accept | 无技术缓解而不破坏历史锁定负例（`pnpm --filter a run build === null`）；缓解 = 纵深优先收回可识别形态，剩余面在 `⑦-e` 与三份用户文档具名记录并钉双侧对照断言 | closed |
| T-47-05-SC | Tampering | npm / 依赖安装 | low | mitigate | 零新增依赖 | closed |
| T-47-06-01 | Tampering | 崩溃残留 `.tmp_*` / `.bak_*` 被加载成幽灵技能 | medium | mitigate | `sweepSeedResidue` 在逐技能循环前清扫锚定 `\.(tmp\|bak)_\d+$` 的目录；主用例走真实 `refreshSkills()` 断言技能集无残留条目且零诊断 | closed |
| T-47-06-02 | Denial of Service / Tampering | 每启动一次的 `rename` 空窗 + 白算 sha256 | medium | mitigate | `diff === 'same'` 时 `continue`（不写盘、不产诊断）；inode 稳定性断言把「未重建」变成机械证据 | closed |
| T-47-06-03 | Repudiation / Information Disclosure | 播种整体失败在正式版零痕迹（nodejieba 事故同型） | medium | mitigate | `_flushDiagnostics()` 在 `finally` 按级别输出且**覆盖早退路径**；顶层 `catch` 的 `console.error` 保留；五条用例各钉一条路径 + 零噪声反例 + 两次反向验证 | closed |
| T-47-06-04 | Tampering | 清扫正则过宽误删合法目录 | medium | mitigate | 正则锚定 `\.(tmp\|bak)_\d+$`（与 `Date.now()` 命名成对）；反例目录分两层（`not-residue/` 进零诊断断言；含 `.`/`_` 的名字进独立文件系统断言）；源码断言禁止裸 `includes('.tmp_')` | closed |
| T-47-06-05 | Tampering | `detectDiff` 的 size / sha256 层被目录条目污染 | medium | mitigate | 目录标记 + 文件过滤双层；`endsWith('/')` 过滤在源码中显式存在；「两层嵌套子目录 → same」用例护栏 | closed |
| T-47-06-06 | Denial of Service | 清扫 / console 输出引入 throw 阻断启动 | low | mitigate | 清扫复用 `_cleanupDir`（吞错）+ `readdirSync` 包 try/catch；`_flushDiagnostics` 只读内存数组；四条 console 用例以 `assert.doesNotThrow` 包裹 | closed |
| T-47-06-SC | Tampering | npm / 依赖安装 | low | mitigate | 零新增依赖 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (`high`) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**汇总：47 条威胁 —— `mitigate` 42 条全部 closed（L1 grep 深度 + 283 例断言实跑）；`accept` 5 条全部 closed 并记入下方 Accepted Risks Log；`threats_open = 0`。**

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-47-01 | T-47-02-04 | 命令替换 / 变量间接绕过 `install` 检测无技术缓解（静态启发式固有边界，`ai-bash-policy.js` 诚实边界声明）。严重性有限：这些形态**也不命中白名单前缀** → 仍弹 `confirm/default` 卡片；已有 `matchesWhitelist('\`npm i x\`', ['npm *']) === false` 断言佐证 | 用户（47-02 计划期 Decision） | 2026-09-11 |
| AR-47-02 | T-47-03-02 | `REALM_SKILL_CREATOR_PYTHON` 由用户自己设置 = 用户授权 Realm 执行该路径的程序，非远程输入；`check_env.mjs` 只做非空形态校验，不校验路径合法性（设计选择，已文档化） | 用户（47-03 计划期 Decision） | 2026-09-11 |
| AR-47-03 | T-47-03-03 | 技能脚本内部的二次 `spawn`（`check_env.mjs` → python）不在 bash 策略视野。用户确认的是第一条命令（`node` ∈ `DANGEROUS_INTERPRETERS` → 强制确认卡片），二次调用由该次确认承担；诚实边界已写入产品文档 | 用户（47-03 计划期 Decision） | 2026-09-11 |
| AR-47-04 | T-47-05-05 | 变量间接 / 命令替换 / 大小写形态无技术缓解（与 `ai-bash-policy.js` 的「诚实边界」定位一致）。已断言这些形态**不命中白名单前缀** → 仍走 `confirm/default`；大小写形态仅降级为普通风险卡片（REVIEW WR-05 未修），三份文档残余段如实记录 | 用户（47-05 计划期 Decision + 用户 2026-08-04 技术债决策） | 2026-09-11 |
| AR-47-05 | T-47-05-09 | 旗标取值与子命令词法不可区分：`npm -g <未知动词> <只读同名词>` 仍可能判只读。**不修**是因为修复会破坏历史锁定负例 `pnpm --filter a run build === null`（P1-b-3 与 47-02 的 34 条只读断言）。该形态需「旗标 + 未知动词 + 名为只读动词的包名」三件事同时成立，且**改前亦为 `null`（无回归）**；已在 `⑦-e` 与三份用户文档具名记录并钉双边对照断言 | 用户（47-05 计划期 Decision） | 2026-09-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-11 | 47 | 47 | 0 | orchestrator（`/gsd-secure-phase 47`，asvs_level=1 / block_on=high，L1 grep 深度核验 + 4 条断言组实跑 283 例） |

### 核验证据（L1 grep 深度）

- **断言组实跑**：`tests/test-builtin-skills-seeder.js` 101/101、`--test tests/test-ai-bash-policy.js` 97/97、`tests/test-ai-skills.js` 64/64、`tests/test-agent-workspace.js` 21/21 —— **合计 283 例 0 fail**（覆盖 SEED-03/SEED-04 零安装扫描、P1-a/P1-b 门禁信号、D-16 只读反例、白名单不可越过安装档、install 短路先于白名单）。
- **逐条 grep 核验**：42 条 `mitigate` 威胁的缓解标记全部命中（`app.isPackaged` / `asar.unpacked` / `safeCopyDir` / `isSymbolicLink` / `realm_builtin_seed_overwritten` / `PACKAGE_MANAGER_INSTALL_PATTERNS` / `PACKAGE_MANAGER_TOOLS` / `stripShellQuoting` / `readOnlyRes` / `validateWhitelistList` / `matchesWhitelist` / `sweepSeedResidue` / `_flushDiagnostics` / `_cleanupDir` / `endsWith('/')` / 固定 SHA 两处 / `AI 请求安装第三方软件包` / `unknown_requirement` / 11 条 `!` 排除项 / 三份文档的 `allowed-tools` 免责），唯一初判 FAIL 为 **核验模式过窄**（`ai-skills.md` 用「不强制 + 虚假安全感」表达同一语义，测试断言口径为 `不被强制|不强制|仅供参考`），修正后三份文档均齐备。
- **UAT 交叉佐证**（`47-UAT.md`，38/38 pass）：Test 4 实测打包产物内 `THIRD_PARTY_NOTICES.md` 与仓库源 sha256 全等、两个 `LICENSE.txt` 全等、五要素齐备；Test 5 逐句评审 607 行未发现安装语义；Test 6 三处被禁平台标题命中 0。
- **短路口径**：`register_authored_at_plan_time = true`（6 份 PLAN 全部含可解析 `<threat_model>` 块）且 `asvs_level == 1` 且 `threats_open == 0` → 按 secure-phase 工作流 §3 短路规则免派审计子代理（L1 grep 深度充分）。
- **代码审查交叉引用**：`47-REVIEW.md` 的 Critical/ Warning 项已由 47-05 / 47-06 两个 gap-closure 计划闭合（REVIEW WR-01 即 T-47-05-04，已修）；剩余具名残余即上表 5 条已接受风险。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-11

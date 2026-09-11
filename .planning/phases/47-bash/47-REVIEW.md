---
phase: 47-bash
reviewed: 2026-09-11T11:47:50Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - AGENTS.md
  - THIRD_PARTY_NOTICES.md
  - ai-bash-policy.js
  - ai-manager.js
  - builtin-skills-seeder.js
  - docs/product/ai-agent-workspace.md
  - docs/product/ai-skills.md
  - main.js
  - package.json
  - skills-builtin/find-skills/LICENSE.txt
  - skills-builtin/find-skills/SKILL.md
  - skills-builtin/skill-creator/LICENSE.txt
  - skills-builtin/skill-creator/SKILL.md
  - skills-builtin/skill-creator/agents/analyzer.md
  - skills-builtin/skill-creator/agents/comparator.md
  - skills-builtin/skill-creator/agents/grader.md
  - skills-builtin/skill-creator/assets/eval_review.html
  - skills-builtin/skill-creator/eval-viewer/generate_review.py
  - skills-builtin/skill-creator/eval-viewer/viewer.html
  - skills-builtin/skill-creator/references/schemas.md
  - skills-builtin/skill-creator/scripts/__init__.py
  - skills-builtin/skill-creator/scripts/aggregate_benchmark.py
  - skills-builtin/skill-creator/scripts/check_env.mjs
  - skills-builtin/skill-creator/scripts/generate_report.py
  - skills-builtin/skill-creator/scripts/improve_description.py
  - skills-builtin/skill-creator/scripts/package_skill.py
  - skills-builtin/skill-creator/scripts/quick_validate.py
  - skills-builtin/skill-creator/scripts/run_eval.py
  - skills-builtin/skill-creator/scripts/run_loop.py
  - skills-builtin/skill-creator/scripts/utils.py
  - tests/test-ai-bash-policy.js
  - tests/test-builtin-skills-seeder.js
findings:
  critical: 1
  warning: 8
  info: 3
  total: 12
status: issues_found
highest_severity: critical
---

# Phase 47: Code Review Report

**Reviewed:** 2026-09-11
**Depth:** standard
**Files Reviewed:** 32（9 自研/文档 + 2 技能入口 + 17 上游逐字快照 + 1 自研探针 + 2 测试 + LICENSE）
**Baseline used for diff:** `edbeff5dae4142189fba115bc626632a1e75eefd^`（与 config 一致；diff 含 47-01..47-04 全部提交，`git diff --stat` 32 文件 / +9733 −23）
**Status:** issues_found（**1 条 Critical**；最高严重度 Critical）

## Summary

本阶段交付两块内容：**内置技能播种**（`builtin-skills-seeder.js` 新增、`main.js` 调用位、`package.json` 打包配置）与 **bash 包管理器安装档**（`ai-bash-policy.js` 新增第三档第二触发源、`ai-manager.js` 确认卡片三分支、三份文档同步、两份测试扩充）。

**对抗式验证的结论分两半：**

- **播种侧实现质量高，核心契约经实测成立**。我独立复核了全部关键断言而非只读断言：`detectDiff` 的四层短路与 IO fail-safe、`safeCopyDir` 的原子替换与 symlink fail-closed、`main.js` 的调用位序（`migrateAiMemory()` → `seedBuiltinSkills()` → `new AIManager()`）、`package.json` 的 `asarUnpack` 成对性均在源码与运行结果中成立。**上游快照的逐字性我也做了独立取证**（见下「独立取证」），17/17 文件与上游固定 SHA 逐字节相同 —— SEED-01 / SEED-05 的这部分是干净的。打包面我用现存的 `dist/mac-arm64/Realm Nightly.app/Contents/Resources/app.asar` 直接读 asar 清单复核：`.planning` / `.claude` / `.gsd` / `.wzsh` / `.zcode` / `test` / `tests` / `scripts` 各 0 条、`*.bak` 0 条、`skills-builtin/` 21 条在列、`THIRD_PARTY_NOTICES.md` 在列 —— 47-04 的排除项与 asarUnpack 生效。
- **bash 策略侧存在一条 Critical**：安装档可以被**纯词法改写**绕过，且在**文档推荐的**白名单配置下绕过结果是 `allow`（**完全不弹卡片、直接执行**）。这条直接推翻了三份文档 + 代码注释共同声明的「白名单不可越过安装档」与「本表漏判永远只会退化成普通确认卡片」不变式。剩下 8 条 Warning 集中在播闭幕的残留物与静默失败路径、大小写敏感漏判、以及两份文档/归属声明的准确性上。

**独立取证（不只是复述测试结论）：**

| 取证项 | 方法 | 结果 |
|--------|------|------|
| skill-creator 17 个上游文件逐字性 | 从 `raw.githubusercontent.com/anthropics/skills@b0cbd3df…` 下载 17 文件后逐文件 sha256 比对本地 | **17/17 SAME**（含 `eval-viewer/viewer.html` 44,998 B、`LICENSE.txt` 11,357 B） |
| 两个固定 SHA 与时点 | GitHub API `commits?path=<file>&per_page=1` | find-skills `773fb2c7…` / 2026-07-10 ✅、skill-creator `b0cbd3df…` / 2026-03-06 ✅（与归属声明逐字一致） |
| 上游 `SKILL.md` 字节数 33,168 | `curl` 上游文件 `wc -c` | 33,168 ✅（测试区间 [30000,40000] 与注释口径自洽） |
| 零安装语义靶心 | 独立 regex 扫全 `skills-builtin/**` | 无 `npx skills` 变体；`skills-builtin/**` 内无 `curl\|sh`、无包管理器安装形态 ✅（`docs/**` 亦无 —— docs 随包） |
| 打包面 | 读现存 asar 头部目录 JSON | 见上 ✅ |
| 播种残留 → 幽灵技能 | 直接构造 `.bak_<ts>` / `.tmp_<ts>` 后跑 `refreshSkills` | **残留被当成技能加载**（WR-02，实证） |
| 无差异化覆盖 | 连续两次播种比对 inode/mtime | **内容 same 仍整目录重建**（WR-03，实证） |

**影响面判断**：CR-01 的触发前提是「用户把裸包管理器名加进白名单」—— 而这是本阶段自己的文档给出的推荐做法（`docs/product/ai-agent-workspace.md §五`：「只加构建类可信命令（`npm run`、`git status`、`brew` 等）」）。因此它不是「需要用户乱配」的边缘假设，而是**推荐配置下的默认状态**。同理 WR-01（白名单里一个 `*`）会把除危险/安装档以外的全部命令变成免确认。

---

## Critical Issues

### CR-01: 安装档可被词法改写绕过 —— 白名单前缀下命令完全免确认执行（无卡片）

**File:** `ai-bash-policy.js:133-156`（`matchesWhitelist`）、`ai-bash-policy.js:289-305`（`stripLeadingQuotes` / `matchInstall`）、`ai-bash-policy.js:241-255`（`PACKAGE_MANAGER_INSTALL_PATTERNS`）、`ai-bash-policy.js:327-351`（`evaluateBashCommand`）；消费点 `ai-manager.js:5650-5685`

**Issue:** 白名单匹配（`matchesWhitelist`）对**原始文本**做命令前缀比对，而安装档匹配（`matchInstall`）对**同一段文本**做「命令名 + 空格 + 子命令字面量」的正则匹配。两者口径不同，于是任何**不改变首 token、但改变子命令词法形态**的写法都同时满足「命中白名单前缀」与「不命中安装档」→ 裁决落到 `4. 全部段命中白名单 → allow` → `ai-manager.js` 的 `if (verdict.level === 'confirm')` 不进入 → **命令直接执行，用户看不到任何卡片**。

实测（`node` 直调策略引擎，白名单取文档推荐形态）：

| 命令（真实执行语义） | 白名单 | 裁决 |
|---|---|---|
| `brew "install" wget` | `['brew']` | **allow（无卡片）** |
| `brew \install wget` | `['brew']` | **allow（无卡片）** |
| `brew ins""tall wget` | `['brew']` | **allow（无卡片）** |
| `npm "install" x` / `npm \i x` | `['npm']` | **allow（无卡片）** |
| `pip "install" x` | `['pip']` | **allow（无卡片）** |
| `cargo "install" ripgrep` | `['cargo']` | **allow（无卡片）** |
| `bun "add" x` | `['bun']` | **allow（无卡片）** |
| `brew install wget`（对照） | `['brew']` | confirm/install ✅ |

第二种绕过家族**不需要任何引号/转义**，只需在命令名与安装动词之间插一个 token（`matchesWhitelist` 只看前缀，安装档是「命令名后紧跟子命令」的**黑名单**，因此任何中间 token 都会击穿它）：

| 命令 | 白名单 | 裁决 | 说明 |
|---|---|---|---|
| `npm update` / `npm rebuild` | `['npm']` | **allow** | 会拉新版本 / 执行依赖生命周期脚本 |
| `yarn workspace app add lodash` | `['yarn']` | **allow** | 真实且常用的联网安装 |
| `cargo add serde` | `['cargo']` | **allow** | 联网取依赖 |
| `go get github.com/x/y` | `['go']` | **allow** | 联网取模块 |
| `brew cask install wget` | `['brew']` | **allow** | 中间 token `cask` 击穿 |

**为什么这是 Critical 而不是「已知的启发式边界」：**

1. 它**不是漏检后降级为普通确认卡片**——这是文档与代码注释反复声明的兜底性质。`ai-bash-policy.js:233` 原文：「本表漏判永远只会退化成普通确认卡片」；`docs/product/ai-skills.md §九`：「**漏检 ≠ 免确认** —— 未被识别的形态仍会退化成普通确认卡片，不会免确认」。上述形态**一律 allow**，一个字都不弹。这条不变式的成立前提是「漏检形态也不命中白名单」，而白名单是**文本前缀**匹配，任何纯词法改写都保留前缀 —— 前提不成立。
2. 三份文档与 `AGENTS.md` 都把「白名单不可越过安装档」当作 P1 门禁的机械结论（`AGENTS.md:261`、`docs/product/ai-agent-workspace.md` §四⑨、`docs/product/ai-skills.md` §九）。
3. 本阶段已经识别出这一**类**问题的一半并处理了 —— `stripLeadingQuotes`（`ai-bash-policy.js:289`）就是为 `'npm' i x` 形态加的；但对称的另一半（子命令侧引号、反斜杠转义、引号拼接）没有处理，说明这是**遗漏而非设计选择**。
4. 绕过成本极低：一次字符插入即可，且对读得懂技能文本/文档的模型（甚至被提示注入的模型）是显式可得的路径。

**Fix:** 单一修法可同时覆盖两个家族 —— 把安装档从「子命令黑名单」改为「**首 token 是包管理器 → 默认强制确认；只有显式只读子命令白名单才降级**」，并在匹配前做一次**与白名单共用的规范化**（去引号 + 去反斜杠转义），使两侧口径一致：

```js
// 1) 两侧共用的规范化（提到 normalizeSegment 之外的独立函数，避免动既有 32 例断言）
function stripShellQuoting(seg) {
  // 去掉词法层噪音：\' " 反斜杠转义 → 但保留独立 token 分隔
  return normalizeSegment(seg).replace(/\\(?=\S)/g, '').replace(/['"]/g, '');
}

// 2) 包管理器首 token 表 + 只读子命令允许表（默认拒绝，而不是默认放行）
const PACKAGE_MANAGER_TOOLS = new Set(['npm', 'npx', 'pnpm', 'yarn', 'bun', 'bunx',
  'pip', 'pip3', 'pipx', 'python', 'python3', 'uv', 'uvx',
  'brew', 'cargo', 'go', 'gem']);

function matchInstall(seg) {
  const n = stripShellQuoting(seg);              // ← 与 matchesWhitelist 同一口径
  const tokens = n.split(' ').filter((t) => t && !t.startsWith('-') && !/^[A-Za-z_]\w*=/.test(t));
  const tool = tokens[0] && tokens[0].split('/').pop();
  if (tool && PACKAGE_MANAGER_TOOLS.has(tool)) {
    const sub = tokens[1] || '';
    if (!READ_ONLY_SUBCOMMANDS[tool]?.has(sub)) return `包管理器操作（${tool} ${sub || '(无子命令)'}）`;
  }
  for (const { pattern, name } of PACKAGE_MANAGER_INSTALL_PATTERNS) { /* 既有表保留作纵深 */ }
  return null;
}
```

同时把 `matchesWhitelist` 的口径也切到 `stripShellQuoting`（否则 `brew "install" wget` 仍会命中 `brew` 前缀 —— 但只要安装档先短路就不再有安全后果；不过为消除歧义建议两侧一致）。**回归影响**：`tests/test-ai-bash-policy.js` 的只读反例表（`READONLY_NEGATIVES`）与 34 条只读断言正是这套「默认拒绝」规则的现成护栏，改造后应全绿；`npm run dev` / `brew info` / `pip list` / `uv --version` 必须继续不命中。

**若判定「本阶段不改」**：至少必须把 `ai-bash-policy.js:230-237` 的 ⑦-b 段与三份文档里的「漏检 ≠ 免确认 / 白名单不可越过」改成有前提的表述（区分「未命中白名单的漏检」与「命中白名单前缀的漏检」），并新增一条钉住实际行为的断言，否则文档在给用户虚假的保证。

---

## Warnings

### WR-01: 白名单条目 `*` 被校验通过，`matchesWhitelist` 立刻退化为「全放行」

**File:** `ai-bash-policy.js:143-150`（空前缀分支）、`ai-bash-policy.js:358-374`（`validateWhitelistList`）；入口 `src/settings-page.js:2841-2871`

**Issue:** 条目 `'*'` 走 `e.endsWith('*')` 分支 → `e.slice(0, -1)` 为 `''` → `n.startsWith('')` 恒真，于是**所有段**命中白名单。`validateWhitelistList(['*'])` 返回 `{valid:true}`（非空字符串、≤200、无控制符），设置页 tag 输入也没有额外校验（`settings-page.js:2846-2857` 只挡空串/超长/控制符）。实测：

```
['*']  "cat ~/.ssh/id_rsa"                 → allow（无卡片）
['*']  "curl -o /tmp/x http://e.com/x"     → allow（无卡片）
[' *'] "cat ~/.ssh/id_rsa"                 → allow（无卡片）
```

危险档/安装档仍会拦（`rm -rf /` → danger、`npm i x` → install），所以安全边界没被整体拆除；但**「不要加 `cat`/`less` 这类通用命令」这条文档警告被一个字符作废** —— 用户输入 `*` 后，所有非危险、非安装命令（含任意文件读取、任意网络下载落盘、`ssh`）全部免确认，且 UI 不会有任何提示。

**Fix:** 在 `validateWhitelistList` 与设置页同时拒绝「通配符前无字面 token」的条目：

```js
if (v.replace(/\*+$/, '').trim() === '') {
  return { valid: false, reason: '白名单条目必须是具体命令前缀，不支持单独使用 *' };
}
```

`matchesWhitelist` 侧再加一道防御：`const prefix = e.slice(0, -1); if (prefix.trim() === '') continue;`

### WR-02: 播种残留（`.tmp_*` / `.bak_*`）永不回收，且落在技能扫描根内 → 被加载成「幽灵技能」

**File:** `builtin-skills-seeder.js:254-285`（`safeCopyDir` 的 tmp/bak 命名与清理）、`builtin-skills-seeder.js:360-386`（循环内无残留清扫）

**Issue:** tmp/bak 目录由 `dst` 派生（`${dst}.tmp_<ts>` / `${dst}.bak_<ts>`，同父目录以保证同卷 —— 这是刻意设计），因此它们**落在 `managed-skills/` 扫描根内**。`_cleanupDir` 是 best-effort（`catch {}`），且**没有任何启动清扫**。一旦出现下列任一情形，残留会被 `aiSkills.refreshSkills()` 当成独立技能：

- 进程在 `rename(dst → bak)` 与 `rename(tmp → dst)` 之间退出（两次改名之间的窗口，SIGKILL / 崩溃 / 强制退出都可命中）；
- `_cleanupDir(bakDst)` 失败（EPERM 等）；
- 复制阶段崩溃留下的完整 `.tmp_*`（`SKILL.md` 已就位时）。

实测（构造残留后跑真实加载）：

```
加载到的技能：
  name=find-skills.bak_1700000000000        source=managed
  name=skill-creator.tmp_1700000000000      source=managed
diagnostics: invalid_metadata ×2（name 与目录名不一致）、realm_name_rewritten ×2
```

即：技能集里多出**永久存在、无法通过设置页删除**的幽灵条目（名字带时间戳），并伴随 4 条诊断噪声；`managed-skills/` 目录会随每次崩溃缓慢堆积垃圾目录。测试只断言了「成功/失败当次不留残留」，没有覆盖「上次崩溃留下的残留」。

**Fix:** 在 `seedBuiltinSkills()` 进入逐技能循环前做一次残留清扫（同父目录，天然同卷）：

```js
// 清掉上次崩溃遗留的 <name>.tmp_* / <name>.bak_*（它们落在扫描根内会被当成技能）
let stale = [];
try {
  stale = fs.readdirSync(managedDir).filter((n) => /\.(tmp|bak)_\d+$/.test(n));
} catch { /* managedDir 不存在时由下方 mkdirSync 处理 */ }
for (const name of stale) _cleanupDir(path.join(managedDir, name));
```

并补一条断言：预置 `managed-skills/find-skills.bak_<ts>/`（含 SKILL.md）后跑播种 → 该目录消失，且 `refreshSkills` 零诊断。

### WR-03: `detectDiff` 的结论不参与「是否覆盖」决策 —— 每次启动都整目录重建

**File:** `builtin-skills-seeder.js:364-376`

**Issue:** `diff` 只被用于决定要不要产 `realm_builtin_seed_overwritten`，`safeCopyDir(skillSrc, skillDst)` 在所有分支（`missing` / `different` **/ `same`**）都无条件执行。实测连续两次播种（第二次 `detectDiff === 'same'`）：

```
[a] SKILL.md inode:  171113209 -> 171113237  (变化 = true )
[a] SKILL.md mtime:  ...9833.7 -> ...9858.5  (变化 = true )
[a] 技能目录 inode:  171113208 -> 171113236  (变化 = true )
```

后果有两层：① `detectDiff` 最贵的一层（逐文件 sha256）在每次启动都白算，且注释里专门为「不用 mtime」写的护栏失去意义（反正 mtime 每次都会变，因为每次都重建）；② 每次启动都制造一次 rename 空窗（dst 先被改名为 bak，`SKILL.md` 短暂不可见），**这正是 WR-02 的触发源**。测试用例名「幂等：连续两次播种，第二次零差异零诊断，产物字节不变」只验证了字节与诊断，未验证「未重建」。另外 `detectDiff` 的 `listRelativeFiles` 不记录空目录，所以「same 时跳过复制」需同时把目录项纳入比较，否则源侧空目录的差异永远不会被自愈。

**Fix:**

```js
const diff = detectDiff(skillSrc, skillDst);
if (diff === 'same') continue;                     // 无差异 → 不自愈重建，不产诊断
if (diff === 'different') { /* 现有的 overwritten 诊断 */ }
safeCopyDir(skillSrc, skillDst);
```

（若要保留「空目录也能自愈」，在 `listRelativeFiles` 里对目录追加 `rel + '/'` 标记。）

### WR-04: 播种失败在运行时完全静默 —— 诊断无消费方、也不打日志

**File:** `builtin-skills-seeder.js:331-390`（诊断只入 `_diagnostics`）、`builtin-skills-seeder.js:397-399`（`getSeedDiagnostics`）、`main.js:4048`（调用点）

**Issue:** 文件头把失败策略写成「任何失败仅 `console.error` + 产诊断」，但**只有最外层 catch（:387-389）与 `detectDiff` 的 IO catch 打日志**。以下路径在正式版里一点痕迹都不留：

- `names.length === 0` → `realm_builtin_src_missing`（**源目录不存在 / asarUnpack 没生效 / `.app` 装歪**）→ push 诊断后 `return`；
- 单技能失败（symlink 拒收、复制失败）→ `realm_builtin_seed_failed` → push 诊断；
- 源子目录缺 `SKILL.md` → `realm_builtin_src_invalid`。

而 `getSeedDiagnostics()` 在**生产代码里没有任何调用方**（全仓 grep：只有 `builtin-skills-seeder.js` 自身与测试）。结果是：内置技能**一个都没播种成功**的正式版，与一切正常的正式版在用户侧与日志侧完全不可区分 —— 与 `builtin-skills-seeder.js:48-49` 自己引用的 nodejieba 事故（9a1ae11「漏一侧即在正式版静默失败」）同型。D-09 的「不静默」只在 API 层成立，没有到达任何可见面。

**Fix:** 循环结束后统一输出（保持「不打断启动」的契约，但让失败可见）：

```js
if (_diagnostics.length > 0) {
  for (const d of _diagnostics) {
    const line = `[Realm] 内置技能播种 ${d.level} ${d.code}: ${d.message}`;
    if (d.level === 'error') console.error(line); else console.warn(line);
  }
}
```

并明确记一条待办：Phase 50 把 `getSeedDiagnostics()` 接进技能面板/诊断通道之前，至少 `console` 兜底不能省。

### WR-05: 危险表与安装表区分大小写，而 macOS 解析不区分 —— `RM -rf` 降级为误导性中风险卡片

**File:** `ai-bash-policy.js:165-177`、`ai-bash-policy.js:241-255`（正则无 `i` 标志）、`ai-bash-policy.js:262-273`、`ai-bash-policy.js:298-305`

**Issue:** 所有模式表都对规范化后的原文做大小写敏感匹配，但 macOS 文件系统默认不区分大小写，shell 能解析大写命令名（实测：`command -v RM` → `/bin/RM`，`command -v SUDO` → `/usr/bin/SUDO`，`command -v LS` → `/bin/LS`）。因此：

```
"RM -rf /tmp/x"     danger=null  install=null  → confirm/default
"SUDO ls"           danger=null  install=null  → confirm/default
```

`RM -rf ~/Documents` 真的会删目录，但卡片是**中风险**、标题「AI 请求执行 Bash 命令」、提示「该命令未命中白名单」—— 与 `rm -rf` 的高风险提示「检测到高危操作（删除文件（rm）），白名单对本命令无效」形成误导性差异。`RM` 这类形态同时会绕过「危险词检测」的所有下游用途。安装档同理（`brew INSTALL wget` → 不判 install），只是 npm/brew 是否接受大写子命令未在本机验证，故只作为同源风险记录。

**Fix:** 在 `matchDangerous` / `matchInstall` 里对**小写副本**做匹配（不要动 `normalizeSegment` 的返回，避免影响 `matchesWhitelist` 的既有 32 例口径）：

```js
function matchDangerous(seg) {
  const n = normalizeSegment(seg);
  const lower = n.toLowerCase();
  for (const { pattern, name } of DANGEROUS_PATTERNS) if (pattern.test(lower)) return name;
  const cmdName = extractCommandName(lower);
  ...
}
```

### WR-06: `check_env.mjs` 的 capability → 依赖映射错误：声明了没人用的 `anthropic`，漏掉真正必需的 `claude` CLI

**File:** `skills-builtin/skill-creator/scripts/check_env.mjs:35-46`（`PACKAGE_SPECS`）、`:54-59`（`CAPABILITIES`）、`:68`（`KNOWN_COMMANDS`）；相关文档 `THIRD_PARTY_NOTICES.md:104-113`、`skills-builtin/skill-creator/SKILL.md:407-427`

**Issue:** `description-optimize` 被声明为需要 Python 包 `anthropic`，但**没有任何脚本 import anthropic**（全目录 grep `import anthropic` / `from anthropic` → 0 命中）；而它实际调用的 `scripts/run_loop.py` → `improve_description.py:_call_claude()` 硬依赖外部 `claude` CLI：

```python
cmd = ["claude", "-p", "--output-format", "text"]
result = subprocess.run(cmd, ...)   # FileNotFoundError if absent
```

`KNOWN_COMMANDS = ['node','python3']` 又把 `claude` 刻意排除（`--command claude` 返回 `unknown_requirement`）。后果是探针**给出假阳性**：在装了 `anthropic`、没装 `claude` CLI 的机器上 `node scripts/check_env.mjs --capability description-optimize` 返回 `ok: true, capabilities.status['description-optimize'].ok === true`，而 SKILL.md 的 `## Description Optimization` 第 3 步随即指导运行 `python -m scripts.run_loop …`，必在 `_call_claude` 崩掉。这与探针自己声明的「未知输入不得静默忽略 / 缺口不会静默」以及 `THIRD_PARTY_NOTICES.md §4`「capability 面已收缩为 4 组…依赖 `claude` CLI 的 run-eval / run-loop 两组已去掉」的口径都不一致（`description-optimize` 本身就是 run_loop 那条路径）。

**Fix:** 三选一并同步文档：① 把 `claude` 纳入 `KNOWN_COMMANDS` 并把 `description-optimize` 的 commands 设为 `['claude']`（如实报告缺失）；② 从 `CAPABILITIES` 删掉 `description-optimize`，并在 SKILL.md 该章写明「本技能不保证该路径可用」；③ 把 `python -m scripts.run_loop` 改为经 Realm 自身模型调用的路径。同时删掉未被任何代码使用的 `anthropic` 条目，并同步 `THIRD_PARTY_NOTICES.md §4` 的依赖表述。

### WR-07: `find-skills/LICENSE.txt` 的版权行与上游现已发布的 LICENSE 不一致；`THIRD_PARTY_NOTICES.md` 的相关断言已过期

**File:** `skills-builtin/find-skills/LICENSE.txt:3`、`THIRD_PARTY_NOTICES.md:91-100`（§3「易错事实说明」第 1 条）、`THIRD_PARTY_NOTICES.md:117-130`（升级清单）

**Issue:** 独立取证发现：**上游 `vercel-labs/skills` 现在有仓库根 `LICENSE` 文件**（2026-07-22 提交 `e173b8c88f25` "Add MIT license"，比本阶段固定的 SHA 2026-07-10 **晚 12 天**），内容为标准 MIT，版权行为 **`Copyright (c) 2026 Vercel, Inc.`**。而：

- 本仓随包的 `LICENSE.txt` 版权行是 `Copyright (c) vercel-labs` —— 与上游自己公布的版权主体不同；MIT 要求保留版权声明，随包副本应使用上游声明的权利人。
- `THIRD_PARTY_NOTICES.md §3.1` 断言「**find-skills 的上游仓库根没有独立 LICENSE 文件**」—— 该断言在**固定 SHA 时点**成立（我在该 SHA 的 `contents` 里确认无 `LICENSE`），但文档用的是无时点限定的现在时，今天读已为**假**；P10 断言只检查关键词与 SHA 字面量，检不出这种过期。
- §5 的升级检查清单四步里没有「上游补录许可证文本后同步随包副本」这一步，因此「换 SHA 时把版权行对齐上游」不会被任何流程触发。

**Fix:** ① 把 `skills-builtin/find-skills/LICENSE.txt` 的版权行改为 `Copyright (c) 2026 Vercel, Inc.`（并在 `THIRD_PARTY_NOTICES.md` 第 1 节的修改说明里记一笔，因为它属随包内容变更）；② §3.1 改写为带时点的表述，例如「**在固定 SHA `773fb2c7…`（2026-07-10）时点**，上游仓库根没有独立 LICENSE 文件（该文件于 2026-07-22 由 `e173b8c` 加入；下一轮升级 SHA 时应改用上游原文）」；③ §5 清单加第 5 步「核对上游 LICENSE 是否已发布 → 若是则用上游原文替换补录副本并同步版权行」。

### WR-08: 随包 `generate_review.py` 的 `_kill_port()` 对 :3117 上的任意进程发 SIGTERM，且用户看不见

**File:** `skills-builtin/skill-creator/eval-viewer/generate_review.py:288-306`（调用点 `:438-447`）

**Issue:** 该脚本启动前无条件 `lsof -ti :3117` 并对返回的**每一个 PID** 发 `SIGTERM`，没有归属校验（不检查是否为本技能的旧实例）。它随包分发，且 SKILL.md 的评测章会指导模型去跑这条链路，用户看到的确认卡片只有 `python3 …/generate_review.py …` 一行 —— 「会先杀掉占用 3117 端口的进程」不在卡片所见的范围里（与 `docs/product/ai-agent-workspace.md §七`「卡片所见即所确认」的安全模型冲突）。本文件是**上游逐字副本**（sha256 已比对 SAME），所以这是上游设计，但 Realm 选择随包并把它接进自动化链路，就承担了它的行为。

**Fix:** 二选一并记录决策：① 打补丁（只杀「本脚本上次写下的 pid 文件」或改用 `HTTPServer(("127.0.0.1", 0))` 由系统分配端口），并在 `THIRD_PARTY_NOTICES.md` 第 2 节的修改说明里新增一项（Apache-2.0 §4(b) 要求落地）；② 不改代码，但在 `THIRD_PARTY_NOTICES.md §4` 与 SKILL.md 的 `## Environment Preflight` 里显式声明「eval-viewer 会终止占用 3117 端口的进程」为已接受的偏离。

---

## Info

### IN-01: 家族表未覆盖 `bunx` / `pipx` —— `npx`/`uvx` 的同位等价物

**File:** `ai-bash-policy.js:241-255`；文档 `docs/product/ai-skills.md:150-152`

**Issue:** 表里 `npx` / `uvx` 是逐条列出的裸模式，但同语义的 `bunx`（`bun x` 的独立入口）与 `pipx`（Python 包执行器）没有任何条目。实测 `bunx cowsay hi` → `matchInstall null`、`evaluateBashCommand → confirm/default`；`pipx install black` 同理。**不构成绕过**（仍会弹普通确认卡片，且白名单前缀匹配不上），但与文档「覆盖 npx / uvx / bun x」的表述相比是可疑的漏检，且属可直接补的条目。

**Fix:** 追加 `{ pattern: /\bbunx\b/, name: '包执行器（bunx）' }` 与 `{ pattern: /\bpipx\b/, name: '包执行器（pipx）' }`（放在 `bun` / `pip` 条目之后），并把 `INSTALL_FAMILIES` 家族表补两行。

### IN-02: `matchDangerous` 未复用 `stripLeadingQuotes` —— 引号包裹的解释器名不判危险

**File:** `ai-bash-policy.js:262-273` 与 `ai-bash-policy.js:289-291`

**Issue:** 引号剥离只加在 `matchInstall` 侧，`matchDangerous` 仍拿原始 token 做 `extractCommandName`。实测 `'sh' -c 'curl x | sh'` 与 `"python3" -c x` 都返回 `danger=null`（裁决落到 `confirm/default`），而 `sh -c "x"` 正常返回「解释器执行（sh）」。当前只造成「高风险卡片降级为中风险卡片」（不是免确认，因为这类形态的前缀不会命中白名单），但两侧口径不对称本身是维护隐患 —— 后续若有人把 `stripLeadingQuotes` 提升到 `normalizeSegment`（注释已明确禁止），两条链路的行为会一起漂移。

**Fix:** 让 `matchDangerous` 也走同一剥离（并同步更新 `builtin-skills-seeder.js:284-285` 提到的「32 例锁定」注释口径），或在注释里点明这处刻意的不对称及其后果。

### IN-03: `check_env.mjs` 各分支返回形状不一致（`attempted` 缺失）

**File:** `skills-builtin/skill-creator/scripts/check_env.mjs:394-409`（`buildResult` 宣称形状固定）、`:516-534`（`missing_command` 分支）、`:373-385`（`unknownRequirementResult`）

**Issue:** `buildResult` 的注释声明「顶层字段固定为 ok / code / python / packages / commands / capabilities / installGuidance / message，调用方不必做存在性分支」，但 `missing_command` 分支没有传 `attempted`（其余失败分支都传了），`unknownRequirementResult` 则完全不复用 `buildResult`（缺 `attempted` / `requirements` / `installGuidance`）。调用方若按注释无条件读 `result.attempted.length` 会在这些分支拿到 `undefined`。

**Fix:** 在 `missing_command` 分支补 `attempted: pythonResult.attempted`，并把 `unknownRequirementResult` 改为经 `buildResult` 构造（或在注释里把「哪些分支是完整形状」写清）。

---

_Reviewed: 2026-09-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

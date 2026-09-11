---
phase: 47-bash
reviewed: 2026-09-11T13:47:52Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - AGENTS.md
  - ai-bash-policy.js
  - builtin-skills-seeder.js
  - docs/product/ai-agent-workspace.md
  - docs/product/ai-skills.md
  - tests/test-ai-bash-policy.js
  - tests/test-builtin-skills-seeder.js
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
highest_severity: critical
disposition: docs_only_fix__code_holes_accepted_as_tech_debt
disposition_date: 2026-09-11
disposition_note: "用户裁定：只修文档面（WR-02/WR-03/WR-04），CR-01/CR-02 与 WR-01/WR-05/WR-06 及 IN-01..03 记为技术债，不阻断阶段收尾。详见文末 Disposition 节。"
---

# Phase 47: Code Review Report（gap-closure 复审）

**Reviewed:** 2026-09-11
**Depth:** standard
**Files Reviewed:** 7（2 源码 + 3 文档 + 2 测试）
**Baseline used for diff:** `5c5d92912f3fdfacb472e473fae4d9ffb04a5b03`（47-05 / 47-06 两个 gap-closure 计划，`git diff --stat` 7 文件 / +1397 −86）
**Status:** issues_found（**2 条 Critical**；最高严重度 Critical）

## Summary

本轮复审聚焦 diff_base 之后的两次 gap-closure：`ai-bash-policy.js` 的「首 token 默认拒绝 + 共用词法归一化 + WR-01 白名单护栏」与 `builtin-skills-seeder.js` 的「`same` 跳过重建 / 崩溃残留清扫 / 诊断 console 兜底」，以及配套的三份文档与两份测试。

**先说做对的部分（对抗式核验后仍然成立）**：`same` 跳过重建的三层差异判定（相对路径集合含目录条目 → size → sha256）实现正确，目录条目过滤与 `endsWith('/')` 过滤成对、空目录可自愈（实测复现）；残留清扫的正则锚定 `\d+$` 与调用点在循环之前均成立；`_flushDiagnostics()` 放在 `finally` 覆盖早退路径，与最外层 catch 的 `console.error` 是并列的两条可见面；WR-01 的空前缀护栏（`matchesWhitelist` 跳过 + `validateWhitelistList` 权威拒绝）实测封死了「白名单退化为全放行」；`deriveDiff` 不再用 mtime 的护栏仍在。97 例策略测试与 101 例播种测试全部通过，AGENTS.md 的「97 例」计数与实际一致。

**但安装档的靶心没有真正关死**：本计划把「白名单命中 + 安装档漏检 = 零卡片」定为 GAP 1 / CR-01 的判据，而新增的**只读豁免机制**自身引入了两个同类通道 —— ① 裸形式正则的「旗标取值槽」把末尾子命令吞成旗标取值（`npm -g update` 实测 `allow`）；② `audit` 守卫的负向断言不跨越中间旗标（`npm audit --json fix` 实测 `allow`，而 npm 会真的执行 fix 安装）。两者都能在白名单含裸 `npm` 时零卡片放行网络安装命令，且**测试把它们当成期望行为钉住了**（`tests/test-ai-bash-policy.js:847`）—— 修复必须同时改测试与三处 JSDoc/文档口径。

另有 6 条 Warning：危险档未做同源归一化（高风险降级为中风险卡片）、权威文档两处绝对断言被实测推翻、只读清单文档枚举严重不完整、AGENTS.md 的清扫正则多一层反斜杠、残留清扫缺陈旧性判据（并发实例互删）、`npm version` 属写操作却被列为只读。

## Narrative Findings (AI reviewer)

本节全部为本轮直接读码 + 实测得到的对抗式发现（本轮未提供 `<structural_findings>`，故无 fallow 结构化前序结论）。严重度分组见下。

## Critical Issues

### CR-01: 只读豁免的「裸形式 + 旗标取值槽」吞掉末尾子命令 → 真实安装命令零卡片（`npm -g update`）

**File:** `ai-bash-policy.js:554-556`（裸形式正则构造）、`ai-bash-policy.js:219`（`FLAG_TOLERANCE`）、`ai-bash-policy.js:584-591`（`matchInstall` 分支）

**Issue:**
`PACKAGE_MANAGER_TOOL_MAP` 为 `bareIsInstall === false` 的工具生成的裸形式正则是：

```js
readOnlyRes.push(new RegExp('\\b' + entry.tool + '\\b' + FLAG_TOLERANCE + '\\s*$'));
```

而 `FLAG_TOLERANCE = '(?:\\s+-\\S+(?:\\s+(?!-)\\S+)?)*'` 的每组是「旗标 + **至多一个取值 token**」，取值槽 `(?:\s+(?!-)\S+)?` 会**贪婪吞掉紧随其后的任意非 `-` token**。当子命令恰好是段内最后一个 token 且紧跟在某个旗标之后时，裸形式正则把它读成「旗标的取值」→ 段内再无剩余 → `\s*$` 命中 → `matchInstall` 返回 `null`（只读）→ 只要白名单含该工具名就 `allow` **零卡片**。

实测（`evaluateBashCommand(cmd, ['npm','pip','gem','uv','cargo','go','brew'])`）：

| 命令 | 实际语义 | 期望档 | 实测 |
|------|---------|--------|------|
| `npm -g update` | 升级**全部全局包**（取新代码 + 跑依赖生命周期脚本） | install（高风险卡片） | **`allow` 零卡片** |
| `npm --global update` | 同上 | install | **`allow` 零卡片** |
| `npm --prefix=./app update` | 升级该子项目依赖 | install | **`allow` 零卡片** |
| `npm -q update`（`-q` → `--loglevel warn`，见 npm `@npmcli/config` shorthands） | 升级项目全部依赖 | install | **`allow` 零卡片** |
| `npm --global rebuild` | 重跑依赖生命周期脚本 | install | **`allow` 零卡片** |
| `npm -g update ls` | 升级全局包（`ls` 是包名） | install | **`allow` 零卡片**（已被测试钉住） |
| `cargo -q update` / `gem --quiet update` | 更新 registry / 升级已装 gem | install | **`allow` 零卡片** |

对照：不带旗标前缀的同族命令判定正确 —— `npm update -g` → `confirm/install`、`npm -g install x` → `confirm/install`、`npm -g uninstall x` → `confirm/install`（末尾有剩余 token，裸形式不命中）。也就是说，**同一个真实安装命令的判定随旗标位置翻转**。

这与文档的绝对声明直接冲突：`docs/product/ai-agent-workspace.md:99`「白名单**不再能放开任何非只读的包管理器子命令** —— …`npm run` 与 `npm i` / `npm install` / `npm ci` / `npm exec` / `npm update` / `npm rebuild` 同理」；实测 `npm -g update` / `npm -q update` 正是「非只读子命令被白名单放开」。本计划 JSDoc ⑤/⑦-e 只记录了「旗标取值吞子命令 → 需三件事同时成立（旗标 + 未知动词 + 只读同名词）」的残余，**未覆盖「末尾子命令被完整吞掉」这一更宽的成因**，其成立条件只有两件事（旗标位置 + 白名单含工具名）。

**Fix（两选一，推荐后者）：**

(a) 最小补丁 —— 裸形式只接受「不给独立取值 token 的旗标」（取值必须以 `=` 粘连）：

```js
if (!entry.bareIsInstall) {
  // 纯旗标/裸命令形态：取值只能以 = 粘连，避免把末尾子命令当成旗标取值吞掉
  readOnlyRes.push(new RegExp('\\b' + entry.tool + '\\b(?:\\s+-{1,2}[\\w-]+(?:=\\S+)?)*\\s*$'));
}
```

已复核该补丁与现有断言兼容：`npm --version` / `uv --version` / `pnpm --version` / `brew -v` / `npm` 仍只读；`npm -g` / `npm --prefix ./app`（无子命令）会退化为普通确认 —— 方向安全。唯一致红项是 `tests/test-ai-bash-policy.js:847` 的 `assert.strictEqual(policy.matchInstall('npm -g update ls'), null)`（该断言把漏洞钉成了契约，**必须一并改为非 null**），并同步 JSDoc ⑤ / ⑦-e、`PACKAGE_MANAGER_TOOLS` 的 JSDoc ④ 与 `docs/product/ai-agent-workspace.md:117`、`docs/product/ai-skills.md:206-208` 的残余段（「成因不可消除」的措辞不成立，见下）。

(b) 结构性修复（可同时消除 CR-01、CR-02 与 ⑦-e）—— 放弃用「整段正则」判只读，改为 **argv token 化判定**：取工具名之后的第一个不以 `-` 起头的 token 作为子命令（只有一份**显式取值旗标清单**如 `--prefix` / `-w` / `--filter` / `-C` / `--registry` 才吞掉下一个 token），再与 `readOnly` / `guarded` / `composite` 比对。这样 `npm -g update`（`-g` 是布尔旗标 → 子命令 `update` → 不在只读清单 → 默认拒绝）、`pnpm --filter a run build`（`--filter` 在取值清单 → 子命令 `run` → 只读）两侧同时为真，`pnpm --filter a run build` 这条既有锁定负例不必再靠「取值槽」实现。

### CR-02: `audit` 守卫的负向断言不跨越中间旗标 → `npm audit --json fix` 零卡片（npm 会真的执行 fix 安装）

**File:** `ai-bash-policy.js:443`（npm 的 `audit` 守卫）、`ai-bash-policy.js:455`（pnpm 同形）

**Issue:**
两个 `audit` 守卫正则的负向先行断言只检查 `audit` **紧邻**的后缀：

```js
{ verb: 'audit', pattern: '\\bnpm\\b' + FLAG_TOLERANCE + '\\s+\\baudit\\b(?!\\s+-{0,2}fix\\b)' }
```

`(?!\s+-{0,2}fix\b)` 只匹配「空格 + 至多两个连字符 + fix」。只要 `audit` 与 `fix` 之间插一个旗标，断言即落空 → 判只读 → 白名单命中即零卡片。

实测（白名单 `['npm','pnpm']`）：

```
npm audit fix                     → confirm/install   ✓
npm audit --fix                   → confirm/install   ✓
npm audit --json fix              → allow（零卡片）  ✗
npm audit --audit-level=high fix  → allow（零卡片）  ✗
npm audit --omit=dev fix          → allow（零卡片）  ✗
pnpm audit --json fix             → allow（零卡片）  ✗
pnpm audit --registry=https://x fix → allow（零卡片） ✗
```

「`fix` 是位置参数、旗标不改变它的位置」这一点有 npm 自身实现为证（`node_modules/npm/lib/commands/audit.js`）：`exec(args)` 收到的是**去掉旗标后的位置参数**，`auditAdvisories` 里 `const fix = args[0] === 'fix'`，`fix === true` 时走 `arb.audit({ fix })` + `reifyFinish(...)` —— 即按修复版本**下载并安装**（并跑依赖的安装生命周期脚本）。因此 `npm audit --json fix` 是事实上的安装命令，却拿到零卡片。

**Fix:**

```js
// npm
{ verb: 'audit', pattern: '\\bnpm\\b' + FLAG_TOLERANCE + '\\s+\\baudit\\b(?!' + FLAG_TOLERANCE + '\\s+-{0,2}fix\\b)' },
// pnpm 同形
```

或更省事的 fail-safe 写法（`audit` 后的剩余文本里出现任何 `fix` 词即不收，多一次确认方向安全）：`...\\s+\\baudit\\b(?!.*\\bfix\\b)`。修复后请同时把 `npm audit --json fix` / `npm audit --audit-level=high fix` / `pnpm audit --registry=x fix` 加进 P1 门禁用例（`tests/test-ai-bash-policy.js` 的 `P1-b-1` 或「只读条目形态化」组），因为现有断言只覆盖了紧邻形态 `npm audit fix` / `--fix`。

## Warnings

### WR-01: `matchDangerous` 未做同源词法归一化 → 高风险命令降级为中风险卡片

**File:** `ai-bash-policy.js:329-340`（`matchDangerous`）、`ai-bash-policy.js:360-364`（`stripShellQuoting`）

**Issue:**
本轮把 `stripShellQuoting` 接进了 `matchInstall`，但 `matchDangerous` 仍按原始文本匹配。引号/反斜杠**拼接在词内部**的形态因此绕开危险表，落 `confirm/default`（中风险卡片 + 「该命令未命中白名单」文案），而正确结果是 `confirm/danger`（高风险卡片 + 点名危险项）：

```
rm -rf /tmp/x        → danger（删除文件（rm））
r""m -rf /tmp/x      → confirm/default    ✗（/bin/sh 展开后就是 rm -rf /tmp/x）
r\m -rf /tmp/x       → confirm/default    ✗
sudo id              → danger（提权执行（sudo））
s\udo id             → confirm/default    ✗
su"do" id            → confirm/default    ✗
```

无零卡片通道（拼接后的段不以白名单条目为前缀，`matchesWhitelist` 不会命中），所以这是**风险标注与危险短路的残余**，不是免确认漏洞；但文档把危险表描述为「rm 全系 / sudo / …」（`docs/product/ai-agent-workspace.md:71,79`），而用户实际看到的只是中风险卡片，卡片文案也不点名危险项。

**Fix:** 让危险判定复用同一份归一化（危险侧只可能**增加**命中，方向安全）：

```js
function matchDangerous(seg) {
  const n = stripShellQuoting(seg);   // 与 matchInstall 同源
  if (!n) return null;
  ...
}
```

`matchesWhitelist` **保持原始文本前缀匹配不变**（那是白名单的既定口径，且被既有断言锁定）。改完请重跑 97 例（红项即说明某条危险负例依赖了引号内的字面量，需逐条判断）。

### WR-02: 权威文档的绝对断言被实测推翻（两文件两处）

**File:** `docs/product/ai-agent-workspace.md:114`、`docs/product/ai-agent-workspace.md:99`、`docs/product/ai-skills.md:200-202`

**Issue:**
三处声明与实测/同文档其他段落互相矛盾：

1. `ai-agent-workspace.md:114`：「安装档的漏检类别**只剩一条**——「首 token 不是包管理器」」——与**同一节**第 117 条 (a) 自述的「`npm -g <未知动词> <只读同名词>` 仍可能被判只读」直接冲突，也被本报告 CR-01 / CR-02 的实测反例推翻（漏检类别至少还有两类：旗标取值吞子命令、`audit` 与 `fix` 之间插旗标）。
2. `ai-agent-workspace.md:99`：「白名单**不再能放开任何非只读的包管理器子命令**」——被 `npm -g update` / `npm -q update`（实测 `allow`）推翻。
3. `ai-skills.md:200-202` 同款「漏检类别只剩「首 token 不是包管理器」这一条」+「改前那些…漏检形态已被**默认拒绝**规则消除」。

文档被三份文件声明为**产品说明权威载体**（`docs/product/ai-skills.md:3-6`、`.planning` 的维护约定、AGENTS.md 的维护约定段），绝对化的安全断言属于对外承诺；「不给绝对保证」的诚实边界写在同节末尾，不能与同节的绝对断言并存。

**Fix:** 先按 CR-01 / CR-02 修代码；若决定保留残余，则把三处改写为可验证的措辞，例如：「默认拒绝把漏检面压到『首 token 不是包管理器』**之外仍有两类具名残余**（① 旗标取值吞掉末尾子命令：`npm -g update`；② `audit` 与 `fix` 之间存在旗标：`npm audit --json fix`）—— 两类都只可能落**普通确认卡片或只读豁免**，后者在白名单命中时为零卡片，已在 §（残余）逐条记录」。并同步收紧 `ai-bash-policy.js` 的 JSDoc ⑤ / ⑦-e 中「**成因不可消除**」的断言（token 化判定即可消除，见 CR-01 的 (b)）。

### WR-03: 只读清单的文档枚举严重不完整（把免确认面说小了）

**File:** `docs/product/ai-agent-workspace.md:85`、`docs/product/ai-skills.md:178-184`

**Issue:**
两份文档以「**显式只读清单**（清单内走普通确认或白名单；**清单外一律强制确认**）」的形式给出枚举，但实现里的只读面**远大于**文档所写（实现在 `PACKAGE_MANAGER_TOOLS`，是被测试表驱动断言的单一来源）。文档未列出的只读词条包括：

- `npm`：`list` / `help` / `root` / `ping` / `doctor` / `fund` / `version` / `whoami` / `dedupe` / `prune` / `completion` / `search` / `docs` / `repo` / `bugs` / `explain` / `why` / `bin` / `prefix`
- `pnpm`：`test` / `list` / `why` / `outdated` / `licenses` / `root` / `bin` / `doctor` / `help` / `version`
- `yarn`：`test` / `ls` / `list` / `why` / `info` / `outdated` / `audit` / `licenses` / `bin` / `root` / `help` / `version`
- `bun`：`test` / `ls` / `list` / `help` / `version` / `why` / `outdated` / `audit`
- `brew`：`config` / `doctor` / `outdated` / `deps` / `uses` / `home` / `desc` / `cat` / `help` / `version`
- `pip` / `pip3`：`help` / `version` / `debug`
- `uv`：`init` / `cache` / `list` / `show` / `freeze` / `check` / `inspect` / `debug` / `version` / `help`（文档只有「`uv tree` / `lock` / `export` / `uv pip list` 等」）
- `cargo`：`tree` / `metadata` / `version` / `help` / `locate-project`
- `go`：`env` / `version` / `doc` / `help`
- **`gem` 整族缺失**：`list` / `search` / `info` / `environment` / `help` / `version` 全未出现，而 `gem` 在工具集清单里是明确列出的（同一段文字内自相矛盾）

**Fix:** 两份文档的只读清单**直接从 `PACKAGE_MANAGER_TOOLS` 生成**（例如在测试里加一条「文档枚举 ⊇ 实现 readOnly」的一致性断言，照 `tests/test-builtin-skills-seeder.js` 的「三份文档口径一致」组的做法），避免以后清单漂移；至少补齐 `gem` 族与上列缺失项，并把「等」的使用收敛为明确声明（「以下清单即全部，未列出者一律强制确认」）。

### WR-04: AGENTS.md 记录的清扫正则多一层反斜杠 → 照文档实现会永不命中

**File:** `AGENTS.md:269`

**Issue:** 文档原文（行内代码，反斜杠字面）：

```
播种前先清扫 `/\\.(tmp|bak)_\\d+$/` 的崩溃残留目录
```

实现是 `/\.(tmp|bak)_\d+$/`（`builtin-skills-seeder.js:264`）。文档里的 `\\.` / `\\d` 在 markdown 行内代码中不会被转义处理，渲染与复制都是**双反斜杠**，等价于「匹配字面反斜杠」→ 复制粘贴进代码就是一条永不命中的正则（残留清扫静默失效，正是 GAP 3 要修的现象）。AGENTS.md 是 always-applied 的项目规则文件，这类不变式被照抄的风险不低。

**Fix:** 改为 `` `/\.(tmp|bak)_\d+$/` ``（并让残留清扫相关断言继续以源码为唯一来源，已由 `tests/test-builtin-skills-seeder.js:905-918` 覆盖）。

### WR-05: `sweepSeedResidue` 缺陈旧性判据 → 并发实例会互删进行中的 tmp/bak

**File:** `builtin-skills-seeder.js:255-266`（清扫实现）、`builtin-skills-seeder.js:453`（调用点）

**Issue:** 清扫只按**命名形状**判定（`/\.(tmp|bak)_\d+$/`），不判「是否陈旧」，而 `<dst>.tmp_<ts>` / `<dst>.bak_<ts>` 正是 `safeCopyDir` **当前进程进行中**的中间态。应用没有单实例锁（全仓无 `requestSingleInstanceLock`），且 `dev` 与 `debug` **共享同一个 userData 目录**（AGENTS.md 的环境隔离表）。两实例同时运行时存在这条交错：

1. 实例 A 播种技能 X：`copyDirRecursive(src, X.tmp_tsA)` 完成 → `rename(X → X.bak_tsA)`；
2. 实例 B 启动，`sweepSeedResidue` 删掉 `X.tmp_tsA` 与 `X.bak_tsA`（两者都匹配正则）；
3. A 的 `rename(X.tmp_tsA → X)` 抛 ENOENT → 回滚 `rename(X.bak_tsA → X)` 也 ENOENT → `X` 目录**中途缺失**，A 产一条 `realm_builtin_seed_failed`（error 级，经 console.error 输出）。

后果有界且下一轮自愈（`missing` → 重播），但表现为「启动日志里莫名的播种失败 + 技能短暂消失」，与 GAP 4 想达成的「失败可见性即真实故障」的信噪比目标相冲。

**Fix（零状态文件、不破坏 D-11）：** 只清扫**陈旧**残留 —— 从目录名解析出 `\d+` 时间戳，仅当它早于「本进程启动时刻」或早于 `Date.now() - RESIDUE_TTL_MS`（如 10 分钟）时才删：

```js
const ts = Number(name.match(/\.(?:tmp|bak)_(\d+)$/)[1]);
if (Number.isFinite(ts) && Date.now() - ts > RESIDUE_TTL_MS) _cleanupDir(...);
```

（`safeCopyDir` 的时间戳来自 `Date.now()`，与本机时钟同源，判据成立；`tests/test-builtin-skills-seeder.js:869` 的用例 B 需把预置残留的时间戳改为足够旧。）

### WR-06: `npm version` / `yarn version` 属写操作，却被列入只读清单

**File:** `ai-bash-policy.js:435`（npm 的 `readOnly` 含 `'version'`）、`ai-bash-policy.js:463`（yarn 同）、`ai-bash-policy.js:465`（yarn 的 `readOnly`）

**Issue:** 实测（白名单 `['npm','yarn']`）：

```
npm version                  → allow（纯查询，合理）
npm --version                → allow（纯旗标形态，合理）
npm version patch            → allow（零卡片）  ✗
npm version 2.0.0            → allow（零卡片）  ✗
yarn version --new-version 1.1.0 → allow（零卡片） ✗
```

带位置参数的 `npm version <semver|patch>` 会**改写 package.json / package-lock.json、创建 git commit 与 tag**，并执行 package.json 里的 `preversion` / `version` / `postversion` 生命周期脚本；`yarn version --new-version` 同形。这与 D-16 自述的准入判据（「**不取新代码** **且** **不执行第三方代码**」，且明确把**写操作** `npm owner` / `team` / `dist-tag` 列为「刻意不收」）不一致 —— 实测同族写操作（`npm owner add x` / `npm dist-tag add …`）确实落 install 档，只有 `version` 例外。风险量级低于 CR-01（无网络取码），但后果是「用户以为只是查版本，AI 却打了 tag / 建了 commit」。

**Fix:** 把 `version` 形态化（照 `init` 的做法）——只读仅限「不带位置参数」：

```js
readOnly: [ /* 去掉 'version' */ ],
guarded: [
  { verb: 'version', pattern: '\\bnpm\\b' + FLAG_TOLERANCE + '\\s+\\bversion\\b(?:\\s+-{1,2}\\S+)*\\s*$' },
],
```

（`npm --version` 仍由裸形式覆盖，`tests/test-ai-bash-policy.js:360,972` 不受影响；`npm version patch` 落默认拒绝。）若判定为「与 `npm run` 族同判据」的已接受取舍，则请在 `PACKAGE_MANAGER_TOOLS` JSDoc ②/D-16 段落**显式记录 `version` 与 `run` 同族**，并同步两份文档的残余段 —— 当前是未记录的空白。

## Info

### IN-01: `detectDiff` 的 `dstFiles` 是死变量

**File:** `builtin-skills-seeder.js:200`
**Issue:** `const dstFiles = dstEntries.filter((rel) => !rel.endsWith('/'));` 之后从未被引用（第 ③④ 层用 `srcFiles` 遍历 + `path.join(dstDir, rel)`）。第 ② 层已保证两侧路径集合逐元素相等，所以 `dstFiles` 恒等于 `srcFiles`。
**Fix:** 删除该行，或改成 `if (dstFiles.length !== srcFiles.length) return 'different';` 的形式把它变成一次显式不变式校验（二选一，前者更简）。

### IN-02: `same` 跳过重建后，不再自愈「仅权限位变化」

**File:** `builtin-skills-seeder.js:185-217`（`detectDiff` 不比较 `mode`）、`builtin-skills-seeder.js:465`（`same` → `continue`）
**Issue:** 实测：播种后 `chmod 600 managed-skills/s1/SKILL.md` 再重播，`detectDiff` 判 `same`，权限位保持 `600`（改前「无条件覆盖」会恢复为随包权限）。当前随包技能全部是 `100644`（`git ls-files -s skills-builtin` 无 `100755`），故**无实际影响**；但文档的「自愈式播种」口径（`docs/product/ai-skills.md:113-133`）未记录这一收窄，日后若随包引入需要可执行位的脚本（`scripts/*.sh`），丢位将不再被修复。
**Fix:** 在 `detectDiff` 的 size 层旁加一行 `mode` 比较（`(a.mode & 0o777) !== (b.mode & 0o777) → 'different'`），或在文档第八节的「精度补充」里写明「只按相对路径集合 / size / sha256 判内容，权限位不在自愈范围」。

### IN-03: 设置页前端校验缺 WR-01 的 `*` 规则，与代码注释所称「重复的本地实现」不符

**File:** `src/settings-page.js:2844-2857`（前端）、`ai-bash-policy.js:652-653`（注释）
**Issue:** `addAiBashWhitelistEntry` 的本地校验只有「非空 / ≤200 字符 / 无换行控制符」，**没有** `*` 的 WR-01 规则；用户输入 `*` 只能在提交时被服务端 `validateWhitelistList` 以 400 拦下（`main.js:1376-1381`）。安全性由服务端权威校验兜住（结论正确），但 `ai-bash-policy.js` 的注释「设置页 `src/settings-page.js` 的 tag 输入校验是重复的本地实现」会被读成两层口径一致，实际两层不等价。
**Fix:** 在 `settings-page.js` 的校验块补一条与 `validateWhitelistList` 同形的判断（`if (!raw.replace(/\*+$/, '').trim()) { showToast('白名单条目必须是具体命令前缀，不支持单独使用 *'); return; }`），或把注释改成明确说明「前端只做形状校验，`*` 由服务端拒绝」。

---

_Reviewed: 2026-09-11T13:47:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Disposition（2026-09-11，用户裁定）

**用户裁定：只修文档面（最小收口）。** 代码洞与其余发现记为**技术债**，不新增 gap 计划、不阻断本阶段收尾。

### 本轮已修（文档面，消除虚假保证）

| 发现 | 处置 | 落点 |
|------|------|------|
| **WR-02** 三处绝对断言被实测推翻 | 改为**带前提**表述 + 逐条具名残余 | `docs/product/ai-agent-workspace.md` §五 / §七第 5 条+附；`docs/product/ai-skills.md` §九「白名单不可越过」段与「残余风险」段 |
| **WR-03** 只读清单枚举严重不完整 | 两份文档改为**按工具逐项完整枚举**，并声明以代码 `PACKAGE_MANAGER_TOOLS` 的 `readOnly` 为**单一来源**（不再用「等」） | 同上两份文档的只读清单段 |
| **WR-04** AGENTS.md 清扫正则多一层反斜杠 | 改为 `/\.(tmp|bak)_\d+$/` | `AGENTS.md` 内置技能 bullet |
| 交叉引用一致性 | 文档自证段补「不得读作绝对保证」的显式限定 | `ai-skills.md` §九 |

> 本轮修复同时更新了 `tests/test-builtin-skills-seeder.js` 的两条 DOC-02 断言到新措辞，并新增三条
> （具名钉住 `npm -g update` / `npm audit --json fix` 必须出现在文档里）。全部套件复跑：
> 策略 97/97、播种 101/101、技能 64/64、其余 `tests/test-*.js` 19/19 全绿。

### 记为技术债（未修，留待后续阶段）

**零卡片类（安全相关，优先级最高）**

| ID | 描述 | 复现 | 备注 |
|----|------|------|------|
| **CR-01** | 只读豁免的裸形式正则 + 旗标取值槽吞掉末尾子命令 → 真实联网安装命令**零卡片** | `evaluateBashCommand('npm -g update', ['npm'])` → `allow`；`npm -q update` / `npm --prefix=./app update` / `npm --global rebuild` 同 | 对照 `npm update -g` 仍正确判 `confirm/install`（差异只在旗标位置）。**改前 `0bbb6c4` 亦为 `allow`** —— 非本阶段引入的回归，但属本阶段目标类别（GAP 1 / CR-01 同名同族） |
| **CR-02** | `audit` 守卫的负向先行断言不跨越中间旗标 → npm 会真的执行 fix 安装而**零卡片** | `npm audit --json fix` / `pnpm audit --registry=x fix` @ 裸白名单 → `allow` | `npm audit fix`（无中间旗标）已正确判安装档 |

**结构性与一致性类**

| ID | 描述 | 影响 |
|----|------|------|
| **WR-01** | `matchDangerous` 未做同源词法归一化 | `r""m -rf /` 从高风险卡片降级为**中风险**卡片（仍弹卡，危险档短路失效） |
| **WR-05** | `sweepSeedResidue` 缺陈旧性判据 | 并发实例（`dev` 与 `debug` 共享 userData 且无单实例锁）可能互删进行中的 `tmp_` / `bak_` |
| **WR-06** | `npm version` / `yarn version` 属写操作（改 package.json + 打 tag/commit）却被列为只读 | `npm version patch` @ `['npm']` → `allow` |
| **IN-01** | `detectDiff` 的 `dstFiles` 是死变量 | 无功能影响，代码整洁 |
| **IN-02** | `same` 跳过重建后不再自愈「仅权限位变化」 | 行为变化（有意取舍），需在文档/后续阶段说明 |
| **IN-03** | 设置页前端校验缺 WR-01 的 `*` 规则，与代码注释所称「重复的本地实现」不符 | 文档/代码注释口径 |

### 建议的结构性修法（供后续 gap 计划采用）

审查给出的根治方案：把 `matchInstall` 的判定从「正则 + `FLAG_TOLERANCE` 取值槽」改为**argv 级分词**
（显式声明哪些旗标**带值**、哪些不带值），可一次性消除 CR-01、CR-02 与文档里的 ⑦-e 残余
（`npm -g update ls` 这类「旗标取值槽与子命令不可区分」的问题）。该改动会同时涉及
`ai-bash-policy.js` 的判定核心、`tests/test-ai-bash-policy.js` 的期望值（当前 `:847` 一带把
CR-01 的形态钉成了期望的 `allow`）与三份文档的口径，属需要独立计划的规模。

**推进方式**：`/gsd-plan-phase 47 --gaps`（或并入后续阶段），届时读本报告的 CR-01 / CR-02 节获取完整修法。

### 处置补记（2026-09-11 终次复验后）

| 项 | 状态 |
|----|------|
| 残余计数自洽（§五 / §九 开头写「两类」而残余段写「三类」） | **已修**（§五 与 §九 开头均改为「三类」并点名三形态；测试加 4 条计数自洽断言） |
| 残余 ③ 的**成因归属**（原文把 ② 也归到「旗标取值槽」，实测 `npm --json audit fix` 判安装档而 `npm audit --json fix` 判只读 ⇒ ② 属 `audit` 守卫的紧邻先行断言成因） | **已修**（两份文档改为「③ 与 ① 同属旗标取值槽；② 成因不同」并附实测对照） |
| `ai-bash-policy.js:249`（JSDoc ③）称旗标容忍「不会吞掉子命令本身」，与 CR-01 矛盾（47-02 引入，早于本轮） | **记技术债**（零 diff 约束下不改 `ai-bash-policy.js`；该 JSDoc 的作用域限定在纵深表，故不改变任何判定） |
| `docs` 只读枚举缺机械漂移护栏（WR-03 建议的断言未落地） | **记技术债** |
| 生产包 `/Applications/Realm.app` 仍为 2026-09-10 构建（无 `skills-builtin` / `THIRD_PARTY_NOTICES.md`，仍含 `.planning`/`tests`）；SC5 证据链经 47-04 的 Nightly 路线取得 | **发布前必须重跑 `make install`** |

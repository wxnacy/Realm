---
phase: 51-zip
plan: 02
subsystem: infra
tags: [npm, yauzl, yaml, package-lock, supply-chain, asarUnpack, single-instance, electron-builder]

# Dependency graph
requires:
  - phase: 50-skills-management
    provides: 'SDK @earendil-works/pi-agent-core@0.84.3 —— 其 `dependencies.yaml` 为精确 `"2.9.0"`，本计划把 yaml 提升为顶层直接依赖时必须与之同版才能单实例'
provides:
  - '`dependencies.yauzl`（`^3.4.0`）—— 51-03 起的 zip 解压层唯一入口（P11 明文禁止自写解析器）'
  - '`dependencies.yaml`（裸 `2.9.0`，精确钉版）—— 自行解析 SKILL.md frontmatter 拿 `allowed-tools`（SDK 的 `Skill` 类型无该字段，O5 / D-14）'
  - '`package-lock.json` 中 yauzl@3.4.0 / pend@1.2.0 的解析条目（可复现安装）'
  - '磁盘级单实例证据：`node_modules/yaml` = 2.9.0 且 SDK 下无嵌套副本（CR-2 的机械判据）'
affects: [51-03, 51-05, 51-06, 51-07]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 1312          # chars/4 over the realized diff (5247 chars over package.json + package-lock.json + 51-02-PLAN.md)
  tasks: 2
  commits: 3            # MEASURED: git rev-list --count 49cd2cb…HEAD（含 1 条并发会话的 3a9904a，见「并发会话」）
  plan_head_before: 49cd2cb144923c5ca874da0f17f1d5aafb892d89

# Tech tracking
tech-stack:
  added:
    - 'yauzl@3.4.0（zip 解压，只给流、库自身从不写盘 —— 结构上排除 CVE-2026-76845 型「跟随预埋 symlink 写出根外」）'
    - 'yaml@2.9.0（YAML 1.2 解析；与 SDK 传递依赖同版，单实例）'
    - 'pend@1.2.0（yauzl 唯一传递依赖，不由本阶段直接 require）'
  patterns:
    - '顶层精确钉版消掉传递依赖的双实例（不是 overrides / 不是手删嵌套目录 —— 后者在 npm ci 时会被重建）'
    - '门禁断言库的「导出面契约」使其升版改 API 形态在安装当刻可见，而不是在消费方以 TypeError 形式延后暴露'

key-files:
  created: []
  modified:
    - 'package.json（+2 行：`yauzl` / `yaml`；`build` 段零改动）'
    - 'package-lock.json（+3 块：根 deps 声明、`node_modules/pend`、`node_modules/yauzl`）'
    - '.planning/phases/51-zip/51-02-PLAN.md（Rule 1 修正：门禁二的接收者；1 行）'

key-decisions:
  - '**`yaml` 用 `--save-exact` 落裸 `2.9.0`**：npm 默认 `save-prefix = ^`（本仓无 `.npmrc`，实测 `npm config get save-prefix` = `^`），写成 `^2.9.0` 会让根落 2.9.1 + SDK 下嵌套 2.9.0 两份 ⇒ YAML 解析差异是**静默**的。CR-2 权威度高于 CONTEXT D-14 的 `^2.9.0` 措辞。'
  - '**门禁二的断言位置修正**（见「偏差」）：`openReadStreamPromise` 是 `ZipFile.prototype` 成员而非模块级导出 —— 修正后断言强度不变、恒红形态消除。'
  - '**未改 `build.files` / `build.asarUnpack`**：两包纯 JS、无 `.node`、无被原生代码读取的数据文件 ⇒ 加 `asarUnpack` 是无依据的产物膨胀；`build.files` 一旦出现正向条目，`!` 的「无正向条目时保留默认全量包含」语义即失效。'
  - '**STATE.md / ROADMAP.md 未改动**（本 run 显式指令：最终 tracking 写入归编排层；且 `.planning/state.json` 当前带着并发会话的在途修改，写入有覆盖风险）。'
  - '**未跑 `requirements mark-complete`**：`USER-03` / `USER-04` 是**能力级**需求（zip / 网络地址导入管线），本计划只落依赖基座，能力完成归 51-03…51-07。frontmatter 的 `requirements-completed` 按模板契约照抄计划的 `requirements` 字段，但**本计划不足以单独勾选它们**。'

patterns-established:
  - '依赖合法性门禁产物（`[SUS]` 裁决）→ blocking-human 检查点 → 可归因的人工确认记录 → 磁盘级机械判据（单实例 / 导出面 / 无 postinstall）四段闭环'
  - '把 `[SUS]` 裁决的**标的版本**与**安装版本**分开陈述：被判的是 npm `latest`（2.9.1，4 天前），装的是 2.9.0（4 个月前）—— 保守处置但不说成「包有风险」'

requirements-completed: [USER-03, USER-04]  # 照抄计划 frontmatter；⚠️ 本计划只贡献依赖基座，能力级完成见 51-03…51-07

coverage:
  - id: D1
    description: '`[SUS]` 裁决走完 blocking-human 检查点，留下可归因的人工确认记录（谁确认 / 确认了什么 / 有无附条件）'
    verification: []
    human_judgment: true
    rationale: '这**就是**一条人工闸 —— 三条确认的内容（是否同意钉 2.9.0 / 是否接受精确钉版形态 / 是否核对包身份非 slopsquatting）是判断，不是可自动判定的量。确认已于 2026-09-15 由项目用户 wxnacy 经编排层面板作出（记录见下），故 UAT 可作形式复核。'
  - id: D2
    description: '`yauzl@^3.4.0` 与裸 `yaml@2.9.0` 落进 `dependencies`，`package-lock.json` 同步入库（可复现安装）'
    requirement: USER-03
    verification:
      - kind: other
        ref: "门禁一 node -e '...d.yaml!=="2.9.0"...' → `依赖声明 ok（yauzl ^3.4.0 + yaml 裸 2.9.0）`"
        status: pass
      - kind: other
        ref: "基线核对 git diff 49cd2cb -- package.json（仅 turndown 行尾逗号 + 两行新增）/ -- package-lock.json（仅 pend@1.2.0 与 yauzl@3.4.0，无第三个包）"
        status: pass
    human_judgment: false
  - id: D3
    description: '`yaml` 磁盘层单实例：根 2.9.0 且 `node_modules/@earendil-works/pi-agent-core/node_modules/yaml` 不存在'
    requirement: USER-03
    verification:
      - kind: other
        ref: '门禁二（修正后）→ `安装结果 ok（yaml 单实例 2.9.0 + yauzl 3.4.0 + 三个 Promise 打开器）`'
        status: pass
      - kind: other
        ref: '合成探针 RED-2（补上导出后加嵌套副本）转红 —— 证明该分支有判别力'
        status: pass
    human_judgment: false
  - id: D4
    description: '`yauzl` 的 Promise API 契约可 require：模块级 `openPromise` / `fromBufferPromise` + `ZipFile.prototype.openReadStreamPromise`'
    requirement: USER-03
    verification:
      - kind: other
        ref: '门禁二（修正后）同一轮；51-03 的 `extractAndValidatePackage()` 只走 Promise API'
        status: pass
    human_judgment: false
  - id: D5
    description: '两包均无 `postinstall`；`build.files` 全 `!` 前缀、`build.asarUnpack` 仍恰两项；既有护栏套件全绿'
    requirement: USER-04
    verification:
      - kind: unit
        ref: 'node tests/test-builtin-skills-seeder.js → # tests 101 / # pass 101 / # fail 0'
        status: pass
      - kind: other
        ref: '门禁四 → `打包面 ok（两个新包无 postinstall + files 全 ! + asarUnpack 未动）`'
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-09-15
status: complete
---

# Phase 51 Plan 02: 依赖落定（yauzl ^3.4.0 + yaml 裸 2.9.0 单实例）Summary

**`yauzl@^3.4.0` 与精确钉版的 `yaml@2.9.0` 落进 `dependencies`、lock 入库、磁盘上 yaml 单实例、打包面零改动 —— 并把 `yaml` 的 `[SUS]` 供应链闸走成一次可归因的人工确认**

## Performance

- **Duration:** ~7 min（安装动作 15:15:30 → 收尾 15:22:30，+08:00）
- **Started:** 2026-09-15T15:15:30+08:00（首个改动工作树树态的动作：`npm install yauzl@^3.4.0`）
- **Completed:** 2026-09-15T15:22:30+08:00
- **Tasks:** 2 / 2
- **Files modified:** 3

## ⚠️ Task 1 —— 检查点已由编排层在派发前解决（**本执行者未重新呈现、未自动批准任何其它事项**）

计划 `autonomous: false` 的**唯一**原因就是 Task 1 的 `checkpoint:human-verify gate="blocking-human"`（依赖合法性闸，`yaml` = `[SUS]` reason `too-new`）。编排层在派发本执行者**之前**已向用户呈现该检查点并收到明确答复。按指令，本执行者**不重新呈现**它，而是如实记录并据此勾选 Task 1 的 `<human-check>`。

**谁确认的：** 项目用户 **wxnacy**，经编排层的 blocking-human 检查点面板答复（2026-09-15）。
**有无附条件：** 无。

**确认了什么（三条逐条原样记录）：**

| # | 计划要求的确认点 | 用户答复 |
|---|---|---|
| 1 | 钉的是 `yaml@2.9.0`（**不是** 2.9.1）—— 门禁 `[SUS][too-new]` 判的是 npm `latest`（2.9.1，2026-09-11 发布，4 天前），而本阶段装的是 2.9.0（2026-05-11 发布，且此刻已作为 SDK 传递依赖在 `node_modules/` 里） | **APPROVED** |
| 2 | 接受「**精确钉版、无 `^`**」的形态（代价：补丁不自动升级；收益：与 SDK 同版、单实例） | **APPROVED** |
| 3 | 核对 npm 页面包身份不是 slopsquatting（`yauzl` 3.4.0 / `github.com/thejoshwolfe/yauzl`；`yaml` 15 年包龄 / `github.com/eemeli/yaml`；两者均无 `postinstall`） | **APPROVED** |

**支撑证据（本执行者在当前树上复核过的部分，与计划记录一致）：**
- `yauzl` = **OK** —— 3.4.0 / publishedAt `2026-06-07T12:57:28.373Z` / 36,708,586 周下载 / repo `git+https://github.com/thejoshwolfe/yauzl.git` / 无 postinstall
- `yaml` = **SUS [too-new]** —— `signals.publishedAt` `2026-09-11T20:30:10.905Z`（= npm `latest` **2.9.1**，**不是**被钉的 2.9.0）/ 142,950,948 周下载 / repo `git+https://github.com/eemeli/yaml.git` / 无 postinstall
- `pend` = **OK**（yauzl 唯一传递依赖）

**执行者独立复核的三条可满足性判据（确认前做的，非事后补）：**
1. 门上证据齐备：`npm view yaml time` 的 2.9.0 = 2026-05-11、2.9.1 = 2026-09-11（研究 `### Version verification` 逐字）；
2. `node -e "require('./node_modules/@earendil-works/pi-agent-core/package.json').dependencies"` 实测 `"yaml":"2.9.0"`（**精确**）⇒「与 SDK 同版」是硬事实；
3. 本仓无 `.npmrc`、`npm config get save-prefix` = `^` ⇒ `--save-exact` 确有必要，确认点 2 的代价与收益属实。

三条全部为肯定 ⇒ `<human-check>` **通过**。Task 1 **不产生提交**（它的产物就是上面这段记录，落在本 SUMMARY 里）。

## Accomplishments

- `dependencies` 新增两项并按计划的口径落定：`"yauzl": "^3.4.0"` 与 **裸** `"yaml": "2.9.0"`（门禁一逐字比对 JSON 值，不是 grep 文本）；`package-lock.json` 同步入库。
- **双实例被真正消掉**（CR-2 的机械判据，磁盘层双重成立）：`node_modules/yaml/package.json.version === '2.9.0'` **且** `node_modules/@earendil-works/pi-agent-core/node_modules/yaml` 不存在。
- lock 的变更被裁剪到最小：基线 `49cd2cb` 之下只有 `node_modules/pend@1.2.0` 与 `node_modules/yauzl@3.4.0` 两条新增条目 —— **没有第三个包的版本被 npm 顺带动过**，`node_modules/yaml` 保持原有 2.9.0 单条（deduped，无嵌套条目）。
- `yauzl` 的能力契约在安装当刻被断言：模块级 `openPromise` / `fromBufferPromise` 与 `ZipFile.prototype.openReadStreamPromise` 均为 function（51-03 的整条解压实现只走 Promise API）。
- 打包面零搅动：`build.files` 每一项仍以 `!` 开头（无正向条目）、`build.asarUnpack` 仍恰 `["node_modules/nodejieba/**","skills-builtin/**"]`；两包均无 `postinstall`。既有护栏套件 `tests/test-builtin-skills-seeder.js` **101/101 pass、# fail 0**。
- **四条 `<automated>` 门禁全部在当前树上实跑**（不是只见于计划文本），全绿；并对四条门禁各做了**单点变异**确认它们真的能转红。

## Task Commits

1. **Task 1: 依赖合法性闸 —— 确认 yaml 钉 2.9.0（与 SDK 同版）与 yauzl 3.4.0** —— **无提交**（`checkpoint:human-verify`，产物是本 SUMMARY 里的确认记录；编排层已在派发前解决该检查点）
2. **Task 2: 安装并落定 —— 精确钉版、单实例、导出面与打包护栏** —— `3c920a9` (`feat`)
3. **Task 2 伴生（Rule 1 偏差）: 修正门禁二的断言接收者** —— `86886e1` (`fix`)

**Plan metadata:** 本 SUMMARY 的提交（`docs(51-02): complete ... plan`）

_注：计划基线台账 `.git/gsd-plan-head-before-51-02` = `49cd2cb144923c5ca874da0f17f1d5aafb892d89`。`git rev-list --count 49cd2cb..HEAD` 实测 **3** —— 其中 `3a9904a` 属并发会话（见下）。_

## Files Created/Modified

- `package.json` —— `dependencies` 新增 `"yaml": "2.9.0"`（裸、精确）与 `"yauzl": "^3.4.0"`；`build` 段**逐字节未动**
- `package-lock.json` —— 根 `dependencies` 声明同步 + 新增 `node_modules/pend`（1.2.0）与 `node_modules/yauzl`（3.4.0）两条解析条目
- `.planning/phases/51-zip/51-02-PLAN.md` —— 门禁二的断言接收者修正（1 行，见「偏差」）
- `.planning/WINDOWS.md` —— 破损窗台账 id 38 登记上述 Rule 1 偏差

## Decisions Made

见 frontmatter `key-decisions`（四条实质决策：`--save-exact` 的必要性、门禁二断言位置修正、打包面不动的依据、tracking 写入归编排层）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 计划门禁二对 yauzl Promise 导出面的断言不可满足**

- **Found during:** Task 2（安装后的门禁二首跑）
- **Issue:** 门禁二写 `for(const k of ["openPromise","fromBufferPromise","openReadStreamPromise"]) if(typeof y[k]!=="function") ...`，其中 `y` 是 `require("yauzl")` 的**模块命名空间**。实测 `Object.keys(require("yauzl"))` 不含 `openReadStreamPromise` —— 它是 **`ZipFile.prototype`** 的成员（`node_modules/yauzl/index.js:711`），模块级只有四个 `*Promise` **打开器**（`openPromise` / `fromFdPromise` / `fromBufferPromise` / `fromRandomAccessReaderPromise`）。因此该门禁**对任何正确安装恒红**，与本实现对不对无关。首跑实证：`安装结果不合格:\nyauzl 缺 Promise 导出 openReadStreamPromise`（exit 1）。
  计划自身的 `<key_links>` 其实把 `openReadStreamPromise` 与 `eachEntry()` 并列（即当作实例方法），是门禁把它拍平成了模块级断言 —— 属**限定词错误**，不属口径分歧。研究 `### 实测 1` 的 ① 也只把四个 `*Promise` 打开器列为模块导出面。
- **Fix:** 按接收者寻址，三个 token 一个不少、断言强度不变（仍是「必须为 function」）：
  ```js
  const zf=(y.ZipFile&&y.ZipFile.prototype)||{};
  for(const [k,o] of [["openPromise",y],["fromBufferPromise",y],["openReadStreamPromise",zf]])
    if(typeof o[k]!=="function")bad.push("yauzl 缺 Promise 导出 "+k)
  ```
  `<fails_when>` 的判据文本（`yauzl 缺 Promise 导出 <name>`）保持逐字不变，故红轮报文形态与计划描述一致。
- **Files modified:** `.planning/phases/51-zip/51-02-PLAN.md`（1 行）
- **Verification:**
  - 实际树上：修正后门禁二 exit 0，输出 `安装结果 ok（yaml 单实例 2.9.0 + yauzl 3.4.0 + 三个 Promise 打开器）`。
  - **合成探针两轮**（`/tmp/g512-probe`，形状忠实：模块级三个导出 + `ZipFile` 构造器 + 版本/嵌套目录）：
    - RED-1（`yaml` 2.9.1 + `ZipFile.prototype` 缺该成员）⇒ 两条同时报错、exit 1；
    - RED-2（补上该成员后加回嵌套 `yaml` 副本）⇒ 「存在嵌套 yaml 副本」单独转红、exit 1；
    - GREEN ⇒ exit 0。三条分支均有判别力。
  - **实际树上单点变异**（备份 + `trap` 保证复原，事后 `cmp` 逐字节校验）：
    | 变异 | 目标门禁 | 实测 |
    |---|---|---|
    | `dependencies.yaml` → `^2.9.0` | 门禁一 | 转红 exit 1 ✅ |
    | `node_modules/yauzl/package.json` 加 `postinstall` | 门禁四 | 转红 exit 1 ✅ |
    | `build.files` 加正向条目 `skills-builtin/**` | 门禁四 | 转红 exit 1 ✅ |
    | `build.asarUnpack` 加第三项 | 门禁四 | 转红 exit 1 ✅ |
    | 复原校验 | —— | `package.json` / `yauzl/package.json` 均 byte-identical ✅ |
- **Committed in:** `86886e1`（独立提交，使 Task 2 的提交面与计划 `files_modified` 严格一致）

---

**Total deviations:** 1 auto-fixed（Rule 1 计 1；Rule 2 / 3 / 4 计 0）
**Impact on plan:** 唯一偏差是**修正一条计划自带的不可能门禁**，不改计划意图、不放宽判据（断言强度不变、覆盖面不减）、不新增依赖、不改产物形状。已同时登记进 `.planning/WINDOWS.md`（id 38）。

## Issues Encountered

- **门禁二首跑恒红** —— 即上面的 Rule 1 偏差，按偏差规则内联修复并留证。
- **`postinstall` 未由 npm 触发**（本仓 `scripts/postinstall.js` = 图标替换 + `npx @electron/rebuild`）：两次 `npm install` 输出均无 `[postinstall]` 行、耗时 1–2 s，`node_modules/electron/.../electron.icns` 的 mtime 未变；`npm config get ignore-scripts` = `false`。**未改走 `--ignore-scripts`**（计划允许的退路未被用到）。为对齐仓库既有健康态，事后**显式**跑了一次 `node scripts/postinstall.js`：输出 `[postinstall] Electron.app 图标已替换` + `✔ Rebuild Complete`（better-sqlite3 / nodejieba）+ `[postinstall] 原生模块重编译完成`，exit 0。**两个新包纯 JS、无原生模块、无 postinstall ⇒ 本计划的产物与「走哪条路径」无关**；`node_modules/` 不入库，该项对 `package.json` / `package-lock.json` 的最终形状零影响（lock 的基线 diff 在重建后复跑仍只有三条新增）。
- **并发会话**：本 run 期间另一 CodeBuddy 会话在 `master` 上落了 `3a9904a`（`docs(branching): 补充回合与清理的四步实操校验`），并持续在途修改 `.planning/config.json` / `.planning/state.json`。已核对：基线 `49cd2cb` 仍是 `HEAD` 祖先、我的两条提交在其之上、`git diff --diff-filter=D` 无删除、我的编辑均仍在盘上。**未做任何历史改写**，也未触碰该会话的在途文件（故 `.planning/config.json` / `state.json` 保持未提交状态由对方处置）。`actuals.commits = 3` 因此含 1 条外来提交 —— 这是**测量值**，不是叙事值。

## Known Stubs

无。本计划只改依赖声明与 lock，不产生产物代码，也没有任何占位/硬编码空值/TODO 落进交付面。

## Threat Surface

无新增威胁面。计划 `<threat_model>` 的 T-51-07 / T-51-08 / T-51-09 / T-51-10 / T-51-SC 五条均已按下述方式落地，无一条需要新增旗标：

| Threat ID | 落地证据 |
|---|---|
| T-51-07（`yaml` `[SUS]`） | Task 1 的 blocking-human 检查点（编排层派发前解决、三条确认已记录）+ Task 2 的磁盘级单实例判据（门禁二） |
| T-51-08（`yauzl` 直接消费不可信字节） | 门禁 `[OK]` 裁决 + 无 `postinstall` 的本地复判（门禁四）+ 导出面契约断言（门禁二） |
| T-51-09（双实例的**静默**解析差异） | 精确钉版 + 「嵌套副本不存在」判据；`prohibitions` 具名禁止的 `overrides` / 手删目录两条绕过路径均未使用 |
| T-51-10（产物面被顺手改动） | 门禁四断言 `asarUnpack` 恰两项、`build.files` 全 `!`；`tests/test-builtin-skills-seeder.js` 101/101 作第二道 |
| T-51-SC（安装动作本身） | 合法性门禁 + blocking-human 检查点 + 无 `postinstall` 复判 + **lock 入库**（可复现安装）|

## User Setup Required

None —— 无外部服务配置。`user_setup: []`。

## Next Phase Readiness

- **51-03 可以开工**：`yauzl` 的 Promise API（`openPromise` / `ZipFile.prototype.eachEntry` / `openReadStreamPromise` / `Entry.prototype.canDecodeFileData`）与 `yaml@2.9.0` 均已在位、版本精确、单实例。
- **留给 51-03 的显式提醒（来自研究实测 1，本计划只保证「在」，不保证「怎么用」）**：四个 `*Promise` 打开器**强制覆盖 `lazyEntries: true`**；`validateEntrySizes` 保持默认 `true`（它给的是元数据自洽性、**不是**资源上界）；`entry.canDecodeFileData()` 是开流前必判。
- **无阻塞项。** 唯一技术债形状是台账 id 38 的那条偏差记录（已闭合：修正 + 双轮探针 + 变异复验）。
- **本计划的诚实边界**：本计划**不**验证 zip 解析与 YAML 解析的**行为**（那在 51-03）；它只保证「包在、版本对、导出面在、打包面没被搅动」。

---
*Phase: 51-zip*
*Completed: 2026-09-15*

## Self-Check: PASSED

- ✅ `FOUND: .planning/phases/51-zip/51-02-SUMMARY.md`
- ✅ `FOUND: package.json` / `FOUND: package-lock.json` / `FOUND: .planning/phases/51-zip/51-02-PLAN.md`
- ✅ `FOUND: 86886e1`（Rule 1 门禁修正）/ `FOUND: 3c920a9`（Task 2 依赖落定）
- ✅ frontmatter 可解析、含 `status: complete`
- ✅ 四门禁在当前树全绿；`tests/test-builtin-skills-seeder.js` = `# tests 101 / # pass 101 / # fail 0`

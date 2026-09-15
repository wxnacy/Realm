---
phase: 51-zip
plan: 05
subsystem: 用户技能导入管线（网络地址来源：分类器 + 六道校验下载器 + 两来源同管线）
tags: [skills, import, url, github, codeload, ssrf, redirect, streaming-limit, magic-bytes, stub-server, security]
dependency-graph:
  requires:
    - 51-03（导入纵切 / 全树校验 / 唯一落盘实现 / `IMPORT_LIMITS` / 四码已在码表内）
    - 51-04（冲突三档事务 / 拒绝面矩阵与 `PENDING_CODES_NETWORK` 过渡态）
    - 51-02（`yauzl` / `yaml` 依赖已过 blocking-human 合法性闸）
    - 46/49/50（`search-manager.isPrivateHost` 单源判据 / 启用码表纪律）
  provides:
    - "`ai-skills-manager.js`：`HOST_WHITELIST`（六条）/ `MAX_REDIRECTS`（5）/ `FETCH_TIMEOUT_MS`（30 s）/ `IMPORT_URL_KIND` / `normalizeHost` / `isWhitelistedHost` / `classifyImportUrl` / `getSearchManagerLazy` / `classifyHttpFailure` / `downloadPackage(deps, opts)` / `verifyPackageBytes` / `prepareFromRawFile`（+ 六个新导出）"
    - "`ai-manager.js`：`previewSkillImport` 的 `kind === 'url'` 真实分流（分类 → 下载（404 ⇒ `fallbackRef` 重试恰一次）→ 形态校验 → 准备器 → **同一段**公共后段）"
    - "新套件 `tests/test-skills-import-net.js`（50 例：分类器值域矩阵 + 本地 stub server 的六类网络面 + 两来源端到端 + 上限单源跨文件）"
    - "`tests/test-skills-import.js` 的 `PENDING_CODES_NETWORK` **清空**（过渡态 → 完全态：21 码零跳过），并新增「网络面四码」本套件内观测组"
  affects:
    - 51-06（UI 消费 `preview.conflict.kind` 与失败码；`quota` / `diagnostics` 若要上屏须同批扩 `main.js` 响应形状）
    - 51-07（文档与账本：白名单六条与「保留为未来兼容」表述、DNS rebinding 残余风险披露、ref 缺省 main→master 策略、错误码表新增四码的用法说明、counts-parity `cells` 12 → 20）
tech-stack:
  added: []
  patterns:
    - 纯函数 URL 分类器（三种 `kind`，不设第四分支）+ 「www 归一化 + 精确成员」白名单判定
    - 逐跳三校验（协议 / 白名单 / 私网）—— 跳数超限**抛错**而不是带着 3xx 掉出
    - 流式下载：`Readable.fromWeb` + 实读字节累加 + 超限即中止 + `unlinkSync` 清半成品（`settled` 幂等）
    - 可注入依赖缝（`deps` 形参 + 参数默认值接真实实现）；生产调用点以**正命题**断言首参逐字 `undefined`
    - 「两个准备器 + 一段共用后段」—— 三条来源共用一条管线的机械形式
    - 本地 stub server + 桥接 `fetchImpl`（`https://127.0.0.1` → 本地 HTTP）+ 真实 `isPrivateHost` 只在回环放行
key-files:
  created:
    - tests/test-skills-import-net.js
  modified:
    - ai-skills-manager.js
    - ai-manager.js
    - tests/test-skills-import.js
    - tests/test-skills-management.js
decisions:
  - "分类器返回对象在计划具名的字段之外附加 `refBase`（重试基址），`fallbackRef` 与之配合实现「main 404 ⇒ master 重试恰一次」；不新增 `kind` 取值、不放宽任何判据"
  - "`SKILL.md` 判定**大小写敏感**（`isSkillMdRel`）：大小写不敏感会让 `/blob/main/x/skill.md` 被当成直链，而它实际是无载荷语义的 HTML 渲染页"
  - "白名单归一化只剥**前导** `www.` —— 这是 CR-1 的等价做法（让 `www.skills.sh` 可达），同时不放松 `github.com.evil.com` 这类形态（只剥前缀、不剥后缀）"
  - "`normalizeHost` 与 `isWhitelistedHost` 内联同一归一化表达式（刻意两份同源单行式）—— 门禁以正命题要求 `isWhitelistedHost` 函数体内出现归一化调用，而逐跳校验必须拿到归一化后的主机名做 `includes`"
  - "`verifyPackageBytes` 第三参 `contentType` 是**可选**形参（计划 artifact 表登记 `(destPath, kind)`）：content-type 只用于把错误说清楚，magic bytes 才是权威"
  - "`downloadPackage` 的字节上限**不带** `quota` 结构（它取 `download_failed` 而非 `limit_exceeded`；限额名与当前值进 message，不凭空派生 quota）"
  - "`AI 自建技能 / 上传 / 网络` 三条来源的**分流只在入参解析层**（D-03）保持不变：`main.js` 本计划**零改动**"
  - "Task 3 的端到端证据落在 **manager 层**（`runUrlPipeline` 复现同一段序列）—— 纯 Node 下 `net.fetch` 结构性不可达；生产侧等价性由源码判据守住"
metrics:
  duration: "~43 min"
  tasks: 3
  commits: 3
  files: 5
  completed: 2026-09-15
actuals:
  # chars/4 over the realized diff（added 行 74,107 字符 + removed 行 1,293 字符 ⇒ 75,400 / 4）。
  # 计划的 estimate.tokens = 130,000（confidence: low，本项目无校准样本）⇒ 实测约为其 14.5%。
  # 结构说明：本计划**零新建模块**（只扩既有两模块 + 两个套件），写入面比 51-03（63,943）略大。
  tokens: 18850
  tasks: 3
  commits: 3
  plan_head_before: db8212c493fe4fc7aa4dd89bda2923ae52dcc3c7
requirements-completed: [USER-04, SEC-08]
coverage:
  - id: D1
    description: "GitHub 三形态（仓库 / tree 子路径 / blob）与 raw 直链各自转出确定的 zipball 或 raw 目标；zipball 顶层 `<repo>-<ref>/` 前缀被剥离；`api.github.com` 与白名单外主机回 `unsupported_url` 且 message 可区分"
    requirement: USER-04
    verification:
      - kind: unit
        ref: "tests/test-skills-import-net.js#classifyImportUrl：三形态映射 + 六个拒绝面（离线值域矩阵）（28 例）"
        status: pass
      - kind: e2e
        ref: "tests/test-skills-import-net.js#zipball：剥 `<repo>-<ref>/` 顶层前缀 + 子路径定位 + 落盘 `skills/<name>/SKILL.md` + 回读可见"
        status: pass
    human_judgment: false
  - id: D2
    description: "六道校验各有独立用例且逐跳生效：https 强制 / 白名单精确匹配 / 逐跳私网 / 跳数上限（抛错）/ 流式字节上限（不留半成品）/ magic bytes"
    requirement: SEC-08
    verification:
      - kind: unit
        ref: "tests/test-skills-import-net.js#downloadPackage：逐跳三校验 / 跳数上限 / 流式上限 / 失败清理（本地 stub server）（8 例）"
        status: pass
      - kind: unit
        ref: "tests/test-skills-import-net.js#verifyPackageBytes / prepareFromRawFile：形态判定与同一个 pkgRoot 形状（6 例）"
        status: pass
    human_judgment: false
  - id: D3
    description: "直链 SKILL.md 与 zip 走**同一段**落盘链：`prepareFromRawFile` / `extractAndValidatePackage` 都只产出 `pkgRoot`，其后是同一次技能根定位 + 预览 + `importUserSkill`（判据：全仓 `importUserSkill(` 定义 1 + 调用 1、`yauzl.openPromise(` 恰 1 处）"
    requirement: USER-04
    verification:
      - kind: unit
        ref: "tests/test-skills-import-net.js#raw 直链：不做 magic 校验 + 落盘 `skills/<name>/SKILL.md` + 回读可见"
        status: pass
      - kind: unit
        ref: "tests/test-skills-import-net.js#两条来源共用同一段后段（回归护栏）：唯一落盘实现「定义 1 + 调用 1」、唯一解压入口「恰 1 处」"
        status: pass
    human_judgment: false
  - id: D4
    description: "403 / 429 / 404 给可操作的真实原因（含 `retry-after` / `x-ratelimit-remaining` 若存在）；跳数超限抛 `redirect_limit` 而不是 `HTTP 3xx`；状态码分类**先于** magic 校验"
    requirement: USER-04
    verification:
      - kind: unit
        ref: "tests/test-skills-import-net.js#403 / 429 / 404 给可操作的真实原因；**状态码分类先于** magic 校验"
        status: pass
      - kind: unit
        ref: "tests/test-skills-import-net.js#重定向链超过 MAX_REDIRECTS ⇒ redirect_limit，且文案**不含** HTTP 3xx 形态"
        status: pass
    human_judgment: false
  - id: D5
    description: "上限单源：`main.js` 的 `MAX_SKILL_PACKAGE_BYTES` 与 `IMPORT_LIMITS.MAX_TOTAL_BYTES` 相等（跨文件断言，改一处即转红）"
    requirement: SEC-08
    verification:
      - kind: unit
        ref: "tests/test-skills-import-net.js#上限单源（跨文件）：`main.js` 的 MAX_SKILL_PACKAGE_BYTES === `IMPORT_LIMITS.MAX_TOTAL_BYTES`"
        status: pass
    human_judgment: false
  - id: D6
    description: "全部网络测试离线可重跑（本地 `http.createServer` stub + 桥接注入）；真实站点形态另有一次一次性人工证据（`curl -I https://skills.sh/` 的 308 原始响应逐字进本 SUMMARY）"
    requirement: SEC-08
    verification:
      - kind: unit
        ref: "node tests/test-skills-import-net.js（50 例全绿，无任何外部网络依赖）"
        status: pass
      - kind: manual_procedural
        ref: "一次性人工证据：curl -sS -o /dev/null -D - -I https://skills.sh/（见本 SUMMARY「真实形态证据」段）"
        status: pass
    human_judgment: false
  - id: D7
    description: "真实 GitHub 端到端成功路径（`previewSkillImport({kind:'url'})` 打到真实 codeload 并落盘）—— **本计划不覆盖**，`51-VALIDATION.md` 列为 Manual-Only"
    requirement: USER-04
    verification: []
    human_judgment: true
    rationale: "纯 Node 下 `require('electron')` 返回字符串 ⇒ `net.fetch` 不存在 ⇒ 生产侧的 url 分支**结构性不可达**；真实端到端需在真实 Electron 环境（`NODE_PATH=$(npm root -g) node tests/uat-*.js` 形态）跑一次。本计划的 stub server + 桥接注入覆盖了除「真实 DNS/TLS/远端服务行为」之外的全部逻辑"
status: complete
---

# Phase 51 Plan 05: 网络地址导入（分类器 + 六道校验下载器 + 两来源同管线）Summary

把 GitHub 的三种 URL 形态分流出「zipball」与「raw 单文件」两条下载路径，经 **https 强制 /
主机白名单精确匹配 / 逐跳私网校验 / 跳数上限 / 流式字节上限 / magic bytes** 六道校验落到
临时区，再**汇入 `51-03` 的同一条管线**（同一段全树校验、同一次技能根定位、同一个落盘实现）。
P9（S2）SSRF 门禁的两条结构风险各有一组机械判据：① 直链 SKILL.md **没有**被写成第二条落盘
路径（两个准备器都只产出 `pkgRoot`）；② 逐跳校验在**每一跳**执行，跳数超限**抛错**而不是
带着最后一个 3xx 掉出（顺手修掉 `search-manager.fetchUrl` 的既有缺陷形态）。

## 三条任务的实际交付

| 任务 | 提交 | 内容 |
|------|------|------|
| 1 | `1901fcc` | `HOST_WHITELIST`（六条）/ `MAX_REDIRECTS` / `FETCH_TIMEOUT_MS` / `normalizeHost` / `isWhitelistedHost`（www 归一化 + 精确成员）/ `classifyImportUrl`（三形态映射 + 四个拒绝面 + `fallbackRef`/`refBase` 供 ref 缺省重试）；新建套件 `tests/test-skills-import-net.js` 的分类器值域矩阵 **28 例** |
| 2 | `0b8bc1d` | `getSearchManagerLazy`（惰性，私网判据单源）/ `downloadPackage(deps, opts)`（逐跳三校验 + 跳数抛错 + `Readable.fromWeb` 流式累加 + 失败 `unlinkSync`）/ `verifyPackageBytes`（zip 走 magic bytes、raw 走「非空 + 无 NUL」）/ `prepareFromRawFile`；`ai-manager.js` 的 `url` 分支真实分流（404 ⇒ `fallbackRef` 重试恰一次）；套件 28 → **42 例** |
| 3 | `6668a77` | 两来源端到端（zipball 剥前缀 + 子路径 + 落盘 + 回读；raw 直链含「按 zipball 必被拦」的对照）/ 302 链 / `skills.sh` 308 真实形态 / 403·429·404 映射 / `fallbackRef` 请求序列 / 上限单源跨文件；套件 42 → **50 例**；`tests/test-skills-import.js` 的 `PENDING_CODES_NETWORK` **清空** + 本套件内观测组（106 → **110 例**，零跳过） |

## 门禁实测结果（10 条全部在当前树上实跑）

提取 PLAN 的 `<automated>` 块并**逐字**执行（未改任何判据）。

| 门禁 | 任务 | 结果 |
|---|---|---|
| 1 分类器源码（六条白名单 + www 归一化 + 精确成员 + 两个导出） | T1 | ✅ `分类器 ok` exit 0 |
| 2 `tests/test-skills-import-net.js`（`# tests ≥ 20`） | T1 | ✅ `# tests 28 / # pass 28 / # fail 0` |
| 3 套件形态（`node:test` 自跑 + 无 `picker` + 零实时网络） | T1 | ✅ `套件形态 ok` exit 0 |
| 4 下载器源码（逐跳三校验 + `REDIRECT_LIMIT` + `fromWeb` + `unlinkSync` + 私网判据单源） | T2 | ✅ `下载器 ok` exit 0 |
| 5 url 接线（同一段后段 + 缺省依赖正命题 + 单一落盘/单一解压保持） | T2 | ✅ `url 接线 ok` exit 0 |
| 6 `tests/test-skills-import-net.js`（`# tests ≥ 35`） | T2 | ✅ `# tests 42 / # fail 0` |
| 7 `tests/test-skills-import-net.js`（`# tests ≥ 50`） | T3 | ✅ `# tests 50 / # fail 0` |
| 8 `tests/test-skills-import.js`（零跳过项） | T3 | ✅ `# tests 110 / # fail 0` + `跳过的码：0 个（）` |
| 9 网络面用例 token（两来源 + 302/308 + 403/429/404 + 上限单源 + fallbackRef） | T3 | ✅ `网络面用例 ok` exit 0 |
| 10 上限单源跨文件（`MAX_SKILL_PACKAGE_BYTES === MAX_TOTAL_BYTES`） | T3 | ✅ `上限单源 ok` exit 0 |

### 基线可失败性（把门禁对基线树 `db8212c` 实跑）

| 门禁 | 基线树实测 |
|---|---|
| T1 G1（分类器段单跑） | **exit 1**，报 5 项缺失（`HOST_WHITELIST` / `isWhitelistedHost` / `classifyImportUrl` / `MAX_REDIRECTS` / `FETCH_TIMEOUT_MS`）；整条链则先死于 `node --check tests/test-skills-import-net.js`（新套件未落地） |
| T2 G1（下载器段单跑） | **exit 1**，报 4 项缺失（`getSearchManagerLazy` / `downloadPackage` / `verifyPackageBytes` / `prepareFromRawFile`） |
| T2 G2（url 接线） | **exit 1**，报 7 条（url 分支未调 `classifyImportUrl` / 未调 `downloadPackage` / 三键默认值未接真实实现 / 缺准备器调用） |
| T3 G1 / G2 | 基线树本套件不存在 / 旧矩阵为 106 例且**4 个码被具名跳过**（`跳过的码：4 个`） |

## 单点变异证据（各确认转红后复原，复原后 `cmp` 逐字节一致）

| # | 变异 | 观测 | 结论 |
|---|---|---|---|
| M1 | `isWhitelistedHost` 的 `includes` 换成 `endsWith` | `# fail 8`，含「白名单外主机 ⇒ unsupported_url」与 `evilgithub.com` 判据 | ✅ 实测 `endsWith` 会放行 `evilgithub.com`，判据有效 |
| M2 | 去掉 `isWhitelistedHost` 的 `www.` 归一化 | `# fail 2`，含「www. 归一化的正例」 | ✅ `www.skills.sh` 会退化成「主机不在白名单」 |
| M3 | `SKILL.md` 判定改成大小写不敏感 | `# fail 1`（`skill.md` 那例） | ✅ 大小写敏感是承重判据 |
| M4 | 逐跳三校验改成 `hop === 0 &&`（只校验首跳） | `# fail 2`（第二跳私网 / 重定向逃逸两例） | ✅ **逐跳**有判别力，非只校验首跳 |
| M5 | 跳数超限的文案改成带 `HTTP ${status}` | `# fail 1`（「不含 HTTP 3xx 形态」那例） | ✅ 「抛错而不是带 3xx 掉出」有判别力 |
| M6 | 生产调用点首参 `undefined` → `deps` 变量 | 门禁 5 报「生产调用点不是缺省依赖形态」 | ✅ 正命题覆盖第一种可达形态 |
| M7 | 首参改成内联对象 `downloadPackage({ fetchImpl: … }, …)` | 门禁 5 报同一条 + 「`ai-manager.js` 出现 `fetchImpl` 1 处」 | ✅ **旧否命题判据会假绿的形态**被新正命题抓到 |
| M8 | 默认值 `hostWhitelist = HOST_WHITELIST` → `= []` | 门禁 5 报「默认 hostWhitelist 未接 HOST_WHITELIST」 | ✅ 注入缝被改成放宽值即转红 |
| M9 | 把 `PRIVATE_IP_RANGES` 写进**注释**（一对验证①） | 门禁 4 **仍绿**（`下载器 ok`） | ✅ 剥注释后判定成立（W2 纪律） |
| M10 | 把 `PRIVATE_IP_RANGES` 真写进**代码**（一对验证②） | 门禁 4 报「本模块复制了一份私网网段表」 | ✅ 一对验证成立 |
| M11 | 删掉 404 分支（状态码分类折叠成通用状态码） | `# fail 1`（403/429/404 那例） | ✅ 三个状态码各有独立可操作性 |
| M12 | `fallbackRef` 重试改成列表循环（3 个候选） | `# fail 1`（请求序列断言）+ 源码判据 | ✅ 「恰一次」有判别力 |
| M13 | `main.js` 常量 32 → 16 MiB | 门禁 10 报「已漂移」+ 套件「上限单源」转红 | ✅ 跨文件相等性是真判据 |
| M14 | `tests/test-skills-management.js` 的护栏：把 `require('electron')` 挪到模块顶层 | 该套件 `# fail 1`（收窄后的判据） | ✅ 收窄后判别力不变（见偏离 1） |

## 真实形态证据（一次性人工，逐字）

**① `skills.sh` 的 308（CR-1 的裁决依据，2026-09-15 09:01:59 GMT 实测）**：

```bash
$ curl -sS -o /dev/null -D - -I https://skills.sh/
HTTP/1.1 200 Connection Established

HTTP/2 308 
cache-control: public, max-age=0, must-revalidate
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live; ...
content-type: text/plain
date: Tue, 15 Sep 2026 09:01:59 GMT
location: https://www.skills.sh/
referrer-policy: strict-origin-when-cross-origin
refresh: 0;url=https://www.skills.sh/
server: Vercel
strict-transport-security: max-age=63072000
x-content-type-options: nosniff
x-frame-options: DENY
```

⇒ 套件里的 stub 形态（`308` + `location: https://www.skills.sh/` + `content-type: text/plain`）
与真实站点**逐项一致**。`www.` 归一化因此是必需的（否则该条目在第一跳被自己的逐跳校验拒）。

**② codeload 的 404（magic-bytes 顺序判据的依据，2026-09-15 09:02:23 GMT 实测）**：

```bash
$ curl -sS -D - -o /tmp/codeload404.bin \
    "https://codeload.github.com/anthropics/skills/zip/refs/heads/no-such-branch"
HTTP/2 404 
content-length: 14
content-type: text/plain; charset=utf-8
# 实测字节数 = 14，mime = text/plain
```

⇒ 若先按 `content-type` 拒绝，用户会拿到「不是 zip」而不是「地址 / ref 不存在」——
这就是「状态码分类**先于** magic 校验」的理由。

**套件不依赖实时外网**：`tests/test-skills-import-net.js` 的每一条网络用例要么被注入的
`fetchImpl` 顶替，要么指向 `http://127.0.0.1:<port>` 的本地 `http.createServer`；真实站点
形态只以上面两条**一次性人工证据**成文（CR-12）。

## 跨计划回归判据

- `importUserSkill(` 全仓**仍恰 2 处**（`ai-skills-manager.js` 定义 1 + `ai-manager.js` 调用 1）
  —— 直链 SKILL.md **没有**引入第二条落盘路径（T-51-36 的判据成立）。
- `yauzl.openPromise(` **仍恰 1 处**（直链分支未引入第二个解压入口）。
- `mkdtempSync(` 在 `ai-manager.js` **仍恰 1 处**（两条来源共用同一段建临时根代码）。
- `syncAgentSystemPrompt()` 函数体与基线 `db8212c` **逐字节相同**（1058 字符，`IDENTICAL: true`）。
- 三个可注入键（`fetchImpl` / `isPrivateHost` / `hostWhitelist`）在 `ai-manager.js` 出现
  **各 0 次**；生产调用点的 `downloadPackage(` 首参**逐字** `undefined`（共 3 处，全部满足）。

## 全量套件实测（本计划结束时）

| 套件 | `# tests` | `# fail` |
|---|---|---|
| `tests/test-skills-import-net.js`（**新**） | **50** | 0 |
| `tests/test-skills-import.js` | **110**（106 → 110，零跳过） | 0 |
| `tests/test-manage-skill.js` | 55 | 0 |
| `tests/test-ai-skills.js` | 198 | 0 |
| `tests/test-skill-picker-model.js` | 115 | 0 |
| `tests/test-skills-management.js` | 49 | 0 |
| `tests/test-skills-http-api.js` | 41 | 0 |
| `tests/test-builtin-skills-seeder.js` | 101 | 0 |
| `tests/test-agent-workspace.js` | 38 | 0 |
| `tests/test-ai-bash-policy.js` | 97 | 0 |

## 账本刷新

**本计划未改任何账本单元**（与 `51-04` 同款）。`counts-parity` 实测
`cells=16 measured={"test-manage-skill.js":"55","test-ai-skills.js":"198","test-skill-picker-model.js":"115","test-skills-management.js":"49","test-skills-http-api.js":"41"}`
—— 五个既有套件例数**一字未动**（本计划只改 `test-skills-import.js` 与新建
`test-skills-import-net.js`，两者都尚未进该判据的 `suites` 列表）。两个新套件的账本单元与
`cells 12 → 20` 由 **51-07** 交付（其 PLAN 的 artifact 表已具名）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 既有护栏「`ai-skills-manager.js` 零 electron 依赖」对任何正确实现恒红**

- **Found during:** Task 2（首次跑全量套件时）
- **Issue:** `tests/test-skills-management.js:470` 的判据是
  `/require\(['"]electron['"]\)/.test(src) === false` —— 对**源码任何位置**出现的
  `require('electron')` 都转红。而门禁 5 以**正命题**要求 `downloadPackage` 的参数默认值
  表达式里出现 `net.fetch` 字面量（即 `fetchImpl = (u, o) => require('electron').net.fetch(u, o)`），
  两条要求直接冲突 ⇒ 原判据必然红。
- **Fix:** 按同仓 `tests/test-builtin-skills-seeder.js:520` 的既有先例，把判据收窄为
  **模块加载期**零依赖：「顶层语句里不得出现 `require('electron')`」+「每个出现点必须在
  缩进行（函数体内）」。判别力不变 —— 把 `require` 挪到模块顶层即转红（M14 反向验证）。
- **Files modified:** `tests/test-skills-management.js`
- **Commit:** `0b8bc1d`

### 未改动的偏离（如实记录，不修）

- **`quota` / `diagnostics` 仍不到客户端**：`main.js` 的两个 `catch` 分支仍只回
  `{ error, code }`（本计划**零改 main.js**，计划 artifact 表也未列它）。网络面的
  `download_failed` / `redirect_limit` 的**可操作原因全在 message 里**（不是结构化字段），
  因此这两码不受影响；受限的是限额类的 `quota`。若要上屏须 51-06 同批扩响应形状。
  （`51-04` 已登记，本条是它的延续确认。）
- **`verifyPackageBytes` 的可选第三参 `contentType`** 与 **`classifyImportUrl` 的附加字段
  `refBase`**：计划 artifact 表登记的形状分别是 `(destPath, kind)` 与
  `{ kind, target, scopeRel, ref, code?, message? }`。两处都是**加成式**偏离（可选形参 /
  附加键），且各有计划正文支撑（「message 用 content-type 补充」「`fallbackRef` 供 404 重试」），
  不放宽任何判据。已登记进 `.planning/WINDOWS.md`。
- **Task 3 的端到端证据落在 manager 层**（`runUrlPipeline` 复现同一段调用序列）而非
  `previewSkillImport`：纯 Node 下 `net.fetch` 不存在 ⇒ 生产侧 url 分支结构性不可达。
  生产侧等价性由源码判据守住（`locateSkillRoot(` / `buildImportPreview(` 在 `ai-manager.js`
  各恰 1 处调用 + 门禁 5 的整段断言）。已登记进 `.planning/WINDOWS.md`。

## 已知盲区 / 诚实边界

1. **DNS rebinding 残余风险（D-16，必须进 51-07 的文档）**：`isPrivateHost` 走 Node
   `dns.lookup`，而实际请求走 Electron `net.fetch`（Chromium 网络栈，可能走系统代理 / DoH /
   不同 resolver）⇒ **被校验的 IP ≠ 被连接的 IP**，属「先解析再请求」的固有 TOCTOU。
   白名单是**缓解**（把可利用面压到接近零），**不是消除**。**不得**写成「已缓解 / 已消除」。
2. **门禁自带剥注释器在 `ai-skills-manager.js` 上有状态机错位盲窗**（本轮实测）：`yamlScalar`
   的 `.replace(/'/g, "''")` 是**含引号的正则字面量**，而该剥注释器无 regex 态 ⇒ 从该处起状态
   漂移，**第 136..2489 行的注释未被剥离**（实测 state=3 覆盖该区间，之后自行闭合）。后果：
   落在窗口内的注释会被当作代码计入。本计划的规避方式是把新增段头部注释里的
   `importUserSkill(` / `yauzl.openPromise(` 字面量改写成无括号措辞（**计划判据一字未改**）。
   ⚠️ 后续计划若要在该窗口内写这些 token 的注释，须先修剥注释器或换措辞。已登记进
   `.planning/WINDOWS.md`。
3. **`www.` 归一化的副作用（如实登记）**：`www.github.com` 会被归一化成 `github.com` 而进入
   白名单。这是「只剥前导 `www.`」这条简单规则的必然结果（CR-1 的等价做法），收益是
   `www.skills.sh` 可达；风险接近零（GitHub 的 `www` 主机同样由 GitHub 运营，且实际请求仍要过
   `isPrivateHost` 与 https）。**不得**据此把归一化扩展成「剥任意子域」。
4. **`ref` 含 `/` 的地址无法表达**：`tree/<ref>/<path>` 的形态决定了 `ref` 不能含斜杠
   （`segs[3]` 恒为 ref）。带斜杠的分支名（如 `feature/x`）需用户改用 `blob` 直链或
   `codeload` 直连地址。这是 URL 形态的固有限制，不是实现缺陷。
5. **重定向链的请求次数上界**：`for (let hop = 0; hop <= MAX_REDIRECTS; hop++)` ⇒ 最多
   `MAX_REDIRECTS + 1 = 6` 次请求（5 次跳转 + 第 6 次拿最终响应）。用例以
   `stub.hits.length <= MAX_REDIRECTS + 1` 断言上界，不是「恰好 6 次」。
6. **raw 分支的「文本」判据是启发式**：「非空 + 前 512 字节无 NUL」拦不住「二进制但无 NUL」
   的载荷。后果有限：该载荷随后要过 `parseSkillFrontmatter` 与全树校验，且**落盘前用户要
   看预览**。真正的边界是「预览确认 + 沙箱」，不是这条判据。
7. **流式上限命中后的清理顺序**：`pipeline` 拒绝后立刻 `unlinkSync(destPath)`。Node 的
   `pipeline` 会先销毁全部流再 reject ⇒ 用例（`fs.existsSync(destPath) === false`）稳定通过；
   但若未来把 `destPath` 换成另一文件系统的路径，`unlinkSync` 与 stream 的 `close` 之间可能出现
   竞态 —— 当前形态下两者同在 `mkdtemp` 出来的临时目录内，无此问题。
8. **`FETCH_TIMEOUT_MS` 与 `search-manager` 的同名量刻意独立**：导入是用户交互路径，超时体感
   与后台搜索不同。两者**不共享**常量是有意选择，不是遗漏。

## Threat Flags

无新增安全面 —— 本计划引入的全部网络面都在 `<threat_model>` 的
T-51-31/32/34/35/36/37/38 覆盖范围内，且逐条有对应用例（逐跳私网 / 重定向逃逸 / magic bytes
顺序 / 流式上限与半成品清理 / 两来源同管线 / 缺省依赖正命题 / 403·429·404 可操作性）。
T-51-33（DNS rebinding）按计划**如实接受并披露**（见「已知盲区」第 1 条），未声称已缓解。
T-51-SC（npm / pip / cargo 安装）：本计划**零安装动作**（依赖由 51-02 落地并已过
blocking-human 合法性闸）。

## Self-Check

- 创建文件存在性：`tests/test-skills-import-net.js` ✅
- 提交存在性：`1901fcc` ✅ / `0b8bc1d` ✅ / `6668a77` ✅
- 计数：`git rev-list --count db8212c493fe4fc7aa4dd89bda2923ae52dcc3c7..HEAD` = **3**
  （与 `commits: 3` 一致，MEASURED；无外来提交插入）
- `syncAgentSystemPrompt()` 函数体与基线 sha **逐字节相同**（1058 字符，`IDENTICAL: true`）
- 未触碰 `STATE.md` / `ROADMAP.md`（编排器所有）；`.planning/WINDOWS.md` 已追加 4 条
- `counts-parity ok cells=16`（五个既有套件例数一字未动）

**Self-Check: PASSED**

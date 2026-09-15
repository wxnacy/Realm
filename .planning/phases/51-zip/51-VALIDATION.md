---
phase: "51"
slug: "zip"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-15"
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 来源：`.planning/phases/51-zip/51-RESEARCH.md` §Validation Architecture（实测校准）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test`（Node 内建，零依赖）+ `node:assert`；zip 夹具生成用 `python3` 或 Node 手写字节 |
| **Config file** | none — 仓内无 jest/vitest/pytest 配置；**`package.json.scripts` 没有 `test` 脚本**（实测） |
| **Quick run command** | 按改动面选一个：`node tests/test-skills-import.js` / `node tests/test-skills-import-net.js` / `node tests/test-agent-workspace.js` / `node tests/test-skills-http-api.js` / `node tests/test-ai-skills.js` |
| **Full suite command** | `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node tests/test-skill-picker-model.js && node tests/test-skills-management.js && node tests/test-skills-http-api.js && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js && node tests/test-skills-import.js && node tests/test-skills-import-net.js` |
| **Estimated runtime** | 既有七套件 ≈ 4 s + 两个新套件实测 ≈ 2 s（`test-skills-import` 116 例 + `test-skills-import-net` 50 例，均含 zip 夹具生成）⇒ **实测 9 套件串跑 ≈ 6 s** |

⚠️ **两种跑法并存**：既有 24 个套件里 20 个用 `node tests/<file>.js`（自跑）、4 个是 plain node 脚本。**本阶段新增两个套件统一用 `node tests/<file>.js`**，且**套件名里不得出现 `picker`** —— counts-parity 脚本按文件名是否含 `picker` 决定是否插 `--test`。

⚠️ **禁止 `npm test`**：本项目没有该脚本，两处 gate 恒把它解析成不存在的脚本，任何 `<automated>` 都必须具名。

⚠️ **runtime 断言面（本阶段特有）**：任何**真实渲染 / 真 Chromium** 驱动必须 `NODE_PATH="$(npm root -g)" node tests/uat-51-*.js`（`playwright` 只在全局，仓内 `require.resolve` 失败）。

---

## Sampling Rate

- **After every task commit:** 该 task 触及的套件（改导入面 → `node tests/test-skills-import.js`；改网络面 → `node tests/test-skills-import-net.js`；改沙箱 → `node tests/test-agent-workspace.js`；改路由 / body 读取 → `node tests/test-skills-http-api.js`；改扫描表 → `node tests/test-ai-skills.js`）
- **After every plan wave:** Full suite command（上方 9 个套件）
- **Before `/gsd:verify-work`:** Full suite 必须全绿 + `counts-parity` 通过（**新套件已加进该命令的 `suites` 数组、`cells` 下限已提到 20，两个新套件的例数已写进 `AGENTS.md` **与** `docs/product/ai-skills.md` **两处**账本 —— 收口实测 `counts-parity ok cells=20`**）
- **Max feedback latency:** 20 秒（实测 9 套件串跑 ≈ 6 秒）

---

## Per-Task Verification Map

> `Task ID` / `Plan` / `Wave` / `File Exists` 四列已由 executor 回填（Task ID 取各 PLAN 里**真实存在**的 `Task N`）。
> ⚠️ **`Status` 列保持 `⬜ pending`** —— 该列由 `/gsd:verify-work` 回填，本文件不在计划内。
> **Threat Ref** 列对应 `51-RESEARCH.md` §Security Domain 的威胁表与 P2 / P4 / P9 门禁归属。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-03-T1 | 03 | 2 | USER-05 | — | 两阶段：preview 返回 `{importId, preview}` 且**不落盘**；commit 才落盘；预览六字段齐备 | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-03-T1 | 03 | 2 | USER-03 | P4 | zip 单技能包语义：0 根 / >1 根 → 拒绝并给可操作提示（含实测 20 根的例子）；恰 1 根 → 预览 | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-05-T1 | 05 | 4 | USER-04 | P9 | URL 三形态分流（仓库 / `tree/<ref>/<path>` / raw 与 blob 直链）+ zipball 顶层前缀剥离 + 子路径定位 | unit（**本地 stub server**，不发外网） | `node tests/test-skills-import-net.js` | ✅ tests/test-skills-import-net.js | ⬜ pending |
| 51-04-T3 | 04 | 3 | USER-08 | — | 每条拒绝路径给定码 + 可读原因（含「命中哪个限额 / 当前值」）；**判据矩阵：每个错误码至少一例** | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-03-T2 | 03 | 2 | SEC-02 | P2 | symlink entry **整包拒绝**：central-directory 属性路 + 解压后递归 `lstat` 路**分别**测；断言点是「整包拒绝」不是「跳过条目」 | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-03-T2 | 03 | 2 | SEC-03 | P4 | 逃逸族七类逐类一例（`path.posix.normalize` **之后**判）+ **六类实测漏网**（ADS / 控制字符 / NUL / 尾随空格与点 / `a//b` / RTL）+ NFD + 小写查重（大小写各一例、NFC/NFD 各一例） | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-03-T2 | 03 | 2 | SEC-04 | P7 | 六类限额逐类一例（单 entry / 累计 / entry 数 / **压缩比** / 嵌套深度（**按技能根相对计**）/ `SKILL.md` 64 KiB），**含 ZIP64 与 `uncompressedSize === 0xFFFFFFFF` 两形态** | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-03-T1 | 03 | 2 | SEC-05 | P2 | 解压只在 `mkdtempSync` 空目录内；落点用「最近已存在祖先 realpath」；**真跑一次越界对照组**（不是断言「没写过」） | integration（真 fs） | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-03-T3 | 03 | 2 | SEC-06 | P3 后半 | `SKILL_THREAT_PATTERNS` 三类值域（**必须带正命题**：正样本命中 + `skills-builtin/**` 语料**零命中**回归 + 否定语境护栏对 `find-skills` 零误伤）；description 与 body 双扫 | unit | `node tests/test-ai-skills.js`（增补） | ✅ 增补（198 例） | ⬜ pending |
| 51-04-T1 | 04 | 3 | SEC-07 | P3 后半 | seeded 同名拒导入；user 同名三选一（覆盖 / 改名 / 取消）；改名走 `validateManagedSkillName`；managed 同名不许覆盖 | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-05-T2 | 05 | 4 | SEC-08 | P9 | 白名单**精确匹配**（含 `evilgithub.com` / `github.com.evil.com` 反例）/ `http:` 拒绝 / 逐跳私有地址拒绝 / **跳数超限抛错**（不是报 `HTTP 3xx`）/ magic bytes 不匹配拒绝 / 流式字节上限 | unit（stub server） | `node tests/test-skills-import-net.js` | ✅ tests/test-skills-import-net.js | ⬜ pending |
| 51-01-T1 | 01 | 1 | SEC-10 | P2 | `resolveInsideForWrite`：逃逸转拒 + **自指链接仍放行** + 既有放行 / 拒绝集合零变化；`createSandboxEnv` 全部写面已切换（源码扫描） | unit | `node tests/test-agent-workspace.js`（增补） | ✅ 增补（38 例） | ⬜ pending |
| 51-03-T1 | 03 | 2 | （D-01） | — | `readRawBody` 超限 413 + 可 `JSON.parse` + `limit` 回传 + `req.resume()` + 无 `destroy` / `Connection` + **无 `unhandledRejection`** + 反向对照 | unit | `node tests/test-skills-http-api.js`（增补，四组 + 源码契约组） | ✅ 增补（41 例） | ⬜ pending |
| 51-03-T1 | 03 | 2 | （D-03 / D-07） | P9 | **只有一个落盘函数调用点**（源码扫描）+ 三种来源都汇入它 | unit（源码扫描） | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-04-T2 | 04 | 3 | （D-02） | — | TTL 过期码（`import_expired`）+ 并发上限 + 崩溃残留清扫 + `importId` 不可预测 / 不透明 | unit | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-04-T1 | 04 | 3 | （D-09 / D-10） | — | 覆盖两段 rename 回滚（第二步注错 → 旧技能完好）+ 落盘后回读验证失败即回滚 | integration（真 fs） | `node tests/test-skills-import.js` | ✅ tests/test-skills-import.js | ⬜ pending |
| 51-03-T3 | 03 | 2 | （D-19） | P8 | 导入成功 = 重扫**恰一次** + 调用侧补播**恰一次**；`syncAgentSystemPrompt()` 函数体未改（方法体断言） | unit | `node tests/test-ai-skills.js`（增补） | ✅ 增补（198 例） | ⬜ pending |
| 51-06-T2 | 06 | 5 | （UI） | TD-48-01 | 未勾选风险复选框不得提交；预览卡片渲染不可信字符串走安全转义（**属性上下文**） | manual / uat 驱动（**已自动化**） | `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` | ✅ tests/uat-51-import-modal.js（52 项断言） | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/test-skills-import.js` —— 新增套件（zip 校验 / 限额 / 冲突 / 覆盖回滚 / TTL / 回读验证）—— **落地实测 116 例**
- [x] `tests/test-skills-import-net.js` —— 新增套件（URL 分流 / 白名单 / 逐跳 / 跳数 / magic bytes；**本地 stub server**）—— **落地实测 50 例**
- [x] **夹具生成器（恶意样本）固化进仓库** —— 落点为 `tests/helpers/make-malicious-zip.js`（**不是** `/tmp`）。已覆盖：symlink（file / dir / 混装）、非普通文件、逃逸族、冲突名（大小写 + NFC/NFD）、炸弹（高压缩比 / 多条目 / 深目录）、`0xFFFFFFFF`、加密条目、不支持的方法、空包、zip64
- [x] `tests/test-agent-workspace.js` 增补 —— `resolveInsideForWrite` 的逃逸转拒 + 自指链接放行 + `createSandboxEnv` 写面切换的源码契约（21 → **38 例**）
- [x] `tests/test-skills-http-api.js` 增补 —— `readRawBody` 的四组 + 源码契约组（`maxBytes` 用 `MAX_SKILL_PACKAGE_BYTES`）（32 → **41 例**）
- [x] `tests/test-ai-skills.js` 增补 —— `SKILL_THREAT_PATTERNS` 三类值域（**带正命题**）+ D-19 的「恰一次」计数断言（187 → **198 例**）
- [x] **语料回归夹具** —— `tests/fixtures/skill-corpus/*.md` 已固化（威胁扫描的**零误伤基线**），**不依赖实时网络**
- [x] counts-parity 命令同步 —— `suites` 数组加两个新套件 + `cells` 下限 12 → **20** + `AGENTS.md` 与 `docs/product/ai-skills.md` **两处**都补新套件的例数账本单元 —— **收口实测 `counts-parity ok cells=20`**
- [x] Framework install：**none**（`node:test` 内建）

---

## Manual-Only Verifications

> 本表**保持人工面身份**，**不得**整表标成已自动化。下表逐项标注本阶段**实际跑过什么**与**仍未跑什么**。

| Behavior | Requirement | Why Manual | 本阶段实际状态 | Test Instructions |
|----------|-------------|------------|---------------|-------------------|
| 网络导入对**真实** GitHub 的端到端成功路径（真实 zipball 下载 → 顶层前缀剥离 → 单技能落地 → 回读可见） | USER-04 | 自动化套件用 stub server（不得依赖实时外网），真实网络只能人工跑一次 | **已自动化（`/gsd-verify-work 51` 新增驱动）** —— `NODE_PATH="$(npm root -g)" node tests/uat-51-import-live.js` 实测 **29/29 全过**，证据固化在 `tests/.uat-out/uat-51-import-live.json`。含：真实 zipball（3,988,166 B / 512 entry）顶层前缀恰为单一 `skills-main/` 的 Node 侧交叉核对；经真实设置页 UI 的 `tree/main/skills/pdf` 导入（预览 927 ms 就绪、六字段齐备）；落盘 `skills/pdf/SKILL.md` 的 **sha256 与上游逐字节相同**；组件列表 19→20；`/` 面板出现 `/pdf`；`/skill:pdf` 真实发送后在主进程侧**旁路捕获**到 provider 请求体含 `<skill name="pdf" location="…">` 与技能真实正文。⚠️ **本项首次运行即发现 CR-02（`downloadPackage` 无绑定 ⇒ 网络导入 100% ReferenceError），修复后转全绿** | ① 设置页 → AI → 技能管理 → 导入技能 → 网络地址；② 填一个含**恰好一个**技能根的仓库 `tree/<ref>/<path>` 地址；③ 断言预览六字段齐备 → 确认 → 组件列表出现该技能、`/` 面板可见、下一条消息技能进 prompt；④ 复跑 `curl -sIL <zipball url>` 交叉核对前缀形态 |
| 403 / 429 的限流提示文案是否可操作 | USER-08 | 需要真实触发 GitHub 未鉴权限流（60 req/h） | **部分自动化（`/gsd-verify-work 51` 新增驱动，边界如实标注）** —— 同一驱动的 ⑥ 段实测：**真实 404** 走真链路（`tree/<不存在的 ref>/…` ⇒ codeload 真 404，文案含「已尝试 main / master」）；**403 / 429 未真实触发**（导入链路只打 `codeload.github.com`，而未鉴权 60 req/h 配额打在 `api.github.com`，二者不是同一配额域 ⇒ 打满 api 配额不会让导入返 403），改用 `net.fetch` 单点替身返回真实形状响应头（`x-ratelimit-remaining: 0` / `retry-after: 42`），**其余全部走真链路**。实测文案：403 `访问被拒（HTTP 403），剩余配额 0，请稍后重试或改用本地上传`；429 `触发远端限流（HTTP 429），请于 42 秒后重试`。证据里标 `substituted: true` | 连续多次导入直到命中限流，断言提示含「限流」与重试指引，且**不**是静默失败 |
| 32 MiB 上传在本机 Electron 的真实耗时与内存峰值 | （D-01） | 研究在真实 Chromium 下测得 26 ms / 堆持平，但绝对值需本机复核 | **已自动化（`/gsd-verify-work 51` 新增驱动）** —— `node tests/uat-51-import-limits.js` 实测 **21/21 全过**。近限包（解压总量 31,744,134 B / 32 条目，**在 guest 内现场生成、不经 CDP 传字节**）上传 **906～1059 ms** 就绪；主进程 RSS 增量 ≈90.7 MiB（正命题：真的过了线）；确定性源码判据（剥注释后）断言导入区与 `readRawBody` 零 `arrayBuffer`/`FileReader` 且 `body` 逐字是 File 直传（含三条**单点变异自证**）；64 MiB 超限包 ⇒ `请求体超过上限（33554432 字节）` 且 RSS 增量仅 1,409,024 B（上限如实为 32 MiB）。⚠️ **guest JS 堆曲线只登记不断言**：`performance.memory` 量化且与 GC 强耦合，显式 `arrayBuffer()` 的标定增量实测为**负值**，做不出可靠两侧判据 | dev 模式打开 DevTools Performance，上传一个接近 32 MiB 的包，记录耗时与堆曲线；确认无「先 arrayBuffer() 再判大小」的峰值 |
| 预览卡片在真实设置页 CSP 下的渲染（两 tab 弹框 / 目录树折叠 / 脚本标红 / 高亮 + 必勾 / 冲突三选一） | USER-05 | 需要 `realm://settings` 的真实 CSP 环境与真实布局 | **已自动化（本阶段新增 uat 驱动）** —— `NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js` 实测 **52 项断言全过**（`uat-51-import-modal: 52 passed`），证据固化在仓库内 `tests/.uat-out/uat-51-import-modal.json`；**残余人工面已补齐** —— `node tests/uat-51-import-modal-sizes.js` 实测 **48/48 全过**（5 档矩阵：guest 实测内容宽 420 / 600 / 880 / 1280 / 1920，窗口尺寸由自标定偏移反推），每档逐条判「总高 ≤ 80vh / 滚动只在预览区 / 动作区不横向溢出 / 按钮不被裁切」+ 四类元素齐备 + 反恒真（5 个互不相同的宽度） | 打开设置页 → 导入技能；断言：初始隐藏靠 CSS 类生效（无内联 style 闪现）、勾选前提交按钮不可用、目录树计数与实测总条目一致、脚本清单标红、属性上下文里的不可信字符串未逃逸 |
| `skills.sh` / `www.skills.sh` 白名单条目的真实可达性（CR-1） | SEC-08 | 需真实 308 跳转链 | **已跑一次（一次性人工，原始响应逐字留档在 `51-05-SUMMARY.md`）** —— `curl -sIL https://skills.sh/` ⇒ 308 + `location: https://www.skills.sh/` + `text/plain`；主机匹配按「去 `www.` 前缀后比对」使其可达。**未跑**：用导入管线对该地址实跑一次完整导入 | `curl -sIL https://skills.sh/` 确认 308 → `www.skills.sh`；再用导入管线实跑一次，断言逐跳校验通过（而不是在第一跳被自己的白名单拒） |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies（九个套件的 automated 门禁逐条实跑）
- [x] Sampling continuity: no 3 consecutive tasks without automated verify（每个 plan 的每个 task 都带 `<automated>` 块）
- [x] Wave 0 covers all MISSING references（两个新套件 + 夹具生成器 + 语料回归夹具 + counts-parity 同步全部落地）
- [x] No watch-mode flags（全部为一次性 `node tests/<file>.js` / `node --test tests/<file>.js`）
- [x] Feedback latency < 20s（实测 9 套件串跑 ≈ 6 秒）
- [x] counts-parity 通过（7 套件版，收口实测 `cells=20`；逐套件覆盖断言在位）
- [ ] `nyquist_compliant: true` set in frontmatter —— **不在本阶段自证**，由 `/gsd:validate-phase` 判定

**Approval:** pending

---

## 本阶段未完成的技术债（如实挂账，本文件不作任何越界声明）

- `TD-48-01`（`escapeHtml` 只转义 `& < >`、不转义引号）—— **仍开未修**；本阶段导入面的责任是**不扩大缺口**（预览区零 HTML 字符串模板、全部走 DOM API 赋值），**不声称已修**。
- `#skillImportGate` 的禁用原因变化**不在 live region 内**（靠可见文本承载，但读屏不会自动播报）。
- `/api/skills/set-disabled` **无存在性校验**（50 收尾带出，本阶段按需求边界不处置）。
- **`syncAgentSystemPrompt()` 的份额必须分开记两个数**：本阶段完成后**写路径**收口达 **3/3**（49 的 `manage_skill` + 50 的启停 / 卸载 + 51 的导入）；**读侧 / 兜底**（`refreshSkillsForPanel()` / `ensureSkillsFresh()`）**不是同一个量**，**不得**声称 P8 失效链 6/6 全覆盖。

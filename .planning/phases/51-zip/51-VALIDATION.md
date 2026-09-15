---
phase: "51"
slug: "zip"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Estimated runtime** | 既有七套件 ≈ 4 s（`50-VALIDATION.md` 实测）+ 两个新套件估计 ≤ 10 s（zip 夹具生成 + 32 MiB 上传用例为主）⇒ **≤ 20 s** |

⚠️ **两种跑法并存**：既有 24 个套件里 20 个用 `node tests/<file>.js`（自跑）、4 个是 plain node 脚本。**本阶段新增两个套件统一用 `node tests/<file>.js`**（与待增补的四个套件一致），且**套件名里不得出现 `picker`** —— counts-parity 脚本按文件名是否含 `picker` 决定是否插 `--test`。

⚠️ **禁止 `npm test`**：本项目没有该脚本，两处 gate 恒把它解析成不存在的脚本，任何 `<automated>` 都必须具名。

⚠️ **runtime 断言面（本阶段特有）**：任何**真实渲染 / 真 Chromium** 驱动必须 `NODE_PATH="$(npm root -g)" node tests/uat-51-*.js`（`playwright` 只在全局，仓内 `require.resolve` 失败）。

---

## Sampling Rate

- **After every task commit:** 该 task 触及的套件（改导入面 → `node tests/test-skills-import.js`；改网络面 → `node tests/test-skills-import-net.js`；改沙箱 → `node tests/test-agent-workspace.js`；改路由 / body 读取 → `node tests/test-skills-http-api.js`；改扫描表 → `node tests/test-ai-skills.js`）
- **After every plan wave:** Full suite command（上方 9 个套件）
- **Before `/gsd:verify-work`:** Full suite 必须全绿 + `counts-parity` 通过（**须先把新套件加进该命令的 `suites` 数组与 `cells` 下限**，并把两个新套件的例数写进 `AGENTS.md` **与** `docs/product/ai-skills.md` **两处**账本）
- **Max feedback latency:** 20 秒

---

## Per-Task Verification Map

> Task ID / Plan / Wave 由 planner 填充（本表先按需求与验证类型建档，executor 逐行回填 `Status`）。
> **Threat Ref** 列对应 `51-RESEARCH.md` §Security Domain 的威胁表与 P2 / P4 / P9 门禁归属。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-?? | 01 | 1 | USER-05 | — | 两阶段：preview 返回 `{importId, preview}` 且**不落盘**；commit 才落盘；预览六字段齐备 | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | USER-03 | P4 | zip 单技能包语义：0 根 / >1 根 → 拒绝并给可操作提示（含实测 20 根的例子）；恰 1 根 → 预览 | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | USER-04 | P9 | URL 三形态分流（仓库 / `tree/<ref>/<path>` / raw 与 blob 直链）+ zipball 顶层前缀剥离 + 子路径定位 | unit（**本地 stub server**，不发外网） | `node tests/test-skills-import-net.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | USER-08 | — | 每条拒绝路径给定码 + 可读原因（含「命中哪个限额 / 当前值」）；**判据矩阵：每个错误码至少一例** | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-02 | P2 | symlink entry **整包拒绝**：central-directory 属性路 + 解压后递归 `lstat` 路**分别**测；断言点是「整包拒绝」不是「跳过条目」 | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-03 | P4 | 逃逸族七类逐类一例（`path.posix.normalize` **之后**判）+ **六类实测漏网**（ADS / 控制字符 / NUL / 尾随空格与点 / `a//b` / RTL）+ NFD + 小写查重（大小写各一例、NFC/NFD 各一例） | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-04 | P7 | 六类限额逐类一例（单 entry / 累计 / entry 数 / **压缩比** / 嵌套深度（**按技能根相对计**）/ `SKILL.md` 64 KiB），**含 ZIP64 与 `uncompressedSize === 0xFFFFFFFF` 两形态** | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-05 | P2 | 解压只在 `mkdtempSync` 空目录内；落点用「最近已存在祖先 realpath」；**真跑一次越界对照组**（不是断言「没写过」） | integration（真 fs） | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-06 | P3 后半 | `SKILL_THREAT_PATTERNS` 三类值域（**必须带正命题**：正样本命中 + `skills-builtin/**` 语料**零命中**回归 + 否定语境护栏对 `find-skills` 零误伤）；description 与 body 双扫 | unit | `node tests/test-ai-skills.js`（增补） | ✅ 增补 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-07 | P3 后半 | seeded 同名拒导入；user 同名三选一（覆盖 / 改名 / 取消）；改名走 `validateManagedSkillName`；managed 同名不许覆盖 | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-08 | P9 | 白名单**精确匹配**（含 `evilgithub.com` / `github.com.evil.com` 反例）/ `http:` 拒绝 / 逐跳私有地址拒绝 / **跳数超限抛错**（不是报 `HTTP 3xx`）/ magic bytes 不匹配拒绝 / 流式字节上限 | unit（stub server） | `node tests/test-skills-import-net.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | SEC-10 | P2 | `resolveInsideForWrite`：逃逸转拒 + **自指链接仍放行** + 既有放行 / 拒绝集合零变化；`createSandboxEnv` 全部写面已切换（源码扫描） | unit | `node tests/test-agent-workspace.js`（增补） | ✅ 增补 | ⬜ pending |
| 51-0?-?? | ?? | ?? | （D-01） | — | `readRawBody` 超限 413 + 可 `JSON.parse` + `limit` 回传 + `req.resume()` + 无 `destroy` / `Connection` + **无 `unhandledRejection`** + 反向对照 | unit | `node tests/test-skills-http-api.js`（增补，四组 + 源码契约组） | ✅ 增补 | ⬜ pending |
| 51-0?-?? | ?? | ?? | （D-03 / D-07） | P9 | **只有一个落盘函数调用点**（源码扫描）+ 三种来源都汇入它 | unit（源码扫描） | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | （D-02） | — | TTL 过期码（`import_expired`）+ 并发上限 + 崩溃残留清扫 + `importId` 不可预测 / 不透明 | unit | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | （D-09 / D-10） | — | 覆盖两段 rename 回滚（第二步注错 → 旧技能完好）+ 落盘后回读验证失败即回滚 | integration（真 fs） | `node tests/test-skills-import.js` | ❌ W0 | ⬜ pending |
| 51-0?-?? | ?? | ?? | （D-19） | P8 | 导入成功 = 重扫**恰一次** + 调用侧补播**恰一次**；`syncAgentSystemPrompt()` 函数体未改（方法体断言） | unit | `node tests/test-ai-skills.js`（增补） | ✅ 增补 | ⬜ pending |
| 51-0?-?? | ?? | ?? | （UI） | TD-48-01 | 未勾选风险复选框不得提交；预览卡片渲染不可信字符串走安全转义（**属性上下文**） | manual / uat 驱动 | `NODE_PATH="$(npm root -g)" node tests/uat-51-*.js` | ❌ W0（可选） | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-skills-import.js` —— 新增套件（zip 校验 / 限额 / 冲突 / 覆盖回滚 / TTL / 回读验证）
- [ ] `tests/test-skills-import-net.js` —— 新增套件（URL 分流 / 白名单 / 逐跳 / 跳数 / magic bytes；**本地 stub server**）
- [ ] **夹具生成器（恶意样本）固化进仓库** —— `tests/fixtures/skill-packages/` 或 `tests/helpers/make-malicious-zip.js`。**不得只留 `/tmp`**（`IN-16` / `WR-09` 教训）。至少覆盖：symlink（file / dir / 混装）、非普通文件（chrdev / fifo / socket）、逃逸族 12 例、冲突名 4 例（大小写 2 + NFC/NFD 2）、炸弹 3 例（高压缩比 / 多条目 / 深目录）、`0xFFFFFFFF`、加密条目、不支持的方法、空包、data descriptor、zip64
- [ ] `tests/test-agent-workspace.js` 增补 —— `resolveInsideForWrite` 的逃逸转拒 + 自指链接放行 + `createSandboxEnv` 写面切换的源码契约
- [ ] `tests/test-skills-http-api.js` 增补 —— `readRawBody` 的四组 + 源码契约组（`maxBytes` 用 `MAX_SKILL_PACKAGE_BYTES`）
- [ ] `tests/test-ai-skills.js` 增补 —— `SKILL_THREAT_PATTERNS` 三类值域（**带正命题**）+ D-19 的「恰一次」计数断言
- [ ] **语料回归夹具** —— 把 `skills-builtin/**`（已在仓）与 `anthropics/skills` 的若干技能正文固化为威胁扫描的**零误伤基线**（后者**必须固化文本或改精简样本，不得依赖实时网络**）
- [ ] counts-parity 命令同步 —— `suites` 数组加两个新套件 + `cells` 下限调整 + `AGENTS.md` 与 `docs/product/ai-skills.md` **两处**都补新套件的例数账本单元
- [ ] Framework install：**none**（`node:test` 内建）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 网络导入对**真实** GitHub 的端到端成功路径（真实 zipball 下载 → 顶层前缀剥离 → 单技能落地 → 回读可见） | USER-04 | 自动化套件用 stub server（不得依赖实时外网），真实网络只能人工跑一次 | ① 设置页 → AI → 技能管理 → 导入技能 → 网络地址；② 填一个含**恰好一个**技能根的仓库 `tree/<ref>/<path>` 地址；③ 断言预览六字段齐备 → 确认 → 组件列表出现该技能、`/` 面板可见、下一条消息技能进 prompt；④ 复跑 `curl -sIL <zipball url>` 交叉核对前缀形态 |
| 403 / 429 的限流提示文案是否可操作 | USER-08 | 需要真实触发 GitHub 未鉴权限流（60 req/h） | 连续多次导入直到命中限流，断言提示含「限流」与重试指引，且**不**是静默失败 |
| 32 MiB 上传在本机 Electron 的真实耗时与内存峰值 | （D-01） | 研究在真实 Chromium 下测得 26 ms / 堆持平，但绝对值需本机复核 | dev 模式打开 DevTools Performance，上传一个接近 32 MiB 的包，记录耗时与堆曲线；确认无「先 arrayBuffer() 再判大小」的峰值 |
| 预览卡片在真实设置页 CSP 下的渲染（两 tab 弹框 / 目录树折叠 / 脚本标红 / 高亮 + 必勾 / 冲突三选一） | USER-05 | 需要 `realm://settings` 的真实 CSP 环境与真实布局 | 打开设置页 → 导入技能；断言：初始隐藏靠 CSS 类生效（无内联 style 闪现）、勾选前提交按钮不可用、目录树计数与实测总条目一致、脚本清单标红、属性上下文里的不可信字符串未逃逸 |
| `skills.sh` / `www.skills.sh` 白名单条目的真实可达性（CR-1） | SEC-08 | 需真实 308 跳转链 | `curl -sIL https://skills.sh/` 确认 308 → `www.skills.sh`；再用导入管线实跑一次，断言逐跳校验通过（而不是在第一跳被自己的白名单拒） |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

# Phase 51: 用户技能导入管线（zip + 网络地址） - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付**用户技能的导入管线**：用户可从**本地 zip 包**或**网络地址**导入技能，导入前先看清将写入什么（两阶段预览），确认后才落盘；恶意或畸形包**整包拒绝**且**工作区外零写入**。

具体交付：

1. **两个来源、一条管线**：本地 zip 上传与网络地址下载**汇入同一个解压 / 校验 / 落盘函数**（P9 第 5 条硬约束：绝不为直链 SKILL.md 写第二条落盘路径）。
2. **zip 全量校验**：symlink entry 整包拒绝（central directory 属性 + 解压后递归 `lstat` 双路）+ 路径逃逸族七类 + 全量 entry 名 NFD+小写归一化查重 + 六类限额（单 entry / 累计字节 / entry 数 / 压缩比 / 嵌套深度 / `SKILL.md` 64 KiB）。
3. **解压落点**：`fs.mkdtempSync` 新建空目录；落盘前用**最近已存在祖先的 realpath**复核；导入完成后工作区外零新文件。
4. **两阶段预览**：名称 / description 原文 / 目录树 / 字节数 / 脚本清单标红 / 威胁扫描结论；用户确认后才落盘。
5. **网络导入**：https-only + 主机白名单 + 逐跳 `isPrivateHost` 校验 + 跳数上限 + 流式字节上限 + `content-type` 与 magic bytes 校验；GitHub 三种 URL 形态分流（仓库 / 目录 / SKILL.md 直链）；zipball 顶层 `<repo>-<ref>/` 前缀剥离。
6. **威胁扫描**：复用 `scanInjectionPatterns` + 新增技能域 `SKILL_THREAT_PATTERNS`（文件外发 / 凭据回显 / 诱导跳过确认三类），**description 与 body 双扫**。
7. **名称冲突策略**：与内置（seeded）同名 → 拒绝导入；与已有用户技能同名 → 覆盖 / 改名 / 取消三选一，不静默覆盖。
8. **SEC-10**：加固既有沙箱 `writeFile` 的 ENOENT symlink 缺口（与导入路径同一根因，一次修完）。
9. **`allowed-tools` 解析**（O3 的 51 半边）：解析但**必须**带「当前运行时不被强制，仅供参考」免责标注。
10. **文档**：`docs/product/ai-skills.md` 新增导入章节 + 安全边界与已知限制章节定稿（**含 DNS rebinding 残余风险的如实披露**）；`AGENTS.md` 维护约定与测试清单同步。

**Requirements**: USER-03, USER-04, USER-05, USER-08, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-10（12 项）

**安全门禁**：**P2**（S1 阻断）`resolveInside` ENOENT symlink 逃逸 + **P4**（S1 阻断）zip 路径类校验 + **P9**（S2）SSRF 逐跳校验；SEC-06 技能域威胁扫描（与 SEC-07 名称冲突策略共同闭合 **P3** 后半）。附带 **P5**（幽灵技能）、**P7**（资源耗尽）、**P12**（静默失败）、**Anti-Pattern 7**（误用 `search-manager.fetchUrl`）。

**不在本阶段**：多技能包勾选安装（**ECO-01**，v1.x）；GitHub Contents API「列一层」分支（本阶段显式不做，见 D-05）；`allowed-tools` 的**执行层门禁**（REQUIREMENTS 的 Out of Scope 明文）；技能版本历史 / 恢复按钮（v1.x / **ECO-02** 同类）；`/api/skills/set-disabled` 的存在性校验（50 收尾带出的不对称，不属本阶段需求）。

**八条前置约束（来自既有阶段，不得回退）**：

- **`ai-skills-manager.js` 是唯一权威且零 electron 依赖**（49-01 / 50 明文）⇒ 本阶段的**判定 / 校验 / 写函数 / 限额 / 扫描表**一律住该模块或与其同纪律的新模块；`main.js` 的 handler 与 `ai-manager.js` 只做**转发层**。ROADMAP 安全门禁原文：「本阶段产出的校验器是 50/51 唯一可复用的那一份」。
- **`LIMITS` 只允许加项，不得改既有数值**（46 D-11 / 49 D-10 / 50 明文）：`MAX_SKILL_MD_BYTES` 64 KiB / `MAX_USER_SKILLS` 50 / `SKILLS_PROMPT_CHAR_BUDGET` 8000 / `MAX_MANAGED_SKILLS` 50 / `MAX_SKILL_DESCRIPTION_CHARS` 1024。**端点与前端零字面量**（45/46 纪律）。
- **写入门严、读入门宽**（49 D-06 的故意不对称）：严格 name 校验只作用于**我们控制的写入侧**（`manage_skill` 与**本阶段导入**）；加载管线对磁盘上已存在的技能保持宽松（46 D-08）。
- **`user > managed` 遮蔽 + `shadowed` 可见**（46 D-06）；**name 恒等于目录名**（46 D-08）。
- **单一数据权威 + 不被绕过的失败可见性**（SKILL-06 / P12）：所有拒绝路径必须给可读原因 + 机器可读码；导入必须**回读验证**。
- **`readJsonBody` 的体积闸形状已备好，等本阶段显式放大**（50 D-16 的交接）：`/api/skills/import` 的 body 上限**必须显式声明**，且形状是「默认小 + 需大者显式放大」，让「忘了声明」在 413 处当场可见。
- **设置页必须走 `/api/*`，主窗口必须走 `realmAPI`**（Phase 38 事故）；**设置页是 `realm://settings` → 实际由 `http://localhost:PORT/settings` 加载** ⇒ 与 `/api/*` **同源**，`fetch` 零 CORS 面（实测 `main.js` 无任何 `Access-Control-Allow-*` 头）。
- **`windowManager.broadcast` 只发到各 BrowserWindow 的 webContents，不到 webview guest**（`window-manager.js:310`）⇒ 设置页收不到主进程广播，每次操作后自行重拉。

</domain>

<decisions>
## Implementation Decisions

### 导入数据流：传输形态与两阶段句柄

- **D-01:** **zip 上传走 raw binary body（`Content-Type: application/zip`），不用 base64-over-JSON**。
  - 四条理由：① 上限可从解压限额**推导**（累计 ≤ 32 MiB ⇒ 上传上限 32 MiB），而 base64 路径需 48 MiB 且是人工留的余量（`50-RESEARCH.md:1343-1344` 明文「≈ 42.67 MiB ⇒ 建议 48 MiB」）；② 省掉 +33% 传输与 guest / 主进程两侧各 ≈ 43 MB 的字符串峰值（50-RESEARCH 实测 base64 量级 body 的堆增长同向）；③ 设置页 guest 与 `/api/*` **同源**，`<input type="file">` 拿到的 `File` 可直接作 `fetch(url, { method: 'POST', body: file })` 的 body —— **无需 FileReader、无需 base64、零新增客户端依赖**；④ `Content-Type: application/zip` 在同源下**不触发预检**（实测 `main.js` 零 `Access-Control-Allow-*`，因为同源请求根本不需要 CORS 头）。
  - **必须交付的配套**：新写**第二个 body 读取函数** `readRawBody(req, res, { maxBytes })`（`readJsonBody` 是 JSON 专用），**逐条复制 50 D-16 已验证的形状**：读流边累加、超限即 `sendJson(res, 413, …)` + **`req.resume()`**（**不用** `req.destroy()`、**不设** `Connection: close` —— 两者都会让客户端拿 EPIPE / 丢失响应，413 永远看不到），并复用既有 `sendJson` 幂等护栏。**禁止**「先 `arrayBuffer()` 再判大小」—— 那已经吃掉内存，ROADMAP 判据 5 的判据对象是「**不无上限读入内存**」。
  - **新增常量单源** `MAX_SKILL_PACKAGE_BYTES = 32 * 1024 * 1024`，与 P7 的「累计解压 ≤ 32 MB」**同值** ⇒ 建立一条不变式：「上传的东西不可能合法地超过它能解出的上限」。⚠️ 它与既有 `MAX_JSON_BODY_BYTES_LARGE`（32 MiB，书签导入专用）**同数不同量**，命名必须区分；与 `MAX_JSON_BODY_BYTES`（1 MiB）与 P7 的「单 entry 1 MB」同理。
  - — **Reversibility:** costly — 换成 base64 要同时改「上传侧 body 构造 + body 读取函数 + 上限常量 + 50 的 `maxBytes` 交接口径」四处，并在 guest 引入 FileReader 与 ≈43 MB 峰值。
- **D-02:** **两阶段之间保留临时目录 + 发不透明句柄 `importId`；绝不接受客户端传路径**。
  - 形状：preview 阶段把包（zip 或网络下载产物）解压 / 校验到 `agent-workspace/.tmp/skill-import-<rand>/`（`fs.mkdtempSync` 保证唯一且为空），主进程内存维护 `Map<importId, { dir, preview, createdAt }>`，返回 `{ importId, preview }`；commit 阶段**只收 `importId` + 冲突选择**，从 Map 取目录 → 落点复核 → `rename` 落盘。
  - 理由：① ROADMAP 判据 4 的「解压只在 `fs.mkdtempSync` 新建的空目录内进行，**落盘前**用最近已存在祖先的 realpath 复核」预设了同一目录**跨阶段存活**；② 网络导入 preview 已下载 / 解压一次，commit 重来就是二次网络请求，而 GitHub 未鉴权仅 60 req/h（P9 第 6 条），重复消耗会打满额度；③ **`importId` 是不透明句柄而非路径** —— 与 Anti-Pattern 1「给 `manage_skill` 传 `path` 参数 = 边界失效」同一条纪律：**客户端永远不能指定落点**（这是本阶段最重要的一条接口设计边界，不是沙箱能兜住的）。
  - **生命周期与清理（必须实现，不是可选）**：① commit 成功或用户取消 → 立刻 `rm -rf` 该临时目录并从 Map 删除；② **TTL**（建议 10 分钟）到期清理，commit 命中过期句柄返回**明确码**（建议 `import_expired`）+ 文案「预览已过期，请重新选择文件」，**不得静默失败**；③ 启动时与应用退出时清扫 `.tmp/` 下全部 `skill-import-*` 残留（崩溃兜底，镜像 47-06 的 `sweepSeedResidue` 取向）；④ 并发待确认导入数量上限（建议 3）防内存 / 磁盘堆积。
  - — **Reversibility:** costly — `importId` 是 renderer↔主进程契约；改成「重传重解」要同时改上传路由、preview/commit 两阶段语义与 guest 侧的文件保留逻辑。
- **D-03:** **路由形状 = 一个 `POST /api/skills/import`，按 `Content-Type` / `mode` 分流**（50 D-15 已预留 `install` 位置）。
  - 三条分支：① `Content-Type: application/zip` → raw 上传 → 解压校验 → `{ importId, preview }`；② `application/json` + `{ mode: 'url', url }` → 下载 + **同一**解压校验管线 → `{ importId, preview }`；③ `application/json` + `{ mode: 'commit', importId, conflict: 'overwrite' | 'rename', newName? }` → 落盘。
  - 理由：P9 第 5 条要求三种来源**必须汇进同一个校验 + 落盘函数**；把分流做在**入参解析层**而不是落盘层，是让这条约束**可机械检查**的形式（源码扫描断言：**只有一个调用落盘函数的位置**）。
  - 路由条数（一路由双 content-type vs `import` + `import-upload` 两条）属 **Claude's Discretion**；**判据是「只有一个落盘实现」**，不是路由条数。
  - — **Reversibility:** reversible — 纯 handler 分发形状，回退即改路由表。
- **D-04:** **解压用 Node `fs` 写入临时区，不用沙箱 `env.writeFile`**；落盘那一步才走沙箱 `env.renameFile`（双基准校验）。
  - 理由：① yauzl 给的是**流**；② 我们需要在写**之前**按 central directory 属性判 symlink，并在写盘路径上自己维护「最近已存在祖先 realpath」复核（P2 三道自检），把这两件事交给沙箱的 `guard` 会形成两套判据；③ 解压目标在 `.tmp/skill-import-<rand>/`（全新空目录 ⇒ 前缀内不可能有预埋链接，P2 第 2 条），风险面已被 mkdtemp 消掉大半。
  - 沙箱原语仍在**落点**使用：`env.renameFile` 提供双基准路径校验（49 D-12 的「经沙箱 `env.renameFile` 获得双基准路径校验」先例），且 `.tmp/` 与 `skills/` **同沙箱 root、同设备** ⇒ `rename` 不会 EXDEV。

### 网络导入：白名单、GitHub 分流与下载

- **D-05:** **主机白名单（不是黑名单）**：仅 `github.com` / `api.github.com` / `codeload.github.com` / `raw.githubusercontent.com` / `objects.githubusercontent.com` / `skills.sh`。
  - **保留 `skills.sh` 的理由**：内置 `find-skills` 在 Phase 47 被改写为「零安装候选清单」（O1 裁决 ②），候选清单的落点就是 `skills.sh` ⇒ 白名单**必须**含它，否则「内置技能给出候选 → 用户一键导入」的闭环断在最后一步。这是白名单里**唯一**非 GitHub 条目。
  - 强制 **https**（拒绝 `http:` —— 导入场景没有容忍明文的理由）；**逐跳 `isPrivateHost`** + 协议白名单 + **跳数上限（超限必须抛错**，顺手修 P9 第 2 条记录的缺陷：现有 `fetchUrl` 走完循环不抛「重定向过多」，而是带着最后一个 3xx 掉出 → 报 `HTTP 301` 这种误导性错误）；**流式字节累加**上限 `MAX_SKILL_PACKAGE_BYTES`；`content-type` 与 **magic bytes** 双校验（zip：`50 4B 03 04`；空包：`50 4B 05 06`）。
  - 复用 `search-manager.isPrivateHost`（已导出，`search-manager.js:195`）与其逐跳校验的**判据**；**不复用 `search-manager.fetchUrl`**（它取文本、`FETCH_DEFAULT_MAX_LENGTH = 12_000` **字符**上限、`res.text()` 一次性读入 ⇒ 对二进制是破坏性的 = Anti-Pattern 7 原文）。
  - `isPrivateHost` 的 `^127\.` 已覆盖本地 HTTP 服务自环（`main.js:314` 的 `/api/*` 与 `/proxy` 都有 token 鉴权）；白名单是第二道，也是 P9 第 7 条要求的那道。
  - — **Reversibility:** costly — 白名单是 P9 阻断门禁的承重面；放宽要同批改威胁模型、产品文档与实测。收紧（删 `skills.sh`）会**静默**断掉 47 建立的产品闭环。
- **D-06:** **不做 GitHub Contents API「列一层」分支**；仓库 / 目录地址一律转 **codeload zipball + 顶层前缀剥离 + 子路径定位**。
  - 支持的 URL 形态：① 仓库地址 `github.com/<o>/<r>`（可带 `/tree/<ref>/<path>`）→ `codeload.github.com/<o>/<r>/zip/refs/heads/<ref>`；② `raw.githubusercontent.com/.../SKILL.md` 或 `github.com/.../blob/...SKILL.md` → **包装成单文件包**后进同一管线（P9 第 5 条）；③ 白名单内其余源按可达的 zip / raw 语义处理。
  - 顶层前缀 `<repo>-<ref>/` **必须剥离**（research 已 curl 实测：GitHub zipball **恒定**包一层），不剥会解出 `skills-main/skills/foo/SKILL.md`（P5 幽灵技能的来源之一）。
  - **技能根定位优先级**（**命中 0 个或 >1 个即拒绝并给可操作提示**）：URL 显式子路径 → 子路径下直接有 `SKILL.md` → 全包扫描恰好一个 `SKILL.md`。**目录名必须以校验后的 `name` 命名**（`skills/<name>/`），**绝不使用包内原始目录名拼路径**（P5 第 2 条 —— 那又是一个注入点）。
  - **多技能仓库的处理（这条是产品决策）**：**拒绝 + 提示**「该地址包含 N 个技能，请改用指向具体技能目录的地址（`github.com/<o>/<r>/tree/<ref>/<path>`）」。理由：① O2 已裁决 v1 = 恰好一个技能根，多技能勾选是 **ECO-01**；② Contents API 未鉴权仅 60 req/h，且 `.planning/STATE.md` 明文「`contents` 列一层分支与 403/429 处理**未发真实网络请求验证**」⇒ 省掉它同时省掉一个未验证分支与一整条限流面；③ `tree/<ref>/<path>` 已能覆盖「挑某个技能」的真实需求，代价是用户多点一次。
  - 403 / 429 与网络失败 → 按**真实原因**回传（USER-08），文案提示限流与重试。
  - — **Reversibility:** costly — 日后加 Contents API 分支要新增一条未验证网络路径 + 限流处理 + 勾选 UI（= ECO-01），并重新走一遍 SSRF 门禁。
- **D-07:** **网络下载产物与 zip 上传走完全相同的解压校验管线**（P9 第 5 条的机械形式）：下载 → 存 `.tmp/skill-import-<rand>/pkg.zip` → 调**同一个** `extractAndValidatePackage()`。「直链 SKILL.md」的分流做法是**把它包成一个单文件包**再进同一管线。
  - — **Reversibility:** costly — 两条落盘路径 = 两套漏洞；这是 P9 明确点名的反模式（「绝不为直链 SKILL.md 写第二条落盘路径」）。

### 落盘：同名冲突、原子性与回滚

- **D-08:** **冲突策略按来源分档**：
  - 与**内置（seeded）同名** → **拒绝导入，不提供覆盖**（P3 / SEC-07 字面）。文案说明「内置技能名受保护，请改用其它 name」。
  - 与**已有用户技能同名** → 预览卡片上**三选一：覆盖 / 改名 / 取消**（SEC-07）。**不做静默覆盖**。
    - **改名的 name 走与写入侧同一份校验器**（`validateManagedSkillName`）—— 一份校验器，不写第二份（49 D-11 / 50 的复用纪律）。**改名 = 新建**（占 `MAX_USER_SKILLS` 名额）；**覆盖 = 净增 0**（不占名额，预检时豁免）。
  - 与**其它来源**（AI 自建 managed、用户手放在 `managed-skills/` 的不合名目录）同名 → **不允许覆盖**：导入只管 `skills/<name>/`，覆盖 managed 不可能是用户意图。此时按 46 D-06 的既有语义提示「导入后该 AI 自建技能将被永久遮蔽」，并允许**改名 / 取消**。
  - — **Reversibility:** costly — 冲突策略是用户可见行为契约，且与 50 的卸载 / 49 的 `manage_skill` 撞名语义同族；改口径要同批改三处文案与文档。
- **D-09:** **覆盖 = 备份 + 两段 rename，失败可回滚**。
  - 步骤：① `rename(skills/<name>, .tmp/skill-replace-<rand>/<name>)`（同设备、原子）→ ② `rename(importDir/<name>, skills/<name>)` → ③ 成功则删备份；② 失败则 ④ `rename` 备份路径回原位并返回错误。
  - 理由：① 导入是**用户已显式确认的破坏性动作**，而被替换的是**用户自己**的目录（可能手改过、可能带自写 `scripts/`）；「先删后移」在任一步失败时会**静默丢技能**，而 50 的卸载至少有「用户主动要删」的语义；② 两段 rename 都是同设备原子操作，回滚路径简单且**可测**（在第二步注错即能验证旧技能完好）；③ 与 49 D-12「原子写 = tmp + rename、失败不留半成品」同一条纪律，只是对象从**文件**升级为**目录**。
  - ⚠️ **与 50 的「卸载无备份」不冲突**（D-05 明文、版本历史归 v1.x）：卸载是「不要了」，覆盖是「要新的但可能反悔」；且覆盖的备份是**临时的**（成功后即刻删除），不是版本历史机制。**不得**把它扩张成版本历史 / 恢复按钮（那是 **ECO-02** / v1.x）。
  - — **Reversibility:** reversible — 一个函数内的两段 rename + 回滚分支。
- **D-10:** **落盘后必须回读验证**（P12 / ROADMAP 判据 1 的可见性）；失败则**回滚**并展示 diagnostics 原文。
  - 落盘后立刻经既有重扫管线确认目标 name 出现在技能集里；**不在**则把 `diagnostics` 原文（**含 path**）作为失败原因展示（USER-08），并把刚移入的目录移回临时区（覆盖场景则恢复备份）—— **不提供「部分导入」**。
  - **导入报告结构**：成功 `{ name, source, bytes, files, scripts[], scan, warnings[], allowedTools? }`；失败 `{ code, error, quota?, diagnostics[] }`。
  - ⚠️ **与 50 的既有缺口对照**：`/api/skills/set-disabled` 不校验存在性（`STATE.md` 收尾带出项）**不在本阶段范围**；但本阶段的 commit **必须**校验 `importId` 有效性与临时目录存在性 —— 同一类「失败要真实」的要求，**不得复制那个不对称**。
- **D-11:** **数量与字节闸**：`MAX_USER_SKILLS`（50）到顶时导入被拒 + 可操作提示（先卸载），**覆盖同名不计新增（豁免）、改名计入**；闸的判据**读盘**（`env.exists` / `env.listDir`）而非缓存快照（bash 可随时改写磁盘，P8 第 6 条 —— 46/49/50 一以贯之）。
  - `MAX_SKILL_MD_BYTES`（64 KiB）在**交 SDK 之前**按**组装后的 `SKILL.md` 全文**预筛（49 的四条不变式之一：写侧权威字节闸口的判据对象 = 组装后全文），否则会产出「落盘成功但整条被加载管线跳过」的**幽灵技能**。

### 威胁扫描与预览口径

- **D-12:** **扫描结论分两级效力 —— 注入硬拒、技能域启发式高亮 + 显式确认**。
  - `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS`（**description 跑两组 / body 只跑注入组** —— 49 D-08 已定的分字段口径）**命中即拒绝整包**，与 49 的 `manage_skill` 写入侧同一判据。理由：`description` 无条件进**每个请求**的 system prompt（P3 的「零交互注入通道」），提示注入类句子无合法用途。
  - **新增 `SKILL_THREAT_PATTERNS`（技能域三类：文件外发 / 凭据与敏感路径读取回显 / 诱导跳过确认）命中 → 不拒绝**，改为：预览卡片**显著高亮**该条 + 确认区一个**必勾的「我已了解以上风险」**复选框，不勾不得提交。
    - 理由：这三类是**启发式**（P3 自陈「**降低概率**，不是安全边界」），而**合法技能必然命中** —— 一个「部署 / CI / 数据同步」类技能会合理地在正文里写 `curl`、写 `.env`、写「无需再次询问」（幂等脚本说明）。硬拒会让用户**失去功能且无法绕过**；真正的安全边界是 P3 原文列的「**导入预览确认 + 沙箱**」。
    - 三类的具体模式表与词表来源（P3 草案 + `ai-attachments-manager.DENIED_HOME_PREFIXES` + `ai-bash-policy` 的 `DANGEROUS_*`）交 plan 期；**必须在 `docs/product/ai-skills.md` 写明「启发式、非安全边界」**。⚠️ 注意 `DENIED_HOME_PREFIXES` **当前未导出**。
  - **落点**：`SKILL_THREAT_PATTERNS` + 技能域扫描函数落 `ai-skills-manager.js`（技能域、零 electron 依赖、可单测）；`INJECTION_PATTERNS` 继续复用 `ai-memory-manager.scanInjectionPatterns`（49 D-08 已建立的复用面）。
  - **扩表的连带效果（预期的行为增强，须记一句防误读）**：49 D-08 明文「49 把扫描点接成单点，51 只需**扩表**、不加接线」⇒ 扩表后 **49 的 `manage_skill` 写入路径自动获得技能域模式**。这是交接契约的兑现，**不是** 51 的越界；须写进 `docs/product/ai-skills.md` 与 `AGENTS.md`。
  - **不接入加载期**（硬约束）：扫描只在**导入**与 49 的**写入侧**生效；**不得**在 `refreshSkills()` 里对磁盘上已存在的技能做威胁扫描后丢弃 —— 那会推翻 46 D-08（「不丢弃命名不规范的合法技能」）并让**已导入的合法技能在某次升级后消失**（49 D-05 已付过这条论证）。
  - — **Reversibility:** costly — 效力分级是「合法技能会不会被误拒」的用户可见契约，且与 49 的扫描点同一份表；改成一律硬拒会让一批合法技能永久无法导入且用户无法自救。
- **D-13:** **预览卡片的信息集**（ROADMAP 判据 1 的六字段 + 两条补充）：
  - **名称** + 「将写入 `skills/<name>/`」落点说明；冲突时同屏给出三选一（D-08）。
  - **description 原文**：展示**原文**（不净化、不截断语义），因为 `sanitizeSkillDescription` 只作用于**落盘时写进 frontmatter** 的值 —— 预览必须让用户判断净化是否误伤。
  - **目录树**：**折叠 + 默认展开前 N 项（建议 50）+ 「共 N 个文件 / M 个目录」计数 + 可展开全量**。理由：`anthropics/skills` 整仓实测 **512 条目 / 3.98 MB**（research 已 curl 实测），全量平铺会让卡片不可用；而**截断必须显式说明总数**（禁静默截断）。
  - **字节数**：解压后累计字节 + 单文件最大值 + 与限额的对照（`SKILL.md` 64 KiB / 累计 32 MiB）。
  - **脚本清单标红**：判据 = **扩展名集合**（`.py` / `.sh` / `.bash` / `.zsh` / `.js` / `.mjs` / `.cjs` / `.ts` / `.rb` / `.pl` / `.php` / `.ps1` / `.bat` / `.cmd` / `.exe` / `.dylib` / `.so` / `.node`）**或 POSIX 可执行位置位**；显示文件数 + 路径列表（截断口径同目录树）。实测参照：内置 `skill-creator` 含 8 个 `.py` 与一个 44,998 字节的 `viewer.html`。文案**必须**写清「**技能不构成额外权限** —— 这些脚本受既有 bash 三档策略与确认卡片约束」（与 `docs/product/ai-agent-workspace.md` §七 同口径）。
  - **`allowed-tools`（O3 的 51 半边）**：**解析并展示，但必须带免责标注**「本字段在当前运行时不被强制，仅供参考」（O3 裁决 ② + REQUIREMENTS 的 Out of Scope「`allowed-tools` 执行层门禁」）。**解析动因是硬需要**：SDK 的 `Skill` 类型**根本没有该字段**（P6 逐字引用 `dist/harness/types.d.ts:28-39`），要拿到它必须自行解析 frontmatter ⇒ 直接决定 D-14 的依赖处置。
  - **威胁扫描结论**：分两栏（注入类 = 拒绝原因；技能域启发式 = 高亮 + 必勾确认，D-12）。
  - **诚实边界（须写进预览与文档）**：预览里的所有「结论」都是**启发式 + 限额判据**，**不是**「这个技能是安全的」的背书。
- **D-14:** **`yaml` 提升为直接 `dependencies`**，版本与 SDK 传递依赖**同版**（实测 `node_modules/yaml` = `2.9.0`；O5 明文「必须与 SDK 同版本 2.9.0 避免双实例」）。
  - 理由：O5 原建议以「SDK 往返 + 结构性检测」为主（零新增依赖），但该方案的**前提是「只需知道 name 是否缺失」**；而 **O3 要求解析 `allowed-tools`**（SDK 不暴露）⇒ **必须**自行解析 frontmatter ⇒ 走 O5 的 ② 分支。顺带解决 P5 的「name 必须显式存在」硬判据（① 方案的结构性检测是**间接**判据：只在「name 恰好等于随机临时目录名」时才有信号）。
  - **`yauzl@^3.4.0`** 同批新增（research 已裁决、`.planning/research/STACK.md` 已逐维对比）：**结构性优势 = 库自身从不写盘**（`openReadStream()` 只给流）⇒ `adm-zip` CVE-2026-76845 那一类「**库自己**跟随目标目录预埋 symlink 写出根目录」在 yauzl 上**不可能发生**；另带 `validateFileName()`（`decodeStrings:true` 默认时对每 entry 自动执行）+ `validateEntrySizes:true`（默认开启，官方标注为 zip bomb 防护）。纯 JS、唯一依赖 `pend`（零依赖）、110 KB、27M 次/周。
  - **打包纪律（P11 + `AGENTS.md` 新增依赖四条）**：两者均纯 JS、无原生模块、无数据文件 ⇒ **不需要** `asarUnpack`；但**必须**过一遍完整依赖审计（registry 存在性 / 下载量 / 源仓库 / `postinstall` 脚本 / 与 `build.files` 的联动），并核对 `build.files` 的 `!` 排除项断言（`tests/test-builtin-skills-seeder.js` 的「打包排除项配置护栏」要求每一项以 `!` 开头）。
  - — **Reversibility:** costly — 两个依赖都进 `package.json` ⇒ 打包产物形状变化；`yaml` 双实例会**静默**产出解析差异，升版必须与 SDK 同步复核。

### 沙箱加固（SEC-10）与安全边界成文

- **D-15:** **SEC-10 = 新增「写目标专用」路径复核，并把沙箱全部写方法切过去**（**不改** `resolveInside` 对**已存在**路径的既有语义）。
  - 缺口事实（P2 已实测复现）：`resolveInside` 对**不存在**的路径命中 `ENOENT` 分支**只做词法校验**（`agent-workspace.js:169-175`：`catch (err) { if (err.code === 'ENOENT') return abs; … }`）⇒ 中间目录是符号链接时词法路径看着在 root 内、实际写盘跟随链接跑出去。同一根因既在**导入**（zip 的 symlink entry）也在**既有沙箱**（`writeFile` 的 `guard`）。
  - 修法：新增 `resolveInsideForWrite(root, target)`（或 `resolveInside(root, target, { forWrite: true })`）—— 对**父目录链自内向外找最近已存在祖先**做 `realpathSync`，拼接剩余相对段后再与 root 的**两个基准**（root 与 root 的 realpath，macOS `/var → /private/var`）比对；**同时保留**原有词法前缀校验。把 `createSandboxEnv` 的 `writeFile` / `renameFile` / `createDir` / `remove` / 一切写入面切到它。
  - **影响面（诚实边界，必须成文）**：加固后 `bash` 里「先 `ln -s <沙箱外路径> link` 再写 `link`」**会被拒绝** —— 这是**正确行为**（沙箱封闭），但属**行为变更**，须写进 `docs/product/ai-agent-workspace.md` 与 `docs/product/ai-skills.md` 的已知边界；**沙箱内自指的 symlink 仍放行**（realpath 后仍在 root 内）。
  - **不选「只修导入路径」**：同一根因分两处修会留下 P2 明示的既有缺口，且 ROADMAP 判据 4 明文要求「既有沙箱 `writeFile` 的 ENOENT symlink 缺口**一并加固**」。
  - — **Reversibility:** costly — `createSandboxEnv` 是**所有** AI 文件 / bash 工具的唯一路径入口；收紧后可放行集合变小，放宽回去要重新论证每一类 `ln -s` + write 场景。
- **D-16:** **DNS rebinding 残余风险如实披露**（P9 第 3 条，ROADMAP 的 Doc sync 条款原文要求）：`isPrivateHost` 走 Node `dns.lookup`，而实际请求走 Electron `net.fetch`（Chromium 网络栈，可能走系统代理 / DoH / 不同 resolver）⇒ **被校验的 IP ≠ 被连接的 IP**，属「先解析再请求」的固有 TOCTOU，`search-manager` 的既有实现同样有。
  - **必须**写进 `docs/product/ai-skills.md` 的安全边界与已知限制章节（该章节按 ROADMAP 在本阶段**定稿**）与威胁模型。
  - 缓解论述（也须成文）：**主机白名单**把 rebinding 的收益压到接近零（只允许六个已知域）；逐跳校验 + https-only + 流式上限 + magic bytes 是纵深。
- **D-17:** **P2 的「解压后递归 `lstat` 复核整棵树」与「落点最近已存在祖先 realpath 复核」都必须实现，两层缺一不可**。
  - 第一层 = 读 central directory 时按 external attributes 判 Unix symlink（`(extAttr >> 16) & 0xF000 === 0xA000`）→ 命中即**拒绝整包**（不是跳过该 entry —— 一个包里出现链接是强恶意信号）；
  - 第二层 = 解压完成后**递归 `lstat` 复核整棵树**（防库的 attribute 解析漏网）+ 对每个文件 `realpathSync` 后确认仍在 root 内；
  - 第三层 = 落盘前对**父目录链的最近已存在祖先**做 realpath 复核（D-15 的同一函数）。
  - 与 `ai-attachments-manager.registerFiles` 的 `stat.isSymbolicLink() → 拒绝` 语义一致，**直接镜像**。
  - **测试断言点是「拒绝整包」而不是「跳过条目」**（P2 第 4 条明文）。

### 导入入口、UI 形态与刷新链

- **D-18:** **入口 = 技能管理区标题行右侧「导入技能」按钮 → `realm://` 范式 div 遮罩弹框**；弹框内**两个 tab：「本地上传」/「网络地址」** → 预览卡片 → 确认 / 取消。
  - 弹框形态照抄 50 的 `skillManageConfirm`（`.ai-modal-overlay` + `.ai-modal`；**初始隐藏走 CSS 类**、**禁 markup 内联 style** —— CSP `style-src 'self'` 会拦掉且元素反而常驻可见；**绝不**把 `.ai-modal-overlay` 用到 `<dialog>` 上，会把盒子钉在左上角）。
  - **文件选择复用既有 `<input type="file">` 先例**（`src/settings.html:197` 的 `rulesFileInput` + `src/settings-page.js:769/781` 的 `elements.rulesFileInput.click()` / `handleFileSelect`，`finally` 里重置 input 保证可重复触发），**不新增 native dialog IPC 通道**。理由：设置页是纯 HTTP 客户端（50 D-18 的诚实边界同一取向：不给 guest 开新通道）；同源 `fetch` 可直接以 `File` 作 body（D-01）。
  - **不新增主窗口入口**：ROADMAP 的承载面就是设置页（Phase 50 建的「技能管理」区）；主窗口管理 UI 在 50 已明确不在范围内（**不得**为了让 IPC 有消费者而新造一套）。
  - 失败反馈走设置页既有 inline hint（`setAiMemoryHint` 的 success / danger 双色 + 自动复位守卫同款，`skill-manage-hint` 类），**不新建 toast 基建**（50 D-06 的同一判断）。
  - — **Reversibility:** reversible — 纯 guest 前端增量。
- **D-19:** **导入成功后收口 —— 与 50 同款「重扫恰一次 + 补播恰一次」**：`await aiManager.ensureSkillsFresh()`（其函数体内已含 `syncAgentSystemPrompt()` 的恰一次语义）**之后**、于**调用侧**无条件补 `windowManager.broadcast('skills:changed')` **恰一次**；**不得**改 `syncAgentSystemPrompt()` 函数体（46-04 方法体源码断言 + 48 的广播次数断言同时钉着它）。
  - **本阶段完成后 `syncAgentSystemPrompt()` 生产调用方的写路径份额达 3/3**（49 `manage_skill` + 50 启停 / 卸载 + 51 导入）⇒ `STATE.md` 的 ⚠️ 可**闭合**（该 ⚠️ 的判据就是「49/50/51 三者都落地」）。
  - ⚠️ **但 `STATE.md` 的 ⚠️ 不得被读成 P8 失效链 6/6 全覆盖**：**读侧 / 兜底**份额（`refreshSkillsForPanel()`、`ensureSkillsFresh()`）与**写路径**份额**不是同一个量**（50 D-18 / OQ-5 的双账本口径）⇒ 收口时**分别记两个数**。
  - 设置页**每次操作后自行重拉列表**、**每次进入该页时重拉**；**多开设置页实例之间不做即时同步**（50 D-18 的诚实边界：`broadcast` 只到 BrowserWindow 的 webContents，不到 webview guest；为 guest 单开 push 通道是新基建）。

### Claude's Discretion

- `importId` 的生成方式（`crypto.randomUUID()` vs 随机 hex）、Map 字段名、**TTL 具体值（建议 10 分钟）**、**并发上限（建议 3）**。
- `readRawBody` 的函数名与落点（与 `readJsonBody` 并列住 `main.js`）、`MAX_SKILL_PACKAGE_BYTES` 的常量名（**须与 `MAX_JSON_BODY_BYTES_LARGE` 区分量**）。
- 路由条数（一路由双 content-type vs `import` + `import-upload`）—— **判据是「只有一个落盘实现」**（D-03 / D-07）。
- **限额常量的组织**（并入 `LIMITS` vs 新增 `IMPORT_LIMITS`）与确切断点：**从 P7 的建议值出发**（单 entry 1 MB、累计 32 MB、entry 数 2000、压缩比 100:1、嵌套深度 8），`SKILL.md` 按既有 64 KiB 卡；**`LIMITS` 只允许加项**；**端点与前端零字面量**（限额一律取主进程回传值）。
- 目录树 / 脚本清单的**截断阈值与折叠交互**、必勾复选框的文案、改名输入框的形态 —— 交 plan 期。ROADMAP 标 `UI hint: yes` ⇒ **建议先跑 `/gsd:ui-phase 51`** 出设计契约（弹框两 tab 形态 / 预览卡片信息层级 / 高亮与必勾确认 / 三选一冲突选择器 / 目录树折叠 / `realm://` CSP 下的初始隐藏）。
- `SKILL_THREAT_PATTERNS` 的具体模式表与词表来源。⚠️ **测试必须带正命题**（不只有「命中即拦」的否命题形态 —— 见 49 的 `WR-12` 教训）。
- 技能根定位的实现细节与**新增错误码集合**（新增码须走 50 建立的「码数账本三处一起刷」纪律：常量 + 产品文档 §11.3 + `AGENTS.md` 测试清单）。
- **测试文件组织**：建议新增独立套件 `tests/test-skills-import.js`（zip 校验 / 限额 / 冲突 / 覆盖回滚）+ `tests/test-skills-import-net.js`（URL 分流 / 白名单 / 逐跳 / magic bytes，网络面用**本地 stub server** 而非真实外网），并给 `tests/test-ai-skills.js`、`tests/test-agent-workspace.js`（SEC-10 加固）、`tests/test-skills-http-api.js`（新路由 + 413 形态）增补。**禁止 `npm test`**（本项目无该脚本，两处 gate 恒把它解析成不存在的脚本）。**必须覆盖**：
  - symlink entry **整包拒绝**（central directory 属性 + 解压后递归 `lstat` **两路分别测**）；
  - 路径逃逸族七类（`..` 段按 `path.posix.normalize` **归一化后判**而非字符串 `includes('..')` / 绝对路径 / 盘符 / UNC / 反斜杠 / NTFS ADS / 控制字符 / 尾随空格与点）；
  - **全量 entry 名 NFD + 小写归一化查重**（大小写冲突与 Unicode NFC/NFD 冲突各一例 → 拒绝整包）；
  - 六类限额（含 ZIP64 与缺 `uncompressedSize` 的形态）；
  - **解压后零工作区外写入**（P2 第 4 条：**真跑一次越界对照组**，不是断言「没写过」）；
  - **覆盖回滚**（在第二步注错 → 断言旧技能完好无损）；
  - **TTL 过期码** / 回读验证失败的回滚 / seeded 同名拒导入 / **未勾选风险复选框不得提交**；
  - `readRawBody` 超限 **413 且不累积**、`sendJson` 幂等、**无 `unhandledRejection`**；
  - 白名单外域名与 `http:` 拒绝 / 逐跳私有地址拒绝 / **跳数超限抛错** / magic bytes 不匹配拒绝；
  - **直链 SKILL.md 与 zip 走同一落盘函数**（**源码扫描：落盘函数只有一个调用点** —— D-03 / D-07 的机械判据）。
- **待实测项**（`.planning/STATE.md` §「v2.6 待实测风险」明文列的三条 + 本阶段新增）：
  - **yauzl 3.4.0 的 Promise API 形态与四处错误处理面**（callback err / promise rejection / `ZipFile.error` / read stream error）—— 需真实打包 + 解压 + 恶意样本（zip-slip / symlink / 炸弹）；
  - `github.com/<o>/<r>/tree/<ref>/<path>` → zipball URL 的 ref 与子路径解析（Contents API 分支已按 D-06 不做，但 tree 形态要实测）；
  - **`Content-Type: application/zip` 从 `http://localhost:PORT` guest 发出的同源 POST 是否零预检**（推断零预检 —— 实测 `main.js` 无任何 `Access-Control-Allow-*` 头，同源本就不需要；但须实跑一次确认）；
  - 32 MiB 上传在本机 Electron 的实际耗时与内存峰值；
  - `fs.mkdtempSync` 在 `.tmp/` 下的 `rename` 是否恒同设备（同 root 预期是，须一次实跑）；
  - `env.listDir` 对 symlink 的可见性（50 research 已实测：返回 `{name,path,kind,size,mtimeMs}`，**内部链接可穿入 ⇒ naive 递归会无限循环**、外逃链接 `permission_denied`）；
  - 覆盖场景两段 rename 的真实行为（目标不存在 / 目标已存在 / 中间目录是链接三种形态）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑、需求与门禁

- `.planning/ROADMAP.md` §Phase 51 / §Security Gates — Goal、**5 条 Success Criteria 逐字**（判据 1 的六字段预览、判据 2 的单技能包语义与 URL 分流、判据 3 的四类整包拒绝（symlink entry / 路径逃逸族 / 名字归一化冲突 / 五类超限）、判据 4 的 `mkdtempSync` + 最近已存在祖先 realpath + 「既有沙箱 `writeFile` 的 ENOENT symlink 缺口一并加固」、判据 5 的 https-only + 白名单 + 逐跳 + 流式上限 + magic bytes + description/body 双扫 + 同名策略 + 「失败给出真实原因」）、**`UI hint: yes`**、**`Research needed`**（yauzl 四处错误处理面实测 + GitHub 三形态分流需真实网络请求验证）、**`Doc sync`**（安全边界与已知限制章节在此定稿，含 DNS rebinding 残余风险如实披露）、**P2 / P4 / P9（+ P5 / P7 / P12 / Anti-Pattern 7）逐条阻断判据**
- `.planning/REQUIREMENTS.md` — USER-03 / USER-04 / USER-05 / USER-08 / SEC-02 / SEC-03 / SEC-04 / SEC-05 / SEC-06 / SEC-07 / SEC-08 / SEC-10 条目原文（`:53-55` / `:58` / `:71-79`）、**Out of Scope 表**（尤其「`allowed-tools` 执行层门禁」与「技能文件热重载」两条）、**v2 Requirements 的 ECO-01**（多技能勾选 = 本阶段显式不做）
- `.planning/STATE.md` §Blockers/Concerns — **`:301` 的 O2**（zip 多技能语义 v1 = 恰好一个技能根）、**`:302` 的 O3**（`allowed-tools` 解析并带免责标注；47 半边已落定、**51 半边待办**）、**`:303` 的 O5**（frontmatter 显式解析 ⇒ `yaml` 是否提升为直接依赖）、**`:308` 的 ⚠️ `syncAgentSystemPrompt()` 生产调用方**（49 已闭合 1/3、50 已闭合 2/3，**本阶段到 3/3 后可闭合该 ⚠️**，但**不得**读成 P8 6/6）、`:297-307` 的 TD-48-01/02 与 50 收尾带出的三条（`set-disabled` 无存在性校验 / `/tmp` 证据不可重跑 / 三处「假绿」形态）、**§「v2.6 待实测风险」三条**（yauzl API 形态与四处错误处理面 / Contents API 未验证 / `npx skills` CLI）

### 研究（本阶段实现的直接依据）

- `.planning/research/PITFALLS.md` — **P2**（`:72-121`：`resolveInside` ENOENT 词法校验缺口的实测复现 + 三道自检（拒绝含 symlink entry 整包 / mkdtemp 空目录 / 最近已存在祖先 realpath）+ 「测试断言点是拒绝整包而非跳过条目」）、**P3**（`:124-177`：description 零交互注入通道 + name 冒名（SDK `validateName` 只产 warning）+ `scanInjectionPatterns` 的三类**放行缺口** + `SKILL_THREAT_PATTERNS` 草案 + 两阶段导入照抄 `main.js:1173` HTML 书签先例 + 「安全边界 = 导入预览确认 + 沙箱」）、**P4**（`:181-214`：zip 库选型取舍 + 逐 entry 拒绝清单七类 + 两阶段落盘 + 「`skills/<name>` 已存在」语义要显式 + 「限定包内必须恰好一个技能根」）、**P5**（`:217-251`：幽灵技能（name 取自父目录名）+ 自行解析 frontmatter + 目录名必须以 name 命名 + **导入结果必须回读验证**）、**P6**（`:254-288`：SDK `Skill` 类型**没有 `allowedTools`**—— D-13 的解析动因 + 免责标注 + 脚本标红）、**P7**（`:291-318`：四个资源耗尽入口与**具体限额建议值**—— D-01 / D-11 的数值来源 + 「先读 central directory 的 `uncompressedSize` 预检」+ 「超限文案必须说明是哪个限额、当前值是多少」）、**P9**（`:363-388`：`isPrivateHost` 与 `net.fetch` 不同 DNS + 白名单优先 + 逐跳循环缺陷 + 流式上限 + magic bytes + 「绝不为直链 SKILL.md 写第二条落盘路径」+ GitHub 60 req/h）、**P11**（`:431-445`：`yaml` / `ignore` 是**未声明的传递依赖**—— D-14 的依据 + 「不建议手写 zip 解析器」）、**P12**（`:449-461`：`loadSkills` 全部失败都是 warning = 静默失败 ⇒ 回读验证）
- `.planning/research/STACK.md` — **§(a) zip 解压库选型六维对比**（yauzl 3.4.0 胜出：库自身从不写盘 / `validateFileName` / `validateEntrySizes` / 110 KB / 唯一依赖 `pend`；`adm-zip` 最新版即受影响版本 + `extract-zip` 上游失联）、**§发现 4**（GitHub zipball 单层前缀 + codeload 不吃 API 限流 + `anthropics/skills` 实测 3.98 MB / 512 条目 / 唯一顶层 `skills-main`）、**§(e)**（「解析 + 定位技能目录」是独立且必要的一步，复杂度不在 zip 库里）
- `.planning/research/SUMMARY.md` §Phase 51（`:135-155`：Delivers 全清单 + Avoids 清单 + Anti-Pattern 7）与 §Phase Ordering Rationale 第 4 条（`:51` 排最后 = 安全面最大、耦合最小的**刻意风险隔离**）、§Research Flags（`:155` 三条待研究 + `:198` Contents API 未验证）
- `.planning/research/ARCHITECTURE.md` — **Anti-Pattern 1**（`:759-763`：给 `manage_skill` 传 `path` 参数 = 边界失效 ⇒ D-02 的 `importId` 不透明句柄）、**Anti-Pattern 7**（`:795`：用 `search-manager.fetchUrl` 抓技能包 —— 对二进制破坏性）、§模块级缓存 + 同步访问器设计
- `.planning/phases/50-api-skills/50-RESEARCH.md` — **§「Phase 51 体积上限交接」（`:1335-1357`）**：base64 膨胀推导（`4 × ceil(n/3)` ⇒ ≈ 42.67 MiB ⇒ 建议 48 MiB）与**「推荐 Phase 51 评估『不 base64』的替代」原文**（D-01 的直接依据：`fetch(url, { method:'POST', body: file })` + `Content-Type: application/zip` ⇒ 上限只需 ≈ 32 MiB，代价是另写流式累加读取函数）；**§Pitfall 1「413 形态」**（`sendJson(413)` + `req.resume()`，禁 `destroy` / `Connection: close` 的实测对照）与 **§Pitfall 2「`sendJson` 幂等」**（`:509` 的 zip 库依赖审计提醒）；`:1000` 的「导入落盘时用 `atomicWriteSkillFile`」交接
- `.planning/phases/50-api-skills/50-VALIDATION.md` — Nyquist 验证契约的跑法口径（**本项目无 `npm test`**）、逐需求 → 命令映射、counts-parity 机械判据、Manual-Only 清单（本阶段沿用同一组织形式）

### 上一阶段（本阶段的前置契约）

- `.planning/phases/50-api-skills/50-CONTEXT.md` — **D-05**（确认弹框形态：div 遮罩 + CSSOM，`realm://` CSP 豁免 + 禁内联 style —— D-18 复用）、**D-06**（inline hint 失败反馈范式 —— D-18 复用）、**D-07**（「仅 user 可删」的三态判据与**不复用** `resolveManagedTarget`）与 **D-08**（第十码 `NOT_USER_OWNED` 的加码纪律：`MANAGE_SKILL_ERROR` 11 键 / `MANAGE_SKILL_SHORT_REASON` 恰 9 键不动 —— 本阶段新增错误码照此纪律）、**D-10**（`/api/settings/update` 的服务端校验面）、**D-13**（`getSkillsForManagement()` 与 `getSkillsForUI()` **并列共存不得合并**）、**D-15**（REST 子路由范式 —— D-03 复用）、**D-16**（`readJsonBody(req, res, { maxBytes })` 的 fail-closed 形状 + 413 实现形态 + `sendJson` 幂等护栏 + 「Phase 51 届时显式声明更大值」的**明文交接**）、**D-17**（两个前端入口共用同一 manager 函数，handler 只做转发）、**D-18**（写路径「重扫恰一次 + 调用侧补播恰一次」+ 「不得改 `syncAgentSystemPrompt()` 函数体」+ **双账本口径** + 设置页广播到不了的诚实边界）、**D-19**（`ensureSkillsFresh()` 这类不依赖 Agent 的读路径初始化）
- `.planning/phases/50-api-skills/50-UI-SPEC.md` — 技能管理区的设计契约（`.settings-group` 骨架 / `.skill-manage-*` 类族 / `.ai-modal-overlay` 弹框形态 / 诊断折叠块）—— D-18 的**直接照抄对象**；本阶段 `UI hint: yes` ⇒ 建议在其基础上扩一份导入弹框契约
- `.planning/phases/49-manage-skill-ai/49-CONTEXT.md` — **D-06**（name 校验三条补充 + **「写入门严、读入门宽」的故意不对称** —— D-08 改名校验器的复用依据）、**D-07**（四类撞名给不同可读原因 + 撞名判定**一律读盘**—— D-08 / D-11 依据）、**D-08**（扫描范围分字段：description 跑注入 + 凭据两组、body 只跑注入；`SKILL_THREAT_PATTERNS` 归 51 但**把扫描点接成单点** —— D-12 的交接契约）、**D-09**（净化只作用于 description，**先扫描后净化**）、**D-10**（`MAX_MANAGED_SKILLS` 与「两个闸职责分工」）、**D-11**（写函数与校验器住 `ai-skills-manager.js` + seeded 集合由调用方注入）、**D-12**（原子写 = 临时文件 + `env.renameFile`；失败不留半成品 —— D-09 / D-04 依据）、**D-13**（`syncAgentSystemPrompt()` 恰一次 + 忙时语义）
- `.planning/phases/49-manage-skill-ai/49-REVIEW.md` / `.planning/phases/50-api-skills/50-REVIEW.md` / `50-SECURITY.md` — 挂账技术债台账（`WR-12` / `IN-14` / `IN-16` / `IN-17` 与 50 收尾带出的三条；**本阶段新增真实渲染门禁时不得重复 `WR-12` 的「否命题空集真」形态**）
- `.planning/phases/48-skill-name/48-CONTEXT.md` — **D-02 / D-14**（三档来源徽标判定与「不显示体积 / 文件数 / 诊断」的收窄投影 —— 本阶段预览卡片与设置页列表的分工边界）、**D-10**（禁用 → 面板隐藏 + 显式调用被拒）、**D-11**（`shadowed` 可见但不可选中）、**D-17**（`skills:changed` 广播 + stale-while-revalidate —— D-19 的消费端）
- `.planning/phases/47-bash/47-CONTEXT.md` — **D-11**（seeded 身份 = 扫随包 `skills-builtin/` 目录名集合；**零状态文件、零硬编码** —— D-08 的 seeded 判据来源）、**D-04**（内置技能 description 用中文面向用户 —— `find-skills` 候选清单到 `skills.sh` 的闭环是 D-05 白名单的动因）、**D-03 / D-07**（去 CLI 化与零安装语义）
- `.planning/phases/46-prompt/46-CONTEXT.md` — **D-06**（`user > managed` 遮蔽 + `shadowed`/`shadowedBy` —— D-08 的「其它来源同名」语义依据）、**D-07**（诊断形态 `skill.diagnostics[]` + 模块级 `errors[]`）、**D-08**（name 恒等于目录名 + **不丢弃命名不规范的合法技能** —— D-10 的「不得接入加载期」依据）、**D-09**（禁用存 `settings.aiSkills.disabled`，加载后过滤不删文件）、**D-11**（限额常量单源 —— D-11 只能加项）

### 项目内既有先例与会话契约（实现时照抄的对象）

- `ai-skills-manager.js` — 技能集**单一数据权威**（零 electron 依赖，可单测、可被导入管线直接 require）：`LIMITS`（`:48-54`）、`MAX_SKILL_NAME_CHARS` / `MANAGED_SKILL_NAME_RE`（`:57-66`）、`SKILL_SIZE_WALK_MAX_ENTRIES` / `_DEPTH`、`refreshSkills()`（加载管线 + 体积/文件数计算接入点）、`sourceTierOf()` / `toUISkillEntry()` / `getSkillsForUI()`、`getSkillsForManagement()`（**不得与前者合并**）、`validateManagedSkillName()`（**D-08 改名复用**）、`validateManagedSkillDescription()`、`validateManagedSkillContent()`、`sanitizeSkillDescription()`、`scanSkillText()`（**49 接成的扫描单点 —— D-12 在此扩表**）、`buildSkillFileText()`（组装后全文 = 字节闸口的判据对象）、`createManagedSkill()` / `updateManagedSkill()` / `deleteManagedSkill()` / `deleteUserSkill()`（**落盘与递归删除的形状模板**）、`getSkillPromptIncluded()`、`MANAGE_SKILL_ERROR`（**必须读实例的键数以实测为准**）、`module.exports`（`:1663` 起，**本阶段在此新增导入面导出**）
- `ai-manager.js` — `getSeededSkillNamesSafe()`（零 electron 依赖边界的安全注入点）、`ensureSkillsFresh()`（`:3228`，**D-19 的重扫入口**）、`syncAgentSystemPrompt()`（`:3026` 附近，`:3048` 无变化早退、`:3053`/`:3171` 广播 —— **函数体逐字不得改**）、`refreshSkillsForPanel()`、`_flushDeferredSkillsPrompt()`、`setSkillDisabled()`（`:1628`，`:1650` 重扫 + `:1660` 补播 —— **D-19 的逐行模板**）、`uninstallUserSkill()`（`:1683`，`:1698` 重扫 + `:1699` 补播）、`getSkillsForManagement()`（`:1603`）、`_buildRealmTools()` / `_buildManageSkillTool()`（`:6124` / `:6254` 的「恰一次」先例）、`_adaptHarnessTool()`
- `agent-workspace.js` — `resolveInside()`（`:162` 起，**`:169-175` 的 ENOENT 分支就是 P2/SEC-10 的缺口** —— D-15 的加固对象）、`createSandboxEnv()`（`:205`，`guard` 双基准 + 全部 FileSystem 方法覆写 —— D-04 / D-15 的落点）、`getWorkspaceDir()` / `getSkillsDir()` / `getManagedSkillsDir()`、`createTempDir` / `createTempFile`（已重定向 `.tmp/`）
- `search-manager.js` — `isPrivateHost(hostname)`（`:195`，**已导出**，`:1668` 的 `module.exports`；fail-closed 语义 —— D-05 的复用项）、`fetchUrl` 的逐跳校验写法（`:1430` / `:1596`，**只复用判据，不复用函数** —— Anti-Pattern 7）
- `ai-memory-manager.js` — `scanInjectionPatterns()`（`:76-96`，**D-12 的复用导出**，返回 `{ safe, reason? }`）、`INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS`（`:34-58`）、`atomicWrite()`（`:142-147`）、`write()`（`:198-270`，「业务校验失败一律 throw」先例）
- `ai-attachments-manager.js` — `registerFiles` 的 `stat.isSymbolicLink() → 拒绝` 语义（**D-17 直接镜像**）、`DENIED_HOME_PREFIXES`（`SKILL_THREAT_PATTERNS` 的词表来源之一，**当前未导出**）、`buildAttachmentMarkers()`
- `main.js` — `readJsonBody(req, res, { maxBytes })`（`:936`，**D-01 的 `readRawBody` 形状模板**）、`MAX_JSON_BODY_BYTES`（`:888`，1 MiB）/ `MAX_JSON_BODY_BYTES_LARGE`（`:889`，32 MiB）、`sendJson` 幂等护栏（`:896` 附近的注释与实现）、`handleSkillsApi()`（`:2831`，**D-03 在此加 `import` 分支**）、`realmServer` 与 `/api/skills/` 分发（`:2945`）、`/settings` 内部页路由（`:3055`，**证明设置页与 `/api/*` 同源**）、`/api/favorites/import-chrome`（`:1235`）与 `import-html`（`:1256`，`{ filePath | content, mode: 'preview' | 'import' }` —— **两阶段预览的既有先例**）、`handleSettingsApi` 的 `update` 校验面（`:1372-1392`）、`dialog.showOpenDialog` 先例（`:1541` / `:3573` / `:3977`，**本阶段不新增 guest 侧 dialog**）
- `ipc-handlers.js` — `assertTrustedSender()`（`:113`）、`ai:get-skills`（`:1747`）/ `ai:refresh-skills`（`:1763`）（**主窗口侧通道的并列对象**；本阶段主窗口不新增导入入口）
- `src/settings.html` — 技能管理区（`:536-568`：`.settings-group.skill-manage-section` / `skillManageSummary` / `skillManageState` / `skillManageGroups` / `skillManageHint` / **`skillManageConfirm` 弹框（D-18 的形态模板）**）、`rulesFileInput`（`:197`，**`<input type="file">` 先例 —— D-18 复用**）、AI 助手分区（`:266`）
- `src/settings-page.js` — `skillsApi()`（`:4874`，**HTTP 客户端的逐行模板**）、`aiMemoryApi()`（`:172`）、`Skill manage region`（`:4784` 起：`renderSkillManageState` / `buildSkillManageRow` / 诊断徽标与详情区 / `setSkillManageHint` —— D-13 / D-18 复用）、`rulesFileInput` 的 `click()` / `handleFileSelect` / `finally` 重置（`:769` / `781` / `1242`，**文件选择的复用对象**）、`aiBashWhitelist` 即改即存链路（`:2839-2900`）、`aiMemoryHint` 自动复位（`:3879` 附近）
- `src/skill-picker-model.js` — `STATUS_TEXT`（`:239-244`）与 `PROMPT_OMITTED_CARD_NOTE`（`:269`）（**状态文案单源**）、`SKILL_NAME_RE`（`:29`，**写入门严 / 读入门宽**的判据来源）
- `src/preload.js` — `getSkills`（`:1033`）/ `refreshSkills`（`:1040`）/ `showOpenDialog`（`:882`）
- `window-manager.js` — `broadcast()`（`:310`，只发窗口 webContents，不到 guest —— D-19 诚实边界的判据来源）
- `docs/product/ai-skills.md` — 本阶段按 `AGENTS.md` 维护约定新增**导入**章节 + **安全边界与已知限制章节定稿**（白名单 / 限额 / 威胁扫描「启发式、非安全边界」/ **DNS rebinding 残余风险**/ `allowed-tools` 免责标注 / 覆盖语义与临时备份 / 技能根定位与多技能拒绝 / 回读验证）。现有十二节：能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制 / 测试与验证 / 内置技能 / bash 安装档 / 发现与调用 / AI 自建技能 / 技能管理面
- `docs/product/ai-agent-workspace.md` — **§七 第 6 条**（技能不构成额外权限 / `allowed-tools` 不被强制 —— D-13 的文案口径来源）、§四§五§七（bash 三档策略 —— D-15 的行为变更要在这里披露）
- `AGENTS.md` §AI 工作区与 Bash 权限 / §新增 IPC 接口 / §内部页面 CSP / §弹框居中约定 / §数据访问分层约定 / §开发正式环境差异（`asarUnpack` 与新增依赖四条）/ **打包排除项配置护栏**（`build.files` 每一项以 `!` 开头）— 维护约定与测试清单
- `tests/` — `tests/test-ai-skills.js`（技能域全量 + 扫描）、`tests/test-manage-skill.js`（49 的校验器与拒绝面矩阵）、`tests/test-agent-workspace.js`（沙箱原语 —— **SEC-10 加固的增补处**）、`tests/test-skills-management.js` / `tests/test-skills-http-api.js`（50 的管理面与传输面 —— **新路由 + 413 形态的增补处**）、`tests/test-builtin-skills-seeder.js`（seeded 集合 + **打包排除项配置护栏**）

### 参考实现（仓库外，仅作设计参照，不引入依赖）

- `/Volumes/ZhiTai/Projects/github/openhanako/` — omp（oh-my-pi）系列参考：`docs/tools/manage_skill.md`（Limits & Caps 与全部错误消息）、`docs/skills.md`（技能对象形状 / 7 层 provider priority —— 本阶段**只作对照**，Realm 明确只做 2 类来源）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`main.js:936` 的 `readJsonBody(req, res, { maxBytes })` 是 D-01 的 `readRawBody` 逐行模板**：它已经把 50 D-16 的全部教训固化在代码里（`sendJson` 幂等护栏在 `:896` 附近；413 形态 = `sendJson(413)` + `req.resume()`）。**照抄它的形状**而不是重新发明一个流读取器。两个既有上限常量就在旁边（`:888` 1 MiB / `:889` 32 MiB）—— 新增的必须在命名上区分量。
- **`/api/favorites/import-html`（`main.js:1256`）就是两阶段导入的既有先例**：`{ filePath | content, mode: 'preview' | 'import' }` + `readJsonBody(…, { maxBytes: MAX_JSON_BODY_BYTES_LARGE })`。D-02 / D-03 的两阶段形状可以从它抄结构，但**必须改进两点**：① 它接受 `filePath`（本阶段**绝不**接受路径，只接受 `importId`）；② 它没有临时目录的 TTL 与崩溃清扫。
- **`handleSkillsApi`（`main.js:2831`）+ `skillsApi()`（`src/settings-page.js:4874`）是前后端两条现成管线**：token 鉴权 → `route = pathname.replace(prefix,'')` → 分支 → `sendJson`；前端 `fetch(\`/api/skills${suffix}?${params}\`)`。D-03 的 `import` 分支与 D-18 的客户端函数**都只是往这两处各加一段**。
- **`Skill manage region`（`src/settings-page.js:4784` 起）+ `settings.html:536-568` 是本阶段的 UI 承载面**：`.settings-group` 骨架、`buildSkillManageRow` 的行构造、诊断倒扣块、`skillManageHint` 的失败反馈、**`skillManageConfirm` 弹框**（`.ai-modal-overlay` + `.ai-modal` 的可用形态）全部现成 ⇒ D-18 只需「在标题行右侧加一个按钮」+ 一个同族新弹框。**零新视觉语言**。
- **`rulesFileInput`（`settings.html:197` + `settings-page.js:769/781/1242`）是文件选择的完整先例**：`elements.rulesFileInput.click()` 触发、`change` → `handleFileSelect`、`finally` 里 `reset()` 保证可重复触发。D-18 照抄这条链路即可，**不需要 native dialog**（也就避免了给 guest 开 IPC 通道）。
- **沙箱已提供落点原语**：`env.renameFile`（双路径校验）/ `env.exists` / `env.listDir` / `env.fileInfo` / `env.remove({recursive:true})`。**落点一步用它们，解压一步用 Node `fs`**（D-04 的理由）。`env.listDir` 的返回形状与 symlink 陷阱已由 50 research 实测（`{name,path,kind,size,mtimeMs}`；**内部链接可穿入 ⇒ naive 递归无限循环**；外逃链接 `permission_denied`）。
- **`search-manager.isPrivateHost` 已导出**（`:195` / `:1668`），fail-closed（DNS 解析失败返回 `true`）—— D-05 直接 require，**不复制一份**。

### Established Patterns

- **单一数据权威 + 转发层纪律**：判定 / 校验 / 写函数 / 限额 / 扫描表全在 `ai-skills-manager.js`（零 electron 依赖、可单测）；`main.js` handler 与 `ai-manager.js` 只做转发。**本阶段的 zip 解压 / 网络校验 / 冲突判定 / 落盘函数必须遵守同一条** —— 否则会写出 49/50 明确要防的第二份实现。
- **常量单源、端点与前端零字面量**（45/46 纪律）：`LIMITS` 与新的导入限额都只在主进程定义一处，主进程把它们**投影**给设置页；设置页**不得**写死任何限额数值。
- **禁止静默失败**（SKILL-06 / P12；Phase 11 UAT 的事故根因）：拒绝必须给可读原因 + 机器可读码；**导入必须回读验证**（D-10）；TTL 过期 / 校验失败 / 扫描结论都要有真实文案（USER-08）。
- **冻结快照 + 同步只读**（G-42-4）：`buildSystemPrompt()` 保持同步零 IO —— 所以导入的**重扫只能经 `ensureSkillsFresh()`**，不得在任何 Agent 创建路径上做 IO。
- **写路径收口形状**（50 建立）：`await ensureSkillsFresh()` 恰一次 + **调用侧**补 `windowManager.broadcast('skills:changed')` 恰一次；**不得改 `syncAgentSystemPrompt()` 函数体**。
- **读盘而非缓存快照**（46/49/50 一以贯之）：冲突判定、数量闸、存在性校验一律读盘（bash 可随时改写磁盘）。
- **`realm://` 页面 CSP**：初始隐藏走 CSS 类、**禁 markup 内联 `style`**；显隐一律用 JS CSSOM 具体值；**绝不把 `.ai-modal-overlay` 用到 `<dialog>` 上**。
- **诚实边界必须成文**：bash 白名单（「启发式而非安全边界」）、`allowed-tools`（「不被强制」）、`manage_skill` 的 bash 绕过面 —— 本阶段的**威胁扫描启发式性**、**DNS rebinding 残余风险**、**SEC-10 加固后的行为变更**同批要进产品文档。
- **设置页与 `/api/*` 同源**（实测：`main.js` 零 `Access-Control-Allow-*`；`/settings` 由 `:3055` 经本地 HTTP 提供）⇒ 前端 `fetch` 无需 CORS 处理；**但主窗口是 `file://`，仍只能走 `realmAPI` IPC**（Phase 38 事故，两条不可互换）。

### Integration Points

- `ai-skills-manager.js` —— 新增**导入面**：限额常量、`SKILL_THREAT_PATTERNS` + 技能域扫描函数（`scanSkillText` 扩表）、zip 解压与全树校验、网络包校验、技能根定位、冲突判定、`importUserSkill()`（含覆盖两段 rename + 回滚）、导入报告构造；**全部零 electron 依赖**，签名沿用 `(env, { …, seededNames })` 模式（seeded 集合由调用方注入）
- `agent-workspace.js` —— 新增 `resolveInsideForWrite()`（D-15）并把 `createSandboxEnv` 的全部写入面切过去（**SEC-10**）
- `ai-manager.js` —— 转发方法（`previewSkillImport()` / `commitSkillImport()` 或等价命名）；成功出口：`await this.ensureSkillsFresh()` + **调用侧**补播恰一次（D-19）
- `main.js` —— `handleSkillsApi` 加 `import` 分支（`Content-Type` / `mode` 分流）+ 新写 `readRawBody()` + `MAX_SKILL_PACKAGE_BYTES` 常量；**必须确认 `req.resume()` 的 413 形态在这条新路径上同样成立**
- `src/settings.html` / `src/settings-page.js` —— 「导入技能」按钮 + 两 tab 弹框 + 预览卡片（名称 / description 原文 / 目录树 / 字节数 / 脚本标红 / 扫描结论 / `allowed-tools` 免责标注）+ 冲突三选一 + 必勾风险复选框 + inline hint
- `docs/product/ai-skills.md` —— 新增导入章节 + **安全边界与已知限制章节定稿**（DNS rebinding / 启发式声明 / 白名单 / 限额 / 覆盖与临时备份 / 技能根定位）；`docs/product/ai-agent-workspace.md` 补 SEC-10 的行为变更；`AGENTS.md` 维护约定与测试清单同步（新增依赖、新增错误码、`SKILL_THREAT_PATTERNS` 连带 `manage_skill`、双账本）
- `package.json` —— 新增 `yauzl@^3.4.0` 与 `yaml`（与 SDK 同版 `^2.9.0`）；走 `AGENTS.md` 的依赖审计四条 + 核对 `build.files` 的 `!` 前缀护栏
- `tests/` —— 新增两个套件 + 三个既有套件增补（见 Claude's Discretion 的必测清单）

</code_context>

<specifics>
## Specific Ideas

- **本阶段最容易被写错的一条是「两个落盘路径」**：zip 上传、网络 zipball、直链 SKILL.md 三种来源如果各有一段落盘代码，就是 P9 明令禁止的形态（「绝不为直链 SKILL.md 写第二条落盘路径（两条路径 = 两套漏洞）」）。**实施与验收都要有机械判据**：源码扫描断言「落盘函数只有一个调用点」。这也是 D-03 把分流放在**入参解析层**而不是落盘层的全部理由。
- **`importId` 不透明句柄是本阶段的接口设计边界**（镜像 Anti-Pattern 1）：一旦允许客户端传路径（哪怕是「临时目录路径」），沙箱就兜不住后续任何一处疏漏。**没有第二条路可走**。
- **覆盖的「备份 + 回滚」不是版本历史**：它是一次性的临时备份（成功后即刻删除）。写进 CONTEXT 是为了防下游把它读成「既然都备份了，顺手做个恢复按钮」—— 那是 **ECO-02 / v1.x**，且会与 50 的「卸载无备份」口径分裂。
- **威胁扫描的两级效力是「用户会不会失去功能」的决策，不是安全强度的取舍**：硬拒 `SKILL_THREAT_PATTERNS` 会让「部署 / CI / 数据同步」类合法技能**永久无法导入且用户无法自救**；而 P3 自己就把这三类的性质写成「启发式、降低概率」。真正的边界是 **预览确认 + 沙箱**（P3 原文）。**但 `INJECTION_PATTERNS` 命中仍必须硬拒** —— 那类句子无合法用途。
- **`SKILL_THREAT_PATTERNS` 扩表会连带改变 49 的 `manage_skill` 行为**（49 D-08 明文「49 接成单点、51 扩表即可」）。这是**契约兑现而非越界**，但如果不写进文档，后续会被当成 51 的意外副作用或被误读成「49 漏做了」。
- **白名单里 `skills.sh` 是非 GitHub 的唯一一条，且它承载产品闭环**：47 把内置 `find-skills` 改写成「零安装候选清单」，候选的落点就是 `skills.sh`。删掉它 = 「内置技能给出候选 → 用户一键导入」断在最后一步。**放宽白名单**则直接削弱 P9 的阻断判据 —— 两个方向都要付出代价，所以这条必须显式记录。
- **不做 Contents API 分支的理由有两条且都硬**：① 未鉴权 60 req/h（P9 第 6 条）；② `.planning/STATE.md` 明文它**从未发过真实网络请求验证**。省掉它 = 少一条未验证的网络路径 + 少一整条限流面，代价只是要求用户用 `tree/<ref>/<path>` 地址。
- **SEC-10 的加固必须连「诚实边界」一起交付**：加固后 `bash` 里「`ln -s` 出去再写」会被拒 —— 这是**正确**行为，但属行为变更。只改代码不写文档 = 用户与后续开发者都会把它当成 bug。
- **双账本口径（本阶段要收口但不得混淆）**：`syncAgentSystemPrompt()` 的**写路径**份额在 51 完成后到 **3/3**（该 ⚠️ 可闭合），但**读侧 / 兜底**份额（`refreshSkillsForPanel()`、`ensureSkillsFresh()`）**不是同一个量**。`STATE.md` 与 `docs/product/ai-skills.md` 必须**分别记两个数**，**不得**声称 P8 失效链 6/6 全覆盖。
- **本阶段的 UI hint**：ROADMAP 标 `UI hint: yes` ⇒ 规划时**建议先跑 `/gsd:ui-phase 51`** 产出设计契约（弹框两 tab 形态 / 预览卡片信息层级 / 威胁高亮与必勾确认 / 冲突三选一选择器 / 目录树折叠与计数 / `realm://` CSP 下的初始隐藏 / `TD-48-01` 的属性上下文转义要求）。
- **测试的「假绿」形态要主动规避**（50 收尾实测的三处 + 49 的 `WR-12`）：① 时间线采样必须排除 pre-click / same-tick；② 读 hint 要避开 2000ms 自动清空；③ 面板在 `display:none` 时 `getBoundingClientRect` 全 0 ⇒ 「0 vs 0 全等」假绿；④ **承重判据必须带正命题**（不能只有否命题 —— `WR-12` 的教训）；⑤ 生成给 guest 执行的源码字符串里的**反引号会提前终止外层模板字面量**（Phase 50 踩过两次）。
- **新驱动不得把证据只留在 `/tmp`**：`IN-16` / `WR-09` 的教训是「红→绿证据只活 `/tmp` + 依赖本机 `realm-dev` 用户数据 ⇒ 新机器 / CI 跑不起来、结论不可重跑复核」。本阶段若新增运行期驱动，**前置数据要动态取基线**而非硬编码。

</specifics>

<deferred>
## Deferred Ideas

- **多技能 zip 包勾选安装** —— **ECO-01**（v1.x）。本阶段 D-06 明确「命中 0 个或多于 1 个技能根即拒绝并提示改用 tree 子目录地址」。
- **GitHub Contents API「列一层」分支** —— 本阶段**显式不做**（D-06）；归 ECO-01 同批（含 403/429 的限流提示与勾选 UI）。
- **导入来源的持久化记录**（把源 URL / commit SHA 写进某处，日后可核对来源版本）—— 46/47 的「零状态文件、零硬编码」纪律下 v1 **不写盘**；来源信息只在导入报告里展示。若日后要做，须先定义「用户技能目录里多一个非技能文件，加载管线如何处置」。
- **导入前备份 / 版本历史 / 恢复内置技能按钮** —— 与 50 的卸载同批，归 **v1.x / ECO-02** 同类。D-09 的备份是**临时**的（成功后即刻删除），**不得**扩张成版本历史机制。
- **`allowed-tools` 的执行层门禁**（按技能 / 按会话收窄工具能力）—— REQUIREMENTS 的 **Out of Scope** 明文（SDK 的 `Skill` 类型无该字段，自建机制超出本期）；本阶段只**解析 + 带免责标注展示**。
- **技能包签名 / 校验和 / 发布者验证 / 应用内技能市场** —— 无服务端信任根，非本期核心价值（与「应用内技能市场 / 排行榜 / 遥测」同批 Out of Scope）。
- **`SKILL_THREAT_PATTERNS` 接入加载期**（对已在盘上的技能扫描后丢弃）—— **明确不做**（D-12）：会推翻 46 D-08 并让**已导入的合法技能在某次升级后消失**。若日后要做，须先定义「扫到的技能如何处置而用户不失去它」。
- **`/api/skills/set-disabled` 的存在性校验**（50 收尾带出的不对称：删目录后调该端点实测 HTTP 200 且名字被写进 `disabled` 名单）—— 不属本阶段需求；`STATE.md` 已具名留档，根治路径已写（在 `setSkillDisabled` 的名字谓词之后加存在性判据 + 复用 `not_found` 码 + 同步 `tests/test-skills-http-api.js` / `test-skills-management.js` 与 `docs/product/ai-skills.md` §十二）。
- **四态可见性（ECO-05）/ 容器级技能作用域（ECO-06）/ `/compact` 保留技能正文（ECO-03）/ `$ARGUMENTS` 与堆叠调用（ECO-04）/ 多源发现** —— 维持既有 defer 与 Out of Scope 不变。
- **主窗口内的技能管理 / 导入 UI** —— 50 D-17 已明确「不得为了让 IPC 有消费者而在主窗口新造一套管理 UI」，本阶段沿用；ROADMAP 的承载面就是设置页。
- **为设置页 guest 单开一条 push 通道**（让多开设置页实例即时同步）—— 50 D-18 已显式不做；本阶段沿用「每次操作 / 每次进入自行重拉」。
- **TD-48-01 / TD-48-02** —— 用户已裁决「阶段 48 不发版 → 延后」，49 / 50 均未处置，本阶段同样**不在需求范围**。⚠️ 但本阶段的**预览卡片**会渲染大量**来自不可信包**的字符串（文件名 / 目录树路径 / description 原文 / 诊断原文 / `allowed-tools` 值）⇒ **必须**走安全转义路径，**属性上下文尤其**（`title` / `aria-label` / `data-*`），负起「不扩大缺口」的责任；行号已随 49 / 50 漂移，执行前重新定位。
- **`WR-12` / `IN-14` / `IN-16` / `IN-17` / `IN-10` ~ `IN-13` / `WR-02` / `WR-06`** —— 既有挂账，不阻断、不在本阶段范围。**若本阶段新增真实渲染门禁，不得重复 `WR-12` 的「否命题空集真」形态**（承重判据必须带正命题）；新驱动的证据**不得**只活 `/tmp`（`IN-16` / `WR-09` 的教训）。
- **`importId` 跨窗口 / 跨设置页实例共享** —— 本阶段 Map 在主进程内存，多实例各自发起导入互不冲突即为正确行为；**不做**「一个实例的预览在另一个实例可见」。
- **bash 安装档只读豁免的结构性根因**（`47-REVIEW.md` 的 CR-01 / CR-02 / 残余 ③）—— 无归属阶段的技术债，根治走 argv 级分词；本阶段**不碰**（但本阶段引入的 `yauzl` / `yaml` 安装动作会让「`npm install` 类命令必须强制确认」这条门禁更常被触发，值得在文档里留意）。

</deferred>

---

*Phase: 51-用户技能导入管线（zip + 网络地址）*
*Context gathered: 2026-09-15*

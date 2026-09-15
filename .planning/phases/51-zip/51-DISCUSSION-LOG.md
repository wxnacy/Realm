# Phase 51: 用户技能导入管线（zip + 网络地址） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15
**Phase:** 51-用户技能导入管线（zip + 网络地址）
**Areas discussed:** 导入数据流形态、网络导入白名单与 GitHub 分流边界、同名冲突与覆盖的原子性、威胁扫描结论的效力分级、预览卡片信息口径与 allowed-tools、SEC-10 沙箱加固范围、依赖处置（yauzl / yaml）、导入入口形态与刷新链收口
**Mode:** `--auto`（全自动；每个决策按推荐项选定，无 AskUserQuestion 交互）

---

## 导入数据流形态（传输 + 两阶段句柄）

| Option | Description | Selected |
|--------|-------------|----------|
| base64-over-JSON | 复用 `readJsonBody`，上限需显式放大到 48 MiB（`50-RESEARCH.md:1343-1344` 推导 ≈ 42.67 MiB + 余量）；guest 侧需 FileReader + ≈43 MB 字符串峰值 | |
| raw binary body | `fetch(url, { method:'POST', body: file })` + `Content-Type: application/zip`；上限 32 MiB 可从解压累计限额推导；需新写流式 `readRawBody` | ✓ |

**User's choice:** raw binary body + `readRawBody` + `MAX_SKILL_PACKAGE_BYTES = 32 MiB`（推荐项）
**Notes:** 设置页 guest 与 `/api/*` 同源（实测 `main.js` 零 `Access-Control-Allow-*`，`/settings` 由 `:3055` 经本地 HTTP 提供）⇒ 同源 POST 不触发预检。`50-RESEARCH.md:1348` 明文「**推荐 Phase 51 评估『不 base64』的替代**」，本决策即该建议的采纳。配套硬约束：413 形态必须复制 50 D-16 的 `sendJson(413)` + `req.resume()`；禁止 `destroy` / `Connection: close`；禁止「先 arrayBuffer() 再判大小」。

---

## 两阶段之间的暂存语义

| Option | Description | Selected |
|--------|-------------|----------|
| 保留临时目录 + `importId` 句柄 | 解压产物跨阶段存活；commit 只收不透明句柄；需 TTL + 崩溃清扫 + 并发上限 | ✓ |
| 丢弃后 commit 重传 / 重下 | 无状态、无 TTL；但网络包二次下载会打满 GitHub 未鉴权 60 req/h，且大包重复解压 | |

**User's choice:** 保留临时目录 + 内存 Map 发 `importId`（推荐项）
**Notes:** ROADMAP 判据 4 的「解压只在 `mkdtempSync` 新建的空目录内进行，**落盘前**用最近已存在祖先 realpath 复核」预设了跨阶段存活。`importId` 是**不透明句柄而非路径** —— 镜像 Anti-Pattern 1（「给 `manage_skill` 传 `path` 参数 = 沙箱在这里提供不了保护，接口设计才是边界」）：客户端永远不能指定落点。TTL 建议 10 分钟、并发上限建议 3。

---

## 路由形状

| Option | Description | Selected |
|--------|-------------|----------|
| 单路由 + Content-Type / mode 分流 | `POST /api/skills/import`（50 D-15 已预留 `install` 位置） | ✓ |
| `import` + `import-upload` 两条 | 上传与 JSON 各一条 | |

**User's choice:** 单路由分流（推荐项）—— 但**判据是「只有一个落盘实现」而非路由条数**，路由条数落 Claude's Discretion
**Notes:** P9 第 5 条硬约束「绝不为直链 SKILL.md 写第二条落盘路径（两条路径 = 两套漏洞）」⇒ 验收要有机械判据（源码扫描：落盘函数只有一个调用点）。

---

## 网络导入：主机白名单

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub 五域 + `skills.sh` | `github.com` / `api.github.com` / `codeload.github.com` / `raw.githubusercontent.com` / `objects.githubusercontent.com` / `skills.sh` | ✓ |
| 任意 https + 私有地址拦截 | 更宽松，靠 `isPrivateHost` 兜底 | |

**User's choice:** 白名单六域（推荐项，对齐 P9 第 1 条）
**Notes:** `skills.sh` 是唯一非 GitHub 条目，承载产品闭环 —— 47 把内置 `find-skills` 改写成「零安装候选清单」（O1 裁决 ②），候选落点就是 `skills.sh`；删掉它会让「内置技能给出候选 → 一键导入」断在最后一步。另：强制 https、跳数超限**必须抛错**（顺手修 P9 第 2 条记录的「带着 3xx 掉出循环 → 报 `HTTP 301` 误导性错误」）、复用 `isPrivateHost` 判据但**不复用** `search-manager.fetchUrl`（Anti-Pattern 7）。

---

## 网络导入：GitHub 分流边界

| Option | Description | Selected |
|--------|-------------|----------|
| 不做 Contents API；仓库/目录一律转 codeload zipball | 顶层前缀剥离 + 子路径定位；省掉一条未验证网络路径与 60 req/h 限流面 | ✓ |
| 做 Contents API 列一层 | 支持列出多技能让用户挑 | |

**User's choice:** 不做 Contents API（推荐项）
**Notes:** 两条硬理由：① 未鉴权 60 req/h（P9 第 6 条）；② `.planning/STATE.md` 明文该分支**从未发过真实网络请求验证**。

---

## 多技能仓库 / 多技能包的处理

| Option | Description | Selected |
|--------|-------------|----------|
| 拒绝 + 提示改用 `tree/<ref>/<path>` | 与 O2 的 v1「恰好一个技能根」一致；提示可操作 | ✓ |
| 列出 SKILL.md 让用户勾选 | = ECO-01（v1.x） | |

**User's choice:** 拒绝并给可操作提示（推荐项）
**Notes:** O2 已裁决 v1 = 恰好一个技能根（`.planning/STATE.md:301`）；勾选安装是 **ECO-01**（REQUIREMENTS v2，非本里程碑）。`tree/<ref>/<path>` 已覆盖「挑某个技能」的真实需求。

---

## 同名冲突策略

| Option | Description | Selected |
|--------|-------------|----------|
| 按来源分档 | seeded → 拒绝导入；已有 user → 覆盖/改名/取消三选一；其它来源（managed）→ 只允许改名/取消 | ✓ |
| 一律三选一 | 含 seeded 也允许覆盖 | |
| 一律拒绝 | 不给覆盖选项 | |

**User's choice:** 按来源分档（推荐项，对齐 SEC-07 与 P3 第 3 条）
**Notes:** SEC-07 明文「与内置技能同名 → 拒绝导入；与已有用户技能同名 → 显式策略（覆盖 / 改名 / 取消），不静默覆盖」。改名走 `validateManagedSkillName` 同一份校验器（49 D-11 / 50 复用纪律）；改名 = 新建（占 `MAX_USER_SKILLS`），覆盖 = 净增 0（豁免预检）。

---

## 覆盖的原子性与回滚

| Option | Description | Selected |
|--------|-------------|----------|
| 备份 + 两段 rename（可回滚） | 旧目录先 rename 到 `.tmp/skill-replace-<rand>/`，新目录 rename 进 `skills/<name>`，失败则回滚；成功后即删备份 | ✓ |
| 直接 rm + rename | 不可回滚（与 50 卸载「无备份」同款） | |
| 不提供覆盖 | 只有改名 / 取消 | |

**User's choice:** 备份 + 两段 rename（推荐项）
**Notes:** 导入是**用户已显式确认**的破坏性动作，被替换的是**用户自己**的目录（可能手改过、可能带自写 `scripts/`）⇒「先删后移」失败会**静默丢技能**。与 49 D-12 的「tmp + rename、失败不留半成品」同一纪律，对象从文件升级为目录。⚠️ 与 50 的「卸载无备份」不冲突：备份是**临时**的（成功后即刻删除），**不得**扩张成版本历史 / 恢复按钮（那是 ECO-02 / v1.x）。

---

## 威胁扫描结论的效力分级

| Option | Description | Selected |
|--------|-------------|----------|
| 分级 | `INJECTION_PATTERNS` + `CREDENTIAL_PATTERNS` 命中 → **硬拒整包**；`SKILL_THREAT_PATTERNS`（技能域三类）命中 → 预览高亮 + **必勾「我已了解以上风险」** | ✓ |
| 一律硬拒整包 | 最严格，但会误伤合法技能 | |
| 一律只警告 | 最宽松，注入类句子也放行 | |

**User's choice:** 分级（推荐项）
**Notes:** 决策判据不是安全强度取舍，而是「**用户会不会失去功能且无法自救**」。P3 自己把技能域三类写成「启发式、**降低概率**而非安全边界」，真正的边界是 P3 原文的「**导入预览确认 + 沙箱**」。合法「部署 / CI / 数据同步」类技能必然命中 `curl` / `.env` / 「无需再次询问」。而 `INJECTION_PATTERNS` 命中（「忽略之前的所有指令」）无合法用途 ⇒ 仍硬拒。分字段口径沿用 49 D-08：description 跑注入 + 凭据两组，body 只跑注入组。

---

## 扫描表落点与加载期接线

| Option | Description | Selected |
|--------|-------------|----------|
| 落 `ai-skills-manager.js` + 仅导入与写入侧生效 | 技能域、零 electron 依赖、可单测；**不接入加载期** | ✓ |
| 落 `ai-memory-manager.js` + 接入加载期 | 对已在盘上的技能也扫 | |

**User's choice:** 技能域模块 + 不接入加载期（推荐项）
**Notes:** 接入加载期会推翻 46 D-08（「不丢弃命名不规范的合法技能」）并让**已导入的合法技能在某次升级后消失**（49 D-05 已付过这条论证）。**扩表的连带效果是契约兑现而非越界**：49 D-08 明文「49 把扫描点接成单点，51 只需扩表、不加接线」⇒ 扩表后 49 的 `manage_skill` 自动获得技能域模式，须写进文档防误读。

---

## 预览卡片信息口径

| Option | Description | Selected |
|--------|-------------|----------|
| 目录树折叠 + 计数 | 默认展开前 50 项 + 「共 N 个文件 / M 个目录」+ 可展开全量 | ✓ |
| 全量平铺 | research 实测 `anthropics/skills` 整仓 512 条目 ⇒ 卡片不可用 | |

**User's choice:** 折叠 + 显式计数（推荐项）
**Notes:** 截断**必须显式说明总数**（禁静默截断）。description 展示**原文**（`sanitizeSkillDescription` 只作用于落盘时写进 frontmatter 的值 —— 预览要让用户判断净化是否误伤）。

---

## 脚本清单标红判据

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展名集合 + POSIX 可执行位 | `.py/.sh/.bash/.zsh/.js/.mjs/.cjs/.ts/.rb/.pl/.php/.ps1/.bat/.cmd/.exe/.dylib/.so/.node` 或可执行位 | ✓ |
| 仅 `scripts/` 目录 | 漏掉根级脚本与其它目录 | |

**User's choice:** 扩展名 + 可执行位（推荐项）
**Notes:** 实测参照：内置 `skill-creator` 含 8 个 `.py` 与一个 44,998 字节的 `viewer.html`。文案**必须**写清「技能不构成额外权限 —— 这些脚本受既有 bash 三档策略与确认卡片约束」（与 `docs/product/ai-agent-workspace.md` §七 同口径）。

---

## `allowed-tools` 的处置

| Option | Description | Selected |
|--------|-------------|----------|
| 解析 + 带免责标注展示 | O3 裁决 ② 的 51 半边 | ✓ |
| 完全解析不展示 | 与 O3 不符 | |

**User's choice:** 解析并展示 + 免责标注（推荐项）
**Notes:** **解析动因是硬需要而非美观**：SDK 的 `Skill` 类型**根本没有该字段**（P6 逐字引用 `dist/harness/types.d.ts:28-39`）⇒ 要拿到它**必须自行解析 frontmatter** ⇒ 直接决定 `yaml` 的依赖处置。免责标注原文「当前运行时不被强制，仅供参考」；REQUIREMENTS 的 Out of Scope 明文排除「`allowed-tools` 执行层门禁」。

---

## 依赖处置

| Option | Description | Selected |
|--------|-------------|----------|
| `yauzl@^3.4.0` + `yaml`（与 SDK 同版 `^2.9.0`）提升为直接依赖 | yauzl 库自身从不写盘（adm-zip CVE-2026-76845 那一类结构性不可能） | ✓ |
| 走 SDK `loadSkills` 往返 + 结构性检测（零新增 frontmatter 依赖） | O5 的 ① 方案 | |

**User's choice:** 两个依赖均显式声明（推荐项 = O5 的 ② 分支）
**Notes:** O5 原建议以 ① 为主，但其前提是「**只需知道 name 是否缺失**」；O3 要求解析 `allowed-tools` 使该前提不成立 ⇒ 必须自解析 frontmatter ⇒ 走 ②。① 方案的结构性检测本身也是**间接判据**（只在「name 恰好等于随机临时目录名」时才有信号）。打包纪律：两者纯 JS、无原生模块、无数据文件 ⇒ **不需要** `asarUnpack`；但必须过 `AGENTS.md` 的完整依赖审计（registry 存在性 / 下载量 / 源仓库 / `postinstall` / 与 `build.files` 的 `!` 前缀护栏联动）。⚠️ `yaml` 双实例会**静默**产出解析差异 ⇒ 必须与 SDK 同版。

---

## SEC-10 沙箱加固范围

| Option | Description | Selected |
|--------|-------------|----------|
| 新增写目标专用复核 + 沙箱全写入面切换 | `resolveInsideForWrite()`：父目录链的最近已存在祖先 realpath 复核；不改 `resolveInside` 对**已存在**路径的语义 | ✓ |
| 只修导入路径 | 留下 P2 明示的既有沙箱缺口 | |
| 直接改 `resolveInside` | 会改变既有已存在路径之外的语义面，影响不可枚举 | |

**User's choice:** 新增写目标专用复核 + 沙箱全写入面切换（推荐项）
**Notes:** 缺口事实（P2 已实测复现）：`agent-workspace.js:169-175` 的 `ENOENT` 分支**只做词法校验**。ROADMAP 判据 4 明文要求「既有沙箱 `writeFile` 的 ENOENT symlink 缺口**一并加固**」。**行为变更必须成文**：加固后 `bash` 里「先 `ln -s <沙箱外路径> link` 再写 `link`」**会被拒绝** —— 正确行为但属变更；沙箱内自指的 symlink 仍放行。

---

## 导入入口形态与文件选择

| Option | Description | Selected |
|--------|-------------|----------|
| 设置页按钮 + div 遮罩弹框（两 tab）+ 复用 `<input type="file">` | 零新基建，与 50 同族 | ✓ |
| 新增 native dialog IPC 通道（guest → host） | 为 guest 开新通道 | |

**User's choice:** 设置页按钮 + 遮罩弹框 + file input（推荐项）
**Notes:** 设置页是**纯 HTTP 客户端**（50 D-18 的诚实边界同一取向：不给 guest 开新通道）；同源 `fetch` 可直接以 `File` 作 body。既有先例：`src/settings.html:197` 的 `rulesFileInput` + `src/settings-page.js:769/781/1242`（`click()` / `handleFileSelect` / `finally` 重置）。弹框形态照抄 `skillManageConfirm`（`.ai-modal-overlay` + `.ai-modal`，初始隐藏走 CSS 类，**禁 markup 内联 style**，**绝不**把 overlay 用到 `<dialog>` 上）。失败反馈走既有 inline hint，**不新建 toast 基建**。**不新增主窗口入口**（ROADMAP 承载面就是设置页）。

---

## 成功后刷新链收口

| Option | Description | Selected |
|--------|-------------|----------|
| 与 50 同款：重扫恰一次 + 调用侧补播恰一次 | `await ensureSkillsFresh()` + `windowManager.broadcast('skills:changed')` | ✓ |
| 照 ROADMAP 字面写 `refreshSkills()` + `syncAgentSystemPrompt()` | 两次全量重扫（49-01 D-13 已付过这个代价） | |

**User's choice:** 与 50 同款（推荐项）
**Notes:** **不得改 `syncAgentSystemPrompt()` 函数体**（46-04 方法体源码断言 + 48 广播次数断言同时钉着它）。本阶段完成后 `syncAgentSystemPrompt()` 生产调用方的**写路径**份额达 **3/3** ⇒ `STATE.md` 的 ⚠️ 可闭合；但**不得**读成 P8 失效链 6/6 —— **读侧 / 兜底**份额（`refreshSkillsForPanel()`、`ensureSkillsFresh()`）**不是同一个量**，两处账本必须**分别记两个数**。

---

## Claude's Discretion

- `importId` 生成方式、Map 字段名、TTL 具体值（建议 10 分钟）、并发上限（建议 3）
- `readRawBody` 的函数名与落点、`MAX_SKILL_PACKAGE_BYTES` 的常量名（须与 `MAX_JSON_BODY_BYTES_LARGE` 区分量）
- 路由条数（判据 = 只有一个落盘实现）
- 限额常量的组织（并入 `LIMITS` vs 新增 `IMPORT_LIMITS`）与切点；从 P7 建议值出发（单 entry 1 MB / 累计 32 MB / entry 数 2000 / 压缩比 100:1 / 嵌套 8 / `SKILL.md` 64 KiB）；`LIMITS` 只允许加项；端点与前端零字面量
- 目录树与脚本清单的截断阈值、折叠交互、必勾复选框文案、改名输入框形态 —— 交 plan 期；ROADMAP 标 `UI hint: yes` ⇒ **建议先跑 `/gsd:ui-phase 51`**
- `SKILL_THREAT_PATTERNS` 的具体模式表与词表来源（P3 草案 + `DENIED_HOME_PREFIXES`〔当前未导出〕+ `ai-bash-policy` 的 `DANGEROUS_*`）；**测试必须带正命题**
- 技能根定位实现细节与新增错误码集合（走 50 建立的「码数账本三处一起刷」纪律）
- 测试组织：建议新增 `tests/test-skills-import.js` + `tests/test-skills-import-net.js`（网络面用本地 stub server），并增补 `tests/test-ai-skills.js` / `test-agent-workspace.js`（SEC-10）/ `test-skills-http-api.js`（新路由 + 413）；**禁止 `npm test`**

## Deferred Ideas

- 多技能 zip 包勾选安装（**ECO-01**）
- GitHub Contents API「列一层」分支（本阶段显式不做）
- 导入来源的持久化记录（源 URL / commit SHA）—— 46/47「零状态文件」纪律下 v1 不写盘
- 导入前备份 / 版本历史 / 恢复内置技能按钮（**ECO-02** 同类；D-09 的备份是临时的，**不得**扩张）
- `allowed-tools` 的执行层门禁（REQUIREMENTS Out of Scope）
- 技能包签名 / 校验和 / 发布者验证 / 应用内技能市场
- `SKILL_THREAT_PATTERNS` 接入加载期（**明确不做** —— 会推翻 46 D-08）
- `/api/skills/set-disabled` 的存在性校验（50 收尾带出的不对称，不属本阶段需求）
- 四态可见性（ECO-05）/ 容器级作用域（ECO-06）/ `/compact` 保留正文（ECO-03）/ `$ARGUMENTS` 与堆叠调用（ECO-04）/ 多源发现
- 主窗口内的技能管理 / 导入 UI
- 为设置页 guest 单开 push 通道（多开设置页即时同步）
- `importId` 跨窗口 / 跨设置页实例共享
- TD-48-01 / TD-48-02、`WR-12` / `IN-14` / `IN-16` / `IN-17` / `IN-10`~`IN-13` / `WR-02` / `WR-06`、bash 安装档只读豁免的结构性根因

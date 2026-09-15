---
phase: "49"
slug: "manage-skill-ai"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-09-13"
audited: "2026-09-13"
---

# Phase 49 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> 生成方式：`/gsd-verify-work 49` 的 verify:post → `secure-phase`（**State B**：无 SECURITY.md、PLAN 与 SUMMARY 齐备）。
> 登记册来源 = 7 份 `49-0X-PLAN.md` 的 `<threat_model>` 块（`register_authored_at_plan_time: true`）。
> **Phase 归属安全门禁**：MGMT-03【LLM 参数不可信】+ MGMT-04【seeded 不可改删】+ MGMT-05【写入后刷新】——
> 由 T-49-01-01..04、T-49-01-09、T-49-04-01..04、T-49-05-01..02 共同闭合。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| LLM → `manage_skill` 参数 | `action` / `name` / `content` / `description` 由模型生成；JSON Schema 的 `pattern` / 描述只是给模型看的提示 | **不可信自由文本**；`description` 属零交互注入通道（无条件进每个请求的 system prompt） |
| 工具层 → `ai-skills-manager.js`（进程内） | 工具只做参数转发，判定与写入全在 manager | 保证校验器只有一份实现（50/51 直接 require 同一份） |
| manager → 磁盘（经沙箱 `env`） | 路径恒由 `path.join(managedDir, name)` 计算；写目标另经沙箱 `resolveInside` 双基准 + realpath 复核 | 落盘产物 = 组装后的 `SKILL.md` 全文（≤ 64 KiB 字节） |
| 磁盘状态 → 判定（撞名 / seeded / 数量闸） | 一律当场读盘（`env.exists` / `env.listDir`），**不用缓存快照** | 磁盘实况（bash 可随时改写） |
| 主进程 → 渲染端（工具事件 / `skills:changed`） | 事件字段是渲染端的唯一信息来源；渲染端不做判定，只查白名单表 | 技能名 / 徽标文案 / 短原因（**已剔除**正文、`filePath`、诊断） |
| 渲染端 → DOM | 技能名、description、正文、错误全文均为不可信字符串 | 一律经 `textContent` 或白名单表取值 |
| 对话库 → 历史卡片（重载链路） | 失败态原因码只能经**消息文本**跨这条边界（SDK 的 `details` 恒为 `{}`） | 带 `[code]` 词缀的持久化文本 |
| 内容单源 → 渲染端 | 卡片头部标注取值必须来自 `src/skill-picker-model.js` 的单源投影 | `PROMPT_OMITTED_CARD_NOTE`（`STATUS_TEXT.promptOmitted` 第二段） |
| CSS 声明 → 真实布局 | 「声明存在」与「最小宽度下成立」是两件事 | 面板宽度变量 + 真实渲染几何 |
| 代码事实 → 产品文档 | `docs/product/ai-skills.md` §十一 是 50/51 唯一可读的口径来源 | 挂账清单 / 例数账本 |
| 驱动脚本 → 用户运行中的生产实例 | 驱动只操作自己 `_electron.launch` 拉起的 dev 子进程 | 进程句柄；**严禁**按模式杀进程 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-49-01-01 | Tampering | 路径穿越 / 写逃逸 | high | mitigate | 工具**不吃 `path`**：`_buildManageSkillTool` 参数键实测**恰为** `{action,name,content,description}`（`ai-manager.js:6166-6189`，`path` 命中 **0** 处）；`execute` 只读 `params.action` / `params.name`（`:6192-6194`）。`validateManagedSkillName`（`ai-skills-manager.js:1034`）按 `^[a-z0-9]+(-[a-z0-9]+)*$` + 长度 ≤ 64；沙箱 `resolveInside`（`agent-workspace.js:162-189`）双基准（root + `fs.realpathSync(root)`）+ 已存在路径 realpath 复核，越界 fail-closed | closed |
| T-49-01-02 | Tampering | Prompt injection 持久化（`description` 每次请求进 system prompt） | high | mitigate | 扫描在净化**之前**：`createManagedSkill:1432-1437`（先 `scanSkillText` 后 `sanitizeSkillDescription`）；`scanSkillText` 委托单点 `ai-memory-manager.scanInjectionPatterns`（`:1177-1178`），`description` 传 `{includeCredentials:true}`（`:1433`）；命中即 `throw`（不落盘）；净化剥控制字符与零宽字符 | closed |
| T-49-01-03 | Information Disclosure | 凭据入库即外发 | high | mitigate | 字段分离：`description` → `includeCredentials:true`（`ai-skills-manager.js:1433` / `:1550`），`content` → `includeCredentials:false`（`:1434` / `:1551`）—— 合法技能文档里的 `api_key: YOUR_KEY_HERE` 不被误伤；拒绝消息只回原因码 + 可操作提示 + 限额值，**不回显被拒内容原文**（`makeManageSkillError` 全域） | closed |
| T-49-01-04 | Tampering / Spoofing | 内置技能被冒名覆盖 | high | mitigate | seeded 判定按**播种登记表**：`seededNames` 由 `ai-manager.js:6195` 的 `getSeededSkillNamesSafe()` 注入（7 处引用），三动作共用 `resolveManagedTarget(env, name, seededNames)`（`ai-skills-manager.js:1367`）；`seeded_protected` 4 处；`create` 对已存在目标一律拒绝（独占创建，`:1459-1464`）；`update`/`delete` 同形拒绝（`:1539` / `:1603`） | closed |
| T-49-01-05 | Repudiation | 静默遮蔽（AI 建同名 managed 被 user 技能永久遮蔽） | medium | mitigate | 第 2 类拒绝 `user_owned_conflict`（4 处）+ 可读原因；加载管线 `applyShadowing`（`ai-skills-manager.js:451`）仍产 `realm_shadowed` 诊断（`:462`）作为二线可见性 | closed |
| T-49-01-06 | Denial of Service | 资源耗尽（无限建技能） | high | mitigate | `LIMITS.MAX_MANAGED_SKILLS = 50`（`ai-skills-manager.js:52`），统计对象 = **非 seeded 的 managed 目录数**（`countManagedSkills:1335`，读盘 `env.listDir`）；到顶即拒 + 可操作提示（`:1470-1478`）；闸只约束 `create`（`update`/`delete` 不受限，否则到顶后无法自救） | closed |
| T-49-01-07 | Tampering | 失败留下半成品 | medium | mitigate | 原子写 = `env.createTempFile` → `writeFile` → `renameFile`（`atomicWriteSkillFile:1274-1298`，POSIX 原子替换）；`create` 失败清理**只在本次确实新建目录时**执行（`createManagedSkill:1500` 的 `madeDir = true` + `:1507-1509`）；`update` 失败不删目标目录（题中之义，且破坏前状态由 rename 原子性保持） | closed |
| T-49-01-08 | Tampering | 幽灵技能（落盘成功但加载管线整条跳过） | medium | mitigate | 写侧判据与加载期同量：`validateSkillFileSize`（`:1231`）按 `buildSkillFileText` 产物的 UTF-8 字节比对 `LIMITS.MAX_SKILL_MD_BYTES`（`64*1024`），与加载期 `FileInfo.size` 同为整文件口径；`MAX_SKILL_DESCRIPTION_CHARS = 1024`（`:54`）与 SDK `MAX_DESCRIPTION_LENGTH` 对齐；位点在数量闸之后、`createDir` 之前 ⇒ 拒绝即零残留（`:1480-1495`） | closed |
| T-49-01-09 | Elevation of Privilege | 越界写其它工作区路径 | high | mitigate | 写入面恒为 `managed-skills/<name>/`：`managedSkillPaths:1317` 只用 `path.join`；接口层无法表达其它目标（见 T-49-01-01）；沙箱 `resolveInside` 对**所有** FileSystem 方法 + `renameFile` 的 src/dst 分别 guard（`agent-workspace.js:225-284`），越界返回 `permission_denied` | closed |
| T-49-01-10 | Denial of Service | 父目录缺失致 rename 必失败 / `createDir` 幂等被误当撞名判据 | medium | mitigate | `create` 先 `createDir`（`:1501`）作硬前置；撞名判定**一律**走 `env.exists`（`resolveManagedTarget:1367`），`createDir` 的返回值**不参与任何判定**（`:1499` / `:1450` 显式注释 + 回归护栏用例） | closed |
| T-49-02-01 | Tampering | XSS / 属性逃逸（技能名与错误全文进 DOM） | high | mitigate | `manage_skill` 卡片变体区（`renderer.js:8924-9792`）实测 `textContent` **33** 处、`escapeHtml` **0** 处；6 处 `innerHTML` 全为**静态 SVG 字面量**（`:9599/9602/9605`）、附件徽标 `aiAttachmentTypeIcon`（`:9052`，非本阶段面）与 2 处注释（`:9340` / `:9673`）⇒ **零**模板拼接；tier → class 走 `TIER_BADGE` 白名单查表（`skill-picker-model.js:349`），表外跳过徽标 | closed |
| T-49-02-02 | Spoofing | 渲染端自行判定来源档位 / 撞名 / 限额 | medium | mitigate | 同一 `manage_skill` 区域实测 `seededNames` **0**、`managed-skills` **0**、`skills-builtin` **0** ⇒ 判定素材零出现；渲染端只查 `TIER_BADGE` / `MANAGE_SKILL_ACTION_LABEL` / `MANAGE_SKILL_SHORT_REASON` / `STATUS_TEXT` 四张闭合表 | closed |
| T-49-02-03 | Repudiation | 失败态原因码经 `result.details` 传递（SDK 产出恒为 `{}`） | high | mitigate | 按 `toolCallId` 的短期元数据：`this._manageSkillMeta = new Map()`（`ai-manager.js:756`），成功出口 `:6276` / 失败出口 `:6323` 各写一次；读取 `:1801` + **读后即删** `:1803`；业务失败仍 `throw`（LLM 语义不变） | closed |
| T-49-02-04 | Tampering | 终态字段被合并分支丢弃 | high | mitigate | 并入而非覆盖，单源在 `mergeManageSkillMarker`（`skill-picker-model.js:450`），渲染端在**独立语句**上调用（`renderer.js:9380`，非注释）；仅当事件带该字段时并入（避免后续事件抹成 `undefined`） | closed |
| T-49-02-05 | Repudiation | 重载链路形状与实时链路不一致 | medium | mitigate | 单一构造函数 `_buildManageSkillDecoration`（`ai-manager.js:1768`）**1 处定义 + 2 处调用**（实时 `:1804`、重载 `:2968`）；重载对无法还原的 `code` **省略键**（宁缺勿猜）；装饰失败原样透传 | closed |
| T-49-02-06 | Information Disclosure | 结果区把 `details` / 原始 JSON 全量展示（可能含工作区绝对路径） | low | mitigate | 结果区只渲染文本块（对象取 `type === 'text'`），`details` 不进结果区（`code`/`tier`/`promptIncluded` 已由头部与标注承载） | closed |
| T-49-02-07 | Denial of Service | 渲染 64 KiB 正文导致巨量 DOM | medium | mitigate | 正文**只**出现在默认折叠块（`.tool-card-content` 初始 `max-height: 0`）；唯一滚动容器是 `.tool-card.expanded .tool-card-content`（500px + `overflow-y: auto`）；参数区**剔除** `content` | closed |
| T-49-02-08 | Denial of Service | 头部在最小面板宽下换行 / 标注被裁切 | medium | mitigate | 实测声明集：`.tool-card-header {display:flex; align-items:center; gap:8px; height:36px; …}` —— **无 `flex-wrap`**；`.slash-picker-source-badge {… white-space:nowrap; flex-shrink:0}`；`.tool-card-manage-note {flex-shrink:0; white-space:nowrap; …}`；`.tool-card-name-text {… min-width:0}` 是唯一压缩承担者。280px 真实渲染复测 A1–A9 全绿（越界 0.00px、技能名 clientWidth 54>0、头部 36px） | closed |
| T-49-02-09 | Tampering | 第二份折叠实现 / 第二份徽标实现 / 第五种折叠外观 | medium | mitigate | 折叠块复用唯一构建函数；徽标复用 `.slash-picker-source-badge*` + `TIER_BADGE` 单源；本阶段未新建任何图标 / 折叠家族 | closed |
| T-49-02-10 | Repudiation | 复用面（徽标 / `--skill-limit-text`）在卡片 hover 态下对比度不达标 | medium | mitigate | 浅色 `--skill-limit-text: #92400E`（`main.css:61`，暗色基准 `:29`），`.tool-card-manage-note-limit {color: var(--skill-limit-text)}`（`:6221`）与面板行 `.slash-picker-source-badge-managed`（`:7256`）共用同一令牌 | closed |
| T-49-03-01 | Repudiation | 文档声称 TD-48-01 / TD-48-02 / WR-01 / WR-02 / WR-06 或 P8 失效链已闭合 | high | mitigate | `docs/product/ai-skills.md:558` 逐条列出五个标识符 + 各自主张，明写「**不声称已闭合**」「合计约 1/3」；`:559` 把「本轮已闭合」严格限定在 `49-REVIEW.md` 的 `CR-01/02/03` + `WR-01/02`，并明写其余条目（`WR-03`/`WR-04`/`IN-01`–`IN-06`）仍逐条挂账 | closed |
| T-49-03-02 | Tampering | 口径分裂（50/51 各写一份校验器） | high | mitigate | §11 明写「校验器与三动作住 `ai-skills-manager.js`、零 electron 依赖 ⇒ 50/51 直接 require 同一份」（Phase 49 排在 50/51 之前的**全部理由**）；`AGENTS.md` 的维护约定把「改口径必须同步该章节」挂成硬约定；§11 只写行为契约、不复制实现细节 | closed |
| T-49-03-03 | Repudiation | 账本漂移（`AGENTS.md` 与 `docs §七/§11.8` 例数不一致 / 填估算值） | medium | mitigate | 两处账本在同一任务刷新且取实跑 `# tests`；§11.8 携带**可重跑**一致性命令（右边界按同一行内下一个测试文件名切分，单行多套件不漏检）。本 run 实跑：`counts-parity ok · cells=8 · measured={"test-manage-skill.js":"55","test-ai-skills.js":"177","test-skill-picker-model.js":"111"}` | closed |
| T-49-03-04 | Repudiation | 把只能人工观察的面写成「已自动化验证」（夸大证据） | medium | mitigate | `49-VALIDATION.md` 的 Manual-Only 表显式写**证据分层声明**（层 1 自动化已落地 / 层 2 仅人工），并声明层 2「不可由层 1 证据替代」；`49-UAT.md` 测试 1 的 `why_human` 与 VERIFICATION.md 的 `human_verification` 同口径；本 run 的 UAT 测试 3 复测证据由真实渲染门禁产出（非推断） | closed |
| T-49-03-05 | Denial of Service | 文档 / 账本改动意外让 `tests/test-builtin-skills-seeder.js` 的既有红点扩散 | low | accept | 本阶段**不**试图修它、也不写会被它误解析的形态。本 run 实测该套件 **退出码 0**（22/22 套件全绿）—— 计划的「Node 22 下基线即红」前提已不成立，接受处置本身仍成立。见 `AR-49-01` | closed — below high threshold |
| T-49-04-01 | Tampering | `buildSkillFileText` 的 frontmatter 组装 | high | mitigate | `description` 经 `yamlScalar`（`ai-skills-manager.js:100-105`）编码：换行 / U+2028 / U+2029 归一化为空格、撇号双写、整体包单引号 ⇒ LLM 文本无法改写 frontmatter 结构；`buildSkillFileText` 8 处引用单一实现 | closed |
| T-49-04-02 | Denial of Service | 写侧 vs 加载期字节闸不同口径 | high | mitigate | 权威闸口 = `validateSkillFileSize`（`:1231-1245`）对**组装产物**测字节（与加载期 `FileInfo.size` 同量）；位点在**组装之后、任何落盘之前**（`:1480-1495`）；独立探针实测 65536 放行 / 65537 拒绝 `oversize` / 内容单独 64591 B 但组装超限仍被拒 | closed |
| T-49-04-03 | Spoofing | `getSkillPromptIncluded` 的 `false` 二义 | medium | mitigate | 三态化：`getSkillPromptIncluded`（`:1651`）未命中返回 `undefined`；消费侧 `typeof src.promptIncluded === 'boolean'` 才写键（`ai-manager.js:1779` / `:1809`），只有严格 `false` 才追加「预算已满」文案 | closed |
| T-49-04-04 | Tampering | `sanitizeSkillDescription` 的缩减性 | medium | mitigate | 净化流程固定为「原文结构校验 → 扫描原文 → 净化 → **净化值复验非空**」（`createManagedSkill:1436-1444`，复用同一校验器，拒绝码原样透传 `invalid_description`，不新立第十码）；独立探针实测纯零宽（U+200B×3）被拒且零残留 | closed |
| T-49-04-05 | Information Disclosure | 拒绝路径的错误消息 | low | accept | 现状只回显原因码 + 可操作提示 + 限额 / 当前值，**不回显被拒内容原文**；本阶段新增的 `oversize` 原因沿用该口径，不新增回显面。见 `AR-49-02` | closed — below high threshold |
| T-49-04-06 | Elevation of Privilege | 写入目标路径 | low | accept | 本计划不触路径计算（`managedSkillPaths` 仍只用 `path.join`，工具层仍不吃 `path`）；风险面由 T-49-01-01 / T-49-01-09 承担，既不扩大也不削弱。见 `AR-49-03` | closed — below high threshold |
| T-49-04-SC | Tampering | npm / pip / cargo 安装 | n/a | accept | 本计划不新增任何依赖（明确禁止引入 `yaml` 包），无包管理器安装面。见 `AR-49-04` | closed |
| T-49-05-01 | Tampering | `src/renderer.js` 的标记并入 | high | mitigate | 抽成跨进程单源纯函数 `mergeManageSkillMarker`（`skill-picker-model.js:450-454`）+ `renderer.js:9380` 调用；独立求值实测 `merge(base,{tier,promptIncluded})` 保留 `action`/`name`、`merge(t, null)` 返回**同一引用**（不抹标记）、入参未被修改 | closed |
| T-49-05-02 | Repudiation | 失败态原因码不落库 | high | mitigate | 失败出口给错误消息加**锚定起始**的 `[code]` 词缀（encode `ai-manager.js:6317-6320`），重载链路用**同一常量** `MANAGE_SKILL_CODE_TAG`（`:161`，正则锚 `^`）解析还原（decode `:1847-1848`）；行为用例 M2c/M2d 真跑工具失败出口与还原，旧消息（无词缀）不设键 | closed |
| T-49-05-03 | Spoofing | 三态 `promptIncluded` 在消费侧被合并回一句 | medium | mitigate | 只在严格 `false` 时追加「预算已满」、只在 boolean 时写 `details` 键（`ai-manager.js:6266-6275` / `:6297-6300`）；行为用例打桩覆盖 `undefined` / `false` 两条路径 | closed |
| T-49-05-04 | Information Disclosure | 失败消息词缀 | low | accept | 词缀只含白名单原因码（`[a-z_]+`），不含被拒内容原文；原中文完整文案一字不动地跟在词缀之后。见 `AR-49-05` | closed — below high threshold |
| T-49-05-05 | Tampering | 渲染端注入面 | medium | mitigate | 新增合并函数为纯数据形状运算（零 DOM、零字符串拼接）；卡片文案仍一律 `textContent` / 白名单查表（见 T-49-02-01 的实测计数），不扩大 TD-48-01 | closed |
| T-49-05-06 | Denial of Service | `_manageSkillMeta` 的残留 | low | accept | 读后即删的既有语义不变（`ai-manager.js:1801-1803`）；IN-05 指出的「运行被拆解时残留」属既记录的技术债、不在本 run 范围。见 `AR-49-06` | closed — below high threshold |
| T-49-05-SC | Tampering | npm / pip / cargo 安装 | n/a | accept | 本计划不新增任何依赖，无安装面。见 `AR-49-04` | closed |
| T-49-06-01 | Repudiation | §11.7 / §11.8 的陈旧声明 | high | mitigate | 三处「落地后变成假」的声明已逐条纠正（oversize 口径按组装全文 / 失败态短原因由词缀还原 / 未闭合清单如实挂账）；§11.8 的 `counts-parity` 命令把账本漂移变成非零退出（本 run 实跑 ok） | closed |
| T-49-06-02 | Tampering | §11.3 的词缀成文 | medium | mitigate | §11.3 与 §11.7 明确成文词缀的三个边界（起始位置 / 只含白名单原因码 / 不含被拒内容原文），并说明它**不改变安全边界**；`skill-picker-model.js:262` 与 `ai-manager.js:144` 的注释同口径 | closed |
| T-49-06-03 | Denial of Service | 测试例数账本漂移 | low | mitigate | 三处账本（§七 两条 + §11.8 三条 + `AGENTS.md` 测试行三条）由单条可重跑命令机械比对，本 run 实跑 `cells=8` 全等。见 T-49-03-03 | closed |
| T-49-06-04 | Information Disclosure | 文档中的示例 | low | accept | 词缀示例只用公开的枚举名（不涉凭据 / 路径 / 被拒内容），本阶段不新增敏感示例。见 `AR-49-07` | closed — below high threshold |
| T-49-06-SC | Tampering | npm / pip / cargo 安装 | n/a | accept | 纯文档改动，无依赖与安装面。见 `AR-49-04` | closed |
| T-49-07-01 | Tampering | 进程管理：驱动收尾 | high | mitigate | `tests/uat-49-g49-3-panel-layout.js` 实测：`pkill` / `pgrep` 仅出现在**禁止性注释**（`:18`），无任何按模式杀进程的调用；收尾走 `await electronApp.close()`（`:665`）+ `process.exit(exitCode)`（`:693`）。本 run 复跑期间用户的正式版 `/Applications/Realm.app`（PID 22083）**始终在运行**且未被触碰 | closed |
| T-49-07-02 | Tampering | 文档漂移：卡片标注 vs 面板标注 | high | mitigate | 短形态由 `STATUS_TEXT.promptOmitted.split(' · ').pop()` **机械派生**（`skill-picker-model.js:269`）；源码级两条实测成立 —— ① 取值以「引用 + 投影」形式书写（命中 `PROMPT_OMITTED_CARD_NOTE\s*=\s*STATUS_TEXT\.promptOmitted\.split\(`）；② 文件内**零**个被引号包裹的 `'超预算'` 独立字面量（`「超预算」` 全文件仅出现 **2** 次，均为 `promptOmitted` 长串本身与其 JSDoc 散文，JSDoc 刻意**未**逐字复写该正则所匹配的串）。面板串逐字未变（`STATUS_TEXT` 四值冻结） | closed |
| T-49-07-03 | Repudiation | 假绿判据 | high | mitigate | 判据对象改为**外接矩形**（A1 比标注右缘 vs 裁切祖先右缘；旧驱动的标注自身 `scrollWidth`/`clientWidth` 恒相等 ⇒ 无检出力）；A2 比祖先 `scrollWidth ≤ clientWidth`；A3 要求技能名 `clientWidth > 0`；执行顺序强制**先红后绿**（红轮日志 `/tmp/uat49/g49-3-red.log` 与绿轮 `/tmp/uat49/rerun-verifywork.log` 均落盘）；A9 断言全轮 CSS 声明投影 sha 相等（`69899a4f…` 五档同值）。**残余守卫弱点（已记录，非阻断）**：A9 的红轮基准续传自 `/tmp`，基准缺失时退化为自比较；`css-decl-freeze` 只存在于 `49-07-PLAN.md` 的 `<verify>` 块、未入仓；A1–A6 为「不越界」单向判据（`display:none` 时亦全绿）。三者已由**不依赖各自守卫**的独立路线复核（`git show fcf42d8` + 自算剥注释声明投影 sha / 源码声明直读 / 4× 放大截图 / 证据 JSON 的 `note clientWidth 34 > 0`） | closed |
| T-49-07-04 | Tampering | realm-dev 的可复现前提被清掉 | medium | mitigate | 本 run 复跑前实测 `managed-skills/` 下 `commit-style` + `aa-budget-01..14` **齐备未删**，驱动 preflight `E-DATA true`；驱动只读取 + 让模型更新 `commit-style` 的 description，不清理技能目录 | closed |
| T-49-07-05 | Information Disclosure | 真实 LLM 往返的载荷 | low | accept | 载荷是「用 `manage_skill` 更新 `commit-style` 的 description」这一句测试指令，不含用户隐私；API key 只经环境变量透传，不落盘、不打印。见 `AR-49-08` | closed — below high threshold |
| T-49-07-06 | Tampering | 渲染端注入面（TD-48-01 面） | low | mitigate | 本轮不新增任何字符串注入路径：标注仍是 `textContent` + 白名单类名，挂载点与元素个数不变（`createElement` 挂载点仍恰 1 处） | closed |
| T-49-07-07 | Denial of Service | 驱动被「再按一次 Cmd+Q」拦截挂死 | low | mitigate | 收尾 `process.exit(exitCode)` 强制退出；本 run 两次复跑均 12s 内正常退出（退出码 0） | closed |
| T-49-07-SC | Tampering | npm / pip / cargo 安装 | n/a | accept | 本计划不新增任何依赖（playwright 走全局已装版本、`magick` 走已装 CLI）。见 `AR-49-04` | closed |

*Status: closed · open · closed — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (= `high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**`threats_open: 0`** —— 全部 **52** 条登记项均已闭合（`mitigate` 项经 L1 grep 深度核验并以文件:行号内联存证；`accept` 项见 Accepted Risks Log）。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-49-01 | T-49-03-05 | `tests/test-builtin-skills-seeder.js` 的既有红点（计划期记载为 D-48-A）与本阶段无关；本阶段不修它、也不写会被它误解析的形态。**本 run 实测该套件已退出码 0**，风险前提实际已消失，处置保留以防回归 | 用户在 plan 期登记（49-03 的 `<threat_model>` accept 处置） | 2026-09-13 |
| AR-49-02 | T-49-04-05 | 拒绝路径只回显原因码 + 可操作提示 + 限额/当前值，不回显被拒内容原文；新增的 `oversize` 沿用该口径 | 用户在 plan 期登记（49-04） | 2026-09-13 |
| AR-49-03 | T-49-04-06 | 本计划不触路径计算；写入目标路径的风险面由 T-49-01-01 / T-49-01-09 承担 | 用户在 plan 期登记（49-04） | 2026-09-13 |
| AR-49-04 | T-49-04-SC / T-49-05-SC / T-49-06-SC / T-49-07-SC | 四个计划均**零新增运行时依赖**（49-04 明确禁止引入 `yaml`；49-07 的 playwright / `magick` 走已装版本）⇒ 无包管理器安装任务，包合法性门禁无触发条件 | 用户在 plan 期按各计划的 `<threat_model>` SC 条目锁定 | 2026-09-13 |
| AR-49-05 | T-49-05-04 | 词缀只含白名单原因码（`[a-z_]+`），不含被拒内容原文；原中文完整文案跟在词缀之后 | 用户在 plan 期登记（49-05） | 2026-09-13 |
| AR-49-06 | T-49-05-06 | `_manageSkillMeta` 读后即删语义不变；「运行被拆解时残留」属既记录技术债（IN-05），不在本 run 范围 | 用户在 plan 期登记（49-05） | 2026-09-13 |
| AR-49-07 | T-49-06-04 | 文档词缀示例只用公开枚举名，不涉凭据 / 路径 / 被拒内容 | 用户在 plan 期登记（49-06） | 2026-09-13 |
| AR-49-08 | T-49-07-05 | 真实 LLM 往返载荷为测试指令句（「用 `manage_skill` 更新 `commit-style` 的 description」），不含用户隐私；API key 只经环境变量透传 | 用户在 plan 期登记（49-07） | 2026-09-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Residual Coverage Gaps（非威胁、不阻断；已记录于 `49-VERIFICATION.md` 的 advisory）

以下**不是**威胁登记项、也**不是**缺失的缓解措施，而是**守卫强度 / 覆盖面的债**。它们已由不依赖各自守卫的独立路线逐一复核为真，故相关 truth 判 VERIFIED、`threats_open` 不受影响：

| 编号 | 内容 | 独立复核路线 |
|------|------|--------------|
| WR-09 | A9 的红轮基准续传自 `/tmp`，基准缺失时退化为自比较；`css-decl-freeze` 不在仓内 | `git show fcf42d8 -- src/styles/main.css`（27 insertions / 1 deletion 全在注释块内）+ 自算剥注释声明投影 sha（当前树 === `fcf42d8^`，均 `69899a4f…`）+ 四规则块逐字相等 |
| WR-10 | 真实渲染门禁 A1–A6 全为「不越界」单向判据（`display:none` 时亦全绿） | 读 `main.css:6213-6221` 声明集（无 `display` 覆盖）+ 4× 放大截图直读 + 证据 JSON `note clientWidth 34 === scrollWidth 34`（非零渲染宽） |
| WR-11 / IN-10 | 两处源码面护栏的 `stripComments` 只剥整行注释，行尾注释仍可满足 | 直读 `renderer.js:9659` 的真实赋值行（独立语句）+ `skill-picker-model.js:269` 的真实投影声明 + 运行时求值相等 |
| WR-05 | M3 仍是子串扫描，`prev=null` 型 CR-01 回归可通过全部用例 | 代码本身正确（直读 `renderer.js:9378-9385` 并入分支 + 独立求值真实合并函数） |
| WR-06 | 幽灵写入若发生则报无保留的成功（`promptIncluded === undefined` 分支不追加说明） | 两轮独立探针（8 条 + 30 条对抗 description）均零幽灵，无法构造出幽灵生产者 ⇒ 残余风险 |
| WR-07 / WR-08 | 实时 / 重载两链路在「工具从未执行」类上键集合分歧；`[code]` 编码谓词比解码谓词宽 | 均为前轮既有挂账；当前可达面全落在九码白名单内，不影响本阶段目标能力 |
| SC3 生产注入值 | `getSeededSkillNamesSafe()` 在纯 Node 下降级为 `[]`（seeded 保护消失）；仓内 55 例与探针均**显式注入** `seededNames` | 数据源目录已核实为 `['find-skills','skill-creator']`（探针 J1）；electron 环境下取值路径见 `ai-manager.js:6195`。建议后续补一条接线断言（见 `49-VERIFICATION.md` 的 `coincidental_reliance_items`） |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-13 | 52 | 52 | 0 | `/gsd-verify-work 49` → `secure-phase`（State B，**L1 grep 深度**；短路口径见下） |

**短路口径（§3 三条短路规则的第一条成立）**：`threats_open: 0` **且** `register_authored_at_plan_time: true`
（7 份 PLAN 全带可解析的 `<threat_model>` 块）**且** `asvs_level == 1`
⇒ 按 workflow 明文「skip to Step 6 directly」，**未派 `gsd-security-auditor`** —— L1 grep 深度对本级足够。
（若 `asvs_level >= 2` 则必须派审计子代理做 L2 边界放置 / L3 端到端追踪；本项目配置为 1。）

**L1 核验证据（本 run 逐条实跑）**：

| 证据 | 命令 / 产物 | 结果 |
|------|-------------|------|
| 三套件实测 | `node tests/test-manage-skill.js` · `node tests/test-ai-skills.js` · `node --test tests/test-skill-picker-model.js` | 55/55 · 177/177 · 111/111，0 fail |
| 全量回归 | `for f in tests/test-*.js; do node "$f"; done` | **22/22 套件退出码 0**，0 非 0 |
| 例数账本一致性 | `docs/product/ai-skills.md` §11.8 的可重跑命令 | `counts-parity ok · cells=8 · measured={"test-manage-skill.js":"55","test-ai-skills.js":"177","test-skill-picker-model.js":"111"}` |
| 真实渲染门禁（G-49-3 靶心） | `NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js` | 退出码 **0**；preflight `E-PW/E-KEY/E-DATA` 全 true；A1–A9 全绿（280 档 nameWrap 136/136、nameText 54、note 34/34、越界 0.00px、header 36） |
| 渲染截图直读（不依赖任何断言） | `/tmp/uat49/g49-3-zoom-280-header.png`（4×） | 「✓ 更新技…｜托管｜**超预算**｜完成」—— 标注完整、技能名退化正是省略号 |
| 源码面计数（本 run） | `ai-manager.js` 工具参数键 / `_manageSkillMeta` 读写 / `MANAGE_SKILL_CODE_TAG` 三处 / `_buildManageSkillDecoration` 1 定义 2 调用；`ai-skills-manager.js` 校验器行号 / `LIMITS` 五项 / 扫描与净化顺序；`renderer.js` 卡片区 `textContent` 33 vs `innerHTML` 6（全静态）；`skill-picker-model.js` 四张白名单表 + 投影 | 逐条命中，见 Threat Register 的 Mitigation 列内联行号 |
| 沙箱双基准 | `agent-workspace.js:162-189`（`resolveInside` + `fs.realpathSync`），`:225-284` 覆写全部 FileSystem 方法 + `renameFile` src/dst 分别 guard | 越界 `permission_denied`（VERIFICATION spot-check #7） |
| 用户生产实例未受影响 | 复跑前后 `pgrep -fl "Realm.app/Contents/MacOS/Realm"` | PID 22083 始终在运行，驱动未对其做任何操作，也未按模式杀任何进程（T-49-07-01） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log（8 条 AR，覆盖 11 条 accept 登记项）
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-13

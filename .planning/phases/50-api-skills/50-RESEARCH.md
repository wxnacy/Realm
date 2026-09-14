# Phase 50: 设置页技能管理区 + `/api/skills/*` - Research（RE-RESEARCH）

**Researched:** 2026-09-14（**重研**，覆盖同日前一版；前一版早于当前 `50-CONTEXT.md` 的 D-16/D-18/D-19 改写）
**Domain:** Electron 主进程（本地 HTTP `/api/*` + IPC 双入口）+ 技能管理面（Realm Browser v2.6）
**Confidence:** HIGH —— 本阶段的关键事实在本会话**逐条重读了当前树上的源码**（行号 = 本会话读出，见 Sources），三条运行时结论用本机 Node 探针**重新实测**。旧版 RESEARCH 的每一条被继承的断言都做了「当前代码是否仍成立」的复核；**三处不成立或不可复现的，见下方「CONTEXT 事实核查」的「与旧 RESEARCH 的矛盾清单」**。

---

<user_constraints>
## User Constraints (from CONTEXT.md)

> 以下三节的正文由脚本从 `50-CONTEXT.md` **逐字提取**（非重述），以保证 planner 拿到的是锁定决策原文。

### Locked Decisions

### 列表形态与信息密度

- **D-01:** **按来源分三组 + 组内行式列表，不做折叠**。组名 = **「我的技能」/「内置技能」/「AI 创建」**（对应 `sourceTierOf` 的 `user` / `builtin` / `managed`，与 48 D-14 的三档徽标词表同一套）。理由：三档档位判定已在 48 D-14 锁定（本阶段**只消费、零判定实现**）；46 D-06 / SKILL-05 要求「同名冲突对用户可见」⇒ 来源是组织这批数据最重要的维度；复用设置页既有 `.settings-group` / `.settings-group-title` 范式，零新视觉语言。**不折叠**的理由：`shadowed` 可见性与诊断可见性都是本阶段的**正面要求**，默认折叠会把它们藏起来；总数上限 100（user 50 + managed 50）分组后可控。**空组不渲染**（对齐 48 D-01「过滤为空时不渲染空分组标题」）。
- **D-02:** **两行式行内布局**：第一行 `名称 + 来源徽标 + 行尾状态标注 + 右侧操作`；第二行 `描述（CSS 单行截断，title 放全文）+ 副行元信息`。元信息格式 `12.3 KB · 4 个文件`。理由：description 是模型按描述自动匹配的**唯一**触发机制（49 D-07 引用的 skill-creator 作者指南核心结论）⇒ 用户必须能看到才能判断该不该禁用；藏进 tooltip 等于看不见。副行与 `/` 面板行的语义层级一致（48 D-02）。**截断用 CSS（`text-overflow: ellipsis`）而非 JS 截断**，避免「截断逻辑」成为第二份实现。
- **D-03:** **排序 = 沿用 `ai-skills-manager.bySkillPriority` 的确定性全序**（user > 可自动激活 > name 码点序），分组是**在该全序上的稳定分组**，组内顺序即全序的投影。**分组与排序都在主进程做**（管理投影直接返回排好序的分组结构），前端只渲染、不重排 —— 与「渲染端不得重实现优先级」（46 D-06）一致。码点序而非区域敏感比较（46 已防的 prompt 字节跨机漂移）。
- **D-04:** **v1 不做过滤 / 搜索框**。理由：设置页其他列表区（AI Bash 白名单、媒体播放器域名白名单、快捷键列表、分配规则）**均无搜索先例**；总数已被 46 的 `MAX_USER_SKILLS` 与 49 的 `MAX_MANAGED_SKILLS` 封顶（各 50）；日后实测痛苦再加，成本是纯前端一层。— **Reversibility:** reversible — 纯前端增量，回退即删一个输入框与其过滤分支，无数据面或契约变化。

### 危险动作的交互粒度与拒绝面

- **D-05:** **启停即改即存（switch，无保存按钮）；卸载 = 点击 → 二次确认 → 立即执行**。理由：白名单 tag 与 provider `enabled` 开关都是**即改即存**先例，而 AI 记忆区的显式保存按钮是因为**文本编辑存在草稿态**，启停是离散单值动作、无草稿语义。卸载**不可逆**（递归删 `skills/<name>/` 整目录，含用户自带的 `scripts/` / `references/`，且**无备份机制** —— 49 已把「覆写前备份」defer 到 v1.x），故必须确认。
  - **与 49 D-01「`manage_skill` 三动作一律不加确认」不冲突，两者论据正交，必须在 CONTEXT 显式记录防下游误读**：49 讲的是「给 **AI 工具**加确认挡不住 AI —— 它本可经 `write`/`bash` 直改同一路径，不完整的保护是负面价值」；本条讲的是「给**人**加确认以防误点」—— 人类点击**没有绕道路径**，确认卡片是真实有效的一道门。
  - **确认弹框走 `realm://` 既有范式**（AGENTS.md「内部页面 CSP」+「弹框居中约定」明文豁免）：div 遮罩 + JS CSSOM `display` 切换，初始隐藏走 CSS 类、**禁止 markup 内联 `style="display:none"`**（CSP `style-src 'self'` 会拦截）。
- **D-06:** **失败 / 拒绝反馈走设置页既有 inline hint 形态**（`ai-memory-hint` / `whitelist-hint` 同款：颜色类 + 文案 + 自动复位守卫），**不新建 toast 基建**。理由：设置页在 `realm://` guest 内、`realmAPI` 不可用，主窗口 toast（G-44-5「toast 落主窗口 renderer，播放器不重复建设 toast 基建」）覆盖不到它；设置页已有 inline hint 基建与「2 秒回调无条件复位」的成熟守卫（Phase 43 G-43-2 先例）。
- **D-07:** **卸载入口只对 `source === 'user'` 渲染；其余来源不渲染按钮**，改由区/组标题下一行说明：「内置技能与 AI 创建的技能不可在此卸载（AI 创建的技能请让 AI 用 `manage_skill` 删除，内置技能只可禁用）」。理由：不渲染 = 不给「点了才知道不行」的挫败；但完全静默会让用户困惑「为什么这个没有卸载按钮」，故配一行说明。
  - **服务端独立拒绝是硬约束**（ROADMAP 判据 3：「手改 URL 直接调端点也不例外」）—— 前端不渲染只是 UX，拒绝判据必须在 manager 层。两层各司其职。
  - **本侧的判据不能复用 49 的 `resolveManagedTarget`**（那是 managed 视角的「seeded 保护 + 用户撞名」，方向相反）；需要**一处显式的「仅 user 可删」判据**。
  - **判据口径（OQ-1 已裁决，2026-09-14）**：**「`skills/<name>` 存在且 `kind` 是目录」即允许卸载**（删除对象恒为 `skills/<name>/`）。**不得**把「`managed-skills/<name>` 是否存在」用作拒绝条件 —— 同名双存在（user + managed 同名）时 user 条目**确实存在**（user 胜出、managed 被 `applyShadowing` 标 `shadowed` 保留在数据层），列表里显示的 tier 就是 `user`；按「后者存在即拒」会让用户点自己列表里那条「我的技能」时被告知「这不是你的技能」，与 ROADMAP 判据 3「卸载仅允许 `source === 'user'` 的技能」直接冲突。`managed-skills/<name>` 的存在**只用来提示**：「同名托管 / 内置技能将在删除后重新可见」。
  - **读盘而非缓存快照**：判据一律读盘（`env.exists` / `env.listDir`），不用 `_cache` —— bash 可随时改写磁盘（P8 第 6 条），缓存只反映上次重扫的时刻。
  - **拒绝面的三态**：① `skills/<name>` 不存在 → `not_found`（含「存在但读不到」）；② `skills/<name>` 存在但 `managed-skills/<name>` 也存在 → **允许**（按本条裁决）；③ `skills/<name>` 不存在而 `managed-skills/<name>` 存在 → `not_user_owned`（D-08 的第十码）。
- **D-08:** **新增第十个错误码 `NOT_USER_OWNED: 'not_user_owned'`**（落点与账本刷新清单见下方 **OQ-3** —— 实测 `MANAGE_SKILL_ERROR` 现有 **10 键** = 九码 + `UNKNOWN`，被 `tests/test-manage-skill.js:1588-1621` 逐字冻结；加码后为 **11 键**，而 `MANAGE_SKILL_SHORT_REASON` **保持恰 9 键不动**）。理由：复用 `NOT_FOUND` 会把「技能不存在」与「技能存在但不是你的」混同 —— 用户看到「技能不存在」而该技能明明列在页面上，是**失实文案**；这正是 49-04 修过的三态混同族（`promptIncluded` 的 `false`/`undefined` 混同根因）。— **Reversibility:** costly — 「九码」是已写进产品文档、`AGENTS.md` 维护约定与测试清单的**成文账本**（三处必须一起刷，49-06 已建立刷新纪律）；回退需同步改三处账本 + 一个常量的取值域。
- **D-09:** **禁用的技能仍可卸载**（卸载不因 `disabled` 而置灰）。理由：禁用是「先别进 prompt 试试」的轻量试探，卸载是「确实不要了」的终局；要求用户先启用再卸载是反直觉的两步操作。且禁用不改变来源（`settings.aiSkills.disabled` 只存名字）。
  - **派生不变式（必须实现）**：卸载一个 user 技能成功后，**必须同步从 `settings.aiSkills.disabled` 移除该名字**。否则残留名单会随技能名复用而误伤 —— 同名新技能一装上就被静默禁用，属「静默失效」。启用 / 禁用单条时无需清理（技能仍在盘上）。
- **D-10:** **`/api/settings/update` 对 `aiSkills.disabled` 补服务端校验**（与既有 `aiBashWhitelist` / `cacheMaxGB` 两条**并列**）。理由：该键目前**零服务端校验**（`main.js:1375-1392` 只循环校验那两个键），手改 URL 可写入任意值污染禁用名单（含超大数组、非字符串项、路径样字符串）。校验面：必须是数组 / 每项为非空字符串 / 长度上限（单条长度与总条数）。⚠️ **谓词取「安全超集」而非 `validateManagedSkillName` 的严格形态**（`^[a-z0-9-]+$` + 无首尾/连续连字符）—— 理由与「故意的不对称」的成文要求见下方 **OQ-2**；用严格谓词会让「手动放进 `skills/My_Skill/` 的技能无法被禁用」。—— **Reversibility:** reversible — 一处校验分支，回退即删。

### 诊断与状态的展示口径

- **D-11:** **诊断分两层承载**：① **模块级 `errors[]`**（无 owner 技能的错误，如技能目录缺失）→ 「技能管理」区**顶部汇总条**；② **每条技能的 `diagnostics[]`** → 行尾「诊断 N」徽标 + **列表内联可展开详情区**（不用弹框）。理由：46 D-07 明确 `errors[]` 是**模块级容器**（`_cache.errors`），它没有归属技能、塞进行内不可能；ROADMAP 判据 1 要求「诊断」成为列表字段 ⇒ 行内徽标是字段承载形式；展开复用 48 / 49 已建的折叠块范式（`renderSkillContentBox`）。详情区每条显示 `level` + 可读 `message`，`code`（`realm_*`）作次要文本 / `title` 露出，不占主信息位。
- **D-12:** **状态标注复用 `src/skill-picker-model.js` 的 `STATUS_TEXT` 单源，不新写文案**：
  - `disabled` → **「已禁用」（新增第 5 条，加进同一张 `STATUS_TEXT` 表）**
  - `shadowed` → `STATUS_TEXT.shadowed`「已遮蔽 · 由用户同名技能胜出」
  - `promptOmitted` → `STATUS_TEXT.promptOmitted`「未进提示词 · 超预算」
  - `overLimit` → `STATUS_TEXT.overLimit`「超数量上限」
  - `disableModelInvocation` → 沿用面板既有「仅显式」（`src/renderer.js:10599`）
  理由：48-03 已锁定「文档讲行为不讲字段，用中文状态名」；同一状态在 `/` 面板与设置页各写一条文案**必然漂移**（48 / 49 已付过「同值不同物」的代价）。
  - **优先级链（一条技能可能同时命中多条）**：`disabled > shadowed > overLimit > promptOmitted`，行尾只取**首条**，其余进详情区。48 D-12 的既有顺序是 `shadowed → promptOmitted → overLimit`，本条在其**最前**插入 `disabled`（用户主动意图、信息量最大）。
  - **「仅显式」（`disable-model-invocation`）是独立维度，不在该链上**，可与其他状态并存、单独一枚标记（48-03 已要求「两个 flag 互不蕴含」成文）。
  - **注意「已禁用」是设置页独有的标注**：`/` 面板**根本不列出**被禁用的技能（48 D-10）⇒ 本条新增的 `STATUS_TEXT` 条目其消费方只有设置页。这不违反「单源」——是同一张表的**不同消费者**，不是第二份文案。
- **D-13:** **体积 / 文件数走新增的「管理面投影」，不扩展 48 的 `getSkillsForUI()`**：新增 `getSkillsForManagement(seededNames)`（或等价命名），返回分组后的条目，每项含 `名称 / 描述 / tier / 体积 bytes / 文件数 / diagnostics / shadowed / shadowedBy / disabled / overLimit / promptOmitted / disableModelInvocation`，**仍不携带 `content` 正文**。理由：`getSkillsForUI()` 是 `/` 面板的**有意收窄投影**（48 明文剔除 `content` / `filePath` / `diagnostics`，防一次 IPC 送最坏 ~3 MB 正文），扩展它会让 `/` 面板 IPC 白传 100 条技能的诊断与目录遍历结果 —— 两个消费者的字段需求本就不同，硬合并是负优化。
  - **体积 / 文件数口径**：**递归**遍历该技能目录的**全部子项**（含 `scripts/` / `references/` / 任意嵌套），累加字节数与文件数；**隐藏文件（`.` 前缀，如 `.DS_Store`）不计入**（它们不是技能内容，且 macOS 下会因 Finder 浏览而随机增减）。口径必须在 `docs/product/ai-skills.md` 写明。
  - **计算时机**：在**重扫管线内顺带计算并缓存**，随 `refreshedAt` / `digest` 一起失效；**不在**每次打开设置页时对全部技能目录做一次递归遍历（100 个技能 × 整目录 stat 会把「打开设置页」变成一次重 IO）。这与「冻结快照 + 同步只读」的既有纪律一致（G-42-4 先例）。
  - — **Reversibility:** costly — 一旦 `/api/skills/*` 与主窗口 IPC 两个入口开始消费该投影形状，改形状要同时改两处 handler、两个前端消费面与测试断言；且「不扩展 `getSkillsForUI()`」这条判断若不写下来，后续很容易被当成「重复实现」而合并回去。
- **D-14:** **不展示 `allowed-tools`（v1）**。理由：该字段**尚未被解析**（O3 的解析半边归 Phase 51，`STATE.md:287` 明文「51 半边（导入时解析该字段）待办」）⇒ Phase 50 **无数据可展示**；在 50 里加一个解析器等于把 51 的活提前，构成第二份实现。ROADMAP 的 Doc sync 条款（「`allowed-tools` 在列表展示时**必须**带免责标注」）按**「不展示」**满足（条件句前置条件不成立），并**必须在 `docs/product/ai-skills.md` 明写该字段在管理面缺席的原因**，防 51 解析该字段后忘了补免责标注、或被误读成本阶段漏做。

### 端点形态、体积上限与跨窗口同步

- **D-15:** **REST 子路由**：`GET /api/skills/list`、`POST /api/skills/set-disabled`、`POST /api/skills/uninstall`。沿用 `/api/settings/*` 与 `/api/ai-memory` 的既有范式（`token` 鉴权 → `route = pathname.replace('/api/skills/','')` → 分支 → `sendJson`），在 `main.js` 的 `realmServer`（`:2704`）新增一个 `reqPath.startsWith('/api/skills/')` 分支 + `handleSkillsApi(req, res, reqUrl)`。理由：ROADMAP 字面就是 `/api/skills/*`；把不同副作用 + 不同校验塞进单个 RPC handler 会让「哪条路径做了什么」不可枚举（与 49 把三动作拆开同一取向）。
- **D-16:** **SEC-09 → `readJsonBody(req, { maxBytes } = {})`，默认 fail-closed**：
  - 新增单源常量 `MAX_JSON_BODY_BYTES = 1 MiB`（`main.js`）作为**全局默认**。⚠️ **前提已由 research 推翻（修正 3）**：原文「现有端点 body 都是小 JSON」**不成立** —— `readJsonBody` 的 57 个调用点里有**两个端点的 body 是用户文件的全文**：`POST /api/favorites/import-chrome`（`main.js:1157`）与 `POST /api/favorites/import-html`（`main.js:1177`），由 `src/favorites-page.js:2239-2249` 提交书签导出文件全文（Chrome / Safari 常规 **1–10 MB**，且 import-html 的预览与执行各发一次）。⇒ **这两个端点必须显式声明更大的 `maxBytes`（建议 32 MiB）**，否则会让既有「导入书签」功能在这些用户处 413。**必须逐个端点评审**，不能按「都是小 JSON」的假设批量放行；机械复查入口：`grep -c "await readJsonBody(req)" main.js` = 57。
  - **超限实现形态（已实测，不得自由发挥）**：`sendJson(res, 413, …)` + **`req.resume()`**（停止累积、把剩余流排空）。**不要**用 `req.destroy()`，也**不要**设 `Connection: close` —— 两者都会让客户端拿 **EPIPE / 响应丢失**，413 永远看不到。实测对照（Electron 43.6.0 / Node 24.20.0）：现状 `body += chunk` 收 40 MB → **+85 MB 堆**且返回 200；`sendJson(413)+req.resume()` → 干净 413 且 **+1 MB 堆**。ROADMAP 判据 5 的判据对象是「**不无上限读入内存**」，仅靠事后长度检查不满足它。
  - **`sendJson` 必须加幂等护栏**（`headersSent || writableEnded` 时 no-op）：否则 `readJsonBody` 自己答了 413 又 reject，会让 12 个 handler 的外层 catch 二次 `sendJson` → `ERR_HTTP_HEADERS_SENT` → **unhandled rejection**。这是**一次修好全部发送点**的形状，属本阶段交付项。
  - **可显式覆盖**：需要大 body 的端点传 `{ maxBytes }`；调用点全部是**位置参数**形态 ⇒ 加可选参**零调用点改动**。Phase 51 的 zip base64 导入端点届时显式声明更大值（按 PITFALLS P7 的「累计解压 ≤ 32 MB」推导，base64-over-JSON 的 body 上界 ≈ 42.67 MiB ⇒ 建议 `48 * 1024 * 1024`）—— 「默认小 + 需大者显式放大」的形状让「漏了上限」不会静默发生。⚠️ 常量命名须区分量：`MAX_JSON_BODY_BYTES`(1 MiB) 与 P7 的「单 entry 1 MB」是**同数不同量**。
  - 数值单源在 `main.js` 常量，**设置页前端不得写死第二份**。— **Reversibility:** costly — `readJsonBody` 是**全部** `/api/*` POST 端点的公共入口（57 个调用点 / 11 个具名 handler + 1 个内联分支），改签名/默认值影响面横跨所有内部页面；且 Phase 51 会依赖「可显式覆盖」这条面。
- **D-17:** **两个前端入口读写对等，共用同一 manager 函数与同一管理投影**：新增 `/api/skills/*`（HTTP，设置页）+ 主窗口 IPC（`realmAPI`，与既有 `ai:get-skills` / `ai:refresh-skills` 并列）。IPC 侧复用既有 `assertTrustedSender`（`ipc-handlers.js:113`），HTTP 侧复用既有 token 鉴权。理由：ROADMAP 判据 4 与 USER-07 都明说「两个前端入口」「同一后端权威」；两个 handler **只是转发层**（判据 / 校验 / 写函数全在 `ai-skills-manager.js`），与 49 的「`ai-manager.js` 只做注册与参数转发」同款 ⇒ 零重复实现。
  - **硬约束**：设置页**必须**走 HTTP（guest 无 `realmAPI`），主窗口**必须**走 IPC（`file://` fetch 本地 HTTP 被 CORS 拦，Phase 38 事故）。两条不可互换。
  - 主窗口当前**无管理 UI** ⇒ IPC 写侧暂无 UI 消费者，其价值是「两入口同一权威」的对称性 + 未来主窗口管理面 + 开发/调试便利；**不得**为了让 IPC 有消费者而在主窗口新造一套管理 UI（那是新能力，不属本阶段）。
- **D-18:** **写路径收口 = 「成功后调 `syncAgentSystemPrompt()` 恰一次」+ 「调用侧无条件补一次 `skills:changed` 广播」**：
  - **`syncAgentSystemPrompt()` 调用恰一次**（该函数体内**已含** `refreshSkills()` 重扫；`ai-manager.js:3053` 的广播也在其内）。**不要**照 ROADMAP 字面写成 `refreshSkills()` + `syncAgentSystemPrompt()` —— 那是两次全量重扫（49-01 的 D-13 已付过这个代价，L 组断言 `rescanCalls === 2` 而非 3）。
  - ⚠️ **补播的理由已由 research 改写（修正 1）** —— 原文「禁用一个 `shadowed` / `promptOmitted` 的技能时 prompt 段逐字符不变 ⇒ 不广播」**推不出结论**：早退是**合取**（`snap.digest === this._skillsPromptDigest` **且** `systemPrompt === next`，`ai-manager.js:3043-3048`），而 `computeDigest`（`ai-skills-manager.js:189-202`）**逐条包含 `disabled` / `overLimit` / `shadowed`** ⇒ 禁用**任何在缓存里的技能**都会改 digest ⇒ **会广播**。实测矩阵（3 技能）：禁用普通技能 = digest+prompt 双变；禁用 `disable-model-invocation:true` 的内置技能 = prompt 不变但 digest 变（**仍广播**）；**只有禁用「技能集里根本没有的名字」才真零广播**（也确实无可同步的变化）。
  - **补播的真实理由 = 覆盖 `syncAgentSystemPrompt()` 的「忙时早退」**：`isProcessing || streaming` 时它只置 `_skillsPromptDirty = true` 并 **return**（**该分支不广播**），要等下一次成功出口的 `_flushDeferredSkillsPrompt()` 才落地。管理写路径（设置页点开关）**不经过 Agent 轮次** ⇒ 用户若不再发消息，`/` 面板会一直显示已被禁用的技能。**补播保留，理由按此表述。**
  - **新增硬禁令（必须写进 CONTEXT 与 `docs/product/ai-skills.md`）**：**禁止把 `disabled` / `shadowed` / `overLimit` 从 `computeDigest` 里摘掉**（任何「digest 只该反映 prompt 内容」的优化）。这会**静默破坏跨窗口失效链** —— renderer 侧 `pullAiSkillsSnapshot` 也按 `snapshot.digest === state.aiSkillsDigest` 早退（`src/renderer.js:9134`）。**digest 是面板可见字段的超集，这正是它今天能工作的原因。**
  - **修法约束：不得改 `syncAgentSystemPrompt()` 的函数体** —— 46-04 的方法体源码扫描断言与 `tests/test-ai-skills.js` 的广播次数断言（`:1239` / `:3289` / `:3455`）都钉着它。只能在**管理写路径的调用侧**，于其**之后**无条件补一次 `windowManager.broadcast('skills:changed')`。**广播幂等**（48-06 已把 renderer 的监听改成无条件重拉快照）⇒ 多播一次零副作用；不得为省这一次广播去改被钉住的函数体。验收面因此是「**忙时（`isProcessing === true`）补播仍然发出**」，不是「prompt 不变时补播」。
  - **诚实边界（必须写进 CONTEXT 与 `docs/product/ai-skills.md`）**：`windowManager.broadcast` 只发到**各 BrowserWindow 的 webContents**（`window-manager.js:310` 逐窗 `win.webContents.send`），**不到 webview guest**。故：设置页**每次操作后自行重拉列表**、**每次进入该页时重拉**；**多个设置页实例之间不做即时同步**（不新增 guest push 通道 —— 设置页是纯 HTTP 客户端，`src/settings-page.js` 零 IPC/`realmAPI`，为它开一条 push 通道是新基建，收益仅覆盖边缘场景）。
  - **进度账本**：本阶段完成后 `STATE.md:292` 的 `syncAgentSystemPrompt()` **写路径**收口达到 **2/3**（49 的 `manage_skill` 三动作 + 50 的设置页启停卸载），只剩 51 的导入。⚠️ 本阶段还会新增 `syncAgentSystemPrompt()` 的**读侧 / 兜底**调用方（D-19），**读写两个份额不是同一个量**：`STATE.md` 与 `docs/product/ai-skills.md` 必须**分别记两个数**，读侧触发点**不得并入**「6 个触发点」的分子，否则会被读成 P8 已 6/6。
  - — **Reversibility:** costly — `computeDigest` 的字段集与「调用侧补播」这两条判断都只在注释里活着，任一条被后续阶段当成冗余删掉，跨窗口失效链都会静默退回；补播点若从调用侧挪进 `syncAgentSystemPrompt()` 函数体，会同时打翻 46-04 的方法体断言与 48 的广播次数断言。
- **D-19:** **管理读路径必须有一个不依赖 Agent 的初始化（修正 2 —— 否则判据 1 整体空白）**。事实：`ai-manager.js:789-793` 在「未配置任何 provider API Key」时提前 `return`，而 `sandboxEnv`（`:901`）与 `refreshSkills()`（`:903`）都在该 `return` **之后** ⇒ `_cache` 恒停 `EMPTY_CACHE()`（`skills: []` / `digest: ''` / `refreshedAt: 0`），而 `builtinSkillsSeeder.seedBuiltinSkills()` 在 `main.js:4049` 是**无条件**执行、内置技能**早已在盘上**。`syncAgentSystemPrompt()` 首行 `if (!this.agent || !this.sandboxEnv) return;` ⇒ 连重扫都不执行；`refreshSkillsForPanel()`（`:3072`）同样早退（⇒ 现有 `/` 面板在无 provider 时也是空的，**既有状态、未被测试覆盖**）。
  - ⇒ **无 provider 时设置页会一条技能都列不出来**，且用户无法自查原因（属「静默失败」反模式）。**必须新增一个不依赖 Agent 的管理读路径初始化**（形状建议见 `50-RESEARCH.md` 修正 2；`createSandboxEnv()` 与 provider 配置无关，只依赖 `agent-workspace` + SDK，故这条路可行）。
  - **约束**：① 保持「恰一次重扫」的次数账（有 Agent 时走 `syncAgentSystemPrompt()`，其中已含一次 `refreshSkills`；无 Agent 时直接 `refreshSkills`，**不得两条都执行**）；② **不进 `syncAgentSystemPrompt()` 的函数体**（同 D-18 的钉死约束）；③ 它**不是**写路径（读侧/兜底），**不并入** D-18 的 2/3 份额。
  - **验收面**：`refreshedAt === 0`（从未加载）**不得**被渲染成「无技能」——空态文案必须区分「确实没有技能」与「尚未加载」；并补一条「未配置 provider 时仍能列出两个内置技能」的端到端/手动验收（见 `50-VALIDATION.md` 的 Manual-Only 表）。
  - — **Reversibility:** reversible — 新增一个读侧入口，回退即删；但**若不实现，判据 1 在无 provider 的用户处直接失败**，属必须交付项。

### 研究校正与开放问题处置（2026-09-14，源：`50-RESEARCH.md`）

**三条事实校正已回写进 D-16 / D-18 / D-19**（D-18 补播的理由整体改写 + 新增 digest 反向优化禁令；D-16 补两个书签端点的显式覆盖 + 413 实现形态 + `sendJson` 幂等；D-19 为新增决策）。

**OQ-1 已由用户裁决**（同 research 建议）并落进 **D-07** —— **本阶段已无需要用户裁决的用户可见行为分歧**。

以下 4 条开放问题采纳 research 的建议，plan 期必须显式实现（不得静默换一个）：

- **OQ-1（✅ 已裁决 2026-09-14 —— 用户选 research 建议）**：**同名双存在（user + managed 同名）时「仅 user 可删」的语义** —— D-07 的原字面判据（「`managed-skills/<name>` 存在即拒」）与 ROADMAP 判据 3 的字面（「`source === 'user'` 可卸载」）**冲突**：同名双存在时 user 条目**确实存在**（user 胜出、managed 被标 `shadowed` 保留在数据层），列表里显示的 tier 就是 `user`，而按原字面用户会被告知「这不是你的技能」。**裁决：判据改为「`skills/<name>` 存在且 `kind` 是目录」即允许**（删除对象恒为 `skills/<name>/`）；`managed-skills/<name>` 的存在只用来**提示**（「同名托管 / 内置技能将在删除后重新可见」）而**不**用来拒绝。**已落进 D-07**（含三态拒绝面），本阶段不再有需要用户裁决的用户可见行为分歧。
- **OQ-2（采纳 research 建议）**：**`settings.aiSkills.disabled` 的校验谓词用「安全超集」**（非空字符串 + ≤64 字符 + 无路径分隔符/控制字符 + 条数 ≤ 上限），**不**用 `validateManagedSkillName` 的 `^[a-z0-9-]+$` 严格形态。理由：加载管线对磁盘上的技能名**故意宽松**（46 D-08），严格谓词会让「手动放进 `skills/My_Skill/` 的技能无法被禁用」（设置页开关 400）。**必须在 `docs/product/ai-skills.md` 写明这条故意的不对称**（禁用名单是「按名字过滤」的消费侧信号，不需要名字合法到能写盘）。
- **OQ-3（采纳 research 建议，落点已定）**：**`not_user_owned` 加进 `MANAGE_SKILL_ERROR`**（顺从 D-08 字面），并**同批**三件事：① 把 `tests/test-manage-skill.js:1588-1621` 的两条 `deepStrictEqual` 冻结断言从「恰十键 / 九码」刷成「恰十一键 / 十码」；② **不动** `MANAGE_SKILL_SHORT_REASON`（保持**恰 9 键**，被 `tests/test-skill-picker-model.js:946` 硬断言）—— 新码在本阶段**只经 HTTP 400 的 `{code}` 返回**，不进 `manage_skill` 的工具卡片渲染路径，并在文档写明「该表只覆盖工具面，管理面错误码由设置页自己的文案表承载」；③ `docs/product/ai-skills.md` §11.3 的「九条拒绝原因 / 不新增第十码」改为「**工具侧**九条不变；管理面另有 `not_user_owned`（第十码，见新章节）」，消除文档自相矛盾。⚠️ 注意 D-08 原写「九码」而 `MANAGE_SKILL_ERROR` 实为 **10 键**（九码 + `UNKNOWN`）—— 措辞以实测键数为准。
- **OQ-4（采纳 research 建议）**：**尺寸遍历加防御上限**（建议 `MAX_SKILL_SIZE_WALK_ENTRIES = 5000` / `MAX_SKILL_SIZE_WALK_DEPTH = 16`），超限**截断 + 产 warning 诊断**，**不拒绝加载** —— 技能仍可用，只是体积显示为下限值并在详情区说明。理由：`MAX_USER_SKILLS` / `MAX_MANAGED_SKILLS` 只约束**技能个数**，不约束**单个技能目录的深度与条目数**（PITFALLS P7 把「深目录递归」列为资源耗尽面）；而「单技能失败跳过、不因局部问题拒绝整条」是加载管线的既有纪律。
- **OQ-5（采纳 research 建议，账本口径）**：D-19 新增的读侧/兜底调用方**不并入**「6 个触发点」分子；`STATE.md` 与 `docs/product/ai-skills.md` **分别记两个数**（写路径收口 2/3；读侧触发点另计）。

**另有三条 research 的假设需在 plan 期补实测**（见 `50-RESEARCH.md` §Assumptions Log）：**A2** —— `SKILL.md` 自身的 `size` 是否计入技能 `bytes`（D-13 只说「全部子项」，按推断计入，须在文档写明以免用户困惑于「64.1 KB vs 64 KiB 上限」）；**A3** —— 设置页新增 `<script src="skill-picker-model.js">` 后在 `realm://` CSP 下的实际加载表现（该文件零依赖、双模式导出、纯函数，风险低但须跑一次）；**A6** —— 100 条技能时管理投影的实际字节数与渲染耗时（research 估最坏 ~200 KB）。

### Claude's Discretion

- **管理投影的具体函数名与返回形状**（`getSkillsForManagement` / `getSkillsForSettings` 等，以及分组是「返回三组数组」还是「返回扁平 + tier 由前端分」）：**建议返回已分组结构**（D-03 要求排序与分组在主进程），具体形状交 plan 期。
- **IPC 通道命名**（`ai:get-skills-manage` / `ai:set-skill-disabled` / `ai:uninstall-skill` 等）与 `preload.js` 的 `realmAPI` 挂载点：交 plan 期；与既有 `ai:get-skills` / `ai:refresh-skills` 并列。
- **体积格式化的落点**：既有的 `formatFileSize` / `formatBytes` 已在 `src/renderer.js:11317`、`src/downloads-page.js:567`、`src/player.js:837` **各有一份页面局部实现**（既有惯例就是逐页局部）。设置页可沿该惯例加一份，**但不得在设置页写死任何限额数值**（限额恒取主进程投影回传的原始值 / `LIMITS` 投影）。
- **启停 switch 的视觉**：建议复用设置页既有 `.ai-switch`（provider `enabled` 开关同款）。
- **诊断详情区的展开交互**：建议复用 48 / 49 的折叠块范式；具体 DOM 与样式交 plan 期（若 ROADMAP 的 `UI hint: yes` 触发 `/gsd:ui-phase 50`，由 UI-SPEC 定稿）。
- **`set-disabled` 的载荷形状**（增量 `{name, disabled}` vs 全量 `{disabled: [...]}`）：建议**增量**（全量会在并发操作下互相覆盖）；具体交 plan 期。
- **测试文件组织**：research 建议**新增独立套件 `tests/test-skills-management.js`**（与 49 的 `test-manage-skill.js` 工具面职责不同，且独立文件才有独立 `# tests` 计数可入账本）；并在 `tests/test-ai-skills.js` 补写路径/忙时补播用例、改造 `tests/test-manage-skill.js` 的冻结断言、给 `tests/test-skill-picker-model.js` 补 `STATUS_TEXT.disabled` 断言。**必须覆盖**：管理投影形状与分组（含空组不渲染）/ 体积与文件数口径（递归含子目录、隐藏文件不计、**目录 size 不计**、**不穿 symlink**）/ 尺寸统计**不进 digest** / `refreshedAt === 0` 不渲染成「无技能」/ 来源三档 / 仅 user 可卸载（**三态拒绝面：不存在 → `not_found`；同名双存在 → 允许并提示「同名托管/内置技能将重新可见」；仅 managed 存在 → `not_user_owned`**；含**直接调 manager 函数**的服务端拒绝）/ 卸载后 `disabled` 名单清理 / 读盘判据而非缓存快照 / `readJsonBody` 上限（超限 **413 且不累积**、`sendJson` 幂等、**无 unhandledRejection**）/ 两个书签端点显式覆盖 `maxBytes` / 57 个既有调用点回归 / `settings.aiSkills.disabled` 服务端校验（两种键形态）/ 写路径「`syncAgentSystemPrompt()` 恰一次 + 补播恰一次」/ **忙时补播仍发出** / 禁用后 `/` 面板不可见。完整映射见 `50-VALIDATION.md` 的 Per-Task Verification Map。
- **待实测项**：`readJsonBody` 改签名后对**全部**既有 `/api/*` POST 端点的回归（57 个调用点，重点 `/api/settings/update`）；设置页 inline hint 的自动复位在连续操作下的表现；100 条技能时设置页的渲染耗时与投影字节数（research A6）；`SKILL.md` 自身 `size` 计入 `bytes` 的口径（research A2）；设置页加载 `skill-picker-model.js` 在 `realm://` CSP 下的表现（research A3）；`env.listDir` 返回的条目形状（含 `.DS_Store` 与 symlink）—— research 已实测（`{name,path,kind,size,mtimeMs}`；目录 `size`=96；symlink `size` 为链接长度、**内部链接可穿入 ⇒ naive 递归会无限循环**、外逃链接返回 `permission_denied`），plan 期的遍历实现必须显式处理 symlink。

### Deferred Ideas (OUT OF SCOPE)


- **`allowed-tools` 的解析与展示** —— **O3**；解析半边归 **Phase 51**（导入时解析该字段）；届时若在管理面展示，**必须**带「当前运行时不被强制，仅供参考」免责标注，执行层门禁明确 Out of Scope。D-14 已把「50 不展示」的理由与交接写成显式条目。
- **四态可见性**（Claude Code `skillOverrides` 的 `"on"` / `"name-only"` / `"user-invocable-only"` / `"off"`）—— **ECO-05**；本阶段维持 46 D-09 的二元 enable/disable。
- **容器级技能作用域**（技能按容器隔离展示）—— **ECO-06**。
- **技能版本历史 / 覆写前备份 / 恢复内置技能按钮** —— `update` 与导入均为不可逆且无快照；归 v1.x，与 **ECO-02**（seeded 升级推送机制）同类。本阶段的卸载同样无备份（D-05 的确认卡片是其唯一防线）。
- **多技能 zip 包勾选安装** —— **ECO-01**（归 Phase 51 的 v1.x 部分）。
- **设置页与其他设置页实例之间的即时同步** —— 本阶段显式不做（D-18 诚实边界：设置页是纯 HTTP 客户端，为它开 push 通道是新基建，收益仅覆盖边缘场景）。若日后要做，需要把 `windowManager.broadcast` 扩展为「含 guest webContents」，或在 `webview-preload.js` 上开一条 `sendToHost` 链路 —— 两者都是新机制，须单独立项。
- **主窗口内的技能管理 UI** —— D-17 的 IPC 写侧目前无 UI 消费者；在主窗口新造管理面是**新能力**，不属本阶段（IPC 通道的存在只为「两入口同一权威」的对称性）。
- **`readJsonBody` 上限做成可配置项（设置页可调）** —— 本阶段是编译期常量（D-16）；可配置化属优化项，且会引入「调大上限即放宽防护」的新面。
- **`syncAgentSystemPrompt()` 生产调用方的完整收口** —— 本阶段完成后到 **2/3**（49 的 `manage_skill` + 50 的启停卸载），**只剩 51 的导入**；`STATE.md:292` 的 ⚠️ 保持挂着，**不得**声称 P8 失效链 6/6 全覆盖。
- **TD-48-01 / TD-48-02**（`48-REVIEW.md`：`escapeHtml` 不转义引号致技能名可逃逸属性；取消分支判据缺锚点自校验）—— 用户已裁决「阶段 48 不发版 → 延后」，**49 未处置**，本阶段同样**不在需求范围内**；但若本阶段的设置页渲染**新写**属性上下文插值（如 `title`、`aria-label`），**必须**走安全的转义路径，负起「不扩大缺口」的责任。行号已随 48/49 漂移，执行前需重新定位。
- **`WR-12` / `IN-14` / `IN-16` / `IN-17`**（49 收尾带出的守卫强度债与可复现性债，见 `49-REVIEW.md`）—— 不阻断、不在本阶段需求范围；**若本阶段新增真实渲染门禁，不得重复 `WR-12` 的「否命题空集真」形态**（承重判据必须带正命题）。
- **`IN-10` ~ `IN-13`**（文档与注释的口径滞后）—— 不阻断。
- **`WR-02` / `WR-06`**（48 挂账：`_resolveSkillInvocation` 裸调未包 `try`；已缓存技能的实时读盘路径绕过 64 KiB 字节闸）—— 用户裁决继续挂账，**不得**读成已修。
- **bash 安装档只读豁免的结构性根因**（`47-REVIEW.md` 的 CR-01 / CR-02 / 残余 ③）—— 无归属阶段的技术债，根治走 argv 级分词。

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **USER-01** | 设置页 AI 分区新增「技能管理」区，列出技能的名称 / 描述 / 来源 / 体积 / 文件数 / 诊断 | 管理投影落点 = `refreshSkills()` 管线内（`:648` 之后）；体积/文件数走沙箱 `env.listDir` **递归**（SDK `FileInfo` 带 `kind` / `size`，`nodejs.js:52-63`）；`diagnostics[]` 已在**缓存条目**上（`:620` 起）；插入位置参照 `src/settings.html:507-520` 的 `.settings-group` 范式；**必须补读路径初始化**（D-19：未配 provider / 未配模型时缓存恒空，`ai-manager.js:789-793` / `:893-896`） |
| **USER-02** | 设置页可启用 / 禁用 / 卸载技能 | 启停 = 写 `settings.aiSkills.disabled`（三处读取点 `ai-manager.js:904` / `:3031` / `:3147`）+ `syncAgentSystemPrompt()` **恰一次**；禁用过滤点已存在（`ai-skills-manager.js:655-658` 标 `disabled`；面板侧 `src/skill-picker-model.js` 的 `filterPickerItems` 跳过 `s.disabled === true`）；卸载 = `env.remove(dir, { recursive: true })`（`recursive` 默认 false，`nodejs.js:605`） |
| **USER-06** | 卸载仅允许 `source === 'user'` 的技能（手改 URL 不得删内置技能） | 服务端判据落 `ai-skills-manager`（零 electron、可单测）；判据读盘用 `env.fileInfo`（**不是 `env.exists`** —— `exists` 对普通文件也返回 `ok(true)`，`nodejs.js:584-591`，判不出 `kind === 'directory'`）；D-07 的 OQ-1 裁决已定三态拒绝面 |
| **USER-07** | 设置页经 `/api/skills/*` + token；主窗口经 `realmAPI` IPC——同一后端权威、两个前端入口 | 设置页 = `<webview>` guest（纯 HTTP，token 来自 URL，`src/settings-page.js:49`）；主窗口 `file://` 必须 IPC（CORS，Phase 38 事故）；IPC 侧 `assertTrustedSender`（`ipc-handlers.js:113`）拒 guest；两 handler 只做转发，判定全在 manager |
| **SEC-09** | `readJsonBody` 增加体积上限（防 zip base64 放大无上限） | 57 个调用点分布见「修正 1/2」；**签名必须裁决**（矛盾 1）；正确拒收形态本会话实测（413 可达 + 堆不线性增长）；**默认 1 MiB 会打断两个书签导入端点**（`main.js:1157` / `:1177`） |
</phase_requirements>

---

## Summary

本阶段的技术难点**不在 UI**，而在四处「看不见的接缝」：

1. **管理投影的体积/文件数必须在重扫管线内算并缓存**，且**不得**进 `computeDigest`（`ai-skills-manager.js:189-202` 已核实逐条含 `disabled`/`overLimit`/`shadowed`）。
2. **`readJsonBody` 加体积上限是改 57 个调用点的公共入口**，而「立即拒收」在 Node `http` 上有两种会**静默丢掉 413 响应**或**让主进程崩溃**的陷阱 —— 本会话已重新实测（`req.destroy()` ⇒ 客户端 `EPIPE`；无幂等护栏 ⇒ `unhandledRejection` 1 次，而全仓**没有任何** `uncaughtException` / `unhandledRejection` 全局兜底，`main.js` / `ipc-handlers.js` 实测零命中）。
3. **设置页的读路径依赖 AI Agent 存在** —— 未配置 provider 时 `init()` 提前 `return`（`ai-manager.js:789-793`），`this.sandboxEnv`（`:899`）与 `refreshSkills()`（`:903`）都在其**之后**；`_cache` 恒停 `EMPTY_CACHE()`（`ai-skills-manager.js:131-138`），而内置技能由 `main.js:4048` **无条件**播种、早已在盘上 ⇒ 管理区会**一片空白**且用户无法自查。
4. **D-16 字面自相矛盾**（本会话新发现，阻塞级）：CONTEXT 把签名写成 `readJsonBody(req, { maxBytes } = {})`（两参），又要 `sendJson(res, 413, …)` —— **两参形态下函数体内没有 `res`**。三选一的取舍见「与旧 RESEARCH 的矛盾清单 · 矛盾 1」。

**Primary recommendation（三块地基）**：

1. 在 `ai-skills-manager.refreshSkills()` ④ 定序（`:648`）之后、⑤ 禁用标记（`:655`）之前插一次**逐技能递归遍历**（跳 symlink、跳目录 `size`、跳 `.` 前缀，逐技能 `try/catch`，失败只产诊断），结果挂到缓存条目上。
2. `readJsonBody` 用「**答 413 + 保持 request 流动（`req.resume()`）+ 不设 `Connection: close` + 不 `req.destroy()`**」形态，并给 `sendJson`（`main.js:877-880`）加 `headersSent || writableEnded` 幂等护栏 —— **两处都是本阶段交付项**。
3. 给管理读路径补一个**不依赖 Agent 存在**的初始化（懒建 `sandboxEnv` + 无 Agent 时直接 `refreshSkills`），否则判据 1 在「未配 provider / 未配模型」的用户处整体空白。

---

## CONTEXT 事实核查（本次重研）

> 本节只报事实与证据；**决策归属仍归 CONTEXT / planner**。以下三条是旧 RESEARCH 与当前 CONTEXT 之间的**未决冲突或不可复现结论**，planner 必须显式处置，不得静默采用任一侧。

### 与旧 RESEARCH 的矛盾清单（3 条）

#### 矛盾 1（**阻塞级 · 必须裁决**）—— D-16 的签名与 413 实现形态不可兼得

**CONTEXT 字面（`50-CONTEXT.md:84-88`）**：

- 标题：**SEC-09 → `readJsonBody(req, { maxBytes } = {})`，默认 fail-closed**
- 同条内：「**超限实现形态（已实测，不得自由发挥）**：`sendJson(res, 413, …)` + **`req.resume()`**」
- 同条内：「调用点全部是**位置参数**形态 ⇒ 加可选参**零调用点改动**」

**实际代码（本会话直读）**：

```js
// main.js:877-880
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// main.js:887-900
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}
```

⇒ `(req, { maxBytes })` 两参形态下，`readJsonBody` 的闭包内**没有 `res`**，`sendJson(res, 413, …)` 无法书写；而 `sendJson` 也无法从 `req` 反查 `res`（`req.socket` 上不可靠）。唯一能同时满足「413 只有一个实现处」与「拒收在累积中发生」的形态必须让 `res` 进作用域。

**三条可选解（互斥，plan 期择一必须成文）**：

| 选项 | 形状 | 「零调用点改动」 | 代价 |
|------|------|------------------|------|
| **A（本研推荐）** | `readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {})` + **改全部 57 个调用点** | ✗（57 处机械改动） | diff 大；但可用 `grep -c "await readJsonBody(req)" main.js` = 57 作机械门禁；**必须额外加「`res` 缺失时的降级分支」**（见下），否则漏改一处即**主进程崩溃**（无全局 `uncaughtException` 兜底） |
| **B** | 两参 `readJsonBody(req, { maxBytes } = {})`，超限时**只 reject**（`code: 'BODY_TOO_LARGE'`），由**既有 13 处 `catch → sendJson`** 统一答 `400 + {code}` | ✓ 真正零改动 | 与 D-16 的「413」字面冲突（实际是 400）；`sendJson` 幂等护栏**不再必需**（没有二次发送）；但与 ROADMAP 判据 5 的「返回明确错误」**仍然兼容**（有 `code` 与可读文案）。UI-SPEC 的失败映射表（`50-UI-SPEC.md:471`）本就把 `BODY_TOO_LARGE` 当 `code` 消费、不校验状态码，故**前端零改动** |
| **C** | 服务器入口处 `req.__res = res` 一次绑定，`readJsonBody(req, {maxBytes})` 内部用 `req.__res` | ✓ | 隐式耦合（magic property），但改动面最小且 413 仍是 413 |

**本研推荐 A + 降级分支**，理由：① 保住 D-16 已实测的 413 形态与 `sendJson` 幂等的「一次修好全部发送点」价值；② 降级分支（`if (!res || typeof res.writeHead !== 'function')` ⇒ 不答、只 reject）把「漏改一处」的后果从**崩溃**降为**一个 400**，而 D-16 明说要「让漏了上限当场可见」——漏改调用点的现象是「该端点超限返回 400 而非 413」，同样当场可见但**不致命**。

**降级分支为什么是必须的（本会话实测）**：`sendJson(undefined, 413, …)` 会 `TypeError`，而它发生在 `req.on('data')` 监听器内 ⇒ **uncaught exception**；全仓 `grep -n "uncaughtException\|unhandledRejection" main.js ipc-handlers.js agent-workspace.js ai-manager.js` **零命中**（无全局兜底）⇒ Electron 主进程直接退出。同理，二次 `sendJson` 抛 `ERR_HTTP_HEADERS_SENT` 发生在 `async` 服务器回调内 ⇒ **unhandled rejection**，本会话实测计数 **1**，同样致命。

#### 矛盾 2（**结论降级，非阻塞**）—— 「`Connection: close` ⇒ 客户端 EPIPE」**本会话不可复现**

旧 RESEARCH（`50-RESEARCH.md:605-613`）的对照表列有：

| 形态 | 旧结论 |
|------|--------|
| `sendJson(413)` + `Connection: close` + `req.resume()` | **EPIPE** |

**本会话实测（Node v22.22.0，`fetch` 客户端，40 MB body，1 MiB 上限）**：

| 形态 | 客户端可见 | 堆增量 |
|------|-----------|--------|
| 现状 `body += chunk`（无上限） | **200**（超限照样收下） | **+45.7 MB** |
| **`sendJson(413)` + `req.resume()`（不设 `Connection: close`）** | **413 + JSON body** | **≈ 0（−42.3 MB，被回收）** |
| `sendJson(413)` + `req.destroy()` | **fetch 抛 `EPIPE`** | — |
| `sendJson(413)` + `Connection: close` + `req.resume()` | **413 + JSON body（拿到响应）** | ≈ 0 |

⇒ **唯一被两次 session 一致确认的约束是「不要 `req.destroy()`」**。「设了 `Connection: close` 就丢响应」在本会话**不成立**（两种客户端都拿到了 413：`http.request` 与 `fetch` 各自复跑过）。

**处置建议**：实现照 D-16 的形态（`sendJson` + `req.resume()`，**不设** `Connection: close`）—— 因为它是被两次会话一致实测通过的形态、且 `Connection: close` 无任何收益；但**不得**把「设了就 EPIPE」写进产品文档或注释当成成文事实。差异可能来自客户端实现（undici vs 浏览器 fetch）或 socket 时序，本会话未定位根因。

> ⚠️ **诚实边界**：本会话的 413 探针跑在**系统 Node v22.22.0**上，旧 session 跑在 Electron 43.6.0 内的 Node 24.20.0。AGENTS.md 的纪律是「凡依赖 Node 行为的结论必须在 Electron 内复跑」（本机 `node --version` = v22.22.0，与运行时主版本不同）。三条关键结论（无上限=200+40MB、drain=413、destroy=EPIPE）两次一致，但**建议 plan 期把 413 探针在 Electron 内复跑一次**并落地为可重跑测试（见 Validation Architecture 的 `readJsonBody` 组）。

#### 矛盾 3（**显示口径**）—— D-12 的 `STATUS_TEXT` 枚举**漏了 `nameClash`**，优先级链与面板实际链不一致

**CONTEXT D-12（`50-CONTEXT.md:65-74`）**的枚举是 4 条：`disabled`（新增第 5 条）/ `shadowed` / `promptOmitted` / `overLimit`；优先级链 = `disabled > shadowed > overLimit > promptOmitted`。

**实际代码（本会话直读，逐字）**：

```js
// src/skill-picker-model.js:239-244
const STATUS_TEXT = Object.freeze({
  shadowed: '已遮蔽 · 由用户同名技能胜出',
  nameClash: '与本地命令同名 · 本地命令优先',
  promptOmitted: '未进提示词 · 超预算',
  overLimit: '超数量上限',
});
```

⇒ 表**今天有 4 键**（加 `disabled` 后为 5 键，「第 5 条」的计数**正确**），但其中的 **`nameClash`** 在 CONTEXT D-12 与 `50-UI-SPEC.md` 的 Copywriting 表（`:424`）里**均未出现**。

**面板侧的实际优先级链（`src/skill-picker-model.js:299-311`，逐字）**：

```js
      if (shadowed) {                 statusText = STATUS_TEXT.shadowed;      statusTone = 'muted'; }
      else if (nameClash) {           statusText = STATUS_TEXT.nameClash;     statusTone = 'muted'; }
      else if (s.promptOmitted === true) { statusText = STATUS_TEXT.promptOmitted; statusTone = 'limit'; }
      else if (s.overLimit === true) {     statusText = STATUS_TEXT.overLimit;     statusTone = 'limit'; }
```

⇒ 实际链是 **5 档**：`shadowed > nameClash > promptOmitted > overLimit`（再加 D-12 要在最前插的 `disabled`）。D-12 写的 `disabled > shadowed > overLimit > promptOmitted` 既**漏了 `nameClash`**，也把 `promptOmitted`/`overLimit` **次序写反**（面板是 `promptOmitted` 先）。

**为什么这不是可以「照字面实现」的小事**：`nameClash` 的判据是「技能名与本地命令同名」，而命令表**不在**管理面数据里 —— `SLASH_COMMANDS` 定义在 `src/renderer.js:344-347`（浏览器脚本、无 `module.exports`、纯 Node 不可 require），内容恰两条：

```js
const SLASH_COMMANDS = [
  { name: 'clear', description: '开启新对话', takesArg: false, handler: executeSlashClear },
  { name: 'compact', description: '压缩上下文（可附重点说明，如 /compact 重点保留登录调试）', takesArg: true, handler: executeSlashCompact },
];
```

⇒ 设置页**无法**自行计算 `nameClash`（要它就得把命令表也搬进一个双模式导出模块，那是**新基建 + 跨阶段改动**）。因此设置页只能呈现「技能集自带的状态」四档（`disabled` / `shadowed` / `overLimit` / `promptOmitted`）。

**处置建议（planner 必须显式成文，二选一）**：
- **(i) 推荐**：设置页的状态链定为 **`disabled > shadowed > overLimit > promptOmitted`**（顺 CONTEXT 字面）× **不含 `nameClash`**，并在 `docs/product/ai-skills.md` 的管理面章节明写「与本地命令同名」是 `/` 面板的**面板独有维度**（它依赖命令注册表，且只影响显式调用时的本地命令优先，不是技能集状态）。此时 `STATUS_TEXT.nameClash` 的消费者仍只有面板 —— 与 D-12 自己的推理（「同一张表的**不同消费者**」）一致。
- **(ii)** 把 `nameClash` 也搬进管理投影（需新增「本地命令名集合」这一数据通道）—— **不推荐**：属新基建，且超本阶段范围。
- **无论选哪个**：`STATUS_TEXT` 加 `disabled` 时**不得**改动既有 4 键的值 —— `tests/test-skill-picker-model.js:1029-1041` 有逐字冻结断言（见 Validation Architecture），且该表**没有** `Object.keys(...).length === 4` 形式的计数断言（本会话已核实），故新增第 5 键**不会**打翻任何既有断言。

### 复核通过（旧 RESEARCH 的下列断言之于当前代码仍成立）

| # | 断言 | 本会话复核证据 |
|---|------|----------------|
| 1 | `computeDigest` 逐条含 `disabled` / `overLimit` / `shadowed` ⇒ 禁用任何在缓存里的技能都会改 digest ⇒ `syncAgentSystemPrompt()` **会**广播 | `ai-skills-manager.js:189-202` 逐字含 `e.disabled === true, e.overLimit === true, e.shadowed === true`；早退是**合取**（`ai-manager.js:3046` 的 `snap.digest === this._skillsPromptDigest && this.agent.state.systemPrompt === next`） |
| 2 | 补播的**真实**理由是覆盖 `isProcessing \|\| streaming` 的「只置脏不广播」分支（不是「prompt 不变⇒不广播」） | `ai-manager.js:3038-3041`：`if (this.isProcessing \|\| (this.agent.state && this.agent.state.isStreaming)) { this._skillsPromptDirty = true; return; }` —— 该分支的 `return` 在 `:3053` 的广播**之前** |
| 3 | 存在「没有 Agent 就没有技能缓存」的真缺口 | `ai-manager.js:789-793` 与 `:893-896` **两条**提前 return 都在 `:899`（`this.sandboxEnv = await …createSandboxEnv()`）与 `:903`（`refreshSkills`）**之前**；`ai-skills-manager.js:131-138` 的 `EMPTY_CACHE` 有 `refreshedAt: 0`；`main.js:4045-4051` 顺序为 `ensureWorkspaceDir()` → `migrateAiMemory()` → `seedBuiltinSkills()` → `new AIManager()`，播种**先于** `aiManager.init()` 且无条件 |
| 4 | 两个书签导入端点的 body 是**用户文件全文** | `src/favorites-page.js:2245` `const content = await file.text();` → `:2247` `startChromeImport({ content })` / `:2249` `startHtmlImport(content)`；`main.js:1157`（import-chrome）、`main.js:1177`（import-html）；`src/favorites-page.js:2335`（预览）与 `:2445`（执行）**各发一次**同一份 content |
| 5 | `readJsonBody` 的调用点数是 **57** | `grep -c "await readJsonBody(req)" main.js` = **57**（本会话实跑） |
| 6 | `MANAGE_SKILL_ERROR` 是 **10 键** = 九码 + `UNKNOWN` | `ai-skills-manager.js:966-977` + `tests/test-manage-skill.js:1589-1621` 的 `deepStrictEqual` 逐字冻结 |
| 7 | `MANAGE_SKILL_SHORT_REASON` **恰 9 键**，被硬断言 | `src/skill-picker-model.js:408-418`（9 键）+ `tests/test-skill-picker-model.js:946` |
| 8 | 设置页是纯 HTTP guest（零 `realmAPI` / 零 `ipcRenderer` / 零 `require(`） | `grep -c "realmAPI\|ipcRenderer\|require(" src/settings-page.js` = **0** |
| 9 | `windowManager.broadcast` 只发各 BrowserWindow 的 webContents，不到 webview guest | `window-manager.js:309-316`：`for (const [id, win] of windows) { if (!win.isDestroyed()) { win.webContents.send(channel, ...args); } }` |
| 10 | `settings.aiSkills.disabled` 有**三处**主进程读取点 | `ai-manager.js:904` / `:3031` / `:3147`（三处均为 `this.configStore.get('settings.aiSkills.disabled', [])`） |
| 11 | `assertTrustedSender` 在 `ipc-handlers.js:113` | `ipc-handlers.js:113-122`（另有一份在 `main.js:3371-3377`，两者信任边界一致） |
| 12 | `refreshSkills()` 的返回值是**活引用**（模块级 `_cache`） | `ai-skills-manager.js:729` `return _cache;`；`getSkillsSnapshot()`（`:752-759`）返回的是**浅拷贝**（数组是新的，**条目仍是同一批引用**） |
| 13 | SDK `listDir` 的 entry 形状是 `{name, path, kind, size, mtimeMs}`，`kind` 用 `lstat` 判 | `node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:52-63`（`fileInfoFromStats`）+ `:43-51`（`fileKindFromStats` 返回 `'file' \| 'directory' \| 'symlink'`）+ `:547-574`（`readdir withFileTypes` 后**逐项 `lstat`**） |
| 14 | `remove` 的 `recursive` 默认 **false**，递归删必须显式传 | `nodejs.js:602-611`：`await rm(resolved, { recursive: options?.recursive ?? false, force: options?.force ?? false })`；`ai-skills-manager.js:1614` 的既有先例显式传了 `{ recursive: true }` |
| 15 | `exists()` 对不存在的路径返回 `{ok:true, value:false}` 而非报错 | `nodejs.js:584-591`：`if (result.error.code === "not_found") return ok(false);` |

### 旧 RESEARCH 的两处**计数/措辞**修正（不影响决策）

| # | 旧表述 | 当前实测 | 影响 |
|---|--------|----------|------|
| 1 | 「12 个 handler 的外层 catch 会二次 `sendJson`」 | **13 处**：12 个具名 handler（`handleHistoryApi` 3 / `handleFavoritesApi` 17 / `handleSettingsApi` 10 / `handleSearchConfigApi` 2 / `handleDevRequestsApi` 2 / `handleDownloadsApi` 6 / `handleTasksApi` 3 / `handleCredentialsApi` 3 / `handleAddressApi` 2 / `handleRulesApi` 5 / `handleShortcutsApi` 2 / `handleAiMemoryApi` 1 = 56）+ **内联分支** `/api/bookmarks-bar/toggle`（`main.js:2818-2835`，1 处，其 `catch` 在 `:2831` 答 `500`）= **57**。**全部 13 个宿主都有 `catch → sendJson`** | 幂等护栏的「一次修好全部发送点」从 12 改为 **13**；`sendJson` 是**唯一**发送点（无第二实现） |
| 2 | 「`sendJson` 幂等护栏保护 12 个 handler」 | 同上，**13** | 无 |

---


## 离散值台账（in-repo discrete values：逐字引用 + 来源标签）

> 以下是本阶段**实现会直接依赖**的离散值（限额常量表 / 错误码表 / 状态文案表 / 路径 / SDK 形状）。每条都**逐字引用**当前树上的定义并标出 `file:line`；**本表之外出现的任何取值或行号一律按 `[ASSUMED]` 对待**，不得当真值直接落码。

### 1. `LIMITS`（限额单源；本阶段**只渲染、不得重定义** —— STATE.md:290 的 O7 已落定数值）

`[VERIFIED: ai-skills-manager.js:48-54]` —— 逐字：

```js
const LIMITS = {
  MAX_SKILL_MD_BYTES: 64 * 1024,
  MAX_USER_SKILLS: 50,
  SKILLS_PROMPT_CHAR_BUDGET: 8000,
  MAX_MANAGED_SKILLS: 50,
  MAX_SKILL_DESCRIPTION_CHARS: 1024,
};
```

### 2. `MANAGE_SKILL_ERROR`（拒绝码闭合白名单；D-08 在此加第十一键）

`[VERIFIED: ai-skills-manager.js:966-977]` —— 逐字（**当前 10 键 = 九码 + `UNKNOWN`**）：

```js
const MANAGE_SKILL_ERROR = {
  SEEDED_PROTECTED: 'seeded_protected',
  USER_OWNED_CONFLICT: 'user_owned_conflict',
  ALREADY_EXISTS: 'already_exists',
  NOT_FOUND: 'not_found',
  LIMIT_EXCEEDED: 'limit_exceeded',
  INVALID_NAME: 'invalid_name',
  INVALID_DESCRIPTION: 'invalid_description',
  OVERSIZE: 'oversize',
  UNSCANNABLE: 'unscannable',
  UNKNOWN: 'unknown',
};
```

⇒ 本阶段要加的第十一键：`NOT_USER_OWNED: 'not_user_owned'` —— `[ASSUMED]`（键名与取值取自 `50-CONTEXT.md:57` 的锁定决策字面，**当前尚未落码**）。同一张表的键数冻结断言：`[VERIFIED: tests/test-manage-skill.js:1589-1605]`（`Object.keys(aiSkills.MANAGE_SKILL_ERROR).sort()` 恰十条键的 `deepStrictEqual`）。

### 3. `STATUS_TEXT`（状态文案单源；D-12 加第 5 条）

`[VERIFIED: src/skill-picker-model.js:239-244]` —— 逐字（**当前 4 键，含 CM 未枚举的 `nameClash`**）：

```js
  const STATUS_TEXT = Object.freeze({
    shadowed: '已遮蔽 · 由用户同名技能胜出',
    nameClash: '与本地命令同名 · 本地命令优先',
    promptOmitted: '未进提示词 · 超预算',
    overLimit: '超数量上限',
  });
```

⇒ 待加第 5 条 `disabled: '已禁用'` —— `[ASSUMED]`（文案取自 `50-CONTEXT.md:66`）。既有 4 键的逐字冻结断言：`[VERIFIED: tests/test-skill-picker-model.js:1029-1041]`（**注意：只有值冻结，没有键数断言** —— 本会话已核实，故加第 5 键不会打翻它）。

### 4. `MANAGE_SKILL_SHORT_REASON`（**工具面**短原因表；**恰 9 键，本阶段不得动**）

`[VERIFIED: src/skill-picker-model.js:408-418]`（9 键逐字）+ `[VERIFIED: tests/test-skill-picker-model.js:946]` —— 逐字断言：

```js
    assert.strictEqual(Object.keys(table).length, 9, '短原因表必须恰九条（D-07 的九码，不增不减）');
```

### 5. 技能名判据（**写入门**；管理面谓词**故意更宽**，不得复用它 —— OQ-2）

`[VERIFIED: ai-skills-manager.js:62]` —— 逐字：`const MAX_SKILL_NAME_CHARS = 64;`
`[VERIFIED: ai-skills-manager.js:65]` —— 逐字：`const MANAGED_SKILL_NAME_RE = /^[a-z0-9-]+$/;`
`[VERIFIED: ai-skills-manager.js:1027-1029]` —— 该 JSDoc 逐字写明这条**故意的不对称**：「**故意的不对称：写入门严、读入门宽**（D-06）。加载管线对磁盘上已存在的技能保持宽松（46 D-08「不丢弃命名不规范的合法技能」），因此本校验器**只被写入侧调用**，绝不在加载管线上加闸。」

### 6. 关键文件系统路径（全部由 `agent-workspace` 派生，**不得手拼**）

`[VERIFIED: agent-workspace.js:102-104]` —— 逐字：

```js
function getSkillsDir() {
  return path.join(getWorkspaceDir(), 'skills');
}
```

`[VERIFIED: agent-workspace.js:113-115]` —— 逐字：

```js
function getManagedSkillsDir() {
  return path.join(getWorkspaceDir(), 'managed-skills');
}
```

`[VERIFIED: ai-skills-manager.js:1317-1321]` —— 逐字（`path.join` 而非字符串拼接）：

```js
function managedSkillPaths(name) {
  const managedDir = getAgentWorkspaceLazy().getManagedSkillsDir();
  const destDir = path.join(managedDir, name);
  return { managedDir, destDir, destFile: path.join(destDir, 'SKILL.md') };
}
```

⚠️ **本阶段新增的 `deleteUserSkill` 必须照同款派生 user 侧路径**（`path.join(getAgentWorkspaceLazy().getSkillsDir(), name)`）—— 该函数**当前不存在**（`[VERIFIED: ai-skills-manager.js:1663-1687]` 的导出面里没有它）。

### 7. SDK `FileInfo` 形状与文件原语语义（尺寸遍历的判据对象）

`[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:56-62]` —— 逐字：

```js
    return ok({
        name: basename(path),
        path,
        kind,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
    });
```

`[VERIFIED: …/nodejs.js:43-51]` —— `fileKindFromStats` 只返回三种：`"file"`（`stats.isFile()`）/ `"directory"`（`stats.isDirectory()`）/ `"symlink"`（`stats.isSymbolicLink()`），其余返回 `undefined`。
`[VERIFIED: …/nodejs.js:605]` —— 逐字：`await rm(resolved, { recursive: options?.recursive ?? false, force: options?.force ?? false });`（⇒ 递归删**必须显式传** `{ recursive: true }`）。
`[VERIFIED: …/nodejs.js:586-590]` —— 逐字（`exists` 对普通文件也返回 `true` ⇒ **判不出 `kind === 'directory'`**）：

```js
        if (result.ok)
            return ok(true);
        if (result.error.code === "not_found")
            return ok(false);
        return err(result.error);
```

`[VERIFIED: …/nodejs.js:547-574]` —— `listDir` 为 `readdir(resolved, { withFileTypes: true })` 后**逐项 `lstat`**；内层 catch 是 `return err(toFileError(error, entryPath))`（**整目录失败**，不是跳过该项）。
`[VERIFIED: …/nodejs.js:538-546]` —— `fileInfo` 用 `lstat(resolved)`（⇒ symlink **不被跟随**，其 `size` 是链接长度）。

### 8. 插入落点（路径 + 行号，全部本会话直读）

| 落点 | 位置 | 标签 |
|------|------|------|
| `src/settings.html` AI 区最后一个 `.settings-group`（视觉模型区） | `:522-531` | `[VERIFIED: src/settings.html:522-531]` |
| `src/settings.html` AI 区 `</section>`（新区分组插在它之前） | `:532` | `[VERIFIED: src/settings.html:532]` |
| `src/settings.html` `<script>` 列表（**当前无 `skill-picker-model.js`**） | `:783-785` | `[VERIFIED: src/settings.html:783-785]` |
| `main.js` 既有 `/api/ai-memory` 分发分支（新分支插在其后、`/api/devrequests/` 之前） | `:2757-2760` | `[VERIFIED: main.js:2757-2760]` |
| `main.js` `sendJson` / `readJsonBody`（D-16 的改造对象） | `:877-880` / `:887-900` | `[VERIFIED: main.js:877-880]` `[VERIFIED: main.js:887-900]` |
| `main.js` `handleSettingsApi` 的 `update` 校验循环（D-10 在此加分支） | `:1372-1392` | `[VERIFIED: main.js:1372-1392]` |
| `ipc-handlers.js` 既有技能通道（新通道的并列对象） | `:1747-1753` / `:1763-1769` | `[VERIFIED: ipc-handlers.js:1747-1769]` |
| `src/preload.js` `realmAPI` 技能方法（新方法的并列点） | `:1033` / `:1040` | `[VERIFIED: src/preload.js:1025-1043]` |
| `ai-skills-manager.js` 尺寸统计挂载点（④ 定序之后、⑤ 禁用标记之前） | `:648` / `:655` | `[VERIFIED: ai-skills-manager.js:648]` `[VERIFIED: ai-skills-manager.js:655-658]` |
| `ai-manager.js` 管理读路径初始化需绕开的两条早退 | `:789-793` / `:893-896` | `[VERIFIED: ai-manager.js:789-793]` `[VERIFIED: ai-manager.js:893-896]` |
| `ai-manager.js` 无处不可改的失效链函数体 | `:3026-3054` | `[VERIFIED: ai-manager.js:3026-3054]` |

### 9. 前置阶段契约值（本阶段只消费）

| 值 | 标签 |
|----|------|
| 三档档位取值域 = `'user' \| 'builtin' \| 'managed'`（`sourceTierOf` 返回值域） | `[VERIFIED: ai-skills-manager.js:764-779]` |
| 排序键三段 = 「来源 user(0)/managed(1) → `disableModelInvocation !== true`(0)/true(1) → name 码点序」 | `[VERIFIED: ai-skills-manager.js:474-504]` |
| 禁用名单存储键 = `settings.aiSkills.disabled`（string[]） | `[VERIFIED: ai-manager.js:904]` `[VERIFIED: ai-manager.js:3031]` `[VERIFIED: ai-manager.js:3147]` |
| IPC 通道名 = `ai:get-skills` / `ai:refresh-skills` | `[VERIFIED: ipc-handlers.js:1747]` `[VERIFIED: ipc-handlers.js:1763]` |
| 品牌三档徽标查表键 = `user` / `builtin` / `managed` | `[VERIFIED: src/skill-picker-model.js:349-365]` |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 技能集加载 / 去重 / 遮蔽 / 限额 / 诊断 / **尺寸统计** | **主进程 · `ai-skills-manager.js`（唯一数据权威，零 electron 依赖）** | — | 49-01 明文「写权威与读权威同源」（`AGENTS.md:273` 硬约束 ①：「Phase 50/51 **直接 require 同一份**，不得另写第二份」）；handler 只做转发 |
| 管理投影（分组 + 排序 + 体积 + 文件数 + 诊断 + 状态） | **主进程 · `ai-skills-manager.js`** | — | D-03 要求分组与排序在主进程；D-13 明确**不扩展** `getSkillsForUI()` |
| 禁用名单持久化 | **主进程 · `configStore`（`main.js:112` 的 electron-store 实例，键 `settings.aiSkills.disabled`）** | — | 三处读取点全在主进程（`ai-manager.js:904` / `:3031` / `:3147`）；`set` 同步 ⇒ 写后立即 sync 必读到新值 |
| 请求体体积闸（SEC-09） | **主进程 · `main.js` 的 `realmServer` 闭包层（`readJsonBody` `:887` + `sendJson` `:877`）** | — | 判据对象是 HTTP 请求体；`/api/*` 是唯一入口；前端**不得**写死第二份数值 |
| 卸载的文件系统操作 | **主进程 · `ai-skills-manager` 经沙箱 `env.remove({recursive:true})`** | — | 沙箱已提供路径校验（`agent-workspace.js:321-325` + `resolveInside` `:162-192`）；`deleteManagedSkill`（`:1603-1623`）给出形状模板 |
| 写路径失效链（prompt 回写 + 广播） | **主进程 · `ai-manager`（`syncAgentSystemPrompt()` 恰一次 + 调用侧补播）** | 主窗口 renderer（消费 `skills:changed`，`src/renderer.js:4405`） | 46-04 的方法体断言 + 48 的广播次数断言钉住函数体 ⇒ 补播只能在调用侧 |
| 不依赖 Agent 的管理读路径初始化（D-19） | **主进程 · `ai-manager`（新方法，懒建 `sandboxEnv` + 无 Agent 时直接 `refreshSkills`）** | — | `createSandboxEnv()` 只依赖 `agent-workspace` + SDK，与 provider 配置无关（`agent-workspace.js:205`） |
| 设置页列表渲染 / 启停 / 卸载确认 / 诊断展开 | **设置页 renderer（`realm://settings` guest，`src/settings-page.js`）** | — | guest 无 `realmAPI`（实测零命中）⇒ 纯 HTTP 客户端；CSP `style-src 'self'` 禁 markup 内联 style |
| 状态文案单源（含新增 `disabled`） | **`src/skill-picker-model.js`（双模式导出，零依赖；`window.SkillPickerModel` + `module.exports`）** | 设置页（新消费者） | D-12 单源；设置页 `src/settings.html:783-785` **当前未加载该文件** ⇒ 需补 `<script>`（A3 待实测） |
| 主窗口 IPC 入口（对等写路径，暂无 UI 消费者） | **主进程 · `ipc-handlers.js` → 同一 manager 函数** | 主窗口 renderer（`realmAPI`，`src/preload.js:1033` / `:1040` 旁并列） | D-17 对称性要求；**不得**为主窗口新造管理 UI |

---

## Standard Stack

### Core（本阶段**不新增任何依赖**）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| （无新增） | — | — | 本阶段全部能力由既有内置模块承担：Node 内建 `http` / `electron-store` / 沙箱 `ExecutionEnv` / `src/skill-picker-model.js` |

**结论：零新依赖 ⇒ Package Legitimacy Audit 为空（无包可审）。**
Phase 51 才会引入 zip 库（`.planning/research/PITFALLS.md` 建议 `fflate`，当前**完全未安装**）与可能的 `yaml` / `ignore` 提升，届时按 `AGENTS.md` 的 registry 纪律走完整审计。

**Version verification（生产运行时，已在旧 session 实录、本会话未复跑）**：`node_modules/.bin/electron --version` → `v43.6.0`（内 Node **24.20.0** / Chromium **150.0.7871.250`）；本机 `node --version` = **v22.22.0`**（本会话实测）。⚠️ **两者 Node 主版本不同** ⇒ 凡依赖 Node 行为的结论必须在 Electron 内复跑（AGENTS.md 纪律；本会话的 413 探针**只在系统 Node v22 上跑过**，见矛盾 2 的诚实边界）。

SDK 版本：`@earendil-works/pi-agent-core@0.84.3`（本会话 `node -e "require('./node_modules/@earendil-works/pi-agent-core/package.json').version"` 实测）。

### Supporting（复用的既有资产）

| Asset | Location（本会话核实） | Purpose | When to Use |
|-------|----------------------|---------|-------------|
| 沙箱文件原语 | `agent-workspace.js:286-290`（`fileInfo`）/ `:292-296`（`listDir`）/ `:309-313`（`exists`）/ `:321-325`（`remove`） | 递归遍历 / 只读盘判据 / 递归删除 | 全部管理面文件操作 —— **不要**新增路径校验或直接 `fs` |
| 技能投影骨架 | `ai-skills-manager.js:776-780`（`sourceTierOf`）/ `:799-813`（`toUISkillEntry`） | 三档 tier 与投影字段 | 管理投影直接复用 `sourceTierOf`，**不得**重写档位判定 |
| 名称校验器（**写入门**） | `ai-skills-manager.js:1034-1063`（`validateManagedSkillName`，已导出） | `manage_skill` 的写入侧闸 | ⚠️ **D-10 / OQ-2 明文要求管理面谓词取「安全超集」、不得直接用此严格形态** —— 见 Open Q2 |
| 递归删形状模板 | `ai-skills-manager.js:1603-1623`（`deleteManagedSkill`） | user 技能卸载 | 照抄 `env.remove(destDir, { recursive: true })` + `throw makeManageSkillError(…)`（`:1614` / `:1616-1619`） |
| 错误构造点 | `ai-skills-manager.js:991-996`（`makeManageSkillError`，**未导出**） | 带 `code` 的业务错误 | D-08 新码经此构造；若要在模块外构造需一并导出（plan 期决定，推荐**不导出**、判定全在模块内） |
| REST 子路由范式 | `main.js:1336-1344`（`handleSettingsApi`：token → route → 分支 → `sendJson`） | `handleSkillsApi` 照抄 | 同样有 `try/catch` + `console.error` + `sendJson(400, {error})`（`:1326`） |
| 单端点范式 | `main.js:2649-2701`（`handleAiMemoryApi`） | 方法分发 + `{ error }` 形状 | 错误形状参照 |
| 即改即存链路 | `src/settings-page.js:2839-2900`（白名单增删：读 state → 整存 → POST → 更新 state → 重渲染）+ `:2907`（`renderAiBashWhitelistTags`） | 启停开关照抄形状 | D-05 |
| inline hint | `src/settings-page.js:3878-3888`（`setAiMemoryHint`）/ `:3890-3897`（`resetAiMemoryHint`） | 双色 + 自动复位守卫 | D-06 的复用对象；**须补 `clearTimeout` 纪律**（UI-SPEC 硬要求） |
| HTTP 客户端范式 | `src/settings-page.js:172-186`（`aiMemoryApi`：`token` 进 query、非 2xx 时**优先用后端 `error` 文案**） | `skillsApi()` 照抄 | 空态 C 的「后端 error 原文」惯例即来自此 |
| 状态文案单源 | `src/skill-picker-model.js:239-244`（`STATUS_TEXT`）/ `:349-365`（`TIER_BADGE`）/ `:456-477`（`api` + 双模式导出） | 行尾标注 / 来源徽标 | D-12；**设置页当前未加载该文件** |
| 广播消费端 | `src/renderer.js:4405-4407`（监听 → `pullAiSkillsSnapshot()`）/ `:9129-9142`（**`:9134` digest 早退**） | `skills:changed` 消费 | 补播零副作用（但 digest 未变时不重渲染 —— 见 Pitfall 12） |
| 体积格式化惯例 | `src/renderer.js:11317`（`formatFileSize`）等**逐页局部实现** | 元信息 `12.3 KB · 4 个文件` | 沿惯例在设置页加一份；**不得写死限额数值** |
| 折叠块（**CSS 家族**） | `src/styles/main.css:5827-5889`（`.ai-skill-content-box` 家族）；JS 侧 `src/renderer.js:8953`（`renderSkillContentBox`） | 诊断详情区 + 汇总条 | ⚠️ `renderSkillContentBox` 在 `src/renderer.js`（浏览器脚本、无 `module.exports`）⇒ 设置页**只能复用 CSS 类**，DOM 与开关逻辑须自行构建（见 Pitfall 13） |
| 既有色彩令牌 | `src/styles/main.css:29` / `:33`（暗）、`:61` / `:63`（亮）：`--skill-limit-text` / `--skill-error-text` **已存在**；`--skill-success-text` **不存在**（UI-SPEC 新增） | 状态/诊断上色 | UI-SPEC 的 `--skill-success-text` 是**本阶段唯一新增令牌**，两套主题都要定义 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|-----------|-----------|----------|
| `env.listDir` 递归遍历（沙箱内） | 直接 `fs.readdirSync(dir, {withFileTypes:true})` | 沙箱版自带 `resolveInside`（含 realpath 复核，`agent-workspace.js:162-192`）与 `permission_denied` 语义；直接 fs 会**绕过**沙箱并需自造第二份路径校验（与 AGENTS.md「硬沙箱漏一个入口就是逃逸口」纪律冲突）。**选沙箱版** |
| 在管理投影读取时实时遍历 | 在 `refreshSkills()` 内算并缓存 | D-13 已锁：读取时遍历会把「打开设置页」变成 100 次整目录 stat；违反冻结快照纪律（G-42-4）。**选重扫期内算** |
| `req.destroy()` 立即断连 | `req.resume()` 继续丢弃读入 | 本会话实测：`destroy()` ⇒ 客户端 **EPIPE**（判据 5 的「返回明确错误」不成立）。**选 drain-and-respond** |
| 用 `/api/skills/*` 给主窗口供数 | IPC（`realmAPI`） | 主窗口 `file://` fetch 本地 HTTP 被 CORS 拦（Phase 38 事故；`src/preload.js:1031` 的注释即记此事）。**两条不可互换**（D-17） |
| 把体积/文件数并进 `getSkillsForUI()` | 新增管理面投影 | D-13：`/` 面板 IPC 会白传 100 条诊断与遍历结果。**保持两个投影** |
| 用 `env.exists` 判「是目录」 | `env.fileInfo` | `exists` 内部对**任何** `fileInfo.ok` 都返回 `ok(true)`（`nodejs.js:584-591`）⇒ 普通文件也算「存在」；D-07 的判据要 `kind === 'directory'` ⇒ **必须用 `fileInfo`** |

---

## Package Legitimacy Audit

**本阶段不安装任何外部包** ⇒ 无待审包。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| （none） | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Phase 51 会引入 zip 解析库（`.planning/research/PITFALLS.md:193` 建议 `fflate`，当前完全未安装）—— 届时必须走完整审计（registry 存在性 + 下载量 + 源仓库 + `postinstall` 脚本 + 与 `package.json` 的 `asarUnpack` 联动）。*

---

## Phase 49 交付物清点（本阶段**必须复用**，不得另写第二份）

> ROADMAP 的 `Depends on` 原文：「Phase 49（复用同一份 name / description / 大小 / 注入校验器，避免第二份实现漂移）」；`AGENTS.md:273` 硬约束 ①：「校验器与三动作住 `ai-skills-manager.js`，该模块**零 electron 依赖** ⇒ Phase 50/51 **直接 require 同一份**，不得另写第二份（这是 Phase 49 排在 50/51 之前的全部理由）」。
> 下表是 `module.exports`（`ai-skills-manager.js:1663-1687`）的**逐项**与「本阶段是否消费」判定。

| 导出符号 | 定义位置 | Phase 50 消费？ | 说明 |
|----------|----------|----------------|------|
| `LIMITS` | `:48-54` | ✅ **必须** | 管理投影要回传 `limits`（设置页**不得写死任何限额数值**，Claude's Discretion 明文 + UI-SPEC `:530`）。**只读、只渲染，不得重定义**（STATE.md:290 的 O7 已落定数值） |
| `refreshSkills` | `:538-730` | ✅ **必须** | 唯一加载入口；尺寸统计要**接进**这条管线（④ 之后）；D-19 的无 Agent 读路径也调它 |
| `buildSkillsPrompt` | `:741-743` | ❌ | 只被 `buildSystemPrompt()` 同步调用（G-42-4 的零 IO 约束）；管理面不需要 |
| `getSkillsSnapshot` | `:752-759` | ⚠️ 可选 | 浅拷贝视图（**条目仍是活引用**）；管理投影需读 `_cache.errors` / `refreshedAt` / `digest`，从模块内直接读更直接 |
| `sourceTierOf` | `:776-780` | ✅ **必须** | 三档档位判定 —— 48 D-14 已锁，本阶段**只消费、零判定实现**（D-01） |
| `toUISkillEntry` | `:799-813` | ✅ **必须** | 管理投影的条目字段应在其**上加** `bytes` / `fileCount` / `diagnostics`，不得重写既有 8 个字段的取值逻辑 |
| `matchSkillByPath` | `:826-841` | ❌ | 48 的 `read` 卡片 / 重载路径用；管理面无此需求 |
| `getSkillsForUI` | `:853-859` | ❌ **不得扩展** | D-13 明文：`/` 面板的**有意收窄投影**（`toUISkillEntry` 的 JSDoc `:785-787` 逐字记「剔除 `content` / `filePath` / `diagnostics`」，防一次 IPC 送最坏 ~3 MB 正文）。管理投影**并列新增** |
| `readSkillForInvocation` | `:894-926` | ❌ | 48 D-11 的显式调用实时读盘；管理面不读正文 |
| `validateManagedSkillName` | `:1034-1063` | ⚠️ **不得直接用** | 它是**写入门**的严格校验器（JSDoc `:1027-1029` 逐字：「**故意的不对称：写入门严、读入门宽**（D-06）…因此本校验器**只被写入侧调用**，绝不在加载管线上加闸」）。OQ-2 要求管理面谓词取「安全超集」，**故不能复用这一份** —— 需要一个**新的**导出谓词（见 Open Q2）。**但**它仍是 `manage_skill` 的唯一一份，不得被本阶段改写 |
| `validateManagedSkillDescription` | `:1077-1092` | ❌ | 本阶段无 description 写入 |
| `validateManagedSkillContent` | `:1116-1148` | ❌ | 本阶段无正文写入 |
| `sanitizeSkillDescription` | `:1150-1175` | ❌ | 同上 |
| `scanSkillText` | `:1177-1202` | ❌ | 注入扫描归 49（工具面）与 51（导入面）；**本阶段无写入内容** ⇒ 无扫描面 |
| `buildSkillFileText` | `:1204-1229` | ❌ | 落盘组装，51 用 |
| `createManagedSkill` | `:1422-1537` | ❌ | AI 写入路径（49 已闭合），管理面只禁用/卸载 |
| `updateManagedSkill` | `:1539-1601` | ❌ | 同上 |
| `deleteManagedSkill` | `:1603-1623` | ⚠️ **只作形状模板** | 它是 **managed-only**（`resolveManagedTarget` 拒 seeded、拒 user 撞名）；D-07 明示**不能复用判据**（方向相反）。本阶段新增 `deleteUserSkill` 照抄其「校验 → 读盘判定 → `env.remove({recursive:true})` → 失败折叠 `UNKNOWN`」四段结构 |
| `getSkillPromptIncluded` | `:1651-1656` | ⚠️ 可选 | 三态（`true` / `false` / `undefined`）；管理投影直接带 `promptOmitted` 字段即可，不必经它 |
| `MANAGE_SKILL_ERROR` | `:966-977` | ✅ **必须** | D-08 的加码位置（`NOT_USER_OWNED`）；也是管理面拒绝码的取值域 |
| `_resetCacheForTest` | `:1659-1661` | ✅（测试） | 新套件跨用例隔离必用（否则「空技能集」断言假失败） |

**未导出但本阶段需要新建/复用的内部件（必须在模块内实现，不得外移）**：

| 内部件 | 位置 | 本阶段用途 |
|--------|------|-----------|
| `makeManageSkillError` | `:991-996` | 带 `code` 的错误构造（`NOT_USER_OWNED` 经此） |
| `pushEntryDiag` / `pushError` / `toRealmDiag` | `:334-351` / `:373-394` / `:353-371` | 尺寸遍历的诊断落点（条目级用 `pushEntryDiag`，模块级用 `pushError`） |
| `managedSkillPaths` / `isSeededName` / `sandboxErrorCode` | `:1317-1321` / `:1008-1011` / `:1248-1272` | 路径与判定复用 |
| `computeDigest` | `:189-202` | **不得改字段集**（D-18 禁令） |
| `EMPTY_CACHE` / `_cache` | `:131-138` / `:159` | 管理投影读 `errors` / `refreshedAt` / `digest` 的来源 |
| `createSkillsEnv` 的 `isScanRoot` 收窄 | `:235-236` / `:241-251` | **只作用于扫描根**（逐字：`if (!isScanRoot(p)) return res;`）⇒ 尺寸遍历用**原始 sandbox env** 或收窄 env 都可，但原始 env 语义更直白 |
| `applyShadowing` / `bySkillPriority` | `:451-472` / `:494-504` | D-03 的全序来源；**分组是它的稳定投影** |

**结论（给 planner 的一句话）**：本阶段的 manager 侧新增面**只有四项** —— ① 尺寸/文件数的遍历（接进 `refreshSkills` ④ 之后）；② 管理面投影函数（复用 `sourceTierOf` / `toUISkillEntry`，**不扩展 `getSkillsForUI`**）；③ `deleteUserSkill`（仅 user 可删，三态拒绝面）；④ `MANAGE_SKILL_ERROR.NOT_USER_OWNED` + 一个新的「管理面名称谓词」。**没有一项可以复用 49 的写入函数** —— 因为本阶段根本没有内容写入。

---

## Architecture Patterns

### System Architecture Diagram

```
  设置页 (realm://settings → http://localhost:<port>/settings, <webview> guest)
  src/settings-page.js（实测：零 realmAPI / 零 ipcRenderer / 零 require(）
  ├ window.SkillPickerModel.STATUS_TEXT / TIER_BADGE  ← <script src="skill-picker-model.js">（本阶段新增引用）
  ├ fetch /api/skills/list?token=…          ─┐
  ├ fetch /api/skills/set-disabled?token=…   │  每次操作后自行重拉（guest 收不到广播）
  └ fetch /api/skills/uninstall?token=…      │
                                             ▼
  主窗口 renderer (file://)            realmServer（main.js:2704，http.createServer(async (req,res)=>{…})
  src/renderer.js                      ├ token 校验（REALM_TOKEN，main.js:104）
  ├ realmAPI.onIpcMessage('skills:changed')   ├ dispatch：/api/skills/ → handleSkillsApi（新增分支）
  │    → pullAiSkillsSnapshot()（:4405）      │    ├ list         → manager 管理投影
  ├ realmAPI.ai.getSkillsManagement()  │    ├ set-disabled → 谓词 → configStore → sync(恰一次) → 补播
  ├ realmAPI.ai.setSkillDisabled()     │    └ uninstall    → 读盘判据 → 删盘 → 清名单 → sync → 补播
  └ realmAPI.ai.uninstallSkill()       │   （readJsonBody(req, res?, {maxBytes}) ← D-16；57 调用点）
        │ ipcMain.handle               └ 既有端点全部经 readJsonBody
        ▼
  ipc-handlers.js ── assertTrustedSender（:113-122；拒 webview guest / DevTools / 非受管窗口）
        │
        └──────────────┬─────────────────────────────────────────────────────────┐
                       ▼                                                         │
        ai-manager（转发层 + 失效链）                                             │
        ├ ensureSkillsFresh()        ← 【D-19 新增】不依赖 Agent 的读路径初始化    │
        ├ syncAgentSystemPrompt()    ← 函数体逐字不改（46-04 断言钉住）；           │
        │                              内含恰一次 refreshSkills（:3030）           │
        ├ setSkillDisabled() / uninstallUserSkill()                              │
        │     └ 成功后：await syncAgentSystemPrompt() 恰一次                       │
        │               windowManager.broadcast('skills:changed') ← 调用侧补播     │
        │               （覆盖忙时只置脏不广播的分支 :3038-3041）                    │
        └──────────────────────────────────────────────────────────────────────┘
                       ▼
        ai-skills-manager.js（数据权威，零 electron，可单测）
        ├ refreshSkills(env, {disabled, rootDirs})            :538-730
        │   ⓪ 根存在性(:567) → ① 布局/描述过滤(:611) → ② 目录名权威(:642) → ③ 遮蔽+④ 定序(:648)
        │   → ④.5 【新增】逐技能递归遍历（bytes / fileCount / 诊断）
        │   → ⑤ disabled(:655) → ⑥ overLimit(:660) → ⑦ prompt 预算(:674)
        │   → digest(:715) / refreshedAt(:716) / return _cache(:729)
        ├ getSkillsForManagement(seededNames)  ← 【新增】分组投影（无 content）
        ├ getSkillsForUI(seededNames)          :853-859 不改（48 的收窄投影）
        ├ deleteUserSkill(env,{name})          ← 【新增】仅 user 可删
        ├ validateSkillNameForManagement(name) ← 【新增】安全超集谓词（OQ-2）
        └ MANAGE_SKILL_ERROR（+ NOT_USER_OWNED）  :966-977
                       │
                       ▼ 沙箱 ExecutionEnv（agent-workspace.createSandboxEnv，:205）
        fileInfo / listDir / exists / remove({recursive:true})   （:286-325）
        agent-workspace/skills/<name>/          (source='user')
        agent-workspace/managed-skills/<name>/  (source='managed'；seeded 亦在此)
                       ▲
        configStore('settings.aiSkills.disabled') ── 由 refreshSkills 的**调用方**读取并传入
                       ▲
        windowManager.broadcast（:309-316）── 只到各 BrowserWindow webContents，**不到 webview guest**
```

### Recommended Project Structure

```
（无新目录；改动全部落在既有文件 + 一个新测试文件）
ai-skills-manager.js        # 尺寸遍历 / 管理投影 / deleteUserSkill / 管理面名称谓词 / 第十码
ai-manager.js               # ensureSkillsFresh + 三个管理方法 + 写路径收口（sync 恰一次 + 补播）
main.js                     # MAX_JSON_BODY_BYTES / readJsonBody(+maxBytes) / sendJson 幂等护栏
                            #   + handleSkillsApi + 分发分支 + 两个书签端点显式覆盖 + settings/update 校验
ipc-handlers.js             # 三个管理通道（与 ai:get-skills :1747 / ai:refresh-skills :1763 并列）
src/preload.js              # realmAPI 新方法（与 getSkills :1033 / refreshSkills :1040 并列）
src/settings.html           # 「技能管理」区 DOM（插在 :531 的 ai-vision-section 之后、:532 的 </section> 之前）
                            #   + <script src="skill-picker-model.js">（插在 :784-785 之间）
src/settings-page.js        # 渲染 / 启停 / 卸载确认 / 诊断展开 / inline hint / skillsApi()
src/skill-picker-model.js   # STATUS_TEXT 加第 5 条 disabled；「仅显式」label+title 提升为单源（UI-SPEC 硬前置）
src/styles/main.css          # 末尾专属段追加 .skill-manage-* 段 + --skill-success-text（两套主题）
docs/product/ai-skills.md   # 新增管理面章节（§十二）；§11.3 加「管理面另有 not_user_owned」
AGENTS.md                   # 维护约定 + 测试清单（含码数刷新、新测试套件、读写两个账本分开记）
tests/test-skills-management.js   # 新增独立套件
```

### Pattern 1: 管理投影的尺寸统计 —— 递归遍历（本阶段最需要写对的一段）

**What:** 在 `refreshSkills()` 的 ④ 定序（`:648`）之后、⑤ 禁用标记（`:655`）之前，对每条缓存条目做一次**逐技能**递归遍历，把 `bytes` / `fileCount` 挂在条目上，供管理投影消费。

**When to use:** **只在 `refreshSkills()` 内**。绝不能在任何读取投影的路径里做 IO（G-42-4 / D-13）。

**当前代码核实过的遍历规则（每条都有本会话直读的依据）：**

| 规则 | 依据（本会话核实） |
|------|-------------------|
| 起点 = `path.dirname(entry.skill.filePath)` | 目录名才是权威（46 D-08）；SDK `Skill` 无位置字段 |
| `entry.kind === 'symlink'`：**完全跳过（不递归、不计字节）** | `nodejs.js:43-51` 的 `fileKindFromStats` 用 `stats.isSymbolicLink()` 判；`listDir` 逐项 `lstat`（`:561`）⇒ symlink **不被跟随**，其 `size` 是**链接长度** |
| `entry.kind === 'directory'`：递归，**不加** `size` | 目录条目的 `size` 来自 `lstat().size`（`nodejs.js:60`），是 inode 数据不是内容 |
| `entry.kind === 'file'`：`bytes += size`，`fileCount += 1` | `fileInfoFromStats` 的 `size: stats.size`（`nodejs.js:60`） |
| `entry.name.startsWith('.')`：跳过 | `listDir` **不**过滤点文件（`nodejs.js:553` 的 `readdir` 原样返回）⇒ `.DS_Store` 会进来，必须显式过滤 |
| 任何 Result 的 `ok !== true` 一律当「读不到」处理（**不 throw**） | 沙箱契约：FileSystem 永不 throw，失败编码进 Result（`agent-workspace.js:215` 注释逐字：「FileSystem 契约：永不 throw，失败编码进 Result」） |
| 逐技能 `try/catch`：失败 → 该技能 `bytes=0/fileCount=0` + 一条 `realm_` 诊断；**不得**中断整批 | 加载管线既有纪律「单技能失败跳过，其余照常」（`ai-skills-manager.js:565-566` 的注释）；整批 catch 会走 `:717-728` 的**整体回滚**，把一次 stat 失败放大成技能集消失 |

**本会话新发现的 SDK 细节（旧 RESEARCH 未记，影响实现）**：

1. **`listDir` 对单个条目的失败会整目录失败**：`nodejs.js:560-567` 内层 catch 是 `return err(...)`（**返回**，不是 continue）⇒ 任何一个 entry 的 `lstat` 抛错，整个 `listDir` 返回 `err`。实现必须把「目录不可读」当作正常分支处理（产诊断 + 该技能 `bytes=0`），而不是让它冒泡。
2. **非 file/dir/symlink 的条目会被 SDK 静默丢弃**：`fileKindFromStats` 对 fifo / socket / 设备文件返回 `undefined` ⇒ `fileInfoFromStats` 返回 `err` ⇒ `listDir` 里 `if (info.ok) infos.push(...)`（`:562`）**静默跳过**。即：这类条目既不计入文件数也不产诊断 —— 属可接受的边界，但**必须在文档口径里写明**「统计对象是常规文件」。
3. **`createSkillsEnv` 的收窄只作用于扫描根**（`:235-236` + `:244`：`if (!isScanRoot(p)) return res;`）⇒ 技能子目录的 `listDir` 不受「只留目录」的收窄影响。用**原始 sandbox `env`** 语义最直白（尺寸统计与「加载面收窄」无关）。

**参考实现骨架（命名交 plan 期）：**

```js
// ai-skills-manager.js —— 挂在新常量下，随模块导出供单测
const SKILL_SIZE_WALK_MAX_ENTRIES = 5000;   // OQ-4 已裁决
const SKILL_SIZE_WALK_MAX_DEPTH = 16;       // OQ-4 已裁决

/** 递归统计技能目录：返回 {bytes, fileCount, errors:[]}；永不 throw */
async function measureSkillDir(env, dir) {
  let bytes = 0, fileCount = 0, entries = 0, overflow = false;
  const errors = [];
  const walk = async (p, depth) => {
    if (depth > SKILL_SIZE_WALK_MAX_DEPTH) {
      errors.push({ level: 'warning', code: 'realm_skill_dir_too_deep',
        message: `技能目录嵌套超过 ${SKILL_SIZE_WALK_MAX_DEPTH} 层，统计已截断`, path: p });
      return;
    }
    const res = await env.listDir(p);
    if (!res || res.ok !== true) {
      errors.push({ level: 'warning', code: 'realm_skill_dir_unreadable',
        message: `技能目录不可读（沙箱码 ${sandboxErrorCode(res)}）: ${p}`, path: p });
      return;
    }
    for (const e of res.value) {
      if (!e || typeof e.name !== 'string' || e.name.startsWith('.')) continue;  // 隐藏文件不计
      if (e.kind === 'symlink') continue;                                        // 不穿链接（含防环）
      entries += 1;
      if (entries > SKILL_SIZE_WALK_MAX_ENTRIES) { overflow = true; return; }
      if (e.kind === 'directory') { await walk(e.path, depth + 1); continue; }
      if (e.kind === 'file') { bytes += Number.isFinite(e.size) ? e.size : 0; fileCount += 1; }
    }
  };
  await walk(dir, 1);
  if (overflow) {
    errors.push({ level: 'warning', code: 'realm_skill_dir_too_many_entries',
      message: `技能目录条目超过 ${SKILL_SIZE_WALK_MAX_ENTRIES} 个，统计已截断（显示为下限值）`, path: dir });
  }
  return { bytes, fileCount, errors };
}
```

**挂载点（`refreshSkills` 内）：**

```js
    _cache.skills = applyShadowing(entries).sort(bySkillPriority);   // ④ :648（既有，逐字不改）

    // ④.5 尺寸统计（D-13）：在重扫管线内算一次并缓存；**不进 computeDigest**
    //      逐技能隔离失败：任何一项读不到只影响它自己 + 一条诊断，不得让整批走 catch 回滚。
    for (const entry of _cache.skills) {
      const dir = path.dirname(entry.skill.filePath);
      const measured = await measureSkillDir(env, dir);
      entry.bytes = measured.bytes;
      entry.fileCount = measured.fileCount;
      for (const d of measured.errors) pushEntryDiag(entry, d);
      if (measured.fileCount === 0 && measured.bytes === 0 && measured.errors.length === 0) {
        // 空技能目录（只有 SKILL.md 时不会到这里）—— 属正常，不改判定
      }
    }

    // ⑤ 启用/禁用（D-09）…（既有）
```

⚠️ **`SKILL.md` 自身的 `size` 是否计入 `bytes`**（旧 RESEARCH 的 A2）：D-13 的口径是「该技能目录的**全部子项**（含 `scripts/` / `references/` / 任意嵌套），累加字节数与文件数」——按字面 `SKILL.md` 计入（它就是技能正文，也是用户最关心的体量）。**但必须在产品文档与 UI 文案里写清**，否则用户会看到 `64.1 KB` 而 `LIMITS.MAX_SKILL_MD_BYTES` 是 `65536`（64 KiB）而困惑。UI-SPEC 的区说明 ③（`50-UI-SPEC.md:421`）已写成「递归合计（含 `SKILL.md`，不含隐藏文件）」—— **与实现口径必须一致**。

⚠️ **尺寸统计不得进 `computeDigest`**（反优化禁令）：digest 的成文契约是「影响 **prompt 段**的全部因素」（`ai-skills-manager.js:173-183` 的 JSDoc）。尺寸不影响 prompt ⇒ 不进。**反之亦禁**：不得把 `disabled` / `shadowed` / `overLimit` 从 `computeDigest` 摘掉（D-18 禁令，理由见「矛盾核查 · 复核通过 #1」与 Pitfall 12）。

### Pattern 2: 管理面投影（新增，**不扩展** `getSkillsForUI()`）

**What:** 一个同步、零 IO 的投影函数，返回**已分组**（D-01 三组）且组内已按 `bySkillPriority` 全序排列的结构。

**形状建议**（Claude's Discretion 的裁决落点；分组与空组剔除都建议在**主进程**做）：

```js
getSkillsForManagement(seededNames)
// → {
//     groups: [ { tier: 'user',    items: [...] },
//               { tier: 'builtin', items: [...] },
//               { tier: 'managed', items: [...] } ],   // 空组已在主进程剔除（D-03 的分组在主进程）
//     errors: [ ... ],        // 模块级 _cache.errors（D-11 顶部汇总条）
//     refreshedAt: number,    // 0 ⇒ 从未加载（D-19 / UI-SPEC 空态 A 的判据）
//     digest: string,
//     limits: { maxSkillMdBytes, maxUserSkills, maxManagedSkills,
//               skillsPromptCharBudget, maxDescriptionChars }   // = LIMITS 投影，前端零字面量
//   }
```

- 每组 `items[]` 的条目字段 = `toUISkillEntry` 的**全部字段**（`name` / `description` / `tier` / `disableModelInvocation` / `disabled` / `shadowed` / `shadowedBy?` / `overLimit` / `promptOmitted`）**加上** `bytes` / `fileCount` / `diagnostics[]`（**深层拷贝** —— 条目级 `diagnostics` 是 `_cache` 里的活数组，浅拷会让设置页的展开操作写回权威快照）。**仍不带 `content`**。
- **`limits` 必须回传**：Claude's Discretion 明文「设置页不得写死任何限额数值」+ UI-SPEC `:530` 的硬要求；数值来自 `LIMITS`（`:48-54`，`[VERIFIED: ai-skills-manager.js:48-54]` —— 「`MAX_SKILL_MD_BYTES: 64 * 1024`」「`MAX_USER_SKILLS: 50`」「`SKILLS_PROMPT_CHAR_BUDGET: 8000`」「`MAX_MANAGED_SKILLS: 50`」「`MAX_SKILL_DESCRIPTION_CHARS: 1024`」）。
- **`(bytes === 0 && fileCount === 0)` 是「统计不可用」而非「0 字节」**：UI-SPEC `:427` 文案 11 已锁「不得渲染 `0 B · 0 个文件`，那是失实文案」。投影必须让前端能区分「空」与「读不到」—— 建议**加一个显式布尔**（如 `statsUnavailable`）或依赖「此时必有 `diagnostics`」。**推荐显式布尔**（依赖「必有诊断」是隐式契约，会被后续「顺手去掉冗余诊断」打翻）。
- **上界核算**：100 条技能 × (描述 ≤1024 字符 + 诊断若干 + 数值字段) —— 最坏约 200 KB（**没有正文**），远小于 `getSkillsForUI()` 省下的 ~3 MB。**A6 待实测**（plan 期验收里跑一次）。

### Pattern 3: 两个入口共用同一 manager 函数（判据 4）

```js
// ipc-handlers.js —— 转发层，零判定（与 :1747 的 ai:get-skills 并列）
ipcMain.handle('ai:get-skills-management', async (event) => {
  assertTrustedSender(event);                        // :113-122，拒 webview guest
  if (!aiManager) throw new Error('AI Manager 未初始化');
  return aiManager.getSkillsForManagement();         // → 同一 manager 方法
});
```

```js
// main.js —— 转发层，零判定；插在 /api/ai-memory 分发（:2757-2760）之后
async function handleSkillsApi(req, res, reqUrl) {
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) { sendJson(res, 403, { error: 'Forbidden' }); return; }
  try {
    const route = reqUrl.pathname.replace('/api/skills/', '');
    if (route === 'list' && req.method === 'GET') {
      sendJson(res, 200, await aiManager.getSkillsForManagement());          // 同一 manager 方法
      return;
    }
    if (route === 'set-disabled' && req.method === 'POST') {
      const { name, disabled } = await readJsonBody(req, res);                // ← 签名按「矛盾 1」的裁决
      sendJson(res, 200, await aiManager.setSkillDisabled(name, disabled));
      return;
    }
    if (route === 'uninstall' && req.method === 'POST') {
      const { name } = await readJsonBody(req, res);
      sendJson(res, 200, await aiManager.uninstallUserSkill(name));
      return;
    }
    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('[Realm] 技能 API 处理失败:', err.message);
    sendJson(res, 400, { error: err.message, code: err.code || undefined });
  }
}
```

⚠️ **错误形状**：业务的 `code`（如 `not_user_owned`）**必须回传给前端**（D-08 / UI-SPEC 的失败文案映射表按 `code` 查表，**不解析 `message`**），HTTP 状态统一 **400**（既有 `/api/*` 范式，`main.js:1326` / `:2700` 同款）。

⚠️ **IPC 写侧暂无 UI 消费者**（D-17 明文）—— 通道的价值是「两入口同一权威」的对称性 + 未来主窗口管理面 + 开发调试便利；**不得**为了让 IPC 有消费者而在主窗口新造管理 UI。

⚠️ **设置页必须走 HTTP**（guest 无 `realmAPI`）、**主窗口必须走 IPC**（`file://` fetch 本地 HTTP 被 CORS 拦，Phase 38 事故，`src/preload.js:1030-1031` 的注释即记此事）。两条不可互换。

### Pattern 4: 写路径收口（`syncAgentSystemPrompt()` 恰一次 + 调用侧补播）

```js
// ai-manager.js（新方法；**不得**把补播挪进 syncAgentSystemPrompt() 的函数体）
async setSkillDisabled(name, disabled) {
  const check = getAiSkillsManagerLazy().validateSkillNameForManagement(name);  // 安全超集谓词
  if (!check.ok) throw makeErrFromCheck(check);          // code: 'invalid_name'
  const list = this.configStore.get('settings.aiSkills.disabled', []);
  const current = Array.isArray(list) ? list.slice() : [];
  const next = disabled ? [...new Set([...current, name])] : current.filter((n) => n !== name);
  this.configStore.set('settings.aiSkills.disabled', next);   // 同步写 ⇒ 下一次 sync 必读得到
  await this.syncAgentSystemPrompt();                          // 内含恰一次 refreshSkills
  windowManager.broadcast('skills:changed');                   // 调用侧补播（忙时分支的唯一来源）
  return this.getSkillsForManagement();
}
```

- **configStore 的 `set` 是同步的**，且 `ai-manager` 与 `main.js` 共享**同一个 `Store` 实例**（`main.js:112` 建实例 → `aiManager.init(configStore)` 注入，`ai-manager.js:778`）⇒ 写后立刻 `syncAgentSystemPrompt()` 必然读到新名单（三处读取点 `:904` / `:3031` / `:3147`）。
- **增量载荷 `{name, disabled}` 在「主进程内」做读-改-写**（同步、无 await 夹在中间）⇒ 两个并发的设置页操作不会互相覆盖。这是选增量而非全量的**实现层理由**（不只是语义偏好）。
- **卸载路径多两步**：删盘成功 → `configStore.set('settings.aiSkills.disabled', current.filter(n => n !== name))`（D-09 派生不变式）→ 再 sync + 补播。
- **不得改 `syncAgentSystemPrompt()` 的函数体**：46-04 的方法体源码断言（`tests/test-ai-skills.js:1299-1306` / `:2299-2303`，逐字含 `assert.ok(body.includes("windowManager.broadcast('skills:changed')"))`）+ 48 的次数账（`:3289-3296` 的 `channels` 与 `rescanCalls === 2`）同时钉着它。
- ⚠️ **顺带注意**：`syncAgentSystemPrompt()` 首行 `if (!this.agent || !this.sandboxEnv) return;`（`:3027`）⇒ **无 Agent 时它连重扫都不做**。所以 D-19 的读路径初始化必须在**它之前**补位（Pattern 5），否则写路径在无 Agent 状态下会「写进了 configStore 但缓存不刷新、也不广播」。

### Pattern 5: 不依赖 Agent 的管理读路径初始化（D-19）

**事实依据（本会话逐条核实）：**

- `ai-manager.js:789-793`：`if (configuredIds.length === 0) { console.log('[Realm AI] 未配置任何提供商 API Key，跳过初始化'); this.isInitialized = false; return; }`
- `ai-manager.js:893-896`：另一条提前 return（`[Realm AI] 未找到模型 …`）**也在** `:899` 之前。
- `:899` 才建 `sandboxEnv`；`:903-909` 才首次 `refreshSkills`。
- `main.js:4045-4051`：`agentWorkspace.ensureWorkspaceDir()` → `migrateAiMemory()` → `builtinSkillsSeeder.seedBuiltinSkills()`（**无条件**）→ `aiManager = new AIManager()` → `aiManager.init(configStore)`。⇒ 内置技能**早在盘上**，而缓存空。
- `refreshSkillsForPanel()`（`:3072-3075`）也只经 `syncAgentSystemPrompt()` ⇒ `:3027` 早退 ⇒ **现有 `/` 面板在无 provider 时也是空的**（既有状态、未被测试覆盖）。

**建议形状（命名交 plan 期；保持「恰一次重扫」的次数账）：**

```js
// ai-manager.js（新方法；**不进** syncAgentSystemPrompt() 的函数体）
async ensureSkillsFresh() {
  if (!this.sandboxEnv) this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();
  if (this.agent) { await this.syncAgentSystemPrompt(); return; }   // 有 Agent：走既有链（内含恰一次重扫）
  await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {   // 无 Agent：直接重扫
    disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
    rootDirs: [ getAgentWorkspaceLazy().getManagedSkillsDir(), getAgentWorkspaceLazy().getSkillsDir() ],
  });
}
```

**四条约束**：① 保持「恰一次重扫」的次数账（有 Agent 时走 `syncAgentSystemPrompt()`，无 Agent 时直接 `refreshSkills`，**不得两条都执行**）；② **不进 `syncAgentSystemPrompt()` 的函数体**（同 D-18 的钉死约束）；③ 它**不是**写路径（读侧/兜底），**不并入** D-18 的 2/3 份额（OQ-5 已裁决「两个数分别记」）；④ `createSandboxEnv()` 与 provider 配置**无关**（`agent-workspace.js:205-207`：`ensureWorkspaceDir()` + `path.resolve(options.cwd || getWorkspaceDir())`，不读任何 provider 状态）⇒ 这条路可行。

**验收面（D-19 明文）**：`refreshedAt === 0`（从未加载）**不得**被渲染成「无技能」—— 空态文案必须区分「确实没有技能」与「尚未加载」（UI-SPEC 空态 A/B 已定稿），并补一条「未配置 provider 时仍能列出两个内置技能」的端到端/手动验收。

### Pattern 6: 「仅 user 可卸载」判据 + 第十码

**D-07（OQ-1 裁决后）的判据，逐条与代码对齐：**

| 读取的盘上事实 | 判据 API | 结果 |
|----------------|----------|------|
| `skills/<name>` 存在且 `kind === 'directory'` | `env.fileInfo(path.join(getSkillsDir(), name))`（**不是 `exists`**） | **允许卸载**（删除对象恒为 `skills/<name>/`） |
| `skills/<name>` 不存在 / 存在但非目录（含 `kind === 'symlink'`）/ 读不到 | 同上（`res.ok !== true` 或 `res.value.kind !== 'directory'`） | `not_found`（含「存在但读不到」） |
| `skills/<name>` 不存在**而** `managed-skills/<name>` 存在 | 追加 `env.exists(getManagedSkillsDir()/<name>)` | `not_user_owned`（D-08 的第十码） |
| 同名双存在（user + managed 同名） | 同上 | **允许**；`managed-skills/<name>` 的存在**只用来提示**「同名托管 / 内置技能将在删除后重新可见」（UI-SPEC 文案 24） |

**为什么必须用 `fileInfo` 而不是 `exists`**：SDK 的 `exists` 实现是「`fileInfo` 成功即 `ok(true)`」（`nodejs.js:584-591`）⇒ 一个**普通文件** `skills/foo`（不是目录）也会让 `exists` 返回 `true`，而此时 `env.remove(dir, {recursive:true})` 会……删掉那个文件（`rm -r` 对文件也成立）。D-07 的字面判据是「存在**且 `kind` 是目录**」⇒ **只有 `fileInfo` 能表达**。旧 RESEARCH 的骨架只用 `exists`，**必须改**。

**为什么不能复用 `resolveManagedTarget`**（`:1367-1399`）：它的顺序是 ① seeded 保护 ② **同名 user 存在即拒**（`user_owned_conflict`）③ managed 不存在即 `not_found` —— 方向与本侧**相反**（那是 managed 视角的「用户撞名保护」）。D-07 明文要求**一处显式的「仅 user 可删」判据**。

**拒绝面的三态与码（D-07 + D-08）：**

```js
// ai-skills-manager.js（新函数；形状模板来自 deleteManagedSkill :1603-1623）
const MANAGE_SKILL_ERROR = {
  SEEDED_PROTECTED: 'seeded_protected',
  USER_OWNED_CONFLICT: 'user_owned_conflict',
  ALREADY_EXISTS: 'already_exists',
  NOT_FOUND: 'not_found',
  LIMIT_EXCEEDED: 'limit_exceeded',
  INVALID_NAME: 'invalid_name',
  INVALID_DESCRIPTION: 'invalid_description',
  OVERSIZE: 'oversize',
  UNSCANNABLE: 'unscannable',
  UNKNOWN: 'unknown',
  NOT_USER_OWNED: 'not_user_owned',   // ← 第十码（D-08）
};
```

> `[VERIFIED: ai-skills-manager.js:966-977]` —— 上述前 10 键为**当前树上逐字**内容（`SEEDED_PROTECTED: 'seeded_protected'` … `UNKNOWN: 'unknown'`）；`NOT_USER_OWNED` 是本阶段**待加**的第 11 键。

```js
/** 卸载用户技能（方向与 resolveManagedTarget 相反：只认 user 目录，不碰 managed） */
async function deleteUserSkill(env, { name } = {}) {
  const skillName = typeof name === 'string' ? name.trim() : name;
  const nameCheck = validateSkillNameForManagement(skillName);   // 安全超集谓词（OQ-2）
  if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);

  const userDir = path.join(getAgentWorkspaceLazy().getSkillsDir(), skillName);
  const info = await env.fileInfo(userDir);                       // ← 必须 fileInfo（判 kind）
  const isDir = info && info.ok === true && info.value && info.value.kind === 'directory';
  if (!isDir) {
    // 三态之二：仅 managed 存在 ⇒ 第十码；两者都不存在 ⇒ not_found（含「存在但读不到」）
    const managedDir = path.join(getAgentWorkspaceLazy().getManagedSkillsDir(), skillName);
    const m = await env.exists(managedDir);
    if (m && m.ok === true && m.value === true) {
      throw makeManageSkillError(MANAGE_SKILL_ERROR.NOT_USER_OWNED,
        `"${skillName}" 不是用户技能（只存在于 managed-skills/），无法在此卸载：内置技能只可禁用，AI 创建的技能请让 AI 用 manage_skill 删除`);
    }
    throw makeManageSkillError(MANAGE_SKILL_ERROR.NOT_FOUND,
      `技能 "${skillName}" 不存在（只能卸载 skills/ 目录下的用户技能）`);
  }
  const shadowNotice = await (async () => {                       // 仅作提示，不作拒绝条件
    const m = await env.exists(path.join(getAgentWorkspaceLazy().getManagedSkillsDir(), skillName));
    return !!(m && m.ok === true && m.value === true);
  })();

  const res = await env.remove(userDir, { recursive: true });      // recursive 默认 false ⇒ 必须显式传
  if (!res || res.ok !== true) {
    throw makeManageSkillError(MANAGE_SKILL_ERROR.UNKNOWN,
      `卸载技能 "${skillName}" 失败（沙箱码 ${sandboxErrorCode(res)}）`);
  }
  return { name: skillName, filePath: path.join(userDir, 'SKILL.md'), action: 'uninstall', shadowNotice };
}
```

**读盘而非缓存快照**：判据一律读盘（`env.fileInfo` / `env.exists`），**不用 `_cache`** —— bash 可随时改写磁盘（P8 第 6 条），缓存只反映上次重扫的时刻（`ai-skills-manager.js:1358-1359` 的既有 JSDoc 同款口径）。

### Anti-Patterns to Avoid

- **把体积/文件数塞进 `computeDigest`**：加一个 `references/notes.md` 就会触发 systemPrompt 改写 + 广播（provider 前缀缓存 miss）。尺寸不影响 prompt ⇒ 不进。
- **反过来「精简」digest**（摘掉 `disabled` / `shadowed` / `overLimit`）：会**同时**打断 `syncAgentSystemPrompt()` 的改写广播（`:3046` 的合取）与 renderer 的 `pullAiSkillsSnapshot` digest 早退（`src/renderer.js:9134`：`if (snapshot.digest === state.aiSkillsDigest) return;`）⇒ 跨窗口同步静默失效。
- **在 `syncAgentSystemPrompt()` 函数体内加广播或加 `refreshSkills()`**：46-04 的方法体源码断言 + 48 的次数账会同时转红。
- **在管理投影读取时实时遍历磁盘**：违反冻结快照（G-42-4）。
- **`req.destroy()` 拒收超限请求体**：本会话实测客户端拿 EPIPE（判据 5 的「返回明确错误」不成立）。
- **`sendJson` 无幂等护栏**：本会话实测 ⇒ `unhandledRejection` 1 次（`Cannot write headers after they are sent to the client`），全仓无全局兜底 ⇒ 主进程退出。
- **直接 `fs` 遍历技能目录**：绕过 `resolveInside` 的 realpath 复核，等于给「运维/统计」开一个新的越界读入口。
- **在设置页写死限额数值**（`64 KiB` / `50` / `8000` / `1 MiB`）：45/46 建立的「端点与前端零字面量」纪律；限额一律取管理投影回传值。
- **在主窗口新造技能管理 UI**：D-17 明确为新能力，不属本阶段。
- **用 `validateManagedSkillName` 做管理面谓词**：会让 `skills/My_Skill/` 这类**列表里明明有条目**的技能变成「点了开关必然 400」（OQ-2 的「故意的不对称」必须在**服务端谓词**上，而不是让用户先撞墙）。
- **在设置页用 `innerHTML` / 字符串模板拼 HTML**：UI-SPEC 的注入纪律（硬约束）；`TD-48-01` 的 `escapeHtml` **只转义 `& < >`、不转义引号**且**仍开**（用户已裁决延后）。本页新增插值一律走 DOM API（`textContent` / `setAttribute`），**不扩大缺口**。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 技能目录递归统计 | 自己写 `fs.readdirSync` + 自造路径校验 | 沙箱 `env.listDir`（`agent-workspace.js:292-296`，返回 `FileInfo[]` 带 `kind` / `size`） | 沙箱自带 `resolveInside` 双基准 + realpath 复核（`:162-192`）；自造即第二个校验实现 |
| 技能名合法性判定（管理面） | 在 `main.js` / 设置页各写一份正则 | **新增一个导出谓词**（住 `ai-skills-manager.js`，安全超集，OQ-2） | 单源；`/api/settings/update` 校验与 `set-disabled` / `uninstall` 必须同宽（UI-SPEC `:479` 明文） |
| 写入侧技能名校验 | 在管理面另写一份 `^[a-z0-9-]+$` | `validateManagedSkillName`（`:1034-1063`）——**但它只服务写入门** | 49-01 明文：该模块是 50/51 唯一可复用的那一份；第二份必然漂移。管理面**故意**用更宽的谓词 |
| 三档来源判定 | 前端按目录名/字段猜 | `sourceTierOf`（`:776-780`） | 46 D-06 / 48 D-14 已锁；seeded 集合由主进程注入 |
| 状态标注文案 | 设置页新写「已禁用」「已遮蔽…」 | `STATUS_TEXT`（`src/skill-picker-model.js:239-244`） | D-12；同一状态两处文案必然漂移（48/49 已付代价） |
| 来源徽标 label/title | 设置页新写「用户/内置/托管」 | `TIER_BADGE`（`:349-365`） | 面板行 / `read` 卡片 / `manage_skill` 卡片 / **本页**四处共用同一类 |
| 请求体长度上限 | 读完再 `body.length` 判 | 累积中判 + **立即停收**（Pitfall 1） | 本会话实测：40 MB body 全量累积 → **+45.7 MB** 堆且返回 **200** —— 不是防护 |
| 递归删除 | 自己 `fs.rmSync` | `env.remove(dir, { recursive: true })`（`agent-workspace.js:321-325`；SDK `recursive ?? false`） | 沙箱版含路径校验 |
| 体积格式化 | 新写一套单位换算 | 沿既有「逐页局部实现」惯例（`src/renderer.js:11317` 的 `formatFileSize` 同款：`toFixed(1)` + `B/KB/MB/GB`） | 既有惯例就是逐页局部；**但不得写死限额数值** |
| 折叠块视觉 | 新写一套折叠控件 | CSS 家族 `.ai-skill-content-box*`（`src/styles/main.css:5827-5889`）+ 既有 `.collapsed` / `.ai-skill-content-box.collapsed .ai-skill-content-box-chevron` 规则 | UI-SPEC 明文「不得新建第二份折叠实现」；⚠️ JS 侧**没有**可复用的模块（见 Pitfall 13） |
| 确认弹框 | 新写遮罩 + 居中方案 | `.ai-modal-overlay`（`main.css:5350-5358`，`display:none` 初始）+ `.ai-modal`（`:5376-5403`）+ JS CSSOM `display` 切换 | UI-SPEC 明文；`realm://` CSP 下**禁止** markup 内联 style，**绝不**把 overlay 用到 `<dialog>` 上（AGENTS.md 弹框居中约定） |
| 原子写 | — | 本阶段**无内容写入**，无需 | 只在 Phase 51 导入落盘时用 `atomicWriteSkillFile`（`ai-skills-manager.js:1274`） |

**Key insight:** 本阶段几乎全部零件都已存在，真正的风险不在「写代码」而在**接线点选错**（digest 的输入面、遍历的挂载点、拒收的时序、谓词的宽严），这四处错一个都会**静默**失效或**崩溃**（无异常、无日志或直接退出），因此每条都要有对应的行为断言。

---

## Common Pitfalls

### Pitfall 1: 「立即拒收」的形态选错 ⇒ 客户端拿 EPIPE / 主进程崩

**What goes wrong:** 按 D-16 字面「`req.destroy()`」实现后，超限请求的客户端（`fetch`）收到的是**网络错误**而不是 413 JSON ⇒ ROADMAP 判据 5 的「返回明确错误」不成立，前端只能显示通用失败文案。

**Why it happens:** `req.destroy()` 在响应被客户端读取前撕掉 socket；而客户端此刻**仍在写** body。

**How to avoid（本会话实测通过的形态）：**
1. 用 `rejected` 标志停止累积（`if (rejected) return;`），**不再拼接 `body`**；
2. `sendJson(res, 413, { error, limit })`，**不设 `Connection: close`**；
3. **不要** `req.destroy()`；改为 `req.resume()`（继续丢弃读入）。

**本会话实测证据（Node v22.22.0，40 MiB body，1 MiB 上限，`fetch` 客户端）：**

| 形态 | 客户端可见 | 堆增量 |
|------|-----------|--------|
| 现状 `body += chunk`（无上限） | **200**（超限照样收下） | **+45.7 MB** |
| **`sendJson(413)` + `req.resume()`** | **413 + JSON** | **≈ 0** |
| `sendJson(413)` + `req.destroy()` | **fetch 抛 `EPIPE`** | — |
| `sendJson(413)` + `Connection: close` + `req.resume()` | **413 + JSON**（与旧 RESEARCH 的 EPIPE 结论**不符**，见矛盾 2） | ≈ 0 |

**Warning signs:** 设置页的 413 处理分支从未被触发；或浏览器 Console 出现 `Failed to fetch` 而非 413 文案。

**可选增强（低代价）**：读第一个字节**之前**用 `req.headers['content-length']` 预检（浏览器 `fetch` 会带 `Content-Length`）⇒ 绝大多数超限请求被**零字节读取**拒掉。与累积中判**并存**（前者快路径、后者兜底）；`Content-Length` 可伪造/缺失，**不得**取代累积中判。

### Pitfall 2: `readJsonBody` 自答 413 又 reject ⇒ 外层 catch 二次 `sendJson` ⇒ `unhandledRejection`（**主进程退出**）

**What goes wrong:** **13 处**宿主（12 个具名 handler + 内联 `/api/bookmarks-bar/toggle`，`:2818-2835`）的形状都是「`try { … await readJsonBody(req) … } catch (err) { console.error(…); sendJson(res, 400, { error: err.message }); }`」。若 `readJsonBody` 已 `res.end(413)` 之后仍 `reject`，每个 catch 都会再写一次头 → 抛 `ERR_HTTP_HEADERS_SENT`；而 `realmServer` 的回调是 `async`（`main.js:2704`）⇒ HTTP 层**不接管**返回的 Promise ⇒ **unhandled rejection**。

**本会话实测**：无护栏时 `unhandledRejection` 计数 = **1**（`Cannot write headers after they are sent to the client`），客户端仍拿到 413（async 抛出不会撕响应）。⚠️ **但全仓没有任何 `process.on('unhandledRejection')` / `uncaughtException` 兜底**（本会话 `grep -n "uncaughtException\|unhandledRejection" main.js ipc-handlers.js agent-workspace.js ai-manager.js` 零命中）⇒ Node 24 默认 `--unhandled-rejections=throw` ⇒ **主进程退出**。

**How to avoid:** 给 `sendJson` 加**幂等护栏**（一处修好全部 13 个发送点）：

```js
// main.js:877-880 改造后
function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;   // 已答过即 no-op（判据 5 的拒收路径必需）
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
```

**本会话实测**：加护栏后 catch 路径返回 no-op，`unhandledRejection` 计数 = **0**，客户端仍拿到 `413 + {"error":"too large"}`。

**可选做法（二选一，别都做）**：`readJsonBody` 拒收时用**专属错误码**（`err.code = 'BODY_TOO_LARGE'`）reject，让 catch 识别并跳过二次应答。但 57 个调用点只有 13 个 catch，**护栏的改动面更小、且顺带加固了所有既有双答路径** ⇒ **推荐护栏**（两者并存也可，但不要只为这个目的改 13 处 catch）。

**Warning signs:** 主进程日志出现 `ERR_HTTP_HEADERS_SENT`；或 Electron 主进程直接退出（无全局兜底）。

### Pitfall 3: 全局 1 MiB 默认打断两个书签导入端点（**会静默破坏既有功能**）

**What goes wrong:** `readJsonBody` 的 57 个调用点里有两个端点的 body 是**用户书签文件全文**：

```js
// src/favorites-page.js:2243-2249（pickBookmarkFile）
    const ext = file.name.toLowerCase().split('.').pop();
    try {
      const content = await file.text();
      if (ext === 'json') {
        await startChromeImport({ content });
      } else if (ext === 'html' || ext === 'htm') {
        await startHtmlImport(content);
```

- `POST /api/favorites/import-chrome`（`main.js:1157`，body `{ filePath, content }`）
- `POST /api/favorites/import-html`（`main.js:1177`，body `{ filePath, content, mode }`；**预览与执行各发一次**同一份 content，`src/favorites-page.js:2335` / `:2445`）

Chrome / Safari 的书签导出**常规就在 1–10 MB** ⇒ 全局默认 1 MiB 会让「导入书签」在这些用户那里 413。

**How to avoid:** 落地 D-16 时**逐个端点复审** 57 个调用点，给有真实大 body 的端点显式覆盖 `maxBytes`。本会话按宿主函数实测的完整分表（`grep -c "await readJsonBody(req)" main.js` = **57**）：

| 宿主函数 | 行范围（本会话） | 调用点数 | 其中可能大 body 的端点 |
|----------|------------------|---------|----------------------|
| `handleHistoryApi` | 908-975 | 3 | — |
| `handleFavoritesApi` | 976-1286 | **17** | **`import-chrome`（`:1157`）**、**`import-html`（`:1177`）**；次要：`items`（`:1132`）/ `folders`（`:1140`）批量重排 |
| `handleSettingsApi` | 1336-1709 | 10 | `update`（`:1373`，任意键值）；`ai/providers/:id/detect-models`（`:1643`） |
| `handleSearchConfigApi` | 1710-1866 | 2 | — |
| `handleDevRequestsApi` | 1867-1995 | 2 | — |
| `handleDownloadsApi` | 1996-2165 | 6 | — |
| `handleTasksApi` | 2166-2333 | 3 | — |
| `handleCredentialsApi` | 2334-2424 | 3 | — |
| `handleAddressApi` | 2425-2483 | 2 | — |
| `handleRulesApi` | 2512-2580 | 5 | `import`（`:2562`，批量规则） |
| `handleShortcutsApi` | 2581-2648 | 2 | — |
| `handleAiMemoryApi` | 2649-2703 | 1 | 受 `ai-memory-manager.BUDGETS` 自限 |
| （内联分支）`/api/bookmarks-bar/toggle` | 2818-2835（属 `realmServer` 体） | 1 | — |
| **合计** | | **57** | |

⇒ **`main.js` 里 `readJsonBody` 的调用点分属 12 个具名 handler + 1 个内联分支，共 57 处**；**13 个宿主全都有 `catch → sendJson`**。

**Warning signs:** 用户报告「导入书签失败：请求体超过上限」；或设置页保存大配置时 413。

### Pitfall 4: 递归遍历穿符号链接 ⇒ 无限递归 / 主进程卡死

**What goes wrong:** `skills/foo/references/self → references`（或任何指向祖先的内部链接）会让递归永不终止；而遍历发生在**每次 Agent 创建/重建**的 `refreshSkills()` 里（`ai-manager.js:903` / `:3146`），等于把主进程卡死。

**Why it happens:** SDK 的 `listDir` 用 `lstat` **不跟随**符号链接（`nodejs.js:561`），所以 `kind === 'symlink'` 是可以被识别出来的；但**沙箱的路径校验**（`resolveInside` 的 realpath 复核）对**指向工作区内**的链接是**放行**的 ⇒ 只有**外逃**链接（→ `/etc`）才会 `permission_denied`。

**How to avoid:** 显式 `if (entry.kind === 'symlink') continue;`（要不要计 1 个文件 + 其链接 `size` 是产品口径问题，但**绝不能递归**）。加 depth 上限作为第二道防线（OQ-4 已定 16）。

**Warning signs:** `npm run dev` 后主进程 CPU 100%、`refreshSkills` 不返回；或 `realm_skill_dir_too_deep` 诊断刷屏。

### Pitfall 5: 目录 `size` 与隐藏文件被算进体积

**What goes wrong:** 体积显示比实际大、且随机漂移（macOS 下 Finder 浏览就新增 `.DS_Store`）。

**Why it happens:** `listDir` 返回的**目录**条目 `size` 非 0（来自 `lstat().size`，`nodejs.js:60`）；`.DS_Store` 是普通 `kind:'file'`、`readdir` **不过滤点文件**（`:553`）⇒ 会进遍历。

**How to avoid:** 只对 `kind === 'file'` 累加；`name.startsWith('.')` 一律跳过；**并把口径写进 `docs/product/ai-skills.md`**（D-13 明写要求），且与 UI-SPEC 区说明 ③ 逐字一致。

**Warning signs:** 用户改一次 Finder 视图，体积数就变；或空技能目录显示非 0 字节。

### Pitfall 6: 拿 `refreshSkills()` 的返回值做前后对比 —— 它是**活引用**

**What goes wrong:** `const a = await refreshSkills(...); const b = await refreshSkills(...); a.digest === b.digest` **恒真**（两次拿到的是同一个模块级 `_cache` 对象）。

**Why it happens:** `refreshSkills` 末尾 `return _cache;`（`ai-skills-manager.js:729`），`_cache` 是模块级单例（`:159`）。`getSkillsSnapshot()`（`:752-759`）返回的也只是**浅拷贝** —— 数组是新的，**条目仍是同一批引用**。

**How to avoid:** 需要快照时立即取**值副本**（`{digest, promptBlock, bytes, fileCount}`），或 `JSON.parse(JSON.stringify(...))`。**写测试时同样要防这个假绿/假红形态**。

**Warning signs:** 断言「两次 refresh 后 digest 不同」永远为假；或「改了 disabled 但断言看不到变化」。

### Pitfall 7: 设置页是纯 HTTP guest —— 广播到不了它，且 CSP 禁内联 style

**What goes wrong:** 在设置页里等 `skills:changed` 或写 `<div style="display:none">` 都会静默失效。

**Why it happens（本会话逐条核实）：**
- `windowManager.broadcast()`（`window-manager.js:309-316`）逐 `windows` Map 调 `win.webContents.send` ⇒ 只到各 **BrowserWindow** 的 webContents，**不到 webview guest**。
- `src/settings-page.js` 实测**零** `realmAPI` / 零 `ipcRenderer` / 零 `require(`（`grep -c` = **0**），纯 `fetch`；token 来自 `pageParams.get('token')`（`:49`）。
- `realm://` 页面 CSP `style-src 'self'` ⇒ markup 内联 `style="display:none"` 被拦（AGENTS.md 明文）。

**How to avoid:** 每次操作成功后**用响应体回传的最新管理投影就地重渲染**（`set-disabled` / `uninstall` 的响应即投影 ⇒ **零二次请求**）；进入页面时拉一次；确认框走 `.ai-modal-overlay` + CSSOM `display` 切换、初始隐藏走 CSS 类。属性上下文（`title` / `aria-label`）的新插值必须走 DOM API（`textContent` / `setAttribute`）—— `escapeHtml` **不转义引号**（`TD-48-01` 挂账未修），不得扩大缺口。

**Warning signs:** 设置页 Console 里 `window.realmAPI` 为 `undefined`；确认框一进页面就可见（内联 style 被 CSP 拦）。

### Pitfall 8: 未配 provider 时管理区整片空白（D-19）

**What goes wrong:** 新装 Realm + 未配 Key → 打开设置页看到「暂无技能」，而 `~/Library/Application Support/realm/agent-workspace/managed-skills/` 下有两个内置技能目录。属「静默失败」反模式。

**How to avoid:** 读路径加 `ensureSkillsFresh()`（懒建 `sandboxEnv` + 无 Agent 时直接 `refreshSkills`）。**同时**要在管理投影里把「缓存从未刷新过」这个状态表达出来：`refreshedAt === 0` ⇒ **不要**渲染成「没有技能」（UI-SPEC 空态 A 已定稿）。⚠️ UI-SPEC 明确**不**为「未配置供应商」渲染任何常驻提示（修好读路径后正常态与已配置时相同）⇒ 验收面是「无 provider 时列表不为空」，**不是**「多一条提示」。

**Warning signs:** 设置页技能管理区显示「尚无任何技能」而盘上有 `managed-skills/find-skills` / `skill-creator`。

### Pitfall 9: `settings.aiSkills.disabled` 的校验与**两种键形态**

**What goes wrong:** 校验只覆盖 `key === 'aiSkills.disabled'`，但 `/api/settings/update` 的循环是 `configStore.set(\`settings.${key}\`, value)`（`main.js:1391`）—— 手改 URL 提交 `{ "aiSkills": { "disabled": [ … ] } }` 时 `key === 'aiSkills'`，会把**整个 `settings.aiSkills` 对象**覆写掉（顺带绕过只针对点号键的校验）。

**当前代码（`main.js:1372-1392`）**：循环里只有两条分支 `if (key === 'aiBashWhitelist')` 与 `if (key === 'cacheMaxGB')`，其余键一律直写 ⇒ `aiSkills` / `aiSkills.disabled` **今天零校验**。

**How to avoid:** 校验分支**同时覆盖两种键形态**：
- `key === 'aiSkills.disabled'` ⇒ 校验 `value` 本身；
- `key === 'aiSkills'` ⇒ 校验 `value && value.disabled`（并按需拒绝未知子键，避免整体覆写把 `aiSkills` 上的其它未来字段冲掉）。

校验面（OQ-2 已裁决的**安全超集**）= 数组 + 每项为**非空字符串** + 单条 ≤ 64 字符 + 无路径分隔符（`/` `\`）/ 无控制字符 + 条数 ≤ 上限（建议 `MAX_USER_SKILLS + MAX_MANAGED_SKILLS` = 100，**plan 期定数并成文**）。**不得**用 `validateManagedSkillName` 的严格形态（理由见 Open Q2 与 UI-SPEC `:479`）。

**Warning signs:** 手动放进 `skills/My_Skill/` 的技能点开关即 400；或 URL 提交超大数组后禁用名单被污染。

### Pitfall 10: 管理投影的字段名与「第二份实现」诱惑

**What goes wrong:** 把 `bytes` / `fileCount` 并进 `toUISkillEntry`（省一个函数），或在前端重算分组/排序/优先级。

**How to avoid:** 严守 D-13（新投影不扩展 `getSkillsForUI()`）与 D-03（分组排序在主进程）。**把理由写进源码注释**（两个消费者的字段需求不同；`/` 面板 IPC 不应白传 100 条诊断与遍历结果），否则后续很容易以「消除重复」为名合并回去。

### Pitfall 11: 例数账本会因新增用例而转红（**三处必须同批刷**）

`docs/product/ai-skills.md` §七（`:98-99`）/ §11.8（`:538-540`）与 `AGENTS.md:267` 的 `NN 例` 是**机械判据** —— 本会话实跑该命令：`counts-parity ok`，`cells=8`，`measured={"test-manage-skill.js":"55","test-ai-skills.js":"178","test-skill-picker-model.js":"111"}`。

新增测试必然改实测值 ⇒ **必须同批刷三处账本**，且在**最后一个**改动测试的 plan 里执行（否则中途 red）。⚠️ 新增第四个套件（`tests/test-skills-management.js`）时，**counts-parity 命令本身的四处也要同步**：`suites` 数组、`cells < 8` 阈值（现为**恰好 8**，`< 8` 才报错 ⇒ 新套件不加账本单元**不会**触发）、`AGENTS.md` 与 `docs/product/ai-skills.md` 的账本行、以及 `50-VALIDATION.md` 里那条命令副本。

### Pitfall 12: 面板的「已禁用」可见性依赖 digest —— **补播不能替代 digest**

`src/renderer.js:9134` 的 `if (snapshot.digest === state.aiSkillsDigest) return;` 意味着：**任何**广播（含本阶段的补播）在 digest 未变时都不会触发重渲染。⇒ 想让「禁用后 `/` 面板隐藏该技能」生效，**必须**保证 digest 随禁用变化（现状成立，因 `computeDigest` 含 `disabled`）。若日后有人把 `disabled` 从 digest 摘掉，即使补播一百次面板也不会更新。

⚠️ 另有一个**既有边界**（本会话核实）：`refreshSkills` 的 `_cache.skills` 每次刷新是**新建数组 + 新建条目**（`:618-648` 从 SDK 结果重建），所以「离任条目」不会被就地改写；但 `toUISkillEntry` 的投影是**每次调用新造**（`:799-813`）⇒ 不存在跨调用污染。**但** `entry.diagnostics` 是 `_cache` 内的活数组（`:620` `entry.diagnostics = []`）⇒ 管理投影若浅拷 `diagnostics` 数组，前端「展开诊断」若不小心写入就会污染权威快照。**必须深拷**（`slice()` 即可，元素是冻结形状的对象）。

### Pitfall 13: 折叠块 JS 没有可复用模块 —— 第三处宿主只能复用 CSS

**What goes wrong:** 以为可以「复用 48 / 49 已建的折叠块范式（`renderSkillContentBox`）」直接调 —— 但 `renderSkillContentBox` 定义在 `src/renderer.js:8953`（**浏览器脚本、无 `module.exports`、纯 Node 不可 require**），设置页是**另一个** `<script>`（`src/settings-page.js`）⇒ **跨文件不可调用**。

**Why it happens:** 设置页与主窗口 renderer 是分离的脚本上下文（guest 无 preload 桥），共享面只有「双模式导出」的 `src/skill-picker-model.js` 一类模块。

**How to avoid:**
- **CSS 复用**（零新视觉语言）：`.ai-skill-content-box` / `-header` / `-title` / `-chevron` / `-body` + 既有 `.collapsed` 类规则（`main.css:5827-5889`）。
- **JS 侧接受一处小重复**：在 `src/settings-page.js` 内写一个局部展开/折叠辅助（3~5 行），并**把 a11y 契约（`role="button"` + `tabindex="0"` + `aria-expanded` + Enter/Space）与类名双写纪律一并实现**。
- **必须加一条跨文件源码扫描测试**：断言设置页与 renderer 都使用**同一组类名**与**同一组 aria 属性**（否则第三处宿主会静默漂移成第二套折叠控件）。
- **不得**为了消重去改 `src/renderer.js`（UI-SPEC 明文「本阶段不重设计既有面」；48/49 的实名宿主零变化）。

**Warning signs:** 设置页的诊断展开没有键盘入口；或 `.collapsed` 与 `aria-expanded` 在两条路径上分别写（双状态源漂移）。

### Pitfall 14: 启停开关在「重渲染后」丢滚动位置与焦点

**What goes wrong:** `set-disabled` 的响应是**整份新投影** ⇒ 就地重渲染会**重建整棵行 DOM** ⇒ 用户的滚动位置与键盘焦点被重置。这是「一次操作只影响一行」的可见承诺，UI-SPEC 已把它写成契约（`:773`）。

**How to avoid:** 重渲染前后**记录并回写 `.settings-content.scrollTop`**；焦点按 `data-skill-name` 定位到**同一技能行**的开关（找不到则不移动焦点）。卸载成功行已消失 ⇒ 焦点不移动（UI-SPEC `:784`）。

**Warning signs:** 连点两个开关后视图跳回顶部；键盘用户在每次开关后失去位置。

### Pitfall 15: 「未配置 provider」以外的第二条早退（模型缺失）

**What goes wrong:** 只修了 `configuredIds.length === 0` 那条（`:789`），漏了 `未找到模型` 那条（`:893-896`）。

**Why it happens:** 两条 return 都在 `sandboxEnv`（`:899`）之前，形态相同但触发条件不同（前者无 Key、后者有 Key 但 `activeProvider`/`modelId` 解析不出）。

**How to avoid:** `ensureSkillsFresh()` 的判据必须是「**缓存是否已加载过**」（`refreshedAt === 0` 或显式布尔），**不得**按「有没有 provider」判 —— 后者会漏掉第二条早退，也会在 provider 后配置时状态不一致。

**Warning signs:** 配了 Key 但写错模型名 ⇒ 设置页又变空白（同一个 bug 换了触发条件）。

---

## Code Examples

### `readJsonBody` 带「累积中拒收」的体积上限（SEC-09，本会话实测）

> ⚠️ **签名待裁决**（矛盾 1）。下面按**推荐方案 A** 写（三参 + 降级分支）；若裁决为方案 B，则删掉 `res` 参数、把 `sendJson(413)` 换成 `reject(code)`，并把 `sendJson` 幂等护栏降为可选项。

```js
// main.js —— 单源常量（数值只此一份；端点 / 前端零字面量）
const MAX_JSON_BODY_BYTES = 1024 * 1024;                 // 1 MiB 全局默认（D-16）
const MAX_JSON_BODY_BYTES_LARGE = 32 * 1024 * 1024;      // 需大 body 的端点（书签导入）显式覆盖

/**
 * 读取并解析 POST 请求的 JSON body（带体积上限）
 *
 * 超限即**停止累积**并答 413；**不断连**（实测 `req.destroy()` 会让客户端拿 EPIPE
 * 而非 413）。已答 413 后仍会 reject 一个带 code 的错误，外层 handler 的 catch
 * 二次 sendJson 由 sendJson 的幂等护栏吸收。
 *
 * `res` 缺失时**不答响应**、只 reject（降级分支）：漏改调用点时的后果是外层 catch
 * 答 400 + BODY_TOO_LARGE，而不是在 data 监听器里 TypeError ⇒ 主进程退出
 *（全仓无 uncaughtException / unhandledRejection 全局兜底）。
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} [res]
 * @param {{maxBytes?: number}} [options]
 */
function readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {}) {
  const canRespond = !!(res && typeof res.writeHead === 'function');
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let rejected = false;
    const tooLarge = () => {
      rejected = true;
      if (canRespond) {
        sendJson(res, 413, { error: `请求体超过上限（${maxBytes} 字节）`, limit: maxBytes });
        req.resume();                       // 继续丢弃读入 ⇒ 内存 O(1) 且响应可达；**不** destroy / **不** Connection: close
      }
    };
    // 快路径（可选增强）：Content-Length 预检，零字节读取即拒
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      tooLarge();
      reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
      return;
    }
    req.on('data', (chunk) => {
      if (rejected) return;                 // 停止累积（关键：不再拼 body）
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge();
        reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (rejected) return;
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
```

> ⚠️ `Content-Length` 可伪造/缺失，**不得**取代累积中判；两者并存（快路径 + 兜底）。

### 大型端点显式覆盖（Pitfall 3 的修法）

```js
// handleFavoritesApi（main.js:1156-1177 附近）
if (route === 'import-chrome' && req.method === 'POST') {
  const { filePath, content } = await readJsonBody(req, res, { maxBytes: MAX_JSON_BODY_BYTES_LARGE });
  …
}
if (route === 'import-html' && req.method === 'POST') {
  const { filePath, content, mode } = await readJsonBody(req, res, { maxBytes: MAX_JSON_BODY_BYTES_LARGE });
  …
}
```

### D-08 的第十码与「仅 user 可删」判据

见 Pattern 6 的两段完整代码（`MANAGE_SKILL_ERROR` 加码 + `deleteUserSkill` 三态拒绝面）。

### 「仅显式」单源提升（UI-SPEC 硬前置条件）

`仅显式` 的可见文字与其 `title` 今天是 `src/renderer.js:10599` 的**内联字面量**：

```js
      ? '<span class="slash-picker-tag-explicit" title="该技能不进模型提示词，只能手动调用（/skill:名字）">仅显式</span>'
```

设置页是本阶段新增的**第二个消费者** ⇒ 必须提升为 `src/skill-picker-model.js` 的单源冻结表（与 `TIER_BADGE` 同族、同导出面，建议形状 `{ label, title }`），面板侧改为引用同一常量，**渲染结果逐字不变**。**代价（三条既有断言必然转红，必须一并改写，方向各不相同）**：

| # | 断言位置（本会话核实） | 现有断言 | 提升后的必然结果 |
|---|----------------------|----------|-----------------|
| 1 | `tests/test-skill-picker-model.js:1265-1269` | `(panelBody.split('仅显式').length - 1) === 1` | 面板侧改为引用常量后字面量**不再出现在 `panelBody`** ⇒ 计数变 0 ⇒ 红。应改为「断言单源表的值为 `'仅显式'`」+「断言面板侧引用该常量」 |
| 2 | `tests/test-skill-picker-model.js:1270-1274` | title 字面量在 `panelBody` 内恰出现 1 次 | 同上 ⇒ 计数变 0 ⇒ 红 |
| 3 | `tests/test-skill-picker-model.js:1278` | `assert.strictEqual(modelSrc.includes('仅显式'), false, '该文案不与行尾状态标注混放')` | 新单源表**必须**把 `'仅显式'` 写在 `skill-picker-model.js` 里 ⇒ 该断言被**直接证伪**。应改为「断言它在 `STATUS_TEXT` 的值集合里**不存在**」（把「不混放」从**文件级零命中**改为**表级值域隔离** —— 前者在新设计下字面不可满足） |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无体积/文件数（48 D-02 明文「那是 Phase 50 设置页列表的职责」） | 重扫期内递归统计 + 缓存 | 本阶段 | 需明确「含 `SKILL.md`」「排除隐藏文件」「不穿链接」「目录 `size` 不累加」四条口径，并与 UI-SPEC 区说明 ③ 逐字一致 |
| `/api/*` POST body 无上限（`main.js:887-900` 今天即 `body += chunk`） | `readJsonBody(req, res?, { maxBytes })` 默认 1 MiB | 本阶段（SEC-09） | 57 个调用点需逐个评审；两个书签端点必须显式覆盖；`sendJson` 加幂等护栏 |
| 技能集只有 `/` 面板一个消费面 | 新增管理面投影（第二消费面，字段更宽） | 本阶段 | `getSkillsForUI()` 保持收窄（D-13） |
| 设置页只有 AI 记忆 / Bash 白名单 / 视觉模型三块（`src/settings.html:485` / `:507` / `:522`） | 新增「技能管理」区 | 本阶段 | 需在 `src/settings.html:783-785` 引入 `skill-picker-model.js` |
| `MANAGE_SKILL_ERROR` 十键（九码 + `UNKNOWN`） | **十一键**（+ `NOT_USER_OWNED`） | 本阶段（D-08） | `tests/test-manage-skill.js:1589-1621` 的两条 `deepStrictEqual` 必须同批刷新；`MANAGE_SKILL_SHORT_REASON` **保持恰 9 键不动** |
| `STATUS_TEXT` 四键（`shadowed` / `nameClash` / `promptOmitted` / `overLimit`） | 五键（+ `disabled: '已禁用'`） | 本阶段（D-12） | 无计数断言（本会话核实）⇒ 不会打翻既有冻结断言 |

**Deprecated/outdated:**
- `req.on('aborted')`：Node 已标记过时（改用 `'close'` / `req.destroyed`）。本阶段的拒收路径**不需要**任何生命周期事件，别为此引入新监听。
- 把「读完再判长度」当体积防护：实测 40 MB body 吃掉 **+45.7 MB** 堆，且返回 **200** —— 不是防护。

---

## Phase 51 体积上限交接（SEC-09 的数值形状评估）

**问题：** SEC-09 的上限值由本阶段定，Phase 51 要传 zip base64。D-16 的形状（默认 1 MiB + 端点显式覆盖）是否够用？

**PITFALLS P7 已定的解压侧限额（`.planning/research/PITFALLS.md:307`）**：单 entry 解压 ≤ 1 MB（`SKILL.md` 按 64 KB 卡）、**累计**解压 ≤ 32 MB、entry 数 ≤ 2000、压缩比 ≤ 100:1、嵌套深度 ≤ 8。P9 另定网络下载流式上限 ≈ 20 MB（`:378`）。

**推导（base64 over JSON 路线）**：
- 最坏是**近乎不可压缩**的 zip：压缩后大小 ≈ 解压后内容 ⇒ 上界取累计解压上限 **32 MiB = 33,554,432 B**；
- base64 膨胀 `4 × ceil(n/3)` ⇒ 44,739,244 B ≈ **42.67 MiB** 字符串，加 JSON 信封几十字节；
- ⇒ Phase 51 的导入端点应显式声明 **`{ maxBytes: 48 * 1024 * 1024 }`**（50,331,648 B，留 ≈ 12% 余量）。低于 44.74 MiB 会在合法的大技能包上 413。

**结论：形状够用，但有三个前提条件：**
1. **`maxBytes` 必须可覆盖**（D-16 已锁），且覆盖值**在端点处显式书写**（漏写即在 413 处当场可见 —— 这正是该形状的价值）；
2. **推荐 Phase 51 评估「不 base64」的替代**：`fetch(url, { method:'POST', body: file })` + `Content-Type: application/zip` 直传原始字节 ⇒ 上限只需 ≈ 32 MiB 且省掉 33% 传输与整个 base64 字符串的解析峰值。代价是要为二进制流另写一个「流式累加 + 超限即停收」的读取函数（`readJsonBody` 是 JSON 专用）。**但这**不是**本阶段该做的决定** —— 本阶段只需保证 `maxBytes` 面存在且默认 fail-closed。
3. **命名提醒**：`MAX_JSON_BODY_BYTES = 1 MiB` 与 P7 的「单 entry 解压 ≤ 1 MB」是**同一个数字、两个不同的量**。常量名与文档措辞必须能区分（如 `MAX_JSON_BODY_BYTES` vs `MAX_ZIP_ENTRY_BYTES`）。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong | 本会话状态 |
|---|-------|---------|---------------|-----------|
| A1 | [ASSUMED] 40 MB body 实测的堆增长可按线性外推到 Phase 51 的 zip base64 量级 | Pitfall 1 / Phase 51 交接 | 低 —— 量级结论不变；上限值另按 P7 口径推导 | 本会话在 Node v22 复现（+45.7 MB），与旧 session 的 Electron 内 +85 MB 同向 |
| **A2** | [ASSUMED] `SKILL.md` 自身的 `size` 应计入技能 `bytes`（D-13 文只说「全部子项」，按推断计入） | Pattern 1 | 中 —— 用户可能对「64.1 KB vs 64 KiB 上限」困惑；**UI-SPEC 区说明 ③ 已按「含 `SKILL.md`」成文** ⇒ 实现必须与之一致 | **待 plan 期实测一次并成文** |
| **A3** | [ASSUMED] 设置页加载 `skill-picker-model.js` 后在 `realm://` CSP 下的实际表现（该文件确未被设置页加载，本会话核实 `src/settings.html:783-785`） | Pattern 2 / D-12 | 低 —— 该文件零依赖、双模式导出、纯函数（`src/skill-picker-model.js:476-477` 逐字：`if (typeof module !== 'undefined' && module.exports) module.exports = api;` / `if (typeof window !== 'undefined') window.SkillPickerModel = api;`） | **待 plan 期跑一次（`npm run dev` 打开设置页看 `window.SkillPickerModel` 是否存在）** |
| A4 | [ASSUMED] 本会话的 413 探针结论（Node v22.22.0）对 Electron 43.6.0 内的 Node 24.20.0 同样成立 | 矛盾 2 / Pitfall 1 | 中 —— 三条关键结论（无上限=坏、drain=好、destroy=EPIPE）两次 session 一致；唯 `Connection: close` 两侧结论相反 | **建议 plan 期在 Electron 内复跑一次**（并落地为可重跑测试） |
| A5 | [ASSUMED] `/api/skills/*` 统一 400 + `{error, code}` 符合既有 `/api/*` 惯例，且 UI-SPEC 的失败映射表按 `code` 消费 | Pattern 3 | 低 —— UI-SPEC `:464` 已明文「HTTP 状态统一 400」 | 已由 UI-SPEC 锁定 |
| **A6** | [ASSUMED] 管理投影最坏 ~200 KB（100 条 × 描述 ≤1024 字符 + 诊断） | Pattern 2 | 低 —— 仅用于论证「不扩展 `getSkillsForUI()`」；**plan 期验收里实测一次** | **待实测** |
| A7 | [ASSUMED] 「两个设置页实例之间不同步」在真实使用中可接受（D-18 已裁决并成文） | Pitfall 7 | 低 —— 用户已显式接受 | 已锁定 |

**未决的假设项：A2 / A3 / A4 / A6 —— plan 期各补一次实测。**

---

## Open Questions

> CONTEXT 的 OQ-1..5 均已裁决（OQ-1 已落进 D-07，OQ-2/3/4/5 采纳 research 建议并在 CONTEXT 明文「plan 期必须显式实现，不得静默换一个」）。下列是**本会话新发现**或**仍留在 plan 期定数**的项。

1. **`readJsonBody` 的签名与 413 形态（**阻塞级**，见矛盾 1）**
   - **What we know:** D-16 同时要求两参签名 `(req, {maxBytes})`、`sendJson(res, 413)`、`req.resume()` 与「零调用点改动」；而两参形态下函数体内没有 `res`。本会话实测了三种形态的客户端可见性与堆增量。
   - **Recommendation:** **方案 A**（三参 `(req, res, {maxBytes})` + 改全部 57 个调用点 + `res` 缺失时降级为「只 reject」），并保留 `sendJson` 幂等护栏。备选 **方案 B**（两参 + 只 reject + 由既有 13 处 catch 答 400 + `code: BODY_TOO_LARGE`，真正零调用点改动，与 UI-SPEC 兼容）。**plan 期必须择一并成文**，不得静默采用任一侧。

2. **管理面名称谓词的落点与取值域（OQ-2 已定「安全超集」，但落点与数值未定）**
   - **What we know:** 三处消费（`/api/settings/update` 校验、`set-disabled`、`uninstall`）**必须同宽**（UI-SPEC `:479` 明文）；`validateManagedSkillName` 是写入门、**故意更严**，不能用。
   - **Recommendation:** 在 `ai-skills-manager.js` **新增一个导出谓词**（返回 `{ok:true} | {ok:false, code:'invalid_name', reason}`，与 `validateManagedSkillName` 同形以便同样经 `makeManageSkillError` 构造），规则 = 非空字符串 + ≤64 字符 + 无 `/` `\` 与控制字符；**条数上限**建议 `LIMITS.MAX_USER_SKILLS + LIMITS.MAX_MANAGED_SKILLS` = 100（`LIMITS` 只允许加项，故若要新常量需另立，不得改既有五项数值）。**必须在 `docs/product/ai-skills.md` 写明这条故意的不对称**。

3. **设置页的状态链是否含 `nameClash`（见矛盾 3）**
   - **What we know:** `STATUS_TEXT` 今天有 `nameClash`；面板链是 `shadowed > nameClash > promptOmitted > overLimit`；D-12 写的链漏了它并把后两项次序写反；命令表 `SLASH_COMMANDS`（`src/renderer.js:344-347`，仅 `clear` / `compact`）在设置页**拿不到**。
   - **Recommendation:** 设置页口径 = **`disabled > shadowed > overLimit > promptOmitted`，不含 `nameClash`**，并在产品文档明写该维度是 `/` 面板独有。**不得**把 `STATUS_TEXT.nameClash` 删掉或改值（面板仍在用，且有冻结断言）。

4. **`enabled`/`disabled` 与「超数量上限」的交互（`overLimit` 的技能能不能被禁用）**
   - **What we know:** `disabledSet` 是**名字集合**，与 `overLimit` 互不蕴含（`:655-672` 两处独立打标）；`overLimit` 只影响「进不进 prompt」，技能**完全可用**（48 D-12：仍可显式调用）。
   - **Recommendation:** 允许（禁用名单与限额是两个正交维度）；UI-SPEC 的状态优先级链已保证「已禁用」先于「超数量上限」显示。**测试要覆盖**「同时命中 `disabled` + `overLimit`」的行尾只显示「已禁用」。

5. **`limits` 投影是否要包含 `MAX_JSON_BODY_BYTES`**
   - **What we know:** 设置页**不得**写死限额数值；但 1 MiB 的请求体上限与技能域三个端点的载荷无关（UI-SPEC `:471` 已把 `BODY_TOO_LARGE` 写成兜底、文案不含数字）。
   - **Recommendation:** **不进 `limits`**（它是传输层闸，不是技能额度；写进投影反而会诱导前端去核算），但**必须在产品文档的管理面章节写明**「技能域三个端点的载荷远小于 1 MiB，故 413 正常不可达」。

6. **测试文件组织（Claude's Discretion 已给建议，plan 期定稿）**
   - **Recommendation:** **新增独立套件 `tests/test-skills-management.js`**（与 49 的 `test-manage-skill.js` 工具面职责不同，且独立文件才有独立 `# tests` 计数可入账本）+ 三个既有套件的增补。**必测清单见** `50-VALIDATION.md` 的 Per-Task Verification Map 与「Validation Architecture → Phase Requirements → Test Map」。

---

## Environment Availability

| Dependency | Required By | Available | Version（本会话实测） | Fallback |
|------------|------------|-----------|---------------------|----------|
| Node.js（系统） | 跑 `tests/*.js` 单测 + 本研究的探针 | ✓ | **v22.22.0** | — |
| npm | 无（本阶段零安装） | ✓ | 10.9.4 | — |
| Electron（生产运行时） | 真实行为验证（HTTP 拒收 / 沙箱 / digest） | ✓ | **v43.6.0**（内 Node 24.20.0 / Chromium 150.0.7871.250） | 无 —— 凡涉及 Node HTTP 语义的结论**必须在 Electron 内复跑**（本会话的 413 探针只在系统 Node v22 上跑过，见 A4） |
| 沙箱 `ExecutionEnv`（SDK） | 全部文件 IO | ✓ | `@earendil-works/pi-agent-core@0.84.3`（`dist/harness/env/nodejs.js`） | — |
| `electron-store` | 禁用名单持久化 | ✓ | 既有实例（`main.js:112`） | — |
| 本地 HTTP 服务（`realmServer`） | 设置页入口 | ✓ | `main.js:2704` | — |
| `make`（GNU Make 3.81）+ `Makefile` | 打包态人工验收（`make install` / `make install-nightly`） | ✓ | 3.81 | 无（打包态验证不可用 `npm run dev` 替代） |
| `git` | 阶段提交 | ✓ | 2.51.0 | — |
| `skills-builtin/` 源目录（含 `find-skills` / `skill-creator`） | D-19 的「无 provider 时仍列出两个内置技能」验收面 | ✓ | 两目录（本会话 `ls skills-builtin` 实测） | — |
| 外部服务（网络 / DB / 容器运行时） | — | — | — | 本阶段无外部依赖 |
| zip 运行库（Phase 51 需要） | — | ✗（`node_modules/fflate` 本会话实测**不存在**） | — | Phase 51 引入 |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none（zip 库属 Phase 51）

---

## Validation Architecture

`workflow.nyquist_validation: true`（`.planning/config.json`，本会话核实，非 `false`）⇒ 本节必填；`50-VALIDATION.md` 由本节派生。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **`node:test`（Node 内建，零依赖）**；断言用 `node:assert` |
| Config file | **none** —— 无 jest/vitest/pytest 配置；`package.json` 的 `scripts`（本会话实测）**没有 `test` 脚本**（只有 `start` / `dev` / `debug` / `nightly` / `build` / `build:mac` / `postinstall` / `test:pre-release` / `validate` / `test:memory` / `eval:memory`） |
| Quick run command | `node tests/test-manage-skill.js`（manager 级）/ `node tests/test-ai-skills.js`（技能域全量）/ `node --test tests/test-skill-picker-model.js`（纯逻辑）/ `node tests/test-skills-management.js`（新套件） |
| Full suite command | 见下方「Sampling Rate」（**必须逐个具名；`npm test` 不存在**，会被解析成不存在的脚本 —— 本项目两处 gate 恒犯此错） |

⚠️ **既有测试的两种跑法并存，必须照抄各文件既有跑法**：

| 套件 | 跑法 | 依据（本会话核实） |
|------|------|-------------------|
| `test-ai-skills.js` | `node tests/test-ai-skills.js` | 文件内 `const { test, describe } = require('node:test');` + 头注释「用法: node tests/test-ai-skills.js」 |
| `test-manage-skill.js` | `node tests/test-manage-skill.js` | 同款头注释（「node:test，**纯 Node 环境**」） |
| `test-skill-picker-model.js` | `node --test tests/test-skill-picker-model.js` | 既有 counts-parity 命令按**文件名是否含 `picker`** 切换 |

### Validation Dimensions（本阶段的验证维度与证明方式）

> 每一维都要有**可失败**的判据；`WR-12` 的教训是「否命题空集真」（承重判据必须带**正命题**）。

| # | 维度 | 怎么证明 | 归属命令 |
|---|------|----------|----------|
| V1 | **管理投影形状**：三档分组 / 空组剔除 / 组内顺序 = `bySkillPriority` 投影 / 字段齐备 / **无 `content`** / `limits` 齐备 / `refreshedAt` 带出 | 行为单测（造多技能 + 空组场景）+ 与 `getSkillsForUI()` **各一条**「无 `content`」断言 | `node tests/test-skills-management.js`（新增） |
| V2 | **体积与文件数口径**：递归含子目录 / 隐藏文件不计 / 目录 `size` 不计 / **不穿 symlink** / `SKILL.md` 计入 / 空目录与不可读目录的降级 | 行为单测：用 `fs` 在临时根造 `.DS_Store`、嵌套目录、**内部 symlink 环**、外逃 symlink；断言 `bytes` / `fileCount` / 诊断 | 同上 |
| V3 | **尺寸统计在重扫管线内且不进 digest**：只加一个文件、不改 `SKILL.md` ⇒ `digest` **不变**而 `bytes` 变化 | 行为单测；**必须取值副本**（`getSkillsSnapshot()` 的条目是活引用，`refreshSkills` 返回 `_cache` —— 见 Pitfall 6） | 同上 |
| V4 | **`refreshedAt === 0` 不渲染成「无技能」**（D-19 的消费面） | 投影单测（空缓存 ⇒ `refreshedAt: 0` 且 `groups: []`）+ 源码扫描（设置页两个空态分支的判据） | 同上 |
| V5 | **禁用**：名单落盘 + **文件仍在盘上** + 缓存条目 `disabled: true` + `/` 面板投影可被 `filterPickerItems` 跳过 | 行为单测 + `node --test tests/test-skill-picker-model.js`（既有 `s.disabled === true` 过滤逻辑补边界） | 同上 + picker 套件 |
| V6 | **重新启用**：名单移除 + `disabled` 回 false | 同一组行为单测 | 同上 |
| V7 | **写路径次数账**：`syncAgentSystemPrompt()` **恰一次** + 调用侧补播**恰一次** | 复用 `tests/test-ai-skills.js:3219-3247` 的 `promptCtx`（own-property 包装计数 `rescanCalls`）+ `:3398` 的 `captureBroadcasts` / `:3260-3266` 的 `channels` 数组 | `node tests/test-ai-skills.js`（新增用例组） |
| V8 | **忙时补播仍发出**（D-18 的**真实**理由；`isProcessing === true`） | 行为单测：置 `ctx.isProcessing = true` 后调管理写方法 ⇒ `channels` 含 `skills:changed` 恰一次，且 `agent.state.systemPrompt` 未变（忙时只置脏） | 同上 |
| V9 | **仅 user 可卸载的三态拒绝面**：不存在 → `not_found`；同名双存在（user+managed）→ **允许**并提示；仅 managed 存在 → `not_user_owned`；**直接调 manager 函数**（= 「手改 URL 直调端点」）同样拒绝 | 行为单测（**直接调 manager**，不经 handler —— 这是判据 3 的承重点） | `node tests/test-skills-management.js` |
| V10 | **卸载后 `settings.aiSkills.disabled` 同名条目被清理**（D-09 派生不变式 —— 「静默失效」类缺陷，比功能本身更需要测试） | 行为单测：先禁用再卸载 ⇒ 断言名单不含该名；再断言「同名新技能装上后不被静默禁用」 | 同上 |
| V11 | **读盘判据而非缓存快照**：暖缓存 → 从盘删目录 → 调卸载 ⇒ `not_found` | 行为单测（先 `refreshSkills` 暖缓存，再 `fs.rmSync`，再调 `deleteUserSkill`） | 同上 |
| V12 | **两入口转发到同一 manager 函数**（判据 4） | **源码扫描**：`handleSkillsApi` 与三个 IPC handler 均**无判定逻辑**、均调用**同一方法名**；`/api/skills/*` 三个路由名与 `realmServer` 分发分支存在 | 同上 |
| V13 | **token 校验**：无/错 token ⇒ 403 | 源码扫描（`handleSkillsApi` 首行）+ 行为（起真实 `http` server 的一个小 harness） | 同上 |
| V14 | **SEC-09 体积闸**：超限 ⇒ **413 + JSON** 且**堆不随 body 线性增长**；`sendJson` 幂等；**无 unhandledRejection** | 行为单测（真起 `http.createServer` 的小 harness，形同本会话探针；`process.on('unhandledRejection')` 计数断言） | 同上 |
| V15 | **两个书签端点显式覆盖 `maxBytes`**（修正 3 的回归护栏） | 源码扫描（`import-chrome` / `import-html` 两处含 `maxBytes`）+ 行为各一条（大 body 通过、超 32 MiB 拒） | 同上 |
| V16 | **57 个既有调用点在改签名后行为不变**（默认值路径） | 回归：既有全量套件 + Full suite command；**并加一条机械判据**：`grep -c "await readJsonBody(req)" main.js` 与「带 `res` 的调用点数」之差要么为 0，要么恰好等于 plan 记录的降级白名单 | Full suite command |
| V17 | **`/api/settings/update` 对 `aiSkills` / `aiSkills.disabled` 两种键形态都校验**（非数组 / 非字符串项 / 超长 / 路径样串 ⇒ 400 且**不落盘**） | 行为单测（起真实 server，断言响应码 + 断言 `configStore` 未被改） | `node tests/test-skills-management.js` |
| V18 | **`MANAGE_SKILL_ERROR` 十一键 / 十码，值集合逐字** | 改造 `tests/test-manage-skill.js:1589-1621` 的两条 `deepStrictEqual` | `node tests/test-manage-skill.js` |
| V19 | **`STATUS_TEXT.disabled` 存在且值逐字**；且**不**打翻既有 4 键冻结（`assert.ok(table.statusText === ...)` 形式）与 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言 | 新增值断言 + 既有冻结断言保持绿 | `node --test tests/test-skill-picker-model.js` |
| V20 | **「仅显式」单源提升后三条断言改写**（UI-SPEC 硬前置） | 见「Code Examples」表：三条各自改向不同（值断言 / 引用形态断言 / 表级值域隔离） | 同上 |
| V21 | **例数账本一致性**（机械判据，phase gate 必跑） | 本会话实跑：`counts-parity ok`，`cells=8`，实测 `55 / 178 / 111` | 见下方命令 |
| V22 | **禁用后 `/` 面板不可见**（判据 2 的端到端半边） | 单测可证的半边：投影 `disabled: true` + `filterPickerItems` 跳过；**跨进程半边**入 Manual-Only 表 | 同上 + 手动 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| USER-01 | 管理投影：三档分组 / 空组剔除 / 组内顺序 = `bySkillPriority` 投影 / 字段齐备 / **无 `content`** / `limits` 齐备 | unit | `node tests/test-skills-management.js` | ❌ Wave 0 |
| USER-01 | 体积/文件数口径：递归含子目录、**隐藏文件不计**、**目录 `size` 不计**、**不穿 symlink**、`SKILL.md` 计入 | unit | 同上（`fs` 造 `.DS_Store` / 嵌套目录 / 内部 symlink 环 / 外逃 symlink） | ❌ Wave 0 |
| USER-01 | 尺寸统计在**重扫管线内**完成且**不进 digest**：只加文件不改 `SKILL.md` ⇒ digest 不变、bytes 变 | unit | 同上（**取值副本**比较 —— 防 Pitfall 6） | ❌ Wave 0 |
| USER-01 | `refreshedAt === 0`（从未加载）不被渲染成「无技能」 | unit | 同上（断言投影带出 `refreshedAt: 0`）+ 源码扫描（设置页空态分支的判据字段） | ❌ Wave 0 |
| USER-02 | 禁用 → `settings.aiSkills.disabled` 落盘；**文件仍在**；投影 `disabled: true`（面板 `filterPickerItems` 会跳过） | unit | 同上 + `node --test tests/test-skill-picker-model.js` | 部分 ✅ |
| USER-02 | 重新启用 → 恢复：名单移除 + `disabled` 回 false | unit | 同上 | ❌ Wave 0 |
| USER-02/06 | 写路径：`syncAgentSystemPrompt()` **恰一次** + 调用侧**恰一次**广播 | unit（复用 `test-ai-skills.js` 的 `promptCtx` 计数 + `captureBroadcasts`） | `node tests/test-ai-skills.js`（新增用例组） | ✅ 套件存在 |
| USER-02 | **忙时**路径：`isProcessing === true` 时补播仍然发出 | unit | 同上 | ✅ 套件存在 |
| USER-06 | 仅 user 可卸载三态：`not_found` / 同名双存在**允许**并提示 / `not_user_owned`；**直接调 manager 函数**（=「手改 URL 直调端点」）同样拒绝 | unit | `node tests/test-skills-management.js` | ❌ Wave 0 |
| USER-06 | 卸载后 `settings.aiSkills.disabled` 同名条目被清理（D-09 派生不变式） | unit | 同上 | ❌ Wave 0 |
| USER-06 | 读盘判据而非缓存快照（暖缓存 → 盘上删目录 → 调卸载 ⇒ `not_found`） | unit | 同上 | ❌ Wave 0 |
| USER-07 | 两入口转发同一 manager 函数（源码扫描：`handleSkillsApi` 与三个 IPC handler 均无判定逻辑、调用同一方法名） | unit（源码扫描） | 同上 | ❌ Wave 0 |
| USER-07 | token 校验：无/错 token ⇒ 403 | unit（源码扫描 + 小 harness） | 同上 | ❌ Wave 0 |
| SEC-09 | 超限 body ⇒ **413 + JSON**，且**堆不随 body 线性增长** | unit（真起 `http` server 的小 harness，形同本研究探针） | 同上 | ❌ Wave 0 |
| SEC-09 | `sendJson` 幂等：已答 413 后二次调用 no-op，且**无 unhandledRejection** | unit（`process.on('unhandledRejection')` 计数） | 同上 | ❌ Wave 0 |
| SEC-09 | 两个书签端点显式覆盖 `maxBytes`（源码扫描 + 行为各一条） | unit | 同上 | ❌ Wave 0 |
| SEC-09（回归） | 57 个既有调用点在改签名后行为不变（默认值路径）+ 调用点覆盖机械判据 | smoke | `node tests/test-manage-skill.js && node tests/test-ai-skills.js && node --test tests/test-skill-picker-model.js && node tests/test-skills-management.js && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js` | ✅ |
| D-10 | `/api/settings/update` 对 `aiSkills` / `aiSkills.disabled` **两种键形态**都校验（非数组 / 非字符串项 / 超长 / 路径样串 ⇒ 400 且**不落盘**） | unit | `node tests/test-skills-management.js` | ❌ Wave 0 |
| D-08 | `MANAGE_SKILL_ERROR` 十一键、值集合逐字（**改造既有冻结断言**） | unit | `node tests/test-manage-skill.js` | ✅（需改） |
| D-12 | `STATUS_TEXT.disabled` 存在且值逐字；新增键**不**打翻既有 4 键值冻结与 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言（后者是**另一张表**） | unit | `node --test tests/test-skill-picker-model.js` | ✅（需补） |
| D-12/UI-SPEC | 「仅显式」label + title 单源提升后三条断言改写（值 / 引用形态 / 表级值域隔离） | unit | 同上 | ✅（需改 3 处） |
| D-13 | 管理投影**不**携带 `content`（与 `getSkillsForUI()` 各一条断言） | unit | `node tests/test-skills-management.js` | ❌ Wave 0 |
| UI-SPEC | 折叠块第三处宿主与既有两处**同类名 + 同 aria 属性契约**（跨文件源码扫描） | unit（源码扫描） | 同上 | ❌ Wave 0 |
| UI-SPEC | 设置页**零** `innerHTML` / `insertAdjacentHTML` / 字符串模板拼 HTML（注入纪律） | unit（源码扫描） | 同上 | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** 该 task 触及的套件 —— `node tests/test-manage-skill.js`（改 manager）/ `node tests/test-ai-skills.js`（改管线或失效链）/ `node --test tests/test-skill-picker-model.js`（改文案表）/ `node tests/test-skills-management.js`（新套件）
- **Per wave merge:**
  ```
  node tests/test-manage-skill.js && node tests/test-ai-skills.js \
    && node --test tests/test-skill-picker-model.js && node tests/test-skills-management.js \
    && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js
  ```
- **Phase gate:** 全绿 + counts-parity（下方命令）+ `docs/product/ai-skills.md` §七/§11.8 与 `AGENTS.md:267` 三处计数账本同步 + `AGENTS.md:273` 的「九码」措辞按 OQ-3 刷新为「工具侧九条不变 + 管理面 `not_user_owned`」。

### counts-parity（既有机械判据；本会话实跑通过）

```bash
# 例数一致性（来源 docs/product/ai-skills.md:545-...；本会话实跑：ok, cells=8, 55/178/111）
node -e '
const cp=require("child_process"),fs=require("fs");
const suites=["tests/test-manage-skill.js","tests/test-ai-skills.js","tests/test-skill-picker-model.js"];
const meas={};
for(const f of suites){const o=cp.execSync("node "+(f.indexOf("picker")>=0?"--test ":"")+f,{encoding:"utf8",stdio:["ignore","pipe","ignore"]});meas[f.split("/").pop()]=String(o.match(/# tests (\d+)/)[1]);}
const FN=/test-[\w-]+\.js/g;let bad=[],cells=0;
for(const file of ["AGENTS.md","docs/product/ai-skills.md"]){const hit={};fs.readFileSync(file,"utf8").split("\n").forEach((line,ln)=>{const idx=[];FN.lastIndex=0;let m;while((m=FN.exec(line)))idx.push([m.index,m[0]]);for(let i=0;i<idx.length;i++){const base=idx[i][1];if(!(base in meas))continue;const end=i+1<idx.length?idx[i+1][0]:line.length;const uniq=[...new Set([...line.slice(idx[i][0],end).matchAll(/(\d+)\s*例/g)].map(x=>x[1]))];if(!uniq.length)continue;cells++;hit[base]=(hit[base]||0)+1;if(uniq.length!==1||uniq[0]!==meas[base])bad.push(file+":"+(ln+1)+" "+base+" 账本单元取到 ["+uniq.join("/")+"] ≠ 实测 "+meas[base]);}});for(const base of Object.keys(meas))if(!hit[base])bad.push(file+" 的账本未覆盖 "+base);}
if(cells<8)bad.push("账本单元数 "+cells+" < 8（§七 两条 + §11.8 三条 + AGENTS.md 测试行三条）");
if(bad.length)throw new Error("例数不一致: "+bad.join("; "));
console.log("counts-parity ok");console.log("cells="+cells+" measured="+JSON.stringify(meas));
'
```

⚠️ 本会话实测基线：`cells=**8**`、`measured={"test-manage-skill.js":"55","test-ai-skills.js":"178","test-skill-picker-model.js":"111"}`。**账本单元分布**：`docs/product/ai-skills.md` §七（`:98` test-ai-skills 178、`:99` test-manage-skill 55 —— §七**不含** picker 的例数）+ §11.8（`:538` 55、`:539` 178、`:540` 111）+ `AGENTS.md:267`（111、55、178）。

⚠️ 若新增独立套件 `tests/test-skills-management.js`，**四处必须同批扩**：① 本命令的 `suites` 数组；② `AGENTS.md:267` 的测试行；③ `docs/product/ai-skills.md` §七/§11.8 的账本行；④ `50-VALIDATION.md` 里那条命令副本。**注意**：`if(cells<8)` 是 `<` 而非 `!==`，所以**漏加**新套件的账本单元**不会**自动报错（只会少一个好单元）—— 这是该判据的已知弱点，**plan 期要主动补账本单元**，不要依赖它报错。

### Wave 0 Gaps

- [ ] `tests/test-skills-management.js` —— 覆盖上表所有 ❌ 行（管理投影 / 尺寸口径 / 启停 / 卸载三态 / 名单清理 / `readJsonBody` 上限与幂等 / settings 双键校验 / 双入口源码扫描 / 注入纪律源码扫描）。**独立成文件**：与 `test-manage-skill.js`（49 的工具面）职责不同，且独立文件才有独立 `# tests` 计数可入账本。
- [ ] `tests/test-ai-skills.js` 新增用例组（写路径次数账 + **忙时补播**），复用既有 `promptCtx`（`:3219-3247`）/ `captureBroadcasts`（`:3398`）harness。⚠️ 该类测试的 fake `configStore` 目前只有 `get`（`:3233`），**必须补 `set`** 才能测管理写路径。
- [ ] `tests/test-manage-skill.js` 改造 `:1589-1621` 的两条 `deepStrictEqual` 冻结断言（十键 → 十一键 / 九码值集合 → 十码值集合）；并处理 `:1588` 的 describe 标题（「本计划不增不减不改名」）。
- [ ] `tests/test-skill-picker-model.js` 补 `STATUS_TEXT.disabled` 值断言（**不要**改 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言）；按 UI-SPEC 改写 `:1265-1269` / `:1270-1274` / `:1278` 三条断言。
- [ ] counts-parity：四处同步（见上）。
- [ ] Framework install：**none**（`node:test` 内建）。

### Manual-Only（如实挂账，不可自动化）

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 100 条技能时设置页的滚动 / 密度 / 诊断展开；卸载确认框居中与焦点 | USER-01 / USER-02 | 真实渲染观感与 `realm://` CSP 下的 div 遮罩行为无法在 `node:test` 中复核 | `npm run dev` → `realm://settings` → AI 分区技能管理区；注入 100 个技能目录后滚动与展开诊断；点卸载看确认框是否居中、Esc/Tab 焦点是否受控。**承重判据必须带正命题**（`WR-12` 的教训：否命题空集真） |
| 设置页禁用 → `/` 面板消失 → 重新启用恢复 | USER-02 | 跨进程（设置页 guest ↔ 主窗口 renderer）端到端 | 设置页禁用一个技能 → 主窗口 `/` 面板确认该技能消失；重新启用 → 恢复。⚠️ 注意 `src/renderer.js:9134` 的 digest 早退（Pitfall 12） |
| 卸载 user 技能后目录消失 | USER-06 | 真实文件系统副作用 | 卸载 `skills/<name>` → 确认 `agent-workspace/skills/<name>/` 不存在 |
| **未配置 provider 时**设置页仍能看到两个内置技能 | USER-01 | D-19 的验收面（无 Agent ⇒ 无技能缓存）；**这条正是判据 1 在无 provider 用户处的整体成立条件** | 清空 AI 供应商 → 打开设置页技能管理区 → 应列出 `find-skills` 与 `skill-creator`（源目录 `skills-builtin/` 下确为这两条） |
| 打包态列出内置技能 | USER-01 | `asarUnpack` + `app.isPackaged` 路径分支只在正式/`make install` 产物上生效（`builtin-skills-seeder.js:60` 的 `resolveBuiltinSkillsSrc()`） | `make install` 后启动 .app → 设置页技能区列出内置技能 |
| 413 的客户端可见形态 | SEC-09 | 本会话的探针跑在系统 Node v22；Electron 43.6.0 内的 Node 24 需复跑（A4） | 在 Electron 内起同一 harness，断言「413 + JSON + 堆不线性增长 + 无 unhandledRejection」 |

---

## Security Domain

`security_enforcement: true` / `security_asvs_level: 1` / `security_block_on: high`（`.planning/config.json`，本会话核实）。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **no** | 本地 HTTP 无用户认证概念；`REALM_TOKEN`（`main.js:104`，`crypto.randomUUID()`，每进程随机）是**能力令牌**而非认证凭据 |
| V3 Session Management | **no** | 同上；token 经 URL 查询参数传递（既有全站惯例，非本阶段新增面） |
| V4 Access Control | **yes** | ① 每个 `/api/*` 入口首行 `token !== REALM_TOKEN → 403`（`main.js:1338` 范式，`handleSkillsApi` 照抄）；② **卸载的「仅 user 属主」判据必须服务端强制**（判据 3 明文「手改 URL 直接调端点也不例外」）—— 落 `ai-skills-manager` 而非 handler；③ IPC 侧 `assertTrustedSender`（`ipc-handlers.js:113-122`，拒 webview guest / DevTools / 非受管窗口） |
| V5 Input Validation | **yes** | ① `readJsonBody` 体积上限（SEC-09）；② `settings.aiSkills.disabled` 服务端校验（D-10，**两种键形态**）；③ 技能名走**新的安全超集谓词**（OQ-2；`validateManagedSkillName` 太严，`skills/My_Skill/` 会被误伤）；④ 路径恒由 `path.join` 计算，handler / 工具**不吃 `path`** |
| V6 Cryptography | **no** | 本阶段不引入加密，不 hand-roll 任何密码学 |
| V7 Error Handling & Logging | **yes** | 拒绝必须给 `{ error, code }`（不静默，SKILL-06 / PITFALLS P12）；主进程 `console.error` 留痕；**不得**回显被拒内容原文（49 既有口径）；拒收路径必须**无 unhandledRejection / uncaughtException**（Pitfall 2；全仓无全局兜底） |
| V12 File Upload / V13 API | **yes** | 请求体上限属本条；REST 子路由让「哪个端点做什么」可枚举（D-15） |

### Known Threat Patterns for Electron + 本地 HTTP + 技能目录

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **资源耗尽：超大请求体（zip base64 放大）** | Denial of Service | 累积中判 + 立即停收 + 413（Pitfall 1，本会话实测）；`Content-Length` 预检作快路径（可选）；数值单源 fail-closed |
| **拒收路径本身崩掉主进程** | Denial of Service | `sendJson` 幂等护栏 + `readJsonBody` 的 `res` 缺失降级分支（Pitfall 2，本会话实测：无护栏 ⇒ unhandledRejection ⇒ 无全局兜底 ⇒ 退出） |
| **手改 URL 直调端点删内置技能** | Elevation of Privilege | 服务端读盘判据（`env.fileInfo` 判 `kind === 'directory'`）**独立于**前端不渲染按钮（D-07 两层） |
| **路径穿越（技能名含 `../` 或分隔符）** | Tampering | 管理面名称谓词（拒 `/` `\` 与控制字符）+ `path.join` + 沙箱 `resolveInside` 双基准（`agent-workspace.js:162-192`）；**判据不依赖前端** |
| **sandbox 逃逸（技能目录内符号链接指向工作区外）** | Information Disclosure | 沙箱 `resolveInside` 的 realpath 复核（`:182-191`）拒外逃链接；**本阶段不新增任何绕过沙箱的 `fs` 调用**（尺寸遍历必须走 `env`） |
| **无限递归（内部符号链接环）** | Denial of Service | 显式跳过 `kind === 'symlink'` + depth 上限 16（Pitfall 4 / OQ-4） |
| **统计遍历被超大目录树拖死** | Denial of Service | entries 上限 5000（OQ-4）；超限**截断 + warning 诊断**、不拒绝加载 |
| **CSRF / localhost 端口扫描** | Spoofing / Info Disclosure | `REALM_TOKEN` 逐端点校验（既有）；令牌经 URL 参数（同源页面可读），非本阶段新增面 |
| **配置污染（禁用名单写入非字符串 / 超大数组 / 路径样串）** | Tampering | D-10 服务端校验（**两种键形态都覆盖**，Pitfall 9） |
| **不完整保护造成的虚假安全感** | — | 与 bash 白名单同理：本阶段的「仅 user 可删」是**判据**而非能力边界 —— 用户仍可经 Finder / 终端删 `managed-skills/`（`docs/product/ai-skills.md` §11.6 已挂账同族口径），产品文档必须如实标注 |
| **失实文案（把「不是你的」说成「不存在」）** | Repudiation | D-08 的独立错误码 + 前端按 `code` 给文案（**不解析 `message`**） |
| **属性上下文注入（技能名含引号）** | Tampering | `TD-48-01` **仍开**（`escapeHtml` 只转义 `& < >`、不转义引号）；本阶段**不扩大缺口**：新增插值一律走 DOM API（`textContent` / `setAttribute`），**禁止** `innerHTML` / 字符串模板拼 HTML（UI-SPEC 注入纪律 + 源码扫描测试） |

---

## Blockers

> 依「报告阻塞而非猜测」的要求，以下为需要**在 plan 期显式裁决**（或在 Electron 内补测）的项；**没有任何一项使研究无法完成**，但 **B1 必须在实现前裁决**。

| # | Blocker | 证据 | 解锁条件 |
|---|---------|------|----------|
| **B1** | **D-16 的签名与 413 实现形态自相矛盾**（CONTEXT 同时要求两参 `(req, {maxBytes})`、函数体内 `sendJson(res, 413)`、以及「零调用点改动」） | `50-CONTEXT.md:84-88` 的标题与三条 bullet 互斥；`main.js:887-900` 的两参形态下无 `res`；`main.js:877-880` 的 `sendJson` 无法从 `req` 反查 `res` | **plan 期在方案 A / B / C 中择一并成文**（见矛盾 1 的对照表；本研推荐 A + `res` 缺失降级分支）。在此之前不要动 `readJsonBody` |
| **B2**（非阻塞 · 复现性债） | 「`Connection: close` ⇒ 客户端 EPIPE」**本会话不可复现**（`fetch` 与 `http.request` 两种客户端都拿到了 413） | 本会话实测表（矛盾 2）；旧结论见 `50-RESEARCH.md`（旧版）`:611` | 不需要解锁：实现照「不 `destroy`、不设 `Connection: close`、用 `req.resume()`」，但**不得**把「设了就 EPIPE」写进产品文档 / 注释 |
| **B3**（非阻塞 · 待补实测） | 本会话的 413 探针**未在 Electron 内复跑**（系统 Node v22.22.0 vs 运行时 Node 24.20.0） | AGENTS.md 的「升版/环境差异须复核」纪律；A4 | plan 期把 `readJsonBody` 的拒收探针**在 Electron 内跑一次**并落地为 `tests/test-skills-management.js` 的可重跑用例 |
| **B4**（非阻塞 · 待补实测） | 设置页加载 `skill-picker-model.js` 在 `realm://` CSP 下的实际表现**未跑过**（该文件确未被设置页加载） | `src/settings.html:783-785`（无该 `<script>`）；`src/skill-picker-model.js:476-477` 的双模式导出 | plan 期 `npm run dev` 打开设置页断言 `window.SkillPickerModel` 存在；同时补一条源码扫描断言（`settings.html` 含该 `<script>`） |
| **B5**（非阻塞 · 决策落点） | 「管理面名称谓词」是**新增导出**还是散落实现，CONTEXT 未指定落点（OQ-2 只定了**宽严**） | OQ-2 原文（`50-CONTEXT.md:117`）；`/api/settings/update` 校验在 `main.js:1375-1392`、`set-disabled`/`uninstall` 在 manager 层 ⇒ 两处需要**同一份**谓词 | plan 期定为 `ai-skills-manager.js` 的**新增导出谓词**（单源、纯 Node 可测），并让 `main.js` 直接 require 它（该模块零 electron 依赖，`AGENTS.md:273` 硬约束 ① 已为该用法背书） |

---

## Sources

### Primary（HIGH confidence —— 本会话直读当前树 / 本机实测）

**1. 运行时探针（本会话，系统 Node **v22.22.0**，`fetch` 客户端）**

| 探针 | 结论 |
|------|------|
| `readJsonBody` 无上限（40 MiB body） | **200**，堆 **+45.7 MB** |
| `sendJson(413)` + `req.resume()` | **413 + JSON**，堆 ≈ **0** |
| `sendJson(413)` + `req.destroy()` | 客户端 **EPIPE** |
| `sendJson(413)` + `Connection: close` + `req.resume()` | **413 + JSON**（与旧结论相反，见矛盾 2） |
| 无幂等护栏的二次 `sendJson` | **`unhandledRejection` 1 次**（`Cannot write headers after they are sent to the client`），客户端仍拿 413 |
| 有幂等护栏的二次 `sendJson` | **`unhandledRejection` 0 次**，客户端 413 + JSON |
| `counts-parity`（既有机械判据） | **ok**，`cells=8`，`55 / 178 / 111` |
| 环境探针 | `node v22.22.0` / `npm 10.9.4` / `git 2.51.0` / `node_modules/.bin/electron --version` → **v43.6.0** / `GNU Make 3.81` / `Makefile` 存在 / `node_modules/fflate` **不存在** / `skills-builtin/` = `find-skills` + `skill-creator` |

> ⚠️ **可复现性声明**：探针脚本是**会话级内联命令**（未落盘），结论已逐条写进 Pitfall / 矛盾正文（含数字与形态）。plan 期若要重跑，按正文的对照表重建即可（每个探针都是「起一个 `http.createServer` → 打印状态码 / 堆增量 / `unhandledRejection` 计数」或「本机命令探测」）。参照 49 的同类债（`IN-16` / `WR-09`：真实门禁只活在 `/tmp/uat49/`、结论不可重跑复核）—— **本阶段若要产出承重判据，应把驱动写进 `tests/` 并带正命题**。

**2. 源码（本会话读取；行号为本次读取时位置，执行前可能漂移）**

- `ai-skills-manager.js`（全 1687 行）—— `LIMITS:48-54`、`MAX_SKILL_NAME_CHARS:62`、`MANAGED_SKILL_NAME_RE:65`、`getAgentWorkspaceLazy:126-128`、`EMPTY_CACHE:131-138`、`_cache:159`、`hashString:162-168`、`computeDigest:189-202`、`createSkillsEnv:232-277`（`isScanRoot:235-236`、listDir 收窄 `:241-251`）、`inContractLayout:294-296`、`pushEntryDiag:334-351`、`toRealmDiag:353-371`、`pushError:373-394`、`isDescriptionUnusable:396-419`、`enforceDirNameAuthority:421-449`、`applyShadowing:451-472`、`bySkillPriority:494-504`、`refreshSkills:538-730`（④ `:648`、⑤ `:655-658`、⑥ `:660-672`、⑦ `:674-716`、`digest:715`、`refreshedAt:716`、catch 回滚 `:717-728`、`return _cache:729`）、`buildSkillsPrompt:741-743`、`getSkillsSnapshot:752-759`、`sourceTierOf:776-780`、`toUISkillEntry:799-813`、`matchSkillByPath:826-841`、`getSkillsForUI:853-859`、`readSkillForInvocation:894-…`、`MANAGE_SKILL_ERROR:966-977`、`makeManageSkillError:991-996`、`isSeededName:1008-1011`、`validateManagedSkillName:1034-1063`、`validateManagedSkillDescription:1077-…`、`sanitizeSkillDescription:1150-…`、`sandboxErrorCode:1248-1272`、`atomicWriteSkillFile:1274-…`、`managedSkillPaths:1317-1321`、`countManagedSkills:1335-1343`（`listDir` entry 形状注释 `:1338`）、`resolveManagedTarget:1367-1399`、`createManagedSkill:1422-…`、`updateManagedSkill:1539-…`、`deleteManagedSkill:1603-1623`（`remove({recursive:true})` `:1614`）、`getSkillPromptIncluded:1651-1656`、`module.exports:1663-1687`
- `agent-workspace.js`（全 391 行）—— `getSkillsDir:102-104`、`getManagedSkillsDir:113-115`、`ensureWorkspaceDir:120-126`、`resolveInside:162-192`、`createSandboxEnv:205-…`（cwd `:207`）、`fileInfo:286-290`、`listDir:292-296`、`exists:309-313`、`remove:321-325`
- `ai-manager.js` —— `windowManager` 顶层 require `:25`、惰性 helpers `:94` / `:106` / `:119` / `:133`、`init:777`（configStore 注入 `:778`、**无 provider 早退 `:789-793`**、**无模型早退 `:893-896`**、`sandboxEnv:899`、**首次 refreshSkills `:903-909`**、`_skillsPromptDigest:940`）、`getSeededSkillNamesSafe:1565-1573`、`getSkillsForUI:1583-1585`、`_skillTierByLocation:1594-1597`、`syncAgentSystemPrompt:3026-3054`（守卫 `:3027`、重扫 `:3030-3036`、**忙时置脏早退 `:3038-3041`**、**早退 `:3046`**、摘要 + 改写 `:3049-3050`、广播 `:3053`）、`refreshSkillsForPanel:3072-3075`、`_flushDeferredSkillsPrompt:3100-3114`、`_recreateAgent:3121-3178`（重扫 `:3146-3152`、digest `:3171`）、`manage_skill` 的 sync 恰一次 `:6254`
- `main.js` —— `REALM_TOKEN:104`、`configStore:112`、`builtinSkillsSeeder` require `:140`、`let aiManager:169`、`sendJson:877-880`、`readJsonBody:887-900`、`handleHistoryApi:908`、`handleFavoritesApi:976`（**import-chrome `:1157`**、**import-html `:1177`**）、`handleSettingsApi:1336`（token `:1338`、route `:1344`、**update 循环 `:1372-1392`**（`readJsonBody:1373`、`aiBashWhitelist:1376-1382`、`cacheMaxGB:1384-1390`、`configStore.set('settings.'+key)`:1391）、`settings:updated` 广播 `:1395`）、`handleAiMemoryApi:2649-2701`、`realmServer:2704`（`/api/ai-memory` 分发 `:2757-2760`、**内联 `/api/bookmarks-bar/toggle:2818-2835`**）、`assertTrustedSender:3371-3377`、启动顺序 `:4040-4051`（`seedBuiltinSkills():4048`、`new AIManager():4051`）
- `ipc-handlers.js` —— `let aiManager:40`、`assertTrustedSender:113-122`、`ai:get-skills:1747-1753`（`:1743` 明文「**不得**走 `/api/skills/*`（主窗口 `file://` 不能 fetch 本地 HTTP —— Phase 38 事故）」）、`ai:refresh-skills:1763-1769`、`setAIManager:2874`、`module.exports:2927`
- `window-manager.js` —— `broadcast:309-316`
- `src/skill-picker-model.js` —— `filterPickerItems`（跳过 `s.disabled === true`）`~214-236`、`STATUS_TEXT:239-244`、`PROMPT_OMITTED_CARD_NOTE:269`、面板状态链 `:299-311`、`TIER_BADGE:349-365`、`MANAGE_SKILL_ACTION_LABEL:379-383`、`MANAGE_SKILL_ACTION_NAME:392-396`、`MANAGE_SKILL_SHORT_REASON:408-418`、`mergeManageSkillMarker:450-454`、`api:456-474`、双模式导出 `:476-477`
- `src/renderer.js` —— `aiSkillsDigest:292`、`SLASH_COMMANDS:344-347`、`skills:changed` 监听 `:4405-4407`、`renderSkillContentBox:8953`、`pullAiSkillsSnapshot:9129-9142`（**digest 早退 `:9134`**）、「仅显式」`title` 内联字面量 `:10599`、`buildPickerItems` 调用点 `:10557`、`formatFileSize:11317`
- `src/settings.html` —— AI 记忆区 `:485-505`、**AI Bash 白名单区 `:506-520`（D-01 插入位置参照 + `.settings-group` 范式）**、视觉模型区 `:522-531`、AI 区结束 `:532`、既有 `.ai-modal-overlay` `:371` / `:402`、`<script>` 列表 `:783-785`（**无 `skill-picker-model.js`**）
- `src/settings-page.js` —— `state.aiBashWhitelist:41`、`apiToken:49`、`aiMemoryApi:172-186`、白名单即改即存链 `:2839-2900`、`renderAiBashWhitelistTags:2907`、`setAiMemoryHint:3878-3888`、`resetAiMemoryHint:3890-3897`；**实测零 `realmAPI` / 零 `ipcRenderer` / 零 `require(`**
- `src/preload.js` —— `onIpcMessage:724-726`（泛型透传，无 channel 白名单）、`getSkills:1033`、`refreshSkills:1040`、`:1030-1031` 的 CORS 事故注释
- `src/favorites-page.js` —— `pickBookmarkFile:2235-2259`（`file.text():2245`）、`startChromeImport:2294-…`（`import-chrome:2299`）、`startHtmlImport:2332-…`（`import-html:2335`）、确认导入 `:2445`（`import-html` 第二次）
- `builtin-skills-seeder.js` —— `resolveBuiltinSkillsSrc:60`、`getSeededSkillNames:92-110`、`seedBuiltinSkills:422`、`module.exports:539-550`
- `node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js` —— `fileKindFromStats:43-51`、`fileInfoFromStats:52-63`、`fileInfo:538-546`（**`lstat`**）、`listDir:547-574`（**`readdir withFileTypes` + 逐项 `lstat`**；内层失败 `return err`）、`canonicalPath:575-583`、`exists:584-591`、`createDir:592-600`、`remove:602-611`（**`recursive ?? false`**）；包版本 `0.84.3`
- `tests/test-manage-skill.js` —— `:1588-1622`（**十键冻结断言**：键集合 + 值集合两条 `deepStrictEqual`）、`:1624-1639`（「不新立第十码」用例，只需成员校验）
- `tests/test-skill-picker-model.js` —— `:897`（`TIER_BADGE` 三键）、`:929`（动作标题三键）、`:942-946`（**`MANAGE_SKILL_SHORT_REASON` 恰 9 键**）、`:961-979`、`:984`（引用形态正则）、`:993-1012`（投影形态）、`:1024-1026`（≤4 字）、`:1029-1041`（**`STATUS_TEXT` 四键逐字冻结；无键数断言**）、`:1043-1057`（九码长度上限）、`:1262-1279`（**「仅显式」三条断言**）
- `tests/test-ai-skills.js` —— `:1239-1269`（广播行为）、`:1299-1306`（方法体源码形态）、`:2276-2295`、`:2299-2303`、`:2503-2505`（renderer 监听）、`:3219-3247`（`promptCtx` 夹具，含 `rescanCalls` 计数包装）、`:3282-3296`（`channels` + `rescanCalls === 2`）、`:3398`（`captureBroadcasts`）
- `docs/product/ai-skills.md` —— 章节表（`## 一:32` … `## 十一:433`）；§七 `:96-107`（含 `:98` 178 例 / `:99` 55 例）；**§11.3 `:457-483`（「九条拒绝原因 / **不新增第十码**」）**；§11.5 `:496-511`（净化 + 复验非空）；§11.6 `:513-519`（三条诚实边界）；§11.7 `:521-532`（可见性与时序）；§11.8 `:534-543`（例数账本三条）；`:545-…`（counts-parity 可重跑命令）
- `AGENTS.md` —— `:267`（**测试清单行**：含 111 / 55 / 178 与「九码长度上限」）、`:272`（技能发现与调用维护约定）、`:273`（**AI 自建技能维护约定**：四条硬约束，含「Phase 50/51 **直接 require 同一份**，不得另写第二份」与「三处计数必须一起刷」）
- `.planning/config.json` —— `workflow.nyquist_validation: true`、`security_enforcement: true`、`security_asvs_level: 1`、`security_block_on: high`、`ui_phase: true`、`commit_docs: true`、`parallelization: true`、`mode: "yolo"`
- `.planning/ROADMAP.md` —— Phase 50 全文（Goal / Depends on / 5 条 Success Criteria / `UI hint: yes` / Security gate / Doc sync）、Phase 49 的 Security gate 行（「本阶段产出的校验器是 50 / 51 唯一可复用的那一份」）
- `.planning/REQUIREMENTS.md` —— `:51-58`（USER-01..08，USER-01 `:51` / USER-06 `:56` / USER-07 `:57`）、`:78`（SEC-09）
- `.planning/STATE.md` —— `:287`（O3 `allowed-tools` 解析半边归 51）、`:290`（O7 三条限额数值已在 46 落定，**50 只渲染不重定义**）、`:292`（⚠️ `syncAgentSystemPrompt()` 生产调用方：49 闭合 1/3，**50 → 2/3**，51 收口）、`:295-296`（TD-48-01 / TD-48-02 仍开）、`:298` / `:389-390`（49 收尾带出的守卫强度债与可复现性债）
- `package.json` —— `scripts` 无 `test`（实测）
- `.planning/phases/50-api-skills/50-CONTEXT.md` / `50-UI-SPEC.md` / `50-VALIDATION.md`
- `.planning/research/PITFALLS.md` —— P3（description 注入通道）、P7（资源耗尽四入口与限额）、P8（失效链触发点）、P12（静默失败）
- `.planning/phases/46-prompt/46-CONTEXT.md`（D-06/D-07/D-08/D-09/D-11）、`47-bash/47-CONTEXT.md`（D-10/D-11）、`48-skill-name/48-CONTEXT.md`（D-02/D-10/D-11/D-12/D-14/D-17）、`49-manage-skill-ai/49-CONTEXT.md`（D-01/D-06/D-07/D-11/D-12/D-13）

### Secondary（MEDIUM confidence）

- 旧版 `50-RESEARCH.md`（同日、D-16/D-18/D-19 改写**之前**）—— 其 Electron 内探针记录（Node 24.20.0）与部分源码行号；**凡与本文件冲突者以本文件为准**（本会话在**当前树**上重读/重跑）
- UI-SPEC 引用的 `src/styles/main.css` 行号（`:3195` / `:5098` / `:5350` / `:5827` / `:7236` / `:7269` / `:8721` / `:10455` 等）—— 本会话只抽查核实了 `.ai-skill-content-box` 家族（`main.css:5827-5889`）、`--skill-limit-text:29` / `--skill-error-text:33`（暗）/ `:61` / `:63`（亮），其余行号**未逐条复核**（它们只服务 UI 落点，不影响架构结论）

### Tertiary（LOW confidence）

- `ListDir` 返回的**具体字节值**（例如目录 `size` 历史记录为 96、`.DS_Store` 为 500）—— 旧 session 的运行时观测值，**本会话未复跑**；但**实现不依赖这些数值**（目录 `size` 一律不累加、点文件一律跳过），仅用于说明「目录 `size` 非 0」与「点文件确实会进列表」两个**结构性**事实（这两个事实由本会话直读 SDK 源码 `nodejs.js:43-63` / `:553` 支撑）

---

## Metadata

**Confidence breakdown:**
- **Standard Stack: HIGH** —— 本阶段零新依赖；全部复用点的签名 / 返回形状都由本会话在当前树上直读或 SDK 源码直读确认（`nodejs.js` 的 `kind` / `size` / `lstat` / `recursive ?? false` 四条已逐字核实）。
- **Architecture: HIGH** —— 数据流（设置页 guest → HTTP → manager；主窗口 → IPC → manager；写路径 → configStore → refreshSkills → digest → prompt → 广播 → renderer）逐段读过源码；D-18 / D-19 的事实依据在**当前树**上逐行核实。
- **Pitfalls: HIGH（多数）** —— Pitfall 1 / 2 由本会话的 Node v22 探针直接证明（含客户端可见形态与堆/未捕获拒绝计数）；Pitfall 3 / 4 / 5 / 6 / 7 / 8 / 9 / 12 / 13 / 14 / 15 由源码直读证明；Pitfall 2 的**致命性**由「全仓无 `uncaughtException` / `unhandledRejection` 兜底」+ Node 默认语义推出。
- **未覆盖 / 依赖 plan 期实测的四点**：A2（`SKILL.md` 是否计入 `bytes`，需与 UI-SPEC 文案对齐）、A3（设置页 CSP 下加载 `skill-picker-model.js`）、A4（413 探针在 Electron 内复跑）、A6（100 条技能时管理投影字节数与渲染耗时）。
- **明确未做**：本会话**未运行** `npm run dev` / `make install`（无 GUI / 打包验证）；**未读** `50-UI-SPEC.md` 的色彩核算整节（只读了与后端契约相关的行）—— UI-SPEC 已 approved 且被本文件视为锁定契约。

**Research date:** 2026-09-14（重研；覆盖同日旧版）
**Valid until:** 2026-10-14（30 天）—— 本阶段的结论依赖**仓库内文件的行号与 Electron/SDK 版本**；若期间升级 `@earendil-works/pi-agent-core`（当前 **0.84.3**）或 Electron（当前 **43.6.0**），Pitfall 1/2（`http` 语义）与 Pattern 1（`FileInfo` 形状）需按 AGENTS.md 的「升版须复核」纪律重跑探针。

*Phase: 50-设置页技能管理区 + `/api/skills/*`*
*Research re-run: 2026-09-14*


# Phase 50: 设置页技能管理区 + `/api/skills/*` - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付**技能集的用户管理面**：设置页 AI 分区新增「技能管理」区，逐条列出全部技能的**名称 / 描述 / 来源 / 体积 / 文件数 / 诊断**，并支持**启用 / 禁用 / 卸载（仅 `source === 'user'`）**；后端新增 `/api/skills/*` HTTP 端点（供 `realm://settings` guest）+ 主窗口 IPC，两入口转发到**同一份** manager 函数；同时给 `readJsonBody` 加请求体体积上限（SEC-09）。

具体交付：

1. **管理投影**：`ai-skills-manager.js` 新增管理面投影（含来源档位 / 体积 / 文件数 / 诊断 / 状态字段 + 按来源分组），**不携带 `SKILL.md` 正文**。
2. **启停**：写 `settings.aiSkills.disabled`（46 D-09 既定键），加载后过滤、不删文件；禁用后不进 system prompt 与 `/` 列表（48 D-10）。
3. **卸载**：递归删 `agent-workspace/skills/<name>/`；**仅 `source === 'user'`** 允许，其余来源（含手改 URL 直调端点）一律拒绝。
4. **两个前端入口**：`/api/skills/*`（guest，token 鉴权）与主窗口 `realmAPI` IPC（`assertTrustedSender`），共用同一 manager 函数。
5. **写路径收口**：写成功后调 `syncAgentSystemPrompt()`（一次）+ 调用侧无条件补 `skills:changed` 广播（P8 失效链的 50 号那份）。
6. **SEC-09**：`readJsonBody` 加体积上限，超限立即拒收不继续累积。
7. **文档**：`docs/product/ai-skills.md` 新增管理面章节；`AGENTS.md` 维护约定与测试清单同步。

**Requirements**: USER-01, USER-02, USER-06, USER-07, SEC-09（5 项）

**不在本阶段**：zip 包导入与网络地址导入、两阶段预览、`SKILL_THREAT_PATTERNS` 技能域模式组、`allowed-tools` 的解析（均归 **Phase 51**）；`manage_skill` 的 AI 写入路径（49，已完成）；技能版本历史 / 覆写前备份（v1.x）。

**五条前置约束（来自既有阶段，不得回退）**：

- **`ai-skills-manager.js` 是唯一权威且零 electron 依赖**（49-01 明文：写权威与读权威同源）⇒ 本阶段的校验器 / 写函数 / 投影一律住该模块，**不得另写第二份**；`ai-manager.js` 与 `main.js` 的 handler 只做转发层。这是 49 排在 50 之前的**全部理由**（ROADMAP 安全门禁原文：「本阶段产出的校验器是 50/51 唯一可复用的那一份」）。
- **`LIMITS` 只允许加项，不得改既有数值**（46 D-11 / 49 D-10）：`MAX_SKILL_MD_BYTES` 64 KiB / `MAX_USER_SKILLS` 50 / `SKILLS_PROMPT_CHAR_BUDGET` 8000 / `MAX_MANAGED_SKILLS` 50 / `MAX_SKILL_DESCRIPTION_CHARS` 1024。**端与前端零字面量**（45/46 建立的纪律）。
- **禁用语义 = 过滤不删文件**（46 D-09）、**禁用后不进 system prompt 与 `/` 列表**（48 D-10）；「已禁用」与 `disable-model-invocation`（「仅显式」）是**两个互不蕴含的 flag**（48-03 已要求成文防回归）。
- **设置页是 `realm://` guest，无 `realmAPI`** ⇒ 必须走 `/api/*` + token；**主窗口 `file://` 不能 fetch 本地 HTTP** ⇒ 必须走 `realmAPI`（Phase 38 事故，AGENTS.md「数据访问分层约定」）。
- **`windowManager.broadcast` 只发到各 BrowserWindow 的 webContents，不到 webview guest**（`window-manager.js:310`）⇒ 设置页收不到任何主进程广播。

</domain>

<decisions>
## Implementation Decisions

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
  - **本侧的判据不能复用 49 的 `resolveManagedTarget`**（那是 managed 视角的「seeded 保护 + 用户撞名」，方向相反）；需要**一处显式的「仅 user 可删」判据**（读盘判 `skills/<name>` 是否存在 + `managed-skills/<name>` 是否存在 ⇒ 后者存在即拒）。
- **D-08:** **新增第十个错误码 `NOT_USER_OWNED: 'not_user_owned'`**，并把三处账本（`docs/product/ai-skills.md` §11.8 / `AGENTS.md` 测试清单 / 对应测试断言）从「九码」刷成「十码」。理由：复用 `NOT_FOUND` 会把「技能不存在」与「技能存在但不是你的」混同 —— 用户看到「技能不存在」而该技能明明列在页面上，是**失实文案**；这正是 49-04 修过的三态混同族（`promptIncluded` 的 `false`/`undefined` 混同根因）。— **Reversibility:** costly — 「九码」是已写进产品文档、`AGENTS.md` 维护约定与测试清单的**成文账本**（三处必须一起刷，49-06 已建立刷新纪律）；回退需同步改三处账本 + 一个常量的取值域。
- **D-09:** **禁用的技能仍可卸载**（卸载不因 `disabled` 而置灰）。理由：禁用是「先别进 prompt 试试」的轻量试探，卸载是「确实不要了」的终局；要求用户先启用再卸载是反直觉的两步操作。且禁用不改变来源（`settings.aiSkills.disabled` 只存名字）。
  - **派生不变式（必须实现）**：卸载一个 user 技能成功后，**必须同步从 `settings.aiSkills.disabled` 移除该名字**。否则残留名单会随技能名复用而误伤 —— 同名新技能一装上就被静默禁用，属「静默失效」。启用 / 禁用单条时无需清理（技能仍在盘上）。
- **D-10:** **`/api/settings/update` 对 `aiSkills.disabled` 补服务端校验**（与既有 `aiBashWhitelist` / `cacheMaxGB` 两条**并列**）。理由：该键目前**零服务端校验**（`main.js:1375-1392` 只循环校验那两个键），手改 URL 可写入任意值污染禁用名单（含超大数组、非字符串项、路径样字符串）。校验面：必须是数组 / 每项为非空字符串且符合技能名形态（`ai-skills-manager` 的既有校验器）/ 长度上限（单条长度与总条数）。— **Reversibility:** reversible — 一处校验分支，回退即删。

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
  - 新增单源常量 `MAX_JSON_BODY_BYTES = 1 MiB`（`main.js`）作为**全局默认**，覆盖现有全部端点（它们 body 都是小 JSON）。
  - 超限时**立即拒收**：不再继续累积 `body`（`req.destroy()` / 停止累积），回 `413` + `{ error: … }`。ROADMAP 判据 5 的判据对象是「**不无上限读入内存**」，仅靠事后长度检查不满足它。
  - **可显式覆盖**：需要大 body 的端点传 `{ maxBytes }`。Phase 51 的 zip base64 导入端点届时**显式声明**更大值 —— 「默认小 + 需大者显式放大」的形状让「漏了上限」不会静默发生。
  - 数值单源在 `main.js` 常量，**设置页前端不得写死第二份**。— **Reversibility:** costly — `readJsonBody` 是**全部** `/api/*` POST 端点的公共入口，改签名/默认值影响面横跨所有内部页面；且 Phase 51 会依赖「可显式覆盖」这条面。
- **D-17:** **两个前端入口读写对等，共用同一 manager 函数与同一管理投影**：新增 `/api/skills/*`（HTTP，设置页）+ 主窗口 IPC（`realmAPI`，与既有 `ai:get-skills` / `ai:refresh-skills` 并列）。IPC 侧复用既有 `assertTrustedSender`（`ipc-handlers.js:113`），HTTP 侧复用既有 token 鉴权。理由：ROADMAP 判据 4 与 USER-07 都明说「两个前端入口」「同一后端权威」；两个 handler **只是转发层**（判据 / 校验 / 写函数全在 `ai-skills-manager.js`），与 49 的「`ai-manager.js` 只做注册与参数转发」同款 ⇒ 零重复实现。
  - **硬约束**：设置页**必须**走 HTTP（guest 无 `realmAPI`），主窗口**必须**走 IPC（`file://` fetch 本地 HTTP 被 CORS 拦，Phase 38 事故）。两条不可互换。
  - 主窗口当前**无管理 UI** ⇒ IPC 写侧暂无 UI 消费者，其价值是「两入口同一权威」的对称性 + 未来主窗口管理面 + 开发/调试便利；**不得**为了让 IPC 有消费者而在主窗口新造一套管理 UI（那是新能力，不属本阶段）。
- **D-18:** **写路径收口 = 「成功后调 `syncAgentSystemPrompt()` 恰一次」+ 「调用侧无条件补一次 `skills:changed` 广播」**：
  - **`syncAgentSystemPrompt()` 调用恰一次**（该函数体内**已含** `refreshSkills()` 重扫；`ai-manager.js:3053` 的广播也在其内）。**不要**照 ROADMAP 字面写成 `refreshSkills()` + `syncAgentSystemPrompt()` —— 那是两次全量重扫（49-01 的 D-13 已付过这个代价，L 组断言 `rescanCalls === 2` 而非 3）。
  - **必须补广播 —— 这是一个真实缺口**：`syncAgentSystemPrompt()` **只在真正改写 prompt 时才广播**（无变化早退，`ai-manager.js:3048` 的逐字符比对 + digest 双判定）。禁用一个 `shadowed` 或 `promptOmitted` 的技能时 prompt 段**逐字符不变** ⇒ **不广播** ⇒ 48 D-10 要求的「禁用后 `/` 面板隐藏该技能」失效。卸载同理（被删技能本就被排除在 prompt 段外时，段不变）。
  - **修法约束：不得改 `syncAgentSystemPrompt()` 的函数体** —— 46-04 的方法体源码扫描断言与 `tests/test-ai-skills.js` 的广播次数断言（`:1239` / `:3289` / `:3455`）都钉着它。只能在**管理写路径的调用侧**，于其**之后**无条件补一次 `windowManager.broadcast('skills:changed')`。**广播幂等**（48-06 已把 renderer 的监听改成无条件重拉快照）⇒ 多播一次零副作用；不得为省这一次广播去改被钉住的函数体。
  - **诚实边界（必须写进 CONTEXT 与 `docs/product/ai-skills.md`）**：`windowManager.broadcast` 只发到**各 BrowserWindow 的 webContents**（`window-manager.js:310` 逐窗 `win.webContents.send`），**不到 webview guest**。故：设置页**每次操作后自行重拉列表**、**每次进入该页时重拉**；**多个设置页实例之间不做即时同步**（不新增 guest push 通道 —— 设置页是纯 HTTP 客户端，`src/settings-page.js` 零 IPC/`realmAPI`，为它开一条 push 通道是新基建，收益仅覆盖边缘场景）。
  - **进度账本**：本阶段完成后 `STATE.md:292` 的 `syncAgentSystemPrompt()` 生产调用方 ⚠️ 达到 **2/3**（49 的 `manage_skill` 三动作 + 50 的设置页启停卸载），**只剩 51 的导入** ⇒ 仍**不得**声称 P8 失效链 6/6 全覆盖。
  - — **Reversibility:** costly — 「补播」这条判断的依据（无变化早退 ⇒ 不广播）写在 `ai-manager.js` 的注释里，若被后续阶段当成冗余广播删掉，失效链会静默退回；补播点若从调用侧挪进 `syncAgentSystemPrompt()` 函数体，会同时打翻 46-04 的方法体断言与 48 的广播次数断言。

### Claude's Discretion

- **管理投影的具体函数名与返回形状**（`getSkillsForManagement` / `getSkillsForSettings` 等，以及分组是「返回三组数组」还是「返回扁平 + tier 由前端分」）：**建议返回已分组结构**（D-03 要求排序与分组在主进程），具体形状交 plan 期。
- **IPC 通道命名**（`ai:get-skills-manage` / `ai:set-skill-disabled` / `ai:uninstall-skill` 等）与 `preload.js` 的 `realmAPI` 挂载点：交 plan 期；与既有 `ai:get-skills` / `ai:refresh-skills` 并列。
- **体积格式化的落点**：既有的 `formatFileSize` / `formatBytes` 已在 `src/renderer.js:11317`、`src/downloads-page.js:567`、`src/player.js:837` **各有一份页面局部实现**（既有惯例就是逐页局部）。设置页可沿该惯例加一份，**但不得在设置页写死任何限额数值**（限额恒取主进程投影回传的原始值 / `LIMITS` 投影）。
- **启停 switch 的视觉**：建议复用设置页既有 `.ai-switch`（provider `enabled` 开关同款）。
- **诊断详情区的展开交互**：建议复用 48 / 49 的折叠块范式；具体 DOM 与样式交 plan 期（若 ROADMAP 的 `UI hint: yes` 触发 `/gsd:ui-phase 50`，由 UI-SPEC 定稿）。
- **`set-disabled` 的载荷形状**（增量 `{name, disabled}` vs 全量 `{disabled: [...]}`）：建议**增量**（全量会在并发操作下互相覆盖）；具体交 plan 期。
- **测试文件组织**：新增 `tests/test-skills-management.js` 还是并入 `tests/test-ai-skills.js`，交 plan 期。**必须覆盖**：管理投影形状与分组（含空组不渲染）/ 体积与文件数口径（递归、隐藏文件不计）/ 来源三档 / 仅 user 可卸载（含「手改 URL 直调端点」的服务端拒绝）/ 卸载后 `disabled` 名单清理 / 读盘判据而非缓存快照 / `readJsonBody` 上限（超限 413 且不累积）/ `settings.aiSkills.disabled` 服务端校验 / 写路径「`syncAgentSystemPrompt()` 恰一次 + 补播一次」/ 禁用后 `/` 面板不可见。
- **待实测项**：`readJsonBody` 改签名后对**全部**既有 `/api/*` POST 端点的回归（`/api/settings/update` 等）；设置页 inline hint 的自动复位在连续操作下的表现；100 条技能时设置页的渲染耗时。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑、需求与门禁

- `.planning/ROADMAP.md` §Phase 50 / §Security Gates — Goal、5 条 Success Criteria（判据 1 的六字段、判据 2 的「禁用只过滤不删文件」、判据 3 的「卸载仅允许 `source === 'user'`，手改 URL 直调端点也不例外」、判据 4 的「两入口读同一权威 + 跨窗口同步」、判据 5 的「超体积请求体在 `/api/*` 层被拒且不无上限读入内存」）、**SEC-09 请求体体积上限（安全项，非优化项）**、**P8 多窗口广播与失效链**、`UI hint: yes`、Doc sync（`allowed-tools` 展示必须带免责标注 → 由 D-14 按「不展示」满足）
- `.planning/REQUIREMENTS.md` — USER-01 / USER-02 / USER-06 / USER-07 / SEC-09 条目原文（`:51-57` / `:78`）、Out of Scope 表、v2 Requirements 的 ECO-05（四态可见性）/ ECO-06（容器级作用域）
- `.planning/STATE.md` §Blockers/Concerns — **`:292` 的 ⚠️ `syncAgentSystemPrompt()` 生产调用方**（D-18 的收口对象，49 已闭合 1/3，本阶段到 2/3）、`:290` 的 O7（三条限额数值已在 46 落定，50 只渲染不重定义）、`:287` 的 O3（`allowed-tools` 解析半边归 51 —— D-14 的直接依据）、`:295-296` 的 TD-48-01 / TD-48-02（无归属阶段，见 Deferred）

### 研究（本阶段实现的直接依据）

- `.planning/research/FEATURES.md` **§D6** / **§7.3 Anti-Features** — `manage_skill` 默认开、不做 autolearn 推促
- `.planning/research/PITFALLS.md` — **P3**（description 零交互注入通道 + name 冒名；`scanInjectionPatterns` 的三类放行缺口）、**P7**（四个资源耗尽入口与限额；`:318` 明文「Phase to address: 导入管线 + `manage_skill` + 技能加载接线」）、**P8**（失效链 6 个触发点，设置页启停卸载归 50）、**P12**（`loadSkills` 全部失败都是 warning = 静默失败）
- `.planning/research/SUMMARY.md` §Phase 50 / §Phase Ordering Rationale 第 3 条（`:146`：50 排在 49 之后正是为防校验逻辑漂移）
- `.planning/research/ARCHITECTURE.md` §Anti-Pattern 1 / 2 / 5（不吃 `path` / 不做每轮重载 / 不在 renderer 重建优先级表）、§模块级缓存 + 同步访问器设计

### 上一阶段（本阶段的前置契约）

- `.planning/phases/46-prompt/46-CONTEXT.md` — **D-06**（遮蔽败者保留 + `shadowed`/`shadowedBy`，明文「48 要来源徽标、**50 要列表与诊断**」）、**D-07**（诊断形态 `skill.diagnostics[]` + 模块级 `errors[]`）、**D-08**（name 恒等于目录名）、**D-09**（禁用存 `settings.aiSkills.disabled`，加载后过滤不删文件）、**D-11**（限额常量单源）
- `.planning/phases/47-bash/47-CONTEXT.md` — **D-11**（seeded 身份 = 扫随包 `skills-builtin/` 目录名集合；**零状态文件、零硬编码**）、**D-10**（`managed-skills/` 不允许手删，唯一「不要这个技能」的语义是禁用 —— D-07 的说明文案依据）
- `.planning/phases/48-skill-name/48-CONTEXT.md` — **D-02**（行内容 = 名称 + 徽标 + 描述 + 标记；**明文「不显示体积 / 文件数 / 诊断计数 —— 那是 Phase 50 设置页列表的职责」**）、**D-10**（禁用 → 面板隐藏 + 显式调用被拒，「已禁用」与 `disable-model-invocation` 不得混同）、**D-11**（遮蔽可见但不可选中）、**D-12**（超限技能仍可显式调用 + 两条标注原文）、**D-14**（三档档位判定已锁定，本阶段只消费）、**D-17**（`skills:changed` 广播 + stale-while-revalidate）
- `.planning/phases/49-manage-skill-ai/49-CONTEXT.md` — **D-01**（`manage_skill` 不加确认的论据，与本阶段 D-05 正交）、**D-06**（name 校验器的三条补充与「写入门严、读入门宽」的不对称）、**D-07**（九码闭合白名单 + `details` 原因码 —— D-08 的加码对象）、**D-11**（写函数与校验器住 `ai-skills-manager.js`，seeded 集合由调用方注入）、**D-12**（原子写与递归删除的沙箱原语）、**D-13**（刷新链只调 `syncAgentSystemPrompt()` 一次 + 忙时语义）
- `.planning/phases/49-manage-skill-ai/49-REVIEW.md` — `WR-12` / `IN-14` / `IN-16` / `IN-17` 挂账台账（见 Deferred）

### 项目内既有先例与会话契约（实现时照抄的对象）

- `ai-skills-manager.js` — 技能集**单一数据权威**与 D-13 的落点：`LIMITS`（`:48-54`）、`MANAGED_SKILL_NAME_RE`（`:65`）、`refreshSkills()`（`:538`，D-13 的体积/文件数计算接入点）、`getSkillsSnapshot()`（`:752`）、`sourceTierOf()`（`:776`）、`toUISkillEntry()`（`:799`，**有意收窄投影**）、`matchSkillByPath()`（`:826`）、`getSkillsForUI()`（`:853`，D-13 **不得扩展**的对象）、`readSkillForInvocation()`（`:894`）、`MANAGE_SKILL_ERROR`（`:966-976`，D-08 **在此加第十码**）、`validateManagedSkillName()`（`:1034`，D-10 的校验器复用对象）、`sanitizeSkillDescription()`（`:1150`）、`resolveManagedTarget()`（`:1367`，D-07 明示**不复用**的对象）、`deleteManagedSkill()`（`:1603`，managed-only 的既有递归删除先例）、`getSkillPromptIncluded()`（`:1651`）、`module.exports`（`:1663`）
- `ai-manager.js` — `getSkillsForUI()`（`:1583`）、`getSeededSkillNamesSafe()`（`:1565`，**零 electron 依赖边界的安全注入点**）、`syncAgentSystemPrompt()`（`:3026`，`:3048` 无变化早退、`:3053` 广播 —— D-18 的核心对象）、`refreshSkillsForPanel()`（`:3072`）、`_flushDeferredSkillsPrompt()`（`:3100`）、`_buildRealmTools()`（`:3372`）、`_buildManageSkillTool()`（`:6124` / `:6254` 的 `syncAgentSystemPrompt()` 恰一次先例）
- `agent-workspace.js` — `getSkillsDir()`（`:102`）/ `getManagedSkillsDir()`（`:113`）（D-07 判据与 D-13 遍历的对象）、`createSandboxEnv()`（`:205`，`remove` / `listDir` / `fileInfo` / `exists`）、`resolveInside()` 双基准
- `builtin-skills-seeder.js` — `getSeededSkillNames()`（`:92`，三档档位中 `builtin` 的唯一数据源；注意本模块经 `agent-workspace` **间接依赖 electron**）
- `main.js` — `readJsonBody()`（`:887`，**D-16 的改造对象**）、`handleSettingsApi()`（`:1336`，D-15 的范式来源；`:1372-1392` 的 `update` 双保险校验 —— **D-10 在此加一条**）、`:1395` 的 `settings:updated` 广播先例、`handleAiMemoryApi()`（`:2649`，单端点范式）、`realmServer`（`:2704`）与路由分发（`:2727` 起）
- `ipc-handlers.js` — `assertTrustedSender()`（`:113`，D-17 的复用品）、`ai:get-skills`（`:1747`）/ `ai:refresh-skills`（`:1763`）（D-17 的并列对象，注意 `:1743` 明文「**不得**走 `/api/skills/*`」的理由）
- `src/preload.js` — `getSkills`（`:1033`）/ `refreshSkills`（`:1040`）（D-17 的扩展点）、`settings:updated` 监听（`:913`，**只挂主窗口 renderer**）
- `src/settings-page.js` — `aiMemoryApi()`（`:172`，单端点 HTTP 范式）、`aiBashWhitelist` 的即改即存链路（`:2839-2900`，**D-05 的范式来源**）、`setAiMemoryHint()` 的 success/danger 双色 + 自动复位（`:3879` 附近，**D-06 的复用品**）、`init()`（`:4787`）、`DOMContentLoaded`（`:4846`）
- `src/settings.html` — AI 助手分区（`:266`）、AI 记忆子区（`:484`）、AI Bash 白名单子区（`:506`，**D-01 的插入位置参照与范式**：`.settings-group` + `.settings-group-title` + 即改即存 tag）
- `src/skill-picker-model.js` — `STATUS_TEXT`（`:239-244`，**D-12 的唯一权威，加第 5 条 `disabled` 的位置**）、`PROMPT_OMITTED_CARD_NOTE`（`:269`，≤4 字投影先例）、`buildPickerItems`（`:405` 附近引用 `STATUS_TEXT.overLimit`）
- `src/renderer.js` — `skills:changed` 监听（`:4405`，无条件重拉快照，D-18 的消费端）、「仅显式」标注（`:10599`）、`formatFileSize()`（`:11317`，既有的页面局部实现）
- `window-manager.js` — `broadcast()`（`:310`，**只发窗口 webContents，不到 guest** —— D-18 诚实边界的判据来源）
- `docs/product/ai-skills.md` — 本阶段按 AGENTS.md 维护约定新增**管理面**章节（列表字段与口径 / 启停与卸载语义 / 拒绝面 / 两入口 / 体积与文件数口径 / 诊断两层承载 / `allowed-tools` 缺席原因 / 诚实边界：多开设置页不同步）。现有十一节：能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制 / 测试与验证 / 内置技能 / bash 安装档 / 发现与调用 / AI 自建技能（§11.8 是 D-08 要刷的「九码」账本）
- `AGENTS.md` §AI 工作区与 Bash 权限 / §新增 IPC 接口 / §内部页面 CSP / §弹框居中约定 / §数据访问分层约定（`file://` 主窗口不能 fetch 本地 HTTP）/ §Cookie 面板与 `.www` 去重 — 维护约定与测试清单（D-08 的「九码 → 十码」刷新点）
- `tests/test-ai-skills.js`（技能域全量：`refreshSkills` / 投影 / 遮蔽 / 上限 / 投影字段 / **`:1239`、`:3289`、`:3455` 的 `skills:changed` 广播次数断言**）、`tests/test-manage-skill.js`（49 的校验器与拒绝面矩阵）、`tests/test-skill-picker-model.js`（`STATUS_TEXT` 与面板行）、`tests/test-agent-workspace.js`（沙箱原语）、`tests/test-builtin-skills-seeder.js`（seeded 集合 / 打包排除项护栏）

### 参考实现（仓库外，仅作设计参照，不引入依赖）

- `/Volumes/ZhiTai/Projects/github/openhanako/` — omp（oh-my-pi）系列参考：`docs/tools/manage_skill.md`（managed 与 authored 隔离、Limits & Caps、全部错误消息）、技能管理面的列表字段与状态语义参照

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`ai-skills-manager.js` 已备齐本阶段需要的几乎全部零件**：`sourceTierOf` / `toUISkillEntry`（三档档位与投影骨架）、`validateManagedSkillName`（D-10 的服务端校验器，**直接复用**）、`MANAGE_SKILL_ERROR`（D-08 的加码位置）、`deleteManagedSkill`（递归删除 + 沙箱 `env.remove({recursive:true})` 的**形状模板**）、`refreshSkills`（D-13 的体积/文件数计算接入点）。
- **沙箱已提供全部文件 IO 原语**：`env.listDir` / `env.fileInfo` / `env.exists` / `env.remove({recursive:true})` —— **无需新增任何路径校验或文件遍历代码**；D-07 的「仅 user 可删」判据与 D-13 的目录遍历都在这几个原语上完成。
- **设置页的即改即存链路是完整样板**：`aiBashWhitelist` 的「读 state → 整存整取 → `POST /api/settings/update` → 更新 state → 重渲染」四步（`src/settings-page.js:2839-2900`）+ `.whitelist-tag` 视觉段 —— D-05 的启停开关照抄这条链路的形状。
- **`setAiMemoryHint` 的 inline hint**（success / danger 双色 + 自动复位守卫）—— D-06 的失败反馈直接复用，零新基建。
- **`syncAgentSystemPrompt()` + `_flushDeferredSkillsPrompt()` 已构成完整失效链**（48-08）：D-18 的写路径只需一行调用 + 一行补播。

### Established Patterns

- **单一数据权威 + 校验器单源**：技能集的加载 / 去重 / 诊断 / 限额 / 写入全在 `ai-skills-manager.js`（零 electron 依赖，可单测、可被 50/51 直接 require）。D-13 的投影与 D-07 的判据都必须落在这里，**handler 只是转发层**。
- **常量单源、端点与前端零字面量**（45/46 纪律）：`LIMITS` 与 `MAX_JSON_BODY_BYTES` 都只在主进程定义一处；设置页展示限额数值时必须取投影回传值，不得写死。
- **禁止静默失败**（SKILL-06 / P12）：拒绝路径必须给可读原因 + 机器可读码（D-08）；诊断必须透传到设置页（D-11）；卸载后必须清理 `disabled` 名单（D-09 派生不变式）。
- **冻结快照 + 同步只读**：`buildSystemPrompt()` 保持同步零 IO（G-42-4 先例）；D-13 的体积/文件数只能在重扫管线里算，不得在读取投影时做 IO。
- **渲染端不重实现判定**：优先级 / 遮蔽 / 档位 / 排序全在数据层（46 D-06、48 D-14）；D-03 的分组与排序因此在主进程完成。
- **数据访问分层**（Phase 38 事故）：主窗口 → `realmAPI` IPC；`realm://` guest → `/api/*` + token。**两条不可互换**。
- **诚实边界必须成文**：bash 白名单（「降低误执行概率的启发式而非安全边界」）、`allowed-tools`（「当前运行时不被强制，仅供参考」）、`manage_skill` 的 bash 绕过面都已成文 —— D-14（`allowed-tools` 缺席原因）与 D-18（多开设置页不同步）同样要进 `docs/product/ai-skills.md`。

### Integration Points

- `ai-skills-manager.js` —— 新增管理投影函数 + `deleteUserSkill`（复用 `validateManagedSkillName` 与沙箱 `remove`）+ `MANAGE_SKILL_ERROR.NOT_USER_OWNED`；`refreshSkills()` 内接入体积/文件数计算
- `ai-manager.js` —— 新增管理面转发方法（**不得**让 `ai-skills-manager.js` 依赖 `ai-manager.js`）；管理写路径的成功出口：`await this.syncAgentSystemPrompt()` **恰一次** + 调用侧无条件 `windowManager.broadcast('skills:changed')`
- `main.js` —— `handleSkillsApi()`（三个 REST 子路由）+ 分发分支；`readJsonBody` 加 `maxBytes`（D-16）；`handleSettingsApi` 的 `update` 循环加 `aiSkills.disabled` 校验（D-10）
- `ipc-handlers.js` —— 三个管理 IPC 通道（与 `ai:get-skills` / `ai:refresh-skills` 并列），全部经 `assertTrustedSender` 后转调同一 manager 函数
- `src/preload.js` —— `realmAPI` 新增对应方法（主窗口侧）
- `src/settings.html` / `src/settings-page.js` —— 「技能管理」区 DOM + 渲染 / 启停 / 卸载 / 诊断展开 / inline hint；HTTP 客户端函数（对齐 `aiMemoryApi` 形状）
- `src/skill-picker-model.js` —— `STATUS_TEXT` 加第 5 条 `disabled`（D-12 单源）
- `docs/product/ai-skills.md` —— 新增管理面章节（含两处诚实边界与体积口径）；`AGENTS.md` 维护约定与测试清单同步（含「九码 → 十码」与新增测试套件）
- `tests/` —— 新增管理面断言组（见 Claude's Discretion 的必测清单）

</code_context>

<specifics>
## Specific Ideas

- **本阶段的「真实缺口」只有一条，但它决定 D-18 的整个形状**：`syncAgentSystemPrompt()` 在「digest 相同**且** prompt 逐字符相同」时早退、**不广播**。而「禁用一个被遮蔽 / 超预算的技能」恰好产生零 prompt 变化 ⇒ 48 D-10 的「禁用后 `/` 面板隐藏该技能」会静默失效。修法必须在**调用侧补播**而不是改函数体（46-04 的方法体源码断言 + 48 的广播次数断言同时钉着它）。规划时**必须**把这条写成显式交付项与验收项，不能只写成「调用 `syncAgentSystemPrompt()`」。
- **D-05 与 49 D-01 的「看似矛盾」必须主动解释**：两个决策都关于「要不要加确认」，结论相反。判据不是「信不信任操作者」，而是**有没有绕道路径** —— AI 有（`write`/`bash` 直改同一目录），人没有。CONTEXT 与产品文档都应保留这条推理，否则后续阶段会以「口径不一致」为由改掉其中一个。
- **D-13 的「不扩展 `getSkillsForUI()`」要留下理由**：48 的收窄投影是**有意的**（防一次 IPC 送最坏 ~3 MB 正文），两个消费者的字段需求不同。若不留理由，后续很容易以「消除重复」为名合并两个投影，把 `/` 面板的 IPC 负载抬起来。
- **D-09 的派生不变式是「静默失效」类缺陷**：卸载后不清 `settings.aiSkills.disabled` 的后果是「同名新技能一装上就被静默禁用」—— 用户完全无法理解。这条比功能本身更需要测试。
- **D-14（不展示 `allowed-tools`）必须写成「有理由的缺席」**：ROADMAP 的 Doc sync 明文要求该字段展示时带免责标注，若 CONTEXT 只写「不展示」，下游可能读成漏做或读成「ROADMAP 判据未满足」。正确表述是「字段尚未被解析（O3 半边归 51）⇒ 无数据可展示 ⇒ 条件句前置条件不成立」，并留下「51 解析后必须补免责标注」的交接。
- **D-16 的形状（默认小 + 需大者显式放大）是为 Phase 51 设计的**：51 会传 zip base64。若本阶段把它做成「全局无上限 → 事后检查长度」，51 会继承一个假边界；做成「默认 1 MiB + 端点显式覆盖」，51 只需在一处写 `{ maxBytes: … }`，而「忘了声明」会在 413 处**当场可见**。
- **本阶段的 UI hint**：ROADMAP 标了 `UI hint: yes` ⇒ 规划时考虑 `/gsd:ui-phase 50` 产出设计契约（列表行密度 / 三档徽标在设置页的呈现 / 诊断展开区 / 状态标注优先级链 / 卸载确认框）。
- **进度账本要如实写**：本阶段完成后 `syncAgentSystemPrompt()` 的生产调用方只到 **2/3**，P8 失效链**仍不得**声称 6/6 全覆盖（`STATE.md:292` 的 ⚠️ 保持挂着，仅更新已闭合份额）。

</specifics>

<deferred>
## Deferred Ideas

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

</deferred>

---

*Phase: 50-设置页技能管理区 + `/api/skills/*`*
*Context gathered: 2026-09-14*

# Phase 50: 设置页技能管理区 + `/api/skills/*` - Research

**Researched:** 2026-09-14
**Domain:** Electron 主进程（HTTP `/api/*` + IPC 双入口）+ 技能管理面（Realm Browser v2.6）
**Confidence:** HIGH —— 本阶段的关键事实全部经本会话**读源码**或**运行时探针**（Electron 43.6.0 / Node 24.20.0 / Chromium 150，即生产运行时）验证；未验证项一律标注 `[ASSUMED]` 并进 Assumptions Log。

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 列表形态与信息密度

- **D-01:** **按来源分三组 + 组内行式列表，不做折叠**。组名 = **「我的技能」/「内置技能」/「AI 创建」**（对应 `sourceTierOf` 的 `user` / `builtin` / `managed`，与 48 D-14 的三档徽标词表同一套）。理由：三档档位判定已在 48 D-14 锁定（本阶段**只消费、零判定实现**）；46 D-06 / SKILL-05 要求「同名冲突对用户可见」⇒ 来源是组织这批数据最重要的维度；复用设置页既有 `.settings-group` / `.settings-group-title` 范式，零新视觉语言。**不折叠**的理由：`shadowed` 可见性与诊断可见性都是本阶段的**正面要求**，默认折叠会把它们藏起来；总数上限 100（user 50 + managed 50）分组后可控。**空组不渲染**（对齐 48 D-01「过滤为空时不渲染空分组标题」）。
- **D-02:** **两行式行内布局**：第一行 `名称 + 来源徽标 + 行尾状态标注 + 右侧操作`；第二行 `描述（CSS 单行截断，title 放全文）+ 副行元信息`。元信息格式 `12.3 KB · 4 个文件`。理由：description 是模型按描述自动匹配的**唯一**触发机制（49 D-07 引用的 skill-creator 作者指南核心结论）⇒ 用户必须能看到才能判断该不该禁用；藏进 tooltip 等于看不见。副行与 `/` 面板行的语义层级一致（48 D-02）。**截断用 CSS（`text-overflow: ellipsis`）而非 JS 截断**，避免「截断逻辑」成为第二份实现。
- **D-03:** **排序 = 沿用 `ai-skills-manager.bySkillPriority` 的确定性全序**（user > 可自动激活 > name 码点序），分组是**在该全序上的稳定分组**，组内顺序即全序的投影。**分组与排序都在主进程做**（管理投影直接返回排好序的分组结构），前端只渲染、不重排 —— 与「渲染端不得重实现优先级」（46 D-06）一致。码点序而非区域敏感比较（46 已防的 prompt 字节跨机漂移）。
- **D-04:** **v1 不做过滤 / 搜索框**。理由：设置页其他列表区（AI Bash 白名单、媒体播放器域名白名单、快捷键列表、分配规则）**均无搜索先例**；总数已被 46 的 `MAX_USER_SKILLS` 与 49 的 `MAX_MANAGED_SKILLS` 封顶（各 50）；日后实测痛苦再加，成本是纯前端一层。— **Reversibility:** reversible — 纯前端增量，回退即删一个输入框与其过滤分支，无数据面或契约变化。

#### 危险动作的交互粒度与拒绝面

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

#### 诊断与状态的展示口径

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

#### 端点形态、体积上限与跨窗口同步

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
| **USER-01** | 设置页 AI 分区新增「技能管理」区，列出技能的名称 / 描述 / 来源 / 体积 / 文件数 / 诊断 | 管理投影落点 = `refreshSkills()` 管线内（事实 1）；体积/文件数走 `env.listDir` 递归（`FileInfo` 带 `size`，实测）；`diagnostics[]` 已在**缓存条目**上（D-13 无需新数据）；插入位置参照 `src/settings.html:506` 的 `.settings-group` 范式；**必须补读路径初始化**（修正 2：未配 provider 时缓存恒为空） |
| **USER-02** | 设置页可启用 / 禁用 / 卸载技能 | 启停 = 写 `settings.aiSkills.disabled`（键路径与三处读取点已核实）+ `syncAgentSystemPrompt()`；禁用过滤点已存在（`src/skill-picker-model.js:224` `s.disabled === true` 跳过）；卸载 = `env.remove(dir, {recursive:true})`（实测 ok） |
| **USER-06** | 卸载仅允许 `source === 'user'` 的技能（手改 URL 不得删内置技能） | 服务端判据落 `ai-skills-manager`（零 electron、可单测）；读盘用 `env.exists`（实测 `{ok:true,value:false}` 而非报错）；**D-07 的判据在「同名双存在」时有语义歧义，见 Open Q1** |
| **USER-07** | 设置页经 `/api/skills/*` + token；主窗口经 `realmAPI` IPC——同一后端权威、两个前端入口 | 设置页 = `<webview>` guest（HTTP，token 来自 URL）；主窗口 `file://` 必须 IPC（CORS）；`assertTrustedSender` 拒 guest（`BrowserWindow.fromWebContents(guestWC)` 为 null）；两 handler 只做转发 |
| **SEC-09** | `readJsonBody` 增加体积上限（防 zip base64 放大无上限） | 57 个调用点全部是 `readJsonBody(req)` 位置参数形态 ⇒ 加可选第二参**零调用点改动**；正确拒收形态经生产运行时实测（413 可达 + 堆增长 0~1 MB）；**默认 1 MiB 会打断两个书签导入端点，见 Pitfall 3** |

</phase_requirements>

---

## Summary

本阶段的技术难点**不在 UI**，而在三处「看不见的接缝」：(1) 管理投影的体积/文件数必须在**重扫管线内**算并缓存，且**不得**进 `computeDigest`；(2) `readJsonBody` 加体积上限是**改 57 个调用点的公共入口**，且「立即拒收」在 Node `http.IncomingMessage` 上有三个会**静默丢掉 413 响应**的陷阱（已实测）；(3) 设置页的**读路径依赖 AI Agent 存在**——未配置 provider 时 `aiManager.init()` 提前 return，`sandboxEnv` 与 `refreshSkills()` 全都不执行，技能缓存恒为 `EMPTY_CACHE()`，管理区会**空空如也**（含已播种的内置技能）。

本会话用生产运行时（Electron 43.6.0 / Node 24.20.0 / Chromium 150）实测了五组探针，得到三条对 CONTEXT 的**事实修正**：

1. **D-18 的「真实缺口」推不出「不广播」**：`computeDigest` 的输入包含每条条目的 `disabled` / `overLimit` / `shadowed`（`ai-skills-manager.js:190-199`），因此禁用任意**在缓存里存在**的技能都会改变 digest；而早退条件是「digest 相同 **且** prompt 逐字符相同」的两项合取 ⇒ digest 变了就不会早退 ⇒ **会广播**。实测：禁用普通技能 → digest/prompt 双变；禁用 `disable-model-invocation: true` 的内置技能 → prompt 不变但 **digest 变**（仍然广播）；只有「禁用名单里的名字不在技能集里」才是真正的零广播（而那时也确实无可同步的变化）。
2. **真正的缺口在别处**（且对判据 1 更致命）：`syncAgentSystemPrompt()` 的两个早退分支——**忙时**（`isProcessing || streaming`）只置脏不广播，要等下一次**成功出口**才落地；**`!this.agent || !this.sandboxEnv`** 时**连 `refreshSkills()` 都不跑**，缓存永不刷新。D-18 的调用侧补播恰好覆盖第 1 个分支（所以这条交付项该保留），但第 2 个分支必须另修（新增读路径初始化）。
3. **D-16 的前提「现有端点 body 都是小 JSON」不成立**：`POST /api/favorites/import-chrome` 与 `POST /api/favorites/import-html` 由 `src/favorites-page.js:2245-2249` 把用户选中的书签文件**全文**塞进 `{ content }` 提交（`file.text()` 之后），真实 Chrome 书签 JSON 动辄数 MB ⇒ 1 MiB 全局默认会**打断既有功能**。这两个端点必须显式声明更大 `maxBytes`。

**Primary recommendation:** 先落三个「地基」——① 在 `ai-skills-manager.refreshSkills()` ④ 定序之后加一次**逐技能递归遍历**（跳 symlink、跳目录 size、跳 `.` 前缀，逐技能 try/catch，失败只产诊断），结果挂在缓存条目上；② `readJsonBody(req, { maxBytes } = {})` 用「**答 413 + 保持 request 流动（`req.resume()`）+ 不设 `Connection: close` + 不 `req.destroy()`**」形态，并给 `sendJson` 加 `headersSent || writableEnded` 幂等护栏；③ 给管理读路径补一个**不依赖 Agent 存在**的初始化（`sandboxEnv` 懒建 + `refreshSkills`），否则本阶段的整个 UI 在「未配 provider / 未配模型」的用户那里是空白的。

---

## CONTEXT 事实核查（三条需修正）

> 本节只报事实与证据；决策归属仍归 CONTEXT / planner。三处均**不影响** D-01~D-17 的其余部分，但 D-16 / D-18 的执行形状必须按下面调整。

### 修正 1 —— D-18 的「不广播」推不出来（补播的依据需改写）

CONTEXT 原文：「`syncAgentSystemPrompt()` **只在真正改写 prompt 时才广播**（无变化早退，`ai-manager.js:3048` 的逐字符比对 + digest 双判定）。禁用一个 `shadowed` 或 `promptOmitted` 的技能时 prompt 段**逐字符不变** ⇒ **不广播**」

实际早退条件是**合取**（`ai-manager.js:3043-3048`，本会话直读）：

```js
const snap = getAiSkillsManagerLazy().getSkillsSnapshot();
const next = buildSystemPrompt();
// digest 是快速判定主键、逐字符比对是二次确认 —— 两者一致才认定「无变化」
if (snap.digest === this._skillsPromptDigest && this.agent.state.systemPrompt === next) return;
```

而 digest 含 `disabled` —— `computeDigest`（`ai-skills-manager.js:189-202`）逐字：

```js
function computeDigest(entries, promptBlock = '') {
  const rows = entries.map((e) => JSON.stringify([
    e.skill.name,
    e.skill.description,
    e.skill.filePath,
    e.skill.disableModelInvocation === true,
    e.source,
    e.disabled === true,
    e.overLimit === true,
    e.shadowed === true,
  ]));
  rows.push(`prompt:${promptBlock}`);
  return hashString(rows.join('\n'));
}
```

⇒ 「prompt 段逐字符不变」只满足合取的一项，**不足以致早退**。

**运行时实测**（`ai-skills-manager.refreshSkills` 真跑；三个技能：user `alpha` / user `beta` / managed `find-skills`（`disable-model-invocation: true`）；每次读取**值副本**以免踩活引用陷阱）：

| 操作 | digest | promptBlock | 推论 |
|------|--------|-------------|------|
| `disabled: []`（基线） | `1g32q7d` | 747 字符 | — |
| `disabled: ['beta']` | **CHANGED** | **CHANGED** | 早退不成立 → 改写 + 广播 |
| `disabled: ['beta','alpha']` | **CHANGED** | **CHANGED** | 同上 |
| `disabled: ['beta','alpha','find-skills']` | **CHANGED** | **UNCHANGED** | **prompt 不变但仍广播**（digest 变） |
| `disabled: ['ghost-name']`（技能集里没有这个名字） | UNCHANGED | UNCHANGED | **唯一真正的零广播路径**（也确实无可同步的变化） |
| 删掉 `skills/beta` 目录（卸载） | **CHANGED** | **CHANGED** | 广播 |
| 加一个与 user 同名的 managed（遮蔽） | **CHANGED** | — | 广播 |
| 禁用被遮蔽的名字（user+managed 同名） | **CHANGED** | **CHANGED** | 广播 |

**结论与对 D-18 的影响：**
- 「调用侧无条件补播」**仍然是正确的**，但它的**真实理由**是覆盖 `syncAgentSystemPrompt()` 的**忙时早退**（`isProcessing || streaming` → `_skillsPromptDirty = true; return;`，**该分支不广播**，要等下一次成功出口的 `_flushDeferredSkillsPrompt()` 才落地；若用户再也不发消息，`/` 面板会一直显示已被禁用的技能）。CONTEXT 里「禁用一个被遮蔽/超预算的技能 ⇒ prompt 不变 ⇒ 不广播」的推理链**应改写**为「忙时分支不广播」。
- **禁止反向「优化」**：任何把 `disabled` / `shadowed` / `overLimit` 从 `computeDigest` 里摘掉的改动，都会**静默破坏跨窗口失效链**（renderer 侧 `pullAiSkillsSnapshot` 也按 `snapshot.digest === state.aiSkillsDigest` 早退，见 `src/renderer.js:9134`）。digest 是**面板可见字段的超集**，这正是它今天能工作的原因。这条必须写进 `docs/product/ai-skills.md` 与管理面维护约定。

### 修正 2 —— 真缺口是「没有 Agent 就没有技能缓存」（判据 1 会整体空白）

`ai-manager.js:789-793`（本会话直读）：

```js
if (configuredIds.length === 0) {
  console.log('[Realm AI] 未配置任何提供商 API Key，跳过初始化');
  this.isInitialized = false;
  return;
}
```

`this.sandboxEnv`（`ai-manager.js:901`）与 `refreshSkills(...)`（`:903`）都在这个 `return` **之后**。而 `builtinSkillsSeeder.seedBuiltinSkills()` 在 `main.js:4049` 是**无条件**执行的（早于 aiManager 创建）。

⇒ **用户未配置任何 provider（或配置了但没有可用模型）时**：
- `managed-skills/find-skills`、`managed-skills/skill-creator` **已在盘上**；
- 但 `_cache` 停在 `EMPTY_CACHE()`（`ai-skills-manager.js:131-138`：`skills: []`, `digest: ''`, `refreshedAt: 0`）；
- `syncAgentSystemPrompt()` 首行 `if (!this.agent || !this.sandboxEnv) return;` ⇒ **连 `refreshSkills()` 都不执行**；
- ⇒ `GET /api/skills/list`（若直接读缓存）返回**空列表**，`/api/settings/get` 里的 `aiSkills.disabled` 也永远对不上任何条目。

`refreshSkillsForPanel()`（`ai-manager.js:3072-3075`）同样走这条早退，因此现有 `/` 面板在无 provider 时也是空的（既有状态，未被测试覆盖）。

**对本阶段的影响**：ROADMAP 判据 1 要求设置页「逐条列出全部技能…」——无 provider 时**一条都列不出来**，且用户无法自查原因（属「静默失败」反模式）。plan 期必须给管理读路径补一个**不依赖 Agent 的初始化**。建议形状（保持「恰一次重扫」的次数账）：

```js
// ai-manager.js（新方法，命名交 plan 期；不进 syncAgentSystemPrompt() 函数体）
async ensureSkillsFresh() {
  if (!this.sandboxEnv) this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();
  if (this.agent) { await this.syncAgentSystemPrompt(); return; }  // 内含恰一次 refreshSkills
  await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, { /* disabled / rootDirs 同上 */ });
}
```

`createSandboxEnv()` 与 provider 配置**无关**（它只依赖 `agent-workspace` + SDK），因此这条路可行。⚠️ 这会新增 `syncAgentSystemPrompt()` 的**第 3 个生产调用侧**（读侧）；`STATE.md:292` 的进度账本口径需如实措辞（「调用方份额」与「失效链触发点份额」不是同一个量，避免被读成 3/3）。

### 修正 3 —— D-16 的「现有端点 body 都是小 JSON」不成立

`readJsonBody` 的 57 个调用点里有**两个**端点的 body 是**用户文件的全文**（`src/favorites-page.js`，`realm://favorites` guest）：

```js
// src/favorites-page.js:2239-2249（pickBookmarkFile）
input.onchange = async () => {
  const file = input.files && input.files[0];
  if (!file) return;
  const ext = file.name.toLowerCase().split('.').pop();
  try {
    const content = await file.text();
    if (ext === 'json') {
      await startChromeImport({ content });
    } else if (ext === 'html' || ext === 'htm') {
      await startHtmlImport(content);
    }
```

- `POST /api/favorites/import-chrome`（`main.js:1157`，`{ filePath, content }`）
- `POST /api/favorites/import-html`（`main.js:1177`，`{ filePath, content, mode }`；预览与执行**各发一次**，同一份 content 走两遍，见 `src/favorites-page.js:2335` / `:2445`）

Chrome / Safari 的书签导出**常规就在 1–10 MB**。⇒ 全局默认 1 MiB 会让「导入书签」在这些用户那里 413。plan 期必须给这两个端点**显式声明** `maxBytes`（建议 32 MiB，与 PITFALLS P7 的 zip 累计口径同量级且不冲突），或把全局默认抬到能覆盖它们并让别的端点各自收紧。**必须逐个端点评审**，不能只按「都是小 JSON」的假设放行。可用同一份清单机械复查：`grep -c "await readJsonBody(req)" main.js` = 57（见 Pitfall 3 的完整分表）。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|-----------|-------------|----------------|-----------|
| 技能集加载 / 去重 / 遮蔽 / 限额 / 诊断 / 尺寸统计 | **主进程 · `ai-skills-manager.js`（数据权威，零 electron）** | — | 49-01 明文「写权威与读权威同源」；本阶段的校验器 / 写函数 / 投影一律住该模块，handler 只转发 |
| 管理投影（分组 + 排序 + 体积 + 文件数 + 诊断） | **主进程 · `ai-skills-manager.js`** | — | D-03 要求分组与排序在主进程；D-13 明确不扩展 `getSkillsForUI()` |
| 禁用名单持久化 | **主进程 · `configStore`（electron-store，键 `settings.aiSkills.disabled`）** | — | 三处读取点均在主进程（`ai-manager.js:904 / :3031 / :3147`）；即改即存靠 configStore 的同步写 |
| 请求体体积闸（SEC-09） | **主进程 · `main.js` 的 `realmServer` 层（`readJsonBody`）** | — | 判据对象是 HTTP 请求体；`/api/*` 是唯一入口；前端不得写死第二份数值 |
| 卸载的文件系统操作 | **主进程 · `ai-skills-manager` 经沙箱 `env.remove({recursive:true})`** | — | 沙箱已提供路径校验；`deleteManagedSkill` 已给出形状模板 |
| 写路径失效链（prompt 回写 + 广播） | **主进程 · `ai-manager`（`syncAgentSystemPrompt()` 恰一次 + 调用侧补播）** | 主窗口 renderer（消费 `skills:changed`） | 46-04 的方法体断言钉住函数体；补播只能在调用侧 |
| 设置页列表渲染 / 启停 / 卸载确认 / 诊断展开 | **设置页 renderer（`realm://settings` guest，`src/settings-page.js`）** | — | guest 无 `realmAPI` ⇒ 纯 HTTP 客户端；CSP 禁 markup 内联 style |
| 状态文案单源（含新增 `disabled`） | **`src/skill-picker-model.js`（双模式导出，零依赖）** | 设置页（新消费者） | D-12 单源；需在 `src/settings.html` 新增 `<script src="skill-picker-model.js">` |
| 主窗口 IPC 入口（对等写路径，暂无 UI 消费者） | **主进程 · `ipc-handlers.js` → 同一 manager 函数** | 主窗口 renderer（`realmAPI`） | D-17 对称性要求；不得为主窗口新造管理 UI |

---

## Standard Stack

### Core（本阶段**不新增任何依赖**）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| （无新增） | — | — | 本阶段全部能力由既有内置模块承担：`http` / `electron-store` / 沙箱 `ExecutionEnv` / `src/skill-picker-model.js` |

**结论：本阶段零新依赖 ⇒ Package Legitimacy Audit 为空（无包可审）。** Phase 51 才会引入 zip 库（PITFALLS 建议 `fflate`）与可能的 `yaml` / `ignore` 提升，届时按 AGENTS.md 的 registry 纪律审计。

### Supporting（复用的既有资产）

| Asset | Location | Purpose | When to Use |
|-------|----------|---------|-------------|
| 沙箱文件原语 | `agent-workspace.js:286-325`（`fileInfo` / `listDir` / `exists` / `remove` / `createDir`） | 递归遍历 / 只读盘判据 / 递归删除 | 全部管理面文件操作——**不要**新增路径校验或直接 `fs` |
| 技能投影骨架 | `ai-skills-manager.js:776-813`（`sourceTierOf` / `toUISkillEntry`） | 三档 tier 与投影字段 | 管理投影直接复用 `sourceTierOf`，**不得**重写档位判定 |
| 名称校验器 | `ai-skills-manager.js:1034`（`validateManagedSkillName`） | D-10 的服务端校验 | 直接 require 同一份 |
| 递归删形状模板 | `ai-skills-manager.js:1603-1623`（`deleteManagedSkill`） | user 技能卸载 | 照抄 `env.remove(dir, { recursive: true })` + `throw makeManageSkillError(…)` |
| 错误构造点 | `ai-skills-manager.js:991`（`makeManageSkillError`） | 带 `code` 的业务错误 | D-08 新码经此构造 |
| REST 子路由范式 | `main.js:1336-1344`（`handleSettingsApi`） | token → route → 分支 → `sendJson` | `handleSkillsApi` 照抄 |
| 单端点范式 | `main.js:2649`（`handleAiMemoryApi`） | 方法分发 | 参考错误形状 `{ error }` |
| 即改即存链路 | `src/settings-page.js:2839-2900` | 读 state → 整存 → POST → 更新 state → 重渲染 | 启停开关照抄形状 |
| inline hint | `src/settings-page.js:3878`（`setAiMemoryHint`）+ `.whitelist-hint`（`src/settings.html:518`） | 双色 + 自动复位守卫 | D-06 的复用对象 |
| 状态文案单源 | `src/skill-picker-model.js:239-244`（`STATUS_TEXT`） | 行尾标注 | D-12；**设置页当前未加载该文件**，需在 `settings.html` 加 `<script>` |
| 广播消费端 | `src/renderer.js:4405-4407` + `:9129-9142` | `skills:changed` → 重拉快照 | 补播零副作用（但注意 digest 早退） |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|-----------|-----------|----------|
| `env.listDir` 递归遍历（沙箱内） | 直接 `fs.readdirSync(dir, {withFileTypes:true})` | 沙箱版自带 `resolveInside`（含 realpath 复核）与 `permission_denied` 语义；直接 fs 会**绕过**沙箱并需自己写路径校验（与 AGENTS.md「硬沙箱漏一个入口就是逃逸口」纪律冲突）。**选沙箱版** |
| 在管理投影读取时实时遍历 | 在 `refreshSkills()` 内算并缓存 | D-13 已锁：读取时遍历会把「打开设置页」变成 100 次整目录 stat；冻结快照纪律（G-42-4）。**选重扫期内算** |
| `req.destroy()` 立即断连 | `req.resume()` 继续丢弃读入 | 实测：`destroy()` / `Connection: close` 会让客户端拿到 **EPIPE** 而非 413（判据 5 要「返回明确错误」）。**选 drain-and-respond**（详见 Pitfall 1） |
| 用 `/api/skills/*` 给主窗口供数 | IPC（`realmAPI`） | 主窗口 `file://` fetch 本地 HTTP 被 CORS 拦（Phase 38 事故）。**两条不可互换**（D-17） |
| 把体积/文件数并进 `getSkillsForUI()` | 新增管理面投影 | D-13：`/` 面板 IPC 会白传 100 条诊断与遍历结果。**保持两个投影** |

**Installation:**
```bash
# 本阶段零安装
```

**Version verification:** 无新增包，无需 registry 校验。生产运行时已核实：`node_modules/.bin/electron --version` → `v43.6.0`；该二进制内 `process.versions.node` = **24.20.0**、`process.versions.chrome` = **150.0.7871.250**（探针实测）。本机 `node --version` = v22.22.0（与 Electron 内的 Node 主版本不同 ⇒ 凡依赖 Node 行为的结论**必须在 Electron 内复跑**，见 Sources）。

---

## Package Legitimacy Audit

**本阶段不安装任何外部包** ⇒ 无待审包。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| （none） | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Phase 51 会引入 zip 解析库（`.planning/research/PITFALLS.md:193` 建议 `fflate`，当前**完全未安装**）——届时必须走完整审计（registry 存在性 + 下载量 + 源仓库 + postinstall 脚本 + 与 `package.json` 的 `asarUnpack` 联动）。*

---

## Architecture Patterns

### System Architecture Diagram

```
                       ┌──────────────────────── 主进程 ────────────────────────┐
  设置页 (realm://settings → http://localhost:<port>/settings, <webview> guest)   │
  src/settings-page.js                                                           │
  ├ window.SkillPickerModel.STATUS_TEXT  ← <script src="skill-picker-model.js">   │
  ├ fetch /api/skills/list?token=…  ─────────┐                                  │
  ├ fetch /api/skills/set-disabled?token=…   │                                  │
  └ fetch /api/skills/uninstall?token=…      │                                  │
                                             ▼                                  │
  主窗口 renderer (file://)            realmServer (main.js:2704)                │
  src/renderer.js                      ├ token 校验 (REALM_TOKEN, main.js:104)  │
  ├ realmAPI.ai.getSkillsManagement()  ├ handleSkillsApi()  ← 新增分发分支       │
  ├ realmAPI.ai.setSkillDisabled()     │   ├ list        → manager 投影           │
  └ realmAPI.ai.uninstallSkill()       │   ├ set-disabled→ 写 configStore → sync  │
        │                              │   └ uninstall   → 判据 → 删盘 → sync     │
        │ ipcMain.handle               │   （readJsonBody(req,{maxBytes}) ← D-16）│
        ▼                              └ 既有端点全部经 readJsonBody（57 处）       │
  ipc-handlers.js ── assertTrustedSender（拒 guest）                             │
        │                                                                        │
        └──────────────┬────────────────────────────────────────────────────────┘
                       ▼
        ai-manager（转发层 + 失效链）
        ├ ensureSkillsFresh()        ← 【修正 2 新增】不依赖 agent 的读路径初始化
        ├ syncAgentSystemPrompt()    ← 函数体逐字不改（46-04 断言）；内含恰一次 refreshSkills
        ├ setSkillDisabled() / uninstallUserSkill()
        │     └ 成功后：await syncAgentSystemPrompt() 恰一次
        │               windowManager.broadcast('skills:changed')  ← 调用侧补播（忙时分支的唯一来源）
        └───────────────────────────────────────────────────────────────┐
                                                                        ▼
        ai-skills-manager.js（数据权威，零 electron，可单测）
        ├ refreshSkills(env, {disabled, rootDirs})
        │   ⓪ 根存在性 → ① 布局/描述过滤 → ② 目录名权威 → ③ 遮蔽
        │   → ④ bySkillPriority 定序 → ④.5 【新增】逐技能递归遍历（bytes / fileCount）
        │   → ⑤ disabled 标记 → ⑥ overLimit → ⑦ prompt 预算 → digest/refreshedAt
        ├ getSkillsForManagement(seededNames)   ← 【新增】分组投影（无 content）
        ├ getSkillsForUI(seededNames)           ← 不改（48 的收窄投影）
        ├ setSkillDisabled / deleteUserSkill    ← 【新增】
        └ MANAGE_SKILL_ERROR（+ NOT_USER_OWNED）
                       │
                       ▼ 沙箱 ExecutionEnv（agent-workspace.createSandboxEnv）
        listDir / fileInfo / exists / remove({recursive:true})
        agent-workspace/skills/<name>/         (source=user)
        agent-workspace/managed-skills/<name>/ (source=managed，seeded 亦在此)
                       ▲
        configStore('settings.aiSkills.disabled') ── 被 refreshSkills 的调用方读取
```

### Recommended Project Structure

```
（无新目录；改动全部落在既有文件 + 一个新测试文件）
ai-skills-manager.js        # 管理投影 / 体积遍历 / setSkillDisabled / deleteUserSkill / 第十码
ai-manager.js               # 转发方法 + ensureSkillsFresh + 写路径收口（sync 恰一次 + 补播）
main.js                     # MAX_JSON_BODY_BYTES / readJsonBody(maxBytes) / handleSkillsApi / 分发分支
                            #   + sendJson 幂等护栏 + 两个书签端点的 maxBytes 覆盖 + settings/update 校验
ipc-handlers.js             # 三个管理通道（与 ai:get-skills / ai:refresh-skills 并列）
src/preload.js              # realmAPI 新方法
src/settings.html           # 「技能管理」区 DOM + <script src="skill-picker-model.js">
src/settings-page.js        # 渲染 / 启停 / 卸载确认 / 诊断展开 / inline hint
src/skill-picker-model.js   # STATUS_TEXT 加第 5 条 disabled
docs/product/ai-skills.md   # 新增管理面章节（建议 §十二）
AGENTS.md                   # 维护约定 + 测试清单（含九码→十码、新测试套件）
tests/test-skills-management.js   # 新增（或并入 test-ai-skills.js）
```

### Pattern 1: 管理投影 —— 体积/文件数的递归遍历（本阶段最需要写对的一段）

**What:** 在 `refreshSkills()` 的 ④ 定序之后、⑤ 禁用标记之前，对每条缓存条目做一次**逐技能**递归遍历，把 `bytes` / `fileCount` 挂到条目上，供新增的管理投影消费。

**When to use:** 只在 `refreshSkills()` 内。**绝不能**在读取投影时做 IO（G-42-4 / D-13）。

**关键实测事实**（探针 `walkprobe.js`，Electron 43.6.0 / Node 24.20.0）：

```
listDir(skills/demo) → ok=true
  [{n:'.DS_Store',   k:'file',      s:500},   ← 隐藏文件**会**被返回（必须显式过滤）
   {n:'SKILL.md',    k:'file',      s:120},   ← 真实字节数
   {n:'escape-link', k:'symlink',   s:4},     ← 链接的 size 是**链接路径长度**，非目标大小
   {n:'loop-link',   k:'symlink',   s:89},
   {n:'references',  k:'directory', s:96},    ← 目录也有非 0 size（不可当文件字节累加）
   {n:'scripts',     k:'directory', s:96}]
listDir(escape-link → /etc)           → ok=false, code=permission_denied   ← 沙箱挡住外逃
listDir(loop-link  → 工作区内目录)     → ok=true                            ← 内部链接**可穿**（无限递归风险）
fileInfo(SKILL.md)                    → {kind:'file', size:120}
exists(<不存在的路径>)                → {ok:true, value:false}              ← 不是错误
remove(dir, {recursive:true})         → {ok:true}，目录确实消失
```

**遍历规则（每条都有实测依据）：**

| 规则 | 依据 |
|------|------|
| `entry.kind === 'symlink'`：**完全跳过（不递归、不计字节）** | 内部符号链接可穿 ⇒ 递归会无限循环；外逃链接 `listDir` 返回 `permission_denied` ⇒ naive 递归虽会被沙箱拦住，但会产生无意义诊断噪音 |
| `entry.kind === 'directory'`：递归，**不加** `size` | 目录 `size` 实测 96 字节，是 inode 数据不是技能内容 |
| `entry.kind === 'file'`：`bytes += size`，`fileCount += 1` | `FileInfo.size` 实测等于真实字节数 |
| `entry.name.startsWith('.')`：完全跳过 | `listDir` 实测**会**返回 `.DS_Store`（D-13 要求排除） |
| 遍历起点 = `path.dirname(entry.skill.filePath)` | 目录名才是权威（46 D-08）；SDK 的 `Skill` 无位置字段 |
| 逐技能 `try/catch`：失败 → 该技能 `bytes=0/fileCount=0` + 一条 `realm_` 诊断；**不得**中断整批 | D-05 第 1 层「单技能失败跳过，其余照常」；整批 catch 会走 `_cache` 回滚，把一次 stat 失败放大成技能集消失 |
| 任何 Result 的 `ok !== true` 一律当「读不到」处理（不 throw） | 沙箱契约：FileSystem 永不 throw，失败编码进 Result（`agent-workspace.js:12-15`） |

**参考实现骨架**（落地时按 plan 的命名调整）：

```js
// ai-skills-manager.js —— 挂在新常量下，随模块导出供单测
const SKILL_SIZE_WALK_MAX_ENTRIES = 5000;   // 防御性上限（见 Open Q4）
const SKILL_SIZE_WALK_MAX_DEPTH = 16;

/** 递归统计技能目录：返回 {bytes, fileCount, errors:[]}；永不 throw */
async function measureSkillDir(env, dir) {
  let bytes = 0, fileCount = 0, entries = 0;
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
        message: `技能目录不可读（沙箱码 ${(res && res.error && res.error.code) || 'unknown'}）: ${p}`, path: p });
      return;
    }
    for (const e of res.value) {
      if (!e || typeof e.name !== 'string' || e.name.startsWith('.')) continue;  // 隐藏文件不计
      if (e.kind === 'symlink') continue;                                        // 不穿链接
      entries += 1;
      if (entries > SKILL_SIZE_WALK_MAX_ENTRIES) {
        errors.push({ level: 'warning', code: 'realm_skill_dir_too_many_entries',
          message: `技能目录条目超过 ${SKILL_SIZE_WALK_MAX_ENTRIES} 个，统计已截断`, path: p });
        return;
      }
      if (e.kind === 'directory') { await walk(e.path, depth + 1); continue; }
      if (e.kind === 'file') { bytes += Number.isFinite(e.size) ? e.size : 0; fileCount += 1; }
    }
  };
  await walk(dir, 1);
  return { bytes, fileCount, errors };
}
```

⚠️ **`SKILL.md` 的 `size` 要不要算进 `bytes`**：D-13 的口径是「该技能目录的**全部子项**（含 `scripts/` / `references/` / 任意嵌套），累加字节数与文件数」+「隐藏文件不计入」——按字面 `SKILL.md` 计入（它就是技能正文，也是用户最关心的体量）。**但必须在产品文档与 UI 文案里写清**，否则用户会看到 `64.1 KB` 而 `LIMITS.MAX_SKILL_MD_BYTES` 是 `65536`（64 KiB）而困惑。建议：`bytes` 含 `SKILL.md`，文档明写「含 `SKILL.md` 自身」。

### Pattern 2: 管理面投影（新增，不扩展 `getSkillsForUI()`）

**What:** 一个同步、零 IO 的投影函数，返回**已分组**（D-01 三组）且组内已按 `bySkillPriority` 全序排列的结构。

**形状建议**（Claude's Discretion 的裁决落点）：

```js
getSkillsForManagement(seededNames)
// → {
//     groups: [ { tier: 'user',    items: [...] },
//               { tier: 'builtin', items: [...] },
//               { tier: 'managed', items: [...] } ],   // 空组已剔除
//     errors: [ ... ],        // 模块级 _cache.errors（D-11 顶部汇总条）
//     refreshedAt: number,
//     digest: string,
//     limits: { maxSkillMdBytes, maxUserSkills, maxManagedSkills,
//               skillsPromptCharBudget, maxDescriptionChars }
//   }
```

- 每组 `items[]` 的条目字段 = `toUISkillEntry` 的**全部字段**（`name` / `description` / `tier` / `disableModelInvocation` / `disabled` / `shadowed` / `shadowedBy?` / `overLimit` / `promptOmitted`）**加上** `bytes` / `fileCount` / `diagnostics[]`（深层拷贝）。**仍不带 `content`**。
- **`limits` 回传的理由**：Claude's Discretion 明文「设置页不得写死任何限额数值」⇒ 限额必须由主进程回传（`LIMITS` 见 `ai-skills-manager.js:48-54`，数值单源）。
- **空组不渲染**：建议**主进程剔除空组**（D-03 要求分组在主进程）并在文档写明，避免前端出现第二套「空组判定」。
- **上界核算**：100 条技能 × (描述 ≤1024 字符 + 诊断若干 + 数值字段) —— 最坏约 200 KB（**没有正文**）。远小于 `getSkillsForUI()` 省的 ~3 MB。

### Pattern 3: 两个入口共用同一 manager 函数（判据 4 的实现）

```js
// ipc-handlers.js —— 转发层，零判定
ipcMain.handle('ai:get-skills-management', async (event) => {
  assertTrustedSender(event);            // 拒 guest（BrowserWindow.fromWebContents(guestWC) === null）
  if (!aiManager) throw new Error('AI Manager 未初始化');
  return aiManager.getSkillsForManagement();   // → ai-skills-manager.getSkillsForManagement(seededNames)
});
```

```js
// main.js —— 转发层，零判定
async function handleSkillsApi(req, res, reqUrl) {
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) { sendJson(res, 403, { error: 'Forbidden' }); return; }
  try {
    const route = reqUrl.pathname.replace('/api/skills/', '');
    if (route === 'list' && req.method === 'GET') {
      sendJson(res, 200, await aiManager.getSkillsForManagement());   // 同一个 manager 方法
      return;
    }
    if (route === 'set-disabled' && req.method === 'POST') {
      const { name, disabled } = await readJsonBody(req);
      sendJson(res, 200, await aiManager.setSkillDisabled(name, disabled));
      return;
    }
    if (route === 'uninstall' && req.method === 'POST') {
      const { name } = await readJsonBody(req);
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

分发分支插在 `/api/ai-memory` 之后、`/api/devrequests/` 之前（`main.js:2754` 附近），保持 `handleXxxApi` 既有排列。

⚠️ **错误形状**：业务的 `code`（如 `not_user_owned`）必须回传给前端（D-08 要「用户看到真实原因」），但 HTTP 状态码建议统一 400（既有 `/api/*` 范式），由 `{ error, code }` 承载语义 —— 前端按 `code` 查表，不解析 message。

### Pattern 4: 写路径收口（`syncAgentSystemPrompt()` 恰一次 + 调用侧补播）

```js
// ai-manager.js（新方法；**不得**把补播挪进 syncAgentSystemPrompt() 的函数体）
async setSkillDisabled(name, disabled) {
  const check = getAiSkillsManagerLazy().validateManagedSkillName(name);
  if (!check.ok) throw makeManageSkillErrorLike(check.code, check.reason);   // 复用同一份校验器
  const list = this.configStore.get('settings.aiSkills.disabled', []);
  const current = Array.isArray(list) ? list.slice() : [];
  const next = disabled ? [...new Set([...current, name])] : current.filter((n) => n !== name);
  this.configStore.set('settings.aiSkills.disabled', next);   // 同步写 → 下一次 sync 一定读得到
  await this.syncAgentSystemPrompt();                          // 内含恰一次 refreshSkills
  windowManager.broadcast('skills:changed');                   // 调用侧补播（忙时分支的唯一来源）
  return this.getSkillsForManagement();
}
```

- configStore 的 `set` 是**同步**的，`ai-manager` 与 `main.js` 共享**同一个 `Store` 实例**（`main.js:112` 建实例 → `aiManager.init(configStore)` 注入，`ai-manager.js:778`）⇒ 写后立刻 `syncAgentSystemPrompt()` 必然读到新名单（三处读取点均是 `this.configStore.get('settings.aiSkills.disabled', [])`）。
- 增量载荷 `{name, disabled}` 在**主进程内**做读-改-写（同步），两个并发的设置页操作不会互相覆盖 —— 这是选增量而非全量的**实现层理由**（不只是语义偏好）。
- 卸载路径额外一步：写盘成功 → `configStore.set('settings.aiSkills.disabled', current.filter(n => n !== name))`（D-09 派生不变式）→ 再 sync + 补播。

### Anti-Patterns to Avoid

- **把体积/文件数塞进 `computeDigest`**：加一个 `references/notes.md` 就会触发 systemPrompt 改写 + 广播（provider 前缀缓存 miss）。digest 的成文契约是「影响 **prompt 段**的全部因素」（`ai-skills-manager.js:170-184`），尺寸不影响 prompt ⇒ **不进 digest**。
- **反过来「精简」digest**（摘掉 `disabled`/`shadowed`/`overLimit`）：会**同时**打断 `syncAgentSystemPrompt()` 的改写广播与 renderer 的 `pullAiSkillsSnapshot` digest 早退（`src/renderer.js:9134`）⇒ 跨窗口同步静默失效。
- **在 `syncAgentSystemPrompt()` 函数体内加广播或加 `refreshSkills()`**：46-04 的方法体源码断言（`tests/test-ai-skills.js:1299-1306`、`:2299-2303`）+ L 组次数账（`:3289` / `:3455` 的 `rescanCalls === 2`）会同时转红。
- **在管理投影读取时实时遍历磁盘**：违反冻结快照（G-42-4），把「打开设置页」变成 100 次目录 stat。
- **`req.destroy()` 拒收超限请求体**：客户端拿 EPIPE 而非 413（实测），判据 5 的「返回明确错误」不成立。
- **`sendJson` 无幂等护栏**：`readJsonBody` 自己答了 413 又 reject，外层 12 个 handler 的 `catch` 会再 `sendJson` → `ERR_HTTP_HEADERS_SENT` 在 async handler 内抛出 → unhandled rejection（实测）。
- **直接 `fs` 遍历技能目录**：绕过 `resolveInside` 的 realpath 复核，等于给「运维/统计」开一个新的越界读入口。
- **在设置页写死限额数值**（`64 KiB` / `50` / `8000`）：45/46 建立的「端点与前端零字面量」纪律；限额一律取管理投影回传值。
- **在主窗口新造技能管理 UI**：D-17 明确为新能力，不属本阶段。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 技能目录递归统计 | 自己写 `fs.readdirSync` + 自造路径校验 | 沙箱 `env.listDir`（`FileInfo[]` 已含 `kind` / `size`） | 沙箱自带 `resolveInside` 双基准 + realpath 复核（`agent-workspace.js:162-192`）；自造即第二个校验实现 |
| 技能名校验 | 在 `main.js` / 设置页再写一份正则 | `ai-skills-manager.validateManagedSkillName`（`ai-skills-manager.js:1034`） | 49-01 明文：该模块是 50/51 唯一可复用的那一份；第二份必然漂移 |
| 三档来源判定 | 前端按目录名/字段猜 | `sourceTierOf`（`ai-skills-manager.js:776`） | 46 D-06 / 48 D-14 已锁；seeded 集合由主进程注入 |
| 状态标注文案 | 设置页新写「已禁用」「已遮蔽…」 | `STATUS_TEXT`（`src/skill-picker-model.js:239-244`） | D-12；同一状态两处文案必然漂移（48/49 已付代价） |
| 请求体长度上限 | 读完再 `body.length` 判 | 累积中判 + 立即停收（Pitfall 1） | 实测：40 MB body 全量累积 → 堆 +85 MB；停收形态 +0~1 MB |
| 递归删除 | 自己 `fs.rmSync` | `env.remove(dir, { recursive: true })` | `recursive` 默认 **false**（`nodejs.js:602-610` 的 `recursive ?? false`）；沙箱版含路径校验 |
| 体积格式化 | 新写一套单位换算 | 沿既有「逐页局部实现」惯例（`src/renderer.js:11316` 的 `formatFileSize` 同款） | 既有惯例就是逐页局部；**但不得写死限额数值** |
| 原子写 | — | 本阶段无内容写入，无需 | 只在 Phase 51 导入落盘时用 `atomicWriteSkillFile` |

**Key insight:** 本阶段几乎全部零件都已存在，真正的风险不在「写代码」而在**接线点选错**（digest 的输入面、遍历的挂载点、拒收的时序），这三处错一个都会**静默**失效（无异常、无日志），因此每条都要有对应的行为断言。

---

## Common Pitfalls

### Pitfall 1: 「立即拒收」的实现形态选错 ⇒ 客户端拿到 EPIPE，413 永远看不到

**What goes wrong:** 按 D-16 字面「`req.destroy()`」实现后，超限请求的客户端（浏览器 `fetch`）收到的是网络错误而不是 413 JSON ⇒ ROADMAP 判据 5 的「返回明确错误」不成立，前端只能显示通用失败文案。

**Why it happens:** `req.destroy()` 或 `Connection: close` 会在响应被客户端读取前撕掉 socket；而客户端此刻**仍在写** body。

**How to avoid（实测通过的唯一形态）：**
1. 用一个 `rejected` 标志停止累加（`if (rejected) return;`），**不再拼接 `body`**；
2. `sendJson(res, 413, { error, limit })`，**不设 `Connection: close`**；
3. **不要** `req.destroy()`；改为 `req.resume()`（或让既有的 `data` 监听继续消费并丢弃）——内存保持 O(1)，响应干净送达。

**实测证据**（Electron 43.6.0 / Node 24.20.0，40 MiB body，1 MiB 上限）：

| 形态 | 客户端 | 堆增长 |
|------|--------|--------|
| 现状 `body += chunk` | **200**（超限照样收下） | **+85 MB** |
| `sendJson(413)` + `req.destroy()` | **EPIPE** | +11 MB |
| `sendJson(413)` + `Connection: close` + `req.resume()` | **EPIPE** | — |
| **`sendJson(413)` + `req.resume()`（无 `Connection: close`）** | **413 + JSON** | **+1 MB** |
| `sendJson(413)` + `req.pause()` | 413（但客户端留在等 `drain` 的悬挂态） | +0 MB |

**Warning signs:** 设置页的 413 处理分支从未被触发；或浏览器 Console 出现 `Failed to fetch` 而非 413 文案。

### Pitfall 2: `readJsonBody` 自己答了 413 又 reject ⇒ 外层 catch 二次 `sendJson` ⇒ `ERR_HTTP_HEADERS_SENT`（unhandled rejection）

**What goes wrong:** 12 个 handler 的形状都是「`try { … await readJsonBody(req) … } catch (err) { console.error(…); sendJson(res, 400, { error: err.message }); }`」。若 `readJsonBody` 已 `res.end(413)` 之后仍 `reject`，每个 catch 都会再写一次头 → 抛 `ERR_HTTP_HEADERS_SENT`；而 `realmServer` 的回调是 `async`（`main.js:2704`），HTTP 层**不接管**返回的 Promise ⇒ **unhandled rejection**（实测 `second-sendJson-THREW:ERR_HTTP_HEADERS_SENT`）。

**How to avoid:** 给 `sendJson` 加**幂等护栏**（一处修好全部 13 个发送点）：

```js
function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;   // 已答过即 no-op（判据 5 的拒收路径必需）
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
```
实测：护栏生效后 catch 路径返回 `noop`，`process.on('unhandledRejection')` **未触发**，客户端仍拿到 413。

**另一条可选做法**（二选一，别都做）：`readJsonBody` 拒收时用**专属错误码**（如 `err.code = 'BODY_TOO_LARGE'`）reject，让 catch 能识别并跳过二次应答；但 57 个调用点只有 12 个 catch，护栏的改动面更小、且顺带加固了所有既有的双答路径。**推荐护栏**。

**Warning signs:** 主进程日志出现 `ERR_HTTP_HEADERS_SENT`；或 Electron 主进程直接退出（unhandled rejection 默认致命）。

### Pitfall 3: 全局 1 MiB 默认打断 `/api/favorites/import-chrome` 与 `/api/favorites/import-html`

见「修正 3」。这两个端点承载**用户书签文件全文**（`src/favorites-page.js:2245` `file.text()` → `{ content }`），真实导出常见 1–10 MB。

**How to avoid:** 落地 D-16 时**逐个复审** 57 个调用点，给有真实大 body 的端点显式 `{ maxBytes }`。完整清单（本会话 `grep -c "await readJsonBody(req)" main.js` = **57**，按所属 handler 计数）：

| Handler | 调用点数 | 其中可能大 body 的端点 |
|---------|---------|----------------------|
| `handleHistoryApi` | 3 | — |
| `handleFavoritesApi` | 17 | **`import-chrome`（`:1157`）**、**`import-html`（`:1177`）**、次要：`items`（`:1132`）/`folders`（`:1140`）批量重排 |
| `handleSettingsApi` | 10 | `update`（`:1373`，任意键值）、`ai/providers/:id/detect-models`（`:1643`） |
| `handleSearchConfigApi` | 2 | — |
| `handleDevRequestsApi` | 2 | — |
| `handleDownloadsApi` | 6 | — |
| `handleTasksApi` | 3 | — |
| `handleCredentialsApi` | 3 | — |
| `handleAddressApi` | 2 | — |
| `handleRulesApi` | 5 | `import`（`:2562`，批量规则） |
| `handleShortcutsApi` | 2 | — |
| `handleAiMemoryApi` | 1 | 受 `ai-memory-manager.BUDGETS` 自限 |
| （内联分支）`/api/bookmarks-bar/toggle`（`:2825`） | 1 | — |

⇒ **`main.js` 里 `readJsonBody` 的调用点分属 11 个具名 handler + 1 个内联分支，共 57 处**（`handleAiMemoryApi` 1 处 + 内联分支 1 处；按 `async function handle…` 归纳时二者会被合并计数，故上表的 12 行与 57 的对应关系要按行读）。

**Warning signs:** 用户报告「导入书签失败：body too large」；或设置页保存大配置时 413。

### Pitfall 4: 递归遍历穿符号链接 ⇒ 无限递归

**What goes wrong:** `skills/foo/references/self → references`（或任何指向祖先的内部链接）会让递归永不终止；遍历发生在**每次 Agent 创建/重建**的 `refreshSkills()` 里，等于把主进程卡死。

**Why it happens:** 实测 `listDir` 对**工作区内**的符号链接返回 `ok:true`（沙箱的 realpath 复核发现它落在 root 内 ⇒ 放行），因此穿链接不会被拦；只有**外逃**链接（→ `/etc`）才被 `permission_denied` 挡住。

**How to avoid:** 显式 `if (entry.kind === 'symlink') continue;`（要不要计 1 个文件 + 其链接 size 是产品口径问题，但**绝不能递归**）。加 depth 上限作为第二道防线。

**Warning signs:** `npm run dev` 后主进程 CPU 100%、`refreshSkills` 不返回；或 `realm_skill_dir_too_deep` 诊断刷屏。

### Pitfall 5: 目录 `size` 与隐藏文件被算进体积

**What goes wrong:** 体积显示比实际大、且随机漂移（macOS 下 Finder 浏览就新增 `.DS_Store`）。

**Why it happens:** `listDir` 返回的**目录**条目 `size` 非 0（实测 96 字节，是 inode 大小）；`.DS_Store` 是普通 `kind:'file'` 且 `size:500`。

**How to avoid:** 只对 `kind === 'file'` 累加；`name.startsWith('.')` 一律跳过；**并把口径写进 `docs/product/ai-skills.md`**（D-13 明写要求）。

**Warning signs:** 用户改一次 Finder 视图，体积数就变；或空技能目录显示 96 字节。

### Pitfall 6: 拿 `refreshSkills()` 的返回值做前后对比 —— 它是**活引用**

**What goes wrong:** `const a = await refreshSkills(...); const b = await refreshSkills(...); a.digest === b.digest` **恒真**（两次拿到的是同一个模块级 `_cache` 对象）。

**Why it happens:** `refreshSkills` 末尾 `return _cache;`（`ai-skills-manager.js:729`），`_cache` 是模块级单例。

**How to avoid:** 需要快照时用 `getSkillsSnapshot()`（浅拷贝）或立即取**值**副本（`{digest, promptBlock}`）。本会话的第一次探针就踩了这个坑（全部显示 UNCHANGED，看起来像「digest 含 `disabled` 但不生效」的假结论）——**写测试时同样要防这个假绿/假红形态**。

### Pitfall 7: 设置页是纯 HTTP guest —— 广播到不了它，且 CSP 禁内联 style

**What goes wrong:** 在设置页里等 `skills:changed` 或写 `<div style="display:none">` 都会静默失效。

**Why it happens（均已核实）：**
- `realm://settings` 经 `realmUrlToHttp()`（`src/renderer.js:368-377`）变成 `http://localhost:<port>/settings?container=…&token=…`，由 `createWebviewForTab()`（`src/renderer.js:1322`）创建为 **`<webview>`**，`preload` 指向 `webview-preload.js`（**不是** `src/preload.js`）⇒ guest **没有** `realmAPI`。
- `windowManager.broadcast()`（`window-manager.js:310-316`）逐 `windows` Map 调 `win.webContents.send` ⇒ 只到各 **BrowserWindow** 的 webContents，**不到 webview guest**。
- `src/settings-page.js` 实测零 `realmAPI` / 零 `ipcRenderer` / 零 `require(`，纯 `fetch`。
- `realm://` 页面 CSP `style-src 'self'` ⇒ markup 内联 `style="display:none"` 被拦（AGENTS.md 明文）。

**How to avoid:** 每次操作成功后**自行重拉列表**（用响应体直接替换本地 state 最省，见 Pattern 4 的返回值）；进入页面时拉一次；确认框走 div 遮罩 + CSSOM `display` 切换、初始隐藏走 CSS 类。属性上下文（`title` / `aria-label`）的新插值必须走 DOM API（`textContent` / `setAttribute`）—— `escapeHtml` **不转义引号**（TD-48-01 挂账），不得扩大缺口。

**Warning signs:** 设置页 Console 里 `window.realmAPI` 为 `undefined`；确认框一进页面就可见（内联 style 被 CSP 拦）。

### Pitfall 8: 未配 provider 时管理区整片空白（见「修正 2」）

**How to avoid:** 读路径加 `ensureSkillsFresh()`（懒建 `sandboxEnv` + 无 agent 时直接 `refreshSkills`）。**同时**要在管理投影里把「缓存从未刷新过」这个状态表达出来：若 `refreshedAt === 0` 就说明从未成功加载（**不要**渲染成「没有技能」），建议在区顶部给一条 `warning` 说明（复用 D-11 的汇总条位置）。

**Warning signs:** 新装 Realm + 未配 Key → 打开设置页看到「暂无技能」，而 `~/Library/Application Support/realm/agent-workspace/managed-skills/` 下有两个内置技能目录。

### Pitfall 9: `settings.aiSkills.disabled` 的校验与两种键形态

**What goes wrong:** 校验只覆盖 `key === 'aiSkills.disabled'`，但 `/api/settings/update` 的循环是 `configStore.set('settings.' + key, value)`（`main.js:1391`）—— 手改 URL 提交 `{ "aiSkills": { "disabled": [ … ] } }` 时 `key === 'aiSkills'`，会把**整个 `settings.aiSkills` 对象**覆写掉（顺带绕过只针对点号键的校验）。

**How to avoid:** 校验分支同时覆盖 `key === 'aiSkills'`（校验 `value.disabled`，并按需拒绝未知子键）与 `key === 'aiSkills.disabled'`。校验面 = 数组 + 每项非空字符串 + 形态 + 条数上限 + 单条长度上限。

**关于「用哪一份名称校验器」的两难（见 Open Q2）**：`validateManagedSkillName` 是**写入侧**的严格校验器（`^[a-z0-9-]+$` + 长度 + 首尾/连续连字符），而加载管线对磁盘上已存在的技能是**故意宽松**的（46 D-08「不丢弃命名不规范的合法技能」）。用严格校验器会让「bash 造出的 `My_Skill/` 目录」变成**无法禁用**的技能（设置页点开关即 400）。建议：安全面的真实目标是挡住**路径样字符串 / 超大数组 / 非字符串**，因此校验谓词取「非空字符串 + 长度 ≤ 64 + 不含 `/` `\` `.` 与控制字符 + 总条数 ≤ 上限」的**安全超集**，并在文档写明这条**故意的宽严差异**；若坚持用严格校验器，设置页必须对不合格式的技能禁用开关并给出说明（否则就是「点了才知道不行」）。

### Pitfall 10: 只读路径 / 管理投影的字段名与「第二份实现」诱惑

**What goes wrong:** 把 `bytes` / `fileCount` 并进 `toUISkillEntry`（省一个函数），或在前端重算分组/排序。

**How to avoid:** 严守 D-13（新投影不扩展 `getSkillsForUI()`）与 D-03（分组排序在主进程）。**把理由写进源码注释**（两个消费者的字段需求不同；`/` 面板 IPC 不应白传 100 条诊断与遍历结果），否则后续很容易以「消除重复」为名合并回去。

### Pitfall 11: 测试计数账本会因新增用例而转红

`docs/product/ai-skills.md` §七/§11.8 与 `AGENTS.md` 测试行里的 `NN 例` 是**机械判据**（见 Validation Architecture 的 counts-parity 命令，要求 ≥8 个账本单元与实测 `# tests` 逐字一致）。新增测试必然改实测值 ⇒ **必须同步刷三处账本**，且在**最后一个**改动测试的 plan 里执行（否则中途 red）。

### Pitfall 12: 面板的「已禁用」不可见性依赖 digest 早退的反面

`src/renderer.js:9134` 的 `if (snapshot.digest === state.aiSkillsDigest) return;` 意味着：**任何**广播（含本阶段的补播）在 digest 未变时都不会触发重渲染。⇒ 想让「禁用后 `/` 面板隐藏该技能」生效，**必须**保证 digest 随禁用变化（现状成立，见修正 1）。若日后有人把 `disabled` 从 digest 摘掉，即使补播一百次面板也不会更新 —— **补播不能替代 digest**。

---

## Code Examples

### `readJsonBody` with an immediate-reject body cap（SEC-09 的实现形态，实测）

```js
// main.js —— 单源常量（数值只此一份，端点/前端零字面量）
const MAX_JSON_BODY_BYTES = 1024 * 1024;                 // 1 MiB 全局默认（D-16）
const MAX_JSON_BODY_BYTES_LARGE = 32 * 1024 * 1024;      // 需要大 body 的端点（书签导入）显式覆盖

/**
 * 读取并解析 POST 请求的 JSON body（带体积上限）
 *
 * 超限即**停止累积**并答 413；**不断连**（实测 `req.destroy()` / `Connection: close`
 * 会让客户端拿 EPIPE 而非 413）。已答过 413 后仍会 reject 一个带 code 的错误，
 * 外层 handler 的 catch 二次 sendJson 由 sendJson 的幂等护栏吸收。
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res - 由调用侧传入（既有调用点均可就地取到）
 * @param {{maxBytes?: number}} [options]
 */
function readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;                       // 停止累积（关键：不再拼 body）
      size += chunk.length;
      if (size > maxBytes) {
        rejected = true;
        sendJson(res, 413, { error: `请求体超过上限（${maxBytes} 字节）`, limit: maxBytes });
        req.resume();                             // 继续丢弃读入 ⇒ 内存 O(1) 且响应可达
        reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE' }));
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

> 签名两选一（`(req, res, opts)` 或闭包持有 `res`），但**必须让「答 413」只有一个实现处** —— 57 个调用点不得各写一份拒收文案。若坚持 `(req, { maxBytes })` 的两参形态，则 `sendJson` 需能从 `req` 反查 `res`（`req.socket` 上不可靠），因此**推荐三参**或闭包形态。

### 大型端点显式覆盖（Pitfall 3 的修法）

```js
// handleFavoritesApi
if (route === 'import-chrome' && req.method === 'POST') {
  const { filePath, content } = await readJsonBody(req, res, { maxBytes: MAX_JSON_BODY_BYTES_LARGE });
  …
}
if (route === 'import-html' && req.method === 'POST') {
  const { filePath, content, mode } = await readJsonBody(req, res, { maxBytes: MAX_JSON_BODY_BYTES_LARGE });
  …
}
```

### 管理投影内的遍历挂载点（`refreshSkills` ④ 之后）

```js
    _cache.skills = applyShadowing(entries).sort(bySkillPriority);

    // ④.5 尺寸统计（D-13）：在重扫管线内算一次并缓存；**不进 computeDigest**（尺寸不影响 prompt）。
    //      逐技能隔离失败：任何一项读不到只影响它自己 + 一条诊断，不得让整批走 catch 回滚。
    for (const entry of _cache.skills) {
      const dir = path.dirname(entry.skill.filePath);
      const measured = await measureSkillDir(env, dir);       // 见 Pattern 1 骨架，永不 throw
      entry.bytes = measured.bytes;
      entry.fileCount = measured.fileCount;
      for (const d of measured.errors) pushEntryDiag(entry, d);
    }

    // ⑤ 启用/禁用…
```
⚠️ 用**原始 sandbox `env`** 而不是 `skillsEnv`：`createSkillsEnv().listDir` 只在**扫描根**上过滤非目录条目（`ai-skills-manager.js:241-251` 的 `isScanRoot(p)`），技能子目录不受影响；用哪个都能跑通，但用原始 `env` 语义更直白（尺寸统计与「加载面收窄」无关）。

### D-08 的第十码与「仅 user 可删」的判据

```js
// ai-skills-manager.js
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
  NOT_USER_OWNED: 'not_user_owned',   // ← 第十码（D-08）
  UNKNOWN: 'unknown',
};

/**
 * 卸载用户技能（**方向与 resolveManagedTarget 相反**：只认 user 目录，不碰 managed）
 * 判据一律读盘（env.exists），不用缓存快照 —— bash 可随时改盘。
 */
async function deleteUserSkill(env, { name } = {}) {
  const skillName = typeof name === 'string' ? name.trim() : name;
  const nameCheck = validateManagedSkillName(skillName);
  if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);

  const userDir = path.join(getAgentWorkspaceLazy().getSkillsDir(), skillName);
  const existsUser = await env.exists(userDir);
  if (!(existsUser && existsUser.ok === true && existsUser.value === true)) {
    throw makeManageSkillError(MANAGE_SKILL_ERROR.NOT_FOUND,
      `技能 "${skillName}" 不存在（只能卸载 skills/ 目录下的用户技能）`);
  }
  // ⚠️ 同名双存在时的语义见 Open Q1 —— 二选一必须显式落定并成文
  const res = await env.remove(userDir, { recursive: true });
  if (!res || res.ok !== true) {
    throw makeManageSkillError(MANAGE_SKILL_ERROR.UNKNOWN,
      `卸载技能 "${skillName}" 失败（沙箱码 ${sandboxErrorCode(res)}）`);
  }
  return { name: skillName, filePath: path.join(userDir, 'SKILL.md'), action: 'uninstall' };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无体积/文件数（48 明文「那是 Phase 50 的职责」） | 重扫期内递归统计 + 缓存 | 本阶段 | 需明确「含 `SKILL.md`」「排除隐藏文件」「不穿链接」「目录 size 不累加」四条口径 |
| `/api/*` POST body 无上限 | `readJsonBody(req, res, { maxBytes })` 默认 1 MiB | 本阶段（SEC-09） | 57 个调用点位置参数形态 ⇒ 加可选参数零语义改动；但两个书签端点必须覆盖 |
| 技能集只有 `/` 面板一个消费面 | 新增管理面投影（第二消费面，字段更宽） | 本阶段 | `getSkillsForUI()` 保持收窄（D-13） |
| 设置页只有「AI 记忆 / 白名单 / 视觉模型」三块 | 新增「技能管理」区（汇总条 + 三档分组） | 本阶段 | 需在 `settings.html` 引入 `skill-picker-model.js` |
| `MANAGE_SKILL_ERROR` 九码 + `unknown` | **十码** + `unknown`（+ `not_user_owned`） | 本阶段（D-08） | 三处账本 + 一条冻结断言必须同批刷新（见 Open Q3） |

**Deprecated/outdated:**
- `req.on('aborted')`：Node 已标记其过时（改用 `'close'` / `req.destroyed`）。本阶段的拒收路径**不需要**任何生命周期事件，别为此引入新监听。（实测 `destroy()` 时 `'aborted'` 与 `'close'` 都会触发，但既然不 destroy，二者都不必要。）
- 把「读完再判长度」当体积防护：实测 40 MB body 会吃掉 85 MB 堆，且返回 200 —— 不是防护。

---

## Phase 51 体积上限交接（SEC-09 的数值形状评估）

**问题：** SEC-09 的上限值由本阶段定，Phase 51 要传 zip base64。D-16 的形状（默认 1 MiB + 端点显式覆盖）是否够用？

**PITFALLS P7 已定的解压侧限额（`.planning/research/PITFALLS.md:307`）：** 单 entry 解压 ≤ 1 MB（`SKILL.md` 按 64 KB 卡）、**累计**解压 ≤ 32 MB、entry 数 ≤ 2000、压缩比 ≤ 100:1、嵌套深度 ≤ 8。P9 另定网络下载流式上限 ≈ 20 MB（`:378`）。

**推导（base64 over JSON 路线）：**
- 最坏情形是**近乎不可压缩**的 zip：其压缩后大小 ≈ 解压后内容大小 ⇒ 上界取累计解压上限 **32 MiB = 33,554,432 B**；
- base64 膨胀 `4 × ceil(n/3)` ⇒ 44,739,244 B ≈ **42.67 MiB** 的字符串，再加 JSON 信封（`{"name":…,"zipBase64":"…"}`）几十字节；
- ⇒ Phase 51 的导入端点应显式声明 **`{ maxBytes: 48 * 1024 * 1024 }`**（50,331,648 B，对 42.67 MiB 留 ≈ 12% 余量）。低于 44.74 MiB 会在合法的大技能包上 413。

**结论：形状够用，但要满足两个前提条件：**
1. **`maxBytes` 必须可覆盖**（D-16 已锁），且覆盖值**在端点处显式书写**（漏写即在 413 处当场可见 —— 这正是该形状的价值）；
2. **推荐 Phase 51 评估「不 base64」的替代**：`fetch(url, { method:'POST', body: file })` + `Content-Type: application/zip` 直传原始字节，则上限只需 ≈ 32 MiB 且省掉 33% 的传输与整个 base64 字符串的解析峰值。代价是要为二进制流另写一个「流式累加 + 超限即停收」的读取函数（`readJsonBody` 是 JSON 专用）。**若选直传，SEC-09 的「不无上限读入内存」判据同样满足**（Pitfall 1 的 drain-and-respond 形态对二进制流同样适用），但它**不是**本阶段该做的决定 —— 本阶段只需保证 `readJsonBody` 的 `maxBytes` 面存在且默认 fail-closed。
3. **命名提醒**：`MAX_JSON_BODY_BYTES = 1 MiB` 与 P7 的「单 entry 解压 ≤ 1 MB」是**同一个数字、两个不同的量**。常量名与文档措辞必须能区分（例如 `MAX_JSON_BODY_BYTES` vs `MAX_ZIP_ENTRY_BYTES`），否则后续一定会有人把它们当成一个限额调。

**可选增强（低代价、明确收益）**：`readJsonBody` 在读第一个字节**之前**用 `req.headers['content-length']` 做一次预检，超过 `maxBytes` 直接 413（不读 body）—— 浏览器 `fetch` 会带 `Content-Length`，因此绝大多数超限请求会被**零字节读取**地拒掉，把「不无上限读入内存」做到极致。这与 Pitfall 1 的累积中判不冲突（前者是快路径、后者是兜底），**两者并存**；注意 `Content-Length` 可被伪造/缺失，因此不能取代累积中判。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 40 MB body 实测的「+85 MB 堆增长」可按线性外推到 Phase 51 的 zip base64 量级 | Pitfall 1 / Phase 51 交接 | 低 —— 量级结论不变；上限值另按 PITFALLS P7 口径推导 |
| A2 | `SKILL.md` 自身的 `size` 应计入技能 `bytes`（D-13 未逐字点名，按「全部子项」推断） | Pattern 1 | 中 —— 用户可能对「64.1 KB vs 64 KiB 上限」困惑；须在文档写明 |
| A3 | 设置页复用 `STATUS_TEXT` 需新增 `<script src="skill-picker-model.js">`（该文件当前确未被设置页加载，已核实；但「设置页加载它」的实际表现未跑过） | Pattern 2 / D-12 | 低 —— 该文件零依赖、双模式导出、纯函数；仍建议实测一次 CSP 下加载无副作用 |
| A4 | Electron 43.6.0 内 Node 24.20.0 的 `http` 行为与本机 Node 22.22.0 一致（**关键结论已在 Electron 内复跑**；仅 `Connection: close` 那条只在 Node 22 上跑过） | Pitfall 1 | 低 —— 不采用该形态，仅作反例 |
| A5 | `/api/skills/*` 统一 400 + `{error, code}` 符合既有 `/api/*` 惯例（既有端点确实如此，但用 403/404 区分语义是另一种合理设计） | Pattern 3 | 低 |
| A6 | 管理投影最坏 ~200 KB（100 条 × 描述 ≤1024 字符 + 诊断） | Pattern 2 | 低 —— 仅用于论证「不扩展 `getSkillsForUI()`」的价值；建议在验收里实测一次 |
| A7 | 设置页的「两次设置页实例不同步」在真实使用中可接受（D-18 已裁决，此处仅记录为假设） | Pitfall 7 | 低 —— 用户已显式接受 |

**若本表为空则表示无待确认项。** 上表 7 条中 **A2 / A3** 建议在 plan 期各补一次实测。

---

## Open Questions

1. **同名双存在时「仅 user 可删」的语义（D-07 字面 vs 判据 3 字面）**
   - **What we know:** D-07 给的判据是「读盘判 `skills/<name>` 是否存在 + `managed-skills/<name>` 是否存在 ⇒ 后者存在即拒」。但 `source === 'user'` 的条目在**同名双存在**（user 胜出、managed 被遮蔽）时**确实存在**，且列表里显示的 tier 就是 `user`（`applyShadowing` 保留败者并标 `shadowed`，`ai-skills-manager.js:451-472`）。
   - **What's unclear:** 按 D-07 字面，这类用户技能会被拒卸载（用户点自己列表里那条「我的技能」却被告知「不是你的」）—— 与 Success Criterion 3「卸载仅允许 `source === 'user'` 的技能」直接冲突。
   - **Recommendation:** 判据改为「`skills/<name>` 存在且其 `kind` 是目录」即允许（删除对象恒为 `skills/<name>/`）；`managed-skills/<name>` 的存在只用来**提示**（「同名托管/内置技能将在删除后重新可见」）而**不**用来拒绝。若采纳 D-07 原文，则必须在产品文档写明「同名双存在时用户技能的卸载入口亦被禁用」并说明理由（保守不出错，但用户体验悖论）。**需要一个显式裁决** —— 这是本阶段唯一会改变用户可见行为的分歧点。

2. **`settings.aiSkills.disabled` 的校验谓词宽严（见 Pitfall 9）**
   - **What we know:** 加载管线对磁盘上的技能名**故意宽松**（46 D-08），写入侧严格（`^[a-z0-9-]+$` + ≤64 + 无首尾/连续连字符）。
   - **What's unclear:** 把手动放进 `skills/My_Skill/` 的技能**禁用**时，严格校验器会拒绝（设置页开关 400）。
   - **Recommendation:** 用「安全超集」谓词（非空字符串 + ≤64 字符 + 无路径分隔符/控制字符 + 条数 ≤ 上限），并在文档写明这条**故意的不对称**（禁用名单是「按名字过滤」的消费侧信号，不需要名字合法到能写盘）。若 plan 选严格校验器，则设置页必须对不合格式的技能禁用开关并给出原因文案。

3. **`NOT_USER_OWNED` 放哪张表（D-08 的落点）—— 本阶段最需要「同步刷新账本」的一处**
   - **What we know（两张表 + 两处硬断言，均已本会话直读）：**
     - `MANAGE_SKILL_ERROR`（`ai-skills-manager.js:966-977`）现有 **10 键** = 九码 + `UNKNOWN`；被 `tests/test-manage-skill.js:1588-1621` 用 `deepStrictEqual` **逐字冻结**（键集合与值集合各一条断言）。
     - `MANAGE_SKILL_SHORT_REASON`（`src/skill-picker-model.js:408`）现有 **恰 9 键**；被 `tests/test-skill-picker-model.js:946` 断言 `Object.keys(table).length === 9`（「短原因表必须恰九条（D-07 的九码，不增不减）」）+ `:954-963` 逐字值断言。
     - `MANAGE_SKILL_ERROR` 的 JSDoc 自我定位是「**`manage_skill` 的**闭合原因码白名单」（工具业务错误的 `Error.code`），`docs/product/ai-skills.md:459` 更明文**「不新增第十码」**。
     - `MANAGE_SKILL_CODE_TAG`（`ai-manager.js:161`）的**还原路径不做白名单成员校验**（只校验 `[a-z_]+` 形态），但渲染端查 `MANAGE_SKILL_SHORT_REASON[code]` 得 `undefined` ⇒ 不渲染标注（`src/renderer.js:9678`）。
   - **What's unclear:** 把一个**工具永远不会产生**的错误码加进工具白名单，语义上污染；但 D-08 明确要加「第十个错误码」。
   - **Recommendation:** 加进 `MANAGE_SKILL_ERROR`（顺从 D-08 的字面），并**同批**做三件事：① 把 `tests/test-manage-skill.js:1588-1621` 的「恰十条键 / 九码的值」刷成「恰十一条键 / 十码的值」（这是 D-08 所说「对应测试断言」的那一处）；② **不要**动 `MANAGE_SKILL_SHORT_REASON`（保持 9 键 —— 新码在本阶段**永远经 HTTP 400 的 `{code}` 返回**，不进工具卡片渲染路径）并在文档写明「该表只覆盖 `manage_skill` 工具面，管理面错误码由设置页自己的文案表承载」；③ `docs/product/ai-skills.md` §11.3 的标题与正文「九条拒绝原因 / 不新增第十码」改为「**工具侧**九条不变；管理面另有 `not_user_owned`（第十码，见 §十二）」，避免文档自相矛盾。

4. **尺寸遍历的防御上限（深度 / 条目数）是否需要**
   - **What we know:** `refreshSkills()` 在**每次 Agent 创建与重建**时执行（`ai-manager.js:903` / `:3146`），遍历成本线性于技能目录树规模；`MAX_USER_SKILLS=50` + `MAX_MANAGED_SKILLS=50` 只约束**技能个数**，不约束**单个技能目录的深度与条目数**（PITFALLS P7 把「深目录递归」列为资源耗尽面）。
   - **What's unclear:** 是否需要硬上限，以及超限是「截断 + 诊断」还是「拒绝加载」。
   - **Recommendation:** 加两个常量（如 `MAX_SKILL_SIZE_WALK_ENTRIES = 5000` / `MAX_SKILL_SIZE_WALK_DEPTH = 16`），超限**截断 + 产 warning 诊断**（不拒绝加载 —— 技能仍可用，只是体积显示为下限值并在详情区说明）。理由：加载管线的既有纪律是「单技能失败跳过、不因局部问题拒绝整条」。

5. **`ensureSkillsFresh()` 是否会把「写路径调用方」账本读成 3/3**
   - **What we know:** `STATE.md:292` 的 ⚠️ 记的是 `syncAgentSystemPrompt()` 的**生产调用方**份额（49 完成 1/3、50 到 2/3、51 收口）。本阶段为修「无 Agent 无缓存」会再加一个**读侧**调用方（`refreshSkillsForPanel` 已是同类先例，48-01）。
   - **What's unclear:** 账本该按「失效链触发点」还是「写路径收口」计数 —— 两者不是同一个量。
   - **Recommendation:** 在 `STATE.md` 与 `docs/product/ai-skills.md` 里**分别**记两个数：写路径收口 **2/3**（本阶段），读侧/兜底触发点另计且不并入「6 个触发点」的分子。避免下游把读侧调用方误读成 P8 已 6/6。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js（系统） | 跑 `tests/*.js` 单测 | ✓ | v22.22.0 | — |
| Electron（生产运行时） | 真实行为验证（HTTP 拒收 / 沙箱 / digest） | ✓ | **43.6.0**（内 Node **24.20.0** / Chromium **150.0.7871.250**） | 无 —— 凡涉及 Node HTTP 语义的结论必须在 Electron 内复跑（本会话已复跑） |
| 沙箱 `ExecutionEnv`（SDK） | 全部文件 IO | ✓ | `@earendil-works/pi-agent-core@0.84.3`（`dist/harness/env/nodejs.js`） | — |
| `electron-store` | 禁用名单持久化 | ✓ | 既有实例（`main.js:112`） | — |
| 本地 HTTP 服务（`realmServer`） | 设置页入口 | ✓ | `main.js:2704` | — |
| `git` | 阶段提交 | ✓ | — | — |
| 外部服务（网络 / DB / 容器运行时） | — | — | — | 本阶段无外部依赖 |
| zip 运行库（Phase 51 需要） | — | ✗（**本阶段不需要**） | — | Phase 51 引入（PITFALLS 建议 `fflate`） |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none（zip 库属 Phase 51）

---

## Validation Architecture

`workflow.nyquist_validation: true`（`.planning/config.json`，非 `false`）⇒ 本节必填。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **`node:test`（Node 内建，零依赖）**；断言用 `node:assert` |
| Config file | **none** —— 没有 jest/vitest/pytest 配置；`package.json` 的 `scripts` 里**也没有 `test` 脚本**（只有 `start/dev/debug/nightly/build*/postinstall/test:pre-release/validate/test:memory/eval:memory`） |
| Quick run command | `node tests/test-manage-skill.js`（技能域 manager 级）、`node tests/test-ai-skills.js`（技能域全量）、`node --test tests/test-skill-picker-model.js`（纯逻辑） |
| Full suite command | 见下方「Per wave merge」（**必须逐个具名；`npm test` 不存在**，会被解析成不存在的脚本） |

⚠️ 既有测试的两种跑法并存：`test-ai-skills.js` / `test-manage-skill.js` 是 `node tests/<file>.js`（文件内 `require('node:test')` 自跑），`test-skill-picker-model.js` 用 `node --test`。**照抄各文件既有跑法** —— counts-parity 命令也是按文件名是否含 `picker` 切换的。

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| USER-01 | 管理投影：三档分组 / 空组剔除 / 组内顺序 = `bySkillPriority` 投影 / 字段齐备 / **无 `content`** | unit | `node tests/test-skills-management.js`（新增） | ❌ Wave 0 |
| USER-01 | 体积/文件数口径：递归含子目录、**隐藏文件不计**、**目录 size 不计**、**不穿 symlink**、`SKILL.md` 计入 | unit | 同上（`fs` 造 `.DS_Store` / 嵌套目录 / 内部 symlink） | ❌ Wave 0 |
| USER-01 | 尺寸统计在**重扫管线内**完成且**不进 digest**：只加文件不改 `SKILL.md` ⇒ digest 不变 | unit | 同上（两次 `refreshSkills` 取**值副本**比较 —— 防 Pitfall 6） | ❌ Wave 0 |
| USER-01 | `refreshedAt === 0`（从未加载）不被渲染成「无技能」 | unit | 同上（断言投影带出 `refreshedAt: 0`） | ❌ Wave 0 |
| USER-02 | 禁用 → `settings.aiSkills.disabled` 落盘；**文件仍在**；面板投影 `disabled: true`（`filterPickerItems` 会跳过） | unit | 同上 + `node --test tests/test-skill-picker-model.js`（`s.disabled === true` 已有过滤逻辑，补边界） | 部分 ✅ |
| USER-02 | 重新启用 → 恢复：名单移除 + 条目 `disabled` 回 false | unit | 同上 | ❌ Wave 0 |
| USER-02/06 | 写路径：`syncAgentSystemPrompt()` **恰一次** + 调用侧**恰一次**广播 | unit（框架同 `tests/test-ai-skills.js` 的 L 组：own-property 包装计数 + `captureBroadcasts`，`:2881-2900`） | `node tests/test-ai-skills.js`（新增 L 组用例） | ✅ 套件存在 |
| USER-02 | **忙时**路径：`isProcessing === true` 时补播仍然发出（这是补播的真实理由，见修正 1） | unit | 同上 | ✅ 套件存在 |
| USER-06 | 仅 user 可卸载：builtin / managed / not-found 三态各自的 `code`；**「手改 URL 直调端点」= 直接调 manager 函数也拒** | unit | `node tests/test-skills-management.js` | ❌ Wave 0 |
| USER-06 | 卸载后 `settings.aiSkills.disabled` 的同名条目被清理（D-09 派生不变式） | unit | 同上 | ❌ Wave 0 |
| USER-06 | 读盘判据而非缓存快照（先 `refreshSkills` 暖缓存，再从盘上删目录，再调卸载 ⇒ 应得 `not_found`） | unit | 同上 | ❌ Wave 0 |
| USER-07 | 两入口转发到同一 manager 函数（源码扫描：`handleSkillsApi` 与 IPC handler 均无判定逻辑、均调用**同一方法名**） | unit（源码扫描） | 同上 | ❌ Wave 0 |
| USER-07 | token 校验：无/错 token ⇒ 403（`handleSkillsApi` 首行） | unit（源码扫描） | 同上 | ❌ Wave 0 |
| SEC-09 | 超限 body ⇒ **413 + JSON**，且**堆不随 body 线性增长** | unit（真起 `http` server 的小 harness，形同本会话探针） | `node tests/test-skills-management.js` | ❌ Wave 0 |
| SEC-09 | `sendJson` 幂等：已答 413 后二次调用 no-op，且**无 unhandledRejection** | unit | 同上 | ❌ Wave 0 |
| SEC-09 | 两个书签端点显式覆盖 `maxBytes`（源码扫描 + 行为各一条） | unit | 同上 | ❌ Wave 0 |
| SEC-09（回归） | 57 个既有调用点在改签名后行为不变（默认值路径） | smoke | `node tests/test-ai-skills.js && node tests/test-manage-skill.js && node --test tests/test-skill-picker-model.js` | ✅ |
| D-10 | `/api/settings/update` 对 `aiSkills` / `aiSkills.disabled` **两种键形态**都校验（非数组 / 非字符串项 / 超长 / 路径样串 ⇒ 400 且**不落盘**） | unit | `node tests/test-skills-management.js` | ❌ Wave 0 |
| D-08 | `MANAGE_SKILL_ERROR` 十一键、值集合逐字（**改造既有冻结断言**） | unit | `node tests/test-manage-skill.js` | ✅（需改） |
| D-12 | `STATUS_TEXT.disabled` 存在且值逐字；新增键**不**打翻既有四键值冻结与 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言（后者是**另一张表**） | unit | `node --test tests/test-skill-picker-model.js` | ✅（需补） |
| D-13 | 管理投影**不**携带 `content`（与 `getSkillsForUI` 各一条断言） | unit | `node tests/test-skills-management.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** 该 task 触及的套件 —— `node tests/test-manage-skill.js`（改 manager 时）/ `node tests/test-ai-skills.js`（改管线或失效链时）/ `node --test tests/test-skill-picker-model.js`（改文案表时）/ `node tests/test-skills-management.js`（新套件）
- **Per wave merge:**
  ```
  node tests/test-manage-skill.js && node tests/test-ai-skills.js \
    && node --test tests/test-skill-picker-model.js && node tests/test-skills-management.js \
    && node tests/test-agent-workspace.js && node tests/test-builtin-skills-seeder.js
  ```
- **Phase gate:** 全绿 + counts-parity（下列命令）+ `docs/product/ai-skills.md` §七/§11.8 与 `AGENTS.md` 三处计数账本同步。

```bash
# 例数一致性（既有机械判据，本阶段新增套件后必须重跑；来源 docs/product/ai-skills.md:546-560）
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
⚠️ 若新增独立套件 `tests/test-skills-management.js`，该命令的 `suites` 数组与「≥8 账本单元」判据都要**同步扩**（否则新套件的计数漂移无人拦）。

### Wave 0 Gaps

- [ ] `tests/test-skills-management.js` —— 覆盖上表所有 ❌ 行（管理投影 / 尺寸口径 / 启停 / 卸载判据 / 名单清理 / `readJsonBody` 上限与幂等 / settings 校验 / 双入口源码扫描）。**建议独立成文件**：与 `test-manage-skill.js`（49 的工具面）职责不同，且独立文件才有独立的 `# tests` 计数可入账本。
- [ ] `tests/test-ai-skills.js` 新增 L 组用例（写路径 `rescanCalls` 与 `channels` 次数账 + 忙时补播），复用既有 `captureBroadcasts` / `promptCtx` harness。
- [ ] `tests/test-manage-skill.js` 改造 `:1588-1621` 的冻结断言（十码 → 十一码）。
- [ ] `tests/test-skill-picker-model.js` 补 `STATUS_TEXT.disabled` 的值断言（**不要**改 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言）。
- [ ] counts-parity：`suites` 数组扩一项；三处账本刷数。
- [ ] Framework install：**none**（`node:test` 内建）。

### Manual-Only（如实挂账，不可自动化）

- 真实渲染观感：100 条技能时设置页的滚动 / 密度 / 诊断展开；卸载确认框的居中与焦点（`realm://` 页走 div 遮罩 + CSSOM）。若跑 `/gsd:ui-phase 50`，由 UI-SPEC 定稿并补真实渲染证据 —— **参照 49 的 `tests/uat-49-*` 形态，但承重判据必须带正命题**（WR-12 的教训：否命题空集真）。
- 端到端（`npm run dev`）：设置页禁用某技能 → `/` 面板该技能消失 → 重新启用 → 恢复；卸载一个 user 技能 → `agent-workspace/skills/<name>/` 消失；**未配置 provider 时**打开设置页仍能看到两个内置技能（修正 2 的验收）。
- 打包态：`make install` 后启动 .app，确认设置页技能区能列出内置技能（`asarUnpack` 路径与 `getSeededSkillNames()` 的 `resolveBuiltinSkillsSrc()` 分支）。

---

## Security Domain

`security_enforcement: true` / `security_asvs_level: 1` / `security_block_on: high`。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **no** | 本地 HTTP 无用户认证概念；`REALM_TOKEN`（`main.js:104`，每进程随机 UUID）是**能力令牌**而非认证凭据 |
| V3 Session Management | **no** | 同上；token 经 URL 查询参数传递（既有全站惯例，非本阶段新增面） |
| V4 Access Control | **yes** | ① 每个 `/api/*` 入口首行 `token !== REALM_TOKEN → 403`（`main.js:1338` 范式）；② **卸载的「仅 user 属主」判据必须服务端强制**（判据 3 明文「手改 URL 直接调端点也不例外」）——落 `ai-skills-manager` 而非 handler；③ IPC 侧 `assertTrustedSender`（拒 webview guest / DevTools / 非受信窗口） |
| V5 Input Validation | **yes** | ① `readJsonBody` 体积上限（SEC-09）；② `settings.aiSkills.disabled` 服务端校验（D-10，**两种键形态**）；③ 技能名走 `validateManagedSkillName`（或 Open Q2 的安全超集谓词）；④ 路径恒由 `path.join` 计算，handler/工具不吃 `path` |
| V6 Cryptography | **no** | 本阶段不引入加密，不 hand-roll 任何密码学 |
| V7 Error Handling & Logging | **yes** | 拒绝必须给 `{ error, code }`（不静默，SKILL-06 / P12）；主进程 `console.error` 留痕；**不得**回显被拒内容原文（49 既有口径）；拒收路径必须**无 unhandled rejection**（Pitfall 2） |
| V12 File Upload / V13 API | **yes** | 请求体上限属本条；REST 子路由让「哪个端点做什么」可枚举（D-15） |

### Known Threat Patterns for Electron + 本地 HTTP + 技能目录

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **资源耗尽：超大请求体（zip base64 放大）** | Denial of Service | 累积中判 + 立即停收 + 413（Pitfall 1）；`Content-Length` 预检作快路径（可选增强）；数值单源 fail-closed |
| **手改 URL 直调端点删内置技能** | Elevation of Privilege | 服务端读盘判据（`skills/<name>` 存在 + 属主）**独立于**前端不渲染按钮（D-07 两层） |
| **路径穿越（技能名含 `../` 或分隔符）** | Tampering | 名字校验器 + `path.join(技能目录, name)` + 沙箱 `resolveInside` 双基准；**判据不依赖前端** |
| **sandbox 逃逸（技能目录内符号链接指向工作区外）** | Information Disclosure | 实测沙箱 `listDir` 对 → `/etc` 的链接返回 `permission_denied`；**本阶段不新增任何绕过沙箱的 fs 调用**（管理遍历必须走 `env`） |
| **无限递归（内部符号链接环）** | Denial of Service | 显式跳过 `kind === 'symlink'` + 深度上限（Pitfall 4 / Open Q4） |
| **CSRF / localhost 端口扫描** | Spoofing / Info Disclosure | `REALM_TOKEN` 逐端点校验（既有）；令牌经 URL 参数（同源页面可读），非本阶段新增面 |
| **配置污染（禁用名单写入非字符串 / 超大数组 / 路径样串）** | Tampering | D-10 的服务端校验（**两种键形态都覆盖**，Pitfall 9） |
| **不完整保护造成的虚假安全感** | — | 与 bash 白名单同理：本阶段的「仅 user 可删」是**判据**而非能力边界 —— 用户仍可经 Finder / 终端删 `managed-skills/`（§11.6 已挂账同族口径），产品文档必须如实标注 |
| **失实文案（把「不是你的」说成「不存在」）** | Repudiation | D-08 的独立错误码 + 前端按 `code` 给文案（不解析 message） |

---

## Sources

### Primary (HIGH confidence —— 本会话直读源码 / 生产运行时探针)

**1. 运行时探针（Electron 43.6.0 / Node 24.20.0 / Chromium 150.0.7871.250）**

> ⚠️ **可复现性声明**：以下探针脚本位于 `/tmp/`（会话级、不随仓库保留）。它们的结论已逐条写进 Pitfall / Pattern 正文（含数字），**plan 期若需重跑，按正文的对照表重建即可**（每个探针都是「起一个 `http.createServer` 或直接 require 本仓模块 → 打印 Result / 计数」，无外部依赖）。执行时**务必**在 Electron 内跑（`node_modules/.bin/electron <script>`；Electron 主进程的 stdout 需在脚本内 `fs.writeFileSync` 落地），因为本机 Node 是 v22 而运行时是 Node v24。
> 参考 49 的同类债务（`IN-16` / `WR-09`：真实门禁只活在 `/tmp/uat49/`、结论不可重跑复核）—— 若本阶段要产出**承重**的真实渲染门禁，应把驱动写进 `tests/` 并带正命题，而不是留在 `/tmp`。
- `/tmp/readjson-probe.js` / `probe2` / `probe3` / `probe4` / `probe5`（系统 Node v22.22.0）与 `/tmp/rj.js`（Electron 内复跑）—— `readJsonBody` 五种拒收形态的客户端可见性与堆增长；`Connection: close` 反例；二次 `sendJson` 的 `ERR_HTTP_HEADERS_SENT`；`sendJson` 幂等护栏
- `/tmp/walkprobe.js`（Electron 内）—— `listDir` / `fileInfo` / `exists` / `remove` 的真实返回形状；`.DS_Store` 可见；目录 `size`=96；symlink 的 `kind`/`size`；外逃链接 `permission_denied`；内部链接可穿
- `/tmp/digestprobe2.js`（Electron 内）—— `disabled` 变更对 `digest` / `promptBlock` 的影响矩阵（含活引用陷阱的对照）

**2. 源码（行号 = 本会话读取时的位置；执行前可能漂移）**
- `ai-skills-manager.js`（全文 1687 行）—— `LIMITS:48-54`、`MANAGED_SKILL_NAME_RE:65`、`EMPTY_CACHE:131-138`、`computeDigest:189-202`、`createSkillsEnv:232-277`（`isScanRoot` 过滤 `:244-250`）、`bySkillPriority:494-504`、`refreshSkills:538-730`（④ 定序 `:648`、⑤ disabled `:655-658`、⑥ overLimit `:660-672`、⑦ 预算 `:674-716`、收尾 `:714-716`、`return _cache:729`）、`buildSkillsPrompt:741-743`、`getSkillsSnapshot:752-759`、`sourceTierOf:776-780`、`toUISkillEntry:799-813`、`getSkillsForUI:853-859`、`readSkillForInvocation:894-926`、`MANAGE_SKILL_ERROR:966-977`、`makeManageSkillError:991-996`、`validateManagedSkillName:1034-1063`、`validateManagedSkillDescription:1077-1092`、`sanitizeSkillDescription:1150-1156`、`validateSkillFileSize:1231-1245`、`countManagedSkills:1335-1343`（既有注释即记「listDir 的 entry 形状是 `{ name, path, kind, size, mtimeMs }`（实测）」）、`resolveManagedTarget:1367-1399`、`createManagedSkill:1422-1513`、`deleteManagedSkill:1603-1623`、`getSkillPromptIncluded:1651-1656`、`module.exports:1663-1687`
- `agent-workspace.js`（全文 391 行）—— `getSkillsDir:102-104`、`getManagedSkillsDir:113-115`、`ensureWorkspaceDir:120-126`、`resolveInside:162-192`、`createSandboxEnv:205-376`（`fileInfo:286-290` / `listDir:292-296` / `exists:309-313` / `createDir:315-319` / `remove:321-325`）
- `ai-manager.js` —— `MANAGE_SKILL_CODE_TAG:161`（含「不可加 `/g`」注释）、`init():777`（`configStore` 注入 `:778`、**无 provider 早退 `:789-793`**）、`sandboxEnv:901`、`init 内 refreshSkills:903-911`、`_skillsPromptDigest` 初值 `:940`/`:3171`、`getSeededSkillNamesSafe:1565-1578`、`getSkillsForUI:1583-1585`、`syncAgentSystemPrompt:3026-3054`（守卫 `:3027`、重扫 `:3030-3037`、忙时置脏早退 `:3039-3042`、**早退 `:3048`**、改写 + 广播 `:3050-3053`）、`refreshSkillsForPanel:3072-3075`、`_flushDeferredSkillsPrompt:3100-3118`、`_recreateAgent 内 refreshSkills:3146-3154`、`_buildManageSkillTool:6124`/`:6252-6254`
- `main.js` —— `REALM_TOKEN:104`、`configStore:112`、`sendJson:877-880`、`readJsonBody:887-899`、`handleHistoryApi:908`、`handleFavoritesApi:976`（**`import-chrome:1156-1157`**、**`import-html:1176-1177`**）、`handleSettingsApi:1336`（token `:1338`、route `:1344`、**update 循环 `:1371-1392`**、`settings:updated` 广播 `:1395`）、`handleSearchConfigApi:1710`、`handleAiMemoryApi:2649`（POST body `:2671`）、`realmServer:2704`、内联 `/api/bookmarks-bar/toggle:2821-2831`、`seedBuiltinSkills():4049`、`new AIManager():4051`
- `window-manager.js` —— `broadcast:310-316`（逐窗 `win.webContents.send`）
- `ipc-handlers.js` —— `assertTrustedSender:113-122`、`ai:get-skills:1747-1753`（含 `:1743` 的「**不得**走 `/api/skills/*`」理由）、`ai:refresh-skills:1763-1769`
- `src/renderer.js` —— `realmUrlToHttp:368-377`、`createWebviewForTab:1322-1366`（`partition` `:1331`、`preload = webview-preload.js` `:1343`）、`skills:changed 监听:4405-4407`、`pullAiSkillsSnapshot:9129-9142`（**digest 早退 `:9134`**）、`renderSlashPickerList:10551-10557`、`formatFileSize:11316-11322`、「仅显式」`title` 标注 `:10599`
- `src/skill-picker-model.js` —— `SKILL_NAME_RE:29`、`extractArgs:44`、`filterPickerItems:214-236`（**`s.disabled === true` 跳过 `:224`**）、`STATUS_TEXT:239-244`、`PROMPT_OMITTED_CARD_NOTE:269`、`buildPickerItems:286-333`（状态链 `:300-311`）、`MANAGE_SKILL_ACTION_LABEL:379`、`MANAGE_SKILL_SHORT_REASON:408`、双模式导出 `:470-475`
- `src/settings-page.js` —— `state:19-46`（`aiBashWhitelist:41`）、`apiToken:49`、`settingsApi:60-73`、`aiMemoryApi:172-187`、`showToast:340-349`、白名单链路 `:2839-2900`、`setAiMemoryHint:3878-3888`、`resetAiMemoryHint:3890-3897`、保存流程 `:4040-4077`、AI 设置加载 `:2714-2726`
- `src/settings.html` —— AI 记忆子区 `:484-502`、**AI Bash 白名单子区 `:506-522`（D-01 插入位置参照）**、视觉模型子区 `:524-537`、`<script>` 列表 `:783-785`（**无 `skill-picker-model.js`**）
- `builtin-skills-seeder.js` —— `getSeededSkillNames:92-110`
- `node_modules/@earendil-works/pi-agent-core/dist/harness/types.d.ts` —— `FileKind:88`、`FileInfo:124-136`、`FileSystem.readTextFile:153` / `fileInfo:168` / `listDir:170` / `exists:174` / `createDir:176-179` / `remove:181-184`
- `node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js` —— `fileInfoFromStats:52-63`、`fileInfo:538-546`（**`lstat`**）、`listDir:547-578`（**`readdir withFileTypes` + 逐项 `lstat`**）、`exists:584-591`、`createDir:592-600`、`remove:602-610`（**`recursive ?? false`**）
- `tests/test-manage-skill.js` —— `:1588-1621`（九码冻结断言：键集合 + 值集合）、`:298` / `:1344` / `:1624-1639`（「不新立第十码」用例）
- `tests/test-skill-picker-model.js` —— `:925-943`（动作标题表恰三键 + 冻结）、`:945-958`（**`MANAGE_SKILL_SHORT_REASON` 恰 9 键 + 值逐字 + 冻结**）、`:972-988`、`:993-1018`（`PROMPT_OMITTED_CARD_NOTE` 投影形态）、`:1019-1027`、`:1029-1042`（`STATUS_TEXT` 四键值冻结）、`:1043-1060`（≤6 字 + 同值引用）
- `tests/test-ai-skills.js` —— `:1239-1297`（广播行为）、`:1299-1306`（方法体源码形态）、`:1446-1456`（manage_skill 内恰一次 + 禁 `refreshSkills(`）、`:1487-1495`、`:2276-2288`（`refreshSkillsForPanel` 是读侧生产调用方）、`:2299-2303`（方法体未被重构）、`:2503-2505`（renderer 监听）、`:2881-2900`（`captureBroadcasts` harness）、`:3281-3296` / `:3435-3459`（次数账 `rescanCalls`）
- `docs/product/ai-skills.md` —— 章节表（`## 一:32` / `二:40` / `三:55` / `四:61` / `五:75` / `六:82` / `七:96` / `八:107` / `九:159` / `十:253` / `十一:433`）；`§11.3:457-483`（**「九条拒绝原因 / 不新增第十码」**、词缀三条边界）；`§11.4:485-494`、`§11.5:496-511`、`§11.6:513-519`、`§11.7:521-532`（三处诚实边界与可见性）、`§11.8:534-543`（例数账本三条）、`:545-560`（counts-parity 可重跑命令）
- `AGENTS.md` —— `:262-263`（安装档三条实现约束 + 维护约定）、`:266`（测试清单行：含「九码长度上限」）、`:268-270`（打包排除项 / 内置技能 / 技能不构成额外权限）、`:271`（随包目录维护约定）、`:272`（技能发现与调用维护约定）、`:273`（**AI 自建技能维护约定：含「九码拒绝面」与四条不变式**）
- `.planning/config.json` —— `workflow.nyquist_validation: true`、`security_enforcement: true`、`security_asvs_level: 1`、`security_block_on: high`、`ui_phase: true`、`parallelization: true`、`commit_docs: true`
- `.planning/ROADMAP.md` —— `:326-345`（Phase 50 全文：Goal / Depends on / 5 条判据 / `UI hint: yes` / Security gate / Doc sync）、`:365-377`（Security Gates 表：P1/P2/P3/P4/P8/P9/P10）
- `.planning/REQUIREMENTS.md` —— `:49-57`（USER-01/02/06/07）、`:78`（SEC-09）、`:99-113`（Out of Scope）、`:86-97`（v2：ECO-01..06）
- `.planning/STATE.md` —— `:284-296`（Blockers/Concerns：O3 `:287`、O7 `:290`、⚠️ `syncAgentSystemPrompt()` 生产调用方 `:292`、TD-48-01/02 `:295-296`）、`:298+`（49/48 收尾带出的守卫强度债、WR-12/IN-14/IN-16/IN-17/IN-10~13、WR-02/WR-06、bash 安装档根因）
- `.planning/research/PITFALLS.md` —— `P2:72-105`（symlink 写逃逸）、`P4:181-243`（zip 路径类缺陷 + 选型）、`P7:291-311`（**资源耗尽四入口与限额数值 `:298-309`**）、`P9:370-386`（网络导入 + `MAX_DOWNLOAD_BYTES ≈ 20MB` `:378`）、`:436-441`（依赖纪律）、`:575`/`:591`（阶段归属与开放决策）

### Secondary (MEDIUM confidence)
- `src/favorites-page.js` —— `pickBookmarkFile:2235-2250`、`startChromeImport:2294-2323`、`startHtmlImport:2332-2352`、确认导入 `:2435-2450`（**只读了相关片段**，非全文）
- `src/preload.js` —— `ai` 命名空间 `:1025-1043`（`getSkills:1033`、`refreshSkills:1040`）

### Tertiary (LOW confidence)
- 无 —— 本阶段未使用任何未经一手验证的第三方陈述。

---

## Metadata

**Confidence breakdown:**
- **Standard Stack: HIGH** —— 本阶段零新依赖；全部复用既有模块，且每个复用点的签名/返回形状都经源码直读或 Electron 内探针确认。
- **Architecture: HIGH** —— 数据流（设置页 guest → HTTP → manager；主窗口 → IPC → manager；写路径 → configStore → refreshSkills → digest → prompt → 广播 → renderer）逐段读过源码；三处对 CONTEXT 的修正是**实测**结论。
- **Pitfalls: HIGH** —— Pitfall 1/2/4/5/6 由生产运行时探针直接证明（含客户端可见形态与堆增长数字）；Pitfall 3/7/8/9 由源码直读证明；Pitfall 12 由「digest 早退 + 补播」的合成推演得出（依据均为直读源码）。
- **未覆盖 / 依赖 plan 期实测的三点:** ① 设置页加载 `skill-picker-model.js` 的实际表现（A3）；② 100 条技能时设置页渲染耗时（CONTEXT 的「待实测项」）；③ 管理投影的真实字节上界（A6）。

**Research date:** 2026-09-14
**Valid until:** 2026-10-14（30 天）—— 本阶段的结论依赖**仓库内文件的行号与 Electron/SDK 版本**；若期间升级 `@earendil-works/pi-agent-core`（当前 0.84.3）或 Electron（当前 43.6.0），Pitfall 1/2（http 语义）与 Pattern 1（FileInfo 形状）需按 AGENTS.md 的「升版须复核」纪律重跑探针。


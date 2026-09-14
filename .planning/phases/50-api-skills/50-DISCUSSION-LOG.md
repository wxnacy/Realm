# Phase 50: 设置页技能管理区 + `/api/skills/*` - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 50-设置页技能管理区 + `/api/skills/*`
**Areas discussed:** 列表形态与信息密度 / 危险动作的交互粒度与拒绝面 / 诊断与状态的展示口径 / 端点形态、体积上限与跨窗口同步

**模式：** `--auto`（全自动）。用户先以默认交互模式启动讨论并选定全部四个灰区，随后改以 `--auto` 重跑 —— 全部问题由 Claude 按「推荐项」自动选定，无交互轮。下列每张表的 `Selected` 列即自动选定结果，供事后审阅与推翻。

---

## 列表形态与信息密度

### Q1 整体列表形态

| Option | Description | Selected |
|--------|-------------|----------|
| 按来源分三组 + 组内行式列表 | 三组「我的技能」/「内置技能」/「AI 创建」；来源是最重要维度，46 D-06 / SKILL-05 要求同名冲突可见；复用既有 `.settings-group` 范式 | ✓ |
| 平铺单表（一行一技能，列对齐） | 最紧凑，100 条也能一屏扫完；但分组信息丢失，遮蔽与来源得靠徽标猜 | |
| 按来源分三组 + 可折叠 | 同上但每组可折叠；更干净，但多一层折叠控件，且遮蔽可见性可能被折叠藏起来 | |
| 卡片流（每条一张卡） | 信息容纳最多；代价是 50 条技能时页面很长 | |

**Auto-selected:** 按来源分三组 + 组内行式列表（推荐默认）
**Notes:** 三档档位判定已在 48 D-14 锁定 ⇒ 分组实现成本为零。**不折叠**的直接理由是「shadowed 可见性」与「诊断可见性」都是本阶段的正面要求，默认折叠会与之冲突。空组不渲染（对齐 48 D-01）。

### Q2 行内布局与「体积 · 文件数」写法

| Option | Description | Selected |
|--------|-------------|----------|
| 两行式：名称+徽标+操作 / 描述+`12.3 KB · 4 个文件` | 描述是模型自动匹配的唯一依据（49 D-07 引 skill-creator 核心结论），必须可见 | ✓ |
| 单行式：描述进 tooltip | 最紧凑；但把技能的核心语义藏起来等于看不见 | |
| 两行式 + 描述不截断（允许换行） | 描述完整可读；但长描述（上限 1024 字符）会把行高拉高，扫描效率下降 | |

**Auto-selected:** 两行式（推荐默认）
**Notes:** 描述截断用 CSS `text-overflow: ellipsis`（非 JS 截断），`title` 放全文 —— 避免「截断逻辑」成为第二份实现。

### Q3 分组内排序口径

| Option | Description | Selected |
|--------|-------------|----------|
| 沿用 `bySkillPriority` 全序 | user > 可自动激活 > name 码点序，与 `/` 面板同源；零第二份排序实现 | ✓ |
| 按 name 字母序 | 找特定名字更直观；但多一份排序实现且与面板顺序不一致 | |
| 按文件 mtime 倒序 | 「AI 刚建的技能」最显眼；需额外递归 stat，且与面板顺序不一致 | |
| 按技能体积倒序 | 能揪出大技能；但排序语义与用户实际关心错位 | |

**Auto-selected:** 沿用 `bySkillPriority` 全序（推荐默认）
**Notes:** 分组 + 排序都在主进程完成，前端只渲染（46 D-06「渲染端不得重实现优先级」）。码点序而非区域敏感比较 —— 46 已防的 prompt 字节跨机漂移。

### Q4 是否做过滤 / 搜索框

| Option | Description | Selected |
|--------|-------------|----------|
| v1 不做搜索框 | 设置页其他列表区均无搜索先例；总数已被 MAX_USER_SKILLS / MAX_MANAGED_SKILLS 封顶（各 50） | ✓ |
| 加名称过滤输入框 | 与 `/` 面板两档过滤语义对齐；代价是多一份过滤实现与一套空态 | |
| 只加按状态筛选（全部/已启用/已禁用/异常） | 排查用；技能总量不大时价值有限 | |

**Auto-selected:** v1 不做搜索框（推荐默认）
**Notes:** 纯前端增量，日后实测痛苦再加（CONTEXT 的 D-04 标 `reversible`）。

---

## 危险动作的交互粒度与拒绝面

### Q1 启停 / 卸载的保存语义

| Option | Description | Selected |
|--------|-------------|----------|
| 启停即改即存（switch 无保存按钮）；卸载即点即确认 | 白名单 tag 与 provider `enabled` 开关都是即改即存先例；AI 记忆区的保存按钮是因为文本编辑有草稿态，启停无草稿 | ✓ |
| 全部走显式「保存」按钮 | 一致、可撤销草稿；但对离散单值动作是多余的一步 | |
| 启停即改即存；卸载收集为待办批量执行 | 可一次卸多个；但引入「待提交状态」，与「点了就生效」的直觉冲突 | |

**Auto-selected:** 启停即改即存 + 卸载二次确认（推荐默认）
**Notes:** **与 49 D-01「`manage_skill` 三动作不加确认」不冲突**，论据正交：49 讲的是给 AI 工具加确认挡不住 AI（有 `write`/`bash` 绕道路径），本条讲的是给人加确认防误点（人无绕道路径）。该区分必须保留成文。

### Q2 失败 / 拒绝的反馈形态

| Option | Description | Selected |
|--------|-------------|----------|
| 设置页既有 inline hint（`ai-memory-hint` 同款） | 设置页已有该基建与「2 秒无条件复位」守卫（G-43-2 先例）；零新基建 | ✓ |
| 新建设置页 toast | 视觉更醒目；但是第二套基建，且主窗口 toast（G-44-5）覆盖不到 guest | |
| 原生 `dialog` 弹框报错 | 主窗口范式；但 `realm://` 页面 CSP 豁免该范式（走 div 遮罩），且错误用模态框过重 | |

**Auto-selected:** 设置页既有 inline hint（推荐默认）
**Notes:** 设置页在 `realm://` guest 内、`realmAPI` 不可用；`realm://` 页面用 div 遮罩 + JS CSSOM，初始隐藏必须走 CSS 类（markup 内联 `style` 被 CSP 拦截）。

### Q3 内置 / 托管技能的卸载入口形态

| Option | Description | Selected |
|--------|-------------|----------|
| 只对 `source === 'user'` 渲染按钮 + 标题下一行说明 | 不给「点了才知道不行」的挫败，同时解释「为什么这个没有卸载按钮」 | ✓ |
| 隐藏按钮且不加任何说明 | 最干净；但用户会困惑按钮为何缺席 | |
| 按钮置灰 + `title` 说明原因 | 可发现性好；但置灰控件在列表中形成视觉噪声，且 a11y 上仍是不可用控件 | |
| 可点 → 服务端拒绝后报错 | 最差：以失败教用户规则 | |

**Auto-selected:** 只对 user 渲染 + 标题下说明（推荐默认）
**Notes:** **服务端独立拒绝是硬约束**（ROADMAP 判据 3：「手改 URL 直接调端点也不例外」）；前端不渲染只是 UX。本侧判据**不能复用** 49 的 `resolveManagedTarget`（方向相反）。

### Q4 能否卸载「已禁用」的技能

| Option | Description | Selected |
|--------|-------------|----------|
| 能（卸载不因 `disabled` 置灰） | 禁用是轻量试探、卸载是终局；要求先启用再卸载是反直觉两步操作 | ✓ |
| 不能（需先启用） | 多一道确认；但把两个独立状态耦合成顺序操作 | |

**Auto-selected:** 能（推荐默认）
**Notes:** **派生不变式**：卸载成功后必须从 `settings.aiSkills.disabled` 移除该名字 —— 否则残留名单会随技能名复用而误伤（同名新技能一装上就被静默禁用），属「静默失效」类缺陷。

### 派生决策（非提问产生，由上述选择必然导出）

| 项 | 内容 | 理由 |
|----|------|------|
| 新增第十码 | `NOT_USER_OWNED: 'not_user_owned'`；三处账本从「九码」刷成「十码」 | 复用 `NOT_FOUND` 会把「不存在」与「存在但不是你的」混同 ⇒ 失实文案；与 49-04 修过的 `promptIncluded` 三态混同同族 |
| `aiSkills.disabled` 补服务端校验 | `/api/settings/update` 的校验循环加第三条（与 `aiBashWhitelist` / `cacheMaxGB` 并列） | 该键目前零服务端校验，手改 URL 可写入任意值污染禁用名单 |

---

## 诊断与状态的展示口径

### Q1 诊断在哪显示

| Option | Description | Selected |
|--------|-------------|----------|
| 分两层：模块 `errors[]` → 区顶部汇总条；每条 `diagnostics[]` → 行尾「诊断 N」+ 内联可展开详情 | 46 D-07 明确 `errors[]` 是模块级容器、无归属技能，塞进行内不可能；行内徽标是 ROADMAP 判据 1 的字段承载形式 | ✓ |
| 全部塞进行内一行文字 | 简单；但模块级错误无 owner，长诊断串会溢出 | |
| 统一收进一个「诊断」弹框/面板 | 集中；但把「哪条技能有问题」这层对应关系藏起来了 | |
| 只在顶部汇总条显示计数，详情靠 tooltip | 最紧凑；但 tooltip 不可键盘访问、截图不可见 | |

**Auto-selected:** 分两层承载（推荐默认）
**Notes:** 详情区每条显示 `level` + 可读 `message`，`code`（`realm_*`）作次要文本 / `title` 露出。展开复用 48/49 的折叠块范式（`renderSkillContentBox`）。

### Q2 状态标注的文案来源与优先级

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 `STATUS_TEXT` 单源 + 新增 `disabled` 一条；优先级 `disabled > shadowed > overLimit > promptOmitted`；「仅显式」独立 | 48-03 已锁定「用中文状态名不讲字段」；同状态两处各写文案必然漂移（48/49 已付过代价） | ✓ |
| 设置页另写一套文案 | 可针对管理场景优化措辞；但同值不同物，改一处漏一处 | |
| 全部状态并列显示（不做优先级） | 信息完整；但一条技能可同时命中 3 条，行尾会变成标签墙 | |

**Auto-selected:** 复用 `STATUS_TEXT` 单源 + 新增 `disabled`（推荐默认）
**Notes:** `disabled > shadowed > overLimit > promptOmitted` 是 48 D-12 既有顺序在前插入 `disabled`（用户主动意图、信息量最大）。「仅显式」（`disable-model-invocation`）不在该链上，可并存、单独一枚标记（48-03 要求成文防回归）。**「已禁用」是设置页独有标注** —— `/` 面板根本不列出被禁用的技能（48 D-10）。

### Q3 体积 / 文件数的口径与投影归属

| Option | Description | Selected |
|--------|-------------|----------|
| 新增管理面投影（不扩展 `getSkillsForUI()`）；递归遍历全部子项、隐藏文件不计；在重扫管线内计算并缓存 | `getSkillsForUI()` 是有意收窄的投影（48 剔除 content/filePath/diagnostics），扩展它会让 `/` 面板 IPC 白传诊断与遍历结果 | ✓ |
| 扩展 `getSkillsForUI()` 加体积/文件数/诊断字段 | 单一投影、少一个函数；但把 `/` 面板的 IPC 负载抬起来，负优化 | |
| 打开设置页时实时遍历计算 | 数据最新；但 100 个技能 × 整目录 stat 会把「打开设置页」变成一次重 IO，违反「冻结快照 + 同步只读」纪律 | |
| 隐藏文件也计入体积/文件数 | 更「真实」；但 macOS 下 `.DS_Store` 会因 Finder 浏览随机增减，同一技能的体积会抖动 | |

**Auto-selected:** 新增管理面投影 + 递归计全部子项 + 隐藏文件不计 + 重扫管线内缓存（推荐默认）
**Notes:** 该投影**仍不携带 `content` 正文**。口径必须写进 `docs/product/ai-skills.md`。

### Q4 是否展示 `allowed-tools`

| Option | Description | Selected |
|--------|-------------|----------|
| 不展示（v1） | 该字段尚未被解析（O3 解析半边归 Phase 51）⇒ 无数据可展示；在 50 加解析器等于把 51 的活提前、构成第二份实现 | ✓ |
| 展示 + 「当前运行时不被强制，仅供参考」免责标注 | 表面上更满足 ROADMAP 的 Doc sync 字面；但需要先造一个解析器（= 51 的活） | |
| 展示原始 frontmatter 未解析字符串 | 零解析成本；但把未校验的原始值当字段展示，且「参考」含义不明 | |

**Auto-selected:** 不展示（推荐默认）
**Notes:** ROADMAP 的 Doc sync 条款是**条件句**（「在列表展示时**必须**带免责标注」）⇒ 按「不展示」满足，前置条件不成立。**必须**在 `docs/product/ai-skills.md` 写明缺席原因 + 留「51 解析后必须补免责标注」的交接，防被读成漏做。

---

## 端点形态、体积上限与跨窗口同步

### Q1 `/api/skills/*` 的路由形态

| Option | Description | Selected |
|--------|-------------|----------|
| REST 子路由（`list` / `set-disabled` / `uninstall`） | 沿用 `/api/settings/*` 与 `/api/ai-memory` 的既有范式；ROADMAP 字面即 `/api/skills/*` | ✓ |
| RPC 单端点（`POST /api/skills/action {op, name}`） | 一个 handler、少一个分支；但不同副作用 + 不同校验混在一起，「哪条路径做了什么」不可枚举 | |
| 只用 IPC，不用 HTTP | 少一套鉴权；但设置页在 guest 内无 `realmAPI`，**物理上做不到** | |

**Auto-selected:** REST 子路由（推荐默认）
**Notes:** 在 `main.js` 的 `realmServer`（`:2704`）新增分发分支 + `handleSkillsApi()`。

### Q2 SEC-09 的体积上限值与落点

| Option | Description | Selected |
|--------|-------------|----------|
| `readJsonBody(req, { maxBytes })`，全局默认 1 MiB、超限立即拒收（413）、需大 body 的端点显式覆盖 | 「默认小 + 需大者显式放大」⇒「漏了上限」不会静默发生；Phase 51 的 zip base64 端点届时显式声明 | ✓ |
| 全局单一上限（不提供覆盖） | 更简单；但 Phase 51 的 zip base64 会撞上它，届时只能放宽全局默认值 | |
| 只在该端点做长度检查 | 改动面最小；但其他端点仍无上限，且事后检查不满足「不无上限读入内存」 | |
| 默认无上限 + 事后检查长度 | 不可取：内存已经吃进去了 | |

**Auto-selected:** `readJsonBody(req, { maxBytes })` 默认 1 MiB + 超限立即拒收（推荐默认）
**Notes:** ROADMAP 判据 5 的判据对象是「**不无上限读入内存**」—— 必须停止累积而非事后检查。上限数值单源在 `main.js`，设置页前端不得写死第二份。

### Q3 两个前端入口的职责与能力对等性

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP + IPC 读写对等，共用同一 manager 函数与同一管理投影 | ROADMAP 判据 4 与 USER-07 都明说「两个前端入口」「同一后端权威」；两个 handler 只是转发层，零重复实现 | ✓ |
| IPC 只读（沿用 48 的 `ai:get-skills`），写路径只在 HTTP | 少一个写入口 = 少一份风险面；但主窗口失去管理能力，与判据 4 的「两入口」表述不符 | |
| 两者合并为一个入口 | — | 不可行：设置页 guest 无 `realmAPI`，主窗口 `file://` 不能 fetch 本地 HTTP（Phase 38 事故），两条物理上不可互换 |

**Auto-selected:** HTTP + IPC 读写对等（推荐默认）
**Notes:** 主窗口当前**无管理 UI** ⇒ IPC 写侧暂无 UI 消费者，其价值是对称性 + 未来管理面 + 调试便利；**不得**为了让 IPC 有消费者而在主窗口新造管理 UI（那是新能力）。

### Q4 禁用 / 卸载后的广播链

| Option | Description | Selected |
|--------|-------------|----------|
| 成功后调 `syncAgentSystemPrompt()` 恰一次 + **调用侧无条件补一次 `skills:changed` 广播** | `syncAgentSystemPrompt()` 只在真正改写 prompt 时广播；禁用被遮蔽 / 超预算的技能时 prompt 逐字符不变 ⇒ 不广播 ⇒ 48 D-10 的面板隐藏失效 | ✓ |
| 只调 `syncAgentSystemPrompt()` | 表面复用既有失效链；但存在上述真实缺口 | |
| 改 `syncAgentSystemPrompt()` 让它在任何变更后都广播 | 一劳永逸；但会打翻 46-04 的方法体源码断言与 48 的广播次数断言（三处测试钉着它） | |
| 让设置页监听主进程广播来同步 | 更实时；但设置页是纯 HTTP 客户端、零 IPC，为它开 push 通道是新基建，收益仅覆盖边缘场景 | |

**Auto-selected:** `syncAgentSystemPrompt()` 恰一次 + 调用侧无条件补播（推荐默认）
**Notes:** 广播幂等（48-06 已把 renderer 监听改成无条件重拉快照）⇒ 多播一次零副作用。**诚实边界**：`windowManager.broadcast` 只发到各 BrowserWindow 的 webContents，**不到 webview guest** ⇒ 设置页每次操作后自行重拉、进入该页时重拉；**多开设置页之间不做即时同步**。进度账本：本阶段后 `syncAgentSystemPrompt()` 生产调用方到 **2/3**，仍不得声称 P8 6/6 全覆盖。

### 派生决策（非提问产生）

| 项 | 内容 | 理由 |
|----|------|------|
| `syncAgentSystemPrompt()` 调用恰一次、不得写成 `refreshSkills()` + `syncAgentSystemPrompt()` | 该函数体内已含 `refreshSkills()`；多写一行即两次全量重扫（49-01 D-13 已付代价，L 组断言 `rescanCalls === 2`） | 47/49 的既有教训 |
| 补播点必须在调用侧、不得挪进函数体 | 46-04 的方法体断言 + 48 的广播次数断言同时钉着函数体 | 同上 |

---

## Claude's Discretion

| 项 | 建议 | 理由 |
|----|------|------|
| 管理投影的函数名与返回形状 | 返回已分组结构（排序与分组在主进程） | 与 D-03 一致；具体形状交 plan 期 |
| IPC 通道命名与 preload 挂载点 | 与 `ai:get-skills` / `ai:refresh-skills` 并列 | 交 plan 期 |
| 体积格式化落点 | 沿既有惯例加一份页面局部实现（downloads/renderer/player 各有一份）；**不得**在设置页写死限额数值 | 既有惯例即逐页局部；限额恒取主进程值 |
| 启停 switch 视觉 | 复用设置页既有 `.ai-switch` | provider `enabled` 开关同款 |
| 诊断详情区展开交互与 DOM | 复用 48/49 折叠块范式；若触发 `/gsd:ui-phase 50` 则由 UI-SPEC 定稿 | ROADMAP 标 `UI hint: yes` |
| `set-disabled` 载荷形状 | 增量 `{name, disabled}`（全量会在并发操作下互相覆盖） | 交 plan 期 |
| 测试文件组织 | 新增独立套件或并入 `tests/test-ai-skills.js` | 必测清单见 CONTEXT 的 Claude's Discretion |
| 待实测项 | `readJsonBody` 改签名对全部既有 POST 端点的回归 / inline hint 连续操作下的复位 / 100 条技能时的设置页渲染耗时 | plan 期列出验证动作 |

## Deferred Ideas

| 项 | 归属 |
|----|------|
| `allowed-tools` 的解析与展示（含免责标注） | **O3** → Phase 51 |
| 四态可见性（`skillOverrides` 语义） | **ECO-05** |
| 容器级技能作用域 | **ECO-06** |
| 技能版本历史 / 覆写前备份 / 恢复内置技能按钮 | v1.x（与 **ECO-02** 同类）；本阶段卸载无备份，确认卡片是唯一防线 |
| 多技能 zip 包勾选安装 | **ECO-01** → Phase 51 的 v1.x 部分 |
| 多开设置页之间的即时同步 | 本阶段显式不做（需扩展 `broadcast` 到 guest 或在 `webview-preload.js` 开 `sendToHost` 链路，均为新机制） |
| 主窗口内的技能管理 UI | 新能力，不属本阶段 |
| `readJsonBody` 上限可配置化 | 优化项；会引入「调大上限即放宽防护」的新面 |
| `syncAgentSystemPrompt()` 生产调用方完整收口 | 本阶段到 2/3，剩 51 的导入；`STATE.md:292` 的 ⚠️ 保持挂着 |
| TD-48-01 / TD-48-02（`escapeHtml` 不转义引号 / 取消分支缺锚点） | 用户已裁决延后；本阶段若**新写**属性上下文插值必须走安全转义，负「不扩大缺口」之责 |
| `WR-12` / `IN-14` / `IN-16` / `IN-17`（49 收尾带出的守卫强度债与可复现性债） | 不阻断；若本阶段新增真实渲染门禁，承重判据必须带正命题（不得重复「否命题空集真」形态） |
| `WR-02` / `WR-06`（48 挂账） | 用户裁决继续挂账，不得读成已修 |
| bash 安装档只读豁免的结构性根因（`47-REVIEW.md` CR-01 / CR-02 / 残余 ③） | 无归属阶段技术债；根治走 argv 级分词 |

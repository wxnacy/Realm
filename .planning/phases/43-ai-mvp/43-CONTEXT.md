# Phase 43: AI 记忆系统集成（条目记忆 MVP） - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning

<domain>
## Phase Boundary

为 AI 助手集成三层条目式持久记忆，本阶段交付：

1. **存储层** — `ai-memory-manager.js` 新模块：三层条目式存储（`userData/ai-memory/` 下 USER.md / MEMORY.md / `memories/<containerId>.md`），字符预算、写入威胁扫描、懒创建
2. **memory 写入工具** — add/replace/remove + target 三层消歧（方案 A：container 按当时活跃容器）
3. **memory_read 读取工具** — 容器记忆按需加载（skill 原理），containerId 缺省解析当前活跃容器
4. **system prompt 改造** — 全局两层冻结快照注入 + 容器记忆索引指引
5. **容器删除联动** — container-manager 删除钩子清理记忆文件 + 确认文案补充
6. **设置页编辑入口** — `/api/ai-memory` HTTP 端点 + 设置页「AI 记忆」分区（textarea 编辑 + 容器下拉）

不包含：被动摘要（方案文档第四节）、FTS5 深度记忆/检索工具（第五节）、跨设备同步、记忆导入导出。

</domain>

<decisions>
## Implementation Decisions

### 存储与注入架构（方案文档已拍板，直接承接）

- **D-01:** 三层条目式存储，位置 `userData/ai-memory/` — 用户画像 `USER.md`（全局一份）、全局记忆 `MEMORY.md`（全局一份）、容器记忆 `memories/<containerId>.md`（每容器一份）。容器记忆文件**懒创建**（首次写入才建，不为默认 4 容器预建空文件）
- **D-02:** 写入消歧方案 A — `memory` 工具加 `target` 参数（`'user'` | `'global'` | `'container'`），`'container'` 按当时活跃容器写入，不改对话模型（对话与容器本就无绑定，Phase 42 确认）
- **D-03:** 容器记忆按需加载（skill 原理 / 渐进式披露）— 不进 system prompt。system prompt 只放索引指引（各容器有独立持久记忆，处理容器相关任务前先 `memory_read`），工具结果以 toolResult 消息进对话上下文。多容器场景 AI 对每个涉及的容器显式传 containerId 各读一次
- **D-04:** 冻结快照只用于全局两层 — 会话开始（Agent 实例创建，Phase 42 一对话一实例）时快照 USER.md + 全局 MEMORY.md 进 system prompt，会话内不变（保前缀缓存），新会话生效。容器记忆走工具读取 = 每次读实时文件，无「中途切容器漂移」问题
- **D-05:** 容器删除联动清理 — 挂 container-manager 删除链路，删除容器时顺带删记忆文件，现有确认文案补充「将删除该容器的 AI 记忆」。文件不存在时 `memory_read` 返回「该容器暂无记忆」
- **D-06:** 设置页编辑走 HTTP — `realm://settings` 是 webview，按项目约定走本地 HTTP `/api/ai-memory` 端点（scope 参数：`user` / `global` / `container:<id>`）+ 容器下拉数据源
- **D-07:** 全局字符预算（参考 Hermes）— MEMORY.md 2200 / USER.md 1375 字符，三份全局注入合计封顶 ~5000 字符；写满时 add 失败并在工具结果提示「先整理旧记忆」

### 字符预算（本次讨论）

- **D-08:** 容器记忆 `memories/<containerId>.md` 上限 **2200 字符** — 与全局 MEMORY.md 一致，统一预算模型。容器记忆是「工作记忆」（项目惯例、登录状态、站点注意事项），量级与全局记忆相当；超限行为同 D-07（add 失败提示整理）

### 条目定位语义（本次讨论）

- **D-09:** 编号定位 — 文件内条目用 `[M1] [M2]…` 式编号（§ 分隔 + 编号），`memory_read` 返回时带编号，`replace`/`remove` 直接传编号。AI 定位最可靠，不会因引文偏差改错条目；设置页 textarea 也能看到编号 — **Reversibility:** costly — 条目编号写入磁盘文件格式，改定位语义需要迁移已产生的记忆文件（编号解析规则变化）
- **D-10:** 稳定编号不回收 — 删除中间条目后编号不复用（M1、M2 删了 M2 剩 M1、M3），新条目取最大编号 +1。AI 持有的编号引用永不过期，避免同会话内先读后删时拿旧编号误改条目

### 威胁扫描（本次讨论）

- **D-11:** 命中即拒绝写入（fail-closed）— 检测到注入模式（如「忽略之前/上面的指令」「泄露系统提示词」等）时拒绝写入，工具结果告知 AI 命中原因，AI 可换措辞重试。与项目安全惯例一致（Phase 24 sanitizeInput 先例）。设置页人工编辑是用户本人操作，不经扫描

### 设置页交互（本次讨论）

- **D-12:** 显式保存按钮 — textarea + 保存按钮，点击才写盘，与现有设置页（分配规则/快捷键）交互一致；顺带字数统计提示（如 1320/2200）和超限阻断。编辑区带「新会话生效」提示（D-04 冻结快照语义）

### Claude's Discretion

- 条目在文件中的具体排版（表头格式、§ 分隔符样式、字符预算表头），只要编号 [Mn] 可解析
- 威胁扫描模式的具体清单与匹配实现（可参考/扩展现有 sanitizeInput 的模式）
- system prompt 中全局快照的注入位置与格式、容器记忆索引指引的措辞
- memory/memory_read 工具的参数 schema 细节与工具结果文案
- `/api/ai-memory` 端点沿用现有 /api/* token 鉴权模式的实现细节
- 设置页「AI 记忆」分区的具体样式（遵循现有设置页风格）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 方案文档（本阶段设计定稿，最高优先）
- `docs/plan/ai-memory-system.md` §三 — 阶段 1 条目记忆 MVP 完整设计：三层存储表、关键决策 6 条、工具接口、任务拆解
- `docs/plan/ai-memory-system.md` §四/§五 — 明确排除在外的阶段 2/3（被动摘要、FTS5 深度记忆），防 scope creep

### 参考项目（设计依据）
- `/Volumes/ZhiTai/Projects/github/hermes-agent/docs/MEMORY_SYSTEM_ANALYSIS.md` — 冻结快照、威胁扫描、字符预算、条目式存储的来源设计
- `/Volumes/ZhiTai/Projects/github/openhanako/docs/tech-stack-and-memory-system.md` — 两节格式摘要、FTS5 深度记忆（远期阶段参考）

### 前序阶段决策
- `.planning/phases/42-ai-pi-agent/42-CONTEXT.md` — 一对话一 Agent 实例（D-09）、对话与容器无绑定、Agent 创建/事件订阅模式
- `.planning/PROJECT.md` Key Decisions — AI 配置按提供商存储、sanitizeInput 先例

### 现有代码
- `ai-manager.js` — REALM_SYSTEM_PROMPT 静态拼接点（initialState.systemPrompt 组装处）、工具注册模式、history 工具的「当前活跃容器解析」模式（memory_read 缺省容器参照）
- `container-manager.js` — 容器删除链路（D-05 钩子挂载点）
- `main.js` — 本地 HTTP 服务器 /api/* 路由 + token 鉴权（D-06 端点挂载点）
- `src/settings-page.js` + `src/settings.html` — 设置页分区布局惯例（D-12 交互参照）
- `src/renderer.js` §AI 聊天面板 — 工具卡片展示（memory 写入经现有工具卡片可见）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`sanitizeInput`（Phase 24）** — 提示输入消毒先例，威胁扫描模式可参考扩展
- **`better-sqlite3` 同步 API 模式** — 本阶段记忆是纯文件存储（md 文件），无需数据库；但模块初始化/路径处理模式（`app.getPath('userData')`）沿用现有 manager 模式
- **`/api/*` HTTP 端点 + token 鉴权** — main.js 本地服务器现成模式，`/api/ai-memory` 直接挂新路由
- **AI 工具注册模式（ai-manager.js）** — memory/memory_read 按现有工具注册链路接入

### Established Patterns
- **realm:// webview 数据访问** — 内部页面走 HTTP /api/*，禁用 realmAPI（Phase 17 根因决策）
- **主进程承担 SDK→UI 事件契约翻译** — 工具结果经 toolResult 消息进上下文，UI 经现有工具卡片展示
- **删除确认文案** — container-manager 现有确认链路补充记忆删除提示

### Integration Points
- `ai-manager.js` — system prompt 组装处（快照注入 + 索引指引）、工具注册、Agent 创建时快照时机
- `container-manager.js` — 删除容器钩子
- `main.js` — HTTP 路由
- `src/settings-page.js` / `src/settings.html` — 「AI 记忆」分区

</code_context>

<specifics>
## Specific Ideas

- 条目编号 [Mn] 在 memory_read 返回、设置页 textarea、工具 replace/remove 参数三处保持一致可见
- 写满 2200 字符时工具结果提示「先整理旧记忆」，引导 AI 用 remove+add 而非放任失败
- 容器记忆文件不存在时 memory_read 返回友好空态文案「该容器暂无记忆」而非报错

</specifics>

<deferred>
## Deferred Ideas

- **阶段 2：被动摘要**（方案文档§四）— openhanako 式自动记忆补全，会话结束/每 N 轮从 ai-conversations.db 异步生成摘要。阶段 1 验证价值后启动
- **阶段 3：FTS5 深度记忆 + search_memory 检索工具**（方案文档§五）— facts 表 + nodejieba 分词 + 检索策略。远期
- **Dream 式记忆整理**（atomize→dedupe→optimize→compose→verify）— 远期可选

</deferred>

---

*Phase: 43-ai-mvp*
*Context gathered: 2026-09-04*

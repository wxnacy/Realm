# AI 记忆系统集成方案（讨论稿）

> 状态：方案讨论已完成，待用户决策排期。本文档总结与参考项目对比后的设计结论。
> 讨论时间：2026-09-04

## 一、参考项目分析

分析了两个外部项目的记忆系统：

- **openhanako (HanaAgent)**：`/Volumes/ZhiTai/Projects/github/openhanako/docs/tech-stack-and-memory-system.md`
- **hermes-agent**：`/Volumes/ZhiTai/Projects/github/hermes-agent/docs/MEMORY_SYSTEM_ANALYSIS.md`

### 两者本质差异

| 维度 | openhanako | hermes-agent |
|------|-----------|--------------|
| 核心思路 | 记忆是「编译产物」——对话流经摘要→分层编译→组装成 memory.md | 记忆是「条目仓库」——MEMORY.md/USER.md 条目式增删改 + 可插拔外部后端 |
| 写入时机 | 被动：每 10 轮 / session 结束 / 每日定时触发编译 | 主动+被动：AI 用 memory 工具主动记，sync_turn 被动同步 |
| 检索方式 | memory.md 全量注入 system prompt；facts.db 按需 FTS5 搜索 | 冻结快照注入 + prefetch 按查询预取 |
| 复杂度 | 高（水位线、断点续跑、Dream 五阶段流水线） | 低（两个 md 文件 + 抽象 Provider 接口） |

### 各自最值得借鉴的点

**Hermes（MVP 该长什么样）：**
- 冻结快照：会话开始时快照记忆进 system prompt，会话内不变，保前缀缓存（省钱省延迟）
- 写入时威胁扫描，防提示注入
- 字符预算而非 token 限制（模型无关、行为可预测）
- 简单工具就够用：add / replace / remove
- 条目式存储（`§` 分隔 + 字符预算表头）

**openhanako（规模化后往哪演进）：**
- 两节格式摘要（facts + timeline）
- 事后异步编译，不阻塞对话
- SQLite + FTS5 深度记忆（标签匹配优先 → FTS5 → LIKE 降级）
- session 结束兜底摘要
- 水位线增量编译、断点续跑、Dream 记忆整理（远期）

### Realm 已有的地基

- **SQLite + FTS5 + nodejieba 中文分词**已在 favorites-manager 用过 —— facts.db 模式可低成本复刻
- `ai-conversations.db` 已持久化全部对话 —— 事后异步编译的数据源现成
- 主进程常驻 —— 定时任务（memory-ticker 式）可跑
- `REALM_SYSTEM_PROMPT` 是静态拼接点 —— 记忆注入在 `initialState.systemPrompt` 组装处
- `sanitizeInput` 安全过滤已有先例

## 二、现状约束（已确认）

- **对话与容器没有绑定**：`ai-conversations-manager.js` 的 `createConversation({ title, model, provider })` 无 containerId；现有 AI 工具的容器上下文都是「调用时解析当前活跃 tab 的容器」（如 ai-manager.js history 工具的模式）

## 三、阶段 1：条目记忆 MVP（已定稿，一个 phase 可完成）

### 存储设计（三层）

| 层 | 文件 | 注入方式 | 写入 |
|----|------|---------|------|
| 用户画像 | `USER.md` 全局一份 | 冻结快照进 system prompt | `memory` 工具 `target: 'user'` |
| 全局记忆 | `MEMORY.md` 全局一份 | 冻结快照进 system prompt | `memory` 工具 `target: 'global'` |
| 容器记忆 | `memories/<containerId>.md` 每容器一份 | **`memory_read` 工具按需读取** | `memory` 工具 `target: 'container'`（按当时活跃容器） |

存储位置：`userData/agent-workspace/ai-memory/` 下（AI 落盘数据统一收纳进 agent 工作区，per docs/plan/ai-file-bash-tools-integration.md；旧 `userData/ai-memory/` 由启动时一次性迁移，迁移后保留作为回滚保险）。容器记忆文件**懒创建**（首次写入才建，不为默认 4 容器预建空文件）。

### 关键决策（已拍板）

1. **写入消歧用方案 A**：memory 工具加 `target` 参数（`'global'` | `'container'` | `'user'`），`'container'` 按当时活跃容器写入，不改对话模型
2. **容器记忆按需加载（skill 原理 / 渐进式披露）**：不进 system prompt。system prompt 只放「索引」指引（各容器有独立持久记忆，处理容器相关任务前先 `memory_read`），AI 通过工具按需拉取，工具结果以 toolResult 消息进对话上下文。多容器场景：AI 对涉及的每个容器显式传 containerId 各读一次
3. **冻结快照只用于全局两层**：会话开始时快照 USER.md + 全局 MEMORY.md 进 system prompt，会话内不变（保前缀缓存），新会话生效。容器记忆走工具读取 = 每次读实时文件，天然无「中途切容器漂移」问题
4. **容器删除**：删除容器时顺带删记忆文件（挂 container-manager 删除链路，现有确认文案补充「将删除该容器的 AI 记忆」）。文件不在 prompt 里，插拔语义成立，文件不存在时 `memory_read` 返回「该容器暂无记忆」
5. **设置页编辑走 HTTP**：`realm://settings` 是 webview，按项目约定走本地 HTTP `/api/*`，新增 `/api/ai-memory` 端点（scope 参数：`user` / `global` / `container:<id>`）+ 容器下拉数据源。UI 为 textarea 原始文本编辑 + 「新会话生效」提示
6. **字符预算**：各文件独立上限（参考 Hermes：MEMORY 2200 / USER 1375 字符），三份全局注入合计建议封顶 ~5000 字符；写满时 add 失败并在结果里提示「先整理旧记忆」

### 工具接口

```
// 写入（一个工具，target 消歧）
memory({ action: 'add'|'replace'|'remove', target: 'user'|'global'|'container', ... })

// 读取（容器记忆专用，按需加载）
memory_read({ scope: 'container', containerId? })  // 省略 = 当前活跃容器
```

### Phase 任务拆解（约 8 个 task）

1. `ai-memory-manager.js` 新模块：条目式存储、字符预算、写入威胁扫描、懒创建
2. `memory` 写入工具注册（add/replace/remove + target 三层消歧）
3. `memory_read` 读取工具注册（containerId 缺省解析活跃容器，参照 history 工具模式）
4. `REALM_SYSTEM_PROMPT` 改造：全局两层冻结快照注入 + 容器记忆索引指引
5. container-manager 删除钩子 + 确认文案补充
6. `/api/ai-memory` 端点（main.js 本地 HTTP 服务器加路由）
7. 设置页「AI 记忆」分区：三文件 textarea 编辑 + 容器下拉 + 生效时机提示
8. 测试 + UAT

排期结论：**单 phase 可完成**，规模与 Phase 36（窗口位置持久化）同级，无需新建里程碑。走 `/gsd-plan-phase` 加入 roadmap 即可。

## 四、阶段 2：被动摘要（未排期，待决策）

openhanako 式自动记忆补全，在阶段 1 验证价值后启动：

- **触发**：会话结束 / 每 N 轮，从 `ai-conversations.db` 异步生成摘要，不阻塞对话
- **格式**：两节格式摘要（facts 用户画像节 + timeline 时间线节，openhanako 验证过的格式）
- **存储**：`summaries/{conversationId}.json`
- **注入**：新会话组装产物 = MEMORY/USER 条目 + 最近摘要
- 字数预算参考 openhanako：`totalBudget = min(400, max(40, turnCount * 40))`

## 五、阶段 3：FTS5 深度记忆 + 检索工具（未排期，待决策）

- **facts 表 + FTS5**（nodejieba 分词，复用 favorites-manager 模式），每日任务从摘要 diff 提取元事实
- 给 Agent 注册 `search_memory` 工具，按需检索而非全量注入
- 检索策略参考 openhanako：标签匹配优先 → FTS5 → LIKE 降级
- Dream 式记忆整理（atomize → dedupe → optimize → compose → verify）为远期可选

## 六、待决策事项

- [ ] 阶段 1 排期：是否加入 roadmap（走 `/gsd-plan-phase`）
- [ ] 阶段 2/3 是否承诺：若承诺，考虑 `/gsd-new-milestone` 建「AI 记忆系统」里程碑统一管理三阶段（共享存储格式设计可在里程碑层面保持一致）；当前建议先不建，阶段 1 用起来验证后再说
- [ ] 容器记忆文件字符上限具体数值（阶段 1 实施时定）
- [ ] 阶段 2 摘要触发轮次 N 的取值（openhanako 用 10，可沿用）

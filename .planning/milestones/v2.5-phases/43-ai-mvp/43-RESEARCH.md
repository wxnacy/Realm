# Phase 43: AI 记忆系统集成（条目记忆 MVP） - Research

**Researched:** 2026-09-04
**Domain:** Electron 主进程文件存储 + pi-agent-core 工具扩展 + realm:// 设置页 HTTP 编辑
**Confidence:** HIGH（设计已定稿于 AI-SPEC/UI-SPEC/方案文档，本研究的价值是把设计锚定到已验证的代码插入点）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**存储与注入架构（方案文档已拍板，直接承接）**

- **D-01:** 三层条目式存储，位置 `userData/ai-memory/` — 用户画像 `USER.md`（全局一份）、全局记忆 `MEMORY.md`（全局一份）、容器记忆 `memories/<containerId>.md`（每容器一份）。容器记忆文件**懒创建**（首次写入才建，不为默认 4 容器预建空文件）
- **D-02:** 写入消歧方案 A — `memory` 工具加 `target` 参数（`'user'` | `'global'` | `'container'`），`'container'` 按当时活跃容器写入，不改对话模型（对话与容器本就无绑定，Phase 42 确认）
- **D-03:** 容器记忆按需加载（skill 原理 / 渐进式披露）— 不进 system prompt。system prompt 只放索引指引（各容器有独立持久记忆，处理容器相关任务前先 `memory_read`），工具结果以 toolResult 消息进对话上下文。多容器场景 AI 对每个涉及的容器显式传 containerId 各读一次
- **D-04:** 冻结快照只用于全局两层 — 会话开始（Agent 实例创建，Phase 42 一对话一实例）时快照 USER.md + 全局 MEMORY.md 进 system prompt，会话内不变（保前缀缓存），新会话生效。容器记忆走工具读取 = 每次读实时文件，无「中途切容器漂移」问题
- **D-05:** 容器删除联动清理 — 挂 container-manager 删除链路，删除容器时顺带删记忆文件，现有确认文案补充「将删除该容器的 AI 记忆」。文件不存在时 `memory_read` 返回「该容器暂无记忆」
- **D-06:** 设置页编辑走 HTTP — `realm://settings` 是 webview，按项目约定走本地 HTTP `/api/ai-memory` 端点（scope 参数：`user` / `global` / `container:<id>`）+ 容器下拉数据源
- **D-07:** 全局字符预算（参考 Hermes）— MEMORY.md 2200 / USER.md 1375 字符，三份全局注入合计封顶 ~5000 字符；写满时 add 失败并在工具结果提示「先整理旧记忆」
- **D-08:** 容器记忆 `memories/<containerId>.md` 上限 **2200 字符** — 与全局 MEMORY.md 一致，统一预算模型。超限行为同 D-07（add 失败提示整理）
- **D-09:** 编号定位 — 文件内条目用 `[M1] [M2]…` 式编号（§ 分隔 + 编号），`memory_read` 返回时带编号，`replace`/`remove` 直接传编号。**Reversibility: costly** — 条目编号写入磁盘文件格式，改定位语义需要迁移已产生的记忆文件
- **D-10:** 稳定编号不回收 — 删除中间条目后编号不复用（M1、M2 删了 M2 剩 M1、M3），新条目取最大编号 +1。AI 持有的编号引用永不过期
- **D-11:** 命中即拒绝写入（fail-closed）— 检测到注入模式时拒绝写入，工具结果告知 AI 命中原因，AI 可换措辞重试。与项目安全惯例一致（Phase 24 sanitizeInput 先例）。设置页人工编辑是用户本人操作，不经扫描
- **D-12:** 显式保存按钮 — textarea + 保存按钮，点击才写盘；字数统计提示（如 1320/2200）和超限阻断。编辑区带「新会话生效」提示

### Claude's Discretion

- 条目在文件中的具体排版（表头格式、§ 分隔符样式、字符预算表头），只要编号 [Mn] 可解析
- 威胁扫描模式的具体清单与匹配实现（可参考/扩展现有 sanitizeInput 的模式）
- system prompt 中全局快照的注入位置与格式、容器记忆索引指引的措辞
- memory/memory_read 工具的参数 schema 细节与工具结果文案
- `/api/ai-memory` 端点沿用现有 /api/* token 鉴权模式的实现细节
- 设置页「AI 记忆」分区的具体样式（遵循现有设置页风格）

### Deferred Ideas (OUT OF SCOPE)

- **阶段 2：被动摘要**（方案文档§四）— 会话结束/每 N 轮从 ai-conversations.db 异步生成摘要
- **阶段 3：FTS5 深度记忆 + search_memory 检索工具**（方案文档§五）
- **Dream 式记忆整理**（atomize→dedupe→optimize→compose→verify）
</user_constraints>

<phase_requirements>
## Phase Requirements

Roadmap 未定义本阶段的 requirement ID（TBD）。以 CONTEXT.md 交付清单为需求基线：

| ID | Description | Research Support |
|----|-------------|------------------|
| 交付 1 | `ai-memory-manager.js` 存储层（三层 md 文件、字符预算、威胁扫描、懒创建） | 「Architecture Patterns — Pattern 1/2/3」+ AI-SPEC §4 State Management |
| 交付 2 | `memory` 写入工具（add/replace/remove + target 消歧） | AI-SPEC §3 Entry Point Pattern（已验证 executionMode/isError 语义） |
| 交付 3 | `memory_read` 读取工具（containerId 缺省解析活跃容器） | Pattern 1：search_history 活跃容器解析实录（逐字引用） |
| 交付 4 | system prompt 快照注入 + 容器记忆索引指引 | Pattern 2：`_recreateAgent` 的 `initialState.systemPrompt` 插入点 |
| 交付 5 | 容器删除联动清理 + 确认文案 | Pattern 4：`deleteContainer` 钩子插入点 + renderer 确认链路 |
| 交付 6 | `/api/ai-memory` 端点 + 设置页「AI 记忆」分区 | Pattern 3：`/api/ai/providers` 路由实录 + settings-page apiToken 模式；43-UI-SPEC 全文 |
</phase_requirements>

## Summary

本阶段是「给既有 Agent 加记忆工具」，设计已在三份文档中定稿（`docs/plan/ai-memory-system.md` §三、43-AI-SPEC、43-UI-SPEC），研究结论是**零新依赖、五个已验证的代码插入点**。核心工作量在新建 `ai-memory-manager.js`（纯 Node 同步文件逻辑：三层 md 存储、[Mn] 编号解析、字符预算、正则威胁扫描、懒创建）和把两个工具挂进 `ai-manager.js` 的 `_buildRealmTools()`。风险最高的三处都已探明：(1) 快照注入点在 `_recreateAgent()` 的 `initialState.systemPrompt`（必须 await 后再 new Agent，G-42-4 实录）；(2) 跨 manager 引用用惰性 require（`getContainersLazy` 既有模式）；(3) 设置页走 HTTP `/api/ai-memory` + REALM_TOKEN 鉴权（`/api/ai/providers` 逐行可参照）。

pi-agent-core 关键语义已对照**随包 README（0.84.3，与安装版本精确一致）**验证：per-tool `executionMode: "sequential"` 存在且「批内任一 sequential 工具则整批串行」（README L120/L421）；工具 `throw` 被 Agent 转 `isError: true` 的 toolResult 回给 LLM（README L440-454）——这是威胁扫描/预算超限 fail-closed 的框架级支撑。

**Primary recommendation:** 按 AI-SPEC §3/§4 的既定模式实施，不偏离；所有插入点均已逐行验证并在本研究标注行号；唯一需要实施时落笔的自由裁量是注入扫描模式清单（D-11 授权）和条目排版（D-09 只约束 [Mn] 可解析）。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 记忆文件存储/解析/预算/扫描 | Main Process（ai-memory-manager.js 新模块） | — | 纯 Node 同步 fs，量级 ≤2200 字符；与 better-sqlite3 同步 API 惯例一致 |
| memory/memory_read 工具 | Main Process（ai-manager.js `_buildRealmTools()`） | AI SDK（pi-agent-core 执行循环） | 工具注册、活跃容器解析、错误语义全在主进程既有链路 |
| 全局快照注入 system prompt | Main Process（`_recreateAgent` Agent 创建时） | — | 一对话一实例（Phase 42 D-09）= 天然「新会话」语义 |
| 容器删除清理记忆文件 | Main Process（container-manager.js `deleteContainer`） | — | 删除链路的原子性必须由删除方保证，不能靠懒读取兜底 |
| 设置页编辑 | realm:// webview（settings-page.js） | Main Process（main.js HTTP `/api/ai-memory`） | 项目铁律：webview 内部页面禁用 realmAPI，走 HTTP /api/* + token |
| 删除确认文案 | Renderer（index.html 原生 `<dialog>`，renderer.js 填充 preview） | — | 现有确认链路在 renderer.js `confirmDeleteContainer` |
| memory 写入的 UI 可见性 | Renderer（既有工具卡片） | — | `tool_execution_start/end` 事件已广播，零新 UI |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @earendil-works/pi-agent-core | 0.84.3（已安装，实测 package.json）[VERIFIED: node_modules/@earendil-works/pi-agent-core/package.json] | Agent 运行时、AgentTool 注册、toolResult 语义 | 既有栈，Phase 41/42 引入，本阶段只加工具不改框架 |
| @earendil-works/pi-ai | 0.84.3（已安装）[VERIFIED: node_modules/@earendil-works/pi-ai/package.json] | 模型层（streamSimple/getModel） | 同上，零改动 |
| Node 内置 fs（同步） | — | 记忆文件读写（tmp+rename 原子替换） | ≤2200 字符/文件，同步 <1ms；免去并发写竞态（AI-SPEC §4b 拍板） |
| node:test | Node v22.22.0 内置 [VERIFIED: node --version → v22.22.0] | 单元/集成测试 runner | AI-SPEC §5 选定，零新依赖 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| 无 | — | — | 本阶段**零新 npm 依赖**（AI-SPEC §2 拍板，替代 mem0/Letta/LangChain 的理由已记录） |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 自建 md 文件存储 | mem0 / Letta / LangChain memory | 全部已被 AI-SPEC §2 否决：云依赖/重运行时/纯抽象开销，与 D-01 文件式设计冲突 |
| LLM 判断注入 | 正则威胁扫描 | AI-SPEC §4b 拍板：正则确定性、零延迟、零成本、可单测；LLM 判断不可预测且违背工具路径实时性 |

**Installation:**
```bash
# 零新依赖 — 两包已在 package.json，本阶段不升级
# "@earendil-works/pi-agent-core": "^0.84.3"
# "@earendil-works/pi-ai": "^0.84.3"
```

## Package Legitimacy Audit

> 本阶段**不安装任何外部包**（零新依赖为 AI-SPEC 锁定决策）。既有依赖 pi-agent-core / pi-ai 已在 Phase 41 通过审查并随包使用至今，本 session 实测 `node_modules` 内版本 0.84.3 与 AI-SPEC 声明一致 [VERIFIED: node_modules/*/package.json]。审计跳过，无 REMOVED / SUS 项。

## Architecture Patterns

### System Architecture Diagram

```
┌─ AI 会话链路 ─────────────────────────────────────────────────────────┐
│                                                                       │
│  新会话（_recreateAgent，一对话一实例）                                │
│      │ 读 USER.md + MEMORY.md（冻结快照，≤~5000 字符，D-04/D-07）      │
│      ▼                                                                │
│  Agent(systemPrompt = REALM_SYSTEM_PROMPT + <persistent-memory> 快照   │
│        + 容器记忆索引指引 [D-03])                                      │
│      │                                                                │
│      ▼                                                                │
│  LLM 循环 ──► tool call: memory({action,target,content|entryId})      │
│      │              │ execute 内 fail-closed 校验（全部 throw）：      │
│      │              │   ① 参数组合 → ② scanInjectionPatterns [D-11]   │
│      │              │   → ③ 字符预算 [D-07/D-08] → ④ 同步原子落盘     │
│      │              ▼                                                 │
│      │         ai-memory-manager.write()                              │
│      │              │ target 消歧（D-02）：                            │
│      │              │   user → userData/ai-memory/USER.md             │
│      │              │   global → userData/ai-memory/MEMORY.md         │
│      │              │   container → memories/<当时活跃容器id>.md       │
│      ▼              ▼                                                 │
│  toolResult(isError?) 回灌 LLM ◄── throw→isError:true（README L454）   │
│                                                                       │
│  tool call: memory_read({containerId?}) ──► 实时读 memories/<id>.md    │
│      （缺省=当前活跃容器；文件不存在→「该容器暂无记忆」空态，D-05）     │
│      toolResult 进对话上下文（_compactContext 窗口 20 条内有效）        │
└───────────────────────────────────────────────────────────────────────┘

┌─ 用户编辑链路 ────────────────────────────────────────────────────────┐
│  realm://settings webview（settings-page.js）                         │
│      │ fetch /api/ai-memory?token=REALM_TOKEN（D-06；webview 禁 IPC）  │
│      ▼                                                                │
│  main.js 本地 HTTP 服务器 → aiMemoryManager（scope: user/global/      │
│  container:<id>；人工编辑不经威胁扫描，D-11）                          │
└───────────────────────────────────────────────────────────────────────┘

┌─ 生命周期链路 ────────────────────────────────────────────────────────┐
│  renderer.js 删除容器确认（原生 <dialog> + preview）                   │
│      → realmAPI.deleteContainer → container-manager.deleteContainer   │
│      → await cookieManager.deleteCookies(id) 之后                     │
│      → aiMemoryManager.deleteContainerMemory(id) [D-05 钩子]          │
└───────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
Realm/
├── ai-manager.js              # 改动：_buildRealmTools() 追加 2 工具；_recreateAgent 快照注入；REALM_SYSTEM_PROMPT 索引指引
├── ai-memory-manager.js       # 新增：三层存储、[Mn] 编号解析、预算、scanInjectionPatterns、懒创建、原子写
├── container-manager.js       # 改动：deleteContainer() 挂清理钩子（惰性 require）
├── main.js                    # 改动：/api/ai-memory 路由（handleSettingsApi 风格）
├── src/settings.html          # 改动：settings-ai-assistant 内新增「AI 记忆」settings-group（UI-SPEC 结构）
├── src/settings-page.js       # 改动：AI 记忆分区逻辑（tab 切换、取数、保存、字数统计）
├── test/memory/               # 新增（Wave 0）：node:test 单元/集成测试 + 场景 harness 骨架
└── userData/ai-memory/        # 运行时数据（app.getPath('userData')，不进仓库，懒创建）
```

### Pattern 1: 工具内活跃容器缺省解析（memory_read 直接套用）
**What:** containerId 参数省略时解析「当前活跃 tab 的容器」，无活跃 tab 时 fail-closed 报错。
**When to use:** `memory_read` 的缺省容器解析、`memory` 工具 `target:'container'` 的落层解析（D-02 方案 A）。
**Example**（search_history 实录，逐字引用）[VERIFIED: ai-manager.js:2321-2328]：
```javascript
// 如果未指定容器，自动获取当前活跃容器
if (!containerId) {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.containerId) {
    throw new Error('无法获取当前容器，请先打开一个标签页');
  }
  containerId = activeTab.containerId;
}
```
同款报错文案在 list_history / delete_history 重复出现 [VERIFIED: ai-manager.js:2407-2413]，是项目稳定惯例。

### Pattern 2: 冻结快照注入点（Agent 创建路径）
**What:** `initialState.systemPrompt` 组装处一次性拼入全局两层快照。
**When to use:** `_recreateAgent()`（切换/新建对话都会走）与 `init()` 两处 Agent 创建点——**两处都要改**，漏一处会出现「部分会话无记忆」。
**Example**（现有代码，插入点在 systemPrompt 值）[VERIFIED: ai-manager.js:2121-2158]：
```javascript
async _recreateAgent() {
  // ...
  const { Agent } = await import('@earendil-works/pi-agent-core');  // ESM-only，require() 直接失败
  // ...
  this.agent = new Agent({
    initialState: {
      systemPrompt: REALM_SYSTEM_PROMPT,   // ← 改为 REALM_SYSTEM_PROMPT + '\n\n' + memorySnapshot
      model,
      tools: this.tools,
    },
    streamFn: this.models.streamSimple.bind(this.models),
    convertToLlm: (messages) => {          // 已放行 'toolResult'，memory 结果天然可见，零改动
      return messages.filter(msg =>
        msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult'
      );
    },
    transformContext: this._compactContext.bind(this),
  });
  this._setupEventBroadcasting();
}
```
另一处 Agent 创建在 `init()` 内（约 L725-737），同样拼 `initialState.systemPrompt: REALM_SYSTEM_PROMPT` [VERIFIED: ai-manager.js:725-737]。`buildGlobalSnapshot()` 必须是同步函数（或 await 完成后才 `new Agent`）——动态 import 后 `this.agent` 在微任务才赋值，同步帧内恒 null（G-42-4 实录，STATE.md 有案）。

### Pattern 3: HTTP 端点 + token 鉴权（/api/ai-memory 直接套用）
**What:** main.js 本地 HTTP 服务器的路由函数模式：token 鉴权 → route 解析 → readJsonBody/sendJson。
**When to use:** `/api/ai-memory` 的 GET（取记忆文本 + 容器下拉数据）/ POST（保存）。
**Example**（/api/ai/providers 实录，token 检查逐字引用）[VERIFIED: main.js:1382-1404]；token 检查模式 [VERIFIED: main.js:767-768]：
```javascript
// token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改历史
if (reqUrl.searchParams.get('token') !== REALM_TOKEN) { /* 401 */ }
// 路由形状（providers 为参照）：
// GET  /api/ai/providers        → sendJson(res, 200, await aiManager.getAvailableModels())
// POST /api/ai/providers        → const config = await readJsonBody(req); … sendJson(res, 200, { success: true })
// 错误统一：catch 里 sendJson(res, 400, { error: err.message })   [VERIFIED: main.js:1480-1483]
```
REALM_TOKEN 定义于 main.js 顶部（L102 注释：`/api/*` 与 `/proxy` 鉴权）[VERIFIED: main.js:102]。settings-page 侧取 token 的方式 [VERIFIED: src/settings-page.js:46-47, 146-147]：
```javascript
const apiToken = pageParams.get('token') || '';
// …
const params = new URLSearchParams({ token: apiToken, ...query });
const res = await fetch(`/api/search-config/${route}?${params.toString()}`, options);
```

### Pattern 4: 容器删除钩子（D-05 挂载点）
**What:** `deleteContainer(id)` 内、`await cookieManager.deleteCookies(id)` 之后追加记忆文件清理。
**When to use:** 交付 5。跨 manager 引用用惰性 require（避开 electron-store 顶层依赖链，ai-manager 既有模式）。
**Example**（现有代码 + 插入点标注）[VERIFIED: container-manager.js:287-316]：
```javascript
async function deleteContainer(id) {
  if (id === 'default') { return { success: false, message: '无法删除默认容器' }; }
  // … await container.session.clearStorageData(); containers.delete(id);
  await cookieManager.deleteCookies(id);
  // ← D-05 钩子插入点：aiMemoryManager.deleteContainerMemory(id)（惰性 require('./ai-memory-manager')）
  // … configStore.set('containers', …)
  return { success: true };
}
```
惰性 require 模式实录 [VERIFIED: ai-manager.js:78-79]：
```javascript
function getContainersLazy() {
  return require('./container-manager').getContainers();
}
```
确认文案入口在 renderer：`deleteContainerPreview` 填充（L4365-4366）+ `confirmDeleteContainer()`（L4378-4398 调 `realmAPI.deleteContainer`）[VERIFIED: src/renderer.js:4365-4366, 4373-4398]——UI-SPEC 要求在 preview 追加「该容器的 AI 记忆将一并删除」。

### Pattern 5: 威胁扫描的既有先例（D-11 参照）
**What:** ai-manager.js 已有两代模式扫描器：`sanitizeInput`（消毒：null 字节过滤 + `${...}` 模板字面量移除）[VERIFIED: ai-manager.js:99-139] 和 `validateScript`（fail-closed 检测：`{ pattern, name }` 数组 + 命中返回 `{ safe: false, reason }`）[VERIFIED: ai-manager.js:150-178]。
**When to use:** `scanInjectionPatterns(content)` 按 `validateScript` 的形状实现（pattern 数组、命中带 reason），但语义是**注入指令检测**（「忽略之前/上面的指令」「泄露系统提示词」「你现在是……」及变体）而非危险 API 检测。清单是 Claude's Discretion（D-11 授权）。注意区分：sanitizeInput 是**改写**输入，memory 场景 D-11 拍板的是**拒绝写入**（fail-closed），不要复用消毒语义。

### Pattern 6: pi-agent-core 工具契约（随包 README 验证）
**What:** AgentTool 定义、executionMode、错误语义。
**Verified 语义**（随包 README，与安装版本 0.84.3 精确一致）：
- per-tool `executionMode: "sequential"`：批内任一 sequential 工具则**整批**串行 [VERIFIED: node_modules/@earendil-works/pi-agent-core/README.md:120, 421]
- 「Throw an error when a tool fails. Do not return error messages as content. … Thrown errors are caught by the agent and reported to the LLM as tool errors with `isError: true`」[VERIFIED: node_modules/@earendil-works/pi-agent-core/README.md:440-454]
- execute 签名 `async (toolCallId, params, signal, onUpdate)`，返回 `{ content: [{type:'text',text}], details }` [VERIFIED: README.md:422-433]
- 现有工具的 parameters 用普通 JSON Schema（search_history 实录 [VERIFIED: ai-manager.js:2310-2316]），非 TypeBox 构造器——沿用即可
**Example:** AI-SPEC §3 的 memory 工具完整定义（enum/pattern/executionMode）直接采用，无需重设计。

### Anti-Patterns to Avoid
- **在 renderer/main.js 之外另写一份默认预算表**：预算数值（2200/1375/2200）应只在 ai-memory-manager.js 定义一处，main.js / settings-page.js 经 manager API 读取（参照 shortcut-manager「默认值唯一来源」惯例）
- **容器记忆进 system prompt**：违反 D-03；只有全局两层进快照
- **设置页人工编辑走威胁扫描**：违反 D-11（用户本人操作不经扫描）；扫描只在 memory 工具路径
- **fire-and-forget 异步写**：execute 内必须同步完成 tmp+rename 才 return（AI-SPEC §4b：run 结束早于写盘完成时，_compactContext 可能已裁掉上下文、工具卡片提前 completed）
- **memory_read 结果做进程内缓存**：D-04 明确容器层每次读实时文件；全局两层有「新会话快照」语义，不需要缓存层

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 工具失败回传 LLM | 自定义错误协议/错误文本返回值 | `throw` → SDK 转 `isError:true` toolResult | README L440-454 明确约定；返回错误文本 LLM 会当成功照单全收（AI-SPEC 失败模式 5） |
| 同批写入竞态防护 | 自建写锁/队列 | `executionMode: 'sequential'`（SDK 原生） | README L120：批内任一 sequential 则整批串行 |
| HTTP 鉴权 | 新写鉴权方案 | REALM_TOKEN 查询参数模式（main.js 既有） | 防 CSRF/端口扫描的既定方案，7+ 个 /api/* 路由同款 |
| realm:// 页面数据访问 | preload/realmAPI | 本地 HTTP /api/* | 项目铁律（AGENTS.md；Phase 17 根因决策；主窗口 file:// 才走 IPC） |
| 活跃容器解析 | 新的容器上下文机制 | search_history 的 getActiveTab 模式 | 对话与容器无绑定（Phase 42 确认），「调用时解析」是唯一正确语义 |

**Key insight:** 本阶段几乎没有需要发明的机制——所有难点（错误语义、并发、鉴权、容器解析）在框架或项目里都有已验证答案；自建的只有 `ai-memory-manager.js` 的纯文件逻辑。

## Common Pitfalls

### Pitfall 1: ESM-only 包被 require() 加载
**What goes wrong:** `require('@earendil-works/pi-agent-core')` 直接失败。
**Why it happens:** 两包 package.json `"type": "module"`，CommonJS 主进程只能 `await import()`。
**How to avoid:** 沿用 ai-manager.js 现有动态 import 写法；新模块 ai-memory-manager.js 本身用 CommonJS（`module.exports`），与主进程其他 manager 一致（AI-SPEC §3 核心导入已注明）。
**Warning signs:** 启动即 `ERR_REQUIRE_ESM`。

### Pitfall 2: `_recreateAgent` 不 await → agent 恒 null / 快照为空
**What goes wrong:** 快照注入的读文件若被异步化，或调用方不 await `_recreateAgent()`，`this.agent` 同步帧内恒 null。
**Why it happens:** 动态 import() 在微任务后才赋值（G-42-4 实录，Phase 42 上下文丢失根因）。
**How to avoid:** `buildGlobalSnapshot()` 实现为**同步函数**（读 ≤2200 字符文件，同步成本可忽略）；所有调用点维持 `await this._recreateAgent()`（现状已是如此）。
**Warning signs:** 新会话 system prompt 无 `<persistent-memory>` 段。

### Pitfall 3: 两处 Agent 创建点只改一处
**What goes wrong:** `init()`（L725-737）与 `_recreateAgent()`（L2142-2147）各自拼 `initialState.systemPrompt`，只改一处会导致部分路径的会话无记忆快照。
**How to avoid:** 抽一个 `buildSystemPrompt()` 小函数（REALM_SYSTEM_PROMPT + 快照）供两处共用；计划里作为独立验证项。
**Warning signs:** 冷启动首个会话无记忆、切换对话后有记忆（或反之）。

### Pitfall 4: 工具返回错误文本冒充成功
**What goes wrong:** 威胁扫描命中/预算超限时 `return { content: [{text: '写入失败…'}] }`——LLM 视为成功，继续对话，用户「以为记住了」。
**How to avoid:** 业务校验失败一律 `throw new Error('…原因…如何修正…')`（README L440-454）；错误消息写清修正指引（「先 remove 整理旧条目」/「换措辞重试」），LLM 下一轮自动重试。
**Warning signs:** UAT 中 AI 对失败写入不补救。

### Pitfall 5: parameters schema 与 description 不一致 → LLM 反复生成非法参数
**What goes wrong:** SDK 在 execute 前强预检 schema；`enum` 值、`entryId` pattern（`^M[0-9]+$`）与 description 语义不符时工具根本不执行，LLM 反复重试。
**How to avoid:** description 里写清 replace/remove 必须传 entryId、add/replace 必须传 content；enum 与 D-02 的三个值逐字一致（AI-SPEC §3 Pitfall 5）。
**Warning signs:** tool_execution_end 日志全是参数校验失败。

### Pitfall 6: settings 页 CSP `style-src 'self'` 吃掉 markup 内联样式
**What goes wrong:** `style="display:none"` 初始隐藏不生效，容器下拉/非激活 tab 面板闪现。
**How to avoid:** 初始隐藏走 CSS 类规则，切换用 JS CSSOM `el.style.display = 'flex'/'block'/'none'`，不依赖 `''` 回落（AGENTS.md 内部页面 CSP 小节 + 43-UI-SPEC CSP 约束）。
**Warning signs:** 页面加载瞬间看到未激活 tab 的 textarea。

### Pitfall 7: 悬空编号静默错改
**What goes wrong:** AI 先 `memory_read` 拿编号，用户在设置页删了条目，之后 `replace/remove` 用旧编号——若解析器「就近匹配」会改错条目。
**How to avoid:** 编号解析按行首 `[M(\d+)]` 精确匹配；编号不存在时 `throw`（fail-closed），绝不就近匹配（AI-SPEC 失败模式 4 + D-10 稳定编号语义：新条目取 max+1，删除只删行不回收）。
**Warning signs:** 单测缺「悬空 ID fail-closed」用例。

### Pitfall 8: 字符计数口径漂移
**What goes wrong:** manager 用 JS `string.length`（UTF-16 code unit），设置页用 `textarea.value.length` 或字节——两端预算数字对不上。
**How to avoid:** 统一 JS `string.length`（项目先例：MAX_CONTENT_SIZE 注释明确「单位按 JS string.length（UTF-16 code unit）计数字符而非字节」[VERIFIED: ai-manager.js:499-503]）；设置页字数统计与 HTTP 保存端服务端校验用同一口径（UI-SPEC：服务端同样校验双保险）。
**Warning signs:** 设置页显示 2199/2200 但保存被服务端拒绝。

### Pitfall 9: 打包环境路径（asar）
**What goes wrong:** 记忆文件路径必须落 `app.getPath('userData')`（用户数据，打包后可写）；误用 `__dirname` 相对路径在打包 .app 里指向只读 asar。
**How to avoid:** 沿用现有 manager 模式（`app.getPath('userData')`）；`ai-memory/` 目录与 `memories/` 子目录懒创建。
**Warning signs:** 打包版启动后写入报 EROFS/ENOENT。

## Code Examples

以下骨架综合 AI-SPEC §3/§4 定稿与本研究验证的插入点，实施时按此展开：

### memory_read 工具（完整形态）
```javascript
// Source: AI-SPEC §3 + Pattern 1（ai-manager.js search_history 实录）
{
  name: 'memory_read',
  label: '读取容器记忆',
  description: '读取指定容器的持久记忆（工作记忆：项目惯例、登录状态、站点注意事项）。'
    + 'containerId 省略时读当前活跃容器；处理容器相关任务前先调用此工具。',
  parameters: {
    type: 'object',
    properties: {
      containerId: { type: 'string', description: '容器 ID（可选，默认当前活跃容器）' },
    },
  },
  execute: async (toolCallId, params) => {
    let { containerId } = params;
    if (!containerId) {
      const activeTab = tabManager.getActiveTab();
      if (!activeTab || !activeTab.containerId) {
        throw new Error('无法获取当前容器，请先打开一个标签页');
      }
      containerId = activeTab.containerId;
    }
    const text = aiMemoryManager.readContainer(containerId);
    // 文件不存在 → 友好空态而非 throw（D-05；唯一定义的「不 throw」例外）
    return {
      content: [{ type: 'text', text: text || '该容器暂无记忆' }],
      details: { containerId, empty: !text },
    };
  },
}
```

### ai-memory-manager.js 模块骨架
```javascript
// Source: AI-SPEC §4 State Management + D-07~D-11（CommonJS，同步 fs）
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const BUDGETS = { user: 1375, global: 2200, container: 2200 };  // D-07/D-08 唯一来源

function memoryDir() { return path.join(app.getPath('userData'), 'ai-memory'); }
function resolveFile(target, containerId) {
  if (target === 'user') return path.join(memoryDir(), 'USER.md');
  if (target === 'global') return path.join(memoryDir(), 'MEMORY.md');
  return path.join(memoryDir(), 'memories', `${containerId}.md`);   // 懒创建由 write 负责
}
function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });            // 懒创建 memories/
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);                                         // 原子替换
}
// parseEntries: 按行首 /^\[M(\d+)\]\s?/ 提取编号；remove 只删行；nextId = max+1（D-09/D-10）
// scanInjectionPatterns: { pattern, name } 数组，命中返回 { safe:false, reason }（Pattern 5 形状）
// write(params): 参数组合 → 扫描 → 预算 → 编号操作 → atomicWrite；校验失败一律 throw
// buildGlobalSnapshot(): 同步；读 USER.md + MEMORY.md，产出 <persistent-memory> XML 段 + 容器索引指引
```

### system prompt 快照段（格式约定）
```markdown
<!-- Source: AI-SPEC §4 Core Pattern（XML 风格包裹，与 <context-summary>/<referenced-tab> 惯例一致） -->
<persistent-memory>
## 用户画像（USER.md）
[U1] …
## 全局记忆（MEMORY.md）
[M1] …
</persistent-memory>

## 容器记忆指引
各容器有独立持久记忆。处理容器相关任务前，先调用 memory_read（可传 containerId；省略读当前活跃容器）。多容器任务对每个涉及的容器各读一次。
```
（条目排版、指引措辞在 Claude's Discretion 内，但编号 [Mn]/[Un] 必须与工具参数 pattern 一致。）

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 对话历史即记忆（全量注入） | 冻结快照 + 按需工具读取（渐进式披露） | hermes-agent / openhanako 实践（2025-2026） | 前缀缓存省钱省延迟；容器记忆不占 prompt |
| Token 上限 | 字符预算（模型无关） | hermes-agent | 行为可预测，跨供应商一致（D-07 采用） |
| 事后摘要编译（openhanako 式） | 本阶段不做，主动工具写入起步 | 方案文档排期结论 | 阶段 2/3 显式 deferred，防 scope creep |

**Deprecated/outdated:** 无需淘汰的既有实现——本阶段是纯新增（REALM_SYSTEM_PROMPT 追加段 + 工具数组追加）。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 注入扫描模式清单的具体正则（「忽略之前/上面的指令」等）足以覆盖常见注入且误报可控 | Pattern 5 / D-11 | 误报过高 → AI 无法完成合理记忆（功能不可用）；漏报 → 记忆投毒。缓解：AI-SPEC §5 维度① 的攻击/良性双语料库单测 + flywheel 误报复盘机制 |
| A2 | `init()` 的 Agent 创建点位于 ai-manager.js 约 L725-737（grep 定位，与 `_recreateAgent` 结构一致） | Pattern 2 / Pitfall 3 | 若行号漂移不影响正确性——插入点是 `initialState.systemPrompt` 赋值处，实施时以 grep `REALM_SYSTEM_PROMPT` 定位即可（全文件仅 2 处 initialState 引用 + 1 处定义） |
| A3 | `/api/ai-memory` 挂进现有 `handleSettingsApi`（`/api/settings/*` 风格）或平级新 handler 均可，以 main.js 现有服务器分发结构为准 | Pattern 3 | 低——两种挂法在既有代码中都有先例（settings/search-config/ai 平级 handler 并存），不影响行为 |

其余全部结论均逐行验证（标注 VERIFIED + 行号）或为 CONTEXT.md/AI-SPEC/UI-SPEC 锁定决策的转述，无训练记忆来源的离散值。

## Open Questions (RESOLVED)

1. **设置页容器下拉的数据源端点**
   - What we know: settings-page.js 已有 `fetchContainers()` [VERIFIED: src/settings-page.js:77-79]，走既有容器列表 API。
   - What's unclear: 直接复用即可，但 UI-SPEC 未指明 API 路径——实施时照抄该函数现状。
   - Recommendation: 无需决策，复用现有函数。
   - RESOLVED: 复用 `fetchContainers()`（/api/containers/list），零新端点——已落 43-03-PLAN.md Task 2 action 与 must_haves。

2. **`/api/ai-memory` 的容器 scope 对不存在容器 ID 的行为**
   - What we know: D-05 只定义了「删除后 memory_read 空态」；设置页对已删容器 scope 的 GET/POST 未定义。
   - Recommendation: GET 返回空态（与 memory_read 一致）；POST 返回 400「容器不存在」（防手改 URL 写入孤儿文件）。计划里落为明确行为。
   - RESOLVED: GET 空态 / POST 400「容器不存在」——已落 43-03-PLAN.md Task 1 action 与 acceptance_criteria。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js（测试 runner node:test） | test/memory/ | ✓ | v22.22.0 [VERIFIED: node --version] | — |
| @earendil-works/pi-agent-core | Agent/工具循环 | ✓ | 0.84.3 [VERIFIED: node_modules package.json] | — |
| @earendil-works/pi-ai | 模型层（零改动） | ✓ | 0.84.3 [VERIFIED] | — |
| Electron | app.getPath('userData') | ✓ | ^43.3.0（package.json） | — |
| Hermes 参考文档（外部卷） | 设计溯源（已在方案文档内化） | ✓ [VERIFIED: 文件存在] | — | 方案文档 §一/§三已内化其结论，不阻断 |

**Missing dependencies with no fallback:** 无。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test（Node v22.22.0 内置，零新依赖） |
| Config file | none — 新建 `test/memory/`（Wave 0） |
| Quick run command | `npm run test:memory`（package.json 新 script：`node --test test/memory/`） |
| Full suite command | `npm run test:memory` + `npm run validate`（既有回归） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 交付 1 | 三层存储/编号解析/稳定编号不回收/悬空 ID fail-closed | unit | `npm run test:memory`（test/memory/storage.test.js） | ❌ Wave 0 |
| 交付 1 | 预算边界（恰好满/超 1 字符）、扫描命中/良性误报语料库 | unit | `npm run test:memory` | ❌ Wave 0 |
| 交付 1 | 原子写+回读一致性、懒创建（临时 userData 注入） | unit | `npm run test:memory` | ❌ Wave 0 |
| 交付 2/3 | memory 工具 target 路由、active container 解析、throw 语义 | unit | `npm run test:memory`（需可注入 tabManager mock 或独立解析函数） | ❌ Wave 0 |
| 交付 4 | 快照含全局两层、不含容器层 | unit | `npm run test:memory` | ❌ Wave 0 |
| 交付 5 | deleteContainer 后 memories/<id>.md 不存在 | unit/integration | `npm run test:memory` | ❌ Wave 0 |
| 交付 6 | /api/ai-memory GET/POST + token 鉴权 | integration（可选，HTTP 层薄） | `npm run test:memory` 或 UAT 手工 | ❌ Wave 0 |
| 场景 harness | 14 个 fixture（AI-SPEC §5 参考数据集） | scenario | `npm run eval:memory`（需已配置模型 Key，无 Key skip） | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:memory`
- **Per wave merge:** `npm run test:memory && npm run validate`
- **Phase gate:** 全绿 + 场景 harness UAT 前全量跑一次（AI-SPEC §5：harness 耗真实 token，不设为提交门禁）

### Wave 0 Gaps
- [ ] `test/memory/` 目录 + `npm run test:memory` / `npm run eval:memory` scripts（package.json）
- [ ] ai-memory-manager.js 的可测试性设计：`userData` 路径必须可注入（临时目录），electron `app` 依赖需延迟获取或经参数传入——**这是 Wave 0 唯一的架构性前置**（现有 manager 直接用 `app.getPath`，测试注入模式可参照 `Store` 实例化传入的思路，或把路径解析收敛为单一可覆写函数）
- [ ] 场景 harness 骨架（fixture 格式 per AI-SPEC §5：`{ name, turns: [{ user, expect: { toolCalls, fileState, throws } }] }`）

*(实施提示：项目现有「测试」是 scripts/test-*.js 独立脚本（npm run validate 串联），无 node:test 先例——采用 AI-SPEC 选定的 node:test 是新惯例，计划里第一个 task 应建立该基建。)*

## Security Domain

### Applicable ASVS Categories（security_asvs_level: 1）

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本地单机应用，无用户账号体系 |
| V3 Session Management | no | 同上 |
| V4 Access Control | yes | `/api/ai-memory` 沿用 REALM_TOKEN 查询参数鉴权（防 CSRF/端口扫描，main.js 7+ 路由同款） |
| V5 Input Validation | yes | 工具参数 JSON Schema 预检 + execute 内 fail-closed 业务校验（威胁扫描/预算/参数组合）；scope 参数白名单解析（`user`/`global`/`container:<id>`） |
| V6 Cryptography | no | 记忆为本地明文 markdown（产品承诺：透明可查，AI-SPEC §1b）；不引入加密 |
| V14 Data Protection | partial | 容器隔离 = 访问边界：container 记忆只经显式 memory_read 进上下文；删除联动清理（D-05）即数据残留控制 |

### Known Threat Patterns for Electron + LLM 工具链

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 记忆投毒（恶意网页 → AI 转述 → 写入持久记忆，跨会话放大） | Tampering | scanInjectionPatterns fail-closed 拒写（D-11）+ throw→isError 回灌（AI-SPEC 失败模式 1，Critical） |
| 凭据入库外发（密码/API Key 随冻结快照发云端供应商） | Information Disclosure | 凭据形态模式拦截（AI-SPEC §6 追加 guardrail，落在 D-11 清单裁量内；若不做必须在 REVIEW.md 记录取舍） |
| localhost 端口扫描读改记忆文件 | Elevation of Privilege | REALM_TOKEN 鉴权（Pattern 3） |
| 跨容器记忆泄漏（target 解析错/删除钩子失效） | Information Disclosure | 「当时活跃容器」解析时机锁定在 execute 内（D-02）；deleteContainer 钩子（D-05）；监控指标「memories/ 残留数恒为 0」（AI-SPEC §7） |
| HTTP 端点写孤儿记忆（不存在容器 scope） | Tampering | POST 容器 scope 校验容器存在（Open Question 2 建议） |

## Sources

### Primary (HIGH confidence)
- `node_modules/@earendil-works/pi-agent-core/README.md`（0.84.3 随包文档）— AgentTool 接口、executionMode 语义（L120/421）、错误处理约定（L440-454）
- `ai-manager.js` — sanitizeInput/validateScript（L99-178）、REALM_SYSTEM_PROMPT（L435-488）、MAX_CONTEXT_MESSAGES=20（L491）、init Agent 创建（L725-737）、_recreateAgent（L2121-2162）、search_history 活跃容器解析（L2321-2328）、_compactContext（L4598-4600）、getContainersLazy（L78-79）
- `container-manager.js` — deleteContainer 全链路（L287-316）
- `main.js` — REALM_TOKEN（L102）、token 鉴权逐字模式（L767-768）、/api/ai/providers 路由族（L1382-1484）、错误响应（L1480-1483）
- `src/settings-page.js` — apiToken（L46-47）、searchApi fetch 模式（L146-147）、fetchContainers（L77-79）
- `src/settings.html` — settings-ai-assistant section（L266）、search-config-section 结构（L420-424）
- `src/renderer.js` — 删除容器确认链路（L4365-4366, L4373-4398）
- `.planning/phases/43-ai-mvp/43-CONTEXT.md` / `43-AI-SPEC.md` / `43-UI-SPEC.md`、`docs/plan/ai-memory-system.md` §三 — 设计定稿（ground truth）
- `/Volumes/ZhiTai/Projects/github/hermes-agent/docs/MEMORY_SYSTEM_ANALYSIS.md` — 存在性确认（设计结论已在方案文档内化）

### Secondary (MEDIUM confidence)
- 无外部网络检索（config.json 所有搜索 provider 均为 false；本阶段全部知识可从随包文档 + 仓库代码验证）

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 零新依赖，版本经 node_modules 实测
- Architecture: HIGH — 全部插入点逐行验证并标行号；框架语义经随包 README 验证
- Pitfalls: HIGH — 大部分为 Phase 42 实录沉淀（G-42-4 等，STATE.md 有案）+ 项目 AGENTS.md 既有约定
- 威胁扫描清单: MEDIUM — 具体正则属实施裁量（A1），有测试语料库机制兜底

**Research date:** 2026-09-04
**Valid until:** 2026-10-04（stable；pi-agent-core 不升级则长期有效）

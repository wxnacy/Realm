# Architecture Research: Realm AI 助手技能（Skill）能力集成

**Domain:** 在既有 Electron 多容器浏览器（Realm Browser）中新增 Agent Skills 体系
**Researched:** 2026-09-10
**Confidence:** HIGH（SDK 源码 + 现有集成点均为直接读取验证）
**范围限定:** 只回答「新 skill 功能如何嵌入既有架构」。既有模块的内部机制（CDP/嗅探/播放器等）不在本文范围。

---

## Executive Summary

pi-agent-core 0.84.3 提供了完整的 skill **原语**，但 Realm 用的是裸 `Agent` 而不是 `AgentHarness`，因此 SDK 不会自动接线任何一环——`loadSkills` / `loadSourcedSkills` / `formatSkillsForSystemPrompt` / `formatSkillInvocation` 四个函数都需要 Realm 自己在正确的时机调用（`node_modules/@earendil-works/pi-agent-core/dist/index.d.ts:13-14` 确认它们从包根导出，可直接 `await import('@earendil-works/pi-agent-core')` 取用，与现有 `Agent` 动态导入同一入口）。

集成的核心张力只有一个：**`loadSkills` 是异步的，而 `buildSystemPrompt()` 必须是同步的**。这个约束在 `ai-memory-manager.js:359-361` 有明确的事故记录（"Agent 创建路径不可异步化——动态 import 后 this.agent 在微任务才赋值，同步帧内恒 null，G-42-4 实录"）。解法是把 skill 加载结果冻结进一个模块级缓存（`ai-skills-manager` 内），`buildSystemPrompt()` 同步读缓存——与 `getAiMemoryManagerLazy().buildGlobalSnapshot()`（`ai-manager.js:563`）完全同构，这是本项目已经验证过的模式。

第二个关键发现（对 roadmap 影响最大）：**两个 skill 目录放在 `agent-workspace/` 内部时，`createSandboxEnv` 的硬沙箱零改动即可放行**。`resolveInside`（`agent-workspace.js:136-166`）的判据是「路径前缀落在 root 内」，skill 目录天然满足；`createSandboxEnv`（`:179-350`）包装的 17 个 FileSystem 方法全部按同一 root 校验。这意味着 `loadSkills(env, dirs)` 直接吃 `this.sandboxEnv` 就能工作（SDK 内部只用 `fileInfo/listDir/readTextFile/canonicalPath/joinPath`，全部已在沙箱白名单内）。代价是：**硬沙箱无法区分 `skills/` 与 `managed-skills/`**——"AI 不可删内置技能"这条边界必须在工具层（`manage_skill`）实现，不能指望沙箱。

第三个关键发现：**「技能必须在工作区内」不是可选项，而是 SDK 契约的硬要求**。`formatSkillsForSystemPrompt`（`dist/harness/system-prompt.js:5-20`）在 system prompt 里注入 `<location>技能文件的绝对路径</location>`，并指示模型「Read the full skill file when the task matches its description」。模型据此调用 `read` 工具——而 `read` 受硬沙箱限制。如果技能目录在工作区外，模型会看到 location 但读不到文件，**自动匹配能力静默失效**（不报错，只是永远读失败）。这条决定了 (a) 的答案没有别的选择。

第四个发现：**项目当前没有任何 zip 解包能力**（`package.json` dependencies 无 `adm-zip`/`yauzl`/`jszip`/`fflate`/`extract-zip`，Node 内置 `zlib` 只有裸 deflate，不含 ZIP 容器解析）。zip 导入是本里程碑唯一的"新能力空白"，也是唯一需要"加依赖 vs 手写"决策的点。项目有强烈的零新依赖先例（PROJECT.md Key Decisions："fMP4 转录走纯 JS 字节拼接而非可选依赖 ffmpeg"，Phase 45 已验证），但它同时说明"零依赖"是以实现复杂度为代价换来的——ZIP 解析（中央目录、deflate/store、zip64 边界）比 fMP4 字节拼接更硬。建议把 zip 导入排到最后、单独一个 plan，并在 plan 阶段显式二选一。

---

## System Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Renderer（主窗口 file://）                                                    │
│  ┌─────────────────────────────┐   ┌──────────────────────────────────────┐  │
│  │ src/renderer.js             │   │ src/preload.js                       │  │
│  │  SLASH_COMMANDS（本地命令） │   │  realmAPI.ai.listSkills()            │  │
│  │  + 动态 skill 命令源        │   │  realmAPI.ai.promptWithContext(...)  │  │
│  │  renderSlashPickerList()    │   │  realmAPI.ai.installSkill()/...      │  │
│  │  sendSkillInvocation()      │   └──────────────┬───────────────────────┘  │
│  └──────────────┬──────────────┘                  │ IPC                    │
└─────────────────┼──────────────────────────────────┼────────────────────────┘
                  │                                  │
┌─────────────────▼──────────────────────────────────▼────────────────────────┐
│  Renderer（realm://settings guest，无 realmAPI）                             │
│  src/settings.html 新增「技能管理」分组 + src/settings-page.js               │
│      ↓ fetch('/api/skills/*?token=...')                                      │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTP（本地服务器，REALM_TOKEN 鉴权）
┌──────────────────────────────────▼──────────────────────────────────────────┐
│  Main Process                                                                │
│                                                                              │
│  ipc-handlers.js                       main.js（app.whenReady 内）          │
│   ai:prompt-with-context（+ skill）     /api/skills/{list,install,uninstall}  │
│   ai:skills-list / skills-install ...   /api/ai-memory（既有同款先例）        │
│           │                                       │                          │
│           └──────────────┬────────────────────────┘                          │
│                          ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  ai-skills-manager.js  ★新增（主进程，单一数据权威）                    │ │
│  │   refreshSkills(env)        ← loadSourcedSkills（async，唯一加载入口）  │ │
│  │   buildSkillsPrompt()       ← formatSkillsForSystemPrompt（同步读缓存） │ │
│  │   resolveSkill(name)        ← 显式调用解析                              │ │
│  │   installFromZip()/installFromUrl()/uninstall()                         │ │
│  │   createOrUpdate/delete     ← manage_skill 工具后端                     │ │
│  │   内存缓存：skills[] + promptBlock + digest                             │ │
│  └───────┬──────────────────────────────┬─────────────────────────────────┘ │
│          │                              │                                    │
│  ┌───────▼──────────────┐      ┌────────▼───────────────────────────────┐   │
│  │ ai-manager.js（改）  │      │ agent-workspace.js（改）               │   │
│  │  init() 加载 skill   │      │  getSkillsDir()                        │   │
│  │  buildSystemPrompt() │      │  getManagedSkillsDir()                 │   │
│  │   + skills 段        │      │  ensureWorkspaceDir() + 2 个 mkdir     │   │
│  │  _buildRealmTools()  │      │  resolveInside()（零改动，天然放行）   │   │
│  │   + manage_skill     │      │  createSandboxEnv()（零改动）          │   │
│  │  syncAgentSystemPrompt()     └────────────────────────────────────────┘   │
│  └───────┬──────────────────────────────────────────────────────────────────┘
│          │
│  ┌───────▼──────────────────────────────────────────────────────────────────┐
│  │ pi-agent-core 0.84.3 Agent（裸 Agent，非 AgentHarness）                 │
│  │  state.systemPrompt ← 每轮 prompt 前由 createContextSnapshot 读取        │
│  │  state.tools        ← 数组 setter，可运行时替换                          │
│  └──────────────────────────────────────────────────────────────────────────┘
│          │
│  ┌───────▼──────────────────────────────────────────────────────────────────┐
│  │ 文件系统（沙箱根 = userData/agent-workspace/）                           │
│  │  skills/          ← 用户技能（zip / 网络地址导入）                       │
│  │  managed-skills/  ← 内置技能（首次启动播种）+ AI 经 manage_skill 创建     │
│  │  attachments/  ai-memory/  .tmp/  （既有）                               │
│  └──────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | 形态 |
|-----------|----------------|------|
| `ai-skills-manager.js` ★新增 | skill 单一数据权威：加载/缓存/解析/安装/卸载/增删改/校验；产出 system prompt 段；维护 digest 供变更检测 | 主进程 CJS 模块，仿 `ai-memory-manager.js`（同步读）+ `ai-attachments-manager.js`（异步导入管线）双先例 |
| `agent-workspace.js`（改） | 新增两个目录常量 + `ensureWorkspaceDir` 建目录 | 既有模块增量 |
| `ai-manager.js`（改） | skill 注入 systemPrompt；`manage_skill` 工具注册；`/skill:` 显式调用的正文注入；缓存刷新后回写 `agent.state.systemPrompt` | 既有模块增量 |
| `ipc-handlers.js`（改） | 主窗口侧 skill IPC（列表/安装/卸载） | 既有模块增量 |
| `main.js`（改） | `/api/skills/*` HTTP 端点（设置页数据层）+ 启动播种调用 | 既有模块增量 |
| `src/renderer.js`（改） | slash-picker 合并动态 skill 命令源；`sendSkillInvocation` | 既有模块增量 |
| `src/settings.html` + `settings-page.js`（改） | 技能管理 UI（列表/导入/删除/诊断展示） | 既有模块增量 |
| `skills-builtin/**` ★新增 | find-skills（vercel-labs）+ skill-creator（anthropics）完整目录，随包分发，首次启动播种 | 打包静态资源，须 `asarUnpack` |

---

## (a) 两个 skill 目录的位置与沙箱边界

### 目录布局

```
userData/agent-workspace/                    ← 沙箱根（getWorkspaceDir, agent-workspace.js:36-40）
├── skills/                                  ← 用户技能（可被安装/卸载/被 AI 改）
│   └── <skill-name>/                        ← 目录名必须 == 技能 name（SDK 契约）
│       ├── SKILL.md                         ← 必需，YAML frontmatter + 正文
│       └── references/...                   ← 相对引用资源（SKILL.md 内相对路径）
├── managed-skills/                          ← 内置技能 + AI 经 manage_skill 创建
│   ├── find-skills/SKILL.md
│   └── skill-creator/SKILL.md
├── attachments/                             ← 既有（ai-attachments-manager）
├── ai-memory/                               ← 既有（ai-memory-manager）
└── .tmp/                                    ← 既有（bash 截断输出）
```

### 沙箱如何接纳（关键结论：零改动）

| 关心的点 | 结论 | 证据 |
|---------|------|------|
| 路径校验 | **零改动**。`resolveInside(root, p)` 判据是「解析后落在 root 前缀内」，两个新目录天然满足 | `agent-workspace.js:136-166` |
| FileSystem 方法 | **零改动**。`createSandboxEnv` 已包装全部 17 个方法（含 `listDir`/`fileInfo`/`canonicalPath`/`readTextFile`），SDK 的 skill 遍历只用这些 | `agent-workspace.js:179-350`；SDK `dist/harness/skills.js:23,66,82,159,198,281,293` |
| symlink 防护 | **零改动但需注意**。`resolveInside` 对已存在路径做 realpath 复核，防 symlink 逃逸——这意味着导入 zip 时若包含 symlink，脚本层面应主动拒绝（`ai-attachments-manager.js:209-212` 的「symlink 不允许作为附件」先例），否则会被沙箱拒绝但报错语义不友好 | `agent-workspace.js:155-165` |
| 建目录 | **改 2 行**：`ensureWorkspaceDir()` 追加两个 `mkdirSync(..., {recursive:true})` | `agent-workspace.js:96-100` |
| `.tmp` 重定向 | 不受影响 | `agent-workspace.js:301-326` |

即：**沙箱边界不是这次工作的风险点**。风险反而在"沙箱管不了什么"——见下。

### 沙箱的诚实边界：它管不了 managed 保护

`createSandboxEnv` 只知道一个 root，因此：

- AI 的 `write`/`edit`/`bash` 工具**可以**写 `managed-skills/`（它们在 root 内，`resolveInside` 放行）
- 「AI 不可删除/篡改内置技能」**无法**由沙箱表达

结论：**managed 边界是工具层不变式，不是沙箱不变式**。它必须实现在 `manage_skill` 的写路径里（按 `source` 判定），并且要在 `docs/product/ai-agent-workspace.md` 里如实写明——与 `ai-bash-policy` 的"诚实边界"哲学一致（AGENTS.md 明确记录"静态拆段无法覆盖全部 shell 语法，白名单判定是启发式而非安全边界"）。

不要试图给 `managed-skills/` 做只读挂载或额外 root 白名单——那会引入第二套路径判据，与 `resolveInside` 的双基准/realpath 逻辑形成漂移风险（对比 Key Decisions 里 SSRF 防护「收敛在 search-manager，避免两处判据漂移」的教训）。

### 加载语义的硬约束（决定导入实现）

`loadSkillsFromDirInternal`（SDK `dist/harness/skills.js:63-129`）的遍历有两个非直觉行为，直接约束导入实现：

1. **任何目录层只要直接含 `SKILL.md`，就只加载它并立即 `return`（`:88-103`）**。
   → 推论：`skills/` 根目录**绝对不能**直接放 `SKILL.md`；布局必须是 `skills/<name>/SKILL.md`。同理，一个技能目录内不能再有子技能目录。
2. **根目录的散落 `*.md`（带 frontmatter description）也会被当成技能加载**（`:104-127`，`includeRootFiles=true` 仅根层生效）。
   → 推论：导入时必须清理/不带 `README.md` 之类带 `description` frontmatter 的散落文件，否则会产生 name 与父目录不匹配的幽灵技能（只有 diagnostic 警告，**不会加载失败**，见 `:212-214, 237-251`）。

其他加载器事实：

| 事实 | 位置 | 影响 |
|------|------|------|
| 跳过 `.` 开头目录与 `node_modules` | `skills.js:105-106` | `.git`/`.DS_Store` 安全 |
| 遵循 `.gitignore` / `.ignore` / `.fdignore` | `skills.js:130-171` | **不要在 skills 目录里放 `.gitignore`**，否则技能会被静默忽略；zip 导入需剥离 |
| name 必须匹配父目录名 | `skills.js:237-251` | `validateName` 只产 warning 不拒载；但为保证可预测性，导入时应主动校验 |
| name 规则 `^[a-z0-9-]+$`，≤64，不含首尾/连续连字符 | `skills.js:241-250` | 导入/`manage_skill` 共用同一份校验 |
| description 必需，≤1024 | `skills.js:252-261` | 同上 |
| `disable-model-invocation: true` → 不进 prompt 但仍可显式调用 | `skills.js:232`；`system-prompt.js:2`；`types.d.ts:37` | UI 需区分展示 |
| 缺失目录被跳过而非报错 | `skills.js:23-34` | 首次启动前 `skills/` 不存在不会崩；但仍应在 `ensureWorkspaceDir` 建好 |
| `loadSourcedSkills` 原样透传 source 值并挂到每个 skill/diagnostic | `skills.js:50-62` | 直接支撑"双目录 + 优先级" |

### 双目录优先级

用 `loadSourcedSkills(env, [{path: managedDir, source: 'managed'}, {path: skillsDir, source: 'user'}])`，然后按 name 去重：

- **同名时 user 胜出**（用户显式安装即显式意图，与 oh-my-pi「多来源优先级」先例一致）
- 去重必须发生在 `formatSkillsForSystemPrompt` **之前**——SDK 不做 name 去重（`:12-18` 无条件遍历可见技能），重名会产出两条 `<skill>` 条目
- 保持加载顺序稳定（managed → user，各自内部按 `localeCompare` 排序，SDK 已保证 `:104`），否则 prompt 段每次刷新顺序抖动 → 破坏前缀缓存

---

## (b) 接入 `buildSystemPrompt()` 与缓存失效

### 接线点（三处，一处都不能漏）

```js
// ai-manager.js:561-564 现状
function buildSystemPrompt() {
  return REALM_SYSTEM_PROMPT + '\n\n' + buildWorkspacePrompt() + '\n\n'
    + getAiMemoryManagerLazy().buildGlobalSnapshot();
}
```

改为**第 4 段**（顺序有讲究：静态 → 半静态 → 冻结快照 → 技能目录清单，把最容易变的放最后）：

```js
function buildSystemPrompt() {
  return REALM_SYSTEM_PROMPT + '\n\n' + buildWorkspacePrompt() + '\n\n'
    + getAiMemoryManagerLazy().buildGlobalSnapshot() + '\n\n'
    + getAiSkillsManagerLazy().buildSkillsPrompt();   // 同步读缓存，可返回 ''（无技能时不产生空段）
}
```

```js
// ai-manager.js:106-108 同款惰性引用（避开模块加载顺序问题）
function getAiSkillsManagerLazy() { return require('./ai-skills-manager'); }
```

`buildSkillsPrompt()` 必须**同步**且**纯读缓存**：

```js
// ai-skills-manager.js（形态）
let _cache = { skills: [], promptBlock: '', digest: '' };

/** 同步：仅供 buildSystemPrompt 调用，绝不触发 IO */
function buildSkillsPrompt() { return _cache.promptBlock; }

/** 异步：唯一加载入口（init / 变更后刷新） */
async function refreshSkills(env) {
  const inputs = [
    { path: getManagedSkillsDir(), source: 'managed' },
    { path: getSkillsDir(), source: 'user' },
  ];
  const { skills, diagnostics } = await loadSourcedSkills(env, inputs);
  const merged = dedupeByName(skills);           // user 胜出
  const block = formatSkillsForSystemPrompt(merged.map(s => s.skill));
  _cache = { skills: merged, promptBlock: block, digest: digestOf(merged), diagnostics };
  return _cache;
}
```

### 两条 Agent 创建路径都要覆盖（且加载必须在创建之前）

| 路径 | 位置 | 处理 |
|------|------|------|
| 首次初始化 | `ai-manager.js:686-860` | 在 `this.sandboxEnv = await createSandboxEnv()`（`:808`）之后、`buildSystemPrompt()`（`:823`）**之前**插入 `await skillsManager.refreshSkills(this.sandboxEnv)` |
| 对话切换/删除后重建 | `_recreateAgent()` `:2432-2473` | 同样在 `:2455` 之前刷新（缓存通常已热，此处可轻量化：仅当 digest 变化才重算） |

**顺序错误的表现**：Agent 带着空 `<available_skills>` 创建 → 整个会话模型都看不到技能，且不报错。这与 `ai-manager.js:552-557` 注释里警示的"漏一处即部分会话无记忆快照"是同一类事故。

### 不重启 Agent 的刷新（cache invalidation）

**结论：`agent.state.systemPrompt` 可以运行时改写，不需要重建 Agent。**

证据链：
1. `Agent.state` getter 直接返回内部 `_state` 对象（`dist/agent.js:155-157`），不是快照
2. `_state.systemPrompt` 是普通可写属性（`dist/agent.js:30`）
3. 每次 `prompt()` 都经 `createContextSnapshot()` **重新读取** `this._state.systemPrompt`（`dist/agent.js:280-286`）→ 下一轮即生效

```js
// ai-manager.js 新增私有方法
/** 技能变更后刷新 prompt（不重建 Agent：会话消息与工具引用全部保留） */
async syncAgentSystemPrompt() {
  if (!this.agent || !this.sandboxEnv) return;
  const next = await skillsManager.refreshSkills(this.sandboxEnv);
  const prompt = buildSystemPrompt();
  if (this.agent.state.systemPrompt === prompt) return;   // 无变化则不动，保前缀缓存
  this.agent.state.systemPrompt = prompt;
}
```

**触发时机（白名单，三个）**：

1. `manage_skill` 工具执行成功后（AI 自主创建技能）
2. `/api/skills/install` 与 `/api/skills/uninstall` 成功后（设置页）
3. slash-picker 打开 / 技能面板打开时做一次 digest 惰性复查（覆盖"AI 直接经 `write` 工具改了 skills/ 却没刷新"的漏网场景，也覆盖 `bash` 写入）

**明确禁止**：

- **禁止每轮刷新**。`ai-manager.js:552-557` 的冻结语义（"会话内不变，保前缀缓存"）同样适用于 skills 段。每轮变 systemPrompt = 每次请求都 miss provider 前缀缓存，成本与延迟双输，也破坏了 D-04 的既定模型。
- **禁止在刷新时重建 Agent**。重建会丢 `state.messages` 引用链（附件元数据挂载依赖 `lastUser` 对象引用，见 `ai-manager.js:1190-1204`），且与 `isProcessing` 竞态。`agent.state.systemPrompt = ...` 已足够。
- **禁止在流式进行中刷新**。检查 `this.isProcessing` / `this.agent.state.isStreaming`，忙时置脏标记、idle 后再刷（避免"改了正在推理中的轮次上下文"）。

### prompt 体积预算

技能数量无上限，但 `<available_skills>` 每条约 5 行（name/description/location）。参照 `ai-memory-manager.js` 的字符预算先例（`BUDGETS` + 超限 throw/截断 + 设置页显示 `used/budget`），建议给 skills 段设一个字符预算（如 8000 字符），超限时：

- 优先保留 user 来源技能（用户意图）
- 保留优先：`disableModelInvocation !== true` 的
- 截断策略：丢弃低优先级技能并在 prompt 末尾加一行"（因预算省略 N 个技能，可用 find-skills 技能查找）"——这让内置 find-skills 技能有了明确的自洽用途

`ai-manager.js:2588` 的 `getContextUsage()` 已用 `buildSystemPrompt().length / 4` 估算系统 token，skills 段自动被计入，**无需额外改动**（但会让该估算上升，注意 UAT 时的观感）。

---

## (c) `/skill:name` 调用链路：slash-picker → 主进程 → 注入对话

### 现状（必须理解的三个前提）

1. **`SLASH_COMMANDS` 是静态的本地命令表**，每条挂一个 renderer 侧 handler，且命令文本**绝不进入对话历史**：

```js
// src/renderer.js:334-337
const SLASH_COMMANDS = [
  { name: 'clear', description: '开启新对话', takesArg: false, handler: executeSlashClear },
  { name: 'compact', description: '压缩上下文（可附重点说明，如 /compact 重点保留登录调试）', takesArg: true, handler: executeSlashCompact },
];
```

```js
// src/renderer.js:8673-8689 —— 拦截发生在 handleSendAIMessage 顶部
if (text.startsWith('/')) {
  const match = SLASH_COMMANDS.find(c => text === '/' + c.name || text.startsWith('/' + c.name + ' '));
  if (match) { ...; await match.handler(args); return; }   // ← 不入历史
  pushSystemNote(`未知命令 ${text.split(/\s/)[0]}，输入 / 查看可用命令`); return;
}
```

2. **picker 渲染直接吃 `SLASH_COMMANDS`**（`src/renderer.js:9906`）：`const items = SLASH_COMMANDS.filter(c => c.name.startsWith(filter));`

3. **`/skill:` 前缀天然避让命令名冲突**：picker 过滤是按 `name.startsWith(filter)`，若技能名就是 `clear` 会与 `/clear` 撞车。统一用 `skill:` 命名空间后，`/skill:clear` 与 `/clear` 是两个不冲突的条目。

### 设计：技能命令是"第二命令源"，不是本地 handler

**不要**把技能塞进 `SLASH_COMMANDS` 数组。理由：`SLASH_COMMANDS` 的 handler 语义是"命令文本不入历史、在渲染端本地完成"（`/clear`、`/compact`）；技能调用恰恰相反——它**必须**作为一条真实用户消息进入对话并触发 LLM。混进同一数组会造成语义分裂（`handleSendAIMessage` 的拦截分支会吞掉它）。

```js
// src/renderer.js
/** 技能命令源（主进程权威，随安装/卸载/面板打开刷新） */
function skillToCommand(entry) {
  return {
    kind: 'skill',                                  // ← 判别字段
    name: `skill:${entry.name}`,                    // 命名空间避让冲突
    description: entry.description,                 // 来自 SKILL.md frontmatter
    source: entry.source,                           // 'user' | 'managed'
    disableModelInvocation: !!entry.disableModelInvocation,
  };
}
state.skillCommands = [];   // 由 loadSkillCommands() 填充
```

渲染合并（改 `renderSlashPickerList`，`src/renderer.js:9900-9951`）：

```js
const all = [...SLASH_COMMANDS, ...state.skillCommands];
const items = all.filter(c => c.name.startsWith(filter));
// items 里带 kind:'skill' 的行加一个来源徽标（user / 内置）
```

### 调用流转（完整链路）

```
用户输入 "/skill:find-skills 找一个做 pdf 的技能"
  │
  ▼ src/renderer.js  handleAIInputAutoResize (:9866-9874)
  │   value.startsWith('/') → openSlashPicker() → renderSlashPickerList()
  │   filter = "skill:find-skills" 命中第二命令源
  │
  ▼ Enter / 点击 → executeActiveSlashCommand (:9810-9824)
  │   cmd.kind === 'skill' → 不走 cmd.handler，改走 sendSkillInvocation(...)
  │   args = 输入框里命令 token 之后的剩余文本（复用既有 rest 解析逻辑 :9817）
  │
  ▼ sendSkillInvocation(name, args)   ★新增（renderer）
  │   1. 用户气泡：展示 `/skill:find-skills 找一个做 pdf 的技能`
  │   2. 占位 assistant 气泡 + aiStreaming 锁（与 handleSendAIMessage 同款）
  │   3. 清空并快照 referencedTabs / aiAttachments（复用既有模式 :8697-8709）
  │
  ▼ realmAPI.ai.promptWithContext({ message: args, skill: name, referencedTabs, attachmentIds })
  │   （preload.js:991 既有通道，payload 加 skill 字段）
  │
  ▼ ipc-handlers.js  ai:prompt-with-context  (:1699-1720)
  │   assertTrustedSender → 参数校验（skill 为可选字符串，长度/字符集白名单）
  │
  ▼ ai-manager.js  promptWithContext(message, referencedTabs, attachmentIds, supportsVision, skillName)  ★加参
  │   ├─ 内部顺序（关键）：
  │   │   1) 解析附件登记（既有 :1076-1084）
  │   │   2) _ensureConversation(titleSource)  ← titleSource 用 **原始 args 或 "/skill:name"**，
  │   │      绝不用注入后的块（同既有 :1086-1091 的"必须传注入前原始文本"规则）
  │   │   3) resolveSkill(skillName) → 未知则广播 error 事件并 early-return
  │   │   4) skillBlock = formatSkillInvocation(skill, message)     ← SDK 函数
  │   │   5) 组装 enhancedMessage
  │   │   6) agent.prompt(enhancedMessage, images)
  │   │   7) agent.waitForIdle()
  │
  ▼ SDK  formatSkillInvocation(skill, additionalInstructions)
     → `<skill name="find-skills" location="/…/managed-skills/find-skills/SKILL.md">\nReferences are relative to /…/managed-skills/find-skills.\n\n<正文>\n</skill>\n\n<args>`
     （dist/harness/skills.js:8-11）
```

### 消息块顺序（显式约定，勿随手调换）

沿用 `ai-manager.js:1172-1180` 既有的"最重要的放最前 + 空行分隔"哲学：

```js
const enhancedMessage = [skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]
  .filter(Boolean).join('\n\n');
```

| 位置 | 块 | 理由 |
|------|----|------|
| 1 | `skillBlock`（`<skill>` 块） | 技能指令是本轮任务定义，必须先于一切上下文；`formatSkillInvocation` 已把 args 拼在块后（`:10`） |
| 2 | `visionNotice` | 既有语义不变（视觉转写失败通告） |
| 3 | `markerBlock`（附件 marker） | 既有注释「模型先看到有附件及路径」：`:1172-1174` |
| 4 | `visionBlock` | 既有语义不变 |
| 5 | `contextBlock`（`@` 引用标签页） | 既有语义不变：`:500` 要求模型直接基于已提供内容回答 |

### 两条调用路径的关系（都保留，语义不同）

| 路径 | 触发 | 注入方式 | 是否经 prompt |
|------|------|---------|--------------|
| **显式** `/skill:name` | 用户主动 | `formatSkillInvocation` 内联全文（确定性、不依赖模型判断） | 是（一条用户消息） |
| **隐式** 模型自主 | LLM 按 description 匹配 | system prompt 的 `<available_skills>` 只给 name/description/location，模型自行调 `read` 读 SKILL.md | 是（工具轮） |

**隐式路径零额外接线**：`formatSkillsForSystemPrompt` 已指示"Read the full skill file when the task matches"（`system-prompt.js:7`），`read` 工具已注册且技能在沙箱内可读。**这正是 (a) 中"技能必须在工作区内"的另一个后果**。

`disableModelInvocation: true` 的技能对两条路径的不同表现：不进 `<available_skills>`（`system-prompt.js:2` 过滤），但显式 `/skill:name` 仍可用（`types.d.ts:37` 明确语义）。UI 上应打标（如"仅手动调用"），并让 picker 可检索到。

---

## Data Flow

### 流 1：显式调用（用户 `/skill:name`）

```
用户键盘输入
  ↓ handleAIInputAutoResize → openSlashPicker → renderSlashPickerList（合并静态命令 + 技能命令）
  ↓ Enter → executeActiveSlashCommand → sendSkillInvocation(name, args)
  ↓ IPC ai:prompt-with-context { message: args, skill: name, ... }
  ↓ ipc-handlers assertTrustedSender + 参数校验
  ↓ ai-manager.promptWithContext
      ├── 附件登记表反查（ai-attachments-manager.getAttachment）
      ├── _ensureConversation(原始 args)          ← 标题派生
      ├── skillsManager.resolveSkill(name)         ← 内存缓存，零 IO
      ├── formatSkillInvocation(skill, args)       ← SDK
      └── agent.prompt(enhancedMessage[, images])
  ↓ Agent loop → LLM → 可能再调 read/其他工具（此时 read 能读到技能目录）
  ↓ 事件广播 ai:events-batch（debounce 16ms）→ 渲染气泡
  ↓ agent idle → saveCurrentConversation
```

### 流 2：隐式匹配（模型自主）

```
Agent 创建/刷新时：systemPrompt 内含 <available_skills>（name/description/location）
  ↓ 用户提问命中某技能 description 的语义
  ↓ LLM 输出工具调用 read({ path: "<location>" })   ← 沙箱放行（路径在工作区内）
  ↓ 技能正文进入对话上下文
  ↓ LLM 按技能指令继续（可再调 write/bash/其他 Realm 工具）
```

### 流 3：变更 → 缓存失效 → prompt 同步（唯一的三处入口）

```
[manage_skill 工具成功] 或 [/api/skills/install 成功] 或 [/api/skills/uninstall 成功]
  ↓ skillsManager.refreshSkills(sandboxEnv)       ← loadSourcedSkills（async）
  ↓ 重新去重 + formatSkillsForSystemPrompt + 算 digest
  ↓ aiManager.syncAgentSystemPrompt()
      ├── 忙（isProcessing/isStreaming）→ 置脏标记，idle 后重试
      ├── digest 未变 → 不动 agent.state.systemPrompt（保前缀缓存）
      └── digest 变化 → agent.state.systemPrompt = buildSystemPrompt()
  ↓ 广播 skills:changed → 主窗口刷新 skillCommands；设置页刷新列表（跨窗口广播，windowManager.broadcast 先例）
```

### 流 4：设置页导入

```
设置页「技能管理」→ 选择 zip 文件（原生 <input type="file">，读内容 base64）
  或 粘贴网络地址
  ↓ fetch POST /api/skills/install?token=REALM_TOKEN
  ↓ main.js handleSkillsApi（与 handleAiMemoryApi 同 scope，main.js:2647 先例）
      ├── 鉴权：searchParams.get('token') !== REALM_TOKEN → 403
      ├── 分流：base64(zip) / url(网络地址)
      ├── 落盘 → skills/<name>/SKILL.md（写入前 name/description/大小校验）
      ├── refreshSkills → 收集 diagnostics
      └── 返回 { success, name, diagnostics }
  ↓ 设置页展示诊断（无效 SKILL.md 不静默失败）
```

### 状态管理

| 状态 | 持有者 | 生命周期 | 说明 |
|------|--------|---------|------|
| `_cache.skills` / `promptBlock` / `digest` | `ai-skills-manager`（模块级） | 进程生命周期 | 单一权威；`buildSystemPrompt()` 同步读 |
| `state.skillCommands` | `src/renderer.js` | 面板生命周期 | 派生自主进程，**不得成为第二权威** |
| `state.aiSkills`（列表/诊断） | `src/settings-page.js` | 设置页生命周期 | 经 HTTP 派生 |
| 磁盘技能目录 | `agent-workspace/skills` `managed-skills` | 永久 | 唯一持久真相 |

---

## (d) `manage_skill` 工具的注册与沙箱作用域

### 注册点

放在 `_buildRealmTools()` 尾部、`...this._buildFilesystemTools()` 之前（`ai-manager.js:5416-5420`），紧邻 `memory` / `memory_read` 两个"委托 manager"的工具——形态完全同构（既有注释块风格见 `:5292-5374`）。

```js
// ==================== manage_skill 工具 ====================
{
  name: 'manage_skill',
  label: '管理技能',
  description: '创建/更新/删除 AI 技能（SKILL.md 格式）。'
    + 'action: create(创建新技能)/update(覆盖已有技能内容)/delete(删除技能)。'
    + 'name 必须小写字母数字与连字符（^[a-z0-9-]+$，≤64 字符，不含首尾或连续连字符），'
    + 'description 是模型判断何时使用该技能的简短说明（≤1024 字符），content 是技能正文（Markdown）。'
    + '内置技能（source:managed 且由系统播种）不可删除；用户技能（source:user）可自由增删改。'
    + '不要传路径——只需 name，目录由系统决定。',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'delete'] },
      name: { type: 'string', pattern: '^[a-z0-9-]+$' },
      description: { type: 'string' },   // create/update 必填
      content: { type: 'string' },       // create/update 必填
    },
    required: ['action', 'name'],
  },
  executionMode: 'sequential',           // 同 memory 工具（防同批并发写同一目录）
  execute: async (toolCallId, params) => { /* 委托 skillsManager */ },
}
```

### 沙箱作用域：**唯一正确做法是让模型不碰路径**

这是本节最重要的一条。两个 skill 目录都在沙箱内且都可写，因此**沙箱本身不提供任何保护**。保护必须来自工具接口设计：

| 设计 | 说明 |
|------|------|
| **工具不吃 path 参数** | 只吃 `name`（已过 `^[a-z0-9-]+$` 模式约束）。目标路径由 `ai-skills-manager` 用 `path.join(getSkillsDir(), name, 'SKILL.md')` 计算。**任何形式的 `path`/`dir`/`target` 参数都是沙箱逃逸面**——即便有 `resolveInside` 兜底，也不该给它存在的机会 |
| **name 双校验** | JSON Schema `pattern` 是给 LLM 看的提示（SDK 会校验），但**服务器侧必须再校验一次**：`^[a-z0-9-]+$` + ≤64 + 不含首尾/连续连字符（对齐 `skills.js:237-251` 的 `validateName`）。LLM 参数不可信 |
| **目录名 == name** | 落盘路径 `skills/<name>/SKILL.md`，frontmatter 的 `name` 写同名，满足 SDK 的 `validateName` 契约（`skills.js:239-240` 否则产 warning） |
| **原子写** | 先写 `skills/<name>/.SKILL.md.tmp`（或工作区 `.tmp/`），再 `rename` 覆盖。`createSandboxEnv` 已包装 `renameFile` 并做**双路径校验**（`agent-workspace.js:251-258`）——这正是用 `env.renameFile` 而非 `fs.renameSync` 的理由：一切 IO 走 env 才在沙箱审计范围内 |
| **大小限制** | `content` 与 `description` 上限（description ≤1024 对齐 SDK；content 另设如 64KB），超限 throw → SDK 转 `isError: true` toolResult，LLM 可见并自行修正（同 memory 工具"业务校验失败由 manager throw"先例 `:5299-5301`） |
| **managed 边界** | `source === 'managed'` 且是系统播种内置技能 → `delete` 拒绝；`update` 分两种：播种内置技能（find-skills/skill-creator）拒绝覆盖，AI 自建 managed 技能允许。**判定依据是播种登记表**，不是目录位置（位置无法区分两者） |
| **修改后刷新** | 成功后调 `refreshSkills` + `aiManager.syncAgentSystemPrompt()`，否则技能对当前会话不可见（见 (b)） |

### 为什么不需要确认卡片

`ai-attachments-manager.js:12-14` 与 `ai-bash-policy` 的既有哲学同样适用：`manage_skill` 的破坏面已被限定在 AI 专用数据区（工作区内的技能目录），且 `managed` 边界已在工具层拒绝危险操作。与 write/edit 工具"沙箱内自动执行不加确认"（`ai-manager.js:5452-5453` 注释）保持一致的判据。

### 关于「AI 直接 write 到 skills/ 目录」

AI 可以用 `write` 工具直接写 `skills/foo/SKILL.md`（路径在沙箱内，会被放行），但**不会触发 `refreshSkills`**，因此对 prompt 不可见（直到某个刷新时机命中）。这是可接受的：`manage_skill` 是文档化的唯一路径，`write` 路径在 digest 惰性复查（见 (b) 触发时机 3）下最迟在下次打开技能面板时被吸收。**不要**为此在 `write` 工具上加 hook——那会让沙箱内所有写操作都背上 skill 探测成本。

---

## (e) 设置页（realm:// HTTP）管理主进程技能存储

### 分层规则（既有约定，必须遵守）

| 界面 | 加载方式 | 数据通道 |
|------|---------|---------|
| 主窗口（`index.html`，`file://`） | 无 CSP | **只能 `realmAPI.*` IPC** |
| settings 页（`realm://settings` → `http://localhost:PORT`） | CSP `style-src 'self'` | **只能 `/api/*` HTTP + token** |

这条是 Phase 17 UAT 的血泪根因（PROJECT.md Key Decisions：「webview 内部页面新功能一律走 /api/* HTTP 端点，禁用 realmAPI —— 导入前端误用 IPC 导致点击无反应」），也是 AGENTS.md 明写的「主窗口不能 fetch 本地 HTTP（CORS）」的另一半。**技能管理因此天然需要两套前端入口，但只有一个后端权威**：

```
主窗口 renderer ──realmAPI.ai.*──┐
                                ├──→ ai-skills-manager（单一权威）→ 磁盘
settings-page ──/api/skills/*───┘
```

### `/api/skills/*` 路由设计

注册位置：`main.js` 的 `app.whenReady().then(async () => {`（`:836`）作用域内，紧邻 `/api/ai-memory` 的既有注册（`:2754-2758`）。`handleAiMemoryApi`（`:2647-2700`）是逐行可抄的模板：token 鉴权 → 方法分发 → 参数校验 → manager 调用 → `sendJson` 统一错误形状。

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/skills/list` | GET | 列出技能（name/description/source/filePath/diagnostics/字符占用） |
| `/api/skills/install` | POST | 安装：`{ zipBase64, filename }` 或 `{ url }` |
| `/api/skills/uninstall` | POST | 卸载：`{ name, source }`（source 必须是 user，见下） |

**鉴权必须逐端点做**：`reqUrl.searchParams.get('token') !== REALM_TOKEN → 403`（`main.js:2649` 同款），理由同 `:2648` 注释（防 CSRF 与 localhost 端口扫描）。

**`uninstall` 必须校验 source**：只允许 `source === 'user'`。不校验 = 手改 URL 即可删内置技能（与 `handleAiMemoryApi` 的容器存在性校验 `:2681-2688` 同类防护）。

### 消息体积：一个必须先知会 plan 的坑

`readJsonBody`（`main.js:885-897`）**没有任何大小上限**——它无条件拼接 `body += chunk` 再 `JSON.parse`。zip 以 base64 走 JSON body 会放大 1.33 倍，一个 10MB 的 zip 就是 13MB 字符串进内存，且无拒绝路径。

**必须在实现 `/api/skills/install` 时同步加体积限制**（在 `readJsonBody` 内加 `Content-Length` 检查并 `req.destroy()`，或为新 handler 写一个带 cap 的变体）。属安全项而非优化项。

### 导入能力矩阵（本里程碑唯一的新能力空白）

| 输入形态 | 分流 | 落点 |
|---------|------|------|
| zip 包（文件选择） | base64 → 解包 → 校验 → 写入 | `skills/<name>/` |
| GitHub 仓库根（`github.com/owner/repo`） | 归档下载（codeload zipball）→ 同 zip 分支 | `skills/<name>/` |
| GitHub 目录（`github.com/owner/repo/tree/<ref>/<path>`） | 目录列举 → 逐文件拉取 SKILL.md + 相对引用资源 | `skills/<name>/` |
| SKILL.md 直链 | 单文件拉取 → 从内容/frontmatter 推 name | `skills/<name>/SKILL.md` |

**复用资产（已验证存在）**：

- `search-manager.isPrivateHost(hostname)`（定义于 `search-manager.js:195`，导出于 `:1668`）→ SSRF 内网地址判据，逐跳重定向校验必须复用而非重写（Key Decisions：「SSRF 防护收敛在 search-manager…避免两处判据漂移」）
- ~~`search-manager.fetchUrl`~~ → **不适合直接复用**：它把 `text/html` 经 `htmlToMarkdown` 转换（`search-manager.js:1629-1631`）、返回 `{ markdown, finalUrl, format, truncated }`，对 zip 二进制与裸 SKILL.md 都是错的。需要新写一个二进制/文本 fetcher，但**必须沿用同一套逐跳 `isPrivateHost` + 非 HTTP 协议拒绝逻辑**（`:1594-1618`）
- `ai-memory-manager.scanInjectionPatterns(content)`（`ai-memory-manager.js:76-89`，已导出 `:409`）→ **导入时对 SKILL.md 正文与 description 做注入扫描**
- `assets-manager` 的文件读写先例：`ai-attachments-manager.js:170-172` 的 `cpSync({recursive, dereference:false, verbatimSymlinks:true})` + `:197-212` 的 symlink 拒绝
- 导入进度上报：webview 无法收 IPC 事件 → HTTP 轮询 + stage（Key Decisions: Phase 17），若 zip 导入耗时明显需照抄

### 为什么注入扫描是必需的（不只是防御性）

技能内容是**模型可见的高优先级指令**（`<skill>` 块直接进用户消息；`<available_skills>` 的 description 进 system prompt）。导入第三方 zip = 引入第三方 prompt。这与 Phase 43 记忆写入威胁扫描的威胁模型完全同构（`ai-memory-manager.js:389-400` 的"不可信来源拒绝"段落），因此**导入管线必须扫描并在发现注入模式时拒绝或至少明确告警**，且诊断要回传到设置页 UI。

注意 `<available_skills>` 的 description 由 `formatSkillsForSystemPrompt` 做 XML 转义（`system-prompt.js:22-29`），所以**不存在标签逃逸**；威胁是语义注入（描述文本本身在指挥模型）而非标记破坏。这个区别要在 plan 阶段写清楚，避免实现者把力气花在转义上。

### 设置页 UI 落点

`src/settings.html` 的 AI 助手分区（`:265-532`）内，在「AI Bash 命令白名单」`div`（`:506-520`）之后、「视觉模型」（`:521-531`）之前插入新的 `settings-group`。CSP 约束：**初始隐藏必须走 CSS 类，禁止 markup 内联 `display`**（`settings.html:484` 与 `:506` 的既有注释就是这条规则）。

`src/settings-page.js` 侧照抄两个先例：

- `aiMemoryApi(route, params, options)`（`:162-186`）→ 新建 `skillsApi(...)`，统一 fetch + 错误详情抛出
- tag 式即改即存的 `renderAiBashWhitelistTags`（`:2907-2948`）与 `addAiBashWhitelistEntry`/移除（`:2841-2905`）→ 技能列表行的渲染/删除交互可复用其 `whitelist-tag` 样式段与错误提示模式
- 初始化在 `:4808` 附近的集中注册区挂上

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ai-skills-manager` ↔ `agent-workspace` | 直接 require（`getSkillsDir`/`getManagedSkillsDir`/`createSandboxEnv`） | 与 `ai-attachments-manager.js:24-28` 同款双向依赖；纯 Node 测试靠 `setWorkspaceDir` 注入临时目录 |
| `ai-skills-manager` ↔ pi-agent-core | `await import('@earendil-works/pi-agent-core')` 取 4 个 skill 导出 | ESM-only，**必须动态 import**（CJS `require` 不可加载，见 `ai-manager.js:706-708` 注释）；从包根导出（`index.d.ts:13-14`） |
| `ai-manager` ↔ `ai-skills-manager` | `getAiSkillsManagerLazy()` 惰性 require | 避开模块加载顺序（`ai-manager.js:106-108` 同款）；`buildSkillsPrompt()` **必须同步** |
| `ai-manager` ↔ SDK Agent | `agent.state.systemPrompt = ...` 运行时改写 | `state` 直接返回 `_state`（`agent.js:155-157`），每轮 `createContextSnapshot()` 重读（`:280-286`） |
| `ai-manager` ↔ `ipc-handlers` | 既有单向注入（`setAIManager`）+ 新增 skill 方法 | 沿用 Key Decisions「setAIManager setter 延迟注入」 |
| `ipc-handlers` ↔ `ai-skills-manager` | 直接调用（`ai:skills-*` 通道） | 每 handler `assertTrustedSender(event)` |
| `main.js` ↔ `ai-skills-manager` | 直接调用（`/api/skills/*`）+ 启动播种 | HTTP handler 在 `app.whenReady` scope 内；播种在 `ensureWorkspaceDir` 之后 |
| `settings-page` ↔ `main.js` | HTTP `/api/skills/*?token=` | **禁止 realmAPI**（Phase 17 根因） |
| `renderer` ↔ `preload` ↔ `ipc-handlers` | `realmAPI.ai.*` | 主窗口唯一通道 |
| 跨窗口刷新 | `windowManager.broadcast('skills:changed')` + renderer 监听 | 先例：`bookmarks-bar:refresh`（AGENTS.md 明写「主进程 IPC 已统一广播，不要直接 reload」） |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub（仓库/目录/SKILL.md 直链） | 经主进程 `net.fetch`（非 undici，同 `favicon-fetcher.js` 先例） | 逐跳 `isPrivateHost` 校验；非 HTTP 协议拒绝；重定向上限（`search-manager.js:1594` 同款 `MAX_REDIRECTS`） |
| 任意 zip 直链 | 同上，需二进制响应处理 | `fetchUrl` 不适用（会把内容当 HTML 转 Markdown） |
| find-skills（vercel-labs）/ skill-creator（anthropics） | 不打网络：完整目录随包分发，首次启动 `cpSync` 播种 | **必须 `asarUnpack`**：见下 |

### 打包与资源路径（发布前必查项）

PROJECT.md 的「开发/正式环境差异 → 发布前必查」规则直接命中这里：内置技能目录要从包内复制到 userData。`fs.cpSync` 递归读 `app.asar` 内目录不可靠（对比 `favorites-manager.js` 的 nodejieba 词典先例：JS `fs` 能读 asar，但递归/原生路径语义不同）。

处理方式（与既有 nodejieba 事故的修法一致）：

1. `package.json` build 配置加 `asarUnpack`：`skills-builtin/**`
2. 运行时路径用 `process.resourcesPath/app.asar.unpacked/skills-builtin/...`（`app.isPackaged` 时），开发态回落 `__dirname/skills-builtin`
3. `make install` 后**实际启动一次**验证播种成功（不能只跑 `npm run dev`）

**播种幂等性**：参照 `agent-workspace.js:108-119` 的 `migrateAiMemory`（「旧存在 && 新不存在才迁」）与 cookie 迁移先例。技能播种需按**单个技能目录**粒度判定（`managed-skills/find-skills` 是否存在），而非整目录判定——否则新增内置技能时永不播种。同时需要一个版本戳（如 `managed-skills/.seed.json` 记录已播种技能名+版本），供后续升级内置技能时做"未修改才覆盖"的判定。

---

## Recommended Project Structure

```
<repo root>
├── ai-skills-manager.js            ★新增  主进程技能数据层（唯一权威）
├── agent-workspace.js                     改：+getSkillsDir/getManagedSkillsDir/ensureWorkspaceDir
├── ai-manager.js                          改：systemPrompt 注入 / manage_skill / /skill: 注入 / prompt 同步
├── ipc-handlers.js                        改：ai:skills-* 通道
├── main.js                                改：/api/skills/* + 启动播种
├── skills-builtin/                 ★新增  随包分发的内置技能（须 asarUnpack）
│   ├── find-skills/SKILL.md  (+ 相对引用资源)
│   └── skill-creator/SKILL.md (+ 相对引用资源)
├── src/
│   ├── renderer.js                        改：skillCommands 源 + sendSkillInvocation + picker 合并
│   ├── preload.js                         改：realmAPI.ai.listSkills/installSkill/uninstallSkill
│   ├── settings.html                      改：AI 分区新增「技能管理」分组（CSS 类控显隐）
│   └── settings-page.js                   改：skillsApi() + 列表/导入/删除 + 诊断展示
├── tests/
│   └── test-ai-skills.js           ★新增  node:test（仿 test-ai-bash-policy / test-agent-workspace）
└── docs/product/
    └── ai-skills.md                ★新增  产品说明（与既有文档维护约定同级）
```

### Structure Rationale

- **`ai-skills-manager.js` 放在仓库根、与 `ai-manager.js` 平级**：主进程模块的既有布局就是根目录平铺（`ai-memory-manager.js` / `ai-attachments-manager.js` / `ai-bash-policy.js` / `search-manager.js`）。不引入 `src/main/` 之类的重构。
- **`skills-builtin/` 独立于 `src/`**：它是"随包分发的数据"而非"应用代码"，混进 `src/` 会让 `asarUnpack` 规则变宽（整个 `src/` 都可能被解包）。同时与运行时目录 `agent-workspace/skills` 语义分离，避免"源码目录 vs 用户数据目录"混淆。
- **测试放 `tests/`（根目录复数）而非 `test/`（Phase 43 的 node:test 目录）**：项目里 `tests/` 是既有主约定（17 个 `test-*.js`），单文件脚本式 `node tests/test-xxx.js`；`test/memory/` 是 Phase 43 的例外（`npm run test:memory` 走 `node --test`）。技能模块是纯函数 + 文件 IO，用 `tests/test-ai-skills.js` 单文件 + `setWorkspaceDir` 临时目录即可，与 `test-agent-workspace.js`（21 例）完全同构——**照抄它的沙箱测试脚手架**。

---

## New vs Modified（显式清单）

### 新增文件

| 文件 | 内容 | 依赖 |
|------|------|------|
| `ai-skills-manager.js` | 加载/缓存/digest、`buildSkillsPrompt`、`resolveSkill`、校验（name/description/大小）、原子写、安装（zip/url）、卸载、播种、诊断收集 | `agent-workspace`、SDK skills 导出、`ai-memory-manager.scanInjectionPatterns`、`search-manager.isPrivateHost` |
| `skills-builtin/find-skills/**` | vercel-labs find-skills 完整目录 | 无 |
| `skills-builtin/skill-creator/**` | anthropics skill-creator 完整目录 | 无 |
| `tests/test-ai-skills.js` | 校验/去重/优先级/缓存刷新/沙箱拒绝/播种幂等/zip 解包边界 | `node:test` + `setWorkspaceDir` |
| `docs/product/ai-skills.md` | 产品说明（导入语义、优先级、managed 边界、`/skill:` 交互） | — |

### 修改文件

| 文件 | 改动点（附行号锚点） | 风险 |
|------|---------------------|------|
| `agent-workspace.js` | `getSkillsDir()`/`getManagedSkillsDir()`（仿 `:89-91`）；`ensureWorkspaceDir()` 加 2 行（`:96-100`）；**`createSandboxEnv`/`resolveInside` 零改动** | 低（纯增量） |
| `ai-manager.js` | `getAiSkillsManagerLazy()`（仿 `:106-108`）；`buildSystemPrompt()` 第 4 段（`:561-564`）；`buildWorkspacePrompt()` 加 2 条 bullet（`:536-549`，说明 skills/managed-skills 用途与勿手改）；`init()` 在 `:808` 后 `:811` 前加载技能；`_recreateAgent()` 在 `:2455` 前刷新；`promptWithContext` 加 `skillName` 参数 + skillBlock 组装（`:1038`、`:1172-1180`）；`_buildRealmTools()` 尾部加 `manage_skill`（`:5416`）；新增 `syncAgentSystemPrompt()` | **中**（`buildSystemPrompt` 是双 Agent 创建点共享路径，"漏一处即部分会话无技能"） |
| `ipc-handlers.js` | `ai:skills-list` / `ai:skills-install` / `ai:skills-uninstall`（仿 `:1680-1749`），每 handler `assertTrustedSender`；`ai:prompt-with-context` 增加 `skill` 字段校验（`:1699-1720`） | 低-中（参数校验） |
| `main.js` | `/api/skills/*` 路由注册（`:2754` 旁）+ `handleSkillsApi`（仿 `:2647-2700`）；`readJsonBody` 加体积上限（`:885-897`，**安全项**）；启动播种调用 | 中（`readJsonBody` 变更影响所有既有 API，需回归） |
| `src/preload.js` | `realmAPI.ai.listSkills/installSkill/uninstallSkill`（`ai` 段 `:975-1050`） | 低 |
| `src/renderer.js` | `state.skillCommands`；`skillToCommand`、`loadSkillCommands`、`sendSkillInvocation`；`renderSlashPickerList` 合并双源（`:9900-9951`）；`executeActiveSlashCommand` 分流（`:9810-9824`）；`handleSendAIMessage` 的 `/` 拦截不吞技能命令（`:8673-8689`）；`skills:changed` 监听 | 中（picker 是既有交互，双源合并易回归） |
| `src/settings.html` | AI 分区新增「技能管理」`settings-group`（`:506-520` 之后） | 低 |
| `src/settings-page.js` | `skillsApi()`（仿 `:162-186`）；列表/导入/删除渲染 + 诊断展示；初始化挂载（`:4808` 附近） | 低-中 |
| `package.json` | build 配置加 `asarUnpack: ['skills-builtin/**']`；（若采用依赖方案）加 zip 依赖 | 低（但漏了会静默在正式版播种失败） |
| `AGENTS.md` | 新增「AI 技能」维护约定小节（对照「导航入口清单」「announce 产品文档」同款写法）+ 关键文件表加 `ai-skills-manager.js` | 低（易漏） |
| `docs/product/ai-agent-workspace.md` | 目录结构补 `skills/` `managed-skills/`；说明 managed 边界是工具层而非沙箱层 | 低（易漏） |

---

## Suggested Build Order

按依赖关系排序，每阶段都有可独立验证的产出：

### 阶段 1 — 目录 + 沙箱 + 播种（地基，无 AI 交互）

`agent-workspace.js` 两个目录函数与 `ensureWorkspaceDir`；`skills-builtin/**` 资产 + `asarUnpack` + 首次启动播种（幂等 + 版本戳）。
**依赖**：无。
**验证**：`npm run dev` 后 `userData/agent-workspace/` 出现两个目录与内置技能；`make install` 后同样成立（打包路径验证）；`tests/test-ai-skills.js` 覆盖播种幂等。

### 阶段 2 — 技能数据层 + prompt 注入（核心价值：隐式匹配）

`ai-skills-manager` 的 `refreshSkills`/`buildSkillsPrompt`/`resolveSkill`/校验/缓存；`ai-manager` 四处接线（`buildSystemPrompt` 第 4 段、`init` 加载顺序、`_recreateAgent` 刷新、`syncAgentSystemPrompt`）。
**依赖**：阶段 1。
**验证**：直接问 AI「你有哪些技能」，回答应列出内置两技能（name + description）；改动 `SKILL.md` 后经刷新生效；`getContextUsage()` 反映系统 token 上升。

### 阶段 3 — `/skill:name` 显式调用（与阶段 4 可并行）

renderer 双命令源合并 + `sendSkillInvocation`；`promptWithContext` 接 `skillName` + `skillBlock` 组装；未知技能的错误路径。
**依赖**：阶段 2（需可用技能做靶子）。
**验证**：`/` 面板出现 `/skill:find-skills`；执行后气泡与注入内容正确；标题派生用原始 args；`/clear`、`/compact` 行为不回归；重名技能不产生歧义条目。

### 阶段 4 — `manage_skill` 工具（与阶段 3 可并行）

工具注册 + 后端 create/update/delete + name/description/大小校验 + 原子写 + managed 边界 + 刷新联动。
**依赖**：阶段 2。
**验证**：AI 自主创建技能后立即可见并被 `<available_skills>` 收录；删除播种技能被拒；非法 name 被拒且 LLM 能据错误自纠；并发/中断下目录不半成品（原子写生效）。

### 阶段 5 — 设置页管理 UI（列表/卸载优先，导入随后）

`/api/skills/list` + `/api/skills/uninstall` + `readJsonBody` 体积上限 + 设置页技能分组。
**依赖**：阶段 2（数据层），校验语义与阶段 4 共享（排在 4 之后避免两份校验实现漂移）。
**验证**：设置页列出技能与来源；卸载 user 技能后 prompt 立即更新；手改 URL 卸载 managed 被拒；token 缺失 403。

### 阶段 6 — 导入（zip 与网络地址拆成两个 plan）

先 zip（文件选择 + 解包 + zip-slip/zip-bomb 防护 + 注入扫描 + 诊断），后网络地址（URL 分流：仓库/目录/SKILL.md）。
**依赖**：阶段 5（需要 `/api/skills/install` 端点与 UI 承载诊断）。
**验证**：导入合法 zip 端到端可用；zip-slip 路径被拒；大体积被体积上限拦截；注入模式被拒并回传原因；GitHub 三种 URL 形态分流正确；内网地址被 SSRF 防护拒。
**plan 期必须决策**：zip 解包走「新依赖（如纯 JS 的 fflate，无原生模块→无 asarUnpack/重编负担）」还是「手写中央目录解析 + `zlib.inflateRawSync`」。

### 阶段 7 — 文档 + 全量回归

`docs/product/ai-skills.md`、`docs/product/ai-agent-workspace.md` 更新、`AGENTS.md` 维护约定、`node tests/` 全量。
**依赖**：全部。

### 排序理由（四条硬约束驱动）

1. **1 → 2 是不可逆依赖**：SDK 的 `<location>` 指向 + 模型 `read` 需求决定了技能必须在沙箱内，阶段 1 先把目录与打包路径钉死，后续所有验证才有意义。
2. **3/4 是阶段 2 的并行分支**：显式调用与 AI 自建技能互不依赖，可以独立成 phase 并行；但两者都依赖"缓存刷新"这一阶段 2 产出的基础设施。
3. **5 排在 4 之后是为了防校验逻辑漂移**：`manage_skill` 与 zip 导入要走**同一份** name/description/大小/注入校验。若先做 5，极易写出第二份校验（对比 Key Decisions：「SSRF 防护收敛在 search-manager…避免两处判据漂移」的教训）。
4. **6 排最后**：它是唯一需要新解析能力/新依赖、唯一有二进制处理、唯一吃不可信归档包的环节，安全面最大而耦合最小——隔离在最后，风险不外溢。

---

## Anti-Patterns

### Anti-Pattern 1: 给 `manage_skill` 传路径参数

**What people do:** 工具签名设计成 `{ action, path, content }`，"反正沙箱会校验"。
**Why it's wrong:** 两个 skill 目录都在沙箱 root 内，`resolveInside` 会放行工作区内的**任意**路径。带 `path` 参数 = 模型可写/覆盖工作区内任何文件（含 `ai-memory/MEMORY.md`、`attachments/` 快照）。沙箱在这里提供不了保护，接口设计才是边界。
**Do this instead:** 工具只吃 `name`（`^[a-z0-9-]+$`），路径由 manager 拼。校验在服务端再做一次（JSON Schema `pattern` 只是给 LLM 看的提示，LLM 参数不可信）。

### Anti-Pattern 2: 每次 prompt 前重新加载技能

**What people do:** 把 `loadSkills` 塞进 `transformContext` 或每轮开头，图个"永远最新"。
**Why it's wrong:** ① `buildSystemPrompt()` 是同步契约（`ai-memory-manager.js:359-361` 有事故记录），每轮异步加载要么把系统提示改异步（破坏 G-42-4 结论），要么引入竞态；② systemPrompt 每轮变 → provider 前缀缓存全 miss，成本与首字延迟双输；③ 破坏 D-04 冻结语义。
**Do this instead:** 缓存 + digest，只在三个明确时机刷新（`manage_skill`、`/api/skills/*` 变更、面板打开的惰性复查），刷新后一次性回写 `agent.state.systemPrompt`。

### Anti-Pattern 3: 技能目录放在 `agent-workspace/` 之外

**What people do:** 觉得"技能是配置，应该跟 electron-store 配置放一起"，于是放 `userData/skills/`。
**Why it's wrong:** `formatSkillsForSystemPrompt` 会把技能文件的**绝对路径**写进 system prompt 并指示模型去读（`system-prompt.js:7-8,16`）。模型调 `read` 时路径在工作区外 → 硬沙箱拒绝（`agent-workspace.js:192-196`）。结果是**隐式匹配能力静默失效**：不报错、不崩溃，只是模型永远读不到技能正文，toolResult 里是一句 permission_denied。极难定位。
**Do this instead:** 必须在 `agent-workspace/` 内（这也是 PROJECT.md 把"新增 skills/ 与 managed-skills/ 并纳入硬沙箱"写进目标的原因）。

### Anti-Pattern 4: 把技能命令混进 `SLASH_COMMANDS`

**What people do:** 为图省事把技能 push 进 `SLASH_COMMANDS` 数组，复用一套渲染。
**Why it's wrong:** `SLASH_COMMANDS` 的既有语义是"命令文本绝不进对话历史 + renderer 本地 handler 完成"（`src/renderer.js:8670-8683`）。技能调用必须进历史并触发 LLM。混入后 `handleSendAIMessage` 的拦截分支会吞掉技能调用（走 `match.handler` 或落到"未知命令"提示），表现为"点了没反应"。
**Do this instead:** 第二命令源 `state.skillCommands`，用 `kind: 'skill'` 判别字段分流；picker 渲染层合并，执行层分流。

### Anti-Pattern 5: 在 renderer 侧重建技能优先级/默认表

**What people do:** renderer 里 order 一下 managed/user，或在 renderer 里决定同名的谁胜出，方便 UI 展示。
**Why it's wrong:** 与 `AGENTS.md` 明写的 `shortcut-manager` 教训同型（"不要在 renderer 再写一份默认表"）。两份优先级逻辑必然漂移，且 renderer 无法知道磁盘真实状态。
**Do this instead:** 主进程返回已解析、已去重、已定序的列表，renderer 只负责渲染 + 打来源徽标。

### Anti-Pattern 6: 让 `loadSkills` 的诊断静默丢失

**What people do:** 只取 `result.skills`，忽略 `result.diagnostics`。
**Why it's wrong:** SDK 的失效模式是**静默降级**——非法 name、超长 description、frontmatter 解析失败（YAML 异常）都只产 `warning` 级 `SkillDiagnostic`（`skills.js:204-224`；`system-prompt.js:2`），技能直接不出现在 prompt 里。用户按文档装了技能却"没生效"，无法自查。
**Do this instead:** 缓存 diagnostics，经 `/api/skills/list` 回传设置页展示；`manage_skill` 成功响应里也带上新技能的诊断（若有）。

### Anti-Pattern 7: 用 `search-manager.fetchUrl` 抓技能包

**What people do:** 看到有现成的 SSRF 防护 + 超时 + 重定向上限，直接复用。
**Why it's wrong:** `fetchUrl` 会把 `text/html` 走 `htmlToMarkdown` 转换并返回 `{markdown, finalUrl, format, truncated}`（`search-manager.js:1629-1644`）——对 zip 二进制是破坏性的，对 SKILL.md 会丢掉 frontmatter 的原始形态（turndown 会把 YAML 块转成别的东西）。
**Do this instead:** 复用 `isPrivateHost` + 逐跳重定向校验 + `MAX_REDIRECTS` 的**同一套判据**，新写二进制/裸文本 fetcher。

### Anti-Pattern 8: 播种用 `cpSync(整目录, managedDir)`

**What people do:** 首次启动 `fs.cpSync(builtinDir, managedSkillsDir, {recursive:true})`，图省事。
**Why it's wrong:** ① 后续版本新增内置技能时永不播种（目标目录已存在）；② 会把用户对内置技能的改动/新增一并影响；③ 从 `app.asar` 内递归复制在打包后行为不确定（nodejieba 词典事故的同型风险，PROJECT.md 已把它列为"发布前必查"）。
**Do this instead:** 按单个技能目录粒度判定 + 版本戳登记表 + `asarUnpack` + `process.resourcesPath/app.asar.unpacked/skills-builtin` 路径。

---

## Growth / Scale Considerations

这不是用户量问题，而是**技能数量与 prompt 体积**的增长问题：

| 规模 | 关注点 | 处理 |
|------|--------|------|
| 1-5 个技能（MVP / 内置两个 + 少量用户） | 无需处理 | `<available_skills>` 约 5 行/条，完全无感 |
| 5-50 个技能 | prompt 段开始占可观 token；`getContextUsage()` 估算上升 | 引入字符预算 + 超限截断提示；用内置 find-skills 承担"按需发现"职责 |
| 50+ 个技能 | 模型在长清单里的匹配精度下降（注意力稀释） | 强约束：预算内只保留最高优先级；引导用户用 `/skill:` 显式调用；考虑按当前容器/场景裁剪（本里程碑不做） |

**第一个瓶颈**：`<available_skills>` 的 token 占用（每条 name+description+location ≈ 5 行）。**第二个瓶颈**：模型匹配精度（清单越长越容易漏）。两者都用同一个手段——**字符预算 + 质量优先截断**，而不是靠增加加载能力。

**性能上真正要注意的不是规模，而是刷新粒度**：`refreshSkills` 是同步刷盘遍历（`fs.readdirSync` 式，SDK 经环境抽象），技能目录变大时耗时上升。因此**禁止在热路径调用**（每轮/每次输入），只允许在阶段 2 列出的三个时机调用，且面板打开时的惰性复查应带 digest 短路（绝大部分情况零遍历）。

---

## Confidence Assessment

| 领域 | 置信度 | 依据 |
|------|--------|------|
| (a) 目录与沙箱 | **HIGH** | `agent-workspace.js` 全文直读：`resolveInside:136-166`、`createSandboxEnv:179-350`、`ensureWorkspaceDir:96-100`；SDK `skills.js` 加载器的遍历/跳过/忽略规则逐行确认 |
| (b) prompt 接线与失效 | **HIGH** | `buildSystemPrompt:561-564` 直读 + `ai-memory-manager.js:359-361` 同步约束事故记录；`agent.state` 可变性经 `dist/agent.js:26-50, 155-157, 280-286` 三处交叉验证 |
| (c) `/skill:` 链路 | **HIGH** | `renderer.js:334-337, 8663-8689, 9810-9824, 9900-9951` 直读；`ipc-handlers.js:1699-1720`；`promptWithContext:1038-1223`；`formatSkillInvocation` 源码直读 |
| (d) `manage_skill` | **HIGH** | `memory` 工具形态先例（`:5292-5374`）+ `_adaptHarnessTool:5439-5447` + `agent-workspace.js` renameFile 双路径校验直读 |
| (e) 设置页 HTTP 分层 | **HIGH** | `main.js:2647-2700` handler 模板 + `:2754-2758` 路由 + `:885-897` readJsonBody 无上限（已确认）+ `settings-page.js:162-186` fetch 封装 + Phase 17 根因记录 |
| zip 解包方案 | **MEDIUM** | 已确证项目无任何 zip 依赖（`package.json` 直读）；**未做** `fflate` vs 手写中央目录解析的对比验证（无 research plan 取数）。属 plan 期决策项，非本文件结论 |
| GitHub URL 分流细节 | **MEDIUM** | 三种 URL 形态的分流逻辑来自通用做法推断，未逐一对 GitHub 实际响应验证（未发网络请求）。codeload zipball / contents API 的具体路径需 plan 期确认 |

---

## Open Questions / 待 plan 期决策

| 项 | 说明 |
|----|------|
| zip 解包实现 | 新依赖（纯 JS、无原生模块）vs 手写中央目录 + `zlib.inflateRawSync`。项目有零新依赖先例（fMP4），但 ZIP 容器解析复杂度显著更高；需在 plan 阶段量化并决断 |
| `managed-skills` 中 AI 自建技能的边界 | 「AI 自建 managed 技能可改可删」vs「只允许 user 目录」——本文件建议前者（AI 自主创建能力是里程碑目标），但播种内置技能必须受保护。需产品确认 |
| 内置技能升级策略 | 版本戳 + "未修改才覆盖"的判定依据（内容 hash？播种时记录？）需细化 |
| 技能数量上限 | 硬上限（如 100）还是仅软预算？影响设置页 UI 与错误文案 |
| `attachments/` 与 `skills/` 的清理 | 卸载技能是否删除其目录内相对引用资源（本文件假定整体删除） |
| 快照/历史语义 | 历史对话中的 `<skill>` 块是否需要 UI 特殊渲染（区别于普通用户消息） |

---

## Sources

**代码（直接读取，最高权威）**

- `agent-workspace.js` — `:36-40` getWorkspaceDir、`:89-91` getAttachmentsDir、`:96-100` ensureWorkspaceDir、`:108-119` migrateAiMemory（迁移/播种幂等先例）、`:136-166` resolveInside、`:179-350` createSandboxEnv
- `ai-manager.js` — `:466-526` REALM_SYSTEM_PROMPT、`:536-549` buildWorkspacePrompt、`:552-564` buildSystemPrompt、`:686-860` init（`:807-811` sandboxEnv + tools、`:821-835` new Agent）、`:1038-1223` promptWithContext（`:1076-1084`、`:1172-1183`）、`:2432-2473` _recreateAgent、`:2588` getContextUsage、`:2667` _buildRealmTools、`:5292-5416` memory/memory_read 工具、`:5418-5420` 工具数组尾部、`:5439-5447` _adaptHarnessTool、`:5459-5481` _buildFilesystemTools
- `ai-memory-manager.js` — `:76-89` scanInjectionPatterns、`:355-403` buildGlobalSnapshot（`:359-361` 同步契约事故记录）、`:405-417` exports
- `ai-attachments-manager.js` — `:12-14` 授权语义与诚实边界、`:170-172` copyDirectory、`:182-273` registerFiles、`:197-212` symlink 拒绝、`:383-419` readImageDataUrl（路径校验先例）、`:438-464` buildAttachmentMarkers
- `ipc-handlers.js` — `:1680-1690` ai:prompt、`:1699-1720` ai:prompt-with-context、`:1730-1749` 附件 IPC
- `src/preload.js` — `:975-1050` realmAPI.ai 段
- `src/renderer.js` — `:334-337` SLASH_COMMANDS、`:8663-8689` 斜杠拦截、`:8748-8768` 发送、`:9768-9803` 键盘处理、`:9810-9824` executeActiveSlashCommand、`:9866-9894` 触发/开关、`:9900-9951` renderSlashPickerList
- `main.js` — `:836` app.whenReady、`:875-897` sendJson/readJsonBody（**无体积上限**）、`:1329-1430` handleSettingsApi + `:1375` 白名单校验、`:2626-2700` handleAiMemoryApi（handler 模板）、`:2702-2764` 路由分发、`:2754-2758` /api/ai-memory 注册
- `search-manager.js` — `:195` isPrivateHost、`:1586-1645` fetchUrl（含逐跳 SSRF 与重定向协议校验）、exports 块
- `src/settings.html` — `:265-532` AI 助手分区、`:484-505` AI 记忆（CSP 注释）、`:506-520` Bash 白名单、`:521-531` 视觉模型
- `src/settings-page.js` — `:62-186` 各 API 封装（`:162-186` aiMemoryApi）、`:2841-2948` 白名单增删与标签渲染、`:3825-4100` AI 记忆分区、`:4808` 初始化挂载区
- `package.json` — dependencies 全量（**确认无 zip/e 解包库**）、scripts、build 相关
- `AGENTS.md` — 全部维护约定（诊断入口清单、产品文档同步、CSP、弹框、沙箱、CSP/dialog 约定）

**SDK 源码（`node_modules/@earendil-works/pi-agent-core@0.84.3`）**

- `dist/index.d.ts:13-14` — skills/system-prompt 从包根导出
- `dist/harness/skills.js` — `:8-11` formatSkillInvocation、`:19-43` loadSkills、`:50-62` loadSourcedSkills、`:63-129` 递归遍历（`:88-103` SKILL.md 短路、`:104-127` 根层散落 md、`:105-106` 跳过 dot/node_modules）、`:130-171` .gitignore/.ignore/.fdignore、`:192-236` loadSkillFromFile、`:237-251` validateName、`:252-261` validateDescription、`:307-313` dirnameEnvPath
- `dist/harness/skills.d.ts` — `:14-26` 签名、`:1-13` SkillDiagnostic 形状
- `dist/harness/system-prompt.js` — `:1-21` formatSkillsForSystemPrompt（`:2` 过滤 disableModelInvocation、`:7-8` "Read the full skill file" 指令、`:22-29` escapeXml）
- `dist/harness/types.d.ts` — `:22-39` Skill 接口（`:37` disableModelInvocation 语义）、`:145-196` FileSystem 契约、`:226-227` ExecutionEnv
- `dist/agent.d.ts` — `:32-121` Agent API（`:76` state getter）
- `dist/agent.js` — `:26-50` createMutableAgentState（`:30` systemPrompt 可写）、`:155-157` `get state()` 返回 `_state`、`:280-286` createContextSnapshot 每轮重读
- `dist/types.d.ts` — `:289-314` AgentState（`:291` systemPrompt、`:297-301` tools/messages setter）

**项目文档**

- `.planning/PROJECT.md` — v2.6 里程碑目标与 Target features（`:167-176`）、参考实现 oh-my-pi（`:258`）、v2.6 关键发现（`:260-262`）、Key Decisions 全表（尤其 SSRF 收敛、setAIManager 延迟注入、Phase 17 webview 不用 realmAPI、fMP4 零新依赖、G-42-4 类记录）
- `docs/product/ai-agent-workspace.md` — 工作区产品说明（需同步更新）
- `docs/product/ai-chat-attachments.md` — 附件产品说明（导入先例语义）
- `docs/plan/ai-file-bash-tools-integration.md` — 沙箱/工具集成方案（`:55, 64, 66, 83` 与本次改动点同构）
- `docs/plan/ai-memory-system.md` — `:43, 86` 「REALM_SYSTEM_PROMPT 是静态拼接点」的既有分析
- `AGENTS.md` — AI 工作区与 Bash 权限、内部页面 CSP、弹框居中、Cookie/导航维护约定

---

*Architecture research for: Realm AI 助手技能（Skill）能力集成*
*Researched: 2026-09-10*
*Confidence: HIGH（SDK 与项目源码直读）；zip 解包方案与 GitHub URL 分流为 MEDIUM，留待 plan 期决策*

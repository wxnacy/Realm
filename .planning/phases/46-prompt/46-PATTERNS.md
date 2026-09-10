# Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入） - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 5（3 新增 / 2 修改）
**Analogs found:** 5 / 5（全部有同构先例；另有 1 个新形态无先例，见 §No Analog Found）
**Analog search scope:** 仓库根平铺主进程模块（`ai-*.js` / `agent-workspace.js`）、`tests/`、`docs/product/`、`window-manager.js`、`main.js`、`node_modules/@earendil-works/pi-agent-core/dist/harness/`
**Files scanned:** 12 个仓库文件 + 3 个 SDK 文件

> **Tracked-source gate 说明（#3645）：** 下表全部「本仓 analog」路径均经 `git ls-files -- <path>` 验证为 **git-tracked**（见 §Metadata 的验证记录）。
> **`node_modules/@earendil-works/pi-agent-core/**` 是 `node_modules/` 下的 gitignored 安装镜像（`.gitignore:2`），不是 analog，也不是任何编辑目标**——它只提供**只读契约**（函数签名 / 字段名 / 行为语义），代码一律通过 `await import('@earendil-works/pi-agent-core')` 消费，**绝不允许出现第二份实现**（见 §Do NOT Copy / Mirror）。

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ai-skills-manager.js` ★NEW | service（模块级缓存 + 同步访问器） | async-load → sync-snapshot（batch / transform） | `ai-memory-manager.js` | **exact**（同形态：模块级快照 + 同步只读 + 常量单源） |
| `ai-skills-manager.js`（错误聚合面） | service | partial-success batch | `ai-attachments-manager.js:174-273` | role-match |
| `agent-workspace.js` ✎MOD | utility（路径访问器 + 目录创建） | file-I/O（mkdir） | 文件内既有 `getAttachmentsDir():89-91` + `ensureWorkspaceDir():96-100` | **exact**（同一文件同一段落） |
| `ai-manager.js` ✎MOD | orchestrator / service | request-response → LLM 调用链 | 文件内既有 `buildSystemPrompt():561-564` + 两处 `new Agent(` + `get*Lazy()` helper | **exact**（同文件同段落就近扩展） |
| `tests/test-ai-skills.js` ★NEW | test | unit（含源码扫描型断言） | `tests/test-agent-workspace.js` | **exact**（脚手架逐字可用） |
| `docs/product/ai-skills.md` ★NEW | config（产品文档） | — | `docs/product/ai-agent-workspace.md`（六节+八节式）+ `docs/product/ai-chat-attachments.md`（维护约定块 + 十节式） | role-match |

**跨文件数据流（本阶段唯一权威链，反 Anti-Pattern 5）：**

```
main.js:4040 ensureWorkspaceDir()          →  skills/ + managed-skills/ 就位
   ↓
ai-manager.init():808  this.sandboxEnv = createSandboxEnv()
   ↓ ★ 新增 await  getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {disabled, rootDirs})
ai-skills-manager  _cache = { skills, promptBlock, digest, diagnostics, errors }
   ↓ 同步只读（零 IO）
ai-manager.buildSystemPrompt()  第 4 段 = getAiSkillsManagerLazy().buildSkillsPrompt()
   ↓
new Agent({ initialState: { systemPrompt: buildSystemPrompt() } })   （:821 与 :2453 两处）
```

---

## Pattern Assignments

### 1. `ai-skills-manager.js` ★NEW（service，async-load → sync-snapshot）

**主 analog：`ai-memory-manager.js`**（`git ls-files` 已验证 tracked）

#### 1a. 模块头 + 常量单源（D-11）—— 照抄 `ai-memory-manager.js:1-25`

```javascript
// ai-memory-manager.js:15-22（当前）
const fs = require('fs');
const path = require('path');

/** 各层字符预算（D-07/D-08 全项目唯一来源；单位按 JS string.length 计数） */
const BUDGETS = { user: 1375, global: 2200, container: 2200 };

/** 合法容器 ID 形态（防路径穿越：containerId 直接拼接文件名） */
const CONTAINER_ID_RE = /^[\w-]+$/;
```

**新文件要落的形状（D-11 三常量单源，端点与前端零字面量）：**

```javascript
/** 技能限额单源（D-11）—— 端点与前端不得出现字面量 */
const LIMITS = {
  MAX_SKILL_MD_BYTES: 64 * 1024,
  MAX_USER_SKILLS: 50,
  SKILLS_PROMPT_CHAR_BUDGET: 8000,
};
```

**Deltas（必须偏离 analog 的点）：**
- analog 的 `BUDGETS` 键是**记忆层名**（user/global/container）；新的是**三个独立限额**，语义不同（正文体积 vs 条目数 vs prompt 段字符）——键名照 D-11 原样，不代入 `BUDGETS` 命名（避免 Phase 43 消费者误用）。
- 文件头 JSDoc 必须写明**本次核对的 SDK 版本 `0.84.3`**（RESEARCH §Metadata 明确要求：升版后 `loadSkills` 递归语义 / `includeRootFiles` / 诊断字段名都可被上游改掉）。

#### 1b. 模块级缓存 + 同步访问器（G-42-4 同步契约）—— 照抄 `ai-memory-manager.js:355-403`

```javascript
// ai-memory-manager.js:356-364（同步契约与事故记录，逐字照抄语义）
/**
 * 构建全局两层冻结快照（D-03/D-04）
 *
 * 必须保持同步函数：Agent 创建路径（initialState.systemPrompt 组装处）
 * 不可异步化——动态 import 后 this.agent 在微任务才赋值，同步帧内恒 null
 * （G-42-4 实录）。只读 USER.md + MEMORY.md 两层，容器记忆不进快照（D-03）。
 *
 * @returns {string} XML 风格快照段 + 容器记忆索引指引
 */
function buildGlobalSnapshot() {
```

**新文件要落的形状（RESEARCH §Pattern 3）：**

```javascript
/** 模块级快照：{ skills, promptBlock, digest, diagnostics, errors, refreshedAt } */
let _cache = { skills: [], promptBlock: '', digest: '', diagnostics: [], errors: [] };

/** 同步：仅供 buildSystemPrompt() 调用 —— 绝不触发 IO（G-42-4 同步契约） */
function buildSkillsPrompt() { return _cache.promptBlock; }

/** 同步：仅供 Phase 48 /skill: 解析与 Phase 50 列表 —— 零 IO */
function getSkillsSnapshot() { return _cache; }   // ⚠️ 必须返回浅拷贝/冻结视图

/** 异步：唯一加载入口 */
async function refreshSkills(env, { disabled = [], rootDirs } = {}) { /* … */ }
```

**Deltas：**
- analog 的同步函数**读盘**（`readText` 是同步 fs，见 `ai-memory-manager.js:366-367`）；新文件的同步函数**只读内存 `_cache`**——这是本阶段的硬约束（RESEARCH Anti-Pattern 1：每轮重新加载会破坏同步契约 + systemPrompt 每轮变导致前缀缓存全 miss）。
- `getSkillsSnapshot()` 必须返回**浅拷贝或冻结视图**（RESEARCH §Pattern 3 明确要求），否则 Phase 48/50 消费者可就地改数组污染权威。

#### 1c. 失败语义：分层降级（D-05）—— 与 analog **相反**，注意不要照抄

```javascript
// ai-memory-manager.js:10-12（analog 的语义，本阶段禁止照抄）
 * 校验失败一律 throw（fail-closed）——调用方（pi-agent-core 工具 execute）抛出的
 * 错误会以 isError:true 的 toolResult 回给 LLM，不得返回错误文本冒充成功。
```

**新文件必须实现的是 D-05 两层，语义与 analog 相反：**

| 层 | 触发 | 行为 |
|----|------|------|
| ① 单技能失败（非法 name / 超长 description / YAML 失败 / 超限） | 单个 entry | **正常态**：产诊断 + 跳过该技能，其余照常注入（不 throw） |
| ② 整批 `refreshSkills()` 抛错（目录不可读等） | 整个调用 | **保留上一次成功快照** + `errors[]` 产 `level:'error'` 诊断（不清空、不静默） |

反例 `ai-attachments-manager.js:174-181` 是**单技能失败**那一层的正确形状（部分成功语义）：

```javascript
// ai-attachments-manager.js:174-185
/**
 * 批量登记路径型附件（主入口，ai:attach-files 消费）
 *
 * 部分成功语义：单项失败进 errors 数组，不整批 throw。
 *
 * @param {string[]} absPaths - 源绝对路径数组
 * @returns {Promise<{attachments: object[], errors: Array<{path: string, reason: string}>}>}
 */
async function registerFiles(absPaths) {
  const attachments = [];
  const errors = [];
```

**Deltas：** 新文件的 `errors[]` 是**模块级**（D-07「另设模块级 `errors[]` 承接无对应技能的整批错误」），不是函数返回值——因为消费者是 Phase 50 的设置页，需要在任意时刻同步读到上次失败原因。

#### 1d. 诊断形状映射（Pitfall 4 —— 本阶段最易踩的字段名错位）

SDK 诊断真实形状（`node_modules/@earendil-works/pi-agent-core/dist/harness/skills.d.ts`，**只读契约**）：

```ts
export interface SkillDiagnostic {
    type: "warning";              // ← 是 type，不是 level
    code: SkillDiagnosticCode;    // "file_info_failed"|"list_failed"|"read_failed"|"parse_failed"|"invalid_metadata"
    message: string;
    path: string;
}
```

**必须写显式映射函数（不能假定同名字段）：**

```javascript
const toRealmDiag = (d) => ({
  level: d.type === 'warning' ? 'warning' : 'error',
  code: d.code,
  message: d.message,
  path: d.path,
  source: d.source,
});
```

Realm 自建诊断的 `code` 用 `realm_` 前缀与 SDK 5 个枚举值**不重叠**：`realm_name_rewritten`（D-08）/ `realm_shadowed`（D-06）/ `realm_layout_violation`（Open Q2）/ `realm_prompt_budget_exceeded`（D-10）/ 目录缺失（Pitfall 6）。限额类诊断额外带 `limit` + `currentValue`（D-07）。

#### 1e. SDK 消费方式（唯一合法形式）—— 照抄 `agent-workspace.js:183-186`

```javascript
// agent-workspace.js:183-186（包根动态 import 的既有先例）
  // SDK 为 ESM-only，主进程 CJS 侧一律动态 import（与 ai-manager.js 先例一致）
  const { NodeExecutionEnv } = await import('@earendil-works/pi-agent-core/node');
  const { FileError, err, ok } = await import('@earendil-works/pi-agent-core');
```

**新文件需要的四个符号，同样只能从包根取：**

```js
const { loadSourcedSkills, formatSkillsForSystemPrompt, FileError, err } =
  await import('@earendil-works/pi-agent-core');
```

**约束（已实测）：** `pi-agent-core@0.84.3` 的 `exports` map 只有 4 个入口，**没有 `./harness/skills` 子路径**：

```json
{ ".": {...}, "./node": {...}, "./session/testing": {...}, "./package.json": "..." }
```

→ `import('@earendil-works/pi-agent-core/harness/skills')` **会直接 MODULE_NOT_FOUND**；`formatSkillsForSystemPrompt` / `loadSkills` / `loadSourcedSkills` / `FileError` / `err` 全部经 `dist/index.js:15-16` 的 `export *` 从包根可达。

#### 1f. 薄 env 包装（Pattern 1）—— 无同构 analog，但**结构纪律照抄 `createSandboxEnv`**

```javascript
// agent-workspace.js:207-349 的结构纪律（本阶段必须照抄的形状）
  return {
    cwd: root,

    async absolutePath(p) { ... },

    async joinPath(parts) { ... },

    async readTextFile(p, abortSignal) { ... },
    // …共 17 个 FileSystem 方法 + cwd + cleanup，逐项显式转发
  };
```

**新 `createSkillsEnv(sandboxEnv, opts, droppedNotices)` 的形状（RESEARCH §Pattern 1）：**

```javascript
return {
  ...sandboxEnv,                                   // 17 个方法 + cwd + cleanup 全部保留
  async listDir(p, abortSignal) { /* 扫描根只返回目录；非目录 entry 进 droppedNotices */ },
  async readTextFile(p, abortSignal) { /* basename==='SKILL.md' 先 fileInfo 判 size，超限返回 err(new FileError('invalid', …)) */ },
};
```

**关键约束（照抄 analog 的「显式转发」纪律）：**
- `createSandboxEnv()` 返回的是**对象字面量**（非 class 实例），`...sandboxEnv` 展开安全；**不要用 Proxy**（漏包某方法会静默落到非沙箱实现——与 `agent-workspace.js:207-349` 逐项列出的纪律同款）。
- `listDir` 拦截**只作用于两个扫描根本身**（`isRoot` 判定），不得影响 `skills/<name>/` 内的 `references/` `scripts/` `assets/` 枚举。
- `readTextFile` 拦截**只作用于 basename === 'SKILL.md'**，`.ignore` / `.gitignore` 读取不受影响。
- `FileError` 三参形态照 `agent-workspace.js:192-196`：`err(new FileError('invalid', message, String(p)))`。

#### 1g. 定序比较器（Pattern 4）—— **不得**照抄 SDK 的 `localeCompare`

```javascript
// node_modules/…/harness/skills.js:104（SDK 内部用，Realm 不复用）
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
```

```javascript
// 新文件必须用的确定性全序（D-10：user 来源 > 可自动激活 > name 码点序）
const bySkillPriority = (a, b) =>
  (a.source === 'user' ? 0 : 1) - (b.source === 'user' ? 0 : 1) ||
  (a.disableModelInvocation === true ? 1 : 0) - (b.disableModelInvocation === true ? 1 : 0) ||
  (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
```

理由：`localeCompare` 依赖运行环境 ICU/区域设置，同一技能集在不同机器可能排出不同顺序 → 前缀缓存跨设备漂移（Pitfall 7）。

#### 1h. 模块导出面 —— 照抄 `ai-memory-manager.js:405-417` / `ai-bash-policy.js:253-263`

```javascript
// ai-memory-manager.js:405-417（导出面先例：常量也导出）
module.exports = {
  BUDGETS,
  setBaseDir,
  resolveFile,
  parseEntries,
  scanInjectionPatterns,
  write,
  readContainer,
  readScope,
  writeScope,
  deleteContainerMemory,
  buildGlobalSnapshot,
};
```

**新文件导出面（P8 门禁的可断言面）：** `LIMITS` / `refreshSkills` / `buildSkillsPrompt` / `getSkillsSnapshot` / `resolveSkill` / （`_toRealmDiag` 等纯函数可按需导出供测试）。`_resetCacheForTest()` 照 `ai-attachments-manager.js:466-472` 的 `_resetRegistryForTest` 先例命名。

---

### 2. `agent-workspace.js` ✎MOD（utility，file-I/O）

**Analog：同文件同段落**（既有访问器与建目录函数）

#### 2a. 目录访问器模板 —— 逐字照抄 `agent-workspace.js:84-91`

```javascript
// agent-workspace.js:84-91（新访问器的模板）
/**
 * 解析聊天附件快照目录（用户拖入/粘贴的文件由主进程复制于此，
 * agent 经 read 工具直接读取——快照在沙箱根内，resolveInside 天然放行）
 * @returns {string} 附件快照目录绝对路径
 */
function getAttachmentsDir() {
  return path.join(getWorkspaceDir(), 'attachments');
}
```

**新落的两行（位置：紧跟 `getAttachmentsDir()` 之后、`ensureWorkspaceDir()` 之前）：**

```javascript
/** 用户技能目录（source='user'；与 managed-skills 的优先级见 ai-skills-manager） */
function getSkillsDir() {
  return path.join(getWorkspaceDir(), 'skills');
}

/** managed 技能目录（source='managed'；被同名 user 技能遮蔽，文件不删） */
function getManagedSkillsDir() {
  return path.join(getWorkspaceDir(), 'managed-skills');
}
```

#### 2b. `ensureWorkspaceDir()` 两行 mkdir —— `:93-100`

```javascript
// agent-workspace.js:93-100（当前实现，「扩展点」）
/**
 * 启动时建目录（幂等）：根目录 + .tmp/ + attachments/
 */
function ensureWorkspaceDir() {
  fs.mkdirSync(getWorkspaceDir(), { recursive: true });
  fs.mkdirSync(getTmpDir(), { recursive: true });
  fs.mkdirSync(getAttachmentsDir(), { recursive: true });
}
```

**Delta（唯一改动，勿动其他三行）：**
- 追加 `fs.mkdirSync(getSkillsDir(), { recursive: true });` 与 `fs.mkdirSync(getManagedSkillsDir(), { recursive: true });`
- 头部 JSDoc 的目录清单同步更新为 5 项（`:94` 那句），并：文件头 `:5-7` 的落盘数据清单也需补两目录。
- **`recursive: true` 幂等** → 对既有 `.tmp/` `attachments/` `ai-memory/` 零影响（RESEARCH §Runtime State Inventory 已核）；`tests/test-agent-workspace.js` 现有 21 例不会失败，但**应新增断言**「两目录存在」。

#### 2c. 导出面 —— `:352-363`（追加两个访问器，保持字母/主题分组顺序）

```javascript
// agent-workspace.js:352-363
module.exports = {
  getWorkspaceDir,
  setWorkspaceDir,
  setLegacyAiMemoryDir,
  getAiMemoryDir,
  getTmpDir,
  getAttachmentsDir,
  ensureWorkspaceDir,
  migrateAiMemory,
  resolveInside,
  createSandboxEnv,
};
```

> **⛔ 本阶段对 `agent-workspace.js` 的改动仅此三处（2 个访问器 + 2 行 mkdir + 导出 2 项）。**
> **`resolveInside():136-166` / `createSandboxEnv():179-350` 一行都不改**（RESEARCH §F 探针实测：沙箱 env 直接可作 `loadSkills` 的 `env`，17 个方法覆盖 SDK 用到的 5 个；symlink 逃逸被正确拒绝）。**不要**给 `managed-skills/` 做只读挂载或加第二个 root——会引入第二套路径判据，与 `resolveInside` 双基准/realpath 逻辑漂移。

---

### 3. `ai-manager.js` ✎MOD（orchestrator，四处接线）

**Analog：同文件既有段落**（以下行号均为当前文件实读）

#### 3a. 惰性 require helper —— 逐字照抄 `:94-108`

```javascript
// ai-manager.js:94-108（新 helper 的模板，含 JSDoc 措辞）
function getAiMemoryManagerLazy() {
  return require('./ai-memory-manager');
}

/**
 * 惰性 require AI 工作区模块（agent 根目录 + 沙箱 env）
 *
 * agent-workspace 内部对 electron app 的依赖是惰性获取的，此处按同款惰性
 * 模式引用（与 getAiMemoryManagerLazy 一致），避开模块加载顺序问题。
 *
 * @returns {object} agent-workspace 模块导出
 */
function getAgentWorkspaceLazy() {
  return require('./agent-workspace');
}
```

**新增 `getAiSkillsManagerLazy()`** 放在 `getAgentWorkspaceLazy` 之后（`:108` 后），JSDoc 照抄同款三段式。

#### 3b. `buildSystemPrompt()` 第 4 段 —— `:551-564`

```javascript
// ai-manager.js:551-564（当前三段拼接 + 同步契约 JSDoc）
/**
 * 构建完整 system prompt（REALM_SYSTEM_PROMPT + workspace 段 + 全局两层记忆冻结快照）
 *
 * 快照在 Agent 创建时一次性拼入（D-04 冻结语义：会话内不变，保前缀缓存）。
 * buildGlobalSnapshot 为同步函数——Agent 创建路径上不可异步化（G-42-4 实录）。
 * init() 与 _recreateAgent() 两处 Agent 创建点都必须经此函数（漏一处即
 * 部分会话无记忆快照）。
 *
 * @returns {string} 完整 system prompt
 */
function buildSystemPrompt() {
  return REALM_SYSTEM_PROMPT + '\n\n' + buildWorkspacePrompt() + '\n\n'
    + getAiMemoryManagerLazy().buildGlobalSnapshot();
}
```

**Delta（D-01 / D-02）：** 第 4 段**条件追加**，空态**整段不追加**（不产生空标签、不留多余空行）：

```javascript
function buildSystemPrompt() {
  const base = REALM_SYSTEM_PROMPT + '\n\n' + buildWorkspacePrompt() + '\n\n'
    + getAiMemoryManagerLazy().buildGlobalSnapshot();
  const skillsBlock = getAiSkillsManagerLazy().buildSkillsPrompt();   // 同步，纯读 _cache
  return skillsBlock ? base + '\n\n' + skillsBlock : base;
}
```

- JSDoc 契约句必须更新为「**三处**都必须经此函数」并把「技能段在最末、前三段全静态 → 前缀缓存恒命中」写进去（D-01 的 reversibility 依赖这条注释）。
- 技能段文本**原样使用** `formatSkillsForSystemPrompt()` 返回值，**不加中文前缀、不自写中文段**（D-02）。
- `:2588` 的 `Math.ceil(buildSystemPrompt().length / 4)`（`getContextUsage`）自动跟随，无需改动——这也是 Open Q3「8000 = 整段预算」的依据。

#### 3c. 两处 Agent 创建点前 `await refreshSkills()` —— `:807-835` 与 `:2432-2473`

```javascript
// ai-manager.js:807-835（第一处，init()）
      // 创建沙箱 ExecutionEnv（文件/Bash 工具共用；cwd = agent 工作区根目录）
      this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();

      // 构建工具列表
      this.tools = this._buildRealmTools();

      // 创建 Agent 实例
      // …
      this.agent = new Agent({
        initialState: {
          systemPrompt: buildSystemPrompt(),
          model,
          tools: this.tools,
        },
        // …
```

```javascript
// ai-manager.js:2432-2466（第二处，_recreateAgent()）
  async _recreateAgent() {
    if (!this.models || !this.isInitialized) { … return; }
    try {
      const { Agent } = await import('@earendil-works/pi-agent-core');
      // … 取 model …
      this.agent = new Agent({
        initialState: {
          systemPrompt: buildSystemPrompt(),
          model,
          tools: this.tools,
        },
```

**Delta（D-04）：** 两处均**在 `new Agent(` 之前**插入无条件 `await`：

```javascript
await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
  disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
  rootDirs: [
    getAgentWorkspaceLazy().getManagedSkillsDir(),   // 先 managed
    getAgentWorkspaceLazy().getSkillsDir(),          // 后 user（同 name 时遮蔽前者）
  ],
});
```

- `this.sandboxEnv` 可用性已核：构造器 `:665` 置 null 后仅 `:808` 赋值一次，`_recreateAgent` 全程复用（且 `_recreateAgent` 本身有 `isInitialized` 守卫）。
- 两个 `rootDirs` 顺序**不是装饰**：`loadSourcedSkills` 逐 input 顺序执行，managed 先加载 → user 后到即可判遮蔽（D-06）。
- ⚠️ `_recreateAgent` 若失败**保留上次快照**（D-05 第 2 层），不要清空 `_cache`。

#### 3d. `syncAgentSystemPrompt()` 新增方法（D-03 / SKILL-04）

**形状依据：** `agent.js:155-157`（`get state()` 返回 `_state` 本体）+ `:280-286`（每轮 `createContextSnapshot()` 重读）——即改写 `agent.state.systemPrompt` 下一轮即生效，**不重建 Agent**。

```javascript
async syncAgentSystemPrompt() {
  if (!this.agent || !this.sandboxEnv) return;
  const snapshot = await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, { … });
  if (this.isProcessing || (this.agent.state && this.agent.state.isStreaming)) {
    this._skillsPromptDirty = true;                       // idle 处理路径里补刷
    return;
  }
  const next = buildSystemPrompt();
  if (this.agent.state.systemPrompt === next) return;     // 无变化 → 不动（保前缀缓存）
  this.agent.state.systemPrompt = next;
  windowManager.broadcast('skills:changed');
}
```

**既有先例：**
- `this.isProcessing` 状态位：`:653` 初始化，`:965 / :1074` 置 true，`:973 / :991 / :998 / :1094 / :1209 / :1213 / :1345` 复位——**`_skillsPromptDirty` 的补刷点应挂在其中一个复位分支之后**（`idle` 边界），不要在流式回调内部直接改 prompt。
- `windowManager.broadcast(channel, ...args)`：`window-manager.js:310-316`（遍历 `windows`、`isDestroyed()` 守卫、`webContents.send`）。`ai-manager.js` 已有引用先例（`:3018` `windowManager.broadcast('bookmarks-bar:refresh')`），顶层 `:25` 已 require，**无需新增依赖**。
- `configStore` 注入式读取（**manager 零 configStore 依赖**）：`:5511-5513`

```javascript
// ai-manager.js:5511-5513（配置注入先例：读值在 ai-manager，判定在纯模块）
        const whitelist = this.configStore
          ? this.configStore.get('settings.aiBashWhitelist', [])
          : [];
```

#### 3e. `module.exports` 追加式导出 —— `:5648-5651`

```javascript
// ai-manager.js:5648-5651（追加式导出先例）
module.exports = AIManager;
module.exports.executeScript = executeScript;
module.exports.sanitizeInput = sanitizeInput;
module.exports.validateScriptForSteps = validateScriptForSteps;
```

**Delta：** 追加 `module.exports.buildSystemPrompt = buildSystemPrompt;` —— 这是 VALIDATION.md 明确标注的 **Wave 0 前置**（`typeof require('./ai-manager').buildSystemPrompt === 'undefined'` 已实测），否则「技能段确实进 prompt」无法断言。

---

### 4. `tests/test-ai-skills.js` ★NEW（test，unit + 源码扫描）

**Analog：`tests/test-agent-workspace.js`**（脚手架逐字可用）

#### 4a. 文件头 + require —— 逐字照抄 `:1-19`

```javascript
// tests/test-agent-workspace.js:1-19
/**
 * agent-workspace 模块单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：resolveInside 路径校验（越界/撞名前缀/symlink 逃逸/根目录放行）、
 * createSandboxEnv 沙箱包装（writeFile 越界、renameFile 双路径、createTempDir
 * 重定向 .tmp/、exec cwd）、migrateAiMemory 一次性迁移三态。
 * 全部用例经 setWorkspaceDir/setLegacyAiMemoryDir 注入临时目录，不触碰真实 userData。
 *
 * 用法: node tests/test-agent-workspace.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');
```

#### 4b. `withTempRoot(t)` 脚手架 —— 逐字照抄 `:21-32`

```javascript
// tests/test-agent-workspace.js:21-32
/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ws-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    workspace.setLegacyAiMemoryDir(null);
    aiMemoryManager.setBaseDir(null);
  });
  workspace.setWorkspaceDir(dir);
  return dir;
}
```

**Delta（RESEARCH/§Validation Architecture 明确要求）：**
- `mkdtempSync` 前缀改为 `realm-skills-test-`。
- 清理块内**追加 `aiSkills._resetCacheForTest()`**（模块级 `_cache` 跨用例污染会让「空技能集」断言假失败）+ `workspace.setWorkspaceDir(null)`。
- 需要 `aiManager` 的用例里**不要**依赖 `setWorkspaceDir` 之外的注入——`ai-manager.js` 是可 require 的（已实测），但 `buildSystemPrompt` 走的是 `getAgentWorkspaceLazy().getWorkspaceDir()`，会命中覆写值。

#### 4c. describe + test 分组与断言风格 —— 照抄 `:34-83`

```javascript
// tests/test-agent-workspace.js:34-42（describe 分组 + 单行断言风格）
describe('resolveInside 路径校验', () => {
  test('相对路径越界（../../etc/passwd）拒绝', () => {
    const root = '/tmp/fake-root';
    assert.strictEqual(workspace.resolveInside(root, '../../etc/passwd'), null);
  });
```

**建议分组（对齐 VALIDATION.md 的 Per-Task Verification Map）：**
`技能目录与沙箱可达（SKILL-01）` / `prompt 段注入（SKILL-02）` / `模块级缓存 + 同步访问器（SKILL-03）` / `去重与遮蔽（SKILL-05）` / `诊断与限额（SKILL-06/07）` / `启停状态与回归守卫（SKILL-08 + 反幽灵/反黑屏/反深嵌套）` / `依赖纪律（源码扫描）`。

#### 4d. 源码扫描型断言（本阶段特有，无直接 analog）

需断言的两种源码事实（**P8 唯一可自动化捕捉"漏接线"的手段**）：
1. `ai-manager.js` 每个 `new Agent(` 出现点之前 N 行内存在 `refreshSkills` 调用；
2. `ai-skills-manager.js` / `ai-manager.js` 源码**不含** `require('yaml')` / `require('ignore')`（P11/O5）与 `import('@earendil-works/pi-agent-core/harness/`（子路径导出不存在）。

形态用 `fs.readFileSync(path.join(__dirname, '..', 'ai-manager.js'), 'utf8')` + 正则/`split('\n')` 索引，断言用 `assert.ok(cond, '失败说明')` —— 与 `test-agent-workspace.js` 的「断言 + 消息」风格一致（见 `:118` `assert.strictEqual(..., true, '源文件未被移动')`）。

**同时注意**：SDK 集成测试需要真实 `createSandboxEnv()`（已实测纯 Node 可跑，见 `:88` `await workspace.createSandboxEnv({ cwd: root })`）——直接传它给 `refreshSkills` 即可，无需 mock。

#### 4e. 反例：**不要**照抄的文件头风格

`tests/test-ai-bash-policy.js:1-13` 是**纯函数引擎**测试（只 require 一个零依赖模块，不建临时目录）。技能测试需要真实文件系统布局（8 种技能布局逐项构造），所以**必须**走 `test-agent-workspace.js` 的 `withTempRoot` 路线，而不是 `test-ai-bash-policy.js` 的纯函数路线。

---

### 5. `docs/product/ai-skills.md` ★NEW（config，产品文档）

**Analog A：`docs/product/ai-agent-workspace.md`**（维护约定块 + 八节）

```markdown
<!-- docs/product/ai-agent-workspace.md:1-8（维护约定块，逐字照抄格式） -->
# AI 工作区与文件/Bash 工具（产品说明）

> **维护约定（重要）**：本文档是 AI 助手文件/Bash 工具（read/write/edit/bash）、agent 工作区、
> 权限白名单功能的**产品说明权威文档**。以后修改这些功能的行为（工具能力、权限分档、
> 白名单匹配语义、确认流程、沙箱边界、工作区目录结构等），**必须同步更新本文档**，
> 让产品说明与实际行为保持一致。实现方案与决策记录见
> [docs/plan/ai-file-bash-tools-integration.md](../plan/ai-file-bash-tools-integration.md)。
```

**Analog B：`docs/product/ai-chat-attachments.md`**（互引维护块 + 十节 + `### 5.1/5.2` 子节）

```markdown
<!-- docs/product/ai-chat-attachments.md:3-7（互引式维护块） -->
> **维护约定（重要）**：本文档是 AI 聊天框附件功能的**产品说明权威文档**。……
> 沙箱与工具侧的说明见 [ai-agent-workspace.md](ai-agent-workspace.md)（其「聊天附件（attachments/）」
> 小节与本文档互为引用）。
```

**新文档必须落的六节骨架（DOC-01）：** 能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制。

**必须写实的三条诚实边界（Security Domain 硬要求）：**
1. 技能的 `description` **会进入每次请求的 system prompt**（`escapeXml` 只做字符转义不做内容审查）→ **不要导入来源不明的技能**；正文（body）只在激活时经 `read` 进入对话。
2. 「AI 不可删改内置技能」是**工具层不变式，不是沙箱不变式**——沙箱只有一个 root，模型可直接 `write managed-skills/x/SKILL.md`（与 `ai-bash-policy` 的"白名单是启发式而非安全边界"同款哲学）。
3. 已知限制占位：O8（`/compact` 不保留技能正文）、O3（`allowed-tools` 在当前 SDK **不存在该字段**；任何展示都是虚假安全感）、禁用语义边界（同名技能共享禁用状态，D-09）。

**交叉引用（照 Analog B 的互引习惯）：** `ai-skills.md` ↔ `ai-agent-workspace.md` 的「agent 工作区目录模型」小节（`:27-46` 的目录树需同步补 `skills/` 与 `managed-skills/`）。

---

## Shared Patterns

### S1. 冻结快照 + 同步只读（本阶段最核心的跨文件契约）

**Source:** `ai-memory-manager.js:356-364`（含 G-42-4 事故记录）
**Apply to:** `ai-skills-manager.js`（`buildSkillsPrompt` / `getSkillsSnapshot` 必须零 IO）、`ai-manager.js`（`buildSystemPrompt` 保持同步）

```javascript
 * 必须保持同步函数：Agent 创建路径（initialState.systemPrompt 组装处）
 * 不可异步化——动态 import 后 this.agent 在微任务才赋值，同步帧内恒 null
 * （G-42-4 实录）。
```

约束链：**异步加载 → 模块级缓存 → 同步只读**。任何"在 `buildSystemPrompt()` 里 await"或"每轮重新加载"的写法都会同时命中：同步契约破坏 + 前缀缓存全 miss + 架构 Anti-Pattern 1。

### S2. 常量单源（D-11）

**Source:** `ai-memory-manager.js:19` `const BUDGETS = { user: 1375, global: 2200, container: 2200 };`
**Apply to:** `LIMITS` 三常量只在 `ai-skills-manager.js` 定义；Phase 47/50/51 的端点、设置页前端**零字面量**。

### S3. 配置注入（manager 无 configStore 依赖）

**Source:** `ai-manager.js:5511-5513`
**Apply to:** `settings.aiSkills.disabled` 由 `ai-manager` 读出后**作为参数注入** `refreshSkills(env, { disabled })` —— 保证 `ai-skills-manager` 纯 Node 可测（与 `ai-bash-policy.evaluateBashCommand(cmd, whitelist)` 同哲学）。

```javascript
        const whitelist = this.configStore
          ? this.configStore.get('settings.aiBashWhitelist', [])
          : [];
```

### S4. 惰性 require / 动态 import（主进程模块三件套）

**Source:** `agent-workspace.js:36-40`（electron 惰性）、`ai-manager.js:94-108`（模块惰性）、`agent-workspace.js:183-186`（SDK 包根动态 import）
**Apply to:** `ai-skills-manager.js` 顶层不得 `require('electron')`、不得顶层 `import` SDK；`ai-manager.js` 新 helper 一律 `getAiSkillsManagerLazy()`。

### S5. 部分成功 / 不静默失败

**Source:** `ai-attachments-manager.js:174-181`（`errors[]` 部分成功语义）+ `ai-memory-manager.js:10-12`（fail-closed 的另一半）
**Apply to:** D-05 两层降级 + D-07 双诊断容器（`skill.diagnostics[]` 内联 + 模块级 `errors[]`）。SKILL-06 的"禁止静默失败"是本阶段 V7 安全项。

### S6. 跨窗口广播

**Source:** `window-manager.js:310-316`；调用先例 `ai-manager.js:3018`
**Apply to:** `syncAgentSystemPrompt()` 末尾 `windowManager.broadcast('skills:changed')`（本阶段只发事件，消费方在 48/50）。

```javascript
function broadcast(channel, ...args) {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}
```

### S7. 启动序列顺序约束

**Source:** `main.js:4038-4041`

```javascript
  // 初始化 AI 工作区（agent 根目录）并一次性迁移旧版 AI 记忆目录
  // （必须在 aiManager 创建之前：sandbox env 与 ai-memory 新路径都依赖目录就位）
  agentWorkspace.ensureWorkspaceDir();
  agentWorkspace.migrateAiMemory();
```

**Apply to:** 新增两行 mkdir 落在 `ensureWorkspaceDir()` 内即自动纳入该序列，**`main.js` 零改动**（Pitfall 6：目录缺失时 `loadSkills` 静默返回空且零诊断，所以这条顺序是硬要求）。

---

## No Analog Found

| File / Feature | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `createSkillsEnv()`（`ai-skills-manager.js` 内的薄 env 包装） | utility（env 装饰器） | transform / interpose | 仓库内**没有**任何"在 SDK env 之上再包一层做语义收窄"的先例。最接近的是 `agent-workspace.js:207-349` 的 `createSandboxEnv`（同样是"包装 SDK env 并逐项显式转发"），但它是**硬沙箱**（安全边界），新的是**加载面收窄**（语义边界）——**只照抄「显式转发每个方法、不用 Proxy」这条纪律**，不照抄路径校验逻辑。 |
| 源码扫描型断言（`new Agent(` 前必有 `refreshSkills`；源码不含 `require('yaml')`） | test | static analysis | `tests/` 现有 17 个文件全是行为测试，无源码扫描先例。形态自定（`fs.readFileSync` + 行索引 + `assert.ok`）。 |
| D-10 预算截断的「差量测量条目成本」法 | utility（纯函数） | transform | 仓库无先例。**必须**用差量法（`formatSkillsForSystemPrompt([dummy]).length` 作 `fixedOverhead`）而非复制 SDK 的字符串模板——自拼会随 SDK 升级漂移。 |

> 上述三项均**不需要新依赖**，按 RESEARCH.md 的 §Pattern 1 / §Pattern 2 / §Code Examples 实现即可。

---

## Do NOT Copy / Mirror

| 不要照抄的东西 | 出处 | 原因 |
|---------------|------|------|
| `createSandboxEnv` / `resolveInside` 的任何逻辑改动 | `agent-workspace.js:136-166` `:179-350` | **本阶段零改动**（探针实测：沙箱 env 直接可作 `loadSkills` 的 `env`）。改它 = 引入第二套路径判据 |
| `ai-memory-manager` 的「校验失败一律 throw」 | `ai-memory-manager.js:10-12` | 技能加载是 D-05 **两层降级**（单技能跳过 + 整批保留旧快照），不是 fail-closed |
| `scanInjectionPatterns` / `INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS` | `ai-memory-manager.js:34-89` | Phase 51 的扫描复用对象；本阶段**不涉及**（无写入路径） |
| `_adaptHarnessTool` | `ai-manager.js:5439-5447` | Phase 49 注册 `manage_skill` 的适配器；本阶段不涉及 |
| `skills.js:104` 的 `localeCompare` 排序 | SDK（gitignored 依赖） | 定序必须用 D-10 的确定性全序（Pitfall 7：`localeCompare` 跨机漂移 → 前缀缓存漂移） |
| SDK 自带字符串模板复刻（自拼 `<available_skills>`） | `system-prompt.js:12-19`（gitignored 依赖） | 必须调 `formatSkillsForSystemPrompt`（含 `escapeXml`）；不得自拼，也不得在渲染端重建 |
| `.ignore` / `.gitignore` 做根层加载收窄 | — | **已实测证伪**：`prefixIgnorePattern` 剥掉前导 `/`（`skills.js:187-188`），`/*.md` 会让全部技能消失 |
| renderer 侧优先级表 / 默认表 | `AGENTS.md` §导航入口与分配规则（shortcut-manager 教训） | 优先级只在主进程一份（D-06 + Anti-Pattern 5） |
| `yaml` / `ignore` 直接 require | 传递依赖（未列入 `package.json`） | P11/O5：换 pnpm 立刻 `MODULE_NOT_FOUND`。经 `loadSkills` 往返即可获得与运行时**完全一致**的校验语义。 |
| `import('@earendil-works/pi-agent-core/harness/skills')` 子路径导入 | SDK `exports` map 仅 4 入口 | 实测：无 `./harness/skills` 子路径 → MODULE_NOT_FOUND。四个符号全部从**包根**取。 |

---

## Metadata

**Analog search scope:** 仓库根 `.js` 模块（`ai-*` / `agent-workspace`）、`tests/`、`docs/product/`、`window-manager.js`、`main.js`、`node_modules/@earendil-works/pi-agent-core/dist/harness/`
**Files scanned:** 12 个仓库文件 + 3 个 SDK 只读契约文件
**Pattern extraction date:** 2026-09-11

**Tracked-source gate 验证记录：**

```
$ git ls-files -- ai-manager.js agent-workspace.js ai-memory-manager.js \
      ai-attachments-manager.js ai-bash-policy.js \
      tests/test-agent-workspace.js tests/test-ai-bash-policy.js \
      docs/product/ai-agent-workspace.md docs/product/ai-chat-attachments.md
agent-workspace.js
ai-attachments-manager.js
ai-bash-policy.js
ai-manager.js
ai-memory-manager.js
docs/product/ai-agent-workspace.md
docs/product/ai-chat-attachments.md
tests/test-agent-workspace.js
tests/test-ai-bash-policy.js
（全部 tracked ✓；window-manager.js / main.js 亦为 tracked 根级模块）

$ git check-ignore -v node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js
.gitignore:2:node_modules/  ← SDK 路径是 gitignored 安装镜像：只读契约，非 analog、非编辑目标
```

**本阶段零新增依赖**（`package.json` dependencies / devDependencies / build.asarUnpack 全部原样）。

**唯一未验证的行号：** §3d 的 `_skillsPromptDirty` 补刷点（`isProcessing` 复位分支的具体挂载位置）由 plan 期选定——`isProcessing = false` 出现于 `:973 / :991 / :998 / :1094 / :1209 / :1213 / :1345 / :2424`，选取需按"何时算 idle"的实现判断，不要在流式回调内部直接改 prompt。

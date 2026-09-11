# Phase 47: 内置技能播种 + bash 策略加固 - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 16（7 新建 / 9 修改，其中 1 项判定为「不需要改」）
**Analogs found:** 12 / 16（4 个静态资源/文档类新文件在仓库内无同型先例）

> **Tracked-source 纪律已核对**：下表所有仓库内路径均经 `git ls-files -- <path>` 验证为已追踪源码。
> `skills-builtin/`、`THIRD_PARTY_NOTICES.md`、`tests/test-builtin-skills-seeder.js`、`builtin-skills-seeder.js`
> 实测**尚不存在**（`ls` 无匹配 / `git ls-files` 无输出）→ 属新建路径，保持原名。
> `/Volumes/ZhiTai/...` 下的 openhanako 文件在**仓库之外**，仅作算法形状参照，**不得作为 Analog 路径写入任何实现**。

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `skills-builtin/find-skills/SKILL.md` | config（技能定义正文） | static-asset | 无（仓库内无任何 SKILL.md） | **无 analog** |
| `skills-builtin/find-skills/LICENSE.txt` | config（许可证副本） | static-asset | 无 | **无 analog** |
| `skills-builtin/skill-creator/**`（SKILL.md / LICENSE.txt / scripts/*.py / references / assets / eval-viewer / agents） | config（上游快照） | static-asset | 无 | **无 analog** |
| `skills-builtin/skill-creator/scripts/check_env.mjs` | utility（CLI 探针脚本，ESM） | subprocess / transform | 无（仓库内零 `.mjs`） | **无 analog**（用 RESEARCH Pattern 5 + 外部参照） |
| `builtin-skills-seeder.js`（名称交 planner 定） | service（主进程启动链路模块） | file-I/O + batch 幂等同步 + 诊断 | `agent-workspace.js` | **role-match**（结构/导出/错误处理同构；原子目录替换需新建） |
| `THIRD_PARTY_NOTICES.md` | doc（归属声明） | static-asset | `docs/product/*.md`（Markdown 文档体例） | partial |
| `tests/test-builtin-skills-seeder.js` | test | file-I/O + static-scan | `tests/test-ai-skills.js`（脚手架 + 源码扫描）+ `tests/test-agent-workspace.js`（temp-dir 注入） | **exact** |
| `ai-bash-policy.js`（改） | utility（纯函数策略引擎） | transform / decision | 自身既有 `DANGEROUS_PATTERNS` + `matchDangerous` + `evaluateBashCommand` | **exact**（自引） |
| `ai-manager.js`（改，仅 `_createBashToolWithPolicy`） | service（主进程工具工厂） | request-response | 自身既有 `:5630-5691` 三分支改造 | **exact**（自引） |
| `main.js`（改，仅启动链路） | config / bootstrap | batch（启动期一次性） | 自身既有 `:4038-4041` `migrateAiMemory()` 调用点 | **exact**（自引） |
| `package.json`（改，`build.asarUnpack`） | config | static-asset | 自身既有 `node_modules/nodejieba/**` 条目 | **exact**（自引） |
| `tests/test-ai-bash-policy.js`（改） | test | pure-function 断言 | 自身既有 6 个 `describe` / 32 例组织 | **exact**（自引） |
| `docs/product/ai-skills.md`（改） | doc | static-asset | 自身既有 7 节骨架 | **exact**（自引） |
| `docs/product/ai-agent-workspace.md`（改） | doc | static-asset | 自身 §四 表格 / §七 诚实声明 | **exact**（自引） |
| `AGENTS.md`（改） | doc | static-asset | 自身 §AI 工作区与 Bash 权限 | **exact**（自引） |
| `agent-workspace.js`（**判定：不改**） | service（沙箱层） | file-I/O | 自身既有 `getManagedSkillsDir()` 已足够 | — |

**关于 `agent-workspace.js` 的判定（与 extra_guidance 的「only if a path accessor is needed」对齐）：**
**不需要新增任何访问器。** 播种模块的目标目录用既有的 `agentWorkspace.getManagedSkillsDir()`（`agent-workspace.js:113-114`，已导出），
打包源目录是**另一条独立链路**，必须在播种模块内自解析（`app.isPackaged` 分支），**不得**挂进 `getWorkspaceDir()` 的派生链
（CONTEXT `code_context` 明确警告；RESEARCH Anti-Patterns 第 3 条同款）。且 `agent-workspace.js` 当前**不 require electron**，
其 21 例测试全部纯 Node 跑 —— 塞入 `app.isPackaged` 会直接破坏这条可测性。

---

## Pattern Assignments

### 1. `ai-bash-policy.js`（utility，纯函数策略引擎）— install 档

**Analog:** 自身（`ai-bash-policy.js`，263 行，已全文读）

**文件头「诚实边界」声明（`:1-13`，逐字）— 新表必须继承这套定位：**
```js
/**
 * Realm Browser - AI Bash 命令三档权限策略（纯函数引擎，零依赖）
 *
 * 三档裁决（evaluateBashCommand）：
 * - allow   ：拆段后所有段命中白名单（前缀通配或精确匹配）→ 免确认执行
 * - confirm ：存在危险段（DANGEROUS_PATTERNS / DANGEROUS_INTERPRETERS）
 *             → 强制确认，即使命中白名单也无效（danger）
 *             默认未命中白名单（default）
 *
 * 诚实边界：静态拆段无法覆盖全部 shell 语法（进程替换、命令替换 $() 等），
 * 本引擎定位为「降低误执行概率」的启发式，不是安全边界。真正的安全边界是
 * 确认卡片 + agent-workspace 硬沙箱。
 */
```

**模式表形状（`:152-180`，逐字）— `PACKAGE_MANAGER_INSTALL_PATTERNS` 必须逐字沿用 `{ pattern, name }` 二元形状：**
```js
/**
 * 危险命令模式表（对规范化后的段做词边界正则匹配）
 * ...
 */
const DANGEROUS_PATTERNS = [
  { pattern: /\brm\b/, name: '删除文件（rm）' },
  { pattern: /\bsudo\b/, name: '提权执行（sudo）' },
  { pattern: /\bsu\s+\S/, name: '切换用户（su）' },
  { pattern: /\b(dd|mkfs\.\w+)\b/, name: '磁盘写入（dd/mkfs）' },
  { pattern: /\b(kill|killall|pkill)\b/, name: '终止进程（kill）' },
  { pattern: /\b(shutdown|reboot|halt)\b/, name: '系统电源控制' },
  { pattern: /\b(hdiutil|diskutil|launchctl|csrutil|nvram|pmset)\b/, name: '系统配置工具' },
  { pattern: /\b(chmod|chown|chflags)\b/, name: '权限变更（chmod/chown）' },
  { pattern: /\bdefaults\s+write\b/, name: '系统偏好写入（defaults write）' },
  // 重定向覆盖到根下非 tmp 路径（> /etc/xx、>> /Users/xx）；> /tmp/x 不拦
  { pattern: /(^|\s)>{1,2}\s*\/(?!tmp\b)/, name: '重定向覆盖系统路径' },
];

/**
 * 解释器执行命令名表：管道/组合命令中出现以解释器为命令名的段即视为危险
 * （curl x | sh、node -e ... 等把任意文本当代码执行的场景）
 */
const DANGEROUS_INTERPRETERS = new Set([
  'sh', 'bash', 'zsh', 'dash', 'eval', 'source',
  'osascript', 'python', 'python3', 'node', 'ruby', 'perl',
]);
```

**匹配函数形状（`:182-198`，逐字）— `matchInstall` 逐字照此模子写（同 normalize 口径、同 `string|null` 返回、同 for-of 早返回）：**
```js
/**
 * 判定单个命令段是否危险
 * @param {string} seg - 命令段（原始文本即可，内部会规范化）
 * @returns {string|null} 命中返回危险名称（中文），未命中返回 null
 */
function matchDangerous(seg) {
  const n = normalizeSegment(seg);
  if (!n) return null;
  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(n)) return name;
  }
  const cmdName = extractCommandName(n);
  if (cmdName && DANGEROUS_INTERPRETERS.has(cmdName)) {
    return `解释器执行（${cmdName}）`;
  }
  return null;
}
```

**裁决流水线（`:200-228`，逐字）— install 短路的插入点，`danger` 分支必须保持在 `install` 之前：**
```js
function evaluateBashCommand(command, whitelist) {
  const segments = splitCommandPipeline(command);
  if (segments.length === 0) {
    return { level: 'confirm', reason: 'empty', dangerNames: [] };
  }
  const dangerNames = [];
  for (const seg of segments) {
    const hit = matchDangerous(seg);
    if (hit) dangerNames.push(hit);
  }
  if (dangerNames.length > 0) {
    return { level: 'confirm', reason: 'danger', dangerNames };
  }
  const allAllowed = segments.every((seg) => matchesWhitelist(seg, whitelist));
  if (allAllowed) {
    return { level: 'allow', dangerNames: [] };
  }
  return { level: 'confirm', reason: 'default', dangerNames: [] };
}
```

**导出块（`:253-263`，逐字）— 新常量与 `matchInstall` 必须加进这里（`matchDangerous` 的既有导出位置就是落点）：**
```js
module.exports = {
  normalizeSegment,
  splitCommandPipeline,
  extractCommandName,
  matchesWhitelist,
  matchDangerous,
  DANGEROUS_PATTERNS,
  DANGEROUS_INTERPRETERS,
  evaluateBashCommand,
  validateWhitelistList,
};
```

**要落地的表（RESEARCH E-1 实测定型，逐字照抄，不要重新设计正则）：**
```js
const PACKAGE_MANAGER_INSTALL_PATTERNS = [
  { pattern: /\bnpx\b/,                                        name: '包执行器（npx）' },
  { pattern: /\bnpm\b(?:\s+-\S+)*\s+\b(i|install|ci|exec|add)\b/,      name: 'npm 安装依赖' },
  { pattern: /\bpnpm\b(?:\s+-\S+)*\s+\b(add|install|i|dlx|exec)\b/,    name: 'pnpm 安装依赖' },
  { pattern: /\byarn\b(?:\s+-\S+)*\s+\b(add|install|dlx|exec)\b/,      name: 'yarn 安装依赖' },
  { pattern: /\bbun\b(?:\s+-\S+)*\s+\b(add|install|x|i)\b/,            name: 'bun 安装依赖' },
  { pattern: /\bpip3?\b(?:\s+-\S+)*\s+install\b/,                      name: 'pip 安装包' },
  { pattern: /\bpython3?\b(?:\s+-\S+)*\s+-m\s+pip\s+install\b/,        name: 'python -m pip 安装包' },
  { pattern: /\buv\b(?:\s+-\S+)*\s+(pip\s+install|add|tool\s+install|sync)\b/, name: 'uv 安装包' },
  { pattern: /\buvx\b/,                                        name: 'uv 包执行器（uvx）' },
  { pattern: /\bbrew\b(?:\s+-\S+)*\s+(install|upgrade|reinstall)\b/,   name: 'Homebrew 安装包' },
  { pattern: /\bcargo\b(?:\s+-\S+)*\s+install\b/,                      name: 'cargo 安装包' },
  { pattern: /\bgo\b(?:\s+-\S+)*\s+install\b/,                         name: 'go 安装包' },
  { pattern: /\bgem\b(?:\s+-\S+)*\s+install\b/,                        name: 'gem 安装包' },
];
```

**归一化辅助（RESEARCH E-1 建议的保守形态 —— 引号剥离只用在 `matchInstall` 内部，不污染 `matchDangerous`/`matchesWhitelist`，见 Assumptions A5）：**
```js
function stripLeadingQuotes(seg) {
  return normalizeSegment(seg).replace(/^(['"])([A-Za-z][\w.-]*)\1/, '$2');
}

function matchInstall(seg) {
  const n = stripLeadingQuotes(seg);
  if (!n) return null;
  for (const { pattern, name } of PACKAGE_MANAGER_INSTALL_PATTERNS) {
    if (pattern.test(n)) return name;
  }
  return null;
}
```

**裁决新形状（危险优先 → install 短路 → 白名单 → 默认）：**
```js
  const dangerNames = [];
  const installNames = [];
  for (const seg of segments) {
    const d = matchDangerous(seg);
    if (d) dangerNames.push(d);
    const i = matchInstall(seg);
    if (i) installNames.push(i);
  }
  if (dangerNames.length > 0) {
    return { level: 'confirm', reason: 'danger', dangerNames, installNames };
  }
  if (installNames.length > 0) {          // ★ 先于 matchesWhitelist —— 白名单不可越过
    return { level: 'confirm', reason: 'install', dangerNames, installNames };
  }
```
四条硬约束：① `danger` 先返回（`sudo npm i x` → `danger`）；② `install` 短路在 `matchesWhitelist` **之前**；
③ `installNames` 收集不设短路；④ **不动** `splitCommandPipeline` / `matchesWhitelist` / `normalizeSegment` / `extractCommandName`（32 条既有断言覆盖）。

**不要加进表的一条（RESEARCH E-1 尾注）：** `curl … | sh` 的「下载并管道执行」**不要**放进 `PACKAGE_MANAGER_INSTALL_PATTERNS` ——
`danger` 已先命中（管道右侧 `sh` ∈ `DANGEROUS_INTERPRETERS`），加了就是永不触发的死模式。该模式只保留在 A-4 的技能文本扫描器里。

---

### 2. `ai-manager.js`（service，工具工厂）— `_createBashToolWithPolicy` 消费 `'install'`

**Analog:** 自身 `ai-manager.js:5630-5691`（逐字，已读）

**工具描述（`:5632-5639`，逐字）— 第 3 句需追加 install 档说明：**
```js
    const inner = this._adaptHarnessTool(this._sdkFileTools.createBashTool(), {
      label: '执行 Bash 命令',
      description: `在 AI 工作区（${workspaceDir}）内执行 bash 命令，工作目录固定为工作区根目录。`
        + '输出超过 2000 行或 50KB 会截断（全量输出存临时文件）。'
        + '命中白名单的命令自动执行；其余命令需用户在确认卡片上确认；'
        + '危险命令（rm/sudo/kill 等）即使加入白名单也必须确认。'
        + '命令失败（非零退出码、超时）会直接报错，可用较短超时试探性执行',
    });
```
→ 第 3 句改为：`'危险命令（rm/sudo/kill 等）与包管理器安装命令（npx/npm i/pip install/brew install 等）即使加入白名单也必须确认。'`

**现状的二分消费（`:5643-5663`，逐字）— `isDanger` 二分会让 install 落进 medium 分支，直接违反 D-15：**
```js
        const verdict = bashPolicy.evaluateBashCommand(params && params.command, whitelist);

        let confirmedActionId = null;
        if (verdict.level === 'confirm') {
          const isDanger = verdict.reason === 'danger';
          const actionId = `bash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const dangerHint = isDanger
            ? `检测到高危操作（${verdict.dangerNames.join('、')}），白名单对本命令无效`
            : '该命令未命中白名单';
          const confirmation = await requestActionConfirmation({
            actionId,
            type: 'execute_script',
            title: isDanger ? 'AI 请求执行高危 Bash 命令' : 'AI 请求执行 Bash 命令',
            description: `${dangerHint}\n\n$ ${params.command}`,
            riskLevel: isDanger ? 'high' : 'medium',
            timeoutMs: 120000, // bash 命令需要用户读完再决策，30s 默认值容易误取消
          });
```
**三分改法（4 行，RESEARCH E-3 逐字）：** 加 `const isInstall = verdict.reason === 'install';`；`dangerHint` 三分支
（install 分支文案：`检测到包管理器安装（${verdict.installNames.join('、')}）：将从网络下载并运行第三方代码；该命令不会因为加入白名单而免确认`）；
`title` 三分支（install → `'AI 请求安装第三方软件包'`）；`riskLevel: (isDanger || isInstall) ? 'high' : 'medium'`。

**`'empty'` 分支无需改**：它本就走「未命中白名单」语义。
**确认取消链路（`:5664-5674`）与执行/终态链路（`:5676-5689`）零改动。**

---

### 3. `main.js`（bootstrap）— 播种调用点

**Analog:** 自身 `main.js:4038-4044`（逐字，已读）
```js
  // 初始化 AI 工作区（agent 根目录）并一次性迁移旧版 AI 记忆目录
  // （必须在 aiManager 创建之前：sandbox env 与 ai-memory 新路径都依赖目录就位）
  agentWorkspace.ensureWorkspaceDir();
  agentWorkspace.migrateAiMemory();

  // 初始化 AI Manager（per Phase 19）
  aiManager = new AIManager();
```
**插入位置：`migrateAiMemory()` 之后、`new AIManager()` 之前**（播种必须先于 `aiManager.init()` → `refreshSkills()`，否则首轮加载看不到内置技能）。
**形态约束：同步调用**（既有两行都是同步 `fs`）；**失败仅告警不阻断启动**。
**顶部 require 区照既有 `const agentWorkspace = require('./agent-workspace')` 的写法并列新增一行 require。**

---

### 4. `package.json`（config）— `build.asarUnpack`

**Analog:** 自身 `package.json:69-71`（逐字，已读）
```json
    "asarUnpack": [
      "node_modules/nodejieba/**"
    ],
```
→ 追加 `"skills-builtin/**"`（**写 `skills-builtin/**`，不写 `skills-builtin/**/*`** —— 后者的 glob 语义在部分实现里不含目录本身）。
既有 `node_modules/nodejieba/**` 已实测解包出三层嵌套（`submodules/cppjieba/dict/`），证明 `**` 覆盖任意深度。
**若同时采纳 `build.files` allowlist（RESEARCH Pitfall 4 方案 (A)），必须确保 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` 都在 allowlist 内** —— 否则 SEED-05 与 P10 同时失效。

---

### 5. `builtin-skills-seeder.js`（service，主进程启动链路模块）— 新建

**Analog A（模块结构/导出风格/错误处理）：`agent-workspace.js`**

**文件头 + 惰性 electron require 纪律（`:1-22` 摘录，逐字）：**
```js
/**
 * Realm Browser - AI 工作区模块
 * ...
 * electron 依赖惰性获取（与 ai-memory-manager.js 先例一致）：纯 Node
 * 测试环境下 require('electron') 不可加载，延迟到真正需要路径时才 require。
 */

const fs = require('fs');
const path = require('path');
```

**测试注入覆写字段先例（`:24-28` + `:44-50`，逐字）— 播种模块的 `isPackaged` / `resourcesPath` / `builtinSrcDir` 注入照此模子：**
```js
/** 工作区根目录覆写（测试注入；null 回落默认 userData/agent-workspace） */
let _workspaceDirOverride = null;
...
/**
 * 覆写工作区根目录（测试临时目录注入唯一入口）
 * @param {string|null} dir - 根目录绝对路径；null 恢复默认 userData 路径
 */
function setWorkspaceDir(dir) {
  _workspaceDirOverride = dir;
}
```

**目标目录访问器（`:106-115`，逐字）— 播种的唯一写入目标，直接调用，不要新建：**
```js
/**
 * 解析 managed 技能目录（source='managed'；被同名 user 技能遮蔽，文件不删）
 *
 * 与 getSkillsDir 同款：由 getWorkspaceDir() 派生，不引入第二个沙箱 root
 * 或只读挂载（否则与 resolveInside 的双基准 + realpath 判据漂移）。
 * @returns {string} managed 技能目录绝对路径
 */
function getManagedSkillsDir() {
  return path.join(getWorkspaceDir(), 'managed-skills');
}
```

**幂等搬运 + 非阻断错误处理（`:128-145`，逐字）— 播种的**错误处理契约**与**递归复制实现**都照抄这里：**
```js
/**
 * 一次性迁移旧版 AI 记忆目录到工作区（照抄 cookie-manager migrateLegacyCookies
 * 的「旧存在 && 新不存在才迁」先例，目录版 cpSync）
 *
 * 任何失败仅告警不阻断启动；旧目录保留不删（回滚保险）。
 */
function migrateAiMemory() {
  const legacy = getLegacyAiMemoryDir();
  const target = getAiMemoryDir();
  if (!fs.existsSync(legacy)) return;
  if (fs.existsSync(target)) return;
  try {
    fs.cpSync(legacy, target, { recursive: true });
    console.log('[Realm] AI 记忆已迁移至 agent-workspace/ai-memory');
  } catch (err) {
    console.error('[Realm] AI 记忆迁移失败（保留旧目录，下次启动重试）:', err.message);
  }
}
```

**导出块风格（文件尾，逐字）— 扁平具名导出，末尾加 `_` 前缀测试钩子（参照 `ai-skills-manager._resetCacheForTest`）：**
```js
module.exports = {
  getWorkspaceDir,
  setWorkspaceDir,
  setLegacyAiMemoryDir,
  getAiMemoryDir,
  getTmpDir,
  getAttachmentsDir,
  getSkillsDir,
  getManagedSkillsDir,
  ensureWorkspaceDir,
  migrateAiMemory,
  resolveInside,
  createSandboxEnv,
};
```
→ 播种模块建议导出：`seedBuiltinSkills` / `resolveBuiltinSkillsSrc` / `getSeededSkillNames` /
`setBuiltinDepsForTest`（或等价的注入器）/ `_resetForTest`。

**Analog B（打包源路径分支）：`favorites-manager.js:285-299`（逐字，已读）**
```js
      // 打包后词典必须显式指向 app.asar.unpacked：
      // 默认路径在 app.asar 内，原生 fopen 无法读取，cppjieba 会直接 abort 闪退
      if (app.isPackaged) {
        const dictDir = path.join(
          process.resourcesPath,
          'app.asar.unpacked', 'node_modules', 'nodejieba', 'submodules', 'cppjieba', 'dict'
        );
        nodejieba.load({
          dict: path.join(dictDir, 'jieba.dict.utf8'),
          ...
        });
      }
```
**与 nodejieba 的两点差异（必须显式处理）：** ① nodejieba 在 `isPackaged === false` 时**不设路径**（开发态 `node_modules` 就在 `__dirname` 下），而 `skills-builtin/` 开发态必须**显式回落 `__dirname`**；② `require('electron')` 必须放在**函数体内**（惰性），不能放模块顶层，否则 `tests/` 纯 Node 跑不起来。

**Analog C（原子目录替换算法形状）：仓库外 `/Volumes/ZhiTai/Projects/github/openhanako/shared/safe-fs.ts:70-142`**（**外部参照，不是 Realm 源码，不得在实现里 require**）：
```ts
/**
 * Atomic directory copy with rollback.
 * 1. Copy src -> dst.tmp_{ts}
 * 2. If dst exists, rename dst -> dst.bak_{ts}
 * 3. Rename dst.tmp_{ts} -> dst
 * 4. Delete dst.bak_{ts}
 * Recovery: if step 3 fails, rename dst.bak_{ts} back to dst, clean up tmp.
 */
export function safeCopyDir(src, dst) {
  const ts = Date.now();
  const tmpDst = `${dst}.tmp_${ts}`;
  const bakDst = `${dst}.bak_${ts}`;
  try {
    _copyDirRecursive(src, tmpDst);
    let hadExisting = false;
    if (fs.existsSync(dst)) {
      fs.renameSync(dst, bakDst);
      hadExisting = true;
    }
    try {
      fs.renameSync(tmpDst, dst);
    } catch (renameErr) {
      if (hadExisting) {
        try { fs.renameSync(bakDst, dst); } catch { /* best effort rollback */ }
      }
      _cleanupDir(tmpDst);
      throw renameErr;
    }
    if (hadExisting) _cleanupDir(bakDst);
  } catch (err) {
    _cleanupDir(tmpDst);
    throw new AppError('FS_COPY_FAILED', { cause: err, context: { src, dst } });
  }
}

function _cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
```
**必须保留的三条：** `timestamped` 的 tmp/bak 命名、**回滚路径**（`renameSync` 失败把 bak 改回）、失败后清理 tmp。
**必须改的三条：** ① `_copyDirRecursive` 手写递归 → 用 `fs.cpSync(src, tmpDst, { recursive: true })`（仓库先例 `agent-workspace.js:140`）；
② symlink 分支 → **改成遇到 symlink 直接拒绝并产诊断**（fail-closed；源是随包内容，绝不含 symlink）；
③ `AppError` / `errorBus` → Realm 诊断形状（见 Shared Patterns）。
**额外一条修正（RESEARCH C-1 失败路径 #4）：** `_cleanupDir(bakDst)` 必须**包在自己的 try 里吞错** —— 否则「清理失败但替换其实成功」会被报成失败。
**⚠️ 卷约束：** tmp 必须是 `<skillDst>.tmp_<ts>`（同父目录 → 必然同卷）。**不要把 tmp 放到 `os.tmpdir()`**（macOS `/var/folders` 可能异卷 → `renameSync` `EXDEV`）。

**Analog D（单技能目录粒度的自愈同步）：仓库外 `core/first-run.ts:252-274`**（外部参照）：
```ts
function syncSkills(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const skillSrc = path.join(srcDir, entry.name);
    const skillDst = path.join(dstDir, entry.name);
    // 只要源里有 SKILL.md 就同步整个目录
    if (!fs.existsSync(path.join(skillSrc, "SKILL.md"))) continue;
    try {
      safeCopyDir(skillSrc, skillDst);
    } catch (err) {
      errorBus.report(new AppError('SKILL_SYNC_FAILED', { ... context: { skill: entry.name } }));
      // Continue with other skills, don't abort
    }
  }
}
```
**Realm 版必须保留：** ① `entry.isDirectory()` + 点前缀跳过；② **含 `SKILL.md` 才算技能**（这同时是 D-11 的 seeded 身份判据）；
③ **单技能失败 continue，不 abort**。
**Realm 版必须增补：** ① **差异检测先行**（D-09 要求覆盖前产 warning 诊断；原型是静默覆盖）；
② 诊断进 Realm 形状而非 `errorBus`；③ **不得对 `srcDir` 做「只播一次」的早期返回**（D-08 要求逐目录独立判定）。

**差异检测口径（RESEARCH C-3，逐层短路，从便宜到贵）：**
```
detectDiff(srcDir, dstDir) → 'same' | 'different' | 'missing'
  ① dstDir 不存在                  → 'missing'
  ② 递归收集两边相对路径集合不等    → 'different'
  ③ 逐文件 size 不等               → 'different'
  ④ 逐文件 sha256 不等             → 'different'
  ⑤ 全同                           → 'same'
```
**⚠️ 绝不用 mtime 判差异**（D-08 每次启动都覆盖，mtime 必然变 → 100% 误报 `realm_builtin_seed_overwritten`）。
**sha256 写法先例：** `crypto.createHash('sha256')` —— 仓库既有 `media-cache-manager.js:69,78,300,463,478`。

**seeded 身份判定（D-11，零硬编码、零状态文件）：**
`readdirSync(BUILTIN_SRC, { withFileTypes: true })` → 过滤 `isDirectory()` → 过滤 `existsSync(path.join(d, 'SKILL.md'))` → 取 `name` 集合。
**代码里不得出现字面量 `'find-skills'` / `'skill-creator'`**（除测试断言与 `THIRD_PARTY_NOTICES` 文档记录）。

---

### 6. `skills-builtin/skill-creator/scripts/check_env.mjs`（utility，ESM CLI 探针）— 新建

**仓库内 analog：无**（`git ls-files | grep '\.mjs$'` → 零结果）。用 RESEARCH Pattern 5 的对照表 + 外部参照实现。

**外部参照 `/Volumes/ZhiTai/Projects/github/openhanako/skills2set/skill-creator/scripts/check_env.mjs`（469 行，**仓库外，仅供形状参照**）：**

**文件头常量与两张表（`:1-32`，逐字）：**
```js
#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

const ENV_VAR = "HANA_SKILL_CREATOR_PYTHON";
const MIN_PYTHON_VERSION = [3, 10, 0];
const MIN_PYTHON_VERSION_TEXT = `${MIN_PYTHON_VERSION[0]}.${MIN_PYTHON_VERSION[1]}`;
const CHECK_TIMEOUT_MS = 10_000;

const PACKAGE_SPECS = {
  pyyaml: {
    packageName: "pyyaml",
    moduleName: "yaml",
    purpose: "SKILL.md frontmatter validation",
  },
  anthropic: {
    packageName: "anthropic",
    moduleName: "anthropic",
    purpose: "description optimization loop",
  },
};

const CAPABILITIES = {
  baseline: { packages: [], commands: [] },
  "quick-validate": { packages: ["pyyaml"], commands: [] },
  "package-skill": { packages: ["pyyaml"], commands: [] },
  "aggregate-benchmark": { packages: [], commands: [] },
  "eval-viewer": { packages: [], commands: [] },
  "run-eval": { packages: [], commands: ["claude"] },
  "description-optimize": { packages: ["anthropic"], commands: [] },
  "run-loop": { packages: ["anthropic"], commands: ["claude"] },
};
```
→ Realm 版：`ENV_VAR` 改名 `REALM_SKILL_CREATOR_PYTHON`；`CAPABILITIES` **收缩到 4 组**
（`baseline` / `quick-validate` / `eval-viewer` / `description-optimize`，去掉依赖 `claude` CLI 的 `run-eval` / `run-loop`）；最小版本保留 3.10；超时保留 10s。

**包检查方式（`:47-62`，逐字）— 不真 import，用 `importlib.util.find_spec`：**
```js
const IMPORT_SCRIPT = `
import importlib.util
import json
import sys
specs = json.loads(sys.argv[1])
packages = {}
for item in specs:
    package_name = item["packageName"]
    module_name = item["moduleName"]
    packages[package_name] = {
        "packageName": package_name,
        "moduleName": module_name,
        "ok": importlib.util.find_spec(module_name) is not None,
    }
print(json.dumps({"packages": packages}))
`;
```

**输出契约与退出码（`:64-66` + `:466-469`，逐字）：**
```js
function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
...
const result = main();
printResult(result);
process.exit(result.ok ? 0 : 1);
```

**「禁止自动安装」声明（`:420-431`，逐字）— 必须保留这句；同时它是 A-4 扫描器的**唯一豁免**对象：**
```js
      installGuidance: [
        `Install the missing package(s) into the reported Python environment after user confirmation: ${missingPackages.map((item) => item.packageName).join(", ")}.`,
        "Do not auto-install dependencies from this skill.",
      ],
```
**保留的失败码集合：** `python_not_found` / `python_version_unsupported` / `missing_dependency` / `missing_command` / `invalid_arguments` / `unknown_requirement` / `invalid_environment` / `dependency_check_failed`。
**解释器探测顺序：** win32：`py -3` → `python` → `python3`；其他：`python3` → `python`。
**`spawnSync` 失败双判：** 参照实现按 `result.error || result.status !== 0`（传 `timeout` 时失败会带 `result.error`）。
**Realm 版规模预估：约 300-350 行。**

> **⚠️ SKILL-09 的真实载体：** 该脚本 shebang 是 `#!/usr/bin/env node`，调用形式 `node scripts/check_env.mjs` → `node` ∈ `DANGEROUS_INTERPRETERS`（`ai-bash-policy.js:177-180`）→ **每次调用必弹高风险确认卡片**，这是 D-05 的预期结果，不是缺陷。

---

### 7. `tests/test-builtin-skills-seeder.js`（test）— 新建

**Analog A（测试文件脚手架）：`tests/test-ai-skills.js:1-73`（逐字，已读）**

```js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');
const aiSkills = require('../ai-skills-manager');
const aiManager = require('../ai-manager');

/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skills-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
    // 模块级 _cache 跨用例污染会让后续「空技能集」断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  aiMemoryManager.setBaseDir(dir);
  return dir;
}

/** 写入一个契约布局技能：<scannedDir>/<name>/SKILL.md */
function writeSkill(scannedDir, name, { description = `${name} 技能描述`, body = `# ${name}\n\n正文内容\n` } = {}) {
  const dir = path.join(scannedDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);
  return file;
}
```
→ 新测试文件：`withTempRoot` 改名 `realm-seeder-test-` 前缀，`t.after` 里恢复注入（`setBuiltinDepsForTest(null)` + 若真加载过技能则 `aiSkills._resetCacheForTest()`）。

**Analog B（源码扫描型断言辅助，**P1-b-4 直接复用**）：`tests/test-ai-skills.js:48-73`（逐字，已读）**
```js
/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

/** 取函数体文本（从 `function <name>(` 到下一个行首 `}`） */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `源码中应存在 function ${name}(`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

/**
 * 取类方法体文本（支持 `async <name>(` / `function <name>(` / 两空格缩进的 `<name>(`）
 *
 * 与 functionBody 的区别：类方法以两空格缩进的 `}` 收尾，且多数是 `async`。
 */
function methodBody(source, name) {
  let start = source.indexOf(`async ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`\n  ${name}(`);
  assert.ok(start >= 0, `源码中应存在方法 ${name}(`);
  const end = source.indexOf('\n  }', start);
  return source.slice(start, end);
}
```
**P1-b-4 的用法：** `const body = methodBody(readSource('ai-manager.js'), '_createBashToolWithPolicy');` → 断言 `body.includes("reason === 'install'")`、`body.includes("'high'")`、`body.includes('包管理器')`。

**Analog C（沙箱 env 构造 + 技能加载，SEED-04 的 promptBlock 断言要用）：`tests/test-ai-skills.js:81-84`（逐字）**
```js
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });
```
**注意 `rootDirs` 顺序是 `[managedDir, userDir]`**（`ai-skills-manager.js:443-444` 据此分配 `source`）。
**`withTempRoot` 的 temp-dir 注入先例（无 ai-skills 依赖的简化版）：`tests/test-agent-workspace.js:21-32`（逐字）**
```js
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

**A-4 的零安装语义扫描器（二段式，照 RESEARCH A-4 逐字落地）：**
- **第 1 段（无豁免，零容忍）**：只扫两个 `SKILL.md` + 两个 `LICENSE.txt`
- **第 2 段（带行级豁免）**：扫 `scripts/` 与 `resources/`，豁免清单里显式列出 `check_env.mjs` 的
  `installGuidance` 与 `Do not auto-install dependencies from this skill.` 两处（**测试注释里写死豁免理由**）
- **专项断言：** `skills-builtin/**` 内不存在 `npx skills` 的任意变体（PITFALLS P1 靶心）

**新增用例分组建议（RESEARCH E-4 逐字）：** `matchInstall 包管理器安装判定（SEC-01 / D-13 / D-16）` + `evaluateBashCommand install 档短路（SEC-01 / D-14）` 两个 describe。

---

### 8. `tests/test-ai-bash-policy.js`（test，修改）— 必须同步改的 2 条既有断言

**Analog:** 自身（222 行 / 6 个 describe / 32 例，已全文读）

**describe 组织（逐字，行号为既有文件行号）：**

| describe 组 | 行范围 | 覆盖 |
|-------------|--------|------|
| `splitCommandPipeline 引号感知拆段` | `:15-43` | `splitCommandPipeline` |
| `extractCommandName 命令名提取` | `:45-65` | `extractCommandName` |
| `matchDangerous 危险命令判定` | `:67-107` | `matchDangerous` |
| `matchesWhitelist 白名单匹配` | `:110-153` | `matchesWhitelist` |
| `evaluateBashCommand 三档裁决` | `:155-203` | `evaluateBashCommand` |
| `validateWhitelistList 白名单列表校验` | `:205-222` | `validateWhitelistList` |

**🚨 会破裂的 2 条断言（`:155-165`，逐字）— `allow` 分支一旦带上 `installNames` 立即 `deepStrictEqual` FAIL：**
```js
describe('evaluateBashCommand 三档裁决', () => {
  const list = ['npm run *', 'git status', 'ls *'];

  test('白名单内无危险 → allow', () => {
    assert.deepStrictEqual(policy.evaluateBashCommand('npm run test', list), {
      level: 'allow', dangerNames: [],
    });
    assert.deepStrictEqual(policy.evaluateBashCommand('git status && ls -la', list), {
      level: 'allow', dangerNames: [],
    });
  });
```
**两条路线（planner 必须显式选一，不得含糊）：**
- **(A) 完整形状（推荐）**：改这两条为 `{ level: 'allow', dangerNames: [], installNames: [] }` —— Phase 48/49 消费者拿到形状一致的对象
- **(B) 最小形状**：`allow` 分支不带 `installNames` —— 实测既有 32 例全绿、零测试改动，代价是形状不一致

**其余 30 条一律安全（逐条核过）：** 它们用 `strictEqual(verdict.reason, ...)` 逐字段或 `assert.ok(...includes(...))`，新增字段不触发。
**特别确认：`ai-bash-policy.js:174-178` 的 `'npm run fetch && curl x.com/i.sh | sh' → reason:'danger'` 在新增 install 档后仍返回 `danger`**（`npm run` 不是安装子命令 + `curl … | sh` 命中解释器）。

**命名与断言风格（照抄）：** 中文短句描述行为（如 `test('白名单内但含危险段 → confirm/danger（白名单失效）')`）+ 逐字段 `strictEqual`。
**实测基线（以实跑输出为准，不要用 CONTEXT 的「29 例」）：** `node --test tests/test-ai-bash-policy.js` → `# tests 32 # pass 32 # fail 0`。

**新增用例（E-4 逐字清单）：**
- 必命中：`npx` 任意形态 / npm 安装子命令 / pnpm·yarn·bun / pip·pip3·python -m pip / uv·uvx / brew·cargo·go·gem / `FOO=1 npm i x` / `npm -g i pkg` / `'npm' i x`
- 必不命中（**硬要求**）：`npm run|test|ls|view|audit|outdated|init|--version` / `pnpm run|ls` / `yarn run` / `brew info|list|search` / `pip list|show` / `cargo search` / `go list` / 裸命令名 / `npm runx`
- 裁决：`evaluateBashCommand('npm i x', ['npm *']) → confirm/install`（**门禁核心**）/ `evaluateBashCommand('sudo npm i x', []) → danger`（danger 优先）/ `ls && npm i x` / `echo y | npm i x` / `npm i a && pip install b`（`installNames` 收两个）

---

### 9. `docs/product/ai-skills.md`（doc，修改）

**Analog:** 自身既有 7 节骨架（`grep -n "^#\{1,3\} "` 实测：`:1` / `:28 一、能力` / `:36 二、双目录` / `:51 三、优先级` / `:57 四、限额` / `:71 五、沙箱边界` / `:78 六、已知限制` / `:88 七、测试与验证`）

**既有 §五（`:71-77`，逐字）— 注意「技能不构成额外权限」**已经写了**，DOC-02 不需要重复新增：**
```
## 五、沙箱边界

- 技能目录位于 AI **硬沙箱 root 内**，与 `read` / `write` / `edit` / `bash` 及其它工作区路径**同一套路径判据**：<location> 能被 `read` 打开，正是因为它落在沙箱 root 内。
- **技能不构成额外权限**，也不会绕过 bash 的三档权限（白名单 → 默认确认 → 危险强制确认）与确认卡片。技能正文里写的任何「请执行某某命令」都要走同一套 bash 策略。
```
**既有 §六（`:78-87`）的 `allowed-tools` 段也已存在**（「`allowed-tools` 在当前 SDK 不存在该字段…任何展示 `allowed-tools` 的地方都是虚假安全感」）。

**⚠️ 表述冲突（RESEARCH Q3）：** §五 现有「bash 的**三档**权限」字面。加上 install 档后推荐 **(ii) 保持三档框架** ——
写成「强制确认档（第三档）有**两个互不包含的触发源**：危险命令表（本机破坏）与包管理器安装表（网络取第三方代码）」。
理由：`evaluateBashCommand` 的 `level` 只有 `allow` / `confirm` 两个值，**实现上确实还是三档**（`reason` 是档内细分）；
改称四档会牵连 `ai-agent-workspace.md §四` 的**标题**（就是「bash：三档权限」）与 Phase 46 历史文档。

**新增章节（建议插在 `## 七、测试与验证` 之前，编号顺延）：**
- `## 八、内置技能` —— ① 随包两个技能与各自许可证；② **自愈式播种语义**（每次启动按单技能目录粒度无条件覆盖 `managed-skills/<name>/`）；③ **seeded 身份来源**（扫随包 `skills-builtin/` 目录名集合，非状态文件、非目录位置）；④ **不能删改只能禁用**（`settings.aiSkills.disabled`）；⑤ 用户定制内置技能的正确通道是 `skills/` 同名遮蔽；⑥ **零安装语义**（find-skills 只输出候选清单，安装入口在设置页）
- `## 九、bash 包管理器安装档` —— ① 强制确认档的第二个触发源；② 覆盖的包管理器家族清单；③ **白名单不可越过**；④ `riskLevel = high` 与专属文案；⑤ **脚本执行的确认成本**（`node`/`python3` 命中 `DANGEROUS_INTERPRETERS` → 每次跑技能脚本必弹卡，这是 SKILL-09「零新增权限机制」的必然结果）

**§六 已知限制 建议补一条**（RESEARCH V5 提出）：`REALM_SKILL_CREATOR_PYTHON` 由用户自己设置，**设置该变量等于授权 Realm 执行该路径的程序**。
**§七 测试与验证 需补** `node tests/test-builtin-skills-seeder.js`。

---

### 10. `docs/product/ai-agent-workspace.md`（doc，修改）

**Analog:** 自身 §四（`:61-73`）与 §七（`:89-94`）

**§四 现状（`:65-71`，逐字）— 表格第 3 行与「危险命令表」段是改动对象：**
```
| 档 | 判定 | 结果 |
|----|------|------|
| ① 免确认 | 所有段命中白名单 | 自动执行 |
| ② 默认确认 | 未命中白名单 | 弹确认卡片（中风险），卡片完整展示命令原文 |
| ③ 强制确认 | 任一段命中危险命令表 | 弹确认卡片（高风险），**加入白名单也无效** |

**危险命令表**（强制确认，语义是「必须用户点头」而非「拒绝」）：rm 全系、sudo、su、dd/mkfs、kill/killall/pkill、shutdown/reboot/halt、hdiutil/diskutil/launchctl 等系统配置工具、chmod/chown/chflags、defaults write、重定向覆盖系统路径（`> /非tmp`），以及管道/组合中把任意文本当代码执行的解释器（sh/bash/zsh/eval/source/osascript/python/node/ruby/perl）。
```
→ 第 3 行判定改为「任一段命中**危险命令表**或**包管理器安装表**」，并追加「强制确认档的两个触发源（互不包含）」小节，
逐条列出 install 家族与**只读子命令不在此表内**（`npm run|test|ls|view|audit|outdated`、`brew info|list|search`、`pip list|show` 等）。
**同步改**：`:80` 的白名单「使用建议」句里 `brew` 的例子需要复核（`brew` 裸条目仍覆盖 `brew info`，但 `brew install` 现在强制确认）。

**§七 现状（`:89-94`，逐字）— 建议新增第 5 条（诚实边界，Claude's Discretion 交 plan 期）：**
```
- **read/write/edit**：硬边界，模型无论被何种提示注入诱导都无法越界
- **bash**：能力等同终端（确认后什么都行），安全依赖「卡片所见即所确认」；静态拆段无法覆盖全部 shell 语法（进程替换、命令替换 `$()` 等），白名单判定是「降低误执行概率」的启发式，**不是安全边界**
- **提示注入下的人因风险**：恶意网页诱导 AI 执行的 bash 命令同样会弹卡，但用户若不看内容直接点确认则防线失效——请养成读卡片上命令原文的习惯
- **OS 级隔离**（macOS sandbox-exec 限制 bash 可访问路径）为预留的后续增强方向，当前未实施
```
→ 第 5 条：「**安装档只审一级 bash 命令**：策略引擎看的是用户在卡片上看到的那条命令。若该命令内部再 `spawn` 子进程
（如 `check_env.mjs` 内部 `spawnSync` 调 `python3`），二次调用不在策略视野内 —— 由用户对第一条命令的确认承担。」
（**⚠️ 新条目的序号是「第 5 条」，既有 4 条一字不动。**）

**§八 测试与验证 需补** 播种与 install 档的测试命令。

---

### 11. `AGENTS.md`（doc，修改）

**Analog:** 自身 `### AI 工作区与 Bash 权限（agent 根目录 + SDK 内置工具）` 小节

**既有文本（逐字）— 「Bash 三档权限」那一条是改动对象：**
```
- **Bash 三档权限**（`ai-bash-policy.js` 纯函数引擎，`evaluateBashCommand`）：① 白名单命中 → 免确认（主流前缀语义…）；② 默认 → 弹确认卡片；③ 危险段（`DANGEROUS_PATTERNS` 词边界正则：rm 全系/sudo/dd/kill/chmod/重定向覆盖系统路径等 + `DANGEROUS_INTERPRETERS` 管道右侧 sh/node/python 等）→ 强制确认，**进白名单也无效**。
```
→ 改为「③ 强制确认 —— 两个互不包含的触发源：**危险段**（`DANGEROUS_PATTERNS` … + `DANGEROUS_INTERPRETERS` …）与
**包管理器安装段**（`PACKAGE_MANAGER_INSTALL_PATTERNS`：npx / npm i|install|ci|exec / pnpm·yarn·bun add / pip install / uv·uvx / brew install|upgrade / cargo·go·gem install），
两者**进白名单也无效**（`reason` 分别为 `danger` / `install`，均 `riskLevel: 'high'`）。」

**该小节末尾「测试：」行需补**（既有形态：`- 测试：node tests/test-agent-workspace.js（沙箱/迁移，21 例）、node tests/test-ai-bash-policy.js（策略引擎，29 例）`）→
把过时的「29 例」改为实测的「32 例 → 新增 install 档用例」，并追加 `node tests/test-builtin-skills-seeder.js（播种/差异诊断/零安装语义，新增）`。

**另需新增 3 条（RESEARCH F-3 逐字给出）：** ① 内置技能（随包分发 `skills-builtin/`，asarUnpack + `app.isPackaged` 分支，自愈式播种，seeded 身份 = 随包目录名集合）；
② 技能不构成额外权限 + `allowed-tools` 当前不被强制、仅供参考；③ 随包静态技能目录的维护约定（改 `skills-builtin/**` 必须同步核对 `THIRD_PARTY_NOTICES` 的五要素 + 跑零安装语义扫描）。

---

### 12. `THIRD_PARTY_NOTICES.md`（doc，新建）

**仓库内 analog：无**（`git ls-files | grep -iE "^(THIRD|LICENSE|NOTICE)"` → 零结果；仓库根无 LICENSE 文件，`package.json:30` 只有 `"license": "MIT"` 声明）。

**体例参照：`docs/product/*.md`**（Markdown 表格体例）。
**落点与形态（RESEARCH F-4 建议）：** repo 根 `THIRD_PARTY_NOTICES.md`（带 `.md`；P10 的判据是「归属完整」而非文件名）。
**随包：** `files: []` 语义下 repo 根文件天然入包（实测 asar 顶层含 `AGENTS.md` / `CLAUDE.md` / `Makefile`）；
**但若采纳 `build.files` allowlist（方案 A），必须显式列入它，否则 P10 变纸面合规。**

**每条记录的**五要素**（P10 阻断判据，缺一不闭合）：** 来源仓库 URL + 固定 commit SHA + 许可证 + 是否修改 + 修改说明。
另加「许可证副本」行指向技能目录内的 `LICENSE.txt`。

**已实测的固定值（可直接写入，防手误）：**
| 技能 | 来源仓库 | 固定 SHA（`path=` 过滤取到的那个，**不是 HEAD**） | SHA 时点 | 许可证 |
|------|----------|------------------------------------------------|---------|--------|
| find-skills | `https://github.com/vercel-labs/skills` | `773fb2c7bbf16781670a3520affc4abd0c6151ae` | 2026-07-10 | MIT |
| skill-creator | `https://github.com/anthropics/skills` | `b0cbd3df1533b396d281a6886d5132f623393a9c` | 2026-03-06 | Apache-2.0（`LICENSE.txt` 11,357 B） |

**find-skills 必须标 `modified`**（D-17 强制），修改说明具体到「移除全部 CLI 与安装语义、改为 `web_fetch` 查 GitHub 搜索 API、正文改中文、新增禁令段」。
**skill-creator 的 `modified` / `unmodified` 取决于 plan 期对 Q1/Q2 的拍板**（见下）；若判 `modified`，除本文件外**还必须按 Apache-2.0 §4(b) 在 `SKILL.md` 文首加一行显著修改声明**。
**另需一节说明 Python 运行时依赖（`pyyaml` / `anthropic`）不由 Realm 分发**，故不适用本文件的归属义务。

---

## Shared Patterns

### A. 诊断形状（跨 `builtin-skills-seeder.js` / `tests/test-builtin-skills-seeder.js` / Phase 50 消费）

**Source:** `ai-skills-manager.js:255-263`（`toRealmDiag`，逐字）
```js
function toRealmDiag(d) {
  return {
    level: d.type === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    path: d.path,
    source: d.source,
  };
}
```

**Source:** `ai-skills-manager.js:236-239`（`pushEntryDiag` / `pushError` 的容器语义，逐字）
```js
function pushEntryDiag(entry, diag) {
  if (entry && Array.isArray(entry.diagnostics)) entry.diagnostics.push(diag);
  _cache.diagnostics.push(diag);
}
```
```js
function pushError(errDiag) {
  _cache.errors.push(errDiag);
}
```

**Source:** `ai-skills-manager.js:499-506`（限额族带**可操作字段** `limit` / `currentValue`，逐字）
```js
    const oversizeDiags = oversize.map((n) => ({
      level: 'error',
      code: 'realm_skill_md_too_large',
      message: `SKILL.md 超过正文上限：限额 ${n.limit} 字节，当前 ${n.currentValue} 字节（${n.path}）`,
      path: n.path,
      limit: n.limit,
      currentValue: n.currentValue,
    }));
```

**Source:** `ai-skills-manager.js:530-536`（warning 级诊断**必须给出「正确做法」**，逐字）
```js
        _cache.diagnostics.push({
          level: 'warning',
          code: 'realm_layout_violation',
          message: `技能 "${entry.skill.name}" 的布局不符合契约：实际 ${entryPath}；技能必须放在 <扫描根>/<技能名>/SKILL.md，不能有中间层目录（正确位置示例：${suggested}）`,
          path: entryPath,
          source: entry.source,
        });
```

**播种的 4 个新 code（沿用 `realm_` 前缀与 SDK 枚举区分）：**
| code | level | 触发 | 必需字段 |
|------|-------|------|----------|
| `realm_builtin_src_missing` | error | 随包 `skills-builtin/` 不存在或不可读 | `path` |
| `realm_builtin_seed_overwritten` | **warning** | D-09：磁盘内容与随包内容不一致，即将覆盖 | `path`、`skillName`、`message` 含「已被随包版本覆盖」+ 正确做法（`skills/` 同名遮蔽 / 设置页禁用） |
| `realm_builtin_seed_failed` | error | 单技能目录播种失败 | `path`、`skillName`、`message` 含原始错误 |
| `realm_builtin_src_invalid` | error | 源目录下某目录缺 `SKILL.md` | `path` |

**应用范围：** 全部播种诊断。**D-09 的诊断必须是 `warning` 不是 `error`**（覆盖照常完成，功能未降级）。

### B. 非阻断启动 + 同步调用（跨 `main.js` / `builtin-skills-seeder.js`）

**Source:** `agent-workspace.js:142-144`（逐字）—— 任何失败 `console.error` + 产诊断 + **不 throw、不阻断启动**：
```js
  } catch (err) {
    console.error('[Realm] AI 记忆迁移失败（保留旧目录，下次启动重试）:', err.message);
  }
```
**应用范围：** `seedBuiltinSkills()` 整体与每个技能目录的同步。播种调用点必须同步（`main.js:4041` 与 `:4043` 之间，两者都是同步 `fs`）。

### C. 惰性 electron require（跨 `builtin-skills-seeder.js`；`favorites-manager.js` 同款先例）

**Source:** `agent-workspace.js:17-19` + `:38-42`（逐字）
```js
 * electron 依赖惰性获取（与 ai-memory-manager.js 先例一致）：纯 Node
 * 测试环境下 require('electron') 不可加载，延迟到真正需要路径时才 require。
```
```js
function getWorkspaceDir() {
  if (_workspaceDirOverride) return _workspaceDirOverride;
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'agent-workspace');
}
```
**应用范围：** `resolveBuiltinSkillsSrc()` 的 `require('electron').app.isPackaged` 必须放**函数体内**（RESEARCH D-2 的写法已如此）。
**反例（禁止）：** 在 `agent-workspace.js` 里 `require('electron')` —— 会让 `tests/test-agent-workspace.js` 的 21 例纯 Node 测试无法运行。

### D. 测试临时目录注入（跨 `tests/test-builtin-skills-seeder.js` / `tests/test-ai-bash-policy.js`）

**Source:** `tests/test-agent-workspace.js:21-32` + `tests/test-ai-skills.js:24-37`（逐字，见上）
**契约：** 每个测试文件自带 `withTempRoot(t)`；`t.after` 里 `fs.rmSync(dir, { recursive: true, force: true })` + **恢复所有覆写为 `null`**；
**模块级 `_cache` 跨用例污染**必须调 `_resetCacheForTest()`（`ai-skills-manager.js` 已有的 `_` 前缀测试钩子先例，导出块里唯一的下划线成员）。
**应用范围：** 一切触碰 userData 的模块。新增播种模块必须提供等价的注入器与 `_resetForTest`。

### E. 源码扫描型断言（P1-b-4）

**Source:** `tests/test-ai-skills.js:48-73`（`readSource` / `functionBody` / `methodBody`，逐字见上）
**应用范围：** `ai-manager.js` 的 `_createBashToolWithPolicy`（P1-b-4）；`ai-bash-policy.js` 的 `DANGEROUS_INTERPRETERS` 含 `node`/`python3`（SKILL-09 的**反向证据** —— 证明零新增权限机制）。

### F. asar 路径分支（`builtin-skills-seeder.js` 与 `package.json` 双侧一致）

**Source:** `favorites-manager.js:285-299`（逐字见上）
**三条不变式：** ① 打包态一律 `path.join(process.resourcesPath, 'app.asar.unpacked', ...)`，**不用 `__dirname`**（打包后含义不同，AGENTS.md 已明文约定）；
② 开发态**显式回落 `__dirname`**；③ 两处配置必须成对：`package.json` 的 `asarUnpack` 加 `"skills-builtin/**"` ↔ 运行时读 `app.asar.unpacked/skills-builtin`。

---

## No Analog Found

仓库内**完全没有**同型先例的文件（planner 直接用 RESEARCH.md 的 Pattern/Code Examples 落地）：

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `skills-builtin/find-skills/SKILL.md` | config（技能正文） | static-asset | `git ls-files \| grep -i 'SKILL\.md'` → **零结果**；仓库内无任何技能文件（技能一直只存在于 userData）。写法见 RESEARCH A-3 提纲 + A-4 禁用词表 |
| `skills-builtin/skill-creator/**`（上游快照 18-19 文件） | config | static-asset | 同上；且是**上游逐字副本**，形状由上游决定不由 Realm 决定。下载与改写判断见 RESEARCH B-1 / B-2 / B-5 |
| `skills-builtin/{find-skills,skill-creator}/LICENSE.txt` | config | static-asset | 仓库根**无 LICENSE 文件**（`git ls-files` 零结果）；`package.json:30` 只有 `"license": "MIT"` 字段。许可证文本必须**逐字保留上游原文**，不得自写摘要 |
| `skills-builtin/skill-creator/scripts/check_env.mjs` | utility（CLI 探针） | subprocess / transform | `git ls-files \| grep '\.mjs$'` → **零结果**（仓库无 ESM 脚本）；改用 RESEARCH Pattern 5 对照表 + 外部参照实现（`/Volumes/ZhiTai/.../check_env.mjs`，**仓库外，仅供形状参照**） |
| `THIRD_PARTY_NOTICES.md` | doc | static-asset | 无任何 THIRD_PARTY / LICENSE / NOTICE 先例；体例取 `docs/product/*.md` 的 Markdown 表格。内容五要素见 RESEARCH F-4 模板 |

---

## Metadata

**Analog search scope:** 仓库根（CJS 主进程模块）、`tests/`、`docs/product/`、`package.json` / `Makefile`；另读仓库外参照实现（`/Volumes/ZhiTai/Projects/github/openhanako/`：`core/first-run.ts`、`shared/safe-fs.ts`、`skills2set/skill-creator/scripts/check_env.mjs`）——**仅算法形状参照，不引入依赖、不写入实现路径**。

**Files scanned（仓库内）:** `ai-bash-policy.js`（263 行，全文）、`tests/test-ai-bash-policy.js`（222 行，全文）、`agent-workspace.js`（关键段 + 导出块）、`ai-skills-manager.js`（诊断段 + 导出块）、`ai-manager.js:5622-5701`、`main.js:4030-4059`、`favorites-manager.js:275-314`、`package.json`（build 段）、`tests/test-agent-workspace.js:1-150`、`tests/test-ai-skills.js:1-100`、`docs/product/ai-skills.md`（结构 + §四-七）、`docs/product/ai-agent-workspace.md`（§四-八）。

**Tracked-source 验证：** 13 个仓库内路径全部经 `git ls-files -- <path>` 确认为已追踪（`AGENTS.md` / `Makefile` / `agent-workspace.js` / `ai-bash-policy.js` / `ai-manager.js` / `ai-skills-manager.js` / `docs/product/ai-agent-workspace.md` / `docs/product/ai-skills.md` / `favorites-manager.js` / `main.js` / `package.json` / `tests/test-agent-workspace.js` / `tests/test-ai-bash-policy.js` / `tests/test-ai-skills.js`）。无 gitignored 镜像（`.gsd/capabilities/*`）被误当作 analog。

**Pattern extraction date:** 2026-09-11

**Planner 需在 plan 期显式拍板的 4 个开放点（PATTERNS 不代替决策，仅标出落点）：**
1. **Q1**：上游 `agents/` 目录（3 文件 / 26,712 B）是否随包 —— 影响 `THIRD_PARTY_NOTICES` 的 skill-creator 条目表述（不随包则**不能标 `unmodified`**）
2. **Q2**：skill-creator 标 `modified` 还是 `unmodified` —— 若按 B-2 删除 `present_files` / Claude.ai / Cowork 三章则为 `modified` + `SKILL.md` 文首修改声明（fail-safe 方向：建议一律标 modified）
3. **Q4**：`build.files` 加不加排除项（最小成本是加 5 条 `!` 排除 `.planning` / `.claude` / `.gsd` / `.wzsh` / `.zcode`）—— **无论选哪条都必须在计划 Risks 段留痕**；若选完整 allowlist，`skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md` 必须在内
4. **Pitfall 1 路线 (A) vs (B)**：`allow` 分支是否带 `installNames` —— 决定是否改 `tests/test-ai-bash-policy.js:159-164` 两条 `deepStrictEqual`

**另需注意的执行期 checkpoint（RESEARCH Pitfall 3）：** `/Applications/Realm.app` 当前正在运行（`pgrep -fl Realm` 返回 10 条），
`make install` 第一步 `rm -rf` 会删掉运行中的 bundle。**必须作为不可跳过的前置 checkpoint：先 `pgrep` 确认无用户实例（有则请用户自行退出，不要代劳 kill）；清理只按自身 PID；优先走 `make install-nightly` 避开正式版。**

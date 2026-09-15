# Phase 51: 用户技能导入管线（zip + 网络地址） - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 20（新增 5 类落点 + 修改 15 个既有文件）
**Analogs found:** 16 / 20（4 项无仓内 analog，须按 RESEARCH.md 从零实现）

> **analog 路径均为 git 已追踪源**：本文件引用的每一个文件都由 `git ls-files -- <path>` 确认为受追踪源（工作树干净，`git ls-files --others --exclude-standard` 为空），无 gitignored 安装/运行期镜像路径。
> 唯一的**未追踪落点**是 `tests/helpers/**` 与 `tests/fixtures/**`（**当前不存在**，是本阶段要新建的目录）—— 不是镜像问题，是全新目录，见「No Analog Found」。

---

## File Classification

| 新增/修改文件 | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ai-skills-manager.js`（新增导入面段落） | service / manager（单一数据权威，零 electron） | CRUD + file-I/O + transform | 同文件既有 `createManagedSkill` / `deleteUserSkill` / `validateSkillFileSize`（自举） | exact（同文件同族写路径） |
| `agent-workspace.js`（新增 `resolveInsideForWrite` + 切写面） | middleware / guard（路径边界） | request-response（同步判据） | 同文件 `resolveInside`（`:162`）+ `createSandboxEnv` 的 `guard`（`:225`） | exact（同文件同函数族） |
| `ai-manager.js`（导入转发 + `ensureSkillsFresh()` + 调用侧补播） | service（转发层） | request-response | `setSkillDisabled()`（`:1628`）/ `uninstallUserSkill()`（`:1683`） | exact |
| `main.js`（`handleSkillsApi` 加 `import` 分支 + `readRawBody` + 常量） | controller（HTTP handler，纯转发） | request-response + streaming（raw body） | `readJsonBody`（`:936`）/ `handleSkillsApi`（`:2831`）/ `/api/favorites/import-html`（`:1256`） | exact |
| `src/settings.html`（导入按钮 + 弹框 DOM） | view（markup） | — | `#skillManageConfirm` 弹框（`:555`）/ `rulesFileInput`（`:197`） | exact |
| `src/settings-page.js`（弹框逻辑 + `skillsApi('import')` + 文件选择） | view controller（guest 前端） | request-response + file-I/O（`File` 对象） | `skillsApi`（`:4874`）/ `handleFileSelect`（`:781`）/ `openSkillUninstallConfirm`（`:5427`） | exact |
| `src/styles/main.css`（`.skill-import-*` 专属段） | style | — | 50 的 `.skill-manage-*` 专属段（同文件末尾） | exact |
| `package.json`（`yauzl@^3.4.0` + `yaml` 精确 `2.9.0`） | config | — | 既有 `dependencies` 段 + `build.files` / `build.asarUnpack` | exact |
| `tests/test-skills-import.js` | test | unit + integration（真 fs） | `tests/test-manage-skill.js`（值域矩阵 + 真 fs 沙箱 harness） | exact |
| `tests/test-skills-import-net.js` | test | unit（本地 stub server） | `tests/test-skills-http-api.js` 的 `http.createServer` harness（`:410-551`） | role-match |
| `tests/test-agent-workspace.js`（增补 SEC-10） | test | unit | 同文件 `withTempRoot`（`:22`）+ symlink 用例（`:157`） | exact |
| `tests/test-skills-http-api.js`（增补新路由 + `readRawBody` 413） | test | unit（HTTP 传输层 + 源码扫描） | 同文件 SEC-09 四组（`:450-551`）+ 源码契约组（`:553-617`） | exact |
| `tests/test-ai-skills.js`（增补 `SKILL_THREAT_PATTERNS` 值域 + D-19 计数） | test | unit | 同文件 M/L 组 + `mkdtempSync` harness（`:35`） | exact |
| `tests/helpers/make-malicious-zip.js`（夹具生成器） | utility（测试夹具） | file-I/O（二进制写盘） | **无** | none |
| `tests/fixtures/skill-packages/**` | test data | — | **无** | none |
| `docs/product/ai-skills.md`（新增导入章节 + 安全边界定稿） | doc | — | 同文件 §10.7 / §11.6 / §12.6「诚实边界」三节 | exact |
| `docs/product/ai-agent-workspace.md`（SEC-10 行为变更披露） | doc | — | §七 安全边界（`:122`） | exact |
| `AGENTS.md`（维护约定 + 测试清单） | doc | — | `:330` 测试行 / `:335-337` 三块维护约定 | exact |
| zip 解析 / 解压 / inflate / central directory | — | streaming | **无**（`yauzl@^3.4.0` 新依赖） | none |
| 二进制流式下载 + 逐跳白名单 | — | streaming | `search-manager.fetchUrl`（**:反面参照**，Anti-Pattern 7） | none（禁用） |
| `importId` 两阶段句柄 + TTL + 崩溃清扫 | service（状态） | request-response | `main.js` 模块级 `currentImportAbortController`（`:1237`，partial）+ `builtin-skills-seeder.sweepSeedResidue`（`:255`，partial） | role-match（须补 TTL） |
| SSRF 判据 | utility | sync | `search-manager.isPrivateHost`（`:195`，**直接复用**） | exact |
| 威胁扫描 | utility | transform | `ai-memory-manager.scanInjectionPatterns`（`:88`，**直接复用**）+ `ai-skills-manager.scanSkillText`（`:1537`，扩表点） | exact |
| 解压后递归 `lstat` 复核整棵树 | utility | file-I/O | `builtin-skills-seeder.assertNoSymlink`（`:277`）+ `ai-skills-manager.measureSkillDir`（`:551`） | role-match |

---

## Pattern Assignments

### `ai-skills-manager.js` —— 导入面（service / manager，CRUD + file-I/O + transform）

**Analog:** 同文件既有写路径（`createManagedSkill` / `deleteUserSkill` / `atomicWriteSkillFile` / `validateSkillFileSize`）

> **落点依据**：`51-RESEARCH.md` §Recommended Project Structure（`:406-432`）把 `IMPORT_LIMITS` / `SKILL_THREAT_PATTERNS` / `classifyImportUrl()` / `downloadPackage()` / `extractAndValidatePackage()` / `previewSkillImport()` / `importUserSkill()` **全部放在本文件**。若 planner 决定拆成新模块（如 `skill-import.js`），则新模块**必须同样零 electron 依赖**（见「三条容易抄错的点」第 2 条），且**仍须满足「只有一个落盘实现」的源码扫描判据**。

**① 模块头依赖纪律（新段落的注释必须写同样的三句）**（`:18-21`）：
```js
 * 依赖纪律：本模块**不得**有 electron 依赖、不得顶层 import SDK（SDK 为
 * ESM-only，一律用包根动态 import）；也不得直接引入 SDK 的传递依赖
 * （其 frontmatter 解析与忽略文件匹配实现只经 SDK 往返获得，不自行引入）。
```
⚠️ **本阶段要改这句话**：D-14 把 `yaml` 提升为**直接依赖**并要求自行解析 frontmatter ⇒ 「不得直接引入 SDK 的传递依赖」这条对 `yaml` 失效，注释须显式豁免并写明理由（避免后续开发者按旧注释把它删掉）。`yauzl` 同理（首次引入 zip 库）。

**② 限额常量单源 + 「只允许加项」**（`:48-54`）：
```js
const LIMITS = {
  MAX_SKILL_MD_BYTES: 64 * 1024,
  MAX_USER_SKILLS: 50,
  SKILLS_PROMPT_CHAR_BUDGET: 8000,
  MAX_MANAGED_SKILLS: 50,
  MAX_SKILL_DESCRIPTION_CHARS: 1024,
};
```
配套（`:62` / `:65`）：
```js
const MAX_SKILL_NAME_CHARS = 64;
const MANAGED_SKILL_NAME_RE = /^[a-z0-9-]+$/;
```
遍历护栏（`:83` / `:86`，**CR-4 要求深度口径对齐的先例值**）：
```js
const SKILL_SIZE_WALK_MAX_ENTRIES = 5000;
const SKILL_SIZE_WALK_MAX_DEPTH = 16;
```
**新导入限额的落法**：`IMPORT_LIMITS`（独立常量，推荐）或 `LIMITS` 加项 —— 后者**不得改既有五项数值**。注意 `MAX_SKILL_PACKAGE_BYTES` 属 `main.js` 侧（body 读取用），与解压累计闸**同值不同量**，命名必须区分 `MAX_JSON_BODY_BYTES_LARGE`（见 main.js 段）。额度一律经管理投影投影给设置页，**端点与前端零字面量**。

**③ 惰性 require 的既有模式（新段落需要路径/扫描时照抄）**（`:136-149`）：
```js
function getAiMemoryManagerLazy() {
  return require('./ai-memory-manager');
}

function getAgentWorkspaceLazy() {
  return require('./agent-workspace');
}
```

**④ 尺寸/深度遍历 + symlink 显式跳过（预览的目录树与「解压后递归 lstat」同族）**（`:566-613`）：
```js
  const walk = async (p, depth) => {
    const res = await env.listDir(p);
    if (!res || res.ok !== true || !Array.isArray(res.value)) {
      errors.push({ level: 'warning', code: 'realm_skill_dir_unreadable', message: `…${p}（沙箱码 ${sandboxErrorCode(res)}）`, path: p });
      return;
    }
    for (const e of res.value) {
      if (tooManyEntries || tooDeep) return;
      if (e.kind === 'symlink') continue;   // 内部链接可穿入 ⇒ 跟随即无限递归
      if (e.name.startsWith('.')) continue;
      seenEntries += 1;
      if (seenEntries > SKILL_SIZE_WALK_MAX_ENTRIES) { tooManyEntries = true; return; }
      if (e.kind === 'directory') {
        if (depth >= SKILL_SIZE_WALK_MAX_DEPTH) { tooDeep = true; return; }
        await walk(path.join(p, e.name), depth + 1);
        continue;
      }
      if (e.kind === 'file') { bytes += Number.isFinite(e.size) ? e.size : 0; fileCount += 1; }
    }
  };
```
**两处差异必须写明**（D-17 第 2 层 vs 本函数的语义相反）：本函数对 symlink 是 **`continue`（跳过，为统计）**；D-17 的第 2 层复核要求命中 symlink 即**拒绝整包**（`assertNoSymlink` 的语义，见下）。二者不可混抄。另：`env.listDir` 的 entry 形状是 `{ name, path, kind, size, mtimeMs }`，判目录用 **`kind === 'directory'`**，不是 `isDirectory()`。

**⑤ 错误码常量（新码**必须**另立 `IMPORT_SKILL_ERROR`）**（`:1200-1212`）：
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
  NOT_USER_OWNED: 'not_user_owned',
};
```
⚠️ **本表被 `tests/test-manage-skill.js:1589` 锁死为恰 11 键**（值集合逐字锁定，`:1605` 的失败信息逐字写着「不得再新立第十二键」）⇒ 导入码**一律进新常量 `IMPORT_SKILL_ERROR`**（CR-3 / 50 D-08 的加码纪律：常量 + 产品文档错误码表 + `AGENTS.md` 测试清单三处一起刷）。

**⑥ 错误构造的唯一形式（业务失败一律 throw）**（`:1226-1231`）：
```js
function makeManageSkillError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}
```

**⑦ seeded 判定（**只查注入集合，不查磁盘**）**（`:1243-1246`）：
```js
function isSeededName(name, seededNames) {
  const set = seededNames instanceof Set ? seededNames : new Set(seededNames || []);
  return set.has(name);
}
```

**⑧ 写入门校验器（**改名复用这一份，不得另写第二份**）**（`:1269-1298`）：
```js
function validateManagedSkillName(name) {
  if (typeof name !== 'string') return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名必须是字符串' };
  const value = name.trim();
  if (!value) return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名不能为空' };
  if (value.length > MAX_SKILL_NAME_CHARS) return { ok: false, code: …INVALID_NAME, reason: `技能名不能超过 ${MAX_SKILL_NAME_CHARS} 个字符（当前 ${value.length} 个）` };
  if (!MANAGED_SKILL_NAME_RE.test(value)) return { ok: false, code: …INVALID_NAME, reason: '技能名只能包含小写字母、数字与连字符（a-z、0-9、-），例如 my-workflow' };
  if (value.startsWith('-') || value.endsWith('-')) return { ok: false, code: …INVALID_NAME, reason: '技能名不能以连字符开头或结尾' };
  if (value.includes('--')) return { ok: false, code: …INVALID_NAME, reason: '技能名不能包含连续的连字符' };
  return { ok: true };
}
```
D-08 的「改名」走**这一份**（`IMPORT_SKILL_ERROR.INVALID_NAME` 若需要区分，也必须在**同一处**决定，不许在导入段落再写一份正则）。

**⑨ 扫描单点（D-12 **只扩表、不加接线**）**（`:1537-1545`）：
```js
function scanSkillText(text, { includeCredentials = true } = {}) {
  const result = getAiMemoryManagerLazy().scanInjectionPatterns(text, { includeCredentials });
  if (!result || result.safe !== true) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNSCANNABLE,
      `技能内容被拒绝：${(result && result.reason) || '命中安全扫描'}。请调整措辞后重试`
    );
  }
}
```
**扩表位置**：新增的 `SKILL_THREAT_PATTERNS`（技能域三类）落**本文件**，与 `INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS`（原表在 `ai-memory-manager.js:34-63`）**分表**；因为技能域三类的效力是「**不拒绝**、高亮 + 必勾」（D-12），与 `scanSkillText` 的 throw 语义不同 ⇒ 需要**并列的第二个扫描函数**（返回命中列表而非 throw），不得把三类塞进 `scanInjectionPatterns` 的 hard-fail 表。⚠️ 扩表会**连带改变 49 的 `manage_skill` 写入行为**（49 D-08 的交接契约，须成文）。

**⑩ 组装全文 + 权威字节闸（判据对象 = 组装后全文）**（`:1564-1567` / `:1591-1605`）：
```js
function buildSkillFileText({ name, description, content }) {
  const body = String(content == null ? '' : content).replace(LEADING_FRONTMATTER_RE, '');
  return `---\nname: ${name}\ndescription: ${yamlScalar(description)}\n---\n\n${body}`;
}

function validateSkillFileSize({ name, description, content }) {
  const text = buildSkillFileText({ name, description, content });
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > LIMITS.MAX_SKILL_MD_BYTES) {
    return { ok: false, code: MANAGE_SKILL_ERROR.OVERSIZE,
      reason: `技能文件超过上限：限额 ${LIMITS.MAX_SKILL_MD_BYTES} 字节，当前 ${bytes} 字节（按 frontmatter + 正文的整文件计）`,
      limit: LIMITS.MAX_SKILL_MD_BYTES, currentValue: bytes };
  }
  return { ok: true, text };
}
```
D-11 要求：**导入的技能必须在落盘前按这一份口径预筛**（包内的 `SKILL.md` 已是组装后形态 ⇒ 按包内文件字节判），否则会产出「落盘成功但整条被加载管线跳过」的**幽灵技能**。⚠️ 导入的 `description` 来自**不可信包**，`yamlScalar` 的编码必要性同样成立。

**⑪ 沙箱 Result → 业务错误的折叠**（`:1608-1610`）：
```js
function sandboxErrorCode(result) {
  return (result && result.error && result.error.code) || MANAGE_SKILL_ERROR.UNKNOWN;
}
```

**⑫ 原子写（tmp → rename）与失败清理**（`:1634-1666`）：
```js
async function atomicWriteSkillFile(env, destFile, text) {
  if (typeof destFile !== 'string' || !destFile.trim()) {
    throw makeManageSkillError(MANAGE_SKILL_ERROR.UNKNOWN, '技能文件目标路径非法（空路径不做任何 IO）');
  }
  const tmp = await env.createTempFile({ prefix: 'skill-', suffix: '.md' });
  if (!tmp || tmp.ok !== true) throw makeManageSkillError(…UNKNOWN, `创建技能临时文件失败（沙箱码 ${sandboxErrorCode(tmp)}）`);
  const written = await env.writeFile(tmp.value, text);
  if (!written || written.ok !== true) { await env.remove(tmp.value, { force: true }); throw …(…UNKNOWN, `写入技能临时文件失败（沙箱码 ${sandboxErrorCode(written)}）`); }
  const renamed = await env.renameFile(tmp.value, destFile);
  if (!renamed || renamed.ok !== true) { await env.remove(tmp.value, { force: true }); throw …(…UNKNOWN, `技能文件落盘失败：目标路径 ${destFile}（沙箱码 ${sandboxErrorCode(renamed)}）`); }
}
```
**导入的落盘是「目录级」的两段 rename**（D-09），形态照抄的是**这段的「失败必须清理 + 错误折叠」语义**，不是它的文件级实现；配方见下方「Pattern 6 的实测配方」。

**⑬ 路径恒由 `path.join` 计算（不吃 `path` 参数）**（`:1677-1681`）：
```js
function managedSkillPaths(name) {
  const managedDir = getAgentWorkspaceLazy().getManagedSkillsDir();
  const destDir = path.join(managedDir, name);
  return { managedDir, destDir, destFile: path.join(destDir, 'SKILL.md') };
}
```
仿写：`userSkillPaths(name)` → `{ skillsDir: getAgentWorkspaceLazy().getSkillsDir(), destDir: path.join(skillsDir, name) }`。**目录名一律以校验后的 `name` 命名**（D-06 / P5：绝不用包内原始目录名拼路径）。

**⑭ 数量闸（读盘统计，失败按 0 计）**（`:1695-1703`）：
```js
async function countManagedSkills(env, managedDir, seededNames) {
  const entries = await env.listDir(managedDir);
  if (!entries || entries.ok !== true || !Array.isArray(entries.value)) return 0;
  return entries.value.filter(
    (entry) => entry && entry.kind === 'directory' && !isSeededName(entry.name, seededNames)
  ).length;
}
```
导入侧需要同形的 `countUserSkills(env, skillsDir)`（`MAX_USER_SKILLS` 闸，D-11：覆盖同名**豁免**、改名**计入**）。

**⑮ 统一的【目标判定】（D-08 的冲突策略模板）**（`:1727-1759`）：
```js
async function resolveManagedTarget(env, name, seededNames) {
  const { destDir, destFile } = managedSkillPaths(name);

  if (isSeededName(name, seededNames)) {
    return { ok: false, code: MANAGE_SKILL_ERROR.SEEDED_PROTECTED,
      message: `"${name}" 是随包内置技能，不能被覆盖或删除。请换一个名字创建新技能，或只增强你自己创建（managed）的技能` };
  }

  const userDir = path.join(getAgentWorkspaceLazy().getSkillsDir(), name);
  const existsUser = await env.exists(userDir);
  if (existsUser && existsUser.ok === true && existsUser.value === true) {
    return { ok: false, code: MANAGE_SKILL_ERROR.USER_OWNED_CONFLICT, message: `存在同名用户技能 "${name}"：…请换一个名字` };
  }

  const existsManaged = await env.exists(destDir);
  const managedPresent = existsManaged && existsManaged.ok === true && existsManaged.value === true;
  if (!managedPresent) {
    return { ok: false, code: MANAGE_SKILL_ERROR.NOT_FOUND, message: `技能 "${name}" 不存在（…）。请先用 create 创建它` };
  }
  return { ok: true, destDir, destFile };
}
```
**判定顺序本身就是语义**（D-08 要求**按来源分档**，与本函数的 managed 视角**相反**）：
1. seeded 同名 → **拒绝导入、不提供覆盖**（`seeded_protected`）；
2. `skills/<name>` 已存在 → **三选一：覆盖 / 改名 / 取消**（**绝不静默覆盖**）；
3. `managed-skills/<name>` 已存在 → **不允许覆盖**，按 46 D-06 提示「导入后该 AI 自建技能将被永久遮蔽」，允许**改名 / 取消**。
⚠️ **不得复用 `resolveManagedTarget`**（判据方向相反）—— 50 的 `deleteUserSkill`（`:2030`）与它的 JSDoc（`:1988-1995`）已明文付过这条代价，此处**只借形状**。

**⑯ 三动作的步骤顺序（导入段落必须逐字同构）**（`:1782-1873`）：
```js
async function createManagedSkill(env, { name, content, description, seededNames } = {}) {
  // 1. 三个纯校验器（name 只 trim、不 lowercase；description 的长度与类型按**原文**判）
  // 2. 先扫描（description 跑两组；content 只跑注入组）；扫的是**原文**（D-09）
  // 3. 后净化（只作用于 description）
  // 3.5 净化值复验（CR-03）
  // 4. 路径（恒由 path.join 计算）
  // 5. 撞名判定：**复用统一的目标判定**（读底盘，绝不用 createDir 的返回值）
  // 6. 数量闸（只约束 create）
  // 6.5 权威字节闸（WR-01）—— 必须在**组装之后、任何落盘之前**
  // 7. 建目录（renameFile 到缺失父目录必失败 ⇒ createDir 是硬前置）
  // 8. 原子写；失败清理**只在本次确实新建了目录时**执行
  try {
    await atomicWriteSkillFile(env, destFile, sizeCheck.text);
  } catch (err) {
    if (madeDir) await env.remove(destDir, { recursive: true });
    throw err;
  }
}
```
**导入侧的对应顺序**（D-10 / D-11 / D-12 合成）：
`包校验（含逃逸族/限额/扫描）→ frontmatter 解析 → 组装全文 + 64 KiB 预筛 → 冲突判定（读盘）→ 数量闸 → 落盘（两段 rename）→ **回读验证** → 失败回滚 + 暴露 diagnostics`。
**回读验证的失败面**必须把 `diagnostics` 原文（**含 path**）作为失败原因（D-10），**不提供「部分导入」**。

**⑰ 递归删除（`recursive` 默认 false，必须显式传）**（`:2059-2066`）：
```js
  const res = await env.remove(userDir, { recursive: true });
  if (!res || res.ok !== true) {
    throw makeManageSkillError(MANAGE_SKILL_ERROR.UNKNOWN, `卸载技能 "${skillName}" 失败（沙箱码 ${sandboxErrorCode(res)}）`);
  }
```
**回滚路径要用它**：删备份（`await env.remove(bak, { recursive: true, force: true })`，例 6 实测对 symlink 安全）。

**⑱ `module.exports` 追加位置**（`:2109-2145`）：
```js
module.exports = {
  LIMITS,
  …
  // 50-02 新增（管理写路径：仅 user 可卸载的三态判据 + 两个管理面谓词 + 第十码）
  // 注：makeManageSkillError **刻意不导出** —— 判定全在模块内，调用方只消费带 `code` 的错误对象。
  deleteUserSkill,
  validateSkillNameForManagement,
  validateDisabledListForSettings,
  MAX_DISABLED_SKILLS,
  _resetCacheForTest,
};
```
导入面在此**追加**（`IMPORT_SKILL_ERROR` / `IMPORT_LIMITS` / `SKILL_THREAT_PATTERNS` / `classifyImportUrl` / `extractAndValidatePackage` / `previewSkillImport` / `importUserSkill` / `scanSkillThreats` 等），并补一行 `// 51 新增（导入面：…）` 的归属注释（既有惯例）。

---

### `agent-workspace.js` —— `resolveInsideForWrite`（middleware / guard）

**Analog:** 同文件 `resolveInside`（`:162`）与 `createSandboxEnv` 的 `guard`（`:225`）

**① SEC-10 的缺口本体（`:182-191`，**这就是要修的那一段**）**：
```js
  // symlink 复核：仅当路径已存在时；不存在（ENOENT）词法通过即可
  try {
    const real = fs.realpathSync(abs);
    if (real === root || real === realRoot) return abs;
    if (real.startsWith(rootPrefix) || real.startsWith(realPrefix)) return abs;
    return null;
  } catch (err) {
    if (err && err.code === 'ENOENT') return abs;   // ← 缺口：只做词法校验
    // realpath 其他失败（权限等）按拒绝处理（fail-closed）
    return null;
  }
```
配套的双基准与 `path.sep` 前缀判据（`:170-180`，**新函数必须逐字沿用**）：
```js
  let realRoot = root;
  try { realRoot = fs.realpathSync(root); } catch { /* root realpath 失败 ⇒ 退化为单基准 */ }
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  const realPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (abs === root || abs === realRoot) return abs;
  const lexicallyInside = abs.startsWith(rootPrefix) || abs.startsWith(realPrefix);
  if (!lexicallyInside) return null;
```
**新函数 `resolveInsideForWrite(root, target)` 的形态**（D-15）：对**父目录链自内向外找最近已存在祖先**做 `realpathSync`，拼接剩余相对段后再与两个基准比对；**同时保留**原有词法前缀校验。**不改** `resolveInside` 对已存在路径的既有语义（既有放行/拒绝集合零变化是 SEC-10 的验收判据之一）。

**② `createSandboxEnv` 的 `guard` 与全部写面（要切换的清单）**（`:214-231` / `:265-325`）：
```js
  const deny = (p) => err(new FileError(
    'permission_denied',
    `路径越出 AI 工作区（沙箱拒绝）: ${p}。read/write/edit 只能访问工作区内的文件`,
    String(p)
  ));

  /** 单路径校验；通过返回规范化绝对路径，越界返回 null */
  const guard = (p) => resolveInside(root, p);

  /** 校验失败时返回 deny Result 的快捷判定 */
  const guardResult = (p) => (guard(p) === null ? deny(p) : null);
```
```js
    async writeFile(p, content, abortSignal) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.writeFile(p, content, abortSignal);
    },

    async appendFile(p, content) { … },

    async renameFile(sourcePath, destinationPath, abortSignal) {
      // 双路径分别校验：destination 逃逸 = 写逃逸
      const blockedSrc = guardResult(sourcePath);
      if (blockedSrc) return blockedSrc;
      const blockedDst = guardResult(destinationPath);
      if (blockedDst) return blockedDst;
      return inner.renameFile(sourcePath, destinationPath, abortSignal);
    },

    async createDir(p, opts) { … },
    async remove(p, opts) { … },
```
**切换面**（D-15 明文）：`writeFile` / `renameFile` / `createDir` / `remove` / **一切写入面**（`appendFile` 同属）。推荐的实现形态是**新增 `guardForWriteResult` 并列于 `guardResult`**，逐方法替换（而不是改 `guardResult` 本体 —— 那会连带改读面语义）。`readTextFile` / `readTextLines` / `readBinaryFile` / `fileInfo` / `listDir` / `exists` / `canonicalPath` / `absolutePath` 保持 `guardResult` 不变。
**⚠️ 诚实边界**（D-15）：加固后 `bash` 里「先 `ln -s <沙箱外路径> link` 再写 `link`」**会被拒** —— 这是正确行为但是**行为变更**，须进 `docs/product/ai-agent-workspace.md`；**沙箱内自指的 symlink 仍放行**（realpath 后仍在 root 内）。

**③ 临时目录访问器（**新代码只经这些访问器拿路径**）**（`:38-42` / `:82-84` / `:102-104` / `:113-115`）：
```js
function getWorkspaceDir() {
  if (_workspaceDirOverride) return _workspaceDirOverride;
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'agent-workspace');
}

function getTmpDir()     { return path.join(getWorkspaceDir(), '.tmp'); }
function getSkillsDir()  { return path.join(getWorkspaceDir(), 'skills'); }
function getManagedSkillsDir() { return path.join(getWorkspaceDir(), 'managed-skills'); }
```
**⑤ `createTempDir` / `createTempFile` 已重定向 `.tmp/`（导入临时区应当直接复用它的产物）**（`:327-352`）：
```js
    async createTempDir(prefix) {
      try {
        const safePrefix = 'tmp-' + sanitizeNamePart(prefix);
        const dir = await fs.promises.mkdtemp(path.join(getTmpDir(), safePrefix + '-'));
        return ok(dir);
      } catch (e) {
        return err(new FileError('unknown', `创建临时目录失败: ${e.message}`));
      }
    },
```
⚠️ **形状注意**：`createTempDir` 会把传入的 prefix 再加一层 `tmp-` 前缀（想得 `skill-import-<rand>` 须传 `'skill-import'` ⇒ 实得 `tmp-skill-import-<rand>`）。若 D-02 的目录名要与清扫正则成对，**正则必须按实际产物写**（这是 `sweepSeedResidue` 的「命名形状成对不变式」同款要求，见下）。

**④ `module.exports`**（`:378-391`）：新增 `resolveInsideForWrite` 需在此登记（`resolveInside` 已在列，供单测）。

---

### `ai-manager.js` —— 导入转发 + 刷新链收口（service，转发层）

**Analog:** 同文件 `setSkillDisabled()`（`:1628`）/ `uninstallUserSkill()`（`:1683`）

**① seeded 注入的安全点（**新方法必须经它取 seededNames**）**（`:1565-1573`）：
```js
  getSeededSkillNamesSafe() {
    try {
      const names = getBuiltinSkillsSeederLazy().getSeededSkillNames();
      return Array.isArray(names) ? names : [];
    } catch (err) {
      console.warn('[Realm AI] 读取随包内置技能名失败（seeded 判定降级为空集合）:', err.message);
      return [];
    }
  }
```
理由（`:123-131`）：`builtin-skills-seeder` 经 `agent-workspace` **间接依赖 electron**，纯 Node 下 `require('electron')` 返回字符串 ⇒ `app` 为 undefined ⇒ TypeError。**新方法不得直接调 `getSeededSkillNames()`**。

**② 转发层的形状（零判定）**（`:1603-1605`）：
```js
  getSkillsForManagement() {
    return getAiSkillsManagerLazy().getSkillsForManagement(this.getSeededSkillNamesSafe());
  }
```

**③ **D-19 的逐行模板**：卸载的收口（`ensureSkillsFresh()` + 调用侧补播）**（`:1683-1703`）**：
```js
  async uninstallUserSkill(name) {
    // ① 沙箱 env 惰性建立（createSandboxEnv 与 provider 配置无关）
    const env = this.sandboxEnv || (this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv());

    // ② 删盘：判据全在 manager（仅 user 可删的三态拒绝面），失败原样抛出
    const result = await getAiSkillsManagerLazy().deleteUserSkill(env, { name });
    const removed = result && typeof result.name === 'string' ? result.name : name;

    // ③ D-09 派生不变式（**只在删盘成功之后**）：同步读-改-写，无 await
    …

    // ④ 收口与补播：与 setSkillDisabled 同一套次数账（重扫恰一次 + 补播恰一次）
    await this.ensureSkillsFresh();
    windowManager.broadcast('skills:changed');

    // ⑤ 返回删除结果 + 最新投影
    return { ...result, management: this.getSkillsForManagement() };
  }
```
`setSkillDisabled` 的同一段（`:1650` / `:1660`）附带了**为什么必须补播**的完整论证（`:1652-1659`），**新代码应逐字复用该注释的论证**（`syncAgentSystemPrompt()` 的 `isProcessing || streaming` 分支「只置脏、return、不广播」；设置页点按钮**不经过 Agent 轮次**）。

**④ 重扫入口 `ensureSkillsFresh()`（**恰一次**语义已在函数体内）**（`:3228-3245`）：
```js
  async ensureSkillsFresh() {
    if (!this.sandboxEnv) {
      this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();
    }
    if (this.agent) {
      await this.syncAgentSystemPrompt();
      return;
    }
    await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
      disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
      rootDirs: [
        getAgentWorkspaceLazy().getManagedSkillsDir(),
        getAgentWorkspaceLazy().getSkillsDir(),
      ],
    });
  }
```
⚠️ 它**不是写路径**（读侧 / 兜底）⇒ 双账本口径：51 完成后 `syncAgentSystemPrompt()` 的**写路径**份额到 3/3，**读侧份额不并入**（不得声称 P8 6/6）。

**⑤ `syncAgentSystemPrompt()` —— 函数体逐字不得改**（`:3144-3172`）：
```js
  async syncAgentSystemPrompt() {
    if (!this.agent || !this.sandboxEnv) return;
    await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, { … });
    if (this.isProcessing || (this.agent.state && this.agent.state.isStreaming)) {
      this._skillsPromptDirty = true;
      return;
    }
    const snap = getAiSkillsManagerLazy().getSkillsSnapshot();
    const next = buildSystemPrompt();
    if (snap.digest === this._skillsPromptDigest && this.agent.state.systemPrompt === next) return;
    this._skillsPromptDigest = snap.digest;
    this.agent.state.systemPrompt = next;
    windowManager.broadcast('skills:changed');
  }
```
**46-04 的方法体源码扫描断言 + 48 的广播次数断言同时钉着它** ⇒ 导入的补播**只能在调用侧**加。

---

### `main.js` —— `handleSkillsApi` 的 `import` 分支 + `readRawBody`（controller，request-response + streaming）

**Analog:** `readJsonBody`（`:936`）/ `handleSkillsApi`（`:2831`）/ `/api/favorites/import-html`（`:1256`）

**① `readRawBody` 的逐行模板（**D-01 的承重面**）**（`:907-978`）：
```js
  function sendJson(res, status, data) {
    if (res.headersSent || res.writableEnded) return; // 已答过即 no-op（拒收路径必需）
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  function readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {}) {
    // 能力探测：`res` 的存在性与 `writeHead` 的能力**两个原始条件都要判**
    const canRespond = !!(res && typeof res.writeHead === 'function');
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;
      let rejected = false;
      const tooLarge = () => {
        rejected = true;
        if (canRespond) {
          sendJson(res, 413, { error: '请求体超过上限（' + maxBytes + ' 字节）', limit: maxBytes });
          req.resume(); // 停止累积、把剩余流排空（内存 O(1) 且 413 可达）
        }
      };
      // 快路径：`Content-Length` 预检（零字节读取即拒）。
      // ⚠️ 该头可伪造 / 可缺失 ⇒ 只作加速，**不得**取代下面的累积中判（那才是唯一判据）。
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        tooLarge();
        reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
        return;
      }
      req.on('data', (chunk) => {
        if (rejected) return; // 停止累积（关键：不再拼 body，堆不随 body 线性增长）
        size += chunk.length;
        if (size > maxBytes) {
          tooLarge();
          reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
          return;
        }
        body += chunk;
      });
      req.on('end', () => { if (rejected) return; try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); } });
      req.on('error', reject);
    });
  }
```
**`readRawBody` 的差异点（逐条照抄，一个都不能少）**：
- 唯一差别是 `chunks.push(chunk)` + **`Buffer.concat(chunks)`**（二进制），**不是**字符串拼接；
- 三条同时成立（`:916-926` 的注释逐字列出）：**累积中拒收**（`if (rejected) return;` **先于**累加 size）/ **不断连**（`req.resume()`，禁 `req.destroy()`、禁 `Connection: close`）/ **`res` 缺失降级**（`canRespond`，漏传时只 reject 不崩主进程）；
- **禁止**「先 `arrayBuffer()` 再判大小」（已吃掉内存，ROADMAP 判据 5 的判据对象是「不无上限读入内存」）。

**② 两个体积常量与命名区分**（`:880-889`）：
```js
  const MAX_JSON_BODY_BYTES = 1024 * 1024;
  const MAX_JSON_BODY_BYTES_LARGE = 32 * 1024 * 1024;
```
⚠️ 注释已明写「⚠️ 1 MiB 与 PITFALLS P7 的『单 entry 解压 ≤ 1 MB』是**同数不同量**」—— 新增的 `MAX_SKILL_PACKAGE_BYTES = 32 * 1024 * 1024` **与 `MAX_JSON_BODY_BYTES_LARGE` 同数不同量**（后者是书签导入专用），**命名必须区分**并补同款注释。
⚠️ `readJsonBody` 里 `let body = ''` 的字符串累积形态**不可**直接搬给二进制（`Buffer.concat` 是唯一正确形态）。

**③ `handleSkillsApi` 的分发骨架（`import` 分支插在 `list` 之后、404 之前）**（`:2831-2889`）：
```js
  async function handleSkillsApi(req, res, reqUrl) {
    // token 鉴权（T-50-01）：无 token / 错 token 必须在任何副作用之前 403
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/skills/', '');

      if (route === 'list' && req.method === 'GET') { … }

      if (route === 'set-disabled' && req.method === 'POST') {
        if (!aiManager) { sendJson(res, 503, { error: 'AI 服务尚未就绪' }); return; }
        const { name, disabled } = await readJsonBody(req, res);
        sendJson(res, 200, await aiManager.setSkillDisabled(name, disabled));
        return;
      }

      if (route === 'uninstall' && req.method === 'POST') { … }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 技能 API 处理失败:', err.message);
      // code 必须回传：设置页按 code 查失败文案表，**不解析 message**（UI-SPEC Copywriting 纪律）
      sendJson(res, 400, { error: err.message, code: err.code || undefined });
    }
  }
```
**`import` 分支要加的三件事**：① `!aiManager` → 503（同既有两个分支）；② **按 `Content-Type` / `mode` 分流**（zip → `readRawBody(req, res, { maxBytes: MAX_SKILL_PACKAGE_BYTES })`；json → `readJsonBody`）；③ `sendJson(res, 200, await aiManager.previewSkillImport(...) / commitSkillImport(...))`。
**⚠️ `sendJson` 的 `res.writeHead(` 计数基线被 `tests/test-skills-http-api.js:654` 冻结在 14 处** ⇒ 新分支**不得**新增响应发送点（一律走 `sendJson`）；`await readJsonBody(req` 的调用点计数基线是 **59**（`:667-678`），新增 `readRawBody` 调用点**不并入该计数**（口径不同），但若在 `import` 分支里也用 `readJsonBody`，该计数要同批刷新（三处账本一起改）。

**④ 全局分发注册（`import` 走既有前缀，无需新分支）**（`:2943-2948`）：
```js
    // 技能管理 JSON API（设置页面「技能管理」分区数据层，Phase 50 D-15）。
    // 用 startsWith 而非 ===：该前缀承载多个子路由（list / 后续的 set-disabled、uninstall）。
    if (reqPath.startsWith('/api/skills/')) {
      handleSkillsApi(req, res, reqUrl);
      return;
    }
```

**⑤ 两阶段导入的既有先例（形状可抄，但**必须改进两点**）**（`:1254-1283`）：
```js
      // HTML 书签导入：body { filePath | content, mode: 'preview' | 'import' }
      // ⚠️ body 同上（同一条链路，预览与执行各发一次）⇒ 显式放大上限
      if (route === 'import-html' && req.method === 'POST') {
        const { filePath, content, mode } = await readJsonBody(req, res, { maxBytes: MAX_JSON_BODY_BYTES_LARGE });

        // 预览模式：只解析不写库（per D-11, D-12）
        if (mode === 'preview') {
          const result = await favoritesManager.importHtmlBookmarks(
            content ? { content } : { filePath }, null, null, { dryRun: true }
          );
          sendJson(res, 200, result);
          return;
        }
        …
      }
```
**必须改进的两点**（CONTEXT「Reusable Assets」明文）：① 它接受 **`filePath`** ⇒ 本阶段**绝不接受路径**，只接受 `importId`（D-02 / Anti-Pattern 1）；② 它**没有临时目录的 TTL 与崩溃清扫**。
模块级两阶段状态的既有形态（`:1237-1238`，**partial analog，须补 TTL**）：
```js
        currentImportAbortController = new AbortController();
        currentImportProgress = { progress: 0, imported: 0, total: 0, current: '' };
```

**⑥ 同源证据（设置页与 `/api/*` 同源，`fetch` 零 CORS 面）**（`:3055-3059`）：
```js
    } else if (reqPath === '/settings' || reqPath === '/settings/') {
      filePath = path.join(__dirname, 'src', 'settings.html');
    } else if (reqPath.startsWith('/settings/')) {
      const subPath = reqPath.replace('/settings/', '');
      filePath = path.join(__dirname, 'src', subPath);
    }
```
（实测 `main.js` 零 `Access-Control-Allow-*` 头 ⇒ `Content-Type: application/zip` 从 guest 发出不触发预检。）

---

### `src/settings-page.js` —— 导入弹框与客户端（view controller，request-response + file-I/O）

**Analog:** 同文件 `skillsApi`（`:4874`）/ `handleFileSelect`（`:781`）/ `openSkillUninstallConfirm`（`:5427`）

**① 注入纪律（**导入弹框尤其重要：预览渲染的全是不可信包的字符串**）**（`:4784-4803`）：
```js
 * ## 注入纪律（硬约束，TD-48-01 未修时尤其重要）
 *
 * 技能名 / 描述 / 诊断 message 全部来自磁盘（用户或 AI 可写任意内容）。本区**零
 * innerHTML / insertAdjacentHTML / 字符串模板拼 HTML** —— 整棵 DOM 用
 * document.createElement + textContent / el.title 构建。属性经 DOM 属性赋值注入
 * （不走 HTML 解析）⇒ 与 escapeHtml 的「不转义引号」缺口无关，本阶段**不扩大**该缺口。
```
⚠️ `escapeHtml` 在 `src/settings-page.js:1657`，**只转义 `& < >` 不转义引号**（`TD-48-01`）⇒ D-13 要求预览卡片渲染的文件名 / 目录树路径 / `description` 原文 / `diagnostics` 原文 / `allowed-tools` 值**必须走 DOM API 赋值**（属性上下文尤其：`title` / `aria-label` / `data-*`），**不得**用模板字符串拼 HTML。

**② 失败文案按 `code` 查表的闭合白名单**（`:4854-4859` + `:5267-5274`）：
```js
const SKILL_MANAGE_ERROR_TEXT = Object.freeze({
  not_found: '技能已不存在，列表已刷新',
  not_user_owned: '该技能不是你的技能，无法在此卸载（内置技能只可禁用，AI 创建的技能请让 AI 用 manage_skill 删除）',
  invalid_name: '技能名不合法，无法操作',
  BODY_TOO_LARGE: '请求体超过上限，操作未执行',
});

function skillManageErrorText(err) {
  const code = err && typeof err.code === 'string' ? err.code : '';
  if (Object.prototype.hasOwnProperty.call(SKILL_MANAGE_ERROR_TEXT, code)) return SKILL_MANAGE_ERROR_TEXT[code];
  const detail = err && err.message ? err.message : '';
  return detail ? `操作失败：${detail}` : '操作失败，请重试';
}
```
导入的新码（`IMPORT_SKILL_ERROR`，如 `import_expired` / `unsupported_url` / `unsupported_zip64` / 各限额码）**加入同一张表**（表是「单消费者新文案」，出现第二消费者须提升到 `src/skill-picker-model.js`）。

**③ HTTP 客户端（导入的两种 body 形态都在此扩展）**（`:4874-4893`）：
```js
async function skillsApi(route = '', options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const suffix = route ? `/${route}` : '';
  const res = await fetch(`/api/skills${suffix}?${params.toString()}`, options);
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const data = await res.json();
      if (data && data.error) detail = data.error;
      if (data && data.code) code = data.code;
    } catch { /* 非 JSON 响应忽略 */ }
    const err = new Error(detail || `请求失败（HTTP ${res.status}）`);
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return res.json();
}
```
**调用形态**（D-01 / D-03）：zip 上传 = `skillsApi('import', { method: 'POST', body: file })`（**不手工设 `Content-Type`**，让浏览器带 `application/zip` + boundary-free 的原始类型；`File` 可直接作 body，**无需 FileReader / base64**）；url / commit = `skillsApi('import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mode:'url'|'commit', … }) })`。

**④ inline hint（**失败反馈复用，不新建 toast 基建**）**（`:5289-5302`）：
```js
function setSkillManageHint(text, tone = '') {
  const hintEl = document.getElementById('skillManageHint');
  if (!hintEl) return;
  clearTimeout(skillManageHintTimer);
  hintEl.textContent = text;
  hintEl.classList.remove('skill-manage-hint-success', 'skill-manage-hint-danger');
  if (tone === 'success') hintEl.classList.add('skill-manage-hint-success');
  if (tone === 'danger') hintEl.classList.add('skill-manage-hint-danger');
  hintEl.style.display = text ? 'block' : 'none';
  skillManageHintTimer = setTimeout(() => {
    hintEl.textContent = '';
    hintEl.style.display = 'none';
  }, 2000);
}
```
⚠️ **测试读 hint 必须避开这 2000ms 自动清空**（50 收尾实测的「假绿」形态之一）。
弹框自带 `#skillImportStatus` 状态行（UI-SPEC E6）；长文案（预览过期 / 回读失败）走 `setSkillManageHint` 保持既有范式。

**⑤ 弹框的打开 / 关闭 / Escape / 焦点归还（**逐行模板**）**（`:5427-5462`）：
```js
function openSkillUninstallConfirm(name, triggerBtn) {
  const overlay = document.getElementById('skillManageConfirm');
  …
  if (!overlay || !titleEl || !bodyEl || !noteEl || !okBtn || !cancelBtn) return;

  skillManageUninstallTarget = { name, triggerBtn };
  titleEl.textContent = `卸载技能「${name}」？`;
  bodyEl.textContent = `将删除 skills/${name}/ 整个目录（含其中的脚本与引用文件），此操作无法恢复。`;
  const showNote = skillHasShadowedTwin(name);
  noteEl.textContent = showNote ? '同名内置 / 托管技能将在删除后重新可见。' : '';
  noteEl.style.display = showNote ? 'block' : 'none';
  okBtn.disabled = false;
  overlay.style.display = 'flex';
  cancelBtn.focus();            // 默认焦点 = 安全选项
}

function closeSkillUninstallConfirm(options = {}) {
  const overlay = document.getElementById('skillManageConfirm');
  const target = skillManageUninstallTarget;
  skillManageUninstallTarget = null;
  if (overlay) overlay.style.display = 'none';
  if (options.restoreFocus !== false && target && target.triggerBtn && target.triggerBtn.isConnected) {
    target.triggerBtn.focus();
  }
}
```
**监听绑定 + 点遮罩关闭 + Esc**（`:5692-5715`）：
```js
  const overlay = document.getElementById('skillManageConfirm');
  if (overlay) {
    // 点遮罩关闭（与既有 aiAddDialog / aiFetchDialog 同款）
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSkillUninstallConfirm(); });
    // Esc 关闭：焦点在弹框内时 keydown 冒泡到这里（无需全局监听器）
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSkillUninstallConfirm(); });
  }
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeSkillUninstallConfirm());
  if (okBtn) okBtn.addEventListener('click', () => { confirmSkillUninstall(); });
  loadSkillManagement();
```
⚠️ UI-SPEC 的状态机要求导入弹框在**「在途·下载」时 Escape 仍可用**（中断下载）、**「提交中」时 Escape 被忽略** ⇒ 不能无条件照抄 `if (e.key === 'Escape') close()`，须加状态守卫。

**⑥ 确认动作（提交时禁用按钮 + 成功用响应体投影重渲染 + 失败关框给 hint）**（`:5470-5493`）：
```js
async function confirmSkillUninstall() {
  const target = skillManageUninstallTarget;
  if (!target) return;
  const { name } = target;
  const okBtn = document.getElementById('skillManageConfirmOk');
  if (okBtn) okBtn.disabled = true;
  try {
    const result = await skillsApi('uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    closeSkillUninstallConfirm();
    if (result && result.management) renderSkillManagement(result.management);
    setSkillManageHint(`已卸载「${name}」`, 'success');
  } catch (err) {
    console.error('[Realm] 卸载技能失败:', err && err.message ? err.message : err);
    closeSkillUninstallConfirm();
    setSkillManageHint(skillManageErrorText(err), 'danger');
    if (err && err.code === 'not_found') { await loadSkillManagement(); }
  }
}
```
⚠️ 导入的「提交失败」语义**与之相反**：UI-SPEC 状态机明确「失败时弹框保持打开、输入与勾选保留，可就地重试」—— 只可借**按钮禁用 + catch 形状**，**不得**照抄 `closeSkillUninstallConfirm()`。

**⑦ 文件选择的完整链路（**D-18 明文复用，不新增 native dialog IPC**）**：
- 触发（`:767-770`）：`function importRules() { elements.rulesFileInput.click(); }`
- 处理 + `finally` 重置（`:781-816`）：
```js
async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    …
  } catch (error) {
    console.error('[Realm] 导入规则失败:', error);
    showToast('导入失败，请检查文件格式');
  } finally {
    // 清空文件输入，保证所有退出路径都能再次触发 change 事件
    e.target.value = '';
  }
}
```
- 注册（`:1240-1242`）：`elements.rulesFileInput.addEventListener('change', handleFileSelect);`
⚠️ UI-SPEC 已纠正一处措辞：`<input>` **没有** `reset()` 方法（那是 `<form>` 的），复位一律 `input.value = ''`。
导入侧差异：zip 不要 `await file.text()`（二进制）—— 直接 `body: file`；`accept=".zip,application/zip"`。

---

### `src/settings.html` —— 导入弹框 DOM（view）

**Analog:** `#skillManageConfirm`（`:555-567`）/ `rulesFileInput`（`:197`）

**① 弹框骨架（**逐行模板**）**（`:549-568`）：
```html
          <!-- 卸载确认弹框（D-05 的二次确认）。外壳复用 .ai-modal-overlay + .ai-modal（既有类），
               初始隐藏走 .ai-modal-overlay 的既有 display:none 规则 —— realm://settings 的 CSP
               style-src 'self' 会拦掉 markup 内联 style（元素反而常驻可见）；打开/关闭一律用
               JS 的 CSSOM 具体值。绝不把 .ai-modal-overlay 用到 <dialog> 元素上（会把盒子钉在左上角）。
               已知边界（有理由，非静默省略）：不实现完整焦点陷阱（Tab 循环），与设置页既有的
               2 个 .ai-modal-overlay 弹框同范式；引入焦点陷阱属跨页面新机制，须单独立项。 -->
          <div id="skillManageConfirm" class="ai-modal-overlay">
            <div class="ai-modal skill-manage-confirm">
              <div class="ai-modal-header">
                <h3 id="skillManageConfirmTitle"></h3>
              </div>
              <div id="skillManageConfirmBody" class="skill-manage-confirm-body"></div>
              <div id="skillManageConfirmNote" class="skill-manage-confirm-note"></div>
              <div class="skill-manage-confirm-actions">
                <button type="button" class="btn btn-secondary btn-sm" id="skillManageConfirmCancel">取消</button>
                <button type="button" class="btn btn-secondary btn-sm skill-manage-danger-btn" id="skillManageConfirmOk">卸载</button>
              </div>
            </div>
          </div>
```
**三条硬约束**（D-18 / `AGENTS.md` 的「内部页面 CSP」与「弹框居中约定」）：① **初始隐藏走 CSS 类**（`.ai-modal-overlay { display:none }`），**绝不写 markup 内联 `style`**；② 显隐用 JS CSSOM 的 `'flex'` / `'none'` 具体值，**不用 `''` 回落**；③ **绝不把 `.ai-modal-overlay` 用到 `<dialog>` 上**（inset 全 0 过约束会把盒子钉在 `top:0;left:0`），dialog 的压暗用 `::backdrop`。
导入弹框插入位置：本区**末尾**（`#skillManageConfirm` 之后，`:568` 附近），DOM 骨架逐字见 `51-UI-SPEC.md:475-522`。

**② 文件输入先例（**唯一的 file input 形态参照**）**（`:197`）：
```html
        <input type="file" id="rulesFileInput" accept=".json">
```
导入版 = `input#skillImportFile.skill-import-file-input[type=file][accept=".zip,application/zip"]` + 可见入口按钮转调 `.click()`（`.skill-import-file-input { display: none }` 走**类规则**，不写内联 style）。

**③ 区标题行插入点**（`:536-537`）：
```html
        <div class="settings-group skill-manage-section">
          <h2 class="settings-group-title">技能管理</h2>
```
UI-SPEC 要求改为 `div.skill-manage-header` 包住 title + 右侧 `#skillImportOpen`（`.btn.btn-secondary.btn-sm`，**不是** `.btn-primary`）。

---

### `src/styles/main.css` —— `.skill-import-*` 专属段（style）

**Analog:** 50 的 `.skill-manage-*` 专属段（同文件末尾）
**落点（UI-SPEC 强制）**：整段**追加在 `src/styles/main.css` 末尾**的专属段中，段首注释为 `/* ===== 设置页「技能导入」（Phase 51） ===== */`。理由（`51-UI-SPEC.md:743-747`）：这次有 **3 条是作用域覆盖**（`.skill-manage-header` / `.skill-manage-header .settings-group-title` / `.skill-manage-section .ai-memory-tab.active`），须「集中一处、可整段复核」，与 50 同款做法。
⚠️ **`src/styles/bookmarks-bar.css` 是未被加载的死副本**（`AGENTS.md` 明文）—— 改样式只改 `main.css`，不要改错文件。

---

### `package.json` —— 依赖与打包（config）

**Analog:** 既有 `dependencies` + `build.files` + `build.asarUnpack`

**① 现状（实测）**：
```json
  "scripts": {
    "start": "electron .", "dev": "NODE_ENV=development electron .", "debug": "NODE_ENV=debug electron .",
    "nightly": "NODE_ENV=nightly electron .", "build": "electron-builder", "build:mac": "electron-builder --mac",
    "postinstall": "node scripts/postinstall.js",
    "test:pre-release": "node scripts/test-pre-release.js",
    "validate": "node scripts/test-save-domain-cookies.js && …",
    "test:memory": "node --test test/memory/*.test.js",
    "eval:memory": "node test/memory/scenario-harness.js"
  },
  "build": {
    "files": ["!.planning/**","!.claude/**","!.gsd/**","!.wzsh/**","!.zcode/**","!test/**","!tests/**","!scripts/**","!**/*.bak","!CLAUDE.md","!CODEBUDDY.md","!.worktrees/**"],
    "asarUnpack": ["node_modules/nodejieba/**","skills-builtin/**"]
  }
```
**② 三条硬约束**：
- **`build.files` 每一项都以 `!` 开头**（无正向 allowlist）—— `tests/test-builtin-skills-seeder.js:1988` 的护栏断言会变红（`:1979-2016`）。**新增依赖不需要动 `build.files`**。
- **两个新依赖均纯 JS、无原生模块、无数据文件 ⇒ 不需要加 `asarUnpack`**（D-14 明文）；`:2012-2016` 的 asarUnpack 成对断言保持绿。
- **`yaml` 必须精确钉 `"2.9.0"`，不得写 `^2.9.0`**（CR-2 实测：`^2.9.0` 解析到根 `2.9.1`，而 SDK 精确依赖 `2.9.0` ⇒ **双实例**）。
- **`scripts` 里没有 `test`** ⇒ CR-11：新增两个套件统一用 `node tests/<file>.js`，且**套件名不得含 `picker`**（counts-parity 按文件名含 `picker` 决定是否插 `--test`）。
- `scripts/postinstall.js` 只做 macOS 图标替换 + `npx @electron/rebuild`（原生模块），**本阶段无需改动**；但新增依赖后应确认 `postinstall` 未引入新的原生编译成本（两个包都是纯 JS）。

**③ 依赖审计四条**（`AGENTS.md` §开发正式环境差异）：registry 存在性 / 下载量 / 源仓库 / `postinstall` 脚本 + 与 `build.files` 的联动 —— `yauzl@3.4.0`（唯一依赖 `pend ~1.2.0`，零依赖）与 `yaml@2.9.0` 均无 `postinstall`。

---

### `tests/test-skills-import.js`（新增，unit + integration）

**Analog:** `tests/test-manage-skill.js`（值域矩阵 + 真 fs 沙箱 harness）

**① 目录 harness（`mkdtempSync` + `t.after` 清理 + 复位覆写）**（`tests/test-agent-workspace.js:21-32`，`test-manage-skill.js:71` 同款）：
```js
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
导入套件需要同款：`setWorkspaceDir(临时根)` ⇒ `.tmp/` 与 `skills/` 都在临时根下 ⇒ 越界对照组（SEC-05）就是在**临时根之外**再建一个目录断言零写入。

**② seededNames 必须显式注入**（`AGENTS.md:336` 明文）：`ai-skills-manager` 零 electron，纯 Node 下 `getSeededSkillNamesSafe()` 降级为 `[]` ⇒ **用注入的 `SEEDED` 常量**，否则 seeded 保护用例假绿。

**③ 真 fs 的 symlink 两段式用例形态**（`tests/test-agent-workspace.js:157-164`）：
```js
  test('symlink 二段式逃逸：bash 建 link 后 read 工具读 link 被拒', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    await env.exec('ln -s /etc link-to-etc');
    const result = await env.readTextFile('link-to-etc/hosts');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'permission_denied');
  });
```
SEC-10 的**新增**用例要覆盖三态：① 越界 symlink **转拒**；② **自指链接仍放行**；③ **既有放行 / 拒绝集合零变化**（把 `:34-83` 与 `:85-177` 的现有用例原样保留作回归基线）。

**④ 覆盖回滚（第二步注错）**：用 `env.renameFile` 的**真实失败**注入（如目标父目录缺失 / 目标为已存在的非空目录），断言旧技能内容**逐字完好**。**不得**用「手工构造一个实现从不构造的对象」式的桩（那会重复 50 收尾的三处「假绿」形态）。

**⑤ 源码扫描判据（「只有一个落盘实现」）**：需要 **`stripCodeComments`**（`tests/test-skills-http-api.js:58-94`，与计划自带门禁的 `stripC` 逐字同款）—— 计数/token 禁令类判据一律**先剥注释再判**，否则解释禁令的注释本身会构成违规。配套的「窗口切片」写法（`:102-108`）：
```js
function settingsUpdateLoopWindow(src) {
  const start = src.indexOf('for (const [key, value] of Object.entries(updates)) {');
  assert.ok(start >= 0, 'main.js 必须含 /api/settings/update 的校验循环（口径失效）');
  const end = src.indexOf("broadcast('settings:updated'", start);
  assert.ok(end > start, 'main.js 的校验循环必须仍然位于 settings:updated 广播之前（口径失效）');
  return src.slice(start, end);
}
```
导入侧的对应判据：在 `ai-skills-manager.js`（或拆分模块）里断言 `importUserSkill(` 的**调用点数恰 1**（zip 上传 / zipball / 直链 SKILL.md 三条来源都汇入它）。

---

### `tests/test-skills-import-net.js`（新增，unit + 本地 stub server）

**Analog:** `tests/test-skills-http-api.js` 的真 `http.createServer` harness（`:410-551`）

**① 真实字节流的客户端写法（**不得**用 fetch，避免 undici 缓冲语义干扰堆判据）**（`:410-445`）：
```js
function postStream(port, { payloadBytes, withContentLength = false, chunkBytes = 1024 * 1024, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (withContentLength) headers['Content-Length'] = String(payloadBytes);
    let done = false;
    const req = http.request({ host: '127.0.0.1', port, path: '/api/harness', method: 'POST', headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => { done = true; clearTimeout(timer); req.destroy(); resolve({ status: res.statusCode, text }); });
    });
    …
  });
}
```
**② 反向对照是硬要求（「证明断言能失败」）**（`:526-550`）：
```js
  test('④ 反向对照：req.destroy() 形态**拿不到** 413（证明 ① 的断言能失败）', async () => {
    const { server, port } = await startSec09Server({ maxBytes: 1024 * 1024, rejectForm: 'destroy' });
    …
    assert.notStrictEqual(status, 413, 'destroy 形态把 socket 在响应可读之前撕掉 ⇒ 客户端拿不到 413（这正是禁用它的理由）');
```
**③ SEC-08 的网络面用本地 stub server（**不得依赖实时外网**，CR-12）**：stub server 要能表达——白名单外主机（用 `Host` / DNS 覆写或直接以 `http://127.0.0.1:PORT` 配一份可注入的主机白名单）、`http:` 拒绝、逐跳私有地址拒绝、**跳数超限抛错**（对照 `search-manager.js:1594-1618` 的既有缺陷：走完循环**不抛**「重定向过多」，而是带着最后一个 3xx 掉出 ⇒ 报误导性的 `HTTP 301`）、magic bytes 不匹配。
⚠️ **stub server 不能当唯一证据**：`skills.sh` 的真实 `308 → www.skills.sh` 行为（Pitfall 8 / CR-1）**必须**另有一条不依赖跟随重定向的断言（否则真实行为被漏掉）。

---

### `tests/test-skills-http-api.js`（增补）

**Analog:** 同文件既有四组
**增补点**：① `readRawBody` 的 ①/①b/②/④ 四组（复用 `startSec09Server` 的 harness 形态，`maxBytes` 换成 `MAX_SKILL_PACKAGE_BYTES`）；② 源码契约组（三参签名 / `canRespond` 降级 / `sendJson(res, 413` / `req.resume()` / 无 `req.destroy(` / 无 `Connection` 头 / data 监听器内的**顺序** `早退 → 累加 size → 比较 → 才拼 body`，`:595-616`）；③ `handleSkillsApi` 新增 `import` 子路由的源码扫描（`:112-`的形态）；④ `readJsonBody` 调用点计数与 `res.writeHead(` 基线（`:654-679`）**若被触及须同批刷新**。

---

### `tests/test-ai-skills.js`（增补 SEC-06 + D-19）

**Analog:** 同文件 M/L 组
**增补点**：① `SKILL_THREAT_PATTERNS` 三类值域，**必须带正命题**（恶意正样本命中 **+** `skills-builtin/**` 与固化语料零命中）—— 这是 49 `WR-12`「否命题空集真」教训的正面做法；② D-19 的「重扫恰一次 + 补播恰一次」计数断言；③ `syncAgentSystemPrompt()` 函数体未改的方法体断言。

---

### 文档三处（`docs/product/ai-skills.md` / `docs/product/ai-agent-workspace.md` / `AGENTS.md`）

**Analog:** 同文件既有「诚实边界」节 + `AGENTS.md` 三块维护约定

`docs/product/ai-skills.md` 章节结构（本阶段要新增第十三节「导入」并**定稿**安全边界）：
```
  9:## 八、内置技能
 255:## 十、发现与调用
 379:### 10.7 诚实边界
 435:## 十一、AI 自建技能（manage_skill）
 489:### 11.3 九条拒绝原因（工具面）      ← 错误码表范式
 517:### 11.6 三条诚实边界
 571:## 十二、管理面（设置页 + /api/skills/*）
 645:### 12.6 五条诚实边界
 668:### 12.8 请求体体积闸（/api/* 通用机制） ← D-01 的交接面
 677:### 12.9 维护约定与测试
```
`docs/product/ai-agent-workspace.md` 章节：`## 七、安全边界（诚实声明）`（`:122`）—— SEC-10 的行为变更在此披露。
`AGENTS.md` 三处维护约定（`:335` 技能发现与调用 / `:336` AI 自建技能 / `:337` 技能管理面）+ **测试行 `:330`**（例数账本）。

**例数账本三处一起刷**（`docs/product/ai-skills.md:549-564` 的可重跑判据）：
```bash
node -e '
const cp=require("child_process"),fs=require("fs");
const suites=["tests/test-manage-skill.js","tests/test-ai-skills.js","tests/test-skill-picker-model.js","tests/test-skills-management.js","tests/test-skills-http-api.js"];
const meas={};
for(const f of suites){const o=cp.execSync("node "+(f.indexOf("picker")>=0?"--test ":"")+f,{encoding:"utf8",stdio:["ignore","pipe","ignore"]});meas[f.split("/").pop()]=String(o.match(/# tests (\d+)/)[1]);}
…
if(cells<12)bad.push("账本单元数 "+cells+" < 12 …");
'
```
**本阶段要把两个新套件加进 `suites` 数组 + `cells` 下限**（**权威表述在 `51-07-PLAN.md` Task 3**）：五个既有套件**实测**已在两个账本文件里贡献 **16** 个单元（`AGENTS.md` 5 + `docs/product/ai-skills.md` 11；用本段上方那条命令现跑可得 `cells=16 measured={"test-manage-skill.js":"55","test-ai-skills.js":"187","test-skill-picker-model.js":"115","test-skills-management.js":"49","test-skills-http-api.js":"32"}`），两个新套件各需在这**两个文件**里都有账本单元 ⇒ 下限 = 16 + 2×2 = **20**。
⚠️ **不要**从上面那条命令里的 `if(cells<12)` / 「账本单元数 … < 12」反推基线 —— 那个 `12` 是 Phase 50 写下的**下界**（当时两个新套件还没到），而**实测值 16 早已高于它**；同理 `docs/product/ai-skills.md:555` 那句「基线由 8 提到 12」是**陈旧注释**，不是当前基线。按「12 → 16」推算会得到一个**低于实测基线**的下限（16 < 实测 16，等于门槛失效）。
⚠️ **`cells` 只是下限阈值；权威判据是紧随其后的逐套件覆盖断言**（`for (const base of Object.keys(meas)) if (!hit[base]) bad.push(file + " 的账本未覆盖 " + base)`）—— 漏写任一新套件的账本单元会**指名**报出，而只把单元总数凑够不会报错。

---

## Shared Patterns

### 单一数据权威 + 转发层零判定
**Source:** `ai-skills-manager.js:18-21`（依赖纪律）与 `main.js:2819-2821`、`ai-manager.js:1587-1605`
**Apply to:** `main.js` 的 `import` 分支、`ai-manager.js` 的导入转发方法
```js
   * **本 handler 只是转发层**：判定 / 校验 / 写函数全部住 `ai-skills-manager.js`
   * （技能集单一数据权威，零 electron 依赖）—— 在这里加工一份就是第二份实现
```
**验收判据（机械）**：`tests/test-skills-http-api.js:782-792` 的形态 —— handler 段内**零判定素材**（`kind ===` / `source ===` / `isSeededName` / `managed-skills` 一律不得出现）。导入的 handler 段同样受此约束，且**「落盘函数只有一个调用点」**同属该组。

### 常量单源 + 端点与前端零字面量
**Source:** `ai-skills-manager.js:48-54`、`main.js:888-889`
**Apply to:** 所有新限额常量（解压六类 + `MAX_SKILL_PACKAGE_BYTES`）
限额只在主进程定义一处，经管理投影的 `limits` 投影给设置页；设置页**不得**写死任何限额数值（`main.js:2846` 的空投影已含 `limits: {}`）。

### 禁止静默失败（可读原因 + 机器可读码）
**Source:** `ai-skills-manager.js:1226-1231`、`main.js:2886-2887`（`code` 必须回传）、`src/settings-page.js:5267-5274`
**Apply to:** 每一条拒绝路径（限额 / 逃逸族 / symlink / magic bytes / 白名单 / 空包 / 多根 / 0 根 / TTL 过期 / 回读失败）
```js
      // code 必须回传：设置页按 code 查失败文案表，**不解析 message**（UI-SPEC Copywriting 纪律）
      sendJson(res, 400, { error: err.message, code: err.code || undefined });
```
文案须说明「**命中哪个限额、当前值是多少**」（P7），且**不回显被拒内容原文**（49 纪律）。

### 读盘而非缓存快照
**Source:** `ai-skills-manager.js:1695-1703`（`countManagedSkills`）、`:2038-2046`（`deleteUserSkill` 用 `env.fileInfo` 而非 `env.exists`）
**Apply to:** 冲突判定 / 数量闸 / 目标存在性
```js
 * 撞名判定**一律读盘**（`env.exists`），不用缓存快照 ——
 * bash 可随时改写磁盘，缓存只反映上次重扫的时刻。
```
⚠️ 需要判「是目录」时**必须用 `env.fileInfo`**（`exists` 对普通文件也返回 true）。

### 原子写 + 失败零残留
**Source:** `ai-skills-manager.js:1634-1666`（文件级）、`builtin-skills-seeder.js:303-324`（目录级）
**Apply to:** 覆盖（两段 rename）+ 回滚
```js
 * 1. 复制 src → `<dst>.tmp_<ts>`
 * 3. `rename(<dst>.tmp_<ts>, dst)`
```
### 崩溃残留清扫（**须补陈旧性判据，不要重复 WR-05**）
**Source:** `builtin-skills-seeder.js:255-266`
```js
function sweepSeedResidue(managedDir) {
  let entries = [];
  try { entries = fs.readdirSync(managedDir); } catch { return; }
  for (const name of entries) {
    // 成对不变式：命名形状必须与 safeCopyDir 的 `<dst>.tmp_<ts>` / `<dst>.bak_<ts>` 同步
    if (/\.(tmp|bak)_\d+$/.test(name)) _cleanupDir(path.join(managedDir, name));
  }
}
```
⚠️ **它有一条已挂账的缺陷**（`47-REVIEW.md` 的 `WR-05`，`:212-219` / `:319`）：**缺陈旧性判据** ⇒ 并发实例（`dev` 与 `debug` 共享 userData 且无单实例锁）会**互删进行中的 tmp/bak**。**51 的 `.tmp/skill-import-*` 清扫器必须带上陈旧性判据**（按 mtime 或按 TTL），否则会删掉另一个实例正在预览的包 —— 这是本阶段**不得重复的历史缺陷**。

### symlink 拒绝的语义（两处镜像）
**Source:** `ai-attachments-manager.js:209-212`（`stat.isSymbolicLink() → 拒绝`）与 `builtin-skills-seeder.js:277-285`（递归 `withFileTypes` + `isSymbolicLink()` → throw）
```js
function assertNoSymlink(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`源目录含符号链接，拒绝播种: ${child}`);
    if (entry.isDirectory()) assertNoSymlink(child);
  }
}
```
**Apply to:** D-17 第 2 层（解压后递归 `lstat` 复核整棵树）。**断言点是「拒绝整包」而不是「跳过条目」**。

### SSRF 逐跳判据（**复用判据，不复用函数**）
**Source:** `search-manager.js:195-211`（`isPrivateHost`，已导出 `:1668`）+ `:1594-1618`（hop 循环）
```js
async function isPrivateHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  if (isIP(hostname)) return PRIVATE_IP_RANGES.some(r => r.test(hostname));
  try {
    const results = await lookup(hostname, { all: true });
    if (results.length === 0) return true;
    return results.some(r => PRIVATE_IP_RANGES.some(pat => pat.test(r.address)));
  } catch {
    return true;   // DNS 解析失败时返回 true（安全默认值）
  }
}
```
逐跳形态（**注意它的缺陷**）：
```js
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const hopHost = new URL(currentUrl).hostname;
    if (await isPrivateHost(hopHost)) throw new Error(`拒绝访问内网地址: ${hopHost}`);
    res = await net.fetch(currentUrl, { …, redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
      if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) throw new Error(`重定向到非 HTTP 协议: ${currentUrl}`);
      continue;
    }
    break;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
```
⚠️ **两条本阶段必须改进**（P9 / D-05）：① 跳数超限**必须抛错**（现有形态走完循环不抛，带着最后一个 3xx 掉出 ⇒ 报误导性的 `HTTP 301`）；② **`await res.text()`（`:1623`）+ `FETCH_DEFAULT_MAX_LENGTH = 12_000` 字符截断对二进制是破坏性的**（Anti-Pattern 7）⇒ **绝不复用 `fetchUrl`**，新写流式字节累加 + `magic bytes` 校验。

### 威胁扫描（复用单点，扩表不加接线）
**Source:** `ai-memory-manager.js:88-104`（`scanInjectionPatterns`，返回 `{safe, reason?}`）+ `ai-skills-manager.js:1537-1545`（`scanSkillText`，throw）
**Apply to:** description（跑注入 + 凭据两组）/ body（只跑注入组）—— 49 D-08 的分字段口径**不得调换**。`{ pattern, name }` 数组遍历、命中返回 reason、无命中返回 `{safe: true}` 的形状照抄。技能域三类（`SKILL_THREAT_PATTERNS`）**不是** hard-fail 表，须另写返回命中列表的扫描函数。

### `net.fetch` 的选项形状（Electron 网络栈）
**Source:** `favicon-fetcher.js:40-42` / `main.js:2974` / `search-manager.js:1599-1606`
```js
    const resp = await net.fetch(sourceUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
```
导入下载用同款（`redirect: 'manual'` + `signal`），响应体走 `resp.body`（`ReadableStream`）流式读取 —— **不得** `arrayBuffer()`。

### 诚实边界必须成文
**Source:** `docs/product/ai-skills.md` §10.7 / §11.6 / §12.6；`docs/product/ai-agent-workspace.md` §七
**Apply to:** 本阶段的四个声明 —— ① 威胁扫描「**启发式、非安全边界**」；② **DNS rebinding 残余风险**如实披露；③ SEC-10 加固后的**行为变更**；④ `allowed-tools`「**当前运行时不被强制，仅供参考**」。
**既有文案口径可直接复用**（`docs/product/ai-skills.md:521`）：
> 上述扫描是启发式，降低概率而非安全边界。真正的安全边界是**确认卡片 + 硬沙箱**。

### 前端注入纪律（TD-48-01 不得扩大）
**Source:** `src/settings-page.js:4784-4803`
**Apply to:** 预览卡片的**全部**不可信字符串（技能名 / description 原文 / 目录树路径 / 文件名 / 脚本清单 / `diagnostics` 原文 / `allowed-tools` 值）—— 一律 `document.createElement` + `textContent` / DOM 属性赋值；**零 `innerHTML` / 零字符串模板拼 HTML**；属性上下文尤其（`title` / `aria-label` / `data-*`）。

---

## Pattern 6 的实测配方（覆盖的两段 rename + 回滚）

**Source:** `51-RESEARCH.md:1339-1352`（本会话实测 C1..C4b 全绿）
```js
const bak = path.join(getTmpDir(), 'skill-replace-' + rand);
await env.renameFile(destDir, bak);                             // ① 同设备原子
try {
  await env.renameFile(path.join(importDir, name), destDir);     // ②
} catch (e) {
  await env.renameFile(bak, destDir);                           // ④ 回滚（实测：旧技能内容完好恢复）
  throw e;
}
await env.remove(bak, { recursive: true, force: true });        // ③ 成功后删备份（对 symlink 安全，实测）
```
⚠️ 备份是**临时的**（成功后即刻删除），**不得**扩张成版本历史 / 恢复按钮（ECO-02 / v1.x）。
⚠️ `.tmp/` 与 `skills/` **同沙箱 root、同设备** ⇒ `rename` 不会 EXDEV（实测；须在计划里保留一次实跑断言）。

---

## 三条「本阶段容易抄错」的点（正确形态与出处）

### 1. 一次性句柄 / 临时文件的落点 —— **只经访问器拿路径，不得 `path.join(__dirname, …)`**

| 需要的路径 | 唯一合法来源 | 出处 |
|---|---|---|
| 工作区根 | `getWorkspaceDir()` | `agent-workspace.js:38` |
| 临时区（导入预览目录 / 覆盖备份目录） | `getTmpDir()` → `agent-workspace/.tmp/` | `agent-workspace.js:82` |
| 用户技能目录 | `getSkillsDir()` → `.../skills` | `agent-workspace.js:102` |
| managed 技能目录 | `getManagedSkillsDir()` → `.../managed-skills` | `agent-workspace.js:113` |
| 唯一的一次性临时目录 | `env.createTempDir(prefix)`（**已重定向 `.tmp/`**） | `agent-workspace.js:327-336` |
| 一次性临时文件 | `env.createTempFile({prefix, suffix})`（**已重定向 `.tmp/`**） | `agent-workspace.js:338-352` |

**为什么是硬约束**：`createTempDir` / `createTempFile` 的重定向是「bash 截断全量输出依赖它」的既有机制（`:198-200` 明文「SDK 默认落 `os.tmpdir()`，会破沙箱封闭」）；自己 `path.join(__dirname, …)` 或 `os.tmpdir()` 会落到**沙箱之外**，导入的临时目录随即失去 `env.renameFile` 的双基准保护，且 `rename` 可能 EXDEV。
**配套不变式**：清扫正则必须与**实际产物命名**成对（`createTempDir('skill-import')` 实际产出 `tmp-skill-import-<rand>`，见 `:330-331` 的 `'tmp-' + sanitizeNamePart(prefix)`）—— 这是 `sweepSeedResidue` 的「命名形状成对不变式」同款要求（`builtin-skills-seeder.js:263-264`）。

### 2. `env` 注入纪律 —— 函数签名一律 `(env, { …, seededNames })`，seededNames 由**调用方**注入

**正确形状**（`ai-skills-manager.js` 三动作 + `deleteUserSkill`）：
```js
async function createManagedSkill(env, { name, content, description, seededNames } = {}) { … }
async function updateManagedSkill(env, { name, content, description, seededNames } = {}) { … }
async function deleteManagedSkill(env, { name, seededNames } = {}) { … }
async function deleteUserSkill(env, { name } = {}) { … }   // 不需要 seeded 就不收
async function countManagedSkills(env, managedDir, seededNames) { … }
async function resolveManagedTarget(env, name, seededNames) { … }
```
**调用方注入**（`ai-manager.js`）：
```js
    const env = this.sandboxEnv || (this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv());
    const result = await getAiSkillsManagerLazy().deleteUserSkill(env, { name });
    …
    return getAiSkillsManagerLazy().getSkillsForManagement(this.getSeededSkillNamesSafe());
```
**为什么**：`builtin-skills-seeder` 经 `agent-workspace` **间接依赖 electron**（`app.isPackaged`），而 `ai-skills-manager.js` **必须零 electron 依赖**（可单测、可被导入管线直接 require）。因此 seeded 身份**不能**由 manager 自行解析，只能由调用方注入。**新的导入函数必须同款**（`importUserSkill(env, { importDir, name, conflict, newName }, { seededNames })` 一类）。
**测试侧对应纪律**：测试**必须**直接注入 `seededNames`，**严禁**经 `getSeededSkillNamesSafe()`（纯 Node 下降级 `[]` ⇒ seeded 用例假绿，`AGENTS.md:336` 明文）。

### 3. `syncAgentSystemPrompt()` 函数体**逐字不得改** —— 补播只能在调用侧

**两处钉着它**：46-04 的**方法体源码扫描断言** + 48 的**广播次数断言**。
**正确形状**（`ai-manager.js:1697-1699`，D-19 的逐行模板）：
```js
    // ④ 收口与补播：与 setSkillDisabled 同一套次数账（重扫恰一次 + 补播恰一次）
    await this.ensureSkillsFresh();
    windowManager.broadcast('skills:changed');
```
**为什么补播是必要的**（`setSkillDisabled` 的 JSDoc `:1652-1658` 逐字给出了论证，新代码应复用该论证）：`syncAgentSystemPrompt()` 在 `isProcessing || streaming` 时**只置脏、return、不广播**；而设置页点「导入确认」**不经过 Agent 轮次** ⇒ 用户若不再发消息，`/` 面板会一直显示旧技能集。
**四条纪律**：① `await this.ensureSkillsFresh()` **恰一次**；② 补播 `windowManager.broadcast('skills:changed')` **恰一次**（幂等，renderer 侧监听已改为无条件重拉）；③ **禁止**把补播挪进 `syncAgentSystemPrompt()` 的函数体；④ `ensureSkillsFresh()` 是**读侧 / 兜底**，**不并入**写路径份额账（双账本：51 完成后写路径 3/3 可闭合 `STATE.md` 的 ⚠️，**不得**声称 P8 6/6）。

---

## No Analog Found

| 落点 | Role | Data Flow | 原因 / 处置 |
|---|---|---|---|
| `tests/helpers/make-malicious-zip.js`（夹具生成器） | utility | file-I/O（二进制写盘） | **仓内无 `tests/helpers/` 也无 `tests/fixtures/`**（实测 `ls` 为空）。按 `51-RESEARCH.md` §Code Examples 例 1（`:1213-1234`）移植：Python `zipfile` 可完全控制 `external_attr`（symlink / 权限位）；手写 local/central/EOCD 表达 `data descriptor` / 谎报 usize / `0xFFFFFFFF` / 加密位 / 不支持的方法 / NUL 与控制字符名。**必须固化进仓库**（CR-12：不得只留 `/tmp`）。 |
| `tests/fixtures/skill-packages/**` | test data | — | 同上。至少覆盖：symlink（file / dir / 混装）、非普通文件（chrdev / fifo / socket）、逃逸族 12 例、冲突名 4 例（大小写 2 + NFC/NFD 2）、炸弹 3 例、`0xFFFFFFFF`、加密条目、不支持的方法、空包、data descriptor、zip64。 |
| ZIP 解析 / inflate / central directory / zip64 | — | streaming | 自写解析器**禁止**（P11）。用 `yauzl@^3.4.0`。**四条实测约束**见 RESEACH `:493-576`（Pitfall 1-3）：① `eachEntry()` 的 iterator `return()` 会 `close()` 整个 zipfile（`autoClose` 默认 true）⇒ **必须在 `for await` 体内开流**；② `validateFileName` 六类放行 ⇒ **自建 entry 名校验**；③ `uncompressedSize === 0xFFFFFFFF` 完全静默 ⇒ **显式拒绝**；④ 错误分四个处理面（open reject / for-await throw / `ZipFile` 'error' 事件 / readStream error）。 |
| 二进制流式下载（逐跳 + 流式字节上限 + magic bytes） | — | streaming | **仓内无先例**。`search-manager.fetchUrl` 是**反面参照**（`res.text()` + 12k **字符**截断对二进制破坏性 = Anti-Pattern 7）。`media-remuxer.js:514-579` 只提供「流式写盘 + 失败 `unlinkSync` 清半成品 + `settled` 幂等」的**局部形态**可借（`:550-563`），网络层须从零写。 |
| zip 上传的 raw binary body 读取 | — | streaming | `readJsonBody` 是**字符串**版本（`:940-966`）；`readRawBody` 是本阶段首次引入的 `Buffer.concat` 版本。形态照抄 `:936-978` 的三条教训，**唯一差异**是 `chunks.push(chunk)` + `Buffer.concat(chunks)`。 |
| YAML frontmatter 解析 | — | transform | 既有 `yamlScalar`（`ai-skills-manager.js:121-126`）只**写不读**（且注释明文禁止 import `yaml`）。D-14 把 `yaml` 提升为直接依赖后，**必须同步改文件头的依赖纪律注释**（`:18-21` + `:115-116`），否则后续开发者会按旧注释把它删掉。 |
| `importId` 的 TTL / 并发上限 | service | request-response | 仓内**无 TTL 先例**。`main.js` 的模块级两阶段状态（`:1237-1238`）是 partial analog（无 TTL、无并发上限、无崩溃清扫）；`builtin-skills-seeder.sweepSeedResidue`（`:255`）是崩溃清扫的 partial analog，但**带 WR-05 的陈旧性缺陷**（`47-REVIEW.md:212-219`）—— 本阶段**必须**补陈旧性判据，不得复制该缺陷。 |
| 技能根定位（顶层前缀剥离 + 子路径 + 全包扫描） | utility | transform | 仓内无先例。配方见 `51-RESEARCH.md` 例 5（`:1328-1337`）与 CR-7（全包扫描**不得**限定 `skills/*` —— `anthropics/skills` 的 `template/SKILL.md` 在包根）。 |

---

## Metadata

**Analog search scope:** 仓库根 + `src/` + `src/styles/` + `tests/` + `docs/product/` + `scripts/`（`node_modules/` 排除）
**Files scanned:** 24（逐一 `Read` 并提取行号片段；另对 `main.js` / `ai-skills-manager.js` / `ai-manager.js` / `src/settings-page.js` / `tests/*` 做定点区间读，避免整文件载入）
**Tracked-source 校验:** 全部 analog 路径经 `git ls-files -- <path>` 确认为受追踪源（21 个文件全部命中，无 gitignored 镜像路径）
**Pattern extraction date:** 2026-09-15

**本文件的三个承重结论（planner 引用时不得弱化）**：
1. **「只有一个落盘实现」是源码扫描判据**，不是设计口号 —— 三种来源的落盘必须汇入 `importUserSkill()` 单点，`stripCodeComments` + 窗口切片写法已在 `tests/test-skills-http-api.js:58-108` 备好。
2. **`MANAGE_SKILL_ERROR` 恰 11 键被 `tests/test-manage-skill.js:1589` 锁死** ⇒ 导入码必须另立 `IMPORT_SKILL_ERROR`（CR-3），并走「常量 + 产品文档错误码表 + `AGENTS.md` 测试清单」三处一起刷。
3. **`readRawBody` 照抄 `main.js:936` 的三条教训**（累积中拒收 / 不断连 / `res` 缺失降级），唯一差异是 `Buffer.concat` —— 且**禁止**「先 `arrayBuffer()` 再判大小」。

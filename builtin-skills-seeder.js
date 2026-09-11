/**
 * Realm Browser - 内置技能播种模块
 *
 * 本模块是**随包内置技能的唯一播种者**：启动期把随包 `skills-builtin/<name>/`
 * 逐个技能目录同步到 `agent-workspace/managed-skills/<name>/`，使技能加载器
 * （ai-skills-manager）零诊断地识别它们。
 *
 * 设计契约（Phase 47 D-08 / D-09 / D-10 / D-11 / D-12）：
 * - **写入目标**：`agent-workspace.getManagedSkillsDir()`（沙箱 root 内的唯一 managed 目录）。
 * - **seeded 身份** = 随包 `skills-builtin/` 的目录名集合 —— **零状态文件、零硬编码**
 *   （硬编码会让日后新增的内置技能永不播种；状态文件会跨环境分叉且可被删改）。
 * - **粒度**：按**单个技能目录**判定与同步，不为已存在的技能提前返回。
 * - **覆盖**：managed 目录是 app-owned 内容；**内容一致时跳过写盘**
 *   （`detectDiff` 判 `same` → 不复制、不产诊断），差异或缺失时才写。
 *   覆盖前若磁盘内容与随包内容不一致，先产 warning 级诊断，再覆盖（D-09「不静默」）。
 * - **原子性**：先写 `<dst>.tmp_<ts>` → 必要时把旧目录改名为 `<dst>.bak_<ts>` →
 *   `rename` 覆盖 → 删 bak；`rename` 失败则回滚 bak，不留半成品目录。
 * - **失败处理**：任何失败仅 `console.error` + 产诊断，**不 throw、不阻断应用启动**
 *   （照 agent-workspace.migrateAiMemory 的先例）；**所有累积诊断在播种结束（含早退
 *   路径）按级别统一经 `console.error` / `console.warn` 输出** —— `getSeedDiagnostics()`
 *   目前没有生产消费方，Phase 50 接入技能面板之前这条 console 兜底不得删除；
 *   **逐技能循环之外抛出的异常由最外层 `catch` 的 `console.error` 承接**
 *   （此时诊断为空，该行是本路径的唯一可见面，不得删除）。
 * - **打包源**：`app.isPackaged` 时读 `process.resourcesPath/app.asar.unpacked/skills-builtin`，
 *   开发态显式回落 `__dirname/skills-builtin`（D-12；与 favorites-manager 的
 *   nodejieba 先例同构，差异点是开发态必须显式回落而不是「不设路径」）。
 *
 * electron 依赖惰性获取（与 agent-workspace.js 先例一致）：纯 Node 测试环境下
 * electron 模块不可加载，延迟到真正需要路径解析时才引入。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const agentWorkspace = require('./agent-workspace');

/** 随包源目录覆写（测试注入；null 回落 resolveBuiltinSkillsSrc() 的默认解析） */
let _srcDirOverride = null;

/** managed 技能目录覆写（测试注入；null 回落 agentWorkspace.getManagedSkillsDir()） */
let _managedDirOverride = null;

/** 模块级诊断累积（每次 seedBuiltinSkills() 入口清空，供 Phase 50 与测试读取） */
let _diagnostics = [];

/**
 * 解析随包内置技能源目录（D-12）
 *
 * 打包态：`process.resourcesPath/app.asar.unpacked/skills-builtin`
 *   —— 由 package.json 的 `build.asarUnpack: ["skills-builtin/**"]` 解包得到真实文件路径
 *      （两处必须成对，漏一侧即在正式版静默失败；nodejieba 事故 9a1ae11 同型）。
 * 开发态：`__dirname/skills-builtin`（仓库根）
 *   —— 与 nodejieba 先例的差异点：nodejieba 在开发态走默认查找，而本目录必须显式回落。
 *
 * @returns {string} 随包内置技能源目录的绝对路径
 */
function resolveBuiltinSkillsSrc() {
  if (_srcDirOverride) return _srcDirOverride;
  const { app } = require('electron');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'skills-builtin');
  }
  return path.join(__dirname, 'skills-builtin');
}

/**
 * 解析播种写入目标（managed 技能目录）
 *
 * 默认取 `agentWorkspace.getManagedSkillsDir()`（由 getWorkspaceDir() 派生，
 * 保证落在硬沙箱 root 内）；测试可用 `setBuiltinDepsForTest({ managedDir })` 覆盖。
 *
 * @returns {string} managed 技能目录绝对路径
 */
function resolveManagedSkillsDir() {
  if (_managedDirOverride) return _managedDirOverride;
  return agentWorkspace.getManagedSkillsDir();
}

/**
 * seeded 身份判定（D-11）：随包 `skills-builtin/` 下**含 SKILL.md 的子目录名**集合
 *
 * 零状态文件、零硬编码 —— 该判定同时服务 Phase 48（`seeded` 来源徽标）与
 * Phase 49（按此判定拒绝覆盖 / 删除 seeded 技能）。本函数**只过滤、不产诊断**；
 * 缺 `SKILL.md` 的源子目录由 seedBuiltinSkills() 的独立源目录扫描报出
 * （`realm_builtin_src_invalid`），二者是「先报后滤」的串行关系。
 *
 * @returns {string[]} 可播种的技能目录名数组；源目录不存在时返回 []
 */
function getSeededSkillNames() {
  const srcDir = resolveBuiltinSkillsSrc();
  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (!fs.existsSync(path.join(srcDir, entry.name, 'SKILL.md'))) continue;
    names.push(entry.name);
  }
  return names;
}

/**
 * 递归收集目录下的相对路径（正斜杠分隔，已排序）
 *
 * **目录以 `rel + '/'` 形式登记**（文件条目不带尾斜杠）—— 这是为了让**空目录**
 * 也参与 detectDiff 的第 ② 层路径集合比较：否则「源侧新增一个空目录」在两侧
 * 路径集合上完全相同 → 判 `same` → 跳过重建 → **该空目录永远自愈不到目标**
 * （`same` 跳过重建落地后，空目录若不入集合就再没有任何机会被补上）。
 *
 * ⚠ **调用方契约**：本函数返回的数组是**混合**的（目录项以 `/` 结尾、文件项不带）。
 * size / sha256 两层**必须先过滤掉以 `/` 结尾的条目**再 `statSync` / `hashFile` ——
 * 目录条目喂给 `hashFile` 会让 `fs.readFileSync(dir)` 抛 `EISDIR`，被 detectDiff 的
 * fail-safe catch 吞成 `'different'`，于是每次启动都重建（正是本 gap 要消除的现象）。
 *
 * 只读目录项，不读文件内容（供 detectDiff 的第 ② 层短路使用）。
 *
 * @param {string} dir - 目录绝对路径
 * @returns {string[]} 相对路径数组（目录项以 '/' 结尾；已排序）
 */
function listRelativeFiles(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childAbs = path.join(abs, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push(`${childRel}/`); // 目录项：尾斜杠标记，使空目录也参与集合比较
        walk(childAbs, childRel);
      } else {
        out.push(childRel);
      }
    }
  };
  walk(dir, '');
  out.sort();
  return out;
}

/**
 * 计算单个文件的 sha256 摘要（仓库既有口径：crypto.createHash('sha256')）
 * @param {string} file - 文件绝对路径
 * @returns {string} 十六进制摘要
 */
function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * 检测随包源目录与磁盘目标目录的内容差异（D-09）
 *
 * 逐层短路（从便宜到贵），**绝不用 mtime**：
 *   ① 目标不存在            → 'missing'（零 IO 成本）
 *   ② 两侧相对路径集合不等  → 'different'（只读目录项，**含目录条目**）
 *   ③ 逐文件 size 不等      → 'different'（只 stat，不读内容）
 *   ④ 逐文件 sha256 不等    → 'different'（唯一读内容的一步）
 *   ⑤ 全同                  → 'same'
 *
 * **为什么不用 mtime**：safeCopyDir 每次同步都会重写 mtime，用 mtime 判差异等于
 * 每次启动都 100% 误报 `realm_builtin_seed_overwritten`（"用户手改过"）。
 * 这条注释是防止未来把它「优化」成时间戳比较的护栏。
 *
 * 第 ③ 层短路在前，天然保证**同一个 detectDiff 调用内每个文件至多算一次 sha256**。
 *
 * **第 ③④ 层只遍历文件条目**（`listRelativeFiles` 返回的是目录项以 `/` 结尾的混合
 * 数组，故先 `endsWith('/')` 过滤）。这条过滤是**必须的**：目录条目若进入
 * `statSync` / `hashFile`，轻则 size 比较无意义，重则 `fs.readFileSync(dir)` 抛
 * `EISDIR` → 被本函数的 fail-safe catch 吞成 `'different'` → **每次启动都重建**，
 * 正是本 gap 要消除的现象。
 *
 * 遍历 / statSync / hashFile 途中抛出的**任何 IO 错误**一律捕获并返回 'different'
 * （fail-safe：不确定就当作需要重新同步），错误经 console.error 记录但不向上抛 ——
 * 否则整个播种会被跳过。
 *
 * @param {string} srcDir - 随包技能目录
 * @param {string} dstDir - 磁盘技能目录
 * @returns {'same'|'different'|'missing'} 差异判定
 */
function detectDiff(srcDir, dstDir) {
  // 绝不使用 mtime / mtimeMs / birthtime 判差异：safeCopyDir 每次同步都会重写
  // mtime，用时间戳判差异等于每次启动都 100% 误报 realm_builtin_seed_overwritten
  // （「用户手改过」）。这条护栏请勿「优化」掉。
  try {
    if (!fs.existsSync(dstDir)) return 'missing';
    const srcEntries = listRelativeFiles(srcDir);
    const dstEntries = listRelativeFiles(dstDir);
    if (srcEntries.length !== dstEntries.length) return 'different';
    for (let i = 0; i < srcEntries.length; i += 1) {
      if (srcEntries[i] !== dstEntries[i]) return 'different';
    }
    // 目录条目必须过滤掉：目录喂给 statSync / hashFile 毫无意义，且 readFileSync(dir)
    // 会抛 EISDIR → 被下面 catch 吞成 'different' → 每次启动都重建（本 gap 的现象）。
    const srcFiles = srcEntries.filter((rel) => !rel.endsWith('/'));
    const dstFiles = dstEntries.filter((rel) => !rel.endsWith('/'));
    for (const rel of srcFiles) {
      const a = fs.statSync(path.join(srcDir, rel));
      const b = fs.statSync(path.join(dstDir, rel));
      if (a.size !== b.size) return 'different';
    }
    for (const rel of srcFiles) {
      const a = hashFile(path.join(srcDir, rel));
      const b = hashFile(path.join(dstDir, rel));
      if (a !== b) return 'different';
    }
    return 'same';
  } catch (err) {
    // fail-safe：IO 错误 = 不确定 → 当作需要重同步（绝不让播种被整体跳过）
    console.error('[Realm] 内置技能差异检测失败（按需重同步处理）:', err && err.message);
    return 'different';
  }
}

/**
 * 清理目录（自身吞错：残留比「报了失败但其实成功了」更可接受）
 * @param {string} dir - 待删目录
 */
function _cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

/**
 * 启动级残留清扫：清掉 `safeCopyDir` 崩溃/被杀留下的 tmp / bak 兄弟目录（GAP 3 / WR-02）
 *
 * ① **为什么必须清**：`safeCopyDir` 的 `<dst>.tmp_<ts>` / `<dst>.bak_<ts>` 由 `dst`
 *    派生（**D-08 的原子性契约**：与 dst 同父目录 → 必然同卷，刻意的设计），因此
 *    它们**落在 `managed-skills/` 这个技能扫描根内**。而 `ai-skills-manager` 的
 *    `inContractLayout` 只要求「相对扫描根恰好 2 段」——
 *    `managed-skills/<name>.bak_<ts>/SKILL.md` 恰好 2 段 → **被当成合法技能加载**，
 *    成为设置页删不掉的永久幽灵条目（+ 名称含 `.`/`_` 必然触发的 `invalid_metadata`
 *    与 `realm_name_rewritten` 诊断噪声）。
 * ② **残留的产生方式**：进程在两次 `rename` 之间被杀、`_cleanupDir(bakDst)` 失败、
 *    复制阶段崩溃 —— 都不是正常的持久状态，属 app-owned 内容在崩溃后的自我修复。
 * ③ **正则为何锚定 `\d+$`**：`safeCopyDir` 只用 `Date.now()` 作时间戳，且宽泛的
 *    `includes('.bak_')` 会误删名字恰好**合法**的目录。**也正因如此不需要「已知播种
 *    名单」**（D-11：零硬编码、零状态文件）—— 判据是命名形状而不是身份表。
 * ④ **best-effort**：`readdirSync` 与删除都走吞错路径（复用 `_cleanupDir`），
 *    绝不 throw、绝不阻断播种 —— 与模块头「失败仅 console.error + 产诊断」一致。
 *
 * **不产诊断、不打日志**：残留回收是崩溃后的自我修复，不是需要用户知晓的异常；
 * 且 GAP 4 的 console 通道专用于**失败可见性**。若日后确需可见，Phase 50 可加一条
 * warning 级结构化诊断 —— **不得**在本计划里加，以免与已写定的文档口径不一致。
 *
 * @param {string} managedDir - managed 技能目录（技能扫描根之一）
 */
function sweepSeedResidue(managedDir) {
  let entries = [];
  try {
    entries = fs.readdirSync(managedDir);
  } catch {
    return; // 目录不存在或不可读：无可清扫，也不阻断播种
  }
  for (const name of entries) {
    // 成对不变式：命名形状必须与 safeCopyDir 的 `<dst>.tmp_<ts>` / `<dst>.bak_<ts>` 同步
    if (/\.(tmp|bak)_\d+$/.test(name)) _cleanupDir(path.join(managedDir, name));
  }
}

/**
 * 递归检查目录内是否有符号链接（fail-closed）
 *
 * 随包源是 git 追踪的静态文本，**绝不应含 symlink**；跟随复制等于把工作区外的
 * 目标内容注入技能目录（T-47-01-04）。遇 symlink 直接抛错，由 safeCopyDir 的
 * catch 转成 `realm_builtin_seed_failed` 并跳过该技能。
 *
 * @param {string} dir - 待检查目录
 */
function assertNoSymlink(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`源目录含符号链接，拒绝播种: ${child}`);
    }
    if (entry.isDirectory()) assertNoSymlink(child);
  }
}

/**
 * 递归复制目录到目标位置（副本侧无原子性保证；原子性由 safeCopyDir 负责）
 *
 * 用 `fs.cpSync` 而不是手写递归（仓库先例：agent-workspace.migrateAiMemory）。
 *
 * @param {string} src - 源目录
 * @param {string} dst - 目标目录（不应已存在）
 */
function copyDirRecursive(src, dst) {
  assertNoSymlink(src);
  fs.cpSync(src, dst, { recursive: true });
}

/**
 * 原子目录替换（D-08 的原子性契约，照 openhanako safe-fs.ts 的算法形状）
 *
 * 1. 复制 src → `<dst>.tmp_<ts>`
 * 2. 若 dst 存在：`rename(dst, <dst>.bak_<ts>)`
 * 3. `rename(<dst>.tmp_<ts>, dst)`
 * 4. 删除 `<dst>.bak_<ts>`
 * 失败回滚：第 3 步失败时把 bak 改回 dst，并清理 tmp。
 *
 * 三条必须保留：timestamped 命名、回滚路径、失败清理 tmp。
 * 三条与原型不同：① 用 fs.cpSync 代替手写递归；② 遇 symlink fail-closed；
 * ③ `_cleanupDir(bakDst)` 自身吞错（清理失败不改变「替换已成功」的事实）。
 *
 * **卷约束**：tmp 与 bak 必须是 `<dst>.tmp_<ts>` / `<dst>.bak_<ts>`（与 dst 同父目录
 * → 必然同卷）；**不要放 `os.tmpdir()`**（macOS `/var/folders` 可能异卷 →
 * `renameSync` 抛 `EXDEV`）。
 *
 * @param {string} src - 源目录
 * @param {string} dst - 目标目录
 */
function safeCopyDir(src, dst) {
  // 源目录不存在：提前返回（不做无谓的 readdirSync，也不抛错）
  if (!fs.existsSync(src)) return;
  const ts = Date.now();
  const tmpDst = `${dst}.tmp_${ts}`;
  const bakDst = `${dst}.bak_${ts}`;
  try {
    copyDirRecursive(src, tmpDst);
    let hadExisting = false;
    if (fs.existsSync(dst)) {
      fs.renameSync(dst, bakDst);
      hadExisting = true;
    }
    try {
      fs.renameSync(tmpDst, dst);
    } catch (renameErr) {
      if (hadExisting) {
        try {
          fs.renameSync(bakDst, dst);
        } catch {
          /* 回滚尽力而为 */
        }
      }
      _cleanupDir(tmpDst);
      throw renameErr;
    }
    if (hadExisting) _cleanupDir(bakDst);
  } catch (err) {
    _cleanupDir(tmpDst);
    throw err;
  }
}

/**
 * 扫描随包源目录，找出**缺少 SKILL.md** 的子目录（`realm_builtin_src_invalid` 的触发面）
 *
 * **为什么必须是独立扫描而不是复用 getSeededSkillNames() 的返回**：后者已经用
 * `fs.existsSync(path.join(dir, 'SKILL.md'))` 把缺 SKILL.md 的子目录过滤掉了 ——
 * 若该诊断的唯一上游是它的返回，这条 code 永远收不到输入（不可达的保留 code）。
 * 二者是「**先报（本函数扫描）后滤（getSeededSkillNames 筛选）**」的串行关系，
 * **不是**互为表里。
 *
 * @param {string} srcDir - 随包技能源目录
 * @returns {string[]} 缺 SKILL.md 的子目录绝对路径；源目录不可读时返回 []
 */
function collectInvalidSrcDirs(srcDir) {
  const invalid = [];
  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return invalid;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(srcDir, entry.name);
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) invalid.push(dir);
  }
  return invalid;
}

/**
 * 把本次累积的诊断按级别统一输出到 console（GAP 4 / WR-04，**D-09「不静默」的可见面**）
 *
 * ① **为什么必须有这条**：三条内层失败路径（`realm_builtin_src_missing` /
 *    `realm_builtin_src_invalid` / `realm_builtin_seed_failed`）与
 *    `realm_builtin_seed_overwritten` 原先只把诊断 push 进 `_diagnostics`，而
 *    `getSeedDiagnostics()` **在生产代码里没有任何调用方**（全仓 grep 除本模块自身与
 *    测试外零命中）→ 「内置技能一个都没播种成功」的正式版与一切正常的正式版在用户侧
 *    与日志侧完全不可区分（与模块头引用的 nodejieba 事故 9a1ae11 同型）。
 * ② **Phase 50 之前不得删除**：Phase 50 把 `getSeedDiagnostics()` 接进技能面板 /
 *    诊断通道后，这条 console 兜底才可以降级或移除。
 * ③ **不阻断启动**：只读 `_diagnostics` 并写 console，无 throw 路径。
 *
 * **与最外层 `catch` 的关系是并列、不是替代**：本函数只输出 `_diagnostics`；顶层 catch
 * 覆盖的是逐技能循环**之外**抛出的异常（此时 `_diagnostics` 为空 → 本函数零输出），
 * 那条路径的可见面只能由 catch 自己的 `console.error` 提供。
 */
function _flushDiagnostics() {
  for (const d of _diagnostics) {
    const line = '[Realm] 内置技能播种 ' + d.level + ' ' + d.code + ': ' + d.message;
    if (d.level === 'error') console.error(line);
    else console.warn(line); // warning（以及未来可能出现的其它级别）
  }
}

/**
 * 播种随包内置技能到 managed 技能目录（同步，启动期一次性调用）
 *
 * 启动链路位置：`main.js` 的 `migrateAiMemory()` 之后、`new AIManager()` 之前
 * —— 必须早于 `aiManager.init()` → `refreshSkills()`，否则首轮加载看不到内置技能。
 *
 * 与 `migrateAiMemory()` **没有任何数据依赖**：两者是两次独立调用、各自独立的
 * try/catch，一方失败不改变另一方的输入与行为（`skills-builtin/` 是随包目录，
 * 与 `ai-memory/` 迁移无关）。
 *
 * 诊断 code：
 * - `realm_builtin_src_missing`（error）：源目录不存在或无任何含 SKILL.md 的子目录
 * - `realm_builtin_src_invalid`（error）：源目录下某个子目录缺 SKILL.md（独立扫描先于过滤）
 * - `realm_builtin_seed_overwritten`（**warning**）：磁盘内容与随包内容不一致，覆盖前报出
 * - `realm_builtin_seed_failed`（error）：单技能目录播种失败（含 symlink 拒绝）
 */
function seedBuiltinSkills() {
  _diagnostics = [];
  try {
    const srcDir = resolveBuiltinSkillsSrc();
    // 先报：独立源目录扫描（必须早于 getSeededSkillNames() 的过滤）
    for (const badDir of collectInvalidSrcDirs(srcDir)) {
      _diagnostics.push({
        level: 'error',
        code: 'realm_builtin_src_invalid',
        message: `随包内置技能目录缺少 SKILL.md，已跳过：${path.basename(badDir)}`
          + '（内置技能必须是 <name>/SKILL.md 的目录布局）',
        path: badDir,
      });
    }
    // 后滤：可播种技能名（seeded 身份的权威来源）
    const names = getSeededSkillNames();
    if (names.length === 0) {
      _diagnostics.push({
        level: 'error',
        code: 'realm_builtin_src_missing',
        message: `随包内置技能源目录不存在或不含任何技能：${srcDir}`,
        path: srcDir,
      });
      return;
    }
    const managedDir = resolveManagedSkillsDir();
    fs.mkdirSync(managedDir, { recursive: true });
    // 崩溃残留清扫（GAP 3 / WR-02）：必须在逐技能循环**之前** —— 否则本轮播种完的
    // refreshSkills() 仍会看到残留（且清扫要下一轮才生效）。
    // **不放在 `names.length === 0` 的早退之前**：那条路径连 managedDir 都还没解析，
    // 且随包源缺失时清理用户目录中的任何东西都不合适。
    sweepSeedResidue(managedDir);
    // 逐个技能目录判定与同步 —— 不得整目录一次性判定/提前返回，
    // 否则日后新增的内置技能永远播不进去（D-08）。
    for (const name of names) {
      const skillSrc = path.join(srcDir, name);
      const skillDst = path.join(managedDir, name);
      try {
        const diff = detectDiff(skillSrc, skillDst);
        // D-08 的精度化：内容一致 → 不写盘、不产诊断（`realm_builtin_seed_overwritten`
        // 只表达「磁盘内容与随包版本不一致」，`same` 与 `missing` 都不产）。
        // 跳过重建同时消掉了两个副作用：detectDiff 最贵的 sha256 层不再被白算，
        // 且不再每次启动都制造一次 rename(dst → bak) 空窗（那是 GAP 3 残留的触发源）。
        if (diff === 'same') continue;
        if (diff === 'different') {
          _diagnostics.push({
            level: 'warning',
            code: 'realm_builtin_seed_overwritten',
            message: `内置技能 "${name}" 的磁盘内容与随包版本不一致，已被随包版本覆盖。`
              + '内置技能不能删除或修改：如需长期定制，请把同名技能放到 agent-workspace/skills/'
              + '（user 来源会遮蔽内置技能）；如不需要它，请在 设置 → AI → 技能管理 中禁用。',
            path: skillDst,
            skillName: name,
          });
        }
        // 覆盖 `missing`（直接写，不产诊断 —— D-10 自愈语义）与 `different`
        safeCopyDir(skillSrc, skillDst);
      } catch (err) {
        _diagnostics.push({
          level: 'error',
          code: 'realm_builtin_seed_failed',
          message: `内置技能 "${name}" 播种失败：${err && err.message ? err.message : String(err)}`,
          path: skillDst,
          skillName: name,
        });
      }
    }
  } catch (err) {
    // 本 catch 覆盖循环之外的异常（resolveBuiltinSkillsSrc / resolveManagedSkillsDir /
    // mkdirSync …）—— 此时 `_diagnostics` 为空，finally 里的 _flushDiagnostics() 零输出。
    // 它的 console.error 是这条路径的**独立可见面**，不得被 _flushDiagnostics() 取代。
    console.error('[Realm] 内置技能播种失败（不影响启动）:', err && err.message);
  } finally {
    // 早退路径（src 缺失）也走这里 —— 不能只在循环后输出。
    _flushDiagnostics();
  }
}

/**
 * 读取本次播种累积的诊断（形状对齐 ai-skills-manager 的 realm_ 诊断：
 * `{ level, code, message, path, skillName? }`）
 *
 * 调用方（Phase 50 的技能面板 / 诊断通道）接入前，`_flushDiagnostics()` 的 console
 * 输出是打包态唯一可见面 —— 本函数目前在生产代码中无调用方，但**不得删除**
 * （结构化诊断仍是 Phase 50 的正式接口）。
 *
 * @returns {object[]} 诊断数组的浅拷贝
 */
function getSeedDiagnostics() {
  return _diagnostics.slice();
}

/**
 * 注入测试依赖（测试临时目录注入唯一入口）
 *
 * **抽象层次说明（避免误解）**：本注入器收的是**更高层的目录**，不是 Electron 原语 ——
 * - `srcDir` 直接**覆盖 `resolveBuiltinSkillsSrc()` 的返回值**（测试钩子短路该函数），
 *   而不是去伪造 `app.isPackaged` / `process.resourcesPath`；
 * - `managedDir` 同理**覆盖 `getManagedSkillsDir()` 的返回值**。
 *
 * @param {{srcDir?: string|null, managedDir?: string|null}} [deps]
 *   srcDir：随包源目录绝对路径（null 恢复默认解析）
 *   managedDir：managed 技能目录绝对路径（null 恢复 agentWorkspace.getManagedSkillsDir()）
 */
function setBuiltinDepsForTest(deps) {
  const d = deps || {};
  if ('srcDir' in d) _srcDirOverride = d.srcDir;
  if ('managedDir' in d) _managedDirOverride = d.managedDir;
}

/** 复位模块状态（仅测试用；跨用例污染会让后续断言假失败） */
function _resetForTest() {
  _srcDirOverride = null;
  _managedDirOverride = null;
  _diagnostics = [];
}

module.exports = {
  seedBuiltinSkills,
  resolveBuiltinSkillsSrc,
  getSeededSkillNames,
  getSeedDiagnostics,
  setBuiltinDepsForTest,
  _resetForTest,
  // 内部函数导出：仅为测试可直接断言（detectDiff 的 IO fail-safe、safeCopyDir 的
  // 原子性 / 半成品不留存）。生产调用方只应使用上面 6 个成员。
  detectDiff,
  safeCopyDir,
};

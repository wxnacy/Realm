/**
 * Realm Browser - AI 技能管理模块
 *
 * 技能集的**单一数据权威**：异步加载（refreshSkills）→ 模块级缓存（_cache）
 * → 同步只读（buildSkillsPrompt / getSkillsSnapshot）。技能目录固定于
 * agent 工作区硬沙箱 root 内（agent-workspace 的 skills/ 与 managed-skills/），
 * 因此 prompt 段里 <location> 指向的绝对路径可被 AI 的 read 工具直接打开。
 *
 * 渐进式披露契约：进 system prompt 的**只有 name / description / location**
 * 三项元数据（由 SDK formatSkillsForSystemPrompt 产出）；SKILL.md 正文（body）
 * 只在模型匹配到 description 后经 read 工具按需读取，**绝不进 prompt**。
 *
 * **SDK 契约按 `@earendil-works/pi-agent-core@0.84.3` 逐一核对**（源码直读 +
 * 本机探针）。升版后必须复核 loadSkills 的递归语义、根层 includeRootFiles
 * 硬编码行为、诊断字段名与 Skill 字段表 —— 任一变化都可能让本模块的收窄
 * 或映射静默失效。
 *
 * 依赖纪律：本模块**不得**有 electron 依赖、不得顶层 import SDK（SDK 为
 * ESM-only，一律用包根动态 import）；也不得直接引入 SDK 的传递依赖
 * （其 frontmatter 解析与忽略文件匹配实现只经 SDK 往返获得，不自行引入）。
 */

const path = require('path');

/**
 * 技能限额单源（D-11）—— 端点、设置页前端与渲染层不得出现同类字面量。
 *
 * 两条独立限额，单位不同、互不换算：
 * - MAX_SKILL_MD_BYTES：SKILL.md 正文字节数（按 sandbox FileInfo.size 计数）
 * - SKILLS_PROMPT_CHAR_BUDGET：prompt 元数据段的字符数（按 JS string.length 计数）
 */
const LIMITS = {
  MAX_SKILL_MD_BYTES: 64 * 1024,
  MAX_USER_SKILLS: 50,
  SKILLS_PROMPT_CHAR_BUDGET: 8000,
};

/** 空缓存形状（模块级唯一权威的初始值与复位值） */
const EMPTY_CACHE = () => ({
  skills: [],
  promptBlock: '',
  digest: '',
  diagnostics: [],
  errors: [],
  refreshedAt: 0,
});

/**
 * 模块级技能快照（唯一权威）
 *
 * 形状：{ skills, promptBlock, digest, diagnostics, errors, refreshedAt }
 * - skills：缓存条目 `{ skill, source, diagnostics }`，source 取 'user' | 'managed'
 *   （遮蔽败者额外带 `shadowed: true` 与 `shadowedBy`）；条目级 `diagnostics`
 *   即 D-07 语境中的 `skill.diagnostics[]` —— 诊断挂在**缓存条目**上，
 *   `Skill` 本体保持 SDK 五字段形状不被注入私有字段
 * - promptBlock：SDK formatSkillsForSystemPrompt 的返回值（空集为 ''）
 * - digest：技能集稳定序列化后的短摘要（技能集是否变化的快速判定主键）
 * - diagnostics：加载期诊断（SDK 原样形状 + Realm 自建，code 以 realm_ 前缀区分）
 * - errors：无对应技能的整批错误（D-05 第 2 层）
 */
let _cache = EMPTY_CACHE();

/** 字符串稳定摘要（非加密，纯内存零依赖；仅用于「技能集是否变化」的快速判定） */
function hashString(input) {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * 计算技能集摘要
 *
 * **唯一消费方与口径（务必保持）**：46-04 的 `syncAgentSystemPrompt()` 把
 * digest 当作「技能集是否变化」的快速判定主键 —— digest 相同**且**
 * `buildSystemPrompt()` 与 `agent.state.systemPrompt` 逐字符相同，才跳过
 * 回写与广播。因此 digest 的输入必须覆盖影响 prompt 段的全部因素。
 *
 * @param {Array<{skill: object, source: string}>} entries - 缓存条目数组
 * @returns {string} 客户端摘要
 */
function computeDigest(entries) {
  return hashString(entries.map((e) => JSON.stringify([
    e.skill.name,
    e.skill.description,
    e.skill.filePath,
    e.skill.disableModelInvocation === true,
    e.source,
  ])).join('\n'));
}

/**
 * 技能语义 env：在沙箱 env 之上收窄加载面（不替代沙箱，只叠加）
 *
 * 结构纪律照抄 agent-workspace 的 createSandboxEnv —— **显式转发 + 展开**
 * 而不是选择性只包「关键方法」或 Proxy：漏包一个方法就是静默落到非沙箱
 * 实现（逃逸口）。这里只覆写 listDir / readTextFile 两个方法做语义收窄，
 * 其余方法（含 createSandboxEnv 的全部路径校验）原样保留。
 *
 * 收窄的两处（主动防护发生在 SDK 遍历之前，事后过滤救不回来）：
 * 1. listDir：**只作用于两个扫描根本身**。根层非目录 entry 一律不交给 SDK
 *    —— 否则根层 SKILL.md 会短路整组（SDK 只看根层那一个）、根层散落
 *    带 description 的 *.md 会变成 name = 目录名的幽灵技能。技能自带的
 *    references/ scripts/ assets/ 在 <name>/ 之下，不在根上，不受影响。
 * 2. readTextFile：仅当 basename === 'SKILL.md' 时先按 FileInfo.size 预筛，
 *    超过 maxSkillMdBytes 则不读盘、不进 frontmatter 解析直接返回 invalid；其余
 *    路径（含忽略文件与技能自带资源）原样透传。
 *
 * 被滤掉的 entry 一律进 droppedNotices（调用方转成可读诊断）——**禁止静默**。
 *
 * @param {object} sandboxEnv - createSandboxEnv() 的返回值
 * @param {{rootDirs?: string[], maxSkillMdBytes?: number}} [opts]
 * @param {Array<{path: string, kind: string}>} [droppedNotices] - 被滤掉的非目录 entry 收集器
 * @returns {object} 叠加了语义收窄的技能 env
 */
function createSkillsEnv(sandboxEnv, opts = {}, droppedNotices = []) {
  const { rootDirs = [], maxSkillMdBytes = LIMITS.MAX_SKILL_MD_BYTES } = opts;
  const rootKeys = rootDirs.filter(Boolean).map((d) => path.resolve(d));
  const isScanRoot = (p) =>
    typeof p === 'string' && p !== '' && rootKeys.includes(path.resolve(p));

  return {
    ...sandboxEnv,

    async listDir(p, abortSignal) {
      const res = await sandboxEnv.listDir(p, abortSignal);
      if (!res || res.ok !== true) return res; // 不吞错：原样透传失败 Result
      if (!isScanRoot(p)) return res;
      const dirs = [];
      for (const entry of res.value) {
        if (entry.kind === 'directory') dirs.push(entry);
        else droppedNotices.push({ path: entry.path, kind: entry.kind });
      }
      return { ok: true, value: dirs };
    },

    async readTextFile(p, abortSignal) {
      if (path.basename(p) === 'SKILL.md') {
        const info = await sandboxEnv.fileInfo(p, abortSignal);
        if (info && info.ok && info.value.size > maxSkillMdBytes) {
          // SDK 为 ESM-only，包根动态 import（exports map 无子路径入口）
          const { FileError, err } = await import('@earendil-works/pi-agent-core');
          return err(new FileError(
            'invalid',
            `SKILL.md 超过 ${maxSkillMdBytes} 字节上限（当前 ${info.value.size} 字节）`,
            String(p)
          ));
        }
      }
      return sandboxEnv.readTextFile(p, abortSignal);
    },
  };
}

/**
 * 契约布局判定：`<scannedDir>/<name>/SKILL.md` —— 相对扫描根的段数**恰为 2**
 *
 * 用 `path.relative` 的**相对段数**判定，不是字符数也不是绝对路径段数
 * （绝对路径段数会随临时目录/用户名长度漂移）。
 *
 * **这是加载后的兜底过滤，不能替代 46-01 `createSkillsEnv.listDir` 的遍历前
 * 收窄**：根层 `SKILL.md` 一旦短路，SDK 只会返回根层那一个结果，事后过滤
 * 救不回来（过滤后技能集变空集，虽然好过被顶替，但仍需那条 `realm_root_entry_skipped`
 * 诊断说明原因）。两条防护互补、不可互相替代。
 *
 * @param {string} scannedDir - 扫描根绝对路径
 * @param {string} filePath - 技能文件（SKILL.md）绝对路径
 * @returns {boolean} 是否符合契约布局
 */
function inContractLayout(scannedDir, filePath) {
  return path.relative(scannedDir, filePath).split(path.sep).filter(Boolean).length === 2;
}

/**
 * 取条目所属的扫描根（`rootDirs` 中作为 `filePath` 前缀的那一项）
 *
 * 无归属（路径不在任何扫描根之下）时返回 null —— 调用方按「不可判定则不丢弃」
 * 处理（数据层优先，宁可保留也不静默剔除）。
 *
 * @param {string[]} rootDirs - 扫描根列表
 * @param {string} filePath - 技能文件绝对路径
 * @returns {string|null} 所属扫描根（已 resolve）或 null
 */
function scanRootOf(rootDirs, filePath) {
  const target = path.resolve(filePath);
  for (const root of rootDirs) {
    if (!root) continue;
    const resolved = path.resolve(root);
    const rel = path.relative(resolved, target);
    if (rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)) {
      return resolved;
    }
  }
  return null;
}

/**
 * 把一条 Realm 自建诊断同时写入「条目级 `diagnostics[]`」与「模块级 `_cache.diagnostics`」
 *
 * **口径声明（D-07）**：D-07 所说的 `skill.diagnostics[]` 落在**缓存条目**上
 * （条目即 D-07 语境中的「技能」）；`Skill` 本体保持 SDK 的五字段形状、不被
 * 注入私有字段（仅 `name` 按 D-08 被重写），避免向 SDK 类型污染 ——
 * 否则 SDK 侧消费者会看到非契约字段。
 *
 * 调用前提：`_cache.diagnostics` 已被本轮刷新初始化（见 refreshSkills）。
 *
 * @param {{diagnostics?: object[]}} entry - 缓存条目
 * @param {object} diag - 诊断对象（level / code / message / path / source）
 */
function pushEntryDiag(entry, diag) {
  if (entry && Array.isArray(entry.diagnostics)) entry.diagnostics.push(diag);
  _cache.diagnostics.push(diag);
}

/**
 * 名称权威重写：`skill.name` 以**所在目录名**为准（D-08）
 *
 * 理由：SDK 的名称是 `frontmatterName || parentDirName`（`skills.js:219`），
 * 且 `validateName` 只产 warning、不拒绝（`skills.js:237-251`）—— 于是
 * `skills/evil/SKILL.md` 声明 `name: find-skills` 可**合法冒名**（P3 前半，
 * S1 门禁）。重写既杜绝冒名，又不丢弃命名不规范的合法技能（GitHub 导入常见）。
 *
 * 副产物不变式：重写后集合内**每一条**的 `skill.name` 恒等于
 * `path.basename(path.dirname(skill.filePath))` —— 这既是 `/skill:name`
 * 解析确定性的前提，也是遮蔽判定无歧义（单目录内 name 天然唯一）的前提。
 *
 * 注意：目录名只能经 `filePath` 推导 —— SDK 的 `Skill` 只有五字段，没有
 * 位置字段（`<location>` 只是 `formatSkillsForSystemPrompt` 的 XML 标签名）。
 *
 * @param {{skill: {name: string, filePath: string}, source: string, diagnostics?: object[]}} entry
 */
function enforceDirNameAuthority(entry) {
  const dirName = path.basename(path.dirname(entry.skill.filePath));
  if (entry.skill.name === dirName) return;
  pushEntryDiag(entry, {
    level: 'warning',
    code: 'realm_name_rewritten',
    message: `frontmatter name "${entry.skill.name}" 与目录名 "${dirName}" 不一致，已按目录名生效`,
    path: entry.skill.filePath,
    source: entry.source,
  });
  // 就地重写：entry.skill 是本模块独占对象（loadSourcedSkills 的新返回）
  entry.skill.name = dirName;
}

/**
 * 同名遮蔽判定（D-06）：**后到者胜出**
 *
 * 输入顺序（managed 先、user 后）已经编码了优先级 —— 本函数**不重新定义
 * 优先级，只消费顺序**。SDK 自己不做 name 去重（`formatSkillsForSystemPrompt`
 * 无条件为每条生成一个 `<skill>`），因此去重只能由 Realm 在注入之前完成。
 *
 * 败者**不从数组移除**（返回数组与输入等长）：只标 `shadowed = true` +
 * `shadowedBy`，并产 `realm_shadowed` 诊断。保留是刻意设计 —— Phase 48 要
 * 渲染来源徽标与「被遮蔽的同名技能可见」，Phase 50 要展示列表与诊断；
 * 改为「剔除只留诊断」需要这两个阶段同时改数据源与展示层（D-06 costly）。
 *
 * @param {Array<{skill: {name: string, filePath: string}, source: string, diagnostics?: object[]}>} entries
 *  已按「managed 先、user 后」排列的缓存条目
 * @returns {Array<object>} 同长度条目数组（遮蔽败者额外带 shadowed / shadowedBy）
 */
function applyShadowing(entries) {
  const winnerByName = new Map();
  const out = [];
  for (const entry of entries) {
    const name = entry.skill.name;
    const loser = winnerByName.get(name);
    if (loser) {
      loser.shadowed = true;
      loser.shadowedBy = entry.source;
      pushEntryDiag(loser, {
        level: 'warning',
        code: 'realm_shadowed',
        message: `同名技能被 ${entry.source} 来源的 "${name}" 遮蔽（败者文件：${loser.skill.filePath}）`,
        path: loser.skill.filePath,
        source: loser.source,
      });
    }
    winnerByName.set(name, entry);
    out.push(entry);
  }
  return out;
}

/**
 * 异步刷新技能集（唯一加载入口，D-04）
 *
 * 每次 Agent 创建/重建之前无条件调用一次：这是唯一能自动覆盖「模型经
 * write / bash 工具直接改写 skills/<name>/SKILL.md」这条无事件可挂失效
 * 路径的机制。
 *
 * 加载后管线（顺序不可调换）：
 *   ① 契约布局过滤（inContractLayout）—— 深嵌套技能不进集合 + realm_layout_violation
 *   ② 目录名权威重写（enforceDirNameAuthority，D-08）
 *   ③ 同名遮蔽判定（applyShadowing，D-06）—— 依赖 ② 之后的 name 唯一性
 *
 * 契约：
 * - managed 先、user 后加载 —— 顺序不是装饰，同名遮蔽判定据此（D-06）
 * - 加载经 createSkillsEnv 收窄后的 env（每轮新建一个包装对象，零持久状态）
 * - 单技能失败（frontmatter 解析 / 元数据）由 SDK 记为诊断并跳过，不抛（D-05 第 1 层）
 * - 整批失败：**保留上一次成功快照** + 记 error 诊断，不清空、不静默（D-05 第 2 层）
 *
 * @param {object} env - 沙箱 ExecutionEnv（agent-workspace.createSandboxEnv 的返回值）
 * @param {{disabled?: string[], rootDirs?: string[]}} [opts]
 *   disabled：被禁用的技能名（46-03 生效）；rootDirs：[managedDir, userDir]
 * @returns {Promise<object>} 刷新后的 _cache
 */
async function refreshSkills(env, { disabled = [], rootDirs = [] } = {}) {
  const inputs = [];
  if (rootDirs[0]) inputs.push({ path: rootDirs[0], source: 'managed' });
  if (rootDirs[1]) inputs.push({ path: rootDirs[1], source: 'user' });

  // 每轮刷新建一个语义 env（零持久状态）；被滤掉的根层 entry 收集于此
  const droppedNotices = [];
  const skillsEnv = createSkillsEnv(
    env,
    { rootDirs: rootDirs.filter(Boolean), maxSkillMdBytes: LIMITS.MAX_SKILL_MD_BYTES },
    droppedNotices
  );

  try {
    // SDK 为 ESM-only，只能从包根动态 import（exports map 只有包根与少数具名入口）
    const { loadSourcedSkills, formatSkillsForSystemPrompt } =
      await import('@earendil-works/pi-agent-core');

    const { skills: loadedEntries, diagnostics } = await loadSourcedSkills(skillsEnv, inputs);

    // 加载面收窄产生的 Realm 自建诊断（code 以 realm_ 前缀与 SDK 枚举区分）
    const droppedDiags = droppedNotices.map((n) => ({
      level: 'warning',
      code: 'realm_root_entry_skipped',
      message: `技能扫描根下的 ${path.basename(n.path)} 被跳过：技能必须放在 <dir>/<name>/SKILL.md（每技能一个目录），根层散落文件不会被加载`,
      path: n.path,
    }));

    // 诊断容器先就位：管线的每一步都往这里追加（禁止静默失败，SKILL-06）
    _cache.diagnostics = diagnostics.concat(droppedDiags);

    // ① 契约布局过滤：SDK 递归无深度上限，从 GitHub 拷来的多一层目录包会
    //    加载出一个「不该存在」的技能。违约条目不进集合，但必须产可读诊断。
    const roots = rootDirs.filter(Boolean);
    const entries = [];
    for (const entry of loadedEntries) {
      entry.diagnostics = [];
      const root = scanRootOf(roots, entry.skill.filePath);
      if (root && !inContractLayout(root, entry.skill.filePath)) {
        const suggested = path.join(
          root,
          path.basename(path.dirname(entry.skill.filePath)),
          'SKILL.md'
        );
        _cache.diagnostics.push({
          level: 'warning',
          code: 'realm_layout_violation',
          message: `技能 "${entry.skill.name}" 的布局不符合契约：实际 ${entry.skill.filePath}；技能必须放在 <扫描根>/<技能名>/SKILL.md，不能有中间层目录（正确位置示例：${suggested}）`,
          path: entry.skill.filePath,
          source: entry.source,
        });
        continue;
      }
      entries.push(entry);
    }

    // ② 名称权威：以目录名重写 skill.name（D-08）—— 必须早于 ③ 遮蔽判定，
    //    重写后单目录内 name 天然唯一，遮蔽判定才无歧义。
    for (const entry of entries) enforceDirNameAuthority(entry);

    // ③ 同名遮蔽：managed 先、user 后 → 后到者（user 版）胜出，败者标
    //    shadowed / shadowedBy 但**保留在集合内**（D-06 costly 可逆性）。
    _cache.skills = applyShadowing(entries);
    // 遮蔽条目不进 prompt（D-06）—— 去重必须发生在注入之前，否则模型会看到
    // 两个同名技能且不知道信谁。同一过滤后集合也是 46-03 预算截断的输入。
    _cache.promptBlock = formatSkillsForSystemPrompt(
      _cache.skills
        .filter((e) => !e.shadowed && e.skill.disableModelInvocation !== true)
        .map((e) => e.skill)
    );
    _cache.digest = computeDigest(_cache.skills);
    _cache.errors = [];
    _cache.refreshedAt = Date.now();
  } catch (err) {
    // D-05 第 2 层：整批失败保留上一次成功快照，不静默
    _cache.errors = [{
      level: 'error',
      code: 'realm_refresh_failed',
      message: `技能集刷新失败，沿用上一次成功快照：${err && err.message ? err.message : String(err)}`,
    }];
  }
  return _cache;
}

/**
 * 同步读取技能 prompt 段（仅供 buildSystemPrompt 调用）
 *
 * **必须保持同步且零 IO**：Agent 创建路径（initialState.systemPrompt 组装处）
 * 不可异步化 —— 动态 import 后 this.agent 在微任务才赋值，同步帧内恒 null
 * （G-42-4 实录）。每轮重新加载还会让 systemPrompt 变化、provider 前缀缓存全 miss。
 *
 * @returns {string} 技能段文本；空技能集返回 ''
 */
function buildSkillsPrompt() {
  return _cache.promptBlock;
}

/**
 * 同步读取技能集快照（供 Phase 48 /skill: 解析与 Phase 50 列表消费）
 *
 * 返回**浅拷贝视图**：就地改其数组不污染模块级权威。零 IO、非 Promise。
 *
 * @returns {object} { skills, promptBlock, digest, diagnostics, errors, refreshedAt }
 */
function getSkillsSnapshot() {
  return {
    ..._cache,
    skills: _cache.skills.slice(),
    diagnostics: _cache.diagnostics.slice(),
    errors: _cache.errors.slice(),
  };
}

/** 复位模块级缓存（仅测试用；跨用例污染会让「空技能集」断言假失败） */
function _resetCacheForTest() {
  _cache = EMPTY_CACHE();
}

module.exports = {
  LIMITS,
  refreshSkills,
  buildSkillsPrompt,
  getSkillsSnapshot,
  _resetCacheForTest,
};

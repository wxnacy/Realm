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
 * 回写与广播。因此 digest 的输入必须覆盖影响 prompt 段的全部因素：
 *
 * - 每条缓存条目的 `(name, description, filePath, disableModelInvocation, source)`
 * - 决定「是否进 prompt」的消费侧状态：`disabled` / `overLimit` / `shadowed`
 * - **截断结果**：整段 promptBlock 本身（预算截断与省略提示都会改变它）
 *
 * 顺序也是输入的一部分：条目已由 bySkillPriority 确定性定序，顺序变化必然改变
 * prompt 字节序列，必须让 digest 随之变化。
 *
 * @param {Array<{skill: object, source: string}>} entries - 缓存条目数组
 * @param {string} [promptBlock] - 本轮组装出的技能段（含预算截断结果）
 * @returns {string} 客户端摘要
 */
function computeDigest(entries, promptBlock = '') {
  const rows = entries.map((e) => JSON.stringify([
    e.skill.name,
    e.skill.description,
    e.skill.filePath,
    e.skill.disableModelInvocation === true,
    e.source,
    e.disabled === true,
    e.overLimit === true,
    e.shadowed === true,
  ]));
  rows.push(`prompt:${promptBlock}`);
  return hashString(rows.join('\n'));
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
 * 被滤掉 / 被主动拒绝的 entry 一律进 droppedNotices（调用方转成可读诊断）——
 * **禁止静默**。两种记录形状：
 * - `{ path, kind }`：根层非目录 entry（kind 为原始 entry.kind）
 * - `{ path, kind: 'oversize_skill_md', limit, currentValue }`：超字节上限的 SKILL.md
 *
 * @param {object} sandboxEnv - createSandboxEnv() 的返回值
 * @param {{rootDirs?: string[], maxSkillMdBytes?: number}} [opts]
 * @param {Array<{path: string, kind: string, limit?: number, currentValue?: number}>} [droppedNotices]
 *   被滤掉 / 被拒的 entry 收集器
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
          // 带外记录限额与当前值：SDK 的 read_failed 只把这两个数写在 message 文本里，
          // 结构化字段由 Realm 补（SKILL-07 的「哪个限额 / 当前值」）
          droppedNotices.push({
            path: p,
            kind: 'oversize_skill_md',
            limit: maxSkillMdBytes,
            currentValue: info.value.size,
          });
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
 * SDK 诊断 → Realm 诊断的**唯一**映射点（D-07）
 *
 * 字段口径差异（必须显式映射，不得想当然）：
 * - SDK 的严重度字段名是 `type`（当前恒为 `'warning'`）；Realm 形状是 `level`
 * - `code` / `message` / `path` / `source` 原样透传 —— SDK 的 `message` 天然含
 *   限额与当前值（如 `description exceeds 1024 characters (1100)`）
 *
 * **禁止在任何调用点直接读 `d.level`**：SDK 没有该字段，读到的是 undefined，
 * 会让「诊断已透传」假成立（Pitfall 4 的字段名错位）。
 *
 * @param {{type?: string, code: string, message: string, path?: string, source?: string}} d
 * @returns {{level: string, code: string, message: string, path?: string, source?: string}}
 */
function toRealmDiag(d) {
  return {
    level: d.type === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    path: d.path,
    source: d.source,
  };
}

/**
 * 往模块级 `errors[]` 追加一条「无对应技能」的整批 / 环境级诊断（D-05 第 2 层、D-07）
 *
 * 与条目级诊断（pushEntryDiag）的分工：`errors[]` 只承载刷新失败、扫描根缺失
 * 这类不属于任何单个技能的问题，供 Phase 50 在任意时刻同步读到原因。
 *
 * 调用前提：`_cache.errors` 已被本轮刷新复位为数组（见 refreshSkills）。
 *
 * @param {object} errDiag - 诊断对象（level / code / message，限额族另带 limit / currentValue）
 */
function pushError(errDiag) {
  _cache.errors.push(errDiag);
}

/**
 * 判定一条诊断是否属于「description 不可用」→ 该技能必须跳过（D-05 第 1 层）
 *
 * **为什么需要这条判定**：SDK 的 `validateDescription` 只产 warning，且
 * `loadSkillFromFile` **只对缺失 / 空 description 返回 `skill: null`** ——
 * 超长 description 的技能会被 SDK 原样返回。而 description 是模型匹配技能的
 * 唯一依据（渐进式披露契约只注入 name / description / location），不可用的
 * description 意味着该技能不可能被正确触发，故属「单技能失败 = 跳过」。
 *
 * **为什么不连 name 类 `invalid_metadata` 一起跳过**：D-08 以**目录名**为权威
 * 重写 name 并**保留**该技能（命名不规范在 GitHub 导入中很常见，丢弃等于静默
 * 删除用户技能）；name ≠ 目录名 的告警在 `enforceDirNameAuthority` 之后已被化解。
 *
 * SDK 不导出 `validateDescription`，故按诊断模板前缀判定。升版复核点：SDK 若
 * 改动该 message 模板，本判定与 D-08 的分工需同步复核。
 *
 * @param {{code?: string, message?: string}} d - 诊断（SDK 原样或经 toRealmDiag 映射均可）
 * @returns {boolean} 是否为 description 不可用
 */
function isDescriptionUnusable(d) {
  return (
    !!d &&
    d.code === 'invalid_metadata' &&
    /^description\b/.test(String(d.message || ''))
  );
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
 * 确定性全序比较器：缓存条目的**可观测顺序**（D-10 序）
 *
 * 排序键（依次比较，前一个相等才看下一个）：
 *   1. 来源：user(0) 先于 managed(1)
 *   2. 可模型调用：`disableModelInvocation !== true`(0) 先于显式禁用调用(1)
 *   3. name 的**码点序**（`<` / `>` 直接比较，不做本地化）
 *
 * **禁止改用区域敏感（ICU / locale 依赖）的字符串比较**：同一技能集在不同机器上
 * 可能排出不同顺序 —— 顺序变化会改变 system prompt 的字节序列，让 provider 的
 * 前缀缓存命中率随机器漂移、不可预测。码点序跨机恒定。
 *
 * 该比较器是全序（D-08 重写后单目录内 name 唯一、跨目录同名已由遮蔽处理），
 * 故排序结果与输入顺序无关。它是 `getSkillsSnapshot().skills` 与
 * `buildSkillsPrompt()` 可观测顺序的**唯一**规定者。
 *
 * @param {{skill: {name: string, disableModelInvocation?: boolean}, source: string}} a
 * @param {{skill: {name: string, disableModelInvocation?: boolean}, source: string}} b
 * @returns {number} 负数 / 0 / 正数
 */
function bySkillPriority(a, b) {
  const sourceRank = (e) => (e.source === 'user' ? 0 : 1);
  const invocationRank = (e) => (e.skill.disableModelInvocation === true ? 1 : 0);
  const bySource = sourceRank(a) - sourceRank(b);
  if (bySource !== 0) return bySource;
  const byInvocation = invocationRank(a) - invocationRank(b);
  if (byInvocation !== 0) return byInvocation;
  if (a.skill.name < b.skill.name) return -1;
  if (a.skill.name > b.skill.name) return 1;
  return 0;
}

/**
 * 异步刷新技能集（唯一加载入口，D-04）
 *
 * 每次 Agent 创建/重建之前无条件调用一次：这是唯一能自动覆盖「模型经
 * write / bash 工具直接改写 skills/<name>/SKILL.md」这条无事件可挂失效
 * 路径的机制。
 *
 * 加载后管线（顺序不可调换）：
 *   ⓪ 扫描根存在性断言 —— 缺失产 realm_skills_dir_missing（SDK 对此零诊断）
 *   ① 契约布局过滤（inContractLayout）—— 深嵌套技能不进集合 + realm_layout_violation；
 *      同步跳过 description 不可用的技能（isDescriptionUnusable，诊断沿用 SDK 的 invalid_metadata）
 *   ② 目录名权威重写（enforceDirNameAuthority，D-08）
 *   ③ 同名遮蔽判定（applyShadowing，D-06）—— 依赖 ② 之后的 name 唯一性
 *   ④ 确定性定序（bySkillPriority）—— 可观测顺序的唯一规定者，跨机一致
 *   ⑤ 启用/禁用标记（disabled，D-09）—— 只标记不剔除、不删文件（消费侧过滤）
 *   ⑥ 数量上限（overLimit，SKILL-07）—— user 来源超 MAX_USER_SKILLS 的条目标记但不剔除
 *   ⑦ prompt 段预算（固定开销 + 逐条差量贪心，SKILL-07）—— 超预算省略 + 段尾提示
 *
 * 契约：
 * - managed 先、user 后加载 —— 顺序不是装饰，同名遮蔽判定据此（D-06）
 * - 加载经 createSkillsEnv 收窄后的 env（每轮新建一个包装对象，零持久状态）
 * - 诊断一律经 toRealmDiag 显式映射为 Realm 形状（type → level，D-07）
 * - 单技能失败（frontmatter 解析 / description 不可用 / 布局违约）跳过该技能，
 *   其余照常注入，且 refreshSkills **不抛错**（D-05 第 1 层）
 * - 整批失败：**保留上一次成功快照**（skills / promptBlock / diagnostics 一行不碰）
 *   + 往 errors[] 记 error 诊断，不清空、不静默（D-05 第 2 层）
 *
 * @param {object} env - 沙箱 ExecutionEnv（agent-workspace.createSandboxEnv 的返回值）
 * @param {{disabled?: string[], rootDirs?: string[]}} [opts]
 *   disabled：被禁用的技能名（46-03 Task 3 生效）；rootDirs：[managedDir, userDir]
 * @returns {Promise<object>} 刷新后的 _cache
 */
async function refreshSkills(env, { disabled = [], rootDirs = [] } = {}) {
  const roots = rootDirs.filter(Boolean);
  const inputs = [];
  if (rootDirs[0]) inputs.push({ path: rootDirs[0], source: 'managed' });
  if (rootDirs[1]) inputs.push({ path: rootDirs[1], source: 'user' });

  // 每轮刷新建一个语义 env（零持久状态）；被滤掉的根层 entry 收集于此
  const droppedNotices = [];
  const skillsEnv = createSkillsEnv(
    env,
    { rootDirs: roots, maxSkillMdBytes: LIMITS.MAX_SKILL_MD_BYTES },
    droppedNotices
  );

  try {
    // errors[] 只承载「本次刷新」的整批 / 环境级失败 —— 开工即复位，避免上一次的
    // 失败态永远挂着（D-05 第 2 层）。成功与失败两条路径都在此之后写入。
    _cache.errors = [];

    // 目录缺失不静默：SDK 对不存在的目录直接 continue 且零诊断，Realm 必须补上。
    // 断言失败**不中断**加载 —— 其余目录的技能仍要有结果（D-05 第 1 层精神）。
    for (const p of roots) {
      const ex = await env.exists(p);
      if (!ex || ex.ok !== true || ex.value !== true) {
        pushError({
          level: 'error',
          code: 'realm_skills_dir_missing',
          message: `技能目录不存在：${p}（应用启动时应由 ensureWorkspaceDir 创建）`,
          path: p,
        });
      }
    }

    // SDK 为 ESM-only，只能从包根动态 import（exports map 只有包根与少数具名入口）
    const { loadSourcedSkills, formatSkillsForSystemPrompt } =
      await import('@earendil-works/pi-agent-core');

    const { skills: loadedEntries, diagnostics } = await loadSourcedSkills(skillsEnv, inputs);

    // 加载面收窄 / 字节闸产生的 Realm 自建诊断（code 以 realm_ 前缀与 SDK 枚举区分）。
    // droppedNotices 混装两种记录，按 kind 分流：根层被滤 entry 与超字节上限的 SKILL.md。
    const rootSkipped = droppedNotices.filter((n) => n.kind !== 'oversize_skill_md');
    const oversize = droppedNotices.filter((n) => n.kind === 'oversize_skill_md');
    const droppedDiags = rootSkipped.map((n) => ({
      level: 'warning',
      code: 'realm_root_entry_skipped',
      message: `技能扫描根下的 ${path.basename(n.path)} 被跳过：技能必须放在 <dir>/<name>/SKILL.md（每技能一个目录），根层散落文件不会被加载`,
      path: n.path,
    }));
    // 字节闸的可操作诊断：与 SDK 那条 read_failed 并存（一条是 SDK 的事实记录，
    // 一条是 Realm 的「哪个限额、当前值」），靠带外记录而非解析 SDK 消息文本
    const oversizeDiags = oversize.map((n) => ({
      level: 'error',
      code: 'realm_skill_md_too_large',
      message: `SKILL.md 超过正文上限：限额 ${n.limit} 字节，当前 ${n.currentValue} 字节（${n.path}）`,
      path: n.path,
      limit: n.limit,
      currentValue: n.currentValue,
    }));

    // 诊断容器先就位：SDK 诊断经**显式映射**（type → level，D-07）转成 Realm 形状，
    // 管线的每一步继续往这里追加（禁止静默失败，SKILL-06）
    const sdkDiags = diagnostics.map(toRealmDiag);
    _cache.diagnostics = sdkDiags.concat(droppedDiags, oversizeDiags);

    // ① 契约布局过滤 + description 可用性过滤
    //    - 布局：SDK 递归无深度上限，从 GitHub 拷来的多一层目录包会加载出一个
    //      「不该存在」的技能
    //    - description：SDK 对超长 description **仍返回 skill**，Realm 需按
    //      isDescriptionUnusable 跳过（见该函数 JSDoc）
    //    违约条目不进集合，但必须产可读诊断（布局违约为 Realm 自建；description
    //    沿用 SDK 的 invalid_metadata，已在 sdkDiags 中）。
    const entries = [];
    for (const entry of loadedEntries) {
      entry.diagnostics = [];
      const entryPath = entry.skill.filePath;
      if (sdkDiags.some((d) => d.path === entryPath && isDescriptionUnusable(d))) {
        continue;
      }
      const root = scanRootOf(roots, entryPath);
      if (root && !inContractLayout(root, entryPath)) {
        const suggested = path.join(root, path.basename(path.dirname(entryPath)), 'SKILL.md');
        _cache.diagnostics.push({
          level: 'warning',
          code: 'realm_layout_violation',
          message: `技能 "${entry.skill.name}" 的布局不符合契约：实际 ${entryPath}；技能必须放在 <扫描根>/<技能名>/SKILL.md，不能有中间层目录（正确位置示例：${suggested}）`,
          path: entryPath,
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
    // ④ 确定性定序：bySkillPriority 是全序，排序结果与输入顺序无关（跨机一致）。
    //    定序必须在遮蔽之后 —— 胜负由输入顺序决定，与可观测顺序无关。
    _cache.skills = applyShadowing(entries).sort(bySkillPriority);

    // ⑤ 启用/禁用（D-09）：禁用是**消费侧过滤的下游信号** —— 数据层保留完整条目，
    //    过滤只发生在 prompt 段组装（此处）与未来的 /skill: 解析（Phase 48）；
    //    文件永不改动或删除（SKILL-08），否则用户禁用一次即永久失去该技能。
    //    禁用键是 name、不区分来源，故「先禁用 managed foo、后导入 user foo，
    //    新导入的也会随之禁用」这条已知边界自然成立（由 46-04 写进产品文档）。
    const disabledSet = new Set(disabled);
    for (const entry of _cache.skills) {
      if (disabledSet.has(entry.skill.name)) entry.disabled = true;
    }

    // ⑥ 数量上限：只统计 user 来源（managed 由应用自身投递，不计入用户配额）。
    //    超限条目标 overLimit 而**不剔除、不删文件** —— 数据层完整，只是不注入。
    const userEntries = _cache.skills.filter((e) => e.source === 'user');
    if (userEntries.length > LIMITS.MAX_USER_SKILLS) {
      for (const e of userEntries.slice(LIMITS.MAX_USER_SKILLS)) e.overLimit = true;
      _cache.diagnostics.push({
        level: 'error',
        code: 'realm_user_skill_limit_exceeded',
        message: `用户技能数量超过上限：限额 ${LIMITS.MAX_USER_SKILLS} 个，当前 ${userEntries.length} 个；超出部分不进 system prompt（请先卸载不用的技能）`,
        limit: LIMITS.MAX_USER_SKILLS,
        currentValue: userEntries.length,
      });
    }

    // ⑦ prompt 段预算（**整段口径**，含 SDK 前言与包裹的固定开销）：
    //    差量测量而非自拼模板 —— 自拼等于复制 SDK 的转义与缩进，SDK 升级即漂移。
    //    entryCost 取「在一条已有条目的段上再加一条」的**边际成本**（不能用
    //    `format([skill]) - format([dummy])`：那样每条都重复计入一次前言，k 条时
    //    累计口径比真实段长少 (k-1) 倍前言，会让贪心放行到超预算）。
    const dummySkill = { name: '', description: '', filePath: '' };
    const fixedOverhead = formatSkillsForSystemPrompt([dummySkill]).length;
    const entryCost = (skill) =>
      formatSkillsForSystemPrompt([dummySkill, skill]).length - fixedOverhead;
    const eligible = _cache.skills.filter(
      (e) => !e.shadowed && !e.disabled && !e.overLimit && e.skill.disableModelInvocation !== true
    );
    const kept = [];
    let used = fixedOverhead;
    for (const e of eligible) {
      const cost = entryCost(e.skill);
      if (used + cost > LIMITS.SKILLS_PROMPT_CHAR_BUDGET) break;
      kept.push(e.skill);
      used += cost;
    }
    let block = kept.length ? formatSkillsForSystemPrompt(kept) : '';
    const omitted = eligible.length - kept.length;
    if (omitted > 0) {
      // 省略提示追加在 SDK 技能段的**闭合标签之外**：未截断时的前缀与截断时逐字节
      // 相同，provider 前缀缓存友好。截断绝不静默（SKILL-07）。
      _cache.diagnostics.push({
        level: 'warning',
        code: 'realm_prompt_budget_exceeded',
        message: `prompt 段预算 ${LIMITS.SKILLS_PROMPT_CHAR_BUDGET} 字符，已省略 ${omitted} 个技能（共 ${eligible.length} 个）`,
        limit: LIMITS.SKILLS_PROMPT_CHAR_BUDGET,
        currentValue: used,
      });
      block += `\n\nNote: ${omitted} of ${eligible.length} skills omitted to stay within the prompt budget.`;
    }
    _cache.promptBlock = block;
    _cache.digest = computeDigest(_cache.skills, _cache.promptBlock);
    _cache.refreshedAt = Date.now();
  } catch (err) {
    // D-05 第 2 层：整批失败保留上一次成功快照（skills / promptBlock / diagnostics
    // 一行都不碰），只往 errors[] 追加一条 error 诊断，不静默。
    pushError({
      level: 'error',
      code: 'realm_refresh_failed',
      message: `技能集刷新失败，沿用上一次成功快照：${err && err.message ? err.message : String(err)}`,
    });
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

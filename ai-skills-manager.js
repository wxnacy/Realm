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
 * （其 YAML / ignore 实现只经 SDK 往返获得，不自行引入）。
 */

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
 * - skills：缓存条目 `{ skill, source }`，source 取 'user' | 'managed'
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
 * 异步刷新技能集（唯一加载入口，D-04）
 *
 * 每次 Agent 创建/重建之前无条件调用一次：这是唯一能自动覆盖「模型经
 * write / bash 工具直接改写 skills/<name>/SKILL.md」这条无事件可挂失效
 * 路径的机制。
 *
 * 契约：
 * - managed 先、user 后加载 —— 顺序不是装饰，同名遮蔽判定据此（D-06）
 * - 单技能失败（YAML / 元数据）由 SDK 记为诊断并跳过，不抛（D-05 第 1 层）
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

  try {
    // SDK 为 ESM-only，只能从包根动态 import（exports map 无 harness 子路径）
    const { loadSourcedSkills, formatSkillsForSystemPrompt } =
      await import('@earendil-works/pi-agent-core');

    const { skills: entries, diagnostics } = await loadSourcedSkills(env, inputs);

    _cache.skills = entries;
    _cache.diagnostics = diagnostics;
    _cache.promptBlock = formatSkillsForSystemPrompt(
      entries
        .filter((e) => e.skill.disableModelInvocation !== true)
        .map((e) => e.skill)
    );
    _cache.digest = computeDigest(entries);
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

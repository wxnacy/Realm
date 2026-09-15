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
 * ESM-only，一律用包根动态 import）。
 *
 * **两条显式豁免（Phase 51 D-14）**——它们是本模块的**直接依赖**，不是「顺手引入
 * SDK 的传递依赖」，不得按旧口径删掉：
 * - `yauzl`（导入面的 zip 解析 / 解压。库自身**从不写盘**：`openReadStream()` 只给流，
 *   落盘 100% 由 Realm 决定 ⇒ `adm-zip` CVE-2026-76845 那一类「库自己跟随预埋 symlink
 *   写出根目录」在结构上不可能发生）。
 * - `yaml`（导入面的 SKILL.md frontmatter 解析，**必须与 SDK 同版精确钉 2.9.0**，
 *   否则会出现根 / 嵌套双实例的静默解析差异）。
 * 两者都经 `getYauzlLazy()` / `getYamlLazy()` 惰性 require（与既有三件套同款，
 * 避开模块加载顺序问题）。
 */

const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

/**
 * 技能限额单源（D-11）—— 端点、设置页前端与渲染层不得出现同类字面量。
 *
 * 各条限额单位不同、互不换算，逐条声明口径（升版须逐条复核）：
 * - MAX_SKILL_MD_BYTES：单个 SKILL.md **整文件**的 UTF-8 字节数。加载期按 sandbox
 *   `FileInfo.size` 计数；写入侧的**权威闸口**（`validateSkillFileSize`）按
 *   `buildSkillFileText` 产物（frontmatter + 空行 + 正文）的 `Buffer.byteLength(…, 'utf8')`
 *   计数 —— 两侧判的是**同一个量（组装后的 SKILL.md 全文）**，因此不会产出
 *   「落盘成功但整条被跳过」的幽灵技能。`validateManagedSkillContent` 里对 content
 *   单独计字节只是**提前预筛**（权威闸口的严格子集：组装全文 = content + frontmatter，
 *   frontmatter 长度恒为正 ⇒ 只可能更早拒、不可能放行权威闸口会拒的输入），
 *   不是第二套判据。
 * - MAX_USER_SKILLS：user 来源技能个数（`agent-workspace/skills/`）
 * - SKILLS_PROMPT_CHAR_BUDGET：prompt 元数据段的字符数（按 JS string.length 计数）
 * - MAX_MANAGED_SKILLS：**非 seeded 的 managed 技能个数**（AI 自建；读盘统计）。
 *   管**磁盘与每次 Agent 重建的重扫成本**，与 SKILLS_PROMPT_CHAR_BUDGET 的
 *   **请求成本**闸职责不同，二者不互相替代；**不得**用后者做创建拒绝（48 D-12：
 *   超预算技能仍可显式调用、本身完全可用）。
 * - MAX_SKILL_DESCRIPTION_CHARS：description 字符数，与 SDK
 *   `@earendil-works/pi-agent-core/dist/harness/skills.js` 的 `MAX_DESCRIPTION_LENGTH`
 *   对齐（**升版须复核**）。写成单源常量而非在写入侧硬编码第二份字面量，是为了让
 *   写入侧预筛与加载期 `isDescriptionUnusable` 的判据同源。
 */
const LIMITS = {
  MAX_SKILL_MD_BYTES: 64 * 1024,
  MAX_USER_SKILLS: 50,
  SKILLS_PROMPT_CHAR_BUDGET: 8000,
  MAX_MANAGED_SKILLS: 50,
  MAX_SKILL_DESCRIPTION_CHARS: 1024,
};

/**
 * 技能名长度上限，与 SDK `harness/skills.js` 的 `MAX_NAME_LENGTH` 对齐（升版须复核）。
 *
 * 写成模块常量而非 `LIMITS` 项：它不是「Realm 自定的额度」而是 SDK 判据的提前执行
 * （见 `validateManagedSkillName`）。
 */
const MAX_SKILL_NAME_CHARS = 64;

/** 合法技能名形态（D-06 判据字面；`/`、`\`、`.` 均不在字符集内 ⇒ 无路径穿越面） */
const MANAGED_SKILL_NAME_RE = /^[a-z0-9-]+$/;

/**
 * 尺寸遍历的两条**防御上限**（OQ-4 裁决）—— 超限截断 + 产 warning 诊断，**不拒绝加载**
 *
 * 为什么必须有：`MAX_USER_SKILLS` / `MAX_MANAGED_SKILLS` 只约束**技能个数**，
 * 不约束**单个技能目录的深度与条目数**（`research/PITFALLS.md` 的 P7 把
 * 「深目录递归」列为资源耗尽面）。而尺寸遍历发生在**每次 Agent 创建 / 重建**
 * 的重扫管线里（`refreshSkills`），一次无界的深目录递归等于卡死主进程。
 *
 * 截断语义（T-50-02 的缓解面）：越过任一上限即**停止遍历**并产一条 warning 诊断，
 * 该技能**仍照常加载**，只是体积显示为**下限值**（用户不会因此失去技能）。
 * 不拒绝加载的理由与 `refreshSkills` 的单技能失败纪律一致：局部问题不该升级为整条消失。
 *
 * 写成模块常量而非 `LIMITS` 项：它们**不是 Realm 自定的用户额度**（不该经
 * `getSkillsForManagement().limits` 回传给设置页、也不该出现在 UI 文案里），
 * 而是遍历自身的资源护栏。导出仅供单测使用。
 */
const SKILL_SIZE_WALK_MAX_ENTRIES = 5000;

/** 见 `SKILL_SIZE_WALK_MAX_ENTRIES`（深度上限，从 1 起计） */
const SKILL_SIZE_WALK_MAX_DEPTH = 16;

/**
 * 内容首部 YAML frontmatter 块（A5 裁决：技能正文若自带 frontmatter 一律**静默剥除**）
 *
 * 不剥除会产生双层 `---` 头、SDK 解析结果不确定（可能 parse_failed → 幽灵技能），
 * 而 D-07 的九码闭合白名单里没有 invalid_content，不为此新立第十码。
 */
const LEADING_FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/;

/**
 * 把任意文本编码成 YAML **单引号标量**（CR-02 的修法）
 *
 * 解决的正是三类会把 frontmatter 结构击穿的 description 输入（LLM 自由文本）：
 * - 含 `": "`（冒号 + 空格）：裸插值被 YAML 读成嵌套映射 → SDK `parse()` 抛错 →
 *   `parse_failed` → 幽灵技能；
 * - 含 `#`：裸插值在 `#` 处被当作注释**静默截断**（技能在、描述错）；
 * - 裸标量形态（`true` / `12345` / `null` / 前导 `-` / `@` / `*`）：裸插值被解析成
 *   非字符串或抛错 → SDK 判 description 不可用后**整条跳过**。
 * 三类后果同归一类失效族：工具报成功、磁盘有文件、技能永不加载。
 *
 * **为什么用单引号而不是双引号**：YAML 单引号标量**不做转义处理**（唯一变形是撇号
 * 双写），因此描述里的 Windows 风格反斜杠（`C:\path`）不会被误当成转义序列而损坏；
 * 双引号标量要求自己实现一整套反斜杠 / 控制字符转义表，等于把半个 YAML 解析器抄进
 * 本模块。
 *
 * 换行归一化是**防御性**的：净化职责在调用方（`sanitizeSkillDescription`），但编码层
 * 不得允许换行穿透进 frontmatter（YAML 折行标量的语义会随缩进漂移）。
 *
 * **不得 import `yaml` 包**（也不动态 import）：它是 SDK 的传递依赖，本模块只经 SDK
 * 往返获得 frontmatter 解析能力（见文件头「依赖纪律」）。本函数自持，不导出。
 *
 * @param {string} text - 任意文本
 * @returns {string} YAML 单引号标量（含首尾引号）
 */
function yamlScalar(text) {
  const flat = String(text == null ? '' : text)
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/'/g, "''");
  return `'${flat}'`;
}

/**
 * 惰性 require 记忆管理模块（技能域与记忆域共用同一份扫描单点，D-08）
 *
 * 照 `ai-manager.js` 的惰性模板：避开模块加载顺序问题，无循环依赖
 *（ai-memory-manager 不反向 require 本模块），本模块因此保持零 electron 依赖。
 *
 * @returns {object} ai-memory-manager 模块导出
 */
function getAiMemoryManagerLazy() {
  return require('./ai-memory-manager');
}

/**
 * 惰性 require AI 工作区模块（managed 技能目录 / 用户技能目录的唯一解析入口）
 *
 * agent-workspace 的 electron 依赖同样是惰性获取的，纯 Node 下可加载。
 *
 * @returns {object} agent-workspace 模块导出
 */
function getAgentWorkspaceLazy() {
  return require('./agent-workspace');
}

/**
 * 惰性 require zip 解析库（导入面专用，D-14 的直接依赖）
 *
 * 为什么惰性而非顶层：与既有三件套同款，避开模块加载顺序问题；且本模块被
 * 纯 Node 单测直接 require，惰性形态让「不碰导入面」的路径完全不付该依赖的加载成本。
 *
 * @returns {object} yauzl 模块导出
 */
function getYauzlLazy() {
  return require('yauzl');
}

/**
 * 惰性 require YAML 解析库（导入面 frontmatter 解析，D-14 的直接依赖，精确钉 2.9.0）
 *
 * 唯一消费点 `parseSkillFrontmatter` —— 只**读**，不参与写侧（写侧仍走自持的
 * `yamlScalar`，见其 JSDoc 的理由）。
 *
 * @returns {object} yaml 模块导出
 */
function getYamlLazy() {
  return require('yaml');
}

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
 *   消费侧标记（均由 ⑤⑥⑦ 写入、只增不减）：
 *   - `disabled`（⑤，46 D-09）：命中 `opts.disabled` 名单
 *   - `overLimit`（⑥，SKILL-07）：user 来源超出 `MAX_USER_SKILLS` 的部分
 *   - `promptOmitted`（⑦，48 D-12）：§⑦ 预算贪心**丢弃**的 `eligible` 条目
 *     —— 判定边界必须与 ⑦ 的 `eligible` 过滤条件完全一致；**永不**打在
 *     `shadowed` / `disabled` / `overLimit` / `disableModelInvocation === true` 条目上
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
 * 递归统计单个技能目录的**体积（字节）与文件数**（D-13 的口径实现，T-50-02/T-50-03）
 *
 * 三条纪律（改实现前必须逐条复核）：
 * 1. **只经沙箱 env 遍历**（`env.listDir`），**不得**直接 `require('fs')` 或
 *    `fs.readdir/stat/lstat/readFile` —— 直接 `fs` 绕过 `agent-workspace.resolveInside`
 *    的双基准 + realpath 复核，等于给「运维 / 统计」开一个新的越界读入口（T-50-03）。
 * 2. **必须显式跳过 symlink**（`e.kind === 'symlink'` ⇒ continue）：`listDir` 实测
 *    会返回 symlink 条目，而**内部链接可穿入** ⇒ naive 递归在内部链接环上无限循环。
 *    该遍历发生在**每次 Agent 创建 / 重建**，无界循环 = 卡死主进程（T-50-02）。
 * 3. **一切失败都编码进返回值、绝不 throw**：沙箱 FileSystem 契约是「永不 throw，
 *    失败编码进 Result」，且调用方（`refreshSkills`）的整体 `catch` 是**整批回滚**语义
 *    —— 让一次 stat 失败冒泡上去会把「一个技能读不到」放大成「技能集消失」（T-50-04）。
 *
 * 目录名才是权威：调用方按 `path.dirname(entry.skill.filePath)` 派生目录，SDK 的
 * `Skill` 只有五字段、没有位置字段。
 *
 * 本函数**不导出**（单测经公开函数的行为面覆盖，不测内部实现）。
 *
 * @param {object} env - 沙箱 ExecutionEnv（agent-workspace.createSandboxEnv 的返回值）
 * @param {string} dir - 技能目录绝对路径
 * @returns {Promise<{bytes: number, fileCount: number, errors: object[]}>}
 *   `errors` 为 entry 级诊断对象数组（调用方经 `pushEntryDiag` 落到条目与模块级容器）
 */
async function measureSkillDir(env, dir) {
  const errors = [];
  let bytes = 0;
  let fileCount = 0;
  let seenEntries = 0;
  let tooManyEntries = false;
  let tooDeep = false;

  /**
   * 局部递归遍历。**子路径一律由 `path.join` 拼接**（不得字符串相加 —— 相邻段的
   * 分隔符语义会因尾部斜杠与否而漂移）。
   *
   * @param {string} p - 当前目录
   * @param {number} depth - 当前深度（从 1 起）
   */
  const walk = async (p, depth) => {
    const res = await env.listDir(p);
    if (!res || res.ok !== true || !Array.isArray(res.value)) {
      // 「读不到」是**正常分支**而非异常：沙箱 FileSystem 契约是永不 throw、
      // 失败编码进 Result（`nodejs.js` 的 listDir 内层失败是 `return err` ⇒ 整目录失败）。
      // 产一条 entry 级 warning 诊断后正常返回，**不 throw**。
      errors.push({
        level: 'warning',
        code: 'realm_skill_dir_unreadable',
        message: `技能目录的内容读不到，体积与文件数统计不可用：${p}（沙箱码 ${sandboxErrorCode(res)}）`,
        path: p,
      });
      return;
    }

    for (const e of res.value) {
      if (tooManyEntries || tooDeep) return;
      // symlink **必须显式跳过**：kind 为 'symlink' 的条目既不是技能内容，
      // 又可能指回自身祖先（内部链接环）⇒ 跟随即无限递归。本遍历发生在
      // **每次 Agent 创建 / 重建**的重扫管线里，无界递归等于卡死主进程（T-50-02）。
      if (e.kind === 'symlink') continue;
      // 隐藏文件不计入（`.DS_Store` 一类不是技能内容，且在 macOS 下会因 Finder
      // 浏览而随机增减 —— 计入会让体积无故跳动）。
      if (e.name.startsWith('.')) continue;

      seenEntries += 1;
      if (seenEntries > SKILL_SIZE_WALK_MAX_ENTRIES) {
        tooManyEntries = true;
        return;
      }

      if (e.kind === 'directory') {
        if (depth >= SKILL_SIZE_WALK_MAX_DEPTH) {
          tooDeep = true;
          return;
        }
        await walk(path.join(p, e.name), depth + 1);
        continue;
      }

      if (e.kind === 'file') {
        // 只有**文件**条目累加字节。目录条目的 size 来自 lstat、是 inode 数据
        //（实测目录恒为 96 字节），把它当内容累加会让体积凭空膨胀。
        bytes += Number.isFinite(e.size) ? e.size : 0;
        fileCount += 1;
      }
    }
  };

  await walk(dir, 1);

  // 两种截断**各产一条独立诊断**且都**不拒绝加载**（技能仍照常可用，体积显示为下限值）。
  if (tooManyEntries) {
    errors.push({
      level: 'warning',
      code: 'realm_skill_dir_too_many_entries',
      message: `技能目录条目数超过 ${SKILL_SIZE_WALK_MAX_ENTRIES} 条，统计已截断（显示的体积为下限值）：${dir}`,
      path: dir,
    });
  }
  if (tooDeep) {
    errors.push({
      level: 'warning',
      code: 'realm_skill_dir_too_deep',
      message: `技能目录层级超过 ${SKILL_SIZE_WALK_MAX_DEPTH} 层，统计已截断（显示的体积为下限值）：${dir}`,
      path: dir,
    });
  }

  return { bytes, fileCount, errors };
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
 * - 整批失败：**整体回滚**到上一次成功快照（skills / promptBlock / diagnostics 三件套一起，
 *   避免撕裂快照）+ 往 errors[] 记 error 诊断，不清空、不静默（D-05 第 2 层）
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

  // 快照上一次成功态：整批失败时**整体**回滚（WR-05 —— 若只在 catch 里不动 _cache，
  // 而本轮已把 diagnostics 换成新值，就会暴露「新诊断 + 旧技能集」的撕裂快照）
  const prev = {
    skills: _cache.skills,
    promptBlock: _cache.promptBlock,
    diagnostics: _cache.diagnostics,
  };

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

    // ④.5 尺寸统计（D-13）：**只在此处算一次**，结果挂在缓存条目上、随 refreshedAt 失效；
    //      读取侧（getSkillsForManagement）因此保持**同步零 IO**。
    //      ⚠️ 算在 ④ 定序**之后**（顺序无关，但让「尺寸挂在最终条目上」这件事与顺序解耦）、
    //      ⑤ 禁用标记**之前**（该段只读 name 集合，不被尺寸影响）。
    //      ⚠️ **逐技能隔离失败**：任何异常都在本循环内被 measureSkillDir 消化为诊断
    //      （它永不 throw）—— **绝不允许**冒泡到 :catch 的整体回滚，那会把一次
    //      「某个子目录读不到」放大成「整个技能集消失」（T-50-04）。
    //      ⚠️ **尺寸不进 computeDigest**：它不影响 prompt 段。加进去会让「给技能加一个
    //      references/notes.md」触发 systemPrompt 改写 + 广播 ⇒ provider 前缀缓存 miss，
    //      是一条纯性能回归（D-13 / D-18 的双向禁令）。
    for (const entry of _cache.skills) {
      const skillDir = path.dirname(entry.skill.filePath);
      const measured = await measureSkillDir(env, skillDir);
      entry.bytes = measured.bytes;
      entry.fileCount = measured.fileCount;
      for (const d of measured.errors) pushEntryDiag(entry, d);
    }

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
    // ⑦ 的条目级落点（48 D-12）：被预算丢弃的条目逐条打标，供面板渲染
    // 「未进提示词 · 超预算」。判定边界必须与上方 eligible 的过滤条件**完全一致**
    //（eligible.slice(kept.length) 恰为「通过 eligible 过滤但未进 kept」的条目）。
    // 该标记**不得**进 computeDigest：任何使它变化的输入都会改变 omitted →
    // 改变省略提示行 → 改变 promptBlock → digest 已随之变化。
    for (const e of eligible.slice(kept.length)) e.promptOmitted = true;
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
    // D-05 第 2 层：整批失败**整体回滚**到上一次成功快照（skills / promptBlock /
    // diagnostics 三件套一起回滚，避免撕裂快照），只往 errors[] 追加 error 诊断，不静默。
    _cache.skills = prev.skills;
    _cache.promptBlock = prev.promptBlock;
    _cache.diagnostics = prev.diagnostics;
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

/**
 * 三档来源档位判定（48 D-14）—— **纯函数、零 IO**，判定只消费既有数据
 *
 * 档位取值域（与数据层的 `source` 不同：数据层只有 `'user' | 'managed'` 两值）：
 * - `'user'`    ← `entry.source === 'user'`（`agent-workspace/skills/`）
 * - `'builtin'` ← `entry.skill.name ∈ seededNames`（随包 `skills-builtin/` 播种而来）
 * - `'managed'` ← 其余 `'managed'`（AI 自建，存于 `managed-skills/`）
 *
 * seeded 集合由调用方注入（`builtin-skills-seeder.getSeededSkillNames()`）——
 * 本模块保持**零 electron 依赖**纪律，不自行解析随包目录。
 *
 * @param {{skill: {name: string}, source: string}} entry - 缓存条目
 * @param {string[]|Set<string>} [seededNames] - 随包内置技能名集合
 * @returns {'user'|'builtin'|'managed'} 档位
 */
function sourceTierOf(entry, seededNames) {
  if (entry.source === 'user') return 'user';
  const seeded = seededNames instanceof Set ? seededNames : new Set(seededNames || []);
  return seeded.has(entry.skill.name) ? 'builtin' : 'managed';
}

/**
 * 缓存条目 → 面板投影（**收窄投影**，48 D-14 / DISC-04）
 *
 * **必须收窄**：`_cache.skills[i].skill.content` 是完整正文（≥ 命令的 SKILL.md 全文），
 * 经 IPC 一次全量送进 renderer 最坏 ~3 MB（50 × 64 KiB）且无人消费
 *（`48-RESEARCH.md` 事实 5）。本投影**剔除** `content` / `filePath` / `diagnostics`。
 *
 * 字段名用 `tier` 而非 `source`：数据层 `source` 只有 `'user' | 'managed'`，
 * 语义与取值域都与面板的三档不同（见 sourceTierOf）。
 *
 * @param {{skill: object, source: string, disabled?: boolean, shadowed?: boolean,
 *          shadowedBy?: string, overLimit?: boolean, promptOmitted?: boolean}} entry
 * @param {string[]|Set<string>} [seededNames] - 随包内置技能名集合
 * @returns {{name: string, description: string, tier: string, disableModelInvocation: boolean,
 *            disabled: boolean, shadowed: boolean, shadowedBy?: string,
 *            overLimit: boolean, promptOmitted: boolean}}
 */
function toUISkillEntry(entry, seededNames) {
  const out = {
    name: entry.skill.name,
    description: entry.skill.description,
    tier: sourceTierOf(entry, seededNames),
    disableModelInvocation: entry.skill.disableModelInvocation === true,
    disabled: entry.disabled === true,
    shadowed: entry.shadowed === true,
    overLimit: entry.overLimit === true,
    promptOmitted: entry.promptOmitted === true,
  };
  // shadowedBy 只在确实被遮蔽时出现（不写 undefined —— 投影里不携带无意义键）
  if (entry.shadowed === true) out.shadowedBy = entry.shadowedBy;
  return out;
}

/**
 * 按技能文件的绝对路径反查条目（48 DISC-05）—— **纯函数、零 IO**，不重新扫盘
 *
 * 用途：`read` 工具卡片技能化的事件侧判定、以及重载路径的 `tier` 还原（入库存的是
 * `location` = `skill.filePath`）。用 `path.resolve` 规范化后**全等比较** ——
 * 绝不按目录前缀猜（前缀匹配会把 `skills/foo-bar/SKILL.md` 误判为 `skills/foo`）。
 *
 * @param {string} absPath - 技能文件路径（可含 `..` / 相对段，内部规范化）
 * @param {string[]|Set<string>} [seededNames] - 随包内置技能名集合（求 tier 用）
 * @returns {{name: string, tier: string}|null} 命中返回 `{name, tier}`，否则 null
 */
function matchSkillByPath(absPath, seededNames) {
  if (typeof absPath !== 'string' || !absPath) return null;
  let target;
  try {
    target = path.resolve(absPath);
  } catch {
    return null;
  }
  for (const entry of _cache.skills) {
    const filePath = entry.skill && entry.skill.filePath;
    if (typeof filePath !== 'string' || !filePath) continue;
    if (path.resolve(filePath) !== target) continue;
    return { name: entry.skill.name, tier: sourceTierOf(entry, seededNames) };
  }
  return null;
}

/**
 * 面板数据源投影（48 D-17 / DISC-04）—— **同步、零 IO**
 *
 * 与 `getSkillsSnapshot` 的区别：这里是**面板消费面的收窄投影**（剔除正文与诊断），
 * 不经 IPC 送出任何 `SKILL.md` 正文；`refreshedAt` / `digest` 供 renderer 做
 * stale-while-revalidate 的「快照是否变化」判定。
 *
 * @param {string[]|Set<string>} [seededNames] - 随包内置技能名集合
 * @returns {{skills: Array<object>, refreshedAt: number, digest: string}}
 */
function getSkillsForUI(seededNames) {
  return {
    skills: _cache.skills.map((e) => toUISkillEntry(e, seededNames)),
    refreshedAt: _cache.refreshedAt,
    digest: _cache.digest,
  };
}

/**
 * 设置页「技能管理」区的数据源投影（Phase 50 D-13 / D-03）—— **同步、零 IO**
 *
 * ## 为什么不扩展 `getSkillsForUI()`（这条判断只在注释里活着就会在下个阶段被合并回去）
 *
 * 两个投影的**消费者字段需求本就不同**，`getSkillsForUI()` 是 `/` 面板的
 * **有意收窄投影**（48 明文剔除 `content` / `filePath` / `diagnostics`，
 * 防一次 IPC 送最坏 ~3 MB 正文）。本投影**新增** `bytes` / `fileCount` /
 * `statsUnavailable` / `diagnostics` 四项（**仍不带正文**），
 * 并把「按来源分组 + 组内定序」也一并做完（D-03：分组与排序都在主进程）。
 *
 * 合并两个投影的代价是**实打实的负优化**：`/` 面板每次打开都要白传 100 条技能的
 * 目录遍历结果与诊断数组，而它一条都不消费。因此**「消除重复」在这里是错的**。
 *
 * ## 形状
 *
 * - `groups`：按 `user → builtin → managed` 的固定档位顺序产出的数组，
 *   **空组已剔除**（D-03 要求空组剔除在主进程完成 ⇒ 渲染层零判定）；
 *   组内顺序 = `_cache.skills` 既有顺序（即 `bySkillPriority` 全序的稳定投影，
 *   本函数**不重排**）。每组形状 `{ tier, items }`。
 * - 条目 = `toUISkillEntry()` 的**全部**字段 + 四个管理面字段：
 *   - `bytes` / `fileCount`：重扫管线内算好并挂在缓存条目上（**读取时零 IO**，D-13）
 *   - `statsUnavailable`：`bytes === 0 && fileCount === 0` 的**显式布尔**，
 *     表达「统计不可用」而非「0 字节」。**不得**依赖「此时必有诊断」这类隐式契约
 *     —— 它会被后续「顺手去掉冗余诊断」打翻（T-50-05）
 *   - `diagnostics`：**必须 `slice()` 深拷数组**。条目级 `diagnostics` 是 `_cache`
 *     内的**活数组**，浅拷会让设置页的展开操作把数据写回权威快照
 * - `errors` / `refreshedAt` / `digest`：`_cache` 同名键的浅拷贝视图
 * - `limits`：`LIMITS` 的五个数值投影（键名与常量名一一对应但**语义化命名**）——
 *   设置页**不得写死任何限额数值**（45/46 建立的「端点与前端零字面量」纪律），
 *   限额一律取本字段回传值
 *
 * **仍不携带 `content` 与 `filePath`**：正文没有任何管理面消费者，而 `filePath` 是
 * 沙箱内绝对路径（对用户无意义，且 UI-SPEC 明文「诊断 path 不上屏」）。
 *
 * ## 为什么 `computeDigest` 里没有 `bytes` / `fileCount`（反向禁令）
 *
 * 尺寸不影响 prompt 段。把它加进 digest 会让「给技能加一个 `references/notes.md`」
 * 触发 systemPrompt 改写 + 广播 ⇒ provider 前缀缓存 miss，是一条**纯性能回归**。
 * 尺寸因此只随 `refreshedAt` 失效、**不进 digest**（D-13 / D-18 双禁令）。
 *
 * @param {string[]|Set<string>} [seededNames] - 随包内置技能名集合（调用方注入）
 * @returns {{groups: Array<{tier: string, items: Array<object>}>, errors: Array<object>,
 *            refreshedAt: number, digest: string, limits: object}}
 */
function getSkillsForManagement(seededNames) {
  const seeded = seededNames instanceof Set ? seededNames : new Set(seededNames || []);
  const groups = [];
  for (const tier of ['user', 'builtin', 'managed']) {
    const items = [];
    for (const entry of _cache.skills) {
      if (sourceTierOf(entry, seeded) !== tier) continue;
      const item = toUISkillEntry(entry, seeded);
      item.bytes = typeof entry.bytes === 'number' ? entry.bytes : 0;
      item.fileCount = typeof entry.fileCount === 'number' ? entry.fileCount : 0;
      item.statsUnavailable = item.bytes === 0 && item.fileCount === 0;
      item.diagnostics = Array.isArray(entry.diagnostics) ? entry.diagnostics.slice() : [];
      items.push(item);
    }
    if (items.length > 0) groups.push({ tier, items });
  }
  return {
    groups,
    errors: _cache.errors.slice(),
    refreshedAt: _cache.refreshedAt,
    digest: _cache.digest,
    limits: {
      maxSkillMdBytes: LIMITS.MAX_SKILL_MD_BYTES,
      maxUserSkills: LIMITS.MAX_USER_SKILLS,
      maxManagedSkills: LIMITS.MAX_MANAGED_SKILLS,
      skillsPromptCharBudget: LIMITS.SKILLS_PROMPT_CHAR_BUDGET,
      maxDescriptionChars: LIMITS.MAX_SKILL_DESCRIPTION_CHARS,
    },
  };
}

/**
 * 解析一次显式技能调用的目标并**当场从磁盘读取正文**（用户 2026-09-11 硬约束）
 *
 * 读取口用 SDK 自己的 `loadSkills(env, <技能目录>)`：单目录、根层 SKILL.md 命中即返回
 *（`skills.js:88-103`），一次 listDir + 一次 readTextFile。**不自行剥 frontmatter** ——
 * 本模块不得重新实现 SDK 的解析（见文件头依赖纪律）。
 *
 * 四条口径（缺一即静默错）：
 * 1. 查找**跳过 `shadowed === true`** —— 手打 `/skill:name` 一律作用于胜出者（D-11）
 * 2. `disabled` 判定在**读盘之前**（D-10 拒绝，不做无用 IO）
 * 3. 空正文 / 仅空白正文**在组装之前**拒绝 —— `formatSkillInvocation` 对缺失 content
 *    不抛错、会静默产出字面量 `undefined`（`48-RESEARCH.md` 事实 1）
 * 4. **不做**「读失败回退缓存快照」—— 那会直接违反硬约束（用户要的就是「当场读」）
 *
 * 返回值域**只有两个失败码**：`not_found`（不存在 / 被整条跳过 / 文件被删 /
 * 目录读不到 / 正文为空）与 `disabled`。D-13 推论要求前者与「不存在」同形。
 *
 * **命中判据是所在目录**（与 `enforceDirNameAuthority` 同口径），**不是**可能被
 * frontmatter 伪造的 `Skill.name`：SDK 的名称是 `frontmatterName || parentDirName`
 * （`skills.js:218-219`），而目录名才是 Realm 的唯一权威（46 D-08）。用目录路径
 * 判定同一性，`frontmatter name ≠ 目录名` 的合法技能（GitHub 导入常见）才能被
 * 显式调用；「目录被换成别的技能」的证据也随之变成**目录读不到 / 路径不等**。
 *
 * 命中后把 `name` 重写为入参（目录名）再返回：SDK 的 `formatSkillInvocation` 取的是
 * `skill.name`（`skills.js:9`），不重写会让 frontmatter 里的冒名 name 进注入块；重载
 * 链路 `parseStoredSkillInvocation` 也从注入块的 `name` 属性取技能名，重写才能保证
 * 「重开对话后 pill 名称与实时链路一致」。
 *
 * @param {object} env - 沙箱 ExecutionEnv（agent-workspace.createSandboxEnv 的返回值）
 * @param {string} name - 技能名（调用方已解析；恒等于目录名 —— 46 D-08）
 * @returns {Promise<{ok: true, skill: object, source: string}
 *                   | {ok: false, reason: 'not_found'|'disabled', name: string}>}
 */
async function readSkillForInvocation(env, name) {
  const entry = _cache.skills.find((e) => e.skill.name === name && e.shadowed !== true);
  if (!entry) return { ok: false, reason: 'not_found', name };
  if (entry.disabled === true) return { ok: false, reason: 'disabled', name };

  // SDK 为 ESM-only，只能从包根动态 import（与 refreshSkills 同款）
  const { loadSkills } = await import('@earendil-works/pi-agent-core');
  let skills = [];
  try {
    const res = await loadSkills(env, path.dirname(entry.skill.filePath));
    skills = (res && res.skills) || [];
  } catch {
    // SDK 读盘失败只产诊断 + 空技能集、不抛错；真抛错时按「不存在」处理（不冒名注入）
    return { ok: false, reason: 'not_found', name };
  }
  // 同一性改由**所在目录**判定（与 enforceDirNameAuthority 同口径）：读回来的就是
  // 缓存条目那个目录下的 SKILL.md。归一化只用纯词法 path.resolve（与 48-03 的
  // matchSkillByPath / _resolveSkillMarker 同规则），不引入 realpath / `~` 展开。
  const expectedDir = path.resolve(path.dirname(entry.skill.filePath));
  const fresh =
    skills.find(
      (s) =>
        s &&
        typeof s.filePath === 'string' &&
        path.resolve(path.dirname(s.filePath)) === expectedDir
    ) || null;
  if (!fresh || typeof fresh.content !== 'string' || fresh.content.trim() === '') {
    return { ok: false, reason: 'not_found', name };
  }
  // name 重写为入参（目录名）：formatSkillInvocation 用 skill.name 生成注入块的 name
  // 属性，不重写会让 frontmatter 里声明的名字进注入块（防冒名，46 D-08）
  return { ok: true, skill: { ...fresh, name }, source: entry.source };
}

// ==================== Phase 49：技能集的 AI 写入路径（manage_skill 的权威实现层） ====================
//
// 六条不可回退的纪律（CONTEXT D-01..D-13 的落点）：
// 1. 写目标恒为 `agent-workspace/managed-skills/<name>/SKILL.md` —— **绝不动
//    `agent-workspace/skills/`**（那是用户目录）。边界由**接口设计**保证
//    （工具不吃 `path`，路径由本模块 `path.join` 计算），不是靠沙箱 —— 沙箱的
//    `exec` 不校验命令内容，无法表达目录级只读（ARCHITECTURE Anti-Pattern 1）。
// 2. seeded 身份 = **播种登记表**（调用方注入的 `seededNames`），不是目录位置。
// 3. 业务校验失败一律 `throw`（对齐 ai-memory-manager.write 先例）→ SDK 转
//    `isError: true` toolResult → LLM 可见并自行修正；**不返回错误对象**。
// 4. 撞名 / seeded / 数量闸一律**读盘**（`env.exists` / `env.listDir`），
//    不用缓存快照 —— bash 可随时改盘，缓存只反映上次重扫时刻。
// 5. 顺序铁律两条，各有归属：
//    - **先扫描、后净化**（D-09）：净化会剥掉零宽字符，顺序颠倒会让零宽字符变体
//      绕过检测。净化只作用于 description。
//    - **净化后必须复验非空**（CR-03）：净化只能缩减，纯零宽字符描述会被净化为空。
//    - **字节闸必须在组装之后**（WR-01）：判据对象是落盘的 SKILL.md 全文（与加载期
//      `FileInfo.size` 同量），不是 content 单独的长度。
// 6. 校验器与写函数住本模块（零 electron 依赖）⇒ Phase 50/51 可直接 require
//    同一份，不各写一份而漂移。

/**
 * `manage_skill` 的**闭合原因码白名单**（D-07）—— 九码 + 沙箱层兜底码
 *
 * **与 Realm 诊断码是两套命名空间**：诊断码（`_cache.diagnostics` /
 * `entry.diagnostics`）一律 `realm_` 前缀、经 `toRealmDiag` 映射；本表是
 * **工具业务错误**的 `Error.code`（经 SDK 转 `isError: true` toolResult 回给 LLM，
 * 并供 Phase 50/51 与测试消费）。两者语义不同、不可混用。
 *
 * 因此本表的字符串一律不写在 `code: '<字面量>'` 的位置 —— 那会被
 * 「Realm 自建诊断码必须以 realm_ 前缀」的源码护栏（`tests/test-ai-skills.js`）
 * 误判为诊断码，而该护栏是对**诊断码**的真实约束、不应为工具错误放宽。
 *
 * 九码（D-07）：SEEDED_PROTECTED / USER_OWNED_CONFLICT / ALREADY_EXISTS /
 * NOT_FOUND / LIMIT_EXCEEDED / INVALID_NAME / INVALID_DESCRIPTION / OVERSIZE /
 * UNSCANNABLE。`UNKNOWN` 是沙箱层（`permission_denied` / `not_found` 等原始码）
 * 统一折叠后的兜底 —— 不把第九码之外的沙箱原始码泄漏给调用方。
 *
 * `NOT_USER_OWNED`（第十码，Phase 50 D-08）是**管理面**（设置页卸载）专用的
 * 新拒绝态：`skills/<name>` 不存在而 `managed-skills/<name>` 存在 ⇒ 「不是你的技能」。
 * 它**只经 HTTP 400 的 `{code}` 返回**，**不进** `MANAGE_SKILL_SHORT_REASON`
 * （`src/skill-picker-model.js` 的那张表只覆盖**工具面**、保持恰 9 键；
 * `manage_skill` 的工具卡片渲染路径不消费本码）。复用 `NOT_FOUND` 会把
 * 「技能不存在」与「技能存在但不是你的」混同，用户看到「技能不存在」而该技能
 * 明明列在页面上 —— 那是失实文案（49-04 修过的三态混同族）。
 */
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

/**
 * 构造带机器可读原因码的业务错误 —— 九码的**唯一构造点**
 *
 * 业务失败一律 `throw`（对齐 `ai-memory-manager.write` 先例）→ SDK 转
 * `isError: true` toolResult → LLM 可见并自行修正；**不返回错误对象**。
 * 错误消息只给原因码 + 可操作提示 + 限额 / 当前值，**不回显被拒内容原文**。
 *
 * @param {string} code - 原因码（取 `MANAGE_SKILL_ERROR` 之一）
 * @param {string} message - 中文可读原因
 * @param {object} [extra] - 附加结构化字段（如 limit / currentValue）
 * @returns {Error} 带 code 的错误对象
 */
function makeManageSkillError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

/**
 * seeded 判定：`name` 是否属于随包内置技能（判据 3 的判定靶心）
 *
 * 只查注入集合，**不查磁盘存在性、不查目录位置** —— 内置身份来自播种登记表。
 * 容错形态对齐 `sourceTierOf`（数组 / Set 均可）。
 *
 * @param {string} name - 技能名
 * @param {string[]|Set<string>} seededNames - 随包内置技能名集合（调用方注入）
 * @returns {boolean}
 */
function isSeededName(name, seededNames) {
  const set = seededNames instanceof Set ? seededNames : new Set(seededNames || []);
  return set.has(name);
}

/**
 * 校验技能名（D-06）—— **SDK `validateName` 判据集的提前执行**，不是发明新规则
 *
 * 四条判据（`harness/skills.js` 的 `validateName` 恰为这四条，且 SDK 侧只产
 * warning **不拒绝** —— 这正是 D-06 的动机：超长 / 非法 name 会带着 warning
 * 进 system prompt）：
 *   ① 长度 ≤ `MAX_SKILL_NAME_CHARS`（64）
 *   ② `^[a-z0-9-]+$`
 *   ③ 无首尾连字符（目录名以 `-` 开头会让 AI 用 bash 调技能自带 script 时被当选项）
 *   ④ 无连续连字符
 *
 * **只 trim 首尾空白、不自动 lowercase** —— 静默规范化会让判据 2 的「非法 name
 * 被拒绝并说明原因」失去触发面。
 *
 * **故意的不对称：写入门严、读入门宽**（D-06）。加载管线对磁盘上已存在的技能
 * 保持宽松（46 D-08「不丢弃命名不规范的合法技能」），因此本校验器**只被写入侧
 * 调用**，绝不在加载管线上加闸。
 *
 * @param {string} name - 技能名（未 trim）
 * @returns {{ok: true} | {ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: string}}
 */
function validateManagedSkillName(name) {
  if (typeof name !== 'string') {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名必须是字符串' };
  }
  const value = name.trim();
  if (!value) {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名不能为空' };
  }
  if (value.length > MAX_SKILL_NAME_CHARS) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.INVALID_NAME,
      reason: `技能名不能超过 ${MAX_SKILL_NAME_CHARS} 个字符（当前 ${value.length} 个）`,
    };
  }
  if (!MANAGED_SKILL_NAME_RE.test(value)) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.INVALID_NAME,
      reason: '技能名只能包含小写字母、数字与连字符（a-z、0-9、-），例如 my-workflow',
    };
  }
  if (value.startsWith('-') || value.endsWith('-')) {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名不能以连字符开头或结尾' };
  }
  if (value.includes('--')) {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名不能包含连续的连字符' };
  }
  return { ok: true };
}

/**
 * 管理面技能名谓词（Phase 50 OQ-2）—— **安全的超集**，不是 `validateManagedSkillName`
 *
 * ## 故意的不对称：写入门严、管理面门宽（OQ-2 要求成文）
 *
 * 加载管线对磁盘上的技能名**故意宽松**（46 D-08：「不丢弃命名不规范的合法技能」——
 * 技能名权威取自目录名，`skills/My_Skill/` 这类手工放进来的目录**会进列表**）。
 * 若管理面复用 `validateManagedSkillName` 的严格形态（`^[a-z0-9-]+$` + 无首尾 /
 * 连续连字符），后果是**列表里明明有条目的技能，开关点了必然 400** —— 用户看到
 * 一个「点了不生效」的开关，属用户可见的失实。
 *
 * 因此本谓词只做「能不能安全地当名字用」这一层判定：**禁用名单是「按名字过滤」的
 * 消费侧信号，不需要名字合法到能写盘**（它与 `manage_skill` 的写入面是两回事）。
 *
 * ## 判据（五条，**不含**严格字符集）
 *
 * ① 必须是字符串；② `trim()` 后非空；③ 长度 ≤ `MAX_SKILL_NAME_CHARS`(64)
 * （复用既有常量，不新写一个 64）；④ **不是**路径归一化符 `.` / `..`；⑤ **不含**
 * `/`、`\` 与控制字符（`\u0000`-`\u001F`）—— ④⑤ 两条共同构成路径注入面
 * （T-50-10：名字要被 `path.join` 进删除路径）。
 *
 * **为什么不加 `^[a-z0-9-]+$`、不加首尾连字符与连续连字符判据**（OQ-2 的不对称）：
 * 见上一段。
 *
 * ## 两条实现纪律（改本函数前必须先读，各有一次真实事故）
 *
 * ① **不得把返回值归一化（`trim()`）** —— 技能名的权威是**目录名**（§三），调用方拿它
 * `path.join` 出删除路径。若这里返回 `name.trim()`，`skills/" foo"` 会被寻址成
 * `skills/foo`：卸载删掉**另一个**技能，停用则写进一个永远匹配不上的名字
 * （开关点了不生效）。故返回**原值**，只把「`trim()` 后为空」当作非法。寻址一律按原值精确匹配。
 *
 * ② **`.` 与 `..` 必须显式拒绝** —— 它们不是普通字符串而是**路径归一化符**：
 * `path.join(<skills 目录>, '.')` 就是 skills 目录本身、`'..'` 就是 agent-workspace 根。
 * 沙箱的 `resolveInside` 拦不住这种形态（目标**就是**沙箱根，判定为「在内部」），
 * 于是 `env.remove(dir, { recursive: true })` 会把整个用户技能目录 / 整个 agent-workspace
 * 递归删掉。这一条曾以 CR-01 的形态真实发生过（`POST /api/skills/uninstall` 可达）。
 *
 * 返回形状与 `validateManagedSkillName` 同形（`{ok:true, value}` / `{ok:false, code, reason}`），
 * 以便同样经 `makeManageSkillError` 构造。三个消费点（`/api/settings/update` 校验、
 * `set-disabled`、`uninstall`）**必须同宽**（UI-SPEC `:479` 明文）。
 *
 * @param {string} name - 技能名（未 trim）
 * @returns {{ok: true, value: string}
 *           | {ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: string}}
 */
function validateSkillNameForManagement(name) {
  if (typeof name !== 'string') {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名必须是字符串' };
  }
  // 归一化纪律 ①：**原值**就是被寻址的名字，不回传 trim 后的值（见 JSDoc）
  const value = name;
  if (!value.trim()) {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名不能为空' };
  }
  if (value.length > MAX_SKILL_NAME_CHARS) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.INVALID_NAME,
      reason: `技能名不能超过 ${MAX_SKILL_NAME_CHARS} 个字符（当前 ${value.length} 个）`,
    };
  }
  // 归一化纪律 ②：`.` / `..` 会把 path.join 的目标上移出 skills 目录（CR-01）
  if (value === '.' || value === '..') {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.INVALID_NAME,
      reason: '技能名不能是路径归一化符（. 或 ..）',
    };
  }
  if (value.includes('/') || value.includes('\\') || /[\u0000-\u001F]/.test(value)) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.INVALID_NAME,
      reason: '技能名不能包含路径分隔符（/、\\）或控制字符',
    };
  }
  return { ok: true, value };
}

/**
 * 禁用名单的**条数上限**（D-10 / T-50-11）—— 两个既有额度之和（50 + 50 = 100）
 *
 * **不得改既有五项 `LIMITS` 数值**：本常量由它们**派生**（不是第六项额度），
 * 语义是「名单最多能列出多少个技能」（user + managed 的全部容量），
 * 而不是「用户可配置的额度」。
 */
const MAX_DISABLED_SKILLS = LIMITS.MAX_USER_SKILLS + LIMITS.MAX_MANAGED_SKILLS;

/**
 * 校验 `settings.aiSkills.disabled`（Phase 50 D-10 / OQ-2）—— **列表级单源**
 *
 * 两条键形态（`aiSkills.disabled` 与 `aiSkills`）**共用这一份判据**：`main.js` 直接
 * require 本模块（零 electron 依赖 ⇒ 可被主进程直接 require，AGENTS.md 的硬约束 ①
 * 已为该用法背书）。**不得**在 `main.js` 或设置页另写第二份正则。
 *
 * 判据：① `Array.isArray(list)`；② 条数 ≤ `MAX_DISABLED_SKILLS`(=100)；
 * ③ 每项经 `validateSkillNameForManagement` 且 `ok === true`。
 * **不得**用 `validateManagedSkillName`（会让 `skills/My_Skill/` 点开关必然 400，
 * 见 `validateSkillNameForManagement` 的故意不对称）。
 *
 * `valid: false` 时调用方**必须在 `configStore.set` 之前 return** ——
 * 否则就是「校验失败但仍落盘」。
 *
 * @param {*} list - 待校验值（来自请求体，可能是任意类型）
 * @returns {{valid: true} | {valid: false, reason: string}}
 */
function validateDisabledListForSettings(list) {
  if (!Array.isArray(list)) {
    return { valid: false, reason: '禁用名单必须是数组' };
  }
  if (list.length > MAX_DISABLED_SKILLS) {
    return {
      valid: false,
      reason: `禁用名单条目过多：上限 ${MAX_DISABLED_SKILLS} 条，当前 ${list.length} 条`,
    };
  }
  for (const item of list) {
    const check = validateSkillNameForManagement(item);
    if (!check.ok) {
      return { valid: false, reason: `禁用名单条目非法：${check.reason}` };
    }
  }
  return { valid: true };
}

/**
 * 校验技能 description（D-07：**必填、trim 后非空**）
 *
 * description 是模型按 description 自动匹配技能的**唯一触发机制**
 *（渐进式披露契约只注入 name / description / location），因此不允许为空。
 * 上限取 `LIMITS.MAX_SKILL_DESCRIPTION_CHARS`（与 SDK `MAX_DESCRIPTION_LENGTH`
 * 对齐、与加载期 `isDescriptionUnusable` 同源）—— 超长 description 会被加载管线
 * 整条跳过，不预筛就会产出幽灵技能。
 *
 * @param {string} text - description 原文（未净化）
 * @returns {{ok: true} | {ok: false, code: MANAGE_SKILL_ERROR.INVALID_DESCRIPTION, reason: string}}
 */
function validateManagedSkillDescription(text) {
  if (typeof text !== 'string') {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_DESCRIPTION, reason: '技能描述必须是字符串' };
  }
  if (!text.trim()) {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_DESCRIPTION, reason: '技能描述不能为空（模型靠它判断何时使用该技能）' };
  }
  if (text.length > LIMITS.MAX_SKILL_DESCRIPTION_CHARS) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.INVALID_DESCRIPTION,
      reason: `技能描述不能超过 ${LIMITS.MAX_SKILL_DESCRIPTION_CHARS} 个字符（当前 ${text.length} 个）`,
    };
  }
  return { ok: true };
}

/**
 * 校验技能正文（写侧**预筛**，不是权威闸口）
 *
 * 两条判据、两个不同的原因码：
 * - trim 后为空 → `invalid_description`（**不新立第十码**：UI-SPEC 的非阻断建议 2
 *   要求显式指定，而九码内的选择比新码更符合 D-07 的闭合白名单纪律；`oversize`
 *   的文案是「正文超限」、语义是长度而非空）
 * - content **单独**的 UTF-8 字节数 > `LIMITS.MAX_SKILL_MD_BYTES` → `oversize`
 *
 * **它不是权威闸口**：写侧的权威闸口是 `validateSkillFileSize` —— 对
 * `buildSkillFileText` 的产物（整文件）计字节，与加载期 `createSkillsEnv` 的
 * `FileInfo.size` 闸同量。本函数只按 content 计字节，是权威闸口的**严格子集预筛**
 * （组装全文 = content + frontmatter，frontmatter 长度恒为正 ⇒ 本函数只可能更早拒，
 * 不可能放行权威闸口会拒的输入）。保留它的理由是**提前量**（纯字符串检查，省掉
 * 组装与后续步骤），不是为了「再判一次」。
 *
 * 历史注记（WR-01）：本函数此前的 JSDoc 声称「与加载期闸口同源同值」—— 该声明已被
 * 实测证伪（content 65200 B 配 1024 字符 description 时落盘 66260 B > 65536 B 闸口）。
 *
 * @param {string} text - 技能正文（Markdown，不含 frontmatter）
 * @returns {{ok: true} | {ok: false, code: string, reason: string}}
 */
function validateManagedSkillContent(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_DESCRIPTION, reason: '技能正文不能为空' };
  }
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > LIMITS.MAX_SKILL_MD_BYTES) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.OVERSIZE,
      reason: `技能正文超过上限：限额 ${LIMITS.MAX_SKILL_MD_BYTES} 字节，当前 ${bytes} 字节`,
    };
  }
  return { ok: true };
}

/**
 * 净化 description（D-09）—— **只作用于 description，content 不净化**
 *
 * 两步：剥控制字符（C0/C1）与零宽字符 → 压单行 + trim。
 *
 * **顺序铁律：先扫描、后净化**（D-09）。本函数是**变形**操作、`scanSkillText` 是
 * **判定**操作；先净化会剥掉零宽字符，让 P3 实测的「零宽字符包裹的注入语」绕过检测，
 * 因此调用方必须严格按「扫描 → 净化」排序（三个动作函数的步骤 2 / 3 即此）。
 *
 * **调用方必须对净化值复验非空**（CR-03）：本函数只能做**缩减**（剥字符 + trim），
 * 因此「校验通过但净化后为空」在原理上必然存在窗口 —— `String.prototype.trim()`
 * 不移除 U+200B，纯零宽字符组成的 description 正好落在窗口里。两个动作函数在
 * 净化之后都会再跑一次 `validateManagedSkillDescription(safeDescription)`。
 *
 * content 不净化：技能正文可能含代码 / 脚本，剥字符会破坏合法内容，且它不进 prompt。
 *
 * @param {string} text - description 原文
 * @returns {string} 单行、无控制字符与零宽字符的描述
 */
function sanitizeSkillDescription(text) {
  return String(text == null ? '' : text)
    // 控制字符（C0/C1）与零宽字符 → 空格（随后由空白折叠统一收敛）
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 扫描技能文本 —— **技能域扫描的唯一调用点**（D-08）
 *
 * 委托 `ai-memory-manager.scanInjectionPatterns`（记忆域与技能域共用同一份模式表与
 * 同一份判定逻辑）。命中即 `throw`（对齐 memory 工具「拒绝写入」的语义先例，
 * **不是** `validateScript` 的「拒绝执行」）。Phase 51 的技能域威胁模式组只需
 * 扩表（在同一份模式单源里追加条目），**不加接线** —— 故本阶段**不**预置任何
 * 技能域威胁模式表，也不出现其标识符。
 *
 * 字段分离（调用方口径，不可调换）：
 * - `description` → `{ includeCredentials: true }`（无条件进每个请求的 system prompt，
 *   与两层记忆同构：秘密入库 = 上传第三方）
 * - `content` → `{ includeCredentials: false }`（不进 prompt，且技能文档合法地会写
 *   配置示例，跑凭据组会误伤合法技能创建）
 *
 * @param {string} text - 待扫描文本
 * @param {{includeCredentials?: boolean}} [options] - 字段分离开关
 * @throws {Error} 命中任何模式（code: MANAGE_SKILL_ERROR.UNSCANNABLE）
 */
function scanSkillText(text, { includeCredentials = true } = {}) {
  const result = getAiMemoryManagerLazy().scanInjectionPatterns(text, { includeCredentials });
  if (!result || result.safe !== true) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNSCANNABLE,
      `技能内容被拒绝：${(result && result.reason) || '命中安全扫描'}。请调整措辞后重试`
    );
  }
}

/**
 * 组装 SKILL.md 全文（frontmatter 恰 `name` + `description` 两行）
 *
 * `content` 首部若自带 YAML frontmatter 块一律**静默剥除**（A5 裁决）——
 * 不剥除会产生双层 `---` 头、SDK 解析结果不确定，而九码里没有 `invalid_content`。
 *
 * `description` 一律经 `yamlScalar` 编码成 YAML 单引号标量（CR-02）——
 * 它是 LLM 自由文本，裸插值会被 `: ` / `#` / 裸标量形态击穿 frontmatter 结构。
 *
 * **`name` 不编码是有前提的**：`validateManagedSkillName` 已把字符集收窄为
 * `[a-z0-9-]`（无 `:` / `#` / 引号 / 换行 / 前导 `-` / 前导 `@`），且该校验器
 * **只被写入侧调用**（读入门宽的不对称见 D-06）。日后若放宽 name 字符集，
 * 这里的「不编码」立刻变成 CR-02 的同款缺口。
 *
 * @param {{name: string, description: string, content: string}} parts
 * @returns {string} SKILL.md 全文（frontmatter + 空行 + 正文）
 */
function buildSkillFileText({ name, description, content }) {
  const body = String(content == null ? '' : content).replace(LEADING_FRONTMATTER_RE, '');
  return `---\nname: ${name}\ndescription: ${yamlScalar(description)}\n---\n\n${body}`;
}

/**
 * 写侧**权威**字节闸口：对组装后的 SKILL.md **全文**测 UTF-8 字节（WR-01）
 *
 * 判据对象是 `buildSkillFileText` 的产物本身 —— 这是唯一**不会漂移**的形态：
 * frontmatter 形状日后变化时闸口自动跟着变。**不得**改成「`MAX_SKILL_MD_BYTES`
 * 减去一个硬编码的 frontmatter 开销」：那个常量一旦与实际 frontmatter 形态脱节，
 * 就会重新开出幽灵技能带（WR-01 实测该带宽约 1.06 KB，不是记录里的约 56 字节）。
 *
 * 与加载期 `createSkillsEnv.readTextFile` 的 `FileInfo.size > maxSkillMdBytes`
 * 判的是**同一个量**（整文件 UTF-8 字节）。`validateManagedSkillContent` 的
 * content 单独计字节是它的严格子集预筛，不能替代它。
 *
 * create / update 两个动作**共用这一份实现** —— 两侧同阈值、同拒绝码、同「不落盘」语义。
 *
 * 成功时一并返回被计量的 `text`：调用方**必须**把这一份产物交给原子写
 * （而不是重新组装一次），使「测的字节」与「写的字节」在对象层面就是同一份。
 *
 * @param {{name: string, description: string, content: string}} parts
 *   组装入参（`description` 必须是**净化后**的值）
 * @returns {{ok: true, text: string}
 *           | {ok: false, code: string, reason: string, limit: number, currentValue: number}}
 */
function validateSkillFileSize({ name, description, content }) {
  const text = buildSkillFileText({ name, description, content });
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > LIMITS.MAX_SKILL_MD_BYTES) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.OVERSIZE,
      // 原因文案同时带上限额与当前值（UI-SPEC 的 oversize 文案口径），且**不回显被拒内容原文**
      reason: `技能文件超过上限：限额 ${LIMITS.MAX_SKILL_MD_BYTES} 字节，当前 ${bytes} 字节（按 frontmatter + 正文的整文件计）`,
      limit: LIMITS.MAX_SKILL_MD_BYTES,
      currentValue: bytes,
    };
  }
  return { ok: true, text };
}

/** 从沙箱 Result 里取可读的错误码（失败 Result 的形状为 `{ ok: false, error: { code } }`） */
function sandboxErrorCode(result) {
  return (result && result.error && result.error.code) || MANAGE_SKILL_ERROR.UNKNOWN;
}

/**
 * 原子写技能文件的**唯一写路径**（create 与 update 共用）
 *
 * `env.createTempFile()` → `env.writeFile(tmp)` → `env.renameFile(tmp, destFile)`：
 * POSIX 文件级 rename 对**已存在目标**是原子替换 ⇒ 不会留半成品文件。
 *
 * 三条实测硬约束（改实现前必须重新实测）：
 * 1. `createTempFile` 的 suffix 经 `sanitizeNamePart` 剥掉点号（`.md` → `md`）——
 *    无功能影响，但**不得**写依赖扩展名的断言。
 * 2. `renameFile` 到缺失父目录返回 `not_found` ⇒ **`createDir` 是硬前置**
 *    （update 的目标目录必然已存在，故只有 create 需要先建）。
 * 3. 每次调用在 `.tmp/` 留下一个空 `tmp-XXXXXX/` 目录（`.tmp/` 不是技能扫描根，
 *    无功能影响；已知且接受的累积，**不为此加清理代码**）。
 *
 * 沙箱错误与业务错误**分层**（assumptions 6）：沙箱返回 Result，本函数把它转成带
 * `code` 的业务错误对象再 throw；两者都**不裸传**底层 message 给 LLM。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {string} destFile - 目标 SKILL.md 绝对路径（由调用方 `path.join` 计算）
 * @param {string} text - 文件全文
 * @throws {Error} 任一步失败（空路径、创建临时文件、写入、rename）
 */
async function atomicWriteSkillFile(env, destFile, text) {
  // 空 / 非字符串路径不做任何 IO：沙箱会把空路径 resolve 到 root 本身，
  // 把这种输入交给沙箱等于让它去猜语义（assumptions 5）
  if (typeof destFile !== 'string' || !destFile.trim()) {
    throw makeManageSkillError(MANAGE_SKILL_ERROR.UNKNOWN, '技能文件目标路径非法（空路径不做任何 IO）');
  }

  const tmp = await env.createTempFile({ prefix: 'skill-', suffix: '.md' });
  if (!tmp || tmp.ok !== true) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNKNOWN,
      `创建技能临时文件失败（沙箱码 ${sandboxErrorCode(tmp)}）`
    );
  }

  const written = await env.writeFile(tmp.value, text);
  if (!written || written.ok !== true) {
    await env.remove(tmp.value, { force: true });
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNKNOWN,
      `写入技能临时文件失败（沙箱码 ${sandboxErrorCode(written)}）`
    );
  }

  const renamed = await env.renameFile(tmp.value, destFile);
  if (!renamed || renamed.ok !== true) {
    await env.remove(tmp.value, { force: true });
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNKNOWN,
      `技能文件落盘失败：目标路径 ${destFile}（沙箱码 ${sandboxErrorCode(renamed)}）`
    );
  }
}

/**
 * 计算 managed 技能的三段路径（`<managedDir>` / `<managedDir>/<name>` / 其下 SKILL.md）
 *
 * 路径恒由 `path.join` 计算 —— 工具层**不吃 `path` 参数**，这是路径边界的唯一实现处
 *（T-49-01-01 / ARCHITECTURE Anti-Pattern 1：沙箱在这里提供不了保护，接口设计才是边界）。
 *
 * @param {string} name - 已 trim 的技能名
 * @returns {{managedDir: string, destDir: string, destFile: string}}
 */
function managedSkillPaths(name) {
  const managedDir = getAgentWorkspaceLazy().getManagedSkillsDir();
  const destDir = path.join(managedDir, name);
  return { managedDir, destDir, destFile: path.join(destDir, 'SKILL.md') };
}

/**
 * 统计**非 seeded** 的 managed 技能目录数（D-10 数量闸的统计对象，一律读盘）
 *
 * 对齐 `MAX_USER_SKILLS`「只统计 user 来源」的写法**是错的** —— 那条注释的理由
 *（「managed 由应用自身投递，不计入配额」）在 AI 也能投递 managed 之后不再成立。
 * 读目录失败时按 0 计（不因读目录失败而拒绝创建）。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {string} managedDir - managed 技能目录
 * @param {string[]|Set<string>} seededNames - 随包内置技能名集合
 * @returns {Promise<number>} 非 seeded managed 目录数
 */
async function countManagedSkills(env, managedDir, seededNames) {
  const entries = await env.listDir(managedDir);
  if (!entries || entries.ok !== true || !Array.isArray(entries.value)) return 0;
  // listDir 的 entry 形状是 `{ name, path, kind, size, mtimeMs }`（实测）——
  // 是 `kind === 'directory'` 而**不是** `isDirectory()` 方法
  return entries.value.filter(
    (entry) => entry && entry.kind === 'directory' && !isSeededName(entry.name, seededNames)
  ).length;
}

/**
 * 计算 user 技能的两段路径（`<skillsDir>` / `<skillsDir>/<name>`）
 *
 * 与 `managedSkillPaths` 同款：**路径恒由 `path.join` 计算**，目录名一律用
 * **校验后的 name**，绝不用包内原始目录名拼路径（P5 第 2 条 —— 那是一个注入点）。
 *
 * @param {string} name - 已 trim 的技能名
 * @returns {{skillsDir: string, destDir: string}}
 */
function userSkillPaths(name) {
  const skillsDir = getAgentWorkspaceLazy().getSkillsDir();
  return { skillsDir, destDir: path.join(skillsDir, name) };
}

/**
 * 【导入冲突判定】—— 三档，**判定顺序本身就是语义**（D-08）
 *
 * ## ⚠️ 不得复用 `resolveManagedTarget`
 *
 * 后者的判据方向**相反**（managed 视角：先判 seeded、再判 user 占用 ⇒ 拒绝），
 * 50 的 `deleteUserSkill` 已明文付过这条代价。本函数**只借它的形状**。
 *
 * ## 三档（顺序固定不可调换）
 *
 *  ① `isSeededName` ⇒ `{ kind: 'seeded', code: SEEDED_CONFLICT }` ——
 *     **拒绝导入、不提供覆盖**（P3 / SEC-07 字面）；先判定且**不查磁盘**
 *     （内置身份来自播种登记表而非目录位置）。调用方应据此**直接失败**
 *     （`buildImportPreview` 亦然，见其 conflict 字段）。
 *  ② `skills/<name>` 存在（**必须是目录**）⇒ `{ kind: 'user' }` ——
 *     前端给**三选一：覆盖 / 改名 / 取消**（**绝不静默覆盖**，SEC-07）。
 *  ③ `managed-skills/<name>` 存在 ⇒ `{ kind: 'managed', shadowedBy: 'managed' }` ——
 *     **不允许覆盖**（导入只管 `skills/<name>/`，覆盖 managed 不可能是用户意图），
 *     按 46 D-06 提示「导入后该 AI 自建技能将被**永久遮蔽**」，允许**改名 / 取消**。
 *  ④ 否则 ⇒ `{ kind: 'none' }`。
 *
 * ⚠️ 「是目录」必须用 `env.fileInfo` 判 `kind === 'directory'` —— `env.exists`
 * 对普通文件也返回 true，用错会把一个同名**文件**误判成可覆盖的目录。
 *
 * ⚠️ 判据**一律读盘**（bash 可随时改写磁盘），不用缓存快照。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {string} name - 已 trim 的技能名
 * @param {{seededNames?: string[]|Set<string>}} [inject] - seeded 集合由调用方注入
 * @returns {Promise<{kind: 'seeded'|'user'|'managed'|'none',
 *                    code?: string, message?: string, shadowedBy?: string}>}
 */
async function resolveImportConflict(env, name, { seededNames } = {}) {
  if (isSeededName(name, seededNames)) {
    return {
      kind: 'seeded',
      code: IMPORT_SKILL_ERROR.SEEDED_CONFLICT,
      message: `"${name}" 是内置技能名，受保护，无法导入。请改用其它名称。`,
    };
  }

  const { destDir } = userSkillPaths(name);
  if (await envDirExists(env, destDir)) {
    return { kind: 'user', message: `已存在同名用户技能「${name}」。` };
  }

  const managedDest = path.join(getAgentWorkspaceLazy().getManagedSkillsDir(), name);
  if (await envDirExists(env, managedDest)) {
    return {
      kind: 'managed',
      shadowedBy: 'managed',
      message: `已存在同名 AI 自建技能「${name}」，导入后它将被永久遮蔽。`,
    };
  }

  return { kind: 'none' };
}

/**
 * 统一的【目标判定】—— 四类撞名 / 保护判定在三个动作里**只有这一份判据**
 *
 * 判定顺序**固定不可调换**（顺序本身就是语义）：
 *   ① `isSeededName` → `seeded_protected`（**先判定且不查磁盘**：内置身份来自
 *      播种登记表而非目录位置，判据 3）；
 *   ② 同名用户技能存在 → `user_owned_conflict`（46 D-06 的 user > managed ⇒
 *      AI 建同名的会被**永久遮蔽**，不拒绝就是静默无用）；
 *   ③ 目标目录不存在 → `not_found`（update / delete 的失败面；create 把它读作
 *      「可以创建」）；
 *   ④ 否则 → `{ ok: true, destDir, destFile }`（目标已存在且是 AI 可改可删的
 *      managed 技能；create 把它读作 `already_exists`）。
 *
 * 前三类一律**不落盘**。撞名判定**一律读盘**（`env.exists`），不用缓存快照 ——
 * bash 可随时改写磁盘，缓存只反映上次重扫的时刻。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {string} name - 已 trim 的技能名
 * @param {string[]|Set<string>} seededNames - 随包内置技能名集合（调用方注入）
 * @returns {Promise<{ok: true, destDir: string, destFile: string}
 *                   | {ok: false, code: string, message: string}>}
 */
async function resolveManagedTarget(env, name, seededNames) {
  const { destDir, destFile } = managedSkillPaths(name);

  if (isSeededName(name, seededNames)) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.SEEDED_PROTECTED,
      message: `"${name}" 是随包内置技能，不能被覆盖或删除。请换一个名字创建新技能，或只增强你自己创建（managed）的技能`,
    };
  }

  const userDir = path.join(getAgentWorkspaceLazy().getSkillsDir(), name);
  const existsUser = await env.exists(userDir);
  if (existsUser && existsUser.ok === true && existsUser.value === true) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.USER_OWNED_CONFLICT,
      message: `存在同名用户技能 "${name}"：用户技能优先级更高，AI 创建的会被它永久遮蔽，且它不属于 AI 的管理范围。请换一个名字`,
    };
  }

  const existsManaged = await env.exists(destDir);
  const managedPresent = existsManaged && existsManaged.ok === true && existsManaged.value === true;
  if (!managedPresent) {
    return {
      ok: false,
      code: MANAGE_SKILL_ERROR.NOT_FOUND,
      message: `技能 "${name}" 不存在（AI 只能修改或删除自己创建在 managed-skills 下的技能）。请先用 create 创建它`,
    };
  }

  return { ok: true, destDir, destFile };
}

/**
 * 创建 managed 技能（`manage_skill` 的 create 动作，MGMT-01）
 *
 * **独占创建**（D-07，对齐 oh-my-pi 与 FEATURES §5.3）：目标已存在（任何来源）
 * 即拒绝且**不落盘**，四类来源给不同可读原因。不是 upsert。
 *
 * 步骤顺序**本身就是纪律**（两条顺序不变式各有归属）：
 *   ① 纯校验（name / description **原文** / content）→ ② 扫描**原文** →
 *   ③ 净化 description → ④ **净化值复验非空** → ⑤ 路径 / 撞名判定 / 数量闸 →
 *   ⑥ **组装全文字节闸** → ⑦ 组装 → 原子写。
 * - 扫描必须在净化**之前**（D-09）：净化会剥零宽字符，顺序颠倒会让
 *   「零宽字符包裹的注入语」绕过检测。
 * - 字节闸必须在组装**之后**（WR-01）：判据对象是落盘产物本身（整文件字节），
 *   与加载期 `FileInfo.size` 同量；只按 content 计字节会留下约 1 KB 的幽灵技能带。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {{name: string, content: string, description: string,
 *          seededNames?: string[]|Set<string>}} params
 * @returns {Promise<{name: string, filePath: string, description: string, action: 'create'}>}
 * @throws {Error} 校验 / 扫描 / 撞名 / 数量闸 / 字节闸 / 写入失败（均带 `code`）
 */
async function createManagedSkill(env, { name, content, description, seededNames } = {}) {
  // 1. 三个纯校验器（name 只 trim、不 lowercase；description 的长度与类型按**原文**判）
  const skillName = typeof name === 'string' ? name.trim() : name;
  const nameCheck = validateManagedSkillName(skillName);
  if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);
  const descCheck = validateManagedSkillDescription(description);
  if (!descCheck.ok) throw makeManageSkillError(descCheck.code, descCheck.reason);
  const contentCheck = validateManagedSkillContent(content);
  if (!contentCheck.ok) throw makeManageSkillError(contentCheck.code, contentCheck.reason);

  // 2. 先扫描（description 跑两组；content 只跑注入组）；扫的是**原文**（D-09）
  scanSkillText(description, { includeCredentials: true });
  scanSkillText(content, { includeCredentials: false });

  // 3. 后净化（只作用于 description）
  const safeDescription = sanitizeSkillDescription(description);

  // 3.5 净化值复验（CR-03）：净化是**只能缩减**的变形，因此这里唯一可能新增的失败
  //     是「复验后为空」—— String.prototype.trim() 不移除 U+200B，纯零宽字符组成的
  //     描述会正好落在这个窗口里。校验器直接复用，拒绝码原样透传（invalid_description），
  //     不新立第十码。
  const safeDescCheck = validateManagedSkillDescription(safeDescription);
  if (!safeDescCheck.ok) throw makeManageSkillError(safeDescCheck.code, safeDescCheck.reason);

  // 4. 路径（恒由 path.join 计算）
  const { managedDir, destDir, destFile } = managedSkillPaths(skillName);

  // 5. 撞名判定：**复用统一的目标判定**（与 update / delete 同一份判据）。
  //    读底盘、绝不用 createDir 的返回值 —— 后者对已存在目录返回 ok:true 幂等，
  //    据此判「不存在」会把既有技能静默覆写（E2 回归护栏）。
  //    四类来源的映射：seeded_protected / user_owned_conflict 直接抛出；
  //    not_found（目标不存在）对 create 读作「可以创建」；ok:true（目标已存在且是
  //    AI 可改可删的 managed）则读作 already_exists —— 独占创建，不是 upsert。
  //    managed 侧「已存在」与「用户手放在 managed-skills/ 下的」同形（工具无法区分）。
  const target = await resolveManagedTarget(env, skillName, seededNames);
  // 目标已存在且是 AI 可改可删的 managed ⇒ create 的独占语义下就是 already_exists
  //（update / delete 把它读作「可以操作」，create 读作「不许覆盖」）
  if (target.ok === true) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.ALREADY_EXISTS,
      `技能 "${skillName}" 已存在。请改用 update 覆写它的正文，或换一个名字`
    );
  }
  // 其余拒绝原样抛出：seeded_protected / user_owned_conflict 在三个动作里**同形**
  if (target.code !== MANAGE_SKILL_ERROR.NOT_FOUND) {
    throw makeManageSkillError(target.code, target.message);
  }

  // 6. 数量闸（只约束 create；update / delete 不受限，否则到顶后无法自救）
  const managedCount = await countManagedSkills(env, managedDir, seededNames);
  if (managedCount >= LIMITS.MAX_MANAGED_SKILLS) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.LIMIT_EXCEEDED,
      `AI 自建技能数量已达上限（${LIMITS.MAX_MANAGED_SKILLS} 个，seeded 内置技能不计入）。请先删除不再需要的技能再创建`,
      { limit: LIMITS.MAX_MANAGED_SKILLS, currentValue: managedCount }
    );
  }

  // 6.5 权威字节闸（WR-01）—— 必须在**组装之后、任何落盘之前**：
  //     判据对象是 `buildSkillFileText({ name, description: safeDescription, content })`
  //     产物的 UTF-8 字节数，与加载期 `createSkillsEnv.readTextFile` 的 `FileInfo.size`
  //     同为「整文件」口径。只按 content 计字节的预筛（步骤 1）是它的**严格子集**，
  //     不能替代它。此位点在数量闸之后、createDir 之前 ⇒ 拒绝即不建目录、零残留。
  const sizeCheck = validateSkillFileSize({
    name: skillName,
    description: safeDescription,
    content,
  });
  if (!sizeCheck.ok) {
    throw makeManageSkillError(sizeCheck.code, sizeCheck.reason, {
      limit: sizeCheck.limit,
      currentValue: sizeCheck.currentValue,
    });
  }

  // 7. 建目录（renameFile 到缺失父目录必失败 ⇒ createDir 是硬前置）。
  //    走到这里只剩 not_found 一种情形 ⇒ 目标目录必然不存在，本次一定是「新建」。
  //    createDir 的返回值不参与任何判定（幂等，E2）。
  const madeDir = true;
  await env.createDir(destDir);

  // 8. 原子写；失败清理**只在本次确实新建了目录时**执行 —— 否则会误删不属于
  //    本次操作的数据（Pitfall 9）。清理后不留半成品目录 / 半成品文件。
  try {
    await atomicWriteSkillFile(env, destFile, sizeCheck.text);
  } catch (err) {
    if (madeDir) await env.remove(destDir, { recursive: true });
    throw err;
  }

  return { name: skillName, filePath: destFile, description: safeDescription, action: 'create' };
}

/**
 * 更新 managed 技能（`manage_skill` 的 update 动作，MGMT-01）
 *
 * **语义按 D-04 固定：全量覆写正文**。`content` 必填 = 完整新正文且**不含
 * frontmatter**（frontmatter 由 `buildSkillFileText` 生成 `name` + `description`
 * 两行）。**不提供** `old_string` / `new_string` 等局部编辑参数 —— 那会与沙箱内
 * `edit` 工具的能力完全重叠（`edit` 在 `managed-skills/**` 上可用是既成事实），
 * 等于同一能力两份实现；且 ROADMAP 判据 2 明文「工具只接受 `name` 与
 * `content` / `description`」，多一个参数会让该判据的验收面（properties 键集合）失败。
 * 局部增强走「先 read 再全量写」或直接用 `edit` 工具。
 *
 * 与 create 的唯一结构性差异：**失败不做任何清理**。目标目录本就存在，其内容由
 * `renameFile` 的原子替换保证保持操作前状态；删目录反而会毁掉用户数据。
 *
 * 步骤顺序与 create **逐字同构**（两条顺序不变式各有归属）：① 纯校验（description
 * **原文**）→ ② 扫描**原文** → ③ 净化 → ④ **净化值复验非空** → ⑤ 目标判定 →
 * ⑥ **组装全文字节闸** → ⑦ 组装 → 原子写。扫描在净化前（D-09）、字节闸在组装后（WR-01）。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {{name: string, content: string, description: string,
 *          seededNames?: string[]|Set<string>}} params
 * @returns {Promise<{name: string, filePath: string, description: string, action: 'update'}>}
 * @throws {Error} 校验 / 扫描 / 目标判定 / 字节闸 / 写入失败（均带 `code`）
 */
async function updateManagedSkill(env, { name, content, description, seededNames } = {}) {
  // 1. 三个纯校验器（description 的长度与类型按**原文**判）
  const skillName = typeof name === 'string' ? name.trim() : name;
  const nameCheck = validateManagedSkillName(skillName);
  if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);
  const descCheck = validateManagedSkillDescription(description);
  if (!descCheck.ok) throw makeManageSkillError(descCheck.code, descCheck.reason);
  const contentCheck = validateManagedSkillContent(content);
  if (!contentCheck.ok) throw makeManageSkillError(contentCheck.code, contentCheck.reason);

  // 2. 先扫描（description 两组；content 一组）；扫的是**原文**（D-09）
  scanSkillText(description, { includeCredentials: true });
  scanSkillText(content, { includeCredentials: false });

  // 3. 后净化
  const safeDescription = sanitizeSkillDescription(description);

  // 3.5 净化值复验（CR-03，与 create 同一步骤）：净化只能缩减 ⇒ 唯一可能新增的
  //     失败是「复验后为空」（纯零宽字符描述）。拒绝码原样透传，不新立第十码。
  const safeDescCheck = validateManagedSkillDescription(safeDescription);
  if (!safeDescCheck.ok) throw makeManageSkillError(safeDescCheck.code, safeDescCheck.reason);

  // 4. 统一的目标判定（seeded / user / not_found 三态即三类拒绝）
  const target = await resolveManagedTarget(env, skillName, seededNames);
  if (!target.ok) throw makeManageSkillError(target.code, target.message);

  // 4.5 权威字节闸（WR-01，与 create 共用同一实现）：判据对象是组装后的整文件
  //     UTF-8 字节（与加载期 `FileInfo.size` 同量）。此位点在目标判定之后、rename
  //     之前 ⇒ 拒绝即目标保持操作前状态（原子替换未发生）。
  const sizeCheck = validateSkillFileSize({
    name: skillName,
    description: safeDescription,
    content,
  });
  if (!sizeCheck.ok) {
    throw makeManageSkillError(sizeCheck.code, sizeCheck.reason, {
      limit: sizeCheck.limit,
      currentValue: sizeCheck.currentValue,
    });
  }

  // 5. 原子写（create / update 共用同一条 tmp → rename 路径）。
  //    **失败直接 throw，不做任何清理** —— 目标目录属于既有数据，
  //    其内容靠 rename 的原子替换天然保持操作前状态。
  await atomicWriteSkillFile(env, target.destFile, sizeCheck.text);

  return { name: skillName, filePath: target.destFile, description: safeDescription, action: 'update' };
}

/**
 * 删除 managed 技能（`manage_skill` 的 delete 动作，MGMT-01）
 *
 * **递归删整目录**（含 AI 经 bash 加的 `scripts/` / `references/`）—— 对齐 O11 对
 * Phase 50/51 卸载的同一口径。`env.remove` 的 `recursive` 默认是 **false**
 *（`nodejs.js` 的 `recursive ?? false`），**必须显式传 `{ recursive: true }`**，
 * 否则非空目录删不掉。
 *
 * 绝不动用户技能目录：seeded 与 user 来源在 `resolveManagedTarget` 里已被拒。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {{name: string, seededNames?: string[]|Set<string>}} params
 * @returns {Promise<{name: string, filePath: string, action: 'delete'}>}
 * @throws {Error} 校验 / 目标判定 / 删除失败（均带 `code`）
 */
async function deleteManagedSkill(env, { name, seededNames } = {}) {
  // 1. name 仍须合法（否则拼出的路径没有意义）
  const skillName = typeof name === 'string' ? name.trim() : name;
  const nameCheck = validateManagedSkillName(skillName);
  if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);

  // 2. 统一的目标判定（seeded 保护的三入口同形的第三入口）
  const target = await resolveManagedTarget(env, skillName, seededNames);
  if (!target.ok) throw makeManageSkillError(target.code, target.message);

  // 3. 递归删除（recursive 默认 false，必须显式传）
  const res = await env.remove(target.destDir, { recursive: true });
  if (!res || res.ok !== true) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNKNOWN,
      `删除技能 "${skillName}" 失败（沙箱码 ${sandboxErrorCode(res)}）`
    );
  }

  return { name: skillName, filePath: target.destFile, action: 'delete' };
}

/**
 * 卸载**用户**技能（Phase 50 D-07 / USER-06）—— 仅 `source === 'user'` 可删
 *
 * ## 判据方向与 `resolveManagedTarget` **相反**，因此**不得复用**它
 *
 * `resolveManagedTarget`（`:1593`）的顺序是 ① seeded 保护 → ② 同名 user 存在即拒
 * （`user_owned_conflict`）→ ③ managed 不存在即 `not_found` —— 那是 **managed 视角**
 * 的「用户撞名保护」。本函数需要的是**一处显式的「仅 user 可删」判据**；
 * 形状模板只借 `deleteManagedSkill()` 的四段结构
 * （校验 → 读盘判定 → `env.remove({recursive:true})` → 失败折叠 `UNKNOWN`）。
 *
 * ## 三态拒绝面（D-07，OQ-1 已由用户裁决 2026-09-14）
 *
 * | `skills/<name>` | `managed-skills/<name>` | 结果 |
 * |---|---|---|
 * | 存在且 `kind === 'directory'` | 任意（含同名双存在） | **允许卸载**，删除对象恒为 `skills/<name>/` |
 * | 不存在 / 存在但非目录（含 symlink）/ 读不到 | 存在 | `not_user_owned`（第十码） |
 * | 不存在 / 存在但非目录 / 读不到 | 不存在 | `not_found` |
 *
 * **同名双存在必须放行**：user 胜出、managed 被 `applyShadowing` 标 `shadowed` 保留在
 * 数据层，列表里显示的 tier 就是 `user`；按「后者存在即拒」会让用户点自己列表里那条
 * 「我的技能」被告知「这不是你的技能」，与 ROADMAP 判据 3 直接冲突。
 * `managed-skills/<name>` 的存在**只用来区分拒绝态**，**不作**拒绝条件。
 *
 * ## 判据一律**读盘**，且必须用 `env.fileInfo` 而不是 `env.exists`
 *
 * - **读盘而非缓存**：bash 可随时改写磁盘（P8 第 6 条），`_cache` 只反映上次重扫的时刻。
 *   用缓存会让「盘上已删、缓存还在」时去删一个不存在的目录（或反之放行一个已消失的目标）。
 * - **`fileInfo` 而非 `exists`**：SDK 的 `exists` 实现是「`fileInfo` 成功即 `ok(true)`」
 *   （`harness/env/nodejs.js`）⇒ 一个**普通文件** `skills/foo`（不是目录）也会让
 *   `exists` 返回 `true`，而 `env.remove(dir, {recursive:true})` 会删掉那个文件。
 *   D-07 的字面判据是「存在**且 `kind` 是目录**」⇒ 只有 `fileInfo` 能表达。
 *
 * ## 返回体**不带**提示字段
 *
 * 「同名内置 / 托管技能将在删除后重新可见」这句提示由 Phase 50-04 在**删除前的确认
 * 弹框**里从投影数据（`shadowed` / `shadowedBy`）渲染 —— 响应只回
 * `{name, filePath, action}`。**不新增没有消费者的字段**（无消费者的字段必然腐化成
 * 第二次实现）。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {{name: string}} params
 * @returns {Promise<{name: string, filePath: string, action: 'uninstall'}>}
 * @throws {Error} 校验 / 三态判定 / 删除失败（均带 `code`）
 */
async function deleteUserSkill(env, { name } = {}) {
  // 1. name 必须能安全地拼进删除路径（管理面安全超集谓词，OQ-2）
  //    不在这里 trim：谓词按**原值**寻址（见其 JSDoc 的归一化纪律 ①），
  //    预 trim 会把 `skills/" foo"` 的卸载请求改成删 `skills/foo`（另一个技能）。
  const nameCheck = validateSkillNameForManagement(name);
  if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);
  const skillName = nameCheck.value;

  // 2. 读盘判定（不复用 resolveManagedTarget；不用 _cache 快照）
  const workspace = getAgentWorkspaceLazy();
  const userDir = path.join(workspace.getSkillsDir(), skillName);
  const info = await env.fileInfo(userDir);
  const isDir = !!(info && info.ok === true && info.value && info.value.kind === 'directory');
  if (!isDir) {
    const managedDir = path.join(workspace.getManagedSkillsDir(), skillName);
    const managed = await env.exists(managedDir);
    const managedPresent = !!(managed && managed.ok === true && managed.value === true);
    if (managedPresent) {
      throw makeManageSkillError(
        MANAGE_SKILL_ERROR.NOT_USER_OWNED,
        `"${skillName}" 不是用户技能（只存在于 managed-skills 下），不能在此卸载：内置技能只可禁用，AI 创建的技能请让 AI 用 manage_skill 删除`
      );
    }
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.NOT_FOUND,
      `技能 "${skillName}" 不存在（只能卸载 skills 目录下的用户技能）`
    );
  }

  // 3. 递归删除（SDK 的 recursive 默认 false，必须显式传）
  const res = await env.remove(userDir, { recursive: true });
  if (!res || res.ok !== true) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNKNOWN,
      `卸载技能 "${skillName}" 失败（沙箱码 ${sandboxErrorCode(res)}）`
    );
  }

  return { name: skillName, filePath: path.join(userDir, 'SKILL.md'), action: 'uninstall' };
}

/**
 * 判定某技能是否进了 prompt 段（`details.promptIncluded`，48 D-12 的可见性精神）
 *
 * **三态**（不是 boolean）：
 * - 命中且可用 → `true`
 * - **命中**但因 `disabled` / `promptOmitted` / `shadowed` 而不进 prompt → `false`
 * - **该 name 不在当前技能集快照里 → `undefined`**
 *
 * **为什么必须区分后两者**：`false` 只表示「技能在技能集里、只是这次没进 prompt」，
 * `undefined` 才表示「此刻根本没有这个技能」。把两者混成 `false` 会让调用方
 * （`_buildManageSkillTool`）把「技能不存在」误报成「技能段预算已满」，并追加一句
 * 「仍可用 `/skill:{name}` 手动调用」—— 预算并未满、该技能也解析不到，双重失实
 *（VERIFICATION.md Gap 1 的失实文案根因）。消费方只在 `=== false` 时追加「预算已满」
 * 文案、只在 boolean 时写 `details.promptIncluded`。
 *
 * **不新写边际成本计算** —— 直接复用加载管线已在条目上算好的三字段
 * （`toUISkillEntry` 的 `shadowed` / `disabled` / `promptOmitted`），因此与 prompt
 * 段的实际归属**同源**。同步、零 IO：只读模块级缓存快照，**不触发重扫**。
 *
 * 诚实边界：该判定读的是**上一次重扫**的结果，不是「此刻已进提示词」的最终态 ——
 * 真正的 prompt 回写发生在本轮成功出口（D-13）。
 *
 * @param {string} name - 技能名
 * @param {string[]|Set<string>} [seededNames] - 随包内置技能名集合（当前判定不需要，保持签名稳定）
 * @returns {boolean|undefined} `true` / `false`（命中）/ `undefined`（未命中）
 */
function getSkillPromptIncluded(name, seededNames) {
  void seededNames;
  const entry = getSkillsSnapshot().skills.find((e) => e.skill.name === name);
  if (!entry) return undefined;
  return entry.shadowed !== true && entry.disabled !== true && entry.promptOmitted !== true;
}

/** 复位模块级缓存（仅测试用；跨用例污染会让「空技能集」断言假失败） */
function _resetCacheForTest() {
  _cache = EMPTY_CACHE();
}

/* ==================== 导入面（Phase 51） ==================== */

/**
 * 导入限额单源（51 D-11 / P7）—— 端点与设置页前端**零字面量**
 *
 * **为什么不并入 `LIMITS`**（本模块的唯一一条加项纪律）：
 * 1. `LIMITS` 的「只允许加项、不得改既有数值」是跨阶段冻结契约，本阶段对它是
 *    **零改动**；六类导入限额与原五项**不是同一个量纲**（前者是压缩包 / 解压面的
 *    资源上限，后者是技能集面的用户额度），混进去会让 Phase 50 的
 *    `getSkillsForManagement().limits` 投影凭空多出六个数（前端与产品文档的
 *    对照表随即漂移）。
 * 2. 六类限额**随 preview 响应的 `limits` 字段**回传（见 `buildImportLimitsProjection`），
 *    设置页不写任何数值。
 *
 * 逐条口径（升版须逐条复核）：
 * - `MAX_ENTRY_BYTES`：**单个 entry** 解压后的字节上限（默认 1 MiB）。
 *   与 `main.js` 的 `MAX_JSON_BODY_BYTES`（1 MiB）**同数不同量** —— 后者是 HTTP
 *   传输层闸，前者是解压层闸，两者尺度不同、不得互相替代。
 * - `MAX_TOTAL_BYTES`：**整包**解压后累计字节上限（32 MiB）。与 `main.js` 的
 *   `MAX_SKILL_PACKAGE_BYTES` **同值**，但方向必须写对（CR-5）：
 *   「**合法包**的解压总量 ≤ 32 MiB ⇒ 其**压缩后**体积必然 ≤ 32 MiB，故上传闸不会
 *   误杀合法包」。**反向不成立** —— 实测 101,923 B 的包声明解出 104,857,600 B
 *   ⇒ **上传闸对 zip 炸弹零贡献**，真正的两道独立闸是「压缩比闸」与「累计字节闸」。
 * - `MAX_ENTRIES`：entry 数上限（含目录条目）。
 * - `MAX_COMPRESSION_RATIO`：单 entry 的 `uncompressedSize / compressedSize` 上限。
 * - `MAX_NESTING_DEPTH`：嵌套深度上限，**按「定位到的技能根」相对计**（CR-4）。
 *   不按压缩包根计：实测 `anthropics/skills` 的 `docx` / `pptx` / `xlsx` 在包根口径下
 *   最深处斜杠数恰为 8（正好打满 P7 建议值），而相对技能根同批文件只有 5–6 层。
 *   取值对齐仓内先例 `SKILL_SIZE_WALK_MAX_DEPTH`（16）。该口径必须写进
 *   `docs/product/ai-skills.md` 的限额章节，否则用户看不懂「为什么一个 6 层目录的技能被拒」。
 * - `PREVIEW_LIST_LIMIT`：预览目录树 / 脚本清单的**默认展开条数**（超出折叠，
 *   但**必须显式给出总数** —— 禁静默截断）。
 * - `MAX_PENDING_IMPORTS` / `IMPORT_TTL_MS`：两阶段句柄的并发上限与存活时间
 *   （消费点在 Phase 51 的 `ai-manager` 侧）。
 */
const IMPORT_LIMITS = Object.freeze({
  MAX_ENTRY_BYTES: 1 * 1024 * 1024,
  MAX_TOTAL_BYTES: 32 * 1024 * 1024,
  MAX_ENTRIES: 2000,
  MAX_COMPRESSION_RATIO: 100,
  MAX_NESTING_DEPTH: 16,
  PREVIEW_LIST_LIMIT: 50,
  MAX_PENDING_IMPORTS: 3,
  IMPORT_TTL_MS: 10 * 60 * 1000,
});

/**
 * 导入临时区的两个目录名前缀 —— **只在这一处定义**（单源）
 *
 * ## 命名形状成对不变式（正命题，与 `sweepSeedResidue` 同款要求）
 *
 * 前缀常量与**清扫器的匹配判据**必须成对，否则「改了前缀忘了改正则」会静默留下垃圾：
 * - `[0]` `skill-import-` ⇒ `fs.mkdtempSync(path.join(getTmpDir(), 'skill-import-'))` 的
 *   **实际产物**是 `skill-import-<6 位随机>`（`fs.mkdtempSync` 的行为）；
 * - `[1]` `skill-replace-` ⇒ 覆盖事务的备份目录的实际产物是
 *   `skill-replace-<随机>`（见 `importUserSkill` 的覆盖分支）。
 *
 * `isImportResidueName()` 必须**正向**匹配这两个真实产物（有专门用例）。
 *
 * ⚠️ **不得**改走 `agent-workspace.createTempDir('skill-import')` —— 它会再加一层
 * `tmp-` 前缀（产物变成 `tmp-skill-import-<rand>`），与本判据不成对。
 */
const IMPORT_TMP_PREFIXES = Object.freeze(['skill-import-', 'skill-replace-']);

/** 覆盖备份目录的后缀（6 位 base36；目录在成功后即刻删除，只需避免同实例内碰撞） */
function importTmpSuffix() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/**
 * 该名字是否是**本管线的临时区残留**（`IMPORT_TMP_PREFIXES` 的任一前缀 + 非空剩余）
 *
 * ## 成对不变式（**正命题**，不得只写否命题）
 *
 * 本判据必须**正向匹配**两个前缀的**真实产物**：
 * - `fs.mkdtempSync(path.join(getTmpDir(), 'skill-import-'))` ⇒ `skill-import-<6 位随机>`；
 * - 覆盖事务的备份目录 ⇒ `skill-replace-<随机>`（`importUserSkill` 的覆盖分支）。
 *
 * 测试对**真实产物**（不是手工拼的字符串）断言 `true` —— 只写「不匹配非残留」的否命题
 * 发现不了「前缀改了但判据没跟着改」。
 *
 * ⚠️ 剩余部分必须非空：裸前缀不是 `mkdtempSync` 的产物，删它等于删到别人手工建的东西。
 *
 * @param {string} name - `.tmp/` 下的目录名（basename，不是全路径）
 * @returns {boolean}
 */
function isImportResidueName(name) {
  const s = String(name == null ? '' : name);
  return IMPORT_TMP_PREFIXES.some((p) => s.startsWith(p) && s.slice(p.length).length > 0);
}

/**
 * 导入面的错误码表（**独立命名空间**，CR-3）
 *
 * ## 为什么不并入 `MANAGE_SKILL_ERROR`
 *
 * 该表被 `tests/test-manage-skill.js` 锁死为**恰 11 键**（值集合逐字锁定，失败信息
 * 逐字写着「不得再新立第十二键」）⇒ 加码会让 49 / 50 的账本同时漂移。
 * 工具面（`manage_skill`）与管理 / 导入面是**两套命名空间**：导入码只经 HTTP
 * `{ code }` 返回（设置页按 code 查文案表，**不解析 message**）。
 *
 * ## 本表**一次定义 20 键**（后续计划只用不增）
 *
 * `51-04` 只补**一个**真实缺失的原因（`INVALID_NAME`，改名非法 ⇒ 最终 21 键）——
 * 避免「常量跨 wave 追加」造成的三处账本（常量 + `docs/product/ai-skills.md`
 * 错误码表 + `AGENTS.md` 测试清单）反复漂移。
 *
 * ⚠️ `INVALID_NAME` 与 `MANAGE_SKILL_ERROR.INVALID_NAME` **取值相同**
 * （`'invalid_name'`）但**分属两个命名空间** —— 导入路径抛的是**本表**的那个值，
 * 不得借用 `MANAGE_SKILL_ERROR` 的键（CR-3：两套码表的键集合必须互不污染）。
 *
 * `CONFLICT_UNRESOLVED` 不再只是中间态：`51-04` 之后它覆盖三类**显式不落盘**的拒绝 ——
 * 同名用户技能未给冲突选择 / 覆盖 managed 被拒 / 改名后的新名仍不可用。
 */
const IMPORT_SKILL_ERROR = Object.freeze({
  UNSUPPORTED_URL: 'unsupported_url',
  DOWNLOAD_FAILED: 'download_failed',
  REDIRECT_LIMIT: 'redirect_limit',
  NOT_A_ZIP: 'not_a_zip',
  INVALID_ZIP: 'invalid_zip',
  UNSUPPORTED_ZIP64: 'unsupported_zip64',
  UNDECODABLE_ENTRY: 'undecodable_entry',
  UNSAFE_ENTRY: 'unsafe_entry',
  LIMIT_EXCEEDED: 'limit_exceeded',
  SKILL_ROOT_COUNT: 'skill_root_count',
  FRONTMATTER_INVALID: 'frontmatter_invalid',
  OVERSIZE: 'oversize',
  INJECTION_DETECTED: 'injection_detected',
  SEEDED_CONFLICT: 'seeded_conflict',
  INVALID_NAME: 'invalid_name',
  IMPORT_EXPIRED: 'import_expired',
  IMPORT_NOT_FOUND: 'import_not_found',
  TOO_MANY_PENDING: 'too_many_pending',
  READBACK_FAILED: 'readback_failed',
  UNKNOWN: 'unknown',
  CONFLICT_UNRESOLVED: 'conflict_unresolved',
});

/**
 * 构造带机器可读原因码的导入错误 —— 导入面错误对象的**唯一构造点**
 *
 * 与 `makeManageSkillError` 同款（业务失败一律 `throw`），但**刻意不导出**：
 * 判定全在模块内，调用方只消费带 `code` 的错误对象（与 `makeManageSkillError` 同纪律）。
 *
 * 消息**不回显被拒内容原文**（49 纪律）：包内的 entry 名 / 正文一律不进 message，
 * 只进 `extra`（`extra` 不会被 HTTP handler 序列化回客户端）。
 *
 * @param {string} code - 原因码（取 `IMPORT_SKILL_ERROR` 之一）
 * @param {string} message - 中文可读原因
 * @param {object} [extra] - 附加结构化字段（limit / currentValue / entryName 等，**不回传客户端**）
 * @returns {Error} 带 code 的错误对象
 */
function makeImportError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  // D-10 的失败报告结构：`{ code, error, quota?, diagnostics[] }` —— 限额类失败必须同时带
  // **结构化**的 `quota`（限额名 + 限额值 + 当前值）。在本函数里由 `extra` 派生而不是逐个
  // throw 点手写，是为了让「限额文案含名与值」这条纪律只有**一个**实现处（漏一处就会
  // 产出「说了超限但没说超了多少」的失败）。
  if (extra && extra.limit !== undefined) {
    err.quota = {
      limit: extra.limit,
      limitValue: extra.limitValue,
      currentValue: extra.currentValue,
    };
  }
  return err;
}

/** 脚本清单的扩展名白名单（D-13 的判据之一；另一条是 POSIX 可执行位） */
const IMPORT_SCRIPT_EXTENSIONS = new Set([
  '.py', '.sh', '.bash', '.zsh', '.js', '.mjs', '.cjs', '.ts', '.rb', '.pl',
  '.php', '.ps1', '.bat', '.cmd', '.exe', '.dylib', '.so', '.node',
]);

/**
 * 校验一个 zip entry 名是否安全 —— **自建**判据（yauzl 的 `validateFileName` 实测六类漏网）
 *
 * yauzl 默认只拦三类（含 `\`、盘符 / 绝对路径、`split('/').includes('..')`），
 * 实测**放行**：NTFS ADS（`evil.txt:ads`）、控制字符（`evil\x01.txt`，UTF-8 flag 关时
 * 还会被 CP437 解码成 `evil☺.txt`）、NUL、尾随空格与点（`evil.` / `evil `）、空段
 *（`a//tmp/x.txt`）、RTL override（`x\u202ey/SKILL.md`）。
 *
 * ## 判据顺序**不可换**（顺序本身是判据）
 *
 * ① **先判原始字节面**：`[\x00-\x1F\x7F]`。CP437 会把 `\x01` 解码成 `☺`，
 *    只看解码值会漏。
 * ② 再判**解码后**含 `\`：默认 `strictFileNames:false` 时库已把 `\` 归一成 `/`，
 *    此处判的是漏网形态（未来若显式开 `strictFileNames` 即刻生效）。
 * ③ 取 `path.posix.normalize(decoded)` **之后**的形态判 `''` / `'.'` / `'..'` /
 *    `'../'` 前缀 / `'/'` 前缀。**不得**用字符串 `includes('..')` ——
 *    `a/../b` 是合法的包内相对路径，字符串判定会误杀；而 `a/b/../../../evil.txt`
 *    归一化后才是真正的逃逸形态。
 * ④ 盘符 `/^[A-Za-z]:/`、UNC `'//'` 前缀。
 * ⑤ NTFS ADS（含 `:`）。
 * ⑥ 每个路径段不得以空格或点**结尾**（Windows 会静默剥掉 ⇒ 落盘名与包内名不一致）。
 * ⑦ 不含空段（`//`）。
 * ⑧ 双向控制符（`\u202A-\u202E` / `\u2066-\u2069`）—— 会让显示名与实际名不一致。
 *
 * **空串 / 仅 `/` / 仅 `.`** 一律拒绝（SEC-03#empty），**不得静默跳过**。
 *
 * @param {Buffer} rawNameBuffer - entry 名的**原始字节**（`entry.fileNameRaw`）
 * @param {string} decodedName - yauzl 解码（并已把 `\` 归一成 `/`）后的名字
 * @returns {null | {code: string, detail: string, reason: string}} `null` = 安全
 */
function validateEntryName(rawNameBuffer, decodedName) {
  const reject = (detail, reason) => ({
    code: IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
    detail,
    reason,
  });

  // ① 原始字节面（必须先判：CP437 会把 \x01 解码成 ☺）
  const raw = Buffer.isBuffer(rawNameBuffer)
    ? rawNameBuffer.toString('latin1')
    : String(rawNameBuffer == null ? '' : rawNameBuffer);
  if (/[\x00-\x1F\x7F]/.test(raw)) {
    return reject('control_char_raw', '压缩包条目名含控制字符（原始字节面），已拒绝整包');
  }

  const name = String(decodedName == null ? '' : decodedName);

  // ② 解码后仍含反斜杠（库归一化后的漏网形态）
  if (name.includes('\\')) {
    return reject('backslash', '压缩包条目名含反斜杠，已拒绝整包');
  }

  // ③ 归一化后判逃逸族与空名
  const norm = path.posix.normalize(name);
  if (norm === '' || norm === '.' || name === '') {
    return reject('empty_name', '压缩包条目名为空或仅表示当前目录，已拒绝整包');
  }
  if (norm === '..' || norm.startsWith('../') || norm.startsWith('/')) {
    return reject('path_escape', '压缩包条目名试图逃出解压目录，已拒绝整包');
  }

  // ④ 盘符 / UNC
  if (/^[A-Za-z]:/.test(name)) {
    return reject('drive_letter', '压缩包条目名含盘符，已拒绝整包');
  }
  if (name.startsWith('//')) {
    return reject('unc', '压缩包条目名为 UNC 路径，已拒绝整包');
  }

  // ⑤ NTFS ADS
  if (name.includes(':')) {
    return reject('ntfs_ads', '压缩包条目名含 NTFS 数据流分隔符，已拒绝整包');
  }

  // ⑥ 段尾空格 / 点（Windows 会静默剥掉）—— `.` / `..` 是**路径归一化符**而非名字，
  //    它们在 ③ 已按归一化后的形态判过，此处必须豁免（否则 `a/../b` 这种合法形态被误杀）
  if (name.split('/').some((seg) => seg !== '.' && seg !== '..' && /[ .]$/.test(seg))) {
    return reject('trailing', '压缩包条目名的路径段以空格或点结尾，已拒绝整包');
  }

  // ⑦ 空段
  if (name.includes('//')) {
    return reject('empty_segment', '压缩包条目名含空路径段，已拒绝整包');
  }

  // ⑧ 双向控制符
  if (/[\u202A-\u202E\u2066-\u2069]/.test(name)) {
    return reject('bidi_control', '压缩包条目名含双向控制符，已拒绝整包');
  }

  return null;
}

/**
 * 归一化查重键（SEC-03#encoding）—— NFD + 小写
 *
 * 实测：`café`（NFC，U+00E9）与 `cafe\u0301`（NFD）在 NFD 归一化后**相等**，
 * 而二者在同一个 zip 里可共存且都能通过 yauzl 的校验 ⇒ 落盘时后写的静默覆盖先写的
 *（名字碰撞覆盖）。
 *
 * 判据对象是**归一化值**，不是原始字节或码点个数。
 *
 * @param {string} name - entry 名
 * @returns {string} 查重键
 */
function normalizedEntryKey(name) {
  return String(name == null ? '' : name).normalize('NFD').toLowerCase();
}

/** 首部 YAML frontmatter 块（读侧；与写侧的 `LEADING_FRONTMATTER_RE` 判据同一形状） */
const IMPORT_FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * 解析 SKILL.md 的 YAML frontmatter（导入面专用，D-14）
 *
 * ## 为什么必须自行解析（而不是等 SDK）
 *
 * 实测四种形态会让「落盘成功但整条被加载管线跳过」的**幽灵技能**成立：
 * - `description: Use this: for stuff` ⇒ `yaml` 抛 `Nested mappings are not allowed…`
 *   ⇒ SDK 记为 `parse_failed` 并**丢弃整条技能**；
 * - `description: has # hash` ⇒ **静默截断**成 `has`（不报错、不告警）；
 * - 缺 `description` ⇒ SDK 直接丢弃整条；
 * - 顶层是数组 / 标量（`parse('')` 返回 `null`）⇒ 取 `.name` 得 `undefined`。
 *
 * 因此本函数把解析失败当**硬错误**（调用方据此整包拒绝），而不是警告。
 *
 * ## 类型检查是硬要求
 *
 * `parse()` 的返回值可能是 `null`（空文本）、数组（顶层序列）、标量 ⇒ 必须显式判
 * 「非 null 对象且非数组」才继续。
 *
 * `allowed-tools` 归一化：字符串（逗号分隔）或数组 ⇒ 字符串数组；`null` / 缺失 ⇒ `null`。
 *
 * @param {string} text - SKILL.md 全文
 * @returns {{ok: true, name: string|null, description: string, allowedTools: string[]|null}
 *           | {ok: false, code: string, reason: string}}
 */
function parseSkillFrontmatter(text) {
  const raw = String(text == null ? '' : text);
  const m = IMPORT_FRONTMATTER_RE.exec(raw);
  if (!m) {
    return {
      ok: false,
      code: IMPORT_SKILL_ERROR.FRONTMATTER_INVALID,
      reason: '技能文件缺少 YAML frontmatter（文件必须以 --- 开头并以 --- 收尾）',
    };
  }

  let parsed;
  try {
    parsed = getYamlLazy().parse(m[1]);
  } catch (err) {
    // `YAMLParseError.message` 自带 line/column —— 直接作为可读原因（不回显被拒原文）
    return {
      ok: false,
      code: IMPORT_SKILL_ERROR.FRONTMATTER_INVALID,
      reason: `技能 frontmatter 解析失败：${err && err.message ? err.message : String(err)}`,
    };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      code: IMPORT_SKILL_ERROR.FRONTMATTER_INVALID,
      reason: '技能 frontmatter 必须是非空的键值映射（当前为空、数组或标量）',
    };
  }

  const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : null;

  const descRaw = parsed.description;
  const description = typeof descRaw === 'string' ? descRaw : null;
  if (description === null || description.trim() === '') {
    return {
      ok: false,
      code: IMPORT_SKILL_ERROR.FRONTMATTER_INVALID,
      reason: '技能 frontmatter 缺少可用的 description（加载管线会整条丢弃该技能）',
    };
  }

  let allowedTools = null;
  const at = parsed['allowed-tools'];
  if (typeof at === 'string') {
    allowedTools = at.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(at)) {
    allowedTools = at.map((s) => String(s)).filter(Boolean);
  }
  // `null` / 其它类型 ⇒ 视为缺失（不做猜测）

  return { ok: true, name, description, allowedTools };
}

/**
 * 由 frontmatter 与技能根相对路径推导**落盘目录名**
 *
 * 优先级：`frontmatter.name` → 技能根的目录 basename。
 * 两者都拿不到合法值 ⇒ 失败。
 *
 * **必须过 `validateManagedSkillName`（复用那一份，绝不写第二份正则）** ——
 * 这是「写入门严、读入门宽」不对称的写侧半边（D-06）；拒绝原因原样带出。
 *
 * 目录名**一律以本函数返回的 name 命名**（`skills/<name>/`），**绝不使用包内原始
 * 目录名拼路径**（P5 第 2 条：那又是一个注入点）。
 *
 * @param {{name: string|null}} frontmatter - `parseSkillFrontmatter` 的成功结果
 * @param {string} rootRel - 技能根相对包根的 posix 相对路径（'' 表示包根）
 * @returns {{ok: true, name: string} | {ok: false, code: string, reason: string}}
 */
function deriveImportName(frontmatter, rootRel) {
  const fromFm = frontmatter && typeof frontmatter.name === 'string' ? frontmatter.name.trim() : '';
  const fromDir = rootRel ? path.posix.basename(String(rootRel)) : '';
  const candidate = fromFm || fromDir;
  if (!candidate) {
    return {
      ok: false,
      code: IMPORT_SKILL_ERROR.FRONTMATTER_INVALID,
      reason: '无法确定技能名：frontmatter 未声明 name，且技能根目录名不可用',
    };
  }
  const check = validateManagedSkillName(candidate);
  if (!check.ok) return { ok: false, code: check.code, reason: check.reason };
  return { ok: true, name: candidate.trim() };
}

/** 目录存在且是目录（Node fs 版；`env.exists` 对普通文件也返回 true，不能用来判目录） */
function isExistingDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** 存在且是普通文件 */
function isExistingFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** 绝对路径 → 包根相对的 posix 路径 */
function toPosixRelative(base, target) {
  const rel = path.relative(base, target);
  return rel ? rel.split(path.sep).join('/') : '';
}

/**
 * 逐 entry 解压 + 校验（**导入面唯一的解压入口**，T-51-22）
 *
 * ## 实现硬约束（全部来自实测，改实现前必须重新实测）
 *
 * - **开流必须在 `for await` 循环体内**：`eachEntry()` 的 async iterator 在 `return()`
 *   （`break` / 循环自然结束）时执行 `cleanup()`，其中 `if (self.autoClose) self.close()`
 *   ⇒ 「先枚举收集数组、循环外再 `openReadStream`」**100% 得 `Error: closed`**。
 * - **`validateFileName` 不够**：六类实测漏网 ⇒ 自建 `validateEntryName`（含原始字节面）。
 * - **`uncompressedSize === 0xFFFFFFFF` 完全静默**（缺 zip64 extra field 时不报错）⇒
 *   显式判 `=== 0xFFFFFFFF` 即拒绝，否则 4 GiB 的荒谬值会参与压缩比运算。
 * - **`validateEntrySizes` 不能替代自建计数器**：stored 条目在枚举期报错，deflate 的
 *   在**流中**才报（实测已流过 16 KiB）。
 * - **写盘用 Node `fs`（不是沙箱 `env.writeFile`）**（D-04）：yauzl 给的是流；
 *   symlink 判定与「最近已存在祖先 realpath」复核都要在写**之前**自己控制；
 *   解压目标是 `mkdtemp` 出来的全新空目录（前缀内不可能有预埋链接）。
 *
 * @param {string} zipPath - 包文件绝对路径
 * @param {{destDir: string}} params - 解压目标（调用方保证已创建）
 * @returns {Promise<Array<{name: string, isDirectory: boolean, bytes?: number}>>} 接受的条目
 * @throws {Error} 任一条目不合格 ⇒ **拒绝整包**（code 取 `IMPORT_SKILL_ERROR`）
 */
async function readSkillPackageEntries(zipPath, { destDir } = {}) {
  const yauzl = getYauzlLazy();
  const zf = await yauzl.openPromise(zipPath);
  const entries = [];
  const seenKeys = new Map();
  let count = 0;
  let totalBytes = 0;

  try {
    for await (const entry of zf.eachEntry()) {
      // 闸 ① entry 数
      count += 1;
      if (count > IMPORT_LIMITS.MAX_ENTRIES) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
          `压缩包条目数超过上限：限额 ${IMPORT_LIMITS.MAX_ENTRIES} 个，当前 ${count} 个`,
          { limit: 'MAX_ENTRIES', limitValue: IMPORT_LIMITS.MAX_ENTRIES, currentValue: count }
        );
      }

      // 闸 ② entry 名（必须先判原始字节面）
      const rawName = Buffer.isBuffer(entry.fileNameRaw)
        ? entry.fileNameRaw
        : Buffer.from(String(entry.fileName), 'utf8');
      const nameCheck = validateEntryName(rawName, entry.fileName);
      if (nameCheck) {
        throw makeImportError(nameCheck.code, nameCheck.reason, {
          detail: nameCheck.detail,
          entryName: entry.fileName,
        });
      }

      // 闸 ③ 归一化查重（NFD + 小写）—— 同包内两个 entry 归一化后相等 ⇒ 拒绝整包
      const key = normalizedEntryKey(entry.fileName);
      if (seenKeys.has(key)) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          '压缩包内存在归一化后同名的条目（大小写或 Unicode 形式冲突），已拒绝整包',
          { detail: 'name_conflict', entryName: entry.fileName, conflictWith: seenKeys.get(key) }
        );
      }
      seenKeys.set(key, entry.fileName);

      // 闸 ④ symlink / 非普通文件（先看 versionMadeBy 高字节 === 3 再看 mode）
      const unixKind =
        entry.versionMadeBy >>> 8 === 3 ? (entry.externalFileAttributes >>> 16) & 0xf000 : 0;
      if (unixKind === 0xa000) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          '压缩包内含符号链接条目，已拒绝整包（不跳过该条目）',
          { detail: 'symlink_entry', entryName: entry.fileName }
        );
      }
      if (unixKind !== 0 && unixKind !== 0x8000 && unixKind !== 0x4000) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          '压缩包内含非普通文件条目（设备 / FIFO / socket），已拒绝整包',
          { detail: 'special_file', entryName: entry.fileName }
        );
      }

      // 闸 ⑤ zip64 声明特例（缺 extra field 时静默停在 0xFFFFFFFF）
      if (entry.uncompressedSize === 0xffffffff || entry.compressedSize === 0xffffffff) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSUPPORTED_ZIP64,
          '压缩包条目的尺寸声明为 ZIP64 占位值（0xFFFFFFFF）而无 ZIP64 扩展字段，已拒绝整包',
          { entryName: entry.fileName }
        );
      }

      // 闸 ⑥ 单 entry 字节闸（central-directory 声明值预检）
      if (entry.uncompressedSize > IMPORT_LIMITS.MAX_ENTRY_BYTES) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
          `压缩包单个条目超过上限：限额 ${IMPORT_LIMITS.MAX_ENTRY_BYTES} 字节，该条目声明 ${entry.uncompressedSize} 字节`,
          {
            limit: 'MAX_ENTRY_BYTES',
            limitValue: IMPORT_LIMITS.MAX_ENTRY_BYTES,
            currentValue: entry.uncompressedSize,
            entryName: entry.fileName,
          }
        );
      }

      // 闸 ⑦ 压缩比闸（**独立于累计字节闸**，CR-5：上传闸对炸弹零贡献）
      if (
        entry.uncompressedSize > 0 &&
        entry.compressedSize > 0 &&
        entry.uncompressedSize / entry.compressedSize > IMPORT_LIMITS.MAX_COMPRESSION_RATIO
      ) {
        const ratio = entry.uncompressedSize / entry.compressedSize;
        throw makeImportError(
          IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
          `压缩包条目压缩比超过上限：限额 ${IMPORT_LIMITS.MAX_COMPRESSION_RATIO}:1，该条目实测约 ${Math.round(ratio)}:1`,
          {
            limit: 'MAX_COMPRESSION_RATIO',
            limitValue: IMPORT_LIMITS.MAX_COMPRESSION_RATIO,
            currentValue: Math.round(ratio),
            entryName: entry.fileName,
          }
        );
      }

      // 闸 ⑧ 累计字节闸（声明值预检）
      if (totalBytes + entry.uncompressedSize > IMPORT_LIMITS.MAX_TOTAL_BYTES) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
          `压缩包解压总量超过上限：限额 ${IMPORT_LIMITS.MAX_TOTAL_BYTES} 字节，当前累计将达 ${totalBytes + entry.uncompressedSize} 字节`,
          {
            limit: 'MAX_TOTAL_BYTES',
            limitValue: IMPORT_LIMITS.MAX_TOTAL_BYTES,
            currentValue: totalBytes + entry.uncompressedSize,
          }
        );
      }
      totalBytes += entry.uncompressedSize;

      const isDirectory = entry.fileName.endsWith('/');
      if (isDirectory) {
        fs.mkdirSync(path.join(destDir, entry.fileName), { recursive: true });
        entries.push({ name: entry.fileName, isDirectory: true });
        continue;
      }

      // 闸 ⑨ 加密 / 不支持的压缩方法
      if (!entry.canDecodeFileData()) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNDECODABLE_ENTRY,
          '压缩包内含加密条目或使用不支持的压缩方法，已拒绝整包',
          { entryName: entry.fileName }
        );
      }

      const target = path.join(destDir, entry.fileName);
      // 纵深：词法路径必须仍在 destDir 内（`validateEntryName` 已保证，第二道）
      if (target !== destDir && !target.startsWith(destDir + path.sep)) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          '压缩包条目落点越出解压目录，已拒绝整包',
          { detail: 'lexical_escape', entryName: entry.fileName }
        );
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });

      // 闸 ⑩ 流内兜底：`validateEntrySizes` 对 deflate 条目是**流中**才报错
      //（实测已流过 16 KiB），不能替代自建计数器 ⇒ 边写边累加，超限即撕流。
      const rs = await zf.openReadStreamPromise(entry);
      let written = 0;
      try {
        await pipeline(
          rs,
          async function* (source) {
            for await (const chunk of source) {
              written += chunk.length;
              if (written > IMPORT_LIMITS.MAX_ENTRY_BYTES) {
                throw makeImportError(
                  IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
                  `压缩包单个条目超过上限：限额 ${IMPORT_LIMITS.MAX_ENTRY_BYTES} 字节（流内实测已超出，当前 ${written} 字节）`,
                  {
                    limit: 'MAX_ENTRY_BYTES',
                    limitValue: IMPORT_LIMITS.MAX_ENTRY_BYTES,
                    currentValue: written,
                    entryName: entry.fileName,
                  }
                );
              }
              yield chunk;
            }
          },
          fs.createWriteStream(target)
        );
      } catch (err) {
        if (err && err.code === IMPORT_SKILL_ERROR.LIMIT_EXCEEDED) {
          try {
            rs.destroy();
          } catch {
            /* 已结束 */
          }
        }
        // 半成品不得留下（解压失败即整包拒绝）
        try {
          fs.rmSync(target, { force: true });
        } catch {
          /* 未创建 */
        }
        throw err;
      }

      entries.push({ name: entry.fileName, isDirectory: false, bytes: written });
    }
  } finally {
    try {
      zf.close();
    } catch {
      /* 已关闭（eachEntry 的 autoClose / 异常路径） */
    }
  }

  return entries;
}

/**
 * 解析「包根」——剥离 GitHub zipball 的**恒定顶层前缀**
 *
 * 实测：GitHub zipball 恒包一层 `<repo>-<ref>/`；**不剥**会解出
 * `skills-main/skills/foo/SKILL.md`（幽灵技能来源之一），且 URL 显式子路径
 * （`scopeRel`）无处可落。
 *
 * ## 剥离判据（刻意保守：只剥「恰一个顶层目录」且必须有助于定位）
 *
 * - 顶层不是「恰一个目录」⇒ 不剥（多顶层目录一定是多技能包的形态，交给 `locateSkillRoot` 拒绝）。
 * - 给了 `scopeRel` ⇒ 只在「不剥时该子路径不存在、剥一层后存在」时剥（**唯一无歧义判据**）。
 * - 未给 `scopeRel` ⇒ 只在「包根自身没有 SKILL.md」时剥一层（多剥一层不影响
 *   `locateSkillRoot` 的全包扫描结果，但能让 `rootRel` 更短、预览更可读）。
 *
 * @param {string} pkgRoot - 解压目录（`<importDir>/pkg`）
 * @param {string|null} scopeRel - URL 显式子路径（本地上传为 null）
 * @returns {{root: string, prefixStripped: boolean}}
 */
function resolvePackageRoot(pkgRoot, scopeRel) {
  let tops = [];
  try {
    tops = fs.readdirSync(pkgRoot, { withFileTypes: true });
  } catch {
    return { root: pkgRoot, prefixStripped: false };
  }
  if (tops.length !== 1 || !tops[0].isDirectory()) return { root: pkgRoot, prefixStripped: false };
  const prefixed = path.join(pkgRoot, tops[0].name);

  if (scopeRel) {
    const direct = path.join(pkgRoot, scopeRel);
    const shifted = path.join(prefixed, scopeRel);
    if (!isExistingDir(direct) && isExistingDir(shifted)) {
      return { root: prefixed, prefixStripped: true };
    }
    return { root: pkgRoot, prefixStripped: false };
  }

  if (isExistingFile(path.join(pkgRoot, 'SKILL.md'))) {
    return { root: pkgRoot, prefixStripped: false };
  }
  return { root: prefixed, prefixStripped: true };
}

/**
 * 解压 + 全树校验（**三条来源共用的准备段**）
 *
 * ## 入参契约（先行定死，`51-05` 复用同一形状）
 *
 * **调用方**负责建 `importDir`（`fs.mkdtempSync(path.join(getTmpDir(), 'skill-import-'))`）
 * 并把包写到 `<importDir>/pkg.zip`；本函数只做 ① 解压到 `<importDir>/pkg/`、
 * ② 剥恒定顶层前缀、③ 调 `readSkillPackageEntries`、④ 返回 `{ importDir, pkgRoot, entries }`。
 *
 * **不得**用 `os.tmpdir()`、**不得**用 `path.join(__dirname, …)`、**不得**在本函数内再建
 * 一个临时根（临时根的创建只在调用方一处）—— 这是「只经访问器拿路径」的硬约束
 * （自己拼路径会落到沙箱之外，随即失去 `env.renameFile` 的双基准保护且可能 EXDEV）。
 *
 * ⚠️ 与之并列的 `prepareFromRawFile({ importDir, name, text })` 由 `51-05` 交付，
 * 它把单文件写进 `<importDir>/pkg/<name>/SKILL.md` 并返回**同一个 `pkgRoot` 形状**
 * ⇒ 两条准备路径之后的**全树校验 / 技能根定位 / 预览 / 落盘必须是同一段代码**。
 *
 * @param {object} env - 沙箱 ExecutionEnv（本段尚未用到，保持签名与落盘段一致）
 * @param {{importDir: string, scopeRel?: string|null}} params
 * @returns {Promise<{importDir: string, pkgRoot: string, entries: Array<object>, prefixStripped: boolean}>}
 * @throws {Error} 解压或任一条目校验失败（code 取 `IMPORT_SKILL_ERROR`）
 */
async function extractAndValidatePackage(env, { importDir, scopeRel = null } = {}) {
  void env;
  const zipPath = path.join(importDir, 'pkg.zip');
  const pkgRoot = path.join(importDir, 'pkg');
  // 目录必须先建（`fs.mkdirSync(..., { recursive: true })`）
  fs.mkdirSync(pkgRoot, { recursive: true });

  let entries;
  try {
    entries = await readSkillPackageEntries(zipPath, { destDir: pkgRoot });
  } catch (err) {
    // yauzl 的打开 / 枚举期失败折叠成显式码（不回显底层 message 之外的原文）
    if (err && err.code && Object.values(IMPORT_SKILL_ERROR).includes(err.code)) throw err;
    throw makeImportError(
      IMPORT_SKILL_ERROR.INVALID_ZIP,
      `压缩包无法解析（不是有效的 zip 或缺中央目录）：${err && err.message ? err.message : String(err)}`
    );
  }

  // D-17 第 2 层：解压完成后**递归 `lstat` 复核整棵树**（第二路 symlink 判据；
  // 断言点是「拒绝整包」而不是「跳过条目」）
  assertNoSymlinkTree(pkgRoot, importDir);

  const resolved = resolvePackageRoot(pkgRoot, scopeRel);
  return { importDir, pkgRoot: resolved.root, entries, prefixStripped: resolved.prefixStripped };
}

/**
 * 定位技能根（**同步、纯 fs 只读**）
 *
 * 优先级（命中 **0 个或 > 1 个** ⇒ 拒绝并给**可操作**提示）：
 * ① `scopeRel` 非空 ⇒ 限域到该子路径（地址里的路径必须真实存在）；
 * ② 限域目录下**直接**有 `SKILL.md` ⇒ 该目录为根；
 * ③ 否则**全包扫描**收集所有「任意深度」的 `SKILL.md`——**不得限定 `skills/`**
 *   （CR-7 实测：`anthropics/skills` 的 `template/SKILL.md` 位于**包根**，只扫 `skills/`
 *   会漏）；
 * ④ 命中数 ≠ 1 ⇒ `SKILL_ROOT_COUNT`，message 含**实测条目数**、一个**可直接复制**的
 *   `tree/<ref>/<path>` 示例，并在 `> 1` 时列出（最多 20 个）根路径。
 *
 * ⚠️ 多技能拒绝文案里必须给出 `tree/<ref>/<path>` 形态（CR-8）：`find-skills` 给出的
 * 候选**正是** GitHub 仓库 URL，用户必须自己补子路径；**处置走拒绝文案，不改内置技能
 * 正文** —— 改 `skills-builtin/**` 会连带触发 `THIRD_PARTY_NOTICES.md` 五要素同步与
 * 零安装语义扫描，成本远高于文案。
 *
 * @param {string} pkgRoot - 包根（已剥前缀）
 * @param {string|null} scopeRel - URL 显式子路径
 * @returns {{rootRel: string, skillRootAbs: string}}
 * @throws {Error} 0 个 / 多个技能根（code: `skill_root_count`）
 */
function locateSkillRoot(pkgRoot, scopeRel) {
  const base = scopeRel ? path.join(pkgRoot, scopeRel) : pkgRoot;
  if (!isExistingDir(base)) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.SKILL_ROOT_COUNT,
      `地址中的路径在包内不存在或不是目录：${scopeRel}。请确认该地址指向技能目录`
    );
  }

  const baseRel = scopeRel ? toPosixRelative(pkgRoot, base) : '';
  if (isExistingFile(path.join(base, 'SKILL.md'))) {
    return { rootRel: baseRel, skillRootAbs: base };
  }

  const hits = [];
  const walk = (dir, rel, depth) => {
    if (depth > SKILL_SIZE_WALK_MAX_DEPTH) return;
    let items = [];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of items) {
      if (it.isSymbolicLink()) continue; // 解压段已拒绝链接；此处只作纵深兜底
      const childRel = rel ? `${rel}/${it.name}` : it.name;
      if (it.isDirectory()) {
        walk(path.join(dir, it.name), childRel, depth + 1);
        continue;
      }
      if (it.name === 'SKILL.md') hits.push(childRel);
    }
  };
  walk(base, baseRel, 0);

  const roots = hits.map((h) => path.posix.dirname(h)).sort();
  const example = 'https://github.com/<owner>/<repo>/tree/<ref>/<path>';

  if (hits.length === 0) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.SKILL_ROOT_COUNT,
      `包内未找到 SKILL.md：技能根数量应为 1，实测 0。请确认该地址指向一个技能目录（例如 ${example}）`
    );
  }
  if (hits.length > 1) {
    const listed = roots.slice(0, 20).join('、');
    const more = roots.length > 20 ? ` 等共 ${roots.length} 个` : '';
    throw makeImportError(
      IMPORT_SKILL_ERROR.SKILL_ROOT_COUNT,
      `该地址包含 ${hits.length} 个技能，请改用指向具体技能目录的地址。例如：${example}` +
        `（实测技能根：${listed}${more}）`,
      { count: hits.length, roots: roots.slice(0, 20) }
    );
  }

  const rootRel = path.posix.dirname(hits[0]);
  return {
    rootRel: rootRel === '.' ? '' : rootRel,
    skillRootAbs: path.join(pkgRoot, rootRel === '.' ? '' : rootRel),
  };
}

/**
 * 解压后**递归 `lstat` 复核整棵树**（D-17 第 2 层 / T-51-12 的第二条独立判据）
 *
 * ## 为什么需要（第一路已判过 symlink）
 *
 * 第一路判据读的是 **central directory 的 external attributes** —— 它依赖造包者如实填写
 * 且依赖库的解析正确。第二路在**真实文件系统上**复核一遍，防「库的 attribute 解析漏网」。
 * 两路**互相不遮蔽**（把任一路注释掉，另一路的用例仍绿）。
 *
 * ## 与 `measureSkillDir` 的语义**相反**（不可混抄）
 *
 * `measureSkillDir` 对 symlink 是 **`continue`**（为统计而跳过）；本函数命中 symlink 即
 * **抛错、拒绝整包**（不是跳过该条目）—— 一个包里出现链接是强恶意信号。
 *
 * ## `realpathSync` 复核
 *
 * 每个子项 `realpathSync` 后必须仍在 `baselineRoot`（或其 realpath）内 —— 这是
 * 「解压产物整体不越界」的机械判据（配合 mkdtemp 空目录，双层）。
 *
 * @param {string} dir - 待复核的根（解压根）
 * @param {string} baselineRoot - 允许范围的根（`importDir`）
 * @throws {Error} 命中 symlink 或 realpath 越界（code: `unsafe_entry`）
 */
function assertNoSymlinkTree(dir, baselineRoot) {
  const baselines = [baselineRoot];
  try {
    baselines.push(fs.realpathSync(baselineRoot));
  } catch {
    /* 单基准退化 */
  }
  const inside = (abs) =>
    baselines.some((b) => abs === b || abs.startsWith(b.endsWith(path.sep) ? b : b + path.sep));

  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let items = [];
    try {
      items = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const it of items) {
      const child = path.join(cur, it.name);
      let ls = null;
      try {
        ls = fs.lstatSync(child);
      } catch (err) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          `解压产物复核失败：无法读取条目状态（${err && err.code ? err.code : 'unknown'}）`,
          { detail: 'lstat_failed' }
        );
      }
      if (ls.isSymbolicLink()) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          '解压产物含符号链接，已拒绝整包（第二路：解压后递归 lstat）',
          { detail: 'symlink_lstat' }
        );
      }
      let real = null;
      try {
        real = fs.realpathSync(child);
      } catch (err) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          `解压产物复核失败：无法解析真实路径（${err && err.code ? err.code : 'unknown'}）`,
          { detail: 'realpath_failed' }
        );
      }
      if (!inside(real)) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
          '解压产物越出解压目录，已拒绝整包（第二路：realpath 复核）',
          { detail: 'realpath_escape' }
        );
      }
      if (ls.isDirectory()) stack.push(child);
    }
  }
}

/** 自内向外找**最近已存在的祖先**（不存在的一律上溯；找不到返回 `null`） */
function nearestExistingAncestor(p) {
  let cur = p;
  for (let i = 0; i < 128; i += 1) {
    if (fs.existsSync(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
  return null;
}

/**
 * **落点复核**（D-17 第 3 层 / SEC-05 / T-51-12 的第三道）—— 与 51-01 并列的独立判据
 *
 * 对**父目录链上最近的已存在祖先**做 `realpathSync`，结果必须仍在 AI 工作区根的
 * **双基准**（`getWorkspaceDir()` 与其 realpath）内。中间目录是符号链接时，词法路径
 * 看着在工作区内、实际会跟随链接写出去 —— 本函数就是拦这一类。
 *
 * ## 为什么是本模块自己实现（不复用 `agent-workspace.resolveInsideForWrite`）
 *
 * `env.renameFile` 已由 51-01 的写面判据保护；本函数是**显式的第二道**：使
 * 「51-01 被回退」时本阶段仍有一条**独立**判据（两条判据的实现不共享代码路径）。
 *
 * ## 与 `resolveInsideForWrite` 的一处刻意差异
 *
 * 基准取**工作区根**而非 `skills/` 目录：若 `skills/` 本身被换成指向工作区外的符号链接，
 * 以 `skills/` 为基准会把它自己的 realpath 当作合法基准而放行 —— 那正是要拦的形态。
 *
 * @param {string} target - 待校验的落点（文件或目录的绝对路径，可不存在）
 * @throws {Error} 基准缺失 / 解析失败 / 祖先解析到工作区外（code: `unsafe_entry`）
 */
function assertLandingInsideWriteRoot(target) {
  const workspaceRoot = getAgentWorkspaceLazy().getWorkspaceDir();
  const baselines = [workspaceRoot];
  try {
    baselines.push(fs.realpathSync(workspaceRoot));
  } catch {
    /* 单基准退化（工作区根不存在时下游 IO 自会失败） */
  }
  const ancestor = nearestExistingAncestor(path.dirname(target));
  if (!ancestor) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
      '落点复核失败：父目录链上找不到已存在的祖先目录',
      { detail: 'landing_no_ancestor' }
    );
  }
  let real = null;
  try {
    real = fs.realpathSync(ancestor);
  } catch (err) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
      `落点复核失败：无法解析父目录真实路径（${err && err.code ? err.code : 'unknown'}）`,
      { detail: 'landing_realpath_failed' }
    );
  }
  const ok = baselines.some(
    (b) => real === b || real.startsWith(b.endsWith(path.sep) ? b : b + path.sep)
  );
  if (!ok) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.UNSAFE_ENTRY,
      '落点复核失败：父目录链上最近的已存在祖先解析到 AI 工作区之外（中间目录可能是符号链接），已拒绝落盘',
      { detail: 'landing_escape' }
    );
  }
}

/** 单条 entry 是否算「脚本」（扩展名白名单 **或** POSIX 可执行位，D-13） */function isScriptEntry(name, absPath) {
  if (IMPORT_SCRIPT_EXTENSIONS.has(path.extname(String(name || '')).toLowerCase())) return true;
  try {
    return (fs.lstatSync(absPath).mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

/**
 * 预览统计（**一次遍历**产出目录树 / 计数 / 字节 / 深度 / 脚本清单）
 *
 * ## 三条口径
 *
 * - **同一父节点下目录在前**，同级按路径字符串的 **UTF-16 码元序**（JS `<` / `>`）。
 *   **不用 `localeCompare`** —— 它随机器 locale 变，会破坏预览可复现性。
 * - `bytes` **只累加 `kind === 'file'`**（目录的 `size` 是 inode 数据，不得累加）。
 * - `depth` **按技能根相对计**（CR-4）：root 下的直接文件 = 1 层。
 *
 * ## 两道护栏（禁静默截断）
 *
 * - **嵌套深度**：超过 `IMPORT_LIMITS.MAX_NESTING_DEPTH` ⇒ **硬拒绝**
 *   （`LIMIT_EXCEEDED`，message 含「嵌套深度」、当前深度与限额）。这是 T-51-13 的
 *   深度闸，判据锚在**技能根相对**这个唯一正确口径上。
 * - **条目数**：超过 `SKILL_SIZE_WALK_MAX_ENTRIES` ⇒ 停止遍历并带 `truncated: true`
 *   （读盘阶段已按 `MAX_ENTRIES` 更早拒绝，这里是纵深兜底；**不得**静默截断）。
 *
 * @param {object} env - 沙箱 ExecutionEnv（本函数用 Node `fs` 直读解压产物，参数保持签名一致）
 * @param {string} pkgRoot - 包根
 * @param {string} rootRel - 技能根相对包根
 * @returns {Promise<{tree: Array<{path: string, kind: string}>, fileCount: number, dirCount: number,
 *                    bytes: number, maxFileBytes: number, depth: number, scripts: string[],
 *                    truncated: boolean}>}
 */
async function collectPreviewStats(env, pkgRoot, rootRel) {
  void env;
  const rootAbs = rootRel ? path.join(pkgRoot, rootRel) : pkgRoot;
  const tree = [];
  const scripts = [];
  let fileCount = 0;
  let dirCount = 0;
  let bytes = 0;
  let maxFileBytes = 0;
  let depth = 0;
  let truncated = false;
  let seen = 0;

  const walk = (dir, rel, level) => {
    if (truncated) return;
    let items = [];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    items.sort((a, b) => {
      const ad = a.isDirectory() ? 0 : 1;
      const bd = b.isDirectory() ? 0 : 1;
      if (ad !== bd) return ad - bd;
      // UTF-16 码元序（< > 运算符），**不用 localeCompare**
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    for (const it of items) {
      if (truncated) return;
      seen += 1;
      if (seen > SKILL_SIZE_WALK_MAX_ENTRIES) {
        truncated = true;
        return;
      }
      const childRel = rel ? `${rel}/${it.name}` : it.name;
      if (it.isSymbolicLink()) continue; // 统计跳过（与 measureSkillDir 同款；拒绝判据在解压段）
      if (it.isDirectory()) {
        const childDepth = level + 1;
        if (childDepth > IMPORT_LIMITS.MAX_NESTING_DEPTH) {
          throw makeImportError(
            IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
            `技能目录嵌套深度超过上限：限额 ${IMPORT_LIMITS.MAX_NESTING_DEPTH} 层（按技能根相对计），当前 ${childDepth} 层`,
            {
              limit: 'MAX_NESTING_DEPTH',
              limitValue: IMPORT_LIMITS.MAX_NESTING_DEPTH,
              currentValue: childDepth,
            }
          );
        }
        dirCount += 1;
        tree.push({ path: childRel, kind: 'directory' });
        walk(path.join(dir, it.name), childRel, childDepth);
        continue;
      }
      const segs = childRel.split('/').length;
      if (segs > IMPORT_LIMITS.MAX_NESTING_DEPTH) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
          `技能目录嵌套深度超过上限：限额 ${IMPORT_LIMITS.MAX_NESTING_DEPTH} 层（按技能根相对计），当前 ${segs} 层`,
          {
            limit: 'MAX_NESTING_DEPTH',
            limitValue: IMPORT_LIMITS.MAX_NESTING_DEPTH,
            currentValue: segs,
          }
        );
      }
      if (segs > depth) depth = segs;
      const abs = path.join(dir, it.name);
      let size = 0;
      try {
        size = fs.lstatSync(abs).size;
      } catch {
        size = 0;
      }
      fileCount += 1;
      bytes += size;
      if (size > maxFileBytes) maxFileBytes = size;
      if (isScriptEntry(it.name, abs)) scripts.push(childRel);
      tree.push({ path: childRel, kind: 'file' });
    }
  };

  walk(rootAbs, '', 0);
  scripts.sort();

  return { tree, fileCount, dirCount, bytes, maxFileBytes, depth, scripts, truncated };
}

/**
 * 导入限额的 camelCase 数值投影（`preview.limits`，**前端零字面量的唯一来源**）
 *
 * 合并 `IMPORT_LIMITS`（八项）与 `LIMITS` 的两项（`SKILL.md` 字节闸 / 用户技能数量闸）——
 * 这两项是**导入面真实会拒绝**的既有闸口，设置页需要展示对照值，但**不得**自己写数值。
 *
 * @returns {object} camelCase 数值表
 */
function buildImportLimitsProjection() {
  return {
    maxEntryBytes: IMPORT_LIMITS.MAX_ENTRY_BYTES,
    maxTotalBytes: IMPORT_LIMITS.MAX_TOTAL_BYTES,
    maxEntries: IMPORT_LIMITS.MAX_ENTRIES,
    maxCompressionRatio: IMPORT_LIMITS.MAX_COMPRESSION_RATIO,
    maxNestingDepth: IMPORT_LIMITS.MAX_NESTING_DEPTH,
    previewListLimit: IMPORT_LIMITS.PREVIEW_LIST_LIMIT,
    maxPendingImports: IMPORT_LIMITS.MAX_PENDING_IMPORTS,
    importTtlMs: IMPORT_LIMITS.IMPORT_TTL_MS,
    maxSkillMdBytes: LIMITS.MAX_SKILL_MD_BYTES,
    maxUserSkills: LIMITS.MAX_USER_SKILLS,
  };
}

/** 沙箱上判「存在且是目录」（`env.exists` 对普通文件也返回 true，不能用来判目录） */
async function envDirExists(env, p) {
  const info = await env.fileInfo(p);
  return !!(info && info.ok === true && info.value && info.value.kind === 'directory');
}

/** user 来源技能数（`MAX_USER_SKILLS` 的统计对象；读盘统计，失败按 0 计） */
async function countUserSkills(env, skillsDir) {
  const entries = await env.listDir(skillsDir);
  if (!entries || entries.ok !== true || !Array.isArray(entries.value)) return 0;
  return entries.value.filter((entry) => entry && entry.kind === 'directory').length;
}

/**
 * 技能域威胁模式表（Phase 51 SEC-06 / D-12）—— **启发式，不是安全边界**
 *
 * ## 效力分级（与 `INJECTION_PATTERNS` / `CREDENTIAL_PATTERNS` **分表**）
 *
 * 本表的命中**不拒绝**任何东西：它在导入预览里**高亮**，并由用户在确认区**必勾**
 * 「我已了解以上风险」。理由（D-12 / P3 明文）：这三类模式的性质是**启发式、降低概率**，
 * 而**合法技能必然命中** —— 一个「部署 / CI / 数据同步」类技能会合理地在正文里写
 * `curl`、写 `.env`、写「无需再次询问」（幂等脚本说明）。硬拒会让用户**失去功能且无法
 * 绕过**；真正的安全边界是 P3 原文列的「**导入预览确认 + 沙箱**」。
 *
 * 因此：
 * - **不得**把本表塞进 `ai-memory-manager.js` 的 hard-fail 表（那是**拒绝**语义）；
 * - **不得**在任何文案 / 文档 / 测试命名里把「未命中」呈现成「这个技能是安全的」背书；
 * - **不得**接入加载期（对已在盘上的技能扫描后丢弃）—— 那会推翻 46 D-08，并让**已导入
 *   的合法技能在某次升级后消失**（49 D-05 已付过这条论证）。扫描只在**导入**与 49 的
 *   **写入侧**生效。
 *
 * ## 扩表的连带效果（契约兑现，**不是**越界）
 *
 * 49 D-08 明文「49 把扫描点接成单点，51 只需**扩表**、不加接线」⇒ 本表落
 * `ai-skills-manager.js` 后，**49 的 `manage_skill` 写入路径自动获得技能域模式**。
 * 这是交接契约的兑现，须写进 `docs/product/ai-skills.md` 与 `AGENTS.md`（`51-07` 负责）。
 *
 * ## 逐条形态来自 `51-RESEARCH.md` 实测 7 的 PASS 清单（263 篇真实合法语料零误伤校准）
 *
 * ⚠️ **两处必须逐字保留的形态**（改成直觉写法会实测不命中或误伤）：
 * - `A5` 必须写 `>[&]?`（写成 `>\s*` 对该正样本实测不命中）；
 * - `C2` 必须用**前置否定词前瞻** `(?![^\n]{0,40}(…))`，**lookbehind `(?<!…)` 实测无效**
 *  （否定词与命中点之间隔着「建议」两字，lookbehind 只能看固定距离）。
 *
 * ⚠️ **A3 不是零误伤**：`scp` / `rsync` 到远端会命中**合法部署技能**（实测
 * `rsync -az dist/ deploy@staging:/srv/app/`）。因 D-12 的效力是「高亮而非拒绝」故仍然收，
 * 但**必须在产品文档点名它**。测试侧用「已知误伤清单 + 该清单必须真命中」两条判据把它钉住。
 */
const SKILL_THREAT_PATTERNS = Object.freeze([
  // ---------- A 类 · 文件外发（exfil） ----------
  {
    id: 'A1',
    class: 'exfil',
    name: '把本地文件内容随 HTTP 请求外发（`--data @file` 族）',
    pattern: /curl[^\n]{0,200}(--data-binary\s+@|--data\s+@|-d\s+@|-F\s+[^\s=]+=@)/i,
  },
  {
    id: 'A3',
    class: 'exfil',
    name: '`scp` / `rsync` 把内容推到远端主机（⚠️ 已知误伤：合法部署技能）',
    pattern: /\b(scp|rsync)\b[^\n]{0,120}[^\s@]+@[^\s:]+:/i,
  },
  {
    id: 'A4',
    class: 'exfil',
    name: 'base64 编码后经网络送出（base64 → curl/nc 或 /dev/tcp）',
    pattern: /base64[^\n]{0,200}(\|\s*(curl|nc|ncat|netcat)|>\s*\/dev\/tcp\/)/i,
  },
  {
    id: 'A5',
    class: 'exfil',
    name: '反弹 shell：重定向到 /dev/tcp 或 /dev/udp',
    // ⚠️ 必须写 `>[&]?`（写成 `>\s*` 对该正样本实测不命中）
    pattern: />[&]?\s*\/dev\/(tcp|udp)\//i,
  },
  {
    id: 'A6',
    class: 'exfil',
    name: '用 nc / ncat / netcat 连出（主机 + 端口形态）',
    pattern: /\b(nc|ncat|netcat)\b\s+(-\w+\s+)*[\w.-]+\s+\d{2,5}\b/i,
  },
  {
    id: 'A7',
    class: 'exfil',
    name: '指向公开投递 / 回传服务（webhook.site / transfer.sh / pastebin 等）',
    pattern:
      /(webhook\.site|transfer\.sh|0x0\.st|pastebin\.com|discord\.com\/api\/webhooks|api\.telegram\.org|pipedream\.net|requestbin)/i,
  },
  {
    id: 'A8',
    class: 'exfil',
    name: '把环境变量整批经管道送出（printenv/env → curl/nc）',
    pattern: /\b(printenv|env)\b[^\n]{0,80}\|\s*(curl|nc|ncat)\b/i,
  },
  {
    id: 'A9',
    class: 'exfil',
    name: '以 multipart 表单上传文件（`files={` / `files=[`）',
    pattern: /\bfiles\s*=\s*[\{\[]/i,
  },
  {
    id: 'A10',
    class: 'exfil',
    name: 'curl 直接上传文件（`--upload-file`）',
    pattern: /--upload-file\b/i,
  },
  {
    id: 'A12',
    class: 'exfil',
    name: '打包敏感目录后经管道外发（tar ~/.ssh / .aws / .gnupg / .netrc → |）',
    pattern: /\btar\b[^\n]{0,120}(\.ssh|\.aws|\.gnupg|\.netrc)[^\n]{0,120}\|/i,
  },

  // ---------- B 类 · 凭据与敏感路径读取回显（credential） ----------
  {
    id: 'B1',
    class: 'credential',
    name: '读取 SSH 私钥（~/.ssh/id_*）',
    pattern: /(^|[^\w/])(~|\$HOME|\/Users\/[\w.-]+|\/home\/[\w.-]+)\/\.ssh\/id_[a-z0-9]+/i,
  },
  {
    id: 'B2',
    class: 'credential',
    name: '读取云 / 工具凭据文件（~/.aws/credentials、~/.netrc、~/.docker/config.json）',
    pattern:
      /(^|[^\w/])(~|\$HOME|\/Users\/[\w.-]+|\/home\/[\w.-]+)\/(\.aws\/credentials|\.netrc|\.docker\/config\.json)/i,
  },
  {
    id: 'B3',
    class: 'credential',
    name: '从 macOS 钥匙串导出密码（security find-generic-password / find-internet-password）',
    pattern: /\bsecurity\s+(find-generic-password|find-internet-password)\b/i,
  },
  {
    id: 'B4',
    class: 'credential',
    name: '读取系统账号文件（/etc/passwd、/etc/shadow、/etc/sudoers）',
    pattern: /(^|[^\w])\/etc\/(passwd|shadow|sudoers)(\b|$)/,
  },
  {
    id: 'B5',
    class: 'credential',
    name: '读取 shell 历史（~/.bash_history / ~/.zsh_history / ~/.python_history）',
    pattern: /(^|[^\w/])(~|\$HOME|\/Users\/[\w.-]+)\/\.(bash|zsh|python)_history\b/i,
  },
  {
    id: 'B6',
    class: 'credential',
    name: '`.env` 与网络动作同现（**双向**：两种语序都要抓）',
    // ⚠️ 必须双向（单向版对 `curl … -d @$HOME/.env` 实测不命中）
    pattern:
      /(\.env\b[^\n]{0,160}(curl|fetch|requests\.post|上传|发送))|((curl|fetch|requests\.post|上传|发送)[^\n]{0,160}\.env\b)/i,
  },
  {
    id: 'B7',
    class: 'credential',
    name: '回显敏感环境变量（echo $*SECRET* / TOKEN / KEY / PASSWORD / CREDENTIAL）',
    // ⚠️ 必须要求 `$` 前缀（宽松形态会命中 `echo "$response" | jq -r '.usage.input_tokens'`）
    // ⚠️ 引号写成 \u 转义而非字面量：避免干扰「先剥注释再判」的负向 token 判据
    pattern: /\becho\s+[\u0022\u0027]?\$[A-Z_]*(SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL)/i,
  },
  {
    id: 'B8',
    class: 'credential',
    name: 'printenv 定向读取敏感变量（**必须用 printenv**，裸 env 实测误伤 6 处）',
    pattern:
      /\bprintenv\b[^\n]{0,60}\b[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|CREDENTIAL|API_KEY)|(^|\n)\s*printenv\s*(\||$)/im,
  },
  {
    id: 'B9',
    class: 'credential',
    name: '读取包管理器 / Git 凭据文件（~/.npmrc、~/.pypirc、~/.git-credentials）',
    pattern: /(^|[^\w/])(~|\$HOME|\/Users\/[\w.-]+)\/(\.npmrc|\.pypirc|\.git-credentials)\b/i,
  },

  // ---------- C 类 · 诱导跳过确认（confirm_bypass） ----------
  {
    id: 'C1',
    class: 'confirm_bypass',
    name: '声称「无需 / 不必再次确认」',
    pattern: /(无需|不需|不用|不必)[^\n]{0,8}(再次|重复|二次)?[^\n]{0,8}(确认|询问|批准|授权)/,
  },
  {
    id: 'C2',
    class: 'confirm_bypass',
    name: '「绕过 / 跳过 / 忽略确认」——**带否定语境豁免**',
    /*
     * ⚠️ 两处形态不可换：
     * ① 用**前置否定词前瞻**而不是 lookbehind —— lookbehind `(?<![^\n]…)` 只能看固定距离，
     *    而否定词与命中点之间隔着「建议」两字 ⇒ 实测仍命中，会把「本技能**不会建议**
     *    绕过任何确认提示」抓走。（本行是**被剥注释后判定**的负向 token 的唯一合法落点：
     *    `tests/test-ai-skills.js` 与计划门禁都先剥注释再判，注释里写明该形态是预期行为。）
     * ② 带 `m` 标志：`^` 逐行生效，否则整篇正文里只有第一行可命中，判据形同虚设
     *   （研究实测的样本都是单行输入，故其清单未标 `m`；本实现按「逐行判定」的同一语义落）。
     */
    pattern:
      /^(?![^\n]{0,40}(不会|不得|禁止|不要|不建议|绝不|不能))[^\n]{0,40}(绕过|跳过|忽略)[^\n]{0,8}(确认|审批|授权|权限检查)/m,
  },
  {
    id: 'C3',
    class: 'confirm_bypass',
    name: '「不要询问用户 / 我」',
    pattern: /(不要|无需|不必)[^\n]{0,6}(询问|问)[^\n]{0,6}(用户|我|使用者)/,
  },
  {
    id: 'C4',
    class: 'confirm_bypass',
    name: '「直接执行 / 自动执行」+「无需确认」',
    pattern: /(自动执行|直接执行|直接运行|直接安装)[^\n]{0,12}(无需|不需|不用|不要)[^\n]{0,6}(确认|询问)/,
  },
  {
    id: 'C5',
    class: 'confirm_bypass',
    name: '英文：no / without further confirmation needed',
    pattern:
      /(no|without)\s+(further\s+|additional\s+|extra\s+)?(confirmation|approval)\s+(is\s+)?(needed|required)/i,
  },
  {
    id: 'C6',
    class: 'confirm_bypass',
    name: '英文：bypass the confirmation / approval / safety check',
    pattern: /\bbypass\b[^\n]{0,20}\b(confirmation|approval|safety)\s*(check|prompt|card)?\b/i,
  },
  {
    id: 'C7',
    class: 'confirm_bypass',
    name: '英文：skip the confirmation card / prompt / step',
    pattern: /\bskip\s+(the\s+)?(confirmation|approval|permission)\s*(card|prompt|step)\b/i,
  },
  {
    id: 'C8',
    class: 'confirm_bypass',
    name: '英文：do not ask the user for confirmation / approval / permission',
    pattern: /\bdo\s+not\s+(ask|prompt)\s+(the\s+)?user\s+(for|to)\s+(confirmation|approval|permission)\b/i,
  },
]);

/**
 * 扫描技能域威胁模式（D-12 / SEC-06）—— **并列于** `scanSkillText`，返回命中列表而**不** throw
 *
 * 与 `scanSkillText` 的语义**刻意相反**：后者命中即 `throw`（hard-fail 表：注入 / 凭据），
 * 本函数只**报告**（技能域三类：高亮 + 必勾）。两条函数并列存在，不得合并。
 *
 * 无 `g` 标志 ⇒ `pattern.test` 无 `lastIndex` 状态，可安全复用同一份表。
 *
 * @param {string} text - 待扫描文本（description 原文 / SKILL.md 正文原文）
 * @param {string} field - 命中来源字段（`'description'` / `'body'` —— 使「双扫」可判）
 * @returns {Array<{id: string, class: string, name: string, field: string}>} 命中列表（可能为空）
 */
function scanSkillThreats(text, field) {
  const s = String(text == null ? '' : text);
  if (!s) return [];
  const hits = [];
  for (const entry of SKILL_THREAT_PATTERNS) {
    if (entry.pattern.test(s)) {
      hits.push({ id: entry.id, class: entry.class, name: entry.name, field: field || '' });
    }
  }
  return hits;
}

/**
 * 注入 / 凭据类**硬拒**判据（49 D-08 的分字段口径，导入侧的承接）
 *
 * - `description` → `{ includeCredentials: true }`（无条件进**每个请求**的 system prompt）
 * - `body` → `{ includeCredentials: false }`（不进 prompt，且技能文档合法地会写配置示例）
 *
 * 命中 ⇒ **整包拒绝**（`injection_detected`）。**不得**把技能域三类接进本条路径。
 *
 * @param {string} text - 待扫描文本
 * @param {{includeCredentials: boolean}} options - 字段分离开关
 * @throws {Error} 命中任何模式（code: `injection_detected`）
 */
function assertNoInjection(text, { includeCredentials }) {
  const result = getAiMemoryManagerLazy().scanInjectionPatterns(text, { includeCredentials });
  if (result && result.safe === true) return;
  throw makeImportError(
    IMPORT_SKILL_ERROR.INJECTION_DETECTED,
    `技能内容被拒绝：${(result && result.reason) || '命中安全扫描'}。请调整措辞后重试`
  );
}

/**
 * 组装导入预览（D-13 的六字段骨架）
 *
 * `description` 是**原文**（不净化、不截断语义）：`sanitizeSkillDescription` 只作用于
 * **落盘时写进 frontmatter** 的值 —— 预览的意义正是让用户判断净化是否误伤。
 *
 * `scan.injection` 恒为 `{ hit: false }`：注入类命中在**更早的阶段**就整包拒绝了
 * （`51-05` 接的硬拒判据），到了这里不可能是 `true`。
 *
 * `conflict` 携带 `resolveImportConflict` 的**三档判定结果**
 * （`none` / `user` / `managed`；seeded 档在本函数内**直接失败**，不进预览）——
 * 前端据此渲染「三选一：覆盖 / 改名 / 取消」或「不许覆盖 + 永久遮蔽提示」。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {{pkgRoot: string, rootRel: string, origin?: string, seededNames?: string[]|Set<string>}} params
 * @returns {Promise<object>} 预览对象
 * @throws {Error} frontmatter / 技能名 / 深度 / 统计失败 / seeded 同名（`seeded_conflict`）
 */
async function buildImportPreview(env, { pkgRoot, rootRel, origin = 'zip', seededNames } = {}) {
  const skillRootAbs = rootRel ? path.join(pkgRoot, rootRel) : pkgRoot;
  const skillMdPath = path.join(skillRootAbs, 'SKILL.md');

  let text;
  try {
    text = fs.readFileSync(skillMdPath, 'utf8');
  } catch (err) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.FRONTMATTER_INVALID,
      `无法读取技能文件 SKILL.md：${err && err.message ? err.message : String(err)}`
    );
  }

  const fm = parseSkillFrontmatter(text);
  if (!fm.ok) throw makeImportError(fm.code, fm.reason);

  const bodyText = text.replace(IMPORT_FRONTMATTER_RE, '');

  // 注入 / 凭据类**硬拒**（49 D-08 的分字段口径，不可调换）：
  // description 跑两组（进每个请求的 system prompt）/ body 只跑注入组（不进 prompt）
  assertNoInjection(fm.description, { includeCredentials: true });
  assertNoInjection(bodyText, { includeCredentials: false });

  const derived = deriveImportName(fm, rootRel);
  if (!derived.ok) throw makeImportError(derived.code, derived.reason);

  const stats = await collectPreviewStats(env, pkgRoot, rootRel);

  // 冲突三档（D-08）：**在预览卡片上就要给用户看到** —— 三选一 / 不许覆盖 reason。
  // seeded 档 ⇒ **预览直接失败**（拒绝导入、不提供覆盖选项，SEC-07 字面）
  const conflict = await resolveImportConflict(env, derived.name, { seededNames });
  if (conflict.kind === 'seeded') {
    throw makeImportError(conflict.code, conflict.message);
  }

  // **双扫**（SEC-06 / D-13）：description 原文与 body 原文各扫一次；每条命中带 `field`
  // 使「两个字段都扫了」成为可判据（只扫一个字段会在另一字段忘扫的实现上全绿）
  const heuristic = [
    ...scanSkillThreats(fm.description, 'description'),
    ...scanSkillThreats(bodyText, 'body'),
  ];

  return {
    name: derived.name,
    description: fm.description,
    tree: stats.tree,
    fileCount: stats.fileCount,
    dirCount: stats.dirCount,
    bytes: stats.bytes,
    maxFileBytes: stats.maxFileBytes,
    depth: stats.depth,
    scripts: stats.scripts,
    truncated: stats.truncated,
    // 注入类命中在更早阶段整包拒绝 ⇒ 到了这里只能是 hit: false
    scan: { injection: { hit: false }, heuristic },
    allowedTools: {
      status: fm.allowedTools ? 'ok' : 'missing',
      value: fm.allowedTools,
    },
    conflict,
    limits: buildImportLimitsProjection(),
    origin,
    rootRel,
  };
}

/**
 * **三种来源唯一的落盘实现**（D-03 / D-07 / T-51-21）
 *
 * ## 唯一性是可机械检查的不变式
 *
 * zip 上传、网络 zipball、直链 SKILL.md 三条来源全部汇入**这一个函数**；分流只发生在
 * **入参解析层**。判据（源码扫描）：`importUserSkill(` 在全仓恰 2 处出现 ——
 * `ai-skills-manager.js` 的定义 1 处 + `ai-manager.js` 的调用 1 处，
 * `main.js` 与 `src/settings-page.js` 各 0 处。
 *
 * ## 步骤顺序（与 `createManagedSkill` 的九步同构）
 *
 * ① **冲突三档判定**（`resolveImportConflict`，读盘）：seeded ⇒ `SEEDED_CONFLICT`
 *    （**拒绝、不提供覆盖**）；user ⇒ 三选一（缺省 `CONFLICT_UNRESOLVED`，
 *    **绝不静默覆盖**）；managed ⇒ 不许覆盖（`CONFLICT_UNRESOLVED` + 永久遮蔽提示）；
 * ② `conflict: 'cancel'` ⇒ **不落盘**，返回 `{ cancelled: true }`（临时目录的清理
 *    归调用方 `ai-manager` —— 保持「manager 只判定、ai-manager 管状态与清理」的分工）；
 * ③ 改名 ⇒ `newName` 走**同一份** `validateManagedSkillName`（不写第二份正则），
 *    并对改名后的名字**重判**（新名可能又撞 seeded / 已存在）；
 * ④ 数量闸（`MAX_USER_SKILLS`，**读盘**统计）：**只约束净增** —— `overwrite` 豁免
 *    （净增 0），`none` / `rename` 计入；
 * ⑤ **组装后全文的 64 KiB 闸** —— 导入**不重写文件** ⇒ 判据对象 = 包内 `SKILL.md` 的
 *    **实际字节数**。49 的不变式是「写侧权威字节闸口的判据对象 = 组装后的全文」，
 *    导入路径不组装 ⇒ **包内文件即组装结果**（两侧判的是同一个量）；
 * ⑥ **落点复核**（D-17 第 3 层 / SEC-05）：源目录与目标目录的父目录链上最近已存在
 *    祖先做 `realpathSync` 后必须仍在 AI 工作区根（双基准）内 —— 与 51-01 的写面判据
 *    **并列的独立第二道**；
 * ⑦ **落盘**：`none` / `rename` 走单次 `env.renameFile`（同设备、原子；`.tmp/` 与
 *    `skills/` 同沙箱 root ⇒ 无 EXDEV）；`overwrite` 走 **备份 + 两段 rename**
 *    （`rename(skills/<n> → .tmp/skill-replace-<rand>)` → `rename(src → skills/<n>)`），
 *    **第二步失败即把备份 `rename` 回原位**（旧技能逐字完好；「先删后移」被明确否决
 *    —— 任一步失败会**静默丢技能**，而被替换的是**用户自己**的目录）；
 * ⑧ **回读验证**（P12 / D-10）：`refreshSkills` 恰一次后确认该 name 出现在快照里且
 *    `filePath` 指向 `skills/`；不在 ⇒ **覆盖场景恢复备份、新建场景把目录移回源位置**，
 *    并抛 `READBACK_FAILED`（`extra.diagnostics` 带**含 path** 的诊断原文）。
 *    **不提供「部分导入」**。成功后覆盖场景删掉临时备份（**不是版本历史**）。
 *
 * ## 沙箱原语纪律（T-51-29）
 *
 * 落盘三步（备份 / 移入 / 回滚 / 删备份）**一律** `env.renameFile` / `env.remove` ——
 * 它们走 51-01 加固后的写面判据（双基准 + 最近已存在祖先 realpath）。**不得**用 Node
 * `fs.renameSync` / `fs.rm` 绕开：那会把 P2 门禁的承重面整条摘掉。
 *
 * ## 路径恒由 `path.join` 计算，目录名一律用**校验后的 name**
 *
 * 绝不用包内原始目录名拼路径（P5 第 2 条 —— 那是一个注入点）。**本函数的入参只有
 * `srcDir` / `rootRel` / `name` / `conflict` / `newName`** —— 客户端永远不能指定落点
 * （D-02 / ARCHITECTURE Anti-Pattern 1：这是接口边界而非沙箱能兜住的）。
 *
 * @param {object} env - 沙箱 ExecutionEnv
 * @param {{srcDir: string, rootRel?: string, name: string, conflict?: string, newName?: string}} params
 *   `srcDir` = 技能根目录的绝对路径（51-03 的调用契约）；`rootRel` 可选，供
 *   「包根 + 相对技能根」形态的调用方使用（`srcDir` 为包根时由它拼出技能根）。
 *   `conflict ∈ { 'overwrite', 'rename', 'cancel' }`，缺省 = 未给选择。
 * @param {{seededNames?: string[]|Set<string>}} [inject] - seeded 集合由**调用方注入**
 *   （`ai-skills-manager` 保持零 electron 依赖，见 D-11 的注入式签名纪律）
 * @returns {Promise<{cancelled: true}
 *                   | {name: string, source: string, bytes: number, files: number,
 *                      scripts: string[], scan: object, warnings: Array<object>,
 *                      allowedTools: object, conflict: 'none'|'overwrite'|'rename'}>}
 * @throws {Error} 任一拒绝路径（带 `code`）
 */
async function importUserSkill(env, { srcDir, rootRel = '', name, conflict, newName } = {}, { seededNames } = {}) {
  // `srcDir` 恒为技能根目录的绝对路径（51-03 的调用契约）；`rootRel` 非空时它代表
  // 「srcDir 是包根、技能根在 rootRel 之下」的另一种调用形态 —— 两者等价。
  const sourceDir = rootRel ? path.join(srcDir, rootRel) : srcDir;

  // ⓪ 显式取消：不落盘、不判数量、不读盘（临时目录清理由调用方负责）
  if (conflict === 'cancel') return { cancelled: true };

  const nameCheck = validateManagedSkillName(name);
  if (!nameCheck.ok) {
    // 码取**本表**的 `INVALID_NAME`（**不得**借用 MANAGE_SKILL_ERROR 的键，CR-3）
    throw makeImportError(IMPORT_SKILL_ERROR.INVALID_NAME, nameCheck.reason);
  }
  const requestedName = name.trim();

  const workspace = getAgentWorkspaceLazy();
  const skillsDir = workspace.getSkillsDir();
  const managedDir = workspace.getManagedSkillsDir();

  // ① 冲突三档判定（读盘；判定顺序即语义 —— 与 resolveImportConflict 同一份判据）
  const conflictInfo = await resolveImportConflict(env, requestedName, { seededNames });

  if (conflictInfo.kind === 'seeded') {
    throw makeImportError(IMPORT_SKILL_ERROR.SEEDED_CONFLICT, conflictInfo.message);
  }

  /** 落盘模式：'none'（新建）/ 'overwrite'（覆盖同名 user 技能）/ 'rename'（改名新建） */
  let mode = 'none';
  let resolvedName = requestedName;

  if (conflictInfo.kind === 'user') {
    if (conflict === 'overwrite') {
      mode = 'overwrite';
    } else if (conflict === 'rename') {
      resolvedName = resolveRenamedTarget(newName, requestedName);
      const recheck = await resolveImportConflict(env, resolvedName, { seededNames });
      if (recheck.kind !== 'none') {
        throw makeImportError(
          IMPORT_SKILL_ERROR.CONFLICT_UNRESOLVED,
          `改名后的名称「${resolvedName}」仍不可用：${recheck.message}`
        );
      }
      mode = 'rename';
    } else {
      throw makeImportError(
        IMPORT_SKILL_ERROR.CONFLICT_UNRESOLVED,
        `已存在同名用户技能「${requestedName}」：请在预览卡片上选择覆盖 / 改名 / 取消（不会静默覆盖）。`
      );
    }
  } else if (conflictInfo.kind === 'managed') {
    if (conflict === 'rename') {
      resolvedName = resolveRenamedTarget(newName, requestedName);
      const recheck = await resolveImportConflict(env, resolvedName, { seededNames });
      if (recheck.kind !== 'none') {
        throw makeImportError(
          IMPORT_SKILL_ERROR.CONFLICT_UNRESOLVED,
          `改名后的名称「${resolvedName}」仍不可用：${recheck.message}`
        );
      }
      mode = 'rename';
    } else {
      // 第三档**不允许覆盖**：导入只管 `skills/<name>/`，覆盖 managed 不可能是用户意图（D-08）
      throw makeImportError(
        IMPORT_SKILL_ERROR.CONFLICT_UNRESOLVED,
        `已存在同名 AI 自建技能「${requestedName}」：导入后它将被**永久遮蔽**，且不允许覆盖。请选择改名或取消。`
      );
    }
  }

  const destDir = path.join(skillsDir, resolvedName);

  // ④ 数量闸（读盘统计）—— **只约束净增**：覆盖 ⇒ 净增 0 ⇒ 豁免；改名 ⇒ 新建 ⇒ 计入
  if (mode !== 'overwrite') {
    const userCount = await countUserSkills(env, skillsDir);
    if (userCount >= LIMITS.MAX_USER_SKILLS) {
      throw makeImportError(
        IMPORT_SKILL_ERROR.LIMIT_EXCEEDED,
        `用户技能数量已达上限：限额 ${LIMITS.MAX_USER_SKILLS} 个（当前 ${userCount} 个）。请先卸载不再使用的技能`,
        { limit: 'MAX_USER_SKILLS', limitValue: LIMITS.MAX_USER_SKILLS, currentValue: userCount }
      );
    }
  }

  // ⑤ 权威字节闸：包内 SKILL.md 的**实际字节数**即「组装后的全文」
  const skillMdPath = path.join(sourceDir, 'SKILL.md');
  let mdBytes = 0;
  let mdText = '';
  try {
    mdBytes = fs.statSync(skillMdPath).size;
    mdText = fs.readFileSync(skillMdPath, 'utf8');
  } catch (err) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.FRONTMATTER_INVALID,
      `技能目录内缺少可读的 SKILL.md：${err && err.message ? err.message : String(err)}`
    );
  }
  if (mdBytes > LIMITS.MAX_SKILL_MD_BYTES) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.OVERSIZE,
      `技能文件超过上限：限额 ${LIMITS.MAX_SKILL_MD_BYTES} 字节，当前 ${mdBytes} 字节（按整文件计）`,
      { limit: 'MAX_SKILL_MD_BYTES', limitValue: LIMITS.MAX_SKILL_MD_BYTES, currentValue: mdBytes }
    );
  }

  const fm = parseSkillFrontmatter(mdText);
  const allowedTools = {
    status: fm.ok && fm.allowedTools ? 'ok' : 'missing',
    value: fm.ok ? fm.allowedTools : null,
  };
  const mdBody = mdText.replace(IMPORT_FRONTMATTER_RE, '');
  const heuristic = [
    ...scanSkillThreats(fm.ok ? fm.description : '', 'description'),
    ...scanSkillThreats(mdBody, 'body'),
  ];

  const stats = await collectPreviewStats(env, path.dirname(sourceDir), path.basename(sourceDir));

  // ⑥ 落点复核（D-17 第 3 层 / SEC-05）：两个端点的父目录链最近已存在祖先 realpath
  //    必须仍在 AI 工作区内 —— 这是与 51-01 写面判据**并列的独立第二道**
  assertLandingInsideWriteRoot(sourceDir);
  assertLandingInsideWriteRoot(destDir);

  // ⑦ 落盘（同设备原子 rename，目录级）—— 全走沙箱原语（T-51-29）
  let bak = null;
  if (mode === 'overwrite') {
    // 备份旧技能（用户在磁盘上的目录，可能手改过 —— 绝不「先删后移」）
    bak = path.join(workspace.getTmpDir(), IMPORT_TMP_PREFIXES[1] + importTmpSuffix());
    const movedOut = await env.renameFile(destDir, bak);
    if (!movedOut || movedOut.ok !== true) {
      throw makeImportError(
        IMPORT_SKILL_ERROR.UNKNOWN,
        `覆盖前备份既有技能失败（沙箱码 ${sandboxErrorCode(movedOut)}），未改动任何文件`
      );
    }
    try {
      const movedIn = await env.renameFile(sourceDir, destDir);
      if (!movedIn || movedIn.ok !== true) {
        throw makeImportError(
          IMPORT_SKILL_ERROR.UNKNOWN,
          `技能落盘失败（沙箱码 ${sandboxErrorCode(movedIn)}）`
        );
      }
    } catch (err) {
      // 第二步失败 ⇒ 备份回原位（回滚后旧技能**逐字完好**）
      await env.renameFile(bak, destDir);
      throw err;
    }
  } else {
    const renamed = await env.renameFile(sourceDir, destDir);
    if (!renamed || renamed.ok !== true) {
      // 失败不留半成品：**只在本次确实搬动过**（目标已被创建）时才清理
      if (await envDirExists(env, destDir)) {
        await env.remove(destDir, { recursive: true });
      }
      throw makeImportError(
        IMPORT_SKILL_ERROR.UNKNOWN,
        `技能落盘失败（沙箱码 ${sandboxErrorCode(renamed)}）`
      );
    }
  }

  // ⑧ 回读验证（P12 / D-10）：失败即回滚，不提供「部分导入」
  let readbackOk = false;
  let diagnostics = [];
  try {
    await refreshSkills(env, { rootDirs: [managedDir, skillsDir] });
    const snap = getSkillsSnapshot();
    diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    readbackOk = snap.skills.some(
      (entry) =>
        entry &&
        entry.skill &&
        entry.skill.name === resolvedName &&
        typeof entry.skill.filePath === 'string' &&
        entry.skill.filePath.startsWith(skillsDir + path.sep)
    );
  } catch (err) {
    diagnostics = [
      { level: 'error', code: 'realm_skill_readback_threw', message: String(err && err.message ? err.message : err) },
    ];
    readbackOk = false;
  }

  if (!readbackOk) {
    // 回滚：覆盖场景恢复备份；新建场景把刚移入的目录搬回源位置（「不提供部分导入」）
    if (bak) {
      try {
        await env.remove(destDir, { recursive: true, force: true });
      } catch {
        /* 清理失败不遮蔽回滚：备份仍会被搬回 */
      }
      await env.renameFile(bak, destDir);
    } else {
      await env.renameFile(destDir, sourceDir);
    }
    const own = diagnostics.filter(
      (d) => d && typeof d.path === 'string' && d.path.startsWith(destDir)
    );
    const detail = own.map((d) => d.message).join('；');
    throw makeImportError(
      IMPORT_SKILL_ERROR.READBACK_FAILED,
      detail
        ? `技能已写入但回读验证失败，已回滚：${detail}`
        : '技能已写入但回读验证失败（加载管线未识别该技能），已回滚',
      { diagnostics: own }
    );
  }

  // 成功后删掉覆盖备份 —— 它是**临时的**，不是版本历史 / 恢复机制（ECO-02 / v1.x）
  if (bak) {
    try {
      await env.remove(bak, { recursive: true, force: true });
    } catch (err) {
      console.warn('[Realm AI] 清理覆盖备份目录失败:', err && err.message ? err.message : err);
    }
  }

  return {
    name: resolvedName,
    source: 'zip',
    bytes: stats.bytes,
    files: stats.fileCount,
    scripts: stats.scripts,
    scan: { injection: { hit: false }, heuristic },
    warnings: diagnostics.filter(
      (d) => d && typeof d.path === 'string' && d.path.startsWith(destDir)
    ),
    allowedTools,
    conflict: mode,
  };
}

/**
 * 校验「改名」的目标名（`conflict: 'rename'`）—— **复用写侧那一份校验器**
 *
 * 不写第二份正则（49 D-11 / 50 的复用纪律）；失败码取**导入面**的 `INVALID_NAME`
 * （与 `MANAGE_SKILL_ERROR.INVALID_NAME` 取值相同但命名空间独立，CR-3）。
 *
 * @param {string} newName - 用户输入的新名称
 * @param {string} originalName - 原名称（仅用于错误文案）
 * @returns {string} 已 trim 的新名称
 * @throws {Error} 非法名（code: `invalid_name`）
 */
function resolveRenamedTarget(newName, originalName) {
  const check = validateManagedSkillName(newName);
  if (!check.ok) {
    throw makeImportError(
      IMPORT_SKILL_ERROR.INVALID_NAME,
      `改名失败：${check.reason}（原名称「${originalName}」保持不变，未改动任何文件）`
    );
  }
  return newName.trim();
}

module.exports = {
  LIMITS,
  refreshSkills,
  buildSkillsPrompt,
  getSkillsSnapshot,
  // 48-01 新增（面板投影 / tier / 路径反查 / 实时读盘）
  sourceTierOf,
  toUISkillEntry,
  matchSkillByPath,
  getSkillsForUI,
  readSkillForInvocation,
  // 49 新增（技能集 AI 写入路径：校验器 / 净化 / 扫描单点 / 组装 / 三动作）
  validateManagedSkillName,
  validateManagedSkillDescription,
  validateManagedSkillContent,
  sanitizeSkillDescription,
  scanSkillText,
  buildSkillFileText,
  createManagedSkill,
  updateManagedSkill,
  deleteManagedSkill,
  getSkillPromptIncluded,
  MANAGE_SKILL_ERROR,
  // 50 新增（设置页「技能管理」区的管理面投影 + 尺寸遍历的防御上限常量）
  // 注：measureSkillDir **刻意不导出** —— 它是内部实现，单测经 getSkillsForManagement()
  //     与 refreshSkills() 的行为面覆盖（测行为不测实现）。
  getSkillsForManagement,
  SKILL_SIZE_WALK_MAX_ENTRIES,
  SKILL_SIZE_WALK_MAX_DEPTH,
  // 50-02 新增（管理写路径：仅 user 可卸载的三态判据 + 两个管理面谓词 + 第十码）
  // 注：makeManageSkillError **刻意不导出** —— 判定全在模块内，调用方只消费带 `code` 的错误对象。
  deleteUserSkill,
  validateSkillNameForManagement,
  validateDisabledListForSettings,
  MAX_DISABLED_SKILLS,
  // 51 新增（导入面：限额 / 错误码 / entry 名校验 / frontmatter 解析 / 解压校验 /
  //          技能根定位 / 预览 / **唯一落盘实现**）
  // 注：makeImportError 与 makeManageSkillError 同款**刻意不导出** —— 判定全在模块内，
  //     调用方只消费带 `code` 的错误对象。
  IMPORT_LIMITS,
  IMPORT_SKILL_ERROR,
  validateEntryName,
  normalizedEntryKey,
  parseSkillFrontmatter,
  deriveImportName,
  readSkillPackageEntries,
  extractAndValidatePackage,
  locateSkillRoot,
  collectPreviewStats,
  buildImportPreview,
  importUserSkill,
  // 51-04 新增第四段（冲突三档判定 + 覆盖事务 + 临时区前缀单源）
  // 注：userSkillPaths / importTmpSuffix / resolveRenamedTarget **刻意不导出** ——
  //     内部实现，经 resolveImportConflict 与 importUserSkill 的行为面覆盖。
  resolveImportConflict,
  countUserSkills,
  IMPORT_TMP_PREFIXES,
  isImportResidueName,
  // 51 新增第三段（技能域威胁扫描：分表 + 返回命中列表的并列扫描函数）
  SKILL_THREAT_PATTERNS,
  scanSkillThreats,
  _resetCacheForTest,
};

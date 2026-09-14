/**
 * 设置页「技能管理」区单元测试（node:test，**纯 Node 环境**）
 *
 * 覆盖 Phase 50 的管理读路径纵切：`getSkillsForManagement()` 管理面投影、
 * `AIManager.ensureSkillsFresh()` 的读路径初始化（D-19）、`GET /api/skills/list`
 * 的接线（源码扫描），以及尺寸遍历的口径（见文件下半的「尺寸统计」describe）。
 *
 * 全部用例经 `setWorkspaceDir` 注入临时目录，不触碰真实 userData。
 *
 * **seededNames 一律显式注入数组常量 `SEEDED`**（除「端到端」一条刻意走
 * `AIManager` 的原型方法以证伪接线）：纯 Node 下 `getSeededSkillNamesSafe()`
 * 会 `require('electron')` 失败并降级为 `[]` —— 显式注入才让档位断言确定
 * （该降级路径本身不产生错误，只是档位会全部落到 `managed`）。
 *
 * 用法: node tests/test-skills-management.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');
const aiSkills = require('../ai-skills-manager');
const AIManager = require('../ai-manager');

/** 仓库根目录（源码扫描型断言用） */
const REPO_ROOT = path.join(__dirname, '..');

/**
 * 假的播种登记表（显式注入，不依赖真实随包目录）
 *
 * 真实登记表 = `builtin-skills-seeder.getSeededSkillNames()`（扫随包
 * `skills-builtin/` 的目录名集合）。此处用**常量数组**是为了让用例确定
 * 且不走纯 Node 下的降级路径。
 */
const SEEDED = ['find-skills', 'skill-creator'];

/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skills-mgmt-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
    // 模块级 _cache 跨用例污染会让「空技能集」断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  aiMemoryManager.setBaseDir(dir);
  return dir;
}

/** 建工作区目录 + 沙箱 env */
async function makeEnv(root) {
  workspace.ensureWorkspaceDir();
  return workspace.createSandboxEnv({ cwd: root });
}

/**
 * 真实落盘一个技能目录（必须真实落盘 —— 被测实现从不构造「内存里的技能」，
 * 手工构造对象会让断言变成对测试自己造物的自证）。
 *
 * @param {string} baseDir - `skills/` 或 `managed-skills/`
 * @param {string} name - 技能名（= 目录名，46 D-08 的权威）
 * @param {{description?: string, content?: string, frontmatterName?: string, extraFiles?: object}} [opts]
 */
function writeSkillDir(baseDir, name, opts = {}) {
  const {
    description = `${name} 的测试描述`,
    content = `# ${name}\n\n正文。\n`,
    frontmatterName = name,
    extraFiles = {},
  } = opts;
  const dir = path.join(baseDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${frontmatterName}\ndescription: ${description}\n---\n\n${content}`,
    'utf8'
  );
  for (const [rel, text] of Object.entries(extraFiles)) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
  }
  return dir;
}

/** 取出类方法体（用于源码扫描型断言；按两空格缩进的闭合括号界定） */
function classMethodBody(src, signature) {
  const i = src.indexOf(signature);
  if (i < 0) return '';
  const j = src.indexOf('\n  }\n', i);
  return src.slice(i, j < 0 ? i + 3000 : j);
}

/** 取 CSS 里「选择器含给定子串」的全部规则块（扁平 `sel { body }` 扫描） */
function cssRulesMentioning(css, needle) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m = re.exec(css);
  while (m !== null) {
    if (m[1].includes(needle)) out.push({ selector: m[1].trim(), body: m[2] });
    m = re.exec(css);
  }
  return out;
}

/** Phase 50 专属段（**已剥 CSS 注释**）—— 本计划新增的全部样式都在这一段里 */
function phase50CssSection() {
  const raw = readSource('src/styles/main.css');
  const marker = '/* ===== 设置页「技能管理」区（Phase 50） ===== */';
  const start = raw.indexOf(marker);
  assert.ok(start >= 0, 'Phase 50 专属段注释必须存在（整段可复核的前提）');
  return raw.slice(start).replace(/\/\*[\s\S]*?\*\//g, '');
}

// ==================== 管理读路径（Task 1 的 tracer 判据） ====================

describe('管理读路径纵切：投影 → 读路径初始化 → GET /api/skills/list', () => {
  test('端到端：不创建 Agent 时 ensureSkillsFresh() 之后仍能列出盘上的技能', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const managedDir = workspace.getManagedSkillsDir();
    writeSkillDir(managedDir, 'alpha-skill', { description: '端到端用例的技能' });

    // ctx **只有** sandboxEnv / configStore / agent 三样；没有 provider、没有 API Key、
    // 没有 Agent —— 这正是 D-19 要覆盖的「未配置任何 AI provider」场景。
    const ctx = Object.create(AIManager.prototype);
    ctx.sandboxEnv = env;
    ctx.configStore = { get: () => [] };
    ctx.agent = undefined;

    // 纯 Node 下 getSeededSkillNamesSafe() 必然走降级路径并 console.warn ——
    // 此处捕获以保持 TAP 输出干净（该降级只影响档位归属，不影响「技能是否列出」）。
    const originalWarn = console.warn;
    console.warn = () => {};
    let projection;
    try {
      await ctx.ensureSkillsFresh(); // ← 若换成 syncAgentSystemPrompt() 则必然失败（见下）
      projection = ctx.getSkillsForManagement();
    } finally {
      console.warn = originalWarn;
    }

    // 可失败性（本条用例的存在意义）：
    // syncAgentSystemPrompt() 首行 `if (!this.agent || !this.sandboxEnv) return;` 在无 Agent 时
    // 直接返回 ⇒ 不建沙箱、不重扫 ⇒ refreshedAt 恒 0、列表恒空。把上面那行换成它，本用例必红。
    assert.ok(projection.refreshedAt > 0, `读路径初始化后 refreshedAt 必须 > 0，实得 ${projection.refreshedAt}`);

    const names = projection.groups.flatMap((g) => g.items.map((i) => i.name));
    assert.ok(
      names.includes('alpha-skill'),
      `无 Agent（无 provider）时也必须列出盘上的技能，实得 [${names.join(', ')}]`
    );
  });

  test('投影形状：三档分组顺序 user → builtin → managed，且空组被剔除', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    writeSkillDir(userDir, 'a-user');
    writeSkillDir(userDir, 'z-user');
    writeSkillDir(managedDir, 'find-skills'); // ∈ SEEDED ⇒ builtin
    writeSkillDir(managedDir, 'ai-made'); // 非 seeded ⇒ managed

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const projection = aiSkills.getSkillsForManagement(SEEDED);

    assert.deepStrictEqual(
      projection.groups.map((g) => g.tier),
      ['user', 'builtin', 'managed'],
      '三档分组必须按 user → builtin → managed 的固定顺序、且空组被剔除'
    );
    assert.deepStrictEqual(
      projection.groups[0].items.map((i) => i.name),
      ['a-user', 'z-user'],
      '组内顺序必须是 bySkillPriority 全序的稳定投影（user 组内按 name 码点序）'
    );
    assert.deepStrictEqual(projection.groups[1].items.map((i) => i.name), ['find-skills']);
    assert.deepStrictEqual(projection.groups[2].items.map((i) => i.name), ['ai-made']);
  });

  test('空组剔除：只有 managed 技能时 groups 恰一组', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const managedDir = workspace.getManagedSkillsDir();
    const userDir = workspace.getSkillsDir();
    writeSkillDir(managedDir, 'ai-made');

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const projection = aiSkills.getSkillsForManagement(SEEDED);

    assert.strictEqual(projection.groups.length, 1, '空组必须由主进程剔除（渲染层零判定）');
    assert.strictEqual(projection.groups[0].tier, 'managed');
  });

  test('投影条目：管理面四字段齐备，且不携带 content / filePath', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const managedDir = workspace.getManagedSkillsDir();
    const userDir = workspace.getSkillsDir();
    writeSkillDir(userDir, 'carrier', { description: '字段齐备用例' });

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const projection = aiSkills.getSkillsForManagement(SEEDED);
    const item = projection.groups[0].items.find((i) => i.name === 'carrier');
    assert.ok(item, '必须能查到目标技能');

    for (const key of [
      'name',
      'description',
      'tier',
      'disableModelInvocation',
      'disabled',
      'shadowed',
      'overLimit',
      'promptOmitted',
      'bytes',
      'fileCount',
      'statsUnavailable',
      'diagnostics',
    ]) {
      assert.ok(key in item, `投影条目必须携带 ${key}`);
    }

    assert.strictEqual('content' in item, false, '投影**不得**携带 SKILL.md 正文');
    assert.strictEqual('filePath' in item, false, '投影**不得**携带沙箱内绝对路径');
  });

  test('limits：五键齐备且数值逐项等于 LIMITS', async (t) => {
    const root = withTempRoot(t);
    await makeEnv(root);

    const { limits } = aiSkills.getSkillsForManagement(SEEDED);
    assert.deepStrictEqual(Object.keys(limits).sort(), [
      'maxDescriptionChars',
      'maxManagedSkills',
      'maxSkillMdBytes',
      'maxUserSkills',
      'skillsPromptCharBudget',
    ]);
    assert.strictEqual(limits.maxSkillMdBytes, aiSkills.LIMITS.MAX_SKILL_MD_BYTES);
    assert.strictEqual(limits.maxUserSkills, aiSkills.LIMITS.MAX_USER_SKILLS);
    assert.strictEqual(limits.maxManagedSkills, aiSkills.LIMITS.MAX_MANAGED_SKILLS);
    assert.strictEqual(limits.skillsPromptCharBudget, aiSkills.LIMITS.SKILLS_PROMPT_CHAR_BUDGET);
    assert.strictEqual(limits.maxDescriptionChars, aiSkills.LIMITS.MAX_SKILL_DESCRIPTION_CHARS);
  });

  test('refreshedAt === 0（从未加载）时 groups 为空数组', async (t) => {
    withTempRoot(t);
    // _resetCacheForTest() 已在 withTempRoot 的 after 之外先跑一次，这里显式再复位一遍
    aiSkills._resetCacheForTest();

    const projection = aiSkills.getSkillsForManagement(SEEDED);
    assert.strictEqual(projection.refreshedAt, 0);
    assert.deepStrictEqual(projection.groups, [], '从未加载时必须是空 groups（渲染层据此走空态 A）');
  });

  test('errors 是视图拷贝：就地改 projections.errors 不污染权威快照', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    // 缺一个扫描根 ⇒ 触发 realm_skills_dir_missing（模块级 errors[]）
    await aiSkills.refreshSkills(env, { rootDirs: [path.join(root, 'managed-skills'), path.join(root, 'nope')] });

    const projection = aiSkills.getSkillsForManagement(SEEDED);
    const before = aiSkills.getSkillsSnapshot().errors.length;
    assert.ok(before > 0, '缺扫描根必须产 errors[] 条目（禁止静默失败）');
    projection.errors.push({ level: 'error', code: 'realm_fake' });
    assert.strictEqual(
      aiSkills.getSkillsSnapshot().errors.length,
      before,
      '投影的 errors 必须是拷贝（否则设置页一次展开就写回了权威快照）'
    );
  });

  test('diagnostics 是深拷：就地改条目的 diagnostics 不污染权威快照', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const managedDir = workspace.getManagedSkillsDir();
    const userDir = workspace.getSkillsDir();
    // frontmatter name ≠ 目录名 ⇒ 产 realm_name_rewritten（条目级诊断）
    writeSkillDir(userDir, 'renamed-dir', { frontmatterName: 'declared-name' });

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const projection = aiSkills.getSkillsForManagement(SEEDED);
    const item = projection.groups[0].items.find((i) => i.name === 'renamed-dir');
    assert.ok(item.diagnostics.length > 0, 'name 与目录名不一致必须产条目级诊断');

    const authoritative = aiSkills
      .getSkillsSnapshot()
      .skills.find((e) => e.skill.name === 'renamed-dir').diagnostics.length;
    item.diagnostics.push({ level: 'warning', code: 'realm_fake' });
    assert.strictEqual(
      aiSkills.getSkillsSnapshot().skills.find((e) => e.skill.name === 'renamed-dir').diagnostics.length,
      authoritative,
      '条目级 diagnostics 必须是 slice() 深拷（活引用会让设置页把数据写回权威快照）'
    );
  });
});

// ==================== 接线源码扫描（本计划三条接线的机器判据） ====================

describe('接线：main.js 的 handleSkillsApi 与 ai-manager.js 的读路径初始化', () => {
  test('main.js：handleSkillsApi 存在、首段 token 鉴权、分发用 startsWith', () => {
    const src = readSource('main.js');

    assert.ok(src.includes('async function handleSkillsApi('), 'main.js 必须定义 handleSkillsApi');
    assert.ok(src.includes("reqPath.startsWith('/api/skills/')"), 'main.js 必须含 /api/skills/ 分发分支');

    const head = src.slice(src.indexOf('async function handleSkillsApi('), src.indexOf('async function handleSkillsApi(') + 700);
    assert.ok(
      /searchParams\.get\('token'\)\s*!==\s*REALM_TOKEN/.test(head),
      'handleSkillsApi 首段必须做 token 鉴权（T-50-01：无 token 必须在任何副作用之前 403）'
    );

    // 分发分支必须插在 /api/ai-memory 之前（源序即判定顺序的既有惯例）
    const idxSkills = src.indexOf("reqPath.startsWith('/api/skills/')");
    const idxMemory = src.indexOf("reqPath === '/api/ai-memory'");
    assert.ok(idxSkills > 0 && idxMemory > 0 && idxSkills < idxMemory, '/api/skills/ 分支必须在 /api/ai-memory 之前');
  });

  test('main.js：list 子路由先 ensureSkillsFresh 再同步取投影（不得 await 投影）', () => {
    const src = readSource('main.js');
    const body = src.slice(src.indexOf('async function handleSkillsApi('));
    const scoped = body.slice(0, body.indexOf('\n  }\n'));

    assert.ok(/if \(route === 'list' && req\.method === 'GET'\)/.test(scoped), 'list 子路由分支缺失');
    assert.ok(/await aiManager\.ensureSkillsFresh\(\)/.test(scoped), 'list 分支必须先 await ensureSkillsFresh()');
    assert.ok(
      /sendJson\(res, 200, aiManager\.getSkillsForManagement\(\)\)/.test(scoped),
      'getSkillsForManagement() 是同步的 —— 不得写成 await aiManager.getSkillsForManagement()'
    );
  });

  test('ai-manager.js：ensureSkillsFresh 分流两分支（Agent 存在与否），且不并入 syncAgentSystemPrompt 的函数体', () => {
    const src = readSource('ai-manager.js');
    assert.ok(src.includes('async ensureSkillsFresh()'), 'ai-manager.js 必须定义 ensureSkillsFresh');

    const body = classMethodBody(src, 'async ensureSkillsFresh()');
    assert.ok(body.includes('await this.syncAgentSystemPrompt()'), '有 Agent 时必须走 syncAgentSystemPrompt（其内含恰一次 refreshSkills）');
    assert.ok(body.includes('refreshSkills('), '无 Agent 时必须直接 refreshSkills');
    assert.ok(
      body.includes('createSandboxEnv()'),
      '必须先惰性建 sandboxEnv —— createSandboxEnv 与 provider 配置无关，这正是 D-19 可行的依据'
    );

    // 分流两分支必须**互斥**（不得两条都执行 ⇒ 两次全量重扫）
    assert.ok(/if \(this\.agent\)\s*\{[\s\S]*?return;/.test(body), '有 Agent 的分支必须 return，不得继续走直接重扫');
  });

  test('ai-manager.js：syncAgentSystemPrompt 的函数体逐字未改（46-04 的方法体断言面）', () => {
    const body = classMethodBody(readSource('ai-manager.js'), 'async syncAgentSystemPrompt()');
    assert.ok(body.includes('if (!this.agent || !this.sandboxEnv) return;'), '首行早退必须原样保留');
    assert.ok(body.includes("windowManager.broadcast('skills:changed')"), '广播必须仍在函数体内（本阶段不改它）');
    assert.ok(
      !body.includes('ensureSkillsFresh'),
      '读路径初始化**不得**进 syncAgentSystemPrompt 的函数体（46-04 的源码扫描断言钉着它）'
    );
  });

  test('ai-skills-manager.js：零 electron 依赖，且 measureSkillDir 刻意不导出', () => {
    const src = readSource('ai-skills-manager.js');
    assert.strictEqual(
      /require\(['"]electron['"]\)/.test(src),
      false,
      'ai-skills-manager.js 必须保持零 electron 依赖（50/51 才能直接 require 同一份）'
    );
    assert.ok(/module\.exports\s*=\s*\{[\s\S]*?\bgetSkillsForManagement\b/.test(src), 'getSkillsForManagement 必须导出');
    const exportBlock = src.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\};/);
    assert.ok(exportBlock, 'module.exports 必须以对象字面量形态存在');
    assert.strictEqual(
      /^\s*measureSkillDir\s*,\s*$/m.test(exportBlock[1]),
      false,
      'measureSkillDir 刻意不导出（测行为不测实现）'
    );
  });
});

// ==================== 样式硬禁令（比计划自带判据更宽的那一面） ====================

describe('样式硬禁令：Phase 50 段的「行不得有 hover 底」与「行首行不得换行」', () => {
  /*
   * 这两条不变式来自 50-UI-SPEC 的 ## Color 硬禁令与「长文本与溢出纪律」，都是**承重判据**
   *（行加 hover 底会把描述 / 元信息 / 中性状态标注同时拖到 4.5:1 以下）。
   *
   * 计划自带的样式判据只扫 `.skill-manage-row { … }` / `.skill-manage-row-main { … }`
   * **单个规则块**——实测：另起一条 `.skill-manage-row:hover { background: var(--bg-hover) }`
   * 可完整绕过它（变异实跑确认）。本组按**选择器形态**扫整段，把那个缺口封上。
   * 判据已先剥 CSS 注释 ⇒ 规则块里如实写明「不得加 --bg-hover 底」的说明文字不构成违规。
   */

  test('.skill-manage-row* 的任何规则块都不得声明 background: var(--bg-hover)', () => {
    const offenders = cssRulesMentioning(phase50CssSection(), '.skill-manage-row').filter((r) =>
      /background\s*:\s*var\(--bg-hover\)/.test(r.body)
    );
    assert.deepStrictEqual(
      offenders.map((r) => r.selector),
      [],
      '硬禁令：给行加 --bg-hover 底会让整行的描述 / 元信息 / 中性状态标注同时跌破 4.5:1（暗 3.96 / 亮 4.35），并拖低「仅显式」的合成底'
    );
  });

  test('.skill-manage-row-main* 的任何规则块都不得声明 flex-wrap', () => {
    const offenders = cssRulesMentioning(phase50CssSection(), '.skill-manage-row-main').filter((r) =>
      /flex-wrap/.test(r.body)
    );
    assert.deepStrictEqual(
      offenders.map((r) => r.selector),
      [],
      '硬禁令：行首行换行会重演 48-UI-REVIEW Pillar 2 的「徽标被挤出首行、与名字读作两行」'
    );
  });
});


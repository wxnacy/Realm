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

/** 在管理投影的三档分组里按名字查条目（渲染层的消费方式：只 forEach、不重排） */
function findItem(projection, name) {
  for (const g of projection.groups) {
    const hit = g.items.find((i) => i.name === name);
    if (hit) return hit;
  }
  return null;
}

/**
 * 递归列出目录下的**真实普通文件**（隐藏文件与 symlink 不计 —— 与 D-13 的口径同源）
 *
 * 期望值由它算出来，**不写手写常量**：手写常量会把「实现与口径同时错」判成绿。
 */
function listRealFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (e.name.startsWith('.')) continue;
      listRealFiles(p, out);
      continue;
    }
    if (e.name.startsWith('.')) continue;
    if (e.isFile()) out.push(p);
  }
  return out;
}

/** 一组真实文件的字节和（D-13 口径下的期望 bytes） */
function sumFileBytes(files) {
  return files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
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

// ==================== 尺寸统计（Task 3 的口径判据） ====================

describe('尺寸统计口径：递归 / 含 SKILL.md / 不含隐藏 / 目录 size 不计 / 不穿 symlink / 不进 digest', () => {
  test('递归含子目录：fileCount 与 bytes 等于真实文件集（statSync 求和，不写常量）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    const dir = writeSkillDir(userDir, 'nested', {
      extraFiles: {
        'scripts/a.js': 'console.log(1);\n',
        'scripts/b.js': 'console.log(2);\n',
        'references/deep/b.md': '# deep note\n',
      },
    });

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const item = findItem(aiSkills.getSkillsForManagement(SEEDED), 'nested');

    const files = listRealFiles(dir);
    assert.deepStrictEqual(
      files.map((f) => path.relative(dir, f)).sort(),
      ['SKILL.md', 'references/deep/b.md', 'scripts/a.js', 'scripts/b.js'],
      '夹具必须恰为 4 个真实文件（SKILL.md 自身计入 —— research A2 的口径）'
    );
    assert.strictEqual(item.fileCount, files.length, 'fileCount 必须是递归后的文件总数（目录不计）');
    assert.strictEqual(item.bytes, sumFileBytes(files), 'bytes 必须是全部文件的真实字节和');
    assert.strictEqual(item.statsUnavailable, false, '统计成功时不得标 statsUnavailable');
  });

  test('SKILL.md 自身计入：单文件技能的 fileCount === 1 且 bytes === statSync(SKILL.md).size', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    const dir = writeSkillDir(userDir, 'solo');

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const item = findItem(aiSkills.getSkillsForManagement(SEEDED), 'solo');

    assert.strictEqual(item.fileCount, 1);
    assert.strictEqual(item.bytes, fs.statSync(path.join(dir, 'SKILL.md')).size);
  });

  test('隐藏文件不计：加一个 .DS_Store 后 bytes 与 fileCount 都不变', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    const dir = writeSkillDir(userDir, 'hidden-probe', { extraFiles: { 'scripts/a.js': 'aaa\n' } });

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const before = findItem(aiSkills.getSkillsForManagement(SEEDED), 'hidden-probe');

    fs.writeFileSync(path.join(dir, '.DS_Store'), 'garbage-bytes-here');
    fs.mkdirSync(path.join(dir, '.hidden-dir'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.hidden-dir', 'x.md'), 'yyy\n');
    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const after = findItem(aiSkills.getSkillsForManagement(SEEDED), 'hidden-probe');

    assert.strictEqual(after.bytes, before.bytes, '.DS_Store 与隐藏目录不得计入体积');
    assert.strictEqual(after.fileCount, before.fileCount, '隐藏文件不得计入文件数');
  });

  test('目录 size 不计：bytes 恰等于「只累加 kind === file」的期望值', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    // 目录条目本身也带 size（lstat 的 inode 数据，实测恒为 96）—— 无条件求和会把它们算进去
    const dir = writeSkillDir(userDir, 'dir-size-probe', {
      extraFiles: { 'references/deep/b.md': '# x\n', 'scripts/a.js': 'q\n' },
    });

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const item = findItem(aiSkills.getSkillsForManagement(SEEDED), 'dir-size-probe');

    const fileOnly = sumFileBytes(listRealFiles(dir));
    assert.strictEqual(item.bytes, fileOnly, 'bytes 必须是文件字节和（目录的 inode size 不得累加）');

    // 反方向证据：把目录也算进去会得到一个更大的数 ⇒ 断言确实有区分力
    const allEntries = fs.readdirSync(dir).map((n) => fs.statSync(path.join(dir, n)));
    assert.ok(
      allEntries.some((st) => st.isDirectory() && st.size > 0),
      '本夹具必须包含 size > 0 的目录条目，否则该断言无区分力（空集真）'
    );
    assert.notStrictEqual(item.bytes, item.bytes + 0 + allEntries[0].size, 'sanity');
  });

  test('不穿 symlink：内部链接环与外逃链接都在有限步内返回，且都不计入', { timeout: 20000 }, async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    const dir = writeSkillDir(userDir, 'loops', { extraFiles: { 'references/real.md': '# real\n' } });
    const refs = path.join(dir, 'references');
    // 内部链接环：references/self → references（naive 递归会无限循环 ⇒ 本用例有 timeout 保护）
    fs.symlinkSync(refs, path.join(refs, 'self'), 'dir');
    // 外逃链接：指向工作区外的真实文件
    fs.symlinkSync('/etc/hosts', path.join(dir, 'escape.md'), 'file');
    // 顶层再放一个指向内部目录的链接
    fs.symlinkSync(refs, path.join(dir, 'loopdir'), 'dir');

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const item = findItem(aiSkills.getSkillsForManagement(SEEDED), 'loops');

    const files = listRealFiles(dir);
    assert.deepStrictEqual(files.map((f) => path.relative(dir, f)).sort(), [
      'SKILL.md',
      'references/real.md',
    ]);
    assert.strictEqual(item.fileCount, 2, 'symlink 不得计入文件数');
    assert.strictEqual(item.bytes, sumFileBytes(files), 'symlink 不得计入字节（链接长度不算内容）');
    assert.strictEqual(item.statsUnavailable, false, '跳 symlink 不得被当成「统计不可用」');
  });

  test('不进 digest：加一个文件（不改 SKILL.md）⇒ digest 逐字不变而 bytes 变大', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    const dir = writeSkillDir(userDir, 'digest-probe', { extraFiles: { 'a.md': 'aaa\n' } });

    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    // **值副本**是这条用例的前提：refreshSkills 返回模块级 `_cache`（活引用），
    // getSkillsSnapshot() 只做浅拷贝（数组新、条目仍是同一批引用）—— 直接比较会让
    // 断言在实现退化（例如把 bytes 塞进 digest 后又取活引用比较）时**恒真**（假绿）。
    const first = JSON.parse(JSON.stringify(aiSkills.getSkillsForManagement(SEEDED)));
    const firstDigest = first.digest;
    const firstBytes = findItem(first, 'digest-probe').bytes;

    fs.writeFileSync(path.join(dir, 'b.md'), 'bbbbb\n');
    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    const second = JSON.parse(JSON.stringify(aiSkills.getSkillsForManagement(SEEDED)));

    assert.strictEqual(
      second.digest,
      firstDigest,
      '尺寸不进 computeDigest —— 加一个文件不得改变 digest（否则会触发 systemPrompt 改写 + 广播 ⇒ provider 前缀缓存 miss）'
    );
    assert.ok(
      findItem(second, 'digest-probe').bytes > firstBytes,
      '同一次比较里 bytes 必须**确实变大**（否则这条用例只剩「digest 没变」半边，无法区分「尺寸没算」与「尺寸没进 digest」）'
    );
  });

  test('统计局部失败不静默也不放大：子目录读不到 ⇒ 产诊断 + 该技能仍列出且其余技能照常统计', async (t) => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      t.skip('以 root 运行时 chmod 0o000 不产生 EACCES，本用例无区分力');
      return;
    }
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    const brokenDir = writeSkillDir(userDir, 'broken', { extraFiles: { 'references/a.md': '# a\n' } });
    writeSkillDir(userDir, 'healthy', { extraFiles: { 'scripts/ok.js': 'ok\n' } });

    const locked = path.join(brokenDir, 'references');
    fs.chmodSync(locked, 0o000);
    try {
      await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
      const projection = aiSkills.getSkillsForManagement(SEEDED);
      const broken = findItem(projection, 'broken');
      const healthy = findItem(projection, 'healthy');

      assert.ok(broken, '技能必须仍在列表上 —— 一次局部读失败不得让它消失（T-50-04 的「整体回滚放大」面）');
      assert.strictEqual(
        broken.diagnostics.some((d) => d.code === 'realm_skill_dir_unreadable'),
        true,
        '读不到必须产 realm_skill_dir_unreadable 诊断（禁止静默失败，T-50-05）'
      );
      // 读得到的部分照常计入 ⇒ 显示的是**下限值**（SKILL.md 自身可读，references/ 读不到）
      assert.strictEqual(broken.fileCount, 1, '可读的 SKILL.md 仍计入（局部失败只损失读不到的那部分）');
      assert.ok(broken.bytes > 0, '可读的 SKILL.md 的字节仍计入');
      // ⚠️ 此处 `statsUnavailable` **仍为 false** 是正确的：它的判据是「bytes 与 fileCount 双零」，
      //    而本场景下 SKILL.md 可读 ⇒ 双非零。它表达的是「一点都没统计到」而非「统计得不完整」。
      //    `statsUnavailable === true` 的那条分支由下一条用例经失败注入覆盖 ——
      //    它**无法**用 chmod 构造：技能目录整个读不到 ⇔ SDK 加载不到该技能 ⇒ 条目根本不在集合里
      //    （实测：chmod 技能目录后该技能从列表消失，因为 SDK 的 listDir 同样失败）。
      assert.strictEqual(broken.statsUnavailable, false);

      assert.strictEqual(healthy.statsUnavailable, false, '其余技能必须照常统计（逐技能隔离失败）');
      assert.ok(healthy.bytes > 0, '其余技能的 bytes 必须真的算出来了');
      assert.ok(projection.groups.length > 0, '局部统计失败不得让技能集消失');
    } finally {
      fs.chmodSync(locked, 0o755);
    }
  });

  test('statsUnavailable 分支：统计阶段目录整个读不到 ⇒ bytes/fileCount 双零且标记「统计不可用」', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    const dir = writeSkillDir(userDir, 'unreadable-at-measure');
    writeSkillDir(userDir, 'healthy-sibling', { extraFiles: { 'a.md': 'a\n' } });

    // 注入一个「读盘时序」env：SDK 加载阶段（对该目录的**第 1 次** listDir）正常，
    // **进入尺寸统计阶段后**（第 2 次）该技能目录的 listDir 返回失败 Result。
    // 复现的正是「技能条目已在缓存里、但目录此刻读不到」这条真实竞态
    //（bash / Finder 可在两次 IO 之间改动权限或删目录）。
    // 注入的是沙箱**有明文契约**的失败形状（`{ ok: false, error: { code } }`，
    // `env.listDir` 的 Result 契约），不是被测实现从不构造的对象。
    let targetListCalls = 0;
    const flakyEnv = {
      ...env,
      async listDir(p, s) {
        if (path.resolve(p) === path.resolve(dir)) {
          targetListCalls += 1;
          if (targetListCalls >= 2) return { ok: false, error: { code: 'permission_denied' } };
        }
        return env.listDir(p, s);
      },
    };

    await aiSkills.refreshSkills(flakyEnv, { rootDirs: [managedDir, userDir] });
    assert.ok(targetListCalls >= 2, '夹具必须真的让 SDK 加载过一次、统计阶段再一次（否则本用例不成立）');
    const projection = aiSkills.getSkillsForManagement(SEEDED);
    const item = findItem(projection, 'unreadable-at-measure');

    assert.ok(item, '统计失败不得让技能从列表消失');
    assert.strictEqual(item.bytes, 0);
    assert.strictEqual(item.fileCount, 0);
    assert.strictEqual(
      item.statsUnavailable,
      true,
      'T-50-05：bytes/fileCount 双零必须由**显式布尔**表达为「统计不可用」—— 前端据此渲染「统计不可用」而非失实的 0 B · 0 个文件'
    );
    assert.strictEqual(
      item.diagnostics.some((d) => d.code === 'realm_skill_dir_unreadable'),
      true,
      '必须产诊断（不静默）'
    );
    assert.strictEqual(findItem(projection, 'healthy-sibling').statsUnavailable, false, '其余技能照常统计');
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

// ==================== 管理写路径数据层（50-02 Task 1 的判据） ====================

/** 断言 `fn()` 抛出带指定 `code` 的错误，并把错误对象返回给调用方继续断言 */
async function expectCode(fn, code) {
  let caught = null;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, `必须抛出错误（期望 code = ${code}）`);
  assert.strictEqual(caught.code, code, `错误码必须是 ${code}，实得 ${caught.code}: ${caught.message}`);
  return caught;
}

describe('仅 user 可卸载：三态拒绝面（全部经 manager 函数直接调用，不经 HTTP handler）', () => {
  /*
   * ROADMAP 判据 3 的原文是「卸载仅允许 source === 'user'，**手改 URL 直接调端点也不例外**」。
   * 本组一律调 `aiSkills.deleteUserSkill()`（manager 层）而非任何 HTTP 包装 ——
   * 这正是那条判据的承重点：绕开 handler 的友善包装，拒绝态依然成立。
   */

  test('态 ①：skills/<name> 不存在 ⇒ not_found', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    await expectCode(() => aiSkills.deleteUserSkill(env, { name: 'ghost-skill' }), 'not_found');
  });

  test('态 ①′：skills/<name> 是**普通文件**（不是目录）⇒ not_found，且那个文件必须原封不动', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    // env.exists() 对普通文件也返回 true（SDK 实现是「fileInfo 成功即 ok(true)」）⇒
    // 判据必须用 fileInfo 判 kind。若改用 exists，本用例会走到 env.remove(dir,{recursive:true})
    // 把 `SKILL.md` 之外的任意同名文件删掉。
    fs.writeFileSync(path.join(userDir, 'plain-file'), 'not a directory', 'utf8');

    await expectCode(() => aiSkills.deleteUserSkill(env, { name: 'plain-file' }), 'not_found');

    assert.ok(fs.existsSync(path.join(userDir, 'plain-file')), '判据不成立时**不得**删除任何东西');
  });

  test('态 ②：同名双存在（user + managed）⇒ **允许**卸载且只删 user 目录，managed 原封不动', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    writeSkillDir(userDir, 'dual-name');
    writeSkillDir(managedDir, 'dual-name');

    const result = await aiSkills.deleteUserSkill(env, { name: 'dual-name' });

    assert.ok(result, '同名双存在时 user 条目确实存在（user 胜出），必须允许卸载');
    assert.deepStrictEqual(
      Object.keys(result).sort(),
      ['action', 'filePath', 'name'],
      '响应体**不带**提示字段（shadowNotice 一类无消费者的字段会腐化成第二次实现；提示由 50-04 的确认弹框从投影数据渲染）'
    );
    assert.strictEqual(result.action, 'uninstall');
    assert.strictEqual(result.name, 'dual-name');
    assert.strictEqual(fs.existsSync(path.join(userDir, 'dual-name')), false, 'skills/<name> 必须被删掉');
    assert.strictEqual(
      fs.existsSync(path.join(managedDir, 'dual-name', 'SKILL.md')),
      true,
      'managed-skills/<name> 必须原封不动（它只用来提示，不作拒绝条件也不作删除对象）'
    );
  });

  test('态 ③：skills/<name> 不存在而 managed-skills/<name> 存在 ⇒ not_user_owned（第十码）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const managedDir = workspace.getManagedSkillsDir();
    writeSkillDir(managedDir, 'managed-only');

    await expectCode(() => aiSkills.deleteUserSkill(env, { name: 'managed-only' }), 'not_user_owned');

    assert.ok(fs.existsSync(path.join(managedDir, 'managed-only', 'SKILL.md')), '被拒路径不得删任何东西');
  });

  test('判据读盘而非缓存快照：暖缓存 → 从盘删目录 → 调卸载 ⇒ not_found', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const managedDir = workspace.getManagedSkillsDir();
    writeSkillDir(userDir, 'warm-cached');
    await aiSkills.refreshSkills(env, { rootDirs: [managedDir, userDir] });
    assert.ok(
      aiSkills.getSkillsSnapshot().skills.some((e) => e.skill.name === 'warm-cached'),
      '前置：缓存里必须先有该技能（否则本用例退化成「一开始就不存在」）'
    );

    // 模拟 bash / Finder 直接改盘（无事件可挂）—— 缓存此刻仍认为技能存在
    fs.rmSync(path.join(userDir, 'warm-cached'), { recursive: true, force: true });

    await expectCode(() => aiSkills.deleteUserSkill(env, { name: 'warm-cached' }), 'not_found');
  });

  test('递归删除生效：连带 scripts/ 与 references/ 子目录一并消失', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const userDir = workspace.getSkillsDir();
    const dir = writeSkillDir(userDir, 'with-scripts', {
      extraFiles: { 'scripts/a.js': 'console.log(1);\n', 'references/deep/b.md': '# b\n' },
    });
    assert.ok(fs.existsSync(path.join(dir, 'scripts', 'a.js')), '前置：子目录必须已落盘');

    await aiSkills.deleteUserSkill(env, { name: 'with-scripts' });

    assert.strictEqual(fs.existsSync(dir), false, 'recursive: true 必须整目录删干净（SDK 默认 false）');
  });
});

describe('管理面名称谓词与禁用名单校验（OQ-2 的安全超集，单源）', () => {
  test('validateSkillNameForManagement：接受加载管线允许的不规范名字（不得用严格形态）', () => {
    // 严格形态 `^[a-z0-9-]+$` 会拒掉这些 —— 而它们**确实会出现在管理列表里**（46 D-08
    // 「不丢弃命名不规范的合法技能」），拒掉就会 render 出一个「点了必然 400」的开关。
    for (const name of ['My_Skill', 'UPPER', 'dot.name', 'has space', 'a--b', '_leading']) {
      const check = aiSkills.validateSkillNameForManagement(name);
      assert.strictEqual(check.ok, true, `${name} 必须通过管理面谓词（OQ-2 的安全超集）`);
      assert.strictEqual(check.value, name, '成功时回传 trim 后的值');
    }
    assert.strictEqual(aiSkills.validateSkillNameForManagement('  spaced  ').value, 'spaced', '首尾空白必须 trim');
  });

  test('validateSkillNameForManagement：拒绝面（空 / 超长 / 路径分隔符 / 控制字符 / 非字符串）', () => {
    const rejects = ['', '   ', 'a'.repeat(65), 'a/b', 'a\\b', 'a\u0000b', 'a\u001fb', 42, null, undefined, {}];
    for (const value of rejects) {
      const check = aiSkills.validateSkillNameForManagement(value);
      assert.strictEqual(check.ok, false, `${JSON.stringify(value)} 必须被拒`);
      assert.strictEqual(check.code, 'invalid_name', `拒绝码必须是 invalid_name（不是 unknown）`);
      assert.ok(check.reason && check.reason.length > 0, '拒绝必须带可读原因');
    }
    // 边界：恰 64 字符必须通过（长度上限是单源常量 MAX_SKILL_NAME_CHARS = 64）
    assert.strictEqual(aiSkills.validateSkillNameForManagement('a'.repeat(64)).ok, true, '64 字符必须通过');
  });

  test('validateDisabledListForSettings：拒绝面逐条喂真实数据形状', () => {
    const rejects = [
      'not-an-array',
      {},
      null,
      undefined,
      42,
      ['ok-name', ''],
      ['ok-name', 42],
      ['ok-name', null],
      ['a'.repeat(65)],
      ['../escape'],
      ['a/b'],
      ['a\\b'],
      Array(101).fill('a'),
    ];
    for (const value of rejects) {
      const check = aiSkills.validateDisabledListForSettings(value);
      assert.strictEqual(check.valid, false, `${JSON.stringify(value)} 必须被拒`);
      assert.ok(check.reason && check.reason.length > 0, '拒绝必须带可读原因');
    }
  });

  test('validateDisabledListForSettings：接受面（空数组 / 清单里的不规范名 / 恰 100 条）', () => {
    for (const value of [[], ['ok-name'], ['My_Skill'], Array(100).fill('a')]) {
      const check = aiSkills.validateDisabledListForSettings(value);
      assert.strictEqual(check.valid, true, `${JSON.stringify(value).slice(0, 60)} 必须通过`);
    }
    assert.strictEqual(aiSkills.MAX_DISABLED_SKILLS, 100, '条数上限 = MAX_USER_SKILLS + MAX_MANAGED_SKILLS = 50 + 50');
  });
});

// ==================== 服务端拒绝不经 handler（manager 层单源护栏） ====================

describe('服务端拒绝不经 handler：拒绝码必须取自闭合白名单（manager 层单源）', () => {
  /*
   * ROADMAP 判据 3 的「手改 URL 直接调端点也不例外」在**本例里表现为**：
   * 判据与拒绝码都住 manager 层，HTTP handler 与 IPC 只做转发（不改写 code）。
   * 若日后有人在 handler 层加「友善包装」并顺手改码，设置页按 code 查的文案表会全部失配。
   */

  test('deleteUserSkill 的三条拒绝路径都抛白名单内的码，且逐条取值确定', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    writeSkillDir(workspace.getManagedSkillsDir(), 'managed-guard');

    const captured = [];
    for (const call of [
      () => aiSkills.deleteUserSkill(env, { name: 'ghost-guard' }),
      () => aiSkills.deleteUserSkill(env, { name: 'managed-guard' }),
      () => aiSkills.deleteUserSkill(env, { name: '../escape' }),
    ]) {
      let caught = null;
      try {
        await call();
      } catch (err) {
        caught = err;
      }
      assert.ok(caught, '三条拒绝路径都必须抛出（不得返回错误对象）');
      captured.push(caught);
    }

    assert.deepStrictEqual(
      captured.map((e) => e.code),
      ['not_found', 'not_user_owned', 'invalid_name'],
      '拒绝码必须逐条确定且互不相同（三态不可混同 —— 参见 49-04 的失实文案教训）'
    );
    for (const err of captured) {
      assert.ok(
        Object.values(aiSkills.MANAGE_SKILL_ERROR).includes(err.code),
        `拒绝码 ${err.code} 必须取自闭合白名单（不得在 manager 之外新立码）`
      );
    }
  });

  test('validateSkillNameForManagement 的拒绝码恒为 invalid_name（不得折叠成 unknown）', () => {
    for (const value of ['', '   ', 'a'.repeat(65), 'a/b', 'a\\b', 'a\u0000b', 42, null, undefined]) {
      const check = aiSkills.validateSkillNameForManagement(value);
      assert.strictEqual(
        check.code,
        'invalid_name',
        `${JSON.stringify(value)} 的拒绝码必须是 invalid_name`
      );
      assert.notStrictEqual(
        check.code,
        'unknown',
        '不得折叠成沙箱层兜底码 —— 那会让「名字非法」与「磁盘故障」不可区分'
      );
    }
  });
});


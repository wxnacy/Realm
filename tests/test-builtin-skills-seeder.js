/**
 * builtin-skills-seeder 内置技能播种单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：端到端纵切（真实 skills-builtin/ → seedBuiltinSkills → 临时 managed-skills
 * → refreshSkills 零诊断识别 → 因 disable-model-invocation 不进 system prompt）、
 * 差异检测 IO fail-safe、源码不变式（导出面 / 惰性 electron require / 零硬编码 /
 * main.js 调用位序 / package.json asarUnpack 成对）。
 * 全部用例经 setWorkspaceDir/setBuiltinDepsForTest 注入临时目录，不触碰真实 userData。
 *
 * 用法: node tests/test-builtin-skills-seeder.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiSkills = require('../ai-skills-manager');
const seeder = require('../builtin-skills-seeder');

/** 仓库根目录 */
const REPO_ROOT = path.join(__dirname, '..');

/** 真实的随包内置技能源目录（端到端纵切必须用真源，不用合成目录） */
const REAL_BUILTIN_SRC = path.join(REPO_ROOT, 'skills-builtin');

/**
 * 零安装语义禁用模式表（逐字照抄 47-RESEARCH.md §A-4，不要重新设计正则）
 *
 * 扫描语义：任一行命中即判失败（第 1 段零容忍 / 第 2 段可经 EXEMPTIONS 豁免）。
 */
const FORBIDDEN_PATTERNS = [
  // —— 英文 CLI / 包管理器形态 ——
  { re: /\bnpx\b/i, why: 'npx 包执行器' },
  { re: /\bnpm\s+(i|install|ci|exec|add)\b/i, why: 'npm 安装/执行（含 npm exec 即时执行别名）' },
  { re: /\bpnpm\s+(add|install|dlx|exec)\b/i, why: 'pnpm 安装/执行' },
  { re: /\byarn\s+(add|install|dlx|exec)\b/i, why: 'yarn 安装/执行' },
  { re: /\bbun\s+(add|install|x)\b/i, why: 'bun 安装/执行' },
  { re: /\bpip3?\s+install\b/i, why: 'pip 安装' },
  { re: /\bpython3?\s+-m\s+pip\s+install\b/i, why: 'python -m pip 安装' },
  { re: /\buv\s+(pip\s+install|add|tool\s+install)\b/i, why: 'uv 安装' },
  { re: /\buvx\b/i, why: 'uv 包执行器（uvx）' },
  { re: /\bbrew\s+(install|upgrade|reinstall)\b/i, why: 'Homebrew 安装' },
  { re: /\bcargo\s+install\b/i, why: 'cargo 安装' },
  { re: /\bgo\s+install\b/i, why: 'go 安装' },
  { re: /\bgem\s+install\b/i, why: 'gem 安装' },
  { re: /curl[^\n|]*\|\s*(sh|bash|zsh|python3?|node)\b/i, why: '下载并管道执行（curl）' },
  { re: /wget[^\n|]*\|\s*(sh|bash|zsh|python3?|node)\b/i, why: '下载并管道执行（wget）' },
  { re: /\bapt(-get)?\s+install\b/i, why: 'apt 安装' },
  // —— 危险旗标（任何命令上下文里都禁止）——
  { re: /(^|\s)-y(\s|$)/, why: '无需确认旗标 -y' },
  { re: /--yes\b/, why: '无需确认旗标 --yes' },
  { re: /(^|\s)-g(\s|$)/, why: '全局位置旗标 -g' },
  { re: /--global\b/, why: '全局位置旗标 --global' },
  // —— 中文语义等价写法 ——
  { re: /安装到全局/, why: '全局安装（中文）' },
  { re: /下载并执行/, why: '下载并执行（中文）' },
  { re: /自动安装/, why: '自动安装（中文）' },
  { re: /执行安装命令/, why: '执行安装命令（中文）' },
  { re: /跳过确认/, why: '绕过确认（中文）' },
  { re: /装到系统/, why: '装到系统（中文）' },
];

/** 执行安装的祈使句（英文 + 中文，逐字照抄 §A-4） */
const INSTALL_IMPERATIVES = [
  { re: /\b(install|add|update)\s+(the\s+)?skill\b/i, why: '安装技能的祈使句' },
  { re: /\brun\s+the\s+following\s+command\b/i, why: '「运行以下命令」祈使句（英文）' },
  { re: /请执行以下命令/, why: '「请执行以下命令」祈使句（中文）' },
  { re: /运行以下命令/, why: '「运行以下命令」祈使句（中文）' },
];

/**
 * 行级豁免清单（只作用于**第 2 段**扫描，第 1 段零容忍、绝不消费本表）
 *
 * 三元组：`file`（相对仓库根的路径）+ `line`（匹配该行的正则）+ `why`（豁免理由，必须写死）。
 *
 * 已知必须豁免的例外（来源：47-RESEARCH.md §A-4「已知需要白名单豁免的例外」）：
 * - `skill-creator/scripts/check_env.mjs` 的 `installGuidance` 字段名与
 *   `Do not auto-install dependencies from this skill.` 文案：这是**禁止**安装的声明，
 *   命中 `install` 关键词但语义与之相反（D-05）。若做成无豁免全文扫描，扫描器会被
 *   一句「请勿自动安装」直接打爆。
 * - `skill-creator/SKILL.md` 的 `Package and Present` 段落引用 `package_skill.py`：
 *   `package` ≠ `install`，且该脚本生成 `.zip` 不安装任何东西。
 *   （注：`SKILL.md` 属第 1 段扫描面且实测 0 命中，此条仅作为 47-03 的备用登记。）
 *
 * 本计划（47-01）期 `skills-builtin/` 下只有 find-skills 的 `SKILL.md` + `LICENSE.txt`，
 * 均属第 1 段扫描面 → 第 2 段集合为空；这些条目待 47-03 落地对应文件后生效。
 */
const EXEMPTIONS = [
  {
    file: 'skills-builtin/skill-creator/scripts/check_env.mjs',
    line: /installGuidance|Do not auto-install dependencies from this skill\./,
    why: 'check_env.mjs 的 installGuidance 是「告知缺什么依赖、请用户确认后再装」的反向语义声明，且同段明确写 Do not auto-install —— 命中 install 关键词但语义相反（D-05）',
  },
  {
    file: 'skills-builtin/skill-creator/scripts/check_env.mjs',
    line: /missing_dependency/,
    why: 'missing_dependency 是「依赖缺失」的失败码常量名，不构成任何可执行的安装路径',
  },
];

/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-seeder-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    seeder.setBuiltinDepsForTest(null);
    seeder._resetForTest();
    // 模块级 _cache 跨用例污染会让后续「零诊断」断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  return dir;
}

/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/** 取函数体文本（从 `function <name>(` 到下一个行首 `}`） */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `源码中应存在 function ${name}(`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

/** 剥离注释后的源码（注释里允许出现代码中被禁的字样） */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** 递归收集目录下全部文件绝对路径 */
function collectFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(abs));
    else out.push(abs);
  }
  return out;
}

/** glob 式收集 skills-builtin 下指定 basename 的文件（扫描面的权威口径） */
function globBuiltinByBasename(basename) {
  return collectFiles(REAL_BUILTIN_SRC).filter((f) => path.basename(f) === basename);
}

/** 把一个目录树复制到目标（测试内造合成源用） */
function copyTree(src, dst) {
  fs.cpSync(src, dst, { recursive: true });
}

/**
 * 造一个只含 find-skills 的合成源目录
 *
 * 恒等于真实随包内容（真源复制），但落点可控 —— 后续用例要往里塞坏目录，
 * 不能动仓库里的 `skills-builtin/`。
 */
function makeSyntheticSrc(root) {
  const srcDir = path.join(root, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  copyTree(path.join(REAL_BUILTIN_SRC, 'find-skills'), path.join(srcDir, 'find-skills'));
  return srcDir;
}

/** 列出目录下残留的临时/备份目录（断言原子性用） */
function listResidue(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.includes('.tmp_') || n.includes('.bak_'));
}

/**
 * 第 1 段扫描面：`skills-builtin/**` 下**全部** `SKILL.md` 与 `LICENSE.txt`
 *
 * **必须按 glob 递归得到，不得写死单技能路径** —— 47-03 会新增 skill-creator 的
 * `SKILL.md` 与 `LICENSE.txt`，写死文件名会让新技能静默逃出扫描面。
 * 本段**零容忍、零豁免**（P1 门禁的字面判据）。
 */
function stage1Files() {
  return [
    ...globBuiltinByBasename('SKILL.md'),
    ...globBuiltinByBasename('LICENSE.txt'),
  ].sort();
}

/**
 * 第 2 段扫描面：`skills-builtin/**` 下**尚未被第 1 段覆盖的全部内容**
 *
 * **用排除法表达，而不是列举 `scripts/` + `resources/`** —— 列举法会漏掉
 * `agents/` / `assets/` / `eval-viewer/` / `references/` 四类目录（47-03 会落地）。
 * SEED-03 说的是「内置技能文本」，未限定文件类型。
 */
function stage2Files() {
  const covered = new Set(stage1Files());
  return collectFiles(REAL_BUILTIN_SRC).filter((f) => !covered.has(f)).sort();
}

/**
 * 逐行扫描一组文件，返回命中记录（含文件相对路径 + 行号 + 命中模式 + 理由）
 *
 * @param {string[]} files - 待扫描文件绝对路径
 * @param {Array<{re: RegExp, why: string}>} patterns - 禁用模式表
 * @param {Array<{file: string, line: RegExp, why: string}>} [exemptions] - 行级豁免清单
 */
function scanFiles(files, patterns, exemptions = []) {
  const hits = [];
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (exemptions.some((e) => e.file === rel && e.line.test(line))) return;
      for (const { re, why } of patterns) {
        if (re.test(line)) {
          hits.push({ file: rel, line: i + 1, pattern: re.source, why, text: line.trim() });
        }
      }
    });
  }
  return hits;
}

describe('端到端纵切（tracer）', () => {
  test('真实随包 skills-builtin → 播种 → managed-skills → 零诊断加载 → 不进 prompt', async (t) => {
    const root = withTempRoot(t);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir: REAL_BUILTIN_SRC, managedDir });

    seeder.seedBuiltinSkills();
    assert.deepStrictEqual(seeder.getSeedDiagnostics(), [], '首次播种应为零诊断');

    const seededSkill = path.join(managedDir, 'find-skills', 'SKILL.md');
    assert.ok(fs.existsSync(seededSkill), '播种后 managed-skills/find-skills/SKILL.md 应存在');
    assert.strictEqual(
      fs.readFileSync(seededSkill, 'utf8'),
      fs.readFileSync(path.join(REAL_BUILTIN_SRC, 'find-skills', 'SKILL.md'), 'utf8'),
      '播种产物应与随包源逐字节相同'
    );
    assert.ok(
      fs.existsSync(path.join(managedDir, 'find-skills', 'LICENSE.txt')),
      '播种是整目录复制，LICENSE.txt 应随之落盘'
    );

    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const snapshot = aiSkills.getSkillsSnapshot();
    const entry = snapshot.skills.find((e) => e.skill.name === 'find-skills');
    assert.ok(entry, '技能加载器应零诊断识别 find-skills');
    assert.strictEqual(entry.source, 'managed', 'seeded 技能来源应为 managed');
    assert.deepStrictEqual(snapshot.diagnostics, [], '加载应零诊断');
    assert.deepStrictEqual(snapshot.errors, [], '加载应零错误');
    assert.strictEqual(
      aiSkills.buildSkillsPrompt(),
      '',
      'disable-model-invocation: true → 该技能不进 system prompt（SEED-04 机械证据）'
    );
  });

  test('随包源缺失 → realm_builtin_src_missing 且不 throw（不阻断启动）', (t) => {
    const root = withTempRoot(t);
    seeder.setBuiltinDepsForTest({
      srcDir: path.join(root, 'no-such-builtin-src'),
      managedDir: path.join(root, 'managed-skills'),
    });
    assert.doesNotThrow(() => seeder.seedBuiltinSkills(), '源缺失不得 throw');
    const diags = seeder.getSeedDiagnostics();
    const hit = diags.find((d) => d.code === 'realm_builtin_src_missing');
    assert.ok(hit, '应产 realm_builtin_src_missing');
    assert.strictEqual(hit.level, 'error');
  });

  test('seeded 身份 = 随包目录名集合（只认含 SKILL.md 的目录，零状态文件）', (t) => {
    const root = withTempRoot(t);
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(path.join(srcDir, 'has-skill'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'has-skill', 'SKILL.md'), '---\nname: has-skill\n---\n');
    fs.mkdirSync(path.join(srcDir, 'no-skill'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'no-skill', 'README.md'), 'x');
    fs.mkdirSync(path.join(srcDir, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, '.hidden', 'SKILL.md'), '---\nname: x\n---\n');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir: path.join(root, 'managed-skills') });
    assert.deepStrictEqual(seeder.getSeededSkillNames(), ['has-skill']);
  });
});

describe('差异检测 IO fail-safe（D-09 / 评审裁决项）', () => {
  test('不可读文件 → detectDiff 返回 different 且不抛错', (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'src');
    const dst = path.join(root, 'dst');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(dst, { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'same-content');
    fs.writeFileSync(path.join(dst, 'a.txt'), 'same-content');

    const victim = path.join(src, 'a.txt');
    fs.chmodSync(victim, 0o000);
    try {
      assert.doesNotThrow(() => {
        const verdict = seeder.detectDiff(src, dst);
        assert.strictEqual(verdict, 'different', 'IO 错误应 fail-safe 判 different（按需重同步）');
      }, 'detectDiff 遇 IO 错误不得抛错');
    } finally {
      fs.chmodSync(victim, 0o644);
    }
  });

  test('目标不存在 → missing；内容全同 → same；内容不同 → different', (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'src');
    const dst = path.join(root, 'dst');
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'A');
    fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'B');

    assert.strictEqual(seeder.detectDiff(src, dst), 'missing');

    copyTree(src, dst);
    assert.strictEqual(seeder.detectDiff(src, dst), 'same');

    fs.writeFileSync(path.join(dst, 'a.txt'), 'A-changed');
    assert.strictEqual(seeder.detectDiff(src, dst), 'different');

    fs.writeFileSync(path.join(dst, 'a.txt'), 'A');
    fs.rmSync(path.join(dst, 'sub', 'b.txt'));
    assert.strictEqual(seeder.detectDiff(src, dst), 'different', '文件缺失应判 different');
  });
});

describe('源码不变式（导出面 / 惰性 electron require / 零硬编码）', () => {
  test('5 个内部函数齐备，module.exports 含全部 6 个公开导出', () => {
    const src = readSource('builtin-skills-seeder.js');
    for (const fn of [
      'seedBuiltinSkills',
      'resolveBuiltinSkillsSrc',
      'getSeededSkillNames',
      'safeCopyDir',
      'detectDiff',
    ]) {
      assert.ok(src.includes(`function ${fn}(`), `源码中应存在 function ${fn}(`);
    }
    const exportsBlock = src.slice(src.indexOf('module.exports = {'));
    for (const name of [
      'seedBuiltinSkills',
      'resolveBuiltinSkillsSrc',
      'getSeededSkillNames',
      'getSeedDiagnostics',
      'setBuiltinDepsForTest',
      '_resetForTest',
    ]) {
      assert.ok(exportsBlock.includes(name), `module.exports 应含 ${name}`);
    }
  });

  test('detectDiff 带 IO fail-safe 分支，并有「为什么不用 mtime」的注释', () => {
    const body = functionBody(readSource('builtin-skills-seeder.js'), 'detectDiff');
    assert.ok(body.includes("return 'different'"), 'IO 错误分支应返回 different');
    assert.ok(body.includes('safeCopyDir'), '注释应点名 safeCopyDir（覆盖会重写 mtime 的成因）');
    assert.ok(body.includes('mtime'), '注释应说明为什么不用 mtime');
  });

  test('safeCopyDir 带源目录存在性提前返回分支', () => {
    const body = functionBody(readSource('builtin-skills-seeder.js'), 'safeCopyDir');
    assert.ok(body.includes('fs.existsSync(src)'), 'safeCopyDir 应有源存在性检查');
  });

  test('setBuiltinDepsForTest 的注释写明注入器覆盖的是两个函数返回值', () => {
    const src = readSource('builtin-skills-seeder.js');
    const idx = src.indexOf('function setBuiltinDepsForTest(');
    assert.ok(idx > 0);
    const doc = src.slice(Math.max(0, idx - 1500), idx);
    assert.ok(doc.includes('resolveBuiltinSkillsSrc()'), '注释应写明 srcDir 覆盖 resolveBuiltinSkillsSrc()');
    assert.ok(doc.includes('getManagedSkillsDir()'), '注释应写明 managedDir 覆盖 getManagedSkillsDir()');
  });

  test('resolveBuiltinSkillsSrc 三条路径不变式齐备，且 electron require 不在模块顶层', () => {
    const src = readSource('builtin-skills-seeder.js');
    const body = functionBody(src, 'resolveBuiltinSkillsSrc');
    assert.ok(body.includes('app.isPackaged'), '应含打包态判定');
    assert.ok(body.includes('process.resourcesPath'), '应含 resourcesPath 路径分支');
    assert.ok(body.includes('__dirname'), '应含开发态 __dirname 回落');

    const matches = [...src.matchAll(/require\('electron'\)/g)];
    assert.strictEqual(matches.length, 1, "require('electron') 只应出现一次（模块顶层禁止）");
    const lineNo = src.slice(0, matches[0].index).split('\n').length;
    assert.ok(lineNo > 20, `require('electron') 应在文件头 20 行之后（实际第 ${lineNo} 行）`);
  });

  test('零硬编码：builtin-skills-seeder.js 不出现任何内置技能名字面量', () => {
    const stripped = stripComments(readSource('builtin-skills-seeder.js'));
    assert.ok(!stripped.includes("'find-skills'"), '不得硬编码 find-skills');
    assert.ok(!stripped.includes('"find-skills"'), '不得硬编码 find-skills');
    assert.ok(!stripped.includes("'skill-creator'"), '不得硬编码 skill-creator');
    assert.ok(!stripped.includes('"skill-creator"'), '不得硬编码 skill-creator');
  });

  test('package.json 的 build.asarUnpack 两侧成对（nodejieba 保留 + skills-builtin 新增）', () => {
    const pkg = JSON.parse(readSource('package.json'));
    assert.ok(Array.isArray(pkg.build.asarUnpack));
    assert.ok(pkg.build.asarUnpack.includes('node_modules/nodejieba/**'), '既有条目不得被删');
    assert.ok(pkg.build.asarUnpack.includes('skills-builtin/**'), '应新增 skills-builtin/**');
  });

  test('main.js 中播种调用位于 migrateAiMemory() 之后、new AIManager() 之前', () => {
    const src = readSource('main.js');
    const iMigrate = src.indexOf('agentWorkspace.migrateAiMemory()');
    const iSeed = src.indexOf('builtinSkillsSeeder.seedBuiltinSkills()');
    const iNewAI = src.indexOf('new AIManager()');
    assert.ok(iMigrate > 0, 'main.js 应含 migrateAiMemory()');
    assert.ok(iSeed > 0, 'main.js 应含 seedBuiltinSkills()');
    assert.ok(iNewAI > 0, 'main.js 应含 new AIManager()');
    assert.ok(iMigrate < iSeed, '播种必须在 migrateAiMemory() 之后');
    assert.ok(iSeed < iNewAI, '播种必须在 new AIManager() 之前（否则首轮 refreshSkills 看不到）');
  });

  test('find-skills/SKILL.md 含 disable-model-invocation 且禁令段在正文最前', () => {
    const md = fs.readFileSync(path.join(REAL_BUILTIN_SRC, 'find-skills', 'SKILL.md'), 'utf8');
    assert.ok(md.includes('disable-model-invocation: true'), 'SEED-04 强制字段');
    assert.ok(md.includes('绝不执行任何安装'), '首段禁令必须显式写明「绝不执行任何安装」');
    const boundaryIdx = md.indexOf('绝不执行任何安装');
    const firstH2 = md.search(/^## /m);
    assert.ok(boundaryIdx > firstH2 && boundaryIdx < md.indexOf('\n## ', firstH2 + 1), '禁令段应是最靠前的章节');
  });
});

describe('播种原子性与差异诊断（SEED-02 / D-08 / D-09 / D-10）', () => {
  test('幂等：连续两次播种，第二次零差异零诊断，产物字节不变', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });

    seeder.seedBuiltinSkills();
    assert.deepStrictEqual(seeder.getSeedDiagnostics(), [], '首次播种（missing）应零诊断');
    const target = path.join(managedDir, 'find-skills', 'SKILL.md');
    const before = fs.readFileSync(target, 'utf8');

    seeder.seedBuiltinSkills();
    const second = seeder.getSeedDiagnostics();
    assert.ok(
      !second.some((d) => d.code === 'realm_builtin_seed_overwritten'),
      'detectDiff === same → 重启不重复写、不得产 realm_builtin_seed_overwritten'
    );
    assert.strictEqual(fs.readFileSync(target, 'utf8'), before, '产物字节不得变化');
  });

  test('不静默覆盖：手改后重跑 → warning 诊断「且」目标被覆盖为随包版本', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });

    seeder.seedBuiltinSkills();
    const target = path.join(managedDir, 'find-skills', 'SKILL.md');
    fs.writeFileSync(target, '---\nname: find-skills\ndescription: 被手改过\n---\n\n手改正文\n');

    seeder.seedBuiltinSkills();
    const hit = seeder.getSeedDiagnostics().find((d) => d.code === 'realm_builtin_seed_overwritten');
    assert.ok(hit, 'D-09：手改后必须产 realm_builtin_seed_overwritten');
    assert.strictEqual(hit.level, 'warning', 'D-09：覆盖诊断是 warning 不是 error');
    assert.strictEqual(hit.skillName, 'find-skills');
    assert.ok(hit.message.includes('已被随包版本覆盖'), 'message 必须说明已被覆盖');
    assert.ok(hit.message.includes('禁用'), 'warning 必须给出正确做法（停用走设置页）');
    assert.strictEqual(
      fs.readFileSync(target, 'utf8'),
      fs.readFileSync(path.join(srcDir, 'find-skills', 'SKILL.md'), 'utf8'),
      '诊断与覆盖同时发生（D-09 与 O4 的分野：不静默，但不阻断覆盖）'
    );
  });

  test('自愈重播：手删目录后重跑 → 目录重现且不产覆盖诊断（missing 语义）', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });

    seeder.seedBuiltinSkills();
    fs.rmSync(path.join(managedDir, 'find-skills'), { recursive: true, force: true });
    assert.ok(!fs.existsSync(path.join(managedDir, 'find-skills')));

    seeder.seedBuiltinSkills();
    const target = path.join(managedDir, 'find-skills', 'SKILL.md');
    assert.ok(fs.existsSync(target), 'D-10：手删后下次播种应自愈重播');
    assert.strictEqual(
      fs.readFileSync(target, 'utf8'),
      fs.readFileSync(path.join(srcDir, 'find-skills', 'SKILL.md'), 'utf8')
    );
    assert.ok(
      !seeder.getSeedDiagnostics().some((d) => d.code === 'realm_builtin_seed_overwritten'),
      "detectDiff === missing 是「本来就没有」，不算「覆盖了用户的修改」，不得产该诊断"
    );
  });

  test('原子性：safeCopyDir 失败不留半成品，也不残留 .tmp_* / .bak_*', (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), 'new-content');

    // 场景 A：dst 已存在且完整 → 失败后必须仍是旧的完整技能（不是半成品）
    const roParent = path.join(root, 'ro-existing');
    const dstA = path.join(roParent, 'skill-a');
    fs.mkdirSync(dstA, { recursive: true });
    fs.writeFileSync(path.join(dstA, 'SKILL.md'), 'old-content');
    fs.chmodSync(roParent, 0o555);
    try {
      assert.throws(() => seeder.safeCopyDir(src, dstA), '只读父目录下替换必须失败');
    } finally {
      fs.chmodSync(roParent, 0o755);
    }
    assert.strictEqual(
      fs.readFileSync(path.join(dstA, 'SKILL.md'), 'utf8'),
      'old-content',
      '失败后目标必须保持旧的完整内容（不留半成品）'
    );
    assert.deepStrictEqual(listResidue(roParent), [], '不得残留 .tmp_* / .bak_*');

    // 场景 B：dst 不存在 → 失败后必须仍然不存在（不是「有目录但缺 SKILL.md」）
    const roParent2 = path.join(root, 'ro-missing');
    fs.mkdirSync(roParent2, { recursive: true });
    const dstB = path.join(roParent2, 'skill-b');
    fs.chmodSync(roParent2, 0o555);
    try {
      assert.throws(() => seeder.safeCopyDir(src, dstB), '只读父目录下新建必须失败');
    } finally {
      fs.chmodSync(roParent2, 0o755);
    }
    assert.ok(!fs.existsSync(dstB), '失败后目标目录不得存在');
    assert.deepStrictEqual(listResidue(roParent2), [], '不得残留 .tmp_* / .bak_*');
  });

  test('symlink fail-closed：含 symlink 的技能被跳过并产 seed_failed，同批其余技能照常播种', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const evil = path.join(srcDir, 'evil-skill');
    fs.mkdirSync(evil, { recursive: true });
    fs.writeFileSync(path.join(evil, 'SKILL.md'), '---\nname: evil-skill\ndescription: x\n---\n');
    fs.symlinkSync('/etc/hosts', path.join(evil, 'leak.txt'));

    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });
    assert.doesNotThrow(() => seeder.seedBuiltinSkills(), 'symlink 不得让播种整体抛出');

    const diags = seeder.getSeedDiagnostics();
    assert.ok(
      diags.some((d) => d.code === 'realm_builtin_seed_failed' && d.skillName === 'evil-skill'),
      '含 symlink 的技能应产 realm_builtin_seed_failed'
    );
    assert.ok(!fs.existsSync(path.join(managedDir, 'evil-skill')), '含 symlink 的技能不得落盘');
    assert.ok(
      fs.existsSync(path.join(managedDir, 'find-skills', 'SKILL.md')),
      '同批其余技能仍应正常播种（单技能失败不 abort）'
    );
  });

  test('realm_builtin_src_invalid 真实触发：缺 SKILL.md 的源子目录 → error 诊断且不阻断其余技能', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const broken = path.join(srcDir, 'broken-skill');
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, 'README.md'), 'this dir has no SKILL.md');

    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });
    seeder.seedBuiltinSkills();

    const hit = seeder.getSeedDiagnostics().find((d) => d.code === 'realm_builtin_src_invalid');
    assert.ok(hit, '评审裁决项 1：该 code 必须真实可达（独立源目录扫描先于过滤）');
    assert.strictEqual(hit.level, 'error');
    assert.strictEqual(hit.path, broken, 'path 应指向缺 SKILL.md 的那个源子目录');
    assert.ok(
      fs.existsSync(path.join(managedDir, 'find-skills', 'SKILL.md')),
      '该诊断不得阻断同批合法技能的播种'
    );
  });
});

describe('诊断 code 与源码不变式（Task 2）', () => {
  test('4 个诊断 code 齐备，realm_builtin_seed_overwritten 的 level 是 warning', () => {
    const src = readSource('builtin-skills-seeder.js');
    for (const code of [
      'realm_builtin_src_missing',
      'realm_builtin_seed_overwritten',
      'realm_builtin_seed_failed',
      'realm_builtin_src_invalid',
    ]) {
      assert.ok(src.includes(code), `源码应含诊断 code ${code}`);
    }
    const idx = src.indexOf("code: 'realm_builtin_seed_overwritten'");
    assert.ok(idx > 0);
    const block = src.slice(Math.max(0, idx - 200), idx);
    assert.ok(block.includes("level: 'warning'"), '覆盖诊断必须是 warning（不得升级为 error）');
  });

  test('剥离注释后不出现 mtime / mtimeMs / birthtime（D-09 机械不变式）', () => {
    const stripped = stripComments(readSource('builtin-skills-seeder.js'));
    for (const token of ['mtime', 'mtimeMs', 'birthtime']) {
      assert.ok(
        !stripped.includes(token),
        `代码行不得出现 ${token}（每次启动都覆盖 → mtime 必变 → 100% 误报）；该字样只能出现在说明性注释里`
      );
    }
  });

  test('safeCopyDir 的 tmp/bak 基于 dst 派生（同父目录 → 同卷），不用 os.tmpdir()', () => {
    const body = functionBody(readSource('builtin-skills-seeder.js'), 'safeCopyDir');
    assert.ok(body.includes('.tmp_'), '应含 .tmp_ 命名');
    assert.ok(body.includes('.bak_'), '应含 .bak_ 命名');
    assert.ok(body.includes('${dst}.tmp_'), 'tmp 必须由 dst 派生（同父目录 / 同卷）');
    assert.ok(body.includes('${dst}.bak_'), 'bak 必须由 dst 派生');
    assert.ok(!body.includes('tmpdir('), '不得使用 os.tmpdir()（macOS 可能异卷 → EXDEV）');
  });

  test('ROADMAP §Phase 47 成功判据 1 已改写为 D-08/D-09/D-10/D-11 语义', () => {
    const roadmap = readSource('.planning/ROADMAP.md');
    const start = roadmap.indexOf('### Phase 47:');
    const end = roadmap.indexOf('### Phase 48:');
    assert.ok(start > 0, 'ROADMAP 应含 §Phase 47');
    assert.ok(end > start, 'ROADMAP 应含 §Phase 48（用于截取段落边界）');
    const section = roadmap.slice(start, end);
    assert.ok(!section.includes('版本戳登记表'), '不得再出现「版本戳登记表」（O4 已被 D-08 取代）');
    assert.ok(section.includes('realm_builtin_seed_overwritten'), '判据应点名覆盖诊断 code');
    assert.ok(section.includes('settings.aiSkills.disabled'), '判据应指名停用语义的唯一存储键');
    assert.ok(section.includes('无条件覆盖'), '判据应写明无条件覆盖语义');
  });
});

describe('零安装语义扫描（SEED-03 / P1 门禁字面判据）', () => {
  test('第 1 段（零容忍无豁免）：SKILL.md + LICENSE.txt 全量零命中', () => {
    const files = stage1Files();
    assert.ok(files.length >= 2, `至少应扫到 find-skills 的两份受扫文件（实际 ${files.length}）`);
    const hits = scanFiles(files, FORBIDDEN_PATTERNS.concat(INSTALL_IMPERATIVES));
    if (hits.length > 0) {
      assert.fail(
        '零安装语义扫描命中（P1 门禁失守）：\n'
        + hits.map((h) => `  ${h.file}:${h.line} [${h.why}] /${h.pattern}/ → ${h.text}`).join('\n')
      );
    }
  });

  test('扫描范围按 glob 递归（写死单技能路径会让 47-03 的新技能静默逃出扫描面）', () => {
    const src = readSource('tests/test-builtin-skills-seeder.js');
    assert.ok(
      !functionBody(src, 'globBuiltinByBasename').includes('find-skills'),
      '扫描面枚举不得写死任何技能名'
    );
    const stage1Body = functionBody(src, 'stage1Files');
    assert.ok(!stage1Body.includes('find-skills'), 'stage1Files 不得写死单技能路径');
    assert.ok(stage1Body.includes("globBuiltinByBasename('SKILL.md')"), '应按 SKILL.md basename 递归收集');
    assert.ok(stage1Body.includes("globBuiltinByBasename('LICENSE.txt')"), '应按 LICENSE.txt basename 递归收集');

    const expected = collectFiles(REAL_BUILTIN_SRC)
      .filter((f) => ['SKILL.md', 'LICENSE.txt'].includes(path.basename(f)))
      .sort();
    assert.deepStrictEqual(stage1Files(), expected, '实际扫描文件数必须等于 glob 命中数');
  });

  test('PITFALLS P1 靶心：skills-builtin/** 内不存在 `npx skills` 的任意变体', () => {
    const variant = /\bnpx\s+skills\b/i;
    const hits = [];
    for (const file of collectFiles(REAL_BUILTIN_SRC)) {
      const rel = path.relative(REPO_ROOT, file);
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (variant.test(line)) hits.push(`${rel}:${i + 1}`);
      });
    }
    assert.deepStrictEqual(hits, [], '`npx skills` 的任意变体（大小写 / 任意空白）都不得出现');
  });

  test('评审补齐项：npm 家族模式覆盖 npm exec（防止正则被「精简」掉）', () => {
    const npmPattern = FORBIDDEN_PATTERNS.find((p) => p.why.includes('npm'));
    assert.ok(npmPattern, 'FORBIDDEN_PATTERNS 应含 npm 家族模式');
    for (const sample of ['npm exec x', 'npm i x', 'npm install x', 'npm ci', 'npm add x']) {
      assert.strictEqual(npmPattern.re.test(sample), true, `npm 家族模式应覆盖: ${sample}`);
    }
  });

  test('第 2 段（带行级豁免）扫描器就位：排除法覆盖第 1 段之外的全部内容', () => {
    const files = stage2Files();
    assert.deepStrictEqual(
      files,
      [],
      '本计划期 skills-builtin/ 只有 find-skills 的 SKILL.md + LICENSE.txt（均属第 1 段）→ 第 2 段集合为空'
    );
    assert.deepStrictEqual(scanFiles(files, FORBIDDEN_PATTERNS, EXEMPTIONS), []);

    assert.ok(EXEMPTIONS.length > 0, '豁免清单必须是非空表（47-03 的 check_env.mjs 反向语义条目已预登记）');
    for (const e of EXEMPTIONS) {
      assert.ok(typeof e.file === 'string' && e.file.length > 0, '豁免条目必须带文件相对路径');
      assert.ok(e.line instanceof RegExp, '豁免条目必须带行匹配正则');
      assert.ok(typeof e.why === 'string' && e.why.length > 0, '每条豁免必须写死豁免理由');
    }

    // 豁免清单不得削弱第 1 段：任何豁免条目的文件都不在第 1 段扫描面内
    const stage1Rel = new Set(stage1Files().map((f) => path.relative(REPO_ROOT, f)));
    for (const e of EXEMPTIONS) {
      assert.ok(!stage1Rel.has(e.file), `豁免条目 ${e.file} 不得落在第 1 段（零容忍）扫描面内`);
    }
  });
});

describe('门禁断言（SEED-04 / D-11 / SKILL-09 反向证据）', () => {
  test('SEED-04：每个内置技能 frontmatter 含 disable-model-invocation: true 且 description 含中文', () => {
    const skillMds = globBuiltinByBasename('SKILL.md');
    assert.ok(skillMds.length >= 1, '至少应有一个内置技能 SKILL.md');
    for (const file of skillMds) {
      const rel = path.relative(REPO_ROOT, file);
      const content = fs.readFileSync(file, 'utf8');
      assert.ok(
        /^disable-model-invocation:\s*true\s*$/m.test(content),
        `${rel} 的 frontmatter 应含 disable-model-invocation: true（不进 system prompt）`
      );
      const descMatch = content.match(/^description:\s*(.+)$/m);
      assert.ok(descMatch, `${rel} 应有 description`);
      assert.ok(
        /[\u4e00-\u9fff]/.test(descMatch[1]),
        `${rel} 的 description 应含至少一个 CJK 字符（D-04：面向 / 面板与设置页的人眼可读性）`
      );
    }
  });

  test('禁令段不含任何被扫 token（写禁令段时手滑引用命令名会在此定位）', () => {
    const md = fs.readFileSync(path.join(REAL_BUILTIN_SRC, 'find-skills', 'SKILL.md'), 'utf8');
    for (const token of ['npx', 'npm exec', '--global', '--yes']) {
      assert.ok(!md.includes(token), `SKILL.md 不得出现字面 token: ${token}`);
    }
    for (const re of [/(^|\s)-g(\s|$)/m, /(^|\s)-y(\s|$)/m]) {
      assert.ok(!re.test(md), `SKILL.md 不得出现危险旗标: /${re.source}/`);
    }
  });

  test('D-11 零硬编码：播种模块剥离注释后不含内置技能名字面量', () => {
    const stripped = stripComments(readSource('builtin-skills-seeder.js'));
    for (const name of ['find-skills', 'skill-creator']) {
      assert.ok(!stripped.includes(`'${name}'`), `builtin-skills-seeder.js 不得硬编码 '${name}'`);
      assert.ok(!stripped.includes(`"${name}"`), `builtin-skills-seeder.js 不得硬编码 "${name}"`);
    }
  });

  test('SKILL-09 反向证据：技能脚本经既有 bash 工具执行，零新增权限机制', () => {
    const policy = require('../ai-bash-policy');
    assert.ok(policy.DANGEROUS_INTERPRETERS.has('node'), 'node 仍须在 DANGEROUS_INTERPRETERS 内');
    assert.ok(policy.DANGEROUS_INTERPRETERS.has('python3'), 'python3 仍须在 DANGEROUS_INTERPRETERS 内');
  });
});

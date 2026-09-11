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

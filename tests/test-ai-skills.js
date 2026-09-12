/**
 * ai-skills-manager 技能基础设施单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：端到端纵切（skills/<name>/SKILL.md → refreshSkills → buildSystemPrompt
 * 第 4 段 → 沙箱 read 正文）、技能目录与沙箱可达（SKILL-01）、prompt 段注入
 * 契约与空态（SKILL-02）、模块级缓存与同步访问器（SKILL-03）、加载面收窄
 * 回归守卫（反黑屏 / 反幽灵）、依赖纪律源码扫描。
 * 全部用例经 setWorkspaceDir/setBaseDir 注入临时目录，不触碰真实 userData。
 *
 * 用法: node tests/test-ai-skills.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');
const aiSkills = require('../ai-skills-manager');
const aiManager = require('../ai-manager');
const seeder = require('../builtin-skills-seeder');
const skillPickerModel = require('../src/skill-picker-model');

/** 仓库根目录（源码扫描 / 真实随包目录用） */
const REPO_ROOT = path.join(__dirname, '..');

/** 真实的随包内置技能源目录（seeded 注入用；不依赖其内容，只作 srcDir 覆写） */
const REAL_BUILTIN_SRC = path.join(REPO_ROOT, 'skills-builtin');

/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skills-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
    // 模块级 _cache 跨用例污染会让后续「空技能集」断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  aiMemoryManager.setBaseDir(dir);
  return dir;
}

/** 写入一个契约布局技能：<scannedDir>/<name>/SKILL.md */
function writeSkill(scannedDir, name, { description = `${name} 技能描述`, body = `# ${name}\n\n正文内容\n` } = {}) {
  const dir = path.join(scannedDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);
  return file;
}

/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

/** 取函数体文本（从 `function <name>(` 到下一个行首 `}`） */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `源码中应存在 function ${name}(`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

/**
 * 取类方法体文本（支持 `async <name>(` / `function <name>(` / 两空格缩进的 `<name>(`）
 *
 * 与 functionBody 的区别：类方法以两空格缩进的 `}` 收尾，且多数是 `async`。
 */
function methodBody(source, name) {
  let start = source.indexOf(`async ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`\n  ${name}(`);
  assert.ok(start >= 0, `源码中应存在方法 ${name}(`);
  const end = source.indexOf('\n  }', start);
  return source.slice(start, end);
}

describe('端到端纵切（tracer）', () => {
  test('建 skills/alpha/SKILL.md → refreshSkills → buildSystemPrompt 含技能段 → 沙箱可 read 正文', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha');

    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const prompt = aiManager.buildSystemPrompt();
    assert.ok(prompt.includes('available_skills'), 'system prompt 应含技能段');
    assert.ok(prompt.includes('<location>'), 'system prompt 应含技能 location');

    const snapshot = aiSkills.getSkillsSnapshot();
    const entry = snapshot.skills.find((e) => e.skill.name === 'alpha');
    assert.ok(entry, '技能 alpha 应被加载进缓存');
    assert.strictEqual(entry.source, 'user', 'skills/ 下的技能 source 应为 user');

    const read = await env.readTextFile(entry.skill.filePath);
    assert.strictEqual(read.ok, true, `沙箱应能读到技能正文: ${entry.skill.filePath}`);
    assert.ok(read.value.includes('正文内容'), '读到的是 SKILL.md 正文');
  });

  test('技能集为空时 buildSystemPrompt 不含技能段', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });
    assert.strictEqual(aiManager.buildSystemPrompt().includes('available_skills'), false);
  });
});

describe('加载面收窄（回归守卫）', () => {
  test('反黑屏：根层 SKILL.md 存在时 skills/<name>/SKILL.md 仍被加载', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const rootDirs = [workspace.getManagedSkillsDir(), workspace.getSkillsDir()];

    writeSkill(workspace.getSkillsDir(), 'alpha');
    await aiSkills.refreshSkills(env, { rootDirs });
    assert.ok(
      aiSkills.getSkillsSnapshot().skills.some((e) => e.skill.name === 'alpha'),
      '前置：alpha 应已被加载'
    );

    // 根层放一个 SKILL.md —— SDK 原生行为会短路整组、只返回根层那一个
    fs.writeFileSync(
      path.join(workspace.getSkillsDir(), 'SKILL.md'),
      '---\nname: rooty\ndescription: 根层误放的技能\n---\n\n# rooty\n'
    );
    await aiSkills.refreshSkills(env, { rootDirs });

    const snap = aiSkills.getSkillsSnapshot();
    assert.ok(snap.skills.some((e) => e.skill.name === 'alpha'), '根层 SKILL.md 不应顶替整组');
    assert.strictEqual(
      snap.skills.some((e) => e.skill.name === 'rooty'), false,
      '根层 SKILL.md 不应被当作技能加载'
    );
    assert.ok(
      snap.diagnostics.some((d) => d.code === 'realm_root_entry_skipped'),
      '根层被滤掉的 entry 必须产诊断（禁止静默）'
    );
  });

  test('反幽灵：根层 README.md（带 description、无 name）不产生 name === 目录名的技能', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    // 无 name → SDK 会回落 name = parentDirName（即扫描根目录名 'skills'）
    fs.writeFileSync(
      path.join(workspace.getSkillsDir(), 'README.md'),
      '---\ndescription: 随目录散落的说明文件\n---\n\n# readme\n'
    );
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(
      snap.skills.some((e) => e.skill.name === 'skills'), false,
      '根层散落 md 不应变成 name = 扫描根目录名的幽灵技能'
    );
    assert.ok(
      snap.diagnostics.some((d) => d.code === 'realm_root_entry_skipped'),
      '根层被滤掉的 entry 必须产诊断（禁止静默）'
    );
  });

  test('超大 SKILL.md 在 YAML 解析前被拒（read_failed 而非 parse_failed）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const max = aiSkills.LIMITS.MAX_SKILL_MD_BYTES;

    const dir = path.join(workspace.getSkillsDir(), 'huge');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, `---\nname: huge\ndescription: 超大技能\n---\n\n${'x'.repeat(max + 1)}`);
    const size = fs.statSync(file).size;
    assert.ok(size > max, `前置：文件应超过 ${max} 字节`);

    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(
      snap.skills.some((e) => e.skill.name === 'huge'), false,
      '超限技能不应被加载'
    );
    const readFailed = snap.diagnostics.find(
      (d) => d.code === 'read_failed' && String(d.path).endsWith('SKILL.md')
    );
    assert.ok(readFailed, '应有 read_failed 诊断（预筛拒绝）');
    assert.ok(readFailed.message.includes(String(max)), `诊断须含限额值 ${max}`);
    assert.ok(readFailed.message.includes(String(size)), `诊断须含当前字节数 ${size}`);
    assert.strictEqual(
      snap.diagnostics.some((d) => d.code === 'parse_failed'), false,
      '不应进入 YAML 解析（解析前已拒绝）'
    );
  });

  test('收窄只作用于两个扫描根：技能目录内部的枚举不受影响', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkill(workspace.getSkillsDir(), 'alpha');
    const refDir = path.join(workspace.getSkillsDir(), 'alpha', 'references');
    fs.mkdirSync(refDir, { recursive: true });
    fs.writeFileSync(path.join(refDir, 'notes.md'), '参考内容');
    fs.writeFileSync(path.join(workspace.getSkillsDir(), 'alpha', 'HELP.md'), '技能内部帮助文件');

    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const snap = aiSkills.getSkillsSnapshot();
    assert.ok(snap.skills.some((e) => e.skill.name === 'alpha'), 'alpha 应被加载');
    const narrowed = snap.diagnostics.filter((d) => d.code === 'realm_root_entry_skipped');
    assert.strictEqual(
      narrowed.length, 0,
      `非扫描根路径不得被收窄（技能内部文件枚举原样返回），实际收窄 ${narrowed.length} 项`
    );
    // 技能自带资源仍可经沙箱 read
    const read = await env.readTextFile(path.join(refDir, 'notes.md'));
    assert.strictEqual(read.ok, true, '技能自带 references/ 仍可读');
  });
});

/** 在任意布局路径写一个技能文件（供深嵌套 / 冒名 / 同名遮蔽用例使用） */
function writeSkillAt(filePath, { name, description = '技能描述', body = '# skill\n\n正文内容\n' }) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);
  return filePath;
}

/** 两个扫描根（managed 先、user 后 —— 顺序即遮蔽判定依据 D-06） */
function scanRoots() {
  return [workspace.getManagedSkillsDir(), workspace.getSkillsDir()];
}

describe('契约布局过滤（SKILL-06）', () => {
  test('反深嵌套：skills/a/b/SKILL.md 被跳过，诊断同时给出实际路径与目标布局建议', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    const deepFile = writeSkillAt(path.join(workspace.getSkillsDir(), 'a', 'b', 'SKILL.md'), {
      name: 'b',
      description: '深嵌套技能',
    });
    writeSkill(workspace.getSkillsDir(), 'alpha'); // 同批次里的契约布局技能（不误伤）

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(
      snap.skills.some((e) => e.skill.name === 'b'), false,
      '深嵌套技能（相对深度 3）不应进集合'
    );
    assert.ok(
      snap.skills.some((e) => e.skill.name === 'alpha'),
      '同批次的契约布局技能不受影响'
    );

    const diag = snap.diagnostics.find((d) => d.code === 'realm_layout_violation');
    assert.ok(diag, '被跳过的深嵌套技能必须产 realm_layout_violation 诊断（禁止静默）');
    assert.strictEqual(diag.level, 'warning', '属 D-05 第 1 层「正常态跳过」');
    assert.strictEqual(diag.path, deepFile, '诊断应指向实际文件路径');
    assert.ok(diag.message.includes(deepFile), '诊断 message 须含实际路径');
    assert.ok(
      diag.message.includes(path.join(workspace.getSkillsDir(), 'b', 'SKILL.md')),
      '诊断 message 须含正确的目标路径建议（<扫描根>/<技能名>/SKILL.md）'
    );
  });

  test('契约布局（<dir>/<name>/SKILL.md）的技能一个不少：user 与 managed 各一层均保留', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkill(workspace.getSkillsDir(), 'alpha');
    writeSkill(workspace.getManagedSkillsDir(), 'beta');

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(snap.skills.length, 2, `相对深度恰为 2 的技能不得被误伤，实际 ${snap.skills.length}`);
    for (const name of ['alpha', 'beta']) {
      assert.ok(snap.skills.some((e) => e.skill.name === name), `${name} 应在集合内`);
    }
    assert.strictEqual(
      snap.diagnostics.some((d) => d.code === 'realm_layout_violation'), false,
      '契约布局不得产生布局违规诊断（不误报）'
    );
  });

  test('不误报：空目录与「一层目录内散落 md」不产生 realm_layout_violation', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    fs.mkdirSync(path.join(workspace.getSkillsDir(), 'emptyone'), { recursive: true });
    // 一层目录内的散落 md 不是技能（SDK 只对扫描根层 includeRootFiles=true）
    fs.mkdirSync(path.join(workspace.getSkillsDir(), 'loose'), { recursive: true });
    fs.writeFileSync(path.join(workspace.getSkillsDir(), 'loose', 'notes.md'), '---\ndescription: 散落说明\n---\n\n# notes\n');

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(snap.skills.length, 0, '空目录与散落 md 不产生技能');
    assert.strictEqual(
      snap.diagnostics.filter((d) => d.code === 'realm_layout_violation').length, 0,
      '没有技能条目被深度过滤时不得产生布局违规诊断'
    );
  });

  test('源码：inContractLayout 以相对段数 === 2 判定；Realm 诊断码前缀正确且与 SDK 五枚举不重叠', () => {
    const src = readSource('ai-skills-manager.js');
    const body = functionBody(src, 'inContractLayout');
    assert.ok(body.includes('path.relative('), 'inContractLayout 必须以 path.relative 判定归属深度');
    assert.ok(body.includes('=== 2'), '必须以相对段数 === 2 判定（非字符数、非绝对段数）');

    // 用**宽口径**捕获（不做 realm_ 前缀预筛），否则 startsWith 断言恒真、检不出回归
    const codes = [...src.matchAll(/code:\s*'([a-zA-Z_]+)'/g)].map((m) => m[1]);
    assert.ok(codes.includes('realm_layout_violation'), '源码中应存在 realm_layout_violation 诊断码');
    const SDK_CODES = ['file_info_failed', 'list_failed', 'read_failed', 'parse_failed', 'invalid_metadata'];
    for (const code of codes) {
      assert.ok(code.startsWith('realm_'), `Realm 自建诊断码必须以 realm_ 前缀：${code}`);
      assert.strictEqual(SDK_CODES.includes(code), false, `诊断码不得与 SDK 枚举重名：${code}`);
    }
  });
});

describe('名称权威（SKILL-06 / D-08）', () => {
  test('冒名拒绝：skills/evil/SKILL.md 声明 name: find-skills → 最终 skill.name === "evil" + 诊断', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    const file = writeSkillAt(path.join(workspace.getSkillsDir(), 'evil', 'SKILL.md'), {
      name: 'find-skills',
      description: '冒名顶替的技能',
    });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    const entry = snap.skills.find((e) => e.skill.filePath === file);
    assert.ok(entry, '命名不规范的合法技能不得被丢弃');
    assert.strictEqual(
      entry.skill.name, 'evil',
      '最终 name 必须等于目录名（目录名权威，杜绝冒名）'
    );

    const diag = snap.diagnostics.find((d) => d.code === 'realm_name_rewritten');
    assert.ok(diag, '重写必须产 realm_name_rewritten 诊断（禁止静默）');
    assert.strictEqual(diag.level, 'warning');
    assert.strictEqual(diag.path, file, '诊断应指向实际文件路径');
    assert.strictEqual(diag.source, 'user');
    assert.ok(
      entry.diagnostics.some((d) => d.code === 'realm_name_rewritten'),
      '诊断须同时内联在缓存条目上（D-07 口径）'
    );
  });

  test('系统性不变式：集合内每一条的 skill.name 恒等于其所在目录名', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkill(workspace.getSkillsDir(), 'alpha');
    writeSkill(workspace.getManagedSkillsDir(), 'beta');
    writeSkillAt(path.join(workspace.getSkillsDir(), 'evil', 'SKILL.md'), { name: 'find-skills' });
    writeSkillAt(path.join(workspace.getManagedSkillsDir(), 'mismatch', 'SKILL.md'), { name: 'other' });

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(snap.skills.length, 4, `前置：4 个技能全部进集合，实际 ${snap.skills.length}`);
    for (const entry of snap.skills) {
      assert.strictEqual(
        entry.skill.name, path.basename(path.dirname(entry.skill.filePath)),
        `不变式破坏：${entry.skill.filePath} 的 name 应为目录名`
      );
    }
    assert.strictEqual(
      snap.diagnostics.filter((d) => d.code === 'realm_name_rewritten').length, 2,
      '两条不一致条目各产一条重写诊断'
    );
  });

  test('重写 ≠ 丢弃：被重写的技能仍出现在 prompt 段中，且 name 已是目录名', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkillAt(path.join(workspace.getSkillsDir(), 'evil', 'SKILL.md'), {
      name: 'find-skills',
      description: '冒名顶替的技能',
    });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const prompt = aiSkills.buildSkillsPrompt();
    assert.ok(prompt.includes('<name>evil</name>'), 'prompt 中的 name 应为目录名');
    assert.strictEqual(prompt.includes('find-skills'), false, 'prompt 中不得出现被重写的冒名 name');
    assert.ok(prompt.includes('<location>'), '被重写的技能仍被注入（重写 ≠ 丢弃）');
  });

  test('不误报：frontmatter name 与目录名一致时不产生 realm_name_rewritten', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkill(workspace.getSkillsDir(), 'alpha');
    writeSkill(workspace.getManagedSkillsDir(), 'beta');
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(snap.skills.length, 2);
    assert.strictEqual(
      snap.diagnostics.some((d) => d.code === 'realm_name_rewritten'), false,
      'name 与目录名一致时不得产生重写诊断'
    );
  });

  test('源码：目录名取自 filePath 的 dirname，且不存在 Skill 位置字段引用', () => {
    const src = readSource('ai-skills-manager.js');
    const body = functionBody(src, 'enforceDirNameAuthority');
    assert.ok(
      body.includes('path.basename(path.dirname(entry.skill.filePath))'),
      '目录名必须经 path.dirname(entry.skill.filePath) 推导'
    );
    assert.strictEqual(
      /\bskill\.location\b/.test(src), false,
      'Skill 无位置字段（五字段契约），不得引用 skill.location'
    );
    assert.ok(src.includes('realm_name_rewritten'), '应存在 realm_name_rewritten 诊断码');
  });
});

describe('去重与遮蔽（SKILL-05）', () => {
  /** 两个来源各放一个同名技能（description 不同以便区分） */
  async function withSameNameBothSources(t, name = 'good') {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const managedFile = writeSkill(workspace.getManagedSkillsDir(), name, {
      description: 'managed 版同名技能',
    });
    const userFile = writeSkill(workspace.getSkillsDir(), name, {
      description: 'user 版同名技能',
    });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
    return { managedFile, userFile, snap: aiSkills.getSkillsSnapshot() };
  }

  test('同名遮蔽：user 版进 prompt，managed 版标 shadowed 且仍保留在集合内', async (t) => {
    const { managedFile, userFile, snap } = await withSameNameBothSources(t);

    assert.strictEqual(
      snap.skills.length, 2,
      '遮蔽败者必须保留在 skills[] 内（不剔除 —— D-06 costly 可逆性）'
    );
    const userEntry = snap.skills.find((e) => e.skill.filePath === userFile);
    const managedEntry = snap.skills.find((e) => e.skill.filePath === managedFile);
    assert.ok(userEntry && managedEntry, '两个来源的条目都应在集合内');

    assert.notStrictEqual(userEntry.shadowed, true, 'user 版不得被遮蔽');
    assert.strictEqual(managedEntry.shadowed, true, 'managed 版应被遮蔽');
    assert.strictEqual(managedEntry.shadowedBy, 'user', 'shadowedBy 应为遮蔽者来源');

    const prompt = aiSkills.buildSkillsPrompt();
    assert.ok(prompt.includes('user 版同名技能'), 'user 版应进 prompt');
    assert.strictEqual(prompt.includes('managed 版同名技能'), false, '遮蔽条目不进 prompt（D-06）');
  });

  test('去重发生在注入之前：同名技能在 prompt 段中只产出一条 <skill>', async (t) => {
    await withSameNameBothSources(t);

    const prompt = aiSkills.buildSkillsPrompt();
    const countOf = (needle) => prompt.split(needle).length - 1;
    assert.strictEqual(countOf('<skill>'), 1, 'SDK formatSkillsForSystemPrompt 不去重，Realm 必须去重后才能注入');
    assert.strictEqual(countOf('</skill>'), 1, '同名条目闭合标签也只应一条');
    assert.strictEqual(countOf('<name>good</name>'), 1, '同名技能的 name 条目只应出现一次');
  });

  test('败者带 realm_shadowed 诊断，且该条目 source === "managed"', async (t) => {
    const { snap } = await withSameNameBothSources(t);

    const loser = snap.skills.find((e) => e.shadowed === true);
    assert.ok(loser, '应存在被遮蔽条目');
    assert.strictEqual(loser.source, 'managed', '败者应来自 managed（user 先到不可能 —— 输入顺序即优先级）');

    const diag = (loser.diagnostics || []).find((d) => d.code === 'realm_shadowed');
    assert.ok(diag, '遮蔽必须产 realm_shadowed 诊断（禁止静默）');
    assert.strictEqual(diag.level, 'warning');
    assert.strictEqual(diag.path, loser.skill.filePath, '诊断应指向败者文件路径');
    assert.strictEqual(diag.source, 'managed');
    assert.ok(
      snap.diagnostics.some((d) => d.code === 'realm_shadowed'),
      '模块级诊断同样可见（D-07 双写）'
    );
    assert.strictEqual(
      snap.errors.length, 0,
      '遮蔽是正常态，不得进整批错误（D-05 第 2 层只承接无对应技能的整批失败）'
    );
  });

  test('优先级方向以文件路径为准：被遮蔽的那一份位于 managed-skills/ 之下', async (t) => {
    const { snap } = await withSameNameBothSources(t);

    const loser = snap.skills.find((e) => e.shadowed === true);
    assert.ok(loser, '应存在被遮蔽条目');
    assert.ok(
      loser.skill.filePath.startsWith(workspace.getManagedSkillsDir() + path.sep),
      '「user 目录里的那一份永不被遮蔽」—— 输入顺序（managed → user）即优先级编码；' +
      '调换 rootDirs 顺序或让 applyShadowing 不按输入顺序定胜负都会让本断言转红'
    );
  });

  test('源码：applyShadowing 不剔除元素；prompt 组装处含 !e.shadowed 过滤', () => {
    const src = readSource('ai-skills-manager.js');
    const body = functionBody(src, 'applyShadowing');
    assert.strictEqual(/\.splice\(/.test(body), false, 'applyShadowing 不得删除数组元素');
    assert.strictEqual(
      /\.filter\(/.test(body), false,
      'applyShadowing 不得用 filter 剔除败者（返回数组必须与输入等长）'
    );
    assert.ok(src.includes('!e.shadowed'), 'prompt 组装处必须以 !e.shadowed 过滤');
    assert.ok(src.includes('realm_shadowed'), '应存在 realm_shadowed 诊断码');
  });
});

describe('诊断与限额（SKILL-06/07）', () => {
  /** 写入一个 YAML 解析失败的技能（未闭合引号 → SDK parse_failed） */
  function writeBrokenSkill(scannedDir, name) {
    const dir = path.join(scannedDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, `---\nname: ${name}\ndescription: "未闭合\n---\n\n# ${name}\n`);
    return file;
  }

  test('第 1 层降级：单技能失败（YAML / 超长 description）跳过，其余技能照常注入且不抛错', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkill(workspace.getSkillsDir(), 'alpha', { description: '合法技能' });
    writeBrokenSkill(workspace.getSkillsDir(), 'broken');
    writeSkill(workspace.getSkillsDir(), 'longdesc', { description: 'x'.repeat(1100) });

    await assert.doesNotReject(
      () => aiSkills.refreshSkills(env, { rootDirs: scanRoots() }),
      '单技能失败不得让 refreshSkills 抛错（D-05 第 1 层 = 正常态）'
    );

    const snap = aiSkills.getSkillsSnapshot();
    assert.ok(snap.skills.some((e) => e.skill.name === 'alpha'), '合法技能不得被误伤');
    assert.ok(aiSkills.buildSkillsPrompt().includes('<name>alpha</name>'), '合法技能仍进 prompt');
    assert.strictEqual(snap.skills.some((e) => e.skill.name === 'broken'), false, 'YAML 失败的技能应被跳过');
    assert.strictEqual(
      snap.skills.some((e) => e.skill.name === 'longdesc'), false,
      'description 超限的技能应被跳过（SDK 会原样返回，Realm 必须按 isDescriptionUnusable 剔除）'
    );

    const parseDiag = snap.diagnostics.find((d) => d.code === 'parse_failed');
    assert.ok(parseDiag, 'YAML 失败须产 parse_failed 诊断（禁止静默）');
    assert.strictEqual(parseDiag.level, 'warning', 'type → level 显式映射必须真的执行（非 undefined）');
    assert.ok(String(parseDiag.message).length > 0, 'code 原样保留且 message 非空');

    const metaDiag = snap.diagnostics.find((d) => d.code === 'invalid_metadata');
    assert.ok(metaDiag, 'description 超限须产 invalid_metadata 诊断');
    assert.strictEqual(metaDiag.level, 'warning', 'invalid_metadata 映射后 level 应为 warning');
    assert.ok(/^description\b/.test(String(metaDiag.message)), '该诊断应为 description 类（非 name 类）');
  });

  test('第 1 层不误伤：name 与目录名不一致的技能仍保留（D-08 重写而非跳过）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkillAt(path.join(workspace.getSkillsDir(), 'evil', 'SKILL.md'), {
      name: 'find-skills',
      description: '合法 description 的冒名技能',
    });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    const entry = snap.skills.find((e) => e.skill.name === 'evil');
    assert.ok(
      entry,
      'name 类 invalid_metadata 不得导致技能被剔除 —— D-08 以目录名重写并保留（desc 类才跳过）'
    );
    assert.ok(
      snap.diagnostics.some((d) => d.code === 'invalid_metadata'),
      'SDK 的 name 不匹配诊断仍须透传（只是不导致剔除）'
    );
    assert.ok(snap.diagnostics.some((d) => d.code === 'realm_name_rewritten'));
  });

  test('第 2 层降级：批量错误不抛错、保留上一次成功快照，并往 errors[] 记 realm_refresh_failed', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkill(workspace.getSkillsDir(), 'alpha');
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
    const good = aiSkills.getSkillsSnapshot();
    assert.strictEqual(good.skills.length, 1, '前置：一次成功刷新');
    const goodPrompt = good.promptBlock;

    // SDK 的 loadSkills 顶层无 try/catch：listDir 的 rejection 会一路上抛
    const throwingEnv = {
      ...env,
      async listDir() {
        throw new Error('simulated unreadable dir');
      },
    };
    await assert.doesNotReject(
      () => aiSkills.refreshSkills(throwingEnv, { rootDirs: scanRoots() }),
      '批量失败不得抛错，必须降级为诊断'
    );

    const after = aiSkills.getSkillsSnapshot();
    assert.strictEqual(after.skills.length, good.skills.length, '上一次成功快照的 skills 必须保留');
    assert.strictEqual(after.promptBlock, goodPrompt, 'promptBlock 必须保留（不清空）');
    const err = after.errors.find((d) => d.code === 'realm_refresh_failed');
    assert.ok(err, '整批失败必须产 realm_refresh_failed（禁止静默）');
    assert.strictEqual(err.level, 'error', '整批失败属 D-05 第 2 层，level 为 error');
  });

  test('目录缺失不静默：扫描根不存在时产 realm_skills_dir_missing（SDK 自身零诊断）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const missing = path.join(root, 'not-a-skill-dir');

    await aiSkills.refreshSkills(env, { rootDirs: [missing] });

    const snap = aiSkills.getSkillsSnapshot();
    const diag = snap.errors.find((d) => d.code === 'realm_skills_dir_missing');
    assert.ok(diag, '目录缺失必须由 Realm 补诊断（SDK 对不存在目录静默 continue）');
    assert.strictEqual(diag.level, 'error');
    assert.strictEqual(diag.path, missing, '诊断应指向缺失的目录路径');
    assert.strictEqual(
      snap.skills.length, 0,
      '目录缺失不中断加载流程（只是没有技能可加载）'
    );
  });

  test('空态契约：零诊断时 diagnostics 与 errors 均为长度 0 的数组（非 undefined / null）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    aiSkills._resetCacheForTest();

    const empty = aiSkills.getSkillsSnapshot();
    assert.ok(Array.isArray(empty.diagnostics), 'diagnostics 必须是数组');
    assert.ok(Array.isArray(empty.errors), 'errors 必须是数组');
    assert.strictEqual(empty.diagnostics.length, 0);
    assert.strictEqual(empty.errors.length, 0);

    const env = await workspace.createSandboxEnv({ cwd: root });
    writeSkill(workspace.getSkillsDir(), 'alpha');
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    assert.ok(Array.isArray(snap.diagnostics) && Array.isArray(snap.errors));
    assert.strictEqual(
      snap.errors.length, 0,
      '成功刷新且无环境级问题时 errors 必须为空（上一次的失败态不得永远挂着）'
    );
  });

  test('源码：整批失败的 catch 分支整体回滚三件套（WR-05 撕裂快照）', () => {
    // refreshSkills 是模块级 async function，收尾为行首 `}` —— 用 `\n}\n` 精确切体
    const src = readSource('ai-skills-manager.js');
    const start = src.indexOf('async function refreshSkills(');
    assert.ok(start >= 0, '应存在 async function refreshSkills(');
    const body = src.slice(start, src.indexOf('\n}\n', start));

    assert.ok(body.includes('const prev = {'), '须在管线开始前捕获上一次成功态');
    const catchIdx = body.indexOf('} catch (err) {');
    assert.ok(catchIdx >= 0, 'refreshSkills 必须含 catch 分支');
    const catchBody = body.slice(catchIdx);
    // 若只在 catch 里「不动」_cache，而本轮已把 diagnostics 换成新值，就会暴露
    // 「新诊断 + 旧技能集」的撕裂快照 —— 必须三件套一起回滚
    for (const line of [
      '_cache.skills = prev.skills',
      '_cache.promptBlock = prev.promptBlock',
      '_cache.diagnostics = prev.diagnostics',
    ]) {
      assert.ok(catchBody.includes(line), `catch 分支必须回滚 ${line}`);
    }
    assert.ok(catchBody.includes('realm_refresh_failed'), '整批失败仍须记 error 诊断（不静默）');
  });

  test('源码：toRealmDiag 是 type → level 的唯一映射点（显式三元，非字段想当然）', () => {
    const src = readSource('ai-skills-manager.js');
    const body = functionBody(src, 'toRealmDiag');
    assert.ok(
      body.includes("d.type === 'warning' ? 'warning' : 'error'"),
      'toRealmDiag 必须显式映射 SDK 的 type 字段到 Realm 的 level'
    );
    assert.ok(body.includes('code: d.code'), 'code 必须原样透传');
    assert.ok(src.includes('function pushError('), '应存在 pushError（模块级 errors[] 写入点）');
    assert.ok(src.includes('function isDescriptionUnusable('), '应存在 description 可用性判定');
  });

  test('字节闸：超 MAX_SKILL_MD_BYTES 的 SKILL.md 跳过，诊断带 limit 与真实 currentValue', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const max = aiSkills.LIMITS.MAX_SKILL_MD_BYTES;

    const dir = path.join(workspace.getSkillsDir(), 'huge');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, `---\nname: huge\ndescription: 超大技能\n---\n\n${'x'.repeat(max + 1)}`);
    const size = fs.statSync(file).size;

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    assert.strictEqual(snap.skills.some((e) => e.skill.name === 'huge'), false, '超限技能不进集合');
    const diag = snap.diagnostics.find((d) => d.code === 'realm_skill_md_too_large');
    assert.ok(diag, '字节闸必须产 Realm 可操作诊断（不靠解析 SDK 消息文本）');
    assert.strictEqual(diag.level, 'error');
    assert.strictEqual(diag.limit, max, 'limit 必须是限额本身（SKILL-07 的「哪个限额」）');
    assert.strictEqual(diag.currentValue, size, 'currentValue 必须等于实际字节数（fs.statSync 对照）');
    assert.strictEqual(diag.path, file);
    // SDK 的事实记录仍并存（两条各司其职）
    assert.ok(snap.diagnostics.some((d) => d.code === 'read_failed'), 'SDK 的 read_failed 保留不删');
  });

  test('数量上限：user 技能超 MAX_USER_SKILLS 时标 overLimit 但不剔除、不删文件', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const limit = aiSkills.LIMITS.MAX_USER_SKILLS;

    for (let i = 0; i < limit + 1; i += 1) {
      writeSkill(workspace.getSkillsDir(), `skill-${String(i).padStart(3, '0')}`);
    }

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    const over = snap.skills.filter((e) => e.overLimit === true);
    assert.strictEqual(over.length, 1, `恰有 1 条超限（限额 ${limit}，实际 ${limit + 1}）`);
    assert.strictEqual(
      snap.skills.length, limit + 1,
      '超限条目必须保留在数据层（不剔除 —— 否则用户无法在设置页看到并卸载）'
    );
    assert.strictEqual(
      fs.existsSync(path.join(workspace.getSkillsDir(), over[0].skill.name, 'SKILL.md')), true,
      '禁用/超限都不得删除磁盘文件'
    );

    const diag = snap.diagnostics.find((d) => d.code === 'realm_user_skill_limit_exceeded');
    assert.ok(diag, '超限必须产诊断');
    assert.strictEqual(diag.limit, limit);
    assert.strictEqual(diag.currentValue, limit + 1);

    const prompt = aiSkills.buildSkillsPrompt();
    assert.strictEqual(
      prompt.includes(`<name>${over[0].skill.name}</name>`), false,
      'overLimit 条目不得进 prompt'
    );
  });

  test('prompt 段预算：超预算只保留预算内条数 + 段尾省略提示 + 诊断带 limit/currentValue', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const budget = aiSkills.LIMITS.SKILLS_PROMPT_CHAR_BUDGET;

    for (let i = 0; i < 40; i += 1) {
      writeSkill(workspace.getSkillsDir(), `long-${String(i).padStart(3, '0')}`, {
        description: 'y'.repeat(300),
      });
    }
    // 未截断场景的对照技能（单独一个空目录用不到，这里先记盘面）
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const block = aiSkills.buildSkillsPrompt();
    const noteIdx = block.indexOf('\n\nNote: ');
    assert.ok(noteIdx > 0, '超预算必须出现段尾省略提示（禁止静默截断）');
    assert.ok(
      noteIdx <= budget,
      `技能段本体（不含省略提示）必须在预算内，实际 ${noteIdx} > ${budget}`
    );
    assert.ok(block.includes('</available_skills>'), '省略提示不得替换技能段本体');
    assert.ok(
      block.indexOf('</available_skills>') < noteIdx,
      '省略提示必须追加在 </available_skills> **之外**（前缀缓存友好）'
    );

    const note = block.slice(noteIdx);
    const parsed = /Note: (\d+) of (\d+) skills omitted/.exec(note);
    assert.ok(parsed, `省略提示句式必须可解析：${note}`);
    const omitted = Number(parsed[1]);
    const eligible = Number(parsed[2]);
    assert.ok(omitted > 0, '省略数应大于 0');
    const countOf = (needle) => block.split(needle).length - 1;
    assert.strictEqual(
      countOf('<skill>'), eligible - omitted,
      '注入条数必须等于「可注入数 - 省略数」'
    );

    const diag = aiSkills.getSkillsSnapshot().diagnostics.find(
      (d) => d.code === 'realm_prompt_budget_exceeded'
    );
    assert.ok(diag, '预算截断必须产诊断');
    assert.strictEqual(diag.limit, budget);
    assert.strictEqual(typeof diag.currentValue, 'number');
  });

  test('prompt 段预算：未超预算时省略提示完全不出现', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    writeSkill(workspace.getSkillsDir(), 'alpha', { description: '短描述' });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const block = aiSkills.buildSkillsPrompt();
    assert.strictEqual(block.includes('Note: '), false, '未截断时省略提示不得出现');
    assert.strictEqual(
      aiSkills.getSkillsSnapshot().diagnostics.some((d) => d.code === 'realm_prompt_budget_exceeded'),
      false,
      '未截断时不得产预算诊断（不误报）'
    );
    assert.ok(block.endsWith('</available_skills>'), '未截断时段尾就是 </available_skills>');
  });

  test('定序确定：连续两次刷新顺序一致，且 user 来源条目全部排在 managed 之前', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });

    for (const n of ['zulu', 'alpha', 'mike']) writeSkill(workspace.getSkillsDir(), n);
    for (const n of ['yankee', 'bravo']) writeSkill(workspace.getManagedSkillsDir(), n);

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
    const first = aiSkills.getSkillsSnapshot().skills.map((e) => `${e.source}:${e.skill.name}`);
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
    const second = aiSkills.getSkillsSnapshot().skills.map((e) => `${e.source}:${e.skill.name}`);

    assert.deepStrictEqual(first, second, '同一技能集的可观测顺序必须跨刷新稳定');
    assert.deepStrictEqual(
      first, ['user:alpha', 'user:mike', 'user:zulu', 'managed:bravo', 'managed:yankee'],
      '顺序由 bySkillPriority 全序决定：user 先、再按 name 码点序'
    );
  });

  test('源码：预算用差量测量（fixedOverhead / entryCost），定序不用 localeCompare，且不手拼可用技能段', () => {
    const src = readSource('ai-skills-manager.js');
    assert.ok(src.includes('fixedOverhead'), '应存在固定开销测量量');
    assert.ok(src.includes('entryCost'), '应存在逐条差量成本函数');
    assert.strictEqual(src.includes('localeCompare'), false, '不得用 localeCompare（跨机 ICU 漂移 → 前缀缓存漂移）');
    assert.strictEqual(
      src.includes('The following skills provide'), false,
      '不得手写 SDK 的可用技能段前言（自拼等于复制 SDK 模板，升级即漂移）'
    );
    assert.strictEqual(
      /<available_skills>/.test(src), false,
      '不得手写 <available_skills> 字符串模板（必须经 formatSkillsForSystemPrompt）'
    );
    assert.ok(src.includes('function bySkillPriority('), '应存在确定性全序比较器');
    for (const code of [
      'realm_skill_md_too_large',
      'realm_user_skill_limit_exceeded',
      'realm_prompt_budget_exceeded',
    ]) {
      assert.ok(src.includes(code), `应存在 ${code} 诊断码`);
    }
    // 宽口径捕获（不预筛 realm_ 前缀），使前缀断言可证伪 —— 预筛会让它恒真
    const budgetDiagCodes = [...src.matchAll(/code:\s*'([a-zA-Z_]+)'/g)].map((m) => m[1]);
    assert.ok(budgetDiagCodes.length > 0, '应能捕获到诊断码字面量');
    for (const c of budgetDiagCodes) {
      assert.ok(c.startsWith('realm_'), `诊断码必须以 realm_ 前缀：${c}`);
    }
  });
});

describe('启停状态（SKILL-08）', () => {
  test('禁用技能：标 disabled、仍在集合内、不进 prompt，且磁盘文件原样不动', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const file = writeSkill(workspace.getSkillsDir(), 'alpha', { description: '可被禁用的技能' });
    const sizeBefore = fs.statSync(file).size;

    await aiSkills.refreshSkills(env, { disabled: ['alpha'], rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    const entry = snap.skills.find((e) => e.skill.name === 'alpha');
    assert.ok(entry, '禁用不得从数据层移除条目（否则设置页无法列出它来重新启用）');
    assert.strictEqual(entry.disabled, true, '禁用条目应标 disabled');
    assert.strictEqual(
      aiSkills.buildSkillsPrompt().includes('<name>alpha</name>'), false,
      '禁用条目不得进 prompt'
    );

    // 禁用是消费侧过滤，绝不触碰磁盘
    assert.strictEqual(fs.existsSync(file), true, '禁用不得删除 SKILL.md');
    assert.strictEqual(fs.statSync(file).size, sizeBefore, '禁用不得改写 SKILL.md');
    assert.strictEqual(fs.existsSync(path.dirname(file)), true, '禁用不得删除技能目录');
  });

  test('启停可逆：disabled: [] 时技能回到 prompt 输出', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    writeSkill(workspace.getSkillsDir(), 'alpha', { description: '可被禁用的技能' });

    await aiSkills.refreshSkills(env, { disabled: ['alpha'], rootDirs: scanRoots() });
    assert.strictEqual(aiSkills.buildSkillsPrompt().includes('<name>alpha</name>'), false);

    await aiSkills.refreshSkills(env, { disabled: [], rootDirs: scanRoots() });
    assert.ok(
      aiSkills.buildSkillsPrompt().includes('<name>alpha</name>'),
      '重新启用即恢复（无需重建任何东西）'
    );
    assert.strictEqual(
      aiSkills.getSkillsSnapshot().skills.find((e) => e.skill.name === 'alpha').disabled,
      undefined,
      '未被禁用时不得残留 disabled 标记'
    );
  });

  test('同名技能共享禁用状态（D-09 已知边界）：user 与 managed 同名条目同时被禁用', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    writeSkill(workspace.getManagedSkillsDir(), 'foo', { description: 'managed 版' });
    writeSkill(workspace.getSkillsDir(), 'foo', { description: 'user 版' });

    await aiSkills.refreshSkills(env, { disabled: ['foo'], rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    const fooEntries = snap.skills.filter((e) => e.skill.name === 'foo');
    assert.strictEqual(fooEntries.length, 2, '前置：两来源同名条目都保留在集合内');
    for (const e of fooEntries) {
      assert.strictEqual(
        e.disabled, true,
        `禁用键是 name、不区分来源，两来源都应被禁用（source=${e.source}）`
      );
    }
    assert.strictEqual(aiSkills.buildSkillsPrompt().includes('<name>foo</name>'), false);
  });

  test('digest 捕捉启停：不同 disabled 输入产生不同 digest（46-04 快速判定主键的前提）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    writeSkill(workspace.getSkillsDir(), 'alpha');
    writeSkill(workspace.getSkillsDir(), 'beta');

    await aiSkills.refreshSkills(env, { disabled: [], rootDirs: scanRoots() });
    const enabled = aiSkills.getSkillsSnapshot().digest;
    await aiSkills.refreshSkills(env, { disabled: ['alpha'], rootDirs: scanRoots() });
    const disabledDigest = aiSkills.getSkillsSnapshot().digest;

    assert.ok(enabled.length > 0);
    assert.notStrictEqual(
      enabled, disabledDigest,
      '启停改变 prompt 段，digest 必须随之变化（否则 46-04 的快速判定会漏掉启停）'
    );
  });

  test('源码：数据层不移除式过滤，disabled 只出现在消费侧过滤与标记赋值', () => {
    const src = readSource('ai-skills-manager.js');
    assert.ok(src.includes('!e.disabled'), 'prompt 可注入集合必须以 !e.disabled 过滤');
    assert.ok(
      src.includes('entry.disabled = true'),
      '禁用必须是**就地标记**（entry.disabled = true），不是移除'
    );
    assert.strictEqual(
      /_cache\.skills\s*=\s*.*\.filter\(/.test(src), false,
      '数据层不得用 filter 重建 _cache.skills（那就是移除式过滤）'
    );
    assert.strictEqual(/\.splice\(/.test(src), false, '不得删除集合元素');
  });
});

describe('技能目录与沙箱可达（SKILL-01）', () => {
  test('ensureWorkspaceDir 后两目录存在，且技能路径在 resolveInside 放行范围内', (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    assert.strictEqual(fs.existsSync(workspace.getSkillsDir()), true, 'skills/ 应被自动创建');
    assert.strictEqual(fs.existsSync(workspace.getManagedSkillsDir()), true, 'managed-skills/ 应被自动创建');
    assert.notStrictEqual(
      workspace.resolveInside(root, path.join(workspace.getSkillsDir(), 'alpha', 'SKILL.md')),
      null,
      '技能路径必须落在硬沙箱 root 内（否则模型看得到 location 却 read 不到）'
    );
    assert.notStrictEqual(
      workspace.resolveInside(root, path.join(workspace.getManagedSkillsDir(), 'beta', 'SKILL.md')),
      null,
      'managed 技能路径同样必须在沙箱 root 内'
    );
  });

  test('沙箱 readTextFile 可读取两目录内任意 SKILL.md', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const userFile = writeSkill(workspace.getSkillsDir(), 'alpha');
    const managedFile = writeSkill(workspace.getManagedSkillsDir(), 'beta');
    const env = await workspace.createSandboxEnv({ cwd: root });

    for (const file of [userFile, managedFile]) {
      const result = await env.readTextFile(file);
      assert.strictEqual(result.ok, true, `沙箱应可读取 ${file}`);
    }
  });
});

describe('prompt 段注入（SKILL-02）', () => {
  test('空技能集：prompt 不含 available_skills，且与三段基线逐字符相同（不多出空行）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    aiSkills._resetCacheForTest(); // 确保基线就是「不含技能段」的前三段

    const baseline = aiManager.buildSystemPrompt(); // 前三段基线（cache.promptBlock === ''）
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const prompt = aiManager.buildSystemPrompt();
    assert.strictEqual(prompt.includes('available_skills'), false, '空技能集不得注入技能段');
    assert.strictEqual(prompt, baseline, '空态整段不追加（不产生空标签、不留多余空行）');
    assert.strictEqual(prompt.length, baseline.length, '空态 prompt 长度等于三段基线');
    assert.strictEqual(prompt.endsWith('\n\n'), false, '不得留多余空行');
  });

  test('有技能：prompt 含 available_skills / name / description / location 四类标签，且技能段只出现一次', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha', { description: '端到端纵切测试技能' });
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const prompt = aiManager.buildSystemPrompt();
    for (const tag of ['<available_skills>', '<name>', '<description>', '<location>']) {
      assert.ok(prompt.includes(tag), `prompt 应含 ${tag}`);
    }
    const countOf = (needle) => prompt.split(needle).length - 1;
    assert.strictEqual(countOf('<available_skills>'), 1, '<available_skills> 只应出现一次');
    assert.strictEqual(countOf('</available_skills>'), 1, '</available_skills> 只应出现一次');
    assert.strictEqual(countOf('<skill>'), 1, '恰有单项时只注入一个 <skill> 条目');
  });

  test('技能段中的 <location> 等于技能在沙箱内的绝对路径（Skill.filePath）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const file = writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const entry = aiSkills.getSkillsSnapshot().skills.find((e) => e.skill.name === 'alpha');
    assert.ok(entry, 'alpha 应在技能集内');
    assert.strictEqual(entry.skill.filePath, file, 'filePath 应为 SKILL.md 绝对路径');
    assert.ok(
      aiManager.buildSystemPrompt().includes(`<location>${file}</location>`),
      'prompt 的 <location> 必须指向该绝对路径'
    );
  });
});

describe('模块级缓存 + 同步访问器（SKILL-03）', () => {
  test('refreshSkills 后 buildSkillsPrompt 同步返回非空字符串（非 Promise，零 IO 路径）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const value = aiSkills.buildSkillsPrompt();
    assert.strictEqual(typeof value, 'string', 'buildSkillsPrompt 必须同步返回字符串');
    assert.strictEqual(typeof value.then, 'undefined', '不得返回 thenable');
    assert.ok(value.length > 0, '有技能时技能段应非空');
    assert.strictEqual(value, aiSkills.getSkillsSnapshot().promptBlock, '与快照 promptBlock 一致');
  });

  test('getSkillsSnapshot 返回浅拷贝视图：就地改数组不污染模块级权威', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const first = aiSkills.getSkillsSnapshot();
    const second = aiSkills.getSkillsSnapshot();
    assert.notStrictEqual(first.skills, second.skills, '两次快照的 skills 不得是同一引用');
    assert.deepStrictEqual(first.skills, second.skills, '两次快照内容应相同（浅拷贝语义）');
    assert.notStrictEqual(first.diagnostics, second.diagnostics, 'diagnostics 同样应为浅拷贝');
    assert.notStrictEqual(first.errors, second.errors, 'errors 同样应为浅拷贝');

    const before = second.skills.length;
    first.skills.push({ skill: { name: 'injected' }, source: 'user' });
    assert.strictEqual(
      aiSkills.getSkillsSnapshot().skills.length, before,
      '就地改快照数组不得污染模块级权威'
    );
  });

  test('连续两次 refreshSkills 同一目录得到相同 digest（确定性，46-04 的「无变化不动 prompt」依赖它）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha');
    writeSkill(workspace.getSkillsDir(), 'beta');
    const env = await workspace.createSandboxEnv({ cwd: root });

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
    const first = aiSkills.getSkillsSnapshot();
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
    const second = aiSkills.getSkillsSnapshot();

    assert.ok(first.digest.length > 0, 'digest 应非空');
    assert.strictEqual(first.digest, second.digest, '同一技能集的 digest 必须稳定');
    assert.strictEqual(first.promptBlock, second.promptBlock, '同一技能集的 prompt 段必须逐字节相同');
  });
});

describe('依赖纪律（源码扫描）', () => {
  const YAML_OR_IGNORE_REQUIRE = /require\(\s*['"](yaml|ignore)['"]\s*\)/;
  const HARNESS_SUBPATH_RE = /pi-agent-core\/harness\//;

  for (const file of ['ai-skills-manager.js', 'ai-manager.js']) {
    test(`${file} 不含 YAML / ignore 库直接 require，也不含 SDK harness 子路径导入`, () => {
      const src = readSource(file);
      assert.strictEqual(
        YAML_OR_IGNORE_REQUIRE.test(src), false,
        `${file} 不得直接 require SDK 的传递依赖（换包管理器会 MODULE_NOT_FOUND）`
      );
      assert.strictEqual(
        HARNESS_SUBPATH_RE.test(src), false,
        `${file} 不得从 SDK 子路径导入（SDK exports map 无该入口）`
      );
    });
  }

  test('依赖纪律断言本身有效（自校验：能命中注入的样本）', () => {
    assert.strictEqual(YAML_OR_IGNORE_REQUIRE.test("const y = require('yaml');"), true);
    assert.strictEqual(YAML_OR_IGNORE_REQUIRE.test('const i = require("ignore");'), true);
    assert.strictEqual(
      HARNESS_SUBPATH_RE.test("import('@earendil-works/pi-agent-core/harness/skills')"), true
    );
  });
});

describe('接线与导出面（源码断言）', () => {
  test('agent-workspace 新增两目录访问器且均由 getWorkspaceDir() 派生', () => {
    const src = readSource('agent-workspace.js');
    assert.ok(src.includes('function getSkillsDir('), '应存在 getSkillsDir');
    assert.ok(src.includes('function getManagedSkillsDir('), '应存在 getManagedSkillsDir');
    assert.ok(src.includes("path.join(getWorkspaceDir(), 'skills')"), 'skills 目录须派生自工作区根');
    assert.ok(src.includes("path.join(getWorkspaceDir(), 'managed-skills')"), 'managed-skills 目录须派生自工作区根');
    assert.strictEqual(typeof workspace.getSkillsDir, 'function');
    assert.strictEqual(typeof workspace.getManagedSkillsDir, 'function');
  });

  test('ensureWorkspaceDir 建满 5 个目录（新增 2 行幂等 mkdir）', () => {
    const body = functionBody(readSource('agent-workspace.js'), 'ensureWorkspaceDir');
    const count = (body.match(/fs\.mkdirSync\(/g) || []).length;
    assert.ok(count >= 5, `ensureWorkspaceDir 应有 ≥5 条 mkdirSync，实际 ${count}`);
  });

  test('ai-skills-manager 三限额单源齐全且公开面导出', () => {
    const src = readSource('ai-skills-manager.js');
    assert.ok(src.includes('MAX_SKILL_MD_BYTES: 64 * 1024'), '应含 MAX_SKILL_MD_BYTES 单源');
    assert.ok(src.includes('MAX_USER_SKILLS: 50'), '应含 MAX_USER_SKILLS 单源');
    assert.ok(src.includes('SKILLS_PROMPT_CHAR_BUDGET: 8000'), '应含 SKILLS_PROMPT_CHAR_BUDGET 单源');
    assert.strictEqual(aiSkills.LIMITS.MAX_SKILL_MD_BYTES, 64 * 1024);
    assert.strictEqual(aiSkills.LIMITS.MAX_USER_SKILLS, 50);
    assert.strictEqual(aiSkills.LIMITS.SKILLS_PROMPT_CHAR_BUDGET, 8000);
    assert.strictEqual(typeof aiSkills.refreshSkills, 'function');
    assert.strictEqual(typeof aiSkills.buildSkillsPrompt, 'function');
    assert.strictEqual(typeof aiSkills.getSkillsSnapshot, 'function');
  });

  test('ai-manager 第 4 段为条件追加且 buildSystemPrompt 已导出', () => {
    const src = readSource('ai-manager.js');
    const body = functionBody(src, 'buildSystemPrompt');
    assert.ok(body.includes('skillsBlock'), 'buildSystemPrompt 应有 skillsBlock 局部量');
    assert.ok(body.includes('? base +'), '技能段应为条件追加分支');
    assert.strictEqual(typeof aiManager.buildSystemPrompt, 'function', 'buildSystemPrompt 必须已导出');
  });

  test('buildSkillsPrompt 同步返回字符串（非 Promise）', () => {
    const value = aiSkills.buildSkillsPrompt();
    assert.strictEqual(typeof value, 'string', 'buildSkillsPrompt 必须同步返回字符串');
    assert.strictEqual(typeof value.then, 'undefined', '不得返回 thenable');
  });
});

describe('Agent prompt 回写（SKILL-04）', () => {
  test('SDK 契约：改写 agent.state.systemPrompt 后下一轮快照即反映新值（D-03 的技术前提）', async () => {
    const { Agent } = await import('@earendil-works/pi-agent-core');
    const agent = new Agent({
      initialState: { systemPrompt: 'A' },
      streamFn: async () => {
        throw new Error('noop');
      },
    });

    assert.strictEqual(agent.createContextSnapshot().systemPrompt, 'A', '前置：初始快照');
    agent.state.systemPrompt = 'B';
    assert.strictEqual(
      agent.createContextSnapshot().systemPrompt, 'B',
      'state.systemPrompt 是可写普通属性、createContextSnapshot 每轮重读 —— 不重建 Agent 即可生效'
    );
    assert.strictEqual(agent.state.systemPrompt, 'B', 'state 返回内部对象本体（非快照）');
  });

  test('广播行为断言：真正改写时以 skills:changed 调用恰一次；无变化不调用；忙时不调用只置脏', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    writeSkill(workspace.getSkillsDir(), 'alpha', { description: '回写用技能' });

    const AIManager = require('../ai-manager');
    const wm = require('../window-manager');
    const originalBroadcast = wm.broadcast;
    const calls = [];
    wm.broadcast = (channel) => {
      calls.push(channel);
    };
    t.after(() => {
      wm.broadcast = originalBroadcast;
    });

    const ctx = {
      agent: { state: { systemPrompt: '' } },
      sandboxEnv: env,
      configStore: null,
      isProcessing: false,
      _skillsPromptDirty: false,
      _skillsPromptDigest: '',
    };

    // (a) 真正改写时调用恰一次
    await AIManager.prototype.syncAgentSystemPrompt.call(ctx);
    assert.deepStrictEqual(
      calls, ['skills:changed'],
      '真正改写了 prompt 时必须以 skills:changed 广播恰一次'
    );
    assert.strictEqual(
      ctx.agent.state.systemPrompt, aiManager.buildSystemPrompt(),
      '改写后 agent.state.systemPrompt 必须等于 buildSystemPrompt()'
    );
    assert.ok(ctx._skillsPromptDigest.length > 0, '已应用摘要应被记录（供下次早退比对）');

    // (b) 无变化时不调用（digest 早退 + 逐字符比对都生效）
    await AIManager.prototype.syncAgentSystemPrompt.call(ctx);
    assert.strictEqual(calls.length, 1, '无变化时不得重复广播（保 provider 前缀缓存）');

    // (c) 忙时不调用且不改写，只置脏
    const busy = {
      agent: { state: { systemPrompt: ctx.agent.state.systemPrompt } },
      sandboxEnv: env,
      configStore: null,
      isProcessing: true,
      _skillsPromptDirty: false,
      _skillsPromptDigest: '',
    };
    await AIManager.prototype.syncAgentSystemPrompt.call(busy);
    assert.strictEqual(calls.length, 1, '忙时不得广播');
    assert.strictEqual(busy._skillsPromptDirty, true, '忙时必须置脏（由 idle 边界补刷）');
    assert.strictEqual(
      busy.agent.state.systemPrompt, ctx.agent.state.systemPrompt,
      '忙时不得改写 prompt（当前轮的 createContextSnapshot 已取过值）'
    );
  });

  test('源码：syncAgentSystemPrompt 的早退 → 改写 → 广播形态', () => {
    const body = methodBody(readSource('ai-manager.js'), 'syncAgentSystemPrompt');
    assert.ok(body.includes('refreshSkills('), '必须先重扫技能集');
    assert.ok(
      body.includes('this.agent.state.systemPrompt = next'),
      '必须直接改写 agent.state.systemPrompt（不重建 Agent —— D-03）'
    );
    assert.ok(body.includes("windowManager.broadcast('skills:changed')"), '真正改写后必须广播');
    assert.ok(body.includes('this._skillsPromptDirty = true'), '忙时必须置脏');
    assert.ok(
      body.includes('snap.digest === this._skillsPromptDigest'),
      '早退须以 digest 为快速判定主键'
    );
    const earlyIdx = body.indexOf('=== next) return;');
    const writeIdx = body.indexOf('this.agent.state.systemPrompt = next');
    assert.ok(earlyIdx >= 0, '早退条件须同时含 digest 与 prompt 逐字符比对');
    assert.ok(writeIdx > earlyIdx, '早退必须位于改写之前');
  });

  test('源码：promptWithContext 的 idle 边界存在唯一的 _skillsPromptDirty 补刷块', () => {
    const body = methodBody(readSource('ai-manager.js'), 'promptWithContext');
    assert.ok(body.includes('this._skillsPromptDirty'), 'promptWithContext 必须含 idle 补刷块');
    assert.ok(body.includes('this._skillsPromptDirty = false;'), '补刷前须先复位脏标记');
    assert.ok(body.includes('await this.syncAgentSystemPrompt()'), '补刷须复用同一个方法');
    assert.ok(
      body.indexOf('this._skillsPromptDirty = true;') > body.indexOf('await this.syncAgentSystemPrompt()'),
      '补刷失败时必须恢复脏标记（WR-04：否则变更被静默丢弃且无重试）'
    );
  });

  test('源码：两处 Agent 创建后都初始化 _skillsPromptDigest（WR-03：否则首次同步必然伪广播）', () => {
    const src = readSource('ai-manager.js');
    const seeded = [...src.matchAll(
      /this\._skillsPromptDigest = getAiSkillsManagerLazy\(\)\.getSkillsSnapshot\(\)\.digest;/g
    )].length;
    assert.strictEqual(
      seeded, 2,
      `init() 与 _recreateAgent() 各需一行 digest 初始化，实际 ${seeded} 行`
    );
  });
});

describe('P8 失效链机制断言（源码扫描）', () => {
  test('覆盖断言：每个 new Agent( 之前 60 行内都存在 refreshSkills( 调用', () => {
    const src = readSource('ai-manager.js');
    const lines = src.split('\n');
    const createLines = [];
    lines.forEach((line, idx) => {
      if (line.includes('new Agent(')) createLines.push(idx + 1);
    });

    assert.ok(createLines.length >= 2, `应至少有 2 处 Agent 创建点，实际 ${createLines.length}`);
    for (const lineNo of createLines) {
      const from = Math.max(0, lineNo - 1 - 60);
      const window = lines.slice(from, lineNo - 1).join('\n');
      assert.ok(
        window.includes('refreshSkills('),
        `new Agent( 于第 ${lineNo} 行之前 60 行内缺少 refreshSkills 调用 —— P8 漏接线`
      );
    }
    // 计数口径声明：本断言是**创建点覆盖**断言，不是「refreshSkills( 出现次数 ===
    // new Agent( 出现次数」。refreshSkills( 可以合法地出现在非创建点（本阶段的
    // syncAgentSystemPrompt() 内就有一次按需刷新，48/49/50 的写路径同样只在那
    // 一处刷新），这类调用不参与创建点判定。唯一会转红的情形是某个 new Agent(
    // 的前 60 行窗口内没有 refreshSkills(。不得补「两者计数相等」的断言。
  });

  test('源码：init() 与 _recreateAgent() 的 refreshSkills 调用文本逐字一致', () => {
    const src = readSource('ai-manager.js');
    const callRe = /await getAiSkillsManagerLazy\(\)\.refreshSkills\(this\.sandboxEnv, \{[\s\S]*?\n\s*\}\);/;
    // 只比较**两处创建点**内的调用 —— syncAgentSystemPrompt() 内的按需刷新
    // 不参与本次比对（它不是创建点，见上方计数口径声明）
    const norm = (text) => (text || '').split('\n').map((l) => l.trim()).join('\n');
    const callOf = (methodName) => {
      const body = methodBody(src, methodName);
      const m = body.match(callRe);
      return m ? norm(m[0]) : '';
    };
    const initCall = callOf('init');
    const recreateCall = callOf('_recreateAgent');

    assert.ok(initCall, 'init() 内必须有 refreshSkills 调用');
    assert.ok(recreateCall, '_recreateAgent() 内必须有 refreshSkills 调用');
    assert.strictEqual(
      initCall, recreateCall,
      '两处创建点的 refreshSkills 调用必须一致（含 disabled 表达式与 rootDirs 顺序 managed → user）'
    );
    assert.ok(initCall.includes('getManagedSkillsDir()'), 'rootDirs 首位必须是 managed');
    assert.ok(
      initCall.indexOf('getManagedSkillsDir()') < initCall.indexOf('getSkillsDir()'),
      'rootDirs 顺序 managed → user 不是装饰（D-06 遮蔽判定依赖输入顺序）'
    );
  });

  test('源码：_recreateAgent 的 catch 分支不清空技能缓存（D-05 第 2 层由 manager 内部承担）', () => {
    const body = methodBody(readSource('ai-manager.js'), '_recreateAgent');
    assert.strictEqual(body.includes('_resetCacheForTest'), false, '不得清空技能缓存');
    assert.strictEqual(body.includes('_cache'), false, '不得直接触碰 manager 的 _cache');
    assert.ok(body.includes('refreshSkills('), '重建前必须重扫（D-04）');
  });

  test('源码：P8 机制断言 ① —— ai-skills-manager 的权威面已导出', () => {
    const src = readSource('ai-skills-manager.js');
    const exportsBlock = src.slice(src.indexOf('module.exports = {'));
    for (const name of ['refreshSkills', 'buildSkillsPrompt', 'getSkillsSnapshot']) {
      assert.ok(exportsBlock.includes(name), `module.exports 必须含 ${name}（供后续阶段消费）`);
    }
  });

  test('行为：磁盘被外部直接改写后重扫能反映新内容（P8 第 6 条路径的兜底链）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await workspace.createSandboxEnv({ cwd: root });
    const file = writeSkill(workspace.getSkillsDir(), 'alpha', { description: '改写前描述' });

    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
    assert.ok(aiSkills.buildSkillsPrompt().includes('改写前描述'), '前置：初始描述已进 prompt');

    // 模拟模型经 write / bash 绕过所有 Realm 管理器直接改盘（无事件可挂）
    fs.writeFileSync(
      file,
      '---\nname: alpha\ndescription: 改写后描述\n---\n\n# alpha\n\n新正文\n'
    );
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const prompt = aiSkills.buildSkillsPrompt();
    assert.ok(prompt.includes('改写后描述'), '重扫必须反映磁盘上的外部改写（D-04 兜底）');
    assert.strictEqual(prompt.includes('改写前描述'), false, '旧描述不得残留');
  });
});

// ==================== 48-01 D 组：技能调用 / 实时读盘 / 组装 / 重载还原 ====================

/** 取 SDK 的 formatSkillInvocation（SDK 为 ESM-only，动态 import） */
async function sdkFormatSkillInvocation() {
  const sdk = await import('@earendil-works/pi-agent-core');
  return sdk.formatSkillInvocation;
}

/** 直接写一份带 frontmatter 的 SKILL.md（需要 disable-model-invocation 等字段时用） */
function writeRawSkill(scannedDir, name, frontmatterExtra = '') {
  const dir = path.join(scannedDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(
    file,
    `---\nname: ${name}\ndescription: ${name} 技能描述\n${frontmatterExtra}---\n\n# ${name}\n\n正文内容\n`
  );
  return file;
}

/** 建临时 workspace + 沙箱 env + 刷新技能集（D 组的统一夹具） */
async function setupSkillsEnv(root) {
  workspace.ensureWorkspaceDir();
  const env = await workspace.createSandboxEnv({ cwd: root });
  await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });
  return env;
}

describe('D 组 · 实时读盘（用户 2026-09-11 硬约束，DISC-02）', () => {
  test('调用瞬间读盘：写技能 → 读到正文 → 改盘 → 二次调用读到新正文', async (t) => {
    const root = withTempRoot(t);
    const file = writeSkill(workspace.getSkillsDir(), 'alpha', { body: '# alpha\n\n第一版正文\n' });
    const env = await setupSkillsEnv(root);

    const first = await aiSkills.readSkillForInvocation(env, 'alpha');
    assert.strictEqual(first.ok, true, `应读盘成功: ${JSON.stringify(first)}`);
    assert.ok(first.skill.content.includes('第一版正文'), '首次读到第一版正文');
    assert.strictEqual(first.source, 'user');

    // 模拟模型经 write / bash 直接改盘（无事件可挂）
    fs.writeFileSync(file, '---\nname: alpha\ndescription: alpha 技能描述\n---\n\n# alpha\n\n第二版正文\n');
    // 不重新 refreshSkills —— 实时读盘必须当场反映磁盘
    const second = await aiSkills.readSkillForInvocation(env, 'alpha');
    assert.strictEqual(second.ok, true);
    assert.ok(second.skill.content.includes('第二版正文'), '二次调用必须读到新正文（实时读盘）');
    assert.strictEqual(second.skill.content.includes('第一版正文'), false, '旧正文不得残留');
  });

  test('SKILL.md 被删除 → not_found（不冒名注入、不回退缓存快照）', async (t) => {
    const root = withTempRoot(t);
    const file = writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    fs.rmSync(file);
    const res = await aiSkills.readSkillForInvocation(env, 'alpha');
    assert.deepStrictEqual(res, { ok: false, reason: 'not_found', name: 'alpha' });
  });

  test('目录被换成别的技能（fresh.name !== name）→ not_found', async (t) => {
    const root = withTempRoot(t);
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    // 把 alpha 目录里的 SKILL.md 换成另一个技能名 + 把目录名也换掉
    const dir = path.join(workspace.getSkillsDir(), 'alpha');
    fs.rmSync(dir, { recursive: true, force: true });
    writeSkill(workspace.getSkillsDir(), 'beta');
    const res = await aiSkills.readSkillForInvocation(env, 'alpha');
    // 目录仍存在但内容已换成 beta → loadSkills 读不到 name === 'alpha'，按不存在处理
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, 'not_found');
  });

  test('正文为空串 / 仅空白 → 组装被拒（P-48-03：绝不产出字面量 undefined）', async (t) => {
    const root = withTempRoot(t);
    const env = await setupSkillsEnv(root);

    const emptyFile = path.join(workspace.getSkillsDir(), 'empty-body', 'SKILL.md');
    fs.mkdirSync(path.dirname(emptyFile), { recursive: true });
    fs.writeFileSync(emptyFile, '---\nname: empty-body\ndescription: 空正文技能\n---\n');
    const blankFile = path.join(workspace.getSkillsDir(), 'blank-body', 'SKILL.md');
    fs.mkdirSync(path.dirname(blankFile), { recursive: true });
    fs.writeFileSync(blankFile, '---\nname: blank-body\ndescription: 空白正文技能\n---\n\n   \n');
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    for (const name of ['empty-body', 'blank-body']) {
      const res = await aiSkills.readSkillForInvocation(env, name);
      assert.strictEqual(res.ok, false, `${name}: 空正文必须在组装之前被拒`);
      assert.strictEqual(res.reason, 'not_found');
    }

    // 组装守卫：即便外部拼出一个缺 content 的 skill 对象，注入串里也不得出现 `undefined`
    const fmt = await sdkFormatSkillInvocation();
    const assembled = aiManager.buildSkillInvocationBlock(
      { skill: { name: 'x', filePath: '/a/b/SKILL.md', content: 'BODY' }, name: 'x' },
      'arg',
      fmt
    );
    assert.strictEqual(assembled.includes('\nundefined\n'), false, '注入串不得出现字面量 undefined');
  });

  test('不存在的技能名 → not_found', async (t) => {
    const root = withTempRoot(t);
    const env = await setupSkillsEnv(root);
    const res = await aiSkills.readSkillForInvocation(env, 'nope');
    assert.deepStrictEqual(res, { ok: false, reason: 'not_found', name: 'nope' });
  });

  test('disabled 技能 → {ok:false, reason:"disabled"}（且在读盘之前判定）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { disabled: ['alpha'], rootDirs: scanRoots() });

    const res = await aiSkills.readSkillForInvocation(env, 'alpha');
    assert.deepStrictEqual(res, { ok: false, reason: 'disabled', name: 'alpha' });
  });

  test('同名遮蔽：readSkillForInvocation 跳过 shadowed 条目，只作用于胜出者（D-11）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getManagedSkillsDir(), 'alpha', { body: '# managed\n\n托管版\n' });
    writeSkill(workspace.getSkillsDir(), 'alpha', { body: '# user\n\n用户版\n' });
    const env = await setupSkillsEnv(root);

    const snap = aiSkills.getSkillsSnapshot();
    const shadowed = snap.skills.find((e) => e.skill.name === 'alpha' && e.shadowed === true);
    assert.ok(shadowed, '前置：managed 版应被标 shadowed');
    assert.strictEqual(shadowed.source, 'managed');

    const res = await aiSkills.readSkillForInvocation(env, 'alpha');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.source, 'user', '必须作用在胜出者（user）上，不得读到遮蔽败者');
    assert.ok(res.skill.content.includes('用户版'), '读到的正文来自胜出者');
  });

  test('overLimit / promptOmitted 条目仍可显式调用（D-12：显式调用是它唯一可用路径）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    for (let i = 0; i < 52; i += 1) {
      writeSkill(workspace.getSkillsDir(), `long-${String(i).padStart(3, '0')}`, {
        description: 'y'.repeat(300),
      });
    }
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const ui = aiSkills.getSkillsForUI([]);
    const omitted = ui.skills.find((e) => e.promptOmitted === true);
    const over = ui.skills.find((e) => e.overLimit === true);
    assert.ok(omitted, '前置：应存在被预算丢弃（promptOmitted）的条目');
    assert.ok(over, '前置：应存在超出数量上限（overLimit）的条目');

    for (const e of [omitted, over]) {
      const res = await aiSkills.readSkillForInvocation(env, e.name);
      assert.strictEqual(res.ok, true, `${e.name}: 超限/被省略的技能仍必须可显式调用`);
    }
  });
});

describe('D 组 · 组装与拼接顺序（D-05 / D-07）', () => {
  test('buildSkillInvocationBlock 逐字节 === formatSkillInvocation(skill, provenance + "\\n\\n" + args)', async () => {
    const fmt = await sdkFormatSkillInvocation();
    const skill = { name: 'alpha', description: 'd', content: '# alpha\n\n正文\n', filePath: '/ws/skills/alpha/SKILL.md' };
    for (const args of ['帮我找 X', '第一段\n\n第二段', '']) {
      const expected = fmt(skill, ['用户显式调用了技能「alpha」', args].filter(Boolean).join('\n\n'));
      assert.strictEqual(
        aiManager.buildSkillInvocationBlock({ skill, name: 'alpha' }, args, fmt),
        expected,
        `args=${JSON.stringify(args)} 时组装必须逐字节等于 SDK 输出`
      );
    }
  });

  test('无 args 时 provenance 之后无尾随分隔符（SDK 的 additionalInstructions 语义）', async () => {
    const fmt = await sdkFormatSkillInvocation();
    const skill = { name: 'alpha', description: 'd', content: 'BODY', filePath: '/ws/skills/alpha/SKILL.md' };
    const block = aiManager.buildSkillInvocationBlock({ skill, name: 'alpha' }, '', fmt);
    assert.ok(block.endsWith('用户显式调用了技能「alpha」'), '无 args 时块尾就是 provenance 行');
    assert.ok(block.includes('\n\n用户显式调用了技能「alpha」'));
  });

  test('拼接顺序：[skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]（源码 + 相对次序）', () => {
    const src = readSource('ai-manager.js');
    assert.ok(
      src.includes('[resolved.skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]'),
      'promptWithContext 的拼接数组必须以 skillBlock 打头且其余四段相对顺序不变'
    );
    const arrayIdx = src.indexOf('[resolved.skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]');
    const order = ['skillBlock', 'visionNotice', 'markerBlock', 'visionBlock', 'contextBlock'];
    let cursor = arrayIdx;
    for (const name of order) {
      const idx = src.indexOf(name, cursor);
      assert.ok(idx >= 0 && idx < arrayIdx + 200, `${name} 应出现在拼接数组内且次序正确`);
      cursor = idx;
    }
  });

  test('无技能调用时增强消息与改动前逐字符相同（skillBlock 为空被 filter 剔除）', async (t) => {
    const root = withTempRoot(t);
    const env = await setupSkillsEnv(root);
    // 普通消息（不含技能语法）→ skillBlock 必须为空串，且 skill 为 null
    const ctx = { sandboxEnv: env, getSeededSkillNamesSafe: () => [] };
    const resolved = await aiManager.prototype._resolveSkillInvocation.call(ctx, '帮我找 X');
    assert.strictEqual(resolved.skillBlock, '');
    assert.strictEqual(resolved.skill, null);
    assert.strictEqual(resolved.skillError, undefined, '普通消息不得产生 skillError');
    // 空 skillBlock 被 filter(Boolean) 剔除 → 分片序列与改动前逐字符相同
    const parts = [resolved.skillBlock, 'visionNotice', 'markerBlock', 'visionBlock', 'contextBlock']
      .filter(Boolean);
    assert.deepStrictEqual(parts, ['visionNotice', 'markerBlock', 'visionBlock', 'contextBlock']);
  });

  test('_deriveConversationTitle 打表（D-19：技能调用不退化）', () => {
    const derive = (text) => aiManager.prototype._deriveConversationTitle.call({}, text);
    assert.strictEqual(derive('/skill:find-skills'), '/skill:find-skills');
    assert.strictEqual(derive('/skill:alpha'), '/skill:alpha');
    assert.strictEqual(derive(''), '新对话');
    assert.strictEqual(derive('   '), '新对话');
    const long = '/skill:alpha ' + 'x'.repeat(50);
    assert.strictEqual(derive(long).length, 30, '超长时截断到 30 字符');
    assert.strictEqual(derive(long), long.trim().substring(0, 30));
  });

  test('源码：agent.prompt 收到增强文本，而 _ensureConversation 仍收原始文本（D-19）', () => {
    const src = readSource('ai-manager.js');
    assert.ok(src.includes('this._ensureConversation(message)'), '必须保留原始文本建/改对话标题');
    assert.strictEqual(
      (src.match(/this\._ensureConversation\(enhanced/g) || []).length,
      0,
      '不得把增强文本传给 _ensureConversation（否则标题会变成 <skill …> 垃圾）'
    );
    assert.ok(src.includes('const enhanced = '), 'agent.prompt 的实参必须是 enhanced 局部量');
    assert.ok(src.includes('await this.agent.prompt(enhanced'), '技能路径必须把增强文本交给 agent.prompt');
  });

  test('源码：解析与组装只有一份实现（prompt / promptWithContext 共用 _resolveSkillInvocation）', () => {
    const src = readSource('ai-manager.js');
    assert.strictEqual(
      (src.match(/await this\._resolveSkillInvocation\(message\)/g) || []).length,
      2,
      'prompt 与 promptWithContext 必须各调一次同一个私有方法（不得出现两份解析）'
    );
    for (const name of ['parseSkillInvocationText', 'buildSkillInvocationBlock', 'skillErrorFromReason', 'parseStoredSkillInvocation', 'resolveSkillBubbleArgs']) {
      assert.strictEqual(typeof aiManager[name], 'function', `ai-manager 必须导出 ${name}`);
    }
  });

  test('源码：skill-picker-model.js 在 renderer.js 之前加载（wave 1 端到端运行的前提）', () => {
    const html = readSource('src/index.html');
    const modelIdx = html.indexOf('skill-picker-model.js');
    const rendererIdx = html.indexOf('renderer.js"');
    assert.ok(modelIdx >= 0, 'index.html 必须加载 skill-picker-model.js');
    assert.ok(rendererIdx >= 0);
    assert.ok(modelIdx < rendererIdx, 'skill-picker-model.js 必须先于 renderer.js（后者顶层即引用该全局）');
  });
});

describe('D 组 · skillErrorFromReason（错误码与文案的唯一来源，DISC-06）', () => {
  test('两个码 + 两条文案逐字命中', () => {
    assert.deepStrictEqual(aiManager.skillErrorFromReason('not_found', 'foo'), {
      code: 'skill_not_found',
      message: '未找到技能「foo」，输入 / 查看可用技能',
    });
    assert.deepStrictEqual(aiManager.skillErrorFromReason('disabled', 'foo'), {
      code: 'skill_disabled',
      message: '技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用',
    });
  });

  test('返回值域只有两个码（不存在第三个）', () => {
    const codes = new Set(
      ['not_found', 'disabled', 'read_failed', 'bogus', undefined].map(
        (r) => aiManager.skillErrorFromReason(r, 'x').code
      )
    );
    assert.deepStrictEqual([...codes].sort(), ['skill_disabled', 'skill_not_found']);
  });

  test('_resolveSkillInvocation 走同一映射（不硬写文案）', () => {
    const body = methodBody(readSource('ai-manager.js'), '_resolveSkillInvocation');
    assert.ok(body.includes('skillErrorFromReason('), '必须调用唯一映射函数');
    assert.strictEqual(body.includes('未找到技能'), false, '不得在方法体内硬写文案');
    assert.strictEqual(body.includes('已被禁用'), false, '不得在方法体内硬写文案');
  });
});

describe('D 组 · 重载装饰（八例，getConversationMessages 还原）', () => {
  test('八例 args 还原 + 与 live 路径同形', async (t) => {
    const root = withTempRoot(t);
    const bodyText = '# alpha\n\n正文内容\n';
    writeSkill(workspace.getSkillsDir(), 'alpha', { body: bodyText });
    const env = await setupSkillsEnv(root);

    const read = await aiSkills.readSkillForInvocation(env, 'alpha');
    assert.strictEqual(read.ok, true);
    const skill = read.skill;
    const fmt = await sdkFormatSkillInvocation();
    const buildBlock = (args) =>
      aiManager.buildSkillInvocationBlock({ skill, name: 'alpha' }, args, fmt);

    const MARKER = '[attached_file: /tmp/ws/attachments/a.txt]';
    const REF = '<referenced-tab index="1" title="T" url="https://e.com">c</referenced-tab>';
    const refContext = (msg) => `${REF}\n\n用户消息：${msg}`;

    const NON_EMPTY = '帮我找 X';
    const MULTI = '第一段\n\n第二段';
    const MSG_A = `/skill:alpha ${NON_EMPTY}`;
    const MSG_MULTI = `/skill:alpha ${MULTI}`;
    const MSG_BARE = '/skill:alpha';

    const CASES = [
      { id: '①裸技能块（prompt 路径）', args: NON_EMPTY, message: MSG_A,
        build: (msg, args) => buildBlock(args), hasTail: false },
      { id: '②含 @ 引用的完整增强串', args: NON_EMPTY, message: MSG_A,
        build: (msg, args) => [buildBlock(args), MARKER, refContext(msg)].join('\n\n'), hasTail: true },
      { id: '③含附件（无引用）的完整增强串', args: NON_EMPTY, message: MSG_A,
        build: (msg, args) => [buildBlock(args), MARKER, msg].join('\n\n'), hasTail: true },
      { id: '④args 自身含空行', args: MULTI, message: MSG_MULTI,
        build: (msg, args) => buildBlock(args), hasTail: false },
      { id: '⑤a 空 args 裸技能块', args: '', message: MSG_BARE,
        build: (msg, args) => buildBlock(args), hasTail: false },
      { id: '⑤b 空 args + 附件', args: '', message: MSG_BARE,
        build: (msg, args) => [buildBlock(args), MARKER, msg].join('\n\n'), hasTail: true },
      { id: '⑤c 空 args + @ 引用', args: '', message: MSG_BARE,
        build: (msg, args) => [buildBlock(args), refContext(msg)].join('\n\n'), hasTail: true },
      { id: '⑤d 空 args + promptWithContext（无附件无引用）', args: '', message: MSG_BARE,
        build: (msg, args) => [buildBlock(args), msg].join('\n\n'), hasTail: true },
    ];

    for (const c of CASES) {
      const enhanced = c.build(c.message, c.args);
      const reloaded = aiManager.parseStoredSkillInvocation(enhanced, () => 'user');
      assert.ok(reloaded, `${c.id}: 必须被识别为技能调用消息`);

      // 正文逐字符等于 args（⑤a–⑤d 一律 ''）
      assert.strictEqual(reloaded.content, c.args, `${c.id}: content 必须逐字符等于 args`);
      assert.strictEqual(typeof reloaded.content, 'string', `${c.id}: content 必须是字符串`);

      // 块体逐字符等于读盘得到的 skill.content
      assert.strictEqual(reloaded.skillInvocation.content, skill.content, `${c.id}: 折叠块正文 = 读盘正文`);

      // 必须是「本次」读盘注入的正文（不是快照/历史残留）
      assert.strictEqual(reloaded.skillInvocation.name, 'alpha', `${c.id}: name 来自块属性`);

      if (c.hasTail) {
        for (const forbidden of [MARKER, '<referenced-tab', '用户消息：', '/skill:alpha']) {
          assert.strictEqual(
            reloaded.content.includes(forbidden), false,
            `${c.id}: 正文不得含尾段标记 ${forbidden}`
          );
        }
      }

      // 与 live 路径同一正文（两条路径的可失败等式）
      const live = aiManager.parseSkillInvocationText(c.message);
      assert.strictEqual(reloaded.content, live.args, `${c.id}: 重载路径 content 必须逐字符等于 live 路径 args`);
    }
  });

  test('resolveTier 返回假值时省略 tier 键（气泡照常渲染，不丢消息）', async (t) => {
    const root = withTempRoot(t);
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    const read = await aiSkills.readSkillForInvocation(env, 'alpha');
    const fmt = await sdkFormatSkillInvocation();
    const block = aiManager.buildSkillInvocationBlock({ skill: read.skill, name: 'alpha' }, 'x', fmt);

    const noTier = aiManager.parseStoredSkillInvocation(block, () => null);
    assert.ok(noTier, '找不到 tier 时仍必须装饰成功');
    assert.strictEqual('tier' in noTier.skillInvocation, false, '省略 tier 键（不写 undefined）');

    const withTier = aiManager.parseStoredSkillInvocation(block, () => 'builtin');
    assert.strictEqual(withTier.skillInvocation.tier, 'builtin');
  });

  test('重载路径对象键集合与 live 路径逐字相等（{name, tier, content} 三键）', async (t) => {
    const root = withTempRoot(t);
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    const ctx = { sandboxEnv: env, getSeededSkillNamesSafe: () => [] };

    const live = await aiManager.prototype._resolveSkillInvocation.call(ctx, '/skill:alpha 帮我找 X');
    assert.ok(live.skill, '前置：live 路径必须解析成功');
    assert.deepStrictEqual(
      Object.keys(live.skill).sort(), ['content', 'name', 'tier'],
      '返回契约只有三个键（不存在 contentLength 之类的声明型字段）'
    );

    // 用真实读盘对象（含 filePath）组装增强串，再走重载装饰
    const read = await aiSkills.readSkillForInvocation(env, 'alpha');
    const fmt = await sdkFormatSkillInvocation();
    const block = aiManager.buildSkillInvocationBlock({ skill: read.skill, name: 'alpha' }, '帮我找 X', fmt);
    const reloaded = aiManager.parseStoredSkillInvocation(block, () => live.skill.tier);
    assert.deepStrictEqual(
      Object.keys(reloaded.skillInvocation).sort(),
      Object.keys(live.skill).sort(),
      '重载路径的 skillInvocation 键集合必须与 live 路径逐字相等'
    );
    assert.strictEqual(reloaded.skillInvocation.content, live.skill.content);
    assert.strictEqual(reloaded.skillInvocation.tier, live.skill.tier);
  });

  test('非技能消息原样透传（parseStoredSkillInvocation → null）', () => {
    assert.strictEqual(aiManager.parseStoredSkillInvocation('帮我找 X', () => null), null);
    assert.strictEqual(
      aiManager.parseStoredSkillInvocation('<context-summary>\n正文\n</context-summary>', () => null),
      null
    );
    // 块头对但块后不是 provenance → 不是技能调用消息
    assert.strictEqual(
      aiManager.parseStoredSkillInvocation(
        '<skill name="alpha" location="/ws/skills/alpha/SKILL.md">\nReferences are relative to /ws/skills/alpha.\n\nBODY\n</skill>\n\n别的内容',
        () => null
      ),
      null
    );
  });

  test('源码：getConversationMessages 只调装饰方法，不直接出现 matchSkillByPath(', () => {
    const body = methodBody(readSource('ai-manager.js'), 'getConversationMessages');
    assert.ok(body.includes('_decorateSkillUserMessage('), '必须经独立装饰方法');
    assert.strictEqual(body.includes('matchSkillByPath('), false, '不得在本方法体内直接调 matchSkillByPath');
  });
});

describe('D 组 · resolveSkillBubbleArgs 打表（args 还原唯一规则）', () => {
  test('五类形态 + 两趟扫描顺序 + 回落语义', async (t) => {
    const root = withTempRoot(t);
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    const read = await aiSkills.readSkillForInvocation(env, 'alpha');
    const fmt = await sdkFormatSkillInvocation();
    const buildBlock = (args) =>
      aiManager.buildSkillInvocationBlock({ skill: read.skill, name: 'alpha' }, args, fmt);

    const MARKER = '[attached_file: /tmp/ws/attachments/a.txt]';
    const REF = '<referenced-tab index="1">c</referenced-tab>';
    const msg = '/skill:alpha 帮我找 X';

    // ① 非空 args，无尾段（prompt() 路径）→ R 恰为 args
    assert.strictEqual(aiManager.resolveSkillBubbleArgs(buildBlock('帮我找 X'), 'alpha'), '帮我找 X');
    // ② 非空 args + 尾段（promptWithContext 形态）→ 仍取末段语法文本的 args
    assert.strictEqual(
      aiManager.resolveSkillBubbleArgs([buildBlock('帮我找 X'), MARKER, msg].join('\n\n'), 'alpha'),
      '帮我找 X'
    );
    assert.strictEqual(
      aiManager.resolveSkillBubbleArgs([buildBlock('帮我找 X'), `${REF}\n\n用户消息：${msg}`].join('\n\n'), 'alpha'),
      '帮我找 X'
    );
    // ④ args 含空行 → 逐字符还原（「按段分隔符截首段」会失败的判据）
    assert.strictEqual(
      aiManager.resolveSkillBubbleArgs(buildBlock('第一段\n\n第二段'), 'alpha'),
      '第一段\n\n第二段'
    );
    // ⑤a–⑤d 空 args 四形态 → 恒为 ''（上一轮 blocker 的回归守卫）
    const EMPTY_CASES = [
      ['⑤a prompt() 裸技能块', buildBlock('')],
      ['⑤b 附件', [buildBlock(''), MARKER, msg].join('\n\n')],
      ['⑤c @引用', [buildBlock(''), `${REF}\n\n用户消息：${msg}`].join('\n\n')],
      ['⑤d promptWithContext 无附件无引用', [buildBlock(''), msg].join('\n\n')],
    ];
    for (const [id, enhanced] of EMPTY_CASES) {
      const args = aiManager.resolveSkillBubbleArgs(enhanced, 'alpha');
      assert.strictEqual(args, '', `${id}: 必须返回字符串 ''`);
      assert.strictEqual(typeof args, 'string', `${id}: 类型必须是字符串`);
      for (const forbidden of [MARKER, '<referenced-tab', '用户消息：', '/skill:alpha']) {
        assert.strictEqual(args.includes(forbidden), false, `${id}: 不得把尾段当正文（${forbidden}）`);
      }
    }
    // 空 args 且无尾段（prompt() 路径）→ ''
    assert.strictEqual(aiManager.resolveSkillBubbleArgs(buildBlock(''), 'alpha'), '');

    // 两趟扫描顺序：args 含空行且内嵌同名语法 token，尾段语法文本使第一趟非空解胜出
    const trickyArgs = '第一段\n\n/skill:alpha';
    const trickyMsg = `/skill:alpha ${trickyArgs}`;
    const trickyEnhanced = [buildBlock(trickyArgs), trickyMsg].join('\n\n');
    assert.strictEqual(
      aiManager.resolveSkillBubbleArgs(trickyEnhanced, 'alpha'),
      trickyArgs,
      '第一趟的非空前缀解必须胜出（不得被串尾的假候选抢先给出 ""）'
    );

    // 已知窄洞（STATE.md 已披露）：纯 prompt() 路径下 args 尾段恰为 '\n\n' + '/skill:alpha'
    // 与「args 为空的 promptWithContext 形态」逐字符同形，任何规则都无法区分 → 按后者解释为 ''
    assert.strictEqual(
      aiManager.resolveSkillBubbleArgs(buildBlock(trickyArgs), 'alpha'),
      '',
      '该病态输入按已披露的口径解释为空 args（不影响消息内容与注入）'
    );

    // 出现过候选但都没锚中 → 回落 '' 而非整段尾段
    const mismatched = [buildBlock('真 args'), '/skill:alpha 别的 args'].join('\n\n');
    assert.strictEqual(aiManager.resolveSkillBubbleArgs(mismatched, 'alpha'), '');

    // 不是该技能的调用消息 → null
    assert.strictEqual(aiManager.resolveSkillBubbleArgs('普通消息', 'alpha'), null);
    assert.strictEqual(aiManager.resolveSkillBubbleArgs(buildBlock('x'), 'beta'), null);
  });
});

describe('D 组 · 投影收窄 / tier 三档 / promptOmitted / DISC-07', () => {
  test('getSkillsForUI 是收窄投影：每个条目不含 content / filePath / diagnostics', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha');
    writeSkill(workspace.getManagedSkillsDir(), 'beta');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const ui = aiSkills.getSkillsForUI([]);
    assert.strictEqual(ui.skills.length, 2);
    assert.strictEqual(typeof ui.digest, 'string');
    assert.strictEqual(typeof ui.refreshedAt, 'number');
    for (const e of ui.skills) {
      assert.strictEqual('content' in e, false, '投影不得携带技能正文（T-48-05）');
      assert.strictEqual('filePath' in e, false, '投影不得携带 filePath');
      assert.strictEqual('diagnostics' in e, false, '投影不得携带诊断');
      for (const key of ['name', 'description', 'tier', 'disableModelInvocation', 'disabled', 'shadowed', 'overLimit', 'promptOmitted']) {
        assert.ok(key in e, `投影必须含 ${key}`);
      }
    }
  });

  test('tier 三档判定：user / seeded builtin / 非 seeded managed', () => {
    const entries = {
      user: { skill: { name: 'alpha' }, source: 'user' },
      seeded: { skill: { name: 'find-skills' }, source: 'managed' },
      managed: { skill: { name: 'my-own' }, source: 'managed' },
    };
    assert.strictEqual(aiSkills.sourceTierOf(entries.user, []), 'user');
    assert.strictEqual(aiSkills.sourceTierOf(entries.seeded, ['find-skills']), 'builtin');
    assert.strictEqual(aiSkills.sourceTierOf(entries.managed, ['find-skills']), 'managed');
    assert.strictEqual(aiSkills.toUISkillEntry(entries.seeded, ['find-skills']).tier, 'builtin');
    assert.strictEqual(aiSkills.toUISkillEntry(entries.managed, ['find-skills']).tier, 'managed');
  });

  test('seeded 集合可经 seeder.setBuiltinDepsForTest 注入真实随包目录（t.after 复位）', (t) => {
    seeder.setBuiltinDepsForTest({ srcDir: REAL_BUILTIN_SRC });
    t.after(() => seeder._resetForTest());
    const seeded = seeder.getSeededSkillNames();
    assert.ok(Array.isArray(seeded) && seeded.length > 0, '真实随包目录应含至少一个内置技能');
    const entry = { skill: { name: seeded[0] }, source: 'managed' };
    assert.strictEqual(aiSkills.sourceTierOf(entry, seeded), 'builtin');
  });

  test('matchSkillByPath：规范化全等命中；非 SKILL.md / 工作区外不命中', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const file = writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    assert.deepStrictEqual(aiSkills.matchSkillByPath(file, []), { name: 'alpha', tier: 'user' });
    assert.deepStrictEqual(
      aiSkills.matchSkillByPath(path.join(path.dirname(file), '..', 'alpha', 'SKILL.md'), []),
      { name: 'alpha', tier: 'user' },
      '含 .. 的相对段必须被 path.resolve 规范化后命中'
    );
    assert.strictEqual(aiSkills.matchSkillByPath(path.join(path.dirname(file), 'README.md'), []), null);
    assert.strictEqual(aiSkills.matchSkillByPath('/tmp/outside/SKILL.md', []), null);
    assert.strictEqual(aiSkills.matchSkillByPath('', []), null);
    assert.strictEqual(aiSkills.matchSkillByPath(null, []), null);
  });

  test('DISС-07：disable-model-invocation 不进 prompt、仍可显式调用、投影标真且不 promptOmitted', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'normal', { description: '普通技能' });
    writeRawSkill(workspace.getSkillsDir(), 'explicit-only', 'disable-model-invocation: true\n');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { rootDirs: scanRoots() });

    const snap = aiSkills.getSkillsSnapshot();
    const entry = snap.skills.find((e) => e.skill.name === 'explicit-only');
    assert.ok(entry, '前置：explicit-only 应被加载');

    // ① 不进 system prompt
    const block = aiSkills.buildSkillsPrompt();
    assert.strictEqual(block.includes('explicit-only'), false, '仅显式技能不得出现在 buildSkillsPrompt() 里');
    assert.ok(block.includes('normal'), '对照：普通技能仍进 prompt');

    // ② 仍可经 /skill: 显式调用
    const res = await aiSkills.readSkillForInvocation(env, 'explicit-only');
    assert.strictEqual(res.ok, true, '仅显式技能必须仍可显式调用（{ok:true}）');

    // ③ 投影：disableModelInvocation === true 且 promptOmitted !== true
    const ui = aiSkills.getSkillsForUI([]).skills.find((e) => e.name === 'explicit-only');
    assert.strictEqual(ui.disableModelInvocation, true);
    assert.notStrictEqual(ui.promptOmitted, true, '仅显式条目永不 promptOmitted');

    // flag 独立性：disableModelInvocation 与 disabled 互不蕴含（同时为真时禁用面胜出）
    await aiSkills.refreshSkills(env, { disabled: ['explicit-only'], rootDirs: scanRoots() });
    const disabledRes = await aiSkills.readSkillForInvocation(env, 'explicit-only');
    assert.deepStrictEqual(disabledRes, { ok: false, reason: 'disabled', name: 'explicit-only' });
  });

  test('promptOmitted 只打在 ⑦ 预算丢弃的 eligible 条目上（P-48-08 边界一致）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    // 20 条长描述（必然超 8000 预算）+ 31 条短描述（使 user 总数 > MAX_USER_SKILLS=50）
    for (let i = 0; i < 20; i += 1) {
      writeSkill(workspace.getSkillsDir(), `long-${String(i).padStart(3, '0')}`, {
        description: 'y'.repeat(400),
      });
    }
    for (let i = 20; i < 51; i += 1) {
      writeSkill(workspace.getSkillsDir(), `long-${String(i).padStart(3, '0')}`);
    }
    writeRawSkill(workspace.getSkillsDir(), 'explicit-only', 'disable-model-invocation: true\n');
    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, { disabled: ['off-skill'], rootDirs: scanRoots() });

    const ui = aiSkills.getSkillsForUI([]).skills;
    assert.ok(ui.some((e) => e.promptOmitted === true), '应存在被预算丢弃的条目');
    assert.ok(ui.some((e) => e.overLimit === true), '前置：应存在超数量上限的条目');

    for (const e of ui) {
      if (e.shadowed === true || e.disabled === true || e.overLimit === true || e.disableModelInvocation === true) {
        assert.notStrictEqual(
          e.promptOmitted, true,
          `${e.name}: 遮蔽/禁用/超限/仅显式条目永不被标 promptOmitted（P-48-08）`
        );
      }
    }
  });
});

// ==================== 48-01 E 组：面板入口接线 / 措辞 / 通道护栏（源码扫描） ====================

describe('E 组 · 面板入口接线（D-17 / P8 触发点）', () => {
  test('refreshSkillsForPanel 复用 syncAgentSystemPrompt 并返回投影（源码）', () => {
    const body = methodBody(readSource('ai-manager.js'), 'refreshSkillsForPanel');
    assert.ok(body.includes('await this.syncAgentSystemPrompt()'), '必须复用既有失效链');
    assert.ok(body.includes('getSkillsForUI()'), '必须返回刷新后的收窄投影');
    assert.strictEqual(body.includes('new Agent('), false, '不得重建 Agent');
  });

  test('refreshSkillsForPanel 是 syncAgentSystemPrompt 的读侧生产调用方（P8 闭环半边）', () => {
    const src = readSource('ai-manager.js');
    const body = methodBody(src, 'refreshSkillsForPanel');
    assert.ok(
      body.includes('await this.syncAgentSystemPrompt()'),
      '必须存在生产调用方（否则 syncAgentSystemPrompt 仍无调用者）'
    );
    const ipc = readSource('ipc-handlers.js');
    const idx = ipc.indexOf("'ai:refresh-skills'");
    assert.ok(idx >= 0, 'ipc-handlers 必须注册 ai:refresh-skills');
    assert.ok(
      ipc.slice(idx, idx + 400).includes('refreshSkillsForPanel'),
      'ai:refresh-skills 必须调用 refreshSkillsForPanel'
    );
  });

  test('syncAgentSystemPrompt 的方法体未被重构（46-04 五条断言继续成立）', () => {
    const body = methodBody(readSource('ai-manager.js'), 'syncAgentSystemPrompt');
    assert.ok(body.includes('refreshSkills('));
    assert.ok(body.includes('this.agent.state.systemPrompt = next'));
    assert.ok(body.includes("windowManager.broadcast('skills:changed')"));
    assert.ok(body.includes('this._skillsPromptDirty = true'));
    assert.ok(body.includes('snap.digest === this._skillsPromptDigest'));
  });

  test('REALM_SYSTEM_PROMPT 补了技能 / 工具的概念区分（D-18）', () => {
    const src = readSource('ai-manager.js');
    assert.ok(src.includes('技能（Skill）'), '应点名「技能（Skill）」');
    assert.ok(src.includes('工具（Tool）'), '应点名「工具（Tool）」');
    assert.ok(src.includes('是两个不同的概念'), '必须明确两者是不同概念');
    assert.ok(src.includes('按需读取的指令文档'), '技能应被描述为按需读取的指令文档 / 工作流');
    assert.ok(src.includes('正文不在提示词里'), '应说明技能正文不在提示词里');
    assert.ok(src.includes('read 工具打开'), '应给出读取正文的途径');
    // 不得写成「技能可自动注入」这类虚假措辞
    assert.strictEqual(src.includes('技能可自动注入'), false);
  });

  test('技能段仍逐字符等于 buildSkillsPrompt()（46 D-02 未被 D-18 触碰）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha', { description: '措辞用例技能' });
    await setupSkillsEnv(root);

    const skillsBlock = aiSkills.buildSkillsPrompt();
    assert.ok(skillsBlock.length > 0, '前置：技能段非空');
    const prompt = aiManager.buildSystemPrompt();
    assert.ok(prompt.includes(skillsBlock), 'buildSystemPrompt 必须原样包含技能段');
    assert.strictEqual(
      prompt.slice(prompt.length - skillsBlock.length),
      skillsBlock,
      '技能段必须逐字符等于 buildSkillsPrompt() 的返回值（固定在末段且未加前缀）'
    );
    assert.ok(prompt.includes('技能（Skill）'), '第 1 段的 D-18 措辞应同时存在');
  });
});

describe('E 组 · 通道成对 / 转义护栏（源码扫描）', () => {
  test('ipc-handlers：两个新通道都在 assertTrustedSender 之后、且在 aiManager 判空后返回', () => {
    const src = readSource('ipc-handlers.js');
    for (const channel of ['ai:get-skills', 'ai:refresh-skills']) {
      const idx = src.indexOf(`'${channel}'`);
      assert.ok(idx >= 0, `缺少通道 ${channel}`);
      const seg = src.slice(idx, idx + 400);
      assert.ok(seg.includes('assertTrustedSender(event)'), `${channel} 必须校验可信发送者`);
      const guardIdx = seg.indexOf("throw new Error('AI Manager 未初始化')");
      const returnIdx = seg.indexOf('return aiManager.');
      assert.ok(guardIdx >= 0, `${channel} 必须有 aiManager 判空`);
      assert.ok(returnIdx > guardIdx, `${channel} 的返回必须在判空之后`);
    }
  });

  test('src/preload.js 成对暴露 getSkills / refreshSkills', () => {
    const src = readSource('src/preload.js');
    assert.ok(src.includes("getSkills: () => ipcRenderer.invoke('ai:get-skills')"));
    assert.ok(src.includes("refreshSkills: () => ipcRenderer.invoke('ai:refresh-skills')"));
  });

  test('新增通道不得走本地 HTTP API（Phase 38 事故护栏）', () => {
    const src = readSource('src/renderer.js');
    assert.strictEqual(
      (src.match(/fetch\(['"]\/api\/skills/g) || []).length,
      0,
      "主窗口 file:// 不能 fetch 本地 HTTP API，技能数据必须走 realmAPI.ai.*"
    );
    assert.strictEqual(
      (src.match(/http:\/\/localhost[^\n]*skill/gi) || []).length,
      0,
      '技能相关路径不得出现 http://localhost'
    );
  });
});

// ==================== 48-01 F 组：renderer 调用路径接线（源码扫描） ====================

describe('F 组 · renderer 调用路径（D-06 / D-19 / 重发路径）', () => {
  const rendererSrc = readSource('src/renderer.js');
  const bodyOf = (name) => {
    const start = rendererSrc.indexOf(`async function ${name}(`);
    assert.ok(start >= 0, `应存在 async function ${name}(`);
    return rendererSrc.slice(start, rendererSrc.indexOf('\n}', start));
  };

  test('handleSendAIMessage：预检位置在 aiStreaming 守卫之前 + 两条拒绝分支', () => {
    const body = bodyOf('handleSendAIMessage');
    const guardIdx = body.indexOf('if (state.aiStreaming) return;');
    const precheckIdx = body.indexOf('disabled === true');
    assert.ok(guardIdx >= 0, '必须保留流式守卫');
    assert.ok(precheckIdx >= 0, '必须插入技能预检');
    assert.ok(precheckIdx < guardIdx, '技能预检必须在流式守卫之前（否则流式中调用被静默丢弃）');
    assert.ok(body.includes("'未找到技能「' + ref.name + '」，输入 / 查看可用技能'"), '未找到文案');
    assert.ok(
      body.includes("'技能「' + ref.name + '」已被禁用，可在 设置 → AI → 技能管理 重新启用'"),
      '禁用文案'
    );
    assert.ok(body.includes('未知命令 '), '两边都不命中仍走未知命令路径');
  });

  test('state.aiSkills / state.aiSkillsDigest 已建立且预检查的是含禁用条目的投影', () => {
    assert.ok(rendererSrc.includes('aiSkills:'),
      '必须新增 state.aiSkills（主进程收窄投影缓存，含已禁用条目）');
    assert.ok(rendererSrc.includes('aiSkillsDigest:'), '必须新增 state.aiSkillsDigest');
    const body = bodyOf('handleSendAIMessage');
    assert.ok(body.includes('state.aiSkills'), '预检必须查 state.aiSkills');
  });

  test('重发路径：两处 ai.prompt 实参均为 payload 且均带 await；唯一实现', () => {
    assert.strictEqual(
      (rendererSrc.match(/function buildResendPayload\(/g) || []).length,
      1,
      'buildResendPayload 必须只有一份实现'
    );
    const defIdx = rendererSrc.indexOf('function buildResendPayload(');
    const def = rendererSrc.slice(defIdx, rendererSrc.indexOf('\n}', defIdx));
    assert.ok(def.includes('buildSkillSyntaxText('), '函数体必须由反向唯一实现重组语法文本');
    assert.ok(def.includes('skillInvocation.name'), '技能调用消息必须走重组分支');

    const regen = bodyOf('regenerateMessage');
    assert.ok(regen.includes('buildResendPayload('), 'regenerateMessage 必须共用');
    assert.ok(regen.includes('await window.realmAPI.ai.prompt(payload)'), '必须 await payload');
    assert.strictEqual(
      (regen.match(/realmAPI\.ai\.prompt\(/g) || []).length,
      1,
      'regenerateMessage 内只应有一处 ai.prompt 调用'
    );
    assert.ok(regen.includes('if (!payload)'), '空值守卫必须以 payload 为判据');

    const retryIdx = rendererSrc.indexOf('retryBtn.addEventListener');
    const retry = rendererSrc.slice(retryIdx, retryIdx + 1800);
    assert.ok(retry.includes('buildResendPayload('), '错误重试必须共用');
    assert.ok(retry.includes('await window.realmAPI.ai.prompt(payload)'), '重试必须 await payload');
  });

  test('重发路径消费响应：skillError 复位 + system-note；skillInvocation 覆盖折叠块正文', () => {
    const regen = bodyOf('regenerateMessage');
    assert.ok(regen.includes('res.skillError'), '必须消费 skillError');
    assert.ok(regen.includes('pushSystemNote(res.skillError.message)'), '错误走 system-note');
    assert.ok(regen.includes('res.skillInvocation'), '必须用本次读盘结果覆盖 skillInvocation');
    const retryIdx = rendererSrc.indexOf('retryBtn.addEventListener');
    const retry = rendererSrc.slice(retryIdx, retryIdx + 1800);
    assert.ok(retry.includes('res.skillError'), '重试路径同样消费 skillError');
    assert.ok(retry.includes('res.skillInvocation'), '重试路径同样覆盖 skillInvocation');
  });

  test('气泡折叠块 N 口径为 String.length；不出现字节口径', () => {
    const start = rendererSrc.indexOf('function renderSkillContentBox(');
    assert.ok(start >= 0, '应存在 renderSkillContentBox');
    const body = rendererSrc.slice(start, rendererSrc.indexOf('\n}', start));
    assert.ok(body.includes('skillInvocation.content.length'), 'N 必须是 content.length');
    assert.ok(body.includes('技能正文（'), 'header 文案必须是「技能正文（N 字符）」');
    assert.strictEqual(body.includes('innerHTML'), false, '折叠块必须走 DOM API + textContent');
    assert.strictEqual(rendererSrc.includes('Buffer.byteLength'), false);
    assert.strictEqual(rendererSrc.includes('TextEncoder'), false);
  });
});




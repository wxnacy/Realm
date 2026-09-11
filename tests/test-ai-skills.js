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

    const codes = [...src.matchAll(/code: '(realm_[a-z_]+)'/g)].map((m) => m[1]);
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
    const budgetDiagCodes = [...src.matchAll(/code: '(realm_[a-z_]+)'/g)].map((m) => m[1]);
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
  });
});


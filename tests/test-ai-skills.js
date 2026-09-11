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

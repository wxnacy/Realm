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
const conversationStore = require('../ai-conversations-manager');

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

/**
 * 写入一个契约布局技能：<scannedDir>/<name>/SKILL.md
 *
 * `frontmatterName` 默认等于目录名（既有调用逐字等价）；显式传入不同值即可造出
 * 「frontmatter name ≠ 目录名」的技能（D-08 明确保留的合法形态，G-48-2 靶心）。
 */
function writeSkill(
  scannedDir,
  name,
  { description = `${name} 技能描述`, body = `# ${name}\n\n正文内容\n`, frontmatterName = name } = {}
) {
  const dir = path.join(scannedDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(
    file,
    `---\nname: ${frontmatterName}\ndescription: ${description}\n---\n\n${body}`
  );
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
    assert.strictEqual(busy._skillsPromptDirty, true, '忙时必须置脏（由延迟补刷在成功出口落地）');
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

  test('源码：延迟补刷是单源实现（G-48-18 的配套改写 —— 旧内联块形态已被取代，不是放宽护栏）', () => {
    const src = readSource('ai-manager.js');
    const body = methodBody(src, '_flushDeferredSkillsPrompt');
    assert.ok(body.length >= 150, `补刷方法体提取口径失效会假绿（实际 ${body.length}）`);
    const checkIdx = body.indexOf('if (!this._skillsPromptDirty)');
    const resetIdx = body.indexOf('this._skillsPromptDirty = false');
    const syncIdx = body.indexOf('await this.syncAgentSystemPrompt()');
    const restoreIdx = body.indexOf('this._skillsPromptDirty = true');
    assert.ok(checkIdx >= 0, '补刷首行必须检脏早退（否则每条普通消息都多付一次全量重扫）');
    assert.ok(resetIdx >= 0, '补刷必须先复位脏标记');
    assert.ok(checkIdx < resetIdx, '检脏判断必须位于复位之前（早退零成本）');
    assert.ok(syncIdx >= 0, '补刷必须复用唯一权威入口 syncAgentSystemPrompt()');
    assert.ok(restoreIdx > syncIdx, '失败恢复置脏必须位于同步调用之后（WR-04：变更不得静默丢弃）');

    const plain = methodBody(src, 'prompt');
    assert.ok(
      plain.includes('await this._flushDeferredSkillsPrompt()'),
      'prompt() 的成功出口必须共用补刷实现（G-48-18：纯文本通道的落地点）'
    );
    const withContext = methodBody(src, 'promptWithContext');
    assert.ok(
      withContext.includes('await this._flushDeferredSkillsPrompt()'),
      'promptWithContext() 的成功出口必须共用补刷实现'
    );
    assert.strictEqual(
      withContext.includes('this._skillsPromptDirty'),
      false,
      'promptWithContext() 内不得残留任何脏标记读写（否则就是第二份实现）'
    );
    assert.strictEqual(
      (src.match(/await this\._flushDeferredSkillsPrompt\(\)/g) || []).length,
      2,
      '补刷调用点必须恰 2 处（两个成功出口各一次）'
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

/**
 * `manage_skill` 工具项的**实际对象形状**（不是朴素正则）
 *
 * 取运行时对象而非源码文本：`Object.keys(parameters.properties)` 是判别
 * 「键集合恰为四参数、绝无 path」的唯一可靠方式 —— 用会误收嵌套键的正则会让
 * 判据 2 的验收面假绿。
 */
function buildManageSkillTool() {
  const tool = aiManager.prototype._buildManageSkillTool.call({});
  assert.ok(tool && typeof tool === 'object', '必须存在 _buildManageSkillTool()');
  return tool;
}

/** 取 `manage_skill` 工具项在 ai-manager.js 源码中的片段（从 name 字面量起 6000 字符） */
function manageSkillToolSource() {
  const src = readSource('ai-manager.js');
  const idx = src.indexOf("name: 'manage_skill'");
  assert.ok(idx >= 0, 'ai-manager.js 必须存在 manage_skill 工具项');
  return src.slice(idx, idx + 6000);
}

describe('manage_skill 工具项（Phase 49 / MGMT-02 / MGMT-03 / MGMT-06）', () => {
  test('工具已注册进 _buildRealmTools()，且 properties 顶层键集合恰为四参数、无 path', () => {
    const src = readSource('ai-manager.js');
    assert.ok(
      methodBody(src, '_buildRealmTools').includes('this._buildManageSkillTool()'),
      'manage_skill 必须经 _buildManageSkillTool() 注册进 _buildRealmTools()'
    );

    const tool = buildManageSkillTool();
    assert.strictEqual(tool.name, 'manage_skill');
    assert.deepStrictEqual(
      Object.keys(tool.parameters.properties).sort(),
      ['action', 'content', 'description', 'name'],
      'properties 顶层键集合必须**恰为** {action, name, content, description}'
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(tool.parameters.properties, 'path'),
      false,
      'prop 键集合里绝不能出现 path（判据 2：路径由 manager 用 path.join 计算）'
    );
    assert.strictEqual(
      /"path"\s*:/.test(JSON.stringify(tool.parameters)),
      false,
      'parameters 整体不得出现 path 参数（ARCHITECTURE Anti-Pattern 1：接口设计才是边界）'
    );
    assert.deepStrictEqual(tool.parameters.required, ['action', 'name']);
    assert.strictEqual(tool.executionMode, 'sequential', 'executionMode 必须为 sequential（防同批次并发写）');
  });

  test('action 的 enum 恰为 create / update / delete 三值', () => {
    const tool = buildManageSkillTool();
    assert.deepStrictEqual(tool.parameters.properties.action.enum, ['create', 'update', 'delete']);
  });

  test('工具描述含 D-03 / MGMT-06 的两条文案，且不写进 REALM_SYSTEM_PROMPT', () => {
    const desc = buildManageSkillTool().description;
    // 判据必须用**完整**的两条文案：REALM_SYSTEM_PROMPT 里本就有一句「仅在用户明确要求
    // 「在当前标签页打开」时使用」（open_link 的规则），短片段「仅在用户明确要求」会在
    // prompt 里误命中 ⇒ 断言必须锚定 D-03 的完整措辞，否则该判据恒假失败
    const RULE_A = '仅在用户明确要求把某套流程或经验沉淀为技能时调用';
    const RULE_B = '优先增强已有技能，而非创建近乎重复的新技能';
    assert.ok(desc.includes(RULE_A), '必须含 D-03 文案 ①（落地 anti-feature：不做 autolearn 推促）');
    assert.ok(desc.includes(RULE_B), '必须含 D-03 文案 ②（MGMT-06 / Capture sparingly）');
    assert.ok(desc.includes('下一条消息'), '描述须给出生效时间语义（D-13 的忙时语义对用户不可见）');

    const src = readSource('ai-manager.js');
    const promptStart = src.indexOf('const REALM_SYSTEM_PROMPT');
    assert.ok(promptStart >= 0, '应存在 REALM_SYSTEM_PROMPT');
    const promptEnd = src.indexOf('`;', promptStart);
    assert.ok(promptEnd > promptStart, 'REALM_SYSTEM_PROMPT 应为模板字符串常量');
    const promptText = src.slice(promptStart, promptEnd);
    assert.strictEqual(
      promptText.includes(RULE_A),
      false,
      '两条文案**不得**进 REALM_SYSTEM_PROMPT（D-03：避免第 1 段改动重建 provider 前缀缓存）'
    );
    assert.strictEqual(promptText.includes(RULE_B), false);
  });

  test('execute 内刷新链唯一：恰 1 处 syncAgentSystemPrompt()、0 处 refreshSkills(、0 处确认调用', () => {
    const seg = manageSkillToolSource();
    assert.ok(
      seg.includes('await this.syncAgentSystemPrompt()'),
      '成功后必须接唯一权威入口 syncAgentSystemPrompt()'
    );
    // syncAgentSystemPrompt() 函数体内**已含** refreshSkills 重扫；再写一行就是三次全量重扫（D-13）
    assert.strictEqual(
      (seg.match(/await this\.syncAgentSystemPrompt\(\)/g) || []).length,
      1,
      'syncAgentSystemPrompt() 必须恰 1 处'
    );
    assert.strictEqual(/refreshSkills\(/.test(seg), false, '工具内不得直接调 refreshSkills（D-13 禁止）');
    assert.strictEqual(
      seg.includes('requestActionConfirmation'),
      false,
      'execute 内不得出现确认调用（D-01 锁定三动作一律自动）'
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

  test('目录被换成别的技能（目录读不到 / 路径不等）→ not_found', async (t) => {
    const root = withTempRoot(t);
    writeSkill(workspace.getSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    // 把 alpha 目录整体移除、另建一个别的技能目录
    const dir = path.join(workspace.getSkillsDir(), 'alpha');
    fs.rmSync(dir, { recursive: true, force: true });
    writeSkill(workspace.getSkillsDir(), 'beta');
    const res = await aiSkills.readSkillForInvocation(env, 'alpha');
    // 同一性判据是**所在目录**（不是 SDK 读回的 name）：alpha 目录读不到 → 按不存在处理
    assert.deepStrictEqual(res, { ok: false, reason: 'not_found', name: 'alpha' });
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

  // G-48-2：frontmatter name ≠ 目录名 的技能（46 D-08 明确保留的合法形态，GitHub 导入常见）。
  // 修复前 readSkillForInvocation 恒返回 not_found —— 面板按目录名列出并标「可显式调用」，
  // 用户点了/手打了却没反应。以下三例在旧实现下必然失败（ok:true 与 name === 目录名 均为假）。

  test('目录名与 frontmatter name 不一致的技能可正常显式调用（G-48-2 靶心）', async (t) => {
    const root = withTempRoot(t);
    const file = writeSkill(workspace.getSkillsDir(), 'evil', {
      frontmatterName: 'find-skills',
      description: '冒名技能描述',
      body: '# evil\n\n正文一\n',
    });
    const env = await setupSkillsEnv(root);

    // 缓存层：目录名权威（enforceDirNameAuthority 就地重写）→ 面板按 evil 列出
    const cached = aiSkills.getSkillsSnapshot().skills.find((e) => e.source === 'user');
    assert.ok(cached, '前置：user 技能应进缓存');
    assert.strictEqual(cached.skill.name, 'evil', '缓存层 name 必须已被重写为目录名');

    const res = await aiSkills.readSkillForInvocation(env, 'evil');
    assert.strictEqual(res.ok, true, `name≠目录名 的合法技能必须可显式调用: ${JSON.stringify(res)}`);
    assert.strictEqual(res.source, 'user');
    assert.ok(res.skill.content.includes('正文一'), '读到的正文来自该目录');
    // 靶心断言：注入用 name 是**目录名**，不是 frontmatter 里的冒名 name（防冒名 46 D-08）
    assert.strictEqual(res.skill.name, 'evil', '注入用 name 必须是目录名');
    assert.notStrictEqual(res.skill.name, 'find-skills', '不得使用 frontmatter 里声明的名字');
    assert.strictEqual(
      path.resolve(path.dirname(res.skill.filePath)),
      path.resolve(path.dirname(file)),
      '命中对象必须来自缓存条目所在的同一个目录'
    );
  });

  test('注入块的 name 属性与 provenance 行都是目录名（冒名 name 不进块）', async (t) => {
    const root = withTempRoot(t);
    writeSkill(workspace.getSkillsDir(), 'evil', {
      frontmatterName: 'find-skills',
      description: '冒名技能描述',
      body: '# evil\n\n正文一\n',
    });
    const env = await setupSkillsEnv(root);

    const res = await aiSkills.readSkillForInvocation(env, 'evil');
    assert.strictEqual(res.ok, true, `前置：应读盘成功: ${JSON.stringify(res)}`);

    const fmt = await sdkFormatSkillInvocation();
    const block = aiManager.buildSkillInvocationBlock(
      { skill: res.skill, name: 'evil' },
      '帮我找 X',
      fmt
    );

    assert.ok(block.includes('name="evil"'), '注入块 name 属性必须是目录名');
    assert.ok(
      block.includes(`location="${path.join(workspace.getSkillsDir(), 'evil', 'SKILL.md')}"`),
      '注入块 location 必须是该技能 SKILL.md 的绝对路径'
    );
    assert.strictEqual(
      block.includes('name="find-skills"'),
      false,
      'frontmatter 里的冒名 name 不得进注入块'
    );
    assert.ok(block.includes('用户显式调用了技能「evil」'), 'provenance 行同样用目录名');
  });

  test('name 不一致 + 实时读盘：不刷新缓存也能读到改盘后的新正文，name 仍是目录名', async (t) => {
    const root = withTempRoot(t);
    const file = writeSkill(workspace.getSkillsDir(), 'evil', {
      frontmatterName: 'find-skills',
      description: '冒名技能描述',
      body: '# evil\n\n正文一\n',
    });
    const env = await setupSkillsEnv(root);

    const first = await aiSkills.readSkillForInvocation(env, 'evil');
    assert.strictEqual(first.ok, true, `前置：首次调用应成功: ${JSON.stringify(first)}`);
    assert.ok(first.skill.content.includes('正文一'), '首次读到正文一');

    // 把 frontmatter 的 name 改成第三个值（目录名不变），且**不**重新 refreshSkills
    fs.writeFileSync(
      file,
      '---\nname: totally-different\ndescription: 冒名技能描述\n---\n\n# evil\n\n正文二\n'
    );

    const second = await aiSkills.readSkillForInvocation(env, 'evil');
    assert.strictEqual(second.ok, true, '实时读盘必须当场反映磁盘（不依赖快照刷新）');
    assert.ok(second.skill.content.includes('正文二'), '二次调用必须读到新正文');
    assert.strictEqual(second.skill.content.includes('正文一'), false, '旧正文不得残留');
    assert.strictEqual(second.skill.name, 'evil', 'name 仍取目录名，不随 frontmatter 漂移');
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

  test('handleSendAIMessage：技能分支位置在 aiStreaming 守卫之前 + 无本地否决（G-48-3）', () => {
    const body = bodyOf('handleSendAIMessage');
    const guardIdx = body.indexOf('if (state.aiStreaming) return;');
    const branchIdx = body.indexOf("kind === 'skill'");
    assert.ok(guardIdx >= 0, '必须保留流式守卫');
    assert.ok(branchIdx >= 0, '必须存在技能分支');
    assert.ok(branchIdx < guardIdx, '技能分支必须在流式守卫之前（否则流式中调用被静默丢弃）');
    // 存在性/启停判定与两条失败文案单源在主进程（skillErrorFromReason）——
    // 渲染端**不得**复制它们，也不得用快照做前置否决（G-48-3）
    assert.strictEqual(body.includes('未找到技能「'), false, '渲染端不得复制「未找到」文案');
    assert.strictEqual(
      body.includes('已被禁用，可在 设置 → AI → 技能管理 重新启用'),
      false,
      '渲染端不得复制「已禁用」文案'
    );
    assert.ok(body.includes('未知命令 '), '两边都不命中仍走未知命令路径（本地提示保留）');
    // 跨文件护栏：主进程仍是两条文案的唯一来源（两侧不可能同时消失后无人发现）
    const mainSrc = readSource('ai-manager.js');
    const fnIdx = mainSrc.indexOf('function skillErrorFromReason(');
    assert.ok(fnIdx >= 0, '主进程必须存在 skillErrorFromReason');
    const fn = mainSrc.slice(fnIdx, mainSrc.indexOf('\n}', fnIdx));
    assert.ok(fn.includes('未找到技能「'), '主进程仍含「未找到」文案字面量');
    assert.ok(
      fn.includes('已被禁用，可在 设置 → AI → 技能管理 重新启用'),
      '主进程仍含「已禁用」文案字面量'
    );
  });

  test('state.aiSkills / state.aiSkillsDigest 仍建立（面板数据源），但发送路径不得读它（G-48-3）', () => {
    assert.ok(rendererSrc.includes('aiSkills:'),
      '必须保留 state.aiSkills（`/` 面板首帧的同步快照数据源）');
    assert.ok(rendererSrc.includes('aiSkillsDigest:'), '必须保留 state.aiSkillsDigest');
    const body = bodyOf('handleSendAIMessage');
    assert.strictEqual(
      body.includes('state.aiSkills'),
      false,
      '发送路径不得读快照（存在性/启停一律由主进程当场读盘裁定）'
    );
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

// ==================== 48-02 G 组：面板刷新链路与跨文件护栏（源码扫描） ====================

describe('G 组 · 面板刷新链路与跨文件护栏（D-17 / P-48-06，源码扫描）', () => {
  const rendererSrc = readSource('src/renderer.js');

  /** 取函数体文本（`function <name>(` 到下一个行首 `}`） */
  function bodyOf(name) {
    const start = rendererSrc.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `应存在 function ${name}(`);
    return rendererSrc.slice(start, rendererSrc.indexOf('\n}', start));
  }

  test('openSlashPicker：后台刷新 + 失败 catch + 无 loading 态', () => {
    const body = bodyOf('openSlashPicker');
    assert.ok(body.includes('ai.refreshSkills'), '面板打开必须发起一次后台刷新（D-17 刷新半边）');
    assert.ok(/\.catch\(/.test(body), '刷新失败必须 catch —— 保留旧快照，不渲染成空态');
    assert.ok(/console\.warn/.test(body), '失败只记录告警（stale-while-revalidate）');
    assert.strictEqual(
      /spinner|skeleton/.test(body),
      false,
      '快照是零 IO 同步视图，不得出现骨架屏 / spinner 占位'
    );
    assert.ok(
      body.indexOf('renderSlashPickerList();') < body.indexOf('ai.refreshSkills'),
      '必须先同步渲染快照再发起刷新（打开瞬间零延迟）'
    );
  });

  test('skills:changed 广播处理器：无条件重拉快照、绝不触发刷新（P-48-06 / G-48-3）', () => {
    const idx = rendererSrc.indexOf("onIpcMessage('skills:changed'");
    assert.ok(idx >= 0, '必须存在 skills:changed 监听');
    const segment = rendererSrc.slice(idx, idx + 300);
    assert.strictEqual(
      segment.includes('if (!state.slashPickerOpen)'),
      false,
      '不得再有面板关闭早退（G-48-3：广播到达即无条件重拉快照）'
    );
    assert.strictEqual(segment.includes('refreshSkills'), false, '广播处理器内不得触发主进程重扫');
    assert.ok(segment.includes('pullAiSkillsSnapshot('), '监听只重拉快照（getSkills，零 IO）');
    assert.strictEqual(
      (rendererSrc.match(/\.refreshSkills\(/g) || []).length,
      1,
      'renderer 只允许 openSlashPicker 一处重扫调用点 —— 多于一处即自激回路风险'
    );
  });

  test('限额数值字面量在三文件内零命中（常量单源在 ai-skills-manager.LIMITS）', () => {
    for (const file of ['src/renderer.js', 'src/preload.js', 'ipc-handlers.js']) {
      const src = readSource(file);
      const n = (src.match(/64\s*\*\s*1024|65536|MAX_USER_SKILLS|8000/g) || []).length;
      assert.strictEqual(n, 0, `${file} 不得出现限额数值字面量（命中 ${n} 处）`);
    }
  });

  test('renderer 内零区域敏感比较（跨机字节序一致的既有先例）', () => {
    assert.strictEqual(
      (rendererSrc.match(/localeCompare/g) || []).length,
      0,
      '面板排序一律沿用主进程投影原序，不得改用 localeCompare'
    );
  });

  test('技能数据路径不出现本地 HTTP 端点访问（Phase 38 事故护栏）', () => {
    assert.strictEqual(
      (rendererSrc.match(/fetch\(['"]\/api\/skills/g) || []).length,
      0,
      '主窗口 file:// 不能 fetch 本地 HTTP API，技能数据必须走 realmAPI.ai.*'
    );
    assert.strictEqual(
      (rendererSrc.match(/http:\/\/localhost[^\n]*skill/gi) || []).length,
      0,
      '技能相关路径不得出现 http://localhost'
    );
  });
});

describe('H 组 · read 卡片技能化（48-03 / DISC-05）', () => {
  /** 组装 _resolveSkillMarker 的最小调用上下文（只需 sandboxEnv 与 seeded 名集合） */
  function markerCtx(env, seeded) {
    return { sandboxEnv: env, getSeededSkillNamesSafe: () => (seeded || []) };
  }

  test('_resolveSkillMarker：绝对命中 / 相对命中 / 非 SKILL.md 不命中 / 工作区外不命中', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const file = writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    const ctx = markerCtx(env);

    assert.deepStrictEqual(
      aiManager.prototype._resolveSkillMarker.call(ctx, 'read', { path: file }),
      { name: 'alpha', tier: 'managed' },
      '绝对路径命中（tier 按注入的 seeded 集合判定）'
    );
    assert.deepStrictEqual(
      aiManager.prototype._resolveSkillMarker.call(ctx, 'read', { path: path.relative(env.cwd, file) }),
      { name: 'alpha', tier: 'managed' },
      '相对路径按 sandboxEnv.cwd 纯词法归一化后命中（与 SDK env.absolutePath 同规则）'
    );
    assert.strictEqual(
      aiManager.prototype._resolveSkillMarker.call(ctx, 'read', {
        path: path.join(path.dirname(file), 'references', 'x.md'),
      }),
      null,
      '技能目录下的 references/*.md 不算「使用技能」（basename 非 SKILL.md）'
    );
    assert.strictEqual(
      aiManager.prototype._resolveSkillMarker.call(ctx, 'read', { path: '/tmp/outside/SKILL.md' }),
      null,
      '工作区外的 SKILL.md 不命中'
    );
  });

  test('_resolveSkillMarker：tier 经注入的 seeded 集合判定，不依赖真实 skills-builtin/', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const managedFile = writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const userFile = writeSkill(workspace.getSkillsDir(), 'beta');
    const env = await setupSkillsEnv(root);

    assert.deepStrictEqual(
      aiManager.prototype._resolveSkillMarker.call(markerCtx(env, ['alpha']), 'read', { path: managedFile }),
      { name: 'alpha', tier: 'builtin' },
      'name ∈ seeded 集合 → builtin'
    );
    assert.deepStrictEqual(
      aiManager.prototype._resolveSkillMarker.call(markerCtx(env, ['alpha']), 'read', { path: userFile }),
      { name: 'beta', tier: 'user' },
      'user 来源恒为 user（seeded 判定不参与）'
    );
  });

  test('_resolveSkillMarker 四条负例：非 read / 缺 args / path 非字符串 / sandboxEnv 为 null', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const file = writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    const ctx = markerCtx(env);
    const call = (toolName, args) => aiManager.prototype._resolveSkillMarker.call(ctx, toolName, args);

    assert.strictEqual(call('bash', { path: file }), null, '非 read 工具一律不标');
    assert.strictEqual(call('read', {}), null, '缺 args.path');
    assert.strictEqual(call('read', undefined), null, 'args 为空');
    assert.strictEqual(call('read', { path: 123 }), null, 'path 非字符串');
    // sandboxEnv 为 null（AI 未初始化）→ null 且**不抛错**
    const bare = { sandboxEnv: null, getSeededSkillNamesSafe: () => [] };
    assert.strictEqual(
      aiManager.prototype._resolveSkillMarker.call(bare, 'read', { path: file }),
      null,
      'sandboxEnv 缺失时不得抛错'
    );
  });

  test('源码：tool_execution_start 分支带 skill_invocation 且 params 逐字未变', () => {
    const src = readSource('ai-manager.js');
    const i = src.indexOf("case 'tool_execution_start'");
    assert.ok(i >= 0, '应存在 tool_execution_start 分支');
    const seg = src.slice(i, src.indexOf('break;', i) + 'break;'.length);
    assert.ok(seg.includes('skill_invocation:'), '工具事件必须携带 skill_invocation 字段');
    assert.ok(seg.includes('_resolveSkillMarker('), '必须调用唯一的标记解析器');
    assert.ok(/params:\s*event\.args,/.test(seg), 'params 必须逐字保持 event.args');
  });

  test('源码：renderer 流式映射把事件 snake_case 落到 toolExecution.skillInvocation', () => {
    const src = readSource('src/renderer.js');
    assert.ok(
      src.includes('skillInvocation: event.skill_invocation'),
      '流式映射必须把 skill_invocation 接线到 skillInvocation（与 tool_execution_id / tool_name 同款）'
    );
  });

  test('源码：renderToolCard 技能变体（文案 / 修饰类 / 白名单徽标 / textContent / 零路径匹配）', () => {
    const body = functionBody(readSource('src/renderer.js'), 'renderToolCard');
    assert.ok(body.includes('使用技能「'), '技能变体标题文案为「使用技能「{name}」」');
    assert.ok(body.includes('tool-card-name-skill'), '名称容器须追加修饰类');
    assert.ok(body.includes('tool-card-name-text'), '名称文本须用内层类承载截断');
    assert.ok(body.includes('TIER_BADGE'), 'tier → class / label / title 必须经白名单查表');
    assert.ok(body.includes('textContent'), '技能名与徽标一律 textContent（T-48-10 缓解）');
    assert.strictEqual(
      /managed-skills|SKILL\.md/.test(body),
      false,
      'renderer 不得按路径字符串自行匹配技能（判定只在工具事件生成侧）'
    );
    // 技能变体段不得退回 innerHTML（状态图标的既有 innerHTML 不受本计划影响）
    const variantStart = body.indexOf('使用技能「');
    const variantEnd = body.indexOf('} else if', variantStart);
    const variant = body.slice(variantStart, variantEnd > 0 ? variantEnd : variantStart + 900);
    assert.strictEqual(
      variant.includes('innerHTML'),
      false,
      '技能变体不得退回 innerHTML（技能名 / 徽标一律 textContent）'
    );
  });

  test('样式：技能变体只经两个新类承载，.tool-card 系列既有规则零改动', () => {
    const css = readSource('src/styles/main.css');
    const ruleBody = (selector) => {
      const i = css.indexOf(selector + ' {');
      assert.ok(i >= 0, `应存在规则 ${selector}`);
      return css.slice(i, css.indexOf('}', i));
    };
    for (const selector of ['.tool-card-header', '.tool-card-name', '.tool-card-icon', '.tool-card-status']) {
      const body = ruleBody(selector);
      for (const forbidden of ['使用技能', 'tool-card-name-skill', 'tool-card-name-text']) {
        assert.strictEqual(body.includes(forbidden), false, `${selector} 既有规则体不得含 ${forbidden}`);
      }
    }
  });

  test('样式：.tool-card-name-skill 的 gap 与 .tool-card-name-text 的截断四件套', () => {
    const css = readSource('src/styles/main.css');
    const skillIdx = css.indexOf('.tool-card-name-skill {');
    assert.ok(skillIdx >= 0, '应存在 .tool-card-name-skill');
    const seg = css.slice(skillIdx, skillIdx + 240);
    assert.ok(/gap:\s*8px/.test(seg), 'gap 必须与父容器 .tool-card-header 存量值同值（8px，不得用 6px）');
    assert.ok(/display:\s*flex/.test(seg), '名称容器须为 flex 以让徽标与文本同行');

    const textIdx = css.indexOf('.tool-card-name-text {');
    assert.ok(textIdx >= 0, '应存在 .tool-card-name-text');
    const tseg = css.slice(textIdx, textIdx + 320);
    for (const prop of ['overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap', 'min-width: 0']) {
      assert.ok(tseg.includes(prop), `.tool-card-name-text 缺少 ${prop}（超长技能名必须 ellipsis 截断）`);
    }
    assert.ok(tseg.includes('var(--font-mono, monospace)'), '名称文本用等宽字体');
  });

  test('缓存失效：本阶段最后一次 CSS 改动已推进 index.html 的 styles/main.css?v= 序号', () => {
    const html = readSource('src/index.html');
    const m = html.match(/styles\/main\.css\?v=(\d+)/);
    assert.ok(m, 'index.html 必须含带缓存失效序号的 styles/main.css 引用');
    assert.ok(
      Number(m[1]) >= 8,
      `序号须 ≥ 8（48-03 的两个新类须随序号生效），实际 v=${m[1]}`
    );
  });

  test('回归（跨计划）：REALM_SYSTEM_PROMPT 区分技能与工具，技能段仍逐字符等于 buildSkillsPrompt()', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getSkillsDir(), 'alpha', { description: '回归用例技能' });
    await setupSkillsEnv(root);

    const src = readSource('ai-manager.js');
    assert.ok(src.includes('技能（Skill）'), 'D-18 措辞须含「技能（Skill）」');
    assert.ok(/技能与工具（Tool）/.test(src), 'D-18 措辞须显式区分技能与工具');

    const skillsBlock = aiSkills.buildSkillsPrompt();
    assert.ok(skillsBlock.length > 0, '前置：技能段非空');
    const prompt = aiManager.buildSystemPrompt();
    assert.strictEqual(
      prompt.slice(prompt.length - skillsBlock.length),
      skillsBlock,
      '技能段必须固定在末段且逐字符等于 buildSkillsPrompt()（46 D-02 边界）'
    );
  });
});

describe('I 组 · 重载链路技能标记重建（48-03 / DISC-05）', () => {
  /** 覆写 conversationStore.getMessages 返回给定显示形状消息数组（t.after 复位） */
  function stubMessages(t, messages) {
    const original = conversationStore.getMessages;
    conversationStore.getMessages = () => JSON.parse(JSON.stringify(messages));
    t.after(() => { conversationStore.getMessages = original; });
  }

  /** 组装 getConversationMessages 的最小调用上下文（真实原型方法 + 注入 sandboxEnv / seeded） */
  function reloadCtx(env, seeded) {
    return {
      _decorateSkillUserMessage: aiManager.prototype._decorateSkillUserMessage,
      _resolveSkillMarker: aiManager.prototype._resolveSkillMarker,
      _skillTierByLocation: aiManager.prototype._skillTierByLocation,
      getSeededSkillNamesSafe: () => (seeded || []),
      sandboxEnv: env,
    };
  }

  test('重载链路与实时链路的 skillInvocation 形状逐字相等（同一判定）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const file = writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);

    const live = aiManager.prototype._resolveSkillMarker.call(
      { sandboxEnv: env, getSeededSkillNamesSafe: () => [] }, 'read', { path: file }
    );
    assert.deepStrictEqual(live, { name: 'alpha', tier: 'managed' }, '前置：实时链路命中');

    stubMessages(t, [
      { id: 1, role: 'assistant', content: '', toolExecutions: [
        { id: 'tc1', name: 'read', status: 'completed', params: { path: file } },
      ] },
    ]);
    const out = aiManager.prototype.getConversationMessages.call(reloadCtx(env), 'conv-1');
    const exec = out[0].toolExecutions[0];
    assert.ok(exec.skillInvocation, '重载路径必须重建标记');
    assert.deepStrictEqual(
      Object.keys(exec.skillInvocation).sort(),
      Object.keys(live).sort(),
      '键集合必须与实时链路逐字相等'
    );
    assert.deepStrictEqual(exec.skillInvocation, live, '取值必须与实时链路逐字相等');
    // 既有字段的存在性与取值不得改变（renderer 普通卡片路径逐字节不变）
    assert.strictEqual(exec.name, 'read');
    assert.strictEqual(exec.status, 'completed');
    assert.deepStrictEqual(exec.params, { path: file });
  });

  test('技能删除 / 缓存复位后不挂键，且消息条数 / params / status 逐字未变', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const file = writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    // 缓存复位 = 技能已被删除 / 改名（matchSkillByPath 找不到）
    aiSkills._resetCacheForTest();

    stubMessages(t, [
      { id: 1, role: 'assistant', content: '', toolExecutions: [
        { id: 'tc1', name: 'read', status: 'completed', params: { path: file } },
      ] },
    ]);
    const out = aiManager.prototype.getConversationMessages.call(reloadCtx(env), 'conv-1');
    assert.strictEqual(out.length, 1, '消息条数不得变化');
    const exec = out[0].toolExecutions[0];
    assert.strictEqual('skillInvocation' in exec, false, '匹配不到 → 静默不标（不写 undefined）');
    assert.strictEqual(exec.status, 'completed');
    assert.deepStrictEqual(exec.params, { path: file });
  });

  test('非技能 read（工作区内非 SKILL.md）与其它工具一概不挂键', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);
    const other = path.join(env.cwd, 'notes.txt');
    fs.writeFileSync(other, 'hello');

    stubMessages(t, [
      { id: 1, role: 'assistant', content: '', toolExecutions: [
        { id: 'tc1', name: 'read', status: 'completed', params: { path: other } },
        { id: 'tc2', name: 'bash', status: 'completed', params: { command: 'ls' } },
      ] },
    ]);
    const out = aiManager.prototype.getConversationMessages.call(reloadCtx(env), 'conv-1');
    for (const exec of out[0].toolExecutions) {
      assert.strictEqual('skillInvocation' in exec, false);
    }
  });

  test('容错：判定抛错时仍返回完整消息数组（不丢消息、不抛错）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    stubMessages(t, [
      { id: 1, role: 'assistant', content: '', toolExecutions: [
        { id: 'tc1', name: 'read', status: 'completed', params: { path: '/x/SKILL.md' } },
      ] },
    ]);
    const ctx = {
      _decorateSkillUserMessage: () => null,
      _resolveSkillMarker: () => { throw new Error('boom'); },
      getSeededSkillNamesSafe: () => [],
      sandboxEnv: env,
    };
    let out;
    assert.doesNotThrow(
      () => { out = aiManager.prototype.getConversationMessages.call(ctx, 'conv-1'); },
      '装饰失败不得抛出'
    );
    assert.strictEqual(out.length, 1, '装饰失败不得丢消息');
    assert.strictEqual(out[0].toolExecutions.length, 1, '工具执行条目也必须完整返回');
  });

  test('源码：getConversationMessages 复用 _resolveSkillMarker，装饰段包 try/catch', () => {
    const body = methodBody(readSource('ai-manager.js'), 'getConversationMessages');
    assert.ok(body.length >= 120, '方法体提取口径失效会假绿 —— 守卫须先过这一关');
    assert.ok(body.includes('_resolveSkillMarker('), '重载路径必须复用同一个判定实现（一处实现、两处调用）');
    assert.strictEqual(body.includes('matchSkillByPath('), false, '不得在本方法体内直接调 matchSkillByPath');
    assert.ok(/toolExecutions/.test(body), '必须重建 assistant 行的技能标记');
    assert.ok(/try\s*\{/.test(body), '装饰段必须包 try');
    assert.ok(/catch\s*\(/.test(body), '装饰失败必须 catch 并原样透传');
    assert.ok(body.includes('console.warn'), '失败只告警（不静默）');
  });

  test('源码：技能域知识未下沉到存储层（ai-conversations-manager.js 零 skillInvocation）', () => {
    assert.strictEqual(
      readSource('ai-conversations-manager.js').includes('skillInvocation'),
      false,
      '存储层保持「只懂存储」—— 标记只在 getConversationMessages 的装饰层重建'
    );
  });
});

// ==================== 48-07 J 组：G-48-12 运行期新增技能（miss → 权威重扫一次 → 当场读盘） ====================

/**
 * 调用侧上下文夹具：只为 `_resolveSkillInvocation` 补足读盘 / 重扫真正读到的状态。
 *
 * **不 `new AIManager()`**（那会触碰真实 userData 与 electron app 路径）；用 `Object.create`
 * 取原型方法，own property 只补必需字段。
 *
 * `isProcessing: true` **与真实调用点同值**（`ai-manager.js` 先置位、后调本方法）——
 * 这同时是「忙时只置脏、不得在轮内改写 prompt」断言的前提。
 *
 * `getSeededSkillNamesSafe` 覆写为空集合：纯 Node 下 `builtin-skills-seeder` 间接依赖
 * electron（见 `ai-manager.js` 的降级说明），覆写既免告警噪声、也让 tier 判定确定。
 *
 * `syncAgentSystemPrompt` 用 own-property 包装计数 —— 原方法体逐字不改，只统计调用次数
 * （「有界」是行为断言，不靠读源码推断）。
 */
function skillResolveCtx(env, { disabled = [] } = {}) {
  const ctx = Object.create(aiManager.prototype);
  ctx.sandboxEnv = env;
  ctx.isProcessing = true;
  ctx._skillsPromptDirty = false;
  ctx._skillsPromptDigest = '';
  ctx.agent = { state: { systemPrompt: 'OLD', isStreaming: false } };
  ctx.configStore = {
    get: (key, fallback) => (key === 'settings.aiSkills.disabled' ? disabled : fallback),
  };
  ctx.getSeededSkillNamesSafe = () => [];
  ctx.rescanCalls = 0;
  const realSync = aiManager.prototype.syncAgentSystemPrompt;
  ctx.syncAgentSystemPrompt = function () {
    this.rescanCalls += 1;
    return realSync.call(this);
  };
  return ctx;
}

/** 走调用侧唯一入口发起一次显式技能调用 */
function invokeSkill(ctx, text) {
  return aiManager.prototype._resolveSkillInvocation.call(ctx, text);
}

describe('J 组 · G-48-12 运行期新增技能（miss → 权威重扫一次 → 当场读盘）', () => {
  test('正例 · managed 根：运行期新增目录（不重扫）→ /skill: 当场读盘成功且只重扫一次', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root); // 此刻技能集为空
    // 运行期新增技能目录（模拟 AI 经 write / bash 建目录）—— **不**触发任何重扫
    writeSkill(workspace.getManagedSkillsDir(), 'probe-new', {
      body: '# probe-new\n\n新技能正文\n',
    });

    const ctx = skillResolveCtx(env);
    const res = await invokeSkill(ctx, '/skill:probe-new 你好');

    assert.strictEqual(
      res.skillError,
      undefined,
      `运行期新增的技能必须当场可调用: ${JSON.stringify(res.skillError)}`
    );
    assert.strictEqual(res.skill.name, 'probe-new');
    assert.strictEqual(res.skill.tier, 'managed');
    assert.ok(res.skill.content.includes('新技能正文'), '返回体正文来自当场读盘');
    assert.ok(res.skillBlock.includes('新技能正文'), '注入块正文来自当场读盘');
    assert.strictEqual(ctx.rescanCalls, 1, 'miss 时经权威入口重扫**恰一次**（有界且足够）');
    assert.strictEqual(ctx._skillsPromptDirty, true, '忙分支：只置脏');
    assert.strictEqual(ctx.agent.state.systemPrompt, 'OLD', '忙分支：不得在轮内改写 prompt');
  });

  test('正例 · user 根 + 读盘实时性：新增后可调用，改盘后二次调用读到新正文', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    writeSkill(workspace.getSkillsDir(), 'probe-user', { body: '# probe-user\n\n用户版第一版\n' });

    const ctx = skillResolveCtx(env);
    const first = await invokeSkill(ctx, '/skill:probe-user 参数');
    assert.strictEqual(first.skillError, undefined);
    assert.strictEqual(first.skill.tier, 'user');
    assert.strictEqual(ctx.rescanCalls, 1);

    // 改盘（不新增目录、不重扫）→ 缓存已命中，仍必须当场读盘
    writeSkill(workspace.getSkillsDir(), 'probe-user', { body: '# probe-user\n\n用户版第二版\n' });
    const second = await invokeSkill(ctx, '/skill:probe-user');
    assert.ok(
      second.skillBlock.includes('用户版第二版'),
      '重试路径之后仍走实时读盘（不复用重扫产出的缓存正文）'
    );
    assert.strictEqual(second.skillBlock.includes('用户版第一版'), false, '旧正文不得残留');
  });

  test('快路径不变式：缓存命中 → 零重扫（既有 D 组语义不变）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    writeSkill(workspace.getSkillsDir(), 'probe-hit', { body: '# probe-hit\n\n第一版正文\n' });

    const ctx = skillResolveCtx(env);
    const warm = await invokeSkill(ctx, '/skill:probe-hit');
    assert.strictEqual(warm.skillError, undefined);
    assert.strictEqual(ctx.rescanCalls, 1, '预热：首次 miss → 重扫一次');
    const baseline = ctx.rescanCalls;

    writeSkill(workspace.getSkillsDir(), 'probe-hit', { body: '# probe-hit\n\n第二版正文\n' });
    const second = await invokeSkill(ctx, '/skill:probe-hit');
    assert.ok(second.skillBlock.includes('第二版正文'), '缓存命中仍须当场读盘');
    assert.strictEqual(
      ctx.rescanCalls - baseline,
      0,
      '快路径不变式：缓存命中时零重扫'
    );
  });

  test('负例 · disabled 不被绕过：运行期新增但名入禁用清单 → skill_disabled 零注入', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    writeSkill(workspace.getManagedSkillsDir(), 'probe-dis', { body: '# probe-dis\n\n禁用版正文\n' });

    const ctx = skillResolveCtx(env, { disabled: ['probe-dis'] });
    const res = await invokeSkill(ctx, '/skill:probe-dis');

    assert.strictEqual(res.skillError.code, 'skill_disabled');
    assert.strictEqual(res.skillBlock, '', '已禁用 → 零注入');
    assert.strictEqual(res.skill, null);
    assert.strictEqual(ctx.rescanCalls, 1, '禁用判定来自重扫产出（同一条加载管线）');
  });

  test('负例 · shadowed 不被绕过：两根同名 → 注入胜出者正文、败者 shadowed === true', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    // 两根同时**运行期**新增同名技能（一个都不在缓存里）
    writeSkill(workspace.getManagedSkillsDir(), 'probe-dup', { body: '# managed\n\n托管版正文\n' });
    writeSkill(workspace.getSkillsDir(), 'probe-dup', { body: '# user\n\n用户版正文\n' });

    const ctx = skillResolveCtx(env);
    const res = await invokeSkill(ctx, '/skill:probe-dup');

    assert.strictEqual(res.skillError, undefined, '影子败者不得妨碍显式调用');
    assert.strictEqual(res.skill.tier, 'user', '手打一律作用于胜出者（D-11）');
    assert.ok(res.skillBlock.includes('用户版正文'));
    assert.strictEqual(res.skillBlock.includes('托管版正文'), false, '败者正文不得进注入块');

    const dupes = aiSkills.getSkillsSnapshot().skills.filter((e) => e.skill.name === 'probe-dup');
    const managedEntry = dupes.find((e) => e.source === 'managed');
    const userEntry = dupes.find((e) => e.source === 'user');
    assert.ok(managedEntry && managedEntry.shadowed === true, 'managed 条目必须标 shadowed（D-11 / 46 D-06）');
    assert.strictEqual(managedEntry.shadowedBy, 'user');
    assert.ok(userEntry, '胜出者必须仍在集合内（遮蔽不剔除条目）');
    assert.notStrictEqual(userEntry.shadowed, true, '胜出者不得被遮蔽');
  });

  test('负例 · 真不存在 + 有界：仍 skill_not_found，且重扫恰一次', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);

    // 全新 ctx（基线归零，不复用前面用例的累加值）
    const ctx = skillResolveCtx(env);
    const res = await invokeSkill(ctx, '/skill:no-such-skill-xyz');

    assert.strictEqual(res.skillError.code, 'skill_not_found');
    assert.strictEqual(res.skill, null);
    assert.strictEqual(res.skillBlock, '');
    assert.strictEqual(ctx.rescanCalls, 1, '真不存在也至多重扫一次（既非 0 次也非 ≥2 次）');
  });

  test('J8 · 负例 · 重扫抛错（Error 形态）：就地 catch、沿用原判定、不升级为异常、不重复读盘', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    const ctx = skillResolveCtx(env);
    // 必须同时自增计数：覆写会整体替换 skillResolveCtx 的计数包装，否则 rescanCalls 失真
    ctx.syncAgentSystemPrompt = function () {
      this.rescanCalls += 1;
      throw new Error('boom');
    };

    // 读盘计数：getAiSkillsManagerLazy() 返回的就是本模块对象，包装后 `_resolveSkillInvocation`
    // 取到的即是被包装的版本（t.after 复原）
    const skillsManager = aiSkills;
    const realRead = skillsManager.readSkillForInvocation;
    let readCalls = 0;
    skillsManager.readSkillForInvocation = async (...args) => {
      readCalls += 1;
      return realRead.apply(skillsManager, args);
    };
    t.after(() => {
      skillsManager.readSkillForInvocation = realRead;
    });

    const warns = [];
    const realWarn = console.warn;
    console.warn = (...args) => {
      warns.push(args.join(' '));
    };
    t.after(() => {
      console.warn = realWarn;
    });

    const res = await invokeSkill(ctx, '/skill:no-such-skill-xyz');

    assert.strictEqual(
      res.skillError.code,
      'skill_not_found',
      '重扫抛错必须沿用原判定：不是异常、不是第三码'
    );
    assert.strictEqual(res.skill, null);
    assert.strictEqual(res.skillBlock, '');
    assert.strictEqual(ctx.rescanCalls, 1, '重扫尝试恰一次');
    assert.strictEqual(readCalls, 1, '重扫失败后不得再读盘（缓存未变，重读必然与首次同形）');
    assert.ok(
      warns.some((w) => w.includes('重扫失败')),
      '告警必须含「重扫失败」文案（绝不静默）'
    );
  });

  test('J9 · 负例 · 重扫抛错（原始值形态）：告警取值不得二次抛错', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    const ctx = skillResolveCtx(env);

    // `throw null` / 抛原始值是**合法** JS 抛出形态；若 catch 体内裸读 `err.message`，
    // 本用例会在 catch 体内二次抛 TypeError —— 恰好把「绝不升级为异常」反转成「升级为异常」。
    // 取值形态必须与 `ai-skills-manager.js` 同形：`err && err.message ? err.message : String(err)`。

    // 形态 ① `throw null`
    ctx.syncAgentSystemPrompt = function () {
      this.rescanCalls += 1;
      throw null;
    };
    const resNull = await invokeSkill(ctx, '/skill:no-such-skill-xyz');
    assert.strictEqual(
      resNull.skillError.code,
      'skill_not_found',
      '`throw null` 时仍须正常 resolve 且判定不变'
    );
    assert.strictEqual(resNull.skill, null);

    // 形态 ② 抛原始字符串
    ctx.syncAgentSystemPrompt = function () {
      this.rescanCalls += 1;
      throw 'x';
    };
    const resStr = await invokeSkill(ctx, '/skill:no-such-skill-xyz');
    assert.strictEqual(
      resStr.skillError.code,
      'skill_not_found',
      "抛原始值 'x' 时仍须正常 resolve 且判定不变"
    );
    assert.strictEqual(resStr.skill, null);

    assert.strictEqual(ctx.rescanCalls, 2, '两次调用各重扫一次');
  });

  test('J10 · 负例 · 重试读盘抛错：沿用原判定、不逃逸，且告警可与「重扫失败」判别', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);
    const ctx = skillResolveCtx(env); // syncAgentSystemPrompt 走**真实**实现 → 重扫成功

    const skillsManager = aiSkills;
    const realRead = skillsManager.readSkillForInvocation;
    let readCalls = 0;
    skillsManager.readSkillForInvocation = async (...args) => {
      readCalls += 1;
      if (readCalls === 2) throw null; // 第 2 次 = 重试读盘，抛非对象值（一并覆盖原始值形态）
      return realRead.apply(skillsManager, args);
    };
    t.after(() => {
      skillsManager.readSkillForInvocation = realRead;
    });

    const warns = [];
    const realWarn = console.warn;
    console.warn = (...args) => {
      warns.push(args.join(' '));
    };
    t.after(() => {
      console.warn = realWarn;
    });

    const res = await invokeSkill(ctx, '/skill:no-such-skill-xyz');

    assert.strictEqual(res.skillError.code, 'skill_not_found', '重试读盘抛错同样沿用原判定');
    assert.strictEqual(res.skill, null);
    assert.strictEqual(ctx.rescanCalls, 1, '重扫走真实实现 → 恰一次');
    assert.strictEqual(readCalls, 2, '首次 + 至多一次重试');
    assert.ok(
      warns.some((w) => w.includes('重试读盘失败')),
      '告警必须含「重试读盘失败」文案'
    );
    assert.strictEqual(
      warns.some((w) => w.includes('重扫失败')),
      false,
      '两条告警必须可判别 —— 两条 catch 不得被合并成一条'
    );
  });

  test('源码护栏 · miss 重试的接线与有界性（修复落在调用侧）', () => {
    const body = methodBody(readSource('ai-manager.js'), '_resolveSkillInvocation');
    assert.ok(body.length >= 400, `方法体提取口径失效会假绿 —— 守卫须先过这一关（实际 ${body.length}）`);
    assert.ok(body.includes('syncAgentSystemPrompt('), '必须经唯一权威入口重扫，不自调刷新管线');
    assert.strictEqual(
      (body.match(/readSkillForInvocation\(/g) || []).length,
      2,
      '读盘口必须恰 2 次：首次 + miss 重试'
    );
    assert.ok(body.includes('console.warn'), '重扫失败不得静默');
    assert.strictEqual(/\bwhile\b/.test(body), false, '禁止循环重试（至多一次）');
    assert.strictEqual(/\bfor\s*\(/.test(body), false, '禁止循环重试（至多一次）');
    assert.strictEqual(
      body.includes('refreshSkills('),
      false,
      '必须经 syncAgentSystemPrompt() 而非自调重扫（三字段单源）'
    );
    assert.ok(body.includes('skillErrorFromReason('), '失败出口唯一');

    // 修复落在**调用侧**：manager 侧的缓存未命中短路原样保留，且 manager 不反向依赖调用侧入口
    const mgr = readSource('ai-skills-manager.js');
    const readBody = functionBody(mgr, 'readSkillForInvocation');
    assert.ok(
      readBody.includes("if (!entry) return { ok: false, reason: 'not_found', name };"),
      'manager 侧缓存未命中短路必须原样保留（本计划没有把第二套判定搬进 manager）'
    );
    assert.strictEqual(
      /\.syncAgentSystemPrompt\s*\(/.test(mgr),
      false,
      'manager 侧不得出现调用侧入口（跨层依赖）—— 注释中的具名引用不算依赖'
    );
  });
});

/**
 * 延迟补刷出口上下文（**K 组与 L 组共用的唯一夹具**）
 *
 * 提到文件级而非各自复制：两组的隔离语义必须逐字一致，第二套 `Object.create`
 * 拼装必然漂移（K 组 = G-48-18 的纯文本流补刷；L 组 = Phase 49 manage_skill 的刷新链）。
 *
 * 与 `skillResolveCtx` 同款纪律：**不** `new AIManager()`（那会触碰真实 userData、
 * electron 路径与对话数据库）；用 `Object.create(aiManager.prototype)` 取原型方法，
 * own property 只补出口路径真正读到的字段。
 *
 * `_ensureConversation` / `agent.prompt` / `waitForIdle` 的覆写**不是**为测试而设的假状态，
 * 而是隔离「对话数据库写盘」与「SDK 往返」这两个副作用 —— 本组验的是**出口行为**
 * （补刷是否落地），不是对话生命周期也不是 SDK。
 *
 * `syncAgentSystemPrompt` 用 own-property **包装**（而非重写）计数 —— 真实方法体逐字未改
 * 这条硬约束因此不被测试绕过（与 J 组同款）。
 */
function promptCtx(env, { dirty = false } = {}) {
  const ctx = Object.create(aiManager.prototype);
  ctx.isInitialized = true;
  ctx.sandboxEnv = env;
  ctx.isProcessing = false;
  ctx._skillsPromptDirty = dirty;
  ctx._skillsPromptDigest = '';
  ctx.currentConversationId = 'conv-flush';
  ctx.agent = {
    state: { systemPrompt: 'OLD', isStreaming: false },
    prompt: async () => {},
    waitForIdle: async () => {},
    abort: () => {},
  };
  ctx.configStore = { get: (key, fallback) => fallback };
  ctx.getSeededSkillNamesSafe = () => [];
  // 49-02 起 `_buildManageSkillTool().execute` 会在成功出口写入本次执行的短期元数据
  // （按 toolCallId），该字段由构造函数初始化为 own property —— 本夹具不跑构造函数，故显式补上。
  ctx._manageSkillMeta = new Map();
  ctx._ensureConversation = () => 'conv-flush';
  ctx._sendEventsBatch = () => {};
  ctx.rescanCalls = 0;
  const realSync = aiManager.prototype.syncAgentSystemPrompt;
  ctx.syncAgentSystemPrompt = function () {
    this.rescanCalls += 1;
    return realSync.call(this);
  };
  return ctx;
}

describe('K 组 · G-48-18 延迟补刷在纯文本流上落地', () => {

  test('K1（靶心 · 行为）纯文本 /skill: 成功后延迟补刷落地：脏标记归假 + prompt 已含新技能 + 广播恰一次', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root); // 此刻技能集为空
    // 运行期新增技能目录（模拟 AI 经 write / bash 建目录）—— **不**触发任何重扫
    writeSkill(workspace.getSkillsDir(), 'flush-probe', { body: '# flush-probe\n\n落地用正文\n' });

    const wm = require('../window-manager');
    const originalBroadcast = wm.broadcast;
    const channels = [];
    wm.broadcast = (channel) => {
      channels.push(channel);
    };
    t.after(() => {
      wm.broadcast = originalBroadcast;
    });

    const ctx = promptCtx(env);
    const res = await aiManager.prototype.prompt.call(ctx, '/skill:flush-probe 你好');

    assert.strictEqual(res.skillError, undefined, `技能必须可调用: ${JSON.stringify(res.skillError)}`);
    assert.strictEqual(res.skillInvocation.name, 'flush-probe');
    assert.strictEqual(
      ctx._skillsPromptDirty,
      false,
      '纯文本流的成功出口也必须把延迟补刷刷落地（G-48-18 靶心）'
    );
    assert.ok(
      ctx.agent.state.systemPrompt.includes('flush-probe'),
      '补刷后 system prompt 必须含运行期新增技能的 name / description'
    );
    assert.strictEqual(
      ctx.agent.state.systemPrompt,
      aiManager.buildSystemPrompt(),
      '补刷后 system prompt 必须等于 buildSystemPrompt()'
    );
    assert.deepStrictEqual(
      channels,
      ['skills:changed'],
      '真正改写 prompt 时必须以 skills:changed 广播恰一次'
    );
    assert.strictEqual(
      ctx.rescanCalls,
      2,
      '忙时重扫一次 + 出口补刷一次（不是 3 —— 证明没有双刷）'
    );
  });

  test('K2（早退零成本 · 行为）脏标记为假时普通消息不多付重扫', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root); // 不新增技能

    const ctx = promptCtx(env); // dirty 默认 false
    const res = await aiManager.prototype.prompt.call(ctx, '你好');

    assert.strictEqual(res.skillError, undefined);
    assert.strictEqual(res.skillInvocation, null);
    assert.strictEqual(ctx.rescanCalls, 0, '补刷首行检脏早退 —— 普通消息零重扫');
    assert.strictEqual(ctx.agent.state.systemPrompt, 'OLD', '无待补刷时 prompt 逐字不变');
  });

  test('K3（错误出口不补刷 · 行为）promptWithContext 抛错时脏标记原样保留、prompt 逐字不变、零广播', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);

    const wm = require('../window-manager');
    const originalBroadcast = wm.broadcast;
    const channels = [];
    wm.broadcast = (channel) => {
      channels.push(channel);
    };
    t.after(() => {
      wm.broadcast = originalBroadcast;
    });

    const ctx = promptCtx(env, { dirty: true });
    ctx.agent.prompt = async () => {
      throw new Error('boom');
    };

    // 空引用 + 空附件 → 走普通分支；promptWithContext 的 catch 没有重试循环，毫秒级
    const res = await aiManager.prototype.promptWithContext.call(ctx, '你好', [], []);

    assert.strictEqual(res.skillInvocation, null);
    assert.strictEqual(
      ctx._skillsPromptDirty,
      true,
      '错误出口不补刷（否则同一次运行会双刷）—— 标记原样保留给下一次成功出口'
    );
    assert.strictEqual(ctx.agent.state.systemPrompt, 'OLD', '错误出口不得改写 prompt');
    assert.deepStrictEqual(channels, [], '错误出口不得广播');
    assert.strictEqual(ctx.rescanCalls, 0, '错误出口零重扫');
  });

  test('K4（清理不补刷 · 行为）_cleanupCurrentAgent 不碰脏标记', () => {
    const ctx = promptCtx({}, { dirty: true });
    aiManager.prototype._cleanupCurrentAgent.call(ctx);

    assert.strictEqual(
      ctx._skillsPromptDirty,
      true,
      '_cleanupCurrentAgent() 不碰该标记（既有设计，本计划保留并钉成门）'
    );
    assert.strictEqual(ctx.rescanCalls, 0, '清理路径零重扫');
    assert.strictEqual(ctx.agent, null, '清理语义未变（abort + 置空 + 复位 isProcessing）');
  });

  test('K5（源码护栏 · 单源）补刷唯一实现 + 两个成功出口共用 + promptWithContext 无残留', () => {
    const src = readSource('ai-manager.js');
    const flush = methodBody(src, '_flushDeferredSkillsPrompt');
    assert.ok(flush.length >= 150, `补刷方法体提取口径失效会假绿（实际 ${flush.length}）`);
    const checkIdx = flush.indexOf('if (!this._skillsPromptDirty)');
    const resetIdx = flush.indexOf('this._skillsPromptDirty = false');
    const syncIdx = flush.indexOf('await this.syncAgentSystemPrompt()');
    const restoreIdx = flush.indexOf('this._skillsPromptDirty = true');
    assert.ok(checkIdx >= 0 && checkIdx < resetIdx, '检脏必须早于复位（早退零成本）');
    assert.ok(syncIdx >= 0, '补刷必须复用唯一权威入口 syncAgentSystemPrompt()');
    assert.ok(restoreIdx > syncIdx, '失败恢复置脏必须在同步调用之后（WR-04）');
    assert.ok(
      methodBody(src, 'prompt').includes('await this._flushDeferredSkillsPrompt()'),
      'prompt() 的成功出口必须共用补刷实现'
    );
    const withContext = methodBody(src, 'promptWithContext');
    assert.ok(
      withContext.includes('await this._flushDeferredSkillsPrompt()'),
      'promptWithContext() 的成功出口必须共用补刷实现'
    );
    assert.strictEqual(
      withContext.includes('this._skillsPromptDirty'),
      false,
      'promptWithContext() 内不得残留脏标记读写（否则就是第二份实现）'
    );
    assert.strictEqual(
      (src.match(/await this\._flushDeferredSkillsPrompt\(\)/g) || []).length,
      2,
      '补刷调用点必须恰 2 处'
    );
  });
});

describe('L 组 · Phase 49 manage_skill 的刷新链', () => {
  /**
   * 打桩 `windowManager.broadcast` 收集频道名（写法照 E 组既有先例）
   * @returns {{channels: string[], restore: Function}}
   */
  function captureBroadcasts(t) {
    const wm = require('../window-manager');
    const original = wm.broadcast;
    const channels = [];
    wm.broadcast = (channel) => {
      channels.push(channel);
    };
    t.after(() => {
      wm.broadcast = original;
    });
    return { channels };
  }

  test('L1（靶心 · 行为）工具执行期只置脏标记 → 本轮成功出口补刷：prompt 含新技能、广播恰一次、rescanCalls === 2', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root); // 此刻技能集为空

    const { channels } = captureBroadcasts(t);
    const ctx = promptCtx(env);
    // 工具执行期 `isProcessing` 恒 true（真实语义：工具在 Agent 轮内执行）
    ctx.isProcessing = true;

    const tool = ctx._buildManageSkillTool();
    const res = await tool.execute('call-1', {
      action: 'create',
      name: 'flush-probe',
      description: '落地用描述',
      content: '# flush-probe\n\n落地用正文\n',
    });
    assert.strictEqual(res.details.action, 'create');
    assert.strictEqual(res.details.name, 'flush-probe');

    // ① 忙时语义：只置脏标记，prompt **尚未**回写（D-13 —— 「下一条消息可见」是设计而非缺陷）
    assert.strictEqual(ctx._skillsPromptDirty, true, '忙时只置脏标记');
    assert.strictEqual(
      ctx.agent.state.systemPrompt.includes('flush-probe'),
      false,
      '工具返回时 system prompt **不得**已含新技能（真正的回写在本轮成功出口）'
    );
    assert.strictEqual(ctx.rescanCalls, 1, '工具路径恰一次重扫（syncAgentSystemPrompt 内含 refreshSkills）');
    assert.deepStrictEqual(channels, [], '忙时不广播（prompt 未变）');

    // ② 本轮结束：isProcessing 复位后走 prompt() 的成功出口
    ctx.isProcessing = false;
    await aiManager.prototype.prompt.call(ctx, '你好');

    assert.strictEqual(ctx._skillsPromptDirty, false, '成功出口必须把补刷刷落地');
    assert.ok(
      ctx.agent.state.systemPrompt.includes('flush-probe'),
      '补刷后 system prompt 必须含新技能的 name / description'
    );
    assert.strictEqual(
      ctx.agent.state.systemPrompt,
      aiManager.buildSystemPrompt(),
      '补刷后 system prompt 必须逐字符等于 buildSystemPrompt()'
    );
    assert.deepStrictEqual(channels, ['skills:changed'], '真正改写 prompt 时广播 skills:changed 恰一次');
    assert.strictEqual(
      ctx.rescanCalls,
      2,
      '工具路径一次 + 出口补刷一次（**不是 3** —— 证明没有 syncAgentSystemPrompt + refreshSkills 双写）'
    );
  });

  test('L2（早退零成本 · 行为）不调工具时普通消息既不多付重扫、也不广播', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);

    const { channels } = captureBroadcasts(t);
    const ctx = promptCtx(env); // dirty 默认 false
    const res = await aiManager.prototype.prompt.call(ctx, '你好');

    assert.strictEqual(res.skillError, undefined);
    assert.strictEqual(ctx.rescanCalls, 0, '补刷首行检脏早退 —— 零重扫');
    assert.strictEqual(ctx.agent.state.systemPrompt, 'OLD', '无待补刷时 prompt 逐字不变');
    assert.deepStrictEqual(channels, [], '无变化不广播（保 provider 前缀缓存）');
  });

  test('L3（次数账 · 源码）manage_skill 的工具范围内 syncAgentSystemPrompt() 恰 1 处、refreshSkills( 0 处', () => {
    const src = readSource('ai-manager.js');
    const body = methodBody(src, '_buildManageSkillTool');
    assert.ok(body.length > 500, `工具方法体提取口径失效会假绿（实际 ${body.length}）`);
    assert.strictEqual(
      (body.match(/await this\.syncAgentSystemPrompt\(\)/g) || []).length,
      1,
      '写成功后**只调一次** syncAgentSystemPrompt（唯一权威入口）'
    );
    assert.strictEqual(
      /refreshSkills\(/.test(body),
      false,
      '不得照 ROADMAP 字面再写 refreshSkills() —— 那是三次全量重扫（D-13）'
    );
    assert.strictEqual(
      /requestActionConfirmation/.test(body),
      false,
      '三个动作一律自动（D-01），工具内不得出现确认调用'
    );
  });
});




// ==================== M 组 · Phase 49 manage_skill 卡片标记（D-02 / UI-SPEC 硬约束 1–4） ====================

describe('M 组 · Phase 49 manage_skill 卡片标记（D-02 / UI-SPEC 硬约束 1–4）', () => {
  /**
   * `manage_skill` 在 `src/renderer.js` 的**三处接线区域**（事件映射两处 + 卡片分支一处）。
   *
   * 三处都是「必须同时成立」的接线点：漏任一处都是静默失效（卡片退化为普通卡片 / 徽标与
   * 短原因永不出现），因此断言必须落在具体区域而不是整文件 `includes`。
   *
   * **窗口纪律（两处切片都按锚点定界，不用固定长度）**：
   * - 合并区 = `toolExecutions[existingIdx]` → **该起点之后的第一个** `toolExecutions.push(`
   *   ⇒ 判据对象是「已存在条目分支的本体」，且随分支增长 / 缩短自动跟随。
   *   固定长度窗口（曾为 `mergeIdx + 900`）是启发式：分支一变长就把本分支内容留在窗口外
   *   （断言假红），一变短就把相邻分支纳入（断言假绿）；两种漂移都让区域不再等于分支本体。
   * - 终点锚点必须**相对起点解析**（`indexOf(mark, mergeIdx)`）：`toolExecutions.push(` 在文件里
   *   另有同名出现，全局 `indexOf` 会取到文件里**第一个** —— 一旦它在起点之前，切片即恒为空串，
   *   所有区域断言无论实现对不对都恒失败（固定长度窗口与全局终点锚点是同一类缺陷）。
   * - 内容构造区以注释锚点（`// 参数区域（…）`）收尾，不依赖 `merge` 的长度。
   */
  function rendererManageRegions() {
    const src = readSource('src/renderer.js');
    const mergeIdx = src.indexOf('toolExecutions[existingIdx]');
    assert.ok(mergeIdx >= 0, '应存在「已存在条目」合并分支');
    const pushIdx = src.indexOf('toolExecutions.push(', mergeIdx);
    assert.ok(pushIdx > mergeIdx, '应存在新条目分支（且位于合并分支起点之后）');
    const bStart = src.indexOf('const manageSkill = toolExecution.manageSkill');
    assert.ok(bStart >= 0, '应存在 manage_skill 卡片分支起点');
    const bEnd = src.indexOf('} else if (skillInvocation && skillInvocation.name)', bStart);
    assert.ok(
      bEnd > bStart,
      'manage_skill 分支必须以 read 技能变体收尾（两种标记互斥，前者更具体）'
    );
    return {
      src,
      // 终点 = 下一个分支的起点（锚点定界，不是「起点 + 固定长度」的近似偏移）
      merge: src.slice(mergeIdx, pushIdx),
      push: src.slice(pushIdx, pushIdx + 900),
      branch: src.slice(bStart, bEnd),
      // 本变体自己的内容构造区（分支起点 → 通用参数区起点）：参数摘要 / 正文折叠块挂载 /
      // 结果文本提取都在这里；`manage_skill` 之外的**既有通用**渲染路径不在其中。
      content: src.slice(bStart, src.indexOf('// 参数区域（使用 textContent 防止 XSS）', bStart)),
    };
  }

  /** 剥离行注释与块注释（源码门禁度量**代码**而不是散文；不改动被扫描文件） */
  function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }

  /** 组装 getConversationMessages 的最小调用上下文（manage_skill 版：多注入三处新方法） */
  function manageReloadCtx(env, seeded) {
    return {
      _decorateSkillUserMessage: aiManager.prototype._decorateSkillUserMessage,
      _resolveSkillMarker: aiManager.prototype._resolveSkillMarker,
      _resolveManageSkillMarker: aiManager.prototype._resolveManageSkillMarker,
      _buildManageSkillDecoration: aiManager.prototype._buildManageSkillDecoration,
      _manageSkillTerminalFromStored: aiManager.prototype._manageSkillTerminalFromStored,
      getSkillsForUI: aiManager.prototype.getSkillsForUI,
      getSeededSkillNamesSafe: () => (seeded || []),
      sandboxEnv: env,
    };
  }

  test('M1（源码）_resolveManageSkillMarker 零 IO、同步、三值白名单 + trim', () => {
    const body = methodBody(readSource('ai-manager.js'), '_resolveManageSkillMarker');
    assert.ok(body.length > 200, `方法体提取口径失效会假绿（实际 ${body.length}）`);
    assert.ok(body.includes('trim()'), '必须对 name 做 trim');
    for (const action of ["'create'", "'update'", "'delete'"]) {
      assert.ok(body.includes(action), `三值白名单必须显式列出 ${action}`);
    }
    assert.strictEqual(/\bawait\b/.test(body), false, 'start 事件是同步上下文 —— 不得有 await（零 IO 证据）');
    assert.strictEqual(
      body.includes('getSkillsForUI'),
      false,
      'tier 不在此判定（create 的目标在调用前并不存在），本函数不得读技能集'
    );
    assert.strictEqual(
      body.includes('filePath'),
      false,
      '不得按路径字符串判定（判定只在主进程的权威数据上做）'
    );
  });

  test('M2（源码）两时点事件字段 + 成功/失败两个出口各写一次元数据、失败仍 throw', () => {
    const src = readSource('ai-manager.js');
    const s = src.indexOf("case 'tool_execution_start'");
    const e = src.indexOf("case 'tool_execution_end'");
    assert.ok(s >= 0 && e >= 0, '两个事件分支都必须存在');
    const seg1 = src.slice(s, src.indexOf('break;', s));
    const seg2 = src.slice(e, src.indexOf('break;', e));
    assert.ok(/manage_skill:/.test(seg1), 'start 事件必须携带 manage_skill 字段');
    assert.ok(seg1.includes('_resolveManageSkillMarker('), 'start 必须经唯一的基础标记解析器');
    assert.ok(/_resolveManageSkillTerminal\(/.test(seg2), 'end 事件必须取终态元数据');

    const body = methodBody(src, '_buildManageSkillTool');
    assert.ok(body.length > 500, `工具方法体提取口径失效会假绿（实际 ${body.length}）`);
    assert.strictEqual(
      (body.match(/this\._manageSkillMeta\.set\(/g) || []).length,
      2,
      '成功与失败**两个出口**必须各写一次（单一读法的前提）'
    );
    assert.ok(
      /this\._manageSkillMeta\.set\([\s\S]*?\}\s*\);\s*throw err;/.test(body),
      '失败出口写入元数据后必须**仍然 throw**（LLM 语义零变化）'
    );
    // 硬约束 2 的根因必须可被后来者读到：失败态不依赖恒为 {} 的 details
    assert.ok(
      /createErrorToolResult/.test(src) && /details/.test(src),
      '源码必须记录「SDK 的 createErrorToolResult 产出 details 恒为 {}」这一根因'
    );
    assert.strictEqual(
      (body.match(/result\.details\s*\./g) || []).length,
      0,
      '不得从 result.details 读失败态原因码（该通道在 throw 路径上恒为空）'
    );
  });

  test('M2b（行为）终态元数据通道：读后即删、只投影终态三键、非法标记得 null', () => {
    const ctx = {
      _buildManageSkillDecoration: aiManager.prototype._buildManageSkillDecoration,
      _resolveManageSkillMarker: aiManager.prototype._resolveManageSkillMarker,
      _manageSkillMeta: new Map([
        ['tc-ok', { action: 'update', name: 'foo', tier: 'user', promptIncluded: true }],
        ['tc-fail', { action: 'create', name: 'bar', code: 'seeded_protected', tier: 'builtin' }],
        ['tc-bad', { action: 'rename', name: 'baz', code: 'invalid_name' }],
      ]),
    };
    const read = aiManager.prototype._resolveManageSkillTerminal;

    assert.deepStrictEqual(
      read.call(ctx, 'tc-ok'),
      { tier: 'user', promptIncluded: true },
      '成功路径只投影终态三键（action / name 由 start 事件承载，不重复）'
    );
    assert.deepStrictEqual(
      read.call(ctx, 'tc-fail'),
      { code: 'seeded_protected', tier: 'builtin' },
      '失败路径与成功路径同一形状（单一读法）'
    );
    assert.strictEqual(read.call(ctx, 'tc-bad'), null, 'action 表外 → 整个标记作废（回落普通卡片）');
    assert.strictEqual(read.call(ctx, 'tc-ok'), null, '读后即删 —— 重复 end 事件得 null 是正确行为');
    assert.strictEqual(ctx._manageSkillMeta.has('tc-ok'), false, 'Map 不得累积');
    assert.strictEqual(read.call(ctx, 'never-written'), null, '未写入的 toolCallId → null');
  });

  /**
   * 失败态原因码词缀的**观测口径**（与 `ai-manager.js` 的 `MANAGE_SKILL_CODE_TAG` 同形）。
   *
   * 测试侧刻意不 import 那个常量：断言的对象是**可观测行为**（消息起始处的 `[code] `），
   * 而不是实现的某个标识符 —— 换成字面量正则后，「实现改用别的词缀形态」仍会被本组抓到。
   */
  const CODE_TAG_RE = /^\[[a-z_]+\]\s/;

  test('M2c（行为 · 词缀）真跑工具失败出口：消息以 [code] 开头、code 与文案逐字不变、只加一次', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);

    const ctx = promptCtx(env);
    ctx.isProcessing = true; // 工具执行期恒 true（真实语义）
    // seeded 判定只查调用方注入的播种登记表（不查磁盘位置）
    ctx.getSeededSkillNamesSafe = () => ['seeded-one'];

    const tool = ctx._buildManageSkillTool();
    let tagged = null;
    try {
      await tool.execute('call-seeded', {
        action: 'create',
        name: 'seeded-one',
        description: '试图覆盖内置技能',
        content: '# seeded-one\n\n正文\n',
      });
    } catch (err) {
      tagged = err;
    }
    assert.ok(tagged instanceof Error, 'seeded 冲突必须照常 throw（LLM 照常收到 isError toolResult）');
    assert.strictEqual(
      tagged.code,
      'seeded_protected',
      '错误对象上的 code 必须保持原值（词缀只改 message，不替换 code）'
    );
    assert.strictEqual(
      tagged.message.startsWith('[seeded_protected] '),
      true,
      `失败消息必须以 [code] 词缀开头（失败态唯一的持久化通道）：${tagged.message}`
    );
    assert.strictEqual(
      (tagged.message.match(/\[[a-z_]+\]\s/g) || []).length,
      1,
      '同一次执行只加一次词缀'
    );

    // 词缀**只增不改**：与「不经工具」的同一 manager 调用（无词缀）对照，去掉词缀后逐字相等
    let plain = null;
    try {
      await aiSkills.createManagedSkill(env, {
        name: 'seeded-one', content: 'x', description: 'y', seededNames: ['seeded-one'],
      });
    } catch (err) {
      plain = err;
    }
    assert.ok(plain instanceof Error, 'manager 层同样 throw');
    assert.strictEqual(
      CODE_TAG_RE.test(plain.message),
      false,
      'manager 层消息不带词缀（词缀由工具失败出口**单点**写入）'
    );
    assert.strictEqual(
      tagged.message.replace(CODE_TAG_RE, ''),
      plain.message,
      '词缀只增不改：去掉词缀后必须与不带词缀的原消息逐字相等'
    );

    // 幂等：已带同款词缀的错误不得被再加一次（起始匹配的机械保证）
    const originalCreate = aiSkills.createManagedSkill;
    aiSkills.createManagedSkill = async () => {
      const e = new Error('[seeded_protected] 已经带词缀的消息');
      e.code = 'seeded_protected';
      throw e;
    };
    t.after(() => { aiSkills.createManagedSkill = originalCreate; });
    let again = null;
    try {
      await tool.execute('call-seeded-2', {
        action: 'create', name: 'seeded-one', description: 'd', content: 'c',
      });
    } catch (err) {
      again = err;
    }
    assert.strictEqual(
      again.message,
      '[seeded_protected] 已经带词缀的消息',
      '已带同款词缀的消息不得被二次加缀（否则会产出 `[a] [b] msg`）'
    );

    // 非字符串 code（意外错误）不得被标上无意义前缀
    aiSkills.createManagedSkill = async () => { throw new Error('意外错误'); };
    let unexpected = null;
    try {
      await tool.execute('call-seeded-3', {
        action: 'create', name: 'any-name', description: 'd', content: 'c',
      });
    } catch (err) {
      unexpected = err;
    }
    assert.strictEqual(unexpected.message, '意外错误', 'code 非字符串时不得加词缀');
  });

  test('M2d（行为 · 重载还原）词缀 → code 还原；无词缀的旧失败行与成功行都不设 code 键；失败行两链路逐字相等', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);

    const original = conversationStore.getMessages;
    conversationStore.getMessages = () => JSON.parse(JSON.stringify([
      {
        id: 1, role: 'assistant', content: '', toolExecutions: [
          {
            id: 'tc-fail-tagged', name: 'manage_skill', status: 'failed',
            params: { action: 'create', name: 'alpha', content: '# alpha', description: 'd' },
            error: '[seeded_protected] 「alpha」是随包内置技能，AI 不能覆盖或删除。',
            details: {},
          },
          {
            id: 'tc-fail-legacy', name: 'manage_skill', status: 'failed',
            params: { action: 'create', name: 'alpha', content: '# alpha', description: 'd' },
            error: '「alpha」是随包内置技能，AI 不能覆盖或删除。',
            details: {},
          },
          {
            id: 'tc-ok', name: 'manage_skill', status: 'completed',
            params: { action: 'create', name: 'alpha', content: '# alpha', description: 'd' },
            result: '已创建技能「alpha」。它从下一条消息起对模型可见。',
            details: {
              action: 'create', name: 'alpha', filePath: '/tmp/x/SKILL.md',
              description: 'd', promptIncluded: true,
            },
          },
        ],
      },
    ]));
    t.after(() => { conversationStore.getMessages = original; });

    const out = aiManager.prototype.getConversationMessages.call(manageReloadCtx(env, []), 'conv-1');
    const [tagged, legacy, ok] = out[0].toolExecutions;
    assert.strictEqual(
      tagged.manageSkill.code,
      'seeded_protected',
      '带词缀的失败行必须还原出原因码（WR-02：失败历史卡片保留短原因）'
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(legacy.manageSkill, 'code'),
      false,
      '改动前落库的旧失败消息（无词缀）不得产出 code 键 —— 宁缺勿猜，旧历史零回归'
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(ok.manageSkill, 'code'),
      false,
      '成功行的成功文案不得误命中词缀（`^` 起始锚定的机械保证）'
    );

    // 失败行：实时链路（共享并入函数）与重载链路（同一装饰构造）的键集合与取值逐字相等
    const liveCtx = {
      _buildManageSkillDecoration: aiManager.prototype._buildManageSkillDecoration,
      _resolveManageSkillMarker: aiManager.prototype._resolveManageSkillMarker,
      _manageSkillMeta: new Map([['tc-fail-tagged', {
        action: 'create', name: 'alpha', code: 'seeded_protected', tier: 'managed',
      }]]),
    };
    const live = skillPickerModel.mergeManageSkillMarker(
      aiManager.prototype._resolveManageSkillMarker.call({}, 'create', 'alpha'),
      aiManager.prototype._resolveManageSkillTerminal.call(liveCtx, 'tc-fail-tagged')
    );
    assert.deepStrictEqual(
      Object.keys(tagged.manageSkill).sort(),
      Object.keys(live).sort(),
      '失败行：两条链路的键集合必须逐字相等（不多键也不少键）'
    );
    assert.deepStrictEqual(tagged.manageSkill, live, '失败行：两条链路的取值必须逐字相等');
    assert.deepStrictEqual(
      live,
      { action: 'create', name: 'alpha', code: 'seeded_protected', tier: 'managed' },
      '前置：失败行的实时合并形状'
    );
  });

  test('M2e（行为 · 三态消费侧）未命中（undefined）⇒ details 无 promptIncluded 键、不追加「预算已满」句', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);

    const ctx = promptCtx(env);
    ctx.isProcessing = true;

    const original = aiSkills.getSkillPromptIncluded;
    aiSkills.getSkillPromptIncluded = () => undefined; // 「此刻不在技能集里」
    t.after(() => { aiSkills.getSkillPromptIncluded = original; });

    const tool = ctx._buildManageSkillTool();
    const res = await tool.execute('call-undefined', {
      action: 'create', name: 'ghost-skill', description: '落地用描述', content: '# x\n\n正文\n',
    });

    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(res.details, 'promptIncluded'),
      false,
      '未命中（undefined）时 details 必须**不含**该键（不得写 undefined 再靠 JSON 序列化丢掉）'
    );
    assert.strictEqual(
      res.content[0].text.includes('预算已满'),
      false,
      '未命中时不得断言「技能段预算已满」—— 预算并未满，这是 49-04 三态要消灭的失实文案'
    );
    assert.strictEqual(
      res.content[0].text.includes('/skill:ghost-skill'),
      false,
      '未命中时不得声称「仍可用 /skill:{name} 手动调用」—— 该调用同样解析不到'
    );
    const meta = ctx._manageSkillMeta.get('call-undefined');
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(meta, 'promptIncluded'),
      false,
      '短期元数据同样不得含 promptIncluded 键（终态标记的键集合对「不可判定」是省略）'
    );
  });

  test('M2f（行为 · 三态消费侧）命中被滤（false）⇒ 追加「预算已满」句且 details.promptIncluded === false', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const env = await setupSkillsEnv(root);

    const ctx = promptCtx(env);
    ctx.isProcessing = true;

    const original = aiSkills.getSkillPromptIncluded;
    aiSkills.getSkillPromptIncluded = () => false; // 命中但超预算 / 禁用 / 被遮蔽
    t.after(() => { aiSkills.getSkillPromptIncluded = original; });

    const tool = ctx._buildManageSkillTool();
    const res = await tool.execute('call-false', {
      action: 'create', name: 'over-budget', description: '落地用描述', content: '# x\n\n正文\n',
    });

    assert.strictEqual(
      res.details.promptIncluded,
      false,
      '严格 false 必须写进 details（boolean 才写键）'
    );
    assert.strictEqual(
      res.content[0].text.includes('该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:over-budget 手动调用。'),
      true,
      '严格 false 才追加「预算已满」句（逐字复用既有文案，不改写 —— WR-03 不在本计划范围）'
    );
    assert.strictEqual(
      ctx._manageSkillMeta.get('call-false').promptIncluded,
      false,
      '短期元数据同样写 false（超预算标注的数据源）'
    );
  });

  test('M3（源码 · 合并分支护栏）新条目映射 manageSkill，且已存在条目分支**经共享合并函数并入**终态字段', () => {
    const { merge, push } = rendererManageRegions();
    // 判据都是**具体区域 + 语义调用**，不是整文件子串存在性（旧版只查 `manageSkill` 子串与一个
    // 三元表达式 —— 覆盖写法同样满足，正是 CR-01 得以漏绿的假绿形态）。
    assert.ok(
      merge.includes('mergeManageSkillMarker('),
      '已存在条目合并分支必须调用跨进程单源的共享合并函数 —— **把渲染端改回 `manageSkill: event.manage_skill`'
        + ' 覆盖写法时本断言必然转红**（M5b 读不到渲染端源码，那条路径由本断言独占）'
    );
    assert.strictEqual(
      /manageSkill:\s*event\.manage_skill\b/.test(merge),
      false,
      '已存在条目合并分支不得再用事件载荷**直接赋值**给标记字段（那是 CR-01 的覆盖写法，'
        + '会抹掉 start 的 action / name ⇒ 整张卡片的技能变体崩塌）'
    );
    assert.ok(/manageSkill/.test(push), '新条目分支必须映射 manageSkill（首个事件无对象可并入，直接写入等价）');
  });

  test('M4（源码 · 渲染端零判定）三处接线区域零来源判定素材、零 HTML 拼接', () => {
    const { merge, push, branch } = rendererManageRegions();
    for (const [label, seg] of [['合并分支', merge], ['新条目分支', push], ['卡片分支', branch]]) {
      assert.strictEqual(
        /seededNames|managed-skills|skills-builtin/.test(seg),
        false,
        `${label}不得出现来源判定素材（硬约束 4：判定只在主进程）`
      );
      assert.strictEqual(
        /innerHTML/.test(seg),
        false,
        `${label}不得写 HTML 模板拼接（注入纪律）`
      );
      assert.strictEqual(
        /filePath/.test(seg),
        false,
        `${label}不得按路径字符串判定技能`
      );
    }
    assert.ok(
      branch.includes('MANAGE_SKILL_ACTION_LABEL') && branch.includes('TIER_BADGE'),
      '卡片分支只能查两张白名单表'
    );
  });

  test('M5（源码 · 重载同形）两条链路共用一个装饰构造（恰 1 处定义）', () => {
    const src = readSource('ai-manager.js');
    assert.strictEqual(
      (src.match(/^\s*_buildManageSkillDecoration\(/gm) || []).length,
      1,
      '装饰构造必须恰 1 处定义（不得写两份对象字面量）'
    );
    assert.strictEqual(
      (src.match(/_buildManageSkillDecoration\s*\(/g) || []).length,
      3,
      '恰 1 处定义 + 2 处调用（实时链路取终态 + 重载链路重建）'
    );
    const body = methodBody(src, 'getConversationMessages');
    assert.ok(body.includes('_buildManageSkillDecoration('), '重载链路的装饰段必须经共用构造');
    assert.ok(body.includes("t.name === 'manage_skill'"), '只对 manage_skill 行求值（其它工具零成本）');
  });

  test('M5b（行为 · 重载同形 · 成功行）重载链路与实时链路**经共享合并函数**产出的 manageSkill 逐字相等', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    writeSkill(workspace.getManagedSkillsDir(), 'alpha');
    const env = await setupSkillsEnv(root);

    // 实时链路：start 给 {action, name}，end 给终态三键 —— 渲染端合并两者。
    // `live` 由**渲染端真正调用的那个合并函数**算出（`require` 与 `window.SkillPickerModel`
    // 是同一个 api 对象引用）—— 手搓 `{ ...startMarker, ...endTerminal }` 验证的是**意图**
    // 而非渲染端的真实语义（那正是 CR-01 得以漏绿的假绿形态）。
    const startMarker = aiManager.prototype._resolveManageSkillMarker.call({}, 'create', 'alpha');
    const endCtx = {
      _buildManageSkillDecoration: aiManager.prototype._buildManageSkillDecoration,
      _resolveManageSkillMarker: aiManager.prototype._resolveManageSkillMarker,
      _manageSkillMeta: new Map([['tc1', {
        action: 'create', name: 'alpha', tier: 'managed', promptIncluded: false,
      }]]),
    };
    const endTerminal = aiManager.prototype._resolveManageSkillTerminal.call(endCtx, 'tc1');
    const live = skillPickerModel.mergeManageSkillMarker(startMarker, endTerminal);
    assert.deepStrictEqual(
      live,
      { action: 'create', name: 'alpha', tier: 'managed', promptIncluded: false },
      '前置：实时链路合并后的标记形状'
    );

    const original = conversationStore.getMessages;
    conversationStore.getMessages = () => JSON.parse(JSON.stringify([
      {
        id: 1, role: 'assistant', content: '', toolExecutions: [
          {
            id: 'tc1', name: 'manage_skill', status: 'completed',
            params: { action: 'create', name: 'alpha', content: '# alpha', description: 'd' },
            result: '已创建技能「alpha」。该技能从下一条消息起可用。',
            details: { action: 'create', name: 'alpha', filePath: '/tmp/x/SKILL.md', description: 'd', promptIncluded: false },
          },
        ],
      },
    ]));
    t.after(() => { conversationStore.getMessages = original; });

    const out = aiManager.prototype.getConversationMessages.call(manageReloadCtx(env, []), 'conv-1');
    const exec = out[0].toolExecutions[0];
    assert.ok(exec.manageSkill, '重载路径必须重建 manage_skill 标记');
    assert.deepStrictEqual(
      Object.keys(exec.manageSkill).sort(),
      Object.keys(live).sort(),
      '键集合必须与实时链路逐字相等'
    );
    assert.deepStrictEqual(exec.manageSkill, live, '取值必须与实时链路逐字相等');
    // 既有字段的存在性与取值不得改变（renderer 普通卡片路径逐字节不变）
    assert.strictEqual(exec.name, 'manage_skill');
    assert.strictEqual(exec.status, 'completed');
    assert.deepStrictEqual(exec.params.action, 'create');
  });

  test('M5c（行为 · 重载同形 · 失败行）短原因经词缀复原，且两条链路键集合与取值逐字相等', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    // 可判定 tier 的造法：目标名进 `manageReloadCtx` 的 seeded 第二参 + `managed-skills/` 下
    // 有同名目录 ⇒ `sourceTierOf` 判为 `builtin`（Phase 47 D-11 的播种登记表口径）。
    writeSkill(workspace.getManagedSkillsDir(), 'seeded-one');
    const env = await setupSkillsEnv(root);

    // 实时链路：失败态由**同一个共享合并函数**并入（渲染端真正调用的那个）
    const liveCtx = {
      _buildManageSkillDecoration: aiManager.prototype._buildManageSkillDecoration,
      _resolveManageSkillMarker: aiManager.prototype._resolveManageSkillMarker,
      _manageSkillMeta: new Map([['tc-fail', {
        action: 'create', name: 'seeded-one', code: 'seeded_protected', tier: 'builtin',
      }]]),
    };
    const live = skillPickerModel.mergeManageSkillMarker(
      aiManager.prototype._resolveManageSkillMarker.call({}, 'create', 'seeded-one'),
      aiManager.prototype._resolveManageSkillTerminal.call(liveCtx, 'tc-fail')
    );
    assert.deepStrictEqual(
      live,
      { action: 'create', name: 'seeded-one', code: 'seeded_protected', tier: 'builtin' },
      '前置：失败行的实时合并形状（短原因 + 可判定档位）'
    );

    const original = conversationStore.getMessages;
    conversationStore.getMessages = () => JSON.parse(JSON.stringify([
      {
        id: 1, role: 'assistant', content: '', toolExecutions: [
          {
            id: 'tc-fail', name: 'manage_skill', status: 'failed',
            params: { action: 'create', name: 'seeded-one', content: '# seeded-one', description: 'd' },
            error: '[seeded_protected] 「seeded-one」是随包内置技能，AI 不能覆盖或删除。',
            details: {},
          },
        ],
      },
    ]));
    t.after(() => { conversationStore.getMessages = original; });

    const out = aiManager.prototype.getConversationMessages.call(manageReloadCtx(env, ['seeded-one']), 'conv-1');
    const exec = out[0].toolExecutions[0];
    assert.ok(exec.manageSkill, '重载路径必须重建 manage_skill 标记（失败行同样）');
    // **双向**断言键集合：不多键（实时多出来的键必须也在重载侧）也不少键
    assert.deepStrictEqual(
      Object.keys(exec.manageSkill).sort(),
      Object.keys(live).sort(),
      '失败行：键集合必须与实时链路逐字相等（不多键也不少键）'
    );
    assert.deepStrictEqual(exec.manageSkill, live, '失败行：取值必须与实时链路逐字相等');
    assert.strictEqual(
      exec.manageSkill.code,
      'seeded_protected',
      '失败历史卡片必须保留短原因（原因码经事务内的词缀落库并还原）'
    );
  });

  test('M6（行为）_resolveManageSkillMarker 四分支打表', () => {
    const call = (action, name) => aiManager.prototype._resolveManageSkillMarker.call({}, action, name);
    for (const action of ['create', 'update', 'delete']) {
      assert.deepStrictEqual(
        call(action, 'foo'),
        { action, name: 'foo' },
        `${action} + 合法 name → 成立`
      );
    }
    assert.deepStrictEqual(call('create', '  foo  '), { action: 'create', name: 'foo' }, 'name 必须 trim');
    assert.strictEqual(call('rename', 'foo'), null, 'action 表外 → 整个技能变体不成立');
    assert.strictEqual(call(undefined, 'foo'), null, 'action 缺失 → 不成立');
    assert.strictEqual(call('create', ''), null, 'name 空串 → 不成立');
    assert.strictEqual(call('create', '   '), null, 'name 全空白 → 不成立');
    assert.strictEqual(call('create', 123), null, 'name 非字符串 → 不成立');
    assert.strictEqual(call('create', null), null, 'name 缺失 → 不成立');
  });

  test('M7（源码 · 参数区）三行可读摘要且**剔除 content**（不再整体 JSON 化）', () => {
    const { content } = rendererManageRegions();
    const code = stripComments(content);
    for (const label of ['动作：', '技能名：', '描述：']) {
      assert.ok(content.includes(label), `参数摘要必须含「${label}」一行`);
    }
    assert.ok(
      content.includes('MANAGE_SKILL_ACTION_NAME'),
      '「动作：」的取值必须查动作中文短名表（不得从标题模板做字符串手术）'
    );
    assert.strictEqual(
      /JSON\.stringify\(toolExecution\.params/.test(code),
      false,
      '本变体不得把整个 params JSON 化（64 KiB 正文会变成一整面 JSON 墙且被二次转义）'
    );
    assert.ok(
      content.includes("manageSkill.action !== 'delete'"),
      'delete 只有动作 / 技能名两行（不渲染描述，也不渲染正文折叠块）'
    );
  });

  test('M8（源码 · 结果区）渲染文本（取 text 块）而非 JSON 序列化', () => {
    const { content } = rendererManageRegions();
    const code = stripComments(content);
    assert.ok(/type === 'text'/.test(code), '结果区必须取 content[] 中的 text 块（对象形状）');
    assert.ok(
      /typeof value === 'string'/.test(code) || /typeof v === 'string'/.test(code),
      '字符串形状必须原样返回（重载链路的 result 本就是文本 ⇒ 两条链路逐字一致）'
    );
    assert.strictEqual(
      /JSON\.stringify\(.*result/.test(code),
      false,
      '结果区不得 JSON.stringify(result)（details 也不进结果区）'
    );
    assert.strictEqual(code.includes('details'), false, 'details 不进结果区');
  });

  test('M9（源码 · 折叠块复用）唯一构建实现 + a11y 增量 + 两条件挂载', () => {
    const rendererSrc = readSource('src/renderer.js');
    assert.strictEqual(
      (rendererSrc.match(/function renderSkillContentBox\s*\(/g) || []).length,
      1,
      '技能正文折叠块的构建函数必须恰 1 处定义（不得新建第二份折叠实现）'
    );
    const box = functionBody(rendererSrc, 'renderSkillContentBox');
    for (const need of ['role', 'tabindex', 'aria-expanded', 'keydown', 'Enter', 'preventDefault']) {
      assert.ok(box.includes(need), `折叠块 a11y 增量缺 ${need}`);
    }
    assert.ok(box.includes('ai-skill-content-box'), '折叠块必须复用 48 D-09 的既有类名');
    assert.ok(box.includes('技能正文（'), 'header 文案逐字复用「技能正文（N 字符）」');
    assert.strictEqual(box.includes('innerHTML'), false, '折叠块不得写 HTML 拼接');

    const { content } = rendererManageRegions();
    assert.ok(
      content.includes("toolExecution.status !== 'failed'"),
      '展开区失败态不得渲染正文折叠块（写入未落盘，无正文可示）'
    );
    assert.ok(content.includes("manageSkill.action !== 'delete'"), 'delete 不渲染折叠块');
    assert.ok(
      content.includes('renderSkillContentBox('),
      '卡片语境必须复用同一实现（而不是第二份折叠外观）'
    );
  });

  test('M10（源码 · 标注至多一个）单一挂载点 + 两处取值来自既有单源', () => {
    const { branch } = rendererManageRegions();
    assert.strictEqual(
      (branch.match(/appendChild\(noteEl\)/g) || []).length,
      1,
      '内联标注的 createElement 挂载点必须**恰 1 处**（不是两条 if 各自 append —— 那会有两个标注）'
    );
    assert.ok(branch.includes('MANAGE_SKILL_SHORT_REASON['), '失败短原因必须查九码白名单表');
    assert.ok(branch.includes('STATUS_TEXT.promptOmitted'), '「未进提示词」必须逐字复用既有字符串');
    assert.ok(branch.includes('tool-card-manage-note-error'), '失败态标注类必须存在');
    assert.ok(branch.includes('tool-card-manage-note-limit'), '超预算标注类必须存在');
    assert.ok(
      /if \(noteText\)/.test(branch),
      '0 个标注时**不渲染元素**（不占位、不留空元素）'
    );
  });

  test('M11（源码 · 钩子类）card.classList.add(\'tool-card-manage\') 恰 1 处', () => {
    const rendererSrc = readSource('src/renderer.js');
    assert.strictEqual(
      (rendererSrc.match(/card\.classList\.add\('tool-card-manage'\)/g) || []).length,
      1,
      '钩子类必须在 manage_skill 变体处恰挂一次（无 CSS 规则的定位钩子）'
    );
  });

  test('M12（源码 · 令牌两处）--skill-error-text 两个主题块各定义一次 + 前置修复 ②', () => {
    const css = readSource('src/styles/main.css');
    assert.strictEqual(
      (css.match(/--skill-error-text\s*:/g) || []).length,
      2,
      '--skill-error-text 必须恰 2 处定义（:root/[data-theme="dark"] 与 [data-theme="light"] 各一）'
    );
    assert.ok(/--skill-error-text:\s*#FCA5A5/.test(css), '暗色主题值必须是 #FCA5A5');
    assert.ok(/--skill-error-text:\s*#B91C1C/.test(css), '浅色主题值必须是 #B91C1C');
    // 前置修复 ②：浅色 --skill-limit-text 由 #B45309 改为 #92400E（原值对浅色 hover 底 3.80:1 不达标）
    assert.ok(/--skill-limit-text:\s*#92400E/.test(css), '浅色 --skill-limit-text 必须是 #92400E');
    assert.strictEqual(
      /--skill-limit-text:\s*#B45309/.test(css),
      false,
      '浅色 --skill-limit-text 的旧值 #B45309 必须零命中'
    );
  });

  test('M13（源码 · 前置修复 ①）三档徽标的底色基准全部钉死为 var(--bg-secondary)', () => {
    const css = readSource('src/styles/main.css');
    for (const tier of ['user', 'builtin', 'managed']) {
      const at = css.indexOf('.slash-picker-source-badge-' + tier + ' {');
      assert.ok(at >= 0, `应存在 .slash-picker-source-badge-${tier}`);
      const seg = css.slice(at, css.indexOf('}', at));
      assert.strictEqual(
        seg.includes('transparent'),
        false,
        `.slash-picker-source-badge-${tier} 不得再以中性色作底色基准（卡片 hover 态会漂移）`
      );
      const mixLines = seg.split('\n').filter((line) => line.includes('color-mix('));
      assert.strictEqual(mixLines.length, 2, `.slash-picker-source-badge-${tier} 应有 background + border 两条 color-mix`);
      for (const line of mixLines) {
        assert.ok(
          /color-mix\(in srgb, var\(--[a-z-]+\) \d+%, var\(--bg-secondary\)\)/.test(line),
          `每条 color-mix 的第二个颜色参数必须是 var(--bg-secondary)：${line.trim()}`
        );
      }
    }
  });

  test('M14（源码 · 标注规格）三条 .tool-card-manage-note* 规则逐字落地，基类零内边距/外边距', () => {
    const css = readSource('src/styles/main.css');
    const at = css.indexOf('.tool-card-manage-note {');
    assert.ok(at >= 0, '缺 .tool-card-manage-note 规则');
    const seg = css.slice(at, at + 400);
    for (const prop of ['flex-shrink: 0', 'white-space: nowrap', 'font-size: 11px', 'font-weight: 400', 'line-height: 1.4']) {
      assert.ok(seg.includes(prop), `标注基类缺 ${prop}`);
    }
    assert.strictEqual(
      /(^|\n)\s*(padding|margin)\s*:/.test(seg),
      false,
      '标注基类不得声明内边距 / 外边距（间隙由宿主 .tool-card-name-skill 的存量 gap 提供）'
    );
    assert.ok(/\.tool-card-manage-note-error\s*\{[^}]*var\(--skill-error-text\)/.test(css), '-error 规则必须取 --skill-error-text');
    assert.ok(/\.tool-card-manage-note-limit\s*\{[^}]*var\(--skill-limit-text\)/.test(css), '-limit 规则必须取 --skill-limit-text');
  });

  test('M15（源码 · 头部单行不变式）.tool-card-header 无 flex-wrap，标注永不截断', () => {
    const css = readSource('src/styles/main.css');
    const headerAt = css.indexOf('.tool-card-header {');
    assert.ok(headerAt >= 0, '应存在 .tool-card-header 规则');
    const header = css.slice(headerAt, css.indexOf('}', headerAt));
    assert.strictEqual(
      header.includes('flex-wrap'),
      false,
      '头部恒为 36px 单行 —— 不得声明 flex-wrap（超长技能名由 .tool-card-name-text 承担压缩）'
    );
    const noteAt = css.indexOf('.tool-card-manage-note {');
    const noteSeg = css.slice(noteAt, noteAt + 300);
    assert.strictEqual(noteSeg.includes('overflow'), false, '标注不得声明 overflow（永久可见，不让位）');
    assert.strictEqual(noteSeg.includes('text-overflow'), false, '标注不得声明 text-overflow（短原因定长，永不截断）');
  });

  test('M16（源码 · 卡片语境）两处 scoped 覆盖 + 折叠块 header 焦点环', () => {
    const css = readSource('src/styles/main.css');
    assert.ok(
      /\.tool-card-content \.ai-skill-content-box \{/.test(css),
      '缺卡片语境覆盖 1（水平内边距与 .tool-card-params 对齐）'
    );
    assert.ok(
      /\.tool-card-content \.ai-skill-content-box-body \{[^}]*max-height: none/.test(css),
      '缺卡片语境覆盖 2（内层 max-height: none —— 由卡片内容区作唯一滚动容器）'
    );
    assert.ok(
      /\.ai-skill-content-box-header:focus-visible\s*\{/.test(css),
      '缺折叠块 header 的 :focus-visible 视觉（header 现为 role=button + tabindex=0）'
    );
  });
});

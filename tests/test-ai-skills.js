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

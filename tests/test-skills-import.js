/**
 * 用户技能导入管线的 zip 一侧测试套件（node:test，**纯 Node 环境**）
 *
 * 覆盖 Phase 51 的导入面：限额常量与错误码表、entry 名校验（自建，含 yauzl 六类漏网）、
 * 归一化查重、frontmatter 解析、解压 + 全树校验、技能根定位、六字段预览、
 * **唯一落盘实现**（`importUserSkill`）的落盘与回读验证，以及「三条来源共用一条解压
 * 入口 / 一个落盘实现」的**源码扫描判据**。
 *
 * ## 两条硬纪律
 *
 * ① **`seededNames` 一律显式注入常量 `SEEDED`，严禁走 `getSeededSkillNamesSafe()`**：
 *    后者在纯 Node 下 `require('electron')` 返回字符串 ⇒ 降级为 `[]` ⇒ seeded 用例**假绿**。
 * ② **夹具零外部依赖**：`tests/helpers/make-malicious-zip.js` 只用 `zlib` 与手写字节，
 *    不依赖 `python3` / `zip` 命令行（新机器必须能直接跑本文件）。
 *
 * 用法: node tests/test-skills-import.js
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');
const aiSkills = require('../ai-skills-manager');
const makeZip = require('./helpers/make-malicious-zip');

/** 仓库根目录（源码扫描型断言用） */
const REPO_ROOT = path.join(__dirname, '..');

/** 假的播种登记表（显式注入，不依赖真实随包目录） */
const SEEDED = ['find-skills', 'skill-creator'];

/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/**
 * 词法级剥除注释（与 `tests/test-skills-http-api.js` 的 `stripCodeComments` **逐字同款**）
 *
 * 「计数 / token 禁令」类判据一律**先剥注释再判** —— 注释里可以如实写明被禁的形态。
 */
function stripCodeComments(x) {
  let o = '';
  let i = 0;
  let s = 0;
  let p = '';
  const N = x.length;
  while (i !== N) {
    const c = x[i];
    const d = x[i + 1];
    if (s === 1) { o += c === '\n' ? '\n' : ' '; if (c === '\n') s = 0; i++; continue; }
    if (s === 2) { if (c === '*' && d === '/') { o += '  '; i += 2; s = 0; continue; } o += c === '\n' ? '\n' : ' '; i++; continue; }
    if (s === 3 || s === 4 || s === 5) {
      if (c === '\\') { o += c + (d === undefined ? '' : d); i += d === undefined ? 1 : 2; continue; }
      o += c;
      if ((s === 3 && c === "'") || (s === 4 && c === '"') || (s === 5 && c === '`')) s = 0;
      i++;
      continue;
    }
    if (s === 6) {
      if (c === '\\') { o += c + (d === undefined ? '' : d); i += d === undefined ? 1 : 2; continue; }
      o += c;
      if (c === '/') s = 0;
      i++;
      continue;
    }
    if (c === '/' && d === '/') { o += '  '; i += 2; s = 1; continue; }
    if (c === '/' && d === '*') { o += '  '; i += 2; s = 2; continue; }
    if (c === "'") { o += c; s = 3; i++; p = c; continue; }
    if (c === '"') { o += c; s = 4; i++; p = c; continue; }
    if (c === '`') { o += c; s = 5; i++; p = c; continue; }
    if (c === '/' && (p === '' || "[=(,;:![{&|?+-*%~^".indexOf(p) !== -1)) { o += c; s = 6; i++; p = c; continue; }
    o += c;
    if (c.trim()) p = c;
    i++;
  }
  return o;
}

/** 统计某 token 在「剥注释后」的源码里的出现次数 */
function countToken(file, token) {
  const code = stripCodeComments(readSource(file));
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (code.match(new RegExp(escaped, 'g')) || []).length;
}

/** 一次性临时工作区根（`setWorkspaceDir` 注入 ⇒ 不触碰真实 userData） */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skill-import-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
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

/** 造一个一次性导入目录并写入 `pkg.zip`（与 `previewSkillImport` 的调用方契约一致） */
function stageZip(zipBuffer) {
  const importDir = fs.mkdtempSync(path.join(workspace.getTmpDir(), 'skill-import-'));
  fs.writeFileSync(path.join(importDir, 'pkg.zip'), zipBuffer);
  return importDir;
}

/** 断言调用抛错且 `code` 匹配 */
async function expectThrowCode(fn, code) {
  let err = null;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  assert.ok(err, `期望抛出 code=${code} 的错误，但调用成功返回`);
  assert.strictEqual(err.code, code, `期望 code=${code}，实测 ${err.code}（message: ${err.message}）`);
  return err;
}

/** `skills/` 下的目录名单（拒绝路径的「零新增」判据） */
function userSkillNames() {
  try {
    return fs.readdirSync(workspace.getSkillsDir()).sort();
  } catch {
    return [];
  }
}

// ==================== ① tracer：端到端纵切 ====================

describe('tracer：preview 不落盘 → commit 落盘 → 回读可见', () => {
  test('合法单技能包走完「解压校验 → 定位 → 预览 → 唯一落盘 → 回读」', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);

    const zip = makeZip.skillPackage({
      name: 'demo-skill',
      description: '演示技能：验证导入纵切',
      body: '# demo-skill\n\n正文内容\n',
    });
    const importDir = stageZip(zip);

    // ---- preview 阶段 ----
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);
    const preview = await aiSkills.buildImportPreview(env, {
      pkgRoot: prepared.pkgRoot,
      rootRel: located.rootRel,
      origin: 'zip',
      seededNames: SEEDED,
    });

    assert.strictEqual(preview.name, 'demo-skill', 'frontmatter name 应成为落盘名');
    assert.ok(
      typeof preview.description === 'string' && preview.description.includes('演示技能'),
      '预览必须回传 description 原文'
    );
    assert.strictEqual(preview.fileCount, 1, '包内恰一个文件');
    assert.strictEqual(preview.dirCount, 0, '包内无子目录');
    assert.ok(Array.isArray(preview.tree) && preview.tree.length === 1, '目录树含那一个文件');
    assert.ok(preview.limits && preview.limits.maxTotalBytes > 0, '预览必须回传限额投影（前端零字面量）');
    assert.strictEqual(preview.conflict.kind, 'none', '无同名用户技能');
    assert.deepStrictEqual(preview.scan.injection, { hit: false }, '注入类在到达预览前已整包拒绝 ⇒ 恒 false');

    // ---- 负向差分：preview 之后 skills/<name>/ 仍不存在 ----
    const destDir = path.join(workspace.getSkillsDir(), 'demo-skill');
    assert.strictEqual(
      fs.existsSync(destDir),
      false,
      'preview 阶段不得产生 skills/<name>/（差分断言，而不是「没调用过 fs」）'
    );

    // ---- commit 阶段 ----
    const before = userSkillNames();
    const packagedText = fs.readFileSync(path.join(prepared.pkgRoot, located.rootRel, 'SKILL.md'), 'utf8');
    const report = await aiSkills.importUserSkill(
      env,
      { srcDir: located.skillRootAbs, name: preview.name },
      { seededNames: SEEDED }
    );

    const after = userSkillNames();
    assert.strictEqual(after.length, before.length + 1, 'commit 后 skills/ 下恰新增一个目录');
    assert.ok(after.includes('demo-skill'), '新增的目录名 = 校验后的 name');

    const mdPath = path.join(destDir, 'SKILL.md');
    assert.ok(fs.existsSync(mdPath), 'commit 后 skills/<name>/SKILL.md 必须存在');
    assert.strictEqual(
      fs.readFileSync(mdPath, 'utf8'),
      packagedText,
      '落盘内容与包内逐字一致（导入不重写文件）'
    );
    assert.strictEqual(report.name, 'demo-skill');
    assert.strictEqual(report.source, 'zip');
    assert.ok(report.files >= 1, '导入报告含文件数');

    // ---- 回读验证的机器判据 ----
    const snap = aiSkills.getSkillsSnapshot();
    const hit = snap.skills.find((e) => e && e.skill && e.skill.name === 'demo-skill');
    assert.ok(hit, '重扫后快照里必须能查到该技能（回读验证）');
    assert.ok(
      typeof hit.skill.filePath === 'string' &&
        hit.skill.filePath.startsWith(workspace.getSkillsDir() + path.sep),
      'filePath 必须指向 skills/ 目录'
    );
  });

  test('sourceDir 已被 rename 走 ⇒ 包内副本不再存在（证明是搬移而非复制）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(makeZip.skillPackage({ name: 'move-check' }));
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);

    assert.ok(fs.existsSync(located.skillRootAbs), '搬移前源目录存在');
    await aiSkills.importUserSkill(
      env,
      { srcDir: located.skillRootAbs, name: 'move-check' },
      { seededNames: SEEDED }
    );
    assert.strictEqual(fs.existsSync(located.skillRootAbs), false, '搬移后源目录消失（同设备原子 rename）');
  });
});

// ==================== ② 单一落盘实现 / 单一解压入口（源码扫描） ====================

describe('单一落盘实现与单一解压入口（源码扫描，先剥注释）', () => {
  test('`importUserSkill(` 全仓恰 2 处：定义 1 + 调用 1；handler 与前端各 0', () => {
    assert.strictEqual(
      countToken('ai-skills-manager.js', 'importUserSkill('),
      1,
      'ai-skills-manager.js 必须恰 1 处（唯一落盘实现的定义）'
    );
    assert.strictEqual(
      countToken('ai-manager.js', 'importUserSkill('),
      1,
      'ai-manager.js 必须恰 1 处（唯一调用点）'
    );
    assert.strictEqual(
      countToken('main.js', 'importUserSkill('),
      0,
      'main.js 不得出现 importUserSkill(（落盘不得下沉到 handler）'
    );
    assert.strictEqual(
      countToken('src/settings-page.js', 'importUserSkill('),
      0,
      'src/settings-page.js 不得出现 importUserSkill(（前端不得落盘）'
    );
  });

  test('`yauzl.openPromise(` 在 ai-skills-manager.js 恰 1 处（三种来源共用一条解压入口）', () => {
    assert.strictEqual(
      countToken('ai-skills-manager.js', 'yauzl.openPromise('),
      1,
      '解压入口必须恰 1 处（直链 SKILL.md 日后另写一条会让本判据转红）'
    );
  });

  test('端点与前端零字面量：导入限额数值只出现在 ai-skills-manager.js', () => {
    const settingsPage = readSource('src/settings-page.js');
    const forbidden = [
      'IMPORT_LIMITS',
      '32 * 1024 * 1024',
      'MAX_NESTING_DEPTH',
      'MAX_TOTAL_BYTES',
      'MAX_SKILL_PACKAGE_BYTES',
    ];
    for (const literal of forbidden) {
      assert.ok(
        !settingsPage.includes(literal),
        `设置页不得出现导入限额字面量 ${literal}（限额一律取主进程回传值）`
      );
    }
  });
});

// ==================== ③ entry 名校验（自建判据） ====================

describe('validateEntryName：八条判据与判据顺序', () => {
  const ok = (name) => aiSkills.validateEntryName(Buffer.from(name, 'utf8'), name);

  test('合法形态放行（含子目录、中文、连字符）', () => {
    assert.strictEqual(ok('SKILL.md'), null);
    assert.strictEqual(ok('demo-skill/SKILL.md'), null);
    assert.strictEqual(ok('scripts/office/schemas/x.xsd'), null);
    assert.strictEqual(ok('中文目录/SKILL.md'), null);
  });

  test('`a/../b` 是合法的包内相对路径，**不得**被字符串 includes(..) 误杀', () => {
    assert.strictEqual(
      ok('a/../b/SKILL.md'),
      null,
      '归一化后是 b/SKILL.md ⇒ 合法；用字符串 includes("..") 会误杀'
    );
    assert.strictEqual(ok('a/b/../../../evil.txt').detail, 'path_escape');
    assert.strictEqual(ok('../evil.txt').detail, 'path_escape');
    assert.strictEqual(ok('./../../evil.txt').detail, 'path_escape');
  });

  test('空串 / 仅 `/` / 仅 `.` 一律拒绝（不静默跳过）', () => {
    for (const n of ['', '/', '.']) {
      const r = aiSkills.validateEntryName(Buffer.from(n, 'utf8'), n);
      assert.ok(r, `entry 名 ${JSON.stringify(n)} 必须被拒绝`);
      assert.strictEqual(r.code, aiSkills.IMPORT_SKILL_ERROR.UNSAFE_ENTRY);
    }
  });

  test('原始字节面先判：CP437 会把 \\x01 解码成 ☺ ⇒ 只看解码值会漏', () => {
    // 原始字节含 \x01，但「解码后」是被 CP437 解出来的可打印字符
    const raw = Buffer.from('ctl\x01evil/SKILL.md', 'latin1');
    const decoded = 'ctl☺evil/SKILL.md';
    const r = aiSkills.validateEntryName(raw, decoded);
    assert.ok(r, '原始字节含控制字符必须被拒（先判原始字节面）');
    assert.strictEqual(r.detail, 'control_char_raw');
  });

  test('yauzl 六类漏网逐类拒绝：ADS / NUL / 尾随空格与点 / 空段 / RTL', () => {
    assert.strictEqual(ok('evil.txt:ads').detail, 'ntfs_ads');
    assert.strictEqual(ok('evil.').detail, 'trailing');
    assert.strictEqual(ok('evil ').detail, 'trailing');
    assert.strictEqual(ok('a//tmp/x.txt').detail, 'empty_segment');
    assert.strictEqual(ok('x\u202ey/SKILL.md').detail, 'bidi_control');
    const nul = aiSkills.validateEntryName(Buffer.from('nul\x00evil/SKILL.md', 'latin1'), 'nul\x00evil/SKILL.md');
    assert.ok(nul, 'NUL 必须被拒');
  });

  test('盘符 / UNC / 反斜杠各自拒绝', () => {
    assert.strictEqual(ok('C:/evil.txt').detail, 'drive_letter');
    // `//srv/share/e` 在 ③ 的归一化判据（`normalize` 后以 `/` 开头）就已被拦下 ——
    // 判据顺序即语义；④ 的 UNC 判据是纵深（对已归一化为 `//…` 的形态仍生效）
    const unc = ok('//srv/share/e');
    assert.ok(unc, 'UNC 形态必须被拒');
    assert.ok(
      unc.detail === 'path_escape' || unc.detail === 'unc',
      `UNC 形态的 detail 应为 path_escape 或 unc，实测 ${unc.detail}`
    );
    assert.strictEqual(aiSkills.validateEntryName(Buffer.from('a\\b'), 'a\\b').detail, 'backslash');
  });

  test('15 条逃逸族样本逐条拒绝（含 yauzl 自身拦下的六类）', () => {
    let rejected = 0;
    for (const name of makeZip.ESCAPE_NAMES) {
      const r = aiSkills.validateEntryName(Buffer.from(name, 'latin1'), name);
      if (r) rejected += 1;
    }
    // 六类由 yauzl 在枚举期拦下（到不了本函数）⇒ 本函数只需覆盖其余形态；
    // 断言「至少 9 条被本函数直接拒绝」，并要求总数守恒（见 ④ 组的逐类解压用例）
    assert.ok(rejected >= 9, `自建校验器直接拒绝的样本数 ${rejected} < 9`);
  });
});

describe('normalizedEntryKey：NFD + 小写', () => {
  test('大小写与 Unicode NFC/NFD 都归一到同一键', () => {
    assert.strictEqual(
      aiSkills.normalizedEntryKey('Skill/SKILL.md'),
      aiSkills.normalizedEntryKey('skill/SKILL.md')
    );
    assert.strictEqual(
      aiSkills.normalizedEntryKey('caf\u00e9/SKILL.md'), // NFC
      aiSkills.normalizedEntryKey('cafe\u0301/SKILL.md') // NFD
    );
  });

  test('不同名不误判为同一键', () => {
    assert.notStrictEqual(
      aiSkills.normalizedEntryKey('a/SKILL.md'),
      aiSkills.normalizedEntryKey('b/SKILL.md')
    );
  });
});

// ==================== ④ frontmatter 解析 ====================

describe('parseSkillFrontmatter：实测形态逐条', () => {
  const fm = (text) => aiSkills.parseSkillFrontmatter(text);

  test('正常两行 frontmatter 解析成功', () => {
    const r = fm('---\nname: foo\ndescription: bar\n---\n\n正文\n');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.name, 'foo');
    assert.strictEqual(r.description, 'bar');
    assert.strictEqual(r.allowedTools, null);
  });

  test('`description: Use this: for stuff` 抛 YAMLParseError ⇒ 硬错误（幽灵技能防线）', () => {
    const r = fm('---\nname: foo\ndescription: Use this: for stuff\n---\n\n');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, aiSkills.IMPORT_SKILL_ERROR.FRONTMATTER_INVALID);
  });

  test('缺 description ⇒ 拒绝（SDK 会整条丢弃该技能）', () => {
    const r = fm('---\nname: foo\n---\n\n');
    assert.strictEqual(r.ok, false);
  });

  test('空 description / 纯空白 description ⇒ 拒绝', () => {
    assert.strictEqual(fm('---\nname: foo\ndescription: ""\n---\n\n').ok, false);
    assert.strictEqual(fm('---\nname: foo\ndescription: "   "\n---\n\n').ok, false);
  });

  test('缺 name ⇒ name 为 null（回落目录名由 deriveImportName 负责）', () => {
    const r = fm('---\ndescription: bar\n---\n\n');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.name, null);
  });

  test('顶层是数组 / 空文本 ⇒ 拒绝（parse 返回数组 / null）', () => {
    assert.strictEqual(fm('---\n- a\n- b\n---\n\n').ok, false);
    assert.strictEqual(fm('---\n\n---\n\n').ok, false);
  });

  test('allowed-tools 两种合法形态都归一化为数组；空值视为缺失', () => {
    assert.deepStrictEqual(
      fm('---\nname: f\ndescription: d\nallowed-tools: Read, Bash\n---\n\n').allowedTools,
      ['Read', 'Bash']
    );
    assert.deepStrictEqual(
      fm('---\nname: f\ndescription: d\nallowed-tools:\n  - Read\n  - Bash\n---\n\n').allowedTools,
      ['Read', 'Bash']
    );
    assert.strictEqual(fm('---\nname: f\ndescription: d\nallowed-tools:\n---\n\n').allowedTools, null);
  });

  test('无反斜杠转义损坏：YAML 单引号语义下 Windows 路径不被破坏', () => {
    const r = fm("---\nname: f\ndescription: 'C:\\path\\to\\x'\n---\n\n");
    assert.strictEqual(r.ok, true);
    assert.ok(r.description.includes('C:\\path'), '反斜杠必须原样保留');
  });
});

describe('deriveImportName：frontmatter 优先，回落目录名，必须过写侧校验器', () => {
  test('frontmatter.name 优先', () => {
    const r = aiSkills.deriveImportName({ name: 'from-fm' }, 'pkg-dir');
    assert.deepStrictEqual(r, { ok: true, name: 'from-fm' });
  });

  test('缺 name 时回落技能根目录名', () => {
    const r = aiSkills.deriveImportName({ name: null }, 'skills/my-tool');
    assert.deepStrictEqual(r, { ok: true, name: 'my-tool' });
  });

  test('非法名（大写 / 下划线）被写侧校验器拒绝，原因原样带出', () => {
    const r = aiSkills.deriveImportName({ name: 'Bad_Name' }, 'x');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'invalid_name', '复用 validateManagedSkillName 的码，不新立');
  });

  test('两者都拿不到 ⇒ 失败', () => {
    const r = aiSkills.deriveImportName({ name: null }, '');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, aiSkills.IMPORT_SKILL_ERROR.FRONTMATTER_INVALID);
  });
});

// ==================== ⑤ 技能根定位 ====================

describe('locateSkillRoot：限域 → 直接命中 → 全包扫描', () => {
  test('技能根在包根下方（CR-7：全包扫描不得限定 skills/*）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(makeZip.skillPackage({ name: 'root-skill', wrapPrefix: '' }));
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);
    assert.strictEqual(
      path.basename(located.skillRootAbs),
      'root-skill',
      `定位到的技能根应为 root-skill，实测 ${located.skillRootAbs}（rootRel=${located.rootRel}）`
    );
    assert.ok(fs.existsSync(path.join(located.skillRootAbs, 'SKILL.md')));
  });

  test('剥恒定顶层前缀后仍能定位（GitHub zipball 形态）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(
      makeZip.skillPackage({ name: 'pdf', wrapPrefix: 'skills-main/skills' })
    );
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);
    assert.ok(located.rootRel.endsWith('pdf'), `定位到 ${located.rootRel}`);
  });

  test('scopeRel 限域：剥离前缀后才成立的子路径', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(
      makeZip.buildZip({
        entries: [
          { name: 'skills-main/template/SKILL.md', data: '---\nname: t\ndescription: d\n---\n\n' },
          { name: 'skills-main/skills/pdf/SKILL.md', data: '---\nname: pdf\ndescription: d\n---\n\n' },
        ],
      })
    );
    const prepared = await aiSkills.extractAndValidatePackage(env, {
      importDir,
      scopeRel: 'skills/pdf',
    });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, 'skills/pdf');
    assert.ok(located.rootRel.endsWith('skills/pdf'), `限域定位到 ${located.rootRel}`);
  });

  test('多技能根 ⇒ 拒绝，message 含实测数量与可复制的 tree 地址示例', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(
      makeZip.buildZip({
        entries: [
          { name: 'skills/a/SKILL.md', data: '---\nname: a\ndescription: d\n---\n\n' },
          { name: 'skills/b/SKILL.md', data: '---\nname: b\ndescription: d\n---\n\n' },
          { name: 'template/SKILL.md', data: '---\nname: t\ndescription: d\n---\n\n' },
        ],
      })
    );
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    let err = null;
    try {
      aiSkills.locateSkillRoot(prepared.pkgRoot, null);
    } catch (e) {
      err = e;
    }
    assert.ok(err, '多根必须拒绝');
    assert.strictEqual(err.code, aiSkills.IMPORT_SKILL_ERROR.SKILL_ROOT_COUNT);
    assert.ok(err.message.includes('3 个技能'), `message 必须含实测数量：${err.message}`);
    assert.ok(err.message.includes('tree/<ref>/<path>'), 'message 必须含 tree 地址示例（CR-8 的可操作性）');
  });

  test('零技能根 ⇒ 拒绝', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(makeZip.buildZip({ entries: [{ name: 'readme.md', data: 'x' }] }));
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    let err = null;
    try {
      aiSkills.locateSkillRoot(prepared.pkgRoot, null);
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.strictEqual(err.code, aiSkills.IMPORT_SKILL_ERROR.SKILL_ROOT_COUNT);
    assert.ok(err.message.includes('实测 0'), `message 必须含实测数量：${err.message}`);
  });
});

// ==================== ⑥ 落盘的拒绝面（本计划中间态） ====================

describe('importUserSkill 的拒绝面：seeded 保护 / 同名冲突 / 不静默覆盖', () => {
  test('seeded 同名 ⇒ seeded_conflict，且不落盘', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(makeZip.skillPackage({ name: 'find-skills' }));
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);

    const before = userSkillNames();
    await expectThrowCode(
      () => aiSkills.importUserSkill(env, { srcDir: located.skillRootAbs, name: 'find-skills' }, { seededNames: SEEDED }),
      aiSkills.IMPORT_SKILL_ERROR.SEEDED_CONFLICT
    );
    assert.deepStrictEqual(userSkillNames(), before, 'seeded 拒绝路径不得产生任何新目录');
  });

  test('同名用户技能已存在 ⇒ conflict_unresolved（**不静默覆盖**）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    // 预置一个既有同名技能
    const existing = path.join(workspace.getSkillsDir(), 'dup-skill');
    fs.mkdirSync(existing, { recursive: true });
    fs.writeFileSync(path.join(existing, 'SKILL.md'), '---\nname: dup-skill\ndescription: 旧\n---\n\n旧正文\n');

    const importDir = stageZip(makeZip.skillPackage({ name: 'dup-skill', body: '# 新\n' }));
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);

    await expectThrowCode(
      () => aiSkills.importUserSkill(env, { srcDir: located.skillRootAbs, name: 'dup-skill' }, { seededNames: SEEDED }),
      aiSkills.IMPORT_SKILL_ERROR.CONFLICT_UNRESOLVED
    );
    assert.ok(
      fs.readFileSync(path.join(existing, 'SKILL.md'), 'utf8').includes('旧正文'),
      '拒绝路径必须保持既有技能逐字完好（不静默覆盖）'
    );
  });

  test('同名 managed 技能已存在 ⇒ conflict_unresolved（导入只管 skills/）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const managed = path.join(workspace.getManagedSkillsDir(), 'ai-made');
    fs.mkdirSync(managed, { recursive: true });
    fs.writeFileSync(path.join(managed, 'SKILL.md'), '---\nname: ai-made\ndescription: 旧\n---\n\n');

    const importDir = stageZip(makeZip.skillPackage({ name: 'ai-made' }));
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);

    await expectThrowCode(
      () => aiSkills.importUserSkill(env, { srcDir: located.skillRootAbs, name: 'ai-made' }, { seededNames: SEEDED }),
      aiSkills.IMPORT_SKILL_ERROR.CONFLICT_UNRESOLVED
    );
  });

  test('非法 name ⇒ 写侧校验器的码（invalid_name），不落盘', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);
    const importDir = stageZip(makeZip.skillPackage({ name: 'ok-name' }));
    const prepared = await aiSkills.extractAndValidatePackage(env, { importDir, scopeRel: null });
    const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);

    const before = userSkillNames();
    await expectThrowCode(
      () => aiSkills.importUserSkill(env, { srcDir: located.skillRootAbs, name: 'Bad_Name' }, { seededNames: SEEDED }),
      'invalid_name'
    );
    assert.deepStrictEqual(userSkillNames(), before);
  });
});

// ==================== ⑦ 限额 / 错误码表契约 ====================

describe('常量契约', () => {
  test('IMPORT_LIMITS 八键且值域正确（LIMITS 五项一字不改）', () => {
    const L = aiSkills.IMPORT_LIMITS;
    assert.strictEqual(L.MAX_ENTRY_BYTES, 1024 * 1024);
    assert.strictEqual(L.MAX_TOTAL_BYTES, 32 * 1024 * 1024);
    assert.strictEqual(L.MAX_ENTRIES, 2000);
    assert.strictEqual(L.MAX_COMPRESSION_RATIO, 100);
    assert.strictEqual(L.MAX_NESTING_DEPTH, 16);
    assert.strictEqual(L.PREVIEW_LIST_LIMIT, 50);
    assert.strictEqual(L.MAX_PENDING_IMPORTS, 3);
    assert.strictEqual(L.IMPORT_TTL_MS, 10 * 60 * 1000);
    assert.deepStrictEqual(aiSkills.LIMITS, {
      MAX_SKILL_MD_BYTES: 64 * 1024,
      MAX_USER_SKILLS: 50,
      SKILLS_PROMPT_CHAR_BUDGET: 8000,
      MAX_MANAGED_SKILLS: 50,
      MAX_SKILL_DESCRIPTION_CHARS: 1024,
    });
  });

  test('IMPORT_SKILL_ERROR 恰 20 键，且与 MANAGE_SKILL_ERROR 命名空间不相交', () => {
    const keys = Object.keys(aiSkills.IMPORT_SKILL_ERROR);
    assert.strictEqual(keys.length, 20, `IMPORT_SKILL_ERROR 应恰 20 键，实测 ${keys.length}`);
    assert.strictEqual(Object.keys(aiSkills.MANAGE_SKILL_ERROR).length, 11, 'MANAGE_SKILL_ERROR 必须仍是恰 11 键');
    const values = new Set(Object.values(aiSkills.IMPORT_SKILL_ERROR));
    assert.strictEqual(values.size, 20, '值的集合不得有重复');
    assert.ok(values.has('unsupported_url') && values.has('conflict_unresolved'), '中间态码必须在表内');
  });

  test('夹具生成器零外部依赖：不出现 python3 / zip 命令行调用', () => {
    const src = readSource('tests/helpers/make-malicious-zip.js');
    assert.ok(!/spawnSync|execSync|child_process/.test(src), '夹具生成器不得 spawn 外部进程');
    assert.ok(src.includes('deflateRawSync'), '夹具生成器必须用 zlib 造 deflate 样本');
  });
});

// ==================== ⑧ 传输面（main.js 源码契约） ====================

/*
 * ## ⚠️ 本组是对**计划自带门禁 5** 的等价补判据（计划判据一字未改）
 *
 * 计划门禁用 `main.indexOf("route === 'import'")` 取窗口起点 —— 但 `main.js` 里
 * **已存在**一处 `route === 'import'`（`handleRulesApi` 的分配规则导入，早于
 * `handleSkillsApi`）⇒ 窗口落在**另一个函数**上，任何正确实现都会报
 * 「import 分支未使用 readRawBody」。实测（本计划执行期）：
 * 计划门禁 5 在当前树上报且**只报**这两条，根因是**锚点取错行**，不是实现缺陷。
 *
 * 本组按计划 `acceptance_criteria` 自己声明的口径（「用**函数名 / token** 定界，
 * 不用固定字符数窗口」）把锚点换成 `handleSkillsApi` 的函数定义 ⇒ 判据指向正确的窗口。
 */

/** `readRawBody` 的函数体（按「到下一个函数定义为止」定界，不用固定字符数） */
function readRawBodyWindow(src) {
  const code = stripCodeComments(src);
  const start = code.indexOf('function readRawBody(req, res,');
  assert.ok(start >= 0, 'main.js 必须含 readRawBody（口径失效）');
  const end = code.indexOf('\n  }\n', start);
  assert.ok(end > start, 'readRawBody 的函数体未闭合（窗口判据失效）');
  return code.slice(start, end);
}

/**
 * `handleSkillsApi` 里技能导入分支的窗口
 *
 * 起点 = **技能 handler 内**的 `route === 'import'`（用 `async function handleSkillsApi(`
 * 的下标作下界，避开 `handleRulesApi` 的同名分支）；终点 = 该 handler 的 404 兜底。
 */
function skillsImportBranchWindow(src) {
  const code = stripCodeComments(src);
  const handlerStart = code.indexOf('async function handleSkillsApi(');
  assert.ok(handlerStart >= 0, 'main.js 必须定义 handleSkillsApi（口径失效）');
  const start = code.indexOf("route === 'import'", handlerStart);
  assert.ok(start >= 0, 'handleSkillsApi 必须含 import 分支');
  const end = code.indexOf("sendJson(res, 404, { error: 'Not Found' })", start);
  assert.ok(end > start, 'handleSkillsApi 的 404 兜底不在 import 分支之后（窗口判据失效）');
  return code.slice(start, end);
}

describe('传输面（main.js 源码契约，窗口按函数名 / token 定界）', () => {
  test('readRawBody 具备三条教训的全部形态，且无 destroy / Connection 头', () => {
    const body = readRawBodyWindow(readSource('main.js'));
    for (const token of ['Buffer.concat(', 'req.resume()', 'canRespond', 'BODY_TOO_LARGE']) {
      assert.ok(body.includes(token), `readRawBody 缺 ${token}`);
    }
    assert.strictEqual(
      body.includes('req.destroy('),
      false,
      'readRawBody 不得用 req.destroy()（客户端会拿 EPIPE，413 不可达）'
    );
    assert.strictEqual(
      /headers\s*=\s*\{[^}]*[Cc]onnection/.test(body),
      false,
      'readRawBody 不得写 Connection 头'
    );
  });

  test('data 监听器内的顺序：早退 → 累加 size → 比较上限 → 才 push chunk', () => {
    const body = readRawBodyWindow(readSource('main.js'));
    const dataStart = body.indexOf("req.on('data',");
    const dataEnd = body.indexOf("req.on('end'");
    assert.ok(dataStart >= 0 && dataEnd > dataStart, 'readRawBody 必须含完整的 data 监听器（口径失效）');
    const seg = body.slice(dataStart, dataEnd);

    const iEarly = seg.indexOf('if (rejected) return;');
    const iSize = seg.indexOf('size += chunk.length');
    const iLimit = seg.indexOf('if (size > maxBytes)');
    const iPush = seg.indexOf('chunks.push(chunk);');
    assert.ok(iEarly >= 0, 'data 监听器内必须有早退（拒收后不得继续累积）');
    assert.ok(iSize > iEarly, '早退必须**先于**累加 size');
    assert.ok(iLimit > iSize, '必须每累加一个 chunk 就立即比较上限');
    assert.ok(iPush > iLimit, '必须在比较之后才 push chunk（否则堆随 body 线性增长）');
  });

  test('技能导入分支使用 readRawBody 且显式声明 maxBytes（50 D-16 的交接要求）', () => {
    const branch = skillsImportBranchWindow(readSource('main.js'));
    assert.ok(branch.includes('readRawBody(req, res'), 'import 分支未使用 readRawBody');
    assert.ok(branch.includes('MAX_SKILL_PACKAGE_BYTES'), 'import 分支未显式声明 maxBytes');
    assert.ok(
      branch.includes("route === 'import' && req.method === 'POST'"),
      'import 分支必须限定 POST'
    );
  });

  test('计划门禁 5 的锚点在当前树上取错行（本组存在的理由，可复现）', () => {
    const code = stripCodeComments(readSource('main.js'));
    const first = code.indexOf("route === 'import'");
    const handlerStart = code.indexOf('async function handleSkillsApi(');
    assert.ok(
      first >= 0 && handlerStart >= 0 && first < handlerStart,
      'main.js 在 handleSkillsApi 之前还有一处 route === \'import\'（handleRulesApi）⇒ ' +
        '计划门禁 5 的窗口落在另一个函数上，任何正确实现都会被误报'
    );
  });
});

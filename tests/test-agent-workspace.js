/**
 * agent-workspace 模块单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：resolveInside 路径校验（越界/撞名前缀/symlink 逃逸/根目录放行）、
 * createSandboxEnv 沙箱包装（writeFile 越界、renameFile 双路径、createTempDir
 * 重定向 .tmp/、exec cwd）、migrateAiMemory 一次性迁移三态。
 * 全部用例经 setWorkspaceDir/setLegacyAiMemoryDir 注入临时目录，不触碰真实 userData。
 *
 * 用法: node tests/test-agent-workspace.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');

/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ws-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    workspace.setLegacyAiMemoryDir(null);
    aiMemoryManager.setBaseDir(null);
  });
  workspace.setWorkspaceDir(dir);
  return dir;
}

describe('resolveInside 路径校验', () => {
  test('相对路径越界（../../etc/passwd）拒绝', () => {
    const root = '/tmp/fake-root';
    assert.strictEqual(workspace.resolveInside(root, '../../etc/passwd'), null);
  });

  test('绝对路径越界（/etc/passwd）拒绝', () => {
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', '/etc/passwd'), null);
  });

  test('撞名前缀兄弟目录（/fake-root-evil/x）拒绝', () => {
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', '/tmp/fake-root-evil/x'), null);
  });

  test('根目录本身放行（listDir 根目录场景）', () => {
    const abs = workspace.resolveInside('/tmp/fake-root', '/tmp/fake-root');
    assert.strictEqual(abs, '/tmp/fake-root');
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', '.'), '/tmp/fake-root');
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', ''), null);
  });

  test('词法消化 .. 后仍在根内放行（sub/../sub2）', () => {
    const abs = workspace.resolveInside('/tmp/fake-root', 'sub/../sub2');
    assert.strictEqual(abs, path.resolve('/tmp/fake-root', 'sub2'));
  });

  test('空/非字符串路径拒绝', () => {
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', ''), null);
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', '   '), null);
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', null), null);
    assert.strictEqual(workspace.resolveInside('/tmp/fake-root', 42), null);
  });

  test('symlink 逃逸拒绝：根内链接指向根外目录', (t) => {
    const root = withTempRoot(t);
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ws-external-'));
    t.after(() => fs.rmSync(external, { recursive: true, force: true }));
    fs.writeFileSync(path.join(external, 'secret.txt'), 'top secret');
    fs.symlinkSync(external, path.join(root, 'leak'));
    assert.strictEqual(workspace.resolveInside(root, 'leak/secret.txt'), null);
  });

  test('根内普通路径（存在与不存在）放行', (t) => {
    const root = withTempRoot(t);
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'a.txt'), 'hi');
    assert.strictEqual(workspace.resolveInside(root, 'docs/a.txt'), path.join(root, 'docs/a.txt'));
    assert.strictEqual(workspace.resolveInside(root, 'not-yet-created.txt'), path.join(root, 'not-yet-created.txt'));
  });
});

describe('createSandboxEnv 沙箱包装', () => {
  test('writeFile 根外路径返回 permission_denied 不 throw', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const result = await env.writeFile('/etc/realm-escape-test.txt', 'nope');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'permission_denied');
    assert.strictEqual(fs.existsSync('/etc/realm-escape-test.txt'), false);
  });

  test('writeFile 根内路径成功且父目录自动创建', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const result = await env.writeFile('out/sub/report.md', '# hi');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(fs.readFileSync(path.join(root, 'out/sub/report.md'), 'utf8'), '# hi');
  });

  test('readTextFile 根外路径拒绝', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const result = await env.readTextFile('/etc/hosts');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'permission_denied');
  });

  test('renameFile destination 越界拒绝（写逃逸）', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    await env.writeFile('a.txt', 'x');
    const result = await env.renameFile('a.txt', '/tmp/realm-escape-rename.txt');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'permission_denied');
    assert.strictEqual(fs.existsSync(path.join(root, 'a.txt')), true, '源文件未被移动');
  });

  test('createTempDir/createTempFile 落在根目录 .tmp/ 内', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const dirResult = await env.createTempDir('bash-out');
    assert.strictEqual(dirResult.ok, true);
    assert.ok(dirResult.value.startsWith(path.join(root, '.tmp/')), `临时目录应落在 .tmp/ 下: ${dirResult.value}`);

    const fileResult = await env.createTempFile({ prefix: 'full-', suffix: '.log' });
    assert.strictEqual(fileResult.ok, true);
    assert.ok(fileResult.value.startsWith(path.join(root, '.tmp/')));
    assert.strictEqual(fs.existsSync(fileResult.value), true);
  });

  test('exec 默认 cwd 为沙箱根；显式 cwd 越界拒绝', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const pwdResult = await env.exec('pwd');
    assert.strictEqual(pwdResult.ok, true);
    // macOS /var → /private/var：shell getcwd 返回 realpath，按 realpath 比较
    assert.strictEqual(pwdResult.value.stdout.trim(), fs.realpathSync(root));

    const escapeResult = await env.exec('pwd', { cwd: '/etc' });
    assert.strictEqual(escapeResult.ok, false);
  });

  test('absolutePath 根外路径拒绝；根内返回规范化绝对路径', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const okResult = await env.absolutePath('sub/../a.txt');
    assert.strictEqual(okResult.ok, true);
    assert.strictEqual(okResult.value, path.join(root, 'a.txt'));
    const badResult = await env.absolutePath('/etc/passwd');
    assert.strictEqual(badResult.ok, false);
    assert.strictEqual(badResult.error.code, 'permission_denied');
  });

  test('symlink 二段式逃逸：bash 建 link 后 read 工具读 link 被拒', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    await env.exec('ln -s /etc link-to-etc');
    const result = await env.readTextFile('link-to-etc/hosts');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'permission_denied');
  });

  test('canonicalPath 返回 realpath（/private/var 形态）被双基准放行', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    await env.writeFile('a.txt', 'x');
    const result = await env.canonicalPath('a.txt');
    assert.strictEqual(result.ok, true, `canonicalPath 不应被误拒: ${result.ok ? '' : result.error.message}`);
    assert.ok(
      result.value.startsWith(root) || result.value.startsWith(fs.realpathSync(root)),
      `canonical 结果应落在 root/realRoot 内: ${result.value}`
    );
  });
});

describe('写面加固（SEC-10）—— 最小集', () => {
  test('env.writeFile 经逃逸链接写入被拒，且 root 外真的没有产生文件', async (t) => {
    const root = withTempRoot(t);
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ws-external-'));
    t.after(() => fs.rmSync(external, { recursive: true, force: true }));
    fs.symlinkSync(external, path.join(root, 'link'));
    const env = await workspace.createSandboxEnv({ cwd: root });
    const result = await env.writeFile('link/x.txt', '1');
    assert.strictEqual(result.ok, false, '写逃逸必须被拒');
    assert.strictEqual(result.error.code, 'permission_denied');
    // 真副作用判据：断言盘上没这个文件（不是断言「没调用过 fs」）
    assert.strictEqual(fs.existsSync(path.join(external, 'x.txt')), false, 'root 外不得产生文件');
  });

  test('env.writeFile 经沙箱内自指链接写入成功（加固未收紧过头）', async (t) => {
    const root = withTempRoot(t);
    fs.mkdirSync(path.join(root, 'references'));
    // 等价于 `cd <root> && ln -s . references/self`：realpath 归一化后仍在 root 内
    fs.symlinkSync('.', path.join(root, 'references', 'self'));
    const env = await workspace.createSandboxEnv({ cwd: root });
    const result = await env.writeFile('references/self/y.txt', '1');
    assert.strictEqual(result.ok, true, result.ok ? '' : `自指链接应放行: ${result.error.message}`);
    assert.strictEqual(fs.readFileSync(path.join(root, 'references', 'y.txt'), 'utf8'), '1');
  });

  test('resolveInsideForWrite 非字符串/空串/纯空白返回 null（不抛、不 fallback 到 root）', (t) => {
    const root = withTempRoot(t);
    assert.strictEqual(workspace.resolveInsideForWrite(root, ''), null);
    assert.strictEqual(workspace.resolveInsideForWrite(root, '   '), null);
    assert.strictEqual(workspace.resolveInsideForWrite(root, null), null);
    assert.strictEqual(workspace.resolveInsideForWrite(root, 42), null);
    assert.strictEqual(workspace.resolveInsideForWrite(root, {}), null);
  });

  test('resolveInsideForWrite 的 .. 逃逸 / 绝对路径越界 / 兄弟前缀目录拒绝', (t) => {
    const root = withTempRoot(t);
    assert.strictEqual(workspace.resolveInsideForWrite(root, '../evil.txt'), null, '.. 逃逸');
    assert.strictEqual(workspace.resolveInsideForWrite(root, '/etc/passwd'), null, '绝对路径越界');
    const sibling = path.join(path.dirname(root), 'root-evil', 'x.txt');
    assert.strictEqual(workspace.resolveInsideForWrite(root, sibling), null, '撞名前缀兄弟目录');
  });
});

describe('写面加固（SEC-10）—— 十例判定与源码契约', () => {
  /** 仓库根目录（源码契约扫描用） */
  const REPO_ROOT = path.join(__dirname, '..');

  /**
   * 词法级剥除注释（与 `tests/test-skills-http-api.js:58-94` 的剥注释器**同款**）
   *
   * 逐字符五态扫描（代码 / 行注释 / 块注释 / 单引号串 / 双引号串 / 模板串），
   * 注释字符**等长空白化**（等长必须：否则索引与原始源码错位）。
   * 用途：凡「计数 / 令牌存在性」类判据一律**先剥注释再判** —— 源码里可以如实
   * 写明被禁的形态（例如解释「本方法已切到写面判据」的注释），那不构成违规。
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

  /** 读取仓库根源码（剥注释后返回） */
  function readStrippedSource(file) {
    return stripCodeComments(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'));
  }

  /** 取某方法体窗口（`async <name>(` 到下一个方法级缩进闭合 `    },`） */
  function methodWindow(src, name) {
    const i = src.indexOf('async ' + name + '(');
    if (i === -1) return '';
    const j = src.indexOf('\n    },', i);
    return src.slice(i, j === -1 ? i + 1600 : j);
  }

  const WRITE_METHODS = ['writeFile', 'appendFile', 'renameFile', 'createDir', 'remove'];
  const READ_METHODS = ['readTextFile', 'readTextLines', 'readBinaryFile', 'fileInfo', 'listDir', 'exists'];

  /**
   * 造「十例探针」布局：
   *
   * ```
   * <base>/root/            ← 沙箱根
   *   existing.txt          root 内已存在的文件
   *   references/self → .   自指链接（等价 `cd <root> && ln -s . references/self`）
   *   sub/in-link     → ../other   同根内的兄弟目录（other 与 sub 同在 root 内）
   *   loop            → .   自环链接（等价 `ln -s . loop`）
   *   link-out        → <base>/outside      逃逸链接（目录）
   *   link-file       → <base>/outside/file.txt   逃逸链接（文件）
   * <base>/outside/         ← root 之外
   * <base>/root-evil/       ← 撞名前缀兄弟目录（判据必须带 path.sep 的正命题）
   * ```
   */
  function withProbeTree(t) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ws-probe-'));
    t.after(() => {
      fs.rmSync(base, { recursive: true, force: true });
      workspace.setWorkspaceDir(null);
      workspace.setLegacyAiMemoryDir(null);
    });
    const root = path.join(base, 'root');
    const outside = path.join(base, 'outside');
    fs.mkdirSync(path.join(root, 'references'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
    fs.mkdirSync(path.join(root, 'other'), { recursive: true });
    fs.mkdirSync(path.join(base, 'root-evil'), { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(root, 'existing.txt'), 'old');
    fs.writeFileSync(path.join(outside, 'file.txt'), 'OUTSIDE');
    fs.writeFileSync(path.join(outside, 'victim.txt'), 'KEEP');
    fs.symlinkSync(outside, path.join(root, 'link-out'));
    fs.symlinkSync(path.join(outside, 'file.txt'), path.join(root, 'link-file'));
    fs.symlinkSync('.', path.join(root, 'references', 'self'));
    fs.symlinkSync('../other', path.join(root, 'sub', 'in-link'));
    fs.symlinkSync('.', path.join(root, 'loop'));
    workspace.setWorkspaceDir(root);
    return { base, root, outside };
  }

  /** 十例探针期望表（名目与 51-RESEARCH.md 实测 8（d）的十例逐条对齐） */
  function probeCases(root) {
    return [
      { name: 'plain new file inside', target: 'not-yet-created.txt', allow: true },
      { name: 'existing file inside', target: 'existing.txt', allow: true },
      { name: 'dotdot escape', target: '../evil.txt', allow: false },
      { name: 'absolute outside', target: '/etc/passwd', allow: false },
      { name: 'sibling-prefix dir', target: path.join(path.dirname(root), 'root-evil', 'x.txt'), allow: false },
      { name: 'link OUT then write', target: 'link-out/x.txt', allow: false },
      { name: 'link OUT to a FILE then write', target: 'link-file', allow: false },
      { name: 'link IN (self-referential) then write', target: 'references/self/y.txt', allow: true },
      { name: 'link IN to a sibling dir then write', target: 'sub/in-link/z.txt', allow: true },
      { name: 'link IN loop', target: 'loop/w.txt', allow: true },
    ];
  }

  test('十例期望表：逐条判定（有哪一例被判反了有可读失败信息）', (t) => {
    const { root } = withProbeTree(t);
    for (const c of probeCases(root)) {
      const got = workspace.resolveInsideForWrite(root, c.target);
      assert.strictEqual(
        got === null, !c.allow,
        `${c.name}: 期望 ${c.allow ? '放行' : '拒绝'}，实得 ${got === null ? '拒绝' : `放行 (${got})`}`
      );
      if (c.allow) {
        assert.strictEqual(got, path.resolve(root, c.target), `${c.name}: 放行必须返回**词法**绝对路径`);
      }
    }
  });

  test('新旧判据对照：仅「link OUT then write」一处由放行转拒绝（既有放行/拒绝集合零变化）', (t) => {
    const { root } = withProbeTree(t);
    const flipped = [];
    for (const c of probeCases(root)) {
      const oldAllow = workspace.resolveInside(root, c.target) !== null;
      const newAllow = workspace.resolveInsideForWrite(root, c.target) !== null;
      if (oldAllow !== newAllow) flipped.push(c.name);
    }
    assert.deepStrictEqual(
      flipped, ['link OUT then write'],
      `唯一允许的翻转就是 SEC-10 缺口本体；实得翻转集合: ${JSON.stringify(flipped)}`
    );
  });

  test('env.writeFile 经 bash 建的逃逸链接写入被拒，root 外真的没有产生文件', async (t) => {
    const { root, outside } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    // 建链形态照 tests/test-agent-workspace.js 既有读面用例（bash 建 link）
    const link = await env.exec(`ln -s ${JSON.stringify(outside)} bash-link`);
    assert.strictEqual(link.ok, true, '建链命令应成功');
    const result = await env.writeFile('bash-link/x.txt', '1');
    assert.strictEqual(result.ok, false, '写逃逸必须被拒（FileSystem 契约：不 throw，编码进 Result）');
    assert.strictEqual(result.error.code, 'permission_denied');
    // 真副作用判据：断言盘上没这个文件（不是断言「没调用过 fs」）
    assert.strictEqual(fs.existsSync(path.join(outside, 'x.txt')), false, 'root 外不得产生文件');
  });

  test('env.writeFile 指向 root 外文件的链接被拒，且外部文件未被改写', async (t) => {
    const { root, outside } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const result = await env.writeFile('link-file', 'HACKED');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'permission_denied');
    assert.strictEqual(fs.readFileSync(path.join(outside, 'file.txt'), 'utf8'), 'OUTSIDE');
  });

  test('env.appendFile 经逃逸链接被拒；经沙箱内自指链接成功', async (t) => {
    const { root, outside } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const denied = await env.appendFile('link-out/appended.txt', 'x');
    assert.strictEqual(denied.ok, false);
    assert.strictEqual(denied.error.code, 'permission_denied');
    assert.strictEqual(fs.existsSync(path.join(outside, 'appended.txt')), false);

    const allowed = await env.appendFile('references/self/appended.txt', 'x');
    assert.strictEqual(allowed.ok, true, allowed.ok ? '' : `自指链接应放行: ${allowed.error.message}`);
    assert.strictEqual(fs.readFileSync(path.join(root, 'references', 'appended.txt'), 'utf8'), 'x');
  });

  test('env.remove 经逃逸链接被拒（写面判据，非底层 ENOENT）；root 外的目标文件仍在', async (t) => {
    const { root, outside } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    // ① 目标「尚不存在」：这条是写面判据的可失败形态 —— 回退加固后 `resolveInside`
    //    只做词法校验即放行，结果会变成底层 fs 的 `not_found` 而不是 `permission_denied`
    const missing = await env.remove('link-out/x.txt');
    assert.strictEqual(missing.ok, false);
    assert.strictEqual(
      missing.error.code, 'permission_denied',
      `remove 是写面，不得被漏掉（回退加固后会退化成 not_found）: ${missing.error.code}`
    );
    // ② 目标已存在：走真实删除路径的负例（外部文件必须原封不动）
    const result = await env.remove('link-out/victim.txt');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'permission_denied');
    assert.strictEqual(fs.readFileSync(path.join(outside, 'victim.txt'), 'utf8'), 'KEEP');
  });

  test('env.createDir 经沙箱内链接成功 / 经逃逸链接拒绝', async (t) => {
    const { root, outside } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const allowed = await env.createDir('loop/newdir');
    assert.strictEqual(allowed.ok, true, allowed.ok ? '' : `自环链接应放行: ${allowed.error.message}`);
    assert.strictEqual(fs.existsSync(path.join(root, 'newdir')), true);

    const denied = await env.createDir('link-out/newdir');
    assert.strictEqual(denied.ok, false);
    assert.strictEqual(denied.error.code, 'permission_denied');
    assert.strictEqual(fs.existsSync(path.join(outside, 'newdir')), false);
  });

  test('env.renameFile 的 source 与 destination 都走写面判据（正反例各一）', async (t) => {
    const { root, outside } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    await env.writeFile('src.txt', 'x');

    const denied = await env.renameFile('src.txt', 'link-out/dst.txt');
    assert.strictEqual(denied.ok, false, 'destination 逃逸 = 写逃逸');
    assert.strictEqual(denied.error.code, 'permission_denied');
    assert.strictEqual(fs.existsSync(path.join(root, 'src.txt')), true, '源文件未被移动');
    assert.strictEqual(fs.existsSync(path.join(outside, 'dst.txt')), false);

    const deniedSrc = await env.renameFile('link-out/victim.txt', 'moved.txt');
    assert.strictEqual(deniedSrc.ok, false, 'source 越界同样拒绝');
    assert.strictEqual(deniedSrc.error.code, 'permission_denied');
    assert.strictEqual(fs.existsSync(path.join(outside, 'victim.txt')), true);

    const allowed = await env.renameFile('src.txt', 'sub/dst.txt');
    assert.strictEqual(allowed.ok, true, allowed.ok ? '' : `root 内改名应放行: ${allowed.error.message}`);
    assert.strictEqual(fs.readFileSync(path.join(root, 'sub', 'dst.txt'), 'utf8'), 'x');
  });

  test('createTempDir/createTempFile 在 .tmp/ 被替换为逃逸链接时拒绝（父目录写面复核）', async (t) => {
    const { root, outside } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    // ensureWorkspaceDir 已建 .tmp/；把它换成指向 root 外的 symlink（mkdtemp 本身不经 guard）
    const tmpDir = path.join(root, '.tmp');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.symlinkSync(outside, tmpDir);

    const dirResult = await env.createTempDir('bash-out');
    assert.strictEqual(dirResult.ok, false, '.tmp/ 被替换成 symlink 时必须拒绝');
    assert.strictEqual(dirResult.error.code, 'permission_denied');
    const fileResult = await env.createTempFile({ prefix: 'full-', suffix: '.log' });
    assert.strictEqual(fileResult.ok, false);
    assert.strictEqual(fileResult.error.code, 'permission_denied');
    assert.deepStrictEqual(
      fs.readdirSync(outside).filter((n) => n.startsWith('tmp-')), [],
      'root 外不得产生临时目录'
    );
  });

  test('createTempDir 产物前缀形状与 sweepSeedResidue 清扫正则成对（不得改名）', async (t) => {
    const root = withTempRoot(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const result = await env.createTempDir('skill-import');
    assert.strictEqual(result.ok, true);
    assert.match(
      path.basename(result.value), /^tmp-skill-import-[A-Za-z0-9]{6}$/,
      `产物名形状变了会与崩溃清扫正则失配: ${path.basename(result.value)}`
    );
  });

  test('源码契约：五个写面走 guardForWriteResult 且六个读面仍走 guardResult（剥注释后）', () => {
    const src = readStrippedSource('agent-workspace.js');
    assert.ok(src.includes('function resolveInsideForWrite('), '缺 resolveInsideForWrite 定义');
    // 两面并列：两个包装的定义同时存在（删任一个都会让另一面的既有用例转红）
    assert.match(src, /const guardResult\s*=/, '缺读面包装定义');
    assert.match(src, /const guardForWriteResult\s*=/, '缺写面包装定义');
    for (const m of WRITE_METHODS) {
      const w = methodWindow(src, m);
      assert.ok(w, `窗口取不到方法体: ${m}`);
      assert.ok(w.includes('guardForWriteResult('), `${m} 未切到写面判据`);
    }
    for (const m of READ_METHODS) {
      const w = methodWindow(src, m);
      assert.ok(w, `窗口取不到方法体: ${m}`);
      assert.ok(w.includes('guardResult('), `${m} 的读面判据被改动`);
    }
    const n = (methodWindow(src, 'renameFile').match(/guardForWriteResult\(/g) || []).length;
    assert.strictEqual(n, 2, `renameFile 的写面校验应恰 2 处（source 与 destination），实得 ${n}`);
  });

  test('源码契约：写面方法体内零 realpathSync（单一判据链，无第二份实现）', () => {
    const src = readStrippedSource('agent-workspace.js');
    for (const m of [...WRITE_METHODS, 'createTempDir', 'createTempFile']) {
      const w = methodWindow(src, m);
      assert.ok(w, `窗口取不到方法体: ${m}`);
      assert.ok(!w.includes('realpathSync('), `${m} 不得自带路径判据实现（判据链必须唯一）`);
      assert.ok(w.includes('guardForWriteResult('), `${m} 必须经唯一包装 guardForWriteResult`);
    }
  });

  test('未覆盖面登记：bash 命令内容不在沙箱这一层校验（诚实边界，不是缺陷）', async (t) => {
    const { base, root } = withProbeTree(t);
    const env = await workspace.createSandboxEnv({ cwd: root });
    const name = `bash-escape-${process.pid}.txt`;
    const result = await env.exec(`echo escaped > ../${name}`);
    assert.strictEqual(result.ok, true);
    // D-15 明文：命令内容交给三档权限与确认卡片。本加固**不**声称封闭 bash 写盘，
    // 这条用例就是「不得写成已封闭」的反证据（prohibitions 第 2 条的机械形态）。
    assert.strictEqual(
      fs.existsSync(path.join(base, name)), true,
      'bash 仍可写出 root —— 这正是「本加固不封闭 bash 写盘」的证据'
    );
  });
});

describe('migrateAiMemory 一次性迁移', () => {
  test('旧存在 && 新不存在 → 递归复制', (t) => {
    const root = withTempRoot(t);
    const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ws-legacy-'));
    t.after(() => fs.rmSync(legacy, { recursive: true, force: true }));
    workspace.setLegacyAiMemoryDir(legacy);
    fs.writeFileSync(path.join(legacy, 'MEMORY.md'), '[M1] 旧记忆条目');
    fs.mkdirSync(path.join(legacy, 'memories'));
    fs.writeFileSync(path.join(legacy, 'memories', 'work.md'), '[M1] 容器记忆');

    workspace.migrateAiMemory();

    const target = path.join(root, 'ai-memory');
    assert.strictEqual(fs.readFileSync(path.join(target, 'MEMORY.md'), 'utf8'), '[M1] 旧记忆条目');
    assert.strictEqual(fs.readFileSync(path.join(target, 'memories', 'work.md'), 'utf8'), '[M1] 容器记忆');
  });

  test('新已存在 → 跳过不覆盖', (t) => {
    const root = withTempRoot(t);
    const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ws-legacy-'));
    t.after(() => fs.rmSync(legacy, { recursive: true, force: true }));
    workspace.setLegacyAiMemoryDir(legacy);
    fs.writeFileSync(path.join(legacy, 'MEMORY.md'), '[M1] 旧记忆条目');
    const target = path.join(root, 'ai-memory');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'MEMORY.md'), '[M1] 新记忆条目');

    workspace.migrateAiMemory();

    assert.strictEqual(fs.readFileSync(path.join(target, 'MEMORY.md'), 'utf8'), '[M1] 新记忆条目');
  });

  test('旧不存在 → no-op 不报错', (t) => {
    const root = withTempRoot(t);
    workspace.setLegacyAiMemoryDir(path.join(root, 'never-existed'));
    assert.doesNotThrow(() => workspace.migrateAiMemory());
    assert.strictEqual(fs.existsSync(path.join(root, 'ai-memory')), false);
  });
});

describe('ai-memory-manager 新路径联动', () => {
  test('setBaseDir(getAiMemoryDir()) 后条目落到工作区内', (t) => {
    const root = withTempRoot(t);
    aiMemoryManager.setBaseDir(workspace.getAiMemoryDir());
    aiMemoryManager.write({ action: 'add', target: 'global', content: '迁移后的新条目' });
    const file = path.join(root, 'ai-memory', 'MEMORY.md');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '[M1] 迁移后的新条目\n');
  });
});

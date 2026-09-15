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

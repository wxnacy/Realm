/**
 * 用户技能导入管线的**网络地址一侧**测试套件（node:test，**纯 Node 环境**）
 *
 * 覆盖 Phase 51 的网络面：URL 分类器值域矩阵、逐跳校验（https / 白名单 / 私网）、
 * 跳数上限、流式字节上限、magic bytes、403/429/404 的真实原因映射、`fallbackRef`
 * 重试恰一次、`skills.sh` 的 308 真实形态，以及「两条来源共用同一段后段」的判据。
 *
 * ## 两条硬纪律
 *
 * ① **零实时外网**（CR-12）：所有网络路径要么被**注入的 stub** 顶替，要么指向
 *    `http://127.0.0.1:<port>` 的本地 `http.createServer`。本套件**不使用** `fetch()`，
 *    也不解析任何真实域名 —— 真实站点的形态另有一次人工证据（见 `51-05-SUMMARY.md`）。
 * ② **套件名与内容不含 `picker`**：counts-parity 脚本按文件名是否含该词决定是否插
 *    `--test`（`51-CONTEXT.md` CR-11）。
 *
 * 用法: node tests/test-skills-import-net.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { Readable } = require('stream');

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
 * 词法级剥除注释（与 `tests/test-skills-import.js` 的 `stripCodeComments` 逐字同款）
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
    if (c === '/' && d === '/') { o += '  '; i += 2; s = 1; continue; }
    if (c === '/' && d === '*') { o += '  '; i += 2; s = 2; continue; }
    if (c === "'") { o += c; s = 3; i++; p = c; continue; }
    if (c === '"') { o += c; s = 4; i++; p = c; continue; }
    if (c === '`') { o += c; s = 5; i++; p = c; continue; }
    if (c === '/' && (p === '' || "[=(,;:![{&|?+-*%~^".indexOf(p) !== -1)) { o += c; i++; p = c; continue; }
    o += c;
    if (c.trim()) p = c;
    i++;
  }
  return o;
}

/** 一次性临时工作区根（`setWorkspaceDir` 注入 ⇒ 不触碰真实 userData） */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skill-net-'));
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

/** 造一个 `importDir`（不写包 —— 供直链分支使用） */
function makeImportDir() {
  return fs.mkdtempSync(path.join(workspace.getTmpDir(), 'skill-import-'));
}

// ==================== ① URL 分类器值域矩阵（纯函数，零网络） ====================

describe('classifyImportUrl：三形态映射 + 六个拒绝面（离线值域矩阵）', () => {
  test('白名单恰六条，且是 `Object.freeze` 的只读表', () => {
    assert.deepStrictEqual(aiSkills.HOST_WHITELIST, [
      'github.com',
      'api.github.com',
      'codeload.github.com',
      'raw.githubusercontent.com',
      'objects.githubusercontent.com',
      'skills.sh',
    ]);
    assert.ok(Object.isFrozen(aiSkills.HOST_WHITELIST), '白名单必须冻结（防止运行时被塞新主机）');
  });

  test('isWhitelistedHost：精确成员判定 + 只剥前导 www.', () => {
    assert.strictEqual(aiSkills.isWhitelistedHost('github.com'), true);
    assert.strictEqual(aiSkills.isWhitelistedHost('GitHub.com'), true, '大小写不敏感（归一化到小写）');
    assert.strictEqual(aiSkills.isWhitelistedHost('www.skills.sh'), true, '前导 www. 归一化后命中（CR-1）');
    assert.strictEqual(aiSkills.isWhitelistedHost('skills.sh'), true);
    // 精确成员判定的三个反例：endsWith / 后缀正则都会放行前两个
    assert.strictEqual(aiSkills.isWhitelistedHost('evilgithub.com'), false);
    assert.strictEqual(aiSkills.isWhitelistedHost('github.com.evil.com'), false);
    assert.strictEqual(aiSkills.isWhitelistedHost('notgithub.com'), false);
    // 归一化**只剥一个前缀**，不剥后缀
    assert.strictEqual(aiSkills.isWhitelistedHost('github.com.evil.com'), false);
    assert.strictEqual(aiSkills.isWhitelistedHost(''), false);
    assert.strictEqual(aiSkills.isWhitelistedHost(undefined), false);
  });

  test('仓库地址形态 ⇒ codeload zipball + ref 缺省 main + fallbackRef master', () => {
    const cls = aiSkills.classifyImportUrl('https://github.com/anthropics/skills');
    assert.strictEqual(cls.kind, 'zipball');
    assert.strictEqual(cls.target, 'https://codeload.github.com/anthropics/skills/zip/refs/heads/main');
    assert.strictEqual(cls.scopeRel, null);
    assert.strictEqual(cls.ref, 'main');
    assert.strictEqual(cls.fallbackRef, 'master', '缺省分支策略必须是「先 main，404 再 master」');
    assert.strictEqual(cls.refBase, 'https://codeload.github.com/anthropics/skills/zip/refs/heads/');
  });

  test('仓库地址带尾斜杠 ⇒ 与不带尾斜杠等价', () => {
    const a = aiSkills.classifyImportUrl('https://github.com/anthropics/skills');
    const b = aiSkills.classifyImportUrl('https://github.com/anthropics/skills/');
    assert.deepStrictEqual(b, a);
  });

  test('tree/<ref>/<path> 形态 ⇒ zipball + scopeRel + ref', () => {
    const cls = aiSkills.classifyImportUrl('https://github.com/anthropics/skills/tree/main/skills/pdf');
    assert.strictEqual(cls.kind, 'zipball');
    assert.strictEqual(cls.target, 'https://codeload.github.com/anthropics/skills/zip/refs/heads/main');
    assert.strictEqual(cls.scopeRel, 'skills/pdf', '地址里的子路径必须原样成为 scopeRel');
    assert.strictEqual(cls.ref, 'main');
  });

  test('tree/<ref> 无子路径 ⇒ scopeRel 为空（交给 locateSkillRoot 判定多技能）', () => {
    const cls = aiSkills.classifyImportUrl('https://github.com/o/r/tree/main');
    assert.strictEqual(cls.kind, 'zipball');
    assert.strictEqual(cls.scopeRel, null);
    assert.strictEqual(cls.ref, 'main');
  });

  test('tree/<ref>/<path> 的自定义 ref（tag / 分支名）原样进 target', () => {
    const cls = aiSkills.classifyImportUrl('https://github.com/o/r/tree/v1.2.3/skills/x');
    assert.strictEqual(cls.target, 'https://codeload.github.com/o/r/zip/refs/heads/v1.2.3');
    assert.strictEqual(cls.ref, 'v1.2.3');
    assert.strictEqual(cls.scopeRel, 'skills/x');
  });

  test('blob/<ref>/…/SKILL.md ⇒ raw-skill（转到 raw.githubusercontent.com）', () => {
    const cls = aiSkills.classifyImportUrl(
      'https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md'
    );
    assert.strictEqual(cls.kind, 'raw-skill');
    assert.strictEqual(
      cls.target,
      'https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md'
    );
    assert.strictEqual(cls.ref, 'main');
  });

  test('blob/<ref>/*.zip ⇒ zipball（从 raw 取 zip）', () => {
    const cls = aiSkills.classifyImportUrl('https://github.com/o/r/blob/main/pack.zip');
    assert.strictEqual(cls.kind, 'zipball');
    assert.strictEqual(cls.target, 'https://raw.githubusercontent.com/o/r/main/pack.zip');
  });

  test('blob/<ref>/README.md ⇒ unsupported（只支持 SKILL.md 或 .zip）', () => {
    const cls = aiSkills.classifyImportUrl('https://github.com/o/r/blob/main/README.md');
    assert.strictEqual(cls.kind, 'unsupported');
    assert.strictEqual(cls.code, 'unsupported_url');
    assert.match(cls.message, /blob 地址只支持 SKILL\.md 或 \.zip/);
  });

  test('archive/** 形态 ⇒ zipball（原 URL，302 由逐跳校验跟随）', () => {
    const url = 'https://github.com/anthropics/skills/archive/refs/heads/main.zip';
    const cls = aiSkills.classifyImportUrl(url);
    assert.strictEqual(cls.kind, 'zipball');
    assert.strictEqual(cls.target, url);
  });

  test('raw.githubusercontent.com 直链 SKILL.md ⇒ raw-skill', () => {
    const cls = aiSkills.classifyImportUrl(
      'https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md'
    );
    assert.strictEqual(cls.kind, 'raw-skill');
    assert.strictEqual(
      cls.target,
      'https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md'
    );
  });

  test('raw 直链 *.zip ⇒ zipball', () => {
    const cls = aiSkills.classifyImportUrl('https://raw.githubusercontent.com/o/r/main/pack.zip');
    assert.strictEqual(cls.kind, 'zipball');
  });

  test('raw 直链其它文件 ⇒ unsupported（raw 只支持 SKILL.md / .zip）', () => {
    const cls = aiSkills.classifyImportUrl('https://raw.githubusercontent.com/o/r/main/README.md');
    assert.strictEqual(cls.kind, 'unsupported');
    assert.match(cls.message, /raw 直链只支持 SKILL\.md 或 \.zip/);
  });

  test('raw 直链路径段不足 ⇒ unsupported（缺分支或文件路径）', () => {
    const cls = aiSkills.classifyImportUrl('https://raw.githubusercontent.com/o/r/main');
    assert.strictEqual(cls.kind, 'unsupported');
    assert.match(cls.message, /缺少分支或文件路径/);
  });

  test('codeload 直连 zip 形态 ⇒ zipball（原 URL 直取，不吃 API 限流）', () => {
    const url = 'https://codeload.github.com/anthropics/skills/zip/refs/heads/main';
    const cls = aiSkills.classifyImportUrl(url);
    assert.strictEqual(cls.kind, 'zipball');
    assert.strictEqual(cls.target, url);
    assert.strictEqual(cls.scopeRel, null);
  });

  test('codeload 非 zip 路径 ⇒ unsupported', () => {
    const cls = aiSkills.classifyImportUrl('https://codeload.github.com/o/r/tar/refs/heads/main');
    assert.strictEqual(cls.kind, 'unsupported');
    assert.match(cls.message, /codeload 地址形态不受支持/);
  });

  test('非 https 协议（http / ftp / file / data）一律 unsupported', () => {
    for (const bad of [
      'http://github.com/anthropics/skills',
      'ftp://github.com/anthropics/skills',
      'file:///etc/passwd',
      'data:text/plain,hello',
    ]) {
      const cls = aiSkills.classifyImportUrl(bad);
      assert.strictEqual(cls.kind, 'unsupported', `${bad} 必须被拒`);
      assert.strictEqual(cls.code, 'unsupported_url');
      assert.match(cls.message, /只支持 https 地址/, `${bad} 的失败原因必须点明协议口径`);
    }
  });

  test('白名单外主机 ⇒ unsupported，message 含**归一化后**的主机名（不回显整条 URL）', () => {
    const evil = aiSkills.classifyImportUrl('https://evilgithub.com/x/y?token=secret#frag');
    assert.strictEqual(evil.kind, 'unsupported');
    assert.match(evil.message, /主机不在下载白名单：evilgithub\.com/);
    assert.ok(!evil.message.includes('token=secret'), '失败文案不得回显整条 URL（可能含凭据）');

    const suffix = aiSkills.classifyImportUrl('https://github.com.evil.com/x/y');
    assert.strictEqual(suffix.kind, 'unsupported');
    assert.match(suffix.message, /主机不在下载白名单：github\.com\.evil\.com/);
  });

  test('www. 归一化的正例：(www.)skills.sh 回「无载荷语义」而**不是**「主机不在白名单」', () => {
    for (const u of ['https://skills.sh/anthropics/pdf', 'https://www.skills.sh/anthropics/pdf']) {
      const cls = aiSkills.classifyImportUrl(u);
      assert.strictEqual(cls.kind, 'unsupported', `${u} 本阶段无载荷语义`);
      assert.strictEqual(cls.code, 'unsupported_url');
      // 两条 message 不同才是归一化生效的可观测之处
      assert.match(cls.message, /保留为未来兼容/, `${u} 应命中「白名单内但无载荷语义」`);
      assert.ok(
        !cls.message.includes('主机不在下载白名单'),
        `${u} 归一化后**必须在白名单内**（否则 skills.sh 的 308 会在第一跳被自己的逐跳校验拒）`
      );
    }
  });

  test('白名单外主机与白名单内无载荷来源**码相同、message 不同**（归一化判据的可观测面）', () => {
    const outside = aiSkills.classifyImportUrl('https://evil.example.com/x');
    const inside = aiSkills.classifyImportUrl('https://www.skills.sh/x');
    assert.strictEqual(outside.code, inside.code, '两者都是 unsupported_url');
    assert.notStrictEqual(outside.message, inside.message, '只断言 code 无法证明归一化生效');
  });

  test('api.github.com 显式拒绝（CR-1b：白名单内但导入管线无载荷语义）', () => {
    const cls = aiSkills.classifyImportUrl('https://api.github.com/repos/anthropics/skills/contents');
    assert.strictEqual(cls.kind, 'unsupported');
    assert.strictEqual(cls.code, 'unsupported_url');
    assert.match(cls.message, /GitHub API 地址不受支持/);
    assert.match(cls.message, /tree\/<分支>/, '拒绝文案必须指向可用的替代形态');
  });

  test('objects.githubusercontent.com 保留但无载荷语义（不得写成「承载产品闭环」）', () => {
    const cls = aiSkills.classifyImportUrl('https://objects.githubusercontent.com/x/y');
    assert.strictEqual(cls.kind, 'unsupported');
    assert.match(cls.message, /保留为未来兼容/);
  });

  test('GitHub 其它页面形态（issues / pull / releases / settings）⇒ unsupported + 三形态提示', () => {
    for (const u of [
      'https://github.com/o/r/issues',
      'https://github.com/o/r/pull/1',
      'https://github.com/o/r/releases',
      'https://github.com/o/r/settings',
      'https://github.com/o',
    ]) {
      const cls = aiSkills.classifyImportUrl(u);
      assert.strictEqual(cls.kind, 'unsupported', `${u} 不受支持`);
      assert.match(cls.message, /本阶段支持的地址形态有三种/, `${u} 的文案必须列出受支持形态`);
    }
  });

  test('地址无法解析 ⇒ unsupported（不抛异常）', () => {
    const cls = aiSkills.classifyImportUrl('not a url');
    assert.strictEqual(cls.kind, 'unsupported');
    assert.match(cls.message, /地址格式不正确/);
  });

  test('SKILL.md 判定大小写敏感（`skill.md` 是无载荷语义的 HTML 页）', () => {
    const lower = aiSkills.classifyImportUrl('https://github.com/o/r/blob/main/x/skill.md');
    assert.strictEqual(lower.kind, 'unsupported', '小写 skill.md 不得被当成直链');

    const rawLower = aiSkills.classifyImportUrl('https://raw.githubusercontent.com/o/r/main/x/skill.md');
    assert.strictEqual(rawLower.kind, 'unsupported');

    const exact = aiSkills.classifyImportUrl('https://raw.githubusercontent.com/o/r/main/x/SKILL.md');
    assert.strictEqual(exact.kind, 'raw-skill', '精确大小写仍须识别');
  });

  test('分类器是纯函数：同一输入两次调用结果逐字相同，且不改动入参', () => {
    const url = 'https://github.com/anthropics/skills/tree/main/skills/pdf';
    const a = aiSkills.classifyImportUrl(url);
    const b = aiSkills.classifyImportUrl(url);
    assert.deepStrictEqual(a, b);
    assert.strictEqual(url, 'https://github.com/anthropics/skills/tree/main/skills/pdf');
  });

  test('分类器零网络：函数体里没有任何请求 API（纯同步函数）', () => {
    const code = stripCodeComments(readSource('ai-skills-manager.js'));
    const start = code.indexOf('function classifyImportUrl(');
    assert.ok(start !== -1, 'classifyImportUrl 必须存在');
    const end = code.indexOf('\n}\n', start);
    const body = code.slice(start, end);
    assert.ok(body.length > 0);
    // token 拼装而不是字面量：本套件源码里不得出现请求 API 字面量（门禁按剥注释后的
    // 源码扫描 `fetch(`；字符串内容不在剥离范围内）
    const forbidden = ['fet' + 'ch(', 'await ', '.then(', 're' + 'quest('];
    for (const token of forbidden) {
      assert.strictEqual(
        body.includes(token),
        false,
        `分类器体内不得出现 ${token}（它必须是纯同步函数）`
      );
    }
  });
});

// ==================== ② 下载器：逐跳 / 上限 / magic bytes（本地 stub server） ====================
//
// 全部离线：请求打到 `127.0.0.1:<port>` 的本地 `http.createServer`，经**注入的**
// `fetchImpl` 桥接（逐跳校验看到的仍是 `https:` + 白名单内主机，字节来自本地服务器）。
// `isPrivateHost` 的注入只在回环地址上放行，**其余走 `search-manager` 的真实判据**
// （`10.0.0.1` 是 IP 字面量 ⇒ 无 DNS ⇒ 仍离线）。

/** 起一个本地 stub server；`hits` 记录请求路径（可断言请求序列） */
async function startStub(handler) {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    res.on('error', () => {});
    try {
      handler(req, res);
    } catch {
      try {
        res.destroy();
      } catch {
        /* 已销毁 */
      }
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    hits,
    port,
    close: () =>
      new Promise((resolve) => {
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/**
 * 把 `https://127.0.0.1:<port>/…` 的请求桥到本地 stub server
 *
 * 逐跳三校验看到的仍是 `https:` + `127.0.0.1`（在注入的 `hostWhitelist` 内），
 * 字节则来自本地服务器 —— 既不依赖外网，也不放松任何一条校验。
 */
function makeStubFetch(stub) {
  return async function bridgedGet(target, options) {
    const u = new URL(target);
    return await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: stub.port,
          path: `${u.pathname}${u.search}`,
          method: 'GET',
        },
        (res) => {
          const headers = {
            get: (name) => {
              const v = res.headers[String(name).toLowerCase()];
              return v === undefined ? null : Array.isArray(v) ? v.join(', ') : String(v);
            },
          };
          resolve({ status: res.statusCode, headers, body: Readable.toWeb(res) });
          if (res.statusCode < 200 || res.statusCode >= 300) res.resume();
        }
      );
      req.on('error', reject);
      if (options && options.signal) {
        options.signal.addEventListener('abort', () => {
          try {
            req.destroy(new Error('aborted'));
          } catch {
            /* 已销毁 */
          }
        });
      }
      req.end();
    });
  };
}

/**
 * 依赖注入器：白名单只放行回环 stub，私网判据对回环放行、其余走**真实** `isPrivateHost`
 *
 * `hostCalls` 记录每一次逐跳校验的主机名 —— 「每跳都跑」由它断言（只校验首跳的实现
 * 只会记录一个主机名）。
 */
function makeStubDeps(stub, { allowedHosts = ['127.0.0.1'] } = {}) {
  const realIsPrivateHost = require('../search-manager').isPrivateHost;
  const hostCalls = [];
  return {
    hostCalls,
    deps: {
      fetchImpl: makeStubFetch(stub),
      isPrivateHost: async (hostname) => {
        hostCalls.push(hostname);
        if (hostname === '127.0.0.1') return false; // 本地 stub server 自身在回环
        return await realIsPrivateHost(hostname); // 其余走真实判据（IP 字面量 ⇒ 无 DNS）
      },
      hostWhitelist: allowedHosts,
    },
  };
}

/** 一次下载调用的封装（生产形态的首参是 `undefined`；测试在这里注入 deps） */
async function downloadWith(deps, url, dest, extra = {}) {
  return await aiSkills.downloadPackage(deps, {
    url,
    destPath: dest,
    maxBytes: aiSkills.IMPORT_LIMITS.MAX_TOTAL_BYTES,
    kind: 'zipball',
    ...extra,
  });
}

describe('downloadPackage：逐跳三校验 / 跳数上限 / 流式上限 / 失败清理（本地 stub server）', () => {
  test('首跳白名单外主机 ⇒ unsupported_url（**不发请求**）', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'never.bin');
    let called = 0;
    const err = await (async () => {
      try {
        await downloadWith(
          { fetchImpl: async () => { called += 1; throw new Error('不该被调用'); } },
          'https://evil.example.com/x.zip',
          dest
        );
      } catch (e) {
        return e;
      }
      return null;
    })();
    assert.ok(err, '白名单外主机必须被拒');
    assert.strictEqual(err.code, 'unsupported_url');
    assert.match(err.message, /主机不在下载白名单/);
    assert.strictEqual(called, 0, '白名单校验必须先于任何网络请求');
  });

  test('非 https 协议 ⇒ unsupported_url（同样不发请求）', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'never2.bin');
    let called = 0;
    let err = null;
    try {
      await downloadWith(
        { fetchImpl: async () => { called += 1; throw new Error('不该被调用'); } },
        'http://127.0.0.1:1/x.zip',
        dest
      );
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.strictEqual(err.code, 'unsupported_url');
    assert.match(err.message, /只支持 https 地址/);
    assert.strictEqual(called, 0);
  });

  test('逐跳校验对**每一跳**生效：第二跳是私网地址 ⇒ download_failed（不是只校验首跳）', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'second-hop.bin');
    const stub = await startStub((req, res) => {
      res.writeHead(302, { location: 'https://10.0.0.1/codeload.zip' });
      res.end();
    });
    t.after(() => stub.close());
    // 白名单**放行** `10.0.0.1`，把承重面单独压到「逐跳私网校验」上 —— 否则白名单
    // 会先一步拒掉它（那是另一条判据，见上一个用例）
    const { deps, hostCalls } = makeStubDeps(stub, { allowedHosts: ['127.0.0.1', '10.0.0.1'] });

    let err = null;
    try {
      await downloadWith(deps, `https://127.0.0.1:${stub.port}/redirect`, dest);
    } catch (e) {
      err = e;
    }
    assert.ok(err, '第二跳指向内网必须被拒');
    assert.strictEqual(err.code, 'download_failed');
    assert.match(err.message, /拒绝访问内网地址/);
    assert.match(err.message, /10\.0\.0\.1/);
    assert.deepStrictEqual(
      hostCalls,
      ['127.0.0.1', '10.0.0.1'],
      '三校验必须在**每一跳**执行（只校验首跳的实现只会记录一个主机名）'
    );
    assert.strictEqual(fs.existsSync(dest), false, '被拒后不得留下半成品');
  });

  test('重定向**不能逃出白名单**：302 到白名单外主机 ⇒ 第二跳被判 unsupported_url', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'escape.bin');
    const stub = await startStub((req, res) => {
      res.writeHead(302, { location: 'https://evil.example.com/payload.zip' });
      res.end();
    });
    t.after(() => stub.close());
    const { deps } = makeStubDeps(stub);

    let err = null;
    try {
      await downloadWith(deps, `https://127.0.0.1:${stub.port}/redirect`, dest);
    } catch (e) {
      err = e;
    }
    assert.ok(err, '重定向到白名单外必须被拒（T-51-32）');
    assert.strictEqual(err.code, 'unsupported_url');
    assert.match(err.message, /主机不在下载白名单/);
  });

  test('重定向链超过 MAX_REDIRECTS ⇒ redirect_limit，且文案**不含** HTTP 3xx 形态', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'loop.bin');
    const stub = await startStub((req, res) => {
      res.writeHead(302, { location: '/loop' });
      res.end();
    });
    t.after(() => stub.close());
    const { deps } = makeStubDeps(stub);

    let err = null;
    try {
      await downloadWith(deps, `https://127.0.0.1:${stub.port}/loop`, dest);
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.strictEqual(err.code, 'redirect_limit', '超限必须抛 redirect_limit，而不是带着 3xx 掉出');
    assert.ok(
      !/HTTP\s*30/.test(err.message),
      `失败原因不得是误导性的 HTTP 3xx 文案（实测：${err.message}）`
    );
    assert.ok(
      stub.hits.length > 0 && stub.hits.length <= aiSkills.MAX_REDIRECTS + 1,
      `请求次数必须受 MAX_REDIRECTS=${aiSkills.MAX_REDIRECTS} 约束（实测 ${stub.hits.length} 次）`
    );
  });

  test('相对 Location 也能解析：302 → `/next` → 200 zip（逐跳跟随有效）', async (t) => {
    const root = withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'relative.bin');
    const zip = makeZip.skillPackage({ name: 'rel-skill', body: '# rel\n' });
    const stub = await startStub((req, res) => {
      if (req.url === '/next') {
        res.writeHead(200, { 'content-type': 'application/zip' });
        res.end(zip);
        return;
      }
      res.writeHead(302, { location: '/next' });
      res.end();
    });
    t.after(() => stub.close());
    const { deps } = makeStubDeps(stub);

    const meta = await downloadWith(deps, `https://127.0.0.1:${stub.port}/start`, dest);
    assert.strictEqual(meta.bytes, zip.length);
    assert.match(meta.contentType, /application\/zip/);
    assert.strictEqual(meta.finalUrl, `https://127.0.0.1:${stub.port}/next`);
    assert.ok(fs.existsSync(dest), '成功路径必须留下文件');

    // 白名单内的跳转不被误拒，且落盘内容与远端逐字节一致
    assert.deepStrictEqual(fs.readFileSync(dest), zip);
    assert.strictEqual(root && fs.existsSync(root), true);
  });

  test('magic bytes 是权威：14 字节 text/plain ⇒ not_a_zip，message 含 content-type', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'notzip.bin');
    const stub = await startStub((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404: Not Found'); // codeload 的 404 body 实测就是 14 字节 text/plain
    });
    t.after(() => stub.close());
    const { deps } = makeStubDeps(stub);

    const meta = await downloadWith(deps, `https://127.0.0.1:${stub.port}/x`, dest);
    assert.strictEqual(meta.bytes, 14, '载荷长度与实测的 404 body 一致');
    let err = null;
    try {
      aiSkills.verifyPackageBytes(dest, 'zipball', meta.contentType);
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'text/plain 载荷必须被 magic bytes 拦住');
    assert.strictEqual(err.code, 'not_a_zip');
    assert.match(err.message, /text\/plain/, 'content-type 只用于把错误说清楚');
    fs.rmSync(dest, { force: true });
  });

  test('流式字节上限：持续吐字节 ⇒ download_failed **且不留半成品**', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dest = path.join(workspace.getTmpDir(), 'overflow.bin');
    const chunk = Buffer.alloc(64 * 1024, 7);
    const stub = await startStub((req, res) => {
      res.writeHead(200, { 'content-type': 'application/zip' });
      const pump = () => {
        if (res.destroyed || res.writableEnded) return;
        if (res.write(chunk)) setImmediate(pump);
        else res.once('drain', pump);
      };
      pump();
    });
    t.after(() => stub.close());
    const { deps } = makeStubDeps(stub);

    const maxBytes = 256 * 1024;
    let err = null;
    try {
      await aiSkills.downloadPackage(deps, {
        url: `https://127.0.0.1:${stub.port}/huge`,
        destPath: dest,
        maxBytes,
        kind: 'zipball',
      });
    } catch (e) {
      err = e;
    }
    assert.ok(err, '超过字节上限必须中止下载');
    assert.strictEqual(err.code, 'download_failed');
    assert.ok(
      err.message.includes(String(maxBytes)),
      `失败原因必须含上限值：${err.message}`
    );
    assert.match(err.message, /已接收\s*\d+\s*字节/, '失败原因必须含当前值');
    assert.strictEqual(fs.existsSync(dest), false, '半成品必须被 unlinkSync 清掉');
  });
});

describe('verifyPackageBytes / prepareFromRawFile：形态判定与同一个 pkgRoot 形状', () => {
  test('raw 分支不做 magic 校验：「非空 + 前 512 字节无 NUL」', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const tmp = workspace.getTmpDir();

    const textFile = path.join(tmp, 'raw-ok.md');
    fs.writeFileSync(textFile, '---\nname: a\n---\n\n正文\n', 'utf8');
    assert.doesNotThrow(() => aiSkills.verifyPackageBytes(textFile, 'raw-skill', 'text/plain'));

    const emptyFile = path.join(tmp, 'raw-empty.md');
    fs.writeFileSync(emptyFile, '', 'utf8');
    let emptyErr = null;
    try {
      aiSkills.verifyPackageBytes(emptyFile, 'raw-skill', 'text/plain');
    } catch (e) {
      emptyErr = e;
    }
    assert.ok(emptyErr);
    assert.strictEqual(emptyErr.code, 'not_a_zip');

    const nulFile = path.join(tmp, 'raw-nul.md');
    fs.writeFileSync(nulFile, Buffer.concat([Buffer.from('# 头部\n'), Buffer.from([0, 1, 2])]));
    let nulErr = null;
    try {
      aiSkills.verifyPackageBytes(nulFile, 'raw-skill', 'text/plain');
    } catch (e) {
      nulErr = e;
    }
    assert.ok(nulErr, '含 NUL 的直链载荷必须被拒');
    assert.strictEqual(nulErr.code, 'not_a_zip');
    assert.match(nulErr.message, /NUL/);
  });

  test('prepareFromRawFile 产出与 zip 来源**同一个 pkgRoot 形状**（`<importDir>/pkg/<name>/SKILL.md`）', async (t) => {
    const root = withTempRoot(t);
    const env = await makeEnv(root);

    // 单文件直链路径
    const rawDir = makeImportDir();
    const rawText = '---\nname: raw-demo\ndescription: 直链技能\n---\n\n# raw-demo\n';
    const rawPrepared = await aiSkills.prepareFromRawFile({
      importDir: rawDir,
      name: 'raw-demo',
      text: rawText,
    });
    assert.strictEqual(rawPrepared.pkgRoot, path.join(rawDir, 'pkg'));
    assert.strictEqual(rawPrepared.importDir, rawDir);
    assert.ok(fs.existsSync(path.join(rawPrepared.pkgRoot, 'raw-demo', 'SKILL.md')));
    assert.strictEqual(rawPrepared.entries.length, 1);
    assert.strictEqual(rawPrepared.entries[0].name, 'raw-demo/SKILL.md');
    assert.strictEqual(rawPrepared.entries[0].isDirectory, false);

    // zip 路径：同一个 `{ importDir, pkgRoot, entries }` 形状（pkgRoot 供 locateSkillRoot 直接消费）
    const zipDir = makeImportDir();
    const zip = makeZip.buildZip({
      entries: [
        {
          name: 'demo-main/demo/SKILL.md',
          data: '---\nname: demo\ndescription: zip 技能\n---\n\n# demo\n',
          method: makeZip.METHOD_STORED,
        },
      ],
    });
    fs.writeFileSync(path.join(zipDir, 'pkg.zip'), zip);
    const zipPrepared = await aiSkills.extractAndValidatePackage(env, { importDir: zipDir, scopeRel: null });
    assert.strictEqual(zipPrepared.prefixStripped, true, '`<repo>-<ref>/` 顶层前缀必须被剥离');
    assert.strictEqual(
      zipPrepared.pkgRoot,
      path.join(zipDir, 'pkg', 'demo-main'),
      '剥离 = 降入顶层目录，pkgRoot 仍住在 `<importDir>/pkg/` 之下'
    );

    // 两条准备器产出的形状同一：`{ importDir, pkgRoot, entries }`，且 pkgRoot 都住在
    // `<importDir>/pkg` 之下、都能被 `locateSkillRoot` 直接定位到唯一技能根
    for (const prepared of [rawPrepared, zipPrepared]) {
      for (const key of ['importDir', 'pkgRoot', 'entries']) {
        assert.ok(key in prepared, `准备器产物必须含 ${key}（两条准备路径形状同一）`);
      }
      assert.ok(Array.isArray(prepared.entries));
      assert.ok(
        prepared.pkgRoot === path.join(prepared.importDir, 'pkg') ||
          prepared.pkgRoot.startsWith(`${path.join(prepared.importDir, 'pkg')}${path.sep}`),
        'pkgRoot 必须住在 `<importDir>/pkg` 之下（形状同一）'
      );
      const located = aiSkills.locateSkillRoot(prepared.pkgRoot, null);
      assert.ok(fs.existsSync(path.join(located.skillRootAbs, 'SKILL.md')));
    }
  });

  test('prepareFromRawFile 的 name 二次校验（路径拼接前不许信任上游）', async (t) => {
    withTempRoot(t);
    workspace.ensureWorkspaceDir();
    const dir = makeImportDir();
    let err = null;
    try {
      await aiSkills.prepareFromRawFile({ importDir: dir, name: '../escape', text: 'x' });
    } catch (e) {
      err = e;
    }
    assert.ok(err, '非法 name 必须被拒（它是一个路径拼接点）');
    assert.strictEqual(err.code, 'invalid_name');
    assert.strictEqual(
      fs.existsSync(path.join(dir, '..', 'escape')),
      false,
      '不得写出 importDir 之外'
    );
  });

  test('生产调用点走缺省依赖（正命题）：`ai-manager.js` 出现三个可注入键各 0 次', () => {
    const prod = stripCodeComments(readSource('ai-manager.js'));
    for (const key of ['fetchImpl', 'isPrivateHost', 'hostWhitelist']) {
      const n = (prod.match(new RegExp(`\\b${key}\\b`, 'g')) || []).length;
      assert.strictEqual(n, 0, `生产侧出现 ${key} ${n} 处（生产调用点必须走默认值，不得注入）`);
    }
    // 每个 `downloadPackage(` 调用的首参必须**逐字** `undefined`
    const start = prod.indexOf('async previewSkillImport(');
    const window = prod.slice(start, prod.indexOf('\n  }', start));
    const hits = [...window.matchAll(/downloadPackage\(/g)].map((m) => m.index);
    assert.ok(hits.length > 0, '生产调用点必须真的调用 downloadPackage（不得以空集通过）');
    for (const k of hits) {
      const tail = window.slice(k, k + 44);
      assert.match(
        tail,
        /^downloadPackage\(\s*undefined\s*,/,
        `生产调用点必须首参逐字 undefined，实测：${tail.replace(/\n/g, ' ').slice(0, 34)}`
      );
    }
  });

  test('上限单源：下载用的 maxBytes 取自 `IMPORT_LIMITS.MAX_TOTAL_BYTES`（不新造字面量）', () => {
    const prod = stripCodeComments(readSource('ai-manager.js'));
    const start = prod.indexOf('async previewSkillImport(');
    const window = prod.slice(start, prod.indexOf('\n  }', start));
    assert.ok(
      window.includes('MAX_TOTAL_BYTES'),
      '网络分支的字节上限必须取自限额单源（新造字面量会与 main.js 的 HTTP 上限漂移）'
    );
    assert.strictEqual(
      window.includes('32 * 1024 * 1024'),
      false,
      '网络分支不得内联上限字面量'
    );
  });

  test('公共后段只有一处：`locateSkillRoot(` / `buildImportPreview(` 在 `ai-manager.js` 各恰 1 处调用', () => {
    for (const token of ['locateSkillRoot(', 'buildImportPreview(']) {
      const n = (stripCodeComments(readSource('ai-manager.js')).match(
        new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      ) || []).length;
      assert.strictEqual(n, 1, `${token} 在 ai-manager.js 应恰 1 处调用，实测 ${n}`);
    }
    const manager = stripCodeComments(readSource('ai-skills-manager.js'));
    assert.strictEqual(
      (manager.match(/yauzl\.openPromise\(/g) || []).length,
      1,
      '本计划不得新增第二个解压入口'
    );
  });
});


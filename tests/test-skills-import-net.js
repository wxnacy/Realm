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

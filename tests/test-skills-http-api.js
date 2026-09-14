/**
 * `/api/skills/*` 写入端点与 `/api/settings/update` 双键校验的测试套件（node:test，**纯 Node 环境**）
 *
 * ## 为什么独立成文件（不并进 tests/test-skills-management.js）
 *
 * SEC-09 的 413 组与 token 403 组是 **HTTP / 传输层**关注点，与管理**数据面**
 * （投影 / 三态判据 / 谓词值域）职责不同；且独立文件才有独立的 `# tests` 计数可入账本。
 *
 * ## 本套件对 HTTP 面的验证分三层
 *
 * ① **源码扫描**（`main.js`）—— `handleSkillsApi` 的两个写子路由、token 首行鉴权、
 *    `{ error, code }` 错误形状、两处「**转发到同一 manager 方法**」的调用；
 *    `/api/settings/update` 的双键校验分支，以及「**拒绝时在 `configStore.set` 之前
 *    return**」的语句顺序（「校验失败但仍落盘」的机械判据）。
 * ② **对可 require 的纯逻辑做行为断言** —— `validateDisabledListForSettings` 的全部
 *    拒绝面（两种键形态共用同一份判据，取值路径分别模拟）。
 * ③ **SEC-09 的体积闸**（Phase 50-03）—— 真 `http.createServer` harness 的行为回归
 *    （413 + JSON / `unhandledRejection` 计数 0 / 堆不线性增长 / `destroy` 反向对照）
 *    **加** `main.js` 的源码契约断言（三参签名 / `res` 缺失降级分支 / 413 形态 /
 *    调用点覆盖度）。
 *
 * ⚠️ 为什么 ①② 只能停在源码层：`handleSkillsApi` 与 `handleSettingsApi` 都住在 `main.js`
 * 的 `realmServer` 闭包内、**不可 require**。③ 的 `readJsonBody` / `sendJson` 同样如此，
 * 故 ③ 用「等价 harness 的 `http` 行为 + `main.js` 的源码契约」双层承担，**不得**读成
 * 「直接测了 `main.js` 里那个函数」（详见 ③ 组的可测性声明）。
 *
 * 全部断言**逐条喂真实数据形状**（计划明文要求）：不用「手工构造一个实现从不构造的对象」
 * 式断言 —— ③ 组用真实的 `http.request` / `fetch` 发真实字节流。
 *
 * 用法: node tests/test-skills-http-api.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const aiSkills = require('../ai-skills-manager');

/** 仓库根目录（源码扫描型断言用） */
const REPO_ROOT = path.join(__dirname, '..');

/** 读取仓库根源码 */
function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/**
 * 词法级剥除注释（与计划自带门禁的 `stripC` **逐字同款**）
 *
 * 按单引号 / 双引号 / 模板反引号字符串、正则字面量、行注释、块注释四态**单遍**逐字符
 * 扫描，并把注释字符**等长空白化**（等长必须：否则索引会与原始源码错位）。
 *
 * 用途：凡「计数 / token 禁令」类判据一律**先剥注释再判** —— 注释里可以如实写明被禁的
 * 形态（例如「本仓没有 `process.on('uncaughtException')` 全局兜底」），那不构成违规。
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

/**
 * 取 `main.js` 里「校验循环 → settings:updated 广播」之间的窗口（双键判据的判读窗口）
 *
 * 与计划自带门禁同款口径：**只在这段窗口内**判键形态是否存在，
 * 避免与文件别处（如下发分支 / 注释）的同名字面量混淆。
 */
function settingsUpdateLoopWindow(src) {
  const start = src.indexOf('for (const [key, value] of Object.entries(updates)) {');
  assert.ok(start >= 0, 'main.js 必须含 /api/settings/update 的校验循环（口径失效）');
  const end = src.indexOf("broadcast('settings:updated'", start);
  assert.ok(end > start, 'main.js 的校验循环必须仍然位于 settings:updated 广播之前（口径失效）');
  return src.slice(start, end);
}

// ==================== ① 源码扫描：写路由与双键校验 ====================

describe('写路由（源码扫描）：handleSkillsApi 的两个 POST 子路由与转发目标', () => {
  test('两个子路由同时存在，且都插在 list 分支之后、404 兜底之前', () => {
    const src = readSource('main.js');
    const start = src.indexOf('async function handleSkillsApi(');
    assert.ok(start >= 0, 'main.js 必须定义 handleSkillsApi');
    const body = src.slice(start, src.indexOf('\n  }\n', start));

    for (const route of ['list', 'set-disabled', 'uninstall']) {
      assert.ok(
        new RegExp(`route === '${route}'`).test(body),
        `handleSkillsApi 必须含 ${route} 子路由`
      );
    }
    // 顺序即判定顺序：写子路由必须在 404 兜底之前（否则永远不可达）
    const idx404 = body.indexOf("sendJson(res, 404, { error: 'Not Found' })");
    assert.ok(idx404 > 0, '缺 404 兜底');
    assert.ok(body.indexOf("route === 'set-disabled'") < idx404, 'set-disabled 必须在 404 兜底之前');
    assert.ok(body.indexOf("route === 'uninstall'") < idx404, 'uninstall 必须在 404 兜底之前');
  });

  test('两处转发调用逐字存在（handler 只是转发层，判据全在 manager）', () => {
    const src = readSource('main.js');
    assert.ok(
      src.includes('await aiManager.setSkillDisabled(name, disabled)'),
      'set-disabled 必须转发到 aiManager.setSkillDisabled（不得在 handler 里另写一份判定）'
    );
    assert.ok(
      src.includes('await aiManager.uninstallUserSkill(name)'),
      'uninstall 必须转发到 aiManager.uninstallUserSkill（判据在 manager 的 deleteUserSkill）'
    );
  });

  test('token 首行鉴权 + 错误形状 { error, code }（设置页按 code 查表，不解析 message）', () => {
    const src = readSource('main.js');
    const start = src.indexOf('async function handleSkillsApi(');
    const head = src.slice(start, start + 700);
    assert.ok(
      /searchParams\.get\('token'\)\s*!==\s*REALM_TOKEN/.test(head),
      'handleSkillsApi 首段必须做 token 鉴权（无 token / 错 token ⇒ 任何副作用之前 403）'
    );
    assert.ok(
      /sendJson\(res, 400, \{ error: err\.message, code: err\.code \|\| undefined \}\)/.test(src),
      '技能域 HTTP 400 必须回传 { error, code } 形状（UI 按 code 查表）'
    );
  });
});

describe('双键校验（源码扫描）：/api/settings/update 同时覆盖 aiSkills.disabled 与 aiSkills', () => {
  test('校验循环内两种键形态都存在（书写形式无关：独立 if / || 表达式均可）', () => {
    const win = settingsUpdateLoopWindow(readSource('main.js'));
    assert.ok(
      /key\s*===\s*['"]aiSkills\.disabled['"]/.test(win),
      '校验循环未覆盖 aiSkills.disabled 键形态'
    );
    assert.ok(
      /key\s*===\s*['"]aiSkills['"]/.test(win),
      '校验循环未覆盖 aiSkills 键形态（只覆盖点号键会让 { aiSkills: {…} } 整体覆写绕过校验）'
    );
  });

  test('两种形态共用同一份判据（单源，main.js 零第二份正则）', () => {
    const src = readSource('main.js');
    assert.ok(
      /aiSkillsManager\.validateDisabledListForSettings\(/.test(src),
      'main.js 必须复用 manager 的名单校验器（第二份实现必然漂移）'
    );
    // 负向：main.js 不得出现第二个技能名形态校验实现
    assert.strictEqual(
      /\^\[a-z0-9-\]\+\$/.test(src),
      false,
      'main.js 不得内联技能名字符集正则（那是 ai-skills-manager 的单源职责）'
    );
  });

  test('拒绝路径**在 configStore.set 之前 return**（「校验失败但仍落盘」的机械判据）', () => {
    const win = settingsUpdateLoopWindow(readSource('main.js'));
    const branch = win.indexOf("key === 'aiSkills.disabled' || key === 'aiSkills'");
    assert.ok(branch > 0, '缺双键校验分支（口径失效）');
    const branchBody = win.slice(branch);

    const reject = branchBody.indexOf('sendJson(res, 400, { error: check.reason })');
    const guard = branchBody.indexOf('if (!check.valid)');
    const write = branchBody.indexOf("configStore.set('settings.aiSkills.disabled', list)");

    assert.ok(guard > 0, '缺 valid === false 的守卫');
    assert.ok(reject > guard, '守卫体内必须先 sendJson(400)');
    assert.ok(write > reject, '拒绝分支必须 **在 configStore.set 之前 return**（否则校验失败仍落盘）');
    assert.ok(
      /return;/.test(branchBody.slice(reject, write)),
      'sendJson(400) 之后必须紧跟 return（否则会继续执行到 set）'
    );
    // 反向：该分支**不得**落到循环尾的整体覆写（会静默冲掉 settings.aiSkills 上的其它字段）
    assert.ok(
      /configStore\.set\('settings\.aiSkills\.disabled', list\);\s*\n\s*continue;/.test(branchBody),
      'aiSkills 形态必须显式落子键后 continue，不得整体覆写 settings.aiSkills'
    );
  });
});

// ==================== ② 行为断言：两种键形态共用同一份判据 ====================

describe('validateDisabledListForSettings：两种键形态的取值路径与拒绝面（真实数据形状）', () => {
  /*
   * 两条键形态在 `main.js` 里的取值路径（源码见上面那条 `const list =` 三元表达式）：
   * - `key === 'aiSkills.disabled'` ⇒ `list = value`（值本体就是名单）
   * - `key === 'aiSkills'`          ⇒ `list = value.disabled`（值是子对象，取 disabled 子键）
   * 本组把两条路径**分别模拟**一遍喂给同一个校验器，证明「共用一份判据」在行为上也成立。
   */

  /** 模拟 main.js 的取值路径（与源码同形：`key === 'aiSkills' ? value.disabled : value`） */
  function listOf(key, value) {
    return key === 'aiSkills' ? (value ? value.disabled : undefined) : value;
  }

  test('aiSkills.disabled 形态：合法数组通过', () => {
    for (const payload of [
      [],
      ['alpha-skill'],
      ['My_Skill', 'plain name'],
      Array(100).fill('a'),
    ]) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills.disabled', payload));
      assert.strictEqual(check.valid, true, `${JSON.stringify(payload).slice(0, 50)} 必须通过`);
    }
  });

  test('aiSkills.disabled 形态：拒绝面逐条（非数组 / 非字符串项 / 超长 / 路径样串 / 超条数）', () => {
    const rejects = [
      'not-an-array',
      {},
      null,
      42,
      ['ok-name', 42],
      ['ok-name', ''],
      ['a'.repeat(65)],
      ['../escape'],
      ['a/b'],
      ['a\\b'],
      Array(101).fill('a'),
    ];
    for (const payload of rejects) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills.disabled', payload));
      assert.strictEqual(check.valid, false, `${JSON.stringify(payload).slice(0, 50)} 必须被拒`);
      assert.ok(check.reason && check.reason.length > 0, '拒绝必须带可读原因（UI 直接展示）');
    }
  });

  test('aiSkills 形态（子对象取值路径）：合法与拒绝面与点号键形态**逐条同宽**', () => {
    // 合法：子对象里带合法 disabled
    for (const payload of [{ disabled: [] }, { disabled: ['alpha-skill'] }, { disabled: Array(100).fill('a') }]) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills', payload));
      assert.strictEqual(check.valid, true, `${JSON.stringify(payload).slice(0, 50)} 必须通过`);
    }
    // 拒绝：与点号键形态同一批形状（含「无 disabled 子键」这一形态 —— 实现里写死为拒绝）
    const rejects = [
      {},
      { other: 1 },
      { disabled: 'not-an-array' },
      { disabled: ['ok-name', 42] },
      { disabled: ['ok-name', ''] },
      { disabled: ['a'.repeat(65)] },
      { disabled: ['../escape'] },
      { disabled: Array(101).fill('a') },
    ];
    for (const payload of rejects) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills', payload));
      assert.strictEqual(check.valid, false, `${JSON.stringify(payload).slice(0, 60)} 必须被拒`);
    }
    // 「无 disabled 子键」必须被拒（不得落到默认的整体覆写路径上）—— 与源码注释写死的口径一致
    assert.strictEqual(listOf('aiSkills', {}), undefined, '取值路径口径：无子键 ⇒ undefined');
    assert.strictEqual(
      aiSkills.validateDisabledListForSettings(undefined).valid,
      false,
      'undefined 必须被拒（`aiSkills` 形态缺 disabled 子键时 fail-closed）'
    );
  });

  test('条数上限是既有两项常量之和（100），不是第六项新额度', () => {
    assert.strictEqual(aiSkills.MAX_DISABLED_SKILLS, 100);
    assert.strictEqual(
      aiSkills.MAX_DISABLED_SKILLS,
      aiSkills.LIMITS.MAX_USER_SKILLS + aiSkills.LIMITS.MAX_MANAGED_SKILLS,
      '条数上限必须由既有 LIMITS 派生（不得改既有五项数值）'
    );
    assert.strictEqual(aiSkills.validateDisabledListForSettings(Array(100).fill('a')).valid, true);
    assert.strictEqual(aiSkills.validateDisabledListForSettings(Array(101).fill('a')).valid, false);
  });
});

// ==================== ③ SEC-09：真 http.createServer 行为组 ====================

/**
 * ⚠️ **可测性声明（不得写成失实的覆盖声明）**
 *
 * 本组测的是**等价 harness 的 `http` 语义** + `main.js` 的**源码契约**，
 * **不是**直接测那个不可 require 的闭包函数 —— `readJsonBody` / `sendJson` 住在
 * `main.js` 的 `realmServer` 闭包内（`main.js:882` / `:920` 附近），任何 `require`
 * 都拿不到它们。下面的 `readJsonBodyEq` / `sendJsonEq` 是**逐条同形**的复刻：
 *
 * - 累积中拒收（`size += chunk.length` 后立即比较 + `if (rejected) return;`）
 * - `sendJson(res, 413, …)` + `req.resume()`（**不** destroy / **不** `Connection: close`）
 * - `res` 缺失 ⇒ 只 reject（`code: 'BODY_TOO_LARGE'`）
 * - `sendJson` 的幂等护栏（`headersSent || writableEnded` ⇒ no-op）
 * - 宿主的既有形状：`async` 回调内 `try { await readJsonBody } catch { sendJson(400) }`
 *
 * 「harness 与 `main.js` 同形」这条依赖由上方的源码契约组与计划自带门禁（`node -e`
 * 的 stripC 扫描）共同钉住：harness 若与 `main.js` 漂移，同一批判据会在源码侧转红。
 */

/** 等价 `sendJson`：与 `main.js` 同形（含幂等护栏） */
function sendJsonEq(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/**
 * 等价 `readJsonBody`：与 `main.js` 同形
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} [res]
 * @param {{maxBytes?: number, rejectForm?: 'resume'|'destroy', onSample?: Function}} [options]
 *   `rejectForm: 'destroy'` **只用于反向对照**（证明「413 可达」这条断言能失败）
 */
function readJsonBodyEq(req, res, { maxBytes = 1024 * 1024, rejectForm = 'resume', onSample } = {}) {
  const canRespond = !!(res && typeof res.writeHead === 'function');
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let rejected = false;
    const tooLarge = () => {
      rejected = true;
      if (canRespond) {
        sendJsonEq(res, 413, { error: '请求体超过上限（' + maxBytes + ' 字节）', limit: maxBytes });
        if (rejectForm === 'destroy') req.destroy();
        else req.resume();
      }
    };
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      tooLarge();
      reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
      return;
    }
    req.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge();
        reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
        return;
      }
      body += chunk;
      if (onSample) onSample();
    });
    req.on('end', () => {
      if (rejected) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/** 起一个与 `main.js` 的 13 处宿主同形的 harness server */
function startSec09Server({ maxBytes = 1024 * 1024, rejectForm = 'resume', passRes = true, onSample } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const body = await readJsonBodyEq(req, passRes ? res : undefined, { maxBytes, rejectForm, onSample });
      sendJsonEq(res, 200, { ok: true, parsed: !!body });
    } catch (err) {
      // 既有 13 处宿主的形状：catch → sendJson（二次写头由幂等护栏吸收）
      sendJsonEq(res, 400, { error: err.message, code: err.code || undefined });
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** 关闭 harness server 并**立刻**断开 keep-alive 连接（否则 node:test 会等 socket 超时才退出） */
function closeSec09Server(server) {
  server.closeAllConnections();
  server.close();
}

/**
 * 发一个真实的 POST 字节流（`http.request`，不用 fetch 以免 undici 的缓冲语义干扰堆判据）
 *
 * `withContentLength = false` ⇒ 走 `Transfer-Encoding: chunked`，服务端**看不到**
 * `content-length` ⇒ 只能靠累积中判（这正是 SEC-09 的判据对象）。
 *
 * ⚠️ **不得**传 `agent: false`：那会让客户端在响应结束后立刻销毁 socket，而此刻它
 * 仍在写剩余 body ⇒ 拿到 `EPIPE`（真实客户端是 `fetch`/undici，不会有这个行为）。
 * 用默认的 keep-alive agent，并由 `closeSec09Server` 在用例结束时统一断开连接。
 */
function postStream(port, { payloadBytes, withContentLength = false, chunkBytes = 1024 * 1024, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (withContentLength) headers['Content-Length'] = String(payloadBytes);
    let done = false;
    const req = http.request({ host: '127.0.0.1', port, path: '/api/harness', method: 'POST', headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        done = true;
        clearTimeout(timer);
        // 响应已完整收到 ⇒ 主动结束这次上传（服务端可能早在第 2 MiB 就答了 413）。
        // 不这么做的话，挂起的写队列与 drain 等待会让事件循环多活 30 秒。
        req.destroy();
        resolve({ status: res.statusCode, text });
      });
    });
    const timer = setTimeout(() => { req.destroy(new Error('postStream 超时')); }, timeoutMs);
    req.on('error', (err) => { clearTimeout(timer); if (!done) reject(err); });
    const chunk = Buffer.alloc(chunkBytes, 0x61); // 'a'
    let sent = 0;
    const push = () => {
      if (done) return;
      while (sent < payloadBytes) {
        const remaining = payloadBytes - sent;
        const buf = remaining >= chunkBytes ? chunk : chunk.subarray(0, remaining);
        sent += buf.length;
        if (!req.write(buf)) { req.once('drain', push); return; }
      }
      clearTimeout(timer);
      req.end();
    };
    push();
  });
}

/** 40 MiB body（research 的实测尺度；远大于任何机器的堆噪声） */
const SEC09_PAYLOAD_BYTES = 40 * 1024 * 1024;

describe('SEC-09 行为组：超限请求体在传输层的真实表现（等价 harness）', () => {
  test('① 超限 ⇒ 客户端拿到 413 且 body 可 JSON.parse（chunked，走累积中判）', async () => {
    const { server, port } = await startSec09Server({ maxBytes: 1024 * 1024 });
    try {
      const res = await postStream(port, { payloadBytes: SEC09_PAYLOAD_BYTES });
      assert.strictEqual(res.status, 413, '超限必须答 413（不是网络错误、不是 200）');
      const parsed = JSON.parse(res.text); // 解析失败会直接抛 ⇒ 「可 JSON.parse」是硬判据
      assert.ok(typeof parsed.error === 'string' && parsed.error.length > 0, '413 body 必须带可读 error');
      assert.strictEqual(parsed.limit, 1024 * 1024, '413 body 必须回传上限（前端可展示）');
    } finally {
      closeSec09Server(server);
    }
  });

  test('①b 带 content-length 的同一请求同样拿到 413（快路径与累积中判皆可，判据是行为）', async () => {
    const { server, port } = await startSec09Server({ maxBytes: 1024 * 1024 });
    try {
      const res = await postStream(port, { payloadBytes: SEC09_PAYLOAD_BYTES, withContentLength: true });
      assert.strictEqual(res.status, 413);
      assert.strictEqual(JSON.parse(res.text).limit, 1024 * 1024);
    } finally {
      closeSec09Server(server);
    }
  });

  test('② 413 路径不产生 unhandledRejection（幂等护栏吸收 catch 的二次写头）', async () => {
    const { server, port } = await startSec09Server({ maxBytes: 1024 * 1024 });
    const seen = [];
    const onRejection = (reason) => {
      seen.push(reason && reason.message ? reason.message : String(reason));
    };
    process.on('unhandledRejection', onRejection);
    try {
      const res = await postStream(port, { payloadBytes: SEC09_PAYLOAD_BYTES });
      assert.strictEqual(res.status, 413);
      // 二次写头发生在 async 回调内，unhandled rejection 在微任务/下一 tick 才可见
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
      assert.deepStrictEqual(
        seen,
        [],
        '无护栏时 ERR_HTTP_HEADERS_SENT 会变成 unhandled rejection；本仓无全局兜底 ⇒ 主进程退出'
      );
    } finally {
      process.off('unhandledRejection', onRejection);
      closeSec09Server(server);
    }
  });

  test('③ 堆增量**远小于** body 体积（把累积改成「读完再判长度」会让本条转红）', async () => {
    let peak = 0;
    const sample = () => {
      const h = process.memoryUsage().heapUsed;
      if (h > peak) peak = h;
    };
    const { server, port } = await startSec09Server({ maxBytes: 1024 * 1024, onSample: sample });
    try {
      // 预热：让 http 解析器/连接池先分配完毕，避免把一次性开销算进增量
      await postStream(port, { payloadBytes: 1024 * 1024, withContentLength: true });
      if (global.gc) global.gc();
      const baseline = process.memoryUsage().heapUsed;
      peak = baseline;
      const res = await postStream(port, { payloadBytes: SEC09_PAYLOAD_BYTES });
      assert.strictEqual(res.status, 413);
      const delta = peak - baseline;
      // 可失败的数字比较：读完全量再判的实现会把 40 MiB 的 body 收进堆（远大于 10 MiB）
      assert.ok(
        delta < SEC09_PAYLOAD_BYTES / 4,
        `堆增量必须远小于 body 体积：实测 ${(delta / 1048576).toFixed(2)} MiB，` +
          `上限 ${(SEC09_PAYLOAD_BYTES / 4 / 1048576).toFixed(0)} MiB（超限必须停止累积，不是读完再判）`
      );
    } finally {
      closeSec09Server(server);
    }
  });

  test('④ 反向对照：req.destroy() 形态**拿不到** 413（证明 ① 的断言能失败）', async () => {
    const { server, port } = await startSec09Server({ maxBytes: 1024 * 1024, rejectForm: 'destroy' });
    const big = Buffer.alloc(SEC09_PAYLOAD_BYTES, 0x61);
    let threw = false;
    let status = 0;
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/harness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: big,
      });
      status = r.status;
      await r.text().catch(() => '');
    } catch (err) {
      threw = true;
    } finally {
      closeSec09Server(server);
    }
    assert.notStrictEqual(
      status,
      413,
      'destroy 形态把 socket 在响应可读之前撕掉 ⇒ 客户端拿不到 413（这正是禁用它的理由）'
    );
    assert.ok(threw || status !== 413, 'destroy 形态下客户端只能看到网络错误或非 413 状态');
  });
});

describe('SEC-09 源码契约（main.js）：三参签名 + res 缺失降级分支 + 413 形态', () => {
  test('签名逐字为 (req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {})', () => {
    const src = readSource('main.js');
    assert.ok(
      /function readJsonBody\(req, res, \{ maxBytes = MAX_JSON_BODY_BYTES \} = \{\}\)/.test(src),
      'readJsonBody 签名必须是三参（res 为第二位置参，方案 A）'
    );
  });

  test('res 缺失的降级分支：存在性判断与 writeHead 能力判断都在函数体内', () => {
    const src = readSource('main.js');
    const start = src.indexOf('function readJsonBody(');
    assert.ok(start >= 0, '缺 readJsonBody');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    assert.ok(/res\s* && \s*typeof res\.writeHead/.test(body), '降级分支必须同时判 res 存在性与 writeHead 能力');
    assert.ok(/canRespond/.test(body), '降级分支必须以 canRespond 布尔承载（漏改调用点 ⇒ 只 reject 不答响应）');
  });

  test('413 形态：sendJson(res, 413, …) + req.resume()，且无 req.destroy() / 无 Connection 头', () => {
    const src = readSource('main.js');
    const start = src.indexOf('function readJsonBody(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    assert.ok(body.includes('sendJson(res, 413'), '超限必须答 413');
    assert.ok(body.includes('req.resume()'), '超限必须 req.resume() 排水（不 destroy）');
    assert.strictEqual(/req\.destroy\(/.test(body), false, '不得使用 req.destroy()（客户端拿 EPIPE，413 不可达）');
    assert.strictEqual(
      /setHeader\(\s*['"]Connection['"]/.test(body) || /['"]Connection['"]\s*:/.test(body),
      false,
      '不得写入 Connection 头（两次实测结论相反、无收益）'
    );
    assert.ok(/if \(rejected\) return;/.test(body), '拒收后必须停止累积（否则内存 O(n)）');
  });

  /*
   * ⚠️ **为什么另起本条（计划自带门禁的实测弱点，已复现、未放宽任何判据）**
   *
   * 计划自带门禁只断言 `if (rejected) return;` **至少在函数体里出现一次**，而该形态
   * 在 `req.on('end')` 里天然存在 ⇒ 把 **data 监听器内**的那条早退删掉（这正是
   * 「拒收后仍在累积 body ⇒ 内存 O(n)」的唯一承载判据）门禁**仍绿**（变异实跑确认）。
   * 本组把判据升级为「data 监听器内的**顺序**」：早退 → 累加 size → 比较 → 才拼 body。
   * 计划自带判据一字未改。
   */
  test('累积中拒收的顺序：data 监听器内 早退 → 累加 size → 比较上限 → 才拼 body', () => {
    const src = readSource('main.js');
    const start = src.indexOf('function readJsonBody(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    const dataStart = body.indexOf("req.on('data',");
    const dataEnd = body.indexOf("req.on('end'");
    assert.ok(dataStart >= 0 && dataEnd > dataStart, 'readJsonBody 必须含完整的 data 监听器（口径失效）');
    const seg = body.slice(dataStart, dataEnd);

    const iEarly = seg.indexOf('if (rejected) return;');
    const iSize = seg.indexOf('size += chunk.length');
    const iLimit = seg.indexOf('if (size > maxBytes)');
    const iBody = seg.indexOf('body += chunk;');

    assert.ok(iEarly >= 0, 'data 监听器内必须有早退（拒收后不得继续累积 body）');
    assert.ok(iSize > iEarly, '早退必须**先于**累加 size（否则拒收后仍在累积）');
    assert.ok(iLimit > iSize, '必须每累加一个 chunk 就立即比较上限（不是读完再判）');
    assert.ok(
      iBody > iLimit,
      '必须在**比较之后**才拼 body（把 body += chunk 提到比较之前 ⇒ 堆随 body 线性增长）'
    );
  });
});

// ==================== ④ 调用点覆盖度 + 降级分支行为 + 既有端点回归 ====================

describe('sendJson 幂等护栏与体积常量单源（源码扫描）', () => {
  test('sendJson 幂等护栏：同时具备 headersSent 与 writableEnded，且位于 res.writeHead 之前', () => {
    const src = readSource('main.js');
    const start = src.indexOf('function sendJson(');
    assert.ok(start >= 0, '缺 sendJson');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    assert.ok(/res\.headersSent/.test(body), '缺 res.headersSent 条件');
    assert.ok(/res\.writableEnded/.test(body), '缺 res.writableEnded 条件');
    assert.strictEqual(
      (body.match(/res\.writeHead\(/g) || []).length,
      1,
      'sendJson 内必须恰 1 处发送点（新增第二处会绕过护栏）'
    );
    assert.ok(
      body.indexOf('res.headersSent') < body.indexOf('res.writeHead('),
      '护栏必须在 res.writeHead( 之前（顺序反 ⇒ 二次写头不被吸收 ⇒ unhandled rejection）'
    );
  });

  test('体积常量单源：两个常量各恰出现 1 次（数值只此一份）', () => {
    const src = readSource('main.js');
    assert.strictEqual(
      (src.match(/const MAX_JSON_BODY_BYTES = 1024 \* 1024;/g) || []).length,
      1,
      'MAX_JSON_BODY_BYTES 必须恰一处（1 MiB 全局默认）'
    );
    assert.strictEqual(
      (src.match(/const MAX_JSON_BODY_BYTES_LARGE = 32 \* 1024 \* 1024;/g) || []).length,
      1,
      'MAX_JSON_BODY_BYTES_LARGE 必须恰一处（需大 body 的端点专用）'
    );
  });

  test('res.writeHead( 的总数冻结在实测基线 14 处（不得新增响应发送点，T-50-19）', () => {
    const code = stripCodeComments(readSource('main.js'));
    const heads = (code.match(/res\.writeHead\(/g) || []).length;
    assert.strictEqual(
      heads,
      14,
      '基线 = 既有 13 处非 JSON 发送点（媒体代理 / 静态资源 / realm:// 静态兜底）+ sendJson 1 处；' +
        '新增第二个发送点会绕过幂等护栏（删既有发送点同样要显式说明）。计数已剥注释。'
    );
  });
});

describe('调用点覆盖度（源码扫描）：全部 /api/* POST 端点都传 res', () => {
  test('`await readJsonBody(req` 的次数 == 传 res 的次数，且 ≥ 57（既有调用点一个都不许丢）', () => {
    const code = stripCodeComments(readSource('main.js'));
    const total = (code.match(/await readJsonBody\(req/g) || []).length;
    const withRes = (code.match(/await readJsonBody\(req, res/g) || []).length;
    assert.strictEqual(
      total,
      withRes,
      `调用点未全部传 res：总计 ${total} / 传 res ${withRes}（漏改一处 ⇒ 该端点超限答 400 而非 413）`
    );
    assert.ok(total >= 57, `读盘调用点数 ${total} < 57（既有调用点被误删）`);
    // 本阶段实测值：59 = 既有 57 + 50-02 新增的两处写路由（计数已剥注释 ⇒ 注释不影响）
    assert.strictEqual(total, 59, `本阶段实测调用点数应为 59，实测 ${total}`);
  });

  test('两个书签导入端点**显式放大**到 32 MiB，且恰 2 处覆盖（T-50-23）', () => {
    const src = readSource('main.js');
    const favStart = src.indexOf('async function handleFavoritesApi(');
    assert.ok(favStart >= 0, '缺 handleFavoritesApi（口径失效）');
    const favBody = src.slice(favStart, src.indexOf('\n  }\n', favStart));
    for (const route of ['import-chrome', 'import-html']) {
      const i = favBody.indexOf(`route === '${route}'`);
      assert.ok(i >= 0, `handleFavoritesApi 必须含 ${route} 子路由`);
      assert.ok(
        favBody.slice(i, i + 400).includes('maxBytes: MAX_JSON_BODY_BYTES_LARGE'),
        `${route} 必须显式放大上限（body 是用户书签文件全文，1 MiB 默认会静默破坏既有功能）`
      );
    }
    assert.strictEqual(
      (src.match(/maxBytes: MAX_JSON_BODY_BYTES_LARGE/g) || []).length,
      2,
      '显式覆盖必须恰 2 处（逐端点评审结论：除这两个端点外无「用户文件全文」级 body）'
    );
  });

  test('既有端点回归 smoke：/api/settings/update 的调用点仍在且走**默认上限**（两参、无第三参）', () => {
    const src = readSource('main.js');
    const start = src.indexOf('async function handleSettingsApi(');
    assert.ok(start >= 0, '缺 handleSettingsApi（口径失效）');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    assert.ok(
      /const updates = await readJsonBody\(req, res\);/.test(body),
      '/api/settings/update 的调用点必须仍在且为两参形态（走 MAX_JSON_BODY_BYTES 默认值）'
    );
  });
});

describe('降级分支的行为断言：旧两参形态只 reject，不崩主进程（裁决 A 的强制项）', () => {
  test('res 为 undefined ⇒ 外层 catch 得到 { code: BODY_TOO_LARGE } 的 400（不是 TypeError）', async () => {
    const { server, port } = await startSec09Server({ maxBytes: 1024, passRes: false });
    try {
      const res = await postStream(port, { payloadBytes: 4 * 1024 });
      assert.strictEqual(
        res.status,
        400,
        '漏改调用点的后果必须是「外层 catch 答 400」，而不是在 data 监听器里 TypeError（无全局兜底 ⇒ 主进程退出）'
      );
      const parsed = JSON.parse(res.text);
      assert.strictEqual(parsed.code, 'BODY_TOO_LARGE', '必须回传机器可读的错误码');
      assert.strictEqual(
        /TypeError/.test(String(parsed.error)),
        false,
        '错误消息不得是 TypeError（那正是降级分支要避免的形态）'
      );
      // 走到这里即证明进程未退出（本仓没有 process.on('uncaughtException') 兜底）
      assert.ok(typeof process.pid === 'number' && process.pid > 0);
    } finally {
      closeSec09Server(server);
    }
  });
});

// ==================== ⑤ 双入口（HTTP + IPC）跨文件一致性 ====================

/**
 * 三个管理通道 → 它们必须转发到的 manager 方法名
 *
 * 这张表是「**两入口同一权威**」的可核形式：左侧由 `ipc-handlers.js` 消费，
 * 右侧必须同时出现在 `ipc-handlers.js`（IPC 入口）与 `main.js`（HTTP 入口）里。
 */
const DUAL_ENTRY_CHANNELS = [
  ['ai:get-skills-management', 'getSkillsForManagement'],
  ['ai:set-skill-disabled', 'setSkillDisabled'],
  ['ai:uninstall-skill', 'uninstallUserSkill'],
];

describe('双入口（跨文件）：三个 IPC 通道只做转发，判定住在 manager 层', () => {
  /** 取 `ipc-handlers.js` 里某个通道的 handler 段（已剥注释） */
  function channelSegment(src, channel) {
    const i = src.indexOf(`ipcMain.handle('${channel}'`);
    assert.ok(i >= 0, `缺 IPC 通道 ${channel}`);
    const end = src.indexOf('\n  });', i);
    assert.ok(end > i, `${channel} 的 handler 段口径失效`);
    return src.slice(i, end);
  }

  test('三个通道各注册且首行做 assertTrustedSender(event)（拒 webview guest / DevTools / 非受管窗口）', () => {
    const ih = stripCodeComments(readSource('ipc-handlers.js'));
    for (const [ch] of DUAL_ENTRY_CHANNELS) {
      const seg = channelSegment(ih, ch);
      assert.ok(/assertTrustedSender\(event\)/.test(seg), `${ch} 未做 assertTrustedSender（写能力会暴露给不受信来源）`);
    }
  });

  test('三个通道各转发到对应 manager 方法，且来源校验在转发**之前**', () => {
    const ih = stripCodeComments(readSource('ipc-handlers.js'));
    for (const [ch, method] of DUAL_ENTRY_CHANNELS) {
      const seg = channelSegment(ih, ch);
      assert.ok(seg.includes(`aiManager.${method}(`), `${ch} 未转发到同一 manager 函数 ${method}（两入口同一权威）`);
      assert.ok(
        seg.indexOf('assertTrustedSender(event)') < seg.indexOf(`aiManager.${method}(`),
        `${ch} 的来源校验必须早于转发`
      );
    }
  });

  test('通道段内**零判定素材**（kind === / source === / isSeededName / managed-skills）', () => {
    const ih = stripCodeComments(readSource('ipc-handlers.js'));
    for (const [ch] of DUAL_ENTRY_CHANNELS) {
      const seg = channelSegment(ih, ch);
      assert.strictEqual(
        /kind ===|source ===|isSeededName|managed-skills/.test(seg),
        false,
        `${ch} 出现判定逻辑 —— handler 只做转发，判定单源在 ai-skills-manager.js（判据已剥注释，如实解释禁令的注释不构成违规）`
      );
    }
  });

  test('src/preload.js 的三个 realmAPI.ai 方法名与通道名逐字一致', () => {
    const pl = stripCodeComments(readSource('src/preload.js'));
    const pairs = [
      ['getSkillsManagement', 'ai:get-skills-management'],
      ['setSkillDisabled', 'ai:set-skill-disabled'],
      ['uninstallSkill', 'ai:uninstall-skill'],
    ];
    for (const [api, ch] of pairs) {
      const k = pl.indexOf(`${api}:`);
      assert.ok(k >= 0, `preload 缺 realmAPI.ai.${api}`);
      assert.ok(pl.slice(k, k + 160).includes(ch), `preload.${api} 未绑定通道 ${ch}（通道名必须逐字一致）`);
    }
  });

  test('跨文件一致性：main.js 的三个 REST 子路由与三个 IPC 通道转发到**同一组**方法名', () => {
    const main = stripCodeComments(readSource('main.js'));
    for (const [, method] of DUAL_ENTRY_CHANNELS) {
      assert.ok(main.includes(`aiManager.${method}(`), `main.js 未转发到 ${method}（两入口判定必然漂移）`);
    }
    assert.ok(main.includes('await aiManager.setSkillDisabled(name, disabled)'), 'HTTP set-disabled 未转发到 setSkillDisabled');
    assert.ok(main.includes('await aiManager.uninstallUserSkill(name)'), 'HTTP uninstall 未转发到 uninstallUserSkill');
    for (const route of ['set-disabled', 'uninstall']) {
      assert.ok(new RegExp(`route === '${route}'`).test(main), `handleSkillsApi 缺子路由 ${route}`);
    }
  });

  test('token 403 前置：handleSkillsApi 首段先鉴权，且早于任何 manager 调用', () => {
    const code = stripCodeComments(readSource('main.js'));
    const start = code.indexOf('async function handleSkillsApi(');
    assert.ok(start >= 0, '缺 handleSkillsApi');
    const head = code.slice(start, start + 700);
    const iTok = head.search(/searchParams\.get\('token'\)\s*!==\s*REALM_TOKEN/);
    assert.ok(iTok >= 0, 'handleSkillsApi 首段必须做 token 鉴权');
    const i403 = head.indexOf('sendJson(res, 403', iTok);
    assert.ok(i403 > iTok && i403 - iTok < 200, 'token 不通过时必须**立刻**答 403（鉴权必须早于任何副作用）');
    const iEffect = head.indexOf('await aiManager.');
    assert.ok(iEffect === -1 || iEffect > i403, '鉴权必须早于任何 manager 调用（副作用不得先于鉴权）');
  });
});

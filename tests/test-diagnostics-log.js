/**
 * diagnostics-log.js 单元测试（node:test，纯 Node 环境）
 *
 * 覆盖「诊断日志落盘」的判定与副作用边界：
 * - A 组 `shouldForward`：渲染进程 console 的转发白名单（前缀命中 / error 直通 /
 *   electron 内部消息滤除 / 普通 log 不落盘）
 * - B 组 init：启用环境建文件并写会话头；production 不落盘；目录不可用时**不抛错**且停用
 * - C 组 record / diagLog：格式、多行压平、控制台回显的环境门槛
 * - D 组 轮转：超过阈值改名 `.1` 并重新开始
 * - E 组 attachContents：幂等、来源标签按 webContents 类型、写失败后整轮停用
 *
 * 模块零 electron 依赖（`dir` 由调用方注入）⇒ 本文件不需要任何桩。
 *
 * 用法: node --test tests/test-diagnostics-log.js
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const D = require('../diagnostics-log');

/** 每个用例一个干净临时目录（模块状态也要复位，避免跨用例串味） */
let tmpDir = '';
beforeEach(() => {
  D._reset();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-diag-test-'));
});

/** 读日志文件正文（未启用时抛错，便于定位） */
function readLog(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('A 组 · shouldForward —— 渲染进程 console 转发白名单', () => {
  test('命中诊断前缀 ⇒ 落盘（本仓库约定的两个标记）', () => {
    assert.strictEqual(
      D.shouldForward({ level: 'info', message: '[Realm 诊断] guest 探针', sourceId: 'file:///p' }), true);
    assert.strictEqual(
      D.shouldForward({ level: 'warning', message: '[Realm] webview 可命中性残留已恢复（兜底=watchdog）', sourceId: 'file:///p' }), true);
  });

  test('error 级别不看前缀直通（渲染异常是取证重点）', () => {
    assert.strictEqual(D.shouldForward({ level: 'error', message: '随便一个渲染错误', sourceId: 'file:///p' }), true);
  });

  test('普通 log / info 且无前缀 ⇒ 不落盘（量太大）', () => {
    assert.strictEqual(D.shouldForward({ level: 'info', message: '[Realm Renderer] URL 输入框按键: a', sourceId: 'file:///p' }), false);
  });

  test('electron 内部消息（sourceId 以 node:electron/ 开头）一律滤除', () => {
    assert.strictEqual(
      D.shouldForward({ level: 'warning', message: '%cElectron Security Warning 内容里也可能含 [Realm 诊断]', sourceId: 'node:electron/js2c/sandbox_bundle' }), false);
    assert.strictEqual(
      D.shouldForward({ level: 'error', message: 'electron 内部错误', sourceId: 'node:electron/js2c/renderer_init' }), false);
  });

  test('缺参不抛错', () => {
    assert.strictEqual(D.shouldForward(undefined), false);
    assert.strictEqual(D.shouldForward({}), false);
  });

  test('噪声表：每条模式都有代表性样本必须被滤除（新增模式请同步补样本）', () => {
    const samples = [
      "Applying inline style violates the following Content Security Policy directive 'style-src 'self''",
    ];
    assert.strictEqual(samples.length, D.NOISE_PATTERNS.length,
      '噪声表与样本必须一一对应 —— 加噪声模式必须同时补一条实测样本');
    samples.forEach((message) => {
      assert.strictEqual(
        D.shouldForward({ level: 'error', message, sourceId: 'file:///p' }), false,
        `噪声源必须滤除（即使 level=error）：${message.slice(0, 40)}`
      );
    });
  });
});

describe('B 组 · init —— 环境门槛与失败兜底', () => {
  test('nightly / development / debug 建文件并写会话分隔头', () => {
    for (const env of ['nightly', 'development', 'debug']) {
      D._reset();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-diag-env-'));
      const r = D.init({ dir, env, version: '9.9.9', pid: 4242 });
      assert.strictEqual(r.enabled, true, `${env} 应启用`);
      const body = readLog(r.filePath);
      assert.match(body, /^===== session start env=/);
      assert.ok(body.includes(`env=${env}`), '会话头要带环境');
      assert.ok(body.includes('version=9.9.9'), '会话头要带版本');
      assert.ok(body.includes('pid=4242'), '会话头要带 pid');
    }
  });

  test('production 不落盘：不建文件、enabled=false 且给出原因', () => {
    const r = D.init({ dir: tmpDir, env: 'production' });
    assert.strictEqual(r.enabled, false);
    assert.ok(r.reason.includes('production'), '原因里要能看出是环境不落盘');
    assert.strictEqual(fs.existsSync(path.join(tmpDir, 'logs', 'diagnostics.log')), false);
    assert.strictEqual(D.isEnabled(), false);
  });

  test('目录不可用（父路径是文件）⇒ 不抛错、停用并给出原因', () => {
    const blocker = path.join(tmpDir, 'a-file');
    fs.writeFileSync(blocker, 'x');
    const r = D.init({ dir: path.join(blocker, 'nested'), env: 'nightly' });
    assert.strictEqual(r.enabled, false);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0, '要给原因');
    assert.strictEqual(D.isEnabled(), false);
  });

  test('未提供目录 ⇒ 停用而非抛错', () => {
    const r = D.init({ env: 'nightly' });
    assert.strictEqual(r.enabled, false);
    assert.ok(r.reason.includes('目录'));
  });

  test('重复 init 指向同一目录时在同文件追加（不截断已有内容）', () => {
    const first = D.init({ dir: tmpDir, env: 'nightly' });
    fs.appendFileSync(first.filePath, 'OLD_LINE\n');
    D._reset();
    const second = D.init({ dir: tmpDir, env: 'nightly' });
    assert.strictEqual(second.filePath, first.filePath);
    assert.ok(readLog(second.filePath).includes('OLD_LINE'), '旧内容必须保留');
  });
});

describe('C 组 · record / diagLog —— 格式与回显门槛', () => {
  test('一行一条：时间 + 级别 + 来源 + 正文', () => {
    const r = D.init({ dir: tmpDir, env: 'nightly' });
    D.record('warn', 'renderer:webview', '正文');
    const line = readLog(r.filePath).split('\n').filter((l) => l.includes('正文'))[0];
    assert.match(line, /^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[warn\] \[renderer:webview\] 正文$/);
  });

  test('多行正文压成一条记录（避免后续行缺口径）', () => {
    const r = D.init({ dir: tmpDir, env: 'nightly' });
    D.record('error', 'main', '第一行\n第二行');
    const lines = readLog(r.filePath).split('\n').filter((l) => l.length > 0);
    assert.strictEqual(lines.length, 2, '会话头 + 一条记录');
    assert.ok(lines[1].endsWith('第一行\\n第二行'), '换行必须被转义成字面 \\n');
  });

  test('diagLog 正文与既有控制台文案同形（[Realm 诊断] 前缀保持）', () => {
    const r = D.init({ dir: tmpDir, env: 'nightly' });
    D.diagLog('warn', 'webContents 无响应', 'id=12 type=webview url=https://x');
    assert.ok(readLog(r.filePath).includes('[Realm 诊断] webContents 无响应 id=12 type=webview url=https://x'));
  });

  test('控制台回显只在 dev/debug：nightly 不外泄控制台', () => {
    const captured = [];
    const realWarn = console.warn;
    const realLog = console.log;
    console.warn = (...a) => captured.push('warn:' + a.join(' '));
    console.log = (...a) => captured.push('log:' + a.join(' '));
    try {
      D.init({ dir: tmpDir, env: 'nightly' });
      D.diagLog('warn', 'nightly 不外泄', 'x');
      assert.strictEqual(captured.length, 0, 'nightly 不应有任何控制台输出');
      D._reset();
      D.init({ dir: tmpDir, env: 'development' });
      D.diagLog('warn', 'dev 回显', 'x');
      assert.ok(captured.some((c) => c.startsWith('warn:') && c.includes('[Realm 诊断] dev 回显')), 'dev 应回显');
    } finally {
      console.warn = realWarn;
      console.log = realLog;
    }
  });
});

describe('D 组 · 轮转', () => {
  test('超过阈值：当前文件改名 .1 并重新开始（只留一份历史）', () => {
    fs.mkdirSync(path.join(tmpDir, 'logs'), { recursive: true });
    const filePath = path.join(tmpDir, 'logs', 'diagnostics.log');
    // 预置一个已超阈值的文件，省掉写满 5MB 的时间
    fs.writeFileSync(filePath, Buffer.alloc(D.MAX_BYTES + 1, 0x41));
    const r = D.init({ dir: tmpDir, env: 'nightly' });
    assert.strictEqual(r.enabled, true);
    D.record('warn', 'main', '触发轮转');
    assert.ok(fs.existsSync(`${filePath}.1`), '旧文件应改名为 .1');
    assert.ok(fs.statSync(`${filePath}.1`).size > D.MAX_BYTES, '.1 必须是那份超阈值的大文件');
    const body = readLog(filePath);
    assert.ok(body.includes('rotated at'), '新文件要留下轮转标记');
    assert.ok(body.includes('触发轮转'), '轮转后的新记录必须写进新文件');
    assert.ok(fs.statSync(filePath).size < D.MAX_BYTES, '新文件体积应回到阈值以下');
  });
});

describe('E 组 · attachContents —— 转发、幂等与失败停用', () => {
  /** 造一个最小的 webContents 替身：只在订阅时把登记的回调存下来 */
  function fakeContents(type, emit) {
    const handlers = {};
    return {
      getType: () => type,
      on: (channel, cb) => { handlers[channel] = cb; },
      emit: (event) => { emit(handlers, event); },
      handlers,
    };
  }

  test('按过滤规则转发，来源标签带 webContents 类型', () => {
    const r = D.init({ dir: tmpDir, env: 'nightly' });
    const seen = [];
    const wv = fakeContents('webview', (h, e) => h['console-message'](e));
    D.attachContents(wv);
    wv.emit({ level: 'info', message: '[Realm 诊断] guest 探针', sourceId: 'file:///g' });
    wv.emit({ level: 'info', message: '普通日志', sourceId: 'file:///g' });
    const win = fakeContents('window', (h, e) => h['console-message'](e));
    D.attachContents(win);
    win.emit({ level: 'warning', message: '[Realm] webview 可命中性残留已恢复（兜底=watchdog）', sourceId: 'file:///w' });
    const body = readLog(r.filePath);
    assert.ok(body.includes('[renderer:webview] [Realm 诊断] guest 探针'), 'guest 那条必须落盘且来源为 webview');
    assert.ok(!body.includes('普通日志'), '无前缀 info 不落盘');
    assert.ok(body.includes('[renderer:window] [Realm] webview 可命中性残留已恢复'), '窗口渲染进程那条必须落盘');
  });

  test('重复 attach 幂等：不会重复记录', () => {
    const r = D.init({ dir: tmpDir, env: 'nightly' });
    const wv = fakeContents('window', (h, e) => h['console-message'](e));
    D.attachContents(wv);
    D.attachContents(wv);
    wv.emit({ level: 'error', message: '只应出现一次', sourceId: 'file:///w' });
    const hits = readLog(r.filePath).split('\n').filter((l) => l.includes('只应出现一次'));
    assert.strictEqual(hits.length, 1);
  });

  test('写盘失败 ⇒ 整轮停用且不抛错（坏路径模拟）', () => {
    const r = D.init({ dir: tmpDir, env: 'nightly' });
    assert.strictEqual(r.enabled, true);
    fs.rmSync(path.join(tmpDir, 'logs'), { recursive: true, force: true });
    // 用一个已成文件的同名路径挡住追加目标，制造写失败
    fs.writeFileSync(path.join(tmpDir, 'logs'), 'blocker');
    assert.doesNotThrow(() => D.record('warn', 'main', '应触发写失败'));
    assert.strictEqual(D.isEnabled(), false, '写失败后必须停用，避免逐行报错风暴');
    assert.doesNotThrow(() => D.record('warn', 'main', '停用后再写也不抛'));
  });
});

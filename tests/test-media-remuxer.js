/**
 * media-remuxer 单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：sanitizeFilename 白名单替换（路径字符/控制字符/超长）、
 * buildOutputName 格式（D-22「{标题} {YYYY-MM-DD HHmm}.mp4」）、
 * mux.js Transmuxer 构造 smoke（D-04 主进程可用性）、
 * convertToMp4 监听先于 push 的结构断言（RESEARCH Pattern 3 README 硬约束）
 * 与 discontinuity 拒转（Pitfall 5）。
 *
 * 用法: node tests/test-media-remuxer.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const remuxer = require('../media-remuxer');

describe('sanitizeFilename 白名单替换（T-44-15 路径注入面）', () => {
  test('路径分隔符替换为 _', () => {
    assert.strictEqual(remuxer.sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j');
  });

  test('双引号与尖括号替换（单引号是合法文件名字符，保留）', () => {
    assert.strictEqual(remuxer.sanitizeFilename('引号"和\''), '引号_和\'');
    assert.strictEqual(remuxer.sanitizeFilename('<script>alert(1)</script>'), '_script_alert(1)__script_');
  });

  test('控制字符替换', () => {
    assert.strictEqual(remuxer.sanitizeFilename('a\x00b\x1fc\x7fd'), 'a_b_c_d');
  });

  test('常规中文与空格保留', () => {
    assert.strictEqual(remuxer.sanitizeFilename('直播间标题 ABC 123'), '直播间标题 ABC 123');
  });

  test('超长标题裁剪到 80 字符', () => {
    const long = 'x'.repeat(200);
    assert.strictEqual(remuxer.sanitizeFilename(long).length, 80);
  });

  test('非字符串输入返回空串', () => {
    assert.strictEqual(remuxer.sanitizeFilename(null), '');
    assert.strictEqual(remuxer.sanitizeFilename(undefined), '');
    assert.strictEqual(remuxer.sanitizeFilename(123), '');
  });
});

describe('buildOutputName 产物命名（D-22）', () => {
  const fixed = new Date(2026, 8, 6, 14, 30); // 2026-09-06 14:30

  test('格式「{标题} {YYYY-MM-DD HHmm}.mp4」', () => {
    assert.strictEqual(remuxer.buildOutputName('直播间标题', fixed), '直播间标题 2026-09-06 1430.mp4');
  });

  test('标题先 sanitize 再拼接', () => {
    assert.strictEqual(remuxer.buildOutputName('a/b:c', fixed), 'a_b_c 2026-09-06 1430.mp4');
  });

  test('空/纯非法标题回落「未命名」', () => {
    assert.strictEqual(remuxer.buildOutputName('', fixed), '未命名 2026-09-06 1430.mp4');
    assert.strictEqual(remuxer.buildOutputName('  ', fixed), '未命名 2026-09-06 1430.mp4');
    assert.strictEqual(remuxer.buildOutputName(null, fixed), '未命名 2026-09-06 1430.mp4');
  });

  test('补零语义（单位数月/日/时/分）', () => {
    const d = new Date(2026, 0, 3, 5, 7);
    assert.match(remuxer.buildOutputName('t', d), /^t 2026-01-03 0507\.mp4$/);
  });
});

describe('mux.js Transmuxer 构造 smoke（D-04 主进程可用性）', () => {
  test('CJS 入口可构造且具备 push/flush/on API', () => {
    const muxjs = require('mux.js');
    const t = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
    assert.strictEqual(typeof t.push, 'function');
    assert.strictEqual(typeof t.flush, 'function');
    assert.strictEqual(typeof t.on, 'function');
  });
});

describe('convertToMp4 契约', () => {
  test('源码结构断言：data 监听注册先于首次 push（README 硬约束）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'media-remuxer.js'), 'utf8');
    const onIdx = src.indexOf("transmuxer.on('data'");
    const pushIdx = src.indexOf('transmuxer.push(');
    assert.ok(onIdx !== -1, "缺少 transmuxer.on('data') 监听注册");
    assert.ok(pushIdx !== -1, '缺少 transmuxer.push 调用');
    assert.ok(onIdx < pushIdx, 'data 监听必须先于首次 push 注册（mux.js README 时序警告）');
    // 单实例断言：new Transmuxer 只出现一次（循环内新建会时间轴断裂——Pitfall 5）
    const ctorCount = (src.match(/new muxjs\.mp4\.Transmuxer/g) || []).length;
    assert.strictEqual(ctorCount, 1, 'Transmuxer 必须单实例（每分片新建会时间轴断裂）');
    // 流式写盘断言：createWriteStream 存在（T-44-17 不全量入内存）
    assert.ok(src.includes('fs.createWriteStream'), '必须流式写盘');
    // keepOriginalTimestamps: false（时间轴归零）
    assert.ok(src.includes('keepOriginalTimestamps: false'), '时间轴需归零');
  });

  test('discontinuity 索引直接拒转不尝试（Pitfall 5）', async () => {
    await assert.rejects(
      () => remuxer.convertToMp4({ segmentPaths: ['/tmp/x.ts'], outputPath: '/tmp/x.mp4', hasDiscontinuity: true }),
      (err) => err.reason === 'discontinuity'
    );
  });

  test('空分片列表拒转 reason=no_segments', async () => {
    await assert.rejects(
      () => remuxer.convertToMp4({ segmentPaths: [], outputPath: '/tmp/x.mp4' }),
      (err) => err.reason === 'no_segments'
    );
    await assert.rejects(
      () => remuxer.convertToMp4({ outputPath: '/tmp/x.mp4' }),
      (err) => err.reason === 'no_segments'
    );
  });

  test('分片文件缺失拒转 reason=segment_missing', async () => {
    await assert.rejects(
      () => remuxer.convertToMp4({ segmentPaths: ['/tmp/__realm_no_such__.ts'], outputPath: '/tmp/x.mp4' }),
      (err) => err.reason === 'segment_missing'
    );
  });
});

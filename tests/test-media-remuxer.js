/**
 * media-remuxer 单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：sanitizeFilename 白名单替换（路径字符/控制字符/超长）、
 * buildOutputName 格式（D-22「{标题} {YYYY-MM-DD HHmm}.mp4」）、
 * mux.js Transmuxer 构造 smoke（D-04 主进程可用性）、
 * convertToMp4 监听先于 push 的结构断言（RESEARCH Pattern 3 README 硬约束）
 * 与 discontinuity 拒转（Pitfall 5）；CR-04 协作式取消（shouldCancel 即拒转
 * reason=cancelled 且半成品清理 / shouldCancel=false 默认路径不变）；
 * G-44-4b 首片格式嗅探（fMP4/高熵拒转、0x47 放行、取消先于嗅探）与
 * main.js CONVERT_FAIL_TEXT 对新失败 reason 的文案覆盖；
 * G-44-7 产物泄漏回归（密文拒转/协作式取消失败路径事件循环延迟 100ms 后
 * 产物文件仍不存在——旧异步 open 竞态的复现窗口）。
 *
 * 用法: node tests/test-media-remuxer.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

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

  test('shouldCancel=true 即拒转 reason=cancelled 且产物清理（CR-04 取消路径）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-cancel-'));
    try {
      // 占位分片：取消检查在首个 readFileSync 之前触发，无需真实 TS 载荷
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, Buffer.from('placeholder'));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out, shouldCancel: () => true }),
        (err) => err.reason === 'cancelled'
      );
      // 半成品清理：createWriteStream 已建文件 → fail 的 unlinkSync 须删除（不留盘）
      assert.strictEqual(fs.existsSync(out), false, '取消后半成品 mp4 应被清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('shouldCancel=false 行为不变（CR-04 回归：新入参不改变默认路径）', async () => {
    // 沿用既有拒转契约：segment_missing 在分片存在性校验（早于循环取消检查）即触发
    await assert.rejects(
      () => remuxer.convertToMp4({
        segmentPaths: ['/tmp/__realm_no_such__.ts'],
        outputPath: '/tmp/x.mp4',
        shouldCancel: () => false,
      }),
      (err) => err.reason === 'segment_missing'
    );
  });
});

describe('convertToMp4 格式嗅探（G-44-4b）', () => {
  test('源码结构断言：嗅探检查点位于 shouldCancel 之后、push 之前（44-08 取消契约优先序）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'media-remuxer.js'), 'utf8');
    const cancelIdx = src.indexOf("shouldCancel === 'function' && shouldCancel()");
    const sniffIdx = src.indexOf('sniffContainerFormat(tsFile)');
    const pushIdx = src.indexOf('transmuxer.push(');
    assert.ok(cancelIdx !== -1, '缺少 shouldCancel 取消检查点');
    assert.ok(sniffIdx !== -1, '缺少首片嗅探检查点');
    assert.ok(pushIdx !== -1, '缺少 transmuxer.push 调用');
    assert.ok(cancelIdx < sniffIdx, '取消检查必须先于嗅探（44-08 取消契约）');
    assert.ok(sniffIdx < pushIdx, '嗅探必须先于 push（不可转容器在进入 mux.js 前拒绝）');
  });

  test('fMP4 box 分片拒转 reason=unsupported_container 且产物清理', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-fmp4-'));
    try {
      // 手工构造 fMP4 分片：4 字节 size + 'ftyp' + 'isom' + 填充（首字节 0x00 非同步字节）
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x14]),
        Buffer.from('ftypisom', 'ascii'),
        Buffer.alloc(12, 0x00),
      ]));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out }),
        (err) => err.reason === 'unsupported_container'
      );
      assert.strictEqual(fs.existsSync(out), false, '拒转后半成品 mp4 应被清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('高熵密文分片拒转 reason=encrypted_stream', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-enc-'));
    try {
      // 高熵载荷：随机字节强制首字节为固定非 0x47 值（消除随机撞同步字节的偶发）；
      // 再生循环规避随机撞 fMP4 box 特征 ASCII 的偶发（概率 ~5e-6，测试须确定性）
      let payload;
      do {
        payload = crypto.randomBytes(4096);
        payload[0] = 0xaa;
      } while (['ftyp', 'styp', 'moof', 'moov', 'sidx'].some((t) => payload.includes(Buffer.from(t, 'ascii'))));
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, payload);
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out }),
        (err) => err.reason === 'encrypted_stream'
      );
      assert.strictEqual(fs.existsSync(out), false, '拒转后半成品 mp4 应被清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('0x47 首字节分片嗅探放行，错误语义落在既有路径（嗅探不误杀 TS）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-ts-'));
    try {
      // 伪 TS（全 0x47）：嗅探放行进入 mux.js；垃圾包不产出有效媒体数据，
      // 由既有 empty_output 终检兜底（计划预测 transmux_failed，实测 mux.js
      // 对垃圾包静默不产数据——两者均为既有路径，核心断言是非嗅探 reason，
      // 证明嗅探未误杀 TS 容器）
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, Buffer.alloc(188, 0x47));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out }),
        (err) => {
          assert.ok(
            err.reason !== 'unsupported_container' && err.reason !== 'encrypted_stream',
            `TS 分片不得被嗅探拒绝（实际 reason=${err.reason}）`
          );
          assert.strictEqual(err.reason, 'empty_output');
          return true;
        }
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('shouldCancel=true + 任意占位分片仍 reason=cancelled（取消先于嗅探，44-08 契约回归）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-cancel2-'));
    try {
      // 占位内容刻意用 fMP4 特征：若嗅探先于取消检查，此处会误报 unsupported_container
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, Buffer.from('moofplaceholder'));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out, shouldCancel: () => true }),
        (err) => err.reason === 'cancelled'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('main.js CONVERT_FAIL_TEXT 覆盖三个新 reason（任务页文案不落「未知原因」）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    for (const reason of ['unsupported_container', 'encrypted_stream', 'empty_output']) {
      assert.ok(
        src.includes(`${reason}: '`),
        `main.js CONVERT_FAIL_TEXT 缺少 ${reason} 文案映射`
      );
    }
  });
});

describe('G-44-7 产物泄漏回归（异步 open 竞态修复）', () => {
  // 复现窗口：旧实现 createWriteStream 的 open(O_CREAT) 经 nextTick 排队，
  // fail() 同 tick unlinkSync 命中 ENOENT 被吞掉，随后排队的 open() 创建 0 字节
  // 残留。修复后产物经 openSync 同步创建，fail() 的 unlink 必然命中——
  // 延迟 ≥100ms 再断言（等任何潜在排队 open 落地）才能检出回归。
  const DELAYED_LEAK_CHECK_MS = 100;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  test('密文分片 reject 后产物不存在（含事件循环延迟 100ms 后仍不存在）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-g447-enc-'));
    try {
      // 高熵载荷构造同 G-44-4b describe：首字节固定非 0x47，再生循环规避
      // 随机撞 fMP4 box 特征 ASCII（测试须确定性）
      let payload;
      do {
        payload = crypto.randomBytes(4096);
        payload[0] = 0xaa;
      } while (['ftyp', 'styp', 'moof', 'moov', 'sidx'].some((t) => payload.includes(Buffer.from(t, 'ascii'))));
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, payload);
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out }),
        (err) => err.reason === 'encrypted_stream'
      );
      // 延迟检查：旧竞态下排队的 open() 在 reject 后的事件循环才创建 0 字节文件
      await delay(DELAYED_LEAK_CHECK_MS);
      assert.strictEqual(fs.existsSync(out), false, '密文拒转 100ms 后产物文件仍不得存在（0 字节泄漏回归）');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('协作式取消 reject 后产物不存在（含事件循环延迟 100ms 后仍不存在）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-g447-cancel-'));
    try {
      // 有效 TS 同步字节分片（0x47 开头）：取消检查先于嗅探/push 触发，
      // 分片内容不会进入 mux.js
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, Buffer.alloc(188, 0x47));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out, shouldCancel: () => true }),
        (err) => err.reason === 'cancelled'
      );
      await delay(DELAYED_LEAK_CHECK_MS);
      assert.strictEqual(fs.existsSync(out), false, '取消 100ms 后产物文件仍不得存在（0 字节泄漏回归）');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

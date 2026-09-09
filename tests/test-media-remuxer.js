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
 * G-45-2 tfdt 时间轴 rebase：rebaseFmp4SegmentTfdt walker 单测（v1 epoch
 * 基线归零/递减排差/双轨独立基线/v0 兼容/等长原位改写/多 moof/零基线恒等/
 * 畸形容忍）与 concatFmp4ToMp4 产物级断言（首片 tfdt=0、双轨归零、
 * init 段逐位一致、零基线产物字节精确相等）。
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
const muxjs = require('mux.js');

// ---------------------------------------------------------------------------
// fMP4 测试夹具（mux.js mp4.generator 确定性生成，仓库无 fixtures 目录先例——
// Phase 45 RESEARCH Q6）：makeInit() 生成 ftyp+moov init 分片（probe 可解析）；
// makeFmp4Segment() 生成单文件内两个 moof+mdat 对、无 styp/ftyp 的分片文件
// （复刻 B 站直播实测的多 moof 形态）。
// ---------------------------------------------------------------------------

/** 夹具视频轨（mux.js generator initSegment 需要合法 sps/pps 字节） */
const FMP4_VIDEO_TRACK = {
  id: 1,
  type: 'video',
  codec: 'avc',
  width: 640,
  height: 360,
  timescale: 90000,
  duration: 0,
  pps: [new Uint8Array([0x68, 0xee, 0x3c, 0x80])],
  sps: [new Uint8Array([0x67, 0x64, 0x00, 0x1f, 0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x03, 0x03, 0x20, 0xf1, 0x83, 0x19, 0x60])],
};

/** 夹具音频轨（id 2、48kHz AAC——mux.js generator esds/moov 需要的最小字段） */
const FMP4_AUDIO_TRACK = {
  id: 2,
  type: 'audio',
  codec: 'mp4a',
  timescale: 48000,
  duration: 0,
  audioobjecttype: 2,
  samplingfrequencyindex: 3, // 48kHz（ISO/IEC 13818-7 Table 35）
  channelcount: 2,
  samplerate: 48000,
};

/** init 分片夹具：ftyp + moov（mux.js probe 可解析，~676 字节） */
function makeInit() {
  return Buffer.from(muxjs.mp4.generator.initSegment([FMP4_VIDEO_TRACK]));
}

/** 双轨 init 分片夹具：ftyp + moov（视频轨 1 + 音频轨 2） */
function makeDualTrackInit() {
  return Buffer.from(muxjs.mp4.generator.initSegment([FMP4_VIDEO_TRACK, FMP4_AUDIO_TRACK]));
}

/** 视频样本模板（videoTrun 需要 flags/compositionTimeOffset） */
function makeVideoSample() {
  return {
    size: 100,
    duration: 3000,
    compositionTimeOffset: 0,
    flags: { isLeading: 0, dependsOn: 2, isDependedOn: 0, hasRedundancy: 0, degradationPriority: 0, isNonSyncSample: 0 },
  };
}

/**
 * 单个 moof+mdat 对（payload 100 字节）。
 * opts.track='audio' 用音频轨夹具；opts.baseMediaDecodeTime 注入 tfdt v1
 * 64 位值（epoch 级大数复刻 B 站直播形态；默认不传 → mux.js 生成 0 值
 * tfdt，保持既有用例零改动）。
 */
function makeFragment(seq, opts) {
  const options = opts || {};
  const isAudio = options.track === 'audio';
  const track = Object.assign({}, isAudio ? FMP4_AUDIO_TRACK : FMP4_VIDEO_TRACK, {
    samples: [isAudio ? { size: 100, duration: 2048 } : makeVideoSample()],
  });
  if (options.baseMediaDecodeTime !== undefined) {
    track.baseMediaDecodeTime = options.baseMediaDecodeTime;
  }
  const payload = new Uint8Array(100).fill(seq & 0xff);
  return Buffer.concat([
    Buffer.from(muxjs.mp4.generator.moof(seq, [track])),
    Buffer.from(muxjs.mp4.generator.mdat(payload)),
  ]);
}

/** 双轨 moof+mdat 对（B 站直播形态：同一 moof 内视频 traf + 音频 traf，各自 tfdt 基线） */
function makeDualTrackFragment(seq, videoBase, audioBase) {
  const videoTrack = Object.assign({}, FMP4_VIDEO_TRACK, {
    baseMediaDecodeTime: videoBase,
    samples: [makeVideoSample()],
  });
  const audioTrack = Object.assign({}, FMP4_AUDIO_TRACK, {
    baseMediaDecodeTime: audioBase,
    samples: [{ size: 80, duration: 2048 }],
  });
  const payload = new Uint8Array(180).fill(seq & 0xff);
  return Buffer.concat([
    Buffer.from(muxjs.mp4.generator.moof(seq, [videoTrack, audioTrack])),
    Buffer.from(muxjs.mp4.generator.mdat(payload)),
  ]);
}

/** 手工构造 v0 tfdt 的 moof（moof{mfhd, traf{tfhd, tfdt v0}}）——按 box 布局拼字节 */
function makeV0TfdtMoof(trackId, baseMediaDecodeTime) {
  const mfhd = Buffer.alloc(16);
  mfhd.writeUInt32BE(16, 0);
  mfhd.write('mfhd', 4, 'ascii');
  mfhd.writeUInt32BE(1, 12); // version+flags 全 0，sequence_number=1

  const tfhd = Buffer.alloc(16);
  tfhd.writeUInt32BE(16, 0);
  tfhd.write('tfhd', 4, 'ascii');
  tfhd.writeUInt32BE(trackId, 12); // version+flags=0（无可选字段）+ track_ID

  const tfdt = Buffer.alloc(16);
  tfdt.writeUInt32BE(16, 0);
  tfdt.write('tfdt', 4, 'ascii');
  tfdt.writeUInt32BE(baseMediaDecodeTime, 12); // version=0+flags=0+32 位值

  const box = (type, body) => {
    const b = Buffer.alloc(8 + body.length);
    b.writeUInt32BE(8 + body.length, 0);
    b.write(type, 4, 'ascii');
    body.copy(b, 8);
    return b;
  };
  return box('moof', Buffer.concat([mfhd, box('traf', Buffer.concat([tfhd, tfdt]))]));
}

/** 只读遍历 buffer 的 tfdt 值（mux.js probe.findBox 定位 traf 后配对 tfhd track_ID） */
function readTfdtValues(buf) {
  const trafs = muxjs.mp4.probe.findBox(buf, ['moof', 'traf']);
  const results = [];
  for (const traf of trafs) {
    const tfhd = muxjs.mp4.probe.findBox(traf, ['tfhd'])[0];
    if (!tfhd) continue;
    const trackId = tfhd[4] * 0x1000000 + tfhd[5] * 0x10000 + tfhd[6] * 0x100 + tfhd[7];
    for (const tfdt of muxjs.mp4.probe.findBox(traf, ['tfdt'])) {
      const version = tfdt[0];
      const value = version === 1
        ? Buffer.from(tfdt.buffer, tfdt.byteOffset + 4, 8).readBigUInt64BE(0)
        : tfdt[4] * 0x1000000 + tfdt[5] * 0x10000 + tfdt[6] * 0x100 + tfdt[7];
      results.push({ trackId, version, value });
    }
  }
  return results;
}

/** fMP4 分片文件夹具：单文件内两个 moof+mdat 对、无 styp/ftyp（B 站实测多 moof 形态） */
function makeFmp4Segment(seq) {
  return Buffer.concat([makeFragment(seq), makeFragment(seq + 1)]);
}

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

  test('fMP4 box 分片 + 无 initPath → reason=init_missing 且产物清理（D-06 分流语义）', async () => {
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
        (err) => err.reason === 'init_missing'
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

  test('main.js CONVERT_FAIL_TEXT 覆盖全部新 reason（任务页文案不落「未知原因」）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    // 45-02：扩 init_missing/invalid_init（45-01 fMP4 拼接链路产生的两个新 reason 文案闭环）
    for (const reason of ['unsupported_container', 'encrypted_stream', 'empty_output', 'init_missing', 'invalid_init']) {
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

describe('AES-128 解密转换（加密 HLS 缓存条目，G-44-7 后续）', () => {
  const KEY = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const IV = Buffer.from('00000000000000000000000000000001', 'hex');

  /** 用 aes-128-cbc（PKCS7）加密明文分片 */
  function encryptSegment(plain, key, iv) {
    const c = crypto.createCipheriv('aes-128-cbc', key, iv);
    return Buffer.concat([c.update(plain), c.final()]);
  }

  test('固定 IV 解密链路：密文分片解密后过嗅探进入 mux.js（错误语义落 empty_output 而非 encrypted_stream）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-aes-'));
    try {
      // 伪 TS（0x47 填充，4 个包）加密成密文分片；解密后首字节 0x47 → 嗅探放行，
      // 垃圾包 mux.js 不产数据 → 既有 empty_output 终检兜底。核心断言：不被
      // encrypted_stream/unsupported_container 拒转（密文未被错杀，解密确实发生）
      const seg = path.join(dir, 'seg0.ts');
      fs.writeFileSync(seg, encryptSegment(Buffer.alloc(188 * 4, 0x47), KEY, IV));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({
          segmentPaths: [seg],
          outputPath: out,
          decryption: { keyHex: KEY.toString('hex'), ivHex: IV.toString('hex') },
        }),
        (err) => {
          assert.strictEqual(err.reason, 'empty_output', `解密后应过嗅探（实际 reason=${err.reason}）`);
          return true;
        }
      );
      assert.strictEqual(fs.existsSync(out), false, '失败路径产物清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('无 IV 属性时按分片 seq 推导 IV（mediaSequence 大端序，RFC 8216 §5.2）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-aes-seq-'));
    try {
      // 清单 MEDIA-SEQUENCE=7：首分片 IV = 16 字节大端序 7
      const seqIv = Buffer.alloc(16, 0);
      seqIv.writeBigUInt64BE(7n, 8);
      const seg = path.join(dir, 'seg0.ts');
      fs.writeFileSync(seg, encryptSegment(Buffer.alloc(188 * 4, 0x47), KEY, seqIv));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({
          segmentPaths: [seg],
          outputPath: out,
          decryption: { keyHex: KEY.toString('hex'), mediaSequence: 7 },
        }),
        (err) => {
          assert.strictEqual(err.reason, 'empty_output', `seq 推导 IV 应正确解密（实际 reason=${err.reason}）`);
          return true;
        }
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('密钥长度非法 → reason=decrypt_failed 且产物清理', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-aes-badkey-'));
    try {
      const seg = path.join(dir, 'seg0.ts');
      fs.writeFileSync(seg, encryptSegment(Buffer.alloc(188 * 4, 0x47), KEY, IV));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({
          segmentPaths: [seg],
          outputPath: out,
          decryption: { keyHex: 'abcd', ivHex: IV.toString('hex') },
        }),
        (err) => err.reason === 'decrypt_failed'
      );
      assert.strictEqual(fs.existsSync(out), false, 'decrypt_failed 产物清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('错误密钥解密出垃圾 → 嗅探原路径拒转（绝不产出文件）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-aes-wrongkey-'));
    try {
      const seg = path.join(dir, 'seg0.ts');
      fs.writeFileSync(seg, encryptSegment(Buffer.alloc(188 * 4, 0x47), KEY, IV));
      const out = path.join(dir, 'out.mp4');
      const wrongKey = Buffer.from('ffeeddccbbaa99887766554433221100', 'hex');
      // 错密钥 CBC 仍解出字节流（高熵垃圾）：不预言具体 reason（encrypted_stream/
      // unsupported_container/decrypt_failed 均为显式拒转），核心断言是绝不产出文件
      await assert.rejects(
        () => remuxer.convertToMp4({
          segmentPaths: [seg],
          outputPath: out,
          decryption: { keyHex: wrongKey.toString('hex'), ivHex: IV.toString('hex') },
        }),
        (err) => {
          assert.ok(
            ['encrypted_stream', 'unsupported_container', 'decrypt_failed', 'empty_output'].includes(err.reason),
            `错密钥不得静默产出（实际 reason=${err.reason}）`
          );
          return true;
        }
      );
      assert.strictEqual(fs.existsSync(out), false, '错密钥转换不得残留产物');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('main.js CONVERT_FAIL_TEXT 覆盖 key_unavailable/decrypt_failed（任务页文案不落「未知原因」）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    for (const reason of ['key_unavailable', 'decrypt_failed']) {
      assert.ok(
        src.includes(`${reason}: '`),
        `main.js CONVERT_FAIL_TEXT 缺少 ${reason} 文案映射`
      );
    }
  });
});
describe('rebaseFmp4SegmentTfdt tfdt 时间轴 rebase walker（G-45-2）', () => {
  const EPOCH_BASE = 160000000000000; // 1.6e14 epoch 级大数（90kHz 直播绝对时刻）
  const AUDIO_EPOCH_BASE = 85000000000000; // 8.5e13（48kHz 音频轨基线）

  test('导出为函数', () => {
    assert.strictEqual(typeof remuxer.rebaseFmp4SegmentTfdt, 'function');
  });

  test('v1 大数基线归零：epoch 级 tfdt 改写为 0，基线以 BigInt 记入 baselines', () => {
    const buf = makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE });
    const baselines = new Map();
    const n = remuxer.rebaseFmp4SegmentTfdt(buf, baselines);
    assert.strictEqual(n, 1, '改写计数 = 1');
    const tfdts = readTfdtValues(buf);
    assert.strictEqual(tfdts.length, 1);
    assert.strictEqual(tfdts[0].version, 1);
    assert.strictEqual(tfdts[0].value, 0n, '首片 tfdt 应归零');
    assert.strictEqual(baselines.get(1), BigInt(EPOCH_BASE), 'v1 基线存 BigInt 防 64 位精度溢出');
  });

  test('后续递减排差：第二片 tfdt = 基线+270000 → 改写为 270000 不为 0', () => {
    const baselines = new Map();
    remuxer.rebaseFmp4SegmentTfdt(makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE }), baselines);
    const buf2 = makeFragment(2, { baseMediaDecodeTime: EPOCH_BASE + 270000 }); // +3s @90kHz
    const n = remuxer.rebaseFmp4SegmentTfdt(buf2, baselines);
    assert.strictEqual(n, 1);
    assert.strictEqual(readTfdtValues(buf2)[0].value, 270000n);
  });

  test('双轨独立基线：视频 1.6e14 / 音频 8.5e13 各自减各自基线，同 buffer 多 traf 互不串轨', () => {
    const baselines = new Map();
    const buf = makeDualTrackFragment(1, EPOCH_BASE, AUDIO_EPOCH_BASE);
    const n = remuxer.rebaseFmp4SegmentTfdt(buf, baselines);
    assert.strictEqual(n, 2, '同 moof 两个 traf 的 tfdt 都被改写');
    const tfdts = readTfdtValues(buf);
    assert.strictEqual(tfdts.length, 2);
    assert.strictEqual(tfdts.find((t) => t.trackId === 1).value, 0n, '视频轨首片归零');
    assert.strictEqual(tfdts.find((t) => t.trackId === 2).value, 0n, '音频轨首片归零');
    assert.strictEqual(baselines.get(1), BigInt(EPOCH_BASE));
    assert.strictEqual(baselines.get(2), BigInt(AUDIO_EPOCH_BASE));
    // 第二片：各轨递减排差（视频 +3s@90kHz，音频 +3s@48kHz）
    const buf2 = makeDualTrackFragment(2, EPOCH_BASE + 270000, AUDIO_EPOCH_BASE + 144000);
    remuxer.rebaseFmp4SegmentTfdt(buf2, baselines);
    const t2 = readTfdtValues(buf2);
    assert.strictEqual(t2.find((t) => t.trackId === 1).value, 270000n);
    assert.strictEqual(t2.find((t) => t.trackId === 2).value, 144000n);
  });

  test('v0 兼容：32 位 tfdt 原位改写为 0，box size 字段与总长度不变', () => {
    const buf = makeV0TfdtMoof(1, 400000);
    const lenBefore = buf.length;
    const moofSizeBefore = buf.readUInt32BE(0);
    const baselines = new Map();
    const n = remuxer.rebaseFmp4SegmentTfdt(buf, baselines);
    assert.strictEqual(n, 1);
    assert.strictEqual(buf.length, lenBefore, 'buffer 总长度不变');
    assert.strictEqual(buf.readUInt32BE(0), moofSizeBefore, 'moof size 字段不变');
    const tfdts = readTfdtValues(buf);
    assert.strictEqual(tfdts[0].version, 0);
    assert.strictEqual(tfdts[0].value, 0);
    assert.strictEqual(baselines.get(1), 400000, 'v0 基线存 Number');
  });

  test('等长原位改写：除 tfdt 值域外其余字节逐位不变（mdat/mfhd/tfhd/trun 不动）', () => {
    const buf = makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE });
    const original = Buffer.from(buf);
    // tfdt box 布局：size(4) type(4) version(1) flags(3) value(8) —— 值域 = 'tfdt' 串起始 +8 起 8 字节
    const tfdtIdx = buf.indexOf(Buffer.from('tfdt', 'ascii'));
    assert.ok(tfdtIdx !== -1, '夹具应含 tfdt box');
    const valueStart = tfdtIdx + 8;
    const valueEnd = valueStart + 8;
    remuxer.rebaseFmp4SegmentTfdt(buf, new Map());
    assert.strictEqual(buf.length, original.length, 'buffer 长度不变（等长改写）');
    for (let i = 0; i < original.length; i++) {
      if (i >= valueStart && i < valueEnd) continue;
      assert.strictEqual(buf[i], original[i], `偏移 ${i} 字节不应被改写（仅 tfdt 值域可变）`);
    }
  });

  test('多 moof 单 buffer：一个分片内 2 个 moof+mdat 对都被处理（B 站 1s 分片多 moof 形态）', () => {
    const buf = Buffer.concat([
      makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE }),
      makeFragment(2, { baseMediaDecodeTime: EPOCH_BASE + 90000 }),
    ]);
    const n = remuxer.rebaseFmp4SegmentTfdt(buf, new Map());
    assert.strictEqual(n, 2, '两个 moof 的 tfdt 都被改写');
    assert.deepStrictEqual(readTfdtValues(buf).map((t) => t.value), [0n, 90000n]);
  });

  test('基线为 0 恒等：首片 tfdt 已是 0 → 全 buffer 字节逐位不变（既有字节相等用例的保证）', () => {
    const buf = makeFmp4Segment(1); // 既有夹具：不传 baseMediaDecodeTime，mux.js 生成 0 值 tfdt
    const original = Buffer.from(buf);
    remuxer.rebaseFmp4SegmentTfdt(buf, new Map());
    assert.strictEqual(Buffer.compare(buf, original), 0, '零基线分片应字节逐位不变');
  });

  test('畸形容忍：截断 box/非法 size/未知 box/无 tfdt 均不抛异常，能定位的 tfdt 照常改写', () => {
    const good = makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE });

    // ① box size 声明超出 buffer 剩余 → 停止该层遍历不抛
    const truncated = Buffer.from(good);
    truncated.writeUInt32BE(0x7fffffff, 0);
    assert.doesNotThrow(() => remuxer.rebaseFmp4SegmentTfdt(truncated, new Map()));

    // ② size < 8 → 停止不抛
    const tinySize = Buffer.from(good);
    tinySize.writeUInt32BE(4, 0);
    assert.doesNotThrow(() => remuxer.rebaseFmp4SegmentTfdt(tinySize, new Map()));

    // ③ size==1 largesize 未知 box 在前 → 跳过后 moof 照常改写
    const large = Buffer.alloc(24);
    large.writeUInt32BE(1, 0);
    large.write('sidx', 4, 'ascii');
    large.writeBigUInt64BE(24n, 8); // largesize = 24
    const withLarge = Buffer.concat([large, good]);
    const baselines3 = new Map();
    assert.strictEqual(remuxer.rebaseFmp4SegmentTfdt(withLarge, baselines3), 1, 'largesize box 后的 moof 照常处理');
    // mux.js findBox 不认 largesize（测试 helper 限制），直接按 box 布局读回 tfdt 值域
    const tfdtIdx3 = withLarge.indexOf(Buffer.from('tfdt', 'ascii'));
    assert.strictEqual(withLarge.readBigUInt64BE(tfdtIdx3 + 8), 0n, 'tfdt 已归零');

    // ④ 未知 box 类型（sidx/emsg）包围 moof → 跳过未知、moof 照常改写
    const sidx = Buffer.alloc(16);
    sidx.writeUInt32BE(16, 0);
    sidx.write('sidx', 4, 'ascii');
    const emsg = Buffer.alloc(16);
    emsg.writeUInt32BE(16, 0);
    emsg.write('emsg', 4, 'ascii');
    const wrapped = Buffer.concat([sidx, makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE }), emsg]);
    assert.strictEqual(remuxer.rebaseFmp4SegmentTfdt(wrapped, new Map()), 1);
    assert.strictEqual(readTfdtValues(wrapped)[0].value, 0n);

    // ⑤ traf 内无 tfdt → 不抛、不改写、不记录基线
    const mfhd = Buffer.alloc(16);
    mfhd.writeUInt32BE(16, 0);
    mfhd.write('mfhd', 4, 'ascii');
    const tfhd = Buffer.alloc(16);
    tfhd.writeUInt32BE(16, 0);
    tfhd.write('tfhd', 4, 'ascii');
    tfhd.writeUInt32BE(1, 12);
    const trafLen = 8 + tfhd.length;
    const traf = Buffer.alloc(trafLen);
    traf.writeUInt32BE(trafLen, 0);
    traf.write('traf', 4, 'ascii');
    tfhd.copy(traf, 8);
    const moofLen = 8 + mfhd.length + traf.length;
    const noTfdt = Buffer.alloc(moofLen);
    noTfdt.writeUInt32BE(moofLen, 0);
    noTfdt.write('moof', 4, 'ascii');
    mfhd.copy(noTfdt, 8);
    traf.copy(noTfdt, 8 + mfhd.length);
    const baselines5 = new Map();
    assert.doesNotThrow(() => remuxer.rebaseFmp4SegmentTfdt(noTfdt, baselines5));
    assert.strictEqual(remuxer.rebaseFmp4SegmentTfdt(noTfdt, baselines5), 0);
    assert.strictEqual(baselines5.size, 0, '无 tfdt 不记录基线');
  });

  test('当前值 < 基线的异常形态（分片乱序/时钟回拨）保守不改写，原样保留', () => {
    const baselines = new Map();
    remuxer.rebaseFmp4SegmentTfdt(makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE }), baselines);
    const stale = makeFragment(2, { baseMediaDecodeTime: EPOCH_BASE - 90000 });
    const original = Buffer.from(stale);
    const n = remuxer.rebaseFmp4SegmentTfdt(stale, baselines);
    assert.strictEqual(n, 0, '回拨分片不改写');
    assert.strictEqual(Buffer.compare(stale, original), 0, '回拨分片字节原样保留');
  });
});

describe('concatFmp4ToMp4 拼接执行体（D-01/D-07 纯字节拼接）', () => {
  test('init + 两多 moof 分片 → 产物字节 = init+seg1+seg2 精确相等；probe 检出 moov 且 moof 计数 ≥4；onProgress 异常不阻断', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-'));
    try {
      const initBuf = makeInit();
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, initBuf);
      const b1 = makeFmp4Segment(1);
      const b2 = makeFmp4Segment(3);
      const seg1 = path.join(dir, 'seg1.m4s');
      const seg2 = path.join(dir, 'seg2.m4s');
      fs.writeFileSync(seg1, b1);
      fs.writeFileSync(seg2, b2);
      const out = path.join(dir, 'out.mp4');
      const r = await remuxer.concatFmp4ToMp4({
        initPath,
        segmentPaths: [seg1, seg2],
        outputPath: out,
        // 进度回调异常不阻断拼接（执行体契约第⑤件）
        onProgress: () => { throw new Error('progress boom'); },
      });
      assert.strictEqual(r.outputPath, out);
      assert.strictEqual(r.segments, 2);
      const produced = fs.readFileSync(out);
      assert.strictEqual(
        Buffer.compare(produced, Buffer.concat([initBuf, b1, b2])), 0,
        '产物 = init 在前 + 分片按播放序原样字节拼接（不解析 moof/trun 内部）'
      );
      // 终检同款的 mux.js probe 断言：moov 存在 + moof 计数 ≥ 分片内 moof 总数（4）
      assert.ok(muxjs.mp4.probe.findBox(produced, ['moov']).length >= 1, '产物应含 moov');
      assert.ok(muxjs.mp4.probe.findBox(produced, ['moof']).length >= 4, '产物 moof 计数应 ≥ 分片内 moof 总数');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('单分片文件内含多个 moof+mdat 对（B 站实测形态）→ 原样通过不解析不拆箱', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-multi-'));
    try {
      const initBuf = makeInit();
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, initBuf);
      const b1 = makeFmp4Segment(1); // 单文件两个 moof+mdat 对
      const seg1 = path.join(dir, 'seg1.m4s');
      fs.writeFileSync(seg1, b1);
      const out = path.join(dir, 'out.mp4');
      await remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg1], outputPath: out });
      assert.strictEqual(Buffer.compare(fs.readFileSync(out), Buffer.concat([initBuf, b1])), 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('initPath 缺失/不可读 → reason=init_missing 且不创建产物', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-noinit-'));
    try {
      const seg = path.join(dir, 'seg.m4s');
      fs.writeFileSync(seg, makeFmp4Segment(1));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.concatFmp4ToMp4({ initPath: path.join(dir, 'no-such-init'), segmentPaths: [seg], outputPath: out }),
        (err) => err.reason === 'init_missing'
      );
      await assert.rejects(
        () => remuxer.concatFmp4ToMp4({ segmentPaths: [seg], outputPath: out }),
        (err) => err.reason === 'init_missing'
      );
      assert.strictEqual(fs.existsSync(out), false, 'init_missing 拒转不得残留产物');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('init 前 8 字节非 size+ftyp → reason=invalid_init 且产物清理', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-badinit-'));
    try {
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, Buffer.from('not-an-init-segment-at-all'));
      const seg = path.join(dir, 'seg.m4s');
      fs.writeFileSync(seg, makeFmp4Segment(1));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg], outputPath: out }),
        (err) => err.reason === 'invalid_init'
      );
      assert.strictEqual(fs.existsSync(out), false, 'invalid_init 拒转后产物清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('空分片列表 → reason=no_segments', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-noseg-'));
    try {
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, makeInit());
      await assert.rejects(
        () => remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [], outputPath: path.join(dir, 'out.mp4') }),
        (err) => err.reason === 'no_segments'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('shouldCancel 中途为 true → reason=cancelled 且半成品清理', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-cancel-'));
    try {
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, makeInit());
      const seg1 = path.join(dir, 'seg1.m4s');
      const seg2 = path.join(dir, 'seg2.m4s');
      fs.writeFileSync(seg1, makeFmp4Segment(1));
      fs.writeFileSync(seg2, makeFmp4Segment(3));
      const out = path.join(dir, 'out.mp4');
      let calls = 0;
      await assert.rejects(
        () => remuxer.concatFmp4ToMp4({
          initPath,
          segmentPaths: [seg1, seg2],
          outputPath: out,
          shouldCancel: () => ++calls > 1,
        }),
        (err) => err.reason === 'cancelled'
      );
      assert.strictEqual(fs.existsSync(out), false, '取消后半成品产物应被清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('毒分片（m3u8 清单文本混入）→ 跳过不写入，产物 = init + 合法分片字节，skipped 计数', async () => {
    // 纵深防御回归：录制侧落盘的 CDN 毒应答（分片请求返回 #EXTM3U 清单，
    // B 站直播实测）混进拼接流会中断产物 fMP4 解析——必须跳过而非写入
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-poison-'));
    try {
      const initBuf = makeInit();
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, initBuf);
      const b1 = makeFmp4Segment(1);
      const b2 = makeFmp4Segment(3);
      const seg1 = path.join(dir, 'seg1.m4s');
      const poison = path.join(dir, 'poison.ts');
      const seg2 = path.join(dir, 'seg2.m4s');
      fs.writeFileSync(seg1, b1);
      fs.writeFileSync(poison, Buffer.from('#EXTM3U\n#EXT-X-VERSION:7\n#EXTINF:1.00,\n1788862934.m4s\n'));
      fs.writeFileSync(seg2, b2);
      const out = path.join(dir, 'out.mp4');
      const r = await remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg1, poison, seg2], outputPath: out });
      assert.strictEqual(r.segments, 2, '毒分片不计入写入数');
      assert.strictEqual(r.skipped, 1, '毒分片计入跳过数');
      assert.strictEqual(
        Buffer.compare(fs.readFileSync(out), Buffer.concat([initBuf, b1, b2])), 0,
        '产物 = init + 两个合法分片，毒分片字节不出现'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('全部为毒分片 → 产物仅剩 init（无 moof）→ reason=empty_output 且清理', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-concat-allpoison-'));
    try {
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, makeInit());
      const poison = path.join(dir, 'poison.ts');
      fs.writeFileSync(poison, Buffer.from('#EXTM3U\n#EXT-X-VERSION:7\n'));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [poison], outputPath: out }),
        (err) => err.reason === 'empty_output'
      );
      assert.strictEqual(fs.existsSync(out), false, 'empty_output 后产物应被清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('isFmp4Fragment 嗅探：moof/styp/ftyp 放行，#EXTM3U/越界 size/过短/非 box 拒绝', () => {
    assert.strictEqual(remuxer.isFmp4Fragment(makeFmp4Segment(1)), true, '合法分片放行');
    const styp = Buffer.alloc(16);
    styp.writeUInt32BE(16, 0);
    styp.write('styp', 4, 'ascii');
    assert.strictEqual(remuxer.isFmp4Fragment(styp), true, 'styp box 放行');
    assert.strictEqual(remuxer.isFmp4Fragment(Buffer.from('#EXTM3U\n#EXT-X-VERSION:7\n')), false, '清单文本拒绝');
    const oob = Buffer.alloc(16);
    oob.writeUInt32BE(0x1000, 0); // 声明 size 远超实际长度
    oob.write('moof', 4, 'ascii');
    assert.strictEqual(remuxer.isFmp4Fragment(oob), false, 'size 越界拒绝');
    assert.strictEqual(remuxer.isFmp4Fragment(Buffer.alloc(4)), false, '过短拒绝');
    const notBox = Buffer.alloc(16);
    notBox.writeUInt32BE(16, 0);
    notBox.write('xxxx', 4, 'ascii');
    assert.strictEqual(remuxer.isFmp4Fragment(notBox), false, '非白名单 box 拒绝');
  });
});

describe('concatFmp4ToMp4 tfdt rebase 集成（G-45-2 产物时间轴归零）', () => {
  const EPOCH_BASE = 160000000000000; // 1.6e14（90kHz 视频轨直播绝对时刻）
  const AUDIO_EPOCH_BASE = 85000000000000; // 8.5e13（48kHz 音频轨）

  test('大数 tfdt 分片产物：首个 moof 首 tfdt == 0、后续递减排差；init 段与输入逐位一致', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-rebase-'));
    try {
      const initBuf = makeInit();
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, initBuf);
      // seg1：单文件两个 moof（B 站多 moof 形态）BASE / BASE+270000（+3s@90kHz）
      const b1 = Buffer.concat([
        makeFragment(1, { baseMediaDecodeTime: EPOCH_BASE }),
        makeFragment(2, { baseMediaDecodeTime: EPOCH_BASE + 270000 }),
      ]);
      // seg2：单 moof BASE+540000
      const b2 = makeFragment(3, { baseMediaDecodeTime: EPOCH_BASE + 540000 });
      const seg1 = path.join(dir, 'seg1.m4s');
      const seg2 = path.join(dir, 'seg2.m4s');
      fs.writeFileSync(seg1, b1);
      fs.writeFileSync(seg2, b2);
      const out = path.join(dir, 'out.mp4');
      const r = await remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg1, seg2], outputPath: out });
      assert.strictEqual(r.segments, 2);
      const produced = fs.readFileSync(out);
      // init 段逐位一致（不修 moov prohibition 的可执行断言）
      assert.ok(
        produced.subarray(0, initBuf.length).equals(initBuf),
        '产物 init 段应与输入 init 文件逐位一致（不修 moov/mvhd）'
      );
      // 产物级主断言：walker 只读遍历逐 tfdt 断言首片归零 + 递减排差
      const tfdts = readTfdtValues(produced);
      assert.strictEqual(tfdts.length, 3, '产物应含 3 个 moof 的 tfdt');
      assert.deepStrictEqual(
        tfdts.map((t) => t.value),
        [0n, 270000n, 540000n],
        '首个 moof 首 tfdt == 0，后续为原值 − 该轨基线的递减排差'
      );
      assert.ok(tfdts.every((t) => t.version === 1), 'tfdt 均为 v1（64 位 BigInt 路径）');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('双轨产物：initSegment([video, audio]) + 双轨分片 → 两轨首 tfdt 均归 0、各自递减排差', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-rebase-dual-'));
    try {
      const initBuf = makeDualTrackInit();
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, initBuf);
      const b1 = makeDualTrackFragment(1, EPOCH_BASE, AUDIO_EPOCH_BASE);
      const b2 = makeDualTrackFragment(2, EPOCH_BASE + 270000, AUDIO_EPOCH_BASE + 144000);
      const seg1 = path.join(dir, 'seg1.m4s');
      const seg2 = path.join(dir, 'seg2.m4s');
      fs.writeFileSync(seg1, b1);
      fs.writeFileSync(seg2, b2);
      const out = path.join(dir, 'out.mp4');
      await remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg1, seg2], outputPath: out });
      const produced = fs.readFileSync(out);
      assert.ok(produced.subarray(0, initBuf.length).equals(initBuf), '双轨产物 init 段逐位一致');
      const tfdts = readTfdtValues(produced);
      assert.strictEqual(tfdts.length, 4, '两片双轨共 4 个 tfdt');
      const byTrack = (id) => tfdts.filter((t) => t.trackId === id).map((t) => t.value);
      assert.deepStrictEqual(byTrack(1), [0n, 270000n], '视频轨首片归零 + 排差');
      assert.deepStrictEqual(byTrack(2), [0n, 144000n], '音频轨首片归零 + 排差（独立基线不串轨）');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('零回归恒等：零基线分片（既有夹具）产物字节 = init+seg1+seg2 精确相等', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-rebase-identity-'));
    try {
      const initBuf = makeInit();
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, initBuf);
      const b1 = makeFmp4Segment(1); // 不传 baseMediaDecodeTime → 0 值 tfdt
      const b2 = makeFmp4Segment(3);
      const seg1 = path.join(dir, 'seg1.m4s');
      const seg2 = path.join(dir, 'seg2.m4s');
      fs.writeFileSync(seg1, b1);
      fs.writeFileSync(seg2, b2);
      const out = path.join(dir, 'out.mp4');
      await remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg1, seg2], outputPath: out });
      assert.strictEqual(
        Buffer.compare(fs.readFileSync(out), Buffer.concat([initBuf, b1, b2])), 0,
        'tfdt 基线为 0 的流产物应与原字节逐位一致（VOD/已对齐来源零回归）'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('convertToMp4 fMP4 嗅探分流（D-06）', () => {
  test('fMP4 分片 + initPath → 走拼接分支 resolve，产物字节 = init+分片，probe 终检通过', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-divert-'));
    try {
      const initBuf = makeInit();
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, initBuf);
      const b1 = makeFmp4Segment(1);
      const b2 = makeFmp4Segment(3);
      const seg1 = path.join(dir, 'seg1.m4s');
      const seg2 = path.join(dir, 'seg2.m4s');
      fs.writeFileSync(seg1, b1);
      fs.writeFileSync(seg2, b2);
      const out = path.join(dir, 'out.mp4');
      const r = await remuxer.convertToMp4({ initPath, segmentPaths: [seg1, seg2], outputPath: out });
      assert.strictEqual(r.segments, 2);
      const produced = fs.readFileSync(out);
      assert.strictEqual(Buffer.compare(produced, Buffer.concat([initBuf, b1, b2])), 0, '分流后产物 = init+分片原样拼接');
      assert.ok(muxjs.mp4.probe.findBox(produced, ['moov']).length >= 1, '产物应含 moov');
      assert.ok(muxjs.mp4.probe.findBox(produced, ['moof']).length >= 4, '产物 moof 计数应 ≥4');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('TS 分片零回归：0x47 分片即使传 initPath 仍走 mux.js 既有路径（错误语义落 empty_output）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-divert-ts-'));
    try {
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, makeInit());
      const seg = path.join(dir, 'seg.ts');
      fs.writeFileSync(seg, Buffer.alloc(188, 0x47));
      const out = path.join(dir, 'out.mp4');
      await assert.rejects(
        () => remuxer.convertToMp4({ initPath, segmentPaths: [seg], outputPath: out }),
        (err) => err.reason === 'empty_output'
      );
      assert.strictEqual(fs.existsSync(out), false, 'TS 路径失败产物清理');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AVF 兼容（2026-09-09）：mux.js 把音频 moof 排在视频前，AVFoundation 对首
// moof 为音频轨的 fMP4 死等（mac 预览/QuickTime 打不开）。convertToMp4 经
// reorderVideoFirst 重排为视频 moof+mdat 组在前；concatFmp4ToMp4 终检附
// 非阻断 warn 诊断。
// ---------------------------------------------------------------------------

/** 音频 traf 在前的双轨 moof+mdat 对（异常形态夹具：traf 序 = 音频,视频） */
function makeAudioFirstDualTrackFragment(seq) {
  const videoTrack = Object.assign({}, FMP4_VIDEO_TRACK, {
    samples: [makeVideoSample()],
  });
  const audioTrack = Object.assign({}, FMP4_AUDIO_TRACK, {
    samples: [{ size: 80, duration: 2048 }],
  });
  const payload = new Uint8Array(180).fill(seq & 0xff);
  return Buffer.concat([
    Buffer.from(muxjs.mp4.generator.moof(seq, [audioTrack, videoTrack])),
    Buffer.from(muxjs.mp4.generator.mdat(payload)),
  ]);
}

describe('AVF 兼容：extractVideoTrackId / reorderVideoFirst / readFirstMoofTrackId', () => {
  test('extractVideoTrackId：双轨 init 解析出视频轨 id=1', () => {
    assert.strictEqual(remuxer.extractVideoTrackId(makeDualTrackInit()), 1);
    assert.strictEqual(remuxer.extractVideoTrackId(makeInit()), 1, '纯视频 init 同样解析');
  });

  test('extractVideoTrackId：畸形/空输入返回 null（调用方按无需重排处理）', () => {
    assert.strictEqual(remuxer.extractVideoTrackId(Buffer.alloc(0)), null);
    assert.strictEqual(remuxer.extractVideoTrackId(Buffer.from('not an mp4 at all, garbage bytes')), null);
    assert.strictEqual(remuxer.extractVideoTrackId(null), null);
  });

  test('reorderVideoFirst：音频组在前 → 重排为视频组在前（字节精确）', () => {
    const audioGroup = makeFragment(1, { track: 'audio' });
    const videoGroup = makeFragment(1);
    const combined = Buffer.concat([audioGroup, videoGroup]);
    const reordered = remuxer.reorderVideoFirst(combined, 1);
    assert.strictEqual(
      Buffer.compare(reordered, Buffer.concat([videoGroup, audioGroup])), 0,
      '产物应为视频 moof+mdat 组在前'
    );
  });

  test('reorderVideoFirst：已是视频在前 → 字节不变（幂等）', () => {
    const videoGroup = makeFragment(1);
    const audioGroup = makeFragment(1, { track: 'audio' });
    const combined = Buffer.concat([videoGroup, audioGroup]);
    const reordered = remuxer.reorderVideoFirst(combined, 1);
    assert.strictEqual(Buffer.compare(reordered, combined), 0);
  });

  test('reorderVideoFirst：单 moof/无视频轨/轨不在其中/畸形 → 原样返回不搞挂', () => {
    const videoGroup = makeFragment(1);
    // 单 moof 组（纯视频流形态）
    assert.strictEqual(Buffer.compare(remuxer.reorderVideoFirst(videoGroup, 1), videoGroup), 0);
    // videoTrackId = null（无视频轨）
    const av = Buffer.concat([makeFragment(1, { track: 'audio' }), makeFragment(1)]);
    assert.strictEqual(Buffer.compare(remuxer.reorderVideoFirst(av, null), av), 0);
    // videoTrackId 不在组中
    assert.strictEqual(Buffer.compare(remuxer.reorderVideoFirst(av, 999), av), 0);
    // 畸形：非 box 字节
    const garbage = Buffer.from('definitely not mp4 boxes........');
    assert.strictEqual(Buffer.compare(remuxer.reorderVideoFirst(garbage, 1), garbage), 0);
    // 尾部游离字节（组外数据）→ 原样
    const withTrailing = Buffer.concat([av, Buffer.from('trailing')]);
    assert.strictEqual(Buffer.compare(remuxer.reorderVideoFirst(withTrailing, 1), withTrailing), 0);
  });

  test('readFirstMoofTrackId：首 moof 首 traf 轨 ID 读取', () => {
    // 视频 traf 在前的双轨 moof（B 站形态）
    assert.strictEqual(remuxer.readFirstMoofTrackId(makeDualTrackFragment(1, 0, 0)), 1);
    // 音频 traf 在前（异常形态）
    assert.strictEqual(remuxer.readFirstMoofTrackId(makeAudioFirstDualTrackFragment(1)), 2);
    // 无 moof / 畸形 → null
    assert.strictEqual(remuxer.readFirstMoofTrackId(makeDualTrackInit()), null);
    assert.strictEqual(remuxer.readFirstMoofTrackId(Buffer.from('garbage garbage')), null);
  });
});

describe('AVF 兼容：zeroFragmentedMovieDurations / renumberFragmentSequence', () => {
  test('zeroFragmentedMovieDurations：init 段 mvhd/tkhd/mdhd 时长归零（mux.js 默认 0xFFFFFFFF）', () => {
    const init = makeDualTrackInit();
    // mux.js generator：mvhd 固定 0xffffffff；track.duration || 0xffffffff（夹具
    // 传 0 也回落 0xffffffff——0 是 falsy）→ 双轨 init 共 5 个 0xFFFFFFFF 时长字段
    const count = remuxer.zeroFragmentedMovieDurations(init);
    assert.strictEqual(count, 5, 'mvhd×1 + tkhd×2 + mdhd×2 共 5 个时长字段');
    // 归零后 probe 仍可解析
    assert.ok(muxjs.mp4.probe.findBox(init, ['moov']).length >= 1, '归零后 moov 仍可解析');
    // 逐 box 断言时长为 0：ASCII 定位 box type，v0 布局 duration 在 type 后第 20 字节
    // （version/flags(4)+创建(4)+修改(4)+timescale(4) 之后）
    const mvhdAt = init.indexOf('mvhd');
    assert.ok(mvhdAt > 0 && init.readUInt32BE(mvhdAt + 20) === 0, 'mvhd duration 已归零');
    let mdhdCount = 0;
    let scanFrom = 0;
    while (true) {
      const at = init.indexOf('mdhd', scanFrom);
      if (at < 0) break;
      assert.strictEqual(init.readUInt32BE(at + 20), 0, 'mdhd duration 已归零');
      mdhdCount++;
      scanFrom = at + 4;
    }
    assert.strictEqual(mdhdCount, 2, '双轨各一个 mdhd');
  });

  test('zeroFragmentedMovieDurations：非 Buffer/畸形输入返回 0 不 throw', () => {
    assert.strictEqual(remuxer.zeroFragmentedMovieDurations(null), 0);
    assert.strictEqual(remuxer.zeroFragmentedMovieDurations('not buffer'), 0);
    assert.strictEqual(remuxer.zeroFragmentedMovieDurations(Buffer.from('garbage bytes here!!')), 0);
  });

  test('renumberFragmentSequence：moof seq 原位改写为全局递增（等长改写其余字节不动）', () => {
    const fragA = makeFragment(0, { track: 'audio' }); // moof seq=0
    const fragV = makeFragment(0); // moof seq=0（跨轨重复，复刻 mux.js 产物形态）
    const blob = Buffer.concat([fragA, fragV]);
    const next = remuxer.renumberFragmentSequence(blob, 1);
    assert.strictEqual(next, 3, '两个 moof 后下一序号为 3');
    // 读回两个 moof 的 mfhd seq（moof hdr(8)+mfhd hdr(8)+version/flags(4)=偏移 20）
    const seqs = [];
    let off = 0;
    while (off + 8 <= blob.length) {
      const size = blob.readUInt32BE(off);
      const type = blob.toString('ascii', off + 4, off + 8);
      if (type === 'moof') seqs.push(blob.readUInt32BE(off + 20));
      off += size;
    }
    assert.deepStrictEqual(seqs, [1, 2], 'seq 改写为 1,2');
    // 等长改写：mdat 区域逐位一致（其余字节不动）
    const mdatOff = fragA.length - 108; // mdat(8+100)
    assert.strictEqual(
      Buffer.compare(blob.subarray(mdatOff, fragA.length), fragA.subarray(mdatOff)), 0,
      'mdat 内容未被改写'
    );
    // 接续第二批：序号延续
    const blob2 = makeFragment(0);
    assert.strictEqual(remuxer.renumberFragmentSequence(blob2, next), 4);
  });

  test('renumberFragmentSequence：非法入参保守返回原序号不 throw', () => {
    assert.strictEqual(remuxer.renumberFragmentSequence(null, 1), 1);
    assert.strictEqual(remuxer.renumberFragmentSequence(Buffer.alloc(4), 0), 0, 'startSeq<1 不改写');
    assert.strictEqual(remuxer.renumberFragmentSequence(Buffer.from('garbage!!'), 1), 1);
  });
});

describe('AVF 兼容：concatFmp4ToMp4 终检 warn 诊断（非阻断）', () => {
  /** 捕获 console.warn 执行 fn，恢复后返回 warn 消息列表 */
  async function captureWarns(fn) {
    const messages = [];
    const original = console.warn;
    console.warn = (...args) => messages.push(args.join(' '));
    try {
      await fn();
    } finally {
      console.warn = original;
    }
    return messages;
  }

  test('视频 traf 在前（B 站正常形态）→ 不 warn，产物 resolve 正常', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-avf-ok-'));
    try {
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, makeDualTrackInit());
      const seg = path.join(dir, 'seg.m4s');
      fs.writeFileSync(seg, makeDualTrackFragment(1, 0, 0));
      const out = path.join(dir, 'out.mp4');
      const warns = await captureWarns(() =>
        remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg], outputPath: out })
      );
      assert.strictEqual(
        warns.filter((m) => m.includes('首 moof 首 traf 非视频轨')).length, 0,
        '正常形态不应触发 AVF 兼容 warn'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('音频 traf 在前（异常形态）→ console.warn 观测点命中，产物仍正常 resolve', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-avf-warn-'));
    try {
      const initPath = path.join(dir, 'init');
      fs.writeFileSync(initPath, makeDualTrackInit());
      const seg = path.join(dir, 'seg.m4s');
      fs.writeFileSync(seg, makeAudioFirstDualTrackFragment(1));
      const out = path.join(dir, 'out.mp4');
      let result;
      const warns = await captureWarns(async () => {
        result = await remuxer.concatFmp4ToMp4({ initPath, segmentPaths: [seg], outputPath: out });
      });
      assert.strictEqual(result.segments, 1, '诊断不阻断：产物正常 resolve');
      assert.ok(fs.existsSync(out), '诊断不阻断：产物存在');
      assert.strictEqual(
        warns.filter((m) => m.includes('首 moof 首 traf 非视频轨')).length, 1,
        '异常形态应恰好触发一次 AVF 兼容 warn'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

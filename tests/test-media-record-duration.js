/**
 * media-record-engine 运行中时长口径单测（node:test，纯 Node 环境）
 *
 * 覆盖 G-44-4 两口径分离：
 * - 运行中 durationSeconds = 本地挂钟差值（startedAt 起 smooth +1s/s），
 *   与分片落盘节奏解耦——0 分片落盘也在走表
 * - getRecordStatus 与 getActiveRecordings 同式（D-19 关窗确认/红点同步共用）
 * - 终态口径不变：meta.json totalDuration 仍为分片 EXTINF 累计
 *   （duration 缺失兜底 targetDuration），与挂钟值无关
 *
 * 用法: node tests/test-media-record-duration.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createRecordEngine } = require('../media-record-engine');
const { createMediaTaskManager } = require('../media-task-manager');

/** @param {number} ms @returns {Promise<void>} */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 构造引擎依赖：内存 persist 注册表 + 临时录制根目录
 * @param {{ fetchPage: Function, parsePlaylist: Function }} deps
 */
function makeHarness({ fetchPage, parsePlaylist }) {
  const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-dur-'));
  const taskManager = createMediaTaskManager({ persist: () => {} });
  const engine = createRecordEngine({ fetchPage, parsePlaylist, taskManager, recordRoot });
  return {
    engine,
    taskManager,
    recordRoot,
    cleanup: () => fs.rmSync(recordRoot, { recursive: true, force: true }),
  };
}

/** @returns {Object} 录制目录下的 meta.json 内容 */
function metaOf(recordRoot, taskId) {
  return JSON.parse(fs.readFileSync(path.join(recordRoot, taskId, 'meta.json'), 'utf8'));
}

describe('G-44-4 运行中时长（本地挂钟差值）', () => {
  test('挂钟平滑推进：0 分片落盘也在走表，时长严格递增', async () => {
    // fetchPage 永不 resolve → 清单拉不到、0 分片落盘
    const h = makeHarness({ fetchPage: () => new Promise(() => {}) });
    try {
      const r = await h.engine.startRecord({ url: 'https://live.example.com/s.m3u8', title: '直播 A' });
      assert.ok(r.ok, 'startRecord 应成功');

      await sleep(1300);
      const s1 = h.engine.getRecordStatus(r.taskId);
      assert.strictEqual(s1.status, 'running');
      assert.strictEqual(s1.segments, 0, '0 分片落盘');
      assert.ok(
        s1.durationSeconds >= 1 && s1.durationSeconds <= 2,
        `启动 1.3s 后时长应为 1~2s，实际 ${s1.durationSeconds}`
      );

      await sleep(1100);
      const s2 = h.engine.getRecordStatus(r.taskId);
      assert.ok(
        s2.durationSeconds > s1.durationSeconds,
        `时长应严格递增：${s1.durationSeconds} → ${s2.durationSeconds}`
      );
    } finally {
      h.cleanup();
    }
  });

  test('getRecordStatus 与 getActiveRecordings 时长同式（差值 ≤1s）', async () => {
    const h = makeHarness({ fetchPage: () => new Promise(() => {}) });
    try {
      const r = await h.engine.startRecord({ url: 'https://live.example.com/s.m3u8', title: '直播 B' });
      await sleep(2300);
      const s = h.engine.getRecordStatus(r.taskId);
      const list = h.engine.getActiveRecordings();
      assert.strictEqual(list.length, 1);
      assert.ok(
        Math.abs(list[0].durationSeconds - s.durationSeconds) <= 1,
        `两处时长应同式：status=${s.durationSeconds} list=${list[0].durationSeconds}`
      );
    } finally {
      h.cleanup();
    }
  });
});

describe('G-44-4 终态口径不变（meta.json EXTINF 累计）', () => {
  test('stopRecord 后 totalDuration = EXTINF 累计（非挂钟值）', async () => {
    // 首轮仅含 seq1（2026-09-09 起点策略：无 K 标记 → 最新分片 seq1 落盘），
    // 第二轮清单追 seq2/seq3（各 EXTINF 3s）
    let call = 0;
    const seg = { uri: 'https://cdn.example.com/seg.ts', duration: 3 };
    const plBaseline = { targetDuration: 2, ended: false, segments: [{ ...seg, seq: 1 }] };
    const plNext = {
      targetDuration: 2,
      ended: false,
      segments: [{ ...seg, seq: 1 }, { ...seg, seq: 2 }, { ...seg, seq: 3 }],
    };
    const h = makeHarness({
      fetchPage: async () => Buffer.alloc(188, 0x47),
      parsePlaylist: () => (++call === 1 ? plBaseline : plNext),
    });
    try {
      const r = await h.engine.startRecord({ url: 'https://live.example.com/s.m3u8', title: '直播 C' });
      await sleep(3200); // 等第二轮轮询（间隔 max(2000, targetDuration*1000)=2s）追新分片
      const stop = await h.engine.stopRecord(r.taskId);
      assert.ok(stop.ok, 'stopRecord 应成功');

      const meta = metaOf(h.recordRoot, r.taskId);
      assert.strictEqual(meta.segments.length, 3, '首轮起点 seq1 落盘 + 追新 seq2/seq3');
      assert.strictEqual(meta.totalDuration, 9, 'EXTINF 累计 3+3+3=9（非挂钟 ~3s）');
    } finally {
      h.cleanup();
    }
  });

  test('分片无 EXTINF 时 totalDuration 用 targetDuration 兜底累计', async () => {
    let call = 0;
    const seg = { uri: 'https://cdn.example.com/seg.ts', duration: null };
    const plBaseline = { targetDuration: 2, ended: false, segments: [{ ...seg, seq: 1 }] };
    const plNext = {
      targetDuration: 2,
      ended: false,
      segments: [{ ...seg, seq: 1 }, { ...seg, seq: 2 }, { ...seg, seq: 3 }],
    };
    const h = makeHarness({
      fetchPage: async () => Buffer.alloc(188, 0x47),
      parsePlaylist: () => (++call === 1 ? plBaseline : plNext),
    });
    try {
      const r = await h.engine.startRecord({ url: 'https://live.example.com/s.m3u8', title: '直播 D' });
      await sleep(3200);
      const stop = await h.engine.stopRecord(r.taskId);
      assert.ok(stop.ok);

      const meta = metaOf(h.recordRoot, r.taskId);
      assert.strictEqual(meta.segments.length, 3);
      assert.strictEqual(meta.totalDuration, 6, '兜底累计 targetDuration 2 × 3 分片 = 6');
    } finally {
      h.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 45-02（D-05）fMP4 init 留存 tracer 端到端：mux.js generator 确定性夹具
// （与 45-01 tests/test-media-remuxer.js 同款内联，仓库无 fixtures 目录先例）
// ---------------------------------------------------------------------------

const muxjs = require('mux.js');
const { convertToMp4 } = require('../media-remuxer');

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

/** init 分片夹具：ftyp + moov（mux.js probe 可解析） */
function makeInit() {
  return Buffer.from(muxjs.mp4.generator.initSegment([FMP4_VIDEO_TRACK]));
}

/** 单个 moof+mdat 对（payload 100 字节） */
function makeFragment(seq) {
  const track = Object.assign({}, FMP4_VIDEO_TRACK, {
    samples: [{
      size: 100,
      duration: 3000,
      compositionTimeOffset: 0,
      flags: { isLeading: 0, dependsOn: 2, isDependedOn: 0, hasRedundancy: 0, degradationPriority: 0, isNonSyncSample: 0 },
    }],
  });
  const payload = new Uint8Array(100).fill(seq & 0xff);
  return Buffer.concat([
    Buffer.from(muxjs.mp4.generator.moof(seq, [track])),
    Buffer.from(muxjs.mp4.generator.mdat(payload)),
  ]);
}

/** fMP4 分片夹具：单文件两个 moof+mdat 对、无 styp/ftyp（B 站实测多 moof 形态） */
function makeFmp4Segment(seq) {
  return Buffer.concat([makeFragment(seq), makeFragment(seq + 1)]);
}

describe('fMP4 init 留存（D-05，45-02 tracer 端到端）', () => {
  test('带 EXT-X-MAP 清单：首轮 baseline 即下载 init，meta 自解释，录制 → convertToMp4 闭环', async () => {
    const RECORD_URL = 'https://live.example.com/s.m3u8';
    const initBuf = makeInit();
    let call = 0;
    const plBaseline = {
      targetDuration: 2, ended: false, mapUri: 'init.m4s', mapByterange: null,
      segments: [{ uri: 'seg1.m4s', seq: 1, duration: 3 }],
    };
    const plNext = {
      targetDuration: 2, ended: false, mapUri: 'init.m4s', mapByterange: null,
      segments: [
        { uri: 'seg1.m4s', seq: 1, duration: 3 },
        { uri: 'seg2.m4s', seq: 2, duration: 3 },
        { uri: 'seg3.m4s', seq: 3, duration: 3 },
      ],
    };
    const h = makeHarness({
      fetchPage: async (url) => {
        if (url === RECORD_URL) return Buffer.from('#EXTM3U\n');
        if (url.includes('init.m4s')) return initBuf;
        const m = url.match(/seg(\d+)\.m4s/);
        return makeFmp4Segment(m ? Number(m[1]) * 10 : 20);
      },
      parsePlaylist: () => (++call === 1 ? plBaseline : plNext),
    });
    try {
      const r = await h.engine.startRecord({ url: RECORD_URL, title: 'fMP4 直播' });
      assert.ok(r.ok, 'startRecord 应成功');

      // ① Pitfall 1：首轮 baseline 轮 init 已下载（第二轮轮询 2s 后才发生，
      //    500ms 时点只有首轮跑过——首轮即落盘是直接证据）
      await sleep(500);
      const initPath = path.join(h.recordRoot, r.taskId, 'init');
      assert.ok(fs.existsSync(initPath), '首轮 baseline 轮 init 应已落盘（D-21 只豁免分片回溯）');
      assert.ok(fs.readFileSync(initPath).equals(initBuf), 'init 落盘字节应与下载内容一致');

      await sleep(2800); // 等第二轮轮询（间隔 max(2000, targetDuration*1000)=2s）追新分片
      const stop = await h.engine.stopRecord(r.taskId);
      assert.ok(stop.ok, 'stopRecord 应成功');

      // ② meta.json 附加字段自解释（44 附加字段先例，不升版本）
      const meta = metaOf(h.recordRoot, r.taskId);
      assert.strictEqual(meta.initFile, 'init');
      assert.strictEqual(meta.mapUri, 'init.m4s');
      assert.strictEqual(meta.mapByterange, null);

      // ③ init 不进 segments（st.recorded 无 init 条目，不污染完整性判定）
      //    （2026-09-09 起点策略：首轮无 K 标记 → 最新分片 seq1 落盘 + 追新 seq2/seq3）
      assert.strictEqual(meta.segments.length, 3, '首轮起点 seq1 落盘 + 追 seq2/seq3');
      assert.ok(
        meta.segments.every((s) => typeof s.file === 'string' && s.file.endsWith('.ts')),
        'segments 不含 init 条目'
      );

      // ④ D-03 tracer 闭环：录制目录 init + segments 直调 convertToMp4
      //    （45-01 首片嗅探 fMP4 分流）→ resolve 且产物 probe 可解析
      const segmentPaths = meta.segments.map((s) => path.join(h.recordRoot, r.taskId, 'segments', s.file));
      const out = path.join(h.recordRoot, 'out.mp4');
      const result = await convertToMp4({ initPath, segmentPaths, outputPath: out });
      assert.strictEqual(result.outputPath, out);
      assert.strictEqual(result.segments, 3);
      const outBuf = fs.readFileSync(out);
      assert.ok(muxjs.mp4.probe.findBox(outBuf, ['moov']).length >= 1, '产物 probe 应检出 moov');
      assert.strictEqual(muxjs.mp4.probe.findBox(outBuf, ['moof']).length, 6, '三分片各 2 个 moof');
    } finally {
      h.cleanup();
    }
  });

  test('EXT-X-MAP 带 BYTERANGE：不下载 init（RESEARCH Route D 不支持），meta.initFile=null 落 init_missing 兜底', async () => {
    const RECORD_URL = 'https://live.example.com/b.m3u8';
    let initFetchCount = 0;
    const pl = {
      targetDuration: 2, ended: false, mapUri: 'init.m4s', mapByterange: '1142@0',
      segments: [{ uri: 'seg1.m4s', seq: 1, duration: 3 }],
    };
    const h = makeHarness({
      fetchPage: async (url) => {
        if (url === RECORD_URL) return Buffer.from('#EXTM3U\n');
        if (url.includes('init.m4s')) { initFetchCount++; return makeInit(); }
        return makeFmp4Segment(30);
      },
      parsePlaylist: () => pl,
    });
    try {
      const r = await h.engine.startRecord({ url: RECORD_URL, title: 'BYTERANGE 直播' });
      await sleep(500); // 首轮即应完成 BYTERANGE 判定
      const stop = await h.engine.stopRecord(r.taskId);
      assert.ok(stop.ok);

      assert.strictEqual(initFetchCount, 0, 'BYTERANGE 形态不得下载 init');
      assert.ok(!fs.existsSync(path.join(h.recordRoot, r.taskId, 'init')), 'init 文件不应存在');
      const meta = metaOf(h.recordRoot, r.taskId);
      assert.strictEqual(meta.initFile, null);
      assert.strictEqual(meta.mapUri, 'init.m4s');
      assert.strictEqual(meta.mapByterange, '1142@0');
    } finally {
      h.cleanup();
    }
  });
});

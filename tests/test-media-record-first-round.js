/**
 * media-record-engine 首轮落盘起点策略 + 轮询间隔单测（node:test，纯 Node 环境）
 *
 * 背景（2026-09-09 实测对账）：旧 D-21「首轮纯基线不落盘」导致录制启动损耗
 * = 基线等待（0~1 个分片时长）+ 拉取延迟 + 轮询等待（Twitch TARGETDURATION=6
 * 与 EXTINF=2s 脱节，按 6s 轮询每个新分片平均多等 ~3s）——两环境对账 Twitch
 * 损耗 2.2~5.1s、B 站 1.0~2.2s。且 B 站 fMP4 分片不关键帧对齐，旧起点落在
 * GOP 中间时产物头部 ~2s 引用录制前参考帧不可解码（预览跳首关键帧/mpv 花屏）。
 *
 * 修复（2026-09-09）：
 * - firstRoundStartIndex：带 EXT-BILI-AUX K 标记 → 窗口内最新 K 分片起录
 *   （产物从关键帧起步）；无 K 标记 → 最新分片起录（回收基线等待损耗）；
 * - computePollIntervalMs：间隔取 min(targetDuration, EXTINF 中位数)，
 *   下限 2s（T-44-13 不变）——Twitch 6s 轮询压到 2s。
 *
 * 用法: node tests/test-media-record-first-round.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createRecordEngine,
  computePollIntervalMs,
  medianSegmentDuration,
  firstRoundStartIndex,
} = require('../media-record-engine');
const { createMediaTaskManager } = require('../media-task-manager');

/** @param {number} ms @returns {Promise<void>} */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 合法 fMP4 分片头（size=16 moof + 8 字节负载） */
function makeMoofBuf() {
  const buf = Buffer.alloc(16);
  buf.writeUInt32BE(16, 0);
  buf.write('moof', 4, 'ascii');
  return buf;
}

/** 合法 TS 分片（0x47 同步字节放行） */
function makeTsBuf() {
  const buf = Buffer.alloc(188);
  buf[0] = 0x47;
  return buf;
}

describe('firstRoundStartIndex 首轮起点选择', () => {
  test('带 K 标记：从窗口内最新 K 分片起录（其后的 N 分片也落盘）', () => {
    const segs = [
      { keyframe: true },  // K
      { keyframe: false }, // N
      { keyframe: false }, // N
      { keyframe: true },  // K ← 最新 K
      { keyframe: false }, // N
    ];
    assert.strictEqual(firstRoundStartIndex(segs), 3);
  });

  test('无 K 标记（全 null，Twitch TS 形态）：回退最新分片', () => {
    assert.strictEqual(firstRoundStartIndex([{ keyframe: null }, { keyframe: null }]), 1);
  });

  test('全 N 无 K（极端窗口）：回退最新分片（维持旧起点行为）', () => {
    assert.strictEqual(firstRoundStartIndex([{ keyframe: false }, { keyframe: false }]), 1);
  });

  test('空窗口/非法输入：-1', () => {
    assert.strictEqual(firstRoundStartIndex([]), -1);
    assert.strictEqual(firstRoundStartIndex(null), -1);
  });
});

describe('computePollIntervalMs / medianSegmentDuration 轮询间隔', () => {
  test('Twitch 形态（targetDuration=6，EXTINF=2s）→ 2s（按实际分片节奏）', () => {
    assert.strictEqual(computePollIntervalMs(6, 2), 2000);
  });

  test('B 站形态（targetDuration=1，EXTINF=1s）→ 2s（T-44-13 下限钳制不变）', () => {
    assert.strictEqual(computePollIntervalMs(1, 1), 2000);
  });

  test('无 EXTINF 信息 → 回退 targetDuration', () => {
    assert.strictEqual(computePollIntervalMs(6, 0), 6000);
    assert.strictEqual(computePollIntervalMs(6, null), 6000);
  });

  test('恶意极小 targetDuration → 下限 2s（T-44-13 防轮询风暴）', () => {
    assert.strictEqual(computePollIntervalMs(0.1, 0.05), 2000);
  });

  test('medianSegmentDuration：中位数与过滤', () => {
    assert.strictEqual(medianSegmentDuration([{ duration: 1 }, { duration: 1 }, { duration: 1 }]), 1);
    assert.strictEqual(medianSegmentDuration([{ duration: 2 }, { duration: null }, { duration: 2 }]), 2);
    assert.strictEqual(medianSegmentDuration([{ duration: 1 }, { duration: 3 }]), 3, '偶数取上中位');
    assert.strictEqual(medianSegmentDuration([{ duration: null }]), 0);
    assert.strictEqual(medianSegmentDuration([]), 0);
    assert.strictEqual(medianSegmentDuration(null), 0);
  });
});

describe('录制集成：首轮起点策略', () => {
  test('B 站形态（EXT-BILI-AUX N,K）：首轮从 K 分片起录，K 前的 N 分片不下载', async () => {
    const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-firstk-'));
    const taskManager = createMediaTaskManager({ persist: () => {} });

    // 首轮窗口：seg100(N) seg101(K)；次轮追加 seg102(N)
    const playlist = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:1',
      '#EXT-X-MEDIA-SEQUENCE:100',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXT-BILI-AUX:aaaa|N|bbbb|cccc',
      '#EXTINF:1.00,',
      'seg100.m4s',
      '#EXT-BILI-AUX:dddd|K|eeee|ffff',
      '#EXTINF:1.00,',
      'seg101.m4s',
    ].join('\n');

    const fetched = [];
    const fetchPage = async (url) => {
      fetched.push(url);
      if (url.endsWith('index.m3u8')) return Buffer.from(playlist);
      return makeMoofBuf();
    };

    const engine = createRecordEngine({ fetchPage, taskManager, recordRoot });
    try {
      const r = await engine.startRecord({ url: 'https://live.example.com/index.m3u8', title: '直播' });
      assert.ok(r.ok);
      await sleep(600); // 首轮同步完成（下载在 pollLoop 首轮内 await）
      const sr = await engine.stopRecord(r.taskId);
      assert.ok(sr.ok);

      const segDir = path.join(recordRoot, r.taskId, 'segments');
      assert.strictEqual(fs.existsSync(path.join(segDir, '00000101.ts')), true, 'K 分片应落盘');
      assert.strictEqual(fs.existsSync(path.join(segDir, '00000100.ts')), false, 'K 前的 N 分片不回落');
      assert.ok(!fetched.some((u) => u.endsWith('seg100.m4s')), 'seg100 不应被请求');

      const meta = JSON.parse(fs.readFileSync(path.join(recordRoot, r.taskId, 'meta.json'), 'utf8'));
      assert.deepStrictEqual(meta.segments.map((s) => s.file), ['00000101.ts'], 'meta 只含 K 分片');
    } finally {
      fs.rmSync(recordRoot, { recursive: true, force: true });
    }
  });

  test('Twitch 形态（无 EXT-BILI-AUX，4 分片窗口）：首轮只落盘最新分片', async () => {
    const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-firstlatest-'));
    const taskManager = createMediaTaskManager({ persist: () => {} });

    const playlist = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:6',
      '#EXT-X-MEDIA-SEQUENCE:200',
      '#EXTINF:2.00,',
      'seg200.ts',
      '#EXTINF:2.00,',
      'seg201.ts',
      '#EXTINF:2.00,',
      'seg202.ts',
      '#EXTINF:2.00,',
      'seg203.ts',
    ].join('\n');

    const fetched = [];
    const fetchPage = async (url) => {
      fetched.push(url);
      if (url.endsWith('index.m3u8')) return Buffer.from(playlist);
      return makeTsBuf();
    };

    const engine = createRecordEngine({ fetchPage, taskManager, recordRoot });
    try {
      const r = await engine.startRecord({ url: 'https://live.example.com/index.m3u8', title: '直播' });
      assert.ok(r.ok);
      await sleep(600);
      const sr = await engine.stopRecord(r.taskId);
      assert.ok(sr.ok);

      const segDir = path.join(recordRoot, r.taskId, 'segments');
      assert.strictEqual(fs.existsSync(path.join(segDir, '00000203.ts')), true, '最新分片应落盘');
      for (const seq of [200, 201, 202]) {
        assert.strictEqual(
          fs.existsSync(path.join(segDir, `${seq}.ts`.padStart(12, '0'))), false,
          `seg${seq} 历史分片不回落`
        );
      }
      assert.ok(!fetched.some((u) => /seg20[012]\.ts$/.test(u)), '历史分片不应被请求');

      const meta = JSON.parse(fs.readFileSync(path.join(recordRoot, r.taskId, 'meta.json'), 'utf8'));
      assert.deepStrictEqual(meta.segments.map((s) => s.file), ['00000203.ts'], 'meta 只含最新分片');
    } finally {
      fs.rmSync(recordRoot, { recursive: true, force: true });
    }
  });

  test('首轮起点分片下载失败：不记 seen，下轮重试同一 K 分片（对齐语义不丢）', async () => {
    const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-firstk-retry-'));
    const taskManager = createMediaTaskManager({ persist: () => {} });

    const playlist = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:1',
      '#EXT-X-MEDIA-SEQUENCE:100',
      '#EXT-BILI-AUX:aaaa|N|bbbb|cccc',
      '#EXTINF:1.00,',
      'seg100.m4s',
      '#EXT-BILI-AUX:dddd|K|eeee|ffff',
      '#EXTINF:1.00,',
      'seg101.m4s',
    ].join('\n');

    let kFetches = 0;
    const fetchPage = async (url) => {
      if (url.endsWith('index.m3u8')) return Buffer.from(playlist);
      if (url.endsWith('seg101.m4s')) {
        kFetches++;
        if (kFetches === 1) throw new Error('network down'); // 首轮 K 下载失败
      }
      return makeMoofBuf();
    };

    const engine = createRecordEngine({ fetchPage, taskManager, recordRoot });
    try {
      const r = await engine.startRecord({ url: 'https://live.example.com/index.m3u8', title: '直播' });
      assert.ok(r.ok);
      const segDir = path.join(recordRoot, r.taskId, 'segments');
      const kPath = path.join(segDir, '00000101.ts');

      await sleep(600);
      assert.strictEqual(fs.existsSync(kPath), false, '首轮 K 下载失败不落盘');

      // 下轮（间隔 ≥2s）重试成功 → 仍从 K 起步
      await sleep(2600);
      assert.ok(kFetches >= 2, 'K 分片未记 seen，下轮应重试');
      assert.strictEqual(fs.existsSync(kPath), true, '重试后 K 分片落盘');

      const sr = await engine.stopRecord(r.taskId);
      assert.ok(sr.ok);
      const meta = JSON.parse(fs.readFileSync(path.join(recordRoot, r.taskId, 'meta.json'), 'utf8'));
      assert.deepStrictEqual(meta.segments.map((s) => s.file), ['00000101.ts'], '起点仍是 K 分片');
    } finally {
      fs.rmSync(recordRoot, { recursive: true, force: true });
    }
  });
});

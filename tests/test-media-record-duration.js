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
    // 首轮基线只含 seq1（D-21 不落盘），第二轮清单追 seq2/seq3（各 EXTINF 3s）
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
      assert.strictEqual(meta.segments.length, 2, '基线 seq1 不落盘，仅追 seq2/seq3');
      assert.strictEqual(meta.totalDuration, 6, 'EXTINF 累计 3+3=6（非挂钟 ~3s）');
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
      assert.strictEqual(meta.segments.length, 2);
      assert.strictEqual(meta.totalDuration, 4, '兜底累计 targetDuration 2 × 2 分片 = 4');
    } finally {
      h.cleanup();
    }
  });
});

/**
 * media-record-engine master playlist 检出即失败 + parser isMaster 检出（node:test，纯 Node）
 *
 * 背景（2026-09-13 正式环境实测，docs/debug/twitch-record-master-playlist-zero-segments.md）：
 * 录制源拿到 Twitch usher 多码率 master playlist（只含 EXT-X-STREAM-INF、本身无分片）
 * 时，旧引擎按 media playlist 轮询 → 0 分片空转到 token 过期（约 20 分钟）才以
 * 误导性的 'network' 失败，数据 0 字节不可救。
 *
 * 修复（2026-09-16）：pollLoop 拉清单后检出 EXT-X-STREAM-INF 即 failTask——
 * 首轮即可检出，20 分钟空转压成一次拉清单即反馈（任务页/播放器广播即时可见）。
 * 检出放在轮询循环而非 startRecord 预拉：保持 startRecord 立即返回的既有契约
 * （G-44-4「0 分片也走表」语义不破坏，fetchPage 挂起时任务照常在走表）。
 * parser 侧新增 isMaster 标记，且 EXT-X-STREAM-INF 的 variant URI 行不再误入 segments。
 *
 * 用法: node tests/test-media-record-master-reject.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createRecordEngine } = require('../media-record-engine');
const { parsePlaylist } = require('../media-m3u8-parser');
const { createMediaTaskManager } = require('../media-task-manager');

/** @param {number} ms @returns {Promise<void>} */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 合法 TS 分片（0x47 同步字节放行） */
function makeTsBuf() {
  const buf = Buffer.alloc(188);
  buf[0] = 0x47;
  return buf;
}

/** Twitch usher 形态的 master playlist（仅 variant 条目，无分片） */
const MASTER_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-TWITCH-INFO:NODE="video-edge-abc",MANIFEST-NODE-TYPE="weaver_cluster"',
  '#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="chunked",NAME="1080p60",AUTOSELECT=YES,DEFAULT=YES',
  '#EXT-X-STREAM-INF:BANDWIDTH=6853812,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",VIDEO="chunked"',
  'https://apn11.playlist.ttvnw.net/v1/playlist/TOKEN_A.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=3422999,RESOLUTION=1280x720,CODECS="avc1.4D401F,mp4a.40.2",VIDEO="720p60"',
  'https://apn11.playlist.ttvnw.net/v1/playlist/TOKEN_B.m3u8',
].join('\n');

describe('parsePlaylist master playlist 检出', () => {
  test('EXT-X-STREAM-INF → isMaster=true；variant URI 行不进 segments', () => {
    const pl = parsePlaylist(MASTER_PLAYLIST);
    assert.strictEqual(pl.isMaster, true);
    assert.strictEqual(pl.segments.length, 0, 'variant 子清单 URI 不是分片');
  });

  test('media playlist → isMaster=false，分片正常解析', () => {
    const pl = parsePlaylist([
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:6',
      '#EXT-X-MEDIA-SEQUENCE:200',
      '#EXTINF:2.00,',
      'seg200.ts',
    ].join('\n'));
    assert.strictEqual(pl.isMaster, false);
    assert.strictEqual(pl.segments.length, 1);
    assert.strictEqual(pl.segments[0].uri, 'seg200.ts');
  });

  test('EXT-X-I-FRAME-STREAM-INF 不误判 master（I-FRAME 变体前缀不同）', () => {
    const pl = parsePlaylist([
      '#EXTM3U',
      '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=100000,URI="iframe.m3u8"',
      '#EXT-X-TARGETDURATION:6',
      '#EXT-X-MEDIA-SEQUENCE:1',
      '#EXTINF:2.00,',
      'seg1.ts',
    ].join('\n'));
    assert.strictEqual(pl.isMaster, false);
    assert.strictEqual(pl.segments.length, 1);
  });
});

describe('录制引擎 master 检出即失败', () => {
  test('master playlist：首轮检出即 failed（中文指引错误），0 分片且不再轮询', async () => {
    const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-master-'));
    const taskManager = createMediaTaskManager({ persist: () => {} });

    let fetches = 0;
    const fetchPage = async () => {
      fetches++;
      return Buffer.from(MASTER_PLAYLIST);
    };

    const engine = createRecordEngine({ fetchPage, taskManager, recordRoot });
    try {
      const r = await engine.startRecord({
        url: 'https://usher.ttvnw.net/api/v2/channel/hls/lck_carry.m3u8?token=abc',
        title: 'lck_carry - Twitch',
      });
      assert.ok(r.ok, 'startRecord 保持立即返回的既有契约');

      await sleep(600); // 首轮拉清单 + 检出在 pollLoop 首轮内完成
      const task = taskManager.listTasks().find((t) => t.id === r.taskId);
      assert.strictEqual(task.status, 'failed', '首轮检出即失败，不再空转');
      assert.ok(task.error.includes('多码率目录'), `错误应指引换源，实际：${task.error}`);
      assert.strictEqual(task.progress, 0, '0 分片进度');

      // 等过一个轮询周期：失败后不再拉清单（旧行为是 6s 一轮空转到 token 过期）
      const fetchesAtFail = fetches;
      await sleep(2600);
      assert.strictEqual(fetches, fetchesAtFail, '失败后不再发起轮询请求');
      assert.strictEqual(engine.getActiveRecordings().length, 0, '任务已退出运行表');

      const segDir = path.join(recordRoot, r.taskId, 'segments');
      assert.deepStrictEqual(fs.readdirSync(segDir), [], 'segments 目录为空');
      const meta = JSON.parse(fs.readFileSync(path.join(recordRoot, r.taskId, 'meta.json'), 'utf8'));
      assert.deepStrictEqual(meta.segments, [], 'meta 无分片记录');
    } finally {
      fs.rmSync(recordRoot, { recursive: true, force: true });
    }
  });

  test('media playlist 正常录制不受检出影响', async () => {
    const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-media-ok-'));
    const taskManager = createMediaTaskManager({ persist: () => {} });

    const playlist = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:6',
      '#EXT-X-MEDIA-SEQUENCE:200',
      '#EXTINF:2.00,',
      'seg200.ts',
    ].join('\n');

    const fetchPage = async (url) => {
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
      assert.strictEqual(fs.existsSync(path.join(segDir, '00000200.ts')), true, '分片正常落盘');
    } finally {
      fs.rmSync(recordRoot, { recursive: true, force: true });
    }
  });
});

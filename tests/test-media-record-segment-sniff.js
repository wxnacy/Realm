/**
 * media-record-engine 分片内容嗅探单测（node:test，纯 Node 环境）
 *
 * 背景（2026-09-08 实测事故）：B 站直播 CDN 在签名过期/节点切换边缘会把
 * 分片请求以 HTTP 200 应答为当前 m3u8 清单文本——零校验落盘后毒字节混进
 * moof/mdat 拼接流，转码产物的 fMP4 解析走到坏分片即中断，时长截断在首个
 * 坏分片处（后续数据全在但不可见）。
 *
 * 覆盖：
 * - isPlausibleSegment 纯函数：#EXTM3U 毒应答拒绝、0x47 TS 放行、合法 box
 *   头放行、size 越界/过短/空/非 box 拒绝
 * - 录制集成：毒应答分片不落盘不记 seen，下轮轮询重试同一 seq 可补回
 *
 * 用法: node tests/test-media-record-segment-sniff.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createRecordEngine, isPlausibleSegment } = require('../media-record-engine');
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

describe('isPlausibleSegment 分片内容嗅探', () => {
  test('#EXTM3U 清单毒应答拒绝（fMP4/TS 两种期望都拒绝）', () => {
    const poison = Buffer.from('#EXTM3U\n#EXT-X-VERSION:7\n#EXTINF:1.00,\n1788862934.m4s\n');
    assert.strictEqual(isPlausibleSegment(poison, true), false);
    assert.strictEqual(isPlausibleSegment(poison, false), false);
  });

  test('TS 同步字节 0x47 放行', () => {
    const ts = Buffer.alloc(188);
    ts[0] = 0x47;
    assert.strictEqual(isPlausibleSegment(ts, false), true);
  });

  test('合法 box 头（moof/styp/ftyp/sidx）放行', () => {
    assert.strictEqual(isPlausibleSegment(makeMoofBuf(), true), true);
    assert.strictEqual(isPlausibleSegment(makeMoofBuf(), false), true);
  });

  test('size 越界/过短/空/非白名单 box 拒绝', () => {
    const oob = Buffer.alloc(16);
    oob.writeUInt32BE(0x1000, 0);
    oob.write('moof', 4, 'ascii');
    assert.strictEqual(isPlausibleSegment(oob, true), false, '声明 size 超过实际长度');
    assert.strictEqual(isPlausibleSegment(Buffer.alloc(4), true), false, '过短');
    assert.strictEqual(isPlausibleSegment(Buffer.alloc(0), true), false, '空');
    const notBox = Buffer.alloc(16);
    notBox.writeUInt32BE(16, 0);
    notBox.write('html', 4, 'ascii');
    assert.strictEqual(isPlausibleSegment(notBox, false), false, '错误页等非 box 内容');
  });
});

describe('录制集成：毒应答分片不落盘、下轮重试补回', () => {
  test('分片请求返回清单文本 → 不写盘不记 seen；下轮重试成功后正常落盘', async () => {
    const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-sniff-'));
    const taskManager = createMediaTaskManager({ persist: () => {} });

    // 清单：首轮 baseline seg100/101；后续轮追加 seg102
    const playlistRound1 = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:1',
      '#EXT-X-MEDIA-SEQUENCE:100',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXTINF:1.00,',
      'seg100.m4s',
      '#EXTINF:1.00,',
      'seg101.m4s',
    ].join('\n');
    const playlistLater = playlistRound1 + '\n#EXTINF:1.00,\nseg102.m4s';

    let seg102Fetches = 0;
    const fetchCounts = new Map();
    const fetchPage = async (url) => {
      fetchCounts.set(url, (fetchCounts.get(url) || 0) + 1);
      if (url.endsWith('index.m3u8')) {
        // 第 2 轮起清单追加 seg102（首轮只 baseline）
        return Buffer.from(fetchCounts.get(url) >= 2 ? playlistLater : playlistRound1);
      }
      if (url.endsWith('init.mp4')) return makeMoofBuf();
      if (url.endsWith('seg102.m4s')) {
        seg102Fetches++;
        // 首次请求 seg102 返回清单毒应答；重试返回合法分片
        return seg102Fetches === 1
          ? Buffer.from('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-MEDIA-SEQUENCE:100\n')
          : makeMoofBuf();
      }
      return makeMoofBuf();
    };

    const engine = createRecordEngine({ fetchPage, taskManager, recordRoot });
    try {
      const r = await engine.startRecord({ url: 'https://live.example.com/index.m3u8', title: '直播' });
      assert.ok(r.ok, 'startRecord 应成功');
      const segDir = path.join(recordRoot, r.taskId, 'segments');
      const seg102Path = path.join(segDir, '00000102.ts');

      // 第 2 轮：seg102 首次拉取中毒 → 不落盘
      await sleep(2600);
      assert.strictEqual(fs.existsSync(seg102Path), false, '毒应答分片不得落盘');
      assert.ok(seg102Fetches >= 1, 'seg102 应已被请求过');

      // 第 3 轮：seq 未记 seen → 重试同一 seq，成功落盘
      await sleep(2600);
      assert.ok(seg102Fetches >= 2, '毒应答未记 seen，下轮应重试同一 seq');
      assert.strictEqual(fs.existsSync(seg102Path), true, '重试成功后分片应落盘');
      assert.strictEqual(Buffer.compare(fs.readFileSync(seg102Path), makeMoofBuf()), 0, '落盘内容为合法分片');

      const sr = await engine.stopRecord(r.taskId);
      assert.ok(sr.ok);
      const meta = JSON.parse(fs.readFileSync(path.join(recordRoot, r.taskId, 'meta.json'), 'utf8'));
      // 2026-09-09 首轮起点策略：首轮最新分片 seg101 落盘 + 重试成功的 seg102
      assert.deepStrictEqual(
        meta.segments.map((s) => s.file),
        ['00000101.ts', '00000102.ts'],
        'meta 含首轮起点的 seg101 与重试补回的 seg102（毒分片不入列）'
      );
    } finally {
      fs.rmSync(recordRoot, { recursive: true, force: true });
    }
  });
});

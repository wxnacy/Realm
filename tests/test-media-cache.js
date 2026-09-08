/**
 * media-cache-manager 单元测试（node:test，纯 Node 环境）
 *
 * 覆盖（Phase 44 Wave 0）：
 * - D-12：续播 key = origin+pathname，query 时效 token 不参与
 * - D-05：分片落盘 + meta.json 索引（实际字节数 + sha256）
 * - D-09：读取时哈希/大小校验失败 → 删片 → miss（回源播放不中断）
 * - D-06/D-07：容量 FIFO 淘汰（按 last_watched 升序整目录删除）+ 活跃任务豁免
 * - CR-02（44-07）：容量淘汰接进 storeBuffer 写路径（水位方案）——仅经 storeBuffer 超限即
 *   自动淘汰、setCapacityBytes 缩小容量即时触发、单视频写目录自豁免不自杀
 * - D-08：写盘 ENOSPC → 强制淘汰一轮 → 重试；仍失败返回 disk_full
 * - D-10：已登记分片再次 store 跳过不重写（增量续存）
 * - T-44-01/T-44-02：路径安全（videoId 白名单 + symlink 逃逸拒绝）
 * - CR-05：store() 源流 error 不崩主进程且 tee 收到 error；contentType 落盘-回放闭环
 *
 * 用法: node tests/test-media-cache.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const { MediaCacheManager, playbackKeyOf, videoIdOf, segmentKeyOf } = require('../media-cache-manager');
const muxjs = require('mux.js');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// fMP4 init 分片夹具（mux.js mp4.generator 确定性生成，45-01 同法）：
// makeInit() 生成 ftyp+moov init 分片（probe 可解析的合法 init 形态）。
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

/** init 分片夹具：ftyp + moov（mux.js probe 可解析，~676 字节） */
function makeInit() {
  return Buffer.from(muxjs.mp4.generator.initSegment([FMP4_VIDEO_TRACK]));
}

/** sha256 hex（meta.init_segment 断言用） */
function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** 临时缓存根目录 */
function makeCacheRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'realm-cache-test-'));
}

/** 造 n 字节的伪随机内容 */
function makeBuffer(n, seed) {
  const buf = Buffer.alloc(n);
  for (let i = 0; i < n; i++) buf[i] = (seed + i) % 256;
  return buf;
}

describe('playbackKey / videoId 续播 key 语义（D-12）', () => {
  test('query 时效 token 不参与匹配', () => {
    assert.strictEqual(
      playbackKeyOf('https://a.com/x.m3u8?t=abc'),
      playbackKeyOf('https://a.com/x.m3u8?t=xyz')
    );
    assert.strictEqual(playbackKeyOf('https://a.com/x.m3u8?t=abc'), 'https://a.com/x.m3u8');
  });

  test('videoId 为 16 位 hex 且对 query 稳定、对路径敏感', () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot() });
    assert.match(c.videoId('https://a.com/x.m3u8'), /^[a-f0-9]{16}$/);
    assert.strictEqual(c.videoId('https://a.com/x.m3u8?t=1'), c.videoId('https://a.com/x.m3u8?t=2'));
    assert.notStrictEqual(c.videoId('https://a.com/x.m3u8'), c.videoId('https://a.com/y.m3u8'));
    assert.strictEqual(c.videoId('https://a.com/x.m3u8'), videoIdOf('https://a.com/x.m3u8'));
  });
});

describe('store / lookup 读写闭环（D-05）', () => {
  test('落盘后命中，内容与索引一致', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segUrl = 'https://cdn.com/seg0.ts';
    const buf = makeBuffer(1024, 7);

    const r = c.storeBuffer(segUrl, vid, buf);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.skipped, undefined);
    assert.strictEqual(r.size, 1024);

    const hit = c.lookup(segUrl, vid);
    assert.strictEqual(hit.hit, true);
    assert.strictEqual(hit.size, 1024);
    assert.deepStrictEqual(hit.data, buf);

    // meta.json 索引登记（实际字节数 + sha256）
    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    const segKey = segmentKeyOf(segUrl);
    assert.strictEqual(meta.segments[segKey].size, 1024);
    assert.match(meta.segments[segKey].sha256, /^[a-f0-9]{64}$/);
    assert.strictEqual(meta.total_size, 1024);
    assert.strictEqual(meta.playback_key, 'https://a.com/x.m3u8');
    // 分片文件名与目录名均 hex（禁原始 URL 拼路径）
    assert.match(segKey, /^[a-f0-9]+$/);
    assert.match(vid, /^[a-f0-9]+$/);
    assert.ok(fs.existsSync(path.join(root, vid, 'segments', segKey)));
  });

  test('未知分片 miss', () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot() });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    assert.deepStrictEqual(c.lookup('https://cdn.com/other.ts', vid), { hit: false });
  });

  test('store() tee 透传流并异步落盘', async () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot() });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segUrl = 'https://cdn.com/seg-tee.ts';
    const buf = makeBuffer(512, 3);

    const passthrough = c.store(segUrl, vid, Readable.from(buf), {});
    const collected = [];
    passthrough.on('data', (c2) => collected.push(c2));
    await new Promise((resolve) => passthrough.on('end', resolve));
    assert.deepStrictEqual(Buffer.concat(collected), buf);

    // 写盘是异步收尾，轮询等待索引出现
    for (let i = 0; i < 50; i++) {
      if (c.lookup(segUrl, vid).hit) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.strictEqual(c.lookup(segUrl, vid).hit, true);
  });
});

describe('哈希/大小校验删片回源（D-09）', () => {
  test('内容被篡改 → miss + 文件删除', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segUrl = 'https://cdn.com/seg1.ts';
    c.storeBuffer(segUrl, vid, makeBuffer(256, 1));
    const file = path.join(root, vid, 'segments', segmentKeyOf(segUrl));

    // 篡改内容
    fs.writeFileSync(file, makeBuffer(256, 99));
    assert.strictEqual(c.lookup(segUrl, vid).hit, false);
    assert.strictEqual(fs.existsSync(file), false, '校验失败的分片文件应被删除');
  });

  test('文件被截断（大小不符）→ miss + 文件删除', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segUrl = 'https://cdn.com/seg2.ts';
    c.storeBuffer(segUrl, vid, makeBuffer(256, 2));
    const file = path.join(root, vid, 'segments', segmentKeyOf(segUrl));

    fs.truncateSync(file, 100);
    assert.strictEqual(c.lookup(segUrl, vid).hit, false);
    assert.strictEqual(fs.existsSync(file), false);
  });
});

describe('FIFO 淘汰与活跃豁免（D-06/D-07，44-07 适配生产写路径自动淘汰）', () => {
  test('超容量按 last_watched 升序整目录删除（写路径自动触发）', () => {
    // 44-07 CR-02：容量淘汰已接进 storeBuffer 生产写路径（不再只在 ENOSPC 分支可达）。
    // capacityBytes:130 + sizes 60/50/40：前两次累计 110 ≤ 130 不触发，第三次 150 > 130
    // 自动淘汰——不显式调 evictIfNeeded，直接验证写路径淘汰生效（D-06 生产语义回归锚）
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot(), capacityBytes: 130 });
    const vids = [];
    const sizes = [60, 50, 40];
    const urls = ['https://s.com/v1.m3u8', 'https://s.com/v2.m3u8', 'https://s.com/v3.m3u8'];
    urls.forEach((u, i) => {
      const vid = c.touchVideo(u);
      c.storeBuffer(`https://cdn.com/${i}.ts`, vid, makeBuffer(sizes[i], i), { lastWatched: 1000 + i });
      vids.push(vid);
    });
    // 总 150 > 130：第三次 storeBuffer 后 v1（60B，最久未看）已被自动整目录删除
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[0])), false);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[1])), true);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[2])), true);
    // 磁盘权威总量收敛于容量上限（90 = 50+40）
    const entries = c.listEntries();
    const total = entries.reduce((s, e) => s + (e.size || 0), 0);
    assert.ok(total <= 130, `淘汰后磁盘总量应 ≤ 容量上限，实际 ${total}`);
    assert.strictEqual(entries.some((e) => e.videoId === vids[0]), false);
  });

  test('写路径超限自动淘汰（仅经 storeBuffer 即发生，FIFO 取最旧）', () => {
    // capacity 100，lastWatched 依次 1000/2000/3000：第二次写入累计 60+50=110 > 100
    // 即自动淘汰最旧的 v1（last_watched 1000），第三次 50+40=90 不再触发；
    // 全程不显式调 evictIfNeeded
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot(), capacityBytes: 100 });
    const vids = [];
    const sizes = [60, 50, 40];
    const urls = ['https://s.com/a1.m3u8', 'https://s.com/a2.m3u8', 'https://s.com/a3.m3u8'];
    urls.forEach((u, i) => {
      const vid = c.touchVideo(u);
      c.storeBuffer(`https://cdn.com/a${i}.ts`, vid, makeBuffer(sizes[i], i), { lastWatched: 1000 + i });
      vids.push(vid);
    });
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[0])), false, '最旧 v1 应被自动淘汰');
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[1])), true);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[2])), true);
    const total = c.listEntries().reduce((s, e) => s + (e.size || 0), 0);
    assert.ok(total <= 100, `淘汰后磁盘总量应 ≤ 容量上限，实际 ${total}`);
  });

  test('活跃任务豁免淘汰（isVideoActive 按 playbackKey 匹配，D-07）', () => {
    // 回调契约：逐视频按 meta.playback_key（m3u8 的 origin+pathname）查询，
    // 与 44-02 media-task-manager.isVideoActive 的注入契约一致
    // 44-07 语义：第二次 storeBuffer 累计 80+50=130 > 100 触发写路径自动淘汰，但因
    // old 活跃 + new 是正在写入方（exempt）双双豁免、零删除；显式 evictIfNeeded 时
    // 豁免已解除 → 淘汰非活跃的 new、活跃 old 保留——D-07 豁免分支不受自动淘汰干扰
    const activeKey = playbackKeyOf('https://s.com/old.m3u8');
    const c = new MediaCacheManager({
      cacheRoot: makeCacheRoot(),
      capacityBytes: 100,
      isVideoActive: (key) => key === activeKey,
    });
    const oldVid = c.touchVideo('https://s.com/old.m3u8');
    const newVid = c.touchVideo('https://s.com/new.m3u8');
    c.storeBuffer('https://cdn.com/old.ts', oldVid, makeBuffer(80, 1), { lastWatched: 1000 });
    c.storeBuffer('https://cdn.com/new.ts', newVid, makeBuffer(50, 2), { lastWatched: 2000 });

    const r = c.evictIfNeeded();
    // 活跃的 old 被豁免，改为淘汰次旧的 new
    assert.ok(r.evicted.includes(newVid));
    assert.ok(!r.evicted.includes(oldVid));
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, oldVid)), true);
  });

  test('setCapacityBytes 缩小容量立即触发一轮淘汰（CR-02）', () => {
    // capacity 500 存两视频共 150（不触发自动淘汰）→ setCapacityBytes(100)：
    // 改小即按 last_watched FIFO 收敛，最旧目录被删、剩余 ≤ 100、字段生效
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot(), capacityBytes: 500 });
    const oldVid = c.touchVideo('https://s.com/s1.m3u8');
    const newVid = c.touchVideo('https://s.com/s2.m3u8');
    c.storeBuffer('https://cdn.com/s1.ts', oldVid, makeBuffer(90, 1), { lastWatched: 1000 });
    c.storeBuffer('https://cdn.com/s2.ts', newVid, makeBuffer(60, 2), { lastWatched: 2000 });
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, oldVid)), true, '改容量前最旧目录仍存活');

    c.setCapacityBytes(100);
    assert.strictEqual(c.capacityBytes, 100);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, oldVid)), false, '改小后最旧目录应被删');
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, newVid)), true);
    const total = c.listEntries().reduce((s, e) => s + (e.size || 0), 0);
    assert.ok(total <= 100, `缩小容量后磁盘总量应 ≤ 新上限，实际 ${total}`);
  });

  test('单视频超限自豁免不自杀（写目录防误删回归锚）', () => {
    // capacity 100 单视频写 150：自动淘汰 exempt 自身 → 目录仍存在、分片仍可命中。
    // 超限收敛留待后续写其他视频/活跃解除时发生（防「正在写入的视频被误删」回归）
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot(), capacityBytes: 100 });
    const vid = c.touchVideo('https://s.com/only.m3u8');
    const segUrl = 'https://cdn.com/only.ts';
    const r = c.storeBuffer(segUrl, vid, makeBuffer(150, 7), { lastWatched: 1000 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vid)), true, '正在写入的视频不应被自身淘汰误删');
    assert.strictEqual(c.lookup(segUrl, vid).hit, true, '超限但未被淘汰的分片应可正常命中');
  });
});

describe('磁盘满强淘重试（D-08）', () => {
  const origWrite = fs.writeFileSync;
  let stub = null;

  test('ENOSPC → 强制淘汰 → 重试成功', () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot(), capacityBytes: 50 });
    const oldVid = c.touchVideo('https://s.com/old.m3u8');
    const newVid = c.touchVideo('https://s.com/new.m3u8');
    c.storeBuffer('https://cdn.com/old.ts', oldVid, makeBuffer(60, 1), { lastWatched: 1000 });

    // 首次 writeFileSync 抛 ENOSPC，之后恢复真实现
    let calls = 0;
    stub = (...args) => {
      calls++;
      if (calls === 1) {
        const err = new Error('No space left on device');
        err.code = 'ENOSPC';
        throw err;
      }
      return origWrite(...args);
    };
    fs.writeFileSync = stub;
    try {
      const r = c.storeBuffer('https://cdn.com/new.ts', newVid, makeBuffer(30, 2), { lastWatched: 2000 });
      assert.strictEqual(r.ok, true, `应经强淘后写盘成功: ${JSON.stringify(r)}`);
      assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, oldVid)), false, '强淘应删除最久未看的条目');
      assert.strictEqual(c.lookup('https://cdn.com/new.ts', newVid).hit, true);
    } finally {
      fs.writeFileSync = origWrite;
    }
  });

  test('持续 ENOSPC → 返回 disk_full', () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot(), capacityBytes: 10 });
    const vid = c.touchVideo('https://s.com/v.m3u8');
    stub = () => {
      const err = new Error('No space left on device');
      err.code = 'ENOSPC';
      throw err;
    };
    fs.writeFileSync = stub;
    try {
      const r = c.storeBuffer('https://cdn.com/big.ts', vid, makeBuffer(40, 3), {});
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.reason, 'disk_full');
    } finally {
      fs.writeFileSync = origWrite;
    }
  });
});

describe('增量续存（D-10）', () => {
  test('已登记分片再次 store 跳过不重写', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segUrl = 'https://cdn.com/seg-dup.ts';
    const buf = makeBuffer(128, 5);
    c.storeBuffer(segUrl, vid, buf);
    const file = path.join(root, vid, 'segments', segmentKeyOf(segUrl));
    const stat1 = fs.statSync(file);
    const meta1 = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));

    // 二次写入不同内容：应被跳过（不重写），meta.total_size 不重复累计
    const r = c.storeBuffer(segUrl, vid, makeBuffer(128, 66));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.skipped, true);
    const stat2 = fs.statSync(file);
    assert.strictEqual(stat1.mtimeMs, stat2.mtimeMs, '文件不应被重写');
    const meta2 = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta1.total_size, meta2.total_size);
  });
});

describe('路径安全（T-44-01/T-44-02）', () => {
  test('非 hex videoId（含穿越串）被拒绝', () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot() });
    const r1 = c.storeBuffer('https://cdn.com/x.ts', '../../evil', Buffer.alloc(4));
    assert.strictEqual(r1.ok, false);
    const r2 = c.storeBuffer('https://cdn.com/x.ts', 'zzzz-not-hex', Buffer.alloc(4));
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(c.deleteEntry('../../evil').success, false);
  });

  test('segments 目录内 symlink 指向外部 → 拒绝写盘', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segKey = segmentKeyOf('https://cdn.com/symlink.ts');
    const segmentsDir = path.join(root, vid, 'segments');
    fs.mkdirSync(segmentsDir, { recursive: true });
    const outside = path.join(os.tmpdir(), `realm-outside-${Date.now()}.txt`);
    fs.writeFileSync(outside, 'outside');
    fs.symlinkSync(outside, path.join(segmentsDir, segKey));

    const r = c.storeBuffer('https://cdn.com/symlink.ts', vid, makeBuffer(32, 9));
    assert.strictEqual(r.ok, false, 'symlink 逃逸应被拒绝');
    assert.strictEqual(fs.readFileSync(outside, 'utf8'), 'outside', '外部文件不应被写入');
    fs.unlinkSync(outside);
  });

  test('缓存根内 symlink 指向外部 → lookup 拒绝读外部', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segUrl = 'https://cdn.com/real.ts';
    c.storeBuffer(segUrl, vid, makeBuffer(64, 11));
    const segKey = segmentKeyOf(segUrl);
    const file = path.join(root, vid, 'segments', segKey);
    const outside = path.join(os.tmpdir(), `realm-outside2-${Date.now()}.txt`);
    fs.writeFileSync(outside, 'secret');
    fs.unlinkSync(file);
    fs.symlinkSync(outside, file);

    const hit = c.lookup(segUrl, vid);
    assert.strictEqual(hit.hit, false, 'symlink 指向的外部文件内容不应作为缓存命中');
    fs.unlinkSync(outside);
  });
});

describe('store() 源流 error 健壮性（CR-05）', () => {
  test('源流 push 部分数据后 destroy → 不崩主进程、tee 收到 error、数据已透传', async () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot() });
    const vid = c.touchVideo('https://a.com/x.m3u8');
    const segUrl = 'https://cdn.com/seg-reset.ts';

    // 手动驱动的事件源流：read() 空实现，外部 push/destroy 控制节奏
    const src = new Readable({ read() {} });
    const tee = c.store(segUrl, vid, src, {});
    const seen = [];
    const teeErr = new Promise((resolve) => {
      tee.on('data', (d) => seen.push(d));
      tee.on('error', (err) => resolve(err));
    });

    // 先推一段数据（透传应送达 tee），随后 destroy 模拟源站 RST
    src.push(Buffer.from('partial-data-'));
    setTimeout(() => {
      src.destroy(Object.assign(new Error('source reset'), { code: 'ECONNRESET' }));
    }, 5);

    const err = await teeErr;
    assert.strictEqual(err.message, 'source reset');
    // 已到达 tee 的部分数据不被吞掉（透传先行，落盘收集中断不影响播放侧）
    assert.strictEqual(Buffer.concat(seen).toString('utf8'), 'partial-data-');
    // 测试进程存活至此即证明无 uncaught exception（监听生效）；销毁残留防悬挂
    src.destroy();
    tee.destroy();
  });

  test('storeBuffer 带 contentType 落盘 → lookup 命中回放；缺省则命中无该字段', () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot() });
    const vid = c.touchVideo('https://a.com/ct.m3u8');

    c.storeBuffer('https://cdn.com/ct1.ts', vid, makeBuffer(64, 1), { contentType: 'video/mp2t' });
    const hit = c.lookup('https://cdn.com/ct1.ts', vid);
    assert.strictEqual(hit.hit, true);
    assert.strictEqual(hit.contentType, 'video/mp2t', '命中结果应回放登记时的 contentType');

    c.storeBuffer('https://cdn.com/ct2.ts', vid, makeBuffer(64, 2), {});
    const hit2 = c.lookup('https://cdn.com/ct2.ts', vid);
    assert.strictEqual(hit2.hit, true);
    assert.ok(!('contentType' in hit2), '未登记 contentType 的命中结果不应带该字段（回落默认）');
  });
});

describe('密钥 URI 排除与加密标记（G-44-7）', () => {
  const M3U8 = 'https://a.com/enc/index.m3u8';
  const PLAYLIST = [
    '#EXTM3U',
    '#EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x00000000000000000000000000000001',
    '#EXTINF:5.0,',
    'seg0.ts',
    '#EXTINF:5.0,',
    'seg1.ts',
    '#EXT-X-ENDLIST',
  ].join('\n');

  test('含 EXT-X-KEY 清单 → meta.has_encryption=true 且 key_uris 含密钥键', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);
    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.has_encryption, true);
    const keySeg = segmentKeyOf('https://a.com/enc/enc.key');
    assert.deepStrictEqual(meta.key_uris, [keySeg]);
  });

  test('storeBuffer 存密钥 URI → segments 无该键且目录无文件；真实分片正常登记', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);

    const keyUrl = 'https://a.com/enc/enc.key';
    const keySeg = segmentKeyOf(keyUrl);
    const rk = c.storeBuffer(keyUrl, vid, makeBuffer(16, 9));
    assert.strictEqual(rk.ok, true);
    assert.strictEqual(rk.skipped, true);
    assert.strictEqual(rk.reason, 'key_uri');

    const r0 = c.storeBuffer('https://a.com/enc/seg0.ts', vid, makeBuffer(128, 1));
    const r1 = c.storeBuffer('https://a.com/enc/seg1.ts', vid, makeBuffer(128, 2));
    assert.strictEqual(r0.ok, true);
    assert.strictEqual(r1.ok, true);

    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.ok(!meta.segments[keySeg], '密钥 URI 不应登记进 segments');
    assert.ok(!fs.existsSync(path.join(root, vid, 'segments', keySeg)), '密钥文件不应落盘');
    assert.strictEqual(Object.keys(meta.segments).length, 2, 'segments 数应与清单分片数一致');
    assert.strictEqual(meta.playlist_order.length, Object.keys(meta.segments).length);
  });

  test('有 key_uris 的污染 meta → getConvertInfo 剔除 key 键且 hasEncryption=true', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    // 模拟修复前污染落库（key 键混入 segments），随后清单重新拉取登记 key_uris
    c.storeBuffer('https://a.com/enc/seg0.ts', vid, makeBuffer(128, 1));
    c.storeBuffer('https://a.com/enc/seg1.ts', vid, makeBuffer(128, 2));
    c.storeBuffer('https://a.com/enc/enc.key', vid, makeBuffer(16, 9));
    c.updatePlaylistIndex(M3U8, PLAYLIST);

    const info = c.getConvertInfo(vid);
    const keySeg = segmentKeyOf('https://a.com/enc/enc.key');
    assert.strictEqual(info.hasEncryption, true);
    assert.strictEqual(info.segmentPaths.length, 2, 'key 键应被剔除出 segmentPaths');
    assert.ok(
      info.segmentPaths.every((p) => !p.endsWith(keySeg)),
      'segmentPaths 不应包含 key 文件'
    );
    // 剔除后 playlist_order（2）与分片数（2）对齐 → completeness 恢复 100
    assert.strictEqual(info.completeness, 100);
  });

  test('无 key_uris 的污染 meta → getConvertInfo 过滤为 no-op（key 键仍留在 segmentPaths）', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    // 模拟修复前落库且未重新播放的历史污染条目：无 key_uris 字段
    c.storeBuffer('https://a.com/enc/seg0.ts', vid, makeBuffer(128, 1));
    c.storeBuffer('https://a.com/enc/seg1.ts', vid, makeBuffer(128, 2));
    c.storeBuffer('https://a.com/enc/enc.key', vid, makeBuffer(16, 9));

    const info = c.getConvertInfo(vid);
    const keySeg = segmentKeyOf('https://a.com/enc/enc.key');
    assert.strictEqual(info.hasEncryption, false, '无 has_encryption 字段的历史条目应为 false');
    assert.strictEqual(info.segmentPaths.length, 3, '过滤为 no-op，key 键保留');
    assert.ok(
      info.segmentPaths.some((p) => p.endsWith(keySeg)),
      '读取侧不静默改动历史污染条目'
    );
  });
});

describe('AES-128 解密材料（key_hex/key_iv/media_sequence，加密转换链路）', () => {
  const M3U8 = 'https://a.com/enc/index.m3u8';
  const PLAYLIST = [
    '#EXTM3U',
    '#EXT-X-MEDIA-SEQUENCE:7',
    '#EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x00000000000000000000000000000001',
    '#EXTINF:5.0,',
    'seg0.ts',
    '#EXTINF:5.0,',
    'seg1.ts',
    '#EXT-X-ENDLIST',
  ].join('\n');

  test('updatePlaylistIndex 登记 key_iv 与 media_sequence；getConvertInfo 透出解密材料', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);
    c.storeBuffer('https://a.com/enc/seg0.ts', vid, makeBuffer(128, 1));
    c.storeBuffer('https://a.com/enc/seg1.ts', vid, makeBuffer(128, 2));

    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.key_iv, '00000000000000000000000000000001');
    assert.strictEqual(meta.media_sequence, 7);

    const info = c.getConvertInfo(vid);
    assert.strictEqual(info.hasEncryption, true);
    assert.strictEqual(info.keyHex, null, '密钥未到达时 keyHex 为 null（入口按 key_unavailable 处理）');
    assert.strictEqual(info.keyIvHex, '00000000000000000000000000000001');
    assert.strictEqual(info.mediaSequence, 7);
  });

  test('storeBuffer 16 字节密钥 → meta.key_hex 留存（不进 segments）；二次密钥不覆盖', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);

    const rk = c.storeBuffer('https://a.com/enc/enc.key', vid, makeBuffer(16, 9));
    assert.strictEqual(rk.skipped, true);
    assert.strictEqual(rk.reason, 'key_uri');

    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.key_hex, makeBuffer(16, 9).toString('hex'));
    assert.ok(!meta.segments[segmentKeyOf('https://a.com/enc/enc.key')], '密钥不进 segments');

    // 二次不同内容密钥请求：不覆盖已留存 key_hex（首密钥为准）
    c.storeBuffer('https://a.com/enc/enc.key', vid, makeBuffer(16, 3));
    const meta2 = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta2.key_hex, makeBuffer(16, 9).toString('hex'));

    // getConvertInfo 透出 keyHex
    c.storeBuffer('https://a.com/enc/seg0.ts', vid, makeBuffer(128, 1));
    c.storeBuffer('https://a.com/enc/seg1.ts', vid, makeBuffer(128, 2));
    const info = c.getConvertInfo(vid);
    assert.strictEqual(info.keyHex, makeBuffer(16, 9).toString('hex'));
  });

  test('非 16 字节密钥 URI 响应不留存 key_hex（非 AES-128 key size）', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);
    c.storeBuffer('https://a.com/enc/enc.key', vid, makeBuffer(24, 9));
    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.key_hex, undefined);
  });

  test('历史污染条目 key_hex 自愈：key 作分片落库（16 字节）→ getConvertInfo 回读并补写 meta', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    // 修复前污染落库：key 被当分片存进 segments（key_uris 尚未登记）
    c.storeBuffer('https://a.com/enc/seg0.ts', vid, makeBuffer(128, 1));
    c.storeBuffer('https://a.com/enc/seg1.ts', vid, makeBuffer(128, 2));
    c.storeBuffer('https://a.com/enc/enc.key', vid, makeBuffer(16, 9));
    // 清单重新拉取：登记 key_uris / key_iv / media_sequence
    c.updatePlaylistIndex(M3U8, PLAYLIST);

    const info = c.getConvertInfo(vid);
    assert.strictEqual(info.keyHex, makeBuffer(16, 9).toString('hex'), '从污染分片回读密钥自愈');
    assert.strictEqual(info.segmentPaths.length, 2, 'key 键仍被剔除出 segmentPaths');
    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.key_hex, makeBuffer(16, 9).toString('hex'), '自愈结果补写 meta.key_hex');
  });
});

describe('EXT-X-MAP 排除与 init 留存（D-05/D-07，fMP4 缓存链路 45-03）', () => {
  const M3U8 = 'https://a.com/vod/index.m3u8';
  const INIT_URL = 'https://a.com/vod/init.mp4';
  const PLAYLIST = [
    '#EXTM3U',
    '#EXT-X-MAP:URI="init.mp4"',
    '#EXTINF:5.0,',
    'seg0.m4s',
    '#EXTINF:5.0,',
    'seg1.m4s',
    '#EXT-X-ENDLIST',
  ].join('\n');

  test('含 EXT-X-MAP 清单 → meta.has_fmp4_map=true 且 map_uris 含 init 键', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);
    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.has_fmp4_map, true);
    const initSeg = segmentKeyOf(INIT_URL);
    assert.deepStrictEqual(meta.map_uris, [initSeg], 'map_uris 应为 segKey(init 绝对 URL) 数组');
    assert.strictEqual(meta.map_byterange, null, '无 BYTERANGE 的 MAP 应记 null');
  });

  test('storeBuffer 命中 map_uris → init 本体落盘 + meta.init_segment 登记（不进 segments）', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);

    const initBuf = makeInit();
    const rk = c.storeBuffer(INIT_URL, vid, initBuf);
    assert.strictEqual(rk.ok, true);
    assert.strictEqual(rk.skipped, true);
    assert.strictEqual(rk.reason, 'map_uri');

    const initSeg = segmentKeyOf(INIT_URL);
    const initFile = path.join(root, vid, 'init');
    assert.ok(fs.existsSync(initFile), 'init 本体应落盘 <videoDir>/init');
    assert.deepStrictEqual(fs.readFileSync(initFile), initBuf, 'init 落盘内容应与原字节一致');

    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.ok(!meta.segments[initSeg], 'init 绝不进 segments（Pitfall 2，D-07）');
    assert.deepStrictEqual(meta.init_segment, {
      size: initBuf.length,
      sha256: sha256Hex(initBuf),
      uri_key: initSeg,
    });

    // 真实分片正常登记，不受 MAP 排除影响
    const r0 = c.storeBuffer('https://a.com/vod/seg0.m4s', vid, makeBuffer(128, 1));
    assert.strictEqual(r0.ok, true);
    assert.strictEqual(r0.skipped, undefined);
  });

  test('二次同 uri_key init 请求 → 不覆盖已留存 init（首 init 为准，D-10）', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);

    const initBuf = makeInit();
    c.storeBuffer(INIT_URL, vid, initBuf);
    // 二次同 uri_key、不同内容：不覆盖
    const other = makeBuffer(64, 9);
    const rk2 = c.storeBuffer(INIT_URL, vid, other);
    assert.strictEqual(rk2.skipped, true);
    assert.strictEqual(rk2.reason, 'map_uri');

    const initFile = path.join(root, vid, 'init');
    assert.deepStrictEqual(fs.readFileSync(initFile), initBuf, '二次 init 不应覆盖已留存内容');
    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.init_segment.size, initBuf.length, 'init_segment 登记保持首 init');
    assert.strictEqual(meta.init_segment.sha256, sha256Hex(initBuf));
  });

  test('完整性判定不含 init：playlist_order 对齐 + completeness=100 不污染（D-07）', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);

    c.storeBuffer(INIT_URL, vid, makeInit());
    c.storeBuffer('https://a.com/vod/seg0.m4s', vid, makeBuffer(128, 1));
    c.storeBuffer('https://a.com/vod/seg1.m4s', vid, makeBuffer(128, 2));

    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(Object.keys(meta.segments).length, 2, 'init 不占 segments 名额');
    assert.strictEqual(meta.playlist_order.length, 2);

    const info = c.getConvertInfo(vid);
    assert.strictEqual(info.segmentPaths.length, 2, 'segmentPaths 不含 init');
    assert.strictEqual(info.completeness, 100, 'init 不计入完整度分母（D-07）');
  });

  test('getConvertInfo 透出 initPath/hasFmp4Map；历史无 init_segment 条目 initPath=null', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });

    // ① fMP4 清单 + init 已留存 → initPath 非 null 且文件存在
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, PLAYLIST);
    c.storeBuffer(INIT_URL, vid, makeInit());
    const info = c.getConvertInfo(vid);
    assert.strictEqual(info.hasFmp4Map, true);
    assert.ok(info.initPath, 'init_segment 已登记且文件存在 → initPath 非 null');
    assert.ok(fs.existsSync(info.initPath), 'initPath 应指向真实存在的 init 文件');
    assert.ok(info.initPath.endsWith(path.sep + 'init'), 'initPath 应指向 <videoDir>/init');

    // ② fMP4 清单但 init 未留存（45-03 前历史条目）→ initPath=null（init_missing 兜底前提）
    const vid2 = c.touchVideo('https://a.com/vod2/index.m3u8');
    c.updatePlaylistIndex('https://a.com/vod2/index.m3u8', PLAYLIST);
    const info2 = c.getConvertInfo(vid2);
    assert.strictEqual(info2.hasFmp4Map, true);
    assert.strictEqual(info2.initPath, null, 'init 未留存 → initPath=null');

    // ③ 普通 TS 清单（无 MAP）→ hasFmp4Map=false、initPath=null（TS 路径不受影响）
    const TS_PLAYLIST = [
      '#EXTM3U',
      '#EXTINF:5.0,',
      'seg0.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');
    const vid3 = c.touchVideo('https://a.com/ts/index.m3u8');
    c.updatePlaylistIndex('https://a.com/ts/index.m3u8', TS_PLAYLIST);
    const info3 = c.getConvertInfo(vid3);
    assert.strictEqual(info3.hasFmp4Map, false);
    assert.strictEqual(info3.initPath, null);
  });

  test('BYTERANGE 形态 MAP → 记 map_byterange 不登记 map_uris（init_missing 兜底前提）', () => {
    const root = makeCacheRoot();
    const c = new MediaCacheManager({ cacheRoot: root });
    const BR_PLAYLIST = [
      '#EXTM3U',
      '#EXT-X-MAP:URI="init.mp4",BYTERANGE="720@0"',
      '#EXTINF:5.0,',
      'seg0.m4s',
      '#EXT-X-ENDLIST',
    ].join('\n');
    const vid = c.touchVideo(M3U8);
    c.updatePlaylistIndex(M3U8, BR_PLAYLIST);
    const meta = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta.has_fmp4_map, true, 'BYTERANGE 形态仍标记 has_fmp4_map');
    assert.strictEqual(meta.map_byterange, '720@0');
    assert.strictEqual(meta.map_uris, undefined, 'BYTERANGE 形态不登记 map_uris（不支持，转换落 init_missing）');

    // init 请求按普通分片处理（无 map_uris 可命中）；getConvertInfo initPath=null
    c.storeBuffer(INIT_URL, vid, makeInit());
    const meta2 = JSON.parse(fs.readFileSync(path.join(root, vid, 'meta.json'), 'utf8'));
    assert.strictEqual(meta2.init_segment, undefined, 'BYTERANGE 形态不留存 init_segment');
    const info = c.getConvertInfo(vid);
    assert.strictEqual(info.hasFmp4Map, true);
    assert.strictEqual(info.initPath, null, 'BYTERANGE 形态 initPath=null → 入口 init_missing 早拒');
  });
});

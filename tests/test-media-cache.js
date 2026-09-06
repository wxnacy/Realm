/**
 * media-cache-manager 单元测试（node:test，纯 Node 环境）
 *
 * 覆盖（Phase 44 Wave 0）：
 * - D-12：续播 key = origin+pathname，query 时效 token 不参与
 * - D-05：分片落盘 + meta.json 索引（实际字节数 + sha256）
 * - D-09：读取时哈希/大小校验失败 → 删片 → miss（回源播放不中断）
 * - D-06/D-07：容量 FIFO 淘汰（按 last_watched 升序整目录删除）+ 活跃任务豁免
 * - D-08：写盘 ENOSPC → 强制淘汰一轮 → 重试；仍失败返回 disk_full
 * - D-10：已登记分片再次 store 跳过不重写（增量续存）
 * - T-44-01/T-44-02：路径安全（videoId 白名单 + symlink 逃逸拒绝）
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

describe('FIFO 淘汰与活跃豁免（D-06/D-07）', () => {
  test('超容量按 last_watched 升序整目录删除', () => {
    const c = new MediaCacheManager({ cacheRoot: makeCacheRoot(), capacityBytes: 100 });
    const vids = [];
    const sizes = [60, 50, 40];
    const urls = ['https://s.com/v1.m3u8', 'https://s.com/v2.m3u8', 'https://s.com/v3.m3u8'];
    urls.forEach((u, i) => {
      const vid = c.touchVideo(u);
      c.storeBuffer(`https://cdn.com/${i}.ts`, vid, makeBuffer(sizes[i], i), { lastWatched: 1000 + i });
      vids.push(vid);
    });
    // 总 150 > 100：最久没看的 v1（60B）先删
    const r = c.evictIfNeeded();
    assert.strictEqual(r.evicted.length, 1);
    assert.strictEqual(r.evicted[0], vids[0]);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[0])), false);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[1])), true);
    assert.strictEqual(fs.existsSync(path.join(c.cacheRoot, vids[2])), true);
    assert.ok(r.total <= 100);
  });

  test('活跃任务豁免淘汰（isVideoActive 按 playbackKey 匹配，D-07）', () => {
    // 回调契约：逐视频按 meta.playback_key（m3u8 的 origin+pathname）查询，
    // 与 44-02 media-task-manager.isVideoActive 的注入契约一致
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

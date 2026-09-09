/**
 * media-sniffer addMedia 字段合并语义单元测试（node:test，纯 Node 环境）
 *
 * 背景：媒体面板需展示 title/duration/thumbnail，但网络拦截先发现的条目
 * 不含这三个字段，DOM/脚本注入方式后补的同 URL 条目此前被 dedup 直接吞掉。
 * addMedia 现支持同 URL 合并：非空 title / 非零 duration / 非空 thumbnail
 * 填充到已有空字段，返回 'updated'；无字段变化返回 false；新增返回 true。
 *
 * 用法: node tests/test-media-sniffer-merge.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const sniffer = require('../media-sniffer');

// 每个用例使用独立 webContentsId，避免单例状态相互污染
let wcSeq = 90000;
function nextWc() {
  return ++wcSeq;
}

describe('addMedia 新增与去重', () => {
  test('新增返回 true，重复上报（无新字段）返回 false', () => {
    const wc = nextWc();
    const item = { url: 'https://a.example.com/v.mp4', type: 'mp4', source: 'network' };
    assert.strictEqual(sniffer.addMedia(wc, item), true);
    assert.strictEqual(sniffer.addMedia(wc, item), false);
    assert.strictEqual(sniffer.getMediaList(wc).length, 1);
  });

  test('无效入参返回 false', () => {
    const wc = nextWc();
    assert.strictEqual(sniffer.addMedia(wc, null), false);
    assert.strictEqual(sniffer.addMedia(wc, {}), false);
    assert.strictEqual(sniffer.addMedia(null, { url: 'https://a.example.com/v.mp4' }), false);
  });
});

describe('addMedia 同 URL 字段合并', () => {
  test('先到空字段条目 + 后到富字段条目 → 合并并返回 updated', () => {
    const wc = nextWc();
    // 网络拦截先到：只有 url/type/source
    assert.strictEqual(
      sniffer.addMedia(wc, { url: 'https://b.example.com/v.mp4', type: 'mp4', source: 'network' }),
      true
    );
    // DOM 方式后补：带 title/duration/thumbnail
    const result = sniffer.addMedia(wc, {
      url: 'https://b.example.com/v.mp4',
      type: 'mp4',
      source: 'dom',
      title: '测试视频',
      duration: 125,
      thumbnail: 'https://b.example.com/poster.jpg',
    });
    assert.strictEqual(result, 'updated');

    const list = sniffer.getMediaList(wc);
    assert.strictEqual(list.length, 1, '不应产生重复条目');
    assert.strictEqual(list[0].title, '测试视频');
    assert.strictEqual(list[0].duration, 125);
    assert.strictEqual(list[0].thumbnail, 'https://b.example.com/poster.jpg');
    assert.strictEqual(list[0].source, 'network', '原始 source 不被覆盖');
  });

  test('空字段不覆盖已有值', () => {
    const wc = nextWc();
    assert.strictEqual(
      sniffer.addMedia(wc, {
        url: 'https://c.example.com/v.mp4',
        type: 'mp4',
        source: 'script',
        title: '原始标题',
        duration: 60,
        thumbnail: 'https://c.example.com/p.jpg',
      }),
      true
    );
    // 后到条目字段全空 → 无合并，返回 false
    assert.strictEqual(
      sniffer.addMedia(wc, { url: 'https://c.example.com/v.mp4', type: 'mp4', source: 'dom' }),
      false
    );
    const item = sniffer.getMediaList(wc)[0];
    assert.strictEqual(item.title, '原始标题');
    assert.strictEqual(item.duration, 60);
    assert.strictEqual(item.thumbnail, 'https://c.example.com/p.jpg');
  });

  test('部分字段补充：只填空缺字段，返回 updated', () => {
    const wc = nextWc();
    assert.strictEqual(
      sniffer.addMedia(wc, {
        url: 'https://d.example.com/v.mp4',
        type: 'mp4',
        source: 'script',
        title: '已有标题',
      }),
      true
    );
    const result = sniffer.addMedia(wc, {
      url: 'https://d.example.com/v.mp4',
      type: 'mp4',
      source: 'dom',
      title: '不应覆盖',
      duration: 30,
    });
    assert.strictEqual(result, 'updated');
    const item = sniffer.getMediaList(wc)[0];
    assert.strictEqual(item.title, '已有标题', '已有 title 不被覆盖');
    assert.strictEqual(item.duration, 30, '空缺 duration 被补充');
    assert.strictEqual(item.thumbnail, '');
  });

  test('重复上报相同富字段 → 返回 false（无实际变化）', () => {
    const wc = nextWc();
    const rich = {
      url: 'https://e.example.com/v.mp4',
      type: 'mp4',
      source: 'dom',
      title: '标题',
      duration: 10,
      thumbnail: 'https://e.example.com/t.jpg',
    };
    assert.strictEqual(sniffer.addMedia(wc, rich), true);
    assert.strictEqual(sniffer.addMedia(wc, { ...rich }), false);
  });
});

describe('setPageInfo og:image 页面级兜底', () => {
  test('先缓存后新增：网络条目 thumbnail 用 og:image 兜底', () => {
    const wc = nextWc();
    sniffer.setPageInfo(wc, { thumbnail: 'https://f.example.com/og.jpg' });
    sniffer.addMedia(wc, { url: 'https://f.example.com/v.m3u8', type: 'm3u8', source: 'network' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://f.example.com/og.jpg');
  });

  test('后上报回填：已有空 thumbnail 条目被补上，已有值不被覆盖', () => {
    const wc = nextWc();
    sniffer.addMedia(wc, { url: 'https://g.example.com/a.m3u8', type: 'm3u8', source: 'network' });
    sniffer.addMedia(wc, {
      url: 'https://g.example.com/b.mp4', type: 'mp4', source: 'script',
      thumbnail: 'https://g.example.com/poster.jpg',
    });
    sniffer.setPageInfo(wc, { thumbnail: 'https://g.example.com/og.jpg' });
    const list = sniffer.getMediaList(wc);
    assert.strictEqual(list[0].thumbnail, 'https://g.example.com/og.jpg', '空 thumbnail 被回填');
    assert.strictEqual(list[1].thumbnail, 'https://g.example.com/poster.jpg', '已有 poster 不被覆盖');
  });

  test('非 http 缩略图拒绝缓存', () => {
    const wc = nextWc();
    sniffer.setPageInfo(wc, { thumbnail: 'javascript:alert(1)' });
    sniffer.setPageInfo(wc, {});
    sniffer.setPageInfo(wc, null);
    sniffer.addMedia(wc, { url: 'https://h.example.com/v.m3u8', type: 'm3u8', source: 'network' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, '');
  });

  test('clearMediaList 同步清理 pageInfo 缓存', () => {
    const wc = nextWc();
    sniffer.setPageInfo(wc, { thumbnail: 'https://i.example.com/og.jpg' });
    sniffer.clearMediaList(wc);
    sniffer.addMedia(wc, { url: 'https://i.example.com/v.m3u8', type: 'm3u8', source: 'network' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, '');
  });

  test('og:image 变更覆盖页面级旧缩略图（SPA 站内导航）', () => {
    const wc = nextWc();
    sniffer.setPageInfo(wc, { thumbnail: 'https://j.example.com/old.jpg' });
    sniffer.addMedia(wc, { url: 'https://j.example.com/v.m3u8', type: 'm3u8', source: 'network' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://j.example.com/old.jpg');
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnailFromPage, true);
    // SPA 导航后新 og:image 上报 → 覆盖
    sniffer.setPageInfo(wc, { thumbnail: 'https://j.example.com/new.jpg' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://j.example.com/new.jpg');
  });

  test('跨页面残留条目不被新页面 og:image 回填/覆盖', () => {
    const wc = nextWc();
    const orig = sniffer._getPageContext;
    try {
      // 旧页面（lck 频道）时期创建条目
      sniffer._getPageContext = () => ({ title: 'lck', url: 'https://twitch.tv/lck' });
      sniffer.setPageInfo(wc, { thumbnail: 'https://cdn.example.com/lck.jpg' });
      sniffer.addMedia(wc, { url: 'https://j.example.com/lck.m3u8', type: 'm3u8', source: 'network' });
      assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://cdn.example.com/lck.jpg');

      // SPA 导航到新频道：URL 变化 + 新 og:image 上报
      sniffer._getPageContext = () => ({ title: 'failverde', url: 'https://twitch.tv/failverde' });
      sniffer.setPageInfo(wc, { thumbnail: 'https://cdn.example.com/failverde.jpg' });

      // 旧条目（pageUrl=lck）保留旧封面，不被新 og:image 覆盖
      assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://cdn.example.com/lck.jpg');
      // 新条目用新 og:image
      sniffer.addMedia(wc, { url: 'https://j.example.com/failverde.m3u8', type: 'm3u8', source: 'network' });
      assert.strictEqual(sniffer.getMediaList(wc)[1].thumbnail, 'https://cdn.example.com/failverde.jpg');
    } finally {
      sniffer._getPageContext = orig;
    }
  });

  test('元素 poster 顶掉页面级缩略图，且不再被 og:image 覆盖', () => {
    const wc = nextWc();
    sniffer.setPageInfo(wc, { thumbnail: 'https://k.example.com/og.jpg' });
    sniffer.addMedia(wc, { url: 'https://k.example.com/v.mp4', type: 'mp4', source: 'network' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnailFromPage, true);
    // DOM 方式补到 poster → 顶掉 og:image
    const result = sniffer.addMedia(wc, {
      url: 'https://k.example.com/v.mp4', type: 'mp4', source: 'dom',
      thumbnail: 'https://k.example.com/poster.jpg',
    });
    assert.strictEqual(result, 'updated');
    const item = sniffer.getMediaList(wc)[0];
    assert.strictEqual(item.thumbnail, 'https://k.example.com/poster.jpg');
    assert.strictEqual(item.thumbnailFromPage, false);
    // og:image 再变也不覆盖 poster
    sniffer.setPageInfo(wc, { thumbnail: 'https://k.example.com/og2.jpg' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://k.example.com/poster.jpg');
  });

  test('clearPageInfo 清空缓存：SPA 导航后新条目先无封面，旧条目不受影响', () => {
    const wc = nextWc();
    sniffer.setPageInfo(wc, { thumbnail: 'https://l.example.com/old-og.jpg' });
    sniffer.addMedia(wc, { url: 'https://l.example.com/old.m3u8', type: 'm3u8', source: 'network' });
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://l.example.com/old-og.jpg');

    // SPA 路径变化 → 清空 pageInfo 缓存
    sniffer.clearPageInfo(wc);

    // 新页面条目：无页面级缩略图可用，先无封面
    sniffer.addMedia(wc, { url: 'https://l.example.com/new.m3u8', type: 'm3u8', source: 'network' });
    assert.strictEqual(sniffer.getMediaList(wc)[1].thumbnail, '');
    // 旧条目封面原样保留
    assert.strictEqual(sniffer.getMediaList(wc)[0].thumbnail, 'https://l.example.com/old-og.jpg');

    // 新 og:image 上报后，新条目获得封面
    sniffer.setPageInfo(wc, { thumbnail: 'https://l.example.com/new-og.jpg' });
    assert.strictEqual(sniffer.getMediaList(wc)[1].thumbnail, 'https://l.example.com/new-og.jpg');
  });
});

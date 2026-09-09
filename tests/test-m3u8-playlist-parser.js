/**
 * media-m3u8-parser 纯函数解析器单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：MEDIA-SEQUENCE 基线序号、分片列举与 seq 编号、ENDLIST live/VOD 判定、
 * TARGETDURATION 缺省值、EXTINF 时长归属、KEY 等标签行与注释行忽略、
 * resolveUri 相对 URI → 绝对 URL。
 *
 * 用法: node tests/test-m3u8-playlist-parser.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const parser = require('../media-m3u8-parser');

describe('parsePlaylist 分片列举与序列号', () => {
  test('MEDIA-SEQUENCE 基线 + 3 条分片 → seq 连续编号', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:100',
      '#EXTINF:5.0,',
      'seg0.ts',
      '#EXTINF:5.0,',
      'seg1.ts',
      '#EXTINF:5.0,',
      'seg2.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.deepStrictEqual(
      r.segments.map((s) => s.seq),
      [100, 101, 102]
    );
    assert.strictEqual(r.mediaSequence, 100);
    assert.deepStrictEqual(
      r.segments.map((s) => s.uri),
      ['seg0.ts', 'seg1.ts', 'seg2.ts']
    );
  });

  test('缺 MEDIA-SEQUENCE 时基线为 0', () => {
    const text = ['#EXTM3U', '#EXTINF:4.0,', 'a.ts', 'b.ts'].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.mediaSequence, 0);
    assert.deepStrictEqual(
      r.segments.map((s) => s.seq),
      [0, 1]
    );
  });
});

describe('parsePlaylist live/VOD 判定', () => {
  test('含 EXT-X-ENDLIST → ended=true、isLive=false', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXTINF:6.0,',
      'v0.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.ended, true);
    assert.strictEqual(r.isLive, false);
  });

  test('不含 EXT-X-ENDLIST → ended=false、isLive=true', () => {
    const text = ['#EXTM3U', '#EXTINF:6.0,', 'v0.ts'].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.ended, false);
    assert.strictEqual(r.isLive, true);
  });
});

describe('parsePlaylist TARGETDURATION', () => {
  test('EXT-X-TARGETDURATION:6 → targetDuration=6', () => {
    const text = ['#EXTM3U', '#EXT-X-TARGETDURATION:6', '#EXTINF:6.0,', 'v0.ts'].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.targetDuration, 6);
  });

  test('缺失 → 缺省 6', () => {
    const r = parser.parsePlaylist('#EXTM3U\n#EXTINF:4.0,\nv0.ts');
    assert.strictEqual(r.targetDuration, 6);
  });
});

describe('parsePlaylist EXTINF 时长归属', () => {
  test('EXTINF:5.0 紧邻分片 → duration=5.0', () => {
    const text = ['#EXTM3U', '#EXTINF:5.0,', 'seg0.ts', 'seg1.ts'].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.segments[0].duration, 5.0);
    assert.strictEqual(r.segments[1].duration, null);
  });

  test('EXTINF 带逗号标题仍可解析时长', () => {
    const text = ['#EXTM3U', '#EXTINF:8.25,live segment title', 'seg0.ts'].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.segments[0].duration, 8.25);
  });
});

describe('parsePlaylist 标签行与注释行忽略', () => {
  test('KEY/注释/空行不产生分片', () => {
    const text = [
      '#EXTM3U',
      '# 一些注释行',
      '',
      '#EXT-X-KEY:METHOD=AES-128,URI="https://k/keys.key",IV=0x1',
      '#EXT-X-PROGRAM-DATE-TIME:2026-09-06T00:00:00Z',
      '#EXTINF:5.0,',
      'seg0.ts',
      '',
      '# trailing comment',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.segments.length, 1);
    assert.strictEqual(r.segments[0].uri, 'seg0.ts');
  });

  test('非分片 # 行不影响 seq 连续编号', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-MEDIA-SEQUENCE:7',
      '#EXT-X-KEY:METHOD=NONE',
      '#EXTINF:3.0,',
      'a.ts',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:3.0,',
      'b.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.deepStrictEqual(
      r.segments.map((s) => s.seq),
      [7, 8]
    );
  });

  test('空输入返回空结构', () => {
    const r = parser.parsePlaylist('');
    assert.deepStrictEqual(r.segments, []);
    assert.strictEqual(r.mediaSequence, 0);
    assert.strictEqual(r.targetDuration, 6);
    assert.strictEqual(r.ended, false);
    assert.strictEqual(r.isLive, true);
  });
});

describe('parsePlaylist 加密检测（EXT-X-KEY，G-44-7）', () => {
  test('AES-128 + 相对 URI → hasEncryption=true 且 keyUris=["enc.key"]', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x00000000000000000000000000000001',
      '#EXTINF:5.0,',
      'seg0.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.hasEncryption, true);
    assert.deepStrictEqual(r.keyUris, ['enc.key']);
  });

  test('METHOD=NONE → hasEncryption=false 且 keyUris 为空', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=NONE',
      '#EXTINF:5.0,',
      'seg0.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.hasEncryption, false);
    assert.deepStrictEqual(r.keyUris, []);
  });

  test('无 KEY 标签清单 → hasEncryption=false、keyUris 为空', () => {
    const text = ['#EXTM3U', '#EXTINF:5.0,', 'seg0.ts'].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.hasEncryption, false);
    assert.deepStrictEqual(r.keyUris, []);
  });

  test('SAMPLE-AES → hasEncryption=true', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="k/key.bin"',
      '#EXTINF:5.0,',
      'seg0.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.hasEncryption, true);
    assert.deepStrictEqual(r.keyUris, ['k/key.bin']);
  });

  test('多 KEY 行（NONE 在后）→ 仍 true，只收集加密行 URI', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="enc.key"',
      '#EXTINF:5.0,',
      'seg0.ts',
      '#EXT-X-KEY:METHOD=NONE',
      '#EXTINF:5.0,',
      'seg1.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.hasEncryption, true);
    assert.deepStrictEqual(r.keyUris, ['enc.key']);
  });

  test('IV 属性捕获（AES-128 转换解密链路）：IV=0x... → keyIv 为小写 hex（无 0x 前缀）', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x000000000000000000000000000000AB',
      '#EXTINF:5.0,',
      'seg0.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.keyIv, '000000000000000000000000000000ab');
  });

  test('无 IV 属性 → keyIv=null（按 HLS 规范回落分片 seq 推导）', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="enc.key"',
      '#EXTINF:5.0,',
      'seg0.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.keyIv, null);
  });

  test('多加密 KEY 行只取首个 IV（单密钥轮换场景）；无加密行 keyIv=null', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="k1.key",IV=0x00000000000000000000000000000001',
      '#EXTINF:5.0,',
      'seg0.ts',
      '#EXT-X-KEY:METHOD=AES-128,URI="k2.key",IV=0x00000000000000000000000000000002',
      '#EXTINF:5.0,',
      'seg1.ts',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.keyIv, '00000000000000000000000000000001');
    const plain = parser.parsePlaylist(['#EXTM3U', '#EXTINF:5.0,', 'seg0.ts'].join('\n'));
    assert.strictEqual(plain.keyIv, null);
  });
});

describe('parsePlaylist EXT-X-MAP 捕获（D-05，fMP4 init 分片）', () => {
  test('URI 属性 → mapUri 捕获，BYTERANGE 缺省 null', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      '#EXT-X-TARGETDURATION:1',
      '#EXT-X-MAP:URI="init.m4s"',
      '#EXTINF:1.00,',
      '1788796260.m4s',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.mapUri, 'init.m4s');
    assert.strictEqual(r.mapByterange, null);
  });

  test('BYTERANGE 属性 → mapByterange 原样字符串捕获备用', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-MAP:URI="init.mp4",BYTERANGE="720@0"',
      '#EXTINF:1.00,',
      'seg0.m4s',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.mapUri, 'init.mp4');
    assert.strictEqual(r.mapByterange, '720@0');
  });

  test('无 MAP 标签清单 → mapUri=null、mapByterange=null（向后兼容）', () => {
    const text = ['#EXTM3U', '#EXTINF:5.0,', 'seg0.ts'].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.mapUri, null);
    assert.strictEqual(r.mapByterange, null);
  });

  test('清单含两个 MAP 标签 → 取后一个（RFC 8216 §4.3.2.5 作用域覆盖语义）', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-MAP:URI="init-old.m4s"',
      '#EXTINF:1.00,',
      'seg0.m4s',
      '#EXT-X-MAP:URI="init-new.m4s",BYTERANGE="720@0"',
      '#EXTINF:1.00,',
      'seg1.m4s',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.mapUri, 'init-new.m4s');
    assert.strictEqual(r.mapByterange, '720@0');
  });

  test('B 站实测形态：EXT-BILI-AUX 等未知标签混合 → 安全忽略，mapUri 捕获不受影响', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      '#EXT-X-START:TIME-OFFSET=0',
      '#EXT-X-MEDIA-SEQUENCE:1788796260',
      '#EXT-X-TARGETDURATION:1',
      '#EXT-X-MAP:URI="h1788488973.m4s"',
      '#EXT-BILI-AUX:1250faff|K|1cdf5|a9a7bf95',
      '#EXTINF:1.00,1cdf5|a9a7bf95',
      '1788796260.m4s',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.strictEqual(r.mapUri, 'h1788488973.m4s');
    assert.strictEqual(r.mapByterange, null);
    assert.deepStrictEqual(
      r.segments.map((s) => s.uri),
      ['1788796260.m4s']
    );
  });
});

describe('resolveUri 相对 URI 解析', () => {
  test('相对路径以清单 URL 为 base 解析为绝对 URL', () => {
    assert.strictEqual(
      parser.resolveUri('seg1.ts', 'https://h/live.m3u8'),
      'https://h/seg1.ts'
    );
  });

  test('带子路径的相对 URI 正确拼接', () => {
    assert.strictEqual(
      parser.resolveUri('../v/seg2.ts', 'https://h/live/index.m3u8'),
      'https://h/v/seg2.ts'
    );
  });

  test('绝对 URL 原样返回', () => {
    assert.strictEqual(
      parser.resolveUri('https://cdn.example.com/x/seg3.ts', 'https://h/live.m3u8'),
      'https://cdn.example.com/x/seg3.ts'
    );
  });

  test('带 query 的相对 URI 保留参数', () => {
    assert.strictEqual(
      parser.resolveUri('seg4.ts?token=abc', 'https://h/live.m3u8'),
      'https://h/seg4.ts?token=abc'
    );
  });
});

describe('EXT-BILI-AUX 关键帧标记（segments[].keyframe）', () => {
  test('K→true、N→false，逐分片归属（B 站直播实测形态）', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:1',
      '#EXT-X-MEDIA-SEQUENCE:100',
      '#EXT-BILI-AUX:23cb5881|K|22beb|96fbd8f8',
      '#EXTINF:1.00,22beb|96fbd8f8',
      'seg100.m4s',
      '#EXT-BILI-AUX:23cb5c69|N|f96a|c64d1acc',
      '#EXTINF:1.00,f96a|c64d1acc',
      'seg101.m4s',
      '#EXT-BILI-AUX:23cb6439|K|230da|cdaa1e7a',
      '#EXTINF:1.00,230da|cdaa1e7a',
      'seg102.m4s',
    ].join('\n');
    const r = parser.parsePlaylist(text);
    assert.deepStrictEqual(
      r.segments.map((s) => s.keyframe),
      [true, false, true],
      'EXT-BILI-AUX 第二字段 K/N 逐分片归属'
    );
  });

  test('无 EXT-BILI-AUX 标签 → keyframe=null（未知，不做关键帧假设）', () => {
    const text = '#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2.00,\nseg1.ts\n#EXTINF:2.00,\nseg2.ts\n';
    const r = parser.parsePlaylist(text);
    assert.deepStrictEqual(r.segments.map((s) => s.keyframe), [null, null]);
  });

  test('未知字段值 → keyframe=null（不产生误判）', () => {
    const text = '#EXTM3U\n#EXT-BILI-AUX:abc|X|def\n#EXTINF:1.00,\nseg1.m4s\n';
    const r = parser.parsePlaylist(text);
    assert.deepStrictEqual(r.segments.map((s) => s.keyframe), [null]);
  });
});

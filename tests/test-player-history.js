/**
 * player-history-manager 单元测试（node:test，纯 Node 环境）
 *
 * 覆盖（Phase 44 G-44-8）：
 * - deleteByKey：按 playbackKey 参数化删除（upsert → delete → getByKey 闭环）
 * - 删除幂等：对不存在的 key 返回 false（changes 计数 0）
 * - 防御：未初始化 / 空串 / 非字符串入参返回 false 不抛异常
 * - 删后重建：删除后再 upsertProgress 同 key 可重新写入
 *
 * 用法: node tests/test-player-history.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MOD_PATH = require.resolve('../player-history-manager');

/** 临时 db 文件路径 */
function makeDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'realm-player-history-test-')), 'player-history.db');
}

/** 造一条播放进度记录 */
function makeRecord(playbackKey, position) {
  return {
    playbackKey,
    url: `${playbackKey}?t=token`,
    title: `标题-${playbackKey}`,
    position,
    duration: 600,
    lastWatched: 1788764708000 + position,
  };
}

describe('未初始化 / 非法入参防御（G-44-8）', () => {
  test('未初始化（未调 init）时 deleteByKey 返回 false 不抛异常', () => {
    // 清 require 缓存拿全新模块实例（db 为 null 的初始态）
    delete require.cache[MOD_PATH];
    const fresh = require('../player-history-manager');
    assert.strictEqual(fresh.deleteByKey('https://a.com/x.m3u8'), false);
  });

  test('空串与非字符串入参返回 false 不抛异常', () => {
    delete require.cache[MOD_PATH];
    const fresh = require('../player-history-manager');
    assert.strictEqual(fresh.deleteByKey(''), false);
    assert.strictEqual(fresh.deleteByKey(123), false);
    assert.strictEqual(fresh.deleteByKey(null), false);
    assert.strictEqual(fresh.deleteByKey(undefined), false);
    assert.strictEqual(fresh.deleteByKey({ key: 'x' }), false);
  });
});

describe('deleteByKey 删除闭环（G-44-8）', () => {
  /** @type {ReturnType<typeof require<typeof import('../player-history-manager')>>} */
  let phm;
  let dbPath;

  test('setup: init + upsert 两条记录', () => {
    delete require.cache[MOD_PATH];
    phm = require('../player-history-manager');
    dbPath = makeDbPath();
    assert.strictEqual(phm.init({ dbPath }), undefined);
    assert.strictEqual(phm.upsertProgress(makeRecord('https://a.com/x.m3u8', 10)), true);
    assert.strictEqual(phm.upsertProgress(makeRecord('https://b.com/y.m3u8', 20)), true);
    assert.ok(phm.getByKey('https://a.com/x.m3u8'));
    assert.ok(phm.getByKey('https://b.com/y.m3u8'));
  });

  test('deleteByKey 删除存在的 key 返回 true，仅删目标条目', () => {
    assert.strictEqual(phm.deleteByKey('https://a.com/x.m3u8'), true);
    assert.strictEqual(phm.getByKey('https://a.com/x.m3u8'), null);
    // 其他记录不受影响
    const other = phm.getByKey('https://b.com/y.m3u8');
    assert.ok(other);
    assert.strictEqual(other.playback_key, 'https://b.com/y.m3u8');
    assert.strictEqual(other.title, '标题-https://b.com/y.m3u8');
  });

  test('deleteByKey 对不存在的 key 返回 false（幂等）', () => {
    assert.strictEqual(phm.deleteByKey('https://a.com/x.m3u8'), false);
    assert.strictEqual(phm.deleteByKey('https://never-exists.com/z.m3u8'), false);
  });

  test('删后重建：再 upsertProgress 同 key 可重新写入', () => {
    assert.strictEqual(phm.upsertProgress(makeRecord('https://a.com/x.m3u8', 99)), true);
    const row = phm.getByKey('https://a.com/x.m3u8');
    assert.ok(row);
    assert.strictEqual(row.last_position, 99);
    assert.strictEqual(row.title, '标题-https://a.com/x.m3u8');
  });

  test('初始化后非法入参仍返回 false 不抛异常', () => {
    assert.strictEqual(phm.deleteByKey(''), false);
    assert.strictEqual(phm.deleteByKey(42), false);
    assert.strictEqual(phm.deleteByKey(null), false);
  });
});

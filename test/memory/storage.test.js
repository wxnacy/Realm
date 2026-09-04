/**
 * ai-memory-manager 存储层单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：三层 add 落盘回读、懒创建、稳定编号、预算闸门、readContainer
 * 空态、buildGlobalSnapshot 快照语义（含全局两层、不含容器层）。
 * 全部用例经 helpers.withTempMemoryDir 注入临时目录，不触碰真实 userData。
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { withTempMemoryDir } = require('./helpers');
const aiMemoryManager = require('../../ai-memory-manager');

describe('三层存储：add → 落盘 → 回读', () => {
  test('add 写入 USER.md / MEMORY.md / memories/<id>.md 三层并回读一致', (t) => {
    const tmp = withTempMemoryDir('three-layers', t);
    aiMemoryManager.write({ action: 'add', target: 'user', content: '用户偏好简洁回复' });
    aiMemoryManager.write({ action: 'add', target: 'global', content: '项目用 pnpm，不要用 npm' });
    aiMemoryManager.write({
      action: 'add', target: 'container', containerId: 'work',
      content: 'GitHub 已登录，遇到 2FA 先询问用户',
    });

    const userText = fs.readFileSync(path.join(tmp, 'USER.md'), 'utf8');
    const globalText = fs.readFileSync(path.join(tmp, 'MEMORY.md'), 'utf8');
    const containerText = fs.readFileSync(path.join(tmp, 'memories', 'work.md'), 'utf8');

    assert.match(userText, /^\[M1\] 用户偏好简洁回复$/m);
    assert.match(globalText, /^\[M1\] 项目用 pnpm，不要用 npm$/m);
    assert.match(containerText, /^\[M1\] GitHub 已登录，遇到 2FA 先询问用户$/m);
  });

  test('同层多次 add 编号递增（M1、M2…）', (t) => {
    withTempMemoryDir('seq-ids', t);
    const r1 = aiMemoryManager.write({ action: 'add', target: 'global', content: '第一条' });
    const r2 = aiMemoryManager.write({ action: 'add', target: 'global', content: '第二条' });
    assert.strictEqual(r1.entryId, 'M1');
    assert.strictEqual(r2.entryId, 'M2');
  });

  test('懒创建：写前 memories/ 目录与文件不存在，写后存在；未写容器不预建空文件', (t) => {
    const tmp = withTempMemoryDir('lazy-create', t);
    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories')), false);
    assert.strictEqual(fs.existsSync(path.join(tmp, 'USER.md')), false);

    aiMemoryManager.write({ action: 'add', target: 'container', containerId: 'work', content: '站点惯例' });

    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories', 'work.md')), true);
    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories', 'default.md')), false);
    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories', 'work.md.tmp')), false);
  });
});

describe('读取', () => {
  test('readContainer 文件不存在返回 null（空态由工具层翻译文案）', (t) => {
    withTempMemoryDir('read-empty', t);
    assert.strictEqual(aiMemoryManager.readContainer('work'), null);
  });

  test('readContainer 存在时返回全文', (t) => {
    withTempMemoryDir('read-full', t);
    aiMemoryManager.write({ action: 'add', target: 'container', containerId: 'work', content: '站点惯例一' });
    const text = aiMemoryManager.readContainer('work');
    assert.ok(text && text.includes('[M1] 站点惯例一'));
  });
});

describe('预算闸门（D-07/D-08）', () => {
  test('超预算 add 被 throw，错误消息含「先整理旧记忆」指引，文件不变', (t) => {
    const tmp = withTempMemoryDir('budget-over', t);
    aiMemoryManager.write({ action: 'add', target: 'user', content: '初始条目' });
    const before = fs.readFileSync(path.join(tmp, 'USER.md'), 'utf8');

    const big = 'x'.repeat(1500);
    assert.throws(
      () => aiMemoryManager.write({ action: 'add', target: 'user', content: big }),
      (err) => err.message.includes('先整理旧记忆') && err.message.includes('1375'),
    );
    assert.strictEqual(fs.readFileSync(path.join(tmp, 'USER.md'), 'utf8'), before);
  });

  test('恰好等于预算边界可写入', (t) => {
    withTempMemoryDir('budget-edge', t);
    // `[M1] ` 5 字符 + 换行 1 字符 + content = 1375 → content 长度 1369
    const content = 'y'.repeat(1369);
    const result = aiMemoryManager.write({ action: 'add', target: 'user', content });
    assert.strictEqual(result.remaining, 0);
  });
});

describe('快照语义（D-03/D-04）', () => {
  test('buildGlobalSnapshot 含 <persistent-memory> 段与两个层内容、容器记忆索引指引，不含容器层内容', (t) => {
    withTempMemoryDir('snapshot', t);
    aiMemoryManager.write({ action: 'add', target: 'user', content: '用户画像条目一' });
    aiMemoryManager.write({ action: 'add', target: 'global', content: '全局记忆条目一' });
    aiMemoryManager.write({
      action: 'add', target: 'container', containerId: 'work',
      content: '容器特有内容绝不能进快照',
    });

    const snapshot = aiMemoryManager.buildGlobalSnapshot();
    assert.ok(snapshot.includes('<persistent-memory>'));
    assert.ok(snapshot.includes('</persistent-memory>'));
    assert.ok(snapshot.includes('用户画像条目一'));
    assert.ok(snapshot.includes('全局记忆条目一'));
    assert.ok(snapshot.includes('memory_read'));
    assert.ok(snapshot.includes('各容器有独立持久记忆'));
    assert.ok(!snapshot.includes('容器特有内容绝不能进快照'));
  });

  test('两层皆空时仍返回索引指引段（指引不依赖快照内容）', (t) => {
    withTempMemoryDir('snapshot-empty', t);
    const snapshot = aiMemoryManager.buildGlobalSnapshot();
    assert.ok(snapshot.includes('<persistent-memory>'));
    assert.ok(snapshot.includes('memory_read'));
    assert.ok(snapshot.includes('各容器有独立持久记忆'));
  });

  test('buildGlobalSnapshot 是同步函数', (t) => {
    withTempMemoryDir('snapshot-sync', t);
    assert.strictEqual(typeof aiMemoryManager.buildGlobalSnapshot(), 'string');
  });
});

describe('参数校验（fail-closed，throw 而非错误文本）', () => {
  test('未知 target / 非 add action / 缺 content 均 throw', (t) => {
    withTempMemoryDir('param-invalid', t);
    assert.throws(() => aiMemoryManager.write({ action: 'add', target: 'bogus', content: 'x' }));
    assert.throws(() => aiMemoryManager.write({ action: 'add', target: 'user', content: '' }));
    assert.throws(() => aiMemoryManager.write({ action: 'add', target: 'user' }));
  });

  test('container 层缺 containerId / 非法 containerId（路径穿越）throw', (t) => {
    withTempMemoryDir('param-container-id', t);
    assert.throws(() => aiMemoryManager.write({ action: 'add', target: 'container', content: 'x' }));
    assert.throws(() => aiMemoryManager.write({
      action: 'add', target: 'container', containerId: '../evil', content: 'x',
    }));
    assert.throws(() => aiMemoryManager.readContainer('../../evil'));
  });
});

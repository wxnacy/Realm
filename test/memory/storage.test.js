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

describe('replace/remove 语义（D-09/D-10）', () => {
  test('replace 精确改写编号行，其余条目与编号不变', (t) => {
    const tmp = withTempMemoryDir('replace-precise', t);
    aiMemoryManager.write({ action: 'add', target: 'global', content: '第一条' });
    aiMemoryManager.write({ action: 'add', target: 'global', content: '第二条' });
    aiMemoryManager.write({ action: 'add', target: 'global', content: '第三条' });

    aiMemoryManager.write({ action: 'replace', target: 'global', entryId: 'M2', content: '第二条已更新' });
    const globalText = fs.readFileSync(path.join(tmp, 'MEMORY.md'), 'utf8');
    assert.match(globalText, /^\[M1\] 第一条$/m);
    assert.match(globalText, /^\[M2\] 第二条已更新$/m);
    assert.match(globalText, /^\[M3\] 第三条$/m);
  });

  test('remove 只删该行；删除后 add 取 max+1（编号不回收）', (t) => {
    const tmp = withTempMemoryDir('remove-stable-ids', t);
    aiMemoryManager.write({ action: 'add', target: 'global', content: 'M1 内容' });
    aiMemoryManager.write({ action: 'add', target: 'global', content: 'M2 内容' });
    aiMemoryManager.write({ action: 'add', target: 'global', content: 'M3 内容' });

    aiMemoryManager.write({ action: 'remove', target: 'global', entryId: 'M2' });
    const globalText = fs.readFileSync(path.join(tmp, 'MEMORY.md'), 'utf8');
    assert.ok(!globalText.includes('M2 内容'));
    assert.match(globalText, /^\[M1\] M1 内容$/m);
    assert.match(globalText, /^\[M3\] M3 内容$/m);

    const result = aiMemoryManager.write({ action: 'add', target: 'global', content: '新条目' });
    assert.strictEqual(result.entryId, 'M4');
  });

  test('replace/remove 用不存在的编号 throw（不就近匹配），其余条目不受影响', (t) => {
    const tmp = withTempMemoryDir('dangling-id', t);
    aiMemoryManager.write({ action: 'add', target: 'global', content: '唯一条目' });

    assert.throws(
      () => aiMemoryManager.write({ action: 'replace', target: 'global', entryId: 'M9', content: '改写' }),
      (err) => err.message.includes('不存在'),
    );
    assert.throws(
      () => aiMemoryManager.write({ action: 'remove', target: 'global', entryId: 'M9' }),
      (err) => err.message.includes('不存在'),
    );
    const globalText = fs.readFileSync(path.join(tmp, 'MEMORY.md'), 'utf8');
    assert.match(globalText, /^\[M1\] 唯一条目$/m);
  });

  test('entryId 缺失或格式非法 throw，消息含「entryId」指引', (t) => {
    const tmp = withTempMemoryDir('entryid-invalid', t);
    aiMemoryManager.write({ action: 'add', target: 'global', content: '条目' });
    assert.throws(
      () => aiMemoryManager.write({ action: 'replace', target: 'global', content: '改写' }),
      (err) => err.message.includes('entryId'),
    );
    assert.throws(
      () => aiMemoryManager.write({ action: 'remove', target: 'global', entryId: '2' }),
      (err) => err.message.includes('entryId'),
    );
    assert.throws(
      () => aiMemoryManager.write({ action: 'remove', target: 'global', entryId: 'Mabc' }),
      (err) => err.message.includes('entryId'),
    );
  });
});

describe('预算边界（replace 增长受限、缩短不受限）', () => {
  test('replace 加长超出预算 throw，缩短不受限', (t) => {
    const tmp = withTempMemoryDir('replace-budget', t);
    aiMemoryManager.write({ action: 'add', target: 'user', content: '短条目' });

    assert.throws(
      () => aiMemoryManager.write({ action: 'replace', target: 'user', entryId: 'M1', content: 'z'.repeat(1400) }),
      (err) => err.message.includes('记忆已达字符上限（1375）') && err.message.includes('先整理旧记忆'),
    );

    aiMemoryManager.write({ action: 'replace', target: 'user', entryId: 'M1', content: '缩' });
    const userText = fs.readFileSync(path.join(tmp, 'USER.md'), 'utf8');
    assert.match(userText, /^\[M1\] 缩$/m);
  });

  test('remove 释放预算后可再次 add', (t) => {
    const tmp = withTempMemoryDir('remove-frees-budget', t);
    aiMemoryManager.write({ action: 'add', target: 'user', content: 'y'.repeat(1369) });
    assert.throws(
      () => aiMemoryManager.write({ action: 'add', target: 'user', content: '再放一条' }),
      (err) => err.message.includes('先整理旧记忆'),
    );
    aiMemoryManager.write({ action: 'remove', target: 'user', entryId: 'M1' });
    // 文件已空 → 现存最大编号 0，新条目取 max+1 = M1（编号状态完全在文件内）
    const result = aiMemoryManager.write({ action: 'add', target: 'user', content: '整理后的新条目' });
    assert.strictEqual(result.entryId, 'M1');
  });
});

describe('readScope / writeScope（人工编辑原始文本 API，Plan 43-03 消费）', () => {
  test('readScope 文件不存在返回空字符串；container:<id> 路由正确', (t) => {
    withTempMemoryDir('readscope-empty', t);
    assert.strictEqual(aiMemoryManager.readScope('container:work'), '');
    assert.strictEqual(aiMemoryManager.readScope('user'), '');

    aiMemoryManager.write({ action: 'add', target: 'container', containerId: 'work', content: '容器条目' });
    assert.ok(aiMemoryManager.readScope('container:work').includes('[M1] 容器条目'));
  });

  test('非法 scope throw（白名单 user / global / container:<id>）', (t) => {
    withTempMemoryDir('scope-invalid', t);
    assert.throws(() => aiMemoryManager.readScope('bogus'));
    assert.throws(() => aiMemoryManager.writeScope('container:../evil', 'x'));
  });

  test('writeScope 原始文本落盘；超预算 throw；不做威胁扫描（D-11 人工路径）', (t) => {
    const tmp = withTempMemoryDir('writescope', t);
    aiMemoryManager.writeScope('global', '手工编辑的全局记忆');
    assert.strictEqual(fs.readFileSync(path.join(tmp, 'MEMORY.md'), 'utf8'), '手工编辑的全局记忆');

    assert.throws(
      () => aiMemoryManager.writeScope('user', 'z'.repeat(1376)),
      (err) => err.message.includes('记忆已达字符上限（1375）'),
    );

    // D-11 反向证明：人工路径写含「密码」字样的内容不被拦截
    aiMemoryManager.writeScope('user', '备注：密码字样在此仅作测试');
    assert.ok(fs.readFileSync(path.join(tmp, 'USER.md'), 'utf8').includes('密码'));
  });
});

describe('deleteContainerMemory（容器删除联动，Plan 43-02 消费）', () => {
  test('删除容器记忆文件；文件本不存在时不抛错（幂等）', (t) => {
    const tmp = withTempMemoryDir('delete-container-memory', t);
    aiMemoryManager.write({ action: 'add', target: 'container', containerId: 'work', content: '待清理' });
    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories', 'work.md')), true);

    aiMemoryManager.deleteContainerMemory('work');
    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories', 'work.md')), false);
    assert.doesNotThrow(() => aiMemoryManager.deleteContainerMemory('work'));
  });

  test('删除后 memory_read 空态：writeScope 写入 → deleteContainerMemory → readContainer 返回 null', (t) => {
    const tmp = withTempMemoryDir('delete-then-read-empty', t);
    aiMemoryManager.writeScope('container:work', '[M1] 删除前存在的容器记忆');
    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories', 'work.md')), true);
    assert.ok(aiMemoryManager.readContainer('work').includes('[M1]'));

    aiMemoryManager.deleteContainerMemory('work');

    assert.strictEqual(fs.existsSync(path.join(tmp, 'memories', 'work.md')), false);
    assert.strictEqual(aiMemoryManager.readContainer('work'), null);
  });
});

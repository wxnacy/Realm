/**
 * media-task-manager 任务注册表单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：D-25 状态机（running→completed/failed/cancelled/interrupted 合法流转、
 * 非法流转拒绝）、persist 注入调用、restoreTasks 恢复（running→interrupted、
 * 字段类型白名单校验）、onTaskCompleted 接力回调、hasActiveTasks、
 * isVideoActive（D-07 逐视频淘汰豁免查询源，running/终态两态）、listTasks 快照。
 *
 * 用法: node tests/test-media-task-registry.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { createMediaTaskManager } = require('../media-task-manager');

/** 构造注入内存 persist 的注册表，收集每次 persist 的调用 */
function makeManager(options = {}) {
  const persistCalls = [];
  let clock = options.startTime ?? 1000;
  const manager = createMediaTaskManager({
    persist: (tasks) => {
      persistCalls.push(tasks);
    },
    now: () => clock,
    ...options.overrides,
  });
  return {
    manager,
    persistCalls,
    tick: (ms = 1) => {
      clock += ms;
    },
    clockNow: () => clock,
  };
}

describe('registerTask 注册', () => {
  test('返回带唯一 id 的 running 任务，入参字段保留', () => {
    const { manager } = makeManager();
    const task = manager.registerTask({
      type: 'record',
      title: '直播间标题',
      containerId: 'work',
      playbackKey: 'https://live.example.com/stream.m3u8',
    });
    assert.ok(task.id, '应有唯一 id');
    assert.strictEqual(task.type, 'record');
    assert.strictEqual(task.title, '直播间标题');
    assert.strictEqual(task.containerId, 'work');
    assert.strictEqual(task.playbackKey, 'https://live.example.com/stream.m3u8');
    assert.strictEqual(task.status, 'running');
    assert.strictEqual(task.progress, 0);
    assert.strictEqual(task.error, null);
  });

  test('registerTask 触发 persist', () => {
    const { manager, persistCalls } = makeManager();
    manager.registerTask({ type: 'convert', title: '转封装', containerId: 'work' });
    assert.strictEqual(persistCalls.length, 1);
    assert.strictEqual(persistCalls[0].length, 1);
  });

  test('连续注册产生不同 id', () => {
    const { manager } = makeManager();
    const a = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    const b = manager.registerTask({ type: 'record', title: 'b', containerId: 'w' });
    assert.notStrictEqual(a.id, b.id);
  });

  test('非法 type 被拒绝', () => {
    const { manager } = makeManager();
    assert.throws(() => manager.registerTask({ type: 'download', title: 'x', containerId: 'w' }));
  });

  test('title 非字符串被拒绝', () => {
    const { manager } = makeManager();
    assert.throws(() => manager.registerTask({ type: 'record', title: 123, containerId: 'w' }));
  });
});

describe('D-25 状态机流转', () => {
  test('running → completed（含 outputPath）合法', () => {
    const { manager } = makeManager();
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    const done = manager.completeTask(t.id, { outputPath: '/tmp/out.mp4' });
    assert.strictEqual(done.status, 'completed');
    assert.strictEqual(done.outputPath, '/tmp/out.mp4');
  });

  test('running → failed（附带 error 原因）合法', () => {
    const { manager } = makeManager();
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    const failed = manager.failTask(t.id, '网络错误重试 3 次后停录');
    assert.strictEqual(failed.status, 'failed');
    assert.strictEqual(failed.error, '网络错误重试 3 次后停录');
  });

  test('running → cancelled（附带 error 原因）合法', () => {
    const { manager } = makeManager();
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    const cancelled = manager.cancelTask(t.id, '用户停止录制');
    assert.strictEqual(cancelled.status, 'cancelled');
    assert.strictEqual(cancelled.error, '用户停止录制');
  });

  test('markInterrupted: running → interrupted 合法', () => {
    const { manager } = makeManager();
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    const it = manager.markInterrupted(t.id);
    assert.strictEqual(it.status, 'interrupted');
  });

  test('对终态任务再流转 → 抛错（非法流转拒绝）', () => {
    const { manager } = makeManager();
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    manager.completeTask(t.id, { outputPath: '/tmp/out.mp4' });
    assert.throws(() => manager.completeTask(t.id, { outputPath: '/tmp/x.mp4' }));
    assert.throws(() => manager.failTask(t.id, 'err'));
    assert.throws(() => manager.cancelTask(t.id, 'err'));
    assert.throws(() => manager.markInterrupted(t.id));
    assert.throws(() => manager.updateProgress(t.id, 50));
  });

  test('不存在任务 id → 抛错', () => {
    const { manager } = makeManager();
    assert.throws(() => manager.updateProgress('nope', 10));
    assert.throws(() => manager.completeTask('nope', {}));
  });
});

describe('updateProgress', () => {
  test('更新进度并触发 persist，updatedAt 前进', () => {
    const ctx = makeManager();
    const t = ctx.manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    const updatedAtBefore = t.updatedAt;
    ctx.tick(500);
    const updated = ctx.manager.updateProgress(t.id, 42.5);
    assert.strictEqual(updated.progress, 42.5);
    assert.ok(updated.updatedAt > updatedAtBefore);
    assert.ok(ctx.persistCalls.length >= 2);
  });
});

describe('restoreTasks 崩溃恢复（D-18）', () => {
  test('saved 中 running 任务恢复后标记 interrupted，outputPath 保留', () => {
    const { manager } = makeManager();
    const saved = JSON.stringify([
      {
        id: 't1',
        type: 'record',
        title: '直播 A',
        containerId: 'work',
        playbackKey: 'https://x/s.m3u8',
        status: 'running',
        progress: 30,
        outputPath: '/recordings/part',
        error: null,
        createdAt: 100,
        updatedAt: 200,
      },
    ]);
    const restored = manager.restoreTasks(saved);
    assert.strictEqual(restored.length, 1);
    assert.strictEqual(restored[0].status, 'interrupted');
    assert.strictEqual(restored[0].outputPath, '/recordings/part');
    assert.strictEqual(restored[0].progress, 30);
  });

  test('saved 中终态任务原样恢复', () => {
    const { manager } = makeManager();
    const saved = JSON.stringify([
      { id: 't1', type: 'convert', title: 'c', containerId: 'w', status: 'completed', progress: 100, outputPath: '/o.mp4', error: null, createdAt: 1, updatedAt: 2 },
      { id: 't2', type: 'record', title: 'f', containerId: 'w', status: 'failed', progress: 10, outputPath: null, error: 'boom', createdAt: 1, updatedAt: 3 },
    ]);
    const restored = manager.restoreTasks(saved);
    assert.strictEqual(restored.length, 2);
    assert.strictEqual(restored.find((t) => t.id === 't1').status, 'completed');
    assert.strictEqual(restored.find((t) => t.id === 't2').status, 'failed');
  });

  test('非法条目被丢弃（T-44-05 类型白名单）', () => {
    const { manager } = makeManager();
    const saved = JSON.stringify([
      { id: 'ok1', type: 'record', title: 'ok', containerId: 'w', status: 'completed', progress: 1, outputPath: null, error: null, createdAt: 1, updatedAt: 1 },
      { type: 'record', title: 'no-id', status: 'running' },
      { id: 'bad-type', type: 'evil', title: 'x', status: 'running' },
      { id: 'bad-status', type: 'record', title: 'x', status: 'hacked' },
      'not-an-object',
      null,
    ]);
    const restored = manager.restoreTasks(saved);
    assert.strictEqual(restored.length, 1);
    assert.strictEqual(restored[0].id, 'ok1');
  });

  test('未知字段被丢弃（T-44-05）', () => {
    const { manager } = makeManager();
    const saved = JSON.stringify([
      { id: 't1', type: 'record', title: 'x', containerId: 'w', status: 'completed', progress: 1, outputPath: null, error: null, createdAt: 1, updatedAt: 1, injected: 'payload', __proto__: { evil: true } },
    ]);
    const restored = manager.restoreTasks(saved);
    assert.strictEqual(restored[0].injected, undefined);
    assert.strictEqual(restored[0].evil, undefined);
  });

  test('非法 JSON 输入 → 空数组不抛', () => {
    const { manager } = makeManager();
    assert.deepStrictEqual(manager.restoreTasks('not json'), []);
    assert.deepStrictEqual(manager.restoreTasks(null), []);
    assert.deepStrictEqual(manager.restoreTasks(''), []);
  });

  test('恢复后 restore 的 interrupted 任务不可再流转', () => {
    const { manager } = makeManager();
    manager.restoreTasks(
      JSON.stringify([{ id: 't1', type: 'record', title: 'x', containerId: 'w', status: 'running', progress: 0, outputPath: null, error: null, createdAt: 1, updatedAt: 1 }])
    );
    assert.throws(() => manager.cancelTask('t1', 'late'));
  });
});

describe('onTaskCompleted 接力回调（D-22 挂点）', () => {
  test('completeTask 触发回调并收到完整任务对象', () => {
    const { manager } = makeManager();
    const received = [];
    manager.onTaskCompleted((task) => received.push(task));
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w', playbackKey: 'https://x/v.m3u8' });
    manager.completeTask(t.id, { outputPath: '/tmp/a.mp4' });
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].id, t.id);
    assert.strictEqual(received[0].status, 'completed');
    assert.strictEqual(received[0].outputPath, '/tmp/a.mp4');
    assert.strictEqual(received[0].playbackKey, 'https://x/v.m3u8');
  });

  test('多个回调均被触发', () => {
    const { manager } = makeManager();
    let a = 0;
    let b = 0;
    manager.onTaskCompleted(() => a++);
    manager.onTaskCompleted(() => b++);
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    manager.completeTask(t.id, { outputPath: null });
    assert.strictEqual(a, 1);
    assert.strictEqual(b, 1);
  });

  test('failTask/cancelTask 不触发 completed 回调', () => {
    const { manager } = makeManager();
    let calls = 0;
    manager.onTaskCompleted(() => calls++);
    const t1 = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    const t2 = manager.registerTask({ type: 'record', title: 'b', containerId: 'w' });
    manager.failTask(t1.id, 'err');
    manager.cancelTask(t2.id, 'stop');
    assert.strictEqual(calls, 0);
  });
});

describe('hasActiveTasks / isVideoActive', () => {
  test('存在 running 任务 → true，全部终态 → false', () => {
    const { manager } = makeManager();
    assert.strictEqual(manager.hasActiveTasks(), false);
    const t = manager.registerTask({ type: 'record', title: 'a', containerId: 'w' });
    assert.strictEqual(manager.hasActiveTasks(), true);
    manager.completeTask(t.id, { outputPath: null });
    assert.strictEqual(manager.hasActiveTasks(), false);
  });

  test('isVideoActive: running 任务 playbackKey 匹配 → true', () => {
    const { manager } = makeManager();
    manager.registerTask({
      type: 'record',
      title: 'a',
      containerId: 'w',
      playbackKey: 'https://x/live.m3u8',
    });
    assert.strictEqual(manager.isVideoActive('https://x/live.m3u8'), true);
    assert.strictEqual(manager.isVideoActive('https://x/other.m3u8'), false);
  });

  test('isVideoActive: 任务进入终态后变 false（D-07 豁免解除）', () => {
    const { manager } = makeManager();
    const t = manager.registerTask({
      type: 'record',
      title: 'a',
      containerId: 'w',
      playbackKey: 'https://x/live.m3u8',
    });
    assert.strictEqual(manager.isVideoActive('https://x/live.m3u8'), true);
    manager.failTask(t.id, 'err');
    assert.strictEqual(manager.isVideoActive('https://x/live.m3u8'), false);
  });

  test('isVideoActive: 无 playbackKey 的任务不参与豁免', () => {
    const { manager } = makeManager();
    manager.registerTask({ type: 'convert', title: 'c', containerId: 'w' });
    assert.strictEqual(manager.isVideoActive('https://x/live.m3u8'), false);
  });
});

describe('listTasks 快照', () => {
  test('按 updatedAt 降序返回，且不暴露内部引用', () => {
    const ctx = makeManager();
    ctx.manager.registerTask({ type: 'record', title: 'old', containerId: 'w' });
    ctx.tick(100);
    ctx.manager.registerTask({ type: 'convert', title: 'new', containerId: 'w' });
    const list = ctx.manager.listTasks();
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].title, 'new');
    assert.strictEqual(list[1].title, 'old');
    // 快照：修改返回对象不影响注册表内部状态
    list[0].title = 'mutated';
    assert.strictEqual(ctx.manager.listTasks()[0].title, 'new');
  });
});

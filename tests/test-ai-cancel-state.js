/**
 * src/ai-cancel-state.js 单元测试（node:test，纯 Node 环境）
 *
 * 覆盖两件事：
 * - **A 组**：`resolveCancelAttribution` 的纯逻辑表驱动 —— 含 UAT test 4 的**实测序列**
 *   （`[旧 assistant, 新 user, 新 assistant 占位]` + 锚点 = 旧 id / 当前 = 新 id）这一
 *   靶心断言：旧气泡被标取消，而新一轮的轮次状态**不被复位**。
 * - **B 组**：`src/renderer.js` / `src/index.html` 的接线源码护栏（锚点记录于
 *   `abortAIIfStreaming` 与 `handleStopAI`、取消分支按锚点解算且不再读「当前消息 id」、
 *   对话切换两处清空锚点、脚本加载顺序）。
 *
 * **为什么单独一个文件**：`src/renderer.js` 是浏览器脚本、无 `module.exports`，纯 Node
 * 无法 require；把「取消归属」这条时序判定抽到 `src/ai-cancel-state.js`（双模式导出）后，
 * 即可在纯 Node 下秒级表驱动覆盖（真实竞态无法廉价构造）。
 *
 * `src/ai-cancel-state.js` **零 import / 零 require / 零 DOM**，因此本文件不需要任何桩。
 *
 * 用法: node --test tests/test-ai-cancel-state.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const cancelState = require('../src/ai-cancel-state');

/** 消息构造器（只需 role + id 两个字段即足够判定） */
function msg(role, id, content = '') {
  return { role, id, content };
}

describe('A 组 · resolveCancelAttribution —— 纯逻辑表驱动（G-48-4）', () => {
  test('① 正常停止：锚点 = 当前轮 → 命中该条且复位轮次状态', () => {
    const messages = [msg('user', 'u0'), msg('assistant', 'm1', '正文')];
    const r = cancelState.resolveCancelAttribution(messages, 'm1', 'm1');
    assert.strictEqual(r.targetIndex, 1, '目标 = 被取消的那条 assistant 消息');
    assert.strictEqual(r.resetRunState, true, '锚点即当前轮 → 用户点停止的既有语义（复位 + 切回发送）');
  });

  test('② UAT test 4 实测序列：锚点 = 旧 id / 当前 = 新 id → 目标为旧消息且**不复位**', () => {
    // 序列来自 48-UAT.md G-48-4 的 observed：旧 assistant（被中止那一轮）、
    // 新一轮的 user、新一轮的 assistant 占位
    const messages = [
      msg('assistant', 'm1', '旧一轮的正文'),
      msg('user', 'u2', '新的技能调用'),
      msg('assistant', 'm2', ''),
    ];
    const r = cancelState.resolveCancelAttribution(messages, 'm1', 'm2');
    assert.strictEqual(r.targetIndex, 0, '取消只作用于旧气泡（修复前会落到 m2 上写成「用户已取消」）');
    assert.strictEqual(
      r.resetRunState,
      false,
      '新一轮已开始，**不得**复位 aiStreaming / aiCurrentMessageId（复位会让新轮事件整批丢弃）'
    );
  });

  test('③ 锚点为空（空串 / null / undefined）→ 未命中且不复位', () => {
    const messages = [msg('assistant', 'm1')];
    for (const empty of ['', null, undefined]) {
      const r = cancelState.resolveCancelAttribution(messages, empty, 'm1');
      assert.strictEqual(r.targetIndex, -1, `锚点 ${JSON.stringify(empty)} 不得命中任何消息`);
      assert.strictEqual(r.resetRunState, false, `锚点 ${JSON.stringify(empty)} 不得复位轮次状态`);
    }
  });

  test('④ 锚点指向的消息不在列表（切对话后的迟到事件）→ 未命中且不复位', () => {
    const messages = [msg('user', 'u2'), msg('assistant', 'm2')];
    const r = cancelState.resolveCancelAttribution(messages, 'm-old-gone', 'm2');
    assert.strictEqual(r.targetIndex, -1, '列表里没有该 id → 无处可写，不得误落到当前消息上');
    assert.strictEqual(r.resetRunState, false, '锚点 ≠ 当前轮 → 不复位新轮');
  });

  test('⑤ 锚点 = 当前轮但消息已被移除 → 未命中但**仍复位**（按钮语义不丢）', () => {
    const messages = [msg('user', 'u1')];
    const r = cancelState.resolveCancelAttribution(messages, 'm1', 'm1');
    assert.strictEqual(r.targetIndex, -1, '消息已被移除 → 无目标可写');
    assert.strictEqual(
      r.resetRunState,
      true,
      'resetRunState 只由锚点等式决定、与列表形态无关：按钮仍须切回发送'
    );
  });

  test('⑥ 同 id 但 role !== assistant 的条目不得被命中', () => {
    // 用户消息与 assistant 消息的 id 命名空间不同，此处构造病态同 id 以钉死 role 判据
    const messages = [msg('user', 'dup'), msg('system-note', 'dup'), msg('summary', 'dup'), msg('assistant', 'dup')];
    const r = cancelState.resolveCancelAttribution(messages, 'dup', 'dup');
    assert.strictEqual(r.targetIndex, 3, '只有 role === assistant 的那条可被命中');
    assert.strictEqual(r.resetRunState, true);

    const onlyUsers = [msg('user', 'dup'), msg('system-note', 'dup')];
    const r2 = cancelState.resolveCancelAttribution(onlyUsers, 'dup', 'dup');
    assert.strictEqual(r2.targetIndex, -1, '没有 assistant 条目 → 未命中（不得错写系统提示条）');
  });

  test('⑦ 入参守卫：非数组 / 空数组一律不抛错，resetRunState 仍只由锚点等式决定', () => {
    for (const bad of [null, undefined, 'not-an-array', { length: 0 }, 42]) {
      const r = cancelState.resolveCancelAttribution(bad, 'm1', 'm1');
      assert.strictEqual(r.targetIndex, -1, `非数组入参 ${JSON.stringify(bad)} 必须按空列表处理（不得抛错）`);
      assert.strictEqual(
        r.resetRunState,
        true,
        '锚点 = 当前轮 → 即使列表形态不可用也要复位（按钮语义不该被列表形态剥夺）'
      );
    }

    const empty = cancelState.resolveCancelAttribution([], '', '');
    assert.strictEqual(empty.targetIndex, -1, '空数组 + 空锚点 → 未命中');
    assert.strictEqual(empty.resetRunState, false, '空锚点 → 不复位');
  });

  test('返回值形状固定（只有 targetIndex / resetRunState 两个键）', () => {
    const r = cancelState.resolveCancelAttribution([], null, null);
    assert.deepStrictEqual(Object.keys(r).sort(), ['resetRunState', 'targetIndex']);
    assert.strictEqual(typeof r.targetIndex, 'number');
    assert.strictEqual(typeof r.resetRunState, 'boolean');
  });

  test('双模式导出：require 取到普通对象，重复 require 是同一引用（无副作用）', () => {
    assert.strictEqual(typeof cancelState, 'object');
    assert.strictEqual(cancelState.then, undefined, '不得是 thenable');
    assert.strictEqual(typeof cancelState.resolveCancelAttribution, 'function');
    assert.strictEqual(require('../src/ai-cancel-state'), cancelState, '同一 api 对象引用');
  });
});

describe('B 组 · renderer / index.html 接线源码护栏（G-48-4）', () => {
  const REPO_ROOT = path.join(__dirname, '..');
  const rendererSrc = fs.readFileSync(path.join(REPO_ROOT, 'src', 'renderer.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(REPO_ROOT, 'src', 'index.html'), 'utf8');

  /** 取函数体文本（`function <name>(` 到下一个行首 `}`） */
  function functionBody(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `源码中应存在 function ${name}(`);
    const end = source.indexOf('\n}', start);
    return source.slice(start, end);
  }

  /** 取 async 函数体（`async function <name>(` 到下一个行首 `}`） */
  function asyncFunctionBody(source, name) {
    const start = source.indexOf(`async function ${name}(`);
    assert.ok(start >= 0, `源码中应存在 async function ${name}(`);
    const end = source.indexOf('\n}', start);
    return source.slice(start, end);
  }

  test('状态声明：新增 aiCancelledMessageId 锚点，且 aiCancelledByUser 未被删除', () => {
    const decl = rendererSrc.slice(rendererSrc.indexOf('  // AI 助手状态'), rendererSrc.indexOf('  // 对话管理状态'));
    assert.ok(decl.includes('aiCancelledByUser: false'), '既有的 aiCancelledByUser 必须保留（停止按钮语义依赖它）');
    assert.ok(decl.includes('aiCancelledMessageId: null'), '必须新增被取消消息锚点');
  });

  test('锚点记录：abortAIIfStreaming 与 handleStopAI 的函数体都记锚点，catch 两处一并复位', () => {
    const abort = asyncFunctionBody(rendererSrc, 'abortAIIfStreaming');
    assert.ok(
      abort.includes('state.aiCancelledMessageId = state.aiCurrentMessageId'),
      'abortAIIfStreaming 必须在置 aiCancelledByUser 的同处记录锚点'
    );
    assert.ok(abort.includes('state.aiCancelledMessageId = null'), 'catch 分支必须一并清锚点');

    const stop = asyncFunctionBody(rendererSrc, 'handleStopAI');
    assert.ok(
      stop.includes('state.aiCancelledMessageId = state.aiCurrentMessageId'),
      'handleStopAI 同样必须记录锚点'
    );
    assert.ok(stop.includes('state.aiCancelledMessageId = null'), 'catch 分支必须一并清锚点');
    assert.ok(
      /if \(state\.aiCurrentMessageId\) \{[\s\S]*?state\.aiCancelledByUser = true/.test(stop),
      'handleStopAI 仅在存在进行中轮次时才置 aiCancelledByUser 与锚点（无轮次不留空锚点）'
    );
  });

  test('取消分支：按锚点解算、area 内不得按「当前消息 id」查找', () => {
    const start = rendererSrc.indexOf("case 'error': {");
    assert.ok(start >= 0, '应存在 ai 事件的 error 分支');
    const end = rendererSrc.indexOf('// 错误事件：停止流式状态', start);
    assert.ok(end > start, '取消子分支区域应可界定');
    const region = rendererSrc.slice(start, end);

    assert.ok(region.includes('resolveCancelAttribution('), '取消分支必须走纯逻辑归属解算');
    assert.ok(region.includes('state.aiCancelledMessageId'), '解算入参必须含锚点');
    assert.strictEqual(
      region.includes('m.id === state.aiCurrentMessageId'),
      false,
      '取消分支不得再按「当前消息 id」查找（G-48-4 的根因）'
    );
    assert.ok(
      /attribution\.targetIndex >= 0[\s\S]*?attribution\.resetRunState/.test(region),
      '写取消文案用 targetIndex、复位轮次状态用 resetRunState（两者不可互换）'
    );
  });

  test('对话切换两处清空锚点', () => {
    for (const fn of ['switchConversation', 'createNewConversation']) {
      const body = asyncFunctionBody(rendererSrc, fn);
      assert.ok(
        /state\.aiCancelledByUser = false;\s*\n\s*state\.aiCancelledMessageId = null;/.test(body),
        `${fn} 必须在复位 aiCancelledByUser 的同处清空锚点`
      );
    }
  });

  test('脚本加载顺序：ai-cancel-state.js 在 renderer.js 之前（错误分支引用该全局）', () => {
    const modelIdx = htmlSrc.indexOf('skill-picker-model.js');
    const cancelIdx = htmlSrc.indexOf('ai-cancel-state.js');
    const rendererIdx = htmlSrc.indexOf('renderer.js"');
    assert.ok(cancelIdx >= 0, 'index.html 必须加载 ai-cancel-state.js');
    assert.ok(rendererIdx >= 0, 'index.html 必须加载 renderer.js');
    assert.ok(cancelIdx < rendererIdx, 'ai-cancel-state.js 必须先于 renderer.js');
    assert.ok(modelIdx < cancelIdx, '计划要求的顺序：skill-picker-model.js → ai-cancel-state.js → renderer.js');
  });
});

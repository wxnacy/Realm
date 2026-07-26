/**
 * Realm Browser - favorites:* IPC 运行时冒烟测试
 *
 * 目的（持久回归护栏，回应 09-VERIFICATION.md 流程备注 ①）：
 * 静态 grep 无法发现 IPC 运行时断裂——Phase 9 曾出现 preload 与 manager
 * 均已改为无 containerId 新签名、而 ipc-handlers.js 仍是 per-container
 * 旧签名的断层，导致星标 check/add/update/delete 四链路 100% 抛出
 * 「无效的参数」。本测试在纯 Node 环境（不启动 Electron、不触数据库，
 * 规避 better-sqlite3 系统 Node ABI 不匹配）通过 Module._load 拦截打桩，
 * 逐一以 preload 真实 payload 调用 8 个 favorites:* handler，断言：
 *   1. 不抛出任何参数校验异常；
 *   2. favoritesManager 被以新签名调用（实参个数精确匹配——专门捕捉
 *      「多传一个位置参数」的 Phase 7 旧签名残留）；
 *   3. 实参内容与期望值深度相等；返回值与预设值一致。
 *
 * 运行：node scripts/test-ipc-favorites.js（任何失败以非零码退出）
 */

'use strict';

const assert = require('assert');
const Module = require('module');
const path = require('path');

// ==================== 依赖打桩 ====================

/** channel -> handler fn 捕获表 */
const handlers = {};
/** favoritesManager 调用记录：[函数名, ...实参] */
const calls = [];

/** electron 桩：ipcMain.handle 捕获注册；BrowserWindow 返回固定窗口 id */
const electronStub = {
  ipcMain: {
    handle: (channel, fn) => {
      handlers[channel] = fn;
    },
  },
  dialog: {},
  BrowserWindow: {
    fromWebContents: () => ({ id: 1 }),
  },
};

/** window-manager 桩：与 BrowserWindow 返回相同 id，使 assertTrustedSender 通过 */
const windowManagerStub = {
  getMainWindow: () => ({ id: 1 }),
};

/**
 * favorites-manager 桩：记录 [函数名, ...实参] 并返回预设值
 * （与 Phase 9 新签名一一对应，无任何 containerId 形参）
 */
const favoritesManagerStub = {
  checkUrl: (...args) => { calls.push(['checkUrl', ...args]); return null; },
  addRecord: (...args) => { calls.push(['addRecord', ...args]); return { id: 1 }; },
  updateRecord: (...args) => { calls.push(['updateRecord', ...args]); return true; },
  deleteRecord: (...args) => { calls.push(['deleteRecord', ...args]); return true; },
  deleteRecords: (...args) => { calls.push(['deleteRecords', ...args]); return args[0].length; },
  listRecords: (...args) => { calls.push(['listRecords', ...args]); return []; },
  searchRecords: (...args) => { calls.push(['searchRecords', ...args]); return []; },
  getCount: (...args) => { calls.push(['getCount', ...args]); return 0; },
};

/**
 * 其余 manager 依赖的空操作桩：任意属性访问返回空操作函数
 * （registerHandlers 顶层会调用 tabManager.setRecycleListener 等，需存在但行为无关）
 */
const noopManagerStub = new Proxy({}, {
  get: (target, prop) => {
    if (typeof prop === 'symbol') return undefined;
    return () => {};
  },
});

const STUBS = {
  electron: electronStub,
  './window-manager': windowManagerStub,
  './favorites-manager': favoritesManagerStub,
  './container-manager': noopManagerStub,
  './tab-manager': noopManagerStub,
  './cookie-manager': noopManagerStub,
  './assignment-rules': noopManagerStub,
  './shortcut-manager': noopManagerStub,
  './history-manager': noopManagerStub,
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(STUBS, request)) {
    return STUBS[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};

// ==================== 加载被测模块并注册 handler ====================

const { registerHandlers } = require(path.join(__dirname, '..', 'ipc-handlers'));
registerHandlers();

// ==================== 用例定义（payload 与 src/preload.js 实际发送一致） ====================

const event = { sender: {} };

const cases = [
  {
    channel: 'favorites:check',
    payload: { url: 'https://example.com' },
    expectCall: ['checkUrl', 'https://example.com'],
    expectReturn: null,
  },
  {
    channel: 'favorites:add',
    payload: { url: 'https://example.com', title: 'Example', faviconUrl: 'https://example.com/favicon.ico' },
    expectCall: ['addRecord', { url: 'https://example.com', title: 'Example', faviconUrl: 'https://example.com/favicon.ico' }],
    expectReturn: { id: 1 },
  },
  {
    channel: 'favorites:update',
    payload: { id: 7, title: '新标题' },
    expectCall: ['updateRecord', 7, { title: '新标题' }],
    expectReturn: true,
  },
  {
    channel: 'favorites:delete',
    payload: { id: 7 },
    expectCall: ['deleteRecord', 7],
    expectReturn: true,
  },
  {
    channel: 'favorites:delete-batch',
    payload: { ids: [1, 2] },
    expectCall: ['deleteRecords', [1, 2]],
    expectReturn: 2,
  },
  {
    channel: 'favorites:list',
    payload: { offset: 0, limit: 50 },
    expectCall: ['listRecords', { offset: 0, limit: 50 }],
    expectReturn: [],
  },
  {
    channel: 'favorites:search',
    payload: { keyword: 'exam', offset: 0, limit: 50 },
    expectCall: ['searchRecords', { keyword: 'exam', offset: 0, limit: 50 }],
    expectReturn: [],
  },
  {
    channel: 'favorites:count',
    payload: {},
    expectCall: ['getCount'],
    expectReturn: 0,
  },
];

// ==================== 执行 ====================

let passCount = 0;
let failCount = 0;

for (const c of cases) {
  const handler = handlers[c.channel];
  calls.length = 0;
  try {
    assert.strictEqual(typeof handler, 'function', `handler 未注册: ${c.channel}`);
    const ret = handler(event, c.payload);
    // 断言 1：favoritesManager 恰好被调用 1 次
    assert.strictEqual(calls.length, 1, `favoritesManager 调用次数应为 1，实际 ${calls.length}`);
    // 断言 2：函数名 + 实参个数与内容精确匹配（多一个位置参数即失败）
    assert.deepStrictEqual(calls[0], c.expectCall,
      `manager 调用签名不匹配（含实参个数精确断言）`);
    // 断言 3：handler 返回值与 manager 预设值一致
    assert.deepStrictEqual(ret, c.expectReturn, 'handler 返回值与 manager 返回值不一致');
    passCount += 1;
    console.log(`PASS ${c.channel}`);
  } catch (err) {
    failCount += 1;
    console.log(`FAIL ${c.channel} — ${err.message}`);
  }
}

console.log(`\nSummary: ${passCount}/${cases.length} PASS, ${failCount} FAIL`);

if (failCount > 0) {
  process.exit(1);
}

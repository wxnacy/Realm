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
/** faviconFetcher 调用记录：[函数名, ...实参] */
const fetcherCalls = [];
/** 主窗口 webContents.send 广播记录：[channel, ...args] */
const sentMessages = [];

/** 主窗口对象桩：BrowserWindow.fromWebContents 与 windowManager.getMainWindow
 * 必须返回**同一个** id，`assertTrustedSender` 才会放行。
 * 它还要求 `win.isDestroyed()` 为函数（CR-4 起）—— 只给 `{id}` 会让每个
 * favorites:* 用例都以「win.isDestroyed is not a function」失败。
 * webContents.send 是 webContents 直发形态的广播出口，记入 sentMessages。 */
const mainWindowStub = {
  id: 1,
  isDestroyed: () => false,
  webContents: {
    send: (channel, ...args) => sentMessages.push([channel, ...args]),
  },
};

/** electron 桩：ipcMain.handle 捕获注册；BrowserWindow 返回固定窗口。
 * 其余 ipcMain 事件方法（on / once / removeListener）注册阶段会被调用，
 * 一律空实现 —— 本测试只关心 handle 注册出来的请求-响应契约。
 * `app` 必须存在：ipc-handlers.js 在**模块顶层**注册 app.on('before-quit')，
 * 缺了它整个测试会在 require 阶段以 TypeError 崩掉（护栏因此长期失效）。 */
const electronStub = {
  ipcMain: {
    handle: (channel, fn) => {
      handlers[channel] = fn;
    },
    on: () => {},
    once: () => {},
    removeListener: () => {},
  },
  dialog: {},
  app: {
    on: () => {},
  },
  BrowserWindow: {
    fromWebContents: () => mainWindowStub,
  },
};

/** window-manager 桩：与 BrowserWindow 返回同一窗口对象，使 assertTrustedSender 通过；
 * isManagedWindow 是 CR-4/D-11 起的第二道判据（缺了它同样是 100% 拒绝）。
 *
 * 两个广播出口都必须落到 sentMessages，否则 `expectSent` 是死断言：
 * - webContents.send：经主窗口直发（mainWindowStub 上）
 * - broadcast：所有收藏类 handler 实际用的是这条（ipc-handlers.js 内多处在用），
 *   此前桩里没有它 ⇒ 一旦 app 桩补齐就会转为 TypeError */
const windowManagerStub = {
  getMainWindow: () => mainWindowStub,
  isManagedWindow: (id) => id === mainWindowStub.id,
  broadcast: (channel, ...args) => sentMessages.push([channel, ...args]),
};

/**
 * favorites-manager 桩：记录 [函数名, ...实参] 并返回预设值
 * （与 Phase 9 新签名一一对应，无任何 containerId 形参）
 */
const favoritesManagerStub = {
  checkUrl: (...args) => { calls.push(['checkUrl', ...args]); return null; },
  addRecord: (...args) => { calls.push(['addRecord', ...args]); return { id: 1 }; },
  updateRecord: (...args) => { calls.push(['updateRecord', ...args]); return true; },
  updateFavicon: (...args) => { calls.push(['updateFavicon', ...args]); return true; },
  deleteRecord: (...args) => { calls.push(['deleteRecord', ...args]); return true; },
  deleteRecords: (...args) => { calls.push(['deleteRecords', ...args]); return args[0].length; },
  listRecords: (...args) => { calls.push(['listRecords', ...args]); return []; },
  searchRecords: (...args) => { calls.push(['searchRecords', ...args]); return []; },
  getCount: (...args) => { calls.push(['getCount', ...args]); return 0; },
};

/**
 * favicon-fetcher 桩：不发起真实网络请求，固定返回 data URL
 * （handler 应将远程 faviconUrl 统一经此转换后再入库）
 */
const FAKE_DATA_URL = 'data:image/png;base64,U1RVQg==';
const faviconFetcherStub = {
  fetchAsDataUrl: async (url) => {
    fetcherCalls.push(['fetchAsDataUrl', url]);
    return FAKE_DATA_URL;
  },
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

/**
 * electron-store 桩：ipc-handlers.js 在模块顶层 `new Store({name:'realm-config'})`。
 * 真实 Store 会取 app.getPath('userData') 并**读写磁盘上的 realm-config.json** ——
 * 本测试既不启动 Electron（没有 app.getPath），也绝不能碰用户的真实配置。
 * 用内存 Map 顶替：读写语义与 Store 一致（get 带默认值），无任何落盘副作用。
 */
class ElectronStoreStub {
  constructor() {
    this._data = new Map();
  }

  get(key, defaultValue) {
    return this._data.has(key) ? this._data.get(key) : defaultValue;
  }

  set(key, value) {
    this._data.set(key, value);
  }
}

const STUBS = {
  electron: electronStub,
  'electron-store': ElectronStoreStub,
  './window-manager': windowManagerStub,
  './favorites-manager': favoritesManagerStub,
  './favicon-fetcher': faviconFetcherStub,
  './container-manager': noopManagerStub,
  './tab-manager': noopManagerStub,
  './cookie-manager': noopManagerStub,
  './assignment-rules': noopManagerStub,
  './shortcut-manager': noopManagerStub,
  './history-manager': noopManagerStub,
  // autocomplete-manager 在**模块加载时**就 startCleanupTimer()（30s 周期，
  // 引用态 setInterval），真实模块一进来本进程就再也不退出 ——
  // npm run validate 的 `&&` 链会永久挂住（实测 2 分钟以上）。
  // 它不参与任何 favorites:* 契约，按上面几个 manager 的同一惯例打桩。
  './autocomplete-manager': noopManagerStub,
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
    // 内置 URL 回归护栏（09-UAT test 9 issue）：favorites:check 必须接受 realm://
    // scheme，不得在 IPC 边界被拦截——防止未来在 handler 加 scheme 过滤
    // 复现 src/renderer.js:219 曾经的渲染层守卫同等问题
    channel: 'favorites:check',
    payload: { url: 'realm://newtab' },
    expectCall: ['checkUrl', 'realm://newtab'],
    expectReturn: null,
  },
  {
    channel: 'favorites:add',
    payload: { url: 'https://example.com', title: 'Example', faviconUrl: 'https://example.com/favicon.ico' },
    // handler 应先将远程 faviconUrl 经 favicon-fetcher 转 data URL 再入库
    // folderId 键固定透传（payload 未提供时为 0），deepStrictEqual 对键存在性敏感
    expectCall: ['addRecord', { url: 'https://example.com', title: 'Example', faviconUrl: FAKE_DATA_URL, folderId: 0 }],
    expectFetcherCall: ['fetchAsDataUrl', 'https://example.com/favicon.ico'],
    expectReturn: { id: 1 },
  },
  {
    // 指定文件夹新增（星标弹窗选择文件夹后新增）
    channel: 'favorites:add',
    payload: { url: 'https://example-folder.com', title: '夹内', folderId: 5 },
    expectCall: ['addRecord', {
      url: 'https://example-folder.com',
      title: '夹内',
      faviconUrl: '',
      folderId: 5,
    }],
    expectNoFetcher: true,
    expectReturn: { id: 1 },
  },
  {
    // 无 faviconUrl 时不得调用 fetcher（右键菜单添加等空图标场景）
    channel: 'favorites:add',
    payload: { url: 'https://example.com', title: 'Example' },
    expectCall: ['addRecord', { url: 'https://example.com', title: 'Example', faviconUrl: '', folderId: 0 }],
    expectNoFetcher: true,
    expectReturn: { id: 1 },
  },
  {
    // 访问时回写：抓取转 data URL → updateFavicon 只补空 → 广播刷新收藏栏
    channel: 'favorites:update-favicon',
    payload: { id: 7, sourceUrl: 'https://example.com/favicon.ico' },
    expectCall: ['updateFavicon', 7, FAKE_DATA_URL],
    expectFetcherCall: ['fetchAsDataUrl', 'https://example.com/favicon.ico'],
    expectSent: ['bookmarks-bar:refresh'],
    expectReturn: { success: true },
  },
  {
    // 不传 folderId（收藏页 HTTP API / AI 工具链的旧语义路径）：
    // 必须原样透传 undefined，绝不能落成 0 —— 那会把「改标题」变成「移动到根目录」，
    // 数据层据此走「只改标题且不动排序」分支
    channel: 'favorites:update',
    payload: { id: 7, title: '新标题' },
    expectCall: ['updateRecord', 7, { title: '新标题', folderId: undefined }],
    expectSent: ['bookmarks-bar:refresh'],
    expectReturn: true,
  },
  {
    // 带 folderId（星标弹窗保存）：原样透传给数据层
    channel: 'favorites:update',
    payload: { id: 7, title: '新标题', folderId: 5 },
    expectCall: ['updateRecord', 7, { title: '新标题', folderId: 5 }],
    expectSent: ['bookmarks-bar:refresh'],
    expectReturn: true,
  },
  {
    // folderId=0 是「移动到根目录」的**有效目标**，不能被 `||` 之类吞掉
    channel: 'favorites:update',
    payload: { id: 7, title: '新标题', folderId: 0 },
    expectCall: ['updateRecord', 7, { title: '新标题', folderId: 0 }],
    expectSent: ['bookmarks-bar:refresh'],
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
    // handler 固定透传 folderId 键（payload 未提供时为 undefined），
    // deepStrictEqual 对键存在性敏感，期望值必须显式列出
    expectCall: ['listRecords', { offset: 0, limit: 50, folderId: undefined }],
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

(async () => {
  for (const c of cases) {
    const handler = handlers[c.channel];
    calls.length = 0;
    fetcherCalls.length = 0;
    sentMessages.length = 0;
    try {
      assert.strictEqual(typeof handler, 'function', `handler 未注册: ${c.channel}`);
      // handler 可能为 async（favorites:add / favorites:update-favicon 含 favicon 抓取）
      const ret = await handler(event, c.payload);
      // 断言 1：favoritesManager 恰好被调用 1 次
      assert.strictEqual(calls.length, 1, `favoritesManager 调用次数应为 1，实际 ${calls.length}`);
      // 断言 2：函数名 + 实参个数与内容精确匹配（多一个位置参数即失败）
      assert.deepStrictEqual(calls[0], c.expectCall,
        `manager 调用签名不匹配（含实参个数精确断言）`);
      // 断言 3：handler 返回值与 manager 预设值一致
      assert.deepStrictEqual(ret, c.expectReturn, 'handler 返回值与 manager 返回值不一致');
      // 断言 4（可选）：favicon-fetcher 调用符合预期
      if (c.expectFetcherCall) {
        assert.strictEqual(fetcherCalls.length, 1, `fetcher 调用次数应为 1，实际 ${fetcherCalls.length}`);
        assert.deepStrictEqual(fetcherCalls[0], c.expectFetcherCall, 'fetcher 调用入参不匹配');
      }
      if (c.expectNoFetcher) {
        assert.strictEqual(fetcherCalls.length, 0, `不应调用 fetcher，实际 ${fetcherCalls.length} 次`);
      }
      // 断言 5（可选）：主窗口广播符合预期
      if (c.expectSent) {
        assert.deepStrictEqual(sentMessages, [c.expectSent], 'webContents.send 广播不匹配');
      }
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
})();

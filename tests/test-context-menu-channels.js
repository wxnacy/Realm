/**
 * Realm Browser - 右键菜单通道与字段契约护栏
 *
 * 网页右键菜单跨越四处协作，任一处漏登记或拼错名字都是静默失效：
 *
 * 1. 通道：主进程 `webContents.send` → preload 白名单转发 → renderer `case` 分发
 *    - 白名单多出条目 = 永远收不到的死通道（发送方早已改在主进程内直接完成）
 *    - 白名单缺失条目 = 菜单项点了没反应（`new-tab` 曾因此失效）
 * 2. 上下文字段：renderer 构造 → main.js 注入两个字段 → 主进程读取
 *    - renderer 少传/拼错字段 = 菜单静默丢功能（`type` 改 `hasImage`/`hasLink`
 *      这类改动只靠 mock 测试覆盖不到，因为 mock 直接喂上下文、绕过 renderer）
 *
 * 本测试把这两组集合做成机械判据。判别力：改动任一处任一条目都会变红
 * （已用单点变异实测）。JSDoc 登记清单同样参与比对，防止注释漂移。
 *
 * 运行：`node --test tests/test-context-menu-channels.js`
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/**
 * 读取仓库内文件
 * @param {string} rel - 相对仓库根的路径
 * @returns {string} 文件内容
 */
function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * 提取 preload 的 channels 白名单数组与上方 JSDoc 登记清单
 * @returns {{list: string[], docList: string[]}}
 */
function collectPreload() {
  const src = readFile('src/preload.js');
  const start = src.indexOf('onContextMenuAction: (callback) => {');
  assert.ok(start > 0, 'preload.js 应存在 onContextMenuAction');
  const end = src.indexOf('channels.forEach', start);
  assert.ok(end > start, 'channels 数组应有可识别的结尾（channels.forEach）');

  const body = src.slice(start, end);
  const list = [...body.matchAll(/'(context-menu:[a-z-]+)'/g)].map((m) => m[1]);

  // onContextMenuAction 上方的 JSDoc 注释块
  const docStart = src.lastIndexOf('/**', start);
  const doc = src.slice(docStart, start);
  const docList = [...doc.matchAll(/(context-menu:[a-z-]+)/g)].map((m) => m[1]);

  return { list, docList };
}

/**
 * 提取主进程发送侧的 channel 集合
 * @returns {string[]} channel 名（可能重复）
 */
function collectSenders() {
  const out = [];
  for (const rel of ['main.js', 'context-menu-manager.js']) {
    const src = readFile(rel);
    out.push(...[...src.matchAll(/send\('(context-menu:[a-z-]+)'/g)].map((m) => m[1]));
  }
  return out;
}

/**
 * 提取 renderer 消费侧的 case 分支集合
 * @returns {string[]} channel 名（可能重复）
 */
function collectConsumers() {
  const src = readFile('src/renderer.js');
  return [...src.matchAll(/case '(context-menu:[a-z-]+)':/g)].map((m) => m[1]);
}

/**
 * 去重 + 排序（集合语义比较）
 * @param {string[]} arr - 原始数组
 * @returns {string[]} 去重排序后的数组
 */
function uniqSorted(arr) {
  return [...new Set(arr)].sort();
}

test('通道三方一致：主进程发送侧 = preload 白名单 = renderer 消费侧', () => {
  const senders = uniqSorted(collectSenders());
  const whitelist = uniqSorted(collectPreload().list);
  const consumers = uniqSorted(collectConsumers());

  assert.ok(senders.length > 0, '发送侧应至少解析出一条 channel（解析失效会假绿）');

  assert.deepEqual(
    whitelist,
    senders,
    'preload 白名单须与主进程发送侧一致：多出的即死通道，缺失的收不到'
  );
  assert.deepEqual(
    consumers,
    senders,
    'renderer case 须与主进程发送侧一致：缺失的会让菜单项点了没反应'
  );
});

test('preload 白名单无重复条目', () => {
  const { list } = collectPreload();
  assert.equal(list.length, new Set(list).size, 'channels 数组不应出现重复条目');
});

test('preload JSDoc 的 channel 清单与白名单数组一致', () => {
  const { list, docList } = collectPreload();
  assert.ok(docList.length > 0, 'JSDoc 应至少登记一条 channel');
  assert.deepEqual(
    uniqSorted(docList),
    uniqSorted(list),
    'JSDoc 清单须与 channels 数组同步（注释不参与运行，但会误导后续维护）'
  );
});

/**
 * 提取主进程在转发前注入的上下文字段
 *
 * main.js 的 enrichedContext 会在 renderer 传来的上下文之上补两个字段：
 * 容器列表（链接菜单的容器子菜单用）与 guestContentsId（主进程自持值，
 * 故意不采信 renderer 传的，见 T-13-01 安全缓解）。这两个不该由 renderer 传。
 *
 * @returns {Set<string>} 注入的字段名
 */
function collectInjectedKeys() {
  const src = readFile('main.js');
  const start = src.indexOf('const enrichedContext = {');
  assert.ok(start > 0, 'main.js 应构建 enrichedContext');
  const end = src.indexOf('};', start);
  assert.ok(end > start, 'enrichedContext 应有一个闭合边界');
  return new Set(
    [...src.slice(start, end).matchAll(/^\s+([a-zA-Z][a-zA-Z0-9]*)\s*[,:]/gm)].map((m) => m[1])
  );
}

test('renderer 传入的上下文字段覆盖主进程读取的全部字段', () => {
  const rendererSrc = readFile('src/renderer.js');
  const callStart = rendererSrc.indexOf('window.realmAPI.showWebContextMenu({');
  assert.ok(callStart > 0, 'renderer 应调用 showWebContextMenu');
  const callEnd = rendererSrc.indexOf('});', callStart);
  assert.ok(callEnd > callStart, '调用应有一个闭合边界');

  // 调用处的对象字面量键（含 shorthand 写法）
  const provided = new Set(
    [...rendererSrc.slice(callStart, callEnd).matchAll(/^\s+([a-zA-Z][a-zA-Z0-9]*)\s*[,:]/gm)]
      .map((m) => m[1])
  );
  const injected = collectInjectedKeys();
  assert.ok(injected.size > 0, '注入字段解析失效会假绿');

  // 主进程侧读取的键（buildWebMenu / buildGeneralMenuItems）
  const consumed = new Set(
    [...readFile('context-menu-manager.js').matchAll(/contextInfo\.([a-zA-Z][a-zA-Z0-9]*)/g)]
      .map((m) => m[1])
  );

  assert.ok(provided.size >= 8, '调用处解析失效会假绿');
  assert.ok(consumed.size >= 8, '消费侧解析失效会假绿');

  const allowed = new Set([...provided, ...injected]);
  const missing = [...consumed].filter((key) => !allowed.has(key)).sort();
  assert.deepEqual(
    missing,
    [],
    '主进程读取的字段必须由 renderer 传入或 main.js 注入（字段名拼写不一致会让菜单静默丢功能）'
  );
});

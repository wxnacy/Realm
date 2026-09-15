/**
 * Realm Browser - 右键菜单通道一致性护栏
 *
 * 右键菜单 channel 由三处协作完成：主进程 `webContents.send` → preload
 * 白名单转发 → renderer `case` 分发。任一处与另两处不一致都会造成静默失效：
 *
 * - 白名单多出条目 = 永远收不到的死通道（发送方早已改在主进程内直接完成）
 * - 白名单缺失条目 = 菜单项点了没反应（`new-tab` 曾因此失效）
 *
 * 本测试把三方集合做成机械判据。判别力：改动任一处任一条目都会变红
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

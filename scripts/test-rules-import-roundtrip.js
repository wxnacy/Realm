/**
 * Realm Browser - 规则导出→导入往返运行时回归测试
 *
 * 目的（持久回归护栏，回应 11-UAT.md test 2 gap）：
 * 修复前客户端把 JSON.parse 后的整个文件内容再次作为请求体 rules 字段的值
 * POST 到 /api/rules/import；而应用自身导出产物（exportRules 返回
 * {rules:[...], exportedAt}）本身就是带 rules 字段的对象，服务端解构出的
 * rules 是对象而非数组，被 importRules 的 Array.isArray 校验拒绝，导出→导入
 * 往返必然失败。本测试在纯 Node 环境（不启动 Electron）通过 Module._load
 * 拦截打桩 electron-store，断言：
 *   1. normalizeRulesPayload 覆盖裸数组 / 单层包裹 / 双层包裹 / 非法输入
 *      四种输入形态；
 *   2. exportRules → normalizeRulesPayload → importRules 全链路往返可用；
 *   3. 服务端归一化防御层可接受旧版有缺陷客户端的双层包裹 payload；
 *   4. importRules 的「全部重复」去重文案锁定（该文案经 HTTP 200 body 到达
 *      客户端 toast，改动会让用户看到错乱的失败原因）。
 *
 * 运行：node scripts/test-rules-import-roundtrip.js（任何失败以非零码退出）
 */

'use strict';

const assert = require('assert');
const Module = require('module');
const path = require('path');

// ==================== 依赖打桩 ====================

/**
 * electron-store 桩：assignment-rules.js 顶层 new Store(...) 与 saveRules
 * 的 store.set 均依赖此桩。constructor 空实现；get(key, def) 返回 def
 * （模拟全新空库）；set(key, value) 空实现（运行时状态由模块内 Map 维护，
 * 测试不依赖磁盘持久化）。
 */
class StoreStub {
  constructor() {}
  get(key, def) { return def; }
  set(key, value) {}
}

const STUBS = {
  'electron-store': StoreStub,
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(STUBS, request)) {
    return STUBS[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};

/**
 * 重新加载 assignment-rules 模块，得到规则表为空的全新实例。
 * 用于模拟「导入方」（与播种导出方互不共享运行时 Map）。
 * @returns {Object} 全新的 assignment-rules 模块
 */
function loadFresh() {
  const modPath = require.resolve(path.join(__dirname, '..', 'assignment-rules.js'));
  delete require.cache[modPath];
  return require(modPath);
}

// ==================== 用例执行 ====================

let passed = 0;
let failed = 0;

/**
 * 单条断言执行器：捕获异常并按用例打印 PASS/FAIL
 * @param {string} name - 用例名
 * @param {Function} fn - 用例体（内部使用 node:assert）
 */
function run(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(`  ${err.message}`);
  }
}

const modA = loadFresh();

run('normalizeRulesPayload 已导出', () => {
  assert.strictEqual(typeof modA.normalizeRulesPayload, 'function');
});

run('裸数组 → 原样返回', () => {
  const bare = [{ containerId: 'work', pattern: 'example.com' }];
  assert.deepStrictEqual(modA.normalizeRulesPayload(bare), bare);
});

run('单层包裹（导出产物）→ 解出规则数组', () => {
  const rules = [{ containerId: 'work', pattern: 'example.com' }];
  const payload = { rules, exportedAt: 1722046800000 };
  assert.deepStrictEqual(modA.normalizeRulesPayload(payload), rules);
});

run('双层包裹（旧版有缺陷客户端）→ 逐层解出', () => {
  const rules = [{ containerId: 'home', pattern: '*.github.com' }];
  const payload = { rules: { rules, exportedAt: 1722046800000 } };
  assert.deepStrictEqual(modA.normalizeRulesPayload(payload), rules);
});

run('非法输入 → null', () => {
  assert.strictEqual(modA.normalizeRulesPayload({}), null);
  assert.strictEqual(modA.normalizeRulesPayload({ rules: 'not-array' }), null);
  assert.strictEqual(modA.normalizeRulesPayload(null), null);
  assert.strictEqual(modA.normalizeRulesPayload('just-a-string'), null);
});

run('导出→导入往返：导出产物直接导入成功', () => {
  modA.createRule('work', 'example.com');
  modA.createRule('home', '*.github.com');
  const exported = modA.exportRules();
  assert.strictEqual(typeof exported, 'object');
  assert.strictEqual(exported.rules.length, 2);
  assert.strictEqual(typeof exported.exportedAt, 'number');

  const modB = loadFresh();
  const result = modB.importRules(modB.normalizeRulesPayload(exported));
  assert.deepStrictEqual(result, { success: true, count: 2, skipped: 0 });
});

run('防御等效：双层包裹 payload 同样导入成功', () => {
  const modC = loadFresh();
  modC.createRule('work', 'example.com');
  modC.createRule('home', '*.github.com');
  const exported = modC.exportRules();
  const wrapped = { rules: exported }; // 模拟旧客户端的双重包裹

  const modD = loadFresh();
  const result = modD.importRules(modD.normalizeRulesPayload(wrapped));
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.count, 2);
});

run('归一化得到 null 时 importRules 返回失败对象', () => {
  const modE = loadFresh();
  const result = modE.importRules(modE.normalizeRulesPayload({ rules: 'not-array' }));
  assert.strictEqual(result.success, false);
  assert.ok(result.message && result.message.length > 0);
});

run('去重文案锁定：全部重复时 message 含「均已存在」', () => {
  const modF = loadFresh();
  modF.createRule('work', 'example.com');
  const exported = modF.exportRules();
  // 对同一实例再次导入同一 payload，所有规则均重复
  const result = modF.importRules(modF.normalizeRulesPayload(exported));
  assert.strictEqual(result.success, false);
  assert.ok(result.message.includes('均已存在'));
});

// ==================== 汇总 ====================

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

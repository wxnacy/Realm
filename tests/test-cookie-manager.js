#!/usr/bin/env node
/**
 * cookie-manager - 容器列表默认值与孤儿 Partitions 清理的回归测试
 *
 * 背景：realm-config.json 缺 containers 键时（全新环境、用户从未增删改过容器），
 * 调用点若回退到空数组，会把「配置缺失」误判成「没有有效容器」并删光所有
 * container-* 目录（含 localStorage/IndexedDB/cookie），同时 loadAllCookies
 * 遍历空数组导致 cookie 一条都不加载。
 *
 * 用法: node tests/test-cookie-manager.js
 *
 * electron 依赖处理（不改实现文件）：cookie-manager.js 顶层 require('electron')
 * 取 app.getPath('userData')，并 require electron-store。在 require 之前用
 * Module._load 拦截注入 stub —— 其中 FakeStore.get 恒返回 fallback，
 * 正是「配置里没有该键」的等价形态。
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// ==================== electron / electron-store stub ====================

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-cookie-mgr-test-'));

/** 记录每次 session.cookies.set，用于验证「真的逐容器加载了 cookie」 */
const setCalls = [];

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: { getPath: () => tmpDir },
      session: {
        fromPartition: (partition) => ({
          cookies: {
            get: async () => [],
            set: async (cookie) => { setCalls.push({ partition, cookie }); },
            remove: async () => {},
          },
        }),
      },
    };
  }
  if (request === 'electron-store') {
    return class FakeStore {
      constructor(opts = {}) {
        this.path = path.join(tmpDir, (opts.name || 'config') + '.json');
      }
      // 恒返回 fallback ⇒ 等价于配置中不存在该键
      get(_key, fallback) { return fallback; }
      set() {}
      has() { return false; }
      delete() {}
      clear() {}
    };
  }
  return origLoad.apply(this, arguments);
};

const cookieManager = require('../cookie-manager');

// ==================== 断言工具 ====================

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

const PARTITIONS_ROOT = path.join(tmpDir, 'Partitions');

/**
 * 造一份「有效容器 + 孤儿容器 + 非本应用 partition」的目录现场
 * @returns {string} Partitions 根路径
 */
function setupPartitionsDirs() {
  fs.rmSync(PARTITIONS_ROOT, { recursive: true, force: true });
  for (const dir of ['container-default', 'container-work', 'container-orphan1', 'container-orphan2']) {
    fs.mkdirSync(path.join(PARTITIONS_ROOT, dir), { recursive: true });
    // 写入内容，确认清理是递归删除而非只删空目录
    fs.writeFileSync(path.join(PARTITIONS_ROOT, dir, 'Cookies'), 'x');
  }
  fs.mkdirSync(path.join(PARTITIONS_ROOT, 'other-partition'), { recursive: true });
  return PARTITIONS_ROOT;
}

const dirsNow = () => fs.readdirSync(PARTITIONS_ROOT).sort();

// ==================== 主体 ====================

(async () => {

  // -------------------- 1. 空列表：必须跳过而不是全删 --------------------

  console.log('\n[1] 空数组入参（配置缺失的等价形态）');
  {
    const root = setupPartitionsDirs();
    const result = cookieManager.cleanupOrphanPartitions([]);

    check('返回 skipped 标记', result.skipped === true, JSON.stringify(result));
    check('removed 为 0', result.removed === 0, String(result.removed));
    check('未删除任何目录（5 个仍在）', dirsNow().length === 5, dirsNow().join(','));
    check('孤儿目录仍在', fs.existsSync(path.join(root, 'container-orphan1')));
    check('容器数据文件仍在', fs.existsSync(path.join(root, 'container-orphan1', 'Cookies')));
  }

  // -------------------- 2. 非数组入参：同样必须跳过 --------------------

  console.log('\n[2] undefined / null 入参');
  {
    setupPartitionsDirs();
    const r1 = cookieManager.cleanupOrphanPartitions(undefined);
    check('undefined → skipped', r1.skipped === true && r1.removed === 0);
    check('undefined → 目录未动', dirsNow().length === 5, dirsNow().join(','));

    setupPartitionsDirs();
    const r2 = cookieManager.cleanupOrphanPartitions(null);
    check('null → skipped', r2.skipped === true && r2.removed === 0);
    check('null → 目录未动', dirsNow().length === 5, dirsNow().join(','));
  }

  // -------------------- 3. 判别力：正常入参仍须真删 --------------------

  console.log('\n[3] 非空列表：孤儿清理功能未被守卫误伤');
  {
    const root = setupPartitionsDirs();
    const result = cookieManager.cleanupOrphanPartitions(['default', 'work']);

    check('删除 2 个孤儿', result.removed === 2, String(result.removed));
    check('未标记 skipped', !result.skipped);
    check('有效容器目录保留', fs.existsSync(path.join(root, 'container-default')) && fs.existsSync(path.join(root, 'container-work')));
    check('孤儿目录已物理删除', !fs.existsSync(path.join(root, 'container-orphan1')) && !fs.existsSync(path.join(root, 'container-orphan2')));
    check('非 container- 前缀目录不受影响', fs.existsSync(path.join(root, 'other-partition')));
  }

  // -------------------- 4. Partitions 根不存在时不抛错 --------------------

  console.log('\n[4] Partitions 根目录不存在');
  {
    fs.rmSync(PARTITIONS_ROOT, { recursive: true, force: true });
    let threw = false;
    let result;
    try {
      result = cookieManager.cleanupOrphanPartitions(['default']);
    } catch (e) {
      threw = true;
      console.log(`    抛出: ${e.message}`);
    }
    check('不抛异常', !threw);
    check('removed 为 0', !!result && result.removed === 0);
  }

  // -------------------- 5. 默认值统一：缺键时须按 4 个默认容器加载 --------------------

  console.log('\n[5] config 缺 containers 键时的加载范围（默认值统一）');
  {
    const DEFAULT_IDS = ['default', 'work', 'personal', 'finance'];

    // 为 4 个默认容器各准备一条 cookie（模拟已持久化的容器 cookie 文件）
    for (const id of DEFAULT_IDS) {
      const dir = path.join(tmpDir, 'containers', id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'cookies.json'), JSON.stringify([
        { name: 'token', value: `v-${id}`, domain: 'huggingface.co', path: '/', secure: true, httpOnly: true },
      ]));
    }

    const before = setCalls.length;
    const result = await cookieManager.loadAllCookies();
    const calls = setCalls.slice(before);

    check('loadAllCookies 成功', result.success === true, JSON.stringify(result));
    check('覆盖到 4 个默认容器（而非 0 个）', result.loaded === 4, `loaded=${result.loaded}`);
    check('实际写入 4 条 cookie', calls.length === 4, `setCalls=${calls.length}`);
    check(
      '分区名逐个对应默认容器',
      DEFAULT_IDS.every(id => calls.some(c => c.partition === `persist:container-${id}`)),
      [...new Set(calls.map(c => c.partition))].join(',')
    );
    check(
      'cookie 值按容器区分（未串号）',
      calls.every(c => c.cookie.value === `v-${c.partition.replace('persist:container-', '')}`)
    );
  }

  // -------------------- 6. 静态防线：源码中不得再出现空数组回退 --------------------
  // main.js 是应用入口，无法在测试中 require，其默认值改动只能靠源码扫描兜住。

  console.log('\n[6] 源码扫描：containers 键不得回退到空数组');
  {
    const EMPTY_FALLBACK = /get\(\s*['"]containers['"]\s*,\s*\[\s*\]\s*\)/g;
    const files = ['main.js', 'cookie-manager.js', 'container-manager.js'];

    // 合成样本探针：正则必须能命中已知形态，否则本条判据恒绿、毫无判别力
    // （用独立的非全局正则，避免 g 标志的 lastIndex 状态污染后续 match）
    check(
      '判据自身有效（能命中合成样本）',
      /get\(\s*['"]containers['"]\s*,\s*\[\s*\]\s*\)/.test("configStore.get('containers', [])")
    );
    check(
      '判据不会误伤正确形态',
      !/get\(\s*['"]containers['"]\s*,\s*\[\s*\]\s*\)/.test("configStore.get('containers', DEFAULT_CONTAINERS)")
    );

    for (const f of files) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      const hits = src.match(EMPTY_FALLBACK) || [];
      check(`${f} 无空数组回退`, hits.length === 0, `${hits.length} 处`);
    }
  }

  // -------------------- 收尾 --------------------

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);

})();

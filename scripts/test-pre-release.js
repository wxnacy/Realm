/**
 * Realm Browser - 发布前验证脚本
 *
 * 目的：Electron 升级后验证本地存储（cookies.json + history.db）的读写兼容性。
 * 沿用 Module._load 打桩模式，纯 Node 运行，不依赖 Electron 运行时。
 *
 * 验证范围：
 *   Part 1 — Cookie 保存/加载往返
 *     1. saveCookies 合并逻辑（session 写入 + 旧 cookie 保留 + 过期丢弃）
 *     2. loadCookies → saveCookies 往返一致性
 *     3. deleteSingleCookie 显式剔除（不走合并保留逻辑）
 *     4. cookies.json 格式完整性（字段齐全、JSON 可序列化）
 *
 *   Part 2 — SQLite 读写（条件执行）
 *     1. better-sqlite3 加载（ABI 不兼容时 SKIP）
 *     2. 表创建 + CRUD
 *     3. FTS5 全文检索
 *     4. WAL 模式设置
 *
 * 运行：node scripts/test-pre-release.js（任何失败以非零码退出）
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// ==================== 依赖打桩 ====================

/** 临时 userData 目录 */
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-pre-release-'));

/** 内存 session 模拟：partition → { name|domain|path → cookie } */
const sessionStore = new Map();

/**
 * 获取或创建模拟 session
 * @param {string} partition - partition 标识
 * @returns {Object} 模拟 session 对象
 */
function getOrCreateSession(partition) {
  if (!sessionStore.has(partition)) {
    sessionStore.set(partition, new Map());
  }
  const store = sessionStore.get(partition);
  return {
    cookies: {
      /** 模拟 ses.cookies.get({}) */
      async get() {
        return [...store.values()];
      },
      /**
       * 模拟 ses.cookies.set(details)
       * 将 cookie 存入内存 Map，key = domain|name|path
       */
      async set(details) {
        const key = `${details.domain}|${details.name}|${details.path || '/'}`;
        store.set(key, {
          name: details.name,
          value: details.value,
          domain: details.domain,
          path: details.path || '/',
          expirationDate: details.expirationDate,
          secure: details.secure || false,
          httpOnly: details.httpOnly || false,
          sameSite: details.sameSite || 'unspecified',
          hostOnly: details.hostOnly || false,
          url: details.url || '',
        });
      },
      /**
       * 模拟 ses.cookies.remove(url, name)
       * 从内存 Map 中删除匹配的 cookie
       */
      async remove(url, name) {
        for (const [key, cookie] of store.entries()) {
          if (cookie.name === name) {
            store.delete(key);
            break;
          }
        }
      },
    },
  };
}

const electronStub = {
  app: { getPath: () => tmpUserData },
  session: { fromPartition: (partition) => getOrCreateSession(partition) },
};

class StoreStub {
  constructor() {}
  get(key, def) { return def; }
}

const STUBS = {
  electron: electronStub,
  'electron-store': StoreStub,
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(STUBS, request)) {
    return STUBS[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};

// ==================== 加载被测模块 ====================

const cookieManager = require(path.join(__dirname, '..', 'cookie-manager'));

// ==================== 断言工具 ====================

const results = [];

/**
 * 记录并输出一项断言结果
 * @param {string} name - 断言名称
 * @param {boolean} condition - 断言条件
 * @param {string} [detail] - 失败时的补充信息
 */
function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${condition ? '' : (detail ? ' — ' + detail : '')}`);
}

/**
 * 读取 cookies.json 并返回解析后的数组
 * @param {string} containerId - 容器 ID
 * @returns {Array} cookie 数组
 */
function readCookieFile(containerId) {
  const filePath = path.join(tmpUserData, 'containers', containerId, 'cookies.json');
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ==================== Part 1：Cookie 保存/加载往返 ====================

/**
 * 测试 saveCookies 合并逻辑
 * - session cookie 写入文件
 * - 文件中存在但 session 没有的未过期 cookie 被保留
 * - 文件中已过期的 cookie 被丢弃
 */
async function testSaveCookiesMerge() {
  const cid = 'test-merge';
  const partition = `persist:container-${cid}`;
  const ses = getOrCreateSession(partition);

  // 预置旧文件：1 个未过期 + 1 个已过期
  const containerDir = path.join(tmpUserData, 'containers', cid);
  fs.mkdirSync(containerDir, { recursive: true });
  const nowSec = Date.now() / 1000;
  fs.writeFileSync(path.join(containerDir, 'cookies.json'), JSON.stringify([
    { name: 'OLD_KEEP', value: 'v1', domain: '.keep.com', path: '/', expirationDate: nowSec + 86400, secure: false, httpOnly: false, sameSite: 'unspecified', hostOnly: false },
    { name: 'OLD_EXPIRE', value: 'v2', domain: '.expire.com', path: '/', expirationDate: nowSec - 86400, secure: false, httpOnly: false, sameSite: 'unspecified', hostOnly: false },
  ], null, 2));

  // 写入 session cookie
  await ses.cookies.set({ name: 'S1', value: 'sv1', domain: '.session.com', path: '/', secure: false, httpOnly: false, sameSite: 'unspecified', hostOnly: false });

  // 执行 saveCookies
  const result = await cookieManager.saveCookies(cid);
  check('saveCookies 合并写入成功', result.success === true, JSON.stringify(result));

  const saved = readCookieFile(cid);
  const names = new Set(saved.map(c => c.name));
  check('合并结果包含 session cookie S1', names.has('S1'));
  check('合并结果保留未过期旧 cookie OLD_KEEP', names.has('OLD_KEEP'));
  check('合并结果丢弃已过期旧 cookie OLD_EXPIRE', !names.has('OLD_EXPIRE'));
  check('合并结果共 2 条', saved.length === 2, `实际 ${saved.length}`);
}

/**
 * 测试 loadCookies → saveCookies 往返一致性
 * 保存的文件能被正确读取并重新写入，数据不丢不损
 */
async function testLoadSaveRoundtrip() {
  const cid = 'test-roundtrip';
  const partition = `persist:container-${cid}`;
  const ses = getOrCreateSession(partition);

  // 准备初始 cookie 文件
  const containerDir = path.join(tmpUserData, 'containers', cid);
  fs.mkdirSync(containerDir, { recursive: true });
  const original = [
    { name: 'R1', value: 'rv1', domain: '.round.com', path: '/', expirationDate: Date.now() / 1000 + 86400, secure: true, httpOnly: true, sameSite: 'lax', hostOnly: false, url: 'https://round.com/' },
    { name: 'R2', value: 'rv2', domain: 'exact.round.com', path: '/api', expirationDate: Date.now() / 1000 + 86400, secure: false, httpOnly: false, sameSite: 'strict', hostOnly: true, url: 'http://exact.round.com/api' },
  ];
  fs.writeFileSync(path.join(containerDir, 'cookies.json'), JSON.stringify(original, null, 2));

  // loadCookies 将文件 cookie 注入 session
  const loadResult = await cookieManager.loadCookies(cid);
  check('loadCookies 成功', loadResult.success === true, JSON.stringify(loadResult));
  check('loadCookies 加载 2 条', loadResult.count === 2, `实际 ${loadResult.count}`);

  // saveCookies 将 session cookie 写回文件
  const saveResult = await cookieManager.saveCookies(cid);
  check('saveCookies 往返写回成功', saveResult.success === true);

  // 读回文件，验证数据一致
  const roundtripped = readCookieFile(cid);
  check('往返后文件有 2 条', roundtripped.length === 2, `实际 ${roundtripped.length}`);

  for (const orig of original) {
    const found = roundtripped.find(c => c.name === orig.name);
    check(`往返后 ${orig.name} 存在`, !!found);
    if (found) {
      check(`往返后 ${orig.name}.value 一致`, found.value === orig.value, `期望 ${orig.value} 实际 ${found.value}`);
      check(`往返后 ${orig.name}.domain 一致`, found.domain === orig.domain);
      check(`往返后 ${orig.name}.secure 一致`, found.secure === orig.secure);
      check(`往返后 ${orig.name}.sameSite 一致`, found.sameSite === orig.sameSite);
    }
  }
}

/**
 * 测试 deleteSingleCookie 显式剔除
 * 删除后文件不含已删 cookie（不会因合并逻辑复活）
 */
async function testDeleteSingleCookie() {
  const cid = 'test-delete';
  const partition = `persist:container-${cid}`;
  const ses = getOrCreateSession(partition);

  // 准备初始 cookie 文件
  const containerDir = path.join(tmpUserData, 'containers', cid);
  fs.mkdirSync(containerDir, { recursive: true });
  const nowSec = Date.now() / 1000;
  const cookies = [
    { name: 'DEL_ME', value: 'dv1', domain: '.delete.com', path: '/', expirationDate: nowSec + 86400, secure: false, httpOnly: false, sameSite: 'unspecified', hostOnly: false, url: 'https://delete.com/' },
    { name: 'KEEP_ME', value: 'dv2', domain: '.delete.com', path: '/', expirationDate: nowSec + 86400, secure: false, httpOnly: false, sameSite: 'unspecified', hostOnly: false, url: 'https://delete.com/' },
  ];
  fs.writeFileSync(path.join(containerDir, 'cookies.json'), JSON.stringify(cookies, null, 2));

  // 同步写入 session
  for (const c of cookies) {
    await ses.cookies.set(c);
  }

  // 删除 DEL_ME
  const delResult = await cookieManager.deleteSingleCookie(cid, {
    name: 'DEL_ME',
    domain: '.delete.com',
    path: '/',
    secure: false,
  });
  check('deleteSingleCookie 成功', delResult.success === true, JSON.stringify(delResult));

  // 验证文件中不含 DEL_ME
  const afterDel = readCookieFile(cid);
  const delNames = new Set(afterDel.map(c => c.name));
  check('删除后文件不含 DEL_ME', !delNames.has('DEL_ME'));
  check('删除后文件保留 KEEP_ME', delNames.has('KEEP_ME'));

  // 关键验证：saveCookies 后 DEL_ME 不会复活
  await cookieManager.saveCookies(cid);
  const afterSave = readCookieFile(cid);
  const saveNames = new Set(afterSave.map(c => c.name));
  check('saveCookies 后 DEL_ME 不会复活', !saveNames.has('DEL_ME'));
  check('saveCookies 后 KEEP_ME 仍在', saveNames.has('KEEP_ME'));
}

/**
 * 测试 cookies.json 格式完整性
 * Array.isArray、10 字段齐全、JSON 可序列化/反序列化
 */
async function testCookieFileIntegrity() {
  const cid = 'test-integrity';
  const partition = `persist:container-${cid}`;
  const ses = getOrCreateSession(partition);

  // 写入各种属性组合的 cookie
  const testCookies = [
    { name: 'FULL', value: 'v', domain: '.full.com', path: '/', expirationDate: Date.now() / 1000 + 86400, secure: true, httpOnly: true, sameSite: 'lax', hostOnly: false, url: 'https://full.com/' },
    { name: 'MINIMAL', value: 'v', domain: 'minimal.com', path: '/', secure: false, httpOnly: false, sameSite: 'unspecified', hostOnly: true, url: 'http://minimal.com/' },
  ];
  for (const c of testCookies) {
    await ses.cookies.set(c);
  }

  await cookieManager.saveCookies(cid);
  const saved = readCookieFile(cid);

  check('cookies.json 是数组', Array.isArray(saved));
  check('cookies.json 有 2 条', saved.length === 2, `实际 ${saved.length}`);

  const REQUIRED_FIELDS = ['name', 'value', 'domain', 'path', 'secure', 'httpOnly', 'sameSite', 'hostOnly'];
  for (const cookie of saved) {
    for (const field of REQUIRED_FIELDS) {
      check(`${cookie.name} 字段 ${field} 存在`, cookie[field] !== undefined, `值: ${cookie[field]}`);
    }
  }

  // 验证 JSON 可序列化/反序列化
  const raw = fs.readFileSync(path.join(tmpUserData, 'containers', cid, 'cookies.json'), 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
    check('JSON.parse 不抛异常', true);
  } catch (e) {
    check('JSON.parse 不抛异常', false, e.message);
  }
  check('反序列化后是数组', Array.isArray(parsed));
}

// ==================== Part 2：SQLite 读写验证 ====================

async function testSqlite() {
  console.log('\n=== Part 2: SQLite 读写 ===\n');

  // 尝试加载 better-sqlite3
  let Database;
  try {
    Database = require('better-sqlite3');
    check('better-sqlite3 加载', true);
  } catch (e) {
    check('better-sqlite3 加载', false, e.message);
    console.log('SKIP Part 2 全部跳过（ABI 不兼容，使用 electron-rebuild 重建后重试）');
    return;
  }

  // 创建临时数据库
  const dbPath = path.join(tmpUserData, 'test-pre-release.db');
  const db = new Database(dbPath);

  // WAL 模式
  db.pragma('journal_mode = WAL');
  const walResult = db.pragma('journal_mode', { simple: true });
  check('WAL 模式设置成功', walResult === 'wal', `实际 ${walResult}`);

  // 表创建 + CRUD
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )
  `);
  check('favorites 表创建', true);

  // INSERT
  const insert = db.prepare('INSERT INTO favorites (url, title) VALUES (?, ?)');
  insert.run('https://example.com', 'Example');
  insert.run('https://test.com', 'Test');
  const count = db.prepare('SELECT COUNT(*) as c FROM favorites').get();
  check('INSERT 2 条记录', count.c === 2, `实际 ${count.c}`);

  // SELECT
  const row = db.prepare('SELECT * FROM favorites WHERE url = ?').get('https://example.com');
  check('SELECT 查询正确', row && row.title === 'Example', JSON.stringify(row));

  // UPDATE
  db.prepare('UPDATE favorites SET title = ? WHERE url = ?').run('Updated', 'https://example.com');
  const updated = db.prepare('SELECT title FROM favorites WHERE url = ?').get('https://example.com');
  check('UPDATE 生效', updated.title === 'Updated');

  // DELETE
  db.prepare('DELETE FROM favorites WHERE url = ?').run('https://test.com');
  const afterDel = db.prepare('SELECT COUNT(*) as c FROM favorites').get();
  check('DELETE 生效', afterDel.c === 1, `实际 ${afterDel.c}`);

  // FTS5 全文检索
  try {
    db.exec(`CREATE VIRTUAL TABLE test_fts USING fts5(content)`);
    db.exec(`INSERT INTO test_fts (content) VALUES ('hello world')`);
    db.exec(`INSERT INTO test_fts (content) VALUES ('realm browser test')`);
    const ftsResult = db.prepare(`SELECT * FROM test_fts WHERE test_fts MATCH 'realm'`).all();
    check('FTS5 全文检索', ftsResult.length === 1 && ftsResult[0].content === 'realm browser test');
  } catch (e) {
    check('FTS5 全文检索', false, e.message);
  }

  // JSON 序列化兼容性（模拟 history-manager 的数据结构）
  const testRecord = {
    url: 'https://json-test.com',
    title: 'JSON 测试',
    favicon: '',
    visitTime: Date.now(),
  };
  db.exec(`
    CREATE TABLE IF NOT EXISTS json_test (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);
  db.prepare('INSERT INTO json_test (id, data) VALUES (?, ?)').run(1, JSON.stringify(testRecord));
  const jsonRow = db.prepare('SELECT data FROM json_test WHERE id = 1').get();
  const parsed = JSON.parse(jsonRow.data);
  check('JSON 序列化往返', parsed.url === testRecord.url && parsed.title === testRecord.title);

  db.close();

  // 验证数据库文件可被重新打开
  const db2 = new Database(dbPath);
  const reopenCount = db2.prepare('SELECT COUNT(*) as c FROM favorites').get();
  check('数据库关闭后重新打开', reopenCount.c === 1);
  db2.close();
}

// ==================== 执行 ====================

async function main() {
  console.log('=== Part 1: Cookie 保存/加载往返 ===\n');

  await testSaveCookiesMerge();
  await testLoadSaveRoundtrip();
  await testDeleteSingleCookie();
  await testCookieFileIntegrity();

  await testSqlite();
}

main()
  .then(() => {
    const passCount = results.filter(r => r.pass).length;
    const failCount = results.length - passCount;
    console.log(`\nSummary: ${passCount}/${results.length} PASS, ${failCount} FAIL`);
    fs.rmSync(tmpUserData, { recursive: true, force: true });
    if (failCount > 0) {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('FATAL 测试执行异常:', err);
    fs.rmSync(tmpUserData, { recursive: true, force: true });
    process.exit(1);
  });

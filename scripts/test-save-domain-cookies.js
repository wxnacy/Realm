/**
 * Realm Browser - saveDomainCookies 过滤语义运行时冒烟测试
 *
 * 目的（持久回归护栏，回应 10-UAT.md test 6 major issue）：
 * 保存按钮曾 100% 落入 save-all fallback（渲染层域名提取依赖不存在的
 * DOM class，domain 恒为 ''），且 saveDomainCookies 的过滤方向
 * （匹配子域名 Cookie）与 Cookie 管理面板 applyDomainFilter 的
 * subdomain 模式（匹配父域名 Cookie，即当前页面可见集合）语义相反，
 * 导致保存数 ≠ 面板显示数。本测试在纯 Node 环境（不启动 Electron）
 * 通过 Module._load 拦截对 cookie-manager.js 的依赖打桩，断言：
 *   1. includeSubdomains=true 时保存集合 ≡ 面板"含子域名"过滤显示集合
 *      （当前域名 + 其父域），子域方向/无关域/后缀伪装域/子串伪装域均被拒绝；
 *   2. includeSubdomains=false 时仅精确匹配当前域名（含前导点变体）；
 *   3. 合并保留：文件中范围外未过期旧 Cookie 被保留，已过期旧 Cookie 被丢弃，
 *      返回 count 仅计本次匹配的 session Cookie（不含保留数）；
 *   4. 渲染层静态断言：handleSaveToFile 函数体内不再出现 document 级
 *      CSS 选择器查询调用，域名提取与 showCookiesModal 同源
 *      （state.tabs.get(state.activeTabId)）。
 *
 * 运行：node scripts/test-save-domain-cookies.js（任何失败以非零码退出）
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// ==================== 依赖打桩 ====================

/** 临时 userData 目录（必须在加载被测模块前创建，CONTAINERS_DIR 派生自它） */
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-test-'));

/** fixture session Cookie（domain 为关键字段，其余给合理默认值） */
const fixtureCookies = [
  { name: 'A', domain: '.baidu.com' },          // 父域（前导点）→ 应匹配
  { name: 'B', domain: 'baidu.com' },           // 父域 → 应匹配
  { name: 'C', domain: 'www.baidu.com' },       // 当前域 → 应匹配
  { name: 'D', domain: '.www.baidu.com' },      // 当前域（前导点）→ 应匹配
  { name: 'E', domain: 'api.www.baidu.com' },   // 子域方向 → 应拒绝（UI 同样不显示）
  { name: 'F', domain: '.other.com' },          // 无关域 → 应拒绝
  { name: 'G', domain: '.baidu.com.evil.com' }, // 后缀伪装域 → 应拒绝（安全用例）
  { name: 'H', domain: 'notbaidu.com' },        // 子串伪装域 → 应拒绝
].map(c => ({
  value: `val-${c.name}`,
  path: '/',
  secure: false,
  httpOnly: false,
  sameSite: 'unspecified',
  hostOnly: false,
  url: `https://${c.domain.startsWith('.') ? c.domain.slice(1) : c.domain}/`,
  ...c,
}));

/** electron 桩：userData 指向临时目录；session.cookies.get 返回 fixture */
const electronStub = {
  app: {
    getPath: () => tmpUserData,
  },
  session: {
    fromPartition: () => ({
      cookies: {
        get: async () => fixtureCookies,
      },
    }),
  },
};

/** electron-store 桩：模块顶层会实例化 configStore，必须可构造 */
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

const { saveDomainCookies } = require(path.join(__dirname, '..', 'cookie-manager'));

// ==================== 预置旧文件 ====================

const nowSec = Date.now() / 1000;
const containerDir = path.join(tmpUserData, 'containers', 'test-container');
const cookieFilePath = path.join(containerDir, 'cookies.json');
fs.mkdirSync(containerDir, { recursive: true });
fs.writeFileSync(cookieFilePath, JSON.stringify([
  {
    name: 'OLD_OK',
    value: 'old-ok',
    domain: '.other.com',
    path: '/',
    expirationDate: nowSec + 86400, // 未来 → 应保留
    secure: false,
    httpOnly: false,
    sameSite: 'unspecified',
  },
  {
    name: 'OLD_EXPIRED',
    value: 'old-expired',
    domain: '.legacy.com',
    path: '/',
    expirationDate: nowSec - 86400, // 过去 → 应丢弃
    secure: false,
    httpOnly: false,
    sameSite: 'unspecified',
  },
], null, 2));

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
 * 读取写回的 cookies.json，返回 Cookie name 集合
 * @returns {Set<string>} Cookie name 集合
 */
function readSavedNames() {
  const data = JSON.parse(fs.readFileSync(cookieFilePath, 'utf8'));
  return new Set(data.map(c => c.name));
}

/**
 * 从源码中提取函数体（起始签名行至首个列 0 的 `}` 行，与 verify 命令的 sed 范围一致）
 * @param {string} source - 文件源码
 * @param {string} signature - 函数签名起始串
 * @returns {string} 函数体文本
 */
function extractFunctionBody(source, signature) {
  const startIdx = source.indexOf(signature);
  if (startIdx === -1) return '';
  const lines = source.slice(startIdx).split('\n');
  const body = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && lines[i].startsWith('}')) break;
    body.push(lines[i]);
  }
  return body.join('\n');
}

// ==================== 执行 ====================

async function main() {
  // ---------- 用例 1：includeSubdomains=true（对齐面板"含子域名"过滤集合） ----------
  const result1 = await saveDomainCookies('test-container', 'www.baidu.com', true);
  check('用例1 result.success 为 true', result1.success === true, JSON.stringify(result1));
  check('用例1 result.count === 4（当前域名 + 其父域，与面板显示同集合）',
    result1.count === 4, `实际 count=${result1.count}`);

  const names1 = readSavedNames();
  check('用例1 文件包含 A(.baidu.com)/B(baidu.com)/C(www.baidu.com)/D(.www.baidu.com)',
    ['A', 'B', 'C', 'D'].every(n => names1.has(n)),
    `实际 names=${[...names1].join(',')}`);
  check('用例1 文件拒绝 E(api.www.baidu.com 子域方向)',
    !names1.has('E'));
  check('用例1 文件拒绝 F(.other.com 无关域)',
    !names1.has('F'));
  check('用例1 文件拒绝 G(.baidu.com.evil.com 后缀伪装域)',
    !names1.has('G'));
  check('用例1 文件拒绝 H(notbaidu.com 子串伪装域)',
    !names1.has('H'));
  check('用例1 合并保留 OLD_OK（范围外未过期旧 Cookie）',
    names1.has('OLD_OK'));
  check('用例1 丢弃 OLD_EXPIRED（已过期旧 Cookie）',
    !names1.has('OLD_EXPIRED'));

  // ---------- 用例 2：includeSubdomains=false（仅精确匹配，含前导点变体） ----------
  const result2 = await saveDomainCookies('test-container', 'www.baidu.com', false);
  check('用例2 result.success 为 true', result2.success === true, JSON.stringify(result2));
  check('用例2 result.count === 2（仅 www.baidu.com 与 .www.baidu.com）',
    result2.count === 2, `实际 count=${result2.count}`);

  const names2 = readSavedNames();
  check('用例2 合并保留：文件仍包含 A/B/C/D 与 OLD_OK',
    ['A', 'B', 'C', 'D', 'OLD_OK'].every(n => names2.has(n)),
    `实际 names=${[...names2].join(',')}`);
  check('用例2 文件仍不含 E/F/G/H/OLD_EXPIRED',
    !['E', 'F', 'G', 'H', 'OLD_EXPIRED'].some(n => names2.has(n)));

  // ---------- 渲染层静态断言（函数级范围，防止空实现通过文件级计数） ----------
  const rendererSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const fnBody = extractFunctionBody(rendererSource, 'async function handleSaveToFile');
  assert.notStrictEqual(fnBody, '', '未找到 handleSaveToFile 函数');
  check('handleSaveToFile 函数体内无 document 级 CSS 选择器查询调用',
    !/querySelector(All)?/.test(fnBody));
  check('handleSaveToFile 函数体内 state.tabs.get(state.activeTabId) 至少出现 1 次（与 showCookiesModal 同源）',
    (fnBody.match(/state\.tabs\.get\(state\.activeTabId\)/g) || []).length >= 1);
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

#!/usr/bin/env node
/**
 * 统一导航入口 openUrl 自动化测试
 *
 * 验证 docs/product/navigation-entry-points.md 规划的统一导航入口：
 * - 分配规则匹配（命中其他容器 → 匹配容器新建 tab，原 tab 不动）
 * - 显式容器优先于规则（explicitContainerId）
 * - 内部 URL（realm://）豁免规则匹配
 * - m3u8 → tab 持久化存原始 URL
 * - background-tab 焦点切回
 * - 连续导航 seq 竞态守卫（只让最后一次生效）
 * - bypassRules 跳过规则
 * - 地址栏回车 / 收藏栏点击两条 UI 链路接线正确
 *
 * 用法: node tests/test-unified-navigation.js
 *
 * 说明：用全局 playwright 的 _electron 驱动真实 dev 应用（NODE_ENV=development，
 * 独立 userData 不污染正式数据）。伪域名规则命中后页面加载会 DNS 失败，
 * 属预期——断言只依赖 tab 元数据（tab:list / tab:get-active / DOM），不依赖页面内容。
 * 测试规则与 tabs.json 在启动前重置/收尾清理。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { _electron } = require('/Users/wxnacy/.nvm/versions/node/v22.22.0/lib/node_modules/playwright');

const REALM_ROOT = path.join(__dirname, '..');
const AR_MODULE = path.join(REALM_ROOT, 'assignment-rules.js');
const TABS_FILE = path.join(os.homedir(), 'Library/Application Support/realm-dev/tabs.json');

// 测试用规则（收尾清理）
const TEST_RULE_PATTERNS = ['nav-test-example.com', 'same-container-test.com'];

// ==================== 测试工具 ====================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ ${message}`);
  } else {
    failCount++;
    console.log(`  ✗ ${message}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
  console.log('─'.repeat(60));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ==================== 主流程 ====================

async function main() {
  // 启动前重置 dev 环境的 tab 持久化，保证干净初始状态
  fs.writeFileSync(TABS_FILE, JSON.stringify({
    tabs: [], tabCounter: 0, activeTabId: null, activeTabs: {},
  }));

  console.log('启动 dev 应用...');
  const app = await _electron.launch({
    args: ['.'],
    cwd: REALM_ROOT,
    executablePath: path.join(REALM_ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
    env: { ...process.env, NODE_ENV: 'development' },
  });

  // 必须按 URL 找主窗口（firstWindow 可能拿到 devtools 窗口）；
  // launch 后窗口创建与导航需要时间，轮询等待最多 20s
  let win = null;
  for (let i = 0; i < 100; i++) {
    win = app.windows().find((w) => w.url().includes('index.html'));
    if (win) break;
    await sleep(200);
  }
  if (!win) throw new Error('未找到 index.html 主窗口');
  await win.waitForLoadState('domcontentloaded');
  // 等 restoreTabs / 初始建 tab / 收藏栏加载完成
  await win.waitForFunction(() => window.realmAPI && document.querySelector('.tab'), { timeout: 15000 });
  await sleep(800);

  // 清空既有规则并写入测试规则（主进程同模块实例，IPC rule:match 即时可见）。
  // 注意：app.evaluate 必须传真实函数（playwright 按 toString 序列化），
  // 字符串表达式只会得到未调用的函数对象；路径经 JSON 字面量内插（主进程
  // 无全局 require，用 process.mainModule.require 取应用同实例模块）
  const AR_PATH_LITERAL = JSON.stringify(AR_MODULE);
  const setupRulesCount = await app.evaluate(new Function(`return async () => {
    const rulesMod = process.mainModule.require(${AR_PATH_LITERAL});
    for (const r of rulesMod.getRules()) rulesMod.deleteRule(r.id);
    rulesMod.createRule('work', 'nav-test-example.com');      // 命中 → work（非当前容器）
    rulesMod.createRule('default', 'same-container-test.com'); // 命中 → default（当前容器）
    return rulesMod.getRules().length;
  }`)());
  assert(setupRulesCount === 2, `测试规则已写入主进程（${setupRulesCount} 条）`);
  // 验证 renderer → IPC → 主进程的 matchRule 链路（后续规则用例的前提）
  const matchSmoke = await win.evaluate(() => window.realmAPI.matchRule('https://nav-test-example.com/smoke'));
  assert(matchSmoke === 'work', `matchRule IPC 链路正常（实际 ${matchSmoke}）`);

  // ---- 页面侧辅助 ----
  const getTabs = () => win.evaluate(() => window.realmAPI.getTabs());
  const getActiveDomTabId = () => win.evaluate(() => {
    const el = document.querySelector('.tab.active');
    return el ? el.dataset.tabId : null;
  });
  const callOpenUrl = (url, opts) => win.evaluate(
    ({ u, o }) => window.openUrl(u, o),
    { u: url, o: opts || {} },
  );
  const switchTab = (tabId) => win.evaluate((id) => window.switchTab(id), tabId);

  // 初始快照
  const initialTabs = await getTabs();
  const initialActiveId = await getActiveDomTabId();
  const initialTab = initialTabs.find((t) => t.id === initialActiveId);
  section('初始状态');
  assert(initialTabs.length >= 1, `应用启动后有 tab（${initialTabs.length} 个）`);
  assert(initialTab && initialTab.containerId === 'default', `初始活动 tab 在 default 容器`);

  // ---------- 用例 1：规则命中其他容器 + current-tab → 匹配容器新建 tab，原 tab 不动 ----------
  section('用例 1: 规则命中其他容器 + current-tab');
  const r1 = await callOpenUrl('https://nav-test-example.com/path', { disposition: 'current-tab' });
  await sleep(400);
  const tabs1 = await getTabs();
  const active1 = await getActiveDomTabId();
  const workTab = tabs1.find((t) => t.id === (r1 && r1.tabId));
  assert(r1 && r1.action === 'created', `openUrl 返回 created（实际 ${r1 && r1.action}）`);
  assert(workTab && workTab.containerId === 'work', '新 tab 建在匹配容器 work');
  assert(active1 === r1.tabId, '新 tab 已切换为活动 tab');
  const origTab1 = tabs1.find((t) => t.id === initialActiveId);
  assert(origTab1 && origTab1.url === initialTab.url, `原 tab URL 未被改动（${origTab1 && origTab1.url}）`);

  // ---------- 用例 2：规则命中当前容器 + current-tab → 原地导航 ----------
  section('用例 2: 规则命中当前容器 + current-tab');
  await switchTab(initialActiveId);
  await sleep(200);
  const tabsBefore2 = (await getTabs()).length;
  const r2 = await callOpenUrl('https://same-container-test.com/page', { disposition: 'current-tab' });
  await sleep(400);
  const tabs2 = await getTabs();
  assert(r2 && r2.action === 'navigated', `openUrl 返回 navigated（实际 ${r2 && r2.action}）`);
  assert(tabs2.length === tabsBefore2, '没有新建 tab');
  const navigatedTab = tabs2.find((t) => t.id === initialActiveId);
  assert(navigatedTab && navigatedTab.url === 'https://same-container-test.com/page',
    `当前 tab URL 已更新为规则命中 URL（实际 ${navigatedTab && navigatedTab.url}）`);

  // ---------- 用例 3：未命中规则 + current-tab → 原地导航，容器不变 ----------
  section('用例 3: 未命中规则 + current-tab');
  const r3 = await callOpenUrl('https://plain-nav-test.com/', { disposition: 'current-tab' });
  await sleep(400);
  const tabs3 = await getTabs();
  const tab3 = tabs3.find((t) => t.id === initialActiveId);
  assert(r3 && r3.action === 'navigated', `openUrl 返回 navigated（实际 ${r3 && r3.action}）`);
  assert(tab3 && tab3.containerId === 'default', '容器保持 default');
  assert(tab3 && tab3.url === 'https://plain-nav-test.com/', `URL 已更新（实际 ${tab3 && tab3.url}）`);

  // ---------- 用例 4：显式容器优先于规则（决策 3） ----------
  section('用例 4: 显式容器优先于规则');
  const r4 = await callOpenUrl('https://nav-test-example.com/explicit', {
    disposition: 'new-tab', explicitContainerId: 'personal',
  });
  await sleep(400);
  const tabs4 = await getTabs();
  const tab4 = tabs4.find((t) => t.id === (r4 && r4.tabId));
  assert(r4 && r4.action === 'created', `openUrl 返回 created（实际 ${r4 && r4.action}）`);
  assert(tab4 && tab4.containerId === 'personal', `tab 建在显式容器 personal（规则 work 被跳过，实际 ${tab4 && tab4.containerId}）`);

  // ---------- 用例 5：realm:// 内部 URL 豁免 + 原地导航 ----------
  section('用例 5: realm:// 内部 URL 豁免');
  // 用例 4 新建 tab 后活动 tab 已切换，先切回初始 tab 再做 current-tab 断言
  await switchTab(initialActiveId);
  await sleep(200);
  const r5 = await callOpenUrl('realm://settings', { disposition: 'current-tab' });
  await sleep(400);
  const tabs5 = await getTabs();
  const tab5 = tabs5.find((t) => t.id === initialActiveId);
  assert(r5 && r5.action === 'navigated', `openUrl 返回 navigated（实际 ${r5 && r5.action}）`);
  assert(tab5 && tab5.url === 'realm://settings', `tab URL 存为 realm://settings（实际 ${tab5 && tab5.url}）`);

  // ---------- 用例 6：m3u8 → tab 持久化存原始 URL ----------
  section('用例 6: m3u8 URL');
  await switchTab(initialActiveId);
  await sleep(200);
  const r6 = await callOpenUrl('https://cdn-nav-test.com/video.m3u8', { disposition: 'current-tab' });
  await sleep(400);
  const tabs6 = await getTabs();
  const tab6 = tabs6.find((t) => t.id === initialActiveId);
  assert(r6 && r6.action === 'navigated', `openUrl 返回 navigated（实际 ${r6 && r6.action}）`);
  assert(tab6 && tab6.url === 'https://cdn-nav-test.com/video.m3u8',
    `tab 持久化存原始 m3u8 地址（实际 ${tab6 && tab6.url}）`);

  // ---------- 用例 7：background-tab 焦点切回 ----------
  section('用例 7: background-tab 焦点切回');
  await switchTab(initialActiveId);
  await sleep(200);
  const r7 = await callOpenUrl('https://bg-nav-test.com/', { disposition: 'background-tab' });
  await sleep(500);
  const active7 = await getActiveDomTabId();
  assert(r7 && r7.action === 'created', `openUrl 返回 created（实际 ${r7 && r7.action}）`);
  assert(active7 === initialActiveId, `焦点切回原 tab（原 ${initialActiveId}，现 ${active7}）`);
  const tabs7 = await getTabs();
  const bgTab = tabs7.find((t) => t.id === (r7 && r7.tabId));
  assert(bgTab && bgTab.containerId === 'default', '后台 tab 建在当前容器 default');

  // ---------- 用例 8：连续导航 seq 竞态守卫 ----------
  section('用例 8: 连续导航竞态守卫');
  await switchTab(initialActiveId);
  await sleep(200);
  const raceResult = await win.evaluate(async () => {
    const first = window.openUrl('https://race-a-nav-test.com/', { disposition: 'current-tab' });
    const second = await window.openUrl('https://race-b-nav-test.com/', { disposition: 'current-tab' });
    const firstResult = await first;
    return { first: firstResult, second };
  });
  await sleep(400);
  assert(raceResult.first && raceResult.first.action === 'skipped',
    `先发起的导航被 seq 守卫丢弃（实际 ${raceResult.first && raceResult.first.action}）`);
  assert(raceResult.second && raceResult.second.action === 'navigated',
    `后发起的导航生效（实际 ${raceResult.second && raceResult.second.action}）`);
  const tabs8 = await getTabs();
  const tab8 = tabs8.find((t) => t.id === initialActiveId);
  assert(tab8 && tab8.url === 'https://race-b-nav-test.com/', `最终 URL 为第二次导航（实际 ${tab8 && tab8.url}）`);

  // ---------- 用例 9：bypassRules 跳过规则 ----------
  section('用例 9: bypassRules 跳过规则');
  const r9 = await callOpenUrl('https://nav-test-example.com/bypass', {
    disposition: 'new-tab', bypassRules: true,
  });
  await sleep(400);
  const tabs9 = await getTabs();
  const tab9 = tabs9.find((t) => t.id === (r9 && r9.tabId));
  assert(tab9 && tab9.containerId === 'default',
    `bypassRules 时 tab 建在当前容器 default（实际 ${tab9 && tab9.containerId}）`);

  // ---------- 用例 10：地址栏回车 UI 链路（规则命中 → 匹配容器新建 tab） ----------
  section('用例 10: 地址栏回车 UI 链路');
  await switchTab(initialActiveId);
  await sleep(200);
  const tabsBefore10 = (await getTabs()).length;
  await win.fill('#urlInput', 'https://nav-test-example.com/enter');
  await win.press('#urlInput', 'Enter');
  await sleep(600);
  const tabs10 = await getTabs();
  assert(tabs10.length === tabsBefore10 + 1, `回车后新建 1 个 tab（${tabsBefore10} → ${tabs10.length}）`);
  const newTab10 = tabs10[tabs10.length - 1];
  assert(newTab10 && newTab10.containerId === 'work', `回车导航命中规则建到 work 容器（实际 ${newTab10 && newTab10.containerId}）`);

  // ---------- 用例 11：收藏栏点击 UI 链路（handleBookmarkClick） ----------
  section('用例 11: 收藏栏点击链路');
  await switchTab(initialActiveId);
  await sleep(200);
  // 普通点击：规则命中其他容器 → 匹配容器新建 tab
  await win.evaluate(() => window.handleBookmarkClick('https://nav-test-example.com/bookmark', { metaKey: false, ctrlKey: false }));
  await sleep(500);
  const tabs11 = await getTabs();
  const bmTab = tabs11[tabs11.length - 1];
  assert(bmTab && bmTab.containerId === 'work', `收藏点击命中规则建到 work 容器（实际 ${bmTab && bmTab.containerId}）`);
  // Cmd+点击未命中 URL：新 tab 建在当前容器
  await switchTab(initialActiveId);
  await sleep(200);
  const tabsBefore11b = (await getTabs()).length;
  await win.evaluate(() => window.handleBookmarkClick('https://cmd-plain-nav-test.com/', { metaKey: true, ctrlKey: false }));
  await sleep(500);
  const tabs11b = await getTabs();
  assert(tabs11b.length === tabsBefore11b + 1, 'Cmd+点击新建 1 个 tab');
  const newCmdTab = tabs11b[tabs11b.length - 1];
  assert(newCmdTab && newCmdTab.containerId === 'default', `Cmd+点击未命中 URL 建在当前容器（实际 ${newCmdTab && newCmdTab.containerId}）`);

  // ---------- 收尾：清理测试规则 ----------
  await app.evaluate(new Function(`return async () => {
    const rulesMod = process.mainModule.require(${AR_PATH_LITERAL});
    const patterns = ${JSON.stringify(TEST_RULE_PATTERNS)};
    for (const r of rulesMod.getRules()) {
      if (patterns.includes(r.pattern)) rulesMod.deleteRule(r.id);
    }
    return rulesMod.getRules().length;
  }`)());

  // ==================== 汇总 ====================
  console.log('\n' + '='.repeat(60));
  console.log(`测试完成: ${passCount} 通过, ${failCount} 失败, 共 ${testCount} 项`);
  console.log('='.repeat(60));

  // app.close() 会被「再按一次 Cmd+Q 退出」确认拦截而挂死，直接退出进程
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n测试脚本异常:', err);
  process.exit(2);
});

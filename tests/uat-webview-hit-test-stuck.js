/**
 * UAT 驱动：webview 鼠标可命中性不会因拖拽/改宽残留而永久失效
 *
 * 背景（详见 docs/debug/webview-hit-test-stuck.md）：
 * 拖标签（tab-cross-drag）与拖 AI 面板宽度（ai-panel-resize）期间，会把**所有**
 * webview 的 pointer-events 置 none —— 这是必要的（否则鼠标经过网页区会被 guest 吞掉、
 * mousemove 断流）。病灶在于收尾只挂在各自的 mouseup 上：一旦那次 mouseup 丢了，
 * 网页区就永久失去鼠标命中，表现为「页面照常显示、链接与输入框全点不动、宿主 UI 正常、
 * 刷新页面无效，只能重启」，而 hint 模式（executeJavaScript 注入 + 元素 .click()，
 * 不走命中测试）仍能聚焦输入框。
 *
 * 运行方式（playwright **只在全局**，仓内 require.resolve('playwright') 直接
 * `Cannot find module`，故必须带 NODE_PATH）：
 *
 *     NODE_PATH="$(npm root -g)" node tests/uat-webview-hit-test-stuck.js
 *
 * 缺全局 playwright 时以 E-PW / exit 11 硬退出，而不是抛裸的 MODULE_NOT_FOUND ——
 * 那属于**环境前置缺失**，不是断言失败。
 *
 * Electron 可执行文件用**裸说明符** `require('electron')`：主工作树与
 * `.worktrees/<name>` 都能命中。不要改成绝对路径拼接（worktree 内会 MODULE_NOT_FOUND），
 * 详见 docs/dev/branching-spec.md 第三节。
 *
 * 断言方式：在 renderer 里用合成 MouseEvent 走**真实监听器链路**
 * （mousedown 冒泡到 #tabBar 上的 onCrossDragMouseDown / document capture 级
 * mousemove、mouseup；改宽走 #aiPanelResizeHandle 的 mousedown），再读
 * `getComputedStyle(wv).pointerEvents` 与 console.warn 记录。
 *
 * 已知保真度边界（必须说明，否则容易被读成比实际更强的证据）：
 * - `e.buttons` 的取值由本驱动**手工构造**（真实 Chromium 只在真鼠标 mousemove 时填），
 *   所以「mousemove 兜底」这条验证的是**监听器判定逻辑**，不是 Chromium 的 buttons 语义；
 *   看门狗那条（纯时间推进、零事件）不受该边界影响。
 * - 「正常收尾不打残留日志」是负命题，靠 console.warn 记录里不含「残留已恢复」判定。
 * - 本驱动不验证真实鼠标事件是否被 Chromium 送到 guest（那需要真机手势），只验证
 *   「可命中性状态机」在丢 mouseup 后能否自动回到正确值。
 * - **用例 7（日志落盘）的判据纪律**：日志文件是**追加**的，「文件里存在某行」会被历史
 *   会话的旧行满足 ⇒ 单独的存在性判据是假绿（单点变异实测确认）。必须配**计数增量**
 *   判据（本例：`residualAfter > residualBefore`），或用本次运行独有的随机 tag。
 *   7b/7d 是单变量对照：同前缀、同来源，只差正文是否命中噪声模式 —— 一个落盘一个不落，
 *   差异只能来自噪声规则本身（拆掉噪声规则时 7d 转红，已实测）。
 *
 * 用例 7 的额外价值：它在**真应用**里验证了 guest 的 console 能落盘（仓库旧结论
 * 「新版 Electron 收不到 guest 日志」源自「只在主窗口 contents 上监听」的误判）。
 *
 * 会话副作用（自清理）：若启动时只有 1 个 webview，会新建一个 about:blank 临时标签以
 * 获得「非活动 webview」用于验证不变量，结束时关闭并切回原活动标签；期间改宽收窄路径
 * 会写 aiPanelWidth，驱动结束前按原值写回。退出纪律：electronApp.close() + process.exit，
 * 严禁 pkill / pgrep 模式匹配杀进程。
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ELECTRON_EXECUTABLE = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 看门狗复查间隔（renderer.js 的 WEBVIEW_SUSPEND_WATCHDOG_MS）＋余量 */
const WATCHDOG_WAIT_MS = 3800;

// ==================== renderer 侧探针（必须自包含） ====================

/** 安装 console.warn 记录器（幂等） */
const INSTALL_WARN_SPY = () => {
  if (window.__hitTestProbe) return { ok: true };
  const orig = console.warn;
  window.__hitTestProbe = { warns: [], origWarn: orig };
  console.warn = function (...args) {
    try {
      window.__hitTestProbe.warns.push(args.map((a) => String(a)).join(' '));
    } catch (_) { /* 记录失败不影响应用 */ }
    return orig.apply(console, args);
  };
  return { ok: true };
};

const READ_WARNS = () => (window.__hitTestProbe ? window.__hitTestProbe.warns.slice() : []);
const CLEAR_WARNS = () => { if (window.__hitTestProbe) window.__hitTestProbe.warns.length = 0; };
const UNINSTALL_WARN_SPY = () => {
  if (window.__hitTestProbe) {
    console.warn = window.__hitTestProbe.origWarn;
    delete window.__hitTestProbe;
  }
};

/** 读所有 webview 的可命中性/可见性快照 */
const READ_WEBVIEWS = () => {
  const host = document.getElementById('browserView');
  if (!host) return null;
  return Array.from(host.querySelectorAll('webview')).map((wv, i) => ({
    i,
    pe: getComputedStyle(wv).pointerEvents,
    vis: getComputedStyle(wv).visibility,
    inert: wv.inert === true,
  }));
};

/** 会话状态快照（用于决定是否补临时标签、以及收尾切回哪个标签） */
const READ_SESSION = () => {
  const host = document.getElementById('browserView');
  return {
    webviewCount: host ? host.querySelectorAll('webview').length : 0,
    activeTabId: (typeof state !== 'undefined' && state) ? state.activeTabId : null,
    hasCreateTab: typeof createTab === 'function',
    hasCloseTab: typeof closeTab === 'function',
    hasSwitchTab: typeof switchTab === 'function',
    hasResume: typeof resumeWebviewHitTest === 'function',
  };
};

/**
 * 派发「标签跨窗口拖拽」的 mousedown（+可选 mousemove 激活）
 *
 * clientX/clientY 有意保持不动、只推 screenX：激活判据用的是 screen 距离
 * （CROSS_DRAG_THRESHOLD=5），而 computeInsertTarget 用的是 clientX —— 保持不动
 * 才能让插入点落在被拖的同一个 tab 上，不会真的重排用户的标签栏。
 */
const DISPATCH_TAB_DRAG = (payload) => {
  const tab = document.querySelector('#tabList .tab');
  if (!tab) return { ok: false, reason: '未找到 #tabList .tab' };
  const r = tab.getBoundingClientRect();
  if (r.width < 12 || r.height < 8) {
    return { ok: false, reason: `tab 尺寸异常 ${Math.round(r.width)}x${Math.round(r.height)}` };
  }
  const clientX = r.left + 6;
  const clientY = r.top + Math.floor(r.height / 2);
  const screenX = window.screenX + clientX;
  const screenY = window.screenY + clientY;
  const base = {
    bubbles: true, cancelable: true, view: window,
    button: 0, buttons: 1, clientX, clientY, screenX, screenY,
  };
  // 记下起点：后续 mouseup / mousemove 必须复用同一坐标，否则
  // onCrossDragMouseUp 会拿着 (0,0) 去算距离与落点 ⇒ 可能走 endDrag({outOfTabBar})
  // 那条会**真的新建一个窗口**的分支
  window.__hitTestDragAt = { clientX, clientY, screenX, screenY };
  // 直接派发在 tab 上：e.target.closest('.tab') 命中，且不会误命中 .tab-close
  tab.dispatchEvent(new MouseEvent('mousedown', base));
  if (payload && payload.activate) {
    document.body.dispatchEvent(new MouseEvent('mousemove', {
      ...base, screenX: screenX + (payload.dx || 8),
    }));
  }
  return { ok: true, clientX, clientY };
};

/**
 * 派发 mouseup（收尾）
 * 坐标刻意用**拖拽起点**：距离 0 < 阈值 ⇒ 走 onCrossDragMouseUp 的
 * `cancelDrag + resetCrossDragState` 分支，既不新建窗口也不重排标签栏
 */
const DISPATCH_MOUSE_UP = () => {
  const a = window.__hitTestDragAt || {};
  document.body.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true, cancelable: true, view: window, button: 0, buttons: 0,
    clientX: a.clientX || 0, clientY: a.clientY || 0,
    screenX: a.screenX || 0, screenY: a.screenY || 0,
  }));
};

/**
 * 派发「指针在动但没有按键」的 mousemove —— 真实拖拽丢 mouseup 后的第一现场信号
 * @param {number} buttons - 0 表示没有按键按下
 */
const DISPATCH_MOUSE_MOVE = (buttons) => {
  const a = window.__hitTestDragAt || {};
  document.body.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true, cancelable: true, view: window, buttons,
    clientX: a.clientX || 0, clientY: a.clientY || 0,
    screenX: a.screenX || 0, screenY: a.screenY || 0,
  }));
};

/** 派发 AI 面板改宽手柄的 mousedown */
const DISPATCH_RESIZE_DOWN = () => {
  const handle = document.getElementById('aiPanelResizeHandle');
  if (!handle) return { ok: false, reason: '未找到 #aiPanelResizeHandle' };
  const r = handle.getBoundingClientRect();
  handle.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true, cancelable: true, view: window,
    button: 0, buttons: 1,
    clientX: r.left + 1, clientY: r.top + 1,
    screenX: window.screenX + r.left + 1, screenY: window.screenY + r.top + 1,
  }));
  return { ok: true };
};

/**
 * 让面板可量宽（收窄收尾会把 offsetWidth 写回 aiPanelWidth）：
 * 先摘 hidden，再用应用自己的 loadAIPanelWidth 应用持久化宽度 ⇒ 写回即等值
 */
const ENSURE_PANEL_MEASURABLE = async () => {
  const panel = document.getElementById('aiPanel');
  if (!panel) return { ok: false, reason: '未找到 #aiPanel' };
  const wasHidden = panel.classList.contains('hidden');
  if (wasHidden) panel.classList.remove('hidden');
  if (typeof loadAIPanelWidth === 'function') await loadAIPanelWidth();
  return { ok: true, wasHidden, offsetWidth: panel.offsetWidth };
};

const READ_AI_PANEL_WIDTH = async () => {
  try {
    const s = await window.realmAPI.getSettings();
    return typeof s.aiPanelWidth === 'number' ? s.aiPanelWidth : null;
  } catch (_) { return null; }
};

const WRITE_AI_PANEL_WIDTH = async (w) => {
  try { await window.realmAPI.setSetting('aiPanelWidth', w); return true; } catch (_) { return false; }
};

/** 补一个 about:blank 临时标签（仅为拿到「非活动 webview」） */
const CREATE_SCRATCH_TAB = async () => {
  if (typeof createTab !== 'function' || typeof state === 'undefined') {
    return { ok: false, reason: 'createTab / state 不可达' };
  }
  const id = await createTab(state.currentContainer, 'about:blank');
  return { ok: true, tabId: id };
};

const CLEANUP_SCRATCH_TAB = async (tabId, restoreTabId) => {
  if (typeof closeTab === 'function' && tabId) await closeTab(tabId);
  if (restoreTabId && typeof switchTab === 'function' && state && state.activeTabId !== restoreTabId) {
    if (state.tabs.has(restoreTabId)) await switchTab(restoreTabId);
  }
  return true;
};

const CALL_RESUME = (source) => {
  if (typeof resumeWebviewHitTest !== 'function') return { ok: false, reason: 'resumeWebviewHitTest 不可达' };
  resumeWebviewHitTest(source);
  return { ok: true };
};

// ==================== 驱动主体 ====================

const visibleOf = (list) => (list || []).find((w) => w.vis === 'visible') || null;
const hiddenOf = (list) => (list || []).filter((w) => w.vis !== 'visible');

function residualWarns(warns) {
  return warns.filter((w) => w.includes('残留已恢复'));
}

/** 取主进程里的落盘路径（验证模块真的被接进 main.js，而不是靠猜路径） */
const GET_LOG_PATH = () => {
  try {
    // app.evaluate 里没有全局 require，用 mainModule.require 拿应用模块（缓存同实例）
    const mod = process.mainModule.require('./diagnostics-log');
    return { ok: true, path: mod.getLogPath(), enabled: mod.isEnabled() };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

/** 在活动 webview 里打一条 guest console 日志（level 默认 log） */
const GUEST_CONSOLE = async (payload) => {
  const text = typeof payload === 'string' ? payload : payload.text;
  const level = (typeof payload === 'object' && payload.level) || 'log';
  const wv = document.querySelector('#browserView webview[style*="visible"]')
    || Array.from(document.querySelectorAll('#browserView webview'))
      .find((w) => getComputedStyle(w).visibility === 'visible');
  if (!wv) return { ok: false, reason: '没有可见 webview' };
  try {
    await wv.executeJavaScript(`console[${JSON.stringify(level)}](${JSON.stringify(text)}); true`);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

/** 轮询日志文件直到出现某子串 */
async function waitForLogLine(logPath, needle, timeoutMs = 4000) {
  const fs = require('fs');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (fs.readFileSync(logPath, 'utf8').includes(needle)) return true;
    } catch (_) { /* 文件尚未创建：继续等 */ }
    if (Date.now() > deadline) return false;
    await sleep(150);
  }
}

function countLogLines(logPath, needle) {
  const fs = require('fs');
  try {
    return fs.readFileSync(logPath, 'utf8').split('\n').filter((l) => l.includes(needle)).length;
  } catch (_) {
    return 0;
  }
}

async function main() {
  process.on('unhandledRejection', (e) => { console.error('unhandledRejection:', e); process.exitCode = 1; });

  let app = null;
  let scratchTabId = null;
  let originalWidth = null;
  let restoreTabId = null;
  const failures = [];
  const check = (desc, cond, extra) => {
    if (cond) { console.log('  ✓ ' + desc); } else {
      failures.push(desc);
      console.log('  ✗ ' + desc + (extra ? '  → ' + extra : ''));
    }
  };

  try {
    let pw = null;
    try { pw = require('playwright')._electron; } catch (_) { pw = null; }
    if (!pw) {
      console.error('E-PW 全局 playwright / _electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
      process.exit(11);
    }

    const { _electron: electronLauncher } = require('playwright');
    if (!require('fs').existsSync(ELECTRON_EXECUTABLE)) {
      throw new Error('Electron 可执行不存在: ' + ELECTRON_EXECUTABLE);
    }

    console.log('启动 dev 应用...');
    app = await electronLauncher.launch({
      args: ['.'],
      cwd: REPO_ROOT,
      executablePath: ELECTRON_EXECUTABLE,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    let win = null;
    for (let i = 0; i < 100; i++) {
      win = app.windows().find((w) => w.url().includes('index.html'));
      if (win) break;
      await sleep(200);
    }
    if (!win) throw new Error('未找到 index.html 主窗口');
    await win.waitForLoadState('domcontentloaded');

    // 等 webview 就绪
    let list = null;
    for (let i = 0; i < 60; i++) {
      list = await win.evaluate(READ_WEBVIEWS).catch(() => null);
      if (list && list.length > 0) break;
      await sleep(250);
    }
    check('webview 元素已就绪', !!(list && list.length > 0), JSON.stringify(list));
    if (!list || list.length === 0) throw new Error('webview 未就绪');

    const spy = await win.evaluate(INSTALL_WARN_SPY);
    check('console.warn 记录器安装成功', spy.ok);

    const session = await win.evaluate(READ_SESSION);
    console.log('  会话:', JSON.stringify(session));
    check('renderer 顶层函数可达（state/createTab/closeTab）',
      !!session.activeTabId && session.hasCreateTab && session.hasCloseTab);
    check('resumeWebviewHitTest 可达（白盒幂等用例需要）', session.hasResume);

    // ---- 准备：保证存在「非活动 webview」用于验证不变量 ----
    if (session.webviewCount < 2) {
      const created = await win.evaluate(CREATE_SCRATCH_TAB);
      check('补建 about:blank 临时标签（仅为获得非活动 webview）', created.ok, created.reason);
      if (created.ok) {
        scratchTabId = created.tabId;
        restoreTabId = session.activeTabId;
        await sleep(1200);
      }
    }

    // ---- 用例 0：基线不变量 ----
    console.log('\n用例 0: 基线（可见 webview 可命中，非活动不可命中）');
    list = await win.evaluate(READ_WEBVIEWS);
    let vis = visibleOf(list);
    let hid = hiddenOf(list);
    check('恰有一个 webview 可见', !!vis, JSON.stringify(list));
    check('可见 webview 的 pointer-events = auto', !!vis && vis.pe === 'auto', vis && vis.pe);
    check('可见 webview 未挂 inert', !!vis && vis.inert === false, vis && String(vis.inert));
    check('存在非活动 webview（用于断言不变量）', hid.length > 0, `隐藏数=${hid.length}`);
    check('非活动 webview 一律 pointer-events = none', hid.every((w) => w.pe === 'none'), JSON.stringify(hid));
    check('非活动 webview 一律 inert', hid.every((w) => w.inert === true), JSON.stringify(hid));

    // ---- 用例 1：正常拖拽收尾（suspend → mouseup → 立即恢复，且不打残留日志）----
    console.log('\n用例 1: 标签拖拽正常收尾');
    await win.evaluate(CLEAR_WARNS);
    let r = await win.evaluate(DISPATCH_TAB_DRAG, { activate: true });
    check('派发 mousedown + 激活 mousemove', r.ok, r.reason);
    await sleep(120);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check('拖拽激活后可见 webview 的命中被关闭（suspend 生效）', !!vis && vis.pe === 'none', vis && vis.pe);
    await win.evaluate(DISPATCH_MOUSE_UP);
    await sleep(300);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    hid = hiddenOf(list);
    check('收尾后可见 webview 恢复可命中', !!vis && vis.pe === 'auto', vis && vis.pe);
    check('收尾后非活动 webview 仍不可命中（不误开）', hid.every((w) => w.pe === 'none'), JSON.stringify(hid));
    check('正常收尾不产生残留日志（负命题）',
      residualWarns(await win.evaluate(READ_WARNS)).length === 0,
      JSON.stringify(residualWarns(await win.evaluate(READ_WARNS))));

    // ---- 用例 2：拖拽丢 mouseup + mousemove 兜底 ----
    console.log('\n用例 2: 标签拖拽丢 mouseup → mousemove 兜底恢复');
    await win.evaluate(CLEAR_WARNS);
    r = await win.evaluate(DISPATCH_TAB_DRAG, { activate: true });
    check('派发 mousedown + 激活 mousemove（不发 mouseup）', r.ok, r.reason);
    await sleep(120);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check('残留已复现：可见 webview 命中处于关闭', !!vis && vis.pe === 'none', vis && vis.pe);
    await win.evaluate(DISPATCH_MOUSE_MOVE, 0);
    await sleep(120);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check('mousemove(buttons=0) 后立即恢复可命中', !!vis && vis.pe === 'auto', vis && vis.pe);
    let warns = residualWarns(await win.evaluate(READ_WARNS));
    check('留下残留恢复日志', warns.length > 0, JSON.stringify(warns));
    check('日志归因到表拖拽路径（原始禁用=tab-cross-drag）',
      warns.some((w) => w.includes('tab-cross-drag')), JSON.stringify(warns));
    check('日志给出兜底来源 mousemove-no-button',
      warns.some((w) => w.includes('mousemove-no-button')), JSON.stringify(warns));
    // 复位拖拽状态机（残留期间 state.crossDrag.active 仍为 true，会让下一条用例拿不到 suspend）
    await win.evaluate(DISPATCH_MOUSE_UP);
    await sleep(250);

    // ---- 用例 3：拖拽丢 mouseup + 看门狗（零事件，纯时间推进）----
    console.log('\n用例 3: 标签拖拽丢 mouseup → 看门狗恢复');
    await win.evaluate(CLEAR_WARNS);
    r = await win.evaluate(DISPATCH_TAB_DRAG, { activate: true });
    check('派发 mousedown + 激活 mousemove（不发 mouseup）', r.ok, r.reason);
    await sleep(120);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check('残留已复现：可见 webview 命中处于关闭', !!vis && vis.pe === 'none', vis && vis.pe);
    await sleep(WATCHDOG_WAIT_MS);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check(`无任何后续事件时看门狗在 ${WATCHDOG_WAIT_MS}ms 内恢复可命中`, !!vis && vis.pe === 'auto', vis && vis.pe);
    warns = residualWarns(await win.evaluate(READ_WARNS));
    check('看门狗路径留下日志（兜底=watchdog）',
      warns.some((w) => w.includes('watchdog')), JSON.stringify(warns));
    await win.evaluate(DISPATCH_MOUSE_UP);
    await sleep(250);

    // ---- 用例 4/5：AI 面板改宽（正常收尾 / 丢 mouseup）----
    console.log('\n用例 4/5: AI 面板改宽');
    originalWidth = await win.evaluate(READ_AI_PANEL_WIDTH);
    console.log('  原 aiPanelWidth:', JSON.stringify(originalWidth));
    const panelState = await win.evaluate(ENSURE_PANEL_MEASURABLE);
    check('面板已可量宽（避免收尾把 0 写进设置）', panelState.ok && panelState.offsetWidth > 0, JSON.stringify(panelState));

    await win.evaluate(CLEAR_WARNS);
    r = await win.evaluate(DISPATCH_RESIZE_DOWN);
    check('派发改宽手柄 mousedown', r.ok, r.reason);
    await sleep(120);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check('改宽期间可见 webview 命中被关闭（suspend 生效）', !!vis && vis.pe === 'none', vis && vis.pe);
    await win.evaluate(DISPATCH_MOUSE_UP);
    await sleep(300);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    hid = hiddenOf(list);
    check('改宽收尾后可见 webview 恢复可命中', !!vis && vis.pe === 'auto', vis && vis.pe);
    check('改宽收尾后非活动 webview 仍不可命中（旧实现会误设成 auto）',
      hid.every((w) => w.pe === 'none'), JSON.stringify(hid));
    check('改宽正常收尾不产生残留日志（负命题）',
      residualWarns(await win.evaluate(READ_WARNS)).length === 0,
      JSON.stringify(residualWarns(await win.evaluate(READ_WARNS))));

    console.log('\n用例 5: 改宽丢 mouseup → mousemove 兜底恢复');
    await win.evaluate(CLEAR_WARNS);
    r = await win.evaluate(DISPATCH_RESIZE_DOWN);
    check('派发改宽手柄 mousedown（不发 mouseup）', r.ok, r.reason);
    await sleep(120);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check('残留已复现：可见 webview 命中处于关闭', !!vis && vis.pe === 'none', vis && vis.pe);
    await win.evaluate(DISPATCH_MOUSE_MOVE, 0);
    await sleep(120);
    list = await win.evaluate(READ_WEBVIEWS);
    vis = visibleOf(list);
    check('兜底后立即恢复可命中', !!vis && vis.pe === 'auto', vis && vis.pe);
    warns = residualWarns(await win.evaluate(READ_WARNS));
    check('日志归因到改宽路径（原始禁用=ai-panel-resize）',
      warns.some((w) => w.includes('ai-panel-resize')), JSON.stringify(warns));

    // ---- 用例 6：幂等负命题（未 suspend 时 resume 不得改动任何状态）----
    console.log('\n用例 6: 未 suspend 时调用 resume 为 no-op');
    const beforeIdem = await win.evaluate(READ_WEBVIEWS);
    const resumed = await win.evaluate(CALL_RESUME, 'drag-end');
    check('resumeWebviewHitTest 可调用', resumed.ok, resumed.reason);
    const afterIdem = await win.evaluate(READ_WEBVIEWS);
    check('幂等：可见 webview 仍 auto', visibleOf(afterIdem).pe === 'auto', visibleOf(afterIdem).pe);
    check('幂等：非活动 webview 仍 none', hiddenOf(afterIdem).every((w) => w.pe === 'none'), JSON.stringify(hiddenOf(afterIdem)));
    check('幂等：状态快照逐项不变', JSON.stringify(beforeIdem) === JSON.stringify(afterIdem),
      `${JSON.stringify(beforeIdem)} → ${JSON.stringify(afterIdem)}`);

    // ---- 用例 7：诊断日志落盘（观察期取证通道）----
    console.log('\n用例 7: 诊断日志落盘');
    const logInfo = await app.evaluate(GET_LOG_PATH);
    check('主进程落盘模块已接线且启用（dev 环境）',
      logInfo.ok && logInfo.enabled && !!logInfo.path, JSON.stringify(logInfo));
    const logPath = logInfo.path || '';
    check('日志文件已创建', !!logPath && require('fs').existsSync(logPath), logPath);

    // 7a 主窗口渲染进程的残留恢复日志必须落盘 —— 完整链路：
    //    renderer console.warn → 主进程 console-message → diagnostics-log
    await win.evaluate(CLEAR_WARNS);
    const residualBefore = countLogLines(logPath, '可命中性残留已恢复');
    r = await win.evaluate(DISPATCH_TAB_DRAG, { activate: true });
    check('派发 mousedown + 激活 mousemove（制造残留）', r.ok, r.reason);
    await sleep(150);
    await win.evaluate(DISPATCH_MOUSE_MOVE, 0); // 触发兜底恢复
    check('残留恢复日志已落盘', await waitForLogLine(logPath, '可命中性残留已恢复'), logPath);
    const residualAfter = countLogLines(logPath, '可命中性残留已恢复');
    check('落盘的是本次新增的一条', residualAfter > residualBefore, `${residualBefore} → ${residualAfter}`);
    check('落盘行带兜底来源标签', countLogLines(logPath, 'mousemove-no-button') > 0);
    await win.evaluate(DISPATCH_MOUSE_UP);
    await sleep(250);

    // 7b guest 的控制台也要落盘。Electron 43 实测必须挂在 **guest 自身** webContents 上
    //（挂在主窗口上收不到）——仓库旧结论「新版收不到 guest 日志」正是后者造成的误判，
    // 本用例是该说法的真实对照。
    const guestTag = 'uat-guest-probe-' + Date.now();
    const guestRes = await win.evaluate(GUEST_CONSOLE, { text: `[Realm 诊断] ${guestTag}`, level: 'log' });
    check('guest 内 executeJavaScript 打日志成功', guestRes.ok, guestRes.reason);
    check('guest 的 [Realm 诊断] 日志已落盘', await waitForLogLine(logPath, guestTag), logPath);

    // 7c 负命题：guest 的无前缀普通日志不得落盘（否则文件会被页面日志刷爆）
    const noisyTag = 'uat-noise-probe-' + Date.now();
    await win.evaluate(GUEST_CONSOLE, { text: noisyTag, level: 'log' });
    await sleep(700);
    check('guest 无前缀普通日志被过滤（不落盘）', countLogLines(logPath, noisyTag) === 0);

    // 7d 噪声规则的真实对照（单变量：只把正文改成命中噪声模式，其余与 7b 全同）：
    // 7b 落盘 / 7d 不落盘 ⇒ 差异只可能来自噪声规则本身，不是前缀或级别。
    // 用 error 级别一并覆盖「error 直通」与噪声规则的优先级关系。
    const cspTag = 'uat-noise-csp-' + Date.now();
    const cspRes = await win.evaluate(GUEST_CONSOLE, {
      text: `[Realm 诊断] ${cspTag} Applying inline style violates the following Content Security Policy directive 'style-src 'self''`,
      level: 'error',
    });
    check('噪声对照探针派发成功', cspRes.ok, cspRes.reason);
    await sleep(700);
    check('噪声规则生效：带前缀且 level=error 的命中噪声模式日志仍不落盘',
      countLogLines(logPath, cspTag) === 0);

    // ---- 收尾：还原会话与设置 ----
    console.log('\n收尾');
    if (originalWidth !== null) {
      const ok = await win.evaluate(WRITE_AI_PANEL_WIDTH, originalWidth);
      check('aiPanelWidth 已按原值写回', ok, String(originalWidth));
    }
    if (scratchTabId) {
      await win.evaluate(CLEANUP_SCRATCH_TAB, { tabId: scratchTabId, restoreTabId });
      await sleep(700);
      const left = await win.evaluate(READ_SESSION);
      check('临时标签已关闭', left.webviewCount >= 1, JSON.stringify(left));
    }
    await win.evaluate(UNINSTALL_WARN_SPY);
  } catch (err) {
    failures.push('驱动异常');
    console.error('\n驱动异常:', err && err.message);
  } finally {
    if (app) {
      try { await Promise.race([app.close(), sleep(6000)]); } catch (e) { console.error('关闭失败:', e.message); }
    }
  }

  console.log('\n' + '─'.repeat(60));
  if (failures.length === 0) {
    console.log('全部通过');
    process.exit(0);
  }
  console.log('失败 ' + failures.length + ' 项:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}

main();

/**
 * UAT 驱动：强制刷新快捷键（hardReload / Cmd+Shift+R）端到端验证
 *
 * 运行方式（playwright **只在全局**，仓内 `require.resolve('playwright')` 直接
 * `Cannot find module`，故必须带 NODE_PATH）：
 *
 *     NODE_PATH="$(npm root -g)" node tests/uat-hard-reload-shortcut.js
 *
 * 缺全局 playwright 时以 `E-PW` / exit 11 硬退出（与其他 uat 驱动同码），
 * 而不是抛一个裸的 MODULE_NOT_FOUND —— 那是**环境前置缺失**，不是断言失败。
 *
 * 验证的是**完整链路**：
 *   合成按键 → 主进程 before-input-event → findMatchingAction 命中 hardReload
 *   → preventDefault + `shortcut:triggered` 派发 → renderer 的 case 'hardReload'
 *   → 调用 webview.reloadIgnoringCache()
 *
 * 断言方式：在 renderer 里把 webview 原型上的 reload / reloadIgnoringCache 换成
 * 记录器（**不调用原实现**，避免真实刷新打断后续用例），再合成按键读回记录。
 * 因此本驱动证明的是「按键最终选中并调用了哪个方法」；方法本身的真实刷新语义
 * 属于 Electron 原生行为，且已由 Vim 模式 R 键（renderer.js 同一处调用）在生产使用。
 *
 * 反向对照（关键）：Cmd+R 必须只命中 reload，Cmd+Shift+R 必须只命中 reloadIgnoringCache。
 * 缺了反向对照，本用例会在「两个键都调 reloadIgnoringCache」时假绿。
 * 已做单点变异验证：把 renderer 里换回 reload() ⇒ 用例 2 两条转红；
 * 把 SHORTCUT_GROUPS 的 hardReload 去掉 ⇒ 用例 3 两条转红。
 *
 * Electron 可执行文件用**裸说明符** `require('electron')` 解析：主工作树与
 * `.worktrees/<name>` 都能命中（worktree 无自己的 node_modules 时靠 Node 向上查找）。
 * 不要改成 `path.join(REPO_ROOT, 'node_modules/electron')` —— 绝对路径不向上查找，
 * 会让本驱动在 worktree 内直接 MODULE_NOT_FOUND。详见
 * docs/dev/branching-spec.md 第三节「在 worktree 内跑自动化测试」。
 *
 * 退出纪律：electronApp.close() + process.exit；**严禁** pkill / pgrep 模式匹配杀进程。
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ELECTRON_EXECUTABLE = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 主窗口里安装记录器；返回 { ok, reason? } */
const INSTALL_SPY = () => {
  const wv = document.querySelector('#browserView webview');
  if (!wv) return { ok: false, reason: '主窗口内没有 webview 元素' };
  const proto = Object.getPrototypeOf(wv);
  if (typeof proto.reloadIgnoringCache !== 'function') {
    return { ok: false, reason: 'webview 原型上没有 reloadIgnoringCache' };
  }
  window.__hardReloadProbe = { calls: [] };
  const record = (name) => function () { window.__hardReloadProbe.calls.push(name); };
  proto.reload = record('reload');
  proto.reloadIgnoringCache = record('reloadIgnoringCache');
  return { ok: true };
};

const READ_SPY = () => (window.__hardReloadProbe ? window.__hardReloadProbe.calls.slice() : null);

const RESET_SPY = () => { if (window.__hardReloadProbe) window.__hardReloadProbe.calls.length = 0; };

/**
 * 用 Electron 的 sendInputEvent 走原生输入管线合成按键。
 * 必须走 sendInputEvent 而不是 DOM/CDP 键盘事件 —— 只有前者会触发 before-input-event。
 */
function dispatchKey(app, keyCode, modifiers) {
  return app.evaluate(({ BrowserWindow }, payload) => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    const target = wins.find((w) => w.webContents.getURL().includes('index.html')) || wins[0];
    if (!target) return { ok: false, reason: '没有可用窗口' };
    target.focus();
    target.webContents.sendInputEvent({
      type: 'keyDown', keyCode: payload.keyCode, modifiers: payload.modifiers,
    });
    target.webContents.sendInputEvent({ type: 'keyUp', keyCode: payload.keyCode });
    return { ok: true, focused: target.isFocused() };
  }, { keyCode, modifiers });
}

async function main() {
  process.on('unhandledRejection', (e) => { console.error('unhandledRejection:', e); process.exitCode = 1; });

  let app = null;
  const failures = [];
  const check = (desc, cond, extra) => {
    if (cond) { console.log('  ✓ ' + desc); } else {
      failures.push(desc);
      console.log('  ✗ ' + desc + (extra ? '  → ' + extra : ''));
    }
  };

  try {
    // 前置自检：全局 playwright 不可得 ⇒ 以 E-PW / exit 11 硬退出（与其他 uat 驱动同码）
    let pw = null;
    try { pw = require('playwright')._electron; } catch (_) { pw = null; }
    if (!pw) {
      console.error('E-PW 全局 playwright / _electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
      process.exit(11);
    }

    const { _electron: electronLauncher } = require('playwright');
    const exeExists = require('fs').existsSync(ELECTRON_EXECUTABLE);
    console.log('Electron 可执行:', ELECTRON_EXECUTABLE);
    console.log('可执行存在:', exeExists);
    if (!exeExists) throw new Error('Electron 可执行不存在，驱动无法启动');

    console.log('\n启动 dev 应用...');
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

    // 等首个 tab / webview 就绪
    let spy = { ok: false, reason: '未安装' };
    for (let i = 0; i < 60; i++) {
      spy = await win.evaluate(INSTALL_SPY);
      if (spy.ok) break;
      await sleep(250);
    }
    console.log('\n探针安装');
    check('webview 元素就绪且可挂记录器', spy.ok, spy.reason);
    if (!spy.ok) throw new Error('探针安装失败：' + spy.reason);

    // ---- 用例 1：Cmd+R → 只应命中 reload ----
    console.log('\n用例 1: Cmd+R（普通刷新）');
    await win.evaluate(RESET_SPY);
    const r = await dispatchKey(app, 'R', ['meta']);
    check('sendInputEvent 派发成功', r.ok, r.reason);
    await sleep(500);
    const callsR = await win.evaluate(READ_SPY);
    console.log('    记录:', JSON.stringify(callsR));
    check('Cmd+R 命中 reload', callsR && callsR.includes('reload'), JSON.stringify(callsR));
    check('Cmd+R 不误触 reloadIgnoringCache', callsR && !callsR.includes('reloadIgnoringCache'), JSON.stringify(callsR));

    // ---- 用例 2：Cmd+Shift+R → 只应命中 reloadIgnoringCache ----
    console.log('\n用例 2: Cmd+Shift+R（强制刷新）');
    await win.evaluate(RESET_SPY);
    const hr = await dispatchKey(app, 'R', ['meta', 'shift']);
    check('sendInputEvent 派发成功', hr.ok, hr.reason);
    await sleep(500);
    const callsHR = await win.evaluate(READ_SPY);
    console.log('    记录:', JSON.stringify(callsHR));
    check('Cmd+Shift+R 命中 reloadIgnoringCache', callsHR && callsHR.includes('reloadIgnoringCache'), JSON.stringify(callsHR));
    check('Cmd+Shift+R 不误触 reload', callsHR && !callsHR.includes('reload'), JSON.stringify(callsHR));

    // ---- 用例 3：设置页真实渲染出该项（四处链路的第 2/3 处） ----
    // 只做静态源码扫描是不够的：SHORTCUT_GROUPS 漏加 action id 时源码里仍有
    // SHORTCUT_NAMES 条目，但设置页不会渲染该行。这里实际打开设置页读 DOM。
    console.log('\n用例 3: 设置页渲染「强制刷新页面」');
    const opened = await win.evaluate(() => {
      if (typeof openSettingsTab !== 'function') return false;
      openSettingsTab();
      return true;
    });
    check('openSettingsTab 可调用（renderer 顶层函数已挂 window）', opened);

    // 设置页默认停在「通用」分区，快捷键列表要切到 shortcuts 分区才渲染
    // （switchSettingsPage('shortcuts') → refreshShortcutsList() 异步拉 /api/shortcuts/list）。
    let settingsText = null;
    for (let i = 0; i < 80; i++) {
      settingsText = await win.evaluate(() => {
        const wv = document.querySelector('#browserView webview[src*="settings"]');
        if (!wv) return null;
        // 幂等：已切过再切一次也无副作用
        return wv.executeJavaScript(
          'switchSettingsPage("shortcuts"); document.body.innerText'
        );
      }).catch(() => null);
      if (settingsText && settingsText.includes('强制刷新页面')) break;
      await sleep(300);
    }
    console.log('    设置页文本长度:', settingsText ? settingsText.length : 0);
    if (settingsText && !settingsText.includes('强制刷新页面')) {
      const idx = settingsText.indexOf('刷新页面');
      console.log('    含「刷新页面」的上下文:', JSON.stringify(settingsText.slice(Math.max(0, idx - 80), idx + 120)));
    }
    check('设置页渲染出「强制刷新页面」', !!settingsText && settingsText.includes('强制刷新页面'));
    check('设置页显示 hardReload 的默认键位', !!settingsText && settingsText.includes('CmdOrCtrl+Shift+R'));

    await win.evaluate(() => { delete window.__hardReloadProbe; });
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

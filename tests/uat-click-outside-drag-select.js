/**
 * UAT 驱动：「点击外部关闭」判据必须看**按下点**，不能被拖选文字误触发
 *
 * 背景：容器内可拖选文本（input / 可选中文本）上按下鼠标、把光标移到容器外再松开时，
 * `click` 事件的目标是 mousedown 与 mouseup 的**最近公共祖先** ——
 * 对 `<dialog>` 而言正好是 dialog 元素自身（backdrop 关闭判据 `e.target === dialog`
 * 就是这样被命中的），对普通面板则是面板自身或更外层。于是「选中文字」被误判成
 * 「点了容器外部」，弹窗 / 面板被关掉。
 *
 * 修复后所有判据都要求「按下点也在容器内容之外」（renderer.js 的
 * `isPointerDownInContent`，落点由 pointerdown 捕获阶段记录）。
 *
 * 运行方式（playwright **只在全局**，必须带 NODE_PATH）：
 *
 *     NODE_PATH="$(npm root -g)" node tests/uat-click-outside-drag-select.js
 *
 * 缺全局 playwright 时以 `E-PW` / exit 11 硬退出。Electron 可执行用裸说明符
 * `require('electron')`（worktree 内靠 Node 向上查找命中主仓库）。
 *
 * **机制证据 + 行为判据双层**：本驱动在 document 捕获阶段装事件探针，把
 * 「pointerdown 落在输入框、mouseup 落在容器外、**click 的目标因此变成容器本身**」
 * 这条因果链逐条断言出来（这是 bug 的触发条件，修复前后都成立），再断言行为结果
 * 「面板未被关闭」（这一条才有判别力）。只施行为判据无法说明驱动复现的确实是这个机制。
 *
 * **终点必须落在 host 区域**（本次实测踩点）：CDP 的 `Input.dispatchMouseEvent` 没有
 * 隐式捕获，落在 webview（guest）上方的合成事件会被路由给 guest，host 收不到 click ⇒
 * 「面板没被关」是假绿（首版驱动 endpoints 选在网页区，正向对照与选区断言双双失败即此因）。
 * 因此终点选在 tab 栏 / AI 面板等 host chrome 位置：视觉上仍是 `<dialog>` 的 backdrop
 * （top layer 覆盖全屏），事件却能到达 host。
 *
 * 覆盖边界（必须说明）：本次改动 6 处判据，本驱动端到端断言其中 2 处
 * （`#bookmarkEditPanel`、`#aiConvDropdown`），另 4 处（`#cookieEditModal`、
 * `#containerModal`、`#contextPickerPanel`、`#slashPickerPanel`）是同一 helper 的
 * 同形态机械替换，未逐处建端到端用例；风险因此集中在「判据是否被正确接上」，
 * 已由 grep 该 helper 的 6 个调用点确认。
 *
 * 会话副作用（自清理）：会打开收藏编辑面板（结束前 hide）、会进入/退出对话重命名的
 * 内联编辑态（结束前 Escape 取消，不改标题）。退出纪律：electronApp.close() +
 * process.exit；**严禁** pkill / pgrep 模式匹配杀进程。
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ELECTRON_EXECUTABLE = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ==================== renderer 侧探针（必须自包含） ====================

/** 打开 AI 面板（幂等） */
const ENSURE_AI_PANEL = () => {
  const panel = document.getElementById('aiPanel');
  if (!panel) return { ok: false, reason: '找不到 #aiPanel' };
  if (panel.classList.contains('hidden')) {
    if (typeof toggleAIPanel !== 'function') return { ok: false, reason: 'toggleAIPanel 不可调用' };
    toggleAIPanel();
  }
  return { ok: !panel.classList.contains('hidden'), reason: '面板仍隐藏' };
};

/** 打开收藏编辑面板 */
const OPEN_BOOKMARK_PANEL = () => {
  if (typeof showBookmarkEditPanel !== 'function') return { ok: false, reason: 'showBookmarkEditPanel 不可调用' };
  showBookmarkEditPanel('UAT-DRAG-TITLE', 'https://example.com/uat-drag-select', false);
  const dlg = document.getElementById('bookmarkEditPanel');
  return { ok: !!dlg && dlg.open === true, reason: dlg ? 'open=' + dlg.open : 'no dialog' };
};

/** 收藏编辑面板状态 */
const BOOKMARK_STATE = () => {
  const dlg = document.getElementById('bookmarkEditPanel');
  const input = document.getElementById('bookmarkTitleInput');
  return {
    open: !!dlg && dlg.open === true,
    inputSelection: input ? (input.selectionEnd || 0) - (input.selectionStart || 0) : 0,
  };
};

/** 对话下拉 + 内联编辑态快照 */
const CONV_STATE = () => {
  const dropdown = document.getElementById('aiConvDropdown');
  const input = document.querySelector('#aiConvList input[type="text"]');
  return {
    dropdownDisplay: dropdown ? getComputedStyle(dropdown).display : null,
    hasInput: !!input,
    inputFocused: !!input && document.activeElement === input,
    itemCount: document.querySelectorAll('#aiConvList .ai-conv-item').length,
  };
};

/** 视口尺寸 */
const VIEWPORT = () => ({ w: window.innerWidth, h: window.innerHeight });

/** 安装事件目标探针（捕获阶段，幂等）：记录 pointerdown/mousedown/mouseup/click 的目标 */
const INSTALL_TARGET_PROBE = () => {
  if (window.__uatTargetProbe) {
    window.__uatTargetProbe.events.length = 0;
    return { ok: true };
  }
  const probe = { events: [] };
  const describe = (el) => {
    if (!el) return 'null';
    if (el === document) return '#document';
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    const tag = el.tagName ? el.tagName.toLowerCase() : '?';
    const id = el.id ? '#' + el.id : '';
    let cls = '';
    if (typeof el.className === 'string' && el.className.trim()) {
      cls = '.' + el.className.trim().split(/\s+/).join('.');
    }
    return tag + id + cls;
  };
  ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((type) => {
    document.addEventListener(type, (e) => {
      probe.events.push(type + ' -> ' + describe(e.target));
    }, true);
  });
  window.__uatTargetProbe = probe;
  return { ok: true };
};

const READ_TARGET_PROBE = () => (window.__uatTargetProbe ? window.__uatTargetProbe.events.slice() : []);
const CLEAR_TARGET_PROBE = () => { if (window.__uatTargetProbe) window.__uatTargetProbe.events.length = 0; };

// ==================== 驱动主体 ====================

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
    let pw = null;
    try { pw = require('playwright')._electron; } catch (_) { pw = null; }
    if (!pw) {
      console.error('E-PW 全局 playwright / _electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
      process.exit(11);
    }

    const { _electron: electronLauncher } = require('playwright');
    if (!require('fs').existsSync(ELECTRON_EXECUTABLE)) {
      console.error('E-EXE Electron 可执行不存在: ' + ELECTRON_EXECUTABLE);
      process.exit(12);
    }

    console.log('Electron 可执行:', ELECTRON_EXECUTABLE);
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
    if (!win) {
      console.error('E-APP 未找到 index.html 主窗口（是否有其它 dev 实例占用了 realm-dev？）');
      process.exit(13);
    }
    await win.waitForLoadState('domcontentloaded');
    await win.evaluate(INSTALL_TARGET_PROBE);

    const vp = await win.evaluate(VIEWPORT);
    console.log('视口:', JSON.stringify(vp));

    const probe = () => win.evaluate(READ_TARGET_PROBE);
    const clearProbe = () => win.evaluate(CLEAR_TARGET_PROBE);

    /** 在 input 内按下，拖到终点松开 */
    async function dragFromInput(inputSel, endX, endY) {
      const box = await (await win.$(inputSel)).boundingBox();
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      await win.mouse.move(startX, startY);
      await win.mouse.down();
      await win.mouse.move(endX, endY, { steps: 12 });
      await win.mouse.up();
      await sleep(500);
    }

    /** 在指定点按下并松开 */
    async function clickAt(x, y) {
      await win.mouse.move(x, y);
      await win.mouse.down();
      await win.mouse.up();
      await sleep(400);
    }

    // ==================== 用例 1：收藏编辑面板 —— 拖选到 backdrop 不应关闭 ====================
    console.log('\n用例 1: 收藏编辑面板拖选文字后松手到 backdrop');
    const opened = await win.evaluate(OPEN_BOOKMARK_PANEL);
    check('收藏编辑面板已打开', opened.ok, opened.reason);

    const dlgBox = await (await win.$('#bookmarkEditPanel')).boundingBox();
    console.log('    弹窗盒:', JSON.stringify(dlgBox));
    // 终点：弹窗盒外、且必须是 host chrome（tab 栏高度内），否则 CDP 事件会被路由给 webview guest
    const backdropX = Math.max(20, dlgBox.x - 300);
    const backdropY = Math.max(8, dlgBox.y - 60);
    console.log('    backdrop 落点:', backdropX, backdropY);

    await clearProbe();
    await dragFromInput('#bookmarkTitleInput', backdropX, backdropY);
    const ev1 = await probe();
    console.log('    事件序列:');
    ev1.forEach((x) => console.log('      ' + x));
    check('按下点在输入框上（pointerdown → #bookmarkTitleInput）',
      ev1.some((x) => x.startsWith('pointerdown -> input#bookmarkTitleInput')), JSON.stringify(ev1));
    check('松开点在 dialog 自身（mouseup → dialog#bookmarkEditPanel，即 backdrop）',
      ev1.some((x) => x.startsWith('mouseup -> dialog#bookmarkEditPanel')), JSON.stringify(ev1));
    check('click 的目标因此变成 dialog 自身（机制证据）',
      ev1.some((x) => x.startsWith('click -> dialog#bookmarkEditPanel')), JSON.stringify(ev1));

    const afterDrag = await win.evaluate(BOOKMARK_STATE);
    console.log('    拖选后:', JSON.stringify(afterDrag));
    check('拖选到 backdrop 松开：面板未被关闭', afterDrag.open === true, 'open=' + afterDrag.open);

    // 反向对照：真正点击 backdrop 必须关闭
    await win.evaluate(() => hideBookmarkEditPanel());
    await sleep(300);
    const reopened = await win.evaluate(OPEN_BOOKMARK_PANEL);
    check('正向对照前置：面板已重新打开', reopened.ok, reopened.reason);
    await clickAt(backdropX, backdropY);
    const afterBackdrop = await win.evaluate(BOOKMARK_STATE);
    check('正向对照：点击 backdrop（按下+松开都在外部）仍会关闭', afterBackdrop.open === false,
      'open=' + afterBackdrop.open);
    await win.evaluate(() => hideBookmarkEditPanel());
    await sleep(300);

    // ==================== 用例 2：对话下拉 —— 拖选到面板外不应关闭 ====================
    console.log('\n用例 2: 对话重命名输入框拖选文字后松手到下拉面板外');
    const panel = await win.evaluate(ENSURE_AI_PANEL);
    check('AI 面板已展开', panel.ok, panel.reason);
    await win.click('#aiHistoryBtn');

    let conv = null;
    for (let i = 0; i < 60; i++) {
      conv = await win.evaluate(CONV_STATE);
      if (conv.dropdownDisplay === 'flex' && conv.itemCount > 0) break;
      await sleep(200);
    }
    check('对话下拉为 flex 且有对话项', !!conv && conv.dropdownDisplay === 'flex' && conv.itemCount > 0,
      JSON.stringify(conv));

    const firstItem = await win.$('#aiConvList .ai-conv-item');
    await firstItem.click({ button: 'right' });
    await win.waitForSelector('#aiConvContextMenuActive .context-menu-item', { timeout: 4000 });
    const menuItems = await win.$$('#aiConvContextMenuActive .context-menu-item');
    await menuItems[0].click();
    await win.waitForSelector('#aiConvList input[type="text"]', { timeout: 4000 });

    const dropBox = await (await win.$('#aiConvDropdown')).boundingBox();
    console.log('    下拉面板盒:', JSON.stringify(dropBox));
    // 终点：下拉面板下方、仍在 AI 面板（host chrome）内
    const outsideX = dropBox.x + dropBox.width / 2;
    const outsideY = Math.min(vp.h - 40, dropBox.y + dropBox.height + 40);
    console.log('    面板外落点:', outsideX, outsideY);

    await clearProbe();
    await dragFromInput('#aiConvList input[type="text"]', outsideX, outsideY);
    const ev2 = await probe();
    console.log('    事件序列:');
    ev2.forEach((x) => console.log('      ' + x));
    check('按下点在内联输入框上（pointerdown → input）',
      ev2.some((x) => x === 'pointerdown -> input'), JSON.stringify(ev2));
    const clickTarget2 = ev2.find((x) => x.startsWith('click -> '));
    check('click 的目标在下拉面板之外（机制证据）',
      !!clickTarget2 &&
        !clickTarget2.includes('aiConvDropdown') &&
        !clickTarget2.includes('aiConvList') &&
        clickTarget2 !== 'click -> input',
      JSON.stringify(clickTarget2));

    const afterConvDrag = await win.evaluate(CONV_STATE);
    console.log('    拖选后:', JSON.stringify(afterConvDrag));
    check('拖选后：下拉面板仍打开', afterConvDrag.dropdownDisplay === 'flex', afterConvDrag.dropdownDisplay);
    check('拖选后：内联输入框仍在 DOM', afterConvDrag.hasInput);
    check('拖选后：焦点仍在输入框', afterConvDrag.inputFocused);

    // 反向对照：先把编辑态收掉，再点下拉面板外的位置必须关闭
    await win.keyboard.press('Escape');
    await sleep(300);
    await clickAt(outsideX, outsideY);
    const afterOutside = await win.evaluate(CONV_STATE);
    check('正向对照：点击下拉面板外的位置仍会关闭', afterOutside.dropdownDisplay === 'none',
      afterOutside.dropdownDisplay);
  } catch (err) {
    failures.push('驱动异常');
    console.error('\n驱动异常:', err && err.message);
  } finally {
    if (app) {
      try {
        const wins = app.windows().filter((w) => w.url().includes('index.html'));
        if (wins[0]) await wins[0].evaluate(() => hideBookmarkEditPanel());
      } catch (e) { console.error('清理异常:', e && e.message); }
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

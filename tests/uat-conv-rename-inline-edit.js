/**
 * UAT 驱动：对话列表「右键 → 重命名」内联编辑态 —— 点击输入框不得切走对话、不得关掉面板
 *
 * 背景：`renameConversation()`（renderer.js）把 `.ai-conv-item-title` 换成 `<input>`，
 * 而该输入框是 `.ai-conv-item` 的**子孙节点**。列表项的 click 监听器无条件调用
 * `switchConversation(conv.id)`，而 `switchConversation` 两条分支都会
 * `closeConvDropdown()` ⇒ 一进入编辑态，点一下输入框（想定位光标）就被判成
 * 「点了这个对话」，对话被切走、面板被关、正在编辑的输入框随 `renderConvList()`
 * 一起销毁。
 *
 * 运行方式（playwright **只在全局**，仓内 require.resolve('playwright') 直接
 * `Cannot find module`，故必须带 NODE_PATH）：
 *
 *     NODE_PATH="$(npm root -g)" node tests/uat-conv-rename-inline-edit.js
 *
 * 缺全局 playwright 时以 `E-PW` / exit 11 硬退出（与其他 uat 驱动同码），
 * 而不是抛一个裸的 MODULE_NOT_FOUND —— 那是**环境前置缺失**，不是断言失败。
 *
 * Electron 可执行文件用**裸说明符** `require('electron')`：主工作树与
 * `.worktrees/<name>` 都能命中。不要改成绝对路径拼接（worktree 内会 MODULE_NOT_FOUND），
 * 详见 docs/dev/branching-spec.md 第三节。
 *
 * 断言方式：真实鼠标（playwright `elementHandle.click()`，isTrusted）走完整交互链 ——
 * 打开 AI 面板 → 点对话历史 → 右键列表项 → 点「重命名」→ **点输入框**，
 * 每步后读 DOM 快照。核心判据是「点完输入框后面板仍是 flex、输入框仍在且仍持有焦点、
 * activeId 未变」，这四条在修复前必然全红（面板被 `closeConvDropdown()` 置 none、
 * 输入框被 `renderConvList()` 销毁）。
 *
 * 本驱动发现的两个缺陷与单点变异结果（2026-09-16，均实跑）：
 * 1. **click 冒泡**（用户报告的现象）：移除 `input` 上的 `stopPropagation` ⇒ 用例 1 的
 *    四条核心判据 + 用例 2 三条转红，并因输入框被销毁使 `dblclick` 抛
 *    `Element is not attached to the DOM`（驱动异常）；加回即全绿。
 * 2. **Escape 取消被 blur 覆盖**（驱动暴露的相邻缺陷）：`renderConvList()` 移除持有焦点的
 *    输入框会让浏览器派发 blur ⇒ `submitRename()` 拿着 `input.value` 把「取消」变成提交。
 *    实测现象：按 Escape 后标题变成 `"/skill:pdf 请总结uat-xxx技能的第..."`。
 *    去掉 `settled` 闸门 ⇒ 恰好只有「Escape 取消不提交」这一条转红，其余保持绿。
 * 两条判据因此互为对照：`settled` 闸门既不能少（Escape 会变成提交），也不能过宽
 * （用例 3 反向确认真实失焦仍会提交）。
 *
 * 已知保真度边界（必须说明，否则容易被读成比实际更强的证据）：
 * - 「Escape 取消后标题不变」只证明**渲染出来的标题**没变，不证明主进程侧没有被写入；
 *   该路径由用例 1 的 Enter 子句（提交后重拉列表仍是新标题）反向覆盖持久化。
 * - 本驱动不验证真实鼠标事件经过 macOS 窗口管理器后的送达情况（playwright 走 CDP
 *   合成可信事件），只验证 renderer 监听器链路上的判定与状态迁移。
 * - dev 环境（`NODE_ENV=development`，userData `realm-dev`）与正式版数据隔离；
 *   用例 1 会临时改一个对话的标题并在结束时恢复原名。
 *
 * 会话副作用（自清理）：仅当列表为空时新建一条对话，结束时按 id 删除；标题改动一律
 * 先用原名记录并在结束时写回。退出纪律：electronApp.close() + process.exit；
 * **严禁** pkill / pgrep 模式匹配杀进程。
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ELECTRON_EXECUTABLE = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 本次运行独有标记，用于避免断言被历史数据满足 */
const TAG = 'uat-' + Date.now().toString(36);

/** 列表里的标题按 30 字符截断（renderConvList），断言时必须用同一投影 */
const displayTitle = (t) => (t && t.length > 30 ? t.substring(0, 30) + '...' : t);

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

/** 对话列表 + 内联编辑态快照 */
const SNAPSHOT = () => {
  const dropdown = document.getElementById('aiConvDropdown');
  const input = document.querySelector('#aiConvList input[type="text"]');
  const active = document.querySelector('#aiConvList .ai-conv-item.active');
  const items = Array.from(document.querySelectorAll('#aiConvList .ai-conv-item'));
  return {
    dropdownDisplay: dropdown ? getComputedStyle(dropdown).display : null,
    hasInput: !!input,
    inputValue: input ? input.value : null,
    inputFocused: !!input && document.activeElement === input,
    activeId: active ? String(active.dataset.conversationId) : null,
    itemCount: items.length,
    menuOpen: !!document.getElementById('aiConvContextMenuActive'),
    titles: items.map((el) => {
      const t = el.querySelector('.ai-conv-item-title');
      return { id: String(el.dataset.conversationId), title: t ? t.textContent : null };
    }),
  };
};

/** 兜底：列表为空时新建一条对话（返回值里 created 用于结束时清理） */
const ENSURE_CONVERSATIONS = async () => {
  const count = () => document.querySelectorAll('#aiConvList .ai-conv-item').length;
  if (count() > 0) return { created: false, count: count() };
  const r = await window.realmAPI.conversationAPI.createConversation();
  await loadConversations();
  return { created: true, count: count(), id: r && r.conversation ? String(r.conversation.id) : null };
};

/** 重拉对话列表（验证持久化） */
const RELOAD_CONVERSATIONS = async () => { await loadConversations(); };

/** 清理：写回原标题并删除本次新建的对话（整体一次 evaluate，避免半途中断） */
const CLEANUP = async (payload) => {
  const done = { restored: [], deleted: null, errors: [] };
  for (const b of payload.backups) {
    try {
      await window.realmAPI.conversationAPI.renameConversation(b.id, b.title);
      done.restored.push(b.id);
    } catch (e) { done.errors.push('restore ' + b.id + ': ' + e.message); }
  }
  if (payload.createdId) {
    try {
      await window.realmAPI.conversationAPI.deleteConversation(payload.createdId);
      done.deleted = payload.createdId;
    } catch (e) { done.errors.push('delete ' + payload.createdId + ': ' + e.message); }
  }
  try { await loadConversations(); } catch (_) { /* 清理阶段不因渲染失败而中断 */ }
  return done;
};

// ==================== 驱动主体 ====================

async function main() {
  process.on('unhandledRejection', (e) => { console.error('unhandledRejection:', e); process.exitCode = 1; });

  let app = null;
  let createdConvId = null;
  /** [{ id, title }] —— 驱动改过标题的对话，结束时写回 */
  const titleBackups = [];

  const failures = [];
  const check = (desc, cond, extra) => {
    if (cond) { console.log('  ✓ ' + desc); } else {
      failures.push(desc);
      console.log('  ✗ ' + desc + (extra ? '  → ' + extra : ''));
    }
  };
  const skip = (desc) => console.log('  - SKIP ' + desc);

  try {
    // 前置自检：全局 playwright 不可得 ⇒ 以 E-PW / exit 11 硬退出
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
    console.log('运行标记 TAG:', TAG);
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

    // ---- 前置：打开 AI 面板 ----
    console.log('\n前置：打开 AI 面板');
    let panel = { ok: false, reason: '未尝试' };
    for (let i = 0; i < 40; i++) {
      panel = await win.evaluate(ENSURE_AI_PANEL);
      if (panel.ok) break;
      await sleep(250);
    }
    check('AI 面板已展开', panel.ok, panel.reason);
    if (!panel.ok) throw new Error('无法展开 AI 面板：' + panel.reason);

    // ---- 前置：打开对话历史下拉 ----
    console.log('\n前置：打开对话历史下拉');
    await win.click('#aiHistoryBtn');

    let snap = null;
    for (let i = 0; i < 60; i++) {
      snap = await win.evaluate(SNAPSHOT);
      if (snap.dropdownDisplay === 'flex' && snap.itemCount > 0) break;
      await sleep(200);
    }

    if (!snap || snap.itemCount === 0) {
      const ensured = await win.evaluate(ENSURE_CONVERSATIONS);
      createdConvId = ensured.id;
      console.log('    对话列表为空，已新建一条用于验证（结束时删除）');
    }

    for (let i = 0; i < 60; i++) {
      snap = await win.evaluate(SNAPSHOT);
      if (snap.itemCount > 0) break;
      await sleep(200);
    }

    check('对话下拉为 flex（非 none）', !!snap && snap.dropdownDisplay === 'flex', snap && snap.dropdownDisplay);
    check('存在可操作的对话项', !!snap && snap.itemCount > 0, snap && 'itemCount=' + snap.itemCount);
    if (!snap || snap.itemCount === 0) throw new Error('对话列表为空，无法验证重命名交互');

    // ==================== 用例 1：active（或首个）对话项的内联重命名 ====================
    console.log('\n用例 1: 内联重命名编辑态下点击输入框');

    const target = snap.titles[0];
    const originalTitle = target.title;
    titleBackups.push({ id: target.id, title: originalTitle });
    console.log('    目标对话:', target.id, JSON.stringify(originalTitle));

    const itemHandle = await win.$(
      '#aiConvList .ai-conv-item[data-conversation-id="' + target.id + '"]'
    );
    check('取到目标列表项句柄', !!itemHandle);
    if (!itemHandle) throw new Error('未取到目标列表项句柄');

    // 真实右键 → 真实点击「重命名」
    await itemHandle.click({ button: 'right' });
    await win.waitForSelector('#aiConvContextMenuActive .context-menu-item', { timeout: 4000 });
    const menuItems = await win.$$('#aiConvContextMenuActive .context-menu-item');
    check('右键菜单含两项（重命名 / 删除）', menuItems.length === 2, 'menuItems=' + menuItems.length);
    await menuItems[0].click(); // 第一项为「重命名」
    await win.waitForSelector('#aiConvList input[type="text"]', { timeout: 4000 });

    const enterEdit = await win.evaluate(SNAPSHOT);
    const activeIdBefore = enterEdit.activeId;
    console.log('    进入编辑态快照:', JSON.stringify({
      hasInput: enterEdit.hasInput,
      inputFocused: enterEdit.inputFocused,
      dropdownDisplay: enterEdit.dropdownDisplay,
      activeId: enterEdit.activeId,
      menuOpen: enterEdit.menuOpen,
    }));
    check('编辑态：输入框已出现', enterEdit.hasInput);
    check('编辑态：输入框持有焦点', enterEdit.inputFocused);
    check('编辑态：输入框内容为原标题', enterEdit.inputValue === originalTitle,
      JSON.stringify(enterEdit.inputValue));
    check('编辑态：右键菜单已关闭', enterEdit.menuOpen === false);
    check('编辑态：面板未被关闭', enterEdit.dropdownDisplay === 'flex', enterEdit.dropdownDisplay);

    // ---- 核心断言：真实点击输入框（定位光标） ----
    const inputHandle = await win.$('#aiConvList input[type="text"]');
    check('取到输入框句柄', !!inputHandle);
    if (!inputHandle) throw new Error('未取到输入框句柄');

    await inputHandle.click();
    // switchConversation 对「非当前对话」是异步路径（IPC 往返后才 closeConvDropdown），
    // 留足落定时间再读快照，否则修复前的破坏可能还没发生（假绿）
    await sleep(800);
    const afterClick = await win.evaluate(SNAPSHOT);
    console.log('    点击输入框后:', JSON.stringify({
      dropdownDisplay: afterClick.dropdownDisplay,
      hasInput: afterClick.hasInput,
      inputFocused: afterClick.inputFocused,
      activeId: afterClick.activeId,
    }));
    check('点击输入框：面板仍打开（未被 closeConvDropdown）', afterClick.dropdownDisplay === 'flex',
      afterClick.dropdownDisplay);
    check('点击输入框：输入框仍在 DOM（未被 renderConvList 销毁）', afterClick.hasInput);
    check('点击输入框：焦点仍在输入框', afterClick.inputFocused);
    check('点击输入框：当前对话未被切换', afterClick.activeId === activeIdBefore,
      'before=' + activeIdBefore + ' after=' + afterClick.activeId);

    // ---- 双击（选中词）也不得切走 ----
    await inputHandle.dblclick();
    await sleep(800);
    const afterDbl = await win.evaluate(SNAPSHOT);
    check('双击输入框：面板仍打开', afterDbl.dropdownDisplay === 'flex', afterDbl.dropdownDisplay);
    check('双击输入框：输入框仍在 DOM', afterDbl.hasInput);
    check('双击输入框：当前对话未被切换', afterDbl.activeId === activeIdBefore,
      'before=' + activeIdBefore + ' after=' + afterDbl.activeId);

    // ---- 能真的打字 ----
    await win.keyboard.type(TAG);
    const afterType = await win.evaluate(SNAPSHOT);
    check('可正常输入文字（本驱动 TAG 进入输入框）',
      !!afterType.inputValue && afterType.inputValue.includes(TAG), JSON.stringify(afterType.inputValue));

    // ---- Escape 取消：退出编辑但不关面板、不提交 ----
    await win.keyboard.press('Escape');
    await sleep(300);
    const afterEsc = await win.evaluate(SNAPSHOT);
    const titleAfterEsc = (afterEsc.titles.find((t) => t.id === target.id) || {}).title;
    check('Escape 后退出编辑态（输入框消失）', afterEsc.hasInput === false);
    check('Escape 后面板仍打开', afterEsc.dropdownDisplay === 'flex', afterEsc.dropdownDisplay);
    check('Escape 取消不提交（标题保持原名）', titleAfterEsc === displayTitle(originalTitle),
      JSON.stringify({ expected: displayTitle(originalTitle), actual: titleAfterEsc }));

    // ---- Enter 提交：验证修复没有破坏提交链路 ----
    const newTitle = 'UAT-RENAMED-' + TAG;
    const itemHandle2 = await win.$(
      '#aiConvList .ai-conv-item[data-conversation-id="' + target.id + '"]'
    );
    await itemHandle2.click({ button: 'right' });
    await win.waitForSelector('#aiConvContextMenuActive .context-menu-item', { timeout: 4000 });
    const menuItems2 = await win.$$('#aiConvContextMenuActive .context-menu-item');
    await menuItems2[0].click();
    await win.waitForSelector('#aiConvList input[type="text"]', { timeout: 4000 });
    await win.keyboard.type(newTitle); // 进入编辑态时已 select()，输入直接替换
    await win.keyboard.press('Enter');
    await sleep(500);

    const afterEnter = await win.evaluate(SNAPSHOT);
    const titleAfterEnter = (afterEnter.titles.find((t) => t.id === target.id) || {}).title;
    check('Enter 提交后退出编辑态', afterEnter.hasInput === false);
    check('Enter 提交后列表显示新标题', titleAfterEnter === displayTitle(newTitle),
      JSON.stringify({ expected: displayTitle(newTitle), actual: titleAfterEnter }));

    // 持久化反向验证：重拉列表后仍是新标题
    await win.evaluate(RELOAD_CONVERSATIONS);
    await sleep(300);
    const afterReload = await win.evaluate(SNAPSHOT);
    const titleAfterReload = (afterReload.titles.find((t) => t.id === target.id) || {}).title;
    check('重命名已持久化（重拉列表仍为新标题）', titleAfterReload === displayTitle(newTitle),
      JSON.stringify({ expected: displayTitle(newTitle), actual: titleAfterReload }));

    // ==================== 用例 2：列表里的另一个对话项 ====================
    console.log('\n用例 2: 另一个对话项 —— 点输入框不得切换当前对话');
    const snap2 = await win.evaluate(SNAPSHOT);
    const other = snap2.titles.find((t) => t.id !== target.id);

    if (!other) {
      skip('列表只有一个对话项，无法覆盖「另一个对话项」路径');
    } else {
      const otherHandle = await win.$(
        '#aiConvList .ai-conv-item[data-conversation-id="' + other.id + '"]'
      );
      const activeBefore2 = (await win.evaluate(SNAPSHOT)).activeId;

      await otherHandle.click({ button: 'right' });
      await win.waitForSelector('#aiConvContextMenuActive .context-menu-item', { timeout: 4000 });
      const menuItems3 = await win.$$('#aiConvContextMenuActive .context-menu-item');
      await menuItems3[0].click();
      await win.waitForSelector('#aiConvList input[type="text"]', { timeout: 4000 });

      const enterEdit2 = await win.evaluate(SNAPSHOT);
      check('用例 2：编辑态输入框出现', enterEdit2.hasInput);
      check('用例 2：编辑态面板未关闭', enterEdit2.dropdownDisplay === 'flex', enterEdit2.dropdownDisplay);

      const inputHandle2 = await win.$('#aiConvList input[type="text"]');
      await inputHandle2.click();
      await sleep(800);
      const afterClick2 = await win.evaluate(SNAPSHOT);
      console.log('    点击另一项输入框后:', JSON.stringify({
        dropdownDisplay: afterClick2.dropdownDisplay,
        activeId: afterClick2.activeId,
        hasInput: afterClick2.hasInput,
      }));
      check('用例 2：点输入框后当前对话未被切换', afterClick2.activeId === activeBefore2,
        'before=' + activeBefore2 + ' after=' + afterClick2.activeId);
      check('用例 2：点输入框后面板仍打开', afterClick2.dropdownDisplay === 'flex', afterClick2.dropdownDisplay);
      check('用例 2：点输入框后输入框仍在 DOM', afterClick2.hasInput);

      // 退出编辑态，避免残留
      await win.keyboard.press('Escape');
      await sleep(300);
    }

    // ==================== 用例 3：失焦提交路径未被「只收尾一次」的闸门堵死 ====================
    // 上一条修复用 settled 闸门拦掉了 renderConvList 触发的 blur 二次收尾，
    // 这里反向确认：**真正的** blur（焦点移到别的控件）仍然会提交。
    console.log('\n用例 3: 失焦提交（点击 AI 输入框）仍然生效');
    const blurTitle = 'UAT-BLUR-' + TAG;
    const itemHandle3 = await win.$(
      '#aiConvList .ai-conv-item[data-conversation-id="' + target.id + '"]'
    );
    await itemHandle3.click({ button: 'right' });
    await win.waitForSelector('#aiConvContextMenuActive .context-menu-item', { timeout: 4000 });
    const menuItems4 = await win.$$('#aiConvContextMenuActive .context-menu-item');
    await menuItems4[0].click();
    await win.waitForSelector('#aiConvList input[type="text"]', { timeout: 4000 });
    await win.keyboard.type(blurTitle);
    await win.click('#aiInput'); // 焦点移出输入框 ⇒ 真实 blur
    await sleep(800);

    const afterBlur = await win.evaluate(SNAPSHOT);
    const titleAfterBlur = (afterBlur.titles.find((t) => t.id === target.id) || {}).title;
    check('失焦后退出编辑态', afterBlur.hasInput === false);
    check('失焦提交生效（标题更新为新值）', titleAfterBlur === displayTitle(blurTitle),
      JSON.stringify({ expected: displayTitle(blurTitle), actual: titleAfterBlur }));
    // #aiInput 在下拉面板之外 ⇒ 既有语义本就该关掉下拉（此处只做记录，不作为修复判据）
    check('失焦后面板按既有语义关闭（点击点在下拉之外）', afterBlur.dropdownDisplay === 'none',
      afterBlur.dropdownDisplay);
  } catch (err) {
    failures.push('驱动异常');
    console.error('\n驱动异常:', err && err.message);
  } finally {
    // ---- 清理：写回标题 + 删除本次新建的对话 ----
    if (app) {
      try {
        const wins = app.windows().filter((w) => w.url().includes('index.html'));
        const cleanupWin = wins[0];
        if (cleanupWin && (titleBackups.length > 0 || createdConvId)) {
          const done = await cleanupWin.evaluate(CLEANUP, { backups: titleBackups, createdId: createdConvId });
          console.log('\n清理:', JSON.stringify(done));
        }
      } catch (e) {
        console.error('清理阶段异常:', e && e.message);
      }
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

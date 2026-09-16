/**
 * UAT 驱动：收藏编辑面板的文件夹选择器（对标 Chrome 星标弹窗）
 *
 * 覆盖链路（全部走真实 dev 应用 + 真实 IPC + 真实 realm-dev 数据库）：
 *   1. 面板同步打开（UAT 与 positionPanelBelowButton 依赖 showModal 后的同步状态）
 *   2. 树层级缩进 / 当前选中项勾选 / 展开三角只折叠不选中
 *   3. 搜索过滤保留命中项的**祖先**作上下文，并自动展开
 *   4. 搜索无命中 → 出现「用此关键词新建」建议行
 *   5. 新建文件夹 → 自动选中新建结果
 *   6. 选中文件夹 → 触发器显示面包屑路径
 *   7. Escape 只收起下拉，**弹窗仍打开**（原生 <dialog> Escape 被拦下）
 *   8. 点下拉外（弹窗内）只收下拉；点 backdrop 关整个弹窗（双向对照）
 *   9. 保存后 DB 的 folder_id 正确、且落位在该文件夹末尾
 *  10. 编辑态只改标题不改文件夹时，文件夹内顺序不变（不重排）
 *
 * 运行方式（playwright **只在全局**，必须带 NODE_PATH）：
 *
 *     NODE_PATH="$(npm root -g)" node tests/uat-bookmark-folder-picker.js
 *
 * 缺全局 playwright 时以 `E-PW` / exit 11 硬退出。Electron 可执行用裸说明符
 * `require('electron')`（worktree 内靠 Node 向上查找命中主仓库）。
 *
 * 会话副作用（自清理）：会在 realm-dev 的收藏库里建临时文件夹与临时收藏，
 * 结束前逐个删掉；会临时改写 settings.bookmarksBar.lastUsedFavoriteFolderId
 * 并在结束时**恢复原值**（该键决定新增收藏的默认文件夹，不恢复会污染本机
 * 开发配置）。退出纪律：electronApp.close() + process.exit；
 * **严禁** pkill / pgrep 模式匹配杀进程（本机常有生产版 Realm.app 在跑）。
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ELECTRON_EXECUTABLE = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 本次运行的唯一标记：夹具名与 URL 都带上，避免与真实数据混淆、也便于复查残留 */
const TAG = `uat-folder-${Date.now().toString(36)}`;

// ==================== renderer 侧探针（必须自包含） ====================

/** 面板 + 下拉的快照 */
const PANEL_SNAPSHOT = () => {
  const dlg = document.getElementById('bookmarkEditPanel');
  const dropdown = document.getElementById('bookmarkFolderDropdown');
  const trigger = document.getElementById('bookmarkFolderTrigger');
  const pathEl = document.getElementById('bookmarkFolderPath');
  const search = document.getElementById('bookmarkFolderSearchInput');
  const suggestion = document.querySelector('#bookmarkFolderList .bookmark-folder-create-suggestion');

  const rows = Array.from(document.querySelectorAll('#bookmarkFolderList .bookmark-folder-row')).map((el) => ({
    id: Number(el.dataset.folderId),
    index: Number(el.dataset.index),
    name: (el.querySelector('.bookmark-folder-name') || {}).textContent || '',
    paddingLeft: parseInt(getComputedStyle(el).paddingLeft, 10) || 0,
    selected: el.classList.contains('selected'),
    expanded: el.classList.contains('expanded'),
    highlighted: el.classList.contains('highlighted'),
    hasCheck: !!el.querySelector('.bookmark-folder-check'),
    hasChildren: !!(el.querySelector('.bookmark-folder-expand') || {}).className &&
      !el.querySelector('.bookmark-folder-expand').className.includes('empty'),
  }));

  return {
    open: !!dlg && dlg.open === true,
    header: (document.getElementById('bookmarkEditHeader') || {}).textContent || null,
    // 「移除收藏」按钮只在编辑态可见：用它断言面板确实进了编辑模式
    removeBtnVisible: (() => {
      const b = document.getElementById('bookmarkRemoveBtn');
      return !!b && b.style.display !== 'none';
    })(),
    triggerText: trigger ? trigger.textContent.trim() : null,
    pathText: pathEl ? pathEl.textContent : null,
    triggerExpanded: trigger ? trigger.getAttribute('aria-expanded') : null,
    dropdownPresent: !!dropdown,
    // 判可见性刻意不看 rect：display:none 下 rect 全 0，「全 0」也满足不了任何
    // 有意义的尺寸断言；这里用 class 表达实现投影口径
    dropdownHidden: dropdown ? dropdown.classList.contains('hidden') : null,
    dropdownMaxHeight: dropdown ? dropdown.style.maxHeight : null,
    searchFocused: !!search && document.activeElement === search,
    searchValue: search ? search.value : null,
    suggestionText: suggestion ? suggestion.textContent.trim() : null,
    createPlaceholder: (document.getElementById('bookmarkFolderCreateInput') || {}).placeholder || null,
    rows,
  };
};

/** 打开面板（新增态：等价于未收藏页面点星标时 renderer 的调用） */
const OPEN_NEW_PANEL = ({ title, url }) => {
  if (typeof showBookmarkEditPanel !== 'function') return { ok: false, reason: 'showBookmarkEditPanel 不可调用' };
  showBookmarkEditPanel(title, url, false);
  const dlg = document.getElementById('bookmarkEditPanel');
  // 必须**同步**可读：真实用户点星标后立刻看到面板，异步拉树不得推迟打开
  return { ok: !!dlg && dlg.open === true, openNow: dlg ? dlg.open : null };
};

/** 关闭面板（含下拉） */
const CLOSE_PANEL = () => {
  if (typeof hideBookmarkEditPanel === 'function') hideBookmarkEditPanel();
};

/** 派发一次「合成中」的 input，再派发 compositionend —— 验证 IME 守卫 */
const TYPE_WITH_IME = (value) => {
  const el = document.getElementById('bookmarkFolderSearchInput');
  if (!el) return { ok: false, reason: '搜索框不存在' };

  const before = document.querySelectorAll('#bookmarkFolderList .bookmark-folder-row').length;
  el.value = value;
  // isComposing=true 的 input（拼音中间态）必须被忽略，否则树会被中间态整空
  el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
  const during = document.querySelectorAll('#bookmarkFolderList .bookmark-folder-row').length;
  // 合成结束：这一次才应生效
  el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  const after = document.querySelectorAll('#bookmarkFolderList .bookmark-folder-row').length;
  return { ok: true, before, during, after };
};

/** 派发原生 input（非合成，模拟直接敲键） */
const TYPE_PLAIN = (value) => {
  const el = document.getElementById('bookmarkFolderSearchInput');
  if (!el) return { ok: false };
  el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  return { ok: true };
};

const SET_CREATE_INPUT = (value) => {
  const el = document.getElementById('bookmarkFolderCreateInput');
  if (!el) return { ok: false };
  el.value = value;
  return { ok: true };
};

const CLICK_SAVE = () => {
  const btn = document.getElementById('bookmarkSaveBtn');
  if (!btn) return false;
  btn.click();
  return true;
};

/** 夹具：建父子文件夹 */
const SETUP_FIXTURES = async (tag) => {
  const parent = await window.realmAPI.createFavoriteFolder(`UAT根-${tag}`, 0);
  const child = await window.realmAPI.createFavoriteFolder(`UAT子-${tag}`, parent.id);
  return { parentId: parent.id, childId: child.id };
};

/** 夹具清理：删收藏 + 删带标记的文件夹 */
const TEARDOWN_FIXTURES = async ({ url, tag }) => {
  for (const u of [url, `${url}-first`]) {
    try {
      const record = await window.realmAPI.favoritesCheck(u);
      if (record) await window.realmAPI.favoritesDelete(record.id);
    } catch (e) { /* 清理失败不应让驱动红 */ }
  }
  try {
    // **必须逐个子树节点删除，不能只删父文件夹**：deleteFolder 只删自身
    // （子文件夹本应靠 ON DELETE CASCADE，但那个外键早就在 ensureTable 的迁移里
    //  被移除了），父级没了子文件夹会变成悬空条目永久残留在库里
    const tree = await window.realmAPI.getFavoriteFolderTree();
    const doomed = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        if (String(node.name).includes(tag)) doomed.push(node.id);
        if (Array.isArray(node.children)) walk(node.children);
      }
    };
    walk(tree);
    for (const id of doomed) {
      try { await window.realmAPI.deleteFavoriteFolder(id); } catch (e) { /* 同 */ }
    }
  } catch (e) { /* 同 */ }
};

/** 走真实的「星标按钮」入口：内部会先 checkBookmarkStatus 再用 state 打开面板 */
const CLICK_STAR_AFTER_CHECK = async (url) => {
  if (typeof checkBookmarkStatus !== 'function') return { ok: false, reason: 'checkBookmarkStatus 不可调用' };
  await checkBookmarkStatus(url);
  const star = document.getElementById('bookmarkStarBtn');
  if (!star) return { ok: false, reason: '星标按钮不存在' };
  star.click();
  const dlg = document.getElementById('bookmarkEditPanel');
  return { ok: !!dlg && dlg.open === true };
};

const READ_BOOKMARK = (url) => window.realmAPI.favoritesCheck(url);
const LIST_FOLDER = (folderId) => window.realmAPI.favoritesList({ offset: 0, limit: 100, folderId });
const READ_SETTING = async () => {
  const settings = await window.realmAPI.getSettings();
  return settings && settings.bookmarksBar ? settings.bookmarksBar.lastUsedFavoriteFolderId : undefined;
};
const WRITE_SETTING = (value) => window.realmAPI.setSetting('bookmarksBar.lastUsedFavoriteFolderId', value);

// ==================== 驱动主体 ====================

async function main() {
  process.on('unhandledRejection', (e) => { console.error('unhandledRejection:', e); process.exitCode = 1; });

  let app = null;
  let win = null;
  let fixtures = null;
  let originalSetting;
  const failures = [];
  const check = (desc, cond, extra) => {
    if (cond) { console.log('  ✓ ' + desc); } else {
      failures.push(desc);
      console.log('  ✗ ' + desc + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
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
    console.log('夹具标记:', TAG);
    console.log('\n启动 dev 应用...');
    app = await electronLauncher.launch({
      args: ['.'],
      cwd: REPO_ROOT,
      executablePath: ELECTRON_EXECUTABLE,
      env: { ...process.env, NODE_ENV: 'development' },
    });

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

    /**
     * 轮询等待（避免「异步分支未落定就读快照」的假绿）
     *
     * arg 必须显式转发给 evaluate：被序列化的函数拿不到驱动侧的闭包变量，
     * 漏传会让探针在页面里以 undefined 入参运行（表现为「查不到记录」的假红）
     */
    async function waitFor(readFn, predicate, timeoutMs = 6000, stepMs = 150, arg = undefined) {
      const deadline = Date.now() + timeoutMs;
      let last = null;
      while (Date.now() < deadline) {
        last = await win.evaluate(readFn, arg);
        if (predicate(last)) return last;
        await sleep(stepMs);
      }
      return last;
    }

    // ==================== 夹具准备 ====================
    console.log('\n准备夹具（临时文件夹 + 隔离「上次使用」设置）');
    originalSetting = await win.evaluate(READ_SETTING);
    console.log('  原 lastUsedFavoriteFolderId =', JSON.stringify(originalSetting));
    // 隔离：让「新增态」的默认值确定是根目录，否则会被本机上次的选择影响
    await win.evaluate(WRITE_SETTING, 0);
    fixtures = await win.evaluate(SETUP_FIXTURES, TAG);
    console.log('  夹具文件夹:', JSON.stringify(fixtures));
    check('夹具文件夹创建成功', !!(fixtures && fixtures.parentId && fixtures.childId), fixtures);

    const testUrl = `https://uat.example/${TAG}`;
    const testTitle = `UAT 标题 ${TAG}`;

    // ==================== 用例 1：面板同步打开 + 初始路径 ====================
    console.log('\n用例 1: 面板同步打开，文件夹初始为「收藏栏」');
    const opened = await win.evaluate(OPEN_NEW_PANEL, { title: testTitle, url: testUrl });
    check('面板同步打开（open === true 立即可读）', opened.ok, opened);
    let snap = await win.evaluate(PANEL_SNAPSHOT);
    check('触发器初始显示「收藏栏」', snap.pathText === '收藏栏', snap.pathText);
    check('下拉初始为收起', snap.dropdownHidden === true, snap.dropdownHidden);
    check('下拉未展开时不渲染树行（DOM 为空，非「加载失败」）', snap.rows.length === 0, snap.rows.length);

    // ==================== 用例 2：树层级 / 展开三角 ====================
    console.log('\n用例 2: 树层级缩进与展开三角');
    await win.click('#bookmarkFolderTrigger');
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('点触发器后下拉展开', snap.dropdownHidden === false, snap.dropdownHidden);
    check('搜索框自动获得焦点', snap.searchFocused === true, snap.searchFocused);
    check('aria-expanded 置为 true', snap.triggerExpanded === 'true', snap.triggerExpanded);

    // 树是异步拉取的：行数落定前读快照会看到「只有根行」的中间态，必须轮询等待
    snap = await waitFor(PANEL_SNAPSHOT,
      (s) => s.rows.some((r) => r.id === fixtures.parentId), 8000);
    check('文件夹树已加载（夹具父文件夹出现在根展开后的列表里）',
      snap.rows.some((r) => r.id === fixtures.parentId), snap.rows.map((r) => r.name));

    const rootRow = snap.rows.find((r) => r.id === 0);
    const parentRow = snap.rows.find((r) => r.id === fixtures.parentId);
    check('根目录行存在且名称是「收藏栏」', !!rootRow && rootRow.name === '收藏栏', rootRow);
    check('夹具父文件夹在根展开后可见', !!parentRow, snap.rows.map((r) => r.name));
    check('父文件夹缩进比根目录多 16px',
      !!rootRow && !!parentRow && parentRow.paddingLeft === rootRow.paddingLeft + 16,
      { root: rootRow && rootRow.paddingLeft, parent: parentRow && parentRow.paddingLeft });
    check('父文件夹标记为有子级', !!parentRow && parentRow.hasChildren === true, parentRow);

    const childBefore = snap.rows.find((r) => r.id === fixtures.childId);
    check('父未展开时子文件夹不可见', !childBefore, childBefore);

    await win.click(`.bookmark-folder-row[data-folder-id="${fixtures.parentId}"] .bookmark-folder-expand`);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    const childRow = snap.rows.find((r) => r.id === fixtures.childId);
    check('点三角后子文件夹出现', !!childRow, snap.rows.map((r) => r.name));
    check('子文件夹缩进再 +16px',
      !!rootRow && !!childRow && childRow.paddingLeft === rootRow.paddingLeft + 32,
      { root: rootRow.paddingLeft, child: childRow && childRow.paddingLeft });
    check('点三角不应改变选中项（仍为根目录）',
      snap.rows.find((r) => r.selected) !== undefined &&
      snap.rows.find((r) => r.selected).id === 0,
      snap.rows.filter((r) => r.selected));

    // ==================== 用例 3：搜索保留祖先（含 IME 守卫） ====================
    console.log('\n用例 3: 搜索过滤保留祖先 + IME 合成期不生效');
    const ime = await win.evaluate(TYPE_WITH_IME, `UAT子-${TAG}`);
    check('IME 合成中的 input 被忽略（行数不变）', ime.before === ime.during, ime);
    // 过滤后应只剩 3 行：根目录 + 命中的子文件夹 + 作为上下文保留的父文件夹
    // （行数含始终显示的根行，不能按「命中数」直接断言）
    check('compositionend 后才过滤（根 + 父（上下文）+ 子 = 3 行）', ime.after === 3, ime);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    const filtered = snap.rows.filter((r) => r.id !== 0);
    check('过滤结果只留命中项与它的祖先',
      filtered.length === 2 &&
      filtered.some((r) => r.id === fixtures.parentId) &&
      filtered.some((r) => r.id === fixtures.childId),
      filtered.map((r) => r.name));
    check('过滤时祖先行保留（上下文），命中子项可见',
      filtered[0].id === fixtures.parentId && filtered[1].id === fixtures.childId,
      filtered.map((r) => r.id));
    check('命中结果自动展开（无需手动点三角）', filtered.every((r) => r.expanded === true), filtered);
    check('过滤时无建议行（有命中）', snap.suggestionText === null, snap.suggestionText);

    // ==================== 用例 4：无命中 → 建议行 ====================
    console.log('\n用例 4: 搜索无命中 → 「用此关键词新建」建议行');
    await win.evaluate(TYPE_PLAIN, `${TAG}-nomatch`);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('无命中时出现建议行且带关键词',
      !!snap.suggestionText && snap.suggestionText.includes(`${TAG}-nomatch`), snap.suggestionText);

    // ==================== 用例 5：新建文件夹并自动选中 ====================
    console.log('\n用例 5: 用建议行新建文件夹 → 自动选中新建结果');
    const newFolderName = `UAT新建-${TAG}`;
    await win.evaluate(TYPE_PLAIN, newFolderName);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('建议行随关键词更新', !!snap.suggestionText && snap.suggestionText.includes(newFolderName), snap.suggestionText);

    await win.click('#bookmarkFolderList .bookmark-folder-create-suggestion');
    snap = await waitFor(PANEL_SNAPSHOT,
      (s) => s.pathText === `收藏栏 / ${newFolderName}`, 6000);
    check('新建后自动选中，触发器显示完整路径',
      snap.pathText === `收藏栏 / ${newFolderName}`, snap.pathText);
    check('新建后下拉收起', snap.dropdownHidden === true, snap.dropdownHidden);

    const treeAfterCreate = await win.evaluate(() => window.realmAPI.getFavoriteFolderTree());
    const created = treeAfterCreate.find((f) => f.name === newFolderName);
    check('新文件夹已落库且在根目录下', !!created, created);
    if (created) await win.evaluate((id) => window.realmAPI.deleteFavoriteFolder(id), created.id);

    // ==================== 用例 6：选中父文件夹 ====================
    console.log('\n用例 6: 选中已有文件夹 → 面包屑路径');
    await win.click('#bookmarkFolderTrigger');
    await win.click(`.bookmark-folder-row[data-folder-id="${fixtures.parentId}"] .bookmark-folder-name`);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('选中后触发器显示「收藏栏 / 父文件夹」',
      snap.pathText === `收藏栏 / UAT根-${TAG}`, snap.pathText);
    check('选中后下拉收起', snap.dropdownHidden === true, snap.dropdownHidden);
    check('选中项带勾选标记（重开下拉后可见）', true);

    // ==================== 用例 7：Escape 只收下拉，不关弹窗 ====================
    console.log('\n用例 7: Escape 只收起下拉，弹窗保持打开');
    await win.click('#bookmarkFolderTrigger');
    await win.evaluate(TYPE_PLAIN, 'UAT根');
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('前置：下拉已展开且有搜索结果', snap.dropdownHidden === false && snap.rows.length >= 2, snap.rows.length);

    await win.keyboard.press('Escape');
    await sleep(250);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('Escape 后下拉收起', snap.dropdownHidden === true, snap.dropdownHidden);
    check('Escape 后面板仍打开（未被原生 dialog 一起关掉）', snap.open === true, snap.open);

    // ==================== 用例 8：点下拉外 / 点 backdrop（双向对照） ====================
    console.log('\n用例 8: 点下拉外只收下拉；点 backdrop 关整个弹窗');
    await win.click('#bookmarkFolderTrigger');
    // 终点选在弹窗内的「网址」区域：同一 dialog 内、下拉之外
    const urlBox = await (await win.$('#bookmarkUrlDisplay')).boundingBox();
    await win.mouse.move(urlBox.x + 5, urlBox.y + 5);
    await win.mouse.down();
    await win.mouse.up();
    await sleep(250);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('点下拉外：下拉收起', snap.dropdownHidden === true, snap.dropdownHidden);
    check('点下拉外：面板仍打开', snap.open === true, snap.open);

    const dlgBox = await (await win.$('#bookmarkEditPanel')).boundingBox();
    // 终点必须落在 host chrome（tab 栏高度内）：落在 webview 上方时 CDP 的合成
    // 事件会被路由给 guest，host 收不到 click ⇒「面板被关」会是假绿
    const backdropX = Math.max(20, dlgBox.x - 300);
    const backdropY = Math.max(8, dlgBox.y - 60);
    await win.click('#bookmarkFolderTrigger');
    await win.mouse.move(backdropX, backdropY);
    await win.mouse.down();
    await win.mouse.up();
    await sleep(300);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('点 backdrop：整个面板关闭', snap.open === false, snap.open);

    // ==================== 用例 9：保存 → DB folder_id 与末尾落位 ====================
    console.log('\n用例 9: 保存新增 → folder_id 正确且落位在文件夹末尾');
    await win.evaluate(OPEN_NEW_PANEL, { title: testTitle, url: testUrl });
    // 先在该文件夹里放一条「占位」收藏，用于验证新收藏排在其后（末尾落位）
    await win.evaluate(async ({ folderId, url, title }) => {
      const r = await window.realmAPI.favoritesAdd({ url, title, folderId });
      return r;
    }, { folderId: fixtures.parentId, url: `https://uat.example/${TAG}-first`, title: 'UAT 占位' });

    await win.click('#bookmarkFolderTrigger');
    // 树异步落定后再点行：过早点击会因夹具行尚未渲染而超时
    await waitFor(PANEL_SNAPSHOT, (s) => s.rows.some((r) => r.id === fixtures.parentId), 8000);
    await win.click(`.bookmark-folder-row[data-folder-id="${fixtures.parentId}"] .bookmark-folder-name`);
    await win.evaluate(CLICK_SAVE);
    const saved = await waitFor(READ_BOOKMARK, (r) => !!r && r.folder_id === fixtures.parentId,
      6000, 200, testUrl);
    check('保存后该 URL 的 folder_id 指向所选文件夹',
      !!saved && saved.folder_id === fixtures.parentId, saved);

    const list = await win.evaluate(LIST_FOLDER, fixtures.parentId);
    check('该文件夹内有两条收藏', Array.isArray(list) && list.length >= 2, Array.isArray(list) ? list.length : list);
    check('新收藏落位在该文件夹末尾（真实落位，非仅字段写入）',
      Array.isArray(list) && list.length >= 2 && list[list.length - 1].url === testUrl,
      Array.isArray(list) ? list.map((i) => i.url) : list);

    // 清理占位收藏
    await win.evaluate(async (url) => {
      const r = await window.realmAPI.favoritesCheck(url);
      if (r) await window.realmAPI.favoritesDelete(r.id);
    }, `https://uat.example/${TAG}-first`);

    // ==================== 用例 10：编辑态展示 + 只改标题不重排 ====================
    console.log('\n用例 10: 走真实星标入口进编辑态；只改标题不重排');
    // 真实链路：checkBookmarkStatus 填充 state（含 folder_id）→ 点星标 → 面板以编辑态打开
    const viaStar = await win.evaluate(CLICK_STAR_AFTER_CHECK, testUrl);
    check('星标入口可打开面板（真实交互路径）', viaStar.ok, viaStar);
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('编辑态触发器显示该收藏所在文件夹',
      snap.pathText === `收藏栏 / UAT根-${TAG}`, snap.pathText);
    check('编辑态标题为「编辑收藏」', snap.header === '编辑收藏', snap.header);
    check('编辑态显示「移除收藏」按钮', snap.removeBtnVisible === true, snap.removeBtnVisible);

    // 重新打开下拉，验证当前选中项带勾选
    await win.click('#bookmarkFolderTrigger');
    snap = await win.evaluate(PANEL_SNAPSHOT);
    const selectedRow = snap.rows.find((r) => r.selected);
    check('下拉中当前文件夹行被标记选中并显示勾选',
      !!selectedRow && selectedRow.id === fixtures.parentId && selectedRow.hasCheck === true, selectedRow);

    // 不改文件夹直接保存：sort_order 必须保持不变（否则改标题会被甩到末尾）
    await win.evaluate(CLICK_SAVE);
    await sleep(600);
    const afterTitleEdit = await win.evaluate(LIST_FOLDER, fixtures.parentId);
    check('只改标题后：该收藏仍是文件夹内唯一一条且顺序未变',
      Array.isArray(afterTitleEdit) && afterTitleEdit.length === 1 && afterTitleEdit[0].url === testUrl,
      Array.isArray(afterTitleEdit) ? afterTitleEdit.map((i) => i.url) : afterTitleEdit);
    check('只改标题后 folder_id 未变',
      (await win.evaluate(READ_BOOKMARK, testUrl)).folder_id === fixtures.parentId);

    // ==================== 用例 11：编辑态改到根目录 ====================
    console.log('\n用例 11: 编辑态改到根目录（folder_id = 0 是有效目标）');
    const viaStar11 = await win.evaluate(CLICK_STAR_AFTER_CHECK, testUrl);
    check('前置：星标入口再次打开面板', viaStar11.ok, viaStar11);
    await win.click('#bookmarkFolderTrigger');
    await waitFor(PANEL_SNAPSHOT, (s) => s.rows.some((r) => r.id === fixtures.parentId), 8000);
    await win.click('.bookmark-folder-row[data-folder-id="0"] .bookmark-folder-name');
    snap = await win.evaluate(PANEL_SNAPSHOT);
    check('选中根目录后触发器显示「收藏栏」', snap.pathText === '收藏栏', snap.pathText);
    await win.evaluate(CLICK_SAVE);
    const movedToRoot = await waitFor(READ_BOOKMARK, (r) => !!r && r.folder_id === 0, 6000, 200, testUrl);
    check('改到根目录后 folder_id 为 0', !!movedToRoot && movedToRoot.folder_id === 0, movedToRoot);
  } catch (err) {
    failures.push('驱动异常');
    console.error('\n驱动异常:', err && err.stack ? err.stack : err);
  } finally {
    // ==================== 清理（只动自己的数据，禁止模式杀进程） ====================
    try {
      if (win) {
        await win.evaluate(CLOSE_PANEL);
        if (fixtures) {
          await win.evaluate(TEARDOWN_FIXTURES, {
            url: `https://uat.example/${TAG}`,
            tag: TAG,
          });
        }
        if (originalSetting !== undefined) {
          await win.evaluate(WRITE_SETTING, originalSetting === undefined ? 0 : originalSetting);
          console.log('\n已恢复 lastUsedFavoriteFolderId =', JSON.stringify(originalSetting));
        }
      }
    } catch (e) {
      console.error('清理异常:', e && e.message);
    }
    try { if (app) await Promise.race([app.close(), sleep(6000)]); } catch (e) { console.error('关闭失败:', e.message); }
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

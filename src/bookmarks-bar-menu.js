/**
 * Realm Browser - 收藏栏下拉菜单模块
 *
 * 实现收藏栏的下拉菜单交互：
 * - 文件夹下拉菜单（显示子收藏项和子文件夹）
 * - 子菜单悬停展开（300ms 延迟，右侧弹出）
 * - 溢出菜单（» 按钮，显示溢出的收藏项）
 * - 文件夹悬浮切换（Chrome 式：已有菜单打开时，悬浮其他文件夹/»按钮自动切换）
 * - 点击外部区域和 ESC 关闭菜单
 *
 * 使用方式：
 *   window.bookmarksBarMenu.showFolderMenu(folderEl, folderId)
 *   window.bookmarksBarMenu.showOverflowMenu(overflowBtn, overflowItems)
 *   window.bookmarksBarMenu.closeAllMenus()
 */

// ==================== XSS 防御 ====================

/**
 * HTML 转义函数（T-18-01 安全要求）
 * @param {string} text - 原始文本
 * @returns {string} 转义后的安全文本
 */
function escapeHtmlMenu(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 常量 ====================

/** Realm 应用图标路径（favicon 降级用） */
const REALM_ICON_PATH_MENU = '../icons/icon.png';

/** 子菜单悬停展开延迟（ms），per D-05 */
const SUBMENU_HOVER_DELAY = 300;

/** 子菜单关闭延迟（ms），防止鼠标移到子菜单途中关闭 */
const SUBMENU_CLOSE_DELAY = 150;

/** 下拉菜单最大宽度（px），per D-06 */
const MENU_MAX_WIDTH = 280;

/** 下拉菜单最小宽度（px） */
const MENU_MIN_WIDTH = 180;

/** 菜单距离屏幕边缘的最小留白（px） */
const MENU_EDGE_MARGIN = 12;

/** 子菜单水平偏移（px） */
const SUBMENU_OFFSET_X = 2;

/** 子菜单垂直偏移（px） */
const SUBMENU_OFFSET_Y = -4;

/** 拖拽数据 MIME（与 bookmarks-bar.js 保持一致） */
const BOOKMARK_DRAG_MIME_MENU = 'application/x-realm-bookmark';

/** 悬浮切换下拉菜单的停留延迟（ms）：仅在一个菜单已打开时生效，防扫过中间项闪烁 */
const BAR_MENU_SWITCH_DELAY = 150;

/** 菜单命中区域外扩（px）：桥接菜单与收藏栏之间 4px 定位缝隙，防穿越误判 */
const MENU_REGION_MARGIN = 8;

// ==================== 状态 ====================

/** 当前打开的菜单列表 */
let _activeMenus = [];

/** 子菜单悬停定时器 Map */
let _hoverTimers = new Map();

/** 当前打开的第一级下拉菜单对应的文件夹 ID（用于 toggle 逻辑） */
let _currentDropdownFolderId = null;

/** 拖拽期间固定的源菜单（拖出期间保持展开），null 表示无 */
let _pinnedDragMenu = null;

/** 固定源菜单对应的文件夹 ID（收藏栏上的源文件夹） */
let _pinnedDragMenuFolderId = null;

/** 全屏遮罩层元素 */
let _menuBackdrop = null;

/** 悬浮切换定时器（仅已有菜单打开时启动） */
let _barSwitchTimer = null;

/** 悬浮切换待处理目标：{type:'folder', el, id} 或 {type:'overflow', el} */
let _barSwitchPending = null;

/** 悬浮跟踪 mousemove 的 rAF 节流 id */
let _barHoverRafId = 0;

/** rAF 节流期间最新指针位置（后续 move 更新，避免用到该帧首次事件坐标） */
let _barHoverX = 0;
let _barHoverY = 0;

// ==================== 拖拽放置支持 ====================

// HTML5 拖拽期间 mouse 事件（mouseenter/mouseleave）停发，
// 菜单的拖拽悬停展开、放置高亮改由 dragenter/dragover/dragleave/drop 驱动；
// 点击流程的 mouse 逻辑保持不变，两者互不干扰。

/**
 * 判断事件是否携带收藏栏拖拽数据类型
 * @param {DragEvent} e - 拖拽事件
 * @returns {boolean}
 */
function _isRealmDragMenu(e) {
  return !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes(BOOKMARK_DRAG_MIME_MENU));
}

/**
 * 读取当前拖拽源状态（由 bookmarks-bar.js 维护）
 * @returns {{type: string, id: number}|null}
 */
function _getDragState() {
  return window.bookmarksBar && window.bookmarksBar.getDragState
    ? window.bookmarksBar.getDragState()
    : null;
}

/**
 * 清除菜单项上的拖拽高亮
 */
function _clearMenuDragIndicators() {
  document.querySelectorAll(
    '.bookmarks-dropdown-item.drag-over-folder, .bookmarks-dropdown-item.drag-over-top, .bookmarks-dropdown-item.drag-over-bottom'
  ).forEach((el) => {
    el.classList.remove('drag-over-folder', 'drag-over-top', 'drag-over-bottom');
  });
}

/**
 * 清除与菜单项相关的拖拽关闭定时器
 * 包括：自身及祖先菜单的延迟关闭定时器、自身子菜单的关闭定时器
 * @param {HTMLElement} item - 菜单项元素
 */
function _clearDragCloseTimers(item) {
  let menuEl = item.closest('.bookmarks-dropdown, .bookmarks-submenu');
  while (menuEl) {
    if (menuEl._dragCloseTimer) {
      clearTimeout(menuEl._dragCloseTimer);
      menuEl._dragCloseTimer = null;
    }
    menuEl = menuEl._parentItem
      ? menuEl._parentItem.closest('.bookmarks-dropdown, .bookmarks-submenu')
      : null;
  }
  if (item._submenu) {
    if (item._submenu._dragCloseTimer) {
      clearTimeout(item._submenu._dragCloseTimer);
      item._submenu._dragCloseTimer = null;
    }
    if (item._submenu._closeTimer) {
      clearTimeout(item._submenu._closeTimer);
      item._submenu._closeTimer = null;
    }
  }
}

/**
 * 判断目标元素是否位于收藏栏下拉菜单内
 * @param {Element} target - 目标元素
 * @returns {boolean}
 */
function isOverMenu(target) {
  if (!target || !target.closest) return false;
  return !!target.closest('.bookmarks-dropdown, .bookmarks-submenu');
}

/**
 * 当前是否有打开的菜单
 * @returns {boolean}
 */
function hasOpenMenus() {
  return _activeMenus.length > 0;
}

/**
 * 当前打开的第一级下拉菜单对应的文件夹 ID（无打开菜单时为 null）
 * 拖拽模块用于判断光标是否仍停在打开菜单的源文件夹上（豁免关闭，防闪烁）
 * @returns {string|null}
 */
function getOpenMenuFolderId() {
  return _currentDropdownFolderId;
}

/**
 * 拖拽期间固定的源菜单对应的文件夹 ID（无固定菜单时为 null）
 * @returns {string|null}
 */
function getPinnedDragMenuFolderId() {
  return _pinnedDragMenuFolderId;
}

/**
 * 标记源菜单链为固定（拖出期间保持展开）
 * 从源菜单项所在的菜单沿 _parentItem 链向上，逐级标记 _pinnedDrag，
 * 顶层菜单记为 _pinnedDragMenu（拖拽中不参与任何关闭逻辑）
 * @param {HTMLElement} itemEl - 源菜单项元素
 */
function _pinMenuChainForDrag(itemEl) {
  let menuEl = itemEl.closest('.bookmarks-dropdown, .bookmarks-submenu');
  let topLevel = null;
  while (menuEl) {
    menuEl._pinnedDrag = true;
    topLevel = menuEl;
    menuEl = menuEl._parentItem
      ? menuEl._parentItem.closest('.bookmarks-dropdown, .bookmarks-submenu')
      : null;
  }
  _pinnedDragMenu = topLevel;
  _pinnedDragMenuFolderId = topLevel ? topLevel.dataset.folderId : null;
}

/**
 * 关闭所有非固定的顶层菜单（含其子菜单链），固定源菜单保持展开
 * 用于菜单来源拖拽中切换悬停目标文件夹时收起上一个临时菜单
 */
function closeTransientMenus() {
  const transientTop = _activeMenus.filter(
    (m) => !m.classList.contains('bookmarks-submenu') && !m._pinnedDrag
  );
  transientTop.forEach((m) => _closeMenuAndDescendants(m));
  _currentDropdownFolderId = _pinnedDragMenu ? _pinnedDragMenuFolderId : null;
}

/**
 * 解除拖拽固定标记但不关闭菜单
 * 用于菜单来源拖拽取消且未放置时：菜单保持展开（Chrome 式）
 */
function endDragPin() {
  _activeMenus.forEach((m) => {
    m._pinnedDrag = false;
  });
  _pinnedDragMenu = null;
  _pinnedDragMenuFolderId = null;
  // 拖拽起拖时移除了遮罩（暴露收藏栏放置目标）；菜单保持展开，
  // 补回遮罩恢复「点击外部区域关闭」
  if (_activeMenus.length > 0) {
    _createBackdrop();
  }
}

/**
 * 在当前打开的菜单中查找文件夹菜单项元素
 * @param {number|string} folderId - 文件夹 ID
 * @returns {HTMLElement|null}
 */
function _findFolderItemInOpenMenus(folderId) {
  for (const menuEl of _activeMenus) {
    const items = menuEl.querySelectorAll('.bookmarks-folder-item');
    for (const it of items) {
      if (String(it.dataset.folderId) === String(folderId)) return it;
    }
  }
  return null;
}

/**
 * 刷新当前打开的菜单（拖拽放置成功后保持展开并实时更新内容，Chrome 式）
 *
 * 对每个打开的菜单按最新数据原地重建内容（菜单元素本身不替换，
 * 位置/层级/固定标记均保留，无闪烁）；重建会让打开着的子菜单失去
 * 锚点（旧文件夹项被销毁），随后按 folderId 重新锚定并重算位置，
 * 锚点已不存在的子菜单（文件夹被移走）级联关闭。
 *
 * @returns {Promise<void>}
 */
async function refreshOpenMenus() {
  const menus = [..._activeMenus];
  for (const menuEl of menus) {
    if (!menuEl.parentNode) continue;
    const folderId = parseInt(menuEl.dataset.folderId, 10);
    if (!Number.isFinite(folderId)) continue;

    try {
      const [favorites, subFolders] = await Promise.all([
        window.realmAPI.bookmarksBar.listFavorites(folderId),
        window.realmAPI.bookmarksBar.listFolders(folderId),
      ]);
      // 异步期间菜单可能被关闭
      if (!menuEl.parentNode) continue;

      // 本菜单当前打开着的子菜单，重建内容后需重新锚定
      const openSubmenus = _activeMenus.filter((m) =>
        m.classList.contains('bookmarks-submenu') && m._parentItem &&
        m._parentItem.parentNode === menuEl);

      menuEl._subFolders = subFolders || [];
      while (menuEl.firstChild) menuEl.removeChild(menuEl.firstChild);
      (subFolders || []).forEach((folder) => {
        menuEl.appendChild(_createFolderMenuItem(folder, true));
      });
      if ((subFolders || []).length > 0 && (favorites || []).length > 0) {
        const separator = document.createElement('div');
        separator.className = 'bookmarks-dropdown-separator';
        menuEl.appendChild(separator);
      }
      (favorites || []).forEach((record) => {
        menuEl.appendChild(_createBookmarkMenuItem(record, true));
      });

      // 重新锚定子菜单：按 folderId 找到重建后的新文件夹项并重算位置
      for (const submenu of openSubmenus) {
        if (!submenu.parentNode) continue;
        const anchorId = submenu._parentItem ? submenu._parentItem.dataset.folderId : null;
        const newAnchor = anchorId !== null ? _findFolderItemInOpenMenus(anchorId) : null;
        if (newAnchor) {
          submenu._parentItem = newAnchor;
          newAnchor._submenu = submenu;
          const width = parseFloat(submenu.style.width) || submenu.offsetWidth;
          const pos = _calculateSubmenuPosition(newAnchor, width);
          submenu.style.left = pos.left + 'px';
          submenu.style.top = pos.top + 'px';
        } else {
          // 锚点文件夹已不在此菜单中（被移走/删除）：级联关闭
          _closeMenuAndDescendants(submenu);
        }
      }
    } catch (err) {
      console.error('[Realm Renderer] 刷新收藏栏菜单失败:', err);
    }
  }
}

/**
 * 菜单容器 dragstart：菜单项作为拖拽源（拖出/菜单内排序）
 * 溢出菜单（无 dataset.folderId）不参与
 * @param {DragEvent} e - 拖拽事件
 */
function _onMenuDragStart(e) {
  const menuEl = e.currentTarget;
  if (!menuEl || menuEl.dataset.folderId === undefined) return;

  const itemEl = e.target.closest('.bookmarks-dropdown-item');
  if (!itemEl) return;

  const isFolder = itemEl.classList.contains('bookmarks-folder-item');
  const id = parseInt(isFolder ? itemEl.dataset.folderId : itemEl.dataset.bookmarkId, 10);
  if (!Number.isFinite(id)) return;
  const folderId = parseInt(menuEl.dataset.folderId, 10);
  if (!Number.isFinite(folderId)) return;

  const type = isFolder ? 'folder' : 'bookmark';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData(BOOKMARK_DRAG_MIME_MENU, JSON.stringify({ type, id }));

  // 移除全屏遮罩：点击打开的源菜单自带遮罩（z-index 高于收藏栏），
  // 会挡住收藏栏的 dragover/drop，导致拖到收藏栏无法放置。
  // 拖拽期间没有点击场景，遮罩无用；取消拖拽保持菜单展开时由 endDragPin 补回
  _removeBackdrop();

  // 标记源菜单链固定：拖出期间保持展开（Chrome 式）
  _pinMenuChainForDrag(itemEl);
  // 交给收藏栏模块维护拖拽状态（不关闭菜单）
  window.bookmarksBar.beginMenuDrag({ type, id, folderId }, itemEl);
}

// ==================== 悬浮切换（Chrome 式） ====================

// 菜单打开期间全屏遮罩（z-index 99990）盖住收藏栏（菜单 99999/子菜单 100000
// 在遮罩之上），文件夹上的 mouseenter/mouseover 全部落在遮罩上收不到，
// 悬浮切换只能用 document mousemove + 矩形命中分区实现。
// 语义：悬浮只负责「中间切换」——一个菜单已打开时悬浮其他文件夹/»按钮
// 自动切换；打开第一个和关闭最后一个仍靠点击/键盘，鼠标离开不自动关。

/**
 * 判断点是否位于矩形内（可四边外扩）
 * @param {number} x
 * @param {number} y
 * @param {DOMRect} rect
 * @param {number} [margin=0] - 外扩像素
 * @returns {boolean}
 */
function _pointInRect(x, y, rect, margin = 0) {
  return x >= rect.left - margin && x <= rect.right + margin &&
    y >= rect.top - margin && y <= rect.bottom + margin;
}

/**
 * 命中测试收藏栏上的悬浮切换目标
 * @param {number} x
 * @param {number} y
 * @returns {{type:'folder', el: HTMLElement, id: string}|{type:'overflow', el: HTMLElement}|{type:'other'}|null}
 *   null 表示收藏栏空白区
 */
function _findBarHitTarget(x, y) {
  const list = document.getElementById('bookmarksBarList');
  const children = list ? Array.from(list.children) : [];
  for (const el of children) {
    if (el.style.display === 'none') continue; // 溢出隐藏项不可命中
    if (!_pointInRect(x, y, el.getBoundingClientRect())) continue;
    if (el.dataset.type === 'folder') {
      return { type: 'folder', el, id: el.dataset.folderId };
    }
    return { type: 'other' }; // 收藏项：不参与切换
  }
  const overflowBtn = document.getElementById('bookmarksOverflowBtn');
  if (overflowBtn && _pointInRect(x, y, overflowBtn.getBoundingClientRect())) {
    return { type: 'overflow', el: overflowBtn };
  }
  return null;
}

/**
 * 取消待执行的悬浮切换
 */
function _cancelBarSwitchTimer() {
  if (_barSwitchTimer) {
    clearTimeout(_barSwitchTimer);
    _barSwitchTimer = null;
  }
  _barSwitchPending = null;
}

/**
 * 启动悬浮切换定时器
 * 同一目标重复命中不重置定时器：mousemove 高频触发，重复 schedule 会把
 * 延迟永远重置导致永不切换；换目标才重置
 * @param {{type:'folder', el: HTMLElement, id: string}|{type:'overflow', el: HTMLElement}} target
 */
function _scheduleBarSwitch(target) {
  if (_barSwitchPending &&
      _barSwitchPending.type === target.type &&
      (target.type !== 'folder' || String(_barSwitchPending.id) === String(target.id))) {
    return;
  }
  _cancelBarSwitchTimer();
  _barSwitchPending = target;
  _barSwitchTimer = setTimeout(() => {
    _barSwitchTimer = null;
    const pending = _barSwitchPending;
    _barSwitchPending = null;
    if (!pending || _activeMenus.length === 0) return;
    // 等待期间又起了拖拽（如菜单来源拖拽）：不切换
    if (window.bookmarksBar && window.bookmarksBar.getDragState &&
        window.bookmarksBar.getDragState()) return;
    if (pending.type === 'folder') {
      showFolderMenu(pending.el, pending.id, { forHover: true });
    } else if (window.bookmarksBar && window.bookmarksBar.getOverflowItems) {
      const items = window.bookmarksBar.getOverflowItems();
      const btn = pending.el || document.getElementById('bookmarksOverflowBtn');
      if (items.length > 0 && btn) showOverflowMenu(btn, items);
    }
  }, BAR_MENU_SWITCH_DELAY);
}

/**
 * 处理悬浮跟踪命中分区（rAF 节流后调用）
 * 分区优先级：打开菜单（外扩桥接缝隙）→ 收藏栏（文件夹/»按钮/其他）→ 区域外
 * @param {number} x
 * @param {number} y
 */
function _handleBarHoverTracking(x, y) {
  for (const menu of _activeMenus) {
    if (menu.parentNode &&
        _pointInRect(x, y, menu.getBoundingClientRect(), MENU_REGION_MARGIN)) {
      _cancelBarSwitchTimer();
      return;
    }
  }

  const bar = document.getElementById('bookmarksBar');
  if (!bar || !_pointInRect(x, y, bar.getBoundingClientRect())) {
    // 离开收藏栏与菜单区域：只取消待切换，不关闭菜单（关闭归点击/键盘）
    _cancelBarSwitchTimer();
    return;
  }

  const hit = _findBarHitTarget(x, y);
  if (hit && hit.type === 'folder') {
    if (_currentDropdownFolderId === String(hit.id)) {
      _cancelBarSwitchTimer(); // 已打开的就是它
    } else {
      _scheduleBarSwitch(hit);
    }
  } else if (hit && hit.type === 'overflow') {
    const overflowOpen = _activeMenus.length > 0 && _currentDropdownFolderId === null;
    if (overflowOpen) {
      _cancelBarSwitchTimer();
    } else {
      _scheduleBarSwitch(hit);
    }
  } else {
    _cancelBarSwitchTimer(); // 书签项/空白区
  }
}

/**
 * document mousemove：悬浮切换入口（rAF 节流，无打开菜单时零开销早退）
 * @param {MouseEvent} e
 */
function _onBarHoverMouseMove(e) {
  if (_activeMenus.length === 0) return;
  // 拖拽期间 mousemove 本就停发（HTML5 DnD），此守卫兜底拖拽状态残留
  if (window.bookmarksBar && window.bookmarksBar.getDragState &&
      window.bookmarksBar.getDragState()) return;
  _barHoverX = e.clientX;
  _barHoverY = e.clientY;
  if (_barHoverRafId) return;
  _barHoverRafId = requestAnimationFrame(() => {
    _barHoverRafId = 0;
    if (_activeMenus.length === 0) return;
    _handleBarHoverTracking(_barHoverX, _barHoverY);
  });
}

document.addEventListener('mousemove', _onBarHoverMouseMove);

// ==================== 菜单容器管理 ====================

/**
 * 关闭所有活动菜单
 */
function closeAllMenus() {
  // 清除所有悬停定时器
  _hoverTimers.forEach((timer) => clearTimeout(timer));
  _hoverTimers.clear();

  // 清除悬浮切换定时器
  _cancelBarSwitchTimer();

  // 移除所有活动菜单 DOM，并清理 _submenu 引用
  _activeMenus.forEach((menu) => {
    if (menu._parentItem) {
      menu._parentItem._submenu = null;
      menu._parentItem = null;
    }
    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
    }
  });
  _activeMenus = [];
  _currentDropdownFolderId = null;
  _pinnedDragMenu = null;
  _pinnedDragMenuFolderId = null;

  // 移除遮罩层
  _removeBackdrop();
}

/**
 * 注册菜单到活动列表
 * @param {HTMLElement} menuEl - 菜单 DOM 元素
 */
function _registerMenu(menuEl) {
  _activeMenus.push(menuEl);
}

// ==================== 全屏遮罩层 ====================

/**
 * 创建全屏遮罩层，点击时关闭菜单
 * 遮罩层覆盖 webview 等不可冒泡区域，确保点击任意位置都能关闭菜单
 */
function _createBackdrop() {
  _removeBackdrop();
  const backdrop = document.createElement('div');
  backdrop.className = 'bookmarks-menu-backdrop';
  backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99990;background:transparent;';
  backdrop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 点击落点命中收藏栏文件夹/»按钮时直接切换到对应菜单（Chrome 式，
    // 省掉先关再开的第二次点击）；命中的就是当前打开者则维持 toggle 只关
    const hit = _findBarHitTarget(e.clientX, e.clientY);
    const hitIsCurrent = !!hit && (
      (hit.type === 'folder' && _currentDropdownFolderId === String(hit.id)) ||
      (hit.type === 'overflow' && _currentDropdownFolderId === null && _activeMenus.length > 0)
    );
    closeAllMenus();
    if (hit && !hitIsCurrent) {
      if (hit.type === 'folder') {
        showFolderMenu(hit.el, hit.id);
      } else if (hit.type === 'overflow' &&
          window.bookmarksBar && window.bookmarksBar.getOverflowItems) {
        const items = window.bookmarksBar.getOverflowItems();
        if (items.length > 0) showOverflowMenu(hit.el, items);
      }
    }
  });
  document.body.appendChild(backdrop);
  _menuBackdrop = backdrop;
}

/**
 * 移除全屏遮罩层
 */
function _removeBackdrop() {
  if (_menuBackdrop && _menuBackdrop.parentNode) {
    _menuBackdrop.parentNode.removeChild(_menuBackdrop);
  }
  _menuBackdrop = null;
}

// ==================== 导航辅助 ====================

/**
 * 处理收藏项点击导航
 * @param {string} url - 目标 URL
 * @param {MouseEvent} event - 鼠标事件
 */
function _handleMenuBookmarkClick(url, event) {
  if (!url) return;

  if (event.metaKey || event.ctrlKey) {
    if (typeof createTab === 'function') {
      createTab(state.currentContainer, url);
    }
    return;
  }

  const activeTabId = state.activeTabId;
  if (!activeTabId) return;

  const tab = state.tabs.get(activeTabId);
  const webview = state.webviews.get(activeTabId);
  if (webview) {
    // m3u8 视频文件在当前 webview tab 内用播放器页面播放（与地址栏导航一致）；
    // tab 持久化存原始 URL，did-navigate 也会回写该值
    const targetUrl = typeof maybePlayerUrl === 'function'
      ? maybePlayerUrl(url, tab && tab.containerId)
      : url;
    webview.loadURL(targetUrl);
    if (tab) {
      tab.url = url;
      window.realmAPI.updateTab(activeTabId, { url });
    }
  }
}

// ==================== 菜单定位 ====================

/**
 * 计算第一级下拉菜单的屏幕定位
 * @param {DOMRect} triggerRect - 触发元素的矩形
 * @param {number} menuWidth - 菜单宽度
 * @param {number} menuHeight - 菜单高度
 * @param {string} [preferredDirection='below'] - 优先方向：below 或 above
 * @returns {{left: number, top: number}}
 */
function _calculateMenuPosition(triggerRect, menuWidth, menuHeight, preferredDirection = 'below') {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = triggerRect.left;
  if (left + menuWidth > vw - MENU_EDGE_MARGIN) {
    left = Math.max(MENU_EDGE_MARGIN, triggerRect.right - menuWidth);
  }
  if (left < MENU_EDGE_MARGIN) {
    left = MENU_EDGE_MARGIN;
  }

  let top;
  const spaceBelow = vh - triggerRect.bottom - MENU_EDGE_MARGIN;
  const spaceAbove = triggerRect.top - MENU_EDGE_MARGIN;

  if (preferredDirection === 'below' && spaceBelow >= Math.min(menuHeight, 200)) {
    top = triggerRect.bottom + 4;
  } else if (spaceAbove >= Math.min(menuHeight, 200)) {
    top = triggerRect.top - menuHeight - 4;
  } else if (spaceBelow > spaceAbove) {
    top = triggerRect.bottom + 4;
  } else {
    top = Math.max(MENU_EDGE_MARGIN, triggerRect.top - menuHeight - 4);
  }

  return { left, top };
}

/**
 * 计算子菜单的屏幕定位（基于父菜单已知位置 + offsetTop）
 * @param {HTMLElement} folderItemEl - 父菜单项 DOM 元素
 * @param {number} menuWidth - 子菜单宽度
 * @returns {{left: number, top: number}}
 */
function _calculateSubmenuPosition(folderItemEl, menuWidth) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 父菜单就是 folderItemEl 的直接父元素（.bookmarks-dropdown 或 .bookmarks-submenu）
  const parentMenu = folderItemEl.parentNode;
  if (!parentMenu) {
    const rect = folderItemEl.getBoundingClientRect();
    return { left: rect.right + SUBMENU_OFFSET_X, top: rect.top + SUBMENU_OFFSET_Y };
  }

  // 父菜单的已知位置
  const parentLeft = parseFloat(parentMenu.style.left) || 0;
  const parentTop = parseFloat(parentMenu.style.top) || 0;
  const parentWidth = parseFloat(parentMenu.style.width) || parentMenu.offsetWidth;

  // 菜单项在父菜单中的相对位置
  const relativeTop = folderItemEl.offsetTop;

  // 计算子菜单位置：在父菜单右侧
  let left = parentLeft + parentWidth + SUBMENU_OFFSET_X;
  let top = parentTop + relativeTop + SUBMENU_OFFSET_Y;

  // 边界检查：如果右侧超出视口，放到左侧
  if (left + menuWidth > vw - MENU_EDGE_MARGIN) {
    const leftPos = parentLeft - menuWidth - SUBMENU_OFFSET_X;
    if (leftPos >= MENU_EDGE_MARGIN) {
      left = leftPos;
    } else {
      left = MENU_EDGE_MARGIN;
    }
  }

  // 垂直边界检查
  const menuHeight = folderItemEl._submenu ? folderItemEl._submenu.offsetHeight : 200;
  if (top + menuHeight > vh - MENU_EDGE_MARGIN) {
    top = Math.max(MENU_EDGE_MARGIN, vh - menuHeight - MENU_EDGE_MARGIN);
  }
  if (top < MENU_EDGE_MARGIN) {
    top = MENU_EDGE_MARGIN;
  }

  return { left, top };
}

/**
 * 递归关闭一个菜单及其内部所有嵌套子菜单
 * @param {HTMLElement} menuEl - 要关闭的菜单 DOM 元素
 */
function _closeMenuAndDescendants(menuEl) {
  if (!menuEl) return;
  // 先递归关闭此菜单内部所有项的子菜单
  const items = menuEl.querySelectorAll('.bookmarks-dropdown-item');
  items.forEach((item) => {
    if (item._submenu) {
      _closeMenuAndDescendants(item._submenu);
      const idx = _activeMenus.indexOf(item._submenu);
      if (idx !== -1) _activeMenus.splice(idx, 1);
      if (item._submenu.parentNode) {
        item._submenu.remove();
      }
      item._submenu = null;
    }
  });
  // 清理父项引用
  if (menuEl._parentItem) {
    menuEl._parentItem._submenu = null;
    menuEl._parentItem = null;
  }
  // 从 _activeMenus 中移除
  const idx = _activeMenus.indexOf(menuEl);
  if (idx !== -1) _activeMenus.splice(idx, 1);
  // 移除 DOM
  if (menuEl.parentNode) {
    menuEl.remove();
  }
}

/**
 * 关闭指定元素之外的所有同级子菜单（含级联关闭）
 * @param {HTMLElement} currentItem - 当前不需要关闭的项（可为 null 表示全部关闭）
 */
function _closeSiblingSubmenus(currentItem) {
  if (!currentItem || !currentItem.parentNode) return;
  const siblings = currentItem.parentNode.querySelectorAll('.bookmarks-dropdown-item');
  siblings.forEach((sib) => {
    if (sib === currentItem) return;
    if (sib._submenu) {
      _closeMenuAndDescendants(sib._submenu);
      sib._submenu = null;
    }
  });
}

// ==================== 文件夹下拉菜单 ====================

/**
 * 显示文件夹下拉菜单（支持 toggle：同一文件夹再次点击则关闭）
 * @param {HTMLElement} folderEl - 文件夹 DOM 元素（用于定位）
 * @param {number|string} folderId - 文件夹 ID
 * @param {Object} [options] - 选项
 * @param {boolean} [options.forDrag=false] - 拖拽模式：
 *   由拖拽悬停定时器触发。跳过遮罩层（遮罩会挡住收藏栏的 dragover，
 *   导致拖拽期间无法从菜单移回收藏栏），且已打开时不重复创建
 * @param {boolean} [options.forHover=false] - 悬浮切换模式：
 *   由悬浮切换定时器触发（仅已有菜单打开时）。目标菜单已打开则不动作
 *   （toggle 关闭仅归点击触发），其余与点击模式一致
 */
async function showFolderMenu(folderEl, folderId, options = {}) {
  const folderIdStr = String(folderId);
  const forDrag = !!(options && options.forDrag);
  const forHover = !!(options && options.forHover);

  // 触发元素已被移除（如拖拽 drop 后收藏栏重载）：放弃打开
  if (!folderEl.isConnected) return;

  // 拖拽模式：该文件夹菜单已打开（临时或固定源菜单）则不重复创建
  if (forDrag && _activeMenus.length > 0 &&
      (_currentDropdownFolderId === folderIdStr || _pinnedDragMenuFolderId === folderIdStr)) {
    return;
  }

  // 悬浮切换模式：目标菜单已打开则不动作
  if (forHover && _currentDropdownFolderId === folderIdStr) {
    return;
  }

  // Toggle：如果当前已打开同一文件夹的菜单，则关闭（点击模式）
  if (!forDrag && _currentDropdownFolderId === folderIdStr) {
    closeAllMenus();
    return;
  }

  // 菜单来源拖拽期间（有固定源菜单）：只关闭临时菜单，源菜单保持展开；
  // 其余情况全关（单菜单排他）
  if (_pinnedDragMenu) {
    closeTransientMenus();
  } else {
    closeAllMenus();
  }

  try {
    const [favorites, subFolders] = await Promise.all([
      window.realmAPI.bookmarksBar.listFavorites(folderId),
      window.realmAPI.bookmarksBar.listFolders(folderId),
    ]);

    if ((!favorites || favorites.length === 0) && (!subFolders || subFolders.length === 0)) {
      return;
    }

    const menu = _buildMenuContent(subFolders || [], favorites || [], false, folderId);
    document.body.appendChild(menu);
    _registerMenu(menu);

    // 创建遮罩层（拖拽模式跳过）
    if (!forDrag) {
      _createBackdrop();
    }

    // 定位
    const rect = folderEl.getBoundingClientRect();
    const menuWidth = Math.min(MENU_MAX_WIDTH, Math.max(MENU_MIN_WIDTH, menu.offsetWidth));
    const menuHeight = menu.offsetHeight;
    const pos = _calculateMenuPosition(rect, menuWidth, menuHeight, 'below');

    menu.style.left = pos.left + 'px';
    menu.style.top = pos.top + 'px';
    menu.style.width = menuWidth + 'px';

    requestAnimationFrame(() => {
      menu.classList.add('visible');
    });

    _currentDropdownFolderId = folderIdStr;
  } catch (err) {
    console.error('[Realm Renderer] 显示文件夹菜单失败:', err);
  }
}

/**
 * 显示子菜单（从右侧弹出）
 * @param {HTMLElement} folderItemEl - 子文件夹菜单项 DOM 元素
 * @param {number|string} subfolderId - 子文件夹 ID
 */
async function _showSubmenu(folderItemEl, subfolderId) {
  // 如果子菜单已经显示，不重复创建
  if (folderItemEl._submenu && folderItemEl._submenu.parentNode) {
    return;
  }

  try {
    const [favorites, subFolders] = await Promise.all([
      window.realmAPI.bookmarksBar.listFavorites(subfolderId),
      window.realmAPI.bookmarksBar.listFolders(subfolderId),
    ]);

    // 异步期间父菜单可能被关闭，检查 folderItemEl 是否还在 DOM 中
    if (!folderItemEl.parentNode) {
      return;
    }

    if ((!favorites || favorites.length === 0) && (!subFolders || subFolders.length === 0)) {
      return;
    }

    const submenu = _buildMenuContent(subFolders || [], favorites || [], true, subfolderId);
    // 挂载到 body，避免被父元素的 overflow/transform 裁剪
    document.body.appendChild(submenu);
    _registerMenu(submenu);
    folderItemEl._submenu = submenu;
    submenu._parentItem = folderItemEl;

    // 计算位置（基于父菜单已知位置，避免 getBoundingClientRect 误差）
    const menuWidth = Math.min(MENU_MAX_WIDTH, Math.max(MENU_MIN_WIDTH, submenu.offsetWidth));
    const pos = _calculateSubmenuPosition(folderItemEl, menuWidth);

    submenu.style.left = pos.left + 'px';
    submenu.style.top = pos.top + 'px';
    submenu.style.width = menuWidth + 'px';

    requestAnimationFrame(() => {
      submenu.classList.add('visible');
    });

    // 鼠标进入子菜单时取消关闭定时器（并向上清除整个链）
    submenu.addEventListener('mouseenter', () => {
      let m = submenu;
      while (m) {
        if (m._closeTimer) {
          clearTimeout(m._closeTimer);
          m._closeTimer = null;
        }
        m = m._parentItem ? m._parentItem.parentNode : null;
      }
    });

    // 鼠标离开子菜单时启动关闭定时器（级联关闭所有后代子菜单）
    submenu.addEventListener('mouseleave', () => {
      submenu._closeTimer = setTimeout(() => {
        _closeMenuAndDescendants(submenu);
      }, SUBMENU_CLOSE_DELAY);
    });
  } catch (err) {
    console.error('[Realm Renderer] 显示子菜单失败:', err);
  }
}

/**
 * 构建菜单内容容器
 * @param {Array} subFolders - 子文件夹列表
 * @param {Array} favorites - 收藏项列表
 * @param {boolean} [isSubmenu=false] - 是否为子菜单
 * @param {number|string} [folderId] - 菜单归属的文件夹 ID。
 *   传入时启用拖拽放置：菜单空白处松手 = 移入该文件夹；
 *   溢出菜单不传入，不参与拖拽放置
 * @returns {HTMLElement} 菜单 DOM 元素
 */
function _buildMenuContent(subFolders, favorites, isSubmenu = false, folderId) {
  const menu = document.createElement('div');
  menu.className = isSubmenu ? 'bookmarks-submenu' : 'bookmarks-dropdown';

  // ==================== 拖拽放置（容器级） ====================
  if (folderId !== undefined) {
    menu.dataset.folderId = String(folderId);
    // 文件夹边缘排序的兄弟上下文（含 sort_order），drop 时随 target 传给 executeDrop
    menu._subFolders = subFolders || [];

    // 菜单项作为拖拽源（拖出菜单/菜单内排序）
    menu.addEventListener('dragstart', _onMenuDragStart);

    menu.addEventListener('dragover', (e) => {
      if (!_isRealmDragMenu(e)) return;
      e.preventDefault();
      // 光标仍在菜单内：取消延迟关闭
      if (menu._dragCloseTimer) {
        clearTimeout(menu._dragCloseTimer);
        menu._dragCloseTimer = null;
      }
      // 光标在菜单空白处（非菜单项）时清除项高亮
      if (!e.target.closest('.bookmarks-dropdown-item')) {
        _clearMenuDragIndicators();
      }
    });

    menu.addEventListener('dragleave', (e) => {
      if (!_isRealmDragMenu(e)) return;
      // 固定源菜单拖出期间保持展开，不参与延迟关闭
      if (menu._pinnedDrag) return;
      const related = e.relatedTarget;
      if (related && menu.contains(related)) return;
      // 移入本菜单项的子菜单：不关闭
      const relatedSub = related && related.closest ? related.closest('.bookmarks-submenu') : null;
      if (relatedSub && relatedSub._parentItem && relatedSub._parentItem.parentNode === menu) return;
      // 光标离开菜单：延迟关闭（顶层菜单全关，子菜单只关自己）
      menu._dragCloseTimer = setTimeout(() => {
        menu._dragCloseTimer = null;
        if (menu.classList.contains('bookmarks-submenu')) {
          _closeMenuAndDescendants(menu);
          if (menu._parentItem && menu._parentItem._submenu === menu) {
            menu._parentItem._submenu = null;
          }
        } else {
          closeAllMenus();
        }
      }, SUBMENU_CLOSE_DELAY);
    });

    menu.addEventListener('drop', (e) => {
      if (!_isRealmDragMenu(e)) return;
      e.preventDefault();
      const drag = _getDragState();
      if (!drag) return;
      // 菜单空白处松手：移入该文件夹末尾（循环引用由 executeDrop 兜底）
      window.bookmarksBar.executeDrop(drag, { type: 'folder', id: folderId, position: 'on' });
    });
  }

  // 渲染子文件夹
  const itemsDraggable = folderId !== undefined;
  if (subFolders && subFolders.length > 0) {
    subFolders.forEach((folder) => {
      const item = _createFolderMenuItem(folder, itemsDraggable);
      menu.appendChild(item);
    });
  }

  // 添加分隔线
  if (subFolders && subFolders.length > 0 && favorites && favorites.length > 0) {
    const separator = document.createElement('div');
    separator.className = 'bookmarks-dropdown-separator';
    menu.appendChild(separator);
  }

  // 渲染子收藏项
  if (favorites && favorites.length > 0) {
    favorites.forEach((record) => {
      const item = _createBookmarkMenuItem(record, itemsDraggable);
      menu.appendChild(item);
    });
  }

  return menu;
}

/**
 * 创建收藏项菜单项 DOM
 * @param {Object} record - 收藏记录
 * @param {boolean} [draggable=false] - 是否可作为拖拽源（有归属文件夹的菜单才启用）
 * @returns {HTMLElement} 菜单项 DOM 元素
 */
function _createBookmarkMenuItem(record, draggable = false) {
  const item = document.createElement('div');
  item.className = 'bookmarks-dropdown-item';
  item.dataset.bookmarkId = record.id;
  if (draggable) item.draggable = true;

  // favicon 图片（兼容 favicon_url / faviconUrl）
  const faviconUrl = record.favicon_url || record.faviconUrl || '';
  // 调试：输出 favicon 数据，帮助确认数据库中是否有值
  if (faviconUrl) {
    console.log('[BookmarksBar] favicon found:', faviconUrl.substring(0, 60), 'for', record.title);
  }
  const favicon = document.createElement('img');
  favicon.className = 'bookmark-favicon';
  favicon.src = faviconUrl;
  favicon.alt = '';
  favicon.draggable = false; // 防止图片原生拖拽劫持菜单项拖拽
  favicon.onerror = function () {
    this.onerror = null;
    this.src = REALM_ICON_PATH_MENU;
  };
  if (!faviconUrl) {
    favicon.src = REALM_ICON_PATH_MENU;
  }

  // 标题
  const title = document.createElement('span');
  title.className = 'bookmark-title';
  title.textContent = record.title || record.url;

  item.appendChild(favicon);
  item.appendChild(title);

  // 点击导航
  item.addEventListener('click', (e) => {
    closeAllMenus();
    _handleMenuBookmarkClick(record.url, e);
  });

  // ==================== 拖拽放置 ====================
  // 拖到菜单内收藏项上：显示插入线，松手插入到该文件夹内的此位置

  item.addEventListener('dragover', (e) => {
    if (!_isRealmDragMenu(e)) return;
    const menuEl = item.closest('.bookmarks-dropdown, .bookmarks-submenu');
    if (!menuEl || menuEl.dataset.folderId === undefined) return;
    e.preventDefault();

    const drag = _getDragState();
    if (!drag) return;

    // 文件夹拖到书签旁：无排序语义；拖到自身：不可放置
    if (drag.type === 'folder' || String(drag.id) === String(record.id)) {
      e.dataTransfer.dropEffect = 'none';
      _clearMenuDragIndicators();
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    const rect = item.getBoundingClientRect();
    const position = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
    _clearMenuDragIndicators();
    item.classList.add(position === 'before' ? 'drag-over-top' : 'drag-over-bottom');
    item._dragDropPosition = position;
  });

  item.addEventListener('dragleave', (e) => {
    if (!_isRealmDragMenu(e)) return;
    const related = e.relatedTarget;
    if (related && item.contains(related)) return;
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  item.addEventListener('drop', (e) => {
    if (!_isRealmDragMenu(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const drag = _getDragState();
    if (!drag || drag.type !== 'bookmark') return;
    if (String(drag.id) === String(record.id)) return;
    const menuEl = item.closest('.bookmarks-dropdown, .bookmarks-submenu');
    const folderId = parseInt(menuEl.dataset.folderId, 10);
    window.bookmarksBar.executeDrop(drag, {
      type: 'favorite',
      id: record.id,
      folderId: Number.isFinite(folderId) ? folderId : 0,
      position: item._dragDropPosition || 'after',
    });
  });

  return item;
}

/**
 * 创建文件夹菜单项 DOM
 * @param {Object} folder - 文件夹数据
 * @param {boolean} [draggable=false] - 是否可作为拖拽源（有归属文件夹的菜单才启用）
 * @returns {HTMLElement} 菜单项 DOM 元素
 */
function _createFolderMenuItem(folder, draggable = false) {
  const item = document.createElement('div');
  item.className = 'bookmarks-dropdown-item bookmarks-folder-item';
  item.dataset.folderId = folder.id;
  if (draggable) item.draggable = true;

  // 文件夹图标
  const icon = document.createElement('div');
  icon.className = 'folder-icon';
  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>';

  // 文件夹名称
  const title = document.createElement('span');
  title.className = 'folder-title';
  title.textContent = folder.name;

  // 展开箭头
  const arrow = document.createElement('div');
  arrow.className = 'folder-arrow';
  arrow.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"></path></svg>';

  item.appendChild(icon);
  item.appendChild(title);
  item.appendChild(arrow);

  // 悬停展开子菜单（Chrome 风格）
  item.addEventListener('mouseenter', () => {
    // 清除自己和祖先的关闭定时器，防止父菜单被关闭
    if (item._submenu) {
      let m = item._submenu;
      while (m) {
        if (m._closeTimer) {
          clearTimeout(m._closeTimer);
          m._closeTimer = null;
        }
        m = m._parentItem ? m._parentItem.parentNode : null;
      }
    }

    // 如果子菜单已经显示，取消可能的关闭定时器即可
    if (item._submenu && item._submenu.parentNode) {
      return;
    }

    // 立即关闭同级其他子菜单（不要等 300ms 延迟），防止累加
    _closeSiblingSubmenus(item);

    const timer = setTimeout(() => {
      _showSubmenu(item, folder.id);
      _hoverTimers.delete(item);
    }, SUBMENU_HOVER_DELAY);
    _hoverTimers.set(item, timer);
  });

  item.addEventListener('mouseleave', () => {
    const timer = _hoverTimers.get(item);
    if (timer) {
      clearTimeout(timer);
      _hoverTimers.delete(item);
    }

    if (item._submenu) {
      item._submenu._closeTimer = setTimeout(() => {
        _closeMenuAndDescendants(item._submenu);
        item._submenu = null;
      }, SUBMENU_CLOSE_DELAY);
    }
  });

  // 点击只负责展开，不关闭已展开的子菜单（Chrome 风格）
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    // 如果已经展开，不做任何事（让 mouseleave 来关闭）
    if (item._submenu && item._submenu.parentNode) {
      return;
    }
    // 展开前先关闭同级其他子菜单
    _closeSiblingSubmenus(item);
    _showSubmenu(item, folder.id);
  });

  // ==================== 拖拽放置 ====================
  // 书签拖到文件夹项：整项为移入目标；文件夹拖到文件夹项：纵向三段式
  // （上 25% 排到前面 / 下 25% 排到后面 / 中间 50% 移入），与收藏夹页文件夹树同规则

  item.addEventListener('dragover', (e) => {
    if (!_isRealmDragMenu(e)) return;
    const menuEl = item.closest('.bookmarks-dropdown, .bookmarks-submenu');
    if (!menuEl || menuEl.dataset.folderId === undefined) return;
    e.preventDefault();

    const drag = _getDragState();
    if (!drag) return;

    // 放置位置：书签拖文件夹整项移入；文件夹拖文件夹三段式
    let position = 'on';
    if (drag.type === 'folder') {
      const rect = item.getBoundingClientRect();
      const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
      position = ratio < 0.25 ? 'before' : (ratio > 0.75 ? 'after' : 'on');
    }

    // 有效性（书签 id 与文件夹 id 分属两表，数值可能相同，判定必须按类型区分）：
    // 文件夹移入需环检测，边缘排序的目标父级不能是拖拽源自身或位于其子树内；
    // 书签移入任何文件夹项均有效（来源即目标 = 重排到末尾）
    const ownerFolderId = parseInt(menuEl.dataset.folderId, 10);
    let valid;
    if (drag.type === 'folder') {
      if (position === 'on') {
        valid = !(drag.id === folder.id ||
          window.bookmarksBar.isDescendantFolder(drag.id, folder.id));
      } else {
        valid = !(drag.id === folder.id ||
          drag.id === ownerFolderId ||
          window.bookmarksBar.isDescendantFolder(drag.id, ownerFolderId));
      }
    } else {
      valid = true;
    }
    if (!valid) {
      e.dataTransfer.dropEffect = 'none';
      _clearMenuDragIndicators();
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    _clearDragCloseTimers(item);
    _clearMenuDragIndicators();
    item.classList.add(
      position === 'on' ? 'drag-over-folder'
        : (position === 'before' ? 'drag-over-top' : 'drag-over-bottom')
    );

    // 悬停展开子菜单（仅移入位置展开，边缘排序语义是排序不展开；
    // 拖拽版定时器，与 mouseenter 的 _hoverTimers 独立）
    if (position === 'on' &&
        (!item._submenu || !item._submenu.parentNode) && !item._dragOpenTimer) {
      _closeSiblingSubmenus(item);
      item._dragOpenTimer = setTimeout(() => {
        item._dragOpenTimer = null;
        _showSubmenu(item, folder.id);
      }, SUBMENU_HOVER_DELAY);
    }
  });

  item.addEventListener('dragleave', (e) => {
    if (!_isRealmDragMenu(e)) return;
    const related = e.relatedTarget;
    const submenu = item._submenu;
    const inSubmenu = submenu && related && submenu.contains(related);
    if (related && (item.contains(related) || inSubmenu)) return;
    item.classList.remove('drag-over-folder', 'drag-over-top', 'drag-over-bottom');
    if (item._dragOpenTimer) {
      clearTimeout(item._dragOpenTimer);
      item._dragOpenTimer = null;
    }
    // 光标彻底离开（且不在子菜单内）时宽限关闭子菜单，与 mouseleave 行为一致
    if (submenu && submenu.parentNode && !inSubmenu) {
      submenu._closeTimer = setTimeout(() => {
        _closeMenuAndDescendants(submenu);
        if (item._submenu === submenu) item._submenu = null;
      }, SUBMENU_CLOSE_DELAY);
    }
  });

  item.addEventListener('drop', (e) => {
    if (!_isRealmDragMenu(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (item._dragOpenTimer) {
      clearTimeout(item._dragOpenTimer);
      item._dragOpenTimer = null;
    }
    const drag = _getDragState();
    if (!drag) return;

    // 与 dragover 同规则重算放置位置
    const menuEl = item.closest('.bookmarks-dropdown, .bookmarks-submenu');
    const ownerFolderId = menuEl ? parseInt(menuEl.dataset.folderId, 10) : 0;
    let position = 'on';
    if (drag.type === 'folder') {
      const rect = item.getBoundingClientRect();
      const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
      position = ratio < 0.25 ? 'before' : (ratio > 0.75 ? 'after' : 'on');
    }

    if (position === 'on') {
      if (drag.type === 'folder' &&
          (drag.id === folder.id || window.bookmarksBar.isDescendantFolder(drag.id, folder.id))) return;
      window.bookmarksBar.executeDrop(drag, { type: 'folder', id: folder.id, position: 'on' });
    } else {
      // 同父级内排序（跨父级移动由 executeDrop 处理）
      if (drag.id === folder.id) return;
      if (drag.id === ownerFolderId ||
          window.bookmarksBar.isDescendantFolder(drag.id, ownerFolderId)) return;
      window.bookmarksBar.executeDrop(drag, {
        type: 'folder',
        id: folder.id,
        position,
        parentId: ownerFolderId,
        siblings: (menuEl && menuEl._subFolders) || [],
      });
    }
  });

  return item;
}

// ==================== 溢出菜单 ====================

/**
 * 显示溢出菜单
 * @param {HTMLElement} overflowBtn - 溢出按钮 DOM 元素
 * @param {Array} overflowItems - 溢出的收藏项数据（新格式：{type, data}）
 */
async function showOverflowMenu(overflowBtn, overflowItems) {
  closeAllMenus();

  if (!overflowItems || overflowItems.length === 0) return;

  const menu = document.createElement('div');
  menu.className = 'bookmarks-dropdown';

  // 分离文件夹和收藏项
  const folders = overflowItems.filter((item) => item.type === 'folder');
  const bookmarks = overflowItems.filter((item) => item.type === 'bookmark');

  // 渲染文件夹
  if (folders.length > 0) {
    folders.forEach((item) => {
      const el = _createFolderMenuItem(item.data);
      menu.appendChild(el);
    });
  }

  // 添加分隔线
  if (folders.length > 0 && bookmarks.length > 0) {
    const separator = document.createElement('div');
    separator.className = 'bookmarks-dropdown-separator';
    menu.appendChild(separator);
  }

  // 渲染收藏项
  if (bookmarks.length > 0) {
    bookmarks.forEach((item) => {
      const el = _createBookmarkMenuItem(item.data);
      menu.appendChild(el);
    });
  }

  if (menu.children.length === 0) return;

  document.body.appendChild(menu);
  _registerMenu(menu);

  // 创建遮罩层
  _createBackdrop();

  // 定位：右对齐按钮
  const rect = overflowBtn.getBoundingClientRect();
  const menuWidth = Math.min(MENU_MAX_WIDTH, Math.max(MENU_MIN_WIDTH, menu.offsetWidth));
  const menuHeight = menu.offsetHeight;

  // 优先右对齐按钮，若超出左边界则左对齐
  let left = rect.right - menuWidth;
  if (left < MENU_EDGE_MARGIN) {
    left = MENU_EDGE_MARGIN;
  }

  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight - MENU_EDGE_MARGIN) {
    top = Math.max(MENU_EDGE_MARGIN, rect.top - menuHeight - 4);
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.width = menuWidth + 'px';

  requestAnimationFrame(() => {
    menu.classList.add('visible');
  });
}

// ==================== 全局事件监听 ====================

/**
 * 点击外部区域关闭菜单
 * 注意：webview 内部点击不会冒泡到此处，由遮罩层处理
 */
document.addEventListener('mousedown', (e) => {
  const clickedInMenu = _activeMenus.some(
    (menu) => menu.contains(e.target) || menu === e.target
  );
  const clickedFolder = e.target.closest('.bookmark-folder');

  if (!clickedInMenu && !clickedFolder) {
    closeAllMenus();
  }
});

/**
 * ESC 键关闭所有菜单
 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllMenus();
  }
});

// ==================== 暴露全局接口 ====================

window.bookmarksBarMenu = {
  showFolderMenu,
  showOverflowMenu,
  closeAllMenus,
  isOverMenu,
  hasOpenMenus,
  getOpenMenuFolderId,
  getPinnedDragMenuFolderId,
  closeTransientMenus,
  endDragPin,
  refreshOpenMenus,
};

/**
 * Realm Browser - 收藏栏下拉菜单模块
 *
 * 实现收藏栏的下拉菜单交互：
 * - 文件夹下拉菜单（显示子收藏项和子文件夹）
 * - 子菜单悬停展开（300ms 延迟，右侧弹出）
 * - 溢出菜单（» 按钮，显示溢出的收藏项）
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

// ==================== 状态 ====================

/** 当前打开的菜单列表 */
let _activeMenus = [];

/** 子菜单悬停定时器 Map */
let _hoverTimers = new Map();

/** 当前打开的第一级下拉菜单对应的文件夹 ID（用于 toggle 逻辑） */
let _currentDropdownFolderId = null;

/** 全屏遮罩层元素 */
let _menuBackdrop = null;

// ==================== 菜单容器管理 ====================

/**
 * 关闭所有活动菜单
 */
function closeAllMenus() {
  // 清除所有悬停定时器
  _hoverTimers.forEach((timer) => clearTimeout(timer));
  _hoverTimers.clear();

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
    closeAllMenus();
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
 */
async function showFolderMenu(folderEl, folderId) {
  const folderIdStr = String(folderId);

  // Toggle：如果当前已打开同一文件夹的菜单，则关闭
  if (_currentDropdownFolderId === folderIdStr) {
    closeAllMenus();
    return;
  }

  closeAllMenus();

  try {
    const [favorites, subFolders] = await Promise.all([
      window.realmAPI.bookmarksBar.listFavorites(folderId),
      window.realmAPI.bookmarksBar.listFolders(folderId),
    ]);

    if ((!favorites || favorites.length === 0) && (!subFolders || subFolders.length === 0)) {
      return;
    }

    const menu = _buildMenuContent(subFolders || [], favorites || []);
    document.body.appendChild(menu);
    _registerMenu(menu);

    // 创建遮罩层
    _createBackdrop();

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

    const submenu = _buildMenuContent(subFolders || [], favorites || [], true);
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
 * @returns {HTMLElement} 菜单 DOM 元素
 */
function _buildMenuContent(subFolders, favorites, isSubmenu = false) {
  const menu = document.createElement('div');
  menu.className = isSubmenu ? 'bookmarks-submenu' : 'bookmarks-dropdown';

  // 渲染子文件夹
  if (subFolders && subFolders.length > 0) {
    subFolders.forEach((folder) => {
      const item = _createFolderMenuItem(folder);
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
      const item = _createBookmarkMenuItem(record);
      menu.appendChild(item);
    });
  }

  return menu;
}

/**
 * 创建收藏项菜单项 DOM
 * @param {Object} record - 收藏记录
 * @returns {HTMLElement} 菜单项 DOM 元素
 */
function _createBookmarkMenuItem(record) {
  const item = document.createElement('div');
  item.className = 'bookmarks-dropdown-item';

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

  return item;
}

/**
 * 创建文件夹菜单项 DOM
 * @param {Object} folder - 文件夹数据
 * @returns {HTMLElement} 菜单项 DOM 元素
 */
function _createFolderMenuItem(folder) {
  const item = document.createElement('div');
  item.className = 'bookmarks-dropdown-item bookmarks-folder-item';

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
};

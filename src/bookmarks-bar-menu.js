/**
 * Realm Browser - 收藏栏下拉菜单模块
 *
 * 实现收藏栏的下拉菜单交互：
 * - 文件夹下拉菜单（显示子收藏项和子文件夹）
 * - 子菜单悬停展开（300ms 延迟，右侧弹出）
 * - 溢出菜单（>> 按钮，显示溢出的收藏项）
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
 * 防止收藏项标题注入恶意 HTML/JS
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
const MENU_MAX_WIDTH = 300;

// ==================== 状态 ====================

/**
 * 当前打开的菜单列表
 * @type {HTMLElement[]}
 */
let _activeMenus = [];

/**
 * 子菜单悬停定时器 Map
 * @type {Map<HTMLElement, number>}
 */
let _hoverTimers = new Map();

/**
 * 子菜单关闭定时器
 * @type {number|null}
 */
let _closeTimer = null;

// ==================== 菜单容器管理 ====================

/**
 * 关闭所有活动菜单
 * 移除所有活动菜单 DOM，清除所有悬停定时器
 */
function closeAllMenus() {
  // 清除所有悬停定时器
  _hoverTimers.forEach((timer) => clearTimeout(timer));
  _hoverTimers.clear();

  // 清除关闭定时器
  if (_closeTimer) {
    clearTimeout(_closeTimer);
    _closeTimer = null;
  }

  // 移除所有活动菜单 DOM
  _activeMenus.forEach((menu) => {
    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
    }
  });
  _activeMenus = [];
}

/**
 * 注册菜单到活动列表
 * @param {HTMLElement} menuEl - 菜单 DOM 元素
 */
function _registerMenu(menuEl) {
  _activeMenus.push(menuEl);
}

// ==================== 导航辅助 ====================

/**
 * 处理收藏项点击导航
 * - 普通点击：在当前活动标签页的 webview 中导航
 * - Cmd/Ctrl+Click：在新标签页打开
 * @param {string} url - 目标 URL
 * @param {MouseEvent} event - 鼠标事件
 */
function _handleMenuBookmarkClick(url, event) {
  if (!url) return;

  // Cmd（Mac）或 Ctrl（Windows/Linux）+ 点击 → 新标签页打开
  if (event.metaKey || event.ctrlKey) {
    if (typeof createTab === 'function') {
      createTab(state.currentContainer, url);
    }
    return;
  }

  // 普通点击：在当前标签页的 webview 中导航
  const activeTabId = state.activeTabId;
  if (!activeTabId) return;

  const webview = state.webviews.get(activeTabId);
  if (webview) {
    webview.loadURL(url);
  }
}

// ==================== 文件夹下拉菜单 ====================

/**
 * 显示文件夹下拉菜单
 * 获取子收藏项和子文件夹，渲染下拉菜单
 * @param {HTMLElement} folderEl - 文件夹 DOM 元素（用于定位）
 * @param {number|string} folderId - 文件夹 ID
 */
async function showFolderMenu(folderEl, folderId) {
  // 先关闭已有菜单
  closeAllMenus();

  try {
    // 并行获取子收藏项和子文件夹
    const [favorites, subFolders] = await Promise.all([
      window.realmAPI.bookmarksBar.listFavorites(folderId),
      window.realmAPI.bookmarksBar.listFolders(folderId),
    ]);

    // 检查是否有内容
    if ((!favorites || favorites.length === 0) && (!subFolders || subFolders.length === 0)) {
      return; // 空文件夹不显示菜单
    }

    // 创建下拉菜单容器
    const menu = document.createElement('div');
    menu.className = 'bookmarks-dropdown';

    // 渲染子文件夹（如果有）
    if (subFolders && subFolders.length > 0) {
      subFolders.forEach((folder) => {
        const item = _createFolderMenuItem(folder);
        menu.appendChild(item);
      });
    }

    // 添加分隔线（如果同时有文件夹和收藏项）
    if (subFolders && subFolders.length > 0 && favorites && favorites.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'bookmarks-dropdown-separator';
      menu.appendChild(separator);
    }

    // 渲染子收藏项（如果有）
    if (favorites && favorites.length > 0) {
      favorites.forEach((record) => {
        const item = _createBookmarkMenuItem(record);
        menu.appendChild(item);
      });
    }

    // 定位菜单（挂载到 body 确保 z-index 不受父元素影响）
    document.body.appendChild(menu);
    _registerMenu(menu);

    // 计算位置
    const rect = folderEl.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 2;

    // 边界检查：防止超出右边界
    if (left + MENU_MAX_WIDTH > window.innerWidth) {
      left = window.innerWidth - MENU_MAX_WIDTH - 8;
    }

    // 边界检查：防止超出底部
    const menuHeight = menu.offsetHeight;
    if (top + menuHeight > window.innerHeight) {
      top = rect.top - menuHeight - 2;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // 下一帧添加 visible 类触发动画
    requestAnimationFrame(() => {
      menu.classList.add('visible');
    });
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
  // 移除已有的子菜单
  const existingSubmenu = folderItemEl.querySelector('.bookmarks-submenu');
  if (existingSubmenu) {
    existingSubmenu.remove();
  }

  try {
    // 获取子文件夹的内容
    const [favorites, subFolders] = await Promise.all([
      window.realmAPI.bookmarksBar.listFavorites(subfolderId),
      window.realmAPI.bookmarksBar.listFolders(subfolderId),
    ]);

    // 检查是否有内容
    if ((!favorites || favorites.length === 0) && (!subFolders || subFolders.length === 0)) {
      return; // 空文件夹不显示子菜单
    }

    // 创建子菜单容器
    const submenu = document.createElement('div');
    submenu.className = 'bookmarks-submenu';

    // 渲染子文件夹
    if (subFolders && subFolders.length > 0) {
      subFolders.forEach((folder) => {
        const item = _createFolderMenuItem(folder);
        submenu.appendChild(item);
      });
    }

    // 添加分隔线
    if (subFolders && subFolders.length > 0 && favorites && favorites.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'bookmarks-dropdown-separator';
      submenu.appendChild(separator);
    }

    // 渲染子收藏项
    if (favorites && favorites.length > 0) {
      favorites.forEach((record) => {
        const item = _createBookmarkMenuItem(record);
        submenu.appendChild(item);
      });
    }

    // 添加到文件夹项
    folderItemEl.appendChild(submenu);
    _registerMenu(submenu);

    // 鼠标进入子菜单时取消关闭定时器
    submenu.addEventListener('mouseenter', () => {
      if (_closeTimer) {
        clearTimeout(_closeTimer);
        _closeTimer = null;
      }
    });

    // 鼠标离开子菜单时启动关闭定时器
    submenu.addEventListener('mouseleave', () => {
      _closeTimer = setTimeout(() => {
        submenu.remove();
        // 从活动菜单列表中移除
        const idx = _activeMenus.indexOf(submenu);
        if (idx !== -1) _activeMenus.splice(idx, 1);
      }, SUBMENU_CLOSE_DELAY);
    });
  } catch (err) {
    console.error('[Realm Renderer] 显示子菜单失败:', err);
  }
}

/**
 * 创建收藏项菜单项 DOM
 * @param {Object} record - 收藏记录
 * @param {number} record.id - 收藏 ID
 * @param {string} record.url - 页面 URL
 * @param {string} record.title - 页面标题
 * @param {string} [record.favicon_url] - favicon URL
 * @returns {HTMLElement} 菜单项 DOM 元素
 */
function _createBookmarkMenuItem(record) {
  const item = document.createElement('div');
  item.className = 'bookmarks-dropdown-item';

  // favicon 图片
  const favicon = document.createElement('img');
  favicon.className = 'bookmark-favicon';
  favicon.src = record.favicon_url || '';
  favicon.alt = '';
  favicon.onerror = function () {
    this.onerror = null; // 防止循环
    this.src = REALM_ICON_PATH_MENU;
  };
  if (!record.favicon_url) {
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
 * @param {number} folder.id - 文件夹 ID
 * @param {string} folder.name - 文件夹名称
 * @returns {HTMLElement} 菜单项 DOM 元素
 */
function _createFolderMenuItem(folder) {
  const item = document.createElement('div');
  item.className = 'bookmarks-dropdown-item bookmarks-folder-item';

  // 文件夹图标
  const icon = document.createElement('div');
  icon.className = 'folder-icon';
  icon.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

  // 文件夹名称
  const title = document.createElement('span');
  title.className = 'folder-title';
  title.textContent = folder.name;

  // 展开箭头
  const arrow = document.createElement('div');
  arrow.className = 'folder-arrow';
  arrow.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>';

  item.appendChild(icon);
  item.appendChild(title);
  item.appendChild(arrow);

  // 悬停展开子菜单（per D-05）
  item.addEventListener('mouseenter', () => {
    // 清除关闭定时器
    if (_closeTimer) {
      clearTimeout(_closeTimer);
      _closeTimer = null;
    }

    // 启动悬停定时器
    const timer = setTimeout(() => {
      _showSubmenu(item, folder.id);
      _hoverTimers.delete(item);
    }, SUBMENU_HOVER_DELAY);
    _hoverTimers.set(item, timer);
  });

  item.addEventListener('mouseleave', () => {
    // 清除悬停定时器
    const timer = _hoverTimers.get(item);
    if (timer) {
      clearTimeout(timer);
      _hoverTimers.delete(item);
    }

    // 启动关闭定时器（如果鼠标移出且没有进入子菜单）
    _closeTimer = setTimeout(() => {
      const submenu = item.querySelector('.bookmarks-submenu');
      if (submenu) {
        submenu.remove();
        const idx = _activeMenus.indexOf(submenu);
        if (idx !== -1) _activeMenus.splice(idx, 1);
      }
    }, SUBMENU_CLOSE_DELAY);
  });

  return item;
}

// ==================== 溢出菜单 ====================

/**
 * 显示溢出菜单
 * @param {HTMLElement} overflowBtn - 溢出按钮 DOM 元素
 * @param {Array} overflowItems - 溢出的收藏项数据
 */
async function showOverflowMenu(overflowBtn, overflowItems) {
  // 先关闭已有菜单
  closeAllMenus();

  if (!overflowItems || overflowItems.length === 0) return;

  try {
    // 创建下拉菜单容器
    const menu = document.createElement('div');
    menu.className = 'bookmarks-dropdown';

    // 分离文件夹和收藏项
    const folders = overflowItems.filter((item) => item.folderId !== '');
    const bookmarks = overflowItems.filter((item) => item.folderId === '');

    // 渲染文件夹
    if (folders.length > 0) {
      // 需要获取文件夹的完整数据
      const folderTree = await window.realmAPI.bookmarksBar.getFolderTree();
      const rootFolders = folderTree.filter(
        (f) => !f.parent_id || f.parent_id === 0
      );

      // 匹配溢出的文件夹
      for (const overflowFolder of folders) {
        const folderData = rootFolders.find(
          (f) => String(f.id) === String(overflowFolder.folderId)
        );
        if (folderData) {
          const item = _createFolderMenuItem(folderData);
          menu.appendChild(item);
        }
      }
    }

    // 添加分隔线
    if (folders.length > 0 && bookmarks.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'bookmarks-dropdown-separator';
      menu.appendChild(separator);
    }

    // 渲染收藏项
    if (bookmarks.length > 0) {
      // 获取收藏项的完整数据
      const allFavorites = await window.realmAPI.bookmarksBar.listFavorites(0);
      const favoriteMap = new Map();
      allFavorites.forEach((fav) => favoriteMap.set(String(fav.id), fav));

      for (const overflowBookmark of bookmarks) {
        const bookmarkData = favoriteMap.get(String(overflowBookmark.index));
        if (bookmarkData) {
          const item = _createBookmarkMenuItem(bookmarkData);
          menu.appendChild(item);
        }
      }
    }

    // 如果菜单为空则不显示
    if (menu.children.length === 0) return;

    // 定位菜单
    document.body.appendChild(menu);
    _registerMenu(menu);

    // 计算位置（向左对齐，防止超出右边界）
    const rect = overflowBtn.getBoundingClientRect();
    let left = rect.right - MENU_MAX_WIDTH;
    let top = rect.bottom + 2;

    // 边界检查
    if (left < 8) left = 8;
    if (left + MENU_MAX_WIDTH > window.innerWidth) {
      left = window.innerWidth - MENU_MAX_WIDTH - 8;
    }

    // 边界检查：防止超出底部
    const menuHeight = menu.offsetHeight;
    if (top + menuHeight > window.innerHeight) {
      top = rect.top - menuHeight - 2;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // 下一帧添加 visible 类触发动画
    requestAnimationFrame(() => {
      menu.classList.add('visible');
    });
  } catch (err) {
    console.error('[Realm Renderer] 显示溢出菜单失败:', err);
  }
}

// ==================== 全局事件监听 ====================

/**
 * 点击外部区域关闭菜单
 */
document.addEventListener('mousedown', (e) => {
  // 检查点击是否在菜单外部
  const clickedInMenu = _activeMenus.some(
    (menu) => menu.contains(e.target) || menu === e.target
  );
  // 检查点击是否在收藏栏文件夹上（避免点击文件夹时关闭菜单再重新打开）
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

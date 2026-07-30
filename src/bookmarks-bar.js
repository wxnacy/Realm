/**
 * Realm Browser - 收藏栏组件
 *
 * Chrome 风格收藏栏，显示根目录收藏项和文件夹
 * 支持点击导航、溢出计算（>> 按钮）、favicon 降级
 *
 * 使用方式：
 *   window.bookmarksBar.load()      - 加载并渲染收藏栏
 *   window.bookmarksBar.recalculate() - 重新计算溢出
 */

// ==================== XSS 防御 ====================

/**
 * HTML 转义函数（T-18-01 安全要求）
 * 防止收藏项标题注入恶意 HTML/JS
 * @param {string} text - 原始文本
 * @returns {string} 转义后的安全文本
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 常量 ====================

/** Realm 应用图标路径（favicon 降级用，per D-09） */
const REALM_ICON_PATH = '../icons/icon.png';

/** 溢出按钮宽度（px），用于计算可用宽度 */
const OVERFLOW_BTN_WIDTH = 32;

// ==================== 状态 ====================

/** 收藏栏溢出项数据（供后续 Plan 使用） */
let overflowItems = [];

/** ResizeObserver 实例 */
let resizeObserver = null;

// ==================== 核心函数 ====================

/**
 * 加载收藏栏数据并渲染
 * 获取根目录收藏项（folderId=0）和文件夹树的根级文件夹
 */
async function loadBookmarksBar() {
  try {
    const [favorites, folderTree] = await Promise.all([
      window.realmAPI.bookmarksBar.listFavorites(0),
      window.realmAPI.bookmarksBar.getFolderTree(),
    ]);

    // 从文件夹树中提取根级文件夹（parentId = 0 或 null）
    const rootFolders = folderTree.filter(f => !f.parent_id || f.parent_id === 0);

    renderBookmarksBar(favorites || [], rootFolders || []);
  } catch (err) {
    console.error('[Realm Renderer] 加载收藏栏失败:', err);
  }
}

/**
 * 渲染收藏栏内容
 * 先渲染文件夹再渲染收藏项（Chrome 顺序）
 * @param {Array} favorites - 根目录收藏项列表
 * @param {Array} folders - 根级文件夹列表
 */
function renderBookmarksBar(favorites, folders) {
  const list = document.getElementById('bookmarksBarList');
  if (!list) return;

  // 清空现有内容
  list.innerHTML = '';

  // 先渲染文件夹
  folders.forEach(folder => {
    const el = createFolderItem(folder);
    list.appendChild(el);
  });

  // 再渲染收藏项
  favorites.forEach(record => {
    const el = createBookmarkItem(record);
    list.appendChild(el);
  });

  // 渲染完成后计算溢出
  requestAnimationFrame(() => {
    calculateOverflow();
  });
}

/**
 * 创建收藏项 DOM 元素
 * @param {Object} record - 收藏记录
 * @param {number} record.id - 收藏 ID
 * @param {string} record.url - 页面 URL
 * @param {string} record.title - 页面标题
 * @param {string} [record.favicon_url] - favicon URL
 * @returns {HTMLElement} 收藏项 DOM 元素
 */
function createBookmarkItem(record) {
  const item = document.createElement('div');
  item.className = 'bookmark-item';
  item.dataset.url = record.url;
  item.title = record.title || record.url;

  // favicon 图片（D-09：加载失败时降级到 Realm 图标）
  const favicon = document.createElement('img');
  favicon.className = 'bookmark-favicon';
  favicon.src = record.favicon_url || '';
  favicon.alt = '';
  favicon.onerror = function() {
    this.onerror = null; // 防止循环
    this.src = REALM_ICON_PATH;
  };
  // 无 favicon 时直接使用降级图标
  if (!record.favicon_url) {
    favicon.src = REALM_ICON_PATH;
  }

  // 标题（XSS 安全：使用 textContent）
  const title = document.createElement('span');
  title.className = 'bookmark-title';
  title.textContent = record.title || record.url;

  item.appendChild(favicon);
  item.appendChild(title);

  // 点击导航
  item.addEventListener('click', (e) => {
    handleBookmarkClick(record.url, e);
  });

  return item;
}

/**
 * 创建文件夹项 DOM 元素
 * 点击和悬停交互在 Plan 02 实现，本 task 仅创建占位 DOM
 * @param {Object} folder - 文件夹数据
 * @param {number} folder.id - 文件夹 ID
 * @param {string} folder.name - 文件夹名称
 * @returns {HTMLElement} 文件夹项 DOM 元素
 */
function createFolderItem(folder) {
  const item = document.createElement('div');
  item.className = 'bookmark-folder';
  item.dataset.folderId = folder.id;
  item.title = folder.name;

  // 文件夹图标（SVG）
  const icon = document.createElement('div');
  icon.className = 'folder-icon';
  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

  // 文件夹名称
  const title = document.createElement('span');
  title.className = 'folder-title';
  title.textContent = folder.name;

  // 展开箭头
  const arrow = document.createElement('div');
  arrow.className = 'folder-arrow';
  arrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>';

  item.appendChild(icon);
  item.appendChild(title);
  item.appendChild(arrow);

  // Plan 02 实现点击展开下拉菜单

  return item;
}

/**
 * 处理收藏项点击导航
 * - 普通点击：在当前活动标签页的 webview 中导航
 * - Cmd/Ctrl+Click：在新标签页打开
 * @param {string} url - 目标 URL
 * @param {MouseEvent} event - 鼠标事件
 */
function handleBookmarkClick(url, event) {
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

// ==================== 溢出计算 ====================

/**
 * 计算收藏栏溢出
 * 测量每项宽度，超出可用宽度的项隐藏，>> 按钮显示/隐藏
 */
function calculateOverflow() {
  const list = document.getElementById('bookmarksBarList');
  const overflowBtn = document.getElementById('bookmarksOverflowBtn');
  if (!list || !overflowBtn) return;

  const containerWidth = list.clientWidth;
  const items = list.children;
  let usedWidth = 0;
  overflowItems = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // 确保项可见以测量宽度
    item.style.display = '';
    const itemWidth = item.offsetWidth;

    if (usedWidth + itemWidth > containerWidth - OVERFLOW_BTN_WIDTH) {
      // 超出可用宽度，隐藏该项
      item.style.display = 'none';
      overflowItems.push({
        index: i,
        url: item.dataset.url || '',
        folderId: item.dataset.folderId || '',
        title: item.title || '',
      });
    } else {
      usedWidth += itemWidth;
    }
  }

  // 显示/隐藏 >> 按钮
  if (overflowItems.length > 0) {
    overflowBtn.classList.add('visible');
  } else {
    overflowBtn.classList.remove('visible');
  }
}

/**
 * 初始化 ResizeObserver 监听收藏栏尺寸变化
 */
function initResizeObserver() {
  const list = document.getElementById('bookmarksBarList');
  if (!list) return;

  // 清理旧的 observer
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  resizeObserver = new ResizeObserver(() => {
    calculateOverflow();
  });

  resizeObserver.observe(list);
}

// ==================== 初始化 ====================

/**
 * 初始化收藏栏
 * 绑定事件监听，加载数据，设置 ResizeObserver
 */
function initBookmarksBar() {
  // 窗口 resize 时重新计算溢出
  window.addEventListener('resize', () => {
    calculateOverflow();
  });

  // 初始化 ResizeObserver
  initResizeObserver();
}

// ==================== 暴露全局接口 ====================

window.bookmarksBar = {
  load: loadBookmarksBar,
  recalculate: calculateOverflow,
  init: initBookmarksBar,
};

/**
 * Realm Browser - 收藏栏组件
 *
 * Chrome 风格收藏栏，显示根目录收藏项和文件夹
 * 支持点击导航、溢出计算（» 按钮）、favicon 降级
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

/** 溢出按钮预留宽度（px） */
const OVERFLOW_BTN_WIDTH = 30;

/** 收藏栏列表 gap（px），与 CSS 保持一致 */
const LIST_GAP = 0;

/** 收藏栏 padding 总和（px）：padding: 0 6px */
const BAR_PADDING_TOTAL = 12;

// ==================== 状态 ====================

/** 收藏栏溢出项数据 */
let overflowItems = [];

/** ResizeObserver 实例 */
let resizeObserver = null;

/** 收藏栏完整数据缓存（用于溢出菜单） */
let barData = { folders: [], favorites: [] };

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

    // 缓存完整数据
    barData.folders = rootFolders || [];
    barData.favorites = favorites || [];

    // 调试：输出第一个收藏项的完整字段，确认 favicon 数据是否存在
    if (favorites && favorites.length > 0) {
      console.log('[BookmarksBar] First record keys:', Object.keys(favorites[0]));
      console.log('[BookmarksBar] First record:', JSON.stringify(favorites[0], null, 2));
    }

    renderBookmarksBar(barData.favorites, barData.folders);
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

  // 渲染完成后计算溢出（双重 rAF 确保布局完成）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      calculateOverflow();
    });
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
  item.dataset.type = 'bookmark';
  item.dataset.url = record.url;
  item.dataset.bookmarkId = record.id;
  item.dataset.bookmarkUrl = record.url;
  item.dataset.bookmarkTitle = record.title || record.url;
  item.title = record.title || record.url;

  // favicon 图片（D-09：加载失败时降级到 Realm 图标）
  // 兼容 favicon_url / faviconUrl 两种字段名
  const faviconUrl = record.favicon_url || record.faviconUrl || '';
  // 调试：输出 favicon 数据，帮助确认数据库中是否有值
  if (faviconUrl) {
    console.log('[BookmarksBar] favicon found:', faviconUrl.substring(0, 60), 'for', record.title);
  }
  const favicon = document.createElement('img');
  favicon.className = 'bookmark-favicon';
  favicon.src = faviconUrl;
  favicon.alt = '';
  favicon.onerror = function() {
    this.onerror = null;
    this.src = REALM_ICON_PATH;
  };
  if (!faviconUrl) {
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
 * @param {Object} folder - 文件夹数据
 * @param {number} folder.id - 文件夹 ID
 * @param {string} folder.name - 文件夹名称
 * @returns {HTMLElement} 文件夹项 DOM 元素
 */
function createFolderItem(folder) {
  const item = document.createElement('div');
  item.className = 'bookmark-folder';
  item.dataset.type = 'folder';
  item.dataset.folderId = folder.id;
  item.dataset.folderName = folder.name;
  item.title = folder.name;

  // 文件夹图标（SVG）- Chrome 风格黄色文件夹
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

  // 点击展开下拉菜单
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.bookmarksBarMenu) {
      window.bookmarksBarMenu.showFolderMenu(item, folder.id);
    }
  });

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
 * 测量每项宽度，超出可用宽度的项隐藏，» 按钮显示/隐藏
 *
 * 关键修复：使用 bookmarksBar 的 getBoundingClientRect 获取可靠宽度，
 * 避免 clientWidth 在 flex 布局初始化时为 0 或极小值导致全隐藏。
 */
function calculateOverflow() {
  const bar = document.getElementById('bookmarksBar');
  const list = document.getElementById('bookmarksBarList');
  const overflowBtn = document.getElementById('bookmarksOverflowBtn');
  if (!bar || !list || !overflowBtn) return;

  const items = Array.from(list.children);
  if (items.length === 0) {
    overflowBtn.classList.remove('visible');
    return;
  }

  // 使用 bookmarksBar 的精确宽度（比 list.clientWidth 更可靠）
  const barRect = bar.getBoundingClientRect();
  const containerWidth = barRect.width - BAR_PADDING_TOTAL;
  const availableWidth = Math.max(0, containerWidth - OVERFLOW_BTN_WIDTH);

  // 保护：可用宽度不足一个最小项宽度时，不隐藏任何项
  // 这防止了初始化时宽度为极小正值（如 2px）导致几乎全部隐藏
  const MIN_ITEM_WIDTH = 30;
  if (availableWidth < MIN_ITEM_WIDTH) {
    // 宽度未就绪，直接返回，不隐藏任何项
    // ResizeObserver 会在宽度变化时自动重新计算
    return;
  }

  // 第一步：确保所有项可见，以便测量真实宽度
  items.forEach(item => {
    item.style.display = '';
    item.style.visibility = 'visible';
  });

  // 第二步：计算总宽度，找出溢出点（一旦某项溢出，其后所有项都隐藏）
  let usedWidth = 0;
  let overflowStartIndex = -1;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rect = item.getBoundingClientRect();
    const itemWidth = rect.width + LIST_GAP;

    if (usedWidth + itemWidth > availableWidth && i > 0) {
      overflowStartIndex = i;
      break;
    }
    usedWidth += itemWidth;
  }

  // 第三步：隐藏溢出项并收集数据
  overflowItems = [];
  if (overflowStartIndex !== -1) {
    for (let i = overflowStartIndex; i < items.length; i++) {
      const item = items[i];
      item.style.display = 'none';

      const type = item.dataset.type;
      if (type === 'folder') {
        const folderId = item.dataset.folderId;
        const folder = barData.folders.find(f => String(f.id) === String(folderId));
        if (folder) {
          overflowItems.push({ type: 'folder', data: folder });
        }
      } else {
        const bookmarkId = item.dataset.bookmarkId;
        const bookmark = barData.favorites.find(f => String(f.id) === String(bookmarkId));
        if (bookmark) {
          overflowItems.push({ type: 'bookmark', data: bookmark });
        }
      }
    }
  }

  // 显示/隐藏 » 按钮
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
  const bar = document.getElementById('bookmarksBar');
  if (!bar) return;

  // 清理旧的 observer
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  resizeObserver = new ResizeObserver(() => {
    calculateOverflow();
  });

  // 观察整个收藏栏（确保宽度变化都被捕获）
  resizeObserver.observe(bar);
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

  // 绑定溢出按钮点击事件
  const overflowBtn = document.getElementById('bookmarksOverflowBtn');
  if (overflowBtn) {
    overflowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.bookmarksBarMenu) {
        window.bookmarksBarMenu.showOverflowMenu(overflowBtn, overflowItems);
      }
    });
  }

  // 初始化 ResizeObserver
  initResizeObserver();
}

// ==================== 暴露全局接口 ====================

window.bookmarksBar = {
  load: loadBookmarksBar,
  recalculate: calculateOverflow,
  init: initBookmarksBar,
};

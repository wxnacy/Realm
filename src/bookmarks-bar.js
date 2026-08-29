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

/** 拖拽数据 MIME（自定义类型，不设 text/plain：防止误拖入 webview 触发页面导航） */
const BOOKMARK_DRAG_MIME = 'application/x-realm-bookmark';

/** 拖拽悬停文件夹后展开下拉的延迟（ms） */
const DRAG_FOLDER_OPEN_DELAY = 600;

// ==================== 状态 ====================

/** 收藏栏溢出项数据 */
let overflowItems = [];

/** ResizeObserver 实例 */
let resizeObserver = null;

/** 收藏栏完整数据缓存（用于溢出菜单与拖拽目标计算） */
let barData = { folders: [], favorites: [], folderTree: [] };

/** 当前拖拽状态：{ type: 'bookmark'|'folder', id, sourceEl }，非拖拽时为 null */
let _dragState = null;

/** 拖拽悬停展开下拉的定时器 */
let _dragOpenTimer = null;

/** 悬停展开定时器对应的目标文件夹 ID */
let _dragOpenFolderId = null;

/** 拖拽高亮元素列表（清理用） */
let _dragHighlightEls = [];

/** 上一帧 dragover 的目标标识（dragover 高频触发，避免重复处理） */
let _lastHoverKey = null;

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

    // 缓存完整数据（folderTree 供拖拽环检测使用）
    barData.folderTree = folderTree || [];
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
  item.draggable = true;

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
  favicon.draggable = false; // 防止图片原生拖拽劫持收藏项拖拽
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
  item.draggable = true;

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

// ==================== 拖拽与移入文件夹 ====================

/**
 * 判断事件是否携带本模块的拖拽数据类型
 * @param {DragEvent} e - 拖拽事件
 * @returns {boolean}
 */
function _isRealmDrag(e) {
  return !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes(BOOKMARK_DRAG_MIME));
}

/**
 * 判断 targetId 是否位于 sourceId 的子树内（不含自身）
 * 基于 loadBookmarksBar 缓存的完整文件夹树遍历
 * @param {number} sourceId - 源文件夹 ID
 * @param {number} targetId - 目标文件夹 ID
 * @returns {boolean}
 */
function isDescendantFolder(sourceId, targetId) {
  const tree = barData.folderTree || [];

  let sourceNode = null;
  const findNode = (nodes) => {
    for (const n of nodes) {
      if (String(n.id) === String(sourceId)) {
        sourceNode = n;
        return true;
      }
      if (n.children && findNode(n.children)) return true;
    }
    return false;
  };
  if (!findNode(tree) || !sourceNode) return false;

  const stack = [...(sourceNode.children || [])];
  while (stack.length) {
    const n = stack.pop();
    if (String(n.id) === String(targetId)) return true;
    if (n.children) stack.push(...n.children);
  }
  return false;
}

/**
 * 清除拖拽高亮元素
 */
function _clearDragHighlights() {
  _dragHighlightEls.forEach((el) => {
    el.classList.remove('drag-over-folder', 'drag-over-top', 'drag-over-bottom');
  });
  _dragHighlightEls = [];
}

/**
 * 清除悬停展开定时器
 */
function _clearDragOpenTimer() {
  if (_dragOpenTimer) {
    clearTimeout(_dragOpenTimer);
    _dragOpenTimer = null;
  }
  _dragOpenFolderId = null;
}

/**
 * 计算收藏栏项上的拖放位置（横向三段式）
 * 左 25% = before，右 25% = after，中间 50% = on
 * @param {DragEvent} e - 拖拽事件
 * @param {HTMLElement} itemEl - 目标项元素
 * @returns {string} 'before' | 'after' | 'on'
 */
function _getBarDropPosition(e, itemEl) {
  const rect = itemEl.getBoundingClientRect();
  const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return 'on';
}

/**
 * 计算书签项上的插入位置（左右对半）
 * @param {DragEvent} e - 拖拽事件
 * @param {HTMLElement} itemEl - 目标项元素
 * @returns {string} 'before' | 'after'
 */
function _getInsertPosition(e, itemEl) {
  const rect = itemEl.getBoundingClientRect();
  return (e.clientX - rect.left) < rect.width / 2 ? 'before' : 'after';
}

/**
 * 收藏栏 dragstart：记录拖拽源，设置自定义 MIME 数据
 * @param {DragEvent} e - 拖拽事件
 */
function _onBarDragStart(e) {
  const itemEl = e.target.closest('.bookmark-item, .bookmark-folder');
  if (!itemEl) return;

  const isFolder = itemEl.dataset.type === 'folder';
  const id = parseInt(isFolder ? itemEl.dataset.folderId : itemEl.dataset.bookmarkId, 10);
  if (!Number.isFinite(id)) return;

  _dragState = { type: isFolder ? 'folder' : 'bookmark', id, folderId: 0, sourceEl: itemEl };
  _lastHoverKey = null;

  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData(BOOKMARK_DRAG_MIME, JSON.stringify({ type: _dragState.type, id }));

  // 拖拽开始时收起已打开的菜单
  if (window.bookmarksBarMenu) window.bookmarksBarMenu.closeAllMenus();

  // dragend 绑在源元素上：drop 后广播触发重载会把源元素从 DOM 移除，
  // 委托在 list 上的 dragend 收不到 detached 元素的事件
  itemEl.addEventListener('dragend', _onBarDragEnd, { once: true });

  requestAnimationFrame(() => {
    if (_dragState && _dragState.sourceEl === itemEl) itemEl.classList.add('dragging');
  });
}

/**
 * 菜单模块调起拖拽（菜单项作为拖拽源）
 * 与栏内 dragstart 的区别：不关闭菜单——源菜单在拖出期间保持展开（Chrome 式）
 * @param {{type: string, id: number, folderId: number}} dragState - 拖拽源（folderId 为来源文件夹）
 * @param {HTMLElement} sourceEl - 源菜单项元素
 */
function beginMenuDrag(dragState, sourceEl) {
  _dragState = { ...dragState, sourceEl, fromMenu: true };
  _lastHoverKey = null;

  // dragend 绑在源元素上：drop 后广播重载会移除菜单 DOM，
  // detached 元素收不到委托事件（与栏内拖拽同理）
  sourceEl.addEventListener('dragend', _onBarDragEnd, { once: true });

  requestAnimationFrame(() => {
    if (_dragState && _dragState.sourceEl === sourceEl) sourceEl.classList.add('dragging');
  });
}

/**
 * 收藏栏 dragover：计算放置目标，更新高亮与悬停展开定时器
 * @param {DragEvent} e - 拖拽事件
 */
function _onBarDragOver(e) {
  if (!_isRealmDrag(e)) return;
  e.preventDefault();

  const drag = _dragState;
  if (!drag) return;

  const itemEl = e.target.closest('.bookmark-item, .bookmark-folder');

  // 光标明确移到「其他收藏项」上时才收起菜单，并重置悬停键。
  // 两处豁免防弹窗闪烁：
  // 1. 源文件夹本身——菜单弹出时光标仍停在它上面，立即关会被悬停
  //    定时器再次打开，造成反复开关
  // 2. 列表空白区——「源文件夹 → 菜单」之间有几像素缝隙会落到 blank，
  //    穿越时立即关会打断移入菜单；停在空白区也不视为离开
  if (window.bookmarksBarMenu && window.bookmarksBarMenu.hasOpenMenus() &&
      itemEl && !window.bookmarksBarMenu.isOverMenu(e.target)) {
    const isFolderItem = itemEl.dataset.type === 'folder';
    const itemId = isFolderItem ? String(itemEl.dataset.folderId) : null;
    if (drag.fromMenu) {
      // 菜单来源拖拽：固定的源菜单保持展开（Chrome 式），
      // 只关闭悬停产生的临时菜单（如目标文件夹展开的下拉）
      const pinnedId = window.bookmarksBarMenu.getPinnedDragMenuFolderId();
      const transientId = window.bookmarksBarMenu.getOpenMenuFolderId();
      const keep = isFolderItem &&
        (itemId === String(pinnedId) || itemId === String(transientId));
      if (!keep) {
        window.bookmarksBarMenu.closeTransientMenus();
        _lastHoverKey = null;
      }
    } else {
      const openFolderId = window.bookmarksBarMenu.getOpenMenuFolderId();
      const overMenuOwner = isFolderItem && itemId === String(openFolderId);
      if (!overMenuOwner) {
        window.bookmarksBarMenu.closeAllMenus();
        _lastHoverKey = null;
      }
    }
  }
  if (!itemEl) {
    // 空白区：允许放置（追加到栏尾），无高亮
    e.dataTransfer.dropEffect = 'move';
    if (_lastHoverKey !== 'bar') {
      _lastHoverKey = 'bar';
      _clearDragHighlights();
      _clearDragOpenTimer();
    }
    return;
  }

  const isFolderTarget = itemEl.dataset.type === 'folder';
  const targetId = parseInt(isFolderTarget ? itemEl.dataset.folderId : itemEl.dataset.bookmarkId, 10);

  // 非法目标：拖到自身，或文件夹拖到自己后代
  const isSelfOrDescendant = drag.type === 'folder' && isFolderTarget &&
    (drag.id === targetId || isDescendantFolder(drag.id, targetId));
  const isSelfBookmark = drag.type === 'bookmark' && !isFolderTarget && drag.id === targetId;
  if (isSelfOrDescendant || isSelfBookmark) {
    e.dataTransfer.dropEffect = 'none';
    if (_lastHoverKey !== `invalid:${targetId}`) {
      _lastHoverKey = `invalid:${targetId}`;
      _clearDragHighlights();
      _clearDragOpenTimer();
    }
    return;
  }

  // 计算放置位置
  let position;
  if (isFolderTarget) {
    // 书签拖到文件夹：整项都是移入目标；文件夹拖到文件夹：三段式（边排序/中移入）
    position = drag.type === 'bookmark' ? 'on' : _getBarDropPosition(e, itemEl);
  } else {
    if (drag.type === 'folder') {
      // folders-first 渲染下，文件夹拖到书签旁无排序语义
      e.dataTransfer.dropEffect = 'none';
      if (_lastHoverKey !== `invalid:${targetId}`) {
        _lastHoverKey = `invalid:${targetId}`;
        _clearDragHighlights();
        _clearDragOpenTimer();
      }
      return;
    }
    position = _getInsertPosition(e, itemEl);
  }

  const hoverKey = `${itemEl.dataset.type}:${targetId}:${position}`;
  if (hoverKey === _lastHoverKey) return;
  _lastHoverKey = hoverKey;

  _clearDragHighlights();
  _clearDragOpenTimer();

  if (position === 'on') {
    e.dataTransfer.dropEffect = 'move';
    itemEl.classList.add('drag-over-folder');
    _dragHighlightEls = [itemEl];

    // 悬停一会儿展开该文件夹的下拉，可继续放入子文件夹
    _dragOpenFolderId = targetId;
    _dragOpenTimer = setTimeout(() => {
      _dragOpenTimer = null;
      if (window.bookmarksBarMenu) {
        window.bookmarksBarMenu.showFolderMenu(itemEl, _dragOpenFolderId, { forDrag: true });
      }
    }, DRAG_FOLDER_OPEN_DELAY);
  } else {
    e.dataTransfer.dropEffect = 'move';
    itemEl.classList.add(position === 'before' ? 'drag-over-top' : 'drag-over-bottom');
    _dragHighlightEls = [itemEl];
  }
}

/**
 * 收藏栏 dragleave：光标离开收藏栏时清理高亮与定时器
 * @param {DragEvent} e - 拖拽事件
 */
function _onBarDragLeave(e) {
  if (!_isRealmDrag(e)) return;
  const related = e.relatedTarget;
  // 仍在收藏栏列表内（子元素间移动）或进入菜单时不清理
  if (related && related.closest && (related.closest('#bookmarksBarList') || window.bookmarksBarMenu.isOverMenu(related))) {
    return;
  }
  _clearDragHighlights();
  _clearDragOpenTimer();
  _lastHoverKey = null;
}

/**
 * 收藏栏 drop：计算放置目标并执行移动/排序
 * @param {DragEvent} e - 拖拽事件
 */
function _onBarDrop(e) {
  if (!_isRealmDrag(e)) return;
  e.preventDefault();

  const drag = _dragState;
  _clearDragHighlights();
  _clearDragOpenTimer();
  _lastHoverKey = null;
  if (!drag) return;

  const itemEl = e.target.closest('.bookmark-item, .bookmark-folder');
  if (!itemEl) {
    // 空白区：追加到栏尾对应分段
    executeDrop(drag, { type: 'append-bar' });
    return;
  }

  const isFolderTarget = itemEl.dataset.type === 'folder';
  const targetId = parseInt(isFolderTarget ? itemEl.dataset.folderId : itemEl.dataset.bookmarkId, 10);

  if (drag.type === 'folder' && isFolderTarget &&
    (drag.id === targetId || isDescendantFolder(drag.id, targetId))) return;
  if (drag.type === 'bookmark' && !isFolderTarget && drag.id === targetId) return;

  let position;
  if (isFolderTarget) {
    position = drag.type === 'bookmark' ? 'on' : _getBarDropPosition(e, itemEl);
  } else {
    if (drag.type === 'folder') return;
    position = _getInsertPosition(e, itemEl);
  }

  executeDrop(drag, {
    type: isFolderTarget ? 'folder' : 'favorite',
    id: targetId,
    position,
  });
}

/**
 * 拖拽结束（含取消）：清理拖拽状态
 *
 * 菜单来源的拖拽菜单保持展开：未放置 = 原样保留（Chrome 式）；
 * 已放置 = 由 executeDrop 触发 refreshOpenMenus 原地刷新内容。
 * 栏内来源维持原行为（dragstart 时已关菜单，dragend 兜底清理）。
 */
function _onBarDragEnd() {
  const fromMenu = !!(_dragState && _dragState.fromMenu);
  if (_dragState && _dragState.sourceEl) {
    _dragState.sourceEl.classList.remove('dragging');
  }
  _dragState = null;
  _lastHoverKey = null;
  _clearDragHighlights();
  _clearDragOpenTimer();
  if (window.bookmarksBarMenu) {
    if (fromMenu) {
      window.bookmarksBarMenu.endDragPin();
    } else {
      window.bookmarksBarMenu.closeAllMenus();
    }
  }
}

/**
 * 执行收藏栏拖放（对外入口）
 *
 * 菜单来源的拖拽放置后，打开的菜单保持展开并原地刷新内容（Chrome 式实时反馈）。
 *
 * @param {{type: string, id: number, folderId: number, fromMenu?: boolean}} drag - 拖拽源
 * @param {Object} target - 放置目标（格式见 applyDrop）
 */
async function executeDrop(drag, target) {
  if (!drag) return;
  try {
    await applyDrop(drag, target);
  } catch (err) {
    console.error('[BookmarksBar] 拖放操作失败:', err);
  }
  if (drag.fromMenu && window.bookmarksBarMenu && window.bookmarksBarMenu.refreshOpenMenus) {
    try {
      await window.bookmarksBarMenu.refreshOpenMenus();
    } catch (err) {
      console.error('[BookmarksBar] 刷新打开的菜单失败:', err);
    }
  }
}

/**
 * 执行收藏栏拖放的数据操作（栏内目标与菜单内目标共用）
 *
 * 目标格式：
 * - { type: 'append-bar' }                                        追加到栏尾（书签→收藏段末尾，文件夹→文件夹段末尾）
 * - { type: 'folder', id, position: 'on' }                        移入该文件夹末尾（含来源即目标 = 重排到末尾）
 * - { type: 'folder', id, position: 'before'|'after',             文件夹段内排序（siblings/parentId 未传时为收藏栏根级）
 *     parentId?, siblings? }
 * - { type: 'favorite', id, folderId, position: 'before'|'after' } 插入到 folderId 内目标收藏项前/后
 *
 * 移动/排序成功后由主进程广播 bookmarks-bar:refresh 触发各窗口收藏栏重载。
 *
 * @param {{type: string, id: number, folderId: number}} drag - 拖拽源
 * @param {Object} target - 放置目标
 */
async function applyDrop(drag, target) {
  if (!drag) return;
  try {
    if (target.type === 'append-bar') {
      if (drag.type === 'folder') {
        await window.realmAPI.moveFavoriteFolder(drag.id, 0);
      } else {
        await window.realmAPI.moveFavoriteInto(drag.id, 0);
      }
      return;
    }

    if (target.type === 'folder' && target.position === 'on') {
      // 拖到文件夹项 = 移入该文件夹末尾；来源即目标文件夹 = 重排到末尾
      // （此前按 no-op 短路，导致「只有文件夹的子文件夹」没有可命中的移入放置区）
      if (drag.type === 'folder') {
        if (drag.id === target.id || isDescendantFolder(drag.id, target.id)) return;
        await window.realmAPI.moveFavoriteFolder(drag.id, target.id);
      } else {
        await window.realmAPI.moveFavoriteInto(drag.id, target.id);
      }
      return;
    }

    if (target.type === 'folder') {
      // 文件夹段内排序：目标前后邻居之间插值（siblings 未传时为收藏栏根级）
      const parentId = target.parentId !== undefined ? target.parentId : 0;
      // 目标父级不能是拖拽源自身或位于其子树内（拖到自己的子文件夹中排序）
      if (drag.type === 'folder' &&
          (drag.id === parentId || isDescendantFolder(drag.id, parentId))) return;
      const source = target.siblings || barData.folders;
      const others = source.filter((f) => String(f.id) !== String(drag.id));
      const idx = others.findIndex((f) => String(f.id) === String(target.id));
      if (idx === -1) return;
      const beforeKey = target.position === 'before'
        ? (idx > 0 ? others[idx - 1].sort_order : null)
        : others[idx].sort_order;
      const afterKey = target.position === 'before'
        ? others[idx].sort_order
        : (idx < others.length - 1 ? others[idx + 1].sort_order : null);
      // 跨父级先移动（如子文件夹拖出到收藏栏变根级），再写插入位置排序键
      if ((drag.folderId || 0) !== parentId) {
        await window.realmAPI.moveFavoriteFolder(drag.id, parentId);
      }
      const keys = await window.realmAPI.computeFavoriteSortKeys(beforeKey, afterKey, 1);
      await window.realmAPI.updateFavoriteFolderSort(drag.id, keys[0]);
      return;
    }

    // 收藏项：插入到 target.folderId 内目标收藏项前/后
    if (drag.type !== 'bookmark') return;
    const folderId = target.folderId !== undefined ? target.folderId : 0;
    const list = await window.realmAPI.bookmarksBar.listFavorites(folderId);
    const others = list.filter((r) => String(r.id) !== String(drag.id));
    const idx = others.findIndex((r) => String(r.id) === String(target.id));
    if (idx === -1) return;
    const beforeKey = target.position === 'before'
      ? (idx > 0 ? others[idx - 1].sort_order : null)
      : others[idx].sort_order;
    const afterKey = target.position === 'before'
      ? others[idx].sort_order
      : (idx < others.length - 1 ? others[idx + 1].sort_order : null);
    const keys = await window.realmAPI.computeFavoriteSortKeys(beforeKey, afterKey, 1);
    // 来源文件夹与目标不同才移动（菜单项拖出到栏/其他文件夹的跨层场景）
    if ((drag.folderId || 0) !== folderId) {
      await window.realmAPI.moveFavorite(drag.id, folderId);
    }
    await window.realmAPI.updateFavoriteSort(drag.id, keys[0]);
  } catch (err) {
    console.error('[BookmarksBar] 拖放操作失败:', err);
  }
}

/**
 * 初始化收藏栏拖拽事件（事件委托在列表容器上）
 */
function initBookmarksBarDrag() {
  const list = document.getElementById('bookmarksBarList');
  if (!list) return;

  list.addEventListener('dragenter', (e) => {
    if (_isRealmDrag(e)) e.preventDefault();
  });
  list.addEventListener('dragstart', _onBarDragStart);
  list.addEventListener('dragover', _onBarDragOver);
  list.addEventListener('dragleave', _onBarDragLeave);
  list.addEventListener('drop', _onBarDrop);
}



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

  // 初始化拖拽（移入文件夹 / 栏内排序）
  initBookmarksBarDrag();
}

// ==================== 暴露全局接口 ====================

window.bookmarksBar = {
  load: loadBookmarksBar,
  recalculate: calculateOverflow,
  init: initBookmarksBar,
  /** 供菜单模块拖拽放置时调用 */
  executeDrop,
  /** 供菜单模块调起拖拽（菜单项作为拖拽源） */
  beginMenuDrag,
  /** 供菜单模块读取当前拖拽源（环检测/类型判断用） */
  getDragState: () => _dragState,
  /** 供菜单模块悬浮切换溢出菜单时读取当前溢出项 */
  getOverflowItems: () => overflowItems,
  isDescendantFolder,
};

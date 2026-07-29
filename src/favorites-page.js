/**
 * Realm Browser - 收藏夹页面逻辑
 *
 * realm://favorites 内部页面的渲染逻辑
 * 负责收藏列表展示、搜索过滤（含高亮）、
 * 行内编辑标题、单条删除、批量删除、滚动加载、空状态显示、
 * 拖拽排序（同目录排序 + 跨文件夹移动）
 */

// ==================== 状态管理 ====================

// 页面运行在 webview guest 中，IPC 会被主进程 assertTrustedSender（CR-4）拒绝，
// 因此数据访问走本地 HTTP 服务器的 /api/favorites/* 端点。
// 容器 ID 和 API token 由渲染进程创建 webview 时注入 URL 查询参数。
const pageParams = new URLSearchParams(window.location.search);

/**
 * 页面状态对象
 * @type {Object}
 */
const state = {
  /** 已加载的收藏记录 */
  records: [],
  /** 搜索关键词 */
  keyword: '',
  /** 分页偏移量 */
  offset: 0,
  /** 每页数量 */
  limit: 50,
  /** 是否正在加载 */
  loading: false,
  /** 是否还有更多数据 */
  hasMore: true,
  /** 已选中的记录 ID 集合 */
  selectedIds: new Set(),
  /** 是否全选状态 */
  selectAll: false,
  /** 当前文件夹 ID（0 = 根目录） */
  currentFolderId: 0,
  /** 文件夹树数据 */
  folderTree: [],
  /** 当前展开的文件夹 ID 集合 */
  expandedFolders: new Set(),
  /** 内部剪贴板（剪切/复制） */
  clipboard: null,
  /** 当前显示的右键菜单元素 */
  contextMenuEl: null,
  /** 拖拽源数据 */
  dragSourceData: null,
};

/** API token（来自 URL 查询参数） */
const apiToken = pageParams.get('token') || '';

/**
 * 调用收藏夹 HTTP API
 * @param {string} route - API 路由（如 'list'、'delete'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function favoritesApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/favorites/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`收藏夹 API 请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 获取文件夹树
 * @returns {Promise<Array>} 文件夹树数组，错误时返回空数组
 */
async function fetchFolderTree() {
  try {
    return await favoritesApi('folder-tree');
  } catch (err) {
    console.error('[Realm Favorites] 获取文件夹树失败:', err);
    return [];
  }
}

/**
 * 创建文件夹
 * @param {string} name - 文件夹名称
 * @param {number} parentId - 父文件夹 ID（0 表示根目录）
 * @returns {Promise<Object>} 创建结果
 */
async function createFolderApi(name, parentId) {
  return favoritesApi('create-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
}

/**
 * 重命名文件夹
 * @param {number} id - 文件夹 ID
 * @param {string} name - 新名称
 * @returns {Promise<Object>} 更新结果
 */
async function renameFolderApi(id, name) {
  return favoritesApi('rename-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name }),
  });
}

/**
 * 删除文件夹
 * @param {number} id - 文件夹 ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteFolderApi(id) {
  return favoritesApi('delete-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
const elements = {
  favoritesPage: document.querySelector('.favorites-page'),
  searchInput: document.getElementById('searchInput'),
  favoritesContent: document.getElementById('favoritesContent'),
  actionsBar: document.getElementById('actionsBar'),
  selectAllCheckbox: document.getElementById('selectAllCheckbox'),
  selectedCount: document.getElementById('selectedCount'),
  deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  favoritesBatchDeleteModal: document.getElementById('favoritesBatchDeleteModal'),
  batchDeleteBody: document.getElementById('batchDeleteBody'),
  cancelBatchDeleteBtn: document.getElementById('cancelBatchDeleteBtn'),
  confirmBatchDeleteBtn: document.getElementById('confirmBatchDeleteBtn'),
  toast: document.getElementById('toast'),
  folderTree: document.getElementById('folderTree'),
  breadcrumb: document.getElementById('breadcrumb'),
  addFolderBtn: document.getElementById('addFolderBtn'),
};

// ==================== 工具函数 ====================

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟毫秒数
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 转义 HTML 特殊字符（防 XSS）
 * @param {string} text - 原始文本
 * @returns {string} 转义后的安全文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 高亮搜索关键词
 * @param {string} text - 原始文本
 * @param {string} keyword - 搜索关键词
 * @returns {string} 包含高亮 HTML 的文本
 */
function highlightText(text, keyword) {
  if (!keyword) return escapeHtml(text);

  const escaped = escapeHtml(text);
  const escapedKeyword = escapeHtml(keyword);
  // 对关键词中的正则特殊字符进行转义
  const regex = new RegExp(
    '(' + escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')',
    'gi'
  );
  return escaped.replace(regex, '<span class="favorites-highlight">$1</span>');
}

/**
 * 格式化时间
 * @param {string|number} timestamp - 时间戳或 ISO 字符串
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  if (date.getTime() >= todayStart) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } else if (date.getTime() >= yesterdayStart) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}

// ==================== 拖拽辅助函数 ====================

/**
 * 通过主进程 HTTP 端点计算 fractional indexing 排序键
 *
 * fractional-indexing 库仅在主进程中使用，前端通过 HTTP 端点获取排序键，
 * 避免前端引入额外 npm 依赖。
 *
 * @param {string|null} beforeKey - 前一个位置的排序键（null 表示最前）
 * @param {string|null} afterKey - 后一个位置的排序键（null 表示最后）
 * @param {number} count - 需要生成的排序键数量
 * @returns {Promise<string[]>} 排序键数组
 */
async function computeSortKeys(beforeKey, afterKey, count) {
  const result = await favoritesApi('compute-sort-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beforeKey, afterKey, count }),
  });
  return result.keys;
}

/**
 * 判断拖拽位置（目标元素的上半部分或下半部分）
 *
 * @param {MouseEvent} e - 鼠标事件
 * @param {HTMLElement} targetEl - 目标元素
 * @returns {'before'|'after'} 'before' 表示插入到目标之前，'after' 表示插入到目标之后
 */
function getDragPosition(e, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  return e.clientY < midY ? 'before' : 'after';
}

/**
 * 检查目标文件夹是否是源文件夹的后代（防止循环引用）
 *
 * 复用 Phase 14 的循环引用检测逻辑，在渲染进程中使用 state.folderTree 数据判断，
 * 避免 IPC 调用。
 *
 * @param {number} sourceId - 源文件夹 ID
 * @param {number} targetId - 目标文件夹 ID
 * @returns {boolean} 是否会形成循环
 */
function isDescendantCheck(sourceId, targetId) {
  if (sourceId === targetId) return true;

  // 递归查找文件夹
  function findFolder(id, tree) {
    for (const folder of tree) {
      if (folder.id === id) return folder;
      if (folder.children) {
        const found = findFolder(id, folder.children);
        if (found) return found;
      }
    }
    return null;
  }

  // 从 targetId 开始向上遍历祖先链
  let currentId = targetId;
  const maxDepth = 100;
  let depth = 0;

  while (currentId !== 0 && depth < maxDepth) {
    const folder = findFolder(currentId, state.folderTree);
    if (!folder) break;
    if (folder.parent_id === sourceId) return true;
    currentId = folder.parent_id;
    depth++;
  }

  return false;
}

// ==================== 渲染函数 ====================

/**
 * 渲染收藏列表
 * @param {Array} records - 收藏记录数组
 */
function renderFavorites(records) {
  elements.favoritesContent.innerHTML = '';

  if (records.length === 0) {
    renderEmpty();
    return;
  }

  for (const record of records) {
    const itemEl = renderFavoriteItem(record);
    elements.favoritesContent.appendChild(itemEl);
  }
}

/**
 * 渲染空状态
 */
function renderEmpty() {
  elements.favoritesContent.innerHTML = '';

  const emptyEl = document.createElement('div');
  emptyEl.className = 'favorites-empty';

  let title = '暂无收藏';
  let body = '点击工具栏星标按钮收藏当前页面';

  // 搜索无结果时的提示
  if (state.keyword) {
    title = '没有找到匹配的收藏';
    body = '尝试使用其他关键词搜索';
  }

  emptyEl.innerHTML = `
    <div class="favorites-empty-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
    </div>
    <div class="favorites-empty-text">${title}</div>
    <div class="favorites-empty-hint">${body}</div>
  `;

  elements.favoritesContent.appendChild(emptyEl);
}

/**
 * 渲染单条收藏项
 * @param {Object} record - 收藏记录对象
 * @returns {HTMLElement} 记录 DOM 元素
 */
function renderFavoriteItem(record) {
  const itemEl = document.createElement('div');
  itemEl.className = 'favorite-item';
  itemEl.dataset.id = record.id;
  itemEl.dataset.type = 'favorite';
  itemEl.dataset.folderId = record.folder_id;
  itemEl.draggable = true;

  // 构建标题和 URL（搜索时高亮）
  const titleHtml = state.keyword
    ? highlightText(record.title || record.url, state.keyword)
    : escapeHtml(record.title || record.url);
  const urlHtml = state.keyword
    ? highlightText(record.url, state.keyword)
    : escapeHtml(record.url);

  // favicon 处理
  const faviconSrc = record.favicon_url || '';
  const faviconFallback = (record.title || record.url).charAt(0).toUpperCase();

  itemEl.innerHTML = `
    <input type="checkbox" class="favorite-item-checkbox" data-id="${record.id}" ${state.selectedIds.has(record.id) ? 'checked' : ''}>
    <div class="favorite-item-favicon" title="打开链接">
      <img src="${escapeHtml(faviconSrc)}" alt="" style="display:none">
      <div class="favorite-item-favicon-fallback">${escapeHtml(faviconFallback)}</div>
    </div>
    <div class="favorite-item-content">
      <div class="favorite-item-title" title="点击编辑标题">${titleHtml}</div>
      <div class="favorite-item-url" title="打开链接">${urlHtml}</div>
    </div>
    <div class="favorite-item-time">${formatTime(record.created_at)}</div>
  `;

  // favicon 加载失败时显示首字符回退
  const faviconImg = itemEl.querySelector('.favorite-item-favicon img');
  const faviconFallbackEl = itemEl.querySelector('.favorite-item-favicon-fallback');
  const showFaviconFallback = () => {
    faviconImg.style.display = 'none';
    faviconFallbackEl.style.display = 'flex';
  };
  if (!faviconSrc) {
    showFaviconFallback();
  } else {
    faviconFallbackEl.style.display = 'none';
    faviconImg.addEventListener('error', showFaviconFallback);
    faviconImg.style.display = 'block';
  }

  // 绑定 checkbox 事件
  const checkbox = itemEl.querySelector('.favorite-item-checkbox');
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      state.selectedIds.add(record.id);
    } else {
      state.selectedIds.delete(record.id);
    }
    updateActionsBar();
  });

  // 打开收藏链接：favicon / URL 单击直接打开
  // window.open 走主进程 setWindowOpenHandler 拦截（main.js:121），
  // 自动在来源容器新建 Tab，无需通过 IPC 显式通知
  const openBookmark = () => {
    window.open(record.url, '_blank');
  };
  const faviconEl = itemEl.querySelector('.favorite-item-favicon');
  faviconEl.addEventListener('click', openBookmark);
  const urlEl = itemEl.querySelector('.favorite-item-url');
  urlEl.addEventListener('click', openBookmark);

  // 标题点击进入行内编辑模式（D-11）
  const titleEl = itemEl.querySelector('.favorite-item-title');
  titleEl.addEventListener('click', () => {
    startInlineEdit(titleEl, record);
  });

  // 点击标题在新 Tab 打开（双击行为需要区分，这里用右键或中键）
  // 左键单击进入编辑，双击打开链接
  titleEl.addEventListener('dblclick', () => {
    window.open(record.url, '_blank');
  });

  // 右键菜单
  itemEl.addEventListener('contextmenu', (e) => {
    showFavoriteContextMenu(e, record);
  });

  // 剪切视觉提示
  if (state.clipboard && state.clipboard.mode === 'cut' && state.clipboard.ids.includes(record.id)) {
    itemEl.style.opacity = '0.4';
  }

  return itemEl;
}

// ==================== 文件夹树渲染 ====================

/**
 * 渲染文件夹树
 * @param {Array} tree - 文件夹树数组
 * @param {number} level - 当前层级（用于缩进）
 */
function renderFolderTree(tree, level = 0) {
  if (level === 0) {
    elements.folderTree.innerHTML = '';
  }

  for (const folder of tree) {
    const itemEl = document.createElement('div');
    itemEl.className = 'folder-tree-item';
    itemEl.dataset.folderId = folder.id;
    itemEl.dataset.type = 'folder';
    itemEl.dataset.id = folder.id;
    itemEl.dataset.parentId = folder.parent_id;
    itemEl.draggable = true;
    if (folder.id === state.currentFolderId) {
      itemEl.classList.add('active');
    }
    itemEl.style.paddingLeft = `${16 + level * 24}px`;

    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = state.expandedFolders.has(folder.id);

    // 展开箭头（有子文件夹时显示）
    const expandIconHtml = hasChildren
      ? `<svg class="folder-expand-icon ${isExpanded ? 'expanded' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>`
      : '<span style="width: 12px; margin-right: 4px;"></span>';

    // 文件夹图标
    const folderIconHtml = `<svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>`;

    // 收藏数量徽标（可选，需要后端提供 count）
    const countHtml = folder.count !== undefined
      ? `<span class="folder-count">${folder.count}</span>`
      : '';

    itemEl.innerHTML = `
      ${expandIconHtml}
      ${folderIconHtml}
      <span class="folder-name">${escapeHtml(folder.name)}</span>
      ${countHtml}
    `;

    // 点击事件：展开/收起 + 导航
    itemEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasChildren) {
        if (state.expandedFolders.has(folder.id)) {
          state.expandedFolders.delete(folder.id);
        } else {
          state.expandedFolders.add(folder.id);
        }
      }
      navigateToFolder(folder.id);
    });

    // 右键菜单
    itemEl.addEventListener('contextmenu', (e) => {
      showFolderContextMenu(e, folder);
    });

    elements.folderTree.appendChild(itemEl);

    // 递归渲染子文件夹
    if (hasChildren && isExpanded) {
      renderFolderTree(folder.children, level + 1);
    }
  }
}

/**
 * 刷新文件夹树
 */
async function refreshFolderTree() {
  state.folderTree = await fetchFolderTree();
  renderFolderTree(state.folderTree);
}

// ==================== 文件夹导航 ====================

/**
 * 导航到指定文件夹
 * @param {number} folderId - 文件夹 ID（0 表示根目录）
 */
function navigateToFolder(folderId) {
  state.currentFolderId = folderId;
  state.offset = 0;
  state.hasMore = true;
  state.records = [];
  state.selectedIds.clear();
  updateActionsBar();
  renderFolderTree(state.folderTree);
  renderBreadcrumb();
  loadFavorites();
}

/**
 * 获取文件夹路径（从根到目标文件夹）
 * @param {number} folderId - 目标文件夹 ID
 * @param {Array} tree - 文件夹树
 * @param {Array} path - 当前路径（递归累积）
 * @returns {Array} 路径数组 [{id, name}, ...]
 */
function getFolderPath(folderId, tree, path = []) {
  for (const folder of tree) {
    if (folder.id === folderId) {
      return [...path, { id: folder.id, name: folder.name }];
    }
    if (folder.children && folder.children.length > 0) {
      const found = getFolderPath(folderId, folder.children, [...path, { id: folder.id, name: folder.name }]);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 渲染面包屑导航
 */
function renderBreadcrumb() {
  elements.breadcrumb.innerHTML = '';

  // 根节点"所有书签"
  const isRoot = state.currentFolderId === 0;
  if (isRoot) {
    const currentEl = document.createElement('span');
    currentEl.className = 'breadcrumb-current';
    currentEl.textContent = '所有书签';
    elements.breadcrumb.appendChild(currentEl);
  } else {
    const rootEl = document.createElement('span');
    rootEl.className = 'breadcrumb-item';
    rootEl.textContent = '所有书签';
    rootEl.addEventListener('click', () => navigateToFolder(0));
    elements.breadcrumb.appendChild(rootEl);

    // 查找路径
    const path = getFolderPath(state.currentFolderId, state.folderTree);
    if (path) {
      for (let i = 0; i < path.length; i++) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '>';
        elements.breadcrumb.appendChild(sep);

        const isLast = i === path.length - 1;
        if (isLast) {
          const currentEl = document.createElement('span');
          currentEl.className = 'breadcrumb-current';
          currentEl.textContent = path[i].name;
          elements.breadcrumb.appendChild(currentEl);
        } else {
          const itemEl = document.createElement('span');
          itemEl.className = 'breadcrumb-item';
          itemEl.textContent = path[i].name;
          const folderId = path[i].id;
          itemEl.addEventListener('click', () => navigateToFolder(folderId));
          elements.breadcrumb.appendChild(itemEl);
        }
      }
    }
  }
}

// ==================== 行内编辑 ====================

/**
 * 开始行内编辑标题
 * @param {HTMLElement} titleEl - 标题元素
 * @param {Object} record - 收藏记录对象
 */
function startInlineEdit(titleEl, record) {
  // 如果已经在编辑中，忽略
  if (titleEl.querySelector('input')) return;

  const originalTitle = record.title || record.url;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'favorite-item-title-edit';
  input.value = originalTitle;

  // 保存并退出编辑模式
  const saveAndExit = async () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== originalTitle) {
      try {
        await favoritesApi('update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: record.id,
            title: newTitle,
          }),
        });
        record.title = newTitle;
        showToast('标题已更新');
      } catch (err) {
        console.error('[Realm Favorites] 更新标题失败:', err);
        showToast('更新失败，请重试');
      }
    }
    // 恢复标题显示
    titleEl.textContent = record.title || record.url;
  };

  // 取消编辑
  const cancelEdit = () => {
    titleEl.textContent = originalTitle;
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAndExit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });

  input.addEventListener('blur', () => {
    saveAndExit();
  });

  // 替换标题内容为输入框
  titleEl.textContent = '';
  titleEl.appendChild(input);
  input.focus();
  input.select();
}

// ==================== 右键菜单 ====================

/**
 * 显示通用右键菜单
 * @param {Array} items - 菜单项数组 [{label, onClick, disabled} | {type: 'separator'}]
 * @param {number} x - 菜单 X 坐标
 * @param {number} y - 菜单 Y 坐标
 */
function showContextMenu(items, x, y) {
  // 先隐藏已有菜单
  hideContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  for (const item of items) {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
      continue;
    }

    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    if (item.disabled) {
      menuItem.classList.add('disabled');
    }
    menuItem.textContent = item.label;

    if (!item.disabled && item.onClick) {
      menuItem.addEventListener('click', () => {
        item.onClick();
        hideContextMenu();
      });
    }

    menu.appendChild(menuItem);
  }

  // 定位菜单（确保不超出视口）
  document.body.appendChild(menu);
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = x;
  let top = y;

  if (x + menuRect.width > viewportWidth) {
    left = x - menuRect.width;
  }
  if (y + menuRect.height > viewportHeight) {
    top = y - menuRect.height;
  }

  menu.style.left = `${Math.max(0, left)}px`;
  menu.style.top = `${Math.max(0, top)}px`;

  state.contextMenuEl = menu;

  // 点击其他地方时隐藏菜单
  const hideHandler = (e) => {
    if (!menu.contains(e.target)) {
      hideContextMenu();
      document.removeEventListener('click', hideHandler);
      document.removeEventListener('contextmenu', hideHandler);
    }
  };
  // 延迟添加监听，避免当前右键事件立即触发
  setTimeout(() => {
    document.addEventListener('click', hideHandler);
    document.addEventListener('contextmenu', hideHandler);
  }, 0);
}

/**
 * 隐藏右键菜单
 */
function hideContextMenu() {
  if (state.contextMenuEl) {
    state.contextMenuEl.remove();
    state.contextMenuEl = null;
  }
}

/**
 * 显示收藏项右键菜单
 * @param {MouseEvent} e - 鼠标事件
 * @param {Object} record - 收藏记录
 */
function showFavoriteContextMenu(e, record) {
  e.preventDefault();
  e.stopPropagation();

  const items = [
    {
      label: '打开',
      onClick: () => window.open(record.url, '_blank'),
    },
    {
      label: '在新标签页中打开',
      onClick: () => window.open(record.url, '_blank'),
    },
    {
      label: '在新窗口中打开',
      onClick: () => window.open(record.url, '_blank', 'noopener'),
    },
    { type: 'separator' },
    {
      label: '编辑',
      onClick: () => {
        const titleEl = document.querySelector(`.favorite-item[data-id="${record.id}"] .favorite-item-title`);
        if (titleEl) startInlineEdit(titleEl, record);
      },
    },
    {
      label: '剪切',
      onClick: () => {
        state.clipboard = { ids: [record.id], mode: 'cut', sourceFolderId: state.currentFolderId };
        showToast('已剪切 1 项');
        renderFavorites(state.records);
      },
    },
    {
      label: '复制',
      onClick: () => {
        state.clipboard = { ids: [record.id], mode: 'copy', sourceFolderId: state.currentFolderId };
        showToast('已复制 1 项');
      },
    },
    { type: 'separator' },
    {
      label: '删除',
      onClick: async () => {
        if (confirm(`确定删除收藏 "${record.title || record.url}" 吗？`)) {
          try {
            await favoritesApi('delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: record.id }),
            });
            showToast('已删除');
            await loadFavorites();
            await refreshFolderTree();
          } catch (err) {
            console.error('[Realm Favorites] 删除失败:', err);
            showToast('删除失败');
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: '属性',
      onClick: () => {
        const createdTime = new Date(record.created_at).toLocaleString('zh-CN');
        alert(`标题: ${record.title || '(无标题)'}\nURL: ${record.url}\n创建时间: ${createdTime}`);
      },
    },
  ];

  showContextMenu(items, e.clientX, e.clientY);
}

/**
 * 显示文件夹右键菜单
 * @param {MouseEvent} e - 鼠标事件
 * @param {Object} folder - 文件夹对象
 */
function showFolderContextMenu(e, folder) {
  e.preventDefault();
  e.stopPropagation();

  const items = [
    {
      label: '打开',
      onClick: () => navigateToFolder(folder.id),
    },
    {
      label: '在新窗口中打开',
      onClick: async () => {
        try {
          const records = await favoritesApi('list', {}, { folder_id: folder.id, limit: 1000 });
          if (records && records.length > 0) {
            for (const record of records) {
              window.open(record.url, '_blank');
            }
          } else {
            showToast('文件夹为空');
          }
        } catch (err) {
          showToast('打开失败');
        }
      },
    },
    { type: 'separator' },
    {
      label: '重命名',
      onClick: () => startRenameFolder(folder.id, folder.name),
    },
    {
      label: '添加书签',
      onClick: () => {
        // 在该文件夹下添加当前页（如果有）
        showToast('请使用工具栏星标按钮添加收藏');
      },
    },
    {
      label: '添加文件夹',
      onClick: () => startNewFolder(folder.id),
    },
    {
      label: '粘贴',
      disabled: !state.clipboard,
      onClick: () => pasteFromClipboard(folder.id),
    },
    { type: 'separator' },
    {
      label: '删除',
      onClick: async () => {
        if (confirm(`确定删除文件夹 "${folder.name}" 及其所有内容吗？此操作不可撤销。`)) {
          try {
            await deleteFolderApi(folder.id);
            showToast('文件夹已删除');
            if (state.currentFolderId === folder.id) {
              navigateToFolder(0);
            }
            await refreshFolderTree();
            await loadFavorites();
          } catch (err) {
            console.error('[Realm Favorites] 删除文件夹失败:', err);
            showToast('删除失败');
          }
        }
      },
    },
  ];

  showContextMenu(items, e.clientX, e.clientY);
}

/**
 * 显示空白区域右键菜单
 * @param {MouseEvent} e - 鼠标事件
 */
function showEmptyContextMenu(e) {
  // 仅在点击空白区域时触发（不是点击收藏项或文件夹树节点）
  if (e.target.closest('.favorite-item, .folder-tree-item')) return;

  e.preventDefault();

  const items = [
    {
      label: '新建文件夹',
      onClick: () => startNewFolder(state.currentFolderId),
    },
    {
      label: '粘贴',
      disabled: !state.clipboard,
      onClick: () => pasteFromClipboard(),
    },
    { type: 'separator' },
    {
      label: '按名称排序',
      onClick: async () => {
        // 对当前文件夹内的收藏按 title 排序
        state.records.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url));
        renderFavorites(state.records);
        showToast('已按名称排序');
      },
    },
  ];

  showContextMenu(items, e.clientX, e.clientY);
}

// ==================== 剪贴板操作 ====================

/**
 * 从剪贴板粘贴收藏项
 */
/**
 * 从剪贴板粘贴收藏项
 * @param {number} [targetFolderId] - 目标文件夹 ID（默认使用 state.currentFolderId）
 */
async function pasteFromClipboard(targetFolderId) {
  if (!state.clipboard) return;

  const folderId = targetFolderId !== undefined ? targetFolderId : state.currentFolderId;
  const { ids, mode } = state.clipboard;
  const count = ids.length;

  try {
    if (mode === 'cut') {
      // 剪切模式：移动到目标文件夹
      await favoritesApi('move-favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, folderId }),
      });
    } else if (mode === 'copy') {
      // 复制模式：暂不支持（需要 duplicate API）
      showToast('复制粘贴功能暂不支持');
      state.clipboard = null;
      return;
    }

    state.clipboard = null;
    showToast(`已粘贴 ${count} 项`);
    await loadFavorites();
    await refreshFolderTree();
  } catch (err) {
    console.error('[Realm Favorites] 粘贴失败:', err);
    showToast('粘贴失败');
  }
}

// ==================== 新建文件夹 UI ====================

/**
 * 开始新建文件夹
 * @param {number} parentId - 父文件夹 ID（0 表示根目录）
 */
function startNewFolder(parentId = 0) {
  const container = elements.folderTree;

  // 计算父文件夹的层级，确定输入框缩进
  function getFolderLevel(targetId, tree, level = 0) {
    for (const folder of tree) {
      if (folder.id === targetId) return level;
      if (folder.children) {
        const found = getFolderLevel(targetId, folder.children, level + 1);
        if (found !== -1) return found;
      }
    }
    return -1;
  }
  const parentLevel = parentId === 0 ? -1 : getFolderLevel(parentId, state.folderTree);
  const inputLevel = parentLevel >= 0 ? parentLevel + 1 : 0;

  // 创建内联输入行
  const inputRow = document.createElement('div');
  inputRow.className = 'folder-tree-item';
  inputRow.style.paddingLeft = `${16 + inputLevel * 24}px`;

  // 文件夹图标
  const folderIconHtml = `<svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>`;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-name-input';
  input.placeholder = '新建文件夹';

  inputRow.innerHTML = folderIconHtml;
  inputRow.appendChild(input);

  // 插入到容器最前面（parentId === 0）或父文件夹后面
  if (parentId === 0) {
    container.insertBefore(inputRow, container.firstChild);
  } else {
    // 找到父文件夹元素后面插入（通过 data-folder-id 定位）
    const parentEl = container.querySelector(`[data-folder-id="${parentId}"]`);
    if (parentEl) {
      parentEl.parentNode.insertBefore(inputRow, parentEl.nextSibling);
    } else {
      container.appendChild(inputRow);
    }
  }

  input.focus();
  input.placeholder = '新建文件夹';

  // 防止重复提交（Enter 和 blur 会同时触发）
  let submitted = false;

  async function submitFolder() {
    if (submitted) return;
    const name = input.value.trim();
    if (!name) {
      inputRow.remove();
      return;
    }
    submitted = true;
    try {
      const result = await createFolderApi(name, parentId);
      if (result.id) {
        showToast('文件夹已创建');
        await refreshFolderTree();
        navigateToFolder(result.id);
      } else {
        showToast('创建失败');
      }
    } catch (err) {
      console.error('[Realm Favorites] 创建文件夹失败:', err);
      showToast('创建失败');
    }
    inputRow.remove();
  }

  // Enter 确认
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await submitFolder();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      submitted = true;
      inputRow.remove();
    }
  });

  // blur 时也触发确认
  input.addEventListener('blur', async () => {
    await submitFolder();
  });
}

/**
 * 开始重命名文件夹
 * @param {number} folderId - 文件夹 ID
 * @param {string} currentName - 当前名称
 */
function startRenameFolder(folderId, currentName) {
  // 找到文件夹树中对应元素
  const folderItems = elements.folderTree.querySelectorAll('.folder-tree-item');
  let targetItem = null;

  for (const item of folderItems) {
    const nameEl = item.querySelector('.folder-name');
    if (nameEl && nameEl.textContent === currentName) {
      targetItem = item;
      break;
    }
  }

  if (!targetItem) return;

  const nameEl = targetItem.querySelector('.folder-name');
  if (!nameEl) return;

  // 替换为输入框
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-name-input';
  input.value = currentName;

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  // 防止重复提交（Enter 和 blur 会同时触发）
  let submitted = false;

  async function submitRename() {
    if (submitted) return;
    submitted = true;
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      try {
        await renameFolderApi(folderId, newName);
        showToast('文件夹已重命名');
        await refreshFolderTree();
      } catch (err) {
        console.error('[Realm Favorites] 重命名失败:', err);
        showToast('重命名失败');
      }
    }
    // 恢复显示
    const span = document.createElement('span');
    span.className = 'folder-name';
    span.textContent = newName || currentName;
    input.replaceWith(span);
  }

  // Enter 确认
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await submitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      submitted = true;
      const span = document.createElement('span');
      span.className = 'folder-name';
      span.textContent = currentName;
      input.replaceWith(span);
    }
  });

  // blur 时也触发确认
  input.addEventListener('blur', async () => {
    await submitRename();
  });
}

// ==================== 数据加载 ====================

/**
 * 加载收藏列表
 */
async function loadFavorites() {
  state.offset = 0;
  state.hasMore = true;
  state.records = [];

  try {
    let results;
    if (state.keyword) {
      // 搜索模式：全局搜索，不受文件夹限制
      results = await favoritesApi('search', {}, {
        keyword: state.keyword,
        offset: 0,
        limit: state.limit,
      });
    } else {
      // 非搜索模式：按当前文件夹过滤
      results = await favoritesApi('list', {}, {
        offset: 0,
        limit: state.limit,
        folder_id: state.currentFolderId,
      });
    }

    state.records = results || [];
    state.hasMore = results.length === state.limit;
    renderFavorites(state.records);
  } catch (err) {
    console.error('[Realm Favorites] 加载收藏失败:', err);
    renderEmpty();
  }
}

/**
 * 加载更多收藏
 */
async function loadMore() {
  if (state.loading || !state.hasMore) return;

  state.loading = true;
  state.offset += state.limit;

  try {
    let results;
    if (state.keyword) {
      results = await favoritesApi('search', {}, {
        keyword: state.keyword,
        offset: state.offset,
        limit: state.limit,
      });
    } else {
      results = await favoritesApi('list', {}, {
        offset: state.offset,
        limit: state.limit,
        folder_id: state.currentFolderId,
      });
    }

    if (results && results.length > 0) {
      state.records = state.records.concat(results);
      state.hasMore = results.length === state.limit;
      renderFavorites(state.records);
    } else {
      state.hasMore = false;
    }
  } catch (err) {
    console.error('[Realm Favorites] 加载更多失败:', err);
  } finally {
    state.loading = false;
  }
}

// ==================== 操作处理 ====================

/**
 * 处理批量删除
 */
async function handleBatchDelete() {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;

  try {
    await favoritesApi('delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    // 移除 DOM 节点
    for (const id of ids) {
      const itemEl = elements.favoritesContent.querySelector(`[data-id="${id}"]`);
      if (itemEl) itemEl.remove();
    }

    // 清空选中集合
    state.selectedIds.clear();
    state.selectAll = false;
    elements.selectAllCheckbox.checked = false;
    updateActionsBar();

    // 检查整个列表是否为空
    const allItems = elements.favoritesContent.querySelectorAll('.favorite-item');
    if (allItems.length === 0) {
      renderEmpty();
    }

    showToast(`已删除 ${ids.length} 项收藏`);
  } catch (err) {
    console.error('[Realm Favorites] 批量删除失败:', err);
  }
}

/**
 * 更新批量操作栏状态
 */
function updateActionsBar() {
  const count = state.selectedIds.size;
  if (count > 0) {
    elements.actionsBar.classList.remove('hidden');
    elements.selectedCount.textContent = `已选择 ${count} 项`;
    elements.deleteSelectedBtn.disabled = false;
  } else {
    elements.actionsBar.classList.add('hidden');
    elements.selectedCount.textContent = '已选择 0 项';
    elements.deleteSelectedBtn.disabled = true;
  }

  // 更新全选按钮文案
  const allCheckboxes = elements.favoritesContent.querySelectorAll('.favorite-item-checkbox');
  if (allCheckboxes.length > 0 && state.selectedIds.size === allCheckboxes.length) {
    elements.selectAllBtn.textContent = '取消全选';
    elements.selectAllCheckbox.checked = true;
  } else {
    elements.selectAllBtn.textContent = '全选';
    elements.selectAllCheckbox.checked = false;
  }
}

/**
 * 切换全选/取消全选
 */
function toggleSelectAll() {
  const allCheckboxes = elements.favoritesContent.querySelectorAll('.favorite-item-checkbox');
  const allSelected = state.selectedIds.size === allCheckboxes.length && allCheckboxes.length > 0;

  if (allSelected) {
    // 取消全选
    state.selectedIds.clear();
    allCheckboxes.forEach((cb) => { cb.checked = false; });
  } else {
    // 全选
    allCheckboxes.forEach((cb) => {
      cb.checked = true;
      state.selectedIds.add(parseInt(cb.dataset.id, 10));
    });
  }

  updateActionsBar();
}

// ==================== Toast 提示 ====================

/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 */
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2000);
}

// ==================== 拖拽排序 ====================

/**
 * 执行拖拽放置操作
 *
 * 根据拖拽类型（收藏项/文件夹）和目标类型（文件夹/排序位置）执行不同逻辑：
 * - 拖到文件夹上：跨文件夹移动（per D-01）
 * - 同目录排序：计算新位置的 fractional sort key（per D-01）
 *
 * @param {Object} dragData - 拖拽源数据 {type, id, folderId}
 * @param {Object} targetData - 目标数据 {type, id, position}
 */
async function executeDragDrop(dragData, targetData) {
  try {
    if (targetData.type === 'folder' && targetData.position === 'on') {
      // 拖到文件夹上：跨文件夹移动
      if (dragData.type === 'favorite') {
        await favoritesApi('move-favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dragData.id, folderId: targetData.id }),
        });
        showToast('已移动到文件夹');
      } else if (dragData.type === 'folder') {
        // 循环引用检测
        if (isDescendantCheck(dragData.id, targetData.id)) {
          showToast('不能将文件夹移动到自己的子文件夹中');
          return;
        }
        await favoritesApi('move-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dragData.id, parentId: targetData.id }),
        });
        showToast('已移动文件夹');
      }
    } else {
      // 同目录排序：使用 fractional indexing 计算新位置
      const parentFolderId = dragData.folderId;
      const allItems = state.records.filter(r => r.folder_id === parentFolderId);

      // 获取目标位置的前后排序键
      let beforeKey = null;
      let afterKey = null;

      if (targetData.type === 'favorite') {
        const targetIndex = allItems.findIndex(r => r.id === targetData.id);
        if (targetIndex !== -1) {
          if (targetData.position === 'before') {
            afterKey = allItems[targetIndex].sort_order;
            beforeKey = targetIndex > 0 ? allItems[targetIndex - 1].sort_order : null;
          } else {
            beforeKey = allItems[targetIndex].sort_order;
            afterKey = targetIndex < allItems.length - 1 ? allItems[targetIndex + 1].sort_order : null;
          }
        }
      } else if (targetData.type === 'folder') {
        // 文件夹排序
        const folders = state.folderTree;
        const targetIndex = folders.findIndex(f => f.id === targetData.id);
        if (targetIndex !== -1) {
          if (targetData.position === 'before') {
            afterKey = folders[targetIndex].sort_order;
            beforeKey = targetIndex > 0 ? folders[targetIndex - 1].sort_order : null;
          } else {
            beforeKey = folders[targetIndex].sort_order;
            afterKey = targetIndex < folders.length - 1 ? folders[targetIndex + 1].sort_order : null;
          }
        }
      }

      // 计算新的排序键
      const keys = await computeSortKeys(beforeKey, afterKey, 1);
      if (keys && keys.length > 0) {
        const newKey = keys[0];
        if (dragData.type === 'favorite') {
          await favoritesApi('update-batch-sort', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: dragData.id, sort_order: newKey }] }),
          });
        } else if (dragData.type === 'folder') {
          await favoritesApi('update-batch-folder-sort', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folders: [{ id: dragData.id, sort_order: newKey }] }),
          });
        }
        showToast('排序已保存');
      }
    }

    // 刷新列表
    await loadFavorites();
    await refreshFolderTree();
  } catch (err) {
    console.error('[Realm Favorites] 拖拽操作失败:', err);
    showToast('操作失败，请重试');
  }
}

/**
 * 设置拖拽排序事件监听
 *
 * 使用事件委托在列表容器上监听拖拽事件：
 * - dragstart: 记录拖拽源数据，添加 .dragging 类
 * - dragover: 检测放置位置，添加视觉反馈
 * - dragleave: 清除视觉反馈
 * - drop: 执行移动/排序操作
 * - dragend: 清除所有拖拽状态
 */
function setupDragAndDrop() {
  const contentArea = elements.favoritesContent;
  const folderArea = elements.folderTree;

  // ---- favoritesContent 拖拽事件 ----

  contentArea.addEventListener('dragstart', (e) => {
    const itemEl = e.target.closest('[draggable]');
    if (!itemEl) return;

    const type = itemEl.dataset.type;
    const id = parseInt(itemEl.dataset.id, 10);
    const folderId = type === 'favorite' ? parseInt(itemEl.dataset.folderId, 10) : parseInt(itemEl.dataset.parentId, 10);

    state.dragSourceData = { type, id, folderId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(state.dragSourceData));

    // 添加拖拽源半透明样式
    requestAnimationFrame(() => {
      itemEl.classList.add('dragging');
    });
  });

  contentArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetEl = e.target.closest('[data-type]');
    if (!targetEl) return;

    // 清除之前的拖拽指示
    clearDragIndicators();

    const targetType = targetEl.dataset.type;
    const targetId = parseInt(targetEl.dataset.id, 10);

    if (targetType === 'folder') {
      // 拖到文件夹上：高亮文件夹（per D-06）
      targetEl.classList.add('drag-over-folder');
    } else {
      // 拖到收藏项上：显示插入指示线（per D-07）
      const position = getDragPosition(e, targetEl);
      targetEl.classList.add(position === 'before' ? 'drag-over-top' : 'drag-over-bottom');
    }
  });

  contentArea.addEventListener('dragleave', (e) => {
    const targetEl = e.target.closest('[data-type]');
    if (!targetEl) return;

    // 只有当 relatedTarget 不在目标元素内时才清除高亮
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && targetEl.contains(relatedTarget)) return;

    targetEl.classList.remove('drag-over-folder', 'drag-over-top', 'drag-over-bottom');
  });

  contentArea.addEventListener('drop', (e) => {
    e.preventDefault();
    clearDragIndicators();

    const targetEl = e.target.closest('[data-type]');
    if (!targetEl || !state.dragSourceData) return;

    const targetType = targetEl.dataset.type;
    const targetId = parseInt(targetEl.dataset.id, 10);

    // 不能拖到自身
    if (state.dragSourceData.type === targetType && state.dragSourceData.id === targetId) {
      return;
    }

    let position = 'on';
    if (targetType !== 'folder' || !targetEl.classList.contains('drag-over-folder')) {
      position = getDragPosition(e, targetEl);
    }

    executeDragDrop(state.dragSourceData, {
      type: targetType,
      id: targetId,
      position,
    });
  });

  contentArea.addEventListener('dragend', (e) => {
    // 移除拖拽源半透明样式
    const draggingEl = contentArea.querySelector('.dragging');
    if (draggingEl) {
      draggingEl.classList.remove('dragging');
    }
    clearDragIndicators();
    state.dragSourceData = null;
  });

  // ---- folderTree 拖拽事件 ----

  folderArea.addEventListener('dragstart', (e) => {
    const itemEl = e.target.closest('[draggable]');
    if (!itemEl) return;

    const type = itemEl.dataset.type;
    const id = parseInt(itemEl.dataset.id, 10);
    const parentId = parseInt(itemEl.dataset.parentId, 10);

    state.dragSourceData = { type, id, folderId: parentId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(state.dragSourceData));

    requestAnimationFrame(() => {
      itemEl.classList.add('dragging');
    });
  });

  folderArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetEl = e.target.closest('[data-type]');
    if (!targetEl) return;

    clearDragIndicators();

    const targetType = targetEl.dataset.type;
    if (targetType === 'folder') {
      // 循环引用检测
      if (state.dragSourceData && state.dragSourceData.type === 'folder') {
        const targetId = parseInt(targetEl.dataset.id, 10);
        if (isDescendantCheck(state.dragSourceData.id, targetId)) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
      }
      targetEl.classList.add('drag-over-folder');
    }
  });

  folderArea.addEventListener('dragleave', (e) => {
    const targetEl = e.target.closest('[data-type]');
    if (!targetEl) return;

    const relatedTarget = e.relatedTarget;
    if (relatedTarget && targetEl.contains(relatedTarget)) return;

    targetEl.classList.remove('drag-over-folder');
  });

  folderArea.addEventListener('drop', (e) => {
    e.preventDefault();
    clearDragIndicators();

    const targetEl = e.target.closest('[data-type]');
    if (!targetEl || !state.dragSourceData) return;

    const targetType = targetEl.dataset.type;
    const targetId = parseInt(targetEl.dataset.id, 10);

    // 不能拖到自身
    if (state.dragSourceData.type === targetType && state.dragSourceData.id === targetId) {
      return;
    }

    executeDragDrop(state.dragSourceData, {
      type: targetType,
      id: targetId,
      position: 'on',
    });
  });

  folderArea.addEventListener('dragend', (e) => {
    const draggingEl = folderArea.querySelector('.dragging');
    if (draggingEl) {
      draggingEl.classList.remove('dragging');
    }
    clearDragIndicators();
    state.dragSourceData = null;
  });
}

/**
 * 清除所有拖拽视觉指示器
 */
function clearDragIndicators() {
  document.querySelectorAll('.drag-over-folder, .drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over-folder', 'drag-over-top', 'drag-over-bottom');
  });
}

// ==================== 事件绑定 ====================

/**
 * 绑定事件监听器
 */
function setupEventListeners() {
  // 搜索框（debounce 300ms，D-09）
  const debouncedSearch = debounce(() => {
    state.keyword = elements.searchInput.value.trim();
    loadFavorites();
  }, 300);

  elements.searchInput.addEventListener('input', debouncedSearch);

  // 全选 checkbox
  elements.selectAllCheckbox.addEventListener('change', toggleSelectAll);

  // 全选按钮
  elements.selectAllBtn.addEventListener('click', toggleSelectAll);

  // 删除选中 → 打开确认弹窗
  elements.deleteSelectedBtn.addEventListener('click', () => {
    const count = state.selectedIds.size;
    elements.batchDeleteBody.textContent = `确定删除选中的 ${count} 项收藏吗？此操作不可撤销。`;
    elements.favoritesBatchDeleteModal.showModal();
  });

  // 确认批量删除
  elements.confirmBatchDeleteBtn.addEventListener('click', async () => {
    await handleBatchDelete();
    elements.favoritesBatchDeleteModal.close();
  });

  // 取消批量删除
  elements.cancelBatchDeleteBtn.addEventListener('click', () => {
    elements.favoritesBatchDeleteModal.close();
  });

  // 点击弹窗外关闭弹窗
  elements.favoritesBatchDeleteModal.addEventListener('click', (e) => {
    if (e.target === elements.favoritesBatchDeleteModal) {
      elements.favoritesBatchDeleteModal.close();
    }
  });

  // 滚动加载（滚动容器是 .favorites-content-area）
  const contentArea = document.querySelector('.favorites-content-area');
  if (contentArea) {
    contentArea.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = contentArea;

      // 距离底部 200px 时开始加载
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMore();
      }
    });
  }

  /**
   * 空白区域右键菜单（.favorites-main 级委托路由）
   *
   * 可见空白几何上分属 .favorites-content-area（列表下方、padding 环）
   * 与 #folderTree（文件夹树节点下方）两个不同容器，只有公共祖先
   * .favorites-main 能单点覆盖所有空白路径。收藏项/文件夹节点的右键
   * 处理器已有 preventDefault + stopPropagation，事件不会冒泡到这里，
   * 天然不冲突。
   */
  const favoritesMain = document.querySelector('.favorites-main');
  if (favoritesMain) {
    favoritesMain.addEventListener('contextmenu', (e) => {
      // 守卫一：收藏项/文件夹节点有各自的右键处理器，防御性跳过
      if (e.target.closest('.favorite-item, .folder-tree-item')) return;

      // 守卫二：搜索框等交互元素需要默认编辑菜单（走 webview 透传管线），
      // 按钮/链接/弹窗/已打开的自定义菜单上不应弹新建菜单
      if (e.target.closest('input, textarea, select, button, a, dialog, .context-menu, [contenteditable]')) return;

      // stopPropagation 必须在 showEmptyContextMenu 之前执行：showContextMenu
      // 每次打开菜单都会在 document 上注册 contextmenu 隐藏监听，若事件继续
      // 冒泡到 document，旧的隐藏监听会在同一事件分发中把刚打开的新菜单立即
      // 关掉（菜单闪关）
      e.stopPropagation();
      showEmptyContextMenu(e);
    });
  }
}

// ==================== 初始化 ====================

/**
 * 初始化页面
 */
async function init() {
  try {
    // 容器 ID 已在页面加载时从 URL 查询参数解析（见 state 初始化）
    if (!apiToken) {
      throw new Error('缺少 API token，无法访问收藏数据');
    }

    // 绑定事件监听器
    setupEventListeners();

    // 设置拖拽排序
    setupDragAndDrop();

    // 加载文件夹树
    await refreshFolderTree();

    // 渲染面包屑
    renderBreadcrumb();

    // 绑定新建文件夹按钮
    elements.addFolderBtn.addEventListener('click', () => startNewFolder(0));

    // 加载收藏列表
    await loadFavorites();
  } catch (err) {
    console.error('[Realm Favorites] 初始化失败:', err);
    renderEmpty();
  }
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

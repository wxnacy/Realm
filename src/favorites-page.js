/**
 * Realm Browser - 收藏夹页面逻辑
 *
 * realm://favorites 内部页面的渲染逻辑
 * 负责收藏列表展示、搜索过滤（含高亮）、
 * 行内编辑标题、单条删除、批量删除、滚动加载、空状态显示
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

  return itemEl;
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
      results = await favoritesApi('search', {}, {
        keyword: state.keyword,
        offset: 0,
        limit: state.limit,
      });
    } else {
      results = await favoritesApi('list', {}, {
        offset: 0,
        limit: state.limit,
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

  // 滚动加载（滚动容器是 .favorites-page）
  elements.favoritesPage.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = elements.favoritesPage;

    // 距离底部 200px 时开始加载
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      loadMore();
    }
  });
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

    // 加载收藏列表
    await loadFavorites();
  } catch (err) {
    console.error('[Realm Favorites] 初始化失败:', err);
    renderEmpty();
  }
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

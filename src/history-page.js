/**
 * Realm Browser - 浏览历史记录页面逻辑
 *
 * realm://history 内部页面的渲染逻辑
 * 负责历史记录列表展示、日期分组、搜索过滤（含高亮）、
 * 单条删除、批量删除、清空全部、滚动加载、空状态显示
 */

// ==================== 状态管理 ====================

// 页面运行在 webview guest 中，IPC 会被主进程 assertTrustedSender（CR-4）拒绝，
// 因此数据访问走本地 HTTP 服务器的 /api/history/* 端点。
// 容器 ID 和 API token 由渲染进程创建 webview 时注入 URL 查询参数。
const pageParams = new URLSearchParams(window.location.search);

/**
 * 页面状态对象
 * @type {Object}
 */
const state = {
  /** 当前容器 ID（来自 URL 查询参数） */
  containerId: pageParams.get('container') || 'default',
  /** 已加载的历史记录 */
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
 * 应用主题（与 settings-page.js 保持一致）
 * @param {string} theme - 主题值：'light', 'dark', 'system'
 */
function applyTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  } else {
    document.documentElement.dataset.theme = theme || 'light';
  }
}

/**
 * 同步主题设置
 * 从主进程获取当前主题并应用
 */
async function syncTheme() {
  try {
    const res = await fetch(`/api/settings/get?token=${encodeURIComponent(apiToken)}`);
    if (res.ok) {
      const settings = await res.json();
      applyTheme(settings.theme || 'light');

      if (settings.theme === 'system') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          applyTheme('system');
        });
      }
    }
  } catch (error) {
    console.error('[Realm] 同步主题失败:', error);
    applyTheme('light');
  }
}

// 立即同步主题，避免页面闪烁
syncTheme();

/**
 * 调用历史记录 HTTP API
 * @param {string} route - API 路由（如 'list'、'delete'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function historyApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/history/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`历史 API 请求失败: ${res.status}`);
  }
  return res.json();
}

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
const elements = {
  historyPage: document.querySelector('.history-page'),
  searchInput: document.getElementById('searchInput'),
  historyContent: document.getElementById('historyContent'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  actionsBar: document.getElementById('actionsBar'),
  selectAllCheckbox: document.getElementById('selectAllCheckbox'),
  selectedCount: document.getElementById('selectedCount'),
  deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  historyClearModal: document.getElementById('historyClearModal'),
  cancelHistoryClearBtn: document.getElementById('cancelHistoryClearBtn'),
  confirmHistoryClearBtn: document.getElementById('confirmHistoryClearBtn'),
  historyBatchDeleteModal: document.getElementById('historyBatchDeleteModal'),
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
  return escaped.replace(regex, '<span class="history-highlight">$1</span>');
}

/**
 * 格式化时间为 HH:MM 格式
 * @param {number} timestamp - 时间戳（毫秒）
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ==================== 日期分组 ====================

/**
 * 按日期分组历史记录
 * @param {Array} records - 历史记录数组
 * @returns {Array<{label: string, records: Array}>} 分组后的数组
 */
function groupByDate(records) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  // 计算本周一的时间
  const dayOfWeek = now.getDay() || 7; // 将周日的 0 转为 7
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - dayOfWeek + 1
  ).getTime();

  // 计算本月 1 日的时间
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const groups = {
    '今天': [],
    '昨天': [],
    '本周': [],
    '本月': [],
    '更早': [],
  };

  for (const record of records) {
    const visitedAt = record.visited_at;
    if (visitedAt >= todayStart) {
      groups['今天'].push(record);
    } else if (visitedAt >= yesterdayStart) {
      groups['昨天'].push(record);
    } else if (visitedAt >= weekStart) {
      groups['本周'].push(record);
    } else if (visitedAt >= monthStart) {
      groups['本月'].push(record);
    } else {
      groups['更早'].push(record);
    }
  }

  // 过滤掉空分组，保持顺序
  return Object.entries(groups)
    .filter(([, records]) => records.length > 0)
    .map(([label, records]) => ({ label, records }));
}

// ==================== 渲染函数 ====================

/**
 * 渲染历史记录列表
 * @param {Array} records - 历史记录数组
 */
function renderHistory(records) {
  elements.historyContent.innerHTML = '';

  if (records.length === 0) {
    renderEmpty();
    return;
  }

  const groups = groupByDate(records);
  for (const group of groups) {
    const groupEl = renderDateGroup(group);
    elements.historyContent.appendChild(groupEl);
  }
}

/**
 * 渲染空状态（先清空列表——清空全部/删除全部后直接调用本函数）
 */
function renderEmpty() {
  elements.historyContent.innerHTML = '';

  const emptyEl = document.createElement('div');
  emptyEl.className = 'history-empty';

  let title = '暂无浏览记录';
  let body = '在浏览器中访问网页后，历史记录会显示在这里';

  // 搜索无结果时的提示
  if (state.keyword) {
    title = '未找到匹配的历史记录';
    body = '尝试使用其他关键词搜索';
  }

  emptyEl.innerHTML = `
    <div class="history-empty-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    </div>
    <div class="history-empty-title">${title}</div>
    <div class="history-empty-body">${body}</div>
  `;

  elements.historyContent.appendChild(emptyEl);
}

/**
 * 渲染日期分组
 * @param {Object} group - 分组对象 { label, records }
 * @returns {HTMLElement} 分组 DOM 元素
 */
function renderDateGroup(group) {
  const groupEl = document.createElement('div');
  groupEl.className = 'history-date-group';

  // 分组头部
  const headerEl = document.createElement('div');
  headerEl.className = 'history-date-header';
  headerEl.textContent = group.label;
  groupEl.appendChild(headerEl);

  // 遍历记录
  for (const record of group.records) {
    const itemEl = renderHistoryItem(record);
    groupEl.appendChild(itemEl);
  }

  return groupEl;
}

/**
 * 渲染单条历史记录
 * @param {Object} record - 历史记录对象
 * @returns {HTMLElement} 记录 DOM 元素
 */
function renderHistoryItem(record) {
  const itemEl = document.createElement('div');
  itemEl.className = 'history-item';
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
    <input type="checkbox" class="history-item-checkbox" data-id="${record.id}" ${state.selectedIds.has(record.id) ? 'checked' : ''}>
    <img class="history-item-favicon" src="${escapeHtml(faviconSrc)}" alt="">
    <div class="history-item-favicon-fallback">${escapeHtml(faviconFallback)}</div>
    <div class="history-item-content">
      <div class="history-item-title">${titleHtml}</div>
      <div class="history-item-url">${urlHtml}</div>
    </div>
    <div class="history-item-time">${formatTime(record.visited_at)}</div>
    <button class="history-item-delete" aria-label="删除">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // favicon 加载失败时显示首字符回退（CSP 禁止 inline onerror/style 属性，用 JS 控制）
  const faviconImg = itemEl.querySelector('.history-item-favicon');
  const faviconFallbackEl = itemEl.querySelector('.history-item-favicon-fallback');
  const showFaviconFallback = () => {
    faviconImg.style.display = 'none';
    faviconFallbackEl.style.display = 'flex';
  };
  if (!faviconSrc) {
    showFaviconFallback();
  } else {
    faviconFallbackEl.style.display = 'none';
    faviconImg.addEventListener('error', showFaviconFallback);
  }

  // 绑定 checkbox 事件
  const checkbox = itemEl.querySelector('.history-item-checkbox');
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      state.selectedIds.add(record.id);
    } else {
      state.selectedIds.delete(record.id);
    }
    updateActionsBar();
  });

  // 绑定删除按钮事件
  const deleteBtn = itemEl.querySelector('.history-item-delete');
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await handleDeleteItem(record.id, itemEl);
  });

  // 标题点击在 webview 中打开
  const titleEl = itemEl.querySelector('.history-item-title');
  titleEl.style.cursor = 'pointer';
  titleEl.addEventListener('click', () => {
    window.open(record.url, '_blank');
  });

  return itemEl;
}

// ==================== 数据加载 ====================

/**
 * 加载历史记录列表
 */
async function loadHistory() {
  state.offset = 0;
  state.hasMore = true;
  state.records = [];

  try {
    let results;
    if (state.keyword) {
      results = await historyApi('search', {}, {
        containerId: state.containerId,
        keyword: state.keyword,
        offset: 0,
        limit: state.limit,
      });
    } else {
      results = await historyApi('list', {}, {
        containerId: state.containerId,
        offset: 0,
        limit: state.limit,
      });
    }

    state.records = results || [];
    state.hasMore = results.length === state.limit;
    renderHistory(state.records);
  } catch (err) {
    console.error('[Realm History] 加载历史记录失败:', err);
    renderEmpty();
  }
}

/**
 * 加载更多历史记录
 */
async function loadMore() {
  if (state.loading || !state.hasMore) return;

  state.loading = true;
  state.offset += state.limit;

  try {
    let results;
    if (state.keyword) {
      results = await historyApi('search', {}, {
        containerId: state.containerId,
        keyword: state.keyword,
        offset: state.offset,
        limit: state.limit,
      });
    } else {
      results = await historyApi('list', {}, {
        containerId: state.containerId,
        offset: state.offset,
        limit: state.limit,
      });
    }

    if (results && results.length > 0) {
      state.records = state.records.concat(results);
      state.hasMore = results.length === state.limit;
      renderHistory(state.records);
    } else {
      state.hasMore = false;
    }
  } catch (err) {
    console.error('[Realm History] 加载更多失败:', err);
  } finally {
    state.loading = false;
  }
}

// ==================== 操作处理 ====================

/**
 * 处理删除单条记录
 * @param {number} id - 记录 ID
 * @param {HTMLElement} itemEl - 记录 DOM 元素
 */
async function handleDeleteItem(id, itemEl) {
  try {
    await historyApi('delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId: state.containerId, id }),
    });

    // 移除 DOM 节点
    itemEl.remove();

    // 从选中集合移除
    state.selectedIds.delete(id);
    updateActionsBar();

    // 检查该日期组是否为空
    const groupEl = itemEl.closest('.history-date-group');
    if (groupEl) {
      const items = groupEl.querySelectorAll('.history-item');
      if (items.length === 0) {
        groupEl.remove();
      }
    }

    // 检查整个列表是否为空
    const allItems = elements.historyContent.querySelectorAll('.history-item');
    if (allItems.length === 0) {
      renderEmpty();
    }

    showToast('已删除 1 条历史记录');
  } catch (err) {
    console.error('[Realm History] 删除记录失败:', err);
  }
}

/**
 * 处理批量删除
 */
async function handleBatchDelete() {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;

  try {
    await historyApi('delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId: state.containerId, ids }),
    });

    // 移除 DOM 节点
    for (const id of ids) {
      const itemEl = elements.historyContent.querySelector(`[data-id="${id}"]`);
      if (itemEl) itemEl.remove();
    }

    // 清空选中集合
    state.selectedIds.clear();
    state.selectAll = false;
    elements.selectAllCheckbox.checked = false;
    updateActionsBar();

    // 移除空的日期组
    const groups = elements.historyContent.querySelectorAll('.history-date-group');
    for (const group of groups) {
      const items = group.querySelectorAll('.history-item');
      if (items.length === 0) {
        group.remove();
      }
    }

    // 检查整个列表是否为空
    const allItems = elements.historyContent.querySelectorAll('.history-item');
    if (allItems.length === 0) {
      renderEmpty();
    }

    showToast(`已删除 ${ids.length} 条历史记录`);
  } catch (err) {
    console.error('[Realm History] 批量删除失败:', err);
  }
}

/**
 * 处理清空所有历史
 */
async function handleClearAll() {
  try {
    await historyApi('clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId: state.containerId }),
    });

    // 清空状态
    state.records = [];
    state.selectedIds.clear();
    state.selectAll = false;
    state.offset = 0;
    state.hasMore = false;
    elements.selectAllCheckbox.checked = false;

    // 显示空状态
    renderEmpty();
    updateActionsBar();

    showToast('已清空所有历史记录');
  } catch (err) {
    console.error('[Realm History] 清空历史失败:', err);
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
  const allCheckboxes = elements.historyContent.querySelectorAll('.history-item-checkbox');
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
  const allCheckboxes = elements.historyContent.querySelectorAll('.history-item-checkbox');
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
  // 搜索框（debounce 300ms）
  const debouncedSearch = debounce(() => {
    state.keyword = elements.searchInput.value.trim();
    loadHistory();
  }, 300);

  elements.searchInput.addEventListener('input', debouncedSearch);

  // 清空按钮 → 打开确认弹窗
  elements.clearAllBtn.addEventListener('click', () => {
    elements.historyClearModal.showModal();
  });

  // 确认清空
  elements.confirmHistoryClearBtn.addEventListener('click', async () => {
    await handleClearAll();
    elements.historyClearModal.close();
  });

  // 取消清空
  elements.cancelHistoryClearBtn.addEventListener('click', () => {
    elements.historyClearModal.close();
  });

  // 全选 checkbox
  elements.selectAllCheckbox.addEventListener('change', toggleSelectAll);

  // 全选按钮
  elements.selectAllBtn.addEventListener('click', toggleSelectAll);

  // 删除选中 → 打开确认弹窗
  elements.deleteSelectedBtn.addEventListener('click', () => {
    const count = state.selectedIds.size;
    elements.batchDeleteBody.textContent = `确定删除选中的 ${count} 条历史记录吗？此操作不可撤销。`;
    elements.historyBatchDeleteModal.showModal();
  });

  // 确认批量删除
  elements.confirmBatchDeleteBtn.addEventListener('click', async () => {
    await handleBatchDelete();
    elements.historyBatchDeleteModal.close();
  });

  // 取消批量删除
  elements.cancelBatchDeleteBtn.addEventListener('click', () => {
    elements.historyBatchDeleteModal.close();
  });

  // 点击弹窗外关闭弹窗
  elements.historyClearModal.addEventListener('click', (e) => {
    if (e.target === elements.historyClearModal) {
      elements.historyClearModal.close();
    }
  });

  elements.historyBatchDeleteModal.addEventListener('click', (e) => {
    if (e.target === elements.historyBatchDeleteModal) {
      elements.historyBatchDeleteModal.close();
    }
  });

  // 滚动加载（滚动容器是 .history-page，body overflow:hidden 时 window scroll 不触发）
  elements.historyPage.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = elements.historyPage;

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
      throw new Error('缺少 API token，无法访问历史数据');
    }

    // 绑定事件监听器
    setupEventListeners();

    // 加载历史记录
    await loadHistory();
  } catch (err) {
    console.error('[Realm History] 初始化失败:', err);
    renderEmpty();
  }
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

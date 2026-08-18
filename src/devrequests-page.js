/**
 * Realm Browser - API 请求记录页面逻辑
 *
 * realm://devrequests 内部页面的渲染逻辑
 * 负责展示开发者模式抓取的 API 请求数据，支持过滤、分页、详情展开
 */

// ==================== 状态管理 ====================

/** URL 查询参数 */
const pageParams = new URLSearchParams(window.location.search);

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
 * 页面状态对象
 * @type {Object}
 */
const state = {
  /** 当前容器 ID */
  containerId: pageParams.get('container') || 'default',
  /** 请求记录列表 */
  records: [],
  /** 总记录数 */
  total: 0,
  /** 当前偏移量 */
  offset: 0,
  /** 每页条数 */
  limit: 50,
  /** 是否正在加载 */
  loading: false,
  /** URL 搜索关键词 */
  keyword: '',
  /** 方法过滤 */
  methodFilter: '',
  /** 域名过滤 */
  domainFilter: '',
  /** 当前展开的记录 ID */
  expandedId: null,
  /** 当前展开详情的 tab */
  activeTab: 'request-headers',
  /** 自动刷新定时器 */
  autoRefreshTimer: null,
};

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
const elements = {
  containerSelect: document.getElementById('containerSelect'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  searchInput: document.getElementById('searchInput'),
  domainFilter: document.getElementById('domainFilter'),
  methodFilter: document.getElementById('methodFilter'),
  refreshBtn: document.getElementById('refreshBtn'),
  requestsBody: document.getElementById('requestsBody'),
  emptyState: document.getElementById('emptyState'),
  pagination: document.getElementById('pagination'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageInfo: document.getElementById('pageInfo'),
  clearConfirmModal: document.getElementById('clearConfirmModal'),
  cancelClearBtn: document.getElementById('cancelClearBtn'),
  confirmClearBtn: document.getElementById('confirmClearBtn'),
  toast: document.getElementById('toast'),
};

// ==================== API 调用 ====================

/**
 * 调用 devrequests HTTP API
 * @param {string} route - API 路由（如 'list'、'domains'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function devrequestsApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/devrequests/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`DevRequests API 请求失败: ${res.status}`);
  }
  return res.json();
}

// ==================== 格式化函数 ====================

/**
 * 格式化 HTTP 方法（带颜色）
 * @param {string} method - HTTP 方法
 * @returns {string} HTML 字符串
 */
function formatMethod(method) {
  const m = (method || '').toUpperCase();
  const cls = `method-${m.toLowerCase()}`;
  return `<span class="${cls}">${escapeHtml(m)}</span>`;
}

/**
 * 格式化状态码（带颜色）
 * @param {number} code - HTTP 状态码
 * @returns {string} HTML 字符串
 */
function formatStatusCode(code) {
  const c = parseInt(code, 10);
  let cls = '';
  if (c >= 200 && c < 300) cls = 'status-2xx';
  else if (c >= 300 && c < 400) cls = 'status-3xx';
  else if (c >= 400 && c < 500) cls = 'status-4xx';
  else if (c >= 500) cls = 'status-5xx';
  return `<span class="${cls}">${c}</span>`;
}

/**
 * 格式化请求时间
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatDuration(ms) {
  if (ms === null || ms === undefined) return '--';
  const msNum = parseInt(ms, 10);
  if (msNum < 1000) return `${msNum}ms`;
  if (msNum < 3000) return `${(msNum / 1000).toFixed(1)}s`;
  return `<span class="status-5xx">${(msNum / 1000).toFixed(1)}s</span>`;
}

/**
 * 格式化响应大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '--';
  const b = parseInt(bytes, 10);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化请求发起时间（created_at 毫秒时间戳）
 * 当天显示 HH:MM:SS，跨天显示 MM-DD HH:MM:SS
 * @param {number} ts - 毫秒时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTimestamp(ts) {
  if (!ts) return '--';
  const d = new Date(parseInt(ts, 10));
  if (isNaN(d.getTime())) return '--';
  const pad = (n) => String(n).padStart(2, '0');
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
  if (sameDay) return hms;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hms}`;
}

/**
 * HTML 转义（防 XSS）
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 数据加载 ====================

/**
 * 加载请求记录
 */
async function loadRequests() {
  if (state.loading) return;
  state.loading = true;

  try {
    const query = {
      containerId: state.containerId,
      offset: state.offset,
      limit: state.limit,
    };

    if (state.keyword) query.search = state.keyword;
    if (state.methodFilter) query.method = state.methodFilter;
    if (state.domainFilter) query.domain = state.domainFilter;

    const result = await devrequestsApi('list', {}, query);

    state.records = result.records || [];
    state.total = result.total || 0;

    renderTable();
    renderPagination();
    updateEmptyState();
  } catch (error) {
    console.error('[Realm DevRequests] 加载请求记录失败:', error);
    showToast('加载请求记录失败');
  } finally {
    state.loading = false;
  }
}

/**
 * 加载域名过滤选项
 */
async function loadDomains() {
  try {
    const domains = await devrequestsApi('domains', {}, { containerId: state.containerId });

    // 清空现有选项（保留默认选项）
    while (elements.domainFilter.options.length > 1) {
      elements.domainFilter.remove(1);
    }

    // 添加域名选项
    domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      elements.domainFilter.appendChild(option);
    });
  } catch (error) {
    console.error('[Realm DevRequests] 加载域名列表失败:', error);
  }
}

// ==================== 渲染函数 ====================

/**
 * 渲染请求表格
 *
 * 展开详情的行通过在同一 tbody 内追加 <tr class="detail-row"><td colspan="6">
 * 实现，保证符合 HTML 表格语义；展开状态由 state.expandedId 驱动，
 * 自动刷新重建 tbody 时详情行随之重建。
 */
function renderTable() {
  // WR-13：DOM 构建 + textContent。URL 来自外部请求，禁止拼入 innerHTML
  elements.requestsBody.innerHTML = '';

  state.records.forEach(record => {
    elements.requestsBody.appendChild(buildRecordRow(record));

    // 当前展开的行：紧跟一行详情
    if (state.expandedId === record.id) {
      elements.requestsBody.appendChild(buildDetailRow(record));
    }
  });
}

/**
 * 构建单条记录行
 * @param {Object} record - 请求记录
 * @returns {HTMLTableRowElement}
 */
function buildRecordRow(record) {
  const tr = document.createElement('tr');
  tr.dataset.id = record.id;

  // 当前展开行高亮
  if (state.expandedId === record.id) {
    tr.classList.add('selected');
  }

  // 方法列
  const tdMethod = document.createElement('td');
  tdMethod.className = 'col-method';
  const methodSpan = document.createElement('span');
  const m = (record.method || '').toUpperCase();
  methodSpan.className = `method-${m.toLowerCase()}`;
  methodSpan.textContent = m;
  methodSpan.style.fontWeight = '600';
  methodSpan.style.fontSize = '12px';
  tdMethod.appendChild(methodSpan);

  // URL 列：点击在来源容器新 tab 打开详情页（realm://devrequests/{id}），
  // stopPropagation 避免触发整行的展开/收起
  const tdUrl = document.createElement('td');
  tdUrl.className = 'col-url';
  const urlDiv = document.createElement('div');
  urlDiv.className = 'url-cell url-link';
  urlDiv.textContent = record.url || '';
  urlDiv.title = `${record.url || ''}\n点击打开详情页`;
  urlDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    // window.open 走主进程 setWindowOpenHandler 拦截（main.js:131），
    // 自动在来源容器新建 Tab，无需通过 IPC 显式通知
    window.open(`realm://devrequests/${record.id}`, '_blank');
  });
  tdUrl.appendChild(urlDiv);

  // 状态码列
  const tdStatus = document.createElement('td');
  tdStatus.className = 'col-status';
  const code = parseInt(record.status_code, 10);
  const statusSpan = document.createElement('span');
  if (code >= 200 && code < 300) statusSpan.className = 'status-2xx';
  else if (code >= 300 && code < 400) statusSpan.className = 'status-3xx';
  else if (code >= 400 && code < 500) statusSpan.className = 'status-4xx';
  else if (code >= 500) statusSpan.className = 'status-5xx';
  statusSpan.textContent = code;
  tdStatus.appendChild(statusSpan);

  // 请求时间列（created_at，请求发起时刻）
  const tdCreatedAt = document.createElement('td');
  tdCreatedAt.className = 'col-created-at';
  tdCreatedAt.textContent = formatTimestamp(record.created_at);
  tdCreatedAt.title = record.created_at
    ? new Date(parseInt(record.created_at, 10)).toLocaleString()
    : '';

  // 耗时列（duration，毫秒）
  const tdTime = document.createElement('td');
  tdTime.className = 'col-time';
  const duration = parseInt(record.duration, 10);
  if (duration >= 3000) {
    const slowSpan = document.createElement('span');
    slowSpan.className = 'status-5xx';
    slowSpan.textContent = `${(duration / 1000).toFixed(1)}s`;
    tdTime.appendChild(slowSpan);
  } else if (duration >= 1000) {
    tdTime.textContent = `${(duration / 1000).toFixed(1)}s`;
  } else {
    tdTime.textContent = `${duration || 0}ms`;
  }

  // 大小列
  const tdSize = document.createElement('td');
  tdSize.className = 'col-size';
  const size = parseInt(record.size, 10);
  if (size < 1024) tdSize.textContent = `${size} B`;
  else if (size < 1024 * 1024) tdSize.textContent = `${(size / 1024).toFixed(1)} KB`;
  else tdSize.textContent = `${(size / (1024 * 1024)).toFixed(1)} MB`;

  tr.appendChild(tdMethod);
  tr.appendChild(tdUrl);
  tr.appendChild(tdStatus);
  tr.appendChild(tdCreatedAt);
  tr.appendChild(tdTime);
  tr.appendChild(tdSize);

  // 点击行展开/收起详情
  tr.addEventListener('click', () => toggleExpand(record));

  return tr;
}

/** 详情面板 tab 定义 */
const DETAIL_TABS = [
  { key: 'request-headers', label: '请求头' },
  { key: 'request-body', label: '请求体' },
  { key: 'response-headers', label: '响应头' },
  { key: 'response-body', label: '响应体' },
  { key: 'cookies', label: 'Cookie' },
];

/**
 * 构建展开详情行（<tr class="detail-row"><td colspan="6">...</td></tr>）
 * @param {Object} record - 请求记录
 * @returns {HTMLTableRowElement}
 */
function buildDetailRow(record) {
  const tr = document.createElement('tr');
  tr.className = 'detail-row';
  tr.dataset.id = `detail-${record.id}`;

  const td = document.createElement('td');
  td.colSpan = 6;
  td.className = 'detail-cell';

  const panel = document.createElement('div');
  panel.className = 'devrequests-detail';

  // tab 头
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'devrequests-detail-tabs';

  // 内容区
  const contentDiv = document.createElement('div');
  contentDiv.className = 'devrequests-detail-content';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-icon devrequests-copy-btn';
  copyBtn.setAttribute('aria-label', '复制');
  // 内联 SVG 是固定图标，无外部输入，可安全使用 innerHTML
  copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  const contentPre = document.createElement('pre');
  contentPre.className = 'devrequests-detail-pre';

  copyBtn.addEventListener('click', () => copyText(contentPre.textContent));

  contentDiv.appendChild(copyBtn);
  contentDiv.appendChild(contentPre);

  DETAIL_TABS.forEach(({ key, label }) => {
    const tabBtn = document.createElement('button');
    tabBtn.className = 'detail-tab' + (state.activeTab === key ? ' active' : '');
    tabBtn.dataset.tab = key;
    tabBtn.textContent = label;
    tabBtn.addEventListener('click', () => {
      state.activeTab = key;
      tabsDiv.querySelectorAll('.detail-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === key);
      });
      renderDetailContent(record, key, contentPre);
    });
    tabsDiv.appendChild(tabBtn);
  });

  panel.appendChild(tabsDiv);
  panel.appendChild(contentDiv);
  td.appendChild(panel);
  tr.appendChild(td);

  // 渲染当前 tab 内容
  renderDetailContent(record, state.activeTab, contentPre);

  return tr;
}

/**
 * 渲染详情面板内容到指定 <pre>
 * @param {Object} record - 请求记录
 * @param {string} tab - 当前 tab key
 * @param {HTMLPreElement} preEl - 目标 pre 元素
 */
function renderDetailContent(record, tab, preEl) {
  let content = '';

  switch (tab) {
    case 'request-headers':
      content = formatJson(record.request_headers);
      break;
    case 'request-body':
      content = record.request_body || '(无请求体)';
      break;
    case 'response-headers':
      content = formatJson(record.response_headers);
      break;
    case 'response-body':
      content = record.response_body || '(无响应体)';
      break;
    case 'cookies':
      content = extractCookies(record.request_headers);
      break;
    default:
      content = '';
  }

  preEl.textContent = content;
}

/**
 * 展开/收起详情面板
 * 仅切换 state.expandedId，由 renderTable 负责实际 DOM 增删
 * @param {Object} record - 请求记录
 */
function toggleExpand(record) {
  if (state.expandedId === record.id) {
    state.expandedId = null;
  } else {
    state.expandedId = record.id;
    state.activeTab = 'request-headers';
  }
  renderTable();
}

/**
 * 渲染分页控件
 */
function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
  const currentPage = Math.floor(state.offset / state.limit) + 1;

  elements.pageInfo.textContent = `第 ${currentPage}/${totalPages} 页`;
  elements.prevPageBtn.disabled = currentPage <= 1;
  elements.nextPageBtn.disabled = currentPage >= totalPages;
}

/**
 * 更新空状态显示
 */
function updateEmptyState() {
  if (state.records.length === 0) {
    elements.emptyState.style.display = 'block';
    elements.pagination.style.display = 'none';
  } else {
    elements.emptyState.style.display = 'none';
    elements.pagination.style.display = 'flex';
  }
}

// ==================== 详情面板 ====================

/**
 * 格式化 JSON 对象
 * @param {*} data - 数据
 * @returns {string} 格式化后的 JSON 字符串
 */
function formatJson(data) {
  if (!data) return '(无数据)';
  try {
    if (typeof data === 'string') {
      return JSON.stringify(JSON.parse(data), null, 2);
    }
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * 从请求头中提取 Cookie
 * @param {Object|string} headers - 请求头
 * @returns {string} 格式化后的 Cookie 字符串
 */
function extractCookies(headers) {
  if (!headers) return '(无 Cookie)';

  try {
    const h = typeof headers === 'string' ? JSON.parse(headers) : headers;
    const cookie = h.Cookie || h.cookie || '';
    if (!cookie) return '(无 Cookie)';

    // 格式化 Cookie：每个 cookie 一行
    return cookie.split(';').map(c => c.trim()).join('\n');
  } catch {
    return '(无法解析 Cookie)';
  }
}

// ==================== 交互操作 ====================

/**
 * 清空所有请求
 */
async function clearAll() {
  try {
    const result = await devrequestsApi('clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId: state.containerId }),
    });

    showToast(`已清空 ${result.deletedCount || 0} 条记录`);
    state.offset = 0;
    state.expandedId = null;
    await loadRequests();
    await loadDomains();
  } catch (error) {
    console.error('[Realm DevRequests] 清空请求失败:', error);
    showToast('清空失败');
  }
}

/**
 * 复制文本到剪贴板
 * @param {string} content - 要复制的文本
 */
async function copyText(content) {
  if (!content) return;

  try {
    await navigator.clipboard.writeText(content);
    showToast('已复制到剪贴板');
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('已复制到剪贴板');
  }
}

/**
 * 显示 Toast 提示
 * @param {string} message - 提示消息
 */
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2000);
}

// ==================== 自动刷新 ====================

/**
 * 启动自动刷新（每 3 秒）
 * 仅在第一页且无过滤条件时启用
 */
function startAutoRefresh() {
  stopAutoRefresh();

  // 仅在第一页且无过滤条件时启用自动刷新
  if (state.offset > 0 || state.keyword || state.methodFilter || state.domainFilter) {
    return;
  }

  state.autoRefreshTimer = setInterval(async () => {
    // 跳过正在加载或非第一页的情况
    if (state.loading || state.offset > 0) return;

    try {
      const result = await devrequestsApi('list', {}, {
        containerId: state.containerId,
        offset: 0,
        limit: state.limit,
      });

      const newRecords = result.records || [];

      // 检查是否有新数据
      if (newRecords.length > 0 && newRecords.length !== state.records.length) {
        state.records = newRecords;
        state.total = result.total || 0;
        renderTable();
        renderPagination();
        updateEmptyState();
      }
    } catch {
      // 静默失败，不打扰用户
    }
  }, 3000);
}

/**
 * 停止自动刷新
 */
function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

// ==================== 事件监听 ====================

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 搜索输入（防抖 300ms）
  let searchTimer = null;
  elements.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.keyword = elements.searchInput.value.trim();
      state.offset = 0;
      loadRequests();
      startAutoRefresh();
    }, 300);
  });

  // 域名过滤
  elements.domainFilter.addEventListener('change', () => {
    state.domainFilter = elements.domainFilter.value;
    state.offset = 0;
    loadRequests();
    startAutoRefresh();
  });

  // 方法过滤
  elements.methodFilter.addEventListener('change', () => {
    state.methodFilter = elements.methodFilter.value;
    state.offset = 0;
    loadRequests();
    startAutoRefresh();
  });

  // 刷新按钮
  elements.refreshBtn.addEventListener('click', () => {
    loadRequests();
    loadDomains();
  });

  // 清空按钮
  elements.clearAllBtn.addEventListener('click', () => {
    elements.clearConfirmModal.showModal();
  });

  // 确认清空
  elements.confirmClearBtn.addEventListener('click', async () => {
    elements.clearConfirmModal.close();
    await clearAll();
  });

  // 取消清空
  elements.cancelClearBtn.addEventListener('click', () => {
    elements.clearConfirmModal.close();
  });

  // 点击模态框外部关闭
  elements.clearConfirmModal.addEventListener('click', (e) => {
    if (e.target === elements.clearConfirmModal) {
      elements.clearConfirmModal.close();
    }
  });

  // 上一页
  elements.prevPageBtn.addEventListener('click', () => {
    if (state.offset >= state.limit) {
      state.offset -= state.limit;
      loadRequests();
      stopAutoRefresh();
    }
  });

  // 下一页
  elements.nextPageBtn.addEventListener('click', () => {
    if (state.offset + state.limit < state.total) {
      state.offset += state.limit;
      loadRequests();
      stopAutoRefresh();
    }
  });

  // 容器切换
  elements.containerSelect.addEventListener('change', () => {
    state.containerId = elements.containerSelect.value;
    state.offset = 0;
    state.expandedId = null;
    loadRequests();
    loadDomains();
  });

  // 页面卸载时停止自动刷新
  window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
  });
}

// ==================== 初始化 ====================

/**
 * 加载容器列表并填充选择器
 * 当前容器从 URL 参数获取；若不在列表中（如 'default' 兜底），回落到第一个容器
 */
async function loadContainers() {
  try {
    const params = new URLSearchParams({ token: apiToken });
    const res = await fetch(`/api/containers/list?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const containers = await res.json();

    containers.forEach(container => {
      const option = document.createElement('option');
      option.value = container.id;
      option.textContent = `${container.icon || ''} ${container.name || container.id}`.trim();
      elements.containerSelect.appendChild(option);
    });

    const ids = containers.map(c => c.id);
    if (!ids.includes(state.containerId) && ids.length > 0) {
      state.containerId = ids[0];
    }
    elements.containerSelect.value = state.containerId;
  } catch (error) {
    console.error('[Realm DevRequests] 加载容器列表失败:', error);
    // 兜底：至少保留当前容器选项，保证页面可用
    const containerOption = document.createElement('option');
    containerOption.value = state.containerId;
    containerOption.textContent = state.containerId;
    elements.containerSelect.appendChild(containerOption);
  }
}

/**
 * 初始化页面
 */
async function init() {
  console.log('[Realm DevRequests] 页面初始化');

  // 填充容器选择器（完整容器列表）
  await loadContainers();

  // 设置事件监听
  setupEventListeners();

  // 加载数据
  await loadDomains();
  await loadRequests();

  // 启动自动刷新
  startAutoRefresh();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

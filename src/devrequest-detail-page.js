/**
 * Realm Browser - 请求详情页逻辑
 *
 * realm://devrequests/{id} 内部页面
 * 展示单条 API 请求的完整信息：URL/方法/参数/Headers/Body/Cookie
 * 请求体和响应体支持 JSON 原始/格式化切换
 */

// ==================== 状态管理 ====================

/** URL 查询参数 */
const pageParams = new URLSearchParams(window.location.search);

/** API token（来自 URL 查询参数） */
const apiToken = pageParams.get('token') || '';

/**
 * 从 path 解析记录 ID：/devrequests/123 → 123
 * @returns {number|null}
 */
function parseRecordIdFromPath() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  // segments[0] = 'devrequests', segments[1] = id
  const id = parseInt(segments[1], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * 页面状态
 * @type {Object}
 */
const state = {
  /** 当前容器 ID */
  containerId: pageParams.get('container') || 'default',
  /** 记录 ID（来自 path） */
  recordId: parseRecordIdFromPath(),
  /** 记录数据 */
  record: null,
  /** 当前激活 tab */
  activeTab: 'params',
  /** 请求体显示格式：'pretty' 格式化 / 'raw' 原始 */
  requestBodyFormat: 'pretty',
  /** 响应体显示格式 */
  responseBodyFormat: 'pretty',
};

// ==================== DOM 元素 ====================

const elements = {
  loadingState: document.getElementById('loadingState'),
  errorState: document.getElementById('errorState'),
  detailMain: document.getElementById('detailMain'),
  detailHeader: document.getElementById('detailHeader'),
  detailTabs: document.getElementById('detailTabs'),
  detailContent: document.getElementById('detailContent'),
  toast: document.getElementById('toast'),
};

// ==================== 数据加载 ====================

/**
 * 加载记录详情
 */
async function loadRecord() {
  if (!state.recordId) {
    showError('无效的记录 ID');
    return;
  }

  try {
    const params = new URLSearchParams({
      token: apiToken,
      containerId: state.containerId,
      id: state.recordId,
    });
    const res = await fetch(`/api/devrequests/detail?${params.toString()}`);
    if (res.status === 404) {
      showError('记录不存在或已被清理');
      return;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    state.record = await res.json();

    elements.loadingState.style.display = 'none';
    elements.detailMain.style.display = 'block';

    renderHeader();
    renderContent();
  } catch (error) {
    console.error('[Realm DevRequest Detail] 加载失败:', error);
    showError(`加载失败: ${error.message}`);
  }
}

/**
 * 显示错误状态
 * @param {string} message - 错误信息
 */
function showError(message) {
  elements.loadingState.style.display = 'none';
  elements.detailMain.style.display = 'none';
  elements.errorState.style.display = 'block';
  elements.errorState.textContent = message;
}

// ==================== 格式化工具 ====================

/**
 * 格式化耗时
 * @param {number} ms - 毫秒
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms === null || ms === undefined) return '--';
  const n = parseInt(ms, 10);
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

/**
 * 格式化大小
 * @param {number} bytes - 字节
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '--';
  const b = parseInt(bytes, 10);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化完整时间
 * @param {number} ts - 毫秒时间戳
 * @returns {string}
 */
function formatFullTime(ts) {
  if (!ts) return '--';
  const d = new Date(parseInt(ts, 10));
  if (isNaN(d.getTime())) return '--';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 尝试解析 JSON，失败返回 null
 * @param {string} text
 * @returns {*|null}
 */
function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 格式化 JSON 对象（用于 headers 等已解析为对象的数据）
 * @param {*} data
 * @returns {string}
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
 * 解析 URL 中的 query 参数
 * @param {string} url
 * @returns {Array<{key: string, value: string}>}
 */
function parseQueryParams(url) {
  if (!url) return [];
  try {
    const u = new URL(url);
    const params = [];
    u.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    return params;
  } catch {
    return [];
  }
}

/**
 * 从请求头中提取 Cookie
 * @param {Object|string} headers
 * @returns {string}
 */
function extractCookies(headers) {
  if (!headers) return '(无 Cookie)';
  try {
    const h = typeof headers === 'string' ? JSON.parse(headers) : headers;
    const cookie = h.Cookie || h.cookie || '';
    if (!cookie) return '(无 Cookie)';
    return cookie.split(';').map(c => c.trim()).join('\n');
  } catch {
    return '(无法解析 Cookie)';
  }
}

// ==================== 渲染：Header ====================

/**
 * 渲染顶部通用信息区
 */
function renderHeader() {
  const record = state.record;
  const header = elements.detailHeader;
  header.innerHTML = '';

  // 第一行：方法徽标 + URL + 访问按钮
  const urlRow = document.createElement('div');
  urlRow.className = 'detail-url-row';

  const methodBadge = document.createElement('span');
  const m = (record.method || 'GET').toUpperCase();
  methodBadge.className = `method-badge method-${m.toLowerCase()}`;
  methodBadge.textContent = m;

  const urlText = document.createElement('span');
  urlText.className = 'detail-url';
  urlText.textContent = record.url || '';
  urlText.title = record.url || '';

  const openBtn = document.createElement('button');
  openBtn.className = 'btn btn-secondary btn-sm detail-open-btn';
  openBtn.textContent = '访问页面';
  openBtn.title = '在新 tab 打开此 URL';
  openBtn.addEventListener('click', () => {
    if (record.url) {
      window.open(record.url, '_blank');
    }
  });

  urlRow.appendChild(methodBadge);
  urlRow.appendChild(urlText);
  urlRow.appendChild(openBtn);

  // 第二行：状态码 / 耗时 / 大小 / 请求时间
  const metaRow = document.createElement('div');
  metaRow.className = 'detail-meta';

  // 状态码
  const code = parseInt(record.status_code, 10);
  const statusSpan = document.createElement('span');
  statusSpan.className = 'meta-item meta-status';
  let statusCls = '';
  if (code >= 200 && code < 300) statusCls = 'status-2xx';
  else if (code >= 300 && code < 400) statusCls = 'status-3xx';
  else if (code >= 400 && code < 500) statusCls = 'status-4xx';
  else if (code >= 500) statusCls = 'status-5xx';
  const statusBadge = document.createElement('span');
  statusBadge.className = statusCls;
  statusBadge.textContent = code || '--';
  statusSpan.appendChild(statusBadge);

  metaRow.appendChild(statusSpan);
  metaRow.appendChild(buildMetaItem('耗时', formatDuration(record.duration)));
  metaRow.appendChild(buildMetaItem('大小', formatSize(record.size)));
  metaRow.appendChild(buildMetaItem('请求时间', formatFullTime(record.created_at)));
  if (record.content_type) {
    metaRow.appendChild(buildMetaItem('类型', record.content_type));
  }

  header.appendChild(urlRow);
  header.appendChild(metaRow);
}

/**
 * 构建元信息项
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
function buildMetaItem(label, value) {
  const item = document.createElement('span');
  item.className = 'meta-item';

  const labelEl = document.createElement('span');
  labelEl.className = 'meta-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'meta-value';
  valueEl.textContent = value;

  item.appendChild(labelEl);
  item.appendChild(valueEl);
  return item;
}

// ==================== 渲染：Content ====================

/**
 * 渲染当前 tab 的内容
 */
function renderContent() {
  const container = elements.detailContent;
  container.innerHTML = '';

  const record = state.record;
  if (!record) return;

  switch (state.activeTab) {
    case 'params':
      renderParamsTab(container);
      break;
    case 'request-headers':
      container.appendChild(buildPreSection('请求头', formatJson(record.request_headers)));
      break;
    case 'response-headers':
      container.appendChild(buildPreSection('响应头', formatJson(record.response_headers)));
      break;
    case 'response-body':
      container.appendChild(buildBodySection('响应体', record.response_body, 'response'));
      break;
    case 'cookies':
      container.appendChild(buildPreSection('Cookie', extractCookies(record.request_headers)));
      break;
  }
}

/**
 * 渲染"参数"tab：Query 参数表格 + 请求体
 * @param {HTMLElement} container
 */
function renderParamsTab(container) {
  const record = state.record;
  const params = parseQueryParams(record.url);
  const hasBody = record.request_body && record.request_body.length > 0;

  if (params.length === 0 && !hasBody) {
    const empty = document.createElement('div');
    empty.className = 'detail-empty-hint';
    empty.textContent = '(无 Query 参数，无请求体)';
    container.appendChild(empty);
    return;
  }

  if (params.length > 0) {
    container.appendChild(buildQueryTable(params));
  }

  if (hasBody) {
    container.appendChild(buildBodySection('请求体', record.request_body, 'request'));
  }
}

/**
 * 构建 Query 参数表格 section
 * @param {Array<{key: string, value: string}>} params
 * @returns {HTMLElement}
 */
function buildQueryTable(params) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const header = buildSectionHeader('Query 参数', () => {
    const json = params.map(p => `${p.key}=${p.value}`).join('\n');
    copyText(json);
  });
  section.appendChild(header);

  const table = document.createElement('table');
  table.className = 'params-table';

  params.forEach(({ key, value }) => {
    const tr = document.createElement('tr');

    const tdKey = document.createElement('td');
    tdKey.className = 'param-key';
    tdKey.textContent = key;

    const tdValue = document.createElement('td');
    tdValue.className = 'param-value';
    tdValue.textContent = value;

    tr.appendChild(tdKey);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  });

  section.appendChild(table);
  return section;
}

/**
 * 构建带切换的 body section（请求体 / 响应体）
 * 如果内容是有效 JSON，提供"格式化 / 原始"切换按钮
 * @param {string} title - 标题
 * @param {string} body - 原始 body 字符串
 * @param {'request'|'response'} kind - 用于独立记录格式状态
 * @returns {HTMLElement}
 */
function buildBodySection(title, body, kind) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const formatKey = kind === 'request' ? 'requestBodyFormat' : 'responseBodyFormat';
  const parsed = tryParseJson(body);
  const isJson = parsed !== null;
  const currentFormat = state[formatKey];

  // pre 内容
  const pre = document.createElement('pre');
  pre.className = 'detail-pre';
  if (isJson && currentFormat === 'pretty') {
    pre.textContent = JSON.stringify(parsed, null, 2);
  } else {
    pre.textContent = body || '(无内容)';
  }

  // 格式切换按钮（仅 JSON 内容提供）
  let toggleBtn = null;
  if (isJson) {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-icon detail-action-btn';
    toggleBtn.title = currentFormat === 'pretty' ? '查看原始字符串' : '查看格式化 JSON';
    toggleBtn.textContent = currentFormat === 'pretty' ? '原始' : '格式化';
    toggleBtn.addEventListener('click', () => {
      state[formatKey] = currentFormat === 'pretty' ? 'raw' : 'pretty';
      renderContent(); // 重建当前 tab，按钮文本随之更新
    });
  }

  const header = buildSectionHeader(title, () => copyText(pre.textContent), toggleBtn);
  section.appendChild(header);
  section.appendChild(pre);
  return section;
}

/**
 * 构建通用的 pre section（无格式切换）
 * @param {string} title
 * @param {string} content
 * @returns {HTMLElement}
 */
function buildPreSection(title, content) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const header = buildSectionHeader(title, () => copyText(content));
  section.appendChild(header);

  const pre = document.createElement('pre');
  pre.className = 'detail-pre';
  pre.textContent = content;
  section.appendChild(pre);

  return section;
}

/**
 * 构建 section header：标题 + 操作按钮区
 * @param {string} title
 * @param {Function} onCopy - 复制按钮回调
 * @param {HTMLElement|null} [extraAction] - 可选的额外按钮元素（如格式切换）
 * @returns {HTMLElement}
 */
function buildSectionHeader(title, onCopy, extraAction) {
  const header = document.createElement('div');
  header.className = 'detail-section-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'section-title';
  titleEl.textContent = title;

  const actions = document.createElement('div');
  actions.className = 'section-actions';

  if (extraAction) {
    actions.appendChild(extraAction);
  }

  // 复制按钮
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-icon detail-action-btn';
  copyBtn.title = '复制';
  copyBtn.textContent = '复制';
  copyBtn.addEventListener('click', onCopy);
  actions.appendChild(copyBtn);

  header.appendChild(titleEl);
  header.appendChild(actions);
  return header;
}

// ==================== 工具 ====================

/**
 * 复制文本到剪贴板
 * @param {string} content
 */
async function copyText(content) {
  if (!content) return;

  try {
    await navigator.clipboard.writeText(content);
    showToast('已复制到剪贴板');
  } catch {
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
 * 显示 Toast
 * @param {string} message
 */
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2000);
}

// ==================== 事件 ====================

/**
 * 设置事件监听
 */
function setupEventListeners() {
  // tab 切换
  elements.detailTabs.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.activeTab = tab.dataset.tab;
      elements.detailTabs.querySelectorAll('.detail-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === state.activeTab);
      });
      renderContent();
    });
  });
}

// ==================== 初始化 ====================

/**
 * 初始化
 */
async function init() {
  setupEventListeners();
  await loadRecord();
}

document.addEventListener('DOMContentLoaded', init);

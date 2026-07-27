/**
 * Realm Browser - 新标签页逻辑
 *
 * realm://newtab 内部页面的渲染逻辑
 * 负责常用网站网格展示、搜索功能
 */

// ==================== 状态管理 ====================

// 页面运行在 webview guest 中，IPC 会被主进程 assertTrustedSender（CR-4）拒绝，
// 因此数据访问走本地 HTTP 服务器的 /api/frequent-sites/* 端点。
// API token 由渲染进程创建 webview 时注入 URL 查询参数。
const pageParams = new URLSearchParams(window.location.search);

/**
 * 页面状态对象
 * @type {Object}
 */
const state = {
  /** 常用网站数据 */
  sites: [],
};

/** API token（来自 URL 查询参数） */
const apiToken = pageParams.get('token') || '';

// ==================== API 调用 ====================

/**
 * 调用常用网站 HTTP API
 * @param {string} route - API 路由（如 'list'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function frequentSitesApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/frequent-sites/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`常用网站 API 请求失败: ${res.status}`);
  }
  return res.json();
}

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
const elements = {
  frequentSitesGrid: document.getElementById('frequentSitesGrid'),
  frequentEmpty: document.getElementById('frequentEmpty'),
  newTabSearch: document.getElementById('newTabSearch'),
};

// ==================== 渲染函数 ====================

/**
 * URL 标准化（与地址栏 normalizeUrl 逻辑保持一致）
 * @param {string} input - 用户输入
 * @returns {string} 标准化后的 URL
 */
function normalizeUrl(input) {
  input = input.trim();

  // 已经是完整的 HTTP/HTTPS URL
  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  // realm:// 自定义协议 URL
  if (/^realm:\/\//i.test(input)) {
    return input;
  }

  // 看起来像域名（含点号，如 baidu.com），补全 https://
  if (/^[\w-]+(\.[\w-]+)+/.test(input)) {
    return `https://${input}`;
  }

  // 其他情况当作搜索查询
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

/**
 * 渲染常用网站网格
 * @param {Array} sites - 常用网站列表
 */
function renderSites(sites) {
  if (!sites || sites.length === 0) {
    elements.frequentSitesGrid.style.display = 'none';
    elements.frequentEmpty.style.display = 'flex';
    return;
  }

  elements.frequentEmpty.style.display = 'none';
  elements.frequentSitesGrid.style.display = 'grid';

  // 清空现有内容
  elements.frequentSitesGrid.innerHTML = '';

  // 创建网站卡片
  sites.forEach(site => {
    const card = document.createElement('a');
    card.className = 'frequent-site-card';
    card.href = site.url;
    card.target = '_self'; // 在当前 webview 导航
    card.title = site.title || site.domain;

    // favicon：经本地 API 代理拉取，无图标的域名由服务端统一回退为应用图标
    const favicon = document.createElement('img');
    favicon.className = 'frequent-site-favicon';
    favicon.src = `/api/frequent-sites/favicon?domain=${encodeURIComponent(site.domain)}&token=${encodeURIComponent(apiToken)}`;
    favicon.alt = site.title || site.domain;
    favicon.onerror = () => {
      // 代理不可用的极端兜底：本地应用图标（防循环加载，只换一次）
      favicon.onerror = null;
      favicon.src = 'realm-icon.png';
    };

    // 标题
    const title = document.createElement('div');
    title.className = 'frequent-site-title';
    title.textContent = site.title || site.domain;

    card.appendChild(favicon);
    card.appendChild(title);
    elements.frequentSitesGrid.appendChild(card);
  });
}

// ==================== 初始化 ====================

/**
 * 初始化新标签页
 */
async function init() {
  console.log('[Realm] 新标签页初始化');

  try {
    // 加载常用网站
    const sites = await frequentSitesApi('list', {}, { limit: 12 });
    state.sites = sites;
    renderSites(sites);
  } catch (error) {
    console.error('[Realm] 加载常用网站失败:', error);
    renderSites([]);
  }

  // 搜索框回车事件（URL 判断逻辑与地址栏一致）
  elements.newTabSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = elements.newTabSearch.value.trim();
      if (value) {
        window.location.href = normalizeUrl(value);
        elements.newTabSearch.value = '';
      }
    }
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

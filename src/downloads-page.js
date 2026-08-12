/**
 * Realm Browser - 下载内容页面（realm://downloads）
 *
 * 通过 HTTP API 获取下载记录，支持搜索、分页、操作。
 * 参考 src/favorites-page.js 的数据获取模式。
 */

// ==================== 状态 ====================

/** @type {number} 内部 HTTP 服务端口 */
let realmPort = null;

/** @type {string} API 鉴权 token */
let realmToken = null;

/** @type {string} 当前搜索关键字 */
let currentSearch = '';

/** @type {number} 当前分页偏移 */
let currentOffset = 0;

/** @type {number} 每页数量 */
const PAGE_SIZE = 50;

/** @type {boolean} 是否还有更多数据 */
let hasMore = true;

/** @type {boolean} 是否正在加载 */
let isLoading = false;

/** @type {number|null} 搜索防抖定时器 */
let searchDebounceTimer = null;

/** @type {Object|null} 待删除的下载信息 */
let pendingDeleteDownload = null;

// ==================== 初始化 ====================

/**
 * 页面初始化入口
 * 从 URL 参数中获取 port 和 token，然后加载数据
 */
async function init() {
  // 从 URL 参数获取 port 和 token
  const params = new URLSearchParams(window.location.search);
  realmPort = params.get('port');
  realmToken = params.get('token');

  if (!realmPort || !realmToken) {
    console.error('[Downloads Page] 缺少 port 或 token 参数');
    return;
  }

  // 绑定事件
  bindEvents();

  // 加载第一页数据
  await loadDownloads(true);
}

/**
 * 绑定页面事件
 */
function bindEvents() {
  // 搜索输入
  const searchInput = document.getElementById('downloadsSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentSearch = searchInput.value.trim();
        loadDownloads(true);
      }, 300);
    });
  }

  // 清空所有按钮
  const clearAllBtn = document.getElementById('downloadsClearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      const modal = document.getElementById('downloadsClearModal');
      if (modal) modal.showModal();
    });
  }

  // 清空确认弹窗按钮
  const clearCancelBtn = document.getElementById('downloadsClearCancelBtn');
  const clearConfirmBtn = document.getElementById('downloadsClearConfirmBtn');
  if (clearCancelBtn) {
    clearCancelBtn.addEventListener('click', () => {
      document.getElementById('downloadsClearModal')?.close();
    });
  }
  if (clearConfirmBtn) {
    clearConfirmBtn.addEventListener('click', async () => {
      document.getElementById('downloadsClearModal')?.close();
      await executeClearAll();
    });
  }

  // 删除确认弹窗按钮
  const deleteCancelBtn = document.getElementById('downloadsDeleteCancelBtn');
  const deleteConfirmBtn = document.getElementById('downloadsDeleteConfirmBtn');
  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', () => {
      document.getElementById('downloadsDeleteModal')?.close();
    });
  }
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', async () => {
      document.getElementById('downloadsDeleteModal')?.close();
      await executeDeleteDownload();
    });
  }

  // 滚动加载更多
  window.addEventListener('scroll', () => {
    if (isLoading || !hasMore) return;
    const scrollBottom = window.innerHeight + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    if (scrollBottom >= docHeight - 200) {
      loadDownloads(false);
    }
  });
}

// ==================== 数据加载 ====================

/**
 * 加载下载记录
 * @param {boolean} reset - 是否重置列表（新搜索或首次加载）
 */
async function loadDownloads(reset = false) {
  if (isLoading) return;
  isLoading = true;

  if (reset) {
    currentOffset = 0;
    hasMore = true;
  }

  const loadingEl = document.getElementById('downloadsLoadingMore');
  if (loadingEl) loadingEl.classList.remove('hidden');

  try {
    let url = `http://localhost:${realmPort}/api/downloads/list?token=${realmToken}&limit=${PAGE_SIZE}&offset=${currentOffset}`;
    if (currentSearch) {
      url += `&search=${encodeURIComponent(currentSearch)}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      const downloads = data.downloads || [];
      renderDownloads(downloads, reset);
      currentOffset += downloads.length;
      hasMore = downloads.length >= PAGE_SIZE;
    } else {
      console.error('[Downloads Page] 获取下载列表失败:', data.error);
    }
  } catch (error) {
    console.error('[Downloads Page] 请求下载列表失败:', error);
  } finally {
    isLoading = false;
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

// ==================== 渲染 ====================

/**
 * 渲染下载列表
 * @param {Array} downloads - 下载记录数组
 * @param {boolean} reset - 是否替换（而非追加）
 */
function renderDownloads(downloads, reset = false) {
  const listEl = document.getElementById('downloadsPageList');
  const emptyEl = document.getElementById('downloadsEmptyState');
  if (!listEl || !emptyEl) return;

  if (reset) {
    listEl.innerHTML = '';
  }

  if (downloads.length === 0 && reset) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const html = downloads.map(item => renderDownloadItem(item)).join('');
  listEl.insertAdjacentHTML('beforeend', html);

  // 绑定新增项的事件
  bindItemActions(listEl);
}

/**
 * 渲染单个下载项 HTML
 * @param {Object} item - 下载记录
 * @returns {string} HTML 字符串
 */
function renderDownloadItem(item) {
  const stateClass = item.state || 'completed';
  const isActive = stateClass === 'progressing';
  const isPaused = stateClass === 'paused';
  const isInterrupted = stateClass === 'interrupted';

  // 进度条
  let progressClass = 'hidden';
  let barClass = 'accent';
  if (isActive) {
    progressClass = '';
    barClass = 'accent';
  } else if (isPaused) {
    progressClass = '';
    barClass = 'muted';
  } else if (isInterrupted) {
    progressClass = '';
    barClass = 'danger';
  }

  // 状态文本
  let statusText = '';
  if (isActive) {
    const speed = item.speed ? formatFileSize(item.speed) + '/s' : '计算中...';
    statusText = `下载中 · ${speed}`;
  } else if (isPaused) {
    statusText = '已暂停';
  } else if (isInterrupted) {
    statusText = '下载失败';
  }

  // 时间
  const timeStr = item.startTime ? formatRelativeTime(item.startTime) : '';

  // 操作按钮
  let actionsHtml = '';
  if (isActive) {
    actionsHtml = `
      <button class="btn-icon download-item-pause-btn" data-id="${escapeHtml(item.id)}" title="暂停">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
      </button>
      <button class="btn-icon download-item-delete-btn" data-id="${escapeHtml(item.id)}" data-filename="${escapeHtml(item.filename)}" data-state="${stateClass}" title="删除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>`;
  } else if (isPaused || isInterrupted) {
    actionsHtml = `
      <button class="btn-icon download-item-resume-btn" data-id="${escapeHtml(item.id)}" title="恢复">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </button>
      <button class="btn-icon download-item-delete-btn" data-id="${escapeHtml(item.id)}" data-filename="${escapeHtml(item.filename)}" data-state="${stateClass}" title="删除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>`;
  } else {
    actionsHtml = `
      <button class="btn-icon download-item-open-btn" data-path="${escapeHtml(item.savePath || '')}" title="打开文件">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </button>
      <button class="btn-icon download-item-folder-btn" data-path="${escapeHtml(item.savePath || '')}" title="在 Finder 中显示">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      </button>
      <button class="btn-icon download-item-delete-btn" data-id="${escapeHtml(item.id)}" data-filename="${escapeHtml(item.filename)}" data-state="${stateClass}" title="删除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>`;
  }

  return `
    <div class="download-item" data-id="${escapeHtml(item.id)}" data-state="${stateClass}">
      <div class="download-item-icon">
        ${getFileTypeIcon(item.mimeType)}
      </div>
      <div class="download-item-info">
        <div class="download-item-name" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</div>
        <div class="download-item-meta">
          <span class="download-item-size">${item.totalBytes ? formatFileSize(item.totalBytes) : ''}</span>
          ${item.totalBytes && timeStr ? '<span class="download-item-separator">·</span>' : ''}
          <span class="download-item-time">${timeStr}</span>
          ${statusText ? `<span class="download-item-status">${statusText}</span>` : ''}
        </div>
        <div class="download-item-progress ${progressClass}">
          <div class="download-item-progress-bar ${barClass}" style="width: ${item.progress || 0}%"></div>
        </div>
      </div>
      <div class="download-item-actions">
        ${actionsHtml}
      </div>
    </div>`;
}

/**
 * 绑定列表项操作事件
 * @param {HTMLElement} listEl - 列表容器
 */
function bindItemActions(listEl) {
  // 使用事件委托
  listEl.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-id], [data-path]');
    if (!target) return;

    e.stopPropagation();

    // 暂停
    if (target.classList.contains('download-item-pause-btn')) {
      await apiAction(`/api/downloads/pause`, { downloadId: target.dataset.id });
      return;
    }

    // 恢复
    if (target.classList.contains('download-item-resume-btn')) {
      await apiAction(`/api/downloads/resume`, { downloadId: target.dataset.id });
      return;
    }

    // 打开文件
    if (target.classList.contains('download-item-open-btn')) {
      await apiAction(`/api/downloads/open`, { filePath: target.dataset.path });
      return;
    }

    // Finder
    if (target.classList.contains('download-item-folder-btn')) {
      await apiAction(`/api/downloads/show-in-folder`, { filePath: target.dataset.path });
      return;
    }

    // 删除
    if (target.classList.contains('download-item-delete-btn')) {
      pendingDeleteDownload = {
        downloadId: target.dataset.id,
        filename: target.dataset.filename,
        isInProgress: target.dataset.state === 'progressing',
      };

      // 如果进行中，先取消
      if (pendingDeleteDownload.isInProgress) {
        await apiAction(`/api/downloads/cancel`, { downloadId: target.dataset.id });
      }

      const desc = document.getElementById('downloadsDeleteDesc');
      if (desc) {
        desc.textContent = `确定要删除「${target.dataset.filename}」的下载记录吗？`;
      }

      const checkbox = document.getElementById('downloadsDeleteFileCheckbox');
      if (checkbox) checkbox.checked = false;

      const modal = document.getElementById('downloadsDeleteModal');
      if (modal) modal.showModal();
    }
  });
}

// ==================== API 操作 ====================

/**
 * 执行 API 操作
 * @param {string} path - API 路径
 * @param {Object} body - 请求体
 */
async function apiAction(path, body = {}) {
  try {
    const response = await fetch(`http://localhost:${realmPort}${path}?token=${realmToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.success) {
      // 操作成功后刷新列表
      loadDownloads(true);
    } else {
      console.error(`[Downloads Page] API 操作失败: ${path}`, data.error);
    }
  } catch (error) {
    console.error(`[Downloads Page] API 请求失败: ${path}`, error);
  }
}

/**
 * 执行删除下载
 */
async function executeDeleteDownload() {
  if (!pendingDeleteDownload) return;

  const checkbox = document.getElementById('downloadsDeleteFileCheckbox');
  const deleteFile = checkbox ? checkbox.checked : false;

  await apiAction(`/api/downloads/delete`, {
    downloadId: pendingDeleteDownload.downloadId,
    deleteFile,
  });

  pendingDeleteDownload = null;
}

/**
 * 执行清空所有下载
 */
async function executeClearAll() {
  await apiAction(`/api/downloads/clear`);
}

// ==================== 工具函数 ====================

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * 格式化相对时间
 * @param {number} timestamp - Unix 时间戳（秒）
 * @returns {string} 相对时间文本
 */
function formatRelativeTime(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';

  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 根据 MIME 类型返回 Lucide SVG 图标
 * @param {string} mimeType - MIME 类型
 * @returns {string} SVG 图标 HTML
 */
function getFileTypeIcon(mimeType) {
  if (!mimeType) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
  }

  if (mimeType === 'application/pdf') {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
  }

  if (mimeType.startsWith('image/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
  }

  if (mimeType.startsWith('video/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
  }

  if (mimeType.startsWith('audio/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
  }

  if (mimeType === 'application/zip' || mimeType.includes('compress')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  }

  if (mimeType.startsWith('text/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
  }

  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
}

// ==================== 启动 ====================

document.addEventListener('DOMContentLoaded', init);

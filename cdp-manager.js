/**
 * Realm Browser - CDP 调试器管理器
 *
 * 负责 webview 的 Chrome DevTools Protocol (CDP) 调试器生命周期管理。
 * 核心职责：
 * - 维护域名抓取列表（从 electron-store 读取）
 * - webview 导航时检查 URL 域名是否匹配抓取列表
 * - 匹配时附加 CDP 调试器，启用 Network 域
 * - 监听 CDP 网络事件，收集请求数据
 * - 处理调试器断开事件（用户打开 DevTools 触发 detach）
 *
 * 依赖：electron（主进程）、dev-requests-writer（写入队列）
 */

const { ipcMain } = require('electron');

// ==================== 状态管理 ====================

/** @type {import('electron-store')|null} electron-store 实例 */
let store = null;

/** @type {Map<number, {attached: boolean, containerId: string}>} webContents 调试器状态 */
const debuggerStates = new Map();

/** @type {Map<string, object>} 请求数据暂存（requestId → 部分记录） */
const pendingRequests = new Map();

/** @type {import('./dev-requests-writer')|null} 写入队列模块引用 */
let writer = null;

// ==================== 配置常量 ====================

/** 允许存储响应体的 Content-Type 前缀 */
const TEXT_CONTENT_TYPES = [
  'application/json',
  'text/',
  'application/xml',
  'application/javascript',
];

/** 单条响应体最大字节数（1MB） */
const MAX_RESPONSE_BODY_SIZE = 1024 * 1024;

// ==================== 初始化 ====================

/**
 * 初始化 CDP 管理器
 * @param {import('electron-store')} storeInstance - electron-store 实例
 * @param {object} [writerModule] - dev-requests-writer 模块（可选，延迟注入）
 */
function init(storeInstance, writerModule) {
  store = storeInstance;
  if (writerModule) {
    writer = writerModule;
  }

  // 确保默认配置存在
  if (!store.get('devMode')) {
    store.set('devMode', {
      enabled: false,
      domains: [],
      retentionDays: 7,
    });
  }

  console.log('[Realm CDP] 管理器已初始化');
}

/**
 * 注入写入队列模块（解决循环依赖）
 * @param {object} writerModule - dev-requests-writer 模块
 */
function setWriter(writerModule) {
  writer = writerModule;
}

// ==================== 配置访问 ====================

/**
 * 获取当前抓取域名列表
 * @returns {string[]} 域名数组
 */
function getDomains() {
  return store ? store.get('devMode.domains', []) : [];
}

/**
 * 添加抓取域名
 * @param {string} domain - 域名
 * @returns {{success: boolean, message?: string}}
 */
function addDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return { success: false, message: '域名不能为空' };
  }

  const trimmed = domain.trim().toLowerCase();
  if (!trimmed || /\s/.test(trimmed) || /[^\w.-]/.test(trimmed)) {
    return { success: false, message: '域名格式不合法' };
  }

  const domains = getDomains();
  if (domains.includes(trimmed)) {
    return { success: false, message: '域名已存在' };
  }

  domains.push(trimmed);
  store.set('devMode.domains', domains);
  console.log(`[Realm CDP] 添加域名: ${trimmed}`);
  return { success: true };
}

/**
 * 移除抓取域名
 * @param {string} domain - 域名
 * @returns {{success: boolean, message?: string}}
 */
function removeDomain(domain) {
  const domains = getDomains();
  const index = domains.indexOf(domain);
  if (index === -1) {
    return { success: false, message: '域名不存在' };
  }

  domains.splice(index, 1);
  store.set('devMode.domains', domains);
  console.log(`[Realm CDP] 移除域名: ${domain}`);
  return { success: true };
}

/**
 * 是否开启开发者模式
 * @returns {boolean}
 */
function isEnabled() {
  return store ? store.get('devMode.enabled', false) : false;
}

/**
 * 设置开发者模式开关
 * @param {boolean} enabled - 是否启用
 */
function setEnabled(enabled) {
  if (store) {
    store.set('devMode.enabled', !!enabled);
    console.log(`[Realm CDP] 开发者模式: ${enabled ? '已启用' : '已禁用'}`);
  }
}

/**
 * 获取数据保留天数
 * @returns {number}
 */
function getRetentionDays() {
  return store ? store.get('devMode.retentionDays', 7) : 7;
}

/**
 * 设置数据保留天数
 * @param {number} days - 保留天数（0 = 永不删除）
 */
function setRetentionDays(days) {
  if (store) {
    store.set('devMode.retentionDays', Math.max(0, parseInt(days, 10) || 7));
  }
}

/**
 * 获取队列统计信息
 * @returns {{pending: number, lastFlush: number, totalWritten: number}}
 */
function getQueueStats() {
  return writer ? writer.getStats() : { pending: 0, lastFlush: 0, totalWritten: 0 };
}

// ==================== 域名匹配 ====================

/**
 * 检查 URL 是否匹配抓取域名列表
 * 支持精确匹配和子域名匹配
 * @param {string} url - 完整 URL
 * @returns {boolean} 是否匹配
 */
function matchesDomain(url) {
  if (!url || !isEnabled()) return false;

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  const domains = getDomains();
  return domains.some(domain => {
    // 精确匹配
    if (hostname === domain) return true;
    // 子域名匹配
    if (hostname.endsWith('.' + domain)) return true;
    return false;
  });
}

// ==================== CDP 调试器管理 ====================

/**
 * 为 webview 附加 CDP 调试器
 * @param {Electron.WebContents} webContents - webview 的 webContents
 * @param {string} containerId - 容器 ID
 * @returns {boolean} 是否成功附加
 */
function attachDebugger(webContents, containerId) {
  if (!webContents || webContents.isDestroyed()) return false;

  // 检查是否已附加
  const state = debuggerStates.get(webContents.id);
  if (state && state.attached) return true;

  try {
    // 附加 CDP 调试器（协议版本 1.3）
    webContents.debugger.attach('1.3');
    console.log(`[Realm CDP] 调试器已附加, webContents: ${webContents.id}, 容器: ${containerId}`);
  } catch (err) {
    console.error(`[Realm CDP] 调试器附加失败: ${err.message}`);
    // 通知渲染进程显示 toast（D-04）
    notifyToast(`CDP 调试器附加失败: ${err.message}`);
    return false;
  }

  // 启用 Network 域
  try {
    webContents.debugger.sendCommand('Network.enable');
  } catch (err) {
    console.error(`[Realm CDP] 启用 Network 域失败: ${err.message}`);
    try { webContents.debugger.detach(); } catch {}
    return false;
  }

  // 更新状态
  debuggerStates.set(webContents.id, { attached: true, containerId });

  // 监听 CDP 事件
  setupCdpListeners(webContents, containerId);

  // 监听调试器断开事件（用户打开 DevTools 触发 detach）
  webContents.debugger.on('detach', (event, reason) => {
    console.log(`[Realm CDP] 调试器断开, webContents: ${webContents.id}, 原因: ${reason}`);
    const currentState = debuggerStates.get(webContents.id);
    if (currentState) {
      currentState.attached = false;
    }
    // 不主动重新附加（避免抢占用户 DevTools），下次导航时自动重新附加
  });

  return true;
}

/**
 * 断开调试器
 * @param {Electron.WebContents} webContents - webview 的 webContents
 */
function detachDebugger(webContents) {
  if (!webContents || webContents.isDestroyed()) return;

  const state = debuggerStates.get(webContents.id);
  if (!state || !state.attached) return;

  try {
    webContents.debugger.detach();
    console.log(`[Realm CDP] 调试器已断开, webContents: ${webContents.id}`);
  } catch (err) {
    console.error(`[Realm CDP] 调试器断开失败: ${err.message}`);
  }

  state.attached = false;
}

// ==================== CDP 事件处理 ====================

/**
 * 设置 CDP 事件监听器
 * @param {Electron.WebContents} webContents - webview 的 webContents
 * @param {string} containerId - 容器 ID
 */
function setupCdpListeners(webContents, containerId) {
  const debuggerObj = webContents.debugger;

  debuggerObj.on('message', (event, method, params) => {
    try {
      switch (method) {
        case 'Network.requestWillBeSent':
          handleRequestWillBeSent(params, containerId);
          break;
        case 'Network.responseReceived':
          handleResponseReceived(params);
          break;
        case 'Network.dataReceived':
          handleDataReceived(params);
          break;
        case 'Network.loadingFinished':
          handleLoadingFinished(params, webContents);
          break;
        case 'Network.loadingFailed':
          handleLoadingFailed(params);
          break;
      }
    } catch (err) {
      console.error(`[Realm CDP] 事件处理错误 (${method}):`, err.message);
    }
  });
}

/**
 * 处理 Network.requestWillBeSent 事件
 * @param {object} params - CDP 事件参数
 * @param {string} containerId - 容器 ID
 */
function handleRequestWillBeSent(params, containerId) {
  const { requestId, request, timestamp } = params;

  // 初始化请求记录
  pendingRequests.set(requestId, {
    requestId,
    url: request.url,
    method: request.method,
    statusCode: 0,
    requestHeaders: request.headers || {},
    requestBody: request.postData || '',
    responseHeaders: {},
    responseBody: '',
    contentType: '',
    duration: 0,
    size: 0,
    containerId,
    createdAt: Date.now(),
    startTime: timestamp,
    _dataChunks: [], // 临时存储数据块
  });
}

/**
 * 处理 Network.responseReceived 事件
 * @param {object} params - CDP 事件参数
 */
function handleResponseReceived(params) {
  const { requestId, response } = params;
  const record = pendingRequests.get(requestId);
  if (!record) return;

  record.statusCode = response.status;
  record.responseHeaders = response.headers || {};
  record.contentType = response.headers?.['content-type'] || '';

  // 计算请求耗时
  if (record.startTime && response.timing?.requestTime) {
    record.duration = Math.round((response.timing.requestTime + (response.timing.receiveHeadersEnd || 0)) * 1000);
  }
}

/**
 * 处理 Network.dataReceived 事件
 * @param {object} params - CDP 事件参数
 */
function handleDataReceived(params) {
  const { requestId, data } = params;
  const record = pendingRequests.get(requestId);
  if (!record) return;

  // 累积响应体数据块
  if (data) {
    record._dataChunks.push(data);
    record.size += data.length;
  }
}

/**
 * 处理 Network.loadingFinished 事件
 * 获取完整响应体，组装记录推入写入队列
 * @param {object} params - CDP 事件参数
 * @param {Electron.WebContents} webContents - webview 的 webContents
 */
async function handleLoadingFinished(params, webContents) {
  const { requestId } = params;
  const record = pendingRequests.get(requestId);
  if (!record) return;

  // 清理临时数据
  delete record._dataChunks;
  delete record.startTime;

  // 响应体过滤（D-08）
  record.responseBody = filterResponseBody(record);

  // 推入写入队列
  if (writer) {
    writer.enqueue(record);
  }

  pendingRequests.delete(requestId);
}

/**
 * 处理 Network.loadingFailed 事件
 * @param {object} params - CDP 事件参数
 */
function handleLoadingFailed(params) {
  const { requestId, errorText } = params;
  const record = pendingRequests.get(requestId);
  if (!record) return;

  // 清理临时数据
  delete record._dataChunks;
  delete record.startTime;

  // 记录错误信息
  record.responseBody = `[请求失败: ${errorText}]`;
  record.size = 0;

  // 推入写入队列
  if (writer) {
    writer.enqueue(record);
  }

  pendingRequests.delete(requestId);
}

// ==================== 响应体过滤 ====================

/**
 * 过滤响应体（D-08）
 * - 仅存储文本类型 Content-Type
 * - 二进制内容跳过存储
 * - 单条响应体大小限制 1MB
 * @param {object} record - 请求记录
 * @returns {string} 过滤后的响应体
 */
function filterResponseBody(record) {
  const contentType = record.contentType.toLowerCase();

  // 检查是否为文本类型
  const isTextType = TEXT_CONTENT_TYPES.some(prefix => contentType.includes(prefix));
  if (!isTextType) {
    return ''; // 二进制内容跳过
  }

  // 拼接数据块
  let body = '';
  if (record._dataChunks && record._dataChunks.length > 0) {
    body = record._dataChunks.join('');
  }

  // 大小限制（1MB）
  if (body.length > MAX_RESPONSE_BODY_SIZE) {
    const truncated = body.substring(0, MAX_RESPONSE_BODY_SIZE);
    return truncated + `\n[截断：原始大小 ${body.length} bytes]`;
  }

  return body;
}

// ==================== 导航处理 ====================

/**
 * 处理 webview 导航事件
 * 检查 URL 是否匹配抓取域名，自动附加/断开调试器
 * @param {Electron.WebContents} webContents - webview 的 webContents
 * @param {string} url - 导航目标 URL
 * @param {string} containerId - 容器 ID
 */
function handleNavigation(webContents, url, containerId) {
  if (!webContents || webContents.isDestroyed()) return;

  const shouldAttach = matchesDomain(url);
  const currentState = debuggerStates.get(webContents.id);
  const isAttached = currentState && currentState.attached;

  if (shouldAttach && !isAttached) {
    // 需要附加且未附加
    console.log(`[Realm CDP] 域名匹配，附加调试器: ${url}`);
    attachDebugger(webContents, containerId);
  } else if (!shouldAttach && isAttached) {
    // 不需要匹配且已附加
    console.log(`[Realm CDP] 域名不匹配，断开调试器: ${url}`);
    detachDebugger(webContents);
  }
  // 已附加且匹配、未附加且不匹配：无需操作
}

// ==================== 清理 ====================

/**
 * 清理资源（应用退出时调用）
 */
function cleanup() {
  // 清理暂存的请求数据
  pendingRequests.clear();
  debuggerStates.clear();
  console.log('[Realm CDP] 资源已清理');
}

// ==================== 通知 ====================

/**
 * 通知渲染进程显示 toast
 * @param {string} message - 提示消息
 */
function notifyToast(message) {
  try {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('devmode-toast', message);
    }
  } catch (err) {
    console.error('[Realm CDP] 发送 toast 失败:', err.message);
  }
}

// ==================== 模块导出 ====================

module.exports = {
  init,
  setWriter,
  getDomains,
  addDomain,
  removeDomain,
  isEnabled,
  setEnabled,
  getRetentionDays,
  setRetentionDays,
  getQueueStats,
  attachDebugger,
  detachDebugger,
  handleNavigation,
  cleanup,
  matchesDomain,
};

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

const { ipcMain, webContents } = require('electron');

// ==================== 状态管理 ====================

/** @type {import('electron-store')|null} electron-store 实例 */
let store = null;

/** @type {Map<number, {attached: boolean, containerId: string}>} webContents 调试器状态 */
const debuggerStates = new Map();

/** @type {Map<string, object>} 请求数据暂存（requestId → 部分记录） */
const pendingRequests = new Map();

/**
 * @type {Map<string, object>} 请求 ExtraInfo 暂存（requestId → 完整 headers）
 *
 * Chromium 安全模型：Network.requestWillBeSent 的 headers 不含 Cookie/Authorization
 * 等敏感头，完整版由 Network.requestWillBeSentExtraInfo 下发。两个事件 requestId
 * 相同但触发顺序不保证，故先到的 ExtraInfo 在此暂存，等常规事件到达时合并。
 */
const pendingExtraRequestHeaders = new Map();

/** @type {Map<string, object>} 响应 ExtraInfo 暂存（requestId → 完整 headers，含 Set-Cookie） */
const pendingExtraResponseHeaders = new Map();

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

// ==================== AI 工具调试器管理 ====================

/**
 * 为 AI 工具附加调试器并启用指定域（D-01/D-02/D-04）
 *
 * 按需附加：AI 工具调用时才 attach，用完经 detachForAI 立即断开。
 * 与 Network 抓取的 attachDebugger 通过 state.source 区分，互不干扰。
 *
 * @param {number} webContentsId - webContents ID
 * @param {string[]} [domains=['Runtime']] - 要启用的 CDP 域列表
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function attachForAI(webContentsId, domains = ['Runtime']) {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) {
    return { success: false, error: '标签页已关闭' };
  }

  // DevTools 冲突处理（D-04）：调试器已被占用时明确报错
  if (wc.debugger.isAttached()) {
    return { success: false, error: 'DevTools 已打开，请关闭后重试' };
  }

  try {
    // 附加 CDP 调试器（协议版本 1.3）
    wc.debugger.attach('1.3');

    // 逐个启用请求的域
    for (const domain of domains) {
      await wc.debugger.sendCommand(`${domain}.enable`);
    }

    // 更新状态（source 标记区分 AI 附加和 Network 抓取附加）
    debuggerStates.set(wc.id, {
      attached: true,
      source: 'ai-tool',
      domains,
    });

    console.log(`[Realm CDP] AI 调试器已附加, webContents: ${wc.id}, 域: ${domains.join(', ')}`);
    return { success: true };
  } catch (err) {
    console.error(`[Realm CDP] AI 调试器附加失败: ${err.message}`);
    try { wc.debugger.detach(); } catch {}
    return { success: false, error: `CDP 附加失败: ${err.message}` };
  }
}

/**
 * AI 工具完成后断开调试器（D-03：用完即卸）
 *
 * 仅断开 source === 'ai-tool' 的调试器，Network 抓取附加的不受影响。
 * webContents 已销毁时调试器由 Electron 自动断开，仅需清理状态条目。
 *
 * @param {number} webContentsId - webContents ID
 */
function detachForAI(webContentsId) {
  const state = debuggerStates.get(webContentsId);
  if (!state || state.source !== 'ai-tool') return;

  const wc = webContents.fromId(webContentsId);
  if (wc && !wc.isDestroyed()) {
    try {
      wc.debugger.detach();
      console.log(`[Realm CDP] AI 调试器已断开, webContents: ${webContentsId}`);
    } catch (err) {
      console.error(`[Realm CDP] AI 调试器断开失败: ${err.message}`);
    }
  }

  debuggerStates.delete(webContentsId);
}

/**
 * 执行 CDP 命令（带超时保护）
 *
 * 命令执行超过 timeout 毫秒后返回超时错误而非挂起。
 *
 * @param {number} webContentsId - webContents ID
 * @param {string} method - CDP 方法名（如 'Runtime.evaluate'）
 * @param {object} [params={}] - 方法参数
 * @param {number} [timeout=10000] - 超时毫秒数
 * @returns {Promise<{success: boolean, result?: object, error?: string}>}
 */
async function executeCommand(webContentsId, method, params = {}, timeout = 10000) {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) {
    return { success: false, error: '标签页已关闭' };
  }

  let timeoutId;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('CDP 命令执行超时')), timeout);
    });
    const result = await Promise.race([
      wc.debugger.sendCommand(method, params),
      timeoutPromise,
    ]);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
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
        case 'Network.requestWillBeSentExtraInfo':
          handleRequestWillBeSentExtraInfo(params);
          break;
        case 'Network.responseReceived':
          handleResponseReceived(params);
          break;
        case 'Network.responseReceivedExtraInfo':
          handleResponseReceivedExtraInfo(params);
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

  // 若 ExtraInfo 先触发，取出其完整 headers（含 Cookie 等敏感头）合并
  const extraHeaders = pendingExtraRequestHeaders.get(requestId) || {};
  pendingExtraRequestHeaders.delete(requestId);

  // 初始化请求记录
  // startTime 为 CDP 单调时钟时间戳（秒），用于在 loadingFinished 时计算真实耗时
  pendingRequests.set(requestId, {
    requestId,
    url: request.url,
    method: request.method,
    statusCode: 0,
    // ExtraInfo headers 优先级更高（包含 Cookie/Authorization 等敏感头）
    requestHeaders: { ...(request.headers || {}), ...extraHeaders },
    requestBody: request.postData || '',
    responseHeaders: {},
    responseBody: '',
    contentType: '',
    duration: 0,
    size: 0,
    containerId,
    createdAt: Date.now(),
    startTime: timestamp,
  });
}

/**
 * 处理 Network.requestWillBeSentExtraInfo 事件
 * 完整请求头（含 Cookie）下发通道。若常规事件先到则直接合并到 record；
 * 否则暂存，等 handleRequestWillBeSent 取出。
 * @param {object} params - CDP 事件参数
 */
function handleRequestWillBeSentExtraInfo(params) {
  const { requestId, headers } = params;
  if (!headers) return;

  const record = pendingRequests.get(requestId);
  if (record) {
    // ExtraInfo 优先，覆盖常规 headers 中的同名键
    record.requestHeaders = { ...record.requestHeaders, ...headers };
  } else {
    pendingExtraRequestHeaders.set(requestId, headers);
  }
}

/**
 * 处理 Network.responseReceived 事件
 * @param {object} params - CDP 事件参数
 */
function handleResponseReceived(params) {
  const { requestId, response } = params;
  const record = pendingRequests.get(requestId);
  if (!record) return;

  // 若 responseReceivedExtraInfo 先触发，取出完整响应头（含 Set-Cookie）合并
  const extraHeaders = pendingExtraResponseHeaders.get(requestId) || {};
  pendingExtraResponseHeaders.delete(requestId);

  record.statusCode = response.status;
  record.responseHeaders = { ...(response.headers || {}), ...extraHeaders };
  record.contentType = record.responseHeaders['content-type'] || record.responseHeaders['Content-Type'] || '';
  // 注意：此处不计算耗时。response.timing.requestTime 是单调时钟基准值
  // （数值巨大），耗时必须在 loadingFinished 用事件时间戳差值计算
}

/**
 * 处理 Network.responseReceivedExtraInfo 事件
 * 完整响应头（含 Set-Cookie）下发通道。
 * @param {object} params - CDP 事件参数
 */
function handleResponseReceivedExtraInfo(params) {
  const { requestId, headers } = params;
  if (!headers) return;

  const record = pendingRequests.get(requestId);
  if (record) {
    record.responseHeaders = { ...record.responseHeaders, ...headers };
    // contentType 可能在 ExtraInfo 中才出现，重新计算一次
    if (!record.contentType) {
      record.contentType = record.responseHeaders['content-type'] || record.responseHeaders['Content-Type'] || '';
    }
  } else {
    pendingExtraResponseHeaders.set(requestId, headers);
  }
}

/**
 * 处理 Network.dataReceived 事件
 * 事件参数为 { requestId, timestamp, dataLength, encodedDataLength }，
 * 不携带数据本体；dataLength 为解码后字节数
 * @param {object} params - CDP 事件参数
 */
function handleDataReceived(params) {
  const { requestId, dataLength } = params;
  const record = pendingRequests.get(requestId);
  if (!record) return;

  record.size += dataLength || 0;
}

/**
 * 处理 Network.loadingFinished 事件
 * 计算耗时、拉取响应体，组装记录推入写入队列
 * @param {object} params - CDP 事件参数
 * @param {Electron.WebContents} webContents - webview 的 webContents
 */
async function handleLoadingFinished(params, webContents) {
  const { requestId, timestamp } = params;
  const record = pendingRequests.get(requestId);
  if (!record) return;

  // 真实耗时：loadingFinished 与 requestWillBeSent 的单调时钟差（秒 → 毫秒）
  if (record.startTime && timestamp) {
    record.duration = Math.max(0, Math.round((timestamp - record.startTime) * 1000));
  }
  delete record.startTime;

  // 响应体通过 Network.getResponseBody 主动拉取（D-08：仅文本类型，限 1MB）
  record.responseBody = await fetchResponseBody(webContents, record);

  // Cookie 兜底：ExtraInfo 事件在部分 Chromium 版本/场景下不下发 Cookie 头，
  // 此时主动从容器 session 拉取该 URL 当前的 Cookie 拼成 Cookie 头注入，
  // 保证详情页/展开面板的 Cookie tab 始终有数据
  const hasCookieHeader = record.requestHeaders.Cookie || record.requestHeaders.cookie;
  if (!hasCookieHeader) {
    try {
      const cookies = await webContents.session.cookies.get({ url: record.url });
      if (cookies && cookies.length > 0) {
        record.requestHeaders.Cookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      }
    } catch (err) {
      console.warn('[Realm CDP] 兜底拉取 Cookie 失败:', err.message);
    }
  }

  // 推入写入队列
  if (writer) {
    writer.enqueue(record);
  }

  pendingRequests.delete(requestId);
  pendingExtraRequestHeaders.delete(requestId);
  pendingExtraResponseHeaders.delete(requestId);
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
  delete record.startTime;

  // 记录错误信息
  record.responseBody = `[请求失败: ${errorText}]`;
  record.size = 0;

  // 推入写入队列
  if (writer) {
    writer.enqueue(record);
  }

  pendingRequests.delete(requestId);
  pendingExtraRequestHeaders.delete(requestId);
  pendingExtraResponseHeaders.delete(requestId);
}

// ==================== 响应体拉取 ====================

/**
 * 通过 Network.getResponseBody 拉取响应体（D-08）
 * - 仅存储文本类型 Content-Type
 * - 单条响应体大小限制 1MB，超出截断
 * - dataReceived 事件不携带数据本体，必须主动拉取；
 *   部分请求（缓存命中、重定向、预检）无 body 可取，静默返回空串
 * @param {Electron.WebContents} webContents - webview 的 webContents
 * @param {object} record - 请求记录
 * @returns {Promise<string>} 响应体文本
 */
async function fetchResponseBody(webContents, record) {
  const contentType = (record.contentType || '').toLowerCase();

  // 检查是否为文本类型
  const isTextType = TEXT_CONTENT_TYPES.some(prefix => contentType.includes(prefix));
  if (!isTextType) {
    return ''; // 二进制内容跳过
  }

  try {
    const result = await webContents.debugger.sendCommand('Network.getResponseBody', {
      requestId: record.requestId,
    });

    let body = result.body || '';
    if (result.base64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf8');
    }

    // 大小限制（1MB）
    if (body.length > MAX_RESPONSE_BODY_SIZE) {
      return body.substring(0, MAX_RESPONSE_BODY_SIZE) + `\n[截断：原始大小 ${body.length} bytes]`;
    }

    return body;
  } catch {
    // 无 body 可取（缓存、重定向、请求已销毁等），正常情况
    return '';
  }
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
  // 断开 AI 工具附加的调试器（source === 'ai-tool'）
  for (const [webContentsId, state] of debuggerStates) {
    if (state && state.source === 'ai-tool') {
      const wc = webContents.fromId(webContentsId);
      if (wc && !wc.isDestroyed()) {
        try { wc.debugger.detach(); } catch {}
      }
    }
  }

  // 清理暂存的请求数据
  pendingRequests.clear();
  pendingExtraRequestHeaders.clear();
  pendingExtraResponseHeaders.clear();
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
  attachForAI,
  detachForAI,
  executeCommand,
  handleNavigation,
  cleanup,
  matchesDomain,
};

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
 * - AI 工具调试器管理（attachForAI/detachForAI/executeCommand）
 *
 * Readability 库说明：
 * - lib/readability-bundle.js 为 Mozilla Readability（Apache 2.0）的 minified IIFE 打包
 * - 用途：read_page_content 工具经 executeCommand('Runtime.evaluate') 注入 webview，
 *   在页面上下文执行 `new Readability(document.cloneNode(true)).parse()` 提取可读内容
 *
 * 依赖：electron（主进程）、dev-requests-writer（写入队列）
 */

const { ipcMain, webContents } = require('electron');
const uaChManager = require('./ua-ch-manager');

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

  // 若常驻 UA 覆盖管理器（ua-ch-manager）持有本 webContents 的 debugger，
  // 先挂起让位给 Network 抓包，抓包结束（detachDebugger）后自动恢复
  if (webContents.debugger.isAttached() && uaChManager.isHolding(webContents.id)) {
    uaChManager.suspend(webContents.id);
  }

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

  // Network 抓包释放后，若 UA 覆盖此前被挂起让位，恢复之
  if (uaChManager.isSuspended(webContents.id)) {
    uaChManager.resume(webContents.id);
  }
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
    // 若是常驻 UA Client Hints 覆盖管理器（ua-ch-manager）持有的 debugger，
    // 挂起让位给 AI 工具，完成后由 detachForAI 负责恢复（resume）
    if (uaChManager.isHolding(wc.id)) {
      uaChManager.suspend(wc.id);
    } else {
      return { success: false, error: 'DevTools 已打开，请关闭后重试' };
    }
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
    // 用户可见文案按 22-UI-SPEC 契约，技术细节保留在上方日志
    return { success: false, error: '无法连接到页面调试器，请刷新页面后重试' };
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

  // UA Client Hints 覆盖被挂起时恢复（重新 attach + 应用 UA 覆盖），
  // 保持登录流程的浏览器身份伪装不因 AI 工具使用而中断
  if (uaChManager.isSuspended(webContentsId)) {
    uaChManager.resume(webContentsId);
  }
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

// ==================== 表单填写辅助函数 ====================

/**
 * 构建表单字段查找脚本（D-01 定义的查找链）
 *
 * 查找链：label 文本 → placeholder → aria-label → name 属性 → id 属性 → CSS 选择器
 * 每一步找到唯一匹配即返回，全部失败则返回 null
 *
 * @param {string} fieldName - 字段名称（label/placeholder/aria-label/name/id/selector）
 * @returns {string} Runtime.evaluate 可执行的 JavaScript 脚本
 */
function _buildFieldLookupScript(fieldName) {
  const escaped = fieldName.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  return `
(function() {
  var target = '${escaped}';

  // 1. label 文本匹配（label.textContent → htmlFor → 关联元素）
  var labels = document.querySelectorAll('label');
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i];
    if (label.textContent && label.textContent.trim().includes(target)) {
      if (label.htmlFor) {
        var el = document.getElementById(label.htmlFor);
        if (el) return el;
      }
      var child = label.querySelector('input, textarea, select');
      if (child) return child;
      var next = label.nextElementSibling;
      if (next && /^(INPUT|TEXTAREA|SELECT)$/i.test(next.tagName)) return next;
    }
  }

  // 2. placeholder 匹配
  var byPlaceholder = document.querySelector('[placeholder*="' + target + '"]');
  if (byPlaceholder) return byPlaceholder;

  // 3. aria-label 匹配
  var byAriaLabel = document.querySelector('[aria-label*="' + target + '"]');
  if (byAriaLabel) return byAriaLabel;

  // 4. name 属性匹配
  var byName = document.querySelector('[name="' + target + '"]');
  if (byName) return byName;

  // 5. id 属性匹配
  var byId = document.getElementById(target);
  if (byId) return byId;

  // 6. CSS 选择器兜底
  try {
    var bySelector = document.querySelector(target);
    if (bySelector) return bySelector;
  } catch (e) {}

  return null;
})()`;
}

/**
 * 构建元素定位脚本（D-09：文本优先 + 选择器兜底）
 *
 * 查找顺序：文本内容匹配 → aria-label/title/placeholder 匹配 → CSS 选择器
 *
 * @param {string} target - 目标元素描述（文本或 CSS 选择器）
 * @returns {string} Runtime.evaluate 可执行的 JavaScript 脚本
 */
function _buildFindElementScript(target) {
  const escaped = target.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  return `
(function() {
  var target = '${escaped}';

  // 1. 文本内容匹配（可点击元素优先）
  // input 按钮的显示文本在 value 属性而非 textContent（如 <input type=submit value="Sign in">）
  // 两遍匹配：先精确后包含，避免 "Sign in" 命中 "Sign in with a passkey" 这类包含误配
  var clickables = document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"], [onclick], [tabindex]');
  var i, el, text;
  for (i = 0; i < clickables.length; i++) {
    el = clickables[i];
    text = (el.tagName === 'INPUT' ? (el.value || '') : (el.textContent || '')).trim();
    if (text && text === target) return el;
  }
  for (i = 0; i < clickables.length; i++) {
    el = clickables[i];
    text = (el.tagName === 'INPUT' ? (el.value || '') : (el.textContent || '')).trim();
    if (text && text.includes(target)) return el;
  }

  // 2. aria-label / title / placeholder / name 匹配
  var byAria = document.querySelector('[aria-label*="' + target + '"], [title*="' + target + '"], [placeholder*="' + target + '"], [name="' + target + '"]');
  if (byAria) return byAria;

  // 3. label 文本匹配（复用表单字段查找链）
  var labels = document.querySelectorAll('label');
  for (var j = 0; j < labels.length; j++) {
    var label = labels[j];
    if (label.textContent && label.textContent.trim().includes(target)) {
      if (label.htmlFor) {
        var el2 = document.getElementById(label.htmlFor);
        if (el2) return el2;
      }
      var child = label.querySelector('input, textarea, select, button');
      if (child) return child;
    }
  }

  // 4. CSS 选择器兜底
  try {
    var bySelector = document.querySelector(target);
    if (bySelector) return bySelector;
  } catch (e) {}

  return null;
})()`;
}

/**
 * 执行页面脚本并返回结果（Runtime.evaluate 封装）
 *
 * @param {number} webContentsId - webContents ID
 * @param {string} script - 要执行的 JavaScript 脚本
 * @param {number} [timeout=10000] - 超时毫秒数
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
async function _evalScript(webContentsId, script, timeout = 10000) {
  return executeCommand(webContentsId, 'Runtime.evaluate', {
    expression: script,
    returnByValue: true,
    awaitPromise: false,
  }, timeout);
}

/**
 * 获取元素的 CDP RemoteObjectId
 *
 * @param {number} webContentsId - webContents ID
 * @param {string} script - 返回 DOM 元素的脚本
 * @param {number} [timeout=10000] - 超时毫秒数
 * @returns {Promise<{success: boolean, objectId?: string, error?: string}>}
 */
async function _getElementObjectId(webContentsId, script, timeout = 10000) {
  return executeCommand(webContentsId, 'Runtime.evaluate', {
    expression: script,
    returnByValue: false,
    awaitPromise: false,
  }, timeout);
}

/**
 * 对元素做合成点击（mousePressed + mouseReleased），使输入管线焦点落位
 *
 * Input.insertText 打进的是"输入管线焦点元素"而非 DOM activeElement ——
 * 焦点在 embedder（如 AI 面板输入框）时，insertText 会把文本打进聊天框
 * 造成串字污染（docs/debug/fill-form-focus-pipeline.md）。DOM focus() 不
 * 改变输入管线焦点，合成 dispatchMouseEvent 才会把 guest frame 标记为
 * input-focused。insertText 前必须先合成点击目标元素。
 *
 * @param {number} webContentsId - webContents ID
 * @param {string} objectId - 元素的 CDP RemoteObjectId
 * @returns {Promise<boolean>} 点击是否完成（元素无可见区域时返回 false）
 */
async function _syntheticClickElement(webContentsId, objectId) {
  const rectResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
    objectId,
    functionDeclaration: `function() {
      if (this.scrollIntoView) { this.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      var rect = this.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height };
    }`,
    returnByValue: true,
  });
  const rect = rectResult.result?.result?.value;
  if (!rectResult.success || !rect || rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', clickCount: 1,
  });
  await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
  });
  return true;
}

// ==================== 脚本安全检查 ====================

/** execute_script 禁止的危险模式列表（D-16） */
const DANGEROUS_SCRIPT_PATTERNS = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bfs\./,
  /\bnet\./,
  /\bhttp\./,
  /\bhttps\./,
  /\bchild_process\b/,
  /\bprocess\./,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
];

/**
 * 静态分析脚本内容，检测危险调用（D-16）
 *
 * @param {string} script - 要检查的脚本内容
 * @returns {{safe: boolean, reason?: string}}
 */
function _validateScript(script) {
  if (!script || typeof script !== 'string') {
    return { safe: false, reason: '脚本内容为空' };
  }
  for (const pattern of DANGEROUS_SCRIPT_PATTERNS) {
    if (pattern.test(script)) {
      return { safe: false, reason: '检测到危险调用: ' + pattern.source };
    }
  }
  return { safe: true };
}

// ==================== AI 自动化操作 ====================

/**
 * 自动填写网页表单（D-01/D-02/D-03/D-04）
 *
 * 通过 CDP 在页面上下文中定位表单字段并填入值。
 * 字段定位链：label 文本 → placeholder → aria-label → name → id → CSS 选择器。
 * 支持 input/textarea/select/checkbox/radio/contenteditable/file/date-time 等类型。
 *
 * @param {number} webContentsId - webContents ID
 * @param {Array<{field: string, value: string}>} fields - 要填写的字段列表
 * @returns {Promise<{success: boolean, filled?: string[], failed?: Array<{field: string, error: string}>, captchaDetected?: boolean, captchaType?: string|null, availableFields?: string[]}>}
 */
async function fillForm(webContentsId, fields) {
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return { success: false, filled: [], failed: [{ field: '(empty)', error: 'fields 参数不能为空' }] };
  }

  const filled = [];
  const failed = [];
  let captchaDetected = false;
  let captchaType = null;
  // 已填写字段的延时复核清单（问题 2：readback 通过后值可能被页面 JS 回退）
  const settledChecks = [];

  // 注意：不要启用 Input 域 —— Input.enable 已在 Chromium 128+ 移除，
  // 而 Input.insertText/dispatch* 等命令本就无需 enable 即可调用。
  const attachResult = await attachForAI(webContentsId, ['Runtime', 'DOM']);
  if (!attachResult.success) {
    return {
      success: false,
      filled: [],
      failed: fields.map(f => ({ field: f.field, error: attachResult.error })),
    };
  }

  // Input.insertText 走真实输入管线，要求 webview 持有键盘焦点，
  // 否则文本会被静默丢弃（用户在 AI 面板输入时 webview 无焦点）。
  // wc.focus() 等价于用户点击 webview 区域。
  const wc = webContents.fromId(webContentsId);
  if (wc && !wc.isDestroyed()) wc.focus();

  try {
    for (const fieldDef of fields) {
      const { field, value } = fieldDef;
      if (!field) {
        failed.push({ field: '(unknown)', error: '字段名不能为空' });
        continue;
      }

      try {
        // 查找元素
        const lookupScript = _buildFieldLookupScript(field);
        const objResult = await _getElementObjectId(webContentsId, lookupScript);

        if (!objResult.success || !objResult.result?.result?.objectId) {
          // 字段未找到，收集可用字段信息
          const availableFieldsResult = await _evalScript(webContentsId, `
(function() {
  var fields = [];
  var els = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var label = '';
    var labels = document.querySelectorAll('label');
    for (var j = 0; j < labels.length; j++) {
      if (labels[j].htmlFor === el.id || labels[j].contains(el)) {
        label = labels[j].textContent.trim();
        break;
      }
    }
    fields.push({
      tag: el.tagName.toLowerCase(),
      type: el.type || '',
      name: el.name || '',
      id: el.id || '',
      placeholder: el.placeholder || '',
      label: label,
      ariaLabel: el.getAttribute('aria-label') || '',
    });
  }
  return fields;
})()`);
          const availableFields = [];
          if (availableFieldsResult.success && Array.isArray(availableFieldsResult.result?.result?.value)) {
            for (const f of availableFieldsResult.result.result.value) {
              const parts = [];
              if (f.label) parts.push('label:' + f.label);
              if (f.placeholder) parts.push('placeholder:' + f.placeholder);
              if (f.ariaLabel) parts.push('aria:' + f.ariaLabel);
              if (f.name) parts.push('name:' + f.name);
              if (f.id) parts.push('id:' + f.id);
              if (parts.length === 0) parts.push(f.tag + (f.type ? '[type=' + f.type + ']' : ''));
              availableFields.push(parts.join(' | '));
            }
          }

          failed.push({ field, error: '字段未找到', availableFields });
          continue;
        }

        const objectId = objResult.result.result.objectId;

        // 获取元素类型信息
        const infoResult = await executeCommand(webContentsId, 'Runtime.evaluate', {
          expression: `(function(el) {
            return {
              tag: el.tagName ? el.tagName.toLowerCase() : '',
              type: el.type || '',
              contentEditable: el.contentEditable === 'true',
              isFile: el.tagName === 'INPUT' && el.type === 'file',
              isCheckbox: el.tagName === 'INPUT' && el.type === 'checkbox',
              isRadio: el.tagName === 'INPUT' && el.type === 'radio',
              isSelect: el.tagName === 'SELECT',
              isDateOrTime: el.tagName === 'INPUT' && /^(date|time|datetime-local|month|week)$/.test(el.type),
            };
          })(document.querySelector(':hover') || document.activeElement || document.body)`,
          returnByValue: true,
        });

        // 使用 Runtime.callFunctionOn 获取元素信息
        const elInfoResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            return {
              tag: this.tagName ? this.tagName.toLowerCase() : '',
              type: this.type || '',
              contentEditable: this.contentEditable === 'true',
              isFile: this.tagName === 'INPUT' && this.type === 'file',
              isCheckbox: this.tagName === 'INPUT' && this.type === 'checkbox',
              isRadio: this.tagName === 'INPUT' && this.type === 'radio',
              isSelect: this.tagName === 'SELECT',
              isDateOrTime: this.tagName === 'INPUT' && /^(date|time|datetime-local|month|week)$/.test(this.type),
              isContentEditable: this.contentEditable === 'true' || this.isContentEditable,
            };
          }`,
          returnByValue: true,
        });

        const elInfo = elInfoResult.success ? elInfoResult.result?.result?.value : {};
        const tag = elInfo?.tag || 'input';

        // CAPTCHA 检测（D-15）
        const captchaCheckResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            var el = this;
            var parent = el.closest('form') || el.parentElement || document.body;
            var html = parent.innerHTML || '';
            var hasRecaptcha = /g-recaptcha|recaptcha/i.test(html);
            var hasHcaptcha = /h-captcha/i.test(html);
            var hasTurnstile = /cf-turnstile|turnstile/i.test(html);
            return {
              detected: hasRecaptcha || hasHcaptcha || hasTurnstile,
              type: hasRecaptcha ? 'recaptcha' : hasHcaptcha ? 'hcaptcha' : hasTurnstile ? 'turnstile' : null,
            };
          }`,
          returnByValue: true,
        });

        if (captchaCheckResult.success && captchaCheckResult.result?.result?.value?.detected) {
          captchaDetected = true;
          captchaType = captchaCheckResult.result.result.value.type;
        }

        // 根据元素类型选择填写策略
        if (elInfo?.isFile) {
          // 文件上传（D-03）
          if (!value) {
            failed.push({ field, error: '文件上传需要提供文件路径' });
            continue;
          }
          // 需要通过 DOM.setFileInputFiles 设置文件
          const nodeResult = await executeCommand(webContentsId, 'DOM.describeNode', { objectId });
          if (nodeResult.success && nodeResult.result?.node?.backendNodeId) {
            await executeCommand(webContentsId, 'DOM.setFileInputFiles', {
              files: [value],
              backendNodeId: nodeResult.result.node.backendNodeId,
            });
            filled.push(field);
          } else {
            failed.push({ field, error: '无法获取文件输入元素节点' });
          }
        } else if (elInfo?.isContentEditable) {
          // contenteditable 元素（D-03）：先合成点击落位输入管线焦点
          // （同普通 input 的串字污染问题），再 focus 回验 + Input.insertText
          await _syntheticClickElement(webContentsId, objectId);
          const ceFocusCheck = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function() {
              this.focus();
              return document.activeElement === this;
            }`,
            returnByValue: true,
          });
          if (ceFocusCheck.success && ceFocusCheck.result?.result?.value === true) {
            await executeCommand(webContentsId, 'Input.insertText', { text: value || '' });
            filled.push(field);
          } else {
            failed.push({ field, error: '无法聚焦到目标元素' });
          }
        } else if (elInfo?.isSelect) {
          // select 元素：设置 selectedIndex 或 value
          const selectResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function(val) {
              var matched = false;
              for (var i = 0; i < this.options.length; i++) {
                if (this.options[i].value === val || this.options[i].textContent.trim() === val) {
                  this.selectedIndex = i;
                  matched = true;
                  break;
                }
              }
              if (!matched) {
                this.value = val;
              }
              this.dispatchEvent(new Event('change', { bubbles: true }));
              this.dispatchEvent(new Event('input', { bubbles: true }));
              return { success: matched || this.value === val };
            }`,
            arguments: [value || ''],
            returnByValue: true,
          });
          if (selectResult.success) {
            filled.push(field);
          } else {
            failed.push({ field, error: '设置 select 值失败' });
          }
        } else if (elInfo?.isCheckbox || elInfo?.isRadio) {
          // checkbox/radio（D-03）
          const boolVal = value === 'true' || value === '1' || value === 'yes' || value === 'on';
          await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function(checked) {
              if (this.checked !== checked) {
                this.checked = checked;
              }
              this.dispatchEvent(new Event('change', { bubbles: true }));
              this.dispatchEvent(new Event('input', { bubbles: true }));
            }`,
            arguments: [boolVal],
            returnByValue: true,
          });
          filled.push(field);
        } else if (elInfo?.isDateOrTime) {
          // date/time（D-03）
          await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function(val) {
              this.value = val;
              this.dispatchEvent(new Event('change', { bubbles: true }));
              this.dispatchEvent(new Event('input', { bubbles: true }));
            }`,
            arguments: [value || ''],
            returnByValue: true,
          });
          filled.push(field);
        } else {
          // 普通 input/textarea（D-03）
          // 证据（docs/debug/fill-form-focus-pipeline.md）：insertText 打进的是
          // 输入管线焦点元素而非 DOM activeElement —— 焦点在 embedder（AI 面板
          // 输入框）时会把填表文本打进聊天框造成串字污染。因此 insertText 前
          // 先合成点击目标元素（D4），让输入管线焦点落到 guest 内的目标字段；
          // 之后统一 readback 裁决：值不符即走原生 setter 回退路径（不依赖
          // 任何焦点状态），回退后再次 readback 定成败，杜绝 filled 虚报。
          await _syntheticClickElement(webContentsId, objectId);
          const focusCheck = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function() {
              this.focus();
              return document.activeElement === this;
            }`,
            returnByValue: true,
          });
          const focusOk = focusCheck.success && focusCheck.result?.result?.value === true;

          if (focusOk) {
            // 全选已有内容，insertText 替换选区（真实输入管线，框架均识别）
            await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
              objectId,
              functionDeclaration: `function() { if (this.select) { this.select(); } }`,
              returnByValue: true,
            });
            await executeCommand(webContentsId, 'Input.insertText', { text: value || '' });
          }

          // readback 裁决 insertText 是否真实落位
          let readback = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function() { return this.value; }`,
            returnByValue: true,
          });
          let actual = readback.result?.result?.value;

          if (!(readback.success && actual === (value || ''))) {
            // 回退路径：原生 value setter + beforeinput/input/change 事件序列
            // （不依赖键盘焦点；原生 setter 绕过 React 实例 tracker，事件让框架识别变更）
            await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
              objectId,
              functionDeclaration: `function(val) {
                var proto = this.tagName === 'TEXTAREA'
                  ? window.HTMLTextAreaElement.prototype
                  : window.HTMLInputElement.prototype;
                var desc = Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && desc.set) {
                  desc.set.call(this, val);
                } else {
                  this.value = val;
                }
                this.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: val }));
                this.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
                this.dispatchEvent(new Event('change', { bubbles: true }));
              }`,
              arguments: [value || ''],
              returnByValue: true,
            });

            // 回退后再次 readback 定成败
            readback = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
              objectId,
              functionDeclaration: `function() { return this.value; }`,
              returnByValue: true,
            });
            actual = readback.result?.result?.value;
          }

          if (readback.success && actual === (value || '')) {
            filled.push(field);
            settledChecks.push({ field, objectId, expected: value || '' });
          } else {
            failed.push({ field, error: `写入未生效（期望值 ${JSON.stringify(value || '')}，实际 ${JSON.stringify(actual)}）` });
          }
        }
      } catch (fieldErr) {
        failed.push({ field, error: fieldErr.message || '填写失败' });
      }
    }

    // 延时复核（问题 2）：部分页面（如 GitHub 登录页自定义元素 JS）会在
    // 填写后异步回退字段值，即时 readback 无法捕获。500ms 后二次回读，
    // 值不符则以独立错误移入 failed，区分"写入未生效"与"值被回退"。
    if (settledChecks.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
      for (const check of settledChecks) {
        const recheck = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId: check.objectId,
          functionDeclaration: `function() { return this.value; }`,
          returnByValue: true,
        });
        const current = recheck.result?.result?.value;
        if (recheck.success && current !== check.expected) {
          const idx = filled.indexOf(check.field);
          if (idx !== -1) filled.splice(idx, 1);
          failed.push({
            field: check.field,
            error: `值被页面脚本回退（填写后期望 ${JSON.stringify(check.expected)}，500ms 复核实际 ${JSON.stringify(current)}）`,
          });
        }
      }
    }

    return {
      success: failed.length === 0,
      filled,
      failed,
      captchaDetected,
      captchaType,
    };
  } catch (err) {
    return {
      success: false,
      filled,
      failed: [...failed, { field: '(system)', error: err.message || '表单填写异常' }],
    };
  } finally {
    detachForAI(webContentsId);
  }
}

/**
 * 执行页面操作（D-09/D-10/D-11/D-12/D-16）
 *
 * 通过 CDP 在页面上下文中定位目标元素并执行指定操作。
 * 元素定位：文本优先 + 选择器兜底。
 * 支持 15 种操作：click/scroll/type/select/check/focus/submit/upload/drag/hover/keydown/execute_script/screenshot/wait_for_element/blur
 *
 * @param {number} webContentsId - webContents ID
 * @param {string} action - 操作类型
 * @param {string} target - 目标元素描述（文本或 CSS 选择器）
 * @param {object} [options] - 操作参数（如键码、滚动距离、脚本内容等）
 * @returns {Promise<{success: boolean, result?: any, pageChanges?: object, error?: string}>}
 */
async function executeAction(webContentsId, action, target, options) {
  if (!action) {
    return { success: false, error: '操作类型不能为空' };
  }

  // screenshot 和 execute_script 不需要 target
  const noTargetActions = ['screenshot', 'execute_script'];
  if (!target && !noTargetActions.includes(action)) {
    return { success: false, error: '目标元素不能为空' };
  }

  // 注意：不要启用 Input 域 —— Input.enable 已在 Chromium 128+ 移除，
  // 而 Input.insertText/dispatch* 等命令本就无需 enable 即可调用。
  const attachResult = await attachForAI(webContentsId, ['Runtime', 'DOM']);
  if (!attachResult.success) {
    return { success: false, error: attachResult.error };
  }

  try {
    // screenshot 特殊处理：不需要元素定位
    if (action === 'screenshot') {
      const result = await executeCommand(webContentsId, 'Page.captureScreenshot', {
        format: options?.format || 'png',
        quality: options?.quality || 80,
      });
      if (!result.success) {
        return { success: false, error: result.error || '截图失败' };
      }
      const pageChanges = await _collectPageChanges(webContentsId);
      return { success: true, result: result.result?.data, pageChanges };
    }

    // wait_for_element 特殊处理：轮询 DOM
    if (action === 'wait_for_element') {
      const timeout = options?.timeout || 10000;
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const checkResult = await _evalScript(webContentsId, `
(function() {
  try {
    var el = document.querySelector('${target.replace(/'/g, "\\'")}');
    return el !== null;
  } catch (e) {
    return false;
  }
})()`);
        if (checkResult.success && checkResult.result?.result?.value === true) {
          const pageChanges = await _collectPageChanges(webContentsId);
          return { success: true, result: '元素已出现', pageChanges };
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return { success: false, error: '等待元素超时' };
    }

    // 其他操作需要定位元素
    const findScript = _buildFindElementScript(target);
    const objResult = await _getElementObjectId(webContentsId, findScript);

    if (!objResult.success || !objResult.result?.result?.objectId) {
      return { success: false, error: '元素未找到: ' + target };
    }

    const objectId = objResult.result.result.objectId;

    // 根据操作类型执行
    switch (action) {
      case 'click': {
        // 获取元素中心坐标
        const rectResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            var rect = this.getBoundingClientRect();
            return {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              width: rect.width,
              height: rect.height,
            };
          }`,
          returnByValue: true,
        });
        if (!rectResult.success || !rectResult.result?.result?.value) {
          return { success: false, error: '获取元素位置失败' };
        }
        const { x, y } = rectResult.result.result.value;
        // mousePressed + mouseReleased = click
        await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1,
        });
        await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1,
        });
        break;
      }

      case 'scroll': {
        const scrollX = options?.x || 0;
        const scrollY = options?.y || 300;
        if (target && target !== 'window' && target !== 'page') {
          // 滚动指定元素
          await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function(x, y) { this.scrollBy(x, y); }`,
            arguments: [scrollX, scrollY],
            returnByValue: true,
          });
        } else {
          // 滚动整个页面
          await _evalScript(webContentsId, `window.scrollBy(${scrollX}, ${scrollY})`);
        }
        break;
      }

      case 'type': {
        const text = options?.text || '';
        // Input.insertText 要求 webview 持有键盘焦点（同 fillForm 的 wc.focus 处理）
        const wcForType = webContents.fromId(webContentsId);
        if (wcForType && !wcForType.isDestroyed()) wcForType.focus();
        // 合成点击落位输入管线焦点（同 fillForm，防止 insertText 打进
        // embedder 的聚焦元素造成串字污染），再 focus 回验
        await _syntheticClickElement(webContentsId, objectId);
        const typeFocusCheck = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            this.focus();
            return document.activeElement === this;
          }`,
          returnByValue: true,
        });
        if (!typeFocusCheck.success || typeFocusCheck.result?.result?.value !== true) {
          throw new Error('无法聚焦到目标元素');
        }
        if (options?.clearFirst) {
          await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function() { this.value = ''; }`,
            returnByValue: true,
          });
        }
        // insertText 可能返回成功但文本被静默丢弃（同 fillForm 问题 1），
        // 插入前记录前值，插入后 readback 裁决，未落位则走原生 setter 回退。
        const beforeTypeResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() { return typeof this.value === 'string' ? this.value : null; }`,
          returnByValue: true,
        });
        const prevValue = beforeTypeResult.result?.result?.value;
        await executeCommand(webContentsId, 'Input.insertText', { text });
        if (text && prevValue !== null && prevValue !== undefined) {
          const afterTypeResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function() { return this.value; }`,
            returnByValue: true,
          });
          if (afterTypeResult.success && afterTypeResult.result?.result?.value === prevValue) {
            // 回退：原生 setter 在选区位置拼接插入 + 完整事件序列
            await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
              objectId,
              functionDeclaration: `function(t) {
                var start = typeof this.selectionStart === 'number' ? this.selectionStart : this.value.length;
                var end = typeof this.selectionEnd === 'number' ? this.selectionEnd : this.value.length;
                var newVal = this.value.slice(0, start) + t + this.value.slice(end);
                var proto = this.tagName === 'TEXTAREA'
                  ? window.HTMLTextAreaElement.prototype
                  : window.HTMLInputElement.prototype;
                var desc = Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && desc.set) {
                  desc.set.call(this, newVal);
                } else {
                  this.value = newVal;
                }
                this.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: t }));
                this.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: t }));
                this.dispatchEvent(new Event('change', { bubbles: true }));
              }`,
              arguments: [text],
              returnByValue: true,
            });
            break;
          }
        }
        // 触发事件
        await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            this.dispatchEvent(new Event('input', { bubbles: true }));
            this.dispatchEvent(new Event('change', { bubbles: true }));
          }`,
          returnByValue: true,
        });
        break;
      }

      case 'select': {
        const selectValue = options?.value || '';
        await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function(val) {
            var matched = false;
            for (var i = 0; i < this.options.length; i++) {
              if (this.options[i].value === val || this.options[i].textContent.trim() === val) {
                this.selectedIndex = i;
                matched = true;
                break;
              }
            }
            if (!matched) this.value = val;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this.dispatchEvent(new Event('input', { bubbles: true }));
            return matched || this.value === val;
          }`,
          arguments: [selectValue],
          returnByValue: true,
        });
        break;
      }

      case 'check':
      case 'uncheck': {
        const checked = action === 'check';
        await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function(checked) {
            if (this.checked !== checked) this.checked = checked;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this.dispatchEvent(new Event('input', { bubbles: true }));
          }`,
          arguments: [checked],
          returnByValue: true,
        });
        break;
      }

      case 'focus': {
        await executeCommand(webContentsId, 'DOM.focus', { objectId });
        break;
      }

      case 'blur': {
        await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() { this.blur(); }`,
          returnByValue: true,
        });
        break;
      }

      case 'submit': {
        await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            var form = this.closest('form') || this;
            if (form.tagName === 'FORM') {
              form.submit();
            } else {
              this.click();
            }
          }`,
          returnByValue: true,
        });
        break;
      }

      case 'upload': {
        const filePath = options?.filePath || options?.value || '';
        if (!filePath) {
          return { success: false, error: '文件上传需要提供文件路径' };
        }
        const nodeResult = await executeCommand(webContentsId, 'DOM.describeNode', { objectId });
        if (!nodeResult.success || !nodeResult.result?.node?.backendNodeId) {
          return { success: false, error: '无法获取文件输入元素节点' };
        }
        await executeCommand(webContentsId, 'DOM.setFileInputFiles', {
          files: Array.isArray(filePath) ? filePath : [filePath],
          backendNodeId: nodeResult.result.node.backendNodeId,
        });
        break;
      }

      case 'drag': {
        const fromRect = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            var rect = this.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }`,
          returnByValue: true,
        });
        if (!fromRect.success) return { success: false, error: '获取拖拽起始位置失败' };
        const from = fromRect.result.result.value;
        const toX = options?.toX || from.x;
        const toY = options?.toY || from.y;
        // dragstart → drag → dragend
        await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: Math.round(from.x), y: Math.round(from.y), button: 'left', clickCount: 1,
        });
        await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: Math.round(toX), y: Math.round(toY), button: 'left',
        });
        await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: Math.round(toX), y: Math.round(toY), button: 'left', clickCount: 1,
        });
        break;
      }

      case 'hover': {
        const hoverRect = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            var rect = this.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }`,
          returnByValue: true,
        });
        if (!hoverRect.success) return { success: false, error: '获取元素位置失败' };
        const hPos = hoverRect.result.result.value;
        await executeCommand(webContentsId, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: Math.round(hPos.x), y: Math.round(hPos.y),
        });
        break;
      }

      case 'keydown':
      case 'keyup': {
        const key = options?.key || options?.code || '';
        if (!key) return { success: false, error: '键盘事件需要提供 key 参数' };
        await executeCommand(webContentsId, 'Input.dispatchKeyEvent', {
          type: action,
          key,
          code: options?.code || key,
          windowsVirtualKeyCode: options?.keyCode || 0,
          nativeVirtualKeyCode: options?.keyCode || 0,
        });
        break;
      }

      case 'execute_script': {
        const script = options?.script || options?.value || '';
        if (!script) return { success: false, error: '脚本内容不能为空' };
        // 安全检查（D-16）
        const validation = _validateScript(script);
        if (!validation.safe) {
          return { success: false, error: '脚本安全检查未通过: ' + validation.reason };
        }
        const scriptResult = await _evalScript(webContentsId, script);
        if (!scriptResult.success) {
          return { success: false, error: scriptResult.error || '脚本执行失败' };
        }
        const pageChanges = await _collectPageChanges(webContentsId);
        return { success: true, result: scriptResult.result?.result?.value, pageChanges };
      }

      default:
        return { success: false, error: '不支持的操作类型: ' + action };
    }

    const pageChanges = await _collectPageChanges(webContentsId);
    return { success: true, result: action + ' 操作执行成功', pageChanges };
  } catch (err) {
    return { success: false, error: err.message || '操作执行异常' };
  } finally {
    detachForAI(webContentsId);
  }
}

/**
 * 收集页面变化信息（D-12）
 *
 * 操作执行后收集：当前 URL、是否有弹窗、表单验证错误
 *
 * @param {number} webContentsId - webContents ID
 * @returns {Promise<{url?: string, alerts?: string[], validationErrors?: string[]}>}
 */
async function _collectPageChanges(webContentsId) {
  const changes = {};
  try {
    const urlResult = await _evalScript(webContentsId, 'window.location.href');
    if (urlResult.success) {
      changes.url = urlResult.result?.result?.value;
    }
    const validationResult = await _evalScript(webContentsId, `
(function() {
  var errors = [];
  var invalids = document.querySelectorAll(':invalid, [aria-invalid="true"]');
  for (var i = 0; i < Math.min(invalids.length, 10); i++) {
    var msg = invalids[i].validationMessage || invalids[i].getAttribute('aria-errormessage') || '';
    if (msg) errors.push(msg);
  }
  return errors;
})()`);
    if (validationResult.success && Array.isArray(validationResult.result?.result?.value)) {
      const errors = validationResult.result.result.value;
      if (errors.length > 0) changes.validationErrors = errors;
    }
  } catch {}
  return changes;
}

// ==================== CAPTCHA/2FA 检测 ====================

/**
 * 检测页面中的 CAPTCHA/2FA 特征（D-15）
 *
 * 通过 Runtime.evaluate 在页面上下文执行检测脚本，结合 DOM 特征和页面关键词
 * 双重验证减少误报。检测范围包括 reCAPTCHA、hCaptcha、Turnstile 以及 2FA 页面。
 *
 * 置信度规则：
 * - 仅 DOM 特征 → detected=true, confidence='high'
 * - 仅关键词（>=2 个）→ detected=true, confidence='medium'
 * - DOM 特征 + 关键词 → detected=true, confidence='high'
 * - 关键词 < 2 个 → detected=false
 *
 * @param {number} webContentsId - webContents ID
 * @returns {Promise<{detected: boolean, type?: string|null, confidence?: 'high'|'medium'|'low'}>}
 */
async function detectCaptcha(webContentsId) {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) {
    return { detected: false, type: null, confidence: 'low' };
  }

  // 检查调试器是否已被占用（不自动附加，由调用方管理生命周期）
  const shouldDetach = !wc.debugger.isAttached();
  if (shouldDetach) {
    try {
      wc.debugger.attach('1.3');
    } catch {
      return { detected: false, type: null, confidence: 'low' };
    }
  }

  try {
    // 检测脚本：在页面上下文中执行，返回 DOM 特征和关键词匹配结果
    const detectScript = `
(function() {
  var result = {
    domFeatures: [],
    matchedKeywords: [],
    twofaDetected: false
  };

  // ==================== DOM 特征检测（高置信度）====================

  // reCAPTCHA（per D-15）
  if (document.querySelector('.g-recaptcha, iframe[src*="recaptcha"], .g-recaptcha-response, #recaptcha')) {
    result.domFeatures.push('recaptcha');
  }

  // hCaptcha（per D-15）
  if (document.querySelector('.h-captcha, iframe[src*="hcaptcha"]')) {
    result.domFeatures.push('hcaptcha');
  }

  // Turnstile（per D-15）
  if (document.querySelector('.cf-turnstile, iframe[src*="turnstile"]')) {
    result.domFeatures.push('turnstile');
  }

  // ==================== 关键词检测（中置信度）====================

  var bodyText = document.body ? document.body.innerText : '';

  // 中文关键词（per D-15）
  var cnKeywords = [
    '验证码', '机器人检测', '安全验证', '人机验证',
    '请完成安全验证', '请进行安全验证', '身份验证'
  ];

  // 英文关键词（per D-15）
  var enKeywords = [
    'CAPTCHA', 'verify you are human', 'prove you are not a robot',
    'security check', 'human verification', 'bot detection',
    'I\\'m not a robot', 'im not a robot'
  ];

  var allKeywords = cnKeywords.concat(enKeywords);
  for (var i = 0; i < allKeywords.length; i++) {
    if (bodyText.toLowerCase().indexOf(allKeywords[i].toLowerCase()) !== -1) {
      result.matchedKeywords.push(allKeywords[i]);
    }
  }

  // ==================== 2FA 页面检测（中置信度）====================

  // 检测 input[type="tel"] + 周围文本包含 2FA 关键词
  var telInputs = document.querySelectorAll('input[type="tel"]');
  if (telInputs.length > 0) {
    var twofaKeywords = ['验证码', '双重认证', '两步验证', '安全码', 'verification code', 'two-factor', '2fa', 'authenticator'];
    for (var j = 0; j < telInputs.length; j++) {
      var parent = telInputs[j].closest('form') || telInputs[j].parentElement || document.body;
      var parentText = parent.innerText || '';
      for (var k = 0; k < twofaKeywords.length; k++) {
        if (parentText.toLowerCase().indexOf(twofaKeywords[k].toLowerCase()) !== -1) {
          result.twofaDetected = true;
          break;
        }
      }
      if (result.twofaDetected) break;
    }
  }

  // 检测 input[inputmode="numeric"] + maxlength=6（典型 TOTP 输入框）
  if (!result.twofaDetected) {
    var numericInputs = document.querySelectorAll('input[inputmode="numeric"]');
    for (var m = 0; m < numericInputs.length; m++) {
      var maxLen = numericInputs[m].getAttribute('maxlength');
      if (maxLen && parseInt(maxLen, 10) >= 4 && parseInt(maxLen, 10) <= 8) {
        var numParent = numericInputs[m].closest('form') || numericInputs[m].parentElement || document.body;
        var numParentText = numParent.innerText || '';
        var totpKeywords = ['验证码', 'code', 'verification', '验证'];
        for (var n = 0; n < totpKeywords.length; n++) {
          if (numParentText.toLowerCase().indexOf(totpKeywords[n].toLowerCase()) !== -1) {
            result.twofaDetected = true;
            break;
          }
        }
      }
      if (result.twofaDetected) break;
    }
  }

  return JSON.stringify(result);
})()`;

    const cmdResult = await executeCommand(webContentsId, 'Runtime.evaluate', {
      expression: detectScript,
      returnByValue: true,
    }, 10000);

    if (!cmdResult.success || !cmdResult.result?.result?.value) {
      return { detected: false, type: null, confidence: 'low' };
    }

    const data = JSON.parse(cmdResult.result.result.value);
    const { domFeatures, matchedKeywords, twofaDetected } = data;

    // ==================== 双重验证逻辑（per D-15）====================

    // DOM 特征 + 关键词 → high confidence
    if (domFeatures.length > 0 && matchedKeywords.length > 0) {
      return {
        detected: true,
        type: domFeatures[0], // 取第一个 DOM 特征类型
        confidence: 'high',
      };
    }

    // 仅 DOM 特征 → high confidence
    if (domFeatures.length > 0) {
      return {
        detected: true,
        type: domFeatures[0],
        confidence: 'high',
      };
    }

    // 仅关键词（>=2 个）→ medium confidence
    if (matchedKeywords.length >= 2) {
      return {
        detected: true,
        type: 'keyword-detected',
        confidence: 'medium',
      };
    }

    // 2FA 检测 → medium confidence
    if (twofaDetected) {
      return {
        detected: true,
        type: '2fa',
        confidence: 'medium',
      };
    }

    // 未检测到
    return { detected: false, type: null, confidence: 'low' };
  } catch (err) {
    console.error('[Realm CDP] CAPTCHA 检测失败:', err.message);
    return { detected: false, type: null, confidence: 'low' };
  } finally {
    // 仅断开由本方法附加的调试器
    if (shouldDetach && wc && !wc.isDestroyed() && wc.debugger.isAttached()) {
      try { wc.debugger.detach(); } catch {}
    }
  }
}

/**
 * 检查 click 目标的元素类型（D-07 补漏，按用户决策改为类型判定）
 *
 * 语义/文字判定不可靠（"Sign in" 可能命中 passkey 按钮而非提交按钮），
 * 改为纯元素类型判定：
 * - isButton：按钮类元素（BUTTON / INPUT[submit|button|image|reset] / [role=button]）
 *   —— 按钮点击可能触发任意不可逆行为，一律需确认
 * - isSubmit：提交控件（input[submit|image]、form 内默认 type 的 button）且关联 form
 *   —— 等价于表单提交
 *
 * 失败时 fail-open（均为 false）—— 与 CAPTCHA 预检"异常不阻塞"决策一致。
 *
 * @param {number} webContentsId - webContents ID
 * @param {string} target - click 目标描述（文本或 CSS 选择器）
 * @returns {Promise<{success: boolean, found?: boolean, isButton: boolean, isSubmit: boolean, description?: string, error?: string}>}
 */
async function inspectClickTarget(webContentsId, target) {
  if (!target) return { success: false, isButton: false, isSubmit: false };

  const attachResult = await attachForAI(webContentsId, ['Runtime']);
  if (!attachResult.success) {
    return { success: false, isButton: false, isSubmit: false, error: attachResult.error };
  }

  try {
    const findScript = _buildFindElementScript(target);
    const objResult = await _getElementObjectId(webContentsId, findScript);
    if (!objResult.success || !objResult.result?.result?.objectId) {
      return { success: true, found: false, isButton: false, isSubmit: false };
    }

    const inspectResult = await executeCommand(webContentsId, 'Runtime.callFunctionOn', {
      objectId: objResult.result.result.objectId,
      functionDeclaration: `function() {
        var tag = this.tagName || '';
        var type = (this.getAttribute('type') || '').toLowerCase();
        var role = (this.getAttribute('role') || '').toLowerCase();
        var isButton =
          tag === 'BUTTON' ||
          (tag === 'INPUT' && ['submit', 'button', 'image', 'reset'].indexOf(type) !== -1) ||
          role === 'button';
        var isSubmitControl =
          (tag === 'INPUT' && (type === 'submit' || type === 'image')) ||
          (tag === 'BUTTON' && type !== 'button' && type !== 'reset');
        var form = this.closest('form');
        if (!form) {
          var formId = this.getAttribute('form');
          if (formId) form = document.getElementById(formId);
        }
        var text = tag === 'INPUT' ? (this.value || '') : (this.textContent || '');
        return {
          isButton: isButton,
          isSubmit: isSubmitControl && !!form,
          description: text.trim().slice(0, 50),
        };
      }`,
      returnByValue: true,
    });

    const value = inspectResult.result?.result?.value || {};
    return {
      success: true,
      found: true,
      isButton: value.isButton === true,
      isSubmit: value.isSubmit === true,
      description: value.description || '',
    };
  } finally {
    detachForAI(webContentsId);
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
  fillForm,
  executeAction,
  detectCaptcha,
  inspectClickTarget,
};

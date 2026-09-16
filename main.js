/**
 * Realm Browser - 主进程入口
 *
 * 应用生命周期管理，模块组装
 */

// 热重载配置（仅开发/调试模式，测试模式不启用）
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
  try { require('electron-reloader')(module); } catch {}
}

const path = require('path');
const { app, BrowserWindow, protocol, net, ipcMain, Menu, dialog, nativeTheme, session, Notification, shell } = require('electron');
const { pathToFileURL } = require('url');
const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');

/**
 * 加载 shell 环境变量
 *
 * macOS 打包后的 .app 从 Finder/Launchpad 启动时不会继承 shell 环境变量，
 * 导致 process.env 中读取不到用户在 ~/.zshrc 或 ~/.bash_profile 中设置的变量（如 API KEY）。
 * 此函数通过执行 `env -i bash -l -c env` 获取完整的 login shell 环境，合并到 process.env。
 * 仅在非开发模式下执行（开发/调试模式通过终端启动，已继承环境）。
 */
function loadShellEnv() {
  // 开发/调试模式通过终端启动，已继承环境变量
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') return;

  try {
    const shell = process.env.SHELL || '/bin/zsh';
    // 使用 login shell 读取 .zshrc/.bash_profile 等配置
    const cmd = `${shell} -l -c 'env -0'`;
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'ignore']
    });

    // env -0 使用 null 字符分隔，解析为 key=value 对
    const entries = output.split('\0').filter(Boolean);
    for (const entry of entries) {
      const eqIdx = entry.indexOf('=');
      if (eqIdx > 0) {
        const key = entry.slice(0, eqIdx);
        const value = entry.slice(eqIdx + 1);
        // 只设置尚未存在的环境变量，不覆盖已有值
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    console.log('[Realm] Shell 环境变量已加载');
  } catch (err) {
    console.warn('[Realm] 加载 shell 环境变量失败（非致命）:', err.message);
  }
}

// 环境隔离：开发/调试/Nightly 环境使用独立的 userData 目录
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
  app.setName('realm-dev');
} else if (process.env.NODE_ENV === 'nightly') {
  app.setName('realm-nightly');
}

// 应用图标：Nightly 版用深色背景圆角图标，正式版/开发环境用透明背景版
const APP_ICON_FILE = process.env.NODE_ENV === 'nightly' ? 'icon-nightly.png' : 'icon.png';

// 诊断日志落盘：打包版（Nightly/正式）没有终端，事后取证只能靠文件。
// 路径 <userData>/logs/diagnostics.log；启用环境 development/debug/nightly，
// production 完全不落盘。必须在任何 webContents 创建之前 init —— 下面
// web-contents-created 里靠 isEnabled() 决定是否挂诊断监听。详见 diagnostics-log.js
const diagnosticsLog = require('./diagnostics-log');
const diagnosticsInit = diagnosticsLog.init({
  dir: app.getPath('userData'),
  env: process.env.NODE_ENV || 'production',
  version: app.getVersion(),
});
diagnosticsLog.hookMainConsole(console);
if (diagnosticsInit.enabled) {
  // 走 diagLog：文件一定记，控制台回显只在 dev/debug（Nightly 保持零控制台输出）
  diagnosticsLog.diagLog('info', '诊断日志落盘已启用', diagnosticsInit.filePath);
}

// 加载 shell 环境变量（打包后 .app 需要）
loadShellEnv();

const Store = require('electron-store');
const containerManager = require('./container-manager');
const { DEFAULT_CONTAINERS } = require('./container-defaults');
const contextMenuManager = require('./context-menu-manager');

// 禁用 Privacy Sandbox 广告 API（FLEDGE/Protected Audience/Topics 等）。
// 这些 API 的存储（如 Partitions/<id>/InterestGroups SQLite 库）由 Chromium
// 网络服务进程持有，Electron 32 的 clearStorageData 无法清理，session 存活期间
// 删除目录后会被刷盘重建——这是 container-delete-partitions 问题的最终根因。
// 禁用后网站无法调用 joinAdInterestGroup，存储组件不初始化，目录不会再被写入。
// 必须在 app ready 之前设置。
app.commandLine.appendSwitch('disable-features',
  'InterestGroupStorage,Fledge,PrivacySandboxAdsAPIs,Topics,AttributionReporting,SharedStorage');

// 注册 realm:// 自定义协议为 privileged scheme（必须在 app.whenReady 之前调用）
// 用于加载内部页面如 realm://history
protocol.registerSchemesAsPrivileged([{
  scheme: 'realm',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
  }
}]);

// 内部页面 HTTP 服务器端口（will-navigate 中构建播放器页面 URL 需用到）
let realmPort = 0;

// 内部页面 API token（/api/* 与 /proxy 鉴权；will-navigate 构建播放器 URL 需注入，
// 故需在模块作用域可用，与 whenReady 内 HTTP 服务器共用同一值）
const REALM_TOKEN = crypto.randomUUID();

// webview 伪装 UA（web-contents-created setUserAgent 与 /proxy 视频请求头共用）。
// UA 版本号（Chrome/150）须与 ua-ch-manager / onBeforeSendHeaders 的品牌表同步。
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';


// 配置存储（whenReady 启动清理与 before-quit 退出清理共用）
const configStore = new Store({ name: 'realm-config' });
const windowManager = require('./window-manager');
const tabManager = require('./tab-manager');
const cookieManager = require('./cookie-manager');
const assignmentRules = require('./assignment-rules');
const shortcutManager = require('./shortcut-manager');
const { registerHandlers, getActiveWebviewContentsId, getGuestContainer, unregisterGuestContainer, setAIManager, setSearchManager, setRealmServerInfo, setMediaCaches, setMediaRecordEngine, setMediaConvertStarter } = require('./ipc-handlers');
const historyManager = require('./history-manager');
const downloadManager = require('./download-manager');
const credentialManager = require('./credential-manager');
const addressManager = require('./address-manager');
const favoritesManager = require('./favorites-manager');
const faviconFetcher = require('./favicon-fetcher');
const frequentSitesManager = require('./frequent-sites-manager');
const autocompleteManager = require('./autocomplete-manager');
const cdpManager = require('./cdp-manager');
const uaChManager = require('./ua-ch-manager');
const mediaSniffer = require('./media-sniffer');
const devRequestsWriter = require('./dev-requests-writer');
const AIManager = require('./ai-manager');
const { executeScript, validateScriptForSteps } = require('./ai-manager');
const dragCoordinator = require('./drag-coordinator');
const searchManager = require('./search-manager');
// AI 记忆 manager（Plan 43-01；electron 依赖在模块内部惰性获取，顶层 require 安全）
const aiMemoryManager = require('./ai-memory-manager');
// AI 工作区（agent 根目录：userData/agent-workspace，AI 落盘数据统一收纳）
const agentWorkspace = require('./agent-workspace');
// 内置技能播种（随包 skills-builtin/ → agent-workspace/managed-skills/，Phase 47）
const builtinSkillsSeeder = require('./builtin-skills-seeder');
// Bash 三档权限策略（纯函数零依赖，白名单服务端校验用）
const bashPolicy = require('./ai-bash-policy');
// 技能集单源校验器（Phase 50 D-10 / OQ-2：禁用名单的列表级校验）。
// 该模块**零 electron 依赖** ⇒ 主进程可直接 require（AGENTS.md 的硬约束 ① 已为该用法
// 背书）。`/api/settings/update` 与 `/api/skills/*` 共用这一份谓词，
// **不得**在本文件另写第二份正则（第二份必然漂移 ⇒ 「列表里有、开关点了 400」）。
const aiSkillsManager = require('./ai-skills-manager');
// 媒体分片磁盘缓存（Phase 44 D-03：/proxy 层按视频组织的分片缓存，仅独立播放器流量）
const { MediaCacheManager, videoIdOf } = require('./media-cache-manager');
// 媒体任务统一注册表（Phase 44 D-25：record/convert 状态机 + 持久化 + D-07 豁免查询源）
const { createMediaTaskManager } = require('./media-task-manager');
// 直播录制引擎（Phase 44 D-18/D-20/D-21/D-23：m3u8 轮询追分片，纯逻辑去 Electron 化）
const { createRecordEngine } = require('./media-record-engine');
// mp4 转封装（Phase 44 D-04：mux.js 纯 JS；D-22/D-24 convert 任务执行体与产物命名）
const { convertToMp4, buildOutputName } = require('./media-remuxer');

// 媒体缓存实例（whenReady 中初始化；handleProxyRequest 运行期读取）
let mediaCache = null;

// 媒体任务注册表实例（whenReady 中初始化；/api/tasks/* 端点与 D-07 豁免注入读取）
let mediaTaskManager = null;
// persistMediaTasks 使用的模块级状态（whenReady 中赋值）
let mediaTasksPath = null;
let lastPersistedStatuses = new Map();
let lastRunningCount = -1;

// convert 任务取消信号注册表（CR-04）：convert taskId -> () => void
// /api/tasks/cancel 对 running convert 任务经此触发协作式取消——置位 startConvertTask
// 注册的 shouldCancel 闭包，convertToMp4 每分片迭代检查后以 reason='cancelled' 中止；
// 实际终态（cancelled）由转码 promise 链 .catch 分支异步落定，令牌在 .finally 注销防泄漏
const convertCancelTokens = new Map();

// AI Manager 实例（在 app.whenReady 中初始化，供后续 Phase 通过 require('./main').aiManager 访问）
let aiManager = null;

// ==================== 操作确认 IPC 基础设施 ====================

/**
 * 待确认操作存储：actionId → { resolve, timer }
 * AI Manager 发起高风险操作确认时，Promise 的 resolve 回调存入此 Map，
 * 渲染进程用户点击确认/取消后通过 action:confirm/action:cancel IPC 触发。
 */
const pendingActions = new Map();

/**
 * 发起高风险操作确认请求
 *
 * AI Manager 检测到高风险操作（表单提交、文件上传、支付等）时调用。
 * 返回 Promise，等待用户在渲染进程确认卡片中点击确认或取消。
 *
 * @param {Object} actionData - 操作数据
 * @param {string} [actionData.actionId] - 操作唯一 ID（未提供则自动生成）
 * @param {string} actionData.type - 操作类型：submit/upload/payment/click
 * @param {string} actionData.title - 操作标题（如"提交表单"）
 * @param {string} [actionData.description] - 操作描述
 * @param {string} [actionData.url] - 目标页面 URL
 * @param {string} [actionData.containerId] - 容器 ID
 * @param {string} [actionData.containerName] - 容器名称
 * @param {string} [actionData.riskLevel] - 风险等级：low/medium/high
 * @param {Object} [actionData.details] - 附加详情
 * @returns {Promise<{confirmed: boolean, reason?: string}>} 用户确认结果
 */
function requestActionConfirmation(actionData) {
  // 检查是否有任何窗口存在
  const anyWindow = windowManager.getMainWindow();
  if (!anyWindow) {
    return Promise.resolve({ confirmed: false, reason: 'no-window' });
  }

  const actionId = actionData.actionId || `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const data = { ...actionData, actionId };

  return new Promise((resolve) => {
    // 超时自动取消（默认 30 秒；调用方可经 timeoutMs 覆盖——AI Bash 确认
    // 需要用户读完命令再决策，30 秒经常不够导致误取消）
    const timeoutMs = typeof actionData.timeoutMs === 'number' && actionData.timeoutMs > 0
      ? actionData.timeoutMs
      : 30000;
    const timer = setTimeout(() => {
      if (pendingActions.has(actionId)) {
        pendingActions.delete(actionId);
        console.log(`[Realm] 操作确认超时（${Math.round(timeoutMs / 1000)}s），自动取消: ${actionId}`);
        // 主动过期渲染端确认卡片，避免用户点击已无效应的 pending 卡片
        windowManager.broadcast('action:settle', {
          actionId,
          state: 'cancelled',
          message: '操作确认超时，已自动取消',
        });
        resolve({ confirmed: false, reason: 'timeout' });
      }
    }, timeoutMs);

    pendingActions.set(actionId, { resolve, timer });

    // 广播确认请求到所有渲染进程
    windowManager.broadcast('action:request-confirmation', data);
    console.log(`[Realm] 操作确认请求已广播: ${actionId}, 类型: ${data.type}, 风险: ${data.riskLevel}`);
  });
}

// ==================== webview guest 拦截（WR-1/WR-2/WR-9） ====================

/**
 * URL scheme 白名单：http/https/realm/file 允许加载/新建 Tab（WR-9）
 * file:// 为用户显式访问本地文件（本地 HTML 等）的需求放行；
 * data: 等可注入脚本的 scheme 仍拦截。
 * guest 侧提供的 URL（window.open、导航）一律先过此白名单
 * @param {string} url - 待校验的 URL
 * @returns {boolean} 是否允许
 */
function isAllowedWebUrl(url) {
  return typeof url === 'string' && (/^https?:\/\//i.test(url) || /^realm:\/\//i.test(url) || /^file:\/\//i.test(url));
}

/**
 * 重写 m3u8 清单：所有 URI 改写为回指 /proxy 的绝对路径 URL
 * 覆盖分片/子清单行（非 # 行）与 EXT-X-KEY/MAP/MEDIA/I-FRAME-STREAM-INF 等的
 * URI="..." 属性；相对地址以清单最终 URL（重定向后）为 base 解析。
 * 重写后 hls.js 按绝对 URL 直接请求，无需自定义 loader。
 * @param {string} text - 原始清单文本
 * @param {string} baseUrl - 清单最终 URL（重定向后）
 * @param {URLSearchParams} params - 代理请求参数（token/container/referer 透传给改写后的 URL）
 * @returns {string} 重写后的清单文本
 */
function rewriteM3u8ForProxy(text, baseUrl, params) {
  const toProxyUrl = (uri) => {
    const abs = new URL(uri, baseUrl);
    // data:/blob:/skd:（FairPlay DRM）等非 http(s) URI 保持原样，代理只转发 http(s)
    if (!/^https?:$/i.test(abs.protocol)) return uri;
    const q = new URLSearchParams();
    q.set('url', abs.toString());
    for (const key of ['token', 'container', 'referer']) {
      const v = params.get(key);
      if (v) q.set(key, v);
    }
    // Phase 44 D-01/D-03：仅独立播放器流量带 cache 标记，分片/密钥/子清单请求
    // 自动继承标记与视频 ID（vid = m3u8 清单 origin+pathname 的哈希，分片
    // 借此归属到视频目录；webview tab 流量无 cache 参数不进缓存分支）
    if (params.get('cache') === '1') {
      q.set('cache', '1');
      try {
        q.set('vid', params.get('vid') || videoIdOf(baseUrl));
      } catch { /* 非法 URL 时省略 vid，分片请求走透传 */ }
    }
    return `/proxy?${q.toString()}`;
  };
  return text.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          return `URI="${toProxyUrl(uri)}"`;
        } catch {
          return match;
        }
      });
    }
    try {
      return toProxyUrl(trimmed);
    } catch {
      return line;
    }
  }).join('\n');
}

/**
 * 处理 /proxy 视频流代理请求（hls.js 跨域请求同源化）
 * 播放器页面（localhost 源）对外部视频源的 XHR 会被 CORS 拦截，且部分站点
 * 校验 Referer 防盗链。经主进程 ses.fetch 代理后：请求同源（无 CORS）、
 * Referer 可控、容器 session 携带 Cookie。
 * m3u8 响应经 rewriteM3u8ForProxy 重写，分片/密钥/子清单请求同样走代理。
 * CR-01：命中优先——分片缓存查询先于回源，缓存 key = 请求 URL（target），
 * 命中直接读盘响应不发起 ses.fetch（断网已缓存分片照播 D-10 由此成立）。
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 * @param {URL} reqUrl - 解析后的请求 URL
 */
async function handleProxyRequest(req, res, reqUrl) {
  // token 鉴权：与 /api/* 一致，防 localhost 端口扫描把应用当开放代理
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  // Phase 44 D-01/D-03：仅独立播放器流量（URL 带 cache=1）进入缓存分支；
  // webview tab 流量无 cache 参数，保持现状纯透传
  const cacheEnabled = reqUrl.searchParams.get('cache') === '1';
  const target = reqUrl.searchParams.get('url') || '';
  let targetOrigin;
  try {
    targetOrigin = new URL(target).origin;
  } catch {
    targetOrigin = null;
  }
  if (!/^https?:\/\//i.test(target) || !targetOrigin) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  // Referer：优先来源页面（播放器 URL 的 referer 参数），按浏览器默认
  // strict-origin-when-cross-origin 策略净化——https 来源降级到 http 目标时
  // Chromium 网络层会以 "invalid referrer" 直接取消请求（ERR_BLOCKED_BY_CLIENT），
  // 此时回退目标站源 Referer（多数防盗链仅校验 Referer 是否本站）
  const refererParam = reqUrl.searchParams.get('referer') || '';
  let referer = '';
  if (refererParam) {
    try {
      const r = new URL(refererParam);
      const t = new URL(target);
      if (/^https?:$/i.test(r.protocol) && !(r.protocol === 'https:' && t.protocol === 'http:')) {
        referer = r.origin === t.origin ? refererParam : `${r.origin}/`;
      }
    } catch { /* 非法 referer 忽略 */ }
  }
  if (!referer) referer = `${targetOrigin}/`;
  const containerId = reqUrl.searchParams.get('container') || '';

  const headers = {
    'User-Agent': CHROME_UA,
    'Referer': referer,
  };
  // fMP4 等按字节范围请求的分片需要透传 Range
  if (req.headers.range) headers['Range'] = req.headers.range;

  // CR-01：命中优先分支——在回源（ses.fetch）之前先查分片缓存，命中直接
  // 读盘响应并 return（省流量 + 秒开 + 断网照播 D-10）；未命中才落到下方
  // fetch 回源 tee。Range 请求（206 语义）与 m3u8-likely URL 显式排除。
  const vidParam = reqUrl.searchParams.get('vid') || '';
  const vidOk = /^[a-f0-9]{16}$/.test(vidParam);
  // URL 层 m3u8 预判：m3u8 响应必须走下方 rewrite 清单分支，不得被命中优先截走
  //（伪装 m3u8 的 URL 在 cache 中本无条目——旧实现只有非 m3u8 才落盘——必然 miss）
  const isM3u8Target = /\.m3u8(\?|$)/i.test(target);
  if (cacheEnabled && mediaCache && vidOk && !req.headers.range && !isM3u8Target) {
    const hit = mediaCache.lookup(target, vidParam);
    if (hit.hit) {
      // 命中：读盘响应（Content-Length 用实际字节数，Pitfall 4）；Content-Type
      // 优先回放落盘时登记的 contentType（Task 2 扩展 lookup），缺省 octet-stream
      res.writeHead(200, {
        'Content-Type': hit.contentType || 'application/octet-stream',
        'Content-Length': hit.size,
        'Cache-Control': 'no-store',
      });
      res.end(hit.data);
      return;
    }
    // 命中失败（D-09 校验删片）自然落到下方 fetch 回源
  }

  try {
    const ses = containerId
      ? session.fromPartition(`persist:container-${containerId}`)
      : session.defaultSession;
    const resp = await ses.fetch(target, { headers });

    const contentType = resp.headers.get('content-type') || '';
    const finalUrl = resp.url || target;
    const isM3u8 = /mpegurl|m3u8/i.test(contentType) || /\.m3u8(\?.*)?$/i.test(finalUrl);

    if (resp.ok && isM3u8) {
      const text = await resp.text();
      const rewritten = rewriteM3u8ForProxy(text, finalUrl, reqUrl.searchParams);
      // 缓存上下文登记（Pitfall 2：live/VOD 清单本身不落盘，重写每次现做；
      // touchVideo 仅建档并刷新 last_watched，供分片落盘归属与淘汰排序）
      if (cacheEnabled && mediaCache) {
        try {
          mediaCache.touchVideo(finalUrl);
          // 44-05 转封装索引：记录分片播放顺序/总数/ENDLIST/DISCONTINUITY
          //（D-17 完整度分母 + 转封装分片顺序 + discontinuity 拒转依据）
          mediaCache.updatePlaylistIndex(finalUrl, text);
        } catch (err) {
          console.warn('[Realm] 缓存建档失败:', err.message);
        }
      }
      // Pitfall 7：/proxy 响应统一 no-store，避免 localhost 页面 Chromium HTTP
      // 缓存与自建磁盘缓存双写
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' });
      res.end(rewritten);
      return;
    }

    // Phase 44 分片缓存分支（D-03）：仅 cache=1 且非清单、非 Range（Pitfall 3：
    // Range 请求永远透传不落盘，避免破坏 206 语义）、回源成功时启用。
    // 命中已在上方 pre-fetch 分支处理（CR-01），此分支只负责未命中 tee 落盘
    if (cacheEnabled && mediaCache && resp.ok && !isM3u8 && !req.headers.range && vidOk) {
      // 未命中：tee 回源流——一边透传给播放器一边收集落盘（写盘失败不影响透传）。
      // 落盘 key 与命中查询同源（请求 URL target）；meta 带 contentType 供命中回放
      const outHeaders = { 'Content-Type': contentType || 'application/octet-stream', 'Cache-Control': 'no-store' };
      for (const h of ['content-range', 'accept-ranges']) {
        const v = resp.headers.get(h);
        if (v) outHeaders[h] = v;
      }
      res.writeHead(200, outHeaders);
      // CR-05：store 内部源流中断会 destroy(err) 传播到 tee 的 'error'——
      // 收尾截断响应（不悬挂连接），播放器侧拿到不完整响应走自身重试链路
      const tee = mediaCache.store(target, vidParam, Readable.fromWeb(resp.body), {
        contentType: contentType || 'application/octet-stream',
      });
      tee.on('error', () => {
        if (!res.writableEnded) res.end();
      });
      tee.pipe(res);
      return;
    }

    // 分片/密钥等非清单响应：流式透传
    const outHeaders = { 'Content-Type': contentType || 'application/octet-stream', 'Cache-Control': 'no-store' };
    for (const h of ['content-range', 'accept-ranges']) {
      const v = resp.headers.get(h);
      if (v) outHeaders[h] = v;
    }
    // ses.fetch 透明解压后 content-length 会失真，仅在未压缩时转发
    if (!resp.headers.get('content-encoding')) {
      const len = resp.headers.get('content-length');
      if (len) outHeaders['Content-Length'] = len;
    }
    res.writeHead(resp.status, outHeaders);
    if (resp.body) {
      // CR-05：透传流源 error 同款防护（Phase 27 遗留同一风险面）——源站 RST/
      // 链路闪断不再抛 uncaught exception 崩主进程；headers 已发，end 兜底
      // 收尾截断响应，客户端 fetch 报错走播放器自身重试
      Readable.fromWeb(resp.body)
        .on('error', (err) => {
          console.warn('[Realm] 视频透传流中断:', err.message);
          if (!res.writableEnded) res.end();
        })
        .pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.warn(`[Realm] 视频代理请求失败: ${target} — ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502);
    }
    res.end();
  }
}

/**
 * 从 webview guest 的 webContents 反推其所在容器 ID
 * 优先查渲染进程上报的 guest→容器 映射（Electron 32 下 guest 的
 * session.partition 为空串，无法从 session 可靠反推），映射未命中时
 * 回落 session.partition 解析
 * @param {Electron.WebContents} contents - guest webContents
 * @returns {string|null} 容器 ID，无法识别时返回 null
 */
function getGuestContainerId(contents) {
  // 首选：渲染进程上报的映射（webview 元素 partition 属性是权威来源）
  const fromMap = getGuestContainer(contents.id);
  if (fromMap) return fromMap;

  // 回落：session.partition 属性
  let partition = '';
  try {
    partition = contents.session ? contents.session.partition || '' : '';
  } catch (e) {
    console.log(`[Realm] 获取 partition 失败:`, e.message);
  }

  const prefix = 'persist:container-';
  if (partition.startsWith(prefix)) {
    return partition.slice(prefix.length);
  }

  // 如果 partition 不符合预期格式，尝试从 URL 或其他属性推断
  // 这是一个 fallback，正常情况下不应该执行到这里
  console.log(`[Realm] 无法从 partition 获取容器 ID, partition: "${partition}"`);
  return null;
}

/**
 * 通知渲染进程在指定容器新建 Tab（经 host webContents 转发）
 * @param {Electron.WebContents} contents - guest webContents
 * @param {string} url - 目标 URL（已过白名单校验才发送）
 * @param {string|null} containerId - 分配规则匹配的容器 ID（无匹配时传 null，
 *   由渲染进程按来源 webview 的 partition 决定容器——以 webview 元素属性为准）
 */
function notifyOpenUrlInTab(contents, url, containerId) {
  if (!isAllowedWebUrl(url)) return;
  const host = contents.hostWebContents;
  if (host && !host.isDestroyed()) {
    console.log(`[Realm] 通知渲染进程打开 URL: ${url} -> 规则容器: ${containerId || '(无匹配)'}, guestId: ${contents.id}`);
    host.send('open-url-in-tab', { url, containerId: containerId || null, guestId: contents.id });
  }
}

// WR-1：Electron 32 已移除 webview 的 new-window 事件，
// guest 页面 target=_blank / window.open 必须在主进程用 setWindowOpenHandler 拦截：
// 一律 deny 独立窗口，改为通知渲染进程在 guest 所在容器新建 Tab（D-09）
app.on('web-contents-created', (event, contents) => {
  // 渲染进程控制台落盘（主窗口与 webview guest 都挂）。**guest 必须挂在 guest 自身的
  // webContents 上**——挂在主窗口上收不到 guest 日志（Electron 43 实测，见
  // docs/debug/webview-hit-test-stuck.md §6.5）。过滤与环境门槛在 diagnostics-log 内。
  diagnosticsLog.attachContents(contents);

  // G-44-2 诊断：为每个 webContents 留存「最近 URL + 销毁日志」。
  // 用户下次复现闪退时，崩溃前最后一条 destroyed 日志即被销毁的具体 webContents
  //（候选：ERR_FAILED 的 mp4 webview guest 或播放器窗口本体）。
  // URL 取局部变量，不在 destroyed 回调里调 getURL——销毁后取值抛错。
  // 本块只挂监听与日志，不含行为逻辑（UA 覆盖、预加载注入等既有逻辑不动）。
  //
  // 输出分工（2026-09-15 变更）：
  // - `webContents destroyed`：仍只在 dev/debug 打控制台（正常关标签也会触发，落盘会刷屏）
  // - 下面几条「点不动」类故障的权威信号：改走 diagnosticsLog.diagLog ——
  //   **落盘在 development/debug/nightly 都生效**，控制台回显仍只在 dev/debug
  //   （Nightly 控制台保持零输出）。这是本次「合到 master 后在 Nightly 观察」所需的取证通道。
  const isDebugConsole = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug';
  const diagnosticsActive = diagnosticsLog.isEnabled() || isDebugConsole;
  const wcType = contents.getType();
  let lastUrl = '';

  if (diagnosticsActive) {
    contents.on('did-navigate', (navEvent, url) => { lastUrl = url; });
    contents.on('dom-ready', () => {
      try { lastUrl = contents.getURL(); } catch { /* 过渡态取值失败，保留上次记录 */ }
    });
  }
  if (isDebugConsole) {
    contents.once('destroyed', () => {
      console.log(`[Realm] webContents destroyed id=${contents.id} type=${wcType} url=${lastUrl}`);
    });
  }

  if (diagnosticsActive) {
    // 网页区「点不动」类故障的权威信号（docs/debug/webview-hit-test-stuck.md 的判别依据）：
    // - unresponsive：渲染进程主线程卡住，页面保留最后一帧、点击与打字全部无响应、
    //   刷新不生效（刷新请求也送不进卡住的进程）——「只能重启」类故障最可能的形态
    // - render-process-gone：渲染进程崩溃或被系统回收，画面同样冻结在最后一帧
    // - responsive：从卡死中恢复
    // 这三条是「guest 进程死了」与「宿主命中测试坏了」的分界线：guest 卡死时
    // executeJavaScript（hint/搜索栏注入）也会失效，反之则注入仍可用——用户报的
    // 「f 能聚焦输入框但鼠标点不动」正属于后者。
    contents.on('unresponsive', () => {
      diagnosticsLog.diagLog('warn', 'webContents 无响应', `id=${contents.id} type=${wcType} url=${lastUrl}`);
    });
    contents.on('responsive', () => {
      diagnosticsLog.diagLog('info', 'webContents 已恢复响应', `id=${contents.id} type=${wcType} url=${lastUrl}`);
    });
    contents.on('render-process-gone', (goneEvent, details) => {
      diagnosticsLog.diagLog(
        'warn',
        '渲染进程退出',
        `id=${contents.id} type=${wcType} url=${lastUrl} reason=${details && details.reason} exitCode=${details && details.exitCode}`
      );
    });
    // -3 是 ERR_ABORTED（正常导航取消/被 stop 打断），滤掉以免刷屏
    contents.on('did-fail-load', (failEvent, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      diagnosticsLog.diagLog(
        'warn',
        '主框架加载失败',
        `id=${contents.id} type=${wcType} url=${validatedURL} code=${errorCode} ${errorDescription}`
      );
    });
  }

  if (contents.getType() !== 'webview') return;

  console.log(`[Realm] webview webContents 创建, id: ${contents.id}`);

  // 伪装为普通 Chrome，避免网站针对 Electron 的 User-Agent 字符串返回差异内容。
  // 仅覆盖 UA 字符串即可：navigator.userAgentData.brands / Sec-CH-UA 请求头
  // 默认只有 GREASE 和 Chromium，本就不含 Electron 品牌（已实证，
  // 见 docs/debug/github-login-404-two-factor-app.md 第 5 节）。
  contents.setUserAgent(CHROME_UA);

  // 注意：不要在此处用 CDP 覆盖 User-Agent Client Hints 品牌列表。
  // 历史原因：早期方案在 web-contents-created（webview 尚未首次导航）时
  // 立即 attach debugger 并发 Network.setUserAgentOverride，实测该命令在
  // 从未导航过的 target 上会永久挂起（不 resolve/catch）——
  // 覆盖从不生效（对应 docs/debug 中"Round 4 console 无日志"现象），
  // 且 debugger 一直处于 attached 状态，阻塞 DevTools 与 AI 工具（cdpManager），
  // 还会发出不一致/半应用的 Sec-CH-UA 头干扰 GitHub 等对指纹敏感的登录流程
  // （曾导致 GitHub 2FA 页 404，详见 docs/debug/github-login-404-two-factor-app.md）。
  // 若某天确需覆盖 brands，应在首次导航完成后再发送，并保持 debugger 附着、
  // 与 cdpManager/AI 工具协调生命周期，而非在此处一次性 attach/detach。

  // guest 销毁时清理容器映射，避免 Map 泄漏
  contents.on('destroyed', () => {
    unregisterGuestContainer(contents.id);
    // D-03 用完即卸兜底：webview 销毁时清理 AI 工具附加的 CDP 调试器状态
    // （debuggerStates Map 条目；无 ai-tool 状态时 detachForAI 内部静默返回）
    cdpManager.detachForAI(contents.id);
    // 页面导航状态清理（pageNavStates 条目 + 捕获定时器）
    cdpManager.cleanupNavState(contents.id);
    // UA 覆盖管理器状态清理（debugger 由 Electron 自动断开）
    uaChManager.release(contents.id);
    console.log(`[Realm] webview 销毁，已清理容器映射与 CDP 调试器状态: ${contents.id}`);
  });

  // 首次导航后附加 UA Client Hints 覆盖（同时改请求头 Sec-CH-UA 与页面
  // navigator.userAgentData）。不能在 web-contents-created 未导航时 attach——
  // CDP Network 命令在未导航 target 上永久挂起（github-login-404 实证）。
  // 三事件注册 + attach 幂等（ua-ch-manager 内部 heldState 去重），先到先得：
  // - did-navigate：导航提交后立即触发（页面 DOM 未解析，覆盖在页面 JS 读取
  //   userAgentData 之前生效，彻底避免"首次导航读到默认值"的时序漏洞）
  // - dom-ready：DOMContentLoaded 后触发（比 did-finish-load 可靠，Google accounts
  //   页存在持续加载的 iframe，onload 可能长时间不完成）
  // - did-finish-load：onload 后触发（兜底）
  contents.on('did-navigate', (event, url) => {
    console.log(`[Realm] webview 导航完成: ${url}`);
    uaChManager.attach(contents);

    // 视频文件 URL 原生播放时，Chromium 原生视频文档默认按原始尺寸居中显示
    // （画面过小）。注入 CSS 强制 video 元素铺满视口，object-fit: contain 保持宽高比。
    if (/\.(mp4|webm|flv|mov|mkv|avi|m4v|ogv)(\?.*)?$/i.test(url)) {
      contents.insertCSS(
        'video { width: 100vw !important; height: 100vh !important; object-fit: contain !important; }'
      ).catch(err => console.warn(`[Realm] 视频铺满 CSS 注入失败: ${err.message}`));
    }
  });
  contents.on('dom-ready', () => {
    console.log(`[Realm UA-CH] dom-ready 触发, webContents: ${contents.id}, url: ${contents.getURL()}`);
    uaChManager.attach(contents);
    // 诊断：dump 页面侧实际指纹（Gaia 风控 JS 读到的值），用于验证 CDP 覆盖是否生效。
    // 若 brands 缺 Google Chrome，说明 ua-ch-manager 未持有 debugger（看上方 attach 日志）。
    if (contents.getURL().includes('accounts.google.com')) {
      contents.executeJavaScript(`(async () => {
        const out = {
          brands: navigator.userAgentData ? navigator.userAgentData.brands : null,
          platformVersion: null,
          uaFullVersion: null,
        };
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
          const he = await navigator.userAgentData.getHighEntropyValues(['platformVersion', 'uaFullVersion']);
          out.platformVersion = he.platformVersion;
          out.uaFullVersion = he.uaFullVersion;
        }
        return JSON.stringify(out);
      })()`)
        .then(r => console.log(`[Realm 指纹] 页面侧 userAgentData: ${r}`))
        .catch(err => console.warn(`[Realm 指纹] dump 失败: ${err.message}`));
    }
  });
  contents.on('did-finish-load', () => {
    uaChManager.attach(contents);
  });
  contents.setWindowOpenHandler(({ url, disposition, frameName, features }) => {
    console.log(`[Realm] 新窗口请求: ${url}, disposition: ${disposition}, frameName: ${frameName}`);
    // 检查分配规则，决定目标容器
    const matchedContainer = assignmentRules.matchUrl(url);
    // D-09：无规则匹配时传 null，由渲染进程按来源 webview 所在容器新建 Tab
    if (matchedContainer) {
      console.log(`[Realm] 规则匹配 (新窗口): ${url} -> ${matchedContainer}`);
    }

    notifyOpenUrlInTab(contents, url, matchedContainer);
    return { action: 'deny' };
  });

  // 添加导航事件监听，用于调试和 CDP 抓取
  contents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    console.log(`[Realm] did-start-navigation: ${url}, isInPlace: ${isInPlace}, isMainFrame: ${isMainFrame}`);

    // CDP 管理器：检查域名匹配并自动附加/断开调试器
    // isInPlace 透传：SPA 同文档导航不轮换 pageRequestId
    if (isMainFrame) {
      const containerId = getGuestContainerId(contents);
      if (containerId) {
        cdpManager.handleNavigation(contents, url, containerId, isInPlace);
      }
    }
  });

  contents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    console.log(`[Realm] did-navigate-in-page: ${url}, isMainFrame: ${isMainFrame}`);
  });

  // F12 拦截：Electron 无内置 F12 快捷键，可通过 before-input-event 捕获
  // Cmd+Option+I 由应用菜单 accelerator 处理（见下方菜单注册）
  contents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (contents.isDevToolsOpened()) {
        contents.closeDevTools();
      } else {
        contents.openDevTools();
      }
    }
  });

  // WR-2：webContents 的 will-navigate 可同步取消（webview 标签上的同名事件
  // 文档明示 preventDefault 无效）。分配规则命中其他容器时，同步取消当前导航
  // 并通知渲染进程在匹配容器新建 Tab，避免同一页面出现在两个容器。
  contents.on('will-navigate', (event, url) => {
    console.log(`[Realm] will-navigate 事件: ${url}`);
    // WR-9 纵深防御：非 http(s) 导航一律拦截（about:blank 等内部页放行）
    if (!isAllowedWebUrl(url) && url !== 'about:blank') {
      console.log(`[Realm] 导航被拦截（非 http）: ${url}`);
      event.preventDefault();
      return;
    }

    // m3u8 视频文件导航时，在当前 webview 加载播放器页面（hls.js 转码播放）。
    // 排除内部服务器 URL：播放器页面 URL 内嵌的 m3u8 ?url= 参数在
    // 无查询串时会以 .m3u8 结尾，不排除会导致重复包装
    if (/\.m3u8(\?.*)?$/i.test(url) && !(realmPort && url.startsWith(`http://localhost:${realmPort}/`))) {
      event.preventDefault();
      console.log(`[Realm] m3u8 导航拦截，转播放器页面: ${url}`);
      if (realmPort) {
        // 携带容器与 token（webview tab 播放器页面直连拉流，44-09 G-44-2、D-01：
        // 仅独立播放器窗口走 /proxy；container/token 参数保留供页面上下文使用）。
        // CR-06 限制：直连下 hls.js 以 XHR 拉清单/分片（CORS 门控），跨源不带容器
        // Cookie、Referer 为 localhost——「无 ACAO / 校验 Referer / Cookie 门控」的
        // 源站可能不可用。下方 referer 参数仅独立窗口 /proxy 链路消费（本链路
        // proxiedUrl 不构造代理 URL，参数被忽略）
        const params = new URLSearchParams({ url });
        const guestContainer = getGuestContainerId(contents);
        if (guestContainer) params.set('container', guestContainer);
        params.set('token', REALM_TOKEN);
        const fromUrl = contents.getURL();
        if (/^https?:\/\//i.test(fromUrl)) params.set('referer', fromUrl);
        const playerUrl = `http://localhost:${realmPort}/player/?${params}`;
        // will-navigate 中 preventDefault 后立即 loadURL 会触发 ERR_FAILED
        // 延迟到下一个 tick 让 Electron 完成导航取消后再发起新加载
        setImmediate(() => {
          contents.loadURL(playerUrl).catch((err) => {
            console.warn(`[Realm] 播放器页面加载失败: ${err.message}`);
          });
        });
      } else {
        console.warn('[Realm] 内部页面服务器尚未启动，无法加载播放器');
      }
      return;
    }

    const currentContainer = getGuestContainerId(contents);
    console.log(`[Realm] 当前容器: ${currentContainer}, 检查规则匹配...`);
    const matchedContainer = assignmentRules.matchUrl(url);
    console.log(`[Realm] 匹配结果: ${matchedContainer || '无匹配'}`);

    // 分配规则命中其他容器时，才同步取消当前导航并新建 Tab
    if (matchedContainer && matchedContainer !== currentContainer) {
      event.preventDefault();
      console.log(`[Realm] 规则匹配成功: ${url} -> ${matchedContainer}`);
      notifyOpenUrlInTab(contents, url, matchedContainer);
    }
  });
});

// ==================== UA Client Hints 伪装（Google 等指纹敏感站点兼容） ====================

/**
 * Chrome 150 真实 Sec-CH-UA 品牌表——按 Chromium 源码逐字段计算
 * （components/embedder_support/user_agent_utils.cc，tag 150.0.7871.250）：
 *   "Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"
 * - GREASE 字符串/版本随主版本确定性轮换（seed=150 → "Not;A=Brand" v"8"，
 *   算法见 ua-ch-manager.js UA_METADATA 注释），抄旧版本（如 v128 的 v"24"）
 *   一眼假；
 * - 品牌顺序由 GetRandomOrder(seed=150, size=3) 确定性洗牌决定：
 *   orders[150 % 6] = {0,1,2} 恒等 → GREASE → Chromium → Google Chrome；
 * - 反爬系统按 Chrome 版本校验 GREASE 字符串/版本/顺序，错一个即判定伪造
 *   （Chromium 构建默认 brands 只有 [GREASE, Chromium]，缺 Google Chrome）。
 *
 * 背景：contents.setUserAgent() 只改 UA 字符串，Sec-CH-UA 低熵头仍由内核按真实
 * 品牌生成（无 Google Chrome）。UA 声称 Chrome/150 而 CH 说不是 Chrome → 身份
 * 不一致。GitHub 校验宽松能过；Google 登录风控严格，直接拒绝并跳转
 * /v3/signin/rejected（"此浏览器或应用可能不安全"）。
 *
 * 修复：在请求发出前注入与 UA 字符串一致的 Sec-CH-UA 头。
 * 不用 CDP Network.setUserAgentOverride：该命令需保持 debugger 附着才不失效，
 * 而 webContents.debugger 是单客户端，会与 AI 工具（cdpManager.attachForAI）
 * 和 Network 抓包冲突。
 */
app.on('session-created', (ses) => {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // 仅 HTTPS 主文档与子资源（Client Hints 只在安全上下文有意义）
    if (!details.url.startsWith('https://')) {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }
    const headers = { ...details.requestHeaders };
    // 清除已存在的任何大小写变体，避免残留旧值/重复头
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (lower === 'sec-ch-ua' || lower === 'sec-ch-ua-mobile') {
        delete headers[key];
      }
    }
    // 注入与 UA 字符串（Chrome/150.0.0.0）一致的品牌表（顺序/GREASE 按源码计算，
    // 见上方注释）；sec-ch-ua-platform 保持内核默认（"macOS"，与真实一致，无需覆盖）
    headers['sec-ch-ua'] = '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"';
    headers['sec-ch-ua-mobile'] = '?0';

    // 高熵 Client Hints（内核仅在服务端通过 Accept-CH/Critical-CH 请求后才会发送，
    // 这里只改写已存在的头，不主动注入——Chrome 不会发送未被请求的高熵头，主动
    // 注入本身就是指纹异常）。Google 登录页会请求这些高熵头，而内核按真实品牌生成
    // （只有 GREASE + Chromium，缺 Google Chrome），与上面伪装的低熵 sec-ch-ua
    // 矛盾 → 跨通道身份不一致，是 signin/rejected 的强伪造信号。版本号取内核真实
    // 值 150.0.7871.250，与 JS 侧 uaFullVersion（不受 CDP 覆盖控制、恒为内核值）
    // 及 ua-ch-manager 的 fullVersionList 保持一致；品牌顺序与低熵头相同。
    // arch/bitness/platform/platform-version/model 内核取值与同机真实 Chrome 相同，
    // 无需改写。
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (lower === 'sec-ch-ua-full-version-list') {
        headers[key] =
          '"Not;A=Brand";v="8.0.0.0", "Chromium";v="150.0.7871.250", "Google Chrome";v="150.0.7871.250"';
      } else if (lower === 'sec-ch-ua-full-version') {
        headers[key] = '"150.0.7871.250"';
      }
    }
    callback({ requestHeaders: headers });
  });

  // 验证日志：打印实际发出的 CH 头（onSendHeaders 能看到 onBeforeSendHeaders 的修改结果）。
  // 注意：不要截断 UA。此前 .slice(0,80) 恰好把 "Chrome/128.0.0.0 Safari/537.36" 尾缀切掉，
  // 打印结果看起来像"默认 WebKit UA"，造成"UA 覆盖没生效"的严重误导（实际早已生效，
  // 见 docs/debug/google-login-ua-cover-done.md）。
  ses.webRequest.onSendHeaders((details) => {
    if (details.url.includes('accounts.google.com')) {
      const ua = details.requestHeaders['User-Agent'] || '(缺失)';
      console.log(
        `[Realm UA-CH] ${details.method} ${details.url}\n` +
        `  sec-ch-ua: ${details.requestHeaders['sec-ch-ua'] || details.requestHeaders['Sec-CH-UA'] || '(缺失)'}\n` +
        `  sec-ch-ua-full-version-list: ${details.requestHeaders['sec-ch-ua-full-version-list'] || '(未发送/未请求)'}\n` +
        `  user-agent: ${ua}\n` +
        `  ua-chrome: ${ua.includes('Chrome/') ? 'YES' : 'NO'}`
      );
    }
  });

  // 媒体嗅探：拦截视频类型响应（per SNIFF-01）
  // 使用 onResponseStarted（当前未被 onBeforeSendHeaders/onSendHeaders 占用）
  // 只读事件，不干扰请求流程
  ses.webRequest.onResponseStarted(
    { urls: ['*://*/*'] },
    (details) => {
      // 功能开关检查（per D-09）：关闭时直接 return，不处理任何嗅探
      const enabled = configStore.get('settings.mediaPlayer.enabled', false);
      if (!enabled) return;

      // 白名单过滤（per D-06/D-07）：白名单为空则全部通过，非空则仅白名单域名通过
      // 白名单按站点页面域名过滤（per G-29-12），媒体资源常在 CDN 域（如 bilivideo.com），
      // 按 details.url 匹配会误挡白名单站点自身内容
      const whitelist = configStore.get('settings.mediaPlayer.whitelist', []);
      const { webContents } = require('electron');
      const pageUrl = details.webContentsId
        ? webContents.fromId(details.webContentsId)?.getURL()
        : null;
      if (!mediaSniffer.isDomainWhitelisted(pageUrl || details.url, whitelist)) return;

      mediaSniffer.handleNetworkResponse(details);
    }
  );
});

// ==================== 应用启动 ====================

app.whenReady().then(async () => {
  console.log('[Realm] 应用启动');

  // macOS Dock 图标：dev 模式下 electron 不会读 package.json build.mac.icon，
  // 需要用 nativeImage 显式覆盖；打包后 Info.plist 已声明，重复设置无副作用
  if (process.platform === 'darwin') {
    const { nativeImage } = require('electron');
    const iconPath = path.join(__dirname, 'icons', APP_ICON_FILE);
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }

  // 本地 HTTP 服务器：为 webview 提供内部页面（realm:// 页面在 webview 中无法直接加载）
  // 渲染进程将 realm://history 转换为 http://localhost:PORT/history 后由 webview 加载
  //
  // 内部页面的数据访问走 /api/history/* JSON 端点而非 IPC：
  // webview guest 的 IPC 会被 assertTrustedSender（CR-4）拒绝，
  // 给 guest 挂载 preload 又会在导航到外部站点时泄露 realmAPI。
  // API 使用随机 token 鉴权（防 CSRF/端口扫描），token 仅经
  // get-realm-port IPC 传递给受信主窗口，再注入内部页面 URL。
  const REALM_MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  // 请求体体积上限（SEC-09，单源常量；端点与前端零字面量）
  //
  // - `MAX_JSON_BODY_BYTES`：`/api/*` POST 的**全局默认**（fail-closed）。形状刻意是
  //   「默认小 + 需大者显式放大」：忘了声明上限的端点会在 1 MiB 处当场 413 可见，
  //   而不是静默地退化成假边界（Phase 51 的 zip base64 导入届时显式放大）。
  // - `MAX_JSON_BODY_BYTES_LARGE`：body 是**用户文件全文**的端点专用。今天只有两个：
  //   `POST /api/favorites/import-chrome` 与 `POST /api/favorites/import-html`
  //   （`src/favorites-page.js` 提交 `file.text()` 的完整内容；Chrome / Safari 导出的
  //   书签文件常规 1–10 MB，且 import-html 的预览与执行各发一次）。不显式放大会
  //   **静默破坏既有功能**（用户点「导入书签」得到 413）。
  // ⚠️ 1 MiB 与 PITFALLS P7 的「单 entry 解压 ≤ 1 MB」是**同数不同量**：前者是
  //    HTTP 传输层闸，后者是解压层闸，两者尺度不同、不得互相替代。
  const MAX_JSON_BODY_BYTES = 1024 * 1024;
  const MAX_JSON_BODY_BYTES_LARGE = 32 * 1024 * 1024;

  // 技能包上传的体积上限（Phase 51 D-01，单源常量；端点与前端零字面量）
  //
  // ⚠️ 与 `MAX_JSON_BODY_BYTES_LARGE`（书签导入专用）**同数不同量**：前者是技能 zip 包
  //    的 raw binary body 上限，后者是书签文件全文的 JSON body 上限。命名必须区分。
  // ⚠️ 与 P7 的「单 entry 解压 ≤ 1 MB」同理是**同数不同量**的不同层闸口。
  //
  // 与解压侧的 `IMPORT_LIMITS.MAX_TOTAL_BYTES`（32 MiB）同值，方向必须写对（CR-5）：
  // 「**合法包**的解压总量 ≤ 32 MiB ⇒ 其**压缩后**体积必然 ≤ 32 MiB，故本闸不会误杀
  // 合法包」。**反向不成立** —— 实测一个 101,923 B 的包声明解出 104,857,600 B
  // ⇒ **本闸对 zip 炸弹防护零贡献**，真正的两道独立闸是「压缩比闸」与「累计字节闸」
  //（都在 `ai-skills-manager.readSkillPackageEntries` 里）。
  const MAX_SKILL_PACKAGE_BYTES = 32 * 1024 * 1024;

  /**
   * 发送 JSON 响应
   *
   * **幂等护栏是「一次修好全部发送点」的形状**：13 处宿主（12 个具名 handler + `realmServer`
   * 内 `/api/bookmarks-bar/toggle` 的内联分支）的 `catch → sendJson` 全都依赖它。
   * `readJsonBody` 自己答了 413 又 reject 时，外层 `catch` 的二次发送会在此 no-op ——
   * 否则 `ERR_HTTP_HEADERS_SENT`，而服务器回调是 `async`（HTTP 层不接管返回的 Promise）
   * ⇒ unhandled rejection ⇒ 本仓无全局兜底 ⇒ **主进程退出**。
   *
   * ⚠️ **不得新增**任何 `res.writeHead` 响应发送点（`main.js` 的累计基线是 14 处：
   * 既有 13 处非 JSON 发送点 + 本函数 1 处），也不得在本函数之外写 JSON 响应。
   *
   * @param {http.ServerResponse} res - 响应对象
   * @param {number} status - HTTP 状态码
   * @param {*} data - 响应数据
   */
  function sendJson(res, status, data) {
    if (res.headersSent || res.writableEnded) return; // 已答过即 no-op（拒收路径必需）
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  /**
   * 读取并解析 POST 请求的 JSON body（带体积上限，SEC-09 / Phase 50 D-16）
   *
   * 三条同时成立，缺一即回归：
   * 1. **累积中拒收**：每个 chunk 累加 `size` 后立即比较，超限即**停止拼接 body**
   *    （`if (rejected) return;`）并答 413。**不是**「读完再判 `body.length`」——
   *    后者会把整个 body（Phase 51 可达数十 MiB）收进堆，那不是防护。
   * 2. **不断连**：超限走 `req.resume()` 排水，**不** `req.destroy()`（实测客户端会
   *    拿到 EPIPE 而非 413 ⇒ ROADMAP 判据 5 的「返回明确错误」不成立），
   *    **不**设 `Connection: close`（两次实测结论相反、且无任何收益）。
   * 3. **`res` 缺失时只 reject**（降级分支）：全仓**没有** `uncaughtException` /
   *    `unhandledRejection` 全局兜底 ⇒ 若在 `data` 监听器里对 `undefined` 调
   *    `sendJson` 会 `TypeError` ⇒ Electron 主进程直接退出。本条把「漏改一处调用点」
   *    的后果从**崩溃**降为「该端点超限答 400」——一样当场可见，但不致命。
   *
   * 已答 413 之后仍会 reject 一个带 `code: 'BODY_TOO_LARGE'` 的错误；外层 handler 的
   * `catch → sendJson` 由 `sendJson` 的幂等护栏吸收（否则 `ERR_HTTP_HEADERS_SENT`）。
   *
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} [res] - 响应对象（漏传 ⇒ 只 reject，不答响应）
   * @param {{maxBytes?: number}} [options] - `maxBytes` 缺省取 `MAX_JSON_BODY_BYTES`
   * @returns {Promise<Object>} 解析后的 body
   */
  function readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {}) {
    // 能力探测：`res` 的存在性与 `writeHead` 的能力**两个原始条件都要判**
    const canRespond = !!(res && typeof res.writeHead === 'function');
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;
      let rejected = false;
      const tooLarge = () => {
        rejected = true;
        if (canRespond) {
          sendJson(res, 413, { error: '请求体超过上限（' + maxBytes + ' 字节）', limit: maxBytes });
          req.resume(); // 停止累积、把剩余流排空（内存 O(1) 且 413 可达）
        }
      };
      // 快路径：`Content-Length` 预检（零字节读取即拒）。
      // ⚠️ 该头可伪造 / 可缺失 ⇒ 只作加速，**不得**取代下面的累积中判（那才是唯一判据）。
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        tooLarge();
        reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
        return;
      }
      req.on('data', (chunk) => {
        if (rejected) return; // 停止累积（关键：不再拼 body，堆不随 body 线性增长）
        size += chunk.length;
        if (size > maxBytes) {
          tooLarge();
          reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
          return;
        }
        body += chunk;
      });
      req.on('end', () => {
        if (rejected) return;
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * 读取 POST 请求的**原始二进制** body（带体积上限，Phase 51 D-01）
   *
   * 与 `readJsonBody` 的唯一差异是 `chunks.push(chunk)` + `Buffer.concat(chunks)`
   * （二进制），**不是**字符串拼接。三条教训逐条照抄，缺一即回归：
   * 1. **累积中拒收**：`if (rejected) return;` **先于**累加 size（顺序即判据）。
   * 2. **不断连**：超限走 `req.resume()` 排水，**不** `req.destroy()`（实测客户端会拿到
   *    EPIPE 而非 413）、**不**设 `Connection: close`。两条禁令在源码里由
   *    `tests/test-skills-http-api.js` 的负向 token 判据钉着（判据先剥注释再判）。
   * 3. **`res` 缺失时只 reject**（降级分支）：全仓没有 `uncaughtException` /
   *    `unhandledRejection` 全局兜底 ⇒ 对 `undefined` 调 `sendJson` 会 `TypeError`
   *    ⇒ Electron 主进程直接退出。
   *
   * **禁止**「先 `arrayBuffer()` 再判大小」—— 那已经吃掉内存；ROADMAP 判据 5 的判据
   * 对象是「**不无上限读入内存**」。内存上界**如实**为 `maxBytes`（≈32 MiB）：body 最终
   * 要累积成一个 Buffer 交给解压段，这是有界增长，**不得**声称「零堆增长」。
   *
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} [res] - 响应对象（漏传 ⇒ 只 reject，不答响应）
   * @param {{maxBytes?: number}} [options] - `maxBytes` 缺省取 `MAX_SKILL_PACKAGE_BYTES`
   * @returns {Promise<Buffer>} 原始 body 字节
   */
  function readRawBody(req, res, { maxBytes = MAX_SKILL_PACKAGE_BYTES } = {}) {
    // 能力探测：`res` 的存在性与 `writeHead` 的能力**两个原始条件都要判**
    const canRespond = !!(res && typeof res.writeHead === 'function');
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      let rejected = false;
      const tooLarge = () => {
        rejected = true;
        if (canRespond) {
          sendJson(res, 413, { error: '请求体超过上限（' + maxBytes + ' 字节）', limit: maxBytes });
          req.resume(); // 停止累积、把剩余流排空（内存 O(1) 且 413 可达）
        }
      };
      // 快路径：`Content-Length` 预检（零字节读取即拒）。
      // ⚠️ 该头可伪造 / 可缺失 ⇒ 只作加速，**不得**取代下面的累积中判（那才是唯一判据）。
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        tooLarge();
        reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
        return;
      }
      req.on('data', (chunk) => {
        if (rejected) return; // 停止累积（关键：不再 push，堆不随 body 线性增长）
        size += chunk.length;
        if (size > maxBytes) {
          tooLarge();
          reject(Object.assign(new Error('请求体超过上限'), { code: 'BODY_TOO_LARGE', limit: maxBytes }));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (rejected) return;
        resolve(Buffer.concat(chunks));
      });
      req.on('error', reject);
    });
  }

  /**
   * 处理 /api/history/* 历史记录 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleHistoryApi(req, res, reqUrl) {
    // token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改历史
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/history/', '');

      if (route === 'list' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId') || '';
        const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
        const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
        sendJson(res, 200, historyManager.listRecords(containerId, { offset, limit }));
        return;
      }

      if (route === 'search' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId') || '';
        const keyword = reqUrl.searchParams.get('keyword') || '';
        const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
        const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
        sendJson(res, 200, historyManager.searchRecords(containerId, { keyword, offset, limit }));
        return;
      }

      if (route === 'delete' && req.method === 'POST') {
        const { containerId, id } = await readJsonBody(req, res);
        sendJson(res, 200, historyManager.deleteRecord(containerId, id));
        return;
      }

      if (route === 'delete-batch' && req.method === 'POST') {
        const { containerId, ids } = await readJsonBody(req, res);
        sendJson(res, 200, historyManager.deleteRecords(containerId, ids));
        return;
      }

      if (route === 'clear' && req.method === 'POST') {
        const { containerId } = await readJsonBody(req, res);
        sendJson(res, 200, historyManager.clearRecords(containerId));
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 历史 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  // 书签导入共享状态（HTTP API 与 IPC 共用）：取消控制器 + 进度快照
  // 进度由 favoritesManager 的 onProgress 回调更新，前端轮询获取
  let currentImportAbortController = null;
  let currentImportProgress = null;

  /**
   * 处理 /api/favorites/* 收藏夹 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  /** 收藏栏数据变更后，向所有渲染进程广播刷新事件 */
  function _notifyBookmarksBarRefresh() {
    windowManager.broadcast('bookmarks-bar:refresh');
  }

  async function handleFavoritesApi(req, res, reqUrl) {
    // token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改收藏
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/favorites/', '');

      if (route === 'list' && req.method === 'GET') {
        const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
        const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
        const folderIdParam = reqUrl.searchParams.get('folder_id');
        const folderId = folderIdParam !== null ? parseInt(folderIdParam, 10) : undefined;
        sendJson(res, 200, favoritesManager.listRecords({ offset, limit, folderId }));
        return;
      }

      if (route === 'search' && req.method === 'GET') {
        const keyword = reqUrl.searchParams.get('keyword') || '';
        const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
        const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
        sendJson(res, 200, favoritesManager.searchRecords({ keyword, offset, limit }));
        return;
      }

      if (route === 'check' && req.method === 'GET') {
        const url = reqUrl.searchParams.get('url') || '';
        sendJson(res, 200, favoritesManager.checkUrl(url));
        return;
      }

      if (route === 'add' && req.method === 'POST') {
        const { url, title, faviconUrl: rawFaviconUrl } = await readJsonBody(req, res);
        // 远程 favicon URL 统一经 favicon-fetcher 转 data URL（与 IPC favorites:add 同一实现）；
        // 抓取失败得 '' 以空图标入库，之后访问时回写补齐
        const faviconUrl = rawFaviconUrl
          ? await faviconFetcher.fetchAsDataUrl(rawFaviconUrl)
          : '';
        const result = favoritesManager.addRecord({ url, title, faviconUrl });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update' && req.method === 'POST') {
        const { id, title } = await readJsonBody(req, res);
        const result = favoritesManager.updateRecord(id, { title });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete' && req.method === 'POST') {
        const { id } = await readJsonBody(req, res);
        const result = favoritesManager.deleteRecord(id);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete-batch' && req.method === 'POST') {
        const { ids } = await readJsonBody(req, res);
        const result = favoritesManager.deleteRecords(ids);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      // ==================== 收藏夹文件夹 API ====================

      if (route === 'create-folder' && req.method === 'POST') {
        const { name, parentId } = await readJsonBody(req, res);
        const result = favoritesManager.createFolder({ name, parentId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'rename-folder' && req.method === 'POST') {
        const { id, name } = await readJsonBody(req, res);
        const result = favoritesManager.renameFolder(id, { name });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete-folder' && req.method === 'POST') {
        const { id } = await readJsonBody(req, res);
        const result = favoritesManager.deleteFolder(id);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'list-folders' && req.method === 'GET') {
        const parentId = parseInt(reqUrl.searchParams.get('parentId'), 10) || 0;
        sendJson(res, 200, favoritesManager.listFolders(parentId));
        return;
      }

      if (route === 'folder-tree' && req.method === 'GET') {
        sendJson(res, 200, favoritesManager.getFolderTree());
        return;
      }

      if (route === 'move-folder' && req.method === 'POST') {
        const { id, parentId } = await readJsonBody(req, res);
        const result = favoritesManager.moveFolder(id, { parentId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'move-favorite' && req.method === 'POST') {
        const { id, folderId } = await readJsonBody(req, res);
        const result = favoritesManager.moveFavorite(id, { folderId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'move-favorites' && req.method === 'POST') {
        const { ids, folderId } = await readJsonBody(req, res);
        const result = favoritesManager.moveFavorites(ids, { folderId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update-folder-sort' && req.method === 'POST') {
        const { id, sortOrder } = await readJsonBody(req, res);
        const result = favoritesManager.updateFolderSort(id, { sortOrder });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update-favorite-sort' && req.method === 'POST') {
        const { id, sortOrder } = await readJsonBody(req, res);
        const result = favoritesManager.updateFavoriteSort(id, { sortOrder });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'compute-sort-keys' && req.method === 'POST') {
        const { beforeKey, afterKey, count } = await readJsonBody(req, res);
        const { generateNKeysBetween } = require('./vendor/fractional-indexing');
        const keys = generateNKeysBetween(beforeKey, afterKey, count);
        sendJson(res, 200, { keys });
        return;
      }

      if (route === 'update-batch-sort' && req.method === 'POST') {
        const { items } = await readJsonBody(req, res);
        const result = favoritesManager.batchUpdateSort(items);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update-batch-folder-sort' && req.method === 'POST') {
        const { folders } = await readJsonBody(req, res);
        const result = favoritesManager.batchUpdateFolderSort(folders);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      // ==================== 书签导入 API ====================

      // 检测 Chrome 默认书签路径（per D-03）
      if (route === 'detect-chrome-path' && req.method === 'GET') {
        sendJson(res, 200, { path: favoritesManager.detectChromeBookmarksPath() });
        return;
      }

      // Chrome JSON 导入：body { filePath } 或 { content }
      // ⚠️ body 是用户书签文件**全文** ⇒ 显式放大上限（否则 1 MiB 默认会打断既有功能）
      if (route === 'import-chrome' && req.method === 'POST') {
        const { filePath, content } = await readJsonBody(req, res, { maxBytes: MAX_JSON_BODY_BYTES_LARGE });
        currentImportAbortController = new AbortController();
        currentImportProgress = { progress: 0, imported: 0, total: 0, current: '' };
        try {
          const result = await favoritesManager.importChromeBookmarks(
            content ? { content } : { filePath },
            (data) => { currentImportProgress = data; },
            currentImportAbortController.signal
          );
          _notifyBookmarksBarRefresh();
          sendJson(res, 200, result);
        } finally {
          currentImportAbortController = null;
          currentImportProgress = null;
        }
        return;
      }

      // HTML 书签导入：body { filePath | content, mode: 'preview' | 'import' }
      // ⚠️ body 同上（同一条链路，预览与执行各发一次）⇒ 显式放大上限
      if (route === 'import-html' && req.method === 'POST') {
        const { filePath, content, mode } = await readJsonBody(req, res, { maxBytes: MAX_JSON_BODY_BYTES_LARGE });

        // 预览模式：只解析不写库（per D-11, D-12）
        if (mode === 'preview') {
          const result = await favoritesManager.importHtmlBookmarks(
            content ? { content } : { filePath }, null, null, { dryRun: true }
          );
          sendJson(res, 200, result);
          return;
        }

        currentImportAbortController = new AbortController();
        currentImportProgress = { progress: 0, imported: 0, total: 0, current: '' };
        try {
          const result = await favoritesManager.importHtmlBookmarks(
            content ? { content } : { filePath },
            (data) => { currentImportProgress = data; },
            currentImportAbortController.signal
          );
          _notifyBookmarksBarRefresh();
          sendJson(res, 200, result);
        } finally {
          currentImportAbortController = null;
          currentImportProgress = null;
        }
        return;
      }

      // 导入进度轮询（webview 无法接收 IPC 事件，改为前端轮询）
      if (route === 'import-progress' && req.method === 'GET') {
        sendJson(res, 200, currentImportProgress || { progress: 0, imported: 0, total: 0, current: '' });
        return;
      }

      // 取消导入（per IMPORT-03）
      if (route === 'import-abort' && req.method === 'POST') {
        if (currentImportAbortController) {
          currentImportAbortController.abort();
          sendJson(res, 200, { success: true });
        } else {
          sendJson(res, 200, { success: false, message: '没有正在进行的导入操作' });
        }
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 收藏 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  // ---- favicon 代理（/api/frequent-sites/favicon）----
  // Google favicon 服务对无图标域名返回 404 + 默认地球 PNG（响应带有效图片体，
  // 前端 <img> 不触发 onerror，无法自行降级），因此由服务端识别并统一回退为应用图标。
  const KNOWN_GOOGLE_FALLBACK_MD5 = new Set([
    'b8a0bf372c762e966cc99ede8682bc71', // sz=48 默认地球占位图
  ]);
  const faviconCache = new Map(); // domain -> { buffer, contentType }
  let realmIconBuffer = null;
  try {
    realmIconBuffer = fs.readFileSync(path.join(__dirname, 'icons', APP_ICON_FILE));
  } catch (err) {
    console.error('[Realm] 应用图标读取失败:', err.message);
  }

  /**
   * 拉取指定域名的 favicon；无图标或拉取失败时回退为应用图标（带内存缓存）
   * @param {string} domain - 目标域名
   * @returns {Promise<{buffer: Buffer|null, contentType: string}>}
   */
  async function resolveFavicon(domain) {
    if (faviconCache.has(domain)) {
      return faviconCache.get(domain);
    }

    let result = { buffer: realmIconBuffer, contentType: 'image/png' };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=48`,
        { signal: controller.signal, redirect: 'follow' }
      );
      clearTimeout(timer);

      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        const md5 = crypto.createHash('md5').update(buffer).digest('hex');
        if (!KNOWN_GOOGLE_FALLBACK_MD5.has(md5)) {
          result = {
            buffer,
            contentType: resp.headers.get('content-type') || 'image/png',
          };
        }
      }
    } catch (err) {
      console.warn(`[Realm] favicon 拉取失败 (${domain}):`, err.message);
    }

    faviconCache.set(domain, result);
    return result;
  }

  /**
   * 处理 /api/frequent-sites/* 常用网站 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleFrequentSitesApi(req, res, reqUrl) {
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/frequent-sites/', '');

      if (route === 'list' && req.method === 'GET') {
        const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 12;
        sendJson(res, 200, frequentSitesManager.getFrequentSites(limit));
        return;
      }

      if (route === 'favicon' && req.method === 'GET') {
        const domain = reqUrl.searchParams.get('domain') || '';
        // 域名格式校验，防 SSRF 滥用
        if (!/^[a-z0-9][a-z0-9.-]{0,253}$/i.test(domain)) {
          sendJson(res, 400, { error: 'Invalid domain' });
          return;
        }
        const { buffer, contentType } = await resolveFavicon(domain);
        if (!buffer) {
          sendJson(res, 404, { error: 'Not Found' });
          return;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=86400',
        });
        res.end(buffer);
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 常用网站 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/settings/* 设置 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleSettingsApi(req, res, reqUrl) {
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/settings/', '');

      if (route === 'get' && req.method === 'GET') {
        const settings = configStore.get('settings', {
          historyRetentionDays: 30,
          defaultContainer: 'last-used',
          isDefaultBrowser: false,
          restoreTabsOnLaunch: 'ask',
          theme: 'light',
        });
        // 合并收藏栏显示状态：优先读取 settings.bookmarksBar.visible（设置页面写入），
        // 不存在时回退到根路径 bookmarksBar.visible（主进程早期代码写入）
        const fromSettings = configStore.get('settings.bookmarksBar.visible');
        settings.bookmarksBar = {
          visible: fromSettings !== undefined ? fromSettings : configStore.get('bookmarksBar.visible', true),
        };
        // 多媒体播放器设置默认值（per D-03）
        if (!settings.mediaPlayer) {
          settings.mediaPlayer = { enabled: false, whitelist: [] };
        }
        // AI Bash 命令白名单默认值（settings-page AI 分区消费）
        if (!Array.isArray(settings.aiBashWhitelist)) {
          settings.aiBashWhitelist = [];
        }
        sendJson(res, 200, settings);
        return;
      }

      if (route === 'update' && req.method === 'POST') {
        const updates = await readJsonBody(req, res);
        // 安全策略键服务端双保险校验（Pitfall 8：不能只依赖设置页前端校验）
        for (const [key, value] of Object.entries(updates)) {
          if (key === 'aiBashWhitelist') {
            const check = bashPolicy.validateWhitelistList(value);
            if (!check.valid) {
              sendJson(res, 400, { error: check.reason });
              return;
            }
          }
          // 缓存上限服务端校验（T-44-09：1-1024 整数，非法拒绝）
          if (key === 'cacheMaxGB') {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 1 || n > 1024) {
              sendJson(res, 400, { error: '缓存上限必须为 1-1024 的整数' });
              return;
            }
          }
          // 技能禁用名单服务端校验（Phase 50 D-10 / T-50-11）—— **两种键形态都覆盖**。
          // 只覆盖点号键是不够的：手改 URL 提交 `{ "aiSkills": { "disabled": [...] } }`
          // 时 `key === 'aiSkills'`，会落到循环尾的
          // `configStore.set('settings.aiSkills', value)` **整体覆写**，顺带绕过校验。
          //
          // 两种形态共用**同一份**判据 `aiSkillsManager.validateDisabledListForSettings`：
          // 该模块零 electron 依赖，主进程直接 require；**不得**在此另写第二份正则
          // （第二份必然与另两处消费点漂移 ⇒ 「列表里有、开关点了 400」）。
          //
          // `aiSkills` 形态的落盘口径**明确写死为「只落 `disabled` 子键 + 缺该子键即拒绝」**：
          // - 拒绝（而不是放行）的理由：该形态的默认语义是**整体覆写** `settings.aiSkills`，
          //   放行会静默冲掉其上的其它字段（未来新增字段一律无声丢失）；
          // - 落 `disabled` 子键（而不是整体覆写）的理由：整体覆写正是本校验要堵的那件事。
          if (key === 'aiSkills.disabled' || key === 'aiSkills') {
            // 取值路径由键形态决定：点号键 ⇒ `value` 本体就是名单；短键 ⇒ `value` 是子对象、
            // 取 `disabled` 子键。用 `!key.includes('.')` 判别（而不是再写一遍 `key === 'aiSkills'`）
            // 是为了让**两种键形态在源码里各只出现一次** —— 少一处重复就少一个「判据被别处
            // 的字面量假绿」的面（计划自带门禁按 `key === '<键>'` 判两种形态是否被覆盖）。
            const isSubKeyForm = !key.includes('.');
            const list = isSubKeyForm && value ? value.disabled : value;
            const check = aiSkillsManager.validateDisabledListForSettings(list);
            if (!check.valid) {
              // **必须在 configStore.set 之前 return** —— 否则就是「校验失败但仍落盘」
              sendJson(res, 400, { error: check.reason });
              return;
            }
            configStore.set('settings.aiSkills.disabled', list);
            continue;
          }
          configStore.set(`settings.${key}`, value);
        }
        // 设置页在 webview 内通过 HTTP 写入，主进程需主动通知所有窗口 renderer 刷新（closing UAT gap G-29-6）
        const changedKeys = Object.keys(updates);
        windowManager.broadcast('settings:updated', changedKeys);
        // 缓存上限即改即存：经 setCapacityBytes 更新运行中 manager 容量（CR-02）——
        // 改小容量立即触发一轮 FIFO 淘汰（旧实现直改 capacityBytes 字段只在字段上生效，
        // evictIfNeeded 唯一可达点在 ENOSPC 分支，改小上限从不收敛）
        if (changedKeys.includes('cacheMaxGB') && mediaCache) {
          const gb = Number(updates.cacheMaxGB);
          if (Number.isInteger(gb) && gb >= 1 && gb <= 1024) {
            mediaCache.setCapacityBytes(gb * 1024 * 1024 * 1024);
          }
        }
        // 同步主题到 nativeTheme（影响 DevTools 主题）
        if (changedKeys.includes('theme')) {
          const theme = updates.theme;
          if (theme === 'system') {
            nativeTheme.themeSource = 'system';
          } else if (theme === 'dark') {
            nativeTheme.themeSource = 'dark';
          } else {
            nativeTheme.themeSource = 'light';
          }
        }
        sendJson(res, 200, { success: true });
        return;
      }

      if (route === 'is-default-browser' && req.method === 'GET') {
        // 默认浏览器 = http/https 协议的系统默认处理器
        const isDefault = app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
        sendJson(res, 200, { isDefault });
        return;
      }

      // POST /api/settings/choose-cache-dir — 弹目录选择框并写入 settings.cacheDir
      // （Phase 44 D-05/T-44-08：缓存目录仅经 dialog 选取不手输；设置页运行在
      // webview guest 内无 realmAPI，经 token 鉴权的 HTTP 端点触发主进程 dialog）
      if (route === 'choose-cache-dir' && req.method === 'POST') {
        try {
          const result = await dialog.showOpenDialog({
            title: '选择媒体缓存目录',
            properties: ['openDirectory', 'createDirectory'],
            defaultPath: configStore.get('settings.cacheDir', path.join(app.getPath('userData'), 'media-cache')),
          });
          if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
            sendJson(res, 200, { success: true, path: null });
            return;
          }
          const dir = result.filePaths[0];
          configStore.set('settings.cacheDir', dir);
          rebuildMediaCache();
          sendJson(res, 200, { success: true, path: dir });
        } catch (err) {
          console.error('[Realm] 选择缓存目录失败:', err.message);
          sendJson(res, 500, { success: false, error: err.message });
        }
        return;
      }

      if (route === 'version' && req.method === 'GET') {
        sendJson(res, 200, { version: app.getVersion() });
        return;
      }

      if (route === 'icon' && req.method === 'GET') {
        const iconPath = path.join(__dirname, 'icons', APP_ICON_FILE);
        fs.readFile(iconPath, (err, data) => {
          if (err) {
            sendJson(res, 404, { error: 'Icon not found' });
            return;
          }
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(data);
        });
        return;
      }

      if (route === 'set-default-browser' && req.method === 'POST') {
        // 注册 http/https 会触发 macOS 系统确认弹框（用户确认后才真正生效）；
        // 确认前 setAsDefaultProtocolClient 的同步返回值为 false，不能作为失败依据，
        // 真实结果由前端稍后查询 is-default-browser 判定
        const httpOk = app.setAsDefaultProtocolClient('http');
        const httpsOk = app.setAsDefaultProtocolClient('https');
        console.log('[Realm] setAsDefaultProtocolClient:', { httpOk, httpsOk });
        sendJson(res, 200, { success: true });
        return;
      }

      if (route === 'open-url' && req.method === 'POST') {
        const { url } = await readJsonBody(req, res);
        if (url) {
          const { shell } = require('electron');
          await shell.openExternal(url);
          sendJson(res, 200, { success: true });
        } else {
          sendJson(res, 400, { error: 'URL is required' });
        }
        return;
      }

      // ==================== 开发者模式 API ====================

      if (route === 'get-devmode' && req.method === 'GET') {
        sendJson(res, 200, {
          enabled: cdpManager.isEnabled(),
          domains: cdpManager.getDomains(),
          retentionDays: cdpManager.getRetentionDays(),
        });
        return;
      }

      if (route === 'set-devmode' && req.method === 'POST') {
        const { enabled } = await readJsonBody(req, res);
        cdpManager.setEnabled(!!enabled);
        sendJson(res, 200, { success: true });
        return;
      }

      if (route === 'add-devdomain' && req.method === 'POST') {
        const { domain } = await readJsonBody(req, res);
        const result = cdpManager.addDomain(domain);
        sendJson(res, result.success ? 200 : 400, result);
        return;
      }

      if (route === 'remove-devdomain' && req.method === 'POST') {
        const { domain } = await readJsonBody(req, res);
        const result = cdpManager.removeDomain(domain);
        sendJson(res, result.success ? 200 : 400, result);
        return;
      }

      if (route === 'set-dev-retention' && req.method === 'POST') {
        const { days } = await readJsonBody(req, res);
        cdpManager.setRetentionDays(days);
        sendJson(res, 200, { success: true });
        return;
      }

      if (route === 'devqueue-stats' && req.method === 'GET') {
        sendJson(res, 200, cdpManager.getQueueStats());
        return;
      }

      // ==================== AI 助手 API ====================

      if (route === 'ai/state' && req.method === 'GET') {
        if (!aiManager) {
          sendJson(res, 200, { initialized: false, model: null, toolsCount: 0 });
          return;
        }
        sendJson(res, 200, aiManager.getState());
        return;
      }

      // DEPRECATED: ai/models 与 ai/providers 返回相同数据，保留仅为向后兼容
      // 新代码应使用 GET /api/ai/providers
      if (route === 'ai/models' && req.method === 'GET') {
        if (!aiManager) {
          sendJson(res, 200, { providers: [], activeProvider: null, activeModel: null });
          return;
        }
        sendJson(res, 200, await aiManager.getAvailableModels());
        return;
      }

      if (route === 'ai/configure' && req.method === 'POST') {
        const config = await readJsonBody(req, res);
        if (!config || !config.provider || !config.apiKey) {
          sendJson(res, 400, { error: '提供商和 API Key 不能为空' });
          return;
        }
        if (aiManager) {
          await aiManager.configureProviders({
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
          });
        }
        sendJson(res, 200, { success: true });
        return;
      }

      // ==================== 供应商管理 API ====================

      // GET /api/ai/vision-model — 读取视觉专用模型配置（含有效性）
      if (route === 'ai/vision-model' && req.method === 'GET') {
        if (!aiManager) {
          sendJson(res, 200, { visionModel: null, resolved: false });
          return;
        }
        sendJson(res, 200, aiManager.getVisionModel());
        return;
      }

      // POST /api/ai/vision-model — 设置视觉专用模型（{provider,model}；{provider:null} 清除）
      if (route === 'ai/vision-model' && req.method === 'POST') {
        if (!aiManager) {
          sendJson(res, 500, { error: 'AI Manager 未初始化' });
          return;
        }
        const config = await readJsonBody(req, res);
        await aiManager.setVisionModel(config);
        sendJson(res, 200, { success: true });
        return;
      }

      // GET /api/ai/providers — 获取已配置供应商列表（含 envVarName、isBuiltin）
      if (route === 'ai/providers' && req.method === 'GET') {
        if (!aiManager) {
          sendJson(res, 200, { providers: [], activeProvider: null, activeModel: null });
          return;
        }
        sendJson(res, 200, await aiManager.getAvailableModels());
        return;
      }

      // POST /api/ai/providers — 保存供应商配置
      if (route === 'ai/providers' && req.method === 'POST') {
        const config = await readJsonBody(req, res);
        if (!config || !config.provider) {
          sendJson(res, 400, { error: '提供商不能为空' });
          return;
        }
        if (aiManager) {
          await aiManager.configureProviders(config);
        }
        sendJson(res, 200, { success: true });
        return;
      }

      // DELETE /api/ai/providers/:id — 删除供应商
      if (route.startsWith('ai/providers/') && req.method === 'DELETE') {
        const parts = route.split('/');
        const providerId = parts[2];
        if (!providerId) {
          sendJson(res, 400, { error: '供应商 ID 不能为空' });
          return;
        }
        if (aiManager) {
          await aiManager.removeProvider(providerId);
        }
        sendJson(res, 200, { success: true });
        return;
      }

      // POST /api/ai/providers/:id/detect-models — 检测模型列表
      if (route.match(/^ai\/providers\/[^/]+\/detect-models$/) && req.method === 'POST') {
        const parts = route.split('/');
        const providerId = parts[2];
        const body = await readJsonBody(req, res);
        let apiKey = body && body.apiKey;
        const baseURL = body && body.baseURL;
        const envVarName = body && body.envVarName;

        // 如果请求中没有 apiKey，尝试从环境变量检测（优先用户自定义变量名）
        if (!apiKey && aiManager) {
          const envResult = aiManager.detectEnvVar(providerId, envVarName || undefined);
          if (envResult && envResult.found) {
            apiKey = envResult.value;
          }
        }

        if (!apiKey) {
          sendJson(res, 400, { error: 'API Key 不能为空，请在输入框填写或设置环境变量' });
          return;
        }
        if (!aiManager) {
          sendJson(res, 500, { error: 'AI Manager 未初始化' });
          return;
        }
        const result = await aiManager.detectModels(providerId, apiKey, baseURL);
        sendJson(res, 200, result);
        return;
      }

      // GET /api/ai/providers/:id/env-var — 检测环境变量
      // 注意：不返回 value（API Key 原值），仅返回 found/name，避免泄露到渲染进程
      if (route.match(/^ai\/providers\/[^/]+\/env-var$/) && req.method === 'GET') {
        const parts = route.split('/');
        const providerId = parts[2];
        const customName = reqUrl.searchParams.get('customName');
        if (!aiManager) {
          sendJson(res, 200, { found: false, name: null });
          return;
        }
        const result = aiManager.detectEnvVar(providerId, customName);
        sendJson(res, 200, { found: result.found, name: result.name });
        return;
      }

      // GET /api/ai/providers/:id/api-key — 获取已保存的完整 API Key
      // 用于设置页显隐切换查看（输入框回显），按需获取而非随列表返回
      if (route.match(/^ai\/providers\/[^/]+\/api-key$/) && req.method === 'GET') {
        const parts = route.split('/');
        const providerId = parts[2];
        if (!aiManager) {
          sendJson(res, 200, { apiKey: null });
          return;
        }
        sendJson(res, 200, { apiKey: aiManager.getProviderApiKey(providerId) });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 设置 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/search-config/* 搜索配置 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleSearchConfigApi(req, res, reqUrl) {
    // token 鉴权（与 handleSettingsApi 一致）
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/search-config/', '');

      // GET /api/search-config/get
      if (route === 'get' && req.method === 'GET') {
        sendJson(res, 200, {
          provider: configStore.get('search.provider', 'auto'),
          apiKeys: maskApiKeys(configStore.get('search.apiKeys', {})),
          envVarNames: configStore.get('search.envVarNames', {}),
        });
        return;
      }

      // POST /api/search-config/set
      if (route === 'set' && req.method === 'POST') {
        const updates = await readJsonBody(req, res);
        // 校验 provider 为已知字符串
        const VALID_PROVIDERS = ['auto', 'tavily', 'brave', 'serper', 'anysearch', 'anysearch_free'];
        if (updates.provider) {
          if (typeof updates.provider !== 'string' || !VALID_PROVIDERS.includes(updates.provider)) {
            sendJson(res, 400, { error: '无效的搜索 Provider' });
            return;
          }
          configStore.set('search.provider', updates.provider);
        }
        // 校验 apiKeys 为对象且值为字符串
        if (updates.apiKeys) {
          if (typeof updates.apiKeys !== 'object' || Array.isArray(updates.apiKeys)) {
            sendJson(res, 400, { error: '无效的 apiKeys 格式' });
            return;
          }
          for (const [k, v] of Object.entries(updates.apiKeys)) {
            if (typeof k !== 'string' || typeof v !== 'string') {
              sendJson(res, 400, { error: 'apiKeys 键值必须为字符串' });
              return;
            }
          }
          configStore.set('search.apiKeys', updates.apiKeys);
        }
        // 校验 envVarNames 为对象且值为字符串
        if (updates.envVarNames) {
          if (typeof updates.envVarNames !== 'object' || Array.isArray(updates.envVarNames)) {
            sendJson(res, 400, { error: '无效的 envVarNames 格式' });
            return;
          }
          for (const [k, v] of Object.entries(updates.envVarNames)) {
            if (typeof k !== 'string' || typeof v !== 'string') {
              sendJson(res, 400, { error: 'envVarNames 键值必须为字符串' });
              return;
            }
          }
          configStore.set('search.envVarNames', updates.envVarNames);
        }
        sendJson(res, 200, { success: true });
        return;
      }

      // POST /api/search-config/verify-key
      if (route === 'verify-key' && req.method === 'POST') {
        const { provider, apiKey } = await readJsonBody(req, res);

        // 如果 apiKey 为空，检查环境变量
        let keyToVerify = apiKey;
        if (!keyToVerify || !keyToVerify.trim()) {
          const envVarNames = configStore.get('search.envVarNames', {});
          const envName = envVarNames[provider] || searchManager.SEARCH_PROVIDER_ENV_VARS[provider];
          if (envName) {
            keyToVerify = process.env[envName] || '';
          }
        }

        if (!keyToVerify) {
          sendJson(res, 200, { valid: false, error: '请输入 API Key 或配置环境变量' });
          return;
        }

        // 临时写入单个 provider key（不影响其他 provider），验证完恢复（D-15: 验证不删除）
        const origKey = configStore.get(`search.apiKeys.${provider}`);
        configStore.set(`search.apiKeys.${provider}`, keyToVerify);
        // 临时切换到指定 Provider（避免 auto 模式回退到免费 Provider）
        const origProvider = configStore.get('search.provider');
        configStore.set('search.provider', provider);
        try {
          const result = await searchManager.doSearch('test', 1);
          sendJson(res, 200, { valid: true, provider: result.provider });
        } catch (err) {
          sendJson(res, 200, { valid: false, error: err.message });
        } finally {
          // 恢复原始 provider 设置
          configStore.set('search.provider', origProvider);
          // 只恢复单个 provider key，而非整个 apiKeys 对象
          if (origKey !== undefined) {
            configStore.set(`search.apiKeys.${provider}`, origKey);
          } else {
            const keys = configStore.get('search.apiKeys', {});
            delete keys[provider];
            configStore.set('search.apiKeys', keys);
          }
        }
        return;
      }

      // GET /api/search-config/env-var — 检测环境变量
      if (route === 'env-var' && req.method === 'GET') {
        const provider = reqUrl.searchParams.get('provider');
        const customName = reqUrl.searchParams.get('customName');
        if (!provider) {
          sendJson(res, 400, { error: '缺少 provider 参数' });
          return;
        }
        const result = searchManager.detectEnvVar(provider, customName);
        sendJson(res, 200, { found: result.found, name: result.name });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('[Realm] 搜索配置 API 错误:', err);
      sendJson(res, 500, { error: err.message });
    }
  }

  /**
   * 遮蔽 API Key 显示（返回时隐藏完整 Key）
   * Key 长度 > 8 时显示前 4 后 4 中间 ****，否则原样返回
   * @param {Object} apiKeys - { provider: apiKey }
   * @returns {Object} 遮蔽后的 API Keys
   */
  function maskApiKeys(apiKeys) {
    const masked = {};
    for (const [key, value] of Object.entries(apiKeys || {})) {
      if (value && typeof value === 'string' && value.length > 8) {
        masked[key] = value.slice(0, 4) + '****' + value.slice(-4);
      } else {
        masked[key] = value || '';
      }
    }
    return masked;
  }

  /**
   * 处理 /api/devrequests/* 开发者模式请求数据 API
   *
   * 提供分页查询、域名列表、统计、删除和清空功能。
   * 所有请求需要 token 鉴权，containerId 需通过白名单验证。
   *
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleDevRequestsApi(req, res, reqUrl) {
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/devrequests/', '');

      // GET /api/devrequests/list — 分页查询请求记录
      if (route === 'list' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId') || 'default';
        const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
        const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
        const method = reqUrl.searchParams.get('method') || '';
        const domain = reqUrl.searchParams.get('domain') || '';
        const search = reqUrl.searchParams.get('search') || '';
        const pageRequestId = reqUrl.searchParams.get('pageRequestId') || '';
        const resourceType = reqUrl.searchParams.get('resourceType') || '';

        const result = devRequestsWriter.queryRecords(containerId, {
          offset,
          limit,
          url: search || undefined,
          method: method || undefined,
          pageRequestId: pageRequestId || undefined,
          resourceType: resourceType || undefined,
        });

        // 按域名过滤（queryRecords 不直接支持域名过滤，在此层过滤）
        if (domain && result.records.length > 0) {
          result.records = result.records.filter(record => {
            try {
              const hostname = new URL(record.url).hostname;
              return hostname === domain;
            } catch {
              return false;
            }
          });
        }

        sendJson(res, 200, {
          records: result.records,
          total: result.total,
          offset,
          limit,
        });
        return;
      }

      // GET /api/devrequests/domains — 获取已抓取的域名列表
      if (route === 'domains' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId') || 'default';
        const domains = devRequestsWriter.queryDomains(containerId);
        sendJson(res, 200, domains);
        return;
      }

      // GET /api/devrequests/stats — 获取统计信息
      if (route === 'stats' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId') || 'default';
        const stats = devRequestsWriter.queryStats(containerId);
        sendJson(res, 200, stats);
        return;
      }

      // GET /api/devrequests/detail?id=N&containerId=X — 获取单条记录完整字段
      if (route === 'detail' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId') || 'default';
        const id = parseInt(reqUrl.searchParams.get('id'), 10);
        if (!Number.isInteger(id) || id <= 0) {
          sendJson(res, 400, { error: 'Invalid id' });
          return;
        }
        const record = devRequestsWriter.getRecordById(containerId, id);
        if (!record) {
          sendJson(res, 404, { error: 'Not Found' });
          return;
        }
        sendJson(res, 200, record);
        return;
      }

      // POST /api/devrequests/delete — 删除单条记录
      if (route === 'delete' && req.method === 'POST') {
        const { containerId, id } = await readJsonBody(req, res);
        const result = devRequestsWriter.deleteRecord(containerId || 'default', id);
        sendJson(res, 200, result);
        return;
      }

      // POST /api/devrequests/clear — 清空容器的所有记录
      if (route === 'clear' && req.method === 'POST') {
        const { containerId } = await readJsonBody(req, res);
        const result = devRequestsWriter.clearRecords(containerId || 'default');
        sendJson(res, 200, { success: result.success, deletedCount: result.deleted });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] DevRequests API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 验证文件路径是否在用户下载目录内（防路径遍历）
   * @param {string} filePath - 待验证的文件路径
   * @returns {boolean} 路径在下载目录内返回 true
   */
  function isPathInDownloadsDir(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    try {
      const downloadsDir = app.getPath('downloads');
      const resolvedPath = path.resolve(filePath);
      return resolvedPath.startsWith(downloadsDir + path.sep) || resolvedPath === downloadsDir;
    } catch {
      return false;
    }
  }

  /**
   * 处理 /api/downloads/* 下载管理 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleDownloadsApi(req, res, reqUrl) {
    // token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改下载数据
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/downloads/', '');

      // GET /api/downloads/list — 全局查询所有容器的下载记录
      if (route === 'list' && req.method === 'GET') {
        const offset = parseInt(reqUrl.searchParams.get('offset'), 10) || 0;
        const limit = parseInt(reqUrl.searchParams.get('limit'), 10) || 50;
        const keyword = reqUrl.searchParams.get('search') || '';
        const downloads = downloadManager.getAllDownloads(limit, offset, keyword);
        sendJson(res, 200, { success: true, downloads });
        return;
      }

      // POST /api/downloads/delete — 删除单条下载记录
      if (route === 'delete' && req.method === 'POST') {
        const { downloadId, deleteFile } = await readJsonBody(req, res);
        sendJson(res, 200, downloadManager.deleteDownload(downloadId, !!deleteFile));
        return;
      }

      // POST /api/downloads/clear — 清空所有下载历史
      if (route === 'clear' && req.method === 'POST') {
        sendJson(res, 200, downloadManager.clearAllDownloads());
        return;
      }

      // POST /api/downloads/pause — 暂停下载
      if (route === 'pause' && req.method === 'POST') {
        const { downloadId } = await readJsonBody(req, res);
        sendJson(res, 200, { success: downloadManager.pauseDownload(downloadId) });
        return;
      }

      // POST /api/downloads/resume — 恢复下载
      if (route === 'resume' && req.method === 'POST') {
        const { downloadId } = await readJsonBody(req, res);
        sendJson(res, 200, { success: downloadManager.resumeDownload(downloadId) });
        return;
      }

      // POST /api/downloads/cancel — 取消下载
      if (route === 'cancel' && req.method === 'POST') {
        const { downloadId } = await readJsonBody(req, res);
        sendJson(res, 200, { success: downloadManager.cancelDownload(downloadId) });
        return;
      }

      // POST /api/downloads/open — 打开文件
      if (route === 'open' && req.method === 'POST') {
        const { filePath } = await readJsonBody(req, res);
        // 路径安全验证：限制在用户下载目录内（防路径遍历）
        if (!isPathInDownloadsDir(filePath)) {
          sendJson(res, 403, { success: false, error: '路径不在允许范围内' });
          return;
        }
        await downloadManager.openFile(filePath);
        sendJson(res, 200, { success: true });
        return;
      }

      // POST /api/downloads/show-in-folder — Finder 显示
      if (route === 'show-in-folder' && req.method === 'POST') {
        const { filePath } = await readJsonBody(req, res);
        // 路径安全验证：限制在用户下载目录内（防路径遍历）
        if (!isPathInDownloadsDir(filePath)) {
          sendJson(res, 403, { success: false, error: '路径不在允许范围内' });
          return;
        }
        downloadManager.showInFolder(filePath);
        sendJson(res, 200, { success: true });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 下载 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 媒体任务系统通知（Phase 44 D-26，Pitfall 8：通知失败仅告警不阻断状态更新）
   * completed convert「MP4 转换完成：{文件名}」/ completed record「录制已保存」/
   * failed 带 error 原因；点击 shell.showItemInFolder 定位产物。
   * @param {Object} task - 进入终态的任务快照
   */
  function showTaskNotification(task) {
    try {
      if (!Notification.isSupported()) return;
      let title;
      if (task.status === 'completed') {
        title = task.type === 'convert'
          ? `MP4 转换完成：${path.basename(task.outputPath || task.title)}`
          : '录制已保存';
      } else if (task.status === 'failed') {
        title = task.type === 'convert'
          // 44-05：convert 任务 error 统一携带「MP4 转换失败：」前缀（UI-SPEC
          // Copywriting），此处避免重复拼接
          ? (task.error && task.error.startsWith('MP4 转换失败') ? task.error : `MP4 转换失败：${task.error || '未知原因'}`)
          : `录制失败：${task.error || '未知原因'}`;
      } else {
        // interrupted/cancelled 不发系统通知（任务页可见）
        return;
      }
      const notification = new Notification({ title, body: task.title });
      if (task.outputPath) {
        notification.on('click', () => {
          try {
            shell.showItemInFolder(task.outputPath);
          } catch (err) {
            console.warn('[Realm] 通知点击定位产物失败:', err.message);
          }
        });
      }
      notification.show();
    } catch (err) {
      console.warn('[Realm] 媒体任务系统通知发送失败:', err.message);
    }
  }

  /**
   * 媒体任务注册表 persist 包装（Phase 44 D-25/D-26）
   * 1. 写 userData/media-tasks.json（D-18 崩溃重启恢复源）
   * 2. 与上次快照 diff：状态变化的任务广播 media-task:changed；
   *    活跃（running）数变化广播 media-task:count-changed（主窗口角标数据源）
   * 3. 新进入 completed/failed 终态的任务发系统通知
   * @param {Array} tasks - 注册表快照（listTasks() 结果）
   */
  function persistMediaTasks(tasks) {
    // 写盘（D-18 恢复源）
    try {
      fs.writeFileSync(mediaTasksPath, JSON.stringify(tasks, null, 2));
    } catch (err) {
      console.warn('[Realm] 媒体任务持久化失败:', err.message);
    }
    // 状态 diff → 广播 + 系统通知
    const prevStatuses = lastPersistedStatuses;
    lastPersistedStatuses = new Map();
    for (const task of tasks) {
      lastPersistedStatuses.set(task.id, task.status);
      const prev = prevStatuses.get(task.id);
      if (prev && prev !== task.status) {
        windowManager.broadcast('media-task:changed', task);
        if (task.status === 'completed' || task.status === 'failed') {
          showTaskNotification(task);
        }
      }
    }
    // 活跃任务数广播（角标数据源）
    const runningCount = tasks.filter((t) => t.status === 'running').length;
    if (runningCount !== lastRunningCount) {
      lastRunningCount = runningCount;
      windowManager.broadcast('media-task:count-changed', { count: runningCount });
    }
  }

  /**
   * 处理 /api/tasks/* 媒体任务 API 请求
   * 任务页（realm://tasks）数据层；全部端点 token 鉴权（T-44-07）
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleTasksApi(req, res, reqUrl) {
    // token 鉴权：无 token 一律 403，不回任何任务字段（T-44-10）
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/tasks/', '');

      // GET /api/tasks/list — 全量任务快照（updatedAt 降序）
      if (route === 'list' && req.method === 'GET') {
        sendJson(res, 200, { success: true, tasks: mediaTaskManager ? mediaTaskManager.listTasks() : [] });
        return;
      }

      // POST /api/tasks/cancel — 取消任务（任务页「停止」；仅 running 可取消，非法流转 400）
      // CR-04 分派语义：running record/convert 必须真实停止，状态标记只在引擎/转码已停后落定——
      //   record（running）→ recordEngine.stopRecord（与红点停止同原语：停轮询 + 写 meta.json +
      //     completeTask 落 completed，D-22 record→convert 接力随之触发；not_found 且回读仍
      //     running 才 cancelTask 兜底，已终态返回 200 当前态不二次流转）
      //   convert（running）→ convertCancelTokens 触发协作式取消信号（startConvertTask 注册的
      //     shouldCancel 闭包），转码循环检查后以 reason='cancelled' 中止并清理半成品，
      //     终态由 promise 链 .catch 分支落 cancelled（此处只发信号不等转码循环）
      //   status 标记（cancelTask）仅覆盖：非 running 取消（维持 400 非法流转）、引擎已停后兜底、
      //     非 record/convert 类型
      if (route === 'cancel' && req.method === 'POST') {
        const { taskId } = await readJsonBody(req, res);
        if (!mediaTaskManager) {
          sendJson(res, 503, { success: false, error: '任务注册表未初始化' });
          return;
        }
        if (!taskId || typeof taskId !== 'string') {
          sendJson(res, 400, { success: false, error: '缺少 taskId' });
          return;
        }
        try {
          const existing = (mediaTaskManager.listTasks() || []).find((t) => t.id === taskId);
          if (!existing) {
            sendJson(res, 404, { success: false, error: '任务不存在' });
            return;
          }
          if (existing.status !== 'running') {
            // 非 running 取消请求：cancelTask 内部 requireRunning 必抛（非法流转）。
            // WR-B：原实现写了一个 sendJson(200) 分支，但它不可达（cancelTask 抛错后
            // 直接落外层 catch → 400）——显式 400，语义即「已终态任务不可取消」。
            sendJson(res, 400, { success: false, error: `任务当前状态为 ${existing.status}，不可取消` });
            return;
          }
          if (existing.type === 'record') {
            // running record：引擎停止原语（CR-04 核心——任务页「停止」= 真实停录）
            const r = await recordEngine.stopRecord(taskId);
            if (r && r.ok) {
              sendJson(res, 200, { success: true, task: r.task, stopped: 'record-engine' });
              return;
            }
            if (!r || r.reason === 'not_found') {
              // 引擎 active Map 已无此任务（刚被引擎侧自然完成/失败，或并发竞态）：
              // 回读注册表——仍 running 才 cancelTask 兜底防悬挂；已终态返回 200 当前态
              const fresh = (mediaTaskManager.listTasks() || []).find((t) => t.id === taskId);
              if (fresh && fresh.status === 'running') {
                try {
                  const task = mediaTaskManager.cancelTask(taskId, '用户取消');
                  sendJson(res, 200, { success: true, task });
                } catch (err2) {
                  sendJson(res, 400, { success: false, error: err2.message });
                }
              } else {
                sendJson(res, 200, { success: true, task: fresh || existing, note: 'already-stopped' });
              }
              return;
            }
            // 引擎其他错误（completeTask 非法流转等）→ 400
            sendJson(res, 400, { success: false, error: r.reason || '停止录制失败' });
            return;
          }
          if (existing.type === 'convert') {
            // running convert：触发协作式取消信号（转码循环取消检查后异步落 cancelled）
            const stop = convertCancelTokens.get(taskId);
            if (typeof stop === 'function') {
              try {
                stop();
              } catch { /* 信号回调异常忽略——终态仍由 .catch 分支尝试落定 */ }
            }
            sendJson(res, 200, { success: true, task: existing, note: 'stop-signalled' });
            return;
          }
          // 其他类型回落原语义（cancelTask 状态标记）
          const task = mediaTaskManager.cancelTask(taskId, '用户取消');
          sendJson(res, 200, { success: true, task });
        } catch (err) {
          sendJson(res, 400, { success: false, error: err.message });
        }
        return;
      }

      // POST /api/tasks/show-in-folder — Finder 定位产物（仅 completed/interrupted 且产物存在）
      if (route === 'show-in-folder' && req.method === 'POST') {
        const { taskId } = await readJsonBody(req, res);
        const task = (mediaTaskManager ? mediaTaskManager.listTasks() : []).find((t) => t.id === taskId);
        if (!task) {
          sendJson(res, 404, { success: false, error: '任务不存在' });
          return;
        }
        if (task.status !== 'completed' && task.status !== 'interrupted') {
          sendJson(res, 400, { success: false, error: '任务尚无产物可定位' });
          return;
        }
        if (!task.outputPath || !fs.existsSync(task.outputPath)) {
          sendJson(res, 404, { success: false, error: '产物文件不存在' });
          return;
        }
        shell.showItemInFolder(task.outputPath);
        sendJson(res, 200, { success: true });
        return;
      }

      // POST /api/tasks/convert-resume — 已落盘部分续转（44-05 落地 44-03 预留路由）：
      // record 任务的录制目录分片 → startConvertTask（弹框选目录在主进程发起）
      if (route === 'convert-resume' && req.method === 'POST') {
        const { taskId } = await readJsonBody(req, res);
        if (!mediaTaskManager) {
          sendJson(res, 503, { success: false, error: '任务注册表未初始化' });
          return;
        }
        if (!taskId || typeof taskId !== 'string') {
          sendJson(res, 400, { success: false, error: '缺少 taskId' });
          return;
        }
        const task = mediaTaskManager.listTasks().find((t) => t.id === taskId);
        if (!task) {
          sendJson(res, 404, { success: false, error: '任务不存在' });
          return;
        }
        if (task.type !== 'record') {
          sendJson(res, 400, { success: false, error: '仅录制任务支持续转' });
          return;
        }
        if (task.status !== 'interrupted' && task.status !== 'failed' && task.status !== 'completed') {
          sendJson(res, 400, { success: false, error: '任务状态不支持续转' });
          return;
        }
        const r = await startConvertFromRecordTask(task);
        if (!r.ok) {
          // IN-08/WR-C：no_segments 覆盖两种成因——硬崩溃无 meta.json（WR-C 记债，
          // 不动引擎落盘时机）或 meta 存在但未录到有效分片，文案取中性表述
          const noSegText = '该任务没有可转换的分片索引（录制中崩溃或未录到有效分片），暂不支持续转';
          sendJson(res, 400, { success: false, error: r.reason === 'cancelled' ? '已取消转换' : (r.reason === 'encrypted' ? '加密视频暂不支持转换' : (r.reason === 'no_segments' ? noSegText : (r.reason || '续转失败'))) });
          return;
        }
        sendJson(res, 200, { success: true, taskId: r.taskId });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 媒体任务 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/credentials/* 凭据管理 API 请求
   * per AF-04：设置页凭据管理（列表、搜索、删除、批量删除、查看详情）
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleCredentialsApi(req, res, reqUrl) {
    // token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改凭据数据
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/credentials/', '');

      // GET /api/credentials/list — 获取容器的凭据列表（不含密码）
      if (route === 'list' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId');
        if (!containerId) {
          sendJson(res, 400, { error: '缺少 containerId 参数' });
          return;
        }
        const credentials = credentialManager.listCredentials(containerId);
        sendJson(res, 200, { success: true, credentials });
        return;
      }

      // GET /api/credentials/search — 搜索凭据（模糊匹配 origin 和 username）
      if (route === 'search' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId');
        const keyword = reqUrl.searchParams.get('keyword') || '';
        if (!containerId) {
          sendJson(res, 400, { error: '缺少 containerId 参数' });
          return;
        }
        const credentials = keyword
          ? credentialManager.searchCredentials(containerId, keyword)
          : credentialManager.listCredentials(containerId);
        sendJson(res, 200, { success: true, credentials });
        return;
      }

      // POST /api/credentials/delete — 删除单条凭据
      if (route === 'delete' && req.method === 'POST') {
        const { containerId, origin } = await readJsonBody(req, res);
        if (!containerId || !origin) {
          sendJson(res, 400, { error: '缺少必要参数' });
          return;
        }
        const result = credentialManager.deleteCredential(containerId, origin);
        sendJson(res, 200, result);
        return;
      }

      // POST /api/credentials/batch-delete — 批量删除凭据
      if (route === 'batch-delete' && req.method === 'POST') {
        const { containerId, origins } = await readJsonBody(req, res);
        if (!containerId || !Array.isArray(origins)) {
          sendJson(res, 400, { error: '缺少必要参数' });
          return;
        }
        const result = credentialManager.batchDelete(containerId, origins);
        sendJson(res, 200, result);
        return;
      }

      // POST /api/credentials/get-by-id — 获取解密后的凭据详情（展开详情用）
      if (route === 'get-by-id' && req.method === 'POST') {
        const { credentialId } = await readJsonBody(req, res);
        if (!credentialId) {
          sendJson(res, 400, { error: '缺少 credentialId 参数' });
          return;
        }
        const credential = await credentialManager.getCredentialById(credentialId);
        if (!credential) {
          sendJson(res, 404, { success: false, error: '凭据不存在或解密失败' });
          return;
        }
        sendJson(res, 200, { success: true, ...credential });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 凭据 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/address/* 地址管理 API 请求
   * per AF-06, AF-07：设置页地址管理（获取、保存、删除）
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleAddressApi(req, res, reqUrl) {
    // token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改地址数据
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/address/', '');

      // GET /api/address/get — 获取容器的地址
      if (route === 'get' && req.method === 'GET') {
        const containerId = reqUrl.searchParams.get('containerId');
        if (!containerId) {
          sendJson(res, 400, { error: '缺少 containerId 参数' });
          return;
        }
        const address = await addressManager.getAddress(containerId);
        sendJson(res, 200, { success: true, address });
        return;
      }

      // POST /api/address/save — 保存地址
      if (route === 'save' && req.method === 'POST') {
        const { containerId, name, phone, address } = await readJsonBody(req, res);
        if (!containerId || !name || !phone || !address) {
          sendJson(res, 400, { error: '缺少必要参数' });
          return;
        }
        const result = await addressManager.saveAddress(containerId, name, phone, address);
        sendJson(res, 200, result);
        return;
      }

      // POST /api/address/delete — 删除地址
      if (route === 'delete' && req.method === 'POST') {
        const { containerId } = await readJsonBody(req, res);
        if (!containerId) {
          sendJson(res, 400, { error: '缺少 containerId 参数' });
          return;
        }
        const result = addressManager.deleteAddress(containerId);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 地址 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/containers/* 容器 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleContainersApi(req, res, reqUrl) {
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/containers/', '');

      if (route === 'list' && req.method === 'GET') {
        sendJson(res, 200, containerManager.getContainers());
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 容器 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/rules/* 分配规则 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleRulesApi(req, res, reqUrl) {
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/rules/', '');

      if (route === 'list' && req.method === 'GET') {
        sendJson(res, 200, assignmentRules.getRules());
        return;
      }

      if (route === 'create' && req.method === 'POST') {
        const { containerId, pattern } = await readJsonBody(req, res);
        const result = assignmentRules.createRule(containerId, pattern);
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update' && req.method === 'POST') {
        const { ruleId, updates } = await readJsonBody(req, res);
        const result = assignmentRules.updateRule(ruleId, updates);
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete' && req.method === 'POST') {
        const { ruleId } = await readJsonBody(req, res);
        const result = assignmentRules.deleteRule(ruleId);
        sendJson(res, 200, result);
        return;
      }

      if (route === 'reorder' && req.method === 'POST') {
        const { orderedIds } = await readJsonBody(req, res);
        const result = assignmentRules.reorderRules(orderedIds);
        sendJson(res, 200, result);
        return;
      }

      if (route === 'export' && req.method === 'GET') {
        const data = assignmentRules.exportRules();
        sendJson(res, 200, data);
        return;
      }

      if (route === 'import' && req.method === 'POST') {
        const payload = await readJsonBody(req, res);
        const result = assignmentRules.importRules(assignmentRules.normalizeRulesPayload(payload));
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 规则 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/shortcuts/* 快捷键 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleShortcutsApi(req, res, reqUrl) {
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/shortcuts/', '');

      if (route === 'list' && req.method === 'GET') {
        sendJson(res, 200, shortcutManager.getShortcuts());
        return;
      }

      if (route === 'set' && req.method === 'POST') {
        const { action, accelerator } = await readJsonBody(req, res);
        const result = shortcutManager.setShortcut(action, accelerator);
        if (result) {
          shortcutManager.rebuildShortcuts();
        }
        sendJson(res, 200, { success: result });
        return;
      }

      if (route === 'reset' && req.method === 'POST') {
        const { action } = await readJsonBody(req, res);
        const result = shortcutManager.resetShortcut(action);
        if (result) {
          shortcutManager.rebuildShortcuts();
        }
        sendJson(res, 200, { success: result });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 快捷键 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 解析 AI 记忆 scope 白名单（user / global / container:<id>）
   * @param {string} raw - 原始 scope 字符串
   * @returns {string|null} 合法 scope 原样返回；非法返回 null
   */
  function parseAiMemoryScope(raw) {
    if (raw === 'user' || raw === 'global') {
      return raw;
    }
    if (typeof raw === 'string' && raw.startsWith('container:') && raw.length > 'container:'.length) {
      return raw;
    }
    return null;
  }

  /**
   * 处理 /api/ai-memory AI 记忆 API 请求（设置页「AI 记忆」编辑分区数据层）
   *
   * 人工编辑路径（D-11）：写入必须走 writeScope（不做威胁扫描——设置页是用户本人
   * 操作），仅保留字符预算校验作为服务端双保险。budget 从 manager BUDGETS 读取，
   * 本文件不写预算数值字面量。
   *
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleAiMemoryApi(req, res, reqUrl) {
    // token 鉴权：防 CSRF 与 localhost 端口扫描读改 AI 记忆（T-43-07）
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      if (req.method === 'GET') {
        const scope = parseAiMemoryScope(reqUrl.searchParams.get('scope') || '');
        if (!scope) {
          sendJson(res, 400, { error: '非法的记忆 scope（合法值：user / global / container:<id>）' });
          return;
        }
        const content = aiMemoryManager.readScope(scope);
        const target = scope.startsWith('container:') ? 'container' : scope;
        const budget = aiMemoryManager.BUDGETS[target];
        sendJson(res, 200, { content, used: content.length, budget });
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req, res);
        const scope = parseAiMemoryScope(body && body.scope);
        const content = body && body.content;
        if (!scope) {
          sendJson(res, 400, { error: '非法的记忆 scope（合法值：user / global / container:<id>）' });
          return;
        }
        if (typeof content !== 'string' || content.length === 0) {
          sendJson(res, 400, { error: 'content 必须为非空字符串' });
          return;
        }
        // 容器存在性校验：防手改 URL 对已删容器写孤儿记忆文件（T-43-08）
        if (scope.startsWith('container:')) {
          const containerId = scope.slice('container:'.length);
          const exists = containerManager.getContainers().some((c) => c.id === containerId);
          if (!exists) {
            sendJson(res, 400, { error: '容器不存在' });
            return;
          }
        }
        // 人工编辑路径：必须走 writeScope（不经威胁扫描，D-11）；超预算 throw → 统一错误形状
        aiMemoryManager.writeScope(scope, content);
        sendJson(res, 200, { success: true });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] AI 记忆 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/skills/* 技能管理 API 请求（Phase 50 D-15）—— 设置页数据层
   *
   * 首四行逐字照抄 `handleSettingsApi` 的范式：token 鉴权 → `route = pathname.replace(前缀,'')`
   * → 分支 → `sendJson`。分发用 `startsWith` 而非 `===`（要承载多个子路由）。
   *
   * **本 handler 只是转发层**：判定 / 校验 / 写函数全部住 `ai-skills-manager.js`
   * （技能集单一数据权威，零 electron 依赖）—— 在这里加工一份就是第二份实现
   * （49-01 的「写权威与读权威同源」纪律，本阶段沿用）。
   *
   * 设置页是 `realm://` guest、**没有 `realmAPI`** ⇒ 它只能走本端点；主窗口
   * `file://` **不能** fetch 本地 HTTP（Phase 38 事故的 CORS 拦截）⇒ 主窗口走
   * `realmAPI` IPC。两条**不可互换**（D-17）。
   *
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
  async function handleSkillsApi(req, res, reqUrl) {
    // token 鉴权（T-50-01）：无 token / 错 token 必须在任何副作用之前 403
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/skills/', '');

      if (route === 'list' && req.method === 'GET') {
        // AI Manager 尚未就绪（whenReady 早期请求）：返回**空投影**而非 500 ——
        // 设置页据此走「技能列表尚未加载」空态（refreshedAt === 0 的既有语义），
        // 用户看到的仍是可理解的页面而不是一个报错。
        if (!aiManager) {
          sendJson(res, 200, { groups: [], errors: [], refreshedAt: 0, digest: '', limits: {} });
          return;
        }
        // 读路径初始化（D-19）：无 Agent / 未配 provider 时也必须能列出盘上的技能。
        // 恰一次重扫由该方法内部保证（有 Agent 走 syncAgentSystemPrompt，无 Agent 直接 refreshSkills）。
        await aiManager.ensureSkillsFresh();
        // getSkillsForManagement() 是**同步**的（零 IO 的缓存投影），不要 await 它
        sendJson(res, 200, aiManager.getSkillsForManagement());
        return;
      }

      // 启用 / 禁用单个技能（Phase 50 D-05 / USER-02）—— 增量载荷 `{name, disabled}`。
      // 增量而非全量（`{disabled: [...]}`）：读-改-写全程在主进程内同步完成，
      // 两个并发的设置页操作不会互相覆盖；全量载荷会在并发下丢更新。
      if (route === 'set-disabled' && req.method === 'POST') {
        if (!aiManager) {
          sendJson(res, 503, { error: 'AI 服务尚未就绪' });
          return;
        }
        const { name, disabled } = await readJsonBody(req, res);
        sendJson(res, 200, await aiManager.setSkillDisabled(name, disabled));
        return;
      }

      // 卸载用户技能（Phase 50 D-07 / USER-06）—— 仅 `source === 'user'` 可删。
      // **判据全在 ai-skills-manager.deleteUserSkill()**：本 handler 只是转发层，
      // 手改 URL 直接调本端点同样会被拒（ROADMAP 判据 3 的承重点）。
      if (route === 'uninstall' && req.method === 'POST') {
        if (!aiManager) {
          sendJson(res, 503, { error: 'AI 服务尚未就绪' });
          return;
        }
        const { name } = await readJsonBody(req, res);
        sendJson(res, 200, await aiManager.uninstallUserSkill(name));
        return;
      }

      // 技能导入（Phase 51 D-03）—— 一个路由按 `Content-Type` / `mode` 分流。
      //
      // 三条分支：① `application/zip`（含 `x-zip-compressed` / `octet-stream`）⇒ raw
      // 上传 → 解压校验 → `{ importId, preview }`；② `application/json` + `mode: 'url'`
      // ⇒ 网络下载（51-05）→ **同一**解压校验管线；③ `mode: 'commit'` ⇒ 落盘。
      //
      // **分流只发生在本入参解析层**（D-03 的全部理由）：三种来源必须汇进同一个校验 +
      // 落盘函数，把分流做在这里才让「只有一个落盘实现」成为**可机械检查**的源码判据。
      // 本段仍是**零判定转发层**：不得出现 `kind ===` 之外的领域判定素材
      //（`isSeededName` / `managed-skills` 一律不得出现），Content-Type 与 `mode` 的
      // 入参解析是唯一允许的一层。
      //
      // ⚠️ body 上限**必须显式声明**（50 D-16 的交接要求）：形状是「默认小 + 需大者
      //    显式放大」，让「忘了声明」在 413 处当场可见。zip 分支显式放大；JSON 分支
      //    （url / commit 两个小载荷）同样走显式值以免被 1 MiB 默认闸静默截断。
      if (route === 'import' && req.method === 'POST') {
        if (!aiManager) {
          sendJson(res, 503, { error: 'AI 服务尚未就绪' });
          return;
        }
        const contentType = String(req.headers['content-type'] || '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        const RAW_ZIP_TYPES = [
          'application/zip',
          'application/x-zip-compressed',
          'application/octet-stream',
        ];

        if (RAW_ZIP_TYPES.includes(contentType)) {
          const buf = await readRawBody(req, res, { maxBytes: MAX_SKILL_PACKAGE_BYTES });
          sendJson(res, 200, await aiManager.previewSkillImport({ kind: 'zip', buffer: buf }));
          return;
        }

        if (contentType === 'application/json') {
          const body = await readJsonBody(req, res, { maxBytes: MAX_SKILL_PACKAGE_BYTES });
          const mode = body && body.mode;
          if (mode === 'url') {
            sendJson(res, 200, await aiManager.previewSkillImport({ kind: 'url', url: body.url }));
            return;
          }
          if (mode === 'commit') {
            sendJson(
              res,
              200,
              await aiManager.commitSkillImport({
                importId: body.importId,
                conflict: body.conflict,
                newName: body.newName,
              })
            );
            return;
          }
          // 未识别的 mode：显式码而非让 readJsonBody 的解析失败伪装成 400
          sendJson(res, 400, { error: '不支持的导入模式', code: 'unsupported_url' });
          return;
        }

        // 其它 Content-Type：显式三分支之一（T-51-20），**不得**把非 JSON body 喂给
        // JSON.parse 产生误导性错误。码取闭合码表内的 unsupported_url。
        sendJson(res, 400, {
          error: '不支持的请求内容类型，请使用 application/zip 或 application/json',
          code: 'unsupported_url',
        });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 技能 API 处理失败:', err.message);
      // code 必须回传：设置页按 code 查失败文案表，**不解析 message**（UI-SPEC Copywriting 纪律）
      sendJson(res, 400, { error: err.message, code: err.code || undefined });
    }
  }

  const realmServer = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, 'http://localhost');
    const reqPath = reqUrl.pathname;

    // 历史记录 JSON API（内部页面数据层）
    if (reqPath.startsWith('/api/history/')) {
      handleHistoryApi(req, res, reqUrl);
      return;
    }

    // 收藏夹 JSON API（内部页面数据层）
    if (reqPath.startsWith('/api/favorites/')) {
      handleFavoritesApi(req, res, reqUrl);
      return;
    }

    // 常用网站 JSON API（内部页面数据层）
    if (reqPath.startsWith('/api/frequent-sites/')) {
      handleFrequentSitesApi(req, res, reqUrl);
      return;
    }

    // 设置 JSON API（内部页面数据层）
    if (reqPath.startsWith('/api/settings/')) {
      handleSettingsApi(req, res, reqUrl);
      return;
    }

    // 搜索配置 JSON API（设置页面数据层）
    if (reqPath.startsWith('/api/search-config/')) {
      handleSearchConfigApi(req, res, reqUrl);
      return;
    }

    // 容器列表 JSON API（内部页面数据层）
    if (reqPath.startsWith('/api/containers/')) {
      handleContainersApi(req, res, reqUrl);
      return;
    }

    // 分配规则 JSON API（设置页面数据层）
    if (reqPath.startsWith('/api/rules/')) {
      handleRulesApi(req, res, reqUrl);
      return;
    }

    // 快捷键 JSON API（设置页面数据层）
    if (reqPath.startsWith('/api/shortcuts/')) {
      handleShortcutsApi(req, res, reqUrl);
      return;
    }

    // 技能管理 JSON API（设置页面「技能管理」分区数据层，Phase 50 D-15）。
    // 用 startsWith 而非 ===：该前缀承载多个子路由（list / 后续的 set-disabled、uninstall）。
    if (reqPath.startsWith('/api/skills/')) {
      handleSkillsApi(req, res, reqUrl);
      return;
    }

    // AI 记忆 JSON API（设置页面「AI 记忆」分区数据层）
    if (reqPath === '/api/ai-memory') {
      handleAiMemoryApi(req, res, reqUrl);
      return;
    }

    // 开发者模式请求数据 API（devrequests 页面数据层）
    if (reqPath.startsWith('/api/devrequests/')) {
      handleDevRequestsApi(req, res, reqUrl);
      return;
    }

    // 查看源码 API（viewsource 页面数据层）
    if (reqPath === '/api/viewsource') {
      if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
      }
      const targetUrl = reqUrl.searchParams.get('url');
      if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        sendJson(res, 400, { error: 'Invalid URL' });
        return;
      }
      try {
        const resp = await net.fetch(targetUrl, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) {
          sendJson(res, 502, { error: 'HTTP ' + resp.status });
          return;
        }
        const source = await resp.text();
        sendJson(res, 200, { source });
      } catch (err) {
        sendJson(res, 502, { error: err.message });
      }
      return;
    }

    // 下载管理 JSON API（下载面板数据层）
    if (reqPath.startsWith('/api/downloads/')) {
      handleDownloadsApi(req, res, reqUrl);
      return;
    }

    // 媒体任务 JSON API（realm://tasks 任务页数据层）
    if (reqPath.startsWith('/api/tasks/')) {
      handleTasksApi(req, res, reqUrl);
      return;
    }

    // 凭据管理 JSON API（设置页面自动填充数据层）
    if (reqPath.startsWith('/api/credentials/')) {
      handleCredentialsApi(req, res, reqUrl);
      return;
    }

    // 地址管理 JSON API（设置页面自动填充数据层）
    if (reqPath.startsWith('/api/address/')) {
      handleAddressApi(req, res, reqUrl);
      return;
    }

    // 收藏栏 API（设置页面收藏栏开关）
    if (reqPath === '/api/bookmarks-bar/toggle' && req.method === 'POST') {
      // token 鉴权
      if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
      }
      try {
        const { visible } = await readJsonBody(req, res);
        configStore.set('bookmarksBar.visible', !!visible);
        configStore.set('settings.bookmarksBar.visible', !!visible);
        // 通知所有窗口渲染进程
        windowManager.broadcast('bookmarks-bar:visibility-changed', { visible: !!visible });
        sendJson(res, 200, { success: true });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    // 视频流代理（播放器页面 hls.js 跨域请求同源化 + 防盗链 Referer 控制）
    if (reqPath === '/proxy') {
      await handleProxyRequest(req, res, reqUrl);
      return;
    }

    // 路由映射：/history → src/history.html，/history/xxx.js → src/xxx.js
    let filePath;
    if (reqPath === '/history' || reqPath === '/history/') {
      filePath = path.join(__dirname, 'src', 'history.html');
    } else if (reqPath.startsWith('/history/')) {
      // /history/history-page.js → src/history-page.js
      const subPath = reqPath.replace('/history/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/favorites' || reqPath === '/favorites/') {
      filePath = path.join(__dirname, 'src', 'favorites.html');
    } else if (reqPath.startsWith('/favorites/')) {
      const subPath = reqPath.replace('/favorites/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/newtab' || reqPath === '/newtab/') {
      filePath = path.join(__dirname, 'src', 'newtab.html');
    } else if (reqPath.startsWith('/newtab/')) {
      const subPath = reqPath.replace('/newtab/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/settings' || reqPath === '/settings/') {
      filePath = path.join(__dirname, 'src', 'settings.html');
    } else if (reqPath.startsWith('/settings/')) {
      const subPath = reqPath.replace('/settings/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/downloads' || reqPath === '/downloads/') {
      filePath = path.join(__dirname, 'src', 'downloads.html');
    } else if (reqPath.startsWith('/downloads/')) {
      const subPath = reqPath.replace('/downloads/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/tasks' || reqPath === '/tasks/') {
      filePath = path.join(__dirname, 'src', 'tasks.html');
    } else if (reqPath.startsWith('/tasks/')) {
      const subPath = reqPath.replace('/tasks/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/devrequests' || reqPath === '/devrequests/') {
      filePath = path.join(__dirname, 'src', 'devrequests.html');
    } else if (/^\/devrequests\/\d+\/?$/.test(reqPath)) {
      // 详情页：/devrequests/123 → src/devrequest-detail.html（id 由页面 JS 从 path 解析）
      filePath = path.join(__dirname, 'src', 'devrequest-detail.html');
    } else if (reqPath.startsWith('/devrequests/')) {
      const subPath = reqPath.replace('/devrequests/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/viewsource' || reqPath === '/viewsource/') {
      filePath = path.join(__dirname, 'src', 'viewsource.html');
    } else if (reqPath.startsWith('/viewsource/')) {
      const subPath = reqPath.replace('/viewsource/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath === '/player' || reqPath === '/player/') {
      filePath = path.join(__dirname, 'src', 'player.html');
    } else if (reqPath.startsWith('/player/')) {
      const subPath = reqPath.replace('/player/', '');
      filePath = path.join(__dirname, 'src', subPath);
    } else if (reqPath.startsWith('/node_modules/')) {
      const subPath = reqPath.replace('/node_modules/', '');
      filePath = path.join(__dirname, 'node_modules', subPath);
    } else {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // 安全检查：防止路径遍历
    const srcRoot = path.join(__dirname, 'src');
    const nodeModulesRoot = path.join(__dirname, 'node_modules');
    if (!filePath.startsWith(srcRoot) && !filePath.startsWith(nodeModulesRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = REALM_MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      // 内部页响应统一 no-store（Pitfall 7：避免 localhost 页面进入 Chromium HTTP 缓存）
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });

  // 在随机可用端口启动服务器
  realmServer.listen(0, '127.0.0.1', () => {
    realmPort = realmServer.address().port;
    console.log(`[Realm] 内部页面服务器已启动: http://localhost:${realmPort}`);
    // 媒体嗅探忽略内部服务器流量（播放器页面 /proxy 代理请求不计入媒体列表）
    mediaSniffer.internalOrigin = `http://localhost:${realmPort}`;

    // 独立播放器窗口 localhost 化（Phase 44 D-02）：media:play 经此端口加载
    // player 页并注入 token（ipc-handlers 无 main.js 作用域，经 setter 传入）
    setRealmServerInfo({ port: realmPort, token: REALM_TOKEN });

    // 暴露端口和 API token 给渲染进程（token 用于内部页面调用 /api/history/*）
    ipcMain.handle('get-realm-port', (event) => {
      assertTrustedSender(event);
      return { port: realmPort, token: REALM_TOKEN };
    });
  });

  // Phase 44 D-25：媒体任务统一注册表（record/convert 状态机）
  // persist 写 userData/media-tasks.json（D-18 崩溃重启恢复源），
  // 状态 diff 广播 media-task:changed / media-task:count-changed（D-26 角标），
  // 终态 completed/failed 发系统通知（Pitfall 8 失败不阻断）
  mediaTasksPath = path.join(app.getPath('userData'), 'media-tasks.json');
  lastPersistedStatuses = new Map();
  lastRunningCount = -1;
  mediaTaskManager = createMediaTaskManager({ persist: persistMediaTasks });
  try {
    const saved = fs.existsSync(mediaTasksPath) ? fs.readFileSync(mediaTasksPath, 'utf8') : '[]';
    mediaTaskManager.restoreTasks(saved);
    console.log(`[Realm] 媒体任务注册表已初始化: ${mediaTasksPath}`);
  } catch (err) {
    console.warn('[Realm] 媒体任务恢复失败（以空注册表启动）:', err.message);
  }

  // Phase 44 D-05/D-06：媒体缓存构造参数从设置读取（settings.cacheDir 缺省
  // userData/media-cache、settings.cacheMaxGB 缺省 10，T-44-09 主进程侧缺省回退）；
  // isVideoActive 接 mediaTaskManager（D-07：running 录制/转换任务对应视频淘汰豁免）
  function buildMediaCacheOptions() {
    const cacheMaxGB = configStore.get('settings.cacheMaxGB', 10);
    const gb = (Number.isInteger(cacheMaxGB) && cacheMaxGB >= 1 && cacheMaxGB <= 1024) ? cacheMaxGB : 10;
    return {
      cacheRoot: configStore.get('settings.cacheDir', path.join(app.getPath('userData'), 'media-cache')),
      capacityBytes: gb * 1024 * 1024 * 1024,
      isVideoActive: (playbackKey) => {
        try {
          return mediaTaskManager ? mediaTaskManager.isVideoActive(playbackKey) : false;
        } catch {
          return false;
        }
      },
      // UI Top1（D-08）：缓存告警出口——磁盘满强淘成功/写入失败广播到主窗口
      //（renderer 按 type 映射契约文案并 toast；文案单一来源在 UI 层）
      onCacheWarning: (type) => {
        try {
          windowManager.broadcast('cache:warning', { type });
        } catch (err) {
          console.warn('[Realm] 缓存告警广播失败:', err.message);
        }
      },
    };
  }

  /**
   * 重建媒体缓存管理器（设置页更改缓存目录后调用）
   * 旧缓存目录保留不删（D-05），新目录同样注入 cacheRoot/capacityBytes/isVideoActive
   */
  function rebuildMediaCache() {
    mediaCache = new MediaCacheManager(buildMediaCacheOptions());
    setMediaCaches({ mediaCache, playerHistory: playerHistoryManager });
    console.log(`[Realm] 媒体缓存已重建: ${mediaCache.cacheRoot}`);
  }

  mediaCache = new MediaCacheManager(buildMediaCacheOptions());
  console.log(`[Realm] 媒体缓存已初始化: ${mediaCache.cacheRoot}`);

  // Phase 44 D-11：播放器观看历史（独立小库，playback_key 主键 upsert，
  // 不随缓存淘汰消失）；注入 ipc-handlers 供 player:progress 等通道使用
  const playerHistoryManager = require('./player-history-manager');
  playerHistoryManager.init({ dbPath: path.join(app.getPath('userData'), 'player-history.db') });
  setMediaCaches({ mediaCache, playerHistory: playerHistoryManager });

  // Phase 44 D-18/D-23：直播录制引擎——fetchPage 用容器 session 包装 ses.fetch 回源
  //（参照 handleProxyRequest 的 Referer/UA/容器 session 语义）；recordRoot 独立于
  // 缓存库（userData/media-records，D-23 不参与容量淘汰）。注入 ipc-handlers 供
  // player:record/* 通道与播放器窗口 close 拦截使用
  //
  // 录制根目录常量（CR-03 单一来源）：media-record-engine 注入值与此处唯一字面量，
  // readRecordTaskSegments 的 outputPath 缺失补算（path.join(RECORD_ROOT, task.id)）同源，
  // 杜绝引擎写目录与补算回退两处漂移
  const RECORD_ROOT = path.join(app.getPath('userData'), 'media-records');

  const recordEngine = createRecordEngine({
    fetchPage: async (url, { referer, containerId } = {}) => {
      const { session } = require('electron');
      const ses = containerId
        ? session.fromPartition(`persist:container-${containerId}`)
        : session.defaultSession;
      const headers = { 'User-Agent': CHROME_UA };
      if (referer) headers['Referer'] = referer;
      const resp = await ses.fetch(url, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return Buffer.from(await resp.arrayBuffer());
    },
    taskManager: mediaTaskManager,
    recordRoot: RECORD_ROOT,
    maxConcurrent: 2,
    maxRetries: 5,
  });
  setMediaRecordEngine(recordEngine);

  // ==================== Phase 44 D-22/D-24：mp4 转换任务编排 ====================

  /** convert 任务失败原因 → 用户可读文案（UI-SPEC Copywriting：任务页「MP4 转换失败：{原因}」） */
  const CONVERT_FAIL_TEXT = {
    discontinuity: '直播流含不连续片段，暂不支持转换',
    transmux_failed: '转封装处理失败',
    write_failed: '产物写盘失败',
    segment_missing: '分片文件缺失',
    no_segments: '无可转换的分片',
    invalid_output: '产物路径无效',
    unsupported_container: '分片格式暂不支持转换（仅支持 MPEG-TS）',
    // IN-05：嗅探读首分片失败（非 ENOENT 的 IO 错误，如权限）——与 segment_missing 区分
    sniff_read_failed: '分片读取失败（文件不可读）',
    encrypted_stream: '分片为加密数据，暂不支持转换',
    // G-44-7：转换入口早拒的统一文案（纵深防御——万一某入口漏判进了 mux，失败文案也是本句）
    encrypted: '加密视频暂不支持转换',
    // AES-128 解密链路：密钥未缓存（重新播放一次即会经 /proxy 留存）/ 解密失败
    key_unavailable: '解密密钥未缓存，请重新播放该视频后再转换',
    decrypt_failed: '分片解密失败',
    // 45-02（Pitfall 5）：fMP4 拼接链路新 reason（45-01 产生）——参照 key_unavailable
    // 引导口吻；init_missing = 录制/缓存时未留存 init（重新播放/录制即会留存）
    init_missing: 'fMP4 视频缺少初始化段，请重新播放或重新录制后再转换',
    invalid_init: 'fMP4 初始化段损坏，无法转换',
    empty_output: '转换产物为空',
  };

  /**
   * 读取 record 任务的录制目录分片列表（D-18 崩溃保留 + D-22 接力 + 续转共用）
   * @param {Object} task - record 任务快照（outputPath = recordRoot/<taskId>；
   *   outputPath 缺失的 interrupted/failed 恢复快照按 path.join(RECORD_ROOT, task.id) 补算——CR-03）
   * @returns {{ segmentPaths: string[], meta: Object }|null} 分片绝对路径列表与索引；无可用分片返回 null
   */
  function readRecordTaskSegments(task) {
    // CR-03 目录补算：completed 任务沿用引擎 stopRecord/completeTask 写下的 outputPath；
    // interrupted/failed 恢复快照不带 outputPath（registerTask 初始值为空、终态才落库，
    // 见 media-task-manager restoreTasks）——按 path.join(RECORD_ROOT, task.id) 补算
    // taskId→录制目录映射（meta.json 崩溃前已落盘在 RECORD_ROOT/<taskId>/）。
    // 补算前 task.id 过 uuid 形态白名单（media-tasks.json 可被本地篡改，防补算路径穿越；
    // registerTask 用 crypto.randomUUID 生成，天然命中该白名单）。
    let recordDir = task && typeof task.outputPath === 'string' && task.outputPath ? task.outputPath : null;
    if (!recordDir) {
      const tid = task && task.id;
      if (typeof tid !== 'string' || !/^[0-9a-fA-F-]{8,64}$/.test(tid)) return null;
      recordDir = path.join(RECORD_ROOT, tid);
    }
    const metaPath = path.join(recordDir, 'meta.json');
    if (!fs.existsSync(metaPath)) return null;
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (err) {
      console.warn('[Realm] 录制索引读取失败:', err.message);
      return null;
    }
    const segmentPaths = (Array.isArray(meta.segments) ? meta.segments : [])
      .map((s) => (s && typeof s.file === 'string' ? path.join(recordDir, 'segments', s.file) : null))
      .filter((p) => p && fs.existsSync(p));
    if (segmentPaths.length === 0) return null;
    // 45-02（D-05）：fMP4 录制任务的 init 分片路径——meta.initFile 缺字段（旧 meta
    // 或 TS 录制）/ 文件缺失 → null，转换走 init_missing 兜底（45-01 分流）
    let initPath = null;
    if (typeof meta.initFile === 'string' && meta.initFile) {
      const p = path.join(recordDir, meta.initFile);
      if (fs.existsSync(p)) initPath = p;
    }
    return { segmentPaths, meta, initPath };
  }

  /**
   * 转换发起统一入口（D-22/D-24）：showSaveDialog 选目录（默认 last-used/下载目录，
   * 记住选择写回 settings.lastMediaSaveDir）→ 同名「 (2)」序号 → 注册 convert 任务
   * → media-remuxer 后台转封装（进度/终态走注册表统一链路：任务页/角标/通知/定位）。
   * 用户取消弹框 → 不建任务返回 cancelled（D-22：已录分片保留可稍后续转）。
   * @param {Object} input - { segmentPaths, title, containerId?, playbackKey?, hasDiscontinuity?, hasEncryption?, decryption?, sourceTaskId? }
   * @returns {Promise<{ok: boolean, taskId?: string, reason?: string}>}
   */
  async function startConvertTask(input) {
    const { segmentPaths, title, containerId, playbackKey, hasDiscontinuity, hasEncryption, decryption, initPath } = input || {};
    // G-44-7：加密源（EXT-X-KEY METHOD≠NONE）无解密材料时早拒——record 录制链路
    // 不留存密钥，加密录制任务不可转换；缓存链路带 decryption（keyHex/ivHex/seq）
    // 走 AES-128 解密转换，不放行本分支
    if (hasEncryption && !decryption) return { ok: false, reason: 'encrypted' };
    if (hasDiscontinuity) return { ok: false, reason: 'discontinuity' };
    if (!Array.isArray(segmentPaths) || segmentPaths.length === 0) {
      return { ok: false, reason: 'no_segments' };
    }
    // D-24：弹框默认目录 = last-used（缺省下载目录），产物命名「{标题} {YYYY-MM-DD HHmm}.mp4」
    const lastDir = configStore.get('settings.lastMediaSaveDir', app.getPath('downloads'));
    const defaultPath = path.join(lastDir, buildOutputName(title || '未命名', new Date()));
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '转换 MP4',
      defaultPath,
      filters: [{ name: 'MP4 视频', extensions: ['mp4'] }],
    });
    if (canceled || !filePath) return { ok: false, reason: 'cancelled' };
    // D-24 记住所选目录（下次弹框默认）
    try {
      configStore.set('settings.lastMediaSaveDir', path.dirname(filePath));
    } catch (err) {
      console.warn('[Realm] lastMediaSaveDir 写回失败:', err.message);
    }
    // D-22 同名「 (2)」序号（复用 download-manager getUniqueFilePath 先例）
    const savePath = downloadManager.getUniqueFilePath(filePath);

    let task;
    try {
      task = mediaTaskManager.registerTask({
        type: 'convert',
        title: title || '未命名',
        containerId: containerId || '',
        playbackKey: playbackKey || null,
      });
    } catch (err) {
      console.warn('[Realm] convert 任务注册失败:', err.message);
      return { ok: false, reason: 'register_failed' };
    }
    const taskId = task.id;

    // 取消令牌注册（CR-04 Task 2）：/api/tasks/cancel 对 running convert 任务经
    // convertCancelTokens 触发 cancelSignal → shouldCancel 闭包置位 → convertToMp4
    // 每分片迭代检查后以 reason='cancelled' 中止并清理半成品；令牌在 promise 链
    // .finally 注销（防 Map 泄漏，T-44-G08-04）
    let convertCancelled = false;
    const cancelSignal = () => {
      convertCancelled = true;
    };
    convertCancelTokens.set(taskId, cancelSignal);

    // 后台执行转封装（T-44-17 流式写盘在 media-remuxer 内）；进度整数百分比
    // 变化才 updateProgress（注册表每次变更都触发 persist 落盘，降写放大）
    let lastPct = -1;
    convertToMp4({
      segmentPaths,
      outputPath: savePath,
      hasDiscontinuity: false,
      shouldCancel: () => convertCancelled,
      decryption: decryption || undefined,
      // 45-02（D-06）：fMP4 init 分片路径透传（录制 TS 条目为 null，不影响既有 TS 路径）
      initPath: initPath || undefined,
      onProgress: (done, total) => {
        const pct = Math.max(1, Math.min(99, Math.round((done / total) * 100)));
        if (pct === lastPct) return;
        lastPct = pct;
        try {
          mediaTaskManager.updateProgress(taskId, pct);
        } catch (err) {
          console.warn(`[Realm] 转换进度更新失败 (${taskId}):`, err.message);
        }
      },
    })
      .then(() => {
        try {
          mediaTaskManager.completeTask(taskId, { outputPath: savePath });
        } catch (err) {
          console.warn(`[Realm] 转换任务完成流转失败 (${taskId}):`, err.message);
        }
      })
      .catch((err) => {
        // CR-04：协作式取消落 cancelled（而非 failed）——reason='cancelled' 拦截在
        // 失败文案映射之前（CONVERT_FAIL_TEXT 无 'cancelled' 条目）
        if (err && err.reason === 'cancelled') {
          try {
            mediaTaskManager.cancelTask(taskId, '用户取消');
          } catch (e2) {
            console.warn(`[Realm] 转换任务取消流转异常 (${taskId}):`, e2.message);
          }
          return;
        }
        const reasonText = CONVERT_FAIL_TEXT[err.reason] || err.message || '未知原因';
        try {
          mediaTaskManager.failTask(taskId, `MP4 转换失败：${reasonText}`);
        } catch (err2) {
          console.warn(`[Realm] 转换任务失败流转异常 (${taskId}):`, err2.message);
        }
      })
      .finally(() => {
        // 终态注销令牌（完成/失败/取消路径均收敛；竞态窗口：循环越过最后检查点后
        // 到达的取消信号不生效——任务按 completeTask 收尾为 completed，接受该竞态）
        // IN-02：Map.delete 不会抛错，无需 try/catch 包裹
        convertCancelTokens.delete(taskId);
      });
    return { ok: true, taskId };
  }

  /**
   * 从 record 任务发起续转（D-22 取消弹框后续转 / D-18 中断续转共用）：
   * 读录制目录 meta.json 分片索引 → startConvertTask
   * @param {Object} task - record 任务快照
   * @returns {Promise<{ok: boolean, taskId?: string, reason?: string}>}
   */
  async function startConvertFromRecordTask(task) {
    const bundle = readRecordTaskSegments(task);
    if (!bundle) return { ok: false, reason: 'no_segments' };
    return startConvertTask({
      segmentPaths: bundle.segmentPaths,
      initPath: bundle.initPath,
      title: bundle.meta.title || task.title,
      containerId: bundle.meta.containerId || task.containerId || '',
      playbackKey: bundle.meta.playbackKey || task.playbackKey || null,
      hasDiscontinuity: !!bundle.meta.hasDiscontinuity,
      hasEncryption: !!bundle.meta.hasEncryption,
      sourceTaskId: task.id,
    });
  }

  /**
   * 转换发起层（startConvertFromInputRaw 早拒）专属失败文案（UI Top2）——
   * 执行层 reason 的文案见 CONVERT_FAIL_TEXT；两层由 wrapper 统一补 error，
   * renderer 直接展示，不再自建 reason→文案表
   */
  const CONVERT_INPUT_FAIL_TEXT = {
    invalid_input: '转换参数无效',
    not_ready: '媒体服务未就绪，请稍后重试',
    task_not_found: '录制任务不存在',
    not_record: '仅录制任务支持转换',
    not_resumable: '该任务状态不支持转换',
    invalid_entry: '缓存条目无效或已失效',
    segments_incomplete: '分片尚未缓存完整，请完整播放后再转换',
  };

  /**
   * 转换发起 IPC/弹框桥（player:convert/start 数据源，D-17 服务端复校——
   * 前端已隐藏按钮属纵深防御）：entryId（缓存条目）或 taskId（record 任务）
   * 失败时统一补中文 error（UI Top2：renderer 直接展示，避免自建文案表）
   * @param {{ entryId?: string, taskId?: string }} input
   * @returns {Promise<{ok: boolean, taskId?: string, reason?: string, error?: string}>}
   */
  async function startConvertFromInput(input) {
    const r = await startConvertFromInputRaw(input);
    if (r && r.ok === false && !r.error) {
      return { ...r, error: CONVERT_FAIL_TEXT[r.reason] || CONVERT_INPUT_FAIL_TEXT[r.reason] || '转换发起失败' };
    }
    return r;
  }

  /**
   * 转换发起层实现（早拒；文案补齐见外层 startConvertFromInput）
   * @param {{ entryId?: string, taskId?: string }} input
   * @returns {Promise<{ok: boolean, taskId?: string, reason?: string}>}
   */
  async function startConvertFromInputRaw(input) {
    if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };
    if (typeof input.taskId === 'string' && input.taskId) {
      if (!mediaTaskManager) return { ok: false, reason: 'not_ready' };
      const task = mediaTaskManager.listTasks().find((t) => t.id === input.taskId);
      if (!task) return { ok: false, reason: 'task_not_found' };
      if (task.type !== 'record') return { ok: false, reason: 'not_record' };
      // D-17：录制中断/失败（崩溃不白录）与已完成（取消弹框后补转）可续转
      if (task.status !== 'interrupted' && task.status !== 'failed' && task.status !== 'completed') {
        return { ok: false, reason: 'not_resumable' };
      }
      return startConvertFromRecordTask(task);
    }
    if (typeof input.entryId === 'string' && input.entryId) {
      if (!mediaCache) return { ok: false, reason: 'not_ready' };
      // entryId 兼容 playbackKey / videoId（沿 player:cache:delete 先例）
      let videoId = input.entryId;
      if (!/^[a-f0-9]{16}$/.test(videoId)) {
        try {
          videoId = videoIdOf(videoId);
        } catch {
          return { ok: false, reason: 'invalid_entry' };
        }
      }
      if (!/^[a-f0-9]{16}$/.test(videoId)) return { ok: false, reason: 'invalid_entry' };
      let info = null;
      try {
        info = mediaCache.getConvertInfo(videoId);
      } catch {
        return { ok: false, reason: 'invalid_entry' };
      }
      if (!info) return { ok: false, reason: 'invalid_entry' };
      // D-17 服务端复校：完整度 100%（分片齐全）才可转；discontinuity 拒转
      if (info.hasDiscontinuity) return { ok: false, reason: 'discontinuity' };
      // AES-128 加密源：有解密材料（key_hex 经 /proxy 密钥请求留存/历史污染自愈）
      // 走解密转换；密钥缺失（未重播/两级清单形态）提示重播后再转
      let decryption = null;
      if (info.hasEncryption) {
        if (!info.keyHex) return { ok: false, reason: 'key_unavailable' };
        decryption = {
          keyHex: info.keyHex,
          ivHex: info.keyIvHex || null,
          mediaSequence: info.mediaSequence || 0,
        };
      }
      // fMP4 缓存条目（45-03，D-03 第二链路）：清单含 EXT-X-MAP 但 init 分片未
      // 留存（45-03 前的历史条目 / BYTERANGE 不支持形态）→ 早拒引导重播（重播后
      // init 经 /proxy 留存即可转换，自愈路径与 key_unavailable 同款；文案
      // CONVERT_FAIL_TEXT.init_missing 已于 45-02 注册）
      if (info.hasFmp4Map && !info.initPath) return { ok: false, reason: 'init_missing' };
      if (info.completeness === null || info.completeness < 100) {
        return { ok: false, reason: 'segments_incomplete' };
      }
      return startConvertTask({
        segmentPaths: info.segmentPaths,
        initPath: info.initPath,
        title: info.title || '',
        containerId: '',
        playbackKey: info.playbackKey || null,
        hasEncryption: info.hasEncryption,
        decryption,
      });
    }
    return { ok: false, reason: 'invalid_input' };
  }

  // 注入 ipc-handlers 供 player:convert/start 通道调用（沿 setMediaRecordEngine 惯例）
  setMediaConvertStarter(startConvertFromInput);

  // D-22 接力：record 任务 completed（停止录制/VOD 录完/关窗「停止并保存」）
  // → 自动弹框选目录派生 convert 任务；取消弹框则不建任务，已录分片保留，
  // 任务页该条目仍可「已落盘部分续转」
  mediaTaskManager.onTaskCompleted((task) => {
    if (task.type !== 'record' || task.status !== 'completed') return;
    startConvertFromRecordTask(task).catch((err) => {
      console.warn('[Realm] 录制→转换接力失败:', err.message);
    });
  });

  // 注册 IPC 处理器
  registerHandlers();

  // 初始化拖拽协调器（注入依赖，避免循环 require）
  dragCoordinator.setWindowManager(windowManager);
  dragCoordinator.setTabManager(tabManager);
  dragCoordinator.setContainerManager(containerManager);

  /**
   * 验证 IPC 发送方是否为受信任的窗口
   * 与 ipc-handlers.js 中的 assertTrustedSender 保持一致的信任边界
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @returns {BrowserWindow} 受信的窗口实例
   * @throws {Error} 来源不受信任时抛出
   */
  function assertTrustedSender(event) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || !windowManager.isManagedWindow(win.id)) {
      throw new Error('不受信任的 IPC 来源');
    }
    return win;
  }

  // Phase 44 D-05/T-44-08：缓存目录仅经 dialog.showOpenDialog 选取（不手输），
  // 选中即写 settings.cacheDir 并重建 media-cache-manager（旧目录保留不删）
  ipcMain.handle('settings:choose-cache-dir', async (event) => {
    try {
      const win = assertTrustedSender(event);
      const result = await dialog.showOpenDialog(win, {
        title: '选择媒体缓存目录',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: configStore.get('settings.cacheDir', path.join(app.getPath('userData'), 'media-cache')),
      });
      if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
        return { success: true, path: null };
      }
      const dir = result.filePaths[0];
      configStore.set('settings.cacheDir', dir);
      rebuildMediaCache();
      return { success: true, path: dir };
    } catch (err) {
      console.error('[Realm] 选择缓存目录失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ==================== 右键菜单 IPC 监听器 ====================

  /**
   * 标签页右键菜单请求
   * 渲染进程 Tab 栏右键时发送，主进程构建并弹出原生菜单
   * @param {Object} tabInfo - 标签上下文 { tabId, tabCount, tabIndex, isPinned, hasClosedTabs }
   */
  ipcMain.on('show-tab-context-menu', (event, tabInfo) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
      contextMenuManager.buildTabMenu(tabInfo, mainWindow);
    }
  });

  /**
   * 标签栏空白区右键菜单请求
   * 渲染进程 Tab 栏空白处（非标签项）右键时发送，主进程构建并弹出原生菜单
   */
  ipcMain.on('show-tab-bar-context-menu', (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
      contextMenuManager.buildTabBarMenu(mainWindow);
    }
  });

  /**
   * 网页右键菜单请求
   * 渲染进程 webview context-menu 事件时发送，主进程注入容器列表和 guestContentsId
   * @param {Object} contextInfo - 上下文 { hasImage, hasLink, linkURL, srcURL, mediaType, selectionText, ... }
   */
  ipcMain.on('show-web-context-menu', (event, contextInfo) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
      // 注入容器列表（用于链接菜单的容器子菜单）
      const containers = containerManager.getContainers();
      // 使用 activeWebviewContentsId 替代渲染进程传来的 guestContentsId（T-13-01 安全缓解）
      // 主进程不信任渲染进程传来的 guestContentsId，使用自己维护的值
      const enrichedContext = {
        ...contextInfo,
        containers,
        guestContentsId: getActiveWebviewContentsId(),
      };
      contextMenuManager.buildWebMenu(enrichedContext, mainWindow);
    }
  });

  /**
   * 已关闭标签信息上报
   * 渲染进程关闭标签时发送，主进程维护 closedTabsStack
   * @param {Object} tabInfo - 关闭的标签信息 { containerId, url, title }
   */
  ipcMain.on('context-menu:closed-tab', (event, tabInfo) => {
    contextMenuManager.pushClosedTab(tabInfo);
  });

  /**
   * 收藏栏右键菜单请求
   * 渲染进程收藏栏右键时发送，主进程构建并弹出原生菜单
   * @param {Object} info - 上下文信息 { type: 'bookmark'|'folder'|'blank', id?, url?, title?, name? }
   */
  ipcMain.on('show-bookmarks-bar-context-menu', (event, info) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) return;

    const hostWebContents = mainWindow.webContents;
    let template = [];

    if (info.type === 'bookmark') {
      // D-12: 收藏项右键菜单
      template = [
        {
          label: '在新标签页打开',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:navigate', { url: info.url, newTab: true });
            }
          },
        },
        { type: 'separator' },
        {
          label: '编辑',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:edit-bookmark', { id: info.id, url: info.url, title: info.title });
            }
          },
        },
        { type: 'separator' },
        {
          label: '删除',
          click: async () => {
            try {
              await favoritesManager.deleteRecord(info.id);
              windowManager.broadcast('bookmarks-bar:refresh');
            } catch (err) {
              console.error('[Realm] 删除收藏失败:', err);
            }
          },
        },
      ];
    } else if (info.type === 'folder') {
      // D-13: 文件夹右键菜单
      template = [
        {
          label: '在新标签页中打开所有书签',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:open-all', { folderId: info.id });
            }
          },
        },
        { type: 'separator' },
        {
          label: '重命名',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:rename-folder', { id: info.id, name: info.name });
            }
          },
        },
        {
          label: '删除',
          click: async () => {
            try {
              await favoritesManager.deleteFolder(info.id);
              windowManager.broadcast('bookmarks-bar:refresh');
            } catch (err) {
              console.error('[Realm] 删除文件夹失败:', err);
            }
          },
        },
        { type: 'separator' },
        {
          label: '添加书签',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:add-bookmark', { folderId: info.id });
            }
          },
        },
        {
          label: '添加文件夹',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:add-folder', { parentId: info.id });
            }
          },
        },
      ];
    } else {
      // D-03/D-14: 空白区域右键菜单
      template = [
        {
          label: '添加书签',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:add-bookmark', { folderId: 0 });
            }
          },
        },
        {
          label: '添加文件夹',
          click: () => {
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:add-folder', { parentId: 0 });
            }
          },
        },
        { type: 'separator' },
        {
          label: '隐藏收藏栏',
          click: () => {
            configStore.set('bookmarksBar.visible', false);
            configStore.set('settings.bookmarksBar.visible', false);
            windowManager.broadcast('bookmarks-bar:visibility-changed', { visible: false });
          },
        },
      ];
    }

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: mainWindow });
  });

  // ==================== 收藏夹文件夹 IPC ====================

  // 创建文件夹
  ipcMain.handle('favorites:create-folder', async (event, { name, parentId }) => {
    assertTrustedSender(event);
    const result = favoritesManager.createFolder({ name, parentId });
    if (result.id) {
      windowManager.broadcast('bookmarks-bar:refresh');
    }
    return result;
  });

  // 重命名文件夹
  ipcMain.handle('favorites:rename-folder', async (event, { id, name }) => {
    assertTrustedSender(event);
    const result = favoritesManager.renameFolder(id, { name });
    if (result) {
      windowManager.broadcast('bookmarks-bar:refresh');
    }
    return result;
  });

  // 删除文件夹
  ipcMain.handle('favorites:delete-folder', async (event, { id }) => {
    assertTrustedSender(event);
    const result = favoritesManager.deleteFolder(id);
    if (result.success) {
      windowManager.broadcast('bookmarks-bar:refresh');
    }
    return result;
  });

  // 列出子文件夹
  ipcMain.handle('favorites:list-folders', async (event, { parentId }) => {
    assertTrustedSender(event);
    return favoritesManager.listFolders(parentId);
  });

  // 获取文件夹树
  ipcMain.handle('favorites:get-folder-tree', async (event) => {
    assertTrustedSender(event);
    return favoritesManager.getFolderTree();
  });

  // 移动文件夹
  ipcMain.handle('favorites:move-folder', async (event, { id, parentId }) => {
    assertTrustedSender(event);
    const result = favoritesManager.moveFolder(id, { parentId });
    windowManager.broadcast('bookmarks-bar:refresh');
    return result;
  });

  // 移动收藏项到文件夹
  ipcMain.handle('favorites:move-favorite', async (event, { id, folderId }) => {
    assertTrustedSender(event);
    const result = favoritesManager.moveFavorite(id, { folderId });
    windowManager.broadcast('bookmarks-bar:refresh');
    return result;
  });

  // 移动收藏项到文件夹末尾（folder_id + 末尾排序键原子写入）
  ipcMain.handle('favorites:move-favorite-into', async (event, { id, folderId }) => {
    assertTrustedSender(event);
    const result = favoritesManager.moveFavoriteInto(id, { folderId });
    windowManager.broadcast('bookmarks-bar:refresh');
    return result;
  });

  // 计算 fractional 排序键（主窗口 file:// 无法 fetch HTTP 端点，走 IPC）
  ipcMain.handle('favorites:compute-sort-keys', async (event, { beforeKey, afterKey, count }) => {
    assertTrustedSender(event);
    return favoritesManager.computeSortKeys(beforeKey, afterKey, count);
  });

  // 批量移动收藏项
  ipcMain.handle('favorites:move-favorites', async (event, { ids, folderId }) => {
    assertTrustedSender(event);
    const result = favoritesManager.moveFavorites(ids, { folderId });
    windowManager.broadcast('bookmarks-bar:refresh');
    return result;
  });

  // 应用收藏整理方案（AI 整理卡片确认后调用）
  ipcMain.handle('favorites:apply-organize', async (event, { plan }) => {
    assertTrustedSender(event);

    if (!Array.isArray(plan) || plan.length === 0) {
      return { success: false, message: '整理方案为空' };
    }
    // 基础格式校验：每组需有 folderName 与非空 bookmarkIds
    for (const group of plan) {
      if (!group || typeof group.folderName !== 'string' || !group.folderName.trim() ||
          !Array.isArray(group.bookmarkIds)) {
        return { success: false, message: '整理方案格式不正确' };
      }
    }

    const result = favoritesManager.applyOrganizePlan(plan);
    windowManager.broadcast('bookmarks-bar:refresh');
    return { success: true, ...result };
  });

  // 更新文件夹排序
  ipcMain.handle('favorites:update-folder-sort', async (event, { id, sortOrder }) => {
    assertTrustedSender(event);
    const result = favoritesManager.updateFolderSort(id, { sortOrder });
    windowManager.broadcast('bookmarks-bar:refresh');
    return result;
  });

  // 更新收藏项排序
  ipcMain.handle('favorites:update-favorite-sort', async (event, { id, sortOrder }) => {
    assertTrustedSender(event);
    const result = favoritesManager.updateFavoriteSort(id, { sortOrder });
    windowManager.broadcast('bookmarks-bar:refresh');
    return result;
  });

  // ==================== 书签导入 IPC ====================
  // 注意：currentImportAbortController / currentImportProgress 已在上方
  // HTTP 服务区声明（与 /api/favorites/* 导入端点共享），此处直接复用。

  // Chrome JSON 书签导入（per D-03, D-04, D-05, D-10, D-13）
  ipcMain.handle('favorites:import-chrome', async (event, { filePath }) => {
    assertTrustedSender(event);

    // 创建新的 AbortController
    currentImportAbortController = new AbortController();

    const onProgress = (data) => {
      currentImportProgress = data;
      if (!event.sender.isDestroyed()) {
        event.sender.send('favorites:import-progress', data);
      }
    };

    try {
      const result = await favoritesManager.importChromeBookmarks(
        { filePath },
        onProgress,
        currentImportAbortController.signal
      );
      return result;
    } finally {
      currentImportAbortController = null;
      currentImportProgress = null;
    }
  });

  // HTML 书签导入（per D-11, D-12, D-13）
  ipcMain.handle('favorites:import-html', async (event, { filePath }) => {
    assertTrustedSender(event);

    currentImportAbortController = new AbortController();

    const onProgress = (data) => {
      currentImportProgress = data;
      if (!event.sender.isDestroyed()) {
        event.sender.send('favorites:import-progress', data);
      }
    };

    try {
      const result = await favoritesManager.importHtmlBookmarks(
        { filePath },
        onProgress,
        currentImportAbortController.signal
      );
      return result;
    } finally {
      currentImportAbortController = null;
      currentImportProgress = null;
    }
  });

  // 取消导入操作（per IMPORT-03）
  ipcMain.handle('favorites:import-abort', async (event) => {
    assertTrustedSender(event);
    if (currentImportAbortController) {
      currentImportAbortController.abort();
      return { success: true };
    }
    return { success: false, message: '没有正在进行的导入操作' };
  });

  // 检测 Chrome 书签路径（per D-03）
  ipcMain.handle('favorites:detect-chrome-path', async (event) => {
    assertTrustedSender(event);
    const chromePath = favoritesManager.detectChromeBookmarksPath();
    return { path: chromePath };
  });

  // 打开文件选择对话框（per D-04）
  ipcMain.handle('dialog:open', async (event, options) => {
    assertTrustedSender(event);
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(mainWindow, options);
  });

  // ==================== 收藏栏 IPC Handlers ====================

  /**
   * 切换收藏栏显示/隐藏状态
   * 持久化到 electron-store，重启后保持用户偏好
   */
  ipcMain.handle('bookmarks-bar:toggle', async (event, { visible }) => {
    assertTrustedSender(event);
    configStore.set('bookmarksBar.visible', visible);
    configStore.set('settings.bookmarksBar.visible', visible);
    return { success: true };
  });

  /**
   * 获取收藏栏显示状态
   * 默认显示（true）
   */
  ipcMain.handle('bookmarks-bar:get-visibility', async (event) => {
    assertTrustedSender(event);
    return { visible: configStore.get('bookmarksBar.visible', true) };
  });

  // ==================== 操作确认 IPC 处理器 ====================

  /**
   * 用户确认高风险操作
   * 渲染进程确认卡片点击"确认执行"时调用
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {string} actionId - 操作唯一 ID
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('action:confirm', (event, actionId) => {
    assertTrustedSender(event);
    const pending = pendingActions.get(actionId);
    if (!pending) {
      console.warn(`[Realm] action:confirm 未找到待确认操作: ${actionId}`);
      return { success: false, error: '操作不存在或已超时' };
    }
    clearTimeout(pending.timer);
    pendingActions.delete(actionId);
    pending.resolve({ confirmed: true });
    console.log(`[Realm] 操作已确认: ${actionId}`);
    return { success: true };
  });

  /**
   * 用户取消高风险操作
   * 渲染进程确认卡片点击"取消"时调用
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {string} actionId - 操作唯一 ID
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('action:cancel', (event, actionId) => {
    assertTrustedSender(event);
    const pending = pendingActions.get(actionId);
    if (!pending) {
      console.warn(`[Realm] action:cancel 未找到待确认操作: ${actionId}`);
      return { success: false, error: '操作不存在或已超时' };
    }
    clearTimeout(pending.timer);
    pendingActions.delete(actionId);
    pending.resolve({ confirmed: false, reason: 'user-cancelled' });
    console.log(`[Realm] 操作已取消: ${actionId}`);
    return { success: true };
  });

  // ==================== 脚本执行 IPC 处理器 ====================

  /**
   * 脚本执行中断控制器
   * script:execute 开始时创建新实例，script:stop 调用 abort() 中断
   * @type {AbortController|null}
   */
  let scriptAbortController = null;

  /**
   * 执行脚本：逐步调用 cdpManager.executeAction 执行每个步骤
   * 渲染进程确认脚本后调用，每步结果通过 script:step-update 实时推送
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {Object} script - 脚本对象，包含 steps 数组
   * @returns {Promise<{success: boolean, stoppedAt?: number, error?: string}>}
   */
  ipcMain.handle('script:execute', async (event, script) => {
    assertTrustedSender(event);
    // 校验脚本格式
    if (!script || !Array.isArray(script.steps) || script.steps.length === 0) {
      return { success: false, error: '脚本格式无效：缺少 steps 数组' };
    }

    // 白名单静态分析（SCRIPT-03）
    const validation = validateScriptForSteps(script);
    if (!validation.safe) {
      console.warn(`[Realm] 脚本安全检查未通过: ${validation.reason}`);
      return { success: false, error: `脚本安全检查未通过: ${validation.reason}`, blocked: true };
    }

    // 获取当前活跃标签页的 webContentsId
    const webContentsId = getActiveWebviewContentsId();
    if (!webContentsId) {
      return { success: false, error: '没有活跃的标签页' };
    }

    // 创建新的中断控制器（每次执行独立）
    scriptAbortController = new AbortController();

    console.log(`[Realm] 开始执行脚本: ${script.name || '未命名'}，共 ${script.steps.length} 步`);

    const result = await executeScript(
      script,
      webContentsId,
      // 每步状态回调 → 推送到渲染进程
      (update) => {
        event.sender.send('script:step-update', update);
      },
      scriptAbortController.signal
    );

    // 执行完成，清理中断控制器
    scriptAbortController = null;

    console.log(`[Realm] 脚本执行${result.success ? '成功' : '失败'}: ${script.name || '未命名'}`,
      result.error ? `错误: ${result.error}` : '');

    return result;
  });

  /**
   * 停止脚本执行：中断当前正在执行的脚本
   * @returns {Promise<{stopped: boolean}>}
   */
  ipcMain.handle('script:stop', (event) => {
    assertTrustedSender(event);
    if (scriptAbortController) {
      scriptAbortController.abort();
      scriptAbortController = null;
      console.log('[Realm] 脚本执行已停止');
      return { stopped: true };
    }
    return { stopped: false };
  });

  /**
   * 标签栏重排：按分组顺序重排标签页
   * 渲染进程确认分组后调用，主进程计算新顺序后通过 tab:reordered 通知渲染进程
   *
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {Object} tabOrder - 分组重排数据
   * @param {Array<{name: string, tabIds: string[]}>} tabOrder.groups - 分组数组
   * @returns {Promise<{success: boolean, groupCount?: number, tabCount?: number, message?: string}>}
   */
  ipcMain.handle('tab:reorder', (event, tabOrder) => {
    assertTrustedSender(event);
    // 校验 tabOrder 格式
    if (!tabOrder || !Array.isArray(tabOrder.groups) || tabOrder.groups.length === 0) {
      return { success: false, message: '分组数据格式无效' };
    }

    // 获取所有标签页
    const allTabs = tabManager.getTabs();
    const allTabIds = new Set(allTabs.map(t => t.id));

    // 验证所有 tabId 是否存在
    const flatOrder = [];
    for (const group of tabOrder.groups) {
      if (!group.tabIds || !Array.isArray(group.tabIds)) {
        return { success: false, message: `分组 "${group.name}" 格式无效` };
      }
      for (const tabId of group.tabIds) {
        if (!allTabIds.has(tabId)) {
          return { success: false, message: `标签页 ${tabId} 不存在` };
        }
        if (flatOrder.includes(tabId)) {
          return { success: false, message: `标签页 ${tabId} 重复出现在多个分组` };
        }
        flatOrder.push(tabId);
      }
    }

    // 构建完整顺序：分组内的标签页 + 未分组的标签页追加到末尾
    const groupedTabIds = new Set(flatOrder);
    const ungroupedTabs = allTabs.filter(t => !groupedTabIds.has(t.id));
    const fullOrder = [...flatOrder, ...ungroupedTabs.map(t => t.id)];

    // 通知渲染进程按新顺序重排标签栏 DOM
    event.sender.send('tab:reordered', {
      groups: tabOrder.groups,
      flatOrder: fullOrder,
    });

    console.log(`[Realm] 标签栏重排: ${tabOrder.groups.length} 个分组, ${flatOrder.length} 个标签页`);

    return {
      success: true,
      groupCount: tabOrder.groups.length,
      tabCount: flatOrder.length,
    };
  });

  /**
   * Tab 拖拽排序：渲染进程拖拽完成后调用，按新顺序重排
   *
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {string[]} orderedIds - 排好序的 Tab ID 数组
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  ipcMain.handle('tab:dnd-reorder', (event, orderedIds) => {
    assertTrustedSender(event);

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return { success: false, message: '标签页顺序数据无效' };
    }

    const success = tabManager.reorderTabs(orderedIds);
    if (!success) {
      return { success: false, message: '标签页重排失败（数据校验未通过）' };
    }

    // 广播新顺序到所有窗口（多窗口同步）
    windowManager.broadcast('tab:reordered', {
      groups: [],
      flatOrder: orderedIds,
    });

    return { success: true };
  });

  // 初始化历史记录数据库
  historyManager.initDatabase();

  // 初始化下载管理器数据库
  downloadManager.initDatabase();

  // 初始化凭据管理器数据库
  credentialManager.initDatabase();

  // 初始化地址管理器数据库
  addressManager.initDatabase();

  // 初始化收藏夹数据库
  favoritesManager.initDatabase();
  favoritesManager.migrateToGlobal();

  // 初始化常用网站数据库
  frequentSitesManager.initDatabase();

  // 初始化开发者模式模块
  cdpManager.init(configStore);
  devRequestsWriter.init();
  cdpManager.setWriter(devRequestsWriter);

  // 初始化搜索管理器（per Phase 40）
  searchManager.initSearchManager(configStore);
  setSearchManager(searchManager);

  // 初始化 AI 工作区（agent 根目录）并一次性迁移旧版 AI 记忆目录
  // （必须在 aiManager 创建之前：sandbox env 与 ai-memory 新路径都依赖目录就位）
  agentWorkspace.ensureWorkspaceDir();
  agentWorkspace.migrateAiMemory();

  // 播种随包内置技能到 managed-skills（Phase 47 D-08/D-12）
  // 必须在 aiManager 创建之前 —— 否则首轮 refreshSkills() 看不到内置技能。
  // 同步调用、不 await：与上面两行同款同步 fs 语义；失败仅告警不阻断启动。
  builtinSkillsSeeder.seedBuiltinSkills();

  // 初始化 AI Manager（per Phase 19）
  aiManager = new AIManager();
  // 技能导入临时区残留清扫（Phase 51 D-02 的崩溃兜底）：**只删 mtime 早于 2 × TTL** 的
  // `skill-import-*` / `skill-replace-*` 残留 —— 陈旧性判据是硬要求，否则并发实例
  // （dev / debug 共享 userData 且无单实例锁）会互删对方**正在预览**的包（WR-05 的形态）。
  // 不 await、失败只告警：清扫不得阻塞启动。
  aiManager.sweepSkillImports({ mode: 'stale' }).catch((err) => {
    console.warn('[Realm AI] 启动清扫技能导入残留失败:', err && err.message ? err.message : err);
  });
  // 注入操作确认通道（pendingActions 方案）：ai-manager 的高风险操作确认
  // 统一走本模块的 requestActionConfirmation，与渲染端 action:confirm/cancel 对接
  AIManager.setActionConfirmationHandler(requestActionConfirmation);
  aiManager.init(configStore).then(() => {
    // 初始化完成后注入 IPC 处理器，使 AI IPC 通道可正常工作
    setAIManager(aiManager);
  }).catch(err => {
    console.error('[Realm AI] 初始化失败:', err.message);
  });

  // 清理孤儿 Partitions 目录（必须在 initContainers 之前：
  // 此时被删容器的 partition session 尚未创建，目录无句柄占用，
  // 运行中删除失败的残留由这里兜底，下次启动必定清干净）
  const configuredIds = configStore.get('containers', DEFAULT_CONTAINERS).map(c => c.id);
  cookieManager.cleanupOrphanPartitions(configuredIds);

  // 初始化容器
  containerManager.initContainers();

  // 为每个容器注册下载事件处理器（will-download）
  const { session } = require('electron');
  const containersForDownload = containerManager.getContainers();
  for (const container of containersForDownload) {
    const ses = session.fromPartition(`persist:container-${container.id}`);
    downloadManager.registerSessionDownloadHandler(ses, container.id);
  }

  // 迁移旧版 Cookie 文件到新版容器目录
  cookieManager.migrateLegacyCookies();

  // 加载所有容器的 Cookie
  await cookieManager.loadAllCookies();

  // 初始化规则管理器
  assignmentRules.initRules();

  // 初始化 Tab 管理器
  tabManager.initTabs();

  // ==================== 窗口关闭级联 + 活跃任务确认（Phase 35） ====================

  /**
   * 检测窗口内是否有活跃任务（活跃下载或媒体播放）
   * @param {number} windowId - 窗口 ID
   * @returns {{ hasActive: boolean, taskList: Array<{type: string, detail: string}> }}
   */
  function checkActiveTasks(windowId) {
    const taskList = [];

    // 检测活跃下载（per D-17）
    try {
      const activeDownloads = downloadManager.getActiveDownloads
        ? downloadManager.getActiveDownloads()
        : [];
      if (Array.isArray(activeDownloads) && activeDownloads.length > 0) {
        for (const dl of activeDownloads) {
          taskList.push({
            type: 'download',
            detail: dl.filename || dl.url || '未知文件',
          });
        }
      }
    } catch (err) {
      console.warn('[Realm] 检测活跃下载失败:', err.message);
    }

    return {
      hasActive: taskList.length > 0,
      taskList,
    };
  }

  /**
   * 设置窗口关闭事件处理器（Phase 35 D-15, D-16, D-17）
   *
   * 使用 closing 标志位防止重入（Pitfall 1）：
   * win.close() → close 事件 → win.destroy() 会递归触发 close，
   * 标志位确保第二次进入时直接放行。
   *
   * @param {Electron.BrowserWindow} win - 窗口实例
   */
  /**
   * 设置窗口位置持久化追踪
   * 监听窗口的 moved 和 resized 事件，实时保存窗口位置
   * @param {Electron.BrowserWindow} win - 窗口实例
   * @param {string} containerId - 容器 ID
   */
  function setupWindowBoundsTracking(win, containerId) {
    // 使用 throttle 避免拖拽时过于频繁的写入
    let saveTimeout = null;
    const throttledSave = () => {
      if (saveTimeout) return;
      saveTimeout = setTimeout(() => {
        saveTimeout = null;
        windowManager.saveWindowBounds(win.id, containerId);
      }, 200);
    };

    win.on('moved', throttledSave);
    win.on('resized', throttledSave);
  }

  function setupWindowCloseHandler(win) {
    let closing = false;

    win.on('close', async (e) => {
      // quitting 模式下跳过确认，直接关闭（退出流程已有自己的确认机制）
      if (quitting || closing) {
        closing = true;
        return;
      }

      // 检测活跃任务
      const { hasActive, taskList } = checkActiveTasks(win.id);

      if (!hasActive) {
        // 无活跃任务：直接关闭
        closing = true;
        // 级联关闭 Tab
        windowManager.closeWindowWithTabs(win.id, tabManager);
        e.preventDefault();
        // win.destroy() 已在 closeWindowWithTabs 中调用
        return;
      }

      // 有活跃任务：弹出确认对话框（per D-15）
      e.preventDefault();

      const taskDescription = taskList
        .map(t => {
          if (t.type === 'download') return `- 下载中: ${t.detail}`;
          return `- ${t.type}: ${t.detail}`;
        })
        .join('\n');

      const result = await dialog.showMessageBox(win, {
        type: 'warning',
        title: '确认关闭',
        message: '窗口中有正在执行的任务',
        detail: `${taskDescription}\n\n关闭窗口将中断这些任务。`,
        buttons: ['关闭', '取消'],
        defaultId: 1, // 取消是安全默认
        cancelId: 1,
        noLink: true,
      });

      if (result.response === 0) {
        // 用户选择关闭
        closing = true;
        windowManager.closeWindowWithTabs(win.id, tabManager);
        // closeWindowWithTabs 内部调用 win.destroy()，不需要再调用 win.close()
      }
      // 用户选择取消：什么都不做，窗口保持打开
    });
  }

  // 经 windowManager 注入：所有 createMainWindow 出口（启动主窗口、Cmd+N、
  // 菜单/Dock 新建、拖出新窗口、tab:open-in-new-window）统一挂载关闭处理器
  windowManager.setWindowCloseSetup(setupWindowCloseHandler);

  // 新增 IPC 通道：渲染进程查询本窗口是否有活跃媒体播放
  ipcMain.handle('window:check-active-tasks', (event) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { hasActive: false, taskList: [] };
    return checkActiveTasks(win.id);
  });

  // ==================== macOS Dock 菜单（Phase 34 Plan 03, MW-01） ====================
  const dockMenu = Menu.buildFromTemplate([
    {
      label: '新建窗口',
      click: () => {
        const defaultContainer = containerManager.getContainer('default');
        windowManager.createMainWindow('default', defaultContainer, { offsetPosition: true });
      },
    },
  ]);
  app.dock.setMenu(dockMenu);

  // 获取默认容器并创建主窗口
  const defaultContainer = containerManager.getContainer('default');

  // 初始化主题设置（影响 DevTools 主题）
  const initTheme = configStore.get('settings.theme', 'light');
  if (initTheme === 'system') {
    nativeTheme.themeSource = 'system';
  } else if (initTheme === 'dark') {
    nativeTheme.themeSource = 'dark';
  } else {
    nativeTheme.themeSource = 'light';
  }

  // 先注册快捷键（设置 web-contents-created 监听器）
  // 再创建主窗口（此时监听器已就绪，主窗口 webContents 会被自动挂载 attachInputListener）
  shortcutManager.registerShortcuts();
  const mainWindow = windowManager.createMainWindow('default', defaultContainer);

  // 多窗口迁移：历史 windowId=null 及失效窗口的 Tab 归属主窗口（36-UAT 问题 8 关联修复）
  // 关闭处理器已由 windowManager.setWindowCloseSetup 在 createMainWindow 内统一挂载
  if (mainWindow) {
    tabManager.migrateWindowlessTabs(mainWindow.id, new Set([mainWindow.id]));
    // 窗口位置持久化（Phase 36 Plan 01）
    setupWindowBoundsTracking(mainWindow, 'default');
  }

  // 调试环境启动即打开主窗口 DevTools（停靠右侧，调试 realmAPI/mediaAPI）
  if (mainWindow && process.env.NODE_ENV === 'debug') {
    mainWindow.webContents.openDevTools();
  }

  // 应用菜单：覆盖 Electron 默认的 Cmd+Option+I 行为，
  // 将 DevTools 打开到当前聚焦的 webview guest 而非主窗口
  const appMenu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        {
          label: '新建窗口',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const defaultContainer = containerManager.getContainer('default');
            windowManager.createMainWindow('default', defaultContainer, { offsetPosition: true });
          },
        },
        {
          label: '关闭窗口',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (focused) focused.close();
          },
        },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'zoom' },
        // 注意：不要加 { role: 'close' }——其默认 accelerator 是 CmdOrCtrl+W，
        // 与 shortcut-manager 的 closeTab（Cmd+W 关闭当前标签）冲突。before-input-event
        // 未拦截住的按键会漏进菜单，触发关闭整个窗口而非当前标签
      ],
    },
    {
      label: '开发者',
      submenu: [
        {
          // 主窗口 DevTools（realmAPI/mediaAPI 等渲染层调试入口）
          // ⌘⌥I 与 Chrome 习惯一致：默认打开应用主窗口
          label: '切换主窗口开发者工具',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: () => {
            const win = windowManager.getMainWindow();
            if (!win || win.isDestroyed()) return;
            if (win.webContents.isDevToolsOpened()) {
              win.webContents.closeDevTools();
            } else {
              win.webContents.openDevTools();
            }
          },
        },
        {
          // webview 网页内容的 DevTools（调试页面本身）
          label: '切换网页开发者工具',
          accelerator: 'CmdOrCtrl+Shift+Alt+I',
          click: () => {
            const contentsId = getActiveWebviewContentsId();
            if (!contentsId) return;
            const { webContents } = require('electron');
            const contents = webContents.fromId(contentsId);
            if (!contents || contents.isDestroyed()) return;
            if (contents.isDevToolsOpened()) {
              contents.closeDevTools();
            } else {
              contents.openDevTools();
            }
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(appMenu);

  // macOS 应用激活事件（Phase 34 Plan 03, Pitfall MW-7: hasVisibleWindows）
  app.on('activate', (event, hasVisibleWindows) => {
    // 退出流程中禁止重建窗口：macOS 在退出关闭最后窗口时可能触发 activate，
    // 此时重建窗口会打断 quit 序列，导致「关窗代替退出」
    if (quitting || cookiesSaved) return;

    if (!hasVisibleWindows) {
      const allWindows = BrowserWindow.getAllWindows();
      if (allWindows.length > 0) {
        // 有最小化窗口：恢复第一个
        const first = allWindows[0];
        if (first.isMinimized()) first.restore();
        first.focus();
      } else {
        // 无窗口：创建新窗口
        const defaultContainer = containerManager.getContainer('default');
        shortcutManager.registerShortcuts();
        const mainWindow = windowManager.createMainWindow('default', defaultContainer);
        if (mainWindow) {
          tabManager.migrateWindowlessTabs(mainWindow.id, new Set([mainWindow.id]));
          setupWindowBoundsTracking(mainWindow, 'default');
        }
      }
    }
    // hasVisibleWindows === true: macOS 自动处理焦点切换，无需操作
  });
});

// 处理外部链接通过 realm:// 协议打开（SETT-03）
app.on('open-url', (event, url) => {
  event.preventDefault();
  // 获取当前活动窗口；无聚焦窗口（macOS 后台唤起等场景）时回落主窗口，
  // 避免链接被静默丢弃
  const focusedWindow = BrowserWindow.getFocusedWindow() || windowManager.getMainWindow();
  if (focusedWindow) {
    // 默认容器设置：'last-used' 在当前容器打开；固定容器 id 在指定容器打开
    const settings = configStore.get('settings', {});
    const defaultContainer = settings.defaultContainer || 'last-used';
    // 发送 URL 到渲染进程，在新 Tab 中打开
    focusedWindow.webContents.send('open-external-url', {
      url,
      containerId: defaultContainer === 'last-used' ? null : defaultContainer,
    });
  }
});

// 所有窗口关闭事件
// macOS 上也直接退出（不保留后台），因为 Realm 浏览器不需要"关闭窗口后保留在 Dock"的行为
app.on('window-all-closed', () => {
  console.log('[Realm] window-all-closed, quitting:', quitting, 'cookiesSaved:', cookiesSaved);
  app.quit();
});

// 应用退出前保存所有容器的 Cookie（WR-6）
// before-quit 不会等待 async handler 返回，必须先 preventDefault 阻止退出，
// 待 Cookie 写盘完成后再显式 app.quit()，避免退出竞态导致数据丢失
//
// 双击确认退出：第一次 Cmd+Q 只提示（渲染进程 Toast），
// QUIT_CONFIRM_WINDOW_MS 内再次按下才真正进入退出流程
let cookiesSaved = false;
let quitting = false;
// D-19 退出确认已通过标志：确认后重入 before-quit 不再重复弹窗
let quitConfirmed = false;
let quitConfirmAt = 0;
const QUIT_CONFIRM_WINDOW_MS = 3000;

app.on('before-quit', async (event) => {
  if (cookiesSaved) return;
  event.preventDefault();

  // 已在保存流程中（ quit 重入）：直接拦截，等待保存完成后自动退出
  if (quitting) return;

  // 确认窗口期外的第一次按下：仅提示，不退出
  const now = Date.now();
  if (now - quitConfirmAt > QUIT_CONFIRM_WINDOW_MS) {
    quitConfirmAt = now;
    windowManager.broadcast('show-quit-hint');
    console.log('[Realm] 退出确认：再次按下 Cmd+Q 退出');
    return;
  }

  // 窗口期内第二次按下：进入退出流程
  quitting = true;
  console.log('[Realm] 应用退出，保存 Cookie...');

  // Phase 44 D-19：应用退出遇活跃录制任务弹确认（在 Cookie 保存之前）。
  // 确认后 quitConfirmed 置位，照常走下方既有退出协程（窗口关闭 → 录制随进程
  // 终止 → 下次启动 restoreTasks 标记 interrupted，D-18 崩溃语义兜底）；取消则
  // 解除退出锁留在应用。不额外 setImmediate(app.quit()) 重启 quit——直接续走
  // 本协程末尾既有的 setImmediate(() => app.quit()) 跳出模式
  if (!quitConfirmed && mediaTaskManager && mediaTaskManager.hasActiveTasks()) {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['退出', '取消'],
      defaultId: 0,
      cancelId: 1,
      message: '有正在进行的录制任务，退出将中断录制。确定退出吗？',
      noLink: true,
    });
    if (response !== 0) {
      quitting = false;
      console.log('[Realm] 用户取消退出（存在活跃录制任务）');
      return;
    }
    quitConfirmed = true;
  }

  // 保存所有窗口的位置和大小（Phase 36 Plan 01）
  // 使用 BrowserWindow.getAllWindows() 遍历，避免 windowContainerMap 未导出导致 TypeError
  const allWindows = require('electron').BrowserWindow.getAllWindows();
  for (const win of allWindows) {
    const containerId = windowManager.getCurrentContainer(win.id);
    if (containerId) {
      windowManager.saveWindowBounds(win.id, containerId);
    }
  }

  // 清理开发者模式模块（执行最终 flush）
  cdpManager.cleanup();
  await devRequestsWriter.cleanup();

  try {
    await cookieManager.saveAllCookies();
  } catch (err) {
    // 保存失败时解除退出锁，允许用户重试 Cmd+Q
    quitting = false;
    console.error('[Realm] Cookie 保存失败，退出已取消:', err);
    return;
  }

  // 退出前物理删除孤儿 Partitions 目录（container-delete-partitions 收尾）：
  // 运行中删除会被存活 session 的网络服务组件刷盘重建（HTTP 缓存索引、
  // Network Persistent State 等，无法用开关禁用）——这是 Chromium 架构限制。
  // 此处紧随 app.quit()，网络服务进程终止后删除即永久，不会再被重建。
  const configuredIds = configStore.get('containers', DEFAULT_CONTAINERS).map(c => c.id);
  cookieManager.cleanupOrphanPartitions(configuredIds);

  // 技能导入临时区：只删**本进程 Map 里登记**的目录（own）—— 精确、无跨实例风险。
  // 退出序列里追加一行即可，不新开 handler（Phase 51 D-02）。
  if (aiManager) {
    await aiManager.sweepSkillImports({ mode: 'own' }).catch(() => {});
  }

  cookiesSaved = true;
  console.log('[Realm] Cookie 保存完成，请求退出 (app.quit)');
  // setImmediate 跳出 before-quit 异步续体上下文：
  // 在 preventDefault 后的同一个 async handler 里直接 app.quit()，
  // quit 序列会在 window-all-closed 后停滞（will-quit 不触发），
  // 推迟到下一轮事件循环调用可正常完成退出
  setImmediate(() => app.quit());
});

// 应用退出时注销所有全局快捷键
app.on('will-quit', () => {
  console.log('[Realm] will-quit');
  shortcutManager.unregisterAll();
});

// 日志输出
console.log('[Realm] 主进程已加载');

// ==================== 模块导出 ====================

/**
 * 模块导出：供后续 Phase（20/21）通过 require('./main') 访问共享实例
 * aiManager: AI Manager 实例，在 app.whenReady 中初始化
 * requestActionConfirmation: 发起高风险操作确认请求（供 AI Manager 调用）
 */
module.exports = { aiManager, requestActionConfirmation, downloadManager };

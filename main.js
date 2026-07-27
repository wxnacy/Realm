/**
 * Realm Browser - 主进程入口
 *
 * 应用生命周期管理，模块组装
 */

// 热重载配置（仅开发模式）
try { require('electron-reloader')(module); } catch {}

const path = require('path');
const { app, BrowserWindow, protocol, net, ipcMain, Menu, dialog } = require('electron');
const { pathToFileURL } = require('url');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

// 环境隔离：开发环境使用独立的 userData 目录
if (process.env.NODE_ENV === 'development') {
  app.setName('realm-dev');
}

const Store = require('electron-store');
const containerManager = require('./container-manager');

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

// 配置存储（whenReady 启动清理与 before-quit 退出清理共用）
const configStore = new Store({ name: 'realm-config' });
const windowManager = require('./window-manager');
const tabManager = require('./tab-manager');
const cookieManager = require('./cookie-manager');
const assignmentRules = require('./assignment-rules');
const shortcutManager = require('./shortcut-manager');
const { registerHandlers, getActiveWebviewContentsId } = require('./ipc-handlers');
const historyManager = require('./history-manager');
const favoritesManager = require('./favorites-manager');
const frequentSitesManager = require('./frequent-sites-manager');
const cdpManager = require('./cdp-manager');
const devRequestsWriter = require('./dev-requests-writer');

// ==================== webview guest 拦截（WR-1/WR-2/WR-9） ====================

/**
 * URL scheme 白名单：仅 http/https 允许加载/新建 Tab（WR-9）
 * guest 侧提供的 URL（window.open、导航）一律先过此白名单
 * @param {string} url - 待校验的 URL
 * @returns {boolean} 是否允许
 */
function isAllowedWebUrl(url) {
  return typeof url === 'string' && (/^https?:\/\//i.test(url) || /^realm:\/\//i.test(url));
}

/**
 * 从 webview guest 的 webContents 反推其所在容器 ID
 * 渲染进程创建 webview 时统一设置 partition 为 persist:container-<containerId>
 * @param {Electron.WebContents} contents - guest webContents
 * @returns {string|null} 容器 ID，无法识别时返回 null
 */
function getGuestContainerId(contents) {
  // 尝试从 session 获取 partition
  let partition = '';
  try {
    if (contents.session && typeof contents.session.getPartition === 'function') {
      partition = contents.session.getPartition();
    }
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
 *   由渲染进程按来源 webview 的 partition 决定容器——Electron 32 下 guest 的
 *   session.getPartition() 返回空串，主进程无法可靠反推）
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
  if (contents.getType() !== 'webview') return;

  console.log(`[Realm] webview webContents 创建, id: ${contents.id}`);
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
    if (isMainFrame) {
      const containerId = getGuestContainerId(contents);
      if (containerId) {
        cdpManager.handleNavigation(contents, url, containerId);
      }
    }
  });

  contents.on('did-navigate', (event, url) => {
    console.log(`[Realm] webview 导航完成: ${url}`);
  });

  contents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    console.log(`[Realm] did-navigate-in-page: ${url}, isMainFrame: ${isMainFrame}`);
  });

  // webview 右键上下文菜单：提供"检查元素"直接打开该 webview 的 DevTools
  contents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { label: '检查元素', click: () => contents.openDevTools() },
      { type: 'separator' },
      { label: '后退', enabled: contents.canGoBack(), click: () => contents.goBack() },
      { label: '前进', enabled: contents.canGoForward(), click: () => contents.goForward() },
      { type: 'separator' },
      { label: '刷新', click: () => contents.reload() },
      { label: '复制', role: 'copy', enabled: params.selectionText.length > 0 },
    ]);
    menu.popup();
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

    const currentContainer = getGuestContainerId(contents);
    console.log(`[Realm] 当前容器: ${currentContainer}, 检查规则匹配...`);
    const matchedContainer = assignmentRules.matchUrl(url);
    console.log(`[Realm] 匹配结果: ${matchedContainer || '无匹配'}`);

    // 无论是否匹配，只要规则匹配就创建新 Tab
    if (matchedContainer) {
      event.preventDefault();
      console.log(`[Realm] 规则匹配成功: ${url} -> ${matchedContainer}`);
      notifyOpenUrlInTab(contents, url, matchedContainer);
    }
  });
});

// ==================== 应用启动 ====================

app.whenReady().then(async () => {
  console.log('[Realm] 应用启动');

  // macOS Dock 图标：dev 模式下 electron 不会读 package.json build.mac.icon，
  // 需要用 nativeImage 显式覆盖；打包后 Info.plist 已声明，重复设置无副作用
  if (process.platform === 'darwin') {
    const { nativeImage } = require('electron');
    const iconPath = path.join(__dirname, 'icons/icon.png');
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
  const REALM_TOKEN = crypto.randomUUID();
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

  /**
   * 发送 JSON 响应
   * @param {http.ServerResponse} res - 响应对象
   * @param {number} status - HTTP 状态码
   * @param {*} data - 响应数据
   */
  function sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  /**
   * 读取并解析 POST 请求的 JSON body
   * @param {http.IncomingMessage} req - 请求对象
   * @returns {Promise<Object>} 解析后的 body
   */
  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
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
        const { containerId, id } = await readJsonBody(req);
        sendJson(res, 200, historyManager.deleteRecord(containerId, id));
        return;
      }

      if (route === 'delete-batch' && req.method === 'POST') {
        const { containerId, ids } = await readJsonBody(req);
        sendJson(res, 200, historyManager.deleteRecords(containerId, ids));
        return;
      }

      if (route === 'clear' && req.method === 'POST') {
        const { containerId } = await readJsonBody(req);
        sendJson(res, 200, historyManager.clearRecords(containerId));
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 历史 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
  }

  /**
   * 处理 /api/favorites/* 收藏夹 API 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {URL} reqUrl - 解析后的请求 URL
   */
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
        sendJson(res, 200, favoritesManager.listRecords({ offset, limit }));
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
        const { url, title, faviconUrl } = await readJsonBody(req);
        sendJson(res, 200, favoritesManager.addRecord({ url, title, faviconUrl }));
        return;
      }

      if (route === 'update' && req.method === 'POST') {
        const { id, title } = await readJsonBody(req);
        sendJson(res, 200, favoritesManager.updateRecord(id, { title }));
        return;
      }

      if (route === 'delete' && req.method === 'POST') {
        const { id } = await readJsonBody(req);
        sendJson(res, 200, favoritesManager.deleteRecord(id));
        return;
      }

      if (route === 'delete-batch' && req.method === 'POST') {
        const { ids } = await readJsonBody(req);
        sendJson(res, 200, favoritesManager.deleteRecords(ids));
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
    realmIconBuffer = fs.readFileSync(path.join(__dirname, 'icons', 'icon.png'));
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
        });
        sendJson(res, 200, settings);
        return;
      }

      if (route === 'update' && req.method === 'POST') {
        const updates = await readJsonBody(req);
        for (const [key, value] of Object.entries(updates)) {
          configStore.set(`settings.${key}`, value);
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

      if (route === 'set-default-browser' && req.method === 'POST') {
        // 注册 http/https 会触发 macOS 系统确认弹框（用户确认后才真正生效）
        const httpOk = app.setAsDefaultProtocolClient('http');
        const httpsOk = app.setAsDefaultProtocolClient('https');
        sendJson(res, 200, { success: httpOk && httpsOk });
        return;
      }

      if (route === 'open-url' && req.method === 'POST') {
        const { url } = await readJsonBody(req);
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
        const { enabled } = await readJsonBody(req);
        cdpManager.setEnabled(!!enabled);
        sendJson(res, 200, { success: true });
        return;
      }

      if (route === 'add-devdomain' && req.method === 'POST') {
        const { domain } = await readJsonBody(req);
        const result = cdpManager.addDomain(domain);
        sendJson(res, result.success ? 200 : 400, result);
        return;
      }

      if (route === 'remove-devdomain' && req.method === 'POST') {
        const { domain } = await readJsonBody(req);
        const result = cdpManager.removeDomain(domain);
        sendJson(res, result.success ? 200 : 400, result);
        return;
      }

      if (route === 'set-dev-retention' && req.method === 'POST') {
        const { days } = await readJsonBody(req);
        cdpManager.setRetentionDays(days);
        sendJson(res, 200, { success: true });
        return;
      }

      if (route === 'devqueue-stats' && req.method === 'GET') {
        sendJson(res, 200, cdpManager.getQueueStats());
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('[Realm] 设置 API 处理失败:', err.message);
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
        const { containerId, pattern } = await readJsonBody(req);
        const result = assignmentRules.createRule(containerId, pattern);
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update' && req.method === 'POST') {
        const { ruleId, updates } = await readJsonBody(req);
        const result = assignmentRules.updateRule(ruleId, updates);
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete' && req.method === 'POST') {
        const { ruleId } = await readJsonBody(req);
        const result = assignmentRules.deleteRule(ruleId);
        sendJson(res, 200, result);
        return;
      }

      if (route === 'reorder' && req.method === 'POST') {
        const { orderedIds } = await readJsonBody(req);
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
        const payload = await readJsonBody(req);
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
        const { action, accelerator } = await readJsonBody(req);
        const result = shortcutManager.setShortcut(action, accelerator);
        if (result) {
          const win = windowManager.getMainWindow();
          shortcutManager.rebuildShortcuts(win);
        }
        sendJson(res, 200, { success: result });
        return;
      }

      if (route === 'reset' && req.method === 'POST') {
        const { action } = await readJsonBody(req);
        const result = shortcutManager.resetShortcut(action);
        if (result) {
          const win = windowManager.getMainWindow();
          shortcutManager.rebuildShortcuts(win);
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

  const realmServer = http.createServer((req, res) => {
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
    } else {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // 安全检查：防止路径遍历
    if (!filePath.startsWith(path.join(__dirname, 'src'))) {
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
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  // 在随机可用端口启动服务器
  realmServer.listen(0, '127.0.0.1', () => {
    const realmPort = realmServer.address().port;
    console.log(`[Realm] 内部页面服务器已启动: http://localhost:${realmPort}`);

    // 暴露端口和 API token 给渲染进程（token 用于内部页面调用 /api/history/*）
    ipcMain.handle('get-realm-port', () => ({ port: realmPort, token: REALM_TOKEN }));
  });

  // 注册 IPC 处理器
  registerHandlers();

  // 初始化历史记录数据库
  historyManager.initDatabase();

  // 初始化收藏夹数据库
  favoritesManager.initDatabase();
  favoritesManager.migrateToGlobal();

  // 初始化常用网站数据库
  frequentSitesManager.initDatabase();

  // 初始化开发者模式模块
  cdpManager.init(configStore);
  devRequestsWriter.init();
  cdpManager.setWriter(devRequestsWriter);

  // 清理孤儿 Partitions 目录（必须在 initContainers 之前：
  // 此时被删容器的 partition session 尚未创建，目录无句柄占用，
  // 运行中删除失败的残留由这里兜底，下次启动必定清干净）
  const configuredIds = configStore.get('containers', []).map(c => c.id);
  cookieManager.cleanupOrphanPartitions(configuredIds);

  // 初始化容器
  containerManager.initContainers();

  // 迁移旧版 Cookie 文件到新版容器目录
  cookieManager.migrateLegacyCookies();

  // 加载所有容器的 Cookie
  await cookieManager.loadAllCookies();

  // 初始化规则管理器
  assignmentRules.initRules();

  // 初始化 Tab 管理器
  tabManager.initTabs();

  // 获取默认容器并创建主窗口
  const defaultContainer = containerManager.getContainer('default');
  const mainWindow = windowManager.createMainWindow('default', defaultContainer);

  // 注册全局快捷键
  if (mainWindow) {
    shortcutManager.registerShortcuts(mainWindow);
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
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
    {
      label: '开发者',
      submenu: [
        {
          label: '切换开发者工具',
          accelerator: 'CmdOrCtrl+Alt+I',
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

  // macOS 应用激活事件
  app.on('activate', () => {
    // 退出流程中禁止重建窗口：macOS 在退出关闭最后窗口时可能触发 activate，
    // 此时重建窗口会打断 quit 序列，导致「关窗代替退出」
    if (quitting || cookiesSaved) return;
    if (BrowserWindow.getAllWindows().length === 0) {
      const defaultContainer = containerManager.getContainer('default');
      const mainWindow = windowManager.createMainWindow('default', defaultContainer);
      if (mainWindow) {
        // 重建窗口后重新注册快捷键（Menu Accelerator 无需手动注销旧菜单，
        // registerShortcuts 会直接替换整个 Application Menu）
        shortcutManager.registerShortcuts(mainWindow);
      }
    }
  });
});

// 处理外部链接通过 realm:// 协议打开（SETT-03）
app.on('open-url', (event, url) => {
  event.preventDefault();
  // 获取当前活动窗口
  const focusedWindow = BrowserWindow.getFocusedWindow();
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
app.on('window-all-closed', () => {
  console.log('[Realm] window-all-closed, quitting:', quitting, 'cookiesSaved:', cookiesSaved);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前保存所有容器的 Cookie（WR-6）
// before-quit 不会等待 async handler 返回，必须先 preventDefault 阻止退出，
// 待 Cookie 写盘完成后再显式 app.quit()，避免退出竞态导致数据丢失
//
// 双击确认退出：第一次 Cmd+Q 只提示（渲染进程 Toast），
// QUIT_CONFIRM_WINDOW_MS 内再次按下才真正进入退出流程
let cookiesSaved = false;
let quitting = false;
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
    const win = windowManager.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('show-quit-hint');
    }
    console.log('[Realm] 退出确认：再次按下 Cmd+Q 退出');
    return;
  }

  // 窗口期内第二次按下：进入退出流程
  quitting = true;
  console.log('[Realm] 应用退出，保存 Cookie...');

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
  const configuredIds = configStore.get('containers', []).map(c => c.id);
  cookieManager.cleanupOrphanPartitions(configuredIds);

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

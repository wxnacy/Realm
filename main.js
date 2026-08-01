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

// 配置存储（whenReady 启动清理与 before-quit 退出清理共用）
const configStore = new Store({ name: 'realm-config' });
const windowManager = require('./window-manager');
const tabManager = require('./tab-manager');
const cookieManager = require('./cookie-manager');
const assignmentRules = require('./assignment-rules');
const shortcutManager = require('./shortcut-manager');
const { registerHandlers, getActiveWebviewContentsId, getGuestContainer, unregisterGuestContainer, setAIManager } = require('./ipc-handlers');
const historyManager = require('./history-manager');
const favoritesManager = require('./favorites-manager');
const faviconFetcher = require('./favicon-fetcher');
const frequentSitesManager = require('./frequent-sites-manager');
const cdpManager = require('./cdp-manager');
const devRequestsWriter = require('./dev-requests-writer');
const AIManager = require('./ai-manager');

// AI Manager 实例（在 app.whenReady 中初始化，供后续 Phase 通过 require('./main').aiManager 访问）
let aiManager = null;

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
  if (contents.getType() !== 'webview') return;

  console.log(`[Realm] webview webContents 创建, id: ${contents.id}`);

  // guest 销毁时清理容器映射，避免 Map 泄漏
  contents.on('destroyed', () => {
    unregisterGuestContainer(contents.id);
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
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bookmarks-bar:refresh');
    }
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
        const { url, title, faviconUrl: rawFaviconUrl } = await readJsonBody(req);
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
        const { id, title } = await readJsonBody(req);
        const result = favoritesManager.updateRecord(id, { title });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete' && req.method === 'POST') {
        const { id } = await readJsonBody(req);
        const result = favoritesManager.deleteRecord(id);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete-batch' && req.method === 'POST') {
        const { ids } = await readJsonBody(req);
        const result = favoritesManager.deleteRecords(ids);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      // ==================== 收藏夹文件夹 API ====================

      if (route === 'create-folder' && req.method === 'POST') {
        const { name, parentId } = await readJsonBody(req);
        const result = favoritesManager.createFolder({ name, parentId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'rename-folder' && req.method === 'POST') {
        const { id, name } = await readJsonBody(req);
        const result = favoritesManager.renameFolder(id, { name });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'delete-folder' && req.method === 'POST') {
        const { id } = await readJsonBody(req);
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
        const { id, parentId } = await readJsonBody(req);
        const result = favoritesManager.moveFolder(id, { parentId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'move-favorite' && req.method === 'POST') {
        const { id, folderId } = await readJsonBody(req);
        const result = favoritesManager.moveFavorite(id, { folderId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'move-favorites' && req.method === 'POST') {
        const { ids, folderId } = await readJsonBody(req);
        const result = favoritesManager.moveFavorites(ids, { folderId });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update-folder-sort' && req.method === 'POST') {
        const { id, sortOrder } = await readJsonBody(req);
        const result = favoritesManager.updateFolderSort(id, { sortOrder });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update-favorite-sort' && req.method === 'POST') {
        const { id, sortOrder } = await readJsonBody(req);
        const result = favoritesManager.updateFavoriteSort(id, { sortOrder });
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'compute-sort-keys' && req.method === 'POST') {
        const { beforeKey, afterKey, count } = await readJsonBody(req);
        const { generateNKeysBetween } = require('./vendor/fractional-indexing');
        const keys = generateNKeysBetween(beforeKey, afterKey, count);
        sendJson(res, 200, { keys });
        return;
      }

      if (route === 'update-batch-sort' && req.method === 'POST') {
        const { items } = await readJsonBody(req);
        const result = favoritesManager.batchUpdateSort(items);
        _notifyBookmarksBarRefresh();
        sendJson(res, 200, result);
        return;
      }

      if (route === 'update-batch-folder-sort' && req.method === 'POST') {
        const { folders } = await readJsonBody(req);
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
      if (route === 'import-chrome' && req.method === 'POST') {
        const { filePath, content } = await readJsonBody(req);
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
      if (route === 'import-html' && req.method === 'POST') {
        const { filePath, content, mode } = await readJsonBody(req);

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
        // 合并收藏栏显示状态：优先读取 settings.bookmarksBar.visible（设置页面写入），
        // 不存在时回退到根路径 bookmarksBar.visible（主进程早期代码写入）
        const fromSettings = configStore.get('settings.bookmarksBar.visible');
        settings.bookmarksBar = {
          visible: fromSettings !== undefined ? fromSettings : configStore.get('bookmarksBar.visible', true),
        };
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

      if (route === 'version' && req.method === 'GET') {
        sendJson(res, 200, { version: app.getVersion() });
        return;
      }

      if (route === 'icon' && req.method === 'GET') {
        const iconPath = path.join(__dirname, 'icons', 'icon.png');
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

        const result = devRequestsWriter.queryRecords(containerId, {
          offset,
          limit,
          url: search || undefined,
          method: method || undefined,
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
        const { containerId, id } = await readJsonBody(req);
        const result = devRequestsWriter.deleteRecord(containerId || 'default', id);
        sendJson(res, 200, result);
        return;
      }

      // POST /api/devrequests/clear — 清空容器的所有记录
      if (route === 'clear' && req.method === 'POST') {
        const { containerId } = await readJsonBody(req);
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

    // 开发者模式请求数据 API（devrequests 页面数据层）
    if (reqPath.startsWith('/api/devrequests/')) {
      handleDevRequestsApi(req, res, reqUrl);
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
        const { visible } = await readJsonBody(req);
        configStore.set('bookmarksBar.visible', !!visible);
        configStore.set('settings.bookmarksBar.visible', !!visible);
        // 通知主窗口渲染进程
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bookmarks-bar:visibility-changed', { visible: !!visible });
        }
        sendJson(res, 200, { success: true });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
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
    } else if (reqPath === '/devrequests' || reqPath === '/devrequests/') {
      filePath = path.join(__dirname, 'src', 'devrequests.html');
    } else if (/^\/devrequests\/\d+\/?$/.test(reqPath)) {
      // 详情页：/devrequests/123 → src/devrequest-detail.html（id 由页面 JS 从 path 解析）
      filePath = path.join(__dirname, 'src', 'devrequest-detail.html');
    } else if (reqPath.startsWith('/devrequests/')) {
      const subPath = reqPath.replace('/devrequests/', '');
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
   * 网页右键菜单请求
   * 渲染进程 webview context-menu 事件时发送，主进程注入容器列表和 guestContentsId
   * @param {Object} contextInfo - 上下文 { type, linkURL, srcURL, mediaType, selectionText, ... }
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
              if (!hostWebContents.isDestroyed()) {
                hostWebContents.send('bookmarks-bar:refresh');
              }
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
              if (!hostWebContents.isDestroyed()) {
                hostWebContents.send('bookmarks-bar:refresh');
              }
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
            if (!hostWebContents.isDestroyed()) {
              hostWebContents.send('bookmarks-bar:visibility-changed', { visible: false });
            }
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
    return favoritesManager.createFolder({ name, parentId });
  });

  // 重命名文件夹
  ipcMain.handle('favorites:rename-folder', async (event, { id, name }) => {
    return favoritesManager.renameFolder(id, { name });
  });

  // 删除文件夹
  ipcMain.handle('favorites:delete-folder', async (event, { id }) => {
    return favoritesManager.deleteFolder(id);
  });

  // 列出子文件夹
  ipcMain.handle('favorites:list-folders', async (event, { parentId }) => {
    return favoritesManager.listFolders(parentId);
  });

  // 获取文件夹树
  ipcMain.handle('favorites:get-folder-tree', async () => {
    return favoritesManager.getFolderTree();
  });

  // 移动文件夹
  ipcMain.handle('favorites:move-folder', async (event, { id, parentId }) => {
    return favoritesManager.moveFolder(id, { parentId });
  });

  // 移动收藏项到文件夹
  ipcMain.handle('favorites:move-favorite', async (event, { id, folderId }) => {
    return favoritesManager.moveFavorite(id, { folderId });
  });

  // 批量移动收藏项
  ipcMain.handle('favorites:move-favorites', async (event, { ids, folderId }) => {
    return favoritesManager.moveFavorites(ids, { folderId });
  });

  // 更新文件夹排序
  ipcMain.handle('favorites:update-folder-sort', async (event, { id, sortOrder }) => {
    return favoritesManager.updateFolderSort(id, { sortOrder });
  });

  // 更新收藏项排序
  ipcMain.handle('favorites:update-favorite-sort', async (event, { id, sortOrder }) => {
    return favoritesManager.updateFavoriteSort(id, { sortOrder });
  });

  // ==================== 书签导入 IPC ====================
  // 注意：currentImportAbortController / currentImportProgress 已在上方
  // HTTP 服务区声明（与 /api/favorites/* 导入端点共享），此处直接复用。

  // Chrome JSON 书签导入（per D-03, D-04, D-05, D-10, D-13）
  ipcMain.handle('favorites:import-chrome', async (event, { filePath }) => {
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) return { success: false, error: '主窗口不存在' };

    // 创建新的 AbortController
    currentImportAbortController = new AbortController();

    const onProgress = (data) => {
      currentImportProgress = data;
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('favorites:import-progress', data);
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
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) return { success: false, error: '主窗口不存在' };

    currentImportAbortController = new AbortController();

    const onProgress = (data) => {
      currentImportProgress = data;
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('favorites:import-progress', data);
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
  ipcMain.handle('favorites:import-abort', async () => {
    if (currentImportAbortController) {
      currentImportAbortController.abort();
      return { success: true };
    }
    return { success: false, message: '没有正在进行的导入操作' };
  });

  // 检测 Chrome 书签路径（per D-03）
  ipcMain.handle('favorites:detect-chrome-path', async () => {
    const chromePath = favoritesManager.detectChromeBookmarksPath();
    return { path: chromePath };
  });

  // 打开文件选择对话框（per D-04）
  ipcMain.handle('dialog:open', async (event, options) => {
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
    configStore.set('bookmarksBar.visible', visible);
    configStore.set('settings.bookmarksBar.visible', visible);
    return { success: true };
  });

  /**
   * 获取收藏栏显示状态
   * 默认显示（true）
   */
  ipcMain.handle('bookmarks-bar:get-visibility', async () => {
    return { visible: configStore.get('bookmarksBar.visible', true) };
  });

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

  // 初始化 AI Manager（per Phase 19）
  aiManager = new AIManager();
  aiManager.init(configStore).then(() => {
    // 初始化完成后注入 IPC 处理器，使 AI IPC 通道可正常工作
    setAIManager(aiManager);
  }).catch(err => {
    console.error('[Realm AI] 初始化失败:', err.message);
  });

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

// ==================== 模块导出 ====================

/**
 * 模块导出：供后续 Phase（20/21）通过 require('./main') 访问共享实例
 * aiManager: AI Manager 实例，在 app.whenReady 中初始化
 */
module.exports = { aiManager };

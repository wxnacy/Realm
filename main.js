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
const downloadManager = require('./download-manager');
const credentialManager = require('./credential-manager');
const addressManager = require('./address-manager');
const favoritesManager = require('./favorites-manager');
const faviconFetcher = require('./favicon-fetcher');
const frequentSitesManager = require('./frequent-sites-manager');
const cdpManager = require('./cdp-manager');
const uaChManager = require('./ua-ch-manager');
const mediaSniffer = require('./media-sniffer');
const devRequestsWriter = require('./dev-requests-writer');
const AIManager = require('./ai-manager');
const { executeScript, validateScriptForSteps } = require('./ai-manager');

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
    // 30 秒超时自动取消
    const timer = setTimeout(() => {
      if (pendingActions.has(actionId)) {
        pendingActions.delete(actionId);
        console.log(`[Realm] 操作确认超时，自动取消: ${actionId}`);
        // 主动过期渲染端确认卡片，避免用户点击已无效应的 pending 卡片
        windowManager.broadcast('action:settle', {
          actionId,
          state: 'cancelled',
          message: '操作确认超时，已自动取消',
        });
        resolve({ confirmed: false, reason: 'timeout' });
      }
    }, 30000);

    pendingActions.set(actionId, { resolve, timer });

    // 广播确认请求到所有渲染进程
    windowManager.broadcast('action:request-confirmation', data);
    console.log(`[Realm] 操作确认请求已广播: ${actionId}, 类型: ${data.type}, 风险: ${data.riskLevel}`);
  });
}

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

  // 伪装为普通 Chrome，避免网站针对 Electron 的 User-Agent 字符串返回差异内容。
  // 仅覆盖 UA 字符串即可：navigator.userAgentData.brands / Sec-CH-UA 请求头
  // 默认只有 GREASE 和 Chromium，本就不含 Electron 品牌（已实证，
  // 见 docs/debug/github-login-404-two-factor-app.md 第 5 节）。
  // UA 版本号（Chrome/150）须与 ua-ch-manager / onBeforeSendHeaders 的品牌表同步。
  contents.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
  );

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
    if (isMainFrame) {
      const containerId = getGuestContainerId(contents);
      if (containerId) {
        cdpManager.handleNavigation(contents, url, containerId);
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
 * （components/embedder_support/user_agent_utils.cc，tag 150.0.7871.212）：
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
    // 值 150.0.7871.212，与 JS 侧 uaFullVersion（不受 CDP 覆盖控制、恒为内核值）
    // 及 ua-ch-manager 的 fullVersionList 保持一致；品牌顺序与低熵头相同。
    // arch/bitness/platform/platform-version/model 内核取值与同机真实 Chrome 相同，
    // 无需改写。
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (lower === 'sec-ch-ua-full-version-list') {
        headers[key] =
          '"Not;A=Brand";v="8.0.0.0", "Chromium";v="150.0.7871.212", "Google Chrome";v="150.0.7871.212"';
      } else if (lower === 'sec-ch-ua-full-version') {
        headers[key] = '"150.0.7871.212"';
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
        // 多媒体播放器设置默认值（per D-03）
        if (!settings.mediaPlayer) {
          settings.mediaPlayer = { enabled: false, whitelist: [] };
        }
        sendJson(res, 200, settings);
        return;
      }

      if (route === 'update' && req.method === 'POST') {
        const updates = await readJsonBody(req);
        for (const [key, value] of Object.entries(updates)) {
          configStore.set(`settings.${key}`, value);
        }
        // 设置页在 webview 内通过 HTTP 写入，主进程需主动通知所有窗口 renderer 刷新（closing UAT gap G-29-6）
        const changedKeys = Object.keys(updates);
        windowManager.broadcast('settings:updated', changedKeys);
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

      // ==================== AI 助手 API ====================

      if (route === 'ai/state' && req.method === 'GET') {
        if (!aiManager) {
          sendJson(res, 200, { initialized: false, model: null, toolsCount: 0 });
          return;
        }
        sendJson(res, 200, aiManager.getState());
        return;
      }

      if (route === 'ai/models' && req.method === 'GET') {
        if (!aiManager) {
          sendJson(res, 200, { providers: [], activeProvider: null, activeModel: null });
          return;
        }
        sendJson(res, 200, await aiManager.getAvailableModels());
        return;
      }

      if (route === 'ai/configure' && req.method === 'POST') {
        const config = await readJsonBody(req);
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
        const { downloadId, deleteFile } = await readJsonBody(req);
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
        const { downloadId } = await readJsonBody(req);
        sendJson(res, 200, { success: downloadManager.pauseDownload(downloadId) });
        return;
      }

      // POST /api/downloads/resume — 恢复下载
      if (route === 'resume' && req.method === 'POST') {
        const { downloadId } = await readJsonBody(req);
        sendJson(res, 200, { success: downloadManager.resumeDownload(downloadId) });
        return;
      }

      // POST /api/downloads/cancel — 取消下载
      if (route === 'cancel' && req.method === 'POST') {
        const { downloadId } = await readJsonBody(req);
        sendJson(res, 200, { success: downloadManager.cancelDownload(downloadId) });
        return;
      }

      // POST /api/downloads/open — 打开文件
      if (route === 'open' && req.method === 'POST') {
        const { filePath } = await readJsonBody(req);
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
        const { filePath } = await readJsonBody(req);
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
        const { containerId, origin } = await readJsonBody(req);
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
        const { containerId, origins } = await readJsonBody(req);
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
        const { credentialId } = await readJsonBody(req);
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
        const { containerId, name, phone, address } = await readJsonBody(req);
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
        const { containerId } = await readJsonBody(req);
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
          shortcutManager.rebuildShortcuts();
        }
        sendJson(res, 200, { success: result });
        return;
      }

      if (route === 'reset' && req.method === 'POST') {
        const { action } = await readJsonBody(req);
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

    // 下载管理 JSON API（下载面板数据层）
    if (reqPath.startsWith('/api/downloads/')) {
      handleDownloadsApi(req, res, reqUrl);
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
        const { visible } = await readJsonBody(req);
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
    ipcMain.handle('get-realm-port', (event) => {
      assertTrustedSender(event);
      return { port: realmPort, token: REALM_TOKEN };
    });
  });

  // 注册 IPC 处理器
  registerHandlers();

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
    return favoritesManager.createFolder({ name, parentId });
  });

  // 重命名文件夹
  ipcMain.handle('favorites:rename-folder', async (event, { id, name }) => {
    assertTrustedSender(event);
    return favoritesManager.renameFolder(id, { name });
  });

  // 删除文件夹
  ipcMain.handle('favorites:delete-folder', async (event, { id }) => {
    assertTrustedSender(event);
    return favoritesManager.deleteFolder(id);
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
    return favoritesManager.moveFolder(id, { parentId });
  });

  // 移动收藏项到文件夹
  ipcMain.handle('favorites:move-favorite', async (event, { id, folderId }) => {
    assertTrustedSender(event);
    return favoritesManager.moveFavorite(id, { folderId });
  });

  // 批量移动收藏项
  ipcMain.handle('favorites:move-favorites', async (event, { ids, folderId }) => {
    assertTrustedSender(event);
    return favoritesManager.moveFavorites(ids, { folderId });
  });

  // 更新文件夹排序
  ipcMain.handle('favorites:update-folder-sort', async (event, { id, sortOrder }) => {
    assertTrustedSender(event);
    return favoritesManager.updateFolderSort(id, { sortOrder });
  });

  // 更新收藏项排序
  ipcMain.handle('favorites:update-favorite-sort', async (event, { id, sortOrder }) => {
    assertTrustedSender(event);
    return favoritesManager.updateFavoriteSort(id, { sortOrder });
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

  // 初始化 AI Manager（per Phase 19）
  aiManager = new AIManager();
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
  const configuredIds = configStore.get('containers', []).map(c => c.id);
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

  // 新增 IPC 通道：渲染进程查询本窗口是否有活跃媒体播放
  ipcMain.handle('window:check-active-tasks', (event) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { hasActive: false, taskList: [] };
    return checkActiveTasks(win.id);
  });

  // 获取默认容器并创建主窗口
  const defaultContainer = containerManager.getContainer('default');
  const mainWindow = windowManager.createMainWindow('default', defaultContainer);

  // 注册窗口关闭处理器
  if (mainWindow) {
    setupWindowCloseHandler(mainWindow);
  }

  // 注册全局快捷键
  if (mainWindow) {
    shortcutManager.registerShortcuts();
  }

  // 开发环境启动即打开主窗口 DevTools（停靠右侧，调试 realmAPI/mediaAPI）
  if (mainWindow && process.env.NODE_ENV === 'development') {
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
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
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
            if (mainWindow.isDestroyed()) return;
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools();
            } else {
              mainWindow.webContents.openDevTools();
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

  // macOS 应用激活事件
  app.on('activate', () => {
    // 退出流程中禁止重建窗口：macOS 在退出关闭最后窗口时可能触发 activate，
    // 此时重建窗口会打断 quit 序列，导致「关窗代替退出」
    if (quitting || cookiesSaved) return;
    if (BrowserWindow.getAllWindows().length === 0) {
      const defaultContainer = containerManager.getContainer('default');
      const mainWindow = windowManager.createMainWindow('default', defaultContainer);
      if (mainWindow) {
        // 重建窗口后重新注册快捷键和关闭处理器
        setupWindowCloseHandler(mainWindow);
        shortcutManager.registerShortcuts();
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
 * requestActionConfirmation: 发起高风险操作确认请求（供 AI Manager 调用）
 */
module.exports = { aiManager, requestActionConfirmation, downloadManager };

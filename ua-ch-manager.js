/**
 * Realm Browser - UA Client Hints 覆盖管理器
 *
 * 用 CDP Network.setUserAgentOverride 同时覆盖两层：
 * 1. 请求头 Sec-CH-UA（网络层——webRequest 只能改这里）
 * 2. 页面 navigator.userAgentData（渲染层——webview preload 因 contextIsolation=yes
 *    运行在 isolated world，改不到主世界页面 JS 读取的值）
 *
 * 背景：contents.setUserAgent() 只改 UA 字符串，Sec-CH-UA 头与页面 userAgentData
 * 仍是 Chromium 构建默认（[GREASE, Chromium]，不含 Google Chrome）。UA 字符串声称
 * Chrome 而 CH/页面说不是 Chrome → 跨通道身份不一致。GitHub 校验宽松能过；
 * Google 登录风控严格（Gaia 风控 JS 读取 navigator.userAgentData 上报），直接拒绝并
 * 跳转 /v3/signin/rejected（"此浏览器或应用可能不安全"）。webRequest 注入请求头
 * 无法让页面侧同步，必须走 CDP。
 *
 * 关键约束：
 * - 必须在 webContents **首次导航完成之后**（did-finish-load）attach：未导航过的
 *   target 上 CDP Network 命令永久挂起（docs/debug/github-login-404-two-factor-app.md
 *   实证），且此时页面 JS 尚未读取 userAgentData，覆盖晚于用户交互（输入凭证、
 *   提交 POST）也来得及。
 * - 必须**保持 debugger 附着**：detach 后覆盖即回退默认。
 * - webContents.debugger 是单客户端：本管理器持有期间，AI 工具（cdpManager.
 *   attachForAI）与 Network 抓包会 attach 失败 → 通过 suspend（detach 让位）/
 *   resume（重新 attach + 恢复覆盖）协调，入口在 cdp-manager.js。
 *
 * 依赖：electron（主进程）
 */

const { webContents } = require('electron');
const os = require('os');

// ==================== 覆盖参数 ====================

/** UA 字符串（与 main.js web-contents-created 的 setUserAgent 保持一致） */
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

/**
 * Chrome 在 macOS 上报的 platformVersion 是 macOS 系统版本（如 "15.1.0"），
 * 不是 Darwin 内核版本。os.release() 返回 Darwin 版本（如 "24.1.0"），需映射：
 *   darwin ≤ 24 → macOS = darwin - 9（darwin 24 → macOS 15 Sequoia）
 *   darwin ≥ 25 → macOS = darwin + 1（darwin 25 → macOS 26 Tahoe，Apple 跳号）
 * 必须与内核网络层实际发送的 sec-ch-ua-platform-version 一致（内核如实发 macOS
 * 版本，实测本机 "15.1.0"），否则 JS 侧与网络层跨层矛盾。此前硬编码 "24.1.0"
 * （Darwin 版本），真 Chrome 在 macOS 上永远不可能报 24.x（那是 iOS 号段），
 * 是一眼假的破绽。
 */
function getMacOSVersion() {
  const [major, minor, patch] = os.release().split('.').map(Number);
  const macMajor = major >= 25 ? major + 1 : major - 9;
  return `${macMajor}.${minor || 0}.${patch || 0}`;
}

/**
 * Chrome 150 品牌表——不是拍的，是按 Chromium 源码逐字段算出来的
 * （components/embedder_support/user_agent_utils.cc，tag 150.0.7871.212）：
 *
 * GREASE 生成（GetGreasedUserAgentBrandVersion，seed = 主版本号 150）：
 * - greasy_chars = [" ","(",":","-",".","/",")",";","=","?","_"]，
 *   字符1 = chars[150 % 11] = ";"，字符2 = chars[151 % 11] = "="
 *   → 品牌 "Not;A=Brand"（GREASE 字符串随主版本确定性轮换，抄错版本一眼假）
 * - greased_versions = ["8","99","24"]，版本 = versions[150 % 3] = "8"
 *
 * 品牌顺序（GenerateBrandVersionList + GetRandomOrder 确定性洗牌）：
 * - 构造序：[GREASE, Chromium, Google Chrome]（Google Chrome 构建 size=3）
 * - 排列 orders[150 % 6] = orders[0] = {0,1,2}（恒等）→ 最终序 = 构造序
 *   即 "Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"
 *
 * fullVersionList/fullVersion 用 Electron 43.3.0 真实内核版本 150.0.7871.212：
 * JS 侧 navigator.userAgentData.getHighEntropyValues 的 uaFullVersion 不受 CDP
 * 覆盖控制、恒为内核真实值，fullVersionList 只有取同一值才不产生层内矛盾。
 */
const UA_METADATA = {
  brands: [
    { brand: 'Not;A=Brand', version: '8' },
    { brand: 'Chromium', version: '150' },
    { brand: 'Google Chrome', version: '150' },
  ],
  fullVersion: '150.0.7871.212',
  fullVersionList: [
    { brand: 'Not;A=Brand', version: '8.0.0.0' },
    { brand: 'Chromium', version: '150.0.7871.212' },
    { brand: 'Google Chrome', version: '150.0.7871.212' },
  ],
  // platformVersion/architecture/model 为 CDP UserAgentMetadata 必填字段，
  // 缺失会导致 setUserAgentOverride 返回 "Invalid parameters"（实测，2026-08）。
  platform: 'macOS',
  platformVersion: getMacOSVersion(),
  architecture: 'arm',
  model: '',
  mobile: false,
};

/** CDP setUserAgentOverride 完整参数 */
function buildOverrideParams() {
  return {
    userAgent: CHROME_UA,
    userAgentMetadata: UA_METADATA,
  };
}

// ==================== 状态管理 ====================

/** @type {Map<number, {suspended: boolean}>} webContentsId → 覆盖状态 */
const heldState = new Map();

// ==================== 对外 API ====================

/**
 * 是否由本管理器持有该 webContents 的 debugger
 * @param {number} webContentsId
 * @returns {boolean}
 */
function isHolding(webContentsId) {
  return heldState.has(webContentsId);
}

/**
 * 是否处于挂起状态（debugger 已让位给 AI 工具 / Network 抓包，覆盖暂时失效）
 * @param {number} webContentsId
 * @returns {boolean}
 */
function isSuspended(webContentsId) {
  const state = heldState.get(webContentsId);
  return !!(state && state.suspended);
}

/**
 * 附加 UA 覆盖（webContents 首次导航完成后调用，幂等）
 *
 * 被 DevTools / AI 工具 / Network 抓包占用 debugger 时静默跳过（保持未持有状态，
 * 下次 did-finish-load 再试）。
 *
 * @param {Electron.WebContents} wc - webview 的 webContents
 */
function attach(wc) {
  if (!wc || wc.isDestroyed()) {
    console.warn('[Realm UA-CH] attach 跳过：webContents 已销毁');
    return;
  }
  if (heldState.has(wc.id)) return; // 已持有（幂等），无需重复
  if (wc.debugger.isAttached()) {
    // 被 DevTools / AI 工具 / Network 抓包占用——保持未持有状态，下次事件再试
    console.log(`[Realm UA-CH] attach 跳过：debugger 已被占用, webContents: ${wc.id}`);
    return;
  }

  try {
    wc.debugger.attach('1.3');
    wc.debugger.sendCommand('Network.enable');
    wc.debugger.sendCommand('Network.setUserAgentOverride', buildOverrideParams());
    heldState.set(wc.id, { suspended: false });
    console.log(`[Realm UA-CH] 已附加 UA 覆盖, webContents: ${wc.id}`);
  } catch (err) {
    console.error(`[Realm UA-CH] 附加失败: ${err.message}`);
    try { wc.debugger.detach(); } catch {}
  }
}

/**
 * 挂起覆盖：detach 让位给 AI 工具 / Network 抓包（覆盖暂时失效，resume 恢复）
 * @param {number} webContentsId
 */
function suspend(webContentsId) {
  const state = heldState.get(webContentsId);
  if (!state || state.suspended) return;

  const wc = webContents.fromId(webContentsId);
  if (wc && !wc.isDestroyed() && wc.debugger.isAttached()) {
    try { wc.debugger.detach(); } catch {}
  }
  state.suspended = true;
  console.log(`[Realm UA-CH] 已挂起（让位给 AI/Network）, webContents: ${webContentsId}`);
}

/**
 * 恢复覆盖：重新 attach 并应用 UA 覆盖（由 cdpManager detachForAI 后调用）
 *
 * attach 失败（如他人仍占用 debugger）时保持挂起，下次 resume 再试。
 *
 * @param {number} webContentsId
 */
function resume(webContentsId) {
  const state = heldState.get(webContentsId);
  if (!state || !state.suspended) return;

  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) {
    heldState.delete(webContentsId);
    return;
  }

  try {
    wc.debugger.attach('1.3');
    wc.debugger.sendCommand('Network.enable');
    wc.debugger.sendCommand('Network.setUserAgentOverride', buildOverrideParams());
    state.suspended = false;
    console.log(`[Realm UA-CH] 已恢复 UA 覆盖, webContents: ${webContentsId}`);
  } catch (err) {
    console.warn(`[Realm UA-CH] 恢复失败（保持挂起）: ${err.message}`);
  }
}

/**
 * 释放覆盖状态（webContents 销毁时调用）
 * @param {number} webContentsId
 */
function release(webContentsId) {
  heldState.delete(webContentsId);
}

// ==================== 导出 ====================

module.exports = {
  attach,
  suspend,
  resume,
  release,
  isHolding,
  isSuspended,
};

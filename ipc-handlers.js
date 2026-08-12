/**
 * Realm Browser - IPC 处理器模块
 *
 * 集中注册所有 IPC 处理器，使用 container:* 命名格式
 * 每个处理器对入参做类型校验
 */

const { ipcMain, dialog, BrowserWindow, clipboard, session, webContents } = require('electron');
const path = require('path');
const Store = require('electron-store');
const containerManager = require('./container-manager');
const windowManager = require('./window-manager');
const tabManager = require('./tab-manager');
const cookieManager = require('./cookie-manager');
const assignmentRules = require('./assignment-rules');
const shortcutManager = require('./shortcut-manager');
const historyManager = require('./history-manager');
const downloadManager = require('./download-manager');
const favoritesManager = require('./favorites-manager');
const faviconFetcher = require('./favicon-fetcher');
const mediaSniffer = require('./media-sniffer');

// AI Manager 实例（由 main.js 通过 setAIManager 注入）
let aiManager = null;

// 与 main.js 共享 realm-config.json（settings:* 命名空间）
const configStore = new Store({ name: 'realm-config' });

// 跟踪当前活动的 webview guest webContents ID（渲染进程通过 webview:set-active 同步）
let activeWebviewContentsId = null;

// guest webContentsId → 容器 ID 映射（渲染进程通过 webview:register-container 上报）
// Electron 32 下主进程无法从 guest session 反推 partition（session.partition 为空串），
// 必须依赖渲染进程持有的 webview 元素属性
const guestContainerMap = new Map();

/**
 * 反查 guest webContents 所在容器 ID
 * @param {number} contentsId - webview guest 的 webContents ID
 * @returns {string|null} 容器 ID，未注册时返回 null
 */
function getGuestContainer(contentsId) {
  return guestContainerMap.get(contentsId) || null;
}

/**
 * 移除 guest 映射（guest 销毁时由 main.js 调用）
 * @param {number} contentsId - webview guest 的 webContents ID
 */
function unregisterGuestContainer(contentsId) {
  guestContainerMap.delete(contentsId);
  // 同步丢弃该 guest 未冲刷的嗅探暂存，避免泄漏
  mediaSniffer.pendingByWcId.delete(contentsId);
}

/**
 * 获取当前活动的 webview guest webContents ID
 * 供 main.js 应用菜单快捷键路由使用
 * @returns {number|null} webContents ID
 */
function getActiveWebviewContentsId() {
  return activeWebviewContentsId;
}

/**
 * 校验 IPC 调用方身份（CR-4 修复）
 * 仅接受来自应用主窗口 webContents 的调用；
 * webview guest、DevTools 或其他非窗口上下文一律拒绝，
 * 防止被浏览网页/注入上下文直接 invoke 特权通道。
 * @param {Electron.IpcMainInvokeEvent} event - IPC 事件对象
 * @returns {BrowserWindow} 受信的主窗口实例
 * @throws {Error} 来源不受信任时抛出
 */
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const mainWindow = windowManager.getMainWindow();
  if (!win || !mainWindow || win.id !== mainWindow.id) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}

/**
 * 验证容器配置参数
 * @param {Object} config - 容器配置
 * @returns {boolean} 验证是否通过
 */
function validateContainerConfig(config) {
  if (!config || typeof config !== 'object') {
    return false;
  }
  if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
    return false;
  }
  // WR-13：颜色必须为 #RRGGBB 格式——渲染层会将 color 写入 style 属性，
  // 仅校验 typeof string 时形如 red" onmouseover="... 的值可逃逸属性构成 XSS；
  // 图标限制为单字符（emoji），防止超长字符串注入
  if (config.color && !/^#[0-9a-fA-F]{6}$/.test(config.color)) {
    return false;
  }
  // 支持 emoji 和 SVG 符号两种图标类型
  if (config.icon !== undefined) {
    if (typeof config.icon !== 'string' || config.icon.length === 0) {
      return false;
    }
    const iconType = config.iconType;
    if (iconType === 'symbol') {
      // SVG 符号 ID：仅允许小写字母和连字符，最大 30 字符
      if (!/^[a-z][a-z0-9-]{0,29}$/.test(config.icon)) {
        return false;
      }
    } else {
      // emoji 模式（含 iconType === 'emoji' 或 iconType 缺失）
      if ([...config.icon].length !== 1) {
        return false;
      }
    }
  }
  // iconType 校验
  if (config.iconType !== undefined && !['emoji', 'symbol'].includes(config.iconType)) {
    return false;
  }
  // 扩展属性校验（per D-04）：允许 undefined 或 string，非空时限制长度
  if (config.phone !== undefined && (typeof config.phone !== 'string' || config.phone.length > 20)) {
    return false;
  }
  if (config.email !== undefined && (typeof config.email !== 'string' || config.email.length > 100)) {
    return false;
  }
  if (config.notes !== undefined && (typeof config.notes !== 'string' || config.notes.length > 500)) {
    return false;
  }
  // 环境变量校验：允许 undefined 或数组，每项含 key/value 字符串
  if (config.envVars !== undefined) {
    if (!Array.isArray(config.envVars)) {
      return false;
    }
    for (const item of config.envVars) {
      if (!item || typeof item !== 'object') {
        return false;
      }
      if (typeof item.key !== 'string' || item.key.length === 0 || item.key.length > 100) {
        return false;
      }
      if (typeof item.value !== 'string' || item.value.length > 2000) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 验证容器更新参数
 * @param {Object} updates - 更新内容
 * @returns {boolean} 验证是否通过
 */
function validateContainerUpdates(updates) {
  if (!updates || typeof updates !== 'object') {
    return false;
  }
  if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim() === '')) {
    return false;
  }
  // WR-13：与 validateContainerConfig 同色/图标白名单（见该函数注释）
  if (updates.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(updates.color)) {
    return false;
  }
  // 支持 emoji 和 SVG 符号两种图标类型
  if (updates.icon !== undefined) {
    if (typeof updates.icon !== 'string' || updates.icon.length === 0) {
      return false;
    }
    const iconType = updates.iconType;
    if (iconType === 'symbol') {
      // SVG 符号 ID：仅允许小写字母和连字符，最大 30 字符
      if (!/^[a-z][a-z0-9-]{0,29}$/.test(updates.icon)) {
        return false;
      }
    } else {
      // emoji 模式（含 iconType === 'emoji' 或 iconType 缺失）
      if ([...updates.icon].length !== 1) {
        return false;
      }
    }
  }
  // iconType 校验
  if (updates.iconType !== undefined && !['emoji', 'symbol'].includes(updates.iconType)) {
    return false;
  }
  // 扩展属性校验（per D-04）：允许 undefined 或 string，非空时限制长度
  if (updates.phone !== undefined && (typeof updates.phone !== 'string' || updates.phone.length > 20)) {
    return false;
  }
  if (updates.email !== undefined && (typeof updates.email !== 'string' || updates.email.length > 100)) {
    return false;
  }
  if (updates.notes !== undefined && (typeof updates.notes !== 'string' || updates.notes.length > 500)) {
    return false;
  }
  // 环境变量校验：允许 undefined 或数组，每项含 key/value 字符串
  if (updates.envVars !== undefined) {
    if (!Array.isArray(updates.envVars)) {
      return false;
    }
    for (const item of updates.envVars) {
      if (!item || typeof item !== 'object') {
        return false;
      }
      if (typeof item.key !== 'string' || item.key.length === 0 || item.key.length > 100) {
        return false;
      }
      if (typeof item.value !== 'string' || item.value.length > 2000) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 注册所有 IPC 处理器
 */
function registerHandlers() {
  // WR-4：Tab 回收策略单点实现于主进程（tab-manager），
  // 回收发生时推送 tab:recycled 事件，渲染进程据此移除对应 DOM/webview 并提示
  tabManager.setRecycleListener(({ recycledTabId, message }) => {
    const win = windowManager.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('tab:recycled', { tabId: recycledTabId, message });
    }
  });

  /**
   * 获取容器列表
   * @returns {Array<{id: string, name: string, color: string, icon: string}>}
   */
  ipcMain.handle('container:list', (event) => {
    assertTrustedSender(event);
    return containerManager.getContainers();
  });

  /**
   * 创建新容器
   * @param {Object} config - 容器配置
   * @param {string} config.name - 容器名称
   * @param {string} [config.color] - 容器颜色
   * @param {string} [config.icon] - 容器图标
   * @returns {Object} 创建的容器配置
   */
  ipcMain.handle('container:create', (event, config) => {
    assertTrustedSender(event);
    if (!validateContainerConfig(config)) {
      throw new Error('无效的容器配置');
    }
    return containerManager.createContainer(config);
  });

  /**
   * 更新容器配置
   * @param {string} id - 容器 ID
   * @param {Object} updates - 更新内容
   * @returns {Object|undefined} 更新后的容器配置
   */
  ipcMain.handle('container:update', (event, id, updates) => {
    assertTrustedSender(event);
    if (!id || typeof id !== 'string') {
      throw new Error('无效的容器 ID');
    }
    if (!validateContainerUpdates(updates)) {
      throw new Error('无效的更新参数');
    }
    return containerManager.updateContainer(id, updates);
  });

  /**
   * 删除容器
   * @param {string} id - 容器 ID
   * @returns {Promise<{success: boolean, message?: string}>} 操作结果
   */
  ipcMain.handle('container:delete', async (event, id) => {
    assertTrustedSender(event);
    if (!id || typeof id !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return containerManager.deleteContainer(id);
  });

  /**
   * 获取当前窗口的容器 ID
   * @returns {string} 容器 ID
   */
  ipcMain.handle('container:current', (event) => {
    // CR-7：统一使用 BrowserWindow.id 作为 windowContainerMap 键空间
    // （event.sender.id 属于 webContents 独立计数空间，禁止混用）
    const win = assertTrustedSender(event);
    return windowManager.getCurrentContainer(win.id);
  });

  /**
   * 切换当前窗口的容器
   * @param {string} containerId - 目标容器 ID
   * @returns {boolean} 切换是否成功
   */
  ipcMain.handle('container:switch', (event, containerId) => {
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    // CR-7：统一使用 BrowserWindow.id（见 container:current 注释）
    const win = assertTrustedSender(event);
    const container = containerManager.getContainer(containerId);
    return windowManager.switchContainer(win.id, containerId, container);
  });

  // ==================== Tab 管理 ====================

  /**
   * 获取所有 Tab
   * @returns {Array} Tab 数组
   */
  ipcMain.handle('tab:list', (event) => {
    assertTrustedSender(event);
    return tabManager.getTabs();
  });

  /**
   * 创建新 Tab
   * @param {string} containerId - 容器 ID
   * @param {string} [url] - 初始 URL
   * @returns {Object} 新创建的 Tab 对象
   */
  ipcMain.handle('tab:create', (event, containerId, url) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return tabManager.createTab(containerId, url);
  });

  /**
   * 切换到指定 Tab
   * @param {string} tabId - Tab ID
   * @returns {boolean} 是否成功切换
   */
  ipcMain.handle('tab:switch', (event, tabId) => {
    assertTrustedSender(event);
    if (!tabId || typeof tabId !== 'string') {
      throw new Error('无效的 Tab ID');
    }
    return tabManager.switchTab(tabId);
  });

  /**
   * 更新 Tab 信息
   * @param {string} tabId - Tab ID
   * @param {Object} updates - 更新内容
   * @returns {boolean} 是否成功更新
   */
  ipcMain.handle('tab:update', (event, tabId, updates) => {
    assertTrustedSender(event);
    if (!tabId || typeof tabId !== 'string') {
      throw new Error('无效的 Tab ID');
    }
    if (!updates || typeof updates !== 'object') {
      throw new Error('无效的更新参数');
    }
    return tabManager.updateTab(tabId, updates);
  });

  /**
   * 关闭 Tab
   * @param {string} tabId - Tab ID
   * @returns {Object} 关闭结果
   */
  ipcMain.handle('tab:close', (event, tabId) => {
    assertTrustedSender(event);
    if (!tabId || typeof tabId !== 'string') {
      throw new Error('无效的 Tab ID');
    }
    return tabManager.closeTab(tabId);
  });

  /**
   * 获取当前活动 Tab
   * @returns {Object|null} 活动 Tab 对象或 null
   */
  ipcMain.handle('tab:get-active', (event) => {
    assertTrustedSender(event);
    return tabManager.getActiveTab();
  });

  /**
   * 清空所有 Tab（含持久化 store）
   * 启动时渲染进程判定"不恢复"后调用，避免旧会话残留在 store 里
   * 与本次新建 Tab 一起被 saveTabs 写回磁盘
   * @returns {{success: boolean}}
   */
  ipcMain.handle('tab:clear-all', (event) => {
    assertTrustedSender(event);
    tabManager.clearAllTabs();
    return { success: true };
  });

  // ==================== Cookie 管理 ====================

  /**
   * 获取容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>} Cookie 数组
   */
  ipcMain.handle('container:get-cookies', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return containerManager.getContainerCookies(containerId);
  });

  /**
   * 清除容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<boolean>} 是否成功清除
   */
  ipcMain.handle('container:clear-cookies', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return containerManager.clearContainerCookies(containerId);
  });

  /**
   * 重排容器顺序
   * @param {string[]} orderedIds - 新的容器 ID 顺序
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('container:reorder', (event, orderedIds) => {
    assertTrustedSender(event);
    if (!Array.isArray(orderedIds)) {
      throw new Error('orderedIds 必须是数组');
    }
    return containerManager.reorderContainers(orderedIds);
  });

  /**
   * 保存容器 Cookie 到文件
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, count: number}>}
   */
  ipcMain.handle('cookie:save', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return cookieManager.saveCookies(containerId);
  });

  /**
   * 加载容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, count: number}>}
   */
  ipcMain.handle('cookie:load', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return cookieManager.loadCookies(containerId);
  });

  /**
   * 导出容器 Cookie 到文件
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  ipcMain.handle('cookie:export', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }

    // 打开文件保存对话框
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 Cookie',
      defaultPath: `${containerId}-cookies.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, message: '已取消' };
    }

    return cookieManager.exportCookies(containerId, filePath);
  });

  /**
   * 导入 Cookie 到容器
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  ipcMain.handle('cookie:import', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }

    // 打开文件选择对话框
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '导入 Cookie',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: '已取消' };
    }

    return cookieManager.importCookies(containerId, filePaths[0]);
  });

  /**
   * 删除容器的 Cookie 文件和 Session 数据
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('cookie:delete', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return cookieManager.deleteCookies(containerId);
  });

  // ==================== Cookie 管理增强 ====================

  /**
   * 获取容器的 Session Cookie 列表
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>} Cookie 数组
   */
  ipcMain.handle('cookie:get-session', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return cookieManager.getSessionCookies(containerId);
  });

  /**
   * 获取容器的 File Cookie 列表
   * @param {string} containerId - 容器 ID
   * @returns {Array} Cookie 数组
   */
  ipcMain.handle('cookie:get-file', (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return cookieManager.getFileCookies(containerId);
  });

  /**
   * 编辑单个 Cookie
   * @param {string} containerId - 容器 ID
   * @param {Object} cookieData - Cookie 数据
   * @returns {Promise<{success: boolean, message: string}>}
   */
  ipcMain.handle('cookie:edit', async (event, containerId, cookieData) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    if (!cookieData || typeof cookieData !== 'object' || !cookieData.name) {
      throw new Error('无效的 Cookie 数据');
    }
    return cookieManager.editCookie(containerId, cookieData);
  });

  /**
   * 删除单个 Cookie
   * @param {string} containerId - 容器 ID
   * @param {Object} cookieData - Cookie 数据
   * @returns {Promise<{success: boolean, message: string}>}
   */
  ipcMain.handle('cookie:delete-single', async (event, containerId, cookieData) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    if (!cookieData || typeof cookieData !== 'object' || !cookieData.name) {
      throw new Error('无效的 Cookie 数据');
    }
    return cookieManager.deleteSingleCookie(containerId, cookieData);
  });

  /**
   * 保存指定域名的 Cookie 到文件
   * 只保存当前域名及其子域名的 Cookie
   * @param {string} containerId - 容器 ID
   * @param {string} domain - 目标域名
   * @param {boolean} includeSubdomains - 是否包含子域名
   * @returns {Promise<{success: boolean, count: number}>}
   */
  ipcMain.handle('cookie:save-domain', async (event, containerId, domain, includeSubdomains) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    if (!domain || typeof domain !== 'string') {
      throw new Error('无效的域名');
    }
    return cookieManager.saveDomainCookies(containerId, domain, includeSubdomains !== false);
  });

  /**
   * 检查指定域名的 session Cookie 与文件是否同步（含子域名语义）
   * @param {string} containerId - 容器 ID
   * @param {string} domain - 目标域名
   * @returns {Promise<{inSync: boolean, sessionCount: number, fileCount: number}>}
   */
  ipcMain.handle('cookie:check-domain-sync', async (event, containerId, domain) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    if (!domain || typeof domain !== 'string') {
      throw new Error('无效的域名');
    }
    return cookieManager.compareDomainCookies(containerId, domain);
  });

  // ==================== 分配规则 ====================

  /**
   * 获取所有规则
   * @returns {Array} 规则数组
   */
  ipcMain.handle('rule:list', (event) => {
    assertTrustedSender(event);
    return assignmentRules.getRules();
  });

  /**
   * 创建新规则
   * @param {string} containerId - 目标容器 ID
   * @param {string} pattern - 匹配模式
   * @returns {Object} 创建的规则对象
   */
  ipcMain.handle('rule:create', (event, containerId, pattern) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('无效的匹配模式');
    }
    return assignmentRules.createRule(containerId, pattern);
  });

  /**
   * 更新规则
   * @param {string} ruleId - 规则 ID
   * @param {Object} updates - 更新内容
   * @returns {Object|null} 更新后的规则对象
   */
  ipcMain.handle('rule:update', (event, ruleId, updates) => {
    assertTrustedSender(event);
    if (!ruleId || typeof ruleId !== 'string') {
      throw new Error('无效的规则 ID');
    }
    return assignmentRules.updateRule(ruleId, updates);
  });

  /**
   * 删除规则
   * @param {string} ruleId - 规则 ID
   * @returns {boolean} 是否成功删除
   */
  ipcMain.handle('rule:delete', (event, ruleId) => {
    assertTrustedSender(event);
    if (!ruleId || typeof ruleId !== 'string') {
      throw new Error('无效的规则 ID');
    }
    return assignmentRules.deleteRule(ruleId);
  });

  /**
   * 匹配 URL
   * @param {string} url - 要匹配的 URL
   * @returns {string|null} 匹配的容器 ID 或 null
   */
  ipcMain.handle('rule:match', (event, url) => {
    assertTrustedSender(event);
    if (!url || typeof url !== 'string') {
      return null;
    }
    return assignmentRules.matchUrl(url);
  });

  /**
   * 重新排序规则
   * @param {Array<string>} orderedIds - 规则 ID 的有序数组
   * @returns {{success: boolean}}
   */
  ipcMain.handle('rule:reorder', (event, orderedIds) => {
    assertTrustedSender(event);
    if (!Array.isArray(orderedIds)) {
      throw new Error('orderedIds 必须是数组');
    }
    assignmentRules.reorderRules(orderedIds);
    return { success: true };
  });

  /**
   * 导出规则到文件
   * @returns {Promise<{success: boolean, count?: number, message?: string}>}
   */
  ipcMain.handle('rule:export', async (event) => {
    assertTrustedSender(event);

    const data = assignmentRules.exportRules();

    // 打开文件保存对话框
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出规则',
      defaultPath: `realm-rules-${Date.now()}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, message: '已取消' };
    }

    try {
      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[Realm] 导出规则到: ${filePath}`);
      return { success: true, count: data.rules.length };
    } catch (error) {
      console.error('[Realm] 导出规则失败:', error);
      return { success: false, message: '导出失败: ' + error.message };
    }
  });

  /**
   * 从文件导入规则
   * @returns {Promise<{success: boolean, count?: number, message?: string}>}
   */
  ipcMain.handle('rule:import', async (event) => {
    assertTrustedSender(event);

    // 打开文件选择对话框
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '导入规则',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: '已取消' };
    }

    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(content);

      // 验证格式（必须包含 rules 数组）
      if (!data.rules || !Array.isArray(data.rules)) {
        return { success: false, message: '文件格式不正确：缺少 rules 数组' };
      }

      const result = assignmentRules.importRules(data.rules);
      console.log(`[Realm] 从文件导入规则: ${filePaths[0]}`);
      return result;
    } catch (error) {
      console.error('[Realm] 导入规则失败:', error);
      return { success: false, message: '导入失败: ' + error.message };
    }
  });

  // ==================== 快捷键 ====================

  /**
   * 获取快捷键配置
   * @returns {Object} 快捷键配置对象
   */
  ipcMain.handle('shortcut:list', (event) => {
    assertTrustedSender(event);
    return shortcutManager.getShortcuts();
  });

  /**
   * 设置快捷键
   * @param {string} action - 操作名称
   * @param {string} accelerator - 快捷键
   * @returns {boolean} 是否设置成功
   */
  ipcMain.handle('shortcut:set', (event, action, accelerator) => {
    assertTrustedSender(event);
    if (!action || typeof action !== 'string') {
      throw new Error('无效的操作名称');
    }
    if (!accelerator || typeof accelerator !== 'string') {
      throw new Error('无效的快捷键');
    }
    const result = shortcutManager.setShortcut(action, accelerator);
    // 设置成功后重建菜单，使新快捷键立即生效（无需重启应用）
    if (result) {
      const win = windowManager.getMainWindow();
      shortcutManager.rebuildShortcuts(win);
    }
    return result;
  });

  /**
   * 重置快捷键为默认值
   * 删除自定义覆盖项，自动回落到 DEFAULT_SHORTCUTS
   * @param {string} action - 操作名称
   * @returns {boolean} 是否重置成功
   */
  ipcMain.handle('shortcut:reset', (event, action) => {
    assertTrustedSender(event);
    if (!action || typeof action !== 'string') {
      throw new Error('无效的操作名称');
    }
    const result = shortcutManager.resetShortcut(action);
    if (result) {
      const win = windowManager.getMainWindow();
      shortcutManager.rebuildShortcuts(win);
    }
    return result;
  });

  // ==================== 下载管理 ====================

  /**
   * 获取容器的下载列表
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>} 下载记录数组
   */
  ipcMain.handle('download:list', async (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }
    return downloadManager.getDownloads(containerId);
  });

  /**
   * 获取当前活跃下载数量
   * @returns {Promise<number>}
   */
  ipcMain.handle('download:get-active-count', async (event) => {
    assertTrustedSender(event);
    return downloadManager.getActiveCount();
  });

  /**
   * 获取活跃下载列表（含进度信息）
   * @returns {Promise<Array>}
   */
  ipcMain.handle('download:get-active', async (event) => {
    assertTrustedSender(event);
    return downloadManager.getActiveDownloads();
  });

  /**
   * 取消下载
   * @param {string} downloadId - 下载 ID
   * @returns {Promise<boolean>}
   */
  ipcMain.handle('download:cancel', async (event, downloadId) => {
    assertTrustedSender(event);
    if (!downloadId || typeof downloadId !== 'string') {
      throw new Error('无效的下载 ID');
    }
    return downloadManager.cancelDownload(downloadId);
  });

  /**
   * 暂停下载
   * @param {string} downloadId - 下载 ID
   * @returns {Promise<boolean>}
   */
  ipcMain.handle('download:pause', async (event, downloadId) => {
    assertTrustedSender(event);
    if (!downloadId || typeof downloadId !== 'string') {
      throw new Error('无效的下载 ID');
    }
    return downloadManager.pauseDownload(downloadId);
  });

  /**
   * 恢复下载
   * @param {string} downloadId - 下载 ID
   * @returns {Promise<boolean>}
   */
  ipcMain.handle('download:resume', async (event, downloadId) => {
    assertTrustedSender(event);
    if (!downloadId || typeof downloadId !== 'string') {
      throw new Error('无效的下载 ID');
    }
    return downloadManager.resumeDownload(downloadId);
  });

  /**
   * 打开已下载的文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  ipcMain.handle('download:open-file', async (event, filePath) => {
    assertTrustedSender(event);
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('无效的文件路径');
    }
    return downloadManager.openFile(filePath);
  });

  /**
   * 在 Finder 中显示文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('download:show-in-folder', async (event, filePath) => {
    assertTrustedSender(event);
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('无效的文件路径');
    }
    return downloadManager.showInFolder(filePath);
  });

  /**
   * 获取全局下载列表（所有容器）
   * @param {number} [limit=50] - 每页记录数
   * @param {number} [offset=0] - 偏移量
   * @returns {Promise<Array>} 下载记录数组
   */
  ipcMain.handle('download:list-all', async (event, limit, offset) => {
    assertTrustedSender(event);
    return downloadManager.getAllDownloads(limit || 50, offset || 0);
  });

  /**
   * 删除单条下载记录（可选删除本地文件）
   * @param {string} downloadId - 下载 ID
   * @param {boolean} [deleteFile=false] - 是否同时删除本地文件
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  ipcMain.handle('download:delete-record', async (event, downloadId, deleteFile) => {
    assertTrustedSender(event);
    if (!downloadId || typeof downloadId !== 'string') {
      throw new Error('无效的下载 ID');
    }
    return downloadManager.deleteDownload(downloadId, !!deleteFile);
  });

  /**
   * 清空所有下载历史
   * @returns {Promise<{success: boolean, deletedCount: number}>}
   */
  ipcMain.handle('download:clear-all', async (event) => {
    assertTrustedSender(event);
    return downloadManager.clearAllDownloads();
  });

  // ==================== 浏览历史 ====================

  /**
   * 添加历史记录
   * @param {Object} data - 历史记录数据
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.url - 页面 URL
   * @param {string} [data.title] - 页面标题
   * @param {string} [data.faviconUrl] - favicon URL
   * @param {number} [data.visitedAt] - 访问时间戳
   * @returns {{id: number}|{skipped: boolean}} 新记录 ID 或跳过标记
   */
  ipcMain.handle('history:add', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的历史记录参数');
    }
    // D-23 过滤：不记录空 URL、about:blank、realm:// 协议页面
    if (!data.url || data.url === 'about:blank' || data.url.startsWith('realm://')) {
      return { skipped: true };
    }
    return historyManager.addRecord(data.containerId, {
      url: data.url,
      title: data.title || '',
      faviconUrl: data.faviconUrl || '',
      visitedAt: data.visitedAt,
    });
  });

  /**
   * 更新最近一条历史记录的标题
   * @param {Object} data - 数据
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.url - 匹配的 URL
   * @param {string} data.title - 新标题
   * @returns {boolean} 是否更新成功
   */
  ipcMain.handle('history:update-title', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的参数');
    }
    return historyManager.updateLastTitle(data.containerId, data.url, data.title);
  });

  /**
   * 搜索历史记录
   * @param {Object} data - 搜索参数
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.keyword - 搜索关键词
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Array} 匹配的记录列表
   */
  ipcMain.handle('history:search', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的搜索参数');
    }
    return historyManager.searchRecords(data.containerId, {
      keyword: data.keyword || '',
      offset: data.offset || 0,
      limit: data.limit || 50,
    });
  });

  /**
   * 列出历史记录
   * @param {Object} data - 分页参数
   * @param {string} data.containerId - 容器 ID
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Array} 记录列表
   */
  ipcMain.handle('history:list', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的参数');
    }
    return historyManager.listRecords(data.containerId, {
      offset: data.offset || 0,
      limit: data.limit || 50,
    });
  });

  /**
   * 删除单条历史记录
   * @param {Object} data - 参数
   * @param {string} data.containerId - 容器 ID
   * @param {number} data.id - 记录 ID
   * @returns {boolean} 是否删除成功
   */
  ipcMain.handle('history:delete', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的参数');
    }
    return historyManager.deleteRecord(data.containerId, data.id);
  });

  /**
   * 批量删除历史记录
   * @param {Object} data - 参数
   * @param {string} data.containerId - 容器 ID
   * @param {Array<number>} data.ids - 记录 ID 数组
   * @returns {number} 删除的记录数
   */
  ipcMain.handle('history:delete-batch', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的参数');
    }
    return historyManager.deleteRecords(data.containerId, data.ids || []);
  });

  /**
   * 清空容器全部历史记录
   * @param {Object} data - 参数
   * @param {string} data.containerId - 容器 ID
   * @returns {number} 删除的记录数
   */
  ipcMain.handle('history:clear', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的参数');
    }
    return historyManager.clearRecords(data.containerId);
  });

  /**
   * 获取容器历史记录总数
   * @param {Object} data - 参数
   * @param {string} data.containerId - 容器 ID
   * @returns {number} 记录总数
   */
  ipcMain.handle('history:count', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.containerId !== 'string') {
      throw new Error('无效的参数');
    }
    return historyManager.getCount(data.containerId);
  });

  // ==================== 收藏夹 ====================

  /**
   * 检查 URL 是否已收藏
   * @param {Object} data - 参数
   * @param {string} data.url - 页面 URL
   * @returns {{id: number, title: string, favicon_url: string}|null}
   */
  ipcMain.handle('favorites:check', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    return favoritesManager.checkUrl(data.url || '');
  });

  /**
   * 添加收藏
   * @param {Object} data - 收藏数据
   * @param {string} data.url - 页面 URL
   * @param {string} [data.title] - 页面标题
   * @param {string} [data.faviconUrl] - favicon 源 URL（主进程统一抓取转 data URL 入库）
   * @returns {{id: number}|{error: string, message: string}}
   */
  ipcMain.handle('favorites:add', async (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    // 远程 favicon URL 统一转 data URL（favicon-fetcher 为唯一实现点）；
    // 抓取失败得 '' 以空图标入库，之后访问时经 favorites:update-favicon 回写补齐
    const faviconUrl = data.faviconUrl
      ? await faviconFetcher.fetchAsDataUrl(data.faviconUrl)
      : '';
    return favoritesManager.addRecord({
      url: data.url || '',
      title: data.title || '',
      faviconUrl,
    });
  });

  /**
   * 更新收藏标题
   * @param {Object} data - 参数
   * @param {number} data.id - 记录 ID
   * @param {string} data.title - 新标题
   * @returns {boolean} 是否更新成功
   */
  ipcMain.handle('favorites:update', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    return favoritesManager.updateRecord(data.id, { title: data.title });
  });

  /**
   * 回填收藏 favicon（访问已收藏页面时由渲染进程触发）
   *
   * 抓取 sourceUrl 转 data URL 后写入，仅当记录当前无图标时生效（只补空不覆盖）。
   * 写入成功后广播 bookmarks-bar:refresh 刷新收藏栏。
   *
   * @param {Object} data - 参数
   * @param {number} data.id - 收藏记录 ID
   * @param {string} data.sourceUrl - favicon 源 URL（http/https/data）
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('favorites:update-favicon', async (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.id !== 'number') {
      throw new Error('无效的参数');
    }
    const dataUrl = await faviconFetcher.fetchAsDataUrl(data.sourceUrl);
    if (!dataUrl) {
      return { success: false };
    }
    const updated = favoritesManager.updateFavicon(data.id, dataUrl);
    if (updated) {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bookmarks-bar:refresh');
      }
    }
    return { success: updated };
  });

  /**
   * 删除单条收藏
   * @param {Object} data - 参数
   * @param {number} data.id - 记录 ID
   * @returns {boolean} 是否删除成功
   */
  ipcMain.handle('favorites:delete', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    return favoritesManager.deleteRecord(data.id);
  });

  /**
   * 批量删除收藏
   * @param {Object} data - 参数
   * @param {Array<number>} data.ids - 记录 ID 数组
   * @returns {number} 删除的记录数
   */
  ipcMain.handle('favorites:delete-batch', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    return favoritesManager.deleteRecords(data.ids || []);
  });

  /**
   * 列出收藏记录
   * @param {Object} data - 分页参数
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Array} 记录列表
   */
  ipcMain.handle('favorites:list', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    return favoritesManager.listRecords({
      offset: data.offset || 0,
      limit: data.limit || 50,
      folderId: data.folderId,
    });
  });

  /**
   * 搜索收藏记录
   * @param {Object} data - 搜索参数
   * @param {string} data.keyword - 搜索关键词
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Array} 匹配的记录列表
   */
  ipcMain.handle('favorites:search', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    return favoritesManager.searchRecords({
      keyword: data.keyword || '',
      offset: data.offset || 0,
      limit: data.limit || 50,
    });
  });

  /**
   * 获取收藏记录总数
   * @param {Object} data - 参数
   * @returns {number} 记录总数
   */
  ipcMain.handle('favorites:count', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object') {
      throw new Error('无效的参数');
    }
    return favoritesManager.getCount();
  });

  // ==================== webview DevTools 支持 ====================

  /**
   * 渲染进程报告当前活动的 webview guest webContents ID
   * 用于应用菜单快捷键（Cmd+Option+I）路由 DevTools 到正确的 webview
   * @param {number} contentsId - webview guest 的 webContents ID
   */
  ipcMain.handle('webview:set-active', (event, contentsId) => {
    activeWebviewContentsId = contentsId;
  });

  /**
   * 渲染进程上报 guest webContentsId → 容器 ID 映射
   * 主进程无法从 guest session 反推 partition（Electron 32 限制），
   * 容器分配规则匹配和 CDP 抓取依赖此映射
   * @param {number} contentsId - webview guest 的 webContents ID
   * @param {string} containerId - 容器 ID
   */
  ipcMain.handle('webview:register-container', (event, contentsId, containerId) => {
    if (typeof contentsId !== 'number' || typeof containerId !== 'string' || !containerId) {
      return;
    }
    guestContainerMap.set(contentsId, containerId);
    // 补录 guest 注册前到达的嗅探条目（首批网络响应必然早于 did-attach 注册）
    mediaSniffer.flushPending(contentsId);
  });

  // ==================== AI 相关 ====================

  /**
   * 发送用户消息给 AI Agent
   * @param {string} message - 用户输入的消息
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('ai:prompt', async (event, message) => {
    assertTrustedSender(event);
    if (!message || typeof message !== 'string') {
      throw new Error('无效的消息');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    await aiManager.prompt(message);
    return { success: true };
  });

  /**
   * 发送带上下文引用的 AI 消息
   * @param {Object} data - 消息数据
   * @param {string} data.message - 用户消息
   * @param {Array} data.referencedTabs - 引用的标签页列表
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('ai:prompt-with-context', async (event, data) => {
    assertTrustedSender(event);
    if (!data || !data.message || typeof data.message !== 'string') {
      throw new Error('无效的消息');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    await aiManager.promptWithContext(data.message, data.referencedTabs || []);
    return { success: true };
  });

  /**
   * 获取主进程缓存的 Readability 库源码
   * 供渲染进程内联注入 webview 提取引用标签页内容（与 read_page_content 同一 bundle）
   * @returns {string} Readability bundle 源码（加载失败为空字符串）
   */
  ipcMain.handle('ai:get-readability-script', (event) => {
    assertTrustedSender(event);
    if (!aiManager) {
      return '';
    }
    return aiManager.getReadabilityScript();
  });

  /**
   * 取消当前 AI 操作
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('ai:abort', async (event) => {
    assertTrustedSender(event);
    if (aiManager) {
      aiManager.abort();
    }
    return { success: true };
  });

  /**
   * 配置 AI 提供商 API Key
   * @param {Object} config - { provider: string, apiKey: string }
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('ai:configure', async (event, config) => {
    assertTrustedSender(event);
    if (!config || !config.apiKey) {
      throw new Error('无效的配置');
    }
    if (aiManager) {
      await aiManager.configureProviders(config);
    }
    return { success: true };
  });

  /**
   * 获取可用的 AI 模型列表
   * @returns {Promise<{models: Array}>}
   */
  ipcMain.handle('ai:get-models', async (event) => {
    assertTrustedSender(event);
    if (!aiManager) {
      return { models: [] };
    }
    return aiManager.getAvailableModels();
  });

  /**
   * 获取 AI Manager 当前状态
   * @returns {Promise<{initialized: boolean, model: string|null, toolsCount: number}>}
   */
  ipcMain.handle('ai:get-state', async (event) => {
    assertTrustedSender(event);
    if (!aiManager) {
      return { initialized: false, model: null, toolsCount: 0 };
    }
    return aiManager.getState();
  });

  // ==================== 播放器窗口状态 ====================

  /** @type {BrowserWindow|null} 播放器窗口引用（D-20 窗口复用） */
  let playerWindow = null;
  /** @type {string|null} 播放器关联的容器 ID（D-22 Session 隔离） */
  let playerContainerId = null;

  /**
   * 校验播放器窗口 IPC 来源：仅接受来自当前播放器窗口的调用。
   * assertTrustedSender 只认主窗口，播放器窗口的窗口控制通道（全屏/最小化/
   * 最大化/关闭）必须用它自己的窗口身份做校验，否则会被误判为不受信来源。
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件对象
   * @returns {BrowserWindow} 播放器窗口实例
   * @throws {Error} 来源不受信任时抛出
   */
  function assertPlayerSender(event) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !playerWindow || playerWindow.isDestroyed() || win.id !== playerWindow.id) {
      throw new Error('不受信任的 IPC 来源');
    }
    return win;
  }

  // ==================== 媒体检测 ====================

  /**
   * 获取指定 webview 的媒体列表（per IPC-01）
   * @param {number} webContentsId - webview 的 webContents ID
   * @returns {Promise<Array<{url: string, type: string, source: string, timestamp: number}>>}
   */
  ipcMain.handle('media:get-list', (event, webContentsId) => {
    assertTrustedSender(event);
    if (typeof webContentsId !== 'number') return [];
    return mediaSniffer.getMediaList(webContentsId);
  });

  /**
   * 诊断用：嗅探管线各环节计数 + 当前窗口解析到的容器 ID
   * @returns {Promise<Object>} 诊断状态
   */
  ipcMain.handle('media:debug-state', (event) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    const containerId = win ? windowManager.getCurrentContainer(win.id) : null;
    return {
      ...mediaSniffer.debugState(),
      guestMapSize: guestContainerMap.size,
      currentWindowContainer: containerId,
    };
  });

  /**
   * 创建播放器窗口并播放指定 URL（per IPC-02）
   * 支持 Session 隔离（D-22）、窗口复用（D-20）、资源释放（D-21）
   * @param {string} url - 视频 URL
   * @param {string} containerId - 来源容器 ID
   * @returns {Promise<{success: boolean, reused: boolean}>}
   */
  ipcMain.handle('media:play', async (event, url, containerId) => {
    assertTrustedSender(event);
    if (!url || typeof url !== 'string') {
      throw new Error('无效的视频 URL');
    }
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('无效的容器 ID');
    }

    // 容器名用于播放器标题显示（{容器名} - {文件名}），便于肉眼验证 D-22 容器隔离
    const containerName = (containerManager.getContainer(containerId) || {}).name || containerId;

    // D-20: 窗口复用 -- 已有播放器窗口时替换播放
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerContainerId = containerId;
      const mediaList = mediaSniffer.getMediaListByContainer(containerId);
      playerWindow.webContents.send('media:play-url', { url, mediaList, containerId, containerName });
      playerWindow.focus();
      return { success: true, reused: true };
    }

    // D-22: 获取来源容器的 Session partition
    const partition = `persist:container-${containerId}`;

    // D-04: 无边框窗口, D-19: 960x540, D-22: Session 隔离
    playerWindow = new BrowserWindow({
      width: 960,
      height: 540,
      minWidth: 480,
      minHeight: 270,
      frame: false,
      backgroundColor: '#000000',
      resizable: true,
      title: 'Realm Player',
      webPreferences: {
        preload: path.join(__dirname, 'src/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        session: session.fromPartition(partition),
      },
    });

    playerContainerId = containerId;

    playerWindow.loadFile(path.join(__dirname, 'src/player.html'));

    // 页面加载完成后发送媒体数据
    playerWindow.webContents.on('did-finish-load', () => {
      const mediaList = mediaSniffer.getMediaListByContainer(containerId);
      playerWindow.webContents.send('media:play-url', { url, mediaList, containerId, containerName });
    });

    // D-21: 窗口关闭时清理资源
    playerWindow.on('closed', () => {
      playerWindow = null;
      playerContainerId = null;
    });

    return { success: true, reused: false };
  });

  /**
   * 获取指定容器的媒体列表（供播放器窗口调用）
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>}
   */
  ipcMain.handle('media:get-media-list', (event, containerId) => {
    assertTrustedSender(event);
    if (!containerId || typeof containerId !== 'string') return [];
    return mediaSniffer.getMediaListByContainer(containerId);
  });

  /**
   * 切换播放器窗口全屏状态（per D-04）
   * @returns {Promise<{fullscreen: boolean}>}
   */
  ipcMain.handle('player:toggle-fullscreen', (event) => {
    const win = assertPlayerSender(event);
    win.setFullScreen(!win.isFullScreen());
    return { fullscreen: win.isFullScreen() };
  });

  /**
   * 最小化播放器窗口（per D-04）
   */
  ipcMain.handle('player:minimize', (event) => {
    const win = assertPlayerSender(event);
    win.minimize();
  });

  /**
   * 最大化/还原播放器窗口（per D-04）
   * @returns {Promise<{maximized: boolean}>}
   */
  ipcMain.handle('player:maximize', (event) => {
    const win = assertPlayerSender(event);
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return { maximized: win.isMaximized() };
  });

  /**
   * 关闭播放器窗口（per D-04）
   */
  ipcMain.handle('player:close', (event) => {
    const win = assertPlayerSender(event);
    win.close();
  });

  /**
   * 复制视频 URL 到系统剪贴板（per IPC-03）
   * @param {string} url - 视频 URL
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('media:copy-url', (event, url) => {
    assertTrustedSender(event);
    if (!url || typeof url !== 'string') {
      throw new Error('无效的 URL');
    }
    clipboard.writeText(url);
    return { success: true };
  });

  /**
   * 清空指定 webview 的媒体列表（per IPC-04）
   * @param {number} webContentsId - webview 的 webContents ID
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('media:clear-list', (event, webContentsId) => {
    assertTrustedSender(event);
    if (typeof webContentsId !== 'number') return { success: false };
    mediaSniffer.clearMediaList(webContentsId);
    return { success: true };
  });

  /**
   * 渲染进程上报脚本注入检测到的视频数据（per IPC-05）
   * 脚本注入检测结果从渲染进程回传到主进程 MediaSniffer 的唯一桥梁
   * @param {number} webContentsId - webview 的 webContents ID
   * @param {Array<Object>} videos - 检测到的视频数组
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('media:report-detected', (event, webContentsId, videos) => {
    assertTrustedSender(event);
    if (typeof webContentsId !== 'number') {
      throw new Error('无效的 webContentsId');
    }
    // 白名单校验（防御纵深，per G-29-12）：已注入的旧脚本（SPA 站内导航、
    // 开关变更前注入）上报时主进程兜底丢弃非白名单站点
    const whitelist = configStore.get('settings.mediaPlayer.whitelist', []);
    const wc = webContents.fromId(webContentsId);
    if (!wc || wc.isDestroyed()) {
      return { success: false };
    }
    if (!mediaSniffer.isDomainWhitelisted(wc.getURL(), whitelist)) {
      try {
        const hostname = new URL(wc.getURL()).hostname;
        console.warn(`[Realm IPC] media:report-detected 非白名单站点上报已丢弃: ${hostname}`);
      } catch {
        console.warn('[Realm IPC] media:report-detected 非白名单站点上报已丢弃（URL 无效）');
      }
      return { success: false };
    }
    mediaSniffer.handleScriptDetected(webContentsId, videos);
    return { success: true };
  });

  // ==================== 应用设置 ====================
  // 与 main.js handleSettingsApi 的 get 路由共享默认值，新增 key 时两处必须同步

  /**
   * 获取应用设置（主窗口渲染进程用；webview 内设置页走 HTTP /api/settings/get）
   * @returns {Object} 设置对象
   */
  ipcMain.handle('settings:get', (event) => {
    assertTrustedSender(event);
    const settings = configStore.get('settings', {
      historyRetentionDays: 30,
      defaultContainer: 'last-used',
      isDefaultBrowser: false,
      restoreTabsOnLaunch: 'ask',
    });
    // 多媒体播放器设置默认值（per D-03）
    if (!settings.mediaPlayer) {
      settings.mediaPlayer = { enabled: false, whitelist: [] };
    }
    return settings;
  });

  /**
   * 写入单个设置项
   * @param {string} key - 设置键
   * @param {*} value - 设置值
   * @returns {{success: boolean}}
   */
  ipcMain.handle('settings:set', (event, key, value) => {
    assertTrustedSender(event);
    if (!key || typeof key !== 'string') {
      throw new Error('无效的设置键');
    }
    configStore.set(`settings.${key}`, value);
    return { success: true };
  });

  console.log('[Realm] IPC 处理器已注册');
}

/**
 * 设置 AI Manager 实例
 * 由 main.js 在 AIManager 初始化完成后调用，供 IPC 处理器访问
 * @param {Object} manager - AIManager 实例
 */
function setAIManager(manager) {
  aiManager = manager;
}

module.exports = { registerHandlers, getActiveWebviewContentsId, getGuestContainer, unregisterGuestContainer, setAIManager };

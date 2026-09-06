/**
 * Realm Browser - IPC 处理器模块
 *
 * 集中注册所有 IPC 处理器，使用 container:* 命名格式
 * 每个处理器对入参做类型校验
 */

const { ipcMain, dialog, BrowserWindow, clipboard, session, webContents, app } = require('electron');
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
const credentialManager = require('./credential-manager');
const addressManager = require('./address-manager');
const favoritesManager = require('./favorites-manager');
const faviconFetcher = require('./favicon-fetcher');
const mediaSniffer = require('./media-sniffer');
const dragCoordinator = require('./drag-coordinator');
const autocompleteManager = require('./autocomplete-manager');
const aiAttachments = require('./ai-attachments-manager');
// 媒体缓存 key 工具（纯函数模块，Phase 44 D-12 续播匹配）
const { playbackKeyOf, videoIdOf } = require('./media-cache-manager');

// AI Manager 实例（由 main.js 通过 setAIManager 注入）
let aiManager = null;

// Search Manager 实例（由 main.js 通过 setSearchManager 注入）
let searchManager = null;

// 直播录制引擎实例（Phase 44 D-18，由 main.js 通过 setMediaRecordEngine 注入）
let recordEngine = null;

// 应用退出中标志（D-19：应用退出流程已有全局确认，播放器窗口 close 拦截不再重复弹录制确认）
let appQuitting = false;
app.on('before-quit', () => {
  appQuitting = true;
});

// 内部服务器信息（main.js 经 setRealmServerInfo 注入，Phase 44 D-02 独立窗口 localhost 化）
let realmServerInfo = { port: 0, token: '' };

// 媒体缓存与播放器观看历史实例（main.js 经 setMediaCaches 注入，Phase 44 D-03/D-11）
let mediaCache = null;
let playerHistory = null;

// 转换发起桥（main.js 经 setMediaConvertStarter 注入，Phase 44 D-22/D-24：
// D-17 服务端复校 + 弹框 + convert 任务编排都在 main.js，IPC 侧只透传）
let mediaConvertStarter = null;

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
 * 校验 IPC 调用方身份（CR-4 修复，D-11 泛化）
 * 接受所有 managedWindowIds 中的窗口（不再硬编码主窗口）；
 * webview guest、DevTools 或其他非管理窗口一律拒绝，
 * 防止被浏览网页/注入上下文直接 invoke 特权通道。
 * @param {Electron.IpcMainInvokeEvent} event - IPC 事件对象
 * @returns {BrowserWindow} 受信的窗口实例
 * @throws {Error} 来源不受信任时抛出
 */
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    throw new Error('不受信任的 IPC 来源');
  }
  if (!windowManager.isManagedWindow(win.id)) {
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
  // SVG 符号 ID：仅允许小写字母和连字符，最大 30 字符
  if (config.icon !== undefined) {
    if (typeof config.icon !== 'string' || !/^[a-z][a-z0-9-]{0,29}$/.test(config.icon)) {
      return false;
    }
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
  // SVG 符号 ID：仅允许小写字母和连字符，最大 30 字符
  if (updates.icon !== undefined) {
    if (typeof updates.icon !== 'string' || !/^[a-z][a-z0-9-]{0,29}$/.test(updates.icon)) {
      return false;
    }
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

/** 防重复注册守卫（Pitfall MW-5）：多窗口场景下 registerHandlers 只能调用一次 */
let handlersRegistered = false;

/**
 * 注册所有 IPC 处理器
 */
function registerHandlers() {
  if (handlersRegistered) {
    console.warn('[Realm] registerHandlers 已调用，跳过重复注册');
    return;
  }
  handlersRegistered = true;
  // WR-4：Tab 回收策略单点实现于主进程（tab-manager），
  // 回收发生时推送 tab:recycled 事件，渲染进程据此移除对应 DOM/webview 并提示
  tabManager.setRecycleListener(({ recycledTabId, message }) => {
    windowManager.broadcast('tab:recycled', { tabId: recycledTabId, message });
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
   * 获取当前窗口的 Tab 列表
   * 每个窗口只显示自己拥有的 Tab，不显示其他窗口的 Tab
   * @returns {Array} 当前窗口的 Tab 数组
   */
  ipcMain.handle('tab:list', (event) => {
    const win = assertTrustedSender(event);
    if (!win) return [];
    return tabManager.getTabsByWindowId(win.id);
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
    // 必须归属到来源窗口：windowId 缺失会导致 getTabsByWindowId 漏算，
    // 跨窗口移动后的"源窗口自动销毁"检查会把还有 Tab 的窗口误判为空（36-UAT 问题 8）
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && win.isDestroyed()) {
      throw new Error('来源窗口已销毁');
    }
    return tabManager.createTab(containerId, url, win ? win.id : null);
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
    const result = tabManager.closeTab(tabId);

    // 多窗口场景：关闭的是本窗口最后一个 Tab 且仍有其他窗口时，销毁本窗口
    // （单窗口保持现行为：渲染进程创建新 Tab）。
    // setImmediate 延迟销毁，让本 IPC 响应先回到渲染进程（携带 windowClosed 标记），
    // 渲染进程据此跳过"创建新 Tab"的兜底逻辑
    if (result.lastInWindow && windowManager.getWindowCount() > 1) {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        result.windowClosed = true;
        const winId = win.id;
        setImmediate(() => {
          windowManager.closeWindowWithTabs(winId, tabManager);
        });
      }
    }

    return result;
  });

  /**
   * 获取当前活动 Tab
   * @returns {Object|null} 活动 Tab 对象或 null
   */
  ipcMain.handle('tab:get-active', (event) => {
    assertTrustedSender(event);
    // 按发送窗口取活动 Tab：无参 getActiveTab 返回 activeTabs Map 的第一条，
    // 多窗口下可能是别的窗口的活动 Tab
    const win = BrowserWindow.fromWebContents(event.sender);
    return tabManager.getActiveTab(win ? win.id : undefined);
  });

  /**
   * 清空发送窗口的所有 Tab（含持久化 store）
   * 启动时渲染进程判定"不恢复"后调用，避免旧会话残留在 store 里
   *
   * 只清发送窗口自己的 Tab，不再全局清空：restoreTabs 的"不恢复"在次级窗口
   * 触发时，全局清空会把其他活窗口正在显示的 Tab 元数据一并抹掉，导致后续
   * 关标签被误判 lastInWindow 而销毁整个窗口。启动时全部 Tab 已由
   * migrateWindowlessTabs 归属主窗口，按窗口清空等价于原来的全局清空，
   * "旧会话不能复活"的持久化卫生不回退。
   *
   * @returns {{success: boolean}}
   */
  ipcMain.handle('tab:clear-all', (event) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      tabManager.closeTabsByWindowId(win.id);
    }
    return { success: true };
  });

  /**
   * 在新窗口中打开 Tab
   * 右键菜单"在新窗口中打开"或拖拽场景调用
   *
   * 时序策略：
   * 1. 创建窗口（injectedTabs 标记：renderer 的 restoreTabs 会跳过启动恢复分支，
   *    直接渲染 tab:list 拉到的 Tab，不受 restoreTabsOnLaunch 设置影响）
   * 2. 立即创建源 Tab——主进程同步执行，早于 renderer 脚本加载，
   *    renderer 的 restoreTabs 经 tab:list 天然拉到，无竞态；
   *    不依赖 did-finish-load（它不代表 restoreTabs 完成，也不能保证推送
   *    tab:created 被监听到——renderer 的 onTabCreated 在 restoreTabs 之后才注册）
   *
   * @param {string} tabId - 源 Tab ID
   * @param {Object} [options] - 选项
   * @param {boolean} [options.move=false] - 是否移动（true=从源窗口移除，false=保留原 Tab）
   * @returns {{success: boolean, newTabId?: string, windowId?: number}}
   */
  ipcMain.handle('tab:open-in-new-window', async (event, tabId, options = {}) => {
    assertTrustedSender(event);
    if (!tabId || typeof tabId !== 'string') {
      throw new Error('无效的 Tab ID');
    }

    const sourceTab = tabManager.getTab(tabId);
    if (!sourceTab) {
      return { success: false, error: 'Tab 不存在' };
    }

    const containerId = sourceTab.containerId;
    const container = containerManager.getContainer(containerId);
    if (!container) {
      return { success: false, error: '容器不存在' };
    }

    // 1. 创建新窗口（相对于源窗口偏移位置，带注入标记）
    const newWindow = windowManager.createMainWindow(containerId, container, {
      offsetPosition: true,
      injectedTabs: true,
    });
    if (!newWindow) {
      return { success: false, error: '创建窗口失败' };
    }

    // 2. 立即创建源 Tab（createTab 同时把它设为该窗口的活动 Tab）
    const newTab = tabManager.createTab(containerId, sourceTab.url, newWindow.id);

    // 移动模式：从源窗口移除原 Tab
    if (options.move) {
      tabManager.closeTab(tabId);
      const sourceWinId = sourceTab.windowId;
      if (sourceWinId) {
        const sourceWin = BrowserWindow.fromId(sourceWinId);
        if (sourceWin && !sourceWin.isDestroyed()) {
          sourceWin.webContents.send('tab:removed', { tabId });
        }
      }
    }

    // 兜底通知新窗口：renderer 若已注册监听则由 handleTabCreatedFromMain 去重跳过；
    // 未注册（restoreTabs 尚未完成）则静默丢弃，不影响主流程——Tab 已由 restoreTabs 拉取
    newWindow.webContents.send('tab:created', { tab: newTab });
    newWindow.webContents.send('tab:switched', { tabId: newTab.id });

    return { success: true, newTabId: newTab.id, windowId: newWindow.id };
  });

  /**
   * 获取当前窗口 ID
   * 渲染进程用于判断自身窗口身份（跨窗口拖拽等场景）
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @returns {number} BrowserWindow.id
   */
  ipcMain.handle('window:get-id', (event) => {
    const win = assertTrustedSender(event);
    return win.id;
  });

  // ==================== 跨窗口 Tab 拖拽（Phase 36 Plan 03） ====================

  /**
   * 拖拽开始：渲染进程在 mousedown + 超过阈值后调用
   * DragCoordinator 记录源窗口和 Tab ID，广播拖拽状态
   *
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {string} tabId - 被拖拽的 Tab ID
   * @returns {{ success: boolean }}
   */
  ipcMain.handle('drag:start', (event, tabId) => {
    assertTrustedSender(event);
    if (!tabId || typeof tabId !== 'string') {
      return { success: false, message: '无效的 Tab ID' };
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, message: '无法识别来源窗口' };
    return dragCoordinator.startDrag(win.id, tabId);
  });

  /**
   * 更新拖拽位置：渲染进程在 mousemove 时高频调用
   * DragCoordinator 更新全局位置，返回目标窗口信息
   *
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {Object} position - 鼠标位置 { x, y, screenX, screenY }
   * @returns {{ success: boolean, outOfTabBar?: boolean, targetWindow?: Object|null }}
   */
  ipcMain.handle('drag:update-position', (event, position) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false };
    return dragCoordinator.updatePosition(win.id, position);
  });

  /**
   * 拖拽结束：渲染进程在 mouseup 时调用
   * DragCoordinator 根据位置判断执行动作（新窗口/跨窗口移动/回滚）
   *
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @param {Object} data - 结束数据 { targetWindowId?, outOfTabBar? }
   * @returns {Promise<{success: boolean, action?: string}>}
   */
  ipcMain.handle('drag:end', async (event, data = {}) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, action: 'cancelled' };
    return dragCoordinator.endDrag(win.id, data);
  });

  /**
   * 取消拖拽：渲染进程按 Escape 或松手时目标无效时调用
   * DragCoordinator 清除状态并广播回滚
   *
   * @param {Electron.IpcMainInvokeEvent} event - IPC 事件
   * @returns {{ success: boolean }}
   */
  ipcMain.handle('drag:cancel', (event) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false };
    return dragCoordinator.cancelDrag(win.id);
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
      shortcutManager.rebuildShortcuts();
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
      shortcutManager.rebuildShortcuts();
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

  // ==================== 凭据管理 ====================

  /**
   * 保存凭据（per D-04, AF-02）
   * 使用 safeStorage 加密密码，加密不可用时拒绝存储
   * @param {Object} data - 凭据数据
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.url - 页面完整 URL
   * @param {string} data.origin - 页面 origin
   * @param {string} data.username - 用户名
   * @param {string} data.password - 明文密码
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  ipcMain.handle('credential:save', async (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || !data.containerId || !data.origin) {
      throw new Error('无效的凭据数据');
    }
    return await credentialManager.saveCredential(
      data.containerId, data.url, data.origin, data.username, data.password
    );
  });

  /**
   * 查询凭据（per AF-03）
   * 返回解密后的用户名和密码
   * @param {Object} params - 参数
   * @param {string} params.containerId - 容器 ID
   * @param {string} params.origin - 页面 origin
   * @returns {Promise<{username: string, password: string}|null>}
   */
  ipcMain.handle('credential:get', async (event, { containerId, origin }) => {
    assertTrustedSender(event);
    if (!containerId || !origin) {
      throw new Error('缺少必要参数');
    }
    return await credentialManager.getCredential(containerId, origin);
  });

  /**
   * 标记永不保存（per D-07）
   * @param {Object} params - 参数
   * @param {string} params.containerId - 容器 ID
   * @param {string} params.origin - 页面 origin
   * @returns {{success: boolean}}
   */
  ipcMain.handle('credential:never-save', (event, { containerId, origin }) => {
    assertTrustedSender(event);
    if (!containerId || !origin) {
      throw new Error('缺少必要参数');
    }
    return credentialManager.markNeverSave(containerId, origin);
  });

  /**
   * 检查是否永不保存
   * @param {Object} params - 参数
   * @param {string} params.containerId - 容器 ID
   * @param {string} params.origin - 页面 origin
   * @returns {boolean}
   */
  ipcMain.handle('credential:is-never-save', (event, { containerId, origin }) => {
    assertTrustedSender(event);
    if (!containerId || !origin) {
      throw new Error('缺少必要参数');
    }
    return credentialManager.isNeverSave(containerId, origin);
  });

  /**
   * 删除凭据记录
   * @param {Object} params - 参数
   * @param {string} params.containerId - 容器 ID
   * @param {string} params.origin - 页面 origin
   * @returns {{success: boolean}}
   */
  ipcMain.handle('credential:delete', (event, { containerId, origin }) => {
    assertTrustedSender(event);
    if (!containerId || !origin) {
      throw new Error('缺少必要参数');
    }
    return credentialManager.deleteCredential(containerId, origin);
  });

  // ==================== 地址管理 ====================

  /**
   * 保存地址（per AF-06）
   * 使用 safeStorage 加密存储姓名、手机号、地址
   * @param {Object} data - 地址数据
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.name - 收件人姓名
   * @param {string} data.phone - 手机号
   * @param {string} data.address - 详细地址
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  ipcMain.handle('address:save', async (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || !data.containerId || !data.name || !data.phone || !data.address) {
      throw new Error('无效的地址数据');
    }
    return await addressManager.saveAddress(
      data.containerId, data.name, data.phone, data.address
    );
  });

  /**
   * 查询地址（per AF-06）
   * 返回解密后的姓名、手机号、地址
   * @param {Object} params - 参数
   * @param {string} params.containerId - 容器 ID
   * @returns {Promise<{name: string, phone: string, address: string}|null>}
   */
  ipcMain.handle('address:get', async (event, { containerId }) => {
    assertTrustedSender(event);
    if (!containerId) {
      throw new Error('缺少 containerId 参数');
    }
    return await addressManager.getAddress(containerId);
  });

  /**
   * 删除地址记录
   * @param {Object} params - 参数
   * @param {string} params.containerId - 容器 ID
   * @returns {{success: boolean}}
   */
  ipcMain.handle('address:delete', (event, { containerId }) => {
    assertTrustedSender(event);
    if (!containerId) {
      throw new Error('缺少 containerId 参数');
    }
    return addressManager.deleteAddress(containerId);
  });

  // ==================== 地址栏自动补全 ====================

  /**
   * 查询地址栏自动补全建议
   * 合并收藏夹、常用网站和历史记录三个数据源，返回排序后的匹配结果
   * @param {Object} data - 查询参数
   * @param {string} data.keyword - 搜索关键词
   * @param {number} [data.limit=6] - 返回结果数量限制
   * @returns {Array<{url: string, title: string, faviconUrl: string, source: string}>} 补全建议列表
   */
  ipcMain.handle('autocomplete:query', (event, data) => {
    assertTrustedSender(event);
    if (!data || typeof data !== 'object' || typeof data.keyword !== 'string') {
      throw new Error('无效的查询参数');
    }
    return autocompleteManager.getSuggestions(data.keyword, data.limit || 6);
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
      windowManager.broadcast('bookmarks-bar:refresh');
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
    assertTrustedSender(event);
    activeWebviewContentsId = contentsId;
  });

  /**
   * 主进程侧聚焦指定 webview guest 的 webContents
   * renderer 侧 DOM webview.focus() 无法把键盘焦点从另一个 webview guest 中拉出
   * （Chromium 层限制，见 docs/debug/vim-hint-focus-cross-tab-failure.md），
   * 快捷键切标签后必须由主进程 WebContents.focus() 完成跨 guest 焦点转移
   * @param {number} contentsId - webview guest 的 webContents ID
   */
  ipcMain.handle('webview:focus-contents', (event, contentsId) => {
    assertTrustedSender(event);
    if (typeof contentsId !== 'number') return;
    const wc = webContents.fromId(contentsId);
    if (wc && !wc.isDestroyed()) {
      wc.focus();
    }
  });

  /**
   * 渲染进程上报 guest webContentsId → 容器 ID 映射
   * 主进程无法从 guest session 反推 partition（Electron 32 限制），
   * 容器分配规则匹配和 CDP 抓取依赖此映射
   * @param {number} contentsId - webview guest 的 webContents ID
   * @param {string} containerId - 容器 ID
   */
  ipcMain.handle('webview:register-container', (event, contentsId, containerId) => {
    assertTrustedSender(event);
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
   * @returns {Promise<{success: boolean, conversationId: string|null}>} conversationId 为本轮对话 id（首条消息惰性建行后回传 renderer，per G-42-2），失败时为 null
   */
  ipcMain.handle('ai:prompt', async (event, message) => {
    assertTrustedSender(event);
    if (!message || typeof message !== 'string') {
      throw new Error('无效的消息');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    const conversationId = await aiManager.prompt(message);
    return { success: true, conversationId };
  });

  /**
   * 发送带上下文引用的 AI 消息
   * @param {Object} data - 消息数据
   * @param {string} data.message - 用户消息
   * @param {Array} data.referencedTabs - 引用的标签页列表
   * @returns {Promise<{success: boolean, conversationId: string|null}>} conversationId 为本轮对话 id（per G-42-2），失败时为 null
   */
  ipcMain.handle('ai:prompt-with-context', async (event, data) => {
    assertTrustedSender(event);
    // 正文可为空串（纯附件发送，marker 文本兜底语义），但必须有消息字段；
    // 空正文时必须携带附件
    if (!data || typeof data.message !== 'string') {
      throw new Error('无效的消息');
    }
    const attachmentIds = Array.isArray(data.attachmentIds) ? data.attachmentIds : [];
    if (!data.message && attachmentIds.length === 0) {
      throw new Error('无效的消息');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    const conversationId = await aiManager.promptWithContext(
      data.message,
      data.referencedTabs || [],
      attachmentIds,
      data.supportsVision !== false,
    );
    return { success: true, conversationId };
  });

  // ==================== AI 聊天附件 ====================

  /**
   * 登记路径型聊天附件（拖拽/粘贴的本地文件，主进程复制快照进 agent-workspace/attachments/）
   * 授权语义：用户拖入/粘贴即显式授权（rule:import / cookie:import 先例），不走确认卡片
   * @param {string[]} paths - 源绝对路径数组
   * @returns {Promise<{attachments: Array, errors: Array<{path: string, reason: string}>}>} 部分成功语义
   */
  ipcMain.handle('ai:attach-files', async (event, paths) => {
    assertTrustedSender(event);
    if (!Array.isArray(paths)) {
      throw new Error('无效的路径列表');
    }
    return aiAttachments.registerFiles(paths);
  });

  /**
   * 登记 blob 型聊天附件（截图等无路径内存数据，base64 落盘到 attachments 目录）
   * @param {{name?: string, mimeType?: string, base64: string}} payload - 附件数据
   * @returns {Promise<{attachment: Object|null, error?: string}>}
   */
  ipcMain.handle('ai:attach-blob', async (event, payload) => {
    assertTrustedSender(event);
    if (!payload || typeof payload.base64 !== 'string') {
      throw new Error('无效的附件数据');
    }
    return aiAttachments.registerBlob(payload);
  });

  /**
   * 读取图片附件预览 data URL（气泡/胶囊缩略图；仅图片且 ≤2MB）
   * @param {string} attachmentId - 登记 ID
   * @returns {Promise<{dataUrl: string|null}>}
   */
  ipcMain.handle('ai:read-attachment-preview', async (event, attachmentId) => {
    assertTrustedSender(event);
    const dataUrl = await aiAttachments.readPreviewDataUrl(attachmentId);
    return { dataUrl };
  });

  /**
   * 读取图片附件内联渲染数据（聊天气泡渲染；id 或 attachments 目录内路径）
   * 路径入口经主进程校验必须落在 agent-workspace/attachments/ 内，伪造/越界返回 null
   * @param {{id?: string, path?: string}} payload - 登记 ID 或快照路径
   * @returns {Promise<{dataUrl: string|null}>}
   */
  ipcMain.handle('ai:read-attachment-image', async (event, payload) => {
    assertTrustedSender(event);
    const dataUrl = await aiAttachments.readImageDataUrl(payload || {});
    return { dataUrl };
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
   * 压缩当前对话上下文（/compact）
   * @param {Object} [options] - { focus?: string } 用户指定的摘要重点
   * @returns {Promise<Object>} { success, skipped?, message?, before, after, tokensBefore, tokensAfter }
   */
  ipcMain.handle('ai:compact-conversation', async (event, options) => {
    assertTrustedSender(event);
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    if (options !== undefined && options !== null && typeof options !== 'object') {
      throw new Error('无效的参数');
    }
    return aiManager.compactConversation(options || {});
  });

  /**
   * 配置 AI 提供商 API Key
   * @param {Object} config - { provider: string, apiKey: string }
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('ai:configure', async (event, config) => {
    assertTrustedSender(event);
    if (!config || !config.provider) {
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

  /**
   * 开始新对话：重置 Agent 的消息 transcript 和流式状态
   * @returns {{success: boolean}}
   */
  ipcMain.handle('ai:new-conversation', async (event) => {
    assertTrustedSender(event);
    if (aiManager) {
      aiManager.newConversation();
    }
    return { success: true };
  });

  // ==================== AI 对话管理 IPC 通道 ====================

  /**
   * 获取对话列表
   * @param {number} [limit=50] - 返回数量上限
   * @returns {Promise<{conversations: Array}>}
   */
  ipcMain.handle('ai:get-conversations', async (event, limit) => {
    assertTrustedSender(event);
    if (!aiManager) {
      return { conversations: [] };
    }
    return { conversations: aiManager.getConversations(limit) };
  });

  /**
   * 创建新对话
   * @returns {Promise<{conversation: Object}>}
   */
  ipcMain.handle('ai:create-conversation', async (event) => {
    assertTrustedSender(event);
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    // createNewConversation 现为 async（per WR-05）：必须 await 拿到对话对象，
    // 否则返回值里嵌 Promise 无法经 IPC 结构化克隆序列化
    return { conversation: await aiManager.createNewConversation() };
  });

  /**
   * 切换对话
   * @param {string} conversationId - 目标对话 ID
   * @returns {Promise<{conversation: Object, messages: Array}>}
   */
  ipcMain.handle('ai:switch-conversation', async (event, conversationId) => {
    assertTrustedSender(event);
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('对话 ID 不能为空');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    // switchConversation 为异步（await _recreateAgent 后注入历史上下文，per G-42-4）
    const conversation = await aiManager.switchConversation(conversationId);
    // 从数据库加载该对话的历史消息（renderer 显示形状），一并返回给渲染进程
    const messages = aiManager.getConversationMessages(conversationId);
    return { conversation, messages };
  });

  /**
   * 获取对话消息（renderer 显示形状，轻量只读——不切换/不重建 Agent）
   * 供 /compact 完成后刷新当前消息列表
   * @param {string} conversationId - 对话 ID
   * @returns {Promise<Array>} 显示形状消息列表
   */
  ipcMain.handle('ai:get-conversation-messages', async (event, conversationId) => {
    assertTrustedSender(event);
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('对话 ID 不能为空');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    return aiManager.getConversationMessages(conversationId);
  });

  /**
   * 删除对话
   * @param {string} conversationId - 要删除的对话 ID
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('ai:delete-conversation', async (event, conversationId) => {
    assertTrustedSender(event);
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('对话 ID 不能为空');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    return { success: aiManager.deleteConversation(conversationId) };
  });

  /**
   * 重命名对话
   * @param {string} conversationId - 对话 ID
   * @param {string} newTitle - 新标题
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('ai:rename-conversation', async (event, conversationId, newTitle) => {
    assertTrustedSender(event);
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('对话 ID 不能为空');
    }
    if (!newTitle || typeof newTitle !== 'string') {
      throw new Error('标题不能为空');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    return { success: aiManager.renameConversation(conversationId, newTitle) };
  });

  // ==================== 播放器窗口状态 ====================

  /** @type {BrowserWindow|null} 播放器窗口引用（D-20 窗口复用） */
  let playerWindow = null;
  /** @type {string|null} 播放器关联的容器 ID（D-22 Session 隔离） */
  let playerContainerId = null;
  /** @type {boolean} close 拦截放行标记（Pitfall 6 最终进度索取后二次 close） */
  let playerClosing = false;

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

    // Phase 44 D-02：独立播放窗口从 file:// 收口到 localhost——hls.js 请求统一走
    // /proxy 同源代理（token 鉴权、容器 session 携带 Cookie、Referer 可控），
    // 并带 cache=1（D-01 仅独立窗口缓存）与 mode=independent（player.js 第三形态
    // 判定：保留标题栏与红绿灯，不进 webview tab 隐藏标题栏分支）。mediaList 仍走
    // did-finish-load 后 media:play-url IPC 传递。服务器未启动时回落 file:// 兜底
    if (realmServerInfo.port && realmServerInfo.token) {
      const playParams = new URLSearchParams({
        url,
        token: realmServerInfo.token,
        container: containerId,
        referer: '',
        cache: '1',
        mode: 'independent',
      });
      playerWindow.loadURL(`http://localhost:${realmServerInfo.port}/player/?${playParams}`);
    } else {
      console.warn('[Realm] 内部页面服务器未就绪，播放器窗口回落 file:// 加载');
      playerWindow.loadFile(path.join(__dirname, 'src/player.html'));
    }

    // 页面加载完成后发送媒体数据
    playerWindow.webContents.on('did-finish-load', () => {
      const mediaList = mediaSniffer.getMediaListByContainer(containerId);
      playerWindow.webContents.send('media:play-url', { url, mediaList, containerId, containerName });
    });

    // Phase 44 D-13/Pitfall 6：关窗兜底——close 时向 renderer 索取一次最终进度
    //（窗口销毁后 async IPC 会丢，必须在销毁前要），超时 500ms 兜底放行
    playerWindow.on('close', (event) => {
      if (playerClosing || !playerWindow || playerWindow.isDestroyed()) return;
      event.preventDefault();

      /** 关窗序列：先向 renderer 索取最终进度（ack/500ms 超时双保险）后放行 */
      const beginCloseSequence = () => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(finishTimer);
          playerClosing = true;
          try {
            if (playerWindow && !playerWindow.isDestroyed()) playerWindow.close();
          } catch (err) {
            console.warn('[Realm] 播放器窗口关闭放行失败:', err.message);
          }
        };
        const ackHandler = () => finish();
        ipcMain.once('player:final-progress-ack', ackHandler);
        const finishTimer = setTimeout(() => {
          ipcMain.removeListener('player:final-progress-ack', ackHandler);
          finish();
        }, 500);
        playerWindow.webContents.send('player:request-final-progress');
      };

      // Phase 44 D-19：有活跃录制任务时确认。应用退出流程已有全局确认
      //（before-quit hasActiveTasks 分支），appQuitting 时跳过避免双重弹窗
      const activeRecords = recordEngine ? recordEngine.getActiveRecordings() : [];
      if (activeRecords.length > 0 && !appQuitting) {
        const remembered = configStore.get('settings.recordCloseAction', null);
        if (remembered !== 'keep-recording' && remembered !== 'stop-save') {
          // 未记忆默认选择：弹一次（checkbox「记住我的选择」写 settings.recordCloseAction）
          dialog.showMessageBox(playerWindow, {
            type: 'question',
            buttons: ['继续后台录制', '停止并保存'],
            defaultId: 0,
            message: '播放器窗口即将关闭，有正在进行的录制任务。',
            detail: '继续后台录制时任务在主进程独立运行，可在任务页查看进度与停止。',
            checkboxLabel: '记住我的选择',
            noLink: true,
          }).then(({ response, checkboxChecked }) => {
            // Esc/取消（response 非 0/1）：不关窗，留在播放器
            if (response !== 0 && response !== 1) return;
            if (checkboxChecked) {
              configStore.set('settings.recordCloseAction', response === 0 ? 'keep-recording' : 'stop-save');
            }
            if (response === 1) {
              // 停止并保存：等引擎写完索引后继续关窗序列
              recordEngine.stopAll()
                .catch((err) => console.warn('[Realm] 关窗停止录制失败:', err.message))
                .then(beginCloseSequence);
            } else {
              beginCloseSequence();
            }
          }).catch((err) => {
            console.warn('[Realm] 关窗录制确认对话框失败:', err.message);
          });
          return;
        }
        if (remembered === 'stop-save') {
          // 已记忆「停止并保存」：直接执行
          recordEngine.stopAll()
            .catch((err) => console.warn('[Realm] 关窗停止录制失败:', err.message))
            .then(beginCloseSequence);
          return;
        }
        // remembered === 'keep-recording'：录制继续，直接走关窗序列
      }
      beginCloseSequence();
    });

    // D-21: 窗口关闭时清理资源
    playerWindow.on('closed', () => {
      playerWindow = null;
      playerContainerId = null;
      playerClosing = false;
    });

    // 全屏状态变化时通知渲染进程（Electron setFullScreen 不会触发 DOM fullscreenchange）
    playerWindow.on('enter-full-screen', () => {
      if (!playerWindow.isDestroyed()) {
        playerWindow.webContents.send('player:fullscreen-changed', true);
      }
    });
    playerWindow.on('leave-full-screen', () => {
      if (!playerWindow.isDestroyed()) {
        playerWindow.webContents.send('player:fullscreen-changed', false);
      }
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

  // ==================== 播放器观看历史与缓存（Phase 44 D-11~D-16） ====================

  /**
   * 播放进度落盘（D-11/D-13，单向 send）：写观看历史（player_history 表 upsert）
   * 并同步刷新缓存元数据的 last_position/last_watched（双层同步）
   */
  ipcMain.on('player:progress', (event, data) => {
    assertPlayerSender(event);
    if (!data || typeof data !== 'object' || !data.url || typeof data.url !== 'string') return;
    const position = Number(data.position) || 0;
    const duration = Number(data.duration) || 0;
    const title = typeof data.title === 'string' ? data.title : '';
    try {
      if (playerHistory) {
        playerHistory.upsertProgress({
          playbackKey: playbackKeyOf(data.url),
          url: data.url,
          title,
          position,
          duration,
          lastWatched: Date.now(),
        });
      }
      if (mediaCache) mediaCache.updateProgress(data.url, position);
    } catch (err) {
      console.error('[Realm] 播放进度落盘失败:', err.message);
    }
  });

  /**
   * 查询续播位置（D-12）：主进程按 playbackKey（origin+pathname，query 时效
   * token 不参与）查观看历史，renderer 在 loadedmetadata 后 seek
   * @param {string} url - 视频 URL
   * @returns {Promise<{position: number, duration: number, url: string}|null>}
   */
  ipcMain.handle('player:resume-position', (event, url) => {
    assertPlayerSender(event);
    if (!url || typeof url !== 'string' || !playerHistory) return null;
    try {
      const row = playerHistory.getByKey(playbackKeyOf(url));
      if (!row) return null;
      return { position: row.last_position, duration: row.duration, url: row.url };
    } catch (err) {
      console.error('[Realm] 续播位置查询失败:', err.message);
      return null;
    }
  });

  /**
   * 抽屉列表数据（D-14/D-15）：缓存库条目 + 观看历史双层合并，按 last_watched
   * 降序。条目 { title, url, playbackKey, cacheSize, completeness, lastPosition,
   * lastWatched }——缓存条目含大小，纯历史条目 cacheSize 为 0
   * @returns {Promise<Array>}
   */
  ipcMain.handle('player:drawer:list', (event) => {
    assertPlayerSender(event);
    const merged = new Map();
    try {
      if (playerHistory) {
        for (const row of playerHistory.listRecent(200)) {
          merged.set(row.playback_key, {
            title: row.title || '',
            url: row.url,
            playbackKey: row.playback_key,
            cacheSize: 0,
            completeness: null,
            lastPosition: row.last_position || 0,
            duration: row.duration || 0,
            lastWatched: row.last_watched || 0,
          });
        }
      }
      if (mediaCache) {
        for (const e of mediaCache.listEntries()) {
          const key = e.meta.playback_key || '';
          if (!key) continue;
          const existing = merged.get(key);
          const item = existing || {
            title: '',
            url: e.meta.m3u8_url || '',
            playbackKey: key,
            cacheSize: 0,
            completeness: null,
            lastPosition: 0,
            duration: 0,
            lastWatched: 0,
          };
          item.cacheSize = e.size || 0;
          // 完整度（44-05 补齐 44-01 预留，D-17 分母）：已登记分片数 / 清单分片总数
          //（updatePlaylistIndex 在 m3u8 请求时登记；无清单索引时为 null → 转换按钮隐藏）
          if (e.meta.total_segments > 0 && e.meta.segments) {
            const present = Object.keys(e.meta.segments).length;
            item.completeness = Math.min(100, Math.round((present / e.meta.total_segments) * 100));
          }
          if (!item.title && e.meta.title) item.title = e.meta.title;
          if (!item.url && e.meta.m3u8_url) item.url = e.meta.m3u8_url;
          if (e.meta.last_position) item.lastPosition = Math.max(item.lastPosition, e.meta.last_position);
          item.lastWatched = Math.max(item.lastWatched, e.meta.last_watched || 0);
          merged.set(key, item);
        }
      }
    } catch (err) {
      console.error('[Realm] 抽屉列表合并失败:', err.message);
    }
    return Array.from(merged.values()).sort((a, b) => b.lastWatched - a.lastWatched);
  });

  /**
   * 删除缓存条目（D-16 后端）：按 videoId 整目录删缓存，观看历史记录保留
   *（删除确认文案「观看历史保留」语义）
   * @param {string} videoId - 视频目录 ID（16 位 hex）
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  ipcMain.handle('player:cache:delete', (event, videoId) => {
    assertPlayerSender(event);
    // 抽屉条目数据携带 playbackKey（origin+pathname），此处兼容两种入参：
    // 16 位 hex videoId 或 playbackKey（经 videoIdOf 换算）
    if (videoId && typeof videoId === 'string' && !/^[a-f0-9]{16}$/.test(videoId)) {
      try {
        videoId = videoIdOf(videoId);
      } catch {
        return { success: false, error: '无效的缓存条目 ID' };
      }
    }
    if (!videoId || typeof videoId !== 'string' || !/^[a-f0-9]{16}$/.test(videoId)) {
      return { success: false, error: '无效的缓存条目 ID' };
    }
    if (!mediaCache) return { success: false, error: '缓存模块未初始化' };
    // 注意：观看历史（player_history）独立存储，此处不动——D-16「观看历史保留」
    return mediaCache.deleteEntry(videoId);
  });

  // ==================== 直播录制（Phase 44 D-18/D-20/D-21） ====================

  /** 录制任务 containerId 校验（沿 43 期 /^[\w-]+$/ 惯例，T-44-12） */
  function isValidContainerId(containerId) {
    return typeof containerId === 'string' && /^[\w-]+$/.test(containerId);
  }

  /**
   * 发起直播录制（D-18：显式后台任务）。引擎在主进程独立轮询 m3u8 追分片，
   * 与播放状态完全解耦（D-20）。同 URL 已在录/并发超限返回结构化拒绝原因。
   * @param {{ url: string, title: string, containerId: string, referer?: string }} input
   * @returns {Promise<{success: boolean, taskId?: string, error?: string}>}
   */
  ipcMain.handle('player:record/start', async (event, input) => {
    assertPlayerSender(event);
    if (!recordEngine) return { success: false, error: '录制引擎未初始化' };
    if (!input || typeof input !== 'object') {
      return { success: false, error: '无效的录制参数' };
    }
    const { url, title, containerId, referer } = input;
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { success: false, error: '无效的录制 URL' };
    }
    if (!title || typeof title !== 'string') {
      return { success: false, error: '无效的录制标题' };
    }
    if (!isValidContainerId(containerId)) {
      return { success: false, error: '无效的容器 ID' };
    }
    const result = await recordEngine.startRecord({
      url,
      title,
      containerId,
      referer: typeof referer === 'string' ? referer : '',
    });
    if (!result.ok) {
      const reasonText = {
        already_recording: '该视频已在录制中',
        concurrency_limit: '录制任务已达并发上限',
        invalid_input: '无效的录制参数',
      };
      return { success: false, error: reasonText[result.reason] || '录制启动失败' };
    }
    return { success: true, taskId: result.taskId };
  });

  /**
   * 停止录制并保存（D-19 红点点击/「停止并保存」路径）：停轮询 → 写分片索引
   * meta.json → completeTask（D-22 转码接力由 44-05 消费）
   * @param {string} taskId - 任务 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  ipcMain.handle('player:record/stop', async (event, taskId) => {
    assertPlayerSender(event);
    if (!recordEngine) return { success: false, error: '录制引擎未初始化' };
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: '缺少任务 ID' };
    }
    const result = await recordEngine.stopRecord(taskId);
    if (!result.ok) {
      return { success: false, error: result.reason === 'not_found' ? '录制任务不存在或已结束' : (result.reason || '停止失败') };
    }
    return { success: true };
  });

  /**
   * 查询录制状态（D-21 红点 hover 数据：已录时长≈分片数×targetDuration、已录大小）
   * @param {string} taskId - 任务 ID
   * @returns {Promise<Object|null>}
   */
  ipcMain.handle('player:record/status', (event, taskId) => {
    assertPlayerSender(event);
    if (!recordEngine || !taskId || typeof taskId !== 'string') return null;
    return recordEngine.getRecordStatus(taskId);
  });

  /**
   * 运行中录制任务列表（播放器窗口重开后红点状态同步——keep-recording 关窗
   * 后再开同一视频，红点需按主进程任务实况恢复）
   * @returns {Promise<Array>}
   */
  ipcMain.handle('player:record/list', (event) => {
    assertPlayerSender(event);
    if (!recordEngine) return [];
    return recordEngine.getActiveRecordings();
  });

  /**
   * 发起 MP4 转换（Phase 44 D-17/D-22/D-24）：entryId（缓存条目，playbackKey
   * 或 videoId）或 taskId（record 任务续转）。D-17 校验（完整度 100%/中断续转/
   * discontinuity 拒转）在 main.js 的 startConvertFromInput 服务端复校——
   * 前端按钮 gating 属纵深防御（T-44-16：分片路径仅取自索引，不接受 renderer 传路径）
   * @param {{ entryId?: string, taskId?: string }} input
   * @returns {Promise<{ok: boolean, taskId?: string, reason?: string}>}
   */
  ipcMain.handle('player:convert/start', async (event, input) => {
    assertPlayerSender(event);
    if (!mediaConvertStarter) return { ok: false, reason: 'not_ready' };
    if (!input || typeof input !== 'object' ||
        (typeof input.entryId !== 'string' && typeof input.taskId !== 'string')) {
      return { ok: false, reason: 'invalid_input' };
    }
    return mediaConvertStarter(input);
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
   * 通用剪贴板写入文本
   * @param {string} text - 要写入的文本
   * @returns {{success: boolean}}
   */
  ipcMain.handle('clipboard:write-text', (event, text) => {
    assertTrustedSender(event);
    if (typeof text !== 'string') return { success: false };
    clipboard.writeText(text);
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
      theme: 'light',
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

  // ==================== 搜索配置 ====================

  /**
   * 获取搜索配置（主窗口渲染进程用；webview 内设置页走 HTTP /api/search-config/get）
   * @returns {{provider: string, apiKeys: Object}}
   */
  ipcMain.handle('search-config:get', (event) => {
    assertTrustedSender(event);
    return {
      provider: configStore.get('search.provider', 'auto'),
      apiKeys: configStore.get('search.apiKeys', {}),
    };
  });

  /**
   * 写入搜索配置
   * @param {Object} config - { provider?: string, apiKeys?: Object }
   * @returns {{success: boolean}}
   */
  ipcMain.handle('search-config:set', (event, config) => {
    assertTrustedSender(event);
    // 校验 provider 为已知字符串
    const VALID_PROVIDERS = ['auto', 'tavily', 'brave', 'serper', 'anysearch', 'anysearch_free'];
    if (config.provider) {
      if (typeof config.provider !== 'string' || !VALID_PROVIDERS.includes(config.provider)) {
        return { success: false, error: '无效的搜索 Provider' };
      }
      configStore.set('search.provider', config.provider);
    }
    // 校验 apiKeys 为对象且值为字符串
    if (config.apiKeys) {
      if (typeof config.apiKeys !== 'object' || Array.isArray(config.apiKeys)) {
        return { success: false, error: '无效的 apiKeys 格式' };
      }
      for (const [k, v] of Object.entries(config.apiKeys)) {
        if (typeof k !== 'string' || typeof v !== 'string') {
          return { success: false, error: 'apiKeys 键值必须为字符串' };
        }
      }
      configStore.set('search.apiKeys', config.apiKeys);
    }
    return { success: true };
  });

  /**
   * 验证搜索 Provider API Key
   * 发送测试查询验证 Key 有效性（D-13: 固定查询词 'test'）
   * @param {Object} params - { provider: string, apiKey: string }
   * @returns {Promise<{valid: boolean, provider?: string, error?: string}>}
   */
  ipcMain.handle('search-config:verify-key', async (event, { provider, apiKey }) => {
    assertTrustedSender(event);
    // 临时写入单个 provider key（不影响其他 provider）
    const origKey = configStore.get(`search.apiKeys.${provider}`);
    configStore.set(`search.apiKeys.${provider}`, apiKey);
    // 临时切换到指定 Provider（避免 auto 模式回退到免费 Provider）
    const origProvider = configStore.get('search.provider');
    configStore.set('search.provider', provider);
    try {
      const result = await searchManager.doSearch('test', 1);
      return { valid: true, provider: result.provider };
    } catch (err) {
      return { valid: false, error: err.message };
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
  });

  // ==================== 应用级操作 ====================

  /**
   * 查询当前应用是否为系统默认浏览器
   * @returns {{ isDefault: boolean }}
   */
  ipcMain.handle('app:is-default-browser', () => {
    const { app } = require('electron');
    const isDefault = app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
    return { isDefault };
  });

  /**
   * 将当前应用注册为系统默认浏览器
   * macOS 12+ 会弹出系统确认框，用户确认后才真正生效；
   * 确认前 setAsDefaultProtocolClient 的同步返回值为 false，不能作为失败依据，
   * 真实结果由调用方随后查询 app:is-default-browser 判定
   * @returns {{ success: boolean }}
   */
  ipcMain.handle('app:set-default-browser', () => {
    const { app } = require('electron');
    const httpOk = app.setAsDefaultProtocolClient('http');
    const httpsOk = app.setAsDefaultProtocolClient('https');
    console.log('[Realm] setAsDefaultProtocolClient:', { httpOk, httpsOk });
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

/**
 * 设置 Search Manager 实例
 * 由 main.js 在 searchManager 初始化完成后调用，供 IPC 处理器访问
 * @param {Object} manager - SearchManager 实例
 */
function setSearchManager(manager) {
  searchManager = manager;
}

/**
 * 注入内部服务器端口与 token（Phase 44 D-02 独立窗口 localhost 化）
 * main.js 在 realmServer listen 回调中调用（ipc-handlers 无 main.js 作用域）
 * @param {{port: number, token: string}} info
 */
function setRealmServerInfo(info) {
  if (info && typeof info.port === 'number' && typeof info.token === 'string') {
    realmServerInfo = { port: info.port, token: info.token };
  }
}

/**
 * 注入媒体缓存与播放器观看历史实例（Phase 44 D-03/D-11）
 * 由 main.js 在两者初始化完成后调用
 * @param {Object} opts
 * @param {Object} opts.mediaCache - MediaCacheManager 实例
 * @param {Object} opts.playerHistory - player-history-manager 模块
 */
function setMediaCaches({ mediaCache: cache, playerHistory: history }) {
  mediaCache = cache || null;
  playerHistory = history || null;
}

/**
 * 注入直播录制引擎实例（Phase 44 D-18/D-19）
 * 由 main.js 在 mediaTaskManager/mediaCache 初始化完成后调用
 * @param {Object} engine - createRecordEngine 实例
 */
function setMediaRecordEngine(engine) {
  recordEngine = engine || null;
}

/**
 * 注入转换发起桥（Phase 44 D-22/D-24）
 * @param {Function} starter - (input: { entryId?, taskId? }) => Promise<{ok, taskId?, reason?}>
 */
function setMediaConvertStarter(starter) {
  mediaConvertStarter = typeof starter === 'function' ? starter : null;
}

module.exports = { registerHandlers, getActiveWebviewContentsId, getGuestContainer, unregisterGuestContainer, setAIManager, setSearchManager, setRealmServerInfo, setMediaCaches, setMediaRecordEngine, setMediaConvertStarter };

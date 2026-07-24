/**
 * Realm Browser - IPC 处理器模块
 *
 * 集中注册所有 IPC 处理器，使用 container:* 命名格式
 * 每个处理器对入参做类型校验
 */

const { ipcMain, dialog, BrowserWindow } = require('electron');
const containerManager = require('./container-manager');
const windowManager = require('./window-manager');
const tabManager = require('./tab-manager');
const cookieManager = require('./cookie-manager');
const assignmentRules = require('./assignment-rules');
const shortcutManager = require('./shortcut-manager');

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
  if (config.color && typeof config.color !== 'string') {
    return false;
  }
  if (config.icon && typeof config.icon !== 'string') {
    return false;
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
  if (updates.color !== undefined && typeof updates.color !== 'string') {
    return false;
  }
  if (updates.icon !== undefined && typeof updates.icon !== 'string') {
    return false;
  }
  return true;
}

/**
 * 注册所有 IPC 处理器
 */
function registerHandlers() {
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
   * @returns {{success: boolean, message?: string}} 操作结果
   */
  ipcMain.handle('container:delete', (event, id) => {
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
    return shortcutManager.setShortcut(action, accelerator);
  });

  console.log('[Realm] IPC 处理器已注册');
}

module.exports = { registerHandlers };

/**
 * Realm Browser - Preload 脚本
 *
 * 安全地将 IPC 接口暴露给渲染进程
 * 使用 contextBridge 确保隔离性
 * 使用 container:* 新格式 IPC 通道
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 暴露给渲染进程的 API
 */
contextBridge.exposeInMainWorld('realmAPI', {
  /**
   * 获取所有容器列表
   * @returns {Promise<Array<{id: string, name: string, color: string, icon: string}>>}
   */
  getContainers: () => ipcRenderer.invoke('container:list'),

  /**
   * 获取当前窗口的容器 ID
   * @returns {Promise<string>}
   */
  getCurrentContainer: () => ipcRenderer.invoke('container:current'),

  /**
   * 切换当前窗口的容器
   * @param {string} containerId - 目标容器 ID
   * @returns {Promise<boolean>}
   */
  switchContainer: (containerId) => ipcRenderer.invoke('container:switch', containerId),

  /**
   * 创建新容器
   * @param {Object} containerConfig - 容器配置
   * @param {string} containerConfig.name - 容器名称
   * @param {string} [containerConfig.color] - 容器颜色
   * @param {string} [containerConfig.icon] - 容器图标
   * @returns {Promise<Object>} 创建的容器对象
   */
  createContainer: (containerConfig) => ipcRenderer.invoke('container:create', containerConfig),

  /**
   * 更新容器配置
   * @param {string} id - 容器 ID
   * @param {Object} updates - 更新内容
   * @param {string} [updates.name] - 新名称
   * @param {string} [updates.color] - 新颜色
   * @param {string} [updates.icon] - 新图标
   * @returns {Promise<Object>} 更新后的容器对象
   */
  updateContainer: (id, updates) => ipcRenderer.invoke('container:update', id, updates),

  /**
   * 删除容器
   * @param {string} containerId - 要删除的容器 ID
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  deleteContainer: (containerId) => ipcRenderer.invoke('container:delete', containerId),

  /**
   * 获取容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>} Cookie 数组
   */
  getContainerCookies: (containerId) => ipcRenderer.invoke('container:get-cookies', containerId),

  /**
   * 清除容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<boolean>} 是否成功清除
   */
  clearContainerCookies: (containerId) => ipcRenderer.invoke('container:clear-cookies', containerId),

  /**
   * 监听容器切换事件
   * @param {Function} callback - 回调函数
   */
  onContainerSwitched: (callback) => {
    ipcRenderer.on('container-switched', (event, data) => callback(data));
  },

  // ==================== Tab 管理 ====================

  /**
   * 获取所有 Tab
   * @returns {Promise<Array>} Tab 数组
   */
  getTabs: () => ipcRenderer.invoke('tab:list'),

  /**
   * 创建新 Tab
   * @param {string} containerId - 容器 ID
   * @param {string} [url] - 初始 URL
   * @returns {Promise<Object>} 新创建的 Tab 对象
   */
  createTab: (containerId, url) => ipcRenderer.invoke('tab:create', containerId, url),

  /**
   * 切换到指定 Tab
   * @param {string} tabId - Tab ID
   * @returns {Promise<boolean>} 是否成功切换
   */
  switchTab: (tabId) => ipcRenderer.invoke('tab:switch', tabId),

  /**
   * 更新 Tab 信息
   * @param {string} tabId - Tab ID
   * @param {Object} updates - 更新内容
   * @returns {Promise<boolean>} 是否成功更新
   */
  updateTab: (tabId, updates) => ipcRenderer.invoke('tab:update', tabId, updates),

  /**
   * 关闭 Tab
   * @param {string} tabId - Tab ID
   * @returns {Promise<Object>} 关闭结果
   */
  closeTab: (tabId) => ipcRenderer.invoke('tab:close', tabId),

  /**
   * 获取当前活动 Tab
   * @returns {Promise<Object|null>} 活动 Tab 对象或 null
   */
  getActiveTab: () => ipcRenderer.invoke('tab:get-active'),

  // ==================== Cookie 管理 ====================

  /**
   * 保存容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, count: number}>}
   */
  saveCookie: (containerId) => ipcRenderer.invoke('cookie:save', containerId),

  /**
   * 加载容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, count: number}>}
   */
  loadCookie: (containerId) => ipcRenderer.invoke('cookie:load', containerId),

  /**
   * 导出容器 Cookie
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  exportCookie: (containerId) => ipcRenderer.invoke('cookie:export', containerId),

  /**
   * 导入 Cookie 到容器
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  importCookie: (containerId) => ipcRenderer.invoke('cookie:import', containerId),

  // ==================== 分配规则 ====================

  /**
   * 获取所有规则
   * @returns {Promise<Array>} 规则数组
   */
  getRules: () => ipcRenderer.invoke('rule:list'),

  /**
   * 创建新规则
   * @param {string} containerId - 目标容器 ID
   * @param {string} pattern - 匹配模式
   * @returns {Promise<Object>} 创建的规则对象
   */
  createRule: (containerId, pattern) => ipcRenderer.invoke('rule:create', containerId, pattern),

  /**
   * 更新规则
   * @param {string} ruleId - 规则 ID
   * @param {Object} updates - 更新内容
   * @returns {Promise<Object|null>} 更新后的规则对象
   */
  updateRule: (ruleId, updates) => ipcRenderer.invoke('rule:update', ruleId, updates),

  /**
   * 删除规则
   * @param {string} ruleId - 规则 ID
   * @returns {Promise<boolean>} 是否成功删除
   */
  deleteRule: (ruleId) => ipcRenderer.invoke('rule:delete', ruleId),

  /**
   * 匹配 URL
   * @param {string} url - 要匹配的 URL
   * @returns {Promise<string|null>} 匹配的容器 ID 或 null
   */
  matchRule: (url) => ipcRenderer.invoke('rule:match', url),

  // ==================== 快捷键 ====================

  /**
   * 获取快捷键配置
   * @returns {Promise<Object>} 快捷键配置对象
   */
  getShortcuts: () => ipcRenderer.invoke('shortcut:list'),

  /**
   * 设置快捷键
   * @param {string} action - 操作名称
   * @param {string} accelerator - 快捷键
   * @returns {Promise<boolean>} 是否设置成功
   */
  setShortcut: (action, accelerator) => ipcRenderer.invoke('shortcut:set', action, accelerator),

  /**
   * 监听快捷键事件
   * @param {Function} callback - 回调函数
   */
  onShortcutTriggered: (callback) => {
    ipcRenderer.on('shortcut:triggered', (event, action) => callback(action));
  },
});

console.log('[Realm] Preload 脚本已加载');

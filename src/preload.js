/**
 * Realm Browser - Preload 脚本
 *
 * 安全地将 IPC 接口暴露给渲染进程
 * 使用 contextBridge 确保隔离性
 * 使用 container:* 新格式 IPC 通道
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

/**
 * 暴露给渲染进程的 API
 */
contextBridge.exposeInMainWorld('realmAPI', {
  /**
   * 获取拖拽/粘贴 File 对象对应的文件系统绝对路径
   * webUtils 仅 preload 可用；File 句柄有时效，drop/paste handler 内须同步调用
   * @param {File} file - dataTransfer.files / clipboardData.items 的 File 对象
   * @returns {string|null} 绝对路径；无法解析（如网页拖出的内存图片）返回 null
   */
  getFilePathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },

  /**
   * 获取当前窗口 ID
   * 用于渲染进程判断自身窗口身份（跨窗口拖拽等场景）
   * @returns {Promise<number>} BrowserWindow.id
   */
  getWindowId: () => ipcRenderer.invoke('window:get-id'),

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
   * @param {Array<{key: string, value: string}>} [containerConfig.envVars] - 环境变量
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
   * @param {Array<{key: string, value: string}>} [updates.envVars] - 环境变量
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
   * 重排容器顺序
   * @param {string[]} orderedIds - 新的容器 ID 顺序数组
   * @returns {Promise<{success: boolean}>}
   */
  reorderContainers: (orderedIds) => ipcRenderer.invoke('container:reorder', orderedIds),

  /**
   * 监听容器切换事件
   * @param {Function} callback - 回调函数
   */
  onContainerSwitched: (callback) => {
    ipcRenderer.on('container-switched', (event, data) => callback(data));
  },

  /**
   * 监听「在指定容器新建 Tab」事件（WR-1/WR-2）
   * 主进程拦截 webview guest 的 window.open / 规则命中导航后推送
   * @param {Function} callback - 回调函数，参数为 { url, containerId, guestId }
   */
  onOpenUrlInTab: (callback) => {
    ipcRenderer.on('open-url-in-tab', (event, data) => callback(data));
  },

  /**
   * 监听外部链接打开事件（SETT-03）
   * 主进程通过 realm:// 协议打开外部链接时推送
   * @param {Function} callback - 回调函数，参数为 { url, containerId }；containerId 为 null 表示在当前容器打开
   */
  onExternalUrlOpen: (callback) => {
    ipcRenderer.on('open-external-url', (event, data) => callback(data));
  },

  /**
   * 监听「退出确认提示」事件
   * 第一次 Cmd+Q 时主进程拦截退出并推送此事件，渲染进程显示 Toast 提示
   * @param {Function} callback - 回调函数
   */
  onShowQuitHint: (callback) => {
    ipcRenderer.on('show-quit-hint', () => callback());
  },

  // ==================== 地址栏自动补全 ====================

  /**
   * 查询地址栏自动补全建议
   * 合并收藏夹、常用网站和历史记录三个数据源
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array<{url: string, title: string, faviconUrl: string, source: string}>>}
   */
  getAutocompleteSuggestions: (keyword) => ipcRenderer.invoke('autocomplete:query', { keyword }),

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

  /**
   * 清空所有 Tab（含持久化 store）
   * 启动时"不恢复"分支调用，避免旧会话残留被下次启动恢复
   * @returns {Promise<{success: boolean}>}
   */
  clearAllTabs: () => ipcRenderer.invoke('tab:clear-all'),

  /**
   * 在新窗口中打开 Tab
   * 右键菜单"在新窗口中打开"或拖拽场景调用
   * @param {string} tabId - 源 Tab ID
   * @param {Object} [options] - 选项
   * @param {boolean} [options.move=false] - 是否移动（true=从源窗口移除，false=保留原 Tab）
   * @returns {Promise<{success: boolean, newTabId?: string, windowId?: number}>}
   */
  openTabInNewWindow: (tabId, options) => ipcRenderer.invoke('tab:open-in-new-window', tabId, options),

  /**
   * 监听 Tab 回收事件（WR-4）
   * 主进程达到 Tab 上限自动回收最久未使用的 Tab 后推送
   * @param {Function} callback - 回调函数，参数为 { tabId, message }
   */
  onTabRecycled: (callback) => {
    ipcRenderer.on('tab:recycled', (event, data) => callback(data));
  },

  /**
   * 监听 AI 工具发起的关闭标签页请求
   * 主进程 close_tab 工具向标签页所属窗口推送，渲染进程复用完整 closeTab 生命周期
   * @param {Function} callback - 回调函数，参数为 { tabId }
   */
  onTabAiClose: (callback) => {
    ipcRenderer.on('tab:ai-close', (event, data) => callback(data));
  },

  /**
   * 监听 AI 工具发起的切换标签页请求
   * 主进程 switch_tab 工具向标签页所属窗口推送，渲染进程复用完整 switchTab 链路
   * @param {Function} callback - 回调函数，参数为 { tabId }
   */
  onTabAiSwitch: (callback) => {
    ipcRenderer.on('tab:ai-switch', (event, data) => callback(data));
  },

  /**
   * 监听 Tab 创建事件（跨窗口移动/新窗口创建时，主进程通知目标窗口）
   * @param {Function} callback - 回调函数，参数为 { tab }
   * @returns {Function} 取消监听函数
   */
  onTabCreated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('tab:created', handler);
    return () => ipcRenderer.removeListener('tab:created', handler);
  },

  /**
   * 监听 Tab 移除事件（跨窗口移动时，主进程通知源窗口移除 Tab）
   * @param {Function} callback - 回调函数，参数为 { tabId }
   * @returns {Function} 取消监听函数
   */
  onTabRemoved: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('tab:removed', handler);
    return () => ipcRenderer.removeListener('tab:removed', handler);
  },

  /**
   * 监听 Tab 切换事件（新窗口创建后，主进程通知切换到指定 Tab）
   * @param {Function} callback - 回调函数，参数为 { tabId }
   * @returns {Function} 取消监听函数
   */
  onTabSwitched: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('tab:switched', handler);
    return () => ipcRenderer.removeListener('tab:switched', handler);
  },

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

  /**
   * 删除容器的 Cookie 文件和 Session 数据
   * @param {string} containerId - 容器 ID
   * @returns {Promise<{success: boolean}>}
   */
  deleteCookie: (containerId) => ipcRenderer.invoke('cookie:delete', containerId),

  // ==================== Cookie 管理增强 ====================

  /**
   * 获取容器的 Session Cookie 列表
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>} Cookie 数组
   */
  getSessionCookies: (containerId) => ipcRenderer.invoke('cookie:get-session', containerId),

  /**
   * 获取容器的 File Cookie 列表
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>} Cookie 数组
   */
  getFileCookies: (containerId) => ipcRenderer.invoke('cookie:get-file', containerId),

  /**
   * 编辑单个 Cookie
   * @param {string} containerId - 容器 ID
   * @param {Object} cookieData - Cookie 数据
   * @returns {Promise<{success: boolean, message: string}>}
   */
  editCookie: (containerId, cookieData) => ipcRenderer.invoke('cookie:edit', containerId, cookieData),

  /**
   * 删除单个 Cookie
   * @param {string} containerId - 容器 ID
   * @param {Object} cookieData - Cookie 数据
   * @returns {Promise<{success: boolean, message: string}>}
   */
  deleteSingleCookie: (containerId, cookieData) => ipcRenderer.invoke('cookie:delete-single', containerId, cookieData),

  /**
   * 保存指定域名的 Cookie 到文件
   * 只保存当前域名及其子域名的 Cookie
   * @param {string} containerId - 容器 ID
   * @param {string} domain - 目标域名
   * @param {boolean} includeSubdomains - 是否包含子域名
   * @returns {Promise<{success: boolean, count: number}>}
   */
  saveDomainCookies: (containerId, domain, includeSubdomains) => ipcRenderer.invoke('cookie:save-domain', containerId, domain, includeSubdomains),

  /**
   * 检查指定域名的 session Cookie 与文件是否同步（含子域名语义）
   * @param {string} containerId - 容器 ID
   * @param {string} domain - 目标域名
   * @returns {Promise<{inSync: boolean, sessionCount: number, fileCount: number}>}
   */
  checkDomainSync: (containerId, domain) => ipcRenderer.invoke('cookie:check-domain-sync', containerId, domain),

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

  /**
   * 重新排序规则
   * @param {Array<string>} orderedIds - 规则 ID 的有序数组
   * @returns {Promise<{success: boolean}>}
   */
  reorderRules: (orderedIds) => ipcRenderer.invoke('rule:reorder', orderedIds),

  /**
   * 导出规则到文件
   * @returns {Promise<{success: boolean, count?: number, message?: string}>}
   */
  exportRules: () => ipcRenderer.invoke('rule:export'),

  /**
   * 从文件导入规则
   * @returns {Promise<{success: boolean, count?: number, message?: string}>}
   */
  importRules: () => ipcRenderer.invoke('rule:import'),

  // ==================== 浏览历史 ====================

  /**
   * 添加历史记录
   * @param {Object} data - 历史记录数据
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.url - 页面 URL
   * @param {string} [data.title] - 页面标题
   * @param {string} [data.faviconUrl] - favicon URL
   * @param {number} [data.visitedAt] - 访问时间戳
   * @returns {Promise<{id: number}|{skipped: boolean}>}
   */
  historyAdd: (data) => ipcRenderer.invoke('history:add', data),

  /**
   * 更新最近一条历史记录的标题
   * @param {Object} data - 数据
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.url - 匹配的 URL
   * @param {string} data.title - 新标题
   * @returns {Promise<boolean>}
   */
  historyUpdateTitle: (data) => ipcRenderer.invoke('history:update-title', data),

  /**
   * 搜索历史记录
   * @param {Object} data - 搜索参数
   * @param {string} data.containerId - 容器 ID
   * @param {string} data.keyword - 搜索关键词
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Promise<Array>}
   */
  historySearch: (data) => ipcRenderer.invoke('history:search', data),

  /**
   * 列出历史记录
   * @param {Object} data - 分页参数
   * @param {string} data.containerId - 容器 ID
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Promise<Array>}
   */
  historyList: (data) => ipcRenderer.invoke('history:list', data),

  /**
   * 删除单条历史记录
   * @param {string} containerId - 容器 ID
   * @param {number} id - 记录 ID
   * @returns {Promise<boolean>}
   */
  historyDelete: (containerId, id) => ipcRenderer.invoke('history:delete', { containerId, id }),

  /**
   * 批量删除历史记录
   * @param {string} containerId - 容器 ID
   * @param {Array<number>} ids - 记录 ID 数组
   * @returns {Promise<number>}
   */
  historyDeleteBatch: (containerId, ids) => ipcRenderer.invoke('history:delete-batch', { containerId, ids }),

  /**
   * 清空容器全部历史记录
   * @param {string} containerId - 容器 ID
   * @returns {Promise<number>}
   */
  historyClear: (containerId) => ipcRenderer.invoke('history:clear', { containerId }),

  /**
   * 获取容器历史记录总数
   * @param {string} containerId - 容器 ID
   * @returns {Promise<number>}
   */
  historyCount: (containerId) => ipcRenderer.invoke('history:count', { containerId }),

  // ==================== 收藏夹 ====================

  /**
   * 检查 URL 是否已收藏
   * @param {string} url - 页面 URL
   * @returns {Promise<{id: number, title: string, favicon_url: string}|null>}
   */
  favoritesCheck: (url) => ipcRenderer.invoke('favorites:check', { url }),

  /**
   * 添加收藏
   * @param {Object} data - 收藏数据
   * @param {string} data.url - 页面 URL
   * @param {string} [data.title] - 页面标题
   * @param {string} [data.faviconUrl] - favicon URL
   * @returns {Promise<{id: number}|{error: string, message: string}>}
   */
  favoritesAdd: (data) => ipcRenderer.invoke('favorites:add', data),

  /**
   * 更新收藏标题
   * @param {number} id - 记录 ID
   * @param {string} title - 新标题
   * @returns {Promise<boolean>}
   */
  favoritesUpdate: (id, title) => ipcRenderer.invoke('favorites:update', { id, title }),

  /**
   * 回填收藏 favicon（仅当记录当前无图标时生效）
   * 主进程抓取 sourceUrl 转 data URL 入库，成功后广播收藏栏刷新
   * @param {number} id - 记录 ID
   * @param {string} sourceUrl - favicon 源 URL（http/https/data）
   * @returns {Promise<{success: boolean}>}
   */
  favoritesUpdateFavicon: (id, sourceUrl) => ipcRenderer.invoke('favorites:update-favicon', { id, sourceUrl }),

  /**
   * 删除单条收藏
   * @param {number} id - 记录 ID
   * @returns {Promise<boolean>}
   */
  favoritesDelete: (id) => ipcRenderer.invoke('favorites:delete', { id }),

  /**
   * 批量删除收藏
   * @param {Array<number>} ids - 记录 ID 数组
   * @returns {Promise<number>}
   */
  favoritesDeleteBatch: (ids) => ipcRenderer.invoke('favorites:delete-batch', { ids }),

  /**
   * 列出收藏记录
   * @param {Object} data - 分页参数
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Promise<Array>}
   */
  favoritesList: (data) => ipcRenderer.invoke('favorites:list', data),

  /**
   * 搜索收藏记录
   * @param {Object} data - 搜索参数
   * @param {string} data.keyword - 搜索关键词
   * @param {number} [data.offset] - 分页偏移
   * @param {number} [data.limit] - 每页数量
   * @returns {Promise<Array>}
   */
  favoritesSearch: (data) => ipcRenderer.invoke('favorites:search', data),

  /**
   * 获取收藏记录总数
   * @returns {Promise<number>}
   */
  favoritesCount: () => ipcRenderer.invoke('favorites:count', {}),

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
   * 重置快捷键为默认值
   * 删除自定义覆盖项，自动回落到主进程 DEFAULT_SHORTCUTS
   * @param {string} action - 操作名称
   * @returns {Promise<boolean>} 是否重置成功
   */
  resetShortcut: (action) => ipcRenderer.invoke('shortcut:reset', action),

  /**
   * 监听快捷键事件
   * @param {Function} callback - 回调函数
   */
  onShortcutTriggered: (callback) => {
    ipcRenderer.on('shortcut:triggered', (event, action) => callback(action));
  },

  // ==================== 内部页面服务器 ====================

  /**
   * 获取内部页面服务器端口
   * 用于将 realm:// URL 转换为 http://localhost:PORT/ URL
   * @returns {Promise<number>} 服务器端口号
   */
  getRealmPort: () => ipcRenderer.invoke('get-realm-port'),

  // ==================== webview DevTools 支持 ====================

  /**
   * 报告当前活动的 webview guest webContents ID
   * 用于应用菜单快捷键（Cmd+Option+I）路由 DevTools 到正确的 webview
   * @param {number} contentsId - webview guest 的 webContents ID
   */
  setActiveWebview: (contentsId) => ipcRenderer.invoke('webview:set-active', contentsId),

  /**
   * 主进程侧聚焦指定 webview guest 的 webContents
   * DOM webview.focus() 无法跨 guest 转移键盘焦点时必须走此通道
   * @param {number} contentsId - webview guest 的 webContents ID
   */
  focusWebviewContents: (contentsId) => ipcRenderer.invoke('webview:focus-contents', contentsId),

  /**
   * 上报 guest webContentsId → 容器 ID 映射
   * 主进程无法从 guest session 反推 partition（Electron 32 限制），
   * 分配规则匹配和 CDP 抓取依赖此映射
   * @param {number} contentsId - webview guest 的 webContents ID
   * @param {string} containerId - 容器 ID
   */
  registerGuestContainer: (contentsId, containerId) =>
    ipcRenderer.invoke('webview:register-container', contentsId, containerId),

  // ==================== 右键菜单 ====================

  /**
   * 发送标签页右键菜单请求
   * 渲染进程检测到 Tab 栏右键点击后调用，主进程构建并弹出原生菜单
   * @param {Object} tabInfo - 标签页上下文信息
   * @param {string} tabInfo.tabId - 右键点击的 Tab ID
   * @param {number} tabCount - 当前 Tab 总数
   * @param {number} tabIndex - 该 Tab 在列表中的位置
   * @param {boolean} isPinned - 是否已固定
   * @param {boolean} hasClosedTabs - 是否有已关闭的标签页（用于"重新打开"）
   */
  showTabContextMenu: (tabInfo) => ipcRenderer.send('show-tab-context-menu', tabInfo),

  /**
   * 发送标签栏空白区右键菜单请求
   * 渲染进程 Tab 栏空白处（非标签项）右键时调用，主进程构建标签栏菜单（新建标签页等）
   */
  showTabBarContextMenu: () => ipcRenderer.send('show-tab-bar-context-menu'),

  /**
   * 发送网页右键菜单请求
   * 渲染进程检测到 webview 内右键点击后调用，主进程根据元素类型构建对应菜单
   * @param {Object} contextInfo - 网页右键上下文信息
   * @param {string} contextInfo.type - 元素类型：'general' | 'image' | 'link'
   * @param {string} contextInfo.linkURL - 链接 URL（非链接时为空串）
   * @param {string} contextInfo.srcURL - 媒体元素 src URL
   * @param {string} contextInfo.mediaType - 媒体类型：'none' | 'image' | 'video' 等
   * @param {string} contextInfo.selectionText - 选中的文本
   * @param {boolean} contextInfo.canGoBack - 是否可后退
   * @param {boolean} contextInfo.canGoForward - 是否可前进
   * @param {boolean} contextInfo.isLoading - 是否正在加载
   */
  showWebContextMenu: (contextInfo) => ipcRenderer.send('show-web-context-menu', contextInfo),

  /**
   * 发送收藏栏右键菜单请求
   * 渲染进程检测到收藏栏右键点击后调用，主进程根据类型构建对应菜单
   * @param {Object} info - 右键上下文信息
   * @param {string} info.type - 元素类型：'bookmark' | 'folder' | 'blank'
   * @param {string} [info.id] - 收藏项或文件夹 ID
   * @param {string} [info.url] - 收藏项 URL（type=bookmark）
   * @param {string} [info.title] - 收藏项标题（type=bookmark）
   * @param {string} [info.name] - 文件夹名称（type=folder）
   */
  showBookmarksBarContextMenu: (info) => ipcRenderer.send('show-bookmarks-bar-context-menu', info),

  /**
   * 注册右键菜单动作回调监听器
   * 主进程菜单项被点击后，通过对应 channel 发送回调，渲染进程据此更新 UI
   * 支持的 channel：context-menu:close-tab, context-menu:close-other-tabs,
   * context-menu:close-left-tabs, context-menu:close-right-tabs,
   * context-menu:reopen-tab, context-menu:toggle-pin,
   * context-menu:open-in-new-tab, context-menu:open-in-bg-tab,
   * context-menu:open-in-container, context-menu:save-image,
   * context-menu:copy-image, context-menu:copy-image-address,
   * context-menu:copy-link-address, context-menu:add-to-favorites,
   * context-menu:toast, context-menu:text-action
   * @param {Function} callback - 回调函数，参数为 (channel: string, data: Object)
   */
  onContextMenuAction: (callback) => {
    const channels = [
      'context-menu:close-tab',
      'context-menu:close-other-tabs',
      'context-menu:close-left-tabs',
      'context-menu:close-right-tabs',
      'context-menu:reopen-tab',
      'context-menu:toggle-pin',
      'context-menu:open-in-new-tab',
      'context-menu:open-in-bg-tab',
      'context-menu:open-in-container',
      'context-menu:save-image',
      'context-menu:copy-image',
      'context-menu:copy-image-address',
      'context-menu:copy-link-address',
      'context-menu:add-to-favorites',
      'context-menu:toast',
      'context-menu:text-action',
      'context-menu:open-in-new-window',
    ];
    channels.forEach(channel => {
      ipcRenderer.on(channel, (event, data) => callback(channel, data));
    });
  },

  /**
   * 监听收藏栏 IPC 消息
   * 主进程右键菜单行为通过这些 channel 推送
   * @param {string} channel - IPC channel 名称
   * @param {Function} callback - 回调函数
   */
  onIpcMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  },

  /**
   * 通知主进程已关闭一个标签页
   * 用于在主进程侧维护 closedTabsStack（与渲染进程侧同步）
   * @param {Object} tabInfo - 已关闭标签的信息
   * @param {string} tabInfo.containerId - 容器 ID
   * @param {string} tabInfo.url - 标签页 URL
   * @param {string} tabInfo.title - 标签页标题
   */
  notifyClosedTab: (tabInfo) => ipcRenderer.send('context-menu:closed-tab', tabInfo),

  // ==================== 收藏夹文件夹 ====================

  /**
   * 创建收藏夹文件夹
   * @param {string} name - 文件夹名称
   * @param {number} [parentId=0] - 父文件夹 ID（0 表示根目录）
   * @returns {Promise<{id: number}|{error: string, message: string}>}
   */
  createFavoriteFolder: (name, parentId) => ipcRenderer.invoke('favorites:create-folder', { name, parentId }),

  /**
   * 重命名文件夹
   * @param {number} id - 文件夹 ID
   * @param {string} name - 新名称
   * @returns {Promise<boolean>}
   */
  renameFavoriteFolder: (id, name) => ipcRenderer.invoke('favorites:rename-folder', { id, name }),

  /**
   * 删除文件夹（级联删除子文件夹和收藏项）
   * @param {number} id - 文件夹 ID
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  deleteFavoriteFolder: (id) => ipcRenderer.invoke('favorites:delete-folder', { id }),

  /**
   * 列出指定父文件夹下的子文件夹
   * @param {number} [parentId=0] - 父文件夹 ID
   * @returns {Promise<Array>}
   */
  listFavoriteFolders: (parentId) => ipcRenderer.invoke('favorites:list-folders', { parentId }),

  /**
   * 获取完整的文件夹树结构
   * @returns {Promise<Array>}
   */
  getFavoriteFolderTree: () => ipcRenderer.invoke('favorites:get-folder-tree'),

  /**
   * 移动文件夹到新的父文件夹
   * @param {number} id - 文件夹 ID
   * @param {number} parentId - 目标父文件夹 ID
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  moveFavoriteFolder: (id, parentId) => ipcRenderer.invoke('favorites:move-folder', { id, parentId }),

  /**
   * 将收藏项移动到指定文件夹
   * @param {number} id - 收藏项 ID
   * @param {number} folderId - 目标文件夹 ID（0 表示根目录）
   * @returns {Promise<boolean>}
   */
  moveFavorite: (id, folderId) => ipcRenderer.invoke('favorites:move-favorite', { id, folderId }),

  /**
   * 批量移动收藏项到指定文件夹
   * @param {Array<number>} ids - 收藏项 ID 数组
   * @param {number} folderId - 目标文件夹 ID
   * @returns {Promise<number>}
   */
  moveFavorites: (ids, folderId) => ipcRenderer.invoke('favorites:move-favorites', { ids, folderId }),

  /**
   * 更新文件夹的排序位置
   * @param {number} id - 文件夹 ID
   * @param {number} sortOrder - 新的排序值
   * @returns {Promise<boolean>}
   */
  updateFavoriteFolderSort: (id, sortOrder) => ipcRenderer.invoke('favorites:update-folder-sort', { id, sortOrder }),

  /**
   * 更新收藏项的排序位置
   * @param {number} id - 收藏项 ID
   * @param {number} sortOrder - 新的排序值
   * @returns {Promise<boolean>}
   */
  updateFavoriteSort: (id, sortOrder) => ipcRenderer.invoke('favorites:update-favorite-sort', { id, sortOrder }),

  /**
   * 将收藏项移动到指定文件夹并追加到末尾（原子写入 folder_id + 末尾排序键）
   * @param {number} id - 收藏项 ID
   * @param {number} folderId - 目标文件夹 ID（0 表示根目录）
   * @returns {Promise<boolean>}
   */
  moveFavoriteInto: (id, folderId) => ipcRenderer.invoke('favorites:move-favorite-into', { id, folderId }),

  /**
   * 应用收藏整理方案（AI 整理卡片确认后调用）
   * @param {Array<{folderName: string, parentId?: number, bookmarkIds: number[]}>} plan - 整理方案
   * @returns {Promise<{success: boolean, folderCount?: number, movedCount?: number,
   *            createdFolders?: Array, failures?: Array, message?: string}>}
   */
  applyFavoritesOrganize: (plan) => ipcRenderer.invoke('favorites:apply-organize', { plan }),

  /**
   * 计算 fractional-indexing 排序键
   * 主窗口从 file:// 无法访问 HTTP 端点，排序键计算走 IPC（与 /api/favorites/compute-sort-keys 同逻辑）
   * @param {string|null} beforeKey - 前邻排序键（null 表示插到最前）
   * @param {string|null} afterKey - 后邻排序键（null 表示追加到末尾）
   * @param {number} [count=1] - 需要的键数量
   * @returns {Promise<string[]>}
   */
  computeFavoriteSortKeys: (beforeKey, afterKey, count) => ipcRenderer.invoke('favorites:compute-sort-keys', {
    beforeKey: beforeKey || null,
    afterKey: afterKey || null,
    count: count || 1,
  }),

  // ==================== 书签导入 ====================

  /**
   * Chrome JSON 书签导入
   * @param {string} filePath - 书签文件路径，为空时自动检测
   * @returns {Promise<{success: boolean, imported?: number, skipped?: number, foldersCreated?: number}>}
   */
  importChromeBookmarks: (filePath) => ipcRenderer.invoke('favorites:import-chrome', { filePath }),

  /**
   * HTML 书签导入
   * @param {string} filePath - HTML 书签文件路径
   * @returns {Promise<{success: boolean, imported?: number, skipped?: number, preview?: Object}>}
   */
  importHtmlBookmarks: (filePath) => ipcRenderer.invoke('favorites:import-html', { filePath }),

  /**
   * 取消正在进行的导入操作
   * @returns {Promise<{success: boolean}>}
   */
  abortImport: () => ipcRenderer.invoke('favorites:import-abort'),

  /**
   * 检测 Chrome 书签文件路径
   * @returns {Promise<{path: string|null}>}
   */
  detectChromePath: () => ipcRenderer.invoke('favorites:detect-chrome-path'),

  /**
   * 打开文件选择对话框
   * @param {Object} options - 对话框选项
   * @param {string} [options.title] - 对话框标题
   * @param {Array} [options.filters] - 文件类型过滤器
   * @param {string[]} [options.properties] - 对话框属性
   * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
   */
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),

  /**
   * 监听导入进度事件
   * @param {Function} callback - 回调函数，参数为 {progress, imported, skipped, total, current}
   */
  onImportProgress: (callback) => {
    ipcRenderer.on('favorites:import-progress', (event, data) => callback(data));
  },

  /**
   * 移除导入进度监听器
   */
  removeImportProgressListener: () => {
    ipcRenderer.removeAllListeners('favorites:import-progress');
  },

  // ==================== 应用设置 ====================

  /**
   * 获取应用设置（主窗口渲染进程用；webview 内设置页走 HTTP /api/settings/get）
   * @returns {Promise<Object>} 设置对象
   */
  getSettings: () => ipcRenderer.invoke('settings:get'),

  /**
   * 监听设置变更事件（closing UAT gap G-29-6）
   * 主进程在 HTTP /api/settings/update 写入后主动广播
   * @param {Function} callback - 回调函数，参数为 changedKeys 数组
   */
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings:updated', (event, changedKeys) => callback(changedKeys));
  },

  /**
   * 写入单个设置项
   * @param {string} key - 设置键
   * @param {*} value - 设置值
   * @returns {Promise<{success: boolean}>}
   */
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // ==================== 收藏栏 ====================

  /**
   * 收藏栏相关 API
   * 提供收藏数据获取和收藏栏显示/隐藏控制
   */
  bookmarksBar: {
    /**
     * 获取指定文件夹下的收藏项
     * @param {number} [folderId=0] - 文件夹 ID，0 表示根目录
     * @returns {Promise<Array>} 收藏项列表
     */
    listFavorites: (folderId) => ipcRenderer.invoke('favorites:list', {
      folderId: folderId !== undefined ? folderId : 0,
    }),

    /**
     * 获取完整的文件夹树结构
     * @returns {Promise<Array>} 文件夹树
     */
    getFolderTree: () => ipcRenderer.invoke('favorites:get-folder-tree'),

    /**
     * 获取指定父文件夹下的子文件夹列表
     * @param {number} [parentId=0] - 父文件夹 ID
     * @returns {Promise<Array>} 子文件夹列表
     */
    listFolders: (parentId) => ipcRenderer.invoke('favorites:list-folders', {
      parentId: parentId !== undefined ? parentId : 0,
    }),

    /**
     * 切换收藏栏显示/隐藏
     * @param {boolean} visible - 是否显示
     * @returns {Promise<{success: boolean}>}
     */
    toggle: (visible) => ipcRenderer.invoke('bookmarks-bar:toggle', { visible }),

    /**
     * 获取收藏栏显示状态
     * @returns {Promise<{visible: boolean}>}
     */
    getVisibility: () => ipcRenderer.invoke('bookmarks-bar:get-visibility'),
  },

  // ==================== AI 助手 ====================

  /**
   * AI 相关 API
   * 提供 AI Agent 的消息发送、取消、配置和状态查询功能
   */
  ai: {
    /**
     * 发送用户消息给 AI Agent
     * @param {string} message - 用户输入的消息
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    prompt: (message) => ipcRenderer.invoke('ai:prompt', message),

    /**
     * 发送带上下文引用的用户消息给 AI Agent
     * @param {Object} data - 消息数据
     * @param {string} data.message - 用户输入的消息
     * @param {Array} data.referencedTabs - 引用的标签页列表，每项包含 {tabId, title, url, content}
     * @param {Array} [data.attachmentIds] - 附件登记 ID 列表（ai:attach-files/attach-blob 返回的 id）
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    promptWithContext: (data) => ipcRenderer.invoke('ai:prompt-with-context', data),

    /**
     * 登记路径型聊天附件（拖拽/粘贴的本地文件，主进程复制快照进 agent-workspace/attachments/）
     * @param {string[]} paths - 源绝对路径数组
     * @returns {Promise<{attachments: Array, errors: Array<{path: string, reason: string}>}>} 部分成功语义
     */
    attachFiles: (paths) => ipcRenderer.invoke('ai:attach-files', paths),

    /**
     * 登记 blob 型聊天附件（截图等无路径内存数据）
     * @param {{name?: string, mimeType?: string, base64: string}} payload - 附件数据
     * @returns {Promise<{attachment: Object|null, error?: string}>}
     */
    attachBlob: (payload) => ipcRenderer.invoke('ai:attach-blob', payload),

    /**
     * 读取图片附件预览 data URL（缩略图用；仅图片且 ≤2MB）
     * @param {string} attachmentId - 登记 ID
     * @returns {Promise<{dataUrl: string|null}>}
     */
    readAttachmentPreview: (attachmentId) => ipcRenderer.invoke('ai:read-attachment-preview', attachmentId),

    /**
     * 读取图片附件内联渲染数据（聊天气泡渲染，截图工具同款效果）
     * @param {{id?: string, path?: string}} payload - 登记 ID 或快照路径（历史恢复场景）
     * @returns {Promise<{dataUrl: string|null}>}
     */
    readAttachmentImage: (payload) => ipcRenderer.invoke('ai:read-attachment-image', payload),

    /**
     * 获取主进程缓存的 Readability 库源码
     * 用于渲染进程内联注入 webview 提取引用标签页内容
     * @returns {Promise<string>} Readability bundle 源码（加载失败为空字符串）
     */
    getReadabilityScript: () => ipcRenderer.invoke('ai:get-readability-script'),

    /**
     * 取消当前 Agent 执行
     * @returns {Promise<{success: boolean}>}
     */
    abort: () => ipcRenderer.invoke('ai:abort'),

    /**
     * 压缩当前对话上下文（/compact）
     * @param {Object} [options] - { focus?: string } 用户指定的摘要重点
     * @returns {Promise<Object>} { success, skipped?, message?, before, after, tokensBefore, tokensAfter }
     */
    compactConversation: (options) => ipcRenderer.invoke('ai:compact-conversation', options),

    /**
     * 监听 Agent 事件（批量）
     * 高频事件（message_update, tool_execution_update）使用 debounce 16ms 批量合并
     * @param {function} callback - 接收事件数组的回调
     * @returns {function} 取消监听的清理函数
     */
    onEventsBatch: (callback) => {
      ipcRenderer.on('ai:events-batch', (_, data) => callback(data.events));
      return () => ipcRenderer.removeAllListeners('ai:events-batch');
    },

    /**
     * 配置 AI 提供商 API Key
     * @param {Object} config - { provider: string, apiKey: string }
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    configureProviders: (config) => ipcRenderer.invoke('ai:configure', config),

    /**
     * 获取可用模型列表
     * @returns {Promise<{models: Array<{provider: string, id: string, name: string}>}>}
     */
    getAvailableModels: () => ipcRenderer.invoke('ai:get-models'),

    /**
     * 获取当前 Agent 状态
     * @returns {Promise<{initialized: boolean, model: string|null, toolsCount: number}>}
     */
    getState: () => ipcRenderer.invoke('ai:get-state'),

    /**
     * 开始新对话：重置主进程 Agent 的消息 transcript 和流式状态
     * @returns {Promise<{success: boolean}>}
     */
    newConversation: () => ipcRenderer.invoke('ai:new-conversation'),
  },

  /**
   * AI 对话管理 API
   * 提供对话的创建、切换、删除和重命名功能
   */
  conversationAPI: {
    /**
     * 获取对话列表
     * @param {number} [limit=50] - 返回数量上限
     * @returns {Promise<{conversations: Array}>}
     */
    getConversations: (limit) => ipcRenderer.invoke('ai:get-conversations', limit),

    /**
     * 创建新对话
     * @returns {Promise<{conversation: Object}>}
     */
    createConversation: () => ipcRenderer.invoke('ai:create-conversation'),

    /**
     * 切换对话
     * @param {string} id - 目标对话 ID
     * @returns {Promise<{conversation: Object}>}
     */
    switchConversation: (id) => ipcRenderer.invoke('ai:switch-conversation', id),

    /**
     * 获取对话消息（renderer 显示形状，轻量只读——不切换/不重建 Agent）
     * @param {string} id - 对话 ID
     * @returns {Promise<Array>} 显示形状消息列表
     */
    getMessages: (id) => ipcRenderer.invoke('ai:get-conversation-messages', id),

    /**
     * 删除对话
     * @param {string} id - 要删除的对话 ID
     * @returns {Promise<{success: boolean}>}
     */
    deleteConversation: (id) => ipcRenderer.invoke('ai:delete-conversation', id),

    /**
     * 重命名对话
     * @param {string} id - 对话 ID
     * @param {string} title - 新标题
     * @returns {Promise<{success: boolean}>}
     */
    renameConversation: (id, title) => ipcRenderer.invoke('ai:rename-conversation', id, title),
  },

  // ==================== 搜索配置 ====================

  /**
   * 搜索配置 API
   * 提供搜索 Provider 和 API Key 的管理功能
   */
  searchConfig: {
    /**
     * 获取搜索配置
     * @returns {Promise<{provider: string, apiKeys: Object}>}
     */
    getConfig: () => ipcRenderer.invoke('search-config:get'),

    /**
     * 写入搜索配置
     * @param {Object} config - { provider?: string, apiKeys?: Object }
     * @returns {Promise<{success: boolean}>}
     */
    setConfig: (config) => ipcRenderer.invoke('search-config:set', config),

    /**
     * 验证搜索 Provider API Key
     * @param {string} provider - Provider ID
     * @param {string} apiKey - API Key
     * @returns {Promise<{valid: boolean, provider?: string, error?: string}>}
     */
    verifyKey: (provider, apiKey) => ipcRenderer.invoke('search-config:verify-key', { provider, apiKey }),
  },

  // ==================== Vim 快捷键 ====================

  /**
   * 监听 Vim 快捷键触发事件
   * 主进程识别到 Vim 快捷键后发送命令名到 renderer
   * @param {Function} callback - 回调函数，参数为命令名（如 'scrollDown', 'closeTab'）
   */
  onVimTriggered: (callback) => {
    ipcRenderer.on('vim:triggered', (event, command) => callback(command));
  },

  /**
   * 监听 Hint Mode 按键转发
   * Hint Mode 激活期间主进程捕获的按键（字母/Escape/Backspace）经此通道送达，
   * 由 renderer 注入到活动 webview guest 的 hint 处理器，不依赖 guest 键盘焦点
   * @param {Function} callback - 回调函数，参数为按键名（如 'a', 'Escape'）
   */
  onVimHintKey: (callback) => {
    ipcRenderer.on('vim:hint-key', (event, key) => callback(key));
  },

  /**
   * 设置当前 webview 的输入框焦点状态
   * 用于告知主进程是否应禁用 Vim 单键快捷键（D-07）
   * @param {number} webContentsId - webview guest 的 webContents ID
   * @param {boolean} isInInput - 焦点是否在输入框中
   */
  setVimFocusState: (webContentsId, isInInput) => {
    ipcRenderer.invoke('vim:set-focus-state', webContentsId, isInInput);
  },

  /**
   * 设置 host 主窗口自身的输入框焦点状态（地址栏等 chrome 内输入框）
   * 主进程以 event.sender.id 作为 key，与 guest 焦点状态互不干扰
   * @param {boolean} isInInput - 焦点是否在输入框中
   */
  setHostVimFocusState: (isInInput) => {
    // 同步直报（sendSync 返回时主进程已更新，消除 before-input-event 竞态）；
    // 失败时回退异步 invoke
    try {
      ipcRenderer.sendSync('vim:set-focus-state-sync', null, isInInput);
    } catch (err) {
      ipcRenderer.invoke('vim:set-focus-state', null, isInInput);
    }
  },

  /**
   * 查询 Vimium 是否启用
   * @returns {Promise<boolean>} 是否启用
   */
  getVimEnabled: () => {
    return ipcRenderer.invoke('vim:get-enabled');
  },

  /**
   * 设置 Vim 搜索模式激活状态
   * 搜索模式激活时，n/N 键切换为搜索导航（searchNext/searchPrev）
   * @param {boolean} active - 搜索模式是否激活
   */
  setVimSearchActive: (active) => {
    ipcRenderer.invoke('vim:set-search-active', active);
  },

  /**
   * 设置搜索输入激活状态
   * 激活期间主进程跳过所有 Vim 按键处理，按键直达 guest 搜索输入框。
   * 主进程在派发 searchMode 时已同步置位；renderer 在 Enter 确认 / Escape 退出后调用清除。
   * @param {boolean} active - 搜索输入是否激活
   */
  setVimSearchInputActive: (active) => {
    ipcRenderer.invoke('vim:set-search-input-active', active);
  },

  /**
   * 设置 Hint Mode 激活状态
   * renderer 在 hint mode 进入/退出时同步此状态到主进程
   * @param {boolean} active - hint mode 是否激活
   */
  setVimHintActive: (active) => {
    ipcRenderer.invoke('vim:set-hint-active', active);
  },

  // ==================== 剪贴板 ====================

  /**
   * 通用剪贴板写入文本
   * @param {string} text - 要写入的文本
   * @returns {Promise<{success: boolean}>}
   */
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write-text', text),

  /**
   * 执行脚本：逐步执行脚本步骤
   * 渲染进程确认脚本后调用，每步结果通过 onScriptStepUpdate 实时接收
   * @param {Object} script - 脚本对象，包含 steps 数组
   * @returns {Promise<{success: boolean, stoppedAt?: number, error?: string}>}
   */
  scriptExecute: (script) => ipcRenderer.invoke('script:execute', script),

  /**
   * 停止脚本执行：中断当前正在执行的脚本
   * @returns {Promise<{stopped: boolean}>}
   */
  scriptStop: () => ipcRenderer.invoke('script:stop'),

  /**
   * 监听脚本步骤状态更新
   * 主进程每执行完一步后推送状态到渲染进程
   * @param {Function} callback - 回调函数，参数为 { index, status, step?, result?, error? }
   * @returns {Function} 取消监听的清理函数
   */
  onScriptStepUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('script:step-update', handler);
    return () => ipcRenderer.removeListener('script:step-update', handler);
  },

  // ==================== 操作确认 ====================

  /**
   * 确认高风险操作
   * 渲染进程确认卡片点击"确认执行"时调用
   * @param {string} actionId - 操作唯一 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  actionConfirm: (actionId) => ipcRenderer.invoke('action:confirm', actionId),

  /**
   * 取消高风险操作
   * 渲染进程确认卡片点击"取消"时调用
   * @param {string} actionId - 操作唯一 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  actionCancel: (actionId) => ipcRenderer.invoke('action:cancel', actionId),

  /**
   * 监听高风险操作确认请求
   * 主进程检测到高风险操作时推送，渲染进程据此渲染确认卡片
   * @param {Function} callback - 回调函数，参数为操作数据对象
   * @returns {Function} 移除监听器的清理函数
   */
  onActionRequestConfirmation: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('action:request-confirmation', handler);
    return () => ipcRenderer.removeListener('action:request-confirmation', handler);
  },

  /**
   * 监听确认操作完结事件
   * 主进程在操作执行完成（success/error）或超时取消（cancelled）时推送，
   * 渲染进程据此将确认卡片从 executing/pending 推进到终态
   * @param {Function} callback - 回调函数，参数为 { actionId, state, message }
   * @returns {Function} 移除监听器的清理函数
   */
  onActionSettle: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('action:settle', handler);
    return () => ipcRenderer.removeListener('action:settle', handler);
  },

  // ==================== 标签栏重排 ====================

  /**
   * 应用标签分组重排
   * 渲染进程确认分组后调用，主进程计算新顺序后通过 onTabReordered 通知渲染进程
   * @param {Object} tabOrder - 分组重排数据
   * @param {Array<{name: string, tabIds: string[]}>} tabOrder.groups - 分组数组
   * @returns {Promise<{success: boolean, groupCount?: number, tabCount?: number, message?: string}>}
   */
  tabReorder: (tabOrder) => ipcRenderer.invoke('tab:reorder', tabOrder),

  /**
   * Tab 拖拽排序：拖拽完成后按新顺序重排标签页
   * @param {string[]} orderedIds - 排好序的 Tab ID 数组
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  tabDndReorder: (orderedIds) => ipcRenderer.invoke('tab:dnd-reorder', orderedIds),

  /**
   * 监听标签栏重排完成事件
   * 主进程完成重排计算后推送新顺序，渲染进程据此重排标签栏 DOM
   * @param {Function} callback - 回调函数，参数为 { groups, flatOrder }
   * @returns {Function} 取消监听的清理函数
   */
  onTabReordered: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('tab:reordered', handler);
    return () => ipcRenderer.removeListener('tab:reordered', handler);
  },

  // ==================== 凭据管理 ====================

  /**
   * 凭据管理 API
   * 提供凭据保存、查询、删除和永不保存标记功能
   */
  credentialAPI: {
    /**
     * 保存凭据（加密存储到主进程）
     * @param {Object} data - 凭据数据
     * @param {string} data.containerId - 容器 ID
     * @param {string} data.url - 页面 URL
     * @param {string} data.origin - 页面 origin
     * @param {string} data.username - 用户名
     * @param {string} data.password - 密码
     * @returns {Promise<{success: boolean}|{error: string}>}
     */
    saveCredential: (data) => ipcRenderer.invoke('credential:save', data),

    /**
     * 获取指定容器和 origin 的凭据
     * @param {string} containerId - 容器 ID
     * @param {string} origin - 页面 origin
     * @returns {Promise<Object|null>} 凭据对象或 null
     */
    getCredential: (containerId, origin) => ipcRenderer.invoke('credential:get', { containerId, origin }),

    /**
     * 删除凭据
     * @param {string} containerId - 容器 ID
     * @param {string} origin - 页面 origin
     * @returns {Promise<{success: boolean}>}
     */
    deleteCredential: (containerId, origin) => ipcRenderer.invoke('credential:delete', { containerId, origin }),

    /**
     * 标记永不保存（按容器隔离）
     * @param {string} containerId - 容器 ID
     * @param {string} origin - 页面 origin
     * @returns {Promise<{success: boolean}>}
     */
    markNeverSave: (containerId, origin) => ipcRenderer.invoke('credential:never-save', { containerId, origin }),

    /**
     * 检查是否已标记永不保存
     * @param {string} containerId - 容器 ID
     * @param {string} origin - 页面 origin
     * @returns {Promise<boolean>}
     */
    isNeverSave: (containerId, origin) => ipcRenderer.invoke('credential:is-never-save', { containerId, origin }),
  },

  /**
   * 地址管理 API
   * 提供地址保存、查询和删除功能（per AF-06）
   */
  addressAPI: {
    /**
     * 保存地址（加密存储到主进程）
     * @param {Object} data - 地址数据
     * @param {string} data.containerId - 容器 ID
     * @param {string} data.name - 收件人姓名
     * @param {string} data.phone - 手机号
     * @param {string} data.address - 详细地址
     * @returns {Promise<{success: boolean}|{error: string}>}
     */
    saveAddress: (data) => ipcRenderer.invoke('address:save', data),

    /**
     * 获取指定容器的地址
     * @param {string} containerId - 容器 ID
     * @returns {Promise<{name: string, phone: string, address: string}|null>}
     */
    getAddress: (containerId) => ipcRenderer.invoke('address:get', { containerId }),

    /**
     * 删除地址
     * @param {string} containerId - 容器 ID
     * @returns {Promise<{success: boolean}>}
     */
    deleteAddress: (containerId) => ipcRenderer.invoke('address:delete', { containerId }),
  },

  // ==================== 跨窗口 Tab 拖拽（Phase 36 Plan 03） ====================

  /**
   * 通知主进程开始拖拽 Tab
   * 渲染进程在 mousedown + 移动超过阈值后调用
   * @param {string} tabId - 被拖拽的 Tab ID
   * @returns {Promise<{success: boolean}>}
   */
  startDrag: (tabId) => ipcRenderer.invoke('drag:start', tabId),

  /**
   * 更新拖拽鼠标位置
   * 渲染进程在 mousemove 时高频调用
   * @param {Object} position - { x, y, screenX, screenY }
   * @returns {Promise<{success: boolean, outOfTabBar?: boolean, targetWindow?: Object|null}>}
   */
  updateDragPosition: (position) => ipcRenderer.invoke('drag:update-position', position),

  /**
   * 结束拖拽
   * 渲染进程在 mouseup 时调用
   * @param {Object} data - { targetWindowId?, outOfTabBar? }
   * @returns {Promise<{success: boolean, action?: string}>}
   */
  endDrag: (data) => ipcRenderer.invoke('drag:end', data),

  /**
   * 取消拖拽
   * 渲染进程按 Escape 或松手目标无效时调用
   * @returns {Promise<{success: boolean}>}
   */
  cancelDrag: () => ipcRenderer.invoke('drag:cancel'),

  /**
   * 监听拖拽状态变化（主进程广播）
   * @param {Function} callback - 回调函数，参数为 { type, tabId, sourceWindowId, screenX, screenY, isDragging }
   * @returns {Function} 取消监听函数
   */
  onDragStateChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('drag:state-changed', handler);
    return () => ipcRenderer.removeListener('drag:state-changed', handler);
  },

  // ==================== 应用级操作 ====================

  /** 查询当前应用是否为系统默认浏览器 */
  isDefaultBrowser: () => ipcRenderer.invoke('app:is-default-browser'),

  /** 将当前应用注册为系统默认浏览器（macOS 会弹出系统确认框） */
  setDefaultBrowser: () => ipcRenderer.invoke('app:set-default-browser'),
});

// ==================== 媒体检测 API ====================

/**
 * 媒体检测相关 API（独立命名空间，per IPC-05）
 * 渲染进程通过 window.mediaAPI 访问
 */
contextBridge.exposeInMainWorld('mediaAPI', {
  /**
   * 获取指定 webview 的媒体列表
   * @param {number} webContentsId - webview 的 webContents ID
   * @returns {Promise<Array<{url: string, type: string, source: string, timestamp: number}>>}
   */
  getMediaList: (webContentsId) => ipcRenderer.invoke('media:get-list', webContentsId),

  /**
   * 诊断用：嗅探管线各环节计数状态
   * @returns {Promise<Object>} 诊断状态
   */
  debugState: () => ipcRenderer.invoke('media:debug-state'),

  /**
   * 创建播放器窗口并播放指定视频
   * @param {string} url - 视频 URL
   * @param {string} containerId - 来源容器 ID
   * @returns {Promise<{success: boolean, reused: boolean}>}
   */
  playMedia: (url, containerId) => ipcRenderer.invoke('media:play', url, containerId),

  /**
   * 获取指定容器的媒体列表（供播放器窗口使用）
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>}
   */
  getMediaListForContainer: (containerId) => ipcRenderer.invoke('media:get-media-list', containerId),

  /**
   * 复制视频 URL 到系统剪贴板
   * @param {string} url - 视频 URL
   * @returns {Promise<{success: boolean}>}
   */
  copyMediaUrl: (url) => ipcRenderer.invoke('media:copy-url', url),

  /**
   * 清空指定 webview 的媒体列表
   * @param {number} webContentsId - webview 的 webContents ID
   * @returns {Promise<{success: boolean}>}
   */
  clearMediaList: (webContentsId) => ipcRenderer.invoke('media:clear-list', webContentsId),

  /**
   * 向主进程上报脚本注入检测到的视频
   * 脚本注入检测结果从渲染进程回传到主进程 MediaSniffer 的唯一桥梁
   * @param {number} webContentsId - webview 的 webContents ID
   * @param {Array<Object>} videos - 检测到的视频数组
   * @returns {Promise<{success: boolean}>}
   */
  reportMediaDetected: (webContentsId, videos) => ipcRenderer.invoke('media:report-detected', webContentsId, videos),

  /**
   * 上报页面级媒体信息（og:image）到主进程 MediaSniffer
   * @param {number} webContentsId - webview 的 webContents ID
   * @param {Object} pageInfo - 页面级媒体信息（{ thumbnail }）
   * @returns {Promise<{success: boolean}>}
   */
  reportMediaPageInfo: (webContentsId, pageInfo) => ipcRenderer.invoke('media:report-page-info', webContentsId, pageInfo),

  /**
   * 清空主进程页面级媒体信息缓存（SPA 站内导航路径变化时调用）
   * @param {number} webContentsId - webview 的 webContents ID
   * @returns {Promise<{success: boolean}>}
   */
  clearMediaPageInfo: (webContentsId) => ipcRenderer.invoke('media:clear-page-info', webContentsId),

  /**
   * 监听媒体列表更新事件
   * @param {Function} callback - 回调函数，参数为 { webContentsId, items }
   * @returns {Function} 取消监听的清理函数
   */
  onMediaListUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('media:list-updated', handler);
    return () => ipcRenderer.removeListener('media:list-updated', handler);
  },

  /**
   * 监听媒体任务活跃数变化（主窗口任务角标数据源，Phase 44 D-26）
   * @param {Function} callback - 回调函数，参数为 { count }
   * @returns {Function} 取消监听的清理函数
   */
  onMediaTaskCountChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('media-task:count-changed', handler);
    return () => ipcRenderer.removeListener('media-task:count-changed', handler);
  },

  /**
   * 监听媒体任务状态变化（主窗口终态 toast 数据源，G-44-5）
   * 参数为任务对象快照（含 id/type/status/title/outputPath/error），
   * 不过滤类型——调用方自行过滤（convert + record 两类终态均需）
   * @param {Function} callback - 回调函数，参数为状态变化的任务快照
   * @returns {Function} 取消监听的清理函数
   */
  onMediaTaskChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('media-task:changed', handler);
    return () => ipcRenderer.removeListener('media-task:changed', handler);
  },

  /**
   * 弹出系统目录选择对话框选取媒体缓存目录（Phase 44 D-05，T-44-08：
   * 缓存目录仅经 dialog 选取，不手输）
   * @returns {Promise<{success: boolean, path: string|null}>}
   */
  chooseCacheDir: () => ipcRenderer.invoke('settings:choose-cache-dir'),
});

// ==================== 播放器窗口 API ====================

/**
 * 播放器窗口专用 API（独立命名空间，per D-04）
 * 播放器窗口通过 window.playerAPI 访问
 */
contextBridge.exposeInMainWorld('playerAPI', {
  /**
   * 监听主进程发送的媒体播放数据
   * @param {Function} callback - 回调函数，参数为 { url, mediaList, containerId }
   * @returns {Function} 取消监听的清理函数
   */
  onPlayUrl: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('media:play-url', handler);
    return () => ipcRenderer.removeListener('media:play-url', handler);
  },

  /**
   * 切换播放器窗口全屏状态
   * @returns {Promise<{fullscreen: boolean}>}
   */
  toggleFullscreen: () => ipcRenderer.invoke('player:toggle-fullscreen'),

  /**
   * 监听播放器窗口全屏状态变化（由主进程 enter-full-screen / leave-full-screen 广播）
   * @param {Function} callback - 回调函数，参数为 boolean（true=进入全屏）
   * @returns {Function} 取消监听的清理函数
   */
  onFullscreenChanged: (callback) => {
    const handler = (event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('player:fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('player:fullscreen-changed', handler);
  },

  /**
   * 获取指定容器的媒体列表
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>}
   */
  getMediaListForContainer: (containerId) => ipcRenderer.invoke('media:get-media-list', containerId),

  /**
   * 最小化播放器窗口
   * @returns {Promise<void>}
   */
  minimizeWindow: () => ipcRenderer.invoke('player:minimize'),

  /**
   * 最大化/还原播放器窗口
   * @returns {Promise<{maximized: boolean}>}
   */
  maximizeWindow: () => ipcRenderer.invoke('player:maximize'),

  /**
   * 关闭播放器窗口
   * @returns {Promise<void>}
   */
  closeWindow: () => ipcRenderer.invoke('player:close'),

  /**
   * 上报播放进度（Phase 44 D-13，单向 send 无需 await）
   * @param {{url: string, title: string, position: number, duration: number}} data
   */
  reportProgress: (data) => ipcRenderer.send('player:progress', data),

  /**
   * 查询续播位置（Phase 44 D-12：主进程按 origin+pathname 查观看历史）
   * @param {string} url - 视频 URL
   * @returns {Promise<{position: number, duration: number, url: string}|null>}
   */
  getResumePosition: (url) => ipcRenderer.invoke('player:resume-position', url),

  /**
   * 获取抽屉列表数据（Phase 44 D-14/D-15：缓存库 + 观看历史合并，最近观看优先）
   * @returns {Promise<Array<{title, url, playbackKey, cacheSize, completeness, lastPosition, duration, lastWatched}>>}
   */
  getDrawerList: () => ipcRenderer.invoke('player:drawer:list'),

  /**
   * 删除缓存条目（Phase 44 D-16 / G-44-8：按 videoId 整目录删除）
   * @param {string} videoId - 视频目录 ID（16 位 hex）或 playbackKey
   * @param {boolean} [deleteEntry] - 是否同时删除观看历史条目（缺省/false = 仅删缓存，
   *   D-16 原语义不变；true = 缓存删除成功后连 player_history 记录一并删除）
   * @returns {Promise<{success: boolean, error?: string, historyDeleted?: boolean}>}
   */
  deleteCacheEntry: (videoId, deleteEntry) => ipcRenderer.invoke('player:cache:delete', videoId, deleteEntry),

  /**
   * 监听主进程关窗前的最终进度索取（Phase 44 D-13/Pitfall 6：
   * 主进程 close 拦截后发此事件，renderer 立即上报一次进度并回 ack）
   * @param {Function} callback - 回调函数（无参数）
   * @returns {Function} 取消监听的清理函数
   */
  onRequestFinalProgress: (callback) => {
    const handler = () => {
      try {
        callback();
      } finally {
        ipcRenderer.send('player:final-progress-ack');
      }
    };
    ipcRenderer.on('player:request-final-progress', handler);
    return () => ipcRenderer.removeListener('player:request-final-progress', handler);
  },

  /**
   * 发起直播录制（Phase 44 D-18：显式后台任务，主进程独立轮询追分片）
   * @param {{url: string, title: string, containerId: string, referer?: string}} input
   * @returns {Promise<{success: boolean, taskId?: string, error?: string}>}
   */
  startRecord: (input) => ipcRenderer.invoke('player:record/start', input),

  /**
   * 停止录制并保存（Phase 44 D-19：写分片索引后任务转 completed）
   * @param {string} taskId - 任务 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  stopRecord: (taskId) => ipcRenderer.invoke('player:record/stop', taskId),

  /**
   * 查询录制状态（Phase 44 D-21 红点 hover：已录时长/已录大小）
   * @param {string} taskId - 任务 ID
   * @returns {Promise<Object|null>}
   */
  getRecordStatus: (taskId) => ipcRenderer.invoke('player:record/status', taskId),

  /**
   * 运行中录制任务列表（Phase 44 D-19：keep-recording 关窗后重开窗口的红点状态同步）
   * @returns {Promise<Array>}
   */
  getRecordList: () => ipcRenderer.invoke('player:record/list'),

  /**
   * 发起 MP4 转换（Phase 44 D-17/D-24：缓存条目完整度 100% 或 record 任务续转；
   * D-17 校验在主进程服务端复校，弹框选目录由主进程发起）
   * @param {{entryId?: string, taskId?: string}} input - 缓存条目 ID 或 record 任务 ID
   * @returns {Promise<{ok: boolean, taskId?: string, reason?: string}>}
   *   reason: cancelled（用户取消弹框）/ segments_incomplete / discontinuity / ...
   */
  startConvert: (input) => ipcRenderer.invoke('player:convert/start', input),

  /**
   * 监听录制任务状态变化（media-task:changed 中 type=record 的任务，Phase 44 D-20：
   * 播放状态不影响录制，红点仅按任务状态渲染）
   * @param {Function} callback - 回调函数，参数为任务对象快照（含 status/type/playbackKey）
   * @returns {Function} 取消监听的清理函数
   */
  onRecordStateChanged: (callback) => {
    const handler = (event, data) => {
      if (data && data.type === 'record') callback(data);
    };
    ipcRenderer.on('media-task:changed', handler);
    return () => ipcRenderer.removeListener('media-task:changed', handler);
  },
});

// ==================== 下载管理 API ====================

/**
 * 下载管理相关 API（独立命名空间）
 * 渲染进程通过 window.downloadAPI 访问
 */
contextBridge.exposeInMainWorld('downloadAPI', {
  /** 获取容器的下载列表 */
  getDownloads: (containerId) => ipcRenderer.invoke('download:list', containerId),

  /** 获取当前活跃下载数量 */
  getActiveCount: () => ipcRenderer.invoke('download:get-active-count'),

  /** 获取活跃下载列表（含进度信息） */
  getActiveDownloads: () => ipcRenderer.invoke('download:get-active'),

  /** 取消下载 */
  cancelDownload: (downloadId) => ipcRenderer.invoke('download:cancel', downloadId),

  /** 暂停下载 */
  pauseDownload: (downloadId) => ipcRenderer.invoke('download:pause', downloadId),

  /** 恢复下载 */
  resumeDownload: (downloadId) => ipcRenderer.invoke('download:resume', downloadId),

  /** 打开已下载文件 */
  openFile: (filePath) => ipcRenderer.invoke('download:open-file', filePath),

  /** 在 Finder 中显示文件 */
  showInFolder: (filePath) => ipcRenderer.invoke('download:show-in-folder', filePath),

  /** 监听下载开始事件 */
  onDownloadStarted: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download:started', handler);
    return () => ipcRenderer.removeListener('download:started', handler);
  },

  /** 监听下载进度事件 */
  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },

  /** 监听下载完成事件 */
  onDownloadCompleted: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download:completed', handler);
    return () => ipcRenderer.removeListener('download:completed', handler);
  },

  /** 获取全局下载列表（支持分页） */
  listAllDownloads: (limit, offset) => ipcRenderer.invoke('download:list-all', limit, offset),

  /** 删除下载记录（可选同时删除本地文件） */
  deleteDownloadRecord: (downloadId, deleteFile) => ipcRenderer.invoke('download:delete-record', downloadId, deleteFile),

  /** 清空所有下载历史 */
  clearAllDownloads: () => ipcRenderer.invoke('download:clear-all'),
});

console.log('[Realm] Preload 脚本已加载');

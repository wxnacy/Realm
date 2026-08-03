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
   * 监听 Tab 回收事件（WR-4）
   * 主进程达到 Tab 上限自动回收最久未使用的 Tab 后推送
   * @param {Function} callback - 回调函数，参数为 { tabId, message }
   */
  onTabRecycled: (callback) => {
    ipcRenderer.on('tab:recycled', (event, data) => callback(data));
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
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    promptWithContext: (data) => ipcRenderer.invoke('ai:prompt-with-context', data),

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
});

console.log('[Realm] Preload 脚本已加载');

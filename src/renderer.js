/**
 * Realm Browser - 渲染进程
 *
 * 处理 UI 交互和容器管理逻辑
 */

// DOM 元素
const elements = {
  sidebar: document.getElementById('sidebar'),
  containerList: document.getElementById('containerList'),
  containerIndicator: document.getElementById('containerIndicator'),
  indicatorIcon: document.getElementById('indicatorIcon'),
  indicatorText: document.querySelector('.indicator-text'),
  urlInput: document.getElementById('urlInput'),
  welcomePage: document.getElementById('welcomePage'),
  browserView: document.getElementById('browserView'),

  // Tab 栏
  tabBar: document.getElementById('tabBar'),
  tabList: document.getElementById('tabList'),
  tabNewBtn: document.getElementById('tabNewBtn'),
  tabScrollLeft: document.getElementById('tabScrollLeft'),
  tabScrollRight: document.getElementById('tabScrollRight'),

  // 新标签页
  newTabPage: document.getElementById('newTabPage'),
  newTabSearch: document.getElementById('newTabSearch'),
  containerShortcuts: document.getElementById('containerShortcuts'),

  // 加载进度条
  loadingBar: document.getElementById('loadingBar'),

  // 容器面板
  addContainerBtnSidebar: document.getElementById('addContainerBtnSidebar'),

  // 导航按钮
  backBtn: document.getElementById('backBtn'),
  forwardBtn: document.getElementById('forwardBtn'),
  reloadBtn: document.getElementById('reloadBtn'),
  historyBtn: document.getElementById('historyBtn'),
  favoritesBtn: document.getElementById('favoritesBtn'),
  cookiesBtn: document.getElementById('cookiesBtn'),
  quickSaveCookiesBtn: document.getElementById('quickSaveCookiesBtn'),
  settingsBtn: document.getElementById('settingsBtn'),

  // 收藏功能
  bookmarkStarBtn: document.getElementById('bookmarkStarBtn'),
  bookmarkEditPanel: document.getElementById('bookmarkEditPanel'),
  bookmarkEditHeader: document.getElementById('bookmarkEditHeader'),
  bookmarkTitleInput: document.getElementById('bookmarkTitleInput'),
  bookmarkUrlDisplay: document.getElementById('bookmarkUrlDisplay'),
  bookmarkCancelBtn: document.getElementById('bookmarkCancelBtn'),
  bookmarkSaveBtn: document.getElementById('bookmarkSaveBtn'),
  bookmarkRemoveBtn: document.getElementById('bookmarkRemoveBtn'),

  // 收藏编辑面板的文件夹选择器
  bookmarkFolderSelect: document.getElementById('bookmarkFolderSelect'),
  bookmarkFolderTrigger: document.getElementById('bookmarkFolderTrigger'),
  bookmarkFolderPath: document.getElementById('bookmarkFolderPath'),
  bookmarkFolderDropdown: document.getElementById('bookmarkFolderDropdown'),

  // 容器创建/编辑模态框
  containerModal: document.getElementById('containerModal'),
  containerModalTitle: document.getElementById('containerModalTitle'),
  containerForm: document.getElementById('containerForm'),
  containerNameInput: document.getElementById('containerNameInput'),
  nameError: document.getElementById('nameError'),
  colorPicker: document.getElementById('colorPicker'),
  emojiPicker: document.getElementById('emojiPicker'),
  cancelContainerBtn: document.getElementById('cancelContainerBtn'),
  saveContainerBtn: document.getElementById('saveContainerBtn'),

  // 扩展属性字段（手机、邮箱、备注）
  containerEmailInput: document.getElementById('containerEmailInput'),
  containerPhoneInput: document.getElementById('containerPhoneInput'),
  containerNotesInput: document.getElementById('containerNotesInput'),
  emailError: document.getElementById('emailError'),
  phoneError: document.getElementById('phoneError'),
  notesError: document.getElementById('notesError'),

  // 环境变量（高级）
  envVarsToggle: document.getElementById('envVarsToggle'),
  envVarsPanel: document.getElementById('envVarsPanel'),
  envVarsList: document.getElementById('envVarsList'),
  envVarsAddArea: document.getElementById('envVarsAddArea'),
  envVarKeyInput: document.getElementById('envVarKeyInput'),
  envVarValueInput: document.getElementById('envVarValueInput'),
  envVarSuggestions: document.getElementById('envVarSuggestions'),
  envVarConfirmBtn: document.getElementById('envVarConfirmBtn'),
  envVarCancelBtn: document.getElementById('envVarCancelBtn'),
  envVarAddBtn: document.getElementById('envVarAddBtn'),

  // 删除确认模态框
  deleteConfirmModal: document.getElementById('deleteConfirmModal'),
  deleteContainerPreview: document.getElementById('deleteContainerPreview'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

  // 启动时恢复标签页询问对话框
  restoreTabsModal: document.getElementById('restoreTabsModal'),
  restoreTabsCount: document.getElementById('restoreTabsCount'),
  restoreTabsRemember: document.getElementById('restoreTabsRemember'),
  restoreTabsYesBtn: document.getElementById('restoreTabsYesBtn'),
  restoreTabsNoBtn: document.getElementById('restoreTabsNoBtn'),

  cookiesModal: document.getElementById('cookiesModal'),
  cookiesModalTitle: document.getElementById('cookiesModalTitle'),
  cookiesList: document.getElementById('cookiesList'),
  clearCookiesBtn: document.getElementById('clearCookiesBtn'),
  refreshCookiesBtn: document.getElementById('refreshCookiesBtn'),
  closeCookiesModal: document.getElementById('closeCookiesModal'),

  // 收藏栏
  bookmarksBar: document.getElementById('bookmarksBar'),
  bookmarksBarList: document.getElementById('bookmarksBarList'),
  bookmarksOverflowBtn: document.getElementById('bookmarksOverflowBtn'),

  // 媒体面板
  mediaPanelBtn: document.getElementById('mediaPanelBtn'),
  mediaBadge: document.getElementById('mediaBadge'),
  mediaPanel: document.getElementById('mediaPanel'),
  mediaPanelCloseBtn: document.getElementById('mediaPanelCloseBtn'),
  mediaList: document.getElementById('mediaList'),
  mediaEmptyState: document.getElementById('mediaEmptyState'),

  // AI 助手面板
  aiPanel: document.getElementById('aiPanel'),
  aiPanelBtn: document.getElementById('aiPanelBtn'),
  aiPanelHeader: document.getElementById('aiPanelHeader'),
  aiPanelCloseBtn: document.getElementById('aiPanelCloseBtn'),
  aiMessageList: document.getElementById('aiMessageList'),
  aiInput: document.getElementById('aiInput'),
  aiSendBtn: document.getElementById('aiSendBtn'),
  aiScrollToBottom: document.getElementById('aiScrollToBottom'),
  aiPanelResizeHandle: document.getElementById('aiPanelResizeHandle'),

  // AI 工具栏
  aiToolbar: document.getElementById('aiToolbar'),
  aiNewChatBtn: document.getElementById('aiNewChatBtn'),
  aiModelSelector: document.getElementById('aiModelSelector'),
  aiContextBtn: document.getElementById('aiContextBtn'),
  aiContextRing: document.getElementById('aiContextRing'),
  aiContextPopover: document.getElementById('aiContextPopover'),
  aiContextCloseBtn: document.getElementById('aiContextCloseBtn'),
  aiContextPercent: document.getElementById('aiContextPercent'),
  aiContextSub: document.getElementById('aiContextSub'),
  aiContextBar: document.getElementById('aiContextBar'),
  aiContextBreakdown: document.getElementById('aiContextBreakdown'),

  // 对话历史管理
  aiHistoryBtn: document.getElementById('aiHistoryBtn'),
  aiConvDropdown: document.getElementById('aiConvDropdown'),
  aiConvList: document.getElementById('aiConvList'),
  aiConvDeleteDialog: document.getElementById('aiConvDeleteDialog'),
  aiConvDeleteMsg: document.getElementById('aiConvDeleteMsg'),
  aiConvDeleteCancel: document.getElementById('aiConvDeleteCancel'),
  aiConvDeleteConfirm: document.getElementById('aiConvDeleteConfirm'),

  // @ 引用标签页
  aiContextPills: document.getElementById('aiContextPills'),
  contextPickerPanel: document.getElementById('contextPickerPanel'),
  contextPickerSearch: document.getElementById('contextPickerSearch'),
  contextPickerList: document.getElementById('contextPickerList'),
  contextPickerEmpty: document.getElementById('contextPickerEmpty'),

  // / 斜杠命令面板
  slashPickerPanel: document.getElementById('slashPickerPanel'),
  slashPickerList: document.getElementById('slashPickerList'),

  // 页面内搜索
  findInPage: document.getElementById('findInPage'),
  findInput: document.getElementById('findInput'),
  findResultCount: document.getElementById('findResultCount'),
  findPrevBtn: document.getElementById('findPrevBtn'),
  findNextBtn: document.getElementById('findNextBtn'),
  findCaseBtn: document.getElementById('findCaseBtn'),
  findCloseBtn: document.getElementById('findCloseBtn'),

  // 凭据保存横幅
  credentialSaveBanner: document.getElementById('credentialSaveBanner'),
  credentialSaveDomain: document.getElementById('credentialSaveDomain'),
  credentialSaveBtn: document.getElementById('credentialSaveBtn'),
  credentialNeverBtn: document.getElementById('credentialNeverBtn'),
  credentialLaterBtn: document.getElementById('credentialLaterBtn'),

  // 地址保存横幅
  addressSaveBanner: document.getElementById('addressSaveBanner'),
  addressSaveConfirmBtn: document.getElementById('addressSaveConfirmBtn'),
  addressNeverBtn: document.getElementById('addressNeverBtn'),
  addressLaterBtn: document.getElementById('addressLaterBtn'),

  // 地址栏自动补全
  urlInputWrapper: document.querySelector('.url-input-wrapper'),
  autocompleteInline: document.getElementById('autocompleteInline'),
  autocompleteDropdown: document.getElementById('autocompleteDropdown'),

};

// 应用状态
const state = {
  containers: [],
  currentContainer: 'default',
  selectedColor: '#3B82F6',
  selectedIcon: 'fingerprint',
  editingContainerId: null,
  deletingContainerId: null,
  sidebarVisible: true,

  // 容器环境变量（编辑态草稿）
  containerEnvVars: [],

  // Tab 管理
  tabs: new Map(),
  activeTabId: null,
  // 当前**实际显示**的 Tab（可见性与鼠标可命中的唯一真源，由 showWebview 写入）。
  // 与 activeTabId 分开存是刻意的：拖拽收尾要按「屏幕上那个 webview」恢复可命中，
  // 而不是按「tab 栏高亮的那个」猜——两者不一致时按后者恢复会把可见页面打成点不动
  // （见 docs/debug/webview-hit-test-stuck.md）
  visibleTabId: null,
  tabCounter: 0,
  webviews: new Map(),

  // 统一导航入口 openUrl 的竞态守卫序列号：
  // 连续导航（如地址栏连续回车）时只让最后一次（seq 最大者）生效
  navSeq: 0,

  // Tab 拖拽排序状态（窗口内 HTML5 DnD）
  isDragging: false,
  draggingTabId: null,

  // 跨窗口拖拽状态（自定义 mousedown/mousemove/mouseup）
  crossDrag: {
    active: false,           // 跨窗口拖拽是否激活（超过阈值后为 true）
    tabId: null,             // 被拖拽的 Tab ID
    startScreenX: 0,         // 起始屏幕坐标
    startScreenY: 0,
    lastReportTime: 0,       // 上次报告位置的时间戳（节流用）
    targetWindowId: null,    // 当前悬停的目标窗口 ID（来自主进程检测）
    outOfTabBar: false,      // 是否拖出 Tab 栏
  },

  // 当前窗口 ID（用于跨窗口拖拽判断）
  windowId: null,

  // 内部页面服务器端口（用于加载 realm:// 页面）
  realmPort: null,
  // 内部页面 API token（/api/history/* 鉴权）
  realmToken: null,

  // 收藏状态
  isCurrentPageBookmarked: false,
  currentBookmarkId: null,
  currentBookmarkTitle: null,
  /** 当前已收藏页面所在的文件夹 ID（0 = 收藏栏根目录），来自 favoritesCheck */
  currentBookmarkFolderId: 0,
  /**
   * 收藏编辑面板**自身**的编辑目标：{isEdit, id, url}
   *
   * 保存 / 移除一律以它为准，不读全局 state —— 全局 state 会随活动 Tab 变化
   * （收藏栏右键可编辑**别的页面**的书签、面板开着时用户也能切 Tab），
   * 靠全局 state 判断模式会把操作落到另一个书签上（改错标题、甚至移错文件夹）
   */
  bookmarkPanelTarget: null,
  /** 收藏编辑面板中「待保存」的目标文件夹 ID（新增/编辑态都在此累积） */
  pendingBookmarkFolderId: 0,
  /** 文件夹树缓存（打开面板时刷新），供路径显示与下拉渲染共用 */
  bookmarkFolderTree: [],
  /** 文件夹树是否已成功加载（区分「尚未加载」与「加载了但没有该文件夹」） */
  bookmarkFolderTreeLoaded: false,
  /** 文件夹下拉是否展开 */
  bookmarkFolderDropdownOpen: false,
  /** 下拉搜索关键词（已 trim + 小写，仅用于匹配） */
  bookmarkFolderKeyword: '',
  /** 搜索关键词原样（保留大小写）：无命中时用它作新建文件夹名，不能把用户的输入改小写 */
  bookmarkFolderKeywordRaw: '',
  /** 键盘高亮项索引（对应当前可见行列表）；-1 表示无高亮 */
  bookmarkFolderHighlightIndex: -1,
  /** 当前可见行快照（渲染与键盘/点击解析共用同一份，避免两处各算一遍） */
  bookmarkFolderRows: [],
  /** 搜索无命中时给出的「用此关键词新建」名称；空串表示不显示该行 */
  bookmarkFolderSuggestion: '',
  /** 已展开的文件夹 ID 集合（0 代表根目录） */
  bookmarkFolderExpanded: new Set(),
  /** 上次保存到的文件夹 ID（懒加载；null 表示尚未从设置读取） */
  lastUsedBookmarkFolderId: null,

  // 媒体面板状态
  mediaPanelOpen: false,
  mediaItems: [],

  // 下载面板状态
  downloadPanelOpen: false,

  // AI 助手状态
  aiPanelOpen: false,
  aiMessages: [],
  aiStreaming: false,
  aiCurrentMessageId: null,
  aiAutoScroll: true,
  aiCancelledByUser: false,
  // 被取消消息锚点（G-48-4）：取消只作用于「被取消的那条消息」，不读「当前」消息 id；
  // 取消落点后清空（含对话切换两处）
  aiCancelledMessageId: null,
  aiCompacting: false,

  // 对话管理状态
  conversations: [],
  currentConversationId: null,
  convDropdownOpen: false,

  // @ 引用标签页状态
  contextPickerOpen: false,
  contextPickerSearch: '',
  contextPickerActiveIndex: 0,
  contextPickerItems: [],
  contextPickerContainerMap: {},
  referencedTabs: [],

  // AI 聊天附件状态（拖拽/粘贴；AttachmentMeta + previewUrl 渲染形状）
  aiAttachments: [],

  // AI 面板文件拖拽遮罩可见性（dragenter/dragleave 计数状态机驱动）
  aiDragActive: false,

  // / 斜杠命令面板状态
  slashPickerOpen: false,
  slashPickerItems: [],
  slashPickerActiveIndex: 0,
  // 可选中行的扁平索引集合（48-02：↑↓ 与 Enter 只认它 —— 不可选中行不得成为高亮落点）
  slashPickerSelectable: [],

  // 技能集投影缓存（主进程**收窄投影**，48 D-17；**含已禁用条目** —— 供区分
  // 「未找到」与「已禁用」两条反馈。renderer 只消费，绝不重算优先级/遮蔽/限额）
  aiSkills: [],
  aiSkillsDigest: '',

  // Vim 标签历史栈（用于 ^ 命令切换到上一个访问的标签）
  tabHistoryStack: [],

  // Vim 帮助对话框状态
  vimHelpOpen: false,

  // Vim Hint Mode 状态
  vimHintActive: false,

  // Vim 搜索模式状态
  vimSearchActive: false,
  vimSearchText: '',

  // 页面内搜索状态
  findInPageOpen: false,
  findInPageText: '',
  findInPageMatchCase: false,
  findInPageResults: { activeMatchOrdinal: 0, matches: 0 },
  findInPageDebounceTimer: null,

  // 凭据保存横幅状态
  credentialBannerTimer: null,
  pendingCredentialData: null,

  // 地址保存横幅状态
  pendingAddressData: null,
  addressBannerTimer: null,
};

// 地址栏自动补全状态
state.autocomplete = {
  query: '',
  suggestions: [],
  selectedIndex: -1,
  inlineText: '',
  isOpen: false,
  debounceTimer: null,
  cache: new Map(),
  lastRequestId: 0,  // 用于追踪最新请求，防止竞态条件
};

// 已关闭标签栈（LIFO，最多 10 条），用于"重新打开已关闭标签页"功能
const closedTabsStack = [];

/**
 * AI 输入框斜杠命令注册表
 * name: 命令名（不含 /）；description: 面板展示的中文描述
 * takesArg: 是否接受可选参数（/name 后的剩余文本作为 args 传入 handler）
 * handler: (args: string) => Promise<void>，函数声明提升保证此处可直接引用
 */
const SLASH_COMMANDS = [
  { name: 'clear', description: '开启新对话', takesArg: false, handler: executeSlashClear },
  { name: 'compact', description: '压缩上下文（可附重点说明，如 /compact 重点保留登录调试）', takesArg: true, handler: executeSlashCompact },
];

// 注意：Tab 回收策略（上限/文案/回收逻辑）单点实现于主进程 tab-manager（WR-4）。
// 渲染进程不再持有 TAB_MAX_COUNT / TAB_RECYCLE_MESSAGE / recycleOldestTab 副本，
// 回收结果经 tab:recycled 事件推送（见 handleTabRecycled）。

// Webview 安全配置（D-03，CR-1 修复）
// Electron 布尔属性（nodeintegration/disablewebsecurity/allowpopups）为 presence 语义：
// 属性存在即为 true，字符串值被忽略。因此只能保留字符串型属性 webpreferences，
// 布尔属性一律「缺席即 false」，禁止显式写入（含 'false'）。
const WEBVIEW_WEBPREFERENCES = 'contextIsolation=yes';

/**
 * 将 realm:// URL 转换为 http://localhost:PORT/ URL
 * webview 无法直接加载自定义协议，需要通过本地 HTTP 服务器中转
 * 内部页面的数据 API（/api/history/*）需要 token 鉴权，
 * 容器 ID 也通过查询参数传递给页面（guest 无法走 IPC 获取当前容器）
 * @param {string} url - realm:// 格式的 URL
 * @param {string} [containerId] - 当前容器 ID
 * @returns {string} http://localhost:PORT/ 格式的 URL
 */
function realmUrlToHttp(url, containerId) {
  if (!state.realmPort || !url.startsWith('realm://')) return url;
  let converted = url.replace(/^realm:\/\//, `http://localhost:${state.realmPort}/`);
  const params = new URLSearchParams();
  if (containerId) params.set('container', containerId);
  if (state.realmToken) params.set('token', state.realmToken);
  const query = params.toString();
  if (query) converted += (converted.includes('?') ? '&' : '?') + query;
  return converted;
}

/**
 * 将 http://localhost:PORT/ URL 转换回 realm:// URL（用于地址栏显示）
 * 查询参数（container/token）仅用于页面运行时，显示时剥离
 * @param {string} url - http://localhost:PORT/ 格式的 URL
 * @returns {string} realm:// 格式的 URL（如果不是内部页面则原样返回）
 */
function httpUrlToRealm(url) {
  if (!state.realmPort || !url.startsWith(`http://localhost:${state.realmPort}/`)) return url;
  const converted = url.replace(`http://localhost:${state.realmPort}/`, 'realm://');
  // 剥离 realm 系统查询参数（token/container），保留业务参数（如 viewsource?url=）
  const [base, query] = converted.split('?');
  if (!query) return base;
  const params = new URLSearchParams(query);
  // 播放器页面：地址栏显示与 tab 持久化统一用内嵌的原始视频地址。
  // 直接存原始 m3u8（恢复时经 maybePlayerUrl 重新包装，不依赖旧端口），
  // 历史记录/收藏保存的也是真实视频 URL 而非内部播放器地址
  if (base === 'realm://player/' || base === 'realm://player') {
    const inner = params.get('url');
    if (inner) return inner;
  }
  params.delete('token');
  params.delete('container');
  const remaining = params.toString();
  return remaining ? `${base}?${remaining}` : base;
}

/**
 * 若 URL 为 m3u8 视频文件，转换为播放器页面 URL（在当前 webview tab 内播放）
 * 携带容器与 token：播放器页面直连拉流（44-09 G-44-2，D-01：仅独立播放器
 * 窗口走 /proxy）；container/token 参数保留供页面上下文。
 * CR-06 限制：直连受 CORS / Cookie / Referer 约束（详见 src/player.js 传输层
 * 语义注释），「无 ACAO / 校验 Referer / Cookie 门控」的源站可能不可用
 * @param {string} url - 原始 URL
 * @param {string} [containerId] - 容器 ID
 * @returns {string} 播放器页面 URL 或原 URL
 */
function maybePlayerUrl(url, containerId) {
  if (!url || !state.realmPort) return url;
  // 内部服务器 URL（播放器页面自身）不再二次包装
  if (url.startsWith(`http://localhost:${state.realmPort}/`)) return url;
  if (/\.m3u8(\?.*)?$/i.test(url)) {
    const params = new URLSearchParams({ url });
    if (containerId) params.set('container', containerId);
    if (state.realmToken) params.set('token', state.realmToken);
    return `http://localhost:${state.realmPort}/player/?${params}`;
  }
  return url;
}

/**
 * URL 标准化函数
 * @param {string} input - 用户输入
 * @returns {string} 标准化后的 URL
 */
function normalizeUrl(input) {
  input = input.trim();

  // 如果已经是完整的 HTTP/HTTPS URL，直接返回
  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  // 如果是 realm:// 自定义协议 URL，直接返回
  if (/^realm:\/\//i.test(input)) {
    return input;
  }

  // 如果是 file:// 本地文件 URL，直接返回（访问本地 HTML 等）
  if (/^file:\/\//i.test(input)) {
    return input;
  }

  // localhost 地址（带端口），添加 http://
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) {
    return `http://${input}`;
  }

  // IP 地址（带端口），添加 http://
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(input)) {
    return `http://${input}`;
  }

  // 如果看起来像域名（包含点号），添加 https://
  if (/^[\w-]+(\.[\w-]+)+/.test(input)) {
    return `https://${input}`;
  }

  // 其他情况当作搜索查询
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

// ==================== 收藏功能 ====================

/**
 * 检查当前页面是否已收藏，更新星标状态
 * 收藏数据全局共享，与容器无关
 * @param {string} url - 当前页面 URL
 */
async function checkBookmarkStatus(url) {
  if (!url || url === 'about:blank') {
    // 无 URL 或空白页不查询收藏状态，同时清空收藏相关 state
    state.isCurrentPageBookmarked = false;
    state.currentBookmarkId = null;
    state.currentBookmarkTitle = null;
    state.currentBookmarkFolderId = 0;
    updateStarButton(false);
    return;
  }
  try {
    const result = await window.realmAPI.favoritesCheck(url);
    state.isCurrentPageBookmarked = !!result;
    state.currentBookmarkId = result ? result.id : null;
    state.currentBookmarkTitle = result ? result.title : null;
    // 收藏所在文件夹（0 = 收藏栏根目录）：星标弹窗据此显示当前文件夹
    state.currentBookmarkFolderId = result ? (result.folder_id || 0) : 0;
    updateStarButton(!!result);
  } catch (err) {
    console.error('[Realm Renderer] 检查收藏状态失败:', err);
  }
}

/** 正在回写 favicon 的页面 URL 集合（防 page-favicon-updated 多次触发重复 IPC） */
const faviconBackfillInflight = new Set();

/**
 * 访问已收藏页面时回写真实 favicon（Chrome 范式惰性填充）
 *
 * 收藏记录 favicon 为空（UI 显示 realm 默认图标）时，把 tab 实时加载到的
 * favicon 源 URL 交给主进程抓取转 data URL 入库；写入成功由主进程广播
 * bookmarks-bar:refresh，收藏栏/文件夹菜单重开即显示新图标。
 *
 * 独立执行 favoritesCheck 查询，不依赖 checkBookmarkStatus 的全局 state
 * （多 Tab 场景下全局 state 只对活动 Tab 有效，会串）。
 *
 * @param {Object} tab - Tab 对象
 * @param {string} faviconUrl - webview page-favicon-updated 给出的 favicon 源 URL
 */
async function maybeBackfillBookmarkFavicon(tab, faviconUrl) {
  if (!tab || !tab.url || !faviconUrl) return;
  if (tab.url === 'about:blank' || tab.url.startsWith('realm:')) return;
  if (faviconBackfillInflight.has(tab.url)) return;

  faviconBackfillInflight.add(tab.url);
  try {
    const record = await window.realmAPI.favoritesCheck(tab.url);
    // 未收藏或已有图标时无需回写
    if (!record || record.favicon_url) return;
    await window.realmAPI.favoritesUpdateFavicon(record.id, faviconUrl);
  } catch (err) {
    console.error('[Realm Renderer] 收藏 favicon 回写失败:', err);
  } finally {
    // 成功失败都允许未来重试：成功后 DB 非空，下次 favoritesCheck 自然跳过
    faviconBackfillInflight.delete(tab.url);
  }
}

/**
 * 更新星标按钮显示状态
 * @param {boolean} bookmarked - 是否已收藏
 */
function updateStarButton(bookmarked) {  const outline = elements.bookmarkStarBtn.querySelector('.star-outline');
  const filled = elements.bookmarkStarBtn.querySelector('.star-filled');
  if (bookmarked) {
    outline.style.display = 'none';
    filled.style.display = 'block';
    elements.bookmarkStarBtn.title = '取消收藏';
  } else {
    outline.style.display = 'block';
    filled.style.display = 'none';
    elements.bookmarkStarBtn.title = '收藏';
  }
}

/**
 * 显示收藏编辑面板
 * @param {string} title - 页面标题
 * @param {string} url - 页面 URL
 * @param {boolean} isEdit - 是否为编辑模式（已收藏页面再次点击星标）
 *   true：显示"移除收藏"按钮，标题为"编辑收藏"，保存调用 update
 *   false：隐藏"移除收藏"按钮，标题为"收藏此页面"，保存调用 add
 * @param {number} [folderId] - 该收藏当前所在的文件夹 ID（0 = 收藏栏根目录）。
 *   编辑态由调用方给出；新增态传 0，稍后由「上次保存到的文件夹」补齐
 */
function showBookmarkEditPanel(title, url, isEdit = false, folderId = 0) {
  elements.bookmarkTitleInput.value = title || '';
  elements.bookmarkUrlDisplay.textContent = url || '';

  // 编辑模式 UI 切换
  elements.bookmarkEditHeader.textContent = isEdit ? '编辑收藏' : '收藏此页面';
  elements.bookmarkRemoveBtn.style.display = isEdit ? '' : 'none';

  // 固化本次的编辑目标（详见 state.bookmarkPanelTarget 的说明）
  state.bookmarkPanelTarget = {
    isEdit: !!isEdit,
    id: isEdit ? state.currentBookmarkId : null,
    url: url || '',
  };

  // 文件夹初值 + 重置下拉状态（上次打开的折叠/搜索状态不带到这一次）
  state.pendingBookmarkFolderId = folderId || 0;
  state.bookmarkFolderExpanded = new Set();
  closeBookmarkFolderDropdown();
  updateBookmarkFolderTrigger();
  // 树与记忆值异步补齐：面板本身必须同步打开（见 loadBookmarkFolderContext 说明）
  loadBookmarkFolderContext(isEdit, state.pendingBookmarkFolderId);

  // 使用 <dialog> + showModal()：进入 top layer，天然覆盖 Electron <webview>
  // （webview 是独立 guest WebContents，z-index/visibility 对其不可靠，
  //  项目其他模态框如 cookiesModal/rulesModal 均用此模式）
  if (!elements.bookmarkEditPanel.open) {
    elements.bookmarkEditPanel.showModal();
  }
  // 锚定到星标按钮下方（AI 面板打开时按钮位置会左移）
  positionPanelBelowButton(elements.bookmarkEditPanel, elements.bookmarkStarBtn);

  elements.bookmarkTitleInput.focus();
  elements.bookmarkTitleInput.select();
}

/**
 * 隐藏收藏编辑面板
 */
function hideBookmarkEditPanel() {
  closeBookmarkFolderDropdown();
  state.bookmarkPanelTarget = null;
  if (elements.bookmarkEditPanel.open) {
    elements.bookmarkEditPanel.close();
  }
  // 收藏栏右键「编辑」打开的可能**不是**当前页面的收藏，它会把全局 state 指向
  // 另一个书签；收尾时按活动 Tab 重新对齐，避免星标停在与当前页不符的状态上
  const activeTab = state.tabs.get(state.activeTabId);
  if (activeTab && activeTab.url) {
    checkBookmarkStatus(activeTab.url);
  }
}

/**
 * 保存收藏
 * 已收藏（编辑模式）：调用 favoritesUpdate 更新标题与所在文件夹
 * 未收藏（新增模式）：调用 favoritesAdd 新增记录（含所在文件夹）
 */
async function saveBookmark() {
  const title = elements.bookmarkTitleInput.value.trim();
  const url = elements.bookmarkUrlDisplay.textContent;

  if (!url) return;

  // 面板打开期间该文件夹可能在收藏页被删除 ⇒ 写入前收敛，
  // 否则会写进一个悬空 folder_id（收藏在所有视图里都看不到）
  const folderId = resolveFolderId(state.pendingBookmarkFolderId);

  // 模式与目标一律取自面板自己固化的编辑目标，而不是全局 state（见 bookmarkPanelTarget）
  const target = state.bookmarkPanelTarget || { isEdit: false, id: null, url };

  let toastMessage = null;
  let toastType = 'success';
  let shouldRememberFolder = true;

  try {
    if (target.isEdit && target.id) {
      // 编辑模式：更新标题与所在文件夹
      await window.realmAPI.favoritesUpdate(target.id, title, folderId);
      // 同步 state，避免下次打开仍是旧值
      state.currentBookmarkTitle = title;
      state.currentBookmarkFolderId = folderId;
      toastMessage = '已更新收藏';
    } else {
      // 新增模式：插入新记录（含所在文件夹），从当前 tab 获取 favicon
      const activeTab = state.tabs.get(state.activeTabId);
      const faviconUrl = activeTab ? (activeTab.faviconUrl || '') : '';
      const result = await window.realmAPI.favoritesAdd({
        url,
        title,
        faviconUrl,
        folderId,
      });

      if (result.error === 'duplicate') {
        toastMessage = '已收藏过该页面';
        toastType = 'error';
        shouldRememberFolder = false;
      } else {
        state.isCurrentPageBookmarked = true;
        state.currentBookmarkId = result.id;
        state.currentBookmarkTitle = title; // 同步 state
        state.currentBookmarkFolderId = folderId;
        updateStarButton(true);
        toastMessage = '已收藏';
      }
    }
    // 记住本次保存到的文件夹：下一次新增默认落到它（Chrome 同款行为）
    if (shouldRememberFolder) {
      rememberLastUsedBookmarkFolder(folderId);
    }
  } catch (err) {
    console.error('[Realm Renderer] 收藏失败:', err);
    toastMessage = '收藏失败，请重试';
    toastType = 'error';
  }

  // 先关闭 dialog（释放 top layer）再弹 toast，
  // 否则 toast 被 modal dialog 完全遮挡，用户看不到保存反馈
  hideBookmarkEditPanel();
  if (toastMessage) {
    showToast(toastMessage, toastType);
  }

  // 刷新收藏栏显示
  if (window.bookmarksBar) {
    window.bookmarksBar.load();
  }
}

/**
 * 取消收藏当前页面（编辑面板"移除收藏"按钮触发）
 */
async function removeBookmark() {
  // 移除的对象取自面板固化的编辑目标（与保存同一口径），而非全局 state
  const bookmarkId = state.bookmarkPanelTarget
    ? state.bookmarkPanelTarget.id
    : state.currentBookmarkId;

  if (!bookmarkId) return;

  let toastMessage = null;
  let toastType = 'success';

  try {
    await window.realmAPI.favoritesDelete(bookmarkId);
    state.isCurrentPageBookmarked = false;
    state.currentBookmarkId = null;
    state.currentBookmarkTitle = null;
    state.currentBookmarkFolderId = 0;
    updateStarButton(false);
    toastMessage = '已取消收藏';
  } catch (err) {
    console.error('[Realm Renderer] 取消收藏失败:', err);
    toastMessage = '取消收藏失败';
    toastType = 'error';
  }

  // 与 saveBookmark 同理：先关 dialog 再弹 toast，避免遮挡
  hideBookmarkEditPanel();
  if (toastMessage) {
    showToast(toastMessage, toastType);
  }

  // 刷新收藏栏显示
  if (window.bookmarksBar) {
    window.bookmarksBar.load();
  }
}

// ==================== 收藏编辑面板：文件夹选择器 ====================
// 对标 Chrome 星标弹窗的「文件夹」组合框：触发器显示面包屑路径，
// 点开是「搜索框 + 文件夹树 + 新建行」。根目录（folder_id = 0）内容实际
// 展示在收藏栏上，故显示为「收藏栏」（收藏页对同一层用的是「所有书签」）。

/** 根目录（folder_id = 0）在收藏栏上的显示名 */
const FOLDER_ROOT_LABEL = '收藏栏';

/** 「上次保存到的文件夹」在设置中的键（写入 settings.bookmarksBar 之下） */
const LAST_USED_FOLDER_SETTING_KEY = 'bookmarksBar.lastUsedFavoriteFolderId';

/**
 * 在文件夹树中查找到目标文件夹的完整路径
 * @param {Array} tree - 文件夹树
 * @param {number} folderId - 目标文件夹 ID
 * @param {Array} [path] - 递归累积的祖先路径 [{id, name}]
 * @returns {Array<{id: number, name: string}>|null} 路径（含目标自身），未找到为 null
 */
function findFolderPath(tree, folderId, path = []) {
  for (const folder of tree) {
    const next = [...path, { id: folder.id, name: folder.name }];
    if (folder.id === folderId) return next;
    if (Array.isArray(folder.children) && folder.children.length > 0) {
      const found = findFolderPath(folder.children, folderId, next);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 文件夹的面包屑显示文本
 * @param {number} folderId - 文件夹 ID（0 表示根目录）
 * @returns {string} 形如「收藏栏 / 开发 / 前端」
 */
function folderDisplayPath(folderId) {
  if (!folderId) return FOLDER_ROOT_LABEL;
  const path = findFolderPath(state.bookmarkFolderTree, folderId);
  // 树已加载但找不到 ⇒ 文件夹已被删除；树未加载 ⇒ 暂不知晓，先按根目录显示
  if (!path) return FOLDER_ROOT_LABEL;
  return [FOLDER_ROOT_LABEL, ...path.map((item) => item.name)].join(' / ');
}

/**
 * 把文件夹 ID 收敛为「树里真实存在」的 ID
 *
 * 悬空 folder_id 的后果是收藏在根目录与任何文件夹里都看不到（等于凭空消失），
 * 因此写入前一律收敛。树尚未加载时原样返回——此时用户还没有选择的余地，
 * 数据层对不存在的文件夹也会拒绝写入并回报错误，不会静默落库。
 *
 * @param {number} folderId - 待校验的文件夹 ID
 * @returns {number} 可安全写入的文件夹 ID（0 或树中存在的 ID）
 */
function resolveFolderId(folderId) {
  if (!folderId) return 0;
  if (!state.bookmarkFolderTreeLoaded) return folderId;
  return findFolderPath(state.bookmarkFolderTree, folderId) ? folderId : 0;
}

/**
 * 刷新触发器显示的面包屑与悬停全路径
 */
function updateBookmarkFolderTrigger() {
  if (!elements.bookmarkFolderPath || !elements.bookmarkFolderTrigger) return;
  const text = folderDisplayPath(state.pendingBookmarkFolderId);
  elements.bookmarkFolderPath.textContent = text;
  elements.bookmarkFolderTrigger.title = text;
}

/**
 * 拉取文件夹树并刷新界面
 *
 * 必须在每次打开面板时重新拉取：面板关闭期间用户可能在收藏页增删文件夹。
 * 失败时降级为「空树 + 错误提示」，绝不抛出（面板本身仍可用，只是选不了文件夹）。
 *
 * @returns {Promise<boolean>} 是否加载成功
 */
async function refreshBookmarkFolderTree() {
  try {
    const tree = await window.realmAPI.getFavoriteFolderTree();
    state.bookmarkFolderTree = Array.isArray(tree) ? tree : [];
    state.bookmarkFolderTreeLoaded = true;
  } catch (err) {
    console.error('[Realm Renderer] 加载文件夹树失败:', err);
    state.bookmarkFolderTree = [];
    state.bookmarkFolderTreeLoaded = false;
  }

  // 待保存的文件夹可能已在别处被删除 ⇒ 收敛，避免保存时写入悬空 ID
  state.pendingBookmarkFolderId = resolveFolderId(state.pendingBookmarkFolderId);
  updateBookmarkFolderTrigger();
  if (state.bookmarkFolderDropdownOpen) {
    ensureBookmarkFolderAncestorsExpanded();
    renderBookmarkFolderList();
  }
  return state.bookmarkFolderTreeLoaded;
}

/**
 * 读取「上次保存到的文件夹」（懒加载，进程内缓存）
 * @returns {Promise<number>} 文件夹 ID；未设置或读取失败时为 0
 */
async function getLastUsedBookmarkFolderId() {
  if (state.lastUsedBookmarkFolderId !== null) return state.lastUsedBookmarkFolderId;

  let value = 0;
  try {
    const settings = await window.realmAPI.getSettings();
    const raw = settings && settings.bookmarksBar
      ? settings.bookmarksBar.lastUsedFavoriteFolderId
      : undefined;
    if (Number.isInteger(raw) && raw > 0) value = raw;
  } catch (err) {
    console.error('[Realm Renderer] 读取上次收藏文件夹失败:', err);
  }

  state.lastUsedBookmarkFolderId = value;
  return value;
}

/**
 * 记住本次保存到的文件夹（Chrome 同款行为：下次新增默认落到它）
 * @param {number} folderId - 文件夹 ID
 */
function rememberLastUsedBookmarkFolder(folderId) {
  const value = folderId || 0;
  state.lastUsedBookmarkFolderId = value;
  // 持久化失败只影响下次的默认值，不影响本次保存结果
  window.realmAPI.setSetting(LAST_USED_FOLDER_SETTING_KEY, value).catch((err) => {
    console.error('[Realm Renderer] 记录上次收藏文件夹失败:', err);
  });
}

/**
 * 收集下拉中当前「可见」的文件夹行
 *
 * 可见 = 自身命中关键词，或子树内有命中（命中项的**祖先**要留作上下文，
 * 否则过滤后只剩孤立一行，看不出它在哪一层）。
 * 关键词非空时忽略折叠状态、一律展开，否则命中项会被折叠藏起来。
 *
 * @returns {{rows: Array, matchCount: number}} 行列表与命中数
 */
function collectBookmarkFolderRows() {
  const keyword = state.bookmarkFolderKeyword;

  /**
   * 递归收集子树中的可见行
   * @param {Array} nodes - 当前层的文件夹节点
   * @param {number} level - 层级（用于缩进）
   * @returns {{rows: Array, matches: number}}
   */
  function collect(nodes, level) {
    const rows = [];
    let matches = 0;
    for (const folder of nodes) {
      const children = Array.isArray(folder.children) ? folder.children : [];
      const sub = collect(children, level + 1);
      const selfMatch = !keyword || folder.name.toLowerCase().includes(keyword);
      if (!selfMatch && sub.matches === 0) continue;
      if (selfMatch) matches += 1;
      matches += sub.matches;
      rows.push({
        id: folder.id,
        name: folder.name,
        level,
        hasChildren: children.length > 0,
        expanded: keyword ? true : state.bookmarkFolderExpanded.has(folder.id),
      });
      if (keyword || state.bookmarkFolderExpanded.has(folder.id)) {
        rows.push(...sub.rows);
      }
    }
    return { rows, matches };
  }

  const rootExpanded = keyword ? true : state.bookmarkFolderExpanded.has(0);
  const top = collect(state.bookmarkFolderTree, 1);
  const rows = [{
    id: 0,
    name: FOLDER_ROOT_LABEL,
    level: 0,
    hasChildren: state.bookmarkFolderTree.length > 0,
    expanded: rootExpanded,
  }];
  if (rootExpanded) rows.push(...top.rows);

  const rootMatch = keyword && FOLDER_ROOT_LABEL.toLowerCase().includes(keyword) ? 1 : 0;
  return { rows, matchCount: rootMatch + top.matches };
}

/**
 * 展开当前选中文件夹的祖先链（根目录恒展开）
 *
 * 不展开目标自身：只需把它露出来，没有必要顺带展开它的子级。
 */
function ensureBookmarkFolderAncestorsExpanded() {
  state.bookmarkFolderExpanded.add(0);
  const path = findFolderPath(state.bookmarkFolderTree, state.pendingBookmarkFolderId);
  if (!path) return;
  for (const node of path.slice(0, -1)) {
    state.bookmarkFolderExpanded.add(node.id);
  }
}

/**
 * 折叠 / 展开一个文件夹节点
 * @param {number} folderId - 文件夹 ID（0 表示根目录）
 */
function toggleBookmarkFolderExpanded(folderId) {
  if (state.bookmarkFolderExpanded.has(folderId)) {
    state.bookmarkFolderExpanded.delete(folderId);
  } else {
    state.bookmarkFolderExpanded.add(folderId);
  }
  state.bookmarkFolderHighlightIndex = -1;
  renderBookmarkFolderList();
}

/**
 * 构建下拉的固定骨架（搜索框 / 列表容器 / 新建行）
 *
 * 只在每次打开时构建一次：列表内容单独渲染，避免每敲一个字符就把搜索框
 * 重建一遍——那会丢掉焦点与光标位置。
 */
function buildBookmarkFolderDropdownShell() {
  const dropdown = elements.bookmarkFolderDropdown;
  if (!dropdown) return;
  dropdown.innerHTML = '';

  const search = document.createElement('input');
  search.type = 'text';
  search.id = 'bookmarkFolderSearchInput';
  search.className = 'bookmark-folder-search';
  search.placeholder = '搜索文件夹';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', '搜索文件夹');
  search.addEventListener('input', (e) => {
    // 中文 IME 合成期间的 input 是拼音中间态（如 "kf"），据此过滤会把树整空、
    // 候选词也无法正常挑选。统一等 compositionend 拿到落定值再过滤
    if (e.isComposing) return;
    applyBookmarkFolderKeyword(e.target.value);
  });
  search.addEventListener('compositionend', (e) => {
    applyBookmarkFolderKeyword(e.target.value);
  });
  search.addEventListener('keydown', handleBookmarkFolderSearchKeydown);
  dropdown.appendChild(search);

  const list = document.createElement('div');
  list.id = 'bookmarkFolderList';
  list.className = 'bookmark-folder-list';
  list.setAttribute('role', 'tree');
  // 事件委托只挂在列表上：新建行的输入框不在其中，不会误触发选中
  list.addEventListener('click', (e) => {
    const el = e.target.closest('.bookmark-folder-row, .bookmark-folder-create-suggestion');
    if (!el) return;
    const index = Number(el.dataset.index);
    if (!Number.isNaN(index)) {
      activateBookmarkFolderRow(index);
    }
  });
  dropdown.appendChild(list);

  const createRow = document.createElement('div');
  createRow.className = 'bookmark-folder-create-row';

  const icon = document.createElement('span');
  icon.className = 'bookmark-folder-create-icon';
  icon.textContent = '＋';

  const createInput = document.createElement('input');
  createInput.type = 'text';
  createInput.id = 'bookmarkFolderCreateInput';
  createInput.className = 'bookmark-folder-create-input';
  createInput.autocomplete = 'off';
  createInput.setAttribute('aria-label', '新建文件夹');
  createInput.addEventListener('click', (e) => e.stopPropagation());
  createInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createFolderInBookmarkDropdown(createInput.value);
    } else if (e.key === 'Escape') {
      // 只收起下拉（并阻止 dialog 的原生 Escape 关闭），与搜索框一致
      e.preventDefault();
      e.stopPropagation();
      closeBookmarkFolderDropdown();
      elements.bookmarkFolderTrigger.focus();
    }
  });

  icon.addEventListener('click', () => createInput.focus());
  createRow.appendChild(icon);
  createRow.appendChild(createInput);
  dropdown.appendChild(createRow);
}

/**
 * 应用搜索关键词并重绘列表
 * @param {string} raw - 输入框原值
 */
function applyBookmarkFolderKeyword(raw) {
  const trimmed = (raw || '').trim();
  state.bookmarkFolderKeywordRaw = trimmed;
  state.bookmarkFolderKeyword = trimmed.toLowerCase();
  state.bookmarkFolderHighlightIndex = -1;
  renderBookmarkFolderList();
}

/**
 * 渲染列表内容（树行 + 搜索建议行）
 */
function renderBookmarkFolderList() {
  const list = document.getElementById('bookmarkFolderList');
  if (!list) return;

  const { rows, matchCount } = collectBookmarkFolderRows();
  // 建议行取**原样**关键词：新建出的文件夹名必须保留用户输入的大小写
  const suggestion = state.bookmarkFolderKeyword && matchCount === 0
    ? state.bookmarkFolderKeywordRaw
    : '';

  // 渲染快照与解析入口共用同一份数据（键盘与点击都按 data-index 回到这里取行）
  state.bookmarkFolderRows = rows;
  state.bookmarkFolderSuggestion = suggestion;

  list.innerHTML = '';
  let index = 0;

  if (suggestion) {
    const el = document.createElement('div');
    el.className = 'bookmark-folder-create-suggestion';
    el.dataset.index = String(index);
    el.textContent = `＋ 新建文件夹 "${suggestion}"`;
    list.appendChild(el);
    index += 1;
  }

  for (const row of rows) {
    list.appendChild(buildBookmarkFolderRow(row, index));
    index += 1;
  }

  if (rows.length === 0 && !suggestion) {
    const note = document.createElement('div');
    note.className = state.bookmarkFolderTreeLoaded ? 'bookmark-folder-empty' : 'bookmark-folder-error';
    note.textContent = state.bookmarkFolderTreeLoaded ? '暂无文件夹' : '文件夹加载失败';
    list.appendChild(note);
  }

  applyBookmarkFolderHighlight();
  updateBookmarkFolderCreatePlaceholder();
}

/**
 * 构建一个文件夹树行
 * @param {Object} row - collectBookmarkFolderRows 产出的行数据
 * @param {number} index - 行在可见列表中的索引（键盘/点击解析用）
 * @returns {HTMLElement} 行元素
 */
function buildBookmarkFolderRow(row, index) {
  const el = document.createElement('div');
  el.className = 'bookmark-folder-row';
  el.dataset.index = String(index);
  el.dataset.folderId = String(row.id);
  el.style.paddingLeft = `${10 + row.level * 16}px`;
  el.setAttribute('role', 'treeitem');

  const isSelected = row.id === state.pendingBookmarkFolderId;
  if (isSelected) el.classList.add('selected');
  // expanded 类仅供调试与 UAT 判读折叠状态
  if (row.expanded) el.classList.add('expanded');

  const expand = document.createElement('span');
  expand.className = row.hasChildren ? 'bookmark-folder-expand' : 'bookmark-folder-expand empty';
  expand.textContent = row.expanded ? '▾' : '▸';
  expand.addEventListener('click', (e) => {
    // 点三角只折叠/展开，不改选中项
    e.stopPropagation();
    toggleBookmarkFolderExpanded(row.id);
  });

  const name = document.createElement('span');
  name.className = 'bookmark-folder-name';
  name.textContent = row.id === 0 ? FOLDER_ROOT_LABEL : row.name;

  el.appendChild(expand);
  el.appendChild(name);

  if (isSelected) {
    const check = document.createElement('span');
    check.className = 'bookmark-folder-check';
    check.textContent = '✓';
    el.appendChild(check);
  }

  return el;
}

/**
 * 应用键盘高亮样式
 */
function applyBookmarkFolderHighlight() {
  const list = document.getElementById('bookmarkFolderList');
  if (!list) return;
  list.querySelectorAll('.highlighted').forEach((el) => el.classList.remove('highlighted'));
  const index = state.bookmarkFolderHighlightIndex;
  if (index < 0) return;
  const target = list.querySelector(`[data-index="${index}"]`);
  if (target) target.classList.add('highlighted');
}

/**
 * 把键盘高亮项滚动到可视区
 */
function scrollBookmarkFolderHighlightIntoView() {
  const list = document.getElementById('bookmarkFolderList');
  if (!list) return;
  const index = state.bookmarkFolderHighlightIndex;
  if (index < 0) return;
  const target = list.querySelector(`[data-index="${index}"]`);
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * 新建行的 placeholder：显式写出父级文件夹
 *
 * Chrome 的「新建文件夹」建到哪个节点下并不直观，这里用文案直接说明。
 */
function updateBookmarkFolderCreatePlaceholder() {
  const input = document.getElementById('bookmarkFolderCreateInput');
  if (!input) return;
  input.placeholder = `在 ${folderDisplayPath(state.pendingBookmarkFolderId)} 中新建`;
}

/**
 * 按可见列表索引激活一行（键盘 Enter 与鼠标点击共用同一解析）
 * @param {number} index - 可见列表索引（建议行占 0 时，树行整体后移 1）
 */
function activateBookmarkFolderRow(index) {
  if (index < 0) return;

  // 建议行（搜索无命中时的「用此关键词新建」）
  if (state.bookmarkFolderSuggestion && index === 0) {
    createFolderInBookmarkDropdown(state.bookmarkFolderSuggestion);
    return;
  }

  const rowIndex = state.bookmarkFolderSuggestion ? index - 1 : index;
  const row = state.bookmarkFolderRows[rowIndex];
  if (row) selectBookmarkFolder(row.id);
}

/**
 * 选中文件夹（更新待保存值并收起下拉）
 * @param {number} folderId - 文件夹 ID（0 表示根目录）
 */
function selectBookmarkFolder(folderId) {
  state.pendingBookmarkFolderId = folderId || 0;
  updateBookmarkFolderTrigger();
  closeBookmarkFolderDropdown();
  elements.bookmarkFolderTrigger.focus();
}

/**
 * 搜索框键盘交互：焦点全程留在搜索框上，用高亮项表达「当前指向哪一行」
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleBookmarkFolderSearchKeydown(e) {
  if (e.key === 'Escape') {
    // 只收起下拉；preventDefault 同时阻止 <dialog> 的原生 Escape 关闭
    e.preventDefault();
    e.stopPropagation();
    closeBookmarkFolderDropdown();
    elements.bookmarkFolderTrigger.focus();
    return;
  }

  const total = state.bookmarkFolderRows.length + (state.bookmarkFolderSuggestion ? 1 : 0);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (total === 0) return;
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const current = state.bookmarkFolderHighlightIndex;
    // -1 表示尚无高亮：向下从首项开始，向上从末项开始
    state.bookmarkFolderHighlightIndex = current < 0
      ? (delta > 0 ? 0 : total - 1)
      : (current + delta + total) % total;
    applyBookmarkFolderHighlight();
    scrollBookmarkFolderHighlightIntoView();
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    activateBookmarkFolderRow(state.bookmarkFolderHighlightIndex);
  }
}

/**
 * 在当前选中的文件夹下新建文件夹，并自动选中新建结果
 * @param {string} rawName - 文件夹名称
 */
async function createFolderInBookmarkDropdown(rawName) {
  const name = (rawName || '').trim();
  if (!name) return;

  // 父级 = 当前已选中的文件夹（新建行的 placeholder 已写明这一点）
  const parentId = resolveFolderId(state.pendingBookmarkFolderId);
  try {
    const result = await window.realmAPI.createFavoriteFolder(name, parentId);
    if (!result || result.error) {
      showToast(result && result.message ? result.message : '新建文件夹失败', 'error');
      return;
    }

    // 新建的文件夹要能立刻看见：展开它的父级，再重拉树
    state.bookmarkFolderExpanded.add(parentId);
    await refreshBookmarkFolderTree();

    state.pendingBookmarkFolderId = result.id;
    state.bookmarkFolderKeyword = '';
    state.bookmarkFolderKeywordRaw = '';
    state.bookmarkFolderHighlightIndex = -1;
    updateBookmarkFolderTrigger();
    // 新建即选定：收起下拉，与「点某一行选中」保持一致（Chrome 亦如此）
    closeBookmarkFolderDropdown();
  } catch (err) {
    console.error('[Realm Renderer] 新建文件夹失败:', err);
    showToast('新建文件夹失败', 'error');
  }
}

/**
 * 展开文件夹下拉
 */
function openBookmarkFolderDropdown() {
  const dropdown = elements.bookmarkFolderDropdown;
  if (!dropdown) return;

  state.bookmarkFolderDropdownOpen = true;
  state.bookmarkFolderKeyword = '';
  state.bookmarkFolderKeywordRaw = '';
  state.bookmarkFolderHighlightIndex = -1;
  state.bookmarkFolderSuggestion = '';
  ensureBookmarkFolderAncestorsExpanded();

  buildBookmarkFolderDropdownShell();
  renderBookmarkFolderList();

  // 先去掉 hidden 再量尺寸：display:none 下 rect 全 0，算不出剩余空间
  dropdown.classList.remove('hidden');
  elements.bookmarkFolderTrigger.setAttribute('aria-expanded', 'true');
  applyBookmarkFolderDropdownMaxHeight();

  const search = document.getElementById('bookmarkFolderSearchInput');
  if (search) {
    search.value = '';
    search.focus();
  }
}

/**
 * 收起文件夹下拉
 */
function closeBookmarkFolderDropdown() {
  state.bookmarkFolderDropdownOpen = false;
  state.bookmarkFolderKeyword = '';
  state.bookmarkFolderKeywordRaw = '';
  state.bookmarkFolderHighlightIndex = -1;
  state.bookmarkFolderSuggestion = '';
  state.bookmarkFolderRows = [];

  if (elements.bookmarkFolderDropdown) {
    elements.bookmarkFolderDropdown.classList.add('hidden');
    // 清空 DOM：下次打开重建骨架，避免残留上一次的输入值与监听器
    elements.bookmarkFolderDropdown.innerHTML = '';
    elements.bookmarkFolderDropdown.style.maxHeight = '';
  }
  if (elements.bookmarkFolderTrigger) {
    elements.bookmarkFolderTrigger.setAttribute('aria-expanded', 'false');
  }
}

/**
 * 按视口剩余空间收窄下拉高度
 *
 * 下拉是绝对定位的子元素，不参与 dialog 的尺寸计算（弹窗本身不会被撑高，
 * 因而无需重新定位）；代价是贴近窗口底部时会被视口裁掉，故按剩余空间限制。
 */
function applyBookmarkFolderDropdownMaxHeight() {
  const dropdown = elements.bookmarkFolderDropdown;
  if (!dropdown) return;
  const rect = dropdown.getBoundingClientRect();
  const available = window.innerHeight - rect.top - 12;
  // 下限 120px：窗口极矮时仍要能看清几行，而不是压成一条缝
  dropdown.style.maxHeight = `${Math.max(120, Math.min(260, Math.floor(available)))}px`;
}

/**
 * 面板打开后异步补齐文件夹上下文（拉树 + 新增态解析「上次使用」）
 *
 * 刻意异步：面板必须同步打开（UAT 驱动与 positionPanelBelowButton 都依赖
 * showModal 后的同步状态），树与设置读回来只更新文本，不影响打开时机。
 *
 * @param {boolean} isEdit - 是否编辑态（编辑态用收藏自身的文件夹，不吃记忆值）
 * @param {number} initialPending - 打开时的待保存值（用于判断用户是否已改选）
 */
async function loadBookmarkFolderContext(isEdit, initialPending) {
  await refreshBookmarkFolderTree();
  if (!elements.bookmarkEditPanel.open) return;

  if (!isEdit) {
    const remembered = await getLastUsedBookmarkFolderId();
    // 仅在用户尚未手动改选时套用记忆值（异步期间可能已经点开下拉选过了）
    if (remembered && state.pendingBookmarkFolderId === initialPending) {
      state.pendingBookmarkFolderId = resolveFolderId(remembered);
      updateBookmarkFolderTrigger();
    }
  }

  if (state.bookmarkFolderDropdownOpen) {
    ensureBookmarkFolderAncestorsExpanded();
    renderBookmarkFolderList();
  }
}

/**
 * 创建 Tab DOM 元素（createTab/restoreTabs/renderTabs 三处统一入口）
 * @param {Object} tab - Tab 数据对象（含 id/containerId/title/faviconUrl）
 * @returns {HTMLElement} Tab DOM 元素
 */
function createTabElement(tab) {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab';
  tabElement.dataset.tabId = tab.id;
  // 注意：Tab 不使用 HTML5 DnD（draggable）。窗口内排序与跨窗口拖拽统一由
  // initTabDragAndDrop 的自定义 mousedown/mousemove/mouseup 管线处理，
  // 避免两套拖拽机制竞争导致首次拖拽不生效（36-UAT 问题 4）
  tabElement.setAttribute('role', 'tab');

  const color = getContainerColor(tab.containerId);
  // 容器色写入 CSS 变量：选中态边框（.tab.active）由此取色，切换 active 类无需回写内联样式
  tabElement.style.setProperty('--tab-container-color', color);
  const colorLine = document.createElement('div');
  colorLine.className = 'tab-color-line';
  colorLine.style.backgroundColor = color;

  const content = document.createElement('div');
  content.className = 'tab-content';

  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.faviconUrl || '';
  favicon.style.display = tab.faviconUrl ? '' : 'none'; // 无 favicon 时不占位
  favicon.alt = '';

  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.title = '关闭标签页';
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab.id);
  });

  content.appendChild(favicon);
  content.appendChild(title);
  content.appendChild(closeBtn);
  tabElement.appendChild(colorLine);
  tabElement.appendChild(content);

  return tabElement;
}

// ==================== 统一导航入口 ====================

/**
 * 在指定 Tab 的 webview 中加载 URL（current-tab 导航的执行层，由 openUrl 调用）
 *
 * - tab 持久化存原始 URL（m3u8 时 loadUrl 是内部播放器页面地址，
 *   恢复/收藏/历史应以真实视频地址为准；did-navigate 也会回写该值）
 * - tab 存在但无 webview 时补建并显示（地址栏冷启动路径的历史行为）
 * - 导航发起后隐藏新标签页 overlay（与 switchTab 行为一致）
 *
 * @param {string} tabId - 宿主 Tab ID
 * @param {string} originalUrl - 原始 URL（用于持久化）
 * @param {string} loadUrl - 规整后的加载地址（已做 realm 转换 + m3u8 包装）
 * @returns {{action: 'navigated'|'skipped', tabId?: string}}
 */
function navigateCurrentTab(tabId, originalUrl, loadUrl) {
  const tab = state.tabs.get(tabId);
  if (!tab) return { action: 'skipped' };

  const webview = state.webviews.get(tabId);
  if (webview) {
    webview.loadURL(loadUrl);
  } else {
    // 没有 webview（tab 元数据存在但 webview 未创建）：补建并显示
    createWebviewForTab(tabId, tab.containerId, loadUrl);
    showWebview(tabId);
  }

  tab.url = originalUrl;
  window.realmAPI.updateTab(tabId, { url: originalUrl });

  // 导航已发起，隐藏新标签页（统一覆盖两个分支，与 switchTab 行为一致）
  elements.newTabPage.style.display = 'none';

  return { action: 'navigated', tabId };
}

/**
 * 统一导航入口：所有"加载一个 URL"的 renderer 侧入口最终汇聚于此
 * （地址栏、收藏栏/菜单、右键菜单、Vim hint、AI 聊天链接、OS 外部链接等）。
 * 完整入口清单见 docs/product/navigation-entry-points.md，新增入口必须收敛到此函数。
 *
 * 流水线：normalizeUrl 归一化 → 安全校验（WR-9 白名单）→ 内部 URL 豁免
 * → 分配规则匹配（realmAPI.matchRule）→ 容器决策 → disposition 分支执行。
 *
 * 容器优先级：explicitContainerId（用户显式选择）> 分配规则匹配 >
 * 来源 tab 容器（current-tab）/ 当前容器（new-tab/background-tab）。
 *
 * current-tab 语义下命中规则且目标容器 ≠ 来源 tab 容器时，改为在匹配容器
 * 新建 tab（前台切换），原 tab 保持不动——与主进程 will-navigate 的规则
 * 重定向语义一致（技术约束：当前 tab 的 webview partition 绑定来源容器，
 * 不能加载其他容器的页面）。
 *
 * @param {string} url - 目标 URL（原始输入，内部 normalizeUrl，对完整 URL 幂等）
 * @param {Object} [options]
 * @param {'current-tab'|'new-tab'|'background-tab'} [options.disposition='current-tab']
 * @param {string|null} [options.sourceTabId=null] - current-tab 语义的宿主 tab（缺省用 state.activeTabId）
 * @param {string|null} [options.explicitContainerId=null] - 用户显式指定的容器，跳过规则匹配
 * @param {boolean} [options.bypassRules=false] - 显式跳过规则（快照恢复等特殊语义入口）
 * @returns {Promise<{action:'navigated'|'created'|'skipped', tabId?:string}>}
 */
async function openUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return { action: 'skipped' };

  const {
    disposition = 'current-tab',
    sourceTabId = null,
    explicitContainerId = null,
    bypassRules = false,
  } = options;

  // 1. 归一化（对完整 URL 幂等；纯文本兜底为搜索）
  const finalUrl = normalizeUrl(url);

  // 2. 安全校验（WR-9 纵深防御）：放行 http(s)/realm/file；
  //    view-source: 仅在包裹 http(s) 内层 URL 时放行（查看页面源代码）
  const viewSourceMatch = finalUrl.match(/^view-source:(https?:\/\/.+)$/i);
  if (!/^(https?|realm|file):\/\//i.test(finalUrl) && !viewSourceMatch) {
    console.warn('[Realm] openUrl 拒绝非安全协议 URL:', finalUrl);
    return { action: 'skipped' };
  }

  // 竞态守卫：连续导航（如地址栏连续回车）只让最后一次生效
  const seq = ++state.navSeq;

  // 3+4. 分配规则匹配（显式容器/bypassRules 跳过；内部 URL 豁免省一次 IPC）
  let matchedContainer = null;
  if (!explicitContainerId && !bypassRules) {
    const isInternalUrl = finalUrl.startsWith('realm://') ||
      finalUrl.startsWith('file://') ||
      finalUrl.startsWith('view-source:') ||
      (state.realmPort && finalUrl.startsWith(`http://localhost:${state.realmPort}/`));
    if (!isInternalUrl) {
      try {
        matchedContainer = await window.realmAPI.matchRule(finalUrl);
      } catch (err) {
        console.warn('[Realm] 分配规则匹配失败，按未命中处理:', err);
      }
    }
  }

  // 过期序列号：已有更新的导航意图，丢弃本次（必须在任何 tab 状态写入之前）
  if (seq !== state.navSeq) {
    return { action: 'skipped' };
  }

  // 5. 容器决策
  const resolvedSourceTabId = sourceTabId || state.activeTabId;
  const sourceTab = resolvedSourceTabId ? state.tabs.get(resolvedSourceTabId) : null;
  const fallbackContainer = disposition === 'current-tab'
    ? (sourceTab ? sourceTab.containerId : state.currentContainer)
    : state.currentContainer;
  const containerId = explicitContainerId || matchedContainer || fallbackContainer;

  // 6. disposition 分支
  if (disposition === 'current-tab' && sourceTab && containerId === sourceTab.containerId) {
    // 在来源 tab 内导航：realm:// 转内部 HTTP + m3u8 包播放器
    const loadUrl = finalUrl.startsWith('realm://')
      ? realmUrlToHttp(finalUrl, containerId)
      : finalUrl;
    return navigateCurrentTab(resolvedSourceTabId, finalUrl, maybePlayerUrl(loadUrl, containerId));
  }

  if (disposition === 'background-tab') {
    // 后台打开：创建 Tab 但不切换焦点（createTab 默认 switchTab，需切回原 Tab）
    const currentActiveTabId = state.activeTabId;
    const newTabId = await createTab(containerId, finalUrl);
    if (currentActiveTabId && state.tabs.has(currentActiveTabId) && currentActiveTabId !== newTabId) {
      await switchTab(currentActiveTabId);
    }
    return { action: 'created', tabId: newTabId };
  }

  // new-tab（前台）：含 current-tab 但目标容器不同的情况（规则命中/显式指定）
  const newTabId = await createTab(containerId, finalUrl);
  return { action: 'created', tabId: newTabId };
}

/**
 * 创建新 Tab
 * @param {string} containerId - 容器 ID
 * @param {string|null} url - 初始 URL
 * @returns {Promise<string>} 新创建的 Tab ID
 */
async function createTab(containerId, url = null) {
  // 如果没有指定 URL，使用新标签页
  const tabUrl = url || 'realm://newtab';

  // 调用主进程创建 Tab
  const tab = await window.realmAPI.createTab(containerId, tabUrl);

  // 创建 Tab DOM 元素
  const tabElement = createTabElement(tab);

  // 添加到 Tab 列表
  elements.tabList.appendChild(tabElement);

  // 存储 Tab 数据（包含 DOM 引用）
  tab.element = tabElement;
  state.tabs.set(tab.id, tab);

  // 创建 webview（如果有 URL 或使用新标签页）
  createWebviewForTab(tab.id, containerId, tabUrl);

  // 切换到新 Tab
  await switchTab(tab.id);

  // 新建空白标签页时聚焦地址栏并全选，方便直接输入
  // 延迟聚焦，等待 switchTab 中的 focusWebviewContents IPC 完成，避免焦点被覆盖
  if (!url) {
    setTimeout(() => {
      elements.urlInput.focus();
      elements.urlInput.select();
    }, 50);
  }

  console.log(`[Realm Renderer] Tab 创建: ${tab.id} (容器: ${containerId})`);

  return tab.id;
}

/**
 * 切换到指定 Tab
 * @param {string} tabId - Tab ID
 */
async function switchTab(tabId) {
  if (tabId === state.activeTabId) return;

  // Vim 标签历史：切换前将旧 activeTabId push 到历史栈（^ 命令用）
  if (state.activeTabId && state.tabHistoryStack[state.tabHistoryStack.length - 1] !== state.activeTabId) {
    state.tabHistoryStack.push(state.activeTabId);
    if (state.tabHistoryStack.length > 50) state.tabHistoryStack.shift();
  }

  const tab = state.tabs.get(tabId);
  if (!tab) return;

  // 切换 Tab 时关闭页面内搜索框
  closeFindInPage();

  // 切换 Tab 时退出 Vim 搜索模式（搜索状态不跨 Tab 泄漏，否则 n/N 映射残留吞键）
  if (state.vimSearchActive) {
    exitVimSearch();
  }

  // 切换 Tab 时退出 Vim Hint Mode（hint 状态不跨 Tab 泄漏，否则主进程 hintModeActive 卡死吞键）
  if (state.vimHintActive) {
    exitVimHint();
  }

  // 调用主进程切换 Tab
  await window.realmAPI.switchTab(tabId);

  // 更新所有 Tab 的 active 状态
  state.tabs.forEach((t, id) => {
    if (t.element) {
      t.element.classList.toggle('active', id === tabId);
    }
  });

  // 更新活动 Tab ID
  state.activeTabId = tabId;
  tab.lastActiveAt = Date.now();

  // 更新 URL 输入框
  elements.urlInput.value = tab.url || '';

  // 切换标签时重置地址栏自动补全状态，避免旧下拉框/inline 补全残留
  state.autocomplete.query = '';
  state.autocomplete.suggestions = [];
  closeAutocomplete();

  // 更新容器指示器
  const container = state.containers.find(c => c.id === tab.containerId);
  if (container) {
    updateIndicatorIcon(container);
    elements.indicatorText.textContent = container.name;
    if (state.currentContainer !== tab.containerId) {
      state.currentContainer = tab.containerId;
      renderContainerList();
    }
  }

  // 切换 Tab 时检查收藏状态
  checkBookmarkStatus(tab.url);

  // 切换 Tab 时刷新 Cookie 快速保存按钮状态
  updateQuickSaveBtnState();

  // 切换 Tab 时关闭收藏编辑面板（防御性：showModal 通常阻塞背景使此场景不可达，
  // 但 ESC/程序化关闭边缘场景下仍可能残留 open 状态）
  hideBookmarkEditPanel();

  // 切换 webview 可见性
  showWebview(tabId);

  // 报告当前活动 webview 的 contentsId 给主进程（用于快捷键路由 DevTools）
  const activeWebview = state.webviews.get(tabId);
  if (activeWebview && typeof activeWebview.getWebContentsId === 'function') {
    window.realmAPI.setActiveWebview(activeWebview.getWebContentsId());
  }

  // 切换标签后强制将焦点转移到新 webview，避免键盘输入被旧 webview guest 截获。
  // DOM focus() 无法跨 guest 转移键盘焦点（见 docs/debug/vim-hint-focus-cross-tab-failure.md），
  // 必须同时走主进程 WebContents.focus() 路径
  if (activeWebview) {
    activeWebview.focus();
    try {
      window.realmAPI.focusWebviewContents(activeWebview.getWebContentsId());
    } catch { /* webview 过渡态时 getWebContentsId 会抛，忽略 */ }
  }

  // 隐藏内嵌新标签页（现在使用 realm://newtab 加载新标签页）
  elements.newTabPage.style.display = 'none';

  // 滚动 Tab 到可见区域
  if (tab.element) {
    tab.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
  // 刷新滚动按钮显隐（切换后溢出状态可能变化，如滚回最左后左按钮应隐藏）
  updateTabScrollState();

  // 切换 Tab 时刷新媒体列表（按 webview 级别隔离）
  loadMediaList();

  // 切换 Tab 时更新窗口标题
  updateWindowTitle();
}

/**
 * 更新窗口标题栏显示
 * 格式：容器名 - 页面标题（默认容器只显示页面标题）
 */
function updateWindowTitle() {
  const tab = state.tabs.get(state.activeTabId);
  if (!tab) {
    document.title = 'Realm';
    return;
  }

  const container = state.containers.find(c => c.id === tab.containerId);
  const pageTitle = tab.title || '新标签页';

  // 默认容器（id='default' 或 name='默认'）只显示页面标题
  if (!container || container.id === 'default' || container.name === '默认') {
    document.title = pageTitle;
  } else {
    document.title = `${container.name} - ${pageTitle}`;
  }
}

/**
 * 关闭 Tab
 * @param {string} tabId - Tab ID
 */
async function closedTabsStackPush(tab) {
  if (!tab) return;
  const info = { containerId: tab.containerId, url: tab.url || '', title: tab.title || '' };
  closedTabsStack.push(info);
  if (closedTabsStack.length > 10) closedTabsStack.shift();
  try {
    window.realmAPI.notifyClosedTab(info);
  } catch (err) {
    console.error('[Realm Renderer] notifyClosedTab 失败:', err);
  }
}

/**
 * 关闭 Tab
 * @param {string} tabId - Tab ID
 */
async function closeTab(tabId) {
  const tab = state.tabs.get(tabId);
  if (!tab) return;

  // 保存已关闭标签信息（用于"重新打开已关闭标签页"）
  closedTabsStackPush(tab);

  // 调用主进程关闭 Tab
  const result = await window.realmAPI.closeTab(tabId);

  // 从 DOM 移除
  if (tab.element) {
    tab.element.remove();
  }

  // 从 state 删除
  state.tabs.delete(tabId);

  // 刷新滚动按钮显隐：关闭后内容缩短可能消除溢出，此时无 scroll 事件需要显式刷新
  updateTabScrollState();

  // 关闭 Tab 时清空该 tab 对应 webview 的媒体列表（per D-16）
  const tabWebview = state.webviews.get(tabId);
  if (tabWebview) {
    let closedWebContentsId;
    try {
      closedWebContentsId = tabWebview.getWebContentsId();
    } catch (err) {
      console.warn('[Realm Renderer] 关闭 Tab 时无法获取 webview webContentsId:', err.message);
    }
    if (closedWebContentsId) {
      window.mediaAPI.clearMediaList(closedWebContentsId);
    }
  }

  // 销毁关联的 webview（用户关 tab：键盘/右键/批量关闭全部汇入 closeTab，
  // G-44-2 走延迟销毁，给在途键盘 ACK 留出送达时间）
  destroyWebview(tabId, { deferred: true });

  // 如果关闭的是活动 Tab，切换到新的活动 Tab
  if (tabId === state.activeTabId) {
    // 关闭页面内搜索框
    closeFindInPage();

    // 退出 Vim 搜索模式（webview 已销毁，主进程侧标志必须清除）
    if (state.vimSearchActive) {
      exitVimSearch();
    }

    // 退出 Vim Hint Mode（webview 已销毁，主进程侧 hintModeActive 必须清除）
    if (state.vimHintActive) {
      exitVimHint();
    }

    if (result.newActiveTabId) {
      await switchTab(result.newActiveTabId);
    } else if (result.windowClosed) {
      // 多窗口场景：本窗口最后一个 Tab 已关闭，主进程正在销毁本窗口，
      // 无需创建新 Tab（窗口随即销毁，此处状态已无意义）
    } else {
      // 没有 Tab 了，创建新 Tab
      state.activeTabId = null;
      elements.urlInput.value = '';
      createTab(state.currentContainer);
    }
  }

  console.log(`[Realm Renderer] Tab 关闭: ${tabId}`);
}

/**
 * 处理主进程推送的 Tab 回收事件（WR-4）
 * 主进程 createTab 达到上限时自动回收最久未使用的 Tab，
 * 渲染进程需同步移除对应 Tab DOM / webview / 本地状态并提示，避免幽灵 Tab。
 * @param {{tabId: string, message?: string}} data - 回收事件数据
 */
function handleTabRecycled(data) {
  if (!data || typeof data.tabId !== 'string') return;

  const tab = state.tabs.get(data.tabId);
  if (tab) {
    if (tab.element) {
      tab.element.remove();
    }
    state.tabs.delete(data.tabId);
  }
  // G-44-2 判定：主进程达到回收上限的程序化静默回收（非用户交互瞬间，
  // 被回收的一定是非活动 Tab），无键盘 ACK 在途窗口，保持同步销毁
  destroyWebview(data.tabId);

  // 被回收的一定是非活动 Tab（主进程回收逻辑排除活动 Tab），无需切换 activeTabId
  showToast(data.message || '已自动关闭最久未使用的标签页以释放资源', 'success');
}

/**
 * 处理 AI 工具发起的关闭标签页请求（tab:ai-close）
 * 主进程 close_tab / close_tabs 工具向标签页所属窗口推送此事件。
 * 支持三种载荷：
 * - { tabId }：关闭单个标签页
 * - { tabIds: [...] }：批量关闭显式列表（主进程已按窗口分组）
 * - { action: 'others'|'left'|'right', tabId }：锚点式批量关闭，
 *   复用右键菜单同款切分逻辑（窗口内顺序权威在渲染端 state.tabs）
 * 均复用完整 closeTab 生命周期（入已关闭栈、清媒体列表、销毁 webview、切换活动 tab）
 * @param {{tabId?: string, tabIds?: string[], action?: string}} data - 关闭请求数据
 */
function handleAiCloseTab(data) {
  if (!data) return;

  // 批量显式列表：逐个关闭（与右键菜单 close-other-tabs 的 forEach 一致）
  if (Array.isArray(data.tabIds)) {
    data.tabIds.forEach(id => {
      if (typeof id === 'string') closeTab(id);
    });
    return;
  }

  if (typeof data.tabId !== 'string') return;

  // 锚点式批量关闭：映射到右键菜单处理器的对应 case
  if (data.action && data.action !== 'list') {
    const channelMap = {
      others: 'context-menu:close-other-tabs',
      left: 'context-menu:close-left-tabs',
      right: 'context-menu:close-right-tabs',
    };
    const channel = channelMap[data.action];
    if (channel) {
      handleContextMenuAction(channel, { tabId: data.tabId });
      return;
    }
  }

  closeTab(data.tabId);
}

/**
 * 处理 AI 工具发起的切换标签页请求（tab:ai-switch）
 * 主进程 switch_tab 工具向标签页所属窗口推送此事件，
 * 复用完整 switchTab 链路（webview 显隐、Vim 状态清理、容器指示器跟随、
 * tab:switch 回同步主进程权威活动表）
 * @param {{tabId: string}} data - 切换请求数据
 */
function handleAiSwitchTab(data) {
  if (!data || typeof data.tabId !== 'string') return;
  switchTab(data.tabId);
}

/**
 * 获取容器颜色
 * @param {string} containerId - 容器 ID
 * @returns {string} 颜色值
 */
function getContainerColor(containerId) {
  const container = state.containers.find(c => c.id === containerId);
  return container ? container.color : '#6B7280';
}

/**
 * 页面无 <title> 时的标题回退：把当前 URL 格式化成展示文本。
 * 对齐 Chromium GetTitleForDisplay / FormatUrl 行为：
 * - http/https：省略协议、www 前缀、默认端口（80/443）、裸域名尾斜杠、认证信息
 * - file：只显示文件名（忽略查询/锚点参数）
 * - 其余 scheme（realm://、about:、data: 等）返回空串，由调用方决定是否保留原标题
 * @param {string} url - 当前页面 URL
 * @returns {string} 格式化后的展示文本，无法格式化时返回空串
 */
function formatUrlForDisplay(url) {
  if (!url) return '';

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return '';
  }
  const { protocol, hostname, port, pathname, search, hash } = parsed;

  // file:// 用文件名作为标题，忽略参考和查询参数
  if (protocol === 'file:') {
    const parts = pathname.split('#')[0].split('?')[0].split('/');
    return parts[parts.length - 1] || '';
  }

  // 仅 http/https 走 URL 展示；其余 scheme 返回空串
  if (protocol !== 'http:' && protocol !== 'https:') return '';

  // 省略 www. 等平凡子域名
  let host = hostname;
  if (host.startsWith('www.')) host = host.slice(4);

  // 省略默认端口
  const isDefaultPort =
    (protocol === 'http:' && port === '80') ||
    (protocol === 'https:' && port === '443');
  const portText = port && !isDefaultPort ? `:${port}` : '';

  // 裸域名省略尾斜杠
  const pathText = pathname === '/' || pathname === '' ? '' : pathname;

  return `${host}${portText}${pathText}${search}${hash}`.replace(/%20/g, ' ');
}

/**
 * 更新 Tab 标题
 * @param {string} tabId - Tab ID
 * @param {string} title - 新标题
 */
async function updateTabTitle(tabId, title) {
  const tab = state.tabs.get(tabId);
  if (!tab) return;

  // title 为空时忽略，保留现有标题（'新标签页' 或之前的标题），避免被空白覆盖
  if (!title) return;

  // 调用主进程更新 Tab
  await window.realmAPI.updateTab(tabId, { title });

  tab.title = title;

  // 更新 DOM
  if (tab.element) {
    const titleElement = tab.element.querySelector('.tab-title');
    if (titleElement) {
      titleElement.textContent = title;
      titleElement.title = title; // 悬停显示完整标题
    }
  }
}

/**
 * 为 Tab 创建 webview
 * @param {string} tabId - Tab ID
 * @param {string} containerId - 容器 ID
 * @param {string} url - 初始 URL
 * @returns {HTMLElement} 创建的 webview 元素
 */
function createWebviewForTab(tabId, containerId, url) {
  // URL scheme 白名单（WR-9）：仅 http(s)、realm://、file:// 允许写入 webview src。
  // file:// 为用户在地址栏显式输入的本地文件访问（本地 HTML 等），予以放行；
  // data: 等可注入脚本的 scheme 仍拦截；
  // 空 URL（新标签页）与 about:blank 放行。
  // view-source: 仅在包裹 http(s) 内层 URL 时放行（查看页面源代码场景）。
  const isViewSourceHttp = url && /^view-source:https?:\/\//i.test(url);
  if (url && url !== 'about:blank' && !/^https?:\/\//i.test(url) && !/^realm:\/\//i.test(url) && !/^file:\/\//i.test(url) && !isViewSourceHttp) {
    console.warn('[Realm] 拒绝非 http(s)/realm URL:', url);
    return null;
  }

  // realm:// URL 转换为 http://localhost:PORT/ URL（webview 无法加载自定义协议）
  if (url && url.startsWith('realm://')) {
    url = realmUrlToHttp(url, containerId);
  }

  // m3u8 视频文件在当前 webview tab 内用播放器页面播放
  url = maybePlayerUrl(url, containerId);

  const webview = document.createElement('webview');

  // 设置 partition（容器隔离，D-01）
  // 必须在 src 之前设置，否则 webview 可能使用默认 session 而非指定的持久化 partition
  webview.partition = `persist:container-${containerId}`;

  // 设置 src
  webview.src = url || 'about:blank';

  // 应用安全配置（D-03）：仅设置字符串型属性 webpreferences（CR-1）
  webview.setAttribute('webpreferences', WEBVIEW_WEBPREFERENCES);

  // 设置 webview guest preload 脚本（媒体检测桥接）
  // 渲染进程与 sandbox preload 均无 __dirname；index.html 与 webview-preload.js
  // 同目录（src/），直接用 location 推导 file:// URL（asar 内外均适用）
  webview.setAttribute('preload', new URL('webview-preload.js', window.location.href).href);

  // 允许 webview 打开新窗口（target="_blank" 链接）
  webview.setAttribute('allowpopups', '');

  // 设置样式
  webview.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    visibility: hidden;
  `;

  // 插入到 browser-view 容器
  elements.browserView.appendChild(webview);

  // 存储 webview 引用
  state.webviews.set(tabId, webview);

  // 绑定 webview 事件
  bindWebviewEvents(tabId, webview);

  return webview;
}

// ==================== 跨窗口 Tab 事件处理（Phase 36 Plan 03） ====================

/**
 * 处理主进程推送的 tab:created 事件
 *
 * 跨窗口 Tab 移动或新窗口创建时，主进程在目标窗口调用此函数。
 * 创建 Tab DOM 元素和 webview，并切换到该 Tab。
 *
 * @param {Object} data - { tab } Tab 数据对象
 */
function handleTabCreatedFromMain(data) {
  if (!data || !data.tab) return;
  const tab = data.tab;

  // 避免重复创建（如果 Tab 已存在于本窗口）
  if (state.tabs.has(tab.id)) return;

  console.log(`[Realm Renderer] 收到跨窗口 Tab 创建: ${tab.id} (容器: ${tab.containerId})`);

  // 创建 Tab DOM 元素
  const tabElement = createTabElement(tab);

  // 添加到 Tab 列表
  elements.tabList.appendChild(tabElement);

  // 存储 Tab 数据
  tab.element = tabElement;
  state.tabs.set(tab.id, tab);

  // 创建 webview
  if (tab.url) {
    createWebviewForTab(tab.id, tab.containerId, tab.url);
  }

  // 切换到新 Tab
  switchTab(tab.id);
}

/**
 * 处理主进程推送的 tab:removed 事件
 *
 * 跨窗口 Tab 移动时，主进程通知源窗口移除指定 Tab。
 * 清理 Tab DOM 元素、webview 和状态。
 *
 * @param {Object} data - { tabId } 被移除的 Tab ID
 */
function handleTabRemovedFromMain(data) {
  if (!data || !data.tabId) return;
  const { tabId } = data;

  console.log(`[Realm Renderer] 收到跨窗口 Tab 移除: ${tabId}`);

  const tabData = state.tabs.get(tabId);
  if (!tabData) return;

  // 移除 Tab DOM
  if (tabData.element) tabData.element.remove();

  // 移除 webview
  // G-44-2 判定：跨窗口移动语境——tab 即将转移到目标窗口重建，非用户关闭
  // 销毁，无键盘 ACK 在途窗口，保持同步移除
  const webview = state.webviews.get(tabId);
  if (webview) webview.remove();
  state.webviews.delete(tabId);

  // 从 state 中移除
  state.tabs.delete(tabId);

  // 如果移除的是活动 Tab，切换到相邻 Tab
  if (state.activeTabId === tabId) {
    const remaining = Array.from(state.tabs.keys());
    if (remaining.length > 0) {
      switchTab(remaining[0]);
    } else {
      // 没有 Tab 了，创建新 Tab
      createTab(state.currentContainer);
    }
  }
}

/**
 * 绑定 webview 事件
 * @param {string} tabId - Tab ID
 * @param {HTMLElement} webview - webview 元素
 */
function bindWebviewEvents(tabId, webview) {
  // 上报 guest webContentsId → 容器 映射（主进程无法从 guest session 反推
  // partition，Electron 32 限制；分配规则匹配和 CDP 抓取依赖此映射）
  // did-attach 在首次导航前触发，保证主进程首次 did-start-navigation 即可反查；
  // dom-ready 作为兜底（重复注册幂等，Map.set 覆盖同值）
  const registerGuest = () => {
    // 恢复 tab 时 webview 可能处于过渡态，getWebContentsId 会抛
    // "must be attached to the DOM" —— 忽略本次，dom-ready 会兜底重试
    let guestId;
    try {
      guestId = webview.getWebContentsId();
    } catch {
      return;
    }
    const partition = webview.partition || '';
    const prefix = 'persist:container-';
    if (guestId && partition.startsWith(prefix)) {
      window.realmAPI.registerGuestContainer(guestId, partition.slice(prefix.length));
    }
  };
  webview.addEventListener('did-attach', registerGuest);
  webview.addEventListener('dom-ready', registerGuest);

  // ==================== 媒体嗅探：dom-ready 注入检测脚本 ====================
  webview.addEventListener('dom-ready', async () => {
    // 功能开关检查（per D-10）：关闭时跳过注入
    try {
      const settings = await window.realmAPI.getSettings();
      if (!settings.mediaPlayer || !settings.mediaPlayer.enabled) return;
      // 白名单检查（per G-29-12）：非白名单站点跳过注入
      const whitelist = settings.mediaPlayer.whitelist || [];
      const pageUrl = webview.getURL() || webview.src || '';
      if (!isPageWhitelisted(pageUrl, whitelist)) return;
    } catch (err) {
      console.warn('[Realm Renderer] 检查多媒体开关状态失败，跳过注入:', err.message);
      return;
    }

    // 注入视频检测脚本（per D-03/D-04/SNIFF-02/SNIFF-03）
    const mediaSnifferScript = `
(function() {
  // 防止重复注入（per Pitfall 3：dom-ready 可能多次触发）
  if (window.__realmMediaSniffer) return;
  window.__realmMediaSniffer = true;

  /**
   * 从 URL 推断视频类型
   * @param {string} url - 媒体 URL
   * @returns {string} 视频类型
   */
  function classifyUrl(url) {
    if (!url) return 'unknown';
    var lower = url.toLowerCase().split('?')[0].split('#')[0];
    if (lower.endsWith('.m3u8')) return 'm3u8';
    if (lower.endsWith('.mp4')) return 'mp4';
    if (lower.endsWith('.flv')) return 'flv';
    if (lower.endsWith('.webm')) return 'webm';
    return 'unknown';
  }

  /**
   * 读取页面 og:image（video 无 poster 时的缩略图兜底，页面级语义）
   * @returns {string} og:image URL，无则空串
   */
  function getOgImage() {
    var meta = document.querySelector('meta[property="og:image"]')
      || document.querySelector('meta[name="og:image"]');
    return (meta && meta.content) || '';
  }

  /**
   * 从视频/源元素提取媒体信息（含标题/时长/缩略图）
   * @param {Element} el - video 或 source 元素
   * @param {string} source - 检测来源（script/dom）
   * @returns {Object|null} 媒体信息对象，无有效 URL 时返回 null
   */
  function extractVideoInfo(el, source) {
    var url = el.src || el.currentSrc;
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
    // MSE 站点 duration 常为 NaN/Infinity，须过滤
    var duration = (typeof el.duration === 'number' && isFinite(el.duration) && el.duration > 0)
      ? Math.round(el.duration) : 0;
    return {
      url: url,
      type: classifyUrl(url),
      source: source,
      title: el.title || document.title || '',
      duration: duration,
      // 只取元素自身 poster；og:image 走页面级通道（sendMediaPageInfo），
      // 由主进程打 thumbnailFromPage 标记，保证 SPA 导航后可被更新
      thumbnail: el.poster || ''
    };
  }

  /**
   * 扫描现有视频元素（per SNIFF-02）
   * @returns {Array<Object>} 检测到的视频数组
   */
  function scanExistingVideos() {
    var results = [];
    document.querySelectorAll('video, source').forEach(function(el) {
      var info = extractVideoInfo(el, 'script');
      if (info) results.push(info);
    });
    return results;
  }

  // 初始扫描
  var initialVideos = scanExistingVideos();
  if (initialVideos.length > 0 && window.__realmBridge) {
    window.__realmBridge.sendMediaDetected(initialVideos);
  }

  // 页面级 og:image 上报（无论有无 video 元素）：
  // MSE/直播站点的 video src 为 blob 被过滤，extractVideoInfo 的 og:image
  // 兜底永远走不到，须页面级通道让主进程给网络拦截条目补缩略图
  var lastOgImage = getOgImage();
  if (lastOgImage && window.__realmBridge && window.__realmBridge.sendMediaPageInfo) {
    window.__realmBridge.sendMediaPageInfo({ thumbnail: lastOgImage });
  }

  // og:image 变更监听：SPA 站内导航（如 Twitch 切频道）不刷新页面、
  // 脚本不重跑，meta og:image 由站点 JS 异步更新，须监听 head 变化重报
  var ogObserver = new MutationObserver(function() {
    var og = getOgImage();
    if (og && og !== lastOgImage) {
      lastOgImage = og;
      if (window.__realmBridge && window.__realmBridge.sendMediaPageInfo) {
        window.__realmBridge.sendMediaPageInfo({ thumbnail: og });
      }
    }
  });
  if (document.head) {
    ogObserver.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content']
    });
  }

  // metadata 就绪后重报：初始扫描时 duration 常为 NaN（metadata 未加载），
  // 须等 loadedmetadata/durationchange 补采；元素级记录上次值，不变不重报。
  // 直播 MSE 的 src 为 blob:，在 extractVideoInfo 内被过滤，不产生 IPC。
  var lastReportedDuration = new WeakMap();
  function onMetadataReady(e) {
    var el = e.target;
    if (!el || el.tagName !== 'VIDEO') return;
    var d = (typeof el.duration === 'number' && isFinite(el.duration) && el.duration > 0)
      ? Math.round(el.duration) : 0;
    if (!d || lastReportedDuration.get(el) === d) return;
    lastReportedDuration.set(el, d);
    var info = extractVideoInfo(el, 'dom');
    if (info && window.__realmBridge) {
      window.__realmBridge.sendMediaDetected([info]);
    }
  }
  document.addEventListener('loadedmetadata', onMetadataReady, true);
  document.addEventListener('durationchange', onMetadataReady, true);

  // MutationObserver 监听动态加载的视频元素（per D-04/SNIFF-03）
  var observer = new MutationObserver(function(mutations) {
    var newVideos = [];
    mutations.forEach(function(mutation) {
      // 新增节点
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          if (node.tagName === 'VIDEO' || node.tagName === 'SOURCE') {
            var info = extractVideoInfo(node, 'dom');
            if (info) newVideos.push(info);
          }
          // 检查子元素中的视频
          if (node.querySelectorAll) {
            node.querySelectorAll('video, source').forEach(function(el) {
              var info = extractVideoInfo(el, 'dom');
              if (info) newVideos.push(info);
            });
          }
        }
      });
      // 属性变化（src/currentSrc 改变）
      if (mutation.type === 'attributes' &&
          (mutation.target.tagName === 'VIDEO' || mutation.target.tagName === 'SOURCE')) {
        var info = extractVideoInfo(mutation.target, 'dom');
        if (info) newVideos.push(info);
      }
    });
    if (newVideos.length > 0 && window.__realmBridge) {
      window.__realmBridge.sendMediaDetected(newVideos);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'currentSrc']
  });
})()`;
    webview.executeJavaScript(mediaSnifferScript).catch(() => {});
  });

  // ==================== Vim 焦点状态监听 ====================
  initVimFocusListener(webview);

  // ==================== 媒体嗅探 + 凭据检测：ipc-message 监听 ====================
  webview.addEventListener('ipc-message', (e) => {
    if (e.channel === 'media:detected') {
      // 从 webview 获取 webContentsId 用于按标签页隔离存储
      let webContentsId;
      try {
        webContentsId = webview.getWebContentsId();
      } catch (err) {
        console.warn('[Realm Renderer] 无法获取 webview webContentsId:', err.message);
        return;
      }
      // 转发到主进程 MediaSniffer
      window.mediaAPI.reportMediaDetected(webContentsId, e.args[0]);
    } else if (e.channel === 'media:page-info') {
      // 页面级媒体信息（og:image），供主进程给网络拦截条目补缩略图
      let webContentsId;
      try {
        webContentsId = webview.getWebContentsId();
      } catch (err) {
        return;
      }
      window.mediaAPI.reportMediaPageInfo(webContentsId, e.args[0]);
    } else if (e.channel === 'media:outside-click') {
      if (state.mediaPanelOpen) toggleMediaPanel();
      if (state.downloadPanelOpen) handleDownloadOutsideClick();
    } else if (e.channel === 'credential:form-submitted') {
      // 表单提交：检查是否需要显示保存凭据横幅
      handleCredentialFormSubmitted(e.args[0]);
    } else if (e.channel === 'credential:autofill-request') {
      // 自动填充请求：查询凭据并发送到 webview
      handleAutofillRequest(webview);
    } else if (e.channel === 'address:form-detected') {
      // 地址表单检测：显示保存地址横幅
      handleAddressFormDetected(e.args[0]);
    } else if (e.channel === 'address:autofill-request') {
      // 地址自动填充请求：查询地址并发送到 webview
      handleAddressAutofillRequest(webview);
    }
  });

  // 页面导航事件
  webview.addEventListener('did-navigate', (e) => {
    // 跨页导航会销毁 guest 注入的搜索栏 DOM，退出 Vim 搜索模式防状态泄漏
    if (tabId === state.activeTabId && state.vimSearchActive) {
      exitVimSearch();
    }

    // 跨页导航同时销毁 guest 注入的 hint overlay，退出 Hint Mode 防 hintModeActive 卡死
    if (tabId === state.activeTabId && state.vimHintActive) {
      exitVimHint();
    }

    const tab = state.tabs.get(tabId);
    if (tab) {
      // 内部页面 URL 转换回 realm:// 格式（用于存储和地址栏显示）
      const displayUrl = httpUrlToRealm(e.url);
      tab.url = displayUrl;
      // 回写主进程持久化（WR-3）：否则重启后 restoreTabs 恢复到过期地址
      window.realmAPI.updateTab(tabId, { url: displayUrl });

      // 导航时清空旧 favicon（Chrome 风格）：避免跨站点残留旧图标，等新 favicon 经 page-favicon-updated 到达再填充
      if (tab.faviconUrl) {
        tab.faviconUrl = null;
        const faviconImg = tab.element && tab.element.querySelector('.tab-favicon');
        if (faviconImg) {
          faviconImg.style.display = 'none';
          faviconImg.src = '';
        }
        window.realmAPI.updateTab(tabId, { faviconUrl: null });
      }
      // 如果是活动 Tab，更新 URL 输入框
      if (tabId === state.activeTabId) {
        elements.urlInput.value = displayUrl;
      }

      // 导航完成后检查收藏状态
      if (tabId === state.activeTabId) {
        checkBookmarkStatus(displayUrl);
        updateQuickSaveBtnState();
      }

      // 从 webview partition 推导该 tab 所属容器（历史记录与媒体清理共用）
      const navPartition = webview.partition || '';
      const navPrefix = 'persist:container-';
      const navContainerId = navPartition.startsWith(navPrefix)
        ? navPartition.slice(navPrefix.length)
        : state.currentContainer;

      // 页面无 <title> 时回退显示 URL（对齐 Chromium GetTitleForDisplay）：
      // page-title-updated 对始终无 title 的页面不会触发（Chromium 检测到 title 无变化会跳过），
      // 因此必须在导航提交时兜底设置标题。
      const navTitle = webview.getTitle() || formatUrlForDisplay(e.url);

      // D-21/D-23：导航完成后自动写入历史记录（过滤内部页面）
      if (e.url && e.url !== 'about:blank' && !displayUrl.startsWith('realm://')) {
        window.realmAPI.historyAdd({
          containerId: navContainerId,
          url: e.url,
          title: navTitle,
          visitedAt: Date.now(),
        }).catch(err => console.error('[Realm] 历史记录写入失败:', err));
      }

      // 无 title 页面用 URL 作为标签页标题
      if (navTitle) {
        updateTabTitle(tabId, navTitle);
        if (tabId === state.activeTabId) {
          updateWindowTitle();
        }
      }

      // 导航时清空该 tab 对应 webview 的媒体列表（per D-13/D-14：跨页面导航清空，锚点跳转不清空）
      // did-navigate 仅在跨页面导航时触发，did-navigate-in-page 处理锚点跳转
      let navWebContentsId;
      try {
        navWebContentsId = webview.getWebContentsId();
      } catch (err) {
        console.warn('[Realm Renderer] 导航时无法获取 webview webContentsId:', err.message);
      }
      if (navWebContentsId) {
        window.mediaAPI.clearMediaList(navWebContentsId);
      }
    }
  });

  webview.addEventListener('did-navigate-in-page', (e) => {
    // SPA 跳转（pushState 不触发 guest 的 popstate/hashchange）：旧 hint 全部失效，退出 Hint Mode
    if (tabId === state.activeTabId && state.vimHintActive) {
      exitVimHint(webview);
    }

    const tab = state.tabs.get(tabId);
    if (tab) {
      const previousUrl = tab.url;
      const displayUrl = httpUrlToRealm(e.url);
      tab.url = displayUrl;
      // 回写主进程持久化（WR-3），与 did-navigate 同理
      window.realmAPI.updateTab(tabId, { url: displayUrl });

      // SPA 路径变化（如 Twitch 切频道）：旧页面 og:image 缓存对新页面无效，
      // 清空 pageInfoMap——新页面条目先无封面，待新 og:image 上报后回填；
      // 旧页面残留条目由 pageUrl 隔离保护，封面不受影响。
      // 纯 hash/query 变化（锚点、参数）不清，页面内容未实质切换
      try {
        if (new URL(previousUrl).pathname !== new URL(e.url).pathname) {
          const navWebContentsId = webview.getWebContentsId();
          window.mediaAPI.clearMediaPageInfo(navWebContentsId);
        }
      } catch { /* URL 解析失败时不清，保守处理 */ }

      if (tabId === state.activeTabId) {
        elements.urlInput.value = displayUrl;
        // 仅域名变化时刷新快速保存按钮（同域 hash/参数变化无需重新比较）
        if (getUrlHostname(previousUrl) !== getUrlHostname(displayUrl)) {
          updateQuickSaveBtnState();
        }
      }

      // SPA 内跳转（hash/query）：页面无 title 时同步更新 URL 回退标题
      const inPageTitle = webview.getTitle() || formatUrlForDisplay(e.url);
      if (inPageTitle) {
        updateTabTitle(tabId, inPageTitle);
        if (tabId === state.activeTabId) {
          updateWindowTitle();
        }
      }
    }
  });

  // 加载状态事件
  webview.addEventListener('did-start-loading', () => {
    if (tabId === state.activeTabId) {
      elements.loadingBar.classList.add('active');
      elements.loadingBar.classList.remove('complete');
      elements.reloadBtn.classList.add('loading');
    }
  });

  webview.addEventListener('did-stop-loading', () => {
    if (tabId === state.activeTabId) {
      elements.loadingBar.classList.remove('active');
      elements.loadingBar.classList.add('complete');
      elements.reloadBtn.classList.remove('loading');
      // 更新前进/后退按钮状态
      updateNavigationButtons();
    }
  });

  // 标题更新事件
  webview.addEventListener('page-title-updated', (e) => {
    // 页面未设置 <title> 时回退显示格式化后的 URL（对齐 Chromium GetTitleForDisplay）
    const title = e.title || formatUrlForDisplay(webview.getURL());

    if (title) {
      updateTabTitle(tabId, title);

      // 如果是当前活动 Tab，更新窗口标题
      if (tabId === state.activeTabId) {
        updateWindowTitle();
      }
    }

    // 更新历史记录中最近一条匹配记录的标题
    if (title) {
      const partition = webview.partition || '';
      const prefix = 'persist:container-';
      const historyContainerId = partition.startsWith(prefix)
        ? partition.slice(prefix.length)
        : state.currentContainer;

      const currentUrl = webview.getURL();
      if (currentUrl && !currentUrl.startsWith('realm://')) {
        window.realmAPI.historyUpdateTitle({
          containerId: historyContainerId,
          url: currentUrl,
          title,
        }).catch(err => console.error('[Realm] 历史记录标题更新失败:', err));
      }
    }
  });

  // favicon 更新事件：同步 tab state、DOM img.src 并持久化
  webview.addEventListener('page-favicon-updated', (e) => {
    const faviconUrl = e.favicons && e.favicons[0];
    if (!faviconUrl) return;

    const tab = state.tabs.get(tabId);
    if (!tab) return;

    tab.faviconUrl = faviconUrl;

    // 同步 DOM 中的 favicon img（无 img 时跳过，下次重建由 createTabElement 兜底）
    const faviconImg = tab.element && tab.element.querySelector('.tab-favicon');
    if (faviconImg) {
      faviconImg.src = faviconUrl;
      faviconImg.style.display = '';
    }

    // 持久化（tab-manager updateTab 白名单含 faviconUrl）
    window.realmAPI.updateTab(tabId, { faviconUrl });

    // 若该页已收藏且无图标，回写真实 favicon（主进程抓取转 data URL）
    maybeBackfillBookmarkFavicon(tab, faviconUrl);
  });

  // 注意：webview 标签的 will-navigate 事件文档明示 preventDefault 无效（WR-2），
  // 分配规则重定向已移至主进程 webContents 的 will-navigate（可同步取消），
  // 命中规则时经 open-url-in-tab 事件转交 handleOpenUrlInTab 在匹配容器新建 Tab。

  // 注意：webview 的 new-window 事件在 Electron 32 已移除（WR-1）。
  // guest 的 window.open / target=_blank 由主进程 setWindowOpenHandler 拦截，
  // 经 open-url-in-tab 事件转交 handleOpenUrlInTab 在对应容器新建 Tab（D-09）。

  // 网页右键菜单事件
  webview.addEventListener('context-menu', (e) => {
    const params = e.params || e.detail || {};
    // 图片与链接是两个可同时成立的维度：`<a><img></a>` 上右键时
    // mediaType='image' 且 linkURL 有值，必须同时给出图片组与链接组
    // （旧实现按 isImage 优先单值分类，会丢掉链接组）
    const hasImage = params.mediaType === 'image' || params.hasImageContents;
    const hasLink = !!params.linkURL;
    window.realmAPI.showWebContextMenu({
      hasImage,
      hasLink,
      linkURL: params.linkURL || '',
      srcURL: params.srcURL || '',
      mediaType: params.mediaType || 'none',
      selectionText: params.selectionText || '',
      canGoBack: webview.canGoBack(),
      canGoForward: webview.canGoForward(),
      isLoading: webview.isLoading(),
      editFlags: params.editFlags || {},
      pageURL: webview.getURL(),
      pageTitle: webview.getTitle() || '',
    });
  });

  // 加载失败事件
  webview.addEventListener('did-fail-load', (e) => {
    console.error(`[Realm] 页面加载失败: ${e.errorCode} - ${e.errorDescription}`);
  });

  // 绑定页面内搜索结果监听
  bindFindInPageEvents(webview);
}

// ==================== webview 可命中性（拖拽/改宽期间临时禁用） ====================

/**
 * 「所有 webview 的鼠标命中被临时关闭」的登记状态。
 *
 * 为什么必须收敛到一处：拖拽/改宽期间把 webview 的 pointer-events 置 none 是
 * 防止 guest 吞掉 mousemove 的必要手段（否则拖几像素就断流、浮动预览卡在页面上），
 * 但这个状态**不改变可见性**——一旦收尾没跑到（mouseup 丢在窗口外 / 中途窗口失焦 /
 * 面板被关闭），页面就变成「看得见、链接和输入框全点不动、宿主 UI 正常、刷新页面
 * 无效」，只有重启能解。此前三处各写各的、恢复只挂各自 mouseup，正是残留的来源。
 * 详见 docs/debug/webview-hit-test-stuck.md。
 *
 * @type {{active: boolean, reason: string, since: number, timer: NodeJS.Timeout|null}}
 */
const webviewHitTestSuspend = { active: false, reason: '', since: 0, timer: null };

/** 最近一次「观察到鼠标键按下」的时间戳；用于判定 suspend 是否已成为残留 */
let lastPointerPressedAt = 0;

/**
 * 残留判定：看门狗复查间隔（毫秒）
 *
 * 语义 = 「连续 3 秒都没能确认按键仍按着（证据见 EVIDENCE_MS）⇒ 判定收尾事件已丢失」。
 * 正常拖拽期间指针只要动一下就会刷新证据，因此只有两类情形会被恢复：
 * ① 松手事件丢了（要救，这正是本机制的目标）；② 指针按住不动超过该时长（此时按下的
 * 指针也不会产生错位，恢复最快只是让改宽短暂卡顿一下，可接受）。
 */
const WEBVIEW_SUSPEND_WATCHDOG_MS = 3000;

/**
 * 残留判定：「按键仍按着」的证据有效期（毫秒）
 *
 * 必须明显短于复查间隔：两者相等时看门狗每次复查都会算「证据刚过期/还没过期」而
 * 反复重排，残留永远救不回来（判决也不确定）。
 */
const WEBVIEW_SUSPEND_EVIDENCE_MS = 1000;

/**
 * 按 state.visibleTabId 重算所有 webview 的可见性与鼠标可命中性（唯一实现）
 *
 * 这是「网页区能不能被鼠标点到」的唯一写入点：showWebview 与拖拽/改宽收尾都走它。
 * 此前 restoreWebviewPointerEvents 自行按 activeTabId 写 pointer-events，与可见性
 * 各用一套真源，是残留的第二个入口（activeTabId 与显示不一致时会把可见页面打成
 * 不可命中）。
 */
function applyWebviewInteractivity() {
  const visibleId = state.visibleTabId;
  state.webviews.forEach((wv, id) => {
    if (!wv) return;
    wv.style.visibility = id === visibleId ? 'visible' : 'hidden';
    wv.style.position = id === visibleId ? 'relative' : 'absolute';
    wv.style.pointerEvents = id === visibleId ? 'auto' : 'none';
    if (id !== visibleId) {
      // 对非活动 webview 设置 inert，阻止其及其子树接收所有输入事件
      wv.inert = true;
      wv.blur();
      wv.executeJavaScript('window.blur();').catch(() => {});
    } else {
      wv.inert = false;
    }
  });
}

/**
 * 清除 suspend 登记与看门狗（不重算样式，由调用方决定何时 apply）
 */
function clearWebviewHitTestSuspend() {
  if (webviewHitTestSuspend.timer) {
    clearTimeout(webviewHitTestSuspend.timer);
  }
  webviewHitTestSuspend.active = false;
  webviewHitTestSuspend.reason = '';
  webviewHitTestSuspend.since = 0;
  webviewHitTestSuspend.timer = null;
}

/**
 * suspend 看门狗：持续无「按键按下」证据 ⇒ 判定收尾事件已丢失
 */
function armWebviewSuspendWatchdog() {
  clearTimeout(webviewHitTestSuspend.timer);
  webviewHitTestSuspend.timer = setTimeout(() => {
    if (!webviewHitTestSuspend.active) return;
    if (Date.now() - lastPointerPressedAt < WEBVIEW_SUSPEND_EVIDENCE_MS) {
      // 仍有按键证据：拖拽还在进行，继续观察（保留 since 以便日志里给出总时长）
      armWebviewSuspendWatchdog();
      return;
    }
    resumeWebviewHitTest('watchdog');
  }, WEBVIEW_SUSPEND_WATCHDOG_MS);
}

/**
 * 临时关闭所有 webview 的鼠标命中（拖拽/改宽期间）
 *
 * @param {string} reason - 触发来源，用于残留日志归因（tab-cross-drag / ai-panel-resize）
 */
function suspendWebviewHitTest(reason) {
  webviewHitTestSuspend.active = true;
  webviewHitTestSuspend.reason = reason;
  webviewHitTestSuspend.since = Date.now();
  // 正在拖拽 ⇒ 此刻必然有键按下，作为看门狗的第一份证据
  lastPointerPressedAt = Date.now();
  state.webviews.forEach((wv) => {
    if (wv) wv.style.pointerEvents = 'none';
  });
  armWebviewSuspendWatchdog();
}

/**
 * 恢复 webview 可命中性（幂等；未处于 suspend 时是 no-op，避免覆盖 showWebview 的结果）
 *
 * @param {string} source - 'drag-end' 为正常收尾（不打日志）；其余为兜底路径
 */
function resumeWebviewHitTest(source) {
  if (!webviewHitTestSuspend.active) return;
  const reason = webviewHitTestSuspend.reason;
  const suspendedMs = Date.now() - webviewHitTestSuspend.since;
  clearWebviewHitTestSuspend();
  applyWebviewInteractivity();
  if (source !== 'drag-end') {
    // 能走到这里说明正常收尾没跑到、由兜底救回：这正是「网页点不动只能重启」
    // 故障的现场证据（打印原始禁用来源即可一眼定位是哪条拖拽路径），必须留痕
    console.warn(
      `[Realm] webview 可命中性残留已恢复（兜底=${source}，原始禁用=${reason}，已禁用 ${suspendedMs}ms）`
    );
  }
}

/**
 * 可命中性兜底网：不再依赖各拖拽路径自己的 mouseup 收尾
 *
 * - mousemove 的 e.buttons 是「此刻实际按下的键」的权威值，松手事件丢了也能纠正
 * - 窗口失焦 / 页面不可见时按键不可能仍按在窗口内，证据作废并尝试恢复
 * - 正常收尾由各拖拽路径自己调用 resume（source='drag-end'），此处只兜异常
 */
function initWebviewHitTestSafetyNet() {
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0) lastPointerPressedAt = Date.now();
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (!webviewHitTestSuspend.active) return;
    if (e.buttons !== 0) {
      lastPointerPressedAt = Date.now();
      return;
    }
    // 指针在移动却没有按键 ⇒ 拖拽早已结束而收尾事件丢失
    resumeWebviewHitTest('mousemove-no-button');
  }, true);

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    // 只作废证据：正常收尾由拖拽路径自己 resume，这里不抢（否则每次拖拽都会误报残留）。
    // 收尾真丢了时，看门狗与 mousemove 兜底会在数秒内接住。
    lastPointerPressedAt = 0;
  }, true);

  window.addEventListener('blur', () => {
    lastPointerPressedAt = 0;
    resumeWebviewHitTest('window-blur');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      lastPointerPressedAt = 0;
      return;
    }
    resumeWebviewHitTest('visibility-restored');
  });
}

/**
 * 显示指定 Tab 的 webview
 * @param {string} tabId - Tab ID
 */
function showWebview(tabId) {
  state.visibleTabId = tabId;
  // 切 tab 意味着拖拽语境已结束：清掉 suspend 登记，避免跨状态残留
  // （样式由下方 applyWebviewInteractivity 一并重算）
  clearWebviewHitTestSuspend();
  applyWebviewInteractivity();

  // 更新导航按钮状态
  updateNavigationButtons();

  // 更新加载状态
  const webview = state.webviews.get(tabId);
  if (webview) {
    if (webview.isLoading()) {
      elements.loadingBar.classList.add('active');
      elements.loadingBar.classList.remove('complete');
      elements.reloadBtn.classList.add('loading');
    } else {
      elements.loadingBar.classList.remove('active');
      elements.loadingBar.classList.remove('complete');
      elements.reloadBtn.classList.remove('loading');
    }
  }
}

/**
 * 延迟移除 webview 元素（G-44-2 规避）：先用 CSSOM display:none 从布局摘除
 * （用户无感知），延迟后再从 DOM 移除——移除 webview 元素即销毁 guest
 * webContents，延迟给在途键盘事件 ACK 留出送达时间（Electron 43.3.0 上游
 * UAF：键盘 ACK 经 InputRouterImpl::KeyboardEventHandled 委派给已被同步
 * 销毁的 InspectableWebContents）。仅用 DOM API 与 setTimeout，renderer
 * 无 Node 全局。
 * 判定标准：凡是用户交互瞬间触发的 guest webContents 销毁都走延迟；
 * 程序化静默销毁（错误恢复/tab 回收）与跨窗口移动语境不延迟。
 * IN-10：delayMs 默认值与主进程 ipc-handlers.js 的 PLAYER_CLOSE_DESTROY_DELAY_MS
 * 是同一规避窗口的跨进程两份副本（renderer 移除 webview / 主进程 destroy 播放器窗口
 * 各一份），无共享常量是客观限制——改任一处必须同步另一处，规避效果以两端较小者为准。
 * @param {HTMLElement} webviewEl - webview 元素
 * @param {number} [delayMs=300] - 延迟毫秒数
 */
function deferredRemoveWebview(webviewEl, delayMs = 300) {
  try {
    webviewEl.style.display = 'none';
  } catch (err) {
    console.warn('[Realm Renderer] webview 隐藏失败:', err.message);
  }
  setTimeout(() => {
    try {
      webviewEl.remove();
    } catch (err) {
      console.warn('[Realm Renderer] webview 延迟移除失败:', err.message);
    }
  }, delayMs);
}

/**
 * 销毁 webview
 * @param {string} tabId - Tab ID
 * @param {{deferred?: boolean}} [options] - deferred=true 时先隐藏再延迟移除
 *   （用户关闭 tab 语境，G-44-2 规避同步销毁）；缺省同步移除（程序化/移动语境）
 */
function destroyWebview(tabId, options = {}) {
  const webview = state.webviews.get(tabId);
  if (webview) {
    const { deferred = false } = options;
    if (deferred) {
      deferredRemoveWebview(webview);
    } else {
      webview.remove();
    }
    state.webviews.delete(tabId);
  }
}

/**
 * 渲染容器快捷入口（新标签页）
 */
function renderContainerShortcuts() {
  elements.containerShortcuts.innerHTML = '';

  state.containers.forEach(container => {
    const shortcut = document.createElement('div');
    shortcut.className = 'container-shortcut';
    shortcut.addEventListener('click', () => {
      createTab(container.id);
    });

    const icon = document.createElement('div');
    icon.className = 'shortcut-icon';
    icon.textContent = '';
    const iconEl = renderContainerIcon(container, 32);
    iconEl.style.color = container.color;
    icon.appendChild(iconEl);

    const name = document.createElement('div');
    name.className = 'shortcut-name';
    name.textContent = container.name;

    shortcut.appendChild(icon);
    shortcut.appendChild(name);
    elements.containerShortcuts.appendChild(shortcut);
  });
}

/**
 * 更新导航按钮状态（前进/后退）
 */
function updateNavigationButtons() {
  const webview = state.webviews.get(state.activeTabId);
  if (webview) {
    elements.backBtn.disabled = !webview.canGoBack();
    elements.forwardBtn.disabled = !webview.canGoForward();
  } else {
    elements.backBtn.disabled = true;
    elements.forwardBtn.disabled = true;
  }
}

// ==================== 页面内搜索功能 ====================

/**
 * 打开页面内搜索框
 * 聚焦输入框并选中文本
 */
function openFindInPage() {
  if (state.findInPageOpen) {
    // 已打开，聚焦输入框
    elements.findInput.focus();
    elements.findInput.select();
    return;
  }

  state.findInPageOpen = true;
  elements.findInPage.classList.remove('hidden');

  // 获取当前活动 webview 的选中文本作为初始搜索词
  const webview = state.webviews.get(state.activeTabId);
  if (webview) {
    // 注入选中文本检测脚本
    webview.executeJavaScript('window.getSelection().toString()')
      .then(selectedText => {
        // 如果有选中文本，使用选中文本；否则保留上次的搜索词（Chrome 行为）
        if (selectedText && selectedText.trim()) {
          elements.findInput.value = selectedText.trim();
        }
        // 聚焦并全选文本，方便用户直接键入替换或回车继续搜索
        elements.findInput.focus();
        elements.findInput.select();
        // 如果有文本（选中的或上次保留的），立即搜索
        if (elements.findInput.value) {
          performFindInPage();
        }
      })
      .catch(() => {
        // 获取选中文本失败时，保留上次的搜索词并聚焦
        elements.findInput.focus();
        elements.findInput.select();
        // 如果有上次的搜索词，立即搜索
        if (elements.findInput.value) {
          performFindInPage();
        }
      });
  }
}

/**
 * 关闭页面内搜索框
 * 清除高亮并重置状态
 */
function closeFindInPage() {
  if (!state.findInPageOpen) return;

  state.findInPageOpen = false;
  elements.findInPage.classList.add('hidden');
  // 保留搜索词，下次打开时记住（Chrome 行为）
  elements.findResultCount.textContent = '';
  elements.findResultCount.classList.remove('no-match');

  // 停止搜索并清除高亮
  const webview = state.webviews.get(state.activeTabId);
  if (webview) {
    webview.stopFindInPage('clearSelection');
  }

  // 清除防抖定时器
  if (state.findInPageDebounceTimer) {
    clearTimeout(state.findInPageDebounceTimer);
    state.findInPageDebounceTimer = null;
  }
}

/**
 * 执行页面内搜索
 * 调用 webview.findInPage API
 * @param {boolean} findNext - 是否查找下一个
 * @param {boolean} forward - 搜索方向（true=向下）
 */
function performFindInPage(findNext = false, forward = true) {
  const webview = state.webviews.get(state.activeTabId);
  if (!webview) return;

  const searchText = elements.findInput.value;

  // 空搜索：清除高亮
  if (!searchText) {
    elements.findResultCount.textContent = '';
    elements.findResultCount.classList.remove('no-match');
    webview.stopFindInPage('clearSelection');
    return;
  }

  // 执行搜索
  webview.findInPage(searchText, {
    forward: forward,
    findNext: findNext,
    matchCase: state.findInPageMatchCase
  });
}

/**
 * 处理搜索输入（带防抖）
 * 延迟 150ms 执行搜索，避免频繁调用
 */
function handleFindInPageInput() {
  // 清除之前的防抖定时器
  if (state.findInPageDebounceTimer) {
    clearTimeout(state.findInPageDebounceTimer);
  }

  // 设置新的防抖定时器
  state.findInPageDebounceTimer = setTimeout(() => {
    performFindInPage(false);
  }, 150);
}

/**
 * 切换大小写敏感
 */
function toggleFindInPageCaseSensitive(e) {
  // 阻止默认行为和事件冒泡，避免焦点丢失
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  state.findInPageMatchCase = !state.findInPageMatchCase;
  elements.findCaseBtn.classList.toggle('active', state.findInPageMatchCase);
  elements.findCaseBtn.title = state.findInPageMatchCase ? '区分大小写 (已开启)' : '区分大小写';

  // 重新搜索 - 使用 findNext: true 强制重新搜索
  const webview = state.webviews.get(state.activeTabId);
  if (webview) {
    const searchText = elements.findInput.value;
    if (searchText) {
      // 使用 findNext: true 强制 Electron 重新执行搜索，应用新的 matchCase 参数
      webview.findInPage(searchText, {
        forward: true,
        findNext: true,
        matchCase: state.findInPageMatchCase
      });
    }
  }

  // 确保焦点回到搜索输入框
  elements.findInput.focus();
}

/**
 * 初始化页面内搜索事件监听
 */
function initFindInPage() {
  // 输入事件（带防抖）
  elements.findInput.addEventListener('input', handleFindInPageInput);

  // 键盘事件
  elements.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performFindInPage(true, !e.shiftKey); // Shift+Enter 反向
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeFindInPage();
    }
  });

  // 按钮点击事件
  elements.findNextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    performFindInPage(true, true);
    elements.findInput.focus();
  });
  elements.findPrevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    performFindInPage(true, false);
    elements.findInput.focus();
  });
  elements.findCaseBtn.addEventListener('click', toggleFindInPageCaseSensitive);
  elements.findCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeFindInPage();
  });

  // 监听 webview 的搜索结果事件
  // 注意：需要在 bindWebviewEvents 中为每个 webview 绑定
}

/**
 * 为 webview 绑定搜索结果监听
 * 在 bindWebviewEvents 中调用
 * @param {HTMLWebViewElement} webview - webview 元素
 */
function bindFindInPageEvents(webview) {
  // 跟踪上一次的匹配位置，用于检测循环
  let lastActiveMatchOrdinal = 0;
  let lastMatches = 0;

  webview.addEventListener('found-in-page', (event) => {
    const { activeMatchOrdinal, matches } = event.result;

    // 更新结果计数
    if (matches > 0) {
      elements.findResultCount.textContent = `${activeMatchOrdinal}/${matches}`;
      elements.findResultCount.classList.remove('no-match');

      // 检测循环：从最后一个匹配项循环回到第一个
      // 当从最后一个变为第一个时，需要触发一次额外的搜索来确保页面滚动
      if (lastMatches > 0 && lastActiveMatchOrdinal === lastMatches && activeMatchOrdinal === 1) {
        // 检测到循环，延迟执行一次搜索以确保页面滚动到第一个匹配项
        setTimeout(() => {
          const searchText = elements.findInput.value;
          if (searchText) {
            webview.findInPage(searchText, {
              forward: true,
              findNext: true,
              matchCase: state.findInPageMatchCase
            });
          }
        }, 50);
      }

      // 更新上一次的匹配位置
      lastActiveMatchOrdinal = activeMatchOrdinal;
      lastMatches = matches;
    } else {
      elements.findResultCount.textContent = '无匹配';
      elements.findResultCount.classList.add('no-match');
      lastActiveMatchOrdinal = 0;
      lastMatches = 0;
    }
  });
}

// ==================== 快捷键处理 ====================

/**
 * 初始化快捷键监听
 */
function initShortcuts() {
  window.realmAPI.onShortcutTriggered((action) => {
    console.log('[Realm Renderer] 快捷键触发:', action);

    switch (action) {
      case 'newTab':
        createTab(state.currentContainer);
        break;
      case 'closeTab':
        if (state.activeTabId) {
          closeTab(state.activeTabId);
        }
        break;
      case 'nextTab':
        switchToNextTab();
        break;
      case 'prevTab':
        switchToPrevTab();
        break;
      case 'reload':
        const webview = state.webviews.get(state.activeTabId);
        if (webview) {
          webview.reload();
        }
        break;
      case 'hardReload':
        const hardReloadWebview = state.webviews.get(state.activeTabId);
        if (hardReloadWebview) {
          hardReloadWebview.reloadIgnoringCache();
        }
        break;
      case 'back':
        const backWebview = state.webviews.get(state.activeTabId);
        if (backWebview && backWebview.canGoBack()) {
          backWebview.goBack();
        }
        break;
      case 'forward':
        const forwardWebview = state.webviews.get(state.activeTabId);
        if (forwardWebview && forwardWebview.canGoForward()) {
          forwardWebview.goForward();
        }
        break;
      case 'openSettings':
        openSettingsTab();
        break;
      case 'openHistory':
        openRealmPage('history', 'realm://history');
        break;
      case 'openFavorites':
        openRealmPage('favorites', 'realm://favorites');
        break;
      case 'bookmark':
        const activeTab = state.tabs.get(state.activeTabId);
        if (activeTab && activeTab.url) {
          const initialTitle = state.isCurrentPageBookmarked && state.currentBookmarkTitle
            ? state.currentBookmarkTitle
            : (activeTab.title || activeTab.url);
          showBookmarkEditPanel(
            initialTitle,
            activeTab.url,
            state.isCurrentPageBookmarked,
            state.currentBookmarkFolderId
          );
        } else {
          showToast('当前页面不可收藏', 'info');
        }
        break;
      case 'toggleAIPanel':
        toggleAIPanel();
        break;
      case 'toggleSidebar':
        toggleSidebar();
        break;
      case 'findInPage':
        openFindInPage();
        break;
      case 'focusUrl':
        elements.urlInput.focus();
        elements.urlInput.select();
        break;
      case 'focusPage': {
        const pageWebview = state.webviews.get(state.activeTabId);
        if (pageWebview) {
          pageWebview.focus();
        }
        break;
      }
      case 'setDefaultBrowser': {
        setDefaultBrowser();
        break;
      }
      case 'quickSaveCookies':
        handleQuickSaveCookies();
        break;
      case 'escape':
        // Escape 键：关闭 Vim 帮助对话框（如果打开）
        if (state.vimHelpOpen) {
          closeHelpDialog();
        }
        break;
    }
  });

  // 初始化 Vim 快捷键监听
  initVimShortcuts();

  // 预创建 Vim 帮助对话框 DOM
  createHelpDialog();
}

// ==================== Vim 快捷键处理 ====================

/**
 * Vim 滚动参数配置
 * 各方向的滚动距离（像素）
 * @type {Object}
 */
const VIM_SCROLL_CONFIG = {
  vertical: 100,       // j/k 上下滚动距离
  horizontal: 100,     // h/l 左右滚动距离
  halfPageRatio: 0.5,  // d/u 半屏滚动比例
};

/**
 * 向当前活动 webview 注入滚动命令
 *
 * 内部页面（realm://）body 设为 overflow:hidden，真正的滚动容器是子元素
 * （如 .history-page、.favorites-page 等）。通用策略：找到视口内第一个
 * overflow-y:auto/scroll 的可滚动祖先，window.scrollBy 回退。
 *
 * @param {'down'|'up'|'left'|'right'|'halfDown'|'halfUp'|'top'|'bottom'} direction - 滚动方向
 */
function injectScroll(direction) {
  const webview = state.webviews.get(state.activeTabId);
  if (!webview) return;

  const V = VIM_SCROLL_CONFIG.vertical;
  const H = VIM_SCROLL_CONFIG.horizontal;
  const R = VIM_SCROLL_CONFIG.halfPageRatio;

  // 查找离活动元素最近的可滚动祖先（含 document.scrollingElement 兜底）
  const findScroller = `(function(){
    var el = document.activeElement;
    while (el && el !== document.body) {
      var s = getComputedStyle(el);
      if ((s.overflowY==='auto'||s.overflowY==='scroll') && el.scrollHeight>el.clientHeight) return el;
      el = el.parentElement;
    }
    // body 不可滚动时，遍历 body 直接子元素找第一个可滚动容器
    var kids = document.body.children;
    for (var i=0;i<kids.length;i++) {
      var cs = getComputedStyle(kids[i]);
      if ((cs.overflowY==='auto'||cs.overflowY==='scroll') && kids[i].scrollHeight>kids[i].clientHeight) return kids[i];
    }
    return null;
  })()`;

  let scrollExpr = '';

  switch (direction) {
    case 'down':
      scrollExpr = `(function(){var s=${findScroller};if(s)s.scrollBy({top:${V},behavior:'smooth'});else window.scrollBy({top:${V},behavior:'smooth'})})()`;
      break;
    case 'up':
      scrollExpr = `(function(){var s=${findScroller};if(s)s.scrollBy({top:${-V},behavior:'smooth'});else window.scrollBy({top:${-V},behavior:'smooth'})})()`;
      break;
    case 'left':
      scrollExpr = `(function(){var s=${findScroller};if(s)s.scrollBy({left:${-H},behavior:'smooth'});else window.scrollBy({left:${-H},behavior:'smooth'})})()`;
      break;
    case 'right':
      scrollExpr = `(function(){var s=${findScroller};if(s)s.scrollBy({left:${H},behavior:'smooth'});else window.scrollBy({left:${H},behavior:'smooth'})})()`;
      break;
    case 'halfDown':
      scrollExpr = `(function(){var s=${findScroller};var d=window.innerHeight*${R};if(s)s.scrollBy({top:d,behavior:'smooth'});else window.scrollBy({top:d,behavior:'smooth'})})()`;
      break;
    case 'halfUp':
      scrollExpr = `(function(){var s=${findScroller};var d=-window.innerHeight*${R};if(s)s.scrollBy({top:d,behavior:'smooth'});else window.scrollBy({top:d,behavior:'smooth'})})()`;
      break;
    case 'top':
      scrollExpr = `(function(){var s=${findScroller};if(s)s.scrollTo({top:0,behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'})})()`;
      break;
    case 'bottom':
      scrollExpr = `(function(){var s=${findScroller};if(s)s.scrollTo({top:s.scrollHeight,behavior:'smooth'});else window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})})()`;
      break;
  }

  if (scrollExpr) {
    webview.executeJavaScript(scrollExpr).catch(() => {});
  }
}

/**
 * 向当前活动 webview 注入 Hint Mode overlay
 * 通过 webview.executeJavaScript 注入完整的 hint overlay 脚本到 webview guest
 *
 * @param {'current'|'newTab'|'copyUrl'} mode - 操作模式
 *   - current: 点击元素（当前标签页）
 *   - newTab: 在新标签页打开链接
 *   - copyUrl: 复制链接 URL 到剪贴板
 */
function injectHintMode(mode) {
  const webview = state.webviews.get(state.activeTabId);
  if (!webview) {
    // 无 webview 时回退标志，否则主进程 hintModeActive 卡死吞掉全部 Vim 键
    exitVimHint();
    return;
  }

  const hintScript = `(function() {
    // 重复触发时先退出上一次（清理残留 overlay 和 keydown 监听），再重新渲染
    if (window.__realmHintExit) { window.__realmHintExit(); }

    const MODE = '${mode}';
    const CHARS = 'asdfghjklqwertyuiopzxcvbnm';
    let container = null;
    let hints = [];
    let typedChars = '';
    let exited = false;
    let repositionScheduled = false;

    // 内联样式常量——realm:// 页面 CSP style-src 'self' 会阻止动态 <style> 元素，
    // 因此将所有样式直接写到元素 style 属性上
    var LABEL_BASE_STYLE = 'position:absolute;background:#FFB800;border:1px solid #E5A200;border-radius:2px;padding:1px 3px;font-family:"Courier New",Courier,monospace;font-size:12px;font-weight:700;line-height:1;color:#1a1a1a;pointer-events:none;z-index:2147483647;box-shadow:0 1px 3px rgba(0,0,0,0.3);white-space:nowrap';
    var CHAR_STYLE = 'color:rgba(0,0,0,0.4)';
    var CHAR_MATCHED_STYLE = 'color:#FF6B00';

    function createOverlay() {
      container = document.createElement('div');
      container.id = 'realm-vimium-hints';
      container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none';
      document.body.appendChild(container);
    }

    function collectClickableElements() {
      const selectors = 'a[href],button,input:not([type="hidden"]),select,textarea,[onclick],[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
      var elements = Array.from(document.querySelectorAll(selectors));
      // 补充：cursor:pointer 的元素通常是可点击的（JS 事件监听不体现在 DOM 属性上）
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (elements.indexOf(all[i]) === -1 && getComputedStyle(all[i]).cursor === 'pointer') {
          elements.push(all[i]);
        }
      }
      const visibleElements = elements.filter(function(el) {
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
               rect.top < window.innerHeight && rect.bottom > 0 &&
               rect.left < window.innerWidth && rect.right > 0;
      });
      const hintStrings = assignHintStrings(visibleElements.length, CHARS);
      hints = visibleElements.map(function(el, i) {
        return { element: el, hintString: hintStrings[i] };
      });
    }

    function assignHintStrings(count, chars) {
      var hints = [];
      var queue = chars.split('');
      while (hints.length < count) {
        var str = queue.shift();
        if (hints.length + queue.length + 1 < count) {
          for (var i = 0; i < chars.length; i++) {
            queue.push(str + chars[i]);
          }
        } else {
          hints.push(str);
        }
      }
      return hints;
    }

    // 容器是 position:fixed（原点即视口），label 直接用 getBoundingClientRect 的
    // 视口坐标，不能加 window.scrollY/scrollX（否则滚动后整体偏移一个滚动量）
    function positionLabel(h) {
      var rect = h.element.getBoundingClientRect();
      h.label.style.top = rect.top + 'px';
      h.label.style.left = rect.left + 'px';
      // 滚出视口的元素隐藏 label，滚回时恢复
      var visible = rect.bottom > 0 && rect.top < window.innerHeight &&
                    rect.right > 0 && rect.left < window.innerWidth;
      h.label.style.display = visible ? '' : 'none';
    }

    function renderHints() {
      hints.forEach(function(h) {
        var label = document.createElement('div');
        label.style.cssText = LABEL_BASE_STYLE;
        for (var i = 0; i < h.hintString.length; i++) {
          var span = document.createElement('span');
          span.style.cssText = CHAR_STYLE;
          span.textContent = h.hintString[i];
          label.appendChild(span);
        }
        h.label = label;
        positionLabel(h);
        container.appendChild(label);
      });
    }

    // 滚动/缩放后按元素最新视口坐标重排 label（rAF 节流，捕获阶段监听覆盖内层滚动容器）
    function onViewportChange() {
      if (repositionScheduled) return;
      repositionScheduled = true;
      requestAnimationFrame(function() {
        repositionScheduled = false;
        if (exited) return;
        hints.forEach(function(h) { if (h.label) positionLabel(h); });
      });
    }

    function updateHighlight() {
      var possibleMatches = hints.filter(function(h) {
        return h.hintString.startsWith(typedChars);
      });
      hints.forEach(function(h) {
        if (!h.label) return;
        if (h.hintString.startsWith(typedChars)) {
          h.label.style.opacity = '1';
        } else {
          h.label.style.opacity = '0.2';
        }
        var chars = h.label.children;
        for (var i = 0; i < chars.length; i++) {
          chars[i].style.cssText = i < typedChars.length ? CHAR_MATCHED_STYLE : CHAR_STYLE;
        }
      });
      return possibleMatches;
    }

    function activateHint(hint) {
      var el = hint.element;
      // 向上找最近的 <a href>（history 标题等非 <a> 元素可能包裹在可点击容器里）
      var anchor = el.closest ? el.closest('a[href]') : null;
      var href = (anchor && anchor.href) || el.href || el.action || '';
      if (MODE === 'current') {
        el.click();
      } else if (MODE === 'newTab') {
        if (href && window.__realmBridge) {
          // 后台新标签打开：焦点保留在当前页，由 renderer 侧 createTab 后切回
          window.__realmBridge.sendVimCommand('openInBgTab', { url: href });
        } else {
          // 无 href 的可点击元素（如 history 标题 div），回退到 click——
          // 其事件处理函数通常自行 window.open
          el.click();
        }
      } else if (MODE === 'copyUrl') {
        if (href && window.__realmBridge) {
          window.__realmBridge.sendVimCommand('copyUrl', { url: href });
        }
      }
      exit();
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') { exit(); return; }
      if (e.key === 'Backspace') { typedChars = typedChars.slice(0, -1); updateHighlight(); return; }
      if (e.key.length !== 1) return;

      var key = e.key.toLowerCase();
      if (CHARS.indexOf(key) === -1) return;

      e.preventDefault();
      e.stopPropagation();

      typedChars += key;
      var possibleMatches = updateHighlight();

      var matched = hints.find(function(h) { return h.hintString === typedChars; });
      if (matched) { activateHint(matched); return; }

      if (possibleMatches.length === 0) exit();
    }

    function exit() {
      if (exited) return;
      exited = true;
      var el = document.getElementById('realm-vimium-hints');
      if (el) el.remove();
      var st = document.getElementById('realm-vimium-hints-style');
      if (st) st.remove();
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('hashchange', exit);
      window.removeEventListener('popstate', exit);
      if (window.__realmHintExit === exit) window.__realmHintExit = null;
      window.__realmHintKey = null;
      if (window.__realmBridge) {
        window.__realmBridge.sendVimCommand('hintModeExit');
      }
    }

    // 暴露给 renderer：状态清理时远程销毁残留 overlay（见 exitVimHint）
    window.__realmHintExit = exit;

    // 暴露给主进程→renderer 转发链路的按键入口：
    // hint 按键由主进程捕获后经 IPC 转发（vim:hint-key），renderer 调此函数喂给
    // 同一个 handleKeyDown，不依赖 guest 键盘焦点（焦点跨 guest 转移不可靠）
    window.__realmHintKey = function(key) {
      if (exited) return;
      handleKeyDown({ key: key, preventDefault: function() {}, stopPropagation: function() {} });
    };

    createOverlay();
    collectClickableElements();
    if (hints.length === 0) {
      exit();
      return;
    }
    renderHints();
    updateHighlight();
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    // SPA 跳转（hash/popstate）后旧 hint 全部失效，自动退出
    window.addEventListener('hashchange', exit);
    window.addEventListener('popstate', exit);
  })()`;

  webview.executeJavaScript(hintScript).then(() => {
    // webview 从 hidden 切回 visible 后 tabIndex 可能失效，重新设置后再 focus；
    // 跨 guest 键盘焦点转移必须同时走主进程 WebContents.focus() 路径
    webview.tabIndex = -1;
    webview.focus();
    try {
      window.realmAPI.focusWebviewContents(webview.getWebContentsId());
    } catch { /* webview 过渡态时 getWebContentsId 会抛，忽略 */ }
  }).catch(() => {
    // 注入失败回退标志，否则主进程 hintModeActive 卡死吞掉全部 Vim 键
    exitVimHint();
  });
}

/**
 * 向当前活动 webview 注入搜索栏
 * 通过 webview.executeJavaScript 注入搜索栏 DOM 和交互逻辑到 webview guest
 * 搜索通过 webview.findInPage API 实现，搜索结果通过 __realmBridge 回传更新
 *
 * 按键模型（与主进程 searchInputActive 标志配合）：
 * - 输入阶段：主进程已同步置 searchInputActive=true，所有按键直达输入框，
 *   guest 内部 keydown 捕获处理 Enter/Escape，零 IPC 竞态
 * - Enter：发送 searchConfirm，renderer 进入 n/N 导航阶段
 * - Escape：发送 searchModeExit，彻底移除搜索栏
 */
function injectSearchBar() {
  const webview = state.webviews.get(state.activeTabId);
  if (!webview) return;

  // 绑定 found-in-page 事件监听（如果尚未绑定）
  if (!webview._vimSearchBound) {
    webview._vimSearchBound = true;
    webview.addEventListener('found-in-page', (event) => {
      const { activeMatchOrdinal, matches } = event.result;
      // 通过 postMessage 更新搜索栏计数
      const msg = matches > 0
        ? '第 ' + activeMatchOrdinal + '/' + matches + ' 个匹配'
        : '未找到匹配项';
      webview.executeJavaScript(
        `window.postMessage({type:'realm-vimium-search-result',text:${JSON.stringify(msg)}}, '*')`
      ).catch(() => {});
    });
  }

  const searchScript = `(function() {
    // 移除已有的搜索栏和样式（重复按 / 时重置，也避免隐藏元素阻塞重新注入）
    var existing = document.getElementById('realm-vimium-search');
    if (existing) existing.remove();
    var existingStyle = document.getElementById('realm-vimium-search-style');
    if (existingStyle) existingStyle.remove();

    // body 未就绪时兜底挂 documentElement（realm:// 动态页注入时机可能早于 body 构建）
    var mountPoint = document.body || document.documentElement;
    if (!mountPoint) return false;

    const style = document.createElement('style');
    style.id = 'realm-vimium-search-style';
    style.textContent = '#realm-vimium-search{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483646;display:none}' +
      '.realm-search-inner{display:flex;align-items:center;background:#2a2a2a;border:1px solid #404040;border-radius:6px;padding:6px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);gap:8px;min-width:300px;max-width:500px}' +
      '.realm-search-icon{color:#FFB800;font-family:"Courier New",Courier,monospace;font-size:14px;font-weight:700}' +
      '.realm-search-input{flex:1;background:transparent;border:none;outline:none;color:#f0f0f0;font-size:14px;font-family:system-ui}' +
      '.realm-search-count{color:#a0a0a0;font-size:12px;white-space:nowrap}';
    (document.head || mountPoint).appendChild(style);

    const container = document.createElement('div');
    container.id = 'realm-vimium-search';
    container.innerHTML = '<div class="realm-search-inner">' +
      '<span class="realm-search-icon">/</span>' +
      '<input type="text" class="realm-search-input" placeholder="输入搜索内容..." />' +
      '<span class="realm-search-count"></span>' +
      '</div>';
    mountPoint.appendChild(container);

    const input = container.querySelector('.realm-search-input');
    container.style.display = 'block';

    // 搜索结果计数：全局单例监听，查询时取当前 DOM，
    // 避免每次注入重复绑监听、闭包持有已移除元素
    if (!window.__realmVimSearchMsgBound) {
      window.__realmVimSearchMsgBound = true;
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'realm-vimium-search-result') {
          var el = document.querySelector('#realm-vimium-search .realm-search-count');
          if (el) el.textContent = e.data.text;
        }
      });
    }

    // closing 标志：Enter/Escape 主动关闭路径不触发 blur 退出
    var closing = false;
    input.focus();
    // 主动同步焦点状态到主进程（不等 focusin 事件链路，缩短竞态窗口）
    if (window.__realmBridge) {
      window.__realmBridge.sendFocusState(true);
    }

    // 失焦处理（延迟到焦点转移完成后判定）：
    // - 焦点仍在 guest 文档内（findInPage 激活匹配落在可编辑元素抢焦、点击页面等）
    //   → 夺回焦点，搜索栏是模态输入，中断会让主进程放行的按键落空
    // - 焦点离开 guest（点击工具栏/切换窗口）→ 退出搜索
    input.addEventListener('blur', function() {
      if (closing) return;
      setTimeout(function() {
        if (closing) return;
        if (!document.getElementById('realm-vimium-search')) return;
        if (document.hasFocus()) {
          input.focus();
        } else {
          closing = true;
          container.remove();
          style.remove();
          if (window.__realmBridge) {
            window.__realmBridge.sendFocusState(false);
            window.__realmBridge.sendVimCommand('searchModeExit');
          }
        }
      }, 0);
    });

    input.addEventListener('keydown', function(e) {
      // 所有按键止于搜索框，不透传给页面自身的键盘监听
      e.stopPropagation();
      if (e.key === 'Enter') {
        var text = input.value.trim();
        closing = true;
        // 回车后隐藏搜索栏并移除焦点，让 n/N 导航可正常工作
        container.style.display = 'none';
        input.blur();
        if (window.__realmBridge) {
          window.__realmBridge.sendFocusState(false);
          if (text) {
            window.__realmBridge.sendVimCommand('searchConfirm', { text: text });
          } else {
            // 空输入回车等价于退出
            window.__realmBridge.sendVimCommand('searchModeExit');
          }
        }
        e.preventDefault();
      } else if (e.key === 'Escape') {
        closing = true;
        // 从 DOM 彻底移除，确保下次 / 能重新注入
        container.remove();
        style.remove();
        if (window.__realmBridge) {
          window.__realmBridge.sendFocusState(false);
          window.__realmBridge.sendVimCommand('searchModeExit');
        }
        e.preventDefault();
      }
    });

    // 实时搜索（300ms 防抖）
    let debounceTimer = null;
    input.addEventListener('input', function() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        var text = input.value.trim();
        if (text && window.__realmBridge) {
          window.__realmBridge.sendVimCommand('findInPage', { text: text });
        }
      }, 300);
    });
    return true;
  })()`;

  // 注入失败（guest 忙/无挂载点）时回退主进程 searchInputActive，否则按键持续被吞
  webview.executeJavaScript(searchScript).then((ok) => {
    if (ok === false) {
      state.vimSearchActive = false;
      window.realmAPI.setVimSearchInputActive(false);
    }
  }).catch(() => {
    state.vimSearchActive = false;
    window.realmAPI.setVimSearchInputActive(false);
  });
}

/**
 * 退出 Vim 搜索模式（统一清理入口，幂等）
 * 清理 renderer 状态、主进程 searchActive / searchInputActive 标志，并清除页面高亮。
 * 触发路径：Escape、空输入回车、切换/关闭 Tab、页面导航。
 */
function exitVimSearch() {
  state.vimSearchActive = false;
  state.vimSearchText = '';
  window.realmAPI.setVimSearchActive(false);
  window.realmAPI.setVimSearchInputActive(false);
  const webview = state.webviews.get(state.activeTabId);
  if (webview) {
    try {
      webview.stopFindInPage('clearSelection');
    } catch (err) {
      // webview 可能已销毁，忽略
    }
  }
}

/**
 * 退出 Vim Hint Mode（统一清理入口，幂等）
 * 清理 renderer 状态和主进程 hintModeActive 标志；guest overlay 存活时通知其自毁。
 * 触发路径：guest 主动 hintModeExit、切换/关闭 Tab、页面导航（含 SPA）、注入失败回退。
 * 关键：主进程 hintModeActive 一旦残留为 true，before-input-event 会整段跳过
 * Vim 处理，表现为 Vim 模式完全失效只能重启，所以所有出口都必须走到这里。
 *
 * @param {HTMLElement} [webview] - hint 所在的 webview，缺省取当前活动 Tab
 */
function exitVimHint(webview) {
  if (!state.vimHintActive) return;
  state.vimHintActive = false;
  window.realmAPI.setVimHintActive(false);
  const wv = webview || state.webviews.get(state.activeTabId);
  if (wv) {
    try {
      // guest 侧 __realmHintExit 幂等（已退出则为 null，此调用为 no-op）
      wv.executeJavaScript('if (window.__realmHintExit) window.__realmHintExit();').catch(() => {});
    } catch (err) {
      // webview 可能已销毁，忽略
    }
  }
}

/**
 * 切换到相邻的标签页（循环）
 *
 * @param {number} offset - 偏移量（1=下一个，-1=上一个）
 */
function switchToAdjacentTab(offset) {
  const tabIds = Array.from(state.tabs.keys());
  if (tabIds.length <= 1) return;

  const currentIndex = tabIds.indexOf(state.activeTabId);
  const nextIndex = (currentIndex + offset + tabIds.length) % tabIds.length;
  switchTab(tabIds[nextIndex]);
}

/**
 * 切换到指定索引的标签页
 *
 * @param {number} index - 索引（0=第一个，-1=最后一个）
 */
function switchToTabByIndex(index) {
  const tabIds = Array.from(state.tabs.keys());
  if (tabIds.length === 0) return;

  const targetIndex = index === -1 ? tabIds.length - 1 : Math.min(index, tabIds.length - 1);
  switchTab(tabIds[targetIndex]);
}

/**
 * 切换到上一个访问的标签页（^ 命令）
 * 从标签历史栈中弹出最近的标签 ID 并切换
 */
function visitPrevTab() {
  if (state.tabHistoryStack.length === 0) {
    showToast('没有上一个访问的标签页', 'info');
    return;
  }

  // 弹出栈顶，跳过已关闭的标签
  while (state.tabHistoryStack.length > 0) {
    const prevTabId = state.tabHistoryStack.pop();
    if (state.tabs.has(prevTabId)) {
      switchTab(prevTabId);
      return;
    }
  }

  showToast('没有上一个访问的标签页', 'info');
}

/**
 * 重新打开已关闭的标签页（X 命令）
 * 从 closedTabsStack 中弹出最近关闭的标签并重新创建
 */
function reopenClosedTab() {
  if (closedTabsStack.length === 0) {
    showToast('没有可恢复的标签页', 'info');
    return;
  }

  const lastClosed = closedTabsStack.pop();
  createTab(lastClosed.containerId, lastClosed.url);
}

/**
 * Vim 快捷键帮助对话框分类定义
 * 每组包含：标题、快捷键列表（key + description）
 * @type {Array<{title: string, keys: Array<{key: string, desc: string}>}>}
 */
const VIM_HELP_CATEGORIES = [
  {
    title: '页面滚动',
    keys: [
      { key: 'j / k', desc: '向下 / 向上滚动' },
      { key: 'h / l', desc: '向左 / 向右滚动' },
      { key: 'gg / G', desc: '滚动到页面顶部 / 底部' },
      { key: 'd / u', desc: '向下 / 向上滚动半屏' },
    ],
  },
  {
    title: '浏览历史',
    keys: [
      { key: 'H / L', desc: '后退 / 前进' },
      { key: 'r / R', desc: '刷新页面 / 强制刷新' },
    ],
  },
  {
    title: '标签管理',
    keys: [
      { key: 'J / K', desc: '切换到上一个 / 下一个标签页' },
      { key: 'gT / gt', desc: '切换到上一个 / 下一个标签页' },
      { key: 'g0 / g$', desc: '切换到第一个 / 最后一个标签页' },
      { key: '^', desc: '切换到上一个访问的标签页' },
      { key: 't', desc: '新建标签页' },
      { key: 'x / X', desc: '关闭标签页 / 恢复已关闭的标签页' },
      { key: 'yt', desc: '复制当前标签页' },
      { key: 'W', desc: '移动标签页到新窗口' },
      { key: 'Alt+P', desc: '固定 / 取消固定标签页' },
    ],
  },
  {
    title: '链接跟随',
    keys: [
      { key: 'f', desc: '在当前标签页打开链接' },
      { key: 'F', desc: '在新标签页打开链接' },
    ],
  },
  {
    title: '搜索',
    keys: [
      { key: '/', desc: '进入搜索模式' },
      { key: 'n / N', desc: '跳转到下一个 / 上一个匹配' },
    ],
  },
  {
    title: 'URL 操作',
    keys: [
      { key: 'o / O', desc: '打开 URL / 在新标签页打开 URL' },
      { key: 'ge', desc: '编辑当前 URL' },
    ],
  },
  {
    title: '复制',
    keys: [
      { key: 'yy', desc: '复制当前页面 URL' },
      { key: 'yf', desc: '复制链接 URL' },
    ],
  },
  {
    title: '其他',
    keys: [
      { key: 'gs', desc: '查看页面源代码' },
      { key: 'T', desc: '搜索标签页' },
      { key: '?', desc: '显示快捷键帮助' },
    ],
  },
];

/**
 * 渲染帮助对话框分类内容
 * 使用 DOM 构建 + textContent 防 XSS（WR-13）
 *
 * @returns {DocumentFragment} 包含所有分类的文档片段
 */
function renderHelpCategories() {
  const fragment = document.createDocumentFragment();

  VIM_HELP_CATEGORIES.forEach(category => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'vimium-help-category';

    const titleEl = document.createElement('div');
    titleEl.className = 'vimium-help-category-title';
    titleEl.textContent = category.title;
    categoryEl.appendChild(titleEl);

    category.keys.forEach(item => {
      const row = document.createElement('div');
      row.className = 'vimium-help-row';

      const keyEl = document.createElement('span');
      keyEl.className = 'vimium-help-key';
      keyEl.textContent = item.key;

      const descEl = document.createElement('span');
      descEl.className = 'vimium-help-desc';
      descEl.textContent = item.desc;

      row.appendChild(keyEl);
      row.appendChild(descEl);
      categoryEl.appendChild(row);
    });

    fragment.appendChild(categoryEl);
  });

  return fragment;
}

/**
 * 创建 Vim 快捷键帮助对话框
 * 预创建 DOM 结构，初始隐藏，按 ? 键时显示
 */
function createHelpDialog() {
  // 如果已存在则不重复创建
  if (document.querySelector('.vimium-help-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'vimium-help-overlay';
  overlay.id = 'vimiumHelpOverlay';

  const dialog = document.createElement('div');
  dialog.className = 'vimium-help-dialog';

  // 头部
  const header = document.createElement('div');
  header.className = 'vimium-help-header';

  const title = document.createElement('h2');
  title.textContent = '快捷键帮助';

  const closeHint = document.createElement('span');
  closeHint.className = 'vimium-help-close-hint';
  closeHint.textContent = '按 Esc 关闭';

  header.appendChild(title);
  header.appendChild(closeHint);

  // 内容区
  const body = document.createElement('div');
  body.className = 'vimium-help-body';
  body.appendChild(renderHelpCategories());

  dialog.appendChild(header);
  dialog.appendChild(body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 点击背景关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeHelpDialog();
    }
  });
}

/**
 * 显示 Vim 快捷键帮助对话框
 */
function showHelpDialog() {
  const overlay = document.getElementById('vimiumHelpOverlay');
  if (!overlay) return;

  overlay.classList.add('active');
  state.vimHelpOpen = true;
}

/**
 * 关闭 Vim 快捷键帮助对话框
 */
function closeHelpDialog() {
  const overlay = document.getElementById('vimiumHelpOverlay');
  if (!overlay) return;

  overlay.classList.remove('active');
  state.vimHelpOpen = false;
}

/**
 * 初始化 Vim 快捷键监听
 *
 * 监听主进程发送的 vim:triggered 事件，分发到对应的处理函数。
 * 同时监听 webview 的焦点状态变化（vim:focus-state 通道）。
 */
function initVimShortcuts() {
  // host 主窗口（地址栏等 chrome 内输入框）焦点状态上报：
  // 主进程按 vimFocusStates 判定是否放行 Vim 单键，缺了 host 侧状态会导致
  // 焦点在地址栏时 f/F 等键被当作 Vim 命令拦截（第一个字符打不进地址栏）
  let hostFocusInInput = null;
  const reportHostFocus = () => {
    const el = document.activeElement;
    const inInput = !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
    if (inInput !== hostFocusInInput) {
      hostFocusInInput = inInput;
      window.realmAPI.setHostVimFocusState(inInput);
    }
  };
  document.addEventListener('focusin', reportHostFocus);
  // focusout 时 activeElement 尚未更新，延迟一帧再判定
  document.addEventListener('focusout', () => setTimeout(reportHostFocus, 0));

  // 监听主进程转发的 Hint Mode 按键（主进程捕获 → IPC → 注入 guest）
  window.realmAPI.onVimHintKey((key) => {
    if (!state.vimHintActive) return;
    const wv = state.webviews.get(state.activeTabId);
    if (!wv) return;
    wv.executeJavaScript(`window.__realmHintKey && window.__realmHintKey(${JSON.stringify(key)})`).catch(() => {});
  });

  // 监听主进程的 Vim 命令触发
  window.realmAPI.onVimTriggered((command) => {
    console.log('[Realm Renderer] Vim 命令触发:', command);

    // 帮助对话框打开时，只处理 Escape（关闭帮助）和 showHelp（切换关闭）
    if (state.vimHelpOpen) {
      if (command === 'showHelp' || command === 'escape') {
        closeHelpDialog();
      } else if (command === 'searchMode') {
        // 主进程派发前已同步置 searchInputActive，丢弃命令时必须回退，否则按键持续被吞
        window.realmAPI.setVimSearchInputActive(false);
      } else if (command === 'hintMode' || command === 'hintModeNewTab' || command === 'copyLinkUrl') {
        // 主进程派发前已同步置 hintModeActive，丢弃命令时同样必须回退
        window.realmAPI.setVimHintActive(false);
      }
      return;
    }

    // Hint Mode 激活期间，屏蔽所有 Vim 命令（由 guest 内部监听器独立处理）
    if (state.vimHintActive) {
      return;
    }

    switch (command) {
      // ==================== 帮助对话框 ====================
      case 'showHelp':
        showHelpDialog();
        return; // 不传递给其他处理

      // ==================== 滚动命令 ====================
      case 'scrollDown': injectScroll('down'); break;
      case 'scrollUp': injectScroll('up'); break;
      case 'scrollLeft': injectScroll('left'); break;
      case 'scrollRight': injectScroll('right'); break;
      case 'scrollHalfPageDown': injectScroll('halfDown'); break;
      case 'scrollHalfPageUp': injectScroll('halfUp'); break;
      case 'scrollToTop': injectScroll('top'); break;
      case 'scrollToBottom': injectScroll('bottom'); break;

      // ==================== 标签管理 ====================
      case 'closeTab':
        if (state.activeTabId) closeTab(state.activeTabId);
        break;
      case 'restoreTab':
        reopenClosedTab();
        break;
      case 'newTab':
        createTab(state.currentContainer);
        break;
      case 'nextTab':
        switchToAdjacentTab(1);
        break;
      case 'prevTab':
        switchToAdjacentTab(-1);
        break;
      case 'firstTab':
        switchToTabByIndex(0);
        break;
      case 'lastTab':
        switchToTabByIndex(-1);
        break;
      case 'visitPrevTab':
        visitPrevTab();
        break;
      case 'duplicateTab': {
        const activeTab = state.tabs.get(state.activeTabId);
        if (activeTab && activeTab.url) {
          createTab(state.currentContainer, activeTab.url);
        }
        break;
      }

      // ==================== 浏览导航 ====================
      case 'goBack': {
        const wv = state.webviews.get(state.activeTabId);
        if (wv && wv.canGoBack()) wv.goBack();
        break;
      }
      case 'goForward': {
        const wv = state.webviews.get(state.activeTabId);
        if (wv && wv.canGoForward()) wv.goForward();
        break;
      }
      case 'reload': {
        const wv = state.webviews.get(state.activeTabId);
        if (wv) wv.reload();
        break;
      }
      case 'hardReload': {
        const wv = state.webviews.get(state.activeTabId);
        if (wv) wv.reloadIgnoringCache();
        break;
      }

      // ==================== URL 操作 ====================
      case 'focusUrl':
        elements.urlInput.focus();
        elements.urlInput.select();
        break;
      case 'focusUrlNewTab':
        createTab(state.currentContainer);
        // 延迟聚焦地址栏，等待新 tab 创建完成
        setTimeout(() => {
          elements.urlInput.focus();
          elements.urlInput.select();
        }, 100);
        break;
      case 'editUrl': {
        const activeTab = state.tabs.get(state.activeTabId);
        if (activeTab && activeTab.url) {
          elements.urlInput.value = activeTab.url;
          elements.urlInput.focus();
          elements.urlInput.select();
        }
        break;
      }

      // ==================== 复制操作 ====================
      case 'copyUrl': {
        const activeTab = state.tabs.get(state.activeTabId);
        if (activeTab && activeTab.url) {
          window.realmAPI.copyToClipboard(activeTab.url).then((res) => {
            showToast(res.success ? 'URL 已复制到剪贴板' : '复制失败', res.success ? 'success' : 'error');
          }).catch(() => {
            showToast('复制失败', 'error');
          });
        }
        break;
      }

      // ==================== 标签增强 ====================
      case 'moveTabToNewWindow':
        if (state.activeTabId) {
          window.realmAPI.openTabInNewWindow(state.activeTabId, { move: true });
        }
        break;
      case 'viewSource': {
        const wv = state.webviews.get(state.activeTabId);
        if (wv) {
          const currentUrl = wv.getURL();
          if (currentUrl && currentUrl.startsWith('http')) {
            createTab(state.currentContainer, 'realm://viewsource?url=' + encodeURIComponent(currentUrl));
          }
        }
        break;
      }
      case 'togglePinTab': {
        const tab = state.tabs.get(state.activeTabId);
        if (tab) {
          tab.pinned = !tab.pinned;
          window.realmAPI.updateTab(state.activeTabId, { pinned: tab.pinned });
          renderTabs();
          showToast(tab.pinned ? '标签页已固定' : '标签页已取消固定', 'success');
        }
        break;
      }

      // ==================== Hint Mode ====================
      // 主进程派发前已同步置 hintModeActive；无活动 webview 注入必然失败，
      // 必须回退清除，否则后续按键全被当作 hint 字符吞掉
      case 'hintMode':
        if (!state.webviews.get(state.activeTabId)) {
          window.realmAPI.setVimHintActive(false);
          break;
        }
        state.vimHintActive = true;
        window.realmAPI.setVimHintActive(true);
        injectHintMode('current');
        break;
      case 'hintModeNewTab':
        if (!state.webviews.get(state.activeTabId)) {
          window.realmAPI.setVimHintActive(false);
          break;
        }
        state.vimHintActive = true;
        window.realmAPI.setVimHintActive(true);
        injectHintMode('newTab');
        break;
      case 'copyLinkUrl':
        if (!state.webviews.get(state.activeTabId)) {
          window.realmAPI.setVimHintActive(false);
          break;
        }
        state.vimHintActive = true;
        window.realmAPI.setVimHintActive(true);
        injectHintMode('copyUrl');
        break;

      // ==================== 搜索模式 ====================
      case 'searchMode': {
        // 主进程派发前已同步置 searchInputActive；无 webview 时必须回退清除，否则按键全被吞
        const wvSearch = state.webviews.get(state.activeTabId);
        if (!wvSearch) {
          window.realmAPI.setVimSearchInputActive(false);
          break;
        }
        // 输入阶段不开启 searchActive（n/N 导航），等 searchConfirm 后再开
        state.vimSearchActive = true;
        injectSearchBar();
        break;
      }
      case 'searchNext': {
        const wvNext = state.webviews.get(state.activeTabId);
        if (wvNext && state.vimSearchText) {
          wvNext.findInPage(state.vimSearchText, { forward: true, findNext: true });
        }
        break;
      }
      case 'searchPrev': {
        const wvPrev = state.webviews.get(state.activeTabId);
        if (wvPrev && state.vimSearchText) {
          wvPrev.findInPage(state.vimSearchText, { forward: false, findNext: true });
        }
        break;
      }
      case 'searchModeExit':
        exitVimSearch();
        break;

      // ==================== 标签页搜索 ====================
      case 'searchTabs':
        openSettingsTab('shortcuts');
        break;
    }
  });
}

/**
 * 初始化 webview 的 Vim 焦点状态监听和 Vim 命令通道
 * 在 webview 创建时调用，处理 vim:focus-state 和 vim:command 通道
 *
 * @param {HTMLElement} webview - webview 元素
 */
function initVimFocusListener(webview) {
  webview.addEventListener('ipc-message', (e) => {
    if (e.channel === 'vim:focus-state') {
      // 传递 webview guest 的 webContents ID，而非 renderer 的 ID
      let guestId;
      try { guestId = webview.getWebContentsId(); } catch { return; }
      window.realmAPI.setVimFocusState(guestId, e.args[0]);
    } else if (e.channel === 'vim:command') {
      const command = e.args[0];
      const data = e.args[1];
      if (command === 'hintModeExit') {
        // Hint Mode 退出，清除状态
        exitVimHint(webview);
      } else if (command === 'copyUrl' && data && data.url) {
        window.realmAPI.copyToClipboard(data.url).then((res) => {
          showToast(res.success ? '链接 URL 已复制到剪贴板' : '复制失败', res.success ? 'success' : 'error');
        }).catch(() => {
          showToast('复制失败', 'error');
        });
      } else if (command === 'openInBgTab' && data && data.url) {
        // F 键 hint：后台新标签打开，焦点保留在当前页。
        // hint 只在活动页触发，来源 tab 即活动 tab，openUrl 的容器
        // fallback（规则匹配 > 当前容器）与之等价，无需反查来源容器
        openUrl(data.url, { disposition: 'background-tab' });
      } else if (command === 'findInPage' && data && data.text) {
        // 搜索输入阶段的实时预览：只执行查找并暂存搜索词，不进入 n/N 导航阶段
        // 注意必须用 findNext:true —— 实证（Electron webview）：全新 find 会话的
        // findNext:false 不高亮也不触发 found-in-page（无计数），findNext:true 才会
        // 高亮全部匹配并激活首个。预览期间文本逐字变化，每次调用都是新词定位第一个匹配。
        state.vimSearchText = data.text;
        try {
          webview.findInPage(data.text, { forward: true, findNext: true });
        } catch (err) { /* webview 可能已销毁 */ }
      } else if (command === 'searchConfirm' && data && data.text) {
        // Enter 确认：固定搜索词，进入 n/N 导航阶段
        // （searchInputActive 由主进程在输入阶段持有，此处清除并开启 searchActive）
        // 若确认词与预览词相同（高亮/计数已在），跳过 findInPage —— 否则 findNext:true
        // 语义会把激活匹配前移到第二个，Enter 应停留在第一个匹配。
        const needFind = data.text !== state.vimSearchText;
        state.vimSearchText = data.text;
        state.vimSearchActive = true;
        window.realmAPI.setVimSearchInputActive(false);
        window.realmAPI.setVimSearchActive(true);
        if (needFind) {
          try {
            webview.findInPage(data.text, { forward: true, findNext: true });
          } catch (err) { /* webview 可能已销毁 */ }
        }
      } else if (command === 'searchModeExit') {
        // 搜索模式退出
        exitVimSearch();
      }
    }
  });
}

/**
 * 切换到下一个 Tab
 */
function switchToNextTab() {
  const tabIds = Array.from(state.tabs.keys());
  if (tabIds.length <= 1) return;

  const currentIndex = tabIds.indexOf(state.activeTabId);
  const nextIndex = (currentIndex + 1) % tabIds.length;
  switchTab(tabIds[nextIndex]);
}

/**
 * 切换到上一个 Tab
 */
function switchToPrevTab() {
  const tabIds = Array.from(state.tabs.keys());
  if (tabIds.length <= 1) return;

  const currentIndex = tabIds.indexOf(state.activeTabId);
  const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
  switchTab(tabIds[prevIndex]);
}

/**
 * 打开设置页面
 * 当前容器已有 realm://settings Tab 则切换过去，否则新建。
 * 设置按钮和 CmdOrCtrl+, 快捷键共用此入口。
 * @param {string} [tabName] - 可选的 tab 名称（rules、shortcuts 等），用于跳转到设置页面对应区域
 */
function openSettingsTab(tabName) {
  const containerId = state.currentContainer;
  const suffix = tabName ? `?tab=${tabName}` : '';

  // 查找已有的设置页面 tab
  let existingTabId = null;
  state.tabs.forEach((tab, tabId) => {
    if (tab.url && tab.url.startsWith('realm://settings') && tab.containerId === containerId) {
      existingTabId = tabId;
    }
  });

  if (existingTabId) {
    switchTab(existingTabId);
    // 如果有 tab 参数，通知 webview 切换页面
    if (tabName) {
      const webview = state.webviews.get(existingTabId);
      if (webview) {
        webview.executeJavaScript(`switchSettingsPage && switchSettingsPage('${tabName}')`);
      }
    }
  } else {
    createTab(containerId, `realm://settings${suffix}`);
  }
}

/** 默认浏览器状态轮询定时器（重复触发时先清旧轮询） */
let defaultBrowserPollTimer = null;

/**
 * 轮询默认浏览器状态
 * macOS 系统确认框停留时长不定，用户确认后 isDefaultProtocolClient 才会翻转；
 * 生效则提示成功，超时未生效提示失败
 */
function pollDefaultBrowserStatus() {
  if (defaultBrowserPollTimer) clearInterval(defaultBrowserPollTimer);
  let attempts = 0;
  defaultBrowserPollTimer = setInterval(async () => {
    attempts += 1;
    try {
      const res = await window.realmAPI.isDefaultBrowser();
      if (res.isDefault) {
        clearInterval(defaultBrowserPollTimer);
        defaultBrowserPollTimer = null;
        showToast('已设为默认浏览器', 'success');
      } else if (attempts >= 15) {
        clearInterval(defaultBrowserPollTimer);
        defaultBrowserPollTimer = null;
        showToast('设置未生效，可重试', 'error');
      }
    } catch (err) {
      console.error('[Realm Renderer] 查询默认浏览器状态失败:', err);
      clearInterval(defaultBrowserPollTimer);
      defaultBrowserPollTimer = null;
    }
  }, 1000);
}

/**
 * 设置当前应用为系统默认浏览器
 * 快捷键 Cmd+Shift+D 触发，可在任何界面调用。
 * 主进程发出注册请求后 macOS 弹系统确认框，真实结果由轮询判定，
 * 不使用 setAsDefaultProtocolClient 的同步返回值（确认框期间为 false）。
 */
async function setDefaultBrowser() {
  try {
    // 先查询当前状态
    const status = await window.realmAPI.isDefaultBrowser();
    if (status.isDefault) {
      showToast('Realm 已是默认浏览器', 'info');
      return;
    }

    // 调用系统注册（macOS 弹框确认），随后轮询真实状态
    await window.realmAPI.setDefaultBrowser();
    showToast('请在系统弹窗中确认');
    pollDefaultBrowserStatus();
  } catch (error) {
    console.error('[Realm Renderer] 设置默认浏览器失败:', error);
    showToast('设置失败，请重试', 'error');
  }
}

/**
 * 打开 realm:// 内部页面
 * 当前容器已有对应 Tab 则切换过去，否则新建。
 * @param {string} pageName - 页面名称（用于匹配已有 tab 的 url 前缀）
 * @param {string} url - 完整的 realm:// 页面地址
 */
function openRealmPage(pageName, url) {
  const containerId = state.currentContainer;

  let existingTabId = null;
  state.tabs.forEach((tab, tabId) => {
    if (tab.url && tab.url.startsWith(`realm://${pageName}`) && tab.containerId === containerId) {
      existingTabId = tabId;
    }
  });

  if (existingTabId) {
    switchTab(existingTabId);
  } else {
    createTab(containerId, url);
  }
}

/**
 * 弹出"恢复标签页"询问对话框
 * @param {number} tabCount - 待恢复的 tab 数量
 * @returns {Promise<{action: 'restore'|'fresh', remember: boolean}>}
 */
function showRestoreTabsDialog(tabCount) {
  return new Promise((resolve) => {
    elements.restoreTabsCount.textContent = String(tabCount);
    elements.restoreTabsRemember.checked = false;

    const cleanup = () => {
      elements.restoreTabsYesBtn.removeEventListener('click', onYes);
      elements.restoreTabsNoBtn.removeEventListener('click', onNo);
      elements.restoreTabsModal.removeEventListener('cancel', onCancel);
      elements.restoreTabsModal.removeEventListener('click', onBackdrop);
    };
    const finish = (action) => {
      const remember = elements.restoreTabsRemember.checked;
      cleanup();
      elements.restoreTabsModal.close();
      resolve({ action, remember });
    };
    const onYes = () => finish('restore');
    const onNo = () => finish('fresh');
    const onCancel = (e) => { e.preventDefault(); finish('fresh'); };  // Esc
    const onBackdrop = (e) => { if (e.target === elements.restoreTabsModal) finish('fresh'); };

    elements.restoreTabsYesBtn.addEventListener('click', onYes);
    elements.restoreTabsNoBtn.addEventListener('click', onNo);
    elements.restoreTabsModal.addEventListener('cancel', onCancel);
    elements.restoreTabsModal.addEventListener('click', onBackdrop);

    elements.restoreTabsModal.showModal();
  });
}

/**
 * 从主进程恢复保存的 Tab 列表
 */
async function restoreTabs() {
  const tabs = await window.realmAPI.getTabs();
  const activeTab = await window.realmAPI.getActiveTab();

  // 主进程预注入 Tab 的窗口（右键「在新窗口中打开」/拖出新窗口，经
  // createMainWindow 的 ?injected=1 query 标记）：restoreTabsOnLaunch 的
  // 「丢弃上次会话」语义只应作用于启动恢复，不应清掉本窗口刚注入的 Tab，
  // 故跳过设置分支直接渲染 tab:list 拉到的 Tab
  const hasInjectedTabs =
    new URLSearchParams(window.location.search).get('injected') === '1';

  if (tabs.length === 0) {
    // 没有保存的 Tab，创建新 Tab
    createTab(state.currentContainer);
    return;
  }

  if (!hasInjectedTabs) {
    // 按设置决定是否恢复
    const settings = await window.realmAPI.getSettings();
    const behavior = settings.restoreTabsOnLaunch || 'ask';

    let shouldRestore = behavior === 'always';
    if (behavior === 'ask') {
      const { action, remember } = await showRestoreTabsDialog(tabs.length);
      shouldRestore = action === 'restore';
      if (remember) {
        // 永久更改设置：恢复 → 'always'，不恢复 → 'never'
        await window.realmAPI.setSetting(
          'restoreTabsOnLaunch',
          shouldRestore ? 'always' : 'never'
        );
      }
    }

    if (!shouldRestore) {
      // 丢弃旧会话：主进程 initTabs 已把旧 Tab 加载到内存 Map，
      // 不清空则后续新建 Tab 会 append 进去一起被持久化，
      // 下次启动会把本次放弃的旧会话一并恢复
      // （主进程按发送窗口清空，多窗口时不影响其他窗口的 Tab）
      await window.realmAPI.clearAllTabs();
      createTab(state.currentContainer);
      return;
    }
  }

  console.log(`[Realm Renderer] 恢复 ${tabs.length} 个 Tab`);

  // 先把所有 Tab 注册进 state（含 faviconUrl/pinned 等持久化字段）
  for (const tab of tabs) {
    state.tabs.set(tab.id, tab);

    // 如果有 URL，创建 webview
    if (tab.url) {
      createWebviewForTab(tab.id, tab.containerId, tab.url);
    }

    // 更新 Tab 计数器
    const tabNum = parseInt(tab.id.replace('tab-', ''), 10);
    if (tabNum > state.tabCounter) {
      state.tabCounter = tabNum;
    }
  }

  // 统一走 renderTabs 重建 DOM：固定 Tab 排序到最左 + 应用 tab-pinned class，
  // 否则恢复后 pinned Tab 显示为普通 Tab（持久化是对的，只是没渲染）
  renderTabs();

  // 切换到活动 Tab
  if (activeTab && state.tabs.has(activeTab.id)) {
    await switchTab(activeTab.id);
  } else if (tabs.length > 0) {
    await switchTab(tabs[0].id);
  }
}

/**
 * 处理右键菜单动作回调
 * 主进程菜单项被点击后，通过 IPC channel 发送回调，此函数统一分发处理
 * @param {string} channel - IPC channel 名称
 * @param {Object} data - 回调数据
 */
function handleContextMenuAction(channel, data) {
  switch (channel) {
    case 'context-menu:close-tab':
      if (data && data.tabId) {
        closeTab(data.tabId);
      }
      break;

    case 'context-menu:close-other-tabs': {
      if (!data || !data.tabId) break;
      const tabIdsToClose = [];
      state.tabs.forEach((tab, tabId) => {
        if (tabId !== data.tabId) {
          tabIdsToClose.push(tabId);
        }
      });
      tabIdsToClose.forEach(tabId => closeTab(tabId));
      break;
    }

    case 'context-menu:close-left-tabs': {
      if (!data || !data.tabId) break;
      const allIds = Array.from(state.tabs.keys());
      const leftIndex = allIds.indexOf(data.tabId);
      if (leftIndex <= 0) break;
      const leftIds = allIds.slice(0, leftIndex);
      leftIds.forEach(tabId => closeTab(tabId));
      break;
    }

    case 'context-menu:close-right-tabs': {
      if (!data || !data.tabId) break;
      const allRightIds = Array.from(state.tabs.keys());
      const rightIndex = allRightIds.indexOf(data.tabId);
      if (rightIndex < 0 || rightIndex >= allRightIds.length - 1) break;
      const rightIds = allRightIds.slice(rightIndex + 1);
      rightIds.forEach(tabId => closeTab(tabId));
      break;
    }

    case 'context-menu:reopen-tab': {
      if (closedTabsStack.length === 0) {
        showToast('没有可恢复的标签页', 'info');
        break;
      }
      const lastClosed = closedTabsStack.pop();
      createTab(lastClosed.containerId, lastClosed.url);
      break;
    }

    case 'context-menu:new-tab':
      // 标签栏空白区菜单：新建标签页
      createTab(state.currentContainer);
      break;

    case 'context-menu:toggle-pin': {
      if (!data || !data.tabId) break;
      const tab = state.tabs.get(data.tabId);
      if (!tab) break;
      tab.pinned = !tab.pinned;
      window.realmAPI.updateTab(data.tabId, { pinned: tab.pinned });
      renderTabs();
      break;
    }

    case 'context-menu:open-in-new-window':
      // 与 Chrome 一致的移动语义：标签随迁到新窗口，原窗口不再保留
      if (data && data.tabId) {
        window.realmAPI.openTabInNewWindow(data.tabId, { move: true });
      }
      break;

    case 'context-menu:open-in-new-tab':
      if (data && data.url) {
        // 统一导航入口（安全校验含 view-source:http(s) 放行，见 openUrl）
        openUrl(data.url, { disposition: 'new-tab' });
      }
      break;

    case 'context-menu:open-in-bg-tab':
      if (data && data.url) {
        // 统一导航入口；后台打开（不切焦点）由 openUrl background-tab 分支处理
        openUrl(data.url, { disposition: 'background-tab' });
      }
      break;

    case 'context-menu:open-in-container':
      if (data && data.url && data.containerId) {
        // 用户显式选择容器：explicitContainerId 优先于分配规则（决策 3）
        openUrl(data.url, { disposition: 'new-tab', explicitContainerId: data.containerId });
      }
      break;

    case 'context-menu:search-text':
      if (data && data.text) {
        // 统一导航入口：纯文本经 normalizeUrl 转默认搜索引擎 URL，新标签前台打开
        openUrl(data.text, { disposition: 'new-tab' });
      }
      break;

    case 'context-menu:add-to-favorites':
      if (data && data.url) {
        window.realmAPI.favoritesAdd({
          url: data.url,
          title: data.title || data.url,
          faviconUrl: '',
        }).then(result => {
          if (result.error === 'duplicate') {
            showToast('已收藏过该页面', 'info');
          } else {
            showToast('已收藏', 'success');
            // 刷新工具栏星标（若收藏的是当前活动 Tab 的 URL）
            const activeTab = state.tabs.get(state.activeTabId);
            if (activeTab && activeTab.url === data.url) {
              checkBookmarkStatus(data.url);
            }
          }
        }).catch(err => {
          console.error('[Realm Renderer] 收藏失败:', err);
          showToast('收藏失败', 'error');
        });
      }
      break;

    case 'context-menu:toast':
      if (data && data.message) {
        showToast(data.message, data.type || 'success');
      }
      break;

    case 'context-menu:text-action':
      // T-13-05 安全白名单：仅允许四个文本编辑操作
      if (data && data.action) {
        const allowedActions = ['cut', 'copy', 'paste', 'selectAll'];
        if (!allowedActions.includes(data.action)) {
          console.warn('[Realm Renderer] 拒绝非白名单 text-action:', data.action);
          break;
        }
        const activeWebview = state.webviews.get(state.activeTabId);
        if (activeWebview) {
          activeWebview.executeJavaScript(`document.execCommand('${data.action}')`);
        }
      }
      break;

    default:
      console.log('[Realm Renderer] 未知的右键菜单 action:', channel);
  }
}

// ==================== 标签栏溢出滚动（Firefox 风格） ====================

/**
 * 更新标签栏左右滚动按钮的显隐状态
 * 左按钮：有溢出且未滚到最左；右按钮：有溢出且未滚到最右；无溢出时都隐藏
 */
function updateTabScrollState() {
  const tabList = elements.tabList;
  if (!tabList || !elements.tabScrollLeft || !elements.tabScrollRight) return;
  const maxScroll = tabList.scrollWidth - tabList.clientWidth;
  const hasOverflow = maxScroll > 1; // 1px 容差，避免亚像素溢出误判
  elements.tabScrollLeft.classList.toggle('visible', hasOverflow && tabList.scrollLeft > 1);
  elements.tabScrollRight.classList.toggle('visible', hasOverflow && tabList.scrollLeft < maxScroll - 1);
  updateTabOverflowLayout();
}

/**
 * 根据标签内容宽度切换标签栏溢出布局（tabBar 上的 tab-overflow 类）
 * 溢出时收起窗口拖拽保留区（.tab-drag-spacer），让标签铺满整个标签栏（Firefox 行为）。
 * 判定必须与当前是否已收起解耦（用 tab-bar 内宽减按钮区/保留区声明宽，而非 tab-list 当前宽）：
 * 否则收起会让 tab-list 变宽、浅溢出（≤保留区宽）时陷入「收起→放得下→展开→又溢出」的振荡
 */
function updateTabOverflowLayout() {
  const tabBar = elements.tabBar;
  const tabList = elements.tabList;
  if (!tabBar || !tabList) return;
  const spacer = tabBar.querySelector('.tab-drag-spacer');
  const spacerBasis = spacer ? (parseFloat(getComputedStyle(spacer).flexBasis) || 0) : 0;
  // 展开态固定开销 = 保留区声明宽 + 其余子元素（滚动按钮×2/新建按钮）+ tab-bar 内边距
  const tabBarStyle = getComputedStyle(tabBar);
  let chromeWidth = spacerBasis
    + parseFloat(tabBarStyle.paddingLeft) + parseFloat(tabBarStyle.paddingRight);
  for (const el of tabBar.children) {
    if (el !== tabList && el !== spacer) chromeWidth += el.offsetWidth;
  }
  const expandedAvail = tabBar.clientWidth - chromeWidth;
  const contentWidth = Array.from(tabList.children).reduce((w, el) => w + el.offsetWidth, 0);
  tabBar.classList.toggle('tab-overflow', contentWidth > expandedAvail + 1);
}

/**
 * 将当前活动标签滚动到标签栏可视区域
 * 手动计算目标 scrollLeft 而非 scrollIntoView：避免影响页面级滚动，且可精确控制平滑/立即时机
 * @param {string} behavior - 滚动行为：'auto' 立即定位 / 'smooth' 平滑滚动
 */
function scrollActiveTabIntoView(behavior = 'auto') {
  const tabList = elements.tabList;
  if (!tabList) return;
  const activeEl = tabList.querySelector('.tab.active');
  if (!activeEl) return;

  const maxScroll = tabList.scrollWidth - tabList.clientWidth;
  if (maxScroll <= 0) return;

  // 用 getBoundingClientRect 计算标签相对滚动内容的偏移（offsetLeft 会受 offsetParent 影响）
  const listRect = tabList.getBoundingClientRect();
  const tabRect = activeEl.getBoundingClientRect();
  const left = tabRect.left - listRect.left + tabList.scrollLeft;
  const right = left + tabRect.width;
  const viewLeft = tabList.scrollLeft;
  const viewRight = viewLeft + tabList.clientWidth;

  let target;
  if (left < viewLeft) {
    target = left; // 活动标签在视口左侧之外
  } else if (right > viewRight) {
    target = right - tabList.clientWidth; // 活动标签在视口右侧之外
  } else {
    return; // 已完全可见
  }
  target = Math.max(0, Math.min(target, maxScroll));
  tabList.scrollTo({ left: target, behavior });
}

/**
 * 绑定标签栏滚动按钮的长按连续滚动
 * mousedown 立即滚一步，按住 350ms 后进入连续步进；松开/移出/滚到边缘停止，移回恢复
 * @param {HTMLButtonElement} btn - 滚动按钮元素
 * @param {number} direction - 滚动方向：-1 向左 / 1 向右
 */
function bindTabScrollButton(btn, direction) {
  if (!btn) return;
  let pressTimer = null;
  let scrollTimer = null;
  let pressing = false;

  /** 清理全部定时器 */
  const stopTimers = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; }
  };

  /** 该方向是否还有可滚动余量（到边缘自动停） */
  const canScroll = () => {
    const tabList = elements.tabList;
    const maxScroll = tabList.scrollWidth - tabList.clientWidth;
    return direction < 0 ? tabList.scrollLeft > 1 : tabList.scrollLeft < maxScroll - 1;
  };

  /** 启动连续滚动步进 */
  const startRepeat = () => {
    stopTimers();
    if (!canScroll()) return;
    scrollTimer = setInterval(() => {
      if (!canScroll()) { stopTimers(); return; }
      elements.tabList.scrollBy({ left: direction * 120, behavior: 'auto' });
    }, 80);
  };

  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // 阻止按住拖动触发文本选中/焦点迁移
    pressing = true;
    elements.tabList.scrollBy({ left: direction * 200, behavior: 'smooth' });
    pressTimer = setTimeout(startRepeat, 350);
  });

  // 移出按钮暂停连续滚动，按住状态保留，移回后恢复
  btn.addEventListener('mouseleave', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; }
  });

  btn.addEventListener('mouseenter', () => {
    if (pressing && !scrollTimer && !pressTimer) startRepeat();
  });

  // mouseup 绑在 window：指针移出按钮后松开也能收到
  window.addEventListener('mouseup', () => {
    pressing = false;
    stopTimers();
  });

  // 窗口失焦兜底清理，避免定时器在后台持续滚动
  window.addEventListener('blur', () => {
    pressing = false;
    stopTimers();
  });
}

/**
 * 重新渲染整个 Tab 栏
 * 用于固定/取消固定标签页后更新排序和样式
 * 固定标签排在最左侧，宽度缩小，显示固定图标
 */
function renderTabs() {
  const tabList = elements.tabList;
  // 全量重建会清空 innerHTML 使 scrollLeft 归零，先捕获后恢复
  const prevScrollLeft = tabList.scrollLeft;
  tabList.innerHTML = '';

  // 将 Tabs 分为固定和未固定两组，固定在前
  const pinnedTabs = [];
  const unpinnedTabs = [];
  state.tabs.forEach((tab, tabId) => {
    if (tab.pinned) {
      pinnedTabs.push([tabId, tab]);
    } else {
      unpinnedTabs.push([tabId, tab]);
    }
  });

  const sortedTabs = [...pinnedTabs, ...unpinnedTabs];

  sortedTabs.forEach(([tabId, tab]) => {
    // 如果已有 element，更新 class 后追加；否则需要重新创建
    let tabElement = tab.element;
    if (!tabElement) {
      // 重建 DOM element（防御性：正常流程 element 应始终存在）
      tabElement = createTabElement(tab);
      tab.element = tabElement;
    }

    // 更新 class：固定标签添加 pinned 样式
    tabElement.className = 'tab' + (tabId === state.activeTabId ? ' active' : '') + (tab.pinned ? ' tab-pinned' : '');
    // 无障碍：标记选中状态
    tabElement.setAttribute('aria-selected', tabId === state.activeTabId ? 'true' : 'false');
    tabList.appendChild(tabElement);
  });

  // 恢复滚动位置；pin/unpin 重排可能使活动标签移出视口，立即定位回可见区
  tabList.scrollLeft = prevScrollLeft;
  updateTabScrollState();
  scrollActiveTabIntoView('auto');
}

/**
 * 初始化应用
 */
async function init() {
  console.log('[Realm Renderer] 初始化...');

  // 获取当前窗口 ID（用于跨窗口拖拽判断自身身份）
  try {
    state.windowId = await window.realmAPI.getWindowId();
  } catch (err) {
    console.error('[Realm Renderer] 获取窗口 ID 失败:', err);
  }

  // 恢复侧边栏显示状态（默认展开），尽早应用避免启动闪烁
  // HTML 中 sidebar 默认带 hidden，只有明确需要展开时才移除
  try {
    const settings = await window.realmAPI.getSettings();
    if (settings['sidebarVisible'] === false) {
      state.sidebarVisible = false;
      document.body.classList.add('sidebar-hidden');
      // sidebar 保持 HTML 默认的 hidden，无需额外操作
    } else {
      state.sidebarVisible = true;
      elements.sidebar.classList.remove('hidden');
    }

    // 多媒体播放器开关初始化（per D-12）
    const mediaPlayerEnabled = settings.mediaPlayer && settings.mediaPlayer.enabled;
    updateMediaPlayerVisibility(mediaPlayerEnabled);

    // 主题初始化（默认浅色）
    applyTheme(settings.theme || 'light');
  } catch (err) {
    console.error('[Realm Renderer] 恢复 Sidebar 状态失败:', err);
    // 默认展开：移除 hidden
    state.sidebarVisible = true;
    elements.sidebar.classList.remove('hidden');
  }

  // 获取内部页面服务器端口和 API token（用于加载 realm:// 页面）
  const realmInfo = await window.realmAPI.getRealmPort();
  state.realmPort = realmInfo.port;
  state.realmToken = realmInfo.token;
  console.log('[Realm Renderer] 内部页面服务器端口:', state.realmPort);

  // 预加载模型选择器数据：让工具栏按钮启动即显示上次选择的模型，
  // 否则要点开下拉一次（触发数据加载）后才显示
  loadModelSelectorData();

  // 加载容器列表
  await loadContainers();

  // 渲染容器快捷入口
  renderContainerShortcuts();

  // 恢复保存的 Tab 列表
  await restoreTabs();

  // 刷新 Cookie 快速保存按钮初始状态
  updateQuickSaveBtnState();

  // 设置事件监听
  setupEventListeners();

  // 监听容器切换事件
  window.realmAPI.onContainerSwitched(handleContainerSwitched);

  // 监听主进程转发的「在指定容器新建 Tab」事件（WR-1）
  window.realmAPI.onOpenUrlInTab(handleOpenUrlInTab);

  // 监听退出确认提示：第一次 Cmd+Q 仅提示，3 秒内再按一次才退出
  window.realmAPI.onShowQuitHint(() => {
    showToast('再按一次 ⌘Q 退出应用', 'info');
  });

  // 监听主进程的 Tab 回收事件（WR-4）
  window.realmAPI.onTabRecycled(handleTabRecycled);

  // 监听 AI 工具发起的关闭标签页请求（close_tab 工具）
  window.realmAPI.onTabAiClose(handleAiCloseTab);

  // 监听 AI 工具发起的切换标签页请求（switch_tab 工具）
  window.realmAPI.onTabAiSwitch(handleAiSwitchTab);

  // 注册右键菜单动作回调
  window.realmAPI.onContextMenuAction(handleContextMenuAction);

  // 监听跨窗口 Tab 事件（Phase 36 Plan 03）
  // 主进程在跨窗口 Tab 移动或新窗口创建时推送这些事件
  if (window.realmAPI.onTabCreated) {
    window.realmAPI.onTabCreated(handleTabCreatedFromMain);
  }
  if (window.realmAPI.onTabRemoved) {
    window.realmAPI.onTabRemoved(handleTabRemovedFromMain);
  }
  if (window.realmAPI.onTabSwitched) {
    window.realmAPI.onTabSwitched((data) => {
      if (data && data.tabId) {
        switchTab(data.tabId);
      }
    });
  }

  // 初始化收藏栏
  if (window.bookmarksBar) {
    try {
      const { visible } = await window.realmAPI.bookmarksBar.getVisibility();
      if (elements.bookmarksBar) {
        elements.bookmarksBar.style.display = visible ? '' : 'none';
      }
      if (visible) {
        await window.bookmarksBar.load();
      }
      // 初始化收藏栏事件和 ResizeObserver
      window.bookmarksBar.init();
    } catch (err) {
      console.error('[Realm Renderer] 收藏栏初始化失败:', err);
    }
  }

  // 监听收藏栏右键菜单行为事件
  window.realmAPI.onIpcMessage('bookmarks-bar:refresh', () => {
    if (window.bookmarksBar) window.bookmarksBar.load();
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:visibility-changed', (data) => {
    const bookmarksBar = document.getElementById('bookmarksBar');
    if (bookmarksBar) bookmarksBar.style.display = data.visible ? '' : 'none';
    if (data.visible && window.bookmarksBar) window.bookmarksBar.load();
    // 同步主窗口内设置开关
    const toggle = document.getElementById('showBookmarksBar');
    if (toggle) toggle.checked = data.visible;
    // 同步所有 settings webview 内的开关
    const webviews = document.querySelectorAll('webview');
    webviews.forEach((wv) => {
      try {
        const url = wv.getURL ? wv.getURL() : (wv.src || '');
        if (url && url.includes('/settings')) {
          wv.executeJavaScript(`
            (function() {
              const toggle = document.getElementById('showBookmarksBar');
              if (toggle) toggle.checked = ${data.visible};
            })();
          `).catch(() => {});
        }
      } catch (e) {
        // webview 可能已销毁
      }
    });
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:navigate', (data) => {
    if (data.newTab) {
      // 统一导航入口（含分配规则匹配）
      openUrl(data.url, { disposition: 'new-tab' });
    }
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:edit-bookmark', async (data) => {
    // 设置编辑状态，然后弹出收藏编辑面板。
    // 该入口的 payload 只有 {id, url, title}（main.js 从收藏栏右键菜单发出，不含
    // 文件夹），故按 url 回查数据库补齐 —— 以 favoritesCheck 当唯一读源，不新增 IPC
    let folderId = 0;
    try {
      const record = await window.realmAPI.favoritesCheck(data.url);
      if (record) folderId = record.folder_id || 0;
    } catch (err) {
      console.error('[Realm Renderer] 查询收藏所在文件夹失败:', err);
    }
    state.isCurrentPageBookmarked = true;
    state.currentBookmarkId = data.id;
    state.currentBookmarkTitle = data.title;
    state.currentBookmarkFolderId = folderId;
    showBookmarkEditPanel(data.title, data.url, true, folderId);
  });

  /**
   * 显示简单的文本输入对话框（Electron 不支持 window.prompt）
   * @param {string} title - 对话框标题
   * @param {string} [defaultValue=''] - 默认值
   * @returns {Promise<string|null>} 用户输入的值，取消则返回 null
   */
  function showInputDialog(title, defaultValue = '') {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'modal';
      dialog.style.cssText = 'padding:20px;border-radius:8px;border:none;min-width:300px;background:#2d2d2d;color:#fff;';

      const heading = document.createElement('h3');
      heading.textContent = title;
      heading.style.cssText = 'margin:0 0 16px 0;font-size:16px;';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue;
      input.style.cssText = 'width:100%;padding:8px;margin-bottom:16px;border-radius:4px;border:1px solid #444;background:#1e1e1e;color:#fff;box-sizing:border-box;';

      const btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.style.cssText = 'padding:6px 16px;border-radius:4px;border:none;background:#444;color:#fff;cursor:pointer;';

      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '确定';
      confirmBtn.style.cssText = 'padding:6px 16px;border-radius:4px;border:none;background:#4a9eff;color:#fff;cursor:pointer;';

      btnWrap.appendChild(cancelBtn);
      btnWrap.appendChild(confirmBtn);
      dialog.appendChild(heading);
      dialog.appendChild(input);
      dialog.appendChild(btnWrap);
      document.body.appendChild(dialog);

      dialog.showModal();
      input.focus();
      input.select();

      const cleanup = (value) => {
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
        resolve(value);
      };

      confirmBtn.addEventListener('click', () => cleanup(input.value));
      cancelBtn.addEventListener('click', () => cleanup(null));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') cleanup(input.value);
        if (e.key === 'Escape') cleanup(null);
      });
      dialog.addEventListener('close', () => cleanup(null));
    });
  }

  window.realmAPI.onIpcMessage('bookmarks-bar:rename-folder', async (data) => {
    const newName = await showInputDialog('重命名文件夹', data.name || '');
    if (newName && newName.trim() && newName.trim() !== data.name) {
      window.realmAPI.renameFavoriteFolder(data.id, newName.trim()).then(() => {
        showToast('文件夹已重命名', 'success');
        if (window.bookmarksBar) window.bookmarksBar.load();
      }).catch((err) => {
        console.error('[Realm] 重命名文件夹失败:', err);
        showToast('重命名失败', 'error');
      });
    }
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:add-bookmark', (data) => {
    // 将当前页面添加到指定文件夹
    const activeTab = state.tabs.get(state.activeTabId);
    if (!activeTab || !activeTab.url) {
      showToast('当前标签页无有效页面', 'error');
      return;
    }
    const title = activeTab.title || activeTab.url;
    const faviconUrl = activeTab.faviconUrl || '';
    // 直接带 folderId 入库。旧实现是「先 add 再 moveFavorite」，那条路径有两个毛病：
    // folderId=0 会被 `if (data.folderId)` 跳过而不落该文件夹，
    // 且 moveFavorite 只写 folder_id、不写 sort_order ⇒ 落位不可预期
    const folderId = data.folderId || 0;
    window.realmAPI.favoritesAdd({ url: activeTab.url, title, faviconUrl, folderId }).then((result) => {
      if (result.error) {
        showToast(result.message || '添加失败', 'error');
        return;
      }
      state.isCurrentPageBookmarked = true;
      state.currentBookmarkId = result.id;
      state.currentBookmarkTitle = title;
      state.currentBookmarkFolderId = folderId;
      updateStarButton(true);
      showToast('已添加书签', 'success');
      if (window.bookmarksBar) window.bookmarksBar.load();
    }).catch((err) => {
      console.error('[Realm] 添加书签失败:', err);
      showToast('添加失败', 'error');
    });
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:add-folder', async (data) => {
    const name = await showInputDialog('新建文件夹');
    if (name && name.trim()) {
      window.realmAPI.createFavoriteFolder(name.trim(), data.parentId || 0).then(() => {
        showToast('文件夹已创建', 'success');
        if (window.bookmarksBar) window.bookmarksBar.load();
      }).catch((err) => {
        console.error('[Realm] 创建文件夹失败:', err);
        showToast('创建失败', 'error');
      });
    }
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:open-all', (data) => {
    // 打开文件夹中的所有书签（统一导航入口）
    // 保持既有行为：整组收藏固定在当前容器（explicitContainerId），不给规则
    // 逐个分发（会打散一组收藏）；background-tab 避免逐个切前台闪烁，
    // 完成后切到首个新 tab
    if (data.folderId) {
      window.realmAPI.bookmarksBar.listFavorites(data.folderId).then(async (favorites) => {
        if (favorites && favorites.length > 0) {
          const openedTabIds = [];
          for (const fav of favorites) {
            if (fav.url) {
              const result = await openUrl(fav.url, {
                disposition: 'background-tab',
                explicitContainerId: state.currentContainer,
              });
              if (result.tabId) openedTabIds.push(result.tabId);
            }
          }
          if (openedTabIds.length > 0) {
            await switchTab(openedTabIds[0]);
          }
        }
      });
    }
  });

  console.log('[Realm Renderer] 初始化完成');

  // 初始化窗口标题
  updateWindowTitle();

  // 初始化 AI 事件流监听
  handleAIStream();

  // 技能集快照同步（48 D-17 / P8 触发点）：广播到达即**无条件重拉快照**（不再因面板关闭
  // 早退 —— 快照是 `/` 面板首帧的同步数据源，陈旧会让面板闪一下空态或显示上次投影）；
  // 处理器体只调零 IO 的读取投影，**绝不**触发 refreshSkills —— 「广播 → 刷新 → 再广播」
  // 会自激（P-48-06 约束不变）
  window.realmAPI.onIpcMessage('skills:changed', () => {
    pullAiSkillsSnapshot();
  });
  // 启动预热：面板首帧用内存快照同步渲染，预热让首次打开不出现空态闪烁
  pullAiSkillsSnapshot();

  // 初始拉取一次上下文用量（圆环按钮显示当前对话状态）
  refreshContextUsage();

  // 恢复 AI 面板开关状态（D-04：electron-store 持久化；默认收起）
  try {
    const settings = await window.realmAPI.getSettings();
    if (settings['aiPanelOpen']) {
      state.aiPanelOpen = true;
      elements.aiPanel.classList.remove('hidden');
      elements.aiPanelBtn.classList.add('active');
      loadAIPanelWidth();
    }
  } catch (err) {
    console.error('[Realm Renderer] 恢复 AI 面板状态失败:', err);
  }

  // 初始渲染空状态引导文案
  renderAIMessages();

  // 初始化媒体面板（监听更新 + 初始加载）
  initMediaPanel();

  // 初始化媒体任务角标（Phase 44 D-26：活跃录制/转封装任务被动提醒）
  initMediaTaskBadge();

  // 初始化媒体任务终态 toast（Phase 44 G-44-5：convert/record 终态应用内提示）
  initMediaTaskToast();
  initCacheWarningToast();

  // 初始化下载管理 UI
  initDownloads();

  // 监听设置变更事件
  window.realmAPI.onSettingsUpdated(async (changedKeys) => {
    // 主题变更
    if (changedKeys.includes('theme')) {
      try {
        const settings = await window.realmAPI.getSettings();
        applyTheme(settings.theme || 'light');
      } catch (err) {
        console.warn('[Realm Renderer] 应用主题设置变更失败:', err.message);
      }
    }
    // 多媒体开关状态（closing UAT gap G-29-6）
    if (changedKeys.some((key) => key.startsWith('mediaPlayer'))) {
      try {
        const settings = await window.realmAPI.getSettings();
        const mediaPlayerEnabled = settings.mediaPlayer && settings.mediaPlayer.enabled;
        updateMediaPlayerVisibility(mediaPlayerEnabled);
      } catch (err) {
        console.warn('[Realm Renderer] 应用多媒体设置变更失败:', err.message);
      }
    }
  });

  // 监听系统主题变化（当选择"跟随系统"时）
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    try {
      const settings = await window.realmAPI.getSettings();
      if (settings.theme === 'system') {
        applyTheme('system');
      }
    } catch (err) {
      console.warn('[Realm Renderer] 应用系统主题变化失败:', err.message);
    }
  });

  // 初始化工具栏溢出收起
  initToolbarOverflow();
}

/**
 * 应用主题
 * @param {string} theme - 主题值：'light', 'dark', 'system'
 */
function applyTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  } else {
    document.documentElement.dataset.theme = theme || 'light';
  }
}

/**
 * 加载容器列表
 */
async function loadContainers() {
  state.containers = await window.realmAPI.getContainers();
  state.currentContainer = await window.realmAPI.getCurrentContainer();

  renderContainerList();
  updateContainerIndicator();
  // WR-12：容器增删改后同步刷新新标签页的快速访问入口，避免 UI 停滞到下次启动
  renderContainerShortcuts();
}

/**
 * 渲染侧边栏容器列表
 */
function renderContainerList() {
  // WR-13：DOM 构建 + textContent。
  // 容器名称/图标为用户输入，拼入 innerHTML 构成 XSS 注入面；
  // 颜色值经 style 属性字符串拼接可逃逸属性，统一改为 DOM 属性赋值
  // （主进程 validateContainerConfig 另有颜色格式白名单做纵深防御）
  elements.containerList.innerHTML = '';

  state.containers.forEach(container => {
    const isDefault = container.id === 'default';

    const item = document.createElement('div');
    item.className = 'container-item' + (container.id === state.currentContainer ? ' active' : '');
    item.dataset.containerId = container.id;

    // 设置可拖拽（默认容器不可拖拽）
    item.draggable = !isDefault;

    // 创建拖拽手柄（默认容器不显示）
    const dragHandle = document.createElement('div');
    dragHandle.className = 'container-drag-handle' + (isDefault ? ' disabled' : '');
    dragHandle.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>';

    const info = document.createElement('div');
    info.className = 'container-info';

    const name = document.createElement('div');
    name.className = 'container-name';
    name.textContent = '';
    const icon = renderContainerIcon(container, 16);
    icon.style.color = container.color;
    name.appendChild(icon);
    name.appendChild(document.createTextNode(` ${container.name}`));

    const status = document.createElement('div');
    status.className = 'container-status';
    status.textContent = container.id === state.currentContainer ? '当前' : '';

    info.appendChild(name);
    info.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'container-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.dataset.action = 'edit';
    editBtn.title = '编辑';
    editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.disabled = isDefault;
    deleteBtn.title = isDefault ? '默认容器不可删除' : '删除';
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>';

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(dragHandle);
    item.appendChild(info);
    item.appendChild(actions);

    // 拖拽事件
    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', container.id);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      elements.containerList.querySelectorAll('.container-item').forEach(el => {
        el.classList.remove('drag-over');
      });
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const draggingItem = elements.containerList.querySelector('.dragging');
      if (draggingItem === item) return;

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const isAbove = e.clientY < midY;

      elements.containerList.querySelectorAll('.container-item').forEach(el => {
        el.classList.remove('drag-over');
      });
      if (isAbove) {
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');

      const fromId = e.dataTransfer.getData('text/plain');
      const toId = item.dataset.containerId;
      if (fromId === toId) return;

      const draggingItem = elements.containerList.querySelector(`[data-container-id="${fromId}"]`);
      if (!draggingItem) return;

      // 根据位置决定插入到目标前面还是后面
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        item.parentNode.insertBefore(draggingItem, item);
      } else {
        item.parentNode.insertBefore(draggingItem, item.nextSibling);
      }

      // 检查默认容器是否在第一个位置，如果不是则撤销移动
      const firstItem = elements.containerList.firstElementChild;
      if (!firstItem || firstItem.dataset.containerId !== 'default') {
        // 撤销移动，恢复原位
        loadContainers();
        return;
      }

      // 获取新顺序并持久化
      const orderedIds = Array.from(elements.containerList.children)
        .map(el => el.dataset.containerId);
      window.realmAPI.reorderContainers(orderedIds).catch(err => {
        console.error('[Realm Renderer] 保存容器顺序失败:', err);
        loadContainers(); // 失败时重新加载
      });

      // 更新本地状态
      state.containers.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));

      // 强制浏览器重绘以更新 hover 状态
      elements.containerList.style.pointerEvents = 'none';
      requestAnimationFrame(() => {
        elements.containerList.style.pointerEvents = '';
      });
    });

    elements.containerList.appendChild(item);
  });
}

/**
 * 更新容器指示器
 */
function updateContainerIndicator() {
  const current = state.containers.find(c => c.id === state.currentContainer);
  if (current) {
    updateIndicatorIcon(current);
    elements.indicatorText.textContent = current.name;
  }
}

/**
 * 更新指示器图标
 * @param {Object} container - 容器对象
 */
function updateIndicatorIcon(container) {
  const indicatorIcon = elements.indicatorIcon;
  if (!indicatorIcon) return;
  indicatorIcon.textContent = '';
  const icon = renderContainerIcon(container, 16);
  icon.style.color = container.color;
  indicatorIcon.appendChild(icon);
}

/**
 * 切换容器
 */
async function switchContainer(containerId) {
  if (containerId === state.currentContainer) return;

  const success = await window.realmAPI.switchContainer(containerId);
  if (success) {
    state.currentContainer = containerId;
    renderContainerList();
    updateContainerIndicator();

    // CR-6 修复：不在此处本地 createTab。
    // 新 Tab 统一由主进程推送的 container-switched 事件（handleContainerSwitched）创建，
    // 避免「本地创建 + 事件再创建」双路径导致每次切换产生两个重复 Tab。

    console.log(`[Realm] 切换到容器: ${containerId}`);
    // 容器变化影响 Cookie 比较对象，刷新快速保存按钮状态
    updateQuickSaveBtnState();

    // 重置媒体面板状态并重新加载新容器的媒体列表
    state.mediaPanelOpen = false;
    state.mediaItems = [];
    elements.mediaPanel.classList.add('hidden');
    elements.mediaPanelBtn.classList.remove('active');
    updateMediaBadge();
    loadMediaList();
  }
}

/**
 * 显示删除确认 Modal
 * 查找容器信息，更新预览内容，打开 Modal
 * @param {string} containerId - 待删除的容器 ID
 */
function showDeleteConfirmModal(containerId) {
  const container = state.containers.find(c => c.id === containerId);
  if (!container || container.id === 'default') return;

  state.deletingContainerId = containerId;

  // 动态填充容器预览
  const previewInfo = document.createElement('span');
  previewInfo.className = 'preview-info';
  previewInfo.textContent = '';
  const icon = renderContainerIcon(container, 16);
  icon.style.color = container.color;
  previewInfo.appendChild(icon);
  previewInfo.appendChild(document.createTextNode(` ${container.name}`));

  elements.deleteContainerPreview.innerHTML = '';
  elements.deleteContainerPreview.appendChild(previewInfo);

  // AI 记忆删除提示（D-05 / UI-SPEC Copywriting Contract：用户知情，无需二次确认）
  const aiMemoryWarning = document.createElement('p');
  aiMemoryWarning.className = 'warning-text';
  aiMemoryWarning.textContent = '该容器的 AI 记忆将一并删除';
  elements.deleteContainerPreview.appendChild(aiMemoryWarning);

  elements.deleteConfirmModal.showModal();
}

/**
 * 确认删除容器
 * 调用 realmAPI.deleteContainer，删除活跃容器时自动切换到默认容器
 * 删除前先关闭该容器所有 Tab（销毁其 webview）：
 * 存活 webview 的 guest 进程持有 Partitions 目录句柄并持续写入，
 * 不先销毁时主进程 rmSync 后目录会被立即重建
 */
async function confirmDeleteContainer() {
  const containerId = state.deletingContainerId;
  if (!containerId) return;

  try {
    // 先关闭属于该容器的所有 Tab（closeTab 内含 destroyWebview）
    // 关闭标签页后，会自动激活相邻的标签页，并更新 state.currentContainer
    const tabIdsToClose = [];
    state.tabs.forEach((tab, tabId) => {
      if (tab.containerId === containerId) {
        tabIdsToClose.push(tabId);
      }
    });
    for (const tabId of tabIdsToClose) {
      await closeTab(tabId);
    }

    // 保存当前容器 ID，因为 loadContainers 会从主进程获取并覆盖
    const currentContainer = state.currentContainer;

    const result = await window.realmAPI.deleteContainer(containerId);
    if (result.success) {
      // 重新加载容器列表
      state.containers = await window.realmAPI.getContainers();
      // 恢复当前容器 ID
      state.currentContainer = currentContainer;
      renderContainerList();
      updateContainerIndicator();
      renderContainerShortcuts();
      elements.deleteConfirmModal.close();
      showToast('容器已删除', 'success');
    } else {
      console.error('[Realm] 删除容器失败:', result.message);
      showToast('删除失败: ' + (result.message || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('[Realm] 删除容器异常:', error);
    showToast('删除失败，请重试', 'error');
  }

  state.deletingContainerId = null;
}

/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 * @param {string} type - 提示类型：'success' 或 'error'
 * @param {Object} [opts] - 可选配置（Phase 44 G-44-5 扩展，缺省行为不变）
 * @param {Function} [opts.onClick] - 点击 toast 时执行的回调（如定位产物）
 * @param {number} [opts.duration=3000] - 自动消失毫秒数
 */
function showToast(message, type, opts = {}) {
  const { onClick, duration = 3000 } = opts || {};

  // 移除已有的 toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  // 点击回调存在时标记可点击（.toast-clickable 恢复 pointer-events 并显示手型光标）
  if (typeof onClick === 'function') {
    toast.classList.add('toast-clickable');
    toast.addEventListener('click', () => onClick());
  }
  document.body.appendChild(toast);

  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // duration 毫秒后自动消失（缺省 3000）
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * 处理主进程转发的「在指定容器新建 Tab」事件（WR-1）
 * 触发场景：webview guest 的 window.open / target=_blank 被主进程
 * setWindowOpenHandler 拦截后转发（D-09：在来源容器新建 Tab）。
 * URL 来自 guest 页面，主进程已做 http(s) 白名单校验，此处纵深防御再校验一次（WR-9）。
 * 容器优先级：分配规则匹配 > 来源 webview 所在容器 > 当前激活容器。
 * @param {{url: string, containerId: string|null, guestId: number|undefined}} data - 事件数据
 */
function handleOpenUrlInTab(data) {
  if (!data || typeof data.url !== 'string' || !/^(https?|realm):\/\//i.test(data.url)) {
    console.warn('[Realm] 拒绝非 http(s)/realm 的新建 Tab 请求:', data && data.url);
    return;
  }

  // 分配规则匹配的容器优先
  let containerId = data.containerId || null;

  // 无规则匹配：按来源 webview 的 partition 反查容器
  // （主进程 session.getPartition() 在 Electron 32 下不可靠，webview 元素属性才是权威来源）
  if (!containerId && data.guestId != null) {
    const prefix = 'persist:container-';
    for (const webview of state.webviews.values()) {
      try {
        if (typeof webview.getWebContentsId === 'function'
            && webview.getWebContentsId() === data.guestId
            && (webview.partition || '').startsWith(prefix)) {
          containerId = webview.partition.slice(prefix.length);
          break;
        }
      } catch { /* webview 未就绪时跳过 */ }
    }
  }

  // 统一导航入口执行：resolvedContainerId 非空时作为 explicitContainerId
  // （主进程 setWindowOpenHandler/will-navigate 已 matchUrl，null = 无匹配，
  // renderer 不重复查规则）；为 null 时 openUrl 内部再走一次 matchRule 兜底
  openUrl(data.url, { disposition: 'new-tab', explicitContainerId: containerId });
}

/**
 * 处理容器切换事件（来自主进程）
 */
function handleContainerSwitched(data) {
  state.currentContainer = data.containerId;
  renderContainerList();
  updateContainerIndicator();

  // 创建新 Tab
  createTab(data.containerId);

  // 容器切换后更新窗口标题
  updateWindowTitle();
}

/**
 * 显示创建容器 Modal
 * 重置表单、设置默认颜色和图标、显示 Modal
 */
function showCreateContainerModal() {
  state.editingContainerId = null;
  elements.containerNameInput.value = '';
  state.selectedColor = '#3B82F6';
  state.selectedIcon = 'fingerprint';
  elements.containerModalTitle.textContent = '新建容器';
  elements.saveContainerBtn.textContent = '创建容器';
  elements.nameError.classList.remove('visible');
  // 重置扩展属性字段
  elements.containerEmailInput.value = '';
  elements.containerPhoneInput.value = '';
  elements.containerNotesInput.value = '';
  elements.emailError.classList.remove('visible');
  elements.phoneError.classList.remove('visible');
  elements.notesError.classList.remove('visible');
  // 重置环境变量
  state.containerEnvVars = [];
  resetEnvVarsUI();
  updateColorSelection();
  updateSymbolSelection();
  elements.containerModal.showModal();
}

/**
 * 显示编辑容器 Modal
 * 预填容器名称、颜色、图标
 * @param {string} containerId - 容器 ID
 */
function showEditContainerModal(containerId) {
  const container = state.containers.find(c => c.id === containerId);
  if (!container) return;

  state.editingContainerId = containerId;
  elements.containerNameInput.value = container.name;
  state.selectedColor = container.color;
  state.selectedIcon = container.icon;
  elements.containerModalTitle.textContent = '编辑容器';
  elements.saveContainerBtn.textContent = '保存';
  elements.nameError.classList.remove('visible');
  // 填充扩展属性字段
  elements.containerEmailInput.value = container.email || '';
  elements.containerPhoneInput.value = container.phone || '';
  elements.containerNotesInput.value = container.notes || '';
  elements.emailError.classList.remove('visible');
  elements.phoneError.classList.remove('visible');
  elements.notesError.classList.remove('visible');
  // 加载环境变量
  state.containerEnvVars = (container.envVars || []).map(v => ({ ...v }));
  resetEnvVarsUI();
  renderEnvVars();
  updateColorSelection();
  updateSymbolSelection();
  elements.containerModal.showModal();
}

/**
 * 更新颜色选择器选中状态
 */
function updateColorSelection() {
  const colorOptions = elements.colorPicker.querySelectorAll('.color-option');
  colorOptions.forEach(option => {
    option.classList.remove('selected');
    if (option.dataset.color === state.selectedColor) {
      option.classList.add('selected');
    }
  });
}

/**
 * 更新符号选择器选中状态
 */
function updateSymbolSelection() {
  const symbolPicker = document.getElementById('symbolPicker');
  if (!symbolPicker) return;
  const symbolOptions = symbolPicker.querySelectorAll('.symbol-option');
  symbolOptions.forEach(option => {
    option.classList.remove('selected');
    if (option.dataset.icon === state.selectedIcon) {
      option.classList.add('selected');
    }
  });
}

/**
 * 渲染容器图标 DOM 元素（SVG symbol）
 * @param {Object} container - 容器配置
 * @param {number} [size=20] - 图标尺寸
 * @returns {SVGElement} 图标 DOM
 */
function renderContainerIcon(container, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.style.verticalAlign = 'middle';
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#realm-icon-${container.icon}`);
  svg.appendChild(use);
  return svg;
}

// ==================== 容器环境变量 ====================

/**
 * 重置环境变量 UI 到初始状态
 */
function resetEnvVarsUI() {
  elements.envVarsToggle.classList.remove('expanded');
  elements.envVarsPanel.style.display = 'none';
  elements.envVarsAddArea.style.display = 'none';
  elements.envVarAddBtn.style.display = '';
  elements.envVarKeyInput.value = '';
  elements.envVarValueInput.value = '';
  elements.envVarSuggestions.style.display = 'none';
}

/**
 * 渲染环境变量列表
 */
function renderEnvVars() {
  elements.envVarsList.innerHTML = '';

  if (state.containerEnvVars.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'env-vars-empty';
    empty.textContent = '暂无环境变量';
    elements.envVarsList.appendChild(empty);
    return;
  }

  state.containerEnvVars.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'env-var-row';

    const keyLabel = document.createElement('span');
    keyLabel.className = 'env-var-key';
    if (PRESET_ENV_KEYS.some(p => p.key === item.key)) {
      keyLabel.classList.add('preset');
    }
    keyLabel.textContent = item.key;
    keyLabel.title = item.key;

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'env-var-value';
    valueInput.value = item.value;
    valueInput.placeholder = '变量值';
    valueInput.addEventListener('change', () => {
      updateEnvVarValue(item.key, valueInput.value);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'env-var-delete';
    deleteBtn.title = '删除';
    deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
    deleteBtn.addEventListener('click', () => {
      deleteEnvVar(item.key);
    });

    row.appendChild(keyLabel);
    row.appendChild(valueInput);
    row.appendChild(deleteBtn);
    elements.envVarsList.appendChild(row);
  });
}

/**
 * 显示添加环境变量区域
 */
function showEnvVarAddArea() {
  elements.envVarsAddArea.style.display = 'flex';
  elements.envVarAddBtn.style.display = 'none';
  elements.envVarKeyInput.value = '';
  elements.envVarValueInput.value = '';
  elements.envVarSuggestions.style.display = 'none';
  elements.envVarKeyInput.focus();
}

/**
 * 隐藏添加环境变量区域
 */
function hideEnvVarAddArea() {
  elements.envVarsAddArea.style.display = 'none';
  elements.envVarAddBtn.style.display = '';
  elements.envVarKeyInput.value = '';
  elements.envVarValueInput.value = '';
  elements.envVarSuggestions.style.display = 'none';
}

/**
 * 处理 key 输入变化，渲染下拉建议
 */
function handleEnvVarKeyInput() {
  const query = elements.envVarKeyInput.value.trim().toLowerCase();
  elements.envVarSuggestions.innerHTML = '';

  if (!query) {
    elements.envVarSuggestions.style.display = 'none';
    return;
  }

  // 模糊匹配预设 key（key 和 description）
  const matches = PRESET_ENV_KEYS.filter(p => {
    return p.key.toLowerCase().includes(query) || p.description.toLowerCase().includes(query);
  }).slice(0, 10);

  // 排除已添加的预设 key
  const existingKeys = new Set(state.containerEnvVars.map(v => v.key));
  const availableMatches = matches.filter(p => !existingKeys.has(p.key));

  // 添加自定义输入项
  const hasExactMatch = availableMatches.some(p => p.key.toLowerCase() === query);
  if (!hasExactMatch) {
    availableMatches.push({ key: elements.envVarKeyInput.value.trim(), description: '自定义变量', custom: true });
  }

  if (availableMatches.length === 0) {
    elements.envVarSuggestions.style.display = 'none';
    return;
  }

  availableMatches.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'env-var-suggestion' + (item.custom ? ' custom' : '');
    if (index === 0) div.classList.add('active');

    const keySpan = document.createElement('span');
    keySpan.className = 'suggestion-key';
    keySpan.textContent = item.key;

    const descSpan = document.createElement('span');
    descSpan.className = 'suggestion-desc';
    descSpan.textContent = item.description;

    div.appendChild(keySpan);
    div.appendChild(descSpan);
    div.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectEnvVarKey(item.key);
    });
    div.addEventListener('mouseenter', () => {
      elements.envVarSuggestions.querySelectorAll('.env-var-suggestion').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
    });

    elements.envVarSuggestions.appendChild(div);
  });

  elements.envVarSuggestions.style.display = 'block';
}

/**
 * 选中 key，填充输入框并聚焦 value
 * @param {string} key
 */
function selectEnvVarKey(key) {
  elements.envVarKeyInput.value = key;
  elements.envVarSuggestions.style.display = 'none';
  elements.envVarValueInput.focus();
}

/**
 * 确认添加环境变量
 */
function confirmAddEnvVar() {
  const key = elements.envVarKeyInput.value.trim();
  const value = elements.envVarValueInput.value;

  if (!key) {
    showToast('变量名不能为空', 'error');
    return;
  }

  if (state.containerEnvVars.some(v => v.key === key)) {
    showToast('变量名已存在', 'error');
    return;
  }

  state.containerEnvVars.push({ key, value });
  renderEnvVars();
  hideEnvVarAddArea();
}

/**
 * 删除环境变量
 * @param {string} key
 */
function deleteEnvVar(key) {
  state.containerEnvVars = state.containerEnvVars.filter(v => v.key !== key);
  renderEnvVars();
}

/**
 * 更新环境变量值
 * @param {string} key
 * @param {string} value
 */
function updateEnvVarValue(key, value) {
  const item = state.containerEnvVars.find(v => v.key === key);
  if (item) {
    item.value = value;
  }
}

/**
 * Cookie 管理状态
 */
const cookieState = {
  source: 'session', // 'session' 或 'file'
  filter: 'subdomain', // 'all', 'subdomain', 'exact'
  currentDomain: '', // 当前标签页域名
  allCookies: [], // 所有 Cookie 数据
  filteredCookies: [], // 过滤后的 Cookie
  page: 1, // 当前页码
  pageSize: 25, // 每页数量
  editingCookie: null, // 正在编辑的 Cookie
};

/**
 * 显示 Cookie 管理对话框
 */
async function showCookiesModal() {
  const current = state.containers.find(c => c.id === state.currentContainer);
  elements.cookiesModalTitle.textContent = current?.name || '未知';

  // 获取当前标签页域名
  const activeTab = state.tabs.get(state.activeTabId);
  if (activeTab && activeTab.url) {
    try {
      const url = new URL(activeTab.url);
      cookieState.currentDomain = url.hostname;
    } catch {
      cookieState.currentDomain = '';
    }
  } else {
    cookieState.currentDomain = '';
  }

  // 重置状态
  cookieState.page = 1;
  cookieState.source = 'session';
  cookieState.filter = 'subdomain';

  // 更新标签页选中状态
  updateSourceTabUI();
  updateFilterChipUI();

  await refreshCookiesList();
  elements.cookiesModal.showModal();
}

/**
 * 更新来源标签页 UI
 */
function updateSourceTabUI() {
  const tabs = document.querySelectorAll('.source-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.source === cookieState.source);
  });

  // File tab 是只读视图（磁盘快照），保存语义始终是 session → file，
  // 因此在 File tab 禁用保存按钮，避免用户误以为在做 file → file 操作
  const saveBtn = document.getElementById('saveCookiesBtn');
  if (saveBtn) {
    const isFileTab = cookieState.source === 'file';
    saveBtn.disabled = isFileTab;
    saveBtn.title = isFileTab
      ? 'File 标签页为只读视图，请切换到 Session 标签保存当前 Cookie'
      : '保存当前 Session Cookie 到文件';
  }
}

/**
 * 更新过滤选项 UI
 */
function updateFilterChipUI() {
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === cookieState.filter);
  });
}

/**
 * 处理来源标签页切换
 * @param {string} source - 'session' 或 'file'
 */
async function handleSourceTabSwitch(source) {
  if (cookieState.source === source) return;
  cookieState.source = source;
  cookieState.page = 1;
  updateSourceTabUI();
  await refreshCookiesList();
}

/**
 * 处理域名过滤切换
 * @param {string} filter - 'all', 'subdomain', 'exact'
 */
async function handleDomainFilter(filter) {
  if (cookieState.filter === filter) return;
  cookieState.filter = filter;
  cookieState.page = 1;
  updateFilterChipUI();
  applyDomainFilter();
  renderCookiesList();
  renderPagination();
}

/**
 * 应用域名过滤
 */
function applyDomainFilter() {
  const domain = cookieState.currentDomain;
  if (!domain || cookieState.filter === 'all') {
    cookieState.filteredCookies = [...cookieState.allCookies];
    return;
  }

  cookieState.filteredCookies = cookieState.allCookies.filter(cookie => {
    const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    if (cookieState.filter === 'exact') {
      return cookieDomain === domain;
    } else if (cookieState.filter === 'subdomain') {
      return cookieDomain === domain || domain.endsWith('.' + cookieDomain);
    }
    return true;
  });
}

/**
 * 刷新 Cookie 列表
 */
async function refreshCookiesList() {
  try {
    if (cookieState.source === 'session') {
      cookieState.allCookies = await window.realmAPI.getSessionCookies(state.currentContainer);
    } else {
      cookieState.allCookies = await window.realmAPI.getFileCookies(state.currentContainer);
    }
  } catch (error) {
    console.error('[Realm Renderer] 获取 Cookie 失败:', error);
    cookieState.allCookies = [];
  }

  applyDomainFilter();
  renderCookiesList();
  renderPagination();
}

/**
 * 渲染 Cookie 列表
 */
function renderCookiesList() {
  // 渲染前钳制页码：删除末页最后一条等场景下 filteredCookies 收缩后，
  // cookieState.page 可能超出新的总页数，导致切片为空且分页消失、无法返回
  const totalPages = Math.max(1, Math.ceil(cookieState.filteredCookies.length / cookieState.pageSize));
  if (cookieState.page > totalPages) cookieState.page = totalPages;

  const cookies = cookieState.filteredCookies;
  const start = (cookieState.page - 1) * cookieState.pageSize;
  const end = start + cookieState.pageSize;
  const pageCookies = cookies.slice(start, end);

  if (pageCookies.length === 0) {
    elements.cookiesList.innerHTML = '<div class="cookies-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg><p>暂无 Cookie</p></div>';
    return;
  }

  // 使用 DOM API + textContent 渲染（CR-3 修复）
  elements.cookiesList.innerHTML = '';
  pageCookies.forEach(cookie => {
    const item = document.createElement('div');
    item.className = 'cookie-item';

    const name = document.createElement('span');
    name.className = 'cookie-col-name';
    name.textContent = cookie.name;
    name.title = cookie.name;

    const value = document.createElement('span');
    value.className = 'cookie-col-value';
    value.textContent = cookie.value;
    value.title = cookie.value;

    const domain = document.createElement('span');
    domain.className = 'cookie-col-domain';

    const domainText = document.createElement('span');
    domainText.className = 'cookie-domain-text';
    domainText.textContent = cookie.domain;
    domain.appendChild(domainText);

    // host-only cookie（无 Domain 属性，仅匹配精确主机）加徽标，
    // 与带前导点的 domain cookie（匹配子域）视觉区分，避免看起来像重复行
    if (!cookie.domain.startsWith('.')) {
      const badge = document.createElement('span');
      badge.className = 'cookie-badge-hostonly';
      badge.textContent = 'host-only';
      badge.title = 'host-only cookie：未设置 Domain 属性，仅匹配该主机（不含子域）';
      domain.appendChild(badge);
    }

    domain.title = cookie.domain;

    const actions = document.createElement('div');
    actions.className = 'cookie-col-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon btn-sm';
    editBtn.title = '编辑';
    editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
    editBtn.addEventListener('click', () => handleEditCookie(cookie));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-sm btn-danger-icon';
    deleteBtn.title = '删除';
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>';
    deleteBtn.addEventListener('click', () => handleDeleteCookie(cookie));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(name);
    item.appendChild(value);
    item.appendChild(domain);
    item.appendChild(actions);
    elements.cookiesList.appendChild(item);
  });
}

/**
 * 渲染分页控件
 */
function renderPagination() {
  const totalPages = Math.ceil(cookieState.filteredCookies.length / cookieState.pageSize);
  const pagination = document.getElementById('cookiesPagination');
  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  pagination.innerHTML = '';

  // 上一页按钮
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.textContent = '<';
  prevBtn.disabled = cookieState.page <= 1;
  prevBtn.addEventListener('click', () => {
    if (cookieState.page > 1) {
      cookieState.page--;
      renderCookiesList();
      renderPagination();
    }
  });
  pagination.appendChild(prevBtn);

  // 页码按钮
  const maxVisiblePages = 5;
  let startPage = Math.max(1, cookieState.page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = 'page-btn' + (i === cookieState.page ? ' active' : '');
    pageBtn.textContent = i;
    pageBtn.addEventListener('click', () => {
      cookieState.page = i;
      renderCookiesList();
      renderPagination();
    });
    pagination.appendChild(pageBtn);
  }

  // 下一页按钮
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.textContent = '>';
  nextBtn.disabled = cookieState.page >= totalPages;
  nextBtn.addEventListener('click', () => {
    if (cookieState.page < totalPages) {
      cookieState.page++;
      renderCookiesList();
      renderPagination();
    }
  });
  pagination.appendChild(nextBtn);
}

/**
 * 处理编辑 Cookie
 * @param {Object} cookie - Cookie 数据
 */
function handleEditCookie(cookie) {
  cookieState.editingCookie = cookie;

  // 填充表单
  document.getElementById('cookieNameInput').value = cookie.name;
  document.getElementById('cookieValueInput').value = cookie.value;
  document.getElementById('cookieDomainInput').value = cookie.domain;
  document.getElementById('cookiePathInput').value = cookie.path || '/';
  document.getElementById('cookieExpirationInput').value = cookie.expirationDate || '';
  document.getElementById('cookieSecureInput').checked = cookie.secure || false;
  document.getElementById('cookieHttpOnlyInput').checked = cookie.httpOnly || false;
  document.getElementById('cookieSameSiteInput').value = cookie.sameSite || 'unspecified';

  // 显示编辑模态框
  document.getElementById('cookieEditModal').showModal();
}

/**
 * 处理保存 Cookie 编辑
 */
async function handleSaveCookieEdit() {
  if (!cookieState.editingCookie) return;

  // Domain/Path 为 Cookie 唯一键组成部分，编辑模态框已禁用对应输入框，
  // 键字段始终取原始 Cookie 值（防止绕过禁用导致键迁移产生重复条目）
  const cookieData = {
    name: cookieState.editingCookie.name,
    value: document.getElementById('cookieValueInput').value,
    domain: cookieState.editingCookie.domain,
    path: cookieState.editingCookie.path || '/',
    expirationDate: document.getElementById('cookieExpirationInput').value ? Number(document.getElementById('cookieExpirationInput').value) : undefined,
    secure: document.getElementById('cookieSecureInput').checked,
    httpOnly: document.getElementById('cookieHttpOnlyInput').checked,
    sameSite: document.getElementById('cookieSameSiteInput').value,
  };

  try {
    const result = await window.realmAPI.editCookie(state.currentContainer, cookieData);
    if (result.success) {
      document.getElementById('cookieEditModal').close();
      showToast('Cookie 已更新', 'success');
      await refreshCookiesList();
      updateQuickSaveBtnState();
    } else {
      showToast(result.message || '更新失败', 'error');
    }
  } catch (error) {
    console.error('[Realm Renderer] 编辑 Cookie 失败:', error);
    showToast('编辑失败，请重试', 'error');
  }

  cookieState.editingCookie = null;
}

/**
 * 处理删除 Cookie
 * @param {Object} cookie - Cookie 数据
 */
async function handleDeleteCookie(cookie) {
  if (!confirm(`确定要删除 Cookie "${cookie.name}" 吗？`)) {
    return;
  }

  try {
    const result = await window.realmAPI.deleteSingleCookie(state.currentContainer, cookie);
    if (result.success) {
      showToast('Cookie 已删除', 'success');
      await refreshCookiesList();
      updateQuickSaveBtnState();
    } else {
      showToast(result.message || '删除失败', 'error');
    }
  } catch (error) {
    console.error('[Realm Renderer] 删除 Cookie 失败:', error);
    showToast('删除失败，请重试', 'error');
  }
}

/**
 * 解析 URL 的 hostname，失败返回空字符串
 * @param {string} url - URL 字符串
 * @returns {string} hostname 或 ''
 */
function getUrlHostname(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Cookie 快速保存按钮状态查询 inflight 标记（防并发 IPC） */
let quickSaveStateInflight = false;

/**
 * 刷新 Cookie 快速保存按钮状态
 * 无域名页面（realm:// 内部页、空 tab）置灰禁用；
 * session 与文件同步时绿色（in-sync），有差异时橙色（out-of-sync）
 */
async function updateQuickSaveBtnState() {
  const btn = elements.quickSaveCookiesBtn;
  if (!btn) return;

  const activeTab = state.tabs.get(state.activeTabId);
  const url = activeTab && activeTab.url;
  const domain = getUrlHostname(url);

  // realm:// 内部页面、空 tab、无域名页面都禁用
  if (!domain || (url && url.startsWith('realm://'))) {
    btn.disabled = true;
    btn.classList.remove('in-sync', 'out-of-sync');
    btn.title = '当前页面无域名，无法快速保存 Cookie';
    return;
  }
  btn.disabled = false;

  if (quickSaveStateInflight) return;
  quickSaveStateInflight = true;
  try {
    const result = await window.realmAPI.checkDomainSync(state.currentContainer, domain);
    // 等待期间用户可能已切换 tab/容器，结果只对当前域名生效
    const currentTab = state.tabs.get(state.activeTabId);
    if (getUrlHostname(currentTab && currentTab.url) !== domain) return;

    btn.classList.toggle('in-sync', result.inSync);
    btn.classList.toggle('out-of-sync', !result.inSync);
    btn.title = result.inSync
      ? `${domain} 的 Cookie 已与文件同步（session ${result.sessionCount} / 文件 ${result.fileCount}）`
      : `${domain} 的 Cookie 与文件存在差异（session ${result.sessionCount} / 文件 ${result.fileCount}），点击保存`;
  } catch (err) {
    console.error('[Realm Renderer] 检查 Cookie 同步状态失败:', err);
  } finally {
    quickSaveStateInflight = false;
  }
}

/**
 * 快速保存当前域名 Cookie 到文件（含子域名语义，与面板 subdomain 过滤集合一致）
 */
async function handleQuickSaveCookies() {
  const btn = elements.quickSaveCookiesBtn;
  const activeTab = state.tabs.get(state.activeTabId);
  const url = activeTab && activeTab.url;
  const domain = getUrlHostname(url);
  if (!domain || (url && url.startsWith('realm://'))) return;

  btn.classList.add('loading');
  try {
    const result = await window.realmAPI.saveDomainCookies(state.currentContainer, domain);
    if (result.success) {
      showToast(`已保存 ${result.count} 个 ${domain} 的 Cookie 到文件`, 'success');
    } else {
      showToast('保存失败', 'error');
    }
  } catch (error) {
    console.error('[Realm Renderer] 快速保存 Cookie 失败:', error);
    showToast('保存失败，请重试', 'error');
  } finally {
    btn.classList.remove('loading');
    updateQuickSaveBtnState();
  }
}

/**
 * 保存当前标签页可见域名的 Cookie 到文件（与面板过滤集合一致）
 */
async function handleSaveToFile() {
  try {
    // 获取当前标签页的域名（与 showCookiesModal 同源）
    let domain = '';
    const activeTab = state.tabs.get(state.activeTabId);
    if (activeTab && activeTab.url) {
      try {
        domain = new URL(activeTab.url).hostname;
      } catch {
        // URL 解析失败，使用空字符串
      }
    }

    let result;
    if (!domain || cookieState.filter === 'all') {
      // 过滤器为"全部"（或无法获取域名）时，保存全部
      result = await window.realmAPI.saveCookie(state.currentContainer);
      if (result.success) {
        showToast(`已保存 ${result.count} 个 Cookie 到文件`, 'success');
      } else {
        showToast('保存失败', 'error');
      }
    } else {
      // 保存范围跟随面板当前过滤器：'subdomain' 含父域，'exact' 仅当前域名
      const includeSubdomains = cookieState.filter === 'subdomain';
      result = await window.realmAPI.saveDomainCookies(state.currentContainer, domain, includeSubdomains);
      if (result.success) {
        const scopeLabel = includeSubdomains ? '（含父域）' : '（仅当前域名）';
        showToast(`已保存 ${result.count} 个 ${domain} 的 Cookie 到文件${scopeLabel}`, 'success');
      } else {
        showToast('保存失败', 'error');
      }
    }
  } catch (error) {
    console.error('[Realm Renderer] 保存 Cookie 失败:', error);
    showToast('保存失败，请重试', 'error');
  } finally {
    // 弹窗保存会影响文件侧内容，刷新快速保存按钮状态
    updateQuickSaveBtnState();
  }
}

/**
 * 清除当前容器的所有 Cookie
 */
async function clearContainerCookies() {
  if (confirm('确定要清除当前容器的所有 Cookie 吗？')) {
    await window.realmAPI.clearContainerCookies(state.currentContainer);
    await refreshCookiesList();
    showToast('Cookie 已清除', 'success');
    console.log(`[Realm] 已清除容器 ${state.currentContainer} 的所有 Cookie`);
    updateQuickSaveBtnState();
  }
}

// ==================== 地址栏自动补全功能 ====================

/**
 * 初始化地址栏自动补全功能
 * 注册 input/keydown/blur/focus 事件监听
 */
function initAutocomplete() {
  // input 事件：防抖查询
  elements.urlInput.addEventListener('input', handleAutocompleteInput);

  // keydown 事件：键盘导航
  elements.urlInput.addEventListener('keydown', handleAutocompleteKeydown);

  // blur 事件：延迟关闭下拉框（允许点击候选条目）
  elements.urlInput.addEventListener('blur', () => {
    setTimeout(() => {
      closeAutocomplete();
    }, 150);
  });

  // focus 事件：如果有查询内容则重新打开
  elements.urlInput.addEventListener('focus', () => {
    if (state.autocomplete.query && state.autocomplete.suggestions.length > 0) {
      openAutocomplete();
    }
  });
}

/**
 * 处理地址栏输入事件（100ms 防抖）
 * 使用请求 ID 追踪最新请求，防止快速输入时的竞态条件
 * @param {Event} e - input 事件对象
 */
async function handleAutocompleteInput(e) {
  const query = elements.urlInput.value.trim();

  // 清除之前的防抖定时器
  if (state.autocomplete.debounceTimer) {
    clearTimeout(state.autocomplete.debounceTimer);
    state.autocomplete.debounceTimer = null;
  }

  // 空输入：关闭下拉框
  if (!query) {
    closeAutocomplete();
    return;
  }

  // 设置 100ms 防抖定时器
  state.autocomplete.debounceTimer = setTimeout(async () => {
    // 递增请求 ID，用于追踪最新请求
    const requestId = ++state.autocomplete.lastRequestId;

    try {
      // 更新查询状态
      state.autocomplete.query = query;

      // 检查客户端缓存
      const cached = getCachedSuggestions(query);
      if (cached) {
        // 检查是否仍是最新的请求
        if (requestId !== state.autocomplete.lastRequestId) return;
        updateAutocompleteUI(cached);
        return;
      }

      // 调用主进程 API 获取补全建议
      const suggestions = await window.realmAPI.getAutocompleteSuggestions(query);

      // 检查是否仍是最新的请求（防止过期结果覆盖新结果）
      if (requestId !== state.autocomplete.lastRequestId) return;

      // 存入缓存
      cacheSuggestions(query, suggestions);

      // 更新 UI
      updateAutocompleteUI(suggestions);
    } catch (err) {
      // 仅在仍是最新请求时输出错误（避免过期请求的错误干扰）
      if (requestId === state.autocomplete.lastRequestId) {
        console.error('[Realm Renderer] 获取补全建议失败:', err);
      }
    }
  }, 100);
}

/**
 * 处理地址栏键盘事件
 * @param {KeyboardEvent} e - 键盘事件对象
 */
function handleAutocompleteKeydown(e) {
  // 如果下拉框未打开，只处理 Enter 键（原有导航逻辑）
  if (!state.autocomplete.isOpen && e.key !== 'Enter') {
    return;
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      navigateAutocomplete(1);
      break;

    case 'ArrowUp':
      e.preventDefault();
      navigateAutocomplete(-1);
      break;

    case 'Enter':
      // 如果有选中的候选条目，选择该条目
      if (state.autocomplete.selectedIndex >= 0) {
        e.preventDefault();
        selectAutocompleteItem(state.autocomplete.selectedIndex);
      }
      // 否则走原有 Enter 导航逻辑（不阻止默认行为）
      break;

    case 'Tab':
      // 如果有 inline 补全，接受补全
      if (state.autocomplete.inlineText) {
        e.preventDefault();
        acceptInlineCompletion();
      }
      break;

    case 'ArrowRight':
      // 如果光标在末尾且有 inline 补全，接受补全
      if (elements.urlInput.selectionStart === elements.urlInput.value.length && state.autocomplete.inlineText) {
        e.preventDefault();
        acceptInlineCompletion();
      }
      break;

    case 'Escape':
      e.preventDefault();
      closeAutocomplete();
      break;
  }
}

/**
 * 更新自动补全 UI
 * @param {Array} suggestions - 补全建议列表
 */
function updateAutocompleteUI(suggestions) {
  state.autocomplete.suggestions = suggestions;
  state.autocomplete.selectedIndex = -1;

  // 无匹配结果：关闭下拉框
  if (!suggestions || suggestions.length === 0) {
    closeAutocomplete();
    return;
  }

  // 更新 inline completion（使用第一条建议）
  updateInlineCompletion(suggestions[0]);

  // 渲染下拉列表
  renderAutocompleteDropdown(suggestions);

  // 打开下拉框
  openAutocomplete();
}

/**
 * 更新 inline completion 文本
 * Chrome 风格：在光标后显示高亮补全（仅显示补全部分，不重复已输入文字）
 * 多词查询时使用最后一个词进行匹配（用户正在输入的词）
 * 优先匹配 URL 前缀，其次匹配 URL 中的关键词位置
 * @param {Object} suggestion - 补全建议对象
 */
function updateInlineCompletion(suggestion) {
  const query = state.autocomplete.query;

  // 多词查询时使用最后一个词进行匹配（用户正在输入的词）
  const words = query.split(/\s+/);
  const lastWord = words[words.length - 1];
  const lastWordLower = lastWord.toLowerCase();

  // 去除协议前缀
  const urlWithoutProtocol = suggestion.url.replace(/^https?:\/\//i, '');
  const urlLower = urlWithoutProtocol.toLowerCase();

  let completion = '';

  // 优先：URL 前缀匹配（补全部分 = URL 去掉已输入部分）
  if (urlLower.startsWith(lastWordLower)) {
    completion = urlWithoutProtocol.slice(lastWord.length);
  } else {
    // 次选：URL 中包含关键词（如输入 "wxnacy" 匹配 "github.com/wxnacy"）
    const matchIndex = urlLower.indexOf(lastWordLower);
    if (matchIndex >= 0) {
      completion = urlWithoutProtocol.slice(matchIndex + lastWord.length);
    }
  }

  if (completion) {
    state.autocomplete.inlineText = completion;
    elements.autocompleteInline.textContent = completion;
    // 定位到输入文字末尾（光标位置）
    const textWidth = measureInputTextWidth(query);
    elements.autocompleteInline.style.left = (12 + textWidth) + 'px'; // 12px = input padding-left
    elements.autocompleteInline.style.display = 'block';
  } else {
    state.autocomplete.inlineText = '';
    elements.autocompleteInline.style.display = 'none';
  }
}

/**
 * 测量输入框中文字的像素宽度
 * @param {string} text - 要测量的文字
 * @returns {number} 文字宽度（px）
 */
function measureInputTextWidth(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  return ctx.measureText(text).width;
}

/**
 * 渲染下拉候选列表
 * @param {Array} suggestions - 补全建议列表
 */
function renderAutocompleteDropdown(suggestions) {
  const dropdown = elements.autocompleteDropdown;
  dropdown.innerHTML = '';

  // 最多显示 6 条
  const items = suggestions.slice(0, 6);

  items.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'autocomplete-item';
    itemEl.dataset.index = index;

    // 收藏夹星标（如果是收藏夹来源）
    if (item.source === 'favorite') {
      const starEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      starEl.setAttribute('class', 'autocomplete-star');
      starEl.setAttribute('width', '10');
      starEl.setAttribute('height', '10');
      starEl.setAttribute('viewBox', '0 0 24 24');
      starEl.setAttribute('fill', '#FBBF24');
      starEl.setAttribute('stroke', '#FBBF24');
      starEl.setAttribute('stroke-width', '2');
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2');
      starEl.appendChild(polygon);
      itemEl.appendChild(starEl);
    }

    // Favicon
    const faviconEl = document.createElement('img');
    faviconEl.className = 'autocomplete-item-favicon';
    faviconEl.src = item.faviconUrl || '';
    faviconEl.onerror = () => {
      // Favicon 加载失败时显示默认图标
      faviconEl.style.display = 'none';
      const fallback = document.createElement('div');
      fallback.className = 'autocomplete-item-favicon-fallback';
      fallback.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
      itemEl.insertBefore(fallback, faviconEl.nextSibling);
    };
    itemEl.appendChild(faviconEl);

    // 文字区域
    const textEl = document.createElement('div');
    textEl.className = 'autocomplete-item-text';

    const titleEl = document.createElement('div');
    titleEl.className = 'autocomplete-item-title';
    titleEl.textContent = item.title || item.url;

    const urlEl = document.createElement('div');
    urlEl.className = 'autocomplete-item-url';
    urlEl.textContent = item.url;

    textEl.appendChild(titleEl);
    textEl.appendChild(urlEl);
    itemEl.appendChild(textEl);

    // 来源标签
    const badgeEl = document.createElement('span');
    badgeEl.className = 'autocomplete-item-badge';
    switch (item.source) {
      case 'favorite':
        badgeEl.textContent = '收藏';
        break;
      case 'frequent':
        badgeEl.textContent = '常用';
        break;
      case 'history':
        badgeEl.textContent = '历史';
        break;
    }
    itemEl.appendChild(badgeEl);

    // mousedown 事件（非 click，因为 blur 会先于 click 触发）
    itemEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectAutocompleteItem(index);
    });

    // mouseenter 事件：更新选中状态
    itemEl.addEventListener('mouseenter', () => {
      state.autocomplete.selectedIndex = index;
      updateDropdownHighlight();
    });

    dropdown.appendChild(itemEl);
  });
}

/**
 * 导航自动补全列表（上下键循环选择）
 * @param {number} direction - 方向：1 下，-1 上
 */
function navigateAutocomplete(direction) {
  const maxIndex = state.autocomplete.suggestions.length - 1;
  let newIndex = state.autocomplete.selectedIndex + direction;

  // 循环选择
  if (newIndex < 0) {
    newIndex = maxIndex;
  } else if (newIndex > maxIndex) {
    newIndex = 0;
  }

  state.autocomplete.selectedIndex = newIndex;
  updateDropdownHighlight();

  // 键盘选择时同步更新 inline completion
  if (newIndex >= 0) {
    updateInlineCompletion(state.autocomplete.suggestions[newIndex]);
  }
}

/**
 * 更新下拉列表高亮状态
 */
function updateDropdownHighlight() {
  const items = elements.autocompleteDropdown.querySelectorAll('.autocomplete-item');
  items.forEach((item, index) => {
    if (index === state.autocomplete.selectedIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

/**
 * 选择自动补全条目
 * @param {number} index - 条目索引
 */
function selectAutocompleteItem(index) {
  const suggestion = state.autocomplete.suggestions[index];
  if (!suggestion) return;

  // 设置 input 值
  elements.urlInput.value = suggestion.url;

  // 关闭下拉框
  closeAutocomplete();

  // 触发导航（统一导航入口：有活动 tab → current-tab；无 → new-tab 惰性创建）
  if (state.activeTabId && state.tabs.get(state.activeTabId)) {
    openUrl(suggestion.url, { disposition: 'current-tab', sourceTabId: state.activeTabId });
  } else {
    openUrl(suggestion.url, { disposition: 'new-tab' });
  }

  // 输入框聚焦时全选文本
  elements.urlInput.select();
}

/**
 * 接受 inline completion
 */
function acceptInlineCompletion() {
  // 将 inline 补全文本追加到 input value
  elements.urlInput.value += state.autocomplete.inlineText;

  // 清除 inline 状态
  state.autocomplete.inlineText = '';
  elements.autocompleteInline.style.display = 'none';

  // 关闭下拉框
  closeAutocomplete();

  // 光标移到末尾
  elements.urlInput.setSelectionRange(elements.urlInput.value.length, elements.urlInput.value.length);
}

/**
 * 打开自动补全下拉框
 */
function openAutocomplete() {
  state.autocomplete.isOpen = true;
  elements.autocompleteDropdown.classList.add('visible');
}

/**
 * 关闭自动补全下拉框
 */
function closeAutocomplete() {
  state.autocomplete.isOpen = false;
  state.autocomplete.selectedIndex = -1;
  state.autocomplete.inlineText = '';
  elements.autocompleteDropdown.classList.remove('visible');
  elements.autocompleteInline.style.display = 'none';
}

/**
 * 获取缓存的补全建议
 * @param {string} keyword - 查询关键词
 * @returns {Array|null} 缓存的建议列表或 null
 */
function getCachedSuggestions(keyword) {
  const normalizedKey = keyword.toLowerCase();

  // 精确匹配（不使用前缀子集优化，避免旧结果混入）
  if (state.autocomplete.cache.has(normalizedKey)) {
    return state.autocomplete.cache.get(normalizedKey);
  }

  return null;
}

/**
 * 缓存补全建议
 * @param {string} keyword - 查询关键词
 * @param {Array} suggestions - 补全建议列表
 */
function cacheSuggestions(keyword, suggestions) {
  const normalizedKey = keyword.toLowerCase();

  // 缓存上限 50 条，超过时删除最旧条目
  if (state.autocomplete.cache.size >= 50) {
    const firstKey = state.autocomplete.cache.keys().next().value;
    state.autocomplete.cache.delete(firstKey);
  }

  state.autocomplete.cache.set(normalizedKey, suggestions);
}

/**
 * 最近一次指针按下的目标元素（由 setupEventListeners 的 pointerdown 捕获阶段写入）
 */
let lastPointerDownTarget = null;

/**
 * 本次点击的按下点是否落在容器**内容**里。
 *
 * 判定「是否点击了容器外部」必须看**按下点**，不能看 click 事件的 target：
 * 在容器内可拖选的文本（input / 可选中文本）上按下鼠标、把光标移到容器外再松开时，
 * click 事件的目标是 mousedown 与 mouseup 的**最近公共祖先** —— 对 `<dialog>` 而言
 * 正好是 dialog 元素自身（backdrop 关闭的判据 `e.target === dialog` 就是这样被命中的），
 * 对普通面板则可能是面板自身或更外层。于是「拖选文字」被误判成「点了容器外部」，
 * 把面板 / 弹窗关掉。
 *
 * 判据刻意排除「按下点就是容器自身」的情形（`t !== container`）：那正是点在
 * backdrop 上时的形态，属于真正的点击外部，仍应关闭。
 */
function isPointerDownInContent(container) {
  const t = lastPointerDownTarget;
  return !!container && !!t && t !== container && container.contains(t);
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 记录指针按下落点（捕获阶段，先于一切业务监听器）：供上面 isPointerDownInContent
  // 判定「点击外部关闭」用。项目内已有一处同形态实现（下载面板穿透裁决的
  // lastEmbedderMousedown），这里把同一思路提供给各面板/弹窗的关闭判据。
  document.addEventListener('pointerdown', (e) => {
    lastPointerDownTarget = e.target;
  }, true);

  // Tab 栏事件
  // 新建 Tab 按钮
  elements.tabNewBtn.addEventListener('click', () => {
    createTab(state.currentContainer);
  });

  // Tab 列表点击事件委托
  elements.tabList.addEventListener('click', (e) => {
    const tabElement = e.target.closest('.tab');
    if (!tabElement) return;

    // 如果点击的是关闭按钮，不切换 Tab
    if (e.target.closest('.tab-close')) return;

    const tabId = tabElement.dataset.tabId;
    switchTab(tabId);
  });

  // Tab 栏右键菜单事件委托
  elements.tabList.addEventListener('contextmenu', (e) => {
    // 拖拽过程中禁用右键菜单
    if (state.isDragging) { e.preventDefault(); return; }

    const tabElement = e.target.closest('.tab');
    if (!tabElement) return;

    e.preventDefault();
    const tabId = tabElement.dataset.tabId;
    const tab = state.tabs.get(tabId);
    if (!tab) return;

    // 收集上下文信息
    const tabIds = Array.from(state.tabs.keys());
    const tabIndex = tabIds.indexOf(tabId);
    window.realmAPI.showTabContextMenu({
      tabId,
      tabCount: state.tabs.size,
      tabIndex,
      isPinned: !!tab.pinned,
      hasClosedTabs: closedTabsStack.length > 0,
    });
  });

  // Tab 栏空白区右键菜单（tab-list 空白、拖拽保留区、滚动按钮/新建按钮等非标签区域）
  elements.tabBar.addEventListener('contextmenu', (e) => {
    // 拖拽过程中禁用右键菜单
    if (state.isDragging) { e.preventDefault(); return; }
    // 标签项由上方 tabList 委托处理，此处跳过避免同一事件弹两种菜单
    if (e.target.closest('.tab')) return;
    e.preventDefault();
    window.realmAPI.showTabBarContextMenu();
  });

  // 新标签页搜索框
  elements.newTabSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = elements.newTabSearch.value.trim();
      if (value) {
        // 统一导航入口（与 realm://newtab guest 页搜索行为对齐：均查分配规则）
        openUrl(value, { disposition: 'new-tab' });
        elements.newTabSearch.value = '';
      }
    }
  });

  // Tab 滚动按钮：单击滚一步，长按连续滚动
  bindTabScrollButton(elements.tabScrollLeft, -1);
  bindTabScrollButton(elements.tabScrollRight, 1);

  // 标签栏滚动时刷新按钮显隐（rAF 节流，滚动事件高频触发）
  let tabScrollRafId = null;
  elements.tabList.addEventListener('scroll', () => {
    if (tabScrollRafId !== null) return;
    tabScrollRafId = requestAnimationFrame(() => {
      tabScrollRafId = null;
      updateTabScrollState();
    });
  });

  // 标签栏宽度变化（窗口缩放、侧边栏开合等）时刷新按钮显隐，
  // 并保证活动标签始终可见（Firefox 行为：缩窄窗口时活动标签自动滚回视口）
  if (typeof ResizeObserver !== 'undefined') {
    const tabListRO = new ResizeObserver(() => {
      updateTabScrollState();
      scrollActiveTabIntoView('auto');
    });
    tabListRO.observe(elements.tabList);
  } else {
    window.addEventListener('resize', () => {
      updateTabScrollState();
      scrollActiveTabIntoView('auto');
    });
  }

  // 导航按钮事件
  // 后退按钮
  elements.backBtn.addEventListener('click', () => {
    const webview = state.webviews.get(state.activeTabId);
    if (webview && webview.canGoBack()) {
      webview.goBack();
    }
  });

  // 前进按钮
  elements.forwardBtn.addEventListener('click', () => {
    const webview = state.webviews.get(state.activeTabId);
    if (webview && webview.canGoForward()) {
      webview.goForward();
    }
  });

  // 刷新/停止按钮
  elements.reloadBtn.addEventListener('click', () => {
    const webview = state.webviews.get(state.activeTabId);
    if (!webview) return;

    // 如果正在加载，停止加载；否则刷新
    if (elements.reloadBtn.classList.contains('loading')) {
      webview.stop();
    } else {
      webview.reload();
    }
  });

  // 容器指示器点击 - 切换侧边栏显示/隐藏
  elements.containerIndicator.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar();
  });

  // 侧边栏容器列表 - 事件委托
  elements.containerList.addEventListener('click', (e) => {
    const item = e.target.closest('[data-container-id]');
    if (!item) return;

    const containerId = item.dataset.containerId;
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'edit') {
      showEditContainerModal(containerId);
    } else if (action === 'delete') {
      // 检查按钮是否禁用（默认容器保护）
      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn && deleteBtn.disabled) return;
      showDeleteConfirmModal(containerId);
    } else {
      // 点击容器行 - 切换容器
      switchContainer(containerId);
    }
  });

  // 新建容器按钮（侧边栏）
  if (elements.addContainerBtnSidebar) {
    elements.addContainerBtnSidebar.addEventListener('click', showCreateContainerModal);
  }

  // 取消容器操作
  elements.cancelContainerBtn.addEventListener('click', () => {
    elements.containerModal.close();
  });

  // 容器表单提交
  elements.containerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = elements.containerNameInput.value.trim();

    // 验证：名称为空
    if (!name) {
      elements.nameError.textContent = '请输入容器名称';
      elements.nameError.classList.add('visible');
      return;
    }

    // 验证：名称重复（编辑模式排除自身）
    const isDuplicate = state.containers.some(
      c => c.name === name && c.id !== state.editingContainerId
    );
    if (isDuplicate) {
      elements.nameError.textContent = '容器名称已存在，请使用其他名称';
      elements.nameError.classList.add('visible');
      return;
    }

    // 清除错误提示
    elements.nameError.classList.remove('visible');

    // 获取扩展属性值
    const email = elements.containerEmailInput.value.trim();
    const phone = elements.containerPhoneInput.value.trim();
    const notes = elements.containerNotesInput.value;

    // 邮箱验证（per D-04, D-05）：非空时检查 @ 格式
    if (email && !email.includes('@')) {
      elements.emailError.textContent = '请输入正确的邮箱地址';
      elements.emailError.classList.add('visible');
      return;
    }
    elements.emailError.classList.remove('visible');

    // 手机号验证（per D-04, D-05）：非空时检查11位数字
    if (phone && !/^\d{11}$/.test(phone)) {
      elements.phoneError.textContent = '请输入11位手机号';
      elements.phoneError.classList.add('visible');
      return;
    }
    elements.phoneError.classList.remove('visible');

    // 备注验证（per D-07）：最大500字符
    if (notes.length > 500) {
      elements.notesError.textContent = '备注不能超过500字';
      elements.notesError.classList.add('visible');
      return;
    }
    elements.notesError.classList.remove('visible');

    try {
      if (state.editingContainerId) {
        // 编辑模式
        await window.realmAPI.updateContainer(state.editingContainerId, {
          name,
          color: state.selectedColor,
          icon: state.selectedIcon,
          phone,
          email,
          notes,
          envVars: state.containerEnvVars,
        });
      } else {
        // 新建模式
        await window.realmAPI.createContainer({
          name,
          color: state.selectedColor,
          icon: state.selectedIcon,
          phone,
          email,
          notes,
          envVars: state.containerEnvVars,
        });
      }

      // 关闭 Modal 并刷新列表
      elements.containerModal.close();
      await loadContainers();
    } catch (error) {
      console.error('[Realm] 容器操作失败:', error);
      elements.nameError.textContent = '操作失败，请重试';
      elements.nameError.classList.add('visible');
    }
  });

  // 颜色选择器 - 事件委托
  elements.colorPicker.addEventListener('click', (e) => {
    const button = e.target.closest('.color-option');
    if (!button) return;

    state.selectedColor = button.dataset.color;
    updateColorSelection();
  });

  // 符号选择器 - 事件委托
  const symbolPicker = document.getElementById('symbolPicker');
  if (symbolPicker) {
    symbolPicker.addEventListener('click', (e) => {
      const button = e.target.closest('.symbol-option');
      if (!button) return;

      state.selectedIcon = button.dataset.icon;
      updateSymbolSelection();
    });
  }

  // 环境变量折叠面板
  elements.envVarsToggle.addEventListener('click', () => {
    const isExpanded = elements.envVarsToggle.classList.toggle('expanded');
    elements.envVarsPanel.style.display = isExpanded ? 'block' : 'none';
  });

  // 添加变量按钮
  elements.envVarAddBtn.addEventListener('click', showEnvVarAddArea);

  // 确认添加变量
  elements.envVarConfirmBtn.addEventListener('click', confirmAddEnvVar);

  // 取消添加变量
  elements.envVarCancelBtn.addEventListener('click', hideEnvVarAddArea);

  // key 输入实时筛选
  elements.envVarKeyInput.addEventListener('input', handleEnvVarKeyInput);

  // key 输入键盘导航
  elements.envVarKeyInput.addEventListener('keydown', (e) => {
    const suggestions = elements.envVarSuggestions.querySelectorAll('.env-var-suggestion');
    const activeIndex = Array.from(suggestions).findIndex(s => s.classList.contains('active'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        suggestions.forEach(s => s.classList.remove('active'));
        const nextIndex = activeIndex + 1 < suggestions.length ? activeIndex + 1 : 0;
        suggestions[nextIndex].classList.add('active');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        suggestions.forEach(s => s.classList.remove('active'));
        const prevIndex = activeIndex - 1 >= 0 ? activeIndex - 1 : suggestions.length - 1;
        suggestions[prevIndex].classList.add('active');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = elements.envVarSuggestions.querySelector('.env-var-suggestion.active');
      if (active) {
        active.dispatchEvent(new Event('mousedown'));
      } else if (elements.envVarKeyInput.value.trim()) {
        selectEnvVarKey(elements.envVarKeyInput.value.trim());
      }
    } else if (e.key === 'Escape') {
      elements.envVarSuggestions.style.display = 'none';
    }
  });

  // key 输入失焦时隐藏下拉（延迟以允许点击下拉项）
  elements.envVarKeyInput.addEventListener('blur', () => {
    setTimeout(() => {
      elements.envVarSuggestions.style.display = 'none';
    }, 150);
  });

  // value 输入框按 Enter 直接确认
  elements.envVarValueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      confirmAddEnvVar();
    } else if (e.key === 'Escape') {
      hideEnvVarAddArea();
    }
  });

  // 删除确认按钮
  elements.confirmDeleteBtn.addEventListener('click', confirmDeleteContainer);
  elements.cancelDeleteBtn.addEventListener('click', () => {
    elements.deleteConfirmModal.close();
    state.deletingContainerId = null;
  });

  // 点击删除确认模态框外部关闭
  elements.deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === elements.deleteConfirmModal) {
      elements.deleteConfirmModal.close();
      state.deletingContainerId = null;
    }
  });

  // 浏览历史按钮：在当前容器新 Tab 打开 realm://history
  elements.historyBtn.addEventListener('click', () => {
    const containerId = state.currentContainer;

    // 检查当前容器是否已有 realm://history 的 Tab 打开
    // （历史页容器由 webview URL 的 ?container= 参数决定，跨容器复用会串数据）
    let existingTabId = null;
    state.tabs.forEach((tab, tabId) => {
      if (tab.url === 'realm://history' && tab.containerId === containerId) {
        existingTabId = tabId;
      }
    });

    if (existingTabId) {
      // 已有则切换到该 Tab
      switchTab(existingTabId);
      // 切换到已有标签后刷新页面，确保历史记录显示最新数据
      const webview = state.webviews.get(existingTabId);
      if (webview) {
        webview.reload();
      }
    } else {
      // 没有则创建新 Tab
      createTab(containerId, 'realm://history');
    }
  });

  // 设置按钮：打开设置页面
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', () => {
      openSettingsTab();
    });
  }

  // 星标按钮：弹收藏编辑面板（Chrome/Edge 标准交互）
  // 未收藏：新增模式；已收藏：编辑模式（含"移除收藏"按钮）
  elements.bookmarkStarBtn.addEventListener('click', () => {
    const activeTab = state.tabs.get(state.activeTabId);
    if (activeTab && activeTab.url) {
      // 编辑模式：用收藏数据库存的标题（用户上次保存的）
      // 新增模式：用网页本身的标题作为初始值
      const initialTitle = state.isCurrentPageBookmarked && state.currentBookmarkTitle
        ? state.currentBookmarkTitle
        : (activeTab.title || activeTab.url);
      showBookmarkEditPanel(
        initialTitle,
        activeTab.url,
        state.isCurrentPageBookmarked,
        // 编辑态带上该收藏所在文件夹；新增态由面板内部用「上次保存到的文件夹」补齐
        state.currentBookmarkFolderId
      );
    } else {
      // 当前 Tab 无 URL（尚未导航），给出明确反馈
      showToast('当前页面不可收藏', 'info');
    }
  });

  // 收藏编辑面板保存按钮
  elements.bookmarkSaveBtn.addEventListener('click', saveBookmark);

  // 收藏编辑面板标题输入框回车键触发保存
  elements.bookmarkTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBookmark();
    }
  });

  // 收藏编辑面板取消按钮
  elements.bookmarkCancelBtn.addEventListener('click', hideBookmarkEditPanel);

  // 收藏编辑面板"移除收藏"按钮（编辑模式可见）
  elements.bookmarkRemoveBtn.addEventListener('click', removeBookmark);

  // 文件夹选择器：点触发器开合下拉
  elements.bookmarkFolderTrigger.addEventListener('click', () => {
    if (state.bookmarkFolderDropdownOpen) {
      closeBookmarkFolderDropdown();
    } else {
      openBookmarkFolderDropdown();
    }
  });

  // 文件夹下拉的点击外部收起。按下点判据不可省：在下拉的搜索框里拖选文字、
  // 把光标移到下拉外再松开时，click 的目标是公共祖先（下拉之外），
  // 只看 target 会把「选中文字」误判成「点了外部」（项目统一判据）
  document.addEventListener('click', (e) => {
    if (!state.bookmarkFolderDropdownOpen) return;
    if (elements.bookmarkFolderDropdown.contains(e.target)) return;
    if (elements.bookmarkFolderTrigger.contains(e.target)) return;
    if (isPointerDownInContent(elements.bookmarkFolderDropdown)) return;
    closeBookmarkFolderDropdown();
  });

  // 下拉展开时 Escape 只收起下拉，不关整个面板：一次 Escape 就把「编辑收藏」
  // 整个放弃，与用户「退出文件夹选择」的意图不符。
  // dialog 的原生 Escape 走 cancel 事件，preventDefault 即拦下
  elements.bookmarkEditPanel.addEventListener('cancel', (e) => {
    if (state.bookmarkFolderDropdownOpen) {
      e.preventDefault();
      closeBookmarkFolderDropdown();
      elements.bookmarkFolderTrigger.focus();
    }
  });

  // 点击 dialog 外部（backdrop）关闭：点击 dialog 元素本身（非内容）即 backdrop。
  // 还要求按下点也在内容之外：在标题输入框里拖选文字、把光标移到弹窗外再松开时，
  // click 的目标同样是 dialog 自身，只看 target 会把「选中文字」误判成「点了外部」
  elements.bookmarkEditPanel.addEventListener('click', (e) => {
    if (e.target === elements.bookmarkEditPanel &&
        !isPointerDownInContent(elements.bookmarkEditPanel)) {
      hideBookmarkEditPanel();
    }
  });

  // Escape 键：<dialog> 原生支持 Escape 关闭（下拉开着时由上面的 cancel 拦截）

  // 收藏栏右键事件委托
  if (elements.bookmarksBar) {
    elements.bookmarksBar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const bookmarkEl = e.target.closest('.bookmark-item');
      const folderEl = e.target.closest('.bookmark-folder');

      if (bookmarkEl) {
        // 收藏项右键菜单（per D-12）
        const info = {
          id: bookmarkEl.dataset.bookmarkId,
          url: bookmarkEl.dataset.bookmarkUrl,
          title: bookmarkEl.dataset.bookmarkTitle,
        };
        window.realmAPI.showBookmarksBarContextMenu({ type: 'bookmark', ...info });
      } else if (folderEl) {
        // 文件夹右键菜单（per D-13）
        const info = {
          id: folderEl.dataset.folderId,
          name: folderEl.dataset.folderName,
        };
        window.realmAPI.showBookmarksBarContextMenu({ type: 'folder', ...info });
      } else {
        // 空白区域右键菜单（per D-03/D-14）
        window.realmAPI.showBookmarksBarContextMenu({ type: 'blank' });
      }
    });
  }

  // 收藏夹按钮：打开 realm://favorites 收藏列表页面（全局共享，不区分容器）
  elements.favoritesBtn.addEventListener('click', () => {
    const containerId = state.currentContainer;

    // 检查是否已有 realm://favorites 的 Tab 打开（全局唯一，不按容器区分；
    // 收藏栏导入按钮打开的 tab 带 ?action=import 参数，同样视为收藏页 tab）
    let existingTabId = null;
    state.tabs.forEach((tab, tabId) => {
      if (tab.url === 'realm://favorites' ||
          (tab.url && tab.url.startsWith('realm://favorites?'))) {
        existingTabId = tabId;
      }
    });

    if (existingTabId) {
      switchTab(existingTabId);
      // 切换到已有标签后刷新页面，确保收藏列表显示最新数据
      const webview = state.webviews.get(existingTabId);
      if (webview) {
        webview.reload();
      }
    } else {
      createTab(containerId, 'realm://favorites');
    }
  });

  // Cookie 管理按钮
  elements.cookiesBtn.addEventListener('click', showCookiesModal);
  elements.clearCookiesBtn.addEventListener('click', clearContainerCookies);
  elements.refreshCookiesBtn.addEventListener('click', refreshCookiesList);
  elements.closeCookiesModal.addEventListener('click', () => {
    elements.cookiesModal.close();
  });

  // Cookie 来源切换标签页
  document.querySelectorAll('.source-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      handleSourceTabSwitch(tab.dataset.source);
    });
  });

  // Cookie 域名过滤
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      handleDomainFilter(chip.dataset.filter);
    });
  });

  // Cookie 保存到文件按钮
  const saveCookiesBtn = document.getElementById('saveCookiesBtn');
  if (saveCookiesBtn) {
    saveCookiesBtn.addEventListener('click', handleSaveToFile);
  }

  // Cookie 快速保存按钮（地址栏）
  if (elements.quickSaveCookiesBtn) {
    elements.quickSaveCookiesBtn.addEventListener('click', handleQuickSaveCookies);
  }

  // Cookie 编辑模态框
  const cookieEditForm = document.getElementById('cookieEditForm');
  if (cookieEditForm) {
    cookieEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveCookieEdit();
    });
  }

  const cancelCookieEditBtn = document.getElementById('cancelCookieEditBtn');
  if (cancelCookieEditBtn) {
    cancelCookieEditBtn.addEventListener('click', () => {
      document.getElementById('cookieEditModal').close();
      cookieState.editingCookie = null;
    });
  }

  // Cookie 编辑模态框外部点击关闭
  // （按下点同样要在内容之外，否则在 cookieValueInput 里拖选文字后松手到 backdrop 会误关）
  const cookieEditModal = document.getElementById('cookieEditModal');
  if (cookieEditModal) {
    cookieEditModal.addEventListener('click', (e) => {
      if (e.target === cookieEditModal && !isPointerDownInContent(cookieEditModal)) {
        cookieEditModal.close();
        cookieState.editingCookie = null;
      }
    });
  }


  // URL 输入框回车
  elements.urlInput.addEventListener('keydown', async (e) => {
    console.log('[Realm Renderer] URL 输入框按键:', e.key, 'meta:', e.metaKey, 'ctrl:', e.ctrlKey);
    if (e.key === 'Enter') {
      const url = elements.urlInput.value.trim();
      if (url) {
        console.log('[Realm] 导航到:', url);

        // 统一导航入口（含分配规则匹配/URL 规整/m3u8 包装/tab 持久化）：
        // 有活动 tab → current-tab（命中其他容器时改为匹配容器新建 tab，原 tab 不动）；
        // 无活动 tab（冷启动空 Tab 栏或关闭最后 Tab 后）→ new-tab 惰性创建
        if (state.activeTabId) {
          await openUrl(url, { disposition: 'current-tab', sourceTabId: state.activeTabId });
        } else {
          await openUrl(url, { disposition: 'new-tab' });
        }

        // 导航发起后焦点还给页面（webview guest）：焦点留在地址栏时主进程判定在输入框中，
        // Vim 键位会被放行给地址栏而非操作页面
        elements.urlInput.blur();
        const activeWebview = state.webviews.get(state.activeTabId);
        if (activeWebview) {
          activeWebview.focus();
        }

        // 输入框聚焦时全选文本
        elements.urlInput.select();
      }
    }
  });

  // 点击模态框外部关闭
  // （按下点同样要在内容之外：容器表单里 textarea / 输入框拖选文字后松手到 backdrop 不应关闭）
  elements.containerModal.addEventListener('click', (e) => {
    if (e.target === elements.containerModal &&
        !isPointerDownInContent(elements.containerModal)) {
      elements.containerModal.close();
    }
  });

  elements.cookiesModal.addEventListener('click', (e) => {
    if (e.target === elements.cookiesModal) {
      elements.cookiesModal.close();
    }
  });

  // 快捷键
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + N: 新建容器
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      showCreateContainerModal();
    }

    // Escape: 关闭模态框
    if (e.key === 'Escape') {
      elements.deleteConfirmModal.close();
      state.deletingContainerId = null;
      elements.containerModal.close();
      elements.cookiesModal.close();
    }
  });

  // 监听外部链接打开事件（SETT-03）
  // data: { url, containerId }；containerId 非 null = 用户在设置里固定了默认容器，
  // 视为显式选择（优先于规则）；null（'last-used'）交给 openUrl 内部 matchRule
  window.realmAPI.onExternalUrlOpen((data) => {
    if (data && data.url) {
      openUrl(data.url, { disposition: 'new-tab', explicitContainerId: data.containerId || null });
    }
  });

  // ==================== 媒体面板事件 ====================

  // 媒体面板按钮点击：打开/关闭面板
  if (elements.mediaPanelBtn) {
    elements.mediaPanelBtn.addEventListener('click', toggleMediaPanel);
  }

  // 媒体面板关闭按钮
  if (elements.mediaPanelCloseBtn) {
    elements.mediaPanelCloseBtn.addEventListener('click', toggleMediaPanel);
  }

  // 点击面板外部关闭
  document.addEventListener('click', (e) => {
    if (state.mediaPanelOpen &&
        !elements.mediaPanel.contains(e.target) &&
        !elements.mediaPanelBtn.contains(e.target)) {
      toggleMediaPanel();
    }
  });

  // 媒体列表点击事件（事件委托：播放和复制按钮）
  if (elements.mediaList) {
    elements.mediaList.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.media-play-btn');
      const copyBtn = e.target.closest('.media-copy-btn');

      if (playBtn) {
        playMedia(parseInt(playBtn.dataset.index));
      } else if (copyBtn) {
        copyMediaUrl(parseInt(copyBtn.dataset.index), copyBtn);
      }
    });
  }

  // ==================== AI 助手面板事件 ====================

  // AI 面板按钮点击：打开/关闭面板
  if (elements.aiPanelBtn) {
    elements.aiPanelBtn.addEventListener('click', toggleAIPanel);
  }

  // AI 面板关闭按钮
  if (elements.aiPanelCloseBtn) {
    elements.aiPanelCloseBtn.addEventListener('click', toggleAIPanel);
  }

  // AI 设置按钮
  const aiSettingsBtn = document.getElementById('aiSettingsBtn');
  if (aiSettingsBtn) {
    aiSettingsBtn.addEventListener('click', openAISettings);
  }

  // AI 发送按钮
  if (elements.aiSendBtn) {
    elements.aiSendBtn.addEventListener('click', () => {
      if (state.aiStreaming) {
        // AI 正在回复，点击停止
        handleStopAI();
      } else {
        // AI 未在回复，点击发送
        handleSendAIMessage();
      }
    });
  }

  // AI 新对话按钮
  if (elements.aiNewChatBtn) {
    elements.aiNewChatBtn.addEventListener('click', handleNewConversation);
  }

  // AI 模型选择器
  if (elements.aiModelSelector) {
    elements.aiModelSelector.addEventListener('click', toggleModelDropdown);
    elements.aiModelSelector.addEventListener('keydown', handleModelSelectorKeydown);
  }

  // AI 上下文用量按钮与弹框
  if (elements.aiContextBtn) {
    elements.aiContextBtn.addEventListener('click', toggleContextPopover);
  }
  if (elements.aiContextCloseBtn) {
    elements.aiContextCloseBtn.addEventListener('click', closeContextPopover);
  }

  // 对话历史按钮
  if (elements.aiHistoryBtn) {
    elements.aiHistoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleConvDropdown();
    });
  }

  // 对话删除确认按钮
  if (elements.aiConvDeleteCancel) {
    elements.aiConvDeleteCancel.addEventListener('click', closeDeleteConfirm);
  }
  if (elements.aiConvDeleteConfirm) {
    elements.aiConvDeleteConfirm.addEventListener('click', async () => {
      // 删除目标从 dialog dataset 读取（G-42-6）：不再依赖会被全局 closer
      // 清空的共享状态，确认后 ai:delete-conversation IPC 必达
      const conversationId = elements.aiConvDeleteDialog.dataset.conversationId;
      if (conversationId) {
        await deleteConversation(conversationId);
      }
      closeDeleteConfirm();
    });
  }

  // 点击外部关闭对话下拉面板和右键菜单
  document.addEventListener('click', (e) => {
    // 关闭对话下拉面板
    // 按下点也要在面板内容之外：在内联重命名输入框里拖选文字、把光标拖到面板外再松开时，
    // click 的目标是公共祖先（面板之外），只看 target 会把「选中文字」误判成「点了外部」
    if (state.convDropdownOpen &&
        !elements.aiConvDropdown.contains(e.target) &&
        !isPointerDownInContent(elements.aiConvDropdown) &&
        !elements.aiHistoryBtn.contains(e.target)) {
      closeConvDropdown();
    }
    // 关闭右键菜单（由 showConvContextMenu 内部管理）
  });

  // AI 输入框键盘事件（Enter 发送，Shift+Enter 换行）
  if (elements.aiInput) {
    elements.aiInput.addEventListener('keydown', handleAIInputKeydown);
    elements.aiInput.addEventListener('input', handleAIInputAutoResize);
  }

  // @ 引用面板事件
  if (elements.contextPickerSearch) {
    elements.contextPickerSearch.addEventListener('input', (e) => {
      state.contextPickerSearch = e.target.value;
      state.contextPickerActiveIndex = 0;
      renderContextPickerList();
    });

    elements.contextPickerSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeContextPicker();
        elements.aiInput.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const count = state.contextPickerItems.length;
        if (count === 0) return;
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        state.contextPickerActiveIndex = (state.contextPickerActiveIndex + delta + count) % count;
        renderContextPickerList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const tab = state.contextPickerItems[state.contextPickerActiveIndex];
        if (tab) {
          toggleContextPickerTab(tab.id, state.contextPickerItems, state.contextPickerContainerMap);
        }
      }
    });
  }

  // 点击外部关闭 @ 引用面板
  // 按下点也要在面板内容之外：在两个面板的输入框 / 列表文本上拖选后松手到面板外，
  // click 的目标同样在面板之外，只看 target 会把「选中文字」误判成「点了外部」
  document.addEventListener('click', (e) => {
    if (state.contextPickerOpen &&
        !elements.contextPickerPanel.contains(e.target) &&
        !isPointerDownInContent(elements.contextPickerPanel) &&
        e.target !== elements.aiInput) {
      closeContextPicker();
    }
    if (state.slashPickerOpen &&
        !elements.slashPickerPanel.contains(e.target) &&
        !isPointerDownInContent(elements.slashPickerPanel) &&
        e.target !== elements.aiInput) {
      closeSlashPicker();
    }
  });

  // AI 输入框 Escape 键关闭 @ 引用面板
  if (elements.aiInput) {
    elements.aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.contextPickerOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeContextPicker();
      }
    });
  }

  // AI 消息列表滚动事件（智能滚动控制）
  if (elements.aiMessageList) {
    elements.aiMessageList.addEventListener('scroll', handleAIMessageScroll);

    // 图片解码完成后补一次贴底：内联附件图（数据经 IPC 异步拉取）与 AI 回复中的
    // Markdown 图片在 renderAIMessages 贴底时高度只有占位（.ai-attachment-image-loading
    // min-height 60px），解码后按原始比例撑高列表，会把刚发出的用户气泡与 AI 等待
    // 气泡挤出视口（长对话下表现为「发送后消息框没第一时间完整展示」，直到流式
    // 事件触发下一次贴底才可见）。img 的 load/error 不冒泡，必须捕获阶段监听
    elements.aiMessageList.addEventListener('load', (e) => {
      if (state.aiAutoScroll && e.target && e.target.tagName === 'IMG') scrollToBottom();
    }, true);
    elements.aiMessageList.addEventListener('error', (e) => {
      if (state.aiAutoScroll && e.target && e.target.tagName === 'IMG') scrollToBottom();
    }, true);

    // 拦截 AI 消息中的链接点击，在新标签页打开（统一导航入口，含分配规则匹配）
    elements.aiMessageList.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      // http(s) 与 realm:// 内部页面均在新标签页打开
      if (/^(https?:\/\/|realm:\/\/)/i.test(href)) {
        openUrl(href, { disposition: 'new-tab' });
      }
    });
  }

  // 回到底部按钮
  if (elements.aiScrollToBottom) {
    elements.aiScrollToBottom.addEventListener('click', handleScrollToBottomClick);

    // 动态钉在聊天输入区顶部上方：输入区高度随引用 pills、
    // 输入框自动增高变化，CSS 写死 bottom 会与输入区重叠
    const aiInputArea = document.getElementById('aiInputArea');
    if (aiInputArea && typeof ResizeObserver !== 'undefined') {
      const syncScrollBtnPos = () => {
        elements.aiScrollToBottom.style.bottom = (aiInputArea.offsetHeight + 8) + 'px';
      };
      new ResizeObserver(syncScrollBtnPos).observe(aiInputArea);
      syncScrollBtnPos();
    }
  }

  // 初始化操作确认 IPC 监听
  initActionConfirmation();

  // 初始化脚本执行步骤状态监听
  initScriptStepUpdate();

  // 初始化标签栏重排监听
  initTabReorderListener();

  // 初始化 Tab 拖拽排序
  initTabDragAndDrop();

  // 初始化 AI 面板拖拽调整宽度
  initAIPanelResize();

  // 初始化 webview 可命中性兜底（拖拽/改宽期间禁用鼠标命中的收尾保底）
  initWebviewHitTestSafetyNet();

  // 初始化 AI 聊天附件（面板拖拽接管 + 输入框粘贴附件）
  initAIAttachments();

  // 初始化快捷键监听
  initShortcuts();

  // 初始化页面内搜索
  initFindInPage();

  // 初始化地址栏自动补全
  initAutocomplete();
}

// ==================== AI 助手 ====================

/**
 * 切换侧边栏的显示/隐藏状态
 * 同时更新面板可见性，持久化状态到 electron-store
 */
function toggleSidebar() {
  state.sidebarVisible = !state.sidebarVisible;
  elements.sidebar.classList.toggle('hidden', !state.sidebarVisible);
  document.body.classList.toggle('sidebar-hidden', !state.sidebarVisible);

  // 持久化面板状态
  try {
    window.realmAPI.setSetting('sidebarVisible', state.sidebarVisible);
  } catch (err) {
    console.error('[Realm Renderer] 保存 Sidebar 状态失败:', err);
  }
}

// ==================== AI 工具栏功能 ====================

/** AI 模型选择器数据缓存 */
let aiModelsData = null;
/** 模型选择器下拉框是否打开 */
let aiModelSelectorOpen = false;

/**
 * 新对话按钮点击处理
 * 委托给 createNewConversation 完成对话创建和状态重置
 */
async function handleNewConversation() {
  await createNewConversation();
  // 新对话上下文清空，立即刷新圆环与弹框数据（不等下一次 agent_end）
  refreshContextUsage();
}

// ==================== 对话管理功能 ====================

/**
 * 从主进程加载对话列表并渲染
 * 调用 conversationAPI 获取所有对话，更新 state.conversations，然后渲染列表
 */
async function loadConversations() {
  try {
    const result = await window.realmAPI.conversationAPI.getConversations();
    if (result && result.success !== false) {
      state.conversations = result.conversations || result || [];
    }
  } catch (err) {
    console.error('[Realm Renderer] 加载对话列表失败:', err);
    state.conversations = [];
  }
  renderConvList();
}

/**
 * 渲染对话列表到 #aiConvList
 * 空列表时显示「暂无对话」引导文案
 * 按 updated_at 降序排列，当前对话高亮
 * 对话标题截断为 30 字符 + ellipsis
 */
function renderConvList() {
  if (!elements.aiConvList) return;

  elements.aiConvList.innerHTML = '';

  // 空状态
  if (!state.conversations || state.conversations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ai-conv-empty';

    const title = document.createElement('div');
    title.className = 'ai-conv-empty-title';
    title.textContent = '暂无对话';

    const hint = document.createElement('div');
    hint.textContent = '点击「新对话」开始与 AI 交流';

    empty.appendChild(title);
    empty.appendChild(hint);
    elements.aiConvList.appendChild(empty);
    return;
  }

  // 按 updated_at 降序排列
  const sorted = [...state.conversations].sort((a, b) => {
    return new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0);
  });

  sorted.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'ai-conv-item' + (conv.id === state.currentConversationId ? ' active' : '');
    item.dataset.conversationId = conv.id;

    const title = document.createElement('div');
    title.className = 'ai-conv-item-title';
    // 标题截断为 30 字符
    const convTitle = conv.title || '新对话';
    title.textContent = convTitle.length > 30 ? convTitle.substring(0, 30) + '...' : convTitle;
    title.title = convTitle;

    const meta = document.createElement('div');
    meta.className = 'ai-conv-item-meta';
    const date = new Date(conv.updated_at || conv.updatedAt || conv.created_at || conv.createdAt || Date.now());
    const dateStr = date.toLocaleDateString('zh-CN');
    const msgCount = conv.message_count || conv.messageCount || 0;
    meta.textContent = `${dateStr} · ${msgCount} 条消息`;

    item.appendChild(title);
    item.appendChild(meta);

    // 点击切换对话
    item.addEventListener('click', () => {
      switchConversation(conv.id);
    });

    // 右键菜单
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showConvContextMenu(e, conv.id, convTitle);
    });

    elements.aiConvList.appendChild(item);
  });
}

/**
 * 切换对话列表下拉面板的显示/隐藏
 */
function toggleConvDropdown() {
  state.convDropdownOpen = !state.convDropdownOpen;

  if (state.convDropdownOpen) {
    elements.aiConvDropdown.style.display = 'flex';
    elements.aiHistoryBtn.classList.add('active');
    loadConversations();
  } else {
    elements.aiConvDropdown.style.display = 'none';
    elements.aiHistoryBtn.classList.remove('active');
  }
}

/**
 * 关闭对话列表下拉面板
 */
function closeConvDropdown() {
  if (!state.convDropdownOpen) return;
  state.convDropdownOpen = false;
  elements.aiConvDropdown.style.display = 'none';
  elements.aiHistoryBtn.classList.remove('active');
}

/**
 * 切换到指定对话
 * @param {string} conversationId - 目标对话 ID
 */
async function switchConversation(conversationId) {
  if (conversationId === state.currentConversationId) {
    closeConvDropdown();
    return;
  }

  try {
    // 调用主进程切换对话
    const result = await window.realmAPI.conversationAPI.switchConversation(conversationId);

    state.currentConversationId = conversationId;

    // 清空当前消息列表
    state.aiMessages = [];
    if (elements.aiMessageList) {
      elements.aiMessageList.innerHTML = '';
    }
    state.aiStreaming = false;
    state.aiCurrentMessageId = null;
    state.aiCancelledByUser = false;
    state.aiCancelledMessageId = null;

    // 加载目标对话的消息
    if (result && result.messages && result.messages.length > 0) {
      state.aiMessages = result.messages;
      renderAIMessages();
    }

    // 更新对话列表高亮
    renderConvList();
    closeConvDropdown();

    console.log('[Realm Renderer] 已切换到对话:', conversationId);
  } catch (err) {
    console.error('[Realm Renderer] 切换对话失败:', err);
  }
}

/**
 * 创建新对话
 * 调用主进程创建对话，更新当前对话 ID，刷新列表
 */
async function createNewConversation() {
  try {
    const result = await window.realmAPI.conversationAPI.createConversation();
    // IPC 返回 { conversation: { id, title, ... } }，id 嵌套在 conversation 中
    if (result && result.conversation) {
      state.currentConversationId = result.conversation.id;
    }

    // 清空当前消息
    state.aiMessages = [];
    if (elements.aiMessageList) {
      elements.aiMessageList.innerHTML = '';
    }
    state.aiStreaming = false;
    state.aiCurrentMessageId = null;
    state.aiCancelledByUser = false;
    state.aiCancelledMessageId = null;
    state.referencedTabs = [];
    if (elements.aiContextPills) {
      elements.aiContextPills.innerHTML = '';
    }

    // 注意：主进程 createNewConversation() 已完成 Agent 重建（_cleanupCurrentAgent + _recreateAgent），
    // 无需再调用 ai.newConversation()，否则会产生重复对话记录

    // 刷新对话列表
    await loadConversations();

    console.log('[Realm Renderer] 新对话已创建');
  } catch (err) {
    console.error('[Realm Renderer] 创建新对话失败:', err);
  }
}

/**
 * 显示对话右键菜单
 * @param {MouseEvent} e - 鼠标事件
 * @param {string} conversationId - 对话 ID
 * @param {string} title - 对话标题
 */
function showConvContextMenu(e, conversationId, title) {
  // 移除已有菜单
  closeConvContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu ai-conv-context-menu';
  menu.id = 'aiConvContextMenuActive';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  // 重命名选项
  const renameItem = document.createElement('div');
  renameItem.className = 'context-menu-item';
  renameItem.textContent = '重命名';
  renameItem.addEventListener('click', (e) => {
    // 阻断同一次点击冒泡到 document 级关闭器（G-42-5/G-42-6）：菜单挂在
    // document.body，冒泡会被外部点击关闭器判为「面板外」关掉下拉面板
    // （行内编辑框随之隐藏），并被 handleConvContextMenuClose 二次重入
    e.stopPropagation();
    closeConvContextMenu();
    renameConversation(conversationId);
  });

  // 分隔线
  const separator = document.createElement('div');
  separator.className = 'context-menu-separator';

  // 删除选项
  const deleteItem = document.createElement('div');
  deleteItem.className = 'context-menu-item';
  deleteItem.style.color = 'var(--danger-color)';
  deleteItem.textContent = '删除';
  deleteItem.addEventListener('click', (e) => {
    // 同上（G-42-5/G-42-6）：阻断冒泡，防止删除确认目标在弹框打开前被 closer 清空
    e.stopPropagation();
    closeConvContextMenu();
    showDeleteConfirm(conversationId, title);
  });

  menu.appendChild(renameItem);
  menu.appendChild(separator);
  menu.appendChild(deleteItem);

  document.body.appendChild(menu);

  // 点击外部关闭菜单
  setTimeout(() => {
    document.addEventListener('click', handleConvContextMenuClose);
  }, 0);
}

/**
 * 关闭对话右键菜单的全局点击处理器
 */
function handleConvContextMenuClose() {
  closeConvContextMenu();
  document.removeEventListener('click', handleConvContextMenuClose);
}

/**
 * 关闭对话右键菜单
 */
function closeConvContextMenu() {
  const existing = document.getElementById('aiConvContextMenuActive');
  if (existing) {
    existing.remove();
  }
}

/**
 * 重命名对话
 * 将对话标题替换为可编辑的 input 输入框
 * @param {string} conversationId - 对话 ID
 */
function renameConversation(conversationId) {
  const item = elements.aiConvList.querySelector(`[data-conversation-id="${conversationId}"]`);
  if (!item) return;

  const titleEl = item.querySelector('.ai-conv-item-title');
  if (!titleEl) return;

  const currentTitle = titleEl.title || titleEl.textContent;

  // 创建输入框
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentTitle;
  input.style.cssText = `
    width: 100%;
    background: var(--bg-primary);
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 14px;
    padding: 2px 6px;
    outline: none;
  `;

  // 替换标题元素
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  // 编辑态下点击输入框只用于定位光标 / 选择文本，必须拦在列表项之外：
  // 输入框是 .ai-conv-item 的子孙，click 冒泡到列表项会走
  // switchConversation()（renderer.js:7337）→ closeConvDropdown()，
  // 结果是一点输入框就切走对话并关掉面板，正在编辑的输入框被销毁
  input.addEventListener('click', (e) => e.stopPropagation());

  // 收尾只允许发生一次：renderConvList() 会移除持有焦点的输入框，浏览器随即
  // 派发 blur（实测），没有这道闸时 Escape 取消会被 blur 二次提交覆盖 ——
  // 用户按 Escape 想放弃修改，结果反而把输入框里的内容写进了标题
  let settled = false;

  const submitRename = async () => {
    if (settled) return;
    settled = true;
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      try {
        await window.realmAPI.conversationAPI.renameConversation(conversationId, newTitle);
        // 更新本地状态
        const conv = state.conversations.find(c => c.id === conversationId);
        if (conv) {
          conv.title = newTitle;
        }
      } catch (err) {
        console.error('[Realm Renderer] 重命名对话失败:', err);
      }
    }
    renderConvList();
  };

  const cancelRename = () => {
    settled = true;
    renderConvList();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  });

  input.addEventListener('blur', () => {
    submitRename();
  });
}

/**
 * 显示删除确认对话框
 * @param {string} conversationId - 对话 ID
 * @param {string} title - 对话标题
 */
function showDeleteConfirm(conversationId, title) {
  if (!elements.aiConvDeleteDialog) return;

  // 删除目标挂在 dialog dataset（G-42-6）：确认处理器从 dataset 读取，
  // 不再依赖会被 closeConvContextMenu 无条件清空的共享状态
  elements.aiConvDeleteDialog.dataset.conversationId = String(conversationId);

  // 更新确认文案
  if (elements.aiConvDeleteMsg) {
    elements.aiConvDeleteMsg.textContent = `确定要删除「${title}」吗？此操作不可撤销。`;
  }

  // 显示对话框：显隐走 showModal()/close() 原生机制，不做 style.display 手动切换
  // （display:flex 会干扰 dialog 的 margin:auto 居中布局，见 AGENTS.md 弹框居中约定）
  if (elements.aiConvDeleteDialog.showModal) {
    elements.aiConvDeleteDialog.showModal();
  }
}

/**
 * 关闭删除确认对话框
 */
function closeDeleteConfirm() {
  if (!elements.aiConvDeleteDialog) return;
  if (elements.aiConvDeleteDialog.close) {
    elements.aiConvDeleteDialog.close();
  }
  // 清理 dataset 中的删除目标（G-42-6）
  elements.aiConvDeleteDialog.removeAttribute('data-conversation-id');
}

/**
 * 删除对话
 * 删除当前对话不再自动补建（per D-06 修订 / G-42-1）：
 * 与主进程置空语义对齐，允许到达「暂无对话」空状态
 * @param {string} conversationId - 要删除的对话 ID
 */
async function deleteConversation(conversationId) {
  try {
    await window.realmAPI.conversationAPI.deleteConversation(conversationId);

    // 删除的是当前对话：置空当前对话引用并清空消息列表（对齐主进程语义）
    if (conversationId === state.currentConversationId) {
      state.currentConversationId = null;
      state.aiMessages = [];
      if (elements.aiMessageList) {
        elements.aiMessageList.innerHTML = '';
      }
    }

    // 无条件刷新列表：空库时 renderConvList 渲染「暂无对话」空状态
    await loadConversations();

    console.log('[Realm Renderer] 对话已删除:', conversationId);
  } catch (err) {
    console.error('[Realm Renderer] 删除对话失败:', err);
  }
}

/**
 * 加载模型选择器数据
 * 从 API 获取供应商列表和模型列表，缓存到 aiModelsData
 */
async function loadModelSelectorData() {
  try {
    // 主窗口是 file:// 源，fetch localhost HTTP API 会被 CORS 拦截，
    // 走受信 IPC（preload 暴露的 realmAPI.ai）
    aiModelsData = await window.realmAPI.ai.getAvailableModels();
    updateModelSelectorButton();
  } catch (err) {
    console.error('[Realm] 加载模型选择器数据失败:', err);
  }
}

/**
 * 更新模型选择器按钮显示当前模型名
 */
function updateModelSelectorButton() {
  if (!elements.aiModelSelector || !aiModelsData) return;

  const { providers, activeProvider, activeModel } = aiModelsData;
  // 激活供应商被禁用时，按钮显示与后端 init 回落逻辑一致的第一个可用供应商
  let effProviderId = activeProvider;
  let effModel = activeModel;
  const activeVisible = providers.some(p =>
    p.id === activeProvider && p.enabled !== false && p.configured
  );
  if (!activeVisible) {
    const fallback = providers.find(p => p.enabled !== false && p.configured && p.models && p.models.length > 0);
    if (fallback) {
      effProviderId = fallback.id;
      effModel = fallback.activeModel || fallback.models[0].id;
    } else {
      effProviderId = null;
      effModel = null;
    }
  }
  if (effProviderId && effModel) {
    const modelName = effModel.length > 15 ? effModel.substring(0, 12) + '...' : effModel;
    elements.aiModelSelector.textContent = modelName + ' ▾';
  } else {
    elements.aiModelSelector.textContent = '选择模型 ▾';
  }
}

/**
 * 切换模型选择器下拉框
 */
function toggleModelDropdown() {
  if (aiModelSelectorOpen) {
    closeModelDropdown();
  } else {
    openModelDropdown();
  }
}

/**
 * 打开模型选择器下拉框
 */
function openModelDropdown() {
  // 每次打开都重新拉取数据：设置页增删模型/供应商后保持同步，
  // 避免使用过期缓存（aiModelsData 是内存缓存，设置页变更不会主动推送）
  loadModelSelectorData().then(() => {
    if (!aiModelsData || !elements.aiModelSelector) return;

    aiModelSelectorOpen = true;
    renderModelDropdown();

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener('pointerdown', handleModelDropdownOutsideClick);
    }, 0);
  });
}

/**
 * 关闭模型选择器下拉框
 */
function closeModelDropdown() {
  aiModelSelectorOpen = false;
  const dropdown = document.querySelector('.ai-model-dropdown');
  if (dropdown) dropdown.remove();
  document.removeEventListener('pointerdown', handleModelDropdownOutsideClick);
}

/**
 * 点击外部关闭下拉框
 */
function handleModelDropdownOutsideClick(e) {
  if (!elements.aiModelSelector) return;
  const dropdown = document.querySelector('.ai-model-dropdown');
  if (dropdown && !dropdown.contains(e.target) && !elements.aiModelSelector.contains(e.target)) {
    closeModelDropdown();
  }
}

// ==================== AI 上下文用量显示 ====================

/** 上下文圆环周长（r=15） */
const CONTEXT_RING_CIRCUMFERENCE = 2 * Math.PI * 15;
/** 上下文用量数据缓存（agent_end 事件与主动拉取共用） */
let contextUsageData = null;
/** 上下文弹框是否打开 */
let contextPopoverOpen = false;
/** 分类明细色板（分段条与明细色点共用） */
const CONTEXT_BREAKDOWN_COLORS = {
  system: '#a78bfa',
  tools: '#4ade80',
  messages: '#f59e0b',
  attachments: '#f472b6',
};

/**
 * token 数格式化（93500 → 93.5K，620 → 620）
 * @param {number} n - token 数
 * @returns {string} 格式化文本
 */
function formatContextTokens(n) {
  if (!n || n <= 0) return '0';
  if (n >= 1000) {
    const k = n / 1000;
    return (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + 'K';
  }
  return String(n);
}

/**
 * 应用上下文用量数据到圆环按钮与弹框
 * @param {Object} usage - { contextWindow, usedTokens, percent, breakdown }
 */
function applyContextUsage(usage) {
  if (!usage) return;
  contextUsageData = usage;

  const percent = usage.percent || 0;
  const level = percent >= 90 ? 'level-crit' : percent >= 70 ? 'level-warn' : 'level-ok';

  // 圆环按钮
  if (elements.aiContextBtn && elements.aiContextRing) {
    elements.aiContextBtn.classList.remove('level-ok', 'level-warn', 'level-crit');
    elements.aiContextBtn.classList.add(level);
    const filled = CONTEXT_RING_CIRCUMFERENCE * Math.min(100, percent) / 100;
    elements.aiContextRing.setAttribute('stroke-dasharray', `${filled} 999`);
  }

  // 弹框（隐藏时也更新，打开即所见即最新）
  if (elements.aiContextPopover) {
    elements.aiContextPopover.classList.remove('level-ok', 'level-warn', 'level-crit');
    elements.aiContextPopover.classList.add(level);
  }
  if (elements.aiContextPercent) {
    elements.aiContextPercent.textContent = percent + '%';
  }
  if (elements.aiContextSub) {
    elements.aiContextSub.textContent =
      `已使用 ${formatContextTokens(usage.usedTokens)} / ${formatContextTokens(usage.contextWindow)}`;
  }

  // 分段条 + 明细列表
  if (elements.aiContextBar) {
    elements.aiContextBar.innerHTML = '';
    (usage.breakdown || []).forEach(item => {
      if (!item.tokens || item.tokens <= 0) return;
      const seg = document.createElement('div');
      seg.className = 'ai-context-bar-segment';
      // 占总上下文窗口的比例，剩余宽度保持灰色背景（未使用部分）
      const ratio = usage.contextWindow > 0 ? item.tokens / usage.contextWindow : 0;
      seg.style.width = (ratio * 100) + '%';
      seg.style.minWidth = ratio > 0 ? '2px' : '0';
      seg.style.background = CONTEXT_BREAKDOWN_COLORS[item.key] || 'var(--border-color)';
      elements.aiContextBar.appendChild(seg);
    });
  }
  if (elements.aiContextBreakdown) {
    elements.aiContextBreakdown.innerHTML = '';
    (usage.breakdown || []).forEach(item => {
      const row = document.createElement('div');
      row.className = 'ai-context-breakdown-row';

      const dot = document.createElement('span');
      dot.className = 'ai-context-breakdown-dot';
      dot.style.background = CONTEXT_BREAKDOWN_COLORS[item.key] || 'var(--border-color)';
      row.appendChild(dot);

      const name = document.createElement('span');
      name.textContent = item.label;
      row.appendChild(name);

      const pct = document.createElement('span');
      pct.className = 'ai-context-breakdown-pct';
      pct.textContent = (item.percent || 0) + '%';
      row.appendChild(pct);

      elements.aiContextBreakdown.appendChild(row);
    });
  }
}

/**
 * 从主进程拉取上下文用量并刷新 UI
 */
async function refreshContextUsage() {
  if (!window.realmAPI.ai || !window.realmAPI.ai.getContextUsage) return;
  try {
    const usage = await window.realmAPI.ai.getContextUsage();
    applyContextUsage(usage);
  } catch (err) {
    console.error('[ContextUsage] 获取上下文用量失败:', err);
  }
}

/**
 * 切换上下文用量弹框
 */
function toggleContextPopover() {
  if (contextPopoverOpen) {
    closeContextPopover();
  } else {
    openContextPopover();
  }
}

/**
 * 打开上下文用量弹框（每次打开主动拉取最新数据）
 */
function openContextPopover() {
  if (!elements.aiContextPopover) return;
  contextPopoverOpen = true;
  elements.aiContextPopover.style.display = 'block';
  refreshContextUsage();
  setTimeout(() => {
    document.addEventListener('pointerdown', handleContextPopoverOutsideClick);
  }, 0);
}

/**
 * 关闭上下文用量弹框
 */
function closeContextPopover() {
  contextPopoverOpen = false;
  if (elements.aiContextPopover) {
    elements.aiContextPopover.style.display = 'none';
  }
  document.removeEventListener('pointerdown', handleContextPopoverOutsideClick);
}

/**
 * 点击弹框与按钮之外的区域时关闭弹框
 * @param {MouseEvent} e - 指针按下事件
 */
function handleContextPopoverOutsideClick(e) {
  if (!elements.aiContextPopover || !elements.aiContextBtn) return;
  if (!elements.aiContextPopover.contains(e.target) && !elements.aiContextBtn.contains(e.target)) {
    closeContextPopover();
  }
}

/**
 * 渲染模型下拉框
 */
function renderModelDropdown() {
  // 移除旧下拉框
  const oldDropdown = document.querySelector('.ai-model-dropdown');
  if (oldDropdown) oldDropdown.remove();

  if (!aiModelsData || !elements.aiModelSelector) return;

  const { providers, activeProvider, activeModel } = aiModelsData;

  const dropdown = document.createElement('div');
  dropdown.className = 'ai-model-dropdown';

  // 按供应商分组（禁用的供应商不展示；存储的激活记录保留，重新启用后恢复）
  const MF = window.ModelFamily;
  providers.forEach(provider => {
    if (provider.enabled === false) return;
    if (!provider.configured || !provider.models || provider.models.length === 0) return;

    const groupTitle = document.createElement('div');
    groupTitle.className = 'ai-model-group-title';
    const iconInfo = MF ? MF.getProviderIcon(provider.id) : null;
    if (MF && (iconInfo || provider.isBuiltin === false)) {
      groupTitle.innerHTML = MF.iconHtml(iconInfo && iconInfo.icon, iconInfo ? iconInfo.color : false, provider.name, iconInfo ? iconInfo.dark : false);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = provider.name;
    groupTitle.appendChild(nameSpan);
    dropdown.appendChild(groupTitle);

    provider.models.forEach(model => {
      const option = document.createElement('div');
      option.className = 'ai-model-option';
      if (provider.id === activeProvider && model.id === activeModel) {
        option.classList.add('active');
        // 键盘导航初始聚焦当前激活项，打开下拉即可上下移动
        option.classList.add('focused');
      }

      if (provider.id === activeProvider && model.id === activeModel) {
        const dot = document.createElement('span');
        dot.className = 'model-active-dot';
        option.appendChild(dot);
      }

      // 模型家族图标（与设置页同一词典）
      if (MF) {
        const r = MF.resolveModel(model.id);
        const iconWrap = document.createElement('span');
        iconWrap.className = 'ai-model-option-icon';
        iconWrap.innerHTML = MF.iconHtml(r.icon, r.color, model.name || model.id, r.darkTile);
        option.appendChild(iconWrap);
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = model.name || model.id;
      option.appendChild(nameSpan);

      option.addEventListener('click', () => {
        selectModel(provider.id, model.id);
      });

      dropdown.appendChild(option);
    });
  });

  // 挂载到模型选择器的父节点
  elements.aiModelSelector.parentNode.appendChild(dropdown);

  // 打开即定位到当前激活项（列表深处时不再停留在第一页）
  const focusedOption = dropdown.querySelector('.ai-model-option.focused');
  if (focusedOption) {
    scrollModelDropdownToOption(focusedOption, true);
  }
}

/**
 * 选择模型并激活对应供应商
 * @param {string} providerId - 供应商 ID
 * @param {string} modelId - 模型 ID
 */
async function selectModel(providerId, modelId) {
  // 关闭下拉框
  closeModelDropdown();

  // 先更新后端配置，成功后再更新 UI（避免请求失败时 UI 与后端状态不一致）
  // 主窗口是 file:// 源，fetch localhost HTTP API 会被 CORS 拦截，走受信 IPC
  try {
    // 自定义供应商必须传 isBuiltin: false，否则后端按内置校验报「未知提供商」
    const providerCfg = aiModelsData && aiModelsData.providers
      ? aiModelsData.providers.find(p => p.id === providerId)
      : null;
    await window.realmAPI.ai.configureProviders({
      provider: providerId,
      apiKey: '__keep__',
      model: modelId,
      isBuiltin: providerCfg ? providerCfg.isBuiltin : undefined,
    });
    // 请求成功后再更新本地缓存和按钮
    if (aiModelsData) {
      aiModelsData.activeProvider = providerId;
      aiModelsData.activeModel = modelId;
    }
    updateModelSelectorButton();
    console.log(`[Realm] 已切换模型: ${providerId}/${modelId}`);
  } catch (err) {
    console.error('[Realm] 切换模型失败:', err);
  }
}

/**
 * 将下拉容器滚动到指定选项（只滚动下拉容器自身，不用 scrollIntoView——
 * 它会连带滚动外层页面容器，导致焦点项在列表深处时视口跳回第一页）
 * @param {HTMLElement} optionEl - 目标选项元素
 * @param {boolean} [center] - true 时居中显示（打开下拉定位用），false 时贴边（键盘导航用）
 */
function scrollModelDropdownToOption(optionEl, center) {
  const dropdown = document.querySelector('.ai-model-dropdown');
  if (!dropdown || !optionEl) return;
  const elTop = optionEl.offsetTop;
  const elBottom = elTop + optionEl.offsetHeight;
  if (center) {
    dropdown.scrollTop = elTop - (dropdown.clientHeight - optionEl.offsetHeight) / 2;
    return;
  }
  if (elTop < dropdown.scrollTop) {
    dropdown.scrollTop = elTop;
  } else if (elBottom > dropdown.scrollTop + dropdown.clientHeight) {
    dropdown.scrollTop = elBottom - dropdown.clientHeight;
  }
}

/**
 * 模型选择器键盘导航
 */
function handleModelSelectorKeydown(e) {
  if (e.key === 'Escape') {
    closeModelDropdown();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const options = document.querySelectorAll('.ai-model-option');
    if (options.length === 0) return;
    const currentIdx = Array.from(options).findIndex(o => o.classList.contains('focused'));
    options.forEach(o => o.classList.remove('focused'));
    let nextIdx;
    if (e.key === 'ArrowDown') {
      nextIdx = currentIdx < options.length - 1 ? currentIdx + 1 : 0;
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : options.length - 1;
    }
    options[nextIdx].classList.add('focused');
    scrollModelDropdownToOption(options[nextIdx], false);
  } else if (e.key === 'Enter') {
    const focused = document.querySelector('.ai-model-option.focused');
    if (focused) focused.click();
  }
}

/**
 * 切换 AI 面板的显示/隐藏状态
 * 同时更新按钮激活态和面板可见性，持久化状态到 electron-store
 * 打开时加载持久化的面板宽度（D-04, D-17）并自动创建新对话（per D-06）
 */
function toggleAIPanel() {
  state.aiPanelOpen = !state.aiPanelOpen;

  if (state.aiPanelOpen) {
    elements.aiPanel.classList.remove('hidden');
    // 加载持久化的面板宽度
    loadAIPanelWidth();
    // 加载模型选择器数据
    loadModelSelectorData();
    // 加载对话列表
    loadConversations();
  } else {
    elements.aiPanel.classList.add('hidden');
    // 关闭对话下拉面板
    closeConvDropdown();
  }

  elements.aiPanelBtn.classList.toggle('active', state.aiPanelOpen);

  // 持久化面板状态
  try {
    window.realmAPI.setSetting('aiPanelOpen', state.aiPanelOpen);
  } catch (err) {
    console.error('[Realm Renderer] 保存 AI 面板状态失败:', err);
  }
}

/**
 * 加载持久化的 AI 面板宽度
 * 从 electron-store 读取 aiPanelWidth，如果有效则应用到面板
 */
async function loadAIPanelWidth() {
  try {
    const settings = await window.realmAPI.getSettings();
    const width = settings['aiPanelWidth'];
    if (width && width >= 280 && width <= 600) {
      elements.aiPanel.style.width = width + 'px';
    }
  } catch (err) {
    console.error('[Realm Renderer] 加载 AI 面板宽度失败:', err);
  }
}

/**
 * 渲染 AI 面板空状态
 * 当没有消息时显示引导文案（per UI-SPEC.md 文案合约）
 * @returns {HTMLElement} 空状态 DOM 元素
 */
function renderAIEmptyState() {
  const container = document.createElement('div');
  container.className = 'ai-empty-state';

  const title = document.createElement('div');
  title.className = 'ai-empty-state-title';
  title.textContent = '准备好聊天了吗？';

  const text = document.createElement('div');
  text.className = 'ai-empty-state-text';
  text.textContent = '输入消息开始与 AI 助手对话。我可以帮你导航网页、搜索历史、管理收藏。';

  container.appendChild(title);
  container.appendChild(text);

  return container;
}

/**
 * 渲染 AI 消息列表
 * 遍历 state.aiMessages，为每条消息创建气泡元素
 * 用户消息靠右蓝色，AI 消息靠左深色
 * AI 消息内容使用 marked.parse() 转换 Markdown，代码块应用语法高亮
 * 空 content 的 assistant 消息仅渲染工具卡片，不产生空气泡（G-42-8：
 * 历史恢复路径的中断残留行 / 无工具调用空行跳过 .ai-message-content，
 * 流式末条占位气泡豁免以承载 typing 指示器与流式文本）
 * 如果没有消息，显示空状态
 */
function renderAIMessages() {
  elements.aiMessageList.innerHTML = '';

  // 如果没有消息，显示空状态
  if (state.aiMessages.length === 0) {
    elements.aiMessageList.appendChild(renderAIEmptyState());
    return;
  }

  state.aiMessages.forEach((msg, index) => {
    const isUser = msg.role === 'user';
    const isLast = index === state.aiMessages.length - 1;

    // 可折叠摘要框：/compact 后的上下文摘要，默认折叠、点击展开查看正文
    if (msg.role === 'summary') {
      const box = document.createElement('div');
      box.className = 'ai-summary-box collapsed';

      const header = document.createElement('div');
      header.className = 'ai-summary-box-header';
      const icon = document.createElement('span');
      icon.className = 'ai-summary-box-icon';
      icon.textContent = '📄';
      const title = document.createElement('span');
      title.className = 'ai-summary-box-title';
      title.textContent = '上下文已压缩（点击查看摘要）';
      const chevron = document.createElement('span');
      chevron.className = 'ai-summary-box-chevron';
      chevron.textContent = '▾';
      header.appendChild(icon);
      header.appendChild(title);
      header.appendChild(chevron);

      const body = document.createElement('div');
      body.className = 'ai-summary-box-body';
      body.textContent = msg.content || '';

      header.addEventListener('click', () => {
        box.classList.toggle('collapsed');
      });

      box.appendChild(header);
      box.appendChild(body);
      elements.aiMessageList.appendChild(box);
      return;
    }

    // 系统提示条：居中小字灰色条（/clear、/compact 的执行反馈等）
    if (msg.role === 'system-note') {
      const note = document.createElement('div');
      note.className = 'ai-system-note';
      const span = document.createElement('span');
      span.textContent = msg.content;
      note.appendChild(span);
      // 压缩中：提示条尾部追加三点 loading 动画
      if (state.aiCompacting && isLast) {
        note.appendChild(createTypingIndicator());
      }
      elements.aiMessageList.appendChild(note);
      return;
    }

    // 空 content 气泡守卫（G-42-8）：assistant 且 content 为空、且不处于
    // 流式末条占位状态时，跳过 .ai-message-content 气泡的创建与挂载——
    // 无论有无工具卡片（有卡片仅渲染工具卡片容器与操作按钮，无卡片的
    // 空行不留任何可见气泡）。守卫不以工具卡片存在为前提；流式末条
    // 占位豁免（占位气泡承载 typing 指示器与流式文本覆盖）
    const skipBubble = !isUser && !msg.content && !(state.aiStreaming && isLast);

    const wrapper = document.createElement('div');
    wrapper.className = `ai-message ${isUser ? 'ai-message-user' : 'ai-message-ai'}`;

    let content = null;
    if (!skipBubble) {
      content = document.createElement('div');
      content.className = 'ai-message-content';
    }

    if (isUser) {
      // 用户气泡构建**单源**（buildUserMessageContent）：整列渲染与定向重绘共用同一份
      // 顺序契约（pill 在正文前、折叠块在附件后），不得在此保留第二份构建逻辑
      content = buildUserMessageContent(msg);
    } else if (content) {
      // AI 消息：Markdown 渲染 + DOMPurify 消毒（T-21-01）
      const sanitized = renderAIMarkdown(msg.content || '');
      if (sanitized !== null) {
        content.innerHTML = sanitized;
      } else {
        content.textContent = msg.content || '';
      }

      // 代码高亮
      content.querySelectorAll('pre code').forEach((block) => {
        if (typeof hljs !== 'undefined' && hljs.highlightElement) {
          hljs.highlightElement(block);
        }
      });
    }

    // 添加消息 ID 属性（用于工具卡片定位和操作按钮）
    if (msg.id) {
      wrapper.dataset.messageId = msg.id;
    }

    if (content) {
      wrapper.appendChild(content);
    }

    // 渲染工具卡片
    if (msg.toolExecutions && msg.toolExecutions.length > 0) {
      const toolContainer = document.createElement('div');
      toolContainer.className = 'tool-cards-container';
      msg.toolExecutions.forEach(toolExec => {
        toolContainer.appendChild(renderToolCard(toolExec));
      });
      wrapper.appendChild(toolContainer);
    }

    // 添加消息操作按钮（非流式状态下显示）
    if (msg.id && !state.aiStreaming) {
      wrapper.appendChild(createMessageActions(msg));
    }

    // 等待 AI 回复时（尚无内容），显示 typing 指示器
    if (state.aiStreaming && !isUser && isLast && !msg.content) {
      content.appendChild(createTypingIndicator());
    }

    elements.aiMessageList.appendChild(wrapper);
  });

  // 自动滚动到底部
  if (state.aiAutoScroll) {
    scrollToBottom();
  }
}

/**
 * 定向更新流式输出中的 AI 气泡内容
 * 只替换当前流式气泡的 .ai-message-content，不重建整个消息列表，
 * 避免 16ms 批次下的全量 innerHTML 重建导致气泡闪烁
 * 若气泡尚未渲染（竞态），回退到完整 renderAIMessages()
 */
function updateAIStreamingBubble() {
  const msg = state.aiMessages.find(
    m => m.role === 'assistant' && m.id === state.aiCurrentMessageId
  );
  if (!msg) return;

  const wrapper = elements.aiMessageList.querySelector(
    `[data-message-id="${msg.id}"]`
  );
  if (!wrapper) {
    renderAIMessages();
    return;
  }

  const content = wrapper.querySelector('.ai-message-content');
  if (!content) return;

  const rawText = msg.content || '';

  if (!rawText) {
    // 等待回复中：显示 typing 指示器
    // 已存在则不重复操作（每 16ms 重建会重启跳动动画，看起来像在闪）
    if (!content.querySelector('.ai-typing-indicator')) {
      content.innerHTML = '';
      content.appendChild(createTypingIndicator());
    }
  } else {
    // 有内容：渲染 Markdown 文本（DOMPurify 消毒，不显示光标/指示器）
    const sanitized = renderAIMarkdown(rawText);
    if (sanitized !== null) {
      content.innerHTML = sanitized;
    } else {
      content.textContent = rawText;
    }

    // 代码高亮（innerHTML 替换后节点是新的，需要重新高亮）
    content.querySelectorAll('pre code').forEach((block) => {
      if (typeof hljs !== 'undefined' && hljs.highlightElement) {
        hljs.highlightElement(block);
      }
    });
  }

  // 自动滚动
  if (state.aiAutoScroll) {
    scrollToBottom();
  }
}

/**
 * 定向刷新单条用户气泡（G-48-6）
 *
 * **只重绘这一条**：整列 `renderAIMessages()` 会丢滚动位置、丢掉正在流式的
 * assistant 气泡节点与 typing 指示器状态（既有 `updateAIStreamingBubble` 的设计
 * 理由同款）。故这里用 `buildUserMessageContent` 生成新的内容节点后
 * `replaceChild` 掉该 wrapper 内既有的 `.ai-message-content`。
 *
 * 用途：`result.skillInvocation` 回填 `state.aiMessages` 之后必须主动刷新这一条 ——
 * 发送起点那次 `renderAIMessages()` 早于 `await ai.prompt()` 返回，此后整轮只走
 * `updateAIStreamingBubble`（只替换 assistant 气泡），不刷新则 pill 与「技能正文」
 * 折叠块在本轮永不出现（skillInvocation 是数字世界的输入，DOM 不会自己知道）。
 *
 * 取不到 wrapper 时回落整列重绘（与 `updateAIStreamingBubble` 的竞态容错一致）。
 *
 * @param {string} messageId - 用户消息 id（`wrapper.dataset.messageId` 的定位依据）
 */
function refreshUserMessageBubble(messageId) {
  const msg = state.aiMessages.find(m => m.id === messageId);
  if (!msg || msg.role !== 'user') return;

  const wrapper = elements.aiMessageList.querySelector(
    `[data-message-id="${messageId}"]`
  );
  if (!wrapper) {
    renderAIMessages();
    return;
  }

  const next = buildUserMessageContent(msg);
  const prev = wrapper.querySelector('.ai-message-content');
  if (prev) {
    wrapper.replaceChild(next, prev);
  } else {
    wrapper.insertBefore(next, wrapper.firstChild);
  }
}

/**
 * 渲染 AI 消息的 Markdown 文本（XSS 消毒）
 * marked v5+ 移除了 HTML 转义选项，原生 HTML 会原样输出（T-21-01 原缓解
 * "marked 默认转义"实际无效）——AI 回复可能包含恶意网页提示注入的 HTML/JS，
 * 渲染到主窗口即可访问 realmAPI（读取 Cookie/历史等），必须经 DOMPurify 消毒
 * @param {string} rawText - Markdown 源文本
 * @returns {string|null} 消毒后的 HTML；marked 不可用时返回 null（调用方回退 textContent）
 */
function renderAIMarkdown(rawText) {
  if (typeof marked === 'undefined' || !marked.parse) return null;
  const html = marked.parse(rawText || '');
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(html);
  }
  // DOMPurify 未加载时降级：转义全部 HTML（宁可丢失格式，不放行 XSS）
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * 创建等待 AI 回复的 typing 指示器（三点跳动 loading）
 * @returns {HTMLElement} 指示器元素
 */
function createTypingIndicator() {
  const indicator = document.createElement('span');
  indicator.className = 'ai-typing-indicator';
  for (let i = 0; i < 3; i++) {
    indicator.appendChild(document.createElement('span'));
  }
  return indicator;
}

/**
 * 创建消息操作按钮组（复制 / 重新生成）
 * 供 renderAIMessages 全量渲染和 finalizeAIStreamingBubble 定向收尾共用
 * @param {Object} msg - 消息对象
 * @returns {HTMLElement} 操作按钮容器
 */
function createMessageActions(msg) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  // 复制按钮（所有消息都有）
  const copyBtn = document.createElement('button');
  copyBtn.className = 'message-action-btn';
  copyBtn.textContent = '复制';
  copyBtn.addEventListener('click', () => copyMessage(msg.id));
  actions.appendChild(copyBtn);

  // 重新生成按钮（仅 AI 消息）
  if (msg.role !== 'user') {
    const regenBtn = document.createElement('button');
    regenBtn.className = 'message-action-btn';
    regenBtn.textContent = '重新生成';
    regenBtn.addEventListener('click', () => regenerateMessage(msg.id));
    actions.appendChild(regenBtn);
  }

  return actions;
}

/**
 * 流式输出结束时的定向收尾
 * 只更新当前气泡：最终内容渲染（去光标）+ 追加操作按钮，
 * 不做整列表重建，消除完成瞬间的整体闪烁
 * 内部完成状态位清理（aiStreaming=false, aiCurrentMessageId=null）
 */
function finalizeAIStreamingBubble() {
  const msg = state.aiMessages.find(
    m => m.role === 'assistant' && m.id === state.aiCurrentMessageId
  );

  state.aiStreaming = false;
  state.aiCurrentMessageId = null;

  // 切换回发送按钮
  updateSendButtonState(false);

  if (!msg) {
    renderAIMessages();
    return;
  }

  const wrapper = elements.aiMessageList.querySelector(
    `[data-message-id="${msg.id}"]`
  );
  if (!wrapper) {
    renderAIMessages();
    return;
  }

  // 最终内容渲染（DOMPurify 消毒，无光标）
  const content = wrapper.querySelector('.ai-message-content');
  if (content) {
    const rawText = msg.content || '';
    const sanitized = renderAIMarkdown(rawText);
    if (sanitized !== null) {
      content.innerHTML = sanitized;
    } else {
      content.textContent = rawText;
    }
    content.querySelectorAll('pre code').forEach((block) => {
      if (typeof hljs !== 'undefined' && hljs.highlightElement) {
        hljs.highlightElement(block);
      }
    });
  }

  // 追加操作按钮（防重复）
  if (!wrapper.querySelector('.message-actions')) {
    wrapper.appendChild(createMessageActions(msg));
  }

  // 为所有历史消息添加操作按钮（流式结束后）
  state.aiMessages.forEach(m => {
    if (m.id && m.id !== msg.id) {
      const msgWrapper = elements.aiMessageList.querySelector(
        `[data-message-id="${m.id}"]`
      );
      if (msgWrapper && !msgWrapper.querySelector('.message-actions')) {
        msgWrapper.appendChild(createMessageActions(m));
      }
    }
  });

  if (state.aiAutoScroll) {
    scrollToBottom();
  }
}

/**
 * 切换发送/停止按钮状态
 * @param {boolean} isStreaming - 是否正在流式输出
 * @param {boolean} [isCompacting=false] - 是否正在压缩上下文（按钮禁用态）
 */
function updateSendButtonState(isStreaming, isCompacting = false) {
  if (!elements.aiSendBtn) return;

  if (isStreaming) {
    // 切换为停止按钮
    elements.aiSendBtn.title = '停止';
    elements.aiSendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="6" y="6" width="12" height="12" rx="2"></rect>
      </svg>
    `;
    elements.aiSendBtn.classList.add('stop-mode');
    elements.aiSendBtn.classList.remove('compacting-mode');
  } else if (isCompacting) {
    // 压缩中：禁用态旋转图标（压缩不可中断，不提供停止）
    elements.aiSendBtn.title = '正在压缩上下文…';
    elements.aiSendBtn.innerHTML = `
      <svg class="ai-btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
    `;
    elements.aiSendBtn.classList.remove('stop-mode');
    elements.aiSendBtn.classList.add('compacting-mode');
  } else {
    // 切换为发送按钮
    elements.aiSendBtn.title = '发送';
    elements.aiSendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
      </svg>
    `;
    elements.aiSendBtn.classList.remove('stop-mode');
    elements.aiSendBtn.classList.remove('compacting-mode');
  }
}

/**
 * 停止 AI 回复
 */
async function handleStopAI() {
  try {
    if (state.aiCurrentMessageId) {
      // 标记为用户主动取消
      state.aiCancelledByUser = true;
      // 记锚点（G-48-4）：无进行中轮次时不留空锚点污染下一轮（此时仍照常 abort）
      state.aiCancelledMessageId = state.aiCurrentMessageId;
    }
    await window.realmAPI.ai.abort();
    console.log('[Realm Renderer] AI 回复已停止');
  } catch (err) {
    console.error('[Realm Renderer] 停止 AI 回复失败:', err);
    state.aiCancelledByUser = false;
    state.aiCancelledMessageId = null;
  }
}

// ==================== AI 聊天附件（拖拽/粘贴） ====================

/**
 * 附件类型图标 SVG（静态字符串，innerHTML 注入安全）
 * @param {{isImage?: boolean, isDirectory?: boolean}} att - 附件元数据
 * @returns {string} 12x12 stroke SVG（currentColor 随容器文字色）
 */
function aiAttachmentTypeIcon(att) {
  if (att.isDirectory) {
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
  }
  if (att.isImage) {
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
  }
  return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
}

/** 附件数量上限（对标 openhanako：超过后新附件被丢弃并提示） */
const AI_MAX_ATTACHMENTS = 9;

/** 收藏栏书签拖拽的自定义 MIME（拖入 AI 面板时不接管，放行收藏栏自身逻辑） */
const AI_BOOKMARK_DRAG_MIME = 'application/x-realm-bookmark';

/** 大文件软提示阈值（字节）：仅提示，不拒绝 */
const AI_ATTACHMENT_SIZE_WARN = 100 * 1024 * 1024;

/**
 * 从 File 对象列表提取附件源（拖拽/粘贴统一入口的采集阶段）
 *
 * File 句柄有时效，必须在 drop/paste handler 内同步调用
 * getFilePathForFile 提取路径；无路径但带图片类型的（粘贴截图）
 * 标记为 blob 走 base64 通道。
 *
 * @param {FileList|File[]} fileList - drop/clipboardData 中的文件列表
 * @returns {{paths: string[], blobs: Array<{file: File, name: string}>}}
 */
function collectAIAttachmentSources(fileList) {
  const paths = [];
  const blobs = [];
  if (!fileList) return { paths, blobs };
  for (const file of Array.from(fileList)) {
    const filePath = window.realmAPI.getFilePathForFile(file);
    if (filePath) {
      paths.push(filePath);
    } else if (file.type && file.type.startsWith('image/')) {
      blobs.push({ file, name: file.name || '粘贴图片' });
    }
    // 既无路径又非图片的内存数据（极少见）忽略
  }
  return { paths, blobs };
}

/**
 * 统一附件入口：登记文件/截图并渲染 pills（拖拽与粘贴共用）
 *
 * - 有路径的批量走 ai:attach-files（主进程复制快照进工作区）
 * - 无路径的图片走 FileReader base64 → ai:attach-blob
 * - 超上限截断；>100MB 软提示；失败项 pushSystemNote 轻提示
 * - 不加 aiStreaming 守卫：流式回复进行中拖入下一轮附件合法
 *
 * @param {FileList|File[]} fileList - 文件列表
 */
async function attachAIFiles(fileList) {
  if (!window.realmAPI.ai || !window.realmAPI.getFilePathForFile) return;
  const { paths, blobs } = collectAIAttachmentSources(fileList);
  if (paths.length === 0 && blobs.length === 0) return;

  // 容量预检：超限部分直接丢弃并提示（部分拖入也要给反馈）
  const totalIncoming = paths.length + blobs.length;
  const remaining = AI_MAX_ATTACHMENTS - state.aiAttachments.length;
  if (remaining <= 0) {
    pushSystemNote(`附件数量已达上限（${AI_MAX_ATTACHMENTS} 个）`);
    return;
  }
  let dropped = 0;
  if (totalIncoming > remaining) {
    dropped = totalIncoming - remaining;
    paths.length = Math.min(paths.length, remaining);
  }

  const added = [];

  if (paths.length > 0) {
    try {
      const res = await window.realmAPI.ai.attachFiles(paths);
      (res.attachments || []).forEach(meta => added.push(meta));
      (res.errors || []).forEach(err => {
        pushSystemNote(`无法附加 ${err.path.split('/').pop() || err.path}：${err.reason}`);
      });
    } catch (err) {
      console.error('[Realm Renderer] 附件登记失败:', err);
      pushSystemNote(`附件登记失败：${err.message || err}`);
    }
  }

  for (const blob of blobs) {
    // blobs 也受剩余容量约束（paths 用掉部分后重新计算）
    if (state.aiAttachments.length + added.length >= AI_MAX_ATTACHMENTS) {
      dropped = Math.max(dropped, 1);
      break;
    }
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('读取图片数据失败'));
        reader.readAsDataURL(blob.file);
      });
      const res = await window.realmAPI.ai.attachBlob({ name: blob.name, mimeType: blob.file.type, base64 });
      if (res.attachment) {
        added.push(res.attachment);
      } else {
        pushSystemNote(`无法附加 ${blob.name}：${res.error || '未知错误'}`);
      }
    } catch (err) {
      pushSystemNote(`无法附加 ${blob.name}：${err.message || err}`);
    }
  }

  // 前端兜底去重（同快照路径不重复展示；主进程 sourceKey 已去重一次）
  const existingPaths = new Set(state.aiAttachments.map(a => a.path));
  const fresh = added.filter(a => !existingPaths.has(a.path));
  if (fresh.length > 0) {
    state.aiAttachments.push(...fresh);
    renderContextPills();
    // 大文件软提示
    const oversize = fresh.find(a => a.size > AI_ATTACHMENT_SIZE_WARN);
    if (oversize) {
      pushSystemNote(`附件 ${oversize.name} 较大（${(oversize.size / 1024 / 1024).toFixed(0)}MB），发送前需要一些时间复制`);
    }
  }
  if (dropped > 0) {
    pushSystemNote(`附件数量已达上限（${AI_MAX_ATTACHMENTS} 个），${dropped} 个未添加`);
  }
}

/**
 * 异步加载图片附件缩略图（pills 渲染后触发，成功/失败后重渲染一次）
 * previewUrl 形状：undefined=未加载，string=data URL，false=加载失败/超限
 * @param {string} attachmentId - 附件登记 ID
 */
async function loadAIAttachmentPreview(attachmentId) {
  const att = state.aiAttachments.find(a => a.id === attachmentId);
  if (!att || att.previewUrl !== undefined || !att.isImage || att.isDirectory) return;
  att.previewUrl = false; // 先置 false 防重入；成功后覆盖
  try {
    const res = await window.realmAPI.ai.readAttachmentPreview(attachmentId);
    att.previewUrl = res && res.dataUrl ? res.dataUrl : false;
  } catch {
    att.previewUrl = false;
  }
  if (state.aiAttachments.includes(att)) {
    renderContextPills();
  }
}

/**
 * AI 拖拽接管判定：面板可见且拖拽数据含 Files、不含收藏栏书签 MIME
 * @param {DragEvent} e - 拖拽事件
 * @returns {boolean} true = AI 面板接管该拖拽
 */
function isAIDragTarget(e) {
  if (!state.aiPanelOpen) return false;
  const types = e.dataTransfer ? Array.from(e.dataTransfer.types) : [];
  return types.includes('Files') && !types.includes(AI_BOOKMARK_DRAG_MIME);
}

/** AI 面板拖拽计数器（dragenter/dragleave 成对 +1/-1，防子元素边界闪烁） */
let aiDragCounter = 0;

/**
 * 设置拖拽遮罩可见性
 * @param {boolean} visible
 */
function setAIDropOverlay(visible) {
  state.aiDragActive = visible;
  const overlay = document.getElementById('aiDropOverlay');
  if (overlay) {
    overlay.style.display = visible ? 'flex' : 'none';
  }
}

/**
 * 初始化 AI 面板附件拖拽接管 + 输入框粘贴附件
 *
 * 拖拽参照 openhanako MainContent 全区域接管模式：
 * - #aiPanel 整面板为 drop 区域（聊天框太小），dragenter/dragleave 计数
 * - window capture 级 drop/dragend/blur 强制结束拖拽态（窗口外松手/
 *   Escape 时收不到成对事件）
 * - document 级 dragover/drop preventDefault 兜底（防文件误拖进 webview
 *   触发 file:// 导航）；drop 在冒泡阶段且未 preventDefault 时才拦，
 *   不影响收藏栏等已有元素级 drop 处理
 */
function initAIAttachments() {
  const panel = document.getElementById('aiPanel');
  if (!panel) return;

  panel.addEventListener('dragenter', (e) => {
    if (!isAIDragTarget(e)) return;
    e.preventDefault();
    aiDragCounter++;
    if (aiDragCounter === 1) setAIDropOverlay(true);
  });

  panel.addEventListener('dragover', (e) => {
    if (!isAIDragTarget(e)) return;
    e.preventDefault(); // 允许 drop 的必要条件
    e.dataTransfer.dropEffect = 'copy';
  });

  panel.addEventListener('dragleave', (e) => {
    if (!isAIDragTarget(e)) return;
    aiDragCounter = Math.max(0, aiDragCounter - 1);
    if (aiDragCounter === 0) setAIDropOverlay(false);
  });

  panel.addEventListener('drop', (e) => {
    if (!isAIDragTarget(e)) return;
    e.preventDefault();
    aiDragCounter = 0;
    setAIDropOverlay(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void attachAIFiles(e.dataTransfer.files);
    }
  });

  // 强制结束兜底：窗口外松手 / Escape / 失焦时成对事件不可依赖
  const finishDrag = () => {
    aiDragCounter = 0;
    if (state.aiDragActive) setAIDropOverlay(false);
  };
  window.addEventListener('drop', finishDrag, true);
  window.addEventListener('dragend', finishDrag, true);
  window.addEventListener('blur', finishDrag);

  // document 级兜底：只阻止浏览器默认行为（如整窗打开文件），不碰子元素
  // 的 drop 处理——收藏栏等元素 handler 在冒泡链上游已执行并 preventDefault
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    if (!e.defaultPrevented) e.preventDefault();
  });

  // 粘贴附件：file item 能解析出路径 → 走文件通道；无路径的 image item
  // （截图）→ base64 通道；处理了文件项即拦截默认粘贴，纯文本放行
  if (elements.aiInput) {
    elements.aiInput.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      let hasFile = false;
      const files = [];
      for (const item of Array.from(items)) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (!file) continue;
        hasFile = true; // 有文件项（即使最终解析不出路径）即接管本次粘贴
        files.push(file);
      }
      if (!hasFile) return;
      e.preventDefault();
      void attachAIFiles(files);
    });
  }
}

/**
 * 发送 AI 消息
 * 获取输入框内容，添加用户消息到列表，调用 AI API
 * 支持 @ 引用标签页内容注入与 `/skill:name [args]` 技能调用（48-01）
 */
async function handleSendAIMessage() {
  const text = elements.aiInput.value.trim();
  // 空正文 + 无附件直接返回（空正文但有附件时放行，marker 文本兜底语义）
  if (!text && state.aiAttachments.length === 0) return;
  // 压缩中禁止发送（含 /clear 等命令——压缩落库期间切对话会导致写串对话）
  if (state.aiCompacting) return;

  // 斜杠输入拦截：本地命令 → 技能调用预检 → 未知命令。命令/技能文本绝不进入对话历史。
  // 须在 aiStreaming 守卫之前——/clear、/compact 与技能调用支持流式回复进行中触发，
  // 各自内部先 abort（D-08：否则流式中调用技能会被静默丢弃）
  let skillRef = null;
  if (text.startsWith('/')) {
    const match = SLASH_COMMANDS.find(c =>
      text === '/' + c.name || text.startsWith('/' + c.name + ' ')
    );
    if (match) {
      elements.aiInput.value = '';
      elements.aiInput.style.height = 'auto';
      // args 走 token 取值法（与主进程 parseSkillInvocationText 同源，P-48-01）
      const args = window.SkillPickerModel.extractArgs(text);
      await match.handler(args);
      return;
    }

    // 技能分支（D-04 本地命令优先已在上方返回；技能是**第二命令源**，经 kind 判别分流，
    // 绝不并入 SLASH_COMMANDS —— 并入即被本地 handler 吞掉）
    const ref = window.SkillPickerModel.parseSkillRef(text, SLASH_COMMANDS.map(c => c.name));
    if (ref && ref.kind === 'skill') {
      // 不做本地否决（48 G-48-3）：技能集快照可能陈旧（运行期新增技能、另一窗口刚启用/
      // 禁用），而「调用那一刻实时读盘」是硬约束；存在性/启停一律由主进程当场裁定，失败经
      // 响应里的 skillError 走既有回滚链路呈现（文案与判定单源在主进程）
      skillRef = ref;
      await abortAIIfStreaming();
      // 就地复位流式状态：取消事件是异步广播的，不复位则紧随的 aiStreaming 守卫会丢弃本次调用
      state.aiStreaming = false;
      state.aiCurrentMessageId = null;
      updateSendButtonState(false);
    } else {
      // 两边都不命中：提示且不入历史
      elements.aiInput.value = '';
      elements.aiInput.style.height = 'auto';
      pushSystemNote(`未知命令 ${text.split(/\s/)[0]}，输入 / 查看可用技能与命令`);
      return;
    }
  }

  if (state.aiStreaming) return;

  // 清空输入框并重置高度
  elements.aiInput.value = '';
  elements.aiInput.style.height = 'auto';

  // 保存并清空引用的标签页
  const referencedTabs = [...state.referencedTabs];
  state.referencedTabs = [];
  renderContextPills();
  if (state.contextPickerOpen) {
    closeContextPicker();
  }

  // 保存并清空附件（referencedTabs 同款模式；快照文件不删——可能已被
  // sourceKey 去重复用或后续发送引用）
  const attachments = [...state.aiAttachments];
  state.aiAttachments = [];
  renderContextPills();

  // 气泡正文：技能调用 = **args 原文**（D-06 / UI-SPEC §用户气泡契约）；非技能路径 = text
  //（逐字节不变）。**完整语法文本 `text` 是另一个变量** —— 它只作发往主进程的 IPC 载荷
  //（D-19：由主进程解析 name/args，也让 _deriveConversationTitle 的标题不退化），
  // **不写入 content**（否则气泡会显示 `/skill:name` 原文）。
  const bubbleContent = skillRef ? skillRef.args : text;

  // 添加用户消息（附带引用标签页与附件标记，气泡中展示）
  const userMsgId = 'user-msg-' + Date.now();
  state.aiMessages.push({
    role: 'user',
    content: bubbleContent,
    id: userMsgId,
    referencedTabs: referencedTabs.map(t => ({
      tabId: t.tabId,
      title: t.title,
      containerColor: t.containerColor
    })),
    attachments: attachments.map(a => ({
      id: a.id,
      name: a.name,
      path: a.path,
      mimeType: a.mimeType,
      isImage: a.isImage,
      isDirectory: a.isDirectory,
      size: a.size
    }))
  });

  // 添加 AI 消息占位符
  const aiMsgId = 'ai-msg-' + Date.now();
  state.aiMessages.push({ role: 'assistant', content: '', id: aiMsgId });
  state.aiCurrentMessageId = aiMsgId;
  state.aiStreaming = true;

  // 切换到停止按钮
  updateSendButtonState(true);

  // 用户主动发送消息即表示想看最新内容：即使之前向上翻阅
  // （handleAIMessageScroll 已暂停自动滚动），也强制恢复并滚到底部
  state.aiAutoScroll = true;

  renderAIMessages();

  // 调用 AI API 发送消息
  try {
    let result = null;
    if ((referencedTabs.length > 0 || attachments.length > 0) && window.realmAPI.ai && window.realmAPI.ai.promptWithContext) {
      // 有 @ 引用或附件：提取 webview 内容并通过新 IPC 发送
      const tabsWithContent = referencedTabs.length > 0
        ? await extractReferencedTabsContent(referencedTabs)
        : [];
      result = await window.realmAPI.ai.promptWithContext({
        message: text,
        referencedTabs: tabsWithContent,
        attachmentIds: attachments.map(a => a.id),
        // 图片通道决策在主进程（vision 桥）：主模型支持图片则原图直发，
        // 不支持且已配置视觉模型则先转写为文字描述（见 vision-describer.js）。
        // supportsVision 参数已废弃，不再传递——ai-brand-map 词典能力位不可靠
        //（实测 mimo-v2.5-pro-ultraspeed 词典无视觉位但模型支持视觉）
      });
    } else {
      // 无 @ 引用：走原有通道
      result = await window.realmAPI.ai.prompt(text);
    }

    // 采纳主进程回传的对话 id（per G-42-2）：首条消息惰性建行后
    // renderer 才能高亮正确的当前对话
    if (result && result.conversationId) {
      state.currentConversationId = result.conversationId;
    }

    // 技能调用契约（48 D-06 / D-13）：只回填 `skillInvocation` 元数据（正文 + tier），
    // **不改写 `content`** —— 气泡正文恒为 args；折叠块的 N 与正文取本次实际读盘注入的值
    if (result && result.skillInvocation) {
      const userMsg = state.aiMessages.find(m => m.id === userMsgId);
      if (userMsg) userMsg.skillInvocation = result.skillInvocation;
      // 回填后**立即**刷新这一条气泡（G-48-6）：发送起点那次 renderAIMessages() 早于
      // IPC 返回，此后整轮只走 updateAIStreamingBubble（只替换 assistant 气泡），
      // 不主动刷新则 pill 与折叠块在本轮永不出现（只在下一次整列重绘时才补上）
      refreshUserMessageBubble(userMsgId);
    }

    // 主进程权威判定与本地预检不一致（如另一窗口刚禁用了该技能）：主进程未调用
    // agent.prompt → 移除刚推送的 user 气泡与未产出的 assistant 占位、复位流式状态、
    // 以 system-note 反馈（文案统一由主进程给，renderer 只呈现；不用 showAIError）
    if (result && result.skillError) {
      removeSkillFailureBubbles(userMsgId);
      state.aiStreaming = false;
      state.aiCurrentMessageId = null;
      updateSendButtonState(false);
      pushSystemNote(result.skillError.message);
      await loadConversations();
      return;
    }

    // 本轮 run 结束后刷新对话列表（per G-42-2）：下拉打开时记录/标题/
    // 消息数立即可见；关闭时下次打开由 toggleConvDropdown 既有刷新兜底
    await loadConversations();
  } catch (err) {
    console.error('[Realm Renderer] AI 发送消息失败:', err);
    state.aiStreaming = false;
    // 切换回发送按钮
    updateSendButtonState(false);
    renderAIMessages();
  }
}

/**
 * 三档来源徽标 / 微标的同源 title 文案（消费主进程投影的 tier，不重算判定）
 */
const SKILL_TIER_TITLES = {
  user: '用户技能（agent-workspace/skills/），同名时优先于内置与托管',
  builtin: '随包内置技能，每次启动自愈播种',
  managed: '托管技能（AI 自建，存于 managed-skills/）',
};

/**
 * 取技能来源档位的 title 文案
 * @param {string} [tier] - 主进程投影的 tier（user / builtin / managed）
 * @returns {string} 文案；未知档位返回空串（不抛错）
 */
function skillTierTitle(tier) {
  return SKILL_TIER_TITLES[tier] || '';
}

/**
 * 移除一次技能调用失败留下的本地气泡（48 D-13 推论：不留半截历史）
 *
 * 主进程在 `skillError` 路径下未调用 agent.prompt，因此本地刚推送的 user 气泡与
 * 未产出的 assistant 占位都必须撤掉 —— 只留一条 system-note 作为反馈。
 *
 * @param {string} userMsgId - 刚推送的 user 消息 id
 */
function removeSkillFailureBubbles(userMsgId) {
  const idx = state.aiMessages.findIndex(m => m.id === userMsgId);
  if (idx < 0) return;
  state.aiMessages.splice(idx, 1);
  const next = state.aiMessages[idx];
  if (next && next.role === 'assistant' && !next.content &&
      (!next.toolExecutions || next.toolExecutions.length === 0)) {
    state.aiMessages.splice(idx, 1);
  }
}

/**
 * 渲染技能调用的气泡 pill（48 D-06）：`技能` 微标 + 技能名
 *
 * **一律 DOM API + `textContent`**（T-48-03 缓解，与 renderToolCard 同款）——
 * 技能名来自磁盘（SKILL.md 所在目录名），属不可信输入，绝不进 innerHTML。
 *
 * @param {{name: string, tier?: string}} skillInvocation - 响应的技能调用元数据
 * @returns {HTMLElement} pill 行容器（`.ai-message-refs`）
 */
function renderAISkillPill(skillInvocation) {
  const row = document.createElement('div');
  row.className = 'ai-message-refs';

  const pill = document.createElement('span');
  pill.className = 'ai-message-ref-pill ai-skill-pill';

  const badge = document.createElement('span');
  badge.className = 'ai-skill-pill-badge';
  badge.textContent = '技能';

  const name = document.createElement('span');
  name.className = 'ai-message-ref-title';
  name.textContent = skillInvocation.name;

  // 来源信息在气泡内不渲染彩色徽标（避免与蓝底撞色），经 title 可达
  const tierTitle = skillTierTitle(skillInvocation.tier);
  if (tierTitle) {
    badge.title = tierTitle;
    name.title = tierTitle;
  }

  pill.appendChild(badge);
  pill.appendChild(name);
  row.appendChild(pill);
  return row;
}

/**
 * 渲染技能正文折叠块（48 D-09）：默认折叠、可展开查看本次实际注入的正文
 *
 * N 口径 = JS `String.length`（与`LIMITS.SKILLS_PROMPT_CHAR_BUDGET` 同口径，**不是字节数**）；
 * 正文经 `textContent` 注入；展开状态不持久化（与 `/compact` 摘要框一致，零新状态）。
 *
 * **入参是最小形状 `{content}`**（49-02）：气泡实例传 `{name, content}`，`manage_skill` 卡片
 * 传 `{content: params.content}` —— 两种语境复用**同一份** DOM 构建实现（不得新建第二份）。
 * 类名与 N 口径逐字未变。
 *
 * **a11y 增量的语境开关 `interactive`（49-08 / UI-49-W6-01）**
 *
 * ① 含义与缺省：`interactive = true` 时给 header 补 `role="button"` + `tabindex="0"` +
 *    随态更新的 `aria-expanded`，并响应 Enter / Space（49-02 的增量，48-UI-REVIEW Pillar 6
 *    的建议）。缺省 `true` 是为了让**不传参的调用点**（气泡）逐字保持既有行为。
 *
 * ② **卡片语境必须传 `false`，原因**：`manage_skill` 卡片把本构建产物放进 `.tool-card-content`，
 *    该容器用 `max-height: 0; overflow: hidden` 承载默认折叠。而 `overflow: hidden`
 *    **不会**把后代移出顺序焦点导航（只有 `display: none` 会）⇒ 折叠卡片上会出现一个
 *    **零可见高度**的 Tab 停靠点：焦点环被祖先裁掉、命中测试取不到它，
 *    即键盘焦点停在一个看不见的控件上（WCAG 2.4.7 Focus Visible 不达标）。
 *
 * ③ **为什么不用 `display: none` 替代**：那会把整条 `transition: max-height 200ms` 的
 *    展开 / 折叠动画一并杀掉，爆炸半径覆盖全仓**所有**工具卡片 —— 等于用一个视觉回归
 *    换一个 a11y 修复。`visibility: hidden` 的等价方案同样要动过渡与全部卡片，一并排除。
 *
 * ④ **气泡语境不受影响**：气泡里该 header 恒可见，控件可见则焦点语义成立，
 *    故增量在原位完整保留。卡片的展开 / 折叠沿用全仓既有的**鼠标语义**
 *    （契约 `49-UI-SPEC.md` 的「展开 / 折叠（卡片）」行，锁定"本阶段零改动"），
 *    本计划不改变该范式。
 *
 * @param {{name?: string, content: string}} skillInvocation - 技能正文元数据（只用 `content`）
 * @param {{interactive?: boolean}} [options] - 语境开关（缺省 `true`；卡片调用点传 `false`）
 * @returns {HTMLElement} 折叠块元素
 */
function renderSkillContentBox(skillInvocation, { interactive = true } = {}) {
  const box = document.createElement('div');
  box.className = 'ai-skill-content-box collapsed';

  const header = document.createElement('div');
  header.className = 'ai-skill-content-box-header';
  // 焦点语义只在**可见**的宿主下施加：卡片语境的宿主默认零高（见上方 JSDoc ②）
  if (interactive) {
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', 'false');
  }

  /** 折叠态切换 + `aria-expanded` 同步（点击与键盘共用同一个出口） */
  const toggleCollapsed = () => {
    box.classList.toggle('collapsed');
    // 无属性可同步的语境（卡片）不得凭空造出 `aria-expanded`
    if (interactive) {
      header.setAttribute('aria-expanded', String(!box.classList.contains('collapsed')));
    }
  };

  const title = document.createElement('span');
  title.className = 'ai-skill-content-box-title';
  title.textContent = '技能正文（' + skillInvocation.content.length + ' 字符）';

  const chevron = document.createElement('span');
  chevron.className = 'ai-skill-content-box-chevron';
  chevron.textContent = '▾';

  header.appendChild(title);
  header.appendChild(chevron);
  // 点击（鼠标语义）两种语境都保留 —— 卡片范式本就是鼠标语义
  header.addEventListener('click', toggleCollapsed);
  if (interactive) {
    header.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); // Space 默认滚动页面 —— 折叠块不接管滚动
        toggleCollapsed();
      }
    });
  }

  const body = document.createElement('div');
  body.className = 'ai-skill-content-box-body';
  body.textContent = skillInvocation.content;

  box.appendChild(header);
  box.appendChild(body);
  return box;
}

/**
 * 构建用户气泡的内容节点（**用户气泡构建的唯一实现**）
 *
 * `renderAIMessages`（整列渲染）与 `refreshUserMessageBubble`（定向重绘单条）**共用**
 * 本函数 —— 不得复制第二份：G-48-6 的修复依赖「回填后只重绘这一条」，两份构建逻辑
 * 必然漂移（一份加了 pill，另一份没加）。
 *
 * **顺序即契约**（逐字沿用 48-01/48-02 的既有顺序）：@ 引用 pill 行 → 技能调用 pill
 * （`技能` 微标 + 技能名）→ 正文（技能调用时为 args 原文，纯文本 `textContent`）
 * → 内联图片 → 非图片附件徽标行 → 技能正文折叠块（附件之后、默认折叠）。
 *
 * 技能名与正文均来自磁盘（不可信输入），一律 DOM API + `textContent`（T-48-03）。
 *
 * @param {Object} msg - 用户消息对象（`{content, referencedTabs?, skillInvocation?, attachments?}`）
 * @returns {HTMLElement} `class="ai-message-content"` 的内容容器
 */
function buildUserMessageContent(msg) {
  const content = document.createElement('div');
  content.className = 'ai-message-content';

  // @ 引用标签页标记（在气泡顶部展示，便于确认引用已随消息发出）
  if (msg.referencedTabs && msg.referencedTabs.length > 0) {
    const refRow = document.createElement('div');
    refRow.className = 'ai-message-refs';
    msg.referencedTabs.forEach(t => {
      const pill = document.createElement('span');
      pill.className = 'ai-message-ref-pill';

      const dot = document.createElement('span');
      dot.className = 'ai-message-ref-dot';
      dot.style.backgroundColor = t.containerColor || '#666';

      const title = document.createElement('span');
      title.className = 'ai-message-ref-title';
      title.textContent = t.title || '标签页';

      pill.appendChild(dot);
      pill.appendChild(title);
      refRow.appendChild(pill);
    });
    content.appendChild(refRow);
  }

  // 技能调用 pill（D-06）：`技能` 微标 + 技能名。渲染走 DOM API + textContent
  //（T-48-03），技能名来自磁盘属不可信输入
  if (msg.skillInvocation && msg.skillInvocation.name) {
    content.appendChild(renderAISkillPill(msg.skillInvocation));
  }

  // 用户消息：纯文本
  const textDiv = document.createElement('div');
  textDiv.textContent = msg.content || '';
  content.appendChild(textDiv);

  // 附件渲染：图片内联展示（截图工具同款：点击放大 + 右键下载），
  // 非图片保持徽标行（历史恢复经 getMessages attachments 列带出）
  const msgAtts = msg.attachments || [];
  const inlineImages = msgAtts.filter(a => a.isImage && !a.isDirectory);
  const badgeAtts = msgAtts.filter(a => !(a.isImage && !a.isDirectory));

  if (inlineImages.length > 0) {
    content.appendChild(renderAIAttachmentImages(inlineImages));
  }

  if (badgeAtts.length > 0) {
    const attRow = document.createElement('div');
    attRow.className = 'ai-message-refs';
    badgeAtts.forEach(att => {
      const pill = document.createElement('span');
      pill.className = 'ai-message-ref-pill ai-message-attachment-pill';
      pill.title = att.isDirectory ? `${att.name}/（目录）` : att.name;

      const badge = document.createElement('span');
      badge.className = 'ai-attachment-badge';
      badge.innerHTML = aiAttachmentTypeIcon(att);

      const name = document.createElement('span');
      name.className = 'ai-message-ref-title';
      name.textContent = att.isDirectory ? `${att.name}/` : att.name;

      pill.appendChild(badge);
      pill.appendChild(name);
      attRow.appendChild(pill);
    });
    content.appendChild(attRow);
  }

  // 技能正文折叠块（D-09）：附件之后、默认折叠、可展开查看本次实际注入的正文
  if (msg.skillInvocation && typeof msg.skillInvocation.content === 'string') {
    content.appendChild(renderSkillContentBox(msg.skillInvocation));
  }

  return content;
}

/**
 * 组装「重发路径」的权威载荷（48 D-19 / D-06）
 *
 * 气泡正文（`msg.content`）是**显示值**（技能调用时为 args 原文），不能当 IPC 载荷：
 * 有 args 时会退化为普通消息（技能正文不再注入），无 args 时为空串（静默不动作）。
 * 故由 `content` + `skillInvocation.name` 经 `buildSkillSyntaxText`（反向唯一实现）
 * **重组**完整语法文本后再发 —— 技能正文因此被再次注入。
 *
 * **两条重发路径（重新生成 / 错误重试）共用本函数，不得各写一份。**
 *
 * @param {Object} msg - 用户消息对象（`{content, skillInvocation?}`）
 * @returns {string} 完整语法文本（技能调用）或原始正文（普通消息）；无可发内容时为空串
 */
function buildResendPayload(msg) {
  if (msg && msg.skillInvocation && msg.skillInvocation.name) {
    return window.SkillPickerModel.buildSkillSyntaxText(msg.skillInvocation.name, msg.content || '');
  }
  return msg && msg.content ? msg.content : '';
}

/**
 * 拉取技能集快照（48 D-17：stale-while-revalidate 的「重拉」半边）
 *
 * 只调 `realmAPI.ai.getSkills()`（零 IO 同步投影），**绝不**调 `refreshSkills()`
 * —— 后者会触发主进程重扫并再次广播 `skills:changed`，与本监听构成自激回路（P-48-06）。
 * `digest` 相同则原地返回（技能集未变化，不重渲染、不丢 activeIndex）。
 *
 * @returns {Promise<void>}
 */
async function pullAiSkillsSnapshot() {
  if (!(window.realmAPI && window.realmAPI.ai && window.realmAPI.ai.getSkills)) return;
  try {
    const snapshot = await window.realmAPI.ai.getSkills();
    if (!snapshot || !Array.isArray(snapshot.skills)) return;
    if (snapshot.digest === state.aiSkillsDigest) return;
    state.aiSkills = snapshot.skills;
    state.aiSkillsDigest = snapshot.digest || '';
    if (state.slashPickerOpen) renderSlashPickerList();
  } catch (err) {
    // 刷新失败保留现有快照（stale-while-revalidate 语义），错误可见性归主进程诊断面
    console.warn('[Realm Renderer] 拉取技能集快照失败（沿用现有快照）:', err.message);
  }
}

/**
 * 追加一条系统提示条到消息列表并渲染
 * system-note 是纯渲染形状：只存渲染端不入库（/compact 的提示条
 * 重开对话后由 getMessages 的 <context-summary> 分支再生）
 * @param {string} content - 提示文案
 */
function pushSystemNote(content) {
  state.aiMessages.push({ id: 'note-' + Date.now(), role: 'system-note', content });
  state.aiAutoScroll = true;
  renderAIMessages();
}

/**
 * 命令执行前的流式中止处理（仿 handleStopAI）
 * 设 aiCancelledByUser 使 abort 引发的 error 事件按用户取消静默处理
 */
async function abortAIIfStreaming() {
  if (!state.aiStreaming) return;
  try {
    state.aiCancelledByUser = true;
    // 记锚点（G-48-4）：abort 引发的 error 可能在新一轮开始**之后**才到，
    // 那一刻 state.aiCurrentMessageId 已指向新气泡 —— 归属必须靠这条锚点
    state.aiCancelledMessageId = state.aiCurrentMessageId;
    await window.realmAPI.ai.abort();
  } catch (err) {
    console.error('[Realm Renderer] 中止流式回复失败:', err);
    state.aiCancelledByUser = false;
    state.aiCancelledMessageId = null;
  }
}

/**
 * /clear 命令：开启新对话
 * 复用 createNewConversation 完整链路（勿调 ai.newConversation，会重复建对话）
 * @returns {Promise<void>}
 */
async function executeSlashClear() {
  await abortAIIfStreaming();
  await createNewConversation();
  pushSystemNote('已开启新对话');
}

/**
 * /compact 命令：LLM 摘要压缩上下文
 * 历史气泡保持可见（压缩只影响 LLM 上下文，Claude Code 式语义）
 * @param {string} [args] - 可选的摘要重点说明
 * @returns {Promise<void>}
 */
async function executeSlashCompact(args) {
  await abortAIIfStreaming();

  // 压缩中：禁用发送按钮 + 消息列表显示 loading（压缩不可中断，不提供停止）
  state.aiCompacting = true;
  updateSendButtonState(false, true);
  pushSystemNote('正在压缩上下文…');
  const note = state.aiMessages[state.aiMessages.length - 1];

  try {
    const result = await window.realmAPI.ai.compactConversation({ focus: args || undefined });
    if (result && result.skipped) {
      note.content = result.message || '对话较短，无需压缩';
    } else {
      // 压缩成功：从 DB 重载显示形状（摘要折叠框 + 最近几轮），实时反映压缩态
      try {
        const messages = await window.realmAPI.conversationAPI.getMessages(state.currentConversationId);
        if (Array.isArray(messages)) {
          state.aiMessages = messages;
          state.aiMessages.push({
            id: 'note-' + Date.now(),
            role: 'system-note',
            content: `上下文已压缩：${result.before} 条 → ${result.after} 条`,
          });
        } else {
          note.content = `上下文已压缩：${result.before} 条 → ${result.after} 条`;
        }
      } catch (reloadErr) {
        console.error('[Realm Renderer] 重载压缩后消息失败:', reloadErr);
        note.content = `上下文已压缩：${result.before} 条 → ${result.after} 条`;
      }
    }
  } catch (err) {
    console.error('[Realm Renderer] 压缩上下文失败:', err);
    // 摘要在主进程先算后写，失败不动原状，消息列表无需恢复
    note.content = '压缩失败：' + (err.message || '未知错误');
  } finally {
    state.aiCompacting = false;
    updateSendButtonState(false);
    renderAIMessages();
  }
  await loadConversations();
}

// Readability 库源码缓存（null=未拉取，''=拉取失败，非空=bundle 源码）
let cachedReadabilityScript = null;

/**
 * 提取引用标签页的 webview 内容
 * 使用 webview.executeJavaScript 在 guest 上下文执行 Readability 提取
 *
 * @param {Array} referencedTabs - 引用的标签页列表
 * @returns {Promise<Array>} 包含内容的标签页数组
 */
async function extractReferencedTabsContent(referencedTabs) {
  const MAX_CONTENT_SIZE = 102400; // 100KB per D-07
  const MAX_CONCURRENT = 5; // per Pitfall 4

  // 获取 Readability 库源码（主进程缓存，首次调用后经 IPC 拉取并缓存于渲染进程）
  // 与 Phase 22 read_page_content 同一范式：bundle 直接内联进提取脚本，
  // 不走 fetch（guest 站点相对路径会 404）和 eval（严格 CSP 站点会拦截）
  if (cachedReadabilityScript === null && window.realmAPI.ai && window.realmAPI.ai.getReadabilityScript) {
    try {
      cachedReadabilityScript = await window.realmAPI.ai.getReadabilityScript() || '';
    } catch (err) {
      console.warn('[Realm Renderer] 获取 Readability 库失败，回退 innerText 提取:', err.message);
      cachedReadabilityScript = '';
    }
  }

  // 获取 webview 元素映射（state.webviews 是 tabId→webview 权威映射；
  // 不要查 DOM dataset——webview 元素未设置 data-tab-id）
  const webviewElements = state.webviews;

  // 并发提取内容（限制并发数）
  const results = [];
  for (let i = 0; i < referencedTabs.length; i += MAX_CONCURRENT) {
    const batch = referencedTabs.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      batch.map(async (tab) => {
        const webview = webviewElements.get(tab.tabId);
        if (!webview) {
          console.warn(`[Realm Renderer] 标签页 ${tab.tabId} 的 webview 不存在（可能已关闭），跳过内容提取`);
          return { ...tab, content: '' };
        }

        try {
          // 使用 executeJavaScript 提取内容（同步 IIFE，返回 JSON 字符串）
          const script = `
(function() {
  try {
    ${cachedReadabilityScript || ''}
    let content = '';
    if (typeof Readability !== 'undefined') {
      const article = new Readability(document.cloneNode(true)).parse();
      content = article && article.textContent ? article.textContent : '';
    }
    if (!content && document.body) {
      content = document.body.innerText || '';
    }
    return JSON.stringify({
      title: document.title,
      url: window.location.href,
      content: content
    });
  } catch(e) {
    return JSON.stringify({
      title: document.title,
      url: window.location.href,
      content: ''
    });
  }
})()
          `;

          const resultStr = await webview.executeJavaScript(script);
          const result = JSON.parse(resultStr);

          // 截断内容
          let content = result.content || '';
          if (content.length > MAX_CONTENT_SIZE) {
            content = content.substring(0, MAX_CONTENT_SIZE) +
              `\n[截断：原始长度 ${result.content.length} 字符]`;
          }

          return {
            tabId: tab.tabId,
            title: result.title || tab.title,
            url: result.url || tab.url,
            content
          };
        } catch (err) {
          console.warn(`[Realm Renderer] 提取标签页 ${tab.tabId} 内容失败:`, err.message);
          // 回退到仅 title + url
          return {
            tabId: tab.tabId,
            title: tab.title,
            url: tab.url,
            content: ''
          };
        }
      })
    );

    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });
  }

  return results;
}

/**
 * 初始化 AI 事件流监听
 * 监听主进程推送的 AI 事件批量更新，处理消息更新、工具执行和错误
 */
function handleAIStream() {
  if (!window.realmAPI.ai || !window.realmAPI.ai.onEventsBatch) return;

  window.realmAPI.ai.onEventsBatch((events) => {
    if (!events || !Array.isArray(events)) return;

    let needsRender = false;

    events.forEach((event) => {
      switch (event.type) {
        case 'message_update': {
          // message_update 携带完整消息内容（累积全文，非增量）
          const aiMsg = state.aiMessages.find(
            m => m.role === 'assistant' && m.id === state.aiCurrentMessageId
          );
          if (aiMsg) {
            aiMsg.content = event.content || '';
            // 定向更新流式气泡，不做整列表重建（innerHTML 全量重建
            // 每 16ms 一次会导致气泡闪烁）
            updateAIStreamingBubble();
          }
          break;
        }

        case 'tool_execution_update': {
          // 工具执行状态更新（三阶段：running/completed/failed）
          const toolMsg = state.aiMessages.find(
            m => m.role === 'assistant' && m.id === state.aiCurrentMessageId
          );
          if (toolMsg) {
            if (!toolMsg.toolExecutions) {
              toolMsg.toolExecutions = [];
            }
            const existingIdx = toolMsg.toolExecutions.findIndex(
              t => t.id === event.tool_execution_id
            );
            if (existingIdx >= 0) {
              // 终态保护：已完成/失败的工具有迟到的 running 更新时忽略
              // （主进程批量通道与立即通道的时序竞争防御）
              const existing = toolMsg.toolExecutions[existingIdx];
              if ((existing.status === 'completed' || existing.status === 'failed')
                && event.status === 'running') {
                break;
              }
              // 更新已存在的工具执行状态
              toolMsg.toolExecutions[existingIdx] = {
                ...toolMsg.toolExecutions[existingIdx],
                status: event.status,
                result: event.result,
                error: event.error,
                // 49-02 / CR-01（UI-SPEC 硬约束 1）：**终态字段必须并入，不能覆盖** ——
                // start 给 `{action, name}`、end 只给终态三键；覆盖会抹掉 `action` ⇒ 技能
                // 变体崩塌（标题退回工具名、徽标与短原因永不出现、参数区退回 content JSON 墙）。
                // **条件**并入：不带该字段的 update 事件不得抹掉已写入的标记。
                // 单一实现 = window.SkillPickerModel.mergeManageSkillMarker。
                ...(event.manage_skill
                  ? {
                    manageSkill: window.SkillPickerModel.mergeManageSkillMarker(
                      existing.manageSkill,
                      event.manage_skill
                    ),
                  }
                  : {})
              };
            } else {
              // 添加新的工具执行
              toolMsg.toolExecutions.push({
                id: event.tool_execution_id,
                name: event.tool_name,
                status: event.status,
                params: event.params,
                result: event.result,
                error: event.error,
                // 48-03（D-15）：主进程在 start 事件打好的技能标记（snake_case，与
                // tool_execution_id / tool_name 同款）。后续状态更新走 ...spread 保留。
                skillInvocation: event.skill_invocation,
                // 49-02（D-02）：`manage_skill` 的**基础标记**（action + name，start 时点）。
                // 终态三键由「已存在条目」合并分支在 end 再加 —— 见该分支的条件并入。
                manageSkill: event.manage_skill
              });
            }
            renderToolCards(state.aiCurrentMessageId);
          }
          break;
        }

        case 'context_usage': {
          // 回复结束后的上下文用量推送（圆环按钮 + 弹框刷新）
          applyContextUsage(event.usage);
          break;
        }

        case 'turn_end': {
          // 一轮对话结束：定向收尾当前气泡（最终渲染+操作按钮），
          // 不做整列表重建，消除完成瞬间闪烁
          finalizeAIStreamingBubble();
          break;
        }

        case 'error': {
          // 用户主动取消：在 AI 气泡中显示"用户已取消"
          if (state.aiCancelledByUser) {
            // 归属解算必须在**任何**状态复位之前（解算读锚点与当前轮次 id）。
            // 取消只作用于被取消的那条消息，**不得**读「当前」aiCurrentMessageId 记账 ——
            // `ai:abort` 同步返回，迟到 error 到达时当前 id 可能已指向新气泡
            // （UAT test 4：新气泡被写成取消文案、其后 15s 零增长）
            const attribution = window.AICancelState.resolveCancelAttribution(
              state.aiMessages,
              state.aiCancelledMessageId,
              state.aiCurrentMessageId
            );
            state.aiCancelledByUser = false;
            state.aiCancelledMessageId = null;
            if (attribution.targetIndex >= 0) {
              state.aiMessages[attribution.targetIndex].content = '*用户已取消*';
            }
            // 仅当锚点仍是当前轮时复位轮次状态（用户点停止的既有语义：气泡标为
            // 已取消 + 按钮切回发送）；新一轮已开始时不得越权复位，否则新轮的
            // message_update / tool_execution_update 会因 aiCurrentMessageId 被置
            // null 而整批丢弃
            if (attribution.resetRunState) {
              state.aiStreaming = false;
              state.aiCurrentMessageId = null;
              // 切换回发送按钮
              updateSendButtonState(false);
            }
            needsRender = true;
            break;
          }

          // 错误事件：停止流式状态，显示错误提示和重试按钮
          // 若 AI 占位气泡仍为空（无内容无工具卡片），移除它——
          // 错误条本身就是反馈，留个空气泡没有意义
          const placeholderIdx = state.aiMessages.findIndex(
            m => m.role === 'assistant' && m.id === state.aiCurrentMessageId
          );
          if (placeholderIdx >= 0) {
            const placeholder = state.aiMessages[placeholderIdx];
            if (!placeholder.content &&
                (!placeholder.toolExecutions || placeholder.toolExecutions.length === 0)) {
              state.aiMessages.splice(placeholderIdx, 1);
            }
          }
          state.aiStreaming = false;
          state.aiCurrentMessageId = null;
          // 切换回发送按钮
          updateSendButtonState(false);
          needsRender = true;
          // 延迟调用 showAIError，确保 renderAIMessages 先执行
          setTimeout(() => showAIError(event.message), 0);
          break;
        }
      }
    });

    if (needsRender) {
      renderAIMessages();
    }
  });
}

/**
 * 切换图片放大/缩小状态
 * 点击图片时居中显示，再次点击恢复原位
 * @param {HTMLImageElement} img - 图片元素
 */
function toggleImageZoom(img) {
  const isZoomed = img.classList.contains('image-zoomed');

  // 移除已有的放大遮罩
  const existingOverlay = document.querySelector('.image-zoom-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  if (isZoomed) {
    // 恢复原位
    img.classList.remove('image-zoomed');
    document.body.style.overflow = '';
  } else {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'image-zoom-overlay';
    overlay.addEventListener('click', () => {
      img.classList.remove('image-zoomed');
      overlay.remove();
      document.body.style.overflow = '';
    });
    document.body.appendChild(overlay);

    // 放大图片
    img.classList.add('image-zoomed');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * 显示图片右键菜单
 * @param {MouseEvent} e - 鼠标事件
 * @param {string} base64Data - 图片 base64 数据
 * @param {string} [filename] - 下载文件名（缺省 screenshot-时间戳.png）
 * @param {string} [mimeType] - 图片 mime（缺省 image/png）
 */
function showImageContextMenu(e, base64Data, filename, mimeType = 'image/png') {
  // 移除已有的菜单
  const existingMenu = document.querySelector('.image-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  // 创建菜单
  const menu = document.createElement('div');
  menu.className = 'image-context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;

  // 下载按钮
  const downloadBtn = document.createElement('div');
  downloadBtn.className = 'image-context-menu-item';
  downloadBtn.textContent = '下载图片';
  downloadBtn.addEventListener('click', () => {
    downloadImage(base64Data, filename, mimeType);
    menu.remove();
  });

  menu.appendChild(downloadBtn);
  document.body.appendChild(menu);

  // 点击其他地方关闭菜单
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

/**
 * 下载图片到本地
 * @param {string} base64Data - 图片 base64 数据
 * @param {string} [filename] - 下载文件名
 * @param {string} [mimeType] - 图片 mime（决定 data URL 前缀）
 */
function downloadImage(base64Data, filename, mimeType = 'image/png') {
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${base64Data}`;
  link.download = filename || `screenshot-${Date.now()}.png`;
  link.click();
}

/**
 * 渲染单个工具执行卡片
 * 创建可折叠的工具卡片，显示工具名称、状态图标和执行详情
 * 参数和结果使用 textContent 设置，防止 XSS（T-21-03 缓解）
 * @param {Object} toolExecution - 工具执行对象
 * @param {string} toolExecution.id - 工具执行 ID
 * @param {string} toolExecution.name - 工具名称
 * @param {string} toolExecution.status - 执行状态：'running' | 'completed' | 'failed'
 * @param {Object} toolExecution.params - 工具参数
 * @param {*} toolExecution.result - 执行结果
 * @param {string} toolExecution.error - 错误信息
 * @returns {HTMLElement} 工具卡片 DOM 元素
 */
function renderToolCard(toolExecution) {
  const card = document.createElement('div');
  card.className = 'tool-card';
  card.dataset.toolId = toolExecution.id;

  // 状态图标
  const statusIcon = document.createElement('span');
  statusIcon.className = 'tool-card-icon';
  if (toolExecution.status === 'running') {
    statusIcon.classList.add('tool-icon-spin');
    statusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg>';
  } else if (toolExecution.status === 'completed') {
    statusIcon.classList.add('tool-icon-success');
    statusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
  } else {
    statusIcon.classList.add('tool-icon-error');
    statusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
  }

  // 工具名称（execute_action 显示具体 action；技能读取变体 / manage_skill 变体显示技能化标题）
  const name = document.createElement('span');
  name.className = 'tool-card-name';
  const manageSkill = toolExecution.manageSkill;
  const skillInvocation = toolExecution.skillInvocation;
  // 白名单查表：动作标题表外 / 缺失 ⇒ 整个技能变体不成立（回落既有普通卡片，零回归）
  const manageLabel = manageSkill
    ? window.SkillPickerModel.MANAGE_SKILL_ACTION_LABEL[manageSkill.action]
    : null;
  const manageSkillOk = !!(manageSkill && typeof manageSkill.name === 'string'
    && manageSkill.name.trim() !== '' && manageLabel);
  if (manageSkillOk) {
    // 49-02（D-02）：`manage_skill` 技能变体。判定已在工具事件生成侧完成
    // （`_resolveManageSkillMarker`），此处只查三张白名单表（动作标题 / 来源徽标 / 短原因）——
    // **零**路径字符串匹配、**零**来源档位 / 撞名 / 限额判定（硬约束 4）。
    // 技能名一律 DOM API + textContent，不写进 HTML 模板拼接、不写进属性值
    // （TD-48-01 的教训面）。
    // 徽标 tier 缺失 / 表外 → 跳过（不产出 undefined 字面量进 class）。
    name.classList.add('tool-card-name-skill');
    const nameText = document.createElement('span');
    nameText.className = 'tool-card-name-text';
    // 用函数式替换：模板里的 {name} 是唯一占位符，函数式可避免 name 中的 `$` 被
    // String.replace 当作替换模式解释（技能名虽受字符集约束，此处仍不做假设）。
    nameText.textContent = manageLabel.replace('{name}', () => manageSkill.name);
    name.appendChild(nameText);
    const badge = window.SkillPickerModel.TIER_BADGE[manageSkill.tier];
    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'slash-picker-source-badge ' + badge.className;
      badgeEl.textContent = badge.label;
      badgeEl.title = badge.title;
      name.appendChild(badgeEl);
    }
    // 头部内联标注（**至多一个**，UI-SPEC §头部三个新增/复用元素 第 3 项）：
    // 失败 → 九码白名单短原因；成功且未进提示词 → 取**单源的 ≤ 4 字投影**
    // （`PROMPT_OMITTED_CARD_NOTE`，由 `STATUS_TEXT.promptOmitted` 的第二段机械派生 ——
    // 48 的 `/` 面板串逐字未变，两者共用同一单源，此处不得另写一份字面量）。
    // 取短形态的理由见 49-UI-SPEC 的 E1 overflow 收口：280px 面板下 `.tool-card-name` 仅 129px，
    // 完整两段式会越界被祖先裁切；卡片结果区已承载完整语义。
    // 两者互斥（失败态不判提示词归属）；都取不到 ⇒ **不渲染元素**（不占位、不留空元素）。
    let noteText = null;
    let noteClass = null;
    if (toolExecution.status === 'failed') {
      const shortReason = window.SkillPickerModel.MANAGE_SKILL_SHORT_REASON[manageSkill.code];
      if (shortReason) {
        noteText = shortReason;
        noteClass = 'tool-card-manage-note tool-card-manage-note-error';
      }
    } else if (toolExecution.status === 'completed'
      && manageSkill.promptIncluded === false
      && manageSkill.action !== 'delete') {
      noteText = window.SkillPickerModel.PROMPT_OMITTED_CARD_NOTE;
      noteClass = 'tool-card-manage-note tool-card-manage-note-limit';
    }
    if (noteText) {
      const noteEl = document.createElement('span');
      noteEl.className = noteClass;
      noteEl.textContent = noteText;
      name.appendChild(noteEl);
    }
  } else if (skillInvocation && skillInvocation.name) {
    // 48-03（D-15）：模型按 description 自动匹配并 read 技能正文时把卡片标题技能化。
    // 判定已在工具事件生成侧完成（主进程），此处**不**按路径字符串自行匹配。
    // 技能名与徽标一律走 DOM API + textContent（T-48-10 缓解）；tier → class / label /
    // title 一律经 SkillPickerModel.TIER_BADGE 白名单查表（表外 / 缺失 tier → 跳过徽标），
    // 不把 tier 值拼进 class 字符串，也不为该变体退回 innerHTML。
    name.classList.add('tool-card-name-skill');
    const nameText = document.createElement('span');
    nameText.className = 'tool-card-name-text';
    nameText.textContent = `使用技能「${skillInvocation.name}」`;
    name.appendChild(nameText);
    const badge = window.SkillPickerModel.TIER_BADGE[skillInvocation.tier];
    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'slash-picker-source-badge ' + badge.className;
      badgeEl.textContent = badge.label;
      badgeEl.title = badge.title;
      name.appendChild(badgeEl);
    }
  } else if (toolExecution.name === 'execute_action' && toolExecution.params?.action) {
    name.textContent = `execute_action (${toolExecution.params.action})`;
  } else {
    name.textContent = toolExecution.name;
  }

  // 状态文字
  const statusText = document.createElement('span');
  statusText.className = 'tool-card-status';
  if (toolExecution.status === 'running') {
    statusText.textContent = '正在执行...';
  } else if (toolExecution.status === 'completed') {
    statusText.textContent = '完成';
  } else {
    statusText.textContent = '失败';
  }

  // 折叠头部
  const header = document.createElement('div');
  header.className = 'tool-card-header';
  header.appendChild(statusIcon);
  header.appendChild(name);
  header.appendChild(statusText);

  // ===== manage_skill 变体的三个内容块（参数摘要 / 正文折叠块 / 结果文本）=====
  // 全部在此构造（内容区后续只做挂载）—— 使「本变体的渲染路径」是一段可整体核对的区域：
  // 参数区**不含 content**、结果区**不 JSON 序列化**、正文只在默认折叠的折叠块里出现。
  let manageParamsText = null;
  let manageContentBox = null;
  let manageResultText = null;
  if (manageSkillOk) {
    // 钩子类：**刻意的无 CSS 规则钩子**（供测试与后续阶段定位本变体，不承担任何样式职责；
    // 它不是可用样式钩子 —— 任何样式都必须落在具体元素类上）。
    card.classList.add('tool-card-manage');

    const params = toolExecution.params || {};
    // 参数摘要：剔除 content（64 KiB 正文 overall JSON 化会变成一整面 JSON 墙，
    // 且正文在 JSON 里被二次转义而不可读）。载体仍是存量 .tool-card-value（pre-wrap）。
    const summaryLines = [
      '动作：' + window.SkillPickerModel.MANAGE_SKILL_ACTION_NAME[manageSkill.action],
      '技能名：' + (typeof params.name === 'string' ? params.name : manageSkill.name),
    ];
    if (manageSkill.action !== 'delete') {
      summaryLines.push('描述：' + (typeof params.description === 'string' ? params.description : ''));
    }
    manageParamsText = summaryLines.join('\n');

    // 正文折叠块（复用 48 D-09 的**唯一**构建实现）：create / update 且**非失败态**才有
    // —— 写入未落盘时无正文可示；delete 没有正文。
    if (manageSkill.action !== 'delete'
      && toolExecution.status !== 'failed'
      && typeof params.content === 'string') {
      manageContentBox = renderSkillContentBox({ content: params.content }, { interactive: false });
    }

    // 结果区渲染**文本**而非 JSON：对象形状取 content[] 的 text 块、字符串形状原样 ——
    // 重载链路的 result 本就是文本字符串，两条链路因此渲染逐字一致（硬约束 3）。
    // details **不进**结果区（对用户无意义；code / tier / promptIncluded 已由头部承载）。
    const textOf = (value) => {
      if (typeof value === 'string') return value;
      if (value && Array.isArray(value.content)) {
        const block = value.content.find(c => c && c.type === 'text');
        if (block && typeof block.text === 'string') return block.text;
      }
      return '';
    };
    manageResultText = toolExecution.status === 'failed'
      ? (typeof toolExecution.error === 'string' ? toolExecution.error : '')
      : textOf(toolExecution.result);
  }

  // 展开内容
  const content = document.createElement('div');
  content.className = 'tool-card-content';

  // 参数区域（使用 textContent 防止 XSS）
  if (toolExecution.params) {
    const paramsSection = document.createElement('div');
    paramsSection.className = 'tool-card-params';
    const paramsLabel = document.createElement('div');
    paramsLabel.className = 'tool-card-label';
    paramsLabel.textContent = '参数';
    const paramsValue = document.createElement('pre');
    paramsValue.className = 'tool-card-value';
    // manage_skill 变体走上面的可读摘要；其余工具的参数区渲染路径逐字未变
    paramsValue.textContent = manageParamsText !== null
      ? manageParamsText
      : JSON.stringify(toolExecution.params, null, 2);
    paramsSection.appendChild(paramsLabel);
    paramsSection.appendChild(paramsValue);
    content.appendChild(paramsSection);
  }

  // 技能正文折叠块（卡片语境复用同一实例：参数区之后、结果区之前）
  if (manageContentBox) content.appendChild(manageContentBox);

  // 结果区域（使用 textContent 防止 XSS）
  if (toolExecution.result || toolExecution.error) {
    const resultSection = document.createElement('div');
    resultSection.className = 'tool-card-result';
    const resultLabel = document.createElement('div');
    resultLabel.className = 'tool-card-label';
    resultLabel.textContent = toolExecution.status === 'failed' ? '错误' : '结果';
    const resultValue = document.createElement('pre');
    resultValue.className = 'tool-card-value';
    if (manageSkillOk) {
      resultValue.textContent = manageResultText || (toolExecution.status === 'failed' ? '未知错误' : '');
    } else if (toolExecution.status === 'failed') {
      resultValue.textContent = toolExecution.error || '未知错误';
    } else {
      resultValue.textContent = typeof toolExecution.result === 'string'
        ? toolExecution.result
        : JSON.stringify(toolExecution.result, null, 2);
    }
    resultSection.appendChild(resultLabel);
    resultSection.appendChild(resultValue);
    content.appendChild(resultSection);
  }

  // 点击展开/折叠
  header.addEventListener('click', () => {
    card.classList.toggle('expanded');
  });

  card.appendChild(header);
  card.appendChild(content);

  // 截图工具特殊处理：在工具卡片下边渲染图片
  if (toolExecution.name === 'execute_action' &&
      toolExecution.params?.action === 'screenshot' &&
      toolExecution.status === 'completed' &&
      toolExecution.result) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'tool-card-image';
    const img = document.createElement('img');

    // 从 result.content 数组中提取图片数据
    let base64Data = null;
    if (toolExecution.result.content && Array.isArray(toolExecution.result.content)) {
      const imageContent = toolExecution.result.content.find(c => c.type === 'image');
      if (imageContent) {
        base64Data = imageContent.data;
      }
    }

    // 兼容其他格式
    if (!base64Data) {
      base64Data = typeof toolExecution.result === 'string'
        ? toolExecution.result
        : toolExecution.result?.data || toolExecution.result?.result;
    }

    if (base64Data) {
      img.src = `data:image/png;base64,${base64Data}`;
      img.alt = '截图';
      img.dataset.base64 = base64Data;

      // 左键点击：放大/缩小图片
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleImageZoom(img);
      });

      // 右键菜单：下载图片
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showImageContextMenu(e, base64Data);
      });

      imageContainer.appendChild(img);
      card.appendChild(imageContainer);
    }
  }

  return card;
}

/**
 * 渲染用户消息的内联图片附件（截图工具渲染同款：tool-card-image 容器 +
 * toggleImageZoom 点击放大 + showImageContextMenu 右键下载）
 *
 * 图片数据经 ai:read-attachment-image 拉取（id 优先，历史恢复走路径——
 * 主进程校验路径必须落在 attachments 目录内）；dataUrl 缓存在附件对象上
 * （msg.attachments 元素，随消息对象同生命周期），重渲染不重拉。
 *
 * @param {Array<{id: string, name: string, path: string, mimeType: string, imgUrl?: string|null}>} images - 图片附件元数据列表
 * @returns {HTMLElement} 图片容器（.ai-attachment-images）
 */
function renderAIAttachmentImages(images) {
  const wrap = document.createElement('div');
  wrap.className = 'ai-attachment-images';

  images.forEach(att => {
    const container = document.createElement('div');
    container.className = 'tool-card-image ai-attachment-image ai-attachment-image-loading';
    container.title = att.name;
    wrap.appendChild(container);

    // 挂载图片（截图工具渲染同款：toggleImageZoom 点击放大 + 右键下载）
    const appendImage = (dataUrl) => {
      container.classList.remove('ai-attachment-image-loading');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = att.name;

      // 左键点击放大/缩小（toggleImageZoom 复用）
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleImageZoom(img);
      });

      // 右键菜单下载（showImageContextMenu 复用，保留原始文件名与 mime）
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const raw = dataUrl.split(',')[1] || '';
        showImageContextMenu(e, raw, att.name, att.mimeType || 'image/png');
      });

      container.appendChild(img);
    };

    // 拉取失败（超 25MB/路径失效/重启后快照被清）：回退文件徽标
    const appendFallbackBadge = () => {
      container.classList.remove('ai-attachment-image-loading');
      const pill = document.createElement('span');
      pill.className = 'ai-message-ref-pill ai-message-attachment-pill';
      const badge = document.createElement('span');
      badge.className = 'ai-attachment-badge';
      badge.innerHTML = aiAttachmentTypeIcon(att);
      const name = document.createElement('span');
      name.className = 'ai-message-ref-title';
      name.textContent = att.name;
      pill.appendChild(badge);
      pill.appendChild(name);
      container.appendChild(pill);
    };

    // 缓存形状：undefined=未拉取，string=data URL，null=拉取失败/超限。
    // 缓存命中必须走同步挂载——此刻容器尚未被调用方 appendChild 入 DOM，
    // 任何 isConnected 检查都会恒 false（曾导致重渲染后图片永久消失）；
    // isConnected 丢弃守卫只对「经过 await 的异步路径」有意义
    if (att.imgUrl !== undefined) {
      if (att.imgUrl) {
        appendImage(att.imgUrl);
      } else {
        appendFallbackBadge();
      }
      return;
    }

    void (async () => {
      let dataUrl;
      try {
        const res = await window.realmAPI.ai.readAttachmentImage({ id: att.id, path: att.path });
        dataUrl = res && res.dataUrl ? res.dataUrl : null;
      } catch {
        dataUrl = null;
      }
      att.imgUrl = dataUrl;

      // await 期间容器可能已被全量重渲染替换：丢弃本次结果
      //（新渲染会以缓存的 att.imgUrl 走上面的同步挂载路径）
      if (!container.isConnected) return;

      if (dataUrl) {
        appendImage(dataUrl);
      } else {
        appendFallbackBadge();
      }
    })();
  });

  return wrap;
}

/**
 * 渲染指定消息的所有工具卡片
 * 清空并重新渲染该消息中的所有工具执行卡片
 * 多工具调用纵向堆叠，间距 8px
 *
 * 特殊工具卡片处理：
 * - suggest_tab_groups / apply_tab_groups: 渲染标签分组建议卡片（renderTabGroupCard）
 *   工具结果为 content 信封结构，需解包 content[].text 中的 JSON
 * - generate_script: 渲染脚本预览卡片（renderScriptPreviewCard）
 *
 * @param {string} messageId - 消息 ID
 */
function renderToolCards(messageId) {
  const msg = state.aiMessages.find(m => m.id === messageId);
  if (!msg || !msg.toolExecutions || msg.toolExecutions.length === 0) return;

  // 找到消息元素中的工具卡片容器
  const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!msgElement) return;

  let container = msgElement.querySelector('.tool-cards-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'tool-cards-container';
    msgElement.appendChild(container);
  }

  // 清空并重新渲染
  container.innerHTML = '';
  msg.toolExecutions.forEach(toolExec => {
    // 特殊工具卡片：suggest_tab_groups / apply_tab_groups 完成后渲染分组建议卡片
    if ((toolExec.name === 'suggest_tab_groups' || toolExec.name === 'apply_tab_groups') && toolExec.status === 'completed' && toolExec.result) {
      try {
        let resultData = typeof toolExec.result === 'string'
          ? JSON.parse(toolExec.result)
          : toolExec.result;
        // 工具结果信封解包：execute 返回 { content: [{ type: 'text', text: '<JSON>' }] }，
        // 分组数据在 content 的 text 字段中，需二次解析才能拿到 groups
        if (resultData && !resultData.groups && Array.isArray(resultData.content)) {
          const textBlock = resultData.content.find(
            block => block && block.type === 'text' && typeof block.text === 'string'
          );
          if (textBlock) {
            resultData = JSON.parse(textBlock.text);
          }
        }
        if (resultData && resultData.groups && resultData.groups.length > 0) {
          const tabGroupCard = renderTabGroupCard(resultData);
          if (tabGroupCard) {
            container.appendChild(tabGroupCard);
            return;
          }
        }
      } catch (err) {
        console.error('[Realm Renderer] 解析分组工具结果失败:', err.message);
      }
    }
    // 特殊工具卡片：generate_script 完成后渲染脚本预览卡片
    if (toolExec.name === 'generate_script' && toolExec.status === 'completed' && toolExec.result) {
      try {
        let resultData = typeof toolExec.result === 'string'
          ? JSON.parse(toolExec.result)
          : toolExec.result;
        // 工具结果信封解包
        if (resultData && !resultData.steps && Array.isArray(resultData.content)) {
          const textBlock = resultData.content.find(
            block => block && block.type === 'text' && typeof block.text === 'string'
          );
          if (textBlock) {
            resultData = JSON.parse(textBlock.text);
          }
        }
        if (resultData && Array.isArray(resultData.steps) && resultData.steps.length > 0) {
          const scriptCard = renderScriptPreviewCard(resultData);
          if (scriptCard) {
            container.appendChild(scriptCard);
            return;
          }
        }
      } catch (err) {
        console.error('[Realm Renderer] 解析脚本工具结果失败:', err.message);
      }
    }
    // 特殊工具卡片：organize_favorites 完成后渲染收藏夹整理方案卡片
    if (toolExec.name === 'organize_favorites' && toolExec.status === 'completed' && toolExec.result) {
      try {
        let resultData = typeof toolExec.result === 'string'
          ? JSON.parse(toolExec.result)
          : toolExec.result;
        // 工具结果信封解包
        if (resultData && !resultData.plan && Array.isArray(resultData.content)) {
          const textBlock = resultData.content.find(
            block => block && block.type === 'text' && typeof block.text === 'string'
          );
          if (textBlock) {
            resultData = JSON.parse(textBlock.text);
          }
        }
        if (resultData && Array.isArray(resultData.plan) && resultData.plan.length > 0) {
          const organizeCard = renderFavoritesOrganizeCard(resultData);
          if (organizeCard) {
            container.appendChild(organizeCard);
            return;
          }
        }
      } catch (err) {
        console.error('[Realm Renderer] 解析收藏整理工具结果失败:', err.message);
      }
    }
    // 默认工具卡片
    container.appendChild(renderToolCard(toolExec));
  });
}

/**
 * 复制消息内容到剪贴板
 * 使用 navigator.clipboard API（T-21-04：浏览器原生安全机制）
 * @param {string} messageId - 消息 ID
 */
async function copyMessage(messageId) {
  const msg = state.aiMessages.find(m => m.id === messageId);
  if (!msg) return;

  try {
    await navigator.clipboard.writeText(msg.content || '');
    showCopyToast('已复制到剪贴板');
  } catch (err) {
    console.error('[Realm Renderer] 复制消息失败:', err);
  }
}

/**
 * 重新生成 AI 消息
 * 删除当前消息及其之后的所有消息，重新发送被删除消息之前的用户消息
 *
 * 技能调用（48 D-19 / D-06）：气泡正文是 args 显示值，**不能**当载荷重发
 *（有 args 会退化为普通消息、无 args 会静默不动作），由 `buildResendPayload`
 * 重组完整语法文本后再发 —— 技能正文因此被再次注入。
 *
 * @param {string} messageId - 消息 ID
 */
async function regenerateMessage(messageId) {
  if (state.aiStreaming) return;

  const msgIndex = state.aiMessages.findIndex(m => m.id === messageId);
  if (msgIndex < 0) return;

  // 找到该消息之前的最近一条用户消息（取消息对象本身，不取其 content）
  let userMsg = null;
  for (let i = msgIndex - 1; i >= 0; i--) {
    if (state.aiMessages[i].role === 'user') {
      userMsg = state.aiMessages[i];
      break;
    }
  }

  const payload = buildResendPayload(userMsg);
  // 空值守卫以载荷为判据：技能调用在 args 为空时载荷是 `/skill:{name}`（非空）
  if (!payload) return;

  // 删除该消息及其之后的所有消息
  state.aiMessages = state.aiMessages.slice(0, msgIndex);

  // 重新发送用户消息（保留原对象字段：content 仍是 args，skillInvocation 仍带 pill/折叠块）
  const resentUserId = 'user-msg-' + Date.now();
  state.aiMessages.push({ ...userMsg, id: resentUserId });

  // 添加 AI 消息占位符
  const aiMsgId = 'ai-msg-' + Date.now();
  state.aiMessages.push({ role: 'assistant', content: '', id: aiMsgId });
  state.aiCurrentMessageId = aiMsgId;
  state.aiStreaming = true;

  renderAIMessages();

  // 调用 AI API
  try {
    const res = await window.realmAPI.ai.prompt(payload);
    if (res && res.skillError) {
      state.aiStreaming = false;
      state.aiCurrentMessageId = null;
      updateSendButtonState(false);
      pushSystemNote(res.skillError.message);
      return;
    }
    // 本次真的重新读盘并注入了新正文 → 覆盖该气泡的折叠块正文（不留旧值）
    if (res && res.skillInvocation) {
      const resent = state.aiMessages.find(m => m.id === resentUserId);
      if (resent) resent.skillInvocation = res.skillInvocation;
      // 回填后立即刷新该条气泡（G-48-6）：与发送路径同款，重发也不留旧正文 / 旧 N
      refreshUserMessageBubble(resentUserId);
    }
  } catch (err) {
    console.error('[Realm Renderer] AI 重新生成失败:', err);
    state.aiStreaming = false;
    renderAIMessages();
  }
}

/**
 * 显示复制成功提示
 * 底部居中显示，2 秒后自动消失
 * @param {string} message - 提示文字
 */
function showCopyToast(message) {
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // 2 秒后自动消失
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * 显示 AI 错误消息
 * 在消息列表底部显示错误提示，包含重试按钮
 * @param {string} errorMessage - 错误描述
 */
function showAIError(errorMessage) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'ai-error-container';

  const errorText = document.createElement('div');
  errorText.className = 'ai-error-message';
  errorText.textContent = `出现问题 — ${errorMessage || '未知错误'}。请重试或检查 AI 设置。`;

  const retryBtn = document.createElement('button');
  retryBtn.className = 'ai-retry-btn';
  retryBtn.textContent = '重试';
  retryBtn.addEventListener('click', async () => {
    errorDiv.remove();
    // 找到最后一条用户消息并重组权威载荷（技能调用需重发完整语法文本，48 D-19）
    let lastUserMsgIndex = -1;
    for (let i = state.aiMessages.length - 1; i >= 0; i--) {
      if (state.aiMessages[i].role === 'user') {
        lastUserMsgIndex = i;
        break;
      }
    }
    if (lastUserMsgIndex < 0) return;
    const retryUserMsg = state.aiMessages[lastUserMsgIndex];
    const payload = buildResendPayload(retryUserMsg);
    if (!payload) return;

    state.aiMessages = state.aiMessages.slice(0, lastUserMsgIndex + 1);
    const aiMsgId = 'ai-msg-' + Date.now();
    state.aiMessages.push({ role: 'assistant', content: '', id: aiMsgId });
    state.aiCurrentMessageId = aiMsgId;
    state.aiStreaming = true;
    renderAIMessages();
    try {
      const res = await window.realmAPI.ai.prompt(payload);
      if (res && res.skillError) {
        state.aiStreaming = false;
        state.aiCurrentMessageId = null;
        updateSendButtonState(false);
        pushSystemNote(res.skillError.message);
        return;
      }
      if (res && res.skillInvocation) {
        const target = state.aiMessages.find(m => m.id === retryUserMsg.id);
        if (target) target.skillInvocation = res.skillInvocation;
        // 回填后立即刷新该条气泡（G-48-6）：与发送 / 重发生路径同款
        refreshUserMessageBubble(retryUserMsg.id);
      }
    } catch (err) {
      console.error('[Realm Renderer] AI 重试失败:', err);
      state.aiStreaming = false;
      renderAIMessages();
    }
  });

  errorDiv.appendChild(errorText);
  errorDiv.appendChild(retryBtn);

  elements.aiMessageList.appendChild(errorDiv);
}

/**
 * 打开 AI 设置页面
 * 打开设置页面并切换到"AI 助手"分区（settings.html 中分区 id 为 ai-assistant）
 */
function openAISettings() {
  openSettingsTab('ai-assistant');
}

/**
 * 滚动消息列表到底部
 * 使用平滑滚动效果
 */
function scrollToBottom() {
  if (!elements.aiMessageList) return;
  requestAnimationFrame(() => {
    elements.aiMessageList.scrollTop = elements.aiMessageList.scrollHeight;
  });
}

/**
 * 处理消息列表的滚动事件
 * 判断用户是否滚动到接近底部，控制自动滚动状态和回到底部按钮的显示
 */
function handleAIMessageScroll() {
  const list = elements.aiMessageList;
  if (!list) return;

  const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;

  // 超过 100px 时暂停自动滚动
  if (distanceFromBottom > 100) {
    state.aiAutoScroll = false;
    elements.aiScrollToBottom.classList.add('visible');
  } else {
    state.aiAutoScroll = true;
    elements.aiScrollToBottom.classList.remove('visible');
  }
}

/**
 * 点击"回到底部"按钮的处理函数
 * 平滑滚动到底部并恢复自动滚动
 */
function handleScrollToBottomClick() {
  state.aiAutoScroll = true;
  elements.aiScrollToBottom.classList.remove('visible');
  scrollToBottom();
}

/**
 * 处理输入框的键盘事件
 * / 命令面板导航（↑/↓ 循环、Enter 执行、Esc 关闭，焦点留在输入框）
 * Enter 发送消息，Shift+Enter 换行
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleAIInputKeydown(e) {
  // / 命令面板导航：优先级高于 Enter 发送与 Escape 关面板语义
  if (state.slashPickerOpen) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      // 只在**可选中**索引集合上取模：跳过灰显行（被遮蔽 / 与本地命令同名），
      // 否则 Enter 会落在不可选中行上变成死键（UI-SPEC 由 D-11 推导）。
      const next = window.SkillPickerModel.nextSelectableIndex(
        state.slashPickerSelectable,
        state.slashPickerActiveIndex,
        e.key === 'ArrowDown' ? 1 : -1
      );
      if (next < 0) {
        // 全部不可选中 → 置 -1 后直接返回（不重渲染、不新增分支与空态文案）
        state.slashPickerActiveIndex = -1;
        return;
      }
      state.slashPickerActiveIndex = next;
      renderSlashPickerList();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSlashPicker();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 按当前高亮项直接执行（输入可能是前缀如 /cle，不能依赖文本精确匹配）
      if (!executeActiveSlashCommand()) {
        closeSlashPicker();
        handleSendAIMessage();
      }
      return;
    }
    // 其他按键（含字符输入）放行 → input 事件走过滤
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendAIMessage();
  }
}

/**
 * 执行 / 命令面板当前高亮项
 *
 * 按 `kind` 分流（命令源有两条：本地 `SLASH_COMMANDS` 与技能集，技能**不得**并入注册表）：
 * - 命令项 → 既有语义逐字节不变（清空输入框 + 关面板 + `cmd.handler(rest)`）
 * - 技能项 → **不调 handler**：把输入框值置为完整语法文本 `/skill:{name}[ {args}]`，
 *   交既定发送链路（`handleSendAIMessage()` 的技能分支 → 主进程权威解析，D-19）。
 *   不得在本处手拼语法文本（那会成为第二份实现，与 `buildSkillSyntaxText` 必然漂移），
 *   也不得在 renderer 拼增强文本 / 把技能正文塞进 message。
 *
 * args 一律由 `extractArgs`（token 取值法）取出：既有按名长切片的写法在 `/skill:<前缀>`
 * 形态下会吞掉 args 开头（P-48-01）。
 *
 * @returns {boolean} 是否有高亮项并已执行
 */
function executeActiveSlashCommand() {
  const cmd = state.slashPickerItems[state.slashPickerActiveIndex];
  if (!cmd) return false;

  const rest = window.SkillPickerModel.extractArgs(elements.aiInput.value);

  if (cmd.kind === 'command') {
    elements.aiInput.value = '';
    elements.aiInput.style.height = 'auto';
    closeSlashPicker();
    cmd.handler(rest);
    return true;
  }

  // 技能行：组装完整语法文本 → 既有发送链路（主进程解析 + 调用瞬间实时读盘）
  elements.aiInput.value = window.SkillPickerModel.buildSkillSyntaxText(cmd.name, rest);
  elements.aiInput.style.height = 'auto';
  closeSlashPicker();
  handleSendAIMessage();
  return true;
}

/**
 * 自动调整输入框高度
 * 根据内容自动增高，限制在最小和最大高度之间
 * 同时检测 @ 触发字符
 */
function handleAIInputAutoResize() {
  const input = elements.aiInput;
  if (!input) return;

  // 重置高度以获取实际 scrollHeight
  input.style.height = 'auto';

  // 计算目标高度
  const minHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ai-input-min-height')) || 40;
  const maxHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ai-input-max-height')) || 120;
  const newHeight = Math.min(Math.max(input.scrollHeight, minHeight), maxHeight);

  input.style.height = newHeight + 'px';

  // 检测 @ 触发字符
  const value = input.value;
  const lastChar = value[value.length - 1];

  if (lastChar === '@' && !state.contextPickerOpen) {
    // 打开 @ 引用面板，同时清除触发字符（避免残留，选中后无需手动删除）
    input.value = value.slice(0, -1);
    state.contextPickerOpen = true;
    state.contextPickerSearch = '';
    state.contextPickerActiveIndex = 0;
    elements.contextPickerPanel.style.display = 'flex';
    elements.contextPickerSearch.value = '';
    elements.contextPickerSearch.focus();
    renderContextPickerList();
  } else if (state.contextPickerOpen) {
    // 检查是否还有 @ 字符
    if (!value.includes('@')) {
      closeContextPicker();
    }
  }

  // 检测 / 斜杠命令触发（仅输入起始位置，保留触发字符——用户要看到 /clear 原文并回车执行）
  if (value.startsWith('/') && !state.slashPickerOpen) {
    openSlashPicker();
  } else if (state.slashPickerOpen && !value.startsWith('/')) {
    closeSlashPicker();
  } else if (state.slashPickerOpen) {
    // 继续输入 → 重新过滤
    renderSlashPickerList();
  }
}

/**
 * 打开 / 斜杠命令面板（D-17 / P8 触发点：stale-while-revalidate 起点）
 *
 * 四步顺序不可调换：置开启 → 复位 `activeIndex` → 显示面板 → **同步**渲染。
 * 第一步渲染用的是内存快照投影（`state.aiSkills`），**零延迟、无 loading 态** ——
 * 不出现骨架屏 / spinner / 「加载中」占位（快照是零 IO 视图，没有可显示的等待态）。
 *
 * 四步之后追加一次**后台刷新**（fire-and-forget）：`realmAPI.ai` 的 refreshSkills 无载荷
 * invoke → 主进程侧「重扫两个技能目录 → 必要时回写 system prompt 并广播」→ 返回刷新后的收窄投影；
 * 回来后若面板仍打开则**原地重渲染**（不关面板、不清输入框、不重置任何其他状态）。
 *
 * **刷新失败**（IPC 抛错 / AI 未初始化 / 通道缺失）一律 catch 并**保留现有快照**，
 * 面板内**零错误 UI** —— 失败可见性归主进程诊断面（Phase 50），绝不把失败渲染成空态。
 *
 * **早退边界（如实披露）**：主进程的 `syncAgentSystemPrompt()` 在 `!this.agent ||
 * !this.sandboxEnv` 时直接返回 —— AI 未初始化时该链路早退，面板显示上一次投影。
 * 此时 `sandboxEnv` 亦未建立，**根本没有任何可用的读盘环境**，降级为不刷新是唯一诚实行为；
 * 不为它发明第二套刷新路径。
 *
 * `skills:changed` 广播只重拉快照（`pullAiSkillsSnapshot`，digest 相同即早退），
 * **不得**在此之外的路径再触发刷新 —— 「广播 → 刷新 → 再广播」是自激回路（P-48-06）。
 */
function openSlashPicker() {
  state.slashPickerOpen = true;
  state.slashPickerActiveIndex = 0;
  elements.slashPickerPanel.style.display = 'block';
  renderSlashPickerList();

  // 后台刷新半边：只在通道存在时发起；不 await、不阻塞面板显示
  if (window.realmAPI && window.realmAPI.ai && window.realmAPI.ai.refreshSkills) {
    window.realmAPI.ai.refreshSkills()
      .then((snapshot) => {
        if (!state.slashPickerOpen) return;
        if (snapshot && Array.isArray(snapshot.skills)) {
          state.aiSkills = snapshot.skills;
          state.aiSkillsDigest = snapshot.digest || state.aiSkillsDigest;
        }
        renderSlashPickerList();
      })
      .catch((err) => {
        // 失败保留现有快照（stale-while-revalidate 语义），面板内零错误 UI
        console.warn('[Realm Renderer] 面板刷新技能集失败（沿用现有快照）:', err.message);
      });
  }
}

/**
 * 关闭 / 斜杠命令面板
 */
function closeSlashPicker() {
  state.slashPickerOpen = false;
  state.slashPickerActiveIndex = 0;
  elements.slashPickerPanel.style.display = 'none';
}

/**
 * 行尾状态标注的 tone → 白名单 class（**取值不参与字符串拼接**；表外 tone 不产出 class）
 */
const SLASH_STATUS_TONE_CLASS = Object.freeze({
  muted: 'slash-picker-status-muted',
  limit: 'slash-picker-status-limit',
});

/**
 * 行尾状态标注的 `title`（UI-SPEC §Copywriting 的两条固定文案，按 tone 取）：
 * - `limit`（超限两种）→ 说明「未进提示词但仍可手动调用」
 * - `muted`（被遮蔽 / 与本地命令同名）→ 说明「本行不可调用」
 */
const SLASH_STATUS_TITLE = Object.freeze({
  limit: '未进入模型提示词，但仍可手动调用（/skill:名字）',
  muted: '本行不可调用；/skill:名字 作用于胜出的用户技能',
});

/**
 * 渲染 / 面板列表（技能分区 + 命令分区，展平单数组）
 *
 * 不变式（D-01 + UI-SPEC）：`state.slashPickerItems` 是**展平单数组**且**数组顺序 ===
 * 视觉渲染顺序**；分组标题只在渲染层插入、**不占索引**。空分组标题整个不输出。
 *
 * 行内容五要素（从左到右）：`/{name}` → 来源徽标（三档，查 `TIER_BADGE`）→ explicit-only 标记
 * （仅 `disableModelInvocation === true`）→ 单行截断描述 → 行尾状态标注。不显示体积 /
 * 文件数 / 诊断计数（那是 Phase 50 设置页的职责）。
 *
 * 绑定按**扁平索引**直绑（`data-index`），不再按名字反查 —— 同名两行（技能名 = 本地
 * 命令名）时反查会命中第一行，表现为「点了没反应 / 点了做错事」（P-48-04）。
 * 不可选中行**不绑任何处理器**，`active` 高亮也不会落在它上面。
 *
 * 面板内插入的磁盘来源文本（技能 name / description / title）**一律**经 `escapeHtml()`
 * （T-48-07）；tier → class 走 `TIER_BADGE` 白名单查表，**不把 tier 值拼进 class 字符串**。
 */
function renderSlashPickerList() {
  const list = elements.slashPickerList;
  if (!list) return;

  const value = elements.aiInput ? elements.aiInput.value : '';
  const rawFilter = value.slice(1).split(/\s/)[0].toLowerCase();
  const built = window.SkillPickerModel.buildPickerItems(state.aiSkills || [], SLASH_COMMANDS, rawFilter);

  state.slashPickerItems = built.items;
  state.slashPickerSelectable = window.SkillPickerModel.buildSelectableIndexes(built.items);

  // 越界守卫：收敛到最近的**可选中**索引（否则重入后停在灰显行上，Enter 变死键）
  if (state.slashPickerSelectable.indexOf(state.slashPickerActiveIndex) < 0) {
    state.slashPickerActiveIndex = state.slashPickerSelectable.length > 0
      ? state.slashPickerSelectable[0]
      : -1;
  }

  if (built.items.length === 0) {
    list.innerHTML = '<div class="slash-picker-row slash-picker-row-empty">' +
      '<span class="slash-picker-desc">无匹配技能或命令，输入 / 查看全部</span></div>';
    return;
  }

  let html = '';
  built.items.forEach((item, index) => {
    // 分组标题：只在分区有命中时输出；不带 data-index、不参与索引、不绑处理器
    if (index === 0 && built.skillCount > 0) {
      html += '<div class="slash-picker-group-header">技能</div>';
    }
    if (index === built.skillCount && built.commandCount > 0) {
      html += '<div class="slash-picker-group-header">命令</div>';
    }

    const isActive = item.selectable === true && index === state.slashPickerActiveIndex;
    const rowClasses = ['slash-picker-row'];
    if (item.kind === 'skill') rowClasses.push('slash-picker-row-skill');
    if (item.selectable !== true) rowClasses.push('slash-picker-row-disabled');
    if (isActive) rowClasses.push('active');

    // 来源徽标：三档唯一权威查表（表外 / 缺失 tier → 整个徽标不渲染，不产出 undefined）
    const badge = item.kind === 'skill' ? window.SkillPickerModel.TIER_BADGE[item.tier] : null;
    const badgeHtml = badge
      ? '<span class="slash-picker-source-badge ' + badge.className + '" title="' +
        escapeHtml(badge.title) + '">' + escapeHtml(badge.label) + '</span>'
      : '';
    // explicit-only 标记：只由 disableModelInvocation 决定；不改变可选中性（DISC-07 clause ③）
    // label / title 的唯一权威是 src/skill-picker-model.js 的 EXPLICIT_TAG（与设置页「技能管理」区共用，
    // Phase 50 硬前置条件 —— 本行不再内联字面量，渲染结果逐字不变）
    const explicitTag = item.kind === 'skill' && item.disableModelInvocation === true
      ? '<span class="slash-picker-tag-explicit" title="' +
        escapeHtml(window.SkillPickerModel.EXPLICIT_TAG.title) + '">' +
        escapeHtml(window.SkillPickerModel.EXPLICIT_TAG.label) + '</span>'
      : '';
    const rowTitle = item.kind === 'skill'
      ? ' title="' + escapeHtml('/skill:' + item.name + ' 可显式调用') + '"'
      : '';
    const statusHtml = item.statusText
      ? '<span class="slash-picker-status ' + (SLASH_STATUS_TONE_CLASS[item.statusTone] || '') + '" title="' +
        escapeHtml(SLASH_STATUS_TITLE[item.statusTone] || '') + '">' + escapeHtml(item.statusText) + '</span>'
      : '';

    html += '<div class="' + rowClasses.join(' ') + '" data-index="' + index + '"' + rowTitle + '>' +
      '<span class="slash-picker-name">/' + escapeHtml(item.name) + '</span>' +
      badgeHtml +
      explicitTag +
      '<span class="slash-picker-desc">' + escapeHtml(item.description || '') + '</span>' +
      statusHtml +
      '</div>';
  });
  list.innerHTML = html;

  // 键盘高亮项滚动到可视区域
  const activeRow = list.querySelector('.slash-picker-row.active');
  if (activeRow) {
    activeRow.scrollIntoView({ block: 'nearest' });
  }

  // 点击执行与 hover 高亮：一律按扁平索引直绑；不可选中行不绑处理器（灰显禁用态）
  list.querySelectorAll('.slash-picker-row[data-index]').forEach(row => {
    const idx = Number(row.dataset.index);
    const item = state.slashPickerItems[idx];
    if (!item || item.selectable !== true) return;
    row.addEventListener('click', () => {
      state.slashPickerActiveIndex = idx;
      executeActiveSlashCommand();
    });
    row.addEventListener('mousemove', () => {
      if (idx !== state.slashPickerActiveIndex) {
        state.slashPickerActiveIndex = idx;
        renderSlashPickerList();
      }
    });
  });
}

/**
 * 关闭 @ 引用面板
 */
function closeContextPicker() {
  state.contextPickerOpen = false;
  state.contextPickerSearch = '';
  elements.contextPickerPanel.style.display = 'none';
}

/**
 * 渲染 @ 引用标签页列表
 * 获取所有容器的标签页，按搜索关键字过滤，渲染可选列表
 */
function renderContextPickerList() {
  const list = elements.contextPickerList;
  const empty = elements.contextPickerEmpty;
  if (!list) return;

  // 获取所有标签页和容器
  const tabs = window.realmAPI.getTabs ? [] : [];
  const containers = window.realmAPI.getContainers ? [] : [];

  // 这里需要异步获取数据，先渲染加载状态
  list.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted);">加载中...</div>';

  // 异步获取数据
  Promise.all([
    window.realmAPI.getTabs(),
    window.realmAPI.getContainers()
  ]).then(([allTabs, allContainers]) => {
    const containerMap = {};
    allContainers.forEach(c => {
      containerMap[c.id] = c;
    });

    // 按搜索关键字过滤
    const keyword = state.contextPickerSearch.toLowerCase();
    const filteredTabs = allTabs.filter(tab => {
      if (!keyword) return true;
      return (tab.title && tab.title.toLowerCase().includes(keyword)) ||
             (tab.url && tab.url.toLowerCase().includes(keyword));
    });

    // 供键盘导航使用（上下键/Enter）
    state.contextPickerItems = filteredTabs;
    state.contextPickerContainerMap = containerMap;
    if (state.contextPickerActiveIndex >= filteredTabs.length) {
      state.contextPickerActiveIndex = Math.max(0, filteredTabs.length - 1);
    }

    // 渲染列表
    if (filteredTabs.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = filteredTabs.map((tab, index) => {
      const container = containerMap[tab.containerId] || { name: '未知', color: '#666' };
      const isSelected = state.referencedTabs.some(t => t.tabId === tab.id);
      const isActive = index === state.contextPickerActiveIndex;
      return `
        <div class="context-picker-row ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}" data-tab-id="${tab.id}">
          <span class="context-picker-dot" style="background-color: ${container.color}"></span>
          <span class="context-picker-container-name">${container.name}</span>
          <span class="context-picker-tab-title">${tab.title || tab.url || '空白标签页'}</span>
          ${isSelected ? '<svg class="context-picker-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </div>
      `;
    }).join('');

    // 键盘高亮项滚动到可视区域
    const activeRow = list.querySelector('.context-picker-row.active');
    if (activeRow) {
      activeRow.scrollIntoView({ block: 'nearest' });
    }

    // 绑定点击事件
    list.querySelectorAll('.context-picker-row').forEach(row => {
      row.addEventListener('click', () => {
        const tabId = row.dataset.tabId;
        toggleContextPickerTab(tabId, allTabs, containerMap);
      });
    });
  }).catch(err => {
    console.error('[Realm Renderer] 获取标签页列表失败:', err);
    list.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--danger-color);">加载失败</div>';
  });
}

/**
 * 切换标签页的选中状态
 * @param {string} tabId - 标签页 ID
 * @param {Array} allTabs - 所有标签页
 * @param {Object} containerMap - 容器映射
 */
function toggleContextPickerTab(tabId, allTabs, containerMap) {
  const existingIndex = state.referencedTabs.findIndex(t => t.tabId === tabId);

  if (existingIndex >= 0) {
    // 取消选中
    state.referencedTabs.splice(existingIndex, 1);
  } else {
    // 选中
    const tab = allTabs.find(t => t.id === tabId);
    if (tab) {
      const container = containerMap[tab.containerId] || { name: '未知', color: '#666' };
      state.referencedTabs.push({
        tabId: tab.id,
        title: tab.title || tab.url || '空白标签页',
        url: tab.url || '',
        containerId: tab.containerId,
        containerName: container.name,
        containerColor: container.color
      });
    }
  }

  // 重新渲染
  renderContextPickerList();
  renderContextPills();
}

/**
 * 渲染 @ 引用 Pill 列表
 * 显示已选中的标签页，支持点击 x 取消
 */
function renderContextPills() {
  const container = elements.aiContextPills;
  if (!container) return;

  if (state.referencedTabs.length === 0 && state.aiAttachments.length === 0) {
    container.classList.remove('has-items');
    container.innerHTML = '';
    return;
  }

  container.classList.add('has-items');

  // @ 引用标签页 pills（既有形状不变）
  let html = state.referencedTabs.map(tab => `
    <div class="ai-context-pill" data-tab-id="${tab.tabId}">
      <span class="ai-context-pill-dot" style="background-color: ${tab.containerColor}"></span>
      <span class="ai-context-pill-title">${tab.title}</span>
      <span class="ai-context-pill-close" data-tab-id="${tab.tabId}">×</span>
    </div>
  `).join('');

  // 附件 pills（拖拽/粘贴登记的文件与图片；图片有缩略图则替代类型徽标）
  html += state.aiAttachments.map(att => {
    const thumb = att.previewUrl && typeof att.previewUrl === 'string'
      ? `<img class="ai-attachment-pill-thumb" src="${att.previewUrl}" alt="">`
      : `<span class="ai-attachment-pill-badge">${aiAttachmentTypeIcon(att)}</span>`;
    const sizeLabel = att.size > 0 && !att.isDirectory
      ? ` <span class="ai-attachment-pill-size">${att.size > 1024 * 1024 ? (att.size / 1024 / 1024).toFixed(1) + 'MB' : Math.max(1, Math.round(att.size / 1024)) + 'KB'}</span>`
      : '';
    return `
    <div class="ai-context-pill ai-attachment-pill" data-attachment-id="${att.id}">
      ${thumb}
      <span class="ai-context-pill-title">${escapeHtml(att.name)}${sizeLabel}</span>
      <span class="ai-context-pill-close" data-attachment-id="${att.id}">×</span>
    </div>
  `;
  }).join('');

  container.innerHTML = html;

  // 绑定关闭事件（标签页引用 + 附件两类）
  container.querySelectorAll('.ai-context-pill-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.dataset.attachmentId) {
        // 仅移出待发送列表，不删快照文件（可能已被去重复用或后续发送引用）
        state.aiAttachments = state.aiAttachments.filter(a => a.id !== btn.dataset.attachmentId);
        renderContextPills();
        return;
      }
      const tabId = btn.dataset.tabId;
      state.referencedTabs = state.referencedTabs.filter(t => t.tabId !== tabId);
      renderContextPills();
      if (state.contextPickerOpen) {
        renderContextPickerList();
      }
    });
  });

  // 触发图片附件缩略图异步加载（previewUrl 为 undefined 时才发请求）
  state.aiAttachments.forEach(att => {
    if (att.isImage && !att.isDirectory && att.previewUrl === undefined) {
      void loadAIAttachmentPreview(att.id);
    }
  });
}

// ==================== 下载管理 ====================

/** @type {Map<string, Object>} 活跃下载状态：downloadId -> {filename, received, total, speed, percent, state, eta} */
const activeDownloadsMap = new Map();

/** @type {number|null} 完成状态自动恢复定时器 */
let downloadDoneTimer = null;

/** @type {number|null} tooltip hover 延迟定时器 */
let downloadTooltipHoverTimer = null;

/** @type {number|null} tooltip 离开延迟定时器 */
let downloadTooltipLeaveTimer = null;

/** @type {boolean} 用户通过点击隐藏了 tooltip，抑制 hover 重新显示 */
let tooltipClickDismissed = false;

/** @type {Set<string>} 下载面板多选模式中选中的 downloadId 集合 */
const downloadSelectedIds = new Set();

/** @type {Object|null} 待删除的下载信息 {downloadId, filename, isInProgress} */
let pendingDeleteDownload = null;

/** @type {boolean} 下载面板数据脏标记（面板关闭时收到更新，下次打开需刷新） */
let downloadPanelDirty = false;

/**
 * 初始化下载管理 UI
 * 注册下载事件监听器和按钮交互
 */
function initDownloads() {
  // 注册下载事件监听
  window.downloadAPI.onDownloadStarted(handleDownloadStarted);
  window.downloadAPI.onDownloadProgress(handleDownloadProgress);
  window.downloadAPI.onDownloadCompleted(handleDownloadCompleted);

  // 下载按钮点击切换面板显示/隐藏
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(downloadTooltipHoverTimer);
      toggleDownloadPanel();
    });

    // hover 显示 tooltip（面板打开时不显示）
    downloadBtn.addEventListener('mouseenter', () => {
      clearTimeout(downloadTooltipLeaveTimer);
      if (!state.downloadPanelOpen) {
        downloadTooltipHoverTimer = setTimeout(() => {
          showDownloadTooltip();
        }, 200);
      }
    });

    downloadBtn.addEventListener('mouseleave', () => {
      clearTimeout(downloadTooltipHoverTimer);
      downloadTooltipLeaveTimer = setTimeout(() => {
        hideDownloadTooltip();
      }, 300);
    });
  }

  // 记录 embedder 内 mousedown 落点（capture 阶段），供 media:outside-click 裁决穿透事件
  document.addEventListener('mousedown', (e) => {
    const panel = document.getElementById('downloadPanel');
    const inPanel = !!(panel && panel.contains(e.target));
    const inModal = typeof e.target.closest === 'function' && !!e.target.closest('dialog');
    lastEmbedderMousedown = { time: Date.now(), inPanel: inPanel || inModal };
  }, true);

  // 点击页面其他地方隐藏 tooltip 和下载面板
  document.addEventListener('click', (e) => {
    const tooltip = document.getElementById('downloadTooltip');
    const downloadBtnEl = document.getElementById('downloadBtn');
    const panel = document.getElementById('downloadPanel');
    if (tooltip && !tooltip.contains(e.target) && (!downloadBtnEl || !downloadBtnEl.contains(e.target))) {
      hideDownloadTooltip();
    }
    // 点击面板外部关闭面板（排除确认弹窗内的点击：弹窗是面板的兄弟节点，
    // 且确认/取消按钮的处理器会先 modal.close() 再冒泡到 document，
    // 此时 [open] 已移除，故用 closest('dialog') 而非 dialog[open]）
    const inModal = typeof e.target.closest === 'function' && e.target.closest('dialog');
    if (panel && !panel.contains(e.target) && !inModal && (!downloadBtnEl || !downloadBtnEl.contains(e.target))) {
      if (state.downloadPanelOpen) {
        closeDownloadPanel();
      }
    }
  });

  // ESC 键关闭下载面板（确认弹窗打开时 ESC 只关闭弹窗，由浏览器原生处理）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.downloadPanelOpen) {
      const modalOpen = document.getElementById('downloadDeleteModal')?.open ||
        document.getElementById('downloadClearModal')?.open;
      if (!modalOpen) {
        closeDownloadPanel();
      }
    }
  });

  // 下载面板关闭按钮
  const panelCloseBtn = document.getElementById('downloadPanelCloseBtn');
  if (panelCloseBtn) {
    panelCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDownloadPanel();
    });
  }

  // 清空所有记录按钮
  const clearBtn = document.getElementById('downloadClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleClearAllDownloads();
    });
  }

  // 查看全部按钮：打开 realm://downloads 下载页（全局共享，不区分容器）
  const viewAllBtn = document.getElementById('downloadViewAllBtn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDownloadPanel();
      // webview 无法直接加载 realm:// 自定义协议，必须走 createTab
      // （内部经 realmUrlToHttp 转换为 http://localhost:PORT/ 并注入 token）
      let existingTabId = null;
      state.tabs.forEach((tab, tabId) => {
        if (tab.url === 'realm://downloads') {
          existingTabId = tabId;
        }
      });
      if (existingTabId) {
        // 已有则切换到该 Tab 并刷新，确保显示最新数据
        switchTab(existingTabId);
        const webview = state.webviews.get(existingTabId);
        if (webview) {
          webview.reload();
        }
      } else {
        createTab(state.currentContainer, 'realm://downloads');
      }
    });
  }

  // 全部暂停按钮
  const pauseAllBtn = document.getElementById('downloadPauseAllBtn');
  if (pauseAllBtn) {
    pauseAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePauseAll();
    });
  }

  // 清空确认弹窗按钮绑定
  const clearCancelBtn = document.getElementById('downloadClearCancelBtn');
  const clearConfirmBtn = document.getElementById('downloadClearConfirmBtn');
  if (clearCancelBtn) {
    clearCancelBtn.addEventListener('click', () => {
      document.getElementById('downloadClearModal')?.close();
    });
  }
  if (clearConfirmBtn) {
    clearConfirmBtn.addEventListener('click', () => {
      document.getElementById('downloadClearModal')?.close();
      executeClearAllDownloads();
    });
  }

  // 删除确认弹窗按钮绑定
  const deleteCancelBtn = document.getElementById('downloadDeleteCancelBtn');
  const deleteConfirmBtn = document.getElementById('downloadDeleteConfirmBtn');
  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', () => {
      document.getElementById('downloadDeleteModal')?.close();
    });
  }
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', () => {
      document.getElementById('downloadDeleteModal')?.close();
      executeDeleteDownload();
    });
  }

  // 批量操作按钮
  const batchDeleteBtn = document.getElementById('downloadBatchDeleteBtn');
  const batchDeselectBtn = document.getElementById('downloadBatchDeselectBtn');
  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleBatchDelete();
    });
  }
  if (batchDeselectBtn) {
    batchDeselectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearDownloadSelection();
    });
  }

  // tooltip 自身的 hover 保持显示
  const tooltip = document.getElementById('downloadTooltip');
  if (tooltip) {
    tooltip.addEventListener('mouseenter', () => {
      clearTimeout(downloadTooltipLeaveTimer);
    });
    tooltip.addEventListener('mouseleave', () => {
      downloadTooltipLeaveTimer = setTimeout(() => {
        hideDownloadTooltip();
      }, 100);
    });
  }

  // 查询初始活跃下载数量
  updateDownloadBadge();
}

/**
 * 处理下载开始事件
 * @param {Object} data - {downloadId, filename, totalBytes, containerId}
 */
function handleDownloadStarted(data) {
  activeDownloadsMap.set(data.downloadId, {
    filename: data.filename,
    received: 0,
    total: data.totalBytes,
    speed: 0,
    percent: 0,
    state: 'progressing',
    eta: '计算中...',
  });

  // 切换到进度环状态
  setDownloadButtonState('active');
  updateDownloadBadge();

  // 面板打开时刷新列表，关闭时标记 dirty
  if (state.downloadPanelOpen) {
    loadDownloadPanelList();
  } else {
    downloadPanelDirty = true;
  }
}

/**
 * 处理下载进度事件
 * @param {Object} data - {downloadId, received, total, speed, percent, state}
 */
function handleDownloadProgress(data) {
  const download = activeDownloadsMap.get(data.downloadId);
  if (!download) return;

  Object.assign(download, {
    received: data.received,
    total: data.total,
    speed: data.speed,
    percent: data.percent,
    state: data.state,
    eta: data.total > 0 && data.speed > 0
      ? formatETA(data.total - data.received, data.speed)
      : '计算中...',
  });

  // 更新进度环
  updateDownloadProgressRing();

  // 更新 tooltip 内容（使用 setTimeout 而非 requestAnimationFrame，避免 Chromium 节流）
  const tooltip = document.getElementById('downloadTooltip');
  if (tooltip && !tooltip.classList.contains('hidden')) {
    if (!tooltip._updateScheduled) {
      tooltip._updateScheduled = true;
      tooltip._updateTimer = setTimeout(() => {
        renderDownloadTooltipContent();
        tooltip._updateScheduled = false;
      }, 200);
    }
  }

  // 面板打开时实时更新进度条
  if (state.downloadPanelOpen) {
    updateDownloadPanelProgress(data);
  }
}

/**
 * 处理下载完成事件
 * @param {Object} data - {downloadId, state, savePath}
 */
function handleDownloadCompleted(data) {
  activeDownloadsMap.delete(data.downloadId);

  if (activeDownloadsMap.size === 0) {
    // 所有下载完成，显示绿色对勾 3 秒后恢复
    setDownloadButtonState('done');
    downloadDoneTimer = setTimeout(() => {
      setDownloadButtonState('idle');
    }, 3000);
  }

  updateDownloadBadge();
  hideDownloadTooltip();

  // 面板打开时刷新列表，关闭时标记 dirty
  if (state.downloadPanelOpen) {
    loadDownloadPanelList();
  } else {
    downloadPanelDirty = true;
  }
}

/**
 * 设置下载按钮状态
 * @param {'idle'|'active'|'done'} state
 */
function setDownloadButtonState(state) {
  const btn = document.getElementById('downloadBtn');
  if (!btn) return;

  const defaultIcon = btn.querySelector('.download-icon-default');
  const progressRing = btn.querySelector('.download-progress-ring');
  const doneIcon = btn.querySelector('.download-icon-done');

  // 清除完成定时器
  if (downloadDoneTimer) {
    clearTimeout(downloadDoneTimer);
    downloadDoneTimer = null;
  }

  // 隐藏所有
  defaultIcon.style.display = 'none';
  progressRing.style.display = 'none';
  doneIcon.style.display = 'none';

  switch (state) {
    case 'idle':
      defaultIcon.style.display = '';
      btn.title = '下载管理';
      btn.setAttribute('aria-label', '下载管理');
      break;
    case 'active':
      progressRing.style.display = '';
      const count = activeDownloadsMap.size;
      btn.title = `下载管理 - ${count} 个下载中`;
      btn.setAttribute('aria-label', `下载管理 - ${count} 个下载中`);
      break;
    case 'done':
      doneIcon.style.display = '';
      btn.title = '下载管理';
      btn.setAttribute('aria-label', '下载管理');
      break;
  }
}

/**
 * 更新下载进度环
 * 多个下载时显示加权聚合进度
 */
function updateDownloadProgressRing() {
  const fillCircle = document.querySelector('.download-progress-fill');
  if (!fillCircle) return;

  let totalReceived = 0;
  let totalBytes = 0;

  for (const download of activeDownloadsMap.values()) {
    totalReceived += download.received;
    totalBytes += download.total;
  }

  const percent = totalBytes > 0 ? totalReceived / totalBytes : 0;
  const circumference = 75.4; // 2 * PI * 12
  const offset = circumference * (1 - percent);
  fillCircle.style.strokeDashoffset = offset;
}

/**
 * 更新下载徽标数字
 */
function updateDownloadBadge() {
  const badge = document.getElementById('downloadBadge');
  if (!badge) return;

  const count = activeDownloadsMap.size;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/**
 * 显示下载 tooltip
 */
function showDownloadTooltip() {
  if (activeDownloadsMap.size === 0) return;

  const tooltip = document.getElementById('downloadTooltip');
  const btn = document.getElementById('downloadBtn');
  if (!tooltip || !btn) return;

  renderDownloadTooltipContent();

  // 先显示 tooltip（否则 getBoundingClientRect 返回 0）
  tooltip.classList.remove('hidden');

  // 定位：按钮下方居中
  const rect = btn.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.bottom + 4}px`;
  tooltip.style.transform = 'translateX(-50%)';

  // 边界检测
  const tooltipRect = tooltip.getBoundingClientRect();
  if (tooltipRect.left < 8) {
    tooltip.style.left = '8px';
    tooltip.style.transform = 'none';
  }
  if (tooltipRect.right > window.innerWidth - 8) {
    tooltip.style.left = `${window.innerWidth - 8}px`;
    tooltip.style.transform = 'translateX(-100%)';
  }
}

/**
 * 隐藏下载 tooltip
 */
function hideDownloadTooltip() {
  const tooltip = document.getElementById('downloadTooltip');
  if (tooltip) {
    tooltip.classList.add('hidden');
  }
}

/**
 * 渲染 tooltip 内容
 */
function renderDownloadTooltipContent() {
  const list = document.getElementById('downloadTooltipList');
  if (!list) return;

  const downloads = Array.from(activeDownloadsMap.values());
  const maxVisible = 3;

  list.innerHTML = '';

  downloads.slice(0, maxVisible).forEach(download => {
    const item = document.createElement('div');
    item.className = 'download-tooltip-item';
    item.innerHTML = `
      <div class="download-tooltip-name">${escapeHtml(download.filename)}</div>
      <div class="download-tooltip-detail">
        <span class="download-tooltip-size">${formatFileSize(download.received)} / ${formatFileSize(download.total)}</span>
        <span class="download-tooltip-separator">·</span>
        <span class="download-tooltip-speed">${formatFileSize(download.speed)}/s</span>
        <span class="download-tooltip-separator">·</span>
        <span class="download-tooltip-eta">${download.eta}</span>
      </div>
      <div class="download-tooltip-progress">
        <div class="download-tooltip-progress-bar" style="width: ${download.percent}%"></div>
      </div>
    `;
    list.appendChild(item);
  });

  if (downloads.length > maxVisible) {
    const overflow = document.createElement('div');
    overflow.className = 'download-tooltip-overflow';
    overflow.textContent = `+${downloads.length - maxVisible} 更多`;
    list.appendChild(overflow);
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

/**
 * 格式化剩余时间
 * @param {number} bytesRemaining
 * @param {number} speed - bytes/s
 * @returns {string}
 */
function formatETA(bytesRemaining, speed) {
  if (bytesRemaining <= 0) return '完成';
  if (speed <= 0) return '计算中...';
  const seconds = Math.ceil(bytesRemaining / speed);
  if (seconds < 60) return `剩余 ${seconds}s`;
  if (seconds < 3600) return `剩余 ${Math.ceil(seconds / 60)}min`;
  return `剩余 ${Math.ceil(seconds / 3600)}h`;
}

// ==================== 媒体面板 ====================

/**
 * 检查页面 URL 是否在域名白名单中（per D-06/D-07）
 * 与 media-sniffer.js isDomainWhitelisted 语义保持一致，改动需同步
 * - 白名单为空数组时返回 true（空白名单 = 全部允许）
 * - 匹配条件：hostname === domain || hostname.endsWith('.' + domain)
 * - 解析失败（无效 URL）时返回 false
 *
 * @param {string} url - 页面 URL
 * @param {Array<string>} whitelist - 域名白名单数组
 * @returns {boolean} 是否在白名单中
 */
function isPageWhitelisted(url, whitelist) {
  if (!Array.isArray(whitelist) || whitelist.length === 0) return true;
  try {
    const hostname = new URL(url).hostname;
    return whitelist.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * 更新多媒体播放器功能的可见性（per D-12）
 * - 关闭时：隐藏媒体面板按钮和面板，清空媒体列表，重置面板状态
 * - 开启时：显示媒体面板按钮（不自动打开面板）
 * - 已打开的播放器窗口不强制关闭（per D-11）
 *
 * @param {boolean} enabled - 功能开关状态
 */
function updateMediaPlayerVisibility(enabled) {
  if (!enabled) {
    // 隐藏媒体面板按钮和面板（per D-12）
    if (elements.mediaPanelBtn) {
      elements.mediaPanelBtn.dataset.featureHidden = '1';
      elements.mediaPanelBtn.style.display = 'none';
    }
    if (elements.mediaPanel) {
      elements.mediaPanel.classList.add('hidden');
    }
    state.mediaPanelOpen = false;

    // 清空所有容器的媒体列表（per D-12）
    window.mediaAPI.clearMediaList();
  } else {
    // 显示媒体面板按钮
    if (elements.mediaPanelBtn) {
      delete elements.mediaPanelBtn.dataset.featureHidden;
      elements.mediaPanelBtn.style.display = '';
    }
    // 不自动打开面板，保持用户控制
  }

  // 参与溢出计算的按钮集合变化，重算工具栏收起状态
  calculateToolbarOverflow();
}

/**
 * 切换媒体面板显示状态
 * 打开时加载当前容器的媒体列表
 */
function toggleMediaPanel() {
  console.log('[Realm Renderer] 切换媒体面板');

  state.mediaPanelOpen = !state.mediaPanelOpen;
  elements.mediaPanel.classList.toggle('hidden', !state.mediaPanelOpen);
  elements.mediaPanelBtn.classList.toggle('active', state.mediaPanelOpen);

  // 打开时锚定按钮下方并刷新列表
  if (state.mediaPanelOpen) {
    positionPanelBelowButton(elements.mediaPanel, elements.mediaPanelBtn);
    loadMediaList();
  }
}

/**
 * 加载当前活动 webview 的媒体列表
 * 通过 mediaAPI.getMediaList 获取数据，更新 state 并渲染
 * 按 webview (webContentsId) 级别隔离，标签页切换互不干扰
 */
async function loadMediaList() {
  try {
    const activeWebview = state.webviews.get(state.activeTabId);
    let webContentsId;
    if (activeWebview) {
      try {
        webContentsId = activeWebview.getWebContentsId();
      } catch (err) {
        console.warn('[Realm Renderer] 无法获取活动 webview webContentsId:', err.message);
      }
    }
    const mediaList = webContentsId
      ? await window.mediaAPI.getMediaList(webContentsId)
      : [];
    state.mediaItems = mediaList || [];
    renderMediaList();
    updateMediaBadge();
  } catch (error) {
    console.error('[Realm Renderer] 加载媒体列表失败:', error);
  }
}

/**
 * 渲染媒体列表
 * 根据 state.mediaItems 生成列表项 DOM，空状态显示提示
 */
function renderMediaList() {
  if (state.mediaItems.length === 0) {
    elements.mediaList.innerHTML = '';
    elements.mediaEmptyState.classList.remove('hidden');
    return;
  }

  elements.mediaEmptyState.classList.add('hidden');

  const ALLOWED_MEDIA_TYPES = new Set(['m3u8', 'mp4', 'flv', 'webm', 'dash', 'unknown']);

  elements.mediaList.innerHTML = state.mediaItems.map((item, index) => {
    const type = ALLOWED_MEDIA_TYPES.has(item.type) ? item.type : 'unknown';
    const name = item.title || item.url.split('/').pop() || 'video';
    const urlPreview = formatMediaUrl(item.url);
    const durationText = item.duration > 0 ? formatMediaDuration(item.duration) : '';
    const thumbHtml = item.thumbnail
      ? `<img class="media-item-thumb" src="${escapeHtml(item.thumbnail)}" loading="lazy" alt="">`
      : '';
    const durationHtml = durationText
      ? `<span class="media-item-duration">${durationText}</span>`
      : '';

    return `
      <div class="media-item" data-url="${escapeHtml(item.url)}" data-index="${index}">
        ${thumbHtml}
        <span class="media-type-badge media-type-${type}">${type}</span>
        <div class="media-item-info">
          <div class="media-item-name" title="${escapeHtml(item.url)}">${escapeHtml(name)}</div>
          <div class="media-item-url">${durationHtml}${escapeHtml(urlPreview)}</div>
        </div>
        <div class="media-item-actions">
          <button class="btn-icon media-play-btn" data-index="${index}" title="在新标签页播放">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button class="btn-icon media-copy-btn" data-index="${index}" title="复制视频 URL">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 缩略图加载失败（跨域/失效常见）时移除图块，布局回退为无图样式
  // 注意：CSP script-src 'self' 禁止内联 onerror，须在渲染后绑定
  elements.mediaList.querySelectorAll('.media-item-thumb').forEach((img) => {
    img.addEventListener('error', () => img.remove());
  });
}

/**
 * 格式化媒体 URL 为 "域名+文件名" 格式
 * @param {string} url - 完整 URL
 * @returns {string} 格式化后的 URL
 */
function formatMediaUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1] || 'video';
    return `${urlObj.hostname}/${fileName}`;
  } catch {
    return url.substring(0, 50) + '...';
  }
}

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化媒体时长（秒 → mm:ss，超 1 小时为 h:mm:ss）
 * @param {number} seconds - 时长（秒）
 * @returns {string} 格式化后的时长
 */
function formatMediaDuration(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * 播放媒体（通过 IPC 创建/复用播放器窗口，D-16）
 * @param {number} index - 媒体项索引
 */
async function playMedia(index) {
  const item = state.mediaItems[index];
  if (!item) return;

  console.log('[Realm Renderer] 播放媒体:', item.url);
  try {
    await window.mediaAPI.playMedia(item.url, state.currentContainer);
  } catch (err) {
    console.error('[Realm Renderer] 播放失败:', err);
  }
}

/**
 * 复制媒体 URL 到剪贴板
 * 复制成功后按钮图标短暂变为勾选图标，1.5 秒后恢复
 * @param {number} index - 媒体项索引
 * @param {HTMLElement} btn - 复制按钮元素
 */
async function copyMediaUrl(index, btn) {
  const item = state.mediaItems[index];
  if (!item) return;

  try {
    await navigator.clipboard.writeText(item.url);

    // 视觉反馈：按钮变勾
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    btn.classList.add('copied');

    setTimeout(() => {
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;
      btn.classList.remove('copied');
    }, 1500);

    console.log('[Realm Renderer] 已复制 URL:', item.url);
  } catch (error) {
    console.error('[Realm Renderer] 复制失败:', error);
  }
}

/**
 * 更新媒体数量徽标
 * 数量 > 0 时显示徽标，0 时隐藏，> 99 显示 "99+"
 */
function updateMediaBadge() {
  const count = state.mediaItems.length;

  if (count > 0) {
    elements.mediaBadge.textContent = count > 99 ? '99+' : count;
    elements.mediaBadge.classList.remove('hidden');
  } else {
    elements.mediaBadge.classList.add('hidden');
  }
}

/**
 * 初始化媒体面板
 * 注册媒体列表更新监听器，初始加载媒体列表
 */
let cleanupMediaListener = null;

function initMediaPanel() {
  // 监听媒体列表更新（主进程推送）
  cleanupMediaListener = window.mediaAPI.onMediaListUpdate((data) => {
    const activeWebview = state.webviews.get(state.activeTabId);
    let activeWebContentsId;
    if (activeWebview) {
      try {
        activeWebContentsId = activeWebview.getWebContentsId();
      } catch (err) {
        console.warn('[Realm Renderer] 无法获取活动 webview webContentsId:', err.message);
      }
    }
    if (data.webContentsId && data.webContentsId !== activeWebContentsId) {
      console.log('[Realm Renderer] 忽略其他 webview 的媒体更新:', data.webContentsId);
      return;
    }
    console.log('[Realm Renderer] 媒体列表更新:', data.items ? data.items.length : 0);
    state.mediaItems = data.items || [];
    renderMediaList();
    updateMediaBadge();
  });

  // 初始加载
  loadMediaList();
}

// ==================== 媒体任务角标（Phase 44 D-26） ====================

/**
 * 更新媒体任务角标显隐与数字
 * 活跃任务数 > 0 显示（可带数字），归零隐藏（UI-SPEC zero-one-many：
 * 多任务点击统一跳任务页，不逐个弹出）
 * @param {number} count - 活跃任务数
 */
function updateMediaTaskBadge(count) {
  const btn = document.getElementById('mediaTaskBtn');
  const badge = document.getElementById('mediaTaskBadge');
  if (!btn || !badge) return;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
    btn.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    btn.classList.add('hidden');
  }
}

/**
 * 初始化媒体任务角标
 * 监听主进程 media-task:count-changed 广播（经 preload mediaAPI IPC，
 * 主窗口不得 fetch HTTP——Phase 38 事故约定）；点击经 openUrl('realm://tasks')
 * 收敛统一导航入口
 */
function initMediaTaskBadge() {
  const btn = document.getElementById('mediaTaskBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    openUrl('realm://tasks');
  });

  if (window.mediaAPI && window.mediaAPI.onMediaTaskCountChanged) {
    window.mediaAPI.onMediaTaskCountChanged((data) => {
      updateMediaTaskBadge((data && data.count) || 0);
    });
  }
}

/**
 * 初始化媒体任务终态 toast（Phase 44 G-44-5）
 * 根因：ad-hoc 签名下 macOS 静默拒授系统通知授权，convert/record 终态
 * 在主窗口无任何提示。监听 media-task:changed 广播，过滤 completed/failed
 * 终态弹应用内 toast；文案与 main.js showTaskNotification 标题契约一致；
 * 有 outputPath 时点击经 download:show-in-folder IPC（shell.showItemInFolder）
 * 在 Finder 定位产物。系统通知代码保留不删（正式签名后双通道并存）。
 */
function initMediaTaskToast() {
  if (!(window.mediaAPI && window.mediaAPI.onMediaTaskChanged)) return;

  window.mediaAPI.onMediaTaskChanged((task) => {
    if (!task || (task.status !== 'completed' && task.status !== 'failed')) return;

    let message;
    if (task.status === 'completed') {
      if (task.type === 'convert') {
        // 与 showTaskNotification 契约一致：MP4 转换完成：{文件名}
        // IN-07：basename 提取与 main.js showTaskNotification 的 path.basename 是两份
        // 实现（POSIX 下等价）——改任一处须同步另一处
        const base = task.outputPath
          ? task.outputPath.split('/').pop()
          : task.title;
        message = `MP4 转换完成：${base}`;
      } else {
        message = '录制已保存';
      }
    } else if (task.type === 'record') {
      // IN-07：record 的 task.error 不带前缀，与 showTaskNotification 的
      // `录制失败：${task.error}` 契约对齐补前缀；convert 的 error 已带
      // 「MP4 转换失败：」前缀（44-05），走下方分支不重复拼接
      message = `录制失败：${task.error || '未知原因'}`;
    } else {
      message = task.error || '任务失败';
    }

    const type = task.status === 'failed' ? 'error' : 'success';

    // 有产物路径时点击定位（复用既有受信 IPC 链路）；无 outputPath 仅提示
    const onClick = task.outputPath && window.downloadAPI && window.downloadAPI.showInFolder
      ? () => window.downloadAPI.showInFolder(task.outputPath)
      : undefined;

    // 终态提示停留 5s，久于普通 3s toast
    showToast(message, type, { onClick, duration: 5000 });
  });
}

/**
 * 缓存告警 toast（UI Top1 / D-08 契约文案出口）
 * 主进程 cache:warning 广播 → 契约文案：
 * - auto_evicted：磁盘空间不足，已自动清理最久未看的缓存
 * - disk_full：缓存写入失败：磁盘空间不足
 * 文案单一来源在本函数（主进程只传 type，不持文案）；主进程侧已按 type 60s 节流
 */
function initCacheWarningToast() {
  if (!(window.mediaAPI && window.mediaAPI.onCacheWarning)) return;

  /** D-08 契约文案（UI-SPEC Copywriting，逐字一致） */
  const CACHE_WARNING_TEXT = {
    auto_evicted: '磁盘空间不足，已自动清理最久未看的缓存',
    disk_full: '缓存写入失败：磁盘空间不足',
  };

  window.mediaAPI.onCacheWarning((payload) => {
    const message = CACHE_WARNING_TEXT[payload && payload.type];
    if (!message) return;
    showToast(message, 'error', { duration: 5000 });
  });
}

/**
 * 清理媒体面板监听器
 * 在窗口关闭或容器切换时调用
 */
function cleanupMediaPanel() {
  if (cleanupMediaListener) {
    cleanupMediaListener();
    cleanupMediaListener = null;
  }
}

// ==================== 操作确认卡片 ====================

/**
 * 获取操作类型对应的 SVG 图标
 * @param {string} type - 操作类型：submit/upload/payment/click
 * @returns {string} SVG 图标 HTML 字符串
 */
function getActionIcon(type) {
  const icons = {
    submit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>`,
    upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 16 12 12 8 16"></polyline>
      <line x1="12" y1="12" x2="12" y2="21"></line>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
    </svg>`,
    payment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
      <line x1="1" y1="10" x2="23" y2="10"></line>
    </svg>`,
    click: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"></path>
    </svg>`,
    close_tab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`,
  };
  return icons[type] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>`;
}

/**
 * 获取风险等级中文标签
 * @param {string} level - 风险等级：low/medium/high
 * @returns {string} 中文标签
 */
function getRiskLabel(level) {
  const labels = { low: '低风险', medium: '中风险', high: '高风险' };
  return labels[level] || '未知';
}

/**
 * 渲染操作确认卡片
 *
 * 收到 action:request-confirmation 事件时，在 AI 聊天面板渲染确认卡片。
 * 卡片显示操作图标 + 操作标题 + 风险等级标签 + 详情 + 操作按钮。
 *
 * @param {Object} actionData - 操作数据
 * @param {string} actionData.actionId - 操作唯一 ID
 * @param {string} actionData.type - 操作类型
 * @param {string} actionData.title - 操作标题
 * @param {string} [actionData.description] - 操作描述
 * @param {string} [actionData.url] - 目标 URL
 * @param {string} [actionData.containerId] - 容器 ID
 * @param {string} [actionData.containerName] - 容器名称
 * @param {string} [actionData.riskLevel] - 风险等级
 */
/** 待决/进行中的确认卡片：actionId → card 元素（action:settle 推送终态时检索） */
const actionCards = new Map();

function renderConfirmationCard(actionData) {
  const card = document.createElement('div');
  card.className = 'action-confirm-card';
  card.dataset.actionId = actionData.actionId;
  card.dataset.state = 'pending';
  actionCards.set(actionData.actionId, card);

  // 头部：图标 + 标题 + 风险标签
  const header = document.createElement('div');
  header.className = 'action-confirm-header';

  const icon = document.createElement('div');
  icon.className = 'action-confirm-icon';
  icon.innerHTML = getActionIcon(actionData.type);

  const info = document.createElement('div');
  info.className = 'action-confirm-info';

  const title = document.createElement('div');
  title.className = 'action-confirm-title';
  title.textContent = actionData.title || '确认操作';

  const description = document.createElement('div');
  description.className = 'action-confirm-description';
  description.textContent = actionData.description || '';

  info.appendChild(title);
  if (actionData.description) {
    info.appendChild(description);
  }

  const riskBadge = document.createElement('div');
  riskBadge.className = `action-confirm-risk risk-${actionData.riskLevel || 'medium'}`;
  riskBadge.textContent = getRiskLabel(actionData.riskLevel);

  header.appendChild(icon);
  header.appendChild(info);
  header.appendChild(riskBadge);
  card.appendChild(header);

  // 详情区域
  const details = document.createElement('div');
  details.className = 'action-confirm-details';

  if (actionData.url) {
    const urlRow = document.createElement('div');
    urlRow.className = 'action-confirm-detail-row';
    urlRow.innerHTML = `<span class="detail-label">目标页面</span><span class="detail-value" title="${actionData.url}">${actionData.url}</span>`;
    details.appendChild(urlRow);
  }

  if (actionData.containerName || actionData.containerId) {
    const containerRow = document.createElement('div');
    containerRow.className = 'action-confirm-detail-row';
    containerRow.innerHTML = `<span class="detail-label">容器</span><span class="detail-value">${actionData.containerName || actionData.containerId}</span>`;
    details.appendChild(containerRow);
  }

  if (details.children.length > 0) {
    card.appendChild(details);
  }

  // 操作按钮
  const actions = document.createElement('div');
  actions.className = 'action-confirm-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-confirm-btn action-confirm-btn-cancel';
  cancelBtn.textContent = '取消';
  cancelBtn.addEventListener('click', async () => {
    if (card.dataset.state !== 'pending') return;
    updateCardState(card, 'cancelled');
    await window.realmAPI.actionCancel(actionData.actionId);
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'action-confirm-btn action-confirm-btn-confirm';
  confirmBtn.textContent = '确认执行';
  confirmBtn.addEventListener('click', async () => {
    if (card.dataset.state !== 'pending') return;
    updateCardState(card, 'executing');
    const result = await window.realmAPI.actionConfirm(actionData.actionId);
    if (result && !result.success) {
      updateCardState(card, 'error', result.error || '操作确认失败');
    }
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  card.appendChild(actions);

  // 插入到 AI 聊天面板
  if (elements.aiMessageList) {
    const msgWrapper = document.createElement('div');
    msgWrapper.className = 'ai-message ai-message-ai';
    const msgContent = document.createElement('div');
    msgContent.className = 'ai-message-content';
    msgContent.appendChild(card);
    msgWrapper.appendChild(msgContent);
    elements.aiMessageList.appendChild(msgWrapper);

    // 滚动到底部
    if (state.aiAutoScroll) {
      scrollToBottom();
    }
  }
}

/**
 * 更新确认卡片状态
 *
 * 状态机：pending → executing → success/error/cancelled
 *
 * @param {HTMLElement} card - 卡片 DOM 元素
 * @param {string} newState - 新状态
 * @param {string} [result] - 结果消息（error 状态用）
 */
function updateCardState(card, newState, result) {
  card.dataset.state = newState;

  // 获取按钮区域
  const actions = card.querySelector('.action-confirm-actions');

  // 移除已有的状态指示
  const existingStatus = card.querySelector('.action-confirm-status');
  if (existingStatus) existingStatus.remove();

  switch (newState) {
    case 'executing':
      // 禁用按钮
      if (actions) {
        const btns = actions.querySelectorAll('.action-confirm-btn');
        btns.forEach(btn => { btn.disabled = true; });
        const confirmBtn = actions.querySelector('.action-confirm-btn-confirm');
        if (confirmBtn) confirmBtn.textContent = '执行中...';
      }
      break;

    case 'success': {
      // 隐藏按钮区域，显示成功状态
      if (actions) actions.style.display = 'none';
      const status = document.createElement('div');
      status.className = 'action-confirm-status status-success';
      status.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> 操作完成`;
      card.appendChild(status);
      break;
    }

    case 'error': {
      // 隐藏按钮区域，显示错误状态
      if (actions) actions.style.display = 'none';
      const status = document.createElement('div');
      status.className = 'action-confirm-status status-error';
      const errorMsg = result ? `操作失败：${result}` : '操作执行失败';
      status.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> ${errorMsg}`;
      card.appendChild(status);
      break;
    }

    case 'cancelled': {
      // 隐藏按钮区域，显示取消状态（含超时等原因说明）
      if (actions) actions.style.display = 'none';
      const status = document.createElement('div');
      status.className = 'action-confirm-status status-cancelled';
      status.textContent = result || '已取消';
      card.appendChild(status);
      break;
    }
  }
}

/**
 * 渲染 CAPTCHA/2FA 等待指示器卡片
 *
 * 检测到验证码或双因素认证时，在 AI 聊天面板显示等待指示器。
 * 验证完成后自动更新为"验证完成"状态并消失。
 *
 * @param {Object} [data] - 等待数据
 * @param {string} [data.message] - 自定义提示信息
 * @returns {HTMLElement} 卡片 DOM 元素（用于后续更新状态）
 */
function renderCaptchaWaitingCard(data = {}) {
  const card = document.createElement('div');
  card.className = 'captcha-waiting-card';

  // 盾牌/锁图标
  const icon = document.createElement('div');
  icon.className = 'captcha-waiting-icon';
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>`;

  // 文本区域
  const text = document.createElement('div');
  text.className = 'captcha-waiting-text';

  const title = document.createElement('div');
  title.className = 'captcha-waiting-title';
  title.textContent = '需要手动验证';

  const description = document.createElement('div');
  description.className = 'captcha-waiting-description';
  description.textContent = data.message || '检测到验证码/双因素认证，请在页面中完成验证。完成后我会自动继续。';

  text.appendChild(title);
  text.appendChild(description);

  // 旋转指示器
  const spinner = document.createElement('div');
  spinner.className = 'captcha-waiting-spinner';

  card.appendChild(icon);
  card.appendChild(text);
  card.appendChild(spinner);

  // 插入到 AI 聊天面板
  if (elements.aiMessageList) {
    const msgWrapper = document.createElement('div');
    msgWrapper.className = 'ai-message ai-message-ai';
    const msgContent = document.createElement('div');
    msgContent.className = 'ai-message-content';
    msgContent.appendChild(card);
    msgWrapper.appendChild(msgContent);
    elements.aiMessageList.appendChild(msgWrapper);

    // 滚动到底部
    if (state.aiAutoScroll) {
      scrollToBottom();
    }
  }

  // 返回卡片元素，供外部更新状态（如验证完成时调用）
  return card;
}

/**
 * 更新 CAPTCHA 等待卡片为完成状态
 * @param {HTMLElement} card - 卡片 DOM 元素
 */
function completeCaptchaWaitingCard(card) {
  if (!card) return;
  card.classList.add('completed');
  const title = card.querySelector('.captcha-waiting-title');
  if (title) title.textContent = '验证完成，继续执行...';
  // 2 秒后自动移除
  setTimeout(() => {
    const wrapper = card.closest('.ai-message');
    if (wrapper) {
      wrapper.style.transition = 'opacity 0.3s';
      wrapper.style.opacity = '0';
      setTimeout(() => wrapper.remove(), 300);
    }
  }, 2000);
}

// ==================== 脚本预览卡片 ====================

/**
 * 操作类型到中文标签的映射
 *
 * @param {string} action - 操作类型标识
 * @returns {string} 中文标签
 */
function getActionLabel(action) {
  const labels = {
    navigate: '导航',
    click: '点击',
    type: '输入',
    scroll: '滚动',
    wait: '等待',
    select: '选择',
    check: '勾选',
    uncheck: '取消勾选',
    focus: '聚焦',
    blur: '失焦',
    submit: '提交',
    keydown: '按下按键',
    keyup: '松开按键'
  };
  return labels[action] || action;
}

/**
 * 脚本预览卡片主渲染函数
 *
 * 克隆 script-preview-template 模板，填充脚本名称、描述和步骤列表，
 * 绑定执行、取消、添加步骤按钮事件。
 *
 * @param {Object} script - 脚本数据对象
 * @param {string} script.name - 脚本名称
 * @param {string} script.description - 脚本描述
 * @param {Array} script.steps - 步骤数组
 * @param {string} [script.containerId] - 目标容器 ID
 * @returns {HTMLElement} 渲染好的卡片 DOM 元素
 */
function renderScriptPreviewCard(script) {
  const template = document.getElementById('script-preview-template');
  if (!template) {
    console.error('[Realm Renderer] script-preview-template 未找到');
    return null;
  }

  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.script-preview-card');

  // 使用 textContent 防止 XSS（T-25-04）
  const nameEl = card.querySelector('.script-card-name');
  if (nameEl) nameEl.textContent = script.name || '未命名脚本';

  const descEl = card.querySelector('.script-card-desc');
  if (descEl) descEl.textContent = script.description || '';

  // 渲染步骤列表
  const stepsList = card.querySelector('.script-steps-list');
  if (stepsList && script.steps) {
    script.steps.forEach((step, index) => {
      const stepItem = renderScriptStepItem(step, index, stepsList, card);
      stepsList.appendChild(stepItem);
    });
  }

  // 绑定"执行脚本"按钮
  const executeBtn = card.querySelector('.script-execute-btn');
  if (executeBtn) {
    executeBtn.addEventListener('click', () => {
      // 收集当前步骤数据
      const currentSteps = collectStepsFromDOM(stepsList);
      const scriptData = {
        name: script.name,
        description: script.description,
        steps: currentSteps,
        containerId: script.containerId
      };

      // 禁用按钮防止重复执行
      executeBtn.disabled = true;
      executeBtn.textContent = '执行中...';

      // 重置所有步骤状态
      stepsList.querySelectorAll('.script-step-item').forEach(item => {
        item.classList.remove('step-executing', 'step-success', 'step-error', 'step-skipped');
        const errorPanel = item.querySelector('.step-error-panel');
        if (errorPanel) errorPanel.remove();
      });

      // 通过 IPC 发送到主进程执行
      if (window.realmAPI && window.realmAPI.scriptExecute) {
        window.realmAPI.scriptExecute(scriptData).then(result => {
          // 执行完成后恢复按钮
          executeBtn.disabled = false;
          executeBtn.textContent = '重新执行';

          // 显示执行结果摘要
          if (result.success) {
            console.log('[Realm Renderer] 脚本执行成功');
          } else if (result.aborted) {
            console.log('[Realm Renderer] 脚本执行已停止');
          } else {
            console.warn('[Realm Renderer] 脚本执行失败:', result.error);
          }
        }).catch(err => {
          console.error('[Realm Renderer] 脚本执行异常:', err.message);
          executeBtn.disabled = false;
          executeBtn.textContent = '重新执行';
        });
      }
    });
  }

  // 绑定"取消"按钮
  const cancelBtn = card.querySelector('.script-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      const wrapper = card.closest('.ai-message');
      if (wrapper) {
        wrapper.style.transition = 'opacity 0.3s';
        wrapper.style.opacity = '0';
        setTimeout(() => wrapper.remove(), 300);
      } else {
        card.remove();
      }
    });
  }

  // 绑定"+ 添加步骤"按钮
  const addStepBtn = card.querySelector('.script-add-step-btn');
  if (addStepBtn) {
    addStepBtn.addEventListener('click', () => {
      const newStep = { action: 'click', target: '' };
      const newIndex = stepsList.children.length;
      const stepItem = renderScriptStepItem(newStep, newIndex, stepsList, card);
      stepsList.appendChild(stepItem);
      renumberSteps(stepsList);
      // 自动展开编辑模式
      const editBtn = stepItem.querySelector('.step-edit-btn');
      if (editBtn) editBtn.click();
    });
  }

  return card;
}

// ==================== 标签分组建议卡片 ====================

/**
 * 渲染标签分组建议卡片
 *
 * 克隆 tab-group-template 模板，填充分组数据和标签页列表，
 * 绑定应用分组、取消、添加分组按钮事件。
 *
 * @param {Object} groupsData - 分组数据
 * @param {Array<{name: string, tabs: Array}>} groupsData.groups - 分组数组
 * @returns {HTMLElement} 渲染好的卡片 DOM 元素
 */
function renderTabGroupCard(groupsData) {
  const template = document.getElementById('tab-group-template');
  if (!template) {
    console.error('[Realm Renderer] tab-group-template 未找到');
    return null;
  }

  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.tab-group-card');

  // 计算总标签页数
  const totalTabs = (groupsData.groups || []).reduce(
    (sum, g) => sum + (g.tabs ? g.tabs.length : 0), 0
  );

  // 设置描述文本
  const descEl = card.querySelector('.tab-group-desc');
  if (descEl) {
    descEl.textContent = `按主题智能分组 ${totalTabs} 个标签页`;
  }

  // 渲染分组列表
  const groupsList = card.querySelector('.tab-groups-list');
  if (groupsList && groupsData.groups) {
    groupsData.groups.forEach((group, index) => {
      // 分隔线（非第一个分组前）
      if (index > 0) {
        const divider = document.createElement('div');
        divider.className = 'tab-group-divider';
        groupsList.appendChild(divider);
      }
      const section = renderTabGroupSection(group, index, groupsList, card);
      groupsList.appendChild(section);
    });
  }

  // 绑定"应用分组"按钮
  const applyBtn = card.querySelector('.tab-group-apply-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      // 收集当前分组数据
      const currentGroups = collectTabGroupsFromDOM(groupsList);
      if (!currentGroups || currentGroups.length === 0) return;

      // 构建重排数据
      const tabOrder = {
        groups: currentGroups.map(g => ({
          name: g.name,
          tabIds: g.tabIds,
        })),
      };

      // 禁用按钮防止重复操作
      applyBtn.disabled = true;
      applyBtn.textContent = '应用中...';

      // 通过 IPC 发送到主进程执行重排
      if (window.realmAPI && window.realmAPI.tabReorder) {
        window.realmAPI.tabReorder(tabOrder).then(result => {
          if (result.success) {
            // 显示成功提示
            showToast(`已整理 ${result.tabCount} 个标签到 ${result.groupCount} 个分组`, 'success');
            // 只淡出移除卡片本身，不能 closest('.ai-message') 删整条 AI 消息
            card.style.transition = 'opacity 0.3s';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
          } else {
            showToast(result.message || '应用分组失败', 'error');
            applyBtn.disabled = false;
            applyBtn.textContent = '应用分组';
          }
        }).catch(err => {
          console.error('[Realm Renderer] 应用分组异常:', err.message);
          showToast('应用分组失败: ' + err.message, 'error');
          applyBtn.disabled = false;
          applyBtn.textContent = '应用分组';
        });
      }
    });
  }

  // 绑定"取消"按钮
  const cancelBtn = card.querySelector('.tab-group-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // 只淡出移除卡片本身，不能 closest('.ai-message') 删整条 AI 消息
      card.style.transition = 'opacity 0.3s';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
    });
  }

  // 绑定"+ 添加分组"按钮
  const addGroupBtn = card.querySelector('.tab-group-add-btn');
  if (addGroupBtn) {
    addGroupBtn.addEventListener('click', () => {
      const newGroup = { name: '新分组', tabs: [] };
      const newIndex = groupsList.querySelectorAll('.tab-group-section').length;
      // 添加分隔线
      const divider = document.createElement('div');
      divider.className = 'tab-group-divider';
      groupsList.appendChild(divider);
      // 添加新分组
      const section = renderTabGroupSection(newGroup, newIndex, groupsList, card);
      groupsList.appendChild(section);
      // 自动聚焦分组名编辑
      const nameEl = section.querySelector('.tab-group-name');
      if (nameEl) {
        nameEl.focus();
        // 选中默认文本
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }

  return card;
}

/**
 * 渲染单个分组区域
 *
 * 创建分组头部（名称、数量、删除按钮）和标签页列表，
 * 支持双击编辑分组名、跨分组拖拽标签页。
 *
 * @param {Object} group - 分组数据
 * @param {string} group.name - 分组名称
 * @param {Array} group.tabs - 标签页数组
 * @param {number} groupIndex - 分组索引
 * @param {HTMLElement} groupsList - 分组列表容器
 * @param {HTMLElement} card - 卡片根元素
 * @returns {HTMLElement} 分组区域 DOM 元素
 */
function renderTabGroupSection(group, groupIndex, groupsList, card) {
  const section = document.createElement('div');
  section.className = 'tab-group-section';
  section.dataset.groupIndex = groupIndex;

  // 分组头部
  const header = document.createElement('div');
  header.className = 'tab-group-section-header';

  // 分组名称（contenteditable 双击可编辑）
  const nameEl = document.createElement('span');
  nameEl.className = 'tab-group-name';
  nameEl.textContent = group.name || '未命名分组';
  nameEl.contentEditable = true;
  nameEl.spellcheck = false;
  // 防止编辑分组名时触发拖拽或回车换行
  nameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameEl.blur();
    }
    e.stopPropagation();
  });

  // 标签数量
  const countEl = document.createElement('span');
  countEl.className = 'tab-group-count';
  countEl.textContent = `${(group.tabs || []).length} 个标签`;

  // 操作按钮（删除分组）
  const actionsEl = document.createElement('span');
  actionsEl.className = 'tab-group-section-actions';
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '删除';
  deleteBtn.addEventListener('click', () => {
    // 删除分组：将组内标签移至最后一个分组或直接移除
    const sections = groupsList.querySelectorAll('.tab-group-section');
    if (sections.length <= 1) {
      // 只剩一个分组，清空标签页
      const items = section.querySelector('.tab-group-items');
      if (items) items.innerHTML = '';
      countEl.textContent = '0 个标签';
      return;
    }
    // 移动标签到最后一个分组
    const lastSection = sections[sections.length - 1];
    const isLastSection = lastSection === section;
    const targetSection = isLastSection ? sections[sections.length - 2] : lastSection;
    const targetItems = targetSection.querySelector('.tab-group-items');
    const currentItems = section.querySelectorAll('.tab-group-item');
    currentItems.forEach(item => targetItems.appendChild(item));
    // 更新目标分组数量
    const targetCount = targetSection.querySelector('.tab-group-count');
    if (targetCount) {
      targetCount.textContent = `${targetItems.children.length} 个标签`;
    }
    // 移除分组和分隔线
    const prevDivider = section.previousElementSibling;
    if (prevDivider && prevDivider.classList.contains('tab-group-divider')) {
      prevDivider.remove();
    }
    section.remove();
  });
  actionsEl.appendChild(deleteBtn);

  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(actionsEl);

  // 标签页列表
  const items = document.createElement('div');
  items.className = 'tab-group-items';
  // 拖拽放置目标
  items.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    items.classList.add('drag-over');
  });
  items.addEventListener('dragleave', () => {
    items.classList.remove('drag-over');
  });
  items.addEventListener('drop', (e) => {
    e.preventDefault();
    items.classList.remove('drag-over');
    const tabId = e.dataTransfer.getData('text/tab-id');
    const sourceGroupIndex = e.dataTransfer.getData('text/source-group-index');
    if (!tabId) return;

    // 查找被拖拽的标签元素
    const draggedEl = card.querySelector(`[data-tab-id="${tabId}"]`);
    if (!draggedEl) return;

    // 移动到目标分组
    items.appendChild(draggedEl);

    // 更新源分组和目标分组的计数
    updateGroupCounts(groupsList);
  });

  // 渲染标签页
  if (group.tabs) {
    group.tabs.forEach(tab => {
      items.appendChild(renderTabGroupItem(tab, groupIndex));
    });
  }

  section.appendChild(header);
  section.appendChild(items);

  return section;
}

/**
 * 渲染单个标签页项
 *
 * 显示容器颜色圆点、favicon、标题和 URL，支持拖拽操作。
 *
 * @param {Object} tab - 标签页数据
 * @param {string} tab.id - 标签页 ID
 * @param {string} tab.title - 标签页标题
 * @param {string} tab.url - 标签页 URL
 * @param {string} tab.containerId - 容器 ID
 * @param {string} [tab.faviconUrl] - Favicon URL
 * @param {number} groupIndex - 所属分组索引
 * @returns {HTMLElement} 标签页项 DOM 元素
 */
function renderTabGroupItem(tab, groupIndex) {
  const item = document.createElement('div');
  item.className = 'tab-group-item';
  item.draggable = true;
  item.dataset.tabId = tab.id;
  item.dataset.groupIndex = groupIndex;

  // 拖拽事件
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/tab-id', tab.id);
    e.dataTransfer.setData('text/source-group-index', String(groupIndex));
    e.dataTransfer.effectAllowed = 'move';
    item.classList.add('dragging');
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
  });

  // 容器颜色圆点
  const colorDot = document.createElement('span');
  colorDot.className = 'tab-item-color-dot';
  colorDot.style.backgroundColor = getContainerColor(tab.containerId);

  // Favicon
  const favicon = document.createElement('span');
  favicon.className = 'tab-item-favicon';
  if (tab.faviconUrl) {
    const img = document.createElement('img');
    img.src = tab.faviconUrl;
    img.onerror = () => {
      // 加载失败时显示默认图标
      img.remove();
      favicon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
    };
    favicon.appendChild(img);
  } else {
    favicon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
  }

  // 标题
  const title = document.createElement('span');
  title.className = 'tab-item-title';
  title.textContent = tab.title || '(无标题)';
  title.title = tab.title || '';

  // URL
  const url = document.createElement('span');
  url.className = 'tab-item-url';
  try {
    url.textContent = new URL(tab.url).hostname;
  } catch {
    url.textContent = tab.url || '';
  }
  url.title = tab.url || '';

  item.appendChild(colorDot);
  item.appendChild(favicon);
  item.appendChild(title);
  item.appendChild(url);

  return item;
}

/**
 * 从 DOM 收集当前分组数据
 *
 * 遍历分组列表 DOM，收集每个分组的名称和标签页 ID 列表。
 *
 * @param {HTMLElement} groupsList - 分组列表容器
 * @returns {Array<{name: string, tabIds: string[]}>} 分组数据数组
 */
function collectTabGroupsFromDOM(groupsList) {
  if (!groupsList) return [];

  const sections = groupsList.querySelectorAll('.tab-group-section');
  const groups = [];

  sections.forEach(section => {
    const nameEl = section.querySelector('.tab-group-name');
    const items = section.querySelectorAll('.tab-group-item');
    const tabIds = Array.from(items).map(item => item.dataset.tabId).filter(Boolean);

    groups.push({
      name: nameEl ? nameEl.textContent.trim() : '未命名分组',
      tabIds,
    });
  });

  return groups;
}

/**
 * 更新所有分组的标签数量显示
 *
 * @param {HTMLElement} groupsList - 分组列表容器
 */
function updateGroupCounts(groupsList) {
  if (!groupsList) return;

  const sections = groupsList.querySelectorAll('.tab-group-section');
  sections.forEach(section => {
    const countEl = section.querySelector('.tab-group-count');
    const items = section.querySelectorAll('.tab-group-item');
    if (countEl) {
      countEl.textContent = `${items.length} 个标签`;
    }
  });
}

/**
 * 渲染收藏夹整理方案卡片
 *
 * 克隆 favorites-organize-template 模板，填充分组数据和收藏列表，
 * 绑定应用整理、取消、添加分组按钮事件。交互与标签分组卡片一致：
 * 分组名可编辑、收藏项可跨组拖拽、分组可删除/新增。
 *
 * @param {Object} planData - 整理方案数据
 * @param {Array<{folderName: string, parentId: number, bookmarks: Array<{id: number, title: string, url: string}>}>} planData.plan - 分组方案
 * @returns {HTMLElement} 渲染好的卡片 DOM 元素
 */
function renderFavoritesOrganizeCard(planData) {
  const template = document.getElementById('favorites-organize-template');
  if (!template) {
    console.error('[Realm Renderer] favorites-organize-template 未找到');
    return null;
  }

  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.favorites-organize-card');

  // 计算总收藏数
  const totalBookmarks = (planData.plan || []).reduce(
    (sum, g) => sum + (g.bookmarks ? g.bookmarks.length : 0), 0
  );

  // 设置描述文本
  const descEl = card.querySelector('.favorites-organize-desc');
  if (descEl) {
    descEl.textContent = `归类 ${totalBookmarks} 条收藏到 ${planData.plan.length} 个文件夹`;
  }

  // 渲染分组列表
  const groupsList = card.querySelector('.favorites-organize-list');
  if (groupsList && planData.plan) {
    planData.plan.forEach((group, index) => {
      // 分隔线（非第一个分组前）
      if (index > 0) {
        const divider = document.createElement('div');
        divider.className = 'tab-group-divider';
        groupsList.appendChild(divider);
      }
      const section = renderFavoritesOrganizeSection(group, index, groupsList, card);
      groupsList.appendChild(section);
    });
  }

  // 绑定"应用整理"按钮
  const applyBtn = card.querySelector('.favorites-organize-apply-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      // 收集当前分组数据
      const currentPlan = collectFavoritesPlanFromDOM(groupsList);
      if (!currentPlan || currentPlan.length === 0) return;

      // 禁用按钮防止重复操作
      applyBtn.disabled = true;
      applyBtn.textContent = '应用中...';

      // 通过 IPC 发送到主进程执行整理
      if (window.realmAPI && window.realmAPI.applyFavoritesOrganize) {
        window.realmAPI.applyFavoritesOrganize(currentPlan).then(result => {
          if (result && result.success) {
            // 显示成功提示（含部分失败明细）
            if (result.failures && result.failures.length > 0) {
              showToast(`已整理 ${result.movedCount} 条收藏，${result.failures.length} 条失败`, 'success');
            } else {
              showToast(`已整理 ${result.movedCount} 条收藏到 ${result.folderCount} 个文件夹`, 'success');
            }
            // 只淡出移除卡片本身，不能 closest('.ai-message') 删整条 AI 消息
            card.style.transition = 'opacity 0.3s';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
          } else {
            showToast((result && result.message) || '应用整理失败', 'error');
            applyBtn.disabled = false;
            applyBtn.textContent = '应用整理';
          }
        }).catch(err => {
          console.error('[Realm Renderer] 应用收藏整理异常:', err.message);
          showToast('应用整理失败: ' + err.message, 'error');
          applyBtn.disabled = false;
          applyBtn.textContent = '应用整理';
        });
      }
    });
  }

  // 绑定"取消"按钮
  const cancelBtn = card.querySelector('.favorites-organize-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // 只淡出移除卡片本身，不能 closest('.ai-message') 删整条 AI 消息
      card.style.transition = 'opacity 0.3s';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
    });
  }

  // 绑定"+ 添加分组"按钮
  const addGroupBtn = card.querySelector('.favorites-organize-add-btn');
  if (addGroupBtn) {
    addGroupBtn.addEventListener('click', () => {
      const newGroup = { folderName: '新文件夹', parentId: 0, bookmarks: [] };
      // 添加分隔线
      const divider = document.createElement('div');
      divider.className = 'tab-group-divider';
      groupsList.appendChild(divider);
      // 添加新分组
      const section = renderFavoritesOrganizeSection(newGroup, 0, groupsList, card);
      groupsList.appendChild(section);
      // 自动聚焦分组名编辑
      const nameEl = section.querySelector('.favorites-organize-name');
      if (nameEl) {
        nameEl.focus();
        // 选中默认文本
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        const sel = window.getSelection();
        sel.addRange(range);
      }
    });
  }

  return card;
}

/**
 * 渲染收藏整理方案的单个分组区域
 *
 * 创建分组头部（名称、数量、删除按钮）和收藏列表，
 * 支持编辑文件夹名、跨分组拖拽收藏项。
 *
 * @param {Object} group - 分组数据
 * @param {string} group.folderName - 文件夹名称
 * @param {Array} group.bookmarks - 收藏数组
 * @param {number} groupIndex - 分组索引
 * @param {HTMLElement} groupsList - 分组列表容器
 * @param {HTMLElement} card - 卡片根元素
 * @returns {HTMLElement} 分组区域 DOM 元素
 */
function renderFavoritesOrganizeSection(group, groupIndex, groupsList, card) {
  const section = document.createElement('div');
  section.className = 'tab-group-section';
  section.dataset.groupIndex = groupIndex;

  // 分组头部
  const header = document.createElement('div');
  header.className = 'tab-group-section-header';

  // 文件夹名（contenteditable 可编辑）
  const nameEl = document.createElement('span');
  nameEl.className = 'tab-group-name favorites-organize-name';
  nameEl.textContent = group.folderName || '未命名文件夹';
  nameEl.contentEditable = true;
  nameEl.spellcheck = false;
  // 防止编辑文件夹名时触发拖拽或回车换行
  nameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameEl.blur();
    }
    e.stopPropagation();
  });

  // 收藏数量
  const countEl = document.createElement('span');
  countEl.className = 'tab-group-count';
  countEl.textContent = `${(group.bookmarks || []).length} 条收藏`;

  // 操作按钮（删除分组）
  const actionsEl = document.createElement('span');
  actionsEl.className = 'tab-group-section-actions';
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '删除';
  deleteBtn.addEventListener('click', () => {
    // 删除分组：将组内收藏移至最后一个分组或直接移除
    const sections = groupsList.querySelectorAll('.tab-group-section');
    if (sections.length <= 1) {
      // 只剩一个分组，清空收藏
      const items = section.querySelector('.tab-group-items');
      if (items) items.innerHTML = '';
      countEl.textContent = '0 条收藏';
      return;
    }
    // 移动收藏到最后一个分组
    const lastSection = sections[sections.length - 1];
    const isLastSection = lastSection === section;
    const targetSection = isLastSection ? sections[sections.length - 2] : lastSection;
    const targetItems = targetSection.querySelector('.tab-group-items');
    const currentItems = section.querySelectorAll('.tab-group-item');
    currentItems.forEach(item => targetItems.appendChild(item));
    // 更新目标分组数量
    const targetCount = targetSection.querySelector('.tab-group-count');
    if (targetCount) {
      targetCount.textContent = `${targetItems.children.length} 条收藏`;
    }
    // 移除分组和分隔线
    const prevDivider = section.previousElementSibling;
    if (prevDivider && prevDivider.classList.contains('tab-group-divider')) {
      prevDivider.remove();
    }
    section.remove();
  });
  actionsEl.appendChild(deleteBtn);

  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(actionsEl);

  // 收藏列表
  const items = document.createElement('div');
  items.className = 'tab-group-items';
  // 拖拽放置目标
  items.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    items.classList.add('drag-over');
  });
  items.addEventListener('dragleave', () => {
    items.classList.remove('drag-over');
  });
  items.addEventListener('drop', (e) => {
    e.preventDefault();
    items.classList.remove('drag-over');
    const bookmarkId = e.dataTransfer.getData('text/bookmark-id');
    if (!bookmarkId) return;

    // 查找被拖拽的收藏元素
    const draggedEl = card.querySelector(`[data-bookmark-id="${bookmarkId}"]`);
    if (!draggedEl) return;

    // 移动到目标分组
    items.appendChild(draggedEl);

    // 更新所有分组计数
    updateFavoritesGroupCounts(groupsList);
  });

  // 渲染收藏项
  if (group.bookmarks) {
    group.bookmarks.forEach(bookmark => {
      items.appendChild(renderFavoritesOrganizeItem(bookmark, groupIndex));
    });
  }

  section.appendChild(header);
  section.appendChild(items);

  return section;
}

/**
 * 渲染收藏整理方案中的单个收藏项
 *
 * 显示 favicon 占位、标题和域名，支持拖拽操作。
 *
 * @param {Object} bookmark - 收藏数据
 * @param {number} bookmark.id - 收藏 ID
 * @param {string} bookmark.title - 收藏标题
 * @param {string} bookmark.url - 收藏 URL
 * @param {number} groupIndex - 所属分组索引
 * @returns {HTMLElement} 收藏项 DOM 元素
 */
function renderFavoritesOrganizeItem(bookmark, groupIndex) {
  const item = document.createElement('div');
  item.className = 'tab-group-item';
  item.draggable = true;
  item.dataset.bookmarkId = String(bookmark.id);
  item.dataset.groupIndex = groupIndex;

  // 拖拽事件（自定义 MIME text/bookmark-id，勿加 text/plain——
  // 防止误拖进 webview 松手触发网页导航）
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/bookmark-id', String(bookmark.id));
    e.dataTransfer.setData('text/source-group-index', String(groupIndex));
    e.dataTransfer.effectAllowed = 'move';
    item.classList.add('dragging');
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
  });

  // Favicon 占位（地球图标）
  const favicon = document.createElement('span');
  favicon.className = 'tab-item-favicon';
  favicon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';

  // 标题
  const title = document.createElement('span');
  title.className = 'tab-item-title';
  title.textContent = bookmark.title || '(无标题)';
  title.title = bookmark.title || '';

  // URL
  const url = document.createElement('span');
  url.className = 'tab-item-url';
  try {
    url.textContent = new URL(bookmark.url).hostname;
  } catch {
    url.textContent = bookmark.url || '';
  }
  url.title = bookmark.url || '';

  item.appendChild(favicon);
  item.appendChild(title);
  item.appendChild(url);

  return item;
}

/**
 * 从 DOM 收集当前收藏整理方案
 *
 * 遍历分组列表 DOM，收集每个分组的文件夹名和收藏 ID 列表。
 *
 * @param {HTMLElement} groupsList - 分组列表容器
 * @returns {Array<{folderName: string, parentId: number, bookmarkIds: number[]}>} 整理方案数组
 */
function collectFavoritesPlanFromDOM(groupsList) {
  if (!groupsList) return [];

  const sections = groupsList.querySelectorAll('.tab-group-section');
  const plan = [];

  sections.forEach(section => {
    const nameEl = section.querySelector('.favorites-organize-name');
    const items = section.querySelectorAll('.tab-group-item');
    const bookmarkIds = Array.from(items)
      .map(item => Number(item.dataset.bookmarkId))
      .filter(id => Number.isInteger(id) && id > 0);

    plan.push({
      folderName: nameEl ? nameEl.textContent.trim() : '未命名文件夹',
      parentId: 0,
      bookmarkIds,
    });
  });

  return plan;
}

/**
 * 更新所有整理分组的收藏数量显示
 *
 * @param {HTMLElement} groupsList - 分组列表容器
 */
function updateFavoritesGroupCounts(groupsList) {
  if (!groupsList) return;

  const sections = groupsList.querySelectorAll('.tab-group-section');
  sections.forEach(section => {
    const countEl = section.querySelector('.tab-group-count');
    const items = section.querySelectorAll('.tab-group-item');
    if (countEl) {
      countEl.textContent = `${items.length} 条收藏`;
    }
  });
}

/**
 * 处理脚本步骤状态更新
 *
 * 主进程每执行完一步后通过 script:step-update IPC 推送状态到渲染进程。
 * 根据 update.index 定位对应的 .script-step-item 元素，更新其视觉状态。
 *
 * 状态说明：
 * - executing: 步骤正在执行，显示加载动画
 * - success: 步骤执行成功，序号变为绿色对勾
 * - error: 步骤执行失败，显示错误信息和重试/跳过/终止按钮
 * - aborted: 执行已停止，标记为灰色
 *
 * @param {Object} update - 步骤状态更新数据
 * @param {number} update.index - 步骤索引（0-based）
 * @param {string} update.status - 状态：executing/success/error/aborted
 * @param {Object} [update.step] - 步骤数据
 * @param {Object} [update.result] - 执行结果（success 时）
 * @param {string} [update.error] - 错误信息（error/aborted 时）
 */
function handleStepUpdate(update) {
  const { index, status, error } = update;

  // 定位脚本预览卡片中的步骤元素
  // 脚本卡片可能在任意消息中，遍历所有卡片查找对应索引
  const allCards = document.querySelectorAll('.script-preview-card');
  let targetItem = null;
  let targetStepsList = null;

  for (const card of allCards) {
    const stepsList = card.querySelector('.script-steps-list');
    if (stepsList) {
      const items = stepsList.querySelectorAll('.script-step-item');
      if (items[index]) {
        targetItem = items[index];
        targetStepsList = stepsList;
        break;
      }
    }
  }

  if (!targetItem) {
    console.warn(`[Realm Renderer] 步骤 ${index + 1} 的 DOM 元素未找到`);
    return;
  }

  // 清除旧状态类
  targetItem.classList.remove('step-executing', 'step-success', 'step-error', 'step-skipped');

  // 移除已有的错误面板
  const existingPanel = targetItem.querySelector('.step-error-panel');
  if (existingPanel) existingPanel.remove();

  switch (status) {
    case 'executing': {
      targetItem.classList.add('step-executing');
      // 更新序号为加载动画
      const numberEl = targetItem.querySelector('.step-number');
      if (numberEl) {
        numberEl.innerHTML = '<span class="step-spinner"></span>';
      }
      break;
    }

    case 'success': {
      targetItem.classList.add('step-success');
      // 更新序号为绿色对勾
      const numberEl = targetItem.querySelector('.step-number');
      if (numberEl) {
        numberEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        numberEl.style.color = '#10b981';
      }
      break;
    }

    case 'error': {
      targetItem.classList.add('step-error');
      // 更新序号为红色叉号
      const numberEl = targetItem.querySelector('.step-number');
      if (numberEl) {
        numberEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        numberEl.style.color = '#ef4444';
      }

      // 创建错误面板（使用 textContent 防止 XSS — CR-01 修复）
      const errorMessage = document.createElement('div');
      errorMessage.className = 'step-error-message';
      errorMessage.textContent = error || '操作执行失败';

      const errorActions = document.createElement('div');
      errorActions.className = 'step-error-actions';

      const retryBtn = document.createElement('button');
      retryBtn.className = 'step-retry-btn';
      retryBtn.textContent = '重试';

      const skipBtn = document.createElement('button');
      skipBtn.className = 'step-skip-btn';
      skipBtn.textContent = '跳过';

      const abortBtn = document.createElement('button');
      abortBtn.className = 'step-abort-btn';
      abortBtn.textContent = '终止';

      errorActions.appendChild(retryBtn);
      errorActions.appendChild(skipBtn);
      errorActions.appendChild(abortBtn);

      const errorPanel = document.createElement('div');
      errorPanel.className = 'step-error-panel';
      errorPanel.appendChild(errorMessage);
      errorPanel.appendChild(errorActions);

      // 重试按钮：重新执行当前步骤
      retryBtn.addEventListener('click', () => {
        errorPanel.remove();
        // 收集当前脚本数据并从失败步骤重新执行
        if (targetStepsList) {
          const card = targetStepsList.closest('.script-preview-card');
          const executeBtn = card ? card.querySelector('.script-execute-btn') : null;
          if (executeBtn) executeBtn.click();
        }
      });

      // 跳过按钮：标记为已跳过，继续执行下一步
      skipBtn.addEventListener('click', () => {
        errorPanel.remove();
        targetItem.classList.remove('step-error');
        targetItem.classList.add('step-skipped');
        const numEl = targetItem.querySelector('.step-number');
        if (numEl) {
          numEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 4 12 12 4 20"></polyline><line x1="12" y1="4" x2="20" y2="20"></line></svg>';
          numEl.style.color = '#6b7280';
        }
      });

      // 终止按钮：调用 scriptStop 停止执行
      abortBtn.addEventListener('click', () => {
        if (window.realmAPI && window.realmAPI.scriptStop) {
          window.realmAPI.scriptStop();
        }
        errorPanel.remove();
      });

      targetItem.appendChild(errorPanel);
      break;
    }

    case 'aborted': {
      targetItem.classList.add('step-error');
      const numberEl = targetItem.querySelector('.step-number');
      if (numberEl) {
        numberEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>';
        numberEl.style.color = '#6b7280';
      }
      break;
    }
  }
}

/**
 * 渲染单个步骤项
 *
 * 创建 .script-step-item 容器，包含拖拽手柄、序号、操作标签、目标描述、参数和操作按钮。
 * 支持拖拽排序和内联编辑。
 *
 * @param {Object} step - 步骤数据
 * @param {number} index - 步骤索引
 * @param {HTMLElement} stepsList - 步骤列表容器
 * @param {HTMLElement} card - 所属卡片元素
 * @returns {HTMLElement} 步骤项 DOM 元素
 */
function renderScriptStepItem(step, index, stepsList, card) {
  const item = document.createElement('div');
  item.className = 'script-step-item';
  item.draggable = true;
  item.dataset.index = index;

  // 拖拽手柄
  const dragHandle = document.createElement('div');
  dragHandle.className = 'step-drag-handle';
  dragHandle.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>';

  // 序号
  const numberEl = document.createElement('div');
  numberEl.className = 'step-number';
  numberEl.textContent = String(index + 1);

  // 步骤内容区
  const content = document.createElement('div');
  content.className = 'step-content';

  const contentRow = document.createElement('div');
  contentRow.className = 'step-content-row';

  // 操作类型标签
  const actionLabel = document.createElement('span');
  actionLabel.className = 'step-action-label';
  actionLabel.textContent = getActionLabel(step.action);

  // 目标描述（使用 textContent 防止 XSS）
  const targetEl = document.createElement('span');
  targetEl.className = 'step-target';
  targetEl.textContent = step.target || '(未设置目标)';

  contentRow.appendChild(actionLabel);
  contentRow.appendChild(targetEl);

  // 参数值（如果有）
  if (step.options) {
    const paramsEl = document.createElement('span');
    paramsEl.className = 'step-params';
    const paramStr = typeof step.options === 'object'
      ? JSON.stringify(step.options)
      : String(step.options);
    // 截断过长的参数显示
    paramsEl.textContent = paramStr.length > 50 ? paramStr.substring(0, 50) + '...' : paramStr;
    contentRow.appendChild(paramsEl);
  }

  content.appendChild(contentRow);

  // 操作按钮组
  const actions = document.createElement('div');
  actions.className = 'step-actions';

  // 编辑按钮
  const editBtn = document.createElement('button');
  editBtn.className = 'step-action-btn step-edit-btn';
  editBtn.title = '编辑';
  editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 如果已有编辑器则关闭
    const existingEditor = item.querySelector('.step-editor');
    if (existingEditor) {
      existingEditor.remove();
      return;
    }
    const editor = renderStepEditor(step, index, (updatedStep) => {
      // 更新步骤数据并重新渲染内容
      step.action = updatedStep.action;
      step.target = updatedStep.target;
      if (updatedStep.options !== undefined) {
        step.options = updatedStep.options;
      }
      // 更新显示
      actionLabel.textContent = getActionLabel(step.action);
      targetEl.textContent = step.target || '(未设置目标)';
      editor.remove();
    });
    content.appendChild(editor);
  });

  // 删除按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'step-action-btn step-delete-btn';
  deleteBtn.title = '删除';
  deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    item.style.transition = 'opacity 0.2s';
    item.style.opacity = '0';
    setTimeout(() => {
      item.remove();
      renumberSteps(stepsList);
    }, 200);
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  item.appendChild(dragHandle);
  item.appendChild(numberEl);
  item.appendChild(content);
  item.appendChild(actions);

  // 拖拽事件
  let dragStartIndex = -1;

  item.addEventListener('dragstart', (e) => {
    dragStartIndex = parseInt(item.dataset.index, 10);
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragStartIndex));
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    // 清除所有 drag-over 状态
    stepsList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // 添加插入指示
    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      item.classList.add('drag-over');
    } else {
      item.classList.remove('drag-over');
    }
  });

  item.addEventListener('dragleave', () => {
    item.classList.remove('drag-over');
  });

  item.addEventListener('drop', (e) => {
    e.preventDefault();
    item.classList.remove('drag-over');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIndex = parseInt(item.dataset.index, 10);
    if (fromIndex === toIndex) return;

    // 重新排列 DOM
    const allItems = Array.from(stepsList.children);
    const draggedItem = allItems[fromIndex];
    if (!draggedItem) return;

    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      stepsList.insertBefore(draggedItem, item);
    } else {
      stepsList.insertBefore(draggedItem, item.nextSibling);
    }

    renumberSteps(stepsList);
  });

  return item;
}

/**
 * 渲染步骤内联编辑器
 *
 * 在步骤内容区展开一个编辑表单，支持修改操作类型、目标和参数。
 *
 * @param {Object} step - 步骤数据
 * @param {number} index - 步骤索引
 * @param {Function} onSave - 保存回调，接收更新后的步骤数据
 * @returns {HTMLElement} 编辑器 DOM 元素
 */
function renderStepEditor(step, index, onSave) {
  const editor = document.createElement('div');
  editor.className = 'step-editor';

  // 支持的操作类型列表
  const actionTypes = [
    'navigate', 'click', 'type', 'scroll', 'wait',
    'select', 'check', 'uncheck', 'focus', 'blur',
    'submit', 'keydown', 'keyup'
  ];

  // 操作类型选择器
  const actionRow = document.createElement('div');
  actionRow.className = 'step-editor-row';
  const actionLabelEl = document.createElement('label');
  actionLabelEl.textContent = '操作';
  const actionSelect = document.createElement('select');
  actionTypes.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = getActionLabel(type);
    if (type === step.action) opt.selected = true;
    actionSelect.appendChild(opt);
  });
  actionRow.appendChild(actionLabelEl);
  actionRow.appendChild(actionSelect);
  editor.appendChild(actionRow);

  // 目标输入框
  const targetRow = document.createElement('div');
  targetRow.className = 'step-editor-row';
  const targetLabelEl = document.createElement('label');
  targetLabelEl.textContent = '目标';
  const targetInput = document.createElement('input');
  targetInput.type = 'text';
  targetInput.className = 'step-target-input';
  targetInput.value = step.target || '';
  targetInput.placeholder = '元素选择器或描述';
  targetRow.appendChild(targetLabelEl);
  targetRow.appendChild(targetInput);
  editor.appendChild(targetRow);

  // 参数输入框（条件显示：type/select/keydown 时显示）
  const needsParam = ['type', 'select', 'keydown'].includes(step.action);
  let paramInput = null;
  if (needsParam) {
    const paramRow = document.createElement('div');
    paramRow.className = 'step-editor-row';
    const paramLabelEl = document.createElement('label');
    paramLabelEl.textContent = '参数';
    paramInput = document.createElement('input');
    paramInput.type = 'text';
    paramInput.className = 'step-param-input';
    // 从 options 中提取参数值
    if (step.options) {
      if (typeof step.options === 'object') {
        paramInput.value = step.options.value || step.options.text || JSON.stringify(step.options);
      } else {
        paramInput.value = String(step.options);
      }
    }
    paramInput.placeholder = '参数值';
    paramRow.appendChild(paramLabelEl);
    paramRow.appendChild(paramInput);
    editor.appendChild(paramRow);
  }

  // 操作类型变化时显示/隐藏参数行
  actionSelect.addEventListener('change', () => {
    const selectedAction = actionSelect.value;
    const shouldShowParam = ['type', 'select', 'keydown'].includes(selectedAction);
    const existingParamRow = editor.querySelector('.step-editor-row:last-child');
    if (shouldShowParam && !editor.querySelector('.step-param-input')) {
      const paramRow = document.createElement('div');
      paramRow.className = 'step-editor-row';
      const paramLabelEl = document.createElement('label');
      paramLabelEl.textContent = '参数';
      paramInput = document.createElement('input');
      paramInput.type = 'text';
      paramInput.className = 'step-param-input';
      paramInput.placeholder = '参数值';
      paramRow.appendChild(paramLabelEl);
      paramRow.appendChild(paramInput);
      // 插入到操作按钮之前
      const actionsEl = editor.querySelector('.step-editor-actions');
      if (actionsEl) {
        editor.insertBefore(paramRow, actionsEl);
      } else {
        editor.appendChild(paramRow);
      }
    } else if (!shouldShowParam) {
      const paramInputEl = editor.querySelector('.step-param-input');
      if (paramInputEl) {
        paramInputEl.closest('.step-editor-row').remove();
        paramInput = null;
      }
    }
  });

  // 保存/取消按钮
  const actionsRow = document.createElement('div');
  actionsRow.className = 'step-editor-actions';

  const saveBtnEl = document.createElement('button');
  saveBtnEl.className = 'step-editor-save';
  saveBtnEl.textContent = '保存';
  saveBtnEl.addEventListener('click', () => {
    const updatedStep = {
      action: actionSelect.value,
      target: targetInput.value
    };
    // 收集参数
    const currentParamInput = editor.querySelector('.step-param-input');
    if (currentParamInput && currentParamInput.value) {
      updatedStep.options = { value: currentParamInput.value };
    }
    onSave(updatedStep);
  });

  const cancelBtnEl = document.createElement('button');
  cancelBtnEl.className = 'step-editor-cancel';
  cancelBtnEl.textContent = '取消';
  cancelBtnEl.addEventListener('click', () => {
    editor.remove();
  });

  actionsRow.appendChild(cancelBtnEl);
  actionsRow.appendChild(saveBtnEl);
  editor.appendChild(actionsRow);

  return editor;
}

/**
 * 从 DOM 中收集当前步骤数据
 *
 * 遍历步骤列表 DOM 元素，提取每个步骤的操作类型、目标和参数。
 *
 * @param {HTMLElement} stepsList - 步骤列表容器
 * @returns {Array} 步骤数据数组
 */
function collectStepsFromDOM(stepsList) {
  if (!stepsList) return [];
  const items = stepsList.querySelectorAll('.script-step-item');
  return Array.from(items).map(item => {
    const actionLabel = item.querySelector('.step-action-label');
    const targetEl = item.querySelector('.step-target');
    const paramsEl = item.querySelector('.step-params');
    // 从中文标签反查操作类型
    const actionText = actionLabel ? actionLabel.textContent : '';
    const actionMap = {
      '导航': 'navigate', '点击': 'click', '输入': 'type', '滚动': 'scroll',
      '等待': 'wait', '选择': 'select', '勾选': 'check', '取消勾选': 'uncheck',
      '聚焦': 'focus', '失焦': 'blur', '提交': 'submit',
      '按下按键': 'keydown', '松开按键': 'keyup'
    };
    const action = actionMap[actionText] || actionText;
    const step = {
      action: action,
      target: targetEl ? targetEl.textContent : ''
    };
    if (paramsEl && paramsEl.textContent) {
      try {
        step.options = JSON.parse(paramsEl.textContent.replace(/\.\.\.$/, ''));
      } catch (e) {
        step.options = { value: paramsEl.textContent };
      }
    }
    return step;
  });
}

/**
 * 步骤重新编号
 *
 * 步骤增删或拖拽排序后，更新所有 .step-number 的文本为当前索引+1。
 *
 * @param {HTMLElement} stepsList - 步骤列表容器
 */
function renumberSteps(stepsList) {
  if (!stepsList) return;
  const items = stepsList.querySelectorAll('.script-step-item');
  items.forEach((item, index) => {
    const numberEl = item.querySelector('.step-number');
    if (numberEl) numberEl.textContent = String(index + 1);
    item.dataset.index = index;
  });
}

/**
 * 初始化操作确认 IPC 监听器
 * 在 init() 中调用，注册 action:request-confirmation 事件监听
 */
function initActionConfirmation() {
  if (!window.realmAPI || !window.realmAPI.onActionRequestConfirmation) return;

  window.realmAPI.onActionRequestConfirmation((data) => {
    console.log('[Realm Renderer] 收到操作确认请求:', data);
    renderConfirmationCard(data);
  });

  // 操作完结推送：执行完成（success/error）或超时取消（cancelled）时推进卡片终态
  if (window.realmAPI.onActionSettle) {
    window.realmAPI.onActionSettle((data) => {
      const card = actionCards.get(data.actionId);
      if (!card) return;
      updateCardState(card, data.state, data.message);
      actionCards.delete(data.actionId);
    });
  }
}

/**
 * 初始化脚本执行步骤状态 IPC 监听器
 * 在 init() 中调用，注册 script:step-update 事件监听
 *
 * 主进程每执行完一步脚本后推送步骤状态到渲染进程，
 * 此监听器调用 handleStepUpdate 更新对应步骤的 UI 状态。
 */
function initScriptStepUpdate() {
  if (!window.realmAPI || !window.realmAPI.onScriptStepUpdate) return;

  window.realmAPI.onScriptStepUpdate((update) => {
    console.log('[Realm Renderer] 脚本步骤更新:', update);
    handleStepUpdate(update);
  });
}

/**
 * Tab 拖拽排序指示器 DOM 元素
 * 在 initTabDragAndDrop 中创建，复用同一个元素避免重复创建
 */
let tabDragIndicator = null;

/**
 * 初始化 Tab 拖拽功能（窗口内排序 + 跨窗口拖拽统一管线）
 *
 * 创建拖拽插入位置指示器，并基于自定义 mousedown/mousemove/mouseup 事件
 * 实现 Chrome 风格的窗口内 Tab 排序与跨窗口拖拽（不使用 HTML5 DnD API，
 * 避免两套拖拽机制竞争导致首次拖拽不生效，见 36-UAT 问题 4）。
 *
 * 在 init() 中调用。
 */
function initTabDragAndDrop() {
  const tabList = elements.tabList;
  if (!tabList) return;

  // 创建拖拽指示器（Chrome 风格的垂直插入线）
  tabDragIndicator = document.createElement('div');
  tabDragIndicator.className = 'tab-drag-indicator';
  tabDragIndicator.style.display = 'none';
  // 指示器插入到 tabBar 容器内，使其相对于 tab 栏定位
  elements.tabBar.appendChild(tabDragIndicator);

  // 无障碍：tabList 标记可接受 drop
  tabList.setAttribute('aria-dropeffect', 'move');

  /**
   * 拖拽结束后抑制紧随其后的 click（避免松手时误触发 switchTab）
   * @type {boolean}
   */
  let suppressTabClick = false;

  // 捕获阶段吞掉拖拽结束后的那一次 click
  tabList.addEventListener('click', (e) => {
    if (suppressTabClick) {
      suppressTabClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  /**
   * 计算窗口内排序的插入目标
   * 遍历 Tab 元素的矩形区域，找到 clientX 命中的 Tab 并按中点判断插入前/后；
   * 鼠标落在所有 Tab 之外时，插入到最前或最后
   *
   * @param {number} clientX - 鼠标的窗口内 X 坐标
   * @param {string} draggedTabId - 正在拖拽的 Tab ID（跳过自身）
   * @returns {{ targetTabId: string, insertAfter: boolean, indicatorX: number }|null}
   */
  function computeInsertTarget(clientX, draggedTabId) {
    const tabEls = Array.from(tabList.querySelectorAll('.tab'))
      .filter(el => el.dataset.tabId !== draggedTabId);
    if (tabEls.length === 0) return null;

    for (const el of tabEls) {
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        const insertAfter = clientX >= rect.left + rect.width / 2;
        return {
          targetTabId: el.dataset.tabId,
          insertAfter,
          indicatorX: insertAfter ? rect.right : rect.left,
        };
      }
    }

    // 鼠标在所有 Tab 左侧空白 → 插到最前；右侧空白 → 插到最后
    const firstRect = tabEls[0].getBoundingClientRect();
    if (clientX < firstRect.left) {
      return { targetTabId: tabEls[0].dataset.tabId, insertAfter: false, indicatorX: firstRect.left };
    }
    const lastEl = tabEls[tabEls.length - 1];
    const lastRect = lastEl.getBoundingClientRect();
    if (clientX > lastRect.right) {
      return { targetTabId: lastEl.dataset.tabId, insertAfter: true, indicatorX: lastRect.right };
    }
    return null;
  }

  /**
   * 执行窗口内 Tab 排序：更新 state.tabs 顺序、重排 DOM、同步主进程
   * （逻辑与原 HTML5 DnD drop 处理器一致）
   *
   * @param {string} draggedTabId - 被拖拽的 Tab ID
   * @param {{ targetTabId: string, insertAfter: boolean }} target - 插入目标
   */
  async function reorderTabLocal(draggedTabId, target) {
    // 收集当前 tabList 中所有 Tab 的顺序
    const tabElements = Array.from(tabList.querySelectorAll('.tab'));
    const orderedIds = tabElements.map(el => el.dataset.tabId);

    // 从原位置移除 draggedTabId
    const fromIndex = orderedIds.indexOf(draggedTabId);
    if (fromIndex === -1) return;
    orderedIds.splice(fromIndex, 1);

    // 计算目标位置
    let toIndex = orderedIds.indexOf(target.targetTabId);
    if (toIndex === -1) return;
    if (target.insertAfter) toIndex += 1;
    orderedIds.splice(toIndex, 0, draggedTabId);

    // 顺序未变化时不触发同步
    const unchanged = tabElements.every((el, i) => el.dataset.tabId === orderedIds[i]);
    if (unchanged) return;

    // 1. 更新本地 state.tabs Map 顺序
    const reorderedTabs = new Map();
    for (const id of orderedIds) {
      if (state.tabs.has(id)) {
        reorderedTabs.set(id, state.tabs.get(id));
      }
    }
    state.tabs = reorderedTabs;

    // 2. 重排 tabList DOM
    for (const id of orderedIds) {
      const tab = state.tabs.get(id);
      if (tab && tab.element) {
        tabList.appendChild(tab.element);
      }
    }

    // 3. 同步到主进程
    try {
      await window.realmAPI.tabDndReorder(orderedIds);
    } catch (err) {
      console.error('[Realm Renderer] Tab 拖拽排序同步失败:', err);
    }
  }

  // ==================== 跨窗口 Tab 拖拽（Phase 36 Plan 03） ====================

  /** 浮动预览 DOM 元素 */
  let dragPreview = null;
  /** mousedown 起始位置（屏幕坐标） */
  let crossDragStartScreenX = 0;
  let crossDragStartScreenY = 0;
  /** mousedown 时的 Tab ID */
  let crossDragTabId = null;
  /** 是否正在监听 mousemove（避免重复绑定） */
  let crossDragListenersAttached = false;
  /** 拖拽过程中最近一次计算的窗口内插入目标（mouseup 时用于排序） */
  let lastInsertTarget = null;

  const CROSS_DRAG_THRESHOLD = 5; // 激活跨窗口拖拽的最小移动距离（px）
  const POSITION_REPORT_INTERVAL = 50; // 向主进程报告位置的节流间隔（ms）
  // 拖出 Tab 栏下缘的垂直容差：容差内仍视为在 Tab 栏内（排序模式），
  // 与主进程 drag-coordinator.js isDraggedOutOfTabBar 的 EXIT_THRESHOLD 保持同步
  const TAB_BAR_EXIT_TOLERANCE = 4;
  /** 拖拽位置报告请求序列号（用于丢弃过期响应，避免乱序导致 targetWindowId 错误） */
  let dragRequestSeq = 0;

  /**
   * 创建浮动预览元素
   * @param {HTMLElement} tabElement - 源 Tab DOM 元素
   */
  function createDragPreview(tabElement) {
    if (dragPreview) dragPreview.remove();

    dragPreview = document.createElement('div');
    dragPreview.className = 'tab-drag-preview';

    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    const faviconEl = tabElement.querySelector('.tab-favicon img, .tab-favicon');
    if (faviconEl) {
      favicon.src = faviconEl.src || faviconEl.getAttribute('src') || '';
    }

    const title = document.createElement('span');
    title.className = 'title';
    const titleEl = tabElement.querySelector('.tab-title');
    title.textContent = titleEl ? titleEl.textContent : 'Tab';

    dragPreview.appendChild(favicon);
    dragPreview.appendChild(title);
    dragPreview.style.display = 'none';
    document.body.appendChild(dragPreview);
  }

  /**
   * 更新浮动预览位置
   * @param {number} screenX - 屏幕坐标 X
   * @param {number} screenY - 屏幕坐标 Y
   */
  function updateDragPreviewPosition(screenX, screenY) {
    if (!dragPreview) return;
    // 将屏幕坐标转为窗口内坐标（fixed 定位）
    // window.screenX/Y 是窗口左上角的屏幕坐标
    const x = screenX - window.screenX;
    const y = screenY - window.screenY;
    dragPreview.style.left = `${x + 10}px`;
    dragPreview.style.top = `${y + 10}px`;
  }

  /**
   * 显示浮动预览
   */
  function showDragPreview() {
    if (dragPreview) dragPreview.style.display = '';
  }

  /**
   * 隐藏并移除浮动预览
   */
  function removeDragPreview() {
    if (dragPreview) {
      dragPreview.remove();
      dragPreview = null;
    }
  }

  /**
   * 跨窗口拖拽：mousedown 处理器
   * 记录起始位置和 Tab ID，等待超过阈值后激活
   */
  function onCrossDragMouseDown(e) {
    // 仅处理左键
    if (e.button !== 0) return;
    // 关闭按钮不参与拖拽
    if (e.target.closest('.tab-close')) return;
    const tabEl = e.target.closest('.tab');
    if (!tabEl) return;

    // 新交互开始：复位 click 抑制标志（防上次拖拽松手在 tabList 外导致标志残留）
    suppressTabClick = false;

    crossDragTabId = tabEl.dataset.tabId;
    crossDragStartScreenX = e.screenX;
    crossDragStartScreenY = e.screenY;

    // 绑定全局 mousemove/mouseup/keydown（capture 阶段确保不被 webview 吞掉）
    if (!crossDragListenersAttached) {
      document.addEventListener('mousemove', onCrossDragMouseMove, true);
      document.addEventListener('mouseup', onCrossDragMouseUp, true);
      document.addEventListener('keydown', onCrossDragKeyDown, true);
      crossDragListenersAttached = true;
    }
  }


  /**
   * 跨窗口拖拽：mousemove 处理器
   * 超过阈值后激活跨窗口拖拽，更新浮动预览和主进程位置
   */
  function onCrossDragMouseMove(e) {
    if (!crossDragTabId) return;

    const dx = e.screenX - crossDragStartScreenX;
    const dy = e.screenY - crossDragStartScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 未超过阈值：不激活
    if (!state.crossDrag.active && distance < CROSS_DRAG_THRESHOLD) return;

    // 超过阈值：激活拖拽（窗口内排序与跨窗口拖拽共用同一状态机）
    if (!state.crossDrag.active) {
      state.crossDrag.active = true;
      state.crossDrag.tabId = crossDragTabId;
      state.crossDrag.startScreenX = crossDragStartScreenX;
      state.crossDrag.startScreenY = crossDragStartScreenY;
      state.isDragging = true;
      state.draggingTabId = crossDragTabId;

      // 创建浮动预览
      const tabEl = elements.tabList.querySelector(`[data-tab-id="${crossDragTabId}"]`);
      if (tabEl) {
        createDragPreview(tabEl);
        showDragPreview();
      }

      // 通知主进程拖拽开始
      window.realmAPI.startDrag(crossDragTabId).catch(err => {
        console.error('[Realm Renderer] drag:start 失败:', err);
      });

      // 添加拖拽中的视觉样式
      if (tabEl) {
        tabEl.classList.add('dragging');
        tabEl.classList.add('cross-dragging');
      }

      // 拖拽期间关闭所有 webview 的鼠标命中：
      // 鼠标经过 webview 区域时事件会被 guest 页吞掉，导致 mousemove/mouseup 断流、
      // 浮动预览卡在页面上（与 initAIPanelResize 同款需求，统一走 suspend 入口）
      suspendWebviewHitTest('tab-cross-drag');
    }

    // 窗口内排序反馈：鼠标在 Tab 栏内时显示插入指示器并隐藏浮动预览；
    // 拖出 Tab 栏后隐藏指示器、显示浮动预览
    const tabBarRect = elements.tabBar.getBoundingClientRect();
    const inTabBar = e.clientY >= tabBarRect.top && e.clientY <= tabBarRect.bottom + TAB_BAR_EXIT_TOLERANCE;
    if (inTabBar) {
      if (dragPreview) dragPreview.style.display = 'none';
      lastInsertTarget = computeInsertTarget(e.clientX, state.crossDrag.tabId);
      if (lastInsertTarget) {
        showInsertIndicator(lastInsertTarget.indicatorX);
      } else {
        hideInsertIndicator();
      }
    } else {
      lastInsertTarget = null;
      hideInsertIndicator();
      showDragPreview();
    }

    // 更新浮动预览位置
    updateDragPreviewPosition(e.screenX, e.screenY);

    // 节流：向主进程报告位置，获取目标窗口信息
    const now = Date.now();
    if (now - state.crossDrag.lastReportTime >= POSITION_REPORT_INTERVAL) {
      state.crossDrag.lastReportTime = now;
      const seq = ++dragRequestSeq;
      window.realmAPI.updateDragPosition({
        x: e.clientX,
        y: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
      }).then(result => {
        // 丢弃过期响应（快速移动时后发请求可能先返回）
        if (seq !== dragRequestSeq) return;
        if (result) {
          // 记录主进程返回的目标窗口信息（用于 mouseup 时判断动作）
          state.crossDrag.targetWindowId = result.targetWindow
            ? result.targetWindow.windowId
            : null;
          state.crossDrag.outOfTabBar = result.outOfTabBar || false;
        }
      }).catch(err => {
        console.error('[Realm Renderer] drag:update-position 失败:', err);
      });
    }
  }

  /**
   * 跨窗口拖拽：mouseup 处理器
   * 根据松手位置判断执行动作（新窗口/跨窗口移动/取消）
   */
  async function onCrossDragMouseUp(e) {
    // 清理全局监听器（三个都要移除，否则 keydown 会累积）
    document.removeEventListener('mousemove', onCrossDragMouseMove, true);
    document.removeEventListener('mouseup', onCrossDragMouseUp, true);
    document.removeEventListener('keydown', onCrossDragKeyDown, true);
    crossDragListenersAttached = false;

    if (!state.crossDrag.active) {
      // 未激活跨窗口拖拽，重置状态
      crossDragTabId = null;
      return;
    }

    const tabId = state.crossDrag.tabId;

    // 拖拽已激活：抑制紧随其后的 click（避免松手误触发 switchTab），
    // 并清理窗口内排序相关的视觉状态
    suppressTabClick = true;
    hideInsertIndicator();

    // 移除拖拽中样式
    const tabEl = elements.tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) {
      tabEl.classList.remove('cross-dragging');
      tabEl.classList.remove('dragging');
    }
    state.isDragging = false;
    state.draggingTabId = null;

    // 移除浮动预览
    removeDragPreview();
    // 恢复 webview 鼠标命中（拖拽激活时为防止 guest 吞事件而禁用）
    resumeWebviewHitTest('drag-end');

    // 判断松手位置
    const dx = e.screenX - state.crossDrag.startScreenX;
    const dy = e.screenY - state.crossDrag.startScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < CROSS_DRAG_THRESHOLD) {
      // 移动距离不足，取消
      await window.realmAPI.cancelDrag();
      resetCrossDragState();
      crossDragTabId = null;
      return;
    }

    // 松手时强制上报最终位置：mousemove 的 50ms 节流会丢弃末尾移动，
    // 不补报的话快速拖出 Tab 栏松手会拿到过期的 outOfTabBar/targetWindowId（36-UAT 问题 6/7）
    try {
      const finalPos = await window.realmAPI.updateDragPosition({
        x: e.clientX,
        y: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
      });
      if (finalPos) {
        state.crossDrag.targetWindowId = finalPos.targetWindow
          ? finalPos.targetWindow.windowId
          : null;
        state.crossDrag.outOfTabBar = finalPos.outOfTabBar || false;
      }
    } catch (err) {
      console.error('[Realm Renderer] 最终位置上报失败:', err);
    }

    // 调用主进程结束拖拽，根据位置判断动作
    try {
      // 传递目标窗口信息（来自 updateDragPosition 的响应）
      const endData = {};
      if (state.crossDrag.targetWindowId) {
        // 鼠标在另一个窗口的 Tab 栏上 → 跨窗口移动
        endData.targetWindowId = state.crossDrag.targetWindowId;
      } else if (state.crossDrag.outOfTabBar) {
        // 鼠标在 Tab 栏外 → 创建新窗口
        endData.outOfTabBar = true;
      } else {
        // 鼠标仍在源窗口 Tab 栏内 → 窗口内排序，然后清理主进程拖拽状态
        if (lastInsertTarget && lastInsertTarget.targetTabId !== tabId) {
          await reorderTabLocal(tabId, lastInsertTarget);
        }
        await window.realmAPI.cancelDrag();
        resetCrossDragState();
        crossDragTabId = null;
        return;
      }

      const result = await window.realmAPI.endDrag(endData);

      if (result && result.success) {
        if (result.action === 'new-window') {
          // 主进程已发送 tab:removed 事件，由 handleTabRemovedFromMain 处理 UI 清理
          console.log(`[Realm Renderer] Tab ${tabId} 已拖出为新窗口`);
        } else if (result.action === 'move-to-window') {
          // 主进程已发送 tab:removed 事件，由 handleTabRemovedFromMain 处理 UI 清理
          console.log(`[Realm Renderer] Tab ${tabId} 已移动到窗口 ${result.targetWindowId}`);
        }
        // action === 'reorder' 时不做额外处理（窗口内排序由 HTML5 DnD 处理）
      }
    } catch (err) {
      console.error('[Realm Renderer] drag:end 失败:', err);
    }

    resetCrossDragState();
    crossDragTabId = null;
  }

  /**
   * 跨窗口拖拽：Escape 键处理器
   * 用户按 Escape 时取消拖拽，回滚 UI 状态
   */
  function onCrossDragKeyDown(e) {
    if (e.key === 'Escape' && state.crossDrag.active) {
      e.preventDefault();

      // 清理全局监听器
      document.removeEventListener('mousemove', onCrossDragMouseMove, true);
      document.removeEventListener('mouseup', onCrossDragMouseUp, true);
      document.removeEventListener('keydown', onCrossDragKeyDown, true);
      crossDragListenersAttached = false;

      // 抑制取消后松手触发的 click，并清理窗口内排序视觉状态
      suppressTabClick = true;
      hideInsertIndicator();

      // 移除拖拽中样式
      const tabEl = elements.tabList.querySelector(`[data-tab-id="${state.crossDrag.tabId}"]`);
      if (tabEl) {
        tabEl.classList.remove('cross-dragging');
        tabEl.classList.remove('dragging');
      }
      state.isDragging = false;
      state.draggingTabId = null;

      // 移除浮动预览
      removeDragPreview();
      // 恢复 webview 鼠标命中
      resumeWebviewHitTest('drag-end');

      // 通知主进程取消拖拽
      window.realmAPI.cancelDrag();

      // 重置状态
      resetCrossDragState();
      crossDragTabId = null;
    }
  }

  /**
   * 重置跨窗口拖拽状态
   */
  function resetCrossDragState() {
    state.crossDrag.active = false;
    state.crossDrag.tabId = null;
    state.crossDrag.startScreenX = 0;
    state.crossDrag.startScreenY = 0;
    state.crossDrag.lastReportTime = 0;
    dragRequestSeq = 0;
    state.crossDrag.targetWindowId = null;
    state.crossDrag.outOfTabBar = false;
    lastInsertTarget = null;
  }

  /**
   * 从 UI 中移除 Tab（跨窗口移动成功后调用）
   * @param {string} tabId - Tab ID
   */
  function removeTabFromUI(tabId) {
    const tabData = state.tabs.get(tabId);
    if (!tabData) return;

    // 移除 Tab DOM
    if (tabData.element) tabData.element.remove();

    // 移除 webview
    // G-44-2 判定：跨窗口移动成功后的源窗口侧清理（tab 已在目标窗口重建），
    // 非用户关闭销毁，无键盘 ACK 在途窗口，保持同步移除
    const webview = state.webviews.get(tabId);
    if (webview) webview.remove();
    state.webviews.delete(tabId);

    // 从 state 中移除
    state.tabs.delete(tabId);

    // 如果移除的是活动 Tab，切换到相邻 Tab
    if (state.activeTabId === tabId) {
      const remaining = Array.from(state.tabs.keys());
      if (remaining.length > 0) {
        switchTab(remaining[0]);
      } else {
        // 没有 Tab 了，创建新 Tab（窗口不应在这里销毁，由主进程处理）
        createTab(state.currentContainer);
      }
    }
  }

  // 在 tabBar 上绑定 mousedown（捕获阶段，确保优先于 Tab 元素的事件）
  if (elements.tabBar) {
    elements.tabBar.addEventListener('mousedown', onCrossDragMouseDown);
  }

  // 监听主进程拖拽状态变化（目标窗口高亮等）
  if (window.realmAPI && window.realmAPI.onDragStateChanged) {
    window.realmAPI.onDragStateChanged((data) => {
      if (data.type === 'started' && data.sourceWindowId !== state.windowId) {
        // 另一个窗口开始拖拽到本窗口，高亮 Tab 栏作为可放置目标
        elements.tabBar?.classList.add('cross-drag-target-ready');
      } else if (data.type === 'ended' || data.type === 'cancelled') {
        elements.tabBar?.classList.remove('cross-drag-target-ready');
      }
    });
  }
}

/**
 * 显示 Tab 拖拽插入位置指示器
 * 指示器定位到 tabBar 容器内的指定 X 坐标处
 *
 * @param {number} x - 指示器中心的页面 X 坐标
 */
function showInsertIndicator(x) {
  if (!tabDragIndicator || !elements.tabBar) return;
  // 将页面坐标转为 tabBar 容器内的相对坐标
  const barRect = elements.tabBar.getBoundingClientRect();
  const left = x - barRect.left - 1; // -1 使 2px 宽的指示器居中
  tabDragIndicator.style.left = `${left}px`;
  tabDragIndicator.style.display = '';
}

/**
 * 隐藏 Tab 拖拽插入位置指示器
 */
function hideInsertIndicator() {
  if (tabDragIndicator) {
    tabDragIndicator.style.display = 'none';
  }
}

/**
 * 初始化标签栏重排监听器
 * 在 init() 中调用，注册 tab:reordered 事件监听
 *
 * 主进程完成重排计算后推送新顺序，此监听器按新顺序重排标签栏 DOM，
 * 并在分组之间插入视觉分隔线。
 */
function initTabReorderListener() {
  if (!window.realmAPI || !window.realmAPI.onTabReordered) return;

  window.realmAPI.onTabReordered((data) => {
    console.log('[Realm Renderer] 标签栏重排:', data);
    handleTabReordered(data);
  });
}

/**
 * 处理标签栏重排
 *
 * 按照主进程推送的新顺序，在 #tabList 内重排 .tab DOM 元素，
 * 并在分组之间插入视觉分隔线。
 * 注意：必须在 #tabList 内操作，tab 的点击/右键事件委托绑定在 tabList 上，
 * 若移到 #tabBar 下会脱离委托导致点击失效。
 *
 * @param {Object} data - 重排数据
 * @param {Array<{name: string, tabIds: string[]}>} data.groups - 分组数组
 * @param {string[]} data.flatOrder - 标签页 ID 的完整顺序
 */
function handleTabReordered(data) {
  const { groups, flatOrder } = data;
  const tabList = elements.tabList;
  if (!tabList) return;

  // 移除已有的分组分隔线
  tabList.querySelectorAll('.tab-group-divider-line').forEach(el => el.remove());

  // 按新顺序重排标签页 DOM
  const tabElements = new Map();
  tabList.querySelectorAll('.tab').forEach(el => {
    tabElements.set(el.dataset.tabId, el);
  });

  // 按 flatOrder 顺序追加标签页元素
  flatOrder.forEach(tabId => {
    const el = tabElements.get(tabId);
    if (el) {
      tabList.appendChild(el);
    }
  });

  // 在分组之间插入分隔线
  if (groups && groups.length > 1) {
    let offset = 0;
    for (let i = 0; i < groups.length - 1; i++) {
      offset += groups[i].tabIds.length;
      // 在第 offset 个标签页前插入分隔线
      const dividerLine = document.createElement('div');
      dividerLine.className = 'tab-group-divider-line';
      const targetTab = tabElements.get(flatOrder[offset]);
      if (targetTab) {
        tabList.insertBefore(dividerLine, targetTab);
      } else {
        tabList.appendChild(dividerLine);
      }
    }
  }

  // 同步 state.tabs 的条目顺序，使其与 DOM 一致
  // 否则下次 renderTabs() 从 state.tabs 重建 DOM 时会丢弃本次重排结果
  const reorderedTabs = new Map();
  flatOrder.forEach(tabId => {
    const tab = state.tabs.get(tabId);
    if (tab) reorderedTabs.set(tabId, tab);
  });
  // 追加 flatOrder 中未包含的 tab（兜底，防止丢失）
  state.tabs.forEach((tab, id) => {
    if (!reorderedTabs.has(id)) reorderedTabs.set(id, tab);
  });
  state.tabs = reorderedTabs;

  console.log(`[Realm Renderer] 标签栏已重排: ${flatOrder.length} 个标签, ${(groups || []).length} 个分组`);
}

/**
 * 初始化面板拖拽调整宽度
 * 支持鼠标拖拽左边缘手柄来调整面板宽度
 *
 * 注意两个 Electron/webview 环境的坑：
 * 1. 拖拽时鼠标经过 webview 区域会被 guest 页吞掉事件，导致 mousemove 断流
 *    （拖几像素就卡住）——拖拽期间需禁用所有 webview 的 pointer-events
 * 2. 面板的 width 过渡动画会让拖拽滞后——拖拽期间加 .resizing 类关闭过渡
 */
function initAIPanelResize() {
  const handle = elements.aiPanelResizeHandle;
  if (!handle) return;

  let startX = 0;
  let startWidth = 0;

  function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    startWidth = elements.aiPanel.offsetWidth;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    // 关闭过渡动画，拖拽实时跟手
    elements.aiPanel.classList.add('resizing');
    // 防止 webview 吞掉鼠标事件（统一 suspend 入口，收尾有兜底，丢 mouseup 不再卡死）
    suspendWebviewHitTest('ai-panel-resize');
  }

  function onMouseMove(e) {
    const delta = startX - e.clientX;
    const newWidth = Math.min(
      Math.max(startWidth + delta, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ai-panel-min-width')) || 280),
      parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ai-panel-max-width')) || 600
    );
    elements.aiPanel.style.width = newWidth + 'px';
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // 先恢复 webview 鼠标命中再动其它 DOM 状态：本函数后续任何一步抛错都不能
    // 把「网页区点不动」留在用户界面上（前面那步是唯一会关掉命中的地方）
    resumeWebviewHitTest('drag-end');

    // 恢复过渡动画
    elements.aiPanel.classList.remove('resizing');

    // 持久化面板宽度到 electron-store（D-17）
    const currentWidth = elements.aiPanel.offsetWidth;
    try {
      window.realmAPI.setSetting('aiPanelWidth', currentWidth);
    } catch (err) {
      console.error('[Realm Renderer] 保存 AI 面板宽度失败:', err);
    }
  }

  handle.addEventListener('mousedown', onMouseDown);
}

// ==================== 下载管理面板 ====================

/**
 * 最近一次 embedder 内 mousedown 的记录 { time, inPanel }
 * 用于裁决 webview 穿透事件：点面板按钮时 webview 也会收到 mousedown 并发
 * media:outside-click（跨进程 IPC，异步晚到），无法直接与 click 比时序。
 * 但真正点网页时 embedder 收不到 mousedown，点面板时 embedder 的 mousedown
 * 一定先落在面板/弹窗内，IPC 到达时回看这条记录即可区分
 * @type {{ time: number, inPanel: boolean }}
 */
let lastEmbedderMousedown = { time: 0, inPanel: false };

/**
 * 处理 webview 内 mousedown 触发的面板外点击（media:outside-click）
 * 若最近一次 embedder mousedown 落在面板/弹窗内且时间接近（穿透事件），忽略；
 * 否则判定为真正点击网页，关闭面板
 */
function handleDownloadOutsideClick() {
  const recent = Date.now() - lastEmbedderMousedown.time < 300;
  if (recent && lastEmbedderMousedown.inPanel) return;
  closeDownloadPanel();
}

/**
 * 切换下载面板显示/隐藏
 * 打开时加载最近 10 条下载记录
 */
function toggleDownloadPanel() {
  if (state.downloadPanelOpen) {
    closeDownloadPanel();
  } else {
    openDownloadPanel();
  }
}

/**
 * 打开下载面板
 * 隐藏 tooltip，加载面板数据，切换样式
 */
function openDownloadPanel() {
  state.downloadPanelOpen = true;
  const panel = document.getElementById('downloadPanel');
  const btn = document.getElementById('downloadBtn');
  if (panel) panel.classList.remove('hidden');
  if (btn) btn.classList.add('active');
  // 锚定到下载按钮下方（AI 面板打开时按钮位置会左移）
  positionPanelBelowButton(panel, btn);
  hideDownloadTooltip();
  // 始终在打开时刷新列表（dirty 标记或首次打开）
  loadDownloadPanelList();
}

/**
 * 关闭下载面板
 */
function closeDownloadPanel() {
  state.downloadPanelOpen = false;
  const panel = document.getElementById('downloadPanel');
  const btn = document.getElementById('downloadBtn');
  if (panel) panel.classList.add('hidden');
  if (btn) btn.classList.remove('active');
  clearDownloadSelection();
}

/**
 * 加载面板下载列表（最近 10 条）
 * 通过 downloadAPI.listAllDownloads 获取数据
 */
async function loadDownloadPanelList() {
  try {
    const downloads = await window.downloadAPI.listAllDownloads(10, 0);
    renderDownloadPanelList(downloads || []);
    downloadPanelDirty = false;
  } catch (error) {
    console.error('[Realm Renderer] 加载下载面板列表失败:', error);
    renderDownloadPanelList([]);
  }
}

/**
 * 渲染下载面板列表
 * @param {Array} downloads - 下载记录数组
 */
function renderDownloadPanelList(downloads) {
  const listEl = document.getElementById('downloadPanelList');
  const emptyEl = document.getElementById('downloadEmptyState');
  if (!listEl || !emptyEl) return;

  if (downloads.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  // 更新全部暂停按钮状态
  updatePauseAllButton(downloads);

  listEl.innerHTML = downloads.map(item => {
    const stateClass = item.state || 'completed';
    const isActive = stateClass === 'progressing';
    const isPaused = stateClass === 'paused';
    const isInterrupted = stateClass === 'interrupted';
    const isCompleted = stateClass === 'completed';

    // 进度条样式
    let progressClass = 'hidden';
    let barClass = 'accent';
    if (isActive) {
      progressClass = '';
      barClass = 'accent';
    } else if (isPaused) {
      progressClass = '';
      barClass = 'muted';
    } else if (isInterrupted) {
      progressClass = '';
      barClass = 'danger';
    }

    // 状态文本
    let statusText = '';
    if (isActive) {
      const speed = item.speed ? formatFileSize(item.speed) + '/s' : '计算中...';
      statusText = `下载中 · ${speed}`;
    } else if (isPaused) {
      statusText = '已暂停';
    } else if (isInterrupted) {
      statusText = '下载失败';
    }

    // 时间
    const timeStr = item.startTime ? formatRelativeTime(item.startTime) : '';

    // 操作按钮
    let actionsHtml = '';
    if (isActive) {
      actionsHtml = `
        <button class="btn-icon download-item-pause-btn" data-id="${escapeHtml(item.id)}" title="暂停">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        </button>
        <button class="btn-icon download-item-delete-btn" data-id="${escapeHtml(item.id)}" data-filename="${escapeHtml(item.filename)}" data-state="${stateClass}" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>`;
    } else if (isPaused || isInterrupted) {
      actionsHtml = `
        <button class="btn-icon download-item-resume-btn" data-id="${escapeHtml(item.id)}" title="恢复">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <button class="btn-icon download-item-delete-btn" data-id="${escapeHtml(item.id)}" data-filename="${escapeHtml(item.filename)}" data-state="${stateClass}" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>`;
    } else {
      actionsHtml = `
        <button class="btn-icon download-item-open-btn" data-path="${escapeHtml(item.savePath || '')}" title="打开文件">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </button>
        <button class="btn-icon download-item-folder-btn" data-path="${escapeHtml(item.savePath || '')}" title="在 Finder 中显示">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </button>
        <button class="btn-icon download-item-delete-btn" data-id="${escapeHtml(item.id)}" data-filename="${escapeHtml(item.filename)}" data-state="${stateClass}" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>`;
    }

    const selectedClass = downloadSelectedIds.has(item.id) ? ' selected' : '';

    return `
      <div class="download-item${selectedClass}" data-id="${escapeHtml(item.id)}" data-state="${stateClass}">
        <div class="download-item-icon">
          ${getFileTypeIcon(item.mimeType)}
        </div>
        <div class="download-item-info">
          <div class="download-item-name" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</div>
          <div class="download-item-meta">
            <span class="download-item-size">${item.totalBytes ? formatFileSize(item.totalBytes) : ''}</span>
            ${item.totalBytes && timeStr ? '<span class="download-item-separator">·</span>' : ''}
            <span class="download-item-time">${timeStr}</span>
            ${statusText ? `<span class="download-item-status">${statusText}</span>` : ''}
          </div>
          <div class="download-item-progress ${progressClass}">
            <div class="download-item-progress-bar ${barClass}" style="width: ${item.progress || 0}%"></div>
          </div>
        </div>
        <div class="download-item-actions">
          ${actionsHtml}
        </div>
      </div>`;
  }).join('');

  // 绑定操作按钮事件
  bindDownloadItemActions(listEl);
}

/**
 * 绑定下载列表项操作按钮事件
 * @param {HTMLElement} listEl - 列表容器
 */
function bindDownloadItemActions(listEl) {
  // 暂停按钮
  listEl.querySelectorAll('.download-item-pause-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePauseDownload(btn.dataset.id);
    });
  });

  // 恢复按钮
  listEl.querySelectorAll('.download-item-resume-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleResumeDownload(btn.dataset.id);
    });
  });

  // 打开文件按钮
  listEl.querySelectorAll('.download-item-open-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleOpenFile(btn.dataset.path);
    });
  });

  // Finder 按钮
  listEl.querySelectorAll('.download-item-folder-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleShowInFolder(btn.dataset.path);
    });
  });

  // 删除按钮
  listEl.querySelectorAll('.download-item-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteDownload(btn.dataset.id, btn.dataset.filename, btn.dataset.state === 'progressing');
    });
  });

  // Cmd+Click 多选
  listEl.querySelectorAll('.download-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleDownloadSelection(item.dataset.id);
      }
    });
  });
}

/**
 * 根据 MIME 类型返回 Lucide SVG 图标
 * @param {string} mimeType - MIME 类型
 * @returns {string} SVG 图标 HTML
 */
function getFileTypeIcon(mimeType) {
  if (!mimeType) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
  }

  if (mimeType === 'application/pdf') {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
  }

  if (mimeType.startsWith('image/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
  }

  if (mimeType.startsWith('video/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
  }

  if (mimeType.startsWith('audio/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
  }

  if (mimeType === 'application/zip' || mimeType.includes('compress')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  }

  if (mimeType.startsWith('text/')) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
  }

  // 默认文件图标
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
}

/**
 * 格式化相对时间
 * @param {number} timestamp - Unix 时间戳（秒）
 * @returns {string} 相对时间文本
 */
function formatRelativeTime(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';

  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 暂停下载
 * @param {string} downloadId - 下载 ID
 */
async function handlePauseDownload(downloadId) {
  try {
    await window.downloadAPI.pauseDownload(downloadId);
    // 面板打开时立即刷新
    if (state.downloadPanelOpen) {
      loadDownloadPanelList();
    }
  } catch (error) {
    console.error('[Realm Renderer] 暂停下载失败:', error);
  }
}

/**
 * 恢复下载
 * @param {string} downloadId - 下载 ID
 */
async function handleResumeDownload(downloadId) {
  try {
    await window.downloadAPI.resumeDownload(downloadId);
    if (state.downloadPanelOpen) {
      loadDownloadPanelList();
    }
  } catch (error) {
    console.error('[Realm Renderer] 恢复下载失败:', error);
  }
}

/**
 * 打开已下载文件
 * @param {string} filePath - 文件路径
 */
async function handleOpenFile(filePath) {
  if (!filePath) return;
  try {
    await window.downloadAPI.openFile(filePath);
  } catch (error) {
    console.error('[Realm Renderer] 打开文件失败:', error);
  }
}

/**
 * 在 Finder 中显示文件
 * @param {string} filePath - 文件路径
 */
async function handleShowInFolder(filePath) {
  if (!filePath) return;
  try {
    await window.downloadAPI.showInFolder(filePath);
  } catch (error) {
    console.error('[Realm Renderer] 显示文件失败:', error);
  }
}

/**
 * 处理删除下载（显示确认弹窗）
 * @param {string} downloadId - 下载 ID
 * @param {string} filename - 文件名
 * @param {boolean} isInProgress - 是否进行中
 */
async function handleDeleteDownload(downloadId, filename, isInProgress) {
  // 如果下载正在进行，先取消
  if (isInProgress) {
    try {
      await window.downloadAPI.cancelDownload(downloadId);
    } catch (error) {
      console.warn('[Realm Renderer] 取消下载失败:', error);
    }
  }

  pendingDeleteDownload = { downloadId, filename, isInProgress };

  // 更新弹窗描述
  const desc = document.getElementById('downloadDeleteDesc');
  if (desc) {
    desc.textContent = `确定要删除「${filename}」的下载记录吗？`;
  }

  // 重置复选框
  const checkbox = document.getElementById('downloadDeleteFileCheckbox');
  if (checkbox) {
    checkbox.checked = false;
  }

  // 显示弹窗
  const modal = document.getElementById('downloadDeleteModal');
  if (modal) {
    modal.showModal();
  }
}

/**
 * 执行删除下载（弹窗确认后调用）
 */
async function executeDeleteDownload() {
  if (!pendingDeleteDownload) return;

  const checkbox = document.getElementById('downloadDeleteFileCheckbox');
  const deleteFile = checkbox ? checkbox.checked : false;

  try {
    if (pendingDeleteDownload.batchMode) {
      // 批量删除模式
      for (const id of downloadSelectedIds) {
        await window.downloadAPI.deleteDownloadRecord(id, deleteFile);
      }
      clearDownloadSelection();
    } else {
      // 单条删除模式
      await window.downloadAPI.deleteDownloadRecord(pendingDeleteDownload.downloadId, deleteFile);
    }
    // 刷新面板列表
    if (state.downloadPanelOpen) {
      loadDownloadPanelList();
    }
  } catch (error) {
    console.error('[Realm Renderer] 删除下载记录失败:', error);
  }

  pendingDeleteDownload = null;
}

/**
 * 处理清空所有下载（显示确认弹窗）
 */
function handleClearAllDownloads() {
  const modal = document.getElementById('downloadClearModal');
  if (modal) {
    modal.showModal();
  }
}

/**
 * 执行清空所有下载（弹窗确认后调用）
 */
async function executeClearAllDownloads() {
  try {
    await window.downloadAPI.clearAllDownloads();
    // 刷新面板列表
    if (state.downloadPanelOpen) {
      loadDownloadPanelList();
    }
  } catch (error) {
    console.error('[Realm Renderer] 清空下载历史失败:', error);
  }
}

/**
 * 全部暂停（遍历所有进行中的下载）
 */
async function handlePauseAll() {
  try {
    const downloads = await window.downloadAPI.listAllDownloads(10, 0);
    const activeItems = (downloads || []).filter(d => d.state === 'progressing');
    for (const item of activeItems) {
      await window.downloadAPI.pauseDownload(item.id);
    }
    if (state.downloadPanelOpen) {
      loadDownloadPanelList();
    }
  } catch (error) {
    console.error('[Realm Renderer] 全部暂停失败:', error);
  }
}

/**
 * 全部恢复（遍历所有暂停的下载）
 */
async function handleResumeAll() {
  try {
    const downloads = await window.downloadAPI.listAllDownloads(10, 0);
    const pausedItems = (downloads || []).filter(d => d.state === 'paused');
    for (const item of pausedItems) {
      await window.downloadAPI.resumeDownload(item.id);
    }
    if (state.downloadPanelOpen) {
      loadDownloadPanelList();
    }
  } catch (error) {
    console.error('[Realm Renderer] 全部恢复失败:', error);
  }
}

/**
 * 更新全部暂停/恢复按钮状态
 * @param {Array} downloads - 当前下载列表
 */
function updatePauseAllButton(downloads) {
  const btn = document.getElementById('downloadPauseAllBtn');
  if (!btn) return;

  const activeCount = downloads.filter(d => d.state === 'progressing').length;
  const pausedCount = downloads.filter(d => d.state === 'paused').length;

  if (activeCount > 0) {
    btn.title = '全部暂停';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    btn.onclick = (e) => { e.stopPropagation(); handlePauseAll(); };
    btn.style.display = '';
  } else if (pausedCount > 0) {
    btn.title = '全部恢复';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    btn.onclick = (e) => { e.stopPropagation(); handleResumeAll(); };
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}

/**
 * 切换下载项选中状态（Cmd+Click 多选）
 * @param {string} downloadId - 下载 ID
 */
function toggleDownloadSelection(downloadId) {
  if (downloadSelectedIds.has(downloadId)) {
    downloadSelectedIds.delete(downloadId);
  } else {
    downloadSelectedIds.add(downloadId);
  }

  // 更新选中样式
  const item = document.querySelector(`.download-item[data-id="${downloadId}"]`);
  if (item) {
    item.classList.toggle('selected', downloadSelectedIds.has(downloadId));
  }

  // 更新批量操作栏
  updateBatchBar();
}

/**
 * 清除所有选中状态
 */
function clearDownloadSelection() {
  downloadSelectedIds.clear();
  document.querySelectorAll('.download-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
  updateBatchBar();
}

/**
 * 更新批量操作栏显示状态
 */
function updateBatchBar() {
  const bar = document.getElementById('downloadBatchBar');
  const count = document.getElementById('downloadBatchCount');
  if (!bar || !count) return;

  // 选中 1 项即显示批量操作栏：给首次 Cmd+Click 明确的界面反馈
  if (downloadSelectedIds.size >= 1) {
    bar.classList.remove('hidden');
    count.textContent = `已选择 ${downloadSelectedIds.size} 项`;
    syncBatchBarPosition();
  } else {
    bar.classList.add('hidden');
  }
}

/**
 * 批量删除选中的下载
 */
async function handleBatchDelete() {
  if (downloadSelectedIds.size === 0) return;

  const desc = document.getElementById('downloadDeleteDesc');
  if (desc) {
    desc.textContent = `确定要删除选中的 ${downloadSelectedIds.size} 条记录吗？`;
  }

  const checkbox = document.getElementById('downloadDeleteFileCheckbox');
  if (checkbox) {
    checkbox.checked = false;
  }

  // 标记为批量删除模式
  pendingDeleteDownload = { batchMode: true };

  const modal = document.getElementById('downloadDeleteModal');
  if (modal) {
    modal.showModal();
  }
}

/**
 * 面板打开时实时更新进度条（由 handleDownloadProgress 调用）
 * @param {Object} data - 进度数据
 */
function updateDownloadPanelProgress(data) {
  if (!state.downloadPanelOpen) return;

  const item = document.querySelector(`.download-item[data-id="${data.downloadId}"]`);
  if (!item) return;

  const progressBar = item.querySelector('.download-item-progress-bar');
  if (progressBar) {
    progressBar.style.width = `${data.percent || 0}%`;
  }

  const statusEl = item.querySelector('.download-item-status');
  if (statusEl) {
    const speed = data.speed ? formatFileSize(data.speed) + '/s' : '计算中...';
    statusEl.textContent = `下载中 · ${speed}`;
  }
}

// ==================== 凭据管理：保存横幅 + 自动填充协调 ====================

/**
 * 处理表单提交的凭据数据
 * 检查永不保存记录和重复凭据后显示保存横幅
 *
 * @param {Object} data - 凭据数据 { url, origin, username, password, formType }
 */
async function handleCredentialFormSubmitted(data) {
  if (!data || !data.username || !data.password) return;

  const containerId = state.currentContainer;
  const origin = data.origin;

  try {
    // 检查是否标记为永不保存
    const neverSave = await window.realmAPI.credentialAPI.isNeverSave(containerId, origin);
    if (neverSave) return;

    // 检查是否已有相同凭据（避免重复提示）
    const existing = await window.realmAPI.credentialAPI.getCredential(containerId, origin);
    if (existing && existing.username === data.username) return;

    // 显示保存横幅
    showSaveCredentialBanner(data);
  } catch (err) {
    console.error('[Realm Renderer] 处理凭据提交失败:', err);
  }
}

/**
 * 处理地址表单检测事件
 * 显示保存地址提示横幅（Chrome 风格）
 *
 * @param {Object} data - 地址数据 { name, phone, address, ... }
 */
async function handleAddressFormDetected(data) {
  if (!data) return;

  const containerId = state.currentContainer;

  try {
    // 检查该容器是否已有保存的地址
    const existing = await window.realmAPI.addressAPI.getAddress(containerId);
    if (existing) return; // 已有地址，不重复提示

    // 显示保存横幅
    showSaveAddressBanner(data);
  } catch (err) {
    console.error('[Realm Renderer] 处理地址表单检测失败:', err);
  }
}

/**
 * 处理地址自动填充请求
 * 查询当前容器的地址，找到后发送到 webview 进行填充
 *
 * @param {HTMLElement} webview - 发起请求的 webview 元素
 */
async function handleAddressAutofillRequest(webview) {
  const containerId = state.currentContainer;

  try {
    const address = await window.realmAPI.addressAPI.getAddress(containerId);
    if (address) {
      // 发送填充指令到 webview
      webview.send('address:do-autofill', address);
    }
  } catch (err) {
    console.error('[Realm Renderer] 地址自动填充查询失败:', err);
  }
}

/**
 * 处理自动填充请求
 * 查询当前容器和 origin 的凭据，找到后发送到 webview 进行填充
 *
 * @param {HTMLElement} webview - 发起请求的 webview 元素
 */
async function handleAutofillRequest(webview) {
  const containerId = state.currentContainer;

  // 从 webview 获取当前 URL 的 origin
  let url;
  try {
    url = webview.getURL();
  } catch (err) {
    return;
  }
  if (!url || url === 'about:blank') return;

  let origin;
  try {
    origin = new URL(url).origin;
  } catch (err) {
    return;
  }

  try {
    // 检查是否标记为永不保存
    const neverSave = await window.realmAPI.credentialAPI.isNeverSave(containerId, origin);
    if (neverSave) return;

    // 查询凭据
    const credential = await window.realmAPI.credentialAPI.getCredential(containerId, origin);
    if (credential && credential.username && credential.password) {
      // 发送填充指令到 webview
      webview.send('credential:do-autofill', {
        username: credential.username,
        password: credential.password,
      });
    }
  } catch (err) {
    console.error('[Realm Renderer] 自动填充查询失败:', err);
  }
}

/**
 * 显示保存凭据提示横幅（Chrome 风格）
 * 从 origin 提取 hostname，去除 www. 前缀（per D-06）
 * 10 秒后自动消失（per D-08）
 *
 * @param {Object} data - 凭据数据 { url, origin, username, password, formType }
 */
function showSaveCredentialBanner(data) {
  const banner = elements.credentialSaveBanner;
  if (!banner) return;

  // 清除之前的定时器和 ESC handler
  if (state.credentialBannerTimer) {
    clearTimeout(state.credentialBannerTimer);
    state.credentialBannerTimer = null;
  }
  if (state.credentialEscHandler) {
    document.removeEventListener('keydown', state.credentialEscHandler);
    state.credentialEscHandler = null;
  }

  // 暂存凭据数据（保存按钮需要）
  state.pendingCredentialData = data;

  // 设置域名文本（去除 www. 前缀）
  let hostname = '';
  try {
    hostname = new URL(data.origin).hostname;
    hostname = hostname.replace(/^www\./, '');
  } catch (err) {
    hostname = data.origin;
  }
  if (elements.credentialSaveDomain) {
    elements.credentialSaveDomain.textContent = hostname;
  }

  // 显示横幅
  banner.classList.remove('hidden');
  // 强制重排以触发动画
  banner.offsetHeight;
  banner.classList.add('visible');

  // 10 秒自动消失（D-08）
  state.credentialBannerTimer = setTimeout(() => {
    hideCredentialBanner();
  }, 10000);

  // 绑定按钮事件（每次显示时重新绑定，避免闭包捕获旧数据）
  const saveBtn = elements.credentialSaveBtn;
  const neverBtn = elements.credentialNeverBtn;
  const laterBtn = elements.credentialLaterBtn;

  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (state.credentialBannerTimer) {
        clearTimeout(state.credentialBannerTimer);
        state.credentialBannerTimer = null;
      }
      const credData = state.pendingCredentialData;
      if (credData) {
        try {
          await window.realmAPI.credentialAPI.saveCredential({
            containerId: state.currentContainer,
            url: credData.url,
            origin: credData.origin,
            username: credData.username,
            password: credData.password,
          });
        } catch (err) {
          console.error('[Realm Renderer] 保存凭据失败:', err);
        }
      }
      state.pendingCredentialData = null;
      hideCredentialBanner();
    };
  }

  if (neverBtn) {
    neverBtn.onclick = async () => {
      if (state.credentialBannerTimer) {
        clearTimeout(state.credentialBannerTimer);
        state.credentialBannerTimer = null;
      }
      const credData = state.pendingCredentialData;
      if (credData) {
        try {
          await window.realmAPI.credentialAPI.markNeverSave(state.currentContainer, credData.origin);
        } catch (err) {
          console.error('[Realm Renderer] 标记永不保存失败:', err);
        }
      }
      state.pendingCredentialData = null;
      hideCredentialBanner();
    };
  }

  if (laterBtn) {
    laterBtn.onclick = () => {
      if (state.credentialBannerTimer) {
        clearTimeout(state.credentialBannerTimer);
        state.credentialBannerTimer = null;
      }
      state.pendingCredentialData = null;
      hideCredentialBanner();
    };
  }

  // ESC 键隐藏（等同于暂不）
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideCredentialBanner();
      document.removeEventListener('keydown', escHandler);
      state.credentialEscHandler = null;
    }
  };
  state.credentialEscHandler = escHandler;
  document.addEventListener('keydown', escHandler);
}

/**
 * 显示保存地址提示横幅（Chrome 风格）
 * 10 秒后自动消失
 *
 * @param {Object} data - 地址数据
 */
function showSaveAddressBanner(data) {
  const banner = elements.addressSaveBanner;
  if (!banner) return;

  // 清除之前的定时器和 ESC handler
  if (state.addressBannerTimer) {
    clearTimeout(state.addressBannerTimer);
    state.addressBannerTimer = null;
  }
  if (state.addressEscHandler) {
    document.removeEventListener('keydown', state.addressEscHandler);
    state.addressEscHandler = null;
  }

  // 暂存地址数据（保存按钮需要）
  state.pendingAddressData = data;

  // 显示横幅
  banner.classList.remove('hidden');
  banner.offsetHeight; // 强制重排以触发动画
  banner.classList.add('visible');

  // 10 秒自动消失
  state.addressBannerTimer = setTimeout(() => {
    hideAddressBanner();
  }, 10000);

  // 绑定按钮事件
  setupAddressBannerButtons();

  // ESC 键隐藏
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideAddressBanner();
      document.removeEventListener('keydown', escHandler);
      state.addressEscHandler = null;
    }
  };
  state.addressEscHandler = escHandler;
  document.addEventListener('keydown', escHandler);
}

/**
 * 绑定地址保存横幅按钮事件
 * 每次显示时重新绑定，避免闭包捕获旧数据
 */
function setupAddressBannerButtons() {
  const saveBtn = elements.addressSaveConfirmBtn;
  const neverBtn = elements.addressNeverBtn;
  const laterBtn = elements.addressLaterBtn;

  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (state.addressBannerTimer) {
        clearTimeout(state.addressBannerTimer);
        state.addressBannerTimer = null;
      }
      const addrData = state.pendingAddressData;
      if (addrData) {
        try {
          await window.realmAPI.addressAPI.saveAddress({
            containerId: state.currentContainer,
            ...addrData,
          });
        } catch (err) {
          console.error('[Realm Renderer] 保存地址失败:', err);
        }
      }
      state.pendingAddressData = null;
      hideAddressBanner();
    };
  }

  if (neverBtn) {
    neverBtn.onclick = () => {
      if (state.addressBannerTimer) {
        clearTimeout(state.addressBannerTimer);
        state.addressBannerTimer = null;
      }
      // 地址没有"永不保存"功能，直接关闭
      state.pendingAddressData = null;
      hideAddressBanner();
    };
  }

  if (laterBtn) {
    laterBtn.onclick = () => {
      if (state.addressBannerTimer) {
        clearTimeout(state.addressBannerTimer);
        state.addressBannerTimer = null;
      }
      state.pendingAddressData = null;
      hideAddressBanner();
    };
  }
}

/**
 * 隐藏凭据保存横幅
 * 移除 visible class 触发退出动画，动画结束后添加 hidden class
 */
function hideCredentialBanner() {
  const banner = elements.credentialSaveBanner;
  if (!banner) return;

  // 清除 ESC handler
  if (state.credentialEscHandler) {
    document.removeEventListener('keydown', state.credentialEscHandler);
    state.credentialEscHandler = null;
  }

  // 显式清除敏感数据（密码先置空再清引用）
  if (state.pendingCredentialData) {
    state.pendingCredentialData.password = '';
    state.pendingCredentialData = null;
  }

  banner.classList.remove('visible');
  // 等待动画结束后隐藏
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 300);
}

/**
 * 隐藏地址保存横幅
 * 移除 visible class 触发退出动画，动画结束后添加 hidden class
 */
function hideAddressBanner() {
  const banner = elements.addressSaveBanner;
  if (!banner) return;

  // 清除 ESC handler
  if (state.addressEscHandler) {
    document.removeEventListener('keydown', state.addressEscHandler);
    state.addressEscHandler = null;
  }

  // 清除暂存的地址数据
  if (state.pendingAddressData) {
    state.pendingAddressData = null;
  }

  banner.classList.remove('visible');
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 300);
}

// ==================== 工具栏溢出收起 ====================

let overflowToolbarButtons = [];
let toolbarOverflowMenu = null;
let toolbarOverflowBackdrop = null;

const TOOLBAR_URL_MIN_WIDTH = 120; // 地址栏最小保留宽度

/**
 * 计算工具栏右侧按钮溢出（实测布局驱动，非宽度估算）
 *
 * 不根据任何「可用宽度估算」决定显隐——估算与真实 flex 布局的误差会在
 * 临界宽度处放大成跳变。改为直接观测布局结果，逐步逼近：
 * - 收起：右侧按钮组被 flex 裁切（scrollWidth > clientWidth）或地址栏
 *   宽度不足 TOOLBAR_URL_MIN_WIDTH 时，从末尾逐个隐藏，每步重测；
 * - 展开：地址栏宽度在让出一个按钮位后仍满足最小宽度时，从头逐个恢复；
 * - 展开阈值比收起阈值高一个按钮位（36px 死区），避免边界抖动。
 */
function calculateToolbarOverflow() {
  const toolbarRight = document.querySelector('.toolbar-right');
  const overflowBtn = document.getElementById('toolbarOverflowBtn');
  const urlWrapper = document.querySelector('.url-input-wrapper');
  if (!toolbarRight || !overflowBtn) return;

  // 功能开关隐藏的按钮（如媒体面板 per D-12）不参与溢出计算，保持隐藏
  const buttons = Array.from(toolbarRight.children).filter(
    (child) =>
      child.classList.contains('btn-icon') &&
      child.id !== 'toolbarOverflowBtn' &&
      child.dataset.featureHidden !== '1'
  );
  if (buttons.length === 0) {
    overflowToolbarButtons = [];
    overflowBtn.classList.remove('visible');
    return;
  }

  const urlWidth = () =>
    urlWrapper ? urlWrapper.getBoundingClientRect().width : Infinity;
  const rightClipped = () =>
    toolbarRight.scrollWidth > toolbarRight.clientWidth + 1;
  const syncOverflowState = () => {
    overflowToolbarButtons = buttons.filter((b) => b.style.display === 'none');
    overflowBtn.classList.toggle('visible', overflowToolbarButtons.length > 0);
  };

  // 收起：逐个隐藏末尾可见按钮，每步强制重排后重测
  let guard = 0;
  while (guard++ <= buttons.length) {
    const visible = buttons.filter((b) => b.style.display !== 'none');
    if (visible.length === 0) break;
    if (!rightClipped() && urlWidth() >= TOOLBAR_URL_MIN_WIDTH) break;
    visible[visible.length - 1].style.display = 'none';
    syncOverflowState();
  }

  // 展开：逐个试恢复被收起的按钮——先显示再实测，地址栏跌破最小宽度
  // 或右侧被裁切则回退。试恢复能自然覆盖「最后一个恢复时 » 同步消失
  // 释放其占位」的场景，无需估算净成本
  guard = 0;
  while (guard++ <= buttons.length) {
    const hidden = buttons.filter((b) => b.style.display === 'none');
    if (hidden.length === 0) break;
    hidden[0].style.display = '';
    syncOverflowState();
    if (urlWidth() < TOOLBAR_URL_MIN_WIDTH || rightClipped()) {
      hidden[0].style.display = 'none';
      syncOverflowState();
      break;
    }
  }

  syncOverflowState();
}

/**
 * 将浮动弹框定位到触发按钮下方（跟随按钮位置，而非固定窗口右侧）
 * 右缘对齐按钮右缘，超出视口时收进边界；按钮被溢出收起（display:none，
 * rect 为全 0）时退回锚定 » 按钮，两者都不可见则保持 CSS 默认位置
 * @param {HTMLElement} panel - position: fixed 的弹框元素
 * @param {HTMLElement|null} btn - 触发按钮
 */
function positionPanelBelowButton(panel, btn) {
  if (!panel) return;
  let anchor = btn;
  if (!anchor || anchor.getBoundingClientRect().width === 0) {
    anchor = document.getElementById('toolbarOverflowBtn');
  }
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  if (rect.width === 0) return;
  const panelWidth = panel.offsetWidth;
  if (!panelWidth) return;
  const margin = 8;
  const maxLeft = document.documentElement.clientWidth - panelWidth - margin;
  const left = Math.max(margin, Math.min(rect.right - panelWidth, maxLeft));
  panel.style.right = 'auto';
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(rect.bottom + 4)}px`;
}

/**
 * 重定位当前打开的工具栏弹框
 * AI 面板开合/拖宽、窗口缩放都会改变按钮位置，由 #toolbar 的
 * ResizeObserver 驱动，让已打开的弹框实时跟住按钮
 */
function repositionOpenToolbarPanels() {
  if (state.mediaPanelOpen) {
    positionPanelBelowButton(elements.mediaPanel, elements.mediaPanelBtn);
  }
  if (state.downloadPanelOpen) {
    const panel = document.getElementById('downloadPanel');
    positionPanelBelowButton(panel, document.getElementById('downloadBtn'));
    syncBatchBarPosition();
  }
  if (elements.bookmarkEditPanel && elements.bookmarkEditPanel.open) {
    positionPanelBelowButton(elements.bookmarkEditPanel, elements.bookmarkStarBtn);
  }
}

/**
 * 批量操作栏与下载面板对齐（同宽同顶，覆盖面板头部）
 * 面板被 JS 定位后 CSS 的 right: 16px 不再成立，需复制面板内联位置
 */
function syncBatchBarPosition() {
  const bar = document.getElementById('downloadBatchBar');
  const panel = document.getElementById('downloadPanel');
  if (!bar || !panel || bar.classList.contains('hidden')) return;
  bar.style.left = panel.style.left;
  bar.style.top = panel.style.top;
}

/**
 * 显示工具栏溢出下拉菜单
 */
function showToolbarOverflowMenu() {
  closeToolbarOverflowMenu();

  if (!overflowToolbarButtons || overflowToolbarButtons.length === 0) return;

  const overflowBtn = document.getElementById('toolbarOverflowBtn');
  if (!overflowBtn) return;

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu';

  overflowToolbarButtons.forEach((btn) => {
    const item = document.createElement('div');
    item.className = 'toolbar-overflow-menu-item';
    item.textContent = btn.title || '';
    item.addEventListener('click', () => {
      btn.dispatchEvent(new Event('click'));
      closeToolbarOverflowMenu();
    });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  toolbarOverflowMenu = menu;

  // 创建遮罩层
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:99998;';
  backdrop.addEventListener('click', closeToolbarOverflowMenu);
  document.body.appendChild(backdrop);
  toolbarOverflowBackdrop = backdrop;

  // 定位：右对齐按钮
  const rect = overflowBtn.getBoundingClientRect();
  const menuWidth = Math.min(240, Math.max(140, menu.offsetWidth));
  const menuHeight = menu.offsetHeight;

  let left = rect.right - menuWidth;
  if (left < 8) left = 8;

  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuHeight - 4);
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.width = menuWidth + 'px';

  requestAnimationFrame(() => {
    menu.classList.add('visible');
  });
}

/**
 * 关闭工具栏溢出下拉菜单
 */
function closeToolbarOverflowMenu() {
  if (toolbarOverflowMenu) {
    toolbarOverflowMenu.remove();
    toolbarOverflowMenu = null;
  }
  if (toolbarOverflowBackdrop) {
    toolbarOverflowBackdrop.remove();
    toolbarOverflowBackdrop = null;
  }
}

/**
 * 初始化工具栏溢出收起
 */
function initToolbarOverflow() {
  const overflowBtn = document.getElementById('toolbarOverflowBtn');
  if (!overflowBtn) return;

  // 绑定 » 按钮点击事件
  overflowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (toolbarOverflowMenu) {
      closeToolbarOverflowMenu();
    } else {
      showToolbarOverflowMenu();
    }
  });

  // 使用 ResizeObserver 监听工具栏宽度变化
  const toolbar = document.getElementById('toolbar');
  if (toolbar && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      calculateToolbarOverflow();
      // AI 面板开合/拖宽、窗口缩放都会移动按钮，已打开的弹框跟着走
      repositionOpenToolbarPanels();
    });
    ro.observe(toolbar);
  } else if (toolbar) {
    window.addEventListener('resize', () => {
      calculateToolbarOverflow();
      repositionOpenToolbarPanels();
    });
  }

  // 首次计算：双重 requestAnimationFrame 确保布局完成
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      calculateToolbarOverflow();
    });
  });
}

// ==================== 初始化应用 ====================
init();

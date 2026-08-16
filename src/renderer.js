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

  // @ 引用标签页
  aiContextPills: document.getElementById('aiContextPills'),
  contextPickerPanel: document.getElementById('contextPickerPanel'),
  contextPickerSearch: document.getElementById('contextPickerSearch'),
  contextPickerList: document.getElementById('contextPickerList'),
  contextPickerEmpty: document.getElementById('contextPickerEmpty'),

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
  tabCounter: 0,
  webviews: new Map(),

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

  // @ 引用标签页状态
  contextPickerOpen: false,
  contextPickerSearch: '',
  referencedTabs: [],

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

// 已关闭标签栈（LIFO，最多 10 条），用于"重新打开已关闭标签页"功能
const closedTabsStack = [];

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
  // 剥离查询参数（含 API token），避免泄露到地址栏/持久化 Tab
  return converted.split('?')[0];
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
    updateStarButton(false);
    return;
  }
  try {
    const result = await window.realmAPI.favoritesCheck(url);
    state.isCurrentPageBookmarked = !!result;
    state.currentBookmarkId = result ? result.id : null;
    state.currentBookmarkTitle = result ? result.title : null;
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
 */
function showBookmarkEditPanel(title, url, isEdit = false) {
  elements.bookmarkTitleInput.value = title || '';
  elements.bookmarkUrlDisplay.textContent = url || '';

  // 编辑模式 UI 切换
  elements.bookmarkEditHeader.textContent = isEdit ? '编辑收藏' : '收藏此页面';
  elements.bookmarkRemoveBtn.style.display = isEdit ? '' : 'none';

  // 使用 <dialog> + showModal()：进入 top layer，天然覆盖 Electron <webview>
  // （webview 是独立 guest WebContents，z-index/visibility 对其不可靠，
  //  项目其他模态框如 cookiesModal/rulesModal 均用此模式）
  if (!elements.bookmarkEditPanel.open) {
    elements.bookmarkEditPanel.showModal();
  }

  elements.bookmarkTitleInput.focus();
  elements.bookmarkTitleInput.select();
}

/**
 * 隐藏收藏编辑面板
 */
function hideBookmarkEditPanel() {
  if (elements.bookmarkEditPanel.open) {
    elements.bookmarkEditPanel.close();
  }
}

/**
 * 保存收藏
 * 已收藏（编辑模式）：调用 favoritesUpdate 更新标题
 * 未收藏（新增模式）：调用 favoritesAdd 新增记录
 */
async function saveBookmark() {
  const title = elements.bookmarkTitleInput.value.trim();
  const url = elements.bookmarkUrlDisplay.textContent;

  if (!url) return;

  let toastMessage = null;
  let toastType = 'success';

  try {
    if (state.isCurrentPageBookmarked && state.currentBookmarkId) {
      // 编辑模式：更新标题
      await window.realmAPI.favoritesUpdate(state.currentBookmarkId, title);
      state.currentBookmarkTitle = title; // 同步 state，避免下次打开仍是旧值
      toastMessage = '已更新收藏';
    } else {
      // 新增模式：插入新记录，从当前 tab 获取 favicon
      const activeTab = state.tabs.get(state.activeTabId);
      const faviconUrl = activeTab ? (activeTab.faviconUrl || '') : '';
      const result = await window.realmAPI.favoritesAdd({
        url,
        title,
        faviconUrl,
      });

      if (result.error === 'duplicate') {
        toastMessage = '已收藏过该页面';
        toastType = 'error';
      } else {
        state.isCurrentPageBookmarked = true;
        state.currentBookmarkId = result.id;
        state.currentBookmarkTitle = title; // 同步 state
        updateStarButton(true);
        toastMessage = '已收藏';
      }
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
  const bookmarkId = state.currentBookmarkId;

  if (!bookmarkId) return;

  let toastMessage = null;
  let toastType = 'success';

  try {
    await window.realmAPI.favoritesDelete(bookmarkId);
    state.isCurrentPageBookmarked = false;
    state.currentBookmarkId = null;
    state.currentBookmarkTitle = null;
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
  closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab.id);
  });

  content.appendChild(favicon);
  content.appendChild(title);
  tabElement.appendChild(colorLine);
  tabElement.appendChild(content);
  tabElement.appendChild(closeBtn);

  return tabElement;
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
  if (!url) {
    elements.urlInput.focus();
    elements.urlInput.select();
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

  const tab = state.tabs.get(tabId);
  if (!tab) return;

  // 切换 Tab 时关闭页面内搜索框
  closeFindInPage();

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

  // 隐藏内嵌新标签页（现在使用 realm://newtab 加载新标签页）
  elements.newTabPage.style.display = 'none';

  // 滚动 Tab 到可见区域
  if (tab.element) {
    tab.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

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

  // 销毁关联的 webview
  destroyWebview(tabId);

  // 如果关闭的是活动 Tab，切换到新的活动 Tab
  if (tabId === state.activeTabId) {
    // 关闭页面内搜索框
    closeFindInPage();

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
  destroyWebview(data.tabId);

  // 被回收的一定是非活动 Tab（主进程回收逻辑排除活动 Tab），无需切换 activeTabId
  showToast(data.message || '已自动关闭最久未使用的标签页以释放资源', 'success');
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
 * 更新 Tab 标题
 * @param {string} tabId - Tab ID
 * @param {string} title - 新标题
 */
async function updateTabTitle(tabId, title) {
  const tab = state.tabs.get(tabId);
  if (!tab) return;

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
  // URL scheme 白名单（WR-9）：仅 http(s) 和 realm:// 允许写入 webview src。
  // 规则匹配与新窗口两条路径的 URL 均来自 guest 页面，不限制 scheme 时
  // file: 可在浏览器上下文读取本地文件、data: 可注入脚本；
  // 空 URL（新标签页）与 about:blank 放行。
  // view-source: 仅在包裹 http(s) 内层 URL 时放行（查看页面源代码场景）。
  const isViewSourceHttp = url && /^view-source:https?:\/\//i.test(url);
  if (url && url !== 'about:blank' && !/^https?:\/\//i.test(url) && !/^realm:\/\//i.test(url) && !isViewSourceHttp) {
    console.warn('[Realm] 拒绝非 http(s)/realm URL:', url);
    return null;
  }

  // realm:// URL 转换为 http://localhost:PORT/ URL（webview 无法加载自定义协议）
  if (url && url.startsWith('realm://')) {
    url = realmUrlToHttp(url, containerId);
  }

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
   * 扫描现有视频元素（per SNIFF-02）
   * @returns {Array<Object>} 检测到的视频数组
   */
  function scanExistingVideos() {
    var results = [];
    document.querySelectorAll('video, source').forEach(function(el) {
      var url = el.src || el.currentSrc;
      if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
        results.push({ url: url, type: classifyUrl(url), source: 'script' });
      }
    });
    return results;
  }

  // 初始扫描
  var initialVideos = scanExistingVideos();
  if (initialVideos.length > 0 && window.__realmBridge) {
    window.__realmBridge.sendMediaDetected(initialVideos);
  }

  // MutationObserver 监听动态加载的视频元素（per D-04/SNIFF-03）
  var observer = new MutationObserver(function(mutations) {
    var newVideos = [];
    mutations.forEach(function(mutation) {
      // 新增节点
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          if (node.tagName === 'VIDEO' || node.tagName === 'SOURCE') {
            var url = node.src || node.currentSrc;
            if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
              newVideos.push({ url: url, type: classifyUrl(url), source: 'dom' });
            }
          }
          // 检查子元素中的视频
          if (node.querySelectorAll) {
            node.querySelectorAll('video, source').forEach(function(el) {
              var url = el.src || el.currentSrc;
              if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
                newVideos.push({ url: url, type: classifyUrl(url), source: 'dom' });
              }
            });
          }
        }
      });
      // 属性变化（src/currentSrc 改变）
      if (mutation.type === 'attributes' &&
          (mutation.target.tagName === 'VIDEO' || mutation.target.tagName === 'SOURCE')) {
        var url = mutation.target.src || mutation.target.currentSrc;
        if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
          newVideos.push({ url: url, type: classifyUrl(url), source: 'dom' });
        }
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

      // D-21/D-23：导航完成后自动写入历史记录（过滤内部页面）
      if (e.url && e.url !== 'about:blank' && !displayUrl.startsWith('realm://')) {
        window.realmAPI.historyAdd({
          containerId: navContainerId,
          url: e.url,
          title: webview.getTitle() || '',
          visitedAt: Date.now(),
        }).catch(err => console.error('[Realm] 历史记录写入失败:', err));
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
    const tab = state.tabs.get(tabId);
    if (tab) {
      const previousUrl = tab.url;
      const displayUrl = httpUrlToRealm(e.url);
      tab.url = displayUrl;
      // 回写主进程持久化（WR-3），与 did-navigate 同理
      window.realmAPI.updateTab(tabId, { url: displayUrl });
      if (tabId === state.activeTabId) {
        elements.urlInput.value = displayUrl;
        // 仅域名变化时刷新快速保存按钮（同域 hash/参数变化无需重新比较）
        if (getUrlHostname(previousUrl) !== getUrlHostname(displayUrl)) {
          updateQuickSaveBtnState();
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
    updateTabTitle(tabId, e.title);

    // 如果是当前活动 Tab，更新窗口标题
    if (tabId === state.activeTabId) {
      updateWindowTitle();
    }

    // 更新历史记录中最近一条匹配记录的标题
    if (e.title) {
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
          title: e.title,
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
    const isImage = params.mediaType === 'image' || params.hasImageContents;
    const isLink = !!params.linkURL;
    const type = isImage ? 'image' : isLink ? 'link' : 'general';
    window.realmAPI.showWebContextMenu({
      type,
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

/**
 * 显示指定 Tab 的 webview
 * @param {string} tabId - Tab ID
 */
function showWebview(tabId) {
  state.webviews.forEach((wv, id) => {
    if (wv) {
      wv.style.visibility = id === tabId ? 'visible' : 'hidden';
      wv.style.position = id === tabId ? 'relative' : 'absolute';
    }
  });

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
 * 销毁 webview
 * @param {string} tabId - Tab ID
 */
function destroyWebview(tabId) {
  const webview = state.webviews.get(tabId);
  if (webview) {
    webview.remove();
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
      case 'bookmark':
        const activeTab = state.tabs.get(state.activeTabId);
        if (activeTab && activeTab.url) {
          const initialTitle = state.isCurrentPageBookmarked && state.currentBookmarkTitle
            ? state.currentBookmarkTitle
            : (activeTab.title || activeTab.url);
          showBookmarkEditPanel(
            initialTitle,
            activeTab.url,
            state.isCurrentPageBookmarked
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

  if (tabs.length === 0) {
    // 没有保存的 Tab，创建新 Tab
    createTab(state.currentContainer);
    return;
  }

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
    await window.realmAPI.clearAllTabs();
    createTab(state.currentContainer);
    return;
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
      if (data && data.tabId) {
        window.realmAPI.openTabInNewWindow(data.tabId, { move: false });
      }
      break;

    case 'context-menu:open-in-new-tab':
      if (data && data.url) {
        // T-13-04 安全校验：拒绝 javascript: 等非 http(s)/realm 协议；
        // view-source: 仅在包裹 http(s) 内层 URL 时放行（查看页面源代码菜单项）
        const viewSourceMatch = data.url.match(/^view-source:(https?:\/\/.+)$/i);
        if (/^(https?|realm):\/\//i.test(data.url) || viewSourceMatch) {
          createTab(state.currentContainer, data.url);
        } else {
          console.warn('[Realm Renderer] 拒绝非安全协议 URL:', data.url);
        }
      }
      break;

    case 'context-menu:open-in-bg-tab':
      if (data && data.url) {
        // T-13-04 安全校验：同 open-in-new-tab
        if (/^(https?|realm):\/\//i.test(data.url)) {
          // 后台打开：创建 Tab 但不切换（createTab 默认会 switchTab，需要先记住当前 Tab）
          const currentActiveTabId = state.activeTabId;
          createTab(state.currentContainer, data.url).then(() => {
            // 切回原来的 Tab
            if (currentActiveTabId && state.tabs.has(currentActiveTabId)) {
              switchTab(currentActiveTabId);
            }
          });
        } else {
          console.warn('[Realm Renderer] 拒绝非安全协议 URL:', data.url);
        }
      }
      break;

    case 'context-menu:open-in-container':
      if (data && data.url && data.containerId) {
        // T-13-04 安全校验：同 open-in-new-tab
        if (/^(https?|realm):\/\//i.test(data.url)) {
          createTab(data.containerId, data.url);
        } else {
          console.warn('[Realm Renderer] 拒绝非安全协议 URL:', data.url);
        }
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

/**
 * 重新渲染整个 Tab 栏
 * 用于固定/取消固定标签页后更新排序和样式
 * 固定标签排在最左侧，宽度缩小，显示固定图标
 */
function renderTabs() {
  const tabList = elements.tabList;
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
      createTab(state.currentContainer, data.url);
    }
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:edit-bookmark', (data) => {
    // 设置编辑状态，然后弹出收藏编辑面板
    state.isCurrentPageBookmarked = true;
    state.currentBookmarkId = data.id;
    state.currentBookmarkTitle = data.title;
    showBookmarkEditPanel(data.title, data.url, true);
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
    window.realmAPI.favoritesAdd({ url: activeTab.url, title, faviconUrl }).then(async (result) => {
      if (result.error) {
        showToast(result.message || '添加失败', 'error');
        return;
      }
      if (data.folderId) {
        await window.realmAPI.moveFavorite(result.id, data.folderId);
      }
      state.isCurrentPageBookmarked = true;
      state.currentBookmarkId = result.id;
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
    // 打开文件夹中的所有书签
    if (data.folderId) {
      window.realmAPI.bookmarksBar.listFavorites(data.folderId).then((favorites) => {
        if (favorites && favorites.length > 0) {
          favorites.forEach((fav) => {
            if (fav.url) {
              createTab(state.currentContainer, fav.url);
            }
          });
        }
      });
    }
  });

  console.log('[Realm Renderer] 初始化完成');

  // 初始化窗口标题
  updateWindowTitle();

  // 初始化 AI 事件流监听
  handleAIStream();

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
 */
function showToast(message, type) {
  // 移除已有的 toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // 3 秒后自动消失
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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

  createTab(containerId || state.currentContainer, data.url);
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

/**
 * 设置事件监听器
 */
function setupEventListeners() {
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

  // 新标签页搜索框
  elements.newTabSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = elements.newTabSearch.value.trim();
      if (value) {
        createTab(state.currentContainer, normalizeUrl(value));
        elements.newTabSearch.value = '';
      }
    }
  });

  // Tab 滚动按钮
  elements.tabScrollLeft.addEventListener('click', () => {
    elements.tabList.scrollBy({ left: -200, behavior: 'smooth' });
  });

  elements.tabScrollRight.addEventListener('click', () => {
    elements.tabList.scrollBy({ left: 200, behavior: 'smooth' });
  });

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
        state.isCurrentPageBookmarked
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

  // 点击 dialog 外部（backdrop）关闭：点击 dialog 元素本身（非内容）即 backdrop
  elements.bookmarkEditPanel.addEventListener('click', (e) => {
    if (e.target === elements.bookmarkEditPanel) {
      hideBookmarkEditPanel();
    }
  });

  // Escape 键：<dialog> 原生支持 Escape 关闭，无需手动监听

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

    // 检查是否已有 realm://favorites 的 Tab 打开（全局唯一，不按容器区分）
    let existingTabId = null;
    state.tabs.forEach((tab, tabId) => {
      if (tab.url === 'realm://favorites') {
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
  const cookieEditModal = document.getElementById('cookieEditModal');
  if (cookieEditModal) {
    cookieEditModal.addEventListener('click', (e) => {
      if (e.target === cookieEditModal) {
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
        const normalizedUrl = normalizeUrl(url);
        console.log('[Realm] 导航到:', normalizedUrl);

        // 如果有活动 Tab 和对应的 webview
        if (state.activeTabId) {
          const tab = state.tabs.get(state.activeTabId);
          const webview = state.webviews.get(state.activeTabId);

          if (tab && webview) {
            // 在 webview 中加载 URL
            webview.loadURL(normalizedUrl);
            tab.url = normalizedUrl;
            // 同步到主进程
            await window.realmAPI.updateTab(state.activeTabId, { url: normalizedUrl });
          } else if (tab) {
            // 如果没有 webview，创建一个
            createWebviewForTab(state.activeTabId, tab.containerId, normalizedUrl);
            tab.url = normalizedUrl;
            // 同步到主进程
            await window.realmAPI.updateTab(state.activeTabId, { url: normalizedUrl });
            // 显示新创建的 webview（createWebviewForTab 创建时 visibility: hidden）
            showWebview(state.activeTabId);
          }

          // 导航已发起，隐藏新标签页（统一覆盖两个分支，与 switchTab 行为一致）
          if (tab) {
            elements.newTabPage.style.display = 'none';
          }
        } else {
          // 无活动 Tab（冷启动空 Tab 栏或关闭最后 Tab 后）：用当前容器惰性创建 Tab
          // 传 normalizedUrl（主进程不规范化）；建 webview/切 Tab/隐藏新标签页由 createTab 全链路覆盖
          await createTab(state.currentContainer, normalizedUrl);
        }

        // 输入框聚焦时全选文本
        elements.urlInput.select();
      }
    }
  });

  // 点击模态框外部关闭
  elements.containerModal.addEventListener('click', (e) => {
    if (e.target === elements.containerModal) {
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
  // data: { url, containerId }；containerId 为 null 表示在当前容器打开，
  // 否则在默认容器设置指定的容器中打开
  window.realmAPI.onExternalUrlOpen((data) => {
    if (data && data.url) {
      createTab(data.containerId || state.currentContainer, data.url);
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
    elements.aiSendBtn.addEventListener('click', handleSendAIMessage);
  }

  // AI 输入框键盘事件（Enter 发送，Shift+Enter 换行）
  if (elements.aiInput) {
    elements.aiInput.addEventListener('keydown', handleAIInputKeydown);
    elements.aiInput.addEventListener('input', handleAIInputAutoResize);
  }

  // @ 引用面板事件
  if (elements.contextPickerSearch) {
    elements.contextPickerSearch.addEventListener('input', (e) => {
      state.contextPickerSearch = e.target.value;
      renderContextPickerList();
    });

    elements.contextPickerSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeContextPicker();
        elements.aiInput.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        closeContextPicker();
        elements.aiInput.focus();
      }
    });
  }

  // 点击外部关闭 @ 引用面板
  document.addEventListener('click', (e) => {
    if (state.contextPickerOpen &&
        !elements.contextPickerPanel.contains(e.target) &&
        e.target !== elements.aiInput) {
      closeContextPicker();
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
  }

  // 回到底部按钮
  if (elements.aiScrollToBottom) {
    elements.aiScrollToBottom.addEventListener('click', handleScrollToBottomClick);
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

  // 初始化快捷键监听
  initShortcuts();

  // 初始化页面内搜索
  initFindInPage();
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

/**
 * 切换 AI 面板的显示/隐藏状态
 * 同时更新按钮激活态和面板可见性，持久化状态到 electron-store
 * 打开时加载持久化的面板宽度（D-04, D-17）
 */
function toggleAIPanel() {
  state.aiPanelOpen = !state.aiPanelOpen;

  if (state.aiPanelOpen) {
    elements.aiPanel.classList.remove('hidden');
    // 加载持久化的面板宽度
    loadAIPanelWidth();
  } else {
    elements.aiPanel.classList.add('hidden');
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

    const wrapper = document.createElement('div');
    wrapper.className = `ai-message ${isUser ? 'ai-message-user' : 'ai-message-ai'}`;

    const content = document.createElement('div');
    content.className = 'ai-message-content';

    if (isUser) {
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

      // 用户消息：纯文本
      const textDiv = document.createElement('div');
      textDiv.textContent = msg.content || '';
      content.appendChild(textDiv);
    } else {
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

    wrapper.appendChild(content);

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

  if (state.aiAutoScroll) {
    scrollToBottom();
  }
}

/**
 * 发送 AI 消息
 * 获取输入框内容，添加用户消息到列表，调用 AI API
 * 支持 @ 引用标签页内容注入
 */
async function handleSendAIMessage() {
  const text = elements.aiInput.value.trim();
  if (!text) return;
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

  // 添加用户消息（附带引用标签页标记，气泡中展示）
  state.aiMessages.push({
    role: 'user',
    content: text,
    referencedTabs: referencedTabs.map(t => ({
      tabId: t.tabId,
      title: t.title,
      containerColor: t.containerColor
    }))
  });

  // 添加 AI 消息占位符
  const aiMsgId = 'ai-msg-' + Date.now();
  state.aiMessages.push({ role: 'assistant', content: '', id: aiMsgId });
  state.aiCurrentMessageId = aiMsgId;
  state.aiStreaming = true;

  renderAIMessages();

  // 调用 AI API 发送消息
  try {
    if (referencedTabs.length > 0 && window.realmAPI.ai && window.realmAPI.ai.promptWithContext) {
      // 有 @ 引用：提取 webview 内容并通过新 IPC 发送
      const tabsWithContent = await extractReferencedTabsContent(referencedTabs);
      await window.realmAPI.ai.promptWithContext({
        message: text,
        referencedTabs: tabsWithContent
      });
    } else {
      // 无 @ 引用：走原有通道
      await window.realmAPI.ai.prompt(text);
    }
  } catch (err) {
    console.error('[Realm Renderer] AI 发送消息失败:', err);
    state.aiStreaming = false;
    renderAIMessages();
  }
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
              // 更新已存在的工具执行状态
              toolMsg.toolExecutions[existingIdx] = {
                ...toolMsg.toolExecutions[existingIdx],
                status: event.status,
                result: event.result,
                error: event.error
              };
            } else {
              // 添加新的工具执行
              toolMsg.toolExecutions.push({
                id: event.tool_execution_id,
                name: event.tool_name,
                status: event.status,
                params: event.params,
                result: event.result,
                error: event.error
              });
            }
            renderToolCards(state.aiCurrentMessageId);
          }
          break;
        }

        case 'turn_end': {
          // 一轮对话结束：定向收尾当前气泡（最终渲染+操作按钮），
          // 不做整列表重建，消除完成瞬间闪烁
          finalizeAIStreamingBubble();
          break;
        }

        case 'error': {
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

  // 工具名称
  const name = document.createElement('span');
  name.className = 'tool-card-name';
  name.textContent = toolExecution.name;

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
    paramsValue.textContent = JSON.stringify(toolExecution.params, null, 2);
    paramsSection.appendChild(paramsLabel);
    paramsSection.appendChild(paramsValue);
    content.appendChild(paramsSection);
  }

  // 结果区域（使用 textContent 防止 XSS）
  if (toolExecution.result || toolExecution.error) {
    const resultSection = document.createElement('div');
    resultSection.className = 'tool-card-result';
    const resultLabel = document.createElement('div');
    resultLabel.className = 'tool-card-label';
    resultLabel.textContent = toolExecution.status === 'failed' ? '错误' : '结果';
    const resultValue = document.createElement('pre');
    resultValue.className = 'tool-card-value';
    if (toolExecution.status === 'failed') {
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

  return card;
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
 * @param {string} messageId - 消息 ID
 */
async function regenerateMessage(messageId) {
  if (state.aiStreaming) return;

  const msgIndex = state.aiMessages.findIndex(m => m.id === messageId);
  if (msgIndex < 0) return;

  // 找到该消息之前的最近一条用户消息
  let userMsgContent = null;
  for (let i = msgIndex - 1; i >= 0; i--) {
    if (state.aiMessages[i].role === 'user') {
      userMsgContent = state.aiMessages[i].content;
      break;
    }
  }

  if (!userMsgContent) return;

  // 删除该消息及其之后的所有消息
  state.aiMessages = state.aiMessages.slice(0, msgIndex);

  // 重新发送用户消息
  state.aiMessages.push({ role: 'user', content: userMsgContent });

  // 添加 AI 消息占位符
  const aiMsgId = 'ai-msg-' + Date.now();
  state.aiMessages.push({ role: 'assistant', content: '', id: aiMsgId });
  state.aiCurrentMessageId = aiMsgId;
  state.aiStreaming = true;

  renderAIMessages();

  // 调用 AI API
  try {
    window.realmAPI.ai.prompt(userMsgContent);
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
  retryBtn.addEventListener('click', () => {
    errorDiv.remove();
    // 找到最后一条用户消息重新发送
    let lastUserMsgIndex = -1;
    for (let i = state.aiMessages.length - 1; i >= 0; i--) {
      if (state.aiMessages[i].role === 'user') {
        lastUserMsgIndex = i;
        break;
      }
    }
    if (lastUserMsgIndex >= 0) {
      const userMsg = state.aiMessages[lastUserMsgIndex].content;
      state.aiMessages = state.aiMessages.slice(0, lastUserMsgIndex + 1);
      const aiMsgId = 'ai-msg-' + Date.now();
      state.aiMessages.push({ role: 'assistant', content: '', id: aiMsgId });
      state.aiCurrentMessageId = aiMsgId;
      state.aiStreaming = true;
      renderAIMessages();
      try {
        window.realmAPI.ai.prompt(userMsg);
      } catch (err) {
        console.error('[Realm Renderer] AI 重试失败:', err);
        state.aiStreaming = false;
        renderAIMessages();
      }
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
 * Enter 发送消息，Shift+Enter 换行
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleAIInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendAIMessage();
  }
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

    // 渲染列表
    if (filteredTabs.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = filteredTabs.map(tab => {
      const container = containerMap[tab.containerId] || { name: '未知', color: '#666' };
      const isSelected = state.referencedTabs.some(t => t.tabId === tab.id);
      return `
        <div class="context-picker-row ${isSelected ? 'selected' : ''}" data-tab-id="${tab.id}">
          <span class="context-picker-dot" style="background-color: ${container.color}"></span>
          <span class="context-picker-container-name">${container.name}</span>
          <span class="context-picker-tab-title">${tab.title || tab.url || '空白标签页'}</span>
          ${isSelected ? '<svg class="context-picker-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </div>
      `;
    }).join('');

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

  if (state.referencedTabs.length === 0) {
    container.classList.remove('has-items');
    container.innerHTML = '';
    return;
  }

  container.classList.add('has-items');
  container.innerHTML = state.referencedTabs.map(tab => `
    <div class="ai-context-pill" data-tab-id="${tab.tabId}">
      <span class="ai-context-pill-dot" style="background-color: ${tab.containerColor}"></span>
      <span class="ai-context-pill-title">${tab.title}</span>
      <span class="ai-context-pill-close" data-tab-id="${tab.tabId}">×</span>
    </div>
  `).join('');

  // 绑定关闭事件
  container.querySelectorAll('.ai-context-pill-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = btn.dataset.tabId;
      state.referencedTabs = state.referencedTabs.filter(t => t.tabId !== tabId);
      renderContextPills();
      if (state.contextPickerOpen) {
        renderContextPickerList();
      }
    });
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
      elements.mediaPanelBtn.style.display = '';
    }
    // 不自动打开面板，保持用户控制
  }
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

  // 打开时刷新列表
  if (state.mediaPanelOpen) {
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
    const name = item.name || item.url.split('/').pop() || 'video';
    const urlPreview = formatMediaUrl(item.url);

    return `
      <div class="media-item" data-url="${escapeHtml(item.url)}" data-index="${index}">
        <span class="media-type-badge media-type-${type}">${type}</span>
        <div class="media-item-info">
          <div class="media-item-name" title="${escapeHtml(item.url)}">${escapeHtml(name)}</div>
          <div class="media-item-url">${escapeHtml(urlPreview)}</div>
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
    }

    // 窗口内排序反馈：鼠标在 Tab 栏内时显示插入指示器并隐藏浮动预览；
    // 拖出 Tab 栏后隐藏指示器、显示浮动预览
    const tabBarRect = elements.tabBar.getBoundingClientRect();
    const inTabBar = e.clientY >= tabBarRect.top && e.clientY <= tabBarRect.bottom;
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
    // 防止 webview 吞掉鼠标事件
    document.querySelectorAll('webview').forEach(wv => {
      wv.style.pointerEvents = 'none';
    });
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

    // 恢复过渡动画和 webview 事件
    elements.aiPanel.classList.remove('resizing');
    document.querySelectorAll('webview').forEach(wv => {
      wv.style.pointerEvents = '';
    });

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

// ==================== 初始化应用 ====================
init();

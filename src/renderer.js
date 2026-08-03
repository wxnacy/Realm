/**
 * Realm Browser - 渲染进程
 *
 * 处理 UI 交互和容器管理逻辑
 */

// DOM 元素
const elements = {
  containerList: document.getElementById('containerList'),
  containerIndicator: document.getElementById('containerIndicator'),
  indicatorDot: document.querySelector('.indicator-dot'),
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
  containerPanel: document.getElementById('containerPanel'),
  panelContainerList: document.getElementById('panelContainerList'),
  addContainerBtn: document.getElementById('addContainerBtn'),
  addContainerBtnSidebar: document.getElementById('addContainerBtnSidebar'),

  // 导航按钮
  backBtn: document.getElementById('backBtn'),
  forwardBtn: document.getElementById('forwardBtn'),
  reloadBtn: document.getElementById('reloadBtn'),
  historyBtn: document.getElementById('historyBtn'),
  favoritesBtn: document.getElementById('favoritesBtn'),
  cookiesBtn: document.getElementById('cookiesBtn'),
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

};

// 应用状态
const state = {
  containers: [],
  currentContainer: 'default',
  selectedColor: '#3B82F6',
  selectedIcon: '🌐',
  editingContainerId: null,
  deletingContainerId: null,
  panelVisible: false,

  // Tab 管理
  tabs: new Map(),
  activeTabId: null,
  tabCounter: 0,
  webviews: new Map(),

  // 内部页面服务器端口（用于加载 realm:// 页面）
  realmPort: null,
  // 内部页面 API token（/api/history/* 鉴权）
  realmToken: null,

  // 收藏状态
  isCurrentPageBookmarked: false,
  currentBookmarkId: null,
  currentBookmarkTitle: null,

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
    elements.indicatorDot.style.backgroundColor = container.color;
    elements.indicatorText.textContent = container.name;
    if (state.currentContainer !== tab.containerId) {
      state.currentContainer = tab.containerId;
      renderContainerList();
    }
  }

  // 切换 Tab 时检查收藏状态
  checkBookmarkStatus(tab.url);

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

  // 销毁关联的 webview
  destroyWebview(tabId);

  // 如果关闭的是活动 Tab，切换到新的活动 Tab
  if (tabId === state.activeTabId) {
    if (result.newActiveTabId) {
      await switchTab(result.newActiveTabId);
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

  // 设置 src
  webview.src = url || 'about:blank';

  // 设置 partition（容器隔离，D-01）
  webview.partition = `persist:container-${containerId}`;

  // 应用安全配置（D-03）：仅设置字符串型属性 webpreferences（CR-1）
  webview.setAttribute('webpreferences', WEBVIEW_WEBPREFERENCES);

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
    const guestId = webview.getWebContentsId();
    const partition = webview.partition || '';
    const prefix = 'persist:container-';
    if (guestId && partition.startsWith(prefix)) {
      window.realmAPI.registerGuestContainer(guestId, partition.slice(prefix.length));
    }
  };
  webview.addEventListener('did-attach', registerGuest);
  webview.addEventListener('dom-ready', registerGuest);

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
      }

      // D-21/D-23：导航完成后自动写入历史记录（过滤内部页面）
      if (e.url && e.url !== 'about:blank' && !displayUrl.startsWith('realm://')) {
        // 从 webview partition 推导容器 ID
        const partition = webview.partition || '';
        const prefix = 'persist:container-';
        const historyContainerId = partition.startsWith(prefix)
          ? partition.slice(prefix.length)
          : state.currentContainer;

        window.realmAPI.historyAdd({
          containerId: historyContainerId,
          url: e.url,
          title: webview.getTitle() || '',
          visitedAt: Date.now(),
        }).catch(err => console.error('[Realm] 历史记录写入失败:', err));
      }
    }
  });

  webview.addEventListener('did-navigate-in-page', (e) => {
    const tab = state.tabs.get(tabId);
    if (tab) {
      const displayUrl = httpUrlToRealm(e.url);
      tab.url = displayUrl;
      // 回写主进程持久化（WR-3），与 did-navigate 同理
      window.realmAPI.updateTab(tabId, { url: displayUrl });
      if (tabId === state.activeTabId) {
        elements.urlInput.value = displayUrl;
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
    icon.textContent = container.icon;

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
    tabList.appendChild(tabElement);
  });
}

/**
 * 初始化应用
 */
async function init() {
  console.log('[Realm Renderer] 初始化...');

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
}

/**
 * 加载容器列表
 */
async function loadContainers() {
  state.containers = await window.realmAPI.getContainers();
  state.currentContainer = await window.realmAPI.getCurrentContainer();

  renderContainerList();
  renderContainerPanelList();
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
    const item = document.createElement('div');
    item.className = 'container-item' + (container.id === state.currentContainer ? ' active' : '');
    item.dataset.containerId = container.id;

    const dot = document.createElement('div');
    dot.className = 'container-dot';
    dot.style.backgroundColor = container.color;

    const info = document.createElement('div');
    info.className = 'container-info';

    const name = document.createElement('div');
    name.className = 'container-name';
    name.textContent = `${container.icon} ${container.name}`;

    const status = document.createElement('div');
    status.className = 'container-status';
    status.textContent = container.id === state.currentContainer ? '当前' : '';

    info.appendChild(name);
    info.appendChild(status);
    item.appendChild(dot);
    item.appendChild(info);

    item.addEventListener('click', () => {
      switchContainer(item.dataset.containerId);
    });

    elements.containerList.appendChild(item);
  });
}

/**
 * 渲染容器面板列表
 * 使用事件委托模式，为 panelContainerList 绑定一次 click 监听器
 * 默认容器（id=default）的删除按钮禁用并显示 tooltip
 */
function renderContainerPanelList() {
  // WR-13：DOM 构建 + textContent（动机见 renderContainerList 注释）。
  // setupEventListeners 中的事件委托依赖 dataset.containerId、data-action
  // 与 delete 按钮的 disabled 状态，此处保持结构一致
  elements.panelContainerList.innerHTML = '';

  state.containers.forEach(container => {
    const isDefault = container.id === 'default';

    const item = document.createElement('div');
    item.className = 'panel-container-item' + (container.id === state.currentContainer ? ' active' : '');
    item.dataset.containerId = container.id;

    const dot = document.createElement('div');
    dot.className = 'container-dot';
    dot.style.backgroundColor = container.color;

    const emoji = document.createElement('div');
    emoji.className = 'container-emoji';
    emoji.textContent = container.icon;

    const name = document.createElement('div');
    name.className = 'container-name';
    name.textContent = container.name;

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

    item.appendChild(dot);
    item.appendChild(emoji);
    item.appendChild(name);
    item.appendChild(actions);

    if (container.id === state.currentContainer) {
      const check = document.createElement('div');
      check.className = 'check-mark';
      check.textContent = '✓';
      item.appendChild(check);
    }

    elements.panelContainerList.appendChild(item);
  });
}

/**
 * 更新容器指示器
 */
function updateContainerIndicator() {
  const current = state.containers.find(c => c.id === state.currentContainer);
  if (current) {
    elements.indicatorDot.style.backgroundColor = current.color;
    elements.indicatorText.textContent = current.name;
  }
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
    renderContainerPanelList();
    updateContainerIndicator();

    // CR-6 修复：不在此处本地 createTab。
    // 新 Tab 统一由主进程推送的 container-switched 事件（handleContainerSwitched）创建，
    // 避免「本地创建 + 事件再创建」双路径导致每次切换产生两个重复 Tab。

    console.log(`[Realm] 切换到容器: ${containerId}`);
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

  // 动态填充容器预览（使用 textContent 防止 XSS）
  const previewDot = document.createElement('div');
  previewDot.className = 'preview-dot';
  previewDot.style.backgroundColor = container.color;

  const previewInfo = document.createElement('span');
  previewInfo.className = 'preview-info';
  previewInfo.textContent = container.icon + ' ' + container.name;

  elements.deleteContainerPreview.innerHTML = '';
  elements.deleteContainerPreview.appendChild(previewDot);
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
    const tabIdsToClose = [];
    state.tabs.forEach((tab, tabId) => {
      if (tab.containerId === containerId) {
        tabIdsToClose.push(tabId);
      }
    });
    for (const tabId of tabIdsToClose) {
      await closeTab(tabId);
    }

    const result = await window.realmAPI.deleteContainer(containerId);
    if (result.success) {
      // 如果删除的是当前活跃容器，自动切换到默认容器
      if (containerId === state.currentContainer) {
        await switchContainer('default');
      }

      await loadContainers();
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
  renderContainerPanelList();
  updateContainerIndicator();

  // 创建新 Tab
  createTab(data.containerId);
}

/**
 * 显示容器面板
 */
function showContainerPanel() {
  const rect = elements.containerIndicator.getBoundingClientRect();
  elements.containerPanel.style.top = rect.bottom + 4 + 'px';
  elements.containerPanel.style.left = rect.left + 'px';
  elements.containerPanel.classList.add('visible');
  state.panelVisible = true;

  // 注册外部点击监听
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

/**
 * 隐藏容器面板
 */
function hideContainerPanel() {
  elements.containerPanel.classList.remove('visible');
  state.panelVisible = false;

  // 移除外部点击监听
  document.removeEventListener('click', handleOutsideClick);
}

/**
 * 处理面板外部点击
 */
function handleOutsideClick(event) {
  const panel = elements.containerPanel;
  const indicator = elements.containerIndicator;

  // 如果点击区域不在面板和指示器内，关闭面板
  if (!panel.contains(event.target) && !indicator.contains(event.target)) {
    hideContainerPanel();
  }
}

/**
 * 显示创建容器 Modal
 * 重置表单、设置默认颜色和图标、显示 Modal
 */
function showCreateContainerModal() {
  state.editingContainerId = null;
  elements.containerNameInput.value = '';
  state.selectedColor = '#3B82F6';
  state.selectedIcon = '🌐';
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
  updateColorSelection();
  updateEmojiSelection();
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
  updateColorSelection();
  updateEmojiSelection();
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
 * 更新 Emoji 选择器选中状态
 */
function updateEmojiSelection() {
  const emojiOptions = elements.emojiPicker.querySelectorAll('.emoji-option');
  emojiOptions.forEach(option => {
    option.classList.remove('selected');
    if (option.dataset.icon === state.selectedIcon) {
      option.classList.add('selected');
    }
  });
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
    } else {
      showToast(result.message || '删除失败', 'error');
    }
  } catch (error) {
    console.error('[Realm Renderer] 删除 Cookie 失败:', error);
    showToast('删除失败，请重试', 'error');
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

  // 容器指示器点击 - 切换面板显示/隐藏
  elements.containerIndicator.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.panelVisible) {
      hideContainerPanel();
    } else {
      showContainerPanel();
    }
  });

  // 面板容器列表 - 事件委托
  elements.panelContainerList.addEventListener('click', (e) => {
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
      hideContainerPanel();
    }
  });

  // 新建容器按钮（面板头部）
  elements.addContainerBtn.addEventListener('click', () => {
    hideContainerPanel();
    showCreateContainerModal();
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

  // Emoji 选择器 - 事件委托
  elements.emojiPicker.addEventListener('click', (e) => {
    const button = e.target.closest('.emoji-option');
    if (!button) return;

    state.selectedIcon = button.dataset.icon;
    updateEmojiSelection();
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

    // Escape: 关闭模态框和面板
    if (e.key === 'Escape') {
      if (state.panelVisible) {
        hideContainerPanel();
      } else {
        elements.deleteConfirmModal.close();
        state.deletingContainerId = null;
        elements.containerModal.close();
        elements.cookiesModal.close();
      }
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

  // 初始化 AI 面板拖拽调整宽度
  initAIPanelResize();

  // 初始化快捷键监听
  initShortcuts();
}

// ==================== AI 助手 ====================

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

// 初始化应用
init();

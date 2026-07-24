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
  cookiesBtn: document.getElementById('cookiesBtn'),
  rulesBtn: document.getElementById('rulesBtn'),
  settingsBtn: document.getElementById('settingsBtn'),

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

  // 删除确认模态框
  deleteConfirmModal: document.getElementById('deleteConfirmModal'),
  deleteContainerPreview: document.getElementById('deleteContainerPreview'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

  cookiesModal: document.getElementById('cookiesModal'),
  cookiesModalTitle: document.getElementById('cookiesModalTitle'),
  cookiesList: document.getElementById('cookiesList'),
  clearCookiesBtn: document.getElementById('clearCookiesBtn'),
  refreshCookiesBtn: document.getElementById('refreshCookiesBtn'),
  closeCookiesModal: document.getElementById('closeCookiesModal'),

  // 规则管理
  rulesModal: document.getElementById('rulesModal'),
  rulesList: document.getElementById('rulesList'),
  ruleContainerSelect: document.getElementById('ruleContainerSelect'),
  rulePatternInput: document.getElementById('rulePatternInput'),
  addRuleBtn: document.getElementById('addRuleBtn'),
  closeRulesModal: document.getElementById('closeRulesModal'),

  // 快捷键设置
  shortcutsModal: document.getElementById('shortcutsModal'),
  shortcutsList: document.getElementById('shortcutsList'),
  shortcutsBtn: document.getElementById('shortcutsBtn'),
  closeShortcutsModal: document.getElementById('closeShortcutsModal'),

  // 快捷键捕获对话框（WR-5）
  shortcutCaptureModal: document.getElementById('shortcutCaptureModal'),
  shortcutCaptureTitle: document.getElementById('shortcutCaptureTitle'),
  keyCaptureBox: document.getElementById('keyCaptureBox'),
  cancelKeyCaptureBtn: document.getElementById('cancelKeyCaptureBtn'),
  saveKeyCaptureBtn: document.getElementById('saveKeyCaptureBtn'),
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
};

// 注意：Tab 回收策略（上限/文案/回收逻辑）单点实现于主进程 tab-manager（WR-4）。
// 渲染进程不再持有 TAB_MAX_COUNT / TAB_RECYCLE_MESSAGE / recycleOldestTab 副本，
// 回收结果经 tab:recycled 事件推送（见 handleTabRecycled）。

// Webview 安全配置（D-03，CR-1 修复）
// Electron 布尔属性（nodeintegration/disablewebsecurity/allowpopups）为 presence 语义：
// 属性存在即为 true，字符串值被忽略。因此只能保留字符串型属性 webpreferences，
// 布尔属性一律「缺席即 false」，禁止显式写入（含 'false'）。
const WEBVIEW_WEBPREFERENCES = 'contextIsolation=yes';

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

  // 如果看起来像域名（包含点号），添加 https://
  if (/^[\w-]+(\.[\w-]+)+/.test(input)) {
    return `https://${input}`;
  }

  // 其他情况当作搜索查询
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

/**
 * 创建新 Tab
 * @param {string} containerId - 容器 ID
 * @param {string|null} url - 初始 URL
 * @returns {Promise<string>} 新创建的 Tab ID
 */
async function createTab(containerId, url = null) {
  // 调用主进程创建 Tab
  const tab = await window.realmAPI.createTab(containerId, url || '');

  // 创建 Tab DOM 元素
  const tabElement = document.createElement('div');
  tabElement.className = 'tab';
  tabElement.dataset.tabId = tab.id;

  const color = getContainerColor(containerId);
  const colorLine = document.createElement('div');
  colorLine.className = 'tab-color-line';
  colorLine.style.backgroundColor = color;

  const content = document.createElement('div');
  content.className = 'tab-content';

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

  content.appendChild(title);
  tabElement.appendChild(colorLine);
  tabElement.appendChild(content);
  tabElement.appendChild(closeBtn);

  // 添加到 Tab 列表
  elements.tabList.appendChild(tabElement);

  // 存储 Tab 数据（包含 DOM 引用）
  tab.element = tabElement;
  state.tabs.set(tab.id, tab);

  // 创建 webview（如果有 URL）
  if (url) {
    createWebviewForTab(tab.id, containerId, url);
  }

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
    state.currentContainer = tab.containerId;
  }

  // 切换 webview 可见性
  showWebview(tabId);

  // 如果没有 URL，显示新标签页
  if (!tab.url) {
    elements.newTabPage.style.display = 'flex';
  } else {
    elements.newTabPage.style.display = 'none';
  }

  // 滚动 Tab 到可见区域
  if (tab.element) {
    tab.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

/**
 * 关闭 Tab
 * @param {string} tabId - Tab ID
 */
async function closeTab(tabId) {
  const tab = state.tabs.get(tabId);
  if (!tab) return;

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
      // 没有 Tab 了，显示新标签页
      state.activeTabId = null;
      elements.urlInput.value = '';
      elements.newTabPage.style.display = 'flex';
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
  // URL scheme 白名单（WR-9）：仅 http(s) 允许写入 webview src。
  // 规则匹配与新窗口两条路径的 URL 均来自 guest 页面，不限制 scheme 时
  // file: 可在浏览器上下文读取本地文件、data: 可注入脚本；
  // 空 URL（新标签页）与 about:blank 放行。
  if (url && url !== 'about:blank' && !/^https?:\/\//i.test(url)) {
    console.warn('[Realm] 拒绝非 http(s) URL:', url);
    return null;
  }

  const webview = document.createElement('webview');

  // 设置 src
  webview.src = url || 'about:blank';

  // 设置 partition（容器隔离，D-01）
  webview.partition = `persist:container-${containerId}`;

  // 应用安全配置（D-03）：仅设置字符串型属性 webpreferences（CR-1）
  webview.setAttribute('webpreferences', WEBVIEW_WEBPREFERENCES);

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
  // 页面导航事件
  webview.addEventListener('did-navigate', (e) => {
    const tab = state.tabs.get(tabId);
    if (tab) {
      tab.url = e.url;
      // 回写主进程持久化（WR-3）：否则重启后 restoreTabs 恢复到过期地址
      window.realmAPI.updateTab(tabId, { url: e.url });
      // 如果是活动 Tab，更新 URL 输入框
      if (tabId === state.activeTabId) {
        elements.urlInput.value = e.url;
      }
    }
  });

  webview.addEventListener('did-navigate-in-page', (e) => {
    const tab = state.tabs.get(tabId);
    if (tab) {
      tab.url = e.url;
      // 回写主进程持久化（WR-3），与 did-navigate 同理
      window.realmAPI.updateTab(tabId, { url: e.url });
      if (tabId === state.activeTabId) {
        elements.urlInput.value = e.url;
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
  });

  // 注意：webview 标签的 will-navigate 事件文档明示 preventDefault 无效（WR-2），
  // 分配规则重定向已移至主进程 webContents 的 will-navigate（可同步取消），
  // 命中规则时经 open-url-in-tab 事件转交 handleOpenUrlInTab 在匹配容器新建 Tab。

  // 注意：webview 的 new-window 事件在 Electron 32 已移除（WR-1）。
  // guest 的 window.open / target=_blank 由主进程 setWindowOpenHandler 拦截，
  // 经 open-url-in-tab 事件转交 handleOpenUrlInTab 在对应容器新建 Tab（D-09）。

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

// ==================== 规则管理 ====================

/**
 * 显示规则管理模态框
 */
async function showRulesModal() {
  // 加载容器选项
  const containerSelect = elements.ruleContainerSelect;
  containerSelect.innerHTML = '';
  state.containers.forEach(container => {
    const option = document.createElement('option');
    option.value = container.id;
    option.textContent = container.icon + ' ' + container.name;
    containerSelect.appendChild(option);
  });

  // 加载规则列表
  await refreshRulesList();

  // 显示模态框
  elements.rulesModal.showModal();
}

/**
 * 刷新规则列表
 */
async function refreshRulesList() {
  const rules = await window.realmAPI.getRules();
  renderRulesList(rules);
}

/**
 * 渲染规则列表
 * @param {Array} rules - 规则数组
 */
function renderRulesList(rules) {
  if (rules.length === 0) {
    elements.rulesList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无分配规则</div>';
    return;
  }

  const html = rules.map(rule => {
    const container = state.containers.find(c => c.id === rule.containerId);
    const containerName = container ? container.icon + ' ' + container.name : rule.containerId;

    return `
      <div class="rule-item" data-rule-id="${rule.id}">
        <div class="rule-info">
          <span class="rule-pattern">${rule.pattern}</span>
          <span class="rule-arrow">→</span>
          <span class="rule-container">${containerName}</span>
        </div>
        <div class="rule-actions">
          <button class="action-btn" data-action="toggle" title="${rule.enabled ? '禁用' : '启用'}">
            ${rule.enabled ? '✓' : '✗'}
          </button>
          <button class="action-btn" data-action="delete" title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  elements.rulesList.innerHTML = html;

  // 绑定事件
  document.querySelectorAll('.rule-item').forEach(item => {
    const ruleId = item.dataset.ruleId;

    item.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;

        if (action === 'toggle') {
          const rules = await window.realmAPI.getRules();
          const rule = rules.find(r => r.id === ruleId);
          if (rule) {
            await window.realmAPI.updateRule(ruleId, { enabled: !rule.enabled });
            await refreshRulesList();
          }
        } else if (action === 'delete') {
          await window.realmAPI.deleteRule(ruleId);
          await refreshRulesList();
        }
      });
    });
  });
}

/**
 * 创建新规则
 */
async function createRule() {
  const containerId = elements.ruleContainerSelect.value;
  const pattern = elements.rulePatternInput.value.trim();

  if (!pattern) {
    showToast('请输入匹配模式', 'error');
    return;
  }

  await window.realmAPI.createRule(containerId, pattern);
  elements.rulePatternInput.value = '';
  await refreshRulesList();
  showToast('规则已添加', 'success');
}

// ==================== 快捷键设置 UI ====================

/**
 * 快捷键中文名称映射
 */
const SHORTCUT_NAMES = {
  'newTab': '新建标签页',
  'closeTab': '关闭标签页',
  'nextTab': '下一个标签页',
  'prevTab': '上一个标签页',
  'reload': '刷新页面',
  'back': '后退',
  'forward': '前进',
};

/**
 * 显示快捷键设置模态框
 */
async function showShortcutsModal() {
  await refreshShortcutsList();
  elements.shortcutsModal.showModal();
}

/**
 * 刷新快捷键列表
 */
async function refreshShortcutsList() {
  const shortcuts = await window.realmAPI.getShortcuts();
  renderShortcutsList(shortcuts);
}

/**
 * 渲染快捷键列表
 * @param {Object} shortcuts - 快捷键配置对象
 */
function renderShortcutsList(shortcuts) {
  const html = Object.entries(shortcuts).map(([action, accelerator]) => {
    const name = SHORTCUT_NAMES[action] || action;

    return `
      <div class="shortcut-item" data-action="${action}">
        <div class="shortcut-info">
          <span class="shortcut-name">${name}</span>
          <span class="shortcut-key">${accelerator}</span>
        </div>
        <div class="shortcut-actions">
          <button class="action-btn" data-action="edit" title="修改">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="action-btn" data-action="reset" title="恢复默认">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  elements.shortcutsList.innerHTML = html;

  // 绑定事件
  document.querySelectorAll('.shortcut-item').forEach(item => {
    const action = item.dataset.action;

    item.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btnAction = btn.dataset.action;

        if (btnAction === 'edit') {
          await editShortcut(action);
        } else if (btnAction === 'reset') {
          await resetShortcut(action);
        }
      });
    });
  });
}

// 快捷键捕获状态（WR-5）
let keyCaptureAction = null;
let keyCaptureAccelerator = null;

/**
 * 将 keydown 事件转换为 Electron accelerator 字符串（WR-5）
 * @param {KeyboardEvent} e - keydown 事件
 * @returns {string|null} accelerator（如 CmdOrCtrl+Shift+T）；纯修饰键返回 null
 */
function acceleratorFromEvent(e) {
  const key = e.key;
  // 单独按下修饰键不构成快捷键，等待后续按键
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    return null;
  }

  const parts = [];
  if (e.metaKey || e.ctrlKey) parts.push('CmdOrCtrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  // Electron accelerator 的键名映射
  const keyMap = {
    ' ': 'Space',
    '+': 'Plus',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
  };
  let mainKey = keyMap[key] || key;
  if (mainKey.length === 1) {
    mainKey = mainKey.toUpperCase();
  }
  parts.push(mainKey);

  return parts.join('+');
}

/**
 * 编辑快捷键（WR-5）
 * window.prompt() 在 Electron 中不受支持（返回 undefined），
 * 改为自定义按键捕获 dialog，与现有 <dialog> 模态框风格一致。
 * @param {string} action - 操作名称
 */
function editShortcut(action) {
  const name = SHORTCUT_NAMES[action] || action;

  keyCaptureAction = action;
  keyCaptureAccelerator = null;
  elements.shortcutCaptureTitle.textContent = `修改快捷键 - ${name}`;
  elements.keyCaptureBox.textContent = '等待按键...';
  elements.keyCaptureBox.classList.add('capturing');
  elements.saveKeyCaptureBtn.disabled = true;
  elements.shortcutCaptureModal.showModal();
}

/**
 * 处理快捷键捕获 dialog 内的按键
 * @param {KeyboardEvent} e - keydown 事件
 */
function handleKeyCaptureKeydown(e) {
  e.preventDefault();
  e.stopPropagation();

  // Esc 取消捕获
  if (e.key === 'Escape') {
    elements.shortcutCaptureModal.close();
    return;
  }

  const accelerator = acceleratorFromEvent(e);
  if (!accelerator) return;

  keyCaptureAccelerator = accelerator;
  elements.keyCaptureBox.textContent = accelerator;
  elements.keyCaptureBox.classList.remove('capturing');
  elements.saveKeyCaptureBtn.disabled = false;
}

/**
 * 保存捕获的快捷键
 */
async function saveCapturedShortcut() {
  if (!keyCaptureAction || !keyCaptureAccelerator) return;

  await window.realmAPI.setShortcut(keyCaptureAction, keyCaptureAccelerator);
  elements.shortcutCaptureModal.close();
  await refreshShortcutsList();
  showToast('快捷键已更新，重启应用后生效', 'success');
}

/**
 * 恢复默认快捷键
 * @param {string} action - 操作名称
 */
async function resetShortcut(action) {
  // 删除自定义配置，恢复默认
  const shortcuts = await window.realmAPI.getShortcuts();
  const defaultShortcuts = {
    'newTab': 'CmdOrCtrl+T',
    'closeTab': 'CmdOrCtrl+W',
    'nextTab': 'CmdOrCtrl+Shift+]',
    'prevTab': 'CmdOrCtrl+Shift+[',
    'reload': 'CmdOrCtrl+R',
    'back': 'CmdOrCtrl+Left',
    'forward': 'CmdOrCtrl+Right',
  };

  if (defaultShortcuts[action]) {
    await window.realmAPI.setShortcut(action, defaultShortcuts[action]);
    await refreshShortcutsList();
    showToast('快捷键已恢复默认', 'success');
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
 * 从主进程恢复保存的 Tab 列表
 */
async function restoreTabs() {
  const tabs = await window.realmAPI.getTabs();
  const activeTab = await window.realmAPI.getActiveTab();

  if (tabs.length === 0) {
    // 没有保存的 Tab，显示新标签页
    elements.newTabPage.style.display = 'flex';
    return;
  }

  console.log(`[Realm Renderer] 恢复 ${tabs.length} 个 Tab`);

  // 为每个保存的 Tab 创建 DOM 和 webview
  for (const tab of tabs) {
    // 创建 Tab DOM 元素
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tab.id;

    const color = getContainerColor(tab.containerId);
    const colorLine = document.createElement('div');
    colorLine.className = 'tab-color-line';
    colorLine.style.backgroundColor = color;

    const content = document.createElement('div');
    content.className = 'tab-content';

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

    content.appendChild(title);
    tabElement.appendChild(colorLine);
    tabElement.appendChild(content);
    tabElement.appendChild(closeBtn);

    // 添加到 Tab 列表
    elements.tabList.appendChild(tabElement);

    // 存储 Tab 数据（包含 DOM 引用）
    tab.element = tabElement;
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

  // 切换到活动 Tab
  if (activeTab && state.tabs.has(activeTab.id)) {
    await switchTab(activeTab.id);
  } else if (tabs.length > 0) {
    await switchTab(tabs[0].id);
  }
}

/**
 * 初始化应用
 */
async function init() {
  console.log('[Realm Renderer] 初始化...');

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

  // 监听主进程的 Tab 回收事件（WR-4）
  window.realmAPI.onTabRecycled(handleTabRecycled);

  console.log('[Realm Renderer] 初始化完成');
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
  const html = state.containers.map(container => `
    <div class="container-item ${container.id === state.currentContainer ? 'active' : ''}"
         data-container-id="${container.id}">
      <div class="container-dot" style="background-color: ${container.color}"></div>
      <div class="container-info">
        <div class="container-name">${container.icon} ${container.name}</div>
        <div class="container-status">${container.id === state.currentContainer ? '当前' : ''}</div>
      </div>
    </div>
  `).join('');

  elements.containerList.innerHTML = html;

  // 为每个容器项添加点击事件
  document.querySelectorAll('.container-item').forEach(item => {
    item.addEventListener('click', () => {
      const containerId = item.dataset.containerId;
      switchContainer(containerId);
    });
  });
}

/**
 * 渲染容器面板列表
 * 使用事件委托模式，为 panelContainerList 绑定一次 click 监听器
 * 默认容器（id=default）的删除按钮禁用并显示 tooltip
 */
function renderContainerPanelList() {
  const html = state.containers.map(container => {
    const isDefault = container.id === 'default';
    const deleteBtnDisabled = isDefault ? 'disabled' : '';
    const deleteBtnTitle = isDefault ? '默认容器不可删除' : '删除';

    return `
    <div class="panel-container-item ${container.id === state.currentContainer ? 'active' : ''}"
         data-container-id="${container.id}">
      <div class="container-dot" style="background-color: ${container.color}"></div>
      <div class="container-emoji">${container.icon}</div>
      <div class="container-name">${container.name}</div>
      <div class="container-actions">
        <button class="action-btn" data-action="edit" title="编辑">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-btn" data-action="delete" ${deleteBtnDisabled} title="${deleteBtnTitle}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
          </svg>
        </button>
      </div>
      ${container.id === state.currentContainer ? '<div class="check-mark">✓</div>' : ''}
    </div>
  `;
  }).join('');

  elements.panelContainerList.innerHTML = html;
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
 */
async function confirmDeleteContainer() {
  const containerId = state.deletingContainerId;
  if (!containerId) return;

  try {
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
 * setWindowOpenHandler 拦截后转发（D-09：在当前容器新建 Tab）。
 * URL 来自 guest 页面，主进程已做 http(s) 白名单校验，此处纵深防御再校验一次（WR-9）。
 * @param {{url: string, containerId: string|null}} data - 事件数据
 */
function handleOpenUrlInTab(data) {
  if (!data || typeof data.url !== 'string' || !/^https?:\/\//i.test(data.url)) {
    console.warn('[Realm] 拒绝非 http(s) 的新建 Tab 请求:', data && data.url);
    return;
  }

  const containerId = data.containerId || state.currentContainer;
  createTab(containerId, data.url);
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
 * 显示 Cookie 管理对话框
 */
async function showCookiesModal() {
  const current = state.containers.find(c => c.id === state.currentContainer);
  elements.cookiesModalTitle.textContent = current?.name || '未知';

  await refreshCookiesList();
  elements.cookiesModal.showModal();
}

/**
 * 刷新 Cookie 列表
 */
async function refreshCookiesList() {
  const cookies = await window.realmAPI.getContainerCookies(state.currentContainer);

  if (cookies.length === 0) {
    elements.cookiesList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无 Cookie</div>';
    return;
  }

  // 使用 DOM API + textContent 渲染（CR-3 修复）：
  // cookie.name/value/domain 由任意网站设置，是攻击者可控数据，禁止拼入 innerHTML
  elements.cookiesList.innerHTML = '';
  cookies.forEach(cookie => {
    const item = document.createElement('div');
    item.className = 'cookie-item';

    const name = document.createElement('span');
    name.className = 'cookie-name';
    name.textContent = cookie.name;

    const value = document.createElement('span');
    value.className = 'cookie-value';
    value.textContent = cookie.value;

    const domain = document.createElement('span');
    domain.className = 'cookie-domain';
    domain.textContent = cookie.domain;

    item.appendChild(name);
    item.appendChild(value);
    item.appendChild(domain);
    elements.cookiesList.appendChild(item);
  });
}

/**
 * 清除当前容器的所有 Cookie
 */
async function clearContainerCookies() {
  if (confirm('确定要清除当前容器的所有 Cookie 吗？')) {
    await window.realmAPI.clearContainerCookies(state.currentContainer);
    await refreshCookiesList();
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

    try {
      if (state.editingContainerId) {
        // 编辑模式
        await window.realmAPI.updateContainer(state.editingContainerId, {
          name,
          color: state.selectedColor,
          icon: state.selectedIcon,
        });
      } else {
        // 新建模式
        await window.realmAPI.createContainer({
          name,
          color: state.selectedColor,
          icon: state.selectedIcon,
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

  // Cookie 管理按钮
  elements.cookiesBtn.addEventListener('click', showCookiesModal);
  elements.clearCookiesBtn.addEventListener('click', clearContainerCookies);
  elements.refreshCookiesBtn.addEventListener('click', refreshCookiesList);
  elements.closeCookiesModal.addEventListener('click', () => {
    elements.cookiesModal.close();
  });

  // 规则管理按钮
  if (elements.rulesBtn) {
    elements.rulesBtn.addEventListener('click', showRulesModal);
  }

  // 快捷键设置按钮
  if (elements.shortcutsBtn) {
    elements.shortcutsBtn.addEventListener('click', showShortcutsModal);
  }

  // 关闭快捷键设置模态框
  if (elements.closeShortcutsModal) {
    elements.closeShortcutsModal.addEventListener('click', () => {
      elements.shortcutsModal.close();
    });
  }

  // 点击快捷键设置模态框外部关闭
  if (elements.shortcutsModal) {
    elements.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === elements.shortcutsModal) {
        elements.shortcutsModal.close();
      }
    });
  }

  // 快捷键捕获对话框（WR-5）
  if (elements.shortcutCaptureModal) {
    elements.shortcutCaptureModal.addEventListener('keydown', handleKeyCaptureKeydown);
    elements.saveKeyCaptureBtn.addEventListener('click', saveCapturedShortcut);
    elements.cancelKeyCaptureBtn.addEventListener('click', () => {
      elements.shortcutCaptureModal.close();
    });
    // 点击模态框外部取消捕获
    elements.shortcutCaptureModal.addEventListener('click', (e) => {
      if (e.target === elements.shortcutCaptureModal) {
        elements.shortcutCaptureModal.close();
      }
    });
  }

  // URL 输入框回车
  elements.urlInput.addEventListener('keydown', async (e) => {
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
        if (elements.rulesModal) {
          elements.rulesModal.close();
        }
      }
    }
  });

  // 规则管理事件
  if (elements.rulesModal) {
    // 添加规则按钮
    elements.addRuleBtn.addEventListener('click', createRule);

    // 关闭规则模态框
    elements.closeRulesModal.addEventListener('click', () => {
      elements.rulesModal.close();
    });

    // 点击模态框外部关闭
    elements.rulesModal.addEventListener('click', (e) => {
      if (e.target === elements.rulesModal) {
        elements.rulesModal.close();
      }
    });
  }

  // 初始化快捷键监听
  initShortcuts();
}

// 初始化应用
init();

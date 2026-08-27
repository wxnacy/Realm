/**
 * Realm Browser - 设置页面逻辑
 *
 * realm://settings 内部页面的渲染逻辑
 * 负责设置读取、保存、默认浏览器引导、规则管理、快捷键设置
 */

// ==================== 状态管理 ====================

// 页面运行在 webview guest 中，IPC 会被主进程 assertTrustedSender（CR-4）拒绝，
// 因此数据访问走本地 HTTP 服务器的 /api/* 端点。
// API token 由渲染进程创建 webview 时注入 URL 查询参数。
const pageParams = new URLSearchParams(window.location.search);

/**
 * 页面状态对象
 * @type {Object}
 */
const state = {
  /** 当前设置值 */
  settings: {
    historyRetentionDays: 30,
    defaultContainer: 'last-used',
    isDefaultBrowser: false,
    restoreTabsOnLaunch: 'ask',
  },
  /** 容器列表缓存 */
  containers: [],
  /** 开发者模式配置 */
  devMode: {
    enabled: false,
    domains: [],
    retentionDays: 7,
  },
  /** 多媒体播放器配置 */
  mediaPlayer: {
    enabled: false,
    whitelist: [],
  },
  /** Vim 模式配置 */
  vimium: {
    enabled: false,
  },
};

/** API token（来自 URL 查询参数） */
const apiToken = pageParams.get('token') || '';

// ==================== API 调用 ====================

/**
 * 调用设置 HTTP API
 * @param {string} route - API 路由（如 'get'、'update'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function settingsApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/settings/${route}?${params.toString()}`, options);
  if (!res.ok) {
    // 优先使用后端返回的错误详情（如「API Key 不能为空，请设置环境变量」）
    let detail = '';
    try {
      const data = await res.json();
      if (data && data.error) detail = data.error;
    } catch { /* 非 JSON 响应忽略 */ }
    throw new Error(detail || `设置 API 请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 获取容器列表（通过 HTTP API）
 * @returns {Promise<Array>} 容器列表
 */
async function fetchContainers() {
  try {
    const params = new URLSearchParams({ token: apiToken });
    const res = await fetch(`/api/containers/list?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`容器 API 请求失败: ${res.status}`);
    }
    const containers = await res.json();
    state.containers = containers;
    return containers;
  } catch (error) {
    console.error('[Realm] 获取容器列表失败:', error);
    return [];
  }
}

/**
 * 调用规则 HTTP API
 * @param {string} route - API 路由（如 'list'、'create'）
 * @param {Object} [options] - fetch 选项
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function rulesApi(route, options = {}) {
  const params = new URLSearchParams({ token: apiToken });
  const res = await fetch(`/api/rules/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`规则 API 请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 调用快捷键 HTTP API
 * @param {string} route - API 路由（如 'list'、'set'）
 * @param {Object} [options] - fetch 选项
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function shortcutsApi(route, options = {}) {
  const params = new URLSearchParams({ token: apiToken });
  const res = await fetch(`/api/shortcuts/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`快捷键 API 请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 调用开发者模式 HTTP API
 * @param {string} route - API 路由（如 'get-devmode'、'set-devmode'）
 * @param {Object} [options] - fetch 选项
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function devModeApi(route, options = {}) {
  const params = new URLSearchParams({ token: apiToken });
  const res = await fetch(`/api/settings/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`开发者模式 API 请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 调用搜索配置 HTTP API
 * @param {string} route - API 路由（如 'get'、'set'、'verify-key'）
 * @param {Object} [options] - fetch 选项
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function searchConfigApi(route, options = {}) {
  const params = new URLSearchParams({ token: apiToken });
  const res = await fetch(`/api/search-config/${route}?${params.toString()}`, options);
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      if (data && data.error) detail = data.error;
    } catch { /* 非 JSON 响应忽略 */ }
    throw new Error(detail || `搜索配置 API 请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 调用凭据管理 HTTP API
 * @param {string} route - API 路由（如 'list'、'search'、'delete'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function credentialsApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/credentials/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`凭据 API 请求失败: ${res.status}`);
  }
  return res.json();
}

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
const elements = {
  // 通用设置
  defaultBrowserStatus: document.getElementById('defaultBrowserStatus'),
  setDefaultBrowserBtn: document.getElementById('setDefaultBrowserBtn'),
  retentionDays: document.getElementById('retentionDays'),
  defaultContainer: document.getElementById('defaultContainer'),
  restoreTabsOnLaunch: document.getElementById('restoreTabsOnLaunch'),
  showBookmarksBar: document.getElementById('showBookmarksBar'),
  themeSelect: document.getElementById('themeSelect'),
  toast: document.getElementById('toast'),

  // 侧边栏
  sidebarVersion: document.getElementById('sidebarVersion'),

  // 规则管理
  addRuleBtn: document.getElementById('addRuleBtn'),
  importRulesBtn: document.getElementById('importRulesBtn'),
  exportRulesBtn: document.getElementById('exportRulesBtn'),
  rulesAddForm: document.getElementById('rulesAddForm'),
  ruleContainerSelect: document.getElementById('ruleContainerSelect'),
  rulePatternInput: document.getElementById('rulePatternInput'),
  confirmAddRuleBtn: document.getElementById('confirmAddRuleBtn'),
  cancelAddRuleBtn: document.getElementById('cancelAddRuleBtn'),
  rulesList: document.getElementById('rulesList'),
  rulesFileInput: document.getElementById('rulesFileInput'),

  // 快捷键设置
  shortcutsList: document.getElementById('shortcutsList'),
  resetAllShortcutsBtn: document.getElementById('resetAllShortcutsBtn'),

  // 快捷键捕获对话框
  shortcutCaptureModal: document.getElementById('shortcutCaptureModal'),
  shortcutCaptureTitle: document.getElementById('shortcutCaptureTitle'),
  keyCaptureBox: document.getElementById('keyCaptureBox'),
  cancelKeyCaptureBtn: document.getElementById('cancelKeyCaptureBtn'),
  saveKeyCaptureBtn: document.getElementById('saveKeyCaptureBtn'),

  // Vim 模式
  vimiumEnabled: document.getElementById('vimiumEnabled'),
  vimiumShortcutsTable: document.getElementById('vimiumShortcutsTable'),

  // 关于页面
  aboutVersion: document.getElementById('aboutVersion'),
  aboutIcon: document.getElementById('aboutIcon'),

  // 多媒体设置
  mediaPlayerToggle: document.getElementById('mediaPlayerToggle'),
  mediaPlayerSection: document.getElementById('mediaPlayerSection'),
  whitelistDomainInput: document.getElementById('whitelistDomainInput'),
  addWhitelistDomainBtn: document.getElementById('addWhitelistDomainBtn'),
  whitelistTags: document.getElementById('whitelistTags'),
  whitelistHint: document.getElementById('whitelistHint'),

  // 开发者模式
  devModeToggle: document.getElementById('devModeToggle'),
  devModeSection: document.getElementById('devModeSection'),
  devRetentionDays: document.getElementById('devRetentionDays'),
  domainInput: document.getElementById('domainInput'),
  addDomainBtn: document.getElementById('addDomainBtn'),
  domainList: document.getElementById('domainList'),
  queueStatus: document.getElementById('queueStatus'),
  queueCount: document.getElementById('queueCount'),
  queueLastFlush: document.getElementById('queueLastFlush'),
  devrequestsLink: document.getElementById('devrequestsLink'),
};

// ==================== 页面切换 ====================

/**
 * 切换设置页面
 * @param {string} pageName - 页面名称（general、rules、shortcuts、about）
 */
function switchSettingsPage(pageName) {
  // 隐藏所有内容区域
  document.querySelectorAll('.settings-section').forEach(section => {
    section.style.display = 'none';
  });

  // 显示目标内容区域
  const targetSection = document.getElementById(`settings-${pageName}`);
  if (targetSection) {
    targetSection.style.display = 'block';
  }

  // 更新侧边栏激活状态
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeItem = document.querySelector(`.sidebar-item[data-page="${CSS.escape(pageName)}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }

  // 切换到特定页面时刷新数据
  if (pageName === 'rules') {
    refreshRulesList();
  } else if (pageName === 'shortcuts') {
    refreshShortcutsList();
  } else if (pageName === 'devmode') {
    loadDevModeSettings();
    startQueueStatusPolling();
  } else if (pageName === 'ai-assistant') {
    loadAISettings();
    loadSearchConfig();
  } else if (pageName === 'multimedia') {
    loadMultimediaSettings();
  } else if (pageName === 'autofill') {
    loadCredentials();
    loadAddress();
  } else if (pageName === 'vimium') {
    renderVimiumShortcuts();
  } else {
    // 离开开发者模式页面时停止轮询
    stopQueueStatusPolling();
  }
}

// ==================== UI 更新函数 ====================

/**
 * 显示 Toast 提示
 * @param {string} message - 提示消息
 * @param {string} [type] - 类型（'error' 时红色标识并延长显示时间）
 */
function showToast(message, type) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden', 'toast-error');
  if (type === 'error') {
    elements.toast.classList.add('toast-error');
  }
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, type === 'error' ? 4000 : 2000);
}

/**
 * 更新默认浏览器状态
 * @param {boolean} isDefault - 是否为默认浏览器
 */
function updateDefaultBrowserStatus(isDefault) {
  if (isDefault) {
    elements.defaultBrowserStatus.textContent = 'Realm 已是默认浏览器';
    elements.setDefaultBrowserBtn.style.display = 'none';
  } else {
    elements.defaultBrowserStatus.textContent = 'Realm 不是默认浏览器';
    elements.setDefaultBrowserBtn.style.display = 'block';
  }
}

/**
 * 渲染容器选项（使用 textContent 防止 XSS）
 * @param {Array} containers - 容器列表
 * @param {string} selectedValue - 当前选中的值
 */
function renderContainerOptions(containers, selectedValue) {
  // 清空现有选项
  elements.defaultContainer.innerHTML = '';

  // 添加默认选项（'last-used' 哨兵值，避免与内置 'default' 容器 id 冲突）
  const defaultOption = document.createElement('option');
  defaultOption.value = 'last-used';
  defaultOption.textContent = '使用上次打开的容器';
  elements.defaultContainer.appendChild(defaultOption);

  // 添加容器选项
  containers.forEach(container => {
    const option = document.createElement('option');
    option.value = container.id;
    option.textContent = container.name;
    elements.defaultContainer.appendChild(option);
  });

  // 设置选中状态
  elements.defaultContainer.value = selectedValue || 'last-used';
}

// ==================== 设置加载和保存 ====================

/**
 * 加载设置
 */
async function loadSettings() {
  try {
    // 并行加载设置和容器列表
    const [settings, isDefault, containers] = await Promise.all([
      settingsApi('get'),
      settingsApi('is-default-browser').then(res => res.isDefault).catch(() => false),
      fetchContainers(),
    ]);

    // 更新状态
    state.settings = { ...state.settings, ...settings };

    // 更新 UI
    updateDefaultBrowserStatus(isDefault);
    elements.retentionDays.value = state.settings.historyRetentionDays || 30;
    renderContainerOptions(containers, state.settings.defaultContainer);
    elements.restoreTabsOnLaunch.value = state.settings.restoreTabsOnLaunch || 'ask';

    // 收藏栏显示状态（默认显示）
    if (elements.showBookmarksBar) {
      const bookmarksBarVisible = state.settings.bookmarksBar?.visible !== false;
      elements.showBookmarksBar.checked = bookmarksBarVisible;
    }

    // 主题设置（默认浅色）
    if (elements.themeSelect) {
      const theme = state.settings.theme || 'light';
      elements.themeSelect.value = theme;
      applyTheme(theme);
    }

    // 多媒体播放器设置
    if (settings.mediaPlayer) {
      state.mediaPlayer = {
        enabled: settings.mediaPlayer.enabled || false,
        whitelist: settings.mediaPlayer.whitelist || [],
      };
    }

    // Vim 模式设置
    if (settings.vimium) {
      state.vimium = {
        enabled: settings.vimium.enabled || false,
      };
    }
    if (elements.vimiumEnabled) {
      elements.vimiumEnabled.checked = state.vimium.enabled;
    }

    // 更新版本号
    const versionRes = await settingsApi('version').catch(() => null);
    const version = (versionRes && versionRes.version) || '--';
    elements.sidebarVersion.textContent = `版本: ${version}`;
    elements.aboutVersion.textContent = `版本: ${version}`;

    // 设置关于页图标（走带 token 的 API 取应用图标）
    elements.aboutIcon.src = `/api/settings/icon?token=${encodeURIComponent(apiToken)}`;

  } catch (error) {
    console.error('[Realm] 加载设置失败:', error);
    showToast('加载设置失败');
  }
}

/**
 * 保存设置
 * @param {string} key - 设置键
 * @param {*} value - 设置值
 */
async function saveSettings(key, value) {
  try {
    await settingsApi('update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    state.settings[key] = value;
    showToast('设置已保存');
  } catch (error) {
    console.error('[Realm] 保存设置失败:', error);
    showToast('保存失败，请重试');
  }
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

// ==================== 规则管理 ====================

/**
 * 刷新规则列表
 */
async function refreshRulesList() {
  try {
    const rules = await rulesApi('list');
    renderRulesList(rules);
  } catch (error) {
    console.error('[Realm] 刷新规则列表失败:', error);
    showToast('加载规则失败');
  }
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

  // WR-13：DOM 构建 + textContent。规则 pattern 为用户输入，拼入 innerHTML 构成 XSS 注入面
  elements.rulesList.innerHTML = '';

  rules.forEach(rule => {
    const container = state.containers.find(c => c.id === rule.containerId);
    const containerName = container ? container.name : rule.containerId;

    const item = document.createElement('div');
    item.className = 'rule-item';
    item.dataset.ruleId = rule.id;
    item.draggable = true;

    // 拖拽手柄
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '⋮⋮';

    const info = document.createElement('div');
    info.className = 'rule-info';

    const pattern = document.createElement('span');
    pattern.className = 'rule-pattern';
    pattern.textContent = rule.pattern;

    const arrow = document.createElement('span');
    arrow.className = 'rule-arrow';
    arrow.textContent = '→';

    const containerSpan = document.createElement('span');
    containerSpan.className = 'rule-container';
    containerSpan.textContent = containerName;

    info.appendChild(pattern);
    info.appendChild(arrow);
    info.appendChild(containerSpan);

    const actions = document.createElement('div');
    actions.className = 'rule-actions';

    // Toggle Switch 组件
    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'toggle-switch';
    toggleSwitch.title = rule.enabled ? '禁用' : '启用';

    const toggleTrack = document.createElement('div');
    toggleTrack.className = 'toggle-track' + (rule.enabled ? ' active' : '');

    const toggleThumb = document.createElement('div');
    toggleThumb.className = 'toggle-thumb';

    toggleTrack.appendChild(toggleThumb);
    toggleSwitch.appendChild(toggleTrack);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.title = '删除';
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>';

    actions.appendChild(toggleSwitch);
    actions.appendChild(deleteBtn);
    item.appendChild(dragHandle);
    item.appendChild(info);
    item.appendChild(actions);
    elements.rulesList.appendChild(item);

    // 绑定 toggle 点击事件
    toggleSwitch.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const latest = await rulesApi('list');
        const current = latest.find(r => r.id === rule.id);
        if (current) {
          await rulesApi('update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruleId: rule.id, updates: { enabled: !current.enabled } }),
          });
          await refreshRulesList();
        }
      } catch (error) {
        console.error('[Realm] 切换规则状态失败:', error);
        showToast('操作失败');
      }
    });

    // 绑定 delete 点击事件
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await rulesApi('delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruleId: rule.id }),
        });
        await refreshRulesList();
      } catch (error) {
        console.error('[Realm] 删除规则失败:', error);
        showToast('删除失败');
      }
    });

    // 绑定拖拽事件
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
  });
}

// 拖拽状态
let draggedItem = null;

/**
 * 处理拖拽开始
 * @param {DragEvent} e - 拖拽事件
 */
function handleDragStart(e) {
  draggedItem = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.ruleId);
}

/**
 * 处理拖拽悬停
 * @param {DragEvent} e - 拖拽事件
 */
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // 清除所有指示线
  const items = elements.rulesList.querySelectorAll('.rule-item');
  items.forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  // 计算鼠标位置决定插入目标的上方或下方
  const rect = this.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  if (e.clientY < midY) {
    this.classList.add('drag-over-top');
  } else {
    this.classList.add('drag-over-bottom');
  }
}

/**
 * 处理拖拽放下
 * @param {DragEvent} e - 拖拽事件
 */
function handleDrop(e) {
  e.preventDefault();

  if (draggedItem === this) return;

  // 清除所有指示线
  const items = elements.rulesList.querySelectorAll('.rule-item');
  items.forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  // 计算插入位置
  const rect = this.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  if (e.clientY < midY) {
    this.parentNode.insertBefore(draggedItem, this);
  } else {
    this.parentNode.insertBefore(draggedItem, this.nextSibling);
  }
}

/**
 * 处理拖拽结束
 */
async function handleDragEnd() {
  this.classList.remove('dragging');
  draggedItem = null;

  // 清除所有指示线
  const items = elements.rulesList.querySelectorAll('.rule-item');
  items.forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  // 收集新顺序
  const newOrder = Array.from(elements.rulesList.querySelectorAll('.rule-item'))
    .map(item => item.dataset.ruleId);

  // 调用 API 同步到主进程
  try {
    await rulesApi('reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: newOrder }),
    });
  } catch (error) {
    console.error('[Realm] 保存规则顺序失败:', error);
    showToast('保存顺序失败');
  }
}

/**
 * 创建新规则
 */
async function createRule() {
  const containerId = elements.ruleContainerSelect.value;
  const pattern = elements.rulePatternInput.value.trim();

  if (!pattern) {
    showToast('请输入匹配模式');
    return;
  }

  try {
    await rulesApi('create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId, pattern }),
    });
    elements.rulePatternInput.value = '';
    elements.rulesAddForm.style.display = 'none';
    elements.addRuleBtn.style.display = 'block';
    await refreshRulesList();
    showToast('规则已添加');
  } catch (error) {
    console.error('[Realm] 创建规则失败:', error);
    showToast('创建规则失败');
  }
}

/**
 * 导入规则
 */
async function importRules() {
  // 触发文件选择
  elements.rulesFileInput.click();
}

/**
 * 处理文件选择完成
 *
 * 接受两种文件格式：裸规则数组（[...]）或应用自身导出产物
 * （{ rules: [...], exportedAt }）。导入失败时以 toast 展示服务端
 * 返回的具体原因（格式错误、全部重复等），不再出现「已导入 undefined
 * 条规则」的假成功提示。文件输入在 finally 块重置，保证所有退出路径
 * 都能再次触发 change 事件。
 */
async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rulesData = JSON.parse(text);
    const rules = Array.isArray(rulesData) ? rulesData : rulesData.rules;

    if (!Array.isArray(rules)) {
      showToast('文件格式不正确：缺少 rules 数组');
      return;
    }

    const result = await rulesApi('import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    });

    if (result.success === false) {
      showToast(result.message || '导入失败');
      return;
    }

    const skippedText = result.skipped > 0 ? `，跳过 ${result.skipped} 条重复` : '';
    showToast(`已导入 ${result.count} 条规则${skippedText}`);
    await refreshRulesList();
  } catch (error) {
    console.error('[Realm] 导入规则失败:', error);
    showToast('导入失败，请检查文件格式');
  } finally {
    // 清空文件输入，保证所有退出路径都能再次触发 change 事件
    e.target.value = '';
  }
}

/**
 * 导出规则
 */
async function exportRules() {
  try {
    const data = await rulesApi('export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'realm-rules.json';
    a.click();
    URL.revokeObjectURL(url);
    const exportedRules = Array.isArray(data) ? data : (data.rules || []);
    showToast(`已导出 ${exportedRules.length} 条规则`);
  } catch (error) {
    console.error('[Realm] 导出规则失败:', error);
    showToast('导出失败');
  }
}

// ==================== 快捷键设置 ====================

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
  'bookmark': '收藏此页面',
  'openSettings': '打开设置页面',
  'openHistory': '打开历史记录',
  'openFavorites': '打开收藏夹',
  'toggleSidebar': '切换容器侧边栏',
  'focusPage': '聚焦页面',
};

/**
 * 快捷键分组配置
 */
const SHORTCUT_GROUPS = {
  '标签页操作': ['newTab', 'closeTab', 'nextTab', 'prevTab'],
  '导航操作': ['reload', 'back', 'forward'],
  '收藏': ['bookmark', 'openFavorites'],
  '浏览': ['openHistory'],
  '其他': ['openSettings', 'toggleSidebar', 'focusPage'],
};

/**
 * 刷新快捷键列表
 */
async function refreshShortcutsList() {
  try {
    const shortcuts = await shortcutsApi('list');
    renderShortcutsList(shortcuts);
  } catch (error) {
    console.error('[Realm] 刷新快捷键列表失败:', error);
    showToast('加载快捷键失败');
  }
}

/**
 * 渲染快捷键列表（按功能分组）
 * @param {Object} shortcuts - 快捷键配置对象
 */
function renderShortcutsList(shortcuts) {
  // WR-13：DOM 构建 + textContent。accelerator 来自用户按键捕获，禁止拼入 innerHTML
  elements.shortcutsList.innerHTML = '';

  // 按分组渲染
  Object.entries(SHORTCUT_GROUPS).forEach(([groupName, actions]) => {
    // 分组标题
    const groupTitle = document.createElement('h3');
    groupTitle.className = 'shortcut-group-title';
    groupTitle.textContent = groupName;
    elements.shortcutsList.appendChild(groupTitle);

    // 渲染该组的快捷键项
    actions.forEach(action => {
      const accelerator = shortcuts[action];
      if (!accelerator) return;

      const name = SHORTCUT_NAMES[action] || action;

      const item = document.createElement('div');
      item.className = 'shortcut-item';
      item.dataset.action = action;

      const info = document.createElement('div');
      info.className = 'shortcut-info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'shortcut-name';
      nameSpan.textContent = name;

      const keySpan = document.createElement('span');
      keySpan.className = 'shortcut-key';
      keySpan.textContent = accelerator;

      info.appendChild(nameSpan);
      info.appendChild(keySpan);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'shortcut-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'action-btn';
      editBtn.dataset.action = 'edit';
      editBtn.title = '修改';
      editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

      const resetBtn = document.createElement('button');
      resetBtn.className = 'action-btn';
      resetBtn.dataset.action = 'reset';
      resetBtn.title = '恢复默认';
      resetBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path></svg>';

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(resetBtn);
      item.appendChild(info);
      item.appendChild(actionsDiv);
      elements.shortcutsList.appendChild(item);

      editBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await editShortcut(action);
      });
      resetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await resetShortcut(action);
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

  try {
    await shortcutsApi('set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: keyCaptureAction, accelerator: keyCaptureAccelerator }),
    });
    elements.shortcutCaptureModal.close();
    await refreshShortcutsList();
    showToast('快捷键已更新');
  } catch (error) {
    console.error('[Realm] 保存快捷键失败:', error);
    showToast('保存失败');
  }
}

/**
 * 恢复默认快捷键
 * 默认值唯一来源是主进程 shortcut-manager 的 DEFAULT_SHORTCUTS；
 * 删除自定义覆盖后 getShortcuts 的合并逻辑自动回落到默认，无需在此硬编码副本。
 * @param {string} action - 操作名称
 */
async function resetShortcut(action) {
  try {
    const result = await shortcutsApi('reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (result.success) {
      await refreshShortcutsList();
      showToast('快捷键已恢复默认');
    } else {
      showToast('未知的快捷键操作');
    }
  } catch (error) {
    console.error('[Realm] 重置快捷键失败:', error);
    showToast('重置失败');
  }
}

/**
 * 重置全部快捷键
 */
async function resetAllShortcuts() {
  if (!confirm('确定要重置全部快捷键吗？此操作不可撤销。')) {
    return;
  }

  try {
    // 获取当前快捷键列表，逐个重置
    const shortcuts = await shortcutsApi('list');
    const actions = Object.keys(shortcuts);

    for (const action of actions) {
      await shortcutsApi('reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    }

    await refreshShortcutsList();
    showToast('全部快捷键已重置');
  } catch (error) {
    console.error('[Realm] 重置全部快捷键失败:', error);
    showToast('重置失败');
  }
}

// ==================== 事件处理 ====================

/**
 * 初始化事件监听器
 */
function setupEventListeners() {
  // 侧边栏导航
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      switchSettingsPage(item.dataset.page);
    });
  });

  // 版本号点击跳转关于页面
  elements.sidebarVersion.addEventListener('click', () => {
    switchSettingsPage('about');
  });

  // 设置默认浏览器按钮
  elements.setDefaultBrowserBtn.addEventListener('click', async () => {
    try {
      const result = await settingsApi('set-default-browser', { method: 'POST' });
      if (result.success) {
        // macOS 系统弹框是异步确认的，不能立即标记成功；
        // 提示用户确认，延迟后重新查询真实状态
        showToast('请在系统弹窗中确认');
        setTimeout(async () => {
          try {
            const res = await settingsApi('is-default-browser');
            updateDefaultBrowserStatus(res.isDefault);
          } catch (err) {
            console.error('[Realm] 查询默认浏览器状态失败:', err);
          }
        }, 3000);
      } else {
        showToast('设置失败，请重试');
      }
    } catch (error) {
      console.error('[Realm] 设置默认浏览器失败:', error);
      showToast('设置失败，请重试');
    }
  });

  // 历史记录保留天数变更
  elements.retentionDays.addEventListener('change', () => {
    const value = parseInt(elements.retentionDays.value, 10);
    saveSettings('historyRetentionDays', value);
  });

  // 默认容器变更
  elements.defaultContainer.addEventListener('change', () => {
    const value = elements.defaultContainer.value;
    saveSettings('defaultContainer', value);
  });

  // 启动时恢复标签页变更
  elements.restoreTabsOnLaunch.addEventListener('change', () => {
    const value = elements.restoreTabsOnLaunch.value;
    saveSettings('restoreTabsOnLaunch', value);
  });

  // 收藏栏显示/隐藏切换
  if (elements.showBookmarksBar) {
    elements.showBookmarksBar.addEventListener('change', () => {
      const visible = elements.showBookmarksBar.checked;
      // 保存设置到主进程
      saveSettings('bookmarksBar.visible', visible);
      // 通过 API 通知主进程切换收藏栏显示状态
      const params = new URLSearchParams({ token: apiToken });
      fetch(`/api/bookmarks-bar/toggle?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      }).catch(err => console.error('[Realm] 切换收藏栏失败:', err));
    });
  }

  // 主题切换
  if (elements.themeSelect) {
    elements.themeSelect.addEventListener('change', async (e) => {
      const theme = e.target.value;
      await saveSettings('theme', theme);
      applyTheme(theme);
    });

    // 监听系统主题变化（当选择"跟随系统"时）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.settings.theme === 'system') {
        applyTheme('system');
      }
    });
  }

  // Vim 模式开关
  if (elements.vimiumEnabled) {
    elements.vimiumEnabled.addEventListener('change', () => {
      const enabled = elements.vimiumEnabled.checked;
      state.vimium.enabled = enabled;
      saveSettings('vimium.enabled', enabled);
    });
  }

  // 规则管理事件
  elements.addRuleBtn.addEventListener('click', () => {
    elements.rulesAddForm.style.display = 'flex';
    elements.addRuleBtn.style.display = 'none';
    // 填充容器选项
    elements.ruleContainerSelect.innerHTML = '';
    state.containers.forEach(container => {
      const option = document.createElement('option');
      option.value = container.id;
      // 符号图标在 select 中降级显示名称
      option.textContent = container.name;
      elements.ruleContainerSelect.appendChild(option);
    });
  });

  elements.cancelAddRuleBtn.addEventListener('click', () => {
    elements.rulesAddForm.style.display = 'none';
    elements.addRuleBtn.style.display = 'block';
    elements.rulePatternInput.value = '';
  });

  elements.confirmAddRuleBtn.addEventListener('click', createRule);

  elements.importRulesBtn.addEventListener('click', importRules);
  elements.exportRulesBtn.addEventListener('click', exportRules);
  elements.rulesFileInput.addEventListener('change', handleFileSelect);

  // 快捷键设置事件
  elements.resetAllShortcutsBtn.addEventListener('click', resetAllShortcuts);

  // 快捷键捕获对话框事件
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

  // ==================== 开发者模式事件 ====================

  // 开发者模式开关（div-based toggle，使用 click 事件）
  if (elements.devModeToggle) {
    elements.devModeToggle.addEventListener('click', () => {
      const newState = !state.devMode.enabled;
      saveDevModeEnabled(newState);
    });
  }

  // 添加域名按钮
  if (elements.addDomainBtn) {
    elements.addDomainBtn.addEventListener('click', () => {
      if (elements.domainInput) {
        addDomain(elements.domainInput.value);
      }
    });
  }

  // 域名输入框回车
  if (elements.domainInput) {
    elements.domainInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDomain(elements.domainInput.value);
      }
    });
  }

  // 查看抓取请求链接 — 在新 tab 打开 realm://devrequests
  if (elements.devrequestsLink) {
    elements.devrequestsLink.addEventListener('click', (e) => {
      e.preventDefault();
      // 设置页本身由 realmUrlToHttp 注入 container 参数，直接复用
      const containerParam = pageParams.get('container') || 'default';
      window.open(`realm://devrequests?container=${containerParam}`, '_blank');
    });
  }

  // 保留天数变更
  if (elements.devRetentionDays) {
    elements.devRetentionDays.addEventListener('change', async () => {
      const days = parseInt(elements.devRetentionDays.value, 10);
      try {
        await devModeApi('set-dev-retention', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days }),
        });
        state.devMode.retentionDays = days;
        showToast('保留天数已更新');
      } catch (error) {
        console.error('[Realm] 保存保留天数失败:', error);
        showToast('保存失败，请重试');
      }
    });
  }

  // ==================== 多媒体设置事件 ====================

  // 多媒体播放器开关（div-based toggle，使用 click 事件）
  if (elements.mediaPlayerToggle) {
    elements.mediaPlayerToggle.addEventListener('click', () => {
      const newState = !state.mediaPlayer.enabled;
      saveMediaPlayerEnabled(newState);
    });
  }

  // 添加白名单域名按钮
  if (elements.addWhitelistDomainBtn) {
    elements.addWhitelistDomainBtn.addEventListener('click', () => {
      if (elements.whitelistDomainInput) {
        addWhitelistDomain(elements.whitelistDomainInput.value);
      }
    });
  }

  // 白名单域名输入框回车
  if (elements.whitelistDomainInput) {
    elements.whitelistDomainInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWhitelistDomain(elements.whitelistDomainInput.value);
      }
    });
  }
}

// ==================== 开发者模式 ====================

/** @type {NodeJS.Timeout|null} 队列状态轮询定时器 */
let queueStatusTimer = null;

/**
 * 加载开发者模式配置
 */
async function loadDevModeSettings() {
  try {
    const config = await devModeApi('get-devmode');
    state.devMode = {
      enabled: config.enabled || false,
      domains: config.domains || [],
      retentionDays: config.retentionDays || 7,
    };

    // 更新 UI
    updateDevModeUI(state.devMode.enabled);
    renderDomainList();

    // 更新保留天数选择
    if (elements.devRetentionDays) {
      elements.devRetentionDays.value = state.devMode.retentionDays;
    }
  } catch (error) {
    console.error('[Realm] 加载开发者模式配置失败:', error);
    showToast('加载开发者模式配置失败');
  }
}

/**
 * 保存开发者模式开关状态
 * @param {boolean} enabled - 是否启用
 */
async function saveDevModeEnabled(enabled) {
  try {
    await devModeApi('set-devmode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    state.devMode.enabled = enabled;
    updateDevModeUI(enabled);
    showToast(enabled ? '开发者模式已启用' : '开发者模式已禁用');
  } catch (error) {
    console.error('[Realm] 保存开发者模式开关失败:', error);
    showToast('保存失败，请重试');
    // 恢复 toggle 状态（div-based toggle 使用 classList）
    updateDevModeUI(!enabled);
  }
}

/**
 * 添加抓取域名
 * @param {string} domain - 域名
 */
async function addDomain(domain) {
  const trimmed = domain.trim().toLowerCase();

  // 验证
  if (!trimmed) {
    showToast('请输入域名');
    return;
  }

  if (/\s/.test(trimmed) || /[^\w.-]/.test(trimmed)) {
    showToast('域名包含非法字符');
    highlightInputError(elements.domainInput);
    return;
  }

  if (!isValidDomain(trimmed)) {
    showToast('域名格式不合法，示例: example.com');
    highlightInputError(elements.domainInput);
    return;
  }

  if (state.devMode.domains.includes(trimmed)) {
    showToast('域名已存在');
    highlightInputError(elements.domainInput);
    return;
  }

  try {
    const result = await devModeApi('add-devdomain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: trimmed }),
    });

    if (result.success) {
      state.devMode.domains.push(trimmed);
      renderDomainList();
      if (elements.domainInput) {
        elements.domainInput.value = '';
      }
      showToast(`已添加域名: ${trimmed}`);
    } else {
      showToast(result.message || '添加失败');
    }
  } catch (error) {
    console.error('[Realm] 添加域名失败:', error);
    showToast('添加失败，请重试');
  }
}

/**
 * 移除抓取域名
 * @param {string} domain - 域名
 */
async function removeDomain(domain) {
  try {
    const result = await devModeApi('remove-devdomain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });

    if (result.success) {
      state.devMode.domains = state.devMode.domains.filter(d => d !== domain);
      renderDomainList();
      showToast(`已移除域名: ${domain}`);
    } else {
      showToast(result.message || '移除失败');
    }
  } catch (error) {
    console.error('[Realm] 移除域名失败:', error);
    showToast('移除失败，请重试');
  }
}

/**
 * 渲染域名列表
 */
function renderDomainList() {
  if (!elements.domainList) return;

  elements.domainList.innerHTML = '';

  if (state.devMode.domains.length === 0) {
    elements.domainList.innerHTML = '<div class="domain-empty">暂无监控域名</div>';
    return;
  }

  state.devMode.domains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `
      <span class="domain-text">${escapeHtml(domain)}</span>
      <button class="btn-icon domain-remove" data-domain="${escapeHtml(domain)}" title="移除">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // 绑定删除事件
    const removeBtn = item.querySelector('.domain-remove');
    removeBtn.addEventListener('click', () => removeDomain(domain));

    elements.domainList.appendChild(item);
  });
}

/**
 * 更新开发者模式 UI 状态
 * @param {boolean} enabled - 是否启用
 */
function updateDevModeUI(enabled) {
  // div-based toggle：通过 active class 控制视觉状态
  if (elements.devModeToggle) {
    if (enabled) {
      elements.devModeToggle.classList.add('active');
    } else {
      elements.devModeToggle.classList.remove('active');
    }
  }

  // 配置区域禁用/启用（通过 CSS class 控制）
  if (elements.devModeSection) {
    if (enabled) {
      elements.devModeSection.classList.remove('disabled');
    } else {
      elements.devModeSection.classList.add('disabled');
    }
  }
}

/**
 * 启动队列状态轮询
 */
function startQueueStatusPolling() {
  stopQueueStatusPolling();
  updateQueueStatus();
  queueStatusTimer = setInterval(updateQueueStatus, 2000);
}

/**
 * 停止队列状态轮询
 */
function stopQueueStatusPolling() {
  if (queueStatusTimer) {
    clearInterval(queueStatusTimer);
    queueStatusTimer = null;
  }
}

/**
 * 更新队列状态显示
 */
async function updateQueueStatus() {
  try {
    const stats = await devModeApi('devqueue-stats');

    if (elements.queueCount) {
      elements.queueCount.textContent = stats.pending || 0;

      // 颜色编码
      const pending = stats.pending || 0;
      elements.queueCount.className = 'devmode-queue-count';
      if (pending > 500) {
        elements.queueCount.classList.add('queue-danger');
      } else if (pending > 100) {
        elements.queueCount.classList.add('queue-warning');
      } else {
        elements.queueCount.classList.add('queue-normal');
      }
    }

    if (elements.queueLastFlush && stats.lastFlush) {
      const date = new Date(stats.lastFlush);
      elements.queueLastFlush.textContent = date.toLocaleTimeString();
    }
  } catch (error) {
    // 静默失败，不打扰用户
    console.error('[Realm] 获取队列状态失败:', error);
  }
}

/**
 * 高亮输入框错误状态（2秒后恢复）
 * @param {HTMLElement} input - 输入框元素
 */
function highlightInputError(input) {
  if (!input) return;
  input.style.borderColor = 'var(--color-danger, #ff4444)';
  setTimeout(() => {
    input.style.borderColor = '';
  }, 2000);
}

/**
 * HTML 转义（防 XSS）
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 多媒体设置 ====================

/**
 * 加载多媒体播放器设置
 * 从 electron-store 读取 mediaPlayer.enabled 和 mediaPlayer.whitelist
 */
async function loadMultimediaSettings() {
  try {
    const settings = await settingsApi('get');
    const mediaPlayer = settings.mediaPlayer || {};
    state.mediaPlayer = {
      enabled: mediaPlayer.enabled || false,
      whitelist: mediaPlayer.whitelist || [],
    };

    updateMediaPlayerUI(state.mediaPlayer.enabled);
    renderWhitelistTags();
  } catch (error) {
    console.error('[Realm] 加载多媒体设置失败:', error);
    showToast('加载多媒体设置失败');
  }
}

/**
 * 保存多媒体播放器开关状态
 * @param {boolean} enabled - 是否启用
 */
async function saveMediaPlayerEnabled(enabled) {
  try {
    await settingsApi('update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'mediaPlayer.enabled': enabled }),
    });
    state.mediaPlayer.enabled = enabled;
    updateMediaPlayerUI(enabled);
    showToast(enabled ? '多媒体功能已启用' : '多媒体功能已禁用');
  } catch (error) {
    console.error('[Realm] 保存多媒体播放器开关失败:', error);
    showToast('保存失败，请重试');
  }
}

/**
 * 更新多媒体播放器 UI 状态
 * @param {boolean} enabled - 是否启用
 */
function updateMediaPlayerUI(enabled) {
  // div-based toggle：通过 active class 控制视觉状态
  if (elements.mediaPlayerToggle) {
    if (enabled) {
      elements.mediaPlayerToggle.classList.add('active');
    } else {
      elements.mediaPlayerToggle.classList.remove('active');
    }
  }

  // 白名单配置区域禁用/启用（通过 CSS class 控制）
  if (elements.mediaPlayerSection) {
    if (enabled) {
      elements.mediaPlayerSection.classList.remove('disabled');
    } else {
      elements.mediaPlayerSection.classList.add('disabled');
    }
  }
}

/**
 * 校验域名结构合法性
 * @param {string} domain - 域名
 * @returns {boolean} 是否合法
 */
function isValidDomain(domain) {
  // 至少含一个点（拒绝裸词如 test、com）
  if (!domain.includes('.')) return false;
  // 以点分割后每段非空（拒绝 a..b、.com、example.com.）
  const parts = domain.split('.');
  if (parts.some((part) => !part)) return false;
  // 每段不以连字符开头或结尾（拒绝 -a.com、a-.com）
  if (parts.some((part) => part.startsWith('-') || part.endsWith('-'))) return false;
  return true;
}

/**
 * 添加白名单域名
 * @param {string} domain - 域名
 */
async function addWhitelistDomain(domain) {
  const trimmed = domain.trim().toLowerCase();

  // 验证
  if (!trimmed) {
    showToast('请输入域名');
    return;
  }

  if (/[^\w.\-]/.test(trimmed)) {
    showToast('域名包含非法字符');
    highlightInputError(elements.whitelistDomainInput);
    return;
  }

  if (!isValidDomain(trimmed)) {
    showToast('域名格式不合法，示例: example.com');
    highlightInputError(elements.whitelistDomainInput);
    return;
  }

  if (state.mediaPlayer.whitelist.includes(trimmed)) {
    showToast('域名已存在');
    highlightInputError(elements.whitelistDomainInput);
    return;
  }

  try {
    const newList = [...state.mediaPlayer.whitelist, trimmed];
    await settingsApi('update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'mediaPlayer.whitelist': newList }),
    });
    state.mediaPlayer.whitelist = newList;
    renderWhitelistTags();
    if (elements.whitelistDomainInput) {
      elements.whitelistDomainInput.value = '';
    }
    showToast(`已添加域名: ${trimmed}`);
  } catch (error) {
    console.error('[Realm] 添加白名单域名失败:', error);
    showToast('添加失败，请重试');
  }
}

/**
 * 移除白名单域名
 * @param {string} domain - 域名
 */
async function removeWhitelistDomain(domain) {
  try {
    const newList = state.mediaPlayer.whitelist.filter(d => d !== domain);
    await settingsApi('update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'mediaPlayer.whitelist': newList }),
    });
    state.mediaPlayer.whitelist = newList;
    renderWhitelistTags();
    showToast(`已移除域名: ${domain}`);
  } catch (error) {
    console.error('[Realm] 移除白名单域名失败:', error);
    showToast('移除失败，请重试');
  }
}

/**
 * 渲染白名单标签
 * 使用 DOM 构建 + textContent 防止 XSS（WR-13）
 */
function renderWhitelistTags() {
  if (!elements.whitelistTags || !elements.whitelistHint) return;

  // 清空现有标签
  elements.whitelistTags.innerHTML = '';

  if (state.mediaPlayer.whitelist.length === 0) {
    // 白名单为空：显示提示，隐藏标签容器
    elements.whitelistHint.style.display = 'block';
    elements.whitelistTags.style.display = 'none';
    return;
  }

  // 白名单非空：隐藏提示，显示标签
  elements.whitelistHint.style.display = 'none';
  elements.whitelistTags.style.display = 'flex';

  state.mediaPlayer.whitelist.forEach(domain => {
    const tag = document.createElement('span');
    tag.className = 'whitelist-tag';

    const textSpan = document.createElement('span');
    textSpan.className = 'whitelist-tag-text';
    textSpan.textContent = domain;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'whitelist-tag-remove';
    removeBtn.dataset.domain = domain;
    removeBtn.title = '移除';
    removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

    removeBtn.addEventListener('click', () => removeWhitelistDomain(domain));

    tag.appendChild(textSpan);
    tag.appendChild(removeBtn);
    elements.whitelistTags.appendChild(tag);
  });
}

// ==================== Vim 模式设置 ====================

/**
 * Vim 快捷键分组定义
 * 每组包含：标题、快捷键列表（key + description）
 * @type {Array<{title: string, keys: Array<{key: string, desc: string}>}>}
 */
const VIMIUM_SHORTCUT_GROUPS = [
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
 * 渲染 Vim 快捷键说明表格（只读，不可编辑）
 * 使用 DOM 构建 + textContent 防 XSS（WR-13）
 */
function renderVimiumShortcuts() {
  if (!elements.vimiumShortcutsTable) return;

  elements.vimiumShortcutsTable.innerHTML = '';

  VIMIUM_SHORTCUT_GROUPS.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'vimium-shortcut-group';

    const titleEl = document.createElement('h3');
    titleEl.className = 'vimium-shortcut-group-title';
    titleEl.textContent = group.title;
    groupEl.appendChild(titleEl);

    group.keys.forEach(item => {
      const row = document.createElement('div');
      row.className = 'vimium-shortcut-row';

      const keyEl = document.createElement('span');
      keyEl.className = 'vimium-shortcut-key';
      keyEl.textContent = item.key;

      const descEl = document.createElement('span');
      descEl.className = 'vimium-shortcut-desc';
      descEl.textContent = item.desc;

      row.appendChild(keyEl);
      row.appendChild(descEl);
      groupEl.appendChild(row);
    });

    elements.vimiumShortcutsTable.appendChild(groupEl);
  });
}

// ==================== 凭据管理（Phase 33） ====================

/** 凭据删除回调（单条删除或批量删除确认后调用） */
let credentialDeleteCallback = null;

/** 搜索防抖定时器 */
let credentialSearchTimer = null;

/**
 * 加载凭据列表并渲染表格
 * per AF-04：设置页展示已保存凭据
 */
async function loadCredentials() {
  const containerId = pageParams.get('container') || 'default';
  const tableBody = document.getElementById('credentialTableBody');
  const emptyState = document.getElementById('credentialEmptyState');
  const table = document.getElementById('credentialTable');

  if (!tableBody || !emptyState || !table) return;

  try {
    // 显示骨架行
    tableBody.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'credential-row credential-skeleton';
      skeleton.innerHTML = '<span class="credential-col-checkbox"></span><span class="credential-col-website"><div class="skeleton-bar"></div></span><span class="credential-col-username"><div class="skeleton-bar"></div></span><span class="credential-col-actions"></span>';
      tableBody.appendChild(skeleton);
    }
    table.style.display = '';
    emptyState.classList.add('hidden');

    const result = await credentialsApi('list', {}, { containerId });
    renderCredentialTable(result.credentials || []);
  } catch (error) {
    console.error('[Realm] 加载凭据列表失败:', error);
    showToast('加载凭据列表失败');
    tableBody.innerHTML = '';
    table.style.display = 'none';
    emptyState.classList.remove('hidden');
  }
}

/**
 * 渲染凭据表格
 * WR-13：DOM 构建 + textContent 防 XSS
 * @param {Array<Object>} credentials - 凭据列表
 */
function renderCredentialTable(credentials) {
  const tableBody = document.getElementById('credentialTableBody');
  const emptyState = document.getElementById('credentialEmptyState');
  const table = document.getElementById('credentialTable');

  if (!tableBody || !emptyState || !table) return;

  tableBody.innerHTML = '';

  if (credentials.length === 0) {
    table.style.display = 'none';
    emptyState.classList.remove('hidden');
    return;
  }

  table.style.display = '';
  emptyState.classList.add('hidden');

  credentials.forEach(cred => {
    // 行容器
    const row = document.createElement('div');
    row.className = 'credential-row';
    row.dataset.id = cred.id;
    row.dataset.origin = cred.origin;

    // 复选框
    const checkboxCell = document.createElement('span');
    checkboxCell.className = 'credential-col-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'credential-checkbox';
    checkbox.dataset.id = cred.id;
    checkbox.setAttribute('aria-label', `选择 ${cred.origin} 的凭据`);
    checkbox.addEventListener('change', updateCredentialBatchBar);
    checkboxCell.appendChild(checkbox);

    // 网站域名（带 favicon）
    const websiteCell = document.createElement('span');
    websiteCell.className = 'credential-col-website';
    const favicon = document.createElement('img');
    favicon.className = 'credential-favicon';
    try {
      const urlObj = new URL(cred.origin);
      favicon.src = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } catch {
      favicon.src = '';
    }
    favicon.width = 16;
    favicon.height = 16;
    favicon.alt = '';
    const domainSpan = document.createElement('span');
    domainSpan.className = 'credential-domain';
    domainSpan.textContent = cred.origin;
    websiteCell.appendChild(favicon);
    websiteCell.appendChild(domainSpan);

    // 用户名
    const usernameCell = document.createElement('span');
    usernameCell.className = 'credential-col-username';
    usernameCell.textContent = cred.username;

    // 操作按钮
    const actionsCell = document.createElement('span');
    actionsCell.className = 'credential-col-actions';
    const expandBtn = document.createElement('button');
    expandBtn.className = 'btn-icon credential-expand-btn';
    expandBtn.title = '展开详情';
    expandBtn.setAttribute('aria-expanded', 'false');
    expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCredentialExpand(cred.id, cred.origin);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon credential-delete-btn';
    deleteBtn.title = '删除';
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCredentialDelete(cred.origin, cred.origin);
    });

    actionsCell.appendChild(expandBtn);
    actionsCell.appendChild(deleteBtn);

    row.appendChild(checkboxCell);
    row.appendChild(websiteCell);
    row.appendChild(usernameCell);
    row.appendChild(actionsCell);

    // 点击行展开详情
    row.addEventListener('click', () => {
      toggleCredentialExpand(cred.id, cred.origin);
    });

    tableBody.appendChild(row);

    // 详情行（默认隐藏）— WR-13：DOM 构建 + textContent 防 XSS
    const detailRow = document.createElement('div');
    detailRow.className = 'credential-detail hidden';
    detailRow.id = `credential-detail-${cred.id}`;

    const detailContent = document.createElement('div');
    detailContent.className = 'credential-detail-content';

    // 密码字段
    const pwdField = document.createElement('div');
    pwdField.className = 'credential-detail-field';
    const pwdLabel = document.createElement('span');
    pwdLabel.className = 'credential-detail-label';
    pwdLabel.textContent = '密码';
    const pwdValue = document.createElement('span');
    pwdValue.className = 'credential-detail-value';
    const maskedSpan = document.createElement('span');
    maskedSpan.className = 'credential-password-masked';
    maskedSpan.textContent = '••••••••';
    const togglePwdBtn = document.createElement('button');
    togglePwdBtn.className = 'btn btn-secondary btn-sm credential-toggle-password';
    togglePwdBtn.dataset.id = String(cred.id);
    togglePwdBtn.textContent = '显示';
    pwdValue.appendChild(maskedSpan);
    pwdValue.appendChild(togglePwdBtn);
    pwdField.appendChild(pwdLabel);
    pwdField.appendChild(pwdValue);

    // 保存时间字段
    const timeField = document.createElement('div');
    timeField.className = 'credential-detail-field';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'credential-detail-label';
    timeLabel.textContent = '保存时间';
    const timeValue = document.createElement('span');
    timeValue.className = 'credential-detail-value credential-detail-time';
    timeValue.textContent = new Date(cred.updated_at).toLocaleString();
    timeField.appendChild(timeLabel);
    timeField.appendChild(timeValue);

    // 删除按钮
    const detailActions = document.createElement('div');
    detailActions.className = 'credential-detail-actions';
    const detailDeleteBtn = document.createElement('button');
    detailDeleteBtn.className = 'btn btn-danger btn-sm credential-detail-delete';
    detailDeleteBtn.textContent = '删除此凭据';
    detailActions.appendChild(detailDeleteBtn);

    detailContent.appendChild(pwdField);
    detailContent.appendChild(timeField);
    detailContent.appendChild(detailActions);
    detailRow.appendChild(detailContent);
    tableBody.appendChild(detailRow);

    // 绑定详情行内的事件
    togglePwdBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleCredentialPassword(cred.id, togglePwdBtn, detailRow);
    });

    detailDeleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCredentialDelete(cred.origin, cred.origin);
    });
  });
}

/**
 * 展开/收起凭据详情行
 * @param {number} id - 凭据 ID
 * @param {string} origin - 凭据 origin
 */
function toggleCredentialExpand(id, origin) {
  const detailRow = document.getElementById(`credential-detail-${id}`);
  if (!detailRow) return;

  const isHidden = detailRow.classList.contains('hidden');

  // 收起所有其他展开的详情行
  document.querySelectorAll('.credential-detail').forEach(row => {
    row.classList.add('hidden');
  });
  document.querySelectorAll('.credential-row').forEach(row => {
    row.classList.remove('expanded');
  });
  document.querySelectorAll('.credential-expand-btn').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });

  if (isHidden) {
    detailRow.classList.remove('hidden');
    const mainRow = detailRow.previousElementSibling;
    if (mainRow) mainRow.classList.add('expanded');
    const expandBtn = mainRow?.querySelector('.credential-expand-btn');
    if (expandBtn) expandBtn.setAttribute('aria-expanded', 'true');
  }
}

/**
 * 切换密码明文/遮罩显示
 * @param {number} id - 凭据 ID
 * @param {HTMLElement} btn - 切换按钮
 * @param {HTMLElement} detailRow - 详情行
 */
async function toggleCredentialPassword(id, btn, detailRow) {
  const maskedSpan = detailRow.querySelector('.credential-password-masked');
  if (!maskedSpan) return;

  const isShowing = btn.textContent === '隐藏';

  if (isShowing) {
    // 切换回遮罩
    maskedSpan.textContent = '••••••••';
    btn.textContent = '显示';
  } else {
    // 获取解密后的密码
    try {
      const result = await credentialsApi('get-by-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: id }),
      });
      if (result.success && result.password) {
        maskedSpan.textContent = result.password;
        btn.textContent = '隐藏';
      } else {
        showToast('获取密码失败');
      }
    } catch (error) {
      console.error('[Realm] 获取密码失败:', error);
      showToast('获取密码失败');
    }
  }
}

/**
 * 搜索凭据（300ms 防抖）
 */
function filterCredentials() {
  const searchInput = document.getElementById('credentialSearchInput');
  if (!searchInput) return;

  clearTimeout(credentialSearchTimer);
  credentialSearchTimer = setTimeout(async () => {
    const keyword = searchInput.value.trim();
    const containerId = pageParams.get('container') || 'default';

    try {
      const result = keyword
        ? await credentialsApi('search', {}, { containerId, keyword })
        : await credentialsApi('list', {}, { containerId });
      renderCredentialTable(result.credentials || []);
    } catch (error) {
      console.error('[Realm] 搜索凭据失败:', error);
    }
  }, 300);
}

/**
 * 更新批量操作栏显示状态
 */
function updateCredentialBatchBar() {
  const checkboxes = document.querySelectorAll('.credential-checkbox:checked');
  const batchBar = document.getElementById('credentialBatchBar');
  const batchCount = document.getElementById('credentialBatchCount');

  if (!batchBar || !batchCount) return;

  if (checkboxes.length > 0) {
    batchBar.classList.remove('hidden');
    batchCount.textContent = `已选择 ${checkboxes.length} 项`;
  } else {
    batchBar.classList.add('hidden');
  }
}

/**
 * 全选/取消全选凭据复选框
 * @param {boolean} selectAll - 是否全选
 */
function toggleSelectAll(selectAll) {
  const checkboxes = document.querySelectorAll('.credential-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = selectAll;
  });
  updateCredentialBatchBar();
}

/**
 * 删除单条凭据
 * @param {string} origin - 凭据 origin
 * @param {string} domain - 显示用的域名
 */
function handleCredentialDelete(origin, domain) {
  const modal = document.getElementById('credentialDeleteModal');
  const desc = document.getElementById('credentialDeleteDesc');
  const confirmBtn = document.getElementById('credentialDeleteConfirmBtn');

  if (!modal || !desc || !confirmBtn) return;

  desc.textContent = `确定要删除 ${domain} 的凭据吗？`;
  confirmBtn.textContent = '删除凭据';
  modal.showModal();

  // 移除旧的事件监听器
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    const containerId = pageParams.get('container') || 'default';
    try {
      await credentialsApi('delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, origin }),
      });
      modal.close();
      showToast('凭据已删除');
      await loadCredentials();
    } catch (error) {
      console.error('[Realm] 删除凭据失败:', error);
      showToast('删除失败');
    }
  });
}

/**
 * 批量删除凭据
 */
function handleCredentialBatchDelete() {
  const checkboxes = document.querySelectorAll('.credential-checkbox:checked');
  const origins = Array.from(checkboxes).map(cb => {
    const row = cb.closest('.credential-row');
    return row?.dataset.origin;
  }).filter(Boolean);

  if (origins.length === 0) return;

  const modal = document.getElementById('credentialDeleteModal');
  const desc = document.getElementById('credentialDeleteDesc');
  const confirmBtn = document.getElementById('credentialDeleteConfirmBtn');

  if (!modal || !desc || !confirmBtn) return;

  desc.textContent = `确定要删除选中的 ${origins.length} 条凭据吗？此操作不可撤销。`;
  confirmBtn.textContent = '删除凭据';
  modal.showModal();

  // 移除旧的事件监听器
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    const containerId = pageParams.get('container') || 'default';
    try {
      const result = await credentialsApi('batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, origins }),
      });
      modal.close();
      showToast(`已删除 ${result.deleted || origins.length} 条凭据`);
      await loadCredentials();
    } catch (error) {
      console.error('[Realm] 批量删除凭据失败:', error);
      showToast('删除失败');
    }
  });
}

/**
 * 初始化凭据管理事件监听器
 */
function setupCredentialListeners() {
  const searchInput = document.getElementById('credentialSearchInput');
  const selectAll = document.getElementById('credentialSelectAll');
  const batchDeleteBtn = document.getElementById('credentialBatchDeleteBtn');
  const batchDeselectBtn = document.getElementById('credentialBatchDeselectBtn');
  const deleteCancelBtn = document.getElementById('credentialDeleteCancelBtn');
  const deleteModal = document.getElementById('credentialDeleteModal');

  if (searchInput) {
    searchInput.addEventListener('input', filterCredentials);
  }

  if (selectAll) {
    selectAll.addEventListener('change', () => {
      toggleSelectAll(selectAll.checked);
    });
  }

  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', handleCredentialBatchDelete);
  }

  if (batchDeselectBtn) {
    batchDeselectBtn.addEventListener('click', () => {
      toggleSelectAll(false);
      const selectAllCb = document.getElementById('credentialSelectAll');
      if (selectAllCb) selectAllCb.checked = false;
    });
  }

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', () => {
      if (deleteModal) deleteModal.close();
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) deleteModal.close();
    });
  }
}

// ==================== 地址管理（Phase 33） ====================

/**
 * 调用地址管理 HTTP API
 * @param {string} route - API 路由（如 'get'、'save'、'delete'）
 * @param {Object} [options] - fetch 选项
 * @param {Object} [query] - 额外查询参数
 * @returns {Promise<*>} 解析后的 JSON 响应
 */
async function addressApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/address/${route}?${params.toString()}`, options);
  if (!res.ok) {
    throw new Error(`地址 API 请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 加载当前容器的地址数据
 * per AF-06：设置页查看和编辑地址
 */
async function loadAddress() {
  const containerId = pageParams.get('container') || 'default';
  const addressView = document.getElementById('addressView');
  const addressEdit = document.getElementById('addressEdit');
  const addressEmptyState = document.getElementById('addressEmptyState');
  const addressCard = document.getElementById('addressCard');

  if (!addressView || !addressEdit || !addressEmptyState || !addressCard) return;

  try {
    const result = await addressApi('get', {}, { containerId });
    const address = result.address;

    if (address && address.name) {
      // 有地址数据：显示查看模式
      renderAddressView(address);
      addressCard.style.display = '';
      addressView.classList.remove('hidden');
      addressEdit.classList.add('hidden');
      addressEmptyState.classList.add('hidden');
    } else {
      // 无地址数据：显示空状态
      addressCard.style.display = 'none';
      addressEmptyState.classList.remove('hidden');
    }
  } catch (error) {
    console.error('[Realm] 加载地址失败:', error);
    addressCard.style.display = 'none';
    addressEmptyState.classList.remove('hidden');
  }
}

/**
 * 渲染地址查看模式
 * WR-13：使用 textContent 防 XSS
 * @param {Object} address - { name, phone, address }
 */
function renderAddressView(address) {
  const nameEl = document.getElementById('addressName');
  const phoneEl = document.getElementById('addressPhone');
  const fullEl = document.getElementById('addressFull');

  if (nameEl) nameEl.textContent = address.name || '未填写';
  if (phoneEl) phoneEl.textContent = address.phone || '未填写';
  if (fullEl) fullEl.textContent = address.address || '未填写';
}

/**
 * 切换地址编辑模式
 */
function toggleAddressEdit() {
  const addressView = document.getElementById('addressView');
  const addressEdit = document.getElementById('addressEdit');

  if (!addressView || !addressEdit) return;

  const isEditing = !addressEdit.classList.contains('hidden');

  if (isEditing) {
    // 切换回查看模式
    addressEdit.classList.add('hidden');
    addressView.classList.remove('hidden');
  } else {
    // 切换到编辑模式，填充现有数据
    const nameEl = document.getElementById('addressName');
    const phoneEl = document.getElementById('addressPhone');
    const fullEl = document.getElementById('addressFull');

    const nameInput = document.getElementById('addressNameInput');
    const phoneInput = document.getElementById('addressPhoneInput');
    const fullInput = document.getElementById('addressFullInput');

    if (nameInput && nameEl) nameInput.value = nameEl.textContent === '未填写' ? '' : nameEl.textContent;
    if (phoneInput && phoneEl) phoneInput.value = phoneEl.textContent === '未填写' ? '' : phoneEl.textContent;
    if (fullInput && fullEl) fullInput.value = fullEl.textContent === '未填写' ? '' : fullEl.textContent;

    addressView.classList.add('hidden');
    addressEdit.classList.remove('hidden');
  }
}

/**
 * 保存地址
 * 验证姓名和手机号非空，手机号 11 位数字
 */
async function saveAddress() {
  const nameInput = document.getElementById('addressNameInput');
  const phoneInput = document.getElementById('addressPhoneInput');
  const fullInput = document.getElementById('addressFullInput');

  if (!nameInput || !phoneInput || !fullInput) return;

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const address = fullInput.value.trim();

  // 验证
  if (!name) {
    showToast('请输入姓名');
    highlightInputError(nameInput);
    return;
  }

  if (!phone) {
    showToast('请输入手机号');
    highlightInputError(phoneInput);
    return;
  }

  if (!/^1\d{10}$/.test(phone)) {
    showToast('手机号格式不正确，应为 11 位数字');
    highlightInputError(phoneInput);
    return;
  }

  if (!address) {
    showToast('请输入详细地址');
    highlightInputError(fullInput);
    return;
  }

  const containerId = pageParams.get('container') || 'default';

  try {
    await addressApi('save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId, name, phone, address }),
    });

    showToast('地址已保存');
    await loadAddress();
  } catch (error) {
    console.error('[Realm] 保存地址失败:', error);
    showToast('保存失败，请重试');
  }
}

/**
 * 删除地址
 */
async function deleteAddress() {
  const containerId = pageParams.get('container') || 'default';

  if (!confirm('确定要删除当前容器的收货地址吗？')) {
    return;
  }

  try {
    await addressApi('delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId }),
    });

    showToast('地址已删除');
    await loadAddress();
  } catch (error) {
    console.error('[Realm] 删除地址失败:', error);
    showToast('删除失败，请重试');
  }
}

/**
 * 初始化地址管理事件监听器
 */
function setupAddressListeners() {
  const editBtn = document.getElementById('addressEditBtn');
  const deleteBtn = document.getElementById('addressDeleteBtn');
  const cancelBtn = document.getElementById('addressCancelBtn');
  const saveBtn = document.getElementById('addressSaveBtn');

  if (editBtn) {
    editBtn.addEventListener('click', toggleAddressEdit);
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteAddress);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', toggleAddressEdit);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', saveAddress);
  }
}

// ==================== AI 助手设置 ====================

/** AI 提供商目录缓存（含模型列表和配置状态） */
let aiProvidersCatalog = [];
/** 已配置供应商列表（含自定义供应商） */
let aiProvidersList = [];
/** 当前选中的供应商 ID */
let aiSelectedProviderId = null;
/** AI 激活供应商 ID */
let aiActiveProviderId = null;

// ==================== 搜索配置 ====================

/** 搜索 Provider 定义（D-10, D-11） */
const SEARCH_PROVIDERS = [
  { id: 'auto', name: '自动选择', requiresKey: false },
  { id: 'tavily', name: 'Tavily', requiresKey: true },
  { id: 'brave', name: 'Brave Search', requiresKey: true },
  { id: 'serper', name: 'Serper (Google)', requiresKey: true },
  { id: 'anysearch', name: 'AnySearch', requiresKey: true },
  { id: 'anysearch_free', name: 'AnySearch Free', requiresKey: false },
];

/** 当前选中的搜索 Provider ID */
let searchSelectedProviderId = null;

/** 搜索配置数据 */
let searchConfig = { provider: 'auto', apiKeys: {} };

/**
 * 加载 AI 助手设置
 * 获取已配置供应商列表和 AI 状态，渲染供应商列表和状态指示器
 */
async function loadAISettings() {
  try {
    // 获取 AI 状态
    const aiState = await settingsApi('ai/state');
    updateAIStatusIndicator(aiState);

    // 获取已配置供应商列表（含 envVarName、isBuiltin、customModels）
    const catalogData = await settingsApi('ai/providers');
    aiProvidersCatalog = catalogData.providers || [];
    aiActiveProviderId = catalogData.activeProvider || null;

    // 显示所有供应商（包括未配置 apiKey 的自定义供应商，方便用户后续填写）
    aiProvidersList = aiProvidersCatalog.filter(p => p.configured || p.isBuiltin === false);

    // 渲染供应商列表
    renderProviderList();

    // 预选激活供应商
    if (aiActiveProviderId) {
      showEditorForm(aiActiveProviderId);
    } else if (aiProvidersList.length > 0) {
      showEditorForm(aiProvidersList[0].id);
    } else {
      showEditorEmpty();
    }
  } catch (error) {
    console.error('[Realm] 加载 AI 设置失败:', error);
  }
}

/**
 * 更新 AI 连接状态指示器
 * @param {Object} aiState - AI Manager 状态
 */
function updateAIStatusIndicator(aiState) {
  const statusDot = document.getElementById('aiStatusDot');
  const statusText = document.getElementById('aiStatusText');
  if (!statusDot || !statusText) return;

  if (aiState.initialized) {
    statusDot.className = 'ai-status-dot connected';
    statusText.className = 'ai-status-text connected';
    statusText.textContent = `已连接 (${aiState.activeProvider || '?'} / ${aiState.model || '未知模型'}, ${aiState.toolsCount} 个工具)`;
  } else {
    statusDot.className = 'ai-status-dot';
    statusText.className = 'ai-status-text';
    statusText.textContent = '未配置 API Key';
  }
}

/**
 * 渲染左侧供应商列表
 * 按搜索框文本过滤，显示供应商图标、名称、激活/禁用状态
 */
function renderProviderList() {
  const listEl = document.getElementById('aiProviderList');
  const searchInput = document.getElementById('aiProviderSearch');
  if (!listEl) return;

  const keyword = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const filtered = aiProvidersList.filter(p =>
    !keyword ||
    p.id.toLowerCase().includes(keyword) ||
    p.name.toLowerCase().includes(keyword)
  );

  listEl.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:16px;text-align:center;font-size:13px;color:var(--text-muted);';
    empty.textContent = aiProvidersList.length === 0 ? '尚未配置供应商' : '无匹配供应商';
    listEl.appendChild(empty);
    return;
  }

  const MF = window.ModelFamily;
  filtered.forEach(p => {
    const enabled = p.enabled !== false;
    const item = document.createElement('div');
    item.className = 'ai-provider-item'
      + (aiSelectedProviderId === p.id ? ' active' : '')
      + (enabled ? '' : ' disabled');
    item.dataset.providerId = p.id;

    // 供应商图标（内置查图标表，自定义/未知用字母头像）
    const iconInfo = MF ? MF.getProviderIcon(p.id) : null;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'provider-icon';
    iconWrap.innerHTML = MF
      ? MF.iconHtml(iconInfo && iconInfo.icon, iconInfo ? iconInfo.color : false, p.name, iconInfo ? iconInfo.dark : false)
      : '';
    item.appendChild(iconWrap);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'provider-name';
    nameSpan.textContent = p.name;
    item.appendChild(nameSpan);

    if (!enabled) {
      const tag = document.createElement('span');
      tag.className = 'provider-disabled-tag';
      tag.textContent = '已停用';
      item.appendChild(tag);
    } else if (p.id === aiActiveProviderId) {
      const dot = document.createElement('span');
      dot.className = 'provider-active-dot';
      dot.title = '当前激活';
      item.appendChild(dot);
    }

    item.addEventListener('click', () => showEditorForm(p.id));
    listEl.appendChild(item);
  });
}

/**
 * 显示空状态
 */
function showEditorEmpty() {
  const empty = document.getElementById('aiEditorEmpty');
  const form = document.getElementById('aiEditorForm');
  if (empty) empty.style.display = '';
  if (form) form.style.display = 'none';
  aiSelectedProviderId = null;
  renderProviderList();
}

/**
 * 显示供应商编辑表单
 * @param {string} providerId - 供应商 ID
 */
async function showEditorForm(providerId) {
  const provider = aiProvidersList.find(p => p.id === providerId);
  if (!provider) {
    showEditorEmpty();
    return;
  }

  aiSelectedProviderId = providerId;

  const empty = document.getElementById('aiEditorEmpty');
  const form = document.getElementById('aiEditorForm');
  if (empty) empty.style.display = 'none';
  if (form) form.style.display = 'flex';

  // 更新列表高亮
  renderProviderList();

  // 填充表单
  const titleEl = document.getElementById('aiEditorTitle');
  const iconEl = document.getElementById('aiEditorIcon');
  const nameInput = document.getElementById('aiEditorName');
  const apiKeyInput = document.getElementById('aiEditorApiKey');
  const envVarNameInput = document.getElementById('aiEditorEnvVarName');
  const baseURLInput = document.getElementById('aiEditorBaseURL');
  const baseURLHint = document.getElementById('aiBaseURLHint');
  const envVarHint = document.getElementById('aiEnvVarHint');
  const enableToggle = document.getElementById('aiEnableToggle');

  // 编辑器头部图标
  const MF = window.ModelFamily;
  if (iconEl && MF) {
    const iconInfo = MF.getProviderIcon(provider.id);
    iconEl.innerHTML = MF.iconHtml(iconInfo && iconInfo.icon, iconInfo ? iconInfo.color : false, provider.name, iconInfo ? iconInfo.dark : false);
  }

  // 启用开关状态
  if (enableToggle) {
    const enabled = provider.enabled !== false;
    enableToggle.classList.toggle('on', enabled);
    enableToggle.setAttribute('aria-checked', String(enabled));
  }

  if (titleEl) titleEl.textContent = provider.name;
  if (nameInput) {
    nameInput.value = provider.name;
    nameInput.readOnly = provider.isBuiltin !== false;
  }
  if (apiKeyInput) {
    apiKeyInput.value = '';
    // 重置遮蔽状态（上次可能切到了明文显示）
    apiKeyInput.type = 'password';
    const toggleBtn = document.getElementById('aiEditorToggleKey');
    if (toggleBtn) toggleBtn.textContent = '显示';
    // 已配置的供应商回显完整 Key（默认 password 遮蔽，点「显示」可查看）
    if (provider.configured) {
      try {
        const keyResult = await settingsApi(`ai/providers/${providerId}/api-key`);
        if (keyResult && keyResult.apiKey) {
          apiKeyInput.value = keyResult.apiKey;
        }
      } catch { /* 回显失败不阻塞编辑 */ }
    }
    apiKeyInput.placeholder = provider.configured
      ? '留空则使用环境变量（如有）或保留原 Key'
      : '输入 API Key';
  }
  if (envVarNameInput) {
    envVarNameInput.value = provider.envVarName || '';
  }
  if (baseURLInput) {
    baseURLInput.value = provider.baseURL || '';
    // Base URL 始终展示：内置供应商只读，自定义供应商可编辑
    baseURLInput.readOnly = provider.isBuiltin !== false;
    if (baseURLHint) {
      baseURLHint.textContent = provider.isBuiltin !== false
        ? '内置供应商默认端点（只读）'
        : '自定义供应商必填，用于模型检测和 API 调用';
    }
  }

  // 检测环境变量
  if (envVarHint) {
    envVarHint.style.display = 'none';
    try {
      const customName = envVarNameInput ? envVarNameInput.value : '';
      // customName 走 settingsApi 的 query 参数：直接拼进 route 会和 token 的 `?` 冲突
      const envResult = await settingsApi(
        `ai/providers/${providerId}/env-var`, {}, customName ? { customName } : {}
      );
      if (envResult && envResult.found) {
        envVarHint.style.display = 'block';
        envVarHint.className = 'ai-env-var-hint env-found';
        envVarHint.textContent = provider.configured
          ? `检测到环境变量 ${envResult.name}，保存时将使用它覆盖已保存的 Key`
          : `检测到环境变量 ${envResult.name}，已自动使用`;
        if (apiKeyInput && !apiKeyInput.value && !provider.configured) {
          apiKeyInput.placeholder = `环境变量 ${envResult.name} 已配置`;
        }
      } else if (envResult && envResult.name) {
        envVarHint.style.display = 'block';
        envVarHint.className = 'ai-env-var-hint env-not-found';
        envVarHint.textContent = `未检测到环境变量 ${envResult.name}，将使用手动输入的 API Key`;
      }
    } catch {
      // 环境变量检测失败不阻塞
    }
  }

  // 渲染模型分组列表
  renderModelGroups(provider);
}

/** 模型分组折叠状态（groupKey → 是否折叠），跨渲染保持 */
const aiModelGroupCollapsed = new Map();

/**
 * 能力徽章小图标（视觉/推理/工具）
 * @param {string} kind - vision | reasoning | tools
 * @returns {string} SVG HTML
 */
function aiCapBadgeSvg(kind) {
  const attrs = 'width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if (kind === 'vision') {
    return `<svg ${attrs}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  }
  if (kind === 'reasoning') {
    return `<svg ${attrs}><path d="M9.5 2a5.5 5.5 0 0 0-5.5 5.5c0 1.2.4 2.3 1 3.2.5.8 1 1.9 1 3.3h6c0-1.4.5-2.5 1-3.3.6-.9 1-2 1-3.2A5.5 5.5 0 0 0 9.5 2z"></path><line x1="7" y1="17" x2="12" y2="17"></line><line x1="8" y1="21" x2="11" y2="21"></line></svg>`;
  }
  // tools（扳手）
  return `<svg ${attrs}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
}

/**
 * 渲染模型分组列表（按品牌家族分组，组可折叠，行尾删除按钮）
 * @param {Object} provider - 供应商对象
 */
function renderModelGroups(provider) {
  const groupsEl = document.getElementById('aiModelGroups');
  const emptyEl = document.getElementById('aiModelEmpty');
  const errorEl = document.getElementById('aiModelError');
  const titleEl = document.getElementById('aiModelHeaderTitle');
  if (!groupsEl) return;

  if (errorEl) errorEl.style.display = 'none';

  const allModels = provider.models || [];
  if (titleEl) titleEl.textContent = `模型 (${allModels.length})`;

  // 搜索过滤
  const searchInput = document.getElementById('aiModelSearch');
  const keyword = (searchInput && searchInput.style.display !== 'none' ? searchInput.value : '').trim().toLowerCase();
  const models = keyword
    ? allModels.filter(m => (m.id || '').toLowerCase().includes(keyword) || (m.name || '').toLowerCase().includes(keyword))
    : allModels;

  if (allModels.length === 0) {
    groupsEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const MF = window.ModelFamily;
  const groups = MF ? MF.groupModels(models) : [{ key: 'all', title: '模型', icon: null, color: false, models }];

  groupsEl.innerHTML = '';

  if (keyword && models.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ai-model-empty';
    empty.style.display = '';
    empty.innerHTML = '<span>无匹配模型</span>';
    groupsEl.appendChild(empty);
    return;
  }

  groups.forEach(g => {
    const collapsed = aiModelGroupCollapsed.get(g.key) === true && !keyword; // 搜索时强制展开
    const groupEl = document.createElement('div');
    groupEl.className = 'ai-model-group' + (collapsed ? ' collapsed' : '');

    const header = document.createElement('div');
    header.className = 'ai-model-group-header';
    header.innerHTML = `
      <svg class="ai-model-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      ${MF ? MF.iconHtml(g.icon, g.color, g.title, g.dark) : ''}
      <span class="ai-family-title">${g.title}</span>
      <span class="ai-family-count">${g.models.length}</span>
      <span class="ai-group-spacer"></span>
      <button class="btn btn-icon btn-sm ai-model-remove ai-group-remove" title="删除该组全部模型">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
    `;
    header.addEventListener('click', () => {
      aiModelGroupCollapsed.set(g.key, !collapsed);
      renderModelGroups(provider);
    });
    header.querySelector('.ai-group-remove').addEventListener('click', (e) => {
      e.stopPropagation(); // 不触发分组折叠
      const ids = new Set(g.models.map(m => m.id));
      provider.models = (provider.models || []).filter(pm => !ids.has(pm.id));
      renderModelGroups(provider);
    });
    groupEl.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ai-model-group-body';
    g.models.forEach(m => {
      const row = document.createElement('div');
      row.className = 'ai-model-row';

      const r = m._resolved || (MF ? MF.resolveModel(m.id) : null);
      const badges = r && r.caps
        ? [
            r.caps.vision ? `<span class="ai-cap-badge vision" title="支持视觉输入">${aiCapBadgeSvg('vision')}</span>` : '',
            r.caps.reasoning ? `<span class="ai-cap-badge reasoning" title="支持推理">${aiCapBadgeSvg('reasoning')}</span>` : '',
            r.caps.tools ? `<span class="ai-cap-badge tools" title="支持工具调用">${aiCapBadgeSvg('tools')}</span>` : '',
          ].join('')
        : '';

      row.innerHTML = `
        ${MF && r ? MF.iconHtml(r.icon, r.color, m.name || m.id, r.darkTile) : ''}
        <span class="ai-model-name" title="${m.id}">${m.name || m.id}</span>
        <span class="ai-model-badges">${badges}</span>
        <button class="btn btn-icon btn-sm ai-model-remove" title="移除该模型">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      `;
      row.querySelector('.ai-model-remove').addEventListener('click', () => {
        const idx = provider.models.findIndex(pm => pm.id === m.id);
        if (idx >= 0) provider.models.splice(idx, 1);
        renderModelGroups(provider);
      });
      body.appendChild(row);
    });
    groupEl.appendChild(body);

    groupsEl.appendChild(groupEl);
  });
}

/**
 * 保存供应商配置
 */
async function saveProviderConfig() {
  if (!aiSelectedProviderId) return;

  const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
  if (!provider) return;

  const apiKeyInput = document.getElementById('aiEditorApiKey');
  const envVarNameInput = document.getElementById('aiEditorEnvVarName');
  const nameInput = document.getElementById('aiEditorName');
  const baseURLInput = document.getElementById('aiEditorBaseURL');
  const saveBtn = document.getElementById('aiSaveProviderBtn');

  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
  const envVarName = envVarNameInput ? envVarNameInput.value.trim() : '';
  const displayName = nameInput ? nameInput.value.trim() : '';
  const baseURL = baseURLInput ? baseURLInput.value.trim() : '';

  // 如果用户没有输入新 Key，尝试使用环境变量检测到的值
  let effectiveApiKey = apiKey;
  if (!effectiveApiKey && provider.configured) {
    // 保留现有 Key（不传 apiKey 让后端保留）
    effectiveApiKey = '__keep__';
  }

  // 不在前端拦截空 apiKey：后端 configureProviders 会回退到环境变量，
  // 环境变量也没有时会返回明确错误，经 catch 分支 toast 提示
  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    const body = {
      provider: aiSelectedProviderId,
      apiKey: effectiveApiKey,
      model: provider.activeModel || null,
      envVarName: envVarName || null,
      customModels: provider.models ? provider.models.map(m => m.id) : [],
      isBuiltin: provider.isBuiltin !== false,
      displayName: displayName || null,
      baseURL: baseURL || null,
      enabled: provider.enabled !== false,
    };

    await settingsApi('ai/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    showToast('配置已保存');

    // 首次保存（新输入了 Key 且模型列表为空）后自动拉取模型：
    // <10 个全部展示；>=10 个每个分组只保留最新模型（其余可在「获取模型列表」中补加）
    // 用 customModels 判断：内置供应商 models 会 fallback 到 catalog，不能代表用户已检测过
    const hadModels = provider.customModels && provider.customModels.length > 0;
    await loadAISettings();
    if (apiKey && !hadModels) {
      await autoPopulateModels(aiSelectedProviderId, { apiKey, baseURL, envVarName });
    }
  } catch (error) {
    console.error('[Realm] 保存 AI 配置失败:', error);
    showToast('保存失败: ' + error.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存配置';
    }
  }
}

/**
 * 删除供应商
 */
async function deleteProvider() {
  if (!aiSelectedProviderId) return;

  const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
  if (!provider) return;

  const confirmed = confirm(
    `删除供应商：确定要删除"${provider.name}"吗？\n相关配置（API Key、模型列表）将被清除，此操作不可撤销`
  );
  if (!confirmed) return;

  try {
    await settingsApi(`ai/providers/${aiSelectedProviderId}`, { method: 'DELETE' });
    showToast('供应商已删除');
    await loadAISettings();
  } catch (error) {
    console.error('[Realm] 删除供应商失败:', error);
    showToast('删除失败: ' + error.message, 'error');
  }
}

/**
 * 请求模型检测端点（/models 拉取）
 * @param {string} providerId - 供应商 ID
 * @param {Object} [creds] - { apiKey, baseURL, envVarName }
 * @returns {Promise<{models?: Array, error?: string}>}
 */
async function requestDetectModels(providerId, creds = {}) {
  const body = {};
  if (creds.apiKey) body.apiKey = creds.apiKey;
  if (creds.baseURL) body.baseURL = creds.baseURL;
  if (creds.envVarName) body.envVarName = creds.envVarName;
  return settingsApi(`ai/providers/${providerId}/detect-models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * 首次配置后自动填充模型列表：
 * 检测结果 <10 个全部添加；>=10 个每个家族分组只保留最新模型。
 * 填充结果直接持久化（customModels），并 toast 告知用户可在弹框中调整。
 * @param {string} providerId - 供应商 ID
 * @param {Object} creds - { apiKey, baseURL, envVarName }
 */
async function autoPopulateModels(providerId, creds) {
  try {
    const result = await requestDetectModels(providerId, creds);
    if (!result.models || result.models.length === 0) return;

    const MF = window.ModelFamily;
    const picked = result.models.length < 10 || !MF
      ? result.models
      : MF.latestPerGroup(result.models);

    const provider = aiProvidersList.find(p => p.id === providerId);
    if (!provider) return;
    provider.models = picked.map(m => ({ id: m.id, name: m.name || m.id }));

    await settingsApi('ai/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerId,
        apiKey: '__keep__',
        customModels: provider.models.map(m => m.id),
        isBuiltin: provider.isBuiltin !== false,
        enabled: provider.enabled !== false,
      }),
    });

    await loadAISettings();
    const trimmed = result.models.length - picked.length;
    showToast(trimmed > 0
      ? `已自动添加 ${picked.length} 个模型（每个分组取最新），点击「获取模型列表」可调整`
      : `已自动添加 ${picked.length} 个模型`);
  } catch (e) {
    // 自动填充失败不阻塞，用户可手动点「获取模型列表」
    console.warn('[Realm] 自动填充模型失败:', e.message);
  }
}

// ==================== 搜索配置 UI ====================

/**
 * 加载搜索配置
 * 获取当前搜索 Provider 和 API Keys 配置，渲染 Provider 列表
 */
async function loadSearchConfig() {
  try {
    const data = await searchConfigApi('get');
    searchConfig = {
      provider: data.provider || 'auto',
      apiKeys: data.apiKeys || {},
    };
    renderSearchProviderList();

    // 预选当前配置的 Provider
    if (searchConfig.provider) {
      showSearchEditorForm(searchConfig.provider);
    }
  } catch (error) {
    console.error('[Realm] 加载搜索配置失败:', error);
  }
}

/**
 * 渲染搜索 Provider 列表
 * 遍历 SEARCH_PROVIDERS 创建列表项，显示名称和状态标签
 */
function renderSearchProviderList() {
  const listEl = document.getElementById('searchProviderList');
  if (!listEl) return;

  listEl.innerHTML = '';
  SEARCH_PROVIDERS.forEach(p => {
    const hasKey = !!searchConfig.apiKeys[p.id];
    const item = document.createElement('div');
    item.className = 'ai-provider-item'
      + (searchSelectedProviderId === p.id ? ' active' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'provider-name';
    nameSpan.textContent = p.name;
    item.appendChild(nameSpan);

    // 状态标签：已配置/未配置/免费
    const statusSpan = document.createElement('span');
    if (p.requiresKey) {
      statusSpan.className = hasKey ? 'provider-status configured' : 'provider-status unconfigured';
      statusSpan.textContent = hasKey ? '已配置' : '未配置';
    } else {
      statusSpan.className = 'provider-status free';
      statusSpan.textContent = '免费';
    }
    item.appendChild(statusSpan);

    item.addEventListener('click', () => showSearchEditorForm(p.id));
    listEl.appendChild(item);
  });
}

/**
 * 显示搜索 Provider 编辑表单
 * 切换右侧编辑器，根据 requiresKey 决定是否显示 API Key 输入框
 * @param {string} providerId - Provider ID
 */
function showSearchEditorForm(providerId) {
  const provider = SEARCH_PROVIDERS.find(p => p.id === providerId);
  if (!provider) return;

  // 重复点击同一 Provider 不触发额外操作（per FLAGGED-ASSUMPTION: CONFIG-02 equality）
  if (searchSelectedProviderId === providerId) return;

  searchSelectedProviderId = providerId;
  renderSearchProviderList();

  const form = document.getElementById('searchEditorForm');
  const empty = document.getElementById('searchEditorEmpty');
  if (empty) empty.style.display = 'none';
  if (form) form.style.display = 'flex';

  const titleEl = document.getElementById('searchEditorTitle');
  const apiKeyInput = document.getElementById('searchEditorApiKey');
  const verifyBtn = document.getElementById('searchVerifyBtn');
  const verifyResult = document.getElementById('searchVerifyResult');
  const formGroup = apiKeyInput ? apiKeyInput.closest('.ai-form-group') : null;

  if (titleEl) titleEl.textContent = provider.name;

  if (provider.requiresKey) {
    // 需要 API Key 的 Provider：显示输入框和验证按钮
    if (formGroup) formGroup.style.display = '';
    if (apiKeyInput) {
      apiKeyInput.value = searchConfig.apiKeys[provider.id] || '';
      apiKeyInput.placeholder = '输入 API Key';
    }
    if (verifyBtn) verifyBtn.style.display = '';
  } else {
    // 免费 Provider：隐藏 API Key 输入区域
    if (formGroup) formGroup.style.display = 'none';
    if (verifyBtn) verifyBtn.style.display = 'none';
  }

  if (verifyResult) {
    verifyResult.textContent = '';
    verifyResult.className = 'verify-result';
  }
}

/**
 * 验证搜索 Provider API Key（D-12: 手动点击验证按钮）
 * @param {string} providerId - Provider ID
 * @param {string} apiKey - API Key
 */
async function verifySearchKey(providerId, apiKey) {
  const verifyBtn = document.getElementById('searchVerifyBtn');
  const verifyResult = document.getElementById('searchVerifyResult');

  // 空 API Key 时前端校验提示（per FLAGGED-ASSUMPTION: CONFIG-03 empty）
  if (!apiKey || !apiKey.trim()) {
    if (verifyResult) {
      verifyResult.className = 'verify-result error';
      verifyResult.textContent = '请输入 API Key';
    }
    return;
  }

  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = '正在验证...';
  }
  if (verifyResult) {
    verifyResult.textContent = '';
    verifyResult.className = 'verify-result';
  }

  try {
    const result = await searchConfigApi('verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, apiKey }),
    });
    if (result.valid) {
      if (verifyResult) {
        verifyResult.className = 'verify-result success';
        verifyResult.textContent = 'Key 有效';
      }
    } else {
      if (verifyResult) {
        verifyResult.className = 'verify-result error';
        verifyResult.textContent = '验证失败：' + (result.error || '未知错误');
      }
    }
  } catch (err) {
    if (verifyResult) {
      verifyResult.className = 'verify-result error';
      verifyResult.textContent = '验证失败：' + (err.message || '网络错误');
    }
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = '验证 API Key';
    }
  }
}

/**
 * 初始化搜索配置 UI 事件监听
 * 绑定折叠、验证、保存按钮事件
 */
function setupSearchConfigListeners() {
  // 折叠交互（D-08）
  const toggle = document.getElementById('searchConfigToggle');
  const content = document.getElementById('searchConfigContent');
  if (toggle && content) {
    toggle.addEventListener('click', () => {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'flex';
      // 更新箭头方向
      const chevron = toggle.querySelector('.settings-group-chevron');
      if (chevron) {
        chevron.style.transform = isVisible ? '' : 'rotate(180deg)';
      }
      // 保存折叠状态
      settingsApi('update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchConfigCollapsed: isVisible }),
      }).catch(() => {});
    });
  }

  // 验证按钮
  const verifyBtn = document.getElementById('searchVerifyBtn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
      if (!searchSelectedProviderId) return;
      const apiKeyInput = document.getElementById('searchEditorApiKey');
      const apiKey = apiKeyInput ? apiKeyInput.value : '';
      verifySearchKey(searchSelectedProviderId, apiKey);
    });
  }

  // 保存按钮
  const saveBtn = document.getElementById('searchSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!searchSelectedProviderId) return;
      const provider = SEARCH_PROVIDERS.find(p => p.id === searchSelectedProviderId);
      if (!provider) return;

      const apiKeyInput = document.getElementById('searchEditorApiKey');
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

      // 免费 Provider 不需要 Key
      if (provider.requiresKey && !apiKey) {
        showToast('请输入 API Key', 'error');
        return;
      }

      // 覆盖确认（per UI-SPEC Destructive confirmation）
      const existingKey = searchConfig.apiKeys[searchSelectedProviderId];
      if (provider.requiresKey && existingKey && existingKey !== apiKey) {
        const confirmed = await showConfirmBar(
          '当前 Provider 已有 API Key，确认覆盖？',
          '确认覆盖',
          '取消'
        );
        if (!confirmed) return;
      }

      try {
        // 更新 apiKeys 对象
        const newApiKeys = { ...searchConfig.apiKeys };
        if (provider.requiresKey) {
          newApiKeys[searchSelectedProviderId] = apiKey;
        }

        await searchConfigApi('set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: searchConfig.provider,
            apiKeys: newApiKeys,
          }),
        });

        // 更新本地状态
        searchConfig.apiKeys = newApiKeys;
        renderSearchProviderList();
        showToast('搜索配置已保存');
      } catch (err) {
        showToast('保存失败：' + (err.message || '未知错误'), 'error');
      }
    });
  }

  // 恢复折叠状态
  loadSearchConfigCollapseState();
}

/**
 * 加载搜索配置折叠状态
 */
async function loadSearchConfigCollapseState() {
  try {
    const settings = await settingsApi('get');
    const collapsed = settings.searchConfigCollapsed;
    const content = document.getElementById('searchConfigContent');
    const toggle = document.getElementById('searchConfigToggle');
    if (content && collapsed) {
      content.style.display = 'none';
      const chevron = toggle ? toggle.querySelector('.settings-group-chevron') : null;
      if (chevron) chevron.style.transform = '';
    }
  } catch (e) {
    // 忽略加载失败
  }
}

/**
 * 显示 inline 确认条（替代 window.confirm）
 * 5 秒无操作自动消失
 * @param {string} message - 确认消息
 * @param {string} confirmText - 确认按钮文字
 * @param {string} cancelText - 取消按钮文字
 * @returns {Promise<boolean>} 用户是否确认
 */
function showConfirmBar(message, confirmText, cancelText) {
  return new Promise(resolve => {
    // 移除已有的确认条
    const existing = document.querySelector('.search-confirm-bar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.className = 'search-confirm-bar';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'search-confirm-message';
    msgSpan.textContent = message;

    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary btn-sm search-confirm-ok';
    okBtn.textContent = confirmText;

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary btn-sm search-confirm-cancel';
    cancelBtn.textContent = cancelText;

    bar.appendChild(msgSpan);
    bar.appendChild(okBtn);
    bar.appendChild(cancelBtn);

    // 插入到保存按钮附近
    const saveBtn = document.getElementById('searchSaveBtn');
    if (saveBtn && saveBtn.parentElement) {
      saveBtn.parentElement.appendChild(bar);
    }

    let timeoutId;
    const cleanup = (result) => {
      clearTimeout(timeoutId);
      bar.remove();
      resolve(result);
    };

    bar.querySelector('.search-confirm-ok').addEventListener('click', () => cleanup(true));
    bar.querySelector('.search-confirm-cancel').addEventListener('click', () => cleanup(false));

    // 5 秒超时自动消失
    timeoutId = setTimeout(() => cleanup(false), 5000);
  });
}

// ==================== 获取模型列表弹框 ====================

/** 弹框中拉取到的全部可用模型 */
let aiFetchAvailable = [];
/** 弹框当前类型 tab */
let aiFetchActiveTab = 'all';

const AI_FETCH_TABS = [
  ['all', '全部'], ['text', '文本'], ['image', '图片'], ['embedding', '嵌入'],
  ['audio', '音频'], ['video', '视频'], ['rerank', '重排'],
];

/**
 * 打开「获取模型列表」弹框并拉取模型
 */
async function showFetchModelsDialog() {
  const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
  if (!provider) return;

  const dialog = document.getElementById('aiFetchDialog');
  const listEl = document.getElementById('aiFetchList');
  const titleEl = document.getElementById('aiFetchTitle');
  const countEl = document.getElementById('aiFetchCount');
  if (!dialog || !listEl) return;

  if (titleEl) titleEl.textContent = provider.name;
  if (countEl) countEl.textContent = '';
  listEl.innerHTML = '<div class="ai-fetch-loading">正在获取模型列表...</div>';
  dialog.style.display = 'flex';

  const apiKeyInput = document.getElementById('aiEditorApiKey');
  const baseURLInput = document.getElementById('aiEditorBaseURL');
  const envVarNameInput = document.getElementById('aiEditorEnvVarName');

  try {
    const result = await requestDetectModels(provider.id, {
      apiKey: apiKeyInput ? apiKeyInput.value.trim() : '',
      baseURL: baseURLInput ? baseURLInput.value.trim() : '',
      envVarName: envVarNameInput ? envVarNameInput.value.trim() : '',
    });

    if (result.error) {
      listEl.innerHTML = `<div class="ai-model-error" style="display:block;">模型获取失败：${result.error}。请检查 API Key 和网络连接后重试</div>`;
      return;
    }

    aiFetchAvailable = result.models || [];
    aiFetchActiveTab = 'all';
    const searchEl = document.getElementById('aiFetchSearch');
    if (searchEl) searchEl.value = '';
    renderFetchDialog(provider);
  } catch (error) {
    listEl.innerHTML = `<div class="ai-model-error" style="display:block;">模型获取失败：${error.message}</div>`;
  }
}

/**
 * 渲染获取模型弹框（tab + 搜索 + 分组列表）
 * @param {Object} provider - 供应商对象
 */
function renderFetchDialog(provider) {
  const listEl = document.getElementById('aiFetchList');
  const tabsEl = document.getElementById('aiFetchTabs');
  const countEl = document.getElementById('aiFetchCount');
  const searchEl = document.getElementById('aiFetchSearch');
  if (!listEl) return;

  const MF = window.ModelFamily;
  const addedIds = new Set((provider.models || []).map(m => m.id));

  // 类型统计
  const resolved = aiFetchAvailable.map(m => ({ ...m, _resolved: MF ? MF.resolveModel(m.id) : null }));
  const typeCounts = { all: resolved.length };
  resolved.forEach(m => {
    const t = m._resolved ? m._resolved.type : 'text';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  if (countEl) countEl.textContent = aiFetchAvailable.length ? `(${aiFetchAvailable.length})` : '';

  // tab 栏（0 个的类型不展示）
  if (tabsEl) {
    tabsEl.innerHTML = '';
    AI_FETCH_TABS.forEach(([key, label]) => {
      if (key !== 'all' && !typeCounts[key]) return;
      const tab = document.createElement('button');
      tab.className = 'ai-fetch-tab' + (aiFetchActiveTab === key ? ' active' : '');
      tab.textContent = `${label} ${typeCounts[key] || 0}`;
      tab.addEventListener('click', () => {
        aiFetchActiveTab = key;
        renderFetchDialog(provider);
      });
      tabsEl.appendChild(tab);
    });
  }

  // 过滤
  const keyword = (searchEl ? searchEl.value : '').trim().toLowerCase();
  let filtered = resolved.filter(m =>
    aiFetchActiveTab === 'all' || (m._resolved && m._resolved.type === aiFetchActiveTab)
  );
  if (keyword) {
    filtered = filtered.filter(m =>
      (m.id || '').toLowerCase().includes(keyword) || (m.name || '').toLowerCase().includes(keyword)
    );
  }

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="ai-fetch-loading">无匹配模型</div>';
    return;
  }

  const groups = MF ? MF.groupModels(filtered) : [{ key: 'all', title: '模型', icon: null, color: false, models: filtered }];

  groups.forEach(g => {
    const groupEl = document.createElement('div');
    groupEl.className = 'ai-model-group';

    const allAdded = g.models.every(m => addedIds.has(m.id));
    const header = document.createElement('div');
    header.className = 'ai-model-group-header';
    header.innerHTML = `
      ${MF ? MF.iconHtml(g.icon, g.color, g.title, g.dark) : ''}
      <span class="ai-family-title">${g.title}</span>
      <span class="ai-family-count">${g.models.length}</span>
      <span class="ai-group-spacer"></span>
      <button class="btn btn-icon btn-sm ai-fetch-group-add" title="${allAdded ? '该组已全部添加' : '添加该组全部模型'}" ${allAdded ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
    `;
    if (!allAdded) {
      header.querySelector('.ai-fetch-group-add').addEventListener('click', () => {
        g.models.forEach(m => {
          if (!addedIds.has(m.id)) {
            provider.models.push({ id: m.id, name: m.name || m.id });
            addedIds.add(m.id);
          }
        });
        renderFetchDialog(provider);
        renderModelGroups(provider);
      });
    }
    groupEl.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ai-model-group-body';
    g.models.forEach(m => {
      const added = addedIds.has(m.id);
      const r = m._resolved;
      const badges = r && r.caps
        ? [
            r.caps.vision ? `<span class="ai-cap-badge vision" title="支持视觉输入">${aiCapBadgeSvg('vision')}</span>` : '',
            r.caps.reasoning ? `<span class="ai-cap-badge reasoning" title="支持推理">${aiCapBadgeSvg('reasoning')}</span>` : '',
            r.caps.tools ? `<span class="ai-cap-badge tools" title="支持工具调用">${aiCapBadgeSvg('tools')}</span>` : '',
          ].join('')
        : '';

      const row = document.createElement('div');
      row.className = 'ai-model-row' + (added ? ' is-added' : '');
      row.innerHTML = `
        ${MF && r ? MF.iconHtml(r.icon, r.color, m.name || m.id, r.darkTile) : ''}
        <span class="ai-model-name" title="${m.id}">${m.name || m.id}</span>
        <span class="ai-model-badges">${badges}</span>
        <button class="btn btn-icon btn-sm ai-model-remove ${added ? 'is-added' : ''}" title="${added ? '移除' : '添加'}">
          ${added
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'}
        </button>
      `;
      row.querySelector('.ai-model-remove').addEventListener('click', () => {
        if (added) {
          const idx = provider.models.findIndex(pm => pm.id === m.id);
          if (idx >= 0) provider.models.splice(idx, 1);
        } else {
          provider.models.push({ id: m.id, name: m.name || m.id });
        }
        renderFetchDialog(provider);
        renderModelGroups(provider);
      });
      body.appendChild(row);
    });
    groupEl.appendChild(body);

    listEl.appendChild(groupEl);
  });
}

/**
 * 显示手动添加模型输入行（在模型分组列表顶部插入）
 */
function showModelAddInput() {
  const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
  const groupsEl = document.getElementById('aiModelGroups');
  if (!provider || !groupsEl) return;
  if (groupsEl.querySelector('.ai-model-add-row')) return; // 已存在

  const row = document.createElement('div');
  row.className = 'ai-model-row ai-model-add-row';
  row.innerHTML = `
    <span class="ai-icon ai-icon-fallback">+</span>
    <input type="text" class="text-input ai-model-add-input" placeholder="输入模型 ID，回车添加" autocomplete="off">
  `;
  groupsEl.prepend(row);
  const input = row.querySelector('.ai-model-add-input');
  input.focus();

  const commit = () => {
    const id = input.value.trim();
    if (id && !provider.models.some(m => m.id === id)) {
      provider.models.push({ id, name: id });
    }
    renderModelGroups(provider);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') renderModelGroups(provider);
  });
  input.addEventListener('blur', commit);
}

// ==================== 添加供应商弹框 ====================

/**
 * 显示添加供应商弹窗（居中模态：内置供应商图标网格 + 自定义供应商内联表单）
 */
function showAddProviderDialog() {
  const dialog = document.getElementById('aiAddDialog');
  if (!dialog) return;

  const searchEl = document.getElementById('aiAddSearch');
  if (searchEl) searchEl.value = '';
  // 收起自定义表单
  const customForm = document.getElementById('aiAddCustomForm');
  if (customForm) customForm.style.display = 'none';
  const customErr = document.getElementById('aiCustomError');
  if (customErr) customErr.style.display = 'none';

  renderAddProviderGrid('');
  dialog.style.display = 'flex';
  if (searchEl) searchEl.focus();
}

/**
 * 渲染添加供应商弹框的内置供应商图标网格
 * @param {string} filterText - 搜索关键词
 */
function renderAddProviderGrid(filterText) {
  const gridEl = document.getElementById('aiAddGrid');
  if (!gridEl) return;

  const keyword = (filterText || '').trim().toLowerCase();
  const addedIds = new Set(aiProvidersList.map(p => p.id));

  const matched = aiProvidersCatalog.filter(p =>
    !addedIds.has(p.id) &&
    (!keyword || p.id.toLowerCase().includes(keyword) || p.name.toLowerCase().includes(keyword))
  );

  gridEl.innerHTML = '';

  if (matched.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ai-fetch-loading';
    empty.textContent = keyword ? '无匹配供应商' : '内置供应商均已添加';
    gridEl.appendChild(empty);
    return;
  }

  const MF = window.ModelFamily;
  matched.forEach(p => {
    const cell = document.createElement('div');
    cell.className = 'ai-add-cell';
    cell.dataset.providerId = p.id;

    const iconInfo = MF ? MF.getProviderIcon(p.id) : null;
    cell.innerHTML = `
      <span class="ai-add-cell-icon">${MF ? MF.iconHtml(iconInfo && iconInfo.icon, iconInfo ? iconInfo.color : false, p.name, iconInfo ? iconInfo.dark : false) : ''}</span>
      <span class="ai-add-cell-name" title="${p.name}">${p.name}</span>
    `;

    cell.addEventListener('click', () => {
      const dialog = document.getElementById('aiAddDialog');
      if (dialog) dialog.style.display = 'none';
      // 将未配置的供应商临时加入列表以便 showEditorForm 能找到它，
      // 用户填写 API Key 点击「保存」时才实际写入后端
      if (!aiProvidersList.find(lp => lp.id === p.id)) {
        aiProvidersList.push({ ...p, configured: false });
      }
      renderProviderList();
      showEditorForm(p.id);
    });

    gridEl.appendChild(cell);
  });
}

/**
 * 创建自定义供应商（弹框内联表单提交）
 */
async function createCustomProvider() {
  const nameInput = document.getElementById('aiCustomName');
  const baseURLInput = document.getElementById('aiCustomBaseURL');
  const apiKeyInput = document.getElementById('aiCustomApiKey');
  const errEl = document.getElementById('aiCustomError');
  const createBtn = document.getElementById('aiCustomCreateBtn');

  const name = nameInput ? nameInput.value.trim() : '';
  const baseURL = baseURLInput ? baseURLInput.value.trim() : '';
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

  if (!name) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = '请填写供应商名称'; }
    return;
  }
  if (!baseURL) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = '请填写 Base URL'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  try {
    if (createBtn) { createBtn.disabled = true; createBtn.textContent = '创建中...'; }
    const customId = 'custom-' + Date.now();
    await settingsApi('ai/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: customId,
        apiKey: apiKey || '',
        isBuiltin: false,
        displayName: name,
        baseURL,
      }),
    });

    const dialog = document.getElementById('aiAddDialog');
    if (dialog) dialog.style.display = 'none';

    await loadAISettings();
    showEditorForm(customId);

    // 创建时填了 Key：自动拉取模型（<10 全加，>=10 每组取最新）
    if (apiKey) {
      await autoPopulateModels(customId, { apiKey, baseURL });
    }
  } catch (error) {
    console.error('[Realm] 添加自定义供应商失败:', error);
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = '创建失败: ' + error.message; }
  } finally {
    if (createBtn) { createBtn.disabled = false; createBtn.textContent = '创建'; }
  }
}

/**
 * 切换供应商启用状态（立即生效，无需点保存）
 * 禁用后聊天框模型选择不展示该供应商；存储的激活记录保留，重新启用后恢复
 * @param {boolean} enabled
 */
async function setProviderEnabled(enabled) {
  const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
  if (!provider) return;

  provider.enabled = enabled;
  const toggle = document.getElementById('aiEnableToggle');
  if (toggle) {
    toggle.classList.toggle('on', enabled);
    toggle.setAttribute('aria-checked', String(enabled));
  }
  renderProviderList();

  // 未配置的供应商（尚未保存过后端）只改本地状态
  if (!provider.configured) return;

  try {
    await settingsApi('ai/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider.id,
        apiKey: '__keep__',
        model: provider.activeModel || null,
        enabled,
        setActive: false,
        isBuiltin: provider.isBuiltin !== false,
      }),
    });
    showToast(enabled ? '供应商已启用' : '供应商已停用，聊天框将不再展示');
  } catch (error) {
    // 回滚
    provider.enabled = !enabled;
    if (toggle) {
      toggle.classList.toggle('on', !enabled);
      toggle.setAttribute('aria-checked', String(!enabled));
    }
    renderProviderList();
    showToast('操作失败: ' + error.message, 'error');
  }
}

/**
 * 初始化 AI 助手设置事件监听
 */
function setupAISettingsListeners() {
  // 搜索框过滤
  const searchInput = document.getElementById('aiProviderSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderProviderList());
  }

  // 添加供应商按钮（打开统一弹框）
  const addProviderBtn = document.getElementById('aiAddProviderBtn');
  if (addProviderBtn) {
    addProviderBtn.addEventListener('click', showAddProviderDialog);
  }

  // 空状态的添加按钮
  const emptyAddBtn = document.getElementById('aiEmptyAddBtn');
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener('click', showAddProviderDialog);
  }

  // 添加弹框：关闭 / 搜索 / 自定义表单展开 / 创建
  const addDialog = document.getElementById('aiAddDialog');
  const addDialogClose = document.getElementById('aiAddDialogClose');
  if (addDialogClose) {
    addDialogClose.addEventListener('click', () => { if (addDialog) addDialog.style.display = 'none'; });
  }
  if (addDialog) {
    addDialog.addEventListener('click', (e) => {
      if (e.target === addDialog) addDialog.style.display = 'none'; // 点遮罩关闭
    });
  }
  const addSearch = document.getElementById('aiAddSearch');
  if (addSearch) {
    addSearch.addEventListener('input', () => renderAddProviderGrid(addSearch.value));
  }
  const customHeader = document.getElementById('aiAddCustomHeader');
  if (customHeader) {
    customHeader.addEventListener('click', () => {
      const form = document.getElementById('aiAddCustomForm');
      if (!form) return;
      const show = form.style.display !== 'flex';
      form.style.display = show ? 'flex' : 'none';
      customHeader.classList.toggle('expanded', show);
      if (show) {
        const nameInput = document.getElementById('aiCustomName');
        if (nameInput) nameInput.focus();
      }
    });
  }
  const customCreateBtn = document.getElementById('aiCustomCreateBtn');
  if (customCreateBtn) {
    customCreateBtn.addEventListener('click', createCustomProvider);
  }

  // 启用/停用开关
  const enableToggle = document.getElementById('aiEnableToggle');
  if (enableToggle) {
    enableToggle.addEventListener('click', () => {
      setProviderEnabled(!enableToggle.classList.contains('on'));
    });
  }

  // 保存配置按钮
  const saveBtn = document.getElementById('aiSaveProviderBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveProviderConfig);
  }

  // 删除供应商按钮
  const deleteBtn = document.getElementById('aiDeleteProviderBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteProvider);
  }

  // 模型搜索框（放大镜按钮切换显隐）
  const modelSearchBtn = document.getElementById('aiModelSearchBtn');
  const modelSearch = document.getElementById('aiModelSearch');
  if (modelSearchBtn && modelSearch) {
    modelSearchBtn.addEventListener('click', () => {
      // CSS 默认 display:none（markup 内联 style 会被 CSP 拦截），显隐用 'block'/'none'
      const show = modelSearch.style.display !== 'block';
      modelSearch.style.display = show ? 'block' : 'none';
      modelSearchBtn.classList.toggle('active', show);
      if (show) modelSearch.focus();
      else {
        modelSearch.value = '';
        const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
        if (provider) renderModelGroups(provider);
      }
    });
    modelSearch.addEventListener('input', () => {
      const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
      if (provider) renderModelGroups(provider);
    });
  }

  // 获取模型列表按钮 + 弹框
  const fetchBtn = document.getElementById('aiFetchModelsBtn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', showFetchModelsDialog);
  }
  const fetchDialog = document.getElementById('aiFetchDialog');
  const fetchDialogClose = document.getElementById('aiFetchDialogClose');
  if (fetchDialogClose) {
    fetchDialogClose.addEventListener('click', () => { if (fetchDialog) fetchDialog.style.display = 'none'; });
  }
  if (fetchDialog) {
    fetchDialog.addEventListener('click', (e) => {
      if (e.target === fetchDialog) fetchDialog.style.display = 'none';
    });
  }
  const fetchSearch = document.getElementById('aiFetchSearch');
  if (fetchSearch) {
    fetchSearch.addEventListener('input', () => {
      const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
      if (provider) renderFetchDialog(provider);
    });
  }
  const fetchAddAllBtn = document.getElementById('aiFetchAddAllBtn');
  if (fetchAddAllBtn) {
    fetchAddAllBtn.addEventListener('click', () => {
      const provider = aiProvidersList.find(p => p.id === aiSelectedProviderId);
      if (!provider) return;
      const addedIds = new Set(provider.models.map(m => m.id));
      aiFetchAvailable.forEach(m => {
        if (!addedIds.has(m.id)) {
          provider.models.push({ id: m.id, name: m.name || m.id });
          addedIds.add(m.id);
        }
      });
      renderFetchDialog(provider);
      renderModelGroups(provider);
    });
  }

  // 手动添加模型按钮
  const modelAddBtn = document.getElementById('aiModelAddBtn');
  if (modelAddBtn) {
    modelAddBtn.addEventListener('click', showModelAddInput);
  }

  // API Key 显示/隐藏切换
  const toggleBtn = document.getElementById('aiEditorToggleKey');
  const apiKeyInput = document.getElementById('aiEditorApiKey');
  if (toggleBtn && apiKeyInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? '隐藏' : '显示';
    });
  }

  // 环境变量名修改后重新检测
  const envVarNameInput = document.getElementById('aiEditorEnvVarName');
  if (envVarNameInput) {
    let envVarDebounce = null;
    envVarNameInput.addEventListener('input', () => {
      clearTimeout(envVarDebounce);
      envVarDebounce = setTimeout(async () => {
        if (!aiSelectedProviderId) return;
        const envVarHint = document.getElementById('aiEnvVarHint');
        if (!envVarHint) return;
        try {
          const customName = envVarNameInput.value.trim();
          const envResult = await settingsApi(
            `ai/providers/${aiSelectedProviderId}/env-var`, {}, customName ? { customName } : {}
          );
          if (envResult && envResult.found) {
            envVarHint.style.display = 'block';
            envVarHint.className = 'ai-env-var-hint env-found';
            envVarHint.textContent = `检测到环境变量 ${envResult.name}，已自动使用`;
          } else if (envResult && envResult.name) {
            envVarHint.style.display = 'block';
            envVarHint.className = 'ai-env-var-hint env-not-found';
            envVarHint.textContent = `未检测到环境变量 ${envResult.name}，将使用手动输入的 API Key`;
          } else {
            envVarHint.style.display = 'none';
          }
        } catch {
          // 忽略
        }
      }, 500);
    });
  }
}

// ==================== 初始化 ====================

/**
 * 初始化设置页面
 */
async function init() {
  console.log('[Realm] 设置页面初始化');

  // 加载设置
  await loadSettings();

  // 初始化事件监听
  setupEventListeners();

  // 初始化凭据管理事件监听
  setupCredentialListeners();

  // 初始化地址管理事件监听
  setupAddressListeners();

  // 初始化 AI 助手设置事件监听
  setupAISettingsListeners();

  // 初始化搜索配置事件监听
  setupSearchConfigListeners();

  // 检查 URL 参数中的 tab 指示；无参数时显式落在通用页，
  // 避免仅依赖 HTML 内联 display:none 兜底（内联样式失效会导致多个 section 同时显示）
  const tabParam = pageParams.get('tab');
  switchSettingsPage(tabParam || 'general');

  // webview 可见性变化时刷新设置（同步收藏栏显示等外部变更）
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const settings = await settingsApi('get');
      if (elements.showBookmarksBar && settings.bookmarksBar) {
        elements.showBookmarksBar.checked = settings.bookmarksBar.visible !== false;
      }
    } catch (e) {
      // 忽略刷新失败
    }
  });

  // 轮询后备：每 2 秒同步一次收藏栏开关状态
  setInterval(async () => {
    try {
      const settings = await settingsApi('get');
      if (elements.showBookmarksBar && settings.bookmarksBar) {
        const expected = settings.bookmarksBar.visible !== false;
        if (elements.showBookmarksBar.checked !== expected) {
          elements.showBookmarksBar.checked = expected;
        }
      }
    } catch (e) {
      // 忽略
    }
  }, 2000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

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
    throw new Error(`设置 API 请求失败: ${res.status}`);
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

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
const elements = {
  // 通用设置
  defaultBrowserStatus: document.getElementById('defaultBrowserStatus'),
  setDefaultBrowserBtn: document.getElementById('setDefaultBrowserBtn'),
  retentionDays: document.getElementById('retentionDays'),
  defaultContainer: document.getElementById('defaultContainer'),
  restoreTabsOnLaunch: document.getElementById('restoreTabsOnLaunch'),
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

  // 关于页面
  aboutVersion: document.getElementById('aboutVersion'),
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
  const activeItem = document.querySelector(`.sidebar-item[data-page="${pageName}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }

  // 切换到特定页面时刷新数据
  if (pageName === 'rules') {
    refreshRulesList();
  } else if (pageName === 'shortcuts') {
    refreshShortcutsList();
  }
}

// ==================== UI 更新函数 ====================

/**
 * 显示 Toast 提示
 * @param {string} message - 提示消息
 */
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2000);
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
    option.textContent = `${container.icon} ${container.name}`;
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

    // 更新版本号
    const version = await settingsApi('version').catch(() => '--');
    elements.sidebarVersion.textContent = `版本: ${version}`;
    elements.aboutVersion.textContent = `版本: ${version}`;

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
    const containerName = container ? `${container.icon} ${container.name}` : rule.containerId;

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
    showToast(`已导出 ${data.length} 条规则`);
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
};

/**
 * 快捷键分组配置
 */
const SHORTCUT_GROUPS = {
  '标签页操作': ['newTab', 'closeTab', 'nextTab', 'prevTab'],
  '导航操作': ['reload', 'back', 'forward'],
  '收藏': ['bookmark'],
  '其他': ['openSettings'],
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

  // 规则管理事件
  elements.addRuleBtn.addEventListener('click', () => {
    elements.rulesAddForm.style.display = 'flex';
    elements.addRuleBtn.style.display = 'none';
    // 填充容器选项
    elements.ruleContainerSelect.innerHTML = '';
    state.containers.forEach(container => {
      const option = document.createElement('option');
      option.value = container.id;
      option.textContent = container.icon + ' ' + container.name;
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

  // 检查 URL 参数中的 tab 指示
  const tabParam = pageParams.get('tab');
  if (tabParam) {
    switchSettingsPage(tabParam);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

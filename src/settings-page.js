/**
 * Realm Browser - 设置页面逻辑
 *
 * realm://settings 内部页面的渲染逻辑
 * 负责设置读取、保存、默认浏览器引导
 */

// ==================== 状态管理 ====================

// 页面运行在 webview guest 中，IPC 会被主进程 assertTrustedSender（CR-4）拒绝，
// 因此数据访问走本地 HTTP 服务器的 /api/settings/* 端点。
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
    return res.json();
  } catch (error) {
    console.error('[Realm] 获取容器列表失败:', error);
    return [];
  }
}

// ==================== DOM 元素 ====================

/** DOM 元素引用 */
const elements = {
  defaultBrowserStatus: document.getElementById('defaultBrowserStatus'),
  setDefaultBrowserBtn: document.getElementById('setDefaultBrowserBtn'),
  retentionDays: document.getElementById('retentionDays'),
  defaultContainer: document.getElementById('defaultContainer'),
  toast: document.getElementById('toast'),
};

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

// ==================== 事件处理 ====================

/**
 * 初始化事件监听器
 */
function setupEventListeners() {
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
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

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

  cookiesModal: document.getElementById('cookiesModal'),
  cookiesModalTitle: document.getElementById('cookiesModalTitle'),
  cookiesList: document.getElementById('cookiesList'),
  clearCookiesBtn: document.getElementById('clearCookiesBtn'),
  refreshCookiesBtn: document.getElementById('refreshCookiesBtn'),
  closeCookiesModal: document.getElementById('closeCookiesModal'),
};

// 应用状态
const state = {
  containers: [],
  currentContainer: 'default',
  selectedColor: '#3B82F6',
  selectedIcon: '🌐',
  editingContainerId: null,
  panelVisible: false,
};

/**
 * 初始化应用
 */
async function init() {
  console.log('[Realm Renderer] 初始化...');

  // 加载容器列表
  await loadContainers();

  // 设置事件监听
  setupEventListeners();

  // 监听容器切换事件
  window.realmAPI.onContainerSwitched(handleContainerSwitched);

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
 */
function renderContainerPanelList() {
  const html = state.containers.map(container => `
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
        <button class="action-btn" data-action="delete" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
          </svg>
        </button>
      </div>
      ${container.id === state.currentContainer ? '<div class="check-mark">✓</div>' : ''}
    </div>
  `).join('');

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
    console.log(`[Realm] 切换到容器: ${containerId}`);
  }
}

/**
 * 处理容器切换事件（来自主进程）
 */
function handleContainerSwitched(data) {
  state.currentContainer = data.containerId;
  renderContainerList();
  renderContainerPanelList();
  updateContainerIndicator();
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

  const html = cookies.map(cookie => `
    <div class="cookie-item">
      <span class="cookie-name">${cookie.name}</span>
      <span class="cookie-value">${cookie.value}</span>
      <span class="cookie-domain">${cookie.domain}</span>
    </div>
  `).join('');

  elements.cookiesList.innerHTML = html;
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
      // TODO: 实现删除功能
      console.log('[Realm] 删除容器:', containerId);
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

  // Cookie 管理按钮
  elements.cookiesBtn.addEventListener('click', showCookiesModal);
  elements.clearCookiesBtn.addEventListener('click', clearContainerCookies);
  elements.refreshCookiesBtn.addEventListener('click', refreshCookiesList);
  elements.closeCookiesModal.addEventListener('click', () => {
    elements.cookiesModal.close();
  });

  // URL 输入框回车
  elements.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const url = elements.urlInput.value.trim();
      if (url) {
        // TODO: 在 webview 中加载 URL
        console.log('[Realm] 导航到:', url);
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
        elements.containerModal.close();
        elements.cookiesModal.close();
      }
    }
  });
}

// 初始化应用
init();

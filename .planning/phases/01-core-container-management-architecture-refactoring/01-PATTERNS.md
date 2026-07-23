# Phase 1: Core Container Management + Architecture Refactoring - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 8 (3 new + 5 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `container-manager.js` | service | CRUD | `main.js:35-50, 162-212` | exact |
| `window-manager.js` | service | request-response | `main.js:56-127` | exact |
| `ipc-handlers.js` | controller | request-response | `main.js:134-245` | exact |
| `main.js` | entry | event-driven | `main.js:249-273` | exact |
| `src/preload.js` | bridge | request-response | `src/preload.js` | exact |
| `src/renderer.js` | component | request-response | `src/renderer.js` | exact |
| `src/index.html` | component | request-response | `src/index.html` | exact |
| `src/styles/main.css` | config | N/A | `src/styles/main.css` | exact |

## Pattern Assignments

### `container-manager.js` (service, CRUD)

**Analog:** `main.js` lines 35-50 (initContainers), lines 162-212 (CRUD operations)

**Imports pattern** (lines 1-10):
```javascript
const { session } = require('electron');
const Store = require('electron-store');
```

**Config store pattern** (lines 13-14):
```javascript
const configStore = new Store({ name: 'realm-config' });
```

**Container storage pattern** (lines 16-19):
```javascript
const containers = new Map();
```

**Default containers pattern** (lines 24-29):
```javascript
const DEFAULT_CONTAINERS = [
  { id: 'default', name: '默认', color: '#6B7280', icon: '🌐' },
  { id: 'work', name: '工作', color: '#3B82F6', icon: '💼' },
  { id: 'personal', name: '个人', color: '#10B981', icon: '👤' },
  { id: 'finance', name: '金融', color: '#F59E0B', icon: '🏦' },
];
```

**Init containers pattern** (lines 35-50):
```javascript
function initContainers() {
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers.forEach(container => {
    const partition = `persist:container-${container.id}`;
    const ses = session.fromPartition(partition);
    containers.set(container.id, {
      ...container,
      session: ses,
      partition,
    });
    console.log(`[Realm] 初始化容器: ${container.name} (${partition})`);
  });
}
```

**Create container pattern** (lines 162-188):
```javascript
// 注意：需要添加 ID 唯一性检查（见 Shared Patterns）
function createContainer({ name, color, icon }) {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const container = {
    id,
    name,
    color: color || '#6B7280',
    icon: icon || '📌',
  };
  const partition = `persist:container-${id}`;
  const ses = session.fromPartition(partition);
  containers.set(id, { ...container, session: ses, partition });
  
  // 持久化
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers.push(container);
  configStore.set('containers', savedContainers);
  
  console.log(`[Realm] 新建容器: ${name} (${partition})`);
  return container;
}
```

**Delete container pattern** (lines 193-212):
```javascript
function deleteContainer(containerId) {
  if (containerId === 'default') {
    return { success: false, message: '无法删除默认容器' };
  }
  let savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers = savedContainers.filter(c => c.id !== containerId);
  configStore.set('containers', savedContainers);
  
  const container = containers.get(containerId);
  if (container) {
    container.session.clearStorageData();
    containers.delete(containerId);
  }
  console.log(`[Realm] 删除容器: ${containerId}`);
  return { success: true };
}
```

**Module exports pattern:**
```javascript
module.exports = {
  initContainers,
  getContainers,
  createContainer,
  updateContainer,  // 新增：编辑容器
  deleteContainer,
  getContainer: (id) => containers.get(id),
};
```

---

### `window-manager.js` (service, request-response)

**Analog:** `main.js` lines 56-96 (createMainWindow), lines 102-127 (switchContainer)

**Imports pattern:**
```javascript
const { BrowserWindow } = require('electron');
const path = require('path');
```

**Window-container mapping pattern** (line 19):
```javascript
const windowContainerMap = new Map();
```

**Create main window pattern** (lines 56-96):
```javascript
function createMainWindow(containerId = 'default', container) {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      session: container.session,
    },
  });
  windowContainerMap.set(mainWindow.id, containerId);
  mainWindow.loadFile('src/index.html');
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.on('closed', () => {
    windowContainerMap.delete(mainWindow.id);
  });
  
  return mainWindow;
}
```

**Switch container pattern** (lines 102-127):
```javascript
function switchContainer(windowId, newContainerId, container) {
  windowContainerMap.set(windowId, newContainerId);
  const win = BrowserWindow.fromId(windowId);
  if (win) {
    win.webContents.send('container-switched', {
      containerId: newContainerId,
      container: {
        id: container.id,
        name: container.name,
        color: container.color,
        icon: container.icon,
      },
    });
  }
  return true;
}
```

**Module exports pattern:**
```javascript
module.exports = {
  createMainWindow,
  switchContainer,
  getCurrentContainer: (windowId) => windowContainerMap.get(windowId) || 'default',
};
```

---

### `ipc-handlers.js` (controller, request-response)

**Analog:** `main.js` lines 134-245 (IPC handlers)

**Imports pattern:**
```javascript
const { ipcMain } = require('electron');
const containerManager = require('./container-manager');
const windowManager = require('./window-manager');
```

**IPC handler registration pattern** (lines 134-245):
```javascript
function registerHandlers() {
  // 容器列表
  ipcMain.handle('container:list', () => {
    return containerManager.getContainers();
  });
  
  // 创建容器
  ipcMain.handle('container:create', (event, { name, color, icon }) => {
    return containerManager.createContainer({ name, color, icon });
  });
  
  // 删除容器
  ipcMain.handle('container:delete', (event, containerId) => {
    return containerManager.deleteContainer(containerId);
  });
  
  // 获取当前容器
  ipcMain.handle('container:current', (event) => {
    const windowId = event.sender.id;
    return windowManager.getCurrentContainer(windowId);
  });
  
  // 切换容器
  ipcMain.handle('container:switch', (event, containerId) => {
    const windowId = event.sender.id;
    const container = containerManager.getContainer(containerId);
    if (!container) return false;
    return windowManager.switchContainer(windowId, containerId, container);
  });
  
  console.log('[Realm] IPC 处理器已注册');
}
```

**Module exports pattern:**
```javascript
module.exports = { registerHandlers };
```

---

### `main.js` (entry, event-driven)

**Analog:** `main.js` lines 249-273 (app lifecycle)

**Imports pattern:**
```javascript
const { app, BrowserWindow } = require('electron');
const containerManager = require('./container-manager');
const windowManager = require('./window-manager');
const { registerHandlers } = require('./ipc-handlers');
```

**App lifecycle pattern** (lines 249-273):
```javascript
app.whenReady().then(() => {
  console.log('[Realm] 应用启动');
  
  // 注册 IPC 处理器
  registerHandlers();
  
  // 初始化容器
  containerManager.initContainers();
  
  // 创建主窗口
  const defaultContainer = containerManager.getContainer('default');
  windowManager.createMainWindow('default', defaultContainer);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const defaultContainer = containerManager.getContainer('default');
      windowManager.createMainWindow('default', defaultContainer);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[Realm] 主进程已加载');
```

---

### `src/preload.js` (bridge, request-response)

**Analog:** `src/preload.js` (exact match, update channel names)

**Current pattern** (lines 13-81):
```javascript
contextBridge.exposeInMainWorld('realmAPI', {
  getContainers: () => ipcRenderer.invoke('get-containers'),
  getCurrentContainer: () => ipcRenderer.invoke('get-current-container'),
  switchContainer: (containerId) => ipcRenderer.invoke('switch-container', containerId),
  createContainer: (containerConfig) => ipcRenderer.invoke('create-container', containerConfig),
  deleteContainer: (containerId) => ipcRenderer.invoke('delete-container', containerId),
  // ... other methods
});
```

**Updated pattern (channel names):**
```javascript
contextBridge.exposeInMainWorld('realmAPI', {
  getContainers: () => ipcRenderer.invoke('container:list'),
  getCurrentContainer: () => ipcRenderer.invoke('container:current'),
  switchContainer: (containerId) => ipcRenderer.invoke('container:switch', containerId),
  createContainer: (containerConfig) => ipcRenderer.invoke('container:create', containerConfig),
  updateContainer: (containerId, updates) => ipcRenderer.invoke('container:update', containerId, updates),
  deleteContainer: (containerId) => ipcRenderer.invoke('container:delete', containerId),
  // ... other methods保持不变
});
```

---

### `src/renderer.js` (component, request-response)

**Analog:** `src/renderer.js` (extend existing patterns)

**Elements pattern** (lines 8-38):
```javascript
const elements = {
  // 现有元素...
  containerList: document.getElementById('containerList'),
  containerIndicator: document.getElementById('containerIndicator'),
  
  // 新增：Popover 面板元素
  containerPanel: document.getElementById('containerPanel'),
  panelContainerList: document.getElementById('panelContainerList'),
  
  // 新增：容器 CRUD Modal 元素
  containerModal: document.getElementById('containerModal'),
  containerForm: document.getElementById('containerForm'),
  containerNameInput: document.getElementById('containerName'),
  colorOptions: document.querySelectorAll('.color-option'),
  emojiOptions: document.querySelectorAll('.emoji-option'),
  
  // 新增：删除确认 Modal 元素
  deleteConfirmModal: document.getElementById('deleteConfirmModal'),
  deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),
};
```

**State pattern** (lines 41-45):
```javascript
const state = {
  containers: [],
  currentContainer: 'default',
  selectedColor: '#3B82F6',
  selectedIcon: '📌',
  editingContainerId: null,  // 新增：编辑模式标识
};
```

**Popover 显示/隐藏模式:**
```javascript
function showContainerPanel() {
  const panel = elements.containerPanel;
  const indicator = elements.containerIndicator;
  
  // 定位面板
  const rect = indicator.getBoundingClientRect();
  panel.style.top = `${rect.bottom + 4}px`;
  panel.style.left = `${rect.left}px`;
  panel.style.width = '280px';
  
  renderContainerPanelList();
  panel.classList.add('visible');
  
  // 点击外部关闭
  document.addEventListener('click', handleOutsideClick);
}

function hideContainerPanel() {
  elements.containerPanel.classList.remove('visible');
  document.removeEventListener('click', handleOutsideClick);
}

function handleOutsideClick(event) {
  const panel = elements.containerPanel;
  const indicator = elements.containerIndicator;
  if (!panel.contains(event.target) && !indicator.contains(event.target)) {
    hideContainerPanel();
  }
}
```

**容器面板列表渲染模式（使用事件委托）:**
```javascript
function renderContainerPanelList() {
  const html = state.containers.map(container => `
    <div class="panel-container-item ${container.id === state.currentContainer ? 'active' : ''}"
         data-container-id="${container.id}">
      <div class="container-dot" style="background-color: ${container.color}"></div>
      <div class="container-info">
        <div class="container-name">${container.icon} ${container.name}</div>
      </div>
      <div class="container-actions">
        <button class="btn-icon btn-edit" data-container-id="${container.id}" title="编辑">
          <svg>...</svg>
        </button>
        ${container.id !== 'default' ? `
          <button class="btn-icon btn-delete" data-container-id="${container.id}" title="删除">
            <svg>...</svg>
          </button>
        ` : ''}
      </div>
      ${container.id === state.currentContainer ? '<span class="check-mark">✓</span>' : ''}
    </div>
  `).join('');
  
  elements.panelContainerList.innerHTML = html;
}

// 事件委托：只绑定一次
elements.panelContainerList.addEventListener('click', (event) => {
  const target = event.target.closest('[data-container-id]');
  if (!target) return;
  
  const containerId = target.dataset.containerId;
  
  if (target.classList.contains('btn-edit')) {
    showEditContainerModal(containerId);
  } else if (target.classList.contains('btn-delete')) {
    showDeleteConfirmModal(containerId);
  } else {
    switchContainer(containerId);
  }
});
```

**统一 Modal 模式（创建/编辑复用）:**
```javascript
function showCreateContainerModal() {
  state.editingContainerId = null;
  elements.containerNameInput.value = '';
  state.selectedColor = '#3B82F6';
  state.selectedIcon = '📌';
  updateColorSelection();
  updateEmojiSelection();
  elements.containerModal.querySelector('h2').textContent = '新建容器';
  elements.containerModal.showModal();
}

function showEditContainerModal(containerId) {
  const container = state.containers.find(c => c.id === containerId);
  if (!container) return;
  
  state.editingContainerId = containerId;
  elements.containerNameInput.value = container.name;
  state.selectedColor = container.color;
  state.selectedIcon = container.icon;
  updateColorSelection();
  updateEmojiSelection();
  elements.containerModal.querySelector('h2').textContent = '编辑容器';
  elements.containerModal.showModal();
}
```

**删除确认模式:**
```javascript
async function showDeleteConfirmModal(containerId) {
  const container = state.containers.find(c => c.id === containerId);
  if (!container || container.id === 'default') return;
  
  state.editingContainerId = containerId;
  // 更新 Modal 内容显示容器信息
  elements.deleteConfirmModal.querySelector('.container-preview').innerHTML = `
    <div class="container-dot" style="background-color: ${container.color}"></div>
    <span>${container.icon} ${container.name}</span>
  `;
  elements.deleteConfirmModal.showModal();
}

async function confirmDeleteContainer() {
  const containerId = state.editingContainerId;
  const result = await window.realmAPI.deleteContainer(containerId);
  
  if (result.success) {
    if (containerId === state.currentContainer) {
      await switchContainer('default');
    }
    await loadContainers();
    elements.deleteConfirmModal.close();
  } else {
    showErrorMessage(result.message);
  }
}
```

---

### `src/index.html` (component, request-response)

**Analog:** `src/index.html` (add new UI components)

**Popover 面板 HTML 结构:**
```html
<!-- 容器下拉面板 -->
<div class="container-panel" id="containerPanel">
  <div class="panel-header">
    <span class="panel-title">容器列表</span>
    <button class="btn-icon" id="addContainerBtn" title="新建容器">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>
  <div class="panel-list" id="panelContainerList">
    <!-- 容器列表将由 JavaScript 动态生成 -->
  </div>
</div>
```

**统一容器 Modal HTML 结构:**
```html
<!-- 容器创建/编辑对话框 -->
<dialog class="modal" id="containerModal">
  <div class="modal-content">
    <h2>新建容器</h2>
    <form id="containerForm">
      <div class="form-group">
        <label for="containerName">容器名称</label>
        <input type="text" id="containerName" required placeholder="例如：工作、个人、测试">
        <div class="error-message" id="nameError"></div>
      </div>
      <div class="form-group">
        <label>容器颜色</label>
        <div class="color-picker">
          <button type="button" class="color-option" data-color="#EF4444" style="background: #EF4444"></button>
          <button type="button" class="color-option" data-color="#F97316" style="background: #F97316"></button>
          <button type="button" class="color-option" data-color="#F59E0B" style="background: #F59E0B"></button>
          <button type="button" class="color-option" data-color="#10B981" style="background: #10B981"></button>
          <button type="button" class="color-option" data-color="#3B82F6" style="background: #3B82F6"></button>
          <button type="button" class="color-option" data-color="#8B5CF6" style="background: #8B5CF6"></button>
          <button type="button" class="color-option" data-color="#EC4899" style="background: #EC4899"></button>
          <button type="button" class="color-option" data-color="#6B7280" style="background: #6B7280"></button>
        </div>
      </div>
      <div class="form-group">
        <label>容器图标</label>
        <div class="emoji-picker">
          <button type="button" class="emoji-option" data-icon="🌐">🌐</button>
          <button type="button" class="emoji-option" data-icon="💼">💼</button>
          <button type="button" class="emoji-option" data-icon="👤">👤</button>
          <button type="button" class="emoji-option" data-icon="🏦">🏦</button>
          <button type="button" class="emoji-option" data-icon="🎮">🎮</button>
          <button type="button" class="emoji-option" data-icon="📚">📚</button>
          <button type="button" class="emoji-option" data-icon="🛒">🛒</button>
          <button type="button" class="emoji-option" data-icon="💰">💰</button>
          <button type="button" class="emoji-option" data-icon="🏠">🏠</button>
          <button type="button" class="emoji-option" data-icon="📧">📧</button>
          <button type="button" class="emoji-option" data-icon="🎯">🎯</button>
          <button type="button" class="emoji-option" data-icon="🔬">🔬</button>
          <button type="button" class="emoji-option" data-icon="🎨">🎨</button>
          <button type="button" class="emoji-option" data-icon="🎵">🎵</button>
          <button type="button" class="emoji-option" data-icon="📷">📷</button>
          <button type="button" class="emoji-option" data-icon="✈️">✈️</button>
          <button type="button" class="emoji-option" data-icon="🏥">🏥</button>
          <button type="button" class="emoji-option" data-icon="📌">📌</button>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancelContainerBtn">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  </div>
</dialog>
```

**删除确认 Modal HTML 结构:**
```html
<!-- 删除确认对话框 -->
<dialog class="modal" id="deleteConfirmModal">
  <div class="modal-content">
    <h2>删除容器</h2>
    <div class="delete-confirm-content">
      <p>确定要删除以下容器吗？</p>
      <div class="container-preview"></div>
      <p class="warning-text">删除后该容器的 Cookie 和浏览数据将被清除</p>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" id="cancelDeleteBtn">取消</button>
      <button type="button" class="btn btn-danger" id="deleteConfirmBtn">删除</button>
    </div>
  </div>
</dialog>
```

---

### `src/styles/main.css` (config, N/A)

**Analog:** `src/styles/main.css` (add new styles)

**Popover 面板样式:**
```css
.container-panel {
  position: fixed;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: none;
}

.container-panel.visible {
  display: block;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}

.panel-container-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.panel-container-item:hover {
  background-color: var(--bg-hover);
}

.panel-container-item.active {
  background-color: var(--bg-tertiary);
}

.container-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.2s;
}

.panel-container-item:hover .container-actions {
  opacity: 1;
}

.check-mark {
  color: var(--accent-color);
  font-weight: bold;
  margin-left: auto;
}
```

**Emoji 选择器样式:**
```css
.emoji-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.emoji-option {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}

.emoji-option:hover {
  transform: scale(1.1);
}

.emoji-option.selected {
  border-color: var(--accent-color);
  background-color: var(--bg-tertiary);
}
```

**删除确认样式:**
```css
.delete-confirm-content {
  margin-bottom: 20px;
}

.container-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
  margin: 12px 0;
}

.warning-text {
  color: var(--danger-color);
  font-size: 13px;
  margin-top: 8px;
}

.btn-danger {
  background-color: var(--danger-color);
  color: white;
}

.btn-danger:hover {
  background-color: #DC2626;
}
```

**错误提示样式:**
```css
.error-message {
  color: var(--danger-color);
  font-size: 12px;
  margin-top: 4px;
  display: none;
}

.error-message.visible {
  display: block;
}
```

---

## Shared Patterns

### 容器 ID 唯一性检查
**Source:** RESEARCH.md (Pitfall 1)
**Apply to:** `container-manager.js` 的 `createContainer` 和 `updateContainer` 函数

```javascript
const { randomUUID } = require('crypto');

function generateContainerId(name, existingIds) {
  const baseId = name.toLowerCase()
    .replace(/[^a-z0-9一-龥]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (!existingIds.has(baseId)) {
    return baseId;
  }
  
  // 碰撞时追加短 UUID
  const shortUuid = randomUUID().slice(0, 8);
  return `${baseId}-${shortUuid}`;
}
```

### 事件委托模式
**Source:** RESEARCH.md (Pitfall 2)
**Apply to:** `src/renderer.js` 中所有动态列表渲染

```javascript
// 错误：每次渲染都添加新监听器
function renderList() {
  containerList.innerHTML = containers.map(c => 
    `<div class="container-item" data-id="${c.id}">${c.name}</div>`
  ).join('');
  
  document.querySelectorAll('.container-item').forEach(item => {
    item.addEventListener('click', handleClick); // 会累积！
  });
}

// 正确：使用事件委托
containerList.addEventListener('click', (event) => {
  const target = event.target.closest('[data-container-id]');
  if (!target) return;
  handleContainerClick(target.dataset.containerId);
});
```

### Session 清理模式
**Source:** RESEARCH.md (Pitfall 3)
**Apply to:** `container-manager.js` 的 `deleteContainer` 函数

```javascript
async function deleteContainer(containerId) {
  const container = containers.get(containerId);
  if (!container) return;
  
  // 清理 Session 数据
  await container.session.clearStorageData();
  await container.session.clearCache();
  await container.session.closeAllConnections();
  
  // 从 Map 中移除
  containers.delete(containerId);
  
  // 更新持久化
  // ...
}
```

### 日志前缀模式
**Source:** `main.js` (lines 48, 186, 210, 272)
**Apply to:** 所有新模块

```javascript
// 主进程日志
console.log('[Realm] 初始化容器: ${container.name} (${partition})');
console.log('[Realm] 新建容器: ${name} (${partition})');
console.log('[Realm] 删除容器: ${containerId}');

// 渲染进程日志
console.log('[Realm Renderer] 初始化...');
```

### IPC 通道命名规范
**Source:** RESEARCH.md (Pattern 2)
**Apply to:** `ipc-handlers.js` 和 `src/preload.js`

```javascript
// 新格式：命名空间:操作
'container:list'
'container:create'
'container:update'
'container:delete'
'container:current'
'container:switch'

// 旧格式（已废弃）：
'get-containers'
'create-container'
'delete-container'
```

### 输入验证模式
**Source:** RESEARCH.md (Security Domain)
**Apply to:** `container-manager.js` 和 `src/renderer.js`

```javascript
// 主进程验证
function validateContainerName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: '容器名称不能为空' };
  }
  if (name.trim().length === 0) {
    return { valid: false, message: '容器名称不能为空' };
  }
  if (name.length > 50) {
    return { valid: false, message: '容器名称不能超过50个字符' };
  }
  return { valid: true };
}

// 渲染进程验证（实时反馈）
function validateNameInput(input) {
  const errorEl = document.getElementById('nameError');
  const value = input.value.trim();
  
  if (!value) {
    errorEl.textContent = '容器名称不能为空';
    errorEl.classList.add('visible');
    return false;
  }
  
  // 检查是否重名
  if (state.containers.some(c => c.name === value && c.id !== state.editingContainerId)) {
    errorEl.textContent = '容器名称已存在';
    errorEl.classList.add('visible');
    return false;
  }
  
  errorEl.classList.remove('visible');
  return true;
}
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | 所有文件均有对应 analog |

## Metadata

**Analog search scope:** `/Users/wxnacy/Projects/Realm/`
**Files scanned:** 6 (`main.js`, `src/preload.js`, `src/renderer.js`, `src/index.html`, `src/styles/main.css`, `package.json`)
**Pattern extraction date:** 2026-07-23

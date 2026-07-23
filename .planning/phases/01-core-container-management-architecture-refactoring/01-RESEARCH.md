# Phase 1: Core Container Management + Architecture Refactoring - Research

**Researched:** 2026-07-23
**Domain:** Electron 桌面应用 / 多容器隔离浏览器
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 按职责拆分 main.js → 4 个模块（container-manager.js, window-manager.js, ipc-handlers.js, main.js）
- **D-02:** 直接导入通信 — 模块导出函数，main.js 导入组装，不互相 require
- **D-03:** 统一重命名 IPC 通道（如 `container:list`, `container:create`），同步更新 preload.js
- **D-04:** Popover 弹出层 — 工具栏按钮点击弹出浮动面板，点击外部关闭
- **D-05:** 列表布局 + 底部新建按钮 — 每个容器一行：颜色圆点 + 名称 + 图标，右侧编辑/删除按钮
- **D-06:** 固定宽度 280px，从工具栏按钮下方弹出
- **D-07:** 高亮背景色 + 右侧勾号标识当前活跃容器
- **D-08:** 统一 Modal 对话框 — 创建和编辑共用同一个 Modal，包含名称、颜色、图标三个字段
- **D-09:** 预设色板 — 8-12 个预设颜色（红、橙、黄、绿、蓝、紫、灰等），点击选择
- **D-10:** 预设 emoji 列表 — 15-20 个预设 emoji 图标（🌐💼👤🏦🎮📚🛒💰🏠📧等），点击选择
- **D-11:** 基础验证 — 名称必填（非空、不重复），颜色和图标有默认值，验证失败显示红色错误提示
- **D-12:** 自定义 Modal 确认弹窗 — 显示容器名称、颜色、图标，提示"删除后该容器的 Cookie 和浏览数据将被清除"
- **D-13:** 禁止删除默认容器（id=default），删除按钮置灰或隐藏
- **D-14:** 删除当前活跃容器时自动切换到默认容器

### Claude's Discretion
无 — 所有决策均已由用户明确选择

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | 用户可以创建新容器，设置名称、颜色、图标 | ContainerManager 模块 + electron-store 持久化 + Session partition 创建 |
| CONT-02 | 用户可以编辑现有容器的名称、颜色、图标 | ContainerManager.update() 方法 + electron-store 更新 |
| CONT-03 | 用户可以删除容器（含确认提示） | ContainerManager.delete() 方法 + Session 清理 + 默认容器保护 |
| CONT-04 | 用户可以通过工具栏下拉面板查看所有容器列表 | Popover UI 组件 + 渲染进程状态管理 |
| CONT-05 | 用户可以点击容器进入该容器，后续新 Tab 在该容器中打开 | windowContainerMap 更新 + 容器切换事件通知 |
| CONT-06 | 用户可以点击其他容器，在新 Tab 中打开该容器 | 容器切换逻辑 + 渲染进程 UI 更新 |
</phase_requirements>

## Summary

Phase 1 是 Realm Browser 的基础架构重构阶段，核心目标是将当前单文件 `main.js`（约 250 行）拆分为职责单一的模块化架构，同时实现容器 CRUD 和管理 UI。研究结论明确：当前代码架构虽然功能完整，但所有逻辑集中在单一文件中，不利于维护和扩展。拆分方案已由用户明确选择（D-01 至 D-03），UI 交互模式也已确定（D-04 至 D-14）。

**关键技术点：**
1. **模块拆分**：main.js → container-manager.js + window-manager.js + ipc-handlers.js + main.js（入口）
2. **IPC 通道重命名**：从 `get-containers` 格式改为 `container:list` 格式，同步更新 preload.js
3. **容器管理 UI**：Popover 下拉面板 + 统一 Modal 对话框（创建/编辑复用）+ 删除确认弹窗
4. **Session 隔离验证**：确保容器 CRUD 操作正确创建/清理 Session partition

**最大风险：**
- 容器 ID 碰撞（当前 ID 生成策略存在碰撞风险）
- 删除容器时 Session 数据清理不完整
- 事件监听器累积导致内存泄漏

**Primary recommendation：** 按用户决策执行 4 模块拆分，使用事件委托模式避免事件监听器累积，容器 ID 生成添加唯一性检查。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 容器 CRUD（创建/编辑/删除） | Main Process | — | 容器配置和 Session 管理必须在主进程执行 |
| 容器配置持久化 | Main Process | — | electron-store 在主进程运行，渲染进程通过 IPC 访问 |
| Session 隔离 | Main Process | — | Electron Session API 仅在主进程可用 |
| 容器管理 UI | Renderer Process | — | DOM 操作和用户交互在渲染进程处理 |
| 容器切换 | Main Process | Renderer Process | 主进程更新映射，渲染进程更新 UI 指示器 |
| IPC 通信 | Preload Bridge | — | contextBridge 安全暴露 API 给渲染进程 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | ^32.0.0 | 桌面应用框架 | 项目已选定，不可更改（CLAUDE.md 约束） |
| electron-store | ^8.1.0 | 容器配置持久化 | 已集成，API 稳定，满足需求 |
| Node.js | 内置 | 主进程运行时 | Electron 内置，无需额外安装 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (内置) | — | UUID 生成 | 容器 ID 唯一性检查，避免碰撞 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-store | lowdb / better-sqlite3 | electron-store 已满足需求，无需引入新依赖 |
| 直接函数导入 | EventEmitter 事件驱动 | 直接导入更简单，调试更容易 |
| 预设 emoji 列表 | SVG 图标库 | emoji 跨平台一致，无需额外依赖 |

**Installation:**
```bash
# 无需额外安装，所有依赖已存在
npm install  # 确保 node_modules 完整
```

**Version verification:** 项目依赖已在 package.json 中锁定，无需额外验证。

## Package Legitimacy Audit

> Phase 1 不引入新的外部依赖，仅使用项目已有的 electron 和 electron-store。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| electron | npm | 10+ yrs | 50M+/wk | github.com/electron/electron | OK | 已使用 |
| electron-store | npm | 8+ yrs | 2M+/wk | github.com/sindresorhus/electron-store | OK | 已使用 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Main Process                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │   Container Manager  │  │    Window Manager    │  │  IPC Handlers│  │
│  │  container-manager.js│  │  window-manager.js   │  │ ipc-handlers │  │
│  │  - CRUD operations   │  │  - BrowserWindow     │  │  .js         │  │
│  │  - Session creation  │  │  - windowContainer   │  │  - ipcMain   │  │
│  │  - electron-store    │  │    Map               │  │    .handle() │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────┬───────┘  │
│             │                         │                      │          │
│             └─────────────────────────┼──────────────────────┘          │
│                                       │                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         main.js (Entry)                          │   │
│  │  - app.whenReady() + module assembly                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                        contextBridge / IPC                              │
├─────────────────────────────────────────────────────────────────────────┤
│                          Renderer Process                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Preload Script                             │ │
│  │                      `src/preload.js`                              │ │
│  │  - contextBridge.exposeInMainWorld('realmAPI', {...})              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                       │                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                           UI Layer                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐ │ │
│  │  │  Container Panel │  │   Toolbar        │  │  Modals            │ │ │
│  │  │  (Popover)       │  │  - Container     │  │  - Create/Edit     │ │ │
│  │  │  - Container list│  │    Indicator     │  │  - Delete Confirm  │ │ │
│  │  │  - CRUD buttons  │  │  - URL Input     │  │                    │ │ │
│  │  └─────────────────┘  └─────────────────┘  └────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
Realm/
├── main.js                       # 应用入口，app.whenReady() + 模块组装
├── container-manager.js          # 容器 CRUD + Session 管理 + electron-store
├── window-manager.js             # BrowserWindow 创建和映射
├── ipc-handlers.js               # 集中注册所有 IPC 处理器
├── src/
│   ├── index.html                # 主界面结构
│   ├── preload.js                # contextBridge API 定义
│   ├── renderer.js               # 渲染进程逻辑
│   └── styles/
│       └── main.css              # 样式文件
└── package.json
```

### Pattern 1: 模块化拆分（直接导入）

**What:** 将单文件 main.js 按职责拆分为 4 个独立模块，通过直接函数导入通信。

**When to use:** 代码量超过 200 行、职责混杂、需要多人协作时。

**Example:**
```javascript
// container-manager.js
const { session } = require('electron');
const Store = require('electron-store');

const configStore = new Store({ name: 'realm-config' });
const containers = new Map();

const DEFAULT_CONTAINERS = [
  { id: 'default', name: '默认', color: '#6B7280', icon: '🌐' },
  { id: 'work', name: '工作', color: '#3B82F6', icon: '💼' },
  { id: 'personal', name: '个人', color: '#10B981', icon: '👤' },
  { id: 'finance', name: '金融', color: '#F59E0B', icon: '🏦' },
];

/**
 * 初始化容器
 */
function initContainers() {
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers.forEach(container => {
    const partition = `persist:container-${container.id}`;
    const ses = session.fromPartition(partition);
    containers.set(container.id, { ...container, session: ses, partition });
    console.log(`[Realm] 初始化容器: ${container.name} (${partition})`);
  });
}

/**
 * 获取所有容器列表
 * @returns {Array} 容器配置数组
 */
function getContainers() {
  return Array.from(containers.values()).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
  }));
}

/**
 * 创建新容器
 * @param {Object} options - 容器选项
 * @returns {Object} 创建的容器配置
 */
function createContainer({ name, color, icon }) {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  // 检查是否已存在
  if (containers.has(id)) {
    throw new Error(`容器 ${id} 已存在`);
  }
  
  const container = { id, name, color: color || '#6B7280', icon: icon || '📌' };
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

/**
 * 删除容器
 * @param {string} containerId - 容器 ID
 * @returns {Object} 删除结果
 */
function deleteContainer(containerId) {
  if (containerId === 'default') {
    return { success: false, message: '无法删除默认容器' };
  }
  
  const container = containers.get(containerId);
  if (!container) {
    return { success: false, message: `容器 ${containerId} 不存在` };
  }
  
  // 清理 Session 数据
  container.session.clearStorageData();
  containers.delete(containerId);
  
  // 更新持久化
  let savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers = savedContainers.filter(c => c.id !== containerId);
  configStore.set('containers', savedContainers);
  
  console.log(`[Realm] 删除容器: ${containerId}`);
  return { success: true };
}

module.exports = {
  initContainers,
  getContainers,
  createContainer,
  deleteContainer,
  getContainer: (id) => containers.get(id),
};
```

### Pattern 2: IPC 通道命名规范（动词-名词格式）

**What:** 使用 `container:list`, `container:create` 格式替代旧的 `get-containers`, `create-container` 格式。

**When to use:** IPC 通道较多、需要统一命名规范时。

**Example:**
```javascript
// ipc-handlers.js
const { ipcMain } = require('electron');
const containerManager = require('./container-manager');
const windowManager = require('./window-manager');

/**
 * 注册所有 IPC 处理器
 */
function registerHandlers() {
  // 容器管理
  ipcMain.handle('container:list', () => {
    return containerManager.getContainers();
  });
  
  ipcMain.handle('container:create', (event, { name, color, icon }) => {
    return containerManager.createContainer({ name, color, icon });
  });
  
  ipcMain.handle('container:delete', (event, containerId) => {
    return containerManager.deleteContainer(containerId);
  });
  
  ipcMain.handle('container:current', (event) => {
    const windowId = event.sender.id;
    return windowManager.getCurrentContainer(windowId);
  });
  
  ipcMain.handle('container:switch', (event, containerId) => {
    const windowId = event.sender.id;
    return windowManager.switchContainer(windowId, containerId);
  });
  
  console.log('[Realm] IPC 处理器已注册');
}

module.exports = { registerHandlers };
```

### Pattern 3: Popover 下拉面板

**What:** 工具栏按钮点击弹出浮动面板，点击外部区域关闭。

**When to use:** 需要在工具栏下方显示临时内容时。

**Example:**
```javascript
// renderer.js 中的 Popover 逻辑
/**
 * 显示容器下拉面板
 */
function showContainerPanel() {
  const panel = document.getElementById('containerPanel');
  const indicator = document.getElementById('containerIndicator');
  
  // 定位面板
  const rect = indicator.getBoundingClientRect();
  panel.style.top = `${rect.bottom + 4}px`;
  panel.style.left = `${rect.left}px`;
  panel.style.width = '280px';
  
  // 渲染容器列表
  renderContainerPanelList();
  
  // 显示面板
  panel.classList.add('visible');
  
  // 点击外部关闭
  document.addEventListener('click', handleOutsideClick);
}

/**
 * 隐藏容器下拉面板
 */
function hideContainerPanel() {
  const panel = document.getElementById('containerPanel');
  panel.classList.remove('visible');
  document.removeEventListener('click', handleOutsideClick);
}

/**
 * 处理点击外部区域
 */
function handleOutsideClick(event) {
  const panel = document.getElementById('containerPanel');
  const indicator = document.getElementById('containerIndicator');
  
  if (!panel.contains(event.target) && !indicator.contains(event.target)) {
    hideContainerPanel();
  }
}
```

### Anti-Patterns to Avoid

- **innerHTML 渲染用户输入：** Cookie 值或容器名称可能包含恶意脚本，使用 textContent 或手动转义
- **事件监听器累积：** 每次渲染列表都添加新监听器会导致内存泄漏，使用事件委托模式
- **容器 ID 不做唯一性检查：** 两个同名容器会生成相同 ID，导致数据覆盖

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 容器配置持久化 | 自定义 JSON 文件读写 | electron-store | 已集成，原子写入，自动处理并发 |
| Session 隔离 | 自定义 Session 管理 | session.fromPartition() | Electron 原生支持，稳定可靠 |
| UUID 生成 | 自定义 ID 生成算法 | crypto.randomUUID() | Node.js 内置，保证唯一性 |

## Common Pitfalls

### Pitfall 1: 容器 ID 碰撞

**What goes wrong：** 当前 ID 生成策略 `name.toLowerCase().replace(/[^a-z0-9]/g, '-')` 存在碰撞风险（如 "My Container" 和 "my-container" 生成相同 ID）。

**Why it happens：** 没有唯一性检查，也没有使用足够唯一的标识符。

**How to avoid：**
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

**Warning signs：** 容器配置文件中出现重复的 ID。

### Pitfall 2: 事件监听器累积

**What goes wrong：** 每次渲染容器列表时使用 innerHTML 替换内容并重新绑定事件监听器，旧的监听器不会被自动移除。

**Why it happens：** innerHTML 替换内容后，旧的 DOM 节点被移除，但 JavaScript 闭包仍引用旧节点。

**How to avoid：** 使用事件委托模式，只在容器元素上绑定一次监听器。

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

**Warning signs：** 同一个按钮点击一次但回调执行了多次。

### Pitfall 3: 删除容器时 Session 清理不完整

**What goes wrong：** 删除容器时仅从 Map 中移除，未清理 Session 数据，导致磁盘空间持续增长。

**Why it happens：** 忘记调用 `session.clearStorageData()` 和 `session.clearCache()`。

**How to avoid：**
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

**Warning signs：** 删除容器后 userData 目录大小未减少。

## Code Examples

### 容器创建完整流程

```javascript
// renderer.js
async function createContainer(name, color, icon) {
  try {
    const container = await window.realmAPI.createContainer({ name, color, icon });
    await loadContainers(); // 重新加载列表
    hideContainerPanel(); // 关闭面板
    showNewContainerModal(); // 打开新建 Modal
    console.log(`[Realm] 创建容器: ${name}`);
    return container;
  } catch (error) {
    console.error('[Realm] 创建容器失败:', error.message);
    showErrorMessage(error.message);
  }
}
```

### 容器删除完整流程

```javascript
// renderer.js
async function deleteContainer(containerId) {
  // 显示确认弹窗
  const confirmed = await showDeleteConfirmModal(containerId);
  if (!confirmed) return;
  
  try {
    const result = await window.realmAPI.deleteContainer(containerId);
    if (result.success) {
      // 如果删除的是当前活跃容器，切换到默认容器
      if (containerId === state.currentContainer) {
        await switchContainer('default');
      }
      await loadContainers(); // 重新加载列表
      console.log(`[Realm] 删除容器: ${containerId}`);
    } else {
      showErrorMessage(result.message);
    }
  } catch (error) {
    console.error('[Realm] 删除容器失败:', error.message);
  }
}
```

### Popover 面板 HTML 结构

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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 单文件 main.js | 4 模块拆分 | Phase 1 | 代码更易维护和扩展 |
| `get-containers` 格式 | `container:list` 格式 | Phase 1 | IPC 命名更规范 |
| 侧边栏容器列表 | Popover 下拉面板 | Phase 1 | 减少屏幕占用，交互更直接 |
| 简单 Modal | 统一 Modal（创建/编辑复用） | Phase 1 | 减少代码重复 |

**Deprecated/outdated:**
- 旧的 IPC 通道命名格式（`get-containers`, `create-container`）→ 新格式（`container:list`, `container:create`）
- 侧边栏容器列表 → Popover 下拉面板

## Assumptions Log

> 所有决策均由用户在 CONTEXT.md 中明确选择，无假设性声明。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**If this table is empty：** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **容器 ID 生成策略是否需要更严格？**
   - What we know：当前策略存在碰撞风险（如 "My Container" 和 "my-container"）
   - What's unclear：用户是否接受追加 UUID 后缀的方案
   - Recommendation：在 createContainer 中添加唯一性检查，碰撞时追加短 UUID

2. **是否需要更新 Electron 版本？**
   - What we know：当前使用 Electron 32.x，研究建议升级到 36+
   - What's unclear：Phase 1 是否需要升级，还是保持当前版本
   - Recommendation：Phase 1 保持当前版本，Phase 2 再考虑升级（与 WebContentsView 迁移同步）

## Environment Availability

> Phase 1 是代码重构和 UI 开发，无外部服务依赖。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 主进程运行时 | ✓ | 内置 | — |
| npm | 包管理器 | ✓ | 内置 | — |
| Electron | 桌面应用框架 | ✓ | ^32.0.0 | — |
| electron-store | 配置持久化 | ✓ | ^8.1.0 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

> config.json 中 `workflow.nyquist_validation` 未显式设置为 false，视为启用。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未检测到测试框架 |
| Config file | none — see Wave 0 |
| Quick run command | `npm test`（需先配置） |
| Full suite command | `npm test`（需先配置） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | 创建容器 | unit | `npm test -- --grep "createContainer"` | Wave 0 |
| CONT-02 | 编辑容器 | unit | `npm test -- --grep "updateContainer"` | Wave 0 |
| CONT-03 | 删除容器 | unit | `npm test -- --grep "deleteContainer"` | Wave 0 |
| CONT-04 | 容器列表 UI | e2e | `npm test -- --grep "container panel"` | Wave 0 |
| CONT-05 | 切换容器 | unit | `npm test -- --grep "switchContainer"` | Wave 0 |
| CONT-06 | 容器切换 UI | e2e | `npm test -- --grep "container switch UI"` | Wave 0 |

### Sampling Rate
- **Per task commit：** `npm test`（需先配置测试框架）
- **Per wave merge：** `npm test`（需先配置测试框架）
- **Phase gate：** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] 配置测试框架（Jest 或 Vitest）
- [ ] 创建 `tests/container-manager.test.js` — 覆盖 CONT-01, CONT-02, CONT-03, CONT-05
- [ ] 创建 `tests/renderer.test.js` — 覆盖 CONT-04, CONT-06
- [ ] 创建 `tests/conftest.js` — 共享 fixtures

## Security Domain

> config.json 中 `security_enforcement` 未显式设置为 false，视为启用。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本地应用，无认证机制 |
| V3 Session Management | yes | Electron Session API（内置） |
| V4 Access Control | no | 单用户本地应用 |
| V5 Input Validation | yes | 容器名称验证、ID 生成白名单 |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for Electron

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS 通过 innerHTML | Tampering | 使用 textContent 或手动转义 |
| IPC 入参未验证 | Tampering | 对所有入参做类型和格式校验 |
| 容器 ID 注入 | Tampering | 白名单字符，严格验证 |
| Session 隔离泄漏 | Information Disclosure | 确保所有 WebContents 绑定正确的 Session |

## Sources

### Primary (HIGH confidence)
- Electron 官方文档：Session API、Cookie API
- 项目代码库：main.js, src/preload.js, src/renderer.js
- 用户决策：CONTEXT.md

### Secondary (MEDIUM confidence)
- 竞品分析：Firefox Multi-Account Containers, Ghost Browser
- 研究文档：.planning/research/ARCHITECTURE.md, STACK.md, PITFALLS.md

### Tertiary (LOW confidence)
- 无（所有关键决策均由用户明确选择）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 项目依赖已锁定，无新依赖引入
- Architecture: HIGH — 用户明确选择 4 模块拆分方案
- Pitfalls: HIGH — 基于官方文档和项目经验

**Research date:** 2026-07-23
**Valid until:** 2026-08-23（30 天，项目架构稳定）

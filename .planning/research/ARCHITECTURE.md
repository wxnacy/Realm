# Architecture Research: Multi-Container Isolation Browser

**Domain:** Electron 桌面应用 / 多容器隔离浏览器
**Researched:** 2026-07-23
**Confidence:** HIGH

## Standard Architecture

### System Overview

多容器隔离浏览器的标准架构分为四层：窗口管理层、容器管理层、Session 隔离层和持久化层。核心思想是每个容器对应独立的 Electron Session，通过 partition 字符串实现数据完全隔离。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Window Layer                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                       BaseWindow                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │ Tab View 1  │  │ Tab View 2  │  │ Tab View 3  │  (WebContents│   │
│  │  │ (active)    │  │ (hidden)    │  │ (hidden)    │    View)     │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │   │
│  │         │                │                │                      │   │
│  │  ┌──────┴────────────────┴────────────────┴──────────────────┐   │   │
│  │  │                    UI View (Toolbar + Tabs)                │   │   │
│  │  └───────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                        Container Layer                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Container       │  │ Container       │  │ Container       │         │
│  │ Manager         │  │ Registry        │  │ Factory         │         │
│  │ - CRUD ops      │  │ - lookup        │  │ - create        │         │
│  │ - lifecycle     │  │ - validation    │  │ - configure     │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
├───────────┴────────────────────┴────────────────────┴───────────────────┤
│                        Session Layer                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Session A       │  │ Session B       │  │ Session C       │         │
│  │ persist:cont-1  │  │ persist:cont-2  │  │ persist:cont-3  │         │
│  │ - cookies       │  │ - cookies       │  │ - cookies       │         │
│  │ - cache         │  │ - cache         │  │ - cache         │         │
│  │ - localStorage  │  │ - localStorage  │  │ - localStorage  │         │
│  │ - indexedDB     │  │ - indexedDB     │  │ - indexedDB     │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
├───────────┴────────────────────┴────────────────────┴───────────────────┤
│                        Persistence Layer                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ electron-store  │  │ Cookie JSON     │  │ Session Data    │         │
│  │ (config)        │  │ (backup/export) │  │ (Chromium)      │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| BaseWindow | 顶层窗口容器，管理多个 WebContentsView | `new BaseWindow()` + `contentView.addChildView()` |
| WebContentsView | 渲染网页内容的视图，每个 Tab 对应一个实例 | `new WebContentsView({ webPreferences })` |
| Tab Manager | Tab 生命周期管理（创建、切换、销毁、discarding） | Map<tabId, {view, webContents}> + 状态机 |
| Container Manager | 容器 CRUD、配置管理、生命周期 | Map<containerId, config> + electron-store |
| Session Manager | Session partition 创建与隔离 | `session.fromPartition()` |
| Cookie Manager | Cookie 导入/导出、持久化、跨容器迁移 | `session.cookies` API + JSON 文件 |
| IPC Bridge | 主进程与渲染进程的安全通信 | `contextBridge.exposeInMainWorld()` |

## Recommended Project Structure

```
src/
├── main/                      # 主进程代码
│   ├── index.js               # 应用入口，生命周期管理
│   ├── container-manager.js   # 容器 CRUD、配置管理
│   ├── session-manager.js     # Session partition 管理
│   ├── tab-manager.js         # Tab 生命周期管理
│   ├── cookie-manager.js      # Cookie 持久化与恢复
│   ├── window-manager.js      # BaseWindow 管理
│   └── ipc-handlers.js        # 所有 IPC 处理器
├── renderer/                  # 渲染进程代码
│   ├── index.html             # 主页面结构
│   ├── renderer.js            # 渲染进程入口
│   ├── components/            # UI 组件
│   │   ├── tab-bar.js         # 标签栏组件
│   │   ├── toolbar.js         # 工具栏组件
│   │   ├── container-panel.js # 容器下拉面板
│   │   └── modal.js           # 模态框组件
│   └── styles/
│       └── main.css           # 样式文件
├── preload.js                 # contextBridge API 定义
└── shared/                    # 共享代码（主进程和渲染进程共用）
    └── constants.js           # 常量定义
```

### Structure Rationale

- **main/:** 主进程代码按职责拆分，每个模块单一职责。当前所有逻辑都在 `main.js` 中，需要重构。
- **renderer/:** 渲染进程代码按组件化组织，便于维护和扩展。
- **shared/:** 共享常量和类型定义，避免主进程和渲染进程之间的重复。

## Architectural Patterns

### Pattern 1: WebContentsView 多 Tab 架构

**What:** 使用 `BaseWindow` + 多个 `WebContentsView` 实现多标签页浏览器。每个 Tab 对应一个 `WebContentsView` 实例，通过 `addChildView` 添加到窗口，通过 `setBounds` 控制布局。

**When to use:** 需要实现多标签页浏览器时，这是 Electron 官方推荐的现代方案。

**Trade-offs:**
- 优点：性能好、支持 z-ordering、官方推荐
- 缺点：需要手动管理视图层级和布局

**Example:**
```javascript
// main/tab-manager.js
const { BaseWindow, WebContentsView } = require('electron');

class TabManager {
  #tabs = new Map(); // tabId -> { view, webContents, containerId }
  #activeTabId = null;
  #window = null;

  constructor(window) {
    this.#window = window;
  }

  /**
   * 创建新 Tab
   * @param {string} containerId - 容器 ID
   * @param {string} url - 初始 URL（可选）
   * @returns {string} tabId
   */
  createTab(containerId, url = 'about:blank') {
    const tabId = `tab-${Date.now()}`;
    const container = containerManager.get(containerId);

    const view = new WebContentsView({
      webPreferences: {
        session: container.session,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    view.webContents.loadURL(url);
    this.#window.contentView.addChildView(view);
    this.#tabs.set(tabId, { view, containerId });

    // 默认隐藏新 Tab
    view.setVisible(false);

    return tabId;
  }

  /**
   * 切换到指定 Tab
   * @param {string} tabId - Tab ID
   */
  switchTab(tabId) {
    const tab = this.#tabs.get(tabId);
    if (!tab) return;

    // 隐藏当前 Tab
    if (this.#activeTabId) {
      const activeTab = this.#tabs.get(this.#activeTabId);
      if (activeTab) activeTab.view.setVisible(false);
    }

    // 显示目标 Tab
    tab.view.setVisible(true);
    this.#activeTabId = tabId;

    // 更新布局
    this.#updateLayout();
  }

  /**
   * 关闭 Tab
   * @param {string} tabId - Tab ID
   */
  closeTab(tabId) {
    const tab = this.#tabs.get(tabId);
    if (!tab) return;

    tab.view.webContents.close();
    this.#window.contentView.removeChildView(tab.view);
    this.#tabs.delete(tabId);

    // 如果关闭的是活动 Tab，切换到其他 Tab
    if (this.#activeTabId === tabId) {
      const remaining = Array.from(this.#tabs.keys());
      this.#activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      if (this.#activeTabId) this.switchTab(this.#activeTabId);
    }
  }

  /**
   * 更新视图布局
   */
  #updateLayout() {
    const { width, height } = this.#window.getBounds();
    const toolbarHeight = 48;

    this.#tabs.forEach(tab => {
      tab.view.setBounds({
        x: 0,
        y: toolbarHeight,
        width: width,
        height: height - toolbarHeight,
      });
    });
  }
}
```

### Pattern 2: Session Partition 容器隔离

**What:** 使用 `session.fromPartition('persist:container-{id}')` 为每个容器创建独立的 Session，实现 Cookie、缓存、LocalStorage、IndexedDB 的完全隔离。

**When to use:** 需要多账户/多身份隔离的浏览器应用场景。

**Trade-offs:**
- 优点：原生支持、隔离彻底、无需额外依赖
- 缺点：每个 Session 占用独立内存和磁盘空间

**Example:**
```javascript
// main/container-manager.js
const { session } = require('electron');
const Store = require('electron-store');

class ContainerManager {
  #containers = new Map(); // containerId -> { config, session, partition }
  #store = new Store({ name: 'realm-containers' });

  constructor() {
    this.#loadContainers();
  }

  /**
   * 加载容器配置
   */
  #loadContainers() {
    const configs = this.#store.get('containers', DEFAULT_CONTAINERS);

    configs.forEach(config => {
      this.#initContainer(config);
    });
  }

  /**
   * 初始化单个容器
   * @param {Object} config - 容器配置
   */
  #initContainer(config) {
    const partition = `persist:container-${config.id}`;
    const ses = session.fromPartition(partition);

    this.#containers.set(config.id, {
      config,
      session: ses,
      partition,
    });
  }

  /**
   * 创建新容器
   * @param {Object} options - 容器选项
   * @returns {Object} 创建的容器配置
   */
  create({ name, color, icon }) {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // 检查是否已存在
    if (this.#containers.has(id)) {
      throw new Error(`容器 ${id} 已存在`);
    }

    const config = { id, name, color, icon };
    this.#initContainer(config);

    // 持久化
    const configs = this.#store.get('containers', DEFAULT_CONTAINERS);
    configs.push(config);
    this.#store.set('containers', configs);

    return config;
  }

  /**
   * 删除容器
   * @param {string} containerId - 容器 ID
   */
  delete(containerId) {
    if (containerId === 'default') {
      throw new Error('无法删除默认容器');
    }

    const container = this.#containers.get(containerId);
    if (!container) {
      throw new Error(`容器 ${containerId} 不存在`);
    }

    // 清理 Session 数据
    container.session.clearStorageData();
    this.#containers.delete(containerId);

    // 更新持久化
    let configs = this.#store.get('containers', DEFAULT_CONTAINERS);
    configs = configs.filter(c => c.id !== containerId);
    this.#store.set('containers', configs);
  }

  /**
   * 获取容器
   * @param {string} containerId - 容器 ID
   * @returns {Object} 容器对象
   */
  get(containerId) {
    return this.#containers.get(containerId);
  }

  /**
   * 获取所有容器列表
   * @returns {Array} 容器配置数组
   */
  list() {
    return Array.from(this.#containers.values()).map(c => c.config);
  }
}
```

### Pattern 3: Cookie JSON 持久化

**What:** 将 Cookie 导出为 JSON 文件，便于备份、迁移和调试。参考 AutoBrowser 项目的实现。

**When to use:** 需要跨设备同步 Cookie、或需要手动编辑 Cookie 的场景。

**Trade-offs:**
- 优点：便于调试、可读性好、支持跨平台迁移
- 缺点：需要手动同步、不如原生存储高效

**Example:**
```javascript
// main/cookie-manager.js
const fs = require('fs');
const path = require('path');

class CookieManager {
  #cookieDir = '';

  constructor(userDataPath) {
    this.#cookieDir = path.join(userDataPath, 'cookies');
    this.#ensureDir();
  }

  /**
   * 确保目录存在
   */
  #ensureDir() {
    if (!fs.existsSync(this.#cookieDir)) {
      fs.mkdirSync(this.#cookieDir, { recursive: true });
    }
  }

  /**
   * 导出容器 Cookie 到 JSON 文件
   * @param {string} containerId - 容器 ID
   * @param {Session} session - Electron Session 对象
   */
  async exportCookies(containerId, session) {
    const cookies = await session.cookies.get({});
    const filePath = path.join(this.#cookieDir, `${containerId}.json`);

    // 处理 Cookie 格式（保留 domain 前缀点号）
    const formatted = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: cookie.expirationDate,
    }));

    fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2));
    console.log(`[CookieManager] 导出 ${containerId} 的 ${cookies.length} 个 Cookie`);
  }

  /**
   * 从 JSON 文件导入 Cookie 到容器
   * @param {string} containerId - 容器 ID
   * @param {Session} session - Electron Session 对象
   */
  async importCookies(containerId, session) {
    const filePath = path.join(this.#cookieDir, `${containerId}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`[CookieManager] 未找到 ${containerId} 的 Cookie 文件`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const cookie of data) {
      try {
        await session.cookies.set(cookie);
      } catch (error) {
        console.error(`[CookieManager] 导入 Cookie 失败:`, error.message);
      }
    }

    console.log(`[CookieManager] 导入 ${data.length} 个 Cookie 到 ${containerId}`);
  }

  /**
   * 备份所有容器的 Cookie
   * @param {Map} containers - 容器 Map
   */
  async backupAll(containers) {
    for (const [id, container] of containers) {
      await this.exportCookies(id, container.session);
    }
  }

  /**
   * 恢复所有容器的 Cookie
   * @param {Map} containers - 容器 Map
   */
  async restoreAll(containers) {
    for (const [id, container] of containers) {
      await this.importCookies(id, container.session);
    }
  }
}
```

### Pattern 4: Tab 生命周期状态机

**What:** Tab 有明确的状态转换：创建 -> 活动 -> 后台 -> 销毁。使用状态机管理可以避免非法状态转换，优化内存使用。

**When to use:** Tab 数量可能较多（>10）时，需要 Tab discarding 来节省内存。

**Trade-offs:**
- 优点：内存可控、状态清晰、易于调试
- 缺点：实现复杂度增加

**Example:**
```javascript
// Tab 状态定义
const TabState = {
  CREATED: 'created',     // 已创建但未加载
  LOADING: 'loading',     // 正在加载
  ACTIVE: 'active',       // 活动状态（前台）
  BACKGROUND: 'background', // 后台运行
  DISCARDED: 'discarded', // 已释放内存（可恢复）
  DESTROYED: 'destroyed', // 已销毁（不可恢复）
};

// 状态转换规则
const Transitions = {
  [TabState.CREATED]: [TabState.LOADING, TabState.DESTROYED],
  [TabState.LOADING]: [TabState.ACTIVE, TabState.DESTROYED],
  [TabState.ACTIVE]: [TabState.BACKGROUND, TabState.DESTROYED],
  [TabState.BACKGROUND]: [TabState.ACTIVE, TabState.DISCARDED, TabState.DESTROYED],
  [TabState.DISCARDED]: [TabState.CREATED, TabState.DESTROYED],
  [TabState.DESTROYED]: [], // 终态
};

class Tab {
  #state = TabState.CREATED;
  #view = null;
  #webContents = null;

  constructor(containerId) {
    this.containerId = containerId;
    this.createdAt = Date.now();
    this.url = 'about:blank';
  }

  /**
   * 状态转换
   * @param {string} newState - 目标状态
   */
  transition(newState) {
    const allowed = Transitions[this.#state];
    if (!allowed.includes(newState)) {
      throw new Error(`非法状态转换: ${this.#state} -> ${newState}`);
    }

    const oldState = this.#state;
    this.#state = newState;

    // 执行状态转换钩子
    this.#onStateChange(oldState, newState);
  }

  /**
   * 状态变更处理
   */
  #onStateChange(from, to) {
    console.log(`[Tab] 状态变更: ${from} -> ${to}`);

    if (to === TabState.DISCARDED) {
      // 释放内存
      this.#webContents.close();
      this.#view = null;
      this.#webContents = null;
    }
  }

  get state() {
    return this.#state;
  }
}
```

## Data Flow

### 容器创建流程

```
用户点击"新建容器"
    │
    ▼
渲染进程: renderer.js → realmAPI.createContainer({ name, color, icon })
    │
    ▼ (IPC)
主进程: ipc-handlers.js → containerManager.create({ name, color, icon })
    │
    ├───► session.fromPartition('persist:container-{id}')
    │
    ├───► electron-store.set('containers', [...])
    │
    └───► 返回容器配置
    │
    ▼ (IPC)
渲染进程: 重新加载容器列表
```

### Tab 创建与导航流程

```
用户点击容器（或输入 URL）
    │
    ▼
渲染进程: tab-bar.js → realmAPI.createTab(containerId, url)
    │
    ▼ (IPC)
主进程: tab-manager.js → createTab(containerId, url)
    │
    ├───► new WebContentsView({ session: container.session })
    │
    ├───► window.contentView.addChildView(view)
    │
    ├───► view.webContents.loadURL(url)
    │
    └───► 返回 tabId
    │
    ▼ (IPC)
渲染进程: 更新标签栏 UI
```

### Cookie 持久化流程

```
应用启动
    │
    ▼
主进程: cookieManager.restoreAll(containers)
    │
    ├───► 读取 cookies/{containerId}.json
    │
    ├───► session.cookies.set(cookie) for each
    │
    └───► 完成恢复

应用关闭（或定时器触发）
    │
    ▼
主进程: cookieManager.backupAll(containers)
    │
    ├───► session.cookies.get({}) for each container
    │
    └───► 写入 cookies/{containerId}.json
```

### 容器切换流程（单窗口多 Tab）

```
用户点击容器列表中的容器 B
    │
    ▼
渲染进程: realmAPI.switchContainer(containerB_id)
    │
    ▼ (IPC)
主进程: tabManager.switchToContainer(containerB_id)
    │
    ├───► 查找 containerB 的活动 Tab
    │       ├─── 存在 → 切换到该 Tab
    │       └─── 不存在 → 创建新 Tab
    │
    ├───► 隐藏 containerA 的所有 Tab
    │
    ├───► 显示 containerB 的活动 Tab
    │
    └───► 通知渲染进程更新 UI
    │
    ▼ (IPC)
渲染进程: 更新容器指示器和标签栏
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 个容器 | 当前架构足够，单窗口管理 |
| 5-20 个容器 | 需要 Tab discarding，按需释放不活动容器的 Tab |
| 20+ 容器 | 考虑容器分组、搜索功能、延迟加载容器列表 |

### Scaling Priorities

1. **第一瓶颈：** 内存占用 — 每个 Tab 占用独立渲染进程，10+ Tab 可能占用 1GB+ 内存。解决方案：Tab discarding，使用 `webContents.setBackgroundThrottling(true)`。
2. **第二瓶颈：** 启动时间 — 容器越多，初始化 Session 越慢。解决方案：延迟初始化非默认容器。

## Anti-Patterns

### Anti-Pattern 1: 运行时切换 Session

**What people do:** 尝试在同一个 BrowserWindow 中切换 `webContents.session`

**Why it's wrong:** Electron 的 Session 绑定在 WebContents 创建时，运行时无法更改。当前代码中的 `switchContainer()` 仅更新映射，未重建窗口，实际上切换不生效。

**Do this instead:** 使用多 WebContentsView 架构，每个容器的 Tab 使用独立的 WebContentsView，切换时显示/隐藏对应视图。

### Anti-Pattern 2: 使用已废弃的 BrowserView

**What people do:** 使用 `BrowserView` 实现多标签页

**Why it's wrong:** `BrowserView` 已在 Electron 22+ 废弃，存在性能问题和 z-ordering 限制。

**Do this instead:** 使用 `BaseWindow` + `WebContentsView` + `addChildView()`。

### Anti-Pattern 3: 在渲染进程管理 Session

**What people do:** 通过 IPC 将 Session 对象传递给渲染进程

**Why it's wrong:** Session 对象包含原生绑定，不能跨进程传递。渲染进程不应直接操作 Session。

**Do this instead:** 所有 Session 操作在主进程执行，渲染进程通过 IPC 调用主进程方法。

### Anti-Pattern 4: 全局单例管理所有状态

**What people do:** 在 `main.js` 中使用全局变量管理所有容器和窗口

**Why it's wrong:** 代码难以维护、测试和扩展。

**Do this instead:** 按职责拆分模块：`ContainerManager`、`TabManager`、`CookieManager`、`WindowManager`。

### Anti-Pattern 5: 忽略 Cookie domain 前缀点号

**What people do:** 导出 Cookie 时忽略 domain 的前缀点号（如 `.example.com`）

**Why it's wrong:** 浏览器使用前缀点号表示 Cookie 适用于所有子域名。丢失前缀点号会导致 Cookie 作用域错误。

**Do this instead:** 保留 Cookie 原始格式，导入时使用 `session.cookies.set()` 的完整参数。

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main ↔ Renderer | IPC (contextBridge) | 所有通信通过 preload.js 暴露的 realmAPI |
| Container Manager ↔ Session Manager | 直接调用 | Container Manager 创建 Session |
| Tab Manager ↔ Container Manager | 直接调用 | Tab Manager 获取容器的 Session |
| Cookie Manager ↔ Session | 直接调用 | Cookie Manager 读写 Session.cookies |

### External Dependencies

| Dependency | Integration Pattern | Notes |
|------------|---------------------|-------|
| electron-store | 构造函数注入 | 容器配置持久化 |
| electron session | 工厂方法 | `session.fromPartition()` 创建隔离 Session |
| electron BaseWindow | 构造函数 | 顶层窗口容器 |
| electron WebContentsView | 构造函数 | Tab 视图渲染 |

## Current Codebase Gaps

基于对现有代码的分析，以下是需要改进的架构问题：

### Gap 1: 单文件架构

**现状:** 所有主进程逻辑（容器管理、窗口管理、IPC 处理）都在 `main.js` 中。
**建议:** 拆分为独立模块：`ContainerManager`、`TabManager`、`WindowManager`、`IPCHandlers`。

### Gap 2: 缺少 Tab 管理

**现状:** 没有多 Tab 支持，只有一个 BrowserWindow 绑定到一个容器。
**建议:** 实现 `TabManager`，使用 `WebContentsView` 管理多 Tab。

### Gap 3: 容器切换不生效

**现状:** `switchContainer()` 仅更新映射，未重建窗口或切换视图。
**建议:** 使用多 WebContentsView 架构，切换时显示/隐藏对应容器的 Tab。

### Gap 4: URL 导航未实现

**现状:** URL 输入框回车仅打印日志。
**建议:** 实现 `webContents.loadURL()` 调用。

### Gap 5: Cookie 持久化缺失

**现状:** 仅使用 Electron 原生 Session 存储，无 JSON 导出/导入。
**建议:** 实现 `CookieManager`，支持定时备份和启动恢复。

## Build Order Implications

基于架构依赖关系，建议的构建顺序：

```
Phase 1: 基础架构重构
    └── 拆分 main.js 为独立模块
    └── ContainerManager 独立
    └── IPC Handlers 独立

Phase 2: Tab 管理核心
    └── TabManager 实现
    └── WebContentsView 多 Tab 架构
    └── URL 导航功能

Phase 3: 容器隔离完善
    └── 容器切换真正生效
    └── Cookie JSON 持久化
    └── 容器下拉面板 UI

Phase 4: 体验优化
    └── Tab discarding
    └── 容器分组
    └── 性能优化
```

**依赖关系说明：**
- Phase 1 是所有后续工作的基础，必须首先完成
- Phase 2 依赖 Phase 1 的模块化架构
- Phase 3 依赖 Phase 2 的 Tab 管理能力
- Phase 4 是锦上添花，可以在前三阶段完成后进行

## Sources

- Electron 官方文档: WebContentsView API
- Electron 官方文档: Session API
- Electron 官方文档: BaseWindow API
- Firefox Multi-Account Containers 交互模式
- AutoBrowser 项目 Cookie 持久化方案
- 现有代码库分析: `main.js`, `src/preload.js`, `src/renderer.js`

---
*Architecture research for: Multi-Container Isolation Browser*
*Researched: 2026-07-23*

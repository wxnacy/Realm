# 研究：领域陷阱

**领域：** 多容器隔离浏览器 (Electron)
**研究日期：** 2026-07-23
**置信度：** HIGH

---

## 关键陷阱

### 陷阱 1：Session 隔离泄漏 — 跨容器 Cookie 渗透

**问题描述：**
容器 A 设置的 Cookie 在容器 B 的 WebContents 中可被读取，导致用户在不同身份间的会话数据完全混淆。这是多容器浏览器最致命的安全缺陷。

**根本原因：**
开发者错误地认为 `session.fromPartition()` 的隔离是自动且完整的。实际上有几种场景会导致泄漏：

1. **Partition 命名冲突** — 如果两个容器使用相同的 partition 字符串（如 `persist:container-work` 和 `persist:container-work`），它们共享同一个 Session。
2. **默认 Session 渗透** — 未显式指定 session 的 WebContents 会使用默认的 `""` partition，可能意外共享。
3. **主窗口与子视图 Session 不一致** — 主窗口使用容器 A 的 session 加载 UI，但 BrowserView/WebContentsView 未同步绑定。
4. **`persist:` 前缀问题** — 使用 `persist:xxx` 会让数据写入磁盘；不使用 `persist:` 的内存 Session 在应用重启后丢失但进程内仍然共享。

**如何避免：**

```javascript
// 错误：容器 ID 可能被注入恶意字符
const partition = `persist:container-${userInput}`;

// 正确：严格验证 partition 名称，使用白名单字符
function buildPartition(containerId) {
  const sanitized = containerId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `persist:container-${sanitized}`;
}

// 验证：确保所有 WebContents 都绑定到正确的 session
function getContainerSession(containerId) {
  const partition = buildPartition(containerId);
  return session.fromPartition(partition);
}
```

**预警信号：**
- 在容器 A 登录网站后，容器 B 中相同网站显示已登录状态
- 打开 DevTools → Application → Cookies，发现不同容器 Tab 的 Cookie 来自同一源
- 应用启动后某个容器的 Cookie 意外包含了另一个容器站点的数据

**应解决的阶段：**
Phase 1 — 基础容器实现。这是核心隔离机制，必须在第一步就确保正确。

---

### 陷阱 2：Cookie Domain 的前导点号 (Leading Dot) 处理

**问题描述：**
当 Cookie 的 domain 字段包含前导点号（如 `.example.com`），根据 RFC 6265 这个 Cookie 应该在所有子域名共享。如果在持久化时没有正确保留或剥离前导点号，会导致：
- Cookie 恢复后无法匹配正确的域
- 跨容器的 Cookie 意外共享（两个容器访问同一域名的不同子域时）
- 安全属性 `__Host-` 前缀的 Cookie 失效

**根本原因：**
Electron 的 `session.cookies` API 返回的 Cookie 对象中，domain 字段的前导点号行为与 Chromium 内部实现不一致。在持久化到 JSON 文件时，如果简单存储 `domain` 字段，恢复时可能产生问题。

参考项目 AutoBrowser 的解决方案是在 JSON 格式中显式保留 domain 的前导点号，并在加载时做特殊处理。

**如何避免：**

```javascript
// Cookie 持久化时：保留原始 domain
async function saveCookies(containerId, ses) {
  const cookies = await ses.cookies.get({});
  const formatted = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,        // 保留原始 domain（包含前导点号）
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    expirationDate: cookie.expirationDate,
    sameSite: cookie.sameSite,
    // 额外记录原始 hostOnly 状态
    hostOnly: cookie.hostOnly,
  }));
  // 保存到独立文件
  fs.writeFileSync(`cookies-${containerId}.json`, JSON.stringify(formatted));
}

// Cookie 加载时：显式处理 domain 匹配
async function loadCookies(containerId, ses) {
  const data = JSON.parse(fs.readFileSync(`cookies-${containerId}.json`));
  for (const cookie of data) {
    try {
      await ses.cookies.set({
        url: buildUrlFromDomain(cookie.domain, cookie.path, cookie.secure),
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate,
        sameSite: cookie.sameSite,
      });
    } catch (err) {
      console.warn(`[Cookie] 加载失败: ${cookie.domain}${cookie.path} - ${err.message}`);
    }
  }
}
```

**预警信号：**
- 持久化的 Cookie JSON 中 domain 字段混合使用有/无前导点号
- 恢复 Cookie 后某些站点的登录状态丢失
- 同一顶级域名下不同子站的 Cookie 被错误共享

**应解决的阶段：**
Phase 1 — Cookie 持久化实现。必须在首次实现 Cookie 持久化时就处理好这个问题。

---

### 陷阱 3：多 WebContents 内存泄漏

**问题描述：**
每个 Tab（无论是 BrowserView、WebContentsView 还是 webview）都会创建一个独立的 WebContents 实例。WebContents 包含完整的 Chromium 渲染进程，占用大量内存（每个约 50-200MB）。如果 Tab 关闭时 WebContents 没有被正确销毁，内存会持续增长直到应用崩溃。

**根本原因：**
1. **事件监听器未清理** — 每次创建 Tab 都添加 `did-finish-load`、`page-title-updated` 等事件监听，关闭时未移除
2. **引用未释放** — JavaScript 变量持有对已关闭 WebContents 的引用，阻止 GC 回收
3. **Session 对象累积** — `session.fromPartition()` 调用会缓存 Session 对象，即使对应的 WebContents 已销毁
4. **DOM 节点泄漏** — 渲染进程中为每个 Tab 创建的 DOM 元素（如 Tab 按钮、iframe 容器）在关闭时未移除

**如何避免：**

```javascript
// Tab 管理器示例
class TabManager {
  constructor() {
    this.tabs = new Map(); // tabId -> { view, listeners }
  }

  createTab(containerId, url) {
    const tabId = generateUniqueId();
    const ses = getContainerSession(containerId);
    const view = new WebContentsView({
      webPreferences: { session: ses }
    });

    // 记录所有监听器以便后续清理
    const listeners = [];
    const onTitleUpdate = (event, title) => this.updateTabTitle(tabId, title);
    view.webContents.on('page-title-updated', onTitleUpdate);
    listeners.push({ event: 'page-title-updated', handler: onTitleUpdate });

    this.tabs.set(tabId, { view, listeners, containerId });
    return tabId;
  }

  closeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // 1. 移除所有事件监听器
    for (const { event, handler } of tab.listeners) {
      tab.view.webContents.removeListener(event, handler);
    }

    // 2. 销毁 WebContents
    tab.view.webContents.close();
    tab.view = null;

    // 3. 从 Map 中移除引用
    this.tabs.delete(tabId);

    // 4. 提示 GC
    if (global.gc) global.gc();
  }
}
```

**预警信号：**
- 应用运行数小时后内存占用持续增长（通过 Activity Monitor 或 `process.memoryUsage()` 监控）
- 关闭 Tab 后内存不下降
- 创建 10+ Tab 后应用明显变慢
- DevTools → Memory → Heap Snapshot 显示大量 `WebContents` 或 `BrowserView` 残留对象

**应解决的阶段：**
Phase 2 — Tab 系统实现。在实现多 Tab 功能时必须同步实现完整的生命周期管理。

---

### 陷阱 4：BrowserView 已弃用 — 必须迁移到 WebContentsView

**问题描述：**
Electron 30（2024年4月）正式弃用了 `BrowserView` API。项目当前使用 Electron 32.x，虽然 `BrowserView` 仍然可用（但控制台会打印弃用警告），但未来的 Electron 版本（36+）可能会完全移除。如果在架构设计阶段继续使用 `BrowserView`，将面临大规模重写。

**根本原因：**
`BrowserView` 的设计有根本性限制：
- 不支持 z-index 层叠管理
- 无法与 CSS 布局系统集成
- 一个窗口只能绑定一个 `BrowserView`（需要 hack 才能实现多 Tab）
- 与现代 Electron 的 `BaseWindow` 架构不兼容

**如何避免：**

直接使用 `WebContentsView` + `BaseWindow`：

```javascript
// 推荐：使用 WebContentsView（Electron 30+）
const { BaseWindow, WebContentsView } = require('electron');

// 创建主窗口（使用 BaseWindow 替代 BrowserWindow）
const mainWindow = new BaseWindow({
  width: 1400,
  height: 900,
  titleBarStyle: 'hiddenInset',
});

// 创建 UI 层（工具栏等）
const uiView = new WebContentsView();
mainWindow.contentView.addChildView(uiView);
uiView.setBounds({ x: 0, y: 0, width: 1400, height: 80 });
uiView.webContents.loadFile('src/toolbar.html');

// 创建内容层（网页显示区域）
const contentView = new WebContentsView({
  webPreferences: {
    session: getContainerSession('work'),
  }
});
mainWindow.contentView.addChildView(contentView);
contentView.setBounds({ x: 0, y: 80, width: 1400, height: 820 });
contentView.webContents.loadURL('https://example.com');
```

**注意：** `BaseWindow` 不加载 `preload.js`（它没有自己的渲染进程）。需要通过 `WebContentsView.webContents` 与内容交互。UI 层需要通过单独的 `WebContentsView` 加载。

**预警信号：**
- 控制台出现 `BrowserView is deprecated and will be removed` 警告
- 代码中使用了 `win.setBrowserView()` 或 `new BrowserView()`
- 升级 Electron 版本后构建失败，报错 `BrowserView is not a constructor`

**应解决的阶段：**
Phase 1 — 架构选型。必须在项目初期就确定使用 `WebContentsView` 而非 `BrowserView`。

---

### 陷阱 5：容器 ID 碰撞和注入

**问题描述：**
当前容器 ID 通过 `name.toLowerCase().replace(/[^a-z0-9]/g, '-')` 生成，存在以下问题：
1. **碰撞** — "My Container" 和 "my-container" 生成相同 ID
2. **注入** — 如果 ID 被用于构建 partition 字符串或文件路径，恶意输入可能导致路径穿越
3. **数据覆盖** — 两个碰撞的容器共享 Session，导致完全的隔离失败

**根本原因：**
没有唯一性检查，也没有使用足够唯一的标识符（如 UUID）。

**如何避免：**

```javascript
const { randomUUID } = require('crypto');

// 容器 ID 生成策略
function generateContainerId(name, existingIds) {
  // 基础 ID：名称转换
  const baseId = name.toLowerCase()
    .replace(/[^a-z0-9一-龥]/g, '-')  // 支持中文
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // 检查是否已存在
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  // 碰撞时追加短 UUID
  const shortUuid = randomUUID().slice(0, 8);
  return `${baseId}-${shortUuid}`;
}

// 在创建容器时使用
function createContainer(name, config) {
  const existingIds = new Set(containers.keys());
  const id = generateContainerId(name, existingIds);
  // ...
}
```

**预警信号：**
- 容器配置文件中出现重复的 ID
- 创建容器后另一个容器的数据丢失
- Partition 字符串包含非法字符

**应解决的阶段：**
Phase 1 — 容器 CRUD。在实现容器创建功能时必须包含 ID 唯一性检查。

---

### 陷阱 6：Electron Session 存储路径不可控

**问题描述：**
`persist:` 前缀的 Session 数据存储在 Electron 的默认 userData 路径下（macOS: `~/Library/Application Support/<app-name>/`）。当容器数量增多，Session 数据（Cookie、Cache、LocalStorage、IndexedDB）会占用大量磁盘空间，且无法在应用内清理单个容器的缓存。

**根本原因：**
Electron 的 Session 管理是 Chromium 级别的，每个 `persist:xxx` partition 会创建完整的存储目录结构（包括 Cache、Code Cache、GPUCache 等）。应用层无法直接控制这些文件的存储位置和生命周期。

**如何避免：**

```javascript
// 方案 1：使用 session.clearStorageData() 按需清理
async function clearContainerData(containerId) {
  const ses = getContainerSession(containerId);
  await ses.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexeddb', 'cachestorage'],
  });
  await ses.clearCache();
}

// 方案 2：监控存储大小
async function getContainerStorageSize(containerId) {
  const ses = getContainerSession(containerId);
  const usage = await ses.getStorageSizeInfo();
  return usage; // { totalSize, cacheSize }
}

// 方案 3：在容器删除时彻底清理
async function deleteContainer(containerId) {
  const ses = getContainerSession(containerId);
  await ses.clearStorageData();
  await ses.clearCache();
  await ses.closeAllConnections();
  containers.delete(containerId);
  configStore.set('containers', Array.from(containers.values()));
}
```

**预警信号：**
- 应用的 userData 目录大小持续增长
- 删除容器后磁盘空间未释放
- 用户反馈应用占用过多磁盘空间

**应解决的阶段：**
Phase 1 — 容器 CRUD。在实现容器删除时必须包含完整的存储清理。

---

### 陷阱 7：Tab 切换时 Session 不同步

**问题描述：**
在单窗口多 Tab 架构中，用户点击不同容器的 Tab 时需要切换显示的内容区域。如果 Tab 的 WebContents 没有正确绑定到对应容器的 Session，会导致：
- 切换 Tab 后 Cookie 上下文错误
- 页面加载使用了错误的 Session
- 新建 Tab 意外继承了上一个 Tab 的 Session

**根本原因：**
`BaseWindow` 本身没有 Session 概念，Session 绑定在每个 `WebContentsView` 上。如果在创建 `WebContentsView` 时没有显式指定 `session`，它会使用默认 Session。

**如何避免：**

```javascript
// 每个 Tab 必须显式绑定到容器 Session
function createTabForContainer(containerId, url) {
  const ses = getContainerSession(containerId);

  const view = new WebContentsView({
    webPreferences: {
      session: ses,  // 关键：显式指定 session
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });

  view.webContents.loadURL(url);
  return view;
}

// 切换 Tab 时：确保显示的 view 对应正确的容器
function switchToTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;

  // 隐藏当前显示的 view
  if (currentView) {
    currentView.setVisible(false);
  }

  // 显示目标 view
  tab.view.setVisible(true);
  currentView = tab.view;

  // 验证 Session 一致性
  const containerId = tab.containerId;
  const expectedPartition = buildPartition(containerId);
  const actualPartition = tab.view.webContents.session.partition;
  console.assert(
    actualPartition === expectedPartition,
    `Session 不同步！期望 ${expectedPartition}，实际 ${actualPartition}`
  );
}
```

**预警信号：**
- 在容器 A 的 Tab 中操作后，切换到容器 B 的 Tab 时看到容器 A 的 Cookie
- DevTools 中 `document.cookie` 返回了错误容器的 Cookie
- 新建 Tab 时默认 Session 而非当前容器的 Session

**应解决的阶段：**
Phase 2 — Tab 系统。在实现多 Tab 功能时必须确保 Session 绑定正确。

---

### 陷阱 8：Event Listener 泄染进程累积

**问题描述：**
每次在渲染进程中渲染容器列表或 Tab 列表时，如果使用 `innerHTML` 替换内容并重新绑定事件监听器，旧的监听器不会被自动移除。随着时间推移，同一个 DOM 元素上可能绑定了数十个相同的事件处理器，导致：
- 点击一次触发多次回调
- 内存泄漏（闭包引用了旧的 DOM 节点）
- UI 行为不可预测

**根本原因：**
`innerHTML` 替换内容后，旧的 DOM 节点被移除，但如果有 JavaScript 闭包引用了这些节点，它们不会被 GC 回收。而且每次渲染都调用 `addEventListener` 会累积处理器。

**如何避免：**

```javascript
// 方案 1：事件委托（推荐）
// 只在容器元素上绑定一次监听器，通过 event.target 判断具体元素
containerListElement.addEventListener('click', (event) => {
  const target = event.target.closest('[data-container-id]');
  if (!target) return;

  const containerId = target.dataset.containerId;
  handleContainerClick(containerId);
});

// 方案 2：在替换内容前清理监听器
function renderContainerList(containers) {
  // 移除旧的监听器
  const oldButtons = containerListElement.querySelectorAll('.container-item');
  oldButtons.forEach(btn => {
    btn.removeEventListener('click', handleClick);
  });

  // 渲染新内容
  containerListElement.innerHTML = containers.map(c =>
    `<div class="container-item" data-id="${c.id}">${c.name}</div>`
  ).join('');

  // 绑定新监听器
  const newButtons = containerListElement.querySelectorAll('.container-item');
  newButtons.forEach(btn => {
    btn.addEventListener('click', handleClick);
  });
}
```

**预警信号：**
- 同一个按钮点击一次但回调执行了多次
- 在 DevTools → Event Listeners 中看到同一元素绑定了多个相同事件
- 应用运行时间越长，UI 响应越慢

**应解决的阶段：**
Phase 1 — UI 框架。在首次实现 UI 渲染时就采用事件委托模式。

---

### 陷阱 9：XSS 通过 Cookie 值注入

**问题描述：**
在 Cookie 管理界面中，如果直接将 Cookie 的名称和值通过 `innerHTML` 插入到 HTML 中，恶意网站设置的 Cookie 值可能包含 `<script>` 标签或事件处理器，导致 XSS 攻击。

**根本原因：**
Cookie 的值完全由远程服务器控制，是不可信的用户输入。`innerHTML` 会解析 HTML 实体和标签。

**如何避免：**

```javascript
// 错误：直接插入
cookieListElement.innerHTML += `
  <div>${cookie.name} = ${cookie.value}</div>
`;

// 正确：使用 textContent 或手动转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

cookieListElement.innerHTML += `
  <div>${escapeHtml(cookie.name)} = ${escapeHtml(cookie.value)}</div>
`;

// 或者完全使用 DOM API
const item = document.createElement('div');
item.textContent = `${cookie.name} = ${cookie.value}`;
cookieListElement.appendChild(item);
```

**预警信号：**
- Cookie 显示区域出现了异常的 HTML 渲染
- 在 Cookie 列表中看到闪烁或脚本执行
- 控制台出现 CSP 违规警告

**应解决的阶段：**
Phase 1 — UI 实现。在首次渲染 Cookie 列表时就使用安全的 DOM 操作。

---

### 陷阱 10：窗口关闭时资源清理不完整

**问题描述：**
当用户关闭窗口时，需要清理所有相关的 WebContents、Session 引用和内存映射。如果清理不完整，会导致：
- 内存泄漏（WebContents 未销毁）
- 文件句柄泄漏（Session 数据库未关闭）
- 应用退出挂起（有未完成的异步操作）

**根本原因：**
Electron 的 `closed` 事件在窗口关闭后触发，但此时 WebContents 可能仍在执行异步操作（如网络请求、Cookie 写入）。直接在 `closed` 事件中清理资源可能与正在进行的操作冲突。

**如何避免：**

```javascript
mainWindow.on('close', async (event) => {
  // 1. 阻止默认关闭行为
  event.preventDefault();

  // 2. 保存所有容器的 Cookie
  const savePromises = Array.from(tabs.values()).map(async (tab) => {
    await saveCookies(tab.containerId, tab.view.webContents.session);
  });
  await Promise.all(savePromises);

  // 3. 关闭所有 Tab 的 WebContents
  for (const [tabId, tab] of tabs) {
    tab.view.webContents.close();
    tab.view = null;
  }
  tabs.clear();

  // 4. 清理映射
  windowContainerMap.delete(mainWindow.id);

  // 5. 真正关闭窗口
  mainWindow.destroy();
});

// 6. 处理应用退出
app.on('before-quit', async () => {
  // 确保所有窗口的资源已清理
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
});
```

**预警信号：**
- 关闭窗口后应用进程未退出（在 Activity Monitor 中仍可见）
- 应用退出时控制台报错 `Cannot read properties of destroyed WebContents`
- 频繁开关窗口后内存占用持续增长

**应解决的阶段：**
Phase 2 — Tab 系统。在实现多 Tab 功能时必须同步实现完整的生命周期清理。

---

## 技术债务模式

| 捷径 | 短期收益 | 长期成本 | 何时可接受 |
|------|---------|---------|-----------|
| 使用 `innerHTML` 渲染 UI | 开发速度快 | XSS 风险、事件泄漏、维护困难 | 仅在原型阶段 |
| 跳过 Cookie domain 前导点号处理 | 简化持久化逻辑 | 部分站点登录状态丢失 | 绝对不行 |
| 使用 BrowserView 而非 WebContentsView | 文档多、示例丰富 | 未来版本被移除，需要大规模重写 | 绝对不行 |
| 不清理旧的事件监听器 | 代码更简单 | 内存泄漏、UI 卡顿 | 仅在 MVP 演示中 |
| 容器 ID 不做唯一性检查 | 代码更简单 | 数据覆盖、隔离失败 | 绝对不行 |
| 共享 Session 而非独立 Session | 减少内存占用 | 完全破坏隔离，安全灾难 | 绝对不行 |

## 集成陷阱

| 集成点 | 常见错误 | 正确做法 |
|--------|---------|---------|
| `session.fromPartition()` | 未验证 partition 名称唯一性 | 使用 UUID 或严格验证的字符串 |
| `session.cookies` | 未处理 domain 前导点号 | 保留原始 domain，正确处理匹配逻辑 |
| `WebContentsView` | 未显式指定 session 参数 | 创建时必须传入 `webPreferences.session` |
| `electron-store` | 无 schema 版本管理 | 添加版本号和迁移函数 |
| `contextBridge` | 未验证 IPC 入参 | 对所有入参进行类型和格式检查 |
| `mainWindow.contentView` | 未管理子视图的 z-index 和可见性 | 统一的视图管理层 |

## 性能陷阱

| 陷阱 | 症状 | 预防措施 | 触发阈值 |
|------|------|---------|---------|
| 启动时初始化所有 Session | 首次启动慢 | 延迟加载，仅在首次使用时初始化 | 容器 > 5 个 |
| 每次切换容器重渲染整个列表 | 切换卡顿 | 仅更新变化的 DOM 节点 | 容器 > 20 个 |
| Cookie 列表一次性渲染 | 模态框打开慢 | 虚拟滚动或分页加载 | Cookie > 500 条 |
| 每个 Tab 独立的 Chromium 进程 | 内存爆满 | 限制最大 Tab 数量，LRU 淘汰 | Tab > 15 个 |
| 同步读取 Cookie JSON 文件 | 阻塞主线程 | 异步读取，启动时预加载 | Cookie 文件 > 1MB |

## 安全陷阱

| 陷阱 | 风险 | 预防措施 |
|------|------|---------|
| Cookie 值未转义直接插入 HTML | XSS 攻击 | 使用 `textContent` 或 HTML 转义 |
| IPC 入参未验证 | 主进程被注入恶意数据 | 对所有入参做类型和格式校验 |
| 未启用 `sandbox: true` | 渲染进程可访问 Node.js API | 在 webPreferences 中启用沙箱 |
| 未设置 CSP 头 | 可加载外部恶意脚本 | 添加 `<meta>` CSP 限制资源来源 |
| Partition 名称可被用户输入控制 | 路径穿越、Session 劫持 | 白名单字符，严格验证 |
| 未限制 `webContents.executeJavaScript` | 任意代码执行 | 禁用或严格限制此 API |

## UX 陷阱

| 陷阱 | 用户影响 | 更好方案 |
|------|---------|---------|
| 容器切换时页面闪烁/白屏 | 体验差，感觉慢 | 预加载容器 Tab，切换时仅改变可见性 |
| 容器删除无确认对话框 | 误删导致数据丢失 | 弹出确认对话框，显示将删除的数据量 |
| Cookie 持久化无进度反馈 | 用户不确定是否保存成功 | 显示保存状态指示器 |
| 容器颜色选择无预设 | 用户需要输入 hex 值 | 提供预设颜色盘 |
| Tab 关闭无动画 | 突然消失，感觉不稳定 | 添加淡出动画 |

## "看起来完成了但其实没完成" 检查清单

- [ ] **容器隔离：** 验证容器 A 的 Cookie 在容器 B 中不可见 — 在 DevTools 中检查两个容器 Tab 的 Application → Cookies
- [ ] **Cookie 持久化：** 重启应用后 Cookie 仍在 — 登录某网站 → 关闭应用 → 重新打开 → 验证仍登录
- [ ] **Cookie domain：** 带前导点号的 Cookie 正确恢复 — 检查 `.example.com` 格式的 Cookie 是否正确匹配子域
- [ ] **内存清理：** 关闭 Tab 后内存下降 — 用 Activity Monitor 监控，关闭 5 个 Tab 后内存应减少
- [ ] **事件监听：** 按钮点击只触发一次 — 在回调中添加 `console.count()` 验证
- [ ] **窗口关闭：** 关闭窗口后进程退出 — 检查 Activity Monitor 是否有残留进程
- [ ] **容器 ID：** 创建同名容器不会覆盖 — 创建 "Work" 和 "work" 并验证两者共存
- [ ] **Session 绑定：** 每个 Tab 的 Session 正确 — 在 DevTools Console 中检查 `require('electron').remote.getCurrentWebContents().session.partition`

## 恢复策略

| 陷阱 | 恢复成本 | 恢复步骤 |
|------|---------|---------|
| Session 隔离泄漏 | HIGH | 需要重新设计 Session 绑定逻辑，所有 Tab 需重建 |
| Cookie domain 问题 | MEDIUM | 修复持久化/加载逻辑，清理现有错误数据后重新同步 |
| 内存泄漏 | MEDIUM | 添加清理逻辑，需要重启应用释放已泄漏的内存 |
| BrowserView 迁移 | HIGH | 重写所有 BrowserView 相关代码，改为 WebContentsView |
| 容器 ID 碰撞 | LOW | 添加 UUID 后缀，迁移现有容器配置到新 ID |
| 事件监听累积 | LOW | 改为事件委托，旧代码直接替换即可 |

## 陷阱到阶段映射

| 陷阱 | 预防阶段 | 验证方式 |
|------|---------|---------|
| Session 隔离泄漏 | Phase 1 - 基础容器 | 在两个容器中分别登录同一网站，验证状态不共享 |
| Cookie domain 前导点号 | Phase 1 - Cookie 持久化 | 检查持久化的 JSON 中 domain 字段是否正确保留 |
| 内存泄漏 | Phase 2 - Tab 系统 | 创建并关闭 10 个 Tab，验证内存回到基线 |
| BrowserView 弃用 | Phase 1 - 架构选型 | 代码中不使用 `BrowserView`，控制台无弃用警告 |
| 容器 ID 碰撞 | Phase 1 - 容器 CRUD | 创建同名容器测试，验证两者独立存在 |
| Session 存储路径 | Phase 1 - 容器 CRUD | 删除容器后检查 userData 目录大小是否减少 |
| Tab Session 不同步 | Phase 2 - Tab 系统 | 在 DevTools 中验证每个 Tab 的 session.partition 正确 |
| 事件监听累积 | Phase 1 - UI 框架 | 在 DevTools Event Listeners 面板中检查无重复绑定 |
| XSS 注入 | Phase 1 - UI 实现 | 在 Cookie 值中注入 `<script>alert(1)</script>` 测试 |
| 窗口关闭清理 | Phase 2 - Tab 系统 | 关闭窗口后检查 Activity Monitor 无残留进程 |

---

## 来源

- Electron 官方文档：Session API、Cookie API、WebContentsView
- Electron 30+ 弃用公告：BrowserView → WebContentsView 迁移指南
- RFC 6265：HTTP State Management Mechanism（Cookie domain 规范）
- Chromium 源码：Cookie 存储和匹配逻辑
- AutoBrowser 项目：Cookie 持久化实现参考
- Firefox Multi-Account Containers：隔离机制参考
- 项目代码库分析：main.js、src/renderer.js、CONCERNS.md

---

*陷阱研究：多容器隔离浏览器 (Electron)*
*研究日期：2026-07-23*

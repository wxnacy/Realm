# Technology Stack — v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面

**Project:** Realm Browser
**Researched:** 2026-07-25
**Mode:** Ecosystem
**Scope:** 仅覆盖 v1.1 新增能力所需的栈补充，基础栈（Electron 32.x、electron-store、Session API）不在本文件重复。

---

## Executive Summary

v1.1 的四个功能（容器属性扩展、收藏与历史、常用网站推荐、设置页面）**不需要引入任何新的 npm 依赖**。所有数据持久化通过扩展现有 electron-store schema 完成；浏览历史通过 webview 内置导航事件采集；默认浏览器注册使用 Electron 内置 API。

**核心决策：继续使用 electron-store（JSON 文件）作为唯一数据存储，不引入 SQLite。**

理由：
- 当前容器配置 + 收藏 + 历史的数据量远低于 electron-store 性能瓶颈（约 10 万条记录以内）
- 项目已有 electron-store 依赖，零迁移成本
- 避免引入 better-sqlite3 等原生编译依赖（增加构建复杂度、平台兼容问题）
- 如果未来数据量成为瓶颈，可单独迁移历史模块到 SQLite，不影响其他功能

---

## 1. 容器属性扩展（phone / email / notes）

### 需要什么

扩展容器 schema，增加 `phone`、`email`、`notes` 三个可选字段。

### 技术方案

**不需要新依赖。** 直接在 electron-store 的 `containers` 数组元素中增加字段。

```javascript
// 容器 schema 扩展示例
{
  id: 'work',
  name: '工作',
  color: '#3B82F6',
  icon: '💼',
  // v1.1 新增字段
  phone: '+86 138xxxx1234',
  email: 'user@company.com',
  notes: '公司账号，用于内部系统登录'
}
```

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `container-manager.js` | `DEFAULT_CONTAINERS` 增加默认空值；`createContainer`/`updateContainer` 接受新字段 |
| `src/preload.js` | IPC 接口透传新字段 |
| `src/renderer.js` | 容器编辑表单增加三个输入框 |
| `src/index.html` | 容器编辑模态框增加表单元素 |

### 风险评估

**风险：极低。** 纯 schema 扩展，向后兼容（新字段可选，旧数据自动补空值）。

---

## 2. 收藏夹管理（Bookmarks）

### 需要什么

在 electron-store 中新增 `bookmarks` 存储键，管理用户收藏的 URL。

### 技术方案

**不需要新依赖。** 使用 electron-store 新增一个独立的 `bookmarks` 键。

```javascript
// bookmarks schema
{
  bookmarks: [
    {
      id: 'bm-1721884800000',       // 唯一 ID（时间戳）
      containerId: 'work',           // 所属容器（可选，null 表示全局）
      url: 'https://github.com',
      title: 'GitHub',
      favicon: '',                   // 可选，favicon URL
      createdAt: '2026-07-25T08:00:00.000Z'
    }
  ]
}
```

### 数据操作

| 操作 | 方法 | 说明 |
|------|------|------|
| 添加收藏 | `configStore.set('bookmarks', [...])` | 从当前页面 URL + title 一键收藏 |
| 删除收藏 | 过滤后 `configStore.set()` | 按 id 删除 |
| 按容器筛选 | 渲染进程 `.filter(b => b.containerId === id)` | 内存过滤，无需索引 |
| 导入/导出 | JSON 文件读写 | electron-store 原生支持 `.store` 读取 |

### UI 集成

- 工具栏增加「收藏」按钮（星标图标），点击收藏当前 Tab 的 URL
- 侧边栏或新标签页显示收藏列表
- 支持右键菜单删除收藏

### 风险评估

**风险：低。** 纯 CRUD 操作，electron-store 完全胜任。

---

## 3. 浏览历史记录（Browsing History）

### 需要什么

追踪用户在每个容器内的页面导航，存储为可查询的历史记录。

### 技术方案

**不需要新依赖。** 利用 webview 内置导航事件 + electron-store 持久化。

#### 数据采集（渲染进程侧）

```javascript
// webview 导航事件监听
webview.addEventListener('did-navigate', (event) => {
  // 发送到主进程存储
  window.realmAPI.addHistoryEntry({
    containerId: currentContainerId,
    url: event.url,
    title: webview.getTitle(),  // executeJavaScript 获取
    timestamp: Date.now()
  });
});

// 同时监听 in-page 导航（SPA 路由变化）
webview.addEventListener('did-navigate-in-page', (event) => {
  if (event.isMainFrame) {
    window.realmAPI.addHistoryEntry({ ... });
  }
});
```

#### 数据存储（主进程侧）

```javascript
// history schema
{
  history: {
    'work': [
      {
        id: 'hist-1721884800000',
        url: 'https://github.com/org/repo',
        title: 'GitHub - org/repo',
        visitedAt: '2026-07-25T08:00:00.000Z',
        visitCount: 5
      }
    ],
    'personal': [ ... ]
  }
}
```

#### 去重与合并策略

- **相同 URL 连续访问**：合并为一条记录，更新 `visitedAt` 和 `visitCount`
- **相同 URL 非连续访问**：保留最新记录，`visitCount` 递增
- **每个容器上限**：10,000 条记录（FIFO 淘汰最旧条目）

#### 历史搜索

- 渲染进程内存过滤（从主进程一次性加载当前容器的历史）
- 支持按 URL 和 title 模糊匹配

### 关键注意事项

**webview 的 `did-navigate` 事件不提供页面 title。** 需要在导航完成后通过 `webview.executeJavaScript('document.title')` 获取。这需要异步操作，历史记录可能先以 URL 为 title 入库，后续更新。

### 风险评估

**风险：中低。**
- 数据量可控（每容器 1 万条上限，每条约 200 字节，总计约 2MB）
- electron-store 的 JSON 读写在 1 万条以内性能可接受（< 100ms）
- 如果未来性能不足，可单独将 history 迁移到 better-sqlite3

---

## 4. 常用网站智能推荐（Frequently Visited Sites）

### 需要什么

基于浏览历史数据，计算「常用网站」得分，在新标签页展示 Top N 推荐。

### 技术方案

**不需要新依赖。** 纯算法计算，基于已有的 history 数据。

#### 排名算法

```javascript
/**
 * 计算常用网站得分
 *
 * 公式：score = visitCount × recencyWeight
 *
 * recencyWeight 基于最后一次访问的时间衰减：
 * - 24 小时内：1.0
 * - 7 天内：0.7
 * - 30 天内：0.4
 * - 30 天以上：0.1
 *
 * @param {Object} entry - 历史记录条目
 * @returns {number} 得分
 */
function calculateScore(entry) {
  const now = Date.now();
  const lastVisit = new Date(entry.visitedAt).getTime();
  const daysSinceVisit = (now - lastVisit) / (1000 * 60 * 60 * 24);

  let recencyWeight;
  if (daysSinceVisit < 1) recencyWeight = 1.0;
  else if (daysSinceVisit < 7) recencyWeight = 0.7;
  else if (daysSinceVisit < 30) recencyWeight = 0.4;
  else recencyWeight = 0.1;

  return entry.visitCount * recencyWeight;
}
```

#### 域名聚合

将同一域名的访问记录聚合（如 `github.com/a` 和 `github.com/b` 合并为 `github.com`）：

```javascript
function aggregateByDomain(historyEntries) {
  const domainMap = new Map();

  for (const entry of historyEntries) {
    const domain = new URL(entry.url).hostname;
    if (!domainMap.has(domain)) {
      domainMap.set(domain, { domain, visitCount: 0, lastVisited: entry.visitedAt, sampleUrl: entry.url, sampleTitle: entry.title });
    }
    const agg = domainMap.get(domain);
    agg.visitCount += entry.visitCount;
    if (entry.visitedAt > agg.lastVisited) {
      agg.lastVisited = entry.visitedAt;
      agg.sampleUrl = entry.url;
      agg.sampleTitle = entry.title;
    }
  }

  return Array.from(domainMap.values())
    .map(site => ({ ...site, score: calculateScore(site) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12); // Top 12
}
```

#### 展示位置

- 新标签页（Tab 打开时的默认页面）
- 按容器隔离：每个容器只显示该容器的常用网站
- 支持用户手动固定/隐藏特定网站

### 风险评估

**风险：低。** 纯读取 history 数据 + 排序，计算量极小。

---

## 5. 设置页面（Settings Page）

### 需要什么

应用设置界面，包含默认浏览器注册、通用偏好设置等。

### 技术方案

#### 5.1 默认浏览器注册

**不需要新依赖。** 使用 Electron 内置 API：

```javascript
const { app, shell } = require('electron');

/**
 * 检查是否为默认浏览器
 * @returns {boolean}
 */
function isDefaultBrowser() {
  return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
}

/**
 * 设置为默认浏览器
 * macOS: 通过 LSSetDefaultHandlerForURLScheme 注册 http/https 处理程序
 * 需要应用已签名且 notarized，否则注册静默失败
 * @returns {boolean} 是否成功
 */
function setAsDefaultBrowser() {
  try {
    // 注册 http 和 https 协议
    app.setAsDefaultProtocolClient('http');
    app.setAsDefaultProtocolClient('https');
    return true;
  } catch (error) {
    console.error('[Realm] 设置默认浏览器失败:', error);
    return false;
  }
}

/**
 * 打开系统默认应用设置（macOS）
 * 作为 fallback，让用户手动设置
 */
function openSystemDefaultAppSettings() {
  // macOS: 打开「系统设置 > 通用 > 默认网页浏览器」
  shell.openExternal('x-apple.systempreferences:com.apple.preference');
}
```

**macOS 注意事项：**
- 应用必须代码签名 + notarized 才能注册为 http/https 处理程序
- 开发模式下注册可能不生效（需要 `process.execPath` 参数）
- macOS 15 (Sequoia) 对默认浏览器注册有更严格的安全要求

#### 5.2 通用设置项

使用 electron-store 存储应用偏好：

```javascript
// settings schema
{
  settings: {
    defaultSearchEngine: 'google',    // google | bing | duckduckgo | custom
    customSearchUrl: '',               // 自定义搜索引擎 URL
    newTabBehavior: 'frequent',        // frequent | blank | custom
    customNewTabUrl: '',               // 自定义新标签页 URL
    historyRetentionDays: 90,          // 历史记录保留天数（0=永久）
    maxHistoryEntries: 10000,          // 每个容器最大历史条目数
    showFrequentSites: true,           // 新标签页显示常用网站
    theme: 'dark'                      // dark | light | system
  }
}
```

#### 5.3 设置页面 UI

使用独立 BrowserWindow 打开设置页：

```javascript
// main.js
function openSettingsWindow() {
  const settingsWin = new BrowserWindow({
    width: 600,
    height: 500,
    title: '设置',
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      contextIsolation: true
    }
  });
  settingsWin.loadFile('src/settings.html');
}
```

### 风险评估

**风险：中。**
- 默认浏览器注册依赖代码签名，开发阶段可能无法测试完整流程
- macOS 15 的安全策略可能需要额外适配
- 设置页面 UI 是新增的 BrowserWindow，需确保与主窗口的 IPC 通信正常

---

## 6. 不需要引入的依赖（Anti-Stack）

| 库 | 为什么不需要 |
|----|-------------|
| `better-sqlite3` | electron-store 在万级数据量下性能足够；原生编译依赖增加构建复杂度 |
| `nedb-promises` | 内存数据库不支持持久化，需要额外持久化层，不如直接用 electron-store |
| `lowdb` | 功能与 electron-store 重叠，且缺少 schema 验证 |
| `lodash/underscore` | 项目使用原生 JS，排序/过滤/聚合用原生方法即可 |
| `uuid` | `crypto.randomUUID()` 已内置，无需额外依赖 |
| `date-fns` | 日期格式化用原生 `Date` / `Intl.DateTimeFormat` 即可 |
| `fuse.js` | 历史搜索用原生 `String.includes()` / `RegExp` 即可，数据量小 |

---

## 7. 文件变更清单

### 新增文件

| 文件 | 用途 |
|------|------|
| `src/settings.html` | 设置页面 HTML 结构 |
| `src/styles/settings.css` | 设置页面样式 |
| `src/new-tab.html` | 新标签页（常用网站展示） |
| `src/styles/new-tab.css` | 新标签页样式 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `container-manager.js` | schema 扩展（phone/email/notes）、history CRUD、bookmarks CRUD |
| `src/preload.js` | 新增 IPC 接口（history、bookmarks、settings） |
| `src/renderer.js` | 容器编辑表单、收藏按钮、历史记录 UI |
| `src/index.html` | 收藏按钮、设置入口、历史侧边栏 |
| `src/styles/main.css` | 新增组件样式 |
| `main.js` | 新增 IPC handlers、settings window、默认浏览器逻辑 |
| `shortcut-manager.js` | 可能增加快捷键（如 Cmd+D 收藏、Cmd+H 历史） |

---

## 8. 安装命令

```bash
# 无新增依赖！
# v1.1 所有功能基于现有 electron-store + Electron 内置 API

# 如果后续发现 history 性能瓶颈，可选择性引入：
# npm install better-sqlite3@^11.0.0  # 仅在需要时
```

---

## Sources

- [Electron app API — setAsDefaultProtocolClient](https://www.electronjs.org/docs/latest/api/app#appsetasdefaultprotocolclientprotocol-path-args) — HIGH confidence
- [Electron webview tag — Navigation Events](https://www.electronjs.org/docs/latest/api/webview-tag#did-navigate) — HIGH confidence
- [electron-store — GitHub](https://github.com/sindresorhus/electron-store) — HIGH confidence
- 项目现有代码（container-manager.js、main.js、src/renderer.js）— HIGH confidence

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| 容器属性扩展 | HIGH | 纯 schema 扩展，向后兼容 |
| 收藏夹管理 | HIGH | 标准 CRUD，electron-store 完全胜任 |
| 浏览历史 | MEDIUM | 数据量是唯一不确定因素，万级以内无风险 |
| 常用网站推荐 | HIGH | 纯算法计算，基于已有数据 |
| 设置页面 | MEDIUM | 默认浏览器注册依赖代码签名，开发阶段难以完整测试 |
| 不引入新依赖的决策 | HIGH | 所有功能在现有栈内可实现 |

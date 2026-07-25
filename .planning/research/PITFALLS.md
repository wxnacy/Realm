# 领域陷阱研究

**领域：** 多容器隔离浏览器 (Electron) — v1.1 功能扩展
**研究日期：** 2026-07-25
**置信度：** MEDIUM（基于 websearch + 领域知识综合）

---

## 本文档说明

本文档聚焦 v1.1 里程碑新增功能的陷阱，即：向已有系统**添加**容器扩展属性、收藏与历史、常用网站推荐、设置页面时的常见错误。基础架构陷阱（Session 隔离、Cookie domain、内存泄漏等）请参见初始研究 PITFALLS.md（2026-07-23）。

---

## 关键陷阱

### 陷阱 1：electron-store 存储膨胀 — 历史记录和收藏用错存储引擎

**问题描述：**
将浏览历史记录和收藏夹数据直接存入 electron-store（JSON 文件），随着数据增长导致应用启动变慢、写入卡顿。

**根本原因：**
electron-store 每次 `.set()` 都会将**整个 JSON 对象**序列化并写入磁盘。浏览历史是高频写入场景（每次导航都记录），数据量可达数万条。当 JSON 文件超过 1MB 时：
- 每次写入耗时从 <1ms 增长到 50ms+
- 启动时全量加载到内存，占用数十 MB
- 无法做部分查询，必须全量反序列化

**如何避免：**
历史记录和收藏夹应使用 SQLite（`better-sqlite3`）而非 electron-store。electron-store 仅适合低频、小量配置数据（容器配置、设置项）。

```javascript
// 错误：用 electron-store 存历史
const historyStore = new Store({ name: 'history' });
historyStore.set('visits', [...thousandsOfEntries]); // 每次全量写入

// 正确：用 SQLite 存历史
const Database = require('better-sqlite3');
const db = new Database(path.join(app.getPath('userData'), 'history.db'));
db.pragma('journal_mode = WAL'); // 关键：启用 WAL 模式

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    visit_time INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 1
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_visits_container ON visits(container_id, visit_time DESC)');
```

**预警信号：**
- 应用启动越来越慢（>2秒）
- 导航到新页面时明显卡顿
- realm-config.json 文件超过 1MB

**应解决的阶段：**
Phase 1（历史记录存储选型）— 在实现历史记录功能前确定存储方案。

---

### 陷阱 2：容器属性 Schema 迁移 — 扩展字段导致旧配置崩溃

**问题描述：**
给容器添加 phone、email、notes 等新属性时，如果没有正确处理旧配置数据的迁移，会导致应用启动崩溃或数据丢失。

**根本原因：**
electron-store 没有内置的 schema 版本管理或迁移系统。当前容器配置结构为 `{ id, name, color, icon }`，添加新字段后：
- 旧配置中没有 phone/email/notes 字段，读取时返回 `undefined`
- 如果代码直接访问 `container.phone.length`，会抛出 TypeError
- `getContainers()` 返回的对象结构变化，渲染进程可能因此崩溃

**如何避免：**

```javascript
// 方案 1：在读取时填充默认值（推荐，简单可靠）
const DEFAULT_CONTAINER = {
  id: '', name: '', color: '#6B7280', icon: '🌐',
  phone: '',   // v1.1 新增
  email: '',   // v1.1 新增
  notes: '',   // v1.1 新增
};

function getContainers() {
  const saved = configStore.get('containers', DEFAULT_CONTAINERS);
  return saved.map(c => ({ ...DEFAULT_CONTAINER, ...c }));
}

// 方案 2：显式 schema 版本号 + 迁移函数
const SCHEMA_VERSION = 2; // 当前版本

function migrateSchema() {
  const version = configStore.get('_schemaVersion', 1);
  if (version < 2) {
    const containers = configStore.get('containers', []);
    containers.forEach(c => {
      c.phone = c.phone || '';
      c.email = c.email || '';
      c.notes = c.notes || '';
    });
    configStore.set('containers', containers);
    configStore.set('_schemaVersion', 2);
  }
}
```

**预警信号：**
- 更新代码后旧用户启动报 TypeError
- 新建容器正常，但旧容器的编辑表单显示异常
- 容器列表中部分容器缺少新字段

**应解决的阶段：**
Phase 1（容器属性扩展）— 在添加新字段前实现 schema 迁移机制。

---

### 陷阱 3：浏览历史的容器隔离 — 历史记录未按容器分离

**问题描述：**
浏览历史记录没有按容器 ID 分区，导致用户在"工作"容器浏览的网站出现在"个人"容器的历史中，破坏了容器隔离的核心价值。

**根本原因：**
实现历史记录时，如果只记录 `{ url, title, time }` 而不记录 `container_id`，所有容器的历史混在一起。这在"常用网站推荐"功能中尤为严重 — 推荐列表会泄露用户在其他容器的浏览行为。

**如何避免：**

```javascript
// 记录历史时必须包含 container_id
function recordVisit(containerId, url, title) {
  db.prepare(`
    INSERT INTO visits (container_id, url, title, visit_time)
    VALUES (?, ?, ?, ?)
  `).run(containerId, url, title, Date.now());
}

// 查询常用网站时按容器过滤
function getFrequentSites(containerId, limit = 8) {
  return db.prepare(`
    SELECT url, title, COUNT(*) as visit_count, MAX(visit_time) as last_visit
    FROM visits
    WHERE container_id = ?
    GROUP BY url
    ORDER BY visit_count DESC, last_visit DESC
    LIMIT ?
  `).all(containerId, limit);
}
```

**预警信号：**
- 在"工作"容器的新标签页看到"个人"容器常访问的网站
- 搜索历史时出现不属于当前容器的记录
- 用户反馈"隔离不彻底"

**应解决的阶段：**
Phase 2（历史记录实现）— 在数据库设计时就将 container_id 作为必填字段。

---

### 陷阱 4：常用网站 frecency 算法 — 排序结果不符合直觉

**问题描述：**
常用网站推荐的排序算法如果只按访问次数排序，会导致以下问题：
- 一周前高频访问但最近不再访问的网站始终排在前面
- 最近新发现的好网站因为总次数少而排不到推荐位
- 用户觉得"推荐不准"而放弃使用

**根本原因：**
纯粹的频率排序没有时间衰减，纯粹的最近访问排序没有频率权重。需要"频率 + 时间衰减"的复合算法（frecency）。

**如何避免：**

```javascript
// frecency 算法：频率 × 时间衰减
function calculateFrecencyScore(visitCount, lastVisitTime) {
  const now = Date.now();
  const daysSinceVisit = (now - lastVisitTime) / (1000 * 60 * 60 * 24);

  // 时间衰减因子：访问越近，衰减越小
  let recencyMultiplier;
  if (daysSinceVisit < 1) recencyMultiplier = 1.0;        // 今天
  else if (daysSinceVisit < 7) recencyMultiplier = 0.8;   // 本周
  else if (daysSinceVisit < 30) recencyMultiplier = 0.5;  // 本月
  else recencyMultiplier = 0.2;                            // 更早

  // 对数缩放防止超高频网站垄断推荐位
  const frequencyScore = Math.log2(visitCount + 1);

  return frequencyScore * recencyMultiplier;
}

// 查询时计算 frecency 分数
function getTopSites(containerId, limit = 8) {
  const sites = db.prepare(`
    SELECT url, title, COUNT(*) as visit_count, MAX(visit_time) as last_visit
    FROM visits
    WHERE container_id = ?
    GROUP BY url
  `).all(containerId);

  return sites
    .map(site => ({
      ...site,
      frecency: calculateFrecencyScore(site.visit_count, site.last_visit),
    }))
    .sort((a, b) => b.frecency - a.frecency)
    .slice(0, limit);
}
```

**预警信号：**
- 常用网站列表长期不变，最近访问的网站不出现
- 某个网站访问 100 次后永远占第一位，即使已不再使用
- 用户反馈"推荐不准"

**应解决的阶段：**
Phase 3（常用网站推荐）— 在实现推荐功能时设计并调优 frecency 算法。

---

### 陷阱 5：macOS 默认浏览器注册 — 开发模式和打包模式行为不一致

**问题描述：**
在开发模式下测试 `setAsDefaultProtocolClient` 正常，但打包后注册失败或行为不一致。

**根本原因：**
macOS 对默认浏览器注册有严格限制：
1. **签名要求** — macOS 只允许已签名和公证（notarized）的应用注册为默认协议处理器
2. **Info.plist 声明** — 协议处理器必须在 `Info.plist` 的 `CFBundleURLTypes` 中声明
3. **开发模式** — 未签名的开发版本调用 `setAsDefaultProtocolClient` 会静默失败
4. **默认浏览器 vs 协议处理器** — `setAsDefaultProtocolClient('https')` 和注册为 HTTP/HTTPS 默认浏览器是不同的事情，后者需要更深层的系统集成

**如何避免：**

```javascript
// package.json 中的 electron-builder 配置
{
  "build": {
    "mac": {
      "protocols": [
        {
          "name": "Realm Browser",
          "schemes": ["http", "https"]  // 注册为 http/https 处理器
        }
      ]
    }
  }
}

// main.js 中处理默认浏览器状态检查
function checkDefaultBrowser() {
  // isDefaultProtocolClient 在 macOS 上可能不可靠
  const isDefault = app.isDefaultProtocolClient('http')
    && app.isDefaultProtocolClient('https');
  return isDefault;
}

// 设置为默认浏览器（需要打包后才能正常工作）
function setAsDefaultBrowser() {
  // macOS: 这会打开系统偏好设置让用户手动确认
  app.setAsDefaultProtocolClient('http');
  app.setAsDefaultProtocolClient('https');

  // 更可靠的方式：使用 shell.openExternal 打开系统设置
  // shell.openExternal('x-apple.systempreferences:com.apple.preference.internet');
}
```

**重要提醒：** macOS 上没有 API 可以静默设置默认浏览器，系统总会弹出确认对话框。这是 macOS 的安全设计，无法绕过。

**预警信号：**
- 开发模式下 `isDefaultProtocolClient` 返回 false 但不报错
- 打包后应用无法处理 http/https 链接
- 系统偏好设置中看不到 Realm Browser 选项

**应解决的阶段：**
Phase 4（设置页面）— 在实现设置页面时处理默认浏览器注册，并在打包后验证。

---

### 陷阱 6：收藏夹数据模型 — URL 去重和元数据同步

**问题描述：**
收藏夹实现中，如果直接存储用户输入的 URL，会导致：
- 同一页面的不同 URL 形式被重复收藏（`https://google.com` vs `https://www.google.com/`）
- 收藏的页面标题在源站更新后变得过时
- 收藏夹中的 favicon 丢失或不显示

**根本原因：**
URL 的等价性判断不是简单的字符串比较。`http://example.com`、`https://example.com`、`https://example.com/`、`https://www.example.com` 可能指向同一页面。

**如何避免：**

```javascript
// URL 归一化
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // 统一协议为 https
    parsed.protocol = 'https:';
    // 移除 www 前缀
    parsed.hostname = parsed.hostname.replace(/^www\./, '');
    // 移除末尾斜杠（仅路径为 / 时）
    if (parsed.pathname === '/') parsed.pathname = '';
    // 移除常见追踪参数
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(p => {
      parsed.searchParams.delete(p);
    });
    return parsed.href;
  } catch {
    return url; // 无法解析时保留原始 URL
  }
}

// 收藏时检查是否已存在
function addBookmark(containerId, url, title) {
  const normalized = normalizeUrl(url);
  const existing = db.prepare(
    'SELECT id FROM bookmarks WHERE container_id = ? AND normalized_url = ?'
  ).get(containerId, normalized);

  if (existing) {
    // 更新标题和访问时间，不重复添加
    db.prepare('UPDATE bookmarks SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), existing.id);
    return { updated: true, id: existing.id };
  }

  const result = db.prepare(
    'INSERT INTO bookmarks (container_id, url, normalized_url, title, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(containerId, url, normalized, title, Date.now());
  return { created: true, id: result.lastInsertRowid };
}
```

**预警信号：**
- 收藏夹中出现多个看起来一样的网站
- 收藏后再次收藏同一页面没有提示"已收藏"
- favicon 不显示或显示错误

**应解决的阶段：**
Phase 1（收藏夹实现）— 在数据模型设计时就考虑 URL 归一化。

---

### 陷阱 7：新标签页性能 — 常用网站加载阻塞页面渲染

**问题描述：**
新标签页打开时需要加载常用网站列表、收藏夹、容器快捷方式等数据，如果全部同步加载会导致白屏或明显卡顿。

**根本原因：**
SQLite 查询虽然很快（通常 <10ms），但如果在渲染进程的 `DOMContentLoaded` 中同步调用 IPC 等待主进程返回数据，会阻塞页面渲染。多个 IPC 调用串行执行时延迟叠加。

**如何避免：**

```javascript
// 方案 1：并行请求 + 异步渲染
async function initNewTabPage() {
  // 先渲染骨架屏/空白状态
  renderSkeleton();

  // 并行请求所有数据
  const [frequentSites, bookmarks, containers] = await Promise.all([
    window.realmAPI.getFrequentSites(currentContainerId),
    window.realmAPI.getBookmarks(currentContainerId),
    window.realmAPI.getContainers(),
  ]);

  // 异步渲染各模块
  renderFrequentSites(frequentSites);
  renderBookmarks(bookmarks);
  renderContainerShortcuts(containers);
}

// 方案 2：缓存 + 增量更新
let cachedTopSites = null;

async function getTopSites(containerId) {
  // 先返回缓存（如果有）
  if (cachedTopSites && cachedTopSites.containerId === containerId) {
    renderFrequentSites(cachedTopSites.data);
  }

  // 后台刷新
  const fresh = await window.realmAPI.getFrequentSites(containerId);
  cachedTopSites = { containerId, data: fresh };
  renderFrequentSites(fresh);
}
```

**预警信号：**
- 新标签页打开后有 200ms+ 的白屏
- 切换容器时新标签页内容闪烁
- 鼠标点击新标签页按钮后有明显延迟

**应解决的阶段：**
Phase 3（新标签页常用网站）— 在实现推荐功能时优化加载策略。

---

### 陷阱 8：设置页面 IPC 通道爆炸 — 每个设置项一个通道

**问题描述：**
为每个设置项创建独立的 IPC 通道（如 `settings:get-theme`、`settings:set-theme`、`settings:get-default-browser`...），导致 IPC 通道数量爆炸，维护困难。

**根本原因：**
随着设置项增多，IPC 通道数量线性增长。每个通道都需要在 main.js 注册、preload.js 暴露、renderer.js 调用，三处代码同步维护。

**如何避免：**

```javascript
// 错误：每个设置项一个通道
ipcMain.handle('settings:get-theme', () => configStore.get('theme'));
ipcMain.handle('settings:set-theme', (e, v) => configStore.set('theme', v));
ipcMain.handle('settings:get-default-browser', () => ...);
// ... N 个通道

// 正确：统一的设置读写接口
ipcMain.handle('settings:get', (event, key) => {
  assertTrustedSender(event);
  const ALLOWED_KEYS = ['theme', 'defaultBrowser', 'startupBehavior', 'historyRetention'];
  if (!ALLOWED_KEYS.includes(key)) {
    throw new Error(`不允许的设置项: ${key}`);
  }
  return configStore.get(key);
});

ipcMain.handle('settings:set', (event, key, value) => {
  assertTrustedSender(event);
  const SCHEMA = {
    theme: { type: 'string', values: ['light', 'dark', 'system'] },
    historyRetention: { type: 'number', min: 7, max: 365 },
    defaultBrowser: { type: 'boolean' },
  };
  const rule = SCHEMA[key];
  if (!rule) throw new Error(`不允许的设置项: ${key}`);
  if (!validateSetting(value, rule)) throw new Error(`无效的设置值: ${key}`);
  configStore.set(key, value);
  return true;
});
```

**预警信号：**
- ipc-handlers.js 中 `settings:` 开头的通道超过 10 个
- 添加新设置项需要修改 3 个文件
- 设置值没有校验逻辑

**应解决的阶段：**
Phase 4（设置页面）— 在设计 IPC 接口时采用统一的 key-value 模式。

---

### 陷阱 9：历史记录数据增长失控 — 没有清理策略

**问题描述：**
浏览历史记录持续增长，没有自动清理机制，最终导致 SQLite 数据库文件过大（数十 MB）、查询变慢、占用过多磁盘空间。

**根本原因：**
每次页面导航都会产生一条历史记录。假设用户每天浏览 100 个页面，一年就是 36,500 条记录。加上 URL 和标题数据，每年可产生 10-50MB 的数据。

**如何避免：**

```javascript
// 启动时执行清理（保留最近 N 天的历史）
function cleanupHistory(retentionDays = 90) {
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  const deleted = db.prepare('DELETE FROM visits WHERE visit_time < ?').run(cutoff);
  if (deleted.changes > 0) {
    console.log(`[Realm] 清理了 ${deleted.changes} 条过期历史记录`);
  }
  // 回收空间
  db.exec('VACUUM');
}

// 定期执行（例如每天一次）
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
setInterval(() => {
  const retention = configStore.get('historyRetention', 90);
  cleanupHistory(retention);
}, CLEANUP_INTERVAL);

// 应用启动时也执行一次
cleanupHistory(configStore.get('historyRetention', 90));
```

**预警信号：**
- history.db 文件超过 50MB
- 历史记录查询耗时超过 100ms
- 用户反馈应用占用过多磁盘空间

**应解决的阶段：**
Phase 2（历史记录实现）— 在实现历史功能时同步实现清理机制。

---

### 陷阱 10：收藏夹和历史的跨容器 UX 混乱

**问题描述：**
收藏夹和历史记录按容器隔离后，用户在切换容器时发现之前收藏的网站"消失了"，感到困惑。同时，用户可能希望在所有容器间共享某些收藏。

**根本原因：**
严格的容器隔离虽然保证了安全，但降低了便利性。用户可能不理解为什么"个人"容器的收藏在"工作"容器中看不到。

**如何避免：**

```javascript
// 方案 1：提供"全局收藏"选项（推荐）
// 收藏时可选择"仅此容器"或"所有容器"
function addBookmark(containerId, url, title, isGlobal = false) {
  db.prepare(`
    INSERT INTO bookmarks (container_id, url, normalized_url, title, is_global, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    isGlobal ? '_global' : containerId,
    url, normalizeUrl(url), title, isGlobal ? 1 : 0, Date.now()
  );
}

// 查询时同时返回容器收藏和全局收藏
function getBookmarks(containerId) {
  return db.prepare(`
    SELECT * FROM bookmarks
    WHERE container_id = ? OR container_id = '_global'
    ORDER BY created_at DESC
  `).all(containerId);
}

// 方案 2：UI 上明确标识来源
// 在收藏列表中用图标或标签区分"本容器"和"全局"
```

**预警信号：**
- 用户反馈"切换容器后收藏夹是空的"
- 用户尝试手动复制收藏到多个容器
- 支持渠道频繁收到"收藏丢失"的反馈

**应解决的阶段：**
Phase 1（收藏夹设计）— 在数据模型设计时考虑全局 vs 容器级收藏的需求。

---

## 中等陷阱

### 陷阱 11：SQLite 数据库备份和恢复

**问题描述：**
SQLite 数据库（历史记录、收藏夹）没有纳入现有的 Cookie 持久化和备份机制，用户可能丢失数据。

**如何避免：**
在应用退出时备份 SQLite 数据库文件，在容器数据导出功能中包含历史和收藏数据。

**应解决的阶段：** Phase 2（历史记录）— 同步考虑数据备份策略。

---

### 陷阱 12：favicon 缓存和显示

**问题描述：**
常用网站和收藏夹中的 favicon 需要异步获取和缓存，如果直接从网站实时获取，会导致：
- 首次加载时大量并发请求
- 某些网站的 favicon 获取失败
- 离线时无法显示 favicon

**如何避免：**
使用 Electron 的 `webContents` 获取页面 favicon 并缓存到本地文件系统。

**应解决的阶段：** Phase 3（常用网站）— 在实现新标签页时处理 favicon 缓存。

---

### 陷阱 13：设置页面的实时预览

**问题描述：**
主题切换等设置修改后，如果不在所有窗口实时生效，用户会认为"设置没生效"。

**如何避免：**
通过 IPC 广播通知所有窗口设置变更，使用 CSS 变量实现主题切换。

**应解决的阶段：** Phase 4（设置页面）— 在实现设置功能时处理实时预览。

---

## 恢复策略

| 陷阱 | 恢复成本 | 恢复步骤 |
|------|---------|---------|
| electron-store 膨胀 | HIGH | 迁移到 SQLite，需要数据迁移脚本 |
| Schema 迁移缺失 | MEDIUM | 添加默认值填充，修复崩溃代码 |
| 历史未按容器隔离 | HIGH | 需要重建数据库，现有数据无法区分来源 |
| frecency 算法不准 | LOW | 调整算法参数，重新计算分数 |
| macOS 默认浏览器 | LOW | 仅影响设置页面，不影响核心功能 |
| URL 去重缺失 | MEDIUM | 添加归一化逻辑，合并重复收藏 |
| 新标签页性能 | MEDIUM | 添加缓存和异步加载 |
| IPC 通道爆炸 | LOW | 重构为统一接口 |
| 数据增长失控 | MEDIUM | 添加清理机制，VACUUM 数据库 |
| 跨容器 UX | LOW | 添加全局收藏支持 |

---

## 阶段-陷阱映射

| 阶段 | 需要重点防范的陷阱 | 验证方式 |
|------|-------------------|---------|
| Phase 1: 容器属性扩展 | Schema 迁移 (陷阱2), 容器 CRUD 兼容性 | 升级后旧容器数据完整，新字段可编辑 |
| Phase 2: 收藏与历史 | 存储选型 (陷阱1), 容器隔离 (陷阱3), URL 去重 (陷阱6), 数据增长 (陷阱9) | 历史按容器隔离，收藏不重复，数据量可控 |
| Phase 3: 常用网站 | frecency 算法 (陷阱4), 新标签页性能 (陷阱7), favicon (陷阱12) | 推荐结果符合直觉，新标签页 <200ms 加载 |
| Phase 4: 设置页面 | 默认浏览器 (陷阱5), IPC 设计 (陷阱8), 实时预览 (陷阱13) | 设置保存/读取正常，主题切换即时生效 |

---

## 来源

- Electron 官方文档：Session API、app.setAsDefaultProtocolClient
- better-sqlite3 文档：WAL 模式、事务
- Mozilla Firefox frecency 算法设计
- macOS Info.plist CFBundleURLTypes 规范
- electron-store GitHub Issues：schema migration、performance
- 项目代码库分析：container-manager.js、ipc-handlers.js、src/renderer.js

---

*陷阱研究：多容器隔离浏览器 v1.1 功能扩展*
*研究日期：2026-07-25*

# Phase 8: 常用网站推荐 + 设置页面 - Research

**Researched:** 2026-07-25
**Domain:** frecency 算法、新标签页网格 UI、设置页面、electron-store 持久化
**Confidence:** HIGH

## Summary

Phase 8 实现两个核心功能：新标签页常用网站网格（基于 frecency 算法排序）和应用设置页面。项目已建立成熟的内部页面模式（realm:// 协议 → 本地 HTTP 服务器 → HTML 页面），history.html 和 favorites.html 是最佳参考模板。数据库层使用 better-sqlite3，每容器独立表（`history_{containerId}`），frecency 计算可直接在 SQL 层完成。

关键发现：
- 内部页面数据访问走 `/api/*` JSON 端点而非 IPC（webview guest 的 IPC 会被主进程拒绝）
- 工具栏按钮已有 settingsBtn（齿轮图标），但尚未绑定点击事件
- 新标签页已有基础结构（搜索框 + 容器快捷入口），需要扩展常用网站网格
- electron-store 用于配置持久化，configStore 是全局实例

**Primary recommendation:** 复用 history-page.js 的完整模式（API token 注入、DOM 渲染、事件委托），新增 `frequent-sites-manager.js` 模块处理 frecency 计算，新增 `/api/frequent-sites/*` 和 `/api/settings/*` API 端点。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| frecency 算法计算 | Main Process (SQLite) | — | better-sqlite3 在主进程运行，SQL 聚合查询效率最高 |
| 常用网站 API | Main Process (HTTP Server) | — | 本地 HTTP 服务器已承载 /api/history/* 和 /api/favorites/* |
| 新标签页 UI | Renderer (webview guest) | — | 内部页面在 webview 中加载，通过 /api/* 获取数据 |
| 设置页面 UI | Renderer (webview guest) | — | 同上，realm://settings 内部页面 |
| 设置持久化 | Main Process (electron-store) | — | configStore 已有全局实例，设置项直接写入 |
| 默认浏览器引导 | Main Process (app API) | — | app.setAsDefaultProtocolClient 是系统级 API |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FREQ-01 | 新标签页展示常用网站网格 | 新标签页已有基础结构，需扩展 6x2 CSS Grid 布局 |
| FREQ-02 | 常用网站基于 frecency 算法排序 | SQL 聚合查询实现 frequency * recency_weight 加权 |
| FREQ-03 | 常用网站按域名聚合 | SQL GROUP BY + SUBSTR 提取域名，单页面代表模式 |
| FREQ-04 | 常用网站显示 favicon | Google Favicon 服务 `https://www.google.com/s2/favicons?domain=xxx` |
| FREQ-05 | 常用网站按当前容器过滤 | D-13/D-14 决定：不按容器隔离，合并所有容器历史 |
| SETT-01 | 用户可以打开设置页面 | 工具栏已有 settingsBtn，需绑定点击事件打开 realm://settings |
| SETT-02 | 设置页面包含默认浏览器引导 | app.setAsDefaultProtocolClient + app.isDefaultProtocolClient |
| SETT-03 | 默认浏览器使用当前容器打开外部链接 | app.setAsDefaultProtocolClient('realm') + open-url 事件处理 |
| SETT-04 | 设置持久化（electron-store） | configStore.get/set 已有成熟模式 |
| SETT-05 | 设置页面包含历史记录保留天数配置 | 需新增定时清理逻辑，按配置天数删除旧记录 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 已安装 | frecency SQL 查询 | 项目已在 history-manager.js 中使用，WAL 模式已配置 |
| electron-store | 8.1.0+ | 设置持久化 | 项目已在 container-manager.js 中使用，configStore 已初始化 |
| electron | 32.x | 默认浏览器 API | app.setAsDefaultProtocolClient / isDefaultProtocolClient |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Favicon 服务 | N/A | 获取网站 favicon | `https://www.google.com/s2/favicons?domain=xxx&sz=48` |
| crypto.randomUUID | Node 内置 | API token 生成 | REALM_TOKEN 已在 main.js 中使用 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Google Favicon 服务 | DuckDuckGo favicon 服务 | Google 服务更稳定，但需外部网络；DuckDuckGo 备选 |
| SQL 聚合计算 frecency | 应用层 JavaScript 计算 | SQL 层性能更好，避免传输大量原始数据 |
| 新增独立缓存表 | 直接查询历史表 | 缓存表需维护一致性，直接查询更简单（D-02 决定） |

**Installation:**
无需新增依赖，所有必需库已安装。

## Package Legitimacy Audit

本阶段无需安装新包，所有依赖已存在。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| better-sqlite3 | npm | 8+ yrs | 高 | github.com/WiseLibs/better-sqlite3 | OK | 已安装 |
| electron-store | npm | 7+ yrs | 高 | github.com/sindresorhus/electron-store | OK | 已安装 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
用户点击工具栏齿轮图标
        │
        ▼
┌─────────────────────────────────────────────────┐
│           Renderer (src/renderer.js)            │
│  settingsBtn click → createTab('realm://settings') │
│  realmUrlToHttp() 转换为 localhost:PORT/settings   │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│         Main Process (main.js HTTP Server)      │
│  /settings → src/settings.html                  │
│  /api/settings/* → configStore 读写             │
│  /api/frequent-sites/* → frecency SQL 查询      │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│      Webview Guest (src/settings-page.js)       │
│  fetch('/api/settings?token=xxx') 获取设置      │
│  fetch('/api/frequent-sites?token=xxx') 获取网站 │
│  渲染 UI、处理用户交互                           │
└─────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── newtab.html          # 新标签页（替换现有内嵌 newTabPage div）
├── newtab-page.js       # 新标签页逻辑
├── settings.html        # 设置页面
├── settings-page.js     # 设置页面逻辑
├── history.html         # 已有（参考模板）
├── history-page.js      # 已有（参考模板）
└── styles/
    └── main.css         # 新增设置页面和常用网站网格样式

main.js                  # 新增 /api/frequent-sites/* 和 /api/settings/* 路由
frequent-sites-manager.js  # 新增：frecency 算法模块
```

### Pattern 1: 内部页面数据访问（已建立）

**What:** webview guest 通过本地 HTTP 服务器的 /api/* JSON 端点获取数据
**When to use:** 所有内部页面（history、favorites、newtab、settings）的数据访问
**Example:**
```javascript
// src/history-page.js（已建立模式）
const pageParams = new URLSearchParams(window.location.search);
const apiToken = pageParams.get('token') || '';
const containerId = pageParams.get('container') || 'default';

async function historyApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/history/${route}?${params.toString()}`, options);
  return res.json();
}
```

### Pattern 2: realm:// 路由注册（已建立）

**What:** 本地 HTTP 服务器路由映射，将 realm://xxx 映射到 src/xxx.html
**When to use:** 新增内部页面时
**Example:**
```javascript
// main.js realmServer 回调
if (reqPath === '/settings' || reqPath === '/settings/') {
  filePath = path.join(__dirname, 'src', 'settings.html');
} else if (reqPath.startsWith('/settings/')) {
  const subPath = reqPath.replace('/settings/', '');
  filePath = path.join(__dirname, 'src', subPath);
}
```

### Pattern 3: 工具栏按钮打开内部页面（已建立）

**What:** 点击工具栏按钮，在新 Tab 打开 realm:// 页面
**When to use:** 设置按钮绑定
**Example:**
```javascript
// src/renderer.js（historyBtn 模式）
elements.settingsBtn.addEventListener('click', () => {
  const containerId = state.currentContainer;
  let existingTabId = null;
  state.tabs.forEach((tab, tabId) => {
    if (tab.url === 'realm://settings' && tab.containerId === containerId) {
      existingTabId = tabId;
    }
  });
  if (existingTabId) {
    switchTab(existingTabId);
  } else {
    createTab(containerId, 'realm://settings');
  }
});
```

### Anti-Patterns to Avoid

- **在 webview guest 中使用 IPC:** webview guest 的 IPC 会被主进程 assertTrustedSender（CR-4）拒绝，必须走 /api/* HTTP 端点
- **innerHTML 拼接用户数据:** 历史记录的 URL/title 是攻击者可控数据，必须使用 textContent 或 escapeHtml（CR-3）
- **在新标签页直接操作 webview:** 新标签页是 webview guest，无法直接控制宿主 webview，点击卡片应使用 `window.open(url, '_blank')` 或 postMessage 通知宿主

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| favicon 获取 | 自建 favicon 爬虫/缓存 | Google Favicon 服务 | 稳定可靠，支持任意域名，返回标准化图片 |
| SQL 注入防护 | 自建转义函数 | sanitizeContainerId() 已有 | 正则白名单 `[a-z0-9-]+` 已在 history-manager.js 中实现 |
| 配置持久化 | 自建 JSON 文件读写 | electron-store | 已有全局 configStore，支持默认值、类型安全 |
| 默认浏览器检测 | 自建注册表/plist 读取 | app.isDefaultProtocolClient | Electron 内置 API，跨平台支持 |

## Common Pitfalls

### Pitfall 1: frecency 查询性能
**What goes wrong:** 全表扫描计算 frecency 在历史记录量大时（10000 条/容器）响应缓慢
**Why it happens:** 没有索引支持 GROUP BY 和 ORDER BY 操作
**How to avoid:** 确保 `visited_at` 和 `url` 字段有索引（已有 `idx_{tableName}_visited_at` 和 `idx_{tableName}_url`）；frecency 查询应限制时间窗口（如最近 30 天）减少扫描范围
**Warning signs:** 新标签页加载超过 500ms

### Pitfall 2: 域名提取 SQL 兼容性
**What goes wrong:** SQLite 的字符串函数不支持正则表达式，域名提取需要特殊处理
**Why it happens:** URL 格式多样（带端口、路径、查询参数），简单 SUBSTR 可能不准确
**How to avoid:** 使用 `SUBSTR(url, INSTR(url, '://') + 3)` 提取域名部分，再用 `INSTR(domain, '/')` 截断路径；或使用 `REPLACE(SUBSTR(url, INSTR(url, '://') + 3), 'www.', '')` 去除 www 前缀
**Warning signs:** 聚合结果包含同一域名的多个变体

### Pitfall 3: 新标签页与 webview 通信
**What goes wrong:** 新标签页在 webview guest 中，无法直接操作宿主页面的 DOM 或状态
**Why it happens:** webview guest 与宿主进程隔离，IPC 被拒绝
**How to avoid:** 卡片点击使用 `window.open(url, '_blank')` 触发主进程的 setWindowOpenHandler 拦截，由宿主 renderer 创建新 Tab
**Warning signs:** 点击卡片后页面无反应或报错

### Pitfall 4: 设置变更即时生效
**What goes wrong:** 设置保存后，其他模块（如历史清理定时器）未感知变更
**Why it happens:** electron-store 是同步 API，但定时器等异步逻辑需要主动轮询或事件通知
**How to avoid:** 设置保存后，主进程应重新读取配置并更新相关逻辑（如重新设置清理定时器）
**Warning signs:** 修改历史保留天数后，旧记录未按新策略清理

## Code Examples

### frecency SQL 查询（核心算法）

```sql
-- frecency = frequency * recency_weight
-- recency_weight: 最近 7 天内访问权重最高，随时间衰减
SELECT
  -- 域名提取：去掉协议前缀和路径
  CASE
    WHEN url LIKE 'https://%' THEN SUBSTR(url, 9, INSTR(SUBSTR(url, 9), '/') - 1)
    WHEN url LIKE 'http://%' THEN SUBSTR(url, 8, INSTR(SUBSTR(url, 8), '/') - 1)
    ELSE url
  END AS domain,
  -- 代表页面：访问次数最多的 URL
  (SELECT url FROM history_default h2
   WHERE h2.url LIKE '%' || domain || '%'
   ORDER BY visited_at DESC LIMIT 1) AS representative_url,
  -- 代表标题
  (SELECT title FROM history_default h2
   WHERE h2.url LIKE '%' || domain || '%'
   ORDER BY visited_at DESC LIMIT 1) AS representative_title,
  -- 代表 favicon
  (SELECT favicon_url FROM history_default h2
   WHERE h2.url LIKE '%' || domain || '%'
   ORDER BY visited_at DESC LIMIT 1) AS favicon_url,
  -- frecency 分数
  COUNT(*) * (
    CASE
      WHEN MAX(visited_at) > strftime('%s', 'now') * 1000 - 7 * 86400000 THEN 10
      WHEN MAX(visited_at) > strftime('%s', 'now') * 1000 - 30 * 86400000 THEN 5
      ELSE 1
    END
  ) AS frecency_score
FROM history_default
WHERE visited_at > strftime('%s', 'now') * 1000 - 90 * 86400000
GROUP BY domain
ORDER BY frecency_score DESC
LIMIT 12;
```

### electron-store 设置读写

```javascript
// main.js（已有模式）
const configStore = new Store({ name: 'realm-config' });

// 读取设置（带默认值）
const retentionDays = configStore.get('settings.historyRetentionDays', 30);
const defaultContainer = configStore.get('settings.defaultContainer', 'default');

// 写入设置
configStore.set('settings.historyRetentionDays', 7);
configStore.set('settings.defaultContainer', 'work');
```

### 设置页面 API 端点

```javascript
// main.js handleSettingsApi 函数
async function handleSettingsApi(req, res, reqUrl) {
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  const route = reqUrl.pathname.replace('/api/settings/', '');

  if (route === 'get' && req.method === 'GET') {
    sendJson(res, 200, {
      historyRetentionDays: configStore.get('settings.historyRetentionDays', 30),
      defaultContainer: configStore.get('settings.defaultContainer', 'default'),
    });
    return;
  }

  if (route === 'update' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.historyRetentionDays !== undefined) {
      configStore.set('settings.historyRetentionDays', body.historyRetentionDays);
    }
    if (body.defaultContainer !== undefined) {
      configStore.set('settings.defaultContainer', body.defaultContainer);
    }
    sendJson(res, 200, { success: true });
    return;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 新标签页内嵌在 index.html | 独立 realm://newtab 页面 | Phase 8（本阶段） | 新标签页可独立加载 frecency 数据 |
| 无设置页面 | realm://settings 内部页面 | Phase 8（本阶段） | 用户可配置应用选项 |
| 工具栏 settingsBtn 未绑定 | 点击打开 realm://settings | Phase 8（本阶段） | 设置入口可用 |

**Deprecated/outdated:**
- index.html 中的内嵌 `#newTabSearch` 和 `#containerShortcuts`：将被新的 realm://newtab 页面替代

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google Favicon 服务在国内可访问 | Standard Stack | 如果不可访问，需要降级为首字母图标（已有 fallback 逻辑） |
| A2 | SQLite INSTR 函数在 better-sqlite3 版本中可用 | Code Examples | INSTR 是 SQLite 核心函数，应该可用，但需验证 |
| A3 | app.isDefaultProtocolClient 在 Electron 32 中支持 | Architecture | Electron 文档确认支持，但具体行为可能因平台而异 |

## Open Questions

1. **新标签页是替换现有内嵌 div 还是新增独立页面？**
   - What we know: 现有 newTabPage 是 index.html 中的 div，新标签页在 webview 中显示
   - What's unclear: 是否需要保留现有内嵌 div 作为 fallback
   - Recommendation: 新增独立 realm://newtab 页面，现有 div 保留但隐藏（向后兼容）

2. **frecency 算法的时间窗口参数**
   - What we know: CONTEXT.md 指定 90 天作为最长历史记录保留期
   - What's unclear: recency_weight 的具体衰减曲线
   - Recommendation: 使用 3 级权重（7 天内 10x，30 天内 5x，90 天内 1x），简单有效

3. **设置页面是否需要容器隔离？**
   - What we know: 历史记录和收藏夹按容器隔离
   - What's unclear: 设置是全局还是每容器
   - Recommendation: 设置全局共享（configStore 是全局实例），不按容器隔离

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 主进程 | ✓ | — | — |
| better-sqlite3 | frecency 查询 | ✓ | 已安装 | — |
| electron-store | 设置持久化 | ✓ | 已安装 | — |
| Electron 32.x | 默认浏览器 API | ✓ | 已安装 | — |
| 本地 HTTP 服务器 | /api/* 端点 | ✓ | 已运行 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前无测试框架） |
| Config file | none — 需在 Wave 0 配置 |
| Quick run command | `npm test`（待配置） |
| Full suite command | `npm test`（待配置） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FREQ-01 | 新标签页展示常用网站网格 | manual-only | — | — |
| FREQ-02 | frecency 算法排序正确性 | unit | `npm test -- frecency` | Wave 0 |
| FREQ-03 | 域名聚合逻辑正确性 | unit | `npm test -- domain-aggregation` | Wave 0 |
| FREQ-04 | favicon 显示和降级 | manual-only | — | — |
| FREQ-05 | 容器过滤逻辑 | unit | `npm test -- container-filter` | Wave 0 |
| SETT-01 | 设置页面可打开 | manual-only | — | — |
| SETT-02 | 默认浏览器引导 | manual-only | — | — |
| SETT-03 | 默认浏览器容器 | manual-only | — | — |
| SETT-04 | 设置持久化 | unit | `npm test -- settings-persistence` | Wave 0 |
| SETT-05 | 历史记录保留天数 | unit | `npm test -- history-retention` | Wave 0 |

### Sampling Rate
- **Per task commit:** 无（项目未配置测试框架）
- **Per wave merge:** 无
- **Phase gate:** 手动验证所有需求

### Wave 0 Gaps
- [ ] `tests/test-frecency.js` — 覆盖 FREQ-02, FREQ-03
- [ ] `tests/test-settings.js` — 覆盖 SETT-04, SETT-05
- [ ] Framework install: `npm install --save-dev jest` 或 `vitest` — 项目当前无测试框架

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | API token 鉴权（REALM_TOKEN）防 CSRF |
| V5 Input Validation | yes | sanitizeContainerId() 白名单校验；escapeHtml() 防 XSS |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL 注入 | Tampering | sanitizeContainerId() 正则白名单 + 参数化查询 |
| XSS via innerHTML | Information Disclosure | escapeHtml() + textContent 渲染用户数据 |
| CSRF via localhost | Elevation of Privilege | REALM_TOKEN 鉴权，防端口扫描 |
| 路径遍历 | Information Disclosure | filePath.startsWith(path.join(__dirname, 'src')) 安全检查 |

## Sources

### Primary (HIGH confidence)
- `src/history-page.js` — 内部页面完整模式参考
- `src/history.html` — HTML 结构模板
- `main.js` — HTTP 服务器、API 端点、路由注册模式
- `history-manager.js` — better-sqlite3 使用模式、表结构
- `src/renderer.js` — 工具栏按钮事件绑定模式
- `src/styles/main.css` — CSS Grid 布局、深色主题变量

### Secondary (MEDIUM confidence)
- `08-CONTEXT.md` — 用户决策和实现细节
- `08-UI-SPEC.md` — UI 设计规范和组件结构

### Tertiary (LOW confidence)
- Google Favicon 服务可用性（国内网络环境）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有依赖已安装，模式已建立
- Architecture: HIGH — 内部页面模式成熟，参考模板完整
- Pitfalls: MEDIUM — frecency SQL 查询性能需实际测试验证

**Research date:** 2026-07-25
**Valid until:** 2026-08-25（30 天，Electron 32.x 稳定版本）

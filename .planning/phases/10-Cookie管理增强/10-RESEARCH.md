# Phase 10: Cookie 管理增强 - Research

**Researched:** 2026-07-26
**Domain:** Electron Cookie 管理、UI 增强
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COOKIE-01 | 支持 Session 和文件两种数据来源查看 Cookie | 已有 `getContainerCookies()` 和 `cookie-manager.js` 的 `loadCookies()` 可扩展 |
| COOKIE-02 | 支持按域名过滤 Cookie（仅当前域名/包含子域名/全部） | Electron `session.cookies.get({})` 返回完整域名信息，可客户端过滤 |
| COOKIE-03 | 手动保存当前域名 Cookie 到文件（合并模式） | 已有 `saveCookies()` 实现合并模式，需暴露为 UI 按钮 |
| COOKIE-04 | 支持单条 Cookie 编辑和删除 | Electron `session.cookies.set()` 和 `session.cookies.remove()` 原生支持 |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 保持模态框形式（增强版），不改为全页面
- **D-02:** 采用顶部工具栏 + 列表 + 底部操作的三段式布局
- **D-03:** 模态框宽度增加到 700-800px
- **D-04:** Cookie 列表采用分页显示，每页 20-30 条
- **D-05:** 使用标签页（Tab）切换 Session 和 File 数据来源
- **D-06:** 标签页明确标注类型：Session（实时）和 File（持久化）
- **D-07:** 两个标签页显示独立视图
- **D-08:** 切换标签页时懒加载数据
- **D-09:** 默认自动检测当前标签页的域名进行过滤
- **D-10:** 用户可选过滤范围：仅当前域名 / 包含子域名 / 全部
- **D-11:** 过滤控件放在工具栏内（紧凑设计）
- **D-12:** 过滤按钮点击后展开选项，默认使用"包含子域名"
- **D-13:** 使用弹窗编辑模态框，不采用行内编辑
- **D-14:** 可编辑字段共 8 个：name、value、domain、path、expirationDate、secure、httpOnly、sameSite
- **D-15:** 编辑后点击保存按钮立即更新 Session 和文件
- **D-16:** 保存成功后显示简短成功提示

### Claude's Discretion
- Cookie 列表的排序方式（按域名、按名称、按过期时间等）
- 分页控件的具体样式和位置
- 编辑模态框的表单布局和验证逻辑
- 删除 Cookie 的确认机制（是否需要确认对话框）
- Session 和 File 数据源的错误处理策略

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Summary

本阶段需要增强现有的 Cookie 管理面板，核心变化包括：

1. **双数据源查看**：在现有 Session Cookie 查看基础上，增加文件持久化 Cookie 的查看能力。Session 来源通过已有的 `containerManager.getContainerCookies()` 获取；File 来源需要新增读取 `cookies.json` 文件的 IPC 接口。

2. **域名过滤**：在工具栏增加域名过滤控件，支持三种模式。由于 Cookie 数据已通过 `session.cookies.get({})` 全量获取，过滤可在渲染进程客户端完成，无需后端额外接口。

3. **单条编辑/删除**：需要在 `cookie-manager.js` 新增 `editCookie()` 和 `deleteSingleCookie()` 函数，在 `ipc-handlers.js` 新增对应 IPC 通道，在 `preload.js` 暴露 API。Electron 的 `session.cookies.set()` 和 `session.cookies.remove()` 原生支持这些操作。

4. **UI 重构**：模态框从当前简单的列表升级为三段式布局（工具栏 + 列表 + 底部操作），宽度增至 750px，增加分页控件。

**Primary recommendation:** 复用已有的 `cookie-manager.js` 基础设施，新增 3 个函数（`getSessionCookies`、`editCookie`、`deleteSingleCookie`）和 3 个 IPC 通道，渲染进程侧增加客户端过滤和分页逻辑。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cookie CRUD 操作 | Main Process | — | Electron Session API 仅在主进程可用 |
| Cookie 文件读写 | Main Process | — | Node.js fs 模块仅在主进程可用 |
| 域名过滤 | Renderer | — | 纯客户端数据过滤，无需 IPC |
| 分页逻辑 | Renderer | — | 纯客户端数据分页，无需 IPC |
| UI 渲染 | Renderer | — | DOM 操作仅在渲染进程 |
| 数据源切换 | Renderer | Main Process | 触发不同 IPC 调用获取不同来源数据 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron Session API | 32.x (内置) | Cookie 读写删改 | 项目已选定 Electron，Session API 是 Cookie 操作的唯一途径 |
| electron-store | 8.1.0+ | 容器配置持久化 | 项目已在使用，用于读取容器列表 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fs | 内置 | 读取 cookies.json 文件 | File 数据源切换时读取持久化 Cookie |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 客户端分页 | 服务端分页 IPC | 客户端分页更简单，Cookie 数据量通常不大（<1000 条），无需服务端分页 |
| 行内编辑 | 弹窗编辑 | 弹窗编辑更安全，避免误操作，且表单布局更清晰 |

## Package Legitimacy Audit

> 本阶段不安装任何外部包，仅使用 Electron 内置 API 和项目已有依赖。

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (无新增包) | — | — | — |

## Architecture Patterns

### 现有 Cookie 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Process                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  cookie-manager.js                                   │   │
│  │  - saveCookies(containerId)     → cookies.json       │   │
│  │  - loadCookies(containerId)     → session.cookies    │   │
│  │  - deleteCookies(containerId)   → 删除文件+目录       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  container-manager.js                                │   │
│  │  - getContainerCookies(id)    → session.cookies.get  │   │
│  │  - clearContainerCookies(id)  → session.clearStorage │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │ IPC
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  renderer.js → showCookiesModal()                    │   │
│  │  - getContainerCookies(id) → 显示列表                │   │
│  │  - clearContainerCookies() → 清除全部                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Phase 10 新增数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Process                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  cookie-manager.js (新增函数)                         │   │
│  │  - getSessionCookies(containerId)  → 直接返回 session │   │
│  │  - getFileCookies(containerId)     → 读取 cookies.json│   │
│  │  - editCookie(containerId, cookie) → set + 保存文件   │   │
│  │  - deleteSingleCookie(...)         → remove + 保存    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ipc-handlers.js (新增通道)                           │   │
│  │  - cookie:get-session     → getSessionCookies        │   │
│  │  - cookie:get-file        → getFileCookies           │   │
│  │  - cookie:edit            → editCookie               │   │
│  │  - cookie:delete-single   → deleteSingleCookie       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │ IPC
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  renderer.js (增强)                                   │   │
│  │  - sourceTabs 切换 → 调用不同 IPC 获取数据             │   │
│  │  - domainFilter 过滤 → 客户端过滤 cookie 列表         │   │
│  │  - pagination 分页 → 客户端分页 cookie 列表           │   │
│  │  - editCookieModal → 编辑表单 → 调用 cookie:edit      │   │
│  │  - deleteCookie → 确认 → 调用 cookie:delete-single   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
cookie-manager.js          # 新增 editCookie, deleteSingleCookie, getFileCookies
ipc-handlers.js            # 新增 4 个 IPC 通道
src/preload.js             # 新增 4 个 API 方法
src/renderer.js            # 增强 cookiesModal 逻辑
src/index.html             # 更新 cookiesModal HTML
src/styles/main.css        # 新增样式
```

### Pattern 1: Electron Session Cookie 操作

**What:** 使用 Electron Session API 操作 Cookie 的标准模式
**When to use:** 编辑、删除、查询 Cookie 时
**Example:**
```javascript
// Source: Electron 官方文档
// 获取 Cookie
const cookies = await session.cookies.get({ url: 'http://example.com' });

// 设置 Cookie（编辑用同一个方法，通过 name+domain+path 匹配覆盖）
await session.cookies.set({
  url: 'http://example.com',
  name: 'session_id',
  value: 'new_value',
  domain: '.example.com',
  path: '/',
  expirationDate: Date.now() / 1000 + 86400,
  secure: true,
  httpOnly: true,
  sameSite: 'lax',
});

// 删除 Cookie
await session.cookies.remove('http://example.com', 'session_id');
```

### Pattern 2: 客户端过滤与分页

**What:** 在渲染进程对已加载数据进行过滤和分页
**When to use:** Cookie 列表展示时
**Example:**
```javascript
// 域名过滤（三种模式）
function filterCookies(cookies, domain, mode) {
  switch (mode) {
    case 'exact':
      return cookies.filter(c => c.domain === domain || c.domain === `.${domain}`);
    case 'subdomain':
      return cookies.filter(c => {
        const d = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
        return d === domain || d.endsWith(`.${domain}`);
      });
    case 'all':
    default:
      return cookies;
  }
}

// 客户端分页
function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
```

### Anti-Patterns to Avoid

- **直接拼接 Cookie 值到 innerHTML**：Cookie 值由网站设置，是攻击者可控数据，必须使用 `textContent`（CR-3 修复已有此模式）
- **编辑后不同步文件**：编辑 Session Cookie 后必须同步更新 cookies.json，否则重启后丢失修改
- **删除时不保存文件**：删除 Session Cookie 后必须从 cookies.json 中移除对应条目

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie 操作 | 自行解析 Cookie 字符串 | Electron Session API | Session API 处理了所有边界情况（编码、过期、安全属性） |
| Cookie 唯一标识 | 自定义 ID 生成 | `domain + name + path` 组合 | 这是 Cookie 的标准唯一标识，Electron 内部也用此标识 |
| 过期时间格式 | 自定义日期解析 | `Date.now() / 1000 + seconds` | Electron 使用 Unix 时间戳（秒），与 JavaScript Date 一致 |

## Common Pitfalls

### Pitfall 1: Session Cookie 编辑后未同步文件
**What goes wrong:** 用户编辑了 Session 中的 Cookie，但重启后修改丢失
**Why it happens:** 只调用了 `session.cookies.set()` 而没有更新 cookies.json
**How to avoid:** 编辑操作必须同时更新 Session 和文件
**Warning signs:** 编辑后刷新页面 Cookie 值回退

### Pitfall 2: Cookie 删除后文件中残留
**What goes wrong:** 删除 Cookie 后文件中仍存在该条目，下次加载时又出现
**Why it happens:** 只调用了 `session.cookies.remove()` 而没有从 cookies.json 中删除
**How to avoid:** 删除操作必须同时从 Session 和文件中移除
**Warning signs:** 删除后重启应用 Cookie 重新出现

### Pitfall 3: 域名过滤模式判断错误
**What goes wrong:** `.example.com` 前缀导致子域名匹配失败
**Why it happens:** 未处理 `.` 前缀的域名格式差异
**How to avoid:** 比较时统一去除 `.` 前缀，或同时匹配两种格式
**Warning signs:** 过滤后遗漏部分 Cookie

### Pitfall 4: 分页状态与过滤状态不同步
**What goes wrong:** 切换过滤模式后分页停留在第 2 页，但总页数已变化
**Why it happens:** 过滤后未重置分页到第 1 页
**How to avoid:** 每次过滤条件变化时重置 `currentPage = 1`
**Warning signs:** 切换过滤后列表为空或显示错误数据

## Code Examples

### 获取 Session Cookie（已有模式）

```javascript
// Source: cookie-manager.js:100
const ses = session.fromPartition(`persist:container-${containerId}`);
const cookies = await ses.cookies.get({});
```

### 获取 File Cookie（新增）

```javascript
// 读取 cookies.json 文件
function getFileCookies(containerId) {
  const filePath = getCookieFilePath(containerId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`[Realm] 读取 cookies.json 失败: ${containerId}`, e.message);
    return [];
  }
}
```

### 编辑 Cookie（新增）

```javascript
// 编辑单个 Cookie：更新 Session + 保存文件
async function editCookie(containerId, cookieData) {
  const partition = `persist:container-${containerId}`;
  const ses = session.fromPartition(partition);

  // 构建 URL（Electron set 需要 url 参数）
  const protocol = cookieData.secure ? 'https' : 'http';
  const domain = cookieData.domain.startsWith('.') ? cookieData.domain.slice(1) : cookieData.domain;
  const url = cookieData.url || `${protocol}://${domain}${cookieData.path || '/'}`;

  // 设置 Cookie（覆盖同名 Cookie）
  await ses.cookies.set({
    url,
    name: cookieData.name,
    value: cookieData.value,
    domain: cookieData.domain,
    path: cookieData.path || '/',
    expirationDate: cookieData.expirationDate,
    secure: cookieData.secure || false,
    httpOnly: cookieData.httpOnly || false,
    sameSite: cookieData.sameSite || 'unspecified',
  });

  // 同步保存到文件
  await saveCookies(containerId);

  return { success: true };
}
```

### 删除单个 Cookie（新增）

```javascript
// 删除单个 Cookie：从 Session 移除 + 保存文件
async function deleteSingleCookie(containerId, cookieData) {
  const partition = `persist:container-${containerId}`;
  const ses = session.fromPartition(partition);

  // 从 Session 中删除
  const url = cookieData.url || (() => {
    const protocol = cookieData.secure ? 'https' : 'http';
    const domain = cookieData.domain.startsWith('.') ? cookieData.domain.slice(1) : cookieData.domain;
    return `${protocol}://${domain}${cookieData.path || '/'}`;
  })();

  await ses.cookies.remove(url, cookieData.name);

  // 同步保存到文件（saveCookies 会自动排除已删除的 Cookie）
  await saveCookies(containerId);

  return { success: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 仅查看 Session Cookie | 支持 Session/File 双来源 | Phase 10 | 用户可查看持久化 Cookie |
| 无域名过滤 | 三种过滤模式 | Phase 10 | 快速定位目标 Cookie |
| 仅清除全部 | 支持单条编辑/删除 | Phase 10 | 精细管理 Cookie |
| 简单列表 | 分页显示 | Phase 10 | 大量 Cookie 时性能优化 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Electron `session.cookies.remove(url, name)` 按 name 精确删除单条 Cookie | Code Examples | 需要改为按 url+name 组合删除，但 API 签名已确认 |
| A2 | Cookie 数据量通常 <1000 条，客户端分页足够 | Architecture | 若数据量过大可能需要服务端分页 |
| A3 | `sameSite` 属性值为 'strict'/'lax'/'unspecified'/'no_restriction' | Code Examples | 需要验证 Electron 实际支持的值 |

## Open Questions (RESOLVED)

> 以下三问均属 10-01 范围，已由 10-01 交付代码实证解决（10-UAT.md 对应测试通过），与 10-02 范围零交集。保留原始记录并补 RESOLVED 标记。

1. **Electron `session.cookies.remove()` 的确切参数签名** — RESOLVED
   - What we know: 文档显示 `cookies.remove(url, name)` 返回 Promise
   - What's unclear: 是否需要额外参数（如 path）来精确定位 Cookie
   - Recommendation: 实现时先测试，若一个 URL 下同名不同 path 的 Cookie 需要额外处理
   - **Resolution (10-01):** `deleteSingleCookie()` 按 `cookies.remove(url, name)` 两参数签名实现并交付；10-UAT.md test 5（单条删除功能：确认后 Cookie 从列表移除，同时从 Session 和文件中删除）pass，实证无需额外参数。

2. **File 数据源的排序方式** — RESOLVED
   - What we know: cookies.json 是无序数组
   - What's unclear: 用户期望的默认排序
   - Recommendation: 按 domain 分组排序，同 domain 内按 name 排序（与 Session 来源一致）
   - **Resolution (10-01):** 实现采用来源原序（Session API 返回序 / cookies.json 文件数组序），未引入额外排序（applyDomainFilter 仅过滤不重排，代码库无 sort 调用）；10-UAT.md test 1（来源切换功能：Session/File 标签页各自正确显示）pass，用户对显示顺序无异议。排序属 CONTEXT.md 中 Claude's Discretion 项，后续如需可另行追加。

3. **编辑 Cookie 的 name 字段是否可编辑** — RESOLVED
   - What we know: D-14 列出 name 为可编辑字段
   - What's unclear: 修改 name 实际上是创建新 Cookie 并删除旧 Cookie
   - Recommendation: name 字段设为只读（灰色显示），避免技术复杂性
   - **Resolution (10-01):** Recommendation 被采纳——name 字段只读（10-01-SUMMARY.md 决策记录："Cookie name 只读：避免修改 name 需要删除旧 Cookie + 创建新 Cookie 的技术复杂性"）；10-UAT.md test 4（单条编辑功能：编辑模态框包含 name（只读）字段，保存后立即更新）pass。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | Cookie API | ✓ | 32.x | — |
| Node.js fs | 文件读写 | ✓ | 内置 | — |
| electron-store | 容器配置 | ✓ | 8.1.0+ | — |

**Missing dependencies with no fallback:** 无
**Missing dependencies with fallback:** 无

## Sources

### Primary (HIGH confidence)
- 项目代码库 - cookie-manager.js, container-manager.js, ipc-handlers.js, renderer.js
- 项目代码库 - index.html, main.css

### Secondary (MEDIUM confidence)
- Electron Session API 文档 - session.cookies.get/set/remove 方法签名

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 基于项目已有代码和 Electron 内置 API
- Architecture: HIGH - 复用已有的 IPC + contextBridge 模式
- Pitfalls: MEDIUM - 基于 Cookie 操作的通用经验

**Research date:** 2026-07-26
**Valid until:** 2026-08-25 (30 天，Electron 32.x 稳定)

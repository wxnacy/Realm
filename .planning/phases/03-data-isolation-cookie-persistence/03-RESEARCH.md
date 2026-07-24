# Phase 3: Data Isolation + Cookie Persistence - Research

**Researched:** 2026-07-24
**Domain:** Electron Session 隔离 + Cookie 持久化
**Confidence:** HIGH

## Summary

Phase 3 的核心目标是确保每个容器的数据完全隔离，并实现 Cookie 的自动持久化。经过研究发现，Electron 的 Session partition 机制（`persist:container-{id}`）已经自动提供了完整的数据隔离能力（ISO-01 到 ISO-04），无需额外实现代码。主要工作集中在 Cookie 持久化功能的完善上。

现有代码库中 `cookie-manager.js` 已经实现了基础的 Cookie 保存/加载/导出/导入功能，但存在以下需要改进的地方：
1. Cookie 保存格式缺少 `sameSite` 和 `hostOnly` 属性（D-05, D-06 决策要求）
2. 删除容器时未清理对应的 Cookie 文件（D-01, D-02 决策要求）
3. 未调用 `flushStore()` 确保数据写入磁盘
4. Cookie 加载时的 domain 处理需要优化

**Primary recommendation:** 完善现有 `cookie-manager.js` 模块，添加缺失的 Cookie 属性、集成容器删除清理逻辑，并在应用退出时确保数据持久化。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | ^32.0.0 | 桌面应用框架 | 项目已选定，提供 Session 和 Cookie API |
| electron-store | ^8.1.0 | 配置持久化 | 已集成，用于容器配置存储 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs (Node.js built-in) | - | 文件系统操作 | Cookie 文件读写 |
| path (Node.js built-in) | - | 路径处理 | Cookie 文件路径构建 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON 文件存储 | SQLite | 过度设计，JSON 已满足需求 |
| 手动 Cookie 管理 | Electron 原生持久化 | 原生持久化已由 persist: 前缀提供，手动管理用于备份/导出 |

**Installation:**
```bash
# 无需额外安装，所有依赖已存在
npm install  # 安装现有依赖
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Container Manager│  │ Cookie Manager  │              │
│  │ (Session 管理)   │  │ (Cookie 持久化) │              │
│  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                        │
│           ▼                    ▼                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Electron Session                    │   │
│  │  persist:container-default                       │   │
│  │  persist:container-work                          │   │
│  │  persist:container-personal                      │   │
│  └─────────────────────────────────────────────────┘   │
│           │                    │                        │
│           │                    ▼                        │
│           │           ┌─────────────────┐              │
│           │           │  Cookie Files   │              │
│           │           │  {userData}/    │              │
│           │           │  cookies/       │              │
│           │           │  ├─ default.json│              │
│           │           │  ├─ work.json   │              │
│           │           │  └─ ...         │              │
│           │           └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  UI Layer                        │   │
│  │  - Cookie 导出/导入按钮                           │   │
│  │  - 容器管理面板                                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
realm-browser/
├── main.js                    # 主进程入口，应用生命周期
├── container-manager.js       # 容器管理（Session partition）
├── cookie-manager.js          # Cookie 管理（保存/加载/导出/导入）
├── ipc-handlers.js            # IPC 处理器
├── src/
│   ├── preload.js             # Preload 脚本
│   ├── renderer.js            # 渲染进程逻辑
│   ├── index.html             # 主界面
│   └── styles/
│       └── main.css           # 样式文件
└── {userData}/
    └── cookies/               # Cookie 存储目录
        ├── default.json
        ├── work.json
        └── ...
```

### Pattern 1: Session Partition 隔离

**What:** 使用 Electron 的 `session.fromPartition()` 实现容器数据隔离
**When to use:** 每个需要独立数据的容器
**Example:**
```javascript
// Source: https://www.electronjs.org/docs/latest/api/session
const { session } = require('electron');

// 创建持久化 session（带 persist: 前缀）
const partition = `persist:container-${containerId}`;
const ses = session.fromPartition(partition);

// 每个 partition 自动隔离：
// - Cookies
// - Cache
// - LocalStorage
// - IndexedDB
// - HTTP cache
// - Network state
```

### Pattern 2: Cookie 保存与加载

**What:** 将 Cookie 序列化为 JSON 文件，支持应用重启后恢复
**When to use:** 应用关闭时保存，应用启动时加载
**Example:**
```javascript
// Source: https://www.electronjs.org/docs/latest/api/cookies

// 保存 Cookie
async function saveCookies(containerId) {
  const ses = session.fromPartition(`persist:container-${containerId}`);
  const cookies = await ses.cookies.get({});
  
  const formattedCookies = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expirationDate: cookie.expirationDate,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,  // D-05: 保留 SameSite 属性
    // hostOnly 是只读属性，无法通过 set() 设置
    // 但可以通过 domain 是否带前导点来推断
  }));
  
  const filePath = path.join(COOKIE_DIR, `${containerId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(formattedCookies, null, 2));
  
  // 确保数据写入磁盘
  await ses.cookies.flushStore();
}

// 加载 Cookie
async function loadCookies(containerId) {
  const filePath = path.join(COOKIE_DIR, `${containerId}.json`);
  if (!fs.existsSync(filePath)) return;
  
  const cookies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const ses = session.fromPartition(`persist:container-${containerId}`);
  
  for (const cookie of cookies) {
    // 构建 URL（需要去掉 domain 的前导点）
    const protocol = cookie.secure ? 'https' : 'http';
    const domain = cookie.domain.startsWith('.') 
      ? cookie.domain.slice(1) 
      : cookie.domain;
    const url = `${protocol}://${domain}${cookie.path || '/'}`;
    
    await ses.cookies.set({
      url,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expirationDate: cookie.expirationDate,
      secure: cookie.secure || false,
      httpOnly: cookie.httpOnly || false,
      sameSite: cookie.sameSite || 'lax',
    });
  }
}
```

### Pattern 3: 应用生命周期集成

**What:** 在应用启动和退出时自动加载/保存 Cookie
**When to use:** 应用启动时加载，应用退出前保存
**Example:**
```javascript
// Source: https://www.electronjs.org/docs/latest/api/app
const { app } = require('electron');
const cookieManager = require('./cookie-manager');

// 应用启动时加载 Cookie
app.whenReady().then(async () => {
  await cookieManager.loadAllCookies();
  // ... 其他初始化
});

// 应用退出前保存 Cookie
// 注意：before-quit 事件在所有窗口关闭前触发
app.on('before-quit', async (event) => {
  console.log('[Realm] 应用退出，保存 Cookie...');
  await cookieManager.saveAllCookies();
});
```

### Anti-Patterns to Avoid

- **不使用 persist: 前缀:** 如果不带 `persist:` 前缀，session 将是内存中的临时数据，应用退出后丢失
- **不调用 flushStore():** Cookie 写入不是立即持久化的，需要显式调用 `flushStore()` 确保数据写入磁盘
- **在 set() 中设置 hostOnly:** `hostOnly` 是只读属性，无法通过 `cookies.set()` 设置，它由 Electron 根据 domain 是否带前导点自动推断
- **忽略 sameSite 属性:** 默认值是 `lax`，但某些网站需要 `strict` 或 `none`，保存时应保留原始值

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 数据隔离 | 自定义隔离逻辑 | Electron Session partition | 原生支持，自动处理 Cookie/Cache/Storage |
| Cookie 存储格式 | 自定义二进制格式 | JSON 文件 | 可读性好，易于调试和导出 |
| 配置持久化 | 自定义文件读写 | electron-store | 已集成，提供类型安全和默认值 |
| 文件路径处理 | 手动拼接字符串 | path.join() | 跨平台兼容 |

**Key insight:** Electron 的 Session partition 机制已经提供了完整的数据隔离能力，我们只需要关注 Cookie 的持久化和恢复逻辑。

## Common Pitfalls

### Pitfall 1: Cookie domain 前导点处理

**What goes wrong:** 加载 Cookie 时，如果 domain 以 `.` 开头（如 `.google.com`），直接用于构建 URL 会导致错误
**Why it happens:** URL 格式不允许前导点，但 Cookie domain 需要前导点来表示子域名匹配
**How to avoid:** 构建 URL 时去掉前导点，但保留原始 domain 用于 `cookies.set()`
**Warning signs:** Cookie 加载失败，控制台报错 "Invalid URL"

```javascript
// 正确做法
const domain = cookie.domain.startsWith('.') 
  ? cookie.domain.slice(1) 
  : cookie.domain;
const url = `${protocol}://${domain}${cookie.path || '/'}`;

// 错误做法
const url = `${protocol}://${cookie.domain}${cookie.path || '/'}`;
// 如果 cookie.domain 是 ".google.com"，URL 会变成 "https://.google.com/"，无效
```

### Pitfall 2: 未调用 flushStore() 导致数据丢失

**What goes wrong:** 应用退出后 Cookie 未保存，下次启动时 Cookie 丢失
**Why it happens:** Electron 的 Cookie 写入是批量的（每 30 秒或 512 次操作），如果应用在批量写入前退出，数据会丢失
**How to avoid:** 在保存 Cookie 后调用 `ses.cookies.flushStore()` 确保数据写入磁盘
**Warning signs:** 用户反馈登录状态偶尔丢失

```javascript
// 正确做法
async function saveCookies(containerId) {
  // ... 保存逻辑
  await ses.cookies.flushStore();  // 确保写入磁盘
}

// 错误做法
async function saveCookies(containerId) {
  // ... 保存逻辑
  // 没有调用 flushStore()，数据可能未写入磁盘
}
```

### Pitfall 3: 删除容器时未清理 Cookie 文件

**What goes wrong:** 删除容器后，Cookie 文件残留在磁盘上
**Why it happens:** 只清理了 session 数据，未删除对应的 JSON 文件
**How to avoid:** 在 `deleteContainer()` 中同时删除 Cookie 文件
**Warning signs:** `userData/cookies/` 目录中出现孤立文件

```javascript
// 正确做法
function deleteContainer(id) {
  // ... 原有逻辑
  
  // 清理 session 数据
  container.session.clearStorageData();
  
  // 删除 Cookie 文件
  const cookieFile = path.join(COOKIE_DIR, `${id}.json`);
  if (fs.existsSync(cookieFile)) {
    fs.unlinkSync(cookieFile);
    console.log(`[Realm] 删除容器 Cookie 文件: ${id}`);
  }
  
  // ... 其他清理逻辑
}
```

### Pitfall 4: Cookie 属性不完整

**What goes wrong:** 保存的 Cookie 缺少 `sameSite` 属性，加载后 Cookie 行为异常
**Why it happens:** 保存时未包含 `sameSite` 属性，加载时使用默认值 `lax`
**How to avoid:** 保存时包含所有 Cookie 属性，加载时恢复原始值
**Warning signs:** 某些网站的 Cookie 无法正常工作

```javascript
// 正确做法 - 保存时包含 sameSite
const formattedCookies = cookies.map(cookie => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  expirationDate: cookie.expirationDate,
  secure: cookie.secure,
  httpOnly: cookie.httpOnly,
  sameSite: cookie.sameSite,  // 保留 SameSite 属性
}));

// 错误做法 - 缺少 sameSite
const formattedCookies = cookies.map(cookie => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  expirationDate: cookie.expirationDate,
  secure: cookie.secure,
  httpOnly: cookie.httpOnly,
  // 缺少 sameSite
}));
```

## Code Examples

Verified patterns from official sources:

### 保存 Cookie 到文件
```javascript
// Source: https://www.electronjs.org/docs/latest/api/cookies
const { session } = require('electron');
const fs = require('fs');
const path = require('path');

async function saveCookies(containerId, cookieDir) {
  const partition = `persist:container-${containerId}`;
  const ses = session.fromPartition(partition);
  
  // 获取所有 Cookie
  const cookies = await ses.cookies.get({});
  
  // 格式化 Cookie（包含所有必要属性）
  const formattedCookies = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expirationDate: cookie.expirationDate,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
  }));
  
  // 保存到文件
  const filePath = path.join(cookieDir, `${containerId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(formattedCookies, null, 2));
  
  // 确保数据写入磁盘
  await ses.cookies.flushStore();
  
  return { success: true, count: cookies.length };
}
```

### 从文件加载 Cookie
```javascript
// Source: https://www.electronjs.org/docs/latest/api/cookies
const { session } = require('electron');
const fs = require('fs');
const path = require('path');

async function loadCookies(containerId, cookieDir) {
  const filePath = path.join(cookieDir, `${containerId}.json`);
  
  // 如果文件不存在，返回
  if (!fs.existsSync(filePath)) {
    return { success: true, count: 0 };
  }
  
  // 读取文件
  const data = fs.readFileSync(filePath, 'utf8');
  const cookies = JSON.parse(data);
  
  // 获取容器的 session
  const partition = `persist:container-${containerId}`;
  const ses = session.fromPartition(partition);
  
  // 设置每个 Cookie
  let loaded = 0;
  for (const cookie of cookies) {
    try {
      // 构建 URL（去掉 domain 的前导点）
      const protocol = cookie.secure ? 'https' : 'http';
      const domain = cookie.domain.startsWith('.') 
        ? cookie.domain.slice(1) 
        : cookie.domain;
      const url = `${protocol}://${domain}${cookie.path || '/'}`;
      
      // 设置 Cookie
      await ses.cookies.set({
        url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expirationDate: cookie.expirationDate,
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'lax',
      });
      loaded++;
    } catch (err) {
      console.error(`[Realm] 设置 Cookie 失败: ${cookie.name}`, err.message);
    }
  }
  
  return { success: true, count: loaded };
}
```

### 应用生命周期集成
```javascript
// Source: https://www.electronjs.org/docs/latest/api/app
const { app } = require('electron');
const cookieManager = require('./cookie-manager');

// 应用启动时加载 Cookie
app.whenReady().then(async () => {
  console.log('[Realm] 应用启动');
  
  // 加载所有容器的 Cookie
  await cookieManager.loadAllCookies();
  
  // ... 其他初始化逻辑
});

// 应用退出前保存 Cookie
app.on('before-quit', async () => {
  console.log('[Realm] 应用退出，保存 Cookie...');
  await cookieManager.saveAllCookies();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 手动管理 Cookie 文件 | Electron Session partition 自动管理 | Electron 1.0+ | 数据隔离由原生支持，无需自定义代码 |
| 内存中临时 Cookie | persist: 前缀持久化 | Electron 1.0+ | Cookie 自动跨重启保存 |
| 手动序列化 Cookie | ses.cookies.get()/set() API | Electron 1.0+ | 标准化的 Cookie 操作接口 |
| 立即写入磁盘 | 批量写入 + flushStore() | Electron 较新版本 | 性能优化，但需要显式调用 flushStore() |

**Deprecated/outdated:**
- 无（当前实现符合最新 Electron API）

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Electron Session partition 自动处理 LocalStorage 和 IndexedDB 隔离 | Standard Stack | 如果不自动处理，需要额外实现隔离逻辑 |
| A2 | `hostOnly` 是只读属性，无法通过 `cookies.set()` 设置 | Code Examples | 如果可设置，需要在保存/加载时包含该属性 |
| A3 | `flushStore()` 确保所有 Cookie 写入磁盘 | Common Pitfalls | 如果不确保，可能仍有数据丢失风险 |

## Open Questions

1. **Cookie 文件大小限制**
   - What we know: 大量 Cookie 可能导致 JSON 文件较大
   - What's unclear: 是否需要分片或压缩
   - Recommendation: 当前阶段不需要，后续可根据实际情况优化

2. **并发写入安全**
   - What we know: 应用退出时只有一个写入操作
   - What's unclear: 如果多个进程同时写入同一文件
   - Recommendation: 当前单进程架构无需担心，后续多窗口场景需要考虑

3. **Cookie 过期清理**
   - What we know: 过期 Cookie 仍会被保存到文件
   - What's unclear: 是否需要在保存时过滤过期 Cookie
   - Recommendation: 当前不过滤，让 Electron 自然处理过期逻辑

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 核心框架 | ✓ | ^32.0.0 | — |
| electron-store | 配置持久化 | ✓ | ^8.1.0 | — |
| Node.js fs | 文件操作 | ✓ | 内置 | — |
| Node.js path | 路径处理 | ✓ | 内置 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Sources

### Primary (HIGH confidence)
- Electron Session API - https://www.electronjs.org/docs/latest/api/session
- Electron Cookies API - https://www.electronjs.org/docs/latest/api/cookies
- Electron App API - https://www.electronjs.org/docs/latest/api/app

### Secondary (MEDIUM confidence)
- 项目现有代码 - cookie-manager.js, container-manager.js, main.js

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - 基于官方 API 文档和现有代码
- Architecture: HIGH - Electron Session partition 机制成熟稳定
- Pitfalls: HIGH - 基于实际代码分析和 API 文档

**Research date:** 2026-07-24
**Valid until:** 2026-08-24 (30 天，Electron API 稳定)

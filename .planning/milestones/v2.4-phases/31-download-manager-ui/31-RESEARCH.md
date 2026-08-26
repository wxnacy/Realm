# Phase 31: 下载管理器 — 用户交互 - Research

**Researched:** 2026-08-12
**Domain:** Electron 下载面板 UI、内部页面、批量操作
**Confidence:** HIGH

## Summary

Phase 31 在 Phase 30 核心引擎基础上构建下载管理器的用户交互层。Phase 30 已实现完整的下载事件拦截、SQLite 持久化、进度追踪、暂停/恢复/取消控制函数，以及工具栏下载按钮（进度环+徽标+tooltip）。Phase 31 需要新增两个 UI 载体：(1) Chrome 风格下拉面板（点击下载按钮 toggle，显示最近 10 条记录）；(2) `realm://downloads` 独立页面（完整历史列表，支持搜索和分页）。

关键新增后端能力：全局下载列表查询（当前 `getDownloads` 仅支持按 container_id 查询，D-05 决策要求面板显示所有容器记录）、删除单条记录（含可选文件删除）、清空所有历史。这些需要在 `download-manager.js` 新增函数并注册对应 IPC 通道。

**主要建议：** 复用现有 media-panel 的 toggle 模式（点击切换 + 点击外部关闭 + ESC 关闭）和 realm:// 内部页面路由模式（HTML 文件 + HTTP API 端点），最小化新代码量。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 下载面板 toggle | Renderer Process | — | DOM 操作和用户交互在渲染进程 |
| 下载列表渲染 | Renderer Process | — | UI 渲染层 |
| 下载记录查询（全局） | Main Process (SQLite) | — | better-sqlite3 在主进程 |
| 删除记录/清空历史 | Main Process (SQLite) | — | 数据库写操作 |
| 文件删除 | Main Process (fs) | — | 文件系统操作需要主进程权限 |
| realm://downloads 页面 | Main Process (HTTP server) | Renderer (webview) | HTTP 路由在主进程，页面渲染在 webview |
| 实时进度更新 | Main Process → Renderer | — | IPC 事件广播已有模式 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron IPC | 43.3.0 | 面板与主进程通信 | 已有 downloadAPI，无需新依赖 |
| better-sqlite3 | 13.0.2 | 下载记录 CRUD | 已在 download-manager.js 使用 |
| Lucide SVG icons | inline | 文件类型图标、操作按钮图标 | 项目标准图标库（Phase 30 UI-SPEC） |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs (Node.js built-in) | — | 删除本地文件 | D-15 用户选择"同时删除文件"时 |
| path (Node.js built-in) | — | MIME 类型→图标映射 | 文件扩展名判断 |
| http (Node.js built-in) | — | realm://downloads API 端点 | 内部页面数据层 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 下拉面板 + 独立页面 | 仅下拉面板 | 仅下拉面板无法承载完整历史和搜索 |
| 复用 media-panel 模式 | 自定义浮层面板 | 自定义增加代码量，media-panel 模式已验证 |

## Package Legitimacy Audit

本 Phase 不引入新的外部包。所有依赖已在 Phase 30 验证通过。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| better-sqlite3 | npm | 8+ years | 500K+/week | github.com/WiseLibs/better-sqlite3 | OK | Approved (Phase 30) |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Main Process                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Download Manager                          │   │
│  │  - getAllDownloads(limit, offset)  ← NEW                    │   │
│  │  - deleteDownload(id, deleteFile) ← NEW                    │   │
│  │  - clearAllDownloads()            ← NEW                    │   │
│  │  - getDownloads(containerId)       (existing)               │   │
│  │  - pauseDownload / resumeDownload  (existing)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           │ IPC: download:list-all, download:delete, download:clear │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Realm HTTP Server                         │   │
│  │  /api/downloads/list    ← NEW (for realm://downloads page)  │   │
│  │  /api/downloads/delete  ← NEW                               │   │
│  │  /api/downloads/clear   ← NEW                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Renderer Process                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Download Panel (dropdown)                       │   │
│  │  - toggle 下拉面板（点击下载按钮切换）                       │   │
│  │  - 最近 10 条下载列表                                        │   │
│  │  - 暂停/恢复/删除操作                                        │   │
│  │  - 批量暂停/恢复                                             │   │
│  │  - 清空所有 / 查看全部 按钮                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              realm://downloads (webview)                     │   │
│  │  - 完整下载历史列表                                          │   │
│  │  - 搜索过滤                                                  │   │
│  │  - 分页加载（50 条/页）                                      │   │
│  │  - 同样的操作按钮                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
realm/
├── download-manager.js       # 新增: getAllDownloads, deleteDownload, clearAllDownloads
├── main.js                   # 新增: /api/downloads/* 路由, /downloads 路由映射
├── ipc-handlers.js           # 新增: download:list-all, download:delete, download:clear
├── src/
│   ├── index.html            # 新增: download-panel HTML + delete/clear modals
│   ├── downloads.html        # 新建: realm://downloads 独立页面
│   ├── downloads-page.js     # 新建: realm://downloads 页面逻辑
│   ├── renderer.js           # 新增: panel toggle, list rendering, event handlers
│   ├── preload.js            # 新增: downloadAPI 补充方法
│   └── styles/
│       └── main.css          # 新增: .download-panel-*, .download-item-*, .downloads-page-*
```

### Pattern 1: 下拉面板 Toggle（复用 media-panel 模式）

**What:** 点击下载按钮 toggle 下拉面板，点击外部关闭，ESC 关闭

**When to use:** 所有浮层 toggle 交互

**Example:**
```javascript
// src/renderer.js — 复用 media-panel 模式
// Source: src/renderer.js:5844 (toggleMediaPanel)

let downloadPanelOpen = false;

function toggleDownloadPanel() {
  downloadPanelOpen = !downloadPanelOpen;
  const panel = document.getElementById('downloadPanel');
  const btn = document.getElementById('downloadBtn');
  panel.classList.toggle('hidden', !downloadPanelOpen);
  btn.classList.toggle('active', downloadPanelOpen);

  // 打开时刷新列表
  if (downloadPanelOpen) {
    loadDownloadPanelList();
  }
}

// 点击外部关闭（与 media-panel 相同的 document mousedown 模式）
document.addEventListener('mousedown', (e) => {
  if (downloadPanelOpen) {
    const panel = document.getElementById('downloadPanel');
    const btn = document.getElementById('downloadBtn');
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      toggleDownloadPanel();
    }
  }
});
```

### Pattern 2: realm:// 内部页面路由（复用 history/favorites 模式）

**What:** 在 realm HTTP server 中注册 /downloads 路由，映射到 src/downloads.html

**When to use:** 新增 realm:// 内部页面

**Example:**
```javascript
// main.js — realmServer 路由注册
// Source: main.js:1463-1484 (existing route pattern)

// 1. API 路由（在 handleSettingsApi 之后）
if (reqPath.startsWith('/api/downloads/')) {
  handleDownloadsApi(req, res, reqUrl);
  return;
}

// 2. 页面路由（在 /settings 路由之后）
} else if (reqPath === '/downloads' || reqPath === '/downloads/') {
  filePath = path.join(__dirname, 'src', 'downloads.html');
} else if (reqPath.startsWith('/downloads/')) {
  const subPath = reqPath.replace('/downloads/', '');
  filePath = path.join(__dirname, 'src', subPath);
}
```

### Pattern 3: 下载记录全局查询

**What:** 新增 getAllDownloads 函数，不按 container_id 过滤

**When to use:** 下载面板和 realm://downloads 页面

**Example:**
```javascript
// download-manager.js
// Source: download-manager.js:508 (existing getDownloads pattern)

/**
 * 获取所有容器的下载记录（全局查询）
 * @param {number} limit - 每页数量（默认 50）
 * @param {number} offset - 偏移量（默认 0）
 * @returns {Array} 下载记录数组
 */
function getAllDownloads(limit = 50, offset = 0) {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT * FROM downloads
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  } catch (err) {
    console.error('[Realm] 查询所有下载记录失败:', err.message);
    return [];
  }
}
```

### Anti-Patterns to Avoid

- **在面板关闭时频繁刷新列表:** 面板关闭时 queue 更新，打开时批量刷新（避免无意义的 DOM 操作）
- **直接在 webview 内通过 IPC 访问下载数据:** realm://downloads 页面应走 HTTP /api/downloads/* 端点（与 history/favorites 一致），不要在 webview preload 中暴露 IPC
- **删除文件前不检查路径:** 必须验证 savePath 非空且文件存在再调用 fs.unlinkSync
- **忘记注册新的 IPC 通道:** download:list-all, download:delete, download:clear 都需要在 ipc-handlers.js 注册

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 文件类型图标映射 | 复杂的 MIME 解析库 | 简单的扩展名→icon 映射表 | 10 种常见类型覆盖 95% 场景 |
| 相对时间格式化 | moment.js / date-fns | 手写 formatRelativeTime 函数 | 仅需"刚刚/N分钟前/N小时前/昨天/日期"，50 行内完成 |
| 搜索过滤 | 全文搜索引擎 | SQLite LIKE 查询 | 下载记录量级小（千级），LIKE 足够 |
| 确认弹窗 | 自定义 modal 组件 | 原生 `<dialog>` 元素 | 项目已有 dialog 使用模式，自带焦点捕获和 ESC |

## Common Pitfalls

### Pitfall 1: download:list 仅支持 container_id 查询

**What goes wrong:** 面板需要显示所有容器的下载记录，但现有 `getDownloads(containerId)` 只查单容器

**Why it happens:** Phase 30 按容器隔离设计，未考虑全局视图需求

**How to avoid:** 新增 `getAllDownloads(limit, offset)` 函数和 `download:list-all` IPC 通道；面板和 realm://downloads 页面使用全局查询

**Warning signs:** 面板只显示当前容器的下载，切换容器后列表变化

### Pitfall 2: realm://downloads 页面无法访问 downloadAPI

**What goes wrong:** webview 内的 realm://downloads 页面调用 `window.downloadAPI` 失败

**Why it happens:** downloadAPI 通过 preload.js 的 contextBridge 暴露给主窗口渲染进程，但 webview guest 有独立的上下文

**How to avoid:** realm://downloads 页面走 HTTP `/api/downloads/*` 端点获取数据（与 history/favorites 页面一致），不依赖 downloadAPI

**Warning signs:** 页面加载后列表为空，控制台报 downloadAPI undefined

### Pitfall 3: 删除进行中的下载导致状态不一致

**What goes wrong:** 删除记录后 DownloadItem 仍在活跃下载映射中，继续触发进度事件

**Why it happens:** 只删了 SQLite 记录，没取消 DownloadItem

**How to avoid:** 删除进行中的下载时，先调用 `cancelDownload(downloadId)` 取消 DownloadItem，再删除 SQLite 记录

**Warning signs:** 删除后仍有进度条更新，或 download:completed 事件触发时报错

### Pitfall 4: 面板与 tooltip 冲突

**What goes wrong:** 点击下载按钮时 tooltip 仍显示，或面板打开时 hover 触发 tooltip

**Why it happens:** Phase 30 的 tooltip 逻辑（hover 显示）与 Phase 31 的 panel 逻辑（click toggle）共用同一按钮

**How to avoid:** 面板打开时禁用 tooltip 显示；点击事件中清除 tooltip 定时器（Phase 30 已有 `clearTimeout(downloadTooltipHoverTimer)` 逻辑）

**Warning signs:** 面板和 tooltip 同时显示，或面板关闭后 tooltip 残留

## Code Examples

### 面板列表渲染

```javascript
// src/renderer.js — 渲染下载面板列表
// Source: 参考 src/renderer.js:5888 (renderMediaList 模式)

/**
 * 渲染下载面板列表
 * @param {Array} downloads - 下载记录数组（最多 10 条）
 */
function renderDownloadPanelList(downloads) {
  const list = document.getElementById('downloadPanelList');
  const emptyState = document.getElementById('downloadEmptyState');

  if (downloads.length === 0) {
    list.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  list.innerHTML = downloads.map(dl => {
    const icon = getFileTypeIcon(dl.mime_type);
    const stateClass = `download-item-state-${dl.state}`;
    const actions = getItemActions(dl);

    return `
      <div class="download-item ${stateClass}" data-id="${dl.id}" data-state="${dl.state}">
        <div class="download-item-icon">${icon}</div>
        <div class="download-item-info">
          <div class="download-item-name">${escapeHtml(dl.filename)}</div>
          <div class="download-item-meta">
            <span class="download-item-size">${formatFileSize(dl.total_bytes)}</span>
            <span class="download-item-separator">·</span>
            <span class="download-item-time">${formatRelativeTime(dl.start_time)}</span>
          </div>
          ${dl.state === 'progressing' || dl.state === 'paused' ? `
            <div class="download-item-progress">
              <div class="download-item-progress-bar" style="width: ${getPercent(dl)}%"></div>
            </div>
          ` : ''}
        </div>
        <div class="download-item-actions">${actions}</div>
      </div>
    `;
  }).join('');
}
```

### MIME 类型→图标映射

```javascript
/**
 * 根据 MIME 类型返回 Lucide SVG 图标
 * @param {string} mimeType - MIME 类型
 * @returns {string} SVG 字符串
 */
function getFileTypeIcon(mimeType) {
  const iconMap = {
    'pdf': { icon: 'file-text', color: '#EF4444' },
    'image': { icon: 'image', color: '#10B981' },
    'video': { icon: 'video', color: '#8B5CF6' },
    'audio': { icon: 'music', color: '#F59E0B' },
    'zip': { icon: 'archive', color: '#6366F1' },
    'text': { icon: 'file-text', color: '#3B82F6' },
  };

  let match = { icon: 'file', color: 'var(--text-muted)' };
  if (!mimeType) return `<svg class="download-item-svg" style="color:${match.color}" ...>...</svg>`;

  for (const [key, val] of Object.entries(iconMap)) {
    if (mimeType.includes(key)) { match = val; break; }
  }
  return `<svg class="download-item-svg" style="color:${match.color}" ...>...</svg>`;
}
```

### 删除下载记录（含可选文件删除）

```javascript
// download-manager.js
const fs = require('fs');

/**
 * 删除单条下载记录
 * @param {string} downloadId - 下载 ID
 * @param {boolean} deleteFile - 是否同时删除本地文件
 * @returns {{success: boolean, error?: string}}
 */
function deleteDownload(downloadId, deleteFile = false) {
  if (!db) return { success: false, error: '数据库未初始化' };

  try {
    // 先查询记录获取文件路径
    const record = db.prepare('SELECT * FROM downloads WHERE id = ?').get(downloadId);
    if (!record) return { success: false, error: '记录不存在' };

    // 如果是进行中的下载，先取消
    if (activeDownloads.has(downloadId)) {
      cancelDownload(downloadId);
    }

    // 删除文件（如果用户选择）
    if (deleteFile && record.save_path && fs.existsSync(record.save_path)) {
      try {
        fs.unlinkSync(record.save_path);
      } catch (err) {
        console.error('[Realm] 删除文件失败:', err.message);
        // 文件删除失败不阻止记录删除
      }
    }

    // 删除 SQLite 记录
    db.prepare('DELETE FROM downloads WHERE id = ?').run(downloadId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shell.openItem | shell.openPath | Electron 9+ | 返回 Promise<string>，空字符串表示成功 |

**Deprecated/outdated:**
- 无（本 Phase 无新废弃 API）

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | download-panel 定位复用 media-panel 的 CSS 定位模式 | Architecture | 低，media-panel 已验证 |
| A2 | realm://downloads 页面走 HTTP API 而非 IPC | Architecture | 中，需确认 webview preload 配置 |
| A3 | 下载记录量级在千级以内，SQLite LIKE 搜索足够 | Don't Hand-Roll | 低，浏览器下载场景 |

## Open Questions (RESOLVED)

1. **realm://downloads 页面的 webview preload** — RESOLVED
   - What we know: realm:// 页面在 webview 中加载，通过 HTTP API 获取数据
   - What's unclear: downloads 页面是否需要特殊的 preload 脚本来调用下载操作（暂停/恢复/删除）
   - Resolution: Plan 02 确认 downloads 页面通过 HTTP POST 到 /api/downloads/* 端点操作，不需要特殊 preload 脚本（参考 Plan 02 action 中 downloads-page.js 的 HTTP API 调用模式）

2. **批量删除的性能** — RESOLVED
   - What we know: D-18 支持多选批量删除
   - What's unclear: 批量删除时是否需要逐个弹确认框
   - Resolution: Plan 02 确认选中多条后统一弹一个确认框（"确定要删除选中的 N 条记录吗？"），不需要逐个弹框（参考 Plan 02 action 第 205 行）

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | download API, dialog | ✓ | 43.3.0 | — |
| better-sqlite3 | 下载记录 CRUD | ✓ | 13.0.2 | — |
| Lucide SVG | 图标 | ✓ | inline | — |
| Node.js fs | 文件删除 | ✓ | built-in | — |
| Node.js http | realm server 路由 | ✓ | built-in | — |

**Missing dependencies with no fallback:** 无

**Missing dependencies with fallback:** 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前没有测试框架） |
| Config file | none |
| Quick run command | — |
| Full suite command | — |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DL-02 | 下载历史列表面板 | manual | — | ❌ Wave 0 |
| DL-03 | 暂停正在进行的下载 | manual | — | ❌ Wave 0 |
| DL-04 | 恢复已暂停的下载 | manual | — | ❌ Wave 0 |
| DL-06 | 在 Finder 中显示文件 | manual | — | ❌ Wave 0 |
| DL-07 | 删除单条下载记录 | manual | — | ❌ Wave 0 |
| DL-08 | 清空所有下载历史 | manual | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动测试
- **Per wave merge:** 手动测试
- **Phase gate:** 手动验证所有需求

### Wave 0 Gaps
- [ ] 无自动化测试（项目未配置测试框架）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | 下载记录删除操作权限 |
| V5 Input Validation | yes | 文件路径验证（删除文件前）|
| V6 Cryptography | no | — |

### Known Threat Patterns for Download Manager UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 路径遍历删除 | Tampering | 验证 save_path 在允许的下载目录内 |
| 批量删除攻击 | Denial of Service | 二次确认弹窗，限制批量大小 |

## Sources

### Primary (HIGH confidence)
- 项目源码 `download-manager.js` — Phase 30 已实现的核心模块
- 项目源码 `src/renderer.js` — media-panel toggle 模式（L5844-5855）
- 项目源码 `main.js` — realm server 路由注册模式（L1461-1485）
- 项目源码 `ipc-handlers.js` — 下载 IPC 通道注册（L854-943）
- Phase 30 UI-SPEC.md — 设计系统、颜色、间距、组件模式
- Phase 31 UI-SPEC.md — 下载面板/页面/列表项完整设计规范

### Secondary (MEDIUM confidence)
- Phase 30 RESEARCH.md — Electron DownloadItem API 用法
- Phase 31 CONTEXT.md — 用户决策文档

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 所有依赖已在项目中使用，无需新包
- Architecture: HIGH — 复用现有 media-panel 和 realm:// 页面模式，模式清晰
- Pitfalls: HIGH — 从现有代码模式和 Phase 30 经验总结

**Research date:** 2026-08-12
**Valid until:** 2026-09-12（依赖稳定，30 天有效）

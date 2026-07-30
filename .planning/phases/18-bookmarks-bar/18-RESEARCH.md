# Phase 18: 收藏栏功能 - Research

**Researched:** 2026-07-30
**Domain:** Browser UI / Bookmarks Bar
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**溢出处理策略**
- D-01: 使用 >> 按钮弹出下拉菜单处理溢出（Chrome 风格），>> 按钮固定在收藏栏最右侧
- D-02: 溢出菜单采用单层菜单 + 级联子菜单模式，文件夹悬停向右展开子菜单
- D-03: 收藏栏空白区域右键菜单包含「隐藏收藏栏」选项

**文件夹展开交互**
- D-04: 点击文件夹弹出下拉菜单，嵌套文件夹子菜单从右侧弹出（Chrome 风格）
- D-05: 鼠标悬停在文件夹上约 300ms 后自动展开子菜单
- D-06: 下拉菜单宽度自适应内容，最大宽度限制 300px

**视觉样式与间距**
- D-07: 收藏栏位于地址栏下方、标签栏上方，与 Chrome 布局一致
- D-08: 收藏栏高度与地址栏等高（约 32px），保持视觉统一
- D-09: favicon 加载失败时使用 Realm 应用图标作为降级显示
- D-10: 收藏栏与地址栏之间有 1px 分隔线，与标签栏风格统一

**右键菜单集成**
- D-11: 复用 Phase 13/15 的 Electron Menu API 模式，保持代码一致性
- D-12: 收藏项右键菜单包含：在新标签页打开、编辑、删除（标准三项）
- D-13: 文件夹右键菜单包含：在新标签页中打开所有书签、重命名、删除、添加书签、添加文件夹（标准五项）
- D-14: 菜单项直接调用现有 API（如 favoritesManager.updateFavorite），不引入新的 IPC 通道

### Claude's Discretion
- 收藏栏的 CSS 样式细节（padding、margin、hover 效果）
- >> 按钮的图标样式和点击动画
- 下拉菜单的显示/隐藏动画
- 收藏项标题过长时的截断方式（省略号）

### Deferred Ideas (OUT OF SCOPE)
- AI Agent 集成（Phase 19-21）
- 收藏栏多行显示
- 收藏栏拖拽排序
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BAR-01 | 收藏栏固定显示在地址栏下方，显示根目录收藏项和文件夹 | 标准 Stack + CSS 布局方案 |
| BAR-02 | 收藏栏项目交互（点击导航、Cmd+Click 新标签页、文件夹下拉菜单） | Chrome 交互模式研究 |
| BAR-03 | 收藏栏右键菜单（收藏项/文件夹/空白区域三种菜单） | Electron Menu API 复用方案 |
| BAR-04 | 收藏栏显示/隐藏设置（设置页面开关 + 右键快捷隐藏） | electron-store 持久化方案 |
</phase_requirements>

## Summary

Phase 18 需要在 Realm Browser 中实现 Chrome 风格的收藏栏功能。收藏栏固定在地址栏下方，显示收藏夹根目录的收藏项和文件夹，支持点击导航、文件夹下拉菜单、溢出处理（>> 按钮）、右键菜单和显示/隐藏设置。

**关键发现：**

1. **数据层已就绪**：`favoritesManager` 提供了完整的 CRUD API，包括 `listRecords({ folderId: 0 })` 获取根目录收藏、`getFolderTree()` 获取文件夹树、`listFolders(parentId)` 获取子文件夹。无需新增数据库操作。

2. **渲染逻辑可复用**：`favorites-page.js` 中的 `renderFavoriteItem(record)` 函数可适配收藏栏样式，但需要简化（收藏栏版本不需要 checkbox、时间戳等）。

3. **右键菜单模式已建立**：Phase 15 的 `context-menu-manager.js` 使用 Electron Menu API，收藏栏右键菜单可直接复用此模式。

4. **CSS 布局清晰**：当前页面结构为 `sidebar > main-content > [tab-bar, toolbar, browser-view]`，收藏栏应插入到 `toolbar` 和 `browser-view` 之间。

**Primary recommendation：** 完全复用现有 favoritesManager API 和 context-menu 模式，收藏栏作为渲染进程的新组件实现，通过 IPC 调用现有 API，无需新增后端逻辑。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 收藏栏数据获取 | Main Process (favoritesManager) | — | 数据库操作在主进程，通过 IPC 暴露 |
| 收藏栏 UI 渲染 | Renderer Process | — | DOM 操作在渲染进程 |
| 右键菜单 | Main Process (Electron Menu) | Renderer Process (触发) | Electron Menu API 在主进程 |
| 溢出计算 | Renderer Process | — | DOM 测量在渲染进程 |
| 显示/隐藏设置 | Main Process (electron-store) | Renderer Process (UI) | 配置持久化在主进程 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 32.x | 桌面应用框架 | 项目已选定，不可更改 |
| Electron Menu API | 内置 | 右键菜单 | Phase 15 已使用，保持一致性 |
| electron-store | 8.x | 配置持久化 | 项目已使用，存储收藏栏显示设置 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| favoritesManager | 本地模块 | 收藏数据 CRUD | 数据获取、文件夹树 |
| context-menu-manager | 本地模块 | 右键菜单构建 | 收藏项/文件夹/空白区域菜单 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Electron Menu API | 自定义 DOM 右键菜单 | DOM 菜单更灵活但不符合原生体验 |
| IPC 调用 | HTTP API（如 favorites-page） | IPC 更安全，HTTP 仅用于 webview guest |

**Installation:**
```bash
# 无需新增依赖，全部使用现有模块
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │favoritesManager │  │contextMenuMgr   │                  │
│  │  - listRecords  │  │  - buildMenu    │                  │
│  │  - getFolderTree│  │  - popup        │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              IPC Handlers                           │   │
│  │  - favorites:list  - favorites:folder-tree          │   │
│  │  - bookmarks-bar:toggle  - bookmarks-bar:context    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BookmarksBar Component                 │   │
│  │  - render() - 渲染根目录收藏项和文件夹              │   │
│  │  - handleOverflow() - 计算溢出并显示 >> 按钮        │   │
│  │  - showFolderMenu() - 文件夹下拉菜单                │   │
│  │  - handleContextMenu() - 右键菜单触发               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Dropdown Menu Layer                     │   │
│  │  - 文件夹下拉菜单（绝对定位）                       │   │
│  │  - 溢出菜单（>> 按钮触发）                          │   │
│  │  - 子菜单（级联向右展开）                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── bookmarks-bar.js        # 收藏栏主组件（渲染、交互、溢出计算）
├── bookmarks-bar-menu.js   # 收藏栏下拉菜单逻辑（文件夹展开、子菜单）
├── styles/
│   ├── main.css            # 现有样式
│   └── bookmarks-bar.css   # 收藏栏专用样式
├── index.html              # 添加收藏栏 HTML 结构
├── renderer.js             # 集成收藏栏初始化
└── preload.js              # 新增收藏栏相关 IPC API
```

### Pattern 1: 收藏栏数据加载

**What:** 通过 IPC 调用 favoritesManager 获取根目录收藏和文件夹
**When to use:** 收藏栏初始化和刷新时
**Example:**
```javascript
// src/renderer.js - 收藏栏初始化
async function initBookmarksBar() {
  // 获取根目录收藏项（folderId=0）
  const favorites = await window.realmAPI.favorites.list({ folderId: 0 });
  // 获取文件夹树（根目录）
  const folderTree = await window.realmAPI.favorites.getFolderTree();
  // 渲染收藏栏
  renderBookmarksBar(favorites, folderTree);
}
```

### Pattern 2: 溢出检测与 >> 按钮

**What:** 使用 ResizeObserver 和 DOM 测量计算哪些项溢出
**When to use:** 窗口大小变化或收藏栏内容变化时
**Example:**
```javascript
// src/bookmarks-bar.js
function calculateOverflow() {
  const container = document.getElementById('bookmarksBar');
  const items = container.querySelectorAll('.bookmark-item, .folder-item');
  const containerWidth = container.clientWidth;
  const overflowBtn = document.getElementById('bookmarksOverflowBtn');
  
  // 预留 >> 按钮宽度
  const overflowBtnWidth = 32;
  let usedWidth = 0;
  let overflowItems = [];
  
  for (const item of items) {
    usedWidth += item.offsetWidth;
    if (usedWidth > containerWidth - overflowBtnWidth) {
      item.style.display = 'none'; // 隐藏溢出项
      overflowItems.push(item);
    } else {
      item.style.display = ''; // 显示可见项
    }
  }
  
  // 显示/隐藏 >> 按钮
  overflowBtn.style.display = overflowItems.length > 0 ? '' : 'none';
  overflowBtn.dataset.overflowCount = overflowItems.length;
}
```

### Pattern 3: 文件夹下拉菜单

**What:** 点击文件夹弹出下拉菜单，悬停 300ms 自动展开子菜单
**When to use:** 用户与文件夹交互时
**Example:**
```javascript
// src/bookmarks-bar-menu.js
function showFolderMenu(folderEl, folderId, isSubmenu = false) {
  const menu = document.createElement('div');
  menu.className = 'bookmarks-dropdown-menu';
  
  // 获取文件夹内容
  const items = await window.realmAPI.favorites.list({ folderId });
  const subfolders = await window.realmAPI.favorites.listFolders(folderId);
  
  // 渲染菜单项
  for (const item of items) {
    const itemEl = createMenuItem(item);
    menu.appendChild(itemEl);
  }
  
  // 渲染子文件夹（悬停时展开子菜单）
  for (const folder of subfolders) {
    const folderEl = createFolderMenuItem(folder);
    folderEl.addEventListener('mouseenter', () => {
      clearTimeout(folderEl._submenuTimer);
      folderEl._submenuTimer = setTimeout(() => {
        showSubmenu(folderEl, folder.id);
      }, 300); // D-05: 300ms 延迟
    });
    folderEl.addEventListener('mouseleave', () => {
      clearTimeout(folderEl._submenuTimer);
    });
    menu.appendChild(folderEl);
  }
  
  // 定位菜单
  const rect = folderEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom}px`;
  menu.style.maxWidth = '300px'; // D-06
  
  document.body.appendChild(menu);
}
```

### Anti-Patterns to Avoid

- **不要在渲染进程直接操作数据库**：所有数据操作必须通过 IPC 调用主进程的 favoritesManager
- **不要使用 HTTP API**：收藏栏在主窗口渲染进程中，应使用 IPC 而非 HTTP（HTTP 仅用于 webview guest）
- **不要硬编码菜单位置**：下拉菜单必须动态计算位置，确保不超出视口
- **不要忘记清理定时器**：悬停展开子菜单的 300ms 定时器必须在 mouseleave 时清除

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 右键菜单 | 自定义 DOM 菜单 | Electron Menu API | 原生体验，已有 context-menu-manager |
| 收藏数据 CRUD | 直接 SQL 查询 | favoritesManager | 已有完整 API，避免重复代码 |
| 文件夹树结构 | 手动递归构建 | getFolderTree() | 已有递归查询，返回完整树 |
| 配置持久化 | localStorage | electron-store | 项目标准，跨窗口共享 |

## Common Pitfalls

### Pitfall 1: 溢出计算时机

**What goes wrong:** 在 DOM 未完全渲染时计算溢出，导致测量不准确
**Why it happens:** 收藏项的宽度依赖内容和字体渲染，需要布局完成后才能测量
**How to avoid:** 使用 `requestAnimationFrame` 或 `setTimeout(0)` 确保在下一帧计算
**Warning signs:** >> 按钮显示/隐藏闪烁，或溢出项计算错误

### Pitfall 2: 下拉菜单层级

**What goes wrong:** 下拉菜单被其他元素遮挡
**Why it happens:** z-index 设置不当或父元素有 `overflow: hidden`
**How to avoid:** 下拉菜单使用 `position: fixed` 并挂载到 `document.body`，z-index 设为 1000+
**Warning signs:** 菜单部分显示不出来或被截断

### Pitfall 3: 子菜单悬停冲突

**What goes wrong:** 鼠标从父菜单移到子菜单时，子菜单消失
**Why it happens:** mouseleave 事件触发时，鼠标已在子菜单区域但尚未进入子菜单元素
**How to use:** 添加延迟关闭机制（如 150ms），或使用 `mouseenter` 到子菜单时取消关闭
**Warning signs:** 子菜单闪烁或无法点击

### Pitfall 4: favicon 加载失败

**What goes wrong:** 收藏项显示空白或破损图标
**Why it happens:** 网站 favicon 不存在或加载超时
**How to avoid:** 使用 `onerror` 事件降级到 Realm 应用图标（D-09）
**Warning signs:** 收藏栏出现空白图标

## Code Examples

### 收藏栏 HTML 结构

```html
<!-- src/index.html - 在 toolbar 和 browser-view 之间插入 -->
<div class="bookmarks-bar" id="bookmarksBar">
  <div class="bookmarks-bar-content" id="bookmarksBarContent">
    <!-- 收藏项和文件夹将由 JavaScript 动态生成 -->
  </div>
  <button class="bookmarks-overflow-btn" id="bookmarksOverflowBtn" title="更多书签">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18l6-6-6-6"></path>
    </svg>
  </button>
</div>
```

### 收藏栏 CSS 样式

```css
/* src/styles/bookmarks-bar.css */

.bookmarks-bar {
  height: 32px; /* D-08: 与地址栏等高 */
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color); /* D-10: 分隔线 */
  display: flex;
  align-items: center;
  padding: 0 8px;
  overflow: hidden;
}

.bookmarks-bar-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
}

.bookmark-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  font-size: 12px;
  color: var(--text-primary);
  transition: background-color 0.15s;
}

.bookmark-item:hover {
  background-color: var(--bg-hover);
}

.bookmark-item .favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.bookmark-item .favicon-fallback {
  width: 16px;
  height: 16px;
  background-color: var(--accent-color);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  font-weight: 600;
}

.bookmark-item .title {
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-primary);
  transition: background-color 0.15s;
}

.folder-item:hover {
  background-color: var(--bg-hover);
}

.folder-item .folder-icon {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}

.bookmarks-overflow-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background-color 0.15s;
}

.bookmarks-overflow-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* 下拉菜单样式 */
.bookmarks-dropdown-menu {
  position: fixed;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
  min-width: 200px;
  max-width: 300px; /* D-06 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  overflow-y: auto;
  max-height: 400px;
}

.bookmarks-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background-color 0.1s;
}

.bookmarks-dropdown-item:hover {
  background-color: var(--bg-hover);
}

.bookmarks-dropdown-separator {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 0;
}
```

### preload.js 新增 API

```javascript
// src/preload.js - 新增收藏栏相关 API
contextBridge.exposeInMainWorld('realmAPI', {
  // ... 现有 API ...
  
  // 收藏栏 API
  bookmarksBar: {
    // 获取根目录收藏项
    listFavorites: (folderId = 0) => ipcRenderer.invoke('favorites:list', { folderId }),
    // 获取文件夹树
    getFolderTree: () => ipcRenderer.invoke('favorites:folder-tree'),
    // 获取子文件夹列表
    listFolders: (parentId = 0) => ipcRenderer.invoke('favorites:list-folders', { parentId }),
    // 切换收藏栏显示/隐藏
    toggle: (visible) => ipcRenderer.invoke('bookmarks-bar:toggle', { visible }),
    // 获取收藏栏显示状态
    getVisibility: () => ipcRenderer.invoke('bookmarks-bar:get-visibility'),
  },
});
```

### IPC Handler 注册

```javascript
// main.js 或 ipc-handlers.js - 新增 IPC 通道
const { ipcMain } = require('electron');
const favoritesManager = require('./favorites-manager');

// 收藏栏显示/隐藏状态（持久化到 electron-store）
ipcMain.handle('bookmarks-bar:toggle', async (event, { visible }) => {
  configStore.set('bookmarksBar.visible', visible);
  return { success: true };
});

ipcMain.handle('bookmarks-bar:get-visibility', async () => {
  return { visible: configStore.get('bookmarksBar.visible', true) };
});

// 注意：favorites:list、favorites:folder-tree 等已存在，无需新增
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DOM 右键菜单 | Electron Menu API | Phase 15 | 原生体验，收藏栏复用 |
| 整数排序 | Fractional indexing | Phase 16 | 收藏栏顺序与收藏夹一致 |
| HTTP API 数据访问 | IPC 调用 | 项目初期 | 主窗口渲染进程用 IPC |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | favoritesManager 的 listRecords({ folderId: 0 }) 返回根目录收藏 | Standard Stack | 需要验证 API 参数 |
| A2 | context-menu-manager.js 可直接用于收藏栏右键菜单 | Architecture Patterns | 可能需要适配 |
| A3 | Electron Menu API 的 popup() 方法在渲染进程中可通过 IPC 调用 | Code Examples | 可能需要调整架构 |

## Open Questions

1. **收藏栏数据刷新时机**
   - What we know: 收藏数据可能在其他窗口或收藏夹页面被修改
   - What's unclear: 是否需要实时同步
   - Recommendation: 监听 IPC 事件或定期刷新（如窗口获得焦点时）

2. **>> 溢出菜单的交互细节**
   - What we know: 点击 >> 弹出下拉菜单，显示溢出的收藏项
   - What's unclear: 溢出菜单是否也支持文件夹展开
   - Recommendation: 支持，与收藏栏本身的交互一致

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 整个应用 | ✓ | 32.x | — |
| electron-store | 配置持久化 | ✓ | 8.x | — |
| favoritesManager | 数据层 | ✓ | 本地模块 | — |
| context-menu-manager | 右键菜单 | ✓ | 本地模块 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前无测试框架） |
| Config file | 无 |
| Quick run command | `npm test`（未配置） |
| Full suite command | `npm test`（未配置） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BAR-01 | 收藏栏固定显示 | manual | — | — |
| BAR-02 | 收藏栏项目交互 | manual | — | — |
| BAR-03 | 收藏栏右键菜单 | manual | — | — |
| BAR-04 | 收藏栏显示/隐藏设置 | manual | — | — |

### Sampling Rate

- **Per task commit:** 手动验证
- **Per wave merge:** 手动验证
- **Phase gate:** UAT 全部通过

### Wave 0 Gaps

- [ ] 测试框架未配置（项目当前无测试）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | URL 输入验证（已有） |
| V6 Cryptography | no | — |

### Known Threat Patterns for Browser UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via bookmark title | Tampering | escapeHtml() 转义（已有） |
| Context menu injection | Elevation | Electron Menu API 原生安全 |

## Sources

### Primary (HIGH confidence)
- 项目代码库 - favorites-manager.js, favorites-page.js, context-menu-manager.js
- 18-CONTEXT.md - 用户决策文档
- REQUIREMENTS.md - BAR-01 到 BAR-04 需求

### Secondary (MEDIUM confidence)
- Chrome 浏览器收藏栏交互模式（基于训练数据）
- Electron 官方文档（Menu API, IPC）

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - 全部使用现有模块，无新增依赖
- Architecture: HIGH - 项目已有清晰的 IPC 和渲染进程模式
- Pitfalls: MEDIUM - 溢出计算和下拉菜单交互需要仔细实现

**Research date:** 2026-07-30
**Valid until:** 2026-08-30（项目稳定期）

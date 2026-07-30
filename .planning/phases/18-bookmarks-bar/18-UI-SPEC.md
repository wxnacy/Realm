---
phase: 18
slug: bookmarks-bar
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-30
---

# Phase 18 — UI Design Contract

> 收藏栏功能的视觉与交互契约。由 gsd-ui-researcher 生成，由 gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（纯 CSS + CSS 变量） |
| Preset | not applicable |
| Component library | none |
| Icon library | 内联 SVG（与现有 toolbar 一致） |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

---

## Spacing Scale

已声明值（必须为 4 的倍数）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | favicon 与标题间距、图标内边距 |
| sm | 8px | 收藏项内边距、下拉菜单项内边距 |
| md | 16px | 收藏栏左右内边距、下拉菜单内边距 |
| lg | 24px | 下拉菜单与屏幕边缘安全距离 |
| xl | 32px | 收藏栏高度（与 CONTEXT D-08 一致） |

例外：收藏项 hover 圆角为 6px（与现有 .btn-icon 圆角一致，非 4 倍数但保持设计统一）。

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| 收藏项标题 | 13px | 400 (regular) | 1.3 |
| 下拉菜单项标题 | 13px | 400 (regular) | 1.3 |
| 溢出按钮 >> | 14px | 600 (semibold) | 1 |

说明：收藏栏字体略小于工具栏（工具栏 14px），以在 32px 高度内保持合适的视觉比例。下拉菜单使用相同字体规格。

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-primary: #1a1a1a` | 收藏栏背景 |
| Secondary (30%) | `--bg-secondary: #2a2a2a` | 下拉菜单背景 |
| Tertiary | `--bg-tertiary: #3a3a3a` | 下拉菜单子项背景 |
| Hover | `--bg-hover: #404040` | 收藏项 hover 背景、下拉菜单项 hover 背景 |
| Text primary | `--text-primary: #f0f0f0` | 收藏项标题文字 |
| Text secondary | `--text-secondary: #a0a0a0` | 空状态文字、溢出按钮文字 |
| Border | `--border-color: #404040` | 收藏栏顶部分隔线、下拉菜单边框 |
| Accent (10%) | `--accent-color: #3B82F6` | 文件夹图标高亮色（仅此一处） |
| Destructive | `--danger-color: #EF4444` | 右键菜单「删除」选项文字 |

**Accent 仅用于**：文件夹图标 hover 时的高亮色。

---

## 收藏栏布局

### DOM 结构（在 `src/index.html` 中插入）

```
<main class="main-content">
  <div class="tab-bar" id="tabBar">...</div>
  <div class="toolbar" id="toolbar">...</div>

  <!-- 新增：收藏栏，位于 toolbar 下方、webview 上方 -->
  <div class="bookmarks-bar" id="bookmarksBar">
    <div class="bookmarks-bar-list" id="bookmarksBarList">
      <!-- JS 动态渲染收藏项 -->
    </div>
    <button class="bookmarks-overflow-btn" id="bookmarksOverflowBtn" title="更多书签">
      <span>>></span>
    </button>
  </div>

  <!-- webview 容器 -->
  <div class="webview-container" id="webviewContainer">...</div>
</main>
```

### 收藏栏 CSS 变量（新增）

```css
:root {
  --bookmarks-bar-height: 32px;
  --bookmarks-item-height: 24px;
  --bookmarks-dropdown-max-width: 300px;
  --bookmarks-dropdown-item-height: 28px;
}
```

### 收藏栏整体样式

```css
.bookmarks-bar {
  height: var(--bookmarks-bar-height);
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 2px;
  overflow: hidden;           /* 溢出隐藏，由 JS 计算显示哪些项 */
  flex-shrink: 0;
}
```

**关键约束**：
- 收藏栏背景色与主内容区一致（`--bg-primary`），不使用 `--bg-secondary`（那是侧边栏和工具栏）
- 顶部分隔线 1px `--border-color`，与工具栏底部分隔线保持视觉一致
- `overflow: hidden` 确保超出项不可见，由 JS 控制哪些项显示在 bar 上 vs 溢出菜单

---

## 收藏栏项目

### 收藏项（Bookmark Item）

```css
.bookmark-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  height: var(--bookmarks-item-height);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  max-width: 160px;           /* 标题过长时截断 */
  transition: background-color 0.15s ease;
}

.bookmark-item:hover {
  background-color: var(--bg-hover);
}

.bookmark-item .bookmark-favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  object-fit: contain;
}

.bookmark-item .bookmark-title {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**favicon 降级**（D-09）：加载失败时使用 Realm 应用图标（`src/icon.png`），通过 JS `onerror` 事件切换。

### 文件夹项（Folder Item）

```css
.bookmark-folder {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  height: var(--bookmarks-item-height);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  max-width: 160px;
  transition: background-color 0.15s ease;
  position: relative;          /* 为下拉菜单定位锚点 */
}

.bookmark-folder:hover {
  background-color: var(--bg-hover);
}

.bookmark-folder .folder-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.bookmark-folder:hover .folder-icon {
  color: var(--accent-color);  /* hover 时文件夹图标高亮 */
}

.bookmark-folder .folder-title {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-folder .folder-arrow {
  width: 10px;
  height: 10px;
  margin-left: 2px;
  color: var(--text-muted);
  flex-shrink: 0;
}
```

---

## 溢出按钮（>>）

```css
.bookmarks-overflow-btn {
  display: none;                /* JS 控制：有溢出项时才显示 */
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  height: var(--bookmarks-item-height);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: auto;           /* 始终贴右 */
  transition: background-color 0.15s ease;
}

.bookmarks-overflow-btn:hover {
  background-color: var(--bg-hover);
}

.bookmarks-overflow-btn span {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.bookmarks-overflow-btn.visible {
  display: flex;
}
```

**交互**：点击弹出溢出下拉菜单，内容为未显示在 bar 上的收藏项列表。

---

## 下拉菜单（Dropdown）

### 通用下拉菜单样式

```css
.bookmarks-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  max-width: var(--bookmarks-dropdown-max-width);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 400px;

  /* 动画：从上往下滑入 */
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.bookmarks-dropdown.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
```

### 下拉菜单项

```css
.bookmarks-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  height: var(--bookmarks-dropdown-item-height);
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.bookmarks-dropdown-item:hover {
  background-color: var(--bg-hover);
}

.bookmarks-dropdown-item .item-favicon,
.bookmarks-dropdown-item .item-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  object-fit: contain;
}

.bookmarks-dropdown-item .item-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.bookmarks-dropdown-item .item-arrow {
  width: 10px;
  height: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}
```

### 级联子菜单（D-02/D-04）

```css
.bookmarks-submenu {
  position: absolute;
  top: -4px;                    /* 与父菜单项对齐 */
  left: 100%;
  min-width: 180px;
  max-width: var(--bookmarks-dropdown-max-width);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.4);
  overflow-y: auto;
  max-height: 400px;

  /* 动画 */
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.bookmarks-submenu.visible {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
```

**子菜单展开逻辑**（D-05）：鼠标悬停在文件夹项上 300ms 后自动展开子菜单，使用 `setTimeout` + `clearTimeout` 实现。移出文件夹项时清除定时器并关闭子菜单。

---

## 右键菜单

复用 Electron `Menu` API（D-11），与 Phase 13/15 保持一致。

### 菜单定义

**收藏项右键菜单**（D-12）：
| 菜单项 | 行为 |
|--------|------|
| 在新标签页打开 | 调用 `window.open(url, '_blank')` |
| 编辑 | 打开收藏编辑 dialog |
| 删除 | 调用 `favoritesManager.deleteFavorite(id)` |

**文件夹右键菜单**（D-13）：
| 菜单项 | 行为 |
|--------|------|
| 在新标签页中打开所有书签 | 批量打开该文件夹下所有 URL |
| 重命名 | 打开文件夹重命名 dialog |
| 删除 | 调用 `favoritesManager.deleteFolder(id)` |
| 添加书签 | 打开收藏编辑 dialog，预填 folder_id |
| 添加文件夹 | 打开新建文件夹 dialog |

**空白区域右键菜单**（D-03）：
| 菜单项 | 行为 |
|--------|------|
| 添加书签 | 打开收藏编辑 dialog |
| 添加文件夹 | 打开新建文件夹 dialog |
| 隐藏收藏栏 | 调用 `configStore.set('showBookmarksBar', false)` |

---

## 空状态

| Element | Copy |
|---------|------|
| 收藏栏空状态 | 无额外提示 — 收藏栏为空时仅显示「添加书签」按钮（右键菜单可用） |

说明：收藏栏不设计专门的空状态文案，保持与 Chrome 一致的极简风格。用户可通过右键菜单或地址栏星标按钮添加收藏。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| 主要 CTA | 添加书签 |
| 空状态标题 | （无 — 收藏栏为空时不显示额外文案） |
| 空状态正文 | （无） |
| 错误状态 | 加载失败 — favicon 降级为 Realm 图标 |
| 删除确认 | 删除书签：确定要删除「{title}」吗？ |

---

## 设置页面集成（BAR-04）

### 开关项

在设置页面的「常规设置」区域添加：

```html
<div class="setting-item">
  <div class="setting-info">
    <span class="setting-label">显示收藏栏</span>
    <span class="setting-description">在地址栏下方显示收藏栏</span>
  </div>
  <label class="toggle-switch">
    <input type="checkbox" id="showBookmarksBar" checked>
    <span class="toggle-slider"></span>
  </label>
</div>
```

**默认值**：开启（`checked`）
**持久化**：`configStore.set('showBookmarksBar', true/false)`
**即时生效**：切换后立即显示/隐藏收藏栏，无需重启

---

## 交互细节

### 收藏栏显示/隐藏

- 显示时：收藏栏占据 `var(--bookmarks-bar-height)` 高度，webview 容器高度相应减少
- 隐藏时：收藏栏 `display: none`，webview 容器高度恢复
- 切换动画：无动画（与 Chrome 一致，即时切换）

### 溢出计算逻辑

```
可用宽度 = 收藏栏宽度 - 溢出按钮宽度（约 32px）- 收藏栏内边距
遍历收藏项，累加宽度，直到超出可用宽度
溢出项放入溢出菜单
```

窗口 `resize` 事件时重新计算。

### 标题截断

- 收藏项最大宽度 160px
- 使用 `text-overflow: ellipsis` 截断
- hover 时显示 `title` 属性的完整标题（浏览器原生 tooltip）

### 下拉菜单关闭逻辑

- 点击菜单外部区域关闭
- 点击其他菜单项时关闭当前菜单
- ESC 键关闭所有菜单
- 收藏栏失焦时关闭所有菜单

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | not applicable | not applicable |
| 无第三方依赖 | — | — |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

*Phase: 18 — 收藏栏功能*
*UI-SPEC generated: 2026-07-30*

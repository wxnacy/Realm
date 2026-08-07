---
phase: 27
slug: media-panel
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-07
---

# Phase 27 — 媒体面板 UI Design Contract

> 媒体面板的视觉和交互契约。由 gsd-ui-researcher 生成，由 gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（Electron 原生 + 手写 CSS） |
| Preset | not applicable |
| Component library | none |
| Icon library | 手绘 SVG inline |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**说明：** 项目为 Electron 桌面应用，使用原生 HTML/CSS/JS，无前端框架。所有组件为手写 CSS，复用 `src/styles/main.css` 中的 CSS 变量系统。

---

## Spacing Scale

Declared values（与现有 main.css 一致）:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 图标间距、紧凑型内边距 |
| sm | 8px | 列表项内部间距、按钮间距 |
| md | 16px | 面板内边距、列表项间距 |
| lg | 24px | 面板头部/底部区域 |
| xl | 32px | 布局间距 |

**Exceptions:**
- 面板宽度固定 360px（非 4 的倍数，与 D-04 一致）
- 面板最大高度 500px（非 4 的倍数，与 D-04 一致）

---

## Typography

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 14px | 400 | 1.5 | 媒体项文件名、URL 预览 |
| Label | 12px | 400 | 1.4 | 类型徽标文字、空状态说明 |
| Heading | 16px | 600 | 1.3 | 面板标题"媒体资源" |

---

## Color

### 基础色板（复用现有 CSS 变量）

| Token | Value | Usage |
|-------|-------|-------|
| --bg-primary | #1a1a1a | 面板背景 |
| --bg-secondary | #2a2a2a | 面板头部背景 |
| --bg-tertiary | #3a3a3a | 列表项悬停背景 |
| --bg-hover | #404040 | 按钮悬停背景 |
| --text-primary | #f0f0f0 | 主文字（文件名、标题） |
| --text-secondary | #a0a0a0 | 次文字（URL 预览） |
| --text-muted | #6b7280 | 空状态文字 |
| --border-color | #404040 | 面板边框、列表分隔线 |
| --accent-color | #3B82F6 | 播放按钮悬停、激活态 |
| --danger-color | #EF4444 | 数量徽标背景 |
| --success-color | #10B981 | 复制成功反馈 |

### 类型徽标颜色编码（新增 CSS 变量）

| Type | Variable | Hex | Usage |
|------|----------|-----|-------|
| m3u8 | --media-type-m3u8 | #3B82F6 | HLS 流媒体徽标背景 |
| mp4 | --media-type-mp4 | #10B981 | MP4 视频徽标背景 |
| flv | --media-type-flv | #F59E0B | FLV 视频徽标背景 |
| webm | --media-type-webm | #8B5CF6 | WebM 视频徽标背景 |

**Color 60/30/10 Split:**
- Dominant (60%): `--bg-primary` (#1a1a1a) — 面板主体背景、页面底层
- Secondary (30%): `--bg-secondary` (#2a2a2a) — 面板头部、卡片容器
- Accent (10%): `--accent-color` (#3B82F6) — 仅用于播放按钮悬停态和 m3u8 徽标

**Accent reserved for:** 播放按钮 hover/active 态、m3u8 类型徽标。不用于其他交互元素。

---

## Component Inventory

### 新增组件

| Component | File | Description |
|-----------|------|-------------|
| `.media-panel-btn` | main.css | 工具栏媒体按钮（含数量徽标） |
| `.media-badge` | main.css | 数量提示徽标（红底白字） |
| `.media-panel` | main.css | 浮动面板容器（z-index 层叠） |
| `.media-panel-header` | main.css | 面板头部（标题 + 关闭按钮） |
| `.media-list` | main.css | 媒体列表容器（滚动区域） |
| `.media-item` | main.css | 单条媒体项（徽标 + 文件名 + URL + 操作按钮） |
| `.media-type-badge` | main.css | 类型徽标（颜色编码） |
| `.media-empty-state` | main.css | 空状态占位 |

### 复用现有

| Component | File | Usage |
|-----------|------|-------|
| `.btn-icon` | main.css | 工具栏按钮基础样式 |
| `.toolbar-right` | main.css | 按钮放置区域 |
| `.hidden` | main.css | 面板显示/隐藏切换 |

---

## Interaction Contract

### 面板开关（参考 toggleAIPanel 模式）

```
state.mediaPanelOpen: boolean

toggleMediaPanel():
  1. state.mediaPanelOpen = !state.mediaPanelOpen
  2. elements.mediaPanel.classList.toggle('hidden', !state.mediaPanelOpen)
  3. elements.mediaPanelBtn.classList.toggle('active', state.mediaPanelOpen)
  4. 如果打开：调用 loadMediaList() 加载当前容器媒体列表
```

### 面板定位

```
position: fixed
top: 工具栏高度（约 38px） + 4px 间距
right: 8px（与工具栏右侧对齐）
width: 360px
max-height: 500px（超出后 .media-list 纵向滚动）
z-index: 9998（低于 modal/ai-panel-dropdown，高于 toast）
```

**理由：** z-index 9998 低于 toast (9999) 和 modal (dialog 原生)，但高于普通 UI 元素。面板为浮动弹出，不占用文档流。

### 点击外部关闭

```
document.addEventListener('click', (e) => {
  if (state.mediaPanelOpen &&
      !elements.mediaPanel.contains(e.target) &&
      !elements.mediaPanelBtn.contains(e.target)) {
    toggleMediaPanel();
  }
});
```

### 媒体列表实时更新

```
window.mediaAPI.onMediaListUpdate((event, data) => {
  if (state.mediaPanelOpen) {
    appendMediaItem(data.item);  // 追加到列表底部
  }
  updateMediaBadge(data.totalCount);  // 更新数量徽标
});
```

### 播放按钮交互

```
点击 → 调用 window.mediaAPI.play(url)
     → 主进程在当前容器新标签页打开 URL
```

### 复制按钮交互

```
点击 → 调用 window.mediaAPI.copyUrl(url)
     → 按钮图标变为 ✓（--success-color）
     → 1.5 秒后恢复为复制图标
     → 使用 setTimeout 实现，新点击重置定时器
```

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| 面板标题 | 媒体资源 |
| Primary CTA | 播放（tooltip: "在新标签页播放"） |
| Copy CTA | 复制链接（tooltip: "复制视频 URL"） |
| Empty state heading | 当前页面未检测到媒体资源 |
| Empty state body | 浏览包含视频的网页时，媒体资源将自动出现在这里 |
| 工具栏按钮 tooltip | 媒体面板 |

**说明：** 本阶段无 destructive action，无需确认对话框。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| N/A | N/A | not applicable（项目未使用 shadcn 或外部组件库） |

---

## CSS 变量新增清单

以下 CSS 变量需在 `src/styles/main.css` 的 `:root` 中新增：

```css
/* 媒体面板 - 类型颜色编码 */
--media-type-m3u8: #3B82F6;
--media-type-mp4: #10B981;
--media-type-flv: #F59E0B;
--media-type-webm: #8B5CF6;
```

---

## HTML 结构清单

### 工具栏按钮（在 `#aiPanelBtn` 之前插入）

```html
<button class="btn-icon media-panel-btn" id="mediaPanelBtn" title="媒体面板">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
  <span class="media-badge hidden" id="mediaBadge">0</span>
</button>
```

### 浮动面板（在 `</body>` 之前，`#aiPanel` 之后）

```html
<div class="media-panel hidden" id="mediaPanel">
  <div class="media-panel-header">
    <span class="media-panel-title">媒体资源</span>
    <button class="btn-icon media-panel-close-btn" id="mediaPanelCloseBtn" title="关闭">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
  <div class="media-list" id="mediaList">
    <!-- JS 动态渲染媒体项 -->
  </div>
  <div class="media-empty-state" id="mediaEmptyState">
    <div class="media-empty-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    </div>
    <div class="media-empty-title">当前页面未检测到媒体资源</div>
    <div class="media-empty-desc">浏览包含视频的网页时，媒体资源将自动出现在这里</div>
  </div>
</div>
```

### 单条媒体项模板（JS 动态生成）

```html
<div class="media-item" data-url="{url}">
  <span class="media-type-badge media-type-{type}">{type}</span>
  <div class="media-item-info">
    <div class="media-item-name">{filename}</div>
    <div class="media-item-url">{domain}/{filename}</div>
  </div>
  <div class="media-item-actions">
    <button class="btn-icon media-play-btn" title="在新标签页播放">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    </button>
    <button class="btn-icon media-copy-btn" title="复制视频 URL">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  </div>
</div>
```

---

## elements 对象新增引用

```javascript
// src/renderer.js elements 对象新增
mediaPanelBtn: document.getElementById('mediaPanelBtn'),
mediaBadge: document.getElementById('mediaBadge'),
mediaPanel: document.getElementById('mediaPanel'),
mediaPanelCloseBtn: document.getElementById('mediaPanelCloseBtn'),
mediaList: document.getElementById('mediaList'),
mediaEmptyState: document.getElementById('mediaEmptyState'),
```

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

*Phase: 27-媒体面板*
*UI-SPEC generated: 2026-08-07*

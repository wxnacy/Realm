# Phase 27: 媒体面板 - 执行计划

**Created:** 2026-08-07
**Status:** Ready for execution
**Requirements:** PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-05

---

## 目标

用户可以通过工具栏按钮打开媒体面板，查看当前容器检测到的所有媒体资源，并执行播放和复制操作。

---

## 任务分解

### Wave 1: HTML 结构 + 基础样式

#### Task 1.1: 工具栏媒体按钮 (PANEL-01, PANEL-05)

**文件:** `src/index.html`

在工具栏右侧、AI 面板按钮之前添加媒体按钮：

```html
<!-- 媒体面板按钮 -->
<button id="media-btn" class="toolbar-btn" title="媒体资源">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2l10 6-10 6V2z"/>
  </svg>
  <span id="media-badge" class="media-badge hidden">0</span>
</button>
```

**验证点:** 按钮显示在工具栏，图标正常

---

#### Task 1.2: 媒体面板 HTML 结构 (PANEL-01, PANEL-02)

**文件:** `src/index.html`

在 `</body>` 之前添加媒体面板：

```html
<!-- 媒体面板 -->
<div id="media-panel" class="media-panel hidden">
  <div class="media-panel-header">
    <span class="media-panel-title">媒体资源</span>
    <button id="media-panel-close" class="media-panel-close">×</button>
  </div>
  <div id="media-list" class="media-list">
    <div class="media-empty">当前页面未检测到媒体资源</div>
  </div>
</div>
```

**验证点:** 面板 HTML 存在，初始隐藏

---

#### Task 1.3: 媒体面板样式 (PANEL-01, PANEL-02)

**文件:** `src/styles/main.css`

```css
/* ==================== 媒体面板 ==================== */

/* 按钮需要相对定位以支持徽标 */
.toolbar-btn {
  position: relative;
}

.media-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #e74c3c;
  color: white;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.media-panel {
  position: fixed;
  top: 48px;
  right: 16px;
  width: 360px;
  max-height: 500px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.media-panel.hidden {
  display: none;
}

.media-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.media-panel-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.media-panel-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.media-panel-close:hover {
  color: var(--text-primary);
}

.media-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.media-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.media-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 10px;
  transition: background 0.15s;
}

.media-item:hover {
  background: var(--bg-secondary);
}

.media-type-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  color: white;
}

.media-type-m3u8 { background: #3498db; }
.media-type-mp4 { background: #27ae60; }
.media-type-flv { background: #e67e22; }
.media-type-webm { background: #9b59b6; }

.media-info {
  flex: 1;
  min-width: 0;
}

.media-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-url {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.media-action-btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.media-action-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.media-action-btn.copied {
  background: var(--accent-green);
  border-color: var(--accent-green);
  color: white;
}
```

**验证点:** 面板样式正确，颜色编码生效

---

### Wave 2: 核心逻辑

#### Task 2.1: 元素引用和状态管理

**文件:** `src/renderer.js`

在 `elements` 对象中添加：

```javascript
// 媒体面板元素
mediaBtn: document.getElementById('media-btn'),
mediaBadge: document.getElementById('media-badge'),
mediaPanel: document.getElementById('media-panel'),
mediaList: document.getElementById('media-list'),
mediaPanelClose: document.getElementById('media-panel-close'),
```

在 `state` 对象中添加：

```javascript
// 媒体面板状态
mediaPanelOpen: false,
mediaItems: [],
```

**验证点:** 元素引用正确，状态初始化成功

---

#### Task 2.2: 媒体面板开关函数 (PANEL-01)

**文件:** `src/renderer.js`

```javascript
/**
 * 切换媒体面板显示状态
 */
function toggleMediaPanel() {
  console.log('[Realm Renderer] 切换媒体面板');
  
  state.mediaPanelOpen = !state.mediaPanelOpen;
  elements.mediaPanel.classList.toggle('hidden', !state.mediaPanelOpen);
  elements.mediaBtn.classList.toggle('active', state.mediaPanelOpen);
  
  // 打开时刷新列表
  if (state.mediaPanelOpen) {
    loadMediaList();
  }
}
```

**验证点:** 点击按钮面板打开/关闭，按钮 active 样式切换

---

#### Task 2.3: 加载媒体列表 (PANEL-02)

**文件:** `src/renderer.js`

**数据结构:** `getMediaList()` 返回 `Array<{url, type, source, timestamp}>`

```javascript
/**
 * 加载当前容器的媒体列表
 */
async function loadMediaList() {
  try {
    const mediaList = await window.mediaAPI.getMediaList();
    state.mediaItems = mediaList || [];
    renderMediaList();
    updateMediaBadge();
  } catch (error) {
    console.error('[Realm Renderer] 加载媒体列表失败:', error);
  }
}

/**
 * 渲染媒体列表
 */
function renderMediaList() {
  if (state.mediaItems.length === 0) {
    elements.mediaList.innerHTML = '<div class="media-empty">当前页面未检测到媒体资源</div>';
    return;
  }
  
  elements.mediaList.innerHTML = state.mediaItems.map((item, index) => {
    const type = item.type || 'unknown';
    const name = item.name || item.url.split('/').pop();
    const urlPreview = formatMediaUrl(item.url);
    
    return `
      <div class="media-item" data-index="${index}">
        <span class="media-type-badge media-type-${type}">${type}</span>
        <div class="media-info">
          <div class="media-name" title="${escapeHtml(item.url)}">${escapeHtml(name)}</div>
          <div class="media-url">${escapeHtml(urlPreview)}</div>
        </div>
        <div class="media-actions">
          <button class="media-action-btn media-play-btn" data-index="${index}" title="播放">▶</button>
          <button class="media-action-btn media-copy-btn" data-index="${index}" title="复制链接">📋</button>
        </div>
      </div>
    `;
  }).join('');
}
```

**验证点:** 列表正确渲染，空状态显示提示

---

#### Task 2.4: 格式化 URL 和转义 HTML

**文件:** `src/renderer.js`

```javascript
/**
 * 格式化媒体 URL 为 "域名+文件名" 格式
 * @param {string} url - 完整 URL
 * @returns {string} 格式化后的 URL
 */
function formatMediaUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1] || 'video';
    return `${urlObj.hostname}/${fileName}`;
  } catch {
    return url.substring(0, 50) + '...';
  }
}

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**验证点:** URL 格式化正确，HTML 转义生效

---

### Wave 3: 播放和复制操作

#### Task 3.1: 播放按钮逻辑 (PANEL-03)

**文件:** `src/renderer.js`

```javascript
/**
 * 播放媒体（新标签页打开）
 * @param {number} index - 媒体项索引
 */
function playMedia(index) {
  const item = state.mediaItems[index];
  if (!item) return;
  
  console.log('[Realm Renderer] 播放媒体:', item.url);
  window.open(item.url, '_blank');
}
```

**验证点:** 点击播放按钮在新标签页打开 URL

---

#### Task 3.2: 复制按钮逻辑 (PANEL-04)

**文件:** `src/renderer.js`

```javascript
/**
 * 复制媒体 URL 到剪贴板
 * @param {number} index - 媒体项索引
 * @param {HTMLElement} btn - 复制按钮元素
 */
async function copyMediaUrl(index, btn) {
  const item = state.mediaItems[index];
  if (!item) return;
  
  try {
    await navigator.clipboard.writeText(item.url);
    
    // 视觉反馈
    btn.textContent = '✓';
    btn.classList.add('copied');
    
    setTimeout(() => {
      btn.textContent = '📋';
      btn.classList.remove('copied');
    }, 1500);
    
    console.log('[Realm Renderer] 已复制 URL:', item.url);
  } catch (error) {
    console.error('[Realm Renderer] 复制失败:', error);
  }
}
```

**验证点:** 复制成功后按钮变勾，1.5 秒恢复

---

#### Task 3.3: 事件监听绑定

**文件:** `src/renderer.js` - `setupEventListeners()`

```javascript
// 媒体面板开关
elements.mediaBtn.addEventListener('click', toggleMediaPanel);
elements.mediaPanelClose.addEventListener('click', toggleMediaPanel);

// 点击面板外部关闭
document.addEventListener('click', (e) => {
  if (state.mediaPanelOpen && 
      !elements.mediaPanel.contains(e.target) && 
      !elements.mediaBtn.contains(e.target)) {
    toggleMediaPanel();
  }
});

// 媒体列表点击事件（事件委托）
elements.mediaList.addEventListener('click', (e) => {
  const playBtn = e.target.closest('.media-play-btn');
  const copyBtn = e.target.closest('.media-copy-btn');
  
  if (playBtn) {
    playMedia(parseInt(playBtn.dataset.index));
  } else if (copyBtn) {
    copyMediaUrl(parseInt(copyBtn.dataset.index), copyBtn);
  }
});
```

**验证点:** 所有点击事件正确响应

---

### Wave 4: 实时更新与徽标

#### Task 4.1: 媒体列表更新监听 (PANEL-05)

**文件:** `src/renderer.js` - `initMediaPanel()`

**重要:** `onMediaListUpdate` 回调参数为 `(event, { containerId, items })`，返回清理函数

```javascript
/**
 * 初始化媒体面板
 */
let cleanupMediaListener = null;

function initMediaPanel() {
  // 监听媒体列表更新
  cleanupMediaListener = window.mediaAPI.onMediaListUpdate((event, data) => {
    console.log('[Realm Renderer] 媒体列表更新:', data.items.length);
    state.mediaItems = data.items;
    renderMediaList();
    updateMediaBadge();
  });
  
  // 初始加载
  loadMediaList();
}

// 面板关闭时清理监听器
function cleanupMediaPanel() {
  if (cleanupMediaListener) {
    cleanupMediaListener();
    cleanupMediaListener = null;
  }
}
```

**验证点:** 新检测到媒体时列表自动更新

---

#### Task 4.2: 数量徽标更新

**文件:** `src/renderer.js`

```javascript
/**
 * 更新媒体数量徽标
 */
function updateMediaBadge() {
  const count = state.mediaItems.length;
  
  if (count > 0) {
    elements.mediaBadge.textContent = count > 99 ? '99+' : count;
    elements.mediaBadge.classList.remove('hidden');
  } else {
    elements.mediaBadge.classList.add('hidden');
  }
}
```

**验证点:** 徽标显示正确数量，0 时隐藏

---

#### Task 4.3: 容器切换时重置

**文件:** `src/renderer.js` - `switchContainer()`

在容器切换逻辑中添加：

```javascript
// 重置媒体面板状态
state.mediaPanelOpen = false;
state.mediaItems = [];
elements.mediaPanel.classList.add('hidden');
elements.mediaMediaBtn.classList.remove('active');
updateMediaBadge();

// 重新加载新容器的媒体列表
loadMediaList();
```

**验证点:** 切换容器后面板重置

---

## 验证清单

### 功能验证

- [ ] **PANEL-01:** 工具栏按钮打开/关闭媒体面板
- [ ] **PANEL-01:** 面板覆盖在页面上方（z-index）
- [ ] **PANEL-01:** 点击面板外部自动关闭
- [ ] **PANEL-02:** 媒体列表正确显示
- [ ] **PANEL-02:** 类型徽标颜色编码正确
- [ ] **PANEL-02:** 空状态显示提示文字
- [ ] **PANEL-03:** 播放按钮在新标签页打开 URL
- [ ] **PANEL-04:** 复制按钮复制 URL 到剪贴板
- [ ] **PANEL-04:** 复制后按钮变勾 1.5 秒
- [ ] **PANEL-05:** 新检测到媒体时徽标更新

### 集成验证

- [ ] 与 Phase 26 媒体检测联动
- [ ] 容器切换时面板重置并重新加载
- [ ] 使用 CSS 变量保持主题一致
- [ ] onMediaListUpdate 监听器正确清理
- [ ] 多个媒体格式（m3u8/mp4/flv/webm）类型徽标颜色正确
- [ ] 面板打开时实时更新生效

---

## 依赖关系

```
Task 1.1 → Task 2.1 → Task 2.2 → Task 2.3
                                   ↓
                              Task 3.1
                              Task 3.2
                                   ↓
                              Task 4.1 → Task 4.2
```

---

## 预计工作量

- Wave 1: 30 分钟
- Wave 2: 45 分钟
- Wave 3: 30 分钟
- Wave 4: 15 分钟

**总计:** 约 2 小时

---

*Phase 27 - 媒体面板执行计划*
*Created: 2026-08-07*

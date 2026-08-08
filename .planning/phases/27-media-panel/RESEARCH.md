# Phase 27: 媒体面板 - 代码调研报告

**调研时间:** 2026-08-07
**状态:** 完成

---

## 1. 现有 AI 面板的实现模式

### 1.1 状态管理（renderer.js:162-167）

```js
// AI 助手状态
aiPanelOpen: false,
aiMessages: [],
aiStreaming: false,
```

**可复用模式:** `mediaPanelOpen: false` 放入 `state` 对象

### 1.2 toggleAIPanel 函数（renderer.js:3867-3886）

```js
function toggleAIPanel() {
  state.aiPanelOpen = !state.aiPanelOpen;
  elements.aiPanel.classList.toggle('hidden', !state.aiPanelOpen);
  elements.aiPanelBtn.classList.toggle('active', state.aiPanelOpen);
}
```

**关键流程:** state 布尔值 → classList.toggle('hidden') → 按钮 active 样式

### 1.3 事件绑定（renderer.js:3752-3758）

```js
elements.aiPanelBtn.addEventListener('click', toggleAIPanel);
elements.aiPanelCloseBtn.addEventListener('click', toggleAIPanel);
```

---

## 2. 工具栏按钮模式

### 2.1 按钮 HTML（index.html:235-242）

```html
<button class="btn-icon" id="aiPanelBtn" title="AI 助手">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    ...
  </svg>
</button>
```

**规则:** `class="btn-icon"` + SVG 18x18 + title tooltip

### 2.2 btn-icon CSS（main.css:115-128）

```css
.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}
```

### 2.3 激活态（main.css:4760-4763）

```css
#aiPanelBtn.active {
  color: var(--accent-color);
  background-color: var(--bg-hover);
}
```

**需新增:** `#mediaPanelBtn.active` 规则

### 2.4 徽标（Badge）

**现状:** 项目中没有工具栏按钮级别的计数徽标

**需要新增:**
```css
.btn-icon {
  position: relative; /* 为徽标准备 */
}

.btn-icon-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  background: var(--danger-color);
  color: #fff;
  font-size: 10px;
  border-radius: 8px;
}
```

---

## 3. 浮动面板实现方式

### 3.1 AI 面板（右侧侧边栏）

- 位置: 右侧固定占位
- 隐藏: `width: 0; opacity: 0;` + `.hidden` class
- 动画: CSS transition 250ms

### 3.2 context-picker-panel（浮动面板）

```css
.context-picker-panel {
  position: absolute;
  bottom: 100%;
  max-height: 300px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}
```

**建议:** 媒体面板采用浮动 overlay 模式，避免与 AI 面板布局冲突

---

## 4. mediaAPI 接口（preload.js:992-1046）

| 方法 | 说明 |
|---|---|
| `getMediaList(containerId?)` | 获取容器媒体列表 |
| `playMedia(url)` | 创建播放器窗口 |
| `copyMediaUrl(url)` | 复制 URL 到剪贴板 |
| `clearMediaList(containerId?)` | 清空列表 |
| `onMediaListUpdate(callback)` | 监听更新 |

**数据结构:** `{ url, type, source, timestamp }`

**重要:** `onMediaListUpdate` 回调参数为 `{ containerId, items }`

---

## 5. CSS 变量系统

```css
:root {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --text-primary: #f0f0f0;
  --text-secondary: #a0a0a0;
  --border-color: #404040;
  --accent-color: #3B82F6;
  --danger-color: #EF4444;
}
```

---

## 6. 事件委托模式

```js
// 标准写法
element.addEventListener('click', (e) => {
  const item = e.target.closest('.item-class');
  if (item) { /* 处理 */ }
});
```

---

## 7. 集成要点

### 需修改文件

| 文件 | 改动 |
|---|---|
| `src/index.html` | 工具栏按钮 + 面板 DOM |
| `src/renderer.js` | state + elements + 函数 + 事件 |
| `src/styles/main.css` | 面板样式 |
| `src/preload.js` | **无需修改** |

### 潜在问题

1. **布局冲突:** 媒体面板应采用浮动 overlay，不占右侧空间
2. **徽标实现:** 需给 `.btn-icon` 加 `position: relative`
3. **内存泄漏:** `onMediaListUpdate` 返回清理函数，面板关闭时需调用
4. **容器切换:** 需监听容器切换事件，重新加载媒体列表

---

*调研完成于 2026-08-07*

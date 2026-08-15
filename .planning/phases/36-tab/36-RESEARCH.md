# Phase 36: Tab 拖拽与跨窗口移动 - Research

**Researched:** 2026-08-15
**Domain:** Electron 多窗口 Tab 拖拽交互
**Confidence:** MEDIUM-HIGH

## Summary

本研究聚焦 Phase 36 的五个核心交付：窗口内 Tab 拖拽排序（MW-04）、拖拽 Tab 出标签栏创建新窗口（MW-02）、跨窗口拖拽移动 Tab（MW-03）、窗口位置持久化（MW-11）、右键菜单"在新窗口中打开"（MW-13）。

**核心发现：**
- 项目已有 Phase 16 的 HTML5 DnD 实现（收藏夹排序，renderer.js:2406-2460），可复用其模式
- Electron 不支持跨窗口原生拖拽，需使用自定义鼠标事件 + IPC 方案（D-25 决策已锁定）
- Chromium TabDragController 使用 kVerticalDetachThreshold (~30px) 作为脱离阈值，Chrome 风格交互已锁定
- electron-store 8.2.0 已在项目中使用，可直接复用于窗口位置持久化
- 现有 tab-manager.js 已支持 windowId 字段和多窗口 Tab 管理（Phase 35 已实现）

**Primary recommendation:** 采用混合拖拽方案：窗口内使用 HTML5 DnD（复用 Phase 16 模式），跨窗口使用 mousedown/mousemove/mouseup + IPC。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab 拖拽排序（窗口内） | Renderer | Main Process | DOM 拖拽在渲染进程处理，排序结果通过 IPC 同步到主进程 tab-manager |
| 跨窗口 Tab 拖拽 | Main Process | Renderer | 主进程协调窗口间状态同步，渲染进程处理本地拖拽事件 |
| 窗口位置持久化 | Main Process | — | BrowserWindow.getBounds() 是主进程 API，electron-store 也在主进程 |
| 右键菜单"在新窗口中打开" | Main Process | Renderer | Menu API 在主进程，渲染进程发送 IPC 请求 |
| 浮动预览窗口 | Main Process | Renderer | BrowserWindow 创建在主进程，渲染进程显示预览卡片 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 32.x | 桌面应用框架 | 已选定，不可更改；原生 BrowserWindow 多窗口支持 |
| electron-store | 8.2.0 | 配置持久化 | 已在项目中使用，用于窗口位置存储 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| HTML5 DnD API | Web Standard | 窗口内 Tab 拖拽排序 | 窗口内排序场景，复用 Phase 16 模式 |
| screen.getCursorScreenPoint() | Electron built-in | 跨窗口鼠标位置检测 | 判断鼠标是否离开 Tab 栏/窗口边界 |
| BrowserWindow.getBounds/setBounds | Electron built-in | 窗口位置获取/设置 | 窗口位置持久化和越界恢复 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML5 DnD（窗口内） | 自定义鼠标事件 | HTML5 DnD 更简单，但跨窗口有限制；自定义事件更灵活但代码量大 |
| electron-store（位置持久化） | 手动 JSON 文件读写 | electron-store 已有防损坏机制，手动实现需处理竞态 |

**Installation:**
```bash
# 无需新依赖 — 所有 API 都是 Electron 内置或已有依赖
```

**Version verification:**
```bash
npm view electron-store version  # 已验证: 8.2.0
```

## Package Legitimacy Audit

本阶段无新增外部依赖，所有功能基于 Electron 内置 API 和已有依赖实现。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| electron-store | npm | 8+ years | 2M+/week | [sindresorhus/electron-store](https://github.com/sindresorhus/electron-store) | OK | Approved (已在项目中) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │  tab-manager.js │  │ window-manager  │  │  IPC Handlers  │ │
│  │  (全局 Tab Map) │  │   (窗口注册表)   │  │  (拖拽协调)    │ │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘ │
│           │                    │                    │          │
│           ▼                    ▼                    ▼          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              DragCoordinator (新增)                      │  │
│  │  - 维护拖拽状态（哪个 Tab、从哪到哪）                      │  │
│  │  - 协调跨窗口通信                                        │  │
│  │  - 管理浮动预览窗口                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │ Window 1 │  │ Window 2 │  │ Window 3 │
     │ Renderer │  │ Renderer │  │ Renderer │
     │          │  │          │  │          │
     │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
     │ │TabBar│ │  │ │TabBar│ │  │ │TabBar│ │
     │ │DnD+  │ │  │ │DnD+  │ │  │ │DnD+  │ │
     │ │Mouse │ │  │ │Mouse │ │  │ │Mouse │ │
     │ └──────┘ │  │ └──────┘ │  │ └──────┘ │
     └──────────┘  └──────────┘  └──────────┘
```

### Recommended Project Structure

```
src/
├── renderer.js          # 渲染进程：Tab 拖拽事件处理、视觉反馈
├── preload.js           # contextBridge：新增拖拽相关 API
├── styles/
│   └── main.css         # 拖拽相关 CSS 变量和类
├── index.html           # Tab 栏 DOM 结构
main.js                  # 主进程：拖拽协调、窗口创建
tab-manager.js           # Tab 管理：moveTab、reorderTab
window-manager.js        # 窗口管理：位置持久化
context-menu-manager.js  # 右键菜单：新增"在新窗口中打开"
```

### Pattern 1: 混合拖拽方案（D-25 决策）

**What:** 窗口内排序使用 HTML5 DnD API，跨窗口拖拽使用自定义鼠标事件 + IPC
**When to use:** Tab 拖拽场景
**Example:**
```javascript
// 窗口内排序（HTML5 DnD，复用 Phase 16 模式）
// Source: renderer.js:2406-2460
tabElement.addEventListener('dragstart', (e) => {
  tabElement.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', tabId);
});

tabElement.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // 计算插入位置，显示指示线
  const rect = tabElement.getBoundingClientRect();
  const midX = rect.left + rect.width / 2;
  showInsertIndicator(e.clientX < midX ? 'before' : 'after', tabElement);
});

tabElement.addEventListener('drop', (e) => {
  e.preventDefault();
  const fromTabId = e.dataTransfer.getData('text/plain');
  const toTabId = tabElement.dataset.tabId;
  // 通知主进程重排
  window.realmAPI.reorderTab(fromTabId, toTabId);
});
```

```javascript
// 跨窗口拖拽（自定义鼠标事件 + IPC）
// Source: D-25 决策
let dragState = null;

tabElement.addEventListener('mousedown', (e) => {
  dragState = {
    tabId: tabId,
    startX: e.screenX,
    startY: e.screenY,
    isDragging: false,
  };
});

document.addEventListener('mousemove', (e) => {
  if (!dragState) return;

  const dx = e.screenX - dragState.startX;
  const dy = e.screenY - dragState.startY;

  if (!dragState.isDragging && Math.abs(dx) + Math.abs(dy) > 5) {
    dragState.isDragging = true;
    // 通知主进程拖拽开始
    window.realmAPI.tabDragStart(dragState.tabId);
  }

  if (dragState.isDragging) {
    // 检查是否离开 Tab 栏 + 30px 阈值（D-27）
    const tabBarRect = document.querySelector('.tab-bar').getBoundingClientRect();
    const threshold = 30; // Chrome kVerticalDetachThreshold
    const isOutside = (
      e.clientY > tabBarRect.bottom + threshold ||
      e.clientY < tabBarRect.top - threshold
    );

    if (isOutside) {
      // 显示浮动预览卡片
      showDragPreview(dragState.tabId, e.screenX, e.screenY);
    }

    // 实时通知主进程鼠标位置（用于跨窗口检测）
    window.realmAPI.tabDragMove({ x: e.screenX, y: e.screenY });
  }
});

document.addEventListener('mouseup', (e) => {
  if (!dragState || !dragState.isDragging) {
    dragState = null;
    return;
  }

  // 通知主进程拖拽结束
  window.realmAPI.tabDragEnd({
    tabId: dragState.tabId,
    screenX: e.screenX,
    screenY: e.screenY,
  });

  hideDragPreview();
  dragState = null;
});
```

### Pattern 2: 跨窗口拖拽协调（D-26 决策）

**What:** 主进程维护拖拽状态，协调源窗口和目标窗口
**When to use:** 跨窗口 Tab 拖拽
**Example:**
```javascript
// 主进程 (main.js)
const dragCoordinator = {
  activeDrag: null, // { tabId, sourceWindowId, startTime }

  startDrag(tabId, sourceWindowId) {
    this.activeDrag = { tabId, sourceWindowId, startTime: Date.now() };
    // 通知所有窗口拖拽开始（用于显示拖入反馈）
    windowManager.broadcast('tab:drag-started', { tabId });
  },

  updatePosition(screenX, screenY) {
    if (!this.activeDrag) return;

    // 检查鼠标是否在其他窗口的 Tab 栏内
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (win.id === this.activeDrag.sourceWindowId) continue;
      if (!windowManager.isManagedWindow(win.id)) continue;

      const bounds = win.getBounds();
      // 简单的矩形碰撞检测
      if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
          screenY >= bounds.y && screenY <= bounds.y + 100) { // Tab 栏区域
        // 通知目标窗口显示拖入反馈
        win.webContents.send('tab:drag-enter', {
          tabId: this.activeDrag.tabId,
          x: screenX - bounds.x,
          y: screenY - bounds.y,
        });
      }
    }
  },

  endDrag(screenX, screenY) {
    if (!this.activeDrag) return;

    const { tabId, sourceWindowId } = this.activeDrag;
    this.activeDrag = null;

    // 检查是否在其他窗口的 Tab 栏内释放
    const targetWindow = this.findTargetWindow(screenX, screenY);
    if (targetWindow && targetWindow.id !== sourceWindowId) {
      // 跨窗口移动
      this.moveTabToWindow(tabId, sourceWindowId, targetWindow.id);
    } else if (!targetWindow) {
      // 在非窗口区域释放，创建新窗口（D-37）
      this.detachToNewWindow(tabId, sourceWindowId, screenX, screenY);
    }
    // 如果在源窗口释放，不做任何操作（D-36 静默回滚）
  },
};
```

### Pattern 3: 窗口位置持久化（D-32/D-33 决策）

**What:** 使用 electron-store 保存窗口位置、大小、状态
**When to use:** 窗口移动/调整大小时实时保存 + 应用退出时保存
**Example:**
```javascript
// window-manager.js
const Store = require('electron-store');
const windowStore = new Store({ name: 'window-bounds' });

function saveWindowBounds(windowId) {
  const win = BrowserWindow.fromId(windowId);
  if (!win || win.isDestroyed()) return;

  const bounds = win.getBounds();
  const isMaximized = win.isMaximized();

  windowStore.set(`windows.${windowId}`, {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
    displayId: getDisplayId(bounds), // 记录所在显示器
  });
}

function restoreWindowBounds(windowId) {
  const saved = windowStore.get(`windows.${windowId}`);
  if (!saved) return null;

  // 越界检测（D-34）
  if (isOutOfBounds(saved)) {
    // 居中到主显示器
    const primaryDisplay = screen.getPrimaryDisplay();
    return {
      x: Math.round(primaryDisplay.workArea.x + (primaryDisplay.workArea.width - saved.width) / 2),
      y: Math.round(primaryDisplay.workArea.y + (primaryDisplay.workArea.height - saved.height) / 2),
      width: saved.width,
      height: saved.height,
    };
  }

  return saved;
}

function isOutOfBounds(bounds) {
  const displays = screen.getAllDisplays();
  return !displays.some(display => {
    const area = display.workArea;
    return (
      bounds.x >= area.x &&
      bounds.x + bounds.width <= area.x + area.width &&
      bounds.y >= area.y &&
      bounds.y + bounds.height <= area.y + area.height
    );
  });
}
```

### Anti-Patterns to Avoid

- **不要使用 HTML5 DnD 进行跨窗口拖拽**：HTML5 DnD 的 dataTransfer 在跨窗口时不可靠（Pitfall MW-11），应使用自定义鼠标事件 + IPC
- **不要在渲染进程直接创建 BrowserWindow**：所有窗口操作必须通过 IPC 走主进程
- **不要使用 getAllWindows()[0] 获取主窗口**：使用 windowManager 的显式引用管理（CR-7 决策）
- **不要在拖拽开始时就移除源 Tab**：Chrome 风格是拖拽过程中 Tab 保持原位显示（D-35），松手后才移动

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 窗口位置持久化 | 手动 JSON 文件读写 | electron-store | 已有防损坏机制、原子写入、类型校验 |
| 鼠标全局位置检测 | 手动计算屏幕坐标 | screen.getCursorScreenPoint() | Electron 内置 API，处理 DPI 缩放 |
| 跨窗口通信 | 自定义 WebSocket/HTTP | IPC (webContents.send) | Electron 原生 IPC，安全可靠 |
| 插入位置指示线动画 | 手动 requestAnimationFrame | CSS transition | 更简单，性能更好 |

**Key insight:** Electron 已经提供了所有必要的原生 API（screen、BrowserWindow、IPC），不需要引入第三方库或手写底层逻辑。

## Runtime State Inventory

本阶段不是 rename/refactor/migration 阶段，跳过此节。

## Common Pitfalls

### Pitfall 1: HTML5 DnD 跨窗口不可靠（Pitfall MW-11）

**What goes wrong:** 使用 HTML5 DnD 进行跨窗口拖拽时，dragend 事件可能不触发，或者 dataTransfer 数据丢失
**Why it happens:** HTML5 DnD 设计为同文档操作，跨窗口依赖 Chromium 内部实现，行为不如同窗口可靠
**How to avoid:** 跨窗口场景使用自定义鼠标事件（mousedown/mousemove/mouseup）+ IPC，不依赖 HTML5 DnD
**Warning signs:** 拖拽 Tab 出窗口时 Tab 消失或目标窗口无反应

### Pitfall 2: webview 不能跨窗口移动（Pitfall MW-3）

**What goes wrong:** 尝试将 webview DOM 元素从一个窗口移动到另一个窗口
**Why it happens:** Electron 的 webview guest 进程与宿主 BrowserWindow 绑定，物理移动会导致 guest 进程被杀
**How to avoid:** Tab 迁移时在目标窗口重建 webview 并重新导航，接受页面状态丢失（Chrome 也是这样）
**Warning signs:** 拖拽 Tab 后页面白屏或需要重新登录

### Pitfall 3: 拖拽开始时就移除源 Tab

**What goes wrong:** 在 dragstart 时就从源窗口移除 Tab DOM，导致视觉跳动
**Why it happens:** 开发者误以为拖拽就是"移动"
**How to avoid:** Chrome 风格是拖拽过程中 Tab 保持原位显示（D-35），半透明 opacity:0.4，松手后才移动
**Warning signs:** 拖拽时 Tab 突然消失，用户体验差

### Pitfall 4: 窗口位置越界未处理

**What goes wrong:** 外接显示器断开后，窗口位置超出所有显示器边界，用户看不到窗口
**Why it happens:** 窗口位置保存了外接显示器的坐标，但恢复时该显示器不存在
**How to avoid:** 恢复窗口位置时检测是否越界，如果越界则居中到主显示器（D-34）
**Warning signs:** 应用启动后看不到窗口

### Pitfall 5: electron-store 并发写入竞争

**What goes wrong:** 多个窗口同时修改 Tab 配置，electron-store 的文件写入产生竞争
**Why it happens:** electron-store 底层使用 JSON 文件读写，多进程并发可能导致数据丢失
**How to avoid:** 所有持久化写入通过主进程单一入口，渲染进程不直接写 store
**Warning signs:** 重启后 Tab 列表与关闭前不一致

## Code Examples

### 窗口内 Tab 拖拽排序（复用 Phase 16 模式）

```javascript
// Source: renderer.js:2406-2460 (Phase 16 收藏夹排序实现)
// 适配为 Tab 拖拽排序

/**
 * 为 Tab 元素绑定拖拽事件
 * @param {HTMLElement} tabElement - Tab DOM 元素
 * @param {Object} tab - Tab 数据对象
 */
function setupTabDragEvents(tabElement, tab) {
  // 拖拽开始
  tabElement.setAttribute('draggable', 'true');
  tabElement.addEventListener('dragstart', (e) => {
    tabElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
  });

  // 拖拽结束
  tabElement.addEventListener('dragend', () => {
    tabElement.classList.remove('dragging');
    document.querySelectorAll('.tab').forEach(el => {
      el.classList.remove('drag-over');
    });
    hideInsertIndicator();
  });

  // 拖拽经过（用于计算插入位置）
  tabElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const draggingTab = document.querySelector('.tab.dragging');
    if (draggingTab === tabElement) return;

    const rect = tabElement.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const isLeft = e.clientX < midX;

    // 显示插入指示线（D-29：垂直插入线，Chrome 风格）
    showInsertIndicator(isLeft ? 'before' : 'after', tabElement);
  });

  // 拖拽离开
  tabElement.addEventListener('dragleave', () => {
    tabElement.classList.remove('drag-over');
    hideInsertIndicator();
  });

  // 放下
  tabElement.addEventListener('drop', (e) => {
    e.preventDefault();
    hideInsertIndicator();

    const fromTabId = e.dataTransfer.getData('text/plain');
    const toTabId = tab.id;
    if (fromTabId === toTabId) return;

    // 通知主进程重排
    window.realmAPI.reorderTab(fromTabId, toTabId);
  });
}
```

### 跨窗口拖拽浮动预览卡片（D-30 决策）

```javascript
/**
 * 显示跨窗口拖拽预览卡片
 * @param {Object} tab - Tab 数据对象
 * @param {number} screenX - 鼠标屏幕 X 坐标
 * @param {number} screenY - 鼠标屏幕 Y 坐标
 */
function showDragPreview(tab, screenX, screenY) {
  let preview = document.getElementById('tab-drag-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'tab-drag-preview';
    preview.className = 'tab-drag-preview';
    document.body.appendChild(preview);
  }

  const containerColor = getContainerColor(tab.containerId);
  preview.innerHTML = `
    <div class="tab-drag-preview-color" style="background-color: ${containerColor}"></div>
    <div class="tab-drag-preview-content">
      <img class="tab-drag-preview-favicon" src="${tab.faviconUrl || ''}" alt="">
      <span class="tab-drag-preview-title">${tab.title || '新标签页'}</span>
    </div>
  `;

  // 位置跟随鼠标，偏移 (10, 10) 避免遮挡
  preview.style.left = `${screenX + 10}px`;
  preview.style.top = `${screenY + 10}px`;
  preview.style.display = 'block';
}

/**
 * 隐藏跨窗口拖拽预览卡片
 */
function hideDragPreview() {
  const preview = document.getElementById('tab-drag-preview');
  if (preview) {
    preview.style.opacity = '0';
    setTimeout(() => {
      preview.style.display = 'none';
      preview.style.opacity = '1';
    }, 150);
  }
}
```

### Tab 拖出窗口创建新窗口（MW-02）

```javascript
// 主进程 (main.js)
/**
 * 处理 Tab 拖出窗口创建新窗口
 * @param {string} tabId - 被拖拽的 Tab ID
 * @param {number} sourceWindowId - 源窗口 ID
 * @param {number} screenX - 松手时的屏幕 X 坐标
 * @param {number} screenY - 松手时的屏幕 Y 坐标
 */
function handleTabDetach(tabId, sourceWindowId, screenX, screenY) {
  // 1. 获取 Tab 元数据
  const tab = tabManager.getTab(tabId);
  if (!tab) return;

  // 2. 获取源窗口容器信息
  const containerId = windowManager.getCurrentContainer(sourceWindowId);
  const container = containerManager.getContainer(containerId);
  if (!container) return;

  // 3. 创建新窗口（位置跟随鼠标）
  const sourceWin = BrowserWindow.fromId(sourceWindowId);
  const sourceBounds = sourceWin.getBounds();
  const newWin = windowManager.createMainWindow(containerId, container);

  // 4. 设置新窗口位置（D-27：鼠标位置居中）
  newWin.setBounds({
    x: Math.round(screenX - sourceBounds.width / 2),
    y: Math.round(screenY - 15), // 偏移使鼠标在 Tab 栏
    width: sourceBounds.width,
    height: sourceBounds.height,
  });

  // 5. 移动 Tab 到新窗口
  tabManager.moveTab(tabId, newWin.id);

  // 6. 通知源窗口移除 Tab DOM
  sourceWin.webContents.send('tab:removed', { tabId });

  // 7. 通知新窗口创建 Tab + webview
  newWin.webContents.send('tab:created', { tab });
}
```

### 右键菜单"在新窗口中打开"（MW-13）

```javascript
// context-menu-manager.js
/**
 * 在 Tab 右键菜单中添加"在新窗口中打开"选项
 * @param {Object} tabInfo - Tab 信息
 * @param {Electron.Menu} menu - 现有菜单
 * @param {Electron.BrowserWindow} mainWindow - 所属窗口
 */
function addOpenInNewWindowOption(tabInfo, menu, mainWindow) {
  const template = menu.items.map(item => item); // 复制现有菜单项

  template.push({ type: 'separator' });
  template.push({
    label: '在新窗口中打开',
    click: () => {
      // 通知主进程将该 Tab 移动到新窗口
      mainWindow.webContents.send('context-menu:open-in-new-window', {
        tabId: tabInfo.tabId,
      });
    },
  });

  return Menu.buildFromTemplate(template);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 单窗口 Tab 管理 | 多窗口 Tab 管理（windowId 字段） | Phase 35 | 每个 Tab 明确归属窗口 |
| HTML5 DnD 跨窗口拖拽 | 自定义鼠标事件 + IPC | D-25 决策 | 跨窗口拖拽更可靠 |
| 无窗口位置持久化 | electron-store 保存 bounds | Phase 36 (MW-11) | 重启后恢复窗口位置 |

**Deprecated/outdated:**
- 单窗口 Tab 管理模式：已被 Phase 35 的多窗口 Tab 管理替代

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chromium kVerticalDetachThreshold 约 30px | Pattern 1 | 阈值可能因平台/版本不同，需实际测试验证 |
| A2 | electron-store 支持多进程并发写入 | Pattern 3 | 如果不支持，需要在主进程串行化写入 |
| A3 | HTML5 DnD 的 dragend 事件在跨窗口时不触发 | Pattern 1 | 如果实际上能触发，可以简化跨窗口方案 |

## Open Questions

1. **浮动预览窗口的具体实现方式**
   - What we know: D-30 决策要求 mini 卡片浮动窗口（200px 宽）
   - What's unclear: 是使用独立的 BrowserWindow 还是 DOM 元素模拟
   - Recommendation: 优先使用 DOM 元素模拟（更简单），如果性能不行再考虑独立窗口

2. **Tab 栏拖入高亮的精确样式**
   - What we know: D-31 要求插入位置线 + Tab 栏背景高亮
   - What's unclear: 高亮的具体颜色和动画
   - Recommendation: 使用 rgba(59, 130, 246, 0.1) 作为背景高亮，200ms transition

3. **窗口位置持久化的存储 key 命名**
   - What we know: electron-store 用于保存窗口 bounds
   - What's unclear: 具体的 key 命名和数据结构
   - Recommendation: 使用 `windowBounds.${windowId}` 作为 key，保存 {x, y, width, height, isMaximized, displayId}

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 核心框架 | ✓ | 32.x | — |
| electron-store | 窗口位置持久化 | ✓ | 8.2.0 | — |
| screen API | 鼠标位置检测 | ✓ | Electron built-in | — |
| BrowserWindow API | 窗口管理 | ✓ | Electron built-in | — |

**Missing dependencies with no fallback:**
- none

**Missing dependencies with fallback:**
- none

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 无（项目当前没有配置测试） |
| Config file | none — see Wave 0 |
| Quick run command | `npm test` (未配置) |
| Full suite command | `npm test` (未配置) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MW-02 | 拖拽 Tab 出标签栏创建新窗口 | manual | — | ❌ Wave 0 |
| MW-03 | 跨窗口拖拽移动 Tab | manual | — | ❌ Wave 0 |
| MW-04 | 窗口内拖拽排序 | manual | — | ❌ Wave 0 |
| MW-11 | 窗口位置持久化 | manual | — | ❌ Wave 0 |
| MW-13 | 右键菜单"在新窗口中打开" | manual | — | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** 手动验证拖拽交互
- **Per wave merge:** 全场景手动测试
- **Phase gate:** 所有 MW 需求通过 UAT

### Wave 0 Gaps

- [ ] 测试框架配置（可选，本阶段以手动测试为主）
- [ ] 拖拽交互的自动化测试（复杂度高，建议手动验证）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | assertTrustedSender 校验拖拽 IPC 来源 |
| V5 Input Validation | yes | 拖拽数据校验（tabId、windowId） |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron Tab Drag

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 恶意 IPC 调用伪造拖拽事件 | Spoofing | assertTrustedSender 校验所有拖拽相关 IPC |
| Tab 数据注入（伪造 tabId） | Tampering | 主进程校验 tabId 是否存在于全局 Tab Map |
| 跨窗口信息泄露 | Information Disclosure | 拖拽只传递 Tab 元数据（URL、标题），不传递敏感数据 |

## Sources

### Primary (HIGH confidence)

- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) — 窗口管理 API
- [Electron Screen API](https://www.electronjs.org/docs/latest/api/screen) — 鼠标位置检测
- [HTML5 Drag and Drop API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) — 拖拽实现参考
- 现有代码：window-manager.js, tab-manager.js, renderer.js:2406-2460

### Secondary (MEDIUM confidence)

- [Chromium TabDragController](https://source.chromium.org/chromium/chromium/src/+/main:chrome/browser/ui/views/tabs/tab_drag_controller.cc) — Chrome Tab 拖拽实现参考
- electron-store 8.2.0 已在项目中验证可用

### Tertiary (LOW confidence)

- [ASSUMED] Chromium kVerticalDetachThreshold 约 30px — 基于训练知识，需实际测试验证
- [ASSUMED] HTML5 DnD 跨窗口不可靠 — 基于训练知识，需 Spike 验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Electron API 和 electron-store 已在项目中验证
- Architecture: MEDIUM — 混合拖拽方案需要 Spike 验证跨窗口行为
- Pitfalls: HIGH — 来自 Pitfall 研究文档（21 个陷阱）和 Phase 34/35 经验

**Research date:** 2026-08-15
**Valid until:** 2026-09-15 (30 days for stable Electron API)

---

*Phase: 36-Tab 拖拽与跨窗口移动*
*Research completed: 2026-08-15*

# Phase 16: 收藏夹文件夹 - 增强功能 - 研究文档

**研究时间：** 2026-07-28
**研究范围：** 拖拽排序、批量操作、排序持久化技术方案
**目标：** 为 FOLDER-07 需求提供完整的技术实现路径

---

## 1. 技术方案概述

本阶段需要实现三个核心功能模块：
- **拖拽排序**：支持收藏项和文件夹的同目录排序、跨文件夹移动、拖入文件夹
- **批量操作增强**：键盘多选（Cmd/Ctrl+Click, Shift+Click）、右键菜单自适应、批量拖拽移动
- **排序持久化**：使用 fractional-indexing 策略保存排序状态

### 1.1 技术选型决策

| 技术领域 | 推荐方案 | 备选方案 | 决策依据 |
|---------|---------|---------|---------|
| 拖拽实现 | HTML5 Drag and Drop API | 第三方库（如 Sortable.js） | 项目无框架依赖，原生 API 足够轻量，无额外包体积 |
| 排序键生成 | fractional-indexing npm 包 | 自实现分数索引 | 库仅 1.6kB，无依赖，经过社区验证，避免重复造轮子 |
| 多选交互 | 原生 JavaScript + CSS | 自定义 checkbox 组件 | 保持与现有代码风格一致，无框架依赖 |

---

## 2. HTML5 Drag and Drop API 最佳实践

### 2.1 核心概念

HTML5 Drag and Drop API 提供了一套原生的拖拽事件系统，适用于所有现代浏览器（包括 Electron 的 Chromium 内核）。

**关键事件：**
- `dragstart`：开始拖拽时触发（绑定在拖拽源元素上）
- `drag`：拖拽过程中持续触发
- `dragenter`：拖拽元素进入目标区域时触发
- `dragover`：拖拽元素在目标区域上方时触发（**必须调用 `e.preventDefault()` 才能允许放置**）
- `dragleave`：拖拽元素离开目标区域时触发
- `drop`：元素被放置到目标区域时触发
- `dragend`：拖拽结束时触发（无论是否成功放置）

**拖拽流程：**
```
dragstart → drag → dragenter → dragover → drop → dragend
```

### 2.2 项目实现要点

**2.2.1 使元素可拖拽**

为每个收藏项/文件夹行添加 `draggable="true"` 属性：

```javascript
// 在 renderFavoriteItem() 中
itemEl.setAttribute('draggable', 'true');
```

**2.2.2 拖拽数据传输**

使用 `DataTransfer` 对象传递被拖拽项的数据：

```javascript
itemEl.addEventListener('dragstart', (e) => {
  // 设置拖拽数据
  e.dataTransfer.setData('text/plain', JSON.stringify({
    type: 'favorite', // 或 'folder'
    id: record.id,
    folderId: record.folder_id
  }));
  
  // 设置拖拽效果
  e.dataTransfer.effectAllowed = 'move';
  
  // 添加拖拽中的视觉反馈
  itemEl.classList.add('dragging');
});
```

**2.2.3 拖拽目标处理**

在文件夹行和列表容器上监听 `dragover` 和 `drop` 事件：

```javascript
// 文件夹行作为拖入目标
folderItemEl.addEventListener('dragover', (e) => {
  e.preventDefault(); // 允许放置
  e.dataTransfer.dropEffect = 'move';
  
  // 判断是否允许放置（防止拖到自身或子文件夹）
  const draggedData = JSON.parse(e.dataTransfer.types.includes('text/plain'));
  if (draggedData.type === 'folder' && isDescendant(draggedData.id, folder.id)) {
    e.dataTransfer.dropEffect = 'none';
    return;
  }
  
  // 添加高亮反馈
  folderItemEl.classList.add('drag-over-folder');
});

folderItemEl.addEventListener('drop', (e) => {
  e.preventDefault();
  const draggedData = JSON.parse(e.dataTransfer.getData('text/plain'));
  
  // 执行移动操作
  if (draggedData.type === 'favorite') {
    moveFavoriteToFolder(draggedData.id, folder.id);
  } else if (draggedData.type === 'folder') {
    moveFolderToFolder(draggedData.id, folder.id);
  }
  
  // 移除高亮
  folderItemEl.classList.remove('drag-over-folder');
});
```

**2.2.4 同目录排序位置检测**

要实现插入位置指示线，需要检测鼠标在目标元素的哪个半区（上半部分或下半部分）：

```javascript
function getDragPosition(e, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  
  if (e.clientY < midY) {
    return 'before'; // 插入到目标前面
  } else {
    return 'after'; // 插入到目标后面
  }
}
```

### 2.3 常见陷阱与解决方案

| 陷阱 | 问题描述 | 解决方案 |
|------|---------|---------|
| **dragover 默认不允许放置** | 必须在 `dragover` 事件中调用 `e.preventDefault()` | 始终在 `dragover` 处理器中调用 `e.preventDefault()` |
| **Firefox 需要设置 dataTransfer** | Firefox 在 `dragstart` 中必须调用 `e.dataTransfer.setData()` | 始终在 `dragstart` 中设置数据 |
| **拖拽过程中元素消失** | 浏览器默认行为会移除被拖拽的元素 | 使用 CSS `opacity` 而非 `display: none` |
| **子元素干扰拖拽事件** | 子元素的 `dragenter`/`dragleave` 会导致事件冒泡混乱 | 使用 `e.currentTarget` 而非 `e.target`，或使用计数器跟踪进入/离开状态 |
| **滚动容器内拖拽卡顿** | 大量 DOM 元素同时触发 `dragover` 事件 | 使用 `requestAnimationFrame` 节流事件处理 |

### 2.4 与现有代码集成点

**文件：`src/favorites-page.js`**

需要修改以下函数：

1. **`renderFavoriteItem()`**（第 284-374 行）
   - 添加 `draggable="true"` 属性
   - 添加 `dragstart`、`drag`、`dragend` 事件监听
   - 添加视觉反馈 CSS 类切换

2. **`renderFolderTree()`**（第 383-449 行）
   - 为文件夹行添加 `dragenter`、`dragover`、`dragleave`、`drop` 事件监听
   - 添加文件夹高亮 CSS 类切换

3. **`renderFavorites()`**（第 234-246 行）
   - 在列表容器上添加 `dragover` 和 `drop` 事件监听（处理同目录排序）
   - 使用事件委托减少事件监听器数量

---

## 3. Fractional Indexing 算法研究

### 3.1 算法原理

Fractional Indexing（分数索引）是一种在两个已排序元素之间插入新元素的算法，无需重新排序所有元素。

**核心思想：**
- 每个元素有一个字符串类型的排序键（如 `"a"`, `"b"`, `"c"`）
- 插入新元素时，生成一个介于相邻元素排序键之间的新键
- 字符串按字典序比较，因此天然支持排序

**示例：**
```
现有元素排序键：["a", "c", "e"]
在 "a" 和 "c" 之间插入 → 生成 "b"
在 "c" 和 "e" 之间插入 → 生成 "d"
```

### 3.2 npm 包 `fractional-indexing` 使用方法

**包信息：**
- 大小：1.6 kB (minified + gzipped)
- 依赖：无
- GitHub：https://github.com/rocicorp/fractional-indexing

**安装：**
```bash
npm install fractional-indexing
```

**核心 API：**

```javascript
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

// 生成单个排序键（在 a 和 b 之间）
const key = generateKeyBetween(a, b);

// 生成 N 个排序键（保持顺序）
const keys = generateNKeysBetween(a, b, n);
```

**使用场景：**

```javascript
// 场景 1：插入到两个元素之间
const beforeKey = "a";
const afterKey = "c";
const newKey = generateKeyBetween(beforeKey, afterKey); // "b"

// 场景 2：插入到列表开头
const firstKey = "c";
const newFirstKey = generateKeyBetween(null, firstKey); // "Y" 或类似

// 场景 3：插入到列表末尾
const lastKey = "a";
const newLastKey = generateKeyBetween(lastKey, null); // "b" 或类似

// 场景 4：批量插入（保持相对顺序）
const keys = generateNKeysBetween("a", "d", 2); // ["b", "c"]
```

### 3.3 与现有数据库集成

**当前数据库结构：**

```sql
-- favorites 表
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon_url TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  folder_id INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0  -- 当前使用整数排序
);

-- favorite_folders 表
CREATE TABLE favorite_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  parent_id INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,  -- 当前使用整数排序
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
```

**迁移策略：**

1. **修改 `sort_order` 字段类型**：将 `INTEGER` 改为 `TEXT` 以存储分数索引字符串
2. **数据迁移**：将现有整数排序值转换为分数索引字符串
3. **向后兼容**：保留 `created_at` 作为初始化排序依据（D-13 决策）

**迁移 SQL：**
```sql
-- 创建新表结构
CREATE TABLE favorites_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon_url TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  folder_id INTEGER NOT NULL DEFAULT 0,
  sort_order TEXT DEFAULT ''  -- 改为 TEXT 类型
);

-- 迁移数据，按 created_at 升序分配初始分数索引
INSERT INTO favorites_new (id, url, title, favicon_url, created_at, folder_id, sort_order)
SELECT id, url, title, favicon_url, created_at, folder_id,
       ROW_NUMBER() OVER (ORDER BY created_at ASC) AS sort_order
FROM favorites;

-- 替换表
DROP TABLE favorites;
ALTER TABLE favorites_new RENAME TO favorites;
```

### 3.4 排序键生成规则

**场景 1：插入到两个元素之间**
```javascript
const beforeItem = records[index - 1];
const afterItem = records[index];
const newSortOrder = generateKeyBetween(beforeItem.sort_order, afterItem.sort_order);
```

**场景 2：插入到列表开头**
```javascript
const firstItem = records[0];
const newSortOrder = generateKeyBetween(null, firstItem.sort_order);
```

**场景 3：插入到列表末尾**
```javascript
const lastItem = records[records.length - 1];
const newSortOrder = generateKeyBetween(lastItem.sort_order, null);
```

**场景 4：批量移动（保持相对顺序）**
```javascript
const beforeKey = targetIndex > 0 ? records[targetIndex - 1].sort_order : null;
const afterKey = targetIndex < records.length ? records[targetIndex].sort_order : null;
const newKeys = generateNKeysBetween(beforeKey, afterKey, selectedItems.length);

// 为每个选中项分配新的排序键
selectedItems.forEach((item, i) => {
  item.sort_order = newKeys[i];
});
```

---

## 4. 拖拽排序视觉反馈实现

### 4.1 插入位置指示线（D-07）

**实现方案：使用 CSS 伪元素**

```css
/* 插入指示线基础样式 */
.favorite-item {
  position: relative;
}

.favorite-item.drag-over-top::before,
.favorite-item.drag-over-bottom::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--drag-insert-color, #3B82F6);
  z-index: 10;
}

/* 插入到目标前面 */
.favorite-item.drag-over-top::before {
  top: -1px;
}

/* 插入到目标后面 */
.favorite-item.drag-over-bottom::after {
  bottom: -1px;
}
```

**JavaScript 实现：**

```javascript
let currentDragOverItem = null;
let dragOverPosition = null; // 'top' 或 'bottom'

function handleDragOver(e, itemEl) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  // 清除之前的高亮
  if (currentDragOverItem && currentDragOverItem !== itemEl) {
    currentDragOverItem.classList.remove('drag-over-top', 'drag-over-bottom');
  }
  
  // 计算插入位置
  const rect = itemEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const position = e.clientY < midY ? 'top' : 'bottom';
  
  // 更新高亮
  if (currentDragOverItem !== itemEl || dragOverPosition !== position) {
    itemEl.classList.remove('drag-over-top', 'drag-over-bottom');
    itemEl.classList.add(`drag-over-${position}`);
    currentDragOverItem = itemEl;
    dragOverPosition = position;
  }
}

function handleDragLeave(e, itemEl) {
  // 只有当真正离开元素时才移除高亮
  // （避免子元素触发的 dragleave 事件）
  if (!itemEl.contains(e.relatedTarget)) {
    itemEl.classList.remove('drag-over-top', 'drag-over-bottom');
    if (currentDragOverItem === itemEl) {
      currentDragOverItem = null;
      dragOverPosition = null;
    }
  }
}
```

### 4.2 目标文件夹高亮（D-06）

**CSS 实现：**

```css
/* 文件夹拖入目标高亮 */
.folder-tree-item.drag-over-folder {
  background-color: var(--drag-hover-bg, rgba(59, 130, 246, 0.15));
  border-left: 3px solid var(--accent-color, #3B82F6);
  padding-left: calc(16px - 3px); /* 补偿边框宽度 */
}
```

**JavaScript 实现：**

```javascript
function handleFolderDragOver(e, folderEl, folderId) {
  e.preventDefault();
  
  // 获取拖拽数据
  const dragData = getDragData(e);
  if (!dragData) return;
  
  // 检查是否允许放置（防止循环引用）
  if (dragData.type === 'folder' && isDescendant(dragData.id, folderId)) {
    e.dataTransfer.dropEffect = 'none';
    return;
  }
  
  e.dataTransfer.dropEffect = 'move';
  folderEl.classList.add('drag-over-folder');
}

function handleFolderDragLeave(e, folderEl) {
  // 只有当真正离开元素时才移除高亮
  if (!folderEl.contains(e.relatedTarget)) {
    folderEl.classList.remove('drag-over-folder');
  }
}
```

### 4.3 拖拽源元素半透明（D-05）

**CSS 实现：**

```css
/* 被拖拽元素的半透明效果 */
.favorite-item.dragging,
.folder-tree-item.dragging {
  opacity: var(--dragging-opacity, 0.4);
}
```

**JavaScript 实现：**

```javascript
function handleDragStart(e, itemEl) {
  // 添加 dragging 类
  itemEl.classList.add('dragging');
  
  // 设置拖拽数据
  e.dataTransfer.setData('text/plain', JSON.stringify({
    type: itemEl.dataset.type, // 'favorite' 或 'folder'
    id: parseInt(itemEl.dataset.id)
  }));
  
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e, itemEl) {
  // 移除 dragging 类
  itemEl.classList.remove('dragging');
  
  // 清除所有拖拽高亮
  document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-folder').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-folder');
  });
}
```

---

## 5. 批量操作键盘多选机制

### 5.1 多选交互逻辑（D-08）

**Cmd/Ctrl + Click（切换选中）：**
```javascript
function handleItemClick(e, itemEl, itemId) {
  // Cmd (macOS) 或 Ctrl (Windows/Linux) + 点击
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    toggleItemSelection(itemId);
  }
  // Shift + 点击（范围选择）
  else if (e.shiftKey) {
    e.preventDefault();
    selectRange(itemId);
  }
  // 普通点击
  else {
    // 如果当前有选中项，点击非选中项时清除所有选中
    if (state.selectedIds.size > 0 && !state.selectedIds.has(itemId)) {
      clearSelection();
    }
  }
}
```

### 5.2 范围选择实现

**实现思路：**
- 记录最后点击的项（`lastClickedId`）
- Shift+点击时，选中从 `lastClickedId` 到当前点击项之间的所有项
- 支持向上和向下范围选择

```javascript
let lastClickedId = null;

function handleItemClick(e, itemEl, itemId) {
  // 切换选中
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    toggleItemSelection(itemId);
    lastClickedId = itemId;
  }
  // 范围选择
  else if (e.shiftKey && lastClickedId !== null) {
    e.preventDefault();
    selectRange(lastClickedId, itemId);
  }
  // 普通点击
  else {
    clearSelection();
    lastClickedId = itemId;
  }
}

function selectRange(startId, endId) {
  const allItems = getAllVisibleItemIds();
  const startIndex = allItems.indexOf(startId);
  const endIndex = allItems.indexOf(endId);
  
  if (startIndex === -1 || endIndex === -1) return;
  
  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);
  
  // 选中范围内的所有项
  const rangeIds = allItems.slice(minIndex, maxIndex + 1);
  state.selectedIds = new Set(rangeIds);
  
  // 更新 UI
  updateSelectionUI();
}
```

### 5.3 右键菜单自适应（D-09）

**实现方案：**

```javascript
function showContextMenu(e, itemEl, itemId) {
  e.preventDefault();
  
  // 如果右键点击的是未选中的项，先选中它
  if (!state.selectedIds.has(itemId)) {
    clearSelection();
    state.selectedIds.add(itemId);
    updateSelectionUI();
  }
  
  const selectedCount = state.selectedIds.size;
  const items = [];
  
  if (selectedCount > 1) {
    // 多选状态：显示批量操作菜单
    items.push({
      label: `删除 ${selectedCount} 项`,
      onClick: () => handleBatchDelete()
    });
    items.push({
      label: `移动 ${selectedCount} 项到...`,
      onClick: () => showMoveToFolderDialog()
    });
    items.push({ type: 'separator' });
    items.push({
      label: `剪切 ${selectedCount} 项`,
      onClick: () => handleBatchCut()
    });
    items.push({
      label: `复制 ${selectedCount} 项`,
      onClick: () => handleBatchCopy()
    });
    items.push({ type: 'separator' });
    items.push({
      label: '取消选择',
      onClick: () => clearSelection()
    });
  } else {
    // 单选状态：显示单个项的操作菜单
    const record = state.records.find(r => r.id === itemId);
    items.push({
      label: '打开',
      onClick: () => window.open(record.url, '_blank')
    });
    items.push({
      label: '在新标签页中打开',
      onClick: () => window.open(record.url, '_blank')
    });
    items.push({ type: 'separator' });
    items.push({
      label: '编辑',
      onClick: () => startInlineEdit(itemEl, record)
    });
    items.push({
      label: '剪切',
      onClick: () => handleCut(itemId)
    });
    items.push({
      label: '复制',
      onClick: () => handleCopy(itemId)
    });
    items.push({ type: 'separator' });
    items.push({
      label: '删除',
      onClick: () => handleDelete(itemId)
    });
  }
  
  showContextMenuAt(items, e.clientX, e.clientY);
}
```

### 5.4 批量拖拽移动（D-10）

**实现方案：**

```javascript
function handleDragStart(e, itemEl, itemId) {
  // 如果拖拽的是已选中的项，拖拽所有选中项
  if (state.selectedIds.has(itemId)) {
    const selectedIds = [...state.selectedIds];
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'batch',
      ids: selectedIds,
      count: selectedIds.length
    }));
    
    // 设置拖拽预览（显示选中项数量）
    const dragPreview = createDragPreview(selectedIds.length);
    e.dataTransfer.setDragImage(dragPreview, 0, 0);
  } else {
    // 拖拽单个项
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'single',
      id: itemId
    }));
  }
  
  itemEl.classList.add('dragging');
}

function createDragPreview(count) {
  const preview = document.createElement('div');
  preview.className = 'drag-preview';
  preview.textContent = `${count} 项`;
  preview.style.cssText = `
    position: absolute;
    top: -1000px;
    left: -1000px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-primary);
  `;
  document.body.appendChild(preview);
  return preview;
}
```

---

## 6. 集成点分析

### 6.1 后端 API 扩展

**当前已存在的 API：**
- `POST /api/favorites/update` - 更新单个收藏项（标题、URL 等）
- `POST /api/favorites/move-favorites` - 批量移动收藏项到文件夹
- `POST /api/favorites/delete-batch` - 批量删除收藏项

**需要新增的 API：**

1. **批量更新排序**
```
POST /api/favorites/update-sort
Request: {
  items: [
    { id: 1, sort_order: "a1b2c3" },
    { id: 2, sort_order: "a1b2c4" },
    ...
  ]
}
Response: { success: true, updated: 10 }
```

2. **批量更新文件夹排序**
```
POST /api/favorites/update-folder-sort
Request: {
  folders: [
    { id: 1, sort_order: "a1b2c3" },
    { id: 2, sort_order: "a1b2c4" },
    ...
  ]
}
Response: { success: true, updated: 5 }
```

### 6.2 现有代码修改清单

**文件：`src/favorites-page.js`**
- [ ] 在 `renderFavoriteItem()` 中添加 `draggable="true"` 和拖拽事件监听
- [ ] 在 `renderFolderTree()` 中为文件夹行添加拖入目标事件监听
- [ ] 在 `loadFavorites()` 中按 `sort_order` 排序（而非 `created_at`）
- [ ] 添加多选交互逻辑（Cmd/Ctrl+Click, Shift+Click）
- [ ] 扩展右键菜单，支持多选状态下的批量操作
- [ ] 添加拖拽排序的视觉反馈（插入线、高亮）
- [ ] 添加拖拽结束后的排序保存逻辑

**文件：`src/styles/main.css`**
- [ ] 添加拖拽相关 CSS 变量（`--drag-insert-color`, `--drag-hover-bg` 等）
- [ ] 添加插入指示线样式（`.drag-over-top::before`, `.drag-over-bottom::after`）
- [ ] 添加文件夹高亮样式（`.drag-over-folder`）
- [ ] 添加拖拽源半透明样式（`.dragging`）
- [ ] 添加多选选中样式（`.selected`）

**文件：`favorites-manager.js`**
- [ ] 修改 `sort_order` 字段类型为 `TEXT`
- [ ] 添加数据迁移逻辑（整数排序 → 分数索引字符串）
- [ ] 添加批量更新排序的函数 `updateSortOrders()`
- [ ] 修改 `listRecords()` 按 `sort_order` 排序

**文件：`main.js`**
- [ ] 添加 `/api/favorites/update-sort` 路由
- [ ] 添加 `/api/favorites/update-folder-sort` 路由

---

## 7. 风险评估与缓解措施

### 7.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| **拖拽事件冲突** | 多个事件监听器相互干扰 | 中 | 使用事件委托，统一在容器级别处理拖拽事件 |
| **排序键过长** | 频繁插入导致排序键字符串越来越长 | 低 | 监控排序键长度，超过阈值时重新平衡整个列表 |
| **大数据量性能** | 1000+ 收藏项时拖拽卡顿 | 低 | 使用虚拟滚动，只渲染可见区域的元素 |
| **循环引用** | 文件夹嵌套拖拽导致无限循环 | 中 | 复用 Phase 14 的 `isDescendant()` 检测函数 |
| **数据迁移失败** | 旧数据转换为分数索引时出错 | 低 | 迁移前备份数据库，使用事务包裹迁移操作 |

### 7.2 用户体验风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **拖拽不流畅** | 拖拽过程中有卡顿感 | 使用 CSS `will-change: transform` 优化渲染性能 |
| **多选误操作** | 意外选中大量项并删除 | 删除操作需要二次确认，显示选中项数量 |
| **排序丢失** | 拖拽后排序未保存 | 拖拽结束立即调用 API 保存，失败时回滚 UI 状态 |
| **键盘快捷键冲突** | Cmd/Ctrl+A 选中全部与浏览器默认行为冲突 | 使用 `e.preventDefault()` 阻止浏览器默认行为 |

---

## 8. 测试策略

### 8.1 单元测试

**需要测试的功能点：**
- [ ] `generateSortKey()` 函数：正确生成分数索引
- [ ] `getDragPosition()` 函数：正确计算插入位置
- [ ] `isDescendant()` 函数：正确检测循环引用
- [ ] `selectRange()` 函数：正确计算范围选择

### 8.2 集成测试

**需要测试的场景：**
- [ ] 拖拽单个收藏项到另一个位置
- [ ] 拖拽文件夹到另一个文件夹
- [ ] 拖拽收藏项到文件夹内
- [ ] Cmd/Ctrl+Click 多选
- [ ] Shift+Click 范围选择
- [ ] 批量删除选中项
- [ ] 批量移动选中项到文件夹
- [ ] 排序持久化（刷新页面后排序保持）

### 8.3 边界情况测试

**需要覆盖的边界：**
- [ ] 空文件夹内拖拽
- [ ] 只有一个元素时的拖拽
- [ ] 拖拽到列表开头/末尾
- [ ] 深层嵌套文件夹的拖拽
- [ ] 1000+ 收藏项时的性能
- [ ] 拖拽过程中按 ESC 取消
- [ ] 拖拽过程中切换到其他应用

---

## 9. 实施路线图

### 9.1 Phase 1：基础拖拽（2-3 天）

1. **安装依赖**
   ```bash
   npm install fractional-indexing
   ```

2. **数据库迁移**
   - 修改 `sort_order` 字段类型为 `TEXT`
   - 添加数据迁移逻辑（按 `created_at` 初始化分数索引）

3. **基础拖拽实现**
   - 为收藏项和文件夹行添加 `draggable="true"`
   - 实现 `dragstart`、`dragover`、`drop`、`dragend` 事件处理
   - 实现插入位置检测（`getDragPosition()`）

4. **排序持久化**
   - 实现 `updateSortOrders()` API
   - 拖拽结束后调用 API 保存排序

### 9.2 Phase 2：视觉反馈（1-2 天）

1. **插入指示线**
   - 实现 `.drag-over-top::before` 和 `.drag-over-bottom::after` 样式
   - 在 `dragover` 事件中动态切换 CSS 类

2. **文件夹高亮**
   - 实现 `.drag-over-folder` 样式
   - 在文件夹行的 `dragenter`/`dragleave` 事件中切换样式

3. **拖拽源半透明**
   - 实现 `.dragging` 样式
   - 在 `dragstart`/`dragend` 事件中切换样式

### 9.3 Phase 3：多选机制（1-2 天）

1. **Cmd/Ctrl+Click 多选**
   - 实现 `toggleItemSelection()` 函数
   - 更新 UI 显示选中状态

2. **Shift+Click 范围选择**
   - 实现 `selectRange()` 函数
   - 记录 `lastClickedId` 状态

3. **右键菜单自适应**
   - 根据选中状态动态生成菜单项
   - 实现批量操作（删除、移动、剪切、复制）

4. **批量拖拽移动**
   - 实现拖拽预览显示选中项数量
   - 批量更新排序键

### 9.4 Phase 4：测试与优化（1 天）

1. **功能测试**
   - 测试所有拖拽场景
   - 测试多选交互
   - 测试排序持久化

2. **性能优化**
   - 使用 `requestAnimationFrame` 节流事件处理
   - 使用事件委托减少监听器数量

3. **边界情况处理**
   - 测试空列表、单元素列表
   - 测试深层嵌套文件夹
   - 测试大数据量场景

---

## 10. 参考资源

### 10.1 官方文档

- [HTML Drag and Drop API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [DataTransfer - MDN](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer)
- [DragEvent - MDN](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent)

### 10.2 第三方库

- [fractional-indexing - npm](https://www.npmjs.com/package/fractional-indexing)
- [Fractional Indexing - Design Document](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)

### 10.3 最佳实践

- [Drag and Drop UX Guidelines - NNGroup](https://www.nngroup.com/articles/drag-and-drop/)
- [Sortable.js - GitHub](https://github.com/SortableJS/Sortable)（参考实现）

---

## 11. 总结

### 11.1 关键决策

1. **拖拽实现**：使用 HTML5 Drag and Drop API，无需第三方库
2. **排序算法**：使用 `fractional-indexing` npm 包（1.6kB，无依赖）
3. **多选机制**：原生 JavaScript + CSS，保持与现有代码风格一致
4. **视觉反馈**：CSS 伪元素 + 动态类切换，性能开销最小

### 11.2 预估工作量

| 阶段 | 工作量 | 产出 |
|------|--------|------|
| Phase 1: 基础拖拽 | 2-3 天 | 可拖拽排序、持久化 |
| Phase 2: 视觉反馈 | 1-2 天 | 插入线、高亮、半透明 |
| Phase 3: 多选机制 | 1-2 天 | Cmd/Shift 多选、批量操作 |
| Phase 4: 测试优化 | 1 天 | 功能测试、性能优化 |
| **总计** | **5-8 天** | **完整的拖拽排序和批量操作功能** |

### 11.3 依赖项

- [ ] 安装 `fractional-indexing` npm 包
- [ ] 数据库迁移脚本（`sort_order` 字段类型修改）
- [ ] Phase 14 的循环引用检测函数（`isDescendant()`）

### 11.4 成功标准

- [ ] 可以通过拖拽调整收藏项和文件夹的排序
- [ ] 可以将收藏项/文件夹拖拽到文件夹内
- [ ] 排序状态在页面刷新后保持
- [ ] 可以通过 Cmd/Ctrl+Click 和 Shift+Click 多选
- [ ] 多选状态下可以批量删除、移动、剪切、复制
- [ ] 拖拽过程中有清晰的视觉反馈（插入线、高亮、半透明）
- [ ] 大数据量（1000+ 项）时拖拽流畅，无明显卡顿

---

**研究完成时间：** 2026-07-28
**研究者：** Claude
**版本：** 1.0

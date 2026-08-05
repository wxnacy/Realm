---
quick_id: 260805-icj
type: quick
title: 侧边栏容器列表添加编辑和删除按钮
status: ready
files_modified:
  - src/renderer.js
  - src/styles/main.css
autonomous: true
---

# 侧边栏容器列表添加编辑和删除按钮

## 背景

地址栏左侧弹窗（container panel）的容器列表已经有编辑和删除按钮，但左侧常驻侧边栏的容器列表没有。用户希望侧边栏也能直接编辑和删除容器，提升操作效率。

## 参考实现

地址栏弹窗容器列表的实现位于 `src/renderer.js`：
- `renderContainerPanelList()` (line 1771) — 构建带 edit/delete 按钮的 DOM
- 事件委托 (line 2751) — `panelContainerList.addEventListener('click', ...)` 处理 edit/delete/switch

侧边栏容器列表位于 `src/renderer.js`：
- `renderContainerList()` (line 1726) — 当前只有 dot + name + status，无操作按钮

## Tasks

### Task 1: 为侧边栏容器列表添加编辑和删除按钮

**Files:** `src/renderer.js`, `src/styles/main.css`

**Actions:**

1. **修改 `renderContainerList()` 函数** (line 1726)，参考 `renderContainerPanelList()` 的 DOM 结构：
   - 在 `item` 中新增 `actions` 容器 (`div.container-actions`)
   - 添加编辑按钮 (`button.action-btn[data-action="edit"]`)，内含铅笔 SVG 图标
   - 添加删除按钮 (`button.action-btn[data-action="delete"]`)，内含垃圾桶 SVG 图标
   - 默认容器 (id === 'default') 的删除按钮设置 `disabled = true`，title 设为 "默认容器不可删除"
   - 将 `item.appendChild(info)` 后追加 `item.appendChild(actions)`

2. **添加侧边栏容器列表事件委托**，在 `setupEventListeners` 中：
   - 为 `elements.containerList` 添加 `click` 事件监听器
   - 逻辑与 `panelContainerList` 的事件委托一致：
     - 如果点击的是 `[data-action="edit"]`，调用 `showEditContainerModal(containerId)`
     - 如果点击的是 `[data-action="delete"]` 且未 disabled，调用 `showDeleteConfirmModal(containerId)`
     - 否则（点击容器行本身），调用 `switchContainer(containerId)`
   - 移除 `renderContainerList()` 中每个 item 上的单独 click 监听（避免重复绑定）

3. **添加 CSS 样式** (`src/styles/main.css`)：
   - `.container-item` 添加 `position: relative`（如尚未设置）
   - `.container-item .container-actions` — 默认隐藏 (opacity: 0)，flex 布局
   - `.container-item:hover .container-actions` — 显示 (opacity: 1)
   - `.container-item .action-btn` — 按钮基础样式（参考 `.panel-container-item .action-btn`）
   - `.container-item .action-btn:hover` — 悬停高亮
   - `.container-item .action-btn:disabled` — 禁用样式

**Verify:**
- `npm run dev` 启动应用
- 侧边栏容器列表每个容器右侧出现编辑和删除按钮（hover 时显示）
- 点击编辑按钮打开容器编辑模态框
- 点击删除按钮打开删除确认模态框
- 默认容器的删除按钮禁用且有 tooltip 提示
- 点击容器行（非按钮区域）仍然正常切换容器

**Done:**
- 侧边栏容器列表支持编辑和删除操作，行为与地址栏弹窗一致
- 默认容器保护逻辑生效
- hover 时显示操作按钮，不破坏现有布局


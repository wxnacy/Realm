---
phase: 6
slug: 浏览历史记录
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-25
---

# Phase 6 — 浏览历史记录 UI Design Contract

> 浏览历史记录功能的视觉与交互设计契约。由 gsd-ui-researcher 生成，gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 CSS） |
| Preset | not applicable |
| Component library | none |
| Icon library | 内联 SVG（与现有工具栏按钮一致） |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

说明：本项目为 Electron 原生 JS + CSS 架构，无框架、无组件库。所有 UI 遵循 `src/styles/main.css` 中已建立的设计系统。

---

## Spacing Scale

沿用项目已有间距体系（基于 4px 网格，从 CSS 变量和实际样式中提取）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 紧凑内联间距（drag-handle margin、tab-close 定位） |
| sm | 8px | 工具栏按钮间距、搜索框内 padding、列表项内元素间距 |
| md | 16px | 默认元素间距（sidebar-header padding、form label margin、feature padding） |
| lg | 24px | 区域内边距（modal padding、form-actions margin-top） |
| xl | 32px | 大区域间距（welcome page padding、feature gap） |
| 2xl | 48px | 搜索框与列表间距（new-tab-search margin-bottom） |

Exceptions: 工具栏高度固定 48px（`--toolbar-height`），Tab 栏高度固定 36px（`--tab-bar-height`），与间距无关。

---

## Typography

沿用项目已有字体规格（从 `main.css` 提取）：

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display | 24px | 600 | 1.2 | 新标签页标题、历史记录页面标题 |
| Heading | 18px | 600 | 1.3 | Modal 标题（h2） |
| Body | 14px | 400 | 1.5 | 列表项正文、表单输入、按钮文字 |
| Label | 13px | 400 | 1.4 | Tab 标题、URL 显示 |
| Caption | 12px | 400 | 1.4 | 次要信息（container-status、cookie-domain）、时间戳 |
| Mono | 13px | 400 | 1.4 | URL 文本（浏览器地址栏风格） |

---

## Color

沿用项目 CSS 变量系统（`:root` in `main.css`）：

| Role | Variable | Value | Usage |
|------|----------|-------|-------|
| Dominant (60%) | `--bg-primary` | `#1a1a1a` | 页面背景、内容区底色 |
| Secondary (30%) | `--bg-secondary` | `#2a2a2a` | 侧边栏、工具栏、Tab 栏、卡片背景 |
| Tertiary | `--bg-tertiary` | `#3a3a3a` | 输入框背景、列表容器背景、选中态 |
| Hover | `--bg-hover` | `#404040` | 悬停高亮、按钮 hover |
| Border | `--border-color` | `#404040` | 分隔线、输入框边框 |
| Text Primary | `--text-primary` | `#f0f0f0` | 主要文字 |
| Text Secondary | `--text-secondary` | `#a0a0a0` | 次要文字 |
| Text Muted | `--text-muted` | `#6b7280` | 最弱文字（时间戳、URL 域名） |
| Accent (10%) | `--accent-color` | `#3B82F6` | 超链接、搜索框 focus、Toggle 开启态 |
| Accent Hover | `--accent-hover` | `#2563EB` | 按钮 hover |
| Destructive | `--danger-color` | `#EF4444` | 删除按钮、错误提示、清空历史确认 |
| Success | `--success-color` | `#10B981` | Toast 成功提示 |

**Accent reserved for:**
- 搜索输入框 focus 边框
- 历史记录页面中的可点击链接 hover 态
- Toggle switch 开启态（预留）
- 不用于列表项文字（列表项标题使用 `--text-primary`，URL 使用 `--text-muted`）

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| 工具栏按钮 title | `浏览历史` |
| 页面标题 | `浏览历史` |
| 空状态标题 | `暂无浏览记录` |
| 空状态正文 | `在浏览器中访问网页后，历史记录会显示在这里` |
| 搜索框 placeholder | `搜索历史记录...` |
| 搜索无结果 | `未找到匹配的历史记录` |
| 日期分组 - 今天 | `今天` |
| 日期分组 - 昨天 | `昨天` |
| 日期分组 - 本周 | `本周` |
| 日期分组 - 本月 | `本月` |
| 日期分组 - 更早 | `更早` |
| 批量删除按钮 | `删除选中项` |
| 全选按钮 | `全选` |
| 取消全选按钮 | `取消全选` |
| 清空按钮 | `清空所有历史` |
| 单条删除确认 | 无（D-15：悬停显示删除图标，点击直接删除，无确认弹窗） |
| 批量删除确认标题 | `删除历史记录` |
| 批量删除确认正文 | `确定删除选中的 {n} 条历史记录吗？此操作不可撤销。` |
| 清空确认标题 | `清空所有历史` |
| 清空确认正文 | `确定清空当前容器的所有浏览历史吗？此操作不可撤销。` |
| 确认按钮 | `删除` |
| 取消按钮 | `取消` |
| Toast - 删除成功 | `已删除 {n} 条历史记录` |
| Toast - 清空成功 | `已清空所有历史记录` |

---

## Component Inventory: History Page

### 1. 工具栏历史按钮（`#historyBtn`）

位置：`toolbar-right`，在 `#rulesBtn` 之前（左侧第一个）。

```html
<button class="btn-icon" id="historyBtn" title="浏览历史">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
</button>
```

行为：点击后在当前容器新 Tab 打开 `realm://history`。

### 2. 历史记录页面布局

`realm://history` 为内部页面，通过 Electron protocol 注册加载。

页面结构（从上到下）：

```
┌──────────────────────────────────────────────┐
│  浏览历史                          [清空所有] │  ← 页面头部（padding: 24px）
├──────────────────────────────────────────────┤
│  [  搜索历史记录...                     🔍 ] │  ← 搜索栏
├──────────────────────────────────────────────┤
│  今天                                  [全选] │  ← 日期分组头部
│  ┌──────────────────────────────────────────┐│
│  │ ☐ 🌐  Google                           🕐││  ← 历史记录条目
│  │    https://www.google.com        14:32  ✕││
│  ├──────────────────────────────────────────┤│
│  │ ☐ 📄  GitHub - Repository               ││
│  │    https://github.com/user/repo  14:28  ✕││
│  └──────────────────────────────────────────┘│
│  昨天                                        │
│  ┌──────────────────────────────────────────┐│
│  │ ...                                      ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### 3. 页面头部

```css
.history-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-shrink: 0;
}

.history-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}
```

### 4. 搜索栏

```css
.history-search-wrapper {
  position: relative;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.history-search {
  width: 100%;
  height: 40px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 12px 0 36px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.history-search:focus {
  border-color: var(--accent-color);
}

.history-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
```

### 5. 批量操作栏

```css
.history-actions-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  flex-shrink: 0;
}

.history-actions-bar.hidden {
  display: none;
}
```

包含元素：
- 全选/取消全选 checkbox
- 「删除选中项」按钮（`btn btn-danger` 样式，仅在有选中项时可点击）
- 已选数量文字（如 `已选择 3 项`）

### 6. 日期分组头部

```css
.history-date-group {
  margin-bottom: 16px;
}

.history-date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}
```

### 7. 历史记录条目

```css
.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: default;
  transition: background-color 0.15s;
}

.history-item:hover {
  background-color: var(--bg-hover);
}

.history-item-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--accent-color);
  flex-shrink: 0;
  cursor: pointer;
}

.history-item-favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
}

.history-item-favicon-fallback {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  background-color: var(--bg-tertiary);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-muted);
}

.history-item-content {
  flex: 1;
  min-width: 0;
}

.history-item-title {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item-url {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item-time {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 40px;
  text-align: right;
}

.history-item-delete {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s, color 0.15s;
  flex-shrink: 0;
  cursor: pointer;
}

.history-item:hover .history-item-delete {
  opacity: 1;
}

.history-item-delete:hover {
  background-color: var(--bg-tertiary);
  color: var(--danger-color);
}
```

### 8. 空状态

```css
.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.history-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.history-empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.history-empty-body {
  font-size: 14px;
  color: var(--text-muted);
}
```

### 9. 搜索高亮

```css
.history-highlight {
  background-color: rgba(59, 130, 246, 0.3);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 1px;
}
```

在搜索结果中，标题和 URL 里匹配关键词的文本片段用 `<span class="history-highlight">` 包裹。

### 10. 确认弹窗（复用项目已有 modal 模式）

批量删除和清空历史使用与删除容器相同的 `<dialog class="modal">` 模式：

```html
<dialog class="modal" id="historyClearModal">
  <div class="modal-content">
    <h2 id="historyClearModalTitle">清空所有历史</h2>
    <div class="delete-confirm-content">
      <p id="historyClearModalBody">确定清空当前容器的所有浏览历史吗？此操作不可撤销。</p>
      <p class="warning-text">此操作无法撤销</p>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" id="cancelHistoryClearBtn">取消</button>
      <button type="button" class="btn btn-danger" id="confirmHistoryClearBtn">删除</button>
    </div>
  </div>
</dialog>
```

---

## Interaction Specifications

### 工具栏按钮行为

| Action | Behavior |
|--------|----------|
| 单击 `#historyBtn` | 在当前容器新建 Tab，加载 `realm://history` |
| 历史页面已打开时再次点击 | 切换到已有的历史记录 Tab（不重复打开） |

### 搜索行为

| Action | Behavior |
|--------|----------|
| 输入关键词 | debounce 300ms 后实时过滤，同时匹配 title 和 URL |
| 高亮 | 匹配文本片段用 `.history-highlight` 样式包裹 |
| 清空搜索框 | 恢复完整列表（按日期分组） |
| 搜索时无结果 | 显示空状态「未找到匹配的历史记录」 |

### 单条删除

| Action | Behavior |
|--------|----------|
| 鼠标悬停条目 | 右侧出现 `✕` 删除图标（opacity 0 → 1） |
| 点击 `✕` | 直接删除该条记录，无确认弹窗（D-15） |
| 删除后 | 条目从列表移除，若该日期组为空则移除整个日期组 |

### 批量删除

| Action | Behavior |
|--------|----------|
| 勾选 checkbox | 底部操作栏显示，「删除选中项」按钮激活 |
| 点击「全选」 | 选中当前可见的所有条目（搜索过滤后的结果） |
| 点击「删除选中项」 | 弹出确认弹窗，确认后批量删除 |
| 删除完成 | Toast 提示「已删除 N 条历史记录」 |

### 清空所有历史

| Action | Behavior |
|--------|----------|
| 点击「清空所有历史」按钮 | 弹出确认弹窗（danger 样式） |
| 确认后 | 清空当前容器全部历史，显示空状态 |

### 滚动加载

| Action | Behavior |
|--------|----------|
| 滚动到底部 | 自动加载下一批历史记录 |
| 加载中 | 列表底部显示加载指示（可选，planner 决定） |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | not applicable | not applicable |
| (none) | — | — |

说明：项目未使用 shadcn 或任何组件注册表。

---

## Checklist Sign-Off

- [ ] Dimension 1 Copywriting: PASS — 所有文案元素已定义，中文语义明确
- [ ] Dimension 2 Visuals: PASS — 沿用现有设计系统，Chrome 风格适配深色主题
- [ ] Dimension 3 Color: PASS — 使用项目 CSS 变量，60/30/10 分布一致
- [ ] Dimension 4 Typography: PASS — 4 级字体规格，从现有 CSS 提取
- [ ] Dimension 5 Spacing: PASS — 4px 网格，6 级间距，与现有 UI 一致
- [ ] Dimension 6 Registry Safety: PASS — 无第三方注册表

**Approval:** pending

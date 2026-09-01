---
phase: 42
slug: ai-pi-agent
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-01
---

# Phase 42 — UI Design Contract

> AI 历史对话管理功能的视觉与交互契约。由 gsd-ui-researcher 生成，由 gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 CSS 变量体系） |
| Preset | not applicable |
| Component library | none（原生 DOM） |
| Icon library | 内联 SVG（与现有 AI 面板一致） |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

---

## Spacing Scale

基于现有 `main.css` 变量体系（4px 基数）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 图标间距、紧凑内边距 |
| sm | 8px | 按钮内边距、列表项间距 |
| md | 12px | 面板内边距、消息列表 padding |
| lg | 16px | 区域分隔、头部 padding |
| xl | 24px | 大段间距（本阶段无特殊需求） |

Exceptions: 对话列表项高度 48px（与现有工具栏高度对齐）

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 13px | 400 | 1.4 |
| Heading | 14px | 600 | 1.4 |
| Display | 16px | 600 | 1.4 |

沿用现有 AI 面板字体规范，无新增字体角色。

---

## Color

沿用现有 CSS 变量体系，不新增颜色：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | var(--bg-primary) #1a1a1a | 面板背景、列表背景 |
| Secondary (30%) | var(--bg-secondary) #2a2a2a | 下拉面板背景、列表项悬停 |
| Accent (10%) | var(--accent-color) #3B82F6 | 选中态高亮、激活按钮 |
| Destructive | var(--danger-color) #EF4444 | 删除操作 |

Accent reserved for: 选中对话高亮条、新对话按钮激活态

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | 新对话 |
| Empty state heading | 暂无对话 |
| Empty state body | 点击「新对话」开始与 AI 交流 |
| Error state | 对话加载失败，请重试 |
| Destructive confirmation | 删除对话: 确定要删除「{title}」吗？此操作不可撤销 |

---

## Component Inventory

本阶段新增 3 个 UI 组件，全部复用现有 CSS 模式：

### 1. 对话历史按钮（Conversation History Button）

**位置：** AI 面板头部 `.ai-panel-header-actions` 内，设置按钮左侧

**HTML 结构：**
```html
<button class="btn-icon ai-history-btn" id="aiHistoryBtn" title="对话历史">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
</button>
```

**交互：**
- 点击展开/关闭对话列表下拉面板（toggle）
- 面板打开时按钮添加 `active` 类（背景高亮）

**样式规则：**
- 复用 `.btn-icon` 基础样式（32x32px，6px 圆角）
- `active` 状态：`background-color: var(--bg-hover)`

---

### 2. 对话列表下拉面板（Conversation List Dropdown）

**位置：** AI 面板头部下方，绝对定位展开

**CSS 变量（新增）：**
```css
:root {
  --conv-list-width: 320px;
  --conv-list-max-height: 400px;
  --conv-item-height: 48px;
}
```

**HTML 结构：**
```html
<div class="ai-conv-dropdown" id="aiConvDropdown" style="display:none">
  <div class="ai-conv-dropdown-header">
    <span class="ai-conv-dropdown-title">对话历史</span>
  </div>
  <div class="ai-conv-list" id="aiConvList">
    <!-- 对话项由 JS 动态生成 -->
  </div>
</div>
```

**对话项 HTML：**
```html
<div class="ai-conv-item" data-conversation-id="xxx">
  <div class="ai-conv-item-title">对话标题（前30字符）</div>
  <div class="ai-conv-item-meta">2026-09-01 · 12 条消息</div>
</div>
```

**样式规则（新增 CSS，追加到 main.css AI 面板段）：**
```css
.ai-conv-dropdown {
  position: absolute;
  top: var(--ai-panel-header-height);
  left: 0;
  right: 0;
  max-height: var(--conv-list-max-height);
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  z-index: 100;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.ai-conv-dropdown-header {
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.ai-conv-dropdown-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.ai-conv-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-left: 3px solid transparent;
}

.ai-conv-item:hover {
  background-color: var(--bg-hover);
}

.ai-conv-item.active {
  border-left-color: var(--accent-color);
  background-color: rgba(59, 130, 246, 0.1);
}

.ai-conv-item-title {
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.ai-conv-item-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.3;
}
```

**交互：**
- 点击对话项 → 切换到该对话（自动保存当前，加载目标）
- 点击面板外部 → 关闭下拉
- 列表按 `updated_at` 降序排列（最新在上）
- 当前对话高亮（`.active` 类）

---

### 3. 对话右键菜单（Conversation Context Menu）

**位置：** 固定定位，跟随鼠标位置

**HTML 结构：**
```html
<div class="context-menu ai-conv-context-menu" id="aiConvContextMenu" style="display:none">
  <div class="context-menu-item" data-action="rename">重命名</div>
  <div class="context-menu-separator"></div>
  <div class="context-menu-item" data-action="delete" style="color: var(--danger-color)">删除</div>
</div>
```

**交互：**
- 右键对话项 → 显示上下文菜单
- 点击「重命名」→ 对话标题进入可编辑状态（contenteditable 或 input 覆盖）
- 点击「删除」→ 弹出确认对话框（复用现有 `.ai-modal-overlay` 模式）
- 点击菜单外部 → 关闭菜单

**样式规则：**
- 完全复用现有 `.context-menu` / `.context-menu-item` 样式
- 删除项使用 `var(--danger-color)` 红色标识

---

### 4. 删除确认对话框（Delete Confirmation Dialog）

**位置：** 复用现有 `.ai-modal-overlay` 模式

**HTML 结构：**
```html
<dialog class="ai-modal-overlay" id="aiConvDeleteDialog">
  <div class="ai-modal" style="max-width: 360px">
    <div class="ai-modal-header">
      <h3>删除对话</h3>
    </div>
    <p style="padding: 16px; color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
      确定要删除「{conversationTitle}」吗？此操作不可撤销。
    </p>
    <div style="display: flex; gap: 8px; justify-content: flex-end; padding: 0 16px 16px;">
      <button class="ai-modal-cancel-btn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; background: var(--bg-tertiary); color: var(--text-primary);">取消</button>
      <button class="ai-modal-confirm-btn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; background: var(--danger-color); color: #fff;">删除</button>
    </div>
  </div>
</dialog>
```

**交互：**
- 点击「取消」或对话框外部 → 关闭，不删除
- 点击「删除」→ 删除对话，关闭对话框，切换到新对话

---

## UI Considerations

Applicable state considerations resolved: 5 covered, 1 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | conversation list | covered | 空列表显示「暂无对话」+ 引导文案 |
| loading | conversation list | covered | 列表加载时显示骨架屏或 spinner（沿用现有模式） |
| populated | conversation list | covered | 按时间降序展示，当前对话高亮 |
| long-text | conversation title | covered | 截断为 30 字符 + ellipsis，支持手动重命名 |
| overflow | conversation list | covered | max-height 400px + overflow-y: auto 滚动 |
| error | conversation load | backstop | 加载失败时 toast 提示，不阻断面板 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable |

本阶段不引入任何第三方 registry 组件，全部使用原生 CSS + DOM 实现。

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

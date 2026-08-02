---
phase: 23
slug: context-reference
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-02
---

# Phase 23 — UI Design Contract

> 智能上下文引用 + 全文检索的视觉和交互契约。由 gsd-ui-researcher 生成，gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 CSS + CSS 变量） |
| Preset | not applicable |
| Component library | none |
| Icon library | none（使用 SVG 内联） |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**说明**: Realm Browser 使用原生 CSS，无 shadcn/Tailwind。所有样式通过 `src/styles/main.css` 的 CSS 变量系统管理。

---

## Spacing Scale

已声明值（必须是 4 的倍数）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Pill 内部 padding、图标间距 |
| sm | 8px | 列表项间距、面板内边距 |
| md | 16px | 面板 padding、区块间距 |
| lg | 24px | 面板与输入框间距 |
| xl | 32px | 空状态区域 padding |
| 2xl | 48px | 面板最大高度分页 |
| 3xl | 64px | 空状态大间距 |

Exceptions: @ 浮动面板高度固定 300px（可滚动），不使用 spacing scale

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 500 | 1.4 |
| Heading | 16px | 600 | 1.3 |
| Display | not used | — | — |

**说明**: 复用现有 `main.css` 的字体规格。标签页标题 14px，容器名称 12px，面板标题 16px。

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#1a1a1a` (--bg-primary) | 面板背景、页面背景 |
| Secondary (30%) | `#2a2a2a` (--bg-secondary) | 浮动面板背景、卡片 |
| Accent (10%) | `#3B82F6` (--accent-color) | 选中状态高亮、Pill 背景 |
| Destructive | `#EF4444` (--danger-color) | 仅用于删除操作确认 |

Accent reserved for:
- @ 引用浮动面板中选中行的背景高亮
- Pill 组件的背景色
- 面板搜索框聚焦边框

**容器颜色**（复用现有容器颜色系统）：
- 每个容器有独立颜色（`container.color`），在 @ 选择器中以 10x10px 圆点显示
- 容器颜色由用户在容器设置中自定义

---

## 组件清单

### 1. @ 引用浮动面板（Context Picker Panel）

**触发条件**: 用户在 AI 聊天输入框中输入 `@` 字符（D-04）

**布局**:
```
┌─────────────────────────────────────┐
│  🔍 输入关键字过滤...                │  ← 搜索框
├─────────────────────────────────────┤
│  🔴 Work  │  GitHub - Issues        │  ← 标签页行
│  🔵 Personal │ Google Search        │
│  🟢 Research │ Stack Overflow       │
│  ...                                │
└─────────────────────────────────────┘
```

**样式规范**:
- 宽度: 与 AI 输入框同宽（`--ai-panel-width` 减去 padding）
- 最大高度: 300px，超出滚动
- 背景: `var(--bg-secondary)` (#2a2a2a)
- 边框: 1px solid `var(--border-color)` (#404040)
- 圆角: 8px
- 阴影: `0 4px 16px rgba(0, 0, 0, 0.4)`
- 定位: 相对于 AI 输入框上方，底部对齐

**标签页行**:
- 高度: 36px
- 内边距: 0 12px
- 布局: 容器颜色圆点(10x10) + 容器名(12px, --text-muted) + 标签页标题(14px, --text-primary)
- Hover: `var(--bg-hover)` (#404040)
- 选中: 背景 `rgba(59, 130, 246, 0.2)`，左侧 2px 蓝色边框
- 已选中行显示蓝色勾选图标（16x16）

**搜索框**:
- 高度: 32px
- 背景: `var(--bg-tertiary)` (#3a3a3a)
- 边框: 1px solid `var(--border-color)`
- 聚焦边框: `var(--accent-color)`
- 占位符: "输入关键字过滤标签页..."

**交互流程**:
1. 用户输入 `@` → 弹出浮动面板，显示所有容器的所有标签页（D-13 跨容器可见）
2. 面板内搜索框自动获得焦点
3. 用户输入关键字 → 实时过滤标签页标题和 URL
4. 用户点击标签页行 → 切换选中状态（D-02 多选）
5. 用户按 Escape 或点击面板外 → 关闭面板
6. 用户按 Enter → 确认选择，关闭面板

### 2. Pill 组件（Context Reference Pills）

**位置**: AI 聊天输入框上方

**布局**:
```
┌─────────────────────────────────────┐
│ 🔴 GitHub - Issues  ×  🔵 Google × │  ← Pill 行
├─────────────────────────────────────┤
│  请输入消息...                       │  ← 输入框
└─────────────────────────────────────┘
```

**Pill 样式**:
- 高度: 24px
- 内边距: 2px 8px
- 背景: `var(--bg-tertiary)` (#3a3a3a)
- 圆角: 12px（全圆角）
- 布局: 容器颜色圆点(8x8) + 标签页标题(12px, 截断至 120px) + 关闭按钮(×)
- 间距: Pill 之间 4px
- 最大显示: 一行，超出换行（最多 2 行）

**关闭按钮**:
- 尺寸: 16x16
- 颜色: `var(--text-muted)` (#6b7280)
- Hover: `var(--text-primary)` (#f0f0f0)
- 点击: 移除对应 Pill，更新选中状态

**容器颜色圆点**:
- 尺寸: 8x8
- 颜色: 容器自定义颜色（`container.color`）
- 位置: Pill 左侧

### 3. 标签页选择器行（Tab Selector Row）

**用途**: 在 @ 浮动面板中显示每个标签页

**布局**:
```
┌─────────────────────────────────────┐
│ ● Work    │  GitHub - Issues     ✓ │
└─────────────────────────────────────┘
```

**样式规范**:
- 高度: 36px
- 内边距: 0 12px
- 背景: transparent
- Hover: `var(--bg-hover)`
- 选中: `rgba(59, 130, 246, 0.2)` + 左边框 2px `var(--accent-color)`

**元素**:
- 容器颜色圆点: 10x10，圆角 50%
- 容器名称: 12px，`var(--text-muted)`，最大宽度 80px，截断
- 标签页标题: 14px，`var(--text-primary)`，flex:1，截断
- 选中勾: 16x16，`var(--accent-color)`，仅选中时显示

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | 发送消息（复用现有 AI 输入框） |
| Empty state heading | 暂无标签页 |
| Empty state body | 当前没有打开的标签页，请先打开一些网页 |
| Error state | 无法读取页面内容，请检查页面是否已加载完成 |
| Destructive confirmation | 不适用（本阶段无破坏性操作） |

**@ 面板搜索无结果**:
- 标题: 未找到匹配的标签页
- 描述: 尝试其他关键字，或打开更多标签页

**全文检索无结果**:
- AI 回复: "未找到包含 '{keyword}' 的收藏项"

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | not applicable | not required |
| 第三方 | none | not applicable |

**说明**: 项目不使用 shadcn 或任何组件库，所有 UI 组件使用原生 HTML/CSS/JS 实现。

---

## 文件影响清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/index.html` | 修改 | 添加 @ 引用浮动面板 HTML 结构、Pill 容器 |
| `src/styles/main.css` | 修改 | 添加 @ 面板、Pill、标签页行样式 |
| `src/renderer.js` | 修改 | 添加 @ 触发逻辑、面板交互、Pill 管理 |
| `src/preload.js` | 修改 | 新增 IPC 通道（获取标签页列表、传递引用上下文） |
| `main.js` | 修改 | 新增 IPC handler（获取标签页列表） |
| `ai-manager.js` | 修改 | 新增 search_favorites_fulltext 工具 |
| `favorites-manager.js` | 修改 | 新增 FTS5 虚拟表和触发器 |

---

## 交互状态机

### @ 引用面板状态

```
[隐藏] --输入@--> [显示] --选择标签页--> [已选择] --确认--> [隐藏]
  ^                |                        |
  |                |--Escape/点击外部--------+
  |                |--删除所有Pill-----------+
```

### 状态定义

| 状态 | 面板 | Pill 行 | 输入框 |
|------|------|---------|--------|
| 隐藏 | display:none | display:none | 正常 |
| 显示 | display:block | display:none | 正常 |
| 已选择 | display:block | display:flex | 正常 |

---

## 安全约束

1. **容器隔离**: @ 引用选择器显示所有容器标签页（D-13），但每个标签页明确标注容器来源
2. **内容截断**: 每个标签页最多 102,400 字符（D-07），防止 token 溢出
3. **无破坏性操作**: 本阶段所有操作为只读，无删除/修改确认需求

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

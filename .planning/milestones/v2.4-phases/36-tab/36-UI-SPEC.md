---
phase: 36
slug: tab
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-15
---

# Phase 36 — UI Design Contract

> Tab 拖拽与跨窗口移动的视觉和交互规范。由 gsd-ui-researcher 生成，gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（Electron 原生 CSS） |
| Preset | not applicable |
| Component library | none |
| Icon library | none（复用项目已有图标） |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**说明：** 本项目使用纯 CSS Custom Properties + 原生 DOM，无 shadcn / Tailwind / CSS-in-JS。所有视觉规范直接映射为 CSS 变量和类名。

---

## Spacing Scale

基于项目已有的 8px 网格（`--toolbar-height: 48px`, `--tab-bar-height: 36px`），沿用并扩展：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tab 内边距、图标间距、关闭按钮偏移 |
| sm | 8px | Tab 列表 gap、Tab 内容 padding、Tab 栏内边距 |
| md | 16px | 默认元素间距、Tab favicon 右侧间距（6px 已有，保持） |
| lg | 24px | 浮动预览卡片内边距、右键菜单内边距 |
| xl | 32px | 拖拽触发阈值（垂直脱离距离，Chrome 风格 30px，取整 32px） |
| 2xl | 48px | Tab 栏拖拽保留区最小宽度、工具栏高度 |
| 3xl | 64px | 窗口边界外拖拽判定距离 |

**Exceptions:**
- `--tab-color-line-height: 3px` — 已有，保持不变
- `--tab-close-size: 16px` — 已有，保持不变
- 拖拽垂直脱离阈值 30px（Chrome 标准），非 4 的倍数，但符合 Chromium `kVerticalDetachThreshold` 规范

---

## Typography

沿用项目已有字体设置，无新增字体角色：

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body（Tab 标题） | 13px | 400 (regular) | 1.3 |
| Label（预览卡片标题） | 13px | 400 (regular) | 1.3 |
| Heading（无新增） | — | — | — |
| Display（无新增） | — | — | — |

**说明：** Tab 标题已在 `main.css:1471` 定义为 `font-size: 13px; font-weight: 400`。浮动预览卡片复用此规格，无需新增字体角色。

---

## Color

沿用项目已有颜色系统（`main.css:8-21`），无新增颜色角色：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#1a1a1a` (`--bg-primary`) | 窗口背景、Tab active 背景 |
| Secondary (30%) | `#2a2a2a` (`--bg-secondary`) | Tab 栏背景、侧边栏 |
| Accent (10%) | `#3B82F6` (`--accent-color`) | Tab 插入指示线、Tab 栏拖入高亮 |
| Destructive | `#EF4444` (`--danger-color`) | 无新增用途 |

**Accent reserved for（本阶段新增用途）：**
- Tab 窗口内排序的垂直插入指示线（`--drag-insert-color: #3B82F6`，已有定义）
- 目标窗口 Tab 栏拖入时的背景高亮（新增，使用 `rgba(59, 130, 246, 0.1)` 10% 透明度）
- 浮动预览卡片的容器颜色条（复用各容器已有颜色）

**本阶段不新增颜色变量。** 所有视觉效果复用已有变量或使用 rgba 透明度变体。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | 无（拖拽为直接操作，无按钮 CTA） |
| 右键菜单项 | "在新窗口中打开" |
| Empty state heading | 无新增（复用已有空 Tab 状态） |
| Empty state body | 无新增 |
| Error state | 拖拽失败静默回滚，不显示错误信息（D-36 决策） |
| Destructive confirmation | 无（拖拽移动为可撤销操作，无需确认） |

**说明：** 本阶段唯一新增的用户可见文案是右键菜单项"在新窗口中打开"。拖拽操作无文字交互，全部为直接操作 + 视觉反馈。

---

## Visual Specifications

### 1. Tab 窗口内排序 — 插入指示线

**样式规格：**
```
宽度：3px
颜色：--drag-insert-color (#3B82F6)
高度：Tab 高度的 80%（约 26px，居中对齐）
圆角：1.5px
位置：两个 Tab 之间的间隙中心
动画：无（即时显示，Chrome 风格）
z-index：10
```

**行为：**
- 拖拽源 Tab 保持原位显示，半透明 `opacity: 0.4`（复用 `--dragging-opacity`）
- 指示线跟随鼠标位置实时更新，精确反映松手后的插入位置
- 鼠标在 Tab 左半区时指示线在左侧，右半区时在右侧

### 2. 跨窗口拖拽 — 浮动预览卡片

**样式规格：**
```
宽度：200px
高度：32px
背景：--bg-secondary (#2a2a2a) 不透明度 95%
边框：1px solid --border-color (#404040)
圆角：6px
阴影：0 4px 12px rgba(0, 0, 0, 0.4)
内容：favicon (16px) + 标题文本（单行省略）
容器颜色条：顶部 3px 高，使用容器颜色
位置：跟随鼠标，偏移 (10, 10) 避免遮挡
z-index：9999（最高层级）
```

**行为：**
- 鼠标离开 Tab 栏边缘 + 30px 垂直阈值后显示
- 卡片跟随鼠标移动，使用 `position: fixed` + `transform: translate()`
- 松手后卡片淡出（`opacity: 0` + `transition: opacity 150ms`）

### 3. 目标窗口 Tab 栏 — 拖入反馈

**样式规格：**
```
Tab 栏背景高亮：background-color: rgba(59, 130, 246, 0.1)
插入指示线：同窗口内排序规格（3px, #3B82F6）
高亮动画：transition: background-color 200ms ease
```

**行为：**
- 拖拽进入目标窗口 Tab 栏区域时，Tab 栏背景变为淡蓝
- 同时显示插入位置指示线
- 离开 Tab 栏区域时恢复原背景

### 4. 右键菜单 — "在新窗口中打开"

**样式规格：**
```
菜单项文字："在新窗口中打开"
图标：无（或使用项目已有的窗口图标）
位置：右键菜单末尾，分隔线后
快捷键提示：无
```

**行为：**
- 点击后：Tab 从当前窗口移出，在新窗口打开
- 等效操作：拖拽 Tab 出 Tab 栏

### 5. 拖拽触发机制（Chrome 风格）

**判定规则（D-27/D-28）：**
```
最小拖拽距离：5px（防止误触）
垂直脱离阈值：30px（Tab 栏边缘向下/向上）
判定基准：Tab 栏边缘（.tab-bar 底部），不是窗口边缘
创建新窗口触发：鼠标离开 Tab 栏 + 垂直阈值
```

**视觉反馈序列：**
1. `mousedown` → 记录起始位置
2. 移动 > 5px → 进入拖拽模式，源 Tab 半透明
3. 在 Tab 栏内移动 → 显示插入指示线
4. 离开 Tab 栏 + 30px → 显示浮动预览卡片，插入指示线消失
5. 进入其他窗口 Tab 栏 → 该窗口 Tab 栏高亮 + 插入指示线
6. `mouseup` → 执行移动/创建窗口/取消

### 6. 窗口位置持久化

**无 UI 变更。** 窗口位置和大小通过 `electron-store` 静默保存和恢复，用户无感知。

**存储 key：** `windowBounds`
**存储格式：**
```json
{
  "x": 100,
  "y": 200,
  "width": 1200,
  "height": 800,
  "isMaximized": false
}
```

**越界恢复：** 窗口位置超出所有显示器边界时，静默居中到主显示器，无 UI 提示。

---

## CSS Variables Summary

本阶段不新增 CSS 变量到 `:root`。所有视觉效果使用已有变量：

| Variable | Value | Source |
|----------|-------|--------|
| `--drag-insert-color` | `#3B82F6` | 已有（main.css:2515） |
| `--dragging-opacity` | `0.4` | 已有（main.css:2517） |
| `--drag-hover-bg` | `rgba(59, 130, 246, 0.15)` | 已有（main.css:2516） |
| `--bg-primary` | `#1a1a1a` | 已有（main.css:9） |
| `--bg-secondary` | `#2a2a2a` | 已有（main.css:10） |
| `--border-color` | `#404040` | 已有（main.css:16） |
| `--accent-color` | `#3B82F6` | 已有（main.css:17） |

---

## CSS Class Name Contract

新增 CSS 类名（遵循项目 kebab-case 规范）：

| Class | Element | Purpose |
|-------|---------|---------|
| `.tab-drag-preview` | `div` | 跨窗口拖拽浮动预览卡片 |
| `.tab-bar.drag-over` | `.tab-bar` | Tab 栏拖入高亮状态 |
| `.tab.dragging` | `.tab` | 拖拽源 Tab 半透明状态 |
| `.tab-drag-indicator` | `div` | 窗口内排序插入指示线 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable |
| 第三方注册表 | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

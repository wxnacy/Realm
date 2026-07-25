---
phase: 8
slug: 常用网站推荐 + 设置页面
status: draft
shadcn_initialized: false
preset: none
created: "2026-07-25"
---

# Phase 8 — UI Design Contract

> 新标签页常用网站网格（frecency 排序）+ 设置页面的视觉与交互规范。由 gsd-ui-researcher 生成，gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 CSS，无框架） |
| Preset | not applicable |
| Component library | none |
| Icon library | inline SVG（Feather 风格，与现有工具栏按钮一致） |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**说明：** 项目使用纯原生 CSS + CSS 变量，不使用任何组件框架。所有新增样式必须使用 `src/styles/main.css` 中已有的 CSS 变量（`var(--xxx)`），保持深色主题一致。

---

## Spacing Scale

已确认使用 4 的倍数（与现有 `main.css` 一致）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | favicon 圆形容器内边距、紧凑行间距 |
| sm | 8px | 工具栏按钮间距、卡片内部元素间距 |
| md | 16px | 设置表单组间距、卡片间距、页面内边距 |
| lg | 24px | 区域分隔、页面内边距（history/favorites 页面已用 24px） |
| xl | 32px | 设置区块间距 |
| 2xl | 48px | 常用网站网格与搜索框间距 |
| 3xl | 64px | 空状态内边距（history-empty 已用 64px） |

Exceptions: 常用网站卡片 favicon 圆形尺寸 48px（12 的倍数，非 4 的倍数——保持与 `--new-tab-icon-size: 40px` 类似的约定，但 favicon 需要更大以保证视觉清晰度）

---

## Typography

4 种字号，2 种字重：

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Card Title | 12px | 400 | 1.3 |
| Body / Label / Muted / URL | 14px | 400 | 1.5 |
| Section Title | 14px | 600 | 1.4 |
| Empty State Heading | 18px | 600 | 1.4 |
| Page Title | 24px | 600 | 1.3 |

**说明：** 与现有 history/favorites 页面完全一致。常用网站卡片标题使用 12px（与 `.shortcut-name` 一致）。Label、Muted/URL 统一归入 14px，不再单独使用 13px。仅保留 400（regular）和 600（bold）两种字重。

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#1a1a1a` (`var(--bg-primary)`) | 页面背景、新标签页背景 |
| Secondary (30%) | `#2a2a2a` (`var(--bg-secondary)`) | 设置页面卡片区域、常用网站卡片背景、设置分组背景 |
| Accent (10%) | `#3B82F6` (`var(--accent-color)`) | 见下方保留列表 |
| Destructive | `#EF4444` (`var(--danger-color)`) | 仅用于危险操作（如重置设置） |

**Accent 保留用于（严格限定）：**
- 设置页面中当前选中的设置项高亮
- 默认浏览器引导按钮（Primary CTA）
- 设置变更后的成功状态指示
- 搜索框 focus 状态边框

**不用于：** 常用网站卡片 hover、普通按钮、favicon 边框

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| 新标签页标题 | `新标签页`（保留现有） |
| 常用网站区块标题 | `常用网站` |
| 空状态 heading | `开始浏览` |
| 空状态 body | `访问一些网站后，这里会显示您的常用网站推荐。` |
| 设置页面标题 | `设置` |
| 默认浏览器 CTA | `设为默认浏览器` |
| 默认浏览器已设为默认 | `Realm 已是默认浏览器` |
| 历史记录保留天数 label | `历史记录保留天数` |
| 历史记录保留选项 | `7 天` / `14 天` / `30 天` / `60 天` / `90 天` / `永不删除` |
| 默认容器 label | `新标签页默认容器` |
| 默认容器选项 | `使用上次打开的容器` / 容器列表 |
| 设置保存成功 toast | `设置已保存` |
| Error state | `加载失败，请稍后重试。`（problem + solution path） |

---

## Component Inventory

### 新标签页常用网站网格

**布局：**
- 6 列 x 2 行 CSS Grid，最多 12 个卡片
- `grid-template-columns: repeat(6, 1fr)`
- `gap: 16px`（与现有 container-shortcuts 一致的 16px 间距）
- 整体最大宽度 600px，居中对齐（与现有 new-tab-content 一致）

**单个卡片结构：**
```
+-------------------+
|     [favicon]     |  ← 48px 圆形，Google Favicon 服务
|                   |
|    网站标题       |  ← 12px, color: var(--text-secondary), 单行省略
+-------------------+
```

- 卡片尺寸：自适应，宽高由 grid 列宽决定
- 卡片内边距：12px 上下，8px 左右
- 卡片 hover：`background-color: var(--bg-secondary)`，与 `.container-shortcut:hover` 一致
- 卡片点击：在当前 webview 加载该域名最常访问的 URL
- favicon 降级：加载失败时显示域名首字母，背景 `var(--bg-tertiary)`，字体 16px

**空状态：**
- 图标：时钟 SVG（`var(--text-muted)`，48px）
- 标题：`开始浏览`，18px/600/`var(--text-secondary)`
- 正文：14px/`var(--text-muted)`
- 布局：flex column，居中对齐，padding 64px 24px（与 `.history-empty` 一致）

### 设置页面

**布局：**
- 最大宽度 800px，居中（与 history/favorites 页面一致）
- padding: 24px
- flex: 1, overflow-y: auto（与 `.history-page` 模式一致）

**设置分组：**
- 每个设置区块使用 `var(--bg-secondary)` 背景，border-radius 12px，padding 16px
- 区块间距：24px
- 区块标题：14px/600/`var(--text-primary)`，margin-bottom 16px

**设置项结构：**
- label + 控件水平排列（justify-content: space-between）
- label：14px/400/`var(--text-secondary)`
- 控件：select 下拉框（使用现有 form 样式）或 Toggle Switch（复用现有 `.toggle-switch` 样式）

**默认浏览器引导区：**
- 视觉突出：`var(--bg-tertiary)` 背景，border-radius 12px
- 状态文案：14px/`var(--text-secondary)`
- CTA 按钮：`.btn-primary` 样式（`var(--accent-color)` 背景，白色文字）
- 已设为默认时：按钮隐藏，显示成功状态文案（`var(--success-color)` 图标 + 文案）

**select 下拉框样式：**
- 高度 40px（与现有 input 一致）
- 背景 `var(--bg-tertiary)`
- 边框 `1px solid var(--border-color)`
- border-radius 8px
- 颜色 `var(--text-primary)`
- focus 时 `border-color: var(--accent-color)`

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | not applicable | not applicable |

**说明：** 项目不使用 shadcn 或任何第三方组件库，所有组件为原生 HTML + CSS 实现。无 registry 安全门控需求。

---

## Existing Design Tokens（供实现参考）

以下是 `src/styles/main.css` 中已定义、Phase 8 必须复用的 CSS 变量：

```css
:root {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --bg-tertiary: #3a3a3a;
  --bg-hover: #404040;
  --text-primary: #f0f0f0;
  --text-secondary: #a0a0a0;
  --text-muted: #6b7280;
  --border-color: #404040;
  --accent-color: #3B82F6;
  --accent-hover: #2563EB;
  --danger-color: #EF4444;
  --success-color: #10B981;
  --new-tab-search-max-width: 500px;
  --new-tab-search-height: 40px;
  --new-tab-icon-size: 40px;
}
```

**禁止新增 CSS 变量**（除非有充分理由且在 PLAN 中说明）。

---

## Page Structure Reference

### 新标签页 (`src/newtab.html`)

参考 `src/history.html` 结构：
- `<base href="/newtab/">`
- CSP: `img-src 'self' https: http: data:`（favicon 需要外部加载）
- 样式引用：`styles/main.css`
- 脚本引用：`newtab-page.js`

**DOM 结构概要：**
```html
<body>
  <div class="new-tab-page">         <!-- 复用现有样式 -->
    <div class="new-tab-content">     <!-- 复用现有样式 -->
      <div class="new-tab-search-wrapper">
        <input class="new-tab-search" placeholder="搜索或输入网址...">
      </div>
      <h2 class="new-tab-section-title">常用网站</h2>
      <div class="frequent-sites-grid">  <!-- 新增：6x2 CSS Grid -->
        <!-- 卡片由 JS 动态生成 -->
      </div>
      <!-- 空状态 -->
      <div class="frequent-empty">...</div>
    </div>
  </div>
</body>
```

### 设置页面 (`src/settings.html`)

参考 `src/history.html` 结构：
- `<base href="/settings/">`
- CSP: `default-src 'self'; script-src 'self'; style-src 'self'`
- 样式引用：`styles/main.css`
- 脚本引用：`settings-page.js`

**DOM 结构概要：**
```html
<body>
  <div class="settings-page">         <!-- 新增：与 history-page 同模式 -->
    <h1 class="settings-title">设置</h1>
    <div class="settings-group">       <!-- 新增：设置分组 -->
      <h3 class="settings-group-title">默认浏览器</h3>
      <div class="settings-item">...</div>
    </div>
    <div class="settings-group">
      <h3 class="settings-group-title">历史记录</h3>
      <div class="settings-item">
        <label>历史记录保留天数</label>
        <select class="settings-select">...</select>
      </div>
    </div>
    <div class="settings-group">
      <h3 class="settings-group-title">默认容器</h3>
      <div class="settings-item">
        <label>新标签页默认容器</label>
        <select class="settings-select">...</select>
      </div>
    </div>
  </div>
</body>
```

---

## Interaction Patterns

### 常用网站网格

| Action | Behavior |
|--------|----------|
| 页面加载 | 调用 `/api/frequent-sites` 获取数据，渲染 6x2 网格 |
| 卡片点击 | 在当前 webview 导航到该 URL |
| 卡片 hover | 背景色变更为 `var(--bg-secondary)`，cursor 变为 pointer |
| favicon 加载失败 | 降级为首字母圆形图标（背景 `var(--bg-tertiary)`，颜色 `var(--text-muted)`） |
| 空状态 | 显示引导文案，隐藏网格区域 |

### 设置页面

| Action | Behavior |
|--------|----------|
| 页面加载 | 调用 `/api/settings` 获取当前设置值，渲染表单 |
| select 变更 | 立即调用 `/api/settings` POST 保存，显示 toast `设置已保存` |
| 默认浏览器按钮点击 | 调用 `app.setAsDefaultProtocolClient()` 系统 API |
| 设置加载失败 | 显示 error toast `加载失败，请稍后重试。` |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

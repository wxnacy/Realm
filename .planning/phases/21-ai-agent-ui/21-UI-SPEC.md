---
phase: 21
slug: ai-agent-ui
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-01
---

# Phase 21 — AI 聊天 UI 设计合约

> AI 聊天面板的视觉与交互合约。由 gsd-ui-researcher 生成，gsd-ui-checker 验证。

---

## 设计系统

| 属性 | 值 |
|------|-----|
| 工具 | 无（原生 CSS + CSS 变量） |
| Preset | 不适用 |
| 组件库 | 无（原生 HTML/CSS/JS） |
| 图标库 | 无（内联 SVG，18x18 viewbox） |
| 字体 | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**说明**: 项目不使用 shadcn/tailwind/组件库。所有样式通过 `src/styles/main.css` 的 CSS 变量系统管理。Phase 21 的所有 UI 组件均原生实现。

---

## 现有设计令牌（来自 main.css :root）

以下令牌已定义，Phase 21 直接复用，不重复声明：

| 令牌 | 值 | 用途 |
|------|-----|------|
| --bg-primary | #1a1a1a | 主背景 |
| --bg-secondary | #2a2a2a | 侧边栏、卡片背景 |
| --bg-tertiary | #3a3a3a | 激活态背景 |
| --bg-hover | #404040 | 悬停态背景 |
| --text-primary | #f0f0f0 | 主文字 |
| --text-secondary | #a0a0a0 | 次要文字 |
| --text-muted | #6b7280 | 弱化文字 |
| --border-color | #404040 | 边框 |
| --accent-color | #3B82F6 | 强调色（蓝色） |
| --accent-hover | #2563EB | 强调色悬停 |
| --danger-color | #EF4444 | 危险操作 |
| --success-color | #10B981 | 成功状态 |
| --toolbar-height | 48px | 工具栏高度 |
| --sidebar-width | 240px | 左侧边栏宽度 |

---

## 新增设计令牌（Phase 21 专用）

以下令牌在 `main.css` 中新增，用于 AI 面板：

| 令牌 | 值 | 用途 |
|------|-----|------|
| --ai-panel-width | 360px | AI 面板默认宽度 |
| --ai-panel-min-width | 280px | AI 面板最小宽度 |
| --ai-panel-max-width | 600px | AI 面板最大宽度 |
| --ai-panel-header-height | 44px | 面板头部高度 |
| --ai-input-min-height | 40px | 输入框最小高度 |
| --ai-input-max-height | 120px | 输入框最大高度（约 5 行） |
| --ai-bubble-radius | 12px | 气泡圆角 |
| --ai-bubble-max-width | 85% | 气泡最大宽度（相对面板宽度） |
| --ai-tool-card-bg | #252525 | 工具卡片背景 |

---

## 间距规范

使用 4 的倍数，与现有项目一致：

| 令牌 | 值 | 用途 |
|------|-----|------|
| xs | 4px | 气泡内元素微间距、图标与文字间距 |
| sm | 8px | 消息气泡内边距、紧凑元素间距 |
| md | 16px | 消息间距、面板内边距、按钮内边距 |
| lg | 24px | 面板头部内边距、区域分隔 |
| xl | 32px | 空状态区域上下间距 |

例外: 无

---

## 排版规范

| 角色 | 大小 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| Body | 14px | 400 (regular) | 1.5 | 消息正文、输入框文字 |
| Label | 12px | 500 (medium) | 1.3 | 工具卡片标签、时间戳、状态文字 |
| Heading | 16px | 600 (semibold) | 1.2 | 面板标题 "AI 助手"、空状态标题 |
| Display | 不使用 | - | - | Phase 21 不需要 |

**说明**: 项目使用系统字体栈，不引入自定义字体。代码块使用 monospace（`SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`）。

---

## 颜色合约

| 角色 | 值 | 用途 |
|------|-----|------|
| 主导色 (60%) | --bg-primary (#1a1a1a) | 面板背景、页面背景 |
| 辅助色 (30%) | --bg-secondary (#2a2a2a) | 消息气泡（AI）、工具卡片、输入框背景 |
| 强调色 (10%) | --accent-color (#3B82F6) | 用户消息气泡背景、发送按钮、链接颜色、光标闪烁 |
| 危险色 | --danger-color (#EF4444) | 工具执行失败状态图标、错误提示 |

**强调色仅用于以下元素:**
- 用户消息气泡背景（蓝色底 + 白色文字）
- 发送按钮激活态
- 流式输出光标（闪烁的竖线）
- 消息中的超链接
- 工具执行成功状态图标（使用 success-color #10B981）

**不在以下场景使用强调色:**
- 面板背景、工具卡片、输入框背景（使用 bg-secondary）
- 一般文字（使用 text-primary/secondary）

---

## 文案合约

| 元素 | 文案 |
|------|------|
| 面板标题 | AI 助手 |
| 工具栏按钮提示 | AI 助手 (Cmd+]) |
| 主 CTA 发送按钮 | 发送（或使用 SVG 箭头图标，无文字） |
| 空状态标题 | 准备好聊天了吗？ |
| 空状态正文 | 输入消息开始与 AI 助手对话。我可以帮你导航网页、搜索历史、管理收藏。 |
| 输入框占位符 | 输入消息... |
| 发送中按钮 | 停止（切换为停止图标） |
| 错误状态 | 出现问题 — {错误描述}。请重试或检查 AI 设置。 |
| 工具执行中 | 正在执行... |
| 工具执行成功 | 完成 |
| 工具执行失败 | 失败 — {错误描述} |
| 回到底部按钮 | 新消息 ↓ |
| 消息复制成功提示 | 已复制到剪贴板 |
| 重新生成按钮 | 重新生成 |

**无破坏性操作**: Phase 21 不涉及删除、清空等不可逆操作，无需确认对话框。

---

## 组件清单

### 1. AI 工具栏按钮 (`#aiPanelBtn`)

**位置**: 工具栏右侧 `toolbar-right`，`#settingsBtn` 之后

**结构**:
```html
<button class="btn-icon" id="aiPanelBtn" title="AI 助手 (Cmd+])">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"></path>
    <line x1="9" y1="21" x2="15" y2="21"></line>
    <line x1="10" y1="24" x2="14" y2="24"></line>
  </svg>
</button>
```

**样式**: 复用 `.btn-icon` 现有样式。面板打开时添加 `.active` 类（高亮背景 `--bg-tertiary`）。

### 2. AI 面板容器 (`#aiPanel`)

**位置**: `<body>` 内，`.main-area` 之后（同级兄弟）

**布局**: 右侧固定侧边栏，`display: flex; flex-direction: column;`

**尺寸**:
- 宽度: CSS 变量 `--ai-panel-width`（默认 360px）
- 高度: 100vh
- 边框: 左侧 1px solid var(--border-color)

**主区域联动**: 面板打开时，`.main-area` 宽度收缩（通过 CSS flex 计算，无需 JS 手动设置）。

```css
/* body 布局改为 flex */
body {
  display: flex;
}
/* main-area 占满剩余空间 */
.main-area {
  flex: 1;
  min-width: 0; /* 防止 flex 子项溢出 */
}
```

### 3. 面板头部 (`#aiPanelHeader`)

**高度**: var(--ai-panel-header-height) = 44px

**布局**: `display: flex; align-items: center; justify-content: space-between; padding: 0 16px;`

**内容**:
- 左侧: 标题文字 "AI 助手"（16px, 600, --text-primary）
- 右侧: 设置按钮（齿轮 SVG）+ 关闭按钮（X SVG），均为 `.btn-icon`

### 4. 消息列表 (`#aiMessageList`)

**布局**: `flex: 1; overflow-y: auto; padding: 16px;`

**消息气泡**:
- **用户消息**: 靠右，背景 `--accent-color`，文字 `#ffffff`，圆角 12px（右上角 4px）
- **AI 消息**: 靠左，背景 `--bg-secondary`，文字 `--text-primary`，圆角 12px（左上角 4px）
- **最大宽度**: 85%（防止气泡过宽）
- **内边距**: 10px 14px
- **消息间距**: 16px（垂直）

**消息时间戳**: 显示在气泡下方，12px, --text-muted

### 5. 流式输出指示

**效果**: AI 回复逐字显示，最后位置显示闪烁光标

**光标样式**: 2px 宽、14px 高的竖线，`--accent-color`，`@keyframes blink` 1s 闪烁

**状态指示**: 正在生成时，消息气泡底部显示 "正在输入..." 文字（12px, --text-muted）

### 6. 工具执行卡片 (`#aiToolCard-{n}`)

**位置**: 嵌入在 AI 消息气泡内

**默认状态（折叠）**: 
- 高度: 36px
- 背景: var(--ai-tool-card-bg)
- 圆角: 8px
- 内容: 状态图标 + 工具名称 + 状态文字（"正在执行..." / "完成" / "失败"）
- 图标: 16x16 SVG — 执行中旋转动画、完成绿色勾、失败红色叉

**展开状态**:
- 点击折叠区域展开/收起
- 展开内容: 参数区域（JSON 格式，monospace 12px）+ 结果区域
- 动画: `max-height` 过渡，200ms ease

**多工具**: 纵向堆叠，间距 8px

### 7. 输入区域 (`#aiInputArea`)

**位置**: 面板底部固定

**布局**: `padding: 12px 16px; border-top: 1px solid var(--border-color);`

**输入框**:
- 背景: var(--bg-secondary)
- 圆角: 8px
- 内边距: 10px 14px
- 字体: 14px, --text-primary
- 最小高度: 40px
- 最大高度: 120px（约 5 行后出现滚动条）
- 自动增高: JS 监听 input 事件，根据 scrollHeight 调整

**发送按钮**: 右侧圆形按钮（32x32），SVG 箭头图标，激活态 `--accent-color`，禁用态 `--text-muted`

**键盘交互**:
- Enter: 发送消息
- Shift+Enter: 换行
- 输入为空时发送按钮 disabled

### 8. 回到底部按钮 (`#aiScrollToBottom`)

**位置**: 消息列表右下角悬浮

**触发条件**: 用户向上滚动超过 100px + 有新消息到达

**样式**: 
- 圆角按钮，背景 `--bg-tertiary`，边框 `--border-color`
- 内容: "新消息 ↓" 文字（12px）
- 点击后平滑滚动到底部

### 9. 面板拖拽调整手柄

**位置**: 面板左边缘，宽度 6px

**交互**:
- 鼠标悬停: 光标变为 `col-resize`
- 拖拽: 实时调整面板宽度
- 限制: 最小 280px，最大 600px
- 释放: 持久化宽度到 electron-store

---

## 动画与过渡

| 元素 | 属性 | 值 |
|------|------|-----|
| 面板打开/关闭 | width + opacity | 250ms ease-in-out |
| 消息气泡入场 | opacity + translateY | 200ms ease（从 8px 下方淡入） |
| 工具卡片展开 | max-height | 200ms ease |
| 流式光标 | opacity | 1s infinite blink |
| 拖拽调整手柄 | background-color | 150ms ease（悬停高亮） |
| 发送按钮 | color | 150ms ease（激活/禁用切换） |

---

## 快捷键

| 快捷键 | 动作 | 注册位置 |
|--------|------|---------|
| Cmd/Ctrl + ] | 切换 AI 面板开/关 | shortcut-manager.js: DEFAULT_SHORTCUTS |
| Enter | 发送消息（输入框聚焦时） | renderer.js: keydown 事件 |
| Shift + Enter | 换行（输入框聚焦时） | renderer.js: keydown 事件 |
| Escape | 关闭 AI 面板（面板打开时） | renderer.js: keydown 事件 |

---

## 集成点

### HTML (`src/index.html`)

在 `<body>` 末尾、`<script>` 之前添加：
- `#aiPanel` 容器（侧边栏面板）
- `#aiPanelBtn` 工具栏按钮（在 `#settingsBtn` 之后）

### CSS (`src/styles/main.css`)

新增约 200 行 AI 面板样式，使用 `:root` 新增的 AI 专用 CSS 变量。

### JS (`src/renderer.js`)

新增约 300-400 行逻辑：
- AI 面板开关控制（toggleAIPanel）
- 消息列表渲染（renderAIMessages）
- 流式消息处理（handleAIStream）
- 工具卡片渲染（renderToolCard）
- 输入框交互（发送、自动增高、快捷键）
- 智能滚动控制
- 拖拽调整宽度

### 快捷键 (`shortcut-manager.js`)

在 `DEFAULT_SHORTCUTS` 添加：
```javascript
'toggleAIPanel': 'CmdOrCtrl+]'
```

### Preload (`src/preload.js`)

无需修改 — AI API 已在 Phase 20 注册完成。

---

## Checker 签收

- [ ] 维度 1 文案: PASS
- [ ] 维度 2 视觉: PASS
- [ ] 维度 3 颜色: PASS
- [ ] 维度 4 排版: PASS
- [ ] 维度 5 间距: PASS
- [ ] 维度 6 注册表安全: PASS（不适用，无 shadcn）

**审批状态**: pending

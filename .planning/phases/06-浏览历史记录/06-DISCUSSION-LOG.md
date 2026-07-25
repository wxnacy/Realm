# Phase 6: 浏览历史记录 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 6-浏览历史记录
**Areas discussed:** UI 入口, 列表样式, 搜索范围, 数据存储, 删除行为, 面板行为, 自动清理

---

## UI 入口

| Option | Description | Selected |
|--------|-------------|----------|
| 工具栏专用按钮（推荐） | 在工具栏添加一个时钟/历史图标按钮，点击打开历史面板，与容器下拉面板交互模式一致 | ✓ |
| 工具栏下拉菜单项 | 在现有容器下拉面板中添加"历史记录"入口，复用现有 UI | |
| 快捷键 + 菜单 | 通过快捷键（如 Cmd+Y）或应用菜单打开历史窗口 | |

**User's choice:** 工具栏专用按钮（推荐）
**Notes:** 无

---

## 列表样式

| Option | Description | Selected |
|--------|-------------|----------|
| 按日期分组 + 紧凑列表（推荐） | 按"今天"、"昨天"、"本周"等分组，每条显示 favicon + 标题 + URL + 时间，类似 Chrome 历史 | ✓ |
| 纯列表 + 无限滚动 | 不按日期分组，直接按时间倒序展示，滚动加载更多 | |
| 卡片式布局 | 每条历史记录用卡片展示，显示页面预览缩略图（需要额外截图逻辑） | |

**User's choice:** 按日期分组 + 紧凑列表（推荐）
**Notes:** 无

---

## 搜索范围

| Option | Description | Selected |
|--------|-------------|----------|
| 标题 + URL（推荐） | 同时搜索页面标题和 URL，输入关键词后实时过滤，结果高亮匹配文本 | ✓ |
| 仅标题 | 只搜索页面标题，更简单但可能漏掉用户记住 URL 但忘记标题的情况 | |
| 标题 + URL + 域名筛选 | 除了关键词搜索，还支持按域名筛选（如只看 github.com 的记录） | |

**User's choice:** 标题 + URL（推荐）
**Notes:** 无

---

## 数据存储

| Option | Description | Selected |
|--------|-------------|----------|
| electron-store 分容器存储（推荐） | 复用项目已有的 electron-store 依赖，按容器分文件存储 JSON，实现最简单，每容器一个文件 | |
| SQLite 数据库 | 使用 better-sqlite3 等 SQLite 方案，适合大数据量查询和搜索，但增加依赖和复杂度 | ✓ |
| 独立 JSON 文件 | 类似 Cookie 持久化的方案，按容器写 JSON 文件，手动管理读写 | |

**User's choice:** SQLite 数据库
**Notes:** 无

---

## 删除行为

| Option | Description | Selected |
|--------|-------------|----------|
| 鼠标悬停显示删除图标（推荐） | 在每条历史记录右侧显示删除图标，点击后直接删除，无需确认（Chrome 行为） | |
| 右键上下文菜单 | 点击历史记录弹出操作菜单，选择删除或打开等操作 | |
| 多选 + 批量删除 | 每条记录前面有复选框，支持勾选后批量删除 | |

**User's choice:** 用户自定义 — "单个和多选批量删除都要支持"
**Notes:** 用户要求同时支持单个删除（悬停图标）和多选批量删除（复选框）

---

## 面板行为

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle 弹出面板（推荐） | 点击工具栏历史按钮打开，点击面板外部或再次点击按钮关闭，类似容器下拉面板 | |
| 侧边栏 | 从右侧滑入的侧边栏，不遮挡页面内容，常驻显示直到手动关闭 | |
| 内部页面 | 在当前 Tab 内打开一个内部页面（如 realm://history），类似 Chrome 的 chrome://history | ✓ |

**User's choice:** 内部页面
**Notes:** 用户选择使用内部页面方式（类似 chrome://history），而非弹出面板

---

## 自动清理

| Option | Description | Selected |
|--------|-------------|----------|
| 静默 FIFO 淘汰（推荐） | 每容器超过 10000 条时自动淘汰最旧记录，用户无感知 | ✓ |
| 提示用户确认 | 超过上限时提示用户，让用户选择手动清理或自动淘汰 | |
| 数量上限 + 天数双重策略 | 除数量上限外，同时支持按天数自动清理（如 90 天前的记录） | |

**User's choice:** 静默 FIFO 淘汰（推荐）
**Notes:** 无

---

## Claude's Discretion

以下方面由 Claude 自行决定：
- SQLite 数据库的表结构设计
- 具体的 SQL 查询优化策略
- favicon 的获取和缓存策略
- 历史记录页面的 CSS 样式细节
- 分页/虚拟滚动的具体实现方式
- 历史记录页面的 HTML 结构

## Deferred Ideas

None — discussion stayed within phase scope

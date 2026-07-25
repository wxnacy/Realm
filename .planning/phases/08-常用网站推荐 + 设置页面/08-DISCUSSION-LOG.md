# Phase 8: 常用网站推荐 + 设置页面 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 8-常用网站推荐 + 设置页面
**Areas discussed:** frecency 算法设计, 新标签页 UI 布局, 设置页面功能, 容器过滤逻辑

---

## frecency 算法设计

### 核心计算方式

| Option | Description | Selected |
|--------|-------------|----------|
| 加权公式法 | frequency * recency_weight，频率越高、访问越近的网站得分越高。简单有效。 | ✓ |
| Mozilla Frecency | Mozilla 的 frecency 算法，考虑访问类型（书签、直接输入、链接点击）等因素。更精确但复杂。 | |
| Claude 决定 | 让我决定具体的算法实现细节。 | |

**User's choice:** 加权公式法
**Notes:** 用户选择了简单有效的加权公式法

### 数据来源

| Option | Description | Selected |
|--------|-------------|----------|
| 历史记录表（推荐） | 直接查询 history 表，按域名聚合计算 frecency。简单直接。 | ✓ |
| 独立缓存表 | 新建 frequent_sites 表，定时从历史记录计算并缓存。查询更快但需要维护同步。 | |

**User's choice:** 历史记录表（推荐）
**Notes:** 用户选择了直接查询历史记录表

### 域名聚合

| Option | Description | Selected |
|--------|-------------|----------|
| 单页面代表（推荐） | 只显示域名，点击后跳转到该域名下最常访问的页面。简单清晰。 | ✓ |
| 多页面展开 | 同一域名显示多个页面，按 frecency 排序。信息更全但可能重复。 | |

**User's choice:** 单页面代表（推荐）
**Notes:** 用户选择了单页面代表模式

### 更新频率

| Option | Description | Selected |
|--------|-------------|----------|
| 实时计算（推荐） | 每次打开新标签页时实时计算。数据最新但可能有延迟。 | ✓ |
| 定时缓存 | 定时（如每小时）计算并缓存结果。响应快但数据可能滞后。 | |

**User's choice:** 实时计算（推荐）
**Notes:** 用户最初选择了定时缓存，后来重新回答选择了实时计算

---

## 新标签页 UI 布局

### 网格布局

| Option | Description | Selected |
|--------|-------------|----------|
| 6×2 网格（推荐） | 6 列 × 2 行 = 12 个网站卡片。Chrome 风格，紧凑实用。 | ✓ |
| 4×3 网格 | 4 列 × 3 行 = 12 个网站卡片。卡片更大，显示更多信息。 | |
| 响应式网格 | 响应式布局，根据窗口宽度自动调整列数。灵活但实现复杂。 | |

**User's choice:** 6×2 网格（推荐）
**Notes:** 用户选择了 Chrome 风格的 6×2 网格

### 卡片设计

| Option | Description | Selected |
|--------|-------------|----------|
| 图标 + 标题（推荐） | 圆形 favicon + 网站标题。简洁清爽，Chrome 风格。 | ✓ |
| 图标 + 标题 + URL | 圆形 favicon + 网站标题 + URL 预览。信息更全但卡片更大。 | |

**User's choice:** 图标 + 标题（推荐）
**Notes:** 用户选择了简洁的图标 + 标题设计

### 空状态

| Option | Description | Selected |
|--------|-------------|----------|
| 引导提示（推荐） | 显示友好的提示文字和插图，引导用户开始浏览。 | ✓ |
| 预设网站 | 显示一些预设的热门网站作为起点。 | |

**User's choice:** 引导提示（推荐）
**Notes:** 用户选择了友好的引导提示

### favicon 获取

| Option | Description | Selected |
|--------|-------------|----------|
| Google 服务（推荐） | 通过 Google Favicon 服务获取，简单可靠。 | ✓ |
| 网站根目录 | 通过网站根目录 /favicon.ico 获取，兼容性好。 | |

**User's choice:** Google 服务（推荐）
**Notes:** 用户选择了 Google Favicon 服务

---

## 设置页面功能

### 设置入口

| Option | Description | Selected |
|--------|-------------|----------|
| 工具栏齿轮图标（推荐） | 在工具栏右侧添加齿轮图标，点击后在当前 Tab 打开 realm://settings。 | ✓ |
| 容器面板入口 | 在容器下拉面板底部添加设置入口。 | |

**User's choice:** 工具栏齿轮图标（推荐）
**Notes:** 用户选择了工具栏齿轮图标

### 默认浏览器引导

| Option | Description | Selected |
|--------|-------------|----------|
| 检测 + 引导（推荐） | 检测是否为默认浏览器，显示引导按钮，点击后调用系统 API 设置。 | ✓ |
| 仅说明文字 | 仅显示说明文字，告诉用户如何在系统偏好设置中手动配置。 | |

**User's choice:** 检测 + 引导（推荐）
**Notes:** 用户选择了检测 + 引导模式

### 历史记录保留天数

| Option | Description | Selected |
|--------|-------------|----------|
| 可配置（推荐） | 默认 30 天，用户可选择 7/14/30/60/90 天或永不删除。 | ✓ |
| 固定 30 天 | 固定 30 天，不可更改。简单但不灵活。 | |

**User's choice:** 可配置（推荐）
**Notes:** 用户选择了可配置选项

### 默认容器设置

| Option | Description | Selected |
|--------|-------------|----------|
| 默认容器设置（推荐） | 设置默认容器，外部链接自动在该容器打开。 | |
| 每次询问 | 每次打开外部链接时询问用户选择容器。 | |

**User's choice:** 自定义
**Notes:** 用户选择：默认使用"默认"容器，但是设置中可以指定容器或者使用最后打开的容器打开

---

## 容器过滤逻辑

### 过滤实现

| Option | Description | Selected |
|--------|-------------|----------|
| 自动过滤（推荐） | 新标签页自动显示当前容器的常用网站，无需手动切换。简单直接。 | |
| 全部显示 + 颜色区分 | 显示所有容器的常用网站，但用颜色区分容器来源。信息更全但可能混乱。 | |

**User's choice:** 自定义
**Notes:** 用户选择：这个功能，展示时不区分容器，使用所有容器的记录共同计算

### 容器策略确认

| Option | Description | Selected |
|--------|-------------|----------|
| 全部合并（你的选择） | 合并所有容器的历史记录计算常用网站。实现简单，但不同容器看到相同推荐。 | ✓ |
| 按容器隔离 | 每个容器只显示自己的常用网站。实现需要修改 SQL 查询，但更符合容器隔离理念。 | |

**User's choice:** 全部合并（你的选择）
**Notes:** 用户确认了全部合并的选择

---

## Claude's Discretion

- SQLite 查询优化策略
- 设置页面的 CSS 样式细节
- realm://settings 协议的路由处理
- 历史记录保留天数配置的定时清理逻辑
- favicon 获取失败时的降级策略

## Deferred Ideas

None — discussion stayed within phase scope

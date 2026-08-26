# Phase 37: 地址栏地址补全功能 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 37-地址栏地址补全功能
**Areas discussed:** 数据源, 匹配算法, 条目内容, 内联补全, 候选数量, 键盘导航, 查询位置, 容器范围, 防抖策略, 候选点击, 样式参考

---

## 数据源

| Option | Description | Selected |
|--------|-------------|----------|
| 历史记录 + 收藏夹 + 常用网站 | Chrome 行为，综合三个数据源，收藏夹优先级最高 | ✓ |
| 仅历史记录 + 收藏夹 | 不包含 frecency 常用网站，数据更精准但覆盖面窄 | |
| 仅历史记录 | 最简单的实现，但收藏夹不会出现在补全中 | |

**User's choice:** 历史记录 + 收藏夹 + 常用网站（推荐）
**Notes:** 无

---

## 匹配算法

| Option | Description | Selected |
|--------|-------------|----------|
| URL 前缀 + 标题子串 | 输入 'git' 匹配 github.com 和标题含 'Git' 的页面，类似 Chrome | ✓ |
| URL 子串 + 标题子串 | 更宽松，输入 'hub' 也能匹配 github.com | |
| 仅 URL 前缀匹配 | 最严格，只匹配 URL 开头 | |

**User's choice:** URL 前缀 + 标题子串（推荐）
**Notes:** 无

---

## 条目内容

| Option | Description | Selected |
|--------|-------------|----------|
| Favicon + 标题 + URL | Chrome 样式，信息最完整，标题在上 URL 在下 | ✓ |
| Favicon + URL | 更紧凑，省略标题 | |
| Favicon + 标题 | 更简洁，URL 可通过 inline completion 看到 | |

**User's choice:** Favicon + 标题 + URL（推荐）
**Notes:** 无

---

## 内联补全

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome 行为 | 输入 'gith' 时，地址栏显示 'gith' + 高亮选中的 'ub.com'，按 Tab/Right 接受补全 | ✓ |
| 仅下拉列表 | 不做内联补全，只显示下拉列表让用户选择 | |
| 直接补全 | 输入后直接补全全部文字，用户继续输入覆盖 | |

**User's choice:** Chrome 行为（推荐）
**Notes:** 无

---

## 候选数量

| Option | Description | Selected |
|--------|-------------|----------|
| 最多 6 条 | Chrome 默认约 6 条，足够覆盖主要场景 | ✓ |
| 最多 10 条 | 更多选项但占用更多屏幕空间 | |
| 可配置数量 | 用户可配置数量 | |

**User's choice:** 最多 6 条（推荐）
**Notes:** 无

---

## 键盘导航

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome 行为 | 上下键选择高亮条目，Enter 跳转，Tab 接受 inline 补全，Esc 关闭 | ✓ |
| 简化版 | 上下键选择，Enter 跳转，无 Tab 接受功能 | |

**User's choice:** Chrome 行为（推荐）
**Notes:** 无

---

## 查询位置

| Option | Description | Selected |
|--------|-------------|----------|
| 主进程查询 | 渲染进程通过 IPC 请求主进程查询，主进程返回结果。符合现有架构 | ✓ |
| HTTP API 查询 | 渲染进程直接查询本地 HTTP API 端点，类似 realm:// 页面 | |

**User's choice:** 主进程查询（推荐）
**Notes:** 无

---

## 容器范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全部合并 | 收藏夹全局共享，历史记录和常用网站合并所有容器 | ✓ |
| 与新标签页一致 | 收藏夹全局共享，历史记录按当前容器隔离，常用网站合并所有容器 | |
| 全部隔离 | 所有数据源都按当前容器隔离 | |

**User's choice:** 全部合并
**Notes:** 用户选择全部合并，补全范围最大化

---

## 防抖策略

| Option | Description | Selected |
|--------|-------------|----------|
| 100ms 防抖 | 每次按键后延迟 100ms 查询，平衡实时性和性能 | ✓ |
| 无防抖 | 每次按键立即查询，最实时但可能有性能问题 | |
| 200ms 防抖 | 延迟 200ms 查询，更节省资源 | |

**User's choice:** 100ms 防抖（推荐）
**Notes:** 无

---

## 候选点击

| Option | Description | Selected |
|--------|-------------|----------|
| 当前 Tab 导航 | 点击候选后在当前 Tab 导航到该 URL | ✓ |
| 新 Tab 打开 | 点击候选后在新 Tab 中打开 | |
| 两种都支持 | 左键当前 Tab，Cmd+点击新 Tab | |

**User's choice:** 当前 Tab 导航（推荐）
**Notes:** 无

---

## 样式参考

| Option | Description | Selected |
|--------|-------------|----------|
| 与现有深色主题一致 | 深色背景、圆角、阴影、与现有工具栏风格一致 | ✓ |
| 独立设计 | 独立设计样式，不依赖现有主题变量 | |

**User's choice:** 与现有深色主题一致（推荐）
**Notes:** 无

---

## Claude's Discretion

- 下拉列表的具体动画效果（展开/收起）
- 条目 hover 高亮的具体样式
- 无匹配结果时的提示文案
- favicon 缺失时的默认图标

## Deferred Ideas

None — discussion stayed within phase scope

# Phase 30: 下载管理器 — 核心引擎 - Discussion Log

**Date:** 2026-08-11
**Duration:** ~15 minutes

## Areas Discussed

### 1. 保存对话框行为

**Question 1:** 点击下载链接时，应该使用哪种类型的保存对话框？
- Options: 系统原生对话框（推荐） / 自定义对话框
- **User's choice:** 系统原生对话框（推荐）

**Question 2:** 默认保存位置如何确定？
- Options: 每次都询问 / 默认 ~/Downloads，可配置（推荐） / 按容器隔离下载目录
- **User's choice:** 默认 ~/Downloads，可配置（推荐）

**Question 3:** 是否需要"始终保存到此目录"选项？
- Options: 每次都询问（推荐） / 支持"始终保存到此目录" / 首次询问，之后自动保存
- **User's choice:** 支持"始终保存到此目录"

**Question 4:** 当保存位置已存在同名文件时如何处理？
- Options: 自动重命名（推荐） / 询问用户 / 静默覆盖
- **User's choice:** 自动重命名（推荐）

### 2. 进度条展示形式

**Question 1:** 下载进行时，进度条应该显示在哪里？
- Options: 工具栏内嵌进度条（推荐） / 独立下载面板 / 浮动通知 / 侧边栏下载列表
- **User's choice:** 跟 Chrome 一样，工具栏增加一个下载按钮，进度在按钮上使用圆圈的进度条，后续点击后可以打开下载列表

**Question 2:** 进度条需要显示哪些信息？
- Options: 简洁模式（推荐） / 显示文件名和速度 / 显示完整信息
- **User's choice:** 简洁模式（推荐）

**Question 3:** 下载完成后如何通知用户？
- Options: 图标变化（推荐） / 系统通知 / 短暂闪烁 / 无提示
- **User's choice:** 图标变化（推荐）

**Question 4:** 多个同时下载时如何显示？
- Options: 数字徽标（推荐） / 总进度条 / 多个进度条 / 只显示最近下载
- **User's choice:** 数字徽标（推荐）

### 3. SQLite 表结构设计

**Question 1:** 下载记录应该如何存储以实现容器隔离？
- Options: 单表 + container_id 列（推荐） / 每容器独立表 / JSON 字段存储容器信息
- **User's choice:** 单表 + container_id 列（推荐）

**Question 2:** 下载记录需要存储哪些字段？
- Options: 完整字段（推荐） / 最小字段 / 扩展字段
- **User's choice:** 扩展字段

**Question 3:** 需要记录哪些下载状态？
- Options: 基本状态（推荐） / 扩展状态 / 简化状态
- **User's choice:** 扩展状态

**Question 4:** 下载记录如何清理？
- Options: 永久保留（推荐） / 30 天自动清理 / 按数量限制 / 用户可配置
- **User's choice:** 永久保留（推荐）

### 4. 工具栏徽标交互

**Question 1:** 点击下载按钮应该发生什么？
- Options: 打开下载面板（推荐） / 下拉菜单 / 打开下载文件夹 / 显示工具提示
- **User's choice:** 打开下载面板（推荐）

**Question 2:** 有活跃下载时，徽标应该显示什么？
- Options: 数字徽标（推荐） / 进度百分比 / 下载箭头图标 / 小型进度条
- **User's choice:** 数字徽标（推荐）

**Question 3:** 没有下载历史时，下载按钮应该如何显示？
- Options: 始终显示（推荐） / 没有历史时隐藏 / 禁用状态
- **User's choice:** 始终显示（推荐）

**Question 4:** 下载按钮应该放在工具栏的什么位置？
- Options: URL 输入框右侧（推荐） / 窗口左上角 / 窗口右上角 / 侧边栏底部
- **User's choice:** URL 输入框右侧（推荐）

## Key Decisions Summary

1. **保存对话框**: 系统原生对话框，默认 ~/Downloads，支持"始终保存到此目录"，文件名冲突自动重命名
2. **进度条**: 工具栏下载按钮圆圈进度条，简洁模式，完成时图标变化，多个下载显示数字徽标
3. **SQLite**: 单表 + container_id 列，扩展字段（含 MIME 类型、来源网页、速度历史），扩展状态，永久保留
4. **徽标交互**: 点击打开下载面板，数字徽标，始终显示，放在 URL 输入框右侧

## Deferred Ideas

None — all discussion stayed within phase scope.

---

*Discussion completed: 2026-08-11*

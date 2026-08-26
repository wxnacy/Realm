# Phase 31: 下载管理器 — 用户交互 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 31-下载管理器 — 用户交互
**Areas discussed:** 下载面板 UI 形态, 下载列表项展示, 暂停/恢复交互模式, 删除行为设计

---

## 下载面板 UI 形态

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome 风格下拉面板 | 点击工具栏按钮弹出下拉面板，轻量快速 | |
| 侧边栏/浮动面板 | 类似媒体面板的浮动层，常驻可见 | |
| 独立 realm:// 页面 | 类似 realm://history 的独立页面，功能最全 | |

**User's choice:** 混合模式：Chrome 风格下拉面板 + 底部"查看全部"按钮跳转 realm://downloads 独立页面
**Notes:** 用户明确要求两层结构——下拉面板快速预览 + 独立页面完整管理

| Option | Description | Selected |
|--------|-------------|----------|
| 最近 N 条（Chrome 模式） | 下拉面板只显示最近几条，完整列表在独立页面 | ✓ |
| 全部记录（可滚动） | 下拉面板内显示所有记录 | |

**User's choice:** 最近 N 条（Chrome 模式）
**Notes:** 与 Chrome 行为一致

| Option | Description | Selected |
|--------|-------------|----------|
| 显示空状态提示 | 无记录时显示"暂无下载记录" | ✓ |
| 无历史时隐藏下载按钮 | 有下载历史时才显示按钮 | |

**User's choice:** 显示空状态提示

| Option | Description | Selected |
|--------|-------------|----------|
| 点击切换 | 点击按钮弹出/关闭面板 | ✓ |
| 有下载时自动弹出 | 仅活跃下载时自动弹出 | |

**User's choice:** 点击切换

| Option | Description | Selected |
|--------|-------------|----------|
| 当前容器 | 只显示当前容器的下载 | |
| 所有容器 | 显示所有容器的下载记录 | ✓ |

**User's choice:** 显示所有容器的下载记录
**Notes:** 用户选择全局视图，下载记录本身仍按容器存储

---

## 下载列表项展示

| Option | Description | Selected |
|--------|-------------|----------|
| 简洁模式 | 文件名 + 文件大小 + 下载时间 | ✓ |
| 详细模式 | 文件名 + 大小 + 速度 + 来源 URL + 时间 + 状态 | |
| 分层展示 | 下拉面板简洁，独立页面详细 | |

**User's choice:** 简洁模式

| Option | Description | Selected |
|--------|-------------|----------|
| 内联图标按钮 | hover 时显示打开/Finder/删除按钮 | ✓ |
| 右键上下文菜单 | 右键弹出菜单 | |
| Hover 展开 | hover 时展开操作区 | |

**User's choice:** 内联图标按钮

| Option | Description | Selected |
|--------|-------------|----------|
| 置顶 + 进度条 | 进行中的下载置顶，带进度条 | ✓ |
| 混合排列 | 按时间倒序，进行中的混在历史中 | |

**User's choice:** 置顶 + 进度条

| Option | Description | Selected |
|--------|-------------|----------|
| 显示文件类型图标 | PDF、图片、视频等不同图标 | ✓ |
| 统一下载图标 | 所有记录用同一图标 | |

**User's choice:** 显示文件类型图标

| Option | Description | Selected |
|--------|-------------|----------|
| 视觉区分状态 | 完成正常，失败/中断用红/灰色 | ✓ |
| 统一外观 | 所有记录不区分状态 | |

**User's choice:** 视觉区分状态

---

## 暂停/恢复交互模式

| Option | Description | Selected |
|--------|-------------|----------|
| 内联暂停/恢复按钮 | 进行中的下载右侧直接显示 | ✓ |
| 右键菜单 | 右键弹出菜单操作 | |

**User's choice:** 内联暂停/恢复按钮

| Option | Description | Selected |
|--------|-------------|----------|
| 静默重新下载 | 不支持恢复时静默从头下载 | ✓ |
| 提示用户后重新下载 | 弹窗告知后重新下载 | |
| 禁用恢复按钮 | 按钮变灰，hover 提示原因 | |

**User's choice:** 静默重新下载

| Option | Description | Selected |
|--------|-------------|----------|
| 显示恢复按钮 | 中断的下载显示恢复按钮 | ✓ |
| 视为失败 | 中断的下载不可恢复 | |

**User's choice:** 显示恢复按钮

| Option | Description | Selected |
|--------|-------------|----------|
| 单条操作 | 只能逐条暂停/恢复 | |
| 支持批量操作 | 面板顶部有全部暂停/恢复按钮 | ✓ |

**User's choice:** 单条和批量都支持
**Notes:** 用户明确要求两种模式都支持

---

## 删除行为设计

| Option | Description | Selected |
|--------|-------------|----------|
| 仅删记录 | 只删 SQLite 记录，文件保留 | |
| 弹窗让用户选择 | 用户选择「仅删记录」或「同时删文件」 | ✓ |
| 直接删除记录+文件 | 不确认直接删除 | |

**User's choice:** 弹窗让用户选择

| Option | Description | Selected |
|--------|-------------|----------|
| 有清空按钮 + 确认弹窗 | 面板底部清空按钮，点击二次确认 | ✓ |
| 不提供清空功能 | 只能逐条删除 | |

**User's choice:** 有清空按钮 + 确认弹窗

| Option | Description | Selected |
|--------|-------------|----------|
| 确认后取消+删除 | 弹窗确认后取消下载并删除记录 | ✓ |
| 禁止删除进行中的下载 | 按钮变灰 | |

**User's choice:** 确认后取消+删除

| Option | Description | Selected |
|--------|-------------|----------|
| 支持多选批量删除 | Cmd+点击 或 复选框多选 | ✓ |
| 逐条删除 + 清空 | 只能逐条 + 一键清空 | |

**User's choice:** 支持多选批量删除

---

## Claude's Discretion

无 — 用户对所有问题都做出了明确选择。

## Deferred Ideas

无 — 讨论保持在 Phase 31 范围内。

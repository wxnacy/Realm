# Phase 13: 右键菜单增强 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 13-右键菜单增强
**Areas discussed:** 菜单实现、菜单位置、上下文检测、菜单样式、菜单内容、菜单交互

---

## 菜单实现

| Option | Description | Selected |
|--------|-------------|----------|
| Electron Menu API | 使用 Electron 原生 Menu API，系统级菜单，性能好，但样式受限 | ✓ |
| HTML 自定义菜单 | 使用 HTML/CSS 自定义菜单，样式完全可控，但需要更多实现工作 | |

**User's choice:** Electron Menu API (推荐)

---

## 菜单位置

| Option | Description | Selected |
|--------|-------------|----------|
| 主进程统一管理 | 所有菜单逻辑集中在 main.js 中，通过 IPC 接收右键事件 | ✓ |
| 混合模式 | 标签页菜单在主进程，网页内容菜单在渲染进程 | |

**User's choice:** 主进程统一管理 (推荐)

---

## 上下文检测

| Option | Description | Selected |
|--------|-------------|----------|
| webview context-menu 事件 | 通过 webview 的 context-menu 事件获取右键上下文信息 | ✓ |
| 注入 JS 检测 | 在 webview 中注入 JS 代码，监听右键事件并上报 | |

**User's choice:** webview context-menu 事件

---

## 菜单样式

| Option | Description | Selected |
|--------|-------------|----------|
| 系统原生样式 | 跟随系统原生菜单样式，与 macOS/Windows 风格一致 | ✓ |
| 应用主题样式 | 自定义深色主题菜单，与应用现有 UI 风格一致 | |

**User's choice:** 系统原生样式

---

## 标签页菜单内容

| Option | Description | Selected |
|--------|-------------|----------|
| 关闭标签页 | 关闭当前标签页 | ✓ |
| 关闭其他标签页 | 关闭除当前标签页外的所有标签页 | ✓ |
| 关闭右侧标签页 | 关闭当前标签页右侧的所有标签页 | ✓ |
| 关闭左侧标签页 | 关闭当前标签页左侧的所有标签页 | ✓ |
| 重新打开已关闭标签页 | 重新打开最近关闭的标签页 | ✓ |
| 固定标签页 | 固定标签页，变窄并始终显示在左侧 | ✓ |

**User's choice:** 全部选择

---

## 链接菜单内容

| Option | Description | Selected |
|--------|-------------|----------|
| 在新标签页中打开 | 在新标签页中打开链接 | ✓ |
| 在新容器标签页中打开 | 在新容器标签页中打开链接（子菜单选择容器） | ✓ |
| 复制链接地址 | 复制链接地址到剪贴板 | ✓ |
| 在后台标签页中打开 | 在新标签页中打开链接，但不切换到该标签页 | ✓ |

**User's choice:** 全部选择

---

## 图片菜单内容

| Option | Description | Selected |
|--------|-------------|----------|
| 在新标签页中打开图片 | 在新标签页中打开图片 | ✓ |
| 将图片另存为 | 将图片保存到本地（系统文件保存对话框） | ✓ |
| 复制图片 | 复制图片本身到剪贴板 | ✓ |
| 复制图片地址 | 复制图片地址到剪贴板 | ✓ |

**User's choice:** 全部选择

---

## 通用菜单内容

| Option | Description | Selected |
|--------|-------------|----------|
| 导航操作 | 后退、前进、刷新、停止加载 | ✓ |
| 页面操作 | 另存为、打印、添加到收藏夹 | ✓ |
| 开发者工具 | 检查元素、查看页面源代码 | ✓ |
| 文本操作 | 全选、复制、粘贴、剪切 | ✓ |

**User's choice:** 全部选择

---

## 容器选择器

| Option | Description | Selected |
|--------|-------------|----------|
| 弹出容器选择器 | 弹出容器选择器模态框，显示所有容器列表 | |
| 菜单中列出容器 | 在菜单中直接列出所有容器选项 | |
| 子菜单显示容器 | 使用子菜单显示容器列表 | ✓ |

**User's choice:** 子菜单显示容器

---

## DevTools 实现

| Option | Description | Selected |
|--------|-------------|----------|
| 打开 Electron DevTools | 直接打开 Electron DevTools（最简单） | |
| 打开 Chrome DevTools | 打开 Chrome DevTools（需要额外配置） | ✓ |

**User's choice:** 打开 Chrome DevTools

---

## 剪贴板反馈

| Option | Description | Selected |
|--------|-------------|----------|
| 显示 toast 提示 | 复制后显示简短的 toast 提示"已复制" | ✓ |
| 静默复制 | 不显示任何提示，静默复制 | |

**User's choice:** 显示 toast 提示

---

## 菜单顺序

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome 顺序 | 完全按照 Chrome 浏览器的菜单顺序 | ✓ |
| 自定义顺序 | 自定义顺序，将常用功能放在前面 | |

**User's choice:** Chrome 顺序

---

## 其他决策

| 决策 | 选择 |
|------|------|
| 菜单项显示图标 | 是 |
| 菜单项显示快捷键 | 是 |
| 使用分隔线分组 | 是 |
| 禁用项灰色显示 | 是 |
| 菜单位置 | 鼠标点击位置 |
| 菜单大小 | 系统默认 |
| 菜单动画 | 系统默认 |
| 点击后关闭 | 是 |
| 显示反馈 | 是 |
| 立即显示 | 是 |

---

## Claude's Discretion

- 菜单项的具体图标选择
- toast 提示的具体样式和位置
- 子菜单容器选择器的具体交互细节
- 查看源代码页面的具体实现方式

## Deferred Ideas

None — discussion stayed within phase scope

# Phase 17: Chrome 书签导入 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 17-Chrome 书签导入
**Areas discussed:** Import entry, Detection, Root folders, Duplicate, Import target, Progress UI, Favicon, HTML preview, Button style, Result detail

---

## Import entry

| Option | Description | Selected |
|--------|-------------|----------|
| 收藏夹页面按钮（推荐） | 在收藏夹页面 (realm://favorites) 的顶部工具栏或右键菜单添加「导入书签」按钮，与收藏管理场景最贴合 | ✓ |
| 设置页面 | 在设置页面添加「导入书签」功能，类似 Chrome 的书签管理器设置入口 | |
| 两处都有 | 收藏夹页面和设置页面都提供入口，方便不同场景访问 | |

**User's choice:** 收藏夹页面按钮（推荐）
**Notes:** 与收藏管理场景最贴合

---

## Detection

| Option | Description | Selected |
|--------|-------------|----------|
| 自动检测 + 手动可选（推荐） | 优先自动读取 Chrome 默认路径，找不到时提示用户手动选择文件，覆盖多 Profile 或自定义路径场景 | ✓ |
| 纯自动检测 | 只读取 Chrome 默认路径，找不到就报错提示，简单但不灵活 | |
| 纯手动选择 | 每次都让用户选择文件，灵活但多一步操作 | |

**User's choice:** 自动检测 + 手动可选（推荐）
**Notes:** 覆盖多 Profile 或自定义路径场景

---

## Root folders

| Option | Description | Selected |
|--------|-------------|----------|
| 全部导入为子文件夹（推荐） | 在 Realm 根目录创建「Chrome 书签栏」「Chrome 其他」「Chrome 已同步」三个文件夹，保留原始结构 | ✓ |
| 只导入 bookmark_bar | 只导入书签栏内容，忽略 other 和 synced，简洁但可能丢失数据 | |
| 合并到根目录 | 所有书签直接放到 Realm 根目录，不保留 Chrome 的分组结构 | |

**User's choice:** 全部导入为子文件夹（推荐）
**Notes:** 保留原始结构

---

## Duplicate

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过重复（推荐） | 已有相同 URL 的收藏项不导入，显示跳过数量，保护现有数据 | ✓ |
| 允许重复 | 相同 URL 的收藏项会创建多个（保留不同标题的版本） | |
| 逐个确认 | 弹窗让用户逐个选择：跳过还是导入 | |

**User's choice:** 跳过重复（推荐）
**Notes:** 保护现有数据

---

## Import target

| Option | Description | Selected |
|--------|-------------|----------|
| 当前文件夹（推荐） | 导入到当前打开的文件夹，让用户选择放哪里 | |
| 固定根目录 | 始终导入到根目录，简单但可能混乱 | |
| 保留原始结构 | 保留 Chrome 原始结构，导入到对应层级的文件夹中 | ✓ |

**User's choice:** 保留原始结构
**Notes:** 按 Chrome 书签的原始文件夹层级导入

---

## Progress UI

| Option | Description | Selected |
|--------|-------------|----------|
| 模态进度框（推荐） | 弹出模态框显示进度条、已导入/总数、当前文件名 | ✓ |
| 顶部进度条 | 在收藏夹页面顶部显示进度条，不阻塞其他操作 | |
| 静默导入 + 结果摘要 | 导入过程不显示进度，完成后弹窗显示结果摘要 | |

**User's choice:** 模态进度框（推荐）
**Notes:** 阻塞交互，防止重复触发导入

---

## Favicon

| Option | Description | Selected |
|--------|-------------|----------|
| 获取 favicon（推荐） | 导入时为每个书签异步获取 favicon 并存入数据库，显示更完整 | ✓ |
| 跳过 favicon | 不获取 favicon，导入更快但书签没有图标 | |

**User's choice:** 获取 favicon（推荐）
**Notes:** 异步获取，不阻塞导入流程

---

## HTML preview

| Option | Description | Selected |
|--------|-------------|----------|
| 摘要预览（推荐） | 显示书签总数、文件夹数量、顶级文件夹列表，让用户确认后导入 | ✓ |
| 完整树状预览 | 显示完整的书签树状结构，用户可以展开/收起查看每个文件夹的内容 | |

**User's choice:** 摘要预览（推荐）
**Notes:** 快速确认内容

---

## Button style

| Option | Description | Selected |
|--------|-------------|----------|
| 搜索栏旁按钮（推荐） | 在收藏夹页面顶部搜索栏旁添加一个"导入"按钮（图标+文字），醒目但不占空间 | ✓ |
| 仅右键菜单 | 放在右键菜单里，不额外增加 UI 元素 | |

**User's choice:** 搜索栏旁按钮（推荐）
**Notes:** 醒目但不占空间

---

## Result detail

| Option | Description | Selected |
|--------|-------------|----------|
| 完成摘要（推荐） | 显示导入书签数、跳过数（重复）、创建文件夹数，完成后用户可关闭或查看导入的书签 | ✓ |
| 简单提示 | 只显示"导入完成"，用户自己去查看 | |

**User's choice:** 完成摘要（推荐）
**Notes:** 完整的结果反馈

---

## Claude's Discretion

- Chrome 书签 JSON 解析的容错处理（节点格式异常时跳过并记录）
- HTML 解析库选择（cheerio 已在 REQUIREMENTS.md 中列为依赖）
- 导入过程中的错误处理策略（单条失败不影响整体导入）
- favicon 获取失败时的降级处理（显示默认图标）

## Deferred Ideas

None — discussion stayed within phase scope

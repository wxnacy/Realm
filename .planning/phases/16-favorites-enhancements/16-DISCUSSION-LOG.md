# Phase 16: 收藏夹文件夹 - 增强功能 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 16-收藏夹文件夹 - 增强功能
**Areas discussed:** 拖拽行为, 拖拽视觉反馈, 批量操作机制, 排序持久化策略

---

## 拖拽行为

### Q1: 收藏项被拖到文件夹图标上时怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 仅同目录排序 | 拖拽只调整同一文件夹内的顺序，不支持跨文件夹移动 | |
| 排序 + 移入文件夹 | 拖拽既可以同目录排序，也可以拖到其他文件夹上移入 | |
| 完整拖拽（推荐） | 拖到空白区域 = 移到末尾；拖到文件夹上 = 移入；拖到行之间 = 调整顺序 | ✓ |

**User's choice:** 完整拖拽（推荐）

### Q2: 文件夹和收藏项的排列顺序怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 混合排序（推荐） | 文件夹和收藏项混在一起，文件夹在前收藏项在后 | ✓ |
| 分区排序 | 文件夹和收藏项分成两个区域各自排序 | |
| 仅收藏项可拖 | 文件夹顺序固定，只允许收藏项拖拽 | |

**User's choice:** 混合排序（推荐）

### Q3: 文件夹可以被拖到另一个文件夹里变成子文件夹吗？

| Option | Description | Selected |
|--------|-------------|----------|
| 支持嵌套（推荐） | 文件夹可以拖到其他文件夹里，需循环引用检测 | ✓ |
| 仅排序不可嵌套 | 文件夹只在同一层级调整顺序 | |

**User's choice:** 支持嵌套（推荐）

### Q4: 拖拽排序完成后，排序结果什么时候保存？

| Option | Description | Selected |
|--------|-------------|----------|
| 拖拽结束即保存（推荐） | 拖拽完成后立即调用后端 API 保存 | ✓ |
| 手动确认保存 | 拖拽后显示"保存排序"按钮 | |

**User's choice:** 拖拽结束即保存（推荐）

---

## 拖拽视觉反馈

### Q1: 用户从哪里开始拖拽收藏项/文件夹？

| Option | Description | Selected |
|--------|-------------|----------|
| 整行可拖（推荐） | 整行都可以拖拽，鼠标变成 move 光标 | ✓ |
| 拖拽手柄 | 行左侧显示拖拽图标，按住才能拖 | |
| 图标区域可拖 | favicon/文件夹图标区域可拖 | |

**User's choice:** 整行可拖（推荐）

### Q2: 拖拽到文件夹上时，怎么提示"可以放进去"？

| Option | Description | Selected |
|--------|-------------|----------|
| 目标行高亮（推荐） | 文件夹行背景色变化 | ✓ |
| 文件夹图标放大 | 文件夹图标放大 + 高亮 | |
| 插入线 + 提示文字 | 半透明插入预览线 + "移入"提示 | |

**User's choice:** 目标行高亮（推荐）

### Q3: 在两行之间调整顺序时，怎么提示"会插到这里"？

| Option | Description | Selected |
|--------|-------------|----------|
| 插入位置指示线（推荐） | 两行之间显示蓝色横线 | ✓ |
| 占位空间预览 | 目标行下移腾出空间 | |
| 无提示自动插入 | 不显示提示 | |

**User's choice:** 插入位置指示线（推荐）

---

## 批量操作机制

### Q1: 用户怎么同时选中多个收藏项/文件夹？

| Option | Description | Selected |
|--------|-------------|----------|
| 键盘修饰键多选（推荐） | Cmd/Ctrl + 点击切换；Shift + 点击范围选择 | ✓ |
| 复选框多选 | 每行左侧显示复选框 | |
| 显式批量模式 | 工具栏按钮进入批量模式 | |

**User's choice:** 键盘修饰键多选（推荐）

### Q2: 选中多个项目后，批量操作的入口在哪里？

| Option | Description | Selected |
|--------|-------------|----------|
| 右键菜单自适应（推荐） | 右键菜单在多选状态下自动变为批量操作菜单 | ✓ |
| 浮动工具栏 | 选中后顶部出现批量操作按钮 | |
| 两者都要 | 右键菜单 + 浮动工具栏 | |

**User's choice:** 右键菜单自适应（推荐）

### Q3: 多选状态下，拖拽其中一个选中项会怎样？

| Option | Description | Selected |
|--------|-------------|----------|
| 拖拽批量移动（推荐） | 所有选中项一起移动，保持相对顺序 | ✓ |
| 拖拽仅单个 | 只移动当前拖的那一个 | |

**User's choice:** 拖拽批量移动（推荐）

### Q4: 批量操作支持哪些操作？

| Option | Description | Selected |
|--------|-------------|----------|
| 删除 + 移动 | 只支持批量删除和移动 | |
| 完整操作集（推荐） | 批量删除、移动、剪切/复制/粘贴 | ✓ |

**User's choice:** 完整操作集（推荐）

---

## 排序持久化策略

### Q1: 排序值用什么策略存储？

| Option | Description | Selected |
|--------|-------------|----------|
| Fractional Indexing（推荐） | 使用 fractional indexing 字符串，插入只修改被拖拽项 | ✓ |
| 整数重排 | 每次拖拽后重排 1, 2, 3... | |
| 间隔整数 | 用 10, 20, 30... 间隔，用完后重排 | |

**User's choice:** Fractional Indexing（推荐）

### Q2: Fractional indexing 用现成包还是自研？

| Option | Description | Selected |
|--------|-------------|----------|
| fractional-indexing 包（推荐） | npm 包，1.6kB，无依赖 | ✓ |
| 自研实现 | 自己实现避免新增依赖 | |

**User's choice:** fractional-indexing 包（推荐）

### Q3: 已有收藏项的初始排序值怎么分配？

| Option | Description | Selected |
|--------|-------------|----------|
| 按创建时间初始化（推荐） | 按 created_at 升序分配 | ✓ |
| 按标题字母序初始化 | 按标题排序分配 | |

**User's choice:** 按创建时间初始化（推荐）

---

## Claude's Discretion

- 拖拽动画（CSS 过渡）
- 拖拽到无效区域的处理
- 多选状态视觉反馈样式
- fractional indexing key 长度控制

## Deferred Ideas

None — discussion stayed within phase scope

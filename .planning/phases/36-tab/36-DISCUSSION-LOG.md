# Phase 36: Tab 拖拽与跨窗口移动 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 36-Tab 拖拽与跨窗口移动
**Areas discussed:** 拖拽触发机制, 视觉反馈设计, 窗口位置持久化策略, 跨窗口拖拽的原子性

---

## 拖拽触发机制

### Q1: 拖拽出窗口创建新窗口的触发条件

| Option | Description | Selected |
|--------|-------------|----------|
| 移出 Tab 栏区域 + 距离阈值 | 鼠标拖拽 Tab 移出 Tab 栏区域一定距离（如 50px）后触发创建新窗口预览，松手时创建窗口 | |
| 窗口边缘热区触发 | 拖拽 Tab 到窗口边缘区域时显示「释放以创建新窗口」的视觉提示，类似 macOS Dock 拖拽图标到桌面 | |
| 直接移出 Tab 栏（Chrome 风格） | 参考 Chrome：拖拽 Tab 出 Tab 栏区域即可，不需要额外的距离阈值或热区 | ✓ |

**User's choice:** 直接移出 Tab 栏（Chrome 风格）
**Notes:** 用户希望与 Chrome 行为一致

### Q2: 拖拽技术实现

| Option | Description | Selected |
|--------|-------------|----------|
| HTML5 Drag and Drop API | Phase 16 收藏夹排序已验证过 HTML5 DnD API，可复用经验；但跨窗口场景可能受限 | |
| 自定义鼠标事件实现 | mousedown/mousemove/mouseup 自己控制，更灵活，跨窗口拖拽时可以创建浮动预览窗口 | |
| 混合方案 | 窗口内排序用 HTML5 DnD，跨窗口拖拽用自定义事件 + 浮动预览窗口 | ✓ |

**User's choice:** 混合方案
**Notes:** 用户先要求调研各方案能力，我提供了 HTML5 DnD、自定义鼠标事件、混合方案的对比分析，用户选择了混合方案

### Q3: Tab 拖出窗口的判定条件

| Option | Description | Selected |
|--------|-------------|----------|
| Tab 栏边缘 + 30px 阈值（Chrome 风格） | 鼠标拖拽 Tab 离开 Tab 栏底部/顶部约 30px 后触发创建新窗口预览，与 Chrome 行为一致 | ✓ |
| 窗口边缘触发 | 鼠标离开整个窗口区域后才触发，避免误操作 | |
| Tab 栏边缘直接触发 | 鼠标离开 Tab 栏区域即触发，不需要额外距离，更灵敏 | |

**User's choice:** Tab 栏边缘 + 30px 阈值（Chrome 风格）
**Notes:** 用户先问 Chrome 是怎么做的，我调研了 Chromium 源码中的 TabDragController 实现，介绍了 kVerticalDetachThreshold 等常量，用户选择了与 Chrome 一致的方案

### Q4: 跨窗口拖拽的预览效果

| Option | Description | Selected |
|--------|-------------|----------|
| 浮动预览窗口（Chrome 风格） | 创建一个小型浮动窗口显示 Tab 标题和 favicon，跟随鼠标移动，松手时决定目标 | ✓ |
| 目标窗口高亮 + 插入指示器 | 只在目标窗口的 Tab 栏显示插入位置指示器，不创建额外窗口 | |
| 源窗口半透明 + 目标高亮 | 拖拽时源窗口 Tab 变半透明，鼠标移到其他窗口时目标 Tab 栏高亮 | |

**User's choice:** 浮动预览窗口（Chrome 风格）

---

## 视觉反馈设计

### Q5: 窗口内插入指示器样式

| Option | Description | Selected |
|--------|-------------|----------|
| 垂直插入线（Chrome 风格） | 两个 Tab 之间显示一条垂直高亮线，类似 VS Code / Chrome 的效果 | ✓ |
| 左右半区高亮 | 目标 Tab 左右半区域高亮，表示插入到前面还是后面 | |
| 半透明占位符 | 目标 Tab 位置显示半透明占位符，表示 Tab 将要插入的位置 | |

**User's choice:** 垂直插入线（Chrome 风格）

### Q6: 浮动预览窗口样式

| Option | Description | Selected |
|--------|-------------|----------|
| Mini 卡片（favicon + 标题） | 小型无边框窗口（200px 宽），显示 favicon + 标题，可选容器颜色条，Chrome 风格 | ✓ |
| Tab 样式复刻 | 与真实 Tab 栏样式一致的迷你 Tab，视觉上像从原窗口"撕下来" | |
| 极简图标 | 只显示一个容器颜色圆点 + favicon，最小化预览 | |

**User's choice:** Mini 卡片（推荐）
**Notes:** 用户先问哪种比较好，我从用户体验和实现复杂度两个角度分析，推荐了 Mini 卡片，用户选择了这个方案

### Q7: 目标窗口 Tab 栏视觉反馈

| Option | Description | Selected |
|--------|-------------|----------|
| 插入位置线 + Tab 栏高亮 | 目标窗口 Tab 栏显示插入位置垂直线，与窗口内排序效果一致 | ✓ |
| Tab 栏整体高亮 | 整个 Tab 栏背景色变化，表示可以释放 | |
| 容器颜色条提示 | Tab 栏底部显示容器颜色条，表示接受该容器的 Tab | |

**User's choice:** 插入位置线 + Tab 栏高亮

---

## 窗口位置持久化策略

### Q8: 需要保存的窗口属性

| Option | Description | Selected |
|--------|-------------|----------|
| 位置 + 大小 | 位置(x, y) + 大小(width, height) — 最基本的窗口状态 | |
| 位置 + 大小 + 窗口状态 | 位置 + 大小 + 是否最大化/最小化 — 保留窗口状态 | |
| 全量属性（含显示器信息） | 位置 + 大小 + 窗口状态 + 所在显示器 — 多显示器场景更完整 | ✓ |

**User's choice:** 全量属性（含显示器信息）

### Q9: 保存时机

| Option | Description | Selected |
|--------|-------------|----------|
| 实时保存 + 退出保存 | 窗口移动/调整大小时实时保存，退出时再保存一次确保一致 | ✓ |
| 仅退出时保存 | 只在应用退出时保存一次，减少磁盘写入 | |
| 防抖保存（500ms 延迟） | 窗口移动/调整大小后延迟 500ms 保存，避免频繁写入 | |

**User's choice:** 实时保存 + 退出保存

### Q10: 窗口位置超出屏幕时的恢复策略

| Option | Description | Selected |
|--------|-------------|----------|
| 居中恢复（推荐） | 检测到窗口位置超出所有显示器边界时，居中到主显示器 | ✓ |
| 最近显示器恢复 | 将窗口移动到最近的显示器内，保持相对位置 | |
| 重置为默认 | 忽略保存的位置，使用默认位置 | |

**User's choice:** 居中恢复（推荐）

---

## 跨窗口拖拽的原子性

### Q11: 拖拽过程中源窗口 Tab 状态

| Option | Description | Selected |
|--------|-------------|----------|
| 保持原位（Chrome 风格） | 拖拽开始时 Tab 仍在原位显示，松手后才移动；视觉上更稳定 | ✓ |
| 半透明/虚化 | 拖拽开始时 Tab 变半透明/虚化，表示正在移动中 | |
| 立即移除 | 拖拽开始时 Tab 从原位消失，跟随鼠标移动 | |

**User's choice:** 保持原位（Chrome 风格）

### Q12: 拖拽失败或取消时的回滚机制

| Option | Description | Selected |
|--------|-------------|----------|
| 静默回滚（推荐） | Tab 自动回到原位，用户无感知，像什么都没发生 | ✓ |
| 回滚 + 提示 | Tab 回到原位，同时显示 toast 提示"拖拽已取消" | |
| 无需回滚（保持原位策略） | 不做特殊处理，Tab 保持原位（因为拖拽开始时就没有移除） | |

**User's choice:** 静默回滚（推荐）

### Q13: 在无效区域松手时的行为

| Option | Description | Selected |
|--------|-------------|----------|
| 创建新窗口 | 自动创建新窗口（与拖出 Tab 栏效果一致），符合用户"我想把这个 Tab 拿出来"的意图 | ✓ |
| 回滚到原位 | Tab 回到原窗口原位，不创建新窗口 | |

**User's choice:** 创建新窗口

---

## Claude's Discretion

- 浮动预览窗口的具体动画效果（跟随鼠标的方式）
- Tab 栏高亮的具体样式（背景色变化程度）
- 窗口位置持久化的存储 key 命名

## Deferred Ideas

None — discussion stayed within phase scope

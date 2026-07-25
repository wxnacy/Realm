# Phase 7: 收藏夹管理 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 7-收藏夹管理
**Areas discussed:** 收藏按钮交互, 收藏列表页面, 搜索与编辑, 数据存储方案

---

## 收藏按钮交互

### 按钮图标样式
| Option | Description | Selected |
|--------|-------------|----------|
| 星标图标 | 未收藏时空心星标，已收藏时实心星标（金色）。类似 Chrome/GitHub 的收藏按钮 | ✓ |
| 书签图标 | 使用书签图标（类似 Safari），未收藏时轮廓，已收藏时填充 | |
| 你决定 | Claude 自行决定具体图标样式 | |

**User's choice:** 星标图标（推荐）
**Notes:** 用户认可星标图标的一致性（Chrome/GitHub 风格）

### 点击行为
| Option | Description | Selected |
|--------|-------------|----------|
| 一键切换 | 点击星标直接收藏/取消收藏，不弹窗。已收藏页面再点星标直接取消收藏 | |
| 首次弹出编辑面板 | 第一次点击时弹出小面板，让用户确认收藏并可选编辑标题。已收藏后点击直接取消 | ✓ |
| 你决定 | Claude 自行决定交互方式 | |

**User's choice:** 首次弹出编辑面板
**Notes:** 用户希望首次收藏时有确认和编辑标题的机会

### 面板内容
| Option | Description | Selected |
|--------|-------------|----------|
| 标题编辑 + 保存 | 预填当前页面标题（可编辑）+ 保存/取消按钮。简洁，只改标题 | |
| 标题 + URL 显示 | 预填标题 + URL 显示（只读）+ 保存/取消。让用户确认 URL | ✓ |
| 你决定 | Claude 自行决定面板内容 | |

**User's choice:** 标题 + URL 显示
**Notes:** 用户希望在收藏时能看到并确认当前页面的 URL

### 按钮位置
| Option | Description | Selected |
|--------|-------------|----------|
| URL 栏右侧 | 放在 URL 输入框右侧，与历史记录按钮相邻。用户在浏览页面时可以快速点击收藏 | ✓ |
| 与历史按钮同排 | 放在历史记录按钮的左边或右边，形成工具栏按钮区域 | |
| 你决定 | Claude 自行决定位置 | |

**User's choice:** URL 栏右侧（推荐）
**Notes:** 用户认可与历史记录按钮相邻的布局

---

## 收藏列表页面

### 页面入口
| Option | Description | Selected |
|--------|-------------|----------|
| 独立工具栏按钮 | 在工具栏添加一个独立的收藏夹按钮（如文件夹图标），点击后在当前 Tab 打开 realm://favorites 内部页面 | ✓ |
| 面板内"查看全部"链接 | 收藏页面通过点击收藏面板内的"查看全部"链接打开，不在工具栏额外加按钮 | |
| 你决定 | Claude 自行决定入口方式 | |

**User's choice:** 独立工具栏按钮（推荐）
**Notes:** 用户认可独立按钮的直接性

### 列表样式
| Option | Description | Selected |
|--------|-------------|----------|
| 紧凑列表 | 每行显示：favicon + 页面标题 + URL + 收藏时间 + 删除按钮。参考 Chrome 书签管理器的紧凑列表风格 | ✓ |
| 卡片视图 | 每个收藏项是一个卡片，显示 favicon、标题、URL、截图预览。更丰富但占空间 | |
| 你决定 | Claude 自行决定列表样式 | |

**User's choice:** 紧凑列表（推荐）
**Notes:** 用户认可紧凑列表的效率

### 排序方式
| Option | Description | Selected |
|--------|-------------|----------|
| 按收藏时间倒序 | 最新收藏的排在最前面，简单直观 | ✓ |
| 按域名分组 | 按网站域名分组显示，相同域名的收藏在一起 | |
| 你决定 | Claude 自行决定排序方式 | |

**User's choice:** 按收藏时间倒序（推荐）
**Notes:** 用户认可时间倒序的直观性

### 空状态
| Option | Description | Selected |
|--------|-------------|----------|
| 空状态提示 | 显示一个友好的空状态插图和文字，如"暂无收藏，点击星标收藏页面" | ✓ |
| 简洁文字 | 空状态时只显示简洁文字，不加插图 | |
| 你决定 | Claude 自行决定空状态设计 | |

**User's choice:** 空状态提示（推荐）
**Notes:** 用户认可友好的空状态设计

---

## 搜索与编辑

### 搜索范围
| Option | Description | Selected |
|--------|-------------|----------|
| 标题 + URL | 同时匹配页面标题和 URL，输入关键词后实时过滤。参考历史记录页面的搜索模式（debounce 300ms） | ✓ |
| 仅标题 | 只匹配页面标题，更简单但可能遗漏 | |
| 你决定 | Claude 自行决定搜索范围 | |

**User's choice:** 标题 + URL（推荐）
**Notes:** 用户认可与历史记录页面一致的搜索模式

### 高亮显示
| Option | Description | Selected |
|--------|-------------|----------|
| 高亮匹配文本 | 搜索结果中匹配的文本用高亮色标出，方便用户快速定位 | ✓ |
| 不高亮 | 只过滤结果不高亮，更简单 | |
| 你决定 | Claude 自行决定 | |

**User's choice:** 高亮匹配文本（推荐）
**Notes:** 用户认可高亮的便利性

### 编辑标题
| Option | Description | Selected |
|--------|-------------|----------|
| 行内编辑 | 点击标题直接进入编辑模式，回车或点击其他地方保存。交互快速直接 | ✓ |
| 弹窗编辑 | 点击编辑按钮弹出小弹窗，修改标题后保存。更传统但多一步操作 | |
| 你决定 | Claude 自行决定编辑方式 | |

**User's choice:** 行内编辑（推荐）
**Notes:** 用户认可行内编辑的高效性

### 删除交互
| Option | Description | Selected |
|--------|-------------|----------|
| 悬停删除图标 | 鼠标悬停显示删除图标，点击直接删除（无确认弹窗）。与历史记录页面的删除交互一致 | |
| 复选框 + 批量删除 | 每行有复选框，支持多选后批量删除，与历史记录页面一致 | ✓ |
| 你决定 | Claude 自行决定删除方式 | |

**User's choice:** 复选框 + 批量删除
**Notes:** 用户选择与历史记录页面一致的批量删除模式

---

## 数据存储方案

### 存储选择
| Option | Description | Selected |
|--------|-------------|----------|
| 复用现有 SQLite | 在现有 better-sqlite3 数据库中新建 favorites 表，与 history 表共享数据库连接 | ✓ |
| 独立 SQLite 文件 | 使用独立的 SQLite 数据库文件存储收藏。完全隔离，但增加管理复杂度 | |
| 你决定 | Claude 自行决定存储方案 | |

**User's choice:** 复用现有 SQLite（推荐）
**Notes:** 用户认可复用现有基础设施的简洁性

### 去重机制
| Option | Description | Selected |
|--------|-------------|----------|
| URL 去重 + 提示 | 收藏时检查当前容器下是否已有相同 URL 的收藏，如果有则提示"已收藏过该页面" | ✓ |
| 静默去重 | 静默处理，如果已收藏则不做任何操作，不提示 | |
| 你决定 | Claude 自行决定去重方式 | |

**User's choice:** URL 去重 + 提示（推荐）
**Notes:** 用户认可明确的反馈提示

### Favicon 策略
| Option | Description | Selected |
|--------|-------------|----------|
| 保存 URL | 收藏时保存 favicon URL 到数据库，列表直接显示。简单高效，但 favicon 可能失效 | ✓ |
| 实时获取 | 不单独缓存 favicon，直接使用 Chromium 的 webContents.getFavicon API 或 Google Favicon API 实时获取 | |
| 你决定 | Claude 自行决定 favicon 策略 | |

**User's choice:** 保存 URL（推荐）
**Notes:** 用户认可简单高效的方案

### 上限策略
| Option | Description | Selected |
|--------|-------------|----------|
| 不设上限 | 收藏数量不设上限。收藏是用户主动操作，数量通常远少于历史记录，不需要自动清理 | ✓ |
| 设上限 + 提示清理 | 每容器设置收藏上限（如 5000 条），超过后提示用户清理 | |
| 你决定 | Claude 自行决定上限策略 | |

**User's choice:** 不设上限（推荐）
**Notes:** 用户认可收藏作为主动操作不需要限制

---

## Claude's Discretion

- SQLite 数据库 favorites 表的表结构设计
- 具体的 SQL 查询优化策略
- 收藏页面的 CSS 样式细节
- favicon 获取和缓存的降级策略
- 收藏编辑面板的具体 UI 样式
- realm://favorites 协议的路由处理

## Deferred Ideas

None — discussion stayed within phase scope

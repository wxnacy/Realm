# Phase 16: 收藏夹文件夹 - 增强功能 - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段在 `realm://favorites` 收藏夹页面实现拖拽排序和批量操作增强功能，包括：
- 拖拽排序（收藏项和文件夹的同目录排序、跨文件夹移动、拖入文件夹）
- 拖拽视觉反馈（插入指示线、目标高亮）
- 批量操作机制（键盘多选、右键菜单自适应、拖拽批量移动）
- 排序持久化（fractional indexing 策略）

**不包括**：Chrome 书签导入（Phase 17）、收藏栏（Phase 18）、AI Agent 集成（Phase 19-21）

</domain>

<decisions>
## Implementation Decisions

### 拖拽行为
- **D-01:** 完整拖拽：支持同目录排序 + 跨文件夹移动 + 拖到文件夹上移入
- **D-02:** 混合排序：文件夹和收藏项混在一起排序，文件夹在前收藏项在后（类似 Chrome 书签管理器）
- **D-03:** 支持嵌套：文件夹可以拖到另一个文件夹里变成子文件夹（需复用 Phase 14 的循环引用检测）
- **D-04:** 拖拽结束即保存：拖拽完成后立即调用后端 API 保存排序结果，无需额外确认步骤

### 拖拽视觉反馈
- **D-05:** 整行可拖：整行（收藏项或文件夹）都可以作为拖拽起点，鼠标变成 move 光标
- **D-06:** 目标行高亮：拖到文件夹上时，文件夹行高亮（背景色变化）表示可以放入
- **D-07:** 插入位置指示线：在两行之间显示一条蓝色横线，表示松开后会插入到这个位置（类似 Chrome 书签管理器）

### 批量操作机制
- **D-08:** 键盘修饰键多选：Cmd/Ctrl + 点击 = 切换选中；Shift + 点击 = 范围选择。选中项显示蓝色高亮或复选标记
- **D-09:** 右键菜单自适应：右键菜单在多选状态下自动变为批量操作菜单（删除选中项、移动到文件夹、剪切/复制）
- **D-10:** 拖拽批量移动：多选状态下拖拽其中一个选中项时，所有选中项一起移动，保持相对顺序不变
- **D-11:** 完整操作集：批量删除、批量移动到文件夹、批量剪切/复制/粘贴

### 排序持久化策略
- **D-12:** Fractional indexing：使用 npm 包 `fractional-indexing`（1.6kB，无依赖），通过 `generateKeyBetween()` 生成排序键
- **D-13:** 按创建时间初始化：已有收藏项首次打开时按 `created_at` 升序分配初始排序值，之后用户手动拖拽调整

### Claude's Discretion
- 拖拽动画：可以有 CSS 过渡动画提升体验（非阻塞）
- 拖拽到无效区域：拖到空白区域时取消操作，不移动项目
- 多选状态下的视觉反馈：选中项显示蓝色背景或边框高亮
- fractional indexing 的 key 长度控制：避免生成过长的排序键

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — FOLDER-07（拖拽排序）需求详情和验收标准
- `.planning/ROADMAP.md` — Phase 16 任务列表和里程碑背景

### 前序阶段上下文
- `.planning/phases/14-favorites-folders-db/14-CONTEXT.md` — Phase 14 决策（folder_id=0 根目录、sort_order 字段、级联删除、循环引用检测）
- `.planning/phases/15-ui/15-CONTEXT.md` — Phase 15 决策（左右分栏布局、右键菜单、剪切/复制/粘贴剪贴板）

### 现有代码
- `favorites-manager.js` — 后端数据层，文件夹 CRUD API、sort_order 字段已就绪
- `src/favorites-page.js` — 收藏夹页面渲染逻辑，需要扩展支持拖拽和多选
- `src/styles/main.css` — 收藏夹页面样式，需要添加拖拽相关样式
- `main.js` — HTTP API 路由（`/api/favorites/*`），需要添加排序更新 API
- `src/preload.js` — contextBridge API 暴露

### 技术参考
- `.planning/codebase/CONVENTIONS.md` — 编码规范（命名、代码风格、DOM 操作模式）
- `.planning/codebase/STRUCTURE.md` — 项目结构和文件位置
- [fractional-indexing npm 包](https://www.npmjs.com/package/fractional-indexing) — 排序键生成库

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `favoritesApi(route, options, query)`: 通用 HTTP API 调用函数，可直接调用排序更新 API
- `favorites-manager.js` 的 `updateFavorite()`: 可扩展为支持 sort_order 更新
- `favorites-manager.js` 的 `moveFavorites()`: 批量移动收藏项，可复用于拖拽移动
- Phase 14 的循环引用检测逻辑：文件夹嵌套拖拽时需要复用
- Phase 15 的右键菜单系统：需要扩展支持多选状态下的批量操作菜单
- Phase 15 的剪切/复制/粘贴剪贴板机制：需要扩展支持批量操作

### Established Patterns
- DOM 元素引用集中在 `elements` 对象中管理
- 事件监听在 `setupEventListeners()` 函数中集中绑定
- 状态更新后调用对应的渲染函数刷新 UI
- 使用 `[Realm Renderer]` 前缀标识渲染进程日志

### Integration Points
- `favorites-page.js` 的 `renderFavorites()`: 需要添加拖拽事件监听和多选状态管理
- `favorites-page.js` 的 DOM 结构：需要为每个收藏项/文件夹行添加 `draggable` 属性
- `main.js` 的 HTTP API：需要添加批量排序更新路由
- `src/styles/main.css`：需要添加拖拽相关样式（插入线、高亮、选中状态）

</code_context>

<specifics>
## Specific Ideas

用户参考 Chrome 书签管理器的拖拽排序行为：
- 插入位置指示线（蓝色横线）参考 Chrome 的实现
- 文件夹在前、收藏项在后的混合排序参考 Chrome 的默认行为
- 拖拽到文件夹上高亮提示参考 Chrome 的交互模式

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-收藏夹文件夹 - 增强功能*
*Context gathered: 2026-07-28*

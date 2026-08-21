# Phase 37: 地址栏地址补全功能 - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

用户在地址栏输入字符后，最匹配的地址自动补充到地址栏（inline completion），同时出现候选地址列表（dropdown）。继续输入或修改内容时，inline completion 和 dropdown 实时更新。参考 Chrome 等主流浏览器的地址补全行为。

**核心交付：**
- 地址栏输入时实时匹配历史记录、收藏夹和常用网站
- 最佳匹配的剩余部分以选中态显示在光标后（inline completion）
- 下拉候选列表显示 favicon + 标题 + URL
- 键盘导航（上下键选择、Enter 跳转、Tab 接受补全、Esc 关闭）
- 100ms 防抖查询，全部容器数据合并

</domain>

<decisions>
## Implementation Decisions

### 数据源与查询
- **D-01:** 补全数据源包含历史记录、收藏夹和常用网站三个来源，综合推荐
- **D-02:** 查询范围为全部容器数据合并（收藏夹全局共享，历史记录和常用网站合并所有容器）
- **D-03:** 查询在主进程执行，渲染进程通过 IPC 请求主进程查询结果
- **D-04:** 收藏夹优先级最高，其次为常用网站（frecency 算法），最后为历史记录

### 匹配算法
- **D-05:** 匹配算法为 URL 前缀 + 标题子串匹配，输入 'git' 匹配 github.com 和标题含 'Git' 的页面
- **D-06:** 匹配结果按 frecency 综合排序（频率 + 最近性加权），收藏夹条目置顶

### 内联补全行为
- **D-07:** inline completion 使用 Chrome 行为：输入 'gith' 时，地址栏显示 'gith' + 高亮选中的 'ub.com'
- **D-08:** 按 Tab 或 Right 键接受 inline 补全，补全文本变为普通文本
- **D-09:** 继续输入时 inline completion 实时更新，Backspace 时补全消失或更新

### 候选列表交互
- **D-10:** 下拉候选列表最多显示 6 条
- **D-11:** 每个条目显示 favicon + 标题 + URL，标题在上 URL 在下
- **D-12:** 键盘导航：上下键选择高亮条目，Enter 跳转选中条目，Tab 接受 inline 补全，Esc 关闭下拉
- **D-13:** 点击候选条目在当前 Tab 导航到该 URL
- **D-14:** 候选列表样式与现有深色主题一致（深色背景、圆角、阴影）

### 性能策略
- **D-15:** 输入防抖 100ms，平衡实时响应和查询性能
- **D-16:** 查询结果缓存，相同前缀不重复查询

### Claude's Discretion
- 下拉列表的具体动画效果（展开/收起）
- 条目 hover 高亮的具体样式
- 无匹配结果时的提示文案
- favicon 缺失时的默认图标

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规范
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式、新增 IPC 接口流程

### 现有数据源实现
- `history-manager.js` — 历史记录管理器，每容器独立表，FIFO 淘汰（每容器上限 10000 条）
- `favorites-manager.js` — 收藏夹管理器，全局共享数据库，FTS5 全文搜索
- `frequent-sites-manager.js` — 常用网站管理器，frecency 算法（频率+最近性加权）

### 渲染进程
- `src/renderer.js` — 渲染进程核心逻辑，地址栏为 `elements.urlInput`
- `src/preload.js` — contextBridge 安全暴露 IPC 接口
- `src/index.html` — 主界面结构，地址栏 HTML

### 主进程
- `main.js` — 主进程入口，IPC 处理器注册
- `ipc-handlers.js` — 集中注册所有 IPC 处理器

### 样式
- `src/styles/main.css` — 主样式文件，包含深色主题变量

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **history-manager.js**: `searchHistory(query, containerId)` 方法可复用，支持标题和 URL 搜索
- **favorites-manager.js**: `searchFavorites(query)` 方法可复用，FTS5 全文搜索支持中文分词
- **frequent-sites-manager.js**: `getFrequentSites(limit)` 方法可复用，frecency 排序
- **elements.urlInput**: 现有地址栏 DOM 元素，需要增加 input 事件监听和补全 UI

### Established Patterns
- **IPC 通信模式**: `ipcMain.handle('channel-name', handler)` + `contextBridge.exposeInMainWorld` + `window.realmAPI.method()`
- **数据查询模式**: 渲染进程通过 IPC 请求主进程，主进程调用各 manager 查询后返回结果
- **深色主题**: CSS 变量 `--bg-primary`, `--text-secondary` 等，样式在 `main.css` 中定义

### Integration Points
- **main.js**: 需要注册新的 IPC 处理器 `get-autocomplete-suggestions`
- **src/preload.js**: 需要暴露 `getAutocompleteSuggestions` 方法
- **src/renderer.js**: 需要在 `elements.urlInput` 上增加 input 事件监听和补全 UI 渲染
- **src/index.html**: 需要添加候选列表的 DOM 容器
- **src/styles/main.css**: 需要添加候选列表和 inline completion 的样式

</code_context>

<specifics>
## Specific Ideas

- 完全参考 Chrome 的地址补全行为，用户已经熟悉这种交互模式
- inline completion 使用与 Chrome 相同的选中态（蓝色高亮背景）
- 候选列表出现在地址栏下方，宽度与地址栏一致
- 收藏夹条目在候选列表中显示星标图标以区分

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-地址栏地址补全功能*
*Context gathered: 2026-08-21*

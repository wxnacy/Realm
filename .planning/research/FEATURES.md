# Feature Landscape -- v2.4 多窗口支持

**Domain:** Electron 多容器浏览器 - 多窗口功能
**Researched:** 2026-08-14
**Overall confidence:** HIGH

## Executive Summary

v2.4 的核心目标是将 Realm Browser 从单窗口多 Tab 架构扩展为多窗口架构。研究结论表明，Chrome 的多窗口行为是用户的核心参考基准，必须遵循。

**Chrome 核心行为：**
- 拖拽 Tab 出标签栏创建新窗口（detach）
- 拖拽 Tab 到另一个窗口的标签栏（attach）
- 拖拽 Tab 改变窗口内顺序（reorder）
- 窗口关闭时如果只剩一个 Tab，自动销毁窗口
- Dock 右击"新建窗口"（macOS: Cmd+N）
- Tab 状态在拖拽过程中保留（URL、容器、滚动位置）

**Electron 限制：**
- `webContents` 不能直接在窗口间移动，必须序列化状态后重建
- macOS 原生 Tab 支持（`tabbingIdentifier`）与自定义 Tab 栏冲突，不使用
- 必须实现自定义拖拽逻辑（HTML5 Drag and Drop API）

**架构影响：**
- `tab-manager.js` 的全局 `tabs` Map 需要改为每窗口独立
- `window-manager.js` 的单例 `mainWindowRef` 需要改为窗口集合
- `shortcut-manager.js` 的单窗口派发需要改为焦点窗口派发
- 渲染进程需要支持多实例（每个窗口独立的 renderer.js 实例）

## Table Stakes

功能用户期望的基础能力。缺失 = 产品不完整。

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| MW-01: Dock 右击"新建窗口" | macOS 标准行为 | Low | app.dock.setMenu 或 app.on('activate') |
| MW-02: 拖拽 Tab 出窗口创建新窗口 | Chrome 核心交互 | High | HTML5 drag + 主进程窗口创建 |
| MW-03: 拖拽 Tab 到另一个窗口 | Chrome 核心交互 | High | 跨窗口 drag events + IPC 协调 |
| MW-04: 拖拽 Tab 改变窗口内顺序 | Chrome 核心交互 | Medium | DOM 拖拽 + tab-manager reorder |
| MW-05: 窗口关闭时仅剩一个 Tab 自动销毁 | Chrome 标准行为 | Medium | 检测 Tab 数量 + 窗口关闭逻辑 |
| MW-06: Tab 状态拖拽保留 | 用户期望不丢失页面状态 | Medium | 序列化 URL/title/containerId/favicon |
| MW-07: 新窗口继承容器上下文 | 容器隔离一致性 | Low | 从源窗口的当前 Tab 读取容器 |
| MW-08: 快捷键 Cmd+N 新建窗口 | macOS 标准快捷键 | Low | shortcut-manager 新增 newWindow |
| MW-09: 快捷键 Cmd+Shift+W 关闭窗口 | macOS 标准快捷键 | Low | shortcut-manager 新增 closeWindow |
| MW-10: 窗口间焦点切换 | 多窗口基础交互 | Low | Electron 原生支持 |

## Differentiators

差异化功能。不是预期中的，但有额外价值。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 窗口位置记忆 | 重启后恢复窗口位置/大小 | Medium | electron-store 持久化 bounds |
| 窗口标题显示容器名 | 快速识别窗口所属容器 | Low | win.setTitle() + 容器名 |
| 右键菜单"在新窗口中打开" | 快速打开链接到新窗口 | Low | 复用 context-menu-manager |
| 窗口间容器颜色标识 | 视觉区分不同容器的窗口 | Low | 标题栏/工具栏颜色 |
| 窗口状态持久化 | 跨重启保留窗口布局 | High | 需要序列化所有窗口状态 |

## Anti-Features

明确不构建的功能。

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| macOS 原生 Tab 集成 | 与自定义 Tab 栏冲突，行为不可控 | 使用自定义 Tab 栏 |
| 窗口合并（多窗口合并为一个） | 复杂度高，非核心需求 | 用户手动拖拽 Tab |
| 窗口分屏/平铺 | macOS 原生支持，不需要应用层实现 | 让系统处理 |
| 跨窗口 Tab 搜索 | 功能膨胀，非核心需求 | 用户可通过地址栏快速定位 |
| 窗口置顶/悬浮 | 非浏览器标准行为 | 不做 |
| 窗口透明/毛玻璃 | 非浏览器标准行为 | 不做 |

## Chrome Multi-Window Behavior Analysis

### 1. Tab Drag Out (Detach)

**Chrome 行为：**
- 拖拽 Tab 离开标签栏一定距离后，Tab 从原窗口分离
- 创建新窗口，包含被拖拽的 Tab
- 新窗口位置跟随鼠标位置
- 原窗口的其他 Tab 保持不变

**Realm 实现要点：**
- 使用 HTML5 Drag and Drop API（项目已有规则拖拽实现参考）
- `dragstart` 时序列化 Tab 状态（URL, containerId, title, faviconUrl）
- `dragend` 时检测是否在窗口外释放
- 主进程创建新 BrowserWindow + 重建 Tab

### 2. Tab Drag Between Windows (Attach)

**Chrome 行为：**
- 拖拽 Tab 到另一个窗口的标签栏区域
- Tab 插入到目标位置（高亮指示）
- 释放后 Tab 从源窗口移除，添加到目标窗口
- 如果源窗口只剩一个 Tab，源窗口关闭

**Realm 实现要点：**
- 跨窗口通信需要通过主进程中转（IPC）
- 源窗口 `dragstart` → 主进程 → 目标窗口 `dragover`/`drop`
- 使用 `webContents.send` 向目标窗口发送插入指令
- 目标窗口需要接受外部 Tab 的 dragover 事件

### 3. Tab Reorder Within Window

**Chrome 行为：**
- 拖拽 Tab 在同一标签栏内移动
- 实时显示插入位置指示器
- 释放后 Tab 顺序更新
- 固定 Tab 不能拖到非固定区域

**Realm 实现要点：**
- 复用现有的规则拖拽实现模式（`dragstart`/`dragover`/`drop`）
- DOM 元素重排 + tab-manager 顺序同步
- 固定 Tab 区域隔离

### 4. New Window from Dock/Taskbar

**Chrome 行为：**
- macOS: Dock 右击 → "新建窗口"（或 Cmd+N）
- 创建空白新窗口，带默认 Tab（新标签页）
- 新窗口独立于现有窗口

**Realm 实现要点：**
- `app.dock.setMenu()` 设置 Dock 菜单（macOS）
- `app.on('activate')` 处理 Dock 图标点击
- `shortcut-manager` 新增 `newWindow` 动作

### 5. Window Close Behavior

**Chrome 行为：**
- 关闭窗口时，窗口内的所有 Tab 一起关闭
- 如果是最后一个窗口，应用退出
- 如果还有其他窗口，只关闭当前窗口

**Realm 实现要点：**
- 窗口 `closed` 事件清理该窗口的 Tab 数据
- `window-all-closed` 事件判断是否退出应用
- 需要维护窗口列表而非单例引用

### 6. Tab State Preservation During Drag

**Chrome 行为：**
- 拖拽过程中 Tab 保持"半透明"状态
- 释放后 Tab 恢复完整状态（URL、滚动位置、表单数据）
- 如果拖拽取消（释放到非有效区域），Tab 恢复原位

**Realm 实现要点：**
- 序列化 Tab 元数据（URL, containerId, title, faviconUrl, pinned）
- webview 本身不能移动，只能重建（URL 重新加载）
- 滚动位置可以通过 `webContents.executeJavaScript` 读取/恢复
- 表单数据不保留（Chrome 也不保证）

## Feature Dependencies

```
MW-01 (Dock 新建窗口) ──→ MW-08 (Cmd+N 快捷键)
MW-02 (拖拽创建窗口) ──→ MW-03 (拖拽到另一窗口)
      │                       │
      └──→ MW-06 (状态保留)   └──→ MW-05 (自动销毁)
      │
      └──→ MW-04 (窗口内排序)

MW-07 (容器上下文) ←── 所有创建窗口的操作
MW-09 (Cmd+Shift+W) ←── 窗口管理基础
MW-10 (焦点切换) ←── 多窗口基础
```

## Architecture Impact Analysis

### Current Architecture Limitations

| 组件 | 当前状态 | 多窗口需求 | 改动量 |
|------|----------|------------|--------|
| `window-manager.js` | 单例 `mainWindowRef` | 窗口集合 Map | High |
| `tab-manager.js` | 全局 `tabs` Map | 每窗口独立 Map | High |
| `shortcut-manager.js` | 单窗口派发 | 焦点窗口派发 | Medium |
| `renderer.js` | 单实例 | 多实例（每窗口） | Low |
| `main.js` | 全局 IPC handler | 窗口级 IPC 路由 | Medium |

### Key Architectural Decisions Needed

1. **Tab 数据归属**：Tab 数据存储在主进程（当前）还是每窗口独立？
   - 推荐：主进程维护 `Map<windowId, Map<tabId, tab>>`
   - 原因：跨窗口拖拽需要主进程协调，Tab 持久化需要统一入口

2. **窗口标识**：使用 `BrowserWindow.id`（当前）还是自定义 ID？
   - 推荐：继续使用 `BrowserWindow.id`
   - 原因：已有 CR-7 约定，保持一致性

3. **IPC 路由**：渲染进程如何知道自己的 windowId？
   - 推荐：preload 启动时通过 `ipcRenderer.invoke('window:get-id')` 获取
   - 原因：Electron 不直接暴露 windowId 给渲染进程

4. **Tab 拖拽通信**：跨窗口拖拽如何协调？
   - 推荐：主进程中转（源窗口 IPC → 主进程 → 目标窗口 IPC）
   - 原因：渲染进程间不能直接通信

## MVP Recommendation

优先：
1. MW-01: Dock 右击新建窗口（最简单，验证多窗口基础架构）
2. MW-08: Cmd+N 快捷键（配合 MW-01）
3. MW-04: 窗口内 Tab 拖拽排序（验证拖拽基础）
4. MW-02: 拖拽 Tab 创建新窗口（核心功能）
5. MW-03: 拖拽 Tab 到另一窗口（核心功能）
6. MW-05: 窗口关闭自动销毁（核心功能）

可推迟：
- MW-06: Tab 状态保留（滚动位置恢复）— 后期增强
- 窗口位置记忆 — 后期增强
- 右键菜单"在新窗口中打开" — 后期增强

## Implementation Complexity Estimate

| Phase | Feature | Estimated LOC | Risk |
|-------|---------|---------------|------|
| Phase 1 | 多窗口基础架构（window-manager + tab-manager 重构） | ~300 | High |
| Phase 2 | Dock 新建窗口 + Cmd+N | ~50 | Low |
| Phase 3 | 窗口内 Tab 拖拽排序 | ~150 | Medium |
| Phase 4 | 拖拽 Tab 创建新窗口 | ~200 | High |
| Phase 5 | 拖拽 Tab 到另一窗口 | ~250 | High |
| Phase 6 | 窗口关闭自动销毁 | ~100 | Medium |

## Known Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| webContents 不能跨窗口移动 | Tab 拖拽时需要重建 webview，URL 会重新加载 | 接受此限制，Chrome 也重新加载 |
| 跨窗口 drag events 不直接工作 | HTML5 DnD 限定在同一页面 | 通过 IPC 中转 drag 状态 |
| Tab 持久化与多窗口冲突 | electron-store 单文件存储 | 按 windowId 分组存储 |
| 焦点窗口判断 | 多窗口时快捷键路由 | 使用 BrowserWindow.getFocusedWindow() |

## Sources

- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) — 窗口管理 API
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents) — 页面内容管理
- [MDN HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) — 拖拽实现参考
- Chrome 浏览器多窗口行为（实际观察）
- Realm 现有代码架构分析（window-manager.js, tab-manager.js, shortcut-manager.js）

---
*Feature research for: 多窗口支持 (v2.4)*
*Researched: 2026-08-14*
*Confidence: HIGH -- 功能边界清晰，Chrome 行为明确，Electron API 支持完善*

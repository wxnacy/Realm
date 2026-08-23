# Phase 39: Vimium 键盘操作功能 - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

为 Realm Browser 添加类似 Vimium 的键盘操作功能，支持页面滚动、链接跟随、标签管理、搜索模式等键盘操作，提升键盘操作效率。

**核心交付：**
- 页面滚动控制（j/k/gg/G/d/u）
- 链接跟随 Hint Mode（f/F）
- 标签页管理（J/K/x/X/t/T/gt/gT）
- 浏览历史导航（H/L）
- 搜索模式（//n/N）
- URL 操作（o/O/ge）
- 快捷键帮助（?）

**不在本 Phase 范围：**
- 插入模式（i）— P2 优先级，后续版本实现
- Visual 模式 — 后续版本

</domain>

<decisions>
## Implementation Decisions

### Vim 模式与状态栏
- **D-01:** 本版本不实现插入模式（P2），仅实现 Normal 模式下的 Vim 快捷键
- **D-02:** Normal 模式不需要特殊状态栏标识，用户通过按键行为判断

### Hint Mode 链接跟随
- **D-03:** 使用 `webview.executeJavaScript` 注入 CSS + DOM 创建 hint overlay，轻量级实现，无需 CDP 连接管理 — **Reversibility:** reversible — 注入脚本可随时替换
- **D-04:** 提示字母生成参照 Vimium：先用单字符 a-z，超过 26 个链接时扩展为双字符 aa/ab/ac...，再不够扩展为三字符
- **D-05:** Hint 标签使用 Vimium 经典样式：黄色/橙色背景 + 黑色文字的小标签，固定在元素左上角
- **D-06:** 同时支持 f（当前标签页打开链接）和 F（新标签页打开链接）两种模式

### 快捷键冲突处理
- **D-07:** 自动检测焦点元素：当焦点在 input/textarea/contenteditable 上时，禁用 Vim 单键快捷键 — **Reversibility:** reversible — 检测逻辑可随时调整
- **D-08:** CmdOrCtrl 修饰键优先级高于 Vim 快捷键（如 Cmd+C 优先于单个 C）
- **D-09:** webview 内的输入框也自动禁用 Vim 快捷键，需要通过 webview guest 脚本注入检测焦点状态

### 页面操作实现
- **D-10:** 页面滚动使用 `webview.executeJavaScript` 注入 `window.scrollBy`/`scrollTo`，轻量级实现
- **D-11:** 滚动行为使用平滑滚动（`behavior: 'smooth'`），用户体验更好
- **D-12:** 搜索模式使用浏览器原生的 `findInPage` API（`window.find` 或 CDP），性能好

### Claude's Discretion
- Hint overlay 的具体 DOM 结构和 CSS 细节
- 提示字母的排列顺序和优先级算法
- 滚动距离的具体像素值（如 j/k 滚动 100px，d/u 滚动半屏）
- 搜索框的 UI 样式和位置
- 快捷键帮助面板的内容和布局

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `docs/todo/vimium.md` — Vimium 键盘操作功能完整需求列表（P0/P1/P2 优先级）

### 项目规范
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式

### 快捷键基础设施
- `shortcut-manager.js` — 快捷键管理模块：before-input-event 监听、Accelerator 匹配、webContents 自动挂载
- `src/renderer.js` — 渲染进程：initShortcuts 函数、shortcut:triggered 事件分发

### webview 交互
- `src/renderer.js` — webview 创建和管理、executeJavaScript 注入点
- `src/webview-preload.js` — webview guest 预加载脚本注入点

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shortcut-manager.js**: 完整的快捷键拦截和分发基础设施，before-input-event 监听覆盖所有 webContents（包括 webview guest），可直接扩展 Vim 快捷键处理
- **initShortcuts()**: 渲染进程快捷键分发函数，switch-case 结构，可添加 Vim 快捷键分支
- **webview.executeJavaScript**: webview guest 脚本注入点，可用于注入滚动控制和 hint overlay

### Established Patterns
- **before-input-event 监听**: app.on('web-contents-created') 自动给新 webContents 挂监听
- **Accelerator 匹配**: parseAccelerator + matchInput 精确匹配按键组合
- **快捷键配置**: DEFAULT_SHORTCUTS + electron-store 持久化自定义覆盖
- **webview guest 注入**: 通过 executeJavaScript 或 preload 脚本注入页面逻辑

### Integration Points
- **shortcut-manager.js**: 需要扩展 Vim 快捷键识别和分发逻辑
- **src/renderer.js**: 需要添加 Vim 快捷键处理分支（滚动、hint、搜索等）
- **webview guest**: 需要注入滚动控制脚本和 hint overlay DOM/CSS
- **settings**: 可选：添加 Vim 快捷键开关配置

</code_context>

<specifics>
## Specific Ideas

- Vimium 风格的 hint overlay：黄色背景 + 黑色文字 + 等宽字体
- 滚动行为参照 Vimium 默认值（j/k 约 100px，d/u 半屏，gg/G 首尾）
- 搜索框参考 Vimium 的底部搜索栏样式
- 快捷键帮助面板显示所有可用 Vim 快捷键列表

</specifics>

<deferred>
## Deferred Ideas

- 插入模式（i）— P2 优先级，后续版本实现
- Visual 模式 — 后续版本
- 用户自定义 Vim 快捷键映射 — 后续版本
- 命令模式（:）— 后续版本

</deferred>

---

*Phase: 39-Vimium 键盘操作功能*
*Context gathered: 2026-08-23*

# 加载进度条"加载完成后反复闪跑"问题分析与优化方向

> 2026-08-04 记录。现象：部分网页加载时，地址栏下方蓝色进度条在页面看似加载完成后还会快速重跑好几次。

## 现状机制

进度条是地址栏下方一条 2px 蓝条，纯 CSS 假进度，由渲染进程 webview 事件自驱动：

- HTML：`src/index.html:138` — `<div class="loading-bar" id="loadingBar">`
- CSS：`src/styles/main.css:1311-1344`
  - `.active`：`loading-progress` 关键帧 2s 无限循环（width 0%→80%→100%）
  - `.complete`：停动画、width 100%、0.3s 淡出
- JS：`src/renderer.js:843-860`，仅两个事件控制（门控 `tabId === state.activeTabId`）
  - `did-start-loading` → 加 `active`，移除 `complete`
  - `did-stop-loading` → 移除 `active`，加 `complete`
- 主进程不转发 loading 事件；切 tab 时 `showWebview`（`src/renderer.js:959-970`）用 `webview.isLoading()` 重同步状态，不重放事件。

## 根因分析

进度条反映的是 Chromium WebContents 的 loading 状态翻转，而非"页面视觉上加载完"。一次访问可产生多对 start/stop：

1. **JS 二次跳转（最常见）**：初始文档加载完 → `did-stop-loading` → 页面脚本执行 `location.href` / `location.replace` / meta refresh → 新一轮 start/stop。登录检查、地区/语言重定向、www↔裸域修正、consent 跳转均属此类，可链式多次。
   - 注：服务端 3xx 重定向属同一次导航，不会重复触发。
2. **跨文档 iframe/子框架加载**：广告、嵌入内容常在主文档完成后才开始加载，也会翻转 WebContents loading 状态。
3. **视觉放大效应**：动画是 2s 无限循环假进度，每次 start 从 0% 重跑；`complete` 淡出需 0.3s，淡出未完成就来下一次 start 时，视觉上"刚消失又冒出来"。

已排除的原因：

- SPA `pushState`/hash 变化走 `did-navigate-in-page`（`src/renderer.js:829`），不触发 loading 事件。
- tab 切换/webview re-attach 不会重放事件。

## 复现/验证方法

在 `src/renderer.js:843-860` 两个监听器中加日志观察事件序列：

```js
console.log('[loading] start', tabId, webview.getURL());
console.log('[loading] stop', tabId, webview.getURL());
```

## 优化方向（待评估）

- [ ] `complete` 淡出去抖：`did-stop-loading` 后延迟几百毫秒再淡出，期间若来新 `did-start-loading` 则直接续上，避免闪烁
- [ ] 改用更细粒度事件（如 `did-frame-navigate` / 资源计数）实现真实进度，替代 2s 假动画
- [ ] 调研是否过滤 subframe 引起的 loading 状态翻转（Chromium 层面行为，需确认可行性）

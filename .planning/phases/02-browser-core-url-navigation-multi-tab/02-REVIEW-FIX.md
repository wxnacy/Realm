---
phase: 02-browser-core-url-navigation-multi-tab
fixed_at: 2026-07-24T08:54:31Z
fix_scope: critical_warning
findings_in_scope: 20
fixed: 20
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-07-24T08:54:31Z
**Fix scope:** critical_warning（7 Critical + 13 Warning = 20 项，Info 不在范围内）
**Status:** all_fixed

## 说明

本次修复跨越两次会话完成：首次会话（因配额中断）在 worktree 分支上完成 CR-1/3/4/5/7 与 WR-1~WR-7 的主体工作；本次会话恢复未提交的 CR-6 修复、合并分支到 master，并完成剩余 WR-8~WR-13。每个发现一个原子提交。

## Critical（7/7 fixed）

### CR-1: webview 布尔属性语义反转 —— fixed (f1ad191)
移除 `WEBVIEW_ATTRIBUTES` 循环中 `nodeintegration`/`disablewebsecurity`/`allowpopups` 的字符串值写入（presence 语义下 `'false'` 反而开启），仅保留字符串型属性 `webpreferences: contextIsolation=yes`。

### CR-2: 02-03 交付的 4 个核心文件未被 git 追踪 —— fixed (a5ddb8a)
`main.js`、`tab-manager.js`、`ipc-handlers.js`、`src/preload.js` 已 `git add` 并提交。

### CR-3: Cookie 管理弹窗 innerHTML 存储型 XSS —— fixed (e6c49af)
`refreshCookiesList` 改为 DOM 构建 + `textContent` 渲染 cookie name/value/domain，攻击者可控数据不再进入 innerHTML。

### CR-4: 全部 IPC handler 未校验 event.sender —— fixed (9f896d2)
新增 `assertTrustedSender(event)`：经 `BrowserWindow.fromWebContents` 解析并与主窗口比对，全部 handler 入口强制校验。

### CR-5: closeTab 无条件重设 activeTabId —— fixed (cab8c93)
仅当被关闭的即为活动 Tab 时才重算邻位；关闭后台 Tab 保持 `activeTabId` 不变，消除双进程状态分裂。

### CR-6: 容器切换每次创建两个重复 Tab —— fixed (f173df8)
渲染进程 `switchContainer` 移除本地 `createTab`，Tab 创建统一由主进程推送的 `container-switched` 事件（`handleContainerSwitched`）驱动。

### CR-7: windowContainerMap 键空间错误 —— fixed (12c2d8d)
handler 侧统一经 `BrowserWindow.fromWebContents(event.sender)` 取 `win.id` 作为键，杜绝 webContents.id 与 BrowserWindow.id 混用。

## Warning（13/13 fixed）

### WR-1: new-window 事件在 Electron 32 已移除 —— fixed (ebd48a4)
主进程 `web-contents-created` 中对 webview guest 挂 `setWindowOpenHandler`：一律 deny 独立窗口，经 host webContents 转发 `open-url-in-tab`，渲染进程 `handleOpenUrlInTab` 在对应容器新建 Tab（D-09）。

### WR-2: will-navigate 的 preventDefault 无效 —— fixed (b1a1ed8)
重定向逻辑移至主进程 webContents 的 `will-navigate`（可同步取消）：规则命中其他容器时 `preventDefault()` 并通知渲染进程在匹配容器建 Tab，消除双重导航。

### WR-3: 页内导航 URL 不回写主进程 —— fixed (65c5228)
`did-navigate` 与 `did-navigate-in-page` 均调用 `realmAPI.updateTab(tabId, { url })` 持久化，重启恢复不再回到过期地址。

### WR-4: 主进程回收 Tab 不通知渲染进程（幽灵 Tab）—— fixed (e2ed021)
回收策略单点保留在主进程：`tab-manager` 新增 `setRecycleListener`，回收时经 `tab:recycled` 事件推送（含提示文案），渲染进程 `handleTabRecycled` 移除对应 DOM/webview 并 toast；删除渲染进程侧 `TAB_MAX_COUNT`/`recycleOldestTab`/`TAB_RECYCLE_MESSAGE` 死代码。

### WR-5: window.prompt() 在 Electron 中不受支持 —— fixed (cdea12d)
实现自定义按键捕获 dialog（与现有 `<dialog>` 模态框风格一致），keydown 组合经 `acceleratorFromEvent` 生成 accelerator 后调用 `shortcut:set`。

### WR-6: before-quit 异步 Cookie 保存不被等待 —— fixed (11bcbdc)
`before-quit` 中先 `event.preventDefault()`，`await cookieManager.saveAllCookies()` 完成后再显式 `app.quit()`，以 `cookiesSaved` 标志防止二次拦截。

### WR-7: 渲染页面缺少 CSP —— fixed (075a1aa)
`src/index.html` 增加 `<meta http-equiv="Content-Security-Policy">`（default-src 'self' 等），webview 标签不受宿主页 CSP 约束，不影响浏览功能。

### WR-8: macOS activate 重建窗口后全局快捷键静默失效 —— fixed (cac31bf)
`activate` 重建窗口后先 `shortcutManager.unregisterAll()` 再 `registerShortcuts(mainWindow)`，避免 `isRegistered` 跳过导致旧闭包持有已销毁窗口引用。

### WR-9: webview 加载缺少 URL scheme 白名单 —— fixed (ef459d3)
`createWebviewForTab` 入口统一校验：仅 http(s) 允许写入 webview src（空 URL 与 about:blank 放行），违规拒绝并 warn；主进程 `will-navigate` 拦截（WR-2）与 `handleOpenUrlInTab` 入口校验（WR-1）构成纵深防御。

### WR-10: initTabs 对损坏的持久化数据无防御 —— fixed (ff3b152)
`tabs` 先做 `Array.isArray` 校验并逐项检查形状；`tabCounter` 要求非负整数；`activeTabId` 要求字符串且存在。损坏数据降级为忽略并 warn，不再导致启动崩溃。

### WR-11: loadFile 使用相对路径 —— fixed (0188f2d)
`mainWindow.loadFile(path.join(__dirname, 'src/index.html'))`，与同文件 preload 路径写法一致，规避打包后 CWD 不确定导致的白屏。

### WR-12: 容器增删改后快速访问入口不刷新 —— fixed (8d38b18)
`loadContainers()` 追加 `renderContainerShortcuts()` 调用。

### WR-13: 容器名称/pattern/颜色等经 innerHTML 注入 —— fixed (c7cfef5)
`renderContainerList`/`renderContainerPanelList`/`renderRulesList`/`renderShortcutsList` 全部改为 DOM 构建 + `textContent`（颜色经 DOM style 属性赋值）；主进程 `validateContainerConfig`/`validateContainerUpdates` 增加颜色 `/^#[0-9a-fA-F]{6}$/` 白名单与图标单字符限制。

## 范围外说明

Info 级发现（IN-1~IN-7，共 7 项）不在本次 fix scope（critical_warning）内，未处理。主要包括：生产路径 console 输出治理、死代码清理（`elements.welcomePage`、`.welcome-*` 样式、`state.tabCounter`、tab 滚动按钮 `.visible` 接线）、未使用的 `cookie:save/load/export/import` 通道最小化、Tab DOM 构建重复代码抽取、`.browser-view` 定位上下文、`tab:update` 字段类型校验。建议后续以 `--all` 或专项重构处理。

## 验证

- 全部修改文件通过 `node --check` 语法校验
- 20 个原子提交（7 个 Critical 提交 + 13 个 Warning 提交）线性落在 master
- 未追踪文件（container-manager.js、cookie-manager.js、assignment-rules.js、shortcut-manager.js）保持未追踪状态，未被误加入 git

_Fixer: Claude (主会话直接修复，因子代理配额 429 连续受限，经用户确认后接管）_
_Iteration: 1 (非 --auto 模式）_

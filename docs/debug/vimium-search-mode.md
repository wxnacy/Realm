# Vimium 搜索模式（`/`）排查实录

## 问题概述

Vimium 搜索模式（按 `/` 唤起搜索栏）在实现和联调过程中暴露出多个层级的设计缺陷，涉及主进程按键拦截、renderer 命令分发、guest 注入脚本生命周期、焦点状态同步四个层面。本实录记录完整修改脉络和剩余 open issues。

---

## 功能目标

按 `/` 后页面底部出现搜索栏，输入关键词实时高亮匹配并显示计数（如「第 3/12 个匹配」），Enter 确认后按 `n` 跳下一个、`N` 跳上一个，`Esc` 退出搜索并清除高亮。

---

## 架构链路

> 2026-08-24 重构后的现行链路（重构前链路见文末「修改脉络」各节）：

```
用户按 /
  └─ before-input-event (shortcut-manager.js)
      └─ VimStateMachine.processKey('/') → 'searchMode'
          └─ 同步置位 searchInputActive=true（主进程本地，零竞态）
          └─ vim:triggered IPC → renderer.js
              └─ injectSearchBar() → webview.executeJavaScript(搜索栏脚本)
                  └─ guest 内部：输入框 focus + 主动 sendFocusState(true)
                      输入阶段主进程跳过全部 Vim 处理，按键直达输入框
                      ├─ input 事件防抖 → sendVimCommand('findInPage') 实时预览（findNext:true）
                      ├─ Enter → sendVimCommand('searchConfirm') → 进入 n/N 导航阶段
                      └─ Escape/焦点离开 guest → sendVimCommand('searchModeExit') → exitVimSearch()
```

回车后的 `n`/`N` 导航：
```
用户按 n（searchActive=true，Enter 确认后才开启）
  └─ before-input-event
      └─ VimStateMachine.processKey('n') → 'searchNext'
          └─ vim:triggered → renderer
              └─ webview.findInPage(text, {findNext: true, forward: true})
```

---

## 修改脉络

### 1. 初始实现（Plan 02）

`src/renderer.js` 的 `injectSearchBar` 通过 `webview.executeJavaScript` 向 guest 注入完整搜索栏 DOM 和事件处理。核心逻辑：
- 输入框 `input` 事件 300ms 防抖调用 `findInPage`
- `Enter` 键发送 `findInPage` 命令
- `Escape` 键发送 `searchModeExit` 命令
- 通过 `window.postMessage` 回传 `found-in-page` 计数到搜索栏

**初始缺陷**：
- 注入脚本有 `if (document.getElementById('realm-vimium-search')) return;` 防重复，但退出时只是 `display: none`，导致第二次按 `/` 无法重新注入。
- 回车后输入框仍保留焦点，`isInInput` 始终为 true，所有 Vim 单键命令被主进程拦截（包括 `n`/`N`）。

### 2. 修复重复注入问题

将退出逻辑从 `display: none` 改为彻底 `remove()` 搜索栏 DOM 和 style 元素：

```javascript
// 注入前清理旧元素
var existing = document.getElementById('realm-vimium-search');
if (existing) existing.remove();
var existingStyle = document.getElementById('realm-vimium-search-style');
if (existingStyle) existingStyle.remove();

// Escape 时彻底移除
container.remove();
style.remove();
```

### 3. 修复回车后 n/N 不工作

回车处理新增隐藏搜索栏 + blur 输入框：

```javascript
if (e.key === 'Enter') {
  // ... send findInPage ...
  container.style.display = 'none';
  input.blur();
}
```

这样 `isInInput` 回 false，`n`/`N` 才能被主进程识别并派发到 renderer。

### 4. 修复搜索模式下 j/k/o/x 等单键仍触发 Vim 命令

`src/vimium/vimium-manager.js` 的 `processKey` 中，`searchActive` 分支原实现：

```javascript
if (this.searchActive) {
  const lowerKey = key.toLowerCase();
  if (lowerKey === 'n') {
    return shift ? 'searchPrev' : 'searchNext';
  }
  // 隐式 fallthrough 到下方 SINGLE_KEY_MAP
}
```

非 `n`/`N` 按键会继续走到 `SINGLE_KEY_MAP['j'] = 'scrollDown'` 等映射，导致搜索输入过程中页面滚动/关闭标签等副作用。

修复：在 `searchActive` 分支末尾加 `return null;`，让非 `n`/`N` 按键完全不触发 Vim 命令，由 guest 正常处理（输入框接收字符或页面接收事件）。

### 5. realm:// 内部页面也支持 Vim（连带修改）

`src/webview-preload.js` 原先把 `localhost`（即 realm:// 内部页）完全排除在 Vim 焦点检测之外：

```javascript
const _isVimInternalPage = window.location.hostname === 'localhost';
if (!_isVimInternalPage) { /* 绑定 focusin/focusout */ }
```

这导致 realm://viewsource 等页面上搜索栏输入时，焦点状态不会上报，单键命令照样被拦截。修复：移除该排除条件，所有页面都绑定焦点检测。

---

## 已知剩余问题（Open Issues）

> 2026-08-24 架构重构后复核：Issue A/B/C/D 已随「searchInputActive 同步标志」重构修复，
> 详见下方「架构重构（2026-08-24）」。Issue E 保留为体验优化项。

### Issue A：搜索栏输入时 j/k 仍触发页面滚动（已修复）

**原根因**：链路依赖三条异步 IPC 状态（guest 焦点三级跳上报、`searchActive` 同步、DOM 注入），
而 `before-input-event` 是同步拦截的，按键永远跑在状态前面。输入框已有焦点但
`vimFocusStates` 上报未到时，`j`/`k`/`o` 被当作 Vim 命令拦截。

**修复**：主进程新增 `searchInputActive` 标志，在派发 `searchMode` 命令的同一处同步置位
（对标 `hintModeActive` 的成熟做法）。输入阶段主进程跳过所有 Vim 处理，按键直达搜索框，
不再依赖任何异步焦点上报。

### Issue B：realm:// 页面搜索模式偶发无响应（已修复）

**修复**：注入脚本挂载点改为 `document.body || document.documentElement` 兜底；
脚本返回布尔值，注入失败时 renderer 回退主进程 `searchInputActive`，防止按键持续被吞。

### Issue C：搜索模式与 findInPage 计数不同步（已修复）

**修复**：退出统一走 `exitVimSearch()`，显式调用 `stopFindInPage('clearSelection')` 清除高亮；
计数 message 监听改为全局单例 + 查询时取当前 DOM，不再因重复注入堆积闭包死引用。

### Issue D：n/N 在搜索栏隐藏后偶发失效（已修复）

**修复**：`searchActive`（n/N 导航）改为 Enter 确认（`searchConfirm`）后才开启，
输入阶段完全不开启；Enter 时 guest 主动 `sendFocusState(false)` 同步焦点状态，
不再依赖 focusout 三级跳上报。残留极限场景：Enter 后 IPC 往返前按 `n` 会放行到页面
丢失一次按键，无字符损失，可接受。

### Issue E：搜索栏实时搜索与高亮闪烁（保留）

**现象**：每输入一个字符，页面 `findInPage` 高亮区域闪烁重绘，体验不佳。

**潜在修复方向**：
- 方案 1：缩短防抖到 100ms 或取消实时搜索，改为仅 Enter 时执行。
- 方案 2：像 Vimium 原版一样用 JS 自定义高亮（TextNode 遍历 + Range 包装），避免 `findInPage` 的闪烁和计数不准问题。

### Issue F：Enter 确认后无高亮，需按 n 才出现（2026-08-24 已修复）

**现象**：正常输入完单词回车后输入框消失，但页面没有立马出现搜索高亮，要按下 `n` 才开始显示。

**根因（真实环境实证，playwright _electron + sendInputEvent 驱动）**：
Electron webview 的 `findInPage` 存在未文档化行为——
**全新 find 会话（或 `stopFindInPage` 之后）的首次 `findInPage(text, {findNext:false})`
既不绘制高亮也不触发 `found-in-page` 事件**；`findNext:true` 才会高亮全部匹配、
激活首个匹配并回传计数。原实现预览和 Enter 确认都用 `findNext:false` → 视觉上什么都没发生，
按 `n`（`findNext:true`）才激活。

**修复**：预览与确认统一改用 `findNext:true`（预览期文本逐字变化，每次都是新词定位第一个匹配）；
Enter 确认时若与预览词相同则**跳过** `findInPage`（否则 `findNext:true` 会把激活匹配前移到第二个）。

**附注**：预览期间 Chromium 增量查找的 `found-in-page` 计数在缩词时可能短暂不准
（如 "noe" 报 matches:1），Enter/n/N 时重新计数准确。若在意计数精度，走 Issue E 方案 2 自绘高亮。

### Issue G：输入过程中偶发提前结束输入模式并残留旧词高亮（2026-08-24 已修复）

**现象**：偶发——如输入 "nodejs"，输到 `j` 时搜索框突然消失，页面却高亮了部分词 "node"。

**根因**：findInPage 激活匹配时可能把焦点转移到页面内元素（匹配落在可编辑元素等场景），
搜索框 `blur` → 旧逻辑「失焦即退出」触发 `searchModeExit` → 搜索栏移除；
而 `stopFindInPage` 与已发出的预览 `findInPage` 存在竞态，高亮在清除后又绘出，残留旧词高亮。

**修复**：blur 处理改为延迟一帧判定——焦点仍在 guest 文档内（被页面元素抢走）则
`input.focus()` 夺回（搜索栏是模态输入）；焦点真正离开 guest（点工具栏/切窗口）才退出搜索。

---

## 架构重构（2026-08-24）

### 统一根因

重构前所有表象（输入中提前进入搜索导航、按键经常失效、Esc 后 `/` 无响应、n/N 竞态）
指向同一个设计缺陷：**搜索模式的判定依赖异步 IPC 状态，而按键拦截是同步的**。

1. `vimFocusStates[guestId]`：guest focusin/focusout → sendToHost → renderer → invoke → main（三级跳）
2. `VimStateMachine.searchActive`：renderer invoke → main（异步）
3. 搜索栏 DOM 注入：executeJavaScript → guest（异步）

### 新按键模型

```
按 /（导航阶段或普通模式）
  └─ 主进程 processKey → 'searchMode'
      └─ 同步：searchInputActive=true, searchActive=false（同一处代码，零竞态）
      └─ 派发 vim:triggered → renderer injectSearchBar
          └─ guest：输入框 focus + 主动 sendFocusState(true)
              输入阶段：主进程跳过全部 Vim 处理，按键直达输入框
              ├─ input 防抖 → sendVimCommand('findInPage') 实时预览（findNext:true，否则不高亮无计数）
              ├─ Enter → sendVimCommand('searchConfirm', {text})
              │   └─ renderer：存 vimSearchText +（确认词≠预览词才）findInPage
              │       + setVimSearchInputActive(false) + setVimSearchActive(true)
              │       → 进入 n/N 导航阶段（普通命令仍可用，与 Vimium 一致）
              ├─ Escape → sendVimCommand('searchModeExit') → renderer exitVimSearch()
              └─ 失焦 → 延迟一帧判定：焦点在 guest 内被抢（find 激活匹配等）则夺回；
                  离开 guest（点工具栏/切窗口）才走 searchModeExit 退出
```

### 状态泄漏防护

`exitVimSearch()`（renderer 统一退出入口，幂等）在以下时点调用：
Escape、空输入回车、焦点离开 guest、**切换 Tab**、**关闭活动 Tab**、**活动 Tab 跨页导航**。
主进程侧兜底：派发 `searchMode`/`searchModeExit` 时同步清置标志；
帮助对话框打开时丢弃 `searchMode` 会回退 `searchInputActive`；
注入失败（无 webview/无挂载点/executeJavaScript 异常）也会回退。

### 导航阶段键位语义（vimium-manager.js searchActive 分支）

- `n`/`N` → searchNext/searchPrev
- `/` → searchMode（重开搜索，主进程同步切回输入阶段）
- `Escape` → searchModeExit
- 其余按键落入常规映射（等价普通模式 + n/N，与 Vimium 一致）

---

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/renderer.js` | `injectSearchBar` 搜索栏注入脚本（DOM 创建/事件/销毁逻辑，2026-08-24 重写） |
| `src/renderer.js` | `exitVimSearch` 统一退出入口；switchTab/closeTab/did-navigate 状态泄漏清理 |
| `src/renderer.js` | `initVimShortcuts` 中 `searchMode`/`searchConfirm`/`findInPage`/`searchNext`/`searchPrev`/`searchModeExit` 命令处理 |
| `src/vimium/vimium-manager.js` | `searchActive` 分支：n/N 导航 + `/` 重开 + Escape 退出 + 其余键落常规映射 |
| `shortcut-manager.js` | `searchInputActive` 同步标志（派发 searchMode 时置位）；`vim:set-search-active` / `vim:set-search-input-active` IPC |
| `src/webview-preload.js` | 移除 Vim 焦点检测对 localhost 页面的排除 |
| `src/preload.js` | `setVimSearchActive` / `setVimSearchInputActive` 暴露 |

---

## 相关代码位置

- `shortcut-manager.js:277-330` — before-input-event Vim 快捷键处理（含 searchInputActive 同步置位）
- `src/vimium/vimium-manager.js:147-162` — searchActive 导航阶段分支
- `src/renderer.js:2135-2280` — injectSearchBar
- `src/renderer.js:2283-2300` — exitVimSearch
- `src/renderer.js:2784-2810` — findInPage / searchConfirm / searchModeExit 命令处理
- `src/webview-preload.js:500-554` — 焦点检测上报

---
phase: 28-player
reviewed: 2026-08-08T12:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - package.json
  - ipc-handlers.js
  - src/preload.js
  - src/renderer.js
  - media-sniffer.js
  - src/player.html
  - src/player.js
  - src/player.css
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-08-08T12:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 28 为 Realm Browser 增加了独立播放器窗口（player.html/js/css）、媒体嗅探引擎（media-sniffer.js）和相关 IPC 通道。本次审查覆盖 8 个变更文件，发现 **1 个阻断级语法错误**（media-sniffer.js 类定义后方法漂移导致文件无法加载）、**4 个警告**（CSP 过宽、`type` 属性未转义、`videos` 参数未校验、`FILTERED_URL_RE` 每次重建）和 **3 个信息级问题**（正则重复创建、未验证项、旧闭合大括号残留）。

## Critical Issues

### CR-01: `getMediaListByContainer` 定义在类外部 -- 语法错误，应用无法启动

**File:** `media-sniffer.js:370-392`
**Issue:** `MediaSniffer` 类在第 370 行关闭（`}`），但 `getMediaListByContainer` 方法定义在第 378 行，位于类体之外。第 392 行残留一个孤立的闭合大括号。Node.js 无法解析此文件（`SyntaxError: Unexpected token '{'`），导致 `require('./media-sniffer')` 时整个应用崩溃。

```
$ node -c media-sniffer.js
SyntaxError: Unexpected token '{' at line 378
```

所有依赖 `media-sniffer` 的功能（主进程 IPC、嗅探、播放器窗口）全部不可用。

**Fix:**
将 `getMediaListByContainer` 方法移入类体，并删除第 392 行的孤立 `}`：

```javascript
// 第 369 行之后（_getContainerIdForWebContents 方法的 return null; } 之后）
// 直接添加 getMediaListByContainer 方法，然后用一个 } 关闭整个类

  /**
   * 获取指定容器的全部媒体列表
   * @param {string} containerId - 容器 ID
   * @returns {Array<MediaItem>}
   */
  getMediaListByContainer(containerId) {
    if (!containerId) return [];
    const result = [];
    for (const [wcId, list] of this.mediaMap) {
      const cid = this._getContainerIdForWebContents(wcId);
      if (cid === containerId) {
        result.push(...list);
      }
    }
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
  }
}  // <-- 唯一的类闭合大括号

module.exports = new MediaSniffer();
```

## Warnings

### WR-01: `player.html` CSP 过于宽松 -- `'unsafe-eval'` 和通配符 `connect-src`

**File:** `src/player.html:6`
**Issue:** Content-Security-Policy 允许 `'unsafe-eval'`（可执行 `eval()`/`new Function()`）和 `connect-src *`（可向任意 HTTP 端点发起请求）。如果播放器加载含恶意脚本的页面（如用户嗅探到的第三方视频站点 URL），攻击者可通过 XSS 在播放器窗口执行任意代码或外传数据。

`'unsafe-inline'` 对播放器是可接受的（内联样式），但 `'unsafe-eval'` 和 `connect-src *` 不是。

**Fix:**
收紧 CSP，移除 `'unsafe-eval'`，限制 `connect-src` 为必要范围：

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self' 'unsafe-inline';
  media-src * blob: data:;
  connect-src 'self' blob: data: https:;
  worker-src 'self' blob:;
  img-src * blob: data:
">
```

注：`connect-src https:` 仍允许所有 HTTPS 端点（视频流 CDN 需要），但禁止 `http:` 明文请求和 `eval`。

### WR-02: `renderMediaList` 中 `type` 值未转义即拼入 HTML

**File:** `src/renderer.js:5199-5200`
**Issue:** 媒体类型 `type` 直接拼入 class 属性和元素内容，未经过 `escapeHtml()` 处理：

```javascript
return `
  <div class="media-item" data-url="${escapeHtml(item.url)}" data-index="${index}">
    <span class="media-type-badge media-type-${type}">${type}</span>
```

虽然当前 `MediaSniffer.classifyUrl` 只返回已知值（`m3u8`/`mp4`/`flv`/`webm`/`unknown`），但 `media:report-detected` IPC 接口接受渲染进程上报的任意 `videos` 数组，`item.type` 来自不可信输入。如果 `type` 包含 `x" onmouseover="alert(1)`，可构成属性逃逸 XSS。

**Fix:**
对 `type` 值做白名单校验后再拼入模板：

```javascript
const ALLOWED_TYPES = new Set(['m3u8', 'mp4', 'flv', 'webm', 'unknown']);
const type = ALLOWED_TYPES.has(item.type) ? item.type : 'unknown';
```

### WR-03: `media:report-detected` IPC 未校验 `videos` 数组元素结构

**File:** `ipc-handlers.js:1476-1483`
**Issue:** `media:report-detected` 处理器仅检查 `webContentsId` 为 number、`videos` 为通过 `Array.isArray` 检查的数组，但不校验数组元素结构。恶意注入脚本可上报 `{ url: '', type: '<script>alert(1)</script>', source: 'dom' }` 等畸形数据，这些数据会原样存入 `mediaMap` 并在 `renderMediaList` 中渲染。

虽然 `assertTrustedSender` 限制了来源为主窗口，但注入脚本通过 `sendToHost` 绕过了发送方校验（webview guest 的 `ipc-message` 事件由渲染进程转发，渲染进程是受信方）。

**Fix:**
在 `handleScriptDetected` 中校验每个 video 项：

```javascript
handleScriptDetected(webContentsId, videos) {
  if (!webContentsId || !Array.isArray(videos)) return;
  let hasNew = false;
  for (const video of videos) {
    if (!video || typeof video.url !== 'string' || !video.url.startsWith('http')) continue;
    if (video.type && typeof video.type !== 'string') continue;
    const added = this.addMedia(webContentsId, video);
    if (added) hasNew = true;
  }
  // ...
}
```

### WR-04: `addMedia` 内部 `FILTERED_URL_RE` 正则每次调用都重新创建

**File:** `media-sniffer.js:137-138`
**Issue:** 正则表达式 `FILTERED_URL_RE` 在 `addMedia` 方法内部作为局部变量创建，每次添加媒体记录时都会重新编译。虽然性能影响在当前规模下可忽略，但这违反了项目规范中"常量放在文件顶部"的约定，且在高频嗅探场景（如页面加载数十个 `.ts` 分片被过滤时）会产生不必要的 GC 压力。

**Fix:**
将正则移至文件顶部常量区域：

```javascript
// 文件顶部常量区域
const FILTERED_URL_RE = /\.(ts|key)(\?|#|$)/i;

// addMedia 方法内直接使用
if (FILTERED_URL_RE.test(item.url)) return false;
```

## Info

### IN-01: `FILTERED_CONTENT_TYPES` Set 中含冗余大写条目

**File:** `media-sniffer.js:39-42`
**Issue:** `FILTERED_CONTENT_TYPES` 同时包含 `'video/mp2t'` 和 `'video/MP2T'`，但 `classifyContentType` 在第 111 行已对 `contentType` 执行 `toLowerCase()`，因此 `'video/MP2T'` 永远不会被匹配到。

**Fix:**
移除冗余条目：

```javascript
const FILTERED_CONTENT_TYPES = new Set(['video/mp2t']);
```

### IN-02: 播放器窗口暴露了完整的 `realmAPI` 和 `mediaAPI`

**File:** `ipc-handlers.js:1359-1360`, `src/preload.js`
**Issue:** 播放器窗口使用与主窗口相同的 `src/preload.js`，因此暴露了 `window.realmAPI`（容器管理、Cookie 操作、收藏、历史等全部 API）和 `window.mediaAPI`。播放器窗口只需 `playerAPI` 和 `mediaAPI.getMediaListForContainer`/`mediaAPI.copyMediaUrl`，其余 API（如 `deleteContainer`、`clearContainerCookies`）属于不必要的攻击面扩大。

**Fix:**
为播放器窗口创建独立的 preload 脚本（如 `src/player-preload.js`），仅暴露 `playerAPI` 和必要的 `mediaAPI` 子集。或者在 `player.js` 中通过 CSP 或代码约定限制 API 使用范围（长期方案：分离 preload）。

### IN-03: `unregisterGuestContainer` 直接访问 `mediaSniffer` 内部数据结构

**File:** `ipc-handlers.js:52`
**Issue:** `unregisterGuestContainer` 直接访问 `mediaSniffer.pendingByWcId` 内部 Map 进行删除操作，破坏了 `MediaSniffer` 类的封装性。如果 `pendingByWcId` 的内部实现变更（如重命名或改用 WeakMap），此处会产生静默失败。

**Fix:**
在 `MediaSniffer` 类上暴露一个公共方法：

```javascript
// MediaSniffer 类中
clearPending(webContentsId) {
  this.pendingByWcId.delete(webContentsId);
}

// ipc-handlers.js 中
function unregisterGuestContainer(contentsId) {
  guestContainerMap.delete(contentsId);
  mediaSniffer.clearPending(contentsId);
}
```

---

_Reviewed: 2026-08-08T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

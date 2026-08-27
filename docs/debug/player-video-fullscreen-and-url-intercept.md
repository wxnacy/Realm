# 播放器视频全屏显示与视频文件 URL 自动拦截问题排查实录

> 状态：已完成（2026-08-27）  
> m3u8 的具体拦截与播放方案见姊妹文档 [`m3u8-webview-player-route-a.md`](./m3u8-webview-player-route-a.md)，本文档聚焦「播放器窗口视频最大化」与「地址栏视频 URL 的拦截策略取舍」。  
> 影响文件：`src/player.css`、`src/player.js`、`src/preload.js`、`ipc-handlers.js`、`main.js`、`src/renderer.js`

## 一、现象（2026-08-26）

### 问题 1：Realm Player 独立窗口视频未最大化

在 Realm Player 独立窗口（`src/player.html`，由媒体面板点击打开）中播放视频时，画面未按宽高比最大化显示——只在窗口中间一小块，四周大量黑边。

### 问题 2：webview 中直接打开视频文件 URL 时画面过小

地址栏输入视频文件 URL（如 `https://v.lz15uu.com/.../index.m3u8`）时，视频在 webview 里原生播放，大小由浏览器默认样式控制，只显示在中间一小块。

### 问题 3（引入）：地址栏输入视频 URL 自动弹出播放器被视为 Bug

尝试实现「视频文件 URL 自动用 Realm Player 独立窗口打开」后，用户在地址栏输入视频 URL 即自动弹出独立播放器窗口。用户反馈这是不期望的行为——希望保留在 webview 中直接播放的选择权。

---

## 二、已修复：播放器窗口内视频最大化 + 全屏同步（2026-08-26）

**`src/player.css`** — `video` 元素 `position: absolute; inset: 0; display: block`，绝对定位覆盖整个容器。

**`src/player.js`** — `toggleFullscreen` 改为 `async`，用 IPC 返回值立即更新图标；抽离 `updateFullscreenUI` 统一处理图标和 `body.fullscreen` 类；新增 `onFullscreenChanged` 监听主进程广播。

**`src/preload.js`** — 暴露 `playerAPI.onFullscreenChanged`，监听 `player:fullscreen-changed`。

**`ipc-handlers.js`** — `playerWindow` 创建时监听 `enter-full-screen`/`leave-full-screen` 事件，通过 `player:fullscreen-changed` 通知渲染进程。

> 状态：**全屏同步与窗口内视频最大化已修复并通过真实环境验证**（详见 [`m3u8-webview-player-route-a.md` 第五节验证清单](./m3u8-webview-player-route-a.md) 第 7、8 项）。

---

## 三、拦截策略取舍：否决「自动弹出独立窗口」，改走方案 A（2026-08-27）

### 旧尝试（已回滚，不再存在于代码）

最初为实现「地址栏视频 URL 自动打开独立播放器」做了三处拦截：

- `main.js` `will-navigate`：检测视频文件扩展名（`.m3u8/.mp4/.webm/.flv/.mpd/.mov/.mkv/.avi`），取消导航并发送 `media:play-direct` IPC；
- `main.js` `did-navigate`：兜底 `contents.stop()` + 发送 IPC；
- `src/preload.js` `mediaAPI.onPlayMediaDirect` + `src/renderer.js` `media:play-direct` 监听。

### 旧方案的两类失败（即原「阻塞 1/2」）

1. **`did-navigate` 兜底的 `ERR_FAILED`**：`did-navigate` 触发时导航**已完成**，此时 `contents.stop()` 相当于停止一个已完成的加载，Electron 抛 `ERR_FAILED`。`stop()` 应在加载过程中调用，而非导航完成后。
2. **拦截后独立窗口仍未弹出**：时序（`init()` 监听器注册晚于 IPC 发送）、媒体开关/白名单静默拒绝、`getGuestContainerId` 返回 `null` 等多重隐患。更深层的是——`did-start-navigation` 中调用 `contents.stop()` 会导致主进程 **SIGTRAP 闪退**。

### 用户决策：自动弹出本身是 Bug（原「阻塞 3」）

用户明确表示「地址里播放视频时会自动弹出独立播放器」是不可接受的行为。结论：不应在 `will-navigate`/`did-navigate` 中一刀切拦截并弹出独立窗口。

### 最终方案 A（当前实现）

不再弹独立窗口，改为：**导航到 `.m3u8` 时，在当前 tab 内加载 Realm Player 页面，由 hls.js 转码播放**（参考 Chrome 扩展 hlsplayer 的机制）。

- `main.js` `will-navigate`：`.m3u8` 结尾 URL → `event.preventDefault()` → `setImmediate(() => contents.loadURL(playerUrl))`，避免 `preventDefault` 后立即 `loadURL` 触发 `ERR_FAILED`；
- 非 m3u8 视频文件（mp4/webm/flv 等仍原生播放）：`did-navigate` 注入 CSS 强制 `video` 铺满视口（`width:100vw;height:100vh;object-fit:contain`），画面过小问题随之解决；
- 独立播放器窗口（媒体面板打开，file:// 加载）保留，行为不变，仅不再被地址栏导航自动触发。

> 落地细节（代理同源化、防重复包装、各导航入口穷举、收藏栏遗漏修复等）见 [`m3u8-webview-player-route-a.md`](./m3u8-webview-player-route-a.md) 第七、八节。

---

## 四、相关文件与代码位置

| 文件 | 相关位置 | 说明 |
|------|---------|------|
| `src/player.css` | `video` / `#player` / `body.webview-player` | 视频绝对定位铺满、webview 模式下隐藏标题栏 |
| `src/player.js` | `initPlayer` / `toggleFullscreen` / `updateFullscreenUI` / `onFullscreenChanged` | hls.js 播放、全屏同步 |
| `src/preload.js` | `playerAPI.onFullscreenChanged` | 全屏状态广播监听 |
| `ipc-handlers.js` | `playerWindow` 创建处 | 全屏事件广播 `player:fullscreen-changed` |
| `main.js` | `will-navigate` | m3u8 拦截转当前 tab 播放器页面 |
| `main.js` | `did-navigate` | 非 m3u8 视频文件注入铺满 CSS |
| `src/renderer.js` | `maybePlayerUrl` / `createWebviewForTab` / 地址栏 / 自动补全 / 收藏栏 | 所有导航入口统一走 `maybePlayerUrl` 转换 |

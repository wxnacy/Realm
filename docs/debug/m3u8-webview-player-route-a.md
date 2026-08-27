# m3u8 视频在当前 webview tab 内播放 — 方案 A 实现记录

> 状态：已完成（2026-08-27）。两个阻塞问题已修复，修复方案见第七节  
> 相关文件：`main.js`、`src/renderer.js`、`src/player.js`、`src/player.css`、`src/preload.js`、`ipc-handlers.js`、`media-sniffer.js`  

---

## 一、方案设计（路线 A）

**目标**：在 webview 中导航到 `.m3u8` URL 时，**不弹出独立播放器窗口**，而是**在当前 tab 内加载 Realm Player 页面**，由 hls.js 转码播放。

**参考实现**：Chrome 扩展（如 chrome-hls / hlsplayer.org）的核心机制——拦截 m3u8 导航后，在当前标签页加载一个包含 hls.js + video 标签的播放器页面。

**Realm 中的具体做法**：
1. 在本地 HTTP 服务器新增 `/player` 路由，映射 `src/player.html`
2. 新增 `/node_modules/*` 路由，让播放器页面能加载 hls.js/mpegts.js/dashjs
3. 导航到 `.m3u8` URL 时，将其替换为 `http://localhost:${PORT}/player/?url=${encodeURIComponent(m3u8Url)}`
4. `player.js` 检测到 `?url=` 参数后进入「webview tab 模式」：隐藏自定义标题栏，直接从参数初始化播放

---

## 二、已完成的修改

### 1. `main.js`

| 位置 | 改动 |
|------|------|
| 顶部全局变量 | 新增 `let realmPort = 0`，在 `realmServer.listen` 回调中赋值 |
| `will-navigate` (~L388) | 恢复 m3u8 拦截：`.m3u8` 结尾的 URL → `event.preventDefault()` → `setImmediate(() => contents.loadURL(playerUrl))`。`setImmediate` 是为避免 `preventDefault` 后立即 `loadURL` 触发 `ERR_FAILED` |
| `did-navigate` (~L296) | 视频文件 URL（mp4/webm/flv 等）注入 CSS 强制 video 铺满视口（`width:100vw;height:100vh;object-fit:contain`） |
| HTTP 服务器路由 (~L1989) | 新增 `/player` → `src/player.html`，`/player/*` → `src/*`；新增 `/node_modules/*` → 项目根目录 `node_modules/*` |
| 路径遍历检查 (~L2004) | 安全检查从仅 `src` 目录扩展为 `src` 或 `node_modules` 目录 |

### 2. `src/renderer.js`

| 位置 | 改动 |
|------|------|
| `maybePlayerUrl(url)` (新增, ~L332) | 检测 `.m3u8` 结尾则替换为播放器页面 URL |
| `createWebviewForTab` (~L1029) | `webview.src` 设置前调用 `maybePlayerUrl(url)` |
| 地址栏回车导航 (~L5993) | `webview.loadURL` 前调用 `maybePlayerUrl(normalizedUrl)` |
| 自动补全选中导航 (~L5360) | `webview.loadURL` 前调用 `maybePlayerUrl(suggestion.url)` |

### 3. `src/player.js`

| 位置 | 改动 |
|------|------|
| 启动逻辑 (~L247) | 检测 `URLSearchParams.get('url')`。若存在则进入 webview tab 模式：`document.body.classList.add('webview-player')`，清空播放列表，直接 `initPlayer(paramUrl)` |
| `updateFullscreenUI` (新增, ~L493) | 抽离全屏图标更新逻辑 |
| `toggleFullscreen` (~L503) | 改为 async，用 IPC 返回值更新 UI |
| `onFullscreenChanged` (新增, ~L513) | 监听主进程广播的全屏状态变化 |

### 4. `src/player.css`

| 位置 | 改动 |
|------|------|
| `#player` (~L46) | 增加 `position:absolute;inset:0;display:block` |
| `body.webview-player #title-bar` (新增, ~L75) | `display:none` 隐藏自定义标题栏 |
| `body.webview-player #player` (新增, ~L79) | `top:0` 让视频顶到视口顶部 |

### 5. `src/preload.js`

| 位置 | 改动 |
|------|------|
| `playerAPI.onFullscreenChanged` (新增, ~L1396) | 暴露 IPC 监听 `player:fullscreen-changed` |

### 6. `ipc-handlers.js`

| 位置 | 改动 |
|------|------|
| `playerWindow` 创建后 (~L1862) | 监听 `enter-full-screen`/`leave-full-screen`，向渲染进程广播 `player:fullscreen-changed` |

---

## 三、已回滚的尝试（不再存在于代码中）

- `main.js` `did-navigate` 中的视频文件兜底拦截（`contents.stop()` 在导航完成后调用会抛 `ERR_FAILED`，已移除）
- `main.js` `did-start-navigation` 中的 m3u8 兜底拦截（`contents.stop()` 在该事件中调用会导致主进程 **SIGTRAP 闪退**，已移除）
- `src/preload.js` `mediaAPI.onPlayMediaDirect`（自动弹出独立播放器的旧方案，已移除）
- `src/renderer.js` `media:play-direct` 监听（同上，已移除）

---

## 四、阻塞问题（已修复，根因见第七节）

### 问题 1：从收藏夹点击 m3u8 链接没有跳转 /player

**现象**：地址栏直接输入 m3u8 URL 可以触发拦截，但从收藏夹页面（`realm://favorites`）中点击收藏的 m3u8 链接，当前 tab 仍显示空白/错误页面，没有加载播放器页面。

**复测结论（2026-08-27）**：链路本身（`window.open` → `setWindowOpenHandler` → `open-url-in-tab` → `createTab` → `createWebviewForTab` → `maybePlayerUrl`）是通的，playwright 实测收藏夹 guest 内 `window.open(m3u8)` 能正确创建播放器 tab。当时的失败现象与问题 2 同源——收藏的是防盗链/CORS 受限的 URL，播放器页面加载后 hls.js 拉流失败显示错误，被误认为"没有加载播放器页面"。地址栏测试用的是 mux.dev（CORS 全开）所以能播。

---

### 问题 2：带有 `?ts=xxx` 查询参数的 m3u8 URL 在 /player 中提示「HLS 播放失败」

**现象**：无查询参数的 m3u8 URL（如 `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`）在播放器页面中可以正常加载，但带 `?ts=xxx` 后缀的 URL（如 `https://v.lz15uu.com/.../index.m3u8?ts=1787795518`）会触发 hls.js 致命错误，显示「HLS 播放失败」。

**确认根因**：播放器页面源是 `http://localhost:PORT`，hls.js 对外部视频源的 XHR 是**跨域请求**——视频服务器未返回 `Access-Control-Allow-Origin` 时浏览器直接拦截响应（CORS），叠加部分站点的 Referer 防盗链校验。mux.dev 返 `ACAO: *` 所以能播；`v.lz15uu.com` 一类站点不行。修复方案见第七节。

---

## 五、快速验证清单（2026-08-27 全部通过）

1. 地址栏输入 `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` → 当前 tab 加载播放器页面，视频正常播放（主清单 + 相对变体/分片均走代理）✅
2. 地址栏输入带 `?ts=` 的 m3u8 URL → 正常播放 ✅
3. 从收藏夹点击 m3u8 链接 → 当前 tab 加载播放器页面并播放 ✅
4. 网页内跳转 m3u8（`location.href` 模拟链接点击）→ will-navigate 拦截转播放器页面并播放，播放器 URL 携带来源页 referer ✅
5. 地址栏显示与 tab 持久化均为原始 m3u8 URL（非内部播放器地址）✅
6. 媒体面板不再混入 `/proxy` 代理 URL ✅
7. 媒体面板点击 m3u8 → 仍打开**独立播放器窗口**（独立窗口模式未修改）
8. 地址栏输入 mp4 URL → 仍在 webview 内原生播放（`did-navigate` CSS 注入铺满）

---

## 六、相关调试日志关键词

在终端过滤以下日志可快速定位问题：

```bash
# m3u8 拦截相关
"m3u8 导航拦截"
"播放器页面加载失败"

# 代理相关（console.warn 走 stderr，过滤日志要同时看 stderr）
"视频代理请求失败"

# player.js 启动模式
"webview tab 模式"
"HLS 播放失败"
"hls.js 致命错误"

# 收藏夹/新窗口
"新窗口请求"
"open-url-in-tab"
```

---

## 七、修复方案（2026-08-27）

### 核心：HTTP 服务器新增 `/proxy` 视频流代理

问题 2 的两类根因（CORS、Referer 防盗链）都由「播放器页面源是 localhost」引发。修复不是改 Referer 头或关 webSecurity，而是在内部 HTTP 服务器加 `/proxy` 端点，让 hls.js 的所有请求**同源化**：

```
player.js: hls.loadSource('/proxy?url=<原始m3u8>&token=..&container=..&referer=..')
    ↓ 同源请求，无 CORS
main.js /proxy: ses.fetch(原始 URL, { Referer, UA, 容器 session 带 Cookie })
    ↓ m3u8 响应 → rewriteM3u8ForProxy 重写清单
    ↓ 分片/子清单/密钥 URI 全部改写为 /proxy?url=<绝对URL>（含透传参数）
hls.js 后续请求全部走代理（绝对 URL，无需自定义 loader）
```

关键实现点：

| 位置 | 实现 |
|------|------|
| `main.js handleProxyRequest` | token 鉴权（与 /api 一致）；`ses.fetch` 用 `persist:container-<id>` session（携带 Cookie）；透传 Range 头（fMP4 字节范围）；流式 pipe 分片；非压缩时才转发 content-length（ses.fetch 透明解压会失真） |
| `main.js rewriteM3u8ForProxy` | 非 `#` 行（分片/变体子清单）与 `URI="..."` 属性（EXT-X-KEY/MAP/MEDIA 等）统一改写为 `/proxy?url=<绝对URL>`；相对地址以重定向后的最终 URL 为 base；`data:/skd:` 等非 http(s) URI 保持原样 |
| `main.js` Referer 净化 | 按浏览器默认 `strict-origin-when-cross-origin`：**https 来源 → http 目标时 Chromium 网络层以 "invalid referrer" 取消请求（ERR_BLOCKED_BY_CLIENT，代理返 502）**，此时回退目标站源 Referer；跨源只发 origin；同源发完整 URL |
| `player.js proxiedUrl` | 仅 webview tab 模式（http 协议）走代理；独立窗口（file://）保持直连，行为不变 |
| `renderer.js maybePlayerUrl(url, containerId)` | 播放器 URL 携带 `container`+`token`；地址栏/自动补全两处调用后 `tab.url` 存**原始** URL 而非播放器地址 |
| `renderer.js httpUrlToRealm` | 播放器页面 URL 特殊处理：地址栏显示与 tab 持久化统一用内嵌的原始视频地址（恢复时经 maybePlayerUrl 重新包装，不依赖旧端口；历史/收藏存的也是真实视频 URL） |
| `main.js will-navigate` | 排除内部服务器 URL 防重复包装；播放器 URL 注入 `container`/`token`/`referer`（来源页 `contents.getURL()`，防盗链站点校验用） |

### 防重复包装

播放器页面 URL 内嵌的 m3u8 `?url=` 参数在无查询串时会以 `.m3u8` 结尾，会被 m3u8 拦截正则再次命中。两处都加了守卫：will-navigate 排除 `http://localhost:PORT/` 前缀；`maybePlayerUrl` 同样排除内部源。

### 附带修复（代码审查发现）

1. **tab 持久化曾存 localhost 播放器 URL**：地址栏/自动补全导航后 `tab.url = targetUrl`（含端口的内部地址），重启恢复会连旧端口失败。改为存原始 m3u8 URL；配合 `httpUrlToRealm` 的播放器特判，did-navigate 回写也是原始 URL。
2. **媒体嗅探器混入代理流量**：播放器页面的 `/proxy` 请求（含 token）被嗅探进媒体列表，且主进程 `ses.fetch` 的上游请求（无 webContentsId）堆积进 pending 槽位。`media-sniffer.js` 新增 `internalOrigin` 过滤 + 跳过无 webContentsId 的响应。
3. **收藏栏点击导航漏接 maybePlayerUrl**（2026-08-27 用户复测发现）：`bookmarks-bar.js handleBookmarkClick` 与 `bookmarks-bar-menu.js _handleMenuBookmarkClick` 的普通点击分支直接 `webview.loadURL(url)`——程序化导航不触发 will-navigate 拦截，m3u8 直接当文档加载报 ERR_FAILED。两处补齐 `maybePlayerUrl` 转换（Cmd/Ctrl+Click 走 createTab 本就没问题）。**教训：新增「URL 转换型」拦截时必须穷举所有 `webview.loadURL` / `webview.src` 调用点**（当前共 4 处：地址栏回车、自动补全、收藏栏×2，外加 createWebviewForTab 的 src 赋值）。

### 已知限制（未修，如需再立项）

- **独立播放器窗口**（媒体面板打开，file:// 加载）：hls.js 仍是跨域直连，同样的 CORS/防盗链失败风险存在；如需修复要把 port/token 经 IPC 传给独立窗口并复用 `proxiedUrl`。
- mpegts（flv）/dash（mpd）未走代理（本次只拦截 .m3u8 导航）；DRM（FairPlay `skd://`）不支持。
- `/proxy` 无超时与客户端断连清理：hls.js 中止请求后上游 fetch 完成前会短暂占用连接（localhost 场景可接受）。

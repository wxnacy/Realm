# 领域陷阱研究 — v2.2 多媒体功能集成

**领域：** 多容器隔离浏览器 (Electron) — 视频源检测 + 媒体面板 + 播放器窗口
**研究日期：** 2026-08-06
**置信度：** HIGH（基于 Chromium/Electron 官方文档 + hls.js 文档 + 现有代码库分析）

---

## 本文档说明

本文档聚焦 v2.2 里程碑新增功能的陷阱，即：向已有 Electron 多容器浏览器**添加**视频源检测（media-sniffer）、媒体面板 UI、播放器窗口（hls.js 集成）时的常见错误。基础架构陷阱请参见之前版本的 PITFALLS.md。

**核心风险领域：**
1. **CSP 阻断脚本注入** — 严格 CSP 网站无法通过 executeJavaScript 检测视频
2. **session.webRequest 性能** — 拦截所有请求的开销可能拖慢页面加载
3. **hls.js 兼容性** — 与 Electron Chromium 版本的配合问题
4. **内存泄漏** — HLS 实例和播放器窗口未正确销毁
5. **DRM 内容** — Widevine 保护的视频无法播放且无明确提示
6. **跨域视频检测** — CORS 限制导致 m3u8 分片请求失败
7. **SPA 动态视频** — MutationObserver 的性能和覆盖范围权衡
8. **播放器窗口生命周期** — 多实例管理、关闭清理、GPU 进程冲突

---

## 关键陷阱

### 陷阱 1：CSP 阻断 executeJavaScript 脚本注入 — 视频检测的根本性障碍

**问题描述：**
很多视频网站（YouTube、Bilibili、Netflix 等）设置了严格的 Content-Security-Policy 头（如 `script-src 'self' 'nonce-xxx'`），导致 `webview.executeJavaScript()` 注入的检测脚本被浏览器引擎直接拒绝。错误信息：`Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'"`。

这意味着 `docs/multimedia-plan.md` 中 `MediaSniffer.injectDetector()` 的核心逻辑在大量网站上**完全失效**。

**根本原因：**
- `executeJavaScript()` 注入的代码被视为内联脚本，受 CSP `script-src` 约束
- `javascript:` URI 同样被 CSP 阻止
- `eval()` / `new Function()` 需要 CSP 包含 `'unsafe-eval'`
- 即使通过 DOM 操作注入 `<script>` 标签，也会被 CSP 拦截
- webview guest 页面的 CSP 由其自身响应头决定，与宿主页面无关

**如何避免：**

```javascript
// 方案 A：通过 webRequest 拦截响应头，移除/修改 CSP（推荐）
// 注意：这是一个安全权衡，仅对需要检测视频的容器 session 生效
function setupCSPBypassForMedia(ses) {
  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    // 不完全删除 CSP，而是仅放宽 script-src
    if (responseHeaders['content-security-policy']) {
      responseHeaders['content-security-policy'] =
        responseHeaders['content-security-policy'].map(directive =>
          directive.replace(/script-src\s/, "script-src 'unsafe-inline' ")
        );
    }
    // 同时处理 meta 标签中的 CSP（无法通过 webRequest 拦截）
    // 这部分需要在页面加载后通过 CDP 注入

    callback({ responseHeaders });
  });
}

// 方案 B：使用 Chrome DevTools Protocol 的 Runtime.evaluate（绕过 CSP）
// CDP 命令在 inspector 上下文执行，不受页面 CSP 限制
async function injectDetectorViaCDP(webContents) {
  // 已有 cdp-manager.js 的 attachDebugger 机制可复用
  const debuggerAttached = await ensureDebuggerAttached(webContents);
  if (!debuggerAttached) return;

  await webContents.debugger.sendCommand('Runtime.evaluate', {
    expression: `
      (function() {
        const videos = document.querySelectorAll('video, video source');
        const urls = [];
        videos.forEach(el => {
          if (el.src) urls.push(el.src);
          if (el.currentSrc) urls.push(el.currentSrc);
        });
        return JSON.stringify(urls);
      })();
    `,
    returnByValue: true
  });
}

// 方案 C：webview preload 脚本（在 webview 创建时指定）
// preload 脚本在独立上下文运行，部分 CSP 场景下可绕过
// <webview preload="./src/media-detector-preload.js">
```

**预警信号：**
- 媒体面板在 YouTube、Bilibili 等主流视频网站显示"未检测到媒体资源"
- 控制台出现 `Refused to execute inline script` 或 `Content Security Policy` 错误
- 某些网站检测到但某些网站完全无反应

**应解决的阶段：**
Phase 26（视频源检测）— **必须在实现 injectDetector 之前决定方案**。推荐方案 A + B 组合：webRequest 放宽 CSP 作为通用方案，CDP 注入作为兜底。

---

### 陷阱 2：session.webRequest 拦截性能开销 — 全局拦截的隐藏代价

**问题描述：**
`media-sniffer.js` 规划的 `ses.webRequest.onBeforeRequest` 使用 `{ urls: ['*://*/*.m3u8*', ...] }` 过滤器。虽然 URL 过滤器看起来精确，但 Chromium 内部对**每个匹配 session 的请求**都要执行过滤器匹配 + 回调调用。在复杂页面（如 SPA 加载数百个请求）中，这会引入可测量的延迟。

**根本原因：**
- `onBeforeRequest` 是**同步阻塞**的：回调未调用前，请求会挂起
- 现有代码 `main.js:359` 已经有一个 `onBeforeSendHeaders` 拦截器用于 UA-CH
- 多个 `webRequest` 监听器会**链式调用**，增加延迟
- `*://*/*.m3u8*` 这样的通配符需要 Chromium 对每个 URL 做正则匹配
- 高频请求场景下（如视频网站加载大量分片），回调队列可能堆积

**如何避免：**

```javascript
// 1. 使用精确的 URL 过滤器而非宽泛通配符
// 错误：{ urls: ['*://*/*'] }  — 拦截所有请求
// 正确：{ urls: ['*://*/*.m3u8*', '*://*/*.mp4*', '*://*/*.flv*', '*://*/*.webm*'] }
// 更好：进一步限制为特定 MIME 类型
ses.webRequest.onBeforeRequest(
  {
    urls: [
      '*://*/*.m3u8*',
      '*://*/*.mp4*',
      '*://*/*.flv*',
      '*://*/*.webm*',
      // 注意：某些视频 URL 没有扩展名，需要结合 onHeadersReceived 检查 MIME
    ]
  },
  (details, callback) => {
    // 回调必须尽快返回，不要做耗时操作
    // 错误：在这里做 URL 解析、数据库写入
    // 正确：仅收集 URL，异步处理
    mediaQueue.push({ url: details.url, timestamp: Date.now() });
    callback({}); // 立即放行
  }
);

// 2. 使用 onHeadersReceived 补充检测（检查 MIME 类型）
ses.webRequest.onHeadersReceived(
  { urls: ['*://*/*'] }, // 需要宽泛过滤才能检查所有响应头
  (details, callback) => {
    const contentType = details.responseHeaders['content-type']?.[0] || '';
    if (contentType.includes('video/') || contentType.includes('application/x-mpegURL')) {
      mediaQueue.push({
        url: details.url,
        mime: contentType,
        timestamp: Date.now()
      });
    }
    callback({}); // 不修改响应头
  }
);

// 3. 异步批量处理收集到的 URL（避免高频 IPC）
class MediaQueue {
  constructor() {
    this.queue = [];
    this.flushInterval = 500; // 500ms 批量刷新
    this.timer = null;
  }

  push(item) {
    this.queue.push(item);
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.queue.length === 0) return;

    // 去重
    const unique = this.deduplicate(this.queue);
    this.queue = [];

    // 通知渲染进程更新媒体面板
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('media:list-updated', unique);
    }

    this.timer = null;
  }

  deduplicate(items) {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }
}
```

**预警信号：**
- 页面加载速度明显变慢（>200ms 延迟可感知）
- 网络请求在 DevTools Network 面板中出现异常的 "pending" 状态
- 高频请求页面（如直播网站）出现请求超时
- 现有 UA-CH 功能（`main.js:359`）受到影响

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `initWebRequestInterceptor` 时同步实现性能监控。**必须**与现有 `onBeforeSendHeaders`（main.js:359）做集成测试。

---

### 陷阱 3：hls.js 与 Electron Chromium 版本的兼容性问题

**问题描述：**
hls.js 依赖 Media Source Extensions (MSE) API 来实现 HLS 播放。虽然 Electron 32.x（Chromium 128+）完整支持 MSE，但存在以下兼容性问题：

1. **硬件加速冲突** — Electron 的 GPU 进程与 MSE 的 MediaSource 竞争 GPU 资源，导致黑屏或渲染异常
2. **codec 支持差异** — Electron 构建可能未包含某些编解码器（取决于构建配置）
3. **跨域分片请求** — hls.js 的 XHR/fetch 请求受 webview session 的 CORS 策略限制
4. **autoplay 策略** — Chromium 的 autoplay 策略可能阻止自动播放

**根本原因：**
- Electron 32.x = Chromium 128，MSE 支持完整，但 **codec 取决于编译选项**
- hls.js 使用 `fetch` 或 `XMLHttpRequest` 加载 `.ts` 分片，受同源策略约束
- Chromium autoplay 策略要求用户交互后才能播放有声视频
- macOS 上的硬件加速在某些 GPU 型号上不稳定

**如何避免：**

```javascript
// 1. 播放器窗口创建时的正确配置
function createPlayerWindow(url, type) {
  const win = new BrowserWindow({
    width: 960,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'src/player-preload.js'),
      contextIsolation: true,
      // 关键：允许 autoplay（播放器窗口是用户主动打开的）
      autoplayPolicy: 'no-user-gesture-required',
      // 注意：不要设置 webSecurity: false，而是正确处理 CORS
    },
  });

  // macOS 特定：某些 GPU 上硬件加速导致黑屏
  // 如果检测到播放问题，可临时禁用
  // win.webContents.setWebRTCEnabled(false); // 如果不需要 WebRTC
}

// 2. hls.js 初始化时的兼容性处理
function initHlsPlayer(videoElement, url) {
  // 先检查 MSE 支持
  if (!window.MediaSource) {
    showError('当前环境不支持 Media Source Extensions');
    return null;
  }

  // 检查 hls.js 支持
  if (!Hls.isSupported()) {
    // macOS Safari/Electron 可能支持原生 HLS
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = url;
      return null; // 不需要 hls.js
    }
    showError('当前环境不支持 HLS 播放');
    return null;
  }

  const hls = new Hls({
    // 缓冲配置
    maxBufferLength: 30,
    maxMaxBufferLength: 600,
    // 重要：Electron 中 XHR 需要正确处理 CORS
    // 如果跨域失败，考虑使用 customLoader
    xhrSetup: (xhr, requestUrl) => {
      // 可在此处添加自定义 headers（如 Referer）
      // 注意：某些视频网站需要特定 Referer 才能获取分片
    },
    // 错误恢复
    enableWorker: false, // Electron 中 Worker 可能有路径问题
    debug: false, // 生产环境关闭调试
  });

  hls.loadSource(url);
  hls.attachMedia(videoElement);

  // 错误处理和恢复
  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.error('[Realm Player] HLS 网络错误:', data.details);
          hls.startLoad(); // 重试
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.error('[Realm Player] HLS 媒体错误:', data.details);
          hls.recoverMediaError(); // 恢复
          break;
        default:
          console.error('[Realm Player] HLS 不可恢复错误:', data);
          hls.destroy();
          break;
      }
    }
  });

  return hls;
}

// 3. CORS 问题的处理（当 hls.js 跨域请求分片失败时）
// 方案 A：通过主进程代理请求（最可靠）
function setupMediaProxy(session) {
  session.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*.ts', '*://*/*.m3u8'] },
    (details, callback) => {
      // 添加 Referer 等必要的请求头
      const headers = { ...details.requestHeaders };
      if (!headers['Referer']) {
        headers['Referer'] = details.url;
      }
      callback({ requestHeaders: headers });
    }
  );

  // 如果服务器不返回 CORS 头，需要在 onHeadersReceived 中添加
  session.webRequest.onHeadersReceived(
    { urls: ['*://*/*.ts', '*://*/*.m3u8'] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      // 添加 CORS 头允许跨域访问
      if (!responseHeaders['access-control-allow-origin']) {
        responseHeaders['access-control-allow-origin'] = ['*'];
      }
      callback({ responseHeaders });
    }
  );
}
```

**预警信号：**
- 播放器窗口显示黑屏但有声音（GPU 加速问题）
- hls.js 控制台报 `network error` 但网络正常（CORS 问题）
- 特定视频网站的 m3u8 无法加载（需要特定 Referer）
- 播放器不自动播放，需要手动点击（autoplay 策略）

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-06（hls.js 集成）时**必须**同时实现错误恢复和 CORS 处理。建议在 Phase 26 就开始测试 hls.js 基础播放。

---

### 陷阱 4：HLS 实例和播放器窗口内存泄漏 — 最常见的长期运行问题

**问题描述：**
hls.js 实例在创建后如果不调用 `hls.destroy()` 会持续占用内存（每个实例约 10-50MB，取决于缓冲配置）。播放器窗口关闭时如果未正确清理，会导致：
- HLS 分片下载继续进行（即使窗口已不可见）
- MediaSource 对象未释放，GPU 内存持续增长
- 事件监听器累积，触发回调时访问已销毁的 DOM
- 多次打开/关闭播放器后，应用内存持续增长直到 OOM

**根本原因：**
- `hls.destroy()` 不仅停止下载，还释放 MediaSource 和 SourceBuffer
- BrowserWindow 的 `closed` 事件不保证 webContents 已完全销毁
- 视频元素的 `src` 未清空时，底层解码器继续工作
- Electron 的 GPU 进程独立于主进程，窗口关闭不自动释放 GPU 资源
- 如果在 `close` 事件中做异步清理，窗口可能在清理完成前就已销毁

**如何避免：**

```javascript
// === 主进程：播放器窗口生命周期管理 ===
class PlayerWindowManager {
  constructor() {
    this.windows = new Map(); // windowId -> { window, hlsReady }
  }

  create(url, type) {
    const win = new BrowserWindow({
      width: 960,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'src/player-preload.js'),
        contextIsolation: true,
      },
    });

    const entry = { window: win, destroyed: false };
    this.windows.set(win.id, entry);

    // 关键：在 close 事件中先通知渲染进程清理
    win.on('close', () => {
      // 同步发送清理指令（不要用异步，窗口可能立即销毁）
      if (!win.isDestroyed()) {
        win.webContents.send('cleanup-before-close');
      }
    });

    win.on('closed', () => {
      entry.destroyed = true;
      this.windows.delete(win.id);
    });

    win.loadFile('src/player.html');
    return win;
  }

  // 应用退出时清理所有播放器窗口
  cleanupAll() {
    for (const [id, entry] of this.windows) {
      if (!entry.window.isDestroyed()) {
        entry.window.destroy(); // 强制销毁，不触发 close 事件
      }
    }
    this.windows.clear();
  }
}

// === 渲染进程（player.js）：HLS 实例清理 ===
let hlsInstance = null;
let videoElement = null;

function initPlayer(url, type) {
  videoElement = document.getElementById('videoPlayer');

  // 先清理旧实例
  destroyPlayer();

  if (type === 'm3u8' && Hls.isSupported()) {
    hlsInstance = new Hls({ maxBufferLength: 30 });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(videoElement);
  } else {
    videoElement.src = url;
  }
}

function destroyPlayer() {
  // 1. 销毁 HLS 实例（停止下载、释放 MediaSource）
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  // 2. 清理视频元素
  if (videoElement) {
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load(); // 触发资源释放
    // 移除所有事件监听器
    videoElement.replaceWith(videoElement.cloneNode(true));
  }
}

// 3. 监听清理指令（主进程 close 事件触发）
if (window.electronAPI && window.electronAPI.onCleanupBeforeClose) {
  window.electronAPI.onCleanupBeforeClose(() => {
    destroyPlayer();
  });
}

// 4. 页面卸载时的兜底清理
window.addEventListener('beforeunload', () => {
  destroyPlayer();
});

// 5. 页面隐藏时暂停（节省资源）
document.addEventListener('visibilitychange', () => {
  if (document.hidden && videoElement && !videoElement.paused) {
    videoElement.pause();
    // 注意：不要在这里 destroy，用户可能切回来
  }
});
```

**预警信号：**
- 应用内存使用随播放器打开/关闭次数线性增长
- 关闭播放器窗口后，活动监视器中仍有相关网络活动
- 打开 5+ 个播放器窗口后系统变慢
- 控制台出现 `Cannot read properties of null` 错误（访问已销毁 DOM）

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-05（独立播放器窗口）时**必须**同步实现清理机制。这是最容易被忽视但影响最大的陷阱。

---

### 陷阱 5：DRM 保护内容的静默失败 — 用户预期管理

**问题描述：**
Netflix、Disney+、Amazon Prime Video 等平台的视频使用 Widevine DRM 保护。Electron 默认**不包含** Widevine CDM（Content Decryption Module），导致：
- 视频 URL 被成功检测到（m3u8 链接有效）
- 用户点击播放后，播放器显示黑屏或报错，但无明确提示
- 用户困惑为什么检测到视频却无法播放

**根本原因：**
- Widevine CDM 需要 Google 授权和单独集成
- 标准 Electron 构建不包含 Widevine
- 即使使用 `electron-widevinecdm` 或 `castlabs` fork，也只能获得 L3（软件解密），许多服务会限制画质到 480p 或直接拒绝播放
- EME（Encrypted Media Extensions）API 调用会静默失败或抛出不易理解的错误

**如何避免：**

```javascript
// 1. 检测 DRM 保护并提前告知用户
async function checkDrmSupport() {
  const config = [
    {
      initDataTypes: ['cenc'],
      videoCapabilities: [{
        contentType: 'video/mp4; codecs="avc1.42E01E"',
        robustness: 'HW_SECURE_ALL'
      }]
    }
  ];

  try {
    const access = await navigator.requestMediaKeySystemAccess(
      'com.widevine.alpha', config
    );
    return { supported: true, robustness: 'HW_SECURE_ALL' };
  } catch (e) {
    // 尝试软件级别
    try {
      config[0].videoCapabilities[0].robustness = '';
      const access = await navigator.requestMediaKeySystemAccess(
        'com.widevine.alpha', config
      );
      return { supported: true, robustness: 'software', limited: true };
    } catch (e2) {
      return { supported: false };
    }
  }
}

// 2. 在播放器中处理 DRM 错误
function initPlayerWithDrmCheck(videoElement, url) {
  // 检查是否可能是 DRM 保护的 URL
  const drmIndicators = [
    /manifest\.mpd/i,           // DASH manifest
    /license/i,                  // License server URL
    /drm/i,                      // URL 包含 drm
    /widevine/i,                 // Widevine 相关
    /playready/i,                // PlayReady 相关
    /fairplay/i,                 // FairPlay 相关
  ];

  const isLikelyDrm = drmIndicators.some(pattern => pattern.test(url));

  if (isLikelyDrm) {
    showDrmWarning(url);
    return;
  }

  // 监听加密事件
  videoElement.addEventListener('encrypted', (event) => {
    console.warn('[Realm Player] 检测到 DRM 加密内容');
    showDrmWarning(url);
  });

  // 监听 EME 错误
  videoElement.addEventListener('keystatuseschange', (event) => {
    const statuses = videoElement.mediaKeys?.getStatuses?.();
    if (statuses) {
      for (const [keyId, status] of statuses) {
        if (status === 'output-restricted' || status === 'internal-error') {
          showDrmWarning(url, `密钥状态异常: ${status}`);
          return;
        }
      }
    }
  });
}

// 3. 友好的 DRM 提示 UI
function showDrmWarning(url, detail = '') {
  const playerContainer = document.querySelector('.player-container');
  playerContainer.innerHTML = `
    <div class="drm-warning">
      <div class="drm-warning-icon">🔒</div>
      <h3>此视频受 DRM 保护</h3>
      <p>当前环境不支持播放 DRM（数字版权管理）保护的视频。</p>
      ${detail ? `<p class="drm-detail">${detail}</p>` : ''}
      <div class="drm-actions">
        <button onclick="copyVideoUrl('${encodeURIComponent(url)}')">复制视频链接</button>
        <button onclick="window.close()">关闭播放器</button>
      </div>
      <p class="drm-hint">
        提示：某些受 DRM 保护的视频可能无法在此浏览器中播放。
        您可以尝试在原网站上直接观看。
      </p>
    </div>
  `;
}
```

**预警信号：**
- 用户反馈"检测到视频但播放黑屏"
- 播放器控制台出现 `Encrypted Media` 或 `EME` 相关错误
- 某些视频网站的所有视频都无法播放（整个站点使用 DRM）

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-06（hls.js 集成）时同步实现 DRM 检测和提示。

---

### 陷阱 6：跨域视频 URL 检测和 CORS 限制 — m3u8 分片请求失败

**问题描述：**
视频检测到 m3u8 主播放列表 URL 后，hls.js 需要继续请求其中引用的分片列表和 .ts 分片文件。如果这些请求是跨域的（CDN 域名与页面域名不同），且服务器未返回正确的 CORS 头，分片请求会被浏览器阻止。

**根本原因：**
- m3u8 主播放列表中的分片 URL 通常指向 CDN（如 `cdn.example.com`），与页面域名（`www.example.com`）不同
- hls.js 使用 `fetch` 或 `XMLHttpRequest` 请求分片，受同源策略约束
- 即使在 Electron 中，webview 的 session 仍然执行 CORS 检查
- 某些视频网站故意不设置 CORS 头，强制只能在自己的播放器中播放

**如何避免：**

```javascript
// 方案 1：通过 session.webRequest 注入 CORS 头（推荐，对用户透明）
function setupCorsProxyForMedia(ses) {
  ses.webRequest.onHeadersReceived(
    { urls: ['*://*/*.ts', '*://*/*.m3u8', '*://*/*.m4s'] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };

      // 添加 CORS 头
      responseHeaders['access-control-allow-origin'] = ['*'];
      responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS'];
      responseHeaders['access-control-allow-headers'] = ['*'];

      callback({ responseHeaders });
    }
  );

  // 同时处理 OPTIONS 预检请求
  ses.webRequest.onBeforeRequest(
    { urls: ['*://*/*.ts', '*://*/*.m3u8'] },
    (details, callback) => {
      // 某些 CDN 对 OPTIONS 请求返回 403，需要直接放行
      callback({});
    }
  );
}

// 方案 2：hls.js 自定义加载器（当 webRequest 方案不够时）
class ElectronHlsLoader extends Hls.DefaultConfig.loader {
  constructor(config) {
    super(config);
  }

  loadInternal() {
    // 使用 Electron 主进程代理请求
    // 通过 IPC 发送 URL 到主进程，主进程用 net.fetch 请求
    // 这样完全绕过 CORS
  }
}

// 方案 3：主进程代理请求（最可靠但最复杂）
// 在 main.js 中注册自定义协议
function setupStreamProxy() {
  protocol.handle('stream-proxy', async (request) => {
    const url = new URL(request.url);
    const targetUrl = decodeURIComponent(url.searchParams.get('url'));

    const response = await net.fetch(targetUrl, {
      headers: {
        'Referer': url.searchParams.get('referer') || '',
      }
    });

    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type'),
        'Access-Control-Allow-Origin': '*',
      }
    });
  });
}
```

**预警信号：**
- hls.js 报 `network error` 但 m3u8 主播放列表能正常加载
- DevTools Network 面板中 .ts 请求显示 `(failed) net::ERR_FAILED`
- 控制台出现 `CORS policy` 相关错误
- 某些视频网站的视频能播放，某些不能（取决于 CDN 配置）

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `initWebRequestInterceptor` 时就添加 CORS 处理，不要等到 Phase 27 才发现跨域问题。

---

### 陷阱 7：MutationObserver 动态视频检测的性能和覆盖范围权衡

**问题描述：**
SPA 网站（如 YouTube、Bilibili）动态加载视频时，`<video>` 元素在页面加载后才被插入 DOM。使用 MutationObserver 可以检测到这些动态变化，但：
- `subtree: true` 观察整个 body 的开销在复杂页面上很大
- 某些视频播放器使用 Shadow DOM，MutationObserver 无法穿透
- 视频播放器可能在 iframe 中加载，需要单独处理
- 高频 DOM 变化（如 SPA 路由切换）会触发大量回调

**根本原因：**
- MutationObserver 的 `subtree: true` 在大 DOM 树上性能差（YouTube 页面 DOM 节点 >10,000）
- Shadow DOM 的 encapsulation 特性阻止外部 observer 看到内部变化
- iframe 中的视频需要在 iframe 的 session 中单独注入检测脚本
- 某些播放器（如 Bilibili）使用自定义元素和复杂的 DOM 结构

**如何避免：**

```javascript
// 1. 精细化的 MutationObserver 配置
function setupVideoObserver(document) {
  // 不要一开始就用 subtree: true
  // 先观察直接子节点变化，再按需深入
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // 仅检查新增节点
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // 检查是否是 video 元素
          if (node.tagName === 'VIDEO') {
            handleNewVideo(node);
            continue;
          }

          // 检查子树中是否有 video（但不要对每个节点都查）
          if (node.querySelector) {
            const videos = node.querySelectorAll('video');
            videos.forEach(handleNewVideo);
          }
        }
      }

      // 检查 src 属性变化（某些播放器动态修改 src）
      if (mutation.type === 'attributes' &&
          (mutation.attributeName === 'src' || mutation.attributeName === 'data-src')) {
        const target = mutation.target;
        if (target.tagName === 'VIDEO' || target.tagName === 'SOURCE') {
          handleVideoSrcChange(target);
        }
      }
    }
  });

  // 分阶段观察
  // 阶段 1：观察 body 的直接子节点变化
  observer.observe(document.body, {
    childList: true,
    subtree: false, // 先不深入
  });

  // 阶段 2：5 秒后如果没检测到视频，再启用 subtree
  setTimeout(() => {
    if (detectedVideos.size === 0) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'data-src'],
      });
    }
  }, 5000);
}

// 2. Shadow DOM 穿透（如果需要）
function observeShadowRoots(element) {
  // 覆盖 attachShadow 以自动观察新创建的 Shadow DOM
  const originalAttachShadow = element.attachShadow;
  element.attachShadow = function(...args) {
    const shadowRoot = originalAttachShadow.apply(this, args);
    // 在 Shadow Root 中也设置 observer
    setupVideoObserver(shadowRoot);
    return shadowRoot;
  };
}

// 3. iframe 中的视频检测
function setupIframeDetection() {
  // 监听新创建的 iframe
  const iframeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'IFRAME') {
          // iframe 加载后在其 contentDocument 中注入检测
          node.addEventListener('load', () => {
            try {
              // 注意：跨域 iframe 无法访问 contentDocument
              if (node.contentDocument) {
                injectDetectorInDocument(node.contentDocument);
              }
            } catch (e) {
              // 跨域 iframe，忽略
            }
          });
        }
      }
    }
  });

  iframeObserver.observe(document.body, { childList: true, subtree: true });
}

// 4. 防抖处理（避免高频 DOM 变化导致性能问题）
function createDebouncedDetector(callback, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}
```

**预警信号：**
- 页面加载后 CPU 使用率持续 >30%（MutationObserver 回调风暴）
- YouTube/Bilibili 等 SPA 网站的视频未被检测到
- 某些使用 Shadow DOM 的播放器（如某些广告播放器）未被检测
- 检测到大量重复的视频 URL（同一视频被多次报告）

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `injectDetector` 时同步实现性能优化。**建议先实现基于网络拦截的检测（方案 A），MutationObserver 作为补充（方案 B）。**

---

### 陷阱 8：播放器窗口生命周期管理 — 多实例、关闭清理、GPU 冲突

**问题描述：**
用户可能同时打开多个播放器窗口播放不同视频，或者快速打开/关闭播放器。如果生命周期管理不当：
- 关闭播放器窗口时 GPU 进程崩溃（视频未停止就关闭窗口）
- 多个播放器窗口同时播放导致音频叠加
- 主窗口关闭时播放器窗口成为孤儿进程
- 播放器窗口关闭后 IPC 通道报错（webContents 已销毁）

**根本原因：**
- BrowserWindow 的 `close` 事件是**同步**的，无法等待异步清理完成
- 视频解码器需要在窗口销毁前停止，否则 GPU 进程可能崩溃
- 多个 BrowserWindow 共享同一个 GPU 进程
- 主窗口的 `app.quit()` 不会等待所有子窗口的清理完成

**如何避免：**

```javascript
// === 播放器窗口管理器（主进程） ===
class PlayerWindowManager {
  constructor() {
    this.windows = new Map();
    this.activePlayerId = null; // 当前活跃的播放器
  }

  /**
   * 创建新的播放器窗口
   * @param {string} url - 视频 URL
   * @param {string} type - 视频类型
   * @param {Object} options - 额外选项
   * @returns {BrowserWindow}
   */
  create(url, type, options = {}) {
    // 限制同时打开的播放器数量
    const MAX_PLAYERS = 5;
    if (this.windows.size >= MAX_PLAYERS) {
      // 关闭最旧的播放器
      const oldest = this.windows.keys().next().value;
      this.close(oldest);
    }

    const win = new BrowserWindow({
      width: 960,
      height: 600,
      title: 'Realm Player',
      webPreferences: {
        preload: path.join(__dirname, 'src/player-preload.js'),
        contextIsolation: true,
      },
    });

    const entry = {
      window: win,
      url,
      type,
      createdAt: Date.now(),
    };

    this.windows.set(win.id, entry);

    // === 关闭处理 ===
    // 使用 'close' 事件，在窗口实际关闭前执行同步清理
    win.on('close', (event) => {
      // 同步发送停止指令
      if (!win.isDestroyed()) {
        try {
          win.webContents.send('player:stop');
        } catch (e) {
          // webContents 可能已销毁
        }
      }
    });

    win.on('closed', () => {
      this.windows.delete(win.id);
      if (this.activePlayerId === win.id) {
        this.activePlayerId = null;
      }
    });

    // === 焦点管理 ===
    win.on('focus', () => {
      this.activePlayerId = win.id;
      // 可选：暂停其他播放器
      if (options.pauseOthersOnFocus) {
        this.pauseAllExcept(win.id);
      }
    });

    win.loadFile('src/player.html');
    return win;
  }

  /**
   * 关闭指定播放器窗口
   * @param {number} windowId
   */
  close(windowId) {
    const entry = this.windows.get(windowId);
    if (entry && !entry.window.isDestroyed()) {
      entry.window.close();
    }
  }

  /**
   * 关闭所有播放器窗口（应用退出时调用）
   */
  closeAll() {
    for (const [id, entry] of this.windows) {
      if (!entry.window.isDestroyed()) {
        // 先发送停止指令，再强制关闭
        try {
          entry.window.webContents.send('player:stop');
        } catch (e) {}
        entry.window.destroy();
      }
    }
    this.windows.clear();
  }

  /**
   * 暂停除指定窗口外的所有播放器
   * @param {number} exceptWindowId
   */
  pauseAllExcept(exceptWindowId) {
    for (const [id, entry] of this.windows) {
      if (id !== exceptWindowId && !entry.window.isDestroyed()) {
        entry.window.webContents.send('player:pause');
      }
    }
  }

  /**
   * 获取所有播放器窗口信息
   */
  getAll() {
    return [...this.windows.entries()].map(([id, entry]) => ({
      id,
      url: entry.url,
      type: entry.type,
      title: entry.window.getTitle(),
      focused: entry.window.isFocused(),
    }));
  }
}

// === 应用退出时的清理（main.js） ===
app.on('before-quit', () => {
  playerWindowManager.closeAll();
});

// === IPC 通道中的安全检查 ===
ipcMain.handle('player:play', async (event, { url, type }) => {
  // 检查发送者是否还存在
  if (event.sender.isDestroyed()) {
    return { success: false, error: '发送者已销毁' };
  }

  playerWindowManager.create(url, type);
  return { success: true };
});
```

**预警信号：**
- 关闭播放器窗口时应用崩溃或 GPU 进程重启
- 多个视频同时播放时声音重叠
- 主窗口关闭后播放器窗口仍然存在
- 控制台出现 `Object has been destroyed` 错误

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-05（独立播放器窗口）时**必须**同步实现生命周期管理。这是播放器功能的基础。

---

## 次要陷阱

### 陷阱 9：视频 URL 去重和质量识别

**问题描述：**
同一视频可能有多个 URL（不同分辨率、不同 CDN），导致媒体面板显示重复条目。某些 URL 不包含文件扩展名（如 `https://api.example.com/video/12345/stream`），无法通过 URL 模式判断类型。

**如何避免：**
- 基于 URL 的 path 部分（去除 query 参数）去重
- 通过 `Content-Type` 响应头判断类型（`application/x-mpegURL` = m3u8, `video/mp4` = mp4）
- 同一视频的多个分辨率只显示最高质量的
- 对无扩展名 URL，检查响应头的 MIME 类型

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `addMedia` 时同步实现去重逻辑。

---

### 陷阱 10：Electron 特定的视频/音频播放行为

**问题描述：**
macOS 上 Electron 的音频会话管理与原生应用不同：
- BrowserWindow 未聚焦时音频可能被系统静音
- macOS 的 Now Playing 集成可能不工作
- 全屏模式下的行为与原生应用不一致
- PiP（画中画）支持有限

**如何避免：**
- 播放器窗口设置 `alwaysOnTop` 选项（用户可选）
- 使用 `win.setSimpleFullScreen()` 而非系统全屏
- 在 macOS 上使用 `app.dock.bounce()` 通知用户播放状态
- 考虑使用 `navigator.mediaSession` API 集成系统媒体控制

**应解决的阶段：**
Phase 27（播放器窗口）— 作为 MEDIA-07（播放控制 UI）的增强功能。

---

## 技术债务模式

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `webSecurity: false` 绕过 CORS | 立即解决跨域问题 | 安全漏洞、容器隔离失效 | **NEVER** |
| 不销毁 HLS 实例 | 代码简单 | 内存泄漏 | 仅原型验证 |
| 不处理 CSP 直接用 executeJavaScript | 实现简单 | 大量网站视频检测失败 | **NEVER** |
| 全局 webRequest 拦截所有 URL | 覆盖范围广 | 性能下降 | 仅开发调试 |
| 不限制播放器窗口数量 | 无需管理逻辑 | 资源耗尽 | 仅 MVP（<3 个） |

## 集成陷阱

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| media-sniffer + webRequest | 拦截所有请求 | 使用精确 URL 过滤器 + 异步队列 |
| hls.js + Electron session | 忽略 CORS | webRequest 注入 CORS 头 |
| 播放器窗口 + 主窗口 | 无生命周期关联 | 主窗口退出时 closeAll |
| CDP 检测 + executeJavaScript | 仅用一种方式 | webRequest 为主 + CDP/executeJavaScript 为辅 |
| 媒体面板 + webview | webview 内 IPC 不通 | 使用 HTTP API 或 webRequest 通信 |

## 性能陷阱

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| webRequest 回调阻塞 | 页面加载变慢 | 回调内仅做内存操作 | >100 请求/秒 |
| MutationObserver 风暴 | CPU 持续 >30% | 防抖 + 精细化配置 | 复杂 SPA 页面 |
| HLS 缓冲区溢出 | 内存持续增长 | 限制 maxBufferLength | 长视频播放 |
| 多播放器同时解码 | GPU 负载高、发热 | 限制同时播放数量 | >3 个播放器 |
| 媒体列表 DOM 更新 | 面板打开卡顿 | 虚拟滚动或分页 | >100 条媒体记录 |

## 安全风险

| Mistake | Risk | Prevention |
|---------|------|------------|
| `webSecurity: false` 绕过 CORS | 容器隔离失效 | 正确配置 CORS 头注入 |
| CSP 完全移除 | XSS 攻击面扩大 | 仅放宽 script-src |
| 播放器窗口无 contextIsolation | 恶意视频页面访问 Node.js | 始终启用 contextIsolation |
| 视频 URL 未验证 | SSRF 攻击（通过代理请求内部地址） | URL 白名单或黑名单 |

## UX 陷阱

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| DRM 视频静默失败 | 用户困惑 | 明确提示 DRM 保护 + 提供替代操作 |
| 检测到视频但无反馈 | 用户不知道检测状态 | 实时显示检测进度和结果 |
| 多播放器音频叠加 | 用户体验差 | 聚焦播放器自动暂停其他 |
| 媒体面板无去重 | 重复条目混乱 | 智能去重 + 质量标识 |

## "Looks Done But Isn't" 检查清单

- [ ] **CSP 处理:** 在 YouTube、Bilibili 等严格 CSP 网站上验证视频检测是否正常
- [ ] **webRequest 性能:** 对比有无 media-sniffer 时的页面加载速度（差异 <100ms）
- [ ] **hls.js 播放:** 测试至少 3 个不同 CDN 的 m3u8 流播放
- [ ] **内存泄漏:** 连续打开/关闭 10 次播放器，验证内存无持续增长
- [ ] **DRM 提示:** 在 Netflix/Disney+ 等 DRM 网站上验证友好提示
- [ ] **CORS 处理:** 测试跨域 m3u8 分片请求是否正常
- [ ] **SPA 检测:** 在 YouTube SPA 路由切换后验证视频检测
- [ ] **多播放器:** 同时打开 3 个播放器窗口，验证独立控制
- [ ] **关闭清理:** 关闭主窗口时验证所有播放器窗口同步关闭
- [ ] **现有功能:** 验证 UA-CH 功能（main.js:359）未受影响

## 恢复策略

| 陷阱 | 恢复成本 | 恢复步骤 |
|------|---------|---------|
| CSP 阻断检测 | MEDIUM | 切换到 CDP 注入方案 + 重新测试 |
| webRequest 性能问题 | LOW | 添加更精确的 URL 过滤器 |
| HLS 播放失败 | MEDIUM | 检查 CORS 配置 + 添加错误恢复 |
| 内存泄漏 | LOW | 确保 hls.destroy() 正确调用 |
| GPU 进程崩溃 | HIGH | 实现窗口关闭前的同步清理 |
| 容器隔离受影响 | CRITICAL | 立即回滚 webSecurity 相关改动 |

## 陷阱到阶段映射

| 陷阱 | 预防阶段 | 验证方式 |
|------|---------|---------|
| CSP 阻断脚本注入 | Phase 26 | 在 5+ 个严格 CSP 网站测试 |
| webRequest 性能开销 | Phase 26 | 页面加载速度基准测试 |
| hls.js 兼容性 | Phase 27 | 播放 3+ 个不同 CDN 的 m3u8 |
| HLS 内存泄漏 | Phase 27 | 连续打开/关闭 10 次播放器 |
| DRM 静默失败 | Phase 27 | Netflix/Disney+ 网站测试 |
| CORS 跨域问题 | Phase 26 | 跨域 m3u8 分片请求测试 |
| MutationObserver 性能 | Phase 26 | YouTube SPA 路由切换测试 |
| 播放器窗口生命周期 | Phase 27 | 多实例 + 关闭清理测试 |

---

## 来源

- Electron 官方文档：webRequest API, BrowserWindow, webview Tag
- Chromium 文档：Content Security Policy, Media Source Extensions
- hls.js 官方文档：API Reference, Error Handling
- MDN：MutationObserver, Encrypted Media Extensions
- Electron GitHub Issues：autoplay, GPU, video playback
- 现有代码库分析：main.js, cdp-manager.js, ipc-handlers.js

---

*陷阱研究：多容器隔离浏览器 v2.2 多媒体功能集成*
*研究日期：2026-08-06*

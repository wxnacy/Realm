/**
 * Realm Browser - 媒体嗅探器核心引擎
 *
 * 封装三种视频检测方式：网络请求拦截、脚本注入回传、DOM 监听。
 * 检测结果按 webview (webContentsId) 隔离存储，仅保存在内存中（per D-08），应用关闭后清空。
 *
 * @module media-sniffer
 */

// ==================== 视频类型分类 ====================

/**
 * URL 扩展名到视频类型的映射
 * @type {Object<string, string>}
 */
const VIDEO_TYPE_MAP = {
  '.m3u8': 'm3u8',
  '.mp4': 'mp4',
  '.flv': 'flv',
  '.webm': 'webm',
  '.mpd': 'dash',
};

/**
 * content-type 到视频类型的映射
 * @type {Object<string, string>}
 */
const CONTENT_TYPE_MAP = {
  'application/vnd.apple.mpegurl': 'm3u8',
  'application/x-mpegurl': 'm3u8',
  'video/mp4': 'mp4',
  'video/x-flv': 'flv',
  'video/webm': 'webm',
  'application/dash+xml': 'dash',
};

/**
 * 需要过滤的 HLS 分片 content-type（per Pitfall 4：不报告 .ts 分片）
 * @type {Set<string>}
 */
const FILTERED_CONTENT_TYPES = new Set([
  'video/mp2t',
  'video/MP2T',
]);

/**
 * 明确非媒体的静态资源扩展名（图片等）
 * 部分站点封面/预览图加载会被内核标记为 resourceType 'media'，需显式排除
 * @type {RegExp}
 */
const NON_MEDIA_URL_RE = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)(\?|#|$)/i;

/**
 * 需要过滤的 HLS 分片和 DRM 密钥 URL 模式
 * @type {RegExp}
 */
const FILTERED_URL_RE = /\.(ts|key)(\?|#|$)/i;

// ==================== MediaSniffer 类 ====================

/**
 * 媒体嗅探器 - 管理视频资源的检测、去重和通知
 *
 * 三种检测方式：
 * 1. 网络请求拦截（webRequest.onResponseStarted）
 * 2. 脚本注入（executeJavaScript + MutationObserver）
 * 3. DOM 监听（通过 webview ipc-message 回传）
 *
 * 数据模型：Map<webContentsId, MediaItem[]>
 * 去重策略：每个 webview 维护独立的 URL 去重集合（per D-05）
 */
class MediaSniffer {
  constructor() {
    /** @type {Map<number, Array<MediaItem>>} webview webContentsId → 媒体列表 */
    this.mediaMap = new Map();
    /** @type {Map<number, Set<string>>} webview webContentsId → URL 去重集合（per D-05） */
    this.dedupSets = new Map();
    /**
     * guest 注册前到达的网络嗅探暂存（webContentsId → 条目数组）
     * 主进程无法从 guest session 反推 partition（Electron 32+ 无此 API），
     * 容器映射只能靠渲染进程 did-attach 后上报，首批响应必然早于注册，先暂存待冲刷
     * @type {Map<number, Array<{url: string, type: string, source: string}>>}
     */
    this.pendingByWcId = new Map();
  }

  /**
   * 从 URL 扩展名判断视频类型
   * @param {string} url - 媒体 URL
   * @returns {string} 视频类型（m3u8/mp4/flv/webm/unknown）
   */
  classifyUrl(url) {
    if (!url) return 'unknown';
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      for (const [ext, type] of Object.entries(VIDEO_TYPE_MAP)) {
        if (pathname.endsWith(ext)) {
          return type;
        }
      }
    } catch {
      const lower = url.toLowerCase().split('?')[0].split('#')[0];
      for (const [ext, type] of Object.entries(VIDEO_TYPE_MAP)) {
        if (lower.endsWith(ext)) {
          return type;
        }
      }
    }
    return 'unknown';
  }

  /**
   * 从 content-type header 判断视频类型
   * @param {string} contentType - Content-Type 值
   * @returns {string|null} 视频类型或 null（非视频/需过滤）
   */
  classifyContentType(contentType) {
    if (!contentType) return null;
    const lower = contentType.toLowerCase().trim();
    for (const filtered of FILTERED_CONTENT_TYPES) {
      if (lower.includes(filtered)) return null;
    }
    for (const [mime, type] of Object.entries(CONTENT_TYPE_MAP)) {
      if (lower.includes(mime)) return type;
    }
    return null;
  }

  /**
   * 添加媒体记录到指定 webview（per D-05 URL 去重，per D-06 字段定义）
   * @param {number} webContentsId - webview 的 webContents ID
   * @param {Object} item - 媒体信息
   * @param {string} item.url - 媒体 URL
   * @param {string} [item.type] - 视频类型（m3u8/mp4/flv/webm/unknown）
   * @param {string} [item.source] - 检测来源（network/script/dom）
   * @param {string} [item.title] - 页面标题
   * @param {number} [item.duration] - 视频时长（秒）
   * @param {string} [item.thumbnail] - 缩略图 URL
   * @returns {boolean} 是否为新增记录（false 表示重复）
   */
  addMedia(webContentsId, item) {
    if (!webContentsId || !item || !item.url) return false;

    // 过滤 HLS 分片（.ts）和 DRM 密钥（.key），不列入媒体列表
    if (FILTERED_URL_RE.test(item.url)) return false;

    if (!this.dedupSets.has(webContentsId)) {
      this.dedupSets.set(webContentsId, new Set());
    }
    if (!this.mediaMap.has(webContentsId)) {
      this.mediaMap.set(webContentsId, []);
    }

    const dedupSet = this.dedupSets.get(webContentsId);
    const mediaList = this.mediaMap.get(webContentsId);

    // URL 去重检查（per D-05）
    if (dedupSet.has(item.url)) {
      return false;
    }

    // 创建 MediaItem 记录（per D-06）
    const mediaItem = {
      url: item.url,
      type: item.type || this.classifyUrl(item.url),
      source: item.source || 'unknown',
      timestamp: Date.now(),
      title: item.title || '',
      duration: item.duration || 0,
      thumbnail: item.thumbnail || '',
    };

    dedupSet.add(item.url);
    mediaList.push(mediaItem);

    return true;
  }

  /**
   * 获取指定 webview 的媒体列表副本（per D-11 每次携带完整列表）
   * @param {number} webContentsId - webview 的 webContents ID
   * @returns {Array<MediaItem>} 媒体列表副本
   */
  getMediaList(webContentsId) {
    const list = this.mediaMap.get(webContentsId);
    return list ? [...list] : [];
  }

  /**
   * 清空指定 webview 的媒体列表和去重集合（per D-13/D-16）
   * @param {number} webContentsId - webview 的 webContents ID
   */
  clearMediaList(webContentsId) {
    this.mediaMap.delete(webContentsId);
    this.dedupSets.delete(webContentsId);
  }

  /**
   * 清空所有容器的媒体列表、去重集合和待处理条目
   * 功能开关关闭时调用，释放所有嗅探数据（per D-12）
   * 不重置 debugState 计数器（诊断用途保留）
   */
  clearAll() {
    this.mediaMap.clear();
    this.dedupSets.clear();
    this.pendingByWcId.clear();
  }

  /**
   * 处理网络请求响应（webRequest.onResponseStarted 回调）
   * 检查 resourceType 和 content-type 检测视频资源
   *
   * @param {Object} details - Electron webRequest 回调详情
   * @param {string} details.url - 请求 URL
   * @param {string} details.resourceType - 资源类型（'media'/'xhr'/'other' 等）
   * @param {Object} details.responseHeaders - 响应头 {key: string[]}
   * @param {number} details.webContentsId - 来源 webContents ID
   */
  handleNetworkResponse(details) {
    if (!details || !details.url) return;
    this.responsesSeen = (this.responsesSeen || 0) + 1;

    // 图片等静态资源直接排除（封面/预览图可能被标记为 resourceType 'media'）
    if (NON_MEDIA_URL_RE.test(details.url)) return;

    // 过滤非视频资源
    const isMediaType = details.resourceType === 'media';
    let contentType = null;
    if (details.responseHeaders) {
      const ct = details.responseHeaders['content-type']
        || details.responseHeaders['Content-Type'];
      contentType = Array.isArray(ct) ? ct[0] : ct;
    }

    const videoType = this.classifyContentType(contentType);
    const urlType = this.classifyUrl(details.url);
    // 检测触发条件：媒体资源类型、content-type 白名单、URL 扩展名三者命中其一
    // （MSE/直链场景常为 xhr + application/octet-stream，仅靠 content-type 会漏检）
    if (!isMediaType && !videoType && urlType === 'unknown') return;
    this.responsesMatched = (this.responsesMatched || 0) + 1;

    // 通过 webContentsId 直接存储，无需再解析容器 ID
    const containerId = this._getContainerIdForWebContents(details.webContentsId);
    if (!containerId) {
      // guest 尚未注册（did-attach 前首批响应）：暂存，注册时由 flushPending 补录
      const pending = this.pendingByWcId.get(details.webContentsId) || [];
      if (pending.length < 50) {
        pending.push({ url: details.url, type: videoType || urlType, source: 'network' });
        this.pendingByWcId.set(details.webContentsId, pending);
      }
      return;
    }

    const type = videoType || urlType;

    const added = this.addMedia(details.webContentsId, {
      url: details.url,
      type,
      source: 'network',
    });
    if (added) {
      console.log(`[Realm MediaSniffer] 嗅探到 [wc:${details.webContentsId}] ${type}: ${details.url.slice(0, 120)}`);
    }

    // 通知渲染进程（per D-10 即时通知，不做防抖）
    this.notifyRenderer(details.webContentsId);
  }

  /**
   * guest 注册（webview:register-container）时冲刷暂存的早期嗅探条目
   * @param {number} webContentsId - webview guest 的 webContents ID
   */
  flushPending(webContentsId) {
    const pending = this.pendingByWcId.get(webContentsId);
    if (!pending || pending.length === 0) return;
    this.pendingByWcId.delete(webContentsId);

    let hasNew = false;
    for (const item of pending) {
      if (this.addMedia(webContentsId, item)) hasNew = true;
    }
    if (hasNew) {
      console.log(`[Realm MediaSniffer] 补录 ${pending.length} 条早期嗅探 [wc:${webContentsId}]`);
      this.notifyRenderer(webContentsId);
    }
  }

  /**
   * 诊断用：返回嗅探管线各环节的计数状态
   * responsesSeen=0 → webRequest 未触发；matched=0 → 过滤全挡；
   * pending>0 → guest 注册竞态；storeCounts 有值但 getMediaList 空 → webContentsId 解析不一致
   * @returns {Object} 诊断状态
   */
  debugState() {
    const storeCounts = {};
    for (const [wcId, list] of this.mediaMap) storeCounts[wcId] = list.length;
    const pendingCounts = {};
    for (const [wcId, list] of this.pendingByWcId) pendingCounts[wcId] = list.length;
    return {
      responsesSeen: this.responsesSeen || 0,
      responsesMatched: this.responsesMatched || 0,
      storeCounts,
      pendingCounts,
    };
  }

  /**
   * 处理脚本注入检测到的视频（per D-02）
   * @param {number} webContentsId - webview 的 webContents ID
   * @param {Array<Object>} videos - 检测到的视频数组
   */
  handleScriptDetected(webContentsId, videos) {
    if (!webContentsId || !Array.isArray(videos)) return;

    let hasNew = false;
    for (const video of videos) {
      if (!video || typeof video.url !== 'string' || !video.url.startsWith('http')) continue;
      if (video.type && typeof video.type !== 'string') continue;
      const added = this.addMedia(webContentsId, video);
      if (added) hasNew = true;
    }

    if (hasNew) {
      this.notifyRenderer(webContentsId);
    }
  }

  /**
   * 通知渲染进程媒体列表更新
   * 广播所有窗口，渲染端按当前 webview 过滤
   *
   * @param {number} webContentsId - webview 的 webContents ID
   * @private
   */
  notifyRenderer(webContentsId) {
    const { BrowserWindow } = require('electron');

    const items = this.getMediaList(webContentsId);
    const payload = { webContentsId, items };

    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win.isDestroyed()) continue;
      try {
        win.webContents.send('media:list-updated', payload);
      } catch (err) {
        console.error(`[Realm MediaSniffer] 通知窗口 ${win.id} 失败:`, err.message);
      }
    }
  }

  /**
   * 通过 webContentsId 获取容器 ID
   * 主进程无法从 guest session 反推 partition（Electron 32+ 无此 API），
   * 只能靠渲染进程上报的 guestContainerMap（ipc-handlers），
   * 未注册时返回 null，由调用方暂存待 flushPending 补录
   *
   * @param {number} webContentsId - webContents ID
   * @returns {string|null} 容器 ID 或 null
   * @private
   */
  _getContainerIdForWebContents(webContentsId) {
    if (!webContentsId) return null;

    try {
      const { BrowserWindow, webContents } = require('electron');
      const windowManager = require('./window-manager');
      const { getGuestContainer } = require('./ipc-handlers');

      // 方式 1：通过 guestContainerMap 查找（适用于 webview guest）
      const guestContainerId = getGuestContainer(webContentsId);
      if (guestContainerId) return guestContainerId;

      // 方式 2：通过 BrowserWindow.fromWebContents 查找（适用于主窗口）
      const wc = webContents.fromId(webContentsId);
      if (wc) {
        const win = BrowserWindow.fromWebContents(wc);
        if (win) {
          return windowManager.getCurrentContainer(win.id);
        }
      }
    } catch (err) {
      console.error(`[Realm MediaSniffer] webContentsId ${webContentsId} 容器查找失败:`, err.message);
    }

    return null;
  }

  /**
   * 获取指定容器的全部媒体列表（遍历所有属于该容器的 webview）
   * 供播放器窗口获取播放列表（D-16）
   * @param {string} containerId - 容器 ID
   * @returns {Array<MediaItem>} 该容器下所有媒体的合并列表
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
    // 按时间戳排序（最新在前）
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
  }
}

module.exports = new MediaSniffer();

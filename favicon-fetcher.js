/**
 * Realm Browser - Favicon 抓取模块
 *
 * 「远程 favicon URL → data URL」的唯一实现点。
 * 所有收藏 favicon 写入口（星标添加 / 收藏页添加 / 访问时回写）统一经此转换，
 * 渲染进程只传远程 URL，抓取只在主进程发生（渲染进程 CSP connect-src 'self' 无法外联）。
 *
 * 使用 net.fetch（Chromium 网络栈）而非全局 fetch（undici）：
 * undici 不走系统代理，直连外网在国内环境大面积失败；net.fetch 与浏览行为一致。
 */

const { net } = require('electron');

/** data URL 体积上限（防止异常大图撑爆 SQLite TEXT 与 UI 渲染） */
const MAX_BYTES = 256 * 1024;

/** 单次抓取超时 */
const TIMEOUT_MS = 5000;

/**
 * 抓取 favicon 并转为 data URL（收藏 favicon 的统一入库格式）
 * @param {string} sourceUrl - http:/https:/data: 的 favicon 源
 * @returns {Promise<string>} data URL；抓取失败或输入非法时返回 ''
 */
async function fetchAsDataUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0) {
    return '';
  }

  // 页面内联 favicon 直接直通，无需抓取
  if (sourceUrl.startsWith('data:')) {
    return sourceUrl;
  }

  if (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://')) {
    return '';
  }

  try {
    const resp = await net.fetch(sourceUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      return '';
    }

    let contentType = resp.headers.get('content-type') || '';
    if (contentType) {
      // content-type 存在但不是图片时放弃（可能抓到错误页/HTML）
      if (!contentType.startsWith('image/')) {
        return '';
      }
    } else {
      contentType = 'image/png';
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return '';
    }

    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    // 抓取失败静默降级：调用方以 '' 入库，后续由访问时回写补齐
    return '';
  }
}

module.exports = { fetchAsDataUrl };

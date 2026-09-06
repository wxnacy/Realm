/**
 * media-m3u8-parser — m3u8 行级清单解析器（纯函数模块，Phase 44）
 *
 * 直播录制引擎（media-record-engine）的唯一清单解析来源。
 * 只需四个标签：EXT-X-MEDIA-SEQUENCE（滑动窗口基线序号）、EXT-X-TARGETDURATION
 * （轮询间隔依据）、分片 URI 列举、EXT-X-ENDLIST（live/VOD 判定）。
 * 行级 split + 正则手写（先例：main.js rewriteM3u8ForProxy），不引 npm 解析依赖。
 *
 * 顶层无 electron/原生 require —— 纯 Node 可加载（44-VALIDATION Wave 0 硬约束）。
 */

/** TARGETDURATION 缺省值（秒）：缺失时录制轮询按此间隔兜底 */
const DEFAULT_TARGET_DURATION = 6;

/**
 * 解析 m3u8 清单文本
 * @param {string} text - 原始清单文本
 * @returns {{ mediaSequence: number, targetDuration: number, ended: boolean, isLive: boolean, segments: Array<{ uri: string, seq: number, duration: number|null }> }}
 *   mediaSequence — 滑动窗口基线序号（缺省 0）；segments[].seq = mediaSequence + 分片序位
 *   ended — 是否含 EXT-X-ENDLIST；isLive — 播放中清单（!ended）
 *   duration — 紧邻 EXTINF 标签的时长（秒），无对应标签时为 null
 */
function parsePlaylist(text) {
  const result = {
    mediaSequence: 0,
    targetDuration: DEFAULT_TARGET_DURATION,
    ended: false,
    isLive: true,
    segments: [],
  };
  if (typeof text !== 'string' || !text) return result;

  let pendingDuration = null;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#')) {
      if (trimmed.includes('EXT-X-ENDLIST')) {
        result.ended = true;
        result.isLive = false;
        continue;
      }
      const seqMatch = trimmed.match(/^#EXT-X-MEDIA-SEQUENCE:(\d+)/);
      if (seqMatch) {
        result.mediaSequence = parseInt(seqMatch[1], 10);
        continue;
      }
      const durMatch = trimmed.match(/^#EXT-X-TARGETDURATION:(\d+)/);
      if (durMatch) {
        result.targetDuration = parseInt(durMatch[1], 10);
        continue;
      }
      // EXTINF 归属下一条分片；带逗号标题（#EXTINF:5.0,title）同样可解析
      const infMatch = trimmed.match(/^#EXTINF:([\d.]+)/);
      if (infMatch) {
        pendingDuration = parseFloat(infMatch[1]);
      }
      continue;
    }

    // 非 # 开头的非空行 = 分片 URI（含 query 保留整行）
    result.segments.push({
      uri: trimmed,
      seq: result.mediaSequence + result.segments.length,
      duration: pendingDuration,
    });
    pendingDuration = null;
  }

  return result;
}

/**
 * 把清单内的相对分片/密钥 URI 解析为绝对 URL（录制引擎追分片用）
 * @param {string} uri - 清单行上的 URI（相对或绝对）
 * @param {string} baseUrl - 清单最终 URL（重定向后）
 * @returns {string} 绝对 URL；解析失败时原样返回
 */
function resolveUri(uri, baseUrl) {
  if (/^https?:\/\//i.test(uri)) return uri;
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return uri;
  }
}

module.exports = { parsePlaylist, resolveUri };

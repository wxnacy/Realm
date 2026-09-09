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
 * @returns {{ mediaSequence: number, targetDuration: number, ended: boolean, isLive: boolean, hasEncryption: boolean, keyUris: string[], keyIv: string|null, mapUri: string|null, mapByterange: string|null, segments: Array<{ uri: string, seq: number, duration: number|null }> }}
 *   mediaSequence — 滑动窗口基线序号（缺省 0）；segments[].seq = mediaSequence + 分片序位
 *   ended — 是否含 EXT-X-ENDLIST；isLive — 播放中清单（!ended）
 *   duration — 紧邻 EXTINF 标签的时长（秒），无对应标签时为 null
 *   hasEncryption — 任一 #EXT-X-KEY 行 METHOD ≠ NONE 即 true（AES-128 / SAMPLE-AES 都算；
 *     不因后续 METHOD=NONE 行回落——整清单出现过加密即视为加密流，G-44-7）
 *   keyUris — 加密 KEY 行的 URI="..." 原始值（相对/绝对原样保留，绝对化由调用方负责）；
 *     METHOD=NONE 行不收集
 *   keyIv — 首个加密 KEY 行的 IV=0x... 属性值（hex 字符串，不带 0x 前缀），无 IV 属性
 *     时为 null（按 HLS 规范此时 IV = 分片 media sequence 的 16 字节大端序）
 *   mapUri — 当前生效 #EXT-X-MAP 的 URI 属性原始值（fMP4 init 分片，D-05；缺省 null）。
 *     多 MAP 取最新一个（覆盖语义 = RFC 8216 §4.3.2.5「applies until the next
 *     EXT-X-MAP」）；fMP4 清单必有 MAP，反之有 MAP 即应按 fMP4 处理
 *   mapByterange — 当前生效 #EXT-X-MAP 的 BYTERANGE 属性原样字符串（备用；
 *     无 BYTERANGE 或无 MAP 时为 null）
 *   segments[].keyframe — #EXT-BILI-AUX 第二个 `|` 字段的 K/N 标记（B 站直播
 *     实测形态 `#EXT-BILI-AUX:<hex>|K|<hex>|<hex>`，K = 该分片以关键帧起步）：
 *     K→true、N→false、无 EXT-BILI-AUX 标签→null（未知，不做关键帧假设）。
 *     录制引擎据此把首个落盘分片对齐关键帧（mid-GOP 起点产物头部不可解码）
 */
function parsePlaylist(text) {
  const result = {
    mediaSequence: 0,
    targetDuration: DEFAULT_TARGET_DURATION,
    ended: false,
    isLive: true,
    hasEncryption: false,
    keyUris: [],
    keyIv: null,
    mapUri: null,
    mapByterange: null,
    segments: [],
  };
  if (typeof text !== 'string' || !text) return result;

  let pendingDuration = null;
  let pendingKeyframe = null;

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
      // EXT-BILI-AUX：B 站私有标签，归属下一条分片（同 EXTINF 挂接语义）；
      // 第二个 `|` 字段 K/N 标记分片是否以关键帧起步
      if (trimmed.startsWith('#EXT-BILI-AUX:')) {
        const fields = trimmed.slice('#EXT-BILI-AUX:'.length).split('|');
        if (fields[1] === 'K') pendingKeyframe = true;
        else if (fields[1] === 'N') pendingKeyframe = false;
        continue;
      }
      // EXT-X-KEY：METHOD ≠ NONE 即加密流（容忍引号与属性顺序）；
      // 加密行的 URI="..." 原始值收集进 keyUris（METHOD=NONE 不收集）
      if (trimmed.startsWith('#EXT-X-KEY:')) {
        const attrs = trimmed.slice('#EXT-X-KEY:'.length);
        const methodMatch = attrs.match(/(?:^|,)METHOD="?([^",]+)"?/i);
        const method = methodMatch ? methodMatch[1].toUpperCase() : '';
        if (method && method !== 'NONE') {
          result.hasEncryption = true;
          const uriMatch = attrs.match(/(?:^|,)URI="([^"]*)"/);
          if (uriMatch) result.keyUris.push(uriMatch[1]);
          // IV 属性（可选）：只取首个加密 KEY 行的值（整清单单密钥轮换场景；
          // 多密钥轮换不支持，按首密钥解密——常见 VOD 形态）
          if (result.keyIv === null) {
            const ivMatch = attrs.match(/(?:^|,)IV=0x([0-9a-fA-F]+)/);
            if (ivMatch) result.keyIv = ivMatch[1].toLowerCase();
          }
        }
        continue;
      }
      // EXT-X-MAP（D-05）：fMP4 init 分片 URI 捕获，同款 44-18 EXT-X-KEY 行级加法。
      // 多 MAP 覆盖取最新（RFC 8216 §4.3.2.5 作用域语义）；BYTERANGE 原样捕获备用
      if (trimmed.startsWith('#EXT-X-MAP:')) {
        const attrs = trimmed.slice('#EXT-X-MAP:'.length);
        const uriMatch = attrs.match(/(?:^|,)URI="([^"]*)"/);
        if (uriMatch) result.mapUri = uriMatch[1];
        const brMatch = attrs.match(/(?:^|,)BYTERANGE="([^"]*)"/);
        result.mapByterange = brMatch ? brMatch[1] : null;
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
      keyframe: pendingKeyframe,
    });
    pendingDuration = null;
    pendingKeyframe = null;
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

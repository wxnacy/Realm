/**
 * Realm Browser - 媒体分片磁盘缓存管理模块（Phase 44，D-03/D-05~D-10/D-12）
 *
 * /proxy 层的按视频组织的分片磁盘缓存：每个视频一个目录（视频ID = sha256(origin+pathname)
 * 前 16 位 hex），分片文件名 = sha256(分片最终 URL) hex，元数据 meta.json 记录
 * m3u8 地址/标题/分片索引（大小+哈希）/总大小/最后播放进度/最后观看时间（D-05）。
 *
 * 去 Electron 化设计：顶层无 electron / 原生模块 require，constructor 注入
 * cacheRoot / capacityBytes / isVideoActive，纯 Node 环境可测试
 * （见 tests/test-media-cache.js）。
 *
 * 路径安全（T-44-01/T-44-02）：视频 ID 与分片名一律 sha256 hex 白名单校验，
 * 任何读写经 path.resolve 后必须位于 cacheRoot 内，已存在路径 realpath 复核
 * 仍在 cacheRoot 内（防 symlink 二段式逃逸，参照 agent-workspace resolveInside）。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const { parsePlaylist, resolveUri } = require('./media-m3u8-parser');

/** meta.json 当前格式版本（D-03 costly：改结构必须升版本并写迁移） */
const META_VERSION = 1;

/**
 * EXT-X-DISCONTINUITY 标签检测（整行匹配，不误中 DISCONTINUITY-SEQUENCE）。
 * 含不连续片段的流转封装时间轴跳变（Pitfall 5），D-17 允许隐藏转换按钮。
 */
const DISCONTINUITY_RE = /(^|\r?\n)#EXT-X-DISCONTINUITY(\r?\n|$)/;

/** 视频目录 ID 白名单：16 位 hex */
const VIDEO_ID_RE = /^[a-f0-9]{16}$/;

/** 默认容量上限 10GB（D-06，设置页可改后经 constructor 注入覆盖） */
const DEFAULT_CAPACITY_BYTES = 10 * 1024 * 1024 * 1024;

/**
 * 单分片缓存大小上限（T-44-03 DoS：恶意超大分片不落盘，只透传不缓存）
 * @type {number}
 */
const MAX_SEGMENT_BYTES = 64 * 1024 * 1024;

/**
 * 续播匹配 key（D-12）：query 时效 token 不参与，仅 origin + pathname
 * @param {string} rawUrl - 视频/分片 URL
 * @returns {string} origin+pathname
 */
function playbackKeyOf(rawUrl) {
  const u = new URL(rawUrl);
  return `${u.origin}${u.pathname}`;
}

/**
 * 分片缓存 key：sha256(分片最终 URL) hex（重定向后的 finalUrl）
 * @param {string} rawUrl - 分片 URL
 * @returns {string} 64 位 hex
 */
function segmentKeyOf(rawUrl) {
  return crypto.createHash('sha256').update(rawUrl).digest('hex');
}

/**
 * 视频目录 ID：sha256(playbackKey) hex 前 16 位（D-05）
 * @param {string} rawUrl - m3u8 URL
 * @returns {string} 16 位 hex
 */
function videoIdOf(rawUrl) {
  return crypto.createHash('sha256').update(playbackKeyOf(rawUrl)).digest('hex').slice(0, 16);
}

/**
 * 媒体分片磁盘缓存管理器
 */
class MediaCacheManager {
  /**
   * @param {Object} opts
   * @param {string} opts.cacheRoot - 缓存根目录（默认 userData/media-cache，由 main.js 注入）
   * @param {number} [opts.capacityBytes] - 容量上限（默认 10GB，D-06）
   * @param {Function} [opts.isVideoActive] - 淘汰豁免回调（D-07）：
   *   (playbackKey: string) => boolean，44-03 集成时注入 mediaTaskManager.isVideoActive，
   *   本模块不得直接 require media-task-manager（解耦靠注入）
   */
  constructor({ cacheRoot, capacityBytes, isVideoActive }) {
    if (!cacheRoot || typeof cacheRoot !== 'string') {
      throw new Error('MediaCacheManager 需要 cacheRoot 参数');
    }
    this.cacheRoot = path.resolve(cacheRoot);
    this.capacityBytes = typeof capacityBytes === 'number' && capacityBytes > 0
      ? capacityBytes
      : DEFAULT_CAPACITY_BYTES;
    this.isVideoActive = typeof isVideoActive === 'function' ? isVideoActive : () => false;
    this._rootRealCache = null;
    // CR-02 容量水位：null = 未初始化（进程内首次写盘前以磁盘实际总量惰性初始化）。
    // 此后每片 O(1) 加法累计，仅水位越过 capacityBytes 才触发一次全库扫描淘汰
    // （避免 storeBuffer 每片写盘后无条件全库扫描的性能回归——prohibition）。
    this._trackedTotal = null;
  }

  /** @see playbackKeyOf */
  playbackKey(rawUrl) {
    return playbackKeyOf(rawUrl);
  }

  /** @see videoIdOf */
  videoId(rawUrl) {
    return videoIdOf(rawUrl);
  }

  // ==================== 路径安全 ====================

  /**
   * cacheRoot 的 realpath（缓存一次，目录被删重建时失效风险可接受——
   * realpath 校验的目标是防 symlink 逃逸，根目录本身由应用创建）
   * @returns {string} cacheRoot 的绝对路径（尽量 realpath）
   */
  _rootReal() {
    if (!this._rootRealCache) {
      let real = this.cacheRoot;
      try {
        if (fs.existsSync(real)) real = fs.realpathSync(real);
      } catch { /* realpath 失败时用 resolve 结果 */ }
      this._rootRealCache = real;
    }
    return this._rootRealCache;
  }

  /**
   * 路径安全校验（T-44-01/T-44-02）：
   * 1. resolve 后必须位于 cacheRoot 内（防 .. 穿越）；
   * 2. 最深已存在祖先 realpath 复核仍在 cacheRoot 内
   *    （防 cacheRoot 内目录被替换为指向外部的 symlink）。
   * @param {...string} parts - 相对 cacheRoot 的路径段
   * @returns {string} 校验通过的绝对路径
   * @throws {Error} 路径越界时抛出
   */
  _safePath(...parts) {
    const rootAbs = this.cacheRoot;
    const rootReal = this._rootReal();
    const abs = path.resolve(rootAbs, ...parts);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
      throw new Error(`缓存路径越界: ${abs}`);
    }
    // 找最深已存在祖先做 realpath 复核
    let existing = abs;
    const missing = [];
    for (let i = 0; i < 32; i++) {
      if (fs.existsSync(existing)) break;
      missing.unshift(path.basename(existing));
      existing = path.dirname(existing);
      if (existing === path.dirname(existing)) break; // 到达根
    }
    let realAbs = abs;
    try {
      const realExisting = fs.realpathSync(existing);
      realAbs = missing.length ? path.join(realExisting, ...missing) : realExisting;
    } catch { /* realpath 失败保持 abs */ }
    if (realAbs !== rootReal && !realAbs.startsWith(rootReal + path.sep)) {
      throw new Error(`缓存路径越界（symlink 复核失败）: ${abs}`);
    }
    return abs;
  }

  /**
   * 校验视频 ID 格式（hex 白名单，杜绝路径穿越）
   * @param {string} videoId - 视频目录 ID
   * @returns {string} 校验通过的 ID
   * @throws {Error} 格式不合法时抛出
   */
  _assertVideoId(videoId) {
    if (!VIDEO_ID_RE.test(videoId)) {
      throw new Error(`视频 ID 格式不合法: ${videoId}`);
    }
    return videoId;
  }

  // ==================== 目录/元数据 ====================

  /** @param {string} videoId - 视频目录 ID @returns {string} 视频目录绝对路径 */
  _videoDir(videoId) {
    return this._safePath(this._assertVideoId(videoId));
  }

  /** @param {string} videoId - 视频目录 ID @returns {string} segments 目录绝对路径 */
  _segmentsDir(videoId) {
    return this._safePath(this._assertVideoId(videoId), 'segments');
  }

  /** @param {string} videoId - 视频目录 ID @returns {string} meta.json 绝对路径 */
  _metaPath(videoId) {
    return this._safePath(this._assertVideoId(videoId), 'meta.json');
  }

  /**
   * 读取视频元数据（不存在时返回 null）
   * @param {string} videoId - 视频目录 ID
   * @returns {Object|null} meta 对象
   */
  _readMeta(videoId) {
    try {
      return JSON.parse(fs.readFileSync(this._metaPath(videoId), 'utf8'));
    } catch {
      return null;
    }
  }

  /**
   * 写入视频元数据（目录不存在时创建）
   * @param {string} videoId - 视频目录 ID
   * @param {Object} meta - meta 对象
   */
  _writeMeta(videoId, meta) {
    const dir = this._videoDir(videoId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this._metaPath(videoId), JSON.stringify(meta, null, 2));
  }

  /**
   * 登记视频上下文（m3u8 清单请求时调用）：确保目录与 meta.json 存在，
   * 刷新 last_watched（D-05/D-07 淘汰排序依据）
   * @param {string} m3u8Url - 清单最终 URL（重定向后）
   * @param {string} [title] - 标题（后续经 player:progress 更新为真实标题）
   * @returns {string} 视频目录 ID
   */
  touchVideo(m3u8Url, title) {
    const vid = videoIdOf(m3u8Url);
    const now = Date.now();
    let meta = this._readMeta(vid);
    if (!meta || meta.version !== META_VERSION) {
      meta = {
        version: META_VERSION,
        playback_key: playbackKeyOf(m3u8Url),
        m3u8_url: m3u8Url,
        title: typeof title === 'string' ? title : '',
        total_size: 0,
        segments: {},
        last_position: 0,
        last_watched: now,
        created_at: now,
      };
    } else {
      meta.m3u8_url = m3u8Url;
      meta.last_watched = now;
      if (title && !meta.title) meta.title = title;
    }
    this._writeMeta(vid, meta);
    return vid;
  }

  // ==================== 读缓存 ====================

  /**
   * 查找分片缓存（D-09）：读盘前校验大小 + sha256，失败即删该分片文件
   * 并返回 miss（调用方回源重拉，播放不中断）
   * @param {string} finalUrl - 分片最终 URL（重定向后）
   * @param {string} videoId - 视频目录 ID（由 /proxy 请求的 vid 参数提供）
   * @returns {{hit: boolean, data?: Buffer, size?: number, contentType?: string}}
   *   contentType 仅在登记条目带该附加字段（CR-05/Task 2）时返回，供命中回放；
   *   缺省时由调用方回落 application/octet-stream
   */
  lookup(finalUrl, videoId) {
    try {
      this._assertVideoId(videoId);
      const segKey = segmentKeyOf(finalUrl);
      const meta = this._readMeta(videoId);
      if (!meta || !meta.segments || !meta.segments[segKey]) {
        return { hit: false };
      }
      const entry = meta.segments[segKey];
      const file = this._safePath(videoId, 'segments', segKey);
      if (!fs.existsSync(file)) {
        return { hit: false };
      }
      // 大小校验（Pitfall 4：Content-Length 失真防不住磁盘层面的截断）
      const st = fs.statSync(file);
      if (st.size !== entry.size) {
        this._invalidateSegment(videoId, segKey, file, 'size mismatch');
        return { hit: false };
      }
      const data = fs.readFileSync(file);
      // 哈希校验（D-09）
      const sha = crypto.createHash('sha256').update(data).digest('hex');
      if (sha !== entry.sha256) {
        this._invalidateSegment(videoId, segKey, file, 'sha256 mismatch');
        return { hit: false };
      }
      // 命中回放：登记条目带 contentType（字符串且 ≤200 字符）则随命中返回，
      // 否则不带该字段（main.js 命中分支回落 application/octet-stream）
      const ct = typeof entry.contentType === 'string' && entry.contentType.length <= 200
        ? entry.contentType
        : null;
      const hitBase = { hit: true, data, size: data.length };
      return ct ? { ...hitBase, contentType: ct } : hitBase;
    } catch (err) {
      console.warn('[Realm] 缓存读取失败（按 miss 处理）:', err.message);
      return { hit: false };
    }
  }

  /**
   * 校验失败处理：删分片文件 + 从索引移除（D-09 删片回源）
   * @param {string} videoId - 视频目录 ID
   * @param {string} segKey - 分片 key
   * @param {string} file - 分片文件路径
   * @param {string} reason - 原因（日志用）
   */
  _invalidateSegment(videoId, segKey, file, reason) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      const meta = this._readMeta(videoId);
      if (meta && meta.segments && meta.segments[segKey]) {
        const size = meta.segments[segKey].size || 0;
        delete meta.segments[segKey];
        meta.total_size = Math.max(0, (meta.total_size || 0) - size);
        this._writeMeta(videoId, meta);
      }
      console.warn(`[Realm] 缓存分片校验失败已删除（${reason}）: ${videoId}/${segKey.slice(0, 12)}…`);
    } catch (err) {
      console.warn('[Realm] 缓存分片删除失败:', err.message);
    }
  }

  // ==================== 写缓存 ====================

  /**
   * 落盘分片（tee 语义）：把回源流一边透传给调用方（播放器），一边收集
   * 完整分片后写盘登记。收集完成即异步写盘，不阻塞透传。
   *
   * 注意：本方法消费 readable（tee 出 passthrough），调用方拿返回值 pipe 给响应。
   * 调用契约（CR-05）：本方法内部处理 readable 的 'error'（destroy 双 tee + warn），
   * 调用方无需再给源流挂监听——只需在返回值（passthrough）上挂 'error' 收尾响应。
   * @param {string} finalUrl - 分片最终 URL（重定向后，缓存 key）
   * @param {string} videoId - 视频目录 ID
   * @param {import('stream').Readable} readable - 回源流（Readable.fromWeb(resp.body)）
   * @param {Object} [meta] - 附加元数据（如 title / contentType）
   * @returns {import('stream').PassThrough} 透传流（pipe 给 HTTP 响应）
   */
  store(finalUrl, videoId, readable, meta) {
    const passthrough = new PassThrough();
    const collector = new PassThrough();
    // CR-05：源流 'error' 无监听 → uncaught exception → 主进程退出（Node 流契约）。
    // pipe 不负责 source 的 error，此监听必须先于 pipe 挂载（晚挂会漏掉同步错误）。
    // destroy(err) 的错误事件异步派发，集成层在返回值上同步挂的 'error' 无竞态。
    readable.on('error', (err) => {
      console.warn(`[Realm] 回源流中断（透传与落盘同步终止）: ${err.message}`);
      passthrough.destroy(err);
      collector.destroy();
    });
    readable.pipe(passthrough);
    readable.pipe(collector);

    const chunks = [];
    let bytes = 0;
    collector.on('data', (c) => {
      bytes += c.length;
      if (bytes <= MAX_SEGMENT_BYTES) chunks.push(c);
    });
    collector.on('end', () => {
      if (bytes > MAX_SEGMENT_BYTES) {
        console.warn(`[Realm] 分片超过缓存大小上限（${bytes} 字节），跳过落盘: ${finalUrl}`);
        return;
      }
      try {
        this.storeBuffer(finalUrl, videoId, Buffer.concat(chunks), meta || {});
      } catch (err) {
        console.warn('[Realm] 分片落盘失败:', err.message);
      }
    });
    collector.on('error', (err) => {
      console.warn('[Realm] 分片收集中断（不落盘）:', err.message);
    });
    passthrough.on('error', (err) => {
      console.warn('[Realm] 缓存透传流错误:', err.message);
    });
    return passthrough;
  }

  /**
   * 把完整分片 buffer 写盘并登记进 meta.json（供测试与 store 内部调用）
   *
   * - 已登记分片再次写入时跳过不重写（D-10 增量续存）；
   * - 索引记录实际字节数与 sha256（D-09/Pitfall 4：不信任上游 Content-Length）；
   * - 写盘 ENOSPC/EDQUOT → 强制淘汰一轮（豁免规则仍生效）后重试一次，
   *   仍失败返回 { ok:false, reason:'disk_full' }（D-08）。
   * @param {string} finalUrl - 分片最终 URL
   * @param {string} videoId - 视频目录 ID
   * @param {Buffer} buffer - 分片内容
   * @param {Object} [meta] - { title?, lastWatched? }
   * @returns {{ok: boolean, skipped?: boolean, reason?: string, size?: number}}
   */
  storeBuffer(finalUrl, videoId, buffer, meta) {
    try {
      this._assertVideoId(videoId);
      const segKey = segmentKeyOf(finalUrl);
      const m = meta || {};
      let mMeta = this._readMeta(videoId);
      if (!mMeta || mMeta.version !== META_VERSION) {
        // 分片先于清单到达（或 meta 损坏）：按 finalUrl 的 key 建档
        mMeta = {
          version: META_VERSION,
          playback_key: playbackKeyOf(finalUrl),
          m3u8_url: '',
          title: typeof m.title === 'string' ? m.title : '',
          total_size: 0,
          segments: {},
          last_position: 0,
          last_watched: Date.now(),
          created_at: Date.now(),
        };
      }
      // D-10 增量续存：已登记分片跳过不重写
      if (mMeta.segments && mMeta.segments[segKey]) {
        return { ok: true, skipped: true };
      }

      const file = this._safePath(videoId, 'segments', segKey);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const written = this._writeWithEvictRetry(file, buffer, videoId);
      if (!written.ok) return written;

      // 登记索引：实际落盘字节数（stat，不信任上游 Content-Length）+ 哈希
      const size = fs.statSync(file).size;
      const sha = crypto.createHash('sha256').update(buffer).digest('hex');
      mMeta.segments = mMeta.segments || {};
      // stored_at：分片写入时间（44-05 转封装兜底排序——清单顺序索引缺失时
      // 按「播放到哪写到哪」的时间序拼分片，VOD 线性观看场景顺序正确）
      const entry = { size, sha256: sha, stored_at: Date.now() };
      // contentType 附加字段（CR-05/Task 2）：落盘时登记，命中回放 Content-Type 用。
      // 附加字段向后兼容（缺字段不升 META_VERSION），转封装读取路径不消费该字段
      const ct = m.contentType;
      if (typeof ct === 'string' && ct && ct.length <= 200) entry.contentType = ct;
      mMeta.segments[segKey] = entry;
      mMeta.total_size = (mMeta.total_size || 0) + size;
      mMeta.last_watched = typeof m.lastWatched === 'number' ? m.lastWatched : Date.now();
      if (m.title && !mMeta.title) mMeta.title = m.title;
      this._writeMeta(videoId, mMeta);
      // CR-02 写路径容量水位检查：旧实现 evictIfNeeded 仅 _writeWithEvictRetry 的
      // ENOSPC/EDQUOT 分支可达（物理盘满才触发），capacityBytes 上限生产失效、
      // 缓存只增到盘满。此处落盘登记成功后即累计水位并越过容量时触发一轮 FIFO 淘汰。
      // 水位方案取舍（prohibition）：不做每片全库扫描——首写惰性初始化取磁盘权威总量
      //（_writeMeta 已把本片计入 meta.total_size，磁盘口径已含本片，直接取不再重复加
      // size，防双计）；此后每片 O(1) 加法。仅水位越过容量才全扫一次（evictIfNeeded
      // 内部以 listEntries 为权威），淘汰后把返回的 r.total 同步回水位（自校正漂移）。
      if (this._trackedTotal === null) {
        this._trackedTotal = this._diskTotalBytes();
      } else {
        this._trackedTotal += size;
      }
      if (this._trackedTotal > this.capacityBytes) {
        try {
          // exempt 传正在写入的 videoId（防误删自己目录，与 _writeWithEvictRetry
          // ENOSPC 强淘同款豁免）；D-07 isVideoActive 活跃豁免在 evictIfNeeded 内部保持
          const r = this.evictIfNeeded(new Set([videoId]));
          this._trackedTotal = r.total;
        } catch (err) {
          console.warn('[Realm] 写路径容量淘汰失败:', err.message);
        }
      }
      return { ok: true, size };
    } catch (err) {
      console.warn('[Realm] 分片写盘失败:', err.message);
      return { ok: false, reason: err.message };
    }
  }

  /**
   * 写文件并在磁盘满（ENOSPC/EDQUOT）时强制淘汰一轮后重试一次（D-08）
   * @param {string} file - 目标文件路径
   * @param {Buffer} buffer - 内容
   * @param {string} [videoId] - 正在写入的视频 ID（强淘豁免，防删掉自己的目录）
   * @returns {{ok: boolean, reason?: string}}
   */
  _writeWithEvictRetry(file, buffer, videoId) {
    try {
      fs.writeFileSync(file, buffer);
      return { ok: true };
    } catch (err) {
      const isDiskFull = err.code === 'ENOSPC' || err.code === 'EDQUOT';
      if (!isDiskFull) throw err;
      console.warn('[Realm] 磁盘空间不足，触发强制淘汰:', err.message);
      const freed = this.evictIfNeeded(new Set(videoId ? [videoId] : []));
      console.log(`[Realm] 强制淘汰释放 ${freed.freed} 字节，重试写盘`);
      try {
        fs.writeFileSync(file, buffer);
        return { ok: true };
      } catch (retryErr) {
        console.error('[Realm] 强制淘汰后仍写盘失败:', retryErr.message);
        return { ok: false, reason: 'disk_full' };
      }
    }
  }

  // ==================== 淘汰与删除 ====================

  /**
   * 磁盘权威总量（复用 listEntries 口径：meta.total_size 优先、目录递归兜底）。
   * 供水位惰性初始化与淘汰后同步——evictIfNeeded 始终以本口径为权威，
   * 外部删除/deleteEntry/校验删片造成的水位漂移在每次淘汰后收敛（T-44-G07-02 accept）。
   * @returns {number} 缓存目录总字节数
   */
  _diskTotalBytes() {
    return this.listEntries().reduce((sum, e) => sum + (e.size || 0), 0);
  }

  /**
   * 更新容量上限并立即触发一轮容量检查（CR-02：设置页改小 cacheMaxGB 即收敛，
   * 不再只是改字段——旧实现 evictIfNeeded 唯一可达点在 ENOSPC 分支，容量上限生产失效）。
   * - 容量调大且未超：evictIfNeeded 内部 total<=capacity 短路，仅一次扫描零淘汰；
   * - 容量调小：立即按 last_watched FIFO 收敛到新上限（豁免语义照常生效）。
   * - 入参非有限正数时回落 DEFAULT_CAPACITY_BYTES。
   * @param {number} bytes - 新容量上限（字节）
   */
  setCapacityBytes(bytes) {
    this.capacityBytes = (typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0)
      ? bytes
      : DEFAULT_CAPACITY_BYTES;
    try {
      const r = this.evictIfNeeded();
      this._trackedTotal = r.total;
    } catch (err) {
      console.warn('[Realm] 容量变更淘汰失败:', err.message);
    }
  }

  /**
   * 容量淘汰（D-06/D-07）：总大小超 capacityBytes 时按 meta.last_watched 升序
   * 整视频目录删除，活跃任务（isVideoActive(playbackKey) === true）豁免。
   * @param {Set<string>} [exemptVideoIds] - 额外豁免的视频 ID
   *   （如正在写入的条目，防强淘删掉自己的目录）
   * @returns {{freed: number, total: number, evicted: string[]}}
   */
  evictIfNeeded(exemptVideoIds) {
    const exempt = exemptVideoIds instanceof Set ? exemptVideoIds : new Set();
    const entries = this.listEntries();
    let total = entries.reduce((sum, e) => sum + (e.size || 0), 0);
    if (total <= this.capacityBytes) {
      return { freed: 0, total, evicted: [] };
    }
    const freed = { n: 0 };
    const evicted = [];
    entries
      .sort((a, b) => (a.meta.last_watched || 0) - (b.meta.last_watched || 0))
      .forEach((e) => {
        if (total <= this.capacityBytes) return;
        // D-07：活跃任务（正在缓存/录制的视频）豁免淘汰
        if (this.isVideoActive(e.meta.playback_key || '')) return;
        if (exempt.has(e.videoId)) return;
        try {
          const dir = this._videoDir(e.videoId);
          fs.rmSync(dir, { recursive: true, force: true });
          total -= e.size || 0;
          freed.n += e.size || 0;
          evicted.push(e.videoId);
          console.log(`[Realm] 缓存淘汰: ${e.videoId} (${e.size} 字节, last_watched=${e.meta.last_watched})`);
        } catch (err) {
          console.warn(`[Realm] 缓存淘汰失败 ${e.videoId}:`, err.message);
        }
      });
    return { freed: freed.n, total, evicted };
  }

  /**
   * 删除单个缓存条目（整视频目录，D-16 后端）。路径边界校验后整目录删除。
   * @param {string} videoId - 视频目录 ID
   * @returns {{success: boolean, error?: string}}
   */
  deleteEntry(videoId) {
    try {
      const dir = this._videoDir(videoId);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      return { success: true };
    } catch (err) {
      console.error('[Realm] 删除缓存条目失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ==================== 查询与进度同步 ====================

  // ==================== 转封装索引（Phase 44 D-17/D-22，44-05 补齐 44-01 completeness 预留） ====================

  /**
   * 更新播放清单索引（m3u8 清单请求时由 main.js /proxy 分支调用）：
   * 记录分片播放顺序（segKey 有序数组）、分片总数、ENDLIST、DISCONTINUITY——
   * 转封装需要播放顺序（segments 索引本身是按 URL 哈希的无序 map），
   * 完整度（D-17）需要分片总数做分母。附加字段向后兼容（旧 meta 缺字段时
   * 完整度为 null、转换按钮隐藏，不升 META_VERSION）。
   * @param {string} m3u8Url - 清单最终 URL（重定向后）
   * @param {string} playlistText - 清单原始文本
   */
  updatePlaylistIndex(m3u8Url, playlistText) {
    const vid = videoIdOf(m3u8Url);
    const meta = this._readMeta(vid);
    if (!meta || meta.version !== META_VERSION) return;
    const pl = parsePlaylist(playlistText || '');
    const order = [];
    for (const seg of pl.segments) {
      try {
        // 分片 URI → 绝对 URL → 缓存 key（与 storeBuffer 的 segKey 同源）
        order.push(segmentKeyOf(resolveUri(seg.uri, m3u8Url)));
      } catch { /* 非法 URI 跳过 */ }
    }
    meta.playlist_order = order;
    meta.total_segments = order.length;
    meta.playlist_ended = !!pl.ended;
    meta.has_discontinuity = DISCONTINUITY_RE.test(playlistText || '');
    this._writeMeta(vid, meta);
  }

  /**
   * 读取缓存条目的转封装信息（player:convert/start 入口数据源，D-17）
   * 分片顺序：playlist_order 优先（权威播放顺序，且须覆盖全部已登记分片），
   * 回退 stored_at 时间序（VOD 线性观看近似正确）。
   * @param {string} videoId - 视频目录 ID（16 位 hex）
   * @returns {{ title: string, m3u8Url: string, playbackKey: string, segmentPaths: string[], completeness: number|null, totalSegments: number|null, hasDiscontinuity: boolean }|null}
   *   completeness=null 表示分片总数未知（无法确认齐全，D-17 按不齐全处理）
   */
  getConvertInfo(videoId) {
    this._assertVideoId(videoId);
    const meta = this._readMeta(videoId);
    if (!meta) return null;
    const segs = meta.segments || {};
    const allKeys = Object.keys(segs);
    let keys = null;
    if (Array.isArray(meta.playlist_order) && meta.playlist_order.length === allKeys.length) {
      keys = meta.playlist_order.filter((k) => segs[k]);
      if (keys.length !== allKeys.length) keys = null; // 顺序索引与实际分片不匹配 → 回退
    }
    if (!keys) {
      keys = allKeys.slice().sort((a, b) => (segs[a].stored_at || 0) - (segs[b].stored_at || 0));
    }
    const segmentPaths = [];
    for (const k of keys) {
      try {
        const f = this._safePath(videoId, 'segments', k);
        if (fs.existsSync(f)) segmentPaths.push(f);
      } catch { /* 路径校验失败跳过 */ }
    }
    const total = typeof meta.total_segments === 'number' && meta.total_segments > 0
      ? meta.total_segments
      : null;
    const completeness = total
      ? Math.min(100, Math.round((segmentPaths.length / total) * 100))
      : null;
    return {
      title: meta.title || '',
      m3u8Url: meta.m3u8_url || '',
      playbackKey: meta.playback_key || '',
      segmentPaths,
      completeness,
      totalSegments: total,
      hasDiscontinuity: !!meta.has_discontinuity,
    };
  }

  /**
   * 列出所有缓存条目（抽屉列表数据源之一）
   * @returns {Array<{videoId: string, meta: Object, size: number}>}
   */
  listEntries() {
    const out = [];
    try {
      if (!fs.existsSync(this.cacheRoot)) return out;
      for (const name of fs.readdirSync(this.cacheRoot)) {
        if (!VIDEO_ID_RE.test(name)) continue;
        let dirSize = 0;
        try {
          dirSize = this._dirSize(this._safePath(name));
        } catch { continue; }
        const meta = this._readMeta(name) || { playback_key: '', title: '', last_watched: 0, total_size: dirSize, segments: {} };
        out.push({ videoId: name, meta, size: meta.total_size || dirSize });
      }
    } catch (err) {
      console.warn('[Realm] 列举缓存条目失败:', err.message);
    }
    return out;
  }

  /**
   * 递归统计目录大小
   * @param {string} dir - 目录绝对路径
   * @returns {number} 字节数
   */
  _dirSize(dir) {
    let total = 0;
    let stats = [];
    try {
      stats = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const ent of stats) {
      const p = path.join(dir, ent.name);
      try {
        if (ent.isDirectory()) total += this._dirSize(p);
        else if (ent.isFile()) total += fs.statSync(p).size;
      } catch { /* 单文件统计失败忽略 */ }
    }
    return total;
  }

  /**
   * 进度同步（D-11/D-13）：player:progress 上报时按 playbackKey 找到缓存条目，
   * 刷新 last_position / last_watched（观看历史由 player-history-manager 独立落盘）
   * @param {string} rawUrl - 视频 URL（m3u8，query 不参与匹配）
   * @param {number} position - 播放位置（秒）
   * @returns {boolean} 是否命中并更新了缓存条目
   */
  updateProgress(rawUrl, position) {
    try {
      const key = playbackKeyOf(rawUrl);
      for (const e of this.listEntries()) {
        if (e.meta.playback_key === key) {
          const meta = this._readMeta(e.videoId);
          if (meta) {
            meta.last_position = Number(position) || 0;
            meta.last_watched = Date.now();
            this._writeMeta(e.videoId, meta);
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('[Realm] 缓存进度同步失败:', err.message);
    }
    return false;
  }
}

module.exports = { MediaCacheManager, playbackKeyOf, segmentKeyOf, videoIdOf, VIDEO_ID_RE };

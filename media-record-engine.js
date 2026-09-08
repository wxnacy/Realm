/**
 * media-record-engine — 直播 m3u8 轮询追分片录制引擎（Phase 44，D-18/D-20/D-21/D-23）
 *
 * 录制 = 显式后台任务：主进程独立轮询直播 m3u8 清单，按 MEDIA-SEQUENCE 序号
 * 去重追新分片落盘到独立录制目录（recordRoot/<taskId>/segments/，D-23 不参与
 * 缓存容量淘汰）。与播放状态完全解耦（D-20）：不依赖/复用 hls.js 实例，
 * 仅消费注入的 fetchPage + media-m3u8-parser。
 *
 * 语义要点：
 * - D-21 首轮清单只记基线（现有分片 seq 进 seen 集合）不落盘——从直播边缘开始
 * - D-18 并发上限（默认 2）、同 playbackKey 去重拒绝、连续失败 maxRetries 次
 *   停录标 failed（已落盘分片与索引保留）
 * - D-20 按 seq 去重落盘，文件名仅 `<seq 补零>.ts` 纯数字（T-44-11，无远端输入入路径）
 * - T-44-13 轮询间隔下限钳制 ≥2s（防恶意 targetDuration 极小致轮询风暴）
 * - 停止 → 写分片索引 meta.json → completeTask({ outputPath })（D-22 接力
 *   由 44-05 经 taskManager.onTaskCompleted 消费）
 *
 * **去 Electron 化**：fetchPage 为注入依赖 `(url, { referer, containerId }) => Promise<Buffer>`
 * （集成层在 main.js 用容器 session 包装 ses.fetch），顶层无 electron require——
 * 纯 Node 可加载可测试（44-VALIDATION Wave 0 硬约束）。
 */

const fs = require('fs');
const path = require('path');
const { resolveUri } = require('./media-m3u8-parser');

/** 轮询间隔下限（ms）：防恶意清单 targetDuration 极小致轮询风暴（T-44-13） */
const MIN_POLL_INTERVAL_MS = 2000;

/** 分片文件名 seq 补零位数（8 位足够直播时长场景） */
const SEQ_PAD = 8;

/** fMP4 分片合法起始 box 类型白名单（B 站直播实测首 box 为 moof；styp/ftyp/sidx 为 CMAF 合法形态） */
const FMP4_SEGMENT_BOX_TYPES = new Set(['moof', 'styp', 'ftyp', 'sidx']);

/**
 * 分片内容落盘前嗅探（防 CDN 毒应答污染录制）：
 * B 站直播实测：签名过期/CDN 节点切换边缘，分片请求可能以 HTTP 200 返回
 * 当前 m3u8 清单文本——零校验落盘后混进 moof/mdat 字节流，fMP4 解析器走到
 * 该处即中断，转码产物时长截断在坏分片处（数据全在但不可见）。
 * 判定序：
 * ① `#EXTM3U` 前缀 = 清单毒应答 → 拒绝；
 * ② 已知 fMP4 录制（mapUri 已捕获）→ 要求首 box 头合法（白名单类型 + size 不越界）；
 * ③ 格式未知（TS 流或 MAP 尚未捕获）→ 0x47 同步字节或合法 box 头放行（宽松，
 *    不在录制期误杀未知-but-合法的形态）。
 * @param {Buffer} buf - 下载的分片内容
 * @param {boolean} expectFmp4 - 是否已知为 fMP4 录制（st.mapUri 已捕获）
 * @returns {boolean} true = 内容可落盘
 */
function isPlausibleSegment(buf, expectFmp4) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return false;
  // ① 清单毒应答（含 BOM/前导空白变体一律按前 16 字节内出现 #EXTM3U 判定）
  if (buf.subarray(0, 16).includes('#EXTM3U')) return false;
  // TS 同步字节：任何形态下都放行
  if (buf[0] === 0x47) return true;
  // box 头校验：offset 4 为类型、声明 size 不越界
  const boxOk = buf.length >= 8
    && buf.readUInt32BE(0) >= 8
    && buf.readUInt32BE(0) <= buf.length
    && FMP4_SEGMENT_BOX_TYPES.has(buf.toString('ascii', 4, 8));
  // ② 已知 fMP4 录制必须 box 头合法；③ 未知形态 box 合法也放行
  return boxOk;
}



/**
 * 创建直播录制引擎
 * @param {Object} deps - 注入依赖
 * @param {Function} deps.fetchPage - (url, { referer, containerId }) => Promise<Buffer>，容器 session 回源（main.js 包装 ses.fetch）
 * @param {Function} [deps.parsePlaylist] - m3u8 清单解析（缺省 require media-m3u8-parser）
 * @param {Object} deps.taskManager - createMediaTaskManager 实例（registerTask/updateProgress/failTask/completeTask）
 * @param {string} deps.recordRoot - 录制根目录（缺省约定 userData/media-records，由集成层传入）
 * @param {number} [deps.maxConcurrent=2] - 并发录制任务上限（D-18）
 * @param {number} [deps.maxRetries=5] - 连续失败停录阈值（D-18）
 * @returns {{ startRecord: Function, stopRecord: Function, getRecordStatus: Function, getActiveRecordings: Function, stopAll: Function }}
 */
function createRecordEngine({ fetchPage, parsePlaylist, taskManager, recordRoot, maxConcurrent = 2, maxRetries = 5 }) {
  if (typeof fetchPage !== 'function') throw new Error('createRecordEngine 需要注入 fetchPage');
  if (!taskManager || typeof taskManager.registerTask !== 'function') throw new Error('createRecordEngine 需要注入 taskManager');
  if (typeof recordRoot !== 'string' || !recordRoot) throw new Error('createRecordEngine 需要注入 recordRoot');
  const parse = typeof parsePlaylist === 'function' ? parsePlaylist : (text) => require('./media-m3u8-parser').parsePlaylist(text);

  /** 运行中录制状态：taskId → state（任务终态后从 Map 移除） */
  const active = new Map();

  /** @returns {string} playbackKey（origin+pathname，与 44-01/D-12 语义一致） */
  function playbackKeyOf(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return `${u.origin}${u.pathname}`;
    } catch {
      return rawUrl;
    }
  }

  /** @returns {number} 当前运行中的录制任务数 */
  function runningCount() {
    return active.size;
  }

  /**
   * 发起录制（D-18：显式后台任务）
   * @param {{ url: string, title: string, containerId?: string, referer?: string }} input
   * @returns {Promise<{ ok: boolean, taskId?: string, reason?: string }>}
   *   reason: 'invalid_input' | 'already_recording'（同 playbackKey 已在录）| 'concurrency_limit'
   */
  async function startRecord(input) {
    const { url, title, containerId, referer } = input || {};
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, reason: 'invalid_input' };
    }
    if (!title || typeof title !== 'string') {
      return { ok: false, reason: 'invalid_input' };
    }
    const playbackKey = playbackKeyOf(url);
    // D-18 同 URL 去重：已在录的 playbackKey 拒绝重复录制
    for (const st of active.values()) {
      if (st.playbackKey === playbackKey) {
        return { ok: false, reason: 'already_recording' };
      }
    }
    // D-18 并发上限
    if (runningCount() >= maxConcurrent) {
      return { ok: false, reason: 'concurrency_limit' };
    }

    // playbackKey 随任务注册（44-02 契约：供 isVideoActive(playbackKey) 做 D-07 淘汰豁免查询）
    const task = taskManager.registerTask({ type: 'record', title, containerId: containerId || '', playbackKey });
    const taskId = task.id;

    const taskDir = path.join(recordRoot, taskId);
    const segmentsDir = path.join(taskDir, 'segments');
    fs.mkdirSync(segmentsDir, { recursive: true });

    const st = {
      taskId,
      url,
      playbackKey,
      title,
      containerId: containerId || '',
      referer: referer || '',
      segmentsDir,
      seen: new Set(),            // 已见过的 seq（首轮基线 + 已落盘）
      recorded: new Map(),        // seq → { file, size, duration }
      totalBytes: 0,
      startedAt: Date.now(),      // G-44-4：运行中时长 = 本地挂钟差值（平滑显示），与分片落盘节奏解耦
      targetDuration: 6,
      stopped: false,             // stopRecord 置位后轮询循环退出且不再触发终态流转
      consecutiveFailures: 0,
      firstRound: true,
      hasDiscontinuity: false,    // 清单含 EXT-X-DISCONTINUITY（Pitfall 5：转封装拒转）
      mapUri: null,               // 45-02（D-05）：已处理的 EXT-X-MAP URI（变化即重下 init）
      mapByterange: null,         // EXT-X-MAP BYTERANGE 属性（非空 = 整资源形态以外，不支持）
      initFile: null,             // init 已落盘则 "init"（固定常量文件名，T-44-11 远端 URI 不进路径）
    };
    active.set(taskId, st);

    // 轮询循环异步启动，不阻塞 IPC 返回
    pollLoop(st).catch((err) => {
      console.warn(`[Realm] 录制轮询循环异常退出 (${taskId}):`, err.message);
      // 兜底：循环体外异常（理论上 pollLoop 内已捕获）确保任务不悬挂 running
      try {
        if (!st.stopped && active.has(taskId)) {
          writeMeta(st);
          taskManager.failTask(taskId, `internal: ${err.message}`);
          active.delete(taskId);
        }
      } catch { /* 任务可能已被 stopRecord 完成，忽略非法流转 */ }
    });

    return { ok: true, taskId };
  }

  /**
   * 下载单个分片并落盘（D-20 按 seq 去重；T-44-11 文件名仅纯数字）
   * @param {Object} st - 录制状态
   * @param {{ uri: string, seq: number, duration: number|null }} seg
   */
  async function downloadSegment(st, seg) {
    const absUrl = resolveUri(seg.uri, st.url);
    const buf = await fetchPage(absUrl, { referer: st.referer, containerId: st.containerId });
    // 落盘前内容嗅探：CDN 毒应答（清单文本/错误页）不写盘不记 seen——
    // seq 未入 seen 故下轮轮询自然重试同一 seq（清单窗口内可补回），
    // 失败计数与重试语义复用 D-18 既有路径（throw 由调用方计 consecutiveFailures）
    if (!isPlausibleSegment(buf, !!st.mapUri)) {
      throw new Error(`invalid segment content (seq ${seg.seq})`);
    }
    const name = `${String(seg.seq).padStart(SEQ_PAD, '0')}.ts`;
    fs.writeFileSync(path.join(st.segmentsDir, name), buf);
    st.seen.add(seg.seq);
    st.recorded.set(seg.seq, { file: name, size: buf.length, duration: seg.duration });
    st.totalBytes += buf.length;
    // 每次落盘后更新任务进度（live 流分母持续增长故偏低；VOD 转正后收敛为真实百分比）
    try {
      const total = st.seen.size;
      const done = st.recorded.size;
      taskManager.updateProgress(st.taskId, total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0);
    } catch (err) {
      // stopRecord 已把任务置终态后的竞态更新——安全忽略
      console.warn(`[Realm] 录制进度更新失败 (${st.taskId}):`, err.message);
    }
  }

  /**
   * 写分片索引 meta.json（title、segments 列表、总时长、总大小）。
   * stop 与 fail 路径都调用——失败后已落盘分片与索引保留（D-18），供 44-05 续转。
   * @param {Object} st - 录制状态
   * @returns {Object} 写入的 meta 对象
   */
  function writeMeta(st) {
    const segs = Array.from(st.recorded.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
    let totalDuration = 0;
    for (const s of segs) totalDuration += typeof s.duration === 'number' ? s.duration : (st.targetDuration || 0);
    const meta = {
      title: st.title,
      url: st.url,
      playbackKey: st.playbackKey,
      containerId: st.containerId,
      targetDuration: st.targetDuration,
      totalDuration,
      totalSize: st.totalBytes,
      segments: segs,
      // 44-05 转封装消费：含不连续片段的流转封装时间轴跳变（Pitfall 5），直接拒转
      hasDiscontinuity: !!st.hasDiscontinuity,
      // G-44-7：加密流（EXT-X-KEY METHOD≠NONE）无解密链路，转换入口早拒
      hasEncryption: !!st.hasEncryption,
      // 45-02（D-05）：fMP4 EXT-X-MAP 捕获——附加字段不升版本（44 先例），
      // 旧 meta 缺字段 = fMP4 能力缺省关闭；initFile 为已落盘 init 的固定文件名
      mapUri: st.mapUri || null,
      initFile: st.initFile || null,
      mapByterange: st.mapByterange || null,
      finishedAt: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(path.join(recordRoot, st.taskId, 'meta.json'), JSON.stringify(meta, null, 2));
    } catch (err) {
      console.warn(`[Realm] 录制索引写入失败 (${st.taskId}):`, err.message);
    }
    return meta;
  }

  /**
   * 轮询循环：拉清单 →（首轮记基线）/（后续追新分片）→ 依 targetDuration 间隔轮询
   * @param {Object} st - 录制状态
   */
  async function pollLoop(st) {
    while (!st.stopped) {
      try {
        const buf = await fetchPage(st.url, { referer: st.referer, containerId: st.containerId });
        const pl = parse(buf.toString('utf8'));
        if (pl.targetDuration > 0) st.targetDuration = pl.targetDuration;
        // D-17/Pitfall 5：任一版清单出现过 EXT-X-DISCONTINUITY 即记录（整行匹配，
        // 不误中 DISCONTINUITY-SEQUENCE）——转封装直接拒转
        if (/(^|\r?\n)#EXT-X-DISCONTINUITY(\r?\n|$)/.test(buf.toString('utf8'))) {
          st.hasDiscontinuity = true;
        }
        // G-44-7：任一版清单出现 EXT-X-KEY 加密即记录（优先 parse 结果，原始清单
        // 行级正则兜底——注入的自定义解析器可能不返回 hasEncryption）——转换入口早拒
        if (pl.hasEncryption || /(^|\r?\n)#EXT-X-KEY:.*METHOD=(?!"?NONE)/.test(buf.toString('utf8'))) {
          st.hasEncryption = true;
        }
        st.consecutiveFailures = 0;

        // 45-02（D-05，Pitfall 1 最高危）：fMP4 init 分片留存检查点——在首轮/追新
        // 分支之外每轮执行（init 不是媒体分片，D-21 首轮 baseline 语义只豁免分片
        // 回溯不豁免 init，首轮也必须下载）；首次见到或变化即下载（实测 B 站 MAP
        // 恒定只触发一次，变化重下分支按 RFC 语义保留——Pitfall 8）
        if (pl.mapUri && st.mapUri !== pl.mapUri) {
          if (pl.mapByterange) {
            // RESEARCH Route D：BYTERANGE 形态（init 为大资源字节区间）不支持——
            // 不下载 init，后续转换落 init_missing 兜底（不静默产坏产物）；仅登记一次
            console.warn(`[Realm] EXT-X-MAP BYTERANGE 形态暂不支持，init 不下载 (${st.taskId}): ${pl.mapUri}`);
            st.mapUri = pl.mapUri;
            st.mapByterange = pl.mapByterange;
          } else {
            try {
              const absUrl = resolveUri(pl.mapUri, st.url);
              const buf = await fetchPage(absUrl, { referer: st.referer, containerId: st.containerId });
              // 固定常量文件名 "init"（T-44-11：远端 URI 不进路径）；不进 st.seen/
              // st.recorded、不占 seq 命名（init 不是分片，不污染完整性判定）
              fs.writeFileSync(path.join(recordRoot, st.taskId, 'init'), buf);
              st.mapUri = pl.mapUri;
              st.mapByterange = null;
              st.initFile = 'init';
            } catch (err) {
              // 容忍当轮失败下轮重试（不记 consecutiveFailures——init 缺失只影响
              // 后续转换不影响录制本体）；st.mapUri 不登记故下轮自然重试
              console.warn(`[Realm] fMP4 init 分片下载失败 (${st.taskId}):`, err.message);
            }
          }
        }

        if (st.firstRound) {
          // D-21 从直播边缘开始：首轮清单只记基线不落盘（历史分片不回溯）
          for (const seg of pl.segments) st.seen.add(seg.seq);
          st.firstRound = false;
        } else {
          for (const seg of pl.segments) {
            if (st.stopped) return;
            if (st.seen.has(seg.seq)) continue;
            try {
              await downloadSegment(st, seg);
            } catch (err) {
              // 单个分片失败计连续失败次数（D-18），成功后计数归零
              st.consecutiveFailures++;
              if (st.consecutiveFailures >= maxRetries) {
                writeMeta(st);
                taskManager.failTask(st.taskId, 'network');
                active.delete(st.taskId);
                return;
              }
            }
          }
        }

        // VOD 意外转正：剩余未录分片已在上面的循环录完，任务完成（D-22 接力由 44-05 消费）
        if (pl.ended) {
          active.delete(st.taskId);
          writeMeta(st);
          taskManager.completeTask(st.taskId, { outputPath: path.join(recordRoot, st.taskId) });
          return;
        }
      } catch (err) {
        // 清单拉取失败：连续失败计数（D-18），超阈值停录标 failed，已落盘分片与索引保留
        st.consecutiveFailures++;
        if (st.consecutiveFailures >= maxRetries) {
          active.delete(st.taskId);
          writeMeta(st);
          taskManager.failTask(st.taskId, 'network');
          return;
        }
      }

      if (st.stopped) return;
      // T-44-13：轮询间隔 = targetDuration，下限钳制 ≥2s
      const interval = Math.max(MIN_POLL_INTERVAL_MS, st.targetDuration * 1000);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * 停止录制（D-19「停止并保存」/红点点击/任务页停止共用）：
   * 停轮询 → 写分片索引 meta.json → completeTask({ outputPath: recordRoot/<taskId> })
   * @param {string} taskId - 任务 ID
   * @returns {Promise<{ ok: boolean, reason?: string, task?: Object }>}
   */
  async function stopRecord(taskId) {
    const st = active.get(taskId);
    if (!st) return { ok: false, reason: 'not_found' };
    st.stopped = true;
    active.delete(taskId);
    writeMeta(st);
    let task = null;
    try {
      task = taskManager.completeTask(taskId, { outputPath: path.join(recordRoot, taskId) });
    } catch (err) {
      console.warn(`[Realm] 录制任务完成流转失败 (${taskId}):`, err.message);
      return { ok: false, reason: err.message };
    }
    return { ok: true, task };
  }

  /**
   * 查询录制状态（D-21 红点 hover 数据源：已录大小 + 运行中已录时长）
   * 运行中 durationSeconds 为本地挂钟差值（startedAt 起平滑推进，0 分片落盘也在走表，
   * G-44-4）；与 meta.json totalDuration（分片 EXTINF 累计）是两套口径，互不渗透。
   * @param {string} taskId - 任务 ID
   * @returns {Object|null} { taskId, title, url, status, segments, totalBytes, durationSeconds }
   */
  function getRecordStatus(taskId) {
    const st = active.get(taskId);
    if (st) {
      return {
        taskId: st.taskId,
        title: st.title,
        url: st.url,
        status: 'running',
        segments: st.recorded.size,
        totalBytes: st.totalBytes,
        durationSeconds: Math.max(0, Math.round((Date.now() - st.startedAt) / 1000)),
      };
    }
    // 已终态的任务回查注册表快照（窗口重开等场景）
    try {
      const task = taskManager.listTasks().find((t) => t.id === taskId);
      if (task) {
        return {
          taskId: task.id,
          title: task.title,
          url: null,
          status: task.status,
          segments: null,
          totalBytes: null,
          durationSeconds: null,
        };
      }
    } catch { /* 注册表异常时返回 null */ }
    return null;
  }

  /**
   * 运行中录制任务列表（D-19 关窗确认 / 播放器红点同步用）
   * 运行中 durationSeconds 与 getRecordStatus 同式：本地挂钟差值（G-44-4），
   * 与 meta.json totalDuration（EXTINF 累计）口径分离。
   * @returns {Array<{ taskId: string, title: string, url: string, playbackKey: string, containerId: string, segments: number, totalBytes: number, durationSeconds: number }>}
   */
  function getActiveRecordings() {
    return Array.from(active.values()).map((st) => ({
      taskId: st.taskId,
      title: st.title,
      url: st.url,
      playbackKey: st.playbackKey,
      containerId: st.containerId,
      segments: st.recorded.size,
      totalBytes: st.totalBytes,
      durationSeconds: Math.max(0, Math.round((Date.now() - st.startedAt) / 1000)),
    }));
  }

  /**
   * 停止全部运行中录制（D-19 关窗「停止并保存」路径）
   * @returns {Promise<number>} 成功停止的任务数
   */
  async function stopAll() {
    const ids = Array.from(active.keys());
    let stopped = 0;
    for (const id of ids) {
      const r = await stopRecord(id);
      if (r.ok) stopped++;
    }
    return stopped;
  }

  return { startRecord, stopRecord, getRecordStatus, getActiveRecordings, stopAll };
}

module.exports = { createRecordEngine, isPlausibleSegment };

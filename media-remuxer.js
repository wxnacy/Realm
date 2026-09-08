/**
 * media-remuxer — TS→fMP4 转封装封装（Phase 44，D-04/D-22/D-24）
 *
 * 基于 mux.js（videojs 官方，纯 JS——D-04 定稿，规避 ffmpeg-static 原生二进制
 * 打包风险）把 HLS 录制/缓存的一组 MPEG-TS 分片转封装为一个 fMP4 文件。
 * 只在主进程 require（不进 renderer，纯 JS 无原生模块，不触发 asarUnpack）。
 *
 * RESEARCH Pattern 3 硬约束（mux.js README 时序警告原文）：
 * - **单一 Transmuxer 实例跨全部分片**：Transmuxer 状态（PES 时间戳基线）跨
 *   push 累积，每分片新建实例会导致各段时间戳都从 0 起，拼出的 mp4 进度条
 *   错乱（Pitfall 5 时间轴断裂）。
 * - **先注册 'data' 监听再 push**（README："It is important to push after your
 *   event listener has been defined."），监听晚于 push 会丢事件。
 * - **流式写盘**：data 事件即写 createWriteStream（initSegment 首写，后续只写
 *   data——moof/mdat 顺序拼接即合法 fMP4），不全量载入内存（T-44-17 DoS）。
 * - `keepOriginalTimestamps: false`（库默认归零时间轴）。
 *
 * 命名与 sanitize（D-22/T-44-15）：产物命名「{标题} {YYYY-MM-DD HHmm}.mp4」，
 * 远端标题经 sanitizeFilename 白名单替换防路径注入——目录固定为用户所选，
 * 仅文件名来自标题。
 *
 * Phase 45（D-01/D-06/D-07）：fMP4 分片序列（init.mp4 + moof/mdat，B 站直播
 * HLS 形态）经 concatFmp4ToMp4 拼接转出 fMP4 产物——只做 moof→traf→tfdt
 * 定位与 tfdt 值域原位改写（G-45-2 时间轴按轨 rebase 归零，不解析
 * trun/sample 表，攻击面 = 边界校验 walker + 字节拷贝，零新依赖）；
 * convertToMp4 首片嗅探命中 fMP4 box 特征时按 initPath 有无分流到拼接分支
 * 或 init_missing 拒转。
 */

const fs = require('fs');
const crypto = require('crypto');
const muxjs = require('mux.js');

/** 文件名非法字符（含路径分隔符）与控制字符 → 替换为 _（T-44-15 白名单替换） */
const FILENAME_UNSAFE_RE = /[\\/:*?"<>|\x00-\x1f\x7f]/g;

/** sanitize 后标题长度上限（防超长文件名撑爆文件系统路径限制） */
const MAX_TITLE_LENGTH = 80;

/**
 * 远端标题 → 安全文件名：替换路径非法字符与控制字符为 _，裁剪长度。
 * 远端标题不进路径注入面（T-44-15）：目录由用户经 showSaveDialog 选取，
 * 只有 basename 来自标题。
 * @param {string} title - 远端媒体标题
 * @returns {string} 安全文件名（不含扩展名）
 */
function sanitizeFilename(title) {
  if (typeof title !== 'string') return '';
  const cleaned = title
    .replace(FILENAME_UNSAFE_RE, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, MAX_TITLE_LENGTH).trim();
}

/**
 * 构建产物文件名（D-22）：「{标题} {YYYY-MM-DD HHmm}.mp4」，
 * 示例「直播间标题 2026-09-06 1430.mp4」。同名冲突序号由集成层复用
 * download-manager getUniqueFilePath 处理（「 (2)」追加语义）。
 * @param {string} title - 远端媒体标题（内部 sanitize）
 * @param {Date} [now] - 时间源（缺省当前时间；测试注入）
 * @returns {string} 产物文件名（含 .mp4 扩展名）
 */
function buildOutputName(title, now) {
  const d = now instanceof Date ? now : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`;
  const safeTitle = sanitizeFilename(title) || '未命名';
  return `${safeTitle} ${stamp}.mp4`;
}

/**
 * 创建带 reason 的转封装错误（集成层据此生成任务失败文案）
 * @param {string} reason - 机器可读原因（discontinuity/no_segments/...）
 * @param {string} [detail] - 附加细节
 * @returns {Error}
 */
function remuxError(reason, detail) {
  const err = new Error(detail ? `${reason}: ${detail}` : reason);
  err.reason = reason;
  return err;
}

/** 嗅探读取上限：首分片头部 64KB 足以判别容器格式（fs.readSync 定长读取，无循环拼接无内存放大——T-44-G11-01） */
const SNIFF_READ_BYTES = 64 * 1024;

/** 熵判定采样字节数（AES-128 密文字节分布近均匀，4KB 采样足以稳定区分） */
const ENTROPY_SAMPLE_BYTES = 4096;

/** 高熵阈值：256 值域中不同字节值数 ≥ 240 视为近满覆盖（密文特征；明文媒体码流远低于此） */
const ENTROPY_DISTINCT_THRESHOLD = 240;

/**
 * 首分片容器格式嗅探（G-44-4b）：仅判别首分片容器格式；录制/缓存同一清单的
 * 分片格式齐一，嗅探首片即可代表全流。
 *
 * 判定序（宽松优先避免误杀）：
 * ① 首字节 0x47 → MPEG-TS，放行（不做 188 步进强校验——首包对齐存在变体）；
 * ② 缓冲区内可检索到 fMP4 box 特征 ASCII（ftyp/styp/moof/moov/sidx 任一）
 *    → fmp4_container（HLS+fMP4 分片，mux.js Transmuxer 不支持；内部信号——
 *    convertToMp4 据此分流拼接分支或 init_missing，不对用户可见）；
 * ③ 前 4KB 采样不同字节值 ≥ 240 → encrypted_stream（AES-128 密文高熵特征）；
 * ④ 其余 → unsupported_container（未知格式，仅支持 MPEG-TS）。
 * @param {string} filePath - 首分片文件绝对路径
 * @returns {Error|null} null = MPEG-TS 放行；否则返回带 reason 的 remuxError
 */
function sniffContainerFormat(filePath) {
  let fd;
  let buf;
  try {
    fd = fs.openSync(filePath, 'r');
    buf = Buffer.alloc(SNIFF_READ_BYTES);
    const bytesRead = fs.readSync(fd, buf, 0, SNIFF_READ_BYTES, 0);
    buf = buf.subarray(0, bytesRead);
  } catch (err) {
    return remuxError('unsupported_container', `分片读取失败: ${err.message}`);
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* 关闭失败忽略 */ }
    }
  }
  return sniffContainerBuffer(buf);
}

/**
 * 缓冲级容器格式嗅探（判定序同 sniffContainerFormat）：
 * ① 首字节 0x47 放行；② fMP4 box 特征 → fmp4_container（内部信号，供分流）；
 * ③ 高熵 → encrypted_stream；④ 其余 → unsupported_container。
 * 解密链路对「解密后的首分片缓冲」调用本函数（密文先解密再判别，不错杀）。
 * @param {Buffer} buf - 分片头部缓冲（截到 64KB 足够）
 * @returns {Error|null} null = MPEG-TS 放行
 */
function sniffContainerBuffer(buf) {
  // ① MPEG-TS 同步字节：放行（宽松判定，保持既有 TS 路径零回归）
  if (buf.length > 0 && buf[0] === 0x47) return null;
  // ② fMP4 box 特征 ASCII：HLS+fMP4（CMF）分片以 box 开头、无同步字节。
  // D-06：不再直接拒转——返回内部信号 fmp4_container 供 convertToMp4 分流
  // （有 initPath 走 concatFmp4ToMp4 拼接，无则 init_missing 拒转）
  for (const tag of ['ftyp', 'styp', 'moof', 'moov', 'sidx']) {
    if (buf.indexOf(Buffer.from(tag, 'ascii')) !== -1) {
      return remuxError('fmp4_container', 'fMP4 分片（供拼接分流）');
    }
  }
  // ③ 熵判定：不同字节值近满覆盖 = 高熵密文（如 AES-128），转封装无解密链路
  const sample = buf.subarray(0, Math.min(buf.length, ENTROPY_SAMPLE_BYTES));
  const seen = new Uint8Array(256);
  let distinct = 0;
  for (const b of sample) {
    if (!seen[b]) {
      seen[b] = 1;
      distinct++;
    }
  }
  if (distinct >= ENTROPY_DISTINCT_THRESHOLD) {
    return remuxError('encrypted_stream', '分片疑似加密数据（如 AES-128），暂不支持转封装');
  }
  // ④ 未知格式：非 TS 同步字节且无 box 特征、非高熵，一律拒转
  return remuxError('unsupported_container', '未知分片格式，仅支持 MPEG-TS');
}

/** AES-128 密钥长度（字节）：EXT-X-KEY 的 16 字节密钥 */
const AES128_KEY_BYTES = 16;

/**
 * 规范化解密材料（convertToMp4 decryption 入参校验）
 * @param {Object} decryption - { keyHex, ivHex?, mediaSequence? }
 * @returns {{ key: Buffer, iv: Buffer|null, mediaSequence: number }} iv=null 表示按分片 seq 推导
 * @throws {Error} remuxError('decrypt_failed') 密钥/IV 形态非法
 */
function normalizeDecryption(decryption) {
  if (!decryption || typeof decryption !== 'object') {
    throw remuxError('decrypt_failed', '解密材料缺失');
  }
  const key = Buffer.from(String(decryption.keyHex || ''), 'hex');
  if (key.length !== AES128_KEY_BYTES) {
    throw remuxError('decrypt_failed', 'AES-128 密钥长度非法（须 16 字节）');
  }
  let iv = null;
  if (typeof decryption.ivHex === 'string' && decryption.ivHex) {
    iv = Buffer.from(decryption.ivHex, 'hex');
    if (iv.length !== 16) {
      throw remuxError('decrypt_failed', 'IV 长度非法（须 16 字节）');
    }
  }
  const mediaSequence = Number.isInteger(decryption.mediaSequence) && decryption.mediaSequence >= 0
    ? decryption.mediaSequence
    : 0;
  return { key, iv, mediaSequence };
}

/**
 * 分片 IV：清单带 IV 属性用固定 IV；否则按 HLS 规范（RFC 8216 §5.2）
 * 用分片 media sequence 的 16 字节大端序。
 * @param {Buffer|null} fixedIv - 清单 IV 属性（null = 按 seq 推导）
 * @param {number} seq - 分片 media sequence
 * @returns {Buffer} 16 字节 IV
 */
function segmentIv(fixedIv, seq) {
  if (fixedIv) return fixedIv;
  const iv = Buffer.alloc(16, 0);
  iv.writeBigUInt64BE(BigInt(seq), 8);
  return iv;
}

/**
 * AES-128-CBC 解密单个分片。PKCS7 去填充优先（规范形态）；填充校验失败
 * 回落不去填充（部分编码器不补齐），明文是否正确交给后续嗅探/transmux 裁决。
 * @param {Buffer} buf - 密文分片
 * @param {Buffer} key - 16 字节密钥
 * @param {Buffer} iv - 16 字节 IV
 * @returns {Buffer} 解密后分片
 */
function decryptSegment(buf, key, iv) {
  try {
    const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
    return Buffer.concat([d.update(buf), d.final()]);
  } catch {
    const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
    d.setAutoPadding(false);
    return Buffer.concat([d.update(buf), d.final()]);
  }
}

/**
 * TS 分片序列 → fMP4 转封装（D-22/D-24 convert 任务执行体）
 *
 * 时序契约（RESEARCH Pattern 3）：
 * 1. 校验入参与分片文件存在（fail fast）
 * 2. 注册 'data'/'error' 监听（**先于首次 push**）
 * 3. 单实例顺序 push + flush 每分片（时间轴连续）
 * 4. stream.end() 收尾等待 flush 完成 resolve
 *
 * 含 EXT-X-DISCONTINUITY 的录制索引直接拒转（Pitfall 5：时间轴跳变产物
 * 不可用；D-17 允许隐藏转换按钮 + 任务页失败文案兜底），不尝试。
 *
 * G-44-4b 首片格式嗅探：首个分片 push 前经 sniffContainerFormat 判别容器
 * 格式（首字节 0x47 放行；fMP4 box 特征 / 高熵密文 / 未知格式均拒转），
 * 不可转容器在进入 mux.js 前显式失败，不再静默产出无效产物。
 *
 * G-44-7 产物创建时序：产物文件经 fs.openSync(outputPath, 'w') 同步创建 fd 再
 * 传入 createWriteStream——自 Promise 执行体起产物已确定性存在（或 openSync 失败
 * 从未创建），fail() 的 unlinkSync 必然命中，清理行为不依赖异步 open 的事件循环
 * 时序（旧实现的排队 open 竞态会让失败路径泄漏 0 字节残留）。
 * @param {Object} input - 转封装参数
 * @param {string[]} input.segmentPaths - TS 分片绝对路径列表（**按播放顺序**）
 * @param {string} input.outputPath - 产物 mp4 绝对路径
 * @param {boolean} [input.hasDiscontinuity] - 索引含 EXT-X-DISCONTINUITY 时拒转
 * @param {Function} [input.onProgress] - (processed, total) 进度回调（异常不阻断）
 * @param {Function} [input.shouldCancel] - 每分片迭代开始前调用的取消检查，返回 true
 *   即中止（reason='cancelled'，半成品清理同失败路径）
 * @param {Object} [input.decryption] - AES-128 解密材料（加密 HLS 缓存条目转换）：
 *   { keyHex: string, ivHex?: string|null, mediaSequence?: number }。
 *   提供时每分片 readFileSync 后先 AES-128-CBC 解密再 push（IV 缺省按分片 seq 推导，
 *   RFC 8216 §5.2）；首分片嗅探改为裁决解密后缓冲（密文不再被 encrypted_stream 错杀）。
 *   缺省时行为与 G-44-4b/G-44-7 完全一致（密文分片 encrypted_stream 拒转）。
 * @param {string|null} [input.initPath] - fMP4 init 分片绝对路径（D-06，缺省 null）：
 *   首片嗅探命中 fMP4 box 特征时——initPath 非空则清理半成品后委托
 *   concatFmp4ToMp4 纯字节拼接分支接续终态；为空则 init_missing 拒转。
 *   TS 分片（0x47 放行）与加密链路不受此入参影响。
 * @returns {Promise<{ outputPath: string, segments: number }>} 完成时 resolve
 *   失败时 reject Error（err.reason 机器可读：discontinuity/no_segments/
 *   invalid_output/segment_missing/transmux_failed/write_failed/cancelled/
 *   unsupported_container/encrypted_stream/empty_output/decrypt_failed/
 *   init_missing/invalid_init）
 */
function convertToMp4({ segmentPaths, outputPath, onProgress, hasDiscontinuity, shouldCancel, decryption, initPath }) {
  return new Promise((resolve, reject) => {
    if (hasDiscontinuity) {
      reject(remuxError('discontinuity', '直播流含不连续片段（EXT-X-DISCONTINUITY），暂不支持转换'));
      return;
    }
    if (!Array.isArray(segmentPaths) || segmentPaths.length === 0) {
      reject(remuxError('no_segments', '无可转换的分片'));
      return;
    }
    if (!outputPath || typeof outputPath !== 'string') {
      reject(remuxError('invalid_output', '产物路径缺失'));
      return;
    }
    for (const p of segmentPaths) {
      if (!fs.existsSync(p)) {
        reject(remuxError('segment_missing', `分片文件缺失: ${p}`));
        return;
      }
    }

    let settled = false;
    // G-44-7 泄漏层修复：产物文件同步创建（fs.openSync 'w'）——自 Promise 执行体起
    // 文件已确定性存在，fail() 的 unlinkSync 不再可能命中「异步 open 尚未执行」的
    // 竞态窗口（旧实现 createWriteStream 的 open(O_CREAT) 经 nextTick 排队，嗅探拒绝
    // 同 tick 内 unlinkSync ENOENT 被吞掉，随后排队的 open() 泄漏 0 字节文件）。
    // stream.destroy()（autoClose 默认 true）负责关闭传入 fd，成功路径 stream.end()
    // 同样收尾 fd，两路径均无需手动 closeSync。
    let outFd;
    try {
      outFd = fs.openSync(outputPath, 'w');
    } catch (err) {
      // 目录不存在/无写权限：文件从未创建，直接拒绝（无需清理）
      reject(remuxError('write_failed', err.message));
      return;
    }
    const stream = fs.createWriteStream(outputPath, { fd: outFd });
    // 单实例跨全部分片（Pitfall 5：每分片新建实例时间轴断裂）
    const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
    let wroteInit = false;
    let processed = 0;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { stream.destroy(); } catch { /* 已销毁 */ }
      // 失败清理半成品产物（任务页「已落盘部分续转」重试不留损坏文件）
      try { fs.unlinkSync(outputPath); } catch { /* 文件可能未创建 */ }
      reject(err);
    };

    // AES-128 解密材料规范化（可选）：形态非法立即 fail（产物同步 fd 已建，
    // fail 的 unlinkSync 必然命中，无泄漏）
    let dec = null;
    if (decryption) {
      try {
        dec = normalizeDecryption(decryption);
      } catch (err) {
        fail(err);
        return;
      }
    }

    stream.on('error', (err) => {
      fail(remuxError('write_failed', err.message));
    });

    // ⚠️ mux.js README 硬约束：必须先注册 'data' 监听，再 push——
    // 监听晚于 push 会丢事件（首个 initSegment 丢失则产物不可播）
    transmuxer.on('data', (segment) => {
      if (settled) return;
      try {
        if (!wroteInit) {
          stream.write(Buffer.from(segment.initSegment));
          wroteInit = true;
        }
        // moof/mdat 顺序拼接即合法 fMP4（流式写盘，T-44-17 不全量入内存）
        stream.write(Buffer.from(segment.data));
      } catch (err) {
        fail(remuxError('write_failed', err.message));
      }
    });
    // mux.js 内部 Stream 事件兜底（无监听时 trigger error 会直接 throw）
    transmuxer.on('error', (err) => {
      fail(remuxError('transmux_failed', err && err.message ? err.message : String(err)));
    });

    // 顺序 push 循环：每分片 readFileSync + push + flush（同步 IO 逐分片，
    // 单分片大小受录制/缓存分片固有上限约束）
    try {
      for (let i = 0; i < segmentPaths.length; i++) {
        const tsFile = segmentPaths[i];
        if (settled) return;
        // CR-04 协作式取消检查点：每分片迭代开始前检查（粒度 = 单分片处理时间——
        // 主进程事件循环内同步循环无法被异步打断，此为最小可打断单元，可接受）。
        // 成立即 fail('cancelled')：fail 复用既有清理（destroy stream + unlink 半成品）
        if (typeof shouldCancel === 'function' && shouldCancel()) {
          fail(remuxError('cancelled', '用户取消转换'));
          return;
        }
        // G-44-4b 首片格式嗅探检查点：置于取消检查之后、push 之前——不可转
        // 容器（fMP4/密文）在进入 mux.js 前显式 reject，错误对象直接携带
        // reason/detail，fail 复用既有清理。
        // AES-128 解密链路：提供 decryption 时先解密再判别——密文（高熵）不再
        // 被 encrypted_stream 错杀；解密失败（密钥形态/数据非法）按 decrypt_failed
        // 显式 reject。解密后仍非 TS（密钥错误解出垃圾等）由嗅探原路径拒转。
        let payload;
        if (dec) {
          try {
            payload = decryptSegment(fs.readFileSync(tsFile), dec.key, segmentIv(dec.iv, dec.mediaSequence + i));
          } catch (err) {
            fail(remuxError('decrypt_failed', `分片 ${i} 解密失败: ${err.message}`));
            return;
          }
        }
        if (i === 0) {
          const sniffErr = dec ? sniffContainerBuffer(payload) : sniffContainerFormat(tsFile);
          if (sniffErr) {
            // D-06 分流：fMP4 box 命中不再是终态拒转。加密链路（dec）下 fMP4
            // 维持旧拒转语义（D-04，拼接读的是密文原文件无意义）；
            // 非加密 fMP4：有 initPath → 清理本执行体半成品（此时尚未 push 任何
            // 分片）后委托 concatFmp4ToMp4 接续终态；无 initPath → init_missing
            if (sniffErr.reason === 'fmp4_container') {
              if (dec) {
                fail(remuxError('unsupported_container', 'fMP4 分片暂不支持转封装（仅支持 MPEG-TS）'));
                return;
              }
              if (!initPath) {
                fail(remuxError('init_missing', 'fMP4 视频缺少初始化段'));
                return;
              }
              settled = true;
              try { stream.destroy(); } catch { /* 已销毁 */ }
              try { fs.unlinkSync(outputPath); } catch { /* 文件可能未创建 */ }
              concatFmp4ToMp4({ initPath, segmentPaths, outputPath, onProgress, shouldCancel }).then(resolve, reject);
              return;
            }
            fail(sniffErr);
            return;
          }
        }
        transmuxer.push(dec ? new Uint8Array(payload) : new Uint8Array(fs.readFileSync(tsFile)));
        transmuxer.flush();
        processed++;
        if (typeof onProgress === 'function') {
          try {
            onProgress(processed, segmentPaths.length);
          } catch { /* 进度回调异常不阻断转封装 */ }
        }
      }
    } catch (err) {
      fail(remuxError('transmux_failed', err.message));
      return;
    }

    stream.end(() => {
      if (settled) return;
      // G-44-4b 产物终检：写盘收尾后 statSync 校验产物字节数，无有效媒体数据
      // 的空产物按 empty_output 失败处理并清理（try/catch 异常按空产物处理）
      let outSize = 0;
      try {
        outSize = fs.statSync(outputPath).size;
      } catch { /* 产物不存在按空产物处理 */ }
      if (outSize === 0) {
        settled = true;
        try { fs.unlinkSync(outputPath); } catch { /* 清理失败忽略 */ }
        reject(remuxError('empty_output', '转封装产物为空（无有效媒体数据）'));
        return;
      }
      settled = true;
      resolve({ outputPath, segments: processed });
    });
  });
}

/** 产物终检读取上限：probe 只需校验头部结构（moov 在 init 内、首个 moof 紧随
 * init 之后），4MB 头部足够——全量读入会违背 T-45-02/T-44-17 流式约束 */
const FINAL_PROBE_READ_BYTES = 4 * 1024 * 1024;

/**
 * fMP4 分片 tfdt 时间轴 rebase（G-45-2，D-01 零新依赖）
 *
 * B 站直播 fMP4 分片的 moof/traf/tfdt baseMediaDecodeTime 为 epoch 级大数
 * （直播流绝对时刻），纯字节拼接会把该基线原样保留进产物，播放器以首个
 * tfdt 为时间轴零点 → 十几秒录制显示 143 小时量级时长。本函数用轻量 box
 * walker 遍历 moof→traf→(tfhd/tfdt)，按轨减去该轨首次见到的 tfdt 基线，
 * 产物时间轴从 0 开始、总时长 = 录制时长（RESEARCH Route B 正解；不修
 * moov/mvhd、不注入 elst——Pitfall 3 / 诊断结论）。
 *
 * 边界与畸形容忍（T-45-04/T-45-05，远端字节不可信）：
 * - 每 box 读取前边界校验（size >= 头宽且 offset+size <= 区间末尾），违反
 *   即停止该层遍历不 throw；size==1 读 64 位 largesize，size==0 视为到区间末尾
 * - 循环界只受 buffer 实际长度约束，不依赖声明 size 累加推进（无超界读取/
 *   死循环路径；分片已被 MAX_SEGMENT_BYTES 64MB 上限约束，T-45-02 沿用）
 * - 未知 box 类型（sidx/emsg 等）与 traf 内非 tfhd/tfdt 子 box 原样跳过
 * - 只写 tfdt 值域原位字节（等长改写：新值 = 原值 − 基线 <= 原值，同宽必容下），
 *   box size/version/flags 与其余 box（mdat/trun/mfhd/tfhd 可选字段）零改动
 * - v1（64 位）读写用 BigInt 防精度溢出（T-45-06）；v0（32 位）用 Number
 * - 当前值 < 基线的异常形态（分片乱序/时钟回拨）保守不改写，原样保留
 *
 * @param {Buffer} buf - fMP4 分片缓冲（原地修改）
 * @param {Map<number, bigint|number>} baselines - 调用方持有的轨基线表
 *   （track_ID → 该轨首次见到的 baseMediaDecodeTime；v1 存 BigInt，v0 存
 *   Number）。跨分片复用同一 Map 实现全产物按轨归零。
 * @returns {number} 改写的 tfdt 计数（含改写为同值 0 的首片；供测试断言与诊断）
 */
function rebaseFmp4SegmentTfdt(buf, baselines) {
  if (!Buffer.isBuffer(buf) || !(baselines instanceof Map)) return 0;
  let rewritten = 0;

  // 单层 box 遍历：区间 [start, end) 内逐个 box 回调。边界校验失败即 return
  // （停止本层遍历），不抛出——远端字节不可信（T-45-04）
  const walkRange = (start, end, onBox) => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      let headerSize = 8;
      if (size === 1) {
        // 64 位 largesize
        if (offset + 16 > end) return;
        const large = buf.readBigUInt64BE(offset + 8);
        if (large > BigInt(end - offset)) return; // 声明超出剩余区间 → 停止
        size = Number(large);
        headerSize = 16;
      } else if (size === 0) {
        size = end - offset; // size==0 表示延伸到区间末尾
      }
      if (size < headerSize || offset + size > end) return;
      onBox(offset, offset + size, type, headerSize);
      offset += size;
    }
  };

  // traf 内：先定位 tfhd 的 track_ID 与全部 tfdt，再按轨 rebase
  const processTraf = (start, end) => {
    let trackId = -1;
    const tfdts = [];
    walkRange(start, end, (boxStart, boxEnd, type, headerSize) => {
      if (type === 'tfhd') {
        // version(1B)+flags(3B) 之后固定 4 字节 track_ID（flags 只影响其后的
        // 可选字段，本 walker 不读它们）
        if (boxStart + headerSize + 8 <= boxEnd) {
          trackId = buf.readUInt32BE(boxStart + headerSize + 4);
        }
      } else if (type === 'tfdt') {
        tfdts.push({ start: boxStart, end: boxEnd, headerSize });
      }
    });
    if (trackId < 0) return;
    for (const t of tfdts) {
      const versionOffset = t.start + t.headerSize;
      if (versionOffset + 4 > t.end) continue; // version+flags 不完整 → 跳过
      const version = buf[versionOffset];
      const valueOffset = versionOffset + 4;
      if (version === 1) {
        if (valueOffset + 8 > t.end) continue;
        const value = buf.readBigUInt64BE(valueOffset);
        if (!baselines.has(trackId)) {
          baselines.set(trackId, value);
          buf.writeBigUInt64BE(0n, valueOffset);
        } else {
          const baseline = baselines.get(trackId);
          const base = typeof baseline === 'bigint' ? baseline : BigInt(baseline);
          if (value < base) continue; // 乱序/回拨保守不改写
          buf.writeBigUInt64BE(value - base, valueOffset);
        }
        rewritten++;
      } else if (version === 0) {
        if (valueOffset + 4 > t.end) continue;
        const value = buf.readUInt32BE(valueOffset);
        if (!baselines.has(trackId)) {
          baselines.set(trackId, value);
          buf.writeUInt32BE(0, valueOffset);
        } else {
          const baseline = baselines.get(trackId);
          const base = typeof baseline === 'bigint' ? baseline : BigInt(baseline);
          const current = BigInt(value);
          if (current < base) continue;
          // 新值 = 当前值 − 基线 <= 当前值，32 位必容下（等长改写）
          buf.writeUInt32BE(Number(current - base), valueOffset);
        }
        rewritten++;
      }
      // 其他 version 未知 → 跳过不改写
    }
  };

  // 顶层遍历：moof → traf → (tfhd/tfdt)；其余 box 原样跳过
  walkRange(0, buf.length, (moofStart, moofEnd, type, headerSize) => {
    if (type !== 'moof') return;
    walkRange(moofStart + headerSize, moofEnd, (trafStart, trafEnd, innerType, innerHeader) => {
      if (innerType !== 'traf') return;
      processTraf(trafStart + innerHeader, trafEnd);
    });
  });

  return rewritten;
}

/**
 * fMP4 分片序列拼接执行体（D-01/D-06/D-07，Phase 45；G-45-2 时间轴 rebase）
 *
 * init.mp4 + moof/mdat 分片按播放序拼接为 fMP4 产物。分片写盘前经
 * rebaseFmp4SegmentTfdt 轻量 walker 处理（G-45-2）：只做 moof→traf→tfdt
 * 定位与 tfdt 值域原位改写——按轨减去首片 epoch 级基线，产物时间轴从 0
 * 开始、总时长 = 录制时长（B 站直播分片 tfdt 为直播流绝对时刻，不改写则
 * 十几秒录制显示 143 小时量级）；不解析 trun/sample 表、不做重打包，其余
 * box 原样字节通过（攻击面 = 边界校验 walker + 字节拷贝）；单文件多
 * moof+mdat 对（B 站直播实测形态）原样通过不拆箱。产物形态为 fMP4 容器
 * （init 的 mvhd duration=0 是 RFC 8216 强制形态，不修 moov、init 段逐位
 * 原样——D-02「能看就行」：mpv/IINA/VLC/QuickTime 可播，不承诺剪辑软件兼容）。
 *
 * 执行体契约逐项复刻 convertToMp4（G-44-7/PATTERNS 六件套）：
 * ① 入参 fail-fast（no_segments/invalid_output/segment_missing/init_missing）；
 * ② fs.openSync(outputPath, 'w') 同步 fd 产物创建（G-44-7 竞态修复同款，
 *    禁退回 createWriteStream 隐式 open）；
 * ③ fail() = destroy + unlink 统一清理；
 * ④ 每分片迭代开头 shouldCancel 协作式取消；
 * ⑤ onProgress try/catch 不阻断；
 * ⑥ stream.end 回调内终检（empty_output）。
 * @param {Object} input - 拼接参数
 * @param {string} input.initPath - fMP4 init 分片绝对路径（缺失/不可读 → init_missing）
 * @param {string[]} input.segmentPaths - fMP4 分片绝对路径列表（**按播放顺序**）
 * @param {string} input.outputPath - 产物 mp4 绝对路径
 * @param {Function} [input.onProgress] - (processed, total) 进度回调（异常不阻断）
 * @param {Function} [input.shouldCancel] - 每分片迭代开始前调用的取消检查
 * @returns {Promise<{ outputPath: string, segments: number }>} 完成时 resolve
 *   失败时 reject Error（err.reason：no_segments/invalid_output/segment_missing/
 *   init_missing/invalid_init/write_failed/cancelled/empty_output）
 */
function concatFmp4ToMp4({ initPath, segmentPaths, outputPath, onProgress, shouldCancel }) {
  return new Promise((resolve, reject) => {
    // ① 入参 fail-fast
    if (!Array.isArray(segmentPaths) || segmentPaths.length === 0) {
      reject(remuxError('no_segments', '无可转换的分片'));
      return;
    }
    if (!outputPath || typeof outputPath !== 'string') {
      reject(remuxError('invalid_output', '产物路径缺失'));
      return;
    }
    for (const p of segmentPaths) {
      if (!fs.existsSync(p)) {
        reject(remuxError('segment_missing', `分片文件缺失: ${p}`));
        return;
      }
    }
    // init 读取 fail-fast：缺失/不可读 → init_missing（D-06 引导语义）
    let initBuf = null;
    if (typeof initPath === 'string' && initPath) {
      try {
        initBuf = fs.readFileSync(initPath);
      } catch { /* init 不可读按缺失处理 */ }
    }
    if (!initBuf) {
      reject(remuxError('init_missing', 'fMP4 视频缺少初始化段'));
      return;
    }

    let settled = false;
    // ② 产物同步 fd 创建（G-44-7 同款）：fail() 的 unlinkSync 必然命中
    let outFd;
    try {
      outFd = fs.openSync(outputPath, 'w');
    } catch (err) {
      // 目录不存在/无写权限：文件从未创建，直接拒绝（无需清理）
      reject(remuxError('write_failed', err.message));
      return;
    }
    const stream = fs.createWriteStream(outputPath, { fd: outFd });

    // ③ fail() 统一清理半成品
    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { stream.destroy(); } catch { /* 已销毁 */ }
      try { fs.unlinkSync(outputPath); } catch { /* 文件可能未创建 */ }
      reject(err);
    };

    stream.on('error', (err) => {
      fail(remuxError('write_failed', err.message));
    });

    try {
      // init 头校验 fail-fast：前 8 字节须为 box size + 'ftyp'（RFC 8216 §3.3
      // init MUST 含 ftyp）——畸形 init 不产静默坏产物（T-45-01）
      if (initBuf.length < 8 || initBuf.toString('ascii', 4, 8) !== 'ftyp') {
        fail(remuxError('invalid_init', '初始化段不是合法的 fMP4 init（缺少 ftyp box）'));
        return;
      }
      stream.write(initBuf);
      // G-45-2 时间轴 rebase：基线表跨全部分片复用——首片处理时按轨采集
      // epoch 级 tfdt 基线（首片写出前完成采集），后续分片递减排差归零
      const baselines = new Map();
      let processed = 0;
      for (const segPath of segmentPaths) {
        if (settled) return;
        // ④ 协作式取消：每分片迭代开始前（同 convertToMp4 CR-04 检查点）
        if (typeof shouldCancel === 'function' && shouldCancel()) {
          fail(remuxError('cancelled', '用户取消转换'));
          return;
        }
        // 分片读入后经 tfdt rebase walker 再写出（G-45-2）：只做 moof→traf→tfdt
        // 定位与 tfdt 值域原位改写（产物时间轴按轨归零、总时长 = 录制时长），
        // 不解析 trun/sample 表，其余 box 原样字节通过，单文件多 moof+mdat 对
        // 不拆箱。单分片大小受来源侧 MAX_SEGMENT_BYTES 64MB 上限约束（T-45-02），
        // walker 只在已入内存的分片 buffer 上工作，无新增内存面
        const segBuf = fs.readFileSync(segPath);
        rebaseFmp4SegmentTfdt(segBuf, baselines);
        stream.write(segBuf);
        processed++;
        // ⑤ 进度回调异常不阻断
        if (typeof onProgress === 'function') {
          try {
            onProgress(processed, segmentPaths.length);
          } catch { /* 进度回调异常不阻断拼接 */ }
        }
      }
      stream.end(() => {
        if (settled) return;
        // ⑥ 终检加强档（RESEARCH Q5）：基线 = 产物非空且头部 ftyp；加强 =
        // mux.js probe 校验 moov 存在 + moof 计数 ≥1（不断言具体 track 数——
        // Pitfall 9 音频-only 流合法）；probe 调用异常时降级为基线校验。
        // 只读头部 4MB：moov 在 init 内、首个 moof 紧随 init，足够判别
        let head = null;
        let outSize = 0;
        let fd;
        try {
          outSize = fs.statSync(outputPath).size;
          fd = fs.openSync(outputPath, 'r');
          const len = Math.min(outSize, FINAL_PROBE_READ_BYTES);
          head = Buffer.alloc(len);
          fs.readSync(fd, head, 0, len, 0);
        } catch { /* 产物不存在按空产物处理 */ } finally {
          if (fd !== undefined) {
            try { fs.closeSync(fd); } catch { /* 关闭失败忽略 */ }
          }
        }
        const passBaseline = head !== null && outSize > 0 && head.length >= 8
          && head.toString('ascii', 4, 8) === 'ftyp';
        let pass = passBaseline;
        if (passBaseline) {
          try {
            pass = muxjs.mp4.probe.findBox(head, ['moov']).length >= 1
              && muxjs.mp4.probe.findBox(head, ['moof']).length >= 1;
          } catch {
            pass = passBaseline; // probe 异常 → 降级 ftyp 头 + 大小基线校验
          }
        }
        if (!pass) {
          settled = true;
          try { fs.unlinkSync(outputPath); } catch { /* 清理失败忽略 */ }
          reject(remuxError('empty_output', '转封装产物为空（无有效媒体数据）'));
          return;
        }
        settled = true;
        resolve({ outputPath, segments: processed });
      });
    } catch (err) {
      fail(remuxError('write_failed', err.message));
    }
  });
}

module.exports = { convertToMp4, concatFmp4ToMp4, sanitizeFilename, buildOutputName, rebaseFmp4SegmentTfdt };

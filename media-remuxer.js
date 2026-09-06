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
 */

const fs = require('fs');
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
 * @param {Object} input - 转封装参数
 * @param {string[]} input.segmentPaths - TS 分片绝对路径列表（**按播放顺序**）
 * @param {string} input.outputPath - 产物 mp4 绝对路径
 * @param {boolean} [input.hasDiscontinuity] - 索引含 EXT-X-DISCONTINUITY 时拒转
 * @param {Function} [input.onProgress] - (processed, total) 进度回调（异常不阻断）
 * @param {Function} [input.shouldCancel] - 每分片迭代开始前调用的取消检查，返回 true
 *   即中止（reason='cancelled'，半成品清理同失败路径）
 * @returns {Promise<{ outputPath: string, segments: number }>} 完成时 resolve
 *   失败时 reject Error（err.reason 机器可读：discontinuity/no_segments/
 *   invalid_output/segment_missing/transmux_failed/write_failed/cancelled）
 */
function convertToMp4({ segmentPaths, outputPath, onProgress, hasDiscontinuity, shouldCancel }) {
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
    const stream = fs.createWriteStream(outputPath);
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
      for (const tsFile of segmentPaths) {
        if (settled) return;
        // CR-04 协作式取消检查点：每分片迭代开始前检查（粒度 = 单分片处理时间——
        // 主进程事件循环内同步循环无法被异步打断，此为最小可打断单元，可接受）。
        // 成立即 fail('cancelled')：fail 复用既有清理（destroy stream + unlink 半成品）
        if (typeof shouldCancel === 'function' && shouldCancel()) {
          fail(remuxError('cancelled', '用户取消转换'));
          return;
        }
        transmuxer.push(new Uint8Array(fs.readFileSync(tsFile)));
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
      settled = true;
      resolve({ outputPath, segments: processed });
    });
  });
}

module.exports = { convertToMp4, sanitizeFilename, buildOutputName };

/**
 * Realm Browser - AI 聊天附件管理模块
 *
 * 承接用户在 AI 聊天框拖拽/粘贴的文件与图片（对标 openhanako 附件语义）：
 * - 路径型附件：主进程校验后**复制快照**到 agent-workspace/attachments/
 *   （快照在沙箱根内，agent 经 read 工具零改动可读）
 * - blob 型附件（截图等无路径内存数据）：base64 落盘到同一目录
 * - sourceKey 去重：同一源文件（realpath+size+mtime）重复附加只登记一次
 * - 登记表为内存 Map（应用生命周期）：renderer 侧仅持 attachmentId，
 *   发送时由 ai-manager 反查快照路径，杜绝 renderer 伪造路径
 *
 * 授权语义：用户拖入/粘贴 = 显式授权读取（rule:import / cookie:import 先例），
 * 不走 requestActionConfirmation 确认卡片。isDeniedSourcePath 是启发式屏蔽
 * （防手滑拖整目录连坐敏感文件），不是安全边界——与 ai-bash-policy 同哲学。
 *
 * electron 依赖经 agent-workspace 惰性获取：纯 Node 测试环境可直接加载，
 * 工作区根目录用 setWorkspaceDir 注入临时目录。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const {
  getAttachmentsDir,
  getWorkspaceDir,
  resolveInside,
} = require('./agent-workspace');

/** 图片扩展名兜底白名单（macOS 拖拽偶发 File.type 为空） */
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif',
]);

/** 未知 mime 时的回落值 */
const FALLBACK_MIME = 'application/octet-stream';

/** 图片预览上限（字节）：超过则 readPreviewDataUrl 返回 null，前端回退通用图标 */
const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

/** 聊天气泡内联渲染上限（字节）：readImageDataUrl 超过返回 null（前端回退徽标） */
const INLINE_IMAGE_MAX_BYTES = 25 * 1024 * 1024;

/** 大文件软提示阈值（字节）：仅提示不拒绝 */
const SOFT_SIZE_WARN_BYTES = 100 * 1024 * 1024;

/**
 * 敏感源路径屏蔽清单（相对 home 的目录前缀 + 任意层文件名）
 * 定位：启发式，防「手滑拖整目录连坐敏感文件」；用户显式拖单个文件仍可绕过——
 * 与 ai-bash-policy 的诚实边界声明一致，不是安全边界。
 */
const DENIED_HOME_PREFIXES = ['.ssh', '.gnupg', '.aws', '.kube', 'Library/Keychains'];
const DENIED_BASENAMES = new Set(['.bash_history', '.zsh_history', '.env']);

/**
 * 登记表：attachmentId → AttachmentMeta（应用生命周期，无持久化需求——
 * renderer 状态与登记表同生共死；快照文件本身持久在磁盘，历史恢复不依赖登记表）
 * @type {Map<string, object>}
 */
const attachmentRegistry = new Map();

/** sourceKey → AttachmentMeta（去重索引） */
const sourceKeyIndex = new Map();

/**
 * 判定附件是否为图片（纯函数）
 *
 * mimeType 以 image/ 开头直接判定；为空时按扩展名兜底
 * （macOS Finder 拖拽偶发 File.type 为空字符串）。
 *
 * @param {string} name - 文件名（取扩展名）
 * @param {string} [mimeType] - renderer 上报的 mime（可能为空）
 * @returns {boolean} 是否图片
 */
function classifyMime(name, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (mime && mime !== FALLBACK_MIME) return false;
  const ext = path.extname(String(name || '')).replace(/^\./, '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * 净化文件名（纯函数）：剥离路径分隔符与控制字符，保留中文/字母/数字/
 * 点/横线/下划线，限长 80；空结果回落 'file'
 *
 * @param {string} name - 原始文件名
 * @returns {string} 安全文件名（不含路径分隔符）
 */
function sanitizeFilename(name) {
  const cleaned = String(name || '')
    // 剥离路径分隔符（防 Windows 反斜杠与显式 ../ 穿越）
    .replace(/[/\\]/g, '')
    // 剥离控制字符（含换行，marker 文本按行解析）
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    // 只保留白名单字符（中文范围 \u4e00-\u9fa5 + 常规安全字符）
    .replace(/[^\w.\-\u4e00-\u9fa5]/g, '')
    .slice(0, 80)
    .replace(/^[.\s]+/, ''); // 防纯 '.'/隐藏文件形态
  return cleaned || 'file';
}

/**
 * 判定源路径是否命中敏感屏蔽清单（纯函数，输入须为已展开的绝对路径）
 *
 * @param {string} absPath - 绝对路径
 * @returns {boolean} true = 应拒绝登记
 */
function isDeniedSourcePath(absPath) {
  const p = String(absPath || '');
  const home = os.homedir();
  const homePrefix = home.endsWith(path.sep) ? home : home + path.sep;
  for (const rel of DENIED_HOME_PREFIXES) {
    const denied = path.join(home, rel);
    if (p === denied || p.startsWith(denied + path.sep)) return true;
  }
  // 相对 home 的写法（~/.ssh/... 未展开时兜底）
  if (p.startsWith('~/')) {
    const rel = p.slice(2);
    if (DENIED_HOME_PREFIXES.some((d) => rel === d || rel.startsWith(d + '/'))) return true;
  }
  // 任意层的敏感文件名
  const base = path.basename(p);
  if (DENIED_BASENAMES.has(base)) return true;
  // home 前缀判空守卫（测试环境 homedir 恒存在，防御性）
  if (p.startsWith(homePrefix) && DENIED_BASENAMES.has(base)) return true;
  return false;
}

/**
 * 生成快照唯一文件名：净化原名 + 时间戳 + 4 位随机，物理上无冲突
 *
 * @param {string} originalName - 原始文件名
 * @param {string} [ext] - 保留的扩展名（含点）
 * @returns {string} 唯一文件名
 */
function uniqueSnapshotName(originalName, ext = '') {
  const rand = crypto.randomBytes(2).toString('hex');
  return `${sanitizeFilename(originalName)}-${Date.now()}-${rand}${ext}`;
}

/**
 * 递归统计目录字节量
 *
 * @param {string} dirPath - 目录绝对路径
 * @returns {number} 总字节数（统计失败按 0 处理，不阻断登记）
 */
function dirSize(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      try {
        total += fs.statSync(path.join(entry.parentPath || dirPath, entry.name)).size;
      } catch { /* 单项失败跳过 */ }
    }
  } catch { /* 目录不可读按 0 */ }
  return total;
}

/**
 * 递归复制目录（cpSync 默认 dereference:false 不跟随 symlink，与源端
 * lstat 拒绝 symlink 的语义双保险）
 *
 * @param {string} src - 源目录
 * @param {string} dst - 目标目录
 */
function copyDirectory(src, dst) {
  fs.cpSync(src, dst, { recursive: true, dereference: false, verbatimSymlinks: true });
}

/**
 * 批量登记路径型附件（主入口，ai:attach-files 消费）
 *
 * 部分成功语义：单项失败进 errors 数组，不整批 throw。
 *
 * @param {string[]} absPaths - 源绝对路径数组
 * @returns {Promise<{attachments: object[], errors: Array<{path: string, reason: string}>}>}
 */
async function registerFiles(absPaths) {
  const attachments = [];
  const errors = [];
  const list = Array.isArray(absPaths) ? absPaths : [];

  fs.mkdirSync(getAttachmentsDir(), { recursive: true });

  for (const raw of list) {
    const source = String(raw || '');
    try {
      const resolved = path.resolve(source);
      if (!path.isAbsolute(resolved)) {
        errors.push({ path: source, reason: '路径必须为绝对路径' });
        continue;
      }
      if (isDeniedSourcePath(resolved)) {
        errors.push({ path: source, reason: '敏感路径不允许作为附件' });
        continue;
      }

      let stat;
      try {
        stat = await fs.promises.lstat(resolved);
      } catch {
        errors.push({ path: source, reason: '路径不存在或不可访问' });
        continue;
      }
      if (stat.isSymbolicLink()) {
        errors.push({ path: source, reason: 'symlink 不允许作为附件' });
        continue;
      }

      // 去重键：JS 版 realpathSync（保留调用方拼写，native realpath 会改写
      // macOS 大小写 / Win 8.3 短名导致同一文件算出两个 key）+ size + mtime
      let realSource;
      try {
        realSource = fs.realpathSync(resolved);
      } catch {
        realSource = resolved;
      }
      const sourceKey = stat.isDirectory()
        ? `${realSource}:dir:${stat.mtimeMs}`
        : `${realSource}:${stat.size}:${stat.mtimeMs}`;
      const existing = sourceKeyIndex.get(sourceKey);
      if (existing) {
        attachments.push(existing);
        continue;
      }

      // 复制快照
      const isDir = stat.isDirectory();
      const name = path.basename(resolved);
      const snapshotName = uniqueSnapshotName(name, isDir ? '' : path.extname(resolved));
      const snapshotPath = path.join(getAttachmentsDir(), snapshotName);
      if (isDir) {
        copyDirectory(resolved, snapshotPath);
      } else {
        await fs.promises.copyFile(resolved, snapshotPath);
      }

      // 防御性断言：快照必须落在工作区内（理论上恒过，复制链路被改时兜底）
      const inside = resolveInside(getWorkspaceDir(), snapshotPath);
      if (!inside) {
        try { fs.rmSync(snapshotPath, { recursive: true, force: true }); } catch { /* 清理失败忽略 */ }
        errors.push({ path: source, reason: '快照落点校验失败' });
        continue;
      }

      const isImage = classifyMime(name, '');
      const meta = {
        id: crypto.randomUUID(),
        name,
        path: snapshotPath,
        mimeType: isImage ? `image/${guessImageSubtype(name)}` : FALLBACK_MIME,
        isImage,
        isDirectory: isDir,
        size: isDir ? dirSize(snapshotPath) : stat.size,
      };
      attachmentRegistry.set(meta.id, meta);
      sourceKeyIndex.set(sourceKey, meta);
      attachments.push(meta);

      if (meta.size > SOFT_SIZE_WARN_BYTES) {
        console.warn(`[Realm AI] 附件较大（${(meta.size / 1024 / 1024).toFixed(1)}MB）: ${meta.name}`);
      }
    } catch (err) {
      errors.push({ path: source, reason: err.message || '登记失败' });
    }
  }

  return { attachments, errors };
}

/**
 * 由扩展名猜图片子类型（仅 classifyMime 判定图片且 mime 缺失时用）
 *
 * @param {string} name - 文件名
 * @returns {string} 图片子类型（如 png / jpeg）
 */
function guessImageSubtype(name) {
  const ext = path.extname(String(name || '')).replace(/^\./, '').toLowerCase();
  if (ext === 'jpg') return 'jpeg';
  if (ext === 'svg') return 'svg+xml';
  return ext || 'png';
}

/**
 * 登记 blob 型附件（截图等无路径内存数据，ai:attach-blob 消费）
 *
 * 去重：sha256 前 16 位 + size 相同视为同一内容（截图连按同屏去重）。
 *
 * @param {{name?: string, mimeType?: string, base64: string}} payload
 * @returns {Promise<{attachment: object|null, error?: string}>}
 */
async function registerBlob(payload) {
  try {
    const base64 = String(payload?.base64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!base64) return { attachment: null, error: 'base64 数据为空' };

    fs.mkdirSync(getAttachmentsDir(), { recursive: true });

    const buffer = Buffer.from(base64, 'base64');
    const digest = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const sourceKey = `blob:${digest}:${buffer.length}`;
    const existing = sourceKeyIndex.get(sourceKey);
    if (existing) return { attachment: existing };

    const mimeType = String(payload?.mimeType || 'image/png').toLowerCase();
    const extMap = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
    const ext = extMap[mimeType] || '.png';
    const name = sanitizeFilename(payload?.name || `粘贴图片${ext}`);
    const snapshotPath = path.join(getAttachmentsDir(), uniqueSnapshotName(name, ext));
    await fs.promises.writeFile(snapshotPath, buffer);

    const inside = resolveInside(getWorkspaceDir(), snapshotPath);
    if (!inside) {
      try { fs.rmSync(snapshotPath, { force: true }); } catch { /* 忽略 */ }
      return { attachment: null, error: '快照落点校验失败' };
    }

    const meta = {
      id: crypto.randomUUID(),
      name,
      path: snapshotPath,
      mimeType: classifyMime(name, mimeType) ? mimeType : FALLBACK_MIME,
      isImage: classifyMime(name, mimeType),
      isDirectory: false,
      size: buffer.length,
    };
    attachmentRegistry.set(meta.id, meta);
    sourceKeyIndex.set(sourceKey, meta);
    return { attachment: meta };
  } catch (err) {
    return { attachment: null, error: err.message || '登记失败' };
  }
}

/**
 * 按登记 ID 反查附件元数据（ai-manager 发送时消费）
 *
 * @param {string} attachmentId - 登记 ID
 * @returns {object|null} AttachmentMeta；未知/过期 ID 返回 null
 */
function getAttachment(attachmentId) {
  if (!attachmentId || typeof attachmentId !== 'string') return null;
  return attachmentRegistry.get(attachmentId) || null;
}

/**
 * 读取图片附件预览 data URL（气泡/胶囊缩略图用）
 *
 * 仅图片且 ≤2MB 时返回；其余返回 null（前端回退通用图标）。
 *
 * @param {string} attachmentId - 登记 ID
 * @returns {Promise<string|null>} data URL 或 null
 */
async function readPreviewDataUrl(attachmentId) {
  const meta = getAttachment(attachmentId);
  if (!meta || !meta.isImage || meta.isDirectory) return null;
  try {
    const stat = await fs.promises.stat(meta.path);
    if (stat.size > PREVIEW_MAX_BYTES) return null;
    const buffer = await fs.promises.readFile(meta.path);
    return `data:${meta.mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * 读取图片附件内联渲染数据（聊天气泡渲染消费，工具截图渲染同款效果）
 *
 * 双入口：
 * - id：登记表反查（发送当轮，registry 存活）
 * - path：历史恢复场景（registry 已空，messages 表 attachments 列持久了
 *   快照路径）——**必须校验路径落在 attachments 目录内**（realpath 复核，
   *   防 renderer/DB 被伪造路径读任意文件），伪造与越界一律返回 null
 *
 * @param {{id?: string, path?: string}} payload - 登记 ID 或快照路径
 * @returns {Promise<string|null>} data URL；非图片/超限/越界/读取失败返回 null
 */
async function readImageDataUrl(payload) {
  try {
    const meta = getAttachment(payload?.id);
    const target = meta ? meta.path : payload?.path;
    if (!target || typeof target !== 'string') return null;

    // 仅图片可内联渲染
    const name = meta ? meta.name : path.basename(target);
    const mimeType = meta && meta.mimeType ? meta.mimeType
      : (classifyMime(name, '') ? `image/${guessImageSubtype(name)}` : FALLBACK_MIME);
    if (!classifyMime(name, mimeType)) return null;

    // 路径校验：realpath 后必须落在 attachments 目录（含其 realpath）内
    //（macOS /var → /private/var 同源双基准，与 resolveInside 同哲学）
    const attachmentsDir = getAttachmentsDir();
    let canonical;
    try {
      canonical = fs.realpathSync(target);
    } catch {
      return null; // 不存在或不可访问
    }
    let dirBases = [attachmentsDir];
    try {
      dirBases.push(fs.realpathSync(attachmentsDir));
    } catch { /* 目录未建时只按词法基准 */ }
    const inside = dirBases.some((base) =>
      canonical === base || canonical.startsWith(base + path.sep));
    if (!inside) return null;

    const stat = await fs.promises.stat(canonical);
    if (stat.size > INLINE_IMAGE_MAX_BYTES) return null;
    const buffer = await fs.promises.readFile(canonical);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * 构建附件 marker 文本块（纯函数，ai-manager.promptWithContext 消费）
 *
 * 形态对标 openhanako：每附件一行 marker 置于用户正文最前，
 * marker 与正文之间空行分隔；marker 文本持久在会话 content 里，
 * 历史恢复后 agent 仍可按路径 re-read 快照。
 *
 * @param {Array<{path: string, name: string, isImage: boolean, isDirectory: boolean}>} attachments
 * @param {Object} [options]
 * @param {string} [options.imageMode='inline'] - 图片 marker 措辞模式：
 *   'inline'（缺省，向后兼容）= 原图已随消息直发（主模型判定支持图片）；
 *   'described' = 图片已经视觉专用模型转写为文字描述（vision-describer 桥接
 *   分支，原图未直发）；'fallback' = 原图已直发但主模型被判不支持图片
 *   （元数据可能误判，实测 mimo 系列支持视觉但目录 input:['text']；真不支持
 *   时 SDK 会降级为占位符）——措辞中性，要求模型看不了图就如实说、不编造
 * @returns {string} marker 块（空数组返回空串）
 */
function buildAttachmentMarkers(attachments, options = {}) {
  const imageMode = options && ['described', 'fallback'].includes(options.imageMode)
    ? options.imageMode
    : 'inline';
  const list = Array.isArray(attachments) ? attachments : [];
  const lines = [];
  for (const att of list) {
    if (!att || typeof att.path !== 'string' || !att.path) continue;
    const target = att.isDirectory ? `${att.path}/` : att.path;
    if (att.isImage) {
      let note;
      if (imageMode === 'described') {
        note = '（图片，已由视觉模型转写为文字描述，见下方 <image-descriptions> 块）';
      } else if (imageMode === 'fallback') {
        note = '（图片，已随消息附上；若你无法查看图片内容，请如实告知用户你看不到图片，不要猜测或编造图片内容）';
      } else {
        note = '（图片，已同步附于消息）';
      }
      lines.push(`[attached_image: ${target}] ${att.name}${note}`);
    } else if (att.isDirectory) {
      lines.push(`[attached_file: ${target}] ${att.name}/（目录，可递归读取）`);
    } else {
      lines.push(`[attached_file: ${target}] ${att.name}`);
    }
  }
  return lines.join('\n');
}

/**
 * 清空登记表（仅测试用）
 */
function _resetRegistryForTest() {
  attachmentRegistry.clear();
  sourceKeyIndex.clear();
}

module.exports = {
  classifyMime,
  sanitizeFilename,
  isDeniedSourcePath,
  registerFiles,
  registerBlob,
  getAttachment,
  readPreviewDataUrl,
  readImageDataUrl,
  buildAttachmentMarkers,
  _resetRegistryForTest,
};

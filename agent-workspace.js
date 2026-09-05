/**
 * Realm Browser - AI 工作区模块
 *
 * 提供 AI 助手的专属根目录（agent 根目录）：userData/agent-workspace/。
 * 所有 AI 落盘数据统一收纳于此：
 * - ai-memory/   AI 记忆（由 ai-memory-manager 消费，启动时一次性迁入）
 * - .tmp/        bash 输出截断全量落盘等临时文件（SandboxExecutionEnv 重定向目标）
 *
 * 沙箱：createSandboxEnv 包装 SDK 的 NodeExecutionEnv，对全部 FileSystem
 * 方法做路径硬校验——resolve + realpath 后必须落在工作区内，越界返回
 * permission_denied 的 FileError（FileSystem 契约：永不 throw，失败编码进
 * Result）。bash 命令本身是任意 shell，无法静态穷举拦截，其逃逸风险由
 * ai-bash-policy 的三档权限（白名单/默认确认/危险强制确认）缓解。
 *
 * electron 依赖惰性获取（与 ai-memory-manager.js 先例一致）：纯 Node
 * 测试环境下 require('electron') 不可加载，延迟到真正需要路径时才 require。
 */

const fs = require('fs');
const path = require('path');

/** 工作区根目录覆写（测试注入；null 回落默认 userData/agent-workspace） */
let _workspaceDirOverride = null;

/** 旧版 ai-memory 目录覆写（测试注入迁移逻辑用；null 回落 userData/ai-memory） */
let _legacyAiMemoryDirOverride = null;

/**
 * 解析 agent 工作区根目录
 *
 * electron app 依赖惰性获取：纯 Node 环境（node:test）下 require('electron')
 * 不可加载，必须延迟到真正需要路径时才 require。
 *
 * @returns {string} 工作区根目录绝对路径
 */
function getWorkspaceDir() {
  if (_workspaceDirOverride) return _workspaceDirOverride;
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'agent-workspace');
}

/**
 * 覆写工作区根目录（测试临时目录注入唯一入口）
 * @param {string|null} dir - 根目录绝对路径；null 恢复默认 userData 路径
 */
function setWorkspaceDir(dir) {
  _workspaceDirOverride = dir;
}

/**
 * 覆写旧版 ai-memory 目录（仅测试迁移逻辑用）
 * @param {string|null} dir - 旧目录绝对路径；null 恢复默认 userData/ai-memory
 */
function setLegacyAiMemoryDir(dir) {
  _legacyAiMemoryDirOverride = dir;
}

/**
 * 解析旧版 ai-memory 目录（迁移源，只读不删——迁移后保留作为回滚保险）
 * @returns {string} 旧目录绝对路径
 */
function getLegacyAiMemoryDir() {
  if (_legacyAiMemoryDirOverride) return _legacyAiMemoryDirOverride;
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'ai-memory');
}

/**
 * 解析 AI 记忆新家：agent-workspace/ai-memory（ai-memory-manager.getBaseDir 消费）
 * @returns {string} 记忆目录绝对路径
 */
function getAiMemoryDir() {
  return path.join(getWorkspaceDir(), 'ai-memory');
}

/**
 * 解析沙箱内临时目录（承接 SDK bash 输出截断全量落盘等临时文件）
 * @returns {string} 临时目录绝对路径
 */
function getTmpDir() {
  return path.join(getWorkspaceDir(), '.tmp');
}

/**
 * 解析聊天附件快照目录（用户拖入/粘贴的文件由主进程复制于此，
 * agent 经 read 工具直接读取——快照在沙箱根内，resolveInside 天然放行）
 * @returns {string} 附件快照目录绝对路径
 */
function getAttachmentsDir() {
  return path.join(getWorkspaceDir(), 'attachments');
}

/**
 * 启动时建目录（幂等）：根目录 + .tmp/ + attachments/
 */
function ensureWorkspaceDir() {
  fs.mkdirSync(getWorkspaceDir(), { recursive: true });
  fs.mkdirSync(getTmpDir(), { recursive: true });
  fs.mkdirSync(getAttachmentsDir(), { recursive: true });
}

/**
 * 一次性迁移旧版 AI 记忆目录到工作区（照抄 cookie-manager migrateLegacyCookies
 * 的「旧存在 && 新不存在才迁」先例，目录版 cpSync）
 *
 * 任何失败仅告警不阻断启动；旧目录保留不删（回滚保险）。
 */
function migrateAiMemory() {
  const legacy = getLegacyAiMemoryDir();
  const target = getAiMemoryDir();
  if (!fs.existsSync(legacy)) return;
  if (fs.existsSync(target)) return;
  try {
    fs.cpSync(legacy, target, { recursive: true });
    console.log('[Realm] AI 记忆已迁移至 agent-workspace/ai-memory');
  } catch (err) {
    console.error('[Realm] AI 记忆迁移失败（保留旧目录，下次启动重试）:', err.message);
  }
}

/**
 * 判定路径解析后是否落在 root 内（纯函数，供沙箱与测试共用）
 *
 * 算法：
 * 1. path.resolve 消化相对路径、`..`、多余分隔符（词法解析）
 * 2. 双基准放行：root 与 root 的 realpath（macOS /var → /private/var 等场景，
 *    canonicalPath/bash 的 cwd 输出天然是 realpath 形态，单基准会误拒）
 * 3. 必须匹配 `基准 + path.sep` 前缀——排除撞名兄弟目录（/agent-workspace-evil）
 * 4. 已存在的路径做 realpath 复核（防 symlink 二段式逃逸：bash 先 ln -s /etc
 *    再用 read 工具读 link）
 *
 * @param {string} root - 沙箱根目录绝对路径
 * @param {string} p - 待校验路径（绝对或相对 root）
 * @returns {string|null} 校验通过返回词法规范化的绝对路径；越界返回 null
 */
function resolveInside(root, p) {
  if (typeof p !== 'string' || !p.trim()) return null;
  let abs;
  try {
    abs = path.resolve(root, p);
  } catch {
    return null;
  }
  let realRoot = root;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    // root 本身 realpath 失败（理论上 ensureWorkspaceDir 已建），退化为单基准
  }
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  const realPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (abs === root || abs === realRoot) return abs;
  const lexicallyInside = abs.startsWith(rootPrefix) || abs.startsWith(realPrefix);
  if (!lexicallyInside) return null;
  // symlink 复核：仅当路径已存在时；不存在（ENOENT）词法通过即可
  try {
    const real = fs.realpathSync(abs);
    if (real === root || real === realRoot) return abs;
    if (real.startsWith(rootPrefix) || real.startsWith(realPrefix)) return abs;
    return null;
  } catch (err) {
    if (err && err.code === 'ENOENT') return abs;
    // realpath 其他失败（权限等）按拒绝处理（fail-closed）
    return null;
  }
}

/**
 * 创建沙箱 ExecutionEnv（包装 NodeExecutionEnv，覆写全部 FileSystem 方法 + exec）
 *
 * 拦截原则：任何漏包的路径入口就是逃逸口，因此 17 个 FileSystem 方法全部
 * 包装（不挑「关键方法」）。joinPath 纯词法拼接不触发 IO，透传（后续 IO
 * 方法兜底校验）。createTempDir/createTempFile 重定向到工作区 .tmp/——
 * SDK 默认落 os.tmpdir()，会破沙箱封闭，bash 截断全量输出依赖它。
 *
 * @param {{cwd?: string}} [options] - 沙箱根目录；缺省用 getWorkspaceDir()
 * @returns {Promise<Object>} 满足 SDK ExecutionEnv 形状的沙箱包装对象
 */
async function createSandboxEnv(options = {}) {
  ensureWorkspaceDir();
  const root = path.resolve(options.cwd || getWorkspaceDir());

  // SDK 为 ESM-only，主进程 CJS 侧一律动态 import（与 ai-manager.js 先例一致）
  const { NodeExecutionEnv } = await import('@earendil-works/pi-agent-core/node');
  const { FileError, err, ok } = await import('@earendil-works/pi-agent-core');
  const inner = new NodeExecutionEnv({ cwd: root });

  /**
   * 构造越界拒绝结果（FileSystem 契约：永不 throw，失败编码进 Result）
   * @param {string} p - 被拒路径
   */
  const deny = (p) => err(new FileError(
    'permission_denied',
    `路径越出 AI 工作区（沙箱拒绝）: ${p}。read/write/edit 只能访问工作区内的文件`,
    String(p)
  ));

  /** 单路径校验；通过返回规范化绝对路径，越界返回 null */
  const guard = (p) => resolveInside(root, p);

  /** 校验失败时返回 deny Result 的快捷判定 */
  const guardResult = (p) => (guard(p) === null ? deny(p) : null);

  // 临时文件名安全化：只保留字母数字下划线连字符，防前缀/后缀带路径分隔符
  const sanitizeNamePart = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

  return {
    cwd: root,

    async absolutePath(p) {
      const abs = guard(p);
      if (abs === null) return deny(p);
      return ok(abs);
    },

    async joinPath(parts) {
      // 纯词法拼接，不做 IO；结果路径的 IO 由各方法兜底校验
      return inner.joinPath(parts);
    },

    async readTextFile(p, abortSignal) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.readTextFile(p, abortSignal);
    },

    async readTextLines(p, opts) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.readTextLines(p, opts);
    },

    async readBinaryFile(p, abortSignal) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.readBinaryFile(p, abortSignal);
    },

    async writeFile(p, content, abortSignal) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.writeFile(p, content, abortSignal);
    },

    async appendFile(p, content) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.appendFile(p, content);
    },

    async renameFile(sourcePath, destinationPath, abortSignal) {
      // 双路径分别校验：destination 逃逸 = 写逃逸
      const blockedSrc = guardResult(sourcePath);
      if (blockedSrc) return blockedSrc;
      const blockedDst = guardResult(destinationPath);
      if (blockedDst) return blockedDst;
      return inner.renameFile(sourcePath, destinationPath, abortSignal);
    },

    async fileInfo(p) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.fileInfo(p);
    },

    async listDir(p, abortSignal) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.listDir(p, abortSignal);
    },

    async canonicalPath(p) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      const result = await inner.canonicalPath(p);
      // canonicalPath 返回 realpath 结果，对输出再校验一次（防 symlink 指向外部）
      if (result.ok && resolveInside(root, result.value) === null) {
        return deny(result.value);
      }
      return result;
    },

    async exists(p) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.exists(p);
    },

    async createDir(p, opts) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.createDir(p, opts);
    },

    async remove(p, opts) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.remove(p, opts);
    },

    async createTempDir(prefix) {
      // 重定向到工作区 .tmp/（SDK 默认 os.tmpdir() 会破沙箱封闭）
      try {
        const safePrefix = 'tmp-' + sanitizeNamePart(prefix);
        const dir = await fs.promises.mkdtemp(path.join(getTmpDir(), safePrefix + '-'));
        return ok(dir);
      } catch (e) {
        return err(new FileError('unknown', `创建临时目录失败: ${e.message}`));
      }
    },

    async createTempFile(opts = {}) {
      try {
        const safePrefix = sanitizeNamePart(opts.prefix);
        const safeSuffix = sanitizeNamePart(opts.suffix);
        const dir = await fs.promises.mkdtemp(path.join(getTmpDir(), 'tmp-'));
        const file = path.join(
          dir,
          `${safePrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeSuffix}`
        );
        await fs.promises.writeFile(file, '');
        return ok(file);
      } catch (e) {
        return err(new FileError('unknown', `创建临时文件失败: ${e.message}`));
      }
    },

    async exec(command, execOptions = {}) {
      // 只校验工作目录：显式传入的 cwd 必须落在沙箱内（缺省即沙箱根）。
      // 命令内容不在这一层校验——任意 shell 无法静态穷举，交给三档权限。
      if (execOptions.cwd !== undefined) {
        const blocked = guardResult(execOptions.cwd);
        if (blocked) {
          return {
            ok: false,
            error: new (await import('@earendil-works/pi-agent-core')).ExecutionError(
              'spawn_error',
              `cwd 越出 AI 工作区（沙箱拒绝）: ${execOptions.cwd}`
            ),
          };
        }
      }
      return inner.exec(command, execOptions);
    },

    async cleanup() {
      return inner.cleanup();
    },
  };
}

module.exports = {
  getWorkspaceDir,
  setWorkspaceDir,
  setLegacyAiMemoryDir,
  getAiMemoryDir,
  getTmpDir,
  getAttachmentsDir,
  ensureWorkspaceDir,
  migrateAiMemory,
  resolveInside,
  createSandboxEnv,
};

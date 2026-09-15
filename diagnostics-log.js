/**
 * Realm Browser - 诊断日志落盘
 *
 * **为什么需要**：主进程诊断（guest 无响应/崩溃）与渲染进程的「残留恢复」日志此前只进
 * console —— 打包版（Nightly/正式）双击启动没有终端，事后无从取证（渲染进程日志在
 * DevTools 关闭后即消失）。本模块把它们追加到 `<userData>/logs/diagnostics.log`。
 *
 * **采集范围**（实测依据见 docs/debug/webview-hit-test-stuck.md §6.5）：
 * - 主进程：`console.warn` / `console.error` 挂钩 + `diagLog()` 显式调用
 * - 渲染进程（主窗口 + webview guest）：`webContents 'console-message'`，经 `shouldForward` 过滤。
 *   **guest 那一路必须注册在 guest 自身的 webContents 上**——注册在主窗口上收不到 guest 日志
 *   （Electron 43 实测；此前仓库文档的「新版收不到 guest 日志」结论即由此误判而来）
 * - 有意不采集：`console.log`（量太大）、Electron 自身的安全警告
 *   （`sourceId` 以 `node:electron/` 开头，实测每条页面都会带一条，不滤会刷屏）
 *
 * **启用环境**：`development` / `debug` / `nightly`。`production` 不落盘（零行为变化）。
 *
 * **格式**：`[ISO 时间] [级别] [来源] 正文`，每次启动写一行会话分隔头。
 * **轮转**：超过 `MAX_BYTES` 时把当前文件改名为 `.1`（只保留一份历史），继续追加。
 *
 * 本模块**零 electron 依赖**（`dir` 由调用方注入）⇒ 纯 Node 可直接单测；
 * 所有文件操作 try/catch 兜底且**永不抛错**——日志写失败绝不能影响应用运行。
 *
 * @module diagnostics-log
 */

const fs = require('fs');
const path = require('path');

/** 轮转阈值（字节） */
const MAX_BYTES = 5 * 1024 * 1024;

/** 落盘启用的环境 */
const ENABLED_ENVS = new Set(['development', 'debug', 'nightly']);

/**
 * 「必须落盘」的渲染进程日志判定（前缀白名单）。
 * 约定：想让某条渲染进程日志进文件，就把 `[Realm 诊断]` 写进文案（或在主进程用 `diagLog`）。
 */
const FORWARD_MESSAGE_PATTERN = /可命中性残留|\[Realm 诊断\]/;

/** electron 内部消息的 sourceId 前缀（安全警告等，实测会随每个页面出现） */
const INTERNAL_SOURCE_PREFIX = 'node:electron/';

/**
 * 已知噪声源（命中即不落盘，**新增条目必须附实测依据**）
 *
 * 为什么需要：`level === 'error'` 是直通的（渲染异常是取证重点），而 CSP 违规也走 error ——
 * 内部页 `style-src 'self'` 下页面每处内联样式都是一条，单次加载即可产生数十条，
 * 会把真正的诊断淹没（2026-09-15 UAT 驱动实测：一次运行 20+ 条）。
 */
const NOISE_PATTERNS = [
  /Content Security Policy directive/i,
];

/** 运行时状态（`_reset()` 后回到未初始化态） */
const state = {
  enabled: false,
  filePath: '',
  bytes: 0,
  broken: false,
  consoleMirror: false,
};

/**
 * 判定一条渲染进程控制台消息是否应当落盘（纯函数，供单测直接覆盖）
 *
 * @param {{level?: string, message?: string, sourceId?: string}} info - 'console-message' 事件字段
 * @returns {boolean}
 */
function shouldForward(info) {
  if (!info) return false;
  const sourceId = typeof info.sourceId === 'string' ? info.sourceId : '';
  if (sourceId.startsWith(INTERNAL_SOURCE_PREFIX)) return false;
  const message = String(info.message || '');
  if (NOISE_PATTERNS.some((re) => re.test(message))) return false;
  if (info.level === 'error') return true;
  return FORWARD_MESSAGE_PATTERN.test(message);
}

/** 把任意值渲染成单行文本（多行消息压成一条记录，避免后续行缺口径） */
function toSingleLine(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\r?\n/g, '\\n');
}

/**
 * 初始化（幂等）：启用环境则准备好日志文件并写会话分隔头
 *
 * @param {Object} options
 * @param {string} options.dir - 日志目录（调用方传 `app.getPath('userData')`）
 * @param {string} [options.env] - `process.env.NODE_ENV`
 * @param {string} [options.version] - 应用版本（写进会话头）
 * @param {number} [options.pid]
 * @returns {{ enabled: boolean, filePath: string, reason?: string }}
 */
function init(options = {}) {
  const { dir, env = 'production', version = '', pid = process.pid } = options;
  state.enabled = false;
  state.filePath = '';
  state.bytes = 0;
  state.broken = false;
  // 控制台回显只在 dev/debug：Nightly/正式的控制台保持零输出（落盘不受此影响）
  state.consoleMirror = env === 'development' || env === 'debug';

  if (!ENABLED_ENVS.has(env)) {
    return { enabled: false, filePath: '', reason: `env=${env} 不落盘` };
  }
  if (!dir) {
    return { enabled: false, filePath: '', reason: '未提供日志目录' };
  }

  const logsDir = path.join(dir, 'logs');
  const filePath = path.join(logsDir, 'diagnostics.log');
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    state.filePath = filePath;
    state.bytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
    state.enabled = true;
  } catch (err) {
    state.broken = true;
    return { enabled: false, filePath, reason: `准备日志目录失败: ${err.message}` };
  }

  const header =
    `===== session start env=${env} version=${version} pid=${pid} at ${new Date().toISOString()} =====`;
  append(header);
  return { enabled: true, filePath: state.filePath };
}

/**
 * 追加一行（内部；所有错误都被吞掉，必要时整轮禁用，避免逐行报错风暴）
 * @param {string} line
 */
function append(line) {
  if (!state.enabled || state.broken) return;
  try {
    const payload = line + '\n';
    fs.appendFileSync(state.filePath, payload);
    state.bytes += Buffer.byteLength(payload);
    if (state.bytes > MAX_BYTES) rotate();
  } catch (err) {
    state.broken = true;
    try {
      process.stderr.write(`[Realm 诊断] 日志落盘失败，本会话停止落盘: ${err.message}\n`);
    } catch (_) { /* 连 stderr 都不可用：放弃 */ }
  }
}

/** 轮转：当前文件改名 `.1`（覆盖上一份），重新从空文件开始 */
function rotate() {
  try {
    fs.renameSync(state.filePath, `${state.filePath}.1`);
    state.bytes = 0;
    append(`===== rotated at ${new Date().toISOString()}（上一份见 ${path.basename(state.filePath)}.1）=====`);
  } catch (err) {
    // 改名失败（被占用等）：不阻断写入，只在下次写入时再试
    state.bytes = 0;
  }
}

/**
 * 写一条诊断记录
 *
 * @param {'info'|'warn'|'error'} level
 * @param {string} source - 来源标签（如 `main` / `renderer:window` / `renderer:webview`）
 * @param {string} message - 正文
 */
function record(level, source, message) {
  if (!state.enabled || state.broken) return;
  append(`[${new Date().toISOString()}] [${level}] [${source}] ${toSingleLine(message)}`);
}

/**
 * 写一条内部诊断（并支持控制台回显）
 *
 * 主进程诊断事件的统一出口：**落盘与打印共用一次调用**，避免同一行被
 * 「显式调用」与「console 挂钩」各记一次。打印仅在 dev/debug（沿用既有环境约定）。
 *
 * @param {'info'|'warn'|'error'} level
 * @param {string} label - 诊断短标签（如 `webContents 无响应`）
 * @param {string} detail - 细节（如 `id=12 type=webview url=...`）
 */
function diagLog(level, label, detail) {
  const line = `[Realm 诊断] ${label}${detail ? ' ' + detail : ''}`;
  record(level, 'main', line);
  if (state.consoleMirror) {
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(line);
  }
}

/**
 * 挂钩主进程 console 的 warn / error（保留原输出，额外落盘）
 *
 * 只挂 warn/error 不挂 log：log 量太大（每次导航/每帧都会打），且不属于诊断。
 * 幂等：重复调用不会重复挂。
 *
 * @param {Console} [consoleObj]
 */
function hookMainConsole(consoleObj = console) {
  if (!consoleObj || consoleObj.__realmDiagnosticsHooked) return;
  for (const level of ['warn', 'error']) {
    const original = consoleObj[level].bind(consoleObj);
    consoleObj[level] = (...args) => {
      try {
        record(level, 'main', args.map((a) => (a && a.message) ? a.message : toSingleLine(a)).join(' '));
      } catch (_) { /* 记录失败不影响原输出 */ }
      return original(...args);
    };
  }
  consoleObj.__realmDiagnosticsHooked = true;
}

/**
 * 给一个 webContents 挂控制台转发（主窗口与 webview guest 都要挂；幂等）
 *
 * @param {Electron.WebContents} contents
 */
function attachContents(contents) {
  if (!contents || typeof contents.on !== 'function') return;
  if (contents.__realmDiagnosticsAttached) return;
  contents.__realmDiagnosticsAttached = true;
  contents.on('console-message', (event) => {
    if (!state.enabled || state.broken) return;
    if (!shouldForward(event)) return;
    let type = 'window';
    try {
      type = contents.getType();
    } catch (_) { /* 已销毁等过渡态：退回默认标签 */ }
    record(event.level === 'error' ? 'error' : event.level === 'warning' ? 'warn' : 'info',
      `renderer:${type}`, event.message);
  });
}

/** 当前日志文件路径（未启用时为空串） */
function getLogPath() {
  return state.filePath;
}

/** 是否已启用且未因错误停用 */
function isEnabled() {
  return state.enabled && !state.broken;
}

/** 仅测试用：复位到未初始化态 */
function _reset() {
  state.enabled = false;
  state.filePath = '';
  state.bytes = 0;
  state.broken = false;
  state.consoleMirror = false;
}

module.exports = {
  MAX_BYTES,
  ENABLED_ENVS,
  FORWARD_MESSAGE_PATTERN,
  NOISE_PATTERNS,
  shouldForward,
  init,
  record,
  diagLog,
  hookMainConsole,
  attachContents,
  getLogPath,
  isEnabled,
  _reset,
};

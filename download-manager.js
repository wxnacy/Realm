/**
 * Realm Browser - 下载管理器核心模块
 *
 * 负责下载事件拦截、进度追踪、SQLite 持久化和文件操作。
 * 每个容器 Session 注册 will-download 事件监听器，
 * 下载记录存储在 history.db 的 downloads 表中（单表 + container_id 列）。
 *
 * 依赖：better-sqlite3, electron (dialog, shell, BrowserWindow)
 * 数据库路径：{userData}/history.db（与 history-manager 共享）
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app, dialog, shell } = require('electron');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载，
// 否则 Electron 早期启动阶段会导致 SIGSEGV 段错误
let Database = null;

// 数据库路径（延迟初始化，避免 app.getPath 在 ready 前调用）
let DB_PATH = null;

// 数据库连接实例
let db = null;

// 活跃下载映射：downloadId -> DownloadItem
const activeDownloads = new Map();

// 下载指标缓存：downloadId -> { startTime, lastBytes, lastTime, speedHistory, lastSpeed }
const downloadMetrics = new Map();

// ==================== 常量 ====================

/** 滑动窗口速度计算的样本数 */
const DOWNLOAD_SPEED_WINDOW_SIZE = 5;

/** 速度计算最小间隔（ms），低于此间隔返回上次速度 */
const DOWNLOAD_SPEED_MIN_INTERVAL = 100;

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库连接，创建 downloads 表，设置 WAL 模式
 * 应在 app.whenReady 之后调用
 */
function initDatabase() {
  if (db) return;

  // 延迟加载原生模块和路径，确保在 app.whenReady 之后执行
  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'history.db');
  }

  db = new Database(DB_PATH);
  // WAL 模式：提升并发读写性能
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');

  // 创建 downloads 表（单表 + container_id 列，D-09 决策）
  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      container_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      save_path TEXT DEFAULT '',
      total_bytes INTEGER DEFAULT 0,
      received_bytes INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT '',
      state TEXT NOT NULL DEFAULT 'progressing',
      start_time INTEGER NOT NULL,
      end_time INTEGER DEFAULT 0,
      can_resume INTEGER DEFAULT 0,
      source_url TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_downloads_container_id ON downloads (container_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_state ON downloads (state);
    CREATE INDEX IF NOT EXISTS idx_downloads_start_time ON downloads (start_time DESC);
  `);

  console.log('[Realm] 下载管理器数据库已初始化');
}

// ==================== 工具函数 ====================

/**
 * 处理文件名冲突，自动添加 (1), (2) 等后缀（D-04）
 * @param {string} filePath - 原始文件路径
 * @returns {string} 唯一的文件路径
 */
function getUniqueFilePath(filePath) {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);

  let counter = 1;
  let newPath;
  do {
    newPath = path.join(dir, `${name} (${counter})${ext}`);
    counter++;
  } while (fs.existsSync(newPath));

  return newPath;
}

/**
 * 计算下载速度（滑动窗口平均，避免速度抖动）
 * @param {string} downloadId - 下载 ID
 * @param {number} currentBytes - 当前已接收字节数
 * @returns {number} 速度（bytes/s）
 */
function calculateSpeed(downloadId, currentBytes) {
  const metrics = downloadMetrics.get(downloadId);
  if (!metrics) return 0;

  const now = Date.now();
  const timeDiff = (now - metrics.lastTime) / 1000; // 转换为秒

  // 更新间隔太短，返回上次的速度
  if (timeDiff < DOWNLOAD_SPEED_MIN_INTERVAL / 1000) {
    return metrics.lastSpeed || 0;
  }

  const bytesDiff = currentBytes - metrics.lastBytes;
  const instantSpeed = bytesDiff / timeDiff;

  // 滑动窗口：保留最近 N 个速度样本
  metrics.speedHistory.push(instantSpeed);
  if (metrics.speedHistory.length > DOWNLOAD_SPEED_WINDOW_SIZE) {
    metrics.speedHistory.shift();
  }

  // 计算平均速度
  const avgSpeed = metrics.speedHistory.reduce((a, b) => a + b, 0)
    / metrics.speedHistory.length;

  // 更新指标
  metrics.lastBytes = currentBytes;
  metrics.lastTime = now;
  metrics.lastSpeed = avgSpeed;

  return Math.round(avgSpeed);
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小（如 "1.5 MB"）
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

/**
 * 格式化剩余时间
 * @param {number} bytesRemaining - 剩余字节数
 * @param {number} speed - 当前速度（bytes/s）
 * @returns {string} 格式化后的剩余时间
 */
function formatETA(bytesRemaining, speed) {
  if (bytesRemaining <= 0) return '完成';
  if (speed <= 0) return '计算中...';
  const seconds = Math.ceil(bytesRemaining / speed);
  if (seconds < 60) return `剩余 ${seconds}s`;
  if (seconds < 3600) return `剩余 ${Math.ceil(seconds / 60)}min`;
  return `剩余 ${Math.ceil(seconds / 3600)}h`;
}

// ==================== 通知渲染进程 ====================

/**
 * 获取主窗口实例（通过 window-manager）
 * @returns {Electron.BrowserWindow|null}
 */
function getMainWindow() {
  try {
    const windowManager = require('./window-manager');
    return windowManager.getMainWindow();
  } catch {
    return null;
  }
}

/**
 * 安全发送 IPC 事件到渲染进程
 * @param {string} channel - IPC 通道名
 * @param {*} data - 发送数据
 */
function notifyRenderer(channel, data) {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ==================== 下载记录持久化 ====================

/**
 * 保存下载记录到 SQLite
 * @param {Object} record - 下载记录
 */
function saveDownloadRecord(record) {
  if (!db) return;

  try {
    db.prepare(`
      INSERT OR REPLACE INTO downloads
      (id, container_id, filename, url, save_path, total_bytes, received_bytes,
       mime_type, state, start_time, end_time, can_resume, source_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.containerId,
      record.filename || '',
      record.url || '',
      record.savePath || '',
      record.totalBytes || 0,
      record.receivedBytes || 0,
      record.mimeType || '',
      record.state || 'progressing',
      record.startTime || Date.now(),
      record.endTime || 0,
      record.canResume ? 1 : 0,
      record.sourceUrl || ''
    );
  } catch (err) {
    console.error('[Realm] 保存下载记录失败:', err.message);
  }
}

/**
 * 更新下载记录的状态和进度
 * @param {string} downloadId - 下载 ID
 * @param {Object} updates - 更新字段
 */
function updateDownloadRecord(downloadId, updates) {
  if (!db) return;

  try {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      // 驼峰转下划线
      const dbKey = key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
      fields.push(`${dbKey} = ?`);
      values.push(value);
    }

    if (fields.length === 0) return;

    values.push(downloadId);
    db.prepare(`UPDATE downloads SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  } catch (err) {
    console.error('[Realm] 更新下载记录失败:', err.message);
  }
}

// ==================== DownloadItem 事件处理 ====================

/**
 * 设置 DownloadItem 事件监听器
 * @param {Electron.DownloadItem} item - DownloadItem 实例
 * @param {string} downloadId - 下载 ID
 * @param {string} containerId - 容器 ID
 */
function setupDownloadItemEvents(item, downloadId, containerId) {
  // 进度更新事件
  item.on('updated', (event, state) => {
    if (state === 'progressing') {
      const received = item.getReceivedBytes();
      const total = item.getTotalBytes();
      const speed = calculateSpeed(downloadId, received);
      const percent = total > 0 ? Math.round((received / total) * 100) : 0;

      // 推送进度到渲染进程
      notifyRenderer('download:progress', {
        downloadId,
        containerId,
        filename: item.getFilename(),
        received,
        total,
        speed,
        percent,
        state: 'progressing',
        speedText: formatFileSize(speed) + '/s',
        etaText: formatETA(total - received, speed),
      });
    } else if (state === 'interrupted') {
      notifyRenderer('download:progress', {
        downloadId,
        containerId,
        state: 'interrupted',
        reason: item.getLastReason() || 'download-interrupted',
      });
    }
  });

  // 下载完成事件
  item.on('done', (event, state) => {
    const metrics = downloadMetrics.get(downloadId);
    const endTime = Date.now();

    if (state === 'completed') {
      // 保存完成记录到 SQLite
      saveDownloadRecord({
        id: downloadId,
        containerId,
        filename: item.getFilename(),
        url: item.getURL(),
        savePath: item.getSavePath(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: item.getReceivedBytes(),
        mimeType: item.getMimeType(),
        startTime: metrics ? metrics.startTime : endTime,
        endTime,
        state: 'completed',
      });

      // 通知渲染进程
      notifyRenderer('download:completed', {
        downloadId,
        containerId,
        filename: item.getFilename(),
        state: 'completed',
        savePath: item.getSavePath(),
      });
    } else if (state === 'cancelled') {
      saveDownloadRecord({
        id: downloadId,
        containerId,
        filename: item.getFilename(),
        url: item.getURL(),
        startTime: metrics ? metrics.startTime : endTime,
        endTime,
        state: 'cancelled',
      });

      notifyRenderer('download:completed', {
        downloadId,
        containerId,
        filename: item.getFilename(),
        state: 'cancelled',
      });
    } else if (state === 'interrupted') {
      saveDownloadRecord({
        id: downloadId,
        containerId,
        filename: item.getFilename(),
        url: item.getURL(),
        startTime: metrics ? metrics.startTime : endTime,
        endTime,
        state: 'interrupted',
        canResume: item.canResume(),
      });

      notifyRenderer('download:completed', {
        downloadId,
        containerId,
        filename: item.getFilename(),
        state: 'interrupted',
        canResume: item.canResume(),
      });
    }

    // 清理活跃下载和指标缓存
    activeDownloads.delete(downloadId);
    downloadMetrics.delete(downloadId);

    // 通知渲染进程活跃下载数量变化
    notifyRenderer('download:count-changed', { count: activeDownloads.size });
  });
}

// ==================== 核心函数 ====================

/**
 * 在容器 Session 上注册 will-download 事件监听器
 * 下载触发时显示系统原生保存对话框，用户选择保存位置后开始下载
 * @param {Electron.Session} ses - 容器的 Session 对象
 * @param {string} containerId - 容器 ID
 */
function registerSessionDownloadHandler(ses, containerId) {
  ses.on('will-download', (event, item, webContents) => {
    // 读取配置获取默认保存路径（D-02）
    let defaultDir;
    try {
      const Store = require('electron-store');
      const configStore = new Store({ name: 'realm-config' });
      defaultDir = configStore.get('settings.downloadPath', app.getPath('downloads'));
    } catch {
      defaultDir = app.getPath('downloads');
    }

    // 构建默认文件路径
    const defaultFilePath = path.join(defaultDir, item.getFilename());

    // 显示系统原生保存对话框（D-01, D-09: NSSavePanel）
    // 使用同步版本，确保在 will-download 回调内完成路径选择
    const mainWindow = getMainWindow();
    const parentWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;

    let result;
    try {
      result = dialog.showSaveDialogSync(parentWindow, {
        defaultPath: defaultFilePath,
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });
    } catch (err) {
      console.error('[Realm] 保存对话框显示失败:', err.message);
      event.preventDefault();
      return;
    }

    // 用户取消时阻止下载（同步版本返回 undefined 表示取消）
    if (!result) {
      event.preventDefault();
      return;
    }

    // 处理文件名冲突：自动添加 (1), (2) 后缀（D-04）
    const savePath = getUniqueFilePath(result);

    // 必须在 will-download 回调内同步调用 setSavePath（RESEARCH Pitfall 3）
    item.setSavePath(savePath);

    // 生成下载 ID
    const downloadId = crypto.randomUUID();

    // 记录来源 URL（页面 URL，非下载 URL）
    let sourceUrl = '';
    try {
      sourceUrl = webContents.getURL() || '';
    } catch {
      // webContents 可能已销毁
    }

    // 存入活跃下载映射
    activeDownloads.set(downloadId, item);

    // 初始化下载指标（用于速度计算）
    downloadMetrics.set(downloadId, {
      startTime: Date.now(),
      lastBytes: 0,
      lastTime: Date.now(),
      speedHistory: [],
      lastSpeed: 0,
      containerId,
    });

    // 注册 DownloadItem 事件
    setupDownloadItemEvents(item, downloadId, containerId);

    // 保存初始记录到 SQLite
    saveDownloadRecord({
      id: downloadId,
      containerId,
      filename: item.getFilename(),
      url: item.getURL(),
      savePath,
      totalBytes: item.getTotalBytes(),
      mimeType: item.getMimeType(),
      startTime: Date.now(),
      state: 'progressing',
      sourceUrl,
    });

    // 推送 download:started 到渲染进程
    notifyRenderer('download:started', {
      downloadId,
      containerId,
      filename: item.getFilename(),
      url: item.getURL(),
      savePath,
      totalBytes: item.getTotalBytes(),
      mimeType: item.getMimeType(),
    });

    // 通知活跃下载数量变化
    notifyRenderer('download:count-changed', { count: activeDownloads.size });

    console.log(`[Realm] 下载开始: ${item.getFilename()} -> ${savePath} (容器: ${containerId})`);
  });

  console.log(`[Realm] 已注册容器下载处理器: ${containerId}`);
}

// ==================== 查询函数 ====================

/**
 * 获取容器的下载记录（按 start_time DESC）
 * @param {string} containerId - 容器 ID
 * @returns {Array} 下载记录数组
 */
function getDownloads(containerId) {
  if (!db) return [];

  try {
    return db.prepare(`
      SELECT * FROM downloads
      WHERE container_id = ?
      ORDER BY start_time DESC
    `).all(containerId);
  } catch (err) {
    console.error('[Realm] 查询下载记录失败:', err.message);
    return [];
  }
}

/**
 * 获取当前活跃下载数量
 * @returns {number} 活跃下载数
 */
function getActiveCount() {
  return activeDownloads.size;
}

/**
 * 获取活跃下载列表（含进度信息，用于 tooltip 显示）
 * @returns {Array<{downloadId: string, filename: string, percent: number, speed: number}>}
 */
function getActiveDownloads() {
  const result = [];
  for (const [downloadId, item] of activeDownloads) {
    const metrics = downloadMetrics.get(downloadId);
    const total = item.getTotalBytes();
    const received = item.getReceivedBytes();
    const percent = total > 0 ? Math.round((received / total) * 100) : 0;

    result.push({
      downloadId,
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: total,
      receivedBytes: received,
      percent,
      speed: metrics ? metrics.lastSpeed || 0 : 0,
      speedText: metrics ? formatFileSize(metrics.lastSpeed || 0) + '/s' : '0 B/s',
      state: item.isPaused() ? 'paused' : 'progressing',
    });
  }
  return result;
}

// ==================== 全局查询与管理函数 ====================

/**
 * 全局查询所有容器的下载记录（分页，支持按文件名搜索）
 * 用于下载面板显示所有容器的下载历史（D-05 决策）
 * @param {number} [limit=50] - 每页记录数
 * @param {number} [offset=0] - 偏移量
 * @param {string} [keyword=''] - 搜索关键字（匹配文件名）
 * @returns {Array} 下载记录数组
 */
function getAllDownloads(limit = 50, offset = 0, keyword = '') {
  if (!db) return [];

  try {
    if (keyword) {
      return db.prepare(`
        SELECT * FROM downloads
        WHERE filename LIKE ?
        ORDER BY start_time DESC
        LIMIT ? OFFSET ?
      `).all(`%${keyword}%`, limit, offset);
    }
    return db.prepare(`
      SELECT * FROM downloads
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  } catch (err) {
    console.error('[Realm] 查询全局下载记录失败:', err.message);
    return [];
  }
}

/**
 * 删除单条下载记录（可选删除本地文件）
 * - 如果下载仍在进行中，先取消下载
 * - deleteFile 为 true 时尝试删除本地文件
 * - 文件删除失败不阻止记录删除
 * @param {string} downloadId - 下载 ID
 * @param {boolean} [deleteFile=false] - 是否同时删除本地文件
 * @returns {{success: boolean, error?: string}}
 */
function deleteDownload(downloadId, deleteFile = false) {
  if (!db) return { success: false, error: '数据库未初始化' };

  try {
    // 先查询记录获取 save_path
    const record = db.prepare('SELECT save_path FROM downloads WHERE id = ?').get(downloadId);
    if (!record) {
      return { success: false, error: '下载记录不存在' };
    }

    // 如果下载仍在进行中，先取消（D-17）
    if (activeDownloads.has(downloadId)) {
      cancelDownload(downloadId);
    }

    // 可选删除本地文件
    if (deleteFile && record.save_path) {
      // 安全验证：确认路径在用户下载目录内（防路径遍历，T-31-01）
      const downloadsDir = app.getPath('downloads');
      const resolvedPath = path.resolve(record.save_path);
      if (!resolvedPath.startsWith(downloadsDir)) {
        console.warn(`[Realm] 拒绝删除下载目录外的文件: ${resolvedPath}`);
      } else {
        try {
          if (fs.existsSync(resolvedPath)) {
            fs.unlinkSync(resolvedPath);
            console.log(`[Realm] 已删除下载文件: ${resolvedPath}`);
          }
        } catch (fileErr) {
          // 文件删除失败不阻止记录删除
          console.error('[Realm] 删除下载文件失败（继续删除记录）:', fileErr.message);
        }
      }
    }

    // 删除 SQLite 记录
    db.prepare('DELETE FROM downloads WHERE id = ?').run(downloadId);
    return { success: true };
  } catch (err) {
    console.error('[Realm] 删除下载记录失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 清空所有下载历史（只删除记录，不删除本地文件，D-16 决策）
 * @returns {{success: boolean, deletedCount: number}}
 */
function clearAllDownloads() {
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = db.prepare('DELETE FROM downloads').run();
    console.log(`[Realm] 已清空下载历史: ${result.changes} 条记录`);
    return { success: true, deletedCount: result.changes };
  } catch (err) {
    console.error('[Realm] 清空下载历史失败:', err.message);
    return { success: false, deletedCount: 0 };
  }
}

// ==================== 控制函数 ====================

/**
 * 取消下载
 * @param {string} downloadId - 下载 ID
 * @returns {boolean} 是否取消成功
 */
function cancelDownload(downloadId) {
  const item = activeDownloads.get(downloadId);
  if (!item) return false;

  try {
    item.cancel();
    return true;
  } catch (err) {
    console.error('[Realm] 取消下载失败:', err.message);
    return false;
  }
}

/**
 * 暂停下载
 * @param {string} downloadId - 下载 ID
 * @returns {boolean} 是否暂停成功
 */
function pauseDownload(downloadId) {
  const item = activeDownloads.get(downloadId);
  if (!item) return false;

  try {
    item.pause();
    // 更新 SQLite 记录状态
    updateDownloadRecord(downloadId, { state: 'paused' });
    // 通知渲染进程
    notifyRenderer('download:progress', {
      downloadId,
      state: 'paused',
    });
    return true;
  } catch (err) {
    console.error('[Realm] 暂停下载失败:', err.message);
    return false;
  }
}

/**
 * 恢复下载
 * @param {string} downloadId - 下载 ID
 * @returns {boolean} 是否恢复成功
 */
function resumeDownload(downloadId) {
  const item = activeDownloads.get(downloadId);
  if (!item) return false;

  try {
    item.resume();
    // 更新 SQLite 记录状态
    updateDownloadRecord(downloadId, { state: 'progressing' });
    // 通知渲染进程
    notifyRenderer('download:progress', {
      downloadId,
      state: 'progressing',
    });
    return true;
  } catch (err) {
    console.error('[Realm] 恢复下载失败:', err.message);
    return false;
  }
}

// ==================== 文件操作 ====================

/**
 * 打开已下载的文件（DL-05）
 * @param {string} filePath - 文件路径
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function openFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: '无效的文件路径' };
  }

  try {
    const errorMsg = await shell.openPath(filePath);
    return { success: !errorMsg, error: errorMsg || null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 在 Finder 中显示已下载的文件（DL-05）
 * @param {string} filePath - 文件路径
 * @returns {{success: boolean}}
 */
function showInFolder(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false };
  }

  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) {
    console.error('[Realm] 在 Finder 中显示文件失败:', err.message);
    return { success: false };
  }
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  registerSessionDownloadHandler,
  getUniqueFilePath,
  getDownloads,
  getAllDownloads,
  deleteDownload,
  clearAllDownloads,
  getActiveCount,
  getActiveDownloads,
  cancelDownload,
  pauseDownload,
  resumeDownload,
  openFile,
  showInFolder,
};

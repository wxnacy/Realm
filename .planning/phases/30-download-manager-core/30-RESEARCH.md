# Phase 30: 下载管理器核心引擎 - Research

**Researched:** 2026-08-11
**Domain:** Electron 下载 API、SQLite 数据存储、容器隔离
**Confidence:** HIGH

## Summary

Phase 30 实现下载管理器核心引擎，需要集成 Electron 的 `will-download` 事件和 `DownloadItem` API 来拦截和管理浏览器下载。关键挑战在于：(1) 在容器隔离架构下，每个容器的 Session 独立，需要在每个容器 Session 上注册 `will-download` 事件监听器；(2) 下载数据需要按容器隔离存储在 SQLite 中，采用单表 + `container_id` 列的模式（D-09 决策）；(3) 工具栏下载按钮需要实时显示下载进度和数量徽标。

**主要建议：** 创建独立的 `download-manager.js` 模块，遵循现有 `history-manager.js` 和 `favorites-manager.js` 的模式，使用 better-sqlite3 存储下载记录，通过 IPC 向渲染进程暴露下载 API。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 下载事件拦截 | Main Process (Session API) | — | will-download 事件只能在主进程处理 |
| 保存对话框 | Main Process (dialog API) | — | 系统原生对话框需要主进程权限 |
| 下载进度跟踪 | Main Process | — | DownloadItem 对象在主进程可用 |
| SQLite 存储 | Main Process | — | better-sqlite3 是原生模块，需在主进程加载 |
| UI 进度显示 | Renderer Process | — | 用户交互层 |
| 文件打开 | Main Process (shell API) | — | shell.openPath 需要主进程权限 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron Session API | 43.3.0 | 下载事件拦截 | 内置 API，无需额外依赖 |
| better-sqlite3 | 13.0.2 | 下载记录存储 | 已在项目中使用，同步 API 性能好 |
| electron-store | 8.1.0 | 下载配置存储 | 已在项目中使用，存储默认保存位置等配置 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path (Node.js built-in) | — | 文件路径处理 | 路径拼接、文件名提取 |
| shell (Electron) | — | 打开文件/Finder | DL-05 需求 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | electron-store | electron-store 适合简单配置，不适合复杂查询和大量记录 |
| 单表 + container_id | 每容器独立表 | 单表更简单，但需要索引优化；独立表隔离性更好但管理复杂 |

**Installation:**
```bash
# 已在项目中，无需额外安装
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| better-sqlite3 | npm | 8+ years | 500K+/week | github.com/WiseLibs/better-sqlite3 | OK | Approved |
| electron-store | npm | 7+ years | 1M+/week | github.com/sindresorhus/electron-store | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Main Process                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Download Manager                          │   │
│  │  - will-download 事件监听（per container session）          │   │
│  │  - DownloadItem 生命周期管理                                │   │
│  │  - 下载速度计算（滑动窗口）                                 │   │
│  │  - SQLite 持久化                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                    │                    │               │
│           ▼                    ▼                    ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │ Session API │    │ dialog API  │    │ shell API           │   │
│  │ will-download│    │ showSave    │    │ openPath            │   │
│  │ DownloadItem │    │ Dialog      │    │ showItemInFolder    │   │
│  └─────────────┘    └─────────────┘    └─────────────────────┘   │
│           │                                                         │
│           │ IPC (download:* channels)                               │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Preload Script                            │   │
│  │  - contextBridge.exposeInMainWorld('downloadAPI', {...})    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Renderer Process                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      UI Layer                               │   │
│  │  - 下载按钮（toolbar-right）                                │   │
│  │  - 圆圈进度条（SVG ring）                                   │   │
│  │  - 数字徽标（download-badge）                               │   │
│  │  - 悬停提示框（download-tooltip）                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
realm/
├── download-manager.js       # 下载管理器核心模块（新建）
├── main.js                   # 主进程入口，注册 download-manager
├── ipc-handlers.js           # IPC 处理器，添加 download:* 命名空间
├── src/
│   ├── preload.js            # 暴露 downloadAPI
│   ├── renderer.js           # 下载按钮 UI 逻辑
│   ├── index.html            # 添加下载按钮 HTML
│   └── styles/
│       └── main.css          # 下载相关样式
```

### Pattern 1: Download Manager 模块设计

**What:** 独立的下载管理器模块，封装所有下载相关逻辑

**When to use:** 所有下载操作

**Example:**
```javascript
// download-manager.js
// Source: Electron 官方文档 DownloadItem API

const { session, dialog, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * 下载管理器模块
 * 负责下载事件拦截、进度跟踪、SQLite 持久化
 */

// 活跃下载映射：downloadId -> DownloadItem
const activeDownloads = new Map();

// 下载记录缓存：downloadId -> { startTime, lastBytes, speedHistory }
const downloadMetrics = new Map();

/**
 * 在容器 Session 上注册下载事件监听器
 * @param {Electron.Session} ses - 容器的 Session 对象
 * @param {string} containerId - 容器 ID
 */
function registerSessionDownloadHandler(ses, containerId) {
  ses.on('will-download', async (event, item, webContents) => {
    // 获取默认保存位置
    const configStore = require('./main').configStore;
    const defaultPath = configStore.get('downloadPath',
      path.join(require('electron').app.getPath('downloads')));

    // 显示保存对话框（D-01, D-09）
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(defaultPath, item.getFilename()),
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      event.preventDefault();
      return;
    }

    // 处理文件名冲突（D-04）
    const savePath = getUniqueFilePath(result.filePath);
    item.setSavePath(savePath);

    // 存储下载元数据
    const downloadId = generateDownloadId();
    activeDownloads.set(downloadId, item);
    downloadMetrics.set(downloadId, {
      startTime: Date.now(),
      lastBytes: 0,
      lastTime: Date.now(),
      speedHistory: [],
      containerId,
      webContentsId: webContents.id
    });

    // 注册事件监听
    setupDownloadItemEvents(item, downloadId, containerId);

    // 通知渲染进程
    notifyRendererDownloadStarted(downloadId, item, containerId);
  });
}

/**
 * 处理文件名冲突，自动添加 (1), (2) 等后缀
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
```

### Pattern 2: DownloadItem 事件处理

**What:** 处理下载进度、完成、中断等事件

**Example:**
```javascript
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

      // 更新 UI
      notifyRendererProgress(downloadId, {
        received,
        total,
        speed,
        percent: total > 0 ? Math.round((received / total) * 100) : 0,
        state: 'progressing'
      });
    } else if (state === 'interrupted') {
      notifyRendererProgress(downloadId, {
        state: 'interrupted',
        reason: 'download-interrupted'
      });
    }
  });

  // 下载完成事件
  item.on('done', (event, state) => {
    const metrics = downloadMetrics.get(downloadId);

    if (state === 'completed') {
      // 保存到 SQLite
      saveDownloadRecord({
        id: downloadId,
        containerId,
        filename: item.getFilename(),
        url: item.getURL(),
        savePath: item.getSavePath(),
        totalBytes: item.getTotalBytes(),
        mimeType: item.getMimeType(),
        startTime: metrics.startTime,
        endTime: Date.now(),
        state: 'completed'
      });

      notifyRendererCompleted(downloadId, {
        state: 'completed',
        savePath: item.getSavePath()
      });
    } else if (state === 'cancelled') {
      saveDownloadRecord({
        id: downloadId,
        containerId,
        filename: item.getFilename(),
        url: item.getURL(),
        state: 'cancelled'
      });

      notifyRendererCompleted(downloadId, { state: 'cancelled' });
    } else if (state === 'interrupted') {
      saveDownloadRecord({
        id: downloadId,
        containerId,
        filename: item.getFilename(),
        url: item.getURL(),
        state: 'interrupted',
        canResume: item.canResume()
      });

      notifyRendererCompleted(downloadId, {
        state: 'interrupted',
        canResume: item.canResume()
      });
    }

    // 清理
    activeDownloads.delete(downloadId);
    downloadMetrics.delete(downloadId);
  });
}
```

### Pattern 3: 下载速度计算（滑动窗口）

**What:** 使用滑动窗口算法计算稳定的下载速度

**Example:**
```javascript
/**
 * 计算下载速度（滑动窗口）
 * @param {string} downloadId - 下载 ID
 * @param {number} currentBytes - 当前已接收字节数
 * @returns {number} 速度（bytes/s）
 */
function calculateSpeed(downloadId, currentBytes) {
  const metrics = downloadMetrics.get(downloadId);
  if (!metrics) return 0;

  const now = Date.now();
  const timeDiff = (now - metrics.lastTime) / 1000; // 转换为秒

  if (timeDiff < 0.1) {
    // 更新间隔太短，返回上次的速度
    return metrics.lastSpeed || 0;
  }

  const bytesDiff = currentBytes - metrics.lastBytes;
  const instantSpeed = bytesDiff / timeDiff;

  // 滑动窗口：保留最近 5 个速度样本
  metrics.speedHistory.push(instantSpeed);
  if (metrics.speedHistory.length > 5) {
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
 * @returns {string} 格式化后的大小
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
  if (speed <= 0) return '计算中...';
  const seconds = Math.ceil(bytesRemaining / speed);
  if (seconds < 60) return `剩余 ${seconds}s`;
  if (seconds < 3600) return `剩余 ${Math.ceil(seconds / 60)}min`;
  return `剩余 ${Math.ceil(seconds / 3600)}h`;
}
```

### Anti-Patterns to Avoid

- **在 will-download 回调外调用 setSavePath:** setSavePath 只能在 will-download 回调中同步调用，否则无效
- **忽略 getTotalBytes() 返回 0 的情况:** 当 Content-Length 未知时返回 0，需要处理除零错误
- **在渲染进程直接访问 DownloadItem:** DownloadItem 只能在主进程使用
- **使用默认 Session 处理所有容器下载:** 必须在每个容器的 Session 上单独注册 will-download

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 文件名冲突处理 | 自定义重命名逻辑 | getUniqueFilePath 函数 | 需要处理边界情况（符号链接、权限等） |
| 下载速度计算 | 简单的差分算法 | 滑动窗口平均 | 避免速度抖动，提供稳定显示 |
| SQLite 表结构 | 每容器独立表 | 单表 + container_id 列 | D-09 决策，简化查询和管理 |

## Common Pitfalls

### Pitfall 1: will-download 事件未在容器 Session 上注册

**What goes wrong:** 下载事件不触发，无法拦截下载

**Why it happens:** 只在 defaultSession 上注册了 will-download，但容器使用独立的 Session partition

**How to avoid:** 在容器初始化时调用 `registerSessionDownloadHandler(ses, containerId)`

**Warning signs:** 点击下载链接后直接下载到默认位置，没有保存对话框

### Pitfall 2: getTotalBytes() 返回 0 导致除零错误

**What goes wrong:** 进度计算 NaN 或显示异常

**Why it happens:** 服务器未返回 Content-Length 头

**How to avoid:** 检查 totalBytes > 0 再计算百分比

```javascript
const percent = total > 0 ? Math.round((received / total) * 100) : 0;
```

### Pitfall 3: DownloadItem 在异步操作后失效

**What goes wrong:** 调用 item.setSavePath() 时报错

**Why it happens:** setSavePath 只能在 will-download 回调中同步调用

**How to avoid:** 在回调开始时立即设置保存路径，不要在 await 之后调用

### Pitfall 4: resume() 静默失败

**What goes wrong:** 调用 resume() 后下载从头开始

**Why it happens:** 服务器不支持 Range 请求或未返回 Last-Modified/ETag 头

**How to avoid:** 检查 item.canResume() 再决定是否显示恢复按钮

## Code Examples

### 注册容器 Session 下载处理器

```javascript
// Source: Electron 官方文档 session.will-download
// 在容器初始化时调用

const { session } = require('electron');

/**
 * 为容器注册下载事件监听器
 * @param {string} containerId - 容器 ID
 */
function registerContainerDownload(containerId) {
  const partition = `persist:container-${containerId}`;
  const ses = session.fromPartition(partition);

  ses.on('will-download', async (event, item, webContents) => {
    // 处理下载...
  });
}
```

### IPC 通道注册

```javascript
// main.js 或 ipc-handlers.js

const { ipcMain, shell } = require('electron');
const downloadManager = require('./download-manager');

// 下载相关 IPC 通道
ipcMain.handle('download:list', async (event, containerId) => {
  return downloadManager.getDownloads(containerId);
});

ipcMain.handle('download:cancel', async (event, downloadId) => {
  return downloadManager.cancelDownload(downloadId);
});

ipcMain.handle('download:pause', async (event, downloadId) => {
  return downloadManager.pauseDownload(downloadId);
});

ipcMain.handle('download:resume', async (event, downloadId) => {
  return downloadManager.resumeDownload(downloadId);
});

ipcMain.handle('download:open-file', async (event, filePath) => {
  const errorMsg = await shell.openPath(filePath);
  return { success: !errorMsg, error: errorMsg || null };
});

ipcMain.handle('download:show-in-folder', async (event, filePath) => {
  shell.showItemInFolder(filePath);
  return { success: true };
});

ipcMain.handle('download:get-active-count', async () => {
  return downloadManager.getActiveCount();
});
```

### Preload API 暴露

```javascript
// src/preload.js

contextBridge.exposeInMainWorld('downloadAPI', {
  /**
   * 获取下载列表
   * @param {string} containerId - 容器 ID
   * @returns {Promise<Array>} 下载记录数组
   */
  getDownloads: (containerId) => ipcRenderer.invoke('download:list', containerId),

  /**
   * 取消下载
   * @param {string} downloadId - 下载 ID
   * @returns {Promise<boolean>}
   */
  cancelDownload: (downloadId) => ipcRenderer.invoke('download:cancel', downloadId),

  /**
   * 暂停下载
   * @param {string} downloadId - 下载 ID
   * @returns {Promise<boolean>}
   */
  pauseDownload: (downloadId) => ipcRenderer.invoke('download:pause', downloadId),

  /**
   * 恢复下载
   * @param {string} downloadId - 下载 ID
   * @returns {Promise<boolean>}
   */
  resumeDownload: (downloadId) => ipcRenderer.invoke('download:resume', downloadId),

  /**
   * 打开文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  openFile: (filePath) => ipcRenderer.invoke('download:open-file', filePath),

  /**
   * 在 Finder 中显示文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean}>}
   */
  showInFolder: (filePath) => ipcRenderer.invoke('download:show-in-folder', filePath),

  /**
   * 获取活跃下载数量
   * @returns {Promise<number>}
   */
  getActiveCount: () => ipcRenderer.invoke('download:get-active-count'),

  /**
   * 监听下载开始事件
   * @param {Function} callback - 回调函数
   */
  onDownloadStarted: (callback) => {
    ipcRenderer.on('download:started', (event, data) => callback(data));
  },

  /**
   * 监听下载进度事件
   * @param {Function} callback - 回调函数
   */
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download:progress', (event, data) => callback(data));
  },

  /**
   * 监听下载完成事件
   * @param {Function} callback - 回调函数
   */
  onDownloadCompleted: (callback) => {
    ipcRenderer.on('download:completed', (event, data) => callback(data));
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shell.openItem | shell.openPath | Electron 9+ | 返回 Promise<string>，空字符串表示成功 |

**Deprecated/outdated:**
- shell.openItem: 已废弃，使用 shell.openPath 替代

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 下载 API | ✓ | 43.3.0 | — |
| better-sqlite3 | SQLite 存储 | ✓ | 13.0.2 | — |
| electron-store | 配置存储 | ✓ | 8.1.0 | — |
| Node.js path | 路径处理 | ✓ | built-in | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前没有测试框架） |
| Config file | none |
| Quick run command | — |
| Full suite command | — |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DL-01 | 显示下载进度条 | manual | — | ❌ Wave 0 |
| DL-05 | 打开已下载文件 | manual | — | ❌ Wave 0 |
| DL-09 | 显示保存对话框 | manual | — | ❌ Wave 0 |
| DL-10 | 工具栏徽标 | manual | — | ❌ Wave 0 |
| DL-11 | SQLite 存储 | manual | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动测试
- **Per wave merge:** 手动测试
- **Phase gate:** 手动验证所有需求

### Wave 0 Gaps
- [ ] 无自动化测试（项目未配置测试框架）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | 下载操作权限控制 |
| V5 Input Validation | yes | 文件路径验证、URL 验证 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron Download Manager

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 路径遍历攻击 | Tampering | 验证保存路径在允许的目录内 |
| 恶意文件下载 | Elevation of Privilege | 检查文件类型，限制可执行文件下载 |
| 下载链接注入 | Tampering | 验证下载来源 URL |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 项目使用 Electron 43.3.0（从 package.json 确认） | Standard Stack | 低，已验证 |
| A2 | better-sqlite3 13.0.2 已安装且可用 | Standard Stack | 低，已在项目中使用 |
| A3 | 下载记录永久保留，用户手动删除 | Architecture | 中，可能需要实现清理机制 |

## Open Questions

1. **下载记录保留策略**
   - What we know: D-12 决策记录永久保留
   - What's unclear: 是否需要实现自动清理或容量限制
   - Recommendation: Phase 30 实现基础存储，Phase 31 实现管理功能

2. **并发下载数量限制**
   - What we know: 未定义
   - What's unclear: 是否需要限制同时下载数量
   - Recommendation: 不限制，由浏览器和服务器决定

## Sources

### Primary (HIGH confidence)
- Electron 官方文档 DownloadItem API - https://www.electronjs.org/docs/latest/api/download-item
- Electron 官方文档 session.will-download - https://www.electronjs.org/docs/latest/api/session#event-will-download
- Electron 官方文档 shell - https://www.electronjs.org/docs/latest/api/shell

### Secondary (MEDIUM confidence)
- 项目现有代码模式（history-manager.js, favorites-manager.js）
- Phase 30 CONTEXT.md 决策文档
- Phase 30 UI-SPEC.md 设计规范

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - 所有依赖已在项目中使用，API 文档完整
- Architecture: HIGH - 清晰的模块划分，遵循现有模式
- Pitfalls: HIGH - 从官方文档和社区经验总结

**Research date:** 2026-08-11
**Valid until:** 2026-09-11（Electron API 稳定，30 天有效）
